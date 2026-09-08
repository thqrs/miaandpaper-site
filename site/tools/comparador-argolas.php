<?php
// COMPARADOR_ARGOLAS_V2: 15 Linhas Oficiais INDEX x [Argolas >=80%] x [Site A4 Multi-Variantes] x [Site A6 Multi-Variantes]
require_once __DIR__ . '/../admin-open.php';

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
        . '<title>Acesso negado · Comparador Oficial de Argolas</title>'
        . '<style>body{font-family:Georgia,serif;max-width:560px;margin:60px auto;padding:0 20px;color:#3b2f1f;}h1{font-size:1.4rem;}a{color:#4f7a3a;font-weight:700;}</style>'
        . '<h1>Acesso restrito.</h1>'
        . '<p>Inicia sessão como administradora a partir de <a href="../index.html">index.html</a> e regressa a esta página.</p>';
    exit;
}

// Endpoint de gravação POST no servidor
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    if ($data && isset($data['items'])) {
        $json_file = __DIR__ . '/../content/comparador-validacoes.json';
        file_put_contents($json_file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => true, 'updated_at' => date('c')]);
        exit;
    }
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Dados inválidos']);
    exit;
}
?>
<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comparador Oficial de Argolas (15 Designs) · Mia &amp; Paper</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="stylesheet" href="../admin-nav.css?v=20260908010816">
  <script src="../admin-nav.js?v=20260908010816" data-prefix="../" defer></script>
  <style>
    :root {
      --bg-main: #f8f6f0;
      --bg-card: #ffffff;
      --bg-header: #ffffff;
      --text-main: #2d312e;
      --text-muted: #6b7269;
      --border-color: #e5e0d4;
      --accent: #5a7b69;
      --accent-light: #edf2ee;
      --accent-hover: #466354;
      --gold: #b38b4d;
      --rose: #b86b77;
      
      --col-oficiais: #6a4c93;
      --col-argolas: #2e7d32;
      --col-a4: #8e5836;
      --col-a6: #b86b77;
      
      --match-100: #2e7d32;
      --match-98: #388e3c;
      --match-95: #689f38;
      --match-90: #f57c00;
      --match-85: #e65100;

      --status-completed: #2e7d32;
      --status-completed-bg: #f1f8f3;
      --status-completed-border: #a5d6a7;
      --status-incorrect: #c62828;
      --status-incorrect-bg: #fdf2f2;
      --status-incorrect-border: #ef9a9a;
      
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
      --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
      --shadow-lg: 0 10px 30px rgba(0,0,0,0.12);
      --radius-sm: 6px;
      --radius-md: 10px;
      --radius-lg: 14px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg-main);
      color: var(--text-main);
      line-height: 1.5;
      padding-bottom: 60px;
    }

    /* Sub Header */
    .tool-header {
      background: rgba(255, 255, 255, 0.98);
      border-bottom: 1px solid var(--border-color);
      box-shadow: var(--shadow-sm);
    }

    .tool-header-content {
      max-width: 1880px;
      margin: 0 auto;
      padding: 12px 24px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .tool-title h1 {
      font-size: 1.22rem;
      font-weight: 700;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .tool-title p {
      font-size: 0.82rem;
      color: var(--text-muted);
    }

    /* Interactive Stats Bar (Pills) */
    .stats-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .stat-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 0.82rem;
      font-weight: 600;
      background: #fdfcfa;
      border: 1px solid var(--border-color);
      color: var(--text-main);
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease-in-out;
    }
    .stat-pill:hover {
      background: #f0ece1;
      border-color: #c9c2b1;
      transform: translateY(-1px);
    }
    .stat-pill.active {
      background: var(--text-main);
      color: #fff;
      border-color: var(--text-main);
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }

    /* Controls Bar */
    .controls-bar {
      background: #fcfbfa;
      border-bottom: 1px solid var(--border-color);
      padding: 10px 24px;
    }

    .controls-inner {
      max-width: 1880px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .search-input {
      padding: 7px 12px 7px 32px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      font-size: 0.88rem;
      width: 260px;
      background: #fff url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="%23888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>') no-repeat 10px center;
      transition: border-color 0.2s, width 0.2s;
    }
    .search-input:focus {
      outline: none;
      border-color: var(--accent);
      width: 300px;
    }

    .btn-filter {
      padding: 5px 11px;
      border: 1px solid var(--border-color);
      background: #fff;
      border-radius: var(--radius-sm);
      font-size: 0.82rem;
      font-weight: 500;
      color: var(--text-main);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-filter:hover {
      background: var(--accent-light);
      border-color: var(--accent);
    }
    .btn-filter.active {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }

    .toggle-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.84rem;
      font-weight: 600;
      color: var(--text-main);
      cursor: pointer;
      user-select: none;
      padding: 5px 10px;
      background: #fff;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      transition: all 0.15s;
    }
    .toggle-checkbox:hover {
      background: var(--accent-light);
      border-color: var(--accent);
    }
    .toggle-checkbox input {
      cursor: pointer;
      accent-color: var(--accent);
      width: 15px;
      height: 15px;
    }
    .toggle-checkbox.checked {
      background: var(--accent-light);
      border-color: var(--accent);
      color: var(--accent);
    }

    /* JSON Actions Bar */
    .json-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-action-primary {
      padding: 6px 13px;
      background: var(--accent);
      color: #fff;
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .btn-action-primary:hover {
      background: var(--accent-hover);
    }

    .btn-action-secondary {
      padding: 6px 12px;
      background: #fff;
      color: var(--text-main);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .btn-action-secondary:hover {
      background: #f4f1ea;
    }

    .tip-box {
      font-size: 0.78rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .tip-box kbd {
      background: #eee;
      border: 1px solid #ccc;
      border-radius: 3px;
      padding: 1px 4px;
      font-size: 0.72rem;
    }

    /* Progress Banner */
    .progress-banner {
      max-width: 1880px;
      margin: 14px auto 0;
      padding: 0 24px;
    }
    .progress-box {
      background: #fff;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      box-shadow: var(--shadow-sm);
    }
    .progress-stats {
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 0.85rem;
    }
    .progress-bar-container {
      flex: 1;
      min-width: 180px;
      height: 8px;
      background: #eee;
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      background: var(--match-100);
      width: 0%;
      transition: width 0.3s ease;
    }

    /* Main Container */
    main {
      max-width: 1880px;
      margin: 18px auto;
      padding: 0 24px;
    }

    /* Comparison Card */
    .comparison-list {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .comparison-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      transition: box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .comparison-card:hover {
      box-shadow: var(--shadow-md);
      border-color: #d1caba;
    }

    .comparison-card.status-completed {
      border-color: var(--status-completed-border);
    }
    .comparison-card.status-completed .card-header {
      background: var(--status-completed-bg);
    }
    .comparison-card.status-incorrect {
      border-color: var(--status-incorrect-border);
    }
    .comparison-card.status-incorrect .card-header {
      background: var(--status-incorrect-bg);
    }

    .card-header {
      padding: 12px 18px;
      background: #faf8f5;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }

    .card-meta {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .card-num {
      background: var(--col-oficiais);
      color: #fff;
      font-size: 0.82rem;
      font-weight: 700;
      padding: 4px 9px;
      border-radius: 4px;
    }

    .card-design-name {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-main);
    }

    .count-badge {
      font-size: 0.76rem;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 12px;
      background: #eee;
      color: #555;
    }

    /* Validation Action Buttons in Card */
    .card-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .btn-status {
      padding: 6px 12px;
      border-radius: var(--radius-sm);
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--border-color);
      background: #fff;
      transition: all 0.15s ease;
      user-select: none;
    }

    .btn-status.btn-concluido:hover {
      background: #e8f5e9;
      border-color: var(--status-completed);
      color: var(--status-completed);
    }
    .btn-status.btn-concluido.active {
      background: var(--status-completed);
      color: #fff;
      border-color: var(--status-completed);
    }

    .btn-status.btn-incorrecto:hover {
      background: #ffebee;
      border-color: var(--status-incorrect);
      color: var(--status-incorrect);
    }
    .btn-status.btn-incorrecto.active {
      background: var(--status-incorrect);
      color: #fff;
      border-color: var(--status-incorrect);
    }

    .btn-status.btn-reset-status {
      padding: 6px 8px;
      color: var(--text-muted);
    }
    .btn-status.btn-reset-status:hover {
      background: #eee;
      color: var(--text-main);
    }

    .card-notes {
      padding: 10px 18px;
      font-size: 0.85rem;
      color: var(--text-muted);
      background: #fff;
      border-bottom: 1px dashed var(--border-color);
      line-height: 1.45;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .user-comment-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 4px;
    }
    .user-notes-input {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      font-size: 0.82rem;
      background: #fafaf8;
      transition: all 0.15s;
    }
    .user-notes-input:focus {
      outline: none;
      background: #fff;
      border-color: var(--accent);
    }

    /* 4 COLUMNS COMPARISON BODY */
    .card-body-4cols {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      padding: 16px;
      background: #faf9f6;
    }

    @media (max-width: 1400px) {
      .card-body-4cols {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 768px) {
      .card-body-4cols {
        grid-template-columns: 1fr;
      }
    }

    .image-panel {
      background: #fff;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-sm);
    }

    .image-panel.panel-oficiais { border-top: 3px solid var(--col-oficiais); }
    .image-panel.panel-argolas { border-top: 3px solid var(--col-argolas); }
    .image-panel.panel-a4 { border-top: 3px solid var(--col-a4); }
    .image-panel.panel-a6 { border-top: 3px solid var(--col-a6); }

    .image-panel-header {
      padding: 8px 12px;
      background: #f4f1ea;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.8rem;
    }

    .panel-label {
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .panel-label.oficiais-label { color: var(--col-oficiais); }
    .panel-label.argolas-label { color: var(--col-argolas); }
    .panel-label.a4-label { color: var(--col-a4); }
    .panel-label.a6-label { color: var(--col-a6); }

    /* Interactive Zoom & Pan Viewport */
    .viewport {
      position: relative;
      height: 380px;
      background: #f0ede6;
      background-image: 
        linear-gradient(45deg, #e7e3db 25%, transparent 25%), 
        linear-gradient(-45deg, #e7e3db 25%, transparent 25%), 
        linear-gradient(45deg, transparent 75%, #e7e3db 75%), 
        linear-gradient(-45deg, transparent 75%, #e7e3db 75%);
      background-size: 20px 20px;
      background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
      overflow: hidden;
      cursor: grab;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .viewport.grabbing { cursor: grabbing; }

    .viewport img {
      max-width: 95%;
      max-height: 95%;
      object-fit: contain;
      transform-origin: 0 0;
      transition: transform 0.04s ease-out;
      pointer-events: none;
      display: block;
    }

    /* Overlay Toolbar on Viewport */
    .viewport-tools {
      position: absolute;
      bottom: 8px;
      right: 8px;
      display: flex;
      align-items: center;
      gap: 3px;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(4px);
      padding: 3px 5px;
      border-radius: var(--radius-sm);
      border: 1px solid rgba(0,0,0,0.12);
      box-shadow: var(--shadow-sm);
      z-index: 10;
    }

    .tool-btn {
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 0.82rem;
      font-weight: 700;
      color: #444;
      cursor: pointer;
      transition: all 0.15s;
    }
    .tool-btn:hover {
      background: var(--accent-light);
      color: var(--accent);
      border-color: var(--accent);
    }

    .zoom-badge {
      font-size: 0.7rem;
      font-family: monospace;
      font-weight: 600;
      color: #555;
      padding: 0 3px;
      min-width: 38px;
      text-align: center;
    }

    /* Thumbnail Carousel / Variant Switcher */
    .variants-bar {
      padding: 8px;
      background: #fff;
      border-top: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: thin;
    }

    .thumb-item {
      position: relative;
      flex-shrink: 0;
      width: 54px;
      height: 54px;
      border: 2px solid #ddd;
      border-radius: var(--radius-sm);
      overflow: hidden;
      cursor: pointer;
      background: #fbf9f5;
      transition: all 0.15s;
    }
    .thumb-item:hover {
      border-color: var(--accent);
      transform: scale(1.05);
    }
    .thumb-item.active {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px var(--accent);
    }
    .thumb-item img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .thumb-badge {
      position: absolute;
      bottom: 1px;
      right: 1px;
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      font-size: 0.6rem;
      font-weight: 700;
      padding: 1px 3px;
      border-radius: 2px;
    }

    .variant-caption {
      padding: 6px 10px;
      font-size: 0.75rem;
      color: var(--text-muted);
      background: #fdfcfa;
      border-top: 1px solid #eee;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Modal Fullscreen Inspect */
    .modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: 1000;
      flex-direction: column;
    }
    .modal.active { display: flex; }

    .modal-header {
      padding: 14px 24px;
      background: rgba(20, 20, 20, 0.95);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #333;
    }

    .modal-title {
      font-size: 1.1rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .modal-close {
      background: transparent;
      border: 1px solid #555;
      color: #fff;
      font-size: 1.2rem;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }
    .modal-close:hover {
      background: #e65100;
      border-color: #e65100;
    }

    .modal-body-4cols {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      padding: 16px;
      overflow: hidden;
    }

    .modal-viewport-container {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #1e1e1e;
      border-radius: var(--radius-md);
      overflow: hidden;
    }

    .modal-viewport-header {
      padding: 8px 12px;
      background: #2a2a2a;
      color: #ddd;
      font-size: 0.82rem;
      display: flex;
      justify-content: space-between;
    }

    .modal-viewport {
      flex: 1;
      height: calc(100vh - 140px);
      background: #141414;
    }

    /* Notification Toast */
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #2d312e;
      color: #fff;
      padding: 10px 20px;
      border-radius: 30px;
      font-size: 0.88rem;
      font-weight: 600;
      box-shadow: var(--shadow-lg);
      z-index: 2000;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .toast.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }

    /* Scroll to top button */
    .scroll-top {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--accent);
      color: #fff;
      border: none;
      box-shadow: var(--shadow-md);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      transition: all 0.2s;
      opacity: 0;
      pointer-events: none;
      z-index: 90;
    }
    .scroll-top.visible { opacity: 1; pointer-events: auto; }
    .scroll-top:hover {
      background: var(--accent-hover);
      transform: translateY(-2px);
    }
  </style>
</head>
<body>

  <!-- Hidden File Input for JSON Import -->
  <input type="file" id="jsonFileInput" accept=".json" style="display: none;">

  <!-- Header -->
  <div class="tool-header">
    <div class="tool-header-content">
      <div class="tool-title">
        <h1>🔍 Comparador Oficial de Argolas (15 Designs)</h1>
        <p>[1. Foto OFICIAL (Index)] ↔ [2. Grelha ARGOLAS &ge;80%] ↔ [3. SITE A4 Variantes] ↔ [4. SITE A6 Variantes]</p>
      </div>

      <!-- Stats Bar -->
      <div class="stats-bar" id="statsBar">
        <!-- Rendered by JS -->
      </div>
    </div>
  </div>

  <!-- Controls Bar -->
  <div class="controls-bar">
    <div class="controls-inner">
      <div class="filter-group">
        <input type="text" id="searchInput" class="search-input" placeholder="Pesquisar design, tema ou versículo...">
        
        <button class="btn-filter active" data-filter-type="status" data-value="all">Todos (15)</button>
        <button class="btn-filter" data-filter-type="status" data-value="pending">Só Pendentes</button>
        <button class="btn-filter" data-filter-type="status" data-value="completed">Só Concluídos</button>
        <button class="btn-filter" data-filter-type="status" data-value="incorrect">Só Incorretos</button>

        <span style="color: #ccc; margin: 0 4px;">|</span>

        <label class="toggle-checkbox" id="hideCompletedToggle" title="Ocultar designs já marcados como Concluídos">
          <input type="checkbox" id="hideCompletedCheckbox">
          <span>Esconder Concluídos</span>
        </label>
      </div>

      <div class="filter-group">
        <label class="toggle-checkbox checked" title="Sincroniza o movimento de zoom e pan entre as 4 colunas">
          <input type="checkbox" id="syncPanZoom" checked>
          <span>Sincronizar Zoom & Pan (4 Vistas)</span>
        </label>
        
        <button class="btn-filter" id="resetAllZoomBtn" title="Repor zoom de todas as imagens">⟲ Reset Zoom</button>

        <div class="json-actions">
          <button class="btn-action-primary" id="saveServerBtn" title="Gravar alterações diretamente no servidor PHP (content/comparador-validacoes.json)">
            💾 Gravar no Servidor
          </button>
          <button class="btn-action-secondary" id="exportJsonBtn" title="Descarregar cópia do ficheiro JSON">
            ⬇️ Descarregar JSON
          </button>
          <button class="btn-action-secondary" id="importJsonBtn" title="Carregar um ficheiro JSON anteriormente guardado">
            📂 Importar JSON
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Progress Banner -->
  <div class="progress-banner">
    <div class="progress-box">
      <div class="progress-stats">
        <span>Progresso dos 15 Designs: <strong id="progReviewedCount">0</strong> / <strong>15</strong></span>
        <span style="color: var(--status-completed); font-weight: 600;">✓ Concluídos: <span id="progCompletedCount">0</span></span>
        <span style="color: var(--status-incorrect); font-weight: 600;">✗ Incorretos: <span id="progIncorrectCount">0</span></span>
        <span style="color: var(--text-muted);">⏳ Pendentes: <span id="progPendingCount">15</span></span>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar-fill" id="progressBarFill"></div>
      </div>
      <div class="tip-box">
        <span>💡 Arraste para <strong>Pan</strong> &bull; <kbd>Ctrl</kbd> + Scroll = <strong>Zoom</strong> nas 4 vistas</span>
      </div>
    </div>
  </div>

  <!-- Main Container -->
  <main>
    <div class="comparison-list" id="comparisonList">
      <!-- Items rendered dynamically -->
    </div>
  </main>

  <!-- Fullscreen Modal -->
  <div class="modal" id="inspectModal">
    <div class="modal-header">
      <div class="modal-title" id="modalTitle">Inspeção Detalhada 1:1 (4 Colunas)</div>
      <button class="modal-close" id="modalCloseBtn">&times;</button>
    </div>
    <div class="modal-body-4cols" id="modalBody"></div>
  </div>

  <!-- Notification Toast -->
  <div class="toast" id="toastMessage">Ficheiro guardado com sucesso!</div>

  <!-- Scroll Top Button -->
  <button class="scroll-top" id="scrollTopBtn" title="Voltar ao topo">↑</button>

  <script>
    let itemsData = [
  {
    "id": 1,
    "design": "Lavanda (2 Timóteo 4:5)",
    "oficial": {
      "file": "../content/argolas/oficiais/photo_1_2026-08-31_11-41-01.jpg",
      "name": "photo_1_2026-08-31_11-41-01.jpg",
      "notes": "Flores de lavanda na base e caligrafia 'Realiza plenamente o teu ministério 2 Timóteo 4:5'."
    },
    "argolas": [
      {
        "file": "../content/argolas/image-gen-1(17).png",
        "name": "image-gen-1(17).png",
        "match": 100,
        "notes": "Arte 100% fiel de Lavanda com flores na base e texto oficial 2 Timóteo 4:5."
      }
    ],
    "a4_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/lavanda-dourado.webp",
        "name": "catalog/lavanda-dourado.webp",
        "label": "Catálogo · Dourado Frente",
        "variant": "Dourado"
      }
    ],
    "a6_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a6/a6-07.webp",
        "name": "a6/a6-07.webp",
        "label": "A6 · Argolas Rosa Metálico",
        "variant": "Argolas Rosa"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a6/a6-08.webp",
        "name": "a6/a6-08.webp",
        "label": "A6 · Argolas Douradas",
        "variant": "Argolas Douradas"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/lavanda-dourado.webp",
        "name": "catalog/lavanda-dourado.webp",
        "label": "Catálogo · Dourado Frente",
        "variant": "Dourado Frente"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/lavanda-rosa-frente.webp",
        "name": "catalog/lavanda-rosa-frente.webp",
        "label": "Catálogo · Rosa Frente",
        "variant": "Rosa Frente"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/lavanda-rosa-angulo.webp",
        "name": "catalog/lavanda-rosa-angulo.webp",
        "label": "Catálogo · Rosa Ângulo",
        "variant": "Rosa Ângulo"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/lavanda-rosa-aberto.webp",
        "name": "catalog/lavanda-rosa-aberto.webp",
        "label": "Catálogo · Aberto Interior",
        "variant": "Aberto"
      }
    ],
    "status": "pending",
    "user_notes": ""
  },
  {
    "id": 2,
    "design": "Agenda Rosa (2 Timóteo 4:5)",
    "oficial": {
      "file": "../content/argolas/oficiais/photo_2_2026-08-31_11-41-01.jpg",
      "name": "photo_2_2026-08-31_11-41-01.jpg",
      "notes": "Mala rosa, caneca com coração, batom, perfume, livro cinzento e 'Realiza plenamente o teu ministério'."
    },
    "argolas": [
      {
        "file": "../content/argolas/Realiza Plenamente o Teu Minist_rio(20260805-204221).png",
        "name": "Realiza Plenamente o Teu Ministério(20260805-204221).png",
        "match": 100,
        "notes": "Arte 100% idêntica da Agenda Rosa com todos os acessórios femininos."
      },
      {
        "file": "../content/argolas/Realiza Plenamente o Teu Minist_rio(20260805-204637).png",
        "name": "Realiza Plenamente o Teu Ministério(20260805-204637).png",
        "match": 100,
        "notes": "Segunda versão de alta resolução da Agenda Rosa."
      }
    ],
    "a4_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a4/a4-02.webp",
        "name": "a4/a4-02.webp",
        "label": "A4 · Argolas Douradas",
        "variant": "Argolas Douradas"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a4/a4-07.webp",
        "name": "a4/a4-07.webp",
        "label": "A4 · Argolas Rosa Metálico",
        "variant": "Argolas Rosa"
      }
    ],
    "a6_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a6/a6-02.webp",
        "name": "a6/a6-02.webp",
        "label": "A6 · Argolas Rosa Metálico",
        "variant": "Argolas Rosa"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a6/a6-06.webp",
        "name": "a6/a6-06.webp",
        "label": "A6 · Argolas Douradas",
        "variant": "Argolas Douradas"
      }
    ],
    "status": "pending",
    "user_notes": ""
  },
  {
    "id": 3,
    "design": "Caminho de Flores (2 Timóteo 4:2)",
    "oficial": {
      "file": "../content/argolas/oficiais/photo_3_2026-08-31_11-41-01.jpg",
      "name": "photo_3_2026-08-31_11-41-01.jpg",
      "notes": "Caminho de flores bucólico com mala pousada e texto 'Prega a palavra 2 Timóteo 4:2'."
    },
    "argolas": [
      {
        "file": "../content/argolas/Capa pastoral em aguarela_ prega a palavra.png",
        "name": "Capa pastoral em aguarela_ prega a palavra.png",
        "match": 100,
        "notes": "Arte 100% idêntica com mala e texto 'Prega a Palavra'."
      },
      {
        "file": "../content/argolas/Caminho Florido at_ _ Aldeia(2).png",
        "name": "Caminho Florido até à Aldeia(2).png",
        "match": 95,
        "notes": "Variante da paisagem floral."
      },
      {
        "file": "../content/argolas/Caminho Florido rumo _ Aldeia(1).png",
        "name": "Caminho Florido rumo à Aldeia(1).png",
        "match": 90,
        "notes": "Variante de luz matinal."
      },
      {
        "file": "../content/argolas/Caminho Florido sob o C_u Azul.png",
        "name": "Caminho Florido sob o Céu Azul.png",
        "match": 90,
        "notes": "Variante com céu azul aberto."
      }
    ],
    "a4_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a4/a4-05.webp",
        "name": "a4/a4-05.webp",
        "label": "A4 · Argolas Douradas",
        "variant": "Argolas Douradas"
      }
    ],
    "a6_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a6/a6-05.webp",
        "name": "a6/a6-05.webp",
        "label": "A6 · Argolas Rosa Metálico",
        "variant": "Argolas Rosa"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a6/a6-12.webp",
        "name": "a6/a6-12.webp",
        "label": "A6 · Argolas Douradas",
        "variant": "Argolas Douradas"
      }
    ],
    "status": "pending",
    "user_notes": ""
  },
  {
    "id": 4,
    "design": "Bicicleta Rosa (Romanos 10:15)",
    "oficial": {
      "file": "../content/argolas/oficiais/photo_4_2026-08-31_11-41-01.jpg",
      "name": "photo_4_2026-08-31_11-41-01.jpg",
      "notes": "Bicicleta verde-água com peónias rosa, cestinho de vime e mala bege pendurada."
    },
    "argolas": [
      {
        "file": "../content/argolas/Flores e Boas Novas no Campo.png",
        "name": "Flores e Boas Novas no Campo.png",
        "match": 100,
        "notes": "Arte 100% idêntica com bicicleta e flores rosa."
      },
      {
        "file": "../content/argolas/Flores e Boas Novas no Campo (1).png",
        "name": "Flores e Boas Novas no Campo (1).png",
        "match": 100,
        "notes": "Duplicado de alta resolução."
      }
    ],
    "a4_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a4/a4-03.webp",
        "name": "a4/a4-03.webp",
        "label": "A4 · Argolas Rosa Metálico",
        "variant": "Argolas Rosa"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a4/a4-10.webp",
        "name": "a4/a4-10.webp",
        "label": "A4 · Argolas Douradas",
        "variant": "Argolas Douradas"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/bicicleta-rosa-rosa-metalico.webp",
        "name": "catalog/bicicleta-rosa-rosa-metalico.webp",
        "label": "Catálogo · Rosa Metálico",
        "variant": "Rosa Metálico"
      }
    ],
    "a6_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a6/a6-11.webp",
        "name": "a6/a6-11.webp",
        "label": "A6 · Argolas Douradas",
        "variant": "Argolas Douradas"
      }
    ],
    "status": "pending",
    "user_notes": ""
  },
  {
    "id": 5,
    "design": "Bicicleta Azul (Romanos 10:15)",
    "oficial": {
      "file": "../content/argolas/oficiais/photo_5_2026-08-31_11-41-01.jpg",
      "name": "photo_5_2026-08-31_11-41-01.jpg",
      "notes": "Bicicleta azul com hortênsias azuis e peónias brancas no cesto."
    },
    "argolas": [
      {
        "file": "../content/argolas/Capa primaveril da Escola de Pioneiros.png",
        "name": "Capa primaveril da Escola de Pioneiros.png",
        "match": 100,
        "notes": "Arte 100% idêntica com bicicleta azul e borboleta."
      },
      {
        "file": "../content/argolas/Capa primaveril da Escola de Pioneiros (1).png",
        "name": "Capa primaveril da Escola de Pioneiros (1).png",
        "match": 100,
        "notes": "Duplicado de alta resolução."
      }
    ],
    "a4_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a4/a4-09.webp",
        "name": "a4/a4-09.webp",
        "label": "A4 · Argolas Rosa Metálico",
        "variant": "Argolas Rosa"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a4/a4-11.webp",
        "name": "a4/a4-11.webp",
        "label": "A4 · Argolas Douradas",
        "variant": "Argolas Douradas"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/bicicleta-rosa-dourado.webp",
        "name": "catalog/bicicleta-rosa-dourado.webp",
        "label": "Catálogo · Dourado",
        "variant": "Dourado"
      }
    ],
    "a6_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a6/a6-04.webp",
        "name": "a6/a6-04.webp",
        "label": "A6 · Argolas Rosa Metálico",
        "variant": "Argolas Rosa"
      }
    ],
    "status": "pending",
    "user_notes": ""
  },
  {
    "id": 6,
    "design": "Declara Boas Novas no Campo",
    "oficial": {
      "file": "../content/argolas/oficiais/photo_6_2026-08-31_11-41-01.jpg",
      "name": "photo_6_2026-08-31_11-41-01.jpg",
      "notes": "Bicicleta com alforge de publicações no campo florido e cerca de madeira."
    },
    "argolas": [
      {
        "file": "../content/argolas/Declara Boas Novas no Campo.png",
        "name": "Declara Boas Novas no Campo.png",
        "match": 100,
        "notes": "Arte 100% idêntica com texto e paisagem completa."
      },
      {
        "file": "../content/argolas/texto_mais_a_esquerda_warp.png",
        "name": "texto_mais_a_esquerda_warp.png",
        "match": 100,
        "notes": "Versão com texto curvado alinhado."
      },
      {
        "file": "../content/argolas/Declara as Boas Novas_ Jardim em Aguarela.png",
        "name": "Declara as Boas Novas_ Jardim em Aguarela.png",
        "match": 95,
        "notes": "Variante em aguarela suave."
      }
    ],
    "a4_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a4/a4-04.webp",
        "name": "a4/a4-04.webp",
        "label": "A4 · Argolas Douradas",
        "variant": "Argolas Douradas"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/declara-campo-colorido-dourado.webp",
        "name": "catalog/declara-campo-colorido-dourado.webp",
        "label": "Catálogo · Dourado",
        "variant": "Dourado"
      }
    ],
    "a6_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/declara-campo-colorido-dourado.webp",
        "name": "catalog/declara-campo-colorido-dourado.webp",
        "label": "Catálogo · Dourado",
        "variant": "Dourado"
      }
    ],
    "status": "pending",
    "user_notes": ""
  },
  {
    "id": 7,
    "design": "Quão Lindos São os Pés · Campo Colorido",
    "oficial": {
      "file": "../content/argolas/oficiais/photo_7_2026-08-31_11-41-01.jpg",
      "name": "photo_7_2026-08-31_11-41-01.jpg",
      "notes": "Rapariga de saia turquesa, mala bordada com flores no campo e texto completo de Romanos 10:15."
    },
    "argolas": [
      {
        "file": "../content/argolas/Escola de Pioneiros_ Amanhecer no Vale.png",
        "name": "Escola de Pioneiros_ Amanhecer no Vale.png",
        "match": 85,
        "notes": "Arte conceptual de amanhecer no vale para a mesma série."
      }
    ],
    "a4_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a4/a4-08.webp",
        "name": "a4/a4-08.webp",
        "label": "A4 · Argolas Douradas",
        "variant": "Argolas Douradas"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/quao-campo-colorido-dourado.webp",
        "name": "catalog/quao-campo-colorido-dourado.webp",
        "label": "Catálogo · Dourado",
        "variant": "Dourado"
      }
    ],
    "a6_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/quao-campo-colorido-dourado.webp",
        "name": "catalog/quao-campo-colorido-dourado.webp",
        "label": "Catálogo · Dourado",
        "variant": "Dourado"
      }
    ],
    "status": "pending",
    "user_notes": ""
  },
  {
    "id": 8,
    "design": "Quão Lindos São os Pés · Variante Lilás",
    "oficial": {
      "file": "../content/argolas/oficiais/photo_8_2026-08-31_11-41-01.jpg",
      "name": "photo_8_2026-08-31_11-41-01.jpg",
      "notes": "Variante de catálogo com vestido de flores lilás e xaile roxo."
    },
    "argolas": [
      {
        "file": "../content/argolas/P_s floridos no caminho luminoso.png",
        "name": "Pés floridos no caminho luminoso.png",
        "match": 90,
        "notes": "Caminho florido luminoso."
      },
      {
        "file": "../content/argolas/Caminho das Boas Novas.png",
        "name": "Caminho das Boas Novas.png",
        "match": 90,
        "notes": "Caminho das boas novas."
      }
    ],
    "a4_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a4/a4-08.webp",
        "name": "a4/a4-08.webp",
        "label": "A4 · Argolas Douradas",
        "variant": "Argolas Douradas"
      }
    ],
    "a6_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/quao-campo-colorido-dourado.webp",
        "name": "catalog/quao-campo-colorido-dourado.webp",
        "label": "Catálogo · Dourado",
        "variant": "Dourado"
      }
    ],
    "status": "pending",
    "user_notes": ""
  },
  {
    "id": 9,
    "design": "Passeio / Quão Lindos São os Pés",
    "oficial": {
      "file": "../content/argolas/oficiais/photo_9_2026-08-31_11-41-01.jpg",
      "name": "photo_9_2026-08-31_11-41-01.jpg",
      "notes": "Rapariga de costas com vestido floral bege, xaile verde e borboleta laranja."
    },
    "argolas": [
      {
        "file": "../content/argolas/Caminho Dourado dos Pioneiros(1).png",
        "name": "Caminho Dourado dos Pioneiros(1).png",
        "match": 100,
        "notes": "Arte 100% idêntica de Passeio."
      },
      {
        "file": "../content/argolas/Caminho Dourado para 2026.png",
        "name": "Caminho Dourado para 2026.png",
        "match": 100,
        "notes": "Versão com 2026."
      }
    ],
    "a4_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a4/a4-01.webp",
        "name": "a4/a4-01.webp",
        "label": "A4 · Argolas Douradas",
        "variant": "Argolas Douradas"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/passeio-dourado.webp",
        "name": "catalog/passeio-dourado.webp",
        "label": "Catálogo · Dourado",
        "variant": "Dourado"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/pack-a4-a6.webp",
        "name": "pack-a4-a6.webp",
        "label": "Pack A4 + A6 (Esquerda)",
        "variant": "Pack A4"
      }
    ],
    "a6_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/passeio-dourado.webp",
        "name": "catalog/passeio-dourado.webp",
        "label": "Catálogo · Dourado",
        "variant": "Dourado"
      }
    ],
    "status": "pending",
    "user_notes": ""
  },
  {
    "id": 10,
    "design": "Castanho Masculino (2 Timóteo 4:5)",
    "oficial": {
      "file": "../content/argolas/oficiais/photo_10_2026-08-31_11-41-01.jpg",
      "name": "photo_10_2026-08-31_11-41-01.jpg",
      "notes": "Kit masculino clássico: chapéu cinzento, mala castanha, livro e sapatos de pele."
    },
    "argolas": [
      {
        "file": "../content/argolas/Realiza Plenamente o Teu Minist_rio(20260816-141151).png",
        "name": "Realiza Plenamente o Teu Ministério(20260816-141151).png",
        "match": 100,
        "notes": "Arte 100% com chapéu, mala, livro cinzento e sapatos de pele."
      },
      {
        "file": "../content/argolas/Realiza Plenamente o Teu Minist_rio(20260816-141200).png",
        "name": "Realiza Plenamente o Teu Ministério(20260816-141200).png",
        "match": 100,
        "notes": "Variante com manta por baixo do chapéu."
      },
      {
        "file": "../content/argolas/Realiza Plenamente o Teu Minist_rio(20260816-141410).png",
        "name": "Realiza Plenamente o Teu Ministério(20260816-141410).png",
        "match": 100,
        "notes": "Variante 141410 em alta definição."
      },
      {
        "file": "../content/argolas/Realiza Plenamente o Teu Minist_rio(16).png",
        "name": "Realiza Plenamente o Teu Ministério(16).png",
        "match": 95,
        "notes": "Variante com mala de couro vertical e livros."
      },
      {
        "file": "../content/argolas/{_title___Declara Boas Novas_}.png",
        "name": "{_title___Declara Boas Novas_}.png",
        "match": 95,
        "notes": "Mala de couro aberta com 4 livros do ministério."
      },
      {
        "file": "../content/argolas/{_title___Realiza plenamente o teu minist_rio_}.png",
        "name": "{_title___Realiza plenamente o teu ministério_}.png",
        "match": 95,
        "notes": "Mala de couro aberta com livros de estudo."
      }
    ],
    "a4_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a4/a4-06.webp",
        "name": "a4/a4-06.webp",
        "label": "A4 · Argolas Rosa Metálico",
        "variant": "Argolas Rosa"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/castanho-rosa-metalico.webp",
        "name": "catalog/castanho-rosa-metalico.webp",
        "label": "Catálogo · Rosa Metálico",
        "variant": "Rosa Metálico"
      }
    ],
    "a6_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/castanho-rosa-metalico.webp",
        "name": "catalog/castanho-rosa-metalico.webp",
        "label": "Catálogo · Rosa Metálico",
        "variant": "Rosa Metálico"
      }
    ],
    "status": "pending",
    "user_notes": ""
  },
  {
    "id": 11,
    "design": "Sapatos Feminino / Chapéu de Palha",
    "oficial": {
      "file": "../content/argolas/oficiais/photo_11_2026-08-31_11-41-01.jpg",
      "name": "photo_11_2026-08-31_11-41-01.jpg",
      "notes": "Chapéu de palha com laço, mala bege com argola dourada e sapatos com laço."
    },
    "argolas": [
      {
        "file": "../content/argolas/oficiais/photo_11_2026-08-31_11-41-01.jpg",
        "name": "photo_11 (Oficial / Arte Direta)",
        "match": 100,
        "notes": "Arte direta oficial (sem versão bruta isolada na raiz)."
      }
    ],
    "a4_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/sapatos-dourado.webp",
        "name": "catalog/sapatos-dourado.webp",
        "label": "Catálogo · Dourado",
        "variant": "Dourado"
      }
    ],
    "a6_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a6/a6-09.webp",
        "name": "a6/a6-09.webp",
        "label": "A6 · Argolas Rosa Metálico",
        "variant": "Argolas Rosa"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/sapatos-dourado.webp",
        "name": "catalog/sapatos-dourado.webp",
        "label": "Catálogo · Dourado Frente",
        "variant": "Dourado Frente"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/sapatos-rosa-metalico.webp",
        "name": "catalog/sapatos-rosa-metalico.webp",
        "label": "Catálogo · Rosa Metálico",
        "variant": "Rosa Metálico"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/sapatos-rosa-aberto.webp",
        "name": "catalog/sapatos-rosa-aberto.webp",
        "label": "Catálogo · Aberto Interior",
        "variant": "Aberto"
      }
    ],
    "status": "pending",
    "user_notes": ""
  },
  {
    "id": 12,
    "design": "Sapatos Feminino · Variante Manta",
    "oficial": {
      "file": "../content/argolas/oficiais/photo_12_2026-08-31_11-41-01.jpg",
      "name": "photo_12_2026-08-31_11-41-01.jpg",
      "notes": "Variante oficial com mala estruturada e manta/écharpe rosa."
    },
    "argolas": [
      {
        "file": "../content/argolas/oficiais/photo_12_2026-08-31_11-41-01.jpg",
        "name": "photo_12 (Oficial / Arte Direta)",
        "match": 100,
        "notes": "Arte direta oficial (sem versão bruta isolada na raiz)."
      }
    ],
    "a4_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/sapatos-dourado.webp",
        "name": "catalog/sapatos-dourado.webp",
        "label": "Catálogo · Dourado",
        "variant": "Dourado"
      }
    ],
    "a6_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a6/a6-09.webp",
        "name": "a6/a6-09.webp",
        "label": "A6 · Argolas Rosa Metálico",
        "variant": "Argolas Rosa"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/sapatos-rosa-metalico.webp",
        "name": "catalog/sapatos-rosa-metalico.webp",
        "label": "Catálogo · Rosa Metálico",
        "variant": "Rosa Metálico"
      }
    ],
    "status": "pending",
    "user_notes": ""
  },
  {
    "id": 13,
    "design": "Flores Salmão",
    "oficial": {
      "file": "../content/argolas/oficiais/photo_13_2026-08-31_11-41-01.jpg",
      "name": "photo_13_2026-08-31_11-41-01.jpg",
      "notes": "Rosas salmão/pêssego em aguarela na base e texto oficial com aspas."
    },
    "argolas": [
      {
        "file": "../content/argolas/oficiais/photo_13_2026-08-31_11-41-01.jpg",
        "name": "photo_13 (Oficial / Arte Direta)",
        "match": 100,
        "notes": "Arte direta oficial das Rosas Salmão."
      }
    ],
    "a4_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/flores-salmao-dourado.webp",
        "name": "catalog/flores-salmao-dourado.webp",
        "label": "Catálogo · Dourado",
        "variant": "Dourado"
      }
    ],
    "a6_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a6/a6-03.webp",
        "name": "a6/a6-03.webp",
        "label": "A6 · Argolas Rosa Metálico",
        "variant": "Argolas Rosa"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/flores-salmao-dourado.webp",
        "name": "catalog/flores-salmao-dourado.webp",
        "label": "Catálogo · Dourado Frente",
        "variant": "Dourado Frente"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/flores-salmao-rosa-frente.webp",
        "name": "catalog/flores-salmao-rosa-frente.webp",
        "label": "Catálogo · Rosa Frente",
        "variant": "Rosa Frente"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/flores-salmao-rosa-aberto.webp",
        "name": "catalog/flores-salmao-rosa-aberto.webp",
        "label": "Catálogo · Aberto Interior",
        "variant": "Aberto"
      }
    ],
    "status": "pending",
    "user_notes": ""
  },
  {
    "id": 14,
    "design": "Folhagem Azul",
    "oficial": {
      "file": "../content/argolas/oficiais/photo_14_2026-08-31_11-41-01.jpg",
      "name": "photo_14_2026-08-31_11-41-01.jpg",
      "notes": "Espigas de lavanda e folhagem de eucalipto azul/verde sobre fundo branco."
    },
    "argolas": [
      {
        "file": "../content/argolas/oficiais/photo_14_2026-08-31_11-41-01.jpg",
        "name": "photo_14 (Oficial / Arte Direta)",
        "match": 100,
        "notes": "Arte direta oficial de Folhagem Azul."
      }
    ],
    "a4_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/folhagem-azul-dourado.webp",
        "name": "catalog/folhagem-azul-dourado.webp",
        "label": "Catálogo · Dourado",
        "variant": "Dourado"
      }
    ],
    "a6_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a6/a6-10.webp",
        "name": "a6/a6-10.webp",
        "label": "A6 · Argolas Douradas",
        "variant": "Argolas Douradas"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/folhagem-azul-dourado.webp",
        "name": "catalog/folhagem-azul-dourado.webp",
        "label": "Catálogo · Dourado Frente",
        "variant": "Dourado Frente"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/folhagem-azul-rosa-frente.webp",
        "name": "catalog/folhagem-azul-rosa-frente.webp",
        "label": "Catálogo · Rosa Frente",
        "variant": "Rosa Frente"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/folhagem-azul-rosa-aberto.webp",
        "name": "catalog/folhagem-azul-rosa-aberto.webp",
        "label": "Catálogo · Aberto Interior",
        "variant": "Aberto"
      }
    ],
    "status": "pending",
    "user_notes": ""
  },
  {
    "id": 15,
    "design": "Flores Vermelhas",
    "oficial": {
      "file": "../content/argolas/oficiais/photo_15_2026-08-31_11-41-02.jpg",
      "name": "photo_15_2026-08-31_11-41-02.jpg",
      "notes": "Papoilas vermelhas e cosmos rosa na base sobre fundo branco."
    },
    "argolas": [
      {
        "file": "../content/argolas/Poster Inspiracional com Flores em Aguarela.png",
        "name": "Poster Inspiracional com Flores em Aguarela.png",
        "match": 100,
        "notes": "Arte 100% com papoilas e flores vermelhas na base."
      }
    ],
    "a4_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/flores-vermelhas-dourado.webp",
        "name": "catalog/flores-vermelhas-dourado.webp",
        "label": "Catálogo · Dourado",
        "variant": "Dourado"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/pack-a4-a6.webp",
        "name": "pack-a4-a6.webp",
        "label": "Pack A4 + A6 (Direita)",
        "variant": "Pack A6"
      }
    ],
    "a6_mockups": [
      {
        "file": "../content/designs/loja/pasta-de-folhetos/a6/a6-01.webp",
        "name": "a6/a6-01.webp",
        "label": "A6 · Argolas Rosa Metálico",
        "variant": "Argolas Rosa"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/flores-vermelhas-dourado.webp",
        "name": "catalog/flores-vermelhas-dourado.webp",
        "label": "Catálogo · Dourado Frente",
        "variant": "Dourado Frente"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/flores-vermelhas-rosa-frente.webp",
        "name": "catalog/flores-vermelhas-rosa-frente.webp",
        "label": "Catálogo · Rosa Frente",
        "variant": "Rosa Frente"
      },
      {
        "file": "../content/designs/loja/pasta-de-folhetos/catalog/flores-vermelhas-rosa-angulo.webp",
        "name": "catalog/flores-vermelhas-rosa-angulo.webp",
        "label": "Catálogo · Rosa Ângulo",
        "variant": "Rosa Ângulo"
      }
    ],
    "status": "pending",
    "user_notes": ""
  }
];

    let activeStatusFilter = 'all';
    let hideCompleted = false;
    let searchQuery = '';
    let syncEnabled = true;

    // Track active selected image index per column per design
    // activeIndices: { [designId]: { oficial: 0, argola: 0, a4: 0, a6: 0 } }
    const activeIndices = {};

    const LOCAL_STORAGE_KEY = 'mia_argolas_oficiais_15_v1';
    const viewports = new Map();

    async function init() {
      // Init active indices defaults
      itemsData.forEach(d => {
        activeIndices[d.id] = { oficial: 0, argola: 0, a4: 0, a6: 0 };
      });

      await loadValidationData();
      renderStatsPills();
      updateProgressDisplay();
      renderItems();
      setupEventListeners();
    }

    async function loadValidationData() {
      try {
        const res = await fetch('../content/comparador-validacoes.json?t=' + Date.now());
        if (res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.items)) {
            mergeLoadedItems(json.items);
            return;
          }
        }
      } catch (e) {}

      const savedLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedLocal) {
        try {
          const parsed = JSON.parse(savedLocal);
          if (parsed && Array.isArray(parsed.items)) {
            mergeLoadedItems(parsed.items);
          }
        } catch (e) {}
      }
    }

    function mergeLoadedItems(loadedItems) {
      const map = new Map(loadedItems.map(i => [i.id, i]));
      itemsData.forEach(item => {
        const loaded = map.get(item.id);
        if (loaded) {
          if (loaded.status) item.status = loaded.status;
          if (loaded.user_notes !== undefined) item.user_notes = loaded.user_notes;
        }
      });
    }

    async function saveState(saveToServer = false) {
      const completedCount = itemsData.filter(i => i.status === 'completed').length;
      const incorrectCount = itemsData.filter(i => i.status === 'incorrect').length;
      const pendingCount = itemsData.filter(i => i.status === 'pending' || !i.status).length;

      const payload = {
        updated_at: new Date().toISOString(),
        total_designs: itemsData.length,
        stats: {
          completed: completedCount,
          incorrect: incorrectCount,
          pending: pendingCount
        },
        items: itemsData
      };

      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
      } catch (e) {}

      updateProgressDisplay();
      renderStatsPills();

      if (saveToServer) {
        try {
          const res = await fetch('comparador-argolas.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            showToast('💾 Gravado no servidor com sucesso!');
          } else {
            showToast('⚠️ Erro ao gravar no servidor.');
          }
        } catch (e) {
          showToast('⚠️ Guardado no browser (offline).');
        }
      }
    }

    function showToast(msg) {
      const toast = document.getElementById('toastMessage');
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => { toast.classList.remove('show'); }, 2500);
    }

    function updateProgressDisplay() {
      const completed = itemsData.filter(i => i.status === 'completed').length;
      const incorrect = itemsData.filter(i => i.status === 'incorrect').length;
      const pending = itemsData.filter(i => i.status === 'pending' || !i.status).length;
      const reviewed = completed + incorrect;
      const total = itemsData.length;

      document.getElementById('progReviewedCount').textContent = reviewed;
      document.getElementById('progCompletedCount').textContent = completed;
      document.getElementById('progIncorrectCount').textContent = incorrect;
      document.getElementById('progPendingCount').textContent = pending;

      const pct = total > 0 ? (reviewed / total) * 100 : 0;
      document.getElementById('progressBarFill').style.width = `${pct}%`;
    }

    function renderStatsPills() {
      const statsBar = document.getElementById('statsBar');
      const counts = { total: itemsData.length, pending: 0, completed: 0, incorrect: 0 };
      
      itemsData.forEach(d => {
        const s = d.status || 'pending';
        if (counts[s] !== undefined) counts[s]++;
      });

      statsBar.innerHTML = `
        <button class="stat-pill ${activeStatusFilter === 'all' ? 'active' : ''}" data-status="all">
          Total: <strong>${counts.total}</strong> designs oficiais
        </button>
        <button class="stat-pill ${activeStatusFilter === 'pending' ? 'active' : ''}" data-status="pending" style="color: #666;">
          ⏳ Pendentes (${counts.pending})
        </button>
        <button class="stat-pill ${activeStatusFilter === 'completed' ? 'active' : ''}" data-status="completed" style="color: var(--status-completed);">
          ✓ Concluídos (${counts.completed})
        </button>
        <button class="stat-pill ${activeStatusFilter === 'incorrect' ? 'active' : ''}" data-status="incorrect" style="color: var(--status-incorrect);">
          ✗ Incorretos (${counts.incorrect})
        </button>
      `;

      statsBar.querySelectorAll('.stat-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          activeStatusFilter = pill.getAttribute('data-status');
          renderStatsPills();
          renderItems();
        });
      });
    }

    function renderItems() {
      const listEl = document.getElementById('comparisonList');
      viewports.clear();

      const filtered = itemsData.filter(item => {
        if (hideCompleted && item.status === 'completed') return false;
        if (activeStatusFilter === 'pending' && (item.status === 'completed' || item.status === 'incorrect')) return false;
        if (activeStatusFilter === 'incorrect' && item.status !== 'incorrect') return false;
        if (activeStatusFilter === 'completed' && item.status !== 'completed') return false;

        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const targetStr = `${item.id} ${item.design} ${item.oficial.name} ${item.oficial.notes} ${item.user_notes || ''}`.toLowerCase();
          if (!targetStr.includes(q)) return false;
        }

        return true;
      });

      if (filtered.length === 0) {
        listEl.innerHTML = `
          <div style="text-align: center; padding: 60px; background: #fff; border-radius: 12px; border: 1px dashed var(--border-color); color: #888;">
            <h3>Nenhum design encontrado com os filtros atuais</h3>
          </div>
        `;
        return;
      }

      listEl.innerHTML = filtered.map(item => {
        const itemStatus = item.status || 'pending';
        const cardStatusClass = `status-${itemStatus}`;
        const indices = activeIndices[item.id] || { oficial: 0, argola: 0, a4: 0, a6: 0 };

        // Active images for this row
        const activeOficial = item.oficial;
        const activeArgola = item.argolas[indices.argola] || item.argolas[0];
        const activeA4 = item.a4_mockups[indices.a4] || item.a4_mockups[0];
        const activeA6 = item.a6_mockups[indices.a6] || item.a6_mockups[0];

        const vpIdOficial = `vp-${item.id}-oficial`;
        const vpIdArgola = `vp-${item.id}-argola`;
        const vpIdA4 = `vp-${item.id}-a4`;
        const vpIdA6 = `vp-${item.id}-a6`;

        return `
          <div class="comparison-card ${cardStatusClass}" id="card-${item.id}">
            <div class="card-header">
              <div class="card-meta">
                <span class="card-num">Design #${item.id}</span>
                <span class="card-design-name">${item.design}</span>
                <span class="count-badge">🖼️ ${item.argolas.length} Artes &ge;80%</span>
                <span class="count-badge">📐 ${item.a4_mockups.length} A4</span>
                <span class="count-badge">📐 ${item.a6_mockups.length} A6</span>
              </div>
              
              <div class="card-actions">
                <button class="btn-status btn-concluido ${itemStatus === 'completed' ? 'active' : ''}" 
                        onclick="setItemStatus(${item.id}, 'completed')" title="Marcar como Concluído">
                  ✓ Concluído
                </button>
                <button class="btn-status btn-incorrecto ${itemStatus === 'incorrect' ? 'active' : ''}" 
                        onclick="setItemStatus(${item.id}, 'incorrect')" title="Marcar como Incorreto">
                  ✗ Incorreto
                </button>
                <button class="btn-status btn-reset-status" 
                        onclick="setItemStatus(${item.id}, 'pending')" title="Repor para pendente">
                  ⟲
                </button>
                <button class="btn-filter" onclick="openInspectModal(${item.id})" title="Abrir 4 colunas em ecrã inteiro">
                  🔍 Ecrã Cheio (4 Colunas)
                </button>
              </div>
            </div>
            
            <div class="card-notes">
              <div><strong>⭐ Descrição Oficial:</strong> ${item.oficial.notes}</div>
              <div class="user-comment-row">
                <label style="font-weight: 600; font-size: 0.8rem; color: #555; white-space: nowrap;">📝 Tuas Notas:</label>
                <input type="text" 
                       class="user-notes-input" 
                       placeholder="Adicionar notas sobre correspondência, cores ou ficheiros..." 
                       value="${escapeHtml(item.user_notes || '')}"
                       onchange="updateUserNotes(${item.id}, this.value)">
              </div>
            </div>

            <!-- 4 COLUMNS BODY -->
            <div class="card-body-4cols">
              
              <!-- Coluna 1: OFICIAL (INDEX) -->
              <div class="image-panel panel-oficiais">
                <div class="image-panel-header">
                  <div class="panel-label oficiais-label">⭐ 1. Foto Oficial (Index)</div>
                  <span class="count-badge" style="background:#f3edf9; color:var(--col-oficiais);">Oficial</span>
                </div>
                <div class="viewport" id="${vpIdOficial}" data-group="item-${item.id}" data-type="oficial">
                  <img src="${activeOficial.file}" alt="${activeOficial.name}" loading="lazy">
                  <div class="viewport-tools">
                    <button class="tool-btn zoom-out">-</button>
                    <span class="zoom-badge">100%</span>
                    <button class="tool-btn zoom-in">+</button>
                    <button class="tool-btn zoom-reset">⟲</button>
                  </div>
                </div>
                <div class="variant-caption" title="${activeOficial.name}">${activeOficial.name}</div>
              </div>

              <!-- Coluna 2: ARGOLAS (>=80% Semelhança) -->
              <div class="image-panel panel-argolas">
                <div class="image-panel-header">
                  <div class="panel-label argolas-label">🖼️ 2. Argolas (${item.argolas.length} com &ge;80%)</div>
                  <span class="count-badge" style="background:#e8f5e9; color:var(--col-argolas);">${activeArgola.match}% Match</span>
                </div>
                <div class="viewport" id="${vpIdArgola}" data-group="item-${item.id}" data-type="argola">
                  <img src="${activeArgola.file}" alt="${activeArgola.name}" loading="lazy">
                  <div class="viewport-tools">
                    <button class="tool-btn zoom-out">-</button>
                    <span class="zoom-badge">100%</span>
                    <button class="tool-btn zoom-in">+</button>
                    <button class="tool-btn zoom-reset">⟲</button>
                  </div>
                </div>
                <!-- Thumbnail bar for Argolas variants -->
                <div class="variants-bar">
                  ${item.argolas.map((a, idx) => `
                    <div class="thumb-item ${idx === indices.argola ? 'active' : ''}" 
                         onclick="selectVariant(${item.id}, 'argola', ${idx})" 
                         title="${a.name} (${a.match}%) - ${a.notes}">
                      <img src="${a.file}" alt="${a.name}" loading="lazy">
                      <span class="thumb-badge match-${a.match}">${a.match}%</span>
                    </div>
                  `).join('')}
                </div>
                <div class="variant-caption" title="${activeArgola.name} - ${activeArgola.notes}">${activeArgola.name}</div>
              </div>

              <!-- Coluna 3: SITE A4 (Variantes) -->
              <div class="image-panel panel-a4">
                <div class="image-panel-header">
                  <div class="panel-label a4-label">📐 3. Site A4 (${item.a4_mockups.length} Variantes)</div>
                  <span class="count-badge" style="background:#f9f0ea; color:var(--col-a4);">${activeA4.variant}</span>
                </div>
                <div class="viewport" id="${vpIdA4}" data-group="item-${item.id}" data-type="a4">
                  <img src="${activeA4.file}" alt="${activeA4.name}" loading="lazy">
                  <div class="viewport-tools">
                    <button class="tool-btn zoom-out">-</button>
                    <span class="zoom-badge">100%</span>
                    <button class="tool-btn zoom-in">+</button>
                    <button class="tool-btn zoom-reset">⟲</button>
                  </div>
                </div>
                <!-- Thumbnail bar for A4 variants -->
                <div class="variants-bar">
                  ${item.a4_mockups.map((a4, idx) => `
                    <div class="thumb-item ${idx === indices.a4 ? 'active' : ''}" 
                         onclick="selectVariant(${item.id}, 'a4', ${idx})" 
                         title="${a4.label}">
                      <img src="${a4.file}" alt="${a4.name}" loading="lazy">
                      <span class="thumb-badge">${a4.variant}</span>
                    </div>
                  `).join('')}
                </div>
                <div class="variant-caption" title="${activeA4.label}">${activeA4.label}</div>
              </div>

              <!-- Coluna 4: SITE A6 (Variantes) -->
              <div class="image-panel panel-a6">
                <div class="image-panel-header">
                  <div class="panel-label a6-label">📐 4. Site A6 (${item.a6_mockups.length} Variantes)</div>
                  <span class="count-badge" style="background:#fbf0f2; color:var(--col-a6);">${activeA6.variant}</span>
                </div>
                <div class="viewport" id="${vpIdA6}" data-group="item-${item.id}" data-type="a6">
                  <img src="${activeA6.file}" alt="${activeA6.name}" loading="lazy">
                  <div class="viewport-tools">
                    <button class="tool-btn zoom-out">-</button>
                    <span class="zoom-badge">100%</span>
                    <button class="tool-btn zoom-in">+</button>
                    <button class="tool-btn zoom-reset">⟲</button>
                  </div>
                </div>
                <!-- Thumbnail bar for A6 variants -->
                <div class="variants-bar">
                  ${item.a6_mockups.map((a6, idx) => `
                    <div class="thumb-item ${idx === indices.a6 ? 'active' : ''}" 
                         onclick="selectVariant(${item.id}, 'a6', ${idx})" 
                         title="${a6.label}">
                      <img src="${a6.file}" alt="${a6.name}" loading="lazy">
                      <span class="thumb-badge">${a6.variant}</span>
                    </div>
                  `).join('')}
                </div>
                <div class="variant-caption" title="${activeA6.label}">${activeA6.label}</div>
              </div>

            </div>
          </div>
        `;
      }).join('');

      document.querySelectorAll('.viewport').forEach(vpEl => {
        initViewport(vpEl);
      });
    }

    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    window.selectVariant = function(itemId, columnType, variantIdx) {
      if (!activeIndices[itemId]) activeIndices[itemId] = { oficial: 0, argola: 0, a4: 0, a6: 0 };
      activeIndices[itemId][columnType] = variantIdx;
      
      const item = itemsData.find(d => d.id === itemId);
      if (!item) return;

      const card = document.getElementById(`card-${itemId}`);
      if (!card) return;

      if (columnType === 'argola') {
        const a = item.argolas[variantIdx];
        const vp = document.getElementById(`vp-${itemId}-argola`);
        if (vp && a) {
          const img = vp.querySelector('img');
          img.src = a.file;
          img.alt = a.name;
          const badge = card.querySelector('.panel-argolas .count-badge');
          if (badge) badge.textContent = `${a.match}% Match`;
          const caption = card.querySelector('.panel-argolas .variant-caption');
          if (caption) caption.textContent = a.name;
        }
      } else if (columnType === 'a4') {
        const a4 = item.a4_mockups[variantIdx];
        const vp = document.getElementById(`vp-${itemId}-a4`);
        if (vp && a4) {
          const img = vp.querySelector('img');
          img.src = a4.file;
          img.alt = a4.name;
          const badge = card.querySelector('.panel-a4 .count-badge');
          if (badge) badge.textContent = a4.variant;
          const caption = card.querySelector('.panel-a4 .variant-caption');
          if (caption) caption.textContent = a4.label;
        }
      } else if (columnType === 'a6') {
        const a6 = item.a6_mockups[variantIdx];
        const vp = document.getElementById(`vp-${itemId}-a6`);
        if (vp && a6) {
          const img = vp.querySelector('img');
          img.src = a6.file;
          img.alt = a6.name;
          const badge = card.querySelector('.panel-a6 .count-badge');
          if (badge) badge.textContent = a6.variant;
          const caption = card.querySelector('.panel-a6 .variant-caption');
          if (caption) caption.textContent = a6.label;
        }
      }

      // Update active thumbnail classes
      const panel = card.querySelector(`.panel-${columnType === 'argola' ? 'argolas' : columnType}`);
      if (panel) {
        panel.querySelectorAll('.thumb-item').forEach((t, i) => {
          t.classList.toggle('active', i === variantIdx);
        });
      }
    };

    window.setItemStatus = function(itemId, newStatus) {
      const item = itemsData.find(d => d.id === itemId);
      if (!item) return;

      if (item.status === newStatus && newStatus !== 'pending') {
        item.status = 'pending';
      } else {
        item.status = newStatus;
      }

      saveState(true);

      if (hideCompleted && item.status === 'completed') {
        renderItems();
      } else {
        const card = document.getElementById(`card-${itemId}`);
        if (card) {
          card.classList.remove('status-pending', 'status-completed', 'status-incorrect');
          card.classList.add(`status-${item.status}`);

          const btnConcluido = card.querySelector('.btn-concluido');
          const btnIncorrecto = card.querySelector('.btn-incorrecto');

          if (btnConcluido) btnConcluido.classList.toggle('active', item.status === 'completed');
          if (btnIncorrecto) btnIncorrecto.classList.toggle('active', item.status === 'incorrect');
        }
      }
    };

    window.updateUserNotes = function(itemId, notesText) {
      const item = itemsData.find(d => d.id === itemId);
      if (item) {
        item.user_notes = notesText.trim();
        saveState(true);
      }
    };

    /* Pan & Zoom Engine (4 Views Synced) */
    function initViewport(vpEl) {
      const img = vpEl.querySelector('img');
      const zoomBadge = vpEl.querySelector('.zoom-badge');
      const groupKey = vpEl.getAttribute('data-group');

      const vpState = {
        el: vpEl,
        img: img,
        badge: zoomBadge,
        groupKey: groupKey,
        scale: 1,
        x: 0,
        y: 0,
        isDragging: false,
        startX: 0,
        startY: 0
      };

      viewports.set(vpEl.id, vpState);

      function updateTransform(applySync = true) {
        img.style.transform = `translate(${vpState.x}px, ${vpState.y}px) scale(${vpState.scale})`;
        if (zoomBadge) {
          zoomBadge.textContent = `${Math.round(vpState.scale * 100)}%`;
        }

        if (applySync && syncEnabled && groupKey) {
          viewports.forEach(otherVp => {
            if (otherVp.groupKey === groupKey && otherVp !== vpState) {
              otherVp.scale = vpState.scale;
              otherVp.x = vpState.x;
              otherVp.y = vpState.y;
              updateTransformSync(otherVp);
            }
          });
        }
      }

      function updateTransformSync(targetVp) {
        targetVp.img.style.transform = `translate(${targetVp.x}px, ${targetVp.y}px) scale(${targetVp.scale})`;
        if (targetVp.badge) {
          targetVp.badge.textContent = `${Math.round(targetVp.scale * 100)}%`;
        }
      }

      // Wheel Zoom: Only active when Ctrl key is pressed
      vpEl.addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return;

        e.preventDefault();
        const rect = vpEl.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY < 0 ? 1.18 : 0.847;
        const newScale = Math.min(Math.max(0.5, vpState.scale * zoomFactor), 16);

        vpState.x = mouseX - (mouseX - vpState.x) * (newScale / vpState.scale);
        vpState.y = mouseY - (mouseY - vpState.y) * (newScale / vpState.scale);
        vpState.scale = newScale;

        updateTransform(true);
      }, { passive: false });

      // Pan with Mouse Drag
      vpEl.addEventListener('mousedown', (e) => {
        if (e.target.closest('.viewport-tools')) return;
        e.preventDefault();
        vpState.isDragging = true;
        vpState.startX = e.clientX - vpState.x;
        vpState.startY = e.clientY - vpState.y;
        vpEl.classList.add('grabbing');
      });

      window.addEventListener('mousemove', (e) => {
        if (!vpState.isDragging) return;
        vpState.x = e.clientX - vpState.startX;
        vpState.y = e.clientY - vpState.startY;
        updateTransform(true);
      });

      window.addEventListener('mouseup', () => {
        if (vpState.isDragging) {
          vpState.isDragging = false;
          vpEl.classList.remove('grabbing');
        }
      });

      vpEl.addEventListener('dblclick', (e) => {
        if (e.target.closest('.viewport-tools')) return;
        vpState.scale = 1;
        vpState.x = 0;
        vpState.y = 0;
        updateTransform(true);
      });

      const btnIn = vpEl.querySelector('.zoom-in');
      const btnOut = vpEl.querySelector('.zoom-out');
      const btnReset = vpEl.querySelector('.zoom-reset');

      if (btnIn) {
        btnIn.addEventListener('click', (e) => {
          e.stopPropagation();
          const rect = vpEl.getBoundingClientRect();
          const cx = rect.width / 2;
          const cy = rect.height / 2;
          const newScale = Math.min(16, vpState.scale * 1.3);
          vpState.x = cx - (cx - vpState.x) * (newScale / vpState.scale);
          vpState.y = cy - (cy - vpState.y) * (newScale / vpState.scale);
          vpState.scale = newScale;
          updateTransform(true);
        });
      }

      if (btnOut) {
        btnOut.addEventListener('click', (e) => {
          e.stopPropagation();
          const rect = vpEl.getBoundingClientRect();
          const cx = rect.width / 2;
          const cy = rect.height / 2;
          const newScale = Math.max(0.5, vpState.scale / 1.3);
          vpState.x = cx - (cx - vpState.x) * (newScale / vpState.scale);
          vpState.y = cy - (cy - vpState.y) * (newScale / vpState.scale);
          vpState.scale = newScale;
          updateTransform(true);
        });
      }

      if (btnReset) {
        btnReset.addEventListener('click', (e) => {
          e.stopPropagation();
          vpState.scale = 1;
          vpState.x = 0;
          vpState.y = 0;
          updateTransform(true);
        });
      }
    }

    function setupEventListeners() {
      const searchInput = document.getElementById('searchInput');
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderItems();
      });

      const hideCompletedCheckbox = document.getElementById('hideCompletedCheckbox');
      const hideCompletedToggle = document.getElementById('hideCompletedToggle');
      hideCompletedCheckbox.addEventListener('change', (e) => {
        hideCompleted = e.target.checked;
        hideCompletedToggle.classList.toggle('checked', hideCompleted);
        renderItems();
      });

      document.querySelectorAll('.btn-filter[data-filter-type="status"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.getAttribute('data-value');
          document.querySelectorAll('.btn-filter[data-filter-type="status"]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          activeStatusFilter = val;
          renderItems();
        });
      });

      const syncCheckbox = document.getElementById('syncPanZoom');
      syncCheckbox.addEventListener('change', (e) => {
        syncEnabled = e.target.checked;
      });

      document.getElementById('resetAllZoomBtn').addEventListener('click', () => {
        viewports.forEach(vp => {
          vp.scale = 1;
          vp.x = 0;
          vp.y = 0;
          vp.img.style.transform = `translate(0px, 0px) scale(1)`;
          if (vp.badge) vp.badge.textContent = '100%';
        });
        showToast('Zoom reposto em todas as vistas.');
      });

      document.getElementById('saveServerBtn').addEventListener('click', () => {
        saveState(true);
      });

      document.getElementById('exportJsonBtn').addEventListener('click', () => {
        const payload = {
          updated_at: new Date().toISOString(),
          total_designs: itemsData.length,
          stats: {
            completed: itemsData.filter(i => i.status === 'completed').length,
            incorrect: itemsData.filter(i => i.status === 'incorrect').length,
            pending: itemsData.filter(i => i.status === 'pending' || !i.status).length
          },
          items: itemsData
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'comparador-validacoes.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('💾 Ficheiro descarregado!');
      });

      const fileInput = document.getElementById('jsonFileInput');
      document.getElementById('importJsonBtn').addEventListener('click', () => { fileInput.click(); });
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const parsed = JSON.parse(event.target.result);
            if (parsed && Array.isArray(parsed.items)) {
              mergeLoadedItems(parsed.items);
              saveState(true);
              renderItems();
              showToast(`📂 Importado com sucesso (${parsed.items.length} designs)!`);
            } else {
              alert('Formato JSON inválido.');
            }
          } catch (err) {
            alert('Erro: ' + err.message);
          }
        };
        reader.readAsText(file);
      });

      document.getElementById('modalCloseBtn').addEventListener('click', () => {
        document.getElementById('inspectModal').classList.remove('active');
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          document.getElementById('inspectModal').classList.remove('active');
        }
      });

      const scrollBtn = document.getElementById('scrollTopBtn');
      window.addEventListener('scroll', () => {
        if (window.scrollY > 300) scrollBtn.classList.add('visible');
        else scrollBtn.classList.remove('visible');
      });
      scrollBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    window.openInspectModal = function(itemId) {
      const item = itemsData.find(d => d.id === itemId);
      if (!item) return;

      const indices = activeIndices[itemId] || { oficial: 0, argola: 0, a4: 0, a6: 0 };
      const activeOficial = item.oficial;
      const activeArgola = item.argolas[indices.argola] || item.argolas[0];
      const activeA4 = item.a4_mockups[indices.a4] || item.a4_mockups[0];
      const activeA6 = item.a6_mockups[indices.a6] || item.a6_mockups[0];

      const modal = document.getElementById('inspectModal');
      const title = document.getElementById('modalTitle');
      const body = document.getElementById('modalBody');

      title.innerHTML = `<span>Design #${item.id} · ${item.design}</span> <span style="font-size:0.8rem; color:#aaa;">(4 Colunas em Ecrã Inteiro)</span>`;

      body.innerHTML = `
        <div class="modal-viewport-container">
          <div class="modal-viewport-header">
            <span>⭐ 1. Oficial (Index)</span>
            <code>${activeOficial.name}</code>
          </div>
          <div class="viewport modal-viewport" id="modal-vp-oficial" data-group="modal-group">
            <img src="${activeOficial.file}" alt="Oficial">
            <div class="viewport-tools">
              <button class="tool-btn zoom-out">-</button>
              <span class="zoom-badge">100%</span>
              <button class="tool-btn zoom-in">+</button>
              <button class="tool-btn zoom-reset">⟲</button>
            </div>
          </div>
        </div>

        <div class="modal-viewport-container">
          <div class="modal-viewport-header">
            <span>🖼️ 2. Argolas (${activeArgola.match}%)</span>
            <code>${activeArgola.name}</code>
          </div>
          <div class="viewport modal-viewport" id="modal-vp-argola" data-group="modal-group">
            <img src="${activeArgola.file}" alt="Argolas">
            <div class="viewport-tools">
              <button class="tool-btn zoom-out">-</button>
              <span class="zoom-badge">100%</span>
              <button class="tool-btn zoom-in">+</button>
              <button class="tool-btn zoom-reset">⟲</button>
            </div>
          </div>
        </div>

        <div class="modal-viewport-container">
          <div class="modal-viewport-header">
            <span>📐 3. Site A4 (${activeA4.variant})</span>
            <code>${activeA4.name}</code>
          </div>
          <div class="viewport modal-viewport" id="modal-vp-a4" data-group="modal-group">
            <img src="${activeA4.file}" alt="A4">
            <div class="viewport-tools">
              <button class="tool-btn zoom-out">-</button>
              <span class="zoom-badge">100%</span>
              <button class="tool-btn zoom-in">+</button>
              <button class="tool-btn zoom-reset">⟲</button>
            </div>
          </div>
        </div>

        <div class="modal-viewport-container">
          <div class="modal-viewport-header">
            <span>📐 4. Site A6 (${activeA6.variant})</span>
            <code>${activeA6.name}</code>
          </div>
          <div class="viewport modal-viewport" id="modal-vp-a6" data-group="modal-group">
            <img src="${activeA6.file}" alt="A6">
            <div class="viewport-tools">
              <button class="tool-btn zoom-out">-</button>
              <span class="zoom-badge">100%</span>
              <button class="tool-btn zoom-in">+</button>
              <button class="tool-btn zoom-reset">⟲</button>
            </div>
          </div>
        </div>
      `;

      modal.classList.add('active');
      body.querySelectorAll('.modal-viewport').forEach(vpEl => {
        initViewport(vpEl);
      });
    };

    window.addEventListener('DOMContentLoaded', init);
  </script>
</body>
</html>