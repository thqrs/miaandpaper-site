<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$sets = [
    'cadernos' => 'content/designs/cadernos/caroussel',
];

$set = isset($_GET['set']) ? preg_replace('/[^a-z0-9_-]/i', '', (string) $_GET['set']) : '';
if (!isset($sets[$set])) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'message' => 'Conjunto de imagens inválido.',
        'images' => [],
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

$relativeDir = $sets[$set];
$absoluteDir = __DIR__ . '/' . $relativeDir;
$images = [];

if (is_dir($absoluteDir)) {
    $files = scandir($absoluteDir);
    if (is_array($files)) {
        foreach ($files as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }

            if (!preg_match('/\.jpe?g$/i', $file)) {
                continue;
            }

            if (!is_file($absoluteDir . '/' . $file)) {
                continue;
            }

            $images[] = $relativeDir . '/' . $file;
        }
    }
}

natcasesort($images);
$images = array_values($images);

echo json_encode([
    'ok' => true,
    'set' => $set,
    'images' => $images,
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
