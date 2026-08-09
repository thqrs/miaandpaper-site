<?php

require_once __DIR__ . '/admin-open.php';   // ADMIN_OPEN_DEV_V1: sem password até ao deploy

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Acesso restrito.';
    exit;
}

require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/http-range.php';

function admin_order_file_not_found()
{
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Anexo não encontrado.';
    exit;
}

function admin_order_find_upload($node, $fileId, $depth, &$visited)
{
    if (!is_array($node) || $depth > 14 || $visited >= 20000) {
        return null;
    }
    $visited++;

    $candidateId = '';
    if (isset($node['id'])) {
        $candidateId = strtolower(trim((string)$node['id']));
    } elseif (isset($node['token'])) {
        $candidateId = strtolower(trim((string)$node['token']));
    }
    if (
        $candidateId !== ''
        && isset($node['relative_path'])
        && is_string($node['relative_path'])
        && hash_equals($fileId, $candidateId)
    ) {
        return $node;
    }

    foreach ($node as $value) {
        if (!is_array($value)) {
            continue;
        }
        $matched = admin_order_find_upload($value, $fileId, $depth + 1, $visited);
        if ($matched !== null) {
            return $matched;
        }
    }
    return null;
}

function admin_order_pdf_is_valid($path)
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

$orderId = isset($_GET['order_id']) ? (int)$_GET['order_id'] : 0;
$fileId = isset($_GET['file']) ? strtolower(trim((string)$_GET['file'])) : '';

if ($orderId < 1 || !preg_match('/^[a-f0-9]{32,40}$/', $fileId)) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Pedido inválido.';
    exit;
}

$stmt = mp_db()->prepare('SELECT order_code, raw_order_json FROM orders WHERE id = ?');
$stmt->execute(array($orderId));
$order = $stmt->fetch();
$raw = $order ? json_decode((string)$order['raw_order_json'], true) : null;
$orderCode = $order && isset($order['order_code'])
    ? preg_replace('/[^A-Za-z0-9_-]/', '', (string)$order['order_code'])
    : '';
$matched = null;

if (is_array($raw) && !empty($raw['items']) && is_array($raw['items'])) {
    $visited = 0;
    $matched = admin_order_find_upload($raw['items'], $fileId, 0, $visited);
}

$relativePath = is_array($matched) && isset($matched['relative_path']) ? (string)$matched['relative_path'] : '';
if (
    $orderCode === ''
    || !preg_match(
        '#^order-uploads/orders/' . preg_quote($orderCode, '#') . '/[a-f0-9]{32,40}\.(?:jpe?g|png|webp|heic|heif|pdf|webm|ogg|wav|mp3|m4a|mp4)$#i',
        $relativePath
    )
) {
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

$extension = strtolower(pathinfo($fileReal, PATHINFO_EXTENSION));
$metadataMime = isset($matched['mime']) ? strtolower(trim((string)$matched['mime'])) : '';
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
    admin_order_file_not_found();
}

$isPdf = $extension === 'pdf';
if ($isPdf && (
    !isset($matched['kind'])
    || $matched['kind'] !== 'artwork'
    || !admin_order_pdf_is_valid($fileReal)
)) {
    admin_order_file_not_found();
}
if (!empty($matched['sha256']) && !isset($_SERVER['HTTP_RANGE'])) {
    $expectedSha256 = strtolower(trim((string)$matched['sha256']));
    $actualSha256 = @hash_file('sha256', $fileReal);
    if (!preg_match('/^[a-f0-9]{64}$/', $expectedSha256) || !is_string($actualSha256) || !hash_equals($expectedSha256, $actualSha256)) {
        admin_order_file_not_found();
    }
}

$downloadName = isset($matched['name']) ? basename(str_replace('\\', '/', (string)$matched['name'])) : 'anexo';
$downloadName = preg_replace('/[\x00-\x1F\x7F"]+/', '', $downloadName);
if ($downloadName === '') {
    $downloadName = 'anexo.' . strtolower(pathinfo($fileReal, PATHINFO_EXTENSION));
}
$fallbackName = preg_replace('/[^A-Za-z0-9._-]+/', '-', $downloadName);
$mime = $isPdf ? 'application/pdf' : $metadataMime;

while (ob_get_level() > 0) {
    ob_end_clean();
}
$inline = !empty($_GET['inline']) && !$isPdf;
$fileSize = (int)filesize($fileReal);
$range = $inline ? mp_http_byte_range(isset($_SERVER['HTTP_RANGE']) ? $_SERVER['HTTP_RANGE'] : '', $fileSize) : null;
if ($range === false) {
    mp_http_reject_invalid_range($fileSize);
}
$start = $range === null ? 0 : $range[0];
$end = $range === null ? max(0, $fileSize - 1) : $range[1];
if ($range !== null) {
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
header('Cross-Origin-Resource-Policy: same-origin');
if ($isPdf) {
    header("Content-Security-Policy: sandbox; default-src 'none'");
    header('X-Frame-Options: DENY');
}
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
