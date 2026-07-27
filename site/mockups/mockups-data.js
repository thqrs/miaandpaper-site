/*
  Dados partilhados dos mockups da homepage (propostas 05+).
  Expõe window.MIA com o conteúdo real da Mia & Paper e alguns helpers.
  Não altera nem depende dos ficheiros das propostas 01–04.
*/
(function () {
  "use strict";

  var BASE = "../";

  var MIA = {
    base: BASE,
    logo: BASE + "content/brand/logo.webp",
    catalog: BASE + "catalogo/index.html",
    totalPages: 10,

    hero: {
      image: BASE + "content/designs/cadernos/process/caderno_normal_com_pin/caderno_normal_com_pin_6.webp",
      alt: "Caderno espiral Mia & Paper com a ilustração Felicidade Eterna"
    },

    nav: [
      { href: "#inicio", label: "Início" },
      { href: "#testemunhos", label: "Testemunhos" },
      { href: "#novidades", label: "Novidades" },
      { href: "#produtos", label: "Produtos" },
      { href: "#como-encomendar", label: "Como encomendar" }
    ],

    products: [
      { name: "Cadernos", text: "Para escrever, guardar e oferecer.", href: BASE + "cadernos.html", image: BASE + "content/designs/cadernos/novos/a_jovem_cadeira/a_jovem_cadeira_matte.webp", alt: "Caderno com capa ilustrada" },
      { name: "Molduras", text: "Peças personalizadas para a tua casa.", href: BASE + "molduras.html", image: BASE + "content/designs/quadros/exemplos/quadro-bodas-de-ouro.webp", alt: "Moldura personalizada" },
      { name: "Crachás", text: "Pequenos detalhes com significado.", href: BASE + "crachas.html", image: BASE + "content/designs/crachas/novidades/braille-01.webp", alt: "Crachá ilustrado" },
      { name: "Postais", text: "Mensagens para guardar.", href: BASE + "postais.html", image: BASE + "ofertas/convite-congresso/assets/modelo-casal.webp", alt: "Postal ilustrado" },
      { name: "Agendas", text: "Para organizar os teus dias.", href: BASE + "agendas.html", image: BASE + "content/designs/cadernos/novos/vestido_verde/vestido_verde_matte.webp", alt: "Agenda com capa ilustrada" },
      { name: "Ímanes", text: "Um toque especial no frigorífico.", href: BASE + "imanes.html", image: BASE + "content/designs/Fotos_dos_Imans/esperanca/esperanca-01.webp", alt: "Íman ilustrado" },
      { name: "Congressos", text: "Lembranças e cadernos do congresso.", href: BASE + "congressos.html", image: BASE + "content/designs/cadernos/process/pack_com_crachas/pack_com_crachas_5.webp", alt: "Pack de caderno e crachás" }
    ],

    quotes: [
      { text: "Foi fácil explicar o que queria e acompanhar as escolhas até chegar à versão final.", source: "Cliente · encomenda personalizada" },
      { text: "A moldura ficou muito pessoal sem perder a simplicidade. Era mesmo o presente que procurava.", source: "Cliente · moldura personalizada" },
      { text: "Consegui escolher o produto e perceber todas as opções sem tornar o pedido complicado.", source: "Cliente · papelaria personalizada" }
    ],

    news: [
      { label: "Personalização", title: "Molduras feitas à tua medida", text: "Escolhe o estilo, as cores e o texto, e envia as fotos diretamente no pedido.", cta: "Criar uma moldura", href: BASE + "molduras.html", image: BASE + "content/designs/quadros/exemplos/quadro-bodas-de-ouro.webp", alt: "Moldura personalizada para bodas de ouro" },
      { label: "Congresso 2026", title: "Cadernos e lembranças", text: "Consulta os packs disponíveis e prepara a tua encomenda para o congresso.", cta: "Ver produtos do congresso", href: BASE + "congressos.html", image: BASE + "content/designs/cadernos/process/pack_com_crachas/pack_com_crachas_1.webp", alt: "Conjunto de caderno e crachás para congresso" }
    ],

    process: [
      { n: "01", key: "Escolher", title: "Encontra o produto", text: "Vê os tamanhos, formatos e exemplos disponíveis em cada categoria." },
      { n: "02", key: "Personalizar", title: "Define os detalhes", text: "Indica textos, cores, quantidades e envia as fotos quando necessário." },
      { n: "03", key: "Confirmar", title: "Revê antes de avançar", text: "O pedido é confirmado contigo antes de ser preparado." }
    ]
  };

  // Barra de troca de proposta (rolável, cabe em ecrãs de 300px).
  MIA.switcherHTML = function (active) {
    var items = ['<a href="index.html" aria-label="Ver todas as propostas">Todos</a>'];
    for (var i = 1; i <= MIA.totalPages; i++) {
      var num = i < 10 ? "0" + i : "" + i;
      items.push(
        '<a href="index' + i + '.html"' +
        (active === i ? ' aria-current="page"' : "") +
        ' aria-label="Abrir proposta ' + num + '">' + num + "</a>"
      );
    }
    return '<nav class="mk-switcher" aria-label="Mudar de proposta">' + items.join("") + "</nav>";
  };

  // Liga o botão de menu (usa a convenção data-menu-*).
  MIA.wireMenu = function () {
    var button = document.querySelector("[data-menu-button]");
    var panel = document.querySelector("[data-menu-panel]");
    var closers = document.querySelectorAll("[data-menu-close]");
    if (!button || !panel) return;

    function setMenu(open) {
      document.body.classList.toggle("menu-is-open", open);
      button.setAttribute("aria-expanded", open ? "true" : "false");
      panel.setAttribute("aria-hidden", open ? "false" : "true");
    }
    button.addEventListener("click", function () {
      setMenu(!document.body.classList.contains("menu-is-open"));
    });
    closers.forEach(function (c) { c.addEventListener("click", function () { setMenu(false); }); });
    panel.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { setMenu(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setMenu(false);
    });
  };

  // Pequenos utilitários de escape para montar markup em segurança.
  MIA.esc = function (s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };

  window.MIA = MIA;
})();
