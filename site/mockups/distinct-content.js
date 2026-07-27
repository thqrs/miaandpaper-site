(function () {
  "use strict";

  var root = document.querySelector("#mockup-root");
  var key = document.body.dataset.concept || "editorial";
  var active = Number(document.body.dataset.mockupPage || "2");

  var products = [
    { name: "Cadernos", text: "Para escrever, guardar e oferecer.", href: "../cadernos.html", image: "../content/designs/cadernos/novos/a_jovem_cadeira/a_jovem_cadeira_matte.webp", alt: "Caderno com capa ilustrada" },
    { name: "Molduras", text: "Peças personalizadas para a tua casa.", href: "../molduras.html", image: "../content/designs/quadros/exemplos/quadro-bodas-de-ouro.webp", alt: "Moldura personalizada" },
    { name: "Crachás", text: "Pequenos detalhes com significado.", href: "../crachas.html", image: "../content/designs/crachas/novidades/braille-01.webp", alt: "Crachá ilustrado" },
    { name: "Postais", text: "Mensagens para guardar.", href: "../postais.html", image: "../ofertas/convite-congresso/assets/modelo-casal.webp", alt: "Postal ilustrado" },
    { name: "Agendas", text: "Para organizar os teus dias.", href: "../agendas.html", image: "../content/designs/cadernos/novos/vestido_verde/vestido_verde_matte.webp", alt: "Agenda com capa ilustrada" },
    { name: "Ímanes", text: "Um toque especial no frigorífico.", href: "../imanes.html", image: "../content/designs/Fotos_dos_Imans/esperanca/esperanca-01.webp", alt: "Íman ilustrado" },
    { name: "Congressos", text: "Lembranças e cadernos do congresso.", href: "../congressos.html", image: "../content/designs/cadernos/process/pack_com_crachas/pack_com_crachas_5.webp", alt: "Pack de caderno e crachás" }
  ];

  var quotes = [
    { text: "Foi fácil explicar o que queria e acompanhar as escolhas até chegar à versão final.", source: "Cliente · encomenda personalizada" },
    { text: "A moldura ficou muito pessoal sem perder a simplicidade. Era mesmo o presente que procurava.", source: "Cliente · moldura personalizada" },
    { text: "Consegui escolher o produto e perceber todas as opções sem tornar o pedido complicado.", source: "Cliente · papelaria personalizada" }
  ];

  if (!root) {
    return;
  }

  function switchLink(number) {
    return '<a href="index' + number + '.html"' + (active === number ? ' aria-current="page"' : '') + ' aria-label="Abrir proposta ' + number + '">' + number + '</a>';
  }

  function sharedHeader() {
    return [
      '<header class="site-head">',
        '<a class="brand" href="index.html" aria-label="Ver todos os mockups"><img src="../content/brand/logo.webp" alt="" width="92" height="92"><span>Mia &amp; Paper</span></a>',
        '<div class="head-actions"><a class="header-cta" href="../catalogo/index.html">Ver catálogo</a><button class="menu-button" type="button" aria-label="Abrir menu" aria-expanded="false" data-menu-button><span class="menu-button-lines" aria-hidden="true"></span></button></div>',
      '</header>',
      '<button class="menu-backdrop" type="button" aria-label="Fechar menu" data-menu-close></button>',
      '<aside class="menu-panel" aria-label="Menu principal" aria-hidden="true" data-menu-panel>',
        '<div class="menu-panel-head"><span class="brand"><img src="../content/brand/logo.webp" alt="" width="92" height="92"><span>Mia &amp; Paper</span></span><button class="menu-close" type="button" aria-label="Fechar menu" data-menu-close>×</button></div>',
        '<nav class="menu-links"><a href="#inicio">Início</a><a href="#testemunhos">Testemunhos</a><a href="#novidades">Novidades</a><a href="#produtos">Produtos</a><a href="#como-encomendar">Como encomendar</a><a href="../catalogo/index.html">Catálogo simples</a></nav>',
        '<p class="menu-note">Mockup visual isolado. A homepage real não foi alterada.</p>',
      '</aside>'
    ].join("");
  }

  function sharedFooter() {
    return [
      '<footer class="site-footer"><span>© Mia &amp; Paper 2026 · mockup visual</span><nav class="footer-links" aria-label="Rodapé"><a href="../privacy.html">Privacidade</a><a href="../contacto.html">Contacto</a><a href="index.html">Todos os mockups</a></nav></footer>',
      '<nav class="mockup-switcher" aria-label="Mudar de proposta"><a href="index.html" aria-label="Ver todas as propostas">Todos</a>',
        switchLink(1), switchLink(2), switchLink(3), switchLink(4),
      '</nav>'
    ].join("");
  }

  function stars() {
    return '<span class="stars" aria-label="5 estrelas">★★★★★</span>';
  }

  function editorialProducts() {
    return products.map(function (product, index) {
      return '<a class="ed-product" href="' + product.href + '"><span class="ed-product-index">' + String(index + 1).padStart(2, "0") + '</span><img src="' + product.image + '" alt="' + product.alt + '" loading="lazy"><span class="ed-product-copy"><strong>' + product.name + '</strong><small>' + product.text + '</small></span><span class="ed-product-arrow" aria-hidden="true">↗</span></a>';
    }).join("");
  }

  function monoProducts() {
    return products.map(function (product, index) {
      return '<a class="mn-product mn-product--' + (index + 1) + '" href="' + product.href + '"><img src="' + product.image + '" alt="' + product.alt + '" loading="lazy"><span><small>0' + (index + 1) + '</small><strong>' + product.name + '</strong><em>↗</em></span></a>';
    }).join("");
  }

  function bentoProducts() {
    return products.map(function (product, index) {
      return '<a class="bn-product bn-product--' + (index + 1) + '" href="' + product.href + '"><img src="' + product.image + '" alt="' + product.alt + '" loading="lazy"><span class="bn-product-copy"><span><strong>' + product.name + '</strong><small>' + product.text + '</small></span><b aria-hidden="true">→</b></span></a>';
    }).join("");
  }

  function renderEditorial() {
    var testimonialHtml = quotes.map(function (quote, index) {
      return '<article class="ed-quote"><span class="ed-quote-number">0' + (index + 1) + '</span>' + stars() + '<blockquote>“' + quote.text + '”</blockquote><footer>' + quote.source + '</footer></article>';
    }).join("");

    return [
      '<main class="ed-main">',
        '<section class="ed-hero" id="inicio" aria-labelledby="ed-hero-title">',
          '<div class="ed-hero-media"><img src="../content/designs/cadernos/process/caderno_normal_com_pin/caderno_normal_com_pin_6.webp" alt="Caderno espiral Mia & Paper com a ilustração Felicidade Eterna"></div>',
          '<div class="ed-hero-copy"><p class="ed-kicker">Mia &amp; Paper · atelier de papel</p><h1 id="ed-hero-title">Papel, memórias e peças com um lugar só teu.</h1><p>Uma seleção de cadernos, molduras e lembranças que podes adaptar à pessoa, à data e à história.</p><div class="ed-actions"><a href="#produtos">Ver a coleção</a><a href="#novidades">Descobrir novidades</a></div></div>',
          '<p class="ed-hero-caption">Preparado por encomenda · Portugal</p>',
        '</section>',
        '<section class="ed-testimonials" id="testemunhos" aria-labelledby="ed-testimonials-title">',
          '<header><p>Testemunhos · textos provisórios</p><h2 id="ed-testimonials-title">O que fica depois de abrir a embalagem.</h2></header>',
          '<div class="ed-quotes">' + testimonialHtml + '</div>',
        '</section>',
        '<section class="ed-news" id="novidades" aria-labelledby="ed-news-title">',
          '<header class="ed-section-title"><span>Novidades / 02</span><h2 id="ed-news-title">Duas histórias recentes do atelier.</h2></header>',
          '<a class="ed-story ed-story--large" href="../molduras.html"><img src="../content/designs/quadros/exemplos/quadro-bodas-de-ouro.webp" alt="Moldura personalizada para bodas de ouro" loading="lazy"><span><small>Personalização</small><h3>Molduras feitas à tua medida</h3><p>Escolhe o estilo, as cores e o texto, e envia as fotos diretamente no pedido.</p><b>Ver a moldura ↗</b></span></a>',
          '<a class="ed-story ed-story--reverse" href="../congressos.html"><img src="../content/designs/cadernos/process/pack_com_crachas/pack_com_crachas_1.webp" alt="Conjunto de caderno e crachás" loading="lazy"><span><small>Congresso 2026</small><h3>Cadernos e lembranças</h3><p>Packs pensados para preparar a encomenda do congresso sem complicações.</p><b>Conhecer os packs ↗</b></span></a>',
        '</section>',
        '<section class="ed-products" id="produtos" aria-labelledby="ed-products-title">',
          '<header class="ed-section-title"><span>Diretório / 07</span><h2 id="ed-products-title">Escolhe pelo que queres criar.</h2></header>',
          '<div class="ed-product-list">' + editorialProducts() + '</div>',
        '</section>',
        '<section class="ed-process" id="como-encomendar" aria-labelledby="ed-process-title">',
          '<div><p>Como encomendar</p><h2 id="ed-process-title">Três conversas. Um resultado teu.</h2></div>',
          '<ol><li><span>01</span><strong>Escolher</strong><p>Encontra o produto e as opções que fazem sentido.</p></li><li><span>02</span><strong>Afinar</strong><p>Define textos, cores, fotos e quantidades.</p></li><li><span>03</span><strong>Confirmar</strong><p>Revê o pedido antes de avançar para produção.</p></li></ol>',
        '</section>',
        '<section class="ed-final"><p>O catálogo simples reúne produtos, opções e preços.</p><a href="../catalogo/index.html">Abrir catálogo <span>↗</span></a></section>',
      '</main>'
    ].join("");
  }

  function renderMono() {
    return [
      '<main class="mn-main">',
        '<section class="mn-hero" id="inicio" aria-labelledby="mn-hero-title">',
          '<div class="mn-hero-top"><span class="mn-count">01 — Início</span><div><p>Objetos pessoais · sem produção em massa</p><h1 id="mn-hero-title">Personalização<br>sem ruído.</h1></div><div class="mn-hero-side"><p>Escolhe um produto, diz-nos o que queres mudar e acompanha uma encomenda pensada para ti.</p><nav><a href="#produtos">Explorar produtos</a><a href="#novidades">Ver novidades</a></nav></div></div>',
          '<figure class="mn-hero-image"><img src="../content/designs/cadernos/process/caderno_normal_com_pin/caderno_normal_com_pin_6.webp" alt="Caderno espiral Mia & Paper com a ilustração Felicidade Eterna"><figcaption><span>Objeto 01</span><span>Caderno + crachá</span><span>Feito por encomenda</span></figcaption></figure>',
        '</section>',
        '<section class="mn-proof" id="testemunhos" aria-labelledby="mn-proof-title">',
          '<header><span>02 — Testemunhos</span><h2 id="mn-proof-title">Cinco estrelas.<br>Três frases.</h2><div>' + stars() + '<small>Textos provisórios</small></div></header>',
          '<article class="mn-lead-quote"><blockquote>“' + quotes[0].text + '”</blockquote><footer>' + quotes[0].source + '</footer></article>',
          '<div class="mn-small-quotes"><article><blockquote>“' + quotes[1].text + '”</blockquote><footer>' + quotes[1].source + '</footer></article><article><blockquote>“' + quotes[2].text + '”</blockquote><footer>' + quotes[2].source + '</footer></article></div>',
        '</section>',
        '<section class="mn-news" id="novidades" aria-labelledby="mn-news-title">',
          '<header><span>03 — Novidades</span><h2 id="mn-news-title">Novo no atelier.</h2></header>',
          '<div class="mn-stories">',
            '<a href="../molduras.html"><span class="mn-story-number">01</span><img src="../content/designs/quadros/exemplos/quadro-bodas-de-ouro.webp" alt="Moldura personalizada" loading="lazy"><span class="mn-story-copy"><small>Personalização</small><h3>Molduras à tua medida</h3><p>Fotos, cores e texto reunidos numa peça só.</p><b>↗</b></span></a>',
            '<a href="../congressos.html"><span class="mn-story-number">02</span><img src="../content/designs/cadernos/process/pack_com_crachas/pack_com_crachas_1.webp" alt="Pack de caderno e crachás" loading="lazy"><span class="mn-story-copy"><small>Congresso 2026</small><h3>Cadernos e lembranças</h3><p>Packs e combinações preparados para o congresso.</p><b>↗</b></span></a>',
          '</div>',
        '</section>',
        '<section class="mn-products" id="produtos" aria-labelledby="mn-products-title">',
          '<header><span>04 — Produtos</span><h2 id="mn-products-title">Sete categorias.<br>Sem atalhos visuais.</h2></header>',
          '<div class="mn-product-grid">' + monoProducts() + '</div>',
        '</section>',
        '<section class="mn-process" id="como-encomendar" aria-labelledby="mn-process-title"><header><span>05 — Processo</span><h2 id="mn-process-title">Escolher / definir / confirmar.</h2></header><div><article><b>01</b><p>Começa pela categoria.</p></article><article><b>02</b><p>Indica os detalhes.</p></article><article><b>03</b><p>Revê o pedido.</p></article></div></section>',
        '<section class="mn-final"><span>06 — Catálogo</span><h2>Produtos, opções e preços.</h2><a href="../catalogo/index.html">Abrir catálogo ↗</a></section>',
      '</main>'
    ].join("");
  }

  function renderBento() {
    var quoteTiles = quotes.map(function (quote, index) {
      return '<article class="bn-quote bn-quote--' + (index + 1) + '">' + stars() + '<blockquote>“' + quote.text + '”</blockquote><footer>' + quote.source + '</footer></article>';
    }).join("");

    return [
      '<main class="bn-main">',
        '<section class="bn-hero" id="inicio" aria-labelledby="bn-hero-title">',
          '<div class="bn-hero-copy"><p>Cadernos · molduras · lembranças</p><h1 id="bn-hero-title">Escolhe.<br>Personaliza.<br>Guarda.</h1><span>Produtos que começam numa base simples e acabam com a tua combinação.</span><nav><a href="#produtos">Explorar produtos →</a><a href="#novidades">Ver novidades</a></nav></div>',
          '<figure class="bn-hero-image"><img src="../content/designs/cadernos/process/caderno_normal_com_pin/caderno_normal_com_pin_6.webp" alt="Caderno espiral Mia & Paper com a ilustração Felicidade Eterna"></figure>',
          '<aside class="bn-hero-note"><span>Por encomenda</span><strong>Tempo para escolher bem.</strong><small>Sem produção em massa.</small></aside>',
          '<aside class="bn-hero-index"><span>Homepage study</span><strong>04</strong></aside>',
        '</section>',
        '<section class="bn-testimonials" id="testemunhos" aria-labelledby="bn-testimonials-title">',
          '<header><span>Testemunhos</span><h2 id="bn-testimonials-title">Quem encomenda conta melhor.</h2><small>Textos provisórios</small></header>',
          quoteTiles,
        '</section>',
        '<section class="bn-news" id="novidades" aria-labelledby="bn-news-title">',
          '<header><span>Novidades</span><h2 id="bn-news-title">Agora no atelier.</h2><p>Duas formas novas de preparar um pedido pessoal.</p></header>',
          '<a class="bn-news-card bn-news-card--large" href="../molduras.html"><img src="../content/designs/quadros/exemplos/quadro-bodas-de-ouro.webp" alt="Moldura personalizada" loading="lazy"><span><small>Personalização</small><strong>Molduras à tua medida</strong><b>↗</b></span></a>',
          '<a class="bn-news-card bn-news-card--small" href="../congressos.html"><img src="../content/designs/cadernos/process/pack_com_crachas/pack_com_crachas_1.webp" alt="Pack para congresso" loading="lazy"><span><small>Congresso 2026</small><strong>Cadernos e lembranças</strong><b>↗</b></span></a>',
        '</section>',
        '<section class="bn-products" id="produtos" aria-labelledby="bn-products-title">',
          '<header><div><span>Produtos</span><h2 id="bn-products-title">Uma grelha para começar.</h2></div><p>Cada bloco abre uma categoria e mantém a imagem no centro da decisão.</p></header>',
          '<div class="bn-product-grid">' + bentoProducts() + '</div>',
        '</section>',
        '<section class="bn-process" id="como-encomendar" aria-labelledby="bn-process-title">',
          '<header><span>Como encomendar</span><h2 id="bn-process-title">Três passos, sem labirinto.</h2></header>',
          '<article><b>01</b><strong>Escolher</strong><p>Encontra o produto e vê os formatos.</p></article><article><b>02</b><strong>Personalizar</strong><p>Junta textos, cores e fotos.</p></article><article><b>03</b><strong>Confirmar</strong><p>Revê tudo antes de avançar.</p></article>',
          '<a href="../catalogo/index.html">Abrir catálogo completo <span>↗</span></a>',
        '</section>',
      '</main>'
    ].join("");
  }

  var main = key === "mono" ? renderMono() : (key === "bento" ? renderBento() : renderEditorial());
  root.innerHTML = sharedHeader() + main + sharedFooter();
})();
