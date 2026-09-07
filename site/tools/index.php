<?php
// TOOLS_INDEX_V1: página interna de ferramentas. Mesmo guard de sessão que
// admin-funnel.php / admin-orders.php — só acessível em modo admin.
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
  <link rel="stylesheet" href="../admin-nav.css?v=20260908005511">
  <script src="../admin-nav.js?v=20260908005511" data-prefix="../" defer></script>
  <style>
    /* O card tem dois destinos, por isso deixa de ser um <a>: o título estica-se
       sobre o card inteiro e o segundo link fica por cima, na sua área. */
    .tools-card-duplo { position: relative; }
    .tools-link-principal { color: inherit; text-decoration: none; }
    .tools-link-principal::after { content: ""; position: absolute; inset: 0; }
    .tools-link-lado {
      position: relative;
      z-index: 1;
      align-self: start;
      font-size: 0.82rem;
      color: var(--moss, #4f7a3a);
    }
  </style>
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
        <div class="catalog-product-card tools-card-duplo">
          <span class="offer-card-image-frame"><img src="assets/gerador-cartoes.webp" alt="Cartão de botões" width="224" height="224" loading="lazy"></span>
          <span class="catalog-product-copy">
            <strong><a class="tools-link-principal" href="gerador-cartoes.php" aria-label="Abrir o gerador de cartões de botões">Gerador de Cartões</a></strong>
            <span>Cartões de botões personalizados — PDF para a ET&#8209;8550 e SVG de corte para a Cricut.</span>
            <span class="catalog-product-action">Abrir ferramenta</span>
            <a class="tools-link-lado" href="README-url-cartoes.md">Instruções de URL para o ChatGPT</a>
          </span>
        </div>
        <a class="catalog-product-card" href="comparador-argolas.php">
          <span class="catalog-product-thumb" aria-hidden="true">🔍</span>
          <span class="catalog-product-copy"><strong>Comparador de Argolas</strong><span>Comparação visual a 4 colunas ([A4] [A6] [Argolas] [Oficiais]) com zoom e pan sincronizados.</span><span class="catalog-product-action">Abrir comparador</span></span>
        </a>
        <a class="catalog-product-card" href="../precos.php">
          <span class="catalog-product-thumb" aria-hidden="true">€</span>
          <span class="catalog-product-copy"><strong>Preços</strong><span>Todos os valores do site num sítio: packs, descontos, extras, portes, custos e lucro.</span><span class="catalog-product-action">Abrir editor</span></span>
        </a>
        <a class="catalog-product-card" href="../homepage-menu-design.php">
          <span class="catalog-product-thumb" aria-hidden="true">H</span>
          <span class="catalog-product-copy"><strong>Homepage &amp; Menu</strong><span>Ordem e agrupamento do menu, e os cartões da homepage.</span><span class="catalog-product-action">Abrir editor</span></span>
        </a>
        <a class="catalog-product-card" href="../faqs.php">
          <span class="catalog-product-thumb" aria-hidden="true">?</span>
          <span class="catalog-product-copy"><strong>FAQs</strong><span>Perguntas e respostas da página de perguntas frequentes.</span><span class="catalog-product-action">Abrir editor</span></span>
        </a>
        <a class="catalog-product-card" href="../bot.php">
          <span class="catalog-product-thumb" aria-hidden="true">M</span>
          <span class="catalog-product-copy"><strong>Míu</strong><span>Conversas, system prompt, base de informação, fornecedor e limites do chatbot.</span><span class="catalog-product-action">Abrir painel</span></span>
        </a>
        <a class="catalog-product-card" href="../sprites.php">
          <span class="catalog-product-thumb" aria-hidden="true">▦</span>
          <span class="catalog-product-copy"><strong>Sprites do Míu</strong><span>Pré-visualizar e editar frames, tempos, gatilhos, movimento e posição das animações.</span><span class="catalog-product-action">Abrir editor</span></span>
        </a>
        <a class="catalog-product-card" href="../materiais.php">
          <span class="catalog-product-thumb" aria-hidden="true">€/un</span>
          <span class="catalog-product-copy"><strong>Materiais e custos</strong><span>Quanto custa mesmo fazer uma unidade: materiais, estragos e tempo.</span><span class="catalog-product-action">Abrir calculadora</span></span>
        </a>
        <a class="catalog-product-card" href="../carrousel.php">
          <span class="catalog-product-thumb" aria-hidden="true">▦</span>
          <span class="catalog-product-copy"><strong>Carrosséis</strong><span>As imagens que rodam em cada cartão da homepage, e os parâmetros de cada uma.</span><span class="catalog-product-action">Abrir editor</span></span>
        </a>
        <a class="catalog-product-card" href="../galeria.html">
          <span class="catalog-product-thumb" aria-hidden="true">G</span>
          <span class="catalog-product-copy"><strong>Galeria</strong><span>Enquadrar, substituir e organizar as imagens usadas nos produtos.</span><span class="catalog-product-action">Abrir gestão</span></span>
        </a>
        <a class="catalog-product-card" href="../multimedia.html">
          <span class="catalog-product-thumb" aria-hidden="true">M</span>
          <span class="catalog-product-copy"><strong>Multimédia</strong><span>Inventário dos ficheiros de imagem e dos locais onde são usados.</span><span class="catalog-product-action">Abrir inventário</span></span>
        </a>
        <a class="catalog-product-card" href="../photo-wizard.php">
          <span class="catalog-product-thumb" aria-hidden="true">W</span>
          <span class="catalog-product-copy"><strong>Photo Wizard</strong><span>Resolver, uma de cada vez e com sugestões, as imagens por concluir na Galeria.</span><span class="catalog-product-action">Continuar escolhas</span></span>
        </a>
        <a class="catalog-product-card" href="../reviews.html">
          <span class="catalog-product-thumb" aria-hidden="true">★</span>
          <span class="catalog-product-copy"><strong>Reviews</strong><span>Editar testemunhos, imagens, links, ordem e apresentação.</span><span class="catalog-product-action">Abrir editor</span></span>
        </a>
        <a class="catalog-product-card" href="../produtos.html">
          <span class="catalog-product-thumb" aria-hidden="true">P</span>
          <span class="catalog-product-copy"><strong>Produtos</strong><span>Consultar produtos, registos configuráveis e os percursos que terminam no carrinho.</span><span class="catalog-product-action">Abrir base de dados</span></span>
        </a>
        <a class="catalog-product-card" href="../modulos.php">
          <span class="catalog-product-thumb" aria-hidden="true">M</span>
          <span class="catalog-product-copy"><strong>Módulos de CSS</strong><span>Inventário visual de tudo o que existe no styles.css, claro e escuro.</span><span class="catalog-product-action">Abrir inventário</span></span>
        </a>
        <a class="catalog-product-card" href="parametros.php">
          <span class="catalog-product-thumb" aria-hidden="true">?=</span>
          <span class="catalog-product-copy"><strong>Parâmetros</strong><span>Tudo o que se pode pedir ao site por URL, com um link por valor. Em JSON, é o manifesto.</span><span class="catalog-product-action">Abrir inventário</span></span>
        </a>
        <a class="catalog-product-card" href="../admin-snapshots.php">
          <span class="catalog-product-thumb" aria-hidden="true">S</span>
          <span class="catalog-product-copy"><strong>Snapshots</strong><span>Congelar as páginas pesadas. Refazer sempre que a estrutura mudar.</span><span class="catalog-product-action">Abrir painel</span></span>
        </a>
        <a class="catalog-product-card" href="../admin-funnel.php">
          <span class="catalog-product-thumb" aria-hidden="true">F</span>
          <span class="catalog-product-copy"><strong>Funil</strong><span>Acompanhar visitas, catálogo, escolhas e encomendas.</span><span class="catalog-product-action">Abrir painel</span></span>
        </a>
        <a class="catalog-product-card" href="../funilv2.php">
          <span class="catalog-product-thumb" aria-hidden="true">⏱</span>
          <span class="catalog-product-copy"><strong>Funil live · Percurso</strong><span>Visitantes em tempo real, matriz de seleção e percurso cronológico.</span><span class="catalog-product-action">Abrir funil live</span></span>
        </a>
        <a class="catalog-product-card" href="../tracking.php">
          <span class="catalog-product-thumb" aria-hidden="true">📍</span>
          <span class="catalog-product-copy"><strong>Tracking</strong><span>Histórico de sessões, eventos e atividade detalhada.</span><span class="catalog-product-action">Abrir tracking</span></span>
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
        <a class="catalog-product-card" href="../view-uploads.php">
          <span class="catalog-product-thumb" aria-hidden="true">📁</span>
          <span class="catalog-product-copy"><strong>Ficheiros clientes</strong><span>Visualizar e reproduzir áudios, fotos e ficheiros enviados por clientes.</span><span class="catalog-product-action">Abrir ficheiros</span></span>
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