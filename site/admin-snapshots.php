<?php
/**
 * admin-snapshots.php — SNAPSHOT_V1
 *
 * Painel para criar e apagar os snapshots das páginas caras.
 *
 * Ver `lib/snapshot.php` para o porquê. Em resumo: o funil e o live dashboard
 * recalculam 20 mil eventos a cada pedido (3–5 s); com snapshot, respondem em
 * milissegundos. O preço é a frescura — um snapshot de análise mostra os
 * números do momento em que foi feito.
 *
 * **Refazer os snapshots sempre que se mudar a estrutura do site** (produto
 * novo, passo novo, classe nova de CSS, linha nova no mapa de metro) e antes
 * de cada deploy.
 */

require_once __DIR__ . '/admin-open.php';   // ADMIN_OPEN_DEV_V1: sem password até ao deploy

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><title>Acesso restrito</title>'
        . '<p>Inicia sessão como administradora e volta a esta página.</p>';
    exit;
}

require_once __DIR__ . '/lib/snapshot.php';

header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');

$csrf = mp_admin_csrf_token();

function snap_h($v)
{
    return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
}

/**
 * A construção é feita pelo BROWSER, não aqui.
 *
 * A primeira versão fazia o PHP chamar-se a si próprio por HTTP, o que é
 * elegante mas encrava em qualquer servidor de um só processo — o
 * `php -S` do desenvolvimento fica à espera de si mesmo até ao timeout.
 * O browser pedir uma página de cada vez não tem esse problema, funciona
 * igual em produção, e ainda mostra o progresso à medida que avança.
 */

$flash = '';

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_POST['csrf']) || !hash_equals($csrf, (string)$_POST['csrf'])) {
        $flash = 'Pedido inválido. Recarrega a página.';
    } elseif (isset($_POST['accao']) && $_POST['accao'] === 'apagar' && isset($_POST['chave'])) {
        $flash = mp_snapshot_apagar((string)$_POST['chave'])
            ? 'Snapshot apagado. A página volta a calcular ao vivo.'
            : 'Não consegui apagar esse snapshot.';
    } elseif (isset($_POST['accao']) && $_POST['accao'] === 'apagar-todos') {
        $n = 0;
        foreach (mp_snapshot_listar() as $s) {
            if (mp_snapshot_apagar($s['chave'])) { $n++; }
        }
        $flash = $n . ' snapshots apagados. As páginas voltam a calcular ao vivo.';
    }
}

$guardados = mp_snapshot_listar();
$porChave = array();
foreach ($guardados as $s) {
    $porChave[$s['chave']] = $s;
}
?>
<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Snapshots · Mia &amp; Paper admin</title>
<link rel="icon" href="content/brand/logo.webp" type="image/webp">
<link rel="stylesheet" href="admin-nav.css?v=20260907003042">
<script src="admin-nav.js?v=20260907003042" defer></script>
<style>
  body { font: 15px/1.55 system-ui, -apple-system, Segoe UI, sans-serif; background: #fff8df; color: #2e2413; margin: 0; }
  .sp-page { max-width: 940px; margin: 0 auto; padding: 22px 18px 70px; }
  h1 { font-size: 1.45rem; margin: 0 0 6px; }
  .sp-intro { color: #7f6b42; font-size: 0.9rem; margin: 0 0 18px; max-width: 70ch; }
  .sp-flash { background: #dce9d2; color: #33521f; border-radius: 8px; padding: 9px 13px; margin: 0 0 16px; font-size: 0.88rem; }
  .sp-accoes { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 22px; }
  button { font: inherit; font-weight: 600; padding: 9px 15px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.18);
    background: #72551e; color: #fffdf8; cursor: pointer; }
  button.sp-leve { background: #fffdf5; color: #2e2413; }
  table { width: 100%; border-collapse: collapse; font-size: 0.86rem; background: #fffdf5; border-radius: 10px; overflow: hidden; }
  th, td { text-align: left; padding: 8px 11px; border-bottom: 1px solid rgba(0,0,0,0.07); }
  th { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.05em; color: #7f6b42; }
  td.sp-num { text-align: right; font-variant-numeric: tabular-nums; }
  .sp-velho { color: #9a4a2c; font-weight: 600; }
  .sp-falta { color: #7f6b42; font-style: italic; }
  .sp-nota { background: #f6e7bf; border-radius: 10px; padding: 13px 16px; margin: 24px 0 0; font-size: 0.85rem; }
  .sp-nota strong { display: block; margin-bottom: 4px; }
  code { background: rgba(0,0,0,0.05); padding: 1px 5px; border-radius: 4px; font-size: 0.85em; }
  a { color: #72551e; }
</style>
</head>
<body>
<div class="sp-page">
  <h1>Snapshots</h1>
  <p class="sp-intro">
    O funil e o live dashboard recalculam todos os eventos a cada abertura — com
    20 mil eventos são 3 a 5 segundos por página. Com snapshot, respondem em
    milissegundos. Em troca, mostram os números do momento em que o snapshot foi
    feito, e não os de agora. Cada página avisa disso numa barra no topo, com um
    link para ver ao vivo.
  </p>

  <?php if ($flash !== ''): ?>
    <p class="sp-flash"><?= snap_h($flash) ?></p>
  <?php endif; ?>

  <div class="sp-accoes">
    <button type="button" id="spCriar">Criar todos os snapshots</button>
    <form method="post" style="margin:0;">
      <input type="hidden" name="csrf" value="<?= snap_h($csrf) ?>">
      <button type="submit" name="accao" value="apagar-todos" class="sp-leve">Apagar todos (voltar ao vivo)</button>
    </form>
  </div>

  <p id="spProgresso" hidden class="sp-flash"></p>

  <h2 style="font-size:1.05rem;margin:26px 0 10px;">Estado actual</h2>
  <table id="spTabela">
    <thead><tr><th>Página</th><th>Snapshot</th><th class="sp-num">Tamanho</th><th></th></tr></thead>
    <tbody>
    <?php foreach (mp_snapshot_alvos() as $alvo): ?>
      <?php
        $chave = mp_snapshot_key($alvo['pagina'], $alvo['params']);
        $s = isset($porChave[$chave]) ? $porChave[$chave] : null;
        $idade = $s ? time() - $s['at'] : 0;
        $velho = $s && $idade > MP_SNAPSHOT_MAX_AGE_WARN;
      ?>
      <tr data-url="<?= snap_h($alvo['url']) ?>">
        <td><a href="<?= snap_h($alvo['url']) ?>"><code><?= snap_h($alvo['url']) ?></code></a></td>
        <td<?= $velho ? ' class="sp-velho"' : ($s ? '' : ' class="sp-falta"') ?>>
          <?= $s ? snap_h(gmdate('Y-m-d H:i', $s['at']) . ' UTC · ' . mp_snapshot_idade_legivel($idade)) : 'sem snapshot — calcula ao vivo' ?>
        </td>
        <td class="sp-num"><?= $s ? number_format($s['bytes'] / 1024, 0, ',', ' ') . ' KB' : '—' ?></td>
        <td>
          <?php if ($s): ?>
            <form method="post" style="margin:0;">
              <input type="hidden" name="csrf" value="<?= snap_h($csrf) ?>">
              <input type="hidden" name="chave" value="<?= snap_h($chave) ?>">
              <button type="submit" name="accao" value="apagar" class="sp-leve" style="padding:4px 9px;font-size:0.8rem;">Apagar</button>
            </form>
          <?php endif; ?>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>

  <div class="sp-nota">
    <strong>Quando refazer</strong>
    Sempre que se mudar a estrutura do site — produto novo, passo novo do
    wizard, classe nova no CSS, linha nova no mapa de metro — e antes de cada
    deploy, para o servidor arrancar já com os snapshots feitos.
    Em qualquer página com snapshot, <code>?snapshot=off</code> mostra os dados
    ao vivo sem apagar nada.
  </div>
</div>

<script>
(function () {
  "use strict";

  var botao = document.getElementById("spCriar");
  var progresso = document.getElementById("spProgresso");
  var linhas = [].slice.call(document.querySelectorAll("#spTabela tbody tr[data-url]"));

  botao.addEventListener("click", function () {
    var i = 0;
    var falhas = 0;
    botao.disabled = true;
    progresso.hidden = false;

    // Uma página de cada vez, de propósito: cada uma lê milhares de eventos e
    // pedi-las todas ao mesmo tempo só faria o servidor competir consigo mesmo.
    function seguinte() {
      if (i >= linhas.length) {
        progresso.textContent = (linhas.length - falhas) + " de " + linhas.length
          + " snapshots criados." + (falhas ? " " + falhas + " falharam." : " A recarregar…");
        window.setTimeout(function () { window.location.reload(); }, 900);
        return;
      }

      var linha = linhas[i];
      var url = linha.dataset.url;
      var celula = linha.children[1];
      var inicio = Date.now();

      progresso.textContent = "A criar " + (i + 1) + " de " + linhas.length + ": " + url;
      celula.textContent = "a criar…";

      fetch(url + (url.indexOf("?") === -1 ? "?" : "&") + "snapshot=refazer", {
        cache: "no-store",
        credentials: "same-origin"
      }).then(function (r) {
        if (!r.ok) { throw new Error("HTTP " + r.status); }
        return r.text();
      }).then(function (texto) {
        celula.textContent = "criado agora · " + Math.round(texto.length / 1024) + " KB · "
          + ((Date.now() - inicio) / 1000).toFixed(1) + " s";
        celula.className = "";
      })["catch"](function (erro) {
        falhas++;
        celula.textContent = "falhou (" + erro.message + ")";
        celula.className = "sp-velho";
      }).then(function () {
        i++;
        seguinte();
      });
    }

    seguinte();
  });
}());
</script>
</body>
</html>