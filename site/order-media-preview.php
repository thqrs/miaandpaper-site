<?php

require_once __DIR__ . '/lib/private-paths.php';

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

if ($filePath === '' || !preg_match('/\.(?:jpe?g|png|webp|heic|heif|webm|ogg|wav|mp3|m4a|mp4)$/i', $storedName) || !is_file($filePath)) {
    http_response_code(404);
    exit;
}

$mime = !empty($metadata['mime']) ? trim((string)$metadata['mime']) : 'application/octet-stream';
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
header('Content-Disposition: inline');
header('Cache-Control: private, no-store, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

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
