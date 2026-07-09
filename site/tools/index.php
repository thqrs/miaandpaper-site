<?php
// TOOLS_INDEX_V1: página interna de ferramentas. Mesmo guard de sessão que
// admin-funnel.php / admin-orders.php — só acessível em modo admin.
session_start();

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
        . '<title>Acesso negado · Ferramentas</title>'
        . '<style>body{font-family:Georgia,serif;max-width:560px;margin:60px auto;padding:0 20px;color:#3b2f1f;}h1{font-size:1.4rem;}a{color:#4f7a3a;font-weight:700;}</style>'
        . '<h1>Acesso restrito.</h1>'
        . '<p>Inicia sessão como administradora a partir de <a href="../index.html">index.html</a> e regressa a esta página.</p>';
    exit;
}
?>
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ferramentas | Mia &amp; Paper</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="stylesheet" href="../catalogo/catalogo.css?v=20260521150213">
  <link rel="stylesheet" href="../ofertas/ofertas.css?v=2026062809">
</head>
<body data-catalog-page="tools">
  <main class="catalog-shell">
    <header class="catalog-header" aria-label="Mia &amp; Paper">
      <a class="catalog-brand" href="../index.html" aria-label="Ir para o site principal Mia &amp; Paper">
        <span class="catalog-brand-mark"><img src="../content/brand/logo.jpg" alt="Mia &amp; Paper" width="92" height="92"></span>
        <span>Mia &amp; Paper</span>
      </a>
      <div class="catalog-path">Ferramentas</div>
    </header>

    <section class="catalog-hero" aria-labelledby="tools-title">
      <p class="catalog-kicker">Área interna</p>
      <h1 id="tools-title">Ferramentas de produção</h1>
    </section>

    <section class="catalog-section" aria-labelledby="tools-disponiveis-title">
      <h2 id="tools-disponiveis-title">Ferramentas disponíveis</h2>
      <div class="catalog-product-list">
        <a class="catalog-product-card" href="gerador-cartoes.php" aria-label="Abrir o gerador de cartões de botões">
          <span class="offer-card-image-frame"><img src="assets/gerador-cartoes.webp" alt="Cartão de botões" width="224" height="224" loading="lazy"></span>
          <span class="catalog-product-copy">
            <strong>Gerador de Cartões</strong>
            <span>Cartões de botões personalizados — PDF para a ET&#8209;8550 e SVG de corte para a Cricut.</span>
            <span class="catalog-product-action">Abrir ferramenta</span>
          </span>
        </a>
      </div>
    </section>

  </main>
  <footer class="site-footer catalog-footer">
    <a class="catalog-footer-link" href="../index.html">Voltar ao site</a>
    <span>© Mia &amp; Paper 2026 · Área interna</span>
  </footer>
</body>
</html>
