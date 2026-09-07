<?php
/**
 * MIU_ANIMATION_LAB_EXPERIMENTAL_V2
 *
 * Laboratório isolado para testar e comparar as sprites de produção do Míu
 * com a spritesheet experimental 8×8 de frames completos e multi-sheet.
 * Não altera a configuração do site público nem o Míu de produção.
 */

require_once __DIR__ . '/admin-open.php';

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
        . '<title>Acesso negado · Míu Lab</title><h1>Acesso restrito.</h1>'
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
  <title>Míu 8×8 · Laboratório Experimental</title>
  <link rel="stylesheet" href="css/01-tokens-agua.css?v=20260907013932">
  <link rel="stylesheet" href="admin-nav.css?v=20260907013932">
  <link rel="stylesheet" href="miu-animation-lab.css?v=2026082502">
  <script src="admin-nav.js?v=20260907013932" defer></script>
  <script src="miu-sprite-grid.js?v=2026082703" defer></script>
  <script src="miu-animation-lab.js?v=2026082702" defer></script>
</head>
<body class="miu-lab-page">
  <main
    class="miu-lab-shell"
    id="miu-lab-shell"
    data-full-sprite-animations="content/brand/miu/experimental/experimental-full-spritesheet-animations_002.json"
  >
    <header class="miu-lab-hero">
      <p class="miu-lab-eyebrow">Experimental · Lab 8×8 Multi-Sheet</p>
      <h1>Míu · Frames Fluídos 8×8</h1>
      <p>Laboratório de comparação: testa animações fluídas contínuas e híbridas (combinando frames de múltiplas folhas) lado a lado com a versão do Míu que está em produção.</p>
    </header>

    <p class="miu-lab-isolation"><strong>Produção intacta.</strong> O Míu público continua a usar <code>miu-sprite.webp</code>. Esta página serve para afinar sequências, timings e enquadramento da nova sheet 8×8 sem tocar na loja ativa.</p>

    <p class="miu-lab-loading" id="miu-lab-loading" role="status">A carregar as folhas de sprites e as animações…</p>
    <p class="miu-lab-error" id="miu-lab-error" role="alert" hidden></p>

    <section class="miu-lab-card miu-lab-controls" aria-label="Controlos da animação">
      <div class="miu-lab-selectors">
        <label for="miu-lab-full-animation">
          Animação Experimental (8×8)
          <select id="miu-lab-full-animation">
            <option value="">A carregar animações…</option>
          </select>
        </label>
        <label for="miu-lab-legacy-animation">
          Comparação com Produção
          <select id="miu-lab-legacy-animation">
            <option value="faceCalm">Calma / Piscar (Produção)</option>
            <option value="faceSmile">Sorriso (Produção)</option>
            <option value="faceTilt">Inclinação E/D (Produção)</option>
            <option value="faceEar">Orelha Twitch (Produção)</option>
            <option value="faceSleep">Sono Zzz (Produção)</option>
            <option value="faceNeutral">Pose Estática Neutra</option>
          </select>
        </label>
      </div>

      <div class="miu-lab-buttons">
        <button class="miu-lab-button miu-lab-button--primary" id="miu-lab-play" type="button">Play</button>
        <button class="miu-lab-button" id="miu-lab-pause" type="button">Pause</button>
        <button class="miu-lab-button" id="miu-lab-replay" type="button">Replay</button>
      </div>

      <div class="miu-lab-toggles">
        <label class="miu-lab-check"><input id="miu-lab-cycle-all" type="checkbox" checked> Loop contínuo de todas</label>
        <label class="miu-lab-check"><input id="miu-lab-loop" type="checkbox" checked> Loop individual</label>
        <label class="miu-lab-check"><input id="miu-lab-bounds" type="checkbox"> Bounding box</label>
        <label class="miu-lab-check"><input id="miu-lab-grid" type="checkbox"> Grelha na sheet</label>
      </div>

      <div class="miu-lab-speed">
        <label for="miu-lab-speed">Velocidade</label>
        <input id="miu-lab-speed" type="range" min="0.25" max="2" step="0.25" value="1">
        <output id="miu-lab-speed-output" for="miu-lab-speed">1×</output>
      </div>
    </section>

    <section class="miu-lab-comparison" aria-label="Comparação lado a lado">
      <article class="miu-lab-card miu-lab-stage-card">
        <header>
          <h2>Míu atual</h2>
          <span>Produção</span>
        </header>
        <div class="miu-lab-stage">
          <canvas id="miu-lab-current-canvas" width="256" height="256" aria-label="Animação da spritesheet atual de produção"></canvas>
        </div>
        <footer>
          <p id="miu-lab-current-status">À espera da sprite atual.</p>
          <p>Sprite 4×2 do site (gata Lili) renderizada a 100 px para referência visual.</p>
        </footer>
      </article>

      <article class="miu-lab-card miu-lab-stage-card">
        <header>
          <h2>Míu 8×8 (Frames Fluídos)</h2>
          <span>Experimental Multi-Sheet</span>
        </header>
        <div class="miu-lab-stage">
          <canvas id="miu-lab-full-canvas" width="256" height="256" aria-label="Animação da spritesheet 8×8 experimental"></canvas>
        </div>
        <footer>
          <p id="miu-lab-full-status">À espera da spritesheet 8×8.</p>
          <progress class="miu-lab-progress" id="miu-lab-full-progress" max="1" value="0" aria-label="Progresso da frame ativa"></progress>
          <p>Frames inteiros 128×128 px recortados com deteção de componentes conectados e suporte multi-sheet.</p>
        </footer>
      </article>
    </section>

    <section class="miu-lab-card miu-lab-details" aria-labelledby="miu-lab-sequence-title">
      <div>
        <h2 class="miu-lab-section-title" id="miu-lab-sequence-title">Sequência e Timings</h2>
        <p class="miu-lab-state-line">
          <strong id="miu-lab-animation-name">A carregar…</strong>
          <span id="miu-lab-play-state">Em pausa</span>
        </p>
      </div>
      <div class="miu-lab-sequence-wrap">
        <ol class="miu-lab-sequence" id="miu-lab-full-sequence"></ol>
      </div>
    </section>

    <section class="miu-lab-card miu-lab-atlas" aria-labelledby="miu-lab-atlas-title">
      <div class="miu-lab-atlas-head">
        <h2 class="miu-lab-section-title" id="miu-lab-atlas-title">Folhas de Sprites Ativas</h2>
      </div>
      <div class="miu-lab-atlas-list" id="miu-lab-atlas-container">
        <figure class="miu-lab-atlas-item">
          <figcaption>
            <strong>Folha 1 · Animações Fluídas (In-betweens)</strong>
            <a href="content/brand/miu/experimental/experimental-full-spritesheet-animations_002.json">Manifesto JSON</a>
          </figcaption>
          <div class="miu-lab-atlas-wrap">
            <img id="miu-lab-sheet-img" src="content/brand/miu/experimental/miu-fluid-animations-transparent.png" alt="Spritesheet experimental de animações fluídas">
          </div>
        </figure>
        <figure class="miu-lab-atlas-item">
          <figcaption>
            <strong>Folha 3 · V4 Estados e Micro-idles</strong>
            <a href="content/brand/miu/experimental/quantity-rig-v4/miu-v4-states-idle-8x8.png">Abrir PNG</a>
          </figcaption>
          <div class="miu-lab-atlas-wrap">
            <img src="content/brand/miu/experimental/quantity-rig-v4/miu-v4-states-idle-8x8.png" alt="Spritesheet PNG 8 por 8 dos estados emocionais do Quantity Rig V4">
          </div>
        </figure>
        <figure class="miu-lab-atlas-item">
          <figcaption>
            <strong>Folha 4 · V4 Reacções e Rejoice</strong>
            <a href="content/brand/miu/experimental/quantity-rig-v4/miu-v4-reactions-rejoice-8x8.png">Abrir PNG</a>
          </figcaption>
          <div class="miu-lab-atlas-wrap">
            <img src="content/brand/miu/experimental/quantity-rig-v4/miu-v4-reactions-rejoice-8x8.png" alt="Spritesheet PNG 8 por 8 das reacções de quantidade e rejoice do V4">
          </div>
        </figure>
        <figure class="miu-lab-atlas-item">
          <figcaption>
            <strong>Folha 5 · V5 Idle Vivo e Atenção</strong>
            <a href="content/brand/miu/experimental/quantity-rig-v4/miu-v5-idle-attention-8x8.png">Abrir PNG</a>
          </figcaption>
          <div class="miu-lab-atlas-wrap">
            <img src="content/brand/miu/experimental/quantity-rig-v4/miu-v5-idle-attention-8x8.png" alt="Spritesheet PNG 8 por 8 do idle vivo e atenção do Míu Animation Director V5">
          </div>
        </figure>
        <figure class="miu-lab-atlas-item">
          <figcaption>
            <strong>Folha 6 · V5 Reacções por Gesto</strong>
            <a href="content/brand/miu/experimental/quantity-rig-v4/miu-v5-gesture-reactions-8x8.png">Abrir PNG</a>
          </figcaption>
          <div class="miu-lab-atlas-wrap">
            <img src="content/brand/miu/experimental/quantity-rig-v4/miu-v5-gesture-reactions-8x8.png" alt="Spritesheet PNG 8 por 8 das reacções por gesto do Míu Animation Director V5">
          </div>
        </figure>
      </div>
      <p class="miu-lab-atlas-note">A opção “Grelha na sheet” sobrepõe as 64 células para validação do alinhamento e enquadramento das poses.</p>
    </section>
  </main>
</body>
</html>