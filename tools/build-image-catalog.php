<?php
declare(strict_types=1);

/**
 * Constrói o catálogo local usado por photo-wizard.php.
 *
 * Usa exclusivamente os TXT já produzidos. Não abre nem analisa o conteúdo
 * visual das imagens; apenas confirma a existência e a correspondência nominal
 * de cada par imagem/TXT.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

function iw_fail(string $message): void
{
    fwrite(STDERR, "ERRO: {$message}\n");
    exit(1);
}

function iw_normalize_path(string $path): string
{
    return str_replace('\\', '/', $path);
}

function iw_read_utf8(string $path): string
{
    $text = file_get_contents($path);
    if ($text === false) {
        iw_fail("Não foi possível ler {$path}");
    }
    if (substr($text, 0, 3) === "\xEF\xBB\xBF") {
        $text = substr($text, 3);
    }
    return str_replace(array("\r\n", "\r"), "\n", $text);
}

function iw_section(string $text, string $name): string
{
    $pattern = '/^' . preg_quote($name, '/') . ':\s*\n(.*?)(?=^[A-Z][A-Z_]+:\s*(?:\n|$)|\z)/ms';
    if (!preg_match($pattern, $text, $match)) {
        return '';
    }
    return trim($match[1]);
}

function iw_unquote(string $value): string
{
    $value = trim($value);
    if (strlen($value) >= 2) {
        $first = $value[0];
        $last = $value[strlen($value) - 1];
        if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
            return substr($value, 1, -1);
        }
    }
    return $value;
}

function iw_confidence(string $value): ?float
{
    if (!preg_match('/-?\d+(?:[.,]\d+)?/', $value, $match)) {
        return null;
    }
    $number = (float)str_replace(',', '.', $match[0]);
    return floor($number) === $number ? (float)(int)$number : $number;
}

function iw_records(string $section, string $head): array
{
    if ($section === '' || strtolower(trim($section)) === 'none') {
        return array();
    }

    $records = array();
    $current = null;
    foreach (explode("\n", $section) as $line) {
        if (preg_match('/^-\s*' . preg_quote($head, '/') . ':\s*(.*)$/u', trim($line), $match)) {
            if ($current !== null) {
                $records[] = $current;
            }
            $current = array($head => iw_unquote($match[1]));
            continue;
        }
        if ($current === null) {
            continue;
        }
        if (preg_match('/^\s*confidence:\s*(.*)$/u', $line, $match)) {
            $confidence = iw_confidence($match[1]);
            if ($confidence !== null) {
                $current['confidence'] = $confidence;
            }
        } elseif (preg_match('/^\s*evidence:\s*(.*)$/u', $line, $match)) {
            $current['evidence'] = trim($match[1]);
        }
    }
    if ($current !== null) {
        $records[] = $current;
    }
    return $records;
}

function iw_simple_list(string $section): array
{
    if ($section === '' || strtolower(trim($section)) === 'none') {
        return array();
    }
    $values = array();
    foreach (explode("\n", $section) as $line) {
        if (preg_match('/^-\s*(.+)$/u', trim($line), $match)) {
            $values[] = iw_unquote($match[1]);
        }
    }
    return $values;
}

function iw_label_fingerprint(string $label): string
{
    $value = trim($label);
    $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    if (is_string($ascii) && $ascii !== '') {
        $value = $ascii;
    }
    $value = strtolower($value);
    $value = preg_replace('/[^a-z0-9]+/', '_', $value);
    return trim((string)$value, '_');
}

function iw_atomic_json(string $path, array $data): void
{
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        iw_fail("Não foi possível criar {$dir}");
    }
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($json)) {
        iw_fail("Não foi possível gerar JSON para {$path}");
    }
    $temporary = $path . '.tmp-' . bin2hex(random_bytes(4));
    if (file_put_contents($temporary, $json . "\n", LOCK_EX) === false) {
        iw_fail("Não foi possível escrever {$temporary}");
    }
    if (is_file($path) && !unlink($path)) {
        @unlink($temporary);
        iw_fail("Não foi possível substituir {$path}");
    }
    if (!rename($temporary, $path)) {
        @unlink($temporary);
        iw_fail("Não foi possível concluir {$path}");
    }
}

function iw_recursive_files(string $root): array
{
    $files = array();
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($iterator as $file) {
        if ($file instanceof SplFileInfo && $file->isFile()) {
            $files[] = $file->getPathname();
        }
    }
    natcasesort($files);
    return array_values($files);
}

function iw_build_aliases(array $labelCounts): array
{
    $result = array();
    foreach ($labelCounts as $kind => $counts) {
        $groups = array();
        foreach ($counts as $label => $count) {
            $fingerprint = iw_label_fingerprint((string)$label);
            if ($fingerprint === '') {
                continue;
            }
            $groups[$fingerprint][] = array('label' => (string)$label, 'count' => (int)$count);
        }
        $kindAliases = array();
        foreach ($groups as $entries) {
            if (count($entries) < 2) {
                continue;
            }
            usort($entries, static function (array $a, array $b): int {
                if ($a['count'] !== $b['count']) {
                    return $b['count'] <=> $a['count'];
                }
                if (strlen($a['label']) !== strlen($b['label'])) {
                    return strlen($a['label']) <=> strlen($b['label']);
                }
                return strnatcasecmp($a['label'], $b['label']);
            });
            $canonical = $entries[0]['label'];
            foreach (array_slice($entries, 1) as $entry) {
                if ($entry['label'] !== $canonical) {
                    $kindAliases[$entry['label']] = $canonical;
                }
            }
        }
        ksort($kindAliases, SORT_NATURAL | SORT_FLAG_CASE);
        $result[$kind] = (object)$kindAliases;
    }
    return $result;
}

$repoRoot = dirname(__DIR__);
$sourceRoot = $argv[1] ?? 'F:\\Fotos_site_miaandpaper\\Bulk';
$sourceReal = realpath($sourceRoot);
if ($sourceReal === false || !is_dir($sourceReal)) {
    iw_fail("A pasta de origem não existe: {$sourceRoot}");
}

$labelsIndex = $argv[2] ?? dirname($sourceReal) . DIRECTORY_SEPARATOR . '_LABELS_INDEX.txt';
if (!is_file($labelsIndex)) {
    iw_fail("Não foi encontrado o índice de labels: {$labelsIndex}");
}
$labelsText = iw_read_utf8($labelsIndex);

$allFiles = iw_recursive_files($sourceReal);
$metadataFiles = array_values(array_filter($allFiles, static function (string $path): bool {
    return strtolower(pathinfo($path, PATHINFO_EXTENSION)) === 'txt'
        && strcasecmp(basename($path), '_LABELS_INDEX.txt') !== 0;
}));
$rasterExtensions = array('jpg', 'jpeg', 'png', 'webp');
$rasterFiles = array_values(array_filter($allFiles, static function (string $path) use ($rasterExtensions): bool {
    return in_array(strtolower(pathinfo($path, PATHINFO_EXTENSION)), $rasterExtensions, true);
}));

$images = array();
$errors = array();
$seenImages = array();
$labelCounts = array('primaryProduct' => array(), 'variations' => array(), 'themes' => array());

foreach ($metadataFiles as $metadataPath) {
    $text = iw_read_utf8($metadataPath);
    if (!preg_match('/^IMAGE:\s*(.+?)\s*$/m', $text, $imageMatch)) {
        $errors[] = basename($metadataPath) . ': falta IMAGE';
        continue;
    }

    $declared = iw_unquote($imageMatch[1]);
    $imagePath = dirname($metadataPath) . DIRECTORY_SEPARATOR . str_replace(array('/', '\\'), DIRECTORY_SEPARATOR, $declared);
    $imageReal = realpath($imagePath);
    if ($imageReal === false || !is_file($imageReal)) {
        $errors[] = basename($metadataPath) . ": a imagem declarada não existe ({$declared})";
        continue;
    }
    if (strcasecmp(pathinfo($metadataPath, PATHINFO_FILENAME), pathinfo($imageReal, PATHINFO_FILENAME)) !== 0) {
        $errors[] = basename($metadataPath) . ": o nome-base não coincide com {$declared}";
        continue;
    }
    if (!in_array(strtolower(pathinfo($imageReal, PATHINFO_EXTENSION)), $rasterExtensions, true)) {
        $errors[] = basename($metadataPath) . ": formato não suportado ({$declared})";
        continue;
    }

    $imageKey = strtolower(iw_normalize_path($imageReal));
    if (isset($seenImages[$imageKey])) {
        $errors[] = basename($metadataPath) . ': imagem repetida no catálogo';
        continue;
    }
    $seenImages[$imageKey] = true;

    $primarySection = iw_section($text, 'PRIMARY_PRODUCT');
    $primaryLabel = '';
    $primaryConfidence = null;
    if (preg_match('/^(?:type|label):\s*(.+)$/mi', $primarySection, $match)) {
        $primaryLabel = iw_unquote($match[1]);
    }
    if (preg_match('/^confidence:\s*(.+)$/mi', $primarySection, $match)) {
        $primaryConfidence = iw_confidence($match[1]);
    }
    if ($primaryLabel === '') {
        $errors[] = basename($metadataPath) . ': PRIMARY_PRODUCT sem label';
        continue;
    }

    $variations = iw_records(iw_section($text, 'VARIATIONS'), 'label');
    $themes = iw_records(iw_section($text, 'THEMES'), 'label');
    $visibleText = iw_records(iw_section($text, 'VISIBLE_TEXT'), 'text');

    $labelCounts['primaryProduct'][$primaryLabel] = ($labelCounts['primaryProduct'][$primaryLabel] ?? 0) + 1;
    foreach ($variations as $record) {
        if (($record['label'] ?? '') !== '') {
            $labelCounts['variations'][$record['label']] = ($labelCounts['variations'][$record['label']] ?? 0) + 1;
        }
    }
    foreach ($themes as $record) {
        if (($record['label'] ?? '') !== '') {
            $labelCounts['themes'][$record['label']] = ($labelCounts['themes'][$record['label']] ?? 0) + 1;
        }
    }

    $entry = array(
        'image' => iw_normalize_path($imageReal),
        'metadataFile' => iw_normalize_path((string)realpath($metadataPath)),
        'primaryProduct' => array('label' => $primaryLabel),
        'variations' => $variations,
        'themes' => $themes,
        'colors' => iw_simple_list(iw_section($text, 'COLORS')),
        'visibleText' => $visibleText,
        'description' => iw_section($text, 'VISUAL_DESCRIPTION'),
        'searchSummary' => iw_section($text, 'SEARCH_SUMMARY'),
        'otherProducts' => iw_section($text, 'OTHER_PRODUCTS'),
        'uncertainties' => iw_section($text, 'UNCERTAINTIES'),
    );
    if ($primaryConfidence !== null) {
        $entry['primaryProduct']['confidence'] = $primaryConfidence;
    }
    $images[] = $entry;
}

if (count($metadataFiles) !== count($rasterFiles)) {
    $errors[] = count($metadataFiles) . ' TXT para ' . count($rasterFiles) . ' imagens raster';
}
foreach ($rasterFiles as $imagePath) {
    $real = realpath($imagePath);
    if ($real !== false && !isset($seenImages[strtolower(iw_normalize_path($real))])) {
        $errors[] = basename($imagePath) . ': imagem raster sem TXT associado';
    }
}

$canonicalPrimary = array();
if (preg_match('/1\. TIPOS DE PRODUTO CANÓNICOS.*?(?=2\. LABELS DE VARIAÇÃO)/su', $labelsText, $sectionMatch)) {
    preg_match_all('/^- Tipo:\s*(.+)$/mu', $sectionMatch[0], $typeMatches);
    $canonicalPrimary = array_values(array_unique(array_map('trim', $typeMatches[1] ?? array())));
}
foreach (array_keys($labelCounts['primaryProduct']) as $label) {
    if ($canonicalPrimary !== array() && !in_array($label, $canonicalPrimary, true)) {
        $errors[] = "PRIMARY_PRODUCT não consta do _LABELS_INDEX.txt: {$label}";
    }
}

if ($errors !== array()) {
    foreach (array_slice($errors, 0, 30) as $error) {
        fwrite(STDERR, "- {$error}\n");
    }
    if (count($errors) > 30) {
        fwrite(STDERR, '- e mais ' . (count($errors) - 30) . " problema(s)\n");
    }
    iw_fail('O catálogo não foi escrito porque a validação falhou.');
}

usort($images, static function (array $a, array $b): int {
    return strnatcasecmp($a['image'], $b['image']);
});
foreach ($labelCounts as &$counts) {
    arsort($counts, SORT_NUMERIC);
}
unset($counts);

$privateDir = $repoRoot . DIRECTORY_SEPARATOR . 'private';
$catalogPath = $privateDir . DIRECTORY_SEPARATOR . 'image-catalog.json';
$aliasesPath = $privateDir . DIRECTORY_SEPARATOR . 'image-label-aliases.json';
$reviewPath = $privateDir . DIRECTORY_SEPARATOR . 'image-mapping-review.json';

$catalog = array(
    'generatedAt' => gmdate('c'),
    'sourceRoot' => iw_normalize_path($sourceReal),
    'labelsIndexFile' => iw_normalize_path((string)realpath($labelsIndex)),
    'stats' => array(
        'images' => count($images),
        'metadataFiles' => count($metadataFiles),
        'unknown' => (int)($labelCounts['primaryProduct']['unknown'] ?? 0),
    ),
    'primaryLabels' => array_keys($labelCounts['primaryProduct']),
    'images' => $images,
);
$aliases = array(
    'generatedAt' => gmdate('c'),
    'source' => iw_normalize_path((string)realpath($labelsIndex)),
    'policy' => 'Só são unidos automaticamente labels que diferem apenas em capitalização, acentos ou separadores. Os labels originais permanecem no catálogo.',
    'aliases' => iw_build_aliases($labelCounts),
);

$review = array('_meta' => array(
    'version' => 1,
    'lastKey' => '',
    'updatedAt' => gmdate('c'),
));
if (is_file($reviewPath)) {
    $existing = json_decode(iw_read_utf8($reviewPath), true);
    if (is_array($existing)) {
        $review = $existing;
        if (!isset($review['_meta']) || !is_array($review['_meta'])) {
            $review['_meta'] = array('version' => 1, 'lastKey' => '', 'updatedAt' => gmdate('c'));
        }
    }
}
iw_atomic_json($catalogPath, $catalog);
iw_atomic_json($aliasesPath, $aliases);
iw_atomic_json($reviewPath, $review);

echo 'Imagens indexadas: ' . count($images) . "\n";
echo 'TXT lidos: ' . count($metadataFiles) . "\n";
echo 'Labels principais: ' . implode(', ', array_keys($labelCounts['primaryProduct'])) . "\n";
echo 'Unknown: ' . (int)($labelCounts['primaryProduct']['unknown'] ?? 0) . "\n";
echo "Decisões do wizard: descobertas a partir dos locais por concluir na Galeria\n";
