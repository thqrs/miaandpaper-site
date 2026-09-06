<?php
/**
 * MIU_ANIMATION_DIRECTOR_V5
 *
 * Laboratório isolado para testar idle vivo, atenção durante a interacção,
 * reacções por gesto agregado e efeitos anime independentes.
 *
 * Não é carregado pelo configurador nem altera o Míu público.
 */

require_once __DIR__ . '/admin-open.php';

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
        . '<title>Acesso negado · Míu Animation Director</title><h1>Acesso restrito.</h1>'
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
  <title>Míu Animation Director · V5</title>
  <link rel="stylesheet" href="css/01-tokens-agua.css?v=20260906225853">
  <link rel="stylesheet" href="admin-nav.css?v=20260906225853">
  <link rel="stylesheet" href="miu-rig.css?v=2026082701">
  <script src="admin-nav.js?v=20260906225853" defer></script>
  <script src="miu-sprite-grid.js?v=2026082703" defer></script>
  <script src="miu-rig.js?v=2026082710" defer></script>
</head>
<body class="rig5-page">
<main class="rig5-shell">
  <header class="rig5-hero">
    <span class="rig5-kicker">Laboratório isolado · V5</span>
    <h1>Míu Animation Director</h1>
    <p>Idle vivo, atenção durante a interacção e uma reacção única ao gesto completo. A quantidade deixa de escolher uma expressão.</p>
  </header>

  <div class="rig5-rule">
    <strong>Nova regra:</strong> o Míu está normalmente quietinho e vivo. Quando a pessoa começa a mexer, fica atento; quando abranda ou larga, o director mede direcção, delta acumulado, velocidade e importância do evento. Só então escolhe uma reacção e regressa organicamente ao idle.
  </div>

  <p class="rig5-note" id="rig5-loading">A isolar e centrar as folhas de idle e reacções…</p>
  <p class="rig5-error" id="rig5-error" role="alert" hidden></p>

  <section class="rig5-compare" aria-label="Comparação entre os frames e o Animation Director">
    <article class="rig5-card rig5-stage-card">
      <header>
        <h2>Frames da animação</h2>
        <span class="rig5-badge">Arte pura</span>
      </header>
      <div class="rig5-stage">
        <canvas id="rig5-raw" width="640" height="640" aria-label="Frames artísticos da animação actual"></canvas>
      </div>
      <footer><p id="rig5-raw-status" aria-live="polite">A carregar…</p></footer>
    </article>

    <article class="rig5-card rig5-stage-card">
      <header>
        <h2>Director + movimento + FX</h2>
        <span class="rig5-badge" id="rig5-motion-badge">A carregar</span>
      </header>
      <div class="rig5-stage">
        <canvas id="rig5-director" width="640" height="640" aria-label="Míu dirigido por eventos, com movimento secundário e efeitos anime"></canvas>
      </div>
      <footer><p id="rig5-director-status" aria-live="polite">A carregar…</p></footer>
    </article>
  </section>

  <section class="rig5-workbench">
    <article class="rig5-card rig5-controls">
      <div class="rig5-quantity-head">
        <h2>Quantidade</h2>
        <output class="rig5-quantity-value" id="rig5-quantity-value" for="rig5-quantity">6</output>
      </div>

      <div class="rig5-main-slider">
        <span aria-hidden="true">0</span>
        <input id="rig5-quantity" type="range" min="0" max="10" step="1" value="6" aria-label="Quantidade">
        <span aria-hidden="true">10</span>
      </div>

      <dl class="rig5-summary">
        <div><dt>Quantidade</dt><dd id="rig5-summary-value">6</dd></div>
        <div><dt>Fase</dt><dd id="rig5-summary-phase">loading</dd></div>
        <div><dt>Delta do gesto</dt><dd id="rig5-summary-delta">0</dd></div>
        <div><dt>Reacção</dt><dd id="rig5-summary-reaction">—</dd></div>
      </dl>

      <div class="rig5-row" aria-label="Alterações discretas da quantidade">
        <button type="button" class="rig5-button" data-quantity-nudge="-1">−1</button>
        <button type="button" class="rig5-button" data-quantity-nudge="1">+1</button>
        <button type="button" class="rig5-button" id="rig5-attention">Só chamar a atenção</button>
        <button type="button" class="rig5-button rig5-button--primary" id="rig5-continue">Continuar</button>
        <button type="button" class="rig5-button" id="rig5-reset">Reset</button>
      </div>

      <div class="rig5-row rig5-row--packs" aria-label="Simular selecção de packs">
        <span class="rig5-row-label">Simular packs:</span>
        <button type="button" class="rig5-button" data-pack-value="3" data-pack-importance="0.18">Pack pequeno · 3</button>
        <button type="button" class="rig5-button" data-pack-value="6" data-pack-importance="0.48">Pack médio · 6</button>
        <button type="button" class="rig5-button" data-pack-value="10" data-pack-importance="0.88">Pack grande · 10</button>
      </div>

      <div class="rig5-toggles">
        <label><input id="rig5-guides" type="checkbox"> Mostrar âncora de centragem</label>
        <label><input id="rig5-frames-only" type="checkbox"> Só frames, sem rig nem FX</label>
      </div>

      <div class="rig5-settings">
        <div class="rig5-setting">
          <label for="rig5-intensity">Intensidade do movimento e FX</label>
          <input id="rig5-intensity" type="range" min="0" max="100" step="1" value="68">
          <output id="rig5-intensity-out" for="rig5-intensity">68%</output>
        </div>
        <div class="rig5-setting">
          <label for="rig5-speed">Velocidade das animações</label>
          <input id="rig5-speed" type="range" min="50" max="180" step="5" value="100">
          <output id="rig5-speed-out" for="rig5-speed">1.00×</output>
        </div>
      </div>

      <p class="rig5-note">A posição normalizada continua disponível para integração futura, mas não escolhe a cara. O mesmo valor pode produzir reacções diferentes consoante o gesto que levou até ele.</p>
    </article>

    <aside class="rig5-card rig5-debug">
      <h2>Director em tempo real</h2>

      <div class="rig5-lanes" aria-label="Prioridades da máquina de estados">
        <span class="rig5-lane" data-phase="one-shot">One-shot</span>
        <span class="rig5-lane" data-phase="reaction">Reacção</span>
        <span class="rig5-lane" data-phase="attention">Atenção</span>
        <span class="rig5-lane" data-phase="recovery">Recovery</span>
        <span class="rig5-lane" data-phase="idle">Idle vivo</span>
      </div>

      <dl class="rig5-metrics">
        <div><dt>Value</dt><dd id="rig5-debug-value">6</dd></div>
        <div><dt>Posição</dt><dd id="rig5-debug-position">0.600</dd></div>
        <div><dt>Gesture start</dt><dd id="rig5-debug-start">—</dd></div>
        <div><dt>Gesture delta</dt><dd id="rig5-debug-delta">0</dd></div>
        <div><dt>Velocity</dt><dd id="rig5-debug-velocity">0.00 u/s</dd></div>
        <div><dt>Phase</dt><dd id="rig5-debug-phase">loading</dd></div>
        <div><dt>Direction</dt><dd id="rig5-debug-direction">none</dd></div>
        <div><dt>Magnitude</dt><dd id="rig5-debug-magnitude">none</dd></div>
        <div><dt>Reaction</dt><dd id="rig5-debug-reaction">—</dd></div>
        <div><dt>Animation</dt><dd id="rig5-debug-animation">—</dd></div>
        <div><dt>FX layer</dt><dd id="rig5-debug-fx">none</dd></div>
        <div><dt>One-shot</dt><dd id="rig5-debug-one-shot">—</dd></div>
        <div><dt>Frame</dt><dd id="rig5-debug-frame">0/0</dd></div>
      </dl>

      <ul class="rig5-event-log" id="rig5-event-log" aria-label="Últimos eventos do director">
        <li>—</li>
      </ul>
    </aside>

    <article class="rig5-card rig5-demos">
      <h2>Cenários de gesto</h2>
      <div class="rig5-row" id="rig5-demo-buttons">
        <button type="button" class="rig5-button" data-demo="small-up">1 → 3</button>
        <button type="button" class="rig5-button" data-demo="large-up">2 → 9 rápido</button>
        <button type="button" class="rig5-button" data-demo="slow-down">8 → 4 lento</button>
        <button type="button" class="rig5-button" data-demo="large-down">9 → 2 rápido</button>
        <button type="button" class="rig5-button" data-demo="oscillation">Oscilação 5 ↔ 6</button>
        <button type="button" class="rig5-button" data-demo="pack-large">Pack grande</button>
        <button type="button" class="rig5-button" data-demo="purchase">Compra concluída</button>
        <button type="button" class="rig5-button" id="rig5-stop-demo" disabled>Parar</button>
      </div>
      <div class="rig5-demo-status" id="rig5-demo-status" aria-live="polite">Pronto. Repara que os passos intermédios mantêm atenção contínua; a reacção só nasce no fim do gesto.</div>
    </article>
  </section>
</main>
</body>
</html>