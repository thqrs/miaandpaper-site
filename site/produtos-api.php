<?php
// PRODUTOS_MOCKUP_V1 — leitura das fontes que podem originar uma linha no
// carrinho. Nesta primeira fase a edição fica no browser: a API não escreve
// ficheiros e permanece aberta, tal como pedido para o período pré-deploy.
define('PRODUTOS_REQUIRE_ADMIN', false);
define('PRODUTOS_ROOT', __DIR__);

function produtos_status($code)
{
    if (function_exists('http_response_code')) {
        http_response_code($code);
        return;
    }
    header('HTTP/1.1 ' . $code);
}

function produtos_respond($code, $payload)
{
    produtos_status($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function produtos_guard()
{
    if (!PRODUTOS_REQUIRE_ADMIN) {
        return;
    }
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (empty($_SESSION['miaandpaper_admin'])) {
        produtos_respond(403, array('ok' => false, 'message' => 'Inicia sessão como administradora.'));
    }
}

function produtos_read_json($path, $label)
{
    if (!is_file($path)) {
        return null;
    }
    $raw = file_get_contents($path);
    $decoded = json_decode((string)$raw, true);
    if (!is_array($decoded)) {
        produtos_respond(500, array(
            'ok' => false,
            'message' => 'O ficheiro ' . $label . ' contém JSON inválido.',
        ));
    }
    return $decoded;
}

function produtos_gallery_done()
{
    $galleryState = produtos_read_json(PRODUTOS_ROOT . '/content/galeria-estado.json', 'content/galeria-estado.json');
    return $galleryState && isset($galleryState['done']) && is_array($galleryState['done'])
        ? array_values(array_filter($galleryState['done'], 'is_string'))
        : array();
}

function produtos_is_redirect_html($html)
{
    return preg_match('/<meta\b[^>]*http-equiv\s*=\s*["\']?refresh["\']?/i', (string)$html) === 1;
}

function produtos_body_attribute($html, $attribute)
{
    if (!preg_match('/<body\b([^>]*)>/i', (string)$html, $body)) {
        return '';
    }
    $name = preg_quote((string)$attribute, '/');
    if (!preg_match('/\b' . $name . '\s*=\s*(["\'])(.*?)\1/i', $body[1], $match)) {
        return '';
    }
    return html_entity_decode((string)$match[2], ENT_QUOTES, 'UTF-8');
}

function produtos_page_map($directory, $relativePrefix)
{
    $pages = array();
    foreach (glob(rtrim($directory, '/\\') . '/*.html') as $file) {
        $html = file_get_contents($file);
        if (produtos_is_redirect_html($html)) {
            continue;
        }
        if (produtos_body_attribute($html, 'data-page') !== 'product') {
            continue;
        }
        $slug = produtos_body_attribute($html, 'data-product');
        if ($slug === '' || !preg_match('/^[a-z0-9-]+$/', $slug)) {
            continue;
        }
        $pages[$slug] = $relativePrefix . basename($file);
    }
    return $pages;
}

function produtos_catalog_pages()
{
    $pages = array();
    $root = PRODUTOS_ROOT . '/catalogo';
    if (!is_dir($root)) {
        return $pages;
    }
    foreach (glob($root . '/*/index.html') as $file) {
        $html = file_get_contents($file);
        $slug = produtos_body_attribute($html, 'data-product-slug');
        if ($slug !== '' && preg_match('/^[a-z0-9-]+$/', $slug)) {
            $pages[$slug] = 'catalogo/' . basename(dirname($file)) . '/index.html';
        }
    }
    return $pages;
}

function produtos_context_products($context)
{
    $directory = PRODUTOS_ROOT . '/' . trim($context['productDir'], '/');
    $found = array();
    if (!is_dir($directory)) {
        return $found;
    }

    foreach (glob($directory . '/*.json') as $file) {
        $slug = basename($file, '.json');
        // Cópias do género "cadernos - backup.json" não são fontes activas.
        if (!preg_match('/^[a-z0-9-]+$/', $slug)) {
            continue;
        }
        $json = produtos_read_json($file, str_replace(PRODUTOS_ROOT . '/', '', str_replace('\\', '/', $file)));
        $found[] = array(
            'context' => $context['id'],
            'contextLabel' => $context['label'],
            'slug' => $slug,
            'sourceFile' => str_replace('\\', '/', substr($file, strlen(PRODUTOS_ROOT) + 1)),
            'page' => isset($context['pages'][$slug]) ? $context['pages'][$slug] : '',
            'assetBase' => isset($context['assetBase']) ? $context['assetBase'] : '',
            'revision' => hash_file('sha256', $file),
            'data' => $json,
        );
    }
    usort($found, function ($a, $b) {
        return strcmp($a['slug'], $b['slug']);
    });
    return $found;
}

function produtos_home_source($id, $label, $file, $page)
{
    $path = PRODUTOS_ROOT . '/' . $file;
    $data = produtos_read_json($path, $file);
    return array(
        'id' => $id,
        'label' => $label,
        'kind' => $id === 'home' ? 'home' : 'content',
        'page' => $page,
        'sourceFile' => $file,
        'revision' => is_file($path) ? hash_file('sha256', $path) : '',
        'data' => $data ?: array(),
        'categories' => $data && isset($data['categories']) && is_array($data['categories'])
            ? $data['categories']
            : array(),
    );
}

produtos_guard();
$action = isset($_GET['action']) ? (string)$_GET['action'] : 'data';

if ($action === 'gallery-state') {
    produtos_respond(200, array('ok' => true, 'done' => produtos_gallery_done()));
}

if ($action !== 'data') {
    produtos_respond(404, array('ok' => false, 'message' => 'Acção desconhecida.'));
}

$rootPages = produtos_page_map(PRODUTOS_ROOT, '');
$congressPages = produtos_page_map(PRODUTOS_ROOT . '/congressos/2026', 'congressos/2026/');
$contexts = array(
    array(
        'id' => 'principal',
        'label' => 'Site principal',
        'productDir' => 'content/products',
        'pages' => $rootPages,
        'assetBase' => '',
    ),
    array(
        'id' => 'congresso-2026',
        'label' => 'Congresso 2026',
        'productDir' => 'congressos/2026/content/products',
        'pages' => $congressPages,
        // app-congressos.js aplica ../../ às imagens; vistas desde esta página
        // os caminhos já partem da raiz de site/.
        'assetBase' => '',
    ),
);

$products = array();
foreach ($contexts as $context) {
    $products = array_merge($products, produtos_context_products($context));
}

$pricing = produtos_read_json(PRODUTOS_ROOT . '/content/pricing.json', 'content/pricing.json');
$galleryDone = produtos_gallery_done();
$catalogPages = produtos_catalog_pages();

produtos_respond(200, array(
    'ok' => true,
    'security' => array(
        'requireAdmin' => PRODUTOS_REQUIRE_ADMIN,
        'editMode' => 'browser-draft',
    ),
    'products' => $products,
    'pricing' => $pricing,
    'galleryDone' => $galleryDone,
    'catalogPages' => $catalogPages,
    'homes' => array(
        produtos_home_source('home', 'Homepage', 'content/home.json', 'index.html'),
        produtos_home_source('congressos', 'Congressos', 'content/congressos.json', 'congressos.html'),
    ),
));
