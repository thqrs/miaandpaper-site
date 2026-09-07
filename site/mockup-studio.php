<?php
/**
 * MOCKUP_STUDIO_V1 — compositor frontal por layers.
 *
 * É uma ferramenta nova e independente. A geometria vive no preset; os
 * ficheiros visuais podem ser substituídos um a um pelo gestor de assets.
 */
require_once __DIR__ . '/admin-open.php';

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    exit('Acesso reservado à administração.');
}

$bootstrap = [
    'endpoint' => 'mockup-studio-api.php',
    'assetBase' => 'content/mockup-studio/a6-front/',
    'presetId' => 'a6-front',
    'csrf' => mp_admin_csrf_token(),
];
?>
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Criador de Mockups · Mia &amp; Paper</title>
  <link rel="stylesheet" href="admin-nav.css?v=20260907015754">
  <link rel="stylesheet" href="mockup-studio/studio.css?v=2026083009">
  <script src="admin-nav.js?v=20260907015754" defer></script>
  <script src="mockup-studio/renderer.js?v=2026083009" defer></script>
  <script src="mockup-studio/app.js?v=2026083009" defer></script>
</head>
<body>
  <header class="studio-toolbar admin-secondary-bar">
    <div class="studio-title">
      <span class="studio-kicker">Composição determinística</span>
      <h1>Criador de Mockups</h1>
    </div>
    <label class="field-inline" for="preset-select">
      <span>Preset</span>
      <select id="preset-select" aria-label="Preset do mockup">
        <option value="a6-front">A6 Front</option>
      </select>
    </label>
    <span id="save-state" class="save-state" role="status">A carregar…</span>
    <button id="undo-button" class="button button-secondary" type="button" disabled>Desfazer</button>
    <button id="save-button" class="button button-primary" type="button" disabled>Guardar preset</button>
  </header>

  <main class="studio-layout">
    <section class="preview-panel" aria-labelledby="preview-title">
      <div class="panel-heading preview-heading">
        <div>
          <span class="eyebrow">Preview frontal</span>
          <h2 id="preview-title">A6 · 8 furos · Cinch 2:1</h2>
        </div>
        <div class="preview-actions">
          <label class="toggle"><input id="guides-toggle" type="checkbox"> Guias</label>
          <button id="export-png" class="button button-secondary" type="button">Exportar PNG</button>
        </div>
      </div>

      <div class="canvas-stage" id="cover-drop-zone">
        <canvas id="mockup-canvas" width="1200" height="1200" aria-label="Pré-visualização do mockup A6 por camadas"></canvas>
        <div id="render-busy" class="render-busy" hidden>A montar as camadas…</div>
      </div>

      <div class="cover-loader">
        <div>
          <strong>Arte da capa</strong>
          <span id="cover-file-name">Ainda não carregada. A imagem fica apenas neste browser.</span>
        </div>
        <label class="button button-primary" for="cover-file">Carregar capa</label>
        <input id="cover-file" type="file" accept="image/*" hidden>
        <button id="clear-cover" class="button button-secondary" type="button" disabled>Retirar</button>
      </div>

      <ol class="layer-order" aria-label="Ordem das camadas">
        <li>Fundo</li><li>Sombra da capa</li><li>Profundidade</li><li>Sombra das argolas</li>
        <li>Argola traseira</li><li>Capa + mask</li><li>Profundidade dos buracos</li>
        <li>Argola frontal</li><li>Elástico</li><li>Brilhos</li><li>Reflexos</li><li>Textura</li>
      </ol>
    </section>

    <aside class="editor-panel" aria-label="Controlos técnicos do mockup">
      <nav class="editor-tabs" aria-label="Áreas do editor">
        <button type="button" class="is-active" data-tab="geometry">Geometria</button>
        <button type="button" data-tab="finish">Acabamentos</button>
        <button type="button" data-tab="assets">Assets</button>
      </nav>

      <div class="editor-scroll">
        <section class="tab-panel is-active" data-panel="geometry">
          <div class="control-section">
            <div class="section-title"><span>01</span><div><h3>Capa</h3><p>Geometria e enquadramento da arte.</p></div></div>
            <div id="cover-controls" class="control-grid"></div>
          </div>
          <div class="control-section">
            <div class="section-title"><span>02</span><div><h3>Buracos</h3><p>Recortes geométricos, nunca pintados na capa.</p></div></div>
            <div id="hole-controls" class="control-grid"></div>
          </div>
          <div class="control-section">
            <div class="section-title"><span>03</span><div><h3>Argolas</h3><p>Conjunto completo em atlas, com perspectiva própria em cada posição.</p></div></div>
            <div id="ring-controls" class="control-grid"></div>
          </div>
          <div class="control-section">
            <div class="section-title"><span>04</span><div><h3>Elástico</h3><p>Peça independente da capa e dos reflexos.</p></div></div>
            <div id="elastic-controls" class="control-grid"></div>
          </div>
        </section>

        <section class="tab-panel" data-panel="finish">
          <div class="control-section">
            <div class="section-title"><span>05</span><div><h3>Sombras</h3><p>Opacidade, posição e escala de cada família.</p></div></div>
            <div id="shadow-controls" class="control-grid"></div>
          </div>
          <div class="control-section">
            <div class="section-title"><span>06</span><div><h3>Overlays</h3><p>Brilho, reflexão e textura continuam isolados.</p></div></div>
            <div id="overlay-controls" class="control-grid"></div>
          </div>
        </section>

        <section class="tab-panel" data-panel="assets">
          <div class="assets-intro">
            <span class="eyebrow">Asset manager</span>
            <h3>Substituir uma peça</h3>
            <p>Os assets raster são convertidos para PNG; os atlas das argolas mantêm-se em SVG. Cada slot é substituído isoladamente.</p>
          </div>
          <div id="asset-manager" class="asset-manager"></div>
        </section>
      </div>
    </aside>
  </main>

  <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
  <script>window.MOCKUP_STUDIO_BOOTSTRAP = <?= json_encode($bootstrap, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;</script>
</body>
</html>