<?php

require_once __DIR__ . '/lib/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function help_upload_respond($status, $payload)
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    help_upload_respond(405, array('ok' => false, 'message' => 'Método não permitido.'));
}

$origin = isset($_SERVER['HTTP_ORIGIN']) ? trim((string)$_SERVER['HTTP_ORIGIN']) : '';
$host = isset($_SERVER['HTTP_HOST']) ? strtolower(preg_replace('/:\d+$/', '', trim((string)$_SERVER['HTTP_HOST']))) : '';
if ($origin !== '' && strtolower((string)parse_url($origin, PHP_URL_HOST)) !== $host) {
    help_upload_respond(403, array('ok' => false, 'message' => 'Origem inválida.'));
}

$raw = (string)file_get_contents('php://input');
if (strlen($raw) > 128 * 1024) {
    help_upload_respond(413, array('ok' => false, 'message' => 'Pedido demasiado grande.'));
}
$payload = json_decode($raw, true);
$name = is_array($payload) && isset($payload['name']) ? trim((string)$payload['name']) : '';
$contact = is_array($payload) && isset($payload['contact']) ? trim((string)$payload['contact']) : '';
$note = is_array($payload) && isset($payload['note']) ? trim((string)$payload['note']) : '';
$uploads = is_array($payload) && isset($payload['uploads']) && is_array($payload['uploads']) ? $payload['uploads'] : array();

if ($name === '' || count($uploads) < 1 || count($uploads) > 10) {
    help_upload_respond(400, array('ok' => false, 'message' => 'Indica o teu nome e escolhe pelo menos uma foto.'));
}
$name = function_exists('mb_substr') ? mb_substr($name, 0, 100, 'UTF-8') : substr($name, 0, 100);
$contact = function_exists('mb_substr') ? mb_substr($contact, 0, 120, 'UTF-8') : substr($contact, 0, 120);
$note = function_exists('mb_substr') ? mb_substr($note, 0, 800, 'UTF-8') : substr($note, 0, 800);

try {
    $reference = 'MIA-' . strtoupper(substr(bin2hex(random_bytes(5)), 0, 8));
} catch (Exception $error) {
    $reference = 'MIA-' . strtoupper(substr(sha1(uniqid('', true)), 0, 8));
}

$tmpDir = mp_private_path('order-uploads' . DIRECTORY_SEPARATOR . 'tmp');
$relativeDir = 'order-uploads/assisted/' . $reference;
$destinationDir = mp_private_path(str_replace('/', DIRECTORY_SEPARATOR, $relativeDir));
if ($tmpDir === null || $destinationDir === null || (!is_dir($destinationDir) && !@mkdir($destinationDir, 0700, true))) {
    help_upload_respond(500, array('ok' => false, 'message' => 'Não foi possível preparar o envio.'));
}
@chmod($destinationDir, 0700);

$files = array();
foreach ($uploads as $upload) {
    $token = is_array($upload) && isset($upload['token']) ? strtolower(trim((string)$upload['token'])) : '';
    if (!preg_match('/^[a-f0-9]{32,40}$/', $token)) {
        help_upload_respond(400, array('ok' => false, 'message' => 'Uma das fotos já não é válida. Escolhe-a novamente.'));
    }
    $metadataPath = $tmpDir . DIRECTORY_SEPARATOR . $token . '.json';
    $metadata = is_file($metadataPath) ? json_decode((string)@file_get_contents($metadataPath), true) : null;
    $storedName = is_array($metadata) && isset($metadata['stored_name']) ? basename((string)$metadata['stored_name']) : '';
    $sourcePath = $storedName !== '' ? $tmpDir . DIRECTORY_SEPARATOR . $storedName : '';
    if (!is_array($metadata) || (isset($metadata['kind']) ? $metadata['kind'] : '') !== 'photo' || strpos($storedName, $token . '.') !== 0 || !is_file($sourcePath)) {
        help_upload_respond(400, array('ok' => false, 'message' => 'Uma das fotos expirou. Escolhe-a novamente.'));
    }
    $destinationPath = $destinationDir . DIRECTORY_SEPARATOR . $storedName;
    if (!@rename($sourcePath, $destinationPath)) {
        help_upload_respond(500, array('ok' => false, 'message' => 'Não foi possível guardar uma das fotos.'));
    }
    @chmod($destinationPath, 0600);
    @unlink($metadataPath);
    $files[] = array(
        'id' => $token,
        'name' => isset($metadata['name']) ? (string)$metadata['name'] : 'foto',
        'size' => isset($metadata['size']) ? (int)$metadata['size'] : 0,
        'mime' => isset($metadata['mime']) ? (string)$metadata['mime'] : 'application/octet-stream',
        'width' => isset($metadata['width']) ? (int)$metadata['width'] : 0,
        'height' => isset($metadata['height']) ? (int)$metadata['height'] : 0,
        'relative_path' => $relativeDir . '/' . $storedName,
    );
}

try {
    $stmt = mp_db()->prepare('INSERT INTO assisted_uploads (reference_code, created_at, sender_name, sender_contact, note, files_json, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute(array($reference, mp_db_now(), $name, $contact, $note, json_encode($files, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 'new'));
} catch (Exception $error) {
    help_upload_respond(500, array('ok' => false, 'message' => 'As fotos chegaram, mas não foi possível criar a referência. Contacta a Mia.'));
}

help_upload_respond(200, array(
    'ok' => true,
    'reference' => $reference,
    'count' => count($files),
));

