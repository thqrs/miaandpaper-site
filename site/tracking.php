<?php

require_once __DIR__ . '/admin-open.php';

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8"><title>Acesso restrito</title><p>Acesso restrito. <a href="index.html">Inicia sessão no site</a>.</p>';
    exit;
}

require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/tracking-config.php';

$message = '';
$isError = false;
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!mp_admin_csrf_is_valid(isset($_POST['csrf']) ? (string)$_POST['csrf'] : '')) {
        http_response_code(403);
        $message = 'A sessão expirou. Recarrega a página e tenta novamente.';
        $isError = true;
    } else {
        try {
            mp_tracking_config_write(array('level' => isset($_POST['level']) ? $_POST['level'] : ''));
            $message = 'Nível de tracking guardado.';
        } catch (Exception $error) {
            $message = $error->getMessage();
            $isError = true;
        }
    }
}

$config = mp_tracking_config_read();
$csrf = mp_admin_csrf_token();
$levels = array(
    'maximum' => array('Máximo', 'Todos os eventos actuais, incluindo cliques, toques sem efeito, ampliações, heartbeat e alterações intermédias.'),
    'medium' => array('Médio', 'Funil completo, escolhas importantes, snapshots, carrinho, uploads e encomendas; sem ruído de diagnóstico.'),
    'minimum' => array('Mínimo', 'Entrada, passos, validações, contacto, uploads, carrinho e resultado da encomenda.'),
    'off' => array('Desligado', 'Não envia eventos de utilização. O funcionamento da loja mantém-se igual.'),
);
?>
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tracking · Mia &amp; Paper</title>
  <link rel="icon" href="content/brand/logo.webp" type="image/webp">
  <link rel="stylesheet" href="admin-nav.css?v=20260907015754">
  <script src="admin-nav.js?v=20260907015754" defer></script>
  <style>
    :root { --paper:#f7f1e3; --card:#fffdf8; --ink:#30291e; --muted:#746a59; --line:#d9ccb2; --moss:#4f7a3a; --red:#9d2f28; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--paper); color:var(--ink); font:16px/1.5 Georgia,"Times New Roman",serif; }
    main { width:min(760px,calc(100% - 28px)); margin:34px auto 70px; }
    h1 { margin:0 0 8px; }
    .intro { margin:0 0 22px; color:var(--muted); }
    form { padding:20px; border:1px solid var(--line); border-radius:18px; background:var(--card); }
    label { display:grid; grid-template-columns:auto 1fr; gap:3px 12px; padding:14px 4px; border-bottom:1px solid var(--line); cursor:pointer; }
    label:last-of-type { border-bottom:0; }
    input { margin-top:5px; }
    strong { display:block; }
    small { grid-column:2; color:var(--muted); }
    button { margin-top:18px; min-height:44px; padding:10px 18px; border:0; border-radius:10px; background:var(--moss); color:var(--card); font:700 1rem Georgia,serif; cursor:pointer; }
    .message { margin:0 0 16px; padding:10px 13px; border-radius:10px; background:var(--card); color:var(--moss); font-weight:700; }
    .message.error { color:var(--red); }
    .note { margin:18px 0 0; color:var(--muted); font-size:.92rem; }
  </style>
</head>
<body>
<main>
  <h1>Nível de tracking</h1>
  <p class="intro">A alteração aplica-se ao site principal, ao catálogo, às ofertas e ao Congresso. Os eventos são enviados em pequenos lotes em todos os níveis.</p>
  <?php if ($message !== ''): ?><p class="message<?= $isError ? ' error' : '' ?>" role="status"><?= htmlspecialchars($message, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?>
  <form method="post">
    <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">
    <?php foreach ($levels as $value => $copy): ?>
      <label>
        <input type="radio" name="level" value="<?= htmlspecialchars($value, ENT_QUOTES, 'UTF-8') ?>"<?= $config['level'] === $value ? ' checked' : '' ?>>
        <strong><?= htmlspecialchars($copy[0], ENT_QUOTES, 'UTF-8') ?></strong>
        <small><?= htmlspecialchars($copy[1], ENT_QUOTES, 'UTF-8') ?></small>
      </label>
    <?php endforeach; ?>
    <button type="submit">Guardar nível</button>
  </form>
  <p class="note">Predefinição: Médio. A configuração pública é um ficheiro JSON estático e não abre PHP nem SQLite.</p>
</main>
</body>
</html>