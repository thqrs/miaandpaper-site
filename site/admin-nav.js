(function () {
  "use strict";

  var script = document.currentScript;
  var prefix = script && script.dataset.prefix ? script.dataset.prefix : "";
  var params = new URLSearchParams(window.location.search || "");
  var path = window.location.pathname.replace(/\\/g, "/").replace(/\/+$/, "");
  var file = path.slice(path.lastIndexOf("/") + 1) || "index.html";
  var links = [
    { id: "products", label: "Produtos", href: "produtos.html", files: ["produtos.html"] },
    { id: "step-one-designs", label: "Designs Passo 1", href: "produtos.php", files: ["produtos.php"] },
    { id: "gallery", label: "Galeria", href: "galeria.html", files: ["galeria.html"] },
    { id: "media", label: "Multimédia", href: "multimedia.html", files: ["multimedia.html"] },
    { id: "photo-wizard", label: "Photo Wizard", href: "photo-wizard.php", files: ["photo-wizard.php"] },
    { id: "mockup-studio", label: "Mockups", href: "mockup-studio.php", files: ["mockup-studio.php"] },
    { id: "reviews", label: "Reviews", href: "reviews.html", files: ["reviews.html"] },
    { id: "faqs", label: "FAQs", href: "faqs.php", files: ["faqs.php"] },
    { id: "miu", label: "Míu", href: "bot.php", files: ["bot.php"] },
    { id: "miu-v2", label: "Míu V2 · Produção", href: "miu-v2.php", files: ["miu-v2.php"] },
    { id: "sprites", label: "Sprites", href: "sprites.php", files: ["sprites.php"] },
    { id: "miu-lab", label: "Míu Lab · Experimental", href: "miu-animation-lab.php", files: ["miu-animation-lab.php"] },
    { id: "miu-rig", label: "Míu Director V5 · Experimental", href: "miu-rig.php", files: ["miu-rig.php"] },
    { id: "miu-episodes", label: "Episódios Míu · Experimental", href: "miu-episodes.php", files: ["miu-episodes.php"] },
    { id: "errors", label: "Erros", href: "erros.php", files: ["erros.php"] },
    { id: "prices", label: "Preços", href: "precos.php", files: ["precos.php"] },
    { id: "materials", label: "Materiais", href: "materiais.php", files: ["materiais.php"] },
    { id: "home", label: "Homepage & Menu", href: "homepage-menu-design.php", files: ["homepage-menu-design.php"] },
    { id: "carousels", label: "Carrosséis", href: "carrousel.php", files: ["carrousel.php"] },
    { id: "funnel", label: "Funil", href: "admin-funnel.php", files: ["admin-funnel.php", "admin-live-dashboard.php"] },
    { id: "funnel-v2", label: "Funil live · Percurso", href: "funilv2.php", files: ["funilv2.php"] },
    { id: "tracking", label: "Tracking", href: "tracking.php", files: ["tracking.php"] },
    { id: "orders", label: "Encomendas", href: "admin-orders.php", files: ["admin-orders.php"] },
    { id: "colors", label: "Cores", href: "admin-colors.html", files: ["admin-colors.html"] },
    { id: "uploads", label: "Uploads", href: "admin-uploads.php", files: ["admin-uploads.php"] },
    { id: "comparador-argolas", label: "Comparador Argolas", href: "tools/comparador-argolas.php", files: ["comparador-argolas.php"] },
    { id: "tools", label: "Ferramentas", href: "tools/index.php", files: ["comando.php"] }
  ];
  var nav;
  var list;

  // Estes modos vivem dentro de outra ferramenta e não devem ganhar uma
  // segunda barra de navegação dentro do iframe.
  if (params.get("visitors") === "1" || params.get("embed") === "1") { return; }

  nav = document.createElement("nav");
  nav.className = "admin-global-nav";
  nav.setAttribute("aria-label", "Páginas de administração");
  nav.innerHTML = '<a class="admin-global-nav-brand" href="' + prefix
    + 'tools/index.php">Mia &amp; Paper <span>Admin</span></a>'
    + '<div class="admin-global-nav-links"></div>';
  list = nav.querySelector(".admin-global-nav-links");

  links.forEach(function (link) {
    var anchor = document.createElement("a");
    var active = link.files.indexOf(file) !== -1
      || (link.id === "tools" && path.indexOf("/tools/") !== -1);
    anchor.href = prefix + link.href;
    anchor.textContent = link.label;
    if (active) {
      anchor.className = "is-active";
      anchor.setAttribute("aria-current", "page");
    }
    list.appendChild(anchor);
  });

  document.body.insertBefore(nav, document.body.firstChild);
}());
