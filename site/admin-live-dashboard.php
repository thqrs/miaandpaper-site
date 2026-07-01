<?php
/**
 * admin-live-dashboard.php — LIVE_REPLAY_DASHBOARD_V1
 *
 * Página admin dedicada a visualização "live + replay" do funil. Complementa
 * o admin-funnel.php (que é o relatório denso): aqui o foco é
 *  - sessões recentes em cards
 *  - timeline replay por sessão (ordenada por timestamp_ms / client_event_index)
 *  - "campo do funil" — pequenas bolinhas com o passo actual de cada sessão
 *  - galeria de interesse (ampliações / escolhas / abandonos / compras)
 *  - mapa de visitantes (reutiliza cache do admin-funnel.php)
 *  - lista de ficheiros JSONL por dia + range picker
 *
 * Sem novas regras de segurança: usa o mesmo session check de admin-funnel.php.
 */

session_start();

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
        . '<title>Acesso negado · Live Dashboard</title>'
        . '<style>body{font-family:Georgia,serif;max-width:560px;margin:60px auto;padding:0 20px;color:#3b2f1f;}h1{font-size:1.4rem;}a{color:#4f7a3a;font-weight:700;}</style>'
        . '<h1>Acesso restrito.</h1>'
        . '<p>Inicia sessão como administradora a partir de <a href="index.html">index.html</a> e regressa a esta página.</p>';
    exit;
}

require_once __DIR__ . '/lib/db.php';

function lr_h($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }

// ------------------------------------------------------------------
// Date range / period selection
// ------------------------------------------------------------------
$period = isset($_GET['period']) ? (string)$_GET['period'] : 'today';
$periodLabels = array(
    'today'  => 'hoje',
    'yesterday' => 'ontem',
    '7d'     => 'últimos 7 dias',
    '30d'    => 'últimos 30 dias',
    '90d'    => 'últimos 90 dias',
    'custom' => 'intervalo personalizado',
);
if (!isset($periodLabels[$period])) $period = 'today';

$todayUtc = gmdate('Y-m-d');
$yesterdayUtc = gmdate('Y-m-d', time() - 86400);
$customStart = isset($_GET['start']) ? (string)$_GET['start'] : '';
$customEnd = isset($_GET['end']) ? (string)$_GET['end'] : '';
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $customStart)) $customStart = $todayUtc;
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $customEnd)) $customEnd = $todayUtc;

switch ($period) {
    case 'today':     $startDate = $todayUtc; $endDate = $todayUtc; break;
    case 'yesterday': $startDate = $yesterdayUtc; $endDate = $yesterdayUtc; break;
    case '7d':        $startDate = gmdate('Y-m-d', time() - 7 * 86400); $endDate = $todayUtc; break;
    case '30d':       $startDate = gmdate('Y-m-d', time() - 30 * 86400); $endDate = $todayUtc; break;
    case '90d':       $startDate = gmdate('Y-m-d', time() - 90 * 86400); $endDate = $todayUtc; break;
    case 'custom':    $startDate = $customStart; $endDate = $customEnd; break;
    default:          $startDate = $todayUtc; $endDate = $todayUtc; break;
}

$cutoffStartIso = $startDate . 'T00:00:00Z';
$cutoffEndIso   = $endDate . 'T23:59:59Z';

// ------------------------------------------------------------------
// Load events from SQLite (primary) for the range
// ------------------------------------------------------------------
$pdo = mp_db();
$stmt = $pdo->prepare("SELECT * FROM funnel_events WHERE created_at >= ? AND created_at <= ? ORDER BY created_at ASC LIMIT 50000");
$stmt->execute(array($cutoffStartIso, $cutoffEndIso));
$events = $stmt->fetchAll();

$offerDownloads = array();
$offerDownloadsByFile = array();
$offerDownloadsBySession = array();
foreach ($events as $eventRow) {
    $download = lr_offer_download_from_event($eventRow);
    if (!$download) continue;

    $offerDownloads[] = $download;
    $key = $download['download_key'];
    if (!isset($offerDownloadsByFile[$key])) {
        $offerDownloadsByFile[$key] = array(
            'download_key' => $key,
            'download_label' => $download['download_label'],
            'download_file' => $download['download_file'],
            'download_kind' => $download['download_kind'],
            'download_size' => $download['download_size'],
            'product_label' => $download['product_label'],
            'count' => 0,
            'sessions' => array(),
            'visitors' => array(),
            'last_at' => '',
        );
    }
    $offerDownloadsByFile[$key]['count']++;
    if ($download['session_id'] !== '') $offerDownloadsByFile[$key]['sessions'][$download['session_id']] = true;
    if ($download['ip_number'] !== '') $offerDownloadsByFile[$key]['visitors'][$download['ip_number']] = true;
    if ($offerDownloadsByFile[$key]['last_at'] === '' || strcmp($download['created_at'], $offerDownloadsByFile[$key]['last_at']) > 0) {
        $offerDownloadsByFile[$key]['last_at'] = $download['created_at'];
    }
}
usort($offerDownloads, function ($a, $b) {
    return strcmp($b['created_at'], $a['created_at']);
});
uasort($offerDownloadsByFile, function ($a, $b) {
    if ($a['count'] === $b['count']) return strcmp($b['last_at'], $a['last_at']);
    return $b['count'] - $a['count'];
});
foreach ($offerDownloads as $download) {
    if ($download['session_id'] === '') continue;
    if (!isset($offerDownloadsBySession[$download['session_id']])) $offerDownloadsBySession[$download['session_id']] = array();
    $offerDownloadsBySession[$download['session_id']][] = $download;
}
$offerDownloadTotal = count($offerDownloads);
$offerDownloadSessionsCount = count($offerDownloadsBySession);
$offerDownloadAllCount = 0;
$offerDownloadSingleCount = 0;
foreach ($offerDownloads as $download) {
    if ($download['download_kind'] === 'all') $offerDownloadAllCount++;
    else $offerDownloadSingleCount++;
}

// Optional: which JSONL files cover this range (info-only)
$jsonlFiles = mp_funnel_jsonl_files_for_range($startDate, $endDate);
$jsonlAll = mp_funnel_jsonl_list_files();

// ------------------------------------------------------------------
// Product catalog (reuse helpers from admin-funnel via mini duplication
// — admin-funnel.php has the canonical version)
// ------------------------------------------------------------------
function lr_image_basename($path) {
    $path = (string)$path;
    if ($path === '') return '';
    $name = basename(strtok($path, '?'));
    $dot = strrpos($name, '.');
    if ($dot !== false) $name = substr($name, 0, $dot);
    return $name;
}
function lr_safe_image_path($path) {
    $path = (string)$path;
    if ($path === '') return '';
    if (preg_match('#^[a-z][a-z0-9+.-]*://#i', $path)) return '';
    if (strpos($path, '..') !== false) return '';
    if (strlen($path) > 0 && ($path[0] === '/' || $path[0] === '\\')) return '';
    if (preg_match('#^[A-Za-z]:[\\\\/]#', $path)) return '';
    return $path;
}
function lr_build_catalog($productDir) {
    $catalog = array();
    if (!is_dir($productDir)) return $catalog;
    foreach (glob($productDir . '/*.json') as $jsonPath) {
        $slug = basename($jsonPath, '.json');
        $raw = @file_get_contents($jsonPath);
        if ($raw === false) continue;
        $cfg = json_decode($raw, true);
        if (!is_array($cfg)) continue;
        $entry = array('name' => $cfg['name'] ?? $slug, 'by_value' => array(), 'by_basename' => array());
        foreach (($cfg['steps'] ?? array()) as $step) {
            $stepId = $step['id'] ?? '';
            foreach (($step['items'] ?? array()) as $it) {
                if (!is_array($it)) continue;
                $value = isset($it['value']) ? (string)$it['value'] : (isset($it['id']) ? (string)$it['id'] : '');
                $id    = isset($it['id']) ? (string)$it['id'] : $value;
                $title = isset($it['title']) ? (string)$it['title'] : $value;
                $image = isset($it['image']) ? (string)$it['image'] : '';
                $slot  = 'main';
                if ($stepId === 'lamination') $slot = 'lamination_example';
                elseif ($stepId === 'pack') $slot = 'pack';
                elseif ($stepId === 'cover_personalization') $slot = 'cover';
                elseif ($stepId === 'designs') {
                    $lc = strtolower($image);
                    $slot = (strpos($lc, 'capa') !== false) ? 'cover' : 'main';
                }
                $rec = array(
                    'product_slug' => $slug, 'product_name' => $entry['name'],
                    'step_id' => $stepId, 'value' => $value, 'id' => $id,
                    'title' => $title, 'image' => $image, 'slot' => $slot,
                );
                if ($value !== '') $entry['by_value'][$value] = $rec;
                if ($id !== '' && !isset($entry['by_value'][$id])) $entry['by_value'][$id] = $rec;
                $bn = lr_image_basename($image);
                if ($bn !== '' && !isset($entry['by_basename'][$bn])) $entry['by_basename'][$bn] = $rec;
                // nested image slots
                foreach (array('interiorImages' => 'interior', 'laminationImages' => 'lamination_example', 'purchaseOptionImages' => 'pack') as $k => $altSlot) {
                    if (empty($it[$k]) || !is_array($it[$k])) continue;
                    foreach ($it[$k] as $im) {
                        $p = is_string($im) ? $im : (isset($im['image']) ? (string)$im['image'] : '');
                        if ($p === '') continue;
                        $bn2 = lr_image_basename($p);
                        if ($bn2 === '' || isset($entry['by_basename'][$bn2])) continue;
                        $alt = $rec; $alt['image'] = $p; $alt['slot'] = $altSlot;
                        $entry['by_basename'][$bn2] = $alt;
                    }
                }
            }
        }
        $catalog[$slug] = $entry;
    }
    return $catalog;
}
function lr_catalog_lookup($catalog, $slug, $ident) {
    if (!$slug || !$ident || !isset($catalog[$slug])) return null;
    $p = $catalog[$slug];
    if (isset($p['by_value'][$ident])) return $p['by_value'][$ident];
    if (isset($p['by_basename'][$ident])) return $p['by_basename'][$ident];
    $lc = strtolower($ident);
    foreach ($p['by_value'] as $k => $r) if (strtolower($k) === $lc) return $r;
    foreach ($p['by_basename'] as $k => $r) if (strtolower($k) === $lc) return $r;
    return null;
}
function lr_thumb($path, $alt = '', $size = 64) {
    $safe = lr_safe_image_path($path);
    if ($safe === '') return '<div class="lr-thumb lr-thumb-ph" aria-hidden="true">?</div>';
    return '<div class="lr-thumb"><img loading="lazy" src="' . lr_h($safe) . '" alt="' . lr_h($alt) . '" width="' . (int)$size . '" height="' . (int)$size . '"></div>';
}
$catalog = lr_build_catalog(__DIR__ . '/content/products');

function lr_product_friendly_name($slug) {
    static $m = array('crachas'=>'Crachás','imanes'=>'Ímanes','caderninhos'=>'Mini-Cadernos','cadernos'=>'Cadernos','lembrancas'=>'Lembranças','pins'=>'Pins','ofertas'=>'Ofertas','oferta-pdf'=>'PDF de oferta','oferta-convite-congresso'=>'Envelopes do Congresso');
    return isset($m[$slug]) ? $m[$slug] : ($slug ?: '—');
}
function lr_offer_download_from_event($event)
{
    $name = isset($event['event_name']) ? (string)$event['event_name'] : '';
    if ($name !== 'offer_pdf_download_clicked') return null;

    $extra = mp_safe_json_decode(isset($event['event_json']) ? $event['event_json'] : '', array());
    if (!is_array($extra)) $extra = array();
    $selection = mp_safe_json_decode(isset($event['selection_json']) ? $event['selection_json'] : '', array());
    if (!is_array($selection)) $selection = array();
    $selectionDownload = isset($selection['download']) && is_array($selection['download']) ? $selection['download'] : array();

    $productSlug = isset($event['product_slug']) ? (string)$event['product_slug'] : '';
    $downloadLabel = isset($extra['download_label']) ? (string)$extra['download_label'] : '';
    if ($downloadLabel === '' && isset($extra['target_label'])) $downloadLabel = (string)$extra['target_label'];
    if ($downloadLabel === '' && isset($selectionDownload['label'])) $downloadLabel = (string)$selectionDownload['label'];
    if ($downloadLabel === '') $downloadLabel = 'PDF';

    $downloadFile = isset($extra['download_file']) ? (string)$extra['download_file'] : '';
    if ($downloadFile === '' && isset($selectionDownload['file'])) $downloadFile = (string)$selectionDownload['file'];
    if ($downloadFile === '' && isset($extra['target_id'])) $downloadFile = basename((string)$extra['target_id']);

    $downloadId = isset($extra['download_id']) ? (string)$extra['download_id'] : '';
    if ($downloadId === '' && isset($selectionDownload['id'])) $downloadId = (string)$selectionDownload['id'];
    if ($downloadId === '') $downloadId = $downloadFile !== '' ? $downloadFile : $downloadLabel;

    $downloadKind = isset($extra['download_kind']) ? (string)$extra['download_kind'] : '';
    if ($downloadKind === '' && isset($selectionDownload['kind'])) $downloadKind = (string)$selectionDownload['kind'];
    if ($downloadKind === '') $downloadKind = stripos($downloadId . ' ' . $downloadLabel, 'todo') !== false ? 'all' : 'single';

    $downloadSize = isset($extra['download_size']) ? (string)$extra['download_size'] : '';
    if ($downloadSize === '' && isset($selectionDownload['size'])) $downloadSize = (string)$selectionDownload['size'];

    $downloadUrl = isset($extra['download_url']) ? (string)$extra['download_url'] : '';
    if ($downloadUrl === '' && isset($selectionDownload['href'])) $downloadUrl = (string)$selectionDownload['href'];

    $downloadName = isset($extra['download_name']) ? (string)$extra['download_name'] : '';
    if ($downloadName === '' && isset($selectionDownload['download_name'])) $downloadName = (string)$selectionDownload['download_name'];

    $attribution = mp_attribution_classify(array(
        'utm_source' => isset($event['utm_source']) ? (string)$event['utm_source'] : (isset($extra['utm_source']) ? (string)$extra['utm_source'] : ''),
        'first_referrer' => isset($event['first_referrer']) ? (string)$event['first_referrer'] : (isset($extra['first_referrer']) ? (string)$extra['first_referrer'] : ''),
        'referrer' => isset($extra['referrer']) ? (string)$extra['referrer'] : '',
        'fbclid' => isset($extra['fbclid']) ? (string)$extra['fbclid'] : '',
        'gclid' => isset($extra['gclid']) ? (string)$extra['gclid'] : '',
    ));

    return array(
        'created_at' => isset($event['created_at']) ? (string)$event['created_at'] : '',
        'session_id' => isset($event['session_id']) ? (string)$event['session_id'] : '',
        'ip_number' => isset($event['ip_number']) ? (string)$event['ip_number'] : '',
        'visitor_label' => mp_visitor_label_for_ip(isset($event['ip_number']) ? (string)$event['ip_number'] : ''),
        'product_slug' => $productSlug,
        'product_label' => lr_product_friendly_name($productSlug),
        'step_id' => isset($event['step_id']) ? (string)$event['step_id'] : '',
        'device_type' => isset($event['device_type']) ? (string)$event['device_type'] : '',
        'viewport_width' => isset($event['viewport_width']) ? $event['viewport_width'] : null,
        'landing_page' => isset($extra['landing_page']) ? (string)$extra['landing_page'] : '',
        'download_id' => $downloadId,
        'download_key' => $downloadFile !== '' ? $downloadFile : $downloadId,
        'download_label' => $downloadLabel,
        'download_file' => $downloadFile,
        'download_kind' => $downloadKind,
        'download_size' => $downloadSize,
        'download_url' => $downloadUrl,
        'download_name' => $downloadName,
        'attribution' => $attribution,
    );
}
function lr_step_label($id) {
    static $l = array(
        'designs'=>'Escolheram designs','size'=>'Escolheram tamanho','pack'=>'Escolheram quantidade',
        'details'=>'Dados do cartão','delivery_contact'=>'Entrega e contacto','confirm'=>'Confirmação',
        'lamination'=>'Escolheram laminação','cover_personalization'=>'Personalização da capa',
        'ofertas'=>'Ofertas','oferta-pdf'=>'PDF de oferta','oferta-convite-congresso'=>'Envelopes do Congresso',
    );
    return isset($l[$id]) ? $l[$id] : ($id ?: '—');
}

// ------------------------------------------------------------------
// Aggregate by session, build:
//   $sessions: keyed by session_id with metadata + timeline (raw event refs)
//   $sessionsBySubmitted, $sessionsByActivity
//   $interest: keyed by product|type|value with counts
// ------------------------------------------------------------------
$sessions = array();
$submittedSessions = array();
$interest = array();
$sessionSelectedItems = array(); // sid => map(key => true)
foreach ($events as $idx => $e) {
    $sid = (string)($e['session_id'] ?? '');
    if ($sid === '') continue;
    $nm = (string)($e['event_name'] ?? '');
    $slug = (string)($e['product_slug'] ?? '');
    $stepId = (string)($e['step_id'] ?? '');
    $extra = json_decode((string)($e['event_json'] ?? '{}'), true);
    if (!is_array($extra)) $extra = array();
    $sel = json_decode((string)($e['selection_json'] ?? ''), true);
    if (!is_array($sel)) $sel = null;

    if (!isset($sessions[$sid])) {
        $sessions[$sid] = array(
            'session_id' => $sid,
            'first_at' => $e['created_at'],
            'last_at' => $e['created_at'],
            'ip' => (string)($e['ip_number'] ?? ''),
            'device_type' => (string)($e['device_type'] ?? ''),
            'viewport_width' => $e['viewport_width'] ?? null,
            'product_slug' => '',
            'step_id' => '',
            'event_count' => 0,
            'submitted' => false,
            'landing_page' => isset($extra['landing_page']) ? (string)$extra['landing_page'] : '',
            'referrer' => isset($extra['referrer']) ? (string)$extra['referrer'] : '',
            'first_referrer' => (string)($e['first_referrer'] ?? ''),
            'utm_source' => (string)($e['utm_source'] ?? ''),
            'referrer_type' => isset($extra['referrer_type']) ? (string)$extra['referrer_type'] : '',
            'external_referrer' => isset($extra['external_referrer']) ? (string)$extra['external_referrer'] : '',
            'page_instances' => array(),
            'timeline' => array(),
            'magnified' => array(),
            'selection_latest' => null,
            'page_path' => array(),
            'heartbeat_at' => null,
        );
    }
    $sessions[$sid]['last_at'] = $e['created_at'];
    $sessions[$sid]['event_count']++;
    if ($slug !== '') $sessions[$sid]['product_slug'] = $slug;
    if ($stepId !== '') $sessions[$sid]['step_id'] = $stepId;
    if (!empty($extra['page_instance_id'])) {
        $sessions[$sid]['page_instances'][$extra['page_instance_id']] = true;
    }
    if ($nm === 'heartbeat') $sessions[$sid]['heartbeat_at'] = $e['created_at'];
    if ($nm === 'site_landed' && !$sessions[$sid]['landing_page'] && isset($extra['landing_page'])) {
        $sessions[$sid]['landing_page'] = (string)$extra['landing_page'];
    }
    if (is_array($sel)) $sessions[$sid]['selection_latest'] = $sel;
    if ($nm === 'order_submitted' || $nm === 'cart_order_submitted') {
        $sessions[$sid]['submitted'] = true;
        $submittedSessions[$sid] = true;
    }
    if ($nm === 'image_magnified') {
        $did = isset($extra['design_id']) ? (string)$extra['design_id']
             : (isset($extra['item_id']) ? (string)$extra['item_id'] : '');
        if ($did !== '') {
            $rec = lr_catalog_lookup($catalog, $slug, $did);
            $key = $slug . '|magnified_image|' . $did;
            if (!isset($interest[$key])) {
                $interest[$key] = array('catalog' => $rec, 'raw_id' => $did, 'product_slug' => $slug,
                    'item_type' => 'magnified_image', 'magnified_count' => 0, 'magnified_sessions' => array(),
                    'selected_count' => 0, 'selected_sessions' => array(), 'bought_sessions' => array(),
                );
            }
            $interest[$key]['magnified_count']++;
            $interest[$key]['magnified_sessions'][$sid] = true;
            $sessions[$sid]['magnified'][] = array(
                'at' => $e['created_at'],
                'design_id' => $did,
                'image_slot' => isset($extra['image_slot']) ? (string)$extra['image_slot'] : 'main',
                'product_slug' => $slug,
                'catalog' => $rec,
            );
        }
    }
    // Timeline (keep small entries)
    $tsMs = isset($extra['timestamp_ms']) ? (int)$extra['timestamp_ms'] : 0;
    $cei  = isset($extra['client_event_index']) ? (int)$extra['client_event_index'] : 0;
    $sessions[$sid]['timeline'][] = array(
        'idx' => $idx, // stable order fallback
        'at' => $e['created_at'],
        'ms' => $tsMs,
        'cei' => $cei,
        'event_name' => $nm,
        'product_slug' => $slug,
        'step_id' => $stepId,
        'page_instance_id' => isset($extra['page_instance_id']) ? (string)$extra['page_instance_id'] : '',
        'from_step' => isset($extra['from_step']) ? (string)$extra['from_step'] : '',
        'to_step' => isset($extra['to_step']) ? (string)$extra['to_step'] : '',
        'transition_reason' => isset($extra['transition_reason']) ? (string)$extra['transition_reason'] : '',
        'design_id' => isset($extra['design_id']) ? (string)$extra['design_id'] : (isset($extra['item_id']) ? (string)$extra['item_id'] : ''),
        'design_title' => isset($extra['design_title']) ? (string)$extra['design_title'] : '',
        'image_slot' => isset($extra['image_slot']) ? (string)$extra['image_slot'] : '',
        'option_type' => isset($extra['option_type']) ? (string)$extra['option_type'] : '',
        'option_value' => isset($extra['option_value']) ? (string)$extra['option_value'] : '',
        'option_label' => isset($extra['option_label']) ? (string)$extra['option_label'] : '',
        'target_label' => isset($extra['target_label']) ? (string)$extra['target_label'] : '',
        'action_name' => isset($extra['action_name']) ? (string)$extra['action_name'] : '',
        'landing_page' => isset($extra['landing_page']) ? (string)$extra['landing_page'] : '',
        'download_label' => isset($extra['download_label']) ? (string)$extra['download_label'] : '',
        'download_file' => isset($extra['download_file']) ? (string)$extra['download_file'] : '',
        'download_kind' => isset($extra['download_kind']) ? (string)$extra['download_kind'] : '',
        'download_size' => isset($extra['download_size']) ? (string)$extra['download_size'] : '',
    );

    // Interest aggregation (designs + options)
    if ($nm === 'design_selected' || $nm === 'option_selected' || $nm === 'selection_updated' || $nm === 'step_selection_snapshot' || $nm === 'order_submitted') {
        $tuples = array();
        if ($nm === 'design_selected') {
            $did = isset($extra['design_id']) ? (string)$extra['design_id'] : '';
            if ($did !== '') $tuples[] = array('type'=>'design', 'value'=>$did);
        } elseif ($nm === 'option_selected') {
            $ot = isset($extra['option_type']) ? (string)$extra['option_type'] : '';
            $ov = isset($extra['option_value']) ? (string)$extra['option_value'] : '';
            if ($ot !== '' && $ov !== '') $tuples[] = array('type'=>$ot, 'value'=>$ov);
        }
        if (is_array($sel)) {
            // selected_designs (array or single via selected_cover)
            if (!empty($sel['selected_designs']) && is_array($sel['selected_designs'])) {
                foreach ($sel['selected_designs'] as $v) {
                    if ($v !== '' && $v !== null) $tuples[] = array('type'=>'design', 'value'=>(string)$v);
                }
            }
            if (!empty($sel['selected_cover'])) $tuples[] = array('type'=>'cover', 'value'=>(string)$sel['selected_cover']);
            if (!empty($sel['lamination'])) $tuples[] = array('type'=>'lamination', 'value'=>(string)$sel['lamination']);
            if (isset($sel['selected_pack']) && $sel['selected_pack'] !== '' && $sel['selected_pack'] !== 0 && $sel['selected_pack'] !== '0') {
                $tuples[] = array('type'=>'pack', 'value'=>(string)$sel['selected_pack']);
            }
            if (!empty($sel['caderno_option'])) $tuples[] = array('type'=>'product_option', 'value'=>(string)$sel['caderno_option']);
            if (!empty($sel['selected_size'])) $tuples[] = array('type'=>'size', 'value'=>(string)$sel['selected_size']);
            if (isset($sel['cover_personalization'])) {
                $cp = $sel['cover_personalization'];
                $val = ($cp === 1 || $cp === '1' || $cp === true) ? 'yes' : (($cp === 0 || $cp === '0' || $cp === false) ? 'no' : '');
                if ($val !== '') $tuples[] = array('type'=>'personalization', 'value'=>$val);
            }
            if (!empty($sel['selected_delivery'])) $tuples[] = array('type'=>'delivery', 'value'=>(string)$sel['selected_delivery']);
        }
        // Dedupe per session+key
        foreach ($tuples as $t) {
            if ($t['value'] === '' || $t['value'] === '0') continue;
            $rec = lr_catalog_lookup($catalog, $slug, $t['value']);
            $key = $slug . '|' . $t['type'] . '|' . ($rec && !empty($rec['value']) ? $rec['value'] : $t['value']);
            if (!isset($interest[$key])) {
                $interest[$key] = array('catalog' => $rec, 'raw_id' => $t['value'], 'product_slug' => $slug,
                    'item_type' => $t['type'], 'magnified_count' => 0, 'magnified_sessions' => array(),
                    'selected_count' => 0, 'selected_sessions' => array(), 'bought_sessions' => array(),
                );
            }
            $interest[$key]['selected_count']++;
            $interest[$key]['selected_sessions'][$sid] = true;
            if (!isset($sessionSelectedItems[$sid])) $sessionSelectedItems[$sid] = array();
            $sessionSelectedItems[$sid][$key] = true;
        }
    }
}
// Mark bought for items selected in submitted sessions
foreach ($interest as $key => &$it) {
    foreach ($it['selected_sessions'] as $sid => $_) {
        if (!empty($submittedSessions[$sid])) $it['bought_sessions'][$sid] = true;
    }
    $it['selected_sessions_count'] = count($it['selected_sessions']);
    $it['magnified_sessions_count'] = count($it['magnified_sessions']);
    $it['bought_count'] = count($it['bought_sessions']);
    $it['abandoned_count'] = max(0, $it['selected_sessions_count'] - $it['bought_count']);
}
unset($it);

foreach ($sessions as $sid => &$session) {
    $session['offer_downloads'] = isset($offerDownloadsBySession[$sid]) ? $offerDownloadsBySession[$sid] : array();
}
unset($session);

// Activity sort: most recent first
uasort($sessions, function ($a, $b) { return strcmp($b['last_at'], $a['last_at']); });

// Funnel field bucketization
function lr_field_bucket($landing, $stepId, $submitted) {
    if ($submitted) return 'pedido';
    $stepId = (string)$stepId;
    if ($stepId === 'designs') return 'designs';
    if ($stepId === 'size' || $stepId === 'pack' || $stepId === 'lamination' || $stepId === 'cover_personalization') return 'opcoes';
    if ($stepId === 'details') return 'contacto';
    if ($stepId === 'delivery_contact') return 'entrega';
    if ($stepId === 'confirm') return 'confirmacao';
    // No step ID: home or product page open
    $lc = strtolower((string)$landing);
    if ($lc === '' || strpos($lc, 'index') !== false || $lc === '/') return 'entrada';
    if (strpos($lc, 'cadernos') !== false || strpos($lc, 'crachas') !== false || strpos($lc, 'imanes') !== false || strpos($lc, 'caderninhos') !== false || strpos($lc, 'pins') !== false || strpos($lc, 'lembrancas') !== false) return 'produto';
    return 'entrada';
}
$fieldBuckets = array(
    'entrada' => array('label' => 'Entrada', 'sessions' => array()),
    'produto' => array('label' => 'Produto', 'sessions' => array()),
    'designs' => array('label' => 'Designs', 'sessions' => array()),
    'opcoes' => array('label' => 'Opções', 'sessions' => array()),
    'contacto' => array('label' => 'Contacto', 'sessions' => array()),
    'entrega' => array('label' => 'Entrega', 'sessions' => array()),
    'confirmacao' => array('label' => 'Confirmação', 'sessions' => array()),
    'pedido' => array('label' => 'Pedido', 'sessions' => array()),
);
foreach ($sessions as $sid => $s) {
    $b = lr_field_bucket($s['landing_page'], $s['step_id'], $s['submitted']);
    if (!isset($fieldBuckets[$b])) $fieldBuckets[$b] = array('label' => $b, 'sessions' => array());
    $fieldBuckets[$b]['sessions'][] = $sid;
}

// IP lookup cache for map (reuse helpers from lib/db.php)
$mapPoints = array();
$ipsList = array();
foreach ($sessions as $s) if (!empty($s['ip']) && mp_tracking_ip_is_public($s['ip'])) $ipsList[] = $s['ip'];
$ipsList = array_values(array_unique($ipsList));
$ipCache = !empty($ipsList) ? mp_ip_lookup_get_many($ipsList) : array();
$publicIpsKnown = count($ipsList);
$publicIpsResolved = 0;
$allPrivate = $publicIpsKnown === 0;
foreach ($ipCache as $info) {
    if (!empty($info['country_code']) || !empty($info['country_name'])) $publicIpsResolved++;
    if (!empty($info['latitude']) && !empty($info['longitude'])) {
        $mapPoints[] = array(
            'lat' => (float)$info['latitude'], 'lon' => (float)$info['longitude'],
            'country' => (string)$info['country_name'], 'city' => (string)$info['city'],
            'region' => (string)$info['region'], 'isp' => (string)$info['isp'],
            'asn' => (string)$info['asn'], 'ip' => $info['ip'],
        );
    }
}

// Selected session for replay (optional)
$selectedSid = isset($_GET['sid']) ? (string)$_GET['sid'] : '';
if ($selectedSid && !isset($sessions[$selectedSid])) $selectedSid = '';
if ($selectedSid === '' && !empty($sessions)) {
    // default to most recent submitted, else most recent
    foreach ($sessions as $sid => $s) { if ($s['submitted']) { $selectedSid = $sid; break; } }
    if ($selectedSid === '') $selectedSid = array_key_first($sessions);
}
$selectedSession = $selectedSid ? $sessions[$selectedSid] : null;

// Sort the selected session's timeline correctly:
// ms primary, cei secondary, idx tertiary (DB order fallback)
if ($selectedSession) {
    usort($selectedSession['timeline'], function ($a, $b) {
        if ($a['ms'] && $b['ms'] && $a['ms'] !== $b['ms']) return $a['ms'] - $b['ms'];
        if ($a['cei'] !== $b['cei']) return $a['cei'] - $b['cei'];
        return $a['idx'] - $b['idx'];
    });
}

// Top interest lists for the gallery
$listMagnified = $interest;
uasort($listMagnified, function ($a, $b) { return $b['magnified_count'] - $a['magnified_count']; });
$topMagnified = array_filter(array_slice($listMagnified, 0, 12, true), function ($it) { return $it['magnified_count'] > 0; });

$listSelected = array_filter($interest, function ($it) { return $it['selected_sessions_count'] > 0; });
uasort($listSelected, function ($a, $b) { return $b['selected_sessions_count'] - $a['selected_sessions_count']; });
$topSelected = array_slice($listSelected, 0, 12, true);

$listBought = array_filter($interest, function ($it) { return $it['bought_count'] > 0; });
uasort($listBought, function ($a, $b) { return $b['bought_count'] - $a['bought_count']; });
$topBought = array_slice($listBought, 0, 12, true);

$listAbandoned = array_filter($interest, function ($it) { return $it['selected_sessions_count'] > 0 && $it['bought_count'] === 0; });
uasort($listAbandoned, function ($a, $b) { return $b['selected_sessions_count'] - $a['selected_sessions_count']; });
$topAbandoned = array_slice($listAbandoned, 0, 12, true);

// Magnified but not selected (per-session set diff)
$listMagNotSel = array();
foreach ($interest as $key => $it) {
    if ($it['magnified_count'] === 0) continue;
    $diff = 0;
    foreach ($it['magnified_sessions'] as $sid => $_) {
        if (empty($sessionSelectedItems[$sid][$key])) $diff++;
    }
    if ($diff > 0) {
        $c = $it; $c['magnified_not_selected_sessions'] = $diff;
        $listMagNotSel[$key] = $c;
    }
}
uasort($listMagNotSel, function ($a, $b) { return $b['magnified_not_selected_sessions'] - $a['magnified_not_selected_sessions']; });
$topMagNotSel = array_slice($listMagNotSel, 0, 12, true);

// Render helpers
function lr_interest_card($it, $mode = 'funnel') {
    $rec = isset($it['catalog']) ? $it['catalog'] : null;
    $itemType = isset($it['item_type']) ? $it['item_type'] : 'design';
    $raw = $it['raw_id'];
    $typeLabels = array('design'=>'design','cover'=>'capa','lamination'=>'laminação','pack'=>'pack',
        'product_option'=>'opção','size'=>'tamanho','personalization'=>'personalização',
        'delivery'=>'entrega','caderno_qty'=>'quantidade','assorted'=>'sortido','magnified_image'=>'imagem');
    $slotLabel = isset($typeLabels[$itemType]) ? $typeLabels[$itemType] : $itemType;
    $title = $rec && !empty($rec['title']) ? $rec['title'] : $raw;
    if (!$rec) {
        if ($itemType === 'personalization') $title = $raw === 'yes' ? 'Personalização ativa' : 'Sem personalização';
        elseif ($itemType === 'pack') $title = 'Pack ' . $raw;
        elseif ($itemType === 'assorted') $title = 'Sortido';
        elseif ($itemType === 'delivery') $title = ucfirst(str_replace('_', ' ', $raw));
        else $title = ucfirst(str_replace(array('_','-'), ' ', $raw));
    }
    $productName = $rec && !empty($rec['product_name']) ? $rec['product_name'] : lr_product_friendly_name($it['product_slug']);
    $image = $rec && !empty($rec['image']) ? $rec['image'] : '';
    $thumb = lr_thumb($image, $title . ' — ' . $productName, 72);

    $mag = (int)($it['magnified_count'] ?? 0);
    $selS = (int)($it['selected_sessions_count'] ?? 0);
    $bought = (int)($it['bought_count'] ?? 0);
    $abandoned = (int)($it['abandoned_count'] ?? 0);
    $magNotSel = (int)($it['magnified_not_selected_sessions'] ?? 0);
    $stats = array();
    if ($mode === 'magnified' || $mode === 'magnified_not_selected' || $mode === 'funnel') {
        $stats[] = '🔍 <strong>' . $mag . '</strong>';
    }
    if ($mode === 'selected' || $mode === 'abandoned' || $mode === 'funnel') {
        $stats[] = '✅ <strong>' . $selS . '</strong>';
    }
    if ($mode === 'bought' || $mode === 'funnel') {
        $stats[] = '🎉 <strong>' . $bought . '</strong>';
    }
    if ($mode === 'abandoned') $stats[] = '⚠️ <strong>' . $abandoned . '</strong>';
    if ($mode === 'magnified_not_selected') $stats[] = '⚠️ <strong>' . $magNotSel . '</strong>';

    $out = '<article class="lr-card">';
    $out .= $thumb;
    $out .= '<div class="lr-title">' . lr_h($title) . '</div>';
    $out .= '<div class="lr-sub">' . lr_h($productName) . ' · ' . lr_h($slotLabel) . '</div>';
    if (!empty($stats)) $out .= '<div class="lr-stats">' . implode(' &nbsp; ', $stats) . '</div>';
    $out .= '</article>';
    return $out;
}

function lr_timeline_icon($name) {
    static $icons = array(
        'site_landed' => '🏠',
        'wizard_started' => '🛍️',
        'step_view' => '🚶',
        'step_completed' => '✅',
        'design_selected' => '✅',
        'design_unselected' => '❌',
        'option_selected' => '🎛️',
        'image_magnified' => '🔍',
        'design_zoom_opened' => '🔍',
        'design_zoom_closed' => '🔎',
        'validation_error' => '⚠️',
        'order_submitted' => '🎉',
        'cart_order_submitted' => '🎉',
        'heartbeat' => '·',
        'delivery_selected' => '🚚',
        'ui_interaction' => '👆',
        'dead_tap' => '🚫',
        'cart_item_added' => '🛒',
        'cart_checkout_started' => '🧾',
        'contact_started' => '📝',
        'contact_completed' => '📨',
        'confirmation_view' => '🧾',
        'selection_updated' => '🎛️',
        'step_selection_snapshot' => '📸',
        'offer_page_view' => '📄',
        'offer_downloads_seen' => '👀',
        'offer_pdf_download_clicked' => '⬇️',
        'offer_image_zoom_clicked' => '🔍',
        'offer_scroll_depth' => '↓',
    );
    return isset($icons[$name]) ? $icons[$name] : '·';
}

function lr_render_timeline_entry($t) {
    $time = '';
    if (!empty($t['ms'])) {
        try {
            $tz = new DateTimeZone('Europe/Lisbon');
            $dt = new DateTime('@' . (int)floor($t['ms'] / 1000));
            $dt->setTimezone($tz);
            $time = $dt->format('H:i:s') . '.' . str_pad((string)($t['ms'] % 1000), 3, '0', STR_PAD_LEFT);
        } catch (Exception $e) { $time = substr($t['at'], 11, 8); }
    } else {
        try {
            $tz = new DateTimeZone('Europe/Lisbon');
            $dt = new DateTime($t['at']);
            $dt->setTimezone($tz);
            $time = $dt->format('H:i:s');
        } catch (Exception $e) { $time = substr($t['at'], 11, 8); }
    }
    $icon = lr_timeline_icon($t['event_name']);
    $nm = $t['event_name'];
    $msg = '';
    if ($nm === 'site_landed') $msg = 'entrou no site' . ($t['landing_page'] ? ' (' . $t['landing_page'] . ')' : '');
    elseif ($nm === 'wizard_started') $msg = 'abriu ' . lr_product_friendly_name($t['product_slug']);
    elseif ($nm === 'offer_page_view') $msg = 'abriu ' . lr_product_friendly_name($t['product_slug']);
    elseif ($nm === 'offer_downloads_seen') $msg = 'viu a zona de downloads';
    elseif ($nm === 'offer_pdf_download_clicked') $msg = 'descarregou PDF "' . ($t['download_label'] ?: ($t['target_label'] ?: 'PDF')) . '"';
    elseif ($nm === 'offer_image_zoom_clicked') $msg = 'ampliou imagem' . ($t['target_label'] ? ' "' . $t['target_label'] . '"' : '');
    elseif ($nm === 'offer_scroll_depth') $msg = 'continuou a ver a página';
    elseif ($nm === 'step_view') {
        if ($t['transition_reason'] === 'back_button' || $t['transition_reason'] === 'browser_back') {
            $msg = 'voltou para ' . lr_step_label($t['to_step'] ?: $t['step_id']);
        } elseif ($t['transition_reason'] === 'next_button') {
            $msg = 'avançou para ' . lr_step_label($t['to_step'] ?: $t['step_id']);
        } else {
            $msg = 'abriu passo ' . lr_step_label($t['step_id']);
        }
    }
    elseif ($nm === 'step_completed') $msg = 'completou ' . lr_step_label($t['step_id']);
    elseif ($nm === 'design_selected') {
        $title = $t['design_title'] ?: $t['design_id'];
        $msg = 'escolheu ' . $title;
    }
    elseif ($nm === 'design_unselected') {
        $title = $t['design_title'] ?: $t['design_id'];
        $msg = 'desmarcou ' . $title;
    }
    elseif ($nm === 'option_selected') {
        $msg = 'escolheu ' . ($t['option_type'] ? $t['option_type'] . ' ' : '') . ($t['option_label'] ?: $t['option_value']);
    }
    elseif ($nm === 'image_magnified' || $nm === 'design_zoom_opened') {
        $title = $t['design_title'] ?: $t['design_id'];
        $msg = 'ampliou ' . ($title ?: 'imagem') . ($t['image_slot'] ? ' · ' . $t['image_slot'] : '');
    }
    elseif ($nm === 'validation_error') $msg = 'tentou continuar — faltava algo em ' . lr_step_label($t['step_id']);
    elseif ($nm === 'order_submitted' || $nm === 'cart_order_submitted') $msg = 'enviou o pedido';
    elseif ($nm === 'delivery_selected') $msg = 'escolheu entrega';
    elseif ($nm === 'contact_completed') $msg = 'completou contacto';
    elseif ($nm === 'ui_interaction') {
        $lab = $t['target_label'] ?: ($t['action_name'] ?: 'clique');
        $msg = 'clicou "' . $lab . '"';
    }
    elseif ($nm === 'heartbeat') $msg = 'continua na página';
    elseif ($nm === 'selection_updated') $msg = 'mudou selecção';
    elseif ($nm === 'step_selection_snapshot') $msg = 'snapshot em ' . lr_step_label($t['step_id']);
    else $msg = $nm;
    return '<li class="lr-tl-entry"><span class="lr-tl-time">' . lr_h($time) . '</span><span class="lr-tl-icon">' . $icon . '</span><span class="lr-tl-msg">' . lr_h($msg) . '</span></li>';
}

// Visitor label
function lr_visitor_label($ip) {
    if (!$ip) return 'Anónimo';
    $h = substr(md5($ip), 0, 3);
    return strtoupper(substr($h, 0, 1)) . substr($h, 1, 2);
}
function lr_attribution_chip($attribution) {
    $cat = isset($attribution['category']) ? (string)$attribution['category'] : 'Desconhecido';
    $raw = isset($attribution['raw']) ? (string)$attribution['raw'] : '';
    $class = strtolower(preg_replace('/[^a-z0-9]+/i', '', $cat));
    return '<span class="lr-src-chip lr-src-' . lr_h($class) . '" title="' . lr_h($raw) . '">' . lr_h($cat) . '</span>';
}

// ------------------------------------------------------------------
// METRO REPLAY — station mapping + JSON payload for client JS
// ------------------------------------------------------------------
/**
 * Maps a single funnel event onto the metro mockup station vocabulary.
 * Returns one of: home, split, crachas-*, imanes-*, caderninhos-*,
 * cadernos-*, contacto, envio  — or null if untrackable.
 */
function lr_event_to_station($name, $stepId, $slug, $landing = '', $submitted = false) {
    $name = (string)$name; $stepId = (string)$stepId; $slug = (string)$slug;
    if ($submitted || $name === 'order_submitted' || $name === 'cart_order_submitted') return 'envio';
    if ($name === 'wizard_started' || $name === 'product_view') {
        if (isset(array('crachas'=>1,'imanes'=>1,'caderninhos'=>1,'cadernos'=>1)[$slug])) return 'split';
        return 'split';
    }
    if ($name === 'site_landed') {
        $lc = strtolower((string)$landing);
        if (preg_match('/(cadernos|crachas|imanes|caderninhos)/', $lc)) return 'split';
        return 'home';
    }
    if ($stepId === '' && $slug === '') return 'home';
    if ($stepId === '') return 'split';
    if ($stepId === 'details' || $stepId === 'delivery_contact' || $stepId === 'confirm') return 'contacto';
    $map = array(
        'crachas' => array('designs'=>'crachas-designs','size'=>'crachas-size','pack'=>'crachas-quantity','business_card'=>'crachas-business-card'),
        'imanes' => array('designs'=>'imanes-designs','size'=>'imanes-size','pack'=>'imanes-quantity'),
        'caderninhos' => array('designs'=>'caderninhos-designs','size'=>'caderninhos-size','pack'=>'caderninhos-quantity'),
        'cadernos' => array('designs'=>'cadernos-cover','lamination'=>'cadernos-lamination','pack'=>'cadernos-quantity','cover_personalization'=>'cadernos-personalization'),
    );
    if (isset($map[$slug][$stepId])) return $map[$slug][$stepId];
    if (isset($map[$slug])) return reset($map[$slug]);
    return 'split';
}

function lr_pin_color($slug) {
    static $c = array(
        'crachas' => '#ef767a',
        'imanes' => '#6cb4a8',
        'caderninhos' => '#7aa7e8',
        'cadernos' => '#b68be8',
        'lembrancas' => '#d49a55',
        'pins' => '#ef767a',
        'ofertas' => '#b7925a',
        'oferta-pdf' => '#b7925a',
        'oferta-convite-congresso' => '#b7925a',
    );
    return isset($c[$slug]) ? $c[$slug] : '#b7925a';
}

// Mockup station definitions (coords/lines mirror metro_live_visitors_mockup.html)
$mockupStations = array(
    array('id'=>'home','label'=>'Homepage','sub'=>'entrada','x'=>500,'y'=>70,'line'=>'home','kind'=>'home-station'),
    array('id'=>'split','label'=>'Escolha de produto','sub'=>'ramificação','x'=>500,'y'=>125,'line'=>'home','major'=>true),
    array('id'=>'crachas-designs','label'=>'Design','sub'=>'crachás','x'=>190,'y'=>170,'line'=>'crachas','major'=>true,'statType'=>'designs'),
    array('id'=>'crachas-size','label'=>'Tamanho','sub'=>'crachás','x'=>190,'y'=>330,'line'=>'crachas','statType'=>'size'),
    array('id'=>'crachas-quantity','label'=>'Quantidade','sub'=>'crachás','x'=>190,'y'=>490,'line'=>'crachas','statType'=>'pack'),
    array('id'=>'crachas-business-card','label'=>'Cartão','sub'=>'apresentação','x'=>190,'y'=>650,'line'=>'crachas','statType'=>'business_card'),
    array('id'=>'imanes-designs','label'=>'Design','sub'=>'ímanes','x'=>395,'y'=>170,'line'=>'imanes','major'=>true,'statType'=>'designs'),
    array('id'=>'imanes-size','label'=>'Tamanho','sub'=>'ímanes','x'=>395,'y'=>330,'line'=>'imanes','statType'=>'size'),
    array('id'=>'imanes-quantity','label'=>'Quantidade','sub'=>'ímanes','x'=>395,'y'=>490,'line'=>'imanes','statType'=>'pack'),
    array('id'=>'imanes-review','label'=>'Resumo','sub'=>'confirmação','x'=>395,'y'=>650,'line'=>'imanes','statType'=>'review'),
    array('id'=>'caderninhos-designs','label'=>'Design','sub'=>'caderninhos','x'=>605,'y'=>170,'line'=>'caderninhos','major'=>true,'statType'=>'designs'),
    array('id'=>'caderninhos-size','label'=>'Tipo','sub'=>'caderninhos','x'=>605,'y'=>330,'line'=>'caderninhos','statType'=>'size'),
    array('id'=>'caderninhos-quantity','label'=>'Quantidade','sub'=>'caderninhos','x'=>605,'y'=>490,'line'=>'caderninhos','statType'=>'pack'),
    array('id'=>'caderninhos-review','label'=>'Resumo','sub'=>'confirmação','x'=>605,'y'=>650,'line'=>'caderninhos','statType'=>'review'),
    array('id'=>'cadernos-cover','label'=>'Capa','sub'=>'cadernos','x'=>810,'y'=>170,'line'=>'cadernos','major'=>true,'statType'=>'cover'),
    array('id'=>'cadernos-lamination','label'=>'Laminação','sub'=>'cadernos','x'=>810,'y'=>330,'line'=>'cadernos','statType'=>'lamination'),
    array('id'=>'cadernos-quantity','label'=>'Quantidade','sub'=>'cadernos','x'=>810,'y'=>490,'line'=>'cadernos','statType'=>'pack'),
    array('id'=>'cadernos-personalization','label'=>'Personalização','sub'=>'cadernos','x'=>810,'y'=>650,'line'=>'cadernos','statType'=>'cover_personalization'),
    array('id'=>'contacto','label'=>'Contacto','sub'=>'dados/envio','x'=>500,'y'=>805,'line'=>'final','major'=>true,'statType'=>'contact'),
    array('id'=>'envio','label'=>'Pedido enviado','sub'=>'entrega','x'=>500,'y'=>860,'line'=>'final','kind'=>'final-station','statType'=>'delivery'),
);

// Build replay payload
$replayVisitors = array();
$replayEvents = array();
$evIdCounter = 0;
foreach ($sessions as $sid => $s) {
    $timeline = $s['timeline'];
    usort($timeline, function ($a, $b) {
        if ($a['ms'] && $b['ms'] && $a['ms'] !== $b['ms']) return $a['ms'] - $b['ms'];
        if ($a['cei'] !== $b['cei']) return $a['cei'] - $b['cei'];
        return $a['idx'] - $b['idx'];
    });
    $miniId = lr_visitor_label($s['ip']);
    $prodSlug = $s['product_slug'] ?: '';
    $geoLine = '';
    if (!empty($s['ip']) && isset($ipCache[$s['ip']])) {
        $info = $ipCache[$s['ip']];
        $parts = array();
        if (!empty($info['city'])) $parts[] = (string)$info['city'];
        if (!empty($info['country_name'])) $parts[] = (string)$info['country_name'];
        $geoLine = implode(', ', $parts);
    }
    $sessionDownloads = isset($s['offer_downloads']) && is_array($s['offer_downloads']) ? $s['offer_downloads'] : array();
    $sessionDownloadPayload = array();
    foreach (array_slice($sessionDownloads, 0, 8) as $download) {
        $sessionDownloadPayload[] = array(
            'at' => (string)$download['created_at'],
            'label' => (string)$download['download_label'],
            'file' => (string)$download['download_file'],
            'kind' => (string)$download['download_kind'],
            'size' => (string)$download['download_size'],
        );
    }
    $replayVisitors[] = array(
        'key' => (string)$sid,
        'miniId' => $miniId,
        'productSlug' => $prodSlug,
        'productName' => $prodSlug ? lr_product_friendly_name($prodSlug) : 'Página inicial',
        'ip' => (string)$s['ip'],
        'geo' => $geoLine,
        'referrerType' => (string)($s['referrer_type'] ?: 'unknown'),
        'externalReferrer' => (string)$s['external_referrer'],
        'utmSource' => (string)$s['utm_source'],
        'firstReferrer' => (string)$s['first_referrer'],
        'landingPage' => (string)$s['landing_page'],
        'device' => (string)($s['device_type'] ?: ''),
        'viewport' => $s['viewport_width'] ? ((int)$s['viewport_width']) . 'px' : '',
        'submitted' => (bool)$s['submitted'],
        'eventCount' => (int)$s['event_count'],
        'firstAt' => (string)$s['first_at'],
        'lastAt' => (string)$s['last_at'],
        'offerDownloadCount' => count($sessionDownloads),
        'offerDownloads' => $sessionDownloadPayload,
        'pinColor' => lr_pin_color($prodSlug),
    );
    foreach ($timeline as $t) {
        if ($t['event_name'] === 'heartbeat') continue;
        $station = lr_event_to_station(
            $t['event_name'], $t['step_id'],
            ($t['product_slug'] ?: $prodSlug),
            ($t['landing_page'] ?: $s['landing_page']),
            ($t['event_name'] === 'order_submitted' || $t['event_name'] === 'cart_order_submitted')
        );
        if ($station === null) continue;
        $ts = (int)$t['ms'];
        if ($ts <= 0) {
            $tstr = $t['at'] ?: $s['first_at'];
            try { $dt = new DateTime($tstr, new DateTimeZone('UTC')); $ts = (int)($dt->getTimestamp() * 1000); }
            catch (Exception $e) { $ts = (int)(strtotime((string)$tstr) * 1000); }
        }
        if ($ts <= 0) continue;
        $replayEvents[] = array(
            'id' => ++$evIdCounter,
            'ts' => $ts,
            'isoAt' => (string)$t['at'],
            'visitorKey' => (string)$sid,
            'productSlug' => (string)($t['product_slug'] ?: $prodSlug),
            'eventName' => (string)$t['event_name'],
            'stepId' => (string)$t['step_id'],
            'fromStep' => (string)$t['from_step'],
            'toStep' => (string)$t['to_step'],
            'transitionReason' => (string)$t['transition_reason'],
            'stationId' => $station,
            'designTitle' => (string)($t['design_title'] ?: $t['design_id']),
            'designId' => (string)$t['design_id'],
            'optionType' => (string)$t['option_type'],
            'optionLabel' => (string)($t['option_label'] ?: $t['option_value']),
            'optionValue' => (string)$t['option_value'],
            'imageSlot' => (string)$t['image_slot'],
            'targetLabel' => (string)$t['target_label'],
            'downloadLabel' => (string)($t['download_label'] ?: $t['target_label']),
            'downloadFile' => (string)$t['download_file'],
            'downloadKind' => (string)$t['download_kind'],
            'downloadSize' => (string)$t['download_size'],
        );
    }
}
usort($replayEvents, function ($a, $b) {
    if ($a['ts'] !== $b['ts']) return $a['ts'] - $b['ts'];
    return $a['id'] - $b['id'];
});

// Only auto-isolate if user came in with ?sid=… in the URL. Default view shows all pins.
$explicitSid = isset($_GET['sid']) && isset($sessions[(string)$_GET['sid']]) ? (string)$_GET['sid'] : '';

$replayPayload = array(
    'visitors' => $replayVisitors,
    'events' => $replayEvents,
    'stations' => $mockupStations,
    'meta' => array(
        'startDate' => $startDate,
        'endDate' => $endDate,
        'period' => $period,
        'submittedCount' => count($submittedSessions),
        'totalEvents' => count($events),
        'visitorCount' => count($replayVisitors),
        'isolatedSid' => $explicitSid,
    ),
);

header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Live Dashboard · Mia &amp; Paper admin</title>
<style>
:root {
  --ink: #30251f;
  --muted: #74685f;
  --bg: #fff8ed;
  --paper: #fffdf8;
  --card: #fff8df;
  --line: rgba(118,85,28,0.22);
  --line-faint: rgba(88,65,42,0.12);
  --gold: #b88616;
  --moss: #4f7a3a;
  --line-home: #b7925a;
  --line-crachas: #ef767a;
  --line-imanes: #6cb4a8;
  --line-caderninhos: #7aa7e8;
  --line-cadernos: #b68be8;
  --line-final: #3d8b6f;
  --grid: rgba(84,66,49,0.07);
  --shadow: 0 24px 70px rgba(91,70,49,0.16);
}
* { box-sizing: border-box; }
body {
  margin: 0; min-height: 100vh;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Georgia, serif;
  color: var(--ink); line-height: 1.5;
  background:
    linear-gradient(90deg, var(--grid) 1px, transparent 1px),
    linear-gradient(var(--grid) 1px, transparent 1px),
    radial-gradient(circle at top left, rgba(255,217,151,0.45), transparent 34rem),
    var(--bg);
  background-size: 34px 34px, 34px 34px, auto, auto;
}

/* Header */
header.page-header {
  padding: 18px 28px; border-bottom: 1px solid var(--line-faint);
  display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; align-items: center;
  background: rgba(255,253,248,0.85); backdrop-filter: blur(8px);
}
header.page-header h1 { margin: 0; font-size: 1.45rem; letter-spacing: -0.02em; }
header.page-header p { margin: 4px 0 0; color: var(--muted); font-size: 0.86rem; }
nav.period-tabs { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
nav.period-tabs a, nav.period-tabs button {
  padding: 7px 13px; border-radius: 999px; border: 1px solid var(--line-faint);
  text-decoration: none; color: var(--ink); font-weight: 700; font-size: 0.84rem;
  background: rgba(255,253,248,0.7); cursor: pointer; font-family: inherit;
}
nav.period-tabs a.is-active, nav.period-tabs button.is-active {
  background: var(--gold); border-color: var(--gold); color: #fff;
}
nav.period-tabs a.back-link { background: rgba(118,85,28,0.08); color: var(--muted); }
.lr-form-inline { display: inline-flex; gap: 4px; align-items: center; }
.lr-form-inline input[type=date] {
  padding: 5px 7px; border: 1px solid var(--line-faint); border-radius: 8px;
  background: rgba(255,253,248,0.7); font: inherit; font-size: 0.82rem;
}

main.lr-dash {
  padding: 20px 28px 80px; display: grid; gap: 22px;
  max-width: 1500px; margin: 0 auto;
}

section.lr-section {
  background: rgba(255,253,248,0.92);
  border: 1px solid var(--line-faint);
  box-shadow: var(--shadow);
  border-radius: 22px; padding: 18px 20px;
}
section.lr-section > h2 { margin: 0 0 4px; font-size: 1.1rem; letter-spacing: -0.01em; }
section.lr-section > p.sub { color: var(--muted); font-size: 0.86rem; margin: 0 0 12px; }

.metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.metric { padding: 10px 12px; background: rgba(255,255,255,0.55); border: 1px solid var(--line-faint); border-radius: 14px; }
.metric .label { color: var(--muted); font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.04em; }
.metric .value { font-weight: 900; font-size: 1.2rem; line-height: 1; margin-top: 4px; }
.metric .sub { color: var(--muted); font-size: 0.78rem; margin-top: 3px; }

/* ───────── Metro replay shell ───────── */
.lr-replay-shell { display: grid; grid-template-columns: 1fr 370px; gap: 18px; align-items: start; }
@media (max-width: 1100px) { .lr-replay-shell { grid-template-columns: 1fr; } }

.lr-map-card {
  background: rgba(255,253,248,0.92);
  border: 1px solid var(--line-faint);
  box-shadow: var(--shadow);
  border-radius: 22px; padding: 14px; overflow: hidden;
}
.lr-map-wrap {
  position: relative; width: 100%; min-height: 790px;
  border-radius: 16px; overflow: hidden;
  background:
    radial-gradient(circle at 50% 12%, rgba(255,255,255,0.9), transparent 16rem),
    radial-gradient(circle at 50% 86%, rgba(255,228,179,0.55), transparent 18rem),
    #fffaf0;
  border: 1px solid var(--line-faint);
}
@media (max-width: 720px) { .lr-map-wrap { min-height: 820px; } }
svg.lr-metro { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
svg.lr-metro .line { fill: none; stroke-width: 20; stroke-linecap: round; stroke-linejoin: round; opacity: 0.95; }
svg.lr-metro .line.ghost { stroke: rgba(80,60,45,0.09); stroke-width: 38; opacity: 1; }
svg.lr-metro .home-line { stroke: var(--line-home); }
svg.lr-metro .crachas-line { stroke: var(--line-crachas); }
svg.lr-metro .imanes-line { stroke: var(--line-imanes); }
svg.lr-metro .caderninhos-line { stroke: var(--line-caderninhos); }
svg.lr-metro .cadernos-line { stroke: var(--line-cadernos); }
svg.lr-metro .final-line { stroke: var(--line-final); }
@media (max-width: 720px) {
  svg.lr-metro .line { stroke-width: 14; }
  svg.lr-metro .line.ghost { stroke-width: 28; }
}

.lr-station {
  position: absolute; transform: translate(-50%, -50%); z-index: 3;
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--paper); border: 4px solid currentColor;
  box-shadow: 0 5px 16px rgba(45,33,20,0.16);
  cursor: pointer; padding: 0;
}
.lr-station:hover, .lr-station.is-selected {
  transform: translate(-50%, -50%) scale(1.18);
  box-shadow: 0 0 0 5px rgba(255,255,255,0.9), 0 9px 24px rgba(45,33,20,0.24);
}
.lr-station.major { width: 32px; height: 32px; border-width: 6px; }
.lr-station.home-station { width: 42px; height: 42px; border-width: 7px; }
.lr-station.final-station { width: 38px; height: 38px; border-width: 7px; }
.lr-station:focus-visible { outline: 3px solid rgba(48,37,31,0.45); outline-offset: 5px; }

.lr-visitor {
  --visitor-color: #222;
  position: absolute; z-index: 7;
  min-width: 38px; height: 28px;
  transform: translate(-50%, -50%);
  border: 0; border-radius: 999px;
  background: var(--visitor-color); color: #fff;
  display: grid; place-items: center;
  padding: 0 9px;
  font-size: 0.72rem; font-weight: 800; line-height: 1;
  box-shadow: 0 0 0 3px rgba(255,255,255,0.95), 0 8px 18px rgba(28,21,14,0.25);
  transition:
    left 280ms cubic-bezier(.22,.9,.25,1),
    top 280ms cubic-bezier(.22,.9,.25,1),
    transform 160ms ease, opacity 160ms ease, box-shadow 160ms ease;
  cursor: pointer;
}
.lr-visitor::after {
  content: ""; position: absolute; left: 50%; top: calc(100% - 3px);
  width: 10px; height: 10px;
  transform: translateX(-50%) rotate(45deg);
  background: var(--visitor-color); border-radius: 0 0 3px 0;
  z-index: -1;
}
.lr-visitor:hover, .lr-visitor.is-selected {
  transform: translate(-50%, -50%) scale(1.08);
  box-shadow: 0 0 0 4px rgba(255,255,255,1), 0 10px 24px rgba(28,21,14,0.32);
}
.lr-visitor.is-ended { opacity: 0.45; filter: grayscale(0.7); }
.lr-visitor.is-completed { box-shadow: 0 0 0 3px rgba(79,122,58,0.75), 0 8px 18px rgba(28,21,14,0.25); }
.lr-visitor.is-current-event { animation: lrCurrentPin 900ms ease-out 1; }
.lr-visitor:focus-visible { outline: 3px solid rgba(48,37,31,0.45); outline-offset: 5px; }
@keyframes lrCurrentPin {
  0% { box-shadow: 0 0 0 0 rgba(48,37,31,0.35), 0 0 0 3px rgba(255,255,255,0.95), 0 8px 18px rgba(28,21,14,0.25); }
  100% { box-shadow: 0 0 0 22px rgba(48,37,31,0), 0 0 0 3px rgba(255,255,255,0.95), 0 8px 18px rgba(28,21,14,0.25); }
}

.lr-info-card {
  position: absolute; z-index: 20;
  width: min(460px, calc(100% - 28px));
  max-height: min(620px, calc(100% - 40px));
  overflow: auto;
  background: rgba(255,253,248,0.98);
  border: 1px solid var(--line-faint);
  border-radius: 18px;
  box-shadow: 0 22px 55px rgba(63,46,31,0.22);
  padding: 14px;
  opacity: 0;
  transform: translate(-50%, 10px) scale(0.98);
  pointer-events: none;
  transition: 180ms ease;
}
.lr-info-card.is-visible { opacity: 1; transform: translate(-50%, 0) scale(1); pointer-events: auto; }
.lr-info-card .card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.lr-info-card .card-title { margin: 0; font-size: 1rem; }
.lr-info-card .card-subtitle { margin: 3px 0 0; color: var(--muted); font-size: 0.8rem; line-height: 1.35; }
.lr-info-card .close-card {
  width: 30px; height: 30px; border-radius: 999px;
  display: grid; place-items: center;
  padding: 0; box-shadow: none;
  background: #fff1d2; color: #463526;
  border: 1px solid var(--line-faint);
  flex: 0 0 auto; cursor: pointer; font: inherit; font-size: 1.1rem;
}
.lr-info-card .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.lr-info-card .detail { border-radius: 12px; background: #fff8e8; border: 1px solid var(--line-faint); padding: 9px 10px; }
.lr-info-card .detail.wide { grid-column: 1 / -1; }
.lr-info-card .detail span { display: block; color: var(--muted); font-size: 0.7rem; margin-bottom: 3px; }
.lr-info-card .detail strong { display: block; font-size: 0.84rem; line-height: 1.25; word-break: break-word; }
.lr-info-card .section-title { margin: 12px 0 7px; font-size: 0.82rem; letter-spacing: -0.01em; }
.lr-info-card .activity-list,
.lr-info-card .mini-table {
  margin: 0; padding: 10px;
  border-radius: 12px;
  background: rgba(255,244,220,0.72);
  border: 1px solid var(--line-faint);
  color: var(--muted);
  font-size: 0.78rem; line-height: 1.38;
}
.lr-info-card .mini-table { display: grid; gap: 7px; }
.lr-info-card .mini-row, .lr-info-card .timeline-row {
  display: grid; grid-template-columns: minmax(70px, 1fr) auto; gap: 8px;
  align-items: center; padding-bottom: 7px; border-bottom: 1px solid var(--line-faint);
}
.lr-info-card .mini-row:last-child, .lr-info-card .timeline-row:last-child { padding-bottom: 0; border-bottom: 0; }
.lr-info-card .mini-row strong, .lr-info-card .timeline-row strong { color: var(--ink); font-size: 0.78rem; }
.lr-info-card .mini-row small { color: var(--muted); font-size: 0.7rem; font-weight: 700; }
.lr-info-card .mini-row span, .lr-info-card .timeline-row span { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }

.lr-event-banner {
  position: absolute; left: 14px; right: 14px; bottom: 14px; z-index: 15;
  border-radius: 16px;
  background: rgba(48,37,31,0.9);
  color: #fff;
  padding: 12px 14px;
  box-shadow: 0 16px 40px rgba(48,37,31,0.22);
  display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px;
  font-size: 0.86rem;
}
.lr-event-banner strong { font-variant-numeric: tabular-nums; }
.lr-event-banner span {
  color: rgba(255,255,255,0.78);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
@media (max-width: 720px) {
  .lr-event-banner { grid-template-columns: 1fr; }
  .lr-visitor { min-width: 32px; height: 26px; font-size: 0.68rem; }
}

/* Sidebar */
.lr-sidebar { display: grid; gap: 18px; }
.lr-panel {
  background: rgba(255,253,248,0.92);
  border: 1px solid var(--line-faint);
  box-shadow: var(--shadow);
  border-radius: 22px; padding: 18px 20px;
}
.lr-panel h2 { margin: 0 0 12px; font-size: 1rem; letter-spacing: -0.01em; }

.lr-clock {
  border-radius: 14px;
  background: var(--ink); color: #fff;
  padding: 12px;
  margin-bottom: 12px;
}
.lr-clock strong { display: block; font-size: 1.25rem; font-variant-numeric: tabular-nums; }
.lr-clock span { color: rgba(255,255,255,0.7); font-size: 0.78rem; }

.lr-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
.lr-field { display: grid; gap: 5px; }
.lr-field label { color: var(--muted); font-size: 0.74rem; font-weight: 700; }
.lr-field select {
  width: 100%; border: 1px solid var(--line-faint); border-radius: 10px;
  background: #fffaf0; color: var(--ink); padding: 8px 9px; font: inherit; font-size: 0.86rem;
}

.lr-control-row { display: flex; gap: 8px; flex-wrap: wrap; }
.lr-btn {
  appearance: none; border: 0; cursor: pointer;
  border-radius: 999px; padding: 9px 13px;
  background: var(--ink); color: #fff; font: inherit; font-size: 0.84rem; font-weight: 700;
  box-shadow: 0 8px 18px rgba(48,37,31,0.18);
}
.lr-btn.secondary {
  background: #fff1d2; color: #463526;
  border: 1px solid var(--line-faint); box-shadow: none;
}
.lr-btn.danger-soft {
  background: #ffe9e9; color: #743232;
  border: 1px solid rgba(116,50,50,0.16); box-shadow: none;
}
.lr-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.lr-isolate-pill {
  display: none; margin: 10px 0 0;
  padding: 9px 10px; border-radius: 12px;
  background: #eaf6f1; border: 1px solid rgba(61,139,111,0.18);
  color: #2e6653; font-size: 0.82rem; line-height: 1.35;
}
.lr-isolate-pill.is-visible { display: block; }

.lr-legend { display: grid; gap: 10px; }
.lr-legend-item { display: grid; grid-template-columns: 18px 1fr auto; align-items: center; gap: 10px; font-size: 0.88rem; }
.lr-legend .swatch { width: 18px; height: 18px; border-radius: 999px; box-shadow: inset 0 0 0 3px rgba(255,255,255,0.55); }
.lr-legend .count { color: var(--muted); font-variant-numeric: tabular-nums; }

.lr-event-list { display: grid; gap: 8px; max-height: 380px; overflow: auto; padding-right: 4px; }
.lr-event-row {
  padding: 10px 12px; border-radius: 14px;
  background: #fff8e8; border: 1px solid var(--line-faint);
  font-size: 0.82rem; line-height: 1.35; cursor: pointer;
}
.lr-event-row.is-current { background: var(--ink); color: #fff; cursor: default; }
.lr-event-row strong { display: block; font-size: 0.86rem; margin-bottom: 2px; font-variant-numeric: tabular-nums; }
.lr-event-row span { color: var(--muted); }
.lr-event-row.is-current span { color: rgba(255,255,255,0.78); }

.lr-note { margin: 12px 0 0; color: var(--muted); font-size: 0.82rem; line-height: 1.45; }

/* Interest gallery (kept from previous design) */
.lr-thumb { width: 72px; height: 72px; border-radius: 10px; overflow: hidden; border: 1px solid var(--line-faint); background: rgba(184,134,22,0.06); }
.lr-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.lr-thumb-ph { display: flex; align-items: center; justify-content: center; width: 72px; height: 72px; color: var(--muted); font-size: 1.2rem; opacity: 0.5; background: rgba(184,134,22,0.08); border: 1px solid var(--line-faint); border-radius: 10px; }
.lr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.lr-card { background: rgba(255,255,255,0.7); border: 1px solid var(--line-faint); border-radius: 14px; padding: 10px; display: flex; flex-direction: column; gap: 5px; font-size: 0.82rem; }
.lr-card .lr-thumb, .lr-card .lr-thumb-ph { width: 100%; height: auto; aspect-ratio: 1 / 1; }
.lr-title { font-weight: 800; line-height: 1.2; }
.lr-sub { color: var(--muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; }
.lr-stats { font-size: 0.84rem; margin-top: 3px; }

.lr-download-grid { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr); gap: 16px; align-items: start; }
.lr-download-grid h3 { margin: 0 0 8px; font-size: 0.92rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
.lr-download-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.lr-download-table th, .lr-download-table td { padding: 7px 8px; border-bottom: 1px solid var(--line-faint); text-align: left; vertical-align: top; }
.lr-download-table th { color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.7rem; }
.lr-download-file { display: block; color: var(--muted); font-size: 0.72rem; margin-top: 2px; overflow-wrap: anywhere; }
.lr-download-size { color: var(--muted); font-size: 0.72rem; margin-left: 4px; white-space: nowrap; }
.lr-download-kind { display: inline-block; padding: 2px 7px; border-radius: 999px; border: 1px solid var(--line-faint); color: var(--muted); font-size: 0.7rem; font-weight: 800; margin-top: 4px; }
.lr-download-kind.is-all { background: rgba(79,122,58,0.12); color: var(--moss); border-color: rgba(79,122,58,0.24); }
.lr-src-chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.72rem; font-weight: 800; background: rgba(184,134,22,0.14); color: var(--muted); border: 1px solid var(--line-faint); }
.lr-src-instagram { background: linear-gradient(90deg, rgba(225,48,108,0.16), rgba(245,133,41,0.16)); color: #c2185b; }
.lr-src-facebook { background: rgba(24,119,242,0.14); color: #1769aa; }
.lr-src-google { background: rgba(67,133,244,0.14); color: #3367d6; }
.lr-src-whatsapp { background: rgba(37,211,102,0.14); color: #1f8e4d; }
.lr-src-directo { background: rgba(118,85,28,0.12); }
@media (max-width: 920px) { .lr-download-grid { grid-template-columns: 1fr; } }

.lr-empty {
  padding: 22px; text-align: center;
  color: var(--muted); background: rgba(255,255,255,0.5);
  border: 1px dashed var(--line-faint); border-radius: 14px;
  font-size: 0.9rem;
}
.lr-empty strong { color: var(--ink); display: block; margin-bottom: 4px; }

.geo-map { width: 100%; height: 340px; border: 1px solid var(--line-faint); border-radius: 14px; background: rgba(255,255,255,0.45); }
details.jsonl-files summary { cursor: pointer; color: var(--muted); font-weight: 800; font-size: 0.85rem; padding: 4px 0; }
.jsonl-files table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 6px; }
.jsonl-files td, .jsonl-files th { padding: 4px 6px; border-bottom: 1px solid var(--line-faint); text-align: left; }
.jsonl-files code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.78rem; }
</style>
</head>
<body>

<header class="page-header">
  <div>
    <h1>Replay visual do funil <span style="font-weight:400;color:var(--muted);font-size:1rem;">· Live Dashboard</span></h1>
    <p>Período: <strong><?= lr_h($periodLabels[$period]) ?></strong> · <?= lr_h($startDate) ?> → <?= lr_h($endDate) ?></p>
  </div>
  <nav class="period-tabs">
    <?php foreach (array('today','yesterday','7d','30d','90d') as $opt): ?>
      <a href="?period=<?= $opt ?>" class="<?= $opt === $period ? 'is-active' : '' ?>"><?= lr_h($periodLabels[$opt]) ?></a>
    <?php endforeach; ?>
    <form method="get" class="lr-form-inline">
      <input type="hidden" name="period" value="custom">
      <input type="date" name="start" value="<?= lr_h($customStart) ?>">
      <input type="date" name="end" value="<?= lr_h($customEnd) ?>">
      <button type="submit" class="<?= $period === 'custom' ? 'is-active' : '' ?>">Intervalo</button>
    </form>
    <a href="?period=<?= lr_h($period) ?>#" class="back-link">↻ Refresh</a>
    <a href="admin-funnel.php?period=<?= lr_h($period === 'today' || $period === 'yesterday' ? '7d' : $period) ?>" class="back-link">← Funil detalhado</a>
  </nav>
</header>

<main class="lr-dash">

  <!-- Header metrics -->
  <section class="lr-section">
    <h2>Resumo</h2>
    <p class="sub">Eventos no período: <strong><?= count($events) ?></strong>. Sessões distintas: <strong><?= count($sessions) ?></strong>. Submeteram pedido: <strong><?= count($submittedSessions) ?></strong>.</p>
    <div class="metrics">
      <div class="metric"><div class="label">Sessões</div><div class="value"><?= count($sessions) ?></div></div>
      <div class="metric"><div class="label">Eventos</div><div class="value"><?= count($events) ?></div></div>
      <div class="metric"><div class="label">Submetidos</div><div class="value"><?= count($submittedSessions) ?></div></div>
      <div class="metric"><div class="label">Downloads oferta</div><div class="value"><?= (int)$offerDownloadTotal ?></div><div class="sub"><?= (int)$offerDownloadSessionsCount ?> sessões</div></div>
      <div class="metric"><div class="label">IPs públicos</div><div class="value"><?= $publicIpsKnown ?></div><div class="sub"><?= $publicIpsResolved ?> com geo</div></div>
      <div class="metric"><div class="label">Itens com interesse</div><div class="value"><?= count($interest) ?></div></div>
    </div>
  </section>

  <section class="lr-section" id="downloads-ofertas">
    <h2>Downloads de PDFs de oferta</h2>
    <p class="sub">Mostra quem descarregou cada PDF nas páginas de ofertas, dentro do período escolhido.</p>

    <div class="metrics" style="margin-bottom:14px;">
      <div class="metric"><div class="label">Downloads</div><div class="value"><?= (int)$offerDownloadTotal ?></div></div>
      <div class="metric"><div class="label">Sessões com download</div><div class="value"><?= (int)$offerDownloadSessionsCount ?></div></div>
      <div class="metric"><div class="label">Descarregar tudo</div><div class="value"><?= (int)$offerDownloadAllCount ?></div></div>
      <div class="metric"><div class="label">PDFs individuais</div><div class="value"><?= (int)$offerDownloadSingleCount ?></div></div>
    </div>

    <?php if (empty($offerDownloads)): ?>
      <div class="lr-empty"><strong>Sem downloads neste período.</strong>Quando alguém carregar num botão de descarregar PDF, aparece aqui com visitante, hora e ficheiro.</div>
    <?php else: ?>
      <div class="lr-download-grid">
        <div>
          <h3>PDFs mais descarregados</h3>
          <table class="lr-download-table">
            <thead><tr><th>PDF</th><th>Downloads</th><th>Sessões</th></tr></thead>
            <tbody>
              <?php foreach (array_slice($offerDownloadsByFile, 0, 10, true) as $pdf): ?>
                <tr>
                  <td>
                    <strong><?= lr_h($pdf['download_label']) ?></strong>
                    <?php if ($pdf['download_file'] !== ''): ?><span class="lr-download-file"><?= lr_h($pdf['download_file']) ?></span><?php endif; ?>
                    <span class="lr-download-kind<?= $pdf['download_kind'] === 'all' ? ' is-all' : '' ?>"><?= $pdf['download_kind'] === 'all' ? 'Tudo' : 'Individual' ?></span>
                    <?php if ($pdf['download_size'] !== ''): ?><span class="lr-download-size"><?= lr_h($pdf['download_size']) ?></span><?php endif; ?>
                  </td>
                  <td><?= (int)$pdf['count'] ?></td>
                  <td><?= count($pdf['sessions']) ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>

        <div>
          <h3>Últimos downloads</h3>
          <table class="lr-download-table">
            <thead><tr><th>Quando</th><th>Visitante</th><th>PDF</th><th>Origem</th><th>Dispositivo</th></tr></thead>
            <tbody>
              <?php foreach (array_slice($offerDownloads, 0, 80) as $download):
                $deviceLabel = '-';
                if ($download['device_type'] === 'mobile') $deviceLabel = 'Telemóvel';
                elseif ($download['device_type'] === 'tablet') $deviceLabel = 'Tablet';
                elseif ($download['device_type'] === 'desktop') $deviceLabel = 'Desktop';
              ?>
                <tr>
                  <td title="<?= lr_h($download['created_at']) ?>"><?= lr_h(mp_tracking_humanize_iso($download['created_at'])) ?></td>
                  <td>
                    <strong><?= lr_h($download['visitor_label']) ?></strong>
                    <span class="lr-download-file"><code><?= lr_h($download['ip_number'] ?: '-') ?></code></span>
                  </td>
                  <td>
                    <strong><?= lr_h($download['download_label']) ?></strong>
                    <?php if ($download['download_file'] !== ''): ?><span class="lr-download-file"><?= lr_h($download['download_file']) ?></span><?php endif; ?>
                    <span class="lr-download-kind<?= $download['download_kind'] === 'all' ? ' is-all' : '' ?>"><?= $download['download_kind'] === 'all' ? 'Tudo' : 'Individual' ?></span>
                    <?php if ($download['download_size'] !== ''): ?><span class="lr-download-size"><?= lr_h($download['download_size']) ?></span><?php endif; ?>
                  </td>
                  <td><?= lr_attribution_chip($download['attribution']) ?></td>
                  <td><?= lr_h($deviceLabel) ?><?php if ($download['viewport_width']): ?><span class="lr-download-file"><?= (int)$download['viewport_width'] ?>px</span><?php endif; ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      </div>
    <?php endif; ?>
  </section>

  <?php if (empty($sessions)): ?>
    <section class="lr-section">
      <div class="lr-empty"><strong>Sem sessões neste período.</strong>Escolhe outro período ou abre o site para gerar eventos.</div>
    </section>
  <?php else: ?>

  <!-- Metro replay -->
  <section class="lr-replay-shell" id="replay">
    <div class="lr-map-card">
      <div class="lr-map-wrap" id="lrMap">
        <svg class="lr-metro" viewBox="0 0 1000 900" preserveAspectRatio="none" aria-hidden="true">
          <path class="line ghost" d="M500 70 L500 125" />
          <path class="line home-line" d="M500 70 L500 125" />

          <path class="line ghost" d="M500 125 L255 125 Q190 125 190 190 L190 650 Q190 705 245 725 L365 760" />
          <path class="line crachas-line" d="M500 125 L255 125 Q190 125 190 190 L190 650 Q190 705 245 725 L365 760" />

          <path class="line ghost" d="M500 125 L430 125 Q395 125 395 160 L395 650 Q395 710 435 735 L465 760" />
          <path class="line imanes-line" d="M500 125 L430 125 Q395 125 395 160 L395 650 Q395 710 435 735 L465 760" />

          <path class="line ghost" d="M500 125 L570 125 Q605 125 605 160 L605 650 Q605 710 565 735 L535 760" />
          <path class="line caderninhos-line" d="M500 125 L570 125 Q605 125 605 160 L605 650 Q605 710 565 735 L535 760" />

          <path class="line ghost" d="M500 125 L745 125 Q810 125 810 190 L810 650 Q810 705 755 725 L635 760" />
          <path class="line cadernos-line" d="M500 125 L745 125 Q810 125 810 190 L810 650 Q810 705 755 725 L635 760" />

          <path class="line ghost" d="M365 760 L455 760 Q500 760 500 805 Q500 760 545 760 L635 760" />
          <path class="line final-line" d="M365 760 L455 760 Q500 760 500 805 Q500 760 545 760 L635 760" />
          <path class="line ghost" d="M500 805 L500 860" />
          <path class="line final-line" d="M500 805 L500 860" />
        </svg>

        <div class="lr-info-card" id="lrInfoCard" aria-live="polite"></div>
        <div class="lr-event-banner" id="lrEventBanner">
          <strong id="lrBannerTime">--:--:--</strong>
          <span id="lrBannerText">Carrega Play ou Next para começar.</span>
          <span id="lrBannerScope">Todos os pins</span>
        </div>
      </div>
    </div>

    <aside class="lr-sidebar">
      <section class="lr-panel">
        <h2>Replay</h2>
        <div class="lr-clock">
          <strong id="lrClockDisplay">--:--:--</strong>
          <span id="lrClockDate">Sem evento seleccionado</span>
        </div>
        <div class="lr-form-grid">
          <div class="lr-field">
            <label for="lrSpeed">Velocidade</label>
            <select id="lrSpeed">
              <option value="0.5">0,5x</option>
              <option value="1" selected>1x</option>
              <option value="2">2x</option>
              <option value="5">5x</option>
              <option value="10">10x</option>
            </select>
          </div>
          <div class="lr-field">
            <label for="lrJumpMode">Salto</label>
            <select id="lrJumpMode">
              <option value="event" selected>Evento</option>
              <option value="session">Sessão</option>
            </select>
          </div>
        </div>
        <div class="lr-control-row">
          <button class="lr-btn secondary" id="lrPrev">⟵ Previous</button>
          <button class="lr-btn" id="lrPlay">Play</button>
          <button class="lr-btn secondary" id="lrPause">Pause</button>
          <button class="lr-btn secondary" id="lrNext">Next ⟶</button>
        </div>
        <div class="lr-control-row" style="margin-top:10px;">
          <button class="lr-btn secondary" id="lrReset">Reiniciar</button>
          <button class="lr-btn danger-soft" id="lrClearIso">Limpar isolamento</button>
        </div>
        <div class="lr-isolate-pill" id="lrIsolatePill"></div>
        <p class="lr-note">Eventos ordenados por <code>timestamp_ms</code> + <code>client_event_index</code>. Heartbeats omitidos para clareza. Teclas: ← / → / espaço / Esc.</p>
      </section>

      <section class="lr-panel">
        <h2>Linhas</h2>
        <div class="lr-legend" id="lrLegend">
          <div class="lr-legend-item"><i class="swatch" style="background: var(--line-home)"></i><span>Página inicial</span><span class="count" data-line-count="home">0</span></div>
          <div class="lr-legend-item"><i class="swatch" style="background: var(--line-crachas)"></i><span>Crachás</span><span class="count" data-line-count="crachas">0</span></div>
          <div class="lr-legend-item"><i class="swatch" style="background: var(--line-imanes)"></i><span>Ímanes</span><span class="count" data-line-count="imanes">0</span></div>
          <div class="lr-legend-item"><i class="swatch" style="background: var(--line-caderninhos)"></i><span>Caderninhos</span><span class="count" data-line-count="caderninhos">0</span></div>
          <div class="lr-legend-item"><i class="swatch" style="background: var(--line-cadernos)"></i><span>Cadernos</span><span class="count" data-line-count="cadernos">0</span></div>
          <div class="lr-legend-item"><i class="swatch" style="background: var(--line-final)"></i><span>Contacto / envio</span><span class="count" data-line-count="final">0</span></div>
        </div>
      </section>

      <section class="lr-panel">
        <h2>Eventos do replay <span style="color:var(--muted);font-weight:400;font-size:0.84rem;" id="lrEventCounter">0/0</span></h2>
        <div class="lr-event-list" id="lrEventList"></div>
      </section>
    </aside>
  </section>

  <!-- Interest gallery -->
  <section class="lr-section">
    <h2>Interesse dos visitantes</h2>
    <p class="sub">Ampliações, escolhas, abandonos e compras durante o período seleccionado.</p>

    <details open style="margin-top:6px;"><summary style="cursor:pointer;font-weight:800;color:var(--muted);font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;padding:4px 0;">🔍 O que chamou atenção</summary>
      <?php if (empty($topMagnified)): ?>
        <div class="lr-empty">Ainda não há lupas abertas.</div>
      <?php else: ?>
        <div class="lr-grid" style="margin-top:8px;">
          <?php foreach ($topMagnified as $it) echo lr_interest_card($it, 'magnified'); ?>
        </div>
      <?php endif; ?>
    </details>

    <details open style="margin-top:14px;"><summary style="cursor:pointer;font-weight:800;color:var(--muted);font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;padding:4px 0;">✅ O que foi escolhido</summary>
      <?php if (empty($topSelected)): ?>
        <div class="lr-empty">Ainda não há escolhas registadas.</div>
      <?php else: ?>
        <div class="lr-grid" style="margin-top:8px;">
          <?php foreach ($topSelected as $it) echo lr_interest_card($it, 'selected'); ?>
        </div>
      <?php endif; ?>
    </details>

    <details style="margin-top:14px;"><summary style="cursor:pointer;font-weight:800;color:var(--muted);font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;padding:4px 0;">🎉 Escolhido e comprado</summary>
      <?php if (empty($topBought)): ?>
        <div class="lr-empty">Sem compras suficientes para comparar ainda.</div>
      <?php else: ?>
        <div class="lr-grid" style="margin-top:8px;">
          <?php foreach ($topBought as $it) echo lr_interest_card($it, 'bought'); ?>
        </div>
      <?php endif; ?>
    </details>

    <details style="margin-top:14px;"><summary style="cursor:pointer;font-weight:800;color:var(--muted);font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;padding:4px 0;">⚠️ Escolhido mas não comprado</summary>
      <?php if (empty($topAbandoned)): ?>
        <div class="lr-empty">Ainda não há abandonos para mostrar.</div>
      <?php else: ?>
        <div class="lr-grid" style="margin-top:8px;">
          <?php foreach ($topAbandoned as $it) echo lr_interest_card($it, 'abandoned'); ?>
        </div>
      <?php endif; ?>
    </details>

    <details style="margin-top:14px;"><summary style="cursor:pointer;font-weight:800;color:var(--muted);font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;padding:4px 0;">🔍 Ampliado mas não escolhido</summary>
      <?php if (empty($topMagNotSel)): ?>
        <div class="lr-empty">Os itens ampliados também foram escolhidos.</div>
      <?php else: ?>
        <div class="lr-grid" style="margin-top:8px;">
          <?php foreach ($topMagNotSel as $it) echo lr_interest_card($it, 'magnified_not_selected'); ?>
        </div>
      <?php endif; ?>
    </details>
  </section>

  <!-- Geographic map -->
  <section class="lr-section">
    <h2>Mapa geográfico</h2>
    <p class="sub">Localização aproximada por IP público. Apenas resolvido a partir do admin — nunca durante navegação pública.</p>
    <?php if ($allPrivate): ?>
      <div class="lr-empty"><strong>Sem mapa em testes locais.</strong>Quando estiver online, os visitantes com IP público aparecem aqui como pontos aproximados.</div>
    <?php elseif (empty($mapPoints)): ?>
      <div class="lr-empty"><strong>Localização ainda não resolvida.</strong>Vai a <a href="admin-funnel.php?period=30d&amp;enrich=1#mapa-visitantes">Funil detalhado → Resolver mais IPs</a> para popular o cache.</div>
    <?php else: ?>
      <div id="lr-leaflet-map" class="geo-map" data-points='<?= lr_h(json_encode($mapPoints, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) ?>'></div>
    <?php endif; ?>
  </section>

  <?php endif; ?>

  <!-- JSONL files -->
  <section class="lr-section">
    <h2>Eventos JSONL organizados por dia</h2>
    <p class="sub">SQLite é a fonte primária. Os ficheiros JSONL diários estão em <code>private/funnel-jsonl/YYYY-MM-DD.jsonl</code> para replay/export/debug.</p>

    <?php if (!empty($jsonlFiles)): ?>
      <p class="sub">Ficheiros que cobrem o período seleccionado: <strong><?= count($jsonlFiles) ?></strong></p>
    <?php endif; ?>

    <details class="jsonl-files">
      <summary>Ficheiros disponíveis (<?= count($jsonlAll) ?>) — clica para listar</summary>
      <?php if (empty($jsonlAll)): ?>
        <div class="lr-empty" style="margin-top:6px;">Ainda não há ficheiros JSONL diários. O primeiro será criado quando chegar o próximo evento.</div>
      <?php else: ?>
        <table>
          <thead><tr><th>Data</th><th>Tamanho</th><th>Eventos</th></tr></thead>
          <tbody>
            <?php foreach (array_slice($jsonlAll, 0, 60) as $f):
              $bytes = $f['size'];
              $human = $bytes < 1024 ? $bytes . ' B' : ($bytes < 1024*1024 ? round($bytes/1024) . ' KB' : round($bytes/1048576, 1) . ' MB');
              $cnt = mp_funnel_jsonl_count_lines($f['path']);
            ?>
              <tr>
                <td><code><?= lr_h($f['date']) ?></code></td>
                <td><?= lr_h($human) ?></td>
                <td><?= $cnt < 0 ? '?' : $cnt ?></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </details>
  </section>

</main>

<script type="application/json" id="lrReplayData"><?= json_encode($replayPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) ?></script>

<?php if (!empty($mapPoints)): ?>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin="" defer></script>
<?php endif; ?>

<script>
(function () {
  'use strict';

  /* ───────── Parse PHP-rendered payload ───────── */
  var rawNode = document.getElementById('lrReplayData');
  var data = { visitors: [], events: [], stations: [], meta: {} };
  try { data = JSON.parse((rawNode && rawNode.textContent) || '{}') || data; } catch (e) { console.warn('lr replay payload', e); }

  var mapEl = document.getElementById('lrMap');
  if (!mapEl) { initLeaflet(); return; }

  var infoCard = document.getElementById('lrInfoCard');
  var eventListEl = document.getElementById('lrEventList');
  var eventCounterEl = document.getElementById('lrEventCounter');
  var bannerTime = document.getElementById('lrBannerTime');
  var bannerText = document.getElementById('lrBannerText');
  var bannerScope = document.getElementById('lrBannerScope');
  var clockDisplay = document.getElementById('lrClockDisplay');
  var clockDate = document.getElementById('lrClockDate');
  var isolatePill = document.getElementById('lrIsolatePill');

  /* ───────── Lookups ───────── */
  var visitorMap = new Map();
  data.visitors.forEach(function (v) { visitorMap.set(v.key, v); });

  var stationMap = new Map();
  data.stations.forEach(function (s) { stationMap.set(s.id, s); });

  var lineLabel = {
    home: 'Página inicial', crachas: 'Crachás', imanes: 'Ímanes',
    caderninhos: 'Caderninhos', cadernos: 'Cadernos', final: 'Contacto / envio'
  };

  /* ───────── State ───────── */
  var allEvents = data.events.slice();
  var visibleEvents = [];
  var replayIndex = -1;
  var replayTimer = null;
  var selectedVisitorKey = null;
  var selectedStationId = null;
  var isolatedVisitorKey = (data.meta && data.meta.isolatedSid) || null;
  var stationStats = new Map();
  var pins = new Map();

  /* ───────── Utility ───────── */
  function percentX(x) { return ((x / 1000) * 100) + '%'; }
  function percentY(y) { return ((y / 900) * 100) + '%'; }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function clamp(n, a, b) { return Math.min(Math.max(n, a), b); }
  function hashStr(s) {
    var h = 0; s = String(s);
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function jitter(key) {
    var h = hashStr(key);
    return { x: (h % 29) - 14, y: ((h >> 3) % 29) - 14 };
  }
  function fmtTime(ts) {
    if (!ts) return '--:--:--';
    var d = new Date(ts);
    return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  function fmtDate(ts) {
    if (!ts) return 'Sem evento';
    var d = new Date(ts);
    return d.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  /* ───────── Render stations once ───────── */
  function renderStations() {
    data.stations.forEach(function (st) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lr-station' + (st.major ? ' major' : '') + (st.kind ? ' ' + st.kind : '');
      btn.style.left = percentX(st.x);
      btn.style.top = percentY(st.y);
      var lineToVar = { home: '--line-home', crachas: '--line-crachas', imanes: '--line-imanes', caderninhos: '--line-caderninhos', cadernos: '--line-cadernos', final: '--line-final' };
      btn.style.color = 'var(' + (lineToVar[st.line] || '--line-home') + ')';
      btn.title = st.label + ' · ' + st.sub;
      btn.setAttribute('aria-label', 'Estação ' + st.label);
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        selectStation(st.id);
      });
      mapEl.appendChild(btn);
      st._el = btn;
    });
  }

  /* ───────── Event vocabulary ───────── */
  function actionLabelOf(ev) {
    var n = ev.eventName;
    if (n === 'step_view') {
      if (ev.transitionReason === 'back_button' || ev.transitionReason === 'browser_back') return 'voltou atrás';
      if (ev.transitionReason === 'next_button') return 'avançou';
      return 'mudou de passo';
    }
    var m = {
      site_landed: 'entrou no site', wizard_started: 'abriu produto',
      product_view: 'viu produto', step_completed: 'completou passo',
      design_selected: 'escolheu design', design_unselected: 'desmarcou design',
      option_selected: 'escolheu opção', image_magnified: 'ampliou imagem',
      design_zoom_opened: 'ampliou imagem', design_zoom_closed: 'fechou imagem',
      validation_error: 'erro de validação',
      order_submitted: 'enviou pedido', cart_order_submitted: 'enviou pedido',
      delivery_selected: 'escolheu entrega', ui_interaction: 'clicou',
      cart_item_added: 'adicionou ao carrinho', cart_checkout_started: 'iniciou checkout',
      contact_completed: 'completou contacto', confirmation_view: 'viu confirmação',
      selection_updated: 'mudou selecção',
      offer_page_view: 'abriu oferta',
      offer_downloads_seen: 'viu downloads',
      offer_pdf_download_clicked: 'descarregou PDF',
      offer_image_zoom_clicked: 'ampliou imagem',
      offer_scroll_depth: 'continuou na página'
    };
    return m[n] || n;
  }

  function detailFromEvent(ev) {
    var n = ev.eventName;
    if (n === 'design_selected' || n === 'design_unselected') return ev.designTitle || ev.designId || '';
    if (n === 'image_magnified' || n === 'design_zoom_opened') return (ev.designTitle || ev.designId || '') + (ev.imageSlot ? ' · ' + ev.imageSlot : '');
    if (n === 'option_selected') return (ev.optionType ? ev.optionType + ' ' : '') + (ev.optionLabel || '');
    if (n === 'step_view') return ev.stepId || '';
    if (n === 'ui_interaction') return ev.targetLabel || '';
    if (n === 'offer_pdf_download_clicked') return ev.downloadLabel || ev.targetLabel || '';
    if (n === 'offer_image_zoom_clicked') return ev.targetLabel || '';
    return '';
  }

  /* ───────── Apply event ───────── */
  function applyEvent(ev) {
    var visitor = visitorMap.get(ev.visitorKey);
    var pin = pins.get(ev.visitorKey);
    if (!pin && visitor) {
      pin = {
        key: ev.visitorKey, meta: visitor, stationId: null,
        status: 'active', history: [],
        choices: { designs: new Set(), cover: '', size: '', pack: '', lamination: '', personalization: '', delivery: '' },
        magnified: new Set(), offerDownloads: [], lastTs: 0, el: null
      };
      pins.set(ev.visitorKey, pin);
    }
    if (!pin) return;

    pin.stationId = ev.stationId;
    pin.lastTs = ev.ts;
    pin.history.push(ev);
    if (ev.eventName === 'order_submitted' || ev.eventName === 'cart_order_submitted') {
      pin.status = 'completed';
    } else if (ev.eventName === 'design_selected') {
      if (ev.designId) pin.choices.designs.add(ev.designTitle || ev.designId);
    } else if (ev.eventName === 'design_unselected') {
      if (ev.designId) {
        pin.choices.designs.delete(ev.designTitle || ev.designId);
        pin.choices.designs.delete(ev.designId);
      }
    } else if (ev.eventName === 'image_magnified' || ev.eventName === 'design_zoom_opened') {
      if (ev.designId) pin.magnified.add(ev.designTitle || ev.designId);
    } else if (ev.eventName === 'option_selected') {
      var ot = (ev.optionType || '').toLowerCase();
      var ov = ev.optionLabel || ev.optionValue || '';
      if (ot === 'cover' || ot === 'selected_cover') pin.choices.cover = ov;
      else if (ot === 'size') pin.choices.size = ov;
      else if (ot === 'pack' || ot === 'purchase_option' || ot === 'caderno_option' || ot === 'caderno_qty') pin.choices.pack = ov;
      else if (ot === 'lamination') pin.choices.lamination = ov;
      else if (ot === 'cover_personalization' || ot === 'personalization') pin.choices.personalization = ov;
      else if (ot === 'delivery') pin.choices.delivery = ov;
    } else if (ev.eventName === 'offer_pdf_download_clicked') {
      pin.offerDownloads.push({
        label: ev.downloadLabel || ev.targetLabel || 'PDF',
        file: ev.downloadFile || '',
        kind: ev.downloadKind || '',
        size: ev.downloadSize || '',
        at: ev.ts || 0
      });
    }

    var st = stationStats.get(ev.stationId);
    if (!st) { st = { reached: new Set(), choices: new Map(), latest: [] }; stationStats.set(ev.stationId, st); }
    st.reached.add(ev.visitorKey);
    var choiceLabel = detailFromEvent(ev);
    if (choiceLabel && (ev.eventName === 'design_selected' || ev.eventName === 'option_selected')) {
      st.choices.set(choiceLabel, (st.choices.get(choiceLabel) || 0) + 1);
    }
    st.latest.unshift({ ts: ev.ts, visitorKey: ev.visitorKey, label: actionLabelOf(ev), detail: choiceLabel });
    st.latest = st.latest.slice(0, 8);
  }

  function clearPins() {
    pins.forEach(function (p) { if (p.el && p.el.parentNode) p.el.parentNode.removeChild(p.el); });
    pins.clear();
    stationStats.clear();
  }

  /* ───────── Build + render ───────── */
  function buildVisibleEvents() {
    visibleEvents = isolatedVisitorKey
      ? allEvents.filter(function (e) { return e.visitorKey === isolatedVisitorKey; })
      : allEvents.slice();
    if (!visibleEvents.length) replayIndex = -1;
    else replayIndex = clamp(replayIndex < 0 ? 0 : replayIndex, 0, visibleEvents.length - 1);
    rebuildToIndex(replayIndex);
    renderEventList();
  }

  function rebuildToIndex(idx) {
    clearPins();
    selectedStationId = null;
    selectedVisitorKey = null;
    clearStationSelectionStyles();

    for (var i = 0; i <= idx && i < visibleEvents.length; i++) {
      applyEvent(visibleEvents[i]);
    }

    var currentEv = idx >= 0 ? visibleEvents[idx] : null;
    pins.forEach(function (p) { renderPin(p, currentEv && p.key === currentEv.visitorKey); });
    updateBanner(currentEv);
    updateClock(currentEv);
    updateStatusPills();
    updateLegend();
    updateEventCounter();
  }

  function renderPin(p, isCurrent) {
    var station = stationMap.get(p.stationId);
    if (!station) return;
    if (!p.el) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lr-visitor';
      btn.style.setProperty('--visitor-color', p.meta.pinColor || '#b7925a');
      btn.textContent = '#' + (p.meta.miniId || '');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        selectVisitor(p.key);
      });
      mapEl.appendChild(btn);
      p.el = btn;
    }
    var j = jitter(p.key);
    p.el.style.left = percentX(station.x + j.x);
    p.el.style.top = percentY(station.y + j.y);
    p.el.title = '#' + (p.meta.miniId || '') + ' · ' + (p.meta.productName || '') + (p.meta.geo ? ' · ' + p.meta.geo : '');
    p.el.setAttribute('aria-label', p.el.title);
    p.el.classList.toggle('is-selected', selectedVisitorKey === p.key);
    p.el.classList.toggle('is-completed', p.status === 'completed');
    p.el.classList.toggle('is-ended', p.status === 'completed');
    p.el.classList.remove('is-current-event');
    if (isCurrent) { void p.el.offsetWidth; p.el.classList.add('is-current-event'); }
  }

  function clearStationSelectionStyles() {
    data.stations.forEach(function (s) { if (s._el) s._el.classList.remove('is-selected'); });
  }

  /* ───────── Replay controls ───────── */
  function stepNext() {
    if (!visibleEvents.length) return;
    var jmode = document.getElementById('lrJumpMode').value;
    var next = jmode === 'session' ? indexJumpSession(1) : clamp(replayIndex + 1, 0, visibleEvents.length - 1);
    if (next === replayIndex) { pause(); return; }
    replayIndex = next;
    rebuildToIndex(replayIndex);
    renderEventList();
  }
  function stepPrev() {
    if (!visibleEvents.length) return;
    var jmode = document.getElementById('lrJumpMode').value;
    var prev = jmode === 'session' ? indexJumpSession(-1) : clamp(replayIndex - 1, 0, visibleEvents.length - 1);
    replayIndex = prev;
    rebuildToIndex(replayIndex);
    renderEventList();
  }
  function indexJumpSession(dir) {
    var cur = visibleEvents[replayIndex];
    if (!cur) return dir > 0 ? 0 : visibleEvents.length - 1;
    var i = replayIndex;
    while (i + dir >= 0 && i + dir < visibleEvents.length) {
      i += dir;
      if (visibleEvents[i].visitorKey !== cur.visitorKey) return i;
    }
    return i;
  }
  function play() {
    pause();
    if (!visibleEvents.length) return;
    var speed = Number(document.getElementById('lrSpeed').value) || 1;
    var delay = Math.max(80, Math.round(900 / speed));
    replayTimer = setInterval(stepNext, delay);
  }
  function pause() { if (replayTimer) { clearInterval(replayTimer); replayTimer = null; } }
  function reset() {
    pause();
    replayIndex = visibleEvents.length ? 0 : -1;
    rebuildToIndex(replayIndex);
    renderEventList();
  }

  /* ───────── Banner / clock / counter / legend ───────── */
  function updateBanner(ev) {
    if (!ev) {
      bannerTime.textContent = '--:--:--';
      bannerText.textContent = 'Carrega Play ou Next para começar.';
      bannerScope.textContent = isolatedVisitorKey ? 'Pin isolado' : 'Todos os pins';
      return;
    }
    var v = visitorMap.get(ev.visitorKey);
    var st = stationMap.get(ev.stationId);
    bannerTime.textContent = fmtTime(ev.ts);
    var detail = detailFromEvent(ev);
    bannerText.textContent = (v ? '#' + v.miniId + ' · ' + v.productName : '?')
      + ' · ' + actionLabelOf(ev)
      + (detail ? ' · ' + detail : '')
      + (st ? ' · ' + st.label : '');
    bannerScope.textContent = isolatedVisitorKey ? 'Pin isolado' : 'Todos os pins';
  }
  function updateClock(ev) {
    if (!ev) { clockDisplay.textContent = '--:--:--'; clockDate.textContent = 'Sem evento seleccionado'; return; }
    clockDisplay.textContent = fmtTime(ev.ts);
    clockDate.textContent = fmtDate(ev.ts);
  }
  function updateEventCounter() {
    eventCounterEl.textContent = (visibleEvents.length ? replayIndex + 1 : 0) + '/' + visibleEvents.length;
    document.getElementById('lrPrev').disabled = !visibleEvents.length || replayIndex <= 0;
    document.getElementById('lrNext').disabled = !visibleEvents.length || replayIndex >= visibleEvents.length - 1;
    document.getElementById('lrPlay').disabled = !visibleEvents.length || replayIndex >= visibleEvents.length - 1;
    document.getElementById('lrClearIso').disabled = !isolatedVisitorKey;
  }
  function updateStatusPills() {
    if (isolatedVisitorKey) {
      var v = visitorMap.get(isolatedVisitorKey);
      isolatePill.textContent = v ? ('Pin isolado: #' + v.miniId + ' · ' + v.productName) : 'Pin isolado';
      isolatePill.classList.add('is-visible');
    } else {
      isolatePill.textContent = '';
      isolatePill.classList.remove('is-visible');
    }
  }
  function updateLegend() {
    var counts = { home:0, crachas:0, imanes:0, caderninhos:0, cadernos:0, final:0 };
    pins.forEach(function (p) {
      var st = stationMap.get(p.stationId);
      if (!st) return;
      if (counts[st.line] !== undefined) counts[st.line] += 1;
    });
    Object.keys(counts).forEach(function (k) {
      var el = document.querySelector('[data-line-count="' + k + '"]');
      if (el) el.textContent = counts[k];
    });
  }
  function renderEventList() {
    if (!visibleEvents.length) {
      eventListEl.innerHTML = '<div class="lr-event-row"><strong>Sem eventos</strong><span>Não há eventos para este período.</span></div>';
      updateEventCounter();
      return;
    }
    var winStart = Math.max(0, replayIndex - 6);
    var winEnd = Math.min(visibleEvents.length, replayIndex + 9);
    var html = '';
    for (var i = winStart; i < winEnd; i++) {
      var ev = visibleEvents[i];
      var v = visitorMap.get(ev.visitorKey);
      var st = stationMap.get(ev.stationId);
      var detail = detailFromEvent(ev);
      html += '<div class="lr-event-row' + (i === replayIndex ? ' is-current' : '') + '" data-idx="' + i + '">'
        + '<strong>' + escapeHtml(fmtTime(ev.ts)) + ' · #' + escapeHtml(v ? v.miniId : '??') + '</strong>'
        + '<span>' + escapeHtml(actionLabelOf(ev)) + (detail ? ' · ' + escapeHtml(detail) : '') + (st ? ' · ' + escapeHtml(st.label) : '') + '</span>'
        + '</div>';
    }
    eventListEl.innerHTML = html;
    eventListEl.querySelectorAll('.lr-event-row').forEach(function (row) {
      row.addEventListener('click', function () {
        var i = Number(row.getAttribute('data-idx'));
        if (!isNaN(i) && i !== replayIndex) { pause(); replayIndex = i; rebuildToIndex(replayIndex); renderEventList(); }
      });
    });
    updateEventCounter();
  }

  /* ───────── Cards ───────── */
  function selectVisitor(key) {
    selectedStationId = null;
    selectedVisitorKey = key;
    clearStationSelectionStyles();
    pins.forEach(function (p) { renderPin(p, false); });
    var p = pins.get(key);
    if (p) renderVisitorCard(p);
  }

  function selectStation(stationId) {
    selectedVisitorKey = null;
    selectedStationId = stationId;
    pins.forEach(function (p) { renderPin(p, false); });
    clearStationSelectionStyles();
    var st = stationMap.get(stationId);
    if (st && st._el) st._el.classList.add('is-selected');
    renderStationCard(stationId);
  }

  function hideCard() {
    selectedVisitorKey = null;
    selectedStationId = null;
    clearStationSelectionStyles();
    pins.forEach(function (p) { renderPin(p, false); });
    infoCard.classList.remove('is-visible');
    infoCard.innerHTML = '';
  }

  function positionCardNear(st) {
    if (!st) return;
    var x = clamp(st.x, 220, 780);
    var y = st.y < 600 ? st.y + 60 : st.y - 260;
    infoCard.style.left = percentX(x);
    infoCard.style.top = percentY(clamp(y, 80, 700));
    infoCard.classList.add('is-visible');
  }

  function renderVisitorCard(p) {
    var v = p.meta;
    var st = stationMap.get(p.stationId);
    var lastEvents = p.history.slice(-12).reverse().map(function (ev) {
      var stl = stationMap.get(ev.stationId);
      var detail = detailFromEvent(ev);
      return '<div class="timeline-row">'
        + '<strong>' + escapeHtml(actionLabelOf(ev)) + (detail ? ' · ' + escapeHtml(detail) : '') + (stl ? ' · ' + escapeHtml(stl.label) : '') + '</strong>'
        + '<span>' + escapeHtml(fmtTime(ev.ts)) + '</span>'
        + '</div>';
    }).join('') || '<div>Sem acções ainda.</div>';

    var parts = [];
    if (p.choices.designs.size) parts.push('<div><strong>Designs:</strong> ' + escapeHtml(Array.from(p.choices.designs).join(', ')) + '</div>');
    if (p.choices.cover) parts.push('<div><strong>Capa:</strong> ' + escapeHtml(p.choices.cover) + '</div>');
    if (p.choices.size) parts.push('<div><strong>Tamanho:</strong> ' + escapeHtml(p.choices.size) + '</div>');
    if (p.choices.pack) parts.push('<div><strong>Quantidade/Pack:</strong> ' + escapeHtml(p.choices.pack) + '</div>');
    if (p.choices.lamination) parts.push('<div><strong>Laminação:</strong> ' + escapeHtml(p.choices.lamination) + '</div>');
    if (p.choices.personalization) parts.push('<div><strong>Personalização:</strong> ' + escapeHtml(p.choices.personalization) + '</div>');
    if (p.choices.delivery) parts.push('<div><strong>Envio:</strong> ' + escapeHtml(p.choices.delivery) + '</div>');
    var downloads = (p.offerDownloads && p.offerDownloads.length) ? p.offerDownloads : (v.offerDownloads || []);
    var downloadsHtml = downloads.length
      ? downloads.slice(0, 5).map(function (d) {
          var meta = [];
          if (d.kind) meta.push(d.kind === 'all' ? 'Tudo' : 'Individual');
          if (d.size) meta.push(d.size);
          if (d.file) meta.push(d.file);
          return '<div class="mini-row"><strong>' + escapeHtml(d.label || 'PDF') + (meta.length ? '<br><small>' + escapeHtml(meta.join(' - ')) + '</small>' : '') + '</strong><span>' + escapeHtml(d.at ? fmtTime(d.at) : '') + '</span></div>';
        }).join('')
      : '';
    if (p.magnified.size) parts.push('<div><strong>Ampliou:</strong> ' + escapeHtml(Array.from(p.magnified).join(', ')) + '</div>');
    var choicesHtml = parts.length ? parts.join('') : '<div>Ainda não escolheu nada.</div>';

    var statusLabel = p.status === 'completed' ? '✓ Enviou pedido' : 'Activo';
    var ext = v.externalReferrer || '';
    if (ext.length > 90) ext = ext.slice(0, 87) + '…';

    infoCard.innerHTML = ''
      + '<div class="card-head">'
      +   '<div>'
      +     '<h3 class="card-title">Visitante #' + escapeHtml(v.miniId) + '</h3>'
      +     '<p class="card-subtitle">' + escapeHtml(v.productName) + ' · ' + escapeHtml(statusLabel) + (st ? ' · ' + escapeHtml(st.label) : '') + '</p>'
      +   '</div>'
      +   '<button class="close-card" type="button" aria-label="Fechar">×</button>'
      + '</div>'
      + '<div class="detail-grid">'
      +   '<div class="detail"><span>IP</span><strong>' + escapeHtml(v.ip || '—') + '</strong></div>'
      +   '<div class="detail"><span>Identificador</span><strong>#' + escapeHtml(v.miniId) + '</strong></div>'
      +   '<div class="detail"><span>Geolocação</span><strong>' + escapeHtml(v.geo || '—') + '</strong></div>'
      +   '<div class="detail"><span>Dispositivo</span><strong>' + escapeHtml(v.device || '—') + (v.viewport ? ' · ' + escapeHtml(v.viewport) : '') + '</strong></div>'
      +   '<div class="detail wide"><span>Origem</span><strong>' + escapeHtml(v.referrerType || 'unknown') + (v.utmSource ? ' · utm: ' + escapeHtml(v.utmSource) : '') + '</strong></div>'
      +   (ext ? '<div class="detail wide"><span>Referrer externo</span><strong>' + escapeHtml(ext) + '</strong></div>' : '')
      + '</div>'
      + '<h4 class="section-title">O que já escolheu</h4>'
      + '<div class="activity-list">' + choicesHtml + '</div>'
      + (downloadsHtml ? '<h4 class="section-title">PDFs descarregados</h4><div class="mini-table">' + downloadsHtml + '</div>' : '')
      + '<h4 class="section-title">Últimas acções</h4>'
      + '<div class="mini-table">' + lastEvents + '</div>'
      + '<div class="lr-control-row" style="margin-top: 12px;">'
      +   '<button class="lr-btn" type="button" id="lrIsolateBtn">Isolar este pin</button>'
      + '</div>';

    attachCloseHandler();
    var iso = document.getElementById('lrIsolateBtn');
    if (iso) iso.addEventListener('click', function (e) { e.stopPropagation(); isolateVisitor(p.key); });
    positionCardNear(st || stationMap.get('split'));
  }

  function renderStationCard(stationId) {
    var st = stationMap.get(stationId);
    if (!st) return;
    var stat = stationStats.get(stationId) || { reached: new Set(), choices: new Map(), latest: [] };
    var currentlyHere = 0;
    pins.forEach(function (p) { if (p.stationId === stationId) currentlyHere += 1; });
    var topChoices = Array.from(stat.choices.entries())
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 5)
      .map(function (e) { return '<div class="mini-row"><strong>' + escapeHtml(e[0]) + '</strong><span>' + e[1] + 'x</span></div>'; })
      .join('') || '<div>Sem escolhas registadas ainda.</div>';
    var latest = stat.latest.slice(0, 6).map(function (e) {
      var v = visitorMap.get(e.visitorKey);
      return '<div class="timeline-row"><strong>#' + escapeHtml(v ? v.miniId : '??') + ' · ' + escapeHtml(e.label) + (e.detail ? ' · ' + escapeHtml(e.detail) : '') + '</strong><span>' + escapeHtml(fmtTime(e.ts)) + '</span></div>';
    }).join('') || '<div>Sem interacções ainda.</div>';

    infoCard.innerHTML = ''
      + '<div class="card-head">'
      +   '<div>'
      +     '<h3 class="card-title">Estação: ' + escapeHtml(st.label) + '</h3>'
      +     '<p class="card-subtitle">' + escapeHtml(st.sub) + ' · ' + escapeHtml(lineLabel[st.line] || st.line) + '</p>'
      +   '</div>'
      +   '<button class="close-card" type="button" aria-label="Fechar">×</button>'
      + '</div>'
      + '<div class="detail-grid">'
      +   '<div class="detail"><span>Pessoas aqui agora</span><strong>' + currentlyHere + '</strong></div>'
      +   '<div class="detail"><span>Sessões que chegaram</span><strong>' + stat.reached.size + '</strong></div>'
      +   '<div class="detail"><span>Linha</span><strong>' + escapeHtml(lineLabel[st.line] || st.line) + '</strong></div>'
      +   '<div class="detail"><span>Tipo</span><strong>' + escapeHtml(st.statType || st.kind || '—') + '</strong></div>'
      + '</div>'
      + '<h4 class="section-title">Top 5 escolhas aqui</h4>'
      + '<div class="mini-table">' + topChoices + '</div>'
      + '<h4 class="section-title">Últimas interacções</h4>'
      + '<div class="mini-table">' + latest + '</div>';

    attachCloseHandler();
    positionCardNear(st);
  }

  function attachCloseHandler() {
    var btn = infoCard.querySelector('.close-card');
    if (!btn) return;
    btn.addEventListener('click', function (e) { e.stopPropagation(); hideCard(); });
  }

  /* ───────── Isolation ───────── */
  function isolateVisitor(key) {
    pause();
    isolatedVisitorKey = key;
    replayIndex = 0;
    buildVisibleEvents();
    var p = pins.get(key);
    if (p) renderVisitorCard(p);
  }
  function clearIsolation() {
    pause();
    isolatedVisitorKey = null;
    replayIndex = 0;
    buildVisibleEvents();
    hideCard();
  }

  /* ───────── Leaflet ───────── */
  function initLeaflet() {
    try {
      var el = document.getElementById('lr-leaflet-map');
      if (!el || !window.L) return;
      var pts = [];
      try { pts = JSON.parse(el.getAttribute('data-points') || '[]'); } catch (e) {}
      if (!pts.length) return;
      var map = L.map(el, { scrollWheelZoom: false }).setView([20, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
      var bounds = [];
      pts.forEach(function (p) {
        if (typeof p.lat !== 'number' || typeof p.lon !== 'number') return;
        var m = L.circleMarker([p.lat, p.lon], { radius: 7, color: '#4f7a3a', weight: 1, fillColor: '#b88616', fillOpacity: 0.65 }).addTo(map);
        var html = '<strong>' + (p.city || '?') + '</strong>' + (p.region ? ', ' + p.region : '') + '<br>' + (p.country || '') + (p.isp ? '<br>ISP: ' + p.isp : '') + (p.asn ? '<br>' + p.asn : '');
        m.bindPopup(html);
        bounds.push([p.lat, p.lon]);
      });
      if (bounds.length) { try { map.fitBounds(bounds, { padding: [24, 24], maxZoom: 7 }); } catch (e) {} }
    } catch (err) {}
  }

  /* ───────── Bindings ───────── */
  mapEl.addEventListener('click', function (e) {
    if (!e.target.closest('.lr-visitor') && !e.target.closest('.lr-station') && !e.target.closest('.lr-info-card')) hideCard();
  });
  document.getElementById('lrPrev').addEventListener('click', stepPrev);
  document.getElementById('lrNext').addEventListener('click', stepNext);
  document.getElementById('lrPlay').addEventListener('click', play);
  document.getElementById('lrPause').addEventListener('click', pause);
  document.getElementById('lrReset').addEventListener('click', reset);
  document.getElementById('lrClearIso').addEventListener('click', clearIsolation);
  document.getElementById('lrSpeed').addEventListener('change', function () { if (replayTimer) play(); });
  document.getElementById('lrJumpMode').addEventListener('change', updateEventCounter);

  document.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'ArrowRight' || e.key === 'l') { e.preventDefault(); stepNext(); }
    else if (e.key === 'ArrowLeft' || e.key === 'h') { e.preventDefault(); stepPrev(); }
    else if (e.key === ' ') { e.preventDefault(); if (replayTimer) pause(); else play(); }
    else if (e.key === 'Escape') hideCard();
  });

  /* ───────── Boot ───────── */
  renderStations();
  buildVisibleEvents();
  if (window.L) initLeaflet();
  else window.addEventListener('load', initLeaflet);
})();
</script>
</body>
</html>
