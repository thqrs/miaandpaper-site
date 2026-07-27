(function () {
  "use strict";

  var concepts = {
    gelato: {
      eyebrow: "Papelaria personalizada · feita por encomenda",
      title: "Ideias que ganham forma, uma encomenda de cada vez.",
      text: "Cadernos, molduras e pequenos objetos personalizados para oferecer, guardar ou tornar teus.",
      tag: "Escolhes a base. Afinamos contigo. A peça é preparada para o teu pedido."
    },
    editorial: {
      eyebrow: "Mia & Paper · atelier de papel",
      title: "Papel, memórias e peças com um lugar só teu.",
      text: "Uma seleção de cadernos, molduras e lembranças que podes adaptar à pessoa, à data e à história.",
      tag: "Peças preparadas em pequena escala, de acordo com cada encomenda."
    },
    mono: {
      eyebrow: "Objetos pessoais · sem produção em massa",
      title: "Personalização sem ruído.",
      text: "Escolhe um produto, diz-nos o que queres mudar e acompanha uma encomenda pensada para ti.",
      tag: "Uma ideia clara. As escolhas certas. Um resultado pessoal."
    },
    bento: {
      eyebrow: "Cadernos · molduras · lembranças",
      title: "Escolhe. Personaliza. Guarda.",
      text: "Produtos de papelaria e presentes que começam numa base simples e acabam com a tua combinação.",
      tag: "Feito por encomenda, com tempo para escolher bem."
    }
  };

  var key = document.body.dataset.concept || "gelato";
  var active = Number(document.body.dataset.mockupPage || "1");
  var concept = concepts[key] || concepts.gelato;
  var root = document.querySelector("#mockup-root");

  if (!root) {
    return;
  }

  function switchLink(number) {
    return '<a href="index' + number + '.html"' + (active === number ? ' aria-current="page"' : '') + ' aria-label="Abrir proposta ' + number + '">' + number + '</a>';
  }

  root.innerHTML = [
    '<header class="site-head">',
      '<a class="brand" href="index.html" aria-label="Ver todos os mockups">',
        '<img src="../content/brand/logo.webp" alt="" width="92" height="92">',
        '<span>Mia &amp; Paper</span>',
      '</a>',
      '<div class="head-actions">',
        '<a class="header-cta" href="../catalogo/index.html">Ver catálogo</a>',
        '<button class="menu-button" type="button" aria-label="Abrir menu" aria-expanded="false" data-menu-button><span class="menu-button-lines" aria-hidden="true"></span></button>',
      '</div>',
    '</header>',
    '<button class="menu-backdrop" type="button" aria-label="Fechar menu" data-menu-close></button>',
    '<aside class="menu-panel" aria-label="Menu principal" aria-hidden="true" data-menu-panel>',
      '<div class="menu-panel-head">',
        '<span class="brand"><img src="../content/brand/logo.webp" alt="" width="92" height="92"><span>Mia &amp; Paper</span></span>',
        '<button class="menu-close" type="button" aria-label="Fechar menu" data-menu-close>×</button>',
      '</div>',
      '<nav class="menu-links">',
        '<a href="#inicio">Início</a>',
        '<a href="#testemunhos">Testemunhos</a>',
        '<a href="#novidades">Novidades</a>',
        '<a href="#produtos">Produtos</a>',
        '<a href="#como-encomendar">Como encomendar</a>',
        '<a href="../catalogo/index.html">Catálogo simples</a>',
      '</nav>',
      '<p class="menu-note">Mockup visual isolado. A homepage real não foi alterada.</p>',
    '</aside>',
    '<main>',
      '<section class="hero" id="inicio" aria-labelledby="hero-title">',
        '<div class="hero-copy">',
          '<p class="eyebrow">' + concept.eyebrow + '</p>',
          '<h1 id="hero-title">' + concept.title + '</h1>',
          '<p>' + concept.text + '</p>',
          '<div class="hero-actions">',
            '<a class="button button--primary" href="#produtos">Explorar produtos →</a>',
            '<a class="button button--secondary" href="#novidades">Ver novidades</a>',
          '</div>',
        '</div>',
        '<div class="hero-visual">',
          '<img src="../content/designs/cadernos/process/caderno_normal_com_pin/caderno_normal_com_pin_6.webp" alt="Caderno espiral Mia & Paper com a ilustração Felicidade Eterna" width="1200" height="900">',
          '<span class="hero-tag">' + concept.tag + '</span>',
        '</div>',
      '</section>',
      '<section class="trust-section" id="testemunhos" aria-labelledby="testemunhos-title">',
        '<div class="rating-line">',
          '<h2 id="testemunhos-title">Peças que chegam e ficam.</h2>',
          '<div class="rating-score"><span class="stars" aria-label="5 estrelas">★★★★★</span><small>5 estrelas · textos provisórios</small></div>',
        '</div>',
        '<div class="testimonials">',
          '<article class="testimonial">',
            '<span class="stars" aria-hidden="true">★★★★★</span>',
            '<blockquote>“Foi fácil explicar o que queria e acompanhar as escolhas até chegar à versão final.”</blockquote>',
            '<footer>Cliente · encomenda personalizada</footer>',
          '</article>',
          '<article class="testimonial">',
            '<span class="stars" aria-hidden="true">★★★★★</span>',
            '<blockquote>“A moldura ficou muito pessoal sem perder a simplicidade. Era mesmo o presente que procurava.”</blockquote>',
            '<footer>Cliente · moldura personalizada</footer>',
          '</article>',
          '<article class="testimonial">',
            '<span class="stars" aria-hidden="true">★★★★★</span>',
            '<blockquote>“Consegui escolher o produto e perceber todas as opções sem tornar o pedido complicado.”</blockquote>',
            '<footer>Cliente · papelaria personalizada</footer>',
          '</article>',
        '</div>',
      '</section>',
      '<section class="section news-section" id="novidades" aria-labelledby="novidades-title">',
        '<header class="section-heading">',
          '<div><p class="eyebrow">Novidades</p><h2 id="novidades-title">O que chegou ao atelier.</h2></div>',
          '<p>Novos produtos e novas formas de personalizar o teu pedido, apresentados sem ruído.</p>',
        '</header>',
        '<div class="news-grid">',
          '<a class="news-card" href="../molduras.html">',
            '<span class="news-card-media"><img src="../content/designs/quadros/exemplos/quadro-bodas-de-ouro.webp" alt="Moldura personalizada para bodas de ouro" loading="lazy"></span>',
            '<span class="news-card-copy"><span class="news-label">Personalização</span><h3>Molduras feitas à tua medida</h3><p>Escolhe o estilo, as cores e o texto, e envia as fotos diretamente no pedido.</p><span class="text-link">Criar uma moldura →</span></span>',
          '</a>',
          '<a class="news-card" href="../congressos.html">',
            '<span class="news-card-media"><img src="../content/designs/cadernos/process/pack_com_crachas/pack_com_crachas_1.webp" alt="Conjunto de caderno e crachás para congresso" loading="lazy"></span>',
            '<span class="news-card-copy"><span class="news-label">Congresso 2026</span><h3>Cadernos e lembranças</h3><p>Consulta os packs disponíveis e prepara a tua encomenda para o congresso.</p><span class="text-link">Ver produtos do congresso →</span></span>',
          '</a>',
        '</div>',
      '</section>',
      '<section class="section products-section" id="produtos" aria-labelledby="produtos-title">',
        '<header class="section-heading">',
          '<div><p class="eyebrow">Produtos</p><h2 id="produtos-title">Começa pela categoria certa.</h2></div>',
          '<p>Sete pontos de partida. Em cada página encontras as opções, os materiais e a forma de personalizar.</p>',
        '</header>',
        '<div class="product-grid">',
          '<a class="product-card" href="../cadernos.html"><img src="../content/designs/cadernos/novos/a_jovem_cadeira/a_jovem_cadeira_matte.webp" alt="Caderno com capa ilustrada" loading="lazy"><span class="product-copy"><span><h3>Cadernos</h3><p>Para escrever, guardar e oferecer.</p></span><span class="product-arrow" aria-hidden="true">→</span></span></a>',
          '<a class="product-card" href="../molduras.html"><img src="../content/designs/quadros/exemplos/quadro-bodas-de-ouro.webp" alt="Moldura personalizada" loading="lazy"><span class="product-copy"><span><h3>Molduras</h3><p>Peças personalizadas para a tua casa.</p></span><span class="product-arrow" aria-hidden="true">→</span></span></a>',
          '<a class="product-card" href="../crachas.html"><img src="../content/designs/crachas/novidades/braille-01.webp" alt="Crachá ilustrado" loading="lazy"><span class="product-copy"><span><h3>Crachás</h3><p>Pequenos detalhes com significado.</p></span><span class="product-arrow" aria-hidden="true">→</span></span></a>',
          '<a class="product-card" href="../postais.html"><img src="../ofertas/convite-congresso/assets/modelo-casal.webp" alt="Postal ilustrado" loading="lazy"><span class="product-copy"><span><h3>Postais</h3><p>Mensagens para guardar.</p></span><span class="product-arrow" aria-hidden="true">→</span></span></a>',
          '<a class="product-card" href="../agendas.html"><img src="../content/designs/cadernos/novos/vestido_verde/vestido_verde_matte.webp" alt="Agenda com capa ilustrada" loading="lazy"><span class="product-copy"><span><h3>Agendas</h3><p>Para organizar os teus dias.</p></span><span class="product-arrow" aria-hidden="true">→</span></span></a>',
          '<a class="product-card" href="../imanes.html"><img src="../content/designs/Fotos_dos_Imans/esperanca/esperanca-01.webp" alt="Íman ilustrado" loading="lazy"><span class="product-copy"><span><h3>Ímanes</h3><p>Um toque especial no frigorífico.</p></span><span class="product-arrow" aria-hidden="true">→</span></span></a>',
          '<a class="product-card" href="../congressos.html"><img src="../content/designs/cadernos/process/pack_com_crachas/pack_com_crachas_5.webp" alt="Pack de caderno e crachás" loading="lazy"><span class="product-copy"><span><h3>Congressos</h3><p>Lembranças e cadernos do congresso.</p></span><span class="product-arrow" aria-hidden="true">→</span></span></a>',
        '</div>',
      '</section>',
      '<section class="process-section" id="como-encomendar" aria-labelledby="processo-title">',
        '<header class="process-heading"><h2 id="processo-title">Do primeiro clique ao pedido final.</h2><p>O processo mantém-se curto e claro, mesmo quando há muitos pormenores para escolher.</p></header>',
        '<div class="process-steps">',
          '<article class="process-step"><span>01 · ESCOLHER</span><h3>Encontra o produto</h3><p>Vê os tamanhos, formatos e exemplos disponíveis em cada categoria.</p></article>',
          '<article class="process-step"><span>02 · PERSONALIZAR</span><h3>Define os detalhes</h3><p>Indica textos, cores, quantidades e envia as fotos quando necessário.</p></article>',
          '<article class="process-step"><span>03 · CONFIRMAR</span><h3>Revê antes de avançar</h3><p>O pedido é confirmado contigo antes de ser preparado.</p></article>',
        '</div>',
      '</section>',
      '<section class="final-cta" aria-labelledby="final-title">',
        '<h2 id="final-title">Já sabes o que procuras?</h2>',
        '<a class="button" href="../catalogo/index.html">Abrir catálogo →</a>',
      '</section>',
    '</main>',
    '<footer class="site-footer">',
      '<span>© Mia &amp; Paper 2026 · mockup visual</span>',
      '<nav class="footer-links" aria-label="Rodapé"><a href="../privacy.html">Privacidade</a><a href="../contacto.html">Contacto</a><a href="index.html">Todos os mockups</a></nav>',
    '</footer>',
    '<nav class="mockup-switcher" aria-label="Mudar de proposta">',
      '<a href="index.html" aria-label="Ver todas as propostas">Todos</a>',
      switchLink(1), switchLink(2), switchLink(3), switchLink(4),
    '</nav>'
  ].join("");
})();
