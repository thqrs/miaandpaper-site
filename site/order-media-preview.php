<?php

require_once __DIR__ . '/lib/private-paths.php';

function order_media_preview_not_found()
{
    http_response_code(404);
    exit;
}

function order_media_preview_pdf_is_valid($path)
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
    if (preg_match('/^%PDF-[12]\.[0-9]/', $header) !== 1 || preg_match('/%%EOF[\x00\x09\x0A\x0C\x0D\x20]*$/s', $tail) !== 1) {
        return false;
    }
    if (!class_exists('finfo')) {
        return true;
    }
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = strtolower(trim((string)@$finfo->file($path)));
    return in_array($mime, array('application/pdf', 'application/x-pdf'), true);
}

function order_media_preview_safe_name($name, $fallback)
{
    $name = basename(str_replace('\\', '/', (string)$name));
    $name = trim((string)preg_replace('/[\x00-\x1F\x7F"]+/', '', $name));
    return $name !== '' ? $name : $fallback;
}

$token = isset($_GET['token']) ? strtolower(trim((string)$_GET['token'])) : '';
if (!preg_match('/^[a-f0-9]{32,40}$/', $token)) {
    http_response_code(404);
    exit;
}

$dir = mp_private_path('order-uploads' . DIRECTORY_SEPARATOR . 'tmp');
$metadataPath = $dir !== null ? $dir . DIRECTORY_SEPARATOR . $token . '.json' : '';
$metadata = $metadataPath !== '' && is_file($metadataPath)
    ? json_decode((string)@file_get_contents($metadataPath), true)
    : null;
$storedName = is_array($metadata) && !empty($metadata['stored_name']) ? basename((string)$metadata['stored_name']) : '';
$filePath = $storedName !== '' && strpos($storedName, $token . '.') === 0
    ? $dir . DIRECTORY_SEPARATOR . $storedName
    : '';

if ($filePath === '' || !preg_match('/\.(?:jpe?g|png|webp|heic|heif|pdf|webm|ogg|wav|mp3|m4a|mp4)$/i', $storedName) || !is_file($filePath)) {
    order_media_preview_not_found();
}

$extension = strtolower(pathinfo($storedName, PATHINFO_EXTENSION));
$metadataMime = !empty($metadata['mime']) ? strtolower(trim((string)$metadata['mime'])) : '';
$allowedMimes = array(
    'jpg' => array('image/jpeg'),
    'jpeg' => array('image/jpeg'),
    'png' => array('image/png'),
    'webp' => array('image/webp'),
    'heic' => array('image/heic'),
    'heif' => array('image/heif'),
    'pdf' => array('application/pdf'),
    'webm' => array('audio/webm', 'video/webm'),
    'ogg' => array('audio/ogg'),
    'wav' => array('audio/wav', 'audio/x-wav'),
    'mp3' => array('audio/mpeg'),
    'm4a' => array('audio/mp4', 'video/mp4'),
    'mp4' => array('audio/mp4', 'video/mp4'),
);
if (!isset($allowedMimes[$extension]) || !in_array($metadataMime, $allowedMimes[$extension], true)) {
    order_media_preview_not_found();
}

$isPdf = $extension === 'pdf';
if ($isPdf && (
    !isset($metadata['kind'])
    || $metadata['kind'] !== 'artwork'
    || !isset($metadata['purpose'])
    || $metadata['purpose'] !== 'custom-artwork'
    || !order_media_preview_pdf_is_valid($filePath)
)) {
    order_media_preview_not_found();
}
// A verificação de integridade lê o ficheiro todo — num PDF de 30 MB isso é
// caro. Só se justifica no pedido inicial: um leitor de PDF pede o ficheiro
// aos pedaços com `Range`, e re-hashear 30 MB em cada pedaço multiplicava o
// custo por nada. O tamanho é sempre confirmado, em qualquer dos casos.
if (!empty($metadata['sha256']) && !isset($_SERVER['HTTP_RANGE'])) {
    $expectedSha256 = strtolower(trim((string)$metadata['sha256']));
    $actualSha256 = @hash_file('sha256', $filePath);
    if (!preg_match('/^[a-f0-9]{64}$/', $expectedSha256) || !is_string($actualSha256) || !hash_equals($expectedSha256, $actualSha256)) {
        order_media_preview_not_found();
    }
}
if (!empty($metadata['size']) && (int)@filesize($filePath) !== (int)$metadata['size']) {
    order_media_preview_not_found();
}

$mime = $isPdf ? 'application/pdf' : $metadataMime;
$size = (int)filesize($filePath);
$start = 0;
$end = max(0, $size - 1);

if (isset($_SERVER['HTTP_RANGE']) && preg_match('/bytes=(\d*)-(\d*)/', (string)$_SERVER['HTTP_RANGE'], $matches)) {
    if ($matches[1] !== '') {
        $start = min($end, max(0, (int)$matches[1]));
    }
    if ($matches[2] !== '') {
        $end = min($end, max($start, (int)$matches[2]));
    }
    http_response_code(206);
    header('Content-Range: bytes ' . $start . '-' . $end . '/' . $size);
}

$length = max(0, $end - $start + 1);
header('Content-Type: ' . $mime);
header('Content-Length: ' . $length);
header('Accept-Ranges: bytes');
$downloadName = order_media_preview_safe_name(isset($metadata['name']) ? $metadata['name'] : '', 'ficheiro.' . $extension);
$fallbackName = preg_replace('/[^A-Za-z0-9._-]+/', '-', $downloadName);
$disposition = $isPdf ? 'attachment' : 'inline';
header('Content-Disposition: ' . $disposition . '; filename="' . $fallbackName . '"; filename*=UTF-8\'\'' . rawurlencode($downloadName));
header('Cache-Control: private, no-store, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('Cross-Origin-Resource-Policy: same-origin');
if ($isPdf) {
    header("Content-Security-Policy: sandbox; default-src 'none'");
    header('X-Frame-Options: DENY');
}

$handle = @fopen($filePath, 'rb');
if ($handle === false) {
    http_response_code(404);
    exit;
}
fseek($handle, $start);
$remaining = $length;
while ($remaining > 0 && !feof($handle)) {
    $chunk = fread($handle, min(8192, $remaining));
    if ($chunk === false || $chunk === '') {
        break;
    }
    echo $chunk;
    $remaining -= strlen($chunk);
}
fclose($handle);
exit;
