<?php
/**
 * view-uploads.php — Visualizador de Ficheiros Enviados por Clientes
 *
 * Permite à administração ouvir gravações de áudio (molduras com onda sonora /
 * QR Code), ver fotografias e artes de personalização enviadas, e descarregar
 * anexos de pedidos em curso (tmp) ou concluídos (orders).
 *
 * Acesso protegido pela sessão administrativa miaandpaper_admin (admin-open.php).
 */

require_once __DIR__ . '/admin-open.php';

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
       . '<title>Acesso restrito · Mia &amp; Paper</title>'
       . '<style>body{font-family:Georgia,serif;max-width:560px;margin:60px auto;padding:0 20px;color:#3b2f1f;}h1{font-size:1.4rem;}a{color:#4f7a3a;font-weight:700;}</style>'
       . '<h1>Acesso restrito.</h1><p>Inicia sessão como administradora no <a href="index.html">site</a>.</p></html>';
    exit;
}

require_once __DIR__ . '/lib/private-paths.php';
require_once __DIR__ . '/lib/http-range.php';
require_once __DIR__ . '/lib/db.php';

$csrf = mp_admin_csrf_token();
$baseDir = mp_private_path('order-uploads');

// ── 1. Endpoint de streaming seguro ───────────────────────────────────────────
if (isset($_GET['action']) && $_GET['action'] === 'stream') {
    $token = isset($_GET['token']) ? strtolower(trim((string)$_GET['token'])) : '';
    if (!preg_match('/^[a-f0-9]{32,40}$/', $token)) {
        http_response_code(400);
        exit('Token inválido.');
    }

    $scope = isset($_GET['scope']) ? strtolower(trim((string)$_GET['scope'])) : 'tmp';
    if (!in_array($scope, array('tmp', 'orders', 'assisted'), true)) {
        $scope = 'tmp';
    }

    if ($baseDir === null || !is_dir($baseDir)) {
        http_response_code(404);
        exit('Pasta de uploads não encontrada.');
    }

    $filePath = null;
    $meta = null;

    if ($scope === 'tmp') {
        $tmpDir = $baseDir . DIRECTORY_SEPARATOR . 'tmp';
        $metaPath = $tmpDir . DIRECTORY_SEPARATOR . $token . '.json';
        if (is_file($metaPath)) {
            $meta = json_decode((string)@file_get_contents($metaPath), true);
        }
        $storedName = is_array($meta) && !empty($meta['stored_name']) ? basename((string)$meta['stored_name']) : '';
        if ($storedName !== '' && is_file($tmpDir . DIRECTORY_SEPARATOR . $storedName)) {
            $filePath = $tmpDir . DIRECTORY_SEPARATOR . $storedName;
        } else {
            $candidates = glob($tmpDir . DIRECTORY_SEPARATOR . $token . '.*');
            if (is_array($candidates)) {
                foreach ($candidates as $cand) {
                    if (substr($cand, -5) !== '.json' && is_file($cand)) {
                        $filePath = $cand;
                        break;
                    }
                }
            }
        }
    } elseif ($scope === 'orders') {
        $order = isset($_GET['order']) ? preg_replace('/[^A-Za-z0-9_-]/', '', (string)$_GET['order']) : '';
        if ($order !== '') {
            $orderDir = $baseDir . DIRECTORY_SEPARATOR . 'orders' . DIRECTORY_SEPARATOR . $order;
            $metaPath = $orderDir . DIRECTORY_SEPARATOR . $token . '.json';
            if (is_file($metaPath)) {
                $meta = json_decode((string)@file_get_contents($metaPath), true);
            }
            $candidates = glob($orderDir . DIRECTORY_SEPARATOR . $token . '.*');
            if (is_array($candidates)) {
                foreach ($candidates as $cand) {
                    if (substr($cand, -5) !== '.json' && is_file($cand)) {
                        $filePath = $cand;
                        break;
                    }
                }
            }
        }
    } elseif ($scope === 'assisted') {
        $ref = isset($_GET['ref']) ? preg_replace('/[^A-Za-z0-9_-]/', '', (string)$_GET['ref']) : '';
        if ($ref !== '') {
            $assistedDir = $baseDir . DIRECTORY_SEPARATOR . 'assisted' . DIRECTORY_SEPARATOR . $ref;
            $candidates = glob($assistedDir . DIRECTORY_SEPARATOR . $token . '.*');
            if (is_array($candidates)) {
                foreach ($candidates as $cand) {
                    if (is_file($cand)) {
                        $filePath = $cand;
                        break;
                    }
                }
            }
        }
    }

    if ($filePath === null || !is_file($filePath)) {
        http_response_code(404);
        exit('Ficheiro não encontrado.');
    }

    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    $allowedMimes = array(
        'webm' => 'audio/webm',
        'ogg'  => 'audio/ogg',
        'wav'  => 'audio/wav',
        'mp3'  => 'audio/mpeg',
        'm4a'  => 'audio/mp4',
        'mp4'  => 'audio/mp4',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png'  => 'image/png',
        'webp' => 'image/webp',
        'heic' => 'image/heic',
        'heif' => 'image/heif',
        'pdf'  => 'application/pdf',
    );
    $mime = isset($allowedMimes[$ext]) ? $allowedMimes[$ext] : 'application/octet-stream';
    if (is_array($meta) && !empty($meta['mime'])) {
        $mime = $meta['mime'];
    }

    $download = !empty($_GET['download']);
    $downloadName = is_array($meta) && !empty($meta['name'])
        ? basename(str_replace('\\', '/', (string)$meta['name']))
        : 'ficheiro-' . $token . '.' . $ext;
    $downloadName = preg_replace('/[\x00-\x1F\x7F"]+/', '', $downloadName);
    if ($downloadName === '') {
        $downloadName = 'ficheiro.' . $ext;
    }
    $fallbackName = preg_replace('/[^A-Za-z0-9._-]+/', '-', $downloadName);

    $fileSize = (int)filesize($filePath);
    $isPdf = $ext === 'pdf';
    $isInline = !$download && !$isPdf;
    $range = $isInline ? mp_http_byte_range(isset($_SERVER['HTTP_RANGE']) ? $_SERVER['HTTP_RANGE'] : '', $fileSize) : null;
    if ($range === false) {
        mp_http_reject_invalid_range($fileSize);
    }

    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    $start = $range === null ? 0 : $range[0];
    $end = $range === null ? max(0, $fileSize - 1) : $range[1];
    if ($range !== null) {
        http_response_code(206);
        header('Content-Range: bytes ' . $start . '-' . $end . '/' . $fileSize);
    }
    $length = max(0, $end - $start + 1);

    header('Content-Type: ' . $mime);
    header('Content-Length: ' . $length);
    header('Accept-Ranges: bytes');
    $disposition = $download ? 'attachment' : 'inline';
    header('Content-Disposition: ' . $disposition . '; filename="' . $fallbackName . '"; filename*=UTF-8\'\'' . rawurlencode($downloadName));
    header('Cache-Control: private, no-store, max-age=0');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    if ($isPdf) {
        header("Content-Security-Policy: sandbox; default-src 'none'");
        header('X-Frame-Options: DENY');
    }

    $handle = @fopen($filePath, 'rb');
    if ($handle === false) {
        http_response_code(500);
        exit('Erro ao ler ficheiro.');
    }
    fseek($handle, $start);
    $remaining = $length;
    while ($remaining > 0 && !feof($handle)) {
        $chunk = fread($handle, min(8192, $remaining));
        if ($chunk === false || $chunk === '') {
            break;
        }
        echo $chunk;
        $remaining -= strlen($chunk);
    }
    fclose($handle);
    exit;
}

// ── 2. Remoção de ficheiros temporários ───────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'delete') {
    $sentCsrf = isset($_POST['csrf']) ? (string)$_POST['csrf'] : '';
    if ($sentCsrf === '' || !hash_equals($csrf, $sentCsrf)) {
        http_response_code(403);
        exit('CSRF inválido.');
    }
    $delToken = isset($_POST['token']) ? strtolower(trim((string)$_POST['token'])) : '';
    if (preg_match('/^[a-f0-9]{32,40}$/', $delToken) && $baseDir !== null) {
        $tmpDir = $baseDir . DIRECTORY_SEPARATOR . 'tmp';
        if (is_dir($tmpDir)) {
            $metaPath = $tmpDir . DIRECTORY_SEPARATOR . $delToken . '.json';
            if (is_file($metaPath)) {
                $meta = json_decode((string)@file_get_contents($metaPath), true);
                if (is_array($meta) && !empty($meta['stored_name'])) {
                    $fn = basename((string)$meta['stored_name']);
                    if (strpos($fn, $delToken . '.') === 0) {
                        @unlink($tmpDir . DIRECTORY_SEPARATOR . $fn);
                    }
                }
                @unlink($metaPath);
            }
            $leftovers = glob($tmpDir . DIRECTORY_SEPARATOR . $delToken . '.*');
            if (is_array($leftovers)) {
                foreach ($leftovers as $f) {
                    @unlink($f);
                }
            }
        }
    }
    header('Location: view-uploads.php');
    exit;
}

// ── 3. Leitura e agregação de todos os ficheiros ──────────────────────────────
function vu_format_bytes($bytes) {
    $bytes = (int)$bytes;
    if ($bytes <= 0) return '0 B';
    $units = array('B', 'KB', 'MB', 'GB');
    $i = 0;
    $v = (float)$bytes;
    while ($v >= 1024 && $i < count($units) - 1) {
        $v /= 1024;
        $i++;
    }
    return ($i === 0 ? $v : number_format($v, 1, ',', '')) . ' ' . $units[$i];
}

function vu_h($value) {
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

$items = array();
$totalBytes = 0;
$countAudio = 0;
$countImages = 0;
$countPdfs = 0;
$countTmp = 0;
$countOrders = 0;

if ($baseDir !== null && is_dir($baseDir)) {
    // 3.1. Ficheiros em tmp
    $tmpDir = $baseDir . DIRECTORY_SEPARATOR . 'tmp';
    if (is_dir($tmpDir)) {
        $entries = scandir($tmpDir);
        if ($entries !== false) {
            $seenTokens = array();
            foreach ($entries as $entry) {
                if ($entry === '.' || $entry === '..' || substr($entry, 0, 1) === '.') continue;
                $token = '';
                if (preg_match('/^([a-f0-9]{32,40})\.json$/', $entry, $m)) {
                    $token = $m[1];
                } elseif (preg_match('/^([a-f0-9]{32,40})\./', $entry, $m)) {
                    $token = $m[1];
                }
                if ($token === '' || isset($seenTokens[$token])) continue;
                $seenTokens[$token] = true;

                $metaFile = $tmpDir . DIRECTORY_SEPARATOR . $token . '.json';
                $meta = is_file($metaFile) ? json_decode((string)@file_get_contents($metaFile), true) : null;
                $storedName = is_array($meta) && !empty($meta['stored_name']) ? basename((string)$meta['stored_name']) : '';

                $mediaPath = null;
                if ($storedName !== '' && is_file($tmpDir . DIRECTORY_SEPARATOR . $storedName)) {
                    $mediaPath = $tmpDir . DIRECTORY_SEPARATOR . $storedName;
                } else {
                    $cands = glob($tmpDir . DIRECTORY_SEPARATOR . $token . '.*');
                    if (is_array($cands)) {
                        foreach ($cands as $c) {
                            if (substr($c, -5) !== '.json' && is_file($c)) {
                                $mediaPath = $c;
                                break;
                            }
                        }
                    }
                }

                if ($mediaPath === null && !is_file($metaFile)) continue;

                $size = $mediaPath ? (int)@filesize($mediaPath) : (isset($meta['size']) ? (int)$meta['size'] : 0);
                $ext = $mediaPath ? strtolower(pathinfo($mediaPath, PATHINFO_EXTENSION)) : (isset($meta['extension']) ? strtolower((string)$meta['extension']) : '');
                $mtime = $mediaPath ? (int)@filemtime($mediaPath) : (is_file($metaFile) ? (int)@filemtime($metaFile) : time());
                $createdTs = (is_array($meta) && !empty($meta['created_at'])) ? strtotime($meta['created_at']) : $mtime;

                $kind = is_array($meta) && !empty($meta['kind']) ? (string)$meta['kind'] : '';
                if ($kind === '') {
                    if (in_array($ext, array('webm', 'ogg', 'wav', 'mp3', 'm4a'), true)) $kind = 'audio';
                    elseif (in_array($ext, array('jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'), true)) $kind = 'photo';
                    elseif ($ext === 'pdf') $kind = 'pdf';
                    else $kind = 'ficheiro';
                }

                $items[] = array(
                    'token' => $token,
                    'name' => is_array($meta) && !empty($meta['name']) ? (string)$meta['name'] : ($storedName ?: $token . '.' . $ext),
                    'size' => $size,
                    'ext' => $ext,
                    'mime' => is_array($meta) && !empty($meta['mime']) ? (string)$meta['mime'] : '',
                    'kind' => $kind,
                    'width' => is_array($meta) && !empty($meta['width']) ? (int)$meta['width'] : 0,
                    'height' => is_array($meta) && !empty($meta['height']) ? (int)$meta['height'] : 0,
                    'dpi' => is_array($meta) && !empty($meta['dpi']) ? (int)$meta['dpi'] : 0,
                    'page' => is_array($meta) && !empty($meta['page']) ? (string)$meta['page'] : '',
                    'ip' => is_array($meta) && !empty($meta['ip']) ? (string)$meta['ip'] : '',
                    'scope' => 'tmp',
                    'order' => '',
                    'created_ts' => $createdTs,
                    'mtime' => $mtime,
                );

                $totalBytes += $size;
                $countTmp++;
                if ($kind === 'audio' || in_array($ext, array('webm', 'ogg', 'wav', 'mp3', 'm4a'), true)) $countAudio++;
                elseif ($kind === 'photo' || $kind === 'artwork' || in_array($ext, array('jpg', 'jpeg', 'png', 'webp'), true)) $countImages++;
                elseif ($ext === 'pdf') $countPdfs++;
            }
        }
    }

    // 3.2. Ficheiros em orders/
    $ordersDir = $baseDir . DIRECTORY_SEPARATOR . 'orders';
    if (is_dir($ordersDir)) {
        $orderFolders = scandir($ordersDir);
        if ($orderFolders !== false) {
            foreach ($orderFolders as $of) {
                if ($of === '.' || $of === '..' || substr($of, 0, 1) === '.') continue;
                $currentOrderDir = $ordersDir . DIRECTORY_SEPARATOR . $of;
                if (!is_dir($currentOrderDir)) continue;
                $ofiles = scandir($currentOrderDir);
                if ($ofiles === false) continue;
                $seenOrderTokens = array();
                foreach ($ofiles as $ofile) {
                    if ($ofile === '.' || $ofile === '..' || substr($ofile, 0, 1) === '.') continue;
                    $token = '';
                    if (preg_match('/^([a-f0-9]{32,40})\.json$/', $ofile, $m)) {
                        $token = $m[1];
                    } elseif (preg_match('/^([a-f0-9]{32,40})\./', $ofile, $m)) {
                        $token = $m[1];
                    }
                    if ($token === '' || isset($seenOrderTokens[$token])) continue;
                    $seenOrderTokens[$token] = true;

                    $metaFile = $currentOrderDir . DIRECTORY_SEPARATOR . $token . '.json';
                    $meta = is_file($metaFile) ? json_decode((string)@file_get_contents($metaFile), true) : null;
                    $storedName = is_array($meta) && !empty($meta['stored_name']) ? basename((string)$meta['stored_name']) : '';

                    $mediaPath = null;
                    if ($storedName !== '' && is_file($currentOrderDir . DIRECTORY_SEPARATOR . $storedName)) {
                        $mediaPath = $currentOrderDir . DIRECTORY_SEPARATOR . $storedName;
                    } else {
                        $cands = glob($currentOrderDir . DIRECTORY_SEPARATOR . $token . '.*');
                        if (is_array($cands)) {
                            foreach ($cands as $c) {
                                if (substr($c, -5) !== '.json' && is_file($c)) {
                                    $mediaPath = $c;
                                    break;
                                }
                            }
                        }
                    }

                    if ($mediaPath === null && !is_file($metaFile)) continue;

                    $size = $mediaPath ? (int)@filesize($mediaPath) : (isset($meta['size']) ? (int)$meta['size'] : 0);
                    $ext = $mediaPath ? strtolower(pathinfo($mediaPath, PATHINFO_EXTENSION)) : (isset($meta['extension']) ? strtolower((string)$meta['extension']) : '');
                    $mtime = $mediaPath ? (int)@filemtime($mediaPath) : (is_file($metaFile) ? (int)@filemtime($metaFile) : time());
                    $createdTs = (is_array($meta) && !empty($meta['created_at'])) ? strtotime($meta['created_at']) : $mtime;
                    $kind = is_array($meta) && !empty($meta['kind']) ? (string)$meta['kind'] : '';
                    if ($kind === '') {
                        if (in_array($ext, array('webm', 'ogg', 'wav', 'mp3', 'm4a'), true)) $kind = 'audio';
                        elseif (in_array($ext, array('jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'), true)) $kind = 'photo';
                        elseif ($ext === 'pdf') $kind = 'pdf';
                        else $kind = 'ficheiro';
                    }

                    $items[] = array(
                        'token' => $token,
                        'name' => is_array($meta) && !empty($meta['name']) ? (string)$meta['name'] : ($storedName ?: $token . '.' . $ext),
                        'size' => $size,
                        'ext' => $ext,
                        'mime' => is_array($meta) && !empty($meta['mime']) ? (string)$meta['mime'] : '',
                        'kind' => $kind,
                        'width' => is_array($meta) && !empty($meta['width']) ? (int)$meta['width'] : 0,
                        'height' => is_array($meta) && !empty($meta['height']) ? (int)$meta['height'] : 0,
                        'dpi' => is_array($meta) && !empty($meta['dpi']) ? (int)$meta['dpi'] : 0,
                        'page' => is_array($meta) && !empty($meta['page']) ? (string)$meta['page'] : '',
                        'ip' => is_array($meta) && !empty($meta['ip']) ? (string)$meta['ip'] : '',
                        'scope' => 'orders',
                        'order' => $of,
                        'created_ts' => $createdTs,
                        'mtime' => $mtime,
                    );

                    $totalBytes += $size;
                    $countOrders++;
                    if ($kind === 'audio' || in_array($ext, array('webm', 'ogg', 'wav', 'mp3', 'm4a'), true)) $countAudio++;
                    elseif ($kind === 'photo' || $kind === 'artwork' || in_array($ext, array('jpg', 'jpeg', 'png', 'webp'), true)) $countImages++;
                    elseif ($ext === 'pdf') $countPdfs++;
                }
            }
        }
    }
}

// Ordenar do mais recente para o mais antigo
usort($items, function ($a, $b) {
    return $b['created_ts'] <=> $a['created_ts'];
});

$highlightToken = isset($_GET['token']) ? strtolower(trim((string)$_GET['token'])) : '';
?>
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ficheiros enviados por clientes · Mia &amp; Paper</title>
  <link rel="icon" href="content/brand/logo.webp" type="image/webp">
  <link rel="stylesheet" href="css/01-tokens-agua.css?v=20260907233709">
  <link rel="stylesheet" href="admin-nav.css?v=20260907233709">
  <script src="admin-nav.js?v=20260907233709" defer></script>
  <style>
    :root {
      --paper: #f7f1e3;
      --card: #fffdf8;
      --ink: #30291e;
      --muted: #746a59;
      --line: #d9ccb2;
      --moss: #4f7a3a;
      --moss-light: #f0f5ed;
      --gold: #b88616;
      --gold-light: #fbf6ea;
      --rust: #9e3d22;
      --rust-light: #fcf1ee;
      --shadow: 0 8px 24px rgba(75, 54, 18, 0.07);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--paper);
      color: var(--ink);
      font: 16px/1.45 Georgia, serif;
      -webkit-font-smoothing: antialiased;
    }
    main {
      width: min(1180px, calc(100% - 32px));
      margin: 28px auto 80px;
    }
    .page-head {
      margin-bottom: 24px;
    }
    .eyebrow {
      margin: 0 0 4px;
      font-size: 0.85rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--moss);
      font-weight: 700;
    }
    h1 {
      margin: 0 0 6px;
      font-size: clamp(1.6rem, 3.5vw, 2.3rem);
      font-weight: 700;
    }
    .lead {
      margin: 0;
      color: var(--muted);
      font-size: 1.02rem;
    }

    /* Resumo / Métricas */
    .metrics-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
      margin: 20px 0 28px;
    }
    .metric-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 14px 18px;
      box-shadow: var(--shadow);
    }
    .metric-label {
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .metric-value {
      font-size: 1.55rem;
      font-weight: 700;
      color: var(--ink);
      font-family: ui-monospace, monospace;
    }
    .metric-sub {
      font-size: 0.82rem;
      color: var(--muted);
      margin-top: 2px;
    }

    /* Barra de filtros e pesquisa */
    .controls-panel {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 14px 18px;
      margin-bottom: 24px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      box-shadow: var(--shadow);
    }
    .search-box {
      flex: 1 1 280px;
      position: relative;
    }
    .search-box input {
      width: 100%;
      height: 42px;
      padding: 8px 14px 8px 36px;
      border: 1px solid var(--line);
      border-radius: 9px;
      font: inherit;
      background: #fff;
      color: var(--ink);
    }
    .search-box input:focus {
      outline: 2px solid var(--moss);
      border-color: var(--moss);
    }
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--muted);
      pointer-events: none;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .filter-chip {
      padding: 8px 14px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: #fff;
      color: var(--muted);
      font: 700 0.85rem Georgia, serif;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .filter-chip:hover {
      border-color: var(--moss);
      color: var(--moss);
    }
    .filter-chip.is-active {
      background: var(--moss);
      border-color: var(--moss);
      color: #fff;
    }

    /* Grelha de ficheiros */
    .files-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 18px;
    }
    .file-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 18px;
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: relative;
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    .file-card:hover {
      border-color: var(--moss);
    }
    .file-card.is-highlighted {
      border: 2px solid var(--gold);
      box-shadow: 0 0 0 4px rgba(184, 134, 22, 0.2);
      animation: pulseHighlight 2s ease 3;
    }
    @keyframes pulseHighlight {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 6px;
      font: 700 0.76rem ui-monospace, monospace;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge-audio { background: #e8f0fe; color: #1a73e8; }
    .badge-photo { background: #e6f4ea; color: #137333; }
    .badge-pdf { background: #fce8e6; color: #c5221f; }
    .badge-tmp { background: var(--gold-light); color: var(--gold); border: 1px solid rgba(184, 134, 22, 0.3); }
    .badge-order { background: var(--moss-light); color: var(--moss); border: 1px solid rgba(79, 122, 58, 0.3); }
    .badge-assisted { background: #f3e8fd; color: #7627bb; }

    .file-time {
      font-size: 0.8rem;
      color: var(--muted);
      white-space: nowrap;
    }

    .file-name {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      word-break: break-word;
      line-height: 1.35;
      color: var(--ink);
    }

    /* Reprodutor / Pré-visualização */
    .player-box {
      background: #fbf9f4;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    audio {
      width: 100%;
      height: 40px;
      border-radius: 8px;
    }
    .image-preview-wrap {
      position: relative;
      border-radius: 10px;
      overflow: hidden;
      background: #f0ebe0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      max-height: 240px;
      border: 1px solid var(--line);
    }
    .image-preview-wrap img {
      width: 100%;
      height: auto;
      max-height: 240px;
      object-fit: contain;
      display: block;
      transition: transform 0.2s ease;
    }
    .image-preview-wrap:hover img {
      transform: scale(1.03);
    }
    .image-zoom-hint {
      position: absolute;
      bottom: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.65);
      color: #fff;
      font-size: 0.72rem;
      padding: 3px 7px;
      border-radius: 4px;
      backdrop-filter: blur(4px);
    }
    .pdf-preview {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #fff;
      border: 1px dashed var(--line);
      border-radius: 10px;
      padding: 14px;
    }
    .pdf-icon {
      font-size: 2rem;
    }

    /* Metadados */
    .file-meta {
      font-size: 0.85rem;
      color: var(--muted);
      display: grid;
      gap: 4px;
      margin: 0;
    }
    .file-meta strong {
      color: var(--ink);
    }
    .token-line {
      font-family: ui-monospace, monospace;
      font-size: 0.75rem;
      color: #8c8272;
      word-break: break-all;
    }

    /* Ações */
    .card-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: auto;
      padding-top: 10px;
      border-top: 1px solid #f0e6d6;
    }
    .btn-download {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border: 1px solid var(--moss);
      border-radius: 8px;
      background: var(--moss-light);
      color: var(--moss);
      text-decoration: none;
      font: 700 0.85rem Georgia, serif;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .btn-download:hover {
      background: var(--moss);
      color: #fff;
    }
    .btn-delete {
      padding: 7px 11px;
      border: 1px solid #e0c8c0;
      border-radius: 8px;
      background: #fff;
      color: var(--rust);
      font: 700 0.82rem Georgia, serif;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-delete:hover {
      background: var(--rust);
      border-color: var(--rust);
      color: #fff;
    }

    /* Modal / Lightbox para imagens */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(20, 16, 12, 0.85);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }
    .modal-backdrop.is-open {
      opacity: 1;
      pointer-events: auto;
    }
    .modal-content {
      position: relative;
      max-width: 90vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .modal-content img {
      max-width: 100%;
      max-height: 84vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }
    .modal-caption {
      color: #f7f1e3;
      margin-top: 10px;
      font-size: 0.95rem;
      text-align: center;
    }
    .modal-close {
      position: absolute;
      top: -38px;
      right: 0;
      background: none;
      border: none;
      color: #fff;
      font-size: 2rem;
      cursor: pointer;
      line-height: 1;
      padding: 4px 8px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      border: 2px dashed var(--line);
      border-radius: 16px;
      background: var(--card);
      color: var(--muted);
      grid-column: 1 / -1;
    }
    .empty-state p { margin: 8px 0 0; }

    @media (max-width: 680px) {
      .controls-panel { flex-direction: column; align-items: stretch; }
      .search-box { width: 100%; }
      .filters { width: 100%; }
      .files-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
<main>
  <div class="page-head">
    <p class="eyebrow">Mia &amp; Paper · Administração</p>
    <h1>Ficheiros enviados por clientes</h1>
    <p class="lead">Mensagens de voz, fotografias, artes de personalização e anexos recebidos pelo site.</p>
  </div>

  <section class="metrics-bar" aria-label="Métricas de uploads">
    <div class="metric-card">
      <div class="metric-label">Total de Ficheiros</div>
      <div class="metric-value"><?= count($items) ?></div>
      <div class="metric-sub"><?= vu_format_bytes($totalBytes) ?> ocupados</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Gravações de Áudio</div>
      <div class="metric-value"><?= $countAudio ?></div>
      <div class="metric-sub">Mensagens de voz</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Fotografias &amp; Artes</div>
      <div class="metric-value"><?= $countImages ?></div>
      <div class="metric-sub">Imagens recebidas</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Em aberto (tmp)</div>
      <div class="metric-value"><?= $countTmp ?></div>
      <div class="metric-sub"><?= $countOrders ?> em encomendas</div>
    </div>
  </section>

  <div class="controls-panel">
    <div class="search-box">
      <span class="search-icon" aria-hidden="true">🔍</span>
      <input type="search" id="searchInput" placeholder="Procurar por nome, token, data ou IP…" aria-label="Procurar ficheiros">
    </div>
    <div class="filters" role="group" aria-label="Filtrar por tipo">
      <button type="button" class="filter-chip is-active" data-filter="all">Todos (<?= count($items) ?>)</button>
      <button type="button" class="filter-chip" data-filter="audio">🎙️ Áudios (<?= $countAudio ?>)</button>
      <button type="button" class="filter-chip" data-filter="photo">🖼️ Imagens (<?= $countImages ?>)</button>
      <button type="button" class="filter-chip" data-filter="pdf">📄 PDFs (<?= $countPdfs ?>)</button>
      <button type="button" class="filter-chip" data-filter="tmp">⏳ Em aberto (<?= $countTmp ?>)</button>
      <button type="button" class="filter-chip" data-filter="orders">✅ Encomendas (<?= $countOrders ?>)</button>
    </div>
  </div>

  <div class="files-grid" id="filesGrid">
    <?php if (empty($items)): ?>
      <div class="empty-state">
        <strong>Ainda não foram recebidos ficheiros de clientes.</strong>
        <p>Quando alguém gravar um áudio numa moldura ou enviar uma fotografia na personalização, ela aparece aqui imediatamente.</p>
      </div>
    <?php endif; ?>

    <?php foreach ($items as $item): ?>
      <?php
        $isAudio = in_array($item['ext'], array('webm', 'ogg', 'wav', 'mp3', 'm4a'), true) || $item['kind'] === 'audio';
        $isImage = in_array($item['ext'], array('jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'), true) || $item['kind'] === 'photo' || $item['kind'] === 'artwork';
        $isPdf = $item['ext'] === 'pdf';

        $streamUrl = 'view-uploads.php?action=stream&amp;scope=' . rawurlencode($item['scope']) . '&amp;token=' . rawurlencode($item['token']);
        if ($item['scope'] === 'orders' && $item['order'] !== '') {
            $streamUrl .= '&amp;order=' . rawurlencode($item['order']);
        }
        $downloadUrl = $streamUrl . '&amp;download=1';

        $highlight = ($highlightToken !== '' && $highlightToken === $item['token']);
        $filterTags = array('all');
        if ($isAudio) $filterTags[] = 'audio';
        if ($isImage) $filterTags[] = 'photo';
        if ($isPdf) $filterTags[] = 'pdf';
        $filterTags[] = $item['scope'];
      ?>
      <article class="file-card <?= $highlight ? 'is-highlighted' : '' ?>"
               id="file-<?= vu_h($item['token']) ?>"
               data-filter-tags="<?= vu_h(implode(' ', $filterTags)) ?>"
               data-search-text="<?= vu_h(strtolower($item['name'] . ' ' . $item['token'] . ' ' . $item['page'] . ' ' . $item['ip'] . ' ' . $item['order'] . ' ' . date('d/m/Y H:i', $item['created_ts']))) ?>">

        <div class="card-top">
          <div class="badges">
            <?php if ($isAudio): ?>
              <span class="badge badge-audio">🎙️ Áudio</span>
            <?php elseif ($isImage): ?>
              <span class="badge badge-photo">🖼️ Imagem</span>
            <?php elseif ($isPdf): ?>
              <span class="badge badge-pdf">📄 PDF</span>
            <?php else: ?>
              <span class="badge"><?= vu_h(strtoupper($item['ext'])) ?></span>
            <?php endif; ?>

            <?php if ($item['scope'] === 'tmp'): ?>
              <span class="badge badge-tmp" title="Ficheiro em carrinho ou configuração. Fica guardado até decidires remover.">⏳ Em aberto (tmp)</span>
            <?php elseif ($item['scope'] === 'orders'): ?>
              <span class="badge badge-order" title="Ficheiro associado a encomenda concluída">✅ Encomenda <?= vu_h($item['order']) ?></span>
            <?php elseif ($item['scope'] === 'assisted'): ?>
              <span class="badge badge-assisted">🤝 Upload assistido</span>
            <?php endif; ?>
          </div>
          <time class="file-time" datetime="<?= gmdate('c', $item['created_ts']) ?>"><?= date('d/m/Y H:i', $item['created_ts']) ?></time>
        </div>

        <h2 class="file-name" title="<?= vu_h($item['name']) ?>"><?= vu_h($item['name']) ?></h2>

        <?php if ($isAudio): ?>
          <div class="player-box">
            <audio controls preload="none" src="<?= $streamUrl ?>"></audio>
            <div style="font-size:0.75rem; color:var(--muted); text-align:right;">Formato: <?= vu_h($item['ext']) ?> · <?= vu_format_bytes($item['size']) ?></div>
          </div>
        <?php elseif ($isImage): ?>
          <div class="image-preview-wrap" onclick="openLightbox('<?= $streamUrl ?>', '<?= vu_h(addslashes($item['name'])) ?>')">
            <img src="<?= $streamUrl ?>" loading="lazy" alt="<?= vu_h($item['name']) ?>">
            <span class="image-zoom-hint">🔍 Clica para ampliar</span>
          </div>
        <?php elseif ($isPdf): ?>
          <div class="pdf-preview">
            <span class="pdf-icon" aria-hidden="true">📄</span>
            <div>
              <strong>Documento PDF</strong>
              <div style="font-size:0.8rem; color:var(--muted);"><?= vu_format_bytes($item['size']) ?></div>
            </div>
          </div>
        <?php endif; ?>

        <dl class="file-meta">
          <div><strong>Tamanho:</strong> <?= vu_format_bytes($item['size']) ?>
            <?php if ($item['width'] > 0 && $item['height'] > 0): ?>
              · <?= $item['width'] ?>×<?= $item['height'] ?> px
              <?php if ($item['dpi'] > 0): ?>(~<?= $item['dpi'] ?> dpi)<?php endif; ?>
            <?php endif; ?>
          </div>
          <?php if ($item['page'] !== ''): ?>
            <div><strong>Página:</strong> <?= vu_h($item['page']) ?></div>
          <?php endif; ?>
          <?php if ($item['ip'] !== ''): ?>
            <div><strong>IP:</strong> <?= vu_h($item['ip']) ?></div>
          <?php endif; ?>
          <div class="token-line"><strong>Token:</strong> <?= vu_h($item['token']) ?></div>
        </dl>

        <div class="card-actions">
          <a href="<?= $downloadUrl ?>" download class="btn-download" title="Descarregar ficheiro original">
            <span>⬇️ Descarregar</span>
          </a>

          <?php if ($item['scope'] === 'orders' && $item['order'] !== ''): ?>
            <a href="admin-orders.php?view=list&amp;q=<?= rawurlencode($item['order']) ?>" style="font-size:0.85rem; color:var(--moss); font-weight:700;">Ver Encomenda &rarr;</a>
          <?php elseif ($item['scope'] === 'tmp'): ?>
            <form method="post" onsubmit="return confirm('Tens a certeza que queres eliminar este ficheiro temporário do disco?');" style="margin:0;">
              <input type="hidden" name="csrf" value="<?= vu_h($csrf) ?>">
              <input type="hidden" name="action" value="delete">
              <input type="hidden" name="token" value="<?= vu_h($item['token']) ?>">
              <button type="submit" class="btn-delete" title="Eliminar ficheiro temporário para libertar espaço">Eliminar</button>
            </form>
          <?php endif; ?>
        </div>

      </article>
    <?php endforeach; ?>
  </div>
</main>

<!-- Modal Lightbox para Imagens -->
<div id="imageLightbox" class="modal-backdrop" onclick="closeLightbox(event)" aria-hidden="true" role="dialog">
  <div class="modal-content" onclick="event.stopPropagation()">
    <button class="modal-close" onclick="closeLightbox()" aria-label="Fechar ampliação">&times;</button>
    <img id="lightboxImg" src="" alt="Imagem ampliada">
    <div id="lightboxCaption" class="modal-caption"></div>
  </div>
</div>

<script>
(function () {
  "use strict";

  // Pesquisa instantânea e filtros
  var searchInput = document.getElementById("searchInput");
  var filterChips = document.querySelectorAll(".filter-chip");
  var cards = document.querySelectorAll(".file-card");
  var currentFilter = "all";

  function applyFilters() {
    var query = (searchInput.value || "").trim().toLowerCase();
    cards.forEach(function (card) {
      var tags = (card.dataset.filterTags || "").split(" ");
      var text = card.dataset.searchText || "";
      var matchFilter = (currentFilter === "all" || tags.indexOf(currentFilter) !== -1);
      var matchSearch = (!query || text.indexOf(query) !== -1);
      if (matchFilter && matchSearch) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }

  filterChips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      filterChips.forEach(function (c) { c.classList.remove("is-active"); });
      chip.classList.add("is-active");
      currentFilter = chip.dataset.filter;
      applyFilters();
    });
  });

  // Lightbox
  var modal = document.getElementById("imageLightbox");
  var modalImg = document.getElementById("lightboxImg");
  var modalCap = document.getElementById("lightboxCaption");

  window.openLightbox = function (src, name) {
    modalImg.src = src;
    modalCap.textContent = name;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  };

  window.closeLightbox = function () {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    modalImg.src = "";
  };

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.classList.contains("is-open")) {
      closeLightbox();
    }
  });

  // Scroll automático se houver token destacado
  var highlighted = document.querySelector(".file-card.is-highlighted");
  if (highlighted) {
    setTimeout(function () {
      highlighted.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
  }
})();
</script>
</body>
</html>