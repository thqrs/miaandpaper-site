<?php

require_once __DIR__ . '/lib/private-paths.php';
require_once __DIR__ . '/lib/client-ip.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

/**
 * O tecto por ficheiro. 40 MB dá para uma foto de telemóvel moderno em máxima
 * qualidade ou um PDF de impressão sem a pessoa ter de ir reduzir nada.
 *
 * Este é o limite que manda: o .user.ini está de propósito acima (44M/48M) para
 * que seja este ficheiro a recusar, com mensagem e com uma entrada em
 * private/order-uploads/rejeicoes.log. Se algum dia baixares o .user.ini abaixo
 * destes valores, o PHP passa a cortar primeiro e perdes as duas coisas.
 */
define('ORDER_MEDIA_LEGACY_MAX_BYTES', 40 * 1024 * 1024);
define('ORDER_MEDIA_ARTWORK_MAX_BYTES', 40 * 1024 * 1024);

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

/**
 * ORDER_MEDIA_REJECT_LOG_V1 — quando um ficheiro é recusado, o cliente vê uma
 * frase curta e nós ficamos sem saber porquê. Cada recusa passa a escrever um
 * bloco em `private/order-uploads/rejeicoes.log` com tudo o que é preciso para
 * perceber o caso sem estar lá: limites do PHP em vigor, tamanho anunciado pelo
 * browser vs. tamanho que chegou, código de erro do upload, assinatura do
 * ficheiro, o que o finfo/getimagesize disseram.
 *
 * Uma linha-resumo vai também para o error_log, que no `php -S` do
 * desenvolvimento é a consola. A resposta JSON leva um `code` estável (nunca
 * texto para o cliente ler) para o log do browser cruzar com este ficheiro.
 *
 * O ficheiro roda sozinho aos 2 MiB para nunca crescer sem fim.
 */
define('ORDER_MEDIA_REJECT_LOG_MAX_BYTES', 2 * 1024 * 1024);

function order_media_respond($status, $payload)
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** "30M", "8K", "1G" ou um número puro → bytes. 0 quando é ilimitado. */
function order_media_ini_bytes($value)
{
    $value = trim((string)$value);
    if ($value === '' || $value === '-1') {
        return 0;
    }
    $unit = strtolower(substr($value, -1));
    $number = (float)$value;
    if ($unit === 'g') {
        return (int)($number * 1073741824);
    }
    if ($unit === 'm') {
        return (int)($number * 1048576);
    }
    if ($unit === 'k') {
        return (int)($number * 1024);
    }
    return (int)$number;
}

function order_media_bytes_human($bytes)
{
    $bytes = (int)$bytes;
    if ($bytes <= 0) {
        return '0 B';
    }
    if ($bytes < 1024) {
        return $bytes . ' B';
    }
    if ($bytes < 1048576) {
        return round($bytes / 1024, 1) . ' KB';
    }
    return round($bytes / 1048576, 2) . ' MB';
}

/** Nome legível do código de erro do PHP para um ficheiro do $_FILES. */
function order_media_upload_error_name($code)
{
    $nomes = array(
        UPLOAD_ERR_OK => 'UPLOAD_ERR_OK',
        UPLOAD_ERR_INI_SIZE => 'UPLOAD_ERR_INI_SIZE (maior que upload_max_filesize)',
        UPLOAD_ERR_FORM_SIZE => 'UPLOAD_ERR_FORM_SIZE (maior que MAX_FILE_SIZE do formulário)',
        UPLOAD_ERR_PARTIAL => 'UPLOAD_ERR_PARTIAL (envio interrompido a meio)',
        UPLOAD_ERR_NO_FILE => 'UPLOAD_ERR_NO_FILE (não veio ficheiro nenhum)',
        UPLOAD_ERR_NO_TMP_DIR => 'UPLOAD_ERR_NO_TMP_DIR (falta a pasta temporária do PHP)',
        UPLOAD_ERR_CANT_WRITE => 'UPLOAD_ERR_CANT_WRITE (o PHP não conseguiu gravar em disco)',
        UPLOAD_ERR_EXTENSION => 'UPLOAD_ERR_EXTENSION (uma extensão do PHP travou o upload)',
    );
    $code = (int)$code;
    return isset($nomes[$code]) ? $nomes[$code] : 'desconhecido (' . $code . ')';
}

/**
 * Os limites em vigor NESTE pedido. Vale a pena registá-los sempre: em
 * produção o `.user.ini` manda, mas o `php -S` do desenvolvimento ignora
 * `.user.ini` por completo e fica com os defaults do php.ini (2M/8M) — a
 * diferença explica sozinha a maior parte das recusas de fotos pesadas.
 */
function order_media_limits()
{
    $uploadMax = order_media_ini_bytes(ini_get('upload_max_filesize'));
    $postMax = order_media_ini_bytes(ini_get('post_max_size'));
    return array(
        'sapi' => PHP_SAPI,
        'user_ini_lido' => PHP_SAPI !== 'cli-server',
        'upload_max_filesize' => $uploadMax,
        'post_max_size' => $postMax,
        'max_file_uploads' => (int)ini_get('max_file_uploads'),
        'memory_limit' => ini_get('memory_limit'),
        'content_length' => isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0,
    );
}

/** Tudo o que se consegue saber sobre um ficheiro que acabou de ser recusado. */
function order_media_file_diagnostics($file)
{
    $tmp = isset($file['tmp_name']) ? (string)$file['tmp_name'] : '';
    $temFicheiro = $tmp !== '' && is_file($tmp);
    $assinatura = $temFicheiro ? order_media_signature_type($tmp) : null;
    $dados = array(
        'nome' => (string)(isset($file['name']) ? $file['name'] : ''),
        'tipo_anunciado' => (string)(isset($file['type']) ? $file['type'] : ''),
        'tamanho_anunciado' => (int)(isset($file['size']) ? $file['size'] : 0),
        'erro_php' => order_media_upload_error_name(isset($file['error']) ? $file['error'] : UPLOAD_ERR_NO_FILE),
        'tmp_existe' => $temFicheiro ? 'sim' : 'não',
        'is_uploaded_file' => ($tmp !== '' && is_uploaded_file($tmp)) ? 'sim' : 'não',
        'tamanho_recebido' => $temFicheiro ? (int)@filesize($tmp) : 0,
        'assinatura' => $assinatura === null ? '(não reconhecida)' : $assinatura['mime'],
        'finfo' => $temFicheiro ? (order_media_mime($tmp) ?: '(vazio)') : '(sem ficheiro)',
    );

    if ($temFicheiro) {
        $tamanho = @getimagesize($tmp);
        $dados['getimagesize'] = is_array($tamanho)
            ? (int)$tamanho[0] . 'x' . (int)$tamanho[1] . ' ' . (isset($tamanho['mime']) ? $tamanho['mime'] : '?')
            : 'falhou';
    }

    return $dados;
}

function order_media_reject_log_path()
{
    $dir = mp_private_path('order-uploads');
    if ($dir === null) {
        return null;
    }
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
        return null;
    }
    return $dir . DIRECTORY_SEPARATOR . 'rejeicoes.log';
}

/**
 * Escreve o bloco de diagnóstico. Nunca lança nem interrompe o pedido: um log
 * que falha não pode ser mais um motivo para o cliente não conseguir enviar.
 */
function order_media_log_rejection($code, $message, array $detalhes)
{
    $limites = order_media_limits();
    $linhas = array(
        '=== ' . gmdate('Y-m-d H:i:s') . ' UTC  ficheiro recusado: ' . $code . ' ===',
        'mensagem ao cliente: ' . $message,
        'IP: ' . (mp_client_ip() !== '' ? mp_client_ip() : '(desconhecido)'),
        'página: ' . (isset($_SERVER['HTTP_REFERER']) ? substr((string)$_SERVER['HTTP_REFERER'], 0, 200) : '(sem referer)'),
        'dispositivo: ' . (isset($_SERVER['HTTP_USER_AGENT']) ? substr((string)$_SERVER['HTTP_USER_AGENT'], 0, 200) : '(desconhecido)'),
        'purpose: ' . (isset($_POST['purpose']) ? (string)$_POST['purpose'] : '(não veio)'),
        'kind: ' . (isset($_POST['kind']) ? (string)$_POST['kind'] : '(não veio)'),
        'corpo do pedido: ' . order_media_bytes_human($limites['content_length']),
        'limites em vigor: upload_max_filesize=' . order_media_bytes_human($limites['upload_max_filesize'])
            . '  post_max_size=' . order_media_bytes_human($limites['post_max_size'])
            . '  max_file_uploads=' . $limites['max_file_uploads']
            . '  memory_limit=' . $limites['memory_limit'],
        'SAPI: ' . $limites['sapi'] . ($limites['user_ini_lido'] ? ' (.user.ini aplica-se)' : ' (.user.ini IGNORADO — limites do php.ini)'),
    );

    foreach ($detalhes as $chave => $valor) {
        if (is_array($valor)) {
            $linhas[] = $chave . ':';
            foreach ($valor as $subChave => $subValor) {
                $linhas[] = '  ' . $subChave . ': ' . (is_scalar($subValor) ? $subValor : json_encode($subValor));
            }
            continue;
        }
        $linhas[] = $chave . ': ' . (is_scalar($valor) ? $valor : json_encode($valor));
    }
    $linhas[] = '';

    @error_log('[miaandpaper] upload recusado (' . $code . '): ' . $message
        . ' | corpo ' . order_media_bytes_human($limites['content_length'])
        . ' | upload_max_filesize ' . order_media_bytes_human($limites['upload_max_filesize'])
        . ' | post_max_size ' . order_media_bytes_human($limites['post_max_size'])
        . ($limites['user_ini_lido'] ? '' : ' | ATENCAO: SAPI ' . $limites['sapi'] . ' ignora .user.ini'));

    $path = order_media_reject_log_path();
    if ($path === null) {
        return;
    }
    $tamanho = @filesize($path);
    if ($tamanho !== false && $tamanho > ORDER_MEDIA_REJECT_LOG_MAX_BYTES) {
        @rename($path, $path . '.1');
    }
    if (@file_put_contents($path, implode("\n", $linhas) . "\n", FILE_APPEND | LOCK_EX) !== false) {
        @chmod($path, 0600);
    }
}

/** Recusa um ficheiro: regista o porquê e responde com um `code` estável. */
function order_media_reject($status, $code, $message, array $detalhes = array())
{
    order_media_log_rejection($code, $message, $detalhes);
    order_media_respond($status, array('ok' => false, 'code' => $code, 'message' => $message));
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
function order_media_area_bytes($areaDir, $delta = 0, $force = false)
{
    $cachePath = $areaDir . DIRECTORY_SEPARATOR . '.tamanho.json';
    $cache = json_decode((string)@file_get_contents($cachePath), true);
    $agora = time();

    if (
        !$force
        && is_array($cache)
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
        order_media_reject(403, 'origem_invalida', 'Origem inválida.', array(
            'origin' => $origin,
            'host' => $host,
        ));
    }
}

$privateDir = order_media_temp_dir();
if ($privateDir === null || (!is_dir($privateDir) && !@mkdir($privateDir, 0700, true))) {
    order_media_reject(500, 'pasta_indisponivel', 'Não foi possível preparar o envio.', array(
        'pasta' => (string)$privateDir,
    ));
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

// Quando o corpo passa `post_max_size`, o PHP descarta $_POST e $_FILES antes
// de este ficheiro correr: não há erro, não há ficheiro, não há `purpose`. Sem
// este ramo o cliente levava um "tenta novamente" que nunca ia funcionar.
$limitesPedido = order_media_limits();
if (
    empty($files)
    && $limitesPedido['post_max_size'] > 0
    && $limitesPedido['content_length'] > $limitesPedido['post_max_size']
) {
    order_media_reject(
        413,
        'post_max_size_excedido',
        'Este ficheiro é demasiado pesado para o servidor aceitar (limite actual: '
            . order_media_bytes_human($limitesPedido['post_max_size']) . ').',
        array(
            'diagnostico' => 'O corpo do pedido passou post_max_size, por isso o PHP deitou fora $_POST e $_FILES.',
            'em_falta' => 'post_max_size tem de ser maior que upload_max_filesize, com folga para o resto do formulário.',
        )
    );
}

if (empty($files)) {
    order_media_reject(400, 'sem_ficheiro', 'Não foi possível receber o ficheiro. Tenta novamente.', array(
        'diagnostico' => 'Nem $_FILES[media] nem $_FILES[photos] chegaram ao servidor.',
        'campos_post' => implode(', ', array_keys($_POST)) ?: '(nenhum)',
        'campos_files' => implode(', ', array_keys($_FILES)) ?: '(nenhum)',
    ));
}
if (count($files) > 10) {
    order_media_reject(400, 'demasiados_ficheiros', 'Envia os ficheiros novamente, em grupos mais pequenos.', array(
        'ficheiros_recebidos' => count($files),
        'maximo' => 10,
    ));
}

// ORDER_MEDIA_RETENTION_V2 — guardrails. Como nada é apagado por tempo, o que
// protege o disco é o limite por IP e o tecto da área toda.
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/avisos.php';

if (mp_db_form_rate_limited('upload', mp_client_ip(), ORDER_MEDIA_UPLOADS_PER_IP_PER_HOUR, count($files))) {
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
    order_media_reject(
        429,
        'ritmo_por_ip',
        'Já recebemos muitos ficheiros deste dispositivo. Espera um bocado antes de enviar mais.',
        array('limite_por_hora' => ORDER_MEDIA_UPLOADS_PER_IP_PER_HOUR)
    );
}

$plans = array();
foreach ($files as $file) {
    $actualSize = @filesize($file['tmp_name']);
    $maxBytes = $customArtwork ? ORDER_MEDIA_ARTWORK_MAX_BYTES : ORDER_MEDIA_LEGACY_MAX_BYTES;
    $diagnostico = order_media_file_diagnostics($file);

    // Cada motivo tem o seu código: "não foi possível receber o ficheiro" tanto
    // podia ser o ficheiro passar o limite do PHP como o disco estar cheio.
    if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE) {
        order_media_reject(
            413,
            'upload_max_filesize_excedido',
            'Este ficheiro é demasiado pesado para o servidor aceitar (limite actual: '
                . order_media_bytes_human(order_media_ini_bytes(ini_get('upload_max_filesize'))) . ').',
            array('ficheiro' => $diagnostico)
        );
    }
    if ($file['error'] === UPLOAD_ERR_PARTIAL) {
        order_media_reject(400, 'envio_interrompido', 'O envio foi interrompido a meio. Tenta novamente.', array(
            'ficheiro' => $diagnostico,
        ));
    }
    if ($file['error'] !== UPLOAD_ERR_OK) {
        order_media_reject(500, 'erro_php_no_upload', 'Não foi possível receber o ficheiro. Tenta novamente.', array(
            'ficheiro' => $diagnostico,
        ));
    }
    if (!is_uploaded_file($file['tmp_name'])) {
        order_media_reject(400, 'tmp_invalido', 'Não foi possível receber o ficheiro. Tenta novamente.', array(
            'ficheiro' => $diagnostico,
        ));
    }
    if ($actualSize === false || $actualSize < 1) {
        order_media_reject(400, 'ficheiro_vazio', 'Não foi possível receber o ficheiro. Tenta novamente.', array(
            'ficheiro' => $diagnostico,
        ));
    }
    if ($actualSize > $maxBytes) {
        order_media_reject(
            413,
            'acima_do_limite_do_endpoint',
            'Este ficheiro é demasiado pesado (máximo ' . order_media_bytes_human($maxBytes) . ').',
            array(
                'ficheiro' => $diagnostico,
                'limite_do_endpoint' => order_media_bytes_human($maxBytes)
                    . ($customArtwork ? ' (personalização)' : ' (fluxo normal)'),
            )
        );
    }

    $width = 0;
    $height = 0;
    $type = $customArtwork
        ? order_media_artwork_type($file, $width, $height)
        : order_media_type($file);
    if ($type === null) {
        order_media_reject(
            415,
            $customArtwork ? 'tipo_recusado_personalizacao' : 'tipo_recusado',
            $customArtwork
                ? 'Escolhe um ficheiro JPG, PNG, WebP, HEIC ou PDF válido.'
                : 'Escolhe uma foto JPG, PNG, WebP ou HEIC, ou grava um novo áudio.',
            array(
                'ficheiro' => $diagnostico,
                'diagnostico' => 'A assinatura, o finfo e o getimagesize acima dizem porquê: assinatura'
                    . ' desconhecida, mime a discordar da assinatura, ou getimagesize a falhar.',
            )
        );
    }

    $sha256 = @hash_file('sha256', $file['tmp_name']);
    if (!is_string($sha256) || !preg_match('/^[a-f0-9]{64}$/', $sha256)) {
        order_media_reject(500, 'hash_falhou', 'Não foi possível validar o ficheiro.', array(
            'ficheiro' => $diagnostico,
        ));
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
        order_media_reject(415, 'dimensoes_ilegiveis', 'Escolhe uma foto JPG, PNG, WebP ou HEIC válida.', array(
            'ficheiro' => $diagnostico,
            'assinatura_aceite' => $type['mime'],
            'diagnostico' => 'A assinatura foi reconhecida mas o getimagesize não confirmou as dimensões.',
        ));
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
        'page' => isset($_SERVER['HTTP_REFERER']) ? trim((string)$_SERVER['HTTP_REFERER']) : '',
        'ip' => mp_client_ip(),
    );
    if ($customArtwork) {
        $metadata['purpose'] = 'custom-artwork';
    }

    $plans[] = array(
        'file' => $file,
        'diagnostic' => $diagnostico,
        'stored_path' => $storedPath,
        'metadata_path' => $metadataPath,
        'metadata' => $metadata,
    );
}

// Todos os ficheiros passaram a validacao antes da primeira escrita. O lock
// torna a verificacao do tecto e a reserva do espaco uma operacao unica entre
// pedidos concorrentes.
$budgetLockPath = $areaDir . DIRECTORY_SEPARATOR . '.budget.lock';
$budgetLock = @fopen($budgetLockPath, 'c+');
if (!$budgetLock || !@flock($budgetLock, LOCK_EX)) {
    if ($budgetLock) @fclose($budgetLock);
    order_media_reject(503, 'lock_indisponivel', 'Não foi possível reservar espaço para os ficheiros. Tenta novamente.');
}

$incomingBytes = 0;
foreach ($plans as $plan) {
    $incomingBytes += max(0, (int)$plan['metadata']['size']);
}
$areaBytes = order_media_area_bytes($areaDir, 0, true);
if ($areaBytes + $incomingBytes > ORDER_MEDIA_AREA_BUDGET_BYTES) {
    @flock($budgetLock, LOCK_UN);
    @fclose($budgetLock);
    mp_aviso('guardrail', 'upload-espaco-cheio', 'URGENTE: o site já não aceita ficheiros de clientes', array_merge(array(
        'Ocupado: ' . mp_aviso_tamanho($areaBytes),
        'Tecto: ' . mp_aviso_tamanho(ORDER_MEDIA_AREA_BUDGET_BYTES),
        'Nada foi apagado.',
    ), mp_aviso_contexto()));
    order_media_reject(507, 'area_cheia', 'Não conseguimos guardar mais ficheiros neste momento. Fala connosco pelo Instagram que resolvemos já.', array(
        'ocupado' => order_media_bytes_human($areaBytes),
        'tecto' => order_media_bytes_human(ORDER_MEDIA_AREA_BUDGET_BYTES),
        'a_entrar' => order_media_bytes_human($incomingBytes),
    ));
}

$created = array();
$uploads = array();
foreach ($plans as $plan) {
    $file = $plan['file'];
    $metadata = $plan['metadata'];
    $storedPath = $plan['stored_path'];
    $metadataPath = $plan['metadata_path'];
    $metadataTmp = $metadataPath . '.tmp.' . getmypid();

    if (!move_uploaded_file($file['tmp_name'], $storedPath)) {
        foreach ($created as $createdPath) @unlink($createdPath);
        @flock($budgetLock, LOCK_UN);
        @fclose($budgetLock);
        order_media_reject(500, 'gravacao_falhou', 'Não foi possível guardar os ficheiros. Nenhum ficou associado ao pedido.', array(
            'ficheiro' => $plan['diagnostic'],
            'destino_escrevivel' => is_writable($privateDir) ? 'sim' : 'não',
        ));
    }
    $created[] = $storedPath;
    @chmod($storedPath, 0600);
    $storedSize = @filesize($storedPath);
    $storedSha256 = @hash_file('sha256', $storedPath);
    if ((int)$storedSize !== (int)$metadata['size'] || !is_string($storedSha256) || !hash_equals($metadata['sha256'], $storedSha256)) {
        foreach ($created as $createdPath) @unlink($createdPath);
        @flock($budgetLock, LOCK_UN);
        @fclose($budgetLock);
        order_media_reject(500, 'gravacao_incompleta', 'Não foi possível confirmar os ficheiros guardados. Nenhum ficou associado ao pedido.', array(
            'ficheiro' => $plan['diagnostic'],
            'bytes_esperados' => (int)$metadata['size'],
            'bytes_gravados' => (int)$storedSize,
        ));
    }

    $metadataJson = json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($metadataJson === false || @file_put_contents($metadataTmp, $metadataJson, LOCK_EX) !== strlen($metadataJson)
        || !@rename($metadataTmp, $metadataPath)
    ) {
        @unlink($metadataTmp);
        foreach ($created as $createdPath) @unlink($createdPath);
        @flock($budgetLock, LOCK_UN);
        @fclose($budgetLock);
        order_media_reject(500, 'metadados_falharam', 'Não foi possível concluir o envio. Nenhum ficheiro ficou associado ao pedido.', array(
            'ficheiro' => $plan['diagnostic'],
        ));
    }
    $created[] = $metadataPath;
    @chmod($metadataPath, 0600);
    $uploads[] = array(
        'token' => $metadata['token'],
        'name' => $metadata['name'],
        'size' => $metadata['size'],
        'mime' => $metadata['mime'],
        'kind' => $metadata['kind'],
        'width' => $metadata['width'],
        'height' => $metadata['height'],
        'dpi' => $metadata['dpi'],
    );
}

// Actualiza o cache por contagem real ainda sob o mesmo lock.
$areaBytes = order_media_area_bytes($areaDir, 0, true);
@flock($budgetLock, LOCK_UN);
@fclose($budgetLock);

if ($areaBytes >= ORDER_MEDIA_AREA_WARN_BYTES) {
    mp_aviso('guardrail', 'upload-espaco-aviso', 'A pasta de uploads está a encher', array(
        'Ocupado: ' . mp_aviso_tamanho($areaBytes) . ' de ' . mp_aviso_tamanho(ORDER_MEDIA_AREA_BUDGET_BYTES),
        'Nada é apagado automaticamente.',
    ));
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
    $linhas[] = 'Para ouvir ou ver no painel admin:';
    if (count($uploads) === 1 && !empty($uploads[0]['token'])) {
        $linhas[] = 'https://miaandpaper.com/view-uploads.php?token=' . $uploads[0]['token'];
    } else {
        $linhas[] = 'https://miaandpaper.com/view-uploads.php';
    }
    $linhas[] = '';

    mp_aviso(
        'upload',
        'ficheiros-' . (mp_client_ip() !== '' ? mp_client_ip() : 'sem-ip'),
        count($uploads) === 1 ? 'Um cliente enviou um ficheiro' : 'Um cliente enviou ' . count($uploads) . ' ficheiros',
        array_merge($linhas, mp_aviso_contexto())
    );
}

order_media_respond(200, array('ok' => true, 'uploads' => $uploads));
