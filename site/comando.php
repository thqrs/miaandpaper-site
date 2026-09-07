<?php
/**
 * comando.php — COMANDOS_V1
 *
 * Transforma um link em alterações ao site.
 *
 * ── Como se usa ─────────────────────────────────────────────────────────────
 *
 *   comando.php?op=material&nome=Íman 32 mm&quantidade=500&euros=42.50
 *
 * Abre uma página com «isto passa a ser isto» e um botão. O botão faz POST com
 * CSRF, e é esse POST que grava. Um link, por si só, nunca escreve nada.
 *
 * Vários comandos no mesmo link, pela ordem dos índices:
 *
 *   comando.php?c[0][op]=material&c[0][nome]=…&c[1][op]=material&c[1][nome]=…
 *
 * ── `&override=true` ────────────────────────────────────────────────────────
 *
 * Aplica logo, sem confirmação. É útil e é perigoso pela mesma razão: escrever
 * deixa de precisar de um clique. Só aceita navegação directa: pedidos vindos
 * de outro site, com Referer externo ou embebidos (por exemplo num `<img>`) são
 * recusados. Usar apenas em links que se escreveram, não em links recebidos.
 *
 * ── Onde está a validação ───────────────────────────────────────────────────
 *
 * Aqui não está nenhuma. Cada comando traduz-se nas operações nativas dos
 * editores e é a API do editor — a mesma que o `precos.php` chama — que decide
 * se aceita. Ver `lib/comandos.php` e `lib/pedido.php`.
 *
 * O vocabulário para colar no ChatGPT está em `tools/README-comandos.md`, e o
 * mesmo em JSON em `tools/parametros.php?formato=json`.
 */

require_once __DIR__ . '/admin-open.php';   // ADMIN_OPEN_DEV_V1: sem password até ao deploy

// As APIs são incluídas para lhes chamar as funções, não para servirem.
define('MP_API_EMBUTIDA', true);
require_once __DIR__ . '/lib/comandos.php';
require_once __DIR__ . '/lib/parametros.php';

$formato = isset($_GET['formato']) && $_GET['formato'] === 'json' ? 'json' : 'html';
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Robots-Tag: noindex, nofollow');

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    if ($formato === 'json') {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('ok' => false, 'erro' => 'Acesso restrito.'), JSON_UNESCAPED_UNICODE);
        exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
        . '<title>Acesso negado · Comandos</title>'
        . '<style>body{font-family:Georgia,serif;max-width:560px;margin:60px auto;padding:0 20px;color:#3b2f1f;}h1{font-size:1.4rem;}a{color:#4f7a3a;font-weight:700;}</style>'
        . '<h1>Acesso restrito.</h1>'
        . '<p>Inicia sessão como administradora a partir de <a href="index.html">index.html</a> e regressa a este link.</p>';
    exit;
}

$csrf = mp_admin_csrf_token();

// ── De onde vêm os comandos ─────────────────────────────────────────────────
//
// No POST de confirmação, a query original viaja num campo escondido: o que se
// grava é exactamente o que foi mostrado, e não o que estiver no URL agora.

$ePost = isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST';
$query = $_GET;
$queryOriginal = isset($_SERVER['QUERY_STRING']) ? (string)$_SERVER['QUERY_STRING'] : '';

if ($ePost) {
    $queryOriginal = isset($_POST['comandos']) ? (string)$_POST['comandos'] : '';
    $query = array();
    parse_str($queryOriginal, $query);
}

$comandos = cmd_ler_pedido($query);
$analise = cmd_analisar($comandos);

// ── Aplicar ─────────────────────────────────────────────────────────────────

$override = isset($query['override']) && in_array((string)$query['override'], array('1', 'true', 'sim'), true);

// `override` mantém o caso de uso de abrir um URL que acabaste de gerar, mas
// não aceita navegação iniciada por outro site nem carregamentos invisíveis.
// Um POST normal continua protegido pelo token CSRF da sessão.
if ($override && !$ePost) {
    $fetchSite = isset($_SERVER['HTTP_SEC_FETCH_SITE']) ? strtolower((string)$_SERVER['HTTP_SEC_FETCH_SITE']) : '';
    $fetchDest = isset($_SERVER['HTTP_SEC_FETCH_DEST']) ? strtolower((string)$_SERVER['HTTP_SEC_FETCH_DEST']) : '';
    $referer = isset($_SERVER['HTTP_REFERER']) ? (string)$_SERVER['HTTP_REFERER'] : '';
    $hostActual = isset($_SERVER['HTTP_HOST']) ? strtolower((string)$_SERVER['HTTP_HOST']) : '';
    $hostActual = preg_replace('/:\\d+$/', '', $hostActual);
    $hostReferer = $referer !== '' ? strtolower((string)parse_url($referer, PHP_URL_HOST)) : '';
    if ($fetchSite === 'cross-site' || ($fetchDest !== '' && $fetchDest !== 'document')
        || ($hostReferer !== '' && $hostActual !== '' && $hostReferer !== $hostActual)) {
        $analise['ok'] = false;
        $analise['erros'][] = 'Override bloqueado: abre este URL directamente na barra de endereço, nunca a partir de outro site ou de uma imagem embebida.';
    }
}
$csrfValido = $ePost && isset($_POST['csrf']) && hash_equals($csrf, (string)$_POST['csrf']);
$vaiAplicar = $analise['ok'] && $csrfValido;
$relatorio = array();
$gravou = false;
$rollback = false;

if ($vaiAplicar) {
    $relatorio = cmd_aplicar($analise['nativas']);
    $gravou = true;
    foreach ($relatorio as $r) {
        if (isset($r['dominio']) && $r['dominio'] === 'transacao' && !empty($r['rollback'])) {
            $rollback = true;
        }
        if (!$r['ok']) {
            $gravou = false;
            // A causa da falha de escrita tem de ser legível por quem só
            // consome JSON, e não apenas pelo relatório textual.
            $dominio = isset($r['dominio']) ? (string)$r['dominio'] : 'desconhecido';
            $mensagem = isset($r['mensagem']) && trim((string)$r['mensagem']) !== ''
                ? trim((string)$r['mensagem']) : 'A API recusou a alteração.';
            $analise['erros'][] = 'Aplicação em ' . $dominio . ': ' . $mensagem;
        }
    }
}

if ($ePost && !$csrfValido) {
    $analise['ok'] = false;
    $analise['erros'][] = 'Pedido bloqueado por CSRF. Recarrega o link e confirma outra vez.';
}

// ── Resposta ────────────────────────────────────────────────────────────────

if ($formato === 'json') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(array(
        'ok' => $analise['ok'] && (!$vaiAplicar || $gravou),
        // `aplicado` descreve o estado final, nunca apenas a tentativa. Em
        // particular, um batch revertido terminou exactamente como começou.
        'aplicado' => $gravou,
        'tentouAplicar' => $vaiAplicar,
        'rollback' => $rollback,
        'comandos' => $analise['comandos'],
        'erros' => $analise['erros'],
        'relatorio' => $relatorio,
    ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');

function cm_h($v)
{
    return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
}

$editores = array(
    'precos' => array('precos.php', 'Preços'),
    'materiais' => array('materiais.php', 'Materiais'),
    'home' => array('homepage-menu-design.php', 'Homepage e menu'),
    'carrossel' => array('carrousel.php', 'Carrosséis'),
    'galeria' => array('galeria.html', 'Galeria'),
    'reviews' => array('reviews.html', 'Reviews'),
);
$dominios = array();
foreach ($analise['comandos'] as $c) {
    if (!empty($c['dominio'])) {
        $dominios[$c['dominio']] = true;
    }
}
?>
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Comando | Mia &amp; Paper</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="stylesheet" href="admin-nav.css?v=20260907212423">
  <script src="admin-nav.js?v=20260907212423" defer></script>
  <style>
    :root {
      --ink: #3b2f1f; --muted: #7a6a52; --line: rgba(0,0,0,0.14);
      --moss: #4f7a3a; --erro: #b6463a; --paper: #f6f2e8; --card: #fffdf8;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink);
      font: 400 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
    main { max-width: 900px; margin: 0 auto; padding: 30px 20px 80px; }
    h1 { font-size: 1.5rem; margin: 0 0 6px; }
    a { color: var(--moss); }
    code { font: 600 0.86em/1.4 ui-monospace, Consolas, monospace; word-break: break-word; }
    .sub { color: var(--muted); font-size: 0.9rem; margin: 0 0 20px; }
    .cmd { background: var(--card); border: 1px solid var(--line); border-radius: 12px;
      padding: 14px 16px; margin: 0 0 12px; }
    .cmd.mau { border-color: rgba(182,70,58,0.45); background: rgba(182,70,58,0.05); }
    .cmd-topo { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: baseline; }
    .cmd-topo strong { font-size: 1rem; }
    .n { color: var(--muted); font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.9rem; }
    td, th { text-align: left; padding: 6px 10px 6px 0; border-bottom: 1px solid rgba(0,0,0,0.07); vertical-align: top; }
    th { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
    .antes { color: var(--muted); text-decoration: line-through; }
    .depois { font-weight: 800; color: var(--moss); }
    .igual .depois { color: var(--muted); font-weight: 600; text-decoration: none; }
    .erro { color: var(--erro); font-weight: 700; }
    .barra { position: sticky; bottom: 0; background: var(--card); border: 1px solid var(--line);
      border-radius: 12px; padding: 14px 16px; margin-top: 22px;
      display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
    button {
      font: 800 0.95rem system-ui, sans-serif; padding: 10px 22px; border-radius: 999px;
      border: 1px solid var(--moss); background: var(--moss); color: #fff; cursor: pointer;
    }
    button[disabled] { opacity: 0.4; cursor: not-allowed; }
    .feito { background: rgba(79,122,58,0.12); border: 1px solid rgba(79,122,58,0.4);
      border-radius: 12px; padding: 14px 16px; margin: 0 0 18px; font-weight: 700; color: var(--moss); }
    .falhou { background: rgba(182,70,58,0.10); border-color: rgba(182,70,58,0.4); color: var(--erro); }
    .link-longo { color: var(--muted); font-size: 0.78rem; word-break: break-all; margin-top: 18px; }
  </style>
</head>
<body>
<main>
  <h1>Comando</h1>
  <p class="sub"><?= count($comandos) ?> <?= count($comandos) === 1 ? 'operação' : 'operações' ?> neste link</p>

<?php if ($vaiAplicar): ?>
  <div class="feito<?= $gravou ? '' : ' falhou' ?>">
    <?php if ($gravou): ?>
      Gravado.
      <?php foreach (array_keys($dominios) as $d): if (isset($editores[$d])): ?>
        · <a href="<?= cm_h($editores[$d][0]) ?>">Abrir <?= cm_h($editores[$d][1]) ?></a>
      <?php endif; endforeach; ?>
    <?php else: ?>
      Alguma coisa falhou ao gravar:
      <?php foreach ($relatorio as $r): if (!$r['ok']): ?>
        <?= cm_h($r['dominio']) ?> — <?= cm_h($r['mensagem'] !== '' ? $r['mensagem'] : 'erro ' . $r['estado']) ?>.
      <?php endif; endforeach; ?>
    <?php endif; ?>
  </div>
<?php endif; ?>

<?php if (!empty($analise['erros'])): ?>
  <div class="feito falhou">
    <?php foreach ($analise['erros'] as $e): ?>
      <div><?= cm_h($e) ?></div>
    <?php endforeach; ?>
  </div>
<?php endif; ?>

<?php foreach ($analise['comandos'] as $c): ?>
  <section class="cmd<?= $c['erro'] !== '' ? ' mau' : '' ?>">
    <div class="cmd-topo">
      <span class="n"><?= (int)$c['n'] ?>.</span>
      <strong><?= cm_h(isset($c['titulo']) ? $c['titulo'] : $c['op']) ?></strong>
      <code><?= cm_h($c['op']) ?></code>
    </div>
    <?php if ($c['erro'] !== ''): ?>
      <p class="erro"><?= cm_h($c['erro']) ?></p>
    <?php else: ?>
      <table>
        <thead><tr><th>ficheiro</th><th>onde</th><th>antes</th><th>depois</th></tr></thead>
        <tbody>
        <?php foreach ($c['mudancas'] as $m): ?>
          <tr class="<?= !empty($m['igual']) ? 'igual' : '' ?>">
            <td><code><?= cm_h($m['ficheiro']) ?></code></td>
            <td><?= cm_h($m['onde']) ?></td>
            <td class="antes"><?= cm_h($m['antes']) ?></td>
            <td class="depois"><?= cm_h($m['depois']) ?></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    <?php endif; ?>
  </section>
<?php endforeach; ?>

<?php if (!$vaiAplicar): ?>
  <form method="post" action="comando.php" class="barra">
    <input type="hidden" name="csrf" value="<?= cm_h($csrf) ?>">
    <input type="hidden" name="comandos" value="<?= cm_h($queryOriginal) ?>">
    <button type="submit"<?= $analise['ok'] ? '' : ' disabled' ?>>Aplicar</button>
    <span class="sub" style="margin:0;">
      <?= $analise['ok'] ? 'Nada foi escrito até aqui.' : 'Corrige o link e volta a abri-lo.' ?>
    </span>
  </form>
<?php endif; ?>

  <p class="link-longo">
    <a href="tools/README-comandos.md">Vocabulário completo</a> ·
    <a href="tools/parametros.php?formato=json">manifesto JSON</a>
  </p>
</main>
</body>
</html>