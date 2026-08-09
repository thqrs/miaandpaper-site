// js/08-menu-site.js — parte 08/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: menu do site (bindSiteMenu, hrefs de categorias, gestos de abrir/fechar).
  function siteMenuCategoryHref(category) {
    var href = category ? String(category.menuHref || category.href || "").trim() : "";
    return href || "index.html";
  }

  // MENU_ICONES_V1: `menuShowIcons` no content/home.json liga e desliga os
  // icones do hamburguer. Por omissao ficam ligados, para nao mudar o menu de
  // quem nunca tocou na definicao. Edita-se em homepage-menu-design.php.
  function siteMenuIconsEnabled() {
    return !(state.home && state.home.menuShowIcons === false);
  }

  // MENU_ACORDEAO_V1: por omissao fica desligado (as seccoes acumulam-se
  // abertas), que e o comportamento menos surpreendente.
  function siteMenuAccordionEnabled() {
    return !!(state.home && state.home.menuAccordion);
  }

  function renderSiteMenuIcon(iconName, modifier) {
    if (!siteMenuIconsEnabled()) {
      return "";
    }
    var safeName = String(iconName || "catalogo").replace(/[^a-z0-9-]/gi, "");
    return '<span class="site-menu-icon' + (modifier ? ' ' + modifier : '') + '" aria-hidden="true">'
      + '<img src="content/brand/menu-icons/line-art/' + safeName + '.webp" alt="" width="64" height="64">'
      + '</span>';
  }

  function siteMenuGroupIcon(group) {
    var order = Number(group && group.order);
    if (order === 1) { return "grupo-personalizados"; }
    if (order === 2) { return "grupo-cadernos-papelaria"; }
    if (order === 3) { return "grupo-crachas-imanes"; }
    if (order === 4) { return "grupo-colecoes-ofertas"; }
    return "catalogo";
  }

  function siteMenuCategoryIcon(category) {
    // MENU_ICONE_POR_ENTRADA_V1: `menuIcon` no content/home.json manda sobre os
    // aliases, para se poder escolher o icone em homepage-menu-design.php sem
    // mexer neste mapa. Sem `menuIcon`, o comportamento e o de sempre.
    var escolhido = String(category && category.menuIcon ? category.menuIcon : "").trim();
    if (escolhido !== "") {
      return escolhido;
    }

    var id = String(category && category.id ? category.id : "").trim();
    var aliases = {
      "cadernos-geral": "cadernos",
      "mini-cadernos-geral": "mini-cadernos",
      "quadros": "molduras",
      "crachas-geral": "crachas",
      "imanes-geral": "imanes",
      // Ícone provisório enquanto os marcadores magnéticos não têm arte final.
      "marcadores-magneticos": "marcadores"
    };
    return aliases[id] || id || "catalogo";
  }

  function renderSiteMenu(categories, instagramUrl) {
    var isOpen = state.siteMenuOpen === true;
    var orderedCategories = categories.map(function (category, index) {
      return { category: category, index: index };
    }).sort(function (a, b) {
      var aOrder = Number(a.category && a.category.menuOrder);
      var bOrder = Number(b.category && b.category.menuOrder);
      aOrder = isFinite(aOrder) && aOrder > 0 ? aOrder : 1000 + a.index;
      bOrder = isFinite(bOrder) && bOrder > 0 ? bOrder : 1000 + b.index;
      return aOrder - bOrder;
    }).map(function (record) {
      return record.category;
    });
    var menuGroups = [];

    orderedCategories.forEach(function (category, categoryIndex) {
      var title = String(category.menuGroup || "Produtos").trim() || "Produtos";
      var order = Number(category.menuGroupOrder);
      var group = menuGroups.filter(function (record) {
        return record.title === title;
      })[0];

      if (!group) {
        group = {
          title: title,
          order: isFinite(order) && order > 0 ? order : 1000 + categoryIndex,
          categories: []
        };
        menuGroups.push(group);
      }
      group.categories.push(category);
    });

    menuGroups.sort(function (a, b) {
      return a.order - b.order;
    });

    var groupedCategoryLinks = menuGroups.map(function (group) {
      var links = group.categories.map(function (category) {
        return [
          '<a class="site-menu-category-link" href="' + escapeHtml(siteMenuCategoryHref(category)) + '" data-site-menu-link>',
          '<span class="site-menu-category-main">',
          renderSiteMenuIcon(siteMenuCategoryIcon(category), 'site-menu-icon--category'),
          '<span>' + escapeHtml(category.menuTitle || category.title || "Produto") + '</span>',
          '</span>',
          '<b aria-hidden="true">→</b>',
          '</a>'
        ].join("");
      }).join("");

      return [
        '<details class="site-menu-group" data-site-menu-group>',
        '<summary class="site-menu-group-summary">',
        '<span class="site-menu-entry-label">',
        renderSiteMenuIcon(siteMenuGroupIcon(group), 'site-menu-icon--group'),
        '<span>' + escapeHtml(group.title) + '</span>',
        '</span>',
        '<span class="site-menu-group-chevron" aria-hidden="true"></span>',
        '</summary>',
        '<div class="site-menu-group-links">' + links + '</div>',
        '</details>'
      ].join("");
    }).join("");

    return [
      '<div class="site-menu-surface' + (isOpen ? ' is-open' : '') + '" id="site-menu" data-site-menu-surface aria-hidden="' + (isOpen ? 'false' : 'true') + '">',
      '<button type="button" class="site-menu-backdrop" data-site-menu-close aria-label="Fechar menu"></button>',
      '<aside class="site-menu-panel" role="dialog" aria-modal="true" aria-labelledby="site-menu-title">',
      '<div class="site-menu-head">',
      '<div><p>Menu</p><h2 id="site-menu-title">Mia &amp; Paper</h2></div>',
      '<button type="button" class="site-menu-close" data-site-menu-close aria-label="Fechar menu">' + ICON_CLOSE + '</button>',
      '</div>',
      '<nav class="site-menu-nav" aria-label="Navegação principal">',
      '<a class="site-menu-home-link" href="index.html" data-site-menu-link>',
      '<span class="site-menu-entry-label">' + renderSiteMenuIcon('inicio') + '<span>Início</span></span>',
      '</a>',
      groupedCategoryLinks,
      '</nav>',
      '<div class="site-menu-secondary">',
      '<a href="catalogo/index.html" data-site-menu-link>' + renderSiteMenuIcon('catalogo') + '<span>Catálogo</span></a>',
      '<a href="contacto.html" data-site-menu-link>' + renderSiteMenuIcon('contacto') + '<span>Contacto</span></a>',
      '<a href="' + escapeHtml(instagramUrl || "https://www.instagram.com/miaandpaper/") + '" target="_blank" rel="noopener" data-site-menu-link>' + renderSiteMenuIcon('instagram') + '<span>Instagram</span></a>',
      '</div>',
      '</aside>',
      '</div>'
    ].join("");
  }

  function resetSiteMenuDrag(surface) {
    var panel = surface ? surface.querySelector(".site-menu-panel") : null;
    var backdrop = surface ? surface.querySelector(".site-menu-backdrop") : null;

    siteMenuGesture = null;
    if (panel) {
      panel.classList.remove("is-dragging");
      panel.style.removeProperty("transform");
    }
    if (backdrop) {
      backdrop.style.removeProperty("opacity");
    }
  }

  function bindSiteMenuSwipe(surface) {
    var panel = surface ? surface.querySelector(".site-menu-panel") : null;
    var backdrop = surface ? surface.querySelector(".site-menu-backdrop") : null;

    if (!panel || panel.dataset.siteMenuSwipeBound === "1") {
      return;
    }
    panel.dataset.siteMenuSwipeBound = "1";

    panel.addEventListener("pointerdown", function (event) {
      if (!state.siteMenuOpen || event.isPrimary === false || (event.button != null && event.button !== 0)) {
        return;
      }
      siteMenuGesture = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startedAt: Date.now(),
        distance: 0,
        dragging: false
      };
    });

    panel.addEventListener("pointermove", function (event) {
      var gesture = siteMenuGesture;
      var deltaX;
      var deltaY;
      var width;

      if (!gesture || gesture.pointerId !== event.pointerId || !state.siteMenuOpen) {
        return;
      }

      deltaX = event.clientX - gesture.startX;
      deltaY = event.clientY - gesture.startY;
      if (!gesture.dragging) {
        if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) {
          return;
        }
        if (deltaX <= 0 || Math.abs(deltaY) >= Math.abs(deltaX)) {
          siteMenuGesture = null;
          return;
        }
        gesture.dragging = true;
        panel.classList.add("is-dragging");
        if (panel.setPointerCapture) {
          try {
            panel.setPointerCapture(event.pointerId);
          } catch (error) {
            /* Alguns browsers não permitem captura em eventos simulados. */
          }
        }
      }

      gesture.distance = Math.max(0, deltaX);
      width = Math.max(1, panel.getBoundingClientRect().width);
      panel.style.transform = "translateX(" + Math.min(width, gesture.distance) + "px)";
      if (backdrop) {
        backdrop.style.opacity = String(Math.max(0, 1 - (gesture.distance / width)));
      }
      if (event.cancelable) {
        event.preventDefault();
      }
    }, { passive: false });

    function finishSwipe(event) {
      var gesture = siteMenuGesture;
      var width;
      var elapsed;
      var velocity;
      var shouldClose;

      if (!gesture || gesture.pointerId !== event.pointerId) {
        return;
      }
      if (!gesture.dragging) {
        siteMenuGesture = null;
        return;
      }

      width = Math.max(1, panel.getBoundingClientRect().width);
      elapsed = Math.max(1, Date.now() - gesture.startedAt);
      velocity = gesture.distance / elapsed;
      shouldClose = gesture.distance >= Math.min(88, width * 0.24) || (gesture.distance >= 36 && velocity >= 0.55);
      siteMenuSuppressClickUntil = Date.now() + 350;
      resetSiteMenuDrag(surface);
      if (shouldClose) {
        setSiteMenuOpen(false, true);
      }
      if (event.cancelable) {
        event.preventDefault();
      }
    }

    panel.addEventListener("pointerup", finishSwipe);
    panel.addEventListener("pointercancel", function (event) {
      if (siteMenuGesture && siteMenuGesture.pointerId === event.pointerId) {
        resetSiteMenuDrag(surface);
      }
    });
    panel.addEventListener("click", function (event) {
      if (Date.now() < siteMenuSuppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  }

  function setSiteMenuOpen(open, restoreFocus) {
    var surface = document.querySelector("[data-site-menu-surface]");
    var trigger = document.querySelector("[data-site-menu-open]");
    var closeButton = surface ? surface.querySelector(".site-menu-close") : null;

    resetSiteMenuDrag(surface);
    state.siteMenuOpen = open === true;
    document.body.classList.toggle("is-site-menu-open", state.siteMenuOpen);

    if (surface) {
      surface.classList.toggle("is-open", state.siteMenuOpen);
      surface.setAttribute("aria-hidden", state.siteMenuOpen ? "false" : "true");
      if (!state.siteMenuOpen) {
        surface.querySelectorAll("[data-site-menu-group]").forEach(function (group) {
          group.removeAttribute("open");
        });
      }
    }
    if (trigger) {
      trigger.setAttribute("aria-expanded", state.siteMenuOpen ? "true" : "false");
    }

    if (state.siteMenuOpen && closeButton) {
      window.requestAnimationFrame(function () {
        closeButton.focus();
      });
    } else if (!state.siteMenuOpen && restoreFocus && trigger) {
      trigger.focus();
    }
  }

  function bindSiteMenu() {
    var trigger = document.querySelector("[data-site-menu-open]");
    var surface = document.querySelector("[data-site-menu-surface]");

    if (!trigger || !surface) {
      document.body.classList.remove("is-site-menu-open");
      return;
    }

    if (trigger.dataset.siteMenuBound !== "1") {
      trigger.dataset.siteMenuBound = "1";
      trigger.addEventListener("click", function (event) {
        event.preventDefault();
        setSiteMenuOpen(true, false);
      });
    }

    surface.querySelectorAll("[data-site-menu-close]").forEach(function (button) {
      if (button.dataset.siteMenuBound === "1") {
        return;
      }
      button.dataset.siteMenuBound = "1";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        setSiteMenuOpen(false, true);
      });
    });

    surface.querySelectorAll("[data-site-menu-link]").forEach(function (link) {
      if (link.dataset.siteMenuBound === "1") {
        return;
      }
      link.dataset.siteMenuBound = "1";
      link.addEventListener("click", function () {
        setSiteMenuOpen(false, false);
      });
    });

    surface.querySelectorAll("[data-site-menu-group]").forEach(function (group) {
      if (group.dataset.siteMenuBound === "1") {
        return;
      }
      group.dataset.siteMenuBound = "1";
      group.addEventListener("toggle", function () {
        // MENU_ACORDEAO_V1: fechar as outras seccoes ao abrir uma so acontece
        // se `menuAccordion` estiver ligado no content/home.json. Antes era
        // sempre — o interruptor em homepage-menu-design.php nao fazia nada.
        // Desligado, as seccoes ficam todas abertas a medida que se abrem.
        if (!group.open || !siteMenuAccordionEnabled()) {
          return;
        }
        surface.querySelectorAll("[data-site-menu-group][open]").forEach(function (otherGroup) {
          if (otherGroup !== group) {
            otherGroup.removeAttribute("open");
          }
        });
      });
    });

    bindSiteMenuSwipe(surface);

    if (!siteMenuEscapeBound) {
      siteMenuEscapeBound = true;
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && state.siteMenuOpen) {
          setSiteMenuOpen(false, true);
        }
      });
    }
  }

  function renderBrand(brand, homeUrl, instagramUrl, menuCategories) {
    var brandLabel = brand || "Mia & Paper";
    var categories = Array.isArray(menuCategories) ? menuCategories.filter(homeCategoryIsVisible) : [];
    var hasSiteMenu = categories.length > 0;
    var actions = hasSiteMenu ? [
      renderCartHeaderButton(),
      '<button type="button" class="header-link header-link-icon site-menu-trigger" data-site-menu-open aria-expanded="' + (state.siteMenuOpen ? 'true' : 'false') + '" aria-controls="site-menu" aria-label="Abrir menu" title="Menu">' + ICON_MENU + '</button>',
      '<button type="button" class="header-link header-link-icon header-theme-toggle" data-theme-toggle aria-pressed="false" aria-hidden="true" hidden aria-label="Modo escuro" title="Modo escuro">' + ICON_SUN + '</button>'
    ].join("") : [
      '<a class="header-link header-link-icon" href="' + escapeHtml(instagramUrl) + '" target="_blank" rel="noopener" aria-label="Instagram" title="Instagram">' + ICON_INSTAGRAM + '</a>',
      '<a class="header-link header-link-icon" href="contacto.html" aria-label="Enviar mensagem" title="Enviar mensagem">' + ICON_MAIL + '</a>',
      renderCartHeaderButton(),
      '<button type="button" class="header-link header-link-icon header-theme-toggle" data-theme-toggle aria-pressed="false" aria-hidden="true" hidden aria-label="Modo escuro" title="Modo escuro">' + ICON_SUN + '</button>'
    ].join("");

    return [
      '<header class="site-header' + (hasSiteMenu ? ' has-site-menu' : '') + '">',
      '<a class="brand" href="' + escapeHtml(homeUrl || "index.html") + '" aria-label="' + escapeHtml(brandLabel) + '">',
      '<span class="brand-mark"><img src="content/brand/logo.webp" alt="" loading="lazy"></span>',
      renderBrandText(brandLabel),
      '</a>',
      '<nav class="header-actions" aria-label="Links rápidos">' + actions + '</nav>',
      '</header>',
      hasSiteMenu ? renderSiteMenu(categories, instagramUrl) : ""
    ].join("");
  }

  function installStaticSiteNavigation(home) {
    var header = document.querySelector(".site-header");
    var footer = document.querySelector(".site-footer");
    var categories = home && Array.isArray(home.categories) ? home.categories.filter(homeCategoryIsVisible) : [];
    var template;

    if (!header || !categories.length) {
      return;
    }

    state.siteMenuCategories = categories;
    template = document.createElement("template");
    template.innerHTML = renderBrand(home.brand || "Mia & Paper", "index.html", home.instagramUrl, categories);
    header.replaceWith(template.content.cloneNode(true));

    if (footer) {
      template = document.createElement("template");
      template.innerHTML = renderFooter(home.brand || "Mia & Paper", false);
      footer.replaceWith(template.content.cloneNode(true));
    }

    if (!document.querySelector("[data-cart-surface]")) {
      document.body.insertAdjacentHTML("beforeend", renderCartSurface());
    }

    bindSiteMenu();
    bindCartUi();
    bindThemeToggle();
    refreshCartUi();
  }

  function renderFooter(brand, showAdminLogin) {
    return [
      '<footer class="site-footer">',
      '<a class="catalog-footer-link" href="catalogo/index.html">Comprar por catálogo</a>',
      '<a href="privacy.html">Política de Privacidade</a>',
      showAdminLogin === false ? "" : '<button type="button" data-admin-open>Login de Administrador</button>',
      '<span>© ' + escapeHtml(brand || "Mia & Paper") + ' 2026 Todos os Direitos Reservados</span>',
      '</footer>'
    ].join("");
  }

  function centsToEuroInput(cents) {
    return (Math.max(0, Number(cents) || 0) / 100).toFixed(2).replace(".", ",");
  }
