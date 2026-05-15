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

// VISITANTES_TEMPO_REAL_V1: agregação independente do filtro de período,
// limitada à última meia-hora. Devolve no máximo 50 sessões, ordenadas
// pelo evento mais recente. Para cada sessão, vamos depois ler o último
// evento (loop curto, ≤50 queries via índice idx_funnel_session).
$visitorsWindowMinutes = 30;
$visitorsWindowStart = gmdate('Y-m-d\TH:i:s\Z', time() - ($visitorsWindowMinutes * 60));
$visitorSessions = array();
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
        $stmtLast = $pdo->prepare(
            "SELECT * FROM funnel_events WHERE session_id = ?
             ORDER BY created_at DESC LIMIT 1"
        );
        foreach ($visitorAgg as $row) {
            $stmtLast->execute(array($row['session_id']));
            $last = $stmtLast->fetch();
            if (!$last) continue;
            $extra = isset($last['event_json']) ? json_decode($last['event_json'], true) : null;
            if (!is_array($extra)) $extra = array();
            $row['last_event']     = $last;
            $row['last_event_name']= isset($last['event_name']) ? (string)$last['event_name'] : '';
            $row['product_slug']   = isset($last['product_slug']) ? (string)$last['product_slug'] : '';
            $row['step_id']        = isset($last['step_id']) ? (string)$last['step_id'] : '';
            $row['device_type']    = isset($last['device_type']) ? (string)$last['device_type'] : '';
            $row['viewport_width'] = isset($last['viewport_width']) ? $last['viewport_width'] : null;
            $row['ip_number']      = isset($last['ip_number']) ? (string)$last['ip_number'] : '';
            $row['landing_page']   = isset($extra['landing_page']) ? (string)$extra['landing_page'] : '';
            $row['referrer']       = isset($extra['referrer']) ? (string)$extra['referrer'] : '';
            $visitorSessions[] = $row;
        }
    }
} catch (Exception $e) {
    @error_log('[miaandpaper] visitantes em tempo real falhou: ' . $e->getMessage());
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
        } elseif ($name === 'ui_interaction' && !empty($e['step_id'])) {
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
    );
    if (isset($names[$slug]) && $names[$slug] !== '') return $names[$slug];
    if ($fallbackFromJson !== '' && $fallbackFromJson !== $slug) return $fallbackFromJson;
    return $slug;
}

ksort($products);
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
    <a href="admin-orders.php" style="margin-left:8px;background:rgba(79,122,58,0.12);">Encomendas</a>
  </nav>
</header>

<main class="dashboard">
<?php if ($flashMessage !== ''): ?>
  <div class="empty-state" style="text-align:left;<?= $flashType === 'error' ? 'border-color:rgba(182,70,58,0.5);color:#8b2e22;' : 'border-color:rgba(79,122,58,0.4);color:#3a5a25;' ?>">
    <strong><?= $flashType === 'error' ? '⚠️' : '✓' ?></strong> <?= admin_funnel_h($flashMessage) ?>
  </div>
<?php endif; ?>

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
    $activeCount = 0; $recentCount = 0;
    foreach ($visitorSessions as $vs) {
        $ageSec = $nowTs - strtotime($vs['last_seen']);
        if ($ageSec <= 300) $activeCount++;
        else $recentCount++;
    }
  ?>
  <div class="metrics" style="margin-top:14px;margin-bottom:12px;">
    <div class="metric"><div class="label">Ativos agora (≤ 5 min)</div><div class="value"><?= (int)$activeCount ?></div></div>
    <div class="metric"><div class="label">Recentes (≤ 30 min)</div><div class="value"><?= (int)$recentCount ?></div></div>
    <div class="metric"><div class="label">Sessões na janela</div><div class="value"><?= count($visitorSessions) ?></div></div>
  </div>

  <?php if (empty($visitorSessions)): ?>
    <div class="empty-state" style="margin:6px 0 0;">Sem actividade nos últimos <?= (int)$visitorsWindowMinutes ?> minutos.</div>
  <?php else: ?>
    <table class="sessions-table" style="margin-top:0;">
      <thead>
        <tr>
          <th>Estado</th>
          <th>Produto</th>
          <th>Passo · evento</th>
          <th>Dispositivo</th>
          <th>Página / Referrer</th>
          <th class="num">Eventos</th>
          <th>Duração</th>
          <th>IP</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($visitorSessions as $vs):
          $ageSec = $nowTs - strtotime($vs['last_seen']);
          $durSec = strtotime($vs['last_seen']) - strtotime($vs['first_seen']);
          if ($durSec < 0) $durSec = 0;
          $active = $ageSec <= 300;
          $dot = $active ? '#4f7a3a' : '#b88616';
          $deviceLabel = '—';
          if ($vs['device_type'] === 'mobile') $deviceLabel = 'Telemóvel';
          elseif ($vs['device_type'] === 'tablet') $deviceLabel = 'Tablet';
          elseif ($vs['device_type'] === 'desktop') $deviceLabel = 'Desktop';
          $eventLabel = $vs['last_event_name'] !== '' ? $vs['last_event_name'] : '—';
          $stepLabelVal = $vs['step_id'] !== '' ? step_label($vs['step_id']) : '';
          $productLabel = $vs['product_slug'] !== '' ? product_friendly_name($vs['product_slug']) : '—';
          $landing = $vs['landing_page'] !== '' ? $vs['landing_page'] : '';
          $referrer = $vs['referrer'] !== '' ? $vs['referrer'] : '';
          $ipDisplay = $vs['ip_number'] !== '' ? $vs['ip_number'] : '—';
        ?>
          <tr>
            <td>
              <span title="<?= admin_funnel_h($vs['last_seen']) ?>" style="display:inline-flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:<?= $dot ?>;"></span>
                <?= admin_funnel_h(mp_tracking_humanize_iso($vs['last_seen'], $nowTs)) ?>
              </span>
              <?php if ((int)$vs['submitted'] === 1): ?>
                <div style="color:var(--moss);font-weight:800;font-size:0.78rem;">✓ Pedido enviado</div>
              <?php endif; ?>
            </td>
            <td><?= admin_funnel_h($productLabel) ?></td>
            <td>
              <?= admin_funnel_h($stepLabelVal ?: '—') ?>
              <?php if ($eventLabel !== '—'): ?>
                <div style="color:var(--muted);font-size:0.78rem;">· <?= admin_funnel_h($eventLabel) ?></div>
              <?php endif; ?>
            </td>
            <td><?= admin_funnel_h($deviceLabel) ?><?php if ($vs['viewport_width']): ?><div style="color:var(--muted);font-size:0.78rem;"><?= (int)$vs['viewport_width'] ?>px</div><?php endif; ?></td>
            <td>
              <?php if ($landing !== ''): ?><div title="<?= admin_funnel_h($landing) ?>"><?= admin_funnel_h(strlen($landing) > 28 ? substr($landing, 0, 28) . '…' : $landing) ?></div><?php else: ?>—<?php endif; ?>
              <?php if ($referrer !== ''): ?><div style="color:var(--muted);font-size:0.76rem;" title="<?= admin_funnel_h($referrer) ?>">ref: <?= admin_funnel_h(strlen($referrer) > 28 ? substr($referrer, 0, 28) . '…' : $referrer) ?></div><?php endif; ?>
            </td>
            <td class="num"><?= (int)$vs['event_count'] ?></td>
            <td title="<?= admin_funnel_h('Início: ' . $vs['first_seen']) ?>"><?= admin_funnel_h(mp_tracking_humanize_duration($durSec)) ?></td>
            <td><code><?= admin_funnel_h($ipDisplay) ?></code></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</section>

<?php if (empty($events)): ?>
  <div class="empty-state">
    <strong>Sem eventos registados neste período.</strong>
    <p>Os eventos aparecem assim que houver tráfego nas páginas de produto.</p>
  </div>
<?php else: ?>
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
    </section>
  <?php endforeach; ?>

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
</script>
</body>
</html>
