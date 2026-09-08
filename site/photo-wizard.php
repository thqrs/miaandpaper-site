<?php
declare(strict_types=1);

/**
 * Wizard local para resolver, uma de cada vez, as imagens por concluir na Galeria.
 * As decisões ficam em private/image-mapping-review.json e nunca são
 * aplicadas automaticamente aos JSON públicos.
 */

require_once __DIR__ . '/lib/private-paths.php';
require_once __DIR__ . '/lib/admin-session.php';

function pw_is_local_request(): bool
{
    $address = (string)($_SERVER['REMOTE_ADDR'] ?? '');
    return PHP_SAPI === 'cli-server' && in_array($address, array('127.0.0.1', '::1'), true);
}

if (!pw_is_local_request()) {
    http_response_code(404);
    exit;
}

mp_admin_session_start();

function pw_json_file(string $path): array
{
    if (!is_file($path)) {
        throw new RuntimeException('Falta o ficheiro ' . basename($path) . '. Corre primeiro tools/build-image-catalog.php.');
    }
    $raw = file_get_contents($path);
    if (is_string($raw) && substr($raw, 0, 3) === "\xEF\xBB\xBF") {
        $raw = substr($raw, 3);
    }
    $data = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($data)) {
        throw new RuntimeException('O ficheiro ' . basename($path) . ' não contém JSON válido.');
    }
    return $data;
}

function pw_catalog_path(): string
{
    $path = mp_private_path('image-catalog.json');
    if ($path === null) {
        throw new RuntimeException('A pasta private não está disponível.');
    }
    return $path;
}

function pw_aliases_path(): string
{
    $path = mp_private_path('image-label-aliases.json');
    if ($path === null) {
        throw new RuntimeException('A pasta private não está disponível.');
    }
    return $path;
}

function pw_review_path(): string
{
    $path = mp_private_path('image-mapping-review.json');
    if ($path === null) {
        throw new RuntimeException('A pasta private não está disponível.');
    }
    return $path;
}

function pw_catalog(): array
{
    static $catalog = null;
    if ($catalog === null) {
        $catalog = pw_json_file(pw_catalog_path());
    }
    return $catalog;
}

function pw_aliases(): array
{
    static $aliases = null;
    if ($aliases === null) {
        $data = pw_json_file(pw_aliases_path());
        $aliases = isset($data['aliases']) && is_array($data['aliases']) ? $data['aliases'] : array();
    }
    return $aliases;
}

function pw_review(): array
{
    return pw_json_file(pw_review_path());
}

function pw_safe_public_image(string $path): string
{
    $path = ltrim(str_replace('\\', '/', trim($path)), '/');
    if ($path === '' || str_contains($path, '..')) {
        return '';
    }
    $absolute = realpath(__DIR__ . '/' . str_replace('/', DIRECTORY_SEPARATOR, $path));
    $siteRoot = realpath(__DIR__);
    if ($absolute === false || $siteRoot === false || !is_file($absolute)) {
        return '';
    }
    $absoluteCompare = strtolower(str_replace('\\', '/', $absolute));
    $rootCompare = rtrim(strtolower(str_replace('\\', '/', $siteRoot)), '/') . '/';
    return str_starts_with($absoluteCompare, $rootCompare) ? $path : '';
}

function pw_image_token(string $path): string
{
    return hash('sha256', str_replace('\\', '/', $path));
}

function pw_catalog_image_map(): array
{
    $map = array();
    foreach ((pw_catalog()['images'] ?? array()) as $image) {
        if (!is_array($image) || empty($image['image'])) {
            continue;
        }
        $map[pw_image_token((string)$image['image'])] = $image;
    }
    return $map;
}

function pw_normalize(string $value): string
{
    $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', trim($value));
    if (is_string($ascii) && $ascii !== '') {
        $value = $ascii;
    }
    $value = strtolower($value);
    $value = preg_replace('/[^a-z0-9]+/', '_', $value);
    return trim((string)$value, '_');
}

function pw_alias_map(string $kind): array
{
    $aliases = pw_aliases();
    $raw = isset($aliases[$kind]) && is_array($aliases[$kind]) ? $aliases[$kind] : array();
    $map = array();
    foreach ($raw as $alias => $canonical) {
        $map[pw_normalize((string)$alias)] = pw_normalize((string)$canonical);
    }
    return $map;
}

function pw_canonical_label(string $label, string $kind): string
{
    $normalized = pw_normalize($label);
    $map = pw_alias_map($kind);
    return $map[$normalized] ?? $normalized;
}

function pw_label_set(array $labels, string $kind): array
{
    $set = array();
    foreach ($labels as $label) {
        $normalized = pw_canonical_label((string)$label, $kind);
        if ($normalized !== '') {
            $set[$normalized] = true;
        }
    }
    return $set;
}

function pw_record_match(array $records, array $wanted, string $kind): ?array
{
    foreach ($records as $record) {
        if (!is_array($record)) {
            continue;
        }
        $label = (string)($record['label'] ?? '');
        if (isset($wanted[pw_canonical_label($label, $kind)])) {
            return $record;
        }
    }
    return null;
}

function pw_human_label(string $label): string
{
    return trim(str_replace('_', ' ', $label));
}

function pw_match_strength(string $label, string $targetText): int
{
    $label = pw_normalize($label);
    $targetText = pw_normalize($targetText);
    if ($label === '' || $label === 'unknown' || $targetText === '') { return 0; }
    if (str_contains('_' . $targetText . '_', '_' . $label . '_')) { return 3; }
    $ignored = array('de', 'da', 'do', 'das', 'dos', 'imagem', 'principal', 'passo', 'escolhe', 'tua');
    $targetTerms = array_filter(explode('_', $targetText), static function (string $term) use ($ignored): bool {
        return strlen($term) > 2 && !in_array($term, $ignored, true);
    });
    foreach (array_filter(explode('_', $label)) as $term) {
        if (strlen($term) <= 2 || in_array($term, $ignored, true)) { continue; }
        $stem = rtrim($term, 's');
        foreach ($targetTerms as $targetTerm) {
            if ($term === $targetTerm || ($stem !== '' && $stem === rtrim($targetTerm, 's'))) { return 2; }
        }
    }
    return 0;
}

function pw_score(array $image, array $target): array
{
    $primary = isset($image['primaryProduct']) && is_array($image['primaryProduct']) ? $image['primaryProduct'] : array();
    $primaryLabel = (string)($primary['label'] ?? 'unknown');
    $primaryConfidence = (float)($primary['confidence'] ?? 0);
    $targetText = implode(' ', array_map('strval', (array)($target['labels'] ?? array())));
    $primaryStrength = pw_match_strength(pw_canonical_label($primaryLabel, 'primaryProduct'), $targetText);
    $bestVariation = null;
    $bestVariationStrength = 0;
    foreach ((array)($image['variations'] ?? array()) as $variation) {
        if (!is_array($variation)) { continue; }
        $strength = pw_match_strength(pw_canonical_label((string)($variation['label'] ?? ''), 'variations'), $targetText);
        if ($strength > $bestVariationStrength) {
            $bestVariationStrength = $strength;
            $bestVariation = $variation;
        }
    }
    $score = 0.0;
    $priority = 0;
    if ($primaryStrength > 0) {
        $score += 105 + ($primaryStrength * 15) + ($primaryConfidence * 0.35);
        $priority = $bestVariationStrength > 0 ? 1 : 2;
    }
    if ($bestVariation !== null) {
        $score += 70 + ($bestVariationStrength * 10) + ((float)($bestVariation['confidence'] ?? 0) * 0.25);
        if ($priority === 0 && ($primaryLabel === 'unknown' || $primaryConfidence <= 55)) { $priority = 3; }
    }
    foreach ((array)($image['themes'] ?? array()) as $theme) {
        if (is_array($theme) && pw_match_strength((string)($theme['label'] ?? ''), $targetText) > 0) {
            $score += 12 + ((float)($theme['confidence'] ?? 0) * 0.05);
            if ($priority === 0 && ($primaryLabel === 'unknown' || $primaryConfidence <= 55)) { $priority = 3; }
            break;
        }
    }
    $currentImage = (string)($target['currentImage'] ?? '');
    if ($currentImage !== '' && strcasecmp(basename($currentImage), basename((string)($image['image'] ?? ''))) === 0) {
        $score += 55;
        if ($priority === 0) {
            $priority = 3;
        }
    }

    $reasons = array();
    if ($primaryLabel !== '') {
        $reasons[] = array(
            'confidence' => $primaryConfidence,
            'label' => pw_human_label($primaryLabel),
        );
    }
    if ($bestVariation !== null) {
        $reasons[] = array(
            'confidence' => (float)($bestVariation['confidence'] ?? 0),
            'label' => pw_human_label((string)($bestVariation['label'] ?? '')),
        );
    } elseif ($primaryStrength > 0) {
        $reasons[] = array(
            'confidence' => null,
            'label' => 'variação desconhecida',
        );
    }

    return array('score' => round($score, 2), 'priority' => $priority, 'reasons' => $reasons);
}

function pw_search_haystack(array $image): string
{
    $parts = array(
        basename((string)($image['image'] ?? '')),
        (string)($image['primaryProduct']['label'] ?? ''),
        (string)($image['description'] ?? ''),
        (string)($image['searchSummary'] ?? ''),
        (string)($image['otherProducts'] ?? ''),
    );
    foreach (array('variations', 'themes') as $field) {
        foreach (($image[$field] ?? array()) as $record) {
            if (is_array($record)) {
                $parts[] = (string)($record['label'] ?? '');
            }
        }
    }
    foreach (($image['colors'] ?? array()) as $color) {
        $parts[] = (string)$color;
    }
    foreach (($image['visibleText'] ?? array()) as $record) {
        if (is_array($record)) {
            $parts[] = (string)($record['text'] ?? '');
        }
    }
    return pw_normalize(implode(' ', $parts));
}

function pw_matches_search(array $image, string $search): bool
{
    $search = pw_normalize($search);
    if ($search === '') {
        return true;
    }
    $haystack = pw_search_haystack($image);
    foreach (array_filter(explode('_', $search)) as $term) {
        if (!str_contains($haystack, $term)) {
            return false;
        }
    }
    return true;
}

function pw_candidate_payload(array $image, array $score, string $selectedPath): array
{
    $path = (string)$image['image'];
    return array(
        'token' => pw_image_token($path),
        'fileName' => basename($path),
        'path' => $path,
        'primaryProduct' => $image['primaryProduct'] ?? array(),
        'variations' => $image['variations'] ?? array(),
        'themes' => $image['themes'] ?? array(),
        'colors' => $image['colors'] ?? array(),
        'visibleText' => $image['visibleText'] ?? array(),
        'description' => (string)($image['description'] ?? ''),
        'searchSummary' => (string)($image['searchSummary'] ?? ''),
        'score' => $score['score'],
        'priority' => $score['priority'],
        'reasons' => $score['reasons'],
        'selected' => $selectedPath !== '' && $path === $selectedPath,
    );
}

function pw_candidates(array $payload): array
{
    $key = (string)($payload['key'] ?? '');
    if (!str_starts_with($key, 'gallery::') || strlen($key) > 600) {
        throw new InvalidArgumentException('Local de imagem inválido.');
    }
    $targetInput = isset($payload['target']) && is_array($payload['target']) ? $payload['target'] : array();
    $labels = array_slice(array_values(array_filter(array_map(static function ($value): string {
        return substr(trim((string)$value), 0, 160);
    }, (array)($targetInput['labels'] ?? array())))), 0, 12);
    if ($labels === array()) { throw new InvalidArgumentException('Falta o contexto desta imagem.'); }
    $target = array(
        'labels' => $labels,
        'currentImage' => substr(trim((string)($targetInput['currentImage'] ?? '')), 0, 500),
    );
    $page = max(1, min(1000, (int)($payload['page'] ?? 1)));
    $all = !empty($payload['all']);
    $search = substr(trim((string)($payload['search'] ?? '')), 0, 100);
    $review = pw_review();
    $selectedPath = (($review[$key]['status'] ?? '') === 'selected')
        ? (string)($review[$key]['image'] ?? '')
        : '';
    $rows = array();

    foreach ((pw_catalog()['images'] ?? array()) as $image) {
        if (!is_array($image) || empty($image['image']) || !pw_matches_search($image, $search)) {
            continue;
        }
        $score = pw_score($image, $target);
        $isSelected = $selectedPath !== '' && (string)$image['image'] === $selectedPath;
        if (!$all && $score['priority'] === 0 && !$isSelected) {
            continue;
        }
        $rows[] = pw_candidate_payload($image, $score, $selectedPath);
    }

    usort($rows, static function (array $a, array $b): int {
        if ($a['selected'] !== $b['selected']) {
            return $a['selected'] ? -1 : 1;
        }
        $priorityA = $a['priority'] > 0 ? $a['priority'] : 9;
        $priorityB = $b['priority'] > 0 ? $b['priority'] : 9;
        if ($priorityA !== $priorityB) {
            return $priorityA <=> $priorityB;
        }
        if ($a['score'] !== $b['score']) {
            return $b['score'] <=> $a['score'];
        }
        return strnatcasecmp($a['fileName'], $b['fileName']);
    });

    $perPage = 12;
    $offset = ($page - 1) * $perPage;
    return array(
        'ok' => true,
        'candidates' => array_slice($rows, $offset, $perPage),
        'page' => $page,
        'total' => count($rows),
        'hasMore' => ($offset + $perPage) < count($rows),
        'showingAll' => $all,
        'hasReasonableCandidates' => count(array_filter($rows, static function (array $row): bool {
            return $row['priority'] > 0;
        })) > 0,
    );
}

function pw_status_label(string $status): string
{
    if ($status === 'selected') {
        return '✓ escolhido';
    }
    if ($status === 'deferred') {
        return '↷ deixado para depois';
    }
    return '○ por escolher';
}

function pw_state_payload(): array
{
    $review = pw_review();
    $decisions = array();
    foreach ($review as $key => $decision) {
        if (is_string($key) && str_starts_with($key, 'gallery::') && is_array($decision)) {
            $decisions[$key] = $decision;
            if (($decision['status'] ?? '') === 'selected' && !empty($decision['image'])) {
                $decisions[$key]['selectedToken'] = pw_image_token((string)$decision['image']);
            }
        }
    }

    $stats = pw_catalog()['stats'] ?? array();
    return array(
        'ok' => true,
        'csrf' => mp_admin_csrf_token(),
        'decisions' => $decisions,
        'lastKey' => (string)($review['_meta']['lastKey'] ?? ''),
        'catalogStats' => array(
            'images' => (int)($stats['images'] ?? 0),
            'metadataFiles' => (int)($stats['metadataFiles'] ?? 0),
            'unknown' => (int)($stats['unknown'] ?? 0),
        ),
    );
}

function pw_write_review(array $review): void
{
    $path = pw_review_path();
    $json = json_encode($review, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($json)) {
        throw new RuntimeException('Não foi possível preparar o estado para gravação.');
    }
    $temporary = $path . '.tmp-' . bin2hex(random_bytes(4));
    $backup = $path . '.bak';
    if (file_put_contents($temporary, $json . "\n", LOCK_EX) === false) {
        throw new RuntimeException('Não foi possível escrever o ficheiro temporário.');
    }
    if (is_file($path) && !copy($path, $backup)) {
        @unlink($temporary);
        throw new RuntimeException('Não foi possível criar a cópia de segurança do progresso.');
    }
    if (is_file($path) && !unlink($path)) {
        @unlink($temporary);
        throw new RuntimeException('Não foi possível substituir o progresso actual.');
    }
    if (!rename($temporary, $path)) {
        if (is_file($backup)) {
            @copy($backup, $path);
        }
        @unlink($temporary);
        throw new RuntimeException('Não foi possível concluir a gravação do progresso.');
    }
}

function pw_save_decision(array $payload): array
{
    $key = (string)($payload['key'] ?? '');
    $status = (string)($payload['status'] ?? '');
    if (!str_starts_with($key, 'gallery::') || strlen($key) > 600
        || !in_array($status, array('selected', 'deferred', 'not_found'), true)) {
        throw new InvalidArgumentException('Decisão inválida.');
    }
    $review = pw_review();
    $decision = array('status' => $status, 'updatedAt' => gmdate('c'));
    $summary = isset($payload['summary']) && is_array($payload['summary']) ? $payload['summary'] : array();
    foreach (array('familyLabel', 'variantLabel', 'detail') as $field) {
        $decision[$field] = substr(trim((string)($summary[$field] ?? '')), 0, 180);
    }
    if ($status === 'selected') {
        $token = (string)($payload['imageToken'] ?? '');
        $images = pw_catalog_image_map();
        if (!isset($images[$token])) {
            throw new InvalidArgumentException('A imagem escolhida já não pertence ao catálogo.');
        }
        $decision['image'] = (string)$images[$token]['image'];
    }
    $review[$key] = $decision;
    $nextKey = (string)($payload['nextKey'] ?? $key);
    if (!str_starts_with($nextKey, 'gallery::') || strlen($nextKey) > 600) {
        $nextKey = $key;
    }
    if (!isset($review['_meta']) || !is_array($review['_meta'])) {
        $review['_meta'] = array('version' => 1);
    }
    $review['_meta']['lastKey'] = $nextKey;
    $review['_meta']['updatedAt'] = gmdate('c');
    pw_write_review($review);
    return pw_state_payload();
}

function pw_save_position(array $payload): array
{
    $key = (string)($payload['key'] ?? '');
    if (!str_starts_with($key, 'gallery::') || strlen($key) > 600) {
        throw new InvalidArgumentException('Local de imagem inválido.');
    }
    $review = pw_review();
    if (!isset($review['_meta']) || !is_array($review['_meta'])) {
        $review['_meta'] = array('version' => 1);
    }
    $review['_meta']['lastKey'] = $key;
    $review['_meta']['updatedAt'] = gmdate('c');
    pw_write_review($review);
    return array('ok' => true);
}

function pw_json_response(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function pw_image_response(string $token): void
{
    $images = pw_catalog_image_map();
    if (!isset($images[$token])) {
        http_response_code(404);
        exit;
    }
    $catalog = pw_catalog();
    $sourceRoot = realpath((string)($catalog['sourceRoot'] ?? ''));
    $path = realpath((string)$images[$token]['image']);
    if ($sourceRoot === false || $path === false || !is_file($path)) {
        http_response_code(404);
        exit;
    }
    $rootCompare = rtrim(strtolower(str_replace('\\', '/', $sourceRoot)), '/') . '/';
    $pathCompare = strtolower(str_replace('\\', '/', $path));
    if (!str_starts_with($pathCompare, $rootCompare)) {
        http_response_code(403);
        exit;
    }
    $types = array(
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
    );
    $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    if (!isset($types[$extension])) {
        http_response_code(415);
        exit;
    }
    header('Content-Type: ' . $types[$extension]);
    header('Content-Length: ' . (string)filesize($path));
    header('Cache-Control: private, max-age=3600');
    header('X-Content-Type-Options: nosniff');
    readfile($path);
    exit;
}

$pathInfo = (string)($_SERVER['PATH_INFO'] ?? '');
if (preg_match('#^/image/([a-f0-9]{64})$#', $pathInfo, $match)) {
    try {
        pw_image_response($match[1]);
    } catch (Throwable $error) {
        http_response_code(404);
        exit;
    }
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    try {
        $raw = file_get_contents('php://input');
        $payload = is_string($raw) ? json_decode($raw, true) : null;
        if (!is_array($payload)) {
            throw new InvalidArgumentException('Pedido inválido.');
        }
        if (!mp_admin_csrf_is_valid((string)($payload['csrf'] ?? ''))) {
            pw_json_response(array('ok' => false, 'message' => 'A sessão expirou. Actualiza a página.'), 403);
        }
        $action = (string)($payload['action'] ?? '');
        if ($action === 'data') {
            pw_json_response(pw_state_payload());
        }
        if ($action === 'candidates') {
            pw_json_response(pw_candidates($payload));
        }
        if ($action === 'save') {
            pw_json_response(pw_save_decision($payload));
        }
        if ($action === 'position') {
            pw_json_response(pw_save_position($payload));
        }
        throw new InvalidArgumentException('Acção inválida.');
    } catch (Throwable $error) {
        pw_json_response(array('ok' => false, 'message' => $error->getMessage()), 400);
    }
}

$csrf = htmlspecialchars(mp_admin_csrf_token(), ENT_QUOTES, 'UTF-8');
?><!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="photo-wizard-csrf" content="<?= $csrf ?>">
  <title>Imagens por concluir · Mia &amp; Paper</title>
  <link rel="icon" href="content/brand/logo.webp" type="image/webp">
  <link rel="stylesheet" href="css/01-tokens-agua.css?v=20260908010816">
  <link rel="stylesheet" href="admin-nav.css?v=20260908010816">
  <link rel="stylesheet" href="photo-wizard.css?v=2026081502">
  <script src="admin-nav.js?v=20260908010816" defer></script>
  <script src="galeria-slots.js?v=2026081701" defer></script>
  <script src="photo-wizard.js?v=2026081502" defer></script>
</head>
<body>
  <main class="photo-wizard" id="photo-wizard">
    <p class="wizard-loading" role="status">A preparar as escolhas…</p>
  </main>
</body>
</html>