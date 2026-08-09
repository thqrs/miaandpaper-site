<?php

// REVIEWS_ADMIN_V1. ADMIN_OPEN_DEV_V1 é a única configuração: em
// desenvolvimento pode abrir os editores; com MIA_ADMIN_OPEN=false esta API
// exige sempre sessão de admin.
require_once __DIR__ . '/admin-open.php';
define('REVIEWS_REQUIRE_ADMIN', !MIA_ADMIN_OPEN);
define('REVIEWS_FILE', __DIR__ . '/content/reviews.json');
define('REVIEWS_UPLOAD_DIR', __DIR__ . '/content/uploads/reviews');
define('REVIEWS_UPLOAD_PREFIX', 'content/uploads/reviews/');
define('REVIEWS_MAX_UPLOAD_BYTES', 12 * 1024 * 1024);

require_once __DIR__ . '/lib/pedido.php';   // COMANDOS_V1: a API tambem se chama de dentro

function reviews_respond($status, $payload)
{
    if (mp_modo_embutido()) {
        mp_responder_embutido($payload, $status);
    }
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function reviews_session_start()
{
    if (session_status() === PHP_SESSION_NONE) session_start();
}

function reviews_csrf()
{
    reviews_session_start();
    if (empty($_SESSION['miaandpaper_admin_csrf'])) {
        $_SESSION['miaandpaper_admin_csrf'] = bin2hex(random_bytes(16));
    }
    return (string)$_SESSION['miaandpaper_admin_csrf'];
}

function reviews_logged_in()
{
    reviews_session_start();
    return !empty($_SESSION['miaandpaper_admin']);
}

function reviews_guard($write)
{
    if (!REVIEWS_REQUIRE_ADMIN) return;
    if (!reviews_logged_in()) {
        reviews_respond(403, array('ok' => false, 'requiresAdmin' => true, 'message' => 'Inicia sessão como administradora.'));
    }
    if ($write) {
        $sent = isset($_SERVER['HTTP_X_ADMIN_CSRF']) ? (string)$_SERVER['HTTP_X_ADMIN_CSRF'] : '';
        if ($sent === '' || !hash_equals(reviews_csrf(), $sent)) {
            reviews_respond(403, array('ok' => false, 'message' => 'Pedido bloqueado por CSRF. Recarrega a página e tenta novamente.'));
        }
    }
}

function reviews_read()
{
    $raw = is_file(REVIEWS_FILE) ? file_get_contents(REVIEWS_FILE) : '';
    $data = json_decode((string)$raw, true);
    if (!is_array($data)) {
        $data = array('schemaVersion' => 1, 'settings' => array(), 'reviews' => array());
    }
    if (!isset($data['settings']) || !is_array($data['settings'])) $data['settings'] = array();
    if (!isset($data['reviews']) || !is_array($data['reviews'])) $data['reviews'] = array();
    return $data;
}

function reviews_revision()
{
    return is_file(REVIEWS_FILE) ? hash_file('sha256', REVIEWS_FILE) : '';
}

function reviews_text($value, $max)
{
    $value = trim((string)$value);
    if (function_exists('mb_substr')) return mb_substr($value, 0, $max, 'UTF-8');
    return substr($value, 0, $max);
}

function reviews_bool($value, $fallback)
{
    if (is_bool($value)) return $value;
    if ($value === 1 || $value === '1' || $value === 'true') return true;
    if ($value === 0 || $value === '0' || $value === 'false') return false;
    return $fallback;
}

function reviews_choice($value, $allowed, $fallback)
{
    $value = (string)$value;
    return in_array($value, $allowed, true) ? $value : $fallback;
}

function reviews_normalize($input)
{
    $settingsIn = isset($input['settings']) && is_array($input['settings']) ? $input['settings'] : array();
    $settings = array(
        'enabled' => reviews_bool(isset($settingsIn['enabled']) ? $settingsIn['enabled'] : true, true),
        'intervalMs' => max(2000, min(60000, (int)(isset($settingsIn['intervalMs']) ? $settingsIn['intervalMs'] : 5500))),
        'position' => reviews_choice(isset($settingsIn['position']) ? $settingsIn['position'] : '', array('left', 'right'), 'left'),
        'size' => reviews_choice(isset($settingsIn['size']) ? $settingsIn['size'] : '', array('compact', 'normal', 'large'), 'normal'),
        'theme' => reviews_choice(isset($settingsIn['theme']) ? $settingsIn['theme'] : '', array('paper', 'rose', 'sage', 'dark'), 'paper'),
        'imageShape' => reviews_choice(isset($settingsIn['imageShape']) ? $settingsIn['imageShape'] : '', array('rounded', 'circle', 'square'), 'rounded'),
        'showImage' => reviews_bool(isset($settingsIn['showImage']) ? $settingsIn['showImage'] : true, true),
        'showName' => reviews_bool(isset($settingsIn['showName']) ? $settingsIn['showName'] : true, true),
        'showText' => reviews_bool(isset($settingsIn['showText']) ? $settingsIn['showText'] : true, true),
        'defaultRatingMode' => reviews_choice(isset($settingsIn['defaultRatingMode']) ? $settingsIn['defaultRatingMode'] : '', array('stars', 'icon', 'none'), 'stars'),
        'defaultStars' => max(1, min(5, (int)(isset($settingsIn['defaultStars']) ? $settingsIn['defaultStars'] : 5))),
        'defaultIcon' => reviews_choice(isset($settingsIn['defaultIcon']) ? $settingsIn['defaultIcon'] : '', array('heart', 'flower', 'sparkle', 'check', 'quote', 'custom'), 'heart'),
        'defaultCustomIcon' => reviews_text(isset($settingsIn['defaultCustomIcon']) ? $settingsIn['defaultCustomIcon'] : '✦', 8),
        'eggPumps' => max(0, min(20, (int)(isset($settingsIn['eggPumps']) ? $settingsIn['eggPumps'] : 7))),
    );

    $rows = isset($input['reviews']) && is_array($input['reviews']) ? $input['reviews'] : array();
    $reviews = array();
    $seen = array();
    foreach (array_slice($rows, 0, 200) as $index => $row) {
        if (!is_array($row)) continue;
        $id = preg_replace('/[^a-z0-9_-]+/i', '-', reviews_text(isset($row['id']) ? $row['id'] : '', 80));
        $id = trim($id, '-');
        if ($id === '' || isset($seen[$id])) $id = 'review-' . ($index + 1) . '-' . substr(sha1(uniqid('', true)), 0, 7);
        $seen[$id] = true;
        $reviews[] = array(
            'id' => $id,
            'enabled' => reviews_bool(isset($row['enabled']) ? $row['enabled'] : true, true),
            'order' => max(1, min(9999, (int)(isset($row['order']) ? $row['order'] : ($index + 1)))),
            'name' => reviews_text(isset($row['name']) ? $row['name'] : '', 120),
            'text' => reviews_text(isset($row['text']) ? $row['text'] : '', 1000),
            // Registo interno: quando chegou e de que encomenda veio. Nao sai
            // no site — serve para a Mia saber a origem de cada review.
            'date' => reviews_text(isset($row['date']) ? $row['date'] : '', 40),
            'orderNote' => reviews_text(isset($row['orderNote']) ? $row['orderNote'] : '', 200),
            'image' => reviews_text(isset($row['image']) ? $row['image'] : '', 500),
            'linkEnabled' => reviews_bool(isset($row['linkEnabled']) ? $row['linkEnabled'] : false, false),
            'link' => reviews_text(isset($row['link']) ? $row['link'] : '', 500),
            'ratingMode' => reviews_choice(isset($row['ratingMode']) ? $row['ratingMode'] : '', array('default', 'stars', 'icon', 'none'), 'default'),
            'stars' => max(1, min(5, (int)(isset($row['stars']) ? $row['stars'] : 5))),
            'icon' => reviews_choice(isset($row['icon']) ? $row['icon'] : '', array('default', 'heart', 'flower', 'sparkle', 'check', 'quote', 'custom'), 'default'),
            'customIcon' => reviews_text(isset($row['customIcon']) ? $row['customIcon'] : '', 8),
        );
    }
    usort($reviews, function ($a, $b) {
        return $a['order'] === $b['order'] ? strcmp($a['id'], $b['id']) : $a['order'] - $b['order'];
    });
    foreach ($reviews as $index => &$review) $review['order'] = $index + 1;
    unset($review);

    return array('schemaVersion' => 1, 'settings' => $settings, 'reviews' => $reviews);
}

function reviews_save($data)
{
    $dir = dirname(REVIEWS_FILE);
    if (!is_dir($dir) && !mkdir($dir, 0775, true)) return false;
    if (is_file(REVIEWS_FILE)) @copy(REVIEWS_FILE, REVIEWS_FILE . '.reviews-bak');
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    $tmp = REVIEWS_FILE . '.tmp-' . bin2hex(random_bytes(4));
    if (file_put_contents($tmp, $json, LOCK_EX) === false) return false;
    if (!@rename($tmp, REVIEWS_FILE)) {
        // Em alguns servidores Windows rename() não substitui um destino
        // existente. Mantém o lock e usa uma escrita direta como fallback.
        if (file_put_contents(REVIEWS_FILE, $json, LOCK_EX) === false) {
            @unlink($tmp);
            return false;
        }
        @unlink($tmp);
    }
    return true;
}

function reviews_upload_webp($tmp, $target)
{
    if (!function_exists('imagecreatefromstring') || !function_exists('imagewebp')) return false;
    $bytes = file_get_contents($tmp);
    $image = $bytes !== false ? @imagecreatefromstring($bytes) : false;
    if (!$image) return false;
    if (function_exists('imagepalettetotruecolor')) @imagepalettetotruecolor($image);
    imagealphablending($image, true);
    imagesavealpha($image, true);
    $ok = imagewebp($image, $target, 88);
    imagedestroy($image);
    return $ok;
}

// COMANDOS_V1: incluida so pelas funcoes. Sem router, sem guarda, sem resposta.
if (mp_modo_embutido()) {
    return;
}

$action = isset($_GET['action']) ? (string)$_GET['action'] : 'load';
$isPost = isset($_SERVER['REQUEST_METHOD']) && strtoupper($_SERVER['REQUEST_METHOD']) === 'POST';

// PARAMETROS_V1: esquema desta API, na forma do manifesto geral.
if ($action === 'parametros' && !$isPost) {
    reviews_guard(false);
    require_once __DIR__ . '/lib/parametros.php';
    reviews_respond(200, array('ok' => true, 'recurso' => mp_parametros_manifesto_recurso('reviews-api.php')));
}

if ($action === 'load' && !$isPost) {
    reviews_guard(false);
    reviews_respond(200, array(
        'ok' => true,
        'requiresAdmin' => REVIEWS_REQUIRE_ADMIN,
        'loggedIn' => reviews_logged_in(),
        'csrf' => REVIEWS_REQUIRE_ADMIN && reviews_logged_in() ? reviews_csrf() : '',
        'revision' => reviews_revision(),
        'data' => reviews_read(),
    ));
}

if (!$isPost) {
    // Sem sessão, um pedido GET dirigido a uma ação de escrita deve ser negado
    // por autorização antes de revelar sequer a semântica do endpoint.
    if (in_array($action, array('save', 'upload'), true)) reviews_guard(false);
    reviews_respond(405, array('ok' => false, 'message' => 'Método não permitido.'));
}
reviews_guard(true);

if ($action === 'save') {
    $body = mp_corpo_pedido();
    if (!is_array($body) || !isset($body['data']) || !is_array($body['data'])) {
        reviews_respond(400, array('ok' => false, 'message' => 'Dados de reviews inválidos.'));
    }
    $sentRevision = isset($body['revision']) ? (string)$body['revision'] : '';
    $currentRevision = reviews_revision();
    if ($sentRevision !== '' && $currentRevision !== '' && !hash_equals($currentRevision, $sentRevision)) {
        reviews_respond(409, array('ok' => false, 'message' => 'As reviews foram alteradas noutra janela. Recarrega antes de guardar.'));
    }
    $data = reviews_normalize($body['data']);
    if (!reviews_save($data)) reviews_respond(500, array('ok' => false, 'message' => 'Não foi possível guardar content/reviews.json.'));
    reviews_respond(200, array('ok' => true, 'message' => 'Reviews guardadas.', 'data' => $data, 'revision' => reviews_revision()));
}

if ($action === 'upload') {
    if (!isset($_FILES['image']) || !is_uploaded_file($_FILES['image']['tmp_name'])) {
        reviews_respond(400, array('ok' => false, 'message' => 'Escolhe uma imagem para enviar.'));
    }
    if ((int)$_FILES['image']['size'] <= 0 || (int)$_FILES['image']['size'] > REVIEWS_MAX_UPLOAD_BYTES) {
        reviews_respond(400, array('ok' => false, 'message' => 'A imagem deve ter no máximo 12 MB.'));
    }
    $info = @getimagesize($_FILES['image']['tmp_name']);
    $allowed = array('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif');
    if (!$info || empty($info['mime']) || !in_array(strtolower($info['mime']), $allowed, true)) {
        reviews_respond(400, array('ok' => false, 'message' => 'Formato de imagem inválido.'));
    }
    if (!is_dir(REVIEWS_UPLOAD_DIR) && !mkdir(REVIEWS_UPLOAD_DIR, 0775, true)) {
        reviews_respond(500, array('ok' => false, 'message' => 'Não foi possível criar a pasta de uploads.'));
    }
    $base = pathinfo((string)$_FILES['image']['name'], PATHINFO_FILENAME);
    $base = strtolower(trim(preg_replace('/[^a-z0-9_-]+/i', '-', $base), '-'));
    if ($base === '') $base = 'review';
    $name = $base . '-' . gmdate('Ymd-His') . '-' . substr(bin2hex(random_bytes(4)), 0, 6) . '.webp';
    $target = REVIEWS_UPLOAD_DIR . '/' . $name;
    if (!reviews_upload_webp($_FILES['image']['tmp_name'], $target)) {
        reviews_respond(500, array('ok' => false, 'message' => 'Este servidor não conseguiu converter a imagem para WebP.'));
    }
    reviews_respond(200, array('ok' => true, 'path' => REVIEWS_UPLOAD_PREFIX . $name));
}

reviews_respond(404, array('ok' => false, 'message' => 'Ação desconhecida.'));
