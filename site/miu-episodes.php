<?php
/**
 * MÍU_PEQUENOS_EPISODIOS_V1
 *
 * Leitor isolado para rever sequências compostas a partir da biblioteca
 * experimental 8×8. Não é carregado pelo configurador nem pelo Míu público.
 */

require_once __DIR__ . '/admin-open.php';

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
        . '<title>Acesso negado · Pequenos episódios do Míu</title><h1>Acesso restrito.</h1>'
        . '<p>Inicia sessão como administradora e regressa a esta página.</p>';
    exit;
}
?>
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Míu · Pequenos episódios da oficina</title>
  <link rel="stylesheet" href="css/01-tokens-agua.css?v=20260907013932">
  <link rel="stylesheet" href="admin-nav.css?v=20260907013932">
  <link rel="stylesheet" href="miu-episodes.css?v=2026082801">
  <script src="admin-nav.js?v=20260907013932" defer></script>
  <script src="miu-sprite-grid.js?v=2026082703" defer></script>
  <script src="miu-episodes.js?v=2026082801" defer></script>
</head>
<body class="episodes-page">
<main class="episodes-shell">
  <header class="episodes-hero">
    <span class="episodes-kicker">Laboratório isolado · temporada 1</span>
    <h1>Pequenos episódios do Míu</h1>
    <p>Sequências curtas construídas com as folhas 8×8 derivadas do Míu canónico. O leitor compõe personagem, adereços e FX sem fazer morph facial nem alterar o configurador.</p>
  </header>

  <p class="episodes-error" id="episodes-error" role="alert" hidden></p>

  <section class="episodes-layout" aria-label="Leitor e lista de episódios">
    <aside class="episodes-library">
      <div class="episodes-library-head">
        <div>
          <span class="episodes-eyebrow">Temporada 1</span>
          <h2>Histórias</h2>
        </div>
        <span class="episodes-count" id="episodes-count">—</span>
      </div>
      <div class="episodes-list" id="episodes-list" aria-label="Episódios disponíveis"></div>
    </aside>

    <article class="episodes-player">
      <header class="episodes-player-head">
        <div>
          <span class="episodes-eyebrow" id="episodes-number">A carregar</span>
          <h2 id="episodes-title">Biblioteca do Míu</h2>
          <p id="episodes-logline">A preparar as spritesheets e o algoritmo de auto-centragem…</p>
        </div>
        <span class="episodes-status" id="episodes-status">loading</span>
      </header>

      <div class="episodes-stage-wrap">
        <canvas id="episodes-stage" width="760" height="760" aria-label="Animação do episódio seleccionado"></canvas>
        <div class="episodes-layer-chips" aria-label="Camadas activas">
          <span data-layer="character">Míu</span>
          <span data-layer="prop">Adereço</span>
          <span data-layer="fx">FX</span>
        </div>
        <div class="episodes-handoff" id="episodes-handoff" hidden>
          <strong>Handoff</strong>
          <span>retomar o idle vivo do contexto actual</span>
        </div>
      </div>

      <div class="episodes-transport">
        <button type="button" class="episodes-button" id="episodes-previous" aria-label="Episódio anterior">←</button>
        <button type="button" class="episodes-button episodes-button--primary" id="episodes-play">Reproduzir</button>
        <button type="button" class="episodes-button" id="episodes-restart">Recomeçar</button>
        <button type="button" class="episodes-button" id="episodes-next" aria-label="Episódio seguinte">→</button>
      </div>

      <div class="episodes-progress-row">
        <span id="episodes-time-current">0:00.000</span>
        <input id="episodes-progress" type="range" min="0" max="1000" step="1" value="0" aria-label="Posição no episódio">
        <span id="episodes-time-total">0:00.000</span>
      </div>

      <div class="episodes-options">
        <label><input id="episodes-fx" type="checkbox" checked> Mostrar FX</label>
        <label><input id="episodes-props" type="checkbox" checked> Mostrar adereços</label>
        <label><input id="episodes-guides" type="checkbox"> Mostrar âncoras</label>
        <label><input id="episodes-reduced" type="checkbox"> Movimento reduzido</label>
        <label><input id="episodes-loop" type="checkbox"> Repetir episódio</label>
        <label class="episodes-speed">Velocidade
          <select id="episodes-speed" aria-label="Velocidade de reprodução">
            <option value="0.5">0,5×</option>
            <option value="0.75">0,75×</option>
            <option value="1" selected>1×</option>
            <option value="1.25">1,25×</option>
            <option value="1.5">1,5×</option>
          </select>
        </label>
      </div>

      <dl class="episodes-debug">
        <div><dt>Beat</dt><dd id="episodes-beat">—</dd></div>
        <div><dt>Folha</dt><dd id="episodes-sheet">—</dd></div>
        <div><dt>Camada</dt><dd id="episodes-layer">—</dd></div>
        <div><dt>Frame</dt><dd id="episodes-frame">—</dd></div>
      </dl>
    </article>
  </section>

  <section class="episodes-storyboard">
    <header>
      <div>
        <span class="episodes-eyebrow">Montagem</span>
        <h2>Storyboard executável</h2>
      </div>
      <p id="episodes-sheet-summary">—</p>
    </header>
    <ol class="episodes-timeline" id="episodes-timeline"></ol>
  </section>

  <section class="episodes-contract">
    <h2>Contrato deste laboratório</h2>
    <div>
      <p><strong>Frames artísticos:</strong> definem a cara e chegam intactos ao ecrã.</p>
      <p><strong>Director:</strong> ordena beats, mantém o último frame da personagem e acrescenta apenas adereços ou FX.</p>
      <p><strong>Centragem:</strong> usa as medianas anatómicas calculadas por <code>MiuSpriteGrid.detectConnectedGrid</code>.</p>
      <p><strong>Assets:</strong> PNG com alpha; sprites do Míu nunca são convertidos para WebP.</p>
    </div>
  </section>
</main>
</body>
</html>