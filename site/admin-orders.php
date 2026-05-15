<?php
/**
 * admin-orders.php — ADMIN_ORDERS_V1
 *
 * Painel protegido para gerir encomendas guardadas em SQLite
 * (ver lib/db.php). Usa a mesma sessão de admin de admin-api.php
 * ($_SESSION['miaandpaper_admin']).
 *
 * GETs:
 *   ?view=list        — lista filtrável (default)
 *   ?view=detail&id=X — detalhe de uma encomenda
 *   ?view=new         — formulário para criar encomenda manual
 *
 * POSTs (com CSRF token):
 *   action=update          — actualiza payment_status / fulfillment_status / tracking / notes
 *   action=mark_paid       — marca paid + paid_at (Fase 5 vai juntar email)
 *   action=mark_shipped    — guarda tracking_number + marca shipped (Fase 5 email)
 *   action=cancel          — fulfillment_status = cancelled
 *   action=create_manual   — insere encomenda com source = 'manual'
 *
 * Não expõe a base SQLite directamente. Filtros e edição via formulários.
 */

session_start();

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
        . '<title>Acesso negado · Encomendas</title>'
        . '<style>body{font-family:Georgia,serif;max-width:560px;margin:60px auto;padding:0 20px;color:#3b2f1f;}h1{font-size:1.4rem;}a{color:#4f7a3a;font-weight:700;}</style>'
        . '<h1>Acesso restrito.</h1>'
        . '<p>Inicia sessão como administradora a partir de <a href="index.html">index.html</a> e regressa a esta página.</p>';
    exit;
}

require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/mail.php';

// CSRF token simples — gera + valida na mesma sessão.
if (empty($_SESSION['mp_admin_csrf'])) {
    $_SESSION['mp_admin_csrf'] = bin2hex(random_bytes(16));
}
$csrf = $_SESSION['mp_admin_csrf'];

function admin_orders_h($value)
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function admin_orders_cents_to_eur($cents)
{
    $cents = (int)$cents;
    return number_format($cents / 100, 2, ',', ' ') . ' €';
}

function admin_orders_friendly_status($payment, $fulfillment)
{
    $f = $fulfillment ?: 'new';
    $p = $payment ?: 'unpaid';

    $map = array(
        'new' => 'Nova',
        'preparing' => 'Em preparação',
        'shipped' => 'Enviada',
        'cancelled' => 'Cancelada',
    );

    $label = isset($map[$f]) ? $map[$f] : $f;
    $label .= $p === 'paid' ? ' · Paga' : ' · Por pagar';
    return $label;
}

function admin_orders_check_csrf()
{
    $sent = isset($_POST['csrf']) ? (string)$_POST['csrf'] : '';
    if ($sent === '' || !hash_equals((string)$_SESSION['mp_admin_csrf'], $sent)) {
        http_response_code(403);
        echo 'CSRF inválido. Recarrega a página e tenta novamente.';
        exit;
    }
}

// ---- ACTIONS (POST) -------------------------------------------------------
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    admin_orders_check_csrf();

    $action = isset($_POST['action']) ? (string)$_POST['action'] : '';
    $orderId = isset($_POST['id']) ? (int)$_POST['id'] : 0;
    $pdo = mp_db();
    $now = mp_db_now();

    try {
        if ($action === 'update' && $orderId > 0) {
            $paymentStatus = isset($_POST['payment_status']) ? (string)$_POST['payment_status'] : 'unpaid';
            $fulfillmentStatus = isset($_POST['fulfillment_status']) ? (string)$_POST['fulfillment_status'] : 'new';
            $tracking = isset($_POST['tracking_number']) ? trim((string)$_POST['tracking_number']) : '';
            $notes = isset($_POST['admin_notes']) ? trim((string)$_POST['admin_notes']) : '';

            $stmt = $pdo->prepare('UPDATE orders SET payment_status=?, paid=?, fulfillment_status=?, tracking_number=?, admin_notes=?, updated_at=? WHERE id=?');
            $stmt->execute(array(
                $paymentStatus,
                $paymentStatus === 'paid' ? 1 : 0,
                $fulfillmentStatus,
                $tracking,
                $notes,
                $now,
                $orderId,
            ));
            mp_db_log_order_event($orderId, 'admin_updated', array(
                'payment_status' => $paymentStatus,
                'fulfillment_status' => $fulfillmentStatus,
                'tracking_set' => $tracking !== '',
                'notes_set' => $notes !== '',
            ));
            header('Location: admin-orders.php?view=detail&id=' . $orderId . '&saved=1');
            exit;
        }

        if ($action === 'mark_paid' && $orderId > 0) {
            // IDEMPOTENT_ADMIN_EMAILS_V1: lê o estado actual antes de
            // tocar na encomenda. Se já estiver paga, não actualiza, não
            // envia email, e devolve flash explícito para o admin.
            $orderRow = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
            $orderRow->execute(array($orderId));
            $orderData = $orderRow->fetch();

            if (!$orderData) {
                header('Location: admin-orders.php?view=list');
                exit;
            }

            if ($orderData['payment_status'] === 'paid') {
                mp_db_log_order_event($orderId, 'mark_paid_skipped_already_paid', null);
                header('Location: admin-orders.php?view=detail&id=' . $orderId . '&email=already');
                exit;
            }

            $pdo->prepare('UPDATE orders SET payment_status=?, paid=1, paid_at=?, updated_at=? WHERE id=?')
                ->execute(array('paid', $now, $now, $orderId));
            mp_db_log_order_event($orderId, 'marked_paid', null);

            // Re-fetch para garantir paid_at actualizado antes do email.
            $orderRow->execute(array($orderId));
            $orderData = $orderRow->fetch();

            $mailResult = mp_mail_send_paid_for_order($orderData);
            mp_db_log_order_event($orderId, $mailResult['success'] ? 'email_sent' : 'email_failed', array(
                'type' => 'paid_confirmed',
                'recipient' => $mailResult['recipient'],
                'error' => $mailResult['error'],
            ));
            $emailFlag = $mailResult['success'] ? '&email=1' : ($mailResult['recipient'] === null ? '&email=noemail' : '&email=failed');

            header('Location: admin-orders.php?view=detail&id=' . $orderId . '&paid=1' . $emailFlag);
            exit;
        }

        if ($action === 'resend_paid_email' && $orderId > 0) {
            // IDEMPOTENT_ADMIN_EMAILS_V1: reenvio explícito do email de
            // pagamento. Não muda o estado da encomenda; só dispara o
            // email e regista um event_type distinto para auditoria.
            $orderRow = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
            $orderRow->execute(array($orderId));
            $orderData = $orderRow->fetch();

            if (!$orderData || $orderData['payment_status'] !== 'paid') {
                header('Location: admin-orders.php?view=detail&id=' . $orderId);
                exit;
            }

            $mailResult = mp_mail_send_paid_for_order($orderData);
            mp_db_log_order_event($orderId, $mailResult['success'] ? 'email_resent' : 'email_resent_failed', array(
                'type' => 'paid_confirmed',
                'recipient' => $mailResult['recipient'],
                'error' => $mailResult['error'],
            ));
            $emailFlag = $mailResult['success'] ? '&email=resent' : ($mailResult['recipient'] === null ? '&email=noemail' : '&email=failed');
            header('Location: admin-orders.php?view=detail&id=' . $orderId . $emailFlag);
            exit;
        }

        if ($action === 'mark_shipped' && $orderId > 0) {
            $tracking = isset($_POST['tracking_number']) ? trim((string)$_POST['tracking_number']) : '';

            // IDEMPOTENT_ADMIN_EMAILS_V1: idem mark_paid — se já estiver
            // enviada, não sobrescreve shipped_at nem dispara email.
            $orderRow = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
            $orderRow->execute(array($orderId));
            $orderData = $orderRow->fetch();

            if (!$orderData) {
                header('Location: admin-orders.php?view=list');
                exit;
            }

            if ($orderData['fulfillment_status'] === 'shipped') {
                mp_db_log_order_event($orderId, 'mark_shipped_skipped_already_shipped', array(
                    'tracking_attempted' => $tracking,
                ));
                header('Location: admin-orders.php?view=detail&id=' . $orderId . '&email=already');
                exit;
            }

            $pdo->prepare('UPDATE orders SET fulfillment_status=?, shipped_at=?, tracking_number=?, updated_at=? WHERE id=?')
                ->execute(array('shipped', $now, $tracking, $now, $orderId));
            mp_db_log_order_event($orderId, 'marked_shipped', array(
                'tracking_number' => $tracking,
            ));

            $orderRow->execute(array($orderId));
            $orderData = $orderRow->fetch();

            $mailResult = mp_mail_send_shipped_for_order($orderData, $tracking);
            mp_db_log_order_event($orderId, $mailResult['success'] ? 'email_sent' : 'email_failed', array(
                'type' => 'shipped',
                'recipient' => $mailResult['recipient'],
                'error' => $mailResult['error'],
            ));
            $emailFlag = $mailResult['success'] ? '&email=1' : ($mailResult['recipient'] === null ? '&email=noemail' : '&email=failed');

            header('Location: admin-orders.php?view=detail&id=' . $orderId . '&shipped=1' . $emailFlag);
            exit;
        }

        if ($action === 'resend_shipped_email' && $orderId > 0) {
            // IDEMPOTENT_ADMIN_EMAILS_V1: reenvio do email de envio.
            $orderRow = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
            $orderRow->execute(array($orderId));
            $orderData = $orderRow->fetch();

            if (!$orderData || $orderData['fulfillment_status'] !== 'shipped') {
                header('Location: admin-orders.php?view=detail&id=' . $orderId);
                exit;
            }

            $tracking = isset($orderData['tracking_number']) ? (string)$orderData['tracking_number'] : '';
            $mailResult = mp_mail_send_shipped_for_order($orderData, $tracking);
            mp_db_log_order_event($orderId, $mailResult['success'] ? 'email_resent' : 'email_resent_failed', array(
                'type' => 'shipped',
                'recipient' => $mailResult['recipient'],
                'error' => $mailResult['error'],
            ));
            $emailFlag = $mailResult['success'] ? '&email=resent' : ($mailResult['recipient'] === null ? '&email=noemail' : '&email=failed');
            header('Location: admin-orders.php?view=detail&id=' . $orderId . $emailFlag);
            exit;
        }

        if ($action === 'cancel' && $orderId > 0) {
            $pdo->prepare('UPDATE orders SET fulfillment_status=?, updated_at=? WHERE id=?')
                ->execute(array('cancelled', $now, $orderId));
            mp_db_log_order_event($orderId, 'cancelled', null);
            header('Location: admin-orders.php?view=detail&id=' . $orderId . '&cancelled=1');
            exit;
        }

        if ($action === 'download_backup') {
            // SQLITE_BACKUP_V1: faz wal_checkpoint(TRUNCATE) e stream do
            // ficheiro SQLite com Content-Disposition. Não escreve nada
            // na document root — readfile directamente do private dir.
            try {
                $pdo->exec('PRAGMA wal_checkpoint(TRUNCATE)');
            } catch (Exception $e) {
                @error_log('[miaandpaper] backup wal_checkpoint falhou: ' . $e->getMessage());
            }
            $dbPath = mp_db_path();
            if (!$dbPath || !is_file($dbPath)) {
                http_response_code(500);
                echo 'Backup falhou: ficheiro SQLite não encontrado.';
                exit;
            }
            mp_db_log_admin_login_attempt(array(
                'attempt_type' => 'BACKUP_DOWNLOADED',
                'ip_number' => isset($_SERVER['REMOTE_ADDR']) ? (string)$_SERVER['REMOTE_ADDR'] : '',
                'user_agent' => isset($_SERVER['HTTP_USER_AGENT']) ? (string)$_SERVER['HTTP_USER_AGENT'] : '',
                'input_text' => basename($dbPath),
            ));
            $filename = 'miaandpaper-' . gmdate('Ymd-His') . '.sqlite';
            while (ob_get_level() > 0) { ob_end_clean(); }
            header('Content-Type: application/octet-stream');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            header('Content-Length: ' . filesize($dbPath));
            header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
            header('Pragma: no-cache');
            header('X-Content-Type-Options: nosniff');
            readfile($dbPath);
            exit;
        }

        if ($action === 'create_manual') {
            $orderCode = mp_db_generate_order_code();
            $newId = mp_db_insert_order(array(
                'order_code' => $orderCode,
                'source' => 'manual',
                'product_slug' => trim((string)($_POST['product_slug'] ?? '')),
                'product_type' => trim((string)($_POST['product_slug'] ?? '')),
                'customer_name' => trim((string)($_POST['customer_name'] ?? '')),
                'customer_contact' => trim((string)($_POST['customer_contact'] ?? '')),
                'card_name' => trim((string)($_POST['card_name'] ?? '')),
                'congregation' => trim((string)($_POST['congregation'] ?? '')),
                'delivery_option' => trim((string)($_POST['delivery_option'] ?? 'pickup')),
                'delivery_label' => trim((string)($_POST['delivery_label'] ?? '')),
                'subtotal_cents' => (int)round(((float)($_POST['subtotal_eur'] ?? 0)) * 100),
                'shipping_estimate_cents' => (int)round(((float)($_POST['shipping_eur'] ?? 0)) * 100),
                'total_estimate_cents' => (int)round(((float)($_POST['total_eur'] ?? 0)) * 100),
                'admin_notes' => trim((string)($_POST['admin_notes'] ?? '')),
                'raw_order_json' => json_encode(array(
                    'manual' => true,
                    'product_slug' => trim((string)($_POST['product_slug'] ?? '')),
                    'customer_name' => trim((string)($_POST['customer_name'] ?? '')),
                    'customer_contact' => trim((string)($_POST['customer_contact'] ?? '')),
                    'notes' => trim((string)($_POST['admin_notes'] ?? '')),
                ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ));
            mp_db_log_order_event($newId, 'created_manual', array('order_code' => $orderCode));
            header('Location: admin-orders.php?view=detail&id=' . $newId . '&created=1');
            exit;
        }

        // Acção desconhecida.
        header('Location: admin-orders.php?view=list');
        exit;
    } catch (Exception $e) {
        // SAFE_ERROR_OUTPUT_V1: detalhe vai só para o log do servidor; o
        // admin vê apenas confirmação de falha + sugestão para consultar log.
        @error_log('[miaandpaper] admin-orders POST falhou (action=' . $action . ', order=' . $orderId . '): ' . $e->getMessage());
        http_response_code(500);
        echo 'Acção falhou. Verifica o error_log do servidor para mais detalhe.';
        exit;
    }
}

// ---- GET (views) ---------------------------------------------------------
$view = isset($_GET['view']) ? (string)$_GET['view'] : 'list';
$pdo = mp_db();

header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Encomendas · Mia &amp; Paper admin</title>
<style>
:root {
  --ink: #3b2f1f;
  --muted: #76551c;
  --line: rgba(118, 85, 28, 0.22);
  --gold: #b88616;
  --moss: #4f7a3a;
  --bg: #fffbe9;
  --card: #fff8df;
  --error: #b6463a;
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 0;
  font-family: Georgia, "Times New Roman", serif;
  background: var(--bg); color: var(--ink); line-height: 1.5;
}
header.page-header {
  padding: 22px 28px;
  border-bottom: 1px solid var(--line);
  display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap;
}
header.page-header h1 { margin: 0; font-size: 1.4rem; }
header nav a {
  margin-right: 14px;
  text-decoration: none;
  color: var(--muted);
  font-weight: 800;
  font-size: 0.92rem;
}
header nav a.is-active { color: var(--gold); }
main.dashboard { padding: 24px 28px 80px; max-width: 1240px; margin: 0 auto; }
.filters {
  display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;
  align-items: center;
}
.filters a, .filters select {
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.55);
  text-decoration: none;
  color: var(--muted);
  font-weight: 700;
  font-size: 0.88rem;
}
.filters a.is-active { background: var(--gold); color: #fff; border-color: var(--gold); }
.flash {
  padding: 10px 14px; border-radius: 10px; margin-bottom: 16px;
  background: rgba(79, 122, 58, 0.12); border: 1px solid rgba(79, 122, 58, 0.35);
  color: var(--moss); font-weight: 700;
}
table.orders {
  width: 100%; border-collapse: collapse; background: var(--card);
  border: 1px solid var(--line); border-radius: 12px; overflow: hidden;
}
table.orders th, table.orders td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--line); font-size: 0.92rem; }
table.orders th { background: rgba(184, 134, 22, 0.08); color: var(--muted); font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; }
table.orders tr:last-child td { border-bottom: 0; }
table.orders td.num { text-align: right; font-weight: 800; }
table.orders a.row-link { color: var(--ink); font-weight: 800; text-decoration: none; }
table.orders a.row-link:hover { color: var(--gold); }
.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.78rem; font-weight: 800; }
.badge-new { background: rgba(79, 122, 58, 0.16); color: var(--moss); }
.badge-preparing { background: rgba(184, 134, 22, 0.16); color: var(--gold); }
.badge-shipped { background: rgba(184, 134, 22, 0.32); color: var(--ink); }
.badge-cancelled { background: rgba(182, 70, 58, 0.16); color: var(--error); }
.badge-paid { background: rgba(79, 122, 58, 0.20); color: var(--moss); }
.badge-unpaid { background: rgba(182, 70, 58, 0.18); color: var(--error); }
.detail-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
section.card {
  background: var(--card); border: 1px solid var(--line);
  border-radius: 12px; padding: 18px 20px;
}
section.card h2 { margin: 0 0 12px; font-size: 1.1rem; }
section.card h3 { margin: 16px 0 6px; font-size: 0.92rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
dl.kv { display: grid; grid-template-columns: 1fr 2fr; gap: 6px 14px; margin: 0; }
dl.kv dt { color: var(--muted); font-size: 0.86rem; }
dl.kv dd { margin: 0; font-weight: 700; word-break: break-word; }
form.inline { display: inline-block; margin-right: 8px; }
form.stacked { display: grid; gap: 10px; }
label.field { display: grid; gap: 4px; font-size: 0.86rem; }
label.field span { color: var(--muted); font-weight: 700; }
label.field input, label.field select, label.field textarea {
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.6);
  font: inherit;
  color: var(--ink);
}
label.field textarea { min-height: 80px; resize: vertical; }
button.btn {
  padding: 8px 16px; border-radius: 8px; border: 1px solid var(--gold);
  background: var(--gold); color: #fff; font-weight: 800;
  font-family: inherit; cursor: pointer; font-size: 0.9rem;
}
button.btn.secondary { background: transparent; color: var(--gold); }
button.btn.danger { background: var(--error); border-color: var(--error); }
button.btn.success { background: var(--moss); border-color: var(--moss); }
.actions-bar { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
.back-link { color: var(--moss); font-weight: 800; text-decoration: none; }
@media (max-width: 760px) {
  .detail-grid { grid-template-columns: 1fr; }
  header.page-header { padding: 16px; }
  main.dashboard { padding: 16px 16px 60px; }
  table.orders { font-size: 0.84rem; }
}
</style>
</head>
<body>
<header class="page-header">
  <div>
    <h1>Encomendas</h1>
    <p style="margin:4px 0 0;color:var(--muted);font-size:0.9rem;">SQLite: <code>private/miaandpaper.sqlite</code></p>
  </div>
  <nav>
    <a href="admin-orders.php?view=list" class="<?= $view === 'list' ? 'is-active' : '' ?>">Lista</a>
    <a href="admin-orders.php?view=new" class="<?= $view === 'new' ? 'is-active' : '' ?>">+ Manual</a>
    <a href="admin-funnel.php">Funil</a>
    <form method="post" action="admin-orders.php" style="display:inline;margin-left:8px;" onsubmit="return confirm('Descarregar uma cópia completa da base SQLite? O ficheiro contém dados de clientes — guardar em local seguro.');">
      <input type="hidden" name="csrf" value="<?= admin_orders_h($csrf) ?>">
      <input type="hidden" name="action" value="download_backup">
      <button type="submit" style="background:transparent;border:1px solid var(--moss);color:var(--moss);font-weight:800;font-family:inherit;cursor:pointer;font-size:0.88rem;padding:4px 12px;border-radius:6px;">⤓ Backup SQLite</button>
    </form>
    <a href="index.html">← Voltar ao site</a>
  </nav>
</header>

<main class="dashboard">
<?php
// Flash messages
if (!empty($_GET['saved']))     echo '<div class="flash">Encomenda actualizada.</div>';
if (!empty($_GET['paid']))      echo '<div class="flash">Pagamento confirmado.</div>';
if (!empty($_GET['shipped']))   echo '<div class="flash">Encomenda marcada como enviada.</div>';
if (!empty($_GET['cancelled'])) echo '<div class="flash">Encomenda cancelada.</div>';
if (!empty($_GET['created']))   echo '<div class="flash">Encomenda manual criada.</div>';
// ADMIN_EMAIL_ACTIONS_V1: feedback do estado do email automático.
$emailFlag = isset($_GET['email']) ? (string)$_GET['email'] : '';
if ($emailFlag === '1')        echo '<div class="flash">Email automático enviado ao cliente.</div>';
elseif ($emailFlag === 'resent') echo '<div class="flash">Email reenviado ao cliente.</div>';
elseif ($emailFlag === 'already') echo '<div class="flash" style="background:rgba(184,134,22,0.12);border-color:rgba(184,134,22,0.35);color:var(--gold);">⚠️ A encomenda já estava neste estado — o email <strong>não</strong> foi reenviado. Usa o botão de reenvio explícito se quiseres voltar a enviar.</div>';
elseif ($emailFlag === 'noemail') echo '<div class="flash" style="background:rgba(184,134,22,0.12);border-color:rgba(184,134,22,0.35);color:var(--gold);">⚠️ Contacto do cliente é apenas telemóvel — não foi enviado email automático.</div>';
elseif ($emailFlag === 'failed') echo '<div class="flash" style="background:rgba(182,70,58,0.10);border-color:rgba(182,70,58,0.32);color:var(--error);">⚠️ O envio do email falhou. Vê o histórico de emails desta encomenda para mais detalhe.</div>';

// ORDERS_LIST_SEARCH_PAGE_V1: pesquisa por código/nome/contacto +
// paginação por offset. Página fixa de 50 linhas; navegação next/prev
// preserva filtros activos.
$ORDERS_PAGE_SIZE = 50;

function admin_orders_build_query(array $overrides = array())
{
    $base = array(
        'view' => 'list',
        'f' => isset($_GET['f']) ? (string)$_GET['f'] : 'all',
        'p' => isset($_GET['p']) ? (string)$_GET['p'] : '',
        'q' => isset($_GET['q']) ? (string)$_GET['q'] : '',
        'page' => isset($_GET['page']) ? (int)$_GET['page'] : 1,
    );
    foreach ($overrides as $k => $v) {
        $base[$k] = $v;
    }
    // Limpa valores vazios para um URL mais curto.
    foreach ($base as $k => $v) {
        if ($v === '' || $v === null || ($k === 'page' && (int)$v <= 1)) {
            unset($base[$k]);
        }
    }
    return 'admin-orders.php?' . http_build_query($base);
}

if ($view === 'list') :
    $filter = isset($_GET['f']) ? (string)$_GET['f'] : 'all';
    $product = isset($_GET['p']) ? (string)$_GET['p'] : '';
    $q = isset($_GET['q']) ? trim((string)$_GET['q']) : '';
    if (strlen($q) > 60) $q = substr($q, 0, 60);
    $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $offset = ($page - 1) * $ORDERS_PAGE_SIZE;

    $where = array('1=1');
    $params = array();
    switch ($filter) {
        case 'new':       $where[] = "fulfillment_status='new'"; break;
        case 'unpaid':    $where[] = "payment_status='unpaid' AND fulfillment_status NOT IN ('cancelled','shipped')"; break;
        case 'paid':      $where[] = "payment_status='paid'"; break;
        case 'preparing': $where[] = "fulfillment_status='preparing'"; break;
        case 'shipped':   $where[] = "fulfillment_status='shipped'"; break;
        case 'cancelled': $where[] = "fulfillment_status='cancelled'"; break;
    }
    if ($product !== '') {
        $where[] = 'product_slug = ?';
        $params[] = $product;
    }
    if ($q !== '' && strlen($q) >= 2) {
        $where[] = '(order_code LIKE ? OR customer_name LIKE ? OR customer_contact LIKE ? OR card_name LIKE ?)';
        $like = '%' . $q . '%';
        $params[] = $like; $params[] = $like; $params[] = $like; $params[] = $like;
    }
    $whereSql = implode(' AND ', $where);

    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM orders WHERE ' . $whereSql);
    $countStmt->execute($params);
    $totalRows = (int)$countStmt->fetchColumn();
    $totalPages = max(1, (int)ceil($totalRows / $ORDERS_PAGE_SIZE));
    if ($page > $totalPages) { $page = $totalPages; $offset = ($page - 1) * $ORDERS_PAGE_SIZE; }

    $sql = 'SELECT id, order_code, created_at, product_slug, customer_name, customer_contact, delivery_label, total_estimate_cents, payment_status, fulfillment_status, source FROM orders WHERE ' . $whereSql . ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    $stmt = $pdo->prepare($sql);
    $iParam = 1;
    foreach ($params as $p) { $stmt->bindValue($iParam++, $p); }
    $stmt->bindValue($iParam++, $ORDERS_PAGE_SIZE, PDO::PARAM_INT);
    $stmt->bindValue($iParam++, $offset, PDO::PARAM_INT);
    $stmt->execute();
    $orders = $stmt->fetchAll();

    $productsStmt = $pdo->query('SELECT DISTINCT product_slug FROM orders WHERE product_slug IS NOT NULL AND product_slug != "" ORDER BY product_slug');
    $productSlugs = $productsStmt ? $productsStmt->fetchAll(PDO::FETCH_COLUMN) : array();
?>
  <div class="filters">
    <?php foreach (array('all'=>'Todas','new'=>'Novas','unpaid'=>'Por pagar','paid'=>'Pagas','preparing'=>'Em preparação','shipped'=>'Enviadas','cancelled'=>'Canceladas') as $key => $label): ?>
      <a href="<?= admin_orders_h(admin_orders_build_query(array('f'=>$key,'page'=>1))) ?>" class="<?= $filter === $key ? 'is-active' : '' ?>"><?= admin_orders_h($label) ?></a>
    <?php endforeach; ?>
    <form method="get" action="admin-orders.php" style="display:inline-flex;gap:8px;margin-left:auto;align-items:center;">
      <input type="hidden" name="view" value="list">
      <input type="hidden" name="f" value="<?= admin_orders_h($filter) ?>">
      <input type="text" name="q" placeholder="código, nome, contacto…" value="<?= admin_orders_h($q) ?>" maxlength="60" style="padding:6px 12px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,0.7);min-width:220px;font:inherit;color:var(--ink);">
      <select name="p" onchange="this.form.submit()">
        <option value="">Todos os produtos</option>
        <?php foreach ($productSlugs as $slug): ?>
          <option value="<?= admin_orders_h($slug) ?>"<?= $slug === $product ? ' selected' : '' ?>><?= admin_orders_h($slug) ?></option>
        <?php endforeach; ?>
      </select>
      <button type="submit" class="btn secondary" style="padding:6px 14px;font-size:0.86rem;">Pesquisar</button>
      <?php if ($q !== ''): ?>
        <a href="<?= admin_orders_h(admin_orders_build_query(array('q'=>'','page'=>1))) ?>" style="font-size:0.86rem;color:var(--muted);">limpar</a>
      <?php endif; ?>
    </form>
  </div>

  <?php if (empty($orders)): ?>
    <section class="card"><p style="margin:0;color:var(--muted);">Sem encomendas neste filtro.</p></section>
  <?php else: ?>
    <table class="orders">
      <thead>
        <tr><th>Código</th><th>Data</th><th>Produto</th><th>Cliente</th><th>Entrega</th><th class="num">Total</th><th>Estado</th></tr>
      </thead>
      <tbody>
        <?php foreach ($orders as $o):
          $ff = $o['fulfillment_status'] ?: 'new';
          $pay = $o['payment_status'] ?: 'unpaid';
        ?>
          <tr>
            <td><a class="row-link" href="admin-orders.php?view=detail&amp;id=<?= (int)$o['id'] ?>"><?= admin_orders_h($o['order_code']) ?></a><?php if ($o['source'] === 'manual'): ?> <span class="badge" style="background:rgba(118,85,28,0.15);color:var(--muted);">manual</span><?php endif; ?></td>
            <td><?= admin_orders_h(substr($o['created_at'], 0, 16) . 'Z') ?></td>
            <td><?= admin_orders_h($o['product_slug']) ?></td>
            <td><?= admin_orders_h($o['customer_name']) ?><br><small style="color:var(--muted);"><?= admin_orders_h($o['customer_contact']) ?></small></td>
            <td><?= admin_orders_h($o['delivery_label']) ?></td>
            <td class="num"><?= admin_orders_cents_to_eur($o['total_estimate_cents']) ?></td>
            <td>
              <span class="badge badge-<?= admin_orders_h($ff) ?>"><?= admin_orders_h($ff) ?></span>
              <span class="badge badge-<?= admin_orders_h($pay) ?>"><?= admin_orders_h($pay) ?></span>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <div style="margin:14px 0 0;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;color:var(--muted);font-size:0.85rem;">
      <span>
        <?= (int)$totalRows ?> encomenda(s) no total
        <?php if ($q !== ''): ?> · pesquisa: <code><?= admin_orders_h($q) ?></code><?php endif; ?>
        <?php if ($totalPages > 1): ?> · página <?= (int)$page ?> de <?= (int)$totalPages ?><?php endif; ?>
      </span>
      <?php if ($totalPages > 1): ?>
        <span style="display:inline-flex;gap:6px;">
          <?php if ($page > 1): ?>
            <a href="<?= admin_orders_h(admin_orders_build_query(array('page'=>$page-1))) ?>" class="btn secondary" style="padding:4px 12px;text-decoration:none;font-size:0.84rem;">← anterior</a>
          <?php endif; ?>
          <?php if ($page < $totalPages): ?>
            <a href="<?= admin_orders_h(admin_orders_build_query(array('page'=>$page+1))) ?>" class="btn secondary" style="padding:4px 12px;text-decoration:none;font-size:0.84rem;">seguinte →</a>
          <?php endif; ?>
        </span>
      <?php endif; ?>
    </div>
  <?php endif; ?>

<?php elseif ($view === 'detail'):
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
    $stmt->execute(array($id));
    $order = $stmt->fetch();

    if (!$order) {
        echo '<section class="card"><p>Encomenda não encontrada. <a class="back-link" href="admin-orders.php?view=list">Voltar à lista</a></p></section>';
        echo '</main></body></html>';
        exit;
    }

    $eventsStmt = $pdo->prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at ASC');
    $eventsStmt->execute(array($id));
    $events = $eventsStmt->fetchAll();

    $emailsStmt = $pdo->prepare('SELECT * FROM email_log WHERE order_id = ? ORDER BY created_at DESC');
    $emailsStmt->execute(array($id));
    $emails = $emailsStmt->fetchAll();

    $raw = json_decode($order['raw_order_json'], true);
    if (!is_array($raw)) $raw = array();
?>
  <p><a class="back-link" href="admin-orders.php?view=list">← Lista de encomendas</a></p>
  <h2 style="margin:0 0 4px;font-size:1.4rem;"><?= admin_orders_h($order['order_code']) ?> <small style="color:var(--muted);font-weight:600;font-size:1rem;"><?= admin_orders_h(admin_orders_friendly_status($order['payment_status'], $order['fulfillment_status'])) ?></small></h2>
  <p style="margin:0 0 18px;color:var(--muted);font-size:0.9rem;">Criada em <?= admin_orders_h(substr($order['created_at'], 0, 19)) ?>Z · fonte: <?= admin_orders_h($order['source']) ?></p>

  <div class="detail-grid">
    <section class="card">
      <h2>Resumo</h2>
      <dl class="kv">
        <dt>Produto</dt><dd><?= admin_orders_h($order['product_slug']) ?></dd>
        <dt>Cliente</dt><dd><?= admin_orders_h($order['customer_name']) ?></dd>
        <dt>Contacto</dt><dd><?= admin_orders_h($order['customer_contact']) ?></dd>
        <?php if (!empty($order['contact_email'])): ?><dt>Email</dt><dd><?= admin_orders_h($order['contact_email']) ?></dd><?php endif; ?>
        <?php if (!empty($order['contact_phone'])): ?><dt>Telemóvel</dt><dd><?= admin_orders_h($order['contact_phone']) ?></dd><?php endif; ?>
        <dt>Cartão (nome)</dt><dd><?= admin_orders_h($order['card_name']) ?></dd>
        <?php if (!empty($order['congregation'])): ?><dt>Congregação</dt><dd><?= admin_orders_h($order['congregation']) ?></dd><?php endif; ?>
        <dt>Entrega</dt><dd><?= admin_orders_h($order['delivery_label']) ?> (<?= admin_orders_h($order['delivery_option']) ?>)</dd>
        <dt>Subtotal</dt><dd><?= admin_orders_cents_to_eur($order['subtotal_cents']) ?></dd>
        <dt>Portes (estimativa)</dt><dd><?= admin_orders_cents_to_eur($order['shipping_estimate_cents']) ?></dd>
        <dt>Total estimado</dt><dd><strong><?= admin_orders_cents_to_eur($order['total_estimate_cents']) ?></strong></dd>
        <?php if (!empty($order['ip_number'])): ?><dt>IP</dt><dd><code><?= admin_orders_h($order['ip_number']) ?></code></dd><?php endif; ?>
      </dl>

      <?php if (!empty($raw['assorted_designs'])): ?>
        <h3>Designs encomendados</h3>
        <p style="margin:0 0 12px;color:var(--muted);"><strong>Sortido</strong> · a Mia escolhe uma combinação de designs de acordo com a quantidade escolhida.</p>
      <?php elseif (isset($raw['designs']) && is_array($raw['designs']) && !empty($raw['designs'])): ?>
        <h3>Designs encomendados</h3>
        <ul style="margin:0;padding-left:20px;">
          <?php foreach ($raw['designs'] as $d):
            $q = isset($raw['design_quantities'][$d]) ? $raw['design_quantities'][$d] : '?';
            $label = isset($raw['design_labels'][$d]) ? $raw['design_labels'][$d] : '';
          ?>
            <li><strong><?= admin_orders_h($d) ?></strong><?php if ($label !== '' && $label !== $d): ?> (<?= admin_orders_h($label) ?>)<?php endif; ?> · <?= admin_orders_h($q) ?> un.</li>
          <?php endforeach; ?>
        </ul>
      <?php endif; ?>

      <h3>Histórico</h3>
      <ul style="margin:0;padding-left:20px;font-size:0.9rem;color:var(--muted);">
        <?php foreach ($events as $e): ?>
          <li><strong><?= admin_orders_h($e['event_type']) ?></strong> · <?= admin_orders_h(substr($e['created_at'], 0, 19)) ?>Z</li>
        <?php endforeach; ?>
      </ul>

      <?php if (!empty($emails)): ?>
        <h3>Emails enviados</h3>
        <ul style="margin:0;padding-left:20px;font-size:0.9rem;color:var(--muted);">
          <?php foreach ($emails as $em): ?>
            <li>
              <strong><?= admin_orders_h($em['email_type']) ?></strong> →
              <?= admin_orders_h($em['recipient']) ?> ·
              <?= $em['success'] ? '<span style="color:var(--moss);">OK</span>' : '<span style="color:var(--error);">FALHOU</span>' ?> ·
              <?= admin_orders_h(substr($em['created_at'], 0, 19)) ?>Z
              <?php if (!$em['success'] && !empty($em['error_message'])): ?><br><small><?= admin_orders_h($em['error_message']) ?></small><?php endif; ?>
            </li>
          <?php endforeach; ?>
        </ul>
      <?php endif; ?>
    </section>

    <aside>
      <section class="card">
        <h2>Editar</h2>
        <form method="post" action="admin-orders.php" class="stacked">
          <input type="hidden" name="csrf" value="<?= admin_orders_h($csrf) ?>">
          <input type="hidden" name="action" value="update">
          <input type="hidden" name="id" value="<?= (int)$order['id'] ?>">

          <label class="field">
            <span>Pagamento</span>
            <select name="payment_status">
              <option value="unpaid"<?= $order['payment_status'] === 'unpaid' ? ' selected' : '' ?>>Por pagar</option>
              <option value="paid"<?= $order['payment_status'] === 'paid' ? ' selected' : '' ?>>Pago</option>
            </select>
          </label>

          <label class="field">
            <span>Estado</span>
            <select name="fulfillment_status">
              <option value="new"<?= $order['fulfillment_status'] === 'new' ? ' selected' : '' ?>>Nova</option>
              <option value="preparing"<?= $order['fulfillment_status'] === 'preparing' ? ' selected' : '' ?>>Em preparação</option>
              <option value="shipped"<?= $order['fulfillment_status'] === 'shipped' ? ' selected' : '' ?>>Enviada</option>
              <option value="cancelled"<?= $order['fulfillment_status'] === 'cancelled' ? ' selected' : '' ?>>Cancelada</option>
            </select>
          </label>

          <label class="field">
            <span>Nº de acompanhamento (CTT)</span>
            <input type="text" name="tracking_number" value="<?= admin_orders_h($order['tracking_number']) ?>">
          </label>

          <label class="field">
            <span>Notas internas (não visível ao cliente)</span>
            <textarea name="admin_notes"><?= admin_orders_h($order['admin_notes']) ?></textarea>
          </label>

          <button class="btn" type="submit">Guardar alterações</button>
        </form>
      </section>

      <section class="card" style="margin-top:14px;">
        <h2>Acções rápidas</h2>
        <p style="margin:0 0 12px;color:var(--muted);font-size:0.86rem;">Acções de pagamento e envio que também disparam email automático ao cliente (Fase 5).</p>

        <?php if ($order['payment_status'] !== 'paid'): ?>
        <form method="post" action="admin-orders.php" class="inline" onsubmit="return confirm('Marcar como paga e enviar email de confirmação?');">
          <input type="hidden" name="csrf" value="<?= admin_orders_h($csrf) ?>">
          <input type="hidden" name="action" value="mark_paid">
          <input type="hidden" name="id" value="<?= (int)$order['id'] ?>">
          <button class="btn success" type="submit">Pagamento confirmado</button>
        </form>
        <?php else: ?>
        <form method="post" action="admin-orders.php" class="inline" onsubmit="return confirm('Reenviar o email de pagamento confirmado a este cliente?');">
          <input type="hidden" name="csrf" value="<?= admin_orders_h($csrf) ?>">
          <input type="hidden" name="action" value="resend_paid_email">
          <input type="hidden" name="id" value="<?= (int)$order['id'] ?>">
          <button class="btn secondary" type="submit">Reenviar email de pagamento</button>
        </form>
        <?php endif; ?>

        <?php if ($order['fulfillment_status'] !== 'shipped'): ?>
        <form method="post" action="admin-orders.php" class="stacked" style="margin-top:12px;" onsubmit="return confirm('Marcar como enviada e enviar email ao cliente?');">
          <input type="hidden" name="csrf" value="<?= admin_orders_h($csrf) ?>">
          <input type="hidden" name="action" value="mark_shipped">
          <input type="hidden" name="id" value="<?= (int)$order['id'] ?>">
          <label class="field">
            <span>Nº de acompanhamento (deixar vazio se não houver)</span>
            <input type="text" name="tracking_number" value="<?= admin_orders_h($order['tracking_number']) ?>">
          </label>
          <button class="btn" type="submit">Encomenda enviada</button>
        </form>
        <?php else: ?>
        <form method="post" action="admin-orders.php" class="inline" style="margin-top:12px;" onsubmit="return confirm('Reenviar o email de envio (com o nº de acompanhamento actual) a este cliente?');">
          <input type="hidden" name="csrf" value="<?= admin_orders_h($csrf) ?>">
          <input type="hidden" name="action" value="resend_shipped_email">
          <input type="hidden" name="id" value="<?= (int)$order['id'] ?>">
          <button class="btn secondary" type="submit">Reenviar email de envio</button>
        </form>
        <?php endif; ?>

        <form method="post" action="admin-orders.php" class="inline" style="margin-top:12px;" onsubmit="return confirm('Cancelar esta encomenda?');">
          <input type="hidden" name="csrf" value="<?= admin_orders_h($csrf) ?>">
          <input type="hidden" name="action" value="cancel">
          <input type="hidden" name="id" value="<?= (int)$order['id'] ?>">
          <button class="btn danger" type="submit" <?= $order['fulfillment_status'] === 'cancelled' ? 'disabled' : '' ?>>Cancelar encomenda</button>
        </form>
      </section>
    </aside>
  </div>

<?php elseif ($view === 'new'): ?>
  <p><a class="back-link" href="admin-orders.php?view=list">← Lista</a></p>
  <h2 style="margin:0 0 14px;">Nova encomenda manual</h2>
  <section class="card" style="max-width:680px;">
    <form method="post" action="admin-orders.php" class="stacked">
      <input type="hidden" name="csrf" value="<?= admin_orders_h($csrf) ?>">
      <input type="hidden" name="action" value="create_manual">

      <label class="field"><span>Produto (slug)</span><input type="text" name="product_slug" placeholder="crachas / imanes / cadernos..." required></label>
      <label class="field"><span>Nome do cliente</span><input type="text" name="customer_name" required></label>
      <label class="field"><span>Contacto (email ou telemóvel)</span><input type="text" name="customer_contact" required></label>
      <label class="field"><span>Nome para o cartão</span><input type="text" name="card_name"></label>
      <label class="field"><span>Congregação</span><input type="text" name="congregation"></label>
      <label class="field"><span>Tipo de entrega (id)</span>
        <select name="delivery_option">
          <option value="pickup">Vou recolher na casa da Mia</option>
          <option value="shipping">Envio CTT - até 2 Kg</option>
          <option value="join_orders">Junta as minhas encomendas</option>
        </select>
      </label>
      <label class="field"><span>Etiqueta de entrega (texto que vai para a UI)</span><input type="text" name="delivery_label"></label>
      <label class="field"><span>Subtotal (€)</span><input type="number" step="0.01" min="0" name="subtotal_eur" value="0"></label>
      <label class="field"><span>Portes estimados (€)</span><input type="number" step="0.01" min="0" name="shipping_eur" value="0"></label>
      <label class="field"><span>Total estimado (€)</span><input type="number" step="0.01" min="0" name="total_eur" value="0"></label>
      <label class="field"><span>Notas internas</span><textarea name="admin_notes"></textarea></label>

      <button class="btn" type="submit">Criar encomenda manual</button>
    </form>
  </section>

<?php else: ?>
  <section class="card"><p>View desconhecida. <a class="back-link" href="admin-orders.php?view=list">Lista</a></p></section>
<?php endif; ?>

</main>
</body>
</html>
