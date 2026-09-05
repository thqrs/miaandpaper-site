<?php
/**
 * MOCKUP_STUDIO_API_V1 — grava presets e substitui um único PNG/SVG por pedido.
 */
declare(strict_types=1);

require_once __DIR__ . '/admin-open.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function ms_reply(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function ms_fail(string $message, int $status = 400): void
{
    ms_reply(['ok' => false, 'message' => $message], $status);
}

if (empty($_SESSION['miaandpaper_admin'])) {
    ms_fail('Acesso reservado à administração.', 403);
}

function ms_json_file(string $path): array
{
    $raw = @file_get_contents($path);
    if ($raw === false) {
        ms_fail('Não foi possível ler o ficheiro do preset.', 500);
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        ms_fail('O preset contém JSON inválido.', 500);
    }
    return $data;
}

function ms_preset_path(string $presetId): string
{
    if (!preg_match('/^[a-z0-9][a-z0-9-]{0,63}$/', $presetId)) {
        ms_fail('Preset inválido.');
    }
    $root = __DIR__ . '/content/mockup-studio';
    $index = ms_json_file($root . '/index.json');
    foreach (($index['presets'] ?? []) as $entry) {
        if (($entry['id'] ?? '') !== $presetId || !is_string($entry['path'] ?? null)) {
            continue;
        }
        $path = realpath($root . '/' . $entry['path']);
        $realRoot = realpath($root);
        if ($path === false || $realRoot === false || strpos($path, $realRoot . DIRECTORY_SEPARATOR) !== 0) {
            ms_fail('O caminho do preset não é seguro.', 500);
        }
        return $path;
    }
    ms_fail('Preset não encontrado.', 404);
}

function ms_csrf(): string
{
    return mp_admin_csrf_token();
}

function ms_require_csrf(): void
{
    $sent = isset($_SERVER['HTTP_X_ADMIN_CSRF']) ? (string)$_SERVER['HTTP_X_ADMIN_CSRF'] : '';
    if ($sent === '' && isset($_POST['csrf'])) {
        $sent = (string)$_POST['csrf'];
    }
    if (!mp_admin_csrf_is_valid($sent)) {
        ms_fail('A sessão expirou. Reabre a página e tenta novamente.', 403);
    }
}

function ms_revision(string $path): string
{
    $hash = @hash_file('sha256', $path);
    return is_string($hash) ? $hash : '';
}

function ms_value(array $source, string $path)
{
    $value = $source;
    foreach (explode('.', $path) as $key) {
        if (!is_array($value) || !array_key_exists($key, $value)) {
            return null;
        }
        $value = $value[$key];
    }
    return $value;
}

function ms_set_value(array &$target, string $path, $value): void
{
    $keys = explode('.', $path);
    $cursor =& $target;
    foreach ($keys as $index => $key) {
        if ($index === count($keys) - 1) {
            $cursor[$key] = $value;
            return;
        }
        $cursor =& $cursor[$key];
    }
}

function ms_number(array $candidate, string $path, float $min, float $max): float
{
    $value = ms_value($candidate, $path);
    if (!is_int($value) && !is_float($value)) {
        ms_fail('Valor inválido em ' . $path . '.');
    }
    $number = (float)$value;
    if (!is_finite($number) || $number < $min || $number > $max) {
        ms_fail('Valor fora dos limites em ' . $path . '.');
    }
    return $number;
}

function ms_svg_info(string $bytes): array
{
    if (strlen($bytes) > 2 * 1024 * 1024 || preg_match('//u', $bytes) !== 1) {
        ms_fail('O SVG tem de ser UTF-8 e ter no máximo 2 MB.');
    }
    if (preg_match('/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i', $bytes) !== 1) {
        ms_fail('O ficheiro recebido não é um SVG válido.');
    }
    $forbidden = [
        '/<!DOCTYPE/i', '/<!ENTITY/i', '/<\s*script\b/i', '/<\s*foreignObject\b/i',
        '/\son[a-z]+\s*=/i', '/javascript\s*:/i',
        '/(?:href|xlink:href)\s*=\s*["\']\s*(?:https?:|\/\/|data:)/i',
        '/url\(\s*["\']?\s*(?:https?:|\/\/|data:)/i',
    ];
    foreach ($forbidden as $pattern) {
        if (preg_match($pattern, $bytes) === 1) {
            ms_fail('O SVG contém elementos ou referências que não são permitidos.');
        }
    }
    if (preg_match('/\bwidth\s*=\s*["\']([0-9]+(?:\.[0-9]+)?)(?:px)?["\']/i', $bytes, $widthMatch) !== 1
        || preg_match('/\bheight\s*=\s*["\']([0-9]+(?:\.[0-9]+)?)(?:px)?["\']/i', $bytes, $heightMatch) !== 1) {
        ms_fail('O SVG tem de declarar width e height.');
    }
    $width = (int)ceil((float)$widthMatch[1]);
    $height = (int)ceil((float)$heightMatch[1]);
    if ($width < 1 || $height < 1 || $width > 4096 || $height > 4096) {
        ms_fail('O asset não pode ultrapassar 4096 × 4096 px.');
    }
    return [$width, $height];
}

function ms_normalize_preset(array $candidate, array $current): array
{
    if (($candidate['id'] ?? '') !== ($current['id'] ?? '')) {
        ms_fail('O identificador do preset não pode ser alterado.');
    }
    $normalized = $current;
    $rules = [
        ['cover.x', -2000, 4000], ['cover.y', -2000, 4000],
        ['cover.width', 100, 4000], ['cover.height', 100, 4000],
        ['cover.cornerRadius', 0, 1000], ['cover.artZoom', 0.05, 10],
        ['cover.artX', -4000, 4000], ['cover.artY', -4000, 4000],
        ['holes.count', 1, 40], ['holes.x', -2000, 4000],
        ['holes.firstY', -2000, 4000], ['holes.pitch', 1, 1000],
        ['holes.width', 1, 1000], ['holes.height', 1, 1000],
        ['rings.xOffset', -2000, 2000], ['rings.yOffset', -2000, 2000],
        ['rings.scale', 0.05, 10], ['rings.frontOpacity', 0, 1],
        ['rings.backOpacity', 0, 1], ['rings.shadowOpacity', 0, 1],
        ['elastic.x', -2000, 4000], ['elastic.y', -2000, 4000],
        ['elastic.width', 1, 2000], ['elastic.scale', 0.05, 10],
        ['elastic.opacity', 0, 1], ['elastic.shadowOpacity', 0, 1],
        ['background.opacity', 0, 1], ['background.x', -4000, 4000],
        ['background.y', -4000, 4000], ['background.scale', 0.05, 10],
        ['base.depth.opacity', 0, 1], ['base.depth.xOffset', -2000, 2000],
        ['base.depth.yOffset', -2000, 2000], ['base.depth.scale', 0.05, 10],
        ['shadows.cover.opacity', 0, 1], ['shadows.cover.xOffset', -2000, 2000],
        ['shadows.cover.yOffset', -2000, 2000], ['shadows.cover.scale', 0.05, 10],
        ['shadows.holes.opacity', 0, 1], ['shadows.holes.xOffset', -2000, 2000],
        ['shadows.holes.yOffset', -2000, 2000], ['shadows.holes.scale', 0.05, 10],
        ['overlays.highlights.opacity', 0, 1], ['overlays.highlights.xOffset', -2000, 2000],
        ['overlays.highlights.yOffset', -2000, 2000], ['overlays.highlights.scale', 0.05, 10],
        ['overlays.reflections.opacity', 0, 1], ['overlays.reflections.xOffset', -2000, 2000],
        ['overlays.reflections.yOffset', -2000, 2000], ['overlays.reflections.scale', 0.05, 10],
        ['overlays.texture.opacity', 0, 1], ['overlays.texture.xOffset', -2000, 2000],
        ['overlays.texture.yOffset', -2000, 2000], ['overlays.texture.scale', 0.05, 10],
    ];
    foreach ($rules as $rule) {
        $number = ms_number($candidate, $rule[0], (float)$rule[1], (float)$rule[2]);
        if ($rule[0] === 'holes.count') {
            $number = (int)$number;
        }
        ms_set_value($normalized, $rule[0], $number);
    }

    $positions = ms_value($candidate, 'holes.positionsY');
    if (!is_array($positions) || count($positions) > 40) {
        ms_fail('positionsY tem de ser uma lista com até 40 posições.');
    }
    $normalizedPositions = [];
    foreach ($positions as $position) {
        if ((!is_int($position) && !is_float($position)) || !is_finite((float)$position)) {
            ms_fail('positionsY contém uma posição inválida.');
        }
        $normalizedPositions[] = max(-2000, min(4000, (float)$position));
    }
    $normalized['holes']['positionsY'] = $normalizedPositions;

    $ringStyle = ms_value($candidate, 'rings.style');
    if (!is_string($ringStyle) || !isset($current['rings']['styles'][$ringStyle])) {
        ms_fail('Estilo de argola desconhecido.');
    }
    $normalized['rings']['style'] = $ringStyle;

    $elasticStyle = ms_value($candidate, 'elastic.style');
    if (!is_string($elasticStyle) || !isset($current['elastic']['styles'][$elasticStyle])) {
        ms_fail('Estilo de elástico desconhecido.');
    }
    $normalized['elastic']['style'] = $elasticStyle;
    return $normalized;
}

$action = isset($_GET['action']) ? (string)$_GET['action'] : 'load';
$presetId = isset($_GET['preset']) ? (string)$_GET['preset'] : (isset($_POST['preset']) ? (string)$_POST['preset'] : 'a6-front');
$path = ms_preset_path($presetId);

if ($action === 'load') {
    ms_reply([
        'ok' => true,
        'preset' => ms_json_file($path),
        'revision' => ms_revision($path),
        'csrf' => ms_csrf(),
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ms_fail('Método não permitido.', 405);
}
ms_require_csrf();

if ($action === 'save') {
    $raw = file_get_contents('php://input');
    if (!is_string($raw) || strlen($raw) > 2 * 1024 * 1024) {
        ms_fail('Pedido demasiado grande.');
    }
    $body = json_decode($raw, true);
    if (!is_array($body) || !is_array($body['preset'] ?? null)) {
        ms_fail('Pedido JSON inválido.');
    }
    $currentRevision = ms_revision($path);
    if (!is_string($body['revision'] ?? null) || !hash_equals($currentRevision, $body['revision'])) {
        ms_fail('O preset mudou entretanto. Reabre a página antes de guardar.', 409);
    }
    $current = ms_json_file($path);
    $normalized = ms_normalize_preset($body['preset'], $current);
    $encoded = json_encode($normalized, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($encoded) || file_put_contents($path, $encoded . PHP_EOL, LOCK_EX) === false) {
        ms_fail('Não foi possível gravar o preset.', 500);
    }
    ms_reply(['ok' => true, 'revision' => ms_revision($path)]);
}

if ($action === 'replace-asset') {
    $assetKey = isset($_POST['assetKey']) ? (string)$_POST['assetKey'] : '';
    $preset = ms_json_file($path);
    if ($assetKey === '' || !isset($preset['assets'][$assetKey]['path'])) {
        ms_fail('Slot de asset desconhecido.');
    }
    if (!isset($_FILES['asset']) || !is_array($_FILES['asset'])) {
        ms_fail('Falta o ficheiro do asset.');
    }
    $upload = $_FILES['asset'];
    if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        ms_fail('O upload do asset falhou.');
    }
    if (($upload['size'] ?? 0) < 1 || ($upload['size'] ?? 0) > 20 * 1024 * 1024) {
        ms_fail('O asset tem de ter no máximo 20 MB.');
    }
    $tmp = (string)($upload['tmp_name'] ?? '');
    $bytes = @file_get_contents($tmp);
    if (!is_string($bytes)) {
        ms_fail('Não foi possível ler o asset recebido.');
    }
    $extension = strtolower(pathinfo((string)$preset['assets'][$assetKey]['path'], PATHINFO_EXTENSION));
    if ($extension === 'svg') {
        [$width, $height] = ms_svg_info($bytes);
    } else {
        $info = @getimagesize($tmp);
        if ($extension !== 'png' || !is_array($info) || ($info[2] ?? null) !== IMAGETYPE_PNG) {
            ms_fail('O asset recebido não é um PNG válido.');
        }
        $width = (int)($info[0] ?? 0);
        $height = (int)($info[1] ?? 0);
        if ($width < 1 || $height < 1 || $width > 4096 || $height > 4096) {
            ms_fail('O asset não pode ultrapassar 4096 × 4096 px.');
        }
    }

    $presetRoot = realpath(dirname($path));
    $target = realpath(dirname($path) . '/' . $preset['assets'][$assetKey]['path']);
    if ($presetRoot === false || $target === false || strpos($target, $presetRoot . DIRECTORY_SEPARATOR) !== 0) {
        ms_fail('O caminho do asset não é seguro.', 500);
    }
    if (file_put_contents($target, $bytes, LOCK_EX) === false) {
        ms_fail('Não foi possível substituir o asset.', 500);
    }
    ms_reply([
        'ok' => true,
        'assetKey' => $assetKey,
        'path' => $preset['assets'][$assetKey]['path'],
        'width' => $width,
        'height' => $height,
    ]);
}

ms_fail('Acção desconhecida.', 404);
