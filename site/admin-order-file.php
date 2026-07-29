<?php

session_start();
require_once __DIR__ . '/admin-open.php';   // ADMIN_OPEN_DEV_V1: sem password até ao deploy

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Acesso restrito.';
    exit;
}

require_once __DIR__ . '/lib/db.php';

$orderId = isset($_GET['order_id']) ? (int)$_GET['order_id'] : 0;
$fileId = isset($_GET['file']) ? strtolower(trim((string)$_GET['file'])) : '';

if ($orderId < 1 || !preg_match('/^[a-f0-9]{32,40}$/', $fileId)) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Pedido inválido.';
    exit;
}

$stmt = mp_db()->prepare('SELECT raw_order_json FROM orders WHERE id = ?');
$stmt->execute(array($orderId));
$order = $stmt->fetch();
$raw = $order ? json_decode((string)$order['raw_order_json'], true) : null;
$matched = null;

if (is_array($raw) && !empty($raw['items']) && is_array($raw['items'])) {
    foreach ($raw['items'] as $item) {
        foreach (array('quadro_uploads', 'quadro_reference_uploads', 'quadro_silhouette_uploads', 'quadro_audio_uploads') as $field) {
            if (empty($item[$field]) || !is_array($item[$field])) {
                continue;
            }
            foreach ($item[$field] as $upload) {
                if (is_array($upload) && isset($upload['id']) && hash_equals($fileId, strtolower((string)$upload['id']))) {
                    $matched = $upload;
                    break 3;
                }
            }
        }
    }
}

$relativePath = is_array($matched) && isset($matched['relative_path']) ? (string)$matched['relative_path'] : '';
if (!preg_match('#^order-uploads/orders/[A-Za-z0-9_-]+/[a-f0-9]{32,40}\.(?:jpe?g|png|webp|heic|heif|webm|ogg|wav|mp3|m4a|mp4)$#i', $relativePath)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Anexo não encontrado.';
    exit;
}

$privateRoot = realpath((string)mp_private_dir());
$filePath = mp_private_path($relativePath);
$fileReal = $filePath !== null ? realpath($filePath) : false;
$rootPrefix = $privateRoot !== false ? rtrim($privateRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR : '';

if ($privateRoot === false || $fileReal === false || strpos($fileReal, $rootPrefix) !== 0 || !is_file($fileReal)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Anexo não encontrado.';
    exit;
}

$downloadName = isset($matched['name']) ? basename(str_replace('\\', '/', (string)$matched['name'])) : 'anexo';
$downloadName = preg_replace('/[\x00-\x1F\x7F"\\]+/', '', $downloadName);
if ($downloadName === '') {
    $downloadName = 'anexo.' . strtolower(pathinfo($fileReal, PATHINFO_EXTENSION));
}
$fallbackName = preg_replace('/[^A-Za-z0-9._-]+/', '-', $downloadName);
$mime = isset($matched['mime']) && trim((string)$matched['mime']) !== '' ? trim((string)$matched['mime']) : 'application/octet-stream';

while (ob_get_level() > 0) {
    ob_end_clean();
}
$inline = !empty($_GET['inline']);
$fileSize = (int)filesize($fileReal);
$start = 0;
$end = max(0, $fileSize - 1);
if ($inline && isset($_SERVER['HTTP_RANGE']) && preg_match('/bytes=(\d*)-(\d*)/', (string)$_SERVER['HTTP_RANGE'], $matches)) {
    if ($matches[1] !== '') {
        $start = min($end, max(0, (int)$matches[1]));
    }
    if ($matches[2] !== '') {
        $end = min($end, max($start, (int)$matches[2]));
    }
    http_response_code(206);
    header('Content-Range: bytes ' . $start . '-' . $end . '/' . $fileSize);
}
$length = max(0, $end - $start + 1);
header('Content-Type: ' . $mime);
header('Content-Length: ' . $length);
header('Accept-Ranges: bytes');
$disposition = $inline ? 'inline' : 'attachment';
header('Content-Disposition: ' . $disposition . '; filename="' . $fallbackName . '"; filename*=UTF-8\'\'' . rawurlencode($downloadName));
header('Cache-Control: private, no-store, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
$handle = @fopen($fileReal, 'rb');
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
