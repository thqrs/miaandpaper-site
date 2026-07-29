<?php
// TOOLS_INDEX_V1: página interna de ferramentas. Mesmo guard de sessão que
// admin-funnel.php / admin-orders.php — só acessível em modo admin.
session_start();
require_once __DIR__ . '/../admin-open.php';   // ADMIN_OPEN_DEV_V1: sem password até ao deploy

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
  <link rel="stylesheet" href="../catalogo/catalogo.css?v=2026072601">
  <link rel="stylesheet" href="../ofertas/ofertas.css?v=2026062809">
  <link rel="stylesheet" href="../admin-nav.css?v=2026072801">
  <script src="../admin-nav.js?v=2026072801" data-prefix="../" defer></script>
</head>
<body data-catalog-page="tools">
  <main class="catalog-shell">
    <header class="catalog-header" aria-label="Mia &amp; Paper">
      <a class="catalog-brand" href="../index.html" aria-label="Ir para o site principal Mia &amp; Paper">
        <span class="catalog-brand-mark"><img src="../content/brand/logo.webp" alt="Mia &amp; Paper" width="92" height="92"></span>
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
        <a class="catalog-product-card" href="../galeria.html">
          <span class="catalog-product-thumb" aria-hidden="true">G</span>
          <span class="catalog-product-copy"><strong>Galeria</strong><span>Enquadrar, substituir e organizar as imagens usadas nos produtos.</span><span class="catalog-product-action">Abrir gestão</span></span>
        </a>
        <a class="catalog-product-card" href="../multimedia.html">
          <span class="catalog-product-thumb" aria-hidden="true">M</span>
          <span class="catalog-product-copy"><strong>Multimédia</strong><span>Inventário dos ficheiros de imagem e dos locais onde são usados.</span><span class="catalog-product-action">Abrir inventário</span></span>
        </a>
        <a class="catalog-product-card" href="../reviews.html">
          <span class="catalog-product-thumb" aria-hidden="true">★</span>
          <span class="catalog-product-copy"><strong>Reviews</strong><span>Editar testemunhos, imagens, links, ordem e apresentação.</span><span class="catalog-product-action">Abrir editor</span></span>
        </a>
        <a class="catalog-product-card" href="../produtos.html">
          <span class="catalog-product-thumb" aria-hidden="true">P</span>
          <span class="catalog-product-copy"><strong>Produtos</strong><span>Consultar produtos, registos configuráveis e os percursos que terminam no carrinho.</span><span class="catalog-product-action">Abrir base de dados</span></span>
        </a>
        <a class="catalog-product-card" href="../admin-funnel.php">
          <span class="catalog-product-thumb" aria-hidden="true">F</span>
          <span class="catalog-product-copy"><strong>Funil</strong><span>Acompanhar visitas, catálogo, escolhas e encomendas.</span><span class="catalog-product-action">Abrir painel</span></span>
        </a>
        <a class="catalog-product-card" href="../admin-orders.php">
          <span class="catalog-product-thumb" aria-hidden="true">E</span>
          <span class="catalog-product-copy"><strong>Encomendas</strong><span>Consultar os pedidos recebidos e o respetivo estado.</span><span class="catalog-product-action">Abrir painel</span></span>
        </a>
        <a class="catalog-product-card" href="../admin-colors.html">
          <span class="catalog-product-thumb" aria-hidden="true">C</span>
          <span class="catalog-product-copy"><strong>Cores</strong><span>Gerir o catálogo de cores usado nos produtos.</span><span class="catalog-product-action">Abrir gestão</span></span>
        </a>
        <a class="catalog-product-card" href="../admin-uploads.php">
          <span class="catalog-product-thumb" aria-hidden="true">U</span>
          <span class="catalog-product-copy"><strong>Uploads assistidos</strong><span>Preparar e acompanhar ficheiros enviados para encomendas.</span><span class="catalog-product-action">Abrir gestão</span></span>
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
