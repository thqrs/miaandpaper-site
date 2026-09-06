<?php
// MOCKUP_STUDIO_MVP_V1
// Ferramenta local e determinista para calibrar masters e aplicar capas.

require_once __DIR__ . '/admin-open.php';
if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8"><title>Acesso restrito</title><body style="font-family:Georgia,serif;max-width:560px;margin:60px auto;padding:0 20px"><h1>Acesso restrito.</h1><p>Inicia sessão como administradora no <a href="index.html">site</a>.</p></body></html>';
    exit;
}
?>
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Criador de mockups · Mia &amp; Paper</title>
  <link rel="icon" href="content/brand/logo.webp" type="image/webp">
  <link rel="stylesheet" href="css/01-tokens-agua.css?v=20260906225853">
  <link rel="stylesheet" href="admin-nav.css?v=20260906225853">
  <link rel="stylesheet" href="mockups/mockups.css?v=2026083001">
  <script src="admin-nav.js?v=20260906225853" defer></script>
  <script type="module" src="mockups/app.js?v=2026083001"></script>
</head>
<body>
  <main class="mockup-app" data-mockup-app>
    <header class="mockup-heading">
      <div>
        <p class="mockup-kicker">Ferramenta técnica · MVP</p>
        <h1>Criador de mockups</h1>
        <p>Calibra uma vez o produto e troca apenas a arte impressa na capa.</p>
      </div>
      <div class="mockup-status" data-status role="status" aria-live="polite">Motor pronto.</div>
    </header>

    <section class="mockup-toolbar" aria-label="Ficheiros e master">
      <label>Produto
        <select data-field="preset">
          <option value="a6-front">A6 · Frente</option>
          <option value="large-front">Grande / Revistas · Frente</option>
        </select>
      </label>
      <label>Imagem base
        <span class="file-button">Carregar base<input data-base-input type="file" accept="image/png,image/jpeg,image/webp"></span>
      </label>
      <label>Arte da capa
        <span class="file-button is-primary">Carregar capa<input data-cover-input type="file" accept="image/png,image/jpeg,image/webp"></span>
      </label>
      <label class="toggle-field"><input data-edit-master type="checkbox" checked> Editar Master</label>
      <label>Masters guardados
        <select data-saved-masters><option value="">Escolher…</option></select>
      </label>
    </section>

    <div class="mockup-layout">
      <section class="mockup-workspace" aria-label="Preview do mockup">
        <div class="mockup-stage" data-stage>
          <div class="mockup-canvas-wrap" data-canvas-wrap>
            <canvas data-preview width="1600" height="1600" aria-label="Preview do mockup"></canvas>
            <svg class="mockup-handles" data-handles viewBox="0 0 1600 1600" preserveAspectRatio="none" aria-label="Pontos da perspectiva">
              <polygon data-cover-polygon points=""></polygon>
              <g data-handle="topLeft"><circle r="18"></circle><text>TL</text></g>
              <g data-handle="topRight"><circle r="18"></circle><text>TR</text></g>
              <g data-handle="bottomRight"><circle r="18"></circle><text>BR</text></g>
              <g data-handle="bottomLeft"><circle r="18"></circle><text>BL</text></g>
            </svg>
          </div>
        </div>
        <div class="mockup-workspace-footer">
          <span data-counter>8 buracos · 8 argolas</span>
          <span data-canvas-size>1600 × 1600 px</span>
        </div>
      </section>

      <aside class="mockup-controls" aria-label="Parâmetros técnicos">
        <details open>
          <summary>Master</summary>
          <div class="control-grid">
            <label class="span-2">Nome<input data-field="name" type="text" value="A6 - Frente"></label>
            <label>Canvas L<input data-field="canvasWidth" type="number" min="200" max="10000" step="1"></label>
            <label>Canvas A<input data-field="canvasHeight" type="number" min="200" max="10000" step="1"></label>
          </div>
          <div class="button-row">
            <button data-save-master type="button" class="primary">Guardar master</button>
            <button data-download-master type="button">Descarregar JSON</button>
            <label class="file-button compact">Importar JSON<input data-import-master type="file" accept="application/json,.json"></label>
          </div>
          <p class="control-note">A capa actual nunca é guardada no master.</p>
        </details>

        <details open>
          <summary>Produto</summary>
          <div class="control-grid">
            <label>Largura (mm)<input data-field="product.widthMm" type="number" min="1" max="1000" step="0.1"></label>
            <label>Altura (mm)<input data-field="product.heightMm" type="number" min="1" max="1000" step="0.1"></label>
          </div>
        </details>

        <details open>
          <summary>Capa</summary>
          <div class="control-grid">
            <label>Encaixe<select data-field="coverArt.fit"><option value="cover">Cover</option><option value="contain">Contain</option></select></label>
            <label>Zoom<input data-field="coverArt.zoom" type="number" min="0.1" max="8" step="0.05"></label>
            <label>Mover X (%)<input data-field="coverArt.offsetX" type="number" min="-200" max="200" step="1"></label>
            <label>Mover Y (%)<input data-field="coverArt.offsetY" type="number" min="-200" max="200" step="1"></label>
            <label>Rotação (°)<input data-field="coverArt.rotation" type="number" min="-180" max="180" step="0.5"></label>
          </div>
          <div class="corner-grid">
            <strong>Ponto</strong><strong>X</strong><strong>Y</strong>
            <span>Top left</span><input data-corner="topLeft" data-axis="0" type="number" step="1"><input data-corner="topLeft" data-axis="1" type="number" step="1">
            <span>Top right</span><input data-corner="topRight" data-axis="0" type="number" step="1"><input data-corner="topRight" data-axis="1" type="number" step="1">
            <span>Bottom right</span><input data-corner="bottomRight" data-axis="0" type="number" step="1"><input data-corner="bottomRight" data-axis="1" type="number" step="1">
            <span>Bottom left</span><input data-corner="bottomLeft" data-axis="0" type="number" step="1"><input data-corner="bottomLeft" data-axis="1" type="number" step="1">
          </div>
        </details>

        <details open>
          <summary>Furação</summary>
          <div class="control-grid">
            <label>Número<input data-field="binding.holeCount" type="number" min="1" max="50" step="1"></label>
            <label>Formato<select data-field="binding.holeShape" disabled><option value="square">Quadrado</option></select></label>
            <label>Largura (mm)<input data-field="binding.holeWidthMm" type="number" min="0.2" max="30" step="0.1"></label>
            <label>Altura (mm)<input data-field="binding.holeHeightMm" type="number" min="0.2" max="30" step="0.1"></label>
            <label>Pitch (mm)<input data-field="binding.pitchMm" type="number" min="0.2" max="100" step="0.1"></label>
            <label>Posição X (mm)<input data-field="binding.xMm" type="number" min="-100" max="1000" step="0.1"></label>
            <label>Primeiro Y (mm)<input data-field="binding.firstHoleYMm" type="number" min="-100" max="1000" step="0.1"></label>
            <label>Margem superior<input data-top-margin type="text" readonly></label>
            <label>Margem inferior<input data-bottom-margin type="text" readonly></label>
          </div>
          <p class="control-note">As margens são calculadas. O pitch nunca é distribuído automaticamente pela altura.</p>
        </details>

        <details>
          <summary>Argolas</summary>
          <div class="control-grid">
            <label>Quantidade<input data-ring-count type="text" readonly></label>
            <label>Asset<select data-field="rings.asset"><option value="test-gold">Teste dourado</option></select></label>
            <label>Escala<input data-field="rings.scale" type="number" min="0.1" max="5" step="0.05"></label>
            <label>Offset X (mm)<input data-field="rings.offsetXMm" type="number" min="-100" max="100" step="0.1"></label>
            <label>Offset Y (mm)<input data-field="rings.offsetYMm" type="number" min="-100" max="100" step="0.1"></label>
          </div>
        </details>

        <details open>
          <summary>Exportar</summary>
          <div class="control-grid">
            <label>Largura final<input data-export-width type="number" min="200" max="10000" step="1" value="3200"></label>
            <label>Altura final<input data-export-height type="number" min="200" max="10000" step="1" value="3200"></label>
          </div>
          <button data-export-png type="button" class="primary full">Exportar mockup PNG</button>
        </details>
      </aside>
    </div>
  </main>
</body>
</html>