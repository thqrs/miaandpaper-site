<?php

session_start();
if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    exit('Acesso restrito.');
}
require_once __DIR__ . '/lib/db.php';

$uploadId = isset($_GET['upload_id']) ? (int)$_GET['upload_id'] : 0;
$fileId = isset($_GET['file']) ? strtolower(trim((string)$_GET['file'])) : '';
if ($uploadId < 1 || !preg_match('/^[a-f0-9]{32,40}$/', $fileId)) {
    http_response_code(400);
    exit('Pedido inválido.');
}
$stmt = mp_db()->prepare('SELECT reference_code, files_json FROM assisted_uploads WHERE id=?');
$stmt->execute(array($uploadId));
$row = $stmt->fetch();
$files = $row ? json_decode((string)$row['files_json'], true) : null;
$matched = null;
if (is_array($files)) {
    foreach ($files as $file) {
        if (is_array($file) && isset($file['id']) && hash_equals($fileId, strtolower((string)$file['id']))) {
            $matched = $file;
            break;
        }
    }
}
$relative = is_array($matched) && isset($matched['relative_path']) ? (string)$matched['relative_path'] : '';
if (!preg_match('#^order-uploads/assisted/MIA-[A-F0-9]{8}/[a-f0-9]{32,40}\.(?:jpe?g|png|webp|heic|heif)$#', $relative)) {
    http_response_code(404);
    exit('Ficheiro não encontrado.');
}
$root = realpath((string)mp_private_dir());
$path = mp_private_path($relative);
$real = $path !== null ? realpath($path) : false;
if ($root === false || $real === false || strpos($real, rtrim($root, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR) !== 0 || !is_file($real)) {
    http_response_code(404);
    exit('Ficheiro não encontrado.');
}
$name = basename(str_replace('\\', '/', isset($matched['name']) ? (string)$matched['name'] : 'foto'));
$name = preg_replace('/[\x00-\x1F\x7F"\\]+/', '', $name);
$fallback = preg_replace('/[^A-Za-z0-9._-]+/', '-', $name ?: 'foto');
header('Content-Type: ' . (isset($matched['mime']) ? (string)$matched['mime'] : 'application/octet-stream'));
header('Content-Length: ' . (int)filesize($real));
header('Content-Disposition: attachment; filename="' . $fallback . '"; filename*=UTF-8\'\'' . rawurlencode($name));
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
readfile($real);
exit;

