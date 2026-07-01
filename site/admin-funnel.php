<?php
/**
 * admin-funnel.php — FUNNEL_DASHBOARD_V2 (lê de SQLite)
 *
 * Dashboard do funil de encomenda. Lê eventos da tabela `funnel_events`
 * (escrita por track-order-event.php desde Fase 8). Mantém-se compatível
 * com a sessão admin existente.
 *
 * Mostra, por produto:
 *   - sessões iniciadas / pedidos enviados / conversão
 *   - sessões em cada passo (com barra relativa)
 *   - maior ponto de abandono
 *   - tempos médios por passo + tempo médio até submit / abandono
 *   - distribuição mobile / desktop / tablet
 *   - distribuição por largura de viewport (5 buckets)
 *   - top erros de validação
 *   - sessões recentes com viewport/orientation/origem
 */

session_start();

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
        . '<title>Acesso negado · Funil</title>'
        . '<style>body{font-family:Georgia,serif;max-width:560px;margin:60px auto;padding:0 20px;color:#3b2f1f;}h1{font-size:1.4rem;}a{color:#4f7a3a;font-weight:700;}</style>'
        . '<h1>Acesso restrito.</h1>'
        . '<p>Inicia sessão como administradora a partir de <a href="index.html">index.html</a> e regressa a esta página.</p>';
    exit;
}

require_once __DIR__ . '/lib/db.php';

// FUNNEL_ADMIN_CSRF_V1: reutiliza o token gerado por admin-orders.php (mesma
// sessão). Cria um próprio se ainda não existir.
if (empty($_SESSION['mp_admin_csrf'])) {
    $_SESSION['mp_admin_csrf'] = bin2hex(random_bytes(16));
}
$csrf = $_SESSION['mp_admin_csrf'];

function admin_funnel_check_csrf()
{
    $sent = isset($_POST['csrf']) ? (string)$_POST['csrf'] : '';
    if ($sent === '' || !hash_equals((string)$_SESSION['mp_admin_csrf'], $sent)) {
        http_response_code(403);
        echo 'CSRF inválido. Recarrega a página e tenta novamente.';
        exit;
    }
}

$flashMessage = '';
$flashType = '';

// TRACKING_IGNORE_AND_ARCHIVE_V1: tratamento das acções POST (ignore list,
// arquivar eventos por IP). Tudo CSRF-protegido.
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    admin_funnel_check_csrf();
    $action = isset($_POST['action']) ? (string)$_POST['action'] : '';

    if ($action === 'archive_by_ips') {
        $ipsRaw = isset($_POST['ips']) ? (string)$_POST['ips'] : '';
        $ipList = mp_db_parse_ip_list($ipsRaw);
        if (empty($ipList)) {
            $flashType = 'error';
            $flashMessage = 'Nenhum IP válido fornecido.';
        } else {
            $count = mp_db_archive_funnel_events_by_ips($ipList, 'admin_archive');
            if ($count < 0) {
                $flashType = 'error';
                $flashMessage = 'Não foi possível arquivar (ver log do servidor).';
            } else {
                $flashType = 'success';
                $flashMessage = $count . ' evento(s) arquivado(s) para os IPs: ' . implode(', ', $ipList) . '.';
            }
        }
    } elseif ($action === 'add_ignore_ip') {
        $ipsRaw = isset($_POST['ips']) ? (string)$_POST['ips'] : '';
        $label = isset($_POST['label']) ? trim((string)$_POST['label']) : '';
        $ipList = mp_db_parse_ip_list($ipsRaw);
        if (empty($ipList)) {
            $flashType = 'error';
            $flashMessage = 'Nenhum IP válido fornecido para a ignore list.';
        } else {
            $added = 0;
            foreach ($ipList as $ip) {
                if (mp_db_add_ignored_ip($ip, $label)) $added++;
            }
            $flashType = 'success';
            $flashMessage = $added . ' IP(s) adicionados à ignore list (' . count($ipList) . ' submetidos, restantes já existiam).';
        }
    } elseif ($action === 'remove_ignore_ip') {
        $ip = isset($_POST['ip']) ? (string)$_POST['ip'] : '';
        if (mp_db_remove_ignored_ip($ip)) {
            $flashType = 'success';
            $flashMessage = 'IP removido da ignore list.';
        } else {
            $flashType = 'error';
            $flashMessage = 'Não foi possível remover esse IP.';
        }
    }

    // Mantém-se na mesma página (preserva query string).
    // O flash é renderizado abaixo.
}

// TRACKING_CLIENT_IP_V1: usa o mesmo IP efectivo que o endpoint público.
// Sob proxy/Cloudflare, REMOTE_ADDR é o IP do proxy e a ignore list deixa
// de funcionar como esperado; mp_tracking_client_ip() compensa isso.
$ipDiagnostics = mp_tracking_ip_diagnostics();
$adminIp = $ipDiagnostics['effective'];
$ignoredIps = mp_db_list_ignored_ips();

function admin_funnel_h($value)
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

$period = isset($_GET['period']) ? (string)$_GET['period'] : '30d';
$periodLabels = array(
    '7d'  => 'últimos 7 dias',
    '30d' => 'últimos 30 dias',
    '90d' => 'últimos 90 dias',
    'all' => 'todos os eventos',
);
if (!isset($periodLabels[$period])) {
    $period = '30d';
}
switch ($period) {
    case '7d':  $cutoff = gmdate('Y-m-d\TH:i:s\Z', strtotime('-7 days')); break;
    case '30d': $cutoff = gmdate('Y-m-d\TH:i:s\Z', strtotime('-30 days')); break;
    case '90d': $cutoff = gmdate('Y-m-d\TH:i:s\Z', strtotime('-90 days')); break;
    case 'all':
    default:    $cutoff = null;
}

$pdo = mp_db();

// Lê eventos do período. Se a tabela ficou vazia (ainda não migrou),
// mostramos empty state.
$sql = 'SELECT * FROM funnel_events';
$params = array();
if ($cutoff !== null) {
    $sql .= ' WHERE created_at >= ?';
    $params[] = $cutoff;
}
$sql .= ' ORDER BY created_at ASC LIMIT 200000';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$events = $stmt->fetchAll();

// OFFER_DOWNLOAD_VISIBILITY_V1: downloads de PDFs de oferta em secção própria.
// Estes eventos já eram guardados como event_json; aqui ficam agregados e
// fáceis de ver no painel, incluindo "quem" (etiqueta/IP técnico) e PDF.
$offerDownloads = array();
$offerDownloadsByFile = array();
$offerDownloadsBySession = array();
foreach ($events as $eventRow) {
    $download = mp_offer_download_from_event($eventRow);
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

// VISITANTES_TEMPO_REAL_V2 (Phase 1)
// Janela maior (até 60 min) e leitura dos últimos eventos completos
// para cada sessão (até 40), de forma a poder reconstruir step path,
// timeline e stream de actividade no dashboard. As consultas são
// limitadas e baratas: indexadas em (session_id, created_at).
$visitorsWindowMinutes = 60;
$visitorsWindowStart = gmdate('Y-m-d\TH:i:s\Z', time() - ($visitorsWindowMinutes * 60));
$visitorSessions = array();
$activityStream = array(); // GLOBAL_ACTIVITY_STREAM_V1
$timelineByteCap = 60; // máx. de eventos no timeline por sessão
try {
    $stmtV = $pdo->prepare(
        "SELECT session_id,
                MIN(created_at) AS first_seen,
                MAX(created_at) AS last_seen,
                COUNT(*) AS event_count,
                MAX(CASE WHEN event_name IN ('order_submitted','cart_order_submitted') THEN 1 ELSE 0 END) AS submitted
         FROM funnel_events
         WHERE created_at >= ?
           AND session_id IS NOT NULL AND session_id <> ''
         GROUP BY session_id
         ORDER BY last_seen DESC
         LIMIT 50"
    );
    $stmtV->execute(array($visitorsWindowStart));
    $visitorAgg = $stmtV->fetchAll();
    if ($visitorAgg) {
        $stmtRecent = $pdo->prepare(
            "SELECT * FROM funnel_events WHERE session_id = ?
             ORDER BY created_at DESC LIMIT ?"
        );
        foreach ($visitorAgg as $row) {
            $stmtRecent->bindValue(1, $row['session_id']);
            $stmtRecent->bindValue(2, $timelineByteCap, PDO::PARAM_INT);
            $stmtRecent->execute();
            $eventsRecent = $stmtRecent->fetchAll();
            if (empty($eventsRecent)) continue;
            // Eventos vêm em DESC; vamos lê-los em ordem cronológica para a reconstrução.
            $eventsRecentAsc = array_reverse($eventsRecent);
            $last = $eventsRecent[0];
            $extra = mp_safe_json_decode(isset($last['event_json']) ? $last['event_json'] : '');
            $stepPath = array();
            $timeline = array();
            $selectionLatest = null;
            $magnifierLatest = null;
            $heartbeatLatestAt = null;
            $firstReferrer = '';
            $utmSource = '';
            foreach ($eventsRecentAsc as $ev) {
                $exJ = mp_safe_json_decode(isset($ev['event_json']) ? $ev['event_json'] : '');
                $nm = isset($ev['event_name']) ? (string)$ev['event_name'] : '';
                // Step path: só step_view, dedup consecutivos.
                if ($nm === 'step_view' && !empty($ev['step_id'])) {
                    if (empty($stepPath) || end($stepPath) !== $ev['step_id']) {
                        $stepPath[] = $ev['step_id'];
                    }
                }
                if ($nm === 'heartbeat') $heartbeatLatestAt = $ev['created_at'];
                if ($nm === 'selection_updated' || $nm === 'step_selection_snapshot' || $nm === 'order_submitted') {
                    $sj = mp_safe_json_decode(isset($ev['selection_json']) ? $ev['selection_json'] : '');
                    if (!empty($sj)) $selectionLatest = $sj;
                }
                if ($nm === 'image_magnified') {
                    $magnifierLatest = array(
                        'at' => $ev['created_at'],
                        'design_id' => isset($exJ['design_id']) ? (string)$exJ['design_id'] : '',
                        'image_slot' => isset($exJ['image_slot']) ? (string)$exJ['image_slot'] : '',
                        'product_slug' => isset($ev['product_slug']) ? (string)$ev['product_slug'] : '',
                    );
                }
                if (!empty($ev['first_referrer']) && $firstReferrer === '') $firstReferrer = $ev['first_referrer'];
                if (!empty($ev['utm_source']) && $utmSource === '') $utmSource = $ev['utm_source'];
                if (count($timeline) < 25) {
                    $timeline[] = array(
                        'at' => $ev['created_at'],
                        'event_name' => $nm,
                        'step_id' => isset($ev['step_id']) ? (string)$ev['step_id'] : '',
                        'product_slug' => isset($ev['product_slug']) ? (string)$ev['product_slug'] : '',
                        'action_name' => isset($exJ['action_name']) ? (string)$exJ['action_name'] : '',
                        'target_label' => isset($exJ['target_label']) ? (string)$exJ['target_label'] : '',
                        'selected_pack' => isset($exJ['selected_pack']) ? (int)$exJ['selected_pack'] : null,
                        'transition_reason' => isset($exJ['transition_reason']) ? (string)$exJ['transition_reason'] : '',
                        'from_step' => isset($exJ['from_step']) ? (string)$exJ['from_step'] : '',
                        'to_step' => isset($exJ['to_step']) ? (string)$exJ['to_step'] : '',
                        'image_slot' => isset($exJ['image_slot']) ? (string)$exJ['image_slot'] : '',
                        'design_id' => isset($exJ['design_id']) ? (string)$exJ['design_id'] : '',
                    );
                }
            }
            $row['last_event']     = $last;
            $row['last_event_name']= isset($last['event_name']) ? (string)$last['event_name'] : '';
            $row['product_slug']   = isset($last['product_slug']) ? (string)$last['product_slug'] : '';
            $row['step_id']        = isset($last['step_id']) ? (string)$last['step_id'] : '';
            $row['device_type']    = isset($last['device_type']) ? (string)$last['device_type'] : '';
            $row['viewport_width'] = isset($last['viewport_width']) ? $last['viewport_width'] : null;
            $row['ip_number']      = isset($last['ip_number']) ? (string)$last['ip_number'] : '';
            $row['landing_page']   = isset($extra['landing_page']) ? (string)$extra['landing_page'] : '';
            $row['referrer']       = isset($extra['referrer']) ? (string)$extra['referrer'] : '';
            $row['first_referrer'] = $firstReferrer;
            $row['utm_source']     = $utmSource;
            $row['action_name']    = isset($extra['action_name']) ? (string)$extra['action_name'] : '';
            $row['target_label']   = isset($extra['target_label']) ? (string)$extra['target_label'] : '';
            $row['offer_downloads'] = isset($offerDownloadsBySession[$row['session_id']])
                ? array_slice($offerDownloadsBySession[$row['session_id']], 0, 4)
                : array();
            $row['step_path']      = $stepPath;
            $row['timeline']       = $timeline;
            $row['selection_latest'] = $selectionLatest;
            $row['magnifier_latest'] = $magnifierLatest;
            $row['heartbeat_latest_at'] = $heartbeatLatestAt;
            $row['attribution']    = mp_attribution_classify(array(
                'utm_source' => $utmSource,
                'first_referrer' => $firstReferrer,
                'referrer' => $row['referrer'],
                'fbclid' => isset($extra['fbclid']) ? $extra['fbclid'] : '',
                'gclid' => isset($extra['gclid']) ? $extra['gclid'] : '',
            ));
            $visitorSessions[] = $row;
        }
    }

    // GLOBAL_ACTIVITY_STREAM_V1: stream curto de eventos mais notórios, em
    // ordem cronológica decrescente. Limitado para 60 entradas. Usa os
    // próprios timelines já lidos para não fazer extra queries.
    foreach ($visitorSessions as $vs) {
        $label = mp_visitor_label_for_ip($vs['ip_number']);
        $productLabel = $vs['product_slug'] !== '' ? product_friendly_name($vs['product_slug']) : '';
        foreach ($vs['timeline'] as $t) {
            $msg = '';
            $nm = $t['event_name'];
            if ($nm === 'wizard_started' && $productLabel) {
                $msg = 'abriu ' . $productLabel;
            } elseif ($nm === 'site_landed') {
                $msg = 'entrou no site';
            } elseif ($nm === 'offer_page_view') {
                $msg = 'abriu ' . ($productLabel ?: 'oferta');
            } elseif ($nm === 'offer_downloads_seen') {
                $msg = 'viu a zona de downloads';
            } elseif ($nm === 'offer_pdf_download_clicked') {
                $msg = 'descarregou PDF' . ($t['target_label'] ? ' “' . $t['target_label'] . '”' : '');
            } elseif ($nm === 'step_view' && $t['to_step']) {
                $msg = 'passou para ' . step_label($t['to_step']);
            } elseif ($nm === 'step_view') {
                $msg = 'abriu passo ' . step_label($t['step_id']);
            } elseif ($nm === 'step_completed') {
                $msg = 'concluiu ' . step_label($t['step_id']);
            } elseif ($nm === 'validation_error') {
                $msg = 'tentou continuar em ' . step_label($t['step_id']) . ' (faltava algo)';
            } elseif ($nm === 'order_submitted') {
                $msg = 'enviou pedido' . ($productLabel ? ' (' . $productLabel . ')' : '');
            } elseif ($nm === 'image_magnified') {
                $msg = 'ampliou ' . ($t['design_id'] ?: 'imagem') . ($t['image_slot'] ? ' · ' . $t['image_slot'] : '');
            } elseif ($nm === 'selection_updated' && $t['selected_pack']) {
                $msg = 'seleccionou pack ' . $t['selected_pack'];
            } elseif ($nm === 'ui_interaction' && $t['action_name']) {
                $msg = 'clicou “' . ($t['target_label'] ?: $t['action_name']) . '”';
            } elseif ($nm === 'contact_completed') {
                $msg = 'completou contacto';
            } elseif ($nm === 'cart_checkout_started') {
                $msg = 'iniciou checkout do carrinho';
            }
            if ($msg !== '') {
                $activityStream[] = array(
                    'at' => $t['at'],
                    'label' => $label,
                    'msg' => $msg,
                    'product_slug' => $vs['product_slug'],
                );
            }
        }
    }
    usort($activityStream, function ($a, $b) {
        return strcmp($b['at'], $a['at']);
    });
    if (count($activityStream) > 60) $activityStream = array_slice($activityStream, 0, 60);
} catch (Exception $e) {
    @error_log('[miaandpaper] visitantes em tempo real falhou: ' . $e->getMessage());
}

// VISITORS_BY_IP_V1 (Phase 1): agregação por IP, dentro do período seleccionado.
$visitorsByIp = array();
try {
    $sqlIp = "SELECT ip_number,
                     COUNT(DISTINCT session_id) AS sessions_count,
                     COUNT(*) AS events_count,
                     MIN(created_at) AS first_seen,
                     MAX(created_at) AS last_seen,
                     MAX(viewport_width) AS last_vw,
                     SUM(CASE WHEN event_name IN ('order_submitted','cart_order_submitted') THEN 1 ELSE 0 END) AS submitted_count
              FROM funnel_events
              WHERE ip_number IS NOT NULL AND ip_number <> ''";
    $paramsIp = array();
    if ($cutoff !== null) { $sqlIp .= ' AND created_at >= ?'; $paramsIp[] = $cutoff; }
    $sqlIp .= ' GROUP BY ip_number ORDER BY last_seen DESC LIMIT 100';
    $stmtIp = $pdo->prepare($sqlIp);
    $stmtIp->execute($paramsIp);
    $rowsIp = $stmtIp->fetchAll();
    if ($rowsIp) {
        $stmtProducts = $pdo->prepare(
            "SELECT DISTINCT product_slug FROM funnel_events
             WHERE ip_number = ? AND product_slug IS NOT NULL AND product_slug <> ''
             ORDER BY product_slug LIMIT 8"
        );
        $stmtIpSessions = $pdo->prepare(
            "SELECT session_id,
                    MIN(created_at) AS started_at,
                    MAX(created_at) AS last_at,
                    COUNT(*) AS events_count,
                    MAX(CASE WHEN event_name IN ('order_submitted','cart_order_submitted') THEN 1 ELSE 0 END) AS submitted,
                    (SELECT product_slug FROM funnel_events WHERE session_id = fe.session_id AND product_slug <> '' ORDER BY created_at DESC LIMIT 1) AS last_product,
                    (SELECT step_id FROM funnel_events WHERE session_id = fe.session_id AND step_id <> '' ORDER BY created_at DESC LIMIT 1) AS last_step
             FROM funnel_events fe
             WHERE ip_number = ?
             GROUP BY session_id
             ORDER BY last_at DESC LIMIT 10"
        );
        foreach ($rowsIp as $r) {
            $stmtProducts->execute(array($r['ip_number']));
            $r['products'] = array_column($stmtProducts->fetchAll(), 'product_slug');
            $stmtIpSessions->execute(array($r['ip_number']));
            $r['sessions'] = $stmtIpSessions->fetchAll();
            $r['is_ignored'] = mp_db_is_ip_ignored($r['ip_number']);
            $r['label'] = mp_visitor_label_for_ip($r['ip_number']);
            $visitorsByIp[] = $r;
        }
    }
} catch (Exception $e) {
    @error_log('[miaandpaper] visitors_by_ip falhou: ' . $e->getMessage());
}

// Step order por produto, lendo o JSON.
$productOrders = array();
$productNames = array();
$productDir = __DIR__ . '/content/products';
if (is_dir($productDir)) {
    foreach (glob($productDir . '/*.json') as $jsonPath) {
        $slug = basename($jsonPath, '.json');
        $raw = @file_get_contents($jsonPath);
        if ($raw === false) continue;
        $config = json_decode($raw, true);
        if (!is_array($config) || !isset($config['steps'])) continue;
        $order = array();
        foreach ($config['steps'] as $step) {
            if (isset($step['id'])) $order[] = $step['id'];
        }
        $productOrders[$slug] = $order;
        $productNames[$slug] = isset($config['name']) ? (string)$config['name'] : $slug;
    }
}

// Agrega por sessão + produto.
$bySession = array();
foreach ($events as $e) {
    $sid = $e['session_id'] ?: '';
    $product = $e['product_slug'] ?: '';
    if ($sid === '' || $product === '') continue;
    $key = $sid . '|' . $product;
    if (!isset($bySession[$key])) {
        $bySession[$key] = array('product' => $product, 'events' => array());
    }
    $bySession[$key]['events'][] = $e;
}

function new_product_bucket()
{
    return array(
        'sessions' => 0,
        'steps' => array(),
        'submitted' => 0,
        'devices' => array('mobile' => 0, 'tablet' => 0, 'desktop' => 0),
        'viewport_buckets' => array('<=360' => 0, '361-390' => 0, '391-430' => 0, '431-767' => 0, '>=768' => 0),
        'validation_errors' => array(),
        'step_durations' => array(),
        'step_durations_by_device' => array(),
        'submit_durations' => array(),
        'abandon_durations' => array(),
        'sessions_recent' => array(),
        // CLICK_TRACKING_V1
        'actions_by_step' => array(),   // step_id => array(action => count)
        'dead_taps_by_step' => array(), // step_id => count
        'dead_taps_by_bucket' => array('<=360' => 0, '361-390' => 0, '391-430' => 0, '431-767' => 0, '>=768' => 0),
        'dead_tap_grid' => array(),     // step_id => 20x20 grid (key "x,y" => count)
        // SELECTION_AGGREGATION_V1 (Phase 4)
        'design_selected_count'   => array(),  // design_id => total selecções
        'design_selected_sessions'=> array(),  // design_id => array(session_id => true)
        'design_purchased_sessions'=> array(), // design_id => array(session_id => true)
        'options_selected'        => array(),  // option_key => count
        // MAGNIFIER_AGGREGATION_V1 (Phase 5)
        'magnifier_by_design'     => array(),  // design_id => total ampliações
        'magnifier_by_slot'       => array(),  // image_slot => count
        'magnifier_sessions'      => array(),  // design_id => array(session_id => true)
        // TRANSITION_REASON_V1 (Phase 7)
        'transition_reasons'      => array(),  // reason => count
    );
}

$products = array();
foreach (array_keys($productOrders) as $slug) {
    $products[$slug] = new_product_bucket();
}

function viewport_bucket($w)
{
    if ($w === null || $w === '') return null;
    $w = (int)$w;
    if ($w <= 360) return '<=360';
    if ($w <= 390) return '361-390';
    if ($w <= 430) return '391-430';
    if ($w <= 767) return '431-767';
    return '>=768';
}

foreach ($bySession as $session) {
    $slug = $session['product'];
    if (!isset($products[$slug])) {
        $products[$slug] = new_product_bucket();
        if (!isset($productOrders[$slug])) $productOrders[$slug] = array();
        if (!isset($productNames[$slug])) $productNames[$slug] = $slug;
    }
    $products[$slug]['sessions']++;

    $stepsSeen = array();
    $lastStepStart = array();
    $sessionStart = null;
    $lastEvent = null;
    $orderSubmitted = false;
    $deviceLogged = false;
    $sessionDevice = null;
    $sessionViewport = null;
    $sessionOrientation = null;
    $sessionIp = null;

    foreach ($session['events'] as $e) {
        $time = isset($e['created_at']) ? strtotime($e['created_at']) : null;
        if ($time === null) continue;
        if ($sessionStart === null) $sessionStart = $time;
        $lastEvent = $time;
        $name = $e['event_name'] ?: '';

        if (!$deviceLogged) {
            $dev = $e['device_type'] ?: 'desktop';
            if (!in_array($dev, array('mobile', 'tablet', 'desktop'), true)) $dev = 'desktop';
            $products[$slug]['devices'][$dev]++;
            $deviceLogged = true;
            $sessionDevice = $dev;
            $sessionViewport = $e['viewport_width'];
            $sessionOrientation = $e['orientation'];
            $sessionIp = $e['ip_number'];

            $bucket = viewport_bucket($e['viewport_width']);
            if ($bucket !== null) $products[$slug]['viewport_buckets'][$bucket]++;
        }

        if ($name === 'step_view' && !empty($e['step_id'])) {
            $stepsSeen[$e['step_id']] = true;
            $lastStepStart[$e['step_id']] = $time;
        } elseif ($name === 'step_completed' && !empty($e['step_id'])) {
            $stepId = $e['step_id'];
            if (isset($lastStepStart[$stepId])) {
                $delta = $time - $lastStepStart[$stepId];
                if ($delta >= 0) {
                    if (!isset($products[$slug]['step_durations'][$stepId])) $products[$slug]['step_durations'][$stepId] = array();
                    $products[$slug]['step_durations'][$stepId][] = $delta;
                    if ($sessionDevice) {
                        $key = $stepId . '|' . $sessionDevice;
                        if (!isset($products[$slug]['step_durations_by_device'][$key])) {
                            $products[$slug]['step_durations_by_device'][$key] = array();
                        }
                        $products[$slug]['step_durations_by_device'][$key][] = $delta;
                    }
                }
            }
        } elseif ($name === 'order_submitted') {
            $orderSubmitted = true;
            if ($sessionStart !== null) {
                $products[$slug]['submit_durations'][] = $time - $sessionStart;
            }
        } elseif ($name === 'validation_error' && !empty($e['step_id'])) {
            $stepId = $e['step_id'];
            if (!isset($products[$slug]['validation_errors'][$stepId])) $products[$slug]['validation_errors'][$stepId] = 0;
            $products[$slug]['validation_errors'][$stepId]++;
        } elseif (($name === 'ui_interaction' || $name === 'offer_pdf_download_clicked') && !empty($e['step_id'])) {
            // CLICK_TRACKING_V1: agregar acções por passo
            $stepId = $e['step_id'];
            $action = '';
            $extra = isset($e['event_json']) ? json_decode($e['event_json'], true) : null;
            if (is_array($extra) && !empty($extra['action_name'])) {
                $action = (string)$extra['action_name'];
            } elseif (is_array($extra) && !empty($extra['target_id'])) {
                $action = 'click:' . (string)$extra['target_id'];
            } else {
                $action = 'click';
            }
            if (!isset($products[$slug]['actions_by_step'][$stepId])) $products[$slug]['actions_by_step'][$stepId] = array();
            if (!isset($products[$slug]['actions_by_step'][$stepId][$action])) $products[$slug]['actions_by_step'][$stepId][$action] = 0;
            $products[$slug]['actions_by_step'][$stepId][$action]++;
        } elseif ($name === 'dead_tap') {
            $stepId = $e['step_id'] ?: '(sem passo)';
            if (!isset($products[$slug]['dead_taps_by_step'][$stepId])) $products[$slug]['dead_taps_by_step'][$stepId] = 0;
            $products[$slug]['dead_taps_by_step'][$stepId]++;
            $bucket = viewport_bucket($e['viewport_width']);
            if ($bucket !== null) $products[$slug]['dead_taps_by_bucket'][$bucket]++;
            $extra = isset($e['event_json']) ? json_decode($e['event_json'], true) : null;
            if (is_array($extra) && isset($extra['x_percent']) && isset($extra['y_percent'])) {
                $gx = (int)floor(((float)$extra['x_percent']) / 5);   // 100 / 20 = 5
                $gy = (int)floor(((float)$extra['y_percent']) / 5);
                if ($gx < 0) $gx = 0; if ($gx > 19) $gx = 19;
                if ($gy < 0) $gy = 0; if ($gy > 19) $gy = 19;
                if (!isset($products[$slug]['dead_tap_grid'][$stepId])) $products[$slug]['dead_tap_grid'][$stepId] = array();
                $cell = $gx . ',' . $gy;
                if (!isset($products[$slug]['dead_tap_grid'][$stepId][$cell])) $products[$slug]['dead_tap_grid'][$stepId][$cell] = 0;
                $products[$slug]['dead_tap_grid'][$stepId][$cell]++;
            }
        } elseif ($name === 'image_magnified') {
            // MAGNIFIER_AGGREGATION_V1 (Phase 5)
            $extra = isset($e['event_json']) ? json_decode($e['event_json'], true) : null;
            if (!is_array($extra)) $extra = array();
            $designId = isset($extra['design_id']) ? (string)$extra['design_id'] : (isset($extra['item_id']) ? (string)$extra['item_id'] : '');
            $slot = isset($extra['image_slot']) ? (string)$extra['image_slot'] : 'main';
            if ($designId !== '') {
                if (!isset($products[$slug]['magnifier_by_design'][$designId])) $products[$slug]['magnifier_by_design'][$designId] = 0;
                $products[$slug]['magnifier_by_design'][$designId]++;
                if (!isset($products[$slug]['magnifier_sessions'][$designId])) $products[$slug]['magnifier_sessions'][$designId] = array();
                $products[$slug]['magnifier_sessions'][$designId][$e['session_id']] = true;
            }
            if (!isset($products[$slug]['magnifier_by_slot'][$slot])) $products[$slug]['magnifier_by_slot'][$slot] = 0;
            $products[$slug]['magnifier_by_slot'][$slot]++;
        } elseif ($name === 'selection_updated' || $name === 'step_selection_snapshot') {
            // SELECTION_AGGREGATION_V1 (Phase 4)
            $sel = isset($e['selection_json']) ? json_decode($e['selection_json'], true) : null;
            if (is_array($sel)) {
                if (!empty($sel['selected_designs']) && is_array($sel['selected_designs'])) {
                    foreach ($sel['selected_designs'] as $did) {
                        $did = (string)$did;
                        if ($did === '') continue;
                        if (!isset($products[$slug]['design_selected_count'][$did])) $products[$slug]['design_selected_count'][$did] = 0;
                        $products[$slug]['design_selected_count'][$did]++;
                        if (!isset($products[$slug]['design_selected_sessions'][$did])) $products[$slug]['design_selected_sessions'][$did] = array();
                        $products[$slug]['design_selected_sessions'][$did][$e['session_id']] = true;
                    }
                }
                $optionKeys = array('selected_pack', 'selected_size', 'lamination', 'caderno_option', 'caderno_qty', 'cover_personalization', 'assorted');
                foreach ($optionKeys as $ok) {
                    if (!isset($sel[$ok])) continue;
                    $val = (string)$sel[$ok];
                    if ($val === '' || $val === '0') continue;
                    $key = $ok . '=' . substr($val, 0, 60);
                    if (!isset($products[$slug]['options_selected'][$key])) $products[$slug]['options_selected'][$key] = 0;
                    $products[$slug]['options_selected'][$key]++;
                }
            }
        }

        // TRANSITION_REASON_AGGREGATION_V1 (Phase 7)
        if ($name === 'step_view' || $name === 'validation_error') {
            $extraTr = isset($e['event_json']) ? json_decode($e['event_json'], true) : null;
            if (is_array($extraTr) && !empty($extraTr['transition_reason'])) {
                $rsn = (string)$extraTr['transition_reason'];
                if (!isset($products[$slug]['transition_reasons'][$rsn])) $products[$slug]['transition_reasons'][$rsn] = 0;
                $products[$slug]['transition_reasons'][$rsn]++;
            }
        }
    }

    // SELECTION_AGGREGATION_V1: marca os designs seleccionados como "comprados"
    // se a sessão acabou com order_submitted (já temos $orderSubmitted no fim
    // do loop). Iteramos novamente eventos para pegar nas selecções finais.
    if ($orderSubmitted) {
        // Encontra a última selection_json conhecida da sessão.
        $finalSelection = null;
        for ($i = count($session['events']) - 1; $i >= 0; $i--) {
            $ev = $session['events'][$i];
            if (!empty($ev['selection_json'])) {
                $s = json_decode($ev['selection_json'], true);
                if (is_array($s)) { $finalSelection = $s; break; }
            }
        }
        if (is_array($finalSelection) && !empty($finalSelection['selected_designs'])) {
            foreach ($finalSelection['selected_designs'] as $did) {
                $did = (string)$did;
                if ($did === '') continue;
                if (!isset($products[$slug]['design_purchased_sessions'][$did])) $products[$slug]['design_purchased_sessions'][$did] = array();
                $products[$slug]['design_purchased_sessions'][$did][$session['events'][0]['session_id']] = true;
            }
        }
    }

    foreach (array_keys($stepsSeen) as $stepId) {
        if (!isset($products[$slug]['steps'][$stepId])) $products[$slug]['steps'][$stepId] = 0;
        $products[$slug]['steps'][$stepId]++;
    }

    if ($orderSubmitted) {
        $products[$slug]['submitted']++;
    } elseif ($sessionStart !== null && $lastEvent !== null) {
        $products[$slug]['abandon_durations'][] = $lastEvent - $sessionStart;
    }

    // Top 20 sessões recentes para o painel "Sessões".
    if (count($products[$slug]['sessions_recent']) < 20) {
        $products[$slug]['sessions_recent'][] = array(
            'device' => $sessionDevice,
            'viewport' => $sessionViewport,
            'orientation' => $sessionOrientation,
            'ip' => $sessionIp,
            'started_at' => $sessionStart,
            'submitted' => $orderSubmitted,
            'last_step' => array_keys($stepsSeen),
        );
    }
}

function fmt_seconds($seconds)
{
    $seconds = (int)round($seconds);
    if ($seconds < 60) return $seconds . 's';
    if ($seconds < 3600) return floor($seconds / 60) . 'm ' . ($seconds % 60) . 's';
    return floor($seconds / 3600) . 'h ' . floor(($seconds % 3600) / 60) . 'm';
}

function avg_seconds($arr)
{
    if (empty($arr)) return null;
    return array_sum($arr) / count($arr);
}

function step_label($id)
{
    static $labels = array(
        'designs'              => 'Escolheram designs',
        'size'                 => 'Escolheram tamanho',
        'pack'                 => 'Escolheram quantidade',
        'details'              => 'Dados do cartão',
        'delivery_contact'     => 'Entrega e contacto',
        'confirm'              => 'Confirmação',
        // CADERNOS_FUNNEL_V1: passos próprios dos cadernos.
        'lamination'           => 'Escolheram laminação',
        'cover_personalization'=> 'Personalização da capa',
        'ofertas'              => 'Ofertas',
        'oferta-pdf'           => 'PDF de oferta',
        'oferta-convite-congresso' => 'Envelopes do Congresso',
    );
    return isset($labels[$id]) ? $labels[$id] : $id;
}

// CADERNOS_FUNNEL_V1: nome amigável por slug. Cobre o caso em que o JSON do
// produto não está disponível (ex.: produto descontinuado mas ainda com
// eventos no histórico) e garante que cadernos aparece no dashboard com
// nome próprio em vez do slug "cru".
function product_friendly_name($slug, $fallbackFromJson = '')
{
    static $names = array(
        'crachas'     => 'Crachás',
        'imanes'      => 'Ímanes',
        'caderninhos' => 'Mini-Cadernos',
        'cadernos'    => 'Cadernos',
        'lembrancas'  => 'Lembranças',
        'pins'        => 'Pins',
        'ofertas'     => 'Ofertas',
        'oferta-pdf'  => 'PDF de oferta',
        'oferta-convite-congresso' => 'Envelopes do Congresso',
    );
    if (isset($names[$slug]) && $names[$slug] !== '') return $names[$slug];
    if ($fallbackFromJson !== '' && $fallbackFromJson !== $slug) return $fallbackFromJson;
    return $slug;
}

function mp_offer_download_from_event($event)
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
        'product_label' => product_friendly_name($productSlug),
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

// LIVE_DASHBOARD_HELPERS_V1 (Phase 1)

// "Ball on field" — render compacto de progresso. Devolve HTML.
function render_step_track($productSlug, $currentStepId, $productOrders) {
    $stepIds = isset($productOrders[$productSlug]) ? $productOrders[$productSlug] : array();
    if (empty($stepIds)) return '';
    $out = '<div class="step-track" aria-label="Progresso do funil">';
    foreach ($stepIds as $sid) {
        $active = $sid === $currentStepId ? ' is-current' : '';
        $label = step_label($sid);
        $out .= '<span class="step-track-dot' . $active . '" title="' . admin_funnel_h($label) . '"></span>';
    }
    $out .= '</div>';
    return $out;
}

// Texto da rota recente (Designs → Quantidade → Designs)
function render_step_path($stepPath) {
    if (empty($stepPath)) return '<span class="muted">—</span>';
    // Se houver ping-pong entre 2 passos, colapsa em A ⇄ B.
    if (count($stepPath) >= 3) {
        $unique = array_values(array_unique($stepPath));
        if (count($unique) === 2) {
            $a = $unique[0]; $b = $unique[1];
            $changes = 0;
            for ($i = 1; $i < count($stepPath); $i++) {
                if ($stepPath[$i] !== $stepPath[$i - 1]) $changes++;
            }
            if ($changes >= 2) {
                return admin_funnel_h(step_label($a)) . ' ⇄ ' . admin_funnel_h(step_label($b));
            }
        }
    }
    $labels = array_map(function ($s) { return admin_funnel_h(step_label($s)); }, $stepPath);
    return implode(' → ', $labels);
}

// Renderiza uma linha de timeline em PT-PT.
function render_timeline_entry($t, $localTzHHMM = '') {
    $time = '';
    try {
        $tz = new DateTimeZone('Europe/Lisbon');
        $dt = new DateTime($t['at']);
        $dt->setTimezone($tz);
        $time = $dt->format('H:i:s');
    } catch (Exception $e) { $time = substr($t['at'], 11, 8); }

    $product = isset($t['product_slug']) && $t['product_slug'] !== '' ? product_friendly_name($t['product_slug']) : '';
    $stepLabel = isset($t['step_id']) && $t['step_id'] !== '' ? step_label($t['step_id']) : '';
    $msg = '';
    $name = isset($t['event_name']) ? $t['event_name'] : '';
    if ($name === 'site_landed') $msg = 'entrou no site';
    elseif ($name === 'wizard_started') $msg = 'iniciou ' . $product;
    elseif ($name === 'offer_page_view') $msg = 'abriu ' . ($product ?: 'oferta');
    elseif ($name === 'offer_downloads_seen') $msg = 'viu a zona de downloads';
    elseif ($name === 'offer_pdf_download_clicked') {
        $lab = $t['target_label'] !== '' ? $t['target_label'] : 'PDF';
        $msg = 'descarregou PDF “' . $lab . '”';
    }
    elseif ($name === 'offer_image_zoom_clicked') {
        $lab = $t['target_label'] !== '' ? $t['target_label'] : 'imagem';
        $msg = 'ampliou ' . $lab;
    }
    elseif ($name === 'offer_scroll_depth') $msg = 'continuou a ver a página';
    elseif ($name === 'step_view') {
        if ($t['transition_reason'] === 'back_button' || $t['transition_reason'] === 'browser_back') {
            $msg = 'voltou para ' . ($t['to_step'] ? step_label($t['to_step']) : $stepLabel);
        } else {
            $msg = 'passou para ' . ($t['to_step'] ? step_label($t['to_step']) : $stepLabel);
        }
    }
    elseif ($name === 'step_completed') $msg = 'completou ' . $stepLabel;
    elseif ($name === 'validation_error') $msg = 'tentou continuar mas faltou algo em ' . $stepLabel;
    elseif ($name === 'order_submitted') $msg = 'enviou o pedido';
    elseif ($name === 'image_magnified') $msg = 'ampliou ' . ($t['design_id'] ?: 'imagem') . ($t['image_slot'] ? ' · ' . $t['image_slot'] : '');
    elseif ($name === 'selection_updated') $msg = 'mudou selecção' . ($t['selected_pack'] ? ' (pack ' . (int)$t['selected_pack'] . ')' : '');
    elseif ($name === 'step_selection_snapshot') $msg = 'snapshot de selecção em ' . $stepLabel;
    elseif ($name === 'ui_interaction') {
        $lab = $t['target_label'] !== '' ? $t['target_label'] : ($t['action_name'] ?: 'clique');
        $msg = 'clicou “' . admin_funnel_h($lab) . '”';
    }
    elseif ($name === 'dead_tap') $msg = 'tocou em zona sem acção em ' . $stepLabel;
    elseif ($name === 'heartbeat') $msg = 'continua activo';
    elseif ($name === 'contact_completed') $msg = 'completou contacto';
    elseif ($name === 'delivery_selected') $msg = 'escolheu entrega';
    elseif ($name === 'cart_order_submitted') $msg = 'enviou pedido (carrinho)';
    else { $msg = $name; }

    $head = '<span class="t-time">' . admin_funnel_h($time) . '</span>';
    $body = '<span class="t-msg">' . ($msg === '' ? '—' : ($name === 'ui_interaction' ? $msg : admin_funnel_h($msg))) . '</span>';
    return '<li class="timeline-entry">' . $head . ' ' . $body . '</li>';
}

// Resumo de selecção: ex "3 designs · Pack 24", "Caderno 04 · Holográfico · Pack Normal"
function render_selection_summary($selectionJson) {
    if (empty($selectionJson) || !is_array($selectionJson)) return '';
    $parts = array();
    if (!empty($selectionJson['selected_designs']) && is_array($selectionJson['selected_designs'])) {
        $count = isset($selectionJson['selection_count']) ? (int)$selectionJson['selection_count'] : count($selectionJson['selected_designs']);
        if ($count > 0) $parts[] = $count . ' design' . ($count === 1 ? '' : 's') . ' seleccionado' . ($count === 1 ? '' : 's');
    } elseif (!empty($selectionJson['assorted'])) {
        $parts[] = 'modo sortido';
    }
    if (!empty($selectionJson['selected_pack'])) {
        $parts[] = 'Pack ' . (int)$selectionJson['selected_pack'];
    }
    if (!empty($selectionJson['selected_size'])) $parts[] = $selectionJson['selected_size'];
    if (!empty($selectionJson['lamination'])) {
        $lam = $selectionJson['lamination'];
        $lamMap = array(
            'glossy-normal' => 'Glossy',
            'matte' => 'Matte',
            'glitter-branco' => 'Glitter branco',
            'holografica' => 'Holográfico',
        );
        $parts[] = isset($lamMap[$lam]) ? $lamMap[$lam] : $lam;
    }
    if (!empty($selectionJson['caderno_option'])) {
        $optMap = array('normal' => 'Pack Normal', 'pioneiro' => 'Pack Pioneiro');
        $parts[] = isset($optMap[$selectionJson['caderno_option']]) ? $optMap[$selectionJson['caderno_option']] : $selectionJson['caderno_option'];
    }
    if (!empty($selectionJson['caderno_qty'])) $parts[] = 'qtd ' . (int)$selectionJson['caderno_qty'];
    if (isset($selectionJson['cover_personalization'])) {
        $parts[] = $selectionJson['cover_personalization'] ? 'com personalização' : 'sem personalização';
    }
    return implode(' · ', $parts);
}

// Texto de actividade ("ativo há 12s", "a ler/parado há 2m")
function render_activity_state($lastSeenIso, $heartbeatLatestAt = null, $nowTs = null) {
    if (!$nowTs) $nowTs = time();
    $lastTs = strtotime($lastSeenIso);
    $age = $nowTs - $lastTs;
    if ($age < 0) $age = 0;

    // Se houve heartbeat recente, usa como "ainda activo".
    $hbAge = $heartbeatLatestAt ? ($nowTs - strtotime($heartbeatLatestAt)) : null;

    if ($age <= 60) return array('label' => 'ativo há ' . $age . ' s', 'color' => '#4f7a3a', 'state' => 'active');
    if ($age <= 300) return array('label' => 'ativo há ' . (int)floor($age / 60) . ' min', 'color' => '#4f7a3a', 'state' => 'active');
    if ($hbAge !== null && $hbAge <= 90) return array('label' => 'a ler/parado há ' . (int)floor($age / 60) . ' min', 'color' => '#b88616', 'state' => 'idle');
    if ($age <= 900) return array('label' => 'a ler/parado há ' . (int)floor($age / 60) . ' min', 'color' => '#b88616', 'state' => 'idle');
    return array('label' => 'sem sinal há ' . (int)floor($age / 60) . ' min', 'color' => '#999', 'state' => 'gone');
}

// ============================================================
// INTERESSE_VISITANTES_V1 — image catalog + interest aggregation
// ============================================================
//
// Constrói um catálogo (em memória, sem cache disco) que mapeia:
//   - product_slug → nome do produto
//   - por product_slug, dois índices:
//       by_value:    selection value (ex.: "Caderno 04") → record
//       by_basename: filename sem extensão (ex.: "img (27)", "1000133037",
//                    "pin-01", "laminacao-matte") → record
//
// Necessário porque:
//   - selection_json.selected_designs guarda o "value" dos items
//   - image_magnified.design_id guarda o basename do ficheiro (ver
//     funnelExtractDesignIdFromSrc em app.js)
//
// Os dois nem sempre coincidem (cadernos usa "img (27).jpg"); a função de
// lookup tenta ambos e devolve null se nenhum bater.
function mp_build_product_catalog($productDir) {
    $catalog = array();
    if (!is_dir($productDir)) return $catalog;
    foreach (glob($productDir . '/*.json') as $jsonPath) {
        $slug = basename($jsonPath, '.json');
        $raw = @file_get_contents($jsonPath);
        if ($raw === false) continue;
        $config = json_decode($raw, true);
        if (!is_array($config)) continue;
        $entry = array(
            'name' => isset($config['name']) ? (string)$config['name'] : $slug,
            'by_value' => array(),
            'by_basename' => array(),
        );
        if (empty($config['steps']) || !is_array($config['steps'])) {
            $catalog[$slug] = $entry;
            continue;
        }
        foreach ($config['steps'] as $step) {
            $stepId = isset($step['id']) ? (string)$step['id'] : '';
            if (empty($step['items']) || !is_array($step['items'])) continue;
            foreach ($step['items'] as $it) {
                if (!is_array($it)) continue;
                $value = '';
                if (isset($it['value'])) $value = (string)$it['value'];
                elseif (isset($it['id'])) $value = (string)$it['id'];
                $id = isset($it['id']) ? (string)$it['id'] : $value;
                $title = isset($it['title']) ? (string)$it['title'] : $value;
                $subtitle = isset($it['subtitle']) ? (string)$it['subtitle'] : '';
                $image = isset($it['image']) ? (string)$it['image'] : '';
                $slot = mp_step_to_slot($stepId, $image);
                $record = array(
                    'product_slug' => $slug,
                    'product_name' => $entry['name'],
                    'step_id' => $stepId,
                    'value' => $value,
                    'id' => $id,
                    'title' => $title,
                    'subtitle' => $subtitle,
                    'image' => $image,
                    'slot' => $slot,
                );
                if ($value !== '') $entry['by_value'][$value] = $record;
                // INTEREST_FIX_V2: também indexa por id ("lamination-matte",
                // "caderno-normal") porque selection_json usa o id, não o value.
                if ($id !== '' && !isset($entry['by_value'][$id])) {
                    $entry['by_value'][$id] = $record;
                }
                $bn = mp_image_basename($image);
                if ($bn !== '' && !isset($entry['by_basename'][$bn])) {
                    $entry['by_basename'][$bn] = $record;
                }
                // Slots adicionais: exampleImage (laminação/pack),
                // interiorImages, laminationImages, purchaseOptionImages.
                foreach (array('exampleImage' => null, 'visual' => null) as $imgKey => $_) {
                    if (!empty($it[$imgKey]) && is_string($it[$imgKey])) {
                        $bnX = mp_image_basename($it[$imgKey]);
                        if ($bnX !== '' && !isset($entry['by_basename'][$bnX])) {
                            $alt = $record;
                            $alt['image'] = $it[$imgKey];
                            $entry['by_basename'][$bnX] = $alt;
                        }
                    }
                }
                $multiSlots = array(
                    'interiorImages' => 'interior',
                    'laminationImages' => 'lamination_example',
                    'purchaseOptionImages' => 'pack',
                );
                foreach ($multiSlots as $imgKey => $altSlot) {
                    if (empty($it[$imgKey]) || !is_array($it[$imgKey])) continue;
                    foreach ($it[$imgKey] as $im) {
                        $imgPath = is_string($im) ? $im : (isset($im['image']) ? (string)$im['image'] : '');
                        if ($imgPath === '') continue;
                        $bnX = mp_image_basename($imgPath);
                        if ($bnX !== '' && !isset($entry['by_basename'][$bnX])) {
                            $alt = $record;
                            $alt['image'] = $imgPath;
                            $alt['slot'] = $altSlot;
                            $entry['by_basename'][$bnX] = $alt;
                        }
                    }
                }
            }
        }
        $catalog[$slug] = $entry;
    }
    return $catalog;
}

function mp_image_basename($path) {
    $path = (string)$path;
    if ($path === '') return '';
    $name = basename(strtok($path, '?'));
    $dot = strrpos($name, '.');
    if ($dot !== false) $name = substr($name, 0, $dot);
    return $name;
}

function mp_step_to_slot($stepId, $imagePath) {
    $stepId = (string)$stepId;
    if ($stepId === 'designs') {
        // Em cadernos a step "designs" é uma escolha de capa; noutros é design.
        $lc = strtolower((string)$imagePath);
        if (strpos($lc, 'capas/') !== false || strpos($lc, '/capa') !== false) return 'cover';
        return 'main';
    }
    if ($stepId === 'lamination') return 'lamination_example';
    if ($stepId === 'pack') return 'pack';
    if ($stepId === 'cover_personalization') return 'cover';
    if ($stepId === 'size') return 'size';
    return 'main';
}

// Procura um item no catálogo. Tenta primeiro by_value, depois by_basename.
// Devolve o record ou null.
function mp_catalog_lookup(array $catalog, $productSlug, $identifier) {
    $productSlug = (string)$productSlug;
    $identifier = (string)$identifier;
    if ($productSlug === '' || $identifier === '') return null;
    if (!isset($catalog[$productSlug])) return null;
    $p = $catalog[$productSlug];
    if (isset($p['by_value'][$identifier])) return $p['by_value'][$identifier];
    if (isset($p['by_basename'][$identifier])) return $p['by_basename'][$identifier];
    // Fallback case-insensitive
    $lower = strtolower($identifier);
    foreach ($p['by_value'] as $k => $r) {
        if (strtolower($k) === $lower) return $r;
    }
    foreach ($p['by_basename'] as $k => $r) {
        if (strtolower($k) === $lower) return $r;
    }
    return null;
}

// Verifica que o caminho da imagem é local e seguro (não permite URLs
// externos, paths absolutos ou ..).
function mp_safe_image_path($path) {
    $path = (string)$path;
    if ($path === '') return '';
    // Reject schemes
    if (preg_match('#^[a-z][a-z0-9+.-]*://#i', $path)) return '';
    // Reject absolute paths and traversal
    if (strpos($path, '..') !== false) return '';
    if (strlen($path) > 0 && ($path[0] === '/' || $path[0] === '\\')) return '';
    if (preg_match('#^[A-Za-z]:[\\\\/]#', $path)) return '';
    return $path;
}

// Constrói um <img> tag para o thumbnail. Se path inválido, devolve placeholder.
function render_thumbnail_html($path, $alt = '', $size = 88) {
    $safe = mp_safe_image_path($path);
    if ($safe === '') {
        return '<div class="iv-thumb iv-thumb-placeholder" aria-hidden="true">?</div>';
    }
    return '<div class="iv-thumb"><img loading="lazy" src="' . admin_funnel_h($safe) . '" alt="' . admin_funnel_h($alt) . '" width="' . (int)$size . '" height="' . (int)$size . '"></div>';
}

function mp_slot_label($slot) {
    static $labels = array(
        'main' => 'principal',
        'cover' => 'capa',
        'interior' => 'interior',
        'marker' => 'marcador',
        'pack' => 'pack',
        'lamination_example' => 'laminação',
        'size' => 'tamanho',
        'process' => 'processo',
    );
    return isset($labels[$slot]) ? $labels[$slot] : $slot;
}

// EMPTY_STATE_HOMEPAGE_V1 (Phase N): se a visita está na homepage sem produto,
// devolve labels amigáveis para não mostrar "—" em todo lado.
// Devolve array com product_label, step_label_text, route_text, main_text.
function mp_friendly_visitor_context($productSlug, $landingPage, $stepId, $stepPath) {
    $landingLower = strtolower((string)$landingPage);
    $isHome = ($productSlug === '' || $productSlug === null);
    if ($isHome) {
        // Discrimina por URL: /, /index.html, /checkout.html, /contacto.html...
        $page = 'Página inicial';
        $route = 'Entrada no site';
        $stepLab = 'Entrada';
        $main = 'Entrou no site pela página inicial.';
        if ($landingLower !== '') {
            if (strpos($landingLower, 'index') !== false || $landingLower === '/' || $landingLower === '') {
                $page = 'Página inicial';
                $main = 'Entrou no site pela página inicial.';
            } elseif (strpos($landingLower, 'checkout') !== false) {
                $page = 'Carrinho / Checkout';
                $route = 'Carrinho';
                $stepLab = 'Checkout';
                $main = 'Abriu o carrinho/checkout.';
            } elseif (strpos($landingLower, 'contacto') !== false) {
                $page = 'Contacto';
                $route = 'Contacto';
                $stepLab = 'Contacto';
                $main = 'Abriu a página de contacto.';
            } elseif (strpos($landingLower, 'adicionar-produto') !== false) {
                $page = 'Adicionar produto';
                $route = 'Adicionar produto';
                $stepLab = 'Adicionar produto';
                $main = 'Está a adicionar mais um produto ao pedido.';
            } elseif (strpos($landingLower, 'privacy') !== false) {
                $page = 'Privacidade';
                $route = 'Privacidade';
                $stepLab = 'Privacidade';
                $main = 'Abriu a página de privacidade.';
            }
        }
        return array(
            'product_label' => $page,
            'step_label_text' => $stepLab,
            'route_text' => $route,
            'main_text' => $main,
            'is_home' => true,
        );
    }
    return array(
        'product_label' => product_friendly_name($productSlug),
        'step_label_text' => $stepId !== '' ? step_label($stepId) : '—',
        'route_text' => '',
        'main_text' => '',
        'is_home' => false,
    );
}

// Heurística pequena para uma legenda de interesse.
function mp_interest_label($mag, $sel, $bought, $abandoned) {
    if ($bought > 0 && $sel > 0 && ($bought / $sel) >= 0.5) return 'Converte bem';
    if ($sel > 0 && $bought === 0 && $sel >= 2) return 'Interesse sem compra';
    if ($mag >= 5 && $sel === 0) return 'Visto mas não escolhido';
    if ($mag >= 3 && $sel > 0 && ($sel / max(1, $mag)) < 0.3) return 'Pode estar a confundir';
    if ($mag >= 3 && $sel === 0) return 'Chama atenção';
    if ($sel >= 2 && $bought >= 1) return 'Escolhido e comprado';
    if ($sel >= 1) return 'Escolhido';
    if ($mag >= 1) return 'Visto';
    return '';
}

// Renderiza um card visual de "item de interesse". Mostra thumbnail (se
// resolvível), label, produto/slot e métricas. $mode controla os stats
// destacados:
//   'magnified' | 'selected' | 'bought' | 'abandoned' | 'magnified_not_selected' | 'funnel'
function render_interest_card($it, $mode = 'funnel') {
    $rec = isset($it['catalog']) ? $it['catalog'] : null;
    $itemType = isset($it['item_type']) ? $it['item_type'] : 'design';
    $title = $rec && !empty($rec['title']) ? $rec['title'] : ($it['raw_id'] !== '' ? $it['raw_id'] : '—');
    $productName = $rec && !empty($rec['product_name']) ? $rec['product_name'] : product_friendly_name($it['product_slug']);
    $slot = $rec && !empty($rec['slot']) ? $rec['slot'] : 'main';
    // INTEREST_FIX_V2: label do "slot" dependente do item_type quando o
    // catálogo não conhece o item (ex.: pack=1, sem entrada no catálogo).
    $typeLabelMap = array(
        'design' => 'design',
        'cover' => 'capa',
        'lamination' => 'laminação',
        'pack' => 'pack',
        'product_option' => 'opção',
        'size' => 'tamanho',
        'personalization' => 'personalização',
        'delivery' => 'entrega',
        'caderno_qty' => 'quantidade',
        'assorted' => 'sortido',
        'magnified_image' => 'imagem',
    );
    $slotLabel = isset($typeLabelMap[$itemType]) ? $typeLabelMap[$itemType] : mp_slot_label($slot);
    // Para items "option_type" sem catálogo, criar um título legível
    if (!$rec) {
        $raw = $it['raw_id'];
        if ($itemType === 'personalization') {
            $title = $raw === 'yes' ? 'Personalização ativa' : ($raw === 'no' ? 'Sem personalização' : $raw);
        } elseif ($itemType === 'pack') {
            $title = 'Pack ' . $raw;
        } elseif ($itemType === 'assorted') {
            $title = 'Sortido';
        } elseif ($itemType === 'delivery') {
            $title = ucfirst(str_replace('_', ' ', $raw));
        } elseif ($itemType === 'caderno_qty') {
            $title = 'Quantidade ' . $raw;
        } else {
            $title = ucfirst(str_replace(array('_', '-'), ' ', $raw));
        }
    }
    $image = $rec && !empty($rec['image']) ? $rec['image'] : '';
    $alt = $title . ' — ' . $productName;
    $thumb = render_thumbnail_html($image, $alt);

    $mag = (int)($it['magnified_count'] ?? 0);
    $magS = (int)($it['magnified_sessions_count'] ?? 0);
    $sel = (int)($it['selected_count'] ?? 0);
    $selS = (int)($it['selected_sessions_count'] ?? 0);
    $bought = (int)($it['bought_count'] ?? 0);
    $abandoned = (int)($it['abandoned_count'] ?? 0);
    $magNotSel = (int)($it['magnified_not_selected_sessions'] ?? 0);
    $label = isset($it['interest_label']) ? (string)$it['interest_label'] : '';
    $labelClass = 'is-neutral';
    if ($label === 'Converte bem' || $label === 'Escolhido e comprado') $labelClass = 'is-good';
    elseif ($label === 'Interesse sem compra' || $label === 'Pode estar a confundir' || $label === 'Visto mas não escolhido') $labelClass = 'is-warn';

    $stats = array();
    if ($mode === 'magnified' || $mode === 'funnel' || $mode === 'magnified_not_selected') {
        $stats[] = '<span title="Aberturas do magnifier">🔍 <strong>' . (int)$mag . '</strong>' . ($magS > 0 && $magS !== $mag ? ' <span class="muted" style="font-size:0.72rem;">(' . $magS . ' sess.)</span>' : '') . '</span>';
    }
    if ($mode === 'selected' || $mode === 'abandoned' || $mode === 'funnel') {
        $stats[] = '<span title="Sessões que escolheram">✅ <strong>' . (int)$selS . '</strong></span>';
    }
    if ($mode === 'bought' || $mode === 'funnel') {
        $stats[] = '<span title="Sessões com pedido enviado">🎉 <strong>' . (int)$bought . '</strong></span>';
    }
    if ($mode === 'abandoned' || $mode === 'funnel') {
        $stats[] = '<span title="Escolheram mas não submeteram">⚠️ <strong>' . (int)$abandoned . '</strong></span>';
    }
    if ($mode === 'magnified_not_selected') {
        $stats[] = '<span title="Ampliaram mas não escolheram">⚠️ <strong>' . (int)$magNotSel . '</strong></span>';
    }

    $funnelBar = '';
    if ($mode === 'funnel') {
        $maxV = max(1, $mag, $selS, $bought);
        $wMag = round($mag / $maxV * 100);
        $wSel = round($selS / $maxV * 100);
        $wBuy = round($bought / $maxV * 100);
        $funnelBar = '<div class="interest-funnel-bar" title="Magnificações · Selecções · Compras"><span class="ib-mag" style="width:' . $wMag . '%"></span></div>'
                   . '<div class="interest-funnel-bar"><span class="ib-sel" style="width:' . $wSel . '%"></span></div>'
                   . '<div class="interest-funnel-bar"><span class="ib-buy" style="width:' . $wBuy . '%"></span></div>';
    }

    $out = '<article class="interest-card">';
    $out .= $thumb;
    $out .= '<div class="iv-title">' . admin_funnel_h($title) . '</div>';
    $out .= '<div class="iv-sub">' . admin_funnel_h($productName) . ' · ' . admin_funnel_h($slotLabel) . '</div>';
    if (!empty($stats)) $out .= '<div class="iv-stats">' . implode('', $stats) . '</div>';
    if ($funnelBar !== '') $out .= $funnelBar;
    if ($label !== '') $out .= '<span class="iv-label ' . $labelClass . '">' . admin_funnel_h($label) . '</span>';
    $out .= '</article>';
    return $out;
}

function render_interest_empty($message) {
    return '<div class="interest-empty"><strong>Sem dados ainda.</strong>' . admin_funnel_h($message) . '</div>';
}

// Extrai um label legível de um valor de attribution.
function render_attribution_chip($attribution) {
    if (!is_array($attribution)) return '';
    $cat = isset($attribution['category']) ? $attribution['category'] : 'Desconhecido';
    $raw = isset($attribution['raw']) ? $attribution['raw'] : '';
    $title = $raw !== '' ? $raw : $cat;
    return '<span class="src-chip src-' . admin_funnel_h(strtolower(preg_replace('/[^a-z0-9]+/i', '', $cat))) . '" title="' . admin_funnel_h($title) . '">' . admin_funnel_h($cat) . '</span>';
}

ksort($products);

// INTERESSE_VISITANTES_V1: catálogo de items (com thumbnails) + agregações
// globais por item, reaproveitando o trabalho que já foi feito por produto.
// Importante: o loop principal acima já fez aggregations por produto. Aqui
// só consolidamos numa visão global e resolvemos cada chave contra o catálogo.
$productCatalog = mp_build_product_catalog($productDir);

// $interestItems: keyed by "product_slug|canonical_id" → {
//   catalog, magnified_count, magnified_sessions[],
//   selected_count, selected_sessions[], bought_sessions[]
// }
$interestItems = array();

function _interest_key($slug, $catalogRecord, $rawId, $itemType = 'design') {
    // Preferir o "value" canónico do catálogo (estável). Se desconhecido,
    // usar o raw id para não perder o ponto de dados.
    $canonical = ($catalogRecord && !empty($catalogRecord['value'])) ? $catalogRecord['value'] : $rawId;
    return $slug . '|' . $itemType . '|' . $canonical;
}
function _interest_ensure(&$store, $key, $catalogRecord, $slug, $rawId, $itemType = 'design') {
    if (isset($store[$key])) return;
    $store[$key] = array(
        'catalog' => $catalogRecord,
        'raw_id' => (string)$rawId,
        'product_slug' => (string)$slug,
        'item_type' => $itemType, // INTEREST_FIX_V2: design|cover|lamination|pack|size|product_option|personalization|magnified_image
        'magnified_count' => 0,
        'magnified_sessions' => array(),
        'selected_count' => 0,
        'selected_sessions' => array(),
        'bought_sessions' => array(),
    );
}

// INTEREST_FIX_V2 (Phase K): mapeia cada chave do selection_json para um par
// (item_type, step_id_para_resolver_no_catalogo). Devolve array de tuplos.
// Vazio significa "ignorar esta chave".
function mp_interest_extract_from_selection($selection, $productSlug) {
    if (!is_array($selection)) return array();
    $out = array();
    // Designs / cover: aceita várias variantes de chave.
    $designKeys = array('selected_designs', 'selected_design_ids', 'selectedDesigns');
    foreach ($designKeys as $dk) {
        if (!empty($selection[$dk]) && is_array($selection[$dk])) {
            foreach ($selection[$dk] as $v) {
                if ($v === '' || $v === null) continue;
                $out[] = array('type' => 'design', 'value' => (string)$v, 'step' => 'designs');
            }
        }
    }
    $coverKeys = array('selected_cover', 'selectedCover', 'cover', 'cover_id', 'caderno_cover');
    foreach ($coverKeys as $ck) {
        if (!empty($selection[$ck]) && !is_array($selection[$ck])) {
            $out[] = array('type' => 'cover', 'value' => (string)$selection[$ck], 'step' => 'designs');
        }
    }
    // Lamination
    foreach (array('selected_lamination', 'lamination') as $lk) {
        if (!empty($selection[$lk]) && !is_array($selection[$lk])) {
            $out[] = array('type' => 'lamination', 'value' => (string)$selection[$lk], 'step' => 'lamination');
        }
    }
    // Pack
    foreach (array('selected_pack', 'pack', 'pack_quantity') as $pk) {
        if (isset($selection[$pk]) && $selection[$pk] !== '' && $selection[$pk] !== 0 && $selection[$pk] !== '0') {
            $out[] = array('type' => 'pack', 'value' => (string)$selection[$pk], 'step' => 'pack');
        }
    }
    // Purchase option (Cadernos)
    foreach (array('caderno_option', 'purchase_option', 'selected_purchase_option', 'caderno_type') as $ok) {
        if (!empty($selection[$ok]) && !is_array($selection[$ok])) {
            $out[] = array('type' => 'product_option', 'value' => (string)$selection[$ok], 'step' => 'pack');
        }
    }
    // Size
    foreach (array('selected_size', 'size') as $sk) {
        if (!empty($selection[$sk]) && !is_array($selection[$sk])) {
            $out[] = array('type' => 'size', 'value' => (string)$selection[$sk], 'step' => 'size');
        }
    }
    // Personalization (yes/no apenas)
    foreach (array('cover_personalization', 'personalization', 'personalization_enabled') as $pkz) {
        if (isset($selection[$pkz]) && !is_array($selection[$pkz])) {
            $v = $selection[$pkz];
            $val = '';
            if ($v === 1 || $v === '1' || $v === true || $v === 'yes' || $v === 'on') $val = 'yes';
            elseif ($v === 0 || $v === '0' || $v === false || $v === 'no' || $v === 'off') $val = 'no';
            if ($val !== '') $out[] = array('type' => 'personalization', 'value' => $val, 'step' => 'cover_personalization');
        }
    }
    // Caderno qty
    if (isset($selection['caderno_qty']) && !is_array($selection['caderno_qty'])) {
        $out[] = array('type' => 'caderno_qty', 'value' => (string)$selection['caderno_qty'], 'step' => 'pack');
    }
    // Assorted toggle
    if (!empty($selection['assorted'])) {
        $out[] = array('type' => 'assorted', 'value' => '1', 'step' => 'designs');
    }
    // Delivery
    foreach (array('selected_delivery', 'delivery') as $dk) {
        if (!empty($selection[$dk]) && !is_array($selection[$dk])) {
            $out[] = array('type' => 'delivery', 'value' => (string)$selection[$dk], 'step' => 'delivery_contact');
        }
    }
    return $out;
}

// Passa 1: sessões — precisamos saber quais submeteram (para "comprado").
$sessionSubmitted = array();
$sessionMagnifiedItems = array(); // sessionId → set of keys (para "ampliado mas não escolhido")
$sessionSelectedItems = array();  // sessionId → set of keys
foreach ($events as $e) {
    $name = isset($e['event_name']) ? (string)$e['event_name'] : '';
    if ($name === 'order_submitted' || $name === 'cart_order_submitted') {
        $sid = (string)($e['session_id'] ?? '');
        if ($sid !== '') $sessionSubmitted[$sid] = true;
    }
}

// Passa 2: agrega por item (cross-product) e marca sessões.
foreach ($events as $e) {
    $name = isset($e['event_name']) ? (string)$e['event_name'] : '';
    $slug = (string)($e['product_slug'] ?? '');
    $sid  = (string)($e['session_id'] ?? '');
    if ($slug === '' || $sid === '') continue;

    if ($name === 'image_magnified') {
        $extra = isset($e['event_json']) ? json_decode($e['event_json'], true) : null;
        if (!is_array($extra)) $extra = array();
        $designId = isset($extra['design_id']) ? (string)$extra['design_id']
                   : (isset($extra['item_id']) ? (string)$extra['item_id'] : '');
        if ($designId === '') continue;
        $rec = mp_catalog_lookup($productCatalog, $slug, $designId);
        $key = _interest_key($slug, $rec, $designId);
        _interest_ensure($interestItems, $key, $rec, $slug, $designId);
        $interestItems[$key]['magnified_count']++;
        $interestItems[$key]['magnified_sessions'][$sid] = true;
        // Track per-session for "ampliado mas não escolhido"
        if (!isset($sessionMagnifiedItems[$sid])) $sessionMagnifiedItems[$sid] = array();
        $sessionMagnifiedItems[$sid][$key] = true;
    } elseif ($name === 'design_selected' || $name === 'design_unselected' || $name === 'option_selected'
              || $name === 'selection_updated' || $name === 'step_selection_snapshot' || $name === 'order_submitted') {
        // INTEREST_FIX_V2 (Phase K): aceita semantic events (design_selected/
        // design_unselected/option_selected) e os snapshot events.
        // Para design_unselected NÃO marcamos selected (é o oposto).
        $sel = isset($e['selection_json']) ? json_decode($e['selection_json'], true) : null;
        $tuples = mp_interest_extract_from_selection($sel, $slug);

        // design_selected/unselected/option_selected também trazem campos individuais
        // no event_json — usa-os para casos onde o snapshot está vazio.
        $extra = isset($e['event_json']) ? json_decode($e['event_json'], true) : null;
        if (is_array($extra)) {
            if ($name === 'design_selected' || $name === 'design_unselected') {
                $did = isset($extra['design_id']) ? (string)$extra['design_id']
                       : (isset($extra['item_id']) ? (string)$extra['item_id'] : '');
                if ($did !== '') {
                    $tuples[] = array('type' => 'design', 'value' => $did, 'step' => 'designs',
                                      '_unselect' => ($name === 'design_unselected'));
                }
            } elseif ($name === 'option_selected') {
                $ot = isset($extra['option_type']) ? (string)$extra['option_type'] : '';
                $ov = isset($extra['option_value']) ? (string)$extra['option_value'] : '';
                if ($ot !== '' && $ov !== '') {
                    // Mapear option_type → catalog step
                    $stepMap = array(
                        'lamination' => 'lamination',
                        'pack' => 'pack',
                        'purchase_option' => 'pack',
                        'size' => 'size',
                        'cover_personalization' => 'cover_personalization',
                        'delivery' => 'delivery_contact',
                        'caderno_qty' => 'pack',
                    );
                    $stepForLookup = isset($stepMap[$ot]) ? $stepMap[$ot] : 'pack';
                    $tuples[] = array('type' => $ot, 'value' => $ov, 'step' => $stepForLookup);
                }
            }
        }

        // Aplicar tuplos
        foreach ($tuples as $tup) {
            $rawId = $tup['value'];
            if ($rawId === '' || $rawId === '0') continue;
            $rec = mp_catalog_lookup($productCatalog, $slug, $rawId);
            $itemType = $tup['type'];
            $key = _interest_key($slug, $rec, $rawId, $itemType);
            _interest_ensure($interestItems, $key, $rec, $slug, $rawId, $itemType);
            // design_unselected → não conta como seleccionado (é o oposto)
            if (!empty($tup['_unselect'])) continue;
            $interestItems[$key]['selected_count']++;
            $interestItems[$key]['selected_sessions'][$sid] = true;
            if (!isset($sessionSelectedItems[$sid])) $sessionSelectedItems[$sid] = array();
            $sessionSelectedItems[$sid][$key] = true;
            if (!empty($sessionSubmitted[$sid])) {
                $interestItems[$key]['bought_sessions'][$sid] = true;
            }
        }
    }
}

// Computa métricas derivadas e ordena.
foreach ($interestItems as $k => &$it) {
    $it['magnified_sessions_count'] = count($it['magnified_sessions']);
    $it['selected_sessions_count'] = count($it['selected_sessions']);
    $it['bought_count'] = count($it['bought_sessions']);
    $it['abandoned_count'] = max(0, $it['selected_sessions_count'] - $it['bought_count']);
    $it['interest_label'] = mp_interest_label(
        $it['magnified_count'],
        $it['selected_sessions_count'],
        $it['bought_count'],
        $it['abandoned_count']
    );
}
unset($it);

// Lists derivadas (ordenadas) para o render
$listMagnified = $interestItems;
uasort($listMagnified, function ($a, $b) { return $b['magnified_count'] - $a['magnified_count']; });

$listSelected = array_filter($interestItems, function ($it) { return $it['selected_sessions_count'] > 0; });
uasort($listSelected, function ($a, $b) { return $b['selected_sessions_count'] - $a['selected_sessions_count']; });

$listSelectedNotBought = array_filter($interestItems, function ($it) {
    return $it['selected_sessions_count'] > 0 && $it['bought_count'] === 0;
});
uasort($listSelectedNotBought, function ($a, $b) { return $b['selected_sessions_count'] - $a['selected_sessions_count']; });

$listBought = array_filter($interestItems, function ($it) { return $it['bought_count'] > 0; });
uasort($listBought, function ($a, $b) { return $b['bought_count'] - $a['bought_count']; });

// "Ampliado mas não escolhido": para cada item, conta sessões que o
// ampliaram mas não o escolheram (set difference por sessão).
$listMagnifiedNotSelected = array();
foreach ($interestItems as $k => $it) {
    if ($it['magnified_count'] === 0) continue;
    $sessionsMag = $it['magnified_sessions'];
    $diffSessions = 0;
    foreach ($sessionsMag as $sid => $_) {
        if (empty($sessionSelectedItems[$sid][$k])) $diffSessions++;
    }
    if ($diffSessions > 0) {
        $copy = $it;
        $copy['magnified_not_selected_sessions'] = $diffSessions;
        $listMagnifiedNotSelected[$k] = $copy;
    }
}
uasort($listMagnifiedNotSelected, function ($a, $b) {
    return $b['magnified_not_selected_sessions'] - $a['magnified_not_selected_sessions'];
});

// Funil por item — mantém todos com algum sinal, ordena por magnified+selected
$listFunnel = array_filter($interestItems, function ($it) {
    return $it['magnified_count'] > 0 || $it['selected_sessions_count'] > 0;
});
uasort($listFunnel, function ($a, $b) {
    $sa = $a['magnified_count'] * 2 + $a['selected_sessions_count'] * 3 + $a['bought_count'] * 5;
    $sb = $b['magnified_count'] * 2 + $b['selected_sessions_count'] * 3 + $b['bought_count'] * 5;
    return $sb - $sa;
});

// ATTRIBUTION_AGGREGATION_V1 (Phase 3): conta sessões únicas por categoria de
// origem. Uma sessão é classificada pelo seu primeiro evento (com utm/first_referrer
// disponível). Sessões sem nenhum sinal vão para "Directo".
$attributionByCategory = array();
$attributionBySession = array(); // session_id => array(category, raw, first_at)
foreach ($events as $e) {
    $sid = $e['session_id'] ?: '';
    if ($sid === '') continue;
    if (isset($attributionBySession[$sid])) continue; // só o primeiro evento conta
    $extraE = isset($e['event_json']) ? json_decode($e['event_json'], true) : null;
    if (!is_array($extraE)) $extraE = array();
    $cls = mp_attribution_classify(array(
        'utm_source' => isset($e['utm_source']) ? $e['utm_source'] : (isset($extraE['utm_source']) ? $extraE['utm_source'] : ''),
        'first_referrer' => isset($e['first_referrer']) ? $e['first_referrer'] : (isset($extraE['first_referrer']) ? $extraE['first_referrer'] : ''),
        'referrer' => isset($extraE['referrer']) ? $extraE['referrer'] : '',
        'fbclid' => isset($extraE['fbclid']) ? $extraE['fbclid'] : '',
        'gclid' => isset($extraE['gclid']) ? $extraE['gclid'] : '',
    ));
    $cat = $cls['category'];
    $attributionBySession[$sid] = array(
        'category' => $cat,
        'raw' => $cls['raw'],
        'first_at' => $e['created_at'],
        'ip' => isset($e['ip_number']) ? (string)$e['ip_number'] : '',
        'landing' => isset($extraE['landing_page']) ? (string)$extraE['landing_page'] : '',
        'first_landing' => isset($extraE['first_landing_page']) ? (string)$extraE['first_landing_page'] : '',
        'first_referrer' => isset($e['first_referrer']) ? (string)$e['first_referrer'] : (isset($extraE['first_referrer']) ? (string)$extraE['first_referrer'] : ''),
        'referrer' => isset($extraE['referrer']) ? (string)$extraE['referrer'] : '',
        'utm_source' => isset($e['utm_source']) ? (string)$e['utm_source'] : '',
        'utm_medium' => isset($extraE['utm_medium']) ? (string)$extraE['utm_medium'] : '',
        'utm_campaign' => isset($extraE['utm_campaign']) ? (string)$extraE['utm_campaign'] : '',
    );
    if (!isset($attributionByCategory[$cat])) $attributionByCategory[$cat] = 0;
    $attributionByCategory[$cat]++;
}
arsort($attributionByCategory);

// PHASE_2_GEO_ENRICHMENT_TRIGGER_V1
// Pré-carrega o cache de IP lookup; opcionalmente faz até 12 lookups novos
// quando o admin tem o toggle ligado (?enrich=1). NUNCA é executado no
// endpoint público. Limites baixos: nunca pode bloquear o dashboard.
$shouldEnrich = isset($_GET['enrich']) && $_GET['enrich'] === '1';
$enrichDone = 0;
$mapPoints = array();
$ipsForLookup = array();
foreach ($visitorsByIp as $r) {
    if (!empty($r['ip_number'])) $ipsForLookup[] = $r['ip_number'];
}
// Para o mapa, queremos também IPs com volume — limita a 80 únicos.
try {
    $sqlIpAll = "SELECT DISTINCT ip_number FROM funnel_events WHERE ip_number IS NOT NULL AND ip_number <> ''";
    if ($cutoff !== null) $sqlIpAll .= ' AND created_at >= ' . $pdo->quote($cutoff);
    $sqlIpAll .= ' LIMIT 200';
    foreach ($pdo->query($sqlIpAll)->fetchAll() as $row) {
        $ipsForLookup[] = $row['ip_number'];
    }
} catch (Exception $e) { /* silent */ }
$ipsForLookup = array_values(array_unique(array_filter($ipsForLookup, 'strlen')));

if ($shouldEnrich && !empty($ipsForLookup)) {
    try { $enrichDone = mp_ip_lookup_enrich_batch($ipsForLookup, 12); }
    catch (Exception $e) { @error_log('[miaandpaper] enrich batch falhou: ' . $e->getMessage()); }
}
$ipLookupCache = mp_ip_lookup_get_many($ipsForLookup);

// Aggregations geo
$topCountries = array();
$topCities = array();
$topNetworks = array();
$hostingCount = 0;
$hostingSamples = array();
foreach ($visitorsByIp as $r) {
    $ip = $r['ip_number'];
    if (!isset($ipLookupCache[$ip])) continue;
    $info = $ipLookupCache[$ip];
    $countryKey = (string)($info['country_name'] ?: '?');
    $cityKey    = trim(((string)($info['country_name'] ?: '?')) . ' · ' . ((string)($info['city'] ?: '?')));
    $netKey     = trim(((string)$info['isp']) . ($info['asn'] ? ' (' . $info['asn'] . ')' : ''));
    if (!isset($topCountries[$countryKey])) $topCountries[$countryKey] = 0;
    $topCountries[$countryKey] += (int)$r['sessions_count'];
    if (!isset($topCities[$cityKey])) $topCities[$cityKey] = 0;
    $topCities[$cityKey] += (int)$r['sessions_count'];
    if ($netKey !== '') {
        if (!isset($topNetworks[$netKey])) $topNetworks[$netKey] = 0;
        $topNetworks[$netKey] += (int)$r['sessions_count'];
    }
    if (!empty($info['is_hosting_guess'])) {
        $hostingCount += (int)$r['sessions_count'];
        if (count($hostingSamples) < 5) $hostingSamples[] = $ip;
    }
    if (!empty($info['latitude']) && !empty($info['longitude'])) {
        $mapPoints[] = array(
            'ip' => $ip,
            'lat' => (float)$info['latitude'],
            'lon' => (float)$info['longitude'],
            'country' => (string)$info['country_name'],
            'city' => (string)$info['city'],
            'region' => (string)$info['region'],
            'sessions' => (int)$r['sessions_count'],
            'isp' => (string)$info['isp'],
            'asn' => (string)$info['asn'],
            'last_seen' => (string)$r['last_seen'],
        );
    }
}
arsort($topCountries); arsort($topCities); arsort($topNetworks);

// Counts de IPs por estado de lookup
$ipLookupTotal = count($ipsForLookup);
$ipLookupResolved = 0; $ipLookupErrors = 0; $ipLookupPrivate = 0;
foreach ($ipLookupCache as $info) {
    if (!empty($info['lookup_error']) && $info['lookup_error'] !== '') $ipLookupErrors++;
    if (($info['source'] ?? '') === 'private') $ipLookupPrivate++;
    if (!empty($info['country_code']) || !empty($info['country_name'])) $ipLookupResolved++;
}

header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Funil de encomendas · Mia &amp; Paper admin</title>
<style>
:root { --ink:#3b2f1f; --muted:#76551c; --line:rgba(118,85,28,0.22); --gold:#b88616; --moss:#4f7a3a; --bg:#fffbe9; --card:#fff8df; }
* { box-sizing: border-box; }
body { margin:0; font-family: Georgia, serif; background: var(--bg); color: var(--ink); line-height: 1.5; }
header.page-header { padding: 24px 32px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
header.page-header h1 { margin: 0; font-size: 1.45rem; }
nav.period-tabs { display: flex; gap: 6px; }
nav.period-tabs a { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line); text-decoration: none; color: var(--muted); font-weight: 700; font-size: 0.9rem; }
nav.period-tabs a.is-active { background: var(--gold); border-color: var(--gold); color: #fff; }
main.dashboard { padding: 24px 32px 80px; display: grid; gap: 28px; max-width: 1200px; margin: 0 auto; }
section.product-card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 22px 24px; }
section.product-card h2 { margin: 0 0 4px; font-size: 1.25rem; }
section.product-card .period { margin: 0 0 18px; color: var(--muted); font-size: 0.9rem; }
.metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
.metric { padding: 12px 14px; background: rgba(255,255,255,0.55); border: 1px solid var(--line); border-radius: 10px; }
.metric .label { color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
.metric .value { font-weight: 900; font-size: 1.35rem; line-height: 1; margin-top: 6px; }
.metric .sub { color: var(--muted); font-size: 0.82rem; margin-top: 4px; }
table.funnel { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
table.funnel th, table.funnel td { padding: 7px 10px; text-align: left; border-bottom: 1px solid var(--line); font-size: 0.9rem; }
table.funnel th { background: rgba(184,134,22,0.08); font-weight: 800; color: var(--muted); font-size: 0.82rem; text-transform: uppercase; }
table.funnel td.num { text-align: right; font-weight: 800; }
table.funnel td.bar-cell { width: 32%; }
.bar { position: relative; background: rgba(184,134,22,0.12); border-radius: 999px; height: 8px; overflow: hidden; }
.bar > span { display: block; height: 100%; background: var(--gold); border-radius: 999px; }
.dropoff { margin: 8px 0 16px; padding: 10px 14px; background: rgba(192,57,43,0.08); border: 1px solid rgba(192,57,43,0.25); border-radius: 10px; color: #8b2e22; font-size: 0.9rem; }
.errors-list { display: flex; flex-wrap: wrap; gap: 8px; font-size: 0.9rem; color: var(--muted); }
.errors-list span.tag { background: rgba(192,57,43,0.1); border: 1px solid rgba(192,57,43,0.25); border-radius: 999px; padding: 4px 12px; }
.viewport-grid { display: grid; grid-template-columns: 110px 1fr 60px; gap: 6px 12px; align-items: center; font-size: 0.86rem; margin-bottom: 12px; }
.viewport-grid .lab { color: var(--muted); }
.viewport-grid .bar { height: 6px; }
.viewport-grid .cnt { text-align: right; font-weight: 800; }
.sessions-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
.sessions-table th, .sessions-table td { padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--line); font-size: 0.82rem; }
.sessions-table th { color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; font-size: 0.72rem; }
.empty-state { padding: 24px; text-align: center; color: var(--muted); background: var(--card); border: 1px dashed var(--line); border-radius: 14px; }
.kicker { color: var(--muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; margin: 16px 0 6px; }
@media (max-width: 600px) {
  header.page-header, main.dashboard { padding-left: 16px; padding-right: 16px; }
  nav.period-tabs { width: 100%; }
  table.funnel { font-size: 0.82rem; }
}

/* LIVE_DASHBOARD_PHASE_1_V1 — cartões e timeline */
.visitor-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; margin-top: 14px; }
.visitor-card { background: rgba(255,255,255,0.55); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; font-size: 0.86rem; display: flex; flex-direction: column; gap: 6px; }
.visitor-card .vc-head { display: flex; align-items: center; gap: 8px; }
.visitor-card .vc-label { background: rgba(184,134,22,0.18); border-radius: 6px; padding: 2px 7px; font-weight: 800; font-size: 0.78rem; letter-spacing: 0.04em; color: var(--ink); }
.visitor-card .vc-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.visitor-card .vc-state { color: var(--muted); font-size: 0.78rem; }
.visitor-card .vc-row { display: flex; flex-wrap: wrap; gap: 6px 10px; }
.visitor-card .vc-row span.k { color: var(--muted); font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.04em; }
.visitor-card .vc-row strong { font-weight: 700; }
.visitor-card .download-highlight { padding: 8px 10px; border: 1px solid rgba(79,122,58,0.24); border-radius: 9px; background: rgba(79,122,58,0.09); align-items: baseline; }
.visitor-card .download-highlight span.k { color: var(--moss); }
.visitor-card .download-highlight strong { color: var(--moss); }
.visitor-card details { border-top: 1px dashed var(--line); padding-top: 6px; }
.visitor-card details summary { cursor: pointer; color: var(--muted); font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; outline: none; }
.visitor-card details summary::-webkit-details-marker { display: none; }
.visitor-card details summary::marker { display: none; }
.visitor-card details summary::before { content: '▸ '; display:inline-block; transition: transform .15s; }
.visitor-card details[open] > summary::before { content: '▾ '; }
.step-track { display: flex; gap: 4px; align-items: center; margin: 4px 0; }
.step-track-dot { width: 10px; height: 10px; border-radius: 50%; background: rgba(184,134,22,0.25); border: 1px solid var(--line); }
.step-track-dot.is-current { background: var(--moss); border-color: var(--moss); transform: scale(1.25); box-shadow: 0 0 0 3px rgba(79,122,58,0.15); }
.timeline-list { list-style: none; padding: 0; margin: 6px 0 0; display: flex; flex-direction: column; gap: 3px; }
.timeline-entry { font-size: 0.8rem; color: var(--ink); display: flex; gap: 8px; align-items: baseline; }
.timeline-entry .t-time { color: var(--muted); font-feature-settings: "tnum"; font-size: 0.72rem; min-width: 56px; }
.activity-stream { list-style: none; padding: 0; margin: 6px 0 0; display: flex; flex-direction: column; gap: 4px; max-height: 360px; overflow: auto; border: 1px dashed var(--line); padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,0.45); }
.activity-stream li { font-size: 0.85rem; display: flex; gap: 8px; }
.activity-stream li .a-time { color: var(--muted); font-size: 0.72rem; min-width: 62px; font-feature-settings: "tnum"; }
.activity-stream li .a-label { background: rgba(79,122,58,0.12); color: var(--moss); padding: 1px 6px; border-radius: 5px; font-weight: 800; font-size: 0.72rem; }
.muted { color: var(--muted); }
.src-chip { display:inline-block; padding:2px 8px; border-radius:999px; font-size:0.74rem; font-weight:800; background: rgba(184,134,22,0.14); color: var(--muted); border:1px solid var(--line); }
.src-instagram { background: linear-gradient(90deg, rgba(225,48,108,0.16), rgba(245,133,41,0.16)); color: #c2185b; }
.src-facebook { background: rgba(24,119,242,0.14); color: #1769aa; }
.src-google { background: rgba(67,133,244,0.14); color: #3367d6; }
.src-whatsapp { background: rgba(37,211,102,0.14); color: #1f8e4d; }
.src-directo { background: rgba(118,85,28,0.12); }
.src-navegaointerna { background: rgba(140,140,140,0.18); }
.src-email { background: rgba(118,85,28,0.18); }
.src-desconhecido { background: rgba(220,220,220,0.4); color: #777; }
.src-tiktok { background: rgba(0,0,0,0.12); color: #111; }

/* IP grouping table */
.ip-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
.ip-table th, .ip-table td { padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--line); font-size: 0.85rem; vertical-align: top; }
.ip-table th { color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; font-size: 0.72rem; }
.ip-table tr.ip-row.has-orders td:first-child::before { content: '✓ '; color: var(--moss); font-weight: 800; }
.offer-download-table td { vertical-align: top; }
.offer-download-grid { display:grid; grid-template-columns:minmax(0,0.9fr) minmax(0,1.4fr); gap:16px; align-items:start; }
.download-kind { display:inline-block; padding:2px 7px; border-radius:999px; border:1px solid var(--line); color:var(--muted); font-size:0.72rem; font-weight:800; }
.download-kind.is-all { background: rgba(79,122,58,0.12); color: var(--moss); border-color: rgba(79,122,58,0.24); }
.download-file { display:block; color:var(--muted); font-size:0.74rem; margin-top:2px; overflow-wrap:anywhere; }
@media (max-width: 860px) { .offer-download-grid { grid-template-columns: 1fr; } }

/* Phase 2 map */
.geo-map { width: 100%; height: 360px; border: 1px solid var(--line); border-radius: 12px; background: rgba(255,255,255,0.45); }
.geo-summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-top: 14px; }
.geo-summary-grid > div { background: rgba(255,255,255,0.55); border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; }

/* Phase 4/5 tables */
.design-grid-table th, .design-grid-table td { padding: 6px 8px; font-size: 0.86rem; }

/* INTERESSE_VISITANTES_V1 */
.interest-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-top: 12px; }
.interest-card { background: rgba(255,255,255,0.65); border: 1px solid var(--line); border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.interest-card .iv-thumb { width: 100%; aspect-ratio: 1 / 1; border-radius: 10px; overflow: hidden; background: rgba(184,134,22,0.08); display: flex; align-items: center; justify-content: center; border: 1px solid var(--line); }
.interest-card .iv-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.iv-thumb-placeholder { color: var(--muted); font-size: 1.6rem; font-weight: 800; opacity: 0.5; }
.interest-card .iv-title { font-weight: 800; font-size: 0.92rem; line-height: 1.2; }
.interest-card .iv-sub { color: var(--muted); font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.05em; }
.interest-card .iv-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; font-size: 0.82rem; margin-top: 2px; }
.interest-card .iv-stats > span { display: inline-flex; align-items: baseline; gap: 4px; }
.interest-card .iv-stats strong { font-weight: 800; }
.interest-card .iv-label { display: inline-block; background: rgba(79,122,58,0.14); color: var(--moss); border-radius: 6px; padding: 2px 8px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; align-self: flex-start; }
.interest-card .iv-label.is-warn { background: rgba(192,57,43,0.12); color: #8b2e22; }
.interest-card .iv-label.is-good { background: rgba(79,122,58,0.18); color: var(--moss); }
.interest-card .iv-label.is-neutral { background: rgba(184,134,22,0.14); color: var(--muted); }
.interest-funnel-bar { display: flex; height: 8px; border-radius: 999px; overflow: hidden; background: rgba(184,134,22,0.10); border: 1px solid var(--line); }
.interest-funnel-bar > span { display: block; height: 100%; }
.interest-funnel-bar .ib-mag { background: rgba(184,134,22,0.55); }
.interest-funnel-bar .ib-sel { background: rgba(79,122,58,0.55); }
.interest-funnel-bar .ib-buy { background: var(--moss); }
.interest-empty { text-align: center; padding: 20px 14px; color: var(--muted); background: rgba(255,255,255,0.45); border: 1px dashed var(--line); border-radius: 12px; font-size: 0.9rem; }
.interest-empty strong { color: var(--ink); display: block; margin-bottom: 4px; }
.interest-subsection { margin-top: 18px; }
.interest-subsection > summary { cursor: pointer; font-weight: 800; color: var(--muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; outline: none; padding: 6px 0; border-bottom: 1px solid var(--line); }
.interest-subsection > summary::-webkit-details-marker { display: none; }
.interest-subsection > summary::marker { display: none; }
.interest-subsection > summary::before { content: '▸ '; }
.interest-subsection[open] > summary::before { content: '▾ '; }

/* Hierarquia: relatório detalhado e ferramentas técnicas */
details.report-collapse > summary { cursor: pointer; font-weight: 800; color: var(--muted); font-size: 0.92rem; text-transform: uppercase; letter-spacing: 0.05em; outline: none; padding: 10px 0; }
details.report-collapse > summary::-webkit-details-marker { display: none; }
details.report-collapse > summary::marker { display: none; }
details.report-collapse > summary::before { content: '▸ '; }
details.report-collapse[open] > summary::before { content: '▾ '; }
details.report-collapse > summary:hover { color: var(--ink); }
.section-divider { border: none; border-top: 1px solid var(--line); margin: 14px 0; }
</style>
</head>
<body>
<header class="page-header">
  <div>
    <h1>Funil de encomendas</h1>
    <p style="margin:4px 0 0;color:var(--muted);font-size:0.9rem;">Fonte: SQLite <code>private/miaandpaper.sqlite</code> · período: <?= htmlspecialchars($periodLabels[$period]) ?></p>
  </div>
  <nav class="period-tabs">
    <?php foreach (array('7d','30d','90d','all') as $opt): ?>
      <a href="?period=<?= $opt ?>" class="<?= $opt === $period ? 'is-active' : '' ?>"><?= htmlspecialchars($periodLabels[$opt]) ?></a>
    <?php endforeach; ?>
    <a href="admin-live-dashboard.php?period=<?= admin_funnel_h($period) ?>" style="margin-left:8px;background:var(--moss);border-color:var(--moss);color:#fff;">▶ Abrir Live Dashboard</a>
    <a href="admin-orders.php" style="margin-left:8px;background:rgba(79,122,58,0.12);">Encomendas</a>
  </nav>
</header>

<main class="dashboard">
<?php if ($flashMessage !== ''): ?>
  <div class="empty-state" style="text-align:left;<?= $flashType === 'error' ? 'border-color:rgba(182,70,58,0.5);color:#8b2e22;' : 'border-color:rgba(79,122,58,0.4);color:#3a5a25;' ?>">
    <strong><?= $flashType === 'error' ? '⚠️' : '✓' ?></strong> <?= admin_funnel_h($flashMessage) ?>
  </div>
<?php endif; ?>

<details class="report-collapse" id="ferramentas-tecnicas">
<summary>Ferramentas técnicas (filtro de IPs, ignore list, arquivamento, diagnóstico)</summary>
<section class="product-card" style="background:rgba(255,255,255,0.55);">
  <h2 style="font-size:1.1rem;margin:0 0 4px;">Filtro &amp; arquivamento de dados de teste</h2>
  <p style="margin:0 0 14px;color:var(--muted);font-size:0.9rem;">
    Eventos do funil emitidos a partir destes IPs são ignorados pelo <code>track-order-event.php</code> antes de chegarem à base. Podes também <em>arquivar</em> eventos já gravados (movidos para <code>funnel_events_archive</code>, fora dos dashboards).
  </p>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;">
    <form method="post" action="admin-funnel.php?period=<?= admin_funnel_h($period) ?>" onsubmit="return confirm('Arquivar todos os eventos do funil destes IPs?');">
      <input type="hidden" name="csrf" value="<?= admin_funnel_h($csrf) ?>">
      <input type="hidden" name="action" value="archive_by_ips">
      <p style="margin:0 0 6px;font-weight:800;color:var(--muted);font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;">Arquivar eventos já gravados</p>
      <label style="display:block;font-size:0.86rem;color:var(--muted);margin-bottom:4px;">IPs a arquivar (um por linha, ou separados por vírgula)</label>
      <textarea name="ips" rows="3" style="width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,0.6);font:inherit;color:var(--ink);"><?= admin_funnel_h($adminIp) ?></textarea>
      <p style="margin:6px 0 4px;color:var(--muted);font-size:0.82rem;">IP detectado da sessão actual: <code><?= admin_funnel_h($adminIp ?: 'desconhecido') ?></code></p>
      <?php if ($ipDiagnostics['suspicious']): ?>
        <p style="margin:0 0 10px;color:#8b2e22;background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.25);border-radius:8px;padding:6px 10px;font-size:0.82rem;">⚠️ Atenção: o IP detectado pode ser de proxy/servidor. Confirma antes de o adicionares à lista de exclusão.</p>
      <?php endif; ?>
      <button type="submit" style="padding:8px 14px;border-radius:8px;border:1px solid var(--gold);background:var(--gold);color:#fff;font-weight:800;font-family:inherit;cursor:pointer;font-size:0.9rem;">Arquivar eventos destes IPs</button>
    </form>

    <form method="post" action="admin-funnel.php?period=<?= admin_funnel_h($period) ?>">
      <input type="hidden" name="csrf" value="<?= admin_funnel_h($csrf) ?>">
      <input type="hidden" name="action" value="add_ignore_ip">
      <p style="margin:0 0 6px;font-weight:800;color:var(--muted);font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;">Adicionar à ignore list (futuro)</p>
      <label style="display:block;font-size:0.86rem;color:var(--muted);margin-bottom:4px;">IPs a ignorar</label>
      <textarea name="ips" rows="3" style="width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,0.6);font:inherit;color:var(--ink);"><?= admin_funnel_h($adminIp) ?></textarea>
      <label style="display:block;font-size:0.86rem;color:var(--muted);margin:8px 0 4px;">Etiqueta (ex.: "admin Tiago", "agente João")</label>
      <input type="text" name="label" placeholder="opcional" style="width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,0.6);font:inherit;color:var(--ink);">
      <p style="margin:6px 0 10px;color:var(--muted);font-size:0.82rem;">Os IPs listados aqui não vão escrever em <code>funnel_events</code>.</p>
      <button type="submit" style="padding:8px 14px;border-radius:8px;border:1px solid var(--moss);background:var(--moss);color:#fff;font-weight:800;font-family:inherit;cursor:pointer;font-size:0.9rem;">Adicionar à ignore list</button>
    </form>
  </div>

  <?php if (!empty($ignoredIps)): ?>
    <p class="kicker" style="margin-top:18px;">Ignore list activa</p>
    <table class="sessions-table">
      <thead><tr><th>IP</th><th>Etiqueta</th><th>Adicionado em</th><th></th></tr></thead>
      <tbody>
        <?php foreach ($ignoredIps as $row): ?>
          <tr>
            <td><code><?= admin_funnel_h($row['ip']) ?></code><?php if ($row['ip'] === $adminIp): ?> <span style="color:var(--moss);font-weight:800;">(actual)</span><?php endif; ?></td>
            <td><?= admin_funnel_h($row['label']) ?></td>
            <td title="<?= admin_funnel_h($row['created_at']) ?>"><?= admin_funnel_h(mp_tracking_humanize_iso($row['created_at'])) ?></td>
            <td style="text-align:right;">
              <form method="post" action="admin-funnel.php?period=<?= admin_funnel_h($period) ?>" style="display:inline;" onsubmit="return confirm('Remover este IP da ignore list?');">
                <input type="hidden" name="csrf" value="<?= admin_funnel_h($csrf) ?>">
                <input type="hidden" name="action" value="remove_ignore_ip">
                <input type="hidden" name="ip" value="<?= admin_funnel_h($row['ip']) ?>">
                <button type="submit" style="background:transparent;border:0;color:var(--error);font-weight:800;cursor:pointer;font-family:inherit;">remover</button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>

  <details style="margin-top:18px;">
    <summary style="cursor:pointer;color:var(--muted);font-size:0.85rem;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;">Diagnóstico técnico do IP detectado</summary>
    <div style="margin-top:10px;padding:10px 14px;background:rgba(255,255,255,0.55);border:1px solid var(--line);border-radius:10px;font-size:0.85rem;">
      <p style="margin:0 0 8px;color:var(--muted);">Estes valores mostram como o servidor vê o teu pedido — útil quando o site está atrás de Cloudflare/proxy e a ignore list parece não funcionar. Visível só ao admin.</p>
      <table class="sessions-table" style="margin-top:0;">
        <tbody>
          <tr><th style="width:200px;">IP usado para exclusão</th><td><code><?= admin_funnel_h($ipDiagnostics['effective'] ?: '—') ?></code></td></tr>
          <tr><th>REMOTE_ADDR</th><td><code><?= admin_funnel_h($ipDiagnostics['remote_addr'] ?: '—') ?></code></td></tr>
          <tr><th>HTTP_CF_CONNECTING_IP</th><td><code><?= admin_funnel_h($ipDiagnostics['cf_connecting_ip'] ?: '—') ?></code></td></tr>
          <tr><th>HTTP_X_REAL_IP</th><td><code><?= admin_funnel_h($ipDiagnostics['x_real_ip'] ?: '—') ?></code></td></tr>
          <tr><th>HTTP_X_FORWARDED_FOR</th><td><code><?= admin_funnel_h($ipDiagnostics['x_forwarded_for'] ?: '—') ?></code></td></tr>
          <tr><th>HTTP_CLIENT_IP</th><td><code><?= admin_funnel_h($ipDiagnostics['client_ip'] ?: '—') ?></code></td></tr>
        </tbody>
      </table>
      <?php if ($ipDiagnostics['suspicious']): ?>
        <p style="margin:10px 0 0;color:#8b2e22;font-size:0.82rem;">⚠️ Indício de proxy detectado: <?= admin_funnel_h(implode(' ', $ipDiagnostics['reasons'])) ?></p>
      <?php else: ?>
        <p style="margin:10px 0 0;color:var(--muted);font-size:0.82rem;">Sem sinais de proxy. REMOTE_ADDR está a ser usado directamente.</p>
      <?php endif; ?>
    </div>
  </details>
</section>
</details>

<section class="product-card" id="visitantes-tempo-real">
  <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;">
    <div>
      <h2 style="margin:0 0 4px;font-size:1.2rem;">Visitantes em tempo real</h2>
      <p class="period" style="margin:0;">Sessões com actividade nos últimos <?= (int)$visitorsWindowMinutes ?> minutos · ordenadas pela última actividade</p>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <span style="color:var(--muted);font-size:0.82rem;" title="<?= admin_funnel_h(gmdate('Y-m-d\TH:i:s\Z')) ?>">Actualizado agora</span>
      <a href="admin-funnel.php?period=<?= admin_funnel_h($period) ?>#visitantes-tempo-real" style="padding:6px 12px;border-radius:999px;border:1px solid var(--line);text-decoration:none;color:var(--muted);font-weight:700;font-size:0.85rem;">Atualizar</a>
      <label style="color:var(--muted);font-size:0.82rem;display:flex;gap:6px;align-items:center;">
        <input type="checkbox" id="visitors-autorefresh" checked> auto a cada 30s
      </label>
    </div>
  </div>

  <?php
    $nowTs = time();
    $activeCount = 0; $idleCount = 0; $goneCount = 0;
    foreach ($visitorSessions as $vs) {
        $st = render_activity_state($vs['last_seen'], $vs['heartbeat_latest_at'], $nowTs);
        if ($st['state'] === 'active') $activeCount++;
        elseif ($st['state'] === 'idle') $idleCount++;
        else $goneCount++;
    }
  ?>
  <div class="metrics" style="margin-top:14px;margin-bottom:12px;">
    <div class="metric"><div class="label">Ativos agora</div><div class="value"><?= (int)$activeCount ?></div><div class="sub">≤ 5 min, com sinal</div></div>
    <div class="metric"><div class="label">A ler/parados</div><div class="value"><?= (int)$idleCount ?></div><div class="sub">a tempo, mas sem clicar</div></div>
    <div class="metric"><div class="label">Provavelmente abandonaram</div><div class="value"><?= (int)$goneCount ?></div><div class="sub">sem sinal há vários min</div></div>
    <div class="metric"><div class="label">Sessões na janela</div><div class="value"><?= count($visitorSessions) ?></div></div>
  </div>

  <?php if (empty($visitorSessions)): ?>
    <div class="empty-state" style="margin:6px 0 0;">Sem actividade nos últimos <?= (int)$visitorsWindowMinutes ?> minutos.</div>
  <?php else: ?>
    <div class="visitor-cards">
      <?php foreach ($visitorSessions as $vs):
        $durSec = strtotime($vs['last_seen']) - strtotime($vs['first_seen']);
        if ($durSec < 0) $durSec = 0;
        $st = render_activity_state($vs['last_seen'], $vs['heartbeat_latest_at'], $nowTs);
        $deviceLabel = '—';
        if ($vs['device_type'] === 'mobile') $deviceLabel = 'Telemóvel';
        elseif ($vs['device_type'] === 'tablet') $deviceLabel = 'Tablet';
        elseif ($vs['device_type'] === 'desktop') $deviceLabel = 'Desktop';
        // EMPTY_STATE_HOMEPAGE_V1: contexto amigável para visitantes sem produto.
        $ctx = mp_friendly_visitor_context($vs['product_slug'], $vs['landing_page'], $vs['step_id'], $vs['step_path']);
        $stepLabelVal = $ctx['step_label_text'];
        $productLabel = $ctx['product_label'];
        $homePrefixRoute = $ctx['route_text'];
        $homeMainText = $ctx['main_text'];
        $landing = $vs['landing_page'] !== '' ? $vs['landing_page'] : '';
        $referrer = $vs['referrer'] !== '' ? $vs['referrer'] : '';
        $ipDisplay = $vs['ip_number'] !== '' ? $vs['ip_number'] : '—';
        $idleSec = $nowTs - strtotime($vs['last_seen']);
        $label = mp_visitor_label_for_ip($vs['ip_number']);
        $selectionSummary = render_selection_summary($vs['selection_latest']);
      ?>
        <article class="visitor-card">
          <div class="vc-head">
            <span class="vc-dot" style="background:<?= $st['color'] ?>;" title="<?= admin_funnel_h($st['label']) ?>"></span>
            <span class="vc-label">Visitante <?= admin_funnel_h($label) ?></span>
            <span class="vc-state"><?= admin_funnel_h($st['label']) ?></span>
            <?php if ((int)$vs['submitted'] === 1): ?>
              <span style="color:var(--moss);font-weight:800;font-size:0.78rem;margin-left:auto;">✓ Pedido enviado</span>
            <?php endif; ?>
          </div>

          <div class="vc-row">
            <span class="k">Produto</span><strong><?= admin_funnel_h($productLabel) ?></strong>
          </div>

          <?php if ($ctx['is_home']): ?>
            <p class="muted" style="font-size:0.82rem;margin:4px 0 0;"><?= admin_funnel_h($homeMainText) ?></p>
            <div class="vc-row">
              <span class="k">Rota</span><span><?= admin_funnel_h($homePrefixRoute) ?></span>
            </div>
          <?php else: ?>
            <?= render_step_track($vs['product_slug'], $vs['step_id'], $productOrders) ?>
            <div class="vc-row">
              <span class="k">Rota</span><span><?= render_step_path($vs['step_path']) ?></span>
            </div>
          <?php endif; ?>

          <?php if ($selectionSummary !== ''): ?>
          <div class="vc-row">
            <span class="k">Selecção</span><strong><?= admin_funnel_h($selectionSummary) ?></strong>
          </div>
          <?php endif; ?>

          <?php if ($vs['magnifier_latest']): ?>
          <div class="vc-row">
            <span class="k">Ampliou</span><span><?= admin_funnel_h(($vs['magnifier_latest']['design_id'] ?: 'imagem') . ($vs['magnifier_latest']['image_slot'] ? ' · ' . $vs['magnifier_latest']['image_slot'] : '')) ?></span>
          </div>
          <?php endif; ?>

          <?php if (!empty($vs['offer_downloads'])):
            $latestDownload = $vs['offer_downloads'][0];
            $extraDownloads = max(0, count($vs['offer_downloads']) - 1);
          ?>
          <div class="vc-row download-highlight">
            <span class="k">Download PDF</span>
            <strong><?= admin_funnel_h($latestDownload['download_label']) ?></strong>
            <?php if ($latestDownload['download_size'] !== ''): ?><span><?= admin_funnel_h($latestDownload['download_size']) ?></span><?php endif; ?>
            <?php if ($extraDownloads > 0): ?><span class="muted">+<?= (int)$extraDownloads ?> nesta sessão</span><?php endif; ?>
          </div>
          <?php endif; ?>

          <div class="vc-row">
            <span class="k">Passo</span><strong><?= admin_funnel_h($stepLabelVal ?: '—') ?></strong>
            <span class="k">Dispositivo</span><strong><?= admin_funnel_h($deviceLabel) ?><?php if ($vs['viewport_width']): ?> · <?= (int)$vs['viewport_width'] ?>px<?php endif; ?></strong>
          </div>

          <div class="vc-row">
            <span class="k">Duração</span><strong><?= admin_funnel_h(mp_tracking_humanize_duration($durSec)) ?></strong>
            <span class="k">Inactivo</span><strong><?= admin_funnel_h(mp_tracking_humanize_duration(max(0, $idleSec))) ?></strong>
            <span class="k">Eventos</span><strong><?= (int)$vs['event_count'] ?></strong>
          </div>

          <div class="vc-row">
            <span class="k">IP/rede</span><code style="font-size:0.78rem;"><?= admin_funnel_h($ipDisplay) ?></code>
            <?php if (!empty($vs['attribution'])): ?>
              <span class="k">Origem</span><?= render_attribution_chip($vs['attribution']) ?>
            <?php endif; ?>
          </div>

          <?php if ($landing !== '' || $referrer !== ''): ?>
          <div class="vc-row" style="font-size:0.78rem;color:var(--muted);">
            <?php if ($landing !== ''): ?><span title="<?= admin_funnel_h($landing) ?>">Página: <?= admin_funnel_h(strlen($landing) > 36 ? substr($landing, 0, 36) . '…' : $landing) ?></span><?php endif; ?>
            <?php if ($referrer !== ''): ?><span title="<?= admin_funnel_h($referrer) ?>">Referrer: <?= admin_funnel_h(strlen($referrer) > 36 ? substr($referrer, 0, 36) . '…' : $referrer) ?></span><?php endif; ?>
          </div>
          <?php endif; ?>

          <details>
            <summary>Cronologia (últimos eventos)</summary>
            <ul class="timeline-list">
              <?php foreach ($vs['timeline'] as $t): ?>
                <?= render_timeline_entry($t) ?>
              <?php endforeach; ?>
            </ul>
          </details>
        </article>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</section>

<!-- ACTIVITY_STREAM_PHASE_1 -->
<?php if (!empty($activityStream)): ?>
<section class="product-card" id="actividade-recente">
  <h2 style="margin:0 0 4px;font-size:1.15rem;">Actividade recente</h2>
  <p class="period" style="margin:0 0 8px;">Feed em tempo (quase) real dos visitantes da janela — útil para acompanhar passo a passo o que está a acontecer.</p>
  <ul class="activity-stream">
    <?php foreach ($activityStream as $a):
      $time = '';
      try {
          $tz = new DateTimeZone('Europe/Lisbon');
          $dt = new DateTime($a['at']);
          $dt->setTimezone($tz);
          $time = $dt->format('H:i:s');
      } catch (Exception $e) { $time = substr($a['at'], 11, 8); }
    ?>
      <li><span class="a-time"><?= admin_funnel_h($time) ?></span><span class="a-label"><?= admin_funnel_h($a['label']) ?></span><span><?= admin_funnel_h($a['msg']) ?></span></li>
    <?php endforeach; ?>
  </ul>
</section>
<?php endif; ?>

<!-- OFFER_DOWNLOADS_VISIBILITY_V1 -->
<section class="product-card" id="downloads-ofertas">
  <h2 style="margin:0 0 4px;font-size:1.2rem;">Downloads de PDFs de oferta</h2>
  <p class="period" style="margin:0 0 12px;">Mostra quem descarregou cada PDF nas páginas de ofertas, dentro do período escolhido.</p>

  <div class="metrics" style="margin-bottom:14px;">
    <div class="metric"><div class="label">Downloads</div><div class="value"><?= (int)$offerDownloadTotal ?></div></div>
    <div class="metric"><div class="label">Sessões com download</div><div class="value"><?= (int)$offerDownloadSessionsCount ?></div></div>
    <div class="metric"><div class="label">Descarregar tudo</div><div class="value"><?= (int)$offerDownloadAllCount ?></div></div>
    <div class="metric"><div class="label">PDFs individuais</div><div class="value"><?= (int)$offerDownloadSingleCount ?></div></div>
  </div>

  <?php if (empty($offerDownloads)): ?>
    <div class="empty-state" style="margin:6px 0 0;">
      Ainda não há downloads de PDFs de oferta neste período.
      <p style="margin:8px 0 0;">Quando alguém carregar num botão de descarregar PDF, aparece aqui com visitante, hora e ficheiro.</p>
    </div>
  <?php else: ?>
    <div class="offer-download-grid">
      <div>
        <p class="kicker" style="margin-top:0;">PDFs mais descarregados</p>
        <table class="sessions-table offer-download-table">
          <thead><tr><th>PDF</th><th class="num">Downloads</th><th class="num">Sessões</th></tr></thead>
          <tbody>
            <?php foreach (array_slice($offerDownloadsByFile, 0, 10, true) as $pdf): ?>
              <tr>
                <td>
                  <strong><?= admin_funnel_h($pdf['download_label']) ?></strong>
                  <?php if ($pdf['download_file'] !== ''): ?><span class="download-file"><?= admin_funnel_h($pdf['download_file']) ?></span><?php endif; ?>
                  <span class="download-kind<?= $pdf['download_kind'] === 'all' ? ' is-all' : '' ?>"><?= $pdf['download_kind'] === 'all' ? 'Tudo' : 'Individual' ?></span>
                  <?php if ($pdf['download_size'] !== ''): ?><span class="muted" style="font-size:0.74rem;"> <?= admin_funnel_h($pdf['download_size']) ?></span><?php endif; ?>
                </td>
                <td class="num"><?= (int)$pdf['count'] ?></td>
                <td class="num"><?= count($pdf['sessions']) ?></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>

      <div>
        <p class="kicker" style="margin-top:0;">Últimos downloads</p>
        <table class="sessions-table offer-download-table">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Visitante</th>
              <th>PDF</th>
              <th>Origem</th>
              <th>Dispositivo</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach (array_slice($offerDownloads, 0, 80) as $download):
              $deviceLabel = '—';
              if ($download['device_type'] === 'mobile') $deviceLabel = 'Telemóvel';
              elseif ($download['device_type'] === 'tablet') $deviceLabel = 'Tablet';
              elseif ($download['device_type'] === 'desktop') $deviceLabel = 'Desktop';
            ?>
              <tr>
                <td title="<?= admin_funnel_h($download['created_at']) ?>"><?= admin_funnel_h(mp_tracking_humanize_iso($download['created_at'])) ?></td>
                <td>
                  <strong><?= admin_funnel_h($download['visitor_label']) ?></strong>
                  <span class="download-file"><code><?= admin_funnel_h($download['ip_number'] ?: '—') ?></code></span>
                </td>
                <td>
                  <strong><?= admin_funnel_h($download['download_label']) ?></strong>
                  <?php if ($download['download_file'] !== ''): ?><span class="download-file"><?= admin_funnel_h($download['download_file']) ?></span><?php endif; ?>
                  <span class="download-kind<?= $download['download_kind'] === 'all' ? ' is-all' : '' ?>"><?= $download['download_kind'] === 'all' ? 'Tudo' : 'Individual' ?></span>
                  <?php if ($download['download_size'] !== ''): ?><span class="muted" style="font-size:0.74rem;"> <?= admin_funnel_h($download['download_size']) ?></span><?php endif; ?>
                </td>
                <td><?= render_attribution_chip($download['attribution']) ?></td>
                <td><?= admin_funnel_h($deviceLabel) ?><?php if ($download['viewport_width']): ?><span class="download-file"><?= (int)$download['viewport_width'] ?>px</span><?php endif; ?></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </div>
  <?php endif; ?>
</section>

<!-- INTERESSE_VISITANTES_V1 -->
<section class="product-card" id="interesse-visitantes">
  <h2 style="margin:0 0 4px;font-size:1.2rem;">Interesse dos visitantes</h2>
  <p class="period" style="margin:0 0 12px;">O que as pessoas ampliaram, escolheram e chegaram a comprar.</p>

  <?php
    $hasInterestData = !empty($interestItems);
    $topMagnified = array_slice($listMagnified, 0, 10, true);
    $topMagnified = array_filter($topMagnified, function ($it) { return $it['magnified_count'] > 0; });
    $topSelected = array_slice($listSelected, 0, 10, true);
    $topAbandoned = array_slice($listSelectedNotBought, 0, 10, true);
    $topBought = array_slice($listBought, 0, 10, true);
    $topMagNotSel = array_slice($listMagnifiedNotSelected, 0, 10, true);
    $topFunnel = array_slice($listFunnel, 0, 12, true);
  ?>

  <?php if (!$hasInterestData): ?>
    <div class="interest-empty">
      <strong>Ainda não há sinais de interesse para mostrar.</strong>
      Quando os visitantes ampliarem imagens ou escolherem designs, este painel vai aparecer com cartões visuais por item.
    </div>
  <?php else: ?>

    <!-- A: O que chamou atenção -->
    <details class="interest-subsection" open>
      <summary>O que chamou atenção (ampliado)</summary>
      <?php if (empty($topMagnified)): ?>
        <div class="interest-empty">Ainda não há lupas abertas.</div>
      <?php else: ?>
        <div class="interest-grid">
          <?php foreach ($topMagnified as $it): ?>
            <?= render_interest_card($it, 'magnified') ?>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </details>

    <!-- B: O que foi escolhido -->
    <details class="interest-subsection" open>
      <summary>O que foi escolhido</summary>
      <?php if (empty($topSelected)): ?>
        <div class="interest-empty">Ainda não há escolhas registadas.</div>
      <?php else: ?>
        <div class="interest-grid">
          <?php foreach ($topSelected as $it): ?>
            <?= render_interest_card($it, 'selected') ?>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </details>

    <!-- C: Escolhido mas não comprado -->
    <details class="interest-subsection">
      <summary>O que foi escolhido mas não comprado</summary>
      <?php if (empty($topAbandoned)): ?>
        <div class="interest-empty">Ainda não há escolhas abandonadas.</div>
      <?php else: ?>
        <div class="interest-grid">
          <?php foreach ($topAbandoned as $it): ?>
            <?= render_interest_card($it, 'abandoned') ?>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </details>

    <!-- D: Escolhido e comprado -->
    <details class="interest-subsection">
      <summary>O que foi escolhido e comprado</summary>
      <?php if (empty($topBought)): ?>
        <div class="interest-empty">Ainda não há compras suficientes para comparar escolhas compradas.</div>
      <?php else: ?>
        <div class="interest-grid">
          <?php foreach ($topBought as $it): ?>
            <?= render_interest_card($it, 'bought') ?>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </details>

    <!-- E: Ampliado mas não escolhido -->
    <details class="interest-subsection">
      <summary>O que foi ampliado mas não escolhido</summary>
      <?php if (empty($topMagNotSel)): ?>
        <div class="interest-empty">Os itens ampliados também foram escolhidos.</div>
      <?php else: ?>
        <div class="interest-grid">
          <?php foreach ($topMagNotSel as $it): ?>
            <?= render_interest_card($it, 'magnified_not_selected') ?>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </details>

    <!-- F: Funil por item -->
    <details class="interest-subsection">
      <summary>Funil por item (visto → escolheu → comprou)</summary>
      <?php if (empty($topFunnel)): ?>
        <div class="interest-empty">Sem dados suficientes para o funil por item.</div>
      <?php else: ?>
        <p class="muted" style="font-size:0.78rem;margin:6px 0 0;">🔍 ampliações · ✅ escolheu · 🎉 comprou · ⚠️ abandonou. Barras relativas ao item com maior valor neste painel.</p>
        <div class="interest-grid">
          <?php foreach ($topFunnel as $it): ?>
            <?= render_interest_card($it, 'funnel') ?>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </details>

  <?php endif; ?>
</section>

<!-- VISITORS_BY_IP_PHASE_1 -->
<?php if (!empty($visitorsByIp)): ?>
<section class="product-card" id="visitantes-por-ip">
  <h2 style="margin:0 0 4px;font-size:1.15rem;">Visitantes por IP / rede</h2>
  <p class="period" style="margin:0 0 8px;">Cada linha agrupa as sessões emitidas por um IP. Útil para identificar visitas repetidas — sem afirmar que correspondem a pessoas específicas.</p>
  <table class="ip-table">
    <thead>
      <tr>
        <th>Visitante (IP)</th>
        <th class="num">Sessões</th>
        <th class="num">Eventos</th>
        <th>Primeira</th>
        <th>Última</th>
        <th>Produtos</th>
        <th class="num">Pedidos</th>
        <th>Estado</th>
      </tr>
    </thead>
    <tbody>
      <?php foreach ($visitorsByIp as $r):
        $hasOrders = (int)$r['submitted_count'] > 0;
        $rowClass = 'ip-row' . ($hasOrders ? ' has-orders' : '');
        $isIgnored = !empty($r['is_ignored']);
        $products_csv = '';
        if (!empty($r['products'])) {
            $products_csv = implode(', ', array_map(function($p){ return product_friendly_name($p); }, $r['products']));
        }
      ?>
        <tr class="<?= $rowClass ?>">
          <td>
            <details>
              <summary><strong><?= admin_funnel_h(mp_visitor_label_for_ip($r['ip_number'])) ?></strong> · <code style="font-size:0.78rem;"><?= admin_funnel_h($r['ip_number']) ?></code></summary>
              <div style="margin-top:8px;padding:8px;background:rgba(255,255,255,0.55);border:1px dashed var(--line);border-radius:8px;">
                <p style="margin:0 0 4px;color:var(--muted);font-size:0.78rem;text-transform:uppercase;letter-spacing:0.04em;">Sessões recentes deste IP</p>
                <table class="sessions-table" style="margin-top:0;">
                  <thead><tr><th>Início</th><th>Última</th><th>Produto</th><th>Último passo</th><th class="num">Eventos</th><th>Estado</th></tr></thead>
                  <tbody>
                    <?php foreach ($r['sessions'] as $s):
                      $prodLabel = $s['last_product'] ? product_friendly_name($s['last_product']) : '—';
                      $stepLab   = $s['last_step'] ? step_label($s['last_step']) : '—';
                    ?>
                      <tr>
                        <td title="<?= admin_funnel_h($s['started_at']) ?>"><?= admin_funnel_h(mp_tracking_humanize_iso($s['started_at'])) ?></td>
                        <td title="<?= admin_funnel_h($s['last_at']) ?>"><?= admin_funnel_h(mp_tracking_humanize_iso($s['last_at'])) ?></td>
                        <td><?= admin_funnel_h($prodLabel) ?></td>
                        <td><?= admin_funnel_h($stepLab) ?></td>
                        <td class="num"><?= (int)$s['events_count'] ?></td>
                        <td><?= (int)$s['submitted'] ? '<strong style="color:var(--moss);">enviou pedido</strong>' : '<span class="muted">em progresso/abandonou</span>' ?></td>
                      </tr>
                    <?php endforeach; ?>
                  </tbody>
                </table>
              </div>
            </details>
          </td>
          <td class="num"><?= (int)$r['sessions_count'] ?></td>
          <td class="num"><?= (int)$r['events_count'] ?></td>
          <td title="<?= admin_funnel_h($r['first_seen']) ?>"><?= admin_funnel_h(mp_tracking_humanize_iso($r['first_seen'])) ?></td>
          <td title="<?= admin_funnel_h($r['last_seen']) ?>"><?= admin_funnel_h(mp_tracking_humanize_iso($r['last_seen'])) ?></td>
          <td><?= admin_funnel_h($products_csv) ?><?php if (!empty($r['last_vw'])): ?><div class="muted" style="font-size:0.74rem;"><?= (int)$r['last_vw'] ?>px</div><?php endif; ?></td>
          <td class="num"><?= (int)$r['submitted_count'] ?></td>
          <td><?= $isIgnored ? '<span class="muted">ignorado/admin</span>' : '—' ?></td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</section>
<?php endif; ?>

<!-- ATTRIBUTION_SECTION_PHASE_3 -->
<?php if (!empty($attributionByCategory)): ?>
<section class="product-card" id="origem-visitantes">
  <h2 style="margin:0 0 4px;font-size:1.15rem;">Origem dos visitantes</h2>
  <p class="period" style="margin:0 0 14px;">Classificação por origem na primeira página da sessão (UTM &gt; first_referrer &gt; referrer actual).</p>
  <div class="metrics" style="margin-bottom:14px;">
    <?php
      $totalAttr = array_sum($attributionByCategory);
      foreach ($attributionByCategory as $cat => $cnt):
    ?>
      <div class="metric">
        <div class="label"><?= admin_funnel_h($cat) ?></div>
        <div class="value" style="font-size:1.1rem;"><?= (int)$cnt ?></div>
        <div class="sub"><?= $totalAttr ? round($cnt / $totalAttr * 100, 1) : 0 ?>% das sessões</div>
      </div>
    <?php endforeach; ?>
  </div>

  <details>
    <summary style="cursor:pointer;color:var(--muted);font-size:0.85rem;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;">Detalhe por sessão (até 80)</summary>
    <table class="sessions-table" style="margin-top:10px;">
      <thead>
        <tr>
          <th>Categoria</th>
          <th>1ª vez</th>
          <th>Visitante (IP)</th>
          <th>Landing inicial</th>
          <th>Referrer inicial</th>
          <th>UTM source/medium/campaign</th>
        </tr>
      </thead>
      <tbody>
        <?php
          $rows = $attributionBySession;
          uasort($rows, function ($a, $b) { return strcmp($b['first_at'], $a['first_at']); });
          $count = 0;
          foreach ($rows as $sid => $row):
            if ($count++ >= 80) break;
            $cls = mp_attribution_classify(array(
                'utm_source' => $row['utm_source'],
                'first_referrer' => $row['first_referrer'],
                'referrer' => $row['referrer'],
            ));
        ?>
        <tr>
          <td><?= render_attribution_chip($cls) ?></td>
          <td title="<?= admin_funnel_h($row['first_at']) ?>"><?= admin_funnel_h(mp_tracking_humanize_iso($row['first_at'])) ?></td>
          <td><strong><?= admin_funnel_h(mp_visitor_label_for_ip($row['ip'])) ?></strong> · <code style="font-size:0.78rem;"><?= admin_funnel_h($row['ip'] ?: '—') ?></code></td>
          <td><?php $land = $row['first_landing'] ?: $row['landing']; ?><span title="<?= admin_funnel_h($land) ?>"><?= admin_funnel_h(strlen($land) > 32 ? substr($land, 0, 32) . '…' : $land) ?></span></td>
          <td>
            <?php
              $fr = $row['first_referrer'] ?: $row['referrer'];
              if ($fr === '') echo '<span class="muted">—</span>';
              else echo '<span title="' . admin_funnel_h($fr) . '">' . admin_funnel_h(strlen($fr) > 40 ? substr($fr, 0, 40) . '…' : $fr) . '</span>';
            ?>
          </td>
          <td>
            <?php
              $utm = array_filter(array($row['utm_source'], $row['utm_medium'], $row['utm_campaign']));
              echo $utm ? admin_funnel_h(implode(' · ', $utm)) : '<span class="muted">—</span>';
            ?>
          </td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </details>
</section>
<?php endif; ?>

<!-- GEO_MAP_SECTION_PHASE_2 -->
<section class="product-card" id="mapa-visitantes">
  <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:baseline;">
    <div>
      <h2 style="margin:0 0 4px;font-size:1.15rem;">Mapa de visitantes</h2>
      <p class="period" style="margin:0;">Geolocalização aproximada via cache de IP lookups. Apenas executado a partir do admin — nunca durante a navegação pública.</p>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <span class="muted" style="font-size:0.82rem;">Cache: <?= (int)$ipLookupResolved ?>/<?= (int)$ipLookupTotal ?> resolvidos · <?= (int)$ipLookupErrors ?> erros · <?= (int)$ipLookupPrivate ?> privados</span>
      <?php if ($shouldEnrich): ?>
        <span class="muted" style="font-size:0.82rem;">Enriqueceu <?= (int)$enrichDone ?> novos</span>
      <?php else: ?>
        <a href="admin-funnel.php?period=<?= admin_funnel_h($period) ?>&amp;enrich=1#mapa-visitantes" style="padding:6px 12px;border-radius:999px;border:1px solid var(--moss);background:rgba(79,122,58,0.12);color:var(--moss);text-decoration:none;font-weight:800;font-size:0.82rem;">Resolver mais IPs (até 12)</a>
      <?php endif; ?>
    </div>
  </div>

  <?php
    // Detecta cenário "só IPs locais/privados" para mostrar empty state amigável
    // em testes locais em vez de uma mensagem genérica.
    $publicIpsKnown = 0;
    $publicIpsResolved = 0;
    $privateIpsKnown = 0;
    foreach ($ipsForLookup as $ip) {
        if (mp_tracking_ip_is_public($ip)) {
            $publicIpsKnown++;
            if (isset($ipLookupCache[$ip]) && (!empty($ipLookupCache[$ip]['country_code']) || !empty($ipLookupCache[$ip]['country_name']))) {
                $publicIpsResolved++;
            }
        } elseif ($ip !== '') {
            $privateIpsKnown++;
        }
    }
    $allPrivate = ($publicIpsKnown === 0 && $privateIpsKnown > 0);
  ?>
  <?php if (empty($mapPoints) && $allPrivate): ?>
    <div class="interest-empty" style="margin:14px 0 0;">
      <strong>Sem mapa em testes locais.</strong>
      Detectámos só IPs locais/privados (ex.: <code>127.0.0.1</code>). Quando o site estiver online, os visitantes com IP público aparecem aqui como pontos aproximados.
    </div>
  <?php elseif (empty($mapPoints)): ?>
    <div class="interest-empty" style="margin:14px 0 0;">
      <strong>Localização ainda não resolvida.</strong>
      <?php if ($publicIpsKnown > 0): ?>
        Há <?= (int)$publicIpsKnown ?> IP(s) público(s) à espera de enriquecimento. Carrega em <em>Resolver mais IPs</em> para popular o mapa (até 12 por carregamento).
      <?php else: ?>
        Carrega em <em>Resolver mais IPs</em> para começar a popular o mapa.
      <?php endif; ?>
    </div>
  <?php else: ?>
    <div id="leaflet-map" class="geo-map" data-points='<?= admin_funnel_h(json_encode($mapPoints, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) ?>' style="margin-top:14px;"></div>
    <p class="muted" style="font-size:0.76rem;margin:6px 0 0;">Os pontos representam localizações aproximadas a partir do IP — não são moradas exactas. Algumas vão para o centro do país/cidade.</p>
  <?php endif; ?>

  <?php if ($privateIpsKnown > 0): ?>
    <p class="muted" style="font-size:0.78rem;margin:6px 0 0;">Visitantes locais/privados (não mapeáveis): <strong><?= (int)$privateIpsKnown ?></strong></p>
  <?php endif; ?>

  <div class="geo-summary-grid">
    <div>
      <p class="kicker" style="margin-top:0;">Top países</p>
      <?php if (empty($topCountries)): ?><p class="muted" style="margin:0;">Sem dados.</p><?php else:
        $shown = 0; foreach ($topCountries as $k => $v):
          if ($shown++ >= 8) break;
      ?>
        <div style="display:flex;justify-content:space-between;font-size:0.86rem;border-bottom:1px solid var(--line);padding:4px 0;">
          <span><?= admin_funnel_h($k) ?></span><strong><?= (int)$v ?></strong>
        </div>
      <?php endforeach; endif; ?>
    </div>
    <div>
      <p class="kicker" style="margin-top:0;">Top cidades</p>
      <?php if (empty($topCities)): ?><p class="muted" style="margin:0;">Sem dados.</p><?php else:
        $shown = 0; foreach ($topCities as $k => $v):
          if ($shown++ >= 8) break;
      ?>
        <div style="display:flex;justify-content:space-between;font-size:0.86rem;border-bottom:1px solid var(--line);padding:4px 0;">
          <span><?= admin_funnel_h($k) ?></span><strong><?= (int)$v ?></strong>
        </div>
      <?php endforeach; endif; ?>
    </div>
    <div>
      <p class="kicker" style="margin-top:0;">Top redes / ISPs</p>
      <?php if (empty($topNetworks)): ?><p class="muted" style="margin:0;">Sem dados.</p><?php else:
        $shown = 0; foreach ($topNetworks as $k => $v):
          if ($shown++ >= 8) break;
      ?>
        <div style="display:flex;justify-content:space-between;font-size:0.86rem;border-bottom:1px solid var(--line);padding:4px 0;">
          <span><?= admin_funnel_h($k) ?></span><strong><?= (int)$v ?></strong>
        </div>
      <?php endforeach; endif; ?>
      <?php if ($hostingCount > 0): ?>
        <p style="margin:8px 0 0;color:#8b2e22;font-size:0.78rem;">⚠️ Possível tráfego cloud/hosting/VPN: <strong><?= (int)$hostingCount ?></strong> sessão(ões)<?php if (!empty($hostingSamples)): ?> · ex.: <code><?= admin_funnel_h(implode(', ', array_slice($hostingSamples, 0, 3))) ?></code><?php endif; ?></p>
      <?php endif; ?>
    </div>
  </div>

  <?php if (!empty($visitorsByIp)): ?>
    <details style="margin-top:14px;">
      <summary style="cursor:pointer;color:var(--muted);font-size:0.85rem;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;">Detalhe de rede por IP (RDAP)</summary>
      <table class="sessions-table" style="margin-top:10px;">
        <thead><tr><th>IP</th><th>País / cidade</th><th>ASN</th><th>ISP / org</th><th>Rede (RDAP)</th><th>Hosting?</th></tr></thead>
        <tbody>
          <?php $count = 0; foreach ($visitorsByIp as $r):
            if ($count++ >= 40) break;
            $info = isset($ipLookupCache[$r['ip_number']]) ? $ipLookupCache[$r['ip_number']] : null;
          ?>
            <tr>
              <td><code style="font-size:0.78rem;"><?= admin_funnel_h($r['ip_number']) ?></code></td>
              <td><?= $info && ($info['country_name'] || $info['city']) ? admin_funnel_h(trim(($info['country_name'] ?: '') . ' · ' . ($info['city'] ?: '')) . ($info['region'] ? ' (' . $info['region'] . ')' : '')) : '<span class="muted">localização ainda não resolvida</span>' ?></td>
              <td><?= $info && $info['asn'] ? admin_funnel_h($info['asn']) : '<span class="muted">—</span>' ?></td>
              <td><?= $info && ($info['isp'] || $info['org']) ? admin_funnel_h(($info['isp'] ?: $info['org'])) : '<span class="muted">—</span>' ?></td>
              <td><?= $info && $info['network_name'] ? admin_funnel_h($info['network_name']) : '<span class="muted">—</span>' ?></td>
              <td><?= $info && !empty($info['is_hosting_guess']) ? '<span style="color:#8b2e22;">provável</span>' : '<span class="muted">não</span>' ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </details>
  <?php endif; ?>
</section>

<?php if (empty($events)): ?>
  <div class="empty-state">
    <strong>Sem eventos registados neste período.</strong>
    <p>Os eventos aparecem assim que houver tráfego nas páginas de produto.</p>
  </div>
<?php else: ?>
  <details class="report-collapse" id="relatorio-detalhado">
    <summary>Relatório detalhado por produto (funil, dispositivos, validações, cliques, dead taps)</summary>
  <?php foreach ($products as $slug => $data):
    if ($data['sessions'] === 0) continue;
    $order = isset($productOrders[$slug]) ? $productOrders[$slug] : array_keys($data['steps']);
    $stepCounts = array();
    foreach ($order as $stepId) {
        $stepCounts[$stepId] = isset($data['steps'][$stepId]) ? $data['steps'][$stepId] : 0;
    }
    $biggestDrop = null;
    $prevCount = $data['sessions'];
    $prevLabel = 'Iniciaram';
    foreach ($order as $stepId) {
        $count = isset($stepCounts[$stepId]) ? $stepCounts[$stepId] : 0;
        $drop = $prevCount - $count;
        if ($biggestDrop === null || $drop > $biggestDrop['drop']) {
            $biggestDrop = array('from' => $prevLabel, 'to' => step_label($stepId), 'drop' => $drop);
        }
        $prevCount = $count;
        $prevLabel = step_label($stepId);
    }
    $submitDrop = $prevCount - $data['submitted'];
    if ($biggestDrop === null || $submitDrop > $biggestDrop['drop']) {
        $biggestDrop = array('from' => $prevLabel, 'to' => 'Pedido enviado', 'drop' => $submitDrop);
    }
    $avgSubmit = avg_seconds($data['submit_durations']);
    $avgAbandon = avg_seconds($data['abandon_durations']);
    $maxBar = max(1, $data['sessions']);
    $maxBucket = max(1, max($data['viewport_buckets']));
  ?>
    <section class="product-card">
      <h2><?= htmlspecialchars(product_friendly_name($slug, isset($productNames[$slug]) ? $productNames[$slug] : '')) ?></h2>
      <p class="period">slug: <code><?= htmlspecialchars($slug) ?></code> · <?= htmlspecialchars($periodLabels[$period]) ?></p>

      <div class="metrics">
        <div class="metric"><div class="label">Sessões</div><div class="value"><?= (int)$data['sessions'] ?></div></div>
        <div class="metric"><div class="label">Pedidos enviados</div><div class="value"><?= (int)$data['submitted'] ?></div><div class="sub"><?= $data['sessions'] ? round($data['submitted'] / $data['sessions'] * 100, 1) : 0 ?>% conversão</div></div>
        <div class="metric"><div class="label">Mobile / Desktop / Tablet</div><div class="value" style="font-size:1.05rem;"><?= (int)$data['devices']['mobile'] ?> · <?= (int)$data['devices']['desktop'] ?> · <?= (int)$data['devices']['tablet'] ?></div></div>
        <div class="metric"><div class="label">Tempo médio até submeter</div><div class="value" style="font-size:1rem;"><?= $avgSubmit !== null ? fmt_seconds($avgSubmit) : '—' ?></div></div>
        <div class="metric"><div class="label">Tempo médio até abandonar</div><div class="value" style="font-size:1rem;"><?= $avgAbandon !== null ? fmt_seconds($avgAbandon) : '—' ?></div></div>
      </div>

      <table class="funnel">
        <thead><tr><th>Passo</th><th class="num">Sessões</th><th class="bar-cell">Volume relativo</th><th class="num">Tempo médio</th><th class="num">Mobile / Desktop</th></tr></thead>
        <tbody>
          <tr><td><strong>Iniciaram</strong></td><td class="num"><?= (int)$data['sessions'] ?></td><td class="bar-cell"><div class="bar"><span style="width:100%"></span></div></td><td class="num">—</td><td class="num">—</td></tr>
          <?php foreach ($order as $stepId):
            $count = isset($stepCounts[$stepId]) ? $stepCounts[$stepId] : 0;
            $width = $maxBar ? round($count / $maxBar * 100, 1) : 0;
            $avgStep = isset($data['step_durations'][$stepId]) ? avg_seconds($data['step_durations'][$stepId]) : null;
            $avgMobile = isset($data['step_durations_by_device'][$stepId . '|mobile']) ? avg_seconds($data['step_durations_by_device'][$stepId . '|mobile']) : null;
            $avgDesktop = isset($data['step_durations_by_device'][$stepId . '|desktop']) ? avg_seconds($data['step_durations_by_device'][$stepId . '|desktop']) : null;
          ?>
            <tr>
              <td><?= htmlspecialchars(step_label($stepId)) ?></td>
              <td class="num"><?= (int)$count ?></td>
              <td class="bar-cell"><div class="bar"><span style="width:<?= $width ?>%"></span></div></td>
              <td class="num"><?= $avgStep !== null ? fmt_seconds($avgStep) : '—' ?></td>
              <td class="num" style="font-size:0.84rem;"><?= $avgMobile !== null ? fmt_seconds($avgMobile) : '—' ?> · <?= $avgDesktop !== null ? fmt_seconds($avgDesktop) : '—' ?></td>
            </tr>
          <?php endforeach; ?>
          <tr><td><strong>Pedido enviado</strong></td><td class="num"><?= (int)$data['submitted'] ?></td><td class="bar-cell"><div class="bar"><span style="width:<?= $maxBar ? round($data['submitted'] / $maxBar * 100, 1) : 0 ?>%;background:var(--moss);"></span></div></td><td class="num">—</td><td class="num">—</td></tr>
        </tbody>
      </table>

      <?php if ($biggestDrop && $biggestDrop['drop'] > 0): ?>
        <div class="dropoff"><strong>Maior abandono:</strong> <?= htmlspecialchars($biggestDrop['from']) ?> → <?= htmlspecialchars($biggestDrop['to']) ?> · <?= (int)$biggestDrop['drop'] ?> sessões.</div>
      <?php endif; ?>

      <p class="kicker">Largura de viewport</p>
      <div class="viewport-grid">
        <?php foreach ($data['viewport_buckets'] as $bucket => $count):
          $width = $maxBucket > 0 ? round($count / $maxBucket * 100, 1) : 0;
        ?>
          <span class="lab"><?= htmlspecialchars($bucket) ?> px</span>
          <div class="bar"><span style="width:<?= $width ?>%"></span></div>
          <span class="cnt"><?= (int)$count ?></span>
        <?php endforeach; ?>
      </div>

      <?php if (!empty($data['validation_errors'])): ?>
        <p class="kicker">Erros de validação mais comuns</p>
        <div class="errors-list">
          <?php arsort($data['validation_errors']);
          foreach (array_slice($data['validation_errors'], 0, 8, true) as $stepId => $count): ?>
            <span class="tag"><?= htmlspecialchars(step_label($stepId)) ?> · <?= (int)$count ?></span>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

      <?php
        // CLICK_TRACKING_V1: cliques mais frequentes + dead taps por passo.
        $hasClicks = false;
        foreach ($data['actions_by_step'] as $s => $acts) { if (!empty($acts)) { $hasClicks = true; break; } }
        $hasDead = !empty($data['dead_taps_by_step']);
      ?>

      <?php if ($hasClicks): ?>
        <p class="kicker">Ações mais clicadas (por passo)</p>
        <table class="sessions-table">
          <thead><tr><th>Passo</th><th>Top 5 ações</th></tr></thead>
          <tbody>
            <?php foreach ($data['actions_by_step'] as $stepId => $acts):
              arsort($acts);
              $top = array_slice($acts, 0, 5, true);
              $parts = array();
              foreach ($top as $act => $cnt) { $parts[] = htmlspecialchars($act) . ' ×' . (int)$cnt; }
            ?>
              <tr><td><?= htmlspecialchars(step_label($stepId)) ?></td><td><?= implode(' · ', $parts) ?></td></tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>

      <?php if ($hasDead): ?>
        <p class="kicker">Dead taps (cliques em zonas sem acção)</p>
        <table class="sessions-table">
          <thead><tr><th>Passo</th><th class="num">Total</th><th>Grelha 20×20 (top 5 células)</th></tr></thead>
          <tbody>
            <?php foreach ($data['dead_taps_by_step'] as $stepId => $cnt):
              $cells = isset($data['dead_tap_grid'][$stepId]) ? $data['dead_tap_grid'][$stepId] : array();
              arsort($cells);
              $topCells = array_slice($cells, 0, 5, true);
              $parts = array();
              foreach ($topCells as $cell => $c) { $parts[] = '(' . htmlspecialchars($cell) . ') ×' . (int)$c; }
            ?>
              <tr><td><?= htmlspecialchars(step_label($stepId)) ?></td><td class="num"><?= (int)$cnt ?></td><td><?= implode(' · ', $parts) ?></td></tr>
            <?php endforeach; ?>
          </tbody>
        </table>
        <p style="margin:8px 0 0;color:var(--muted);font-size:0.82rem;">Por viewport: <?php
          $parts = array();
          foreach ($data['dead_taps_by_bucket'] as $b => $c) { $parts[] = htmlspecialchars($b) . 'px: ' . (int)$c; }
          echo implode(' · ', $parts);
        ?></p>
      <?php endif; ?>

      <?php if (!empty($data['sessions_recent'])): ?>
        <p class="kicker">Sessões mais recentes (até 20)</p>
        <table class="sessions-table">
          <thead><tr><th>Início</th><th>Dispositivo</th><th>Último passo</th><th>IP</th><th>Estado</th></tr></thead>
          <tbody>
            <?php foreach ($data['sessions_recent'] as $s):
              $startedIso = $s['started_at'] ? gmdate('Y-m-d\TH:i:s\Z', $s['started_at']) : '';
              $lastStepId = !empty($s['last_step']) ? end($s['last_step']) : '';
              $deviceLabel = '—';
              if ($s['device'] === 'mobile') $deviceLabel = 'Telemóvel';
              elseif ($s['device'] === 'tablet') $deviceLabel = 'Tablet';
              elseif ($s['device'] === 'desktop') $deviceLabel = 'Desktop';
            ?>
              <tr>
                <td title="<?= htmlspecialchars($startedIso) ?>"><?= htmlspecialchars($startedIso ? mp_tracking_humanize_iso($startedIso) : '—') ?></td>
                <td><?= htmlspecialchars($deviceLabel) ?><?php if ($s['viewport'] !== null): ?> <span style="color:var(--muted);">· <?= (int)$s['viewport'] ?>px</span><?php endif; ?></td>
                <td><?= htmlspecialchars($lastStepId ? step_label($lastStepId) : '—') ?></td>
                <td><code><?= htmlspecialchars($s['ip'] ?: '—') ?></code></td>
                <td><?= $s['submitted'] ? '<span style="color:var(--moss);font-weight:800;">Enviou pedido</span>' : '<span style="color:var(--muted);">Em progresso/abandonou</span>' ?></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>

      <!-- SELECTION_AGGREGATION_V1 (Phase 4) -->
      <?php if (!empty($data['design_selected_count'])):
        arsort($data['design_selected_count']);
        $topDesigns = array_slice($data['design_selected_count'], 0, 12, true);
      ?>
        <details style="margin-top:14px;">
          <summary style="cursor:pointer;color:var(--muted);font-size:0.85rem;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;">Designs mais escolhidos</summary>
          <table class="sessions-table design-grid-table" style="margin-top:8px;">
            <thead><tr><th>Design</th><th class="num">Selecções</th><th class="num">Sessões</th><th class="num">Comprado</th><th class="num">Abandonado</th></tr></thead>
            <tbody>
              <?php foreach ($topDesigns as $did => $cnt):
                $sessionsForDesign = isset($data['design_selected_sessions'][$did]) ? count($data['design_selected_sessions'][$did]) : 0;
                $purchasedForDesign = isset($data['design_purchased_sessions'][$did]) ? count($data['design_purchased_sessions'][$did]) : 0;
                $abandonedForDesign = max(0, $sessionsForDesign - $purchasedForDesign);
              ?>
                <tr>
                  <td><code><?= admin_funnel_h($did) ?></code></td>
                  <td class="num"><?= (int)$cnt ?></td>
                  <td class="num"><?= (int)$sessionsForDesign ?></td>
                  <td class="num"><?= (int)$purchasedForDesign ?></td>
                  <td class="num"><?= (int)$abandonedForDesign ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </details>

        <?php
          // Escolhidos mas não comprados — top 8 com mais abandono.
          $abandoned = array();
          foreach ($data['design_selected_sessions'] as $did => $sids) {
              $purchased = isset($data['design_purchased_sessions'][$did]) ? count($data['design_purchased_sessions'][$did]) : 0;
              $diff = count($sids) - $purchased;
              if ($diff > 0) $abandoned[$did] = $diff;
          }
          arsort($abandoned);
          $topAbandoned = array_slice($abandoned, 0, 8, true);
        ?>
        <?php if (!empty($topAbandoned)): ?>
          <details style="margin-top:10px;">
            <summary style="cursor:pointer;color:var(--muted);font-size:0.85rem;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;">Escolhidos mas não comprados</summary>
            <table class="sessions-table" style="margin-top:8px;">
              <thead><tr><th>Design</th><th class="num">Sessões que escolheram</th><th class="num">Compraram</th><th class="num">Abandonaram</th></tr></thead>
              <tbody>
                <?php foreach ($topAbandoned as $did => $diff):
                  $sessionsForDesign = isset($data['design_selected_sessions'][$did]) ? count($data['design_selected_sessions'][$did]) : 0;
                  $purchasedForDesign = isset($data['design_purchased_sessions'][$did]) ? count($data['design_purchased_sessions'][$did]) : 0;
                ?>
                  <tr>
                    <td><code><?= admin_funnel_h($did) ?></code></td>
                    <td class="num"><?= (int)$sessionsForDesign ?></td>
                    <td class="num"><?= (int)$purchasedForDesign ?></td>
                    <td class="num" style="color:#8b2e22;"><?= (int)$diff ?></td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </details>
        <?php endif; ?>
      <?php endif; ?>

      <?php if (!empty($data['options_selected'])):
        arsort($data['options_selected']);
        $topOpts = array_slice($data['options_selected'], 0, 16, true);
      ?>
        <details style="margin-top:10px;">
          <summary style="cursor:pointer;color:var(--muted);font-size:0.85rem;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;">Opções mais escolhidas</summary>
          <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">
            <?php foreach ($topOpts as $key => $cnt): ?>
              <span class="tag" style="background:rgba(184,134,22,0.12);border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:0.82rem;"><?= admin_funnel_h($key) ?> · <strong><?= (int)$cnt ?></strong></span>
            <?php endforeach; ?>
          </div>
        </details>
      <?php endif; ?>

      <!-- MAGNIFIER_AGGREGATION_V1 (Phase 5) -->
      <?php if (!empty($data['magnifier_by_design']) || !empty($data['magnifier_by_slot'])):
        arsort($data['magnifier_by_design']);
        $topMag = array_slice($data['magnifier_by_design'], 0, 12, true);
      ?>
        <details style="margin-top:10px;">
          <summary style="cursor:pointer;color:var(--muted);font-size:0.85rem;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;">Imagens mais ampliadas</summary>
          <table class="sessions-table" style="margin-top:8px;">
            <thead><tr><th>Design / item</th><th class="num">Ampliações</th><th class="num">Sessões</th><th class="num">Foi seleccionado</th><th class="num">Foi comprado</th></tr></thead>
            <tbody>
              <?php foreach ($topMag as $did => $cnt):
                $sForMag = isset($data['magnifier_sessions'][$did]) ? count($data['magnifier_sessions'][$did]) : 0;
                $selectedSessions = isset($data['design_selected_sessions'][$did]) ? count($data['design_selected_sessions'][$did]) : 0;
                $purchasedSessions = isset($data['design_purchased_sessions'][$did]) ? count($data['design_purchased_sessions'][$did]) : 0;
              ?>
                <tr>
                  <td><code><?= admin_funnel_h($did) ?></code></td>
                  <td class="num"><?= (int)$cnt ?></td>
                  <td class="num"><?= (int)$sForMag ?></td>
                  <td class="num"><?= (int)$selectedSessions ?></td>
                  <td class="num"><?= (int)$purchasedSessions ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
          <?php if (!empty($data['magnifier_by_slot'])):
            arsort($data['magnifier_by_slot']);
          ?>
            <p class="muted" style="font-size:0.82rem;margin:8px 0 0;">Por tipo de imagem: <?php
              $parts = array();
              foreach ($data['magnifier_by_slot'] as $slot => $cnt) {
                $parts[] = admin_funnel_h($slot) . ': <strong>' . (int)$cnt . '</strong>';
              }
              echo implode(' · ', $parts);
            ?></p>
          <?php endif; ?>

          <?php
            // Ampliado mas não seleccionado
            $magNotSelected = array();
            foreach ($data['magnifier_sessions'] as $did => $sessions) {
                $magSessionsN = count($sessions);
                $selSessionsN = isset($data['design_selected_sessions'][$did]) ? count($data['design_selected_sessions'][$did]) : 0;
                if ($magSessionsN > $selSessionsN) {
                    $magNotSelected[$did] = $magSessionsN - $selSessionsN;
                }
            }
            arsort($magNotSelected);
            $topMagNotSelected = array_slice($magNotSelected, 0, 8, true);
          ?>
          <?php if (!empty($topMagNotSelected)): ?>
            <p class="kicker" style="margin-top:10px;">Ampliado mas não seleccionado</p>
            <table class="sessions-table">
              <thead><tr><th>Design</th><th class="num">Sessões que ampliaram</th><th class="num">Sessões que escolheram</th><th class="num">Diferença</th></tr></thead>
              <tbody>
                <?php foreach ($topMagNotSelected as $did => $diff):
                  $magS = isset($data['magnifier_sessions'][$did]) ? count($data['magnifier_sessions'][$did]) : 0;
                  $selS = isset($data['design_selected_sessions'][$did]) ? count($data['design_selected_sessions'][$did]) : 0;
                ?>
                  <tr>
                    <td><code><?= admin_funnel_h($did) ?></code></td>
                    <td class="num"><?= (int)$magS ?></td>
                    <td class="num"><?= (int)$selS ?></td>
                    <td class="num" style="color:#8b2e22;"><?= (int)$diff ?></td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          <?php endif; ?>
        </details>
      <?php endif; ?>

      <!-- TRANSITION_REASONS_PHASE_7 -->
      <?php if (!empty($data['transition_reasons'])):
        arsort($data['transition_reasons']);
      ?>
        <p class="muted" style="margin-top:10px;font-size:0.82rem;">Movimentos entre passos: <?php
          $parts = array();
          $reasonLabels = array(
            'next_button' => 'continuou',
            'back_button' => 'voltou (botão)',
            'browser_back' => 'voltou (browser)',
            'validation_failed' => 'falhou validação',
            'auto_redirect' => 'automático',
            'direct_step_click' => 'salto directo',
            'initial' => 'entrada',
          );
          foreach ($data['transition_reasons'] as $rsn => $cnt) {
            $lab = isset($reasonLabels[$rsn]) ? $reasonLabels[$rsn] : $rsn;
            $parts[] = admin_funnel_h($lab) . ': <strong>' . (int)$cnt . '</strong>';
          }
          echo implode(' · ', $parts);
        ?></p>
      <?php endif; ?>
    </section>
  <?php endforeach; ?>
  </details>

  <?php
    $hasAny = false;
    foreach ($products as $d) { if ($d['sessions'] > 0) { $hasAny = true; break; } }
  ?>
  <?php if (!$hasAny): ?>
    <div class="empty-state">
      <strong>Sem sessões com produto associado neste período.</strong>
    </div>
  <?php endif; ?>
<?php endif; ?>
</main>
<?php if (!empty($mapPoints)): ?>
<!-- LEAFLET_MAP_PHASE_2: Leaflet carregado apenas no admin, com SRI quando possível. -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin="" defer></script>
<?php endif; ?>
<script>
  // VISITANTES_TEMPO_REAL_V1: auto-refresh leve a 30 s. Controlado pela
  // checkbox e persistido em localStorage para que a preferência sobreviva
  // a navegações. Reload completo (mais simples e seguro do que fetch
  // parcial; o utilizador é apenas o admin).
  (function () {
    var KEY = 'mp_funnel_visitors_autorefresh_v1';
    var checkbox = document.getElementById('visitors-autorefresh');
    if (!checkbox) return;
    try {
      var stored = window.localStorage.getItem(KEY);
      if (stored === '0') checkbox.checked = false;
    } catch (e) {}

    var timer = null;
    function schedule() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!checkbox.checked) return;
      timer = setTimeout(function () {
        // Mantém o âncora para que a página volte directamente à secção.
        var url = window.location.pathname + window.location.search + '#visitantes-tempo-real';
        window.location.replace(url);
      }, 30000);
    }
    checkbox.addEventListener('change', function () {
      try { window.localStorage.setItem(KEY, checkbox.checked ? '1' : '0'); } catch (e) {}
      schedule();
    });
    // Pausa quando o separador não está visível, para não desperdiçar
    // requests inúteis.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (timer) { clearTimeout(timer); timer = null; }
      } else {
        schedule();
      }
    });
    schedule();
  })();

  // LEAFLET_MAP_PHASE_2: inicializa o mapa quando o Leaflet estiver carregado.
  // Falha silenciosa se rede off — o dashboard não pode partir.
  (function () {
    function init() {
      try {
        var el = document.getElementById('leaflet-map');
        if (!el || !window.L) return;
        var rawPoints = el.getAttribute('data-points');
        var points;
        try { points = JSON.parse(rawPoints || '[]'); } catch (e) { points = []; }
        if (!points.length) return;
        var map = L.map(el, { scrollWheelZoom: false }).setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);
        var bounds = [];
        points.forEach(function (p) {
          if (typeof p.lat !== 'number' || typeof p.lon !== 'number') return;
          var marker = L.circleMarker([p.lat, p.lon], {
            radius: Math.max(4, Math.min(14, 4 + Math.sqrt(p.sessions || 1) * 2)),
            color: '#4f7a3a',
            weight: 1,
            fillColor: '#b88616',
            fillOpacity: 0.65,
          }).addTo(map);
          var html = '<strong>' + (p.city || '?') + '</strong>'
            + (p.region ? ', ' + p.region : '')
            + '<br>' + (p.country || '')
            + '<br>Sessões: <strong>' + (p.sessions || 1) + '</strong>'
            + (p.isp ? '<br>ISP: ' + p.isp : '')
            + (p.asn ? '<br>' + p.asn : '')
            + (p.last_seen ? '<br><span style="color:#76551c;font-size:0.8em;">Última: ' + p.last_seen + '</span>' : '');
          marker.bindPopup(html);
          bounds.push([p.lat, p.lon]);
        });
        if (bounds.length) {
          try { map.fitBounds(bounds, { padding: [24, 24], maxZoom: 7 }); } catch (e) {}
        }
      } catch (err) { /* silent */ }
    }
    if (window.L) init();
    else window.addEventListener('load', init);
  })();
</script>
</body>
</html>
