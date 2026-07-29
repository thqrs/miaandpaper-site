<?php
// TOOLS_NOMES_V1: nomes do gerador de cartões. O ficheiro vive FORA da
// pasta pública (private/miaandpaper-nomes.txt via mp_private_path) e só é
// lido/escrito com sessão admin — inacessível por URL direto, sem precisar
// de encriptação no cliente.
session_start();
require_once __DIR__ . '/../admin-open.php';   // ADMIN_OPEN_DEV_V1: sem password até ao deploy

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Acesso restrito.';
    exit;
}

require_once __DIR__ . '/../lib/private-paths.php';

$path = mp_private_path('miaandpaper-nomes.txt');
if ($path === null) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Pasta privada indisponível.';
    exit;
}

header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // defesa extra contra CSRF: se o browser enviar Origin, tem de ser o site
    if (!empty($_SERVER['HTTP_ORIGIN'])) {
        $originHost = parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_HOST);
        $selfHost = preg_replace('/:\d+$/', '', isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '');
        if (!is_string($originHost) || $originHost !== $selfHost) {
            http_response_code(403);
            header('Content-Type: application/json; charset=utf-8');
            echo '{"ok":false,"error":"origin"}';
            exit;
        }
    }

    $body = file_get_contents('php://input');
    if (!is_string($body) || $body === '' || strlen($body) > 512000) {
        http_response_code(400);
        header('Content-Type: application/json; charset=utf-8');
        echo '{"ok":false,"error":"conteudo"}';
        exit;
    }

    if (is_file($path)) {
        @copy($path, $path . '.bak'); // backup da versão anterior
    }
    $written = @file_put_contents($path, $body, LOCK_EX);
    header('Content-Type: application/json; charset=utf-8');
    if ($written === false) {
        http_response_code(500);
        echo '{"ok":false,"error":"escrita"}';
    } else {
        echo '{"ok":true,"bytes":' . (int)$written . '}';
    }
    exit;
}

header('Content-Type: text/plain; charset=utf-8');
if (is_file($path)) {
    readfile($path);
}
// sem ficheiro ainda: resposta vazia — o gerador ignora e usa os fallbacks
