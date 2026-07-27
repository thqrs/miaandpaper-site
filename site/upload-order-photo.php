<?php

require_once __DIR__ . '/lib/private-paths.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

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
    $header = (string)fread($handle, 32);
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

function order_media_type($file)
{
    $signature = order_media_signature_type($file['tmp_name']);
    if ($signature !== null) {
        if ($signature['mime'] === 'image/heic' && strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION)) === 'heif') {
            $signature['mime'] = 'image/heif';
            $signature['extension'] = 'heif';
        }
        return $signature;
    }

    $mime = order_media_mime($file['tmp_name']);
    $types = array(
        'image/jpeg' => array('jpg', 'photo'),
        'image/png' => array('png', 'photo'),
        'image/webp' => array('webp', 'photo'),
        'image/heic' => array('heic', 'photo'),
        'image/heif' => array('heif', 'photo'),
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
if (empty($files)) {
    order_media_respond(400, array('ok' => false, 'message' => 'Não foi possível receber o ficheiro. Tenta novamente.'));
}
if (count($files) > 10) {
    order_media_respond(400, array('ok' => false, 'message' => 'Envia os ficheiros novamente, em grupos mais pequenos.'));
}

$uploads = array();
foreach ($files as $file) {
    if ($file['error'] !== UPLOAD_ERR_OK || $file['size'] < 1 || $file['size'] > 15 * 1024 * 1024 || !is_uploaded_file($file['tmp_name'])) {
        order_media_respond(400, array('ok' => false, 'message' => 'Não foi possível receber o ficheiro. Tenta novamente.'));
    }

    $type = order_media_type($file);
    if ($type === null) {
        order_media_respond(415, array('ok' => false, 'message' => 'Escolhe uma foto JPG, PNG, WebP ou HEIC, ou grava um novo áudio.'));
    }

    try {
        $token = bin2hex(random_bytes(16));
    } catch (Exception $error) {
        $token = sha1(uniqid('', true) . mt_rand());
    }
    $storedName = $token . '.' . $type['extension'];
    $storedPath = $privateDir . DIRECTORY_SEPARATOR . $storedName;
    $metadataPath = $privateDir . DIRECTORY_SEPARATOR . $token . '.json';
    $width = 0;
    $height = 0;

    if ($type['kind'] === 'photo') {
        $imageSize = @getimagesize($file['tmp_name']);
        if (is_array($imageSize)) {
            $width = max(0, (int)$imageSize[0]);
            $height = max(0, (int)$imageSize[1]);
        } else {
            $width = isset($_POST['width']) ? min(30000, max(0, (int)$_POST['width'])) : 0;
            $height = isset($_POST['height']) ? min(30000, max(0, (int)$_POST['height'])) : 0;
        }
    }
    $shortSide = min($width, $height);
    $longSide = max($width, $height);
    $dpi = $shortSide > 0 && $longSide > 0 ? (int)round(min($shortSide / 10, $longSide / 15)) : 0;
    $metadata = array(
        'token' => $token,
        'name' => order_media_safe_name($file['name'], $type['kind'] === 'audio' ? 'áudio' : 'foto'),
        'size' => $file['size'],
        'mime' => $type['mime'],
        'kind' => $type['kind'],
        'width' => $width,
        'height' => $height,
        'dpi' => $dpi,
        'stored_name' => $storedName,
        'created_at' => gmdate('c'),
    );

    if (!move_uploaded_file($file['tmp_name'], $storedPath)) {
        order_media_respond(500, array('ok' => false, 'message' => 'Não foi possível guardar o ficheiro.'));
    }
    @chmod($storedPath, 0600);
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

order_media_respond(200, array('ok' => true, 'uploads' => $uploads));
