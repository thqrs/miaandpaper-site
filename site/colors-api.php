<?php
/**
 * Compatibilidade com URLs antigas. O cliente actual lê directamente
 * content/colors.json; este endpoint já não abre a base de dados.
 */

$path = __DIR__ . '/content/colors.json';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

if (!is_file($path)) {
    http_response_code(503);
    echo json_encode(array(
        'ok' => false,
        'message' => 'O catálogo de cores ainda não foi publicado.',
    ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

readfile($path);
