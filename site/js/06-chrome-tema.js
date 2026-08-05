// js/06-chrome-tema.js — parte 06/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: renderChrome (estrutura header/footer), banner de encomendas suspensas, tema claro/escuro (currentTheme/applyTheme/setTheme/bindThemeToggle).
  function renderChrome(innerHtml, currentProduct) {
    app.innerHTML = renderOrdersSuspendedBanner() + innerHtml + renderAdminSurface(currentProduct) + renderCartSurface();
    if (state.home) {
      applyThemeToggleVisibility(state.home.showThemeToggle === true);
    }
    bindAdminSurface(currentProduct);
    bindThemeToggle();
    bindCartUi();
    bindSiteMenu();
    applyTheme(currentTheme());
  }

  function renderOrdersSuspendedBanner() {
    if (!ordersAreSuspended()) {
      return "";
    }

    return '<div class="orders-suspended-banner" role="status">' + escapeHtml(ordersSuspendedBannerMessage()) + '</div>';
  }

  function currentTheme() {
    var stored;
    try {
      stored = window.localStorage.getItem(THEME_KEY);
    } catch (error) {
      stored = null;
    }
    return stored === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    var root = document.documentElement;
    var resolved = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", resolved);
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      var nextLabel = resolved === "dark" ? "Modo claro" : "Modo escuro";
      var icon = resolved === "dark" ? ICON_MOON : ICON_SUN;
      button.setAttribute("aria-pressed", resolved === "dark" ? "true" : "false");
      button.setAttribute("aria-label", nextLabel);
      button.setAttribute("title", nextLabel);
      button.innerHTML = icon;
    });
  }

  function setTheme(theme) {
    var resolved = theme === "dark" ? "dark" : "light";
    try {
      window.localStorage.setItem(THEME_KEY, resolved);
    } catch (error) {
      /* noop */
    }
    applyTheme(resolved);
  }

  function bindThemeToggle() {
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      if (button.dataset.themeToggleBound === "1") {
        return;
      }
      button.dataset.themeToggleBound = "1";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        setTheme(currentTheme() === "dark" ? "light" : "dark");
      });
    });
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function createCartId() {
    return "cart_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function getEmptyCart() {
    var createdAt = nowIso();
    return {
      schemaVersion: CART_SCHEMA_VERSION,
      cartId: createCartId(),
      createdAt: createdAt,
      updatedAt: createdAt,
      items: []
    };
  }

  function normalizeCartItem(item) {
    var source = item && typeof item === "object" ? item : {};
    var summary = source.summary && typeof source.summary === "object" ? source.summary : {};
    var id = String(source.id || "").trim();
    var priceCents = summary.priceCents == null ? 0 : parseInt(summary.priceCents, 10);
    var productSlugValue = String(source.productSlug || "").trim();
    var selections = source.selections && typeof source.selections === "object" && !Array.isArray(source.selections)
      ? cloneJson(source.selections)
      : {};
    var legacyUploadKey;

    if ((productSlugValue === "crachas" || productSlugValue === "imanes")
        && String(selections.order_flow || "") === "custom-artwork") {
      legacyUploadKey = productSlugValue === "crachas" ? "cracha_artwork_uploads" : "iman_artwork_uploads";
      selections.custom_artwork_uploads = (Array.isArray(selections[legacyUploadKey]) ? selections[legacyUploadKey] : []).map(function (upload) {
        var normalizedUpload = Object.assign({}, upload);
        normalizedUpload.quantity = Math.max(1, parseInt(upload && upload.quantity, 10) || parseInt(selections.pack_quantity, 10) || 1);
        normalizedUpload.feeCents = 500;
        return normalizedUpload;
      });
      delete selections[legacyUploadKey];
      selections.order_flow = "custom";
      selections.design_source = "custom";
      selections.catalog_context = "main-v2";
      productSlugValue = productSlugValue === "crachas" ? "crachas-loja" : "imanes-loja";
    }

    if (!id) {
      id = "ci_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    }

    return {
      id: id,
      productSlug: productSlugValue,
      productName: String(source.productName || "Produto").trim() || "Produto",
      summary: {
        title: String(summary.title || source.productName || "Produto").trim() || "Produto",
        subtitle: String(summary.subtitle || "").trim(),
        priceCents: Math.max(0, Number.isFinite(priceCents) ? priceCents : 0),
        priceText: String(summary.priceText || "").trim(),
        priceToConfirm: summary.priceToConfirm === true,
        image: summary.image ? String(summary.image).trim() : null
      },
      selections: selections
    };
  }

  function normalizeCart(cart) {
    var source = cart && typeof cart === "object" ? cart : null;
    var empty;
    var createdAt;
    var updatedAt;

    if (!source) {
      return getEmptyCart();
    }

    empty = getEmptyCart();
    createdAt = String(source.createdAt || "").trim();
    updatedAt = String(source.updatedAt || "").trim();

    return {
      schemaVersion: CART_SCHEMA_VERSION,
      cartId: String(source.cartId || "").trim() || empty.cartId,
      createdAt: createdAt || empty.createdAt,
      updatedAt: updatedAt || createdAt || empty.updatedAt,
      items: Array.isArray(source.items) ? source.items.map(normalizeCartItem) : []
    };
  }

