<?php

require_once __DIR__ . '/lib/private-paths.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

define('ORDER_MEDIA_LEGACY_MAX_BYTES', 15 * 1024 * 1024);
define('ORDER_MEDIA_ARTWORK_MAX_BYTES', 30 * 1024 * 1024);

/**
 * ORDER_MEDIA_RETENTION_V2 — os ficheiros dos clientes NÃO são apagados
 * automaticamente.
 *
 * Antes havia um TTL de 7 dias sobre a pasta `tmp` (uploads que nunca chegaram
 * a virar encomenda). Foi retirado por decisão do Tiago: tudo o que um cliente
 * envia fica no servidor até ele decidir apagar.
 *
 * Como já não há expiração, o travão passa a ser o espaço:
 *
 *  - ORDER_MEDIA_AREA_BUDGET_BYTES — tecto de toda a área `order-uploads`
 *    (tmp + pastas de encomenda). Acima disto, uploads NOVOS são recusados
 *    com uma mensagem clara. Nunca se apaga nada para abrir espaço.
 *  - ORDER_MEDIA_AREA_WARN_BYTES — a partir daqui escreve-se um aviso no
 *    error_log a cada upload, para o problema aparecer antes de o site
 *    começar a recusar ficheiros.
 *  - Limite por IP (ver mp_db_form_rate_limited) — impede que alguém encha
 *    o disco sozinho.
 *
 * Para libertar espaço, apagar à mão em `private/order-uploads/`:
 *   - `tmp/` são uploads abandonados: cada ficheiro tem um `<token>.json` ao
 *     lado com nome original, data e tamanho.
 *   - `orders/<CODIGO>/` são os anexos de uma encomenda concreta.
 */
define('ORDER_MEDIA_AREA_BUDGET_BYTES', 8 * 1024 * 1024 * 1024);   // 8 GiB
define('ORDER_MEDIA_AREA_WARN_BYTES', 6 * 1024 * 1024 * 1024);     // 6 GiB
define('ORDER_MEDIA_AREA_CACHE_SECONDS', 300);
define('ORDER_MEDIA_UPLOADS_PER_IP_PER_HOUR', 60);

function order_media_respond($status, $payload)
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function order_media_safe_name($name, $fallback)
{
    $name = basename(str_replace('\\', '/', (string)$name));
    $name = trim((string)preg_replace('/[[:cntrl:]]+/', '', $name));
    if ($name === '') {
        return $fallback;
    }
    return function_exists('mb_substr') ? mb_substr($name, 0, 160, 'UTF-8') : substr($name, 0, 160);
}

function order_media_files()
{
    $source = !empty($_FILES['media']) ? $_FILES['media'] : (!empty($_FILES['photos']) ? $_FILES['photos'] : null);
    if ($source === null) {
        return array();
    }

    $names = isset($source['name']) && is_array($source['name']) ? $source['name'] : array($source['name']);
    $types = isset($source['type']) && is_array($source['type']) ? $source['type'] : array($source['type']);
    $tmpNames = isset($source['tmp_name']) && is_array($source['tmp_name']) ? $source['tmp_name'] : array($source['tmp_name']);
    $errors = isset($source['error']) && is_array($source['error']) ? $source['error'] : array($source['error']);
    $sizes = isset($source['size']) && is_array($source['size']) ? $source['size'] : array($source['size']);
    $files = array();

    foreach ($names as $index => $name) {
        $files[] = array(
            'name' => $name,
            'type' => isset($types[$index]) ? $types[$index] : '',
            'tmp_name' => isset($tmpNames[$index]) ? $tmpNames[$index] : '',
            'error' => isset($errors[$index]) ? (int)$errors[$index] : UPLOAD_ERR_NO_FILE,
            'size' => isset($sizes[$index]) ? (int)$sizes[$index] : 0,
        );
    }
    return $files;
}

function order_media_mime($path)
{
    if (class_exists('finfo')) {
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($path);
        if (is_string($mime) && $mime !== '') {
            return strtolower($mime);
        }
    }
    return '';
}

function order_media_signature_type($path)
{
    $handle = @fopen($path, 'rb');
    if ($handle === false) {
        return null;
    }
    $header = (string)fread($handle, 64);
    fclose($handle);

    if (strlen($header) >= 3 && substr($header, 0, 3) === "\xFF\xD8\xFF") {
        return array('mime' => 'image/jpeg', 'extension' => 'jpg', 'kind' => 'photo');
    }
    if (strlen($header) >= 8 && substr($header, 0, 8) === "\x89PNG\r\n\x1A\n") {
        return array('mime' => 'image/png', 'extension' => 'png', 'kind' => 'photo');
    }
    if (strlen($header) >= 12 && substr($header, 0, 4) === 'RIFF') {
        if (substr($header, 8, 4) === 'WEBP') {
            return array('mime' => 'image/webp', 'extension' => 'webp', 'kind' => 'photo');
        }
        if (substr($header, 8, 4) === 'WAVE') {
            return array('mime' => 'audio/wav', 'extension' => 'wav', 'kind' => 'audio');
        }
    }
    if (strlen($header) >= 4 && substr($header, 0, 4) === "\x1A\x45\xDF\xA3") {
        return array('mime' => 'audio/webm', 'extension' => 'webm', 'kind' => 'audio');
    }
    if (strlen($header) >= 4 && substr($header, 0, 4) === 'OggS') {
        return array('mime' => 'audio/ogg', 'extension' => 'ogg', 'kind' => 'audio');
    }
    if (strlen($header) >= 8 && preg_match('/^%PDF-[12]\.[0-9]/', $header)) {
        return array('mime' => 'application/pdf', 'extension' => 'pdf', 'kind' => 'document');
    }
    if (strlen($header) >= 3 && (substr($header, 0, 3) === 'ID3' || (ord($header[0]) === 0xFF && (ord($header[1]) & 0xE0) === 0xE0))) {
        return array('mime' => 'audio/mpeg', 'extension' => 'mp3', 'kind' => 'audio');
    }
    if (strlen($header) >= 12 && substr($header, 4, 4) === 'ftyp') {
        $brand = strtolower(substr($header, 8, 4));
        if (in_array($brand, array('heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'), true)) {
            return array('mime' => 'image/heic', 'extension' => 'heic', 'kind' => 'photo');
        }
        return array('mime' => 'audio/mp4', 'extension' => 'm4a', 'kind' => 'audio');
    }
    return null;
}

function order_media_is_custom_artwork()
{
    return isset($_POST['purpose']) && trim((string)$_POST['purpose']) === 'custom-artwork';
}

function order_media_pdf_is_valid($path)
{
    $size = @filesize($path);
    if ($size === false || $size < 12) {
        return false;
    }

    $handle = @fopen($path, 'rb');
    if ($handle === false) {
        return false;
    }
    $header = (string)fread($handle, 16);
    $tailLength = min(8192, (int)$size);
    if (@fseek($handle, -$tailLength, SEEK_END) !== 0) {
        fclose($handle);
        return false;
    }
    $tail = (string)fread($handle, $tailLength);
    fclose($handle);

    if (!preg_match('/^%PDF-[12]\.[0-9]/', $header) || !preg_match('/%%EOF[\x00\x09\x0A\x0C\x0D\x20]*$/s', $tail)) {
        return false;
    }

    $finfoMime = order_media_mime($path);
    return $finfoMime === '' || in_array($finfoMime, array('application/pdf', 'application/x-pdf'), true);
}

function order_media_custom_image_dimensions($path, $mime, &$width, &$height)
{
    $width = 0;
    $height = 0;
    $finfoMime = order_media_mime($path);

    if ($mime === 'image/heic' || $mime === 'image/heif') {
        if ($finfoMime !== '' && !in_array($finfoMime, array(
            'image/heic',
            'image/heif',
            'image/heic-sequence',
            'image/heif-sequence',
            'application/octet-stream',
        ), true)) {
            return false;
        }
        $imageSize = @getimagesize($path);
        if (is_array($imageSize)) {
            $width = max(0, (int)$imageSize[0]);
            $height = max(0, (int)$imageSize[1]);
        }
        return true;
    }

    if (!in_array($mime, array('image/jpeg', 'image/png', 'image/webp'), true)) {
        return false;
    }
    if ($finfoMime !== '' && $finfoMime !== $mime) {
        return false;
    }

    $imageSize = @getimagesize($path);
    if (!is_array($imageSize) || empty($imageSize[0]) || empty($imageSize[1])) {
        return false;
    }
    $reportedMime = isset($imageSize['mime']) ? strtolower(trim((string)$imageSize['mime'])) : '';
    if ($reportedMime !== '' && $reportedMime !== $mime) {
        return false;
    }
    $width = max(0, (int)$imageSize[0]);
    $height = max(0, (int)$imageSize[1]);
    return true;
}

function order_media_artwork_type($file, &$width, &$height)
{
    $width = 0;
    $height = 0;
    $type = order_media_signature_type($file['tmp_name']);
    if ($type === null) {
        return null;
    }

    $originalExtension = strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION));
    if ($type['mime'] === 'application/pdf') {
        if (!order_media_pdf_is_valid($file['tmp_name'])) {
            return null;
        }
        $type['kind'] = 'artwork';
        $type['extension'] = 'pdf';
        return $type;
    }

    if (!in_array($type['mime'], array('image/jpeg', 'image/png', 'image/webp', 'image/heic'), true)) {
        return null;
    }
    if ($type['mime'] === 'image/heic' && $originalExtension === 'heif') {
        $type['mime'] = 'image/heif';
        $type['extension'] = 'heif';
    }
    if (!order_media_custom_image_dimensions($file['tmp_name'], $type['mime'], $width, $height)) {
        return null;
    }

    $extensions = array(
        'image/jpeg' => array('jpg', 'jpeg'),
        'image/png' => array('png'),
        'image/webp' => array('webp'),
        'image/heic' => array('heic'),
        'image/heif' => array('heif'),
    );
    if (isset($extensions[$type['mime']]) && in_array($originalExtension, $extensions[$type['mime']], true)) {
        $type['extension'] = $originalExtension;
    }
    $type['kind'] = 'artwork';
    return $type;
}

function order_media_type($file)
{
    $signature = order_media_signature_type($file['tmp_name']);
    if ($signature !== null) {
        if ($signature['mime'] === 'application/pdf') {
            return null;
        }
        if ($signature['mime'] === 'image/heic' && strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION)) === 'heif') {
            $signature['mime'] = 'image/heif';
            $signature['extension'] = 'heif';
        }
        return $signature;
    }

    $mime = order_media_mime($file['tmp_name']);
    $types = array(
        'audio/webm' => array('webm', 'audio'),
        'video/webm' => array('webm', 'audio'),
        'audio/ogg' => array('ogg', 'audio'),
        'audio/wav' => array('wav', 'audio'),
        'audio/x-wav' => array('wav', 'audio'),
        'audio/mpeg' => array('mp3', 'audio'),
        'audio/mp4' => array('m4a', 'audio'),
        'video/mp4' => array('m4a', 'audio'),
    );
    return isset($types[$mime])
        ? array('mime' => $mime, 'extension' => $types[$mime][0], 'kind' => $types[$mime][1])
        : null;
}

function order_media_temp_dir()
{
    return mp_private_path('order-uploads' . DIRECTORY_SEPARATOR . 'tmp');
}

/**
 * Espaço ocupado por toda a área de uploads (`tmp` + `orders`).
 *
 * Percorrer a árvore em cada pedido seria caro, por isso o valor fica em
 * cache num ficheiro ao lado durante ORDER_MEDIA_AREA_CACHE_SECONDS. O
 * `$delta` soma o que se acabou de gravar, para o cache não ficar a mentir
 * durante vários uploads seguidos.
 */
function order_media_area_bytes($areaDir, $delta = 0)
{
    $cachePath = $areaDir . DIRECTORY_SEPARATOR . '.tamanho.json';
    $cache = json_decode((string)@file_get_contents($cachePath), true);
    $agora = time();

    if (
        is_array($cache)
        && isset($cache['bytes'], $cache['at'])
        && ($agora - (int)$cache['at']) < ORDER_MEDIA_AREA_CACHE_SECONDS
    ) {
        $bytes = max(0, (int)$cache['bytes'] + (int)$delta);
        if ((int)$delta !== 0) {
            @file_put_contents($cachePath, json_encode(array('bytes' => $bytes, 'at' => (int)$cache['at'])), LOCK_EX);
        }
        return $bytes;
    }

    $bytes = 0;
    try {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($areaDir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY
        );
        foreach ($iterator as $entry) {
            if ($entry->isFile()) {
                $bytes += (int)$entry->getSize();
            }
        }
    } catch (Exception $error) {
        // Pasta acabou de ser criada, ou foi mexida a meio da contagem.
        // Devolver 0 é seguro: o tecto só serve para recusar, nunca para
        // apagar, por isso na pior das hipóteses aceita-se mais um upload.
        return max(0, (int)$delta);
    }

    @file_put_contents($cachePath, json_encode(array('bytes' => $bytes, 'at' => $agora)), LOCK_EX);
    return $bytes;
}

if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    order_media_respond(405, array('ok' => false, 'message' => 'Método não permitido.'));
}

$origin = isset($_SERVER['HTTP_ORIGIN']) ? trim((string)$_SERVER['HTTP_ORIGIN']) : '';
$host = isset($_SERVER['HTTP_HOST']) ? strtolower(trim((string)$_SERVER['HTTP_HOST'])) : '';
if ($origin !== '') {
    $originHost = parse_url($origin, PHP_URL_HOST);
    $requestHost = preg_replace('/:\d+$/', '', $host);
    if (!is_string($originHost) || strtolower($originHost) !== strtolower($requestHost)) {
        order_media_respond(403, array('ok' => false, 'message' => 'Origem inválida.'));
    }
}

$privateDir = order_media_temp_dir();
if ($privateDir === null || (!is_dir($privateDir) && !@mkdir($privateDir, 0700, true))) {
    order_media_respond(500, array('ok' => false, 'message' => 'Não foi possível preparar o envio.'));
}
@chmod($privateDir, 0700);

// A área a medir é a pasta-mãe: `tmp` e `orders` partilham o mesmo tecto.
$areaDir = dirname($privateDir);

if (isset($_POST['action']) && $_POST['action'] === 'delete') {
    $token = isset($_POST['token']) ? strtolower(trim((string)$_POST['token'])) : '';
    if (!preg_match('/^[a-f0-9]{32,40}$/', $token)) {
        order_media_respond(400, array('ok' => false, 'message' => 'Ficheiro inválido.'));
    }
    $metadataPath = $privateDir . DIRECTORY_SEPARATOR . $token . '.json';
    $metadata = is_file($metadataPath) ? json_decode((string)@file_get_contents($metadataPath), true) : null;
    if (is_array($metadata) && !empty($metadata['stored_name'])) {
        $storedName = basename((string)$metadata['stored_name']);
        if (strpos($storedName, $token . '.') === 0) {
            @unlink($privateDir . DIRECTORY_SEPARATOR . $storedName);
        }
    }
    @unlink($metadataPath);
    order_media_respond(200, array('ok' => true));
}

$files = order_media_files();
$customArtwork = order_media_is_custom_artwork();
if (empty($files)) {
    order_media_respond(400, array('ok' => false, 'message' => 'Não foi possível receber o ficheiro. Tenta novamente.'));
}
if (count($files) > 10) {
    order_media_respond(400, array('ok' => false, 'message' => 'Envia os ficheiros novamente, em grupos mais pequenos.'));
}

// ORDER_MEDIA_RETENTION_V2 — guardrails. Como nada é apagado por tempo, o que
// protege o disco é o limite por IP e o tecto da área toda.
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/avisos.php';

if (mp_db_form_rate_limited('upload', isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '', ORDER_MEDIA_UPLOADS_PER_IP_PER_HOUR)) {
    mp_aviso('guardrail', 'upload-ritmo', 'Travão de uploads: demasiados ficheiros do mesmo dispositivo', array_merge(
        array(
            'Alguém passou o limite de ' . ORDER_MEDIA_UPLOADS_PER_IP_PER_HOUR . ' uploads por hora.',
            'Os ficheiros seguintes foram recusados até a hora passar.',
            '',
            'Se for uma cliente com uma encomenda grande, o limite está em',
            'ORDER_MEDIA_UPLOADS_PER_IP_PER_HOUR, no upload-order-photo.php.',
            '',
        ),
        mp_aviso_contexto()
    ));
    order_media_respond(429, array(
        'ok' => false,
        'message' => 'Já recebemos muitos ficheiros deste dispositivo. Espera um bocado antes de enviar mais.',
    ));
}

$incomingBytes = 0;
foreach ($files as $file) {
    $incomingBytes += max(0, (int)$file['size']);
}

$areaBytes = order_media_area_bytes($areaDir);
if ($areaBytes + $incomingBytes > ORDER_MEDIA_AREA_BUDGET_BYTES) {
    // Nunca se apaga para abrir espaço — os ficheiros dos clientes ficam até
    // o Tiago decidir. Recusa-se o novo e regista-se para ele saber.
    @error_log(sprintf(
        '[miaandpaper] uploads recusados: area em %.2f GiB, tecto %.2f GiB. Libertar espaco em private/order-uploads/.',
        $areaBytes / 1073741824,
        ORDER_MEDIA_AREA_BUDGET_BYTES / 1073741824
    ));
    mp_aviso('guardrail', 'upload-espaco-cheio', 'URGENTE: o site já não aceita ficheiros de clientes', array_merge(
        array(
            'A pasta de uploads chegou ao tecto e os envios estão a ser RECUSADOS.',
            '',
            'Ocupado: ' . mp_aviso_tamanho($areaBytes),
            'Tecto:    ' . mp_aviso_tamanho(ORDER_MEDIA_AREA_BUDGET_BYTES),
            '',
            'Nada foi apagado — os ficheiros dos clientes só saem quando tu quiseres.',
            'Para libertar espaço, em private/order-uploads/:',
            '  tmp/            uploads que nunca chegaram a virar encomenda',
            '                  (cada ficheiro tem um .json ao lado a dizer o que é)',
            '  orders/CODIGO/  anexos de uma encomenda — confirma em admin-orders.php',
            '',
            'Enquanto isto não for resolvido, quem tentar enviar uma foto vê uma',
            'mensagem a pedir para falar contigo pelo Instagram.',
            '',
        ),
        mp_aviso_contexto()
    ));
    order_media_respond(507, array(
        'ok' => false,
        'message' => 'Não conseguimos guardar mais ficheiros neste momento. Fala connosco pelo Instagram que resolvemos já.',
    ));
}
if ($areaBytes >= ORDER_MEDIA_AREA_WARN_BYTES) {
    @error_log(sprintf(
        '[miaandpaper] AVISO: area de uploads em %.2f GiB de %.2f GiB. Convem libertar espaco em private/order-uploads/.',
        $areaBytes / 1073741824,
        ORDER_MEDIA_AREA_BUDGET_BYTES / 1073741824
    ));
    mp_aviso('guardrail', 'upload-espaco-aviso', 'A pasta de uploads está a encher', array(
        'Ainda aceita ficheiros, mas convém libertar espaço antes de chegar ao tecto.',
        '',
        'Ocupado: ' . mp_aviso_tamanho($areaBytes)
            . ' de ' . mp_aviso_tamanho(ORDER_MEDIA_AREA_BUDGET_BYTES)
            . ' (' . round(100 * $areaBytes / ORDER_MEDIA_AREA_BUDGET_BYTES) . '%)',
        'Falta:   ' . mp_aviso_tamanho(ORDER_MEDIA_AREA_BUDGET_BYTES - $areaBytes),
        '',
        'Quando chegar ao tecto, o site deixa de aceitar fotos dos clientes.',
        'Nada é apagado automaticamente — a limpeza é sempre tua, em',
        'private/order-uploads/.',
    ));
}

$uploads = array();
foreach ($files as $file) {
    $actualSize = @filesize($file['tmp_name']);
    $maxBytes = $customArtwork ? ORDER_MEDIA_ARTWORK_MAX_BYTES : ORDER_MEDIA_LEGACY_MAX_BYTES;
    if (
        $file['error'] !== UPLOAD_ERR_OK
        || $actualSize === false
        || $actualSize < 1
        || $actualSize > $maxBytes
        || !is_uploaded_file($file['tmp_name'])
    ) {
        order_media_respond(400, array('ok' => false, 'message' => 'Não foi possível receber o ficheiro. Tenta novamente.'));
    }

    $width = 0;
    $height = 0;
    $type = $customArtwork
        ? order_media_artwork_type($file, $width, $height)
        : order_media_type($file);
    if ($type === null) {
        if ($customArtwork) {
            order_media_respond(415, array('ok' => false, 'message' => 'Escolhe um ficheiro JPG, PNG, WebP, HEIC ou PDF válido.'));
        }
        order_media_respond(415, array('ok' => false, 'message' => 'Escolhe uma foto JPG, PNG, WebP ou HEIC, ou grava um novo áudio.'));
    }

    $sha256 = @hash_file('sha256', $file['tmp_name']);
    if (!is_string($sha256) || !preg_match('/^[a-f0-9]{64}$/', $sha256)) {
        order_media_respond(500, array('ok' => false, 'message' => 'Não foi possível validar o ficheiro.'));
    }

    try {
        $token = bin2hex(random_bytes(16));
    } catch (Exception $error) {
        $token = sha1(uniqid('', true) . mt_rand());
    }
    $storedName = $token . '.' . $type['extension'];
    $storedPath = $privateDir . DIRECTORY_SEPARATOR . $storedName;
    $metadataPath = $privateDir . DIRECTORY_SEPARATOR . $token . '.json';

    if (!$customArtwork && $type['kind'] === 'photo' && !order_media_custom_image_dimensions($file['tmp_name'], $type['mime'], $width, $height)) {
        order_media_respond(415, array('ok' => false, 'message' => 'Escolhe uma foto JPG, PNG, WebP ou HEIC válida.'));
    }
    $shortSide = min($width, $height);
    $longSide = max($width, $height);
    $dpi = $shortSide > 0 && $longSide > 0 ? (int)round(min($shortSide / 10, $longSide / 15)) : 0;
    $metadata = array(
        'token' => $token,
        'name' => order_media_safe_name($file['name'], $type['kind'] === 'audio' ? 'áudio' : ($type['kind'] === 'artwork' ? 'ficheiro' : 'foto')),
        'size' => (int)$actualSize,
        'sha256' => $sha256,
        'mime' => $type['mime'],
        'kind' => $type['kind'],
        'extension' => $type['extension'],
        'width' => $width,
        'height' => $height,
        'dpi' => $dpi,
        'stored_name' => $storedName,
        'created_at' => gmdate('c'),
    );
    if ($customArtwork) {
        $metadata['purpose'] = 'custom-artwork';
    }

    if (!move_uploaded_file($file['tmp_name'], $storedPath)) {
        order_media_respond(500, array('ok' => false, 'message' => 'Não foi possível guardar o ficheiro.'));
    }
    @chmod($storedPath, 0600);
    $storedSize = @filesize($storedPath);
    $storedSha256 = @hash_file('sha256', $storedPath);
    if ((int)$storedSize !== (int)$actualSize || !is_string($storedSha256) || !hash_equals($sha256, $storedSha256)) {
        @unlink($storedPath);
        order_media_respond(500, array('ok' => false, 'message' => 'Não foi possível confirmar o ficheiro guardado.'));
    }
    if (@file_put_contents($metadataPath, json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX) === false) {
        @unlink($storedPath);
        order_media_respond(500, array('ok' => false, 'message' => 'Não foi possível concluir o envio.'));
    }
    @chmod($metadataPath, 0600);
    $uploads[] = array(
        'token' => $token,
        'name' => $metadata['name'],
        'size' => $metadata['size'],
        'mime' => $metadata['mime'],
        'kind' => $metadata['kind'],
        'width' => $metadata['width'],
        'height' => $metadata['height'],
        'dpi' => $metadata['dpi'],
    );
}

// Mantém o cache de tamanho honesto entre varreduras completas.
$gravado = 0;
foreach ($uploads as $upload) {
    $gravado += max(0, (int)$upload['size']);
}
if ($gravado > 0) {
    order_media_area_bytes($areaDir, $gravado);
}

// AVISOS_ADMIN_V1: um cliente enviou ficheiros. A janela de silêncio é de 15
// minutos por IP, para uma pessoa que envie oito fotos seguidas dar um aviso
// e não oito. O pedido seguinte da mesma pessoa diz quantos ficaram por
// contar.
if (!empty($uploads)) {
    $linhas = array(
        count($uploads) === 1
            ? 'Chegou 1 ficheiro de um cliente.'
            : 'Chegaram ' . count($uploads) . ' ficheiros de um cliente.',
        '',
    );
    foreach ($uploads as $u) {
        $dim = ($u['width'] && $u['height']) ? '  ' . $u['width'] . 'x' . $u['height'] . 'px' : '';
        $dpi = !empty($u['dpi']) ? '  ~' . $u['dpi'] . ' dpi' : '';
        $linhas[] = '  ' . $u['name'] . '  (' . mp_aviso_tamanho($u['size']) . $dim . $dpi . ')';
    }
    $linhas[] = '';
    $linhas[] = $customArtwork
        ? 'Vieram pelo fluxo de personalização (design do cliente).'
        : 'Vieram pelo fluxo normal de fotos.';
    $linhas[] = '';
    $linhas[] = 'Atenção: isto é só o envio do ficheiro. Se a pessoa não terminar o';
    $linhas[] = 'pedido, o ficheiro fica em private/order-uploads/tmp/ e não há';
    $linhas[] = 'encomenda nenhuma associada.';
    $linhas[] = '';

    mp_aviso(
        'upload',
        'ficheiros-' . (isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'sem-ip'),
        count($uploads) === 1 ? 'Um cliente enviou um ficheiro' : 'Um cliente enviou ' . count($uploads) . ' ficheiros',
        array_merge($linhas, mp_aviso_contexto())
    );
}

order_media_respond(200, array('ok' => true, 'uploads' => $uploads));
