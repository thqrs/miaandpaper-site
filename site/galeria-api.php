<?php

// GALERIA_V1 — API da página galeria.html.
//
// ADMIN_OPEN_DEV_V1 é a única configuração: em desenvolvimento pode abrir os
// editores; com MIA_ADMIN_OPEN=false esta API exige sempre sessão de admin.
require_once __DIR__ . '/admin-open.php';
define('GALERIA_REQUIRE_ADMIN', !MIA_ADMIN_OPEN);

define('GALERIA_ROOT', __DIR__);
define('GALERIA_PRODUCT_DIR', __DIR__ . '/content/products');
define('GALERIA_CONGRESS_PRODUCT_DIR', __DIR__ . '/congressos/2026/content/products');
define('GALERIA_HOME_FILE', __DIR__ . '/content/home.json');
define('GALERIA_UPLOAD_DIR', __DIR__ . '/content/uploads/galeria');
define('GALERIA_UPLOAD_PREFIX', 'content/uploads/galeria/');
define('GALERIA_MAX_UPLOAD_BYTES', 12 * 1024 * 1024);
define('GALERIA_STATE_FILE', __DIR__ . '/content/galeria-estado.json');
define('GALERIA_DIMENSION_CACHE', __DIR__ . '/content/.galeria-dimensoes.json');

// Só estas pastas entram na biblioteca e podem receber ficheiros novos.
// content/uploads guarda imagens de produto; as fotos de encomendas dos
// clientes vivem fora da raiz web e não são listadas aqui.
$GALERIA_LIBRARY_DIRS = array('content/designs', 'content/uploads', 'content/brand');
$GALERIA_IMAGE_EXTENSIONS = array('jpg', 'jpeg', 'png', 'webp', 'gif', 'avif');

require_once __DIR__ . '/lib/pedido.php';   // COMANDOS_V1: a API tambem se chama de dentro

function galeria_status($code)
{
    if (function_exists('http_response_code')) {
        http_response_code($code);
        return;
    }
    header('HTTP/1.1 ' . $code);
}

function galeria_respond($code, $payload)
{
    if (mp_modo_embutido()) {
        mp_responder_embutido($payload, $code);
    }
    galeria_status($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    $options = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
    echo json_encode($payload, $options);
    exit;
}

function galeria_csrf_token()
{
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (empty($_SESSION['miaandpaper_admin_csrf'])) {
        $_SESSION['miaandpaper_admin_csrf'] = bin2hex(random_bytes(16));
    }

    return (string)$_SESSION['miaandpaper_admin_csrf'];
}

function galeria_guard($write = false)
{
    if (!GALERIA_REQUIRE_ADMIN) {
        return;
    }
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (empty($_SESSION['miaandpaper_admin'])) {
        galeria_respond(403, array('ok' => false, 'message' => 'Inicia sessão como administradora.'));
    }
    if ($write) {
        $sent = isset($_SERVER['HTTP_X_ADMIN_CSRF']) ? (string)$_SERVER['HTTP_X_ADMIN_CSRF'] : '';
        if ($sent === '' || !hash_equals(galeria_csrf_token(), $sent)) {
            galeria_respond(403, array(
                'ok' => false,
                'message' => 'Pedido bloqueado por CSRF. Recarrega a galeria e tenta novamente.',
            ));
        }
    }
}

function galeria_require_post()
{
    if (!isset($_SERVER['REQUEST_METHOD']) || strtoupper($_SERVER['REQUEST_METHOD']) !== 'POST') {
        galeria_respond(405, array('ok' => false, 'message' => 'Método não permitido.'));
    }
}

// Todos os uploads novos ficam normalizados em WebP. Assim, a galeria e o
// inventário não voltam a criar referências JPG/PNG depois da migração.
function galeria_convert_upload_to_webp($source, $target)
{
    if (!function_exists('imagecreatefromstring') || !function_exists('imagewebp')) return false;
    $bytes = @file_get_contents($source);
    $image = $bytes !== false ? @imagecreatefromstring($bytes) : false;
    if (!$image) return false;
    if (function_exists('imagepalettetotruecolor')) @imagepalettetotruecolor($image);
    imagealphablending($image, true);
    imagesavealpha($image, true);
    $ok = @imagewebp($image, $target, 88);
    imagedestroy($image);
    return $ok;
}

function galeria_is_image_name($name)
{
    global $GALERIA_IMAGE_EXTENSIONS;
    $ext = strtolower(pathinfo((string)$name, PATHINFO_EXTENSION));
    return in_array($ext, $GALERIA_IMAGE_EXTENSIONS, true);
}

function galeria_is_image_path($value)
{
    $path = (string)$value;

    if ($path === '' || $path[0] === '/' || strpos($path, '\\') !== false
        || preg_match('/^[a-z][a-z0-9+.-]*:/i', $path)
        || preg_match('~[\x00-\x1F\x7F?#|]~', $path)
        || strpos($path, '"') !== false || strpos($path, "'") !== false
        || !galeria_is_image_name($path)) {
        return false;
    }

    foreach (explode('/', $path) as $part) {
        if ($part === '' || $part === '.' || $part === '..') {
            return false;
        }
    }

    return true;
}

function galeria_is_library_path($path)
{
    global $GALERIA_LIBRARY_DIRS;

    foreach ($GALERIA_LIBRARY_DIRS as $dir) {
        $prefix = rtrim($dir, '/') . '/';
        if (strpos((string)$path, $prefix) === 0) {
            return true;
        }
    }

    return false;
}

// Ler as dimensões de ~560 ficheiros a cada pedido era lento de mais, por isso
// ficam em cache e só se relêem quando o ficheiro muda (mtime + tamanho).
$GALERIA_DIMENSIONS = null;
$GALERIA_DIMENSIONS_DIRTY = false;

function galeria_dimensions($absolutePath, $relativePath, $mtime, $size)
{
    global $GALERIA_DIMENSIONS, $GALERIA_DIMENSIONS_DIRTY;

    if ($GALERIA_DIMENSIONS === null) {
        $raw = is_file(GALERIA_DIMENSION_CACHE) ? file_get_contents(GALERIA_DIMENSION_CACHE) : '';
        $decoded = json_decode((string)$raw, true);
        $GALERIA_DIMENSIONS = is_array($decoded) ? $decoded : array();
    }

    $stamp = $mtime . ':' . $size;
    if (isset($GALERIA_DIMENSIONS[$relativePath]) && isset($GALERIA_DIMENSIONS[$relativePath]['stamp'])
        && $GALERIA_DIMENSIONS[$relativePath]['stamp'] === $stamp) {
        return $GALERIA_DIMENSIONS[$relativePath];
    }

    $info = @getimagesize($absolutePath);
    $entry = array(
        'stamp' => $stamp,
        'width' => $info && !empty($info[0]) ? (int)$info[0] : 0,
        'height' => $info && !empty($info[1]) ? (int)$info[1] : 0,
    );

    $GALERIA_DIMENSIONS[$relativePath] = $entry;
    $GALERIA_DIMENSIONS_DIRTY = true;

    return $entry;
}

function galeria_flush_dimensions()
{
    global $GALERIA_DIMENSIONS, $GALERIA_DIMENSIONS_DIRTY;

    if (!$GALERIA_DIMENSIONS_DIRTY || $GALERIA_DIMENSIONS === null) {
        return;
    }
    @file_put_contents(GALERIA_DIMENSION_CACHE, json_encode($GALERIA_DIMENSIONS), LOCK_EX);
    $GALERIA_DIMENSIONS_DIRTY = false;
}

function galeria_list_images($relativeDir)
{
    $base = GALERIA_ROOT . '/' . $relativeDir;
    $found = array();

    if (!is_dir($base)) {
        return $found;
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($iterator as $file) {
        if (!$file->isFile() || !galeria_is_image_name($file->getFilename())) {
            continue;
        }
        $path = str_replace('\\', '/', $file->getPathname());
        $root = str_replace('\\', '/', GALERIA_ROOT) . '/';
        if (strpos($path, $root) !== 0) {
            continue;
        }
        $relative = substr($path, strlen($root));
        $size = $file->getSize();
        $mtime = $file->getMTime();
        $dimensions = galeria_dimensions($file->getPathname(), $relative, $mtime, $size);

        $found[] = array(
            'path' => $relative,
            'size' => $size,
            'modified' => $mtime,
            'width' => $dimensions['width'],
            'height' => $dimensions['height'],
        );
    }

    usort($found, function ($a, $b) {
        return strcmp($a['path'], $b['path']);
    });

    return $found;
}

function galeria_contexts()
{
    return array(
        'principal' => array(
            'id' => 'principal',
            'label' => 'Site principal',
            'productDir' => GALERIA_PRODUCT_DIR,
            'pageDir' => GALERIA_ROOT,
            'pagePrefix' => '',
        ),
        'congresso-2026' => array(
            'id' => 'congresso-2026',
            'label' => 'Congresso 2026',
            'productDir' => GALERIA_CONGRESS_PRODUCT_DIR,
            'pageDir' => GALERIA_ROOT . '/congressos/2026',
            'pagePrefix' => 'congressos/2026/',
        ),
    );
}

function galeria_context($id)
{
    $contexts = galeria_contexts();
    return isset($contexts[$id]) ? $contexts[$id] : null;
}

// Mantém as chaves antigas no contexto principal ("imanes") e prefixa os
// contextos adicionais ("congresso-2026|imanes"). Assim não se perdem os
// vistos já guardados na Galeria e as entradas continuam inequivocamente
// separadas.
function galeria_entry_key($context, $slug)
{
    return $context === 'principal' ? (string)$slug : (string)$context . '|' . (string)$slug;
}

function galeria_parse_entry_key($key, $fallbackSlug = '')
{
    $key = (string)$key;
    if ($key === '' && $fallbackSlug !== '') {
        $key = (string)$fallbackSlug;
    }
    if (preg_match('/^(principal|congresso-2026)\|([a-z0-9-]+)$/', $key, $matches)) {
        return array('context' => $matches[1], 'slug' => $matches[2]);
    }
    if (preg_match('/^[a-z0-9-]+$/', $key)) {
        return array('context' => 'principal', 'slug' => $key);
    }
    return null;
}

function galeria_product_slugs($contextId = 'principal')
{
    $slugs = array();
    $context = galeria_context($contextId);

    if (!$context || !is_dir($context['productDir'])) {
        return $slugs;
    }

    foreach (glob($context['productDir'] . '/*.json') as $file) {
        $name = basename($file, '.json');
        // Ignora cópias de segurança ("cadernos - backup.json") e afins.
        if (preg_match('/^[a-z0-9-]+$/', $name)) {
            $slugs[] = $name;
        }
    }

    sort($slugs);

    return $slugs;
}

function galeria_product_path($slug, $contextId = 'principal')
{
    $context = galeria_context($contextId);
    if (!preg_match('/^[a-z0-9-]+$/', (string)$slug)) {
        return '';
    }
    if (!$context) {
        return '';
    }
    $path = $context['productDir'] . '/' . $slug . '.json';

    return is_file($path) ? $path : '';
}

function galeria_entry_path($key, $fallbackSlug = '')
{
    if ((string)$key === 'home' || ((string)$key === '' && (string)$fallbackSlug === 'home')) {
        return is_file(GALERIA_HOME_FILE) ? GALERIA_HOME_FILE : '';
    }

    $parsed = galeria_parse_entry_key($key, $fallbackSlug);
    return $parsed ? galeria_product_path($parsed['slug'], $parsed['context']) : '';
}

// Descobre que página HTML carrega cada produto (data-product="slug"). Serve
// para a galeria mostrar o link certo e para assinalar produtos que já não são
// usados por página nenhuma — o pins.json, por exemplo, ficou órfão quando o
// pins.html passou a redirecionar para crachas.html.
function galeria_product_pages()
{
    $pages = array();

    foreach (galeria_contexts() as $context) {
        foreach (glob($context['pageDir'] . '/*.html') as $file) {
            $html = (string)file_get_contents($file);
            if (!preg_match('/<body\b[^>]*\bdata-product\s*=\s*["\']([a-z0-9-]+)["\']/i', $html, $matches)) {
                continue;
            }
            if (preg_match('/<meta\b[^>]*\bhttp-equiv\s*=\s*["\']refresh["\']/i', $html)) {
                continue;   // é um redirect, não uma página real
            }
            $key = galeria_entry_key($context['id'], $matches[1]);
            $pages[$key] = $context['pagePrefix'] . basename($file);
        }
    }

    if (is_file(GALERIA_ROOT . '/index.html')) {
        $pages['home'] = 'index.html';
    }

    return $pages;
}

// Lista de imagens já dadas por terminadas, indexada por uma chave estável
// (produto|item|campo) para aguentar reordenações dos itens no JSON.
function galeria_clean_done($done)
{
    $clean = array();

    foreach ((array)$done as $key) {
        $key = (string)$key;
        if ($key !== '' && strlen($key) <= 400 && !in_array($key, $clean, true)) {
            $clean[] = $key;
        }
    }

    sort($clean);

    return $clean;
}

function galeria_decode_done($raw, $emptyAllowed)
{
    if (trim((string)$raw) === '') {
        return $emptyAllowed ? array() : null;
    }

    $decoded = json_decode((string)$raw, true);
    if (!is_array($decoded) || !isset($decoded['done']) || !is_array($decoded['done'])) {
        return null;
    }

    return galeria_clean_done($decoded['done']);
}

function galeria_read_done()
{
    if (!is_file(GALERIA_STATE_FILE)) {
        return array();
    }

    $handle = @fopen(GALERIA_STATE_FILE, 'rb');
    if (!$handle || !@flock($handle, LOCK_SH)) {
        if ($handle) { fclose($handle); }
        galeria_respond(500, array('ok' => false, 'message' => 'Não consegui ler o estado da galeria.'));
    }
    $raw = stream_get_contents($handle);
    @flock($handle, LOCK_UN);
    fclose($handle);
    $done = galeria_decode_done($raw, false);

    if ($done === null) {
        galeria_respond(500, array(
            'ok' => false,
            'message' => 'O ficheiro galeria-estado.json não é válido. Não gravei nada.',
        ));
    }

    return $done;
}

function galeria_stream_replace($handle, $contents)
{
    if (!rewind($handle) || !ftruncate($handle, 0)) {
        return false;
    }

    $length = strlen($contents);
    $written = 0;
    while ($written < $length) {
        $count = fwrite($handle, substr($contents, $written));
        if ($count === false || $count === 0) {
            return false;
        }
        $written += $count;
    }

    return fflush($handle);
}

function galeria_update_done($key, $isDone)
{
    $key = (string)$key;
    if ($key === '' || strlen($key) > 400) {
        galeria_respond(400, array('ok' => false, 'message' => 'Identificador de imagem inválido.'));
    }

    $existed = is_file(GALERIA_STATE_FILE);
    $handle = @fopen(GALERIA_STATE_FILE, 'c+');
    if (!$handle || !@flock($handle, LOCK_EX)) {
        if ($handle) { fclose($handle); }
        galeria_respond(500, array('ok' => false, 'message' => 'Não consegui bloquear o estado da galeria.'));
    }

    rewind($handle);
    $raw = stream_get_contents($handle);
    $done = galeria_decode_done($raw, !$existed);
    if ($done === null) {
        @flock($handle, LOCK_UN);
        fclose($handle);
        galeria_respond(500, array(
            'ok' => false,
            'message' => 'O ficheiro galeria-estado.json não é válido. Não gravei nada.',
        ));
    }

    $done = array_values(array_filter($done, function ($candidate) use ($key) {
        return $candidate !== $key;
    }));
    if ($isDone) {
        $done[] = $key;
    }
    $done = galeria_clean_done($done);
    $encoded = json_encode(array('done' => $done), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n";

    if (!galeria_stream_replace($handle, $encoded)) {
        // Tenta repor o conteúdo anterior antes de devolver o erro.
        galeria_stream_replace($handle, (string)$raw);
        @flock($handle, LOCK_UN);
        fclose($handle);
        galeria_respond(500, array('ok' => false, 'message' => 'Não consegui gravar o estado.'));
    }

    @flock($handle, LOCK_UN);
    fclose($handle);

    return $done;
}

// Imagens referenciadas por outros ficheiros de conteúdo
// (order-products.json, ofertas.json…). A homepage já é uma entrada editável
// da galeria; os restantes continuam a contar como usados no multimedia.
function galeria_extra_usage()
{
    $usage = array();

    foreach (glob(GALERIA_ROOT . '/content/*.json') as $file) {
        $name = basename($file);
        if ($name === 'home.json') {
            continue; // É uma entrada editável da galeria, não um uso externo.
        }
        $decoded = json_decode((string)file_get_contents($file), true);
        if (!is_array($decoded)) {
            continue;
        }
        galeria_scan_images($decoded, $name, $usage);
    }

    return $usage;
}

function galeria_scan_images($node, $source, &$usage)
{
    if (is_string($node)) {
        if (galeria_is_image_path($node)) {
            if (!isset($usage[$node])) {
                $usage[$node] = array();
            }
            if (!in_array($source, $usage[$node], true)) {
                $usage[$node][] = $source;
            }
        }
        return;
    }
    if (!is_array($node)) {
        return;
    }
    foreach ($node as $value) {
        galeria_scan_images($value, $source, $usage);
    }
}

function galeria_add_usage(&$usage, $path, $source)
{
    if (!isset($usage[$path])) {
        $usage[$path] = array();
    }
    if (!in_array($source, $usage[$path], true)) {
        $usage[$path][] = $source;
    }
}

function galeria_relative_reference($sourcePath, $targetPath)
{
    $sourceDir = str_replace('\\', '/', dirname($sourcePath));
    $from = $sourceDir === '.' ? array() : explode('/', trim($sourceDir, '/'));
    $to = explode('/', trim($targetPath, '/'));

    while ($from && $to && $from[0] === $to[0]) {
        array_shift($from);
        array_shift($to);
    }

    return str_repeat('../', count($from)) . implode('/', $to);
}

// Referências escritas directamente em HTML/CSS/JS/PHP. Mantém o inventário
// honesto sem transformar estas localizações em slots editáveis de produto.
function galeria_static_usage($inventory)
{
    $usage = array();
    $allowed = array('html', 'css', 'js', 'php');
    $sources = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator(GALERIA_ROOT, FilesystemIterator::SKIP_DOTS)
    );
    $root = str_replace('\\', '/', GALERIA_ROOT) . '/';

    foreach ($sources as $file) {
        if (!$file->isFile() || !in_array(strtolower($file->getExtension()), $allowed, true)
            || $file->getSize() > 5 * 1024 * 1024) {
            continue;
        }

        $absolute = str_replace('\\', '/', $file->getPathname());
        if (strpos($absolute, $root) !== 0) {
            continue;
        }
        $source = substr($absolute, strlen($root));
        $text = @file_get_contents($file->getPathname());
        if ($text === false) {
            continue;
        }

        foreach ($inventory as $image) {
            $path = isset($image['path']) ? (string)$image['path'] : '';
            if ($path === '') {
                continue;
            }
            $relative = galeria_relative_reference($source, $path);
            $candidates = array($path, '/' . $path, $relative, './' . $relative);
            foreach (array_unique($candidates) as $candidate) {
                if ($candidate !== '' && strpos($text, $candidate) !== false) {
                    galeria_add_usage($usage, $path, $source);
                    break;
                }
            }
        }
    }

    return $usage;
}

function galeria_merge_usage(&$target, $source)
{
    foreach ((array)$source as $path => $records) {
        foreach ((array)$records as $record) {
            galeria_add_usage($target, $path, $record);
        }
    }
}

// O visualizador procura automaticamente foo_big.ext, sem esse caminho estar
// escrito no JSON. Conta a versão grande como usada quando a miniatura base é usada.
function galeria_add_big_image_usage(&$usage, $inventory)
{
    $available = array();
    foreach ($inventory as $image) {
        if (!empty($image['path'])) {
            $available[(string)$image['path']] = true;
        }
    }

    $baseUsage = $usage;
    foreach ($baseUsage as $path => $records) {
        $extension = pathinfo($path, PATHINFO_EXTENSION);
        if ($extension === '') {
            continue;
        }
        $big = substr($path, 0, -(strlen($extension) + 1)) . '_big.' . $extension;
        if (!isset($available[$big])) {
            continue;
        }
        foreach ((array)$records as $record) {
            galeria_add_usage($usage, $big, 'visualizador ampliado · ' . $record);
        }
    }
}

function galeria_payload()
{
    $data = mp_corpo_pedido();

    return is_array($data) ? $data : array();
}

// COMANDOS_V1: a gravacao de uma entrada vive numa funcao para o comando.php
// a poder chamar sem passar por HTTP. O router continua a ser o unico caminho
// publico, e a validacao e exactamente a mesma nos dois casos.
function galeria_gravar_entrada(array $payload)
{
    $key = isset($payload['key']) ? (string)$payload['key'] : '';
    $slug = isset($payload['slug']) ? (string)$payload['slug'] : '';
    $product = isset($payload['product']) && is_array($payload['product']) ? $payload['product'] : null;
    $revision = isset($payload['revision']) ? strtolower((string)$payload['revision']) : '';
    $isHome = $key === 'home' || ($key === '' && $slug === 'home');
    $parsed = $isHome ? array('context' => 'principal', 'slug' => 'home') : galeria_parse_entry_key($key, $slug);
    $actualSlug = $parsed ? $parsed['slug'] : '';
    $path = galeria_entry_path($key, $slug);

    if (!$path || !$product) {
        galeria_respond(400, array('ok' => false, 'message' => 'Conteúdo desconhecido.'));
    }
    if (!$isHome && (!isset($product['slug']) || (string)$product['slug'] !== $actualSlug)) {
        galeria_respond(400, array('ok' => false, 'message' => 'O slug do produto não corresponde ao ficheiro.'));
    }
    if (!$isHome && (empty($product['steps']) || !is_array($product['steps']))) {
        galeria_respond(400, array('ok' => false, 'message' => 'O produto não tem passos — recusei gravar.'));
    }
    if ($isHome && (empty($product['categories']) || !is_array($product['categories']) || empty($product['hero']) || !is_array($product['hero']))) {
        galeria_respond(400, array('ok' => false, 'message' => 'A homepage não tem a estrutura esperada — recusei gravar.'));
    }
    if (!preg_match('/^[a-f0-9]{64}$/', $revision)) {
        galeria_respond(400, array('ok' => false, 'message' => 'Falta a revisão do produto. Recarrega a galeria.'));
    }

    $encoded = json_encode($product, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($encoded === false) {
        galeria_respond(500, array('ok' => false, 'message' => 'Não consegui codificar o JSON.'));
    }

    $next = $encoded . "\n";
    $handle = @fopen($path, 'r+b');
    if (!$handle || !@flock($handle, LOCK_EX)) {
        if ($handle) { fclose($handle); }
        galeria_respond(500, array('ok' => false, 'message' => 'Não consegui bloquear o ficheiro do produto.'));
    }
    rewind($handle);
    $current = stream_get_contents($handle);
    if (!hash_equals(hash('sha256', (string)$current), $revision)) {
        @flock($handle, LOCK_UN);
        fclose($handle);
        galeria_respond(409, array(
            'ok' => false,
            'message' => 'Este produto foi alterado noutro separador. Recarrega a galeria antes de guardar.',
        ));
    }

    // A cópia de segurança é obrigatória: se falhar, o original não é tocado.
    if (@file_put_contents($path . '.galeria-bak', (string)$current, LOCK_EX) === false) {
        @flock($handle, LOCK_UN);
        fclose($handle);
        galeria_respond(500, array('ok' => false, 'message' => 'Não consegui criar a cópia de segurança. Não gravei o produto.'));
    }

    if (!galeria_stream_replace($handle, $next)) {
        galeria_stream_replace($handle, (string)$current);
        @flock($handle, LOCK_UN);
        fclose($handle);
        galeria_respond(500, array('ok' => false, 'message' => 'Não consegui gravar o ficheiro do produto.'));
    }
    @flock($handle, LOCK_UN);
    fclose($handle);

    galeria_respond(200, array(
        'ok' => true,
        'key' => $isHome ? 'home' : galeria_entry_key($parsed['context'], $actualSlug),
        'slug' => $actualSlug,
        'revision' => hash('sha256', $next),
    ));
}

// COMANDOS_V1: incluida so pelas funcoes. Sem router, sem guarda, sem resposta.
if (mp_modo_embutido()) {
    return;
}

$action = isset($_GET['action']) ? (string)$_GET['action'] : '';

// PARAMETROS_V1: esquema desta API, na forma do manifesto geral.
if ($action === 'parametros') {
    galeria_guard();
    require_once __DIR__ . '/lib/parametros.php';
    galeria_respond(200, array('ok' => true, 'recurso' => mp_parametros_manifesto_recurso('galeria-api.php')));
}

if ($action === 'done') {
    galeria_guard();
    galeria_respond(200, array('ok' => true, 'done' => galeria_read_done()));
}

if ($action === 'data') {
    galeria_guard();

    $products = array();
    $wantedEntry = isset($_GET['entry']) ? (string)$_GET['entry'] : '';
    if ($wantedEntry !== '' && $wantedEntry !== 'home' && !galeria_parse_entry_key($wantedEntry)) {
        galeria_respond(400, array('ok' => false, 'message' => 'Contexto de produto inválido.'));
    }
    foreach (galeria_contexts() as $context) {
        foreach (galeria_product_slugs($context['id']) as $slug) {
            $entryKey = galeria_entry_key($context['id'], $slug);
            if ($wantedEntry !== '' && $wantedEntry !== $entryKey) {
                continue;
            }
            $path = galeria_product_path($slug, $context['id']);
            if (!$path) {
                continue;
            }
            $raw = @file_get_contents($path);
            $decoded = json_decode((string)$raw, true);
            if ($raw === false || !is_array($decoded)) {
                galeria_respond(500, array(
                    'ok' => false,
                    'message' => 'O produto ' . $context['label'] . ' / ' . $slug . '.json não contém JSON válido. Não o omiti silenciosamente.',
                ));
            }
            if (!isset($decoded['slug']) || (string)$decoded['slug'] !== $slug) {
                galeria_respond(500, array(
                    'ok' => false,
                    'message' => 'O slug dentro de ' . $context['label'] . ' / ' . $slug . '.json não corresponde ao nome do ficheiro.',
                ));
            }
            $products[] = array(
                'key' => $entryKey,
                'slug' => $slug,
                'context' => $context['id'],
                'contextLabel' => $context['label'],
                'sourceFile' => str_replace('\\', '/', substr($path, strlen(GALERIA_ROOT) + 1)),
                'product' => $decoded,
                'revision' => hash('sha256', (string)$raw),
            );
        }
    }

    if ($wantedEntry === '' || $wantedEntry === 'home') {
        $homeRaw = @file_get_contents(GALERIA_HOME_FILE);
        $home = json_decode((string)$homeRaw, true);
        if ($homeRaw === false || !is_array($home)) {
            galeria_respond(500, array(
                'ok' => false,
                'message' => 'O ficheiro home.json não contém JSON válido.',
            ));
        }
        $products[] = array(
            'key' => 'home',
            'slug' => 'home',
            'context' => 'principal',
            'contextLabel' => 'Site principal',
            'kind' => 'home',
            'name' => 'Homepage',
            'product' => $home,
            'revision' => hash('sha256', (string)$homeRaw),
        );
    }

    // O selector continua limitado às pastas de produto; o inventário da
    // página Multimédia recebe, separadamente, todos os ficheiros sob site/.
    $inventory = galeria_list_images('');
    $library = array_values(array_filter($inventory, function ($image) {
        return !empty($image['path']) && galeria_is_library_path($image['path']);
    }));

    $extraUsage = galeria_extra_usage();
    galeria_merge_usage($extraUsage, galeria_static_usage($inventory));
    galeria_add_big_image_usage($extraUsage, $inventory);

    galeria_flush_dimensions();

    galeria_respond(200, array(
        'ok' => true,
        'products' => $products,
        'library' => $library,
        'inventory' => $inventory,
        'pages' => galeria_product_pages(),
        'extraUsage' => $extraUsage,
        'done' => galeria_read_done(),
        'public' => !GALERIA_REQUIRE_ADMIN,
        'csrf' => GALERIA_REQUIRE_ADMIN ? galeria_csrf_token() : '',
    ));
}

if ($action === 'upload') {
    galeria_guard(false);
    galeria_require_post();
    galeria_guard(true);

    if (empty($_FILES['files'])) {
        galeria_respond(400, array('ok' => false, 'message' => 'Não recebi nenhum ficheiro.'));
    }

    if (!is_dir(GALERIA_UPLOAD_DIR) && !@mkdir(GALERIA_UPLOAD_DIR, 0775, true)) {
        galeria_respond(500, array('ok' => false, 'message' => 'Não consegui criar a pasta de destino.'));
    }

    $names = (array)$_FILES['files']['name'];
    $tmps = (array)$_FILES['files']['tmp_name'];
    $sizes = (array)$_FILES['files']['size'];
    $errors = (array)$_FILES['files']['error'];
    $saved = array();
    $rejected = array();

    foreach ($names as $index => $name) {
        $tmp = isset($tmps[$index]) ? $tmps[$index] : '';
        $size = isset($sizes[$index]) ? (int)$sizes[$index] : 0;
        $error = isset($errors[$index]) ? (int)$errors[$index] : UPLOAD_ERR_NO_FILE;

        if ($error !== UPLOAD_ERR_OK || $tmp === '' || !is_uploaded_file($tmp)) {
            $rejected[] = array('name' => $name, 'reason' => 'Envio falhou.');
            continue;
        }
        if ($size <= 0 || $size > GALERIA_MAX_UPLOAD_BYTES) {
            $rejected[] = array('name' => $name, 'reason' => 'Ficheiro demasiado grande.');
            continue;
        }
        if (!galeria_is_image_name($name)) {
            $rejected[] = array('name' => $name, 'reason' => 'Formato não suportado.');
            continue;
        }

        // Confirma que é mesmo uma imagem — a extensão sozinha não chega.
        $info = @getimagesize($tmp);
        if (!$info || empty($info[0]) || empty($info[1])) {
            $rejected[] = array('name' => $name, 'reason' => 'O ficheiro não é uma imagem válida.');
            continue;
        }

        $ext = strtolower(pathinfo((string)$name, PATHINFO_EXTENSION));
        $mimeByExtension = array(
            'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png',
            'webp' => 'image/webp', 'gif' => 'image/gif', 'avif' => 'image/avif',
        );
        $detectedMime = isset($info['mime']) ? strtolower((string)$info['mime']) : '';
        if (!isset($mimeByExtension[$ext]) || $detectedMime !== $mimeByExtension[$ext]) {
            $rejected[] = array('name' => $name, 'reason' => 'A extensão não corresponde ao formato real da imagem.');
            continue;
        }

        $stem = strtolower(pathinfo((string)$name, PATHINFO_FILENAME));
        $stem = preg_replace('/[^a-z0-9]+/', '-', $stem);
        $stem = trim((string)$stem, '-');
        if ($stem === '') {
            $stem = 'imagem';
        }
        $stem = substr($stem, 0, 60);

        $target = $stem . '.webp';
        $counter = 2;
        while (is_file(GALERIA_UPLOAD_DIR . '/' . $target)) {
            $target = $stem . '-' . $counter . '.webp';
            $counter++;
        }

        if (!galeria_convert_upload_to_webp($tmp, GALERIA_UPLOAD_DIR . '/' . $target)) {
            $rejected[] = array('name' => $name, 'reason' => 'Não consegui converter o ficheiro para WebP.');
            continue;
        }

        @chmod(GALERIA_UPLOAD_DIR . '/' . $target, 0644);
        $savedSize = @filesize(GALERIA_UPLOAD_DIR . '/' . $target);
        $saved[] = array(
            'path' => GALERIA_UPLOAD_PREFIX . $target,
            'width' => (int)$info[0],
            'height' => (int)$info[1],
            'size' => $savedSize !== false ? (int)$savedSize : $size,
            'modified' => @filemtime(GALERIA_UPLOAD_DIR . '/' . $target) ?: time(),
        );
    }

    galeria_respond(200, array('ok' => true, 'saved' => $saved, 'rejected' => $rejected));
}

if ($action === 'save') {
    galeria_guard(false);
    galeria_require_post();
    galeria_guard(true);
    galeria_gravar_entrada(galeria_payload());
}

if ($action === 'save-done') {
    galeria_guard(false);
    galeria_require_post();
    galeria_guard(true);

    $payload = galeria_payload();
    if (!isset($payload['key']) || !array_key_exists('done', $payload)) {
        galeria_respond(400, array('ok' => false, 'message' => 'Falta a imagem ou o novo estado.'));
    }
    $key = (string)$payload['key'];
    $done = galeria_update_done($key, (bool)$payload['done']);

    galeria_respond(200, array('ok' => true, 'key' => $key, 'value' => in_array($key, $done, true)));
}

galeria_respond(404, array('ok' => false, 'message' => 'Ação desconhecida.'));
