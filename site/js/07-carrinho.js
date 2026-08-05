// js/07-carrinho.js — parte 07/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: carrinho: loadCart/getCartItems, badge, superficie/drawer do carrinho, editar e remover itens, cartItemImage, installCartDebugTools.
  function loadCart() {
    var stored = safeStorageGetItem(CART_KEY);
    var parsed;
    var normalized;

    if (!stored) {
      return getEmptyCart();
    }

    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      normalized = getEmptyCart();
      safeStorageSetItem(CART_KEY, JSON.stringify(normalized));
      return normalized;
    }

    normalized = normalizeCart(parsed);
    if (!parsed || parsed.schemaVersion !== CART_SCHEMA_VERSION || !Array.isArray(parsed.items)) {
      safeStorageSetItem(CART_KEY, JSON.stringify(normalized));
    }
    return normalized;
  }

  function saveCart(cart) {
    var normalized = normalizeCart(cart);
    normalized.updatedAt = nowIso();
    safeStorageSetItem(CART_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function addOrUpdateCartItem(item) {
    var cart = loadCart();
    var normalizedItem = normalizeCartItem(item);
    var index = cart.items.findIndex(function (existing) {
      return existing.id === normalizedItem.id;
    });

    if (index >= 0) {
      cart.items[index] = normalizedItem;
    } else {
      cart.items.push(normalizedItem);
    }

    return saveCart(cart);
  }

  function removeCartItem(itemId) {
    var cart = loadCart();
    var id = String(itemId || "");
    cart.items = cart.items.filter(function (item) {
      return item.id !== id;
    });
    return saveCart(cart);
  }

  function clearCart() {
    safeStorageRemoveItem(CART_KEY);
    return getEmptyCart();
  }

  function getCartItems() {
    return loadCart().items;
  }

  function getCartCount() {
    return getCartItems().length;
  }

  function getCartSubtotalCents() {
    return getCartItems().reduce(function (total, item) {
      var price = item && item.summary ? parseInt(item.summary.priceCents, 10) : 0;
      return total + (Number.isFinite(price) ? Math.max(0, price) : 0);
    }, 0);
  }

  function cartHasPriceToConfirm() {
    return getCartItems().some(function (item) {
      return !!(item && item.summary && item.summary.priceToConfirm === true);
    });
  }

  function molduraDisplayText(value) {
    return String(value || "")
      .replace(/\bQUADROS PERSONALIZADOS\b/g, "MOLDURAS PERSONALIZADAS")
      .replace(/\bQuadros personalizados\b/g, "Molduras personalizadas")
      .replace(/\bquadros personalizados\b/g, "molduras personalizadas")
      .replace(/\bQUADRO PERSONALIZADO\b/g, "MOLDURA PERSONALIZADA")
      .replace(/\bQuadro personalizado\b/g, "Moldura personalizada")
      .replace(/\bquadro personalizado\b/g, "moldura personalizada")
      .replace(/\bDOS QUADROS\b/g, "DAS MOLDURAS")
      .replace(/\bDos quadros\b/g, "Das molduras")
      .replace(/\bdos quadros\b/g, "das molduras")
      .replace(/\bDO QUADRO\b/g, "DA MOLDURA")
      .replace(/\bDo quadro\b/g, "Da moldura")
      .replace(/\bdo quadro\b/g, "da moldura")
      .replace(/\bNOS QUADROS\b/g, "NAS MOLDURAS")
      .replace(/\bNos quadros\b/g, "Nas molduras")
      .replace(/\bnos quadros\b/g, "nas molduras")
      .replace(/\bNO QUADRO\b/g, "NA MOLDURA")
      .replace(/\bNo quadro\b/g, "Na moldura")
      .replace(/\bno quadro\b/g, "na moldura")
      .replace(/\bOS QUADROS\b/g, "AS MOLDURAS")
      .replace(/\bOs quadros\b/g, "As molduras")
      .replace(/\bos quadros\b/g, "as molduras")
      .replace(/\bO QUADRO\b/g, "A MOLDURA")
      .replace(/\bO quadro\b/g, "A moldura")
      .replace(/\bo quadro\b/g, "a moldura")
      .replace(/\bUNS QUADROS\b/g, "UMAS MOLDURAS")
      .replace(/\bUns quadros\b/g, "Umas molduras")
      .replace(/\buns quadros\b/g, "umas molduras")
      .replace(/\bUM QUADRO\b/g, "UMA MOLDURA")
      .replace(/\bUm quadro\b/g, "Uma moldura")
      .replace(/\bum quadro\b/g, "uma moldura")
      .replace(/\bQUADROS\b/g, "MOLDURAS")
      .replace(/\bQuadros\b/g, "Molduras")
      .replace(/\bquadros\b/g, "molduras")
      .replace(/\bQUADRO\b/g, "MOLDURA")
      .replace(/\bQuadro\b/g, "Moldura")
      .replace(/\bquadro\b/g, "moldura");
  }

  function molduraCartDesignTitle(item) {
    var selections = item && item.selections && typeof item.selections === "object" ? item.selections : {};
    var designs = Array.isArray(selections.designs) ? selections.designs : [];
    var labels = selections.design_labels && typeof selections.design_labels === "object" ? selections.design_labels : {};
    var firstDesign = designs.length ? designs[0] : "";

    return firstDesign && labels[firstDesign] ? molduraDisplayText(labels[firstDesign]) : "";
  }

  function formatMolduraCartSubtitle(item, value, designTitle) {
    var selections = item && item.selections && typeof item.selections === "object" ? item.selections : {};
    var colors = Array.isArray(selections.colors) ? selections.colors.filter(Boolean) : [];
    var palette = String(selections.color_palette || "").trim();
    var colorNames = colors.join(", ");
    var colorCount = colors.length ? colors.length + (colors.length === 1 ? " Cor" : " Cores") : "";

    return String(value || "").split(/\s+·\s+/).filter(function (part) {
      return String(part).trim().toLowerCase() !== String(designTitle || "").trim().toLowerCase();
    }).map(function (part) {
      var text = String(part).trim();
      var lower = text.toLowerCase();

      if (colorCount && (text === colorNames || text === palette)) {
        return colorCount;
      }
      if (/^foto\s+/i.test(text)) {
        return "Foto" + text.slice(4);
      }
      if (lower === "sem frase") {
        return "Sem frase";
      }
      if (lower === "precisa de ajuda com a foto") {
        return "Precisa de ajuda com a foto";
      }
      return text;
    }).filter(Boolean).join(" · ");
  }

  function formatCartItemSummary(item) {
    var summary = item && item.summary ? item.summary : {};
    var priceCents = parseInt(summary.priceCents, 10);
    var isMoldura = !!(item && item.productSlug === "quadros");
    var productName = String((item && item.productName) || "Produto");
    var title = String(summary.title || (item && item.productName) || "Produto");
    var subtitle = String(summary.subtitle || "");
    var priceText = String(summary.priceText || "").trim() || (priceCents > 0 ? formatCents(priceCents) : "Preço a confirmar");

    if (isMoldura) {
      productName = molduraDisplayText(productName);
      title = molduraDisplayText(title);
      subtitle = molduraDisplayText(subtitle);
      priceText = molduraDisplayText(priceText);
      title = molduraCartDesignTitle(item) || title;
      subtitle = formatMolduraCartSubtitle(item, subtitle, title);
    }

    return {
      productName: productName,
      title: title,
      subtitle: subtitle,
      priceText: priceText,
      image: summary.image ? String(summary.image) : ""
    };
  }

  function cartCustomizationFeeText(item) {
    var selections = item && item.selections && typeof item.selections === "object" ? item.selections : {};
    var count = Math.max(0, parseInt(selections.customization_file_count, 10) || 0);
    var cents = Math.max(0, parseInt(selections.customization_fee_cents, 10) || 0);
    if (!count || !cents) {
      return "";
    }
    return "Preparação e testes: " + count + (count === 1 ? " imagem × 5,00 € = " : " imagens × 5,00 € = ") + formatCents(cents);
  }

  function cartProductPage(productSlugValue, selections) {
    var slug = String(productSlugValue || "").trim().replace(/[^a-z0-9_-]/gi, "");
    var context = selections && typeof selections === "object" ? String(selections.catalog_context || "") : "";
    if (slug === "quadros") {
      return "molduras.html";
    }
    if (slug === "crachas-loja") return "crachas.html";
    if (slug === "imanes-loja") return "imanes.html";
    if (slug === "mini-cadernos") return "mini-cadernos.html";
    if (slug === "cadernos-anuais") return "cadernos-anuais.html";
    if (!context && ["crachas", "imanes", "caderninhos", "cadernos"].indexOf(slug) !== -1) {
      return "congressos/2026/" + slug + ".html";
    }
    return slug ? slug + ".html" : "adicionar-produto.html";
  }

  function safeCartReturnTo(value) {
    var target = String(value || "").trim();
    var stepMatch;

    if (target === "checkout" || target === "checkout.html") {
      return "checkout.html?step=1";
    }
    stepMatch = target.match(/^checkout(?:\.html)?(?:\?step=([12]))?$/);
    if (stepMatch) {
      return "checkout.html?step=" + (stepMatch[1] || "1");
    }
    if (target === "adicionar-produto" || target === "adicionar-produto.html") {
      return "adicionar-produto.html";
    }
    if (target === "index" || target === "index.html") {
      return "index.html";
    }
    return "checkout.html?step=1";
  }

  function checkoutUrlForStep(stepIndex) {
    return "checkout.html?step=" + (Math.max(0, Math.min(1, Number(stepIndex) || 0)) + 1);
  }

  function cartEditUrl(item, returnTo) {
    var id = item && item.id ? String(item.id) : "";
    var href = cartProductPage(item && item.productSlug, item && item.selections);
    return href + "?mode=edit&cartItem=" + encodeURIComponent(id) + "&returnTo=" + encodeURIComponent(safeCartReturnTo(returnTo));
  }

  // PERSONALIZACAO_BUILDER_V1: as linhas com artwork proprio sao montadas em
  // personalizacao.html e o wizard do catalogo ja nao sabe editá-las (perdeu o
  // passo de upload). Podem ser removidas e refeitas, mas nao editadas.
  function cartItemIsEditable(item) {
    var selections = item && item.selections && typeof item.selections === "object" ? item.selections : {};
    return String(selections.design_source || "") !== "custom";
  }

  function findCartItemById(itemId) {
    var id = String(itemId || "");
    return getCartItems().filter(function (item) {
      return item.id === id;
    })[0] || null;
  }

  function openCartItemEditor(itemId, returnTo) {
    var item = findCartItemById(itemId);

    if (!item || !item.productSlug) {
      state.cartPanelOpen = true;
      state.cartNotice = "Não foi possível abrir este produto para edição.";
      refreshCartUi();
      return;
    }

    window.location.href = cartEditUrl(item, returnTo);
  }

  function loadCardDetailsSession() {
    var stored = safeSessionGetItem(CARD_DETAILS_SESSION_KEY);
    var parsed;

    if (!stored) {
      return {};
    }

    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      return {};
    }

    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  }

  function isCardDetailsSessionField(name) {
    return ["recipient_name", "contact", "congregation"].indexOf(String(name || "")) !== -1;
  }

  function saveCardDetailsSessionField(name, value) {
    var key = String(name || "");
    var details;

    if (!isCardDetailsSessionField(key)) {
      return;
    }

    details = loadCardDetailsSession();
    details[key] = String(value || "");
    safeSessionSetItem(CARD_DETAILS_SESSION_KEY, JSON.stringify(details));
  }

  function persistCurrentCardDetails(product) {
    var step = findStep(product, "details");

    if (!step || step.template !== "details-form" || !Array.isArray(step.fields)) {
      return;
    }

    step.fields.forEach(function (field) {
      var name = field && field.name ? field.name : "";
      if (isCardDetailsSessionField(name) && state.selections[name] != null) {
        saveCardDetailsSessionField(name, state.selections[name]);
      }
    });
  }

  function applySessionCardDetails(product) {
    var step = findStep(product, "details");
    var details = loadCardDetailsSession();

    if (!step || step.template !== "details-form" || !Array.isArray(step.fields)) {
      return;
    }

    step.fields.forEach(function (field) {
      var name = field && field.name ? field.name : "";
      var current = state.selections[name];
      if (!isCardDetailsSessionField(name) || String(current || "").trim()) {
        return;
      }
      if (String(details[name] || "").trim()) {
        state.selections[name] = details[name];
      }
    });
  }

  function cartCountText(count) {
    if (count > 99) {
      return "99+";
    }
    return String(Math.max(0, count));
  }

  function renderCartBadge() {
    var count = getCartCount();
    return count > 0
      ? '<span class="cart-count-badge" aria-hidden="true">' + escapeHtml(cartCountText(count)) + '</span>'
      : "";
  }

  function cartButtonAriaLabel() {
    var count = getCartCount();
    if (!count) {
      return "Carrinho vazio";
    }
    return "Carrinho, " + count + (count === 1 ? " produto" : " produtos");
  }

  function renderCartHeaderButton() {
    return [
      '<button type="button" class="header-link header-link-icon cart-header-button" data-cart-open aria-label="' + escapeHtml(cartButtonAriaLabel()) + '" title="Carrinho">',
      ICON_CART,
      renderCartBadge(),
      '</button>'
    ].join("");
  }

  function renderCartItem(item, index) {
    var summary = formatCartItemSummary(item);
    var customizationFee = cartCustomizationFeeText(item);
    var returnTo = page === "checkout" ? checkoutUrlForStep(state.checkoutStep) : "index.html";
    var thumb = summary.image
      ? '<img src="' + escapeHtml(summary.image) + '" alt="" loading="lazy">'
      : '<span aria-hidden="true">' + escapeHtml(summary.productName.slice(0, 1).toUpperCase()) + '</span>';

    return [
      '<li class="cart-panel-item">',
      '<div class="cart-item-thumb">' + thumb + '</div>',
      '<div class="cart-item-copy">',
      '<strong>' + escapeHtml(index + 1) + '. ' + escapeHtml(summary.productName) + '</strong>',
      '<span>' + escapeHtml(summary.title) + '</span>',
      summary.subtitle ? '<em>' + escapeHtml(summary.subtitle) + '</em>' : "",
      customizationFee ? '<em class="cart-item-customization-fee">' + escapeHtml(customizationFee) + '</em>' : "",
      '</div>',
      '<div class="cart-item-side">',
      '<span class="cart-item-price">' + escapeHtml(summary.priceText) + '</span>',
      '<div class="cart-item-actions">',
      cartItemIsEditable(item) ? '<button type="button" class="cart-edit-button" data-cart-edit="' + escapeHtml(item.id) + '" data-cart-edit-return="' + escapeHtml(returnTo) + '">Editar</button>' : "",
      '<button type="button" class="cart-remove-button" data-cart-remove="' + escapeHtml(item.id) + '">Remover</button>',
      '</div>',
      '</div>',
      '</li>'
    ].join("");
  }

  function renderCartPanel() {
    var items = getCartItems();
    var count = items.length;
    var subtotal = getCartSubtotalCents();
    var hasPriceToConfirm = cartHasPriceToConfirm();

    return [
      '<aside class="cart-panel' + (state.cartPanelOpen ? ' is-open' : '') + '" id="cart-panel" role="dialog" aria-modal="false" aria-labelledby="cart-panel-title" aria-hidden="' + (state.cartPanelOpen ? "false" : "true") + '">',
      '<div class="cart-panel-head">',
      '<div>',
      '<p class="eyebrow">Carrinho</p>',
      '<h2 id="cart-panel-title">' + (count ? "O teu pedido" : "Carrinho") + '</h2>',
      '</div>',
      '<button type="button" class="cart-close-button" data-cart-close aria-label="Fechar carrinho">' + ICON_CLOSE + '</button>',
      '</div>',
      count ? [
        '<ol class="cart-panel-list">',
        items.map(renderCartItem).join(""),
        '</ol>',
        '<div class="cart-panel-total">',
        '<span>' + (hasPriceToConfirm ? 'Subtotal calculado' : 'Subtotal') + '</span>',
        '<strong>' + escapeHtml(subtotal > 0 ? formatCents(subtotal) : (hasPriceToConfirm ? 'Preço a confirmar' : formatCents(0))) + '</strong>',
        '</div>',
        hasPriceToConfirm ? '<p class="cart-panel-note">O valor do Super Personalizado será confirmado pela Mia.</p>' : '',
        '<button type="button" class="button primary cart-finalize-button" data-cart-finalize>Finalizar pedido</button>'
      ].join("") : [
        '<div class="cart-empty-state">',
        '<strong>O carrinho está vazio.</strong>',
        '<p>Ainda não adicionaste nenhum produto ao pedido.</p>',
        '</div>',
        '<button type="button" class="button primary cart-finalize-button" disabled>Finalizar pedido</button>'
      ].join(""),
      state.cartNotice ? '<p class="cart-panel-note" role="status">' + escapeHtml(state.cartNotice) + '</p>' : "",
      '</aside>'
    ].join("");
  }

  function renderCartSurface() {
    var count = getCartCount();

    return [
      '<div class="cart-surface' + (state.cartPanelOpen ? ' is-open' : '') + '" data-cart-surface>',
      count ? '<button type="button" class="cart-floating-button" data-cart-open aria-label="' + escapeHtml(cartButtonAriaLabel()) + '"><span class="cart-floating-icon">' + ICON_CART + '</span><span>Carrinho</span><strong>' + escapeHtml(cartCountText(count)) + '</strong></button>' : "",
      state.cartPanelOpen ? '<button type="button" class="cart-panel-backdrop" data-cart-close aria-label="Fechar carrinho"></button>' : "",
      renderCartPanel(),
      '</div>'
    ].join("");
  }

  function updateCartHeaderButtons() {
    document.querySelectorAll(".cart-header-button").forEach(function (button) {
      button.innerHTML = ICON_CART + renderCartBadge();
      button.setAttribute("aria-label", cartButtonAriaLabel());
      button.classList.toggle("has-items", getCartCount() > 0);
    });
  }

  function ensureCartHeaderButton() {
    var actions = document.querySelector(".site-header .header-actions");
    var themeButton;
    var button;

    if (!actions || actions.querySelector("[data-cart-open]")) {
      updateCartHeaderButtons();
      return;
    }

    button = document.createElement("button");
    button.type = "button";
    button.className = "header-link header-link-icon cart-header-button";
    button.setAttribute("data-cart-open", "");
    button.setAttribute("aria-label", cartButtonAriaLabel());
    button.setAttribute("title", "Carrinho");
    button.innerHTML = ICON_CART + renderCartBadge();

    themeButton = actions.querySelector("[data-theme-toggle]");
    if (themeButton) {
      actions.insertBefore(button, themeButton);
    } else {
      actions.appendChild(button);
    }
  }

  function refreshCartUi() {
    var surface = document.querySelector("[data-cart-surface]");
    var html = renderCartSurface();

    ensureCartHeaderButton();

    if (surface) {
      surface.outerHTML = html;
    } else if (document.body) {
      document.body.insertAdjacentHTML("beforeend", html);
    }

    updateCartHeaderButtons();
    bindCartUi();
  }

  function bindCartUi() {
    ensureCartHeaderButton();
    // No telemovel o carrinho e o menu ocupam o ecra todo: as reviews a rodar
    // por cima deixam de ser um detalhe simpatico e passam a estorvar.
    document.body.classList.toggle("is-cart-panel-open", state.cartPanelOpen === true);

    document.querySelectorAll("[data-cart-open]").forEach(function (button) {
      if (button.dataset.cartBound === "1") {
        return;
      }
      button.dataset.cartBound = "1";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        state.cartPanelOpen = true;
        state.cartNotice = "";
        refreshCartUi();
      });
    });

    document.querySelectorAll("[data-cart-close]").forEach(function (button) {
      if (button.dataset.cartBound === "1") {
        return;
      }
      button.dataset.cartBound = "1";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        state.cartPanelOpen = false;
        state.cartNotice = "";
        refreshCartUi();
      });
    });

    document.querySelectorAll("[data-cart-remove]").forEach(function (button) {
      if (button.dataset.cartBound === "1") {
        return;
      }
      button.dataset.cartBound = "1";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        removeCartItem(button.dataset.cartRemove);
        state.cartPanelOpen = true;
        state.cartNotice = "Produto removido do carrinho.";
        refreshCartUi();
      });
    });

    document.querySelectorAll("[data-cart-edit]").forEach(function (button) {
      if (button.dataset.cartBound === "1") {
        return;
      }
      button.dataset.cartBound = "1";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        openCartItemEditor(button.dataset.cartEdit, button.dataset.cartEditReturn || "index.html");
      });
    });

    document.querySelectorAll("[data-cart-finalize]").forEach(function (button) {
      if (button.dataset.cartBound === "1") {
        return;
      }
      button.dataset.cartBound = "1";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        if (getCartCount() > 0) {
          trackOrderEvent("cart_checkout_started", {
            cart_id: loadCart().cartId,
            item_count: getCartCount()
          });
          window.location.href = "checkout.html";
          return;
        }
        state.cartPanelOpen = true;
        state.cartNotice = "Adiciona pelo menos um produto antes de finalizar.";
        refreshCartUi();
      });
    });

    if (!cartEscapeBound) {
      cartEscapeBound = true;
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && state.cartPanelOpen) {
          state.cartPanelOpen = false;
          state.cartNotice = "";
          refreshCartUi();
        }
      });
    }
  }

  function installCartDebugTools() {
    var params = new URLSearchParams(window.location.search || "");

    if (!params.has("cartDebug")) {
      return;
    }

    window.MiaCartDebug = {
      addTestItem: function () {
        addOrUpdateCartItem({
          id: "ci_test_001",
          productSlug: "crachas",
          productName: "Crachás",
          summary: {
            title: "24 crachás · 32 mm",
            subtitle: "Teste visual do carrinho",
            priceCents: 3200,
            image: null
          },
          selections: {}
        });
        state.cartPanelOpen = true;
        state.cartNotice = "Item de teste adicionado ao carrinho.";
        refreshCartUi();
        return loadCart();
      },
      clear: function () {
        clearCart();
        state.cartPanelOpen = true;
        state.cartNotice = "Carrinho limpo.";
        refreshCartUi();
        return loadCart();
      },
      load: loadCart
    };
  }

  function createCartItemId(product) {
    var slug = product && product.slug ? product.slug : "item";
    return "ci_" + slug + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  }

  function productCartSteps(product) {
    var steps = visibleSteps(product);
    var endIndex = steps.findIndex(function (step) {
      return step && (step.id === "delivery_contact" || step.template === "delivery-contact");
    });

    if (endIndex < 0) {
      endIndex = steps.findIndex(function (step) {
        return step && step.id === "confirm";
      });
    }

    return endIndex >= 0 ? steps.slice(0, endIndex) : steps.slice();
  }

  function cartEntryStepIndex(product) {
    var steps = visibleSteps(product);
    var cartSteps = productCartSteps(product);

    if (!cartSteps.length) {
      return -1;
    }

    return steps.indexOf(cartSteps[cartSteps.length - 1]);
  }

  function isCartEntryStep(product) {
    if (isQuadrosProduct(product) && !state.selections.designs) {
      return false;
    }

    return !state.admin && state.currentStep === cartEntryStepIndex(product);
  }

  function focusProductFirstError() {
    window.requestAnimationFrame(function () {
      var target = document.querySelector(".wizard-shell .is-missing, .wizard-shell [aria-invalid='true']");

      if (!target) {
        target = document.querySelector(".wizard-shell .form-error");
      }
      if (!target) {
        return;
      }

      if (typeof target.focus === "function") {
        try {
          target.focus({ preventScroll: true });
        } catch (error) {
          target.focus();
        }
      }
      if (typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });
  }

  function validateProductForCart(product) {
    var steps = productCartSteps(product);
    var error = "";
    var index = 0;

    for (index = 0; index < steps.length; index += 1) {
      error = validateStep(product, steps[index]);
      if (error) {
        state.currentStep = Math.max(0, visibleSteps(product).indexOf(steps[index]));
        state.maxVisitedStep = Math.max(state.maxVisitedStep, state.currentStep);
        state.errors = error;
        trackProductEvent(product, "validation_error", {
          step_id: steps[index] ? steps[index].id : "",
          step_index: state.currentStep
        });
        rerenderProduct(product);
        focusProductFirstError();
        return false;
      }
    }

    state.errors = "";
    return true;
  }

  function cartDesignLabels(product) {
    var labels = {};

    if (isAssortedSelected(product)) {
      labels.__sortido__ = "Sortido";
      return labels;
    }

    selectedDesignItems(product).forEach(function (item) {
      labels[item.value] = displayItemTitle(item) || item.title || item.value;
    });

    return labels;
  }

  function cartDesignQuantities(product) {
    var quantities = {};

    if (isAssortedSelected(product)) {
      quantities.__sortido__ = getPackQuantity(product);
      return quantities;
    }

    selectedDesignItems(product).forEach(function (item) {
      quantities[item.value] = isCadernosProduct(product) ? 1 : quantityFor(item.value);
    });

    return quantities;
  }

  function currentProductCartSelections(product) {
    ensureOptionDrawerSelections(product);
    var selections = cloneJson(state.selections);
    var cadernoLamination = isCadernosProduct(product) ? selectedCadernoLamination(product) : null;
    var cadernoOption = isCadernosProduct(product) ? selectedCadernoPurchaseOption(product) : null;

    delete selections.customer_name;
    delete selections.customer_contact;
    delete selections.customer_nif;
    delete selections.delivery_option;
    delete selections.send_copy;
    delete selections.send_copy_touched;
    delete selections.copy_email;

    selections.designs = isCustomArtworkSelected(product) ? [] : (isAssortedSelected(product) ? ["__sortido__"] : selectedDesignValues());
    selections.design_quantities = isCustomArtworkSelected(product) ? {} : cartDesignQuantities(product);
    selections.design_labels = isCustomArtworkSelected(product) ? {} : cartDesignLabels(product);
    selections.assorted_designs = !isCustomArtworkSelected(product) && isAssortedSelected(product) ? "1" : "";
    selections.pack_quantity = getPackQuantity(product);
    selections.size = priceInfo(product).size || selections.size || "";
    if (isMainCatalogProduct(product)) {
      selections.catalog_context = String(product.catalogContext || "main-v2");
      selections.order_flow = isCustomArtworkSelected(product) ? "custom" : "catalog";
      selections.design_source = selections.order_flow;
      if (!isCustomArtworkSelected(product)) {
        delete selections[customArtworkConfig(product).uploadKey];
        delete selections.customization_fee_cents;
        delete selections.customization_file_count;
        delete selections.artwork_total_quantity;
      } else {
        selections.customization_fee_cents = customArtworkFeeCents(product);
        selections.customization_file_count = customArtworkItems(product).length;
        selections.artwork_total_quantity = customArtworkTotalQuantity(product);
      }
    } else if (product && product.orderFlow) {
      selections.order_flow = String(product.orderFlow);
    } else {
      delete selections.order_flow;
    }

    if (isQuadrosProduct(product)) {
      selections.frame_size = priceInfo(product).frameSize || selections.frame_size || "";
    }

    if (isCadernosProduct(product)) {
      selections.lamination = cadernoLamination ? cadernoLamination.value : "";
      selections.lamination_label = cadernoLamination ? cadernoLamination.title : "";
      selections.add_ons = selectedCadernoAddOns(product).map(function (item) { return item.value; });
      selections.add_on_labels = selectedCadernoAddOns(product).reduce(function (labels, item) {
        labels[item.value] = item.title || item.value;
        return labels;
      }, {});
      selections.purchase_option = cadernoOption ? cadernoOption.value : "";
      selections.purchase_option_label = cadernoOption ? cadernoOption.title : "";
      selections.purchase_includes = cadernoOption && cadernoOption.includes ? cadernoOption.includes : "";
      selections.purchase_is_pack = cadernoOption && cadernoOption.isPack ? "1" : "";
      selections.caderno_order_quantity = cadernoOrderQuantity(product);
      selections.cover_personalization = selections.cover_personalization || "";
      selections.cover_personalization_text = selections.cover_personalization === "yes" ? cadernoPersonalizationText() : "";
      selections.pack_promo_note = cadernoOption && cadernoOption.isPack ? cadernoPromoNote(product) : "";
    }

    selections.congregation_gift = shouldShowGiftRequest(product) && state.selections.congregation_gift ? "1" : "";

    return selections;
  }

  function cartItemImage(product) {
    var item = selectedDesignItems(product)[0] || null;
    var lamination = isCadernosProduct(product) ? selectedCadernoLamination(product) : null;
    var laminationKey = lamination ? (lamination.laminationKey || lamination.value || "") : "";
    var custom;
    var uploads;

    if (isCustomArtworkSelected(product)) {
      custom = customArtworkConfig(product);
      uploads = orderUploadItems(custom.uploadKey);
      if (!uploads.length || String(uploads[0].mime || "").toLowerCase() === "application/pdf" || /\.pdf$/i.test(String(uploads[0].name || ""))) {
        return null;
      }
      return orderUploadPreviewUrl(uploads[0]);
    }

    if (item && laminationKey && item.laminationImages && item.laminationImages[laminationKey]) {
      return item.laminationImages[laminationKey];
    }

    return item && item.image ? item.image : null;
  }

  function cartItemSubtitle(product) {
    var designs;
    var names;
    var lamination;
    var option;
    var parts;

    if (isCustomArtworkSelected(product)) {
      var custom = customArtworkConfig(product);
      var customQuantity = isCadernosProduct(product) ? cadernoOrderQuantity(product) : getPackQuantity(product);
      var customCount = customArtworkItems(product).length;
      parts = [
        selectedSizeLabel(product),
        productQuantityLabel(product, customQuantity),
        customCount + (customCount === 1 ? " design personalizado" : " designs personalizados"),
        customArtworkFeeCents(product) ? "preparação " + formatCents(customArtworkFeeCents(product)) : ""
      ].filter(Boolean);
      if (String(state.selections[custom.cardField] || "").trim()
          || orderUploadItems(custom.cardPhotoKey).length
          || orderUploadItems(custom.cardAudioKey).length) {
        parts.push("cartão personalizado");
      }
      return parts.join(" · ");
    }

    if (isQuadrosProduct(product)) {
      parts = [];
      designs = selectedDesignItems(product);
      if (state.selections.silhouette) {
        parts.push(String(state.selections.silhouette));
      }
      if (state.selections.mia_choose_colors) {
        parts.push("Cores escolhidas pela Mia");
      } else if (Array.isArray(state.selections.colors) && state.selections.colors.length) {
        parts.push(state.selections.colors.length + (state.selections.colors.length === 1 ? " Cor" : " Cores"));
      } else if (state.selections.color_palette) {
        parts.push("Cores");
      }
      if (state.selections.photo_orientation) {
        parts.push("Foto " + String(state.selections.photo_orientation).toLowerCase());
      }
      if (state.selections.baby_animal) {
        parts.push(String(state.selections.baby_animal));
      }
      if (state.selections.baby_gender) {
        parts.push(String(state.selections.baby_gender));
      }
      if (state.selections.baby_name) {
        parts.push(String(state.selections.baby_name));
      }
      if (designs[0] && priceInfo(product).frameSize) {
        parts.push(String(priceInfo(product).frameSize));
      }
      if (state.selections.no_phrase) {
        parts.push("Sem frase");
      }
      if (state.selections.quadro_super_example) {
        parts.push(String(state.selections.quadro_super_example));
      }
      if (selectedQuadroPackaging(product)) {
        parts.push(selectedQuadroPackaging(product).title || String(state.selections.packaging || ""));
      }
      if (orderUploadItems("quadro_uploads").length) {
        parts.push(orderUploadItems("quadro_uploads").length + (orderUploadItems("quadro_uploads").length === 1 ? " foto" : " fotos"));
      } else if (state.selections.photo_help) {
        parts.push("Precisa de ajuda com a foto");
      }
      if (orderUploadItems("quadro_reference_uploads").length) {
        parts.push(orderUploadItems("quadro_reference_uploads").length + (orderUploadItems("quadro_reference_uploads").length === 1 ? " foto de referência" : " fotos de referência"));
      }
      if (orderUploadItems("quadro_audio_uploads").length) {
        parts.push(orderUploadItems("quadro_audio_uploads").length + (orderUploadItems("quadro_audio_uploads").length === 1 ? " áudio" : " áudios"));
      }
      if (orderUploadItems("quadro_silhouette_uploads").length) {
        parts.push("silhueta enviada");
      }
      return parts.join(" · ");
    }

    if (isCadernosProduct(product)) {
      lamination = selectedCadernoLamination(product);
      option = selectedCadernoPurchaseOption(product);
      parts = [];
      if (lamination) {
        parts.push(lamination.title);
      }
      if (option) {
        parts.push(option.title);
      }
      cadernoAddOnsLabels(product).forEach(function (label) {
        parts.push(label);
      });
      if (state.selections.cover_personalization === "yes") {
        parts.push("capa personalizada");
      }
      return parts.join(" · ");
    }

    if (isAssortedSelected(product)) {
      return "Designs escolhidos pela Mia";
    }

    designs = selectedDesignItems(product);
    names = designs.slice(0, 3).map(function (item) {
      return displayItemTitle(item);
    });

    if (designs.length > 3) {
      names.push("+" + (designs.length - 3));
    }

    parts = [];
    if (names.length) {
      parts.push("Designs: " + names.join(", "));
    }
    selectedOptionDrawerRecords(product).forEach(function (record) {
      parts.push(String(record.drawer.label || record.drawer.title || "Opção") + ": " + String(record.item.title || record.item.value || ""));
    });
    return parts.join(" · ");
  }

  function buildCartItemFromCurrentProduct(product) {
    var info = priceInfo(product);
    var quantity = isCadernosProduct(product) ? cadernoOrderQuantity(product) : getPackQuantity(product);
    var title;
    var selectedSize;
    var cover;
    var option;
    var designs;

    if (isQuadrosProduct(product)) {
      designs = selectedDesignItems(product);
      title = designs[0] ? displayItemTitle(designs[0]) : "Moldura personalizada";
    } else if (isCadernosProduct(product)) {
      cover = selectedCadernoCover(product);
      option = selectedCadernoPurchaseOption(product);
      title = [
        quantity > 1 ? quantity + " x" : "",
        option ? option.title : "Caderno",
        cover ? "· " + displayItemTitle(cover) : ""
      ].filter(Boolean).join(" ");
    } else {
      selectedSize = selectedSizeLabel(product) || info.size || "";
      title = productQuantityLabel(product, quantity || 0) + (selectedSize ? " · " + selectedSize : "");
    }

    return {
      id: createCartItemId(product),
      productSlug: product.slug || "",
      productName: product.name || product.slug || "Produto",
      selections: currentProductCartSelections(product),
      summary: {
        title: title,
        subtitle: cartItemSubtitle(product),
        priceCents: Math.max(0, parseInt(info.cents, 10) || 0),
        priceText: isQuadrosProduct(product) ? info.total || "Preço a confirmar" : "",
        priceToConfirm: isQuadrosProduct(product) && info.priceToConfirm === true,
        image: cartItemImage(product)
      }
    };
  }

  function addCurrentProductToCart(product, destination) {
    var item;
    var cart;

    // O construtor nao e um produto: cada linha do passo 2 entra no carrinho
    // como uma linha do seu proprio slug.
    if (isArtworkBuilderProduct(product)) {
      addBuilderLinesToCart(product, destination);
      return;
    }

    if (!validateProductForCart(product)) {
      return;
    }

    persistCurrentCardDetails(product);
    item = buildCartItemFromCurrentProduct(product);
    cart = addOrUpdateCartItem(item);
    trackProductEvent(product, "cart_item_added", {
      cart_id: cart.cartId,
      item_count: cart.items.length,
      item_price_cents: item.summary.priceCents || 0
    });
    window.location.href = destination;
  }

  function saveEditedCartItem(product) {
    var item;
    var cart;

    if (!state.editingCartItemId) {
      addCurrentProductToCart(product, "checkout.html");
      return;
    }

    if (!validateProductForCart(product)) {
      return;
    }

    persistCurrentCardDetails(product);
    item = buildCartItemFromCurrentProduct(product);
    item.id = state.editingCartItemId;
    cart = addOrUpdateCartItem(item);
    trackProductEvent(product, "cart_item_updated", {
      cart_id: cart.cartId,
      item_count: cart.items.length,
      item_price_cents: item.summary.priceCents || 0
    });
    window.location.href = state.editingCartReturnTo || "checkout.html";
  }

  function cancelCartItemEdit() {
    window.location.href = state.editingCartReturnTo || "checkout.html";
  }

  function renderCartEditBar() {
    if (!state.editingCartItemId) {
      return "";
    }

    return [
      '<div class="cart-edit-bar" role="region" aria-label="Edição do item do carrinho">',
      '<span>Estás a editar um produto do carrinho.</span>',
      '<div>',
      '<button class="button secondary" type="button" data-cart-cancel-edit>× Cancelar edição</button>',
      '<button class="button primary" type="button" data-cart-save-edit>✓ Guardar alterações</button>',
      '</div>',
      '</div>'
    ].join("");
  }

  function renderCartEntryActions(product, step) {
    var totals = builderActionTotals(product, step);
    var compactPersonalizationActions = isArtworkBuilderProduct(product)
      && String(step && step.template || "") === "custom-quantity-builder";
    var backLabel = compactPersonalizationActions ? '<span data-action-icon aria-hidden="true">' + ICON_BACK + '</span><span data-action-full>Voltar</span><span data-action-short aria-hidden="true">Voltar</span>' : "Voltar";
    var addAnotherLabel = compactPersonalizationActions ? '<span data-action-icon aria-hidden="true">' + ICON_CART + '</span><span data-action-full>Adicionar ao cesto e escolher outro produto</span><span data-action-short aria-hidden="true">Carrinho</span>' : "Adicionar ao cesto e escolher outro produto";
    var finalizeLabel = compactPersonalizationActions ? '<span data-action-icon aria-hidden="true">' + ICON_CHECK + '</span><span data-action-full>Finalizar pedido</span><span data-action-short aria-hidden="true">Finalizar</span>' : "Finalizar pedido";

    if (state.editingCartItemId) {
      return [
        '<div class="step-actions">',
        totals,
        '<button class="button secondary" type="button" data-back data-track="true" data-track-action="back" data-track-id="back">Voltar</button>',
        '<div class="next-action-wrap">',
        state.errors ? '<p class="form-error action-error" role="alert">' + escapeHtml(state.errors) + '</p>' : "",
        '</div>',
        '</div>'
      ].join("");
    }

    return [
      '<div class="step-actions cart-entry-actions">',
      totals,
      '<button class="button secondary" type="button" data-back aria-label="Voltar" data-track="true" data-track-action="back" data-track-id="back">' + backLabel + '</button>',
      '<div class="cart-entry-buttons">',
      state.errors ? '<p class="form-error action-error" role="alert">' + escapeHtml(state.errors) + '</p>' : "",
      '<button class="button secondary" type="button" data-cart-add-another aria-label="Adicionar ao cesto e escolher outro produto">' + addAnotherLabel + '</button>',
      '<button class="button primary" type="button" data-cart-finalize-current aria-label="Finalizar pedido">' + finalizeLabel + '</button>',
      '</div>',
      '</div>'
    ].join("");
  }

  function currentUrlParams() {
    try {
      return new URLSearchParams(window.location.search || "");
    } catch (error) {
      return new URLSearchParams("");
    }
  }

  function normalizeSelectionsForProduct(product, selections) {
    var normalized = cloneJson(selections || {});
    var steps = product && Array.isArray(product.steps) ? product.steps : [];

    steps.forEach(function (step) {
      var value;

      if (!step || !step.id || normalized[step.id] == null) {
        return;
      }

      value = normalized[step.id];
      if (step.selection === "multi") {
        normalized[step.id] = Array.isArray(value) ? value : (value ? [value] : []);
        return;
      }

      if (step.template === "palette-grid") {
        normalized[step.id] = Array.isArray(value) ? value : (value ? [value] : []);
        return;
      }

      if (Array.isArray(value)) {
        normalized[step.id] = value[0] || "";
      }
    });

    if (isCadernosProduct(product) && Array.isArray(normalized.designs)) {
      normalized.designs = normalized.designs[0] || "";
    }

    return normalized;
  }

  function restoreQuantityStateFromSelections(product) {
    var items = selectedDesignItems(product);
    var quantities = state.selections.design_quantities && typeof state.selections.design_quantities === "object"
      ? state.selections.design_quantities
      : {};

    if (isAssortedSelected(product)) {
      state.quantitySignature = "__assorted__";
      state.quantitiesTouched = false;
      state.quantityPackBaseline = getPackQuantity(product);
      return;
    }

    state.quantitySignature = selectedItemsSignature(items);
    state.quantityPackBaseline = getPackQuantity(product);
    state.quantitiesTouched = !isCadernosProduct(product) && Object.keys(quantities).length > 0;
  }

  function loadCartEditMode(product) {
    var params = currentUrlParams();
    var mode = String(params.get("mode") || "").toLowerCase();
    var itemId = String(params.get("cartItem") || "").trim();
    var item;
    var entryIndex;

    state.editingCartItemId = "";
    state.editingCartReturnTo = "";
    state.editingCartOriginalItem = null;

    if (mode !== "edit" || !itemId) {
      return;
    }

    item = findCartItemById(itemId);
    if (!item || item.productSlug !== product.slug) {
      state.errors = "Não foi possível carregar este item do carrinho para edição.";
      return;
    }

    state.editingCartItemId = item.id;
    state.editingCartReturnTo = safeCartReturnTo(params.get("returnTo"));
    state.editingCartOriginalItem = cloneJson(item);
    state.selections = normalizeSelectionsForProduct(product, item.selections || {});
    state.currentStep = 0;
    entryIndex = cartEntryStepIndex(product);
    state.maxVisitedStep = entryIndex >= 0 ? entryIndex : Math.max(0, visibleSteps(product).length - 1);
    state.packDisabledMessage = "";
    state.invalidFields = [];
    restoreQuantityStateFromSelections(product);
  }

  function renderBrandButterfly() {
    return '<iframe class="brand-butterfly-frame" src="content/brand/brand-butterfly.html" title="" aria-hidden="true" tabindex="-1" inert sandbox=""></iframe>';
  }

  function renderBrandText(brand) {
    var text = brand || "Mia & Paper";
    var anchorIndex = state.brandButterflyEnabled === true ? text.lastIndexOf("r") : -1;

    if (anchorIndex < 0) {
      return '<span class="brand-text">' + escapeHtml(text) + '</span>';
    }

    return [
      '<span class="brand-text">',
      escapeHtml(text.slice(0, anchorIndex)),
      '<span class="brand-letter-r">',
      escapeHtml(text.charAt(anchorIndex)),
      renderBrandButterfly(),
      '</span>',
      escapeHtml(text.slice(anchorIndex + 1)),
      '</span>'
    ].join("");
  }

  function homeCategoryAnchor(category) {
    var id = String(category && category.id ? category.id : "produto")
      .trim()
      .replace(/[^a-z0-9_-]/gi, "-");
    return "#produto-" + id;
  }

