<?php
/**
 * ERRORS_ADMIN_V1 — editor das mensagens públicas de validação/ajuda.
 * O texto técnico/admin continua no código; este catálogo é apenas para a
 * linguagem que aparece ao cliente ou que é dita pelo Míu.
 */
require_once __DIR__ . '/admin-open.php';

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    exit('Acesso restrito.');
}

const ERROS_JSON_PATH = __DIR__ . '/content/erros.json';

function erros_h($value)
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function erros_read()
{
    $raw = @file_get_contents(ERROS_JSON_PATH);
    $data = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($data) || !isset($data['messages']) || !is_array($data['messages'])) {
        throw new RuntimeException('content/erros.json não é válido.');
    }
    return $data;
}

function erros_write($data)
{
    if (!is_array($data) || !isset($data['messages']) || !is_array($data['messages'])) {
        throw new RuntimeException('Não há um catálogo válido para guardar.');
    }
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
    $tmp = ERROS_JSON_PATH . '.tmp';
    if (@file_put_contents($tmp, $json, LOCK_EX) === false) {
        throw new RuntimeException('Não foi possível escrever o ficheiro temporário.');
    }
    $check = json_decode((string)@file_get_contents($tmp), true);
    if (!is_array($check) || !isset($check['messages']) || !is_array($check['messages'])) {
        @unlink($tmp);
        throw new RuntimeException('A validação do ficheiro temporário falhou.');
    }
    $backup = ERROS_JSON_PATH . '.swap';
    @unlink($backup);
    if (is_file(ERROS_JSON_PATH) && !@rename(ERROS_JSON_PATH, $backup)) {
        @unlink($tmp);
        throw new RuntimeException('Não foi possível preparar o ficheiro atual para substituição.');
    }
    if (!@rename($tmp, ERROS_JSON_PATH)) {
        if (is_file($backup)) {
            @rename($backup, ERROS_JSON_PATH);
        }
        @unlink($tmp);
        throw new RuntimeException('Não foi possível substituir o catálogo.');
    }
    @unlink($backup);
}

$csrf = mp_admin_csrf_token();
$tab = isset($_GET['tab']) && $_GET['tab'] === 'miu' ? 'miu' : 'default';
$notice = '';
$error = '';

try {
    $catalog = erros_read();
} catch (Exception $e) {
    $catalog = array('schemaVersion' => 1, 'messages' => array());
    $error = $e->getMessage();
}

if (isset($_SERVER['REQUEST_METHOD']) && strtoupper((string)$_SERVER['REQUEST_METHOD']) === 'POST') {
    if (!mp_admin_csrf_is_valid(isset($_POST['csrf']) ? (string)$_POST['csrf'] : '')) {
        http_response_code(403);
        exit('Pedido recusado: token CSRF inválido.');
    }
    $variant = isset($_POST['variant']) && $_POST['variant'] === 'miu' ? 'miu' : 'default';
    $posted = isset($_POST['messages']) && is_array($_POST['messages']) ? $_POST['messages'] : array();
    try {
        $catalog = erros_read();
        foreach ($catalog['messages'] as &$message) {
            $id = isset($message['id']) ? (string)$message['id'] : '';
            if ($id !== '' && array_key_exists($id, $posted)) {
                $value = trim((string)$posted[$id]);
                if ($value === '') {
                    throw new RuntimeException('A mensagem “' . (isset($message['label']) ? $message['label'] : $id) . '” não pode ficar vazia.');
                }
                $message[$variant] = function_exists('mb_substr') ? mb_substr($value, 0, 1000, 'UTF-8') : substr($value, 0, 1000);
            }
        }
        unset($message);
        erros_write($catalog);
        header('Location: erros.php?tab=' . rawurlencode($variant) . '&saved=1');
        exit;
    } catch (Exception $e) {
        $error = $e->getMessage();
        $tab = $variant;
    }
}

if (isset($_GET['saved'])) {
    $notice = 'Mensagens guardadas.';
}
?>
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Erros e mensagens · Mia &amp; Paper</title>
  <link rel="stylesheet" href="css/01-tokens-agua.css?v=20260907005732">
  <link rel="stylesheet" href="admin-nav.css?v=20260907005732">
  <link rel="stylesheet" href="bot-admin.css?v=2026081701">
  <script src="admin-nav.js?v=20260907005732" defer></script>
  <style>
    .errors-shell{width:min(1120px,calc(100% - 32px));margin:24px auto 64px}.errors-head{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:18px}.errors-head h1{margin:0}.errors-tabs{display:flex;gap:8px;margin:0 0 18px}.errors-tabs a{padding:8px 14px;border:1px solid var(--line);border-radius:999px;text-decoration:none;color:var(--ink);font-weight:800}.errors-tabs a.is-active{background:var(--ink);color:var(--card)}.errors-note,.errors-flash{padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--card);margin:0 0 16px}.errors-flash.is-error{border-color:var(--rose);color:var(--rose)}.errors-list{display:grid;gap:10px}.error-row{display:grid;grid-template-columns:minmax(210px,.7fr) minmax(0,1.6fr);gap:14px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--card)}.error-row strong{display:block}.error-row small{display:block;color:var(--muted);margin-top:5px;overflow-wrap:anywhere}.error-row textarea{width:100%;min-height:76px;resize:vertical;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);font:inherit}.errors-actions{position:sticky;bottom:12px;display:flex;justify-content:flex-end;margin-top:16px}.errors-actions button{padding:11px 18px;border:0;border-radius:999px;background:var(--gold);color:var(--hero-foreground);font-weight:900;cursor:pointer}@media(max-width:700px){.error-row{grid-template-columns:1fr}.errors-shell{width:min(100% - 20px,1120px)}}
  </style>
</head>
<body>
<main class="errors-shell">
  <header class="errors-head"><div><h1>Erros e mensagens</h1><p>Texto público usado nas validações do site.</p></div><code>content/erros.json</code></header>
  <nav class="errors-tabs" aria-label="Versão das mensagens">
    <a href="erros.php?tab=default" class="<?= $tab === 'default' ? 'is-active' : '' ?>">Default</a>
    <a href="erros.php?tab=miu" class="<?= $tab === 'miu' ? 'is-active' : '' ?>">Míu</a>
  </nav>
  <p class="errors-note"><?= $tab === 'miu' ? 'Estas são as versões curtas que o Míu diz no balão quando “O Míu diz os erros e avisos do site” está ligado em bot.php → Aparência.' : 'Estas são as mensagens normais mostradas no formulário quando o modo Míu está desligado.' ?></p>
  <?php if ($notice !== ''): ?><p class="errors-flash"><?= erros_h($notice) ?></p><?php endif; ?>
  <?php if ($error !== ''): ?><p class="errors-flash is-error"><?= erros_h($error) ?></p><?php endif; ?>
  <form method="post" action="erros.php?tab=<?= erros_h($tab) ?>">
    <input type="hidden" name="csrf" value="<?= erros_h($csrf) ?>">
    <input type="hidden" name="variant" value="<?= erros_h($tab) ?>">
    <div class="errors-list">
      <?php foreach ($catalog['messages'] as $message): $id = isset($message['id']) ? (string)$message['id'] : ''; if ($id === '') continue; ?>
      <label class="error-row">
        <span><strong><?= erros_h(isset($message['label']) ? $message['label'] : $id) ?></strong><small><?= erros_h($id) ?></small><small>Origem: <?= erros_h(isset($message['source']) ? $message['source'] : (isset($message['matchPrefix']) ? $message['matchPrefix'] . '…' : (isset($message['matchContains']) ? '…' . $message['matchContains'] . '…' : ''))) ?></small></span>
        <textarea name="messages[<?= erros_h($id) ?>]" maxlength="1000" required><?= erros_h(isset($message[$tab]) ? $message[$tab] : '') ?></textarea>
      </label>
      <?php endforeach; ?>
    </div>
    <div class="errors-actions"><button type="submit">Guardar <?= $tab === 'miu' ? 'Míu' : 'Default' ?></button></div>
  </form>
</main>
</body>
</html>