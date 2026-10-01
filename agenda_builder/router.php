<?php
/**
 * Router para o servidor embutido do PHP:
 *   php -S 0.0.0.0:8090 -t . router.php
 * Serve os ficheiros estáticos sem cache (uma alteração aparece logo) e passa
 * o api.php ao PHP. Os ficheiros importados em dados/ nunca correm código.
 */
declare(strict_types=1);

$caminho = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
if ($caminho === '/') {
    $caminho = '/index.html';
}
if ($caminho === '/api.php') {
    return false;
}

$raiz = __DIR__;
$ficheiro = realpath($raiz . $caminho);
$proibido = ['router.php', 'servidor.py'];
if ($ficheiro === false || !str_starts_with($ficheiro, $raiz . DIRECTORY_SEPARATOR) || !is_file($ficheiro)
    || in_array(basename($ficheiro), $proibido, true) || str_ends_with($ficheiro, '.php')) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Não encontrado.';
    return true;
}

$tipos = [
    'html' => 'text/html; charset=utf-8', 'js' => 'text/javascript; charset=utf-8', 'css' => 'text/css; charset=utf-8',
    'json' => 'application/json; charset=utf-8', 'svg' => 'image/svg+xml', 'png' => 'image/png', 'jpg' => 'image/jpeg',
    'webp' => 'image/webp', 'ttf' => 'font/ttf', 'otf' => 'font/otf', 'woff' => 'font/woff', 'woff2' => 'font/woff2',
    'md' => 'text/plain; charset=utf-8',
];
$ext = strtolower(pathinfo($ficheiro, PATHINFO_EXTENSION));
header('Content-Type: ' . ($tipos[$ext] ?? 'application/octet-stream'));
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if (str_contains($caminho, '/dados/')) {
    header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:");
}
header('Content-Length: ' . filesize($ficheiro));
readfile($ficheiro);
return true;
