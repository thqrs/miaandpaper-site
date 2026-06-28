<?php

session_start();

require_once __DIR__ . '/lib/private-paths.php';

$configPath = mp_private_admin_config_path();

define('MIAANDPAPER_PRODUCT_DIR', __DIR__ . '/content/products');
define('MIAANDPAPER_HOME_FILE', __DIR__ . '/content/home.json');
define('MIAANDPAPER_PRICING_FILE', __DIR__ . '/content/pricing.json');
define('MIAANDPAPER_CATALOG_FILE', __DIR__ . '/content/catalogo.json');
define('MIAANDPAPER_OFFERS_FILE', __DIR__ . '/content/ofertas.json');
define('MIAANDPAPER_UPLOAD_DIR', __DIR__ . '/content/uploads');
define('MIAANDPAPER_UPLOAD_PREFIX', 'content/uploads/');
define('MIAANDPAPER_SYNC_FLAG', mp_private_path('miaandpaper-admin-sync-needed.json') ?: '');

function admin_set_status($code)
{
    if (function_exists('http_response_code')) {
        http_response_code($code);
        return;
    }

    $messages = array(
        200 => 'OK',
        400 => 'Bad Request',
        401 => 'Unauthorized',
        403 => 'Forbidden',
        404 => 'Not Found',
        405 => 'Method Not Allowed',
        413 => 'Payload Too Large',
        500 => 'Internal Server Error',
        503 => 'Service Unavailable',
    );

    $message = isset($messages[$code]) ? $messages[$code] : 'Error';
    header('HTTP/1.1 ' . $code . ' ' . $message);
}

function admin_json_options()
{
    $options = 0;

    if (defined('JSON_UNESCAPED_UNICODE')) {
        $options |= JSON_UNESCAPED_UNICODE;
    }

    if (defined('JSON_UNESCAPED_SLASHES')) {
        $options |= JSON_UNESCAPED_SLASHES;
    }

    return $options;
}

function admin_respond($code, $payload)
{
    admin_set_status($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, admin_json_options());
    exit;
}

function admin_config()
{
    global $configPath;

    if (!$configPath || !is_file($configPath)) {
        return null;
    }

    $config = require $configPath;

    return is_array($config) ? $config : null;
}

function admin_configured()
{
    $config = admin_config();

    return is_array($config) && !empty($config['admin_password_hash']);
}

function admin_sync_flag()
{
    if (!is_file(MIAANDPAPER_SYNC_FLAG)) {
        return array(
            'needed' => false,
        );
    }

    $data = json_decode(file_get_contents(MIAANDPAPER_SYNC_FLAG), true);
    if (!is_array($data)) {
        return array(
            'needed' => true,
        );
    }

    $data['needed'] = !empty($data['syncNeeded']);

    return $data;
}

function admin_mark_sync_needed($slug)
{
    if (MIAANDPAPER_SYNC_FLAG === '') {
        return false;
    }

    $payload = array(
        'syncNeeded' => true,
        'product' => $slug,
        'updatedAt' => gmdate('c'),
        'source' => 'admin-save',
    );

    if (file_put_contents(MIAANDPAPER_SYNC_FLAG, json_encode($payload, admin_json_options() | JSON_PRETTY_PRINT) . "\n", LOCK_EX) === false) {
        return false;
    }

    chmod(MIAANDPAPER_SYNC_FLAG, 0600);

    return true;
}

function admin_password_hash_from_config()
{
    $config = admin_config();

    if (!is_array($config) || empty($config['admin_password_hash'])) {
        admin_respond(503, array(
            'ok' => false,
            'message' => 'Falta configurar a password de admin no ficheiro privado.',
        ));
    }

    return (string)$config['admin_password_hash'];
}

function admin_payload()
{
    $raw = file_get_contents('php://input');
    $contentType = isset($_SERVER['CONTENT_TYPE']) ? (string)$_SERVER['CONTENT_TYPE'] : '';

    if (stripos($contentType, 'application/json') === false) {
        admin_respond(400, array(
            'ok' => false,
            'message' => 'Pedido invalido.',
        ));
    }

    if (strlen($raw) > 12 * 1024 * 1024) {
        admin_respond(413, array(
            'ok' => false,
            'message' => 'O pedido e demasiado grande.',
        ));
    }

    if ($raw !== '') {
        $data = json_decode($raw, true);
        if (is_array($data)) {
            return $data;
        }
    }

    admin_respond(400, array(
        'ok' => false,
        'message' => 'JSON invalido.',
    ));
}

function admin_is_logged_in()
{
    return !empty($_SESSION['miaandpaper_admin']);
}

function admin_require_login()
{
    if (!admin_is_logged_in()) {
        admin_respond(401, array(
            'ok' => false,
            'message' => 'Inicia sessao de admin antes de guardar.',
        ));
    }
}

function admin_require_post()
{
    if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
        admin_respond(405, array(
            'ok' => false,
            'message' => 'Metodo nao permitido.',
        ));
    }
}

/**
 * ADMIN_API_CSRF_V1: token gerado por sessão e devolvido em `status`.
 * O cliente deve enviá-lo no header `X-Admin-CSRF` em qualquer write.
 * Login não exige token (é o ponto de entrada e por si só já é POST com
 * password verificada).
 */
function admin_csrf_token()
{
    if (empty($_SESSION['miaandpaper_admin_csrf'])) {
        $_SESSION['miaandpaper_admin_csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['miaandpaper_admin_csrf'];
}

function admin_require_csrf()
{
    $expected = admin_csrf_token();
    $sent = '';
    if (isset($_SERVER['HTTP_X_ADMIN_CSRF'])) {
        $sent = (string)$_SERVER['HTTP_X_ADMIN_CSRF'];
    }
    if ($sent === '' && isset($_POST['csrf'])) {
        $sent = (string)$_POST['csrf'];
    }
    if ($sent === '' || !hash_equals($expected, $sent)) {
        admin_respond(403, array(
            'ok' => false,
            'message' => 'Pedido bloqueado por CSRF. Recarrega a página de admin.',
        ));
    }
}

function admin_load_tracking_helpers()
{
    static $loaded = false;
    if (!$loaded) {
        require_once __DIR__ . '/lib/db.php';
        $loaded = true;
    }
}

function admin_current_ip_info()
{
    if (!admin_is_logged_in()) {
        return null;
    }

    admin_load_tracking_helpers();
    $diagnostics = mp_tracking_ip_diagnostics();
    $ip = isset($diagnostics['effective']) ? (string)$diagnostics['effective'] : '';

    return array(
        'ip' => $ip,
        'ignored' => $ip !== '' ? mp_db_is_ip_ignored($ip) : false,
        'diagnostics' => $diagnostics,
    );
}

/**
 * ADMIN_LOGIN_PT_LOG_V1
 * Devolve o caminho absoluto da pasta privada onde guardamos logs e ficheiros
 * fora do document root, usando o resolver central de caminhos privados.
 */
function admin_private_dir()
{
    return mp_private_dir();
}

/**
 * ADMIN_LOGIN_SQLITE_V1
 * Regista uma tentativa de login admin falhada (vazia ou errada) primeiro
 * em SQLite (tabela admin_login_attempts via lib/db.php) e mantém o .txt
 * como fallback para o caso da base não estar disponível. Nunca grava a
 * palavra-passe correta. Falha silenciosa em ambos os caminhos.
 */
function admin_log_login_attempt($enteredPassword, $isEmpty)
{
    $timestamp = gmdate('Y-m-d\TH:i:s\Z');
    $ip = isset($_SERVER['REMOTE_ADDR']) ? (string)$_SERVER['REMOTE_ADDR'] : '';
    $ua = isset($_SERVER['HTTP_USER_AGENT']) ? (string)$_SERVER['HTTP_USER_AGENT'] : '';
    $attemptType = $isEmpty ? 'EMPTY' : 'WRONG';

    // Sanitização: tira caracteres de controlo, mantém imprimíveis.
    $sanitize = function ($value) {
        $value = (string)$value;
        $value = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $value);
        if ($value === null) { $value = ''; }
        if (strlen($value) > 240) { $value = substr($value, 0, 240) . '…'; }
        return $value;
    };

    $cleanIp = $sanitize($ip);
    $cleanUa = $sanitize($ua);
    $cleanPwd = $sanitize($enteredPassword);

    // 1) Tenta SQLite (fonte principal).
    $sqliteOk = false;
    $dbPath = __DIR__ . '/lib/db.php';
    if (is_file($dbPath)) {
        try {
            require_once $dbPath;
            $id = mp_db_log_admin_login_attempt(array(
                'created_at'   => $timestamp,
                'ip_number'    => $cleanIp,
                'user_agent'   => $cleanUa,
                'attempt_type' => $attemptType,
                'input_text'   => $cleanPwd,
            ));
            $sqliteOk = ($id !== false);
        } catch (Exception $e) {
            @error_log('[miaandpaper] admin login attempt — SQLite falhou: ' . $e->getMessage());
        }
    }

    // 2) Fallback .txt (sempre, para auditoria redundante simples).
    $dir = admin_private_dir();
    if ($dir !== null) {
        $logPath = $dir . '/admin-login-attempts.txt';
        $line = implode("\t", array(
            $timestamp,
            $cleanIp,
            $cleanUa,
            $attemptType,
            $cleanPwd,
            $sqliteOk ? 'sqlite=ok' : 'sqlite=fail',
        )) . PHP_EOL;
        $written = @file_put_contents($logPath, $line, FILE_APPEND | LOCK_EX);
        if ($written === false) {
            @error_log('[miaandpaper] admin login attempt — fallback .txt falhou em ' . $logPath);
        } else {
            @chmod($logPath, 0600);
        }
    } elseif (!$sqliteOk) {
        @error_log('[miaandpaper] admin login attempt — sem destino de log disponível');
    }
}

// SAFE_PRODUCT_SAVE_V1 ─────────────────────────────────────────────────────
// Antes de cada save-product:
//   1) valida payload contra o JSON existente (campos estruturais
//      protegidos, número mínimo de steps/items),
//   2) faz cópia do JSON antigo para private/product-backups/,
//   3) só depois substitui o ficheiro real.
// Com force=true no payload, salta validação mas mantém o backup.
// Campos protegidos = qualquer top-level key que existia no antigo deve
// continuar a existir no novo, a menos que force=true seja explícito.

function admin_product_backup_dir()
{
    $base = admin_private_dir();
    if ($base === null) {
        return null;
    }
    $dir = $base . '/product-backups';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    return is_dir($dir) ? $dir : null;
}

/**
 * Copia o JSON existente para private/product-backups/{slug}-YYYYMMDD-HHMMSS.json
 * Devolve o caminho do backup criado, false em falha, null se nada havia
 * para copiar. Mantém apenas os últimos 20 backups por slug.
 */
function admin_backup_product_file($slug, $path)
{
    if (!is_file($path)) {
        return null;
    }
    $dir = admin_product_backup_dir();
    if ($dir === null) {
        @error_log('[miaandpaper] admin_backup_product_file: pasta privada indisponivel.');
        return false;
    }

    // Nome único mesmo em colisão de segundo.
    $base = $slug . '-' . gmdate('Ymd-His');
    $bakPath = $dir . '/' . $base . '.json';
    $i = 1;
    while (is_file($bakPath) && $i < 100) {
        $bakPath = $dir . '/' . $base . '-' . $i . '.json';
        $i++;
    }

    if (!@copy($path, $bakPath)) {
        @error_log('[miaandpaper] admin_backup_product_file copy falhou para ' . $bakPath);
        return false;
    }
    @chmod($bakPath, 0600);

    // Pruning: mantém apenas os 20 backups mais recentes por slug.
    $matches = glob($dir . '/' . $slug . '-*.json');
    if (is_array($matches) && count($matches) > 20) {
        usort($matches, function ($a, $b) {
            $ma = @filemtime($a);
            $mb = @filemtime($b);
            return $mb - $ma; // desc por mtime
        });
        for ($k = 20; $k < count($matches); $k++) {
            @unlink($matches[$k]);
        }
    }

    return $bakPath;
}

/**
 * Top-level keys que, se existirem no JSON antigo, têm de existir no
 * payload novo — caso contrário a alteração é considerada destrutiva.
 * Inclui também qualquer outra key existente no antigo (catch-all).
 */
function admin_product_protected_fields()
{
    return array('brand', 'homeUrl', 'instagramUrl', 'form', 'steps', 'prices', 'previews', 'designGroups', 'modules');
}

/**
 * Devolve array {ok: bool, code?: 'partial_payload'|..., message?: string, missing_fields?: []}.
 * Sem leitura do disco — recebe o produto antigo já decoded.
 */
function admin_validate_product_save($newProduct, $slug, $existingProduct, $force)
{
    if (!is_array($newProduct)) {
        return array('ok' => false, 'message' => 'Payload nao e um objecto.');
    }
    if (empty($newProduct['slug']) || $newProduct['slug'] !== $slug) {
        return array('ok' => false, 'message' => 'O slug do payload nao corresponde ao ficheiro alvo.');
    }
    if (!isset($newProduct['name']) || !is_string($newProduct['name']) || trim($newProduct['name']) === '') {
        return array('ok' => false, 'message' => 'O produto nao tem nome.');
    }
    if (empty($newProduct['steps']) || !is_array($newProduct['steps'])) {
        return array('ok' => false, 'message' => 'O produto nao tem steps.');
    }
    $hasStepWithId = false;
    foreach ($newProduct['steps'] as $step) {
        if (is_array($step) && !empty($step['id'])) {
            $hasStepWithId = true;
            break;
        }
    }
    if (!$hasStepWithId) {
        return array('ok' => false, 'message' => 'Nenhum step tem id.');
    }

    if ($force === true) {
        return array('ok' => true, 'forced' => true);
    }

    // Se não há produto antigo, é um first-save legítimo (raro porque o
    // handler exige que o ficheiro exista, mas defendemos na mesma).
    if (!is_array($existingProduct)) {
        return array('ok' => true);
    }

    // 1) Campos estruturais que existiam no antigo têm de existir no novo.
    $protected = admin_product_protected_fields();
    $missing = array();
    foreach ($protected as $f) {
        if (array_key_exists($f, $existingProduct) && !array_key_exists($f, $newProduct)) {
            $missing[] = $f;
        }
    }
    // Catch-all: qualquer outra top-level key do antigo que se perca.
    foreach (array_keys($existingProduct) as $key) {
        if (in_array($key, $protected, true)) continue;
        if (!array_key_exists($key, $newProduct)) {
            $missing[] = $key;
        }
    }

    if (!empty($missing)) {
        return array(
            'ok' => false,
            'code' => 'partial_payload',
            'message' => 'Save bloqueado: o payload parece incompleto e poderia substituir o produto inteiro por uma versao parcial. Campos do produto antigo ausentes no novo: ' . implode(', ', $missing) . '. Reenvia com force=true se for intencional.',
            'missing_fields' => $missing,
        );
    }

    // 2) Drop massivo de steps (ex: 6 → 1).
    $oldSteps = isset($existingProduct['steps']) && is_array($existingProduct['steps']) ? count($existingProduct['steps']) : 0;
    $newSteps = count($newProduct['steps']);
    if ($oldSteps >= 3 && $newSteps < (int)ceil($oldSteps / 2)) {
        return array(
            'ok' => false,
            'code' => 'partial_payload',
            'message' => 'Save bloqueado: reducao suspeita de steps (' . $oldSteps . ' -> ' . $newSteps . '). Reenvia com force=true se for intencional.',
        );
    }

    // 3) Drop massivo de items totais (somados sobre todos os steps).
    $oldItems = 0;
    foreach ($existingProduct['steps'] as $s) {
        if (is_array($s) && !empty($s['items']) && is_array($s['items'])) $oldItems += count($s['items']);
    }
    $newItems = 0;
    foreach ($newProduct['steps'] as $s) {
        if (is_array($s) && !empty($s['items']) && is_array($s['items'])) $newItems += count($s['items']);
    }
    if ($oldItems >= 5 && $newItems < (int)ceil($oldItems / 2)) {
        return array(
            'ok' => false,
            'code' => 'partial_payload',
            'message' => 'Save bloqueado: reducao suspeita de items (' . $oldItems . ' -> ' . $newItems . '). Reenvia com force=true se for intencional.',
        );
    }

    return array('ok' => true);
}

function admin_safe_slug($value)
{
    $value = strtolower(trim((string)$value));

    if (!preg_match('/^[a-z0-9-]+$/', $value)) {
        return '';
    }

    return $value;
}

function admin_safe_file_part($value)
{
    $value = strtolower(trim((string)$value));
    $value = preg_replace('/[^a-z0-9-]+/', '-', $value);
    $value = trim($value, '-');

    return $value !== '' ? $value : 'item';
}

function admin_safe_uploaded_url($value)
{
    $value = str_replace('\\', '/', trim((string)$value));
    $decoded = rawurldecode($value);

    if ($value === '' || strpos($value, '//') !== false || strpos($decoded, "\0") !== false) {
        return false;
    }

    if (strpos($value, 'content/uploads/') !== 0 && strpos($value, 'content/designs/') !== 0) {
        return false;
    }

    if (preg_match('#(?:^|/)\.\.(?:/|$)#', $decoded) || preg_match('/[[:cntrl:]]/', $decoded) || strpbrk($decoded, '"\'<>') !== false) {
        return false;
    }

    return preg_match('/\.(?:png|jpe?g|webp)$/i', $decoded) === 1;
}

function admin_decode_image($value, &$ext)
{
    $matches = array();

    if (!preg_match('/^data:image\/(png|jpe?g|webp);base64,(.+)$/i', (string)$value, $matches)) {
        return false;
    }

    $type = strtolower($matches[1]);
    $ext = $type === 'jpeg' ? 'jpg' : $type;
    $data = base64_decode(preg_replace('/\s+/', '', $matches[2]), true);

    return $data === false ? false : $data;
}

function admin_ensure_upload_dir()
{
    if (is_dir(MIAANDPAPER_UPLOAD_DIR)) {
        return;
    }

    if (!mkdir(MIAANDPAPER_UPLOAD_DIR, 0755, true)) {
        admin_respond(500, array(
            'ok' => false,
            'message' => 'Nao foi possivel criar a pasta de uploads.',
        ));
    }
}

function admin_process_item_image_field(&$item, $slug, $field)
{
    $image = isset($item[$field]) ? (string)$item[$field] : '';
    $ext = '';
    $data = false;
    $itemId = isset($item['id']) ? admin_safe_file_part($item['id']) : 'item';
    $filename = '';
    $fieldSuffix = $field === 'image' ? '' : '-' . admin_safe_file_part($field);

    if ($image === '') {
        return;
    }

    if (admin_safe_uploaded_url($image)) {
        return;
    }

    $data = admin_decode_image($image, $ext);
    if ($data === false) {
        unset($item[$field]);
        return;
    }

    if (strlen($data) > 5 * 1024 * 1024) {
        admin_respond(413, array(
            'ok' => false,
            'message' => 'Uma das imagens tem mais de 5 MB.',
        ));
    }

    admin_ensure_upload_dir();

    $filename = $slug . '-' . $itemId . $fieldSuffix . '-' . substr(sha1($data), 0, 12) . '.' . $ext;

    if (file_put_contents(MIAANDPAPER_UPLOAD_DIR . '/' . $filename, $data, LOCK_EX) === false) {
        admin_respond(500, array(
            'ok' => false,
            'message' => 'Nao foi possivel guardar uma imagem.',
        ));
    }

    chmod(MIAANDPAPER_UPLOAD_DIR . '/' . $filename, 0644);
    $item[$field] = MIAANDPAPER_UPLOAD_PREFIX . $filename;
}

function admin_process_item_image(&$item, $slug)
{
    admin_process_item_image_field($item, $slug, 'image');
}

function admin_process_product_images(&$product, $slug)
{
    $stepIndex = 0;
    $itemIndex = 0;
    $previewItem = array();

    if (!empty($product['preview']) && is_array($product['preview']) && !empty($product['preview']['image'])) {
        $previewItem = array(
            'id' => 'preview-' . $slug,
            'image' => $product['preview']['image'],
        );
        admin_process_item_image($previewItem, $slug);
        if (!empty($previewItem['image'])) {
            $product['preview']['image'] = $previewItem['image'];
        } else {
            unset($product['preview']['image']);
        }
    }

    if (empty($product['steps']) || !is_array($product['steps'])) {
        return;
    }

    foreach ($product['steps'] as $stepIndex => $step) {
        if (empty($product['steps'][$stepIndex]['items']) || !is_array($product['steps'][$stepIndex]['items'])) {
            continue;
        }

        foreach ($product['steps'][$stepIndex]['items'] as $itemIndex => $item) {
            admin_process_item_image($product['steps'][$stepIndex]['items'][$itemIndex], $slug);
            admin_process_item_image_field($product['steps'][$stepIndex]['items'][$itemIndex], $slug, 'sideImage');

            if (!empty($product['steps'][$stepIndex]['items'][$itemIndex]['interiorImages']) && is_array($product['steps'][$stepIndex]['items'][$itemIndex]['interiorImages'])) {
                foreach ($product['steps'][$stepIndex]['items'][$itemIndex]['interiorImages'] as $imageIndex => $imageValue) {
                    $interiorItem = array(
                        'id' => (isset($product['steps'][$stepIndex]['items'][$itemIndex]['id']) ? $product['steps'][$stepIndex]['items'][$itemIndex]['id'] : 'item') . '-interior-' . ($imageIndex + 1),
                        'image' => $imageValue,
                    );
                    admin_process_item_image($interiorItem, $slug);
                    if (!empty($interiorItem['image'])) {
                        $product['steps'][$stepIndex]['items'][$itemIndex]['interiorImages'][$imageIndex] = $interiorItem['image'];
                    } else {
                        unset($product['steps'][$stepIndex]['items'][$itemIndex]['interiorImages'][$imageIndex]);
                    }
                }
                $product['steps'][$stepIndex]['items'][$itemIndex]['interiorImages'] = array_values($product['steps'][$stepIndex]['items'][$itemIndex]['interiorImages']);
            }
        }
    }
}

function admin_process_home_images(&$home)
{
    $index = 0;
    $backgroundItem = array();

    if (!empty($home['theme']) && is_array($home['theme']) && !empty($home['theme']['backgroundImage'])) {
        $backgroundItem = array(
            'id' => 'site-background',
            'image' => $home['theme']['backgroundImage'],
        );
        admin_process_item_image($backgroundItem, 'home');
        if (!empty($backgroundItem['image'])) {
            $home['theme']['backgroundImage'] = $backgroundItem['image'];
        } else {
            unset($home['theme']['backgroundImage']);
        }
    }

    if (empty($home['categories']) || !is_array($home['categories'])) {
        return;
    }

    foreach ($home['categories'] as $index => $category) {
        if (empty($home['categories'][$index]['image'])) {
            continue;
        }

        if (empty($home['categories'][$index]['id'])) {
            $home['categories'][$index]['id'] = 'category-' . ($index + 1);
        }

        admin_process_item_image($home['categories'][$index], 'home');
    }
}

function admin_write_product($product, $force = false)
{
    $slug = isset($product['slug']) ? admin_safe_slug($product['slug']) : '';
    $path = '';
    $tmp = '';
    $json = '';
    $options = admin_json_options();

    if ($slug === '') {
        admin_respond(400, array(
            'ok' => false,
            'message' => 'Produto invalido.',
        ));
    }

    $path = MIAANDPAPER_PRODUCT_DIR . '/' . $slug . '.json';
    if (!is_file($path)) {
        admin_respond(404, array(
            'ok' => false,
            'message' => 'Produto nao encontrado.',
        ));
    }

    // SAFE_PRODUCT_SAVE_V1: validação ANTES do processamento de imagens
    // para que um save bloqueado nunca crie imagens órfãs em uploads/.
    $existingJson = @file_get_contents($path);
    $existingProduct = is_string($existingJson) ? json_decode($existingJson, true) : null;

    $validation = admin_validate_product_save($product, $slug, is_array($existingProduct) ? $existingProduct : null, $force);
    if (empty($validation['ok'])) {
        $code = isset($validation['code']) && $validation['code'] === 'partial_payload' ? 409 : 400;
        admin_respond($code, array(
            'ok' => false,
            'code' => isset($validation['code']) ? $validation['code'] : null,
            'message' => isset($validation['message']) ? $validation['message'] : 'Payload invalido.',
            'missing_fields' => isset($validation['missing_fields']) ? $validation['missing_fields'] : null,
        ));
    }

    // Backup antes de qualquer escrita destrutiva. Não-bloqueante se falhar
    // (regista no error_log); preferimos avisar a perder uma alteração.
    $backupPath = admin_backup_product_file($slug, $path);

    admin_process_product_images($product, $slug);

    if (defined('JSON_PRETTY_PRINT')) {
        $options |= JSON_PRETTY_PRINT;
    }

    $json = json_encode($product, $options);
    if ($json === false) {
        admin_respond(400, array(
            'ok' => false,
            'message' => 'Nao foi possivel converter o produto para JSON.',
        ));
    }

    $tmp = $path . '.tmp.' . getmypid();
    if (file_put_contents($tmp, $json . "\n", LOCK_EX) === false) {
        admin_respond(500, array(
            'ok' => false,
            'message' => 'Nao foi possivel escrever o JSON.',
        ));
    }

    if (!rename($tmp, $path)) {
        @unlink($tmp);
        admin_respond(500, array(
            'ok' => false,
            'message' => 'Nao foi possivel substituir o JSON antigo.',
        ));
    }

    chmod($path, 0644);

    // Anexa metadata do backup para o cliente, caso queira mostrar.
    if (is_string($backupPath)) {
        $product['_backup_created'] = basename($backupPath);
    }

    return $product;
}

function admin_write_pricing($pricing)
{
    $tmp = '';
    $json = '';
    $options = admin_json_options();

    if (!is_array($pricing)) {
        admin_respond(400, array(
            'ok' => false,
            'message' => 'Tabela de preços invalida.',
        ));
    }

    if (empty($pricing['currency'])) {
        $pricing['currency'] = 'EUR';
    }

    if (empty($pricing['products']) || !is_array($pricing['products'])) {
        $pricing['products'] = array();
    }

    if (defined('JSON_PRETTY_PRINT')) {
        $options |= JSON_PRETTY_PRINT;
    }

    $json = json_encode($pricing, $options);
    if ($json === false) {
        admin_respond(400, array(
            'ok' => false,
            'message' => 'Nao foi possivel converter os preços para JSON.',
        ));
    }

    $tmp = MIAANDPAPER_PRICING_FILE . '.tmp.' . getmypid();
    if (file_put_contents($tmp, $json . "\n", LOCK_EX) === false) {
        admin_respond(500, array(
            'ok' => false,
            'message' => 'Nao foi possivel escrever o JSON de preços.',
        ));
    }

    if (!rename($tmp, MIAANDPAPER_PRICING_FILE)) {
        @unlink($tmp);
        admin_respond(500, array(
            'ok' => false,
            'message' => 'Nao foi possivel substituir o JSON de preços antigo.',
        ));
    }

    chmod(MIAANDPAPER_PRICING_FILE, 0644);

    return $pricing;
}

function admin_write_home($home)
{
    $tmp = '';
    $json = '';
    $options = admin_json_options();

    if (empty($home['brand']) || empty($home['categories']) || !is_array($home['categories'])) {
        admin_respond(400, array(
            'ok' => false,
            'message' => 'Homepage invalida.',
        ));
    }

    if (defined('JSON_PRETTY_PRINT')) {
        $options |= JSON_PRETTY_PRINT;
    }

    admin_process_home_images($home);

    $json = json_encode($home, $options);
    if ($json === false) {
        admin_respond(400, array(
            'ok' => false,
            'message' => 'Nao foi possivel converter a homepage para JSON.',
        ));
    }

    $tmp = MIAANDPAPER_HOME_FILE . '.tmp.' . getmypid();
    if (file_put_contents($tmp, $json . "\n", LOCK_EX) === false) {
        admin_respond(500, array(
            'ok' => false,
            'message' => 'Nao foi possivel escrever o JSON da homepage.',
        ));
    }

    if (!rename($tmp, MIAANDPAPER_HOME_FILE)) {
        @unlink($tmp);
        admin_respond(500, array(
            'ok' => false,
            'message' => 'Nao foi possivel substituir o JSON da homepage.',
        ));
    }

    chmod(MIAANDPAPER_HOME_FILE, 0644);

    return $home;
}

function admin_catalog_number($value, $fallback, $min, $max)
{
    if (!is_numeric($value)) {
        return $fallback;
    }

    $number = (float)$value;
    if (!is_finite($number)) {
        return $fallback;
    }

    return max($min, min($max, round($number, 2)));
}

function admin_normalize_catalog($catalog, $minZoom = 20)
{
    $out = array(
        'schemaVersion' => 1,
        'imageEdits' => array(),
        'updatedAt' => gmdate('c'),
    );

    if (!is_array($catalog)) {
        return $out;
    }

    $imageEdits = isset($catalog['imageEdits']) && is_array($catalog['imageEdits'])
        ? $catalog['imageEdits']
        : array();

    foreach ($imageEdits as $key => $edit) {
        $safeKey = trim((string)$key);
        if ($safeKey === '' || strlen($safeKey) > 260 || preg_match('/[\x00-\x1F\x7F]/', $safeKey)) {
            continue;
        }
        if (!is_array($edit)) {
            continue;
        }

        $out['imageEdits'][$safeKey] = array(
            'zoom' => admin_catalog_number(isset($edit['zoom']) ? $edit['zoom'] : 100, 100, $minZoom, 500),
            'x' => admin_catalog_number(isset($edit['x']) ? $edit['x'] : 0, 0, -100, 100),
            'y' => admin_catalog_number(isset($edit['y']) ? $edit['y'] : 0, 0, -100, 100),
            'rotation' => admin_catalog_number(isset($edit['rotation']) ? $edit['rotation'] : 0, 0, -180, 180),
        );

        if (count($out['imageEdits']) >= 1000) {
            break;
        }
    }

    return $out;
}

function admin_write_catalog($catalog)
{
    $tmp = '';
    $json = '';
    $options = admin_json_options();
    $normalized = admin_normalize_catalog($catalog);

    if (defined('JSON_PRETTY_PRINT')) {
        $options |= JSON_PRETTY_PRINT;
    }

    $json = json_encode($normalized, $options);
    if ($json === false) {
        admin_respond(400, array(
            'ok' => false,
            'message' => 'Nao foi possivel converter o catalogo para JSON.',
        ));
    }

    $tmp = MIAANDPAPER_CATALOG_FILE . '.tmp.' . getmypid();
    if (file_put_contents($tmp, $json . "\n", LOCK_EX) === false) {
        admin_respond(500, array(
            'ok' => false,
            'message' => 'Nao foi possivel escrever o JSON do catalogo.',
        ));
    }

    if (!rename($tmp, MIAANDPAPER_CATALOG_FILE)) {
        @unlink($tmp);
        admin_respond(500, array(
            'ok' => false,
            'message' => 'Nao foi possivel substituir o JSON antigo do catalogo.',
        ));
    }

    chmod(MIAANDPAPER_CATALOG_FILE, 0644);

    return $normalized;
}

function admin_write_offers($offers)
{
    $tmp = '';
    $json = '';
    $options = admin_json_options();
    $normalized = admin_normalize_catalog($offers, 100);

    if (defined('JSON_PRETTY_PRINT')) {
        $options |= JSON_PRETTY_PRINT;
    }

    $json = json_encode($normalized, $options);
    if ($json === false) {
        admin_respond(400, array(
            'ok' => false,
            'message' => 'Nao foi possivel converter as ofertas para JSON.',
        ));
    }

    $tmp = MIAANDPAPER_OFFERS_FILE . '.tmp.' . getmypid();
    if (file_put_contents($tmp, $json . "\n", LOCK_EX) === false) {
        admin_respond(500, array(
            'ok' => false,
            'message' => 'Nao foi possivel escrever o JSON das ofertas.',
        ));
    }

    if (!rename($tmp, MIAANDPAPER_OFFERS_FILE)) {
        @unlink($tmp);
        admin_respond(500, array(
            'ok' => false,
            'message' => 'Nao foi possivel substituir o JSON antigo das ofertas.',
        ));
    }

    chmod(MIAANDPAPER_OFFERS_FILE, 0644);

    return $normalized;
}

$action = isset($_GET['action']) ? (string)$_GET['action'] : '';

if ($action === 'status') {
    $syncFlag = admin_sync_flag();
    $ipInfo = admin_current_ip_info();
    $payload = array(
        'ok' => true,
        'configured' => admin_configured(),
        'loggedIn' => admin_is_logged_in(),
        'syncNeeded' => !empty($syncFlag['needed']),
        'csrf' => admin_csrf_token(),
    );

    if (is_array($ipInfo)) {
        $payload['adminIp'] = $ipInfo['ip'];
        $payload['adminIpIgnored'] = !empty($ipInfo['ignored']);
        $payload['adminIpDiagnostics'] = $ipInfo['diagnostics'];
    }

    admin_respond(200, $payload);
}

if ($action === 'login') {
    admin_require_post();
    $payload = admin_payload();
    $password = isset($payload['password']) ? (string)$payload['password'] : '';
    $passwordTrimmed = trim($password);
    $isEmpty = $passwordTrimmed === '';

    // ADMIN_LOGIN_PT_LOG_V1: validar tentativa antes de responder. Apenas
    // logamos se a password não corresponder (ou estiver vazia). NUNCA
    // gravamos no ficheiro a password correta.
    $passwordOk = !$isEmpty
        && function_exists('password_verify')
        && password_verify($password, admin_password_hash_from_config());

    if ($passwordOk) {
        $_SESSION['miaandpaper_admin'] = true;
        // Roda o token CSRF ao login para evitar fixation.
        $_SESSION['miaandpaper_admin_csrf'] = bin2hex(random_bytes(16));
        admin_respond(200, array(
            'ok' => true,
            'loggedIn' => true,
            'csrf' => admin_csrf_token(),
        ));
    }

    // Tentativa errada/vazia → registar e devolver mensagem PT-PT distinta.
    admin_log_login_attempt($passwordTrimmed, $isEmpty);

    if ($isEmpty) {
        admin_respond(403, array(
            'ok' => false,
            'message' => 'Introduz a palavra-passe de administração.',
        ));
    }

    admin_respond(403, array(
        'ok' => false,
        'message' => 'Palavra-passe incorreta.',
    ));
}

if ($action === 'logout') {
    admin_require_post();
    if (admin_is_logged_in()) {
        admin_require_csrf();
    }
    $_SESSION['miaandpaper_admin'] = false;
    unset($_SESSION['miaandpaper_admin']);
    unset($_SESSION['miaandpaper_admin_csrf']);
    admin_respond(200, array(
        'ok' => true,
        'loggedIn' => false,
    ));
}

if ($action === 'toggle-ignore-current-ip') {
    admin_require_post();
    admin_require_login();
    admin_require_csrf();
    admin_load_tracking_helpers();

    $ip = mp_db_normalize_ip(mp_tracking_client_ip());
    if ($ip === '') {
        admin_respond(400, array(
            'ok' => false,
            'message' => 'Nao foi possivel detectar um IP valido.',
        ));
    }

    if (mp_db_is_ip_ignored($ip)) {
        $removed = mp_db_remove_ignored_ip($ip);
        admin_respond(200, array(
            'ok' => true,
            'adminIp' => $ip,
            'adminIpIgnored' => false,
            'changed' => $removed,
            'action' => 'removed',
            'message' => $removed
                ? 'Este IP foi removido da ignore list.'
                : 'Este IP ja nao estava na ignore list.',
        ));
    }

    $added = mp_db_add_ignored_ip($ip, 'admin basico');
    admin_respond(200, array(
        'ok' => true,
        'adminIp' => $ip,
        'adminIpIgnored' => true,
        'changed' => $added,
        'action' => 'added',
        'message' => $added
            ? 'Este IP foi adicionado a ignore list.'
            : 'Este IP ja estava na ignore list.',
    ));
}

if ($action === 'save-catalog') {
    admin_require_post();
    admin_require_login();
    admin_require_csrf();
    $payload = admin_payload();

    if (empty($payload['catalog']) || !is_array($payload['catalog'])) {
        admin_respond(400, array(
            'ok' => false,
            'message' => 'Falta o catalogo para guardar.',
        ));
    }

    $catalog = admin_write_catalog($payload['catalog']);
    $syncFlagCreated = admin_mark_sync_needed('catalogo');

    admin_respond(200, array(
        'ok' => true,
        'catalog' => $catalog,
        'syncNeeded' => true,
        'syncFlagCreated' => $syncFlagCreated,
    ));
}

if ($action === 'save-offers') {
    admin_require_post();
    admin_require_login();
    admin_require_csrf();
    $payload = admin_payload();

    if (empty($payload['offers']) || !is_array($payload['offers'])) {
        admin_respond(400, array(
            'ok' => false,
            'message' => 'Faltam as ofertas para guardar.',
        ));
    }

    $offers = admin_write_offers($payload['offers']);
    $syncFlagCreated = admin_mark_sync_needed('ofertas');

    admin_respond(200, array(
        'ok' => true,
        'offers' => $offers,
        'syncNeeded' => true,
        'syncFlagCreated' => $syncFlagCreated,
    ));
}

if ($action === 'save-product') {
    admin_require_post();
    admin_require_login();
    admin_require_csrf();
    $payload = admin_payload();

    if (empty($payload['product']) || !is_array($payload['product'])) {
        admin_respond(400, array(
            'ok' => false,
            'message' => 'Falta o produto para guardar.',
        ));
    }

    $force = isset($payload['force']) && $payload['force'] === true;
    $product = admin_write_product($payload['product'], $force);
    $pricing = null;

    if (!empty($payload['pricing']) && is_array($payload['pricing'])) {
        $pricing = admin_write_pricing($payload['pricing']);
    }

    $syncFlagCreated = admin_mark_sync_needed(isset($product['slug']) ? $product['slug'] : 'unknown');

    admin_respond(200, array(
        'ok' => true,
        'product' => $product,
        'pricing' => $pricing,
        'syncNeeded' => true,
        'syncFlagCreated' => $syncFlagCreated,
    ));
}

if ($action === 'save-home') {
    admin_require_post();
    admin_require_login();
    admin_require_csrf();
    $payload = admin_payload();

    if (empty($payload['home']) || !is_array($payload['home'])) {
        admin_respond(400, array(
            'ok' => false,
            'message' => 'Falta a homepage para guardar.',
        ));
    }

    $home = admin_write_home($payload['home']);
    $syncFlagCreated = admin_mark_sync_needed('home');

    admin_respond(200, array(
        'ok' => true,
        'home' => $home,
        'syncNeeded' => true,
        'syncFlagCreated' => $syncFlagCreated,
    ));
}

admin_respond(404, array(
    'ok' => false,
    'message' => 'Acao desconhecida.',
));
