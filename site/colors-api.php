<?php

require_once __DIR__ . '/lib/color-catalog.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

try {
    echo json_encode(array(
        'ok' => true,
        'catalog' => mp_color_catalog_data(),
    ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Exception $error) {
    http_response_code(500);
    echo json_encode(array(
        'ok' => false,
        'message' => 'Não foi possível carregar as cores disponíveis.',
    ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

