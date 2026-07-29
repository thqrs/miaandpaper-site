(function () {
  "use strict";

  var script = document.currentScript;
  var prefix = script && script.dataset.prefix ? script.dataset.prefix : "";
  var params = new URLSearchParams(window.location.search || "");
  var path = window.location.pathname.replace(/\\/g, "/").replace(/\/+$/, "");
  var file = path.slice(path.lastIndexOf("/") + 1) || "index.html";
  var links = [
    { id: "products", label: "Produtos", href: "produtos.html", files: ["produtos.html"] },
    { id: "gallery", label: "Galeria", href: "galeria.html", files: ["galeria.html"] },
    { id: "media", label: "Multimédia", href: "multimedia.html", files: ["multimedia.html"] },
    { id: "reviews", label: "Reviews", href: "reviews.html", files: ["reviews.html"] },
    { id: "funnel", label: "Funil", href: "admin-funnel.php", files: ["admin-funnel.php", "admin-live-dashboard.php"] },
    { id: "orders", label: "Encomendas", href: "admin-orders.php", files: ["admin-orders.php"] },
    { id: "colors", label: "Cores", href: "admin-colors.html", files: ["admin-colors.html"] },
    { id: "uploads", label: "Uploads", href: "admin-uploads.php", files: ["admin-uploads.php"] },
    { id: "tools", label: "Ferramentas", href: "tools/index.php", files: [] }
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
