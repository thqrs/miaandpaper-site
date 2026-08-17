<?php

require_once __DIR__ . '/admin-open.php';   // ADMIN_OPEN_DEV_V1: sem password até ao deploy
if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8"><title>Acesso restrito</title><body style="font-family:Georgia,serif;max-width:560px;margin:60px auto;padding:0 20px"><h1>Acesso restrito.</h1><p>Inicia sessão como administradora no <a href="index.html">site</a>.</p></body></html>';
    exit;
}

require_once __DIR__ . '/lib/db.php';
$csrf = mp_admin_csrf_token();

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $sent = isset($_POST['csrf']) ? (string)$_POST['csrf'] : '';
    if ($sent === '' || !hash_equals($csrf, $sent)) {
        http_response_code(403);
        exit('Pedido inválido.');
    }
    $id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
    $status = isset($_POST['status']) && $_POST['status'] === 'reviewed' ? 'reviewed' : 'new';
    if ($id > 0) {
        $stmt = mp_db()->prepare('UPDATE assisted_uploads SET status=? WHERE id=?');
        $stmt->execute(array($status, $id));
    }
    header('Location: admin-uploads.php');
    exit;
}

$rows = mp_db()->query('SELECT * FROM assisted_uploads ORDER BY created_at DESC LIMIT 200')->fetchAll();
function au_h($value) { return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8'); }
?>
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Uploads assistidos · Mia &amp; Paper</title>
  <link rel="icon" href="content/brand/logo.webp" type="image/jpeg">
  <link rel="stylesheet" href="admin-nav.css?v=2026081001">
  <script src="admin-nav.js?v=2026081702" defer></script>
  <style>
    :root{--paper:#f7f1e3;--card:#fffdf8;--ink:#30291e;--muted:#746a59;--line:#d9ccb2;--moss:#4f7a3a;--gold:#b88616}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 Georgia,serif}main{width:min(960px,calc(100% - 28px));margin:28px auto 60px}header{display:flex;justify-content:space-between;gap:18px;align-items:start;margin-bottom:18px}h1{margin:0 0 6px}header p{margin:0;color:var(--muted)}a{color:var(--moss);font-weight:700}.list{display:grid;gap:14px}.upload{padding:18px;border:1px solid var(--line);border-radius:16px;background:var(--card);box-shadow:0 10px 30px rgba(75,54,18,.08)}.upload.is-reviewed{opacity:.68}.head{display:flex;align-items:center;justify-content:space-between;gap:12px}.code{color:var(--gold);font:900 1.12rem ui-monospace,monospace}.meta{margin:5px 0 12px;color:var(--muted);font-size:.9rem}.note{padding:10px 12px;border-radius:9px;background:#f7f1e6}.files{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.files a{padding:8px 11px;border:1px solid var(--line);border-radius:9px;background:#fff;text-decoration:none}form{margin-top:13px}button{min-height:38px;padding:7px 11px;border:1px solid var(--moss);border-radius:9px;background:#fff;color:var(--moss);font:700 .9rem Georgia,serif;cursor:pointer}.empty{padding:30px;text-align:center;border:1px dashed var(--line);border-radius:14px;color:var(--muted)}@media(max-width:560px){header,.head{display:block}.head .code{display:block;margin-top:7px}}
  </style>
</head>
<body><main>
  <header><div><h1>Uploads assistidos</h1><p>Fotos enviadas pela página de ajuda. Link para partilhar: <a href="ajuda-upload.html" target="_blank" rel="noopener">ajuda-upload.html</a></p></div><a href="index.html">Voltar ao site</a></header>
  <div class="list">
  <?php if (empty($rows)): ?><p class="empty">Ainda não há uploads assistidos.</p><?php endif; ?>
  <?php foreach ($rows as $row): $files = json_decode((string)$row['files_json'], true); if (!is_array($files)) $files = array(); ?>
    <article class="upload <?= $row['status'] === 'reviewed' ? 'is-reviewed' : '' ?>">
      <div class="head"><strong><?= au_h($row['sender_name']) ?></strong><span class="code"><?= au_h($row['reference_code']) ?></span></div>
      <p class="meta"><?= au_h($row['sender_contact'] ?: 'Sem contacto') ?> · <?= au_h($row['created_at']) ?> · <?= count($files) ?> ficheiro(s)</p>
      <?php if (trim((string)$row['note']) !== ''): ?><p class="note"><?= nl2br(au_h($row['note'])) ?></p><?php endif; ?>
      <div class="files">
        <?php foreach ($files as $file): ?><a href="admin-assisted-file.php?upload_id=<?= (int)$row['id'] ?>&amp;file=<?= rawurlencode((string)$file['id']) ?>"><?= au_h(isset($file['name']) ? $file['name'] : 'foto') ?></a><?php endforeach; ?>
      </div>
      <form method="post"><input type="hidden" name="csrf" value="<?= au_h($csrf) ?>"><input type="hidden" name="id" value="<?= (int)$row['id'] ?>"><input type="hidden" name="status" value="<?= $row['status'] === 'reviewed' ? 'new' : 'reviewed' ?>"><button type="submit"><?= $row['status'] === 'reviewed' ? 'Marcar como novo' : 'Marcar como visto' ?></button></form>
    </article>
  <?php endforeach; ?>
  </div>
</main></body></html>
