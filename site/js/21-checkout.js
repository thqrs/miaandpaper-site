// js/21-checkout.js — parte 21/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: envio e checkout: addHiddenFields/appendHidden, cartoes de adicionar produto, totais (checkoutTotalCents), sessao de checkout, renderCheckoutCartItems, bindCheckoutPage.
  function addHiddenFields(form, product) {
    var info = priceInfo(product);
    var detailsStep = findStep(product, "details");
    var cadernoLamination = isCadernosProduct(product) ? selectedCadernoLamination(product) : null;
    var cadernoOption = isCadernosProduct(product) ? selectedCadernoPurchaseOption(product) : null;
    var cadernoPersonalized = isCadernosProduct(product) && state.selections.cover_personalization === "yes";

    form.querySelectorAll("[data-generated-field]").forEach(function (field) {
      field.remove();
    });

    appendHidden(form, "product_slug", product.slug || "");
    appendHidden(form, "product_name", product.name || "");
    appendHidden(form, "pack_quantity", String(getPackQuantity(product)));
    appendHidden(form, "quantity_pricing_mode", selectedQuantityPricingMode(product));
    appendHidden(form, "size", priceInfo(product).size || state.selections.size || "");
    appendHidden(form, "price_total", info.total || "");
    appendHidden(form, "price_per_pin", info.perPin || "");
    appendHidden(form, "delivery_option", getDeliveryOption(product).id);
    appendHidden(form, "delivery_fee", deliveryPriceText(getDeliveryOption(product)));
    appendHidden(form, "send_copy", state.selections.send_copy ? "1" : "");
    appendHidden(form, "copy_email", state.selections.copy_email || "");
    appendHidden(form, "congregation_gift", shouldShowGiftRequest(product) && state.selections.congregation_gift ? "1" : "");

    if (isCadernosProduct(product)) {
      appendHidden(form, "lamination", cadernoLamination ? cadernoLamination.value : "");
      appendHidden(form, "lamination_label", cadernoLamination ? cadernoLamination.title : "");
      selectedCadernoAddOns(product).forEach(function (item) {
        appendHidden(form, "add_ons[]", item.value || "");
      });
      appendHidden(form, "add_ons_extra", info.addOnsTotal || "");
      appendHidden(form, "add_ons_extra_cents", String(info.addOnsCents || 0));
      appendHidden(form, "purchase_option", cadernoOption ? cadernoOption.value : "");
      appendHidden(form, "purchase_option_label", cadernoOption ? cadernoOption.title : "");
      appendHidden(form, "purchase_includes", cadernoOption && cadernoOption.includes ? cadernoOption.includes : "");
      appendHidden(form, "purchase_is_pack", cadernoOption && cadernoOption.isPack ? "1" : "");
      appendHidden(form, "caderno_order_quantity", String(cadernoOrderQuantity(product)));
      appendHidden(form, "base_price", info.baseTotal || "");
      appendHidden(form, "base_price_cents", String(info.baseCents || 0));
      appendHidden(form, "cover_personalization", state.selections.cover_personalization || "");
      appendHidden(form, "cover_personalization_text", cadernoPersonalized ? cadernoPersonalizationText() : "");
      appendHidden(form, "cover_personalization_extra", info.personalizationTotal || "");
      appendHidden(form, "cover_personalization_extra_cents", String(info.personalizationCents || 0));
      appendHidden(form, "pack_promo_note", cadernoOption && cadernoOption.isPack ? cadernoPromoNote(product) : "");
    }

    if (isAssortedSelected(product)) {
      appendHidden(form, "assorted_designs", "1");
      appendHidden(form, "designs[]", "__sortido__");
      appendHidden(form, "design_quantities[]", "__sortido__||" + String(getPackQuantity(product)));
      appendHidden(form, "design_labels[]", "__sortido__||Sortido");
    } else {
      appendHidden(form, "assorted_designs", "");
      selectedDesignItems(product).forEach(function (item) {
        var label = displayItemTitle(item) || item.title || "";
        appendHidden(form, "designs[]", item.value);
        appendHidden(form, "design_quantities[]", item.value + "||" + (isCadernosProduct(product) ? 1 : quantityFor(item.value)));
        // SECTION_DISPLAY_LABELS_V1: enviar tambem o nome publico (Porto 01)
        // ao lado do identificador original (Crachá 07) para o email mostrar
        // ambos. Se o item nao tiver label de seccao, fica == item.title.
        appendHidden(form, "design_labels[]", item.value + "||" + label);
      });
    }

    (detailsStep && detailsStep.fields ? detailsStep.fields : []).forEach(function (field) {
      appendHidden(form, field.name, state.selections[field.name] || "");
    });

    // DELIVERY_CONTACT_STEP_V1: customer_name e customer_contact migraram
    // do passo "details" para o novo "delivery_contact". Iterar contact.fields
    // garante que o payload submetido para send-order.php fica idêntico.
    var deliveryContactStep = findStep(product, "delivery_contact");
    var dcFields = deliveryContactStep && deliveryContactStep.contact && deliveryContactStep.contact.fields
      ? deliveryContactStep.contact.fields
      : [];
    dcFields.forEach(function (field) {
      appendHidden(form, field.name, state.selections[field.name] || "");
    });

    selectedOptionDrawerRecords(product).forEach(function (record) {
      appendHidden(form, record.drawer.field, record.item.value || "");
    });
  }

  function appendHidden(form, name, value) {
    var input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    input.dataset.generatedField = "1";
    form.appendChild(input);
  }

  function cartProductCategories(home) {
    return (home.categories || []).filter(function (category) {
      return category && category.href && homeCategoryIsVisible(category);
    });
  }

  function renderAddProductCategoryCard(category, index, home) {
    var carouselImages = home.carousel && home.carousel.enabled !== false && category.carouselEnabled !== false
      ? (category.carouselImages || [])
      : [];
    var hasCarousel = carouselImages.length > 0;
    var hasStaticImage = category.image && !hasCarousel;
    var imageClass = hasCarousel ? " has-carousel" : (hasStaticImage ? " has-image" : "");
    // CAROUSEL_SLIDES_V1: cada moldura traz os seus parâmetros; o cartão já não
    // precisa de os repetir.
    var imageStyle = hasStaticImage ? ' style="--category-image:url(&quot;' + escapeHtml(siteAssetUrl(category.image)) + '&quot;)"' : "";
    var carouselHtml = hasCarousel ? renderHomeCarousel(category, home.carousel) : "";
    var numberHtml = home.showCategoryNumbers === true
      ? '<span class="category-number">' + String(index + 1).padStart(2, "0") + '</span>'
      : '<span class="category-number is-placeholder" aria-hidden="true">00</span>';

    return [
      '<a class="category-card ' + escapeHtml(category.accent || "gold") + imageClass + '" href="' + escapeHtml(category.href || "index.html") + '"' + imageStyle + ' data-category-id="' + escapeHtml(category.id || "") + '" aria-label="' + escapeHtml(category.title || "") + '">',
      carouselHtml,
      numberHtml,
      '<span class="category-art" aria-hidden="true"></span>',
      '<strong>' + escapeHtml(category.title || "") + '</strong>',
      '<span>' + escapeHtml(category.subtitle || "") + '</span>',
      '</a>'
    ].join("");
  }

  function renderAddProductPage(home) {
    ensureHomeSettings(home);
    applySiteSettings(home);
    state.home = home;

    var categories = cartProductCategories(home);
    var count = getCartCount();
    var checkoutHref = checkoutUrlFromStoredSession();
    var cards = categories.map(function (category, index) {
      return renderAddProductCategoryCard(category, index, home);
    }).join("");

    renderChrome([
      '<main class="home-shell home-shell--hub add-product-shell">',
      renderBrand(home.brand || "Mia & Paper", "index.html", home.instagramUrl, home.categories),
      '<section class="home-section home-hub-section home-products-section" aria-labelledby="add-product-title">',
      '<div class="home-section-inner">',
      '<header class="home-section-heading">',
      '<p class="eyebrow">Carrinho</p>',
      '<h1 id="add-product-title">O que queres acrescentar ao teu pedido?</h1>',
      '<p>Escolhe outro produto para o juntares ao mesmo pedido.</p>',
      '</header>',
      '<div class="home-hub-summary">',
      count ? renderCheckoutCartItems({ allowRemove: false, allowEdit: false }) : '<p class="cart-panel-note">Ainda não adicionaste nenhum produto ao pedido.</p>',
      count ? '<a class="button primary add-product-checkout-link" href="' + escapeHtml(checkoutHref) + '" data-add-product-checkout>Finalizar pedido</a>' : "",
      '</div>',
      '<nav class="category-grid category-grid-count-' + Math.max(1, Math.min(5, categories.length)) + '" aria-label="Produtos para adicionar ao pedido">',
      cards,
      '</nav>',
      '</div>',
      '</section>',
      renderFooter(home.brand),
      '</main>'
    ].join(""));

    startHomeCarousels(home);
  }

  function checkoutDeliveryOptions() {
    return Array.isArray(state.checkoutDeliveryOptions) && state.checkoutDeliveryOptions.length
      ? state.checkoutDeliveryOptions
      : defaultDeliveryOptions();
  }

  function firstCartProductSlug() {
    var item = getCartItems().filter(function (candidate) {
      return candidate && candidate.productSlug;
    })[0];

    return item ? item.productSlug : "";
  }

  function cartItemCatalogContext(item) {
    var selections = item && item.selections && typeof item.selections === "object" ? item.selections : {};
    var explicit = String(selections.catalog_context || "");
    var slug = String(item && item.productSlug || "");
    if (explicit) {
      return explicit;
    }
    return ["crachas", "imanes", "caderninhos", "cadernos"].indexOf(slug) !== -1 ? "congress-2026" : "main";
  }

  function cartCatalogContext(cart) {
    var contexts = [];
    ((cart && cart.items) || []).forEach(function (item) {
      var context = cartItemCatalogContext(item);
      if (contexts.indexOf(context) === -1) contexts.push(context);
    });
    return contexts.length > 1 ? "mixed" : (contexts[0] || "main");
  }

  function loadCheckoutDeliveryOptions() {
    var cart = loadCart();
    var firstItem = cart.items[0] || null;
    var slug = firstItem ? firstItem.productSlug : "";
    var context = firstItem ? cartItemCatalogContext(firstItem) : "main";

    state.checkoutDeliveryOptions = defaultDeliveryOptions();

    if (!slug) {
      return Promise.resolve(state.checkoutDeliveryOptions);
    }

    return loadJson((context === "congress-2026" ? "congressos/2026/content/products/" : "content/products/") + slug + ".json").then(function (product) {
      state.checkoutDeliveryOptions = deliveryOptions(product);
      return state.checkoutDeliveryOptions;
    }).catch(function () {
      state.checkoutDeliveryOptions = defaultDeliveryOptions();
      return state.checkoutDeliveryOptions;
    });
  }

  function checkoutSelectedDeliveryOption() {
    var selected = state.checkout.delivery_option || "";
    return checkoutDeliveryOptions().filter(function (option) {
      return option.id === selected;
    })[0] || null;
  }

  function checkoutShippingCents() {
    var option = checkoutSelectedDeliveryOption();
    return option ? deliveryFeeCents(option) : 0;
  }

  function checkoutSubtotalCents() {
    return getCartSubtotalCents();
  }

  function checkoutTotalCents() {
    return checkoutSubtotalCents() + checkoutShippingCents();
  }

  function normalizeCheckoutStep(value) {
    var number = Number(value);
    return number === 1 || number === 2 ? number - 1 : 0;
  }

  function checkoutStepFromUrl() {
    var params = currentUrlParams();
    var step = params.get("step");
    return step ? normalizeCheckoutStep(step) : null;
  }

  function loadCheckoutSession() {
    var stored = safeSessionGetItem(CHECKOUT_SESSION_KEY);
    var parsed;

    if (!stored) {
      return null;
    }

    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      return null;
    }

    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  }

  function saveCheckoutSession() {
    safeSessionSetItem(CHECKOUT_SESSION_KEY, JSON.stringify({
      checkout: {
        customer_name: String(state.checkout.customer_name || ""),
        customer_contact: String(state.checkout.customer_contact || ""),
        customer_nif: String(state.checkout.customer_nif || ""),
        delivery_option: String(state.checkout.delivery_option || ""),
        send_copy: !!state.checkout.send_copy,
        send_copy_touched: !!state.checkout.send_copy_touched,
        copy_email: String(state.checkout.copy_email || "")
      },
      checkoutStep: state.checkoutStep,
      updatedAt: nowIso()
    }));
  }

  function restoreCheckoutSession() {
    var stored = loadCheckoutSession();
    var checkout = stored && stored.checkout && typeof stored.checkout === "object" ? stored.checkout : null;
    var urlStep = checkoutStepFromUrl();

    if (checkout) {
      state.checkout.customer_name = String(checkout.customer_name || "");
      state.checkout.customer_contact = String(checkout.customer_contact || "");
      state.checkout.customer_nif = String(checkout.customer_nif || "");
      state.checkout.customer_congregation = "";
      state.checkout.delivery_option = String(checkout.delivery_option || "");
      state.checkout.send_copy = !!checkout.send_copy;
      state.checkout.send_copy_touched = !!checkout.send_copy_touched;
      state.checkout.copy_email = String(checkout.copy_email || "");
    }

    if (urlStep !== null) {
      state.checkoutStep = urlStep;
    } else if (stored && stored.checkoutStep != null) {
      state.checkoutStep = Math.max(0, Math.min(1, Number(stored.checkoutStep) || 0));
    }
  }

  function clearCheckoutSession() {
    safeSessionRemoveItem(CHECKOUT_SESSION_KEY);
  }

  function checkoutUrlFromStoredSession() {
    var stored = loadCheckoutSession();
    var step = stored && stored.checkoutStep != null ? Math.max(0, Math.min(1, Number(stored.checkoutStep) || 0)) : 0;
    return checkoutUrlForStep(step);
  }

  function updateCheckoutHistory(replace) {
    var url = checkoutUrlForStep(state.checkoutStep);
    var historyState = { miaCheckout: true, step: state.checkoutStep };

    if (!window.history || !window.history.pushState || !window.history.replaceState) {
      return;
    }

    if (replace) {
      window.history.replaceState(historyState, "", url);
    } else {
      window.history.pushState(historyState, "", url);
    }
  }

  function bindCheckoutHistory(home) {
    if (checkoutHistoryBound || !window.history || !window.history.pushState) {
      return;
    }

    checkoutHistoryBound = true;
    window.addEventListener("popstate", function (event) {
      var nextStep;

      if (page !== "checkout") {
        return;
      }

      if (event.state && event.state.miaCheckout === true) {
        nextStep = Math.max(0, Math.min(1, Number(event.state.step) || 0));
      } else {
        nextStep = checkoutStepFromUrl();
        nextStep = nextStep === null ? 0 : nextStep;
      }

      state.checkoutStep = nextStep;
      state.errors = "";
      saveCheckoutSession();
      renderCheckoutPage(home);
      bindCheckoutPage(home);
    });
  }

  function syncCheckoutCopyEmail() {
    var contact = String(state.checkout.customer_contact || "").trim();
    if (state.checkout.send_copy && !state.checkout.copy_email && isValidEmail(contact)) {
      state.checkout.copy_email = contact;
    }
    if (!state.checkout.send_copy) {
      state.checkout.copy_email = "";
    }
  }

  function validateCheckoutStep(stepIndex) {
    var contactError;

    state.invalidFields = [];

    if (getCartCount() < 1) {
      return "O carrinho está vazio.";
    }

    if (stepIndex !== 0) {
      return "";
    }

    if (!String(state.checkout.customer_name || "").trim()) {
      state.invalidFields = ["customer_name"];
      return "Indica o teu nome.";
    }

    if (!String(state.checkout.customer_contact || "").trim()) {
      state.invalidFields = ["customer_contact"];
      return "Indica um email ou telemóvel válido para podermos confirmar a encomenda.";
    }

    contactError = validateContactInput(state.checkout.customer_contact);
    if (contactError) {
      state.invalidFields = ["customer_contact"];
      return contactError;
    }

    if (!validNifInput(state.checkout.customer_nif)) {
      state.invalidFields = ["customer_nif"];
      return "O NIF deve ter 9 dígitos.";
    }

    if (!state.checkout.delivery_option) {
      state.invalidFields = ["delivery_option"];
      return "Escolhe uma forma de entrega.";
    }

    return "";
  }

  function validateCheckoutCopyRequest() {
    syncCheckoutCopyEmail();

    if (state.checkout.send_copy && !isValidEmail(state.checkout.copy_email)) {
      state.invalidFields = ["copy_email"];
      return "Indica um email válido para receber a cópia.";
    }

    return "";
  }

  function focusCheckoutFirstError() {
    window.requestAnimationFrame(function () {
      var target = document.querySelector(".is-missing, [data-checkout-delivery-error], [data-checkout-copy-email]");
      if (!target && state.invalidFields.indexOf("delivery_option") !== -1) {
        target = document.querySelector("[data-checkout-delivery-option]");
      }
      if (!target) {
        return;
      }
      if (target.focus) {
        target.focus({ preventScroll: true });
      }
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  function renderCheckoutProgress() {
    return [
      '<ol class="checkout-step-list" aria-label="Progresso do checkout">',
      '<li class="' + (state.checkoutStep === 0 ? "is-active" : "is-complete") + '"><span>1</span> Contacto e entrega</li>',
      '<li class="' + (state.checkoutStep === 1 ? "is-active" : "") + '"><span>2</span> Confirmar pedido</li>',
      '</ol>'
    ].join("");
  }

  function renderCheckoutCartItems(options) {
    var opts = options || {};
    var items = getCartItems();

    if (!items.length) {
      return [
        '<section class="checkout-cart-list">',
        '<h3>O que vais encomendar</h3>',
        '<div class="cart-empty-state"><strong>O carrinho está vazio.</strong><p>Adiciona um produto antes de finalizar o pedido.</p></div>',
        '</section>'
      ].join("");
    }

    return [
      '<section class="checkout-cart-list">',
      '<h3>O que vais encomendar</h3>',
      '<ol class="cart-panel-list">',
      items.map(function (item, index) {
        var summary = formatCartItemSummary(item);
        var customizationFee = cartCustomizationFeeText(item);
        var thumb = summary.image
          ? '<img src="' + escapeHtml(summary.image) + '" alt="" loading="lazy">'
          : '<span aria-hidden="true">' + escapeHtml(summary.productName.slice(0, 1).toUpperCase()) + '</span>';
        return [
          '<li class="cart-panel-item checkout-cart-item">',
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
          opts.allowEdit && cartItemIsEditable(item) ? '<button type="button" class="cart-edit-button" data-checkout-edit="' + escapeHtml(item.id) + '">Editar</button>' : "",
          opts.allowRemove ? '<button type="button" class="cart-remove-button" data-checkout-remove="' + escapeHtml(item.id) + '">Remover</button>' : "",
          '</div>',
          '</div>',
          '</li>'
        ].join("");
      }).join(""),
      '</ol>',
      '</section>'
    ].join("");
  }

  function renderCheckoutContactStep() {
    var hasDeliveryError = state.invalidFields.indexOf("delivery_option") !== -1;
    var deliveryOptionsHtml = checkoutDeliveryOptions().map(function (option) {
      var isSelected = option.id === state.checkout.delivery_option;
      return [
        '<label class="dc-delivery-option' + (isSelected ? " is-selected" : "") + '">',
        '<input type="radio" name="checkout_delivery_option" value="' + escapeHtml(option.id) + '" data-checkout-delivery-option' + (isSelected ? " checked" : "") + '>',
        '<span class="dc-delivery-text">',
        '<strong>' + escapeHtml(option.label) + '</strong>',
        option.text ? '<em>' + escapeHtml(option.text) + '</em>' : "",
        '</span>',
        '<b class="dc-delivery-price">' + escapeHtml(deliveryPriceText(option)) + '</b>',
        '</label>'
      ].join("");
    }).join("");

    syncCheckoutCopyEmail();

    return [
      '<section class="delivery-contact-step checkout-contact-step">',
      '<section class="dc-block dc-contact">',
      '<h3 class="dc-block-title">Dados de contacto</h3>',
      '<div class="dc-contact-grid">',
      '<label class="dc-field"><span>Nome</span><input class="' + (state.invalidFields.indexOf("customer_name") !== -1 ? "is-missing" : "") + '" type="text" name="customer_name" value="' + escapeHtml(state.checkout.customer_name) + '" autocomplete="name" data-checkout-field required></label>',
      '<label class="dc-field"><span>Email ou telemóvel</span><input class="' + (state.invalidFields.indexOf("customer_contact") !== -1 ? "is-missing" : "") + '" type="text" name="customer_contact" value="' + escapeHtml(state.checkout.customer_contact) + '" autocomplete="email" data-checkout-field required></label>',
      '<div class="dc-field"><label><span>Número de Contribuinte (NIF) <small>(opcional)</small></span><input class="' + (state.invalidFields.indexOf("customer_nif") !== -1 ? "is-missing" : "") + '" type="text" name="customer_nif" value="' + escapeHtml(state.checkout.customer_nif) + '" placeholder="" autocomplete="off" inputmode="numeric" data-checkout-field' + (state.invalidFields.indexOf("customer_nif") !== -1 ? ' aria-invalid="true"' : '') + '></label></div>',
      '</div>',
      '<p class="dc-block-note">Se deixares em branco, a fatura será emitida como consumidor final.</p>',
      '<p class="dc-block-note">A fatura será emitida após confirmação do pagamento. Se indicares email, enviamos por email. Se indicares telemóvel, podemos enviar por WhatsApp.</p>',
      '</section>',
      '<section class="dc-block dc-delivery' + (hasDeliveryError ? ' is-missing' : '') + '"' + (hasDeliveryError ? ' data-checkout-delivery-error tabindex="-1"' : '') + '>',
      '<h3 class="dc-block-title">Como queres receber a tua encomenda?</h3>',
      '<p class="dc-block-subtitle">Caso já tenhas feito uma encomenda que ainda não foi enviada, escolhe "Junta as minhas encomendas" para receberes todas as tuas encomendas na mesma embalagem.</p>',
      hasDeliveryError ? siteErrorMarkup("Escolhe uma forma de entrega.", "form-error") : "",
      '<div class="dc-delivery-options">' + deliveryOptionsHtml + '</div>',
      '</section>',
      renderCheckoutCartItems({ allowRemove: true, allowEdit: true }),
      '</section>'
    ].join("");
  }

  function renderCheckoutConfirmStep() {
    var delivery = checkoutSelectedDeliveryOption();
    var shipping = checkoutShippingCents();
    var subtotal = checkoutSubtotalCents();
    var total = checkoutTotalCents();
    var suspended = ordersAreSuspended();
    var hasPriceToConfirm = cartHasPriceToConfirm();
    var productTotalText = hasPriceToConfirm
      ? (subtotal > 0 ? formatCents(subtotal) + " + preço a confirmar" : "Preço a confirmar")
      : formatCents(subtotal);
    var orderTotalText = hasPriceToConfirm ? "A confirmar pela Mia" : formatCents(total);

    return [
      '<form id="cart-checkout-form" action="send-order.php" method="post" novalidate>',
      '<input type="hidden" name="return_to" value="checkout.html">',
      '<input type="hidden" name="order_mode" value="cart">',
      '<label class="hidden-field" aria-hidden="true"><span>Website</span><input type="text" name="website" tabindex="-1" autocomplete="off"></label>',
      renderCheckoutCartItems({ allowRemove: false, allowEdit: true }),
      '<section class="confirm-card checkout-confirm-card" aria-label="Resumo do pedido">',
      '<h3>Dados de contacto e entrega</h3>',
      '<dl class="confirm-list">',
      '<div><dt>Nome:</dt><dd>' + escapeHtml(state.checkout.customer_name || "") + '</dd></div>',
      '<div><dt>Contacto:</dt><dd>' + escapeHtml(state.checkout.customer_contact || "") + '</dd></div>',
      '<div><dt>NIF:</dt><dd>' + escapeHtml(state.checkout.customer_nif || "Não indicado") + '</dd></div>',
      '<div><dt>Entrega:</dt><dd>' + escapeHtml(delivery ? delivery.label : "") + '</dd></div>',
      '<div><dt>Cópia por email:</dt><dd>' + escapeHtml(state.checkout.send_copy ? state.checkout.copy_email : "Não") + '</dd></div>',
      '</dl>',
      '<hr class="confirm-divider" aria-hidden="true">',
      '<dl class="confirm-list">',
      '<div><dt>Total dos produtos:</dt><dd>' + escapeHtml(productTotalText) + '</dd></div>',
      '<div><dt>Portes:</dt><dd>' + escapeHtml(shipping > 0 ? deliveryPriceText(delivery) : "Grátis") + '</dd></div>',
      '<div><dt>' + (hasPriceToConfirm ? 'Total:' : 'Total estimado:') + '</dt><dd>' + escapeHtml(orderTotalText) + '</dd></div>',
      '</dl>',
      '</section>',
      renderPaymentNotice(),
      '<div class="copy-request checkout-copy-request">',
      '<label><input type="checkbox" data-checkout-copy-toggle' + (state.checkout.send_copy ? " checked" : "") + '> <span>Enviar uma cópia deste pedido para o meu email</span></label>',
      state.checkout.send_copy ? '<input class="' + (state.invalidFields.indexOf("copy_email") !== -1 ? "is-missing" : "") + '" type="text" name="copy_email" data-checkout-copy-email placeholder="O teu email" value="' + escapeHtml(state.checkout.copy_email) + '" autocomplete="email">' : "",
      state.checkout.send_copy && state.invalidFields.indexOf("copy_email") !== -1 ? siteErrorMarkup("Indica um email válido para receber a cópia.", "form-error") : "",
      '</div>',
      state.errors === ordersSuspendedCheckoutMessage() ? siteErrorMarkup(state.errors, "form-error action-error checkout-action-error") : "",
      '<div class="step-actions checkout-actions">',
      '<button class="button secondary" type="button" data-checkout-back>Voltar</button>',
      '<button class="button primary' + (suspended ? ' is-disabled' : '') + '" type="' + (suspended ? "button" : "submit") + '"' + (suspended ? ' data-checkout-suspended-submit aria-disabled="true"' : "") + '>Confirmar pedido</button>',
      '</div>',
      '</form>'
    ].join("");
  }

  function cartSubmissionPayload() {
    var cart = loadCart();
    var session = funnelSession();
    return {
      order_mode: "cart",
      schemaVersion: cart.schemaVersion,
      cartId: cart.cartId,
      funnel_session_id: session && session.id ? session.id : "",
      cart_context: cartCatalogContext(cart),
      items: cart.items,
      checkout: {
        customer_name: String(state.checkout.customer_name || "").trim(),
        customer_contact: String(state.checkout.customer_contact || "").trim(),
        customer_nif: String(state.checkout.customer_nif || "").trim(),
        delivery_option: String(state.checkout.delivery_option || "").trim(),
        send_copy: !!state.checkout.send_copy,
        copy_email: state.checkout.send_copy ? String(state.checkout.copy_email || "").trim() : ""
      }
    };
  }

  function renderCheckoutPage(home) {
    ensureHomeSettings(home);
    applySiteSettings(home);
    state.home = home;

    if (getCartCount() < 1) {
      state.checkoutStep = 0;
    }

    renderChrome([
      '<main class="product-shell checkout-shell">',
      renderBrand(home.brand || "Mia & Paper", "index.html", home.instagramUrl, home.categories),
      '<section class="wizard-shell checkout-wizard" aria-labelledby="checkout-title">',
      renderCheckoutProgress(),
      '<div class="step-card">',
      '<p class="eyebrow">Checkout</p>',
      '<h1 id="checkout-title">' + (state.checkoutStep === 0 ? "Contacto e entrega" : "Confirmar pedido") + '</h1>',
      state.errors && !(state.checkoutStep === 1 && state.errors === ordersSuspendedCheckoutMessage()) ? siteErrorMarkup(state.errors, "form-error action-error") : "",
      getCartCount() < 1 ? [
        '<div class="cart-empty-state checkout-empty-state">',
        '<strong>O carrinho está vazio.</strong>',
        '<p>Adiciona um produto antes de finalizar o pedido.</p>',
        '</div>',
        '<a class="button primary" href="index.html">Escolher produto</a>'
      ].join("") : (state.checkoutStep === 0 ? renderCheckoutContactStep() : renderCheckoutConfirmStep()),
      '</div>',
      getCartCount() > 0 && state.checkoutStep === 0 ? [
        '<div class="step-actions checkout-actions">',
        '<a class="button secondary" href="index.html" data-checkout-add-product>Adicionar outro produto</a>',
        '<button class="button primary" type="button" data-checkout-next>Continuar</button>',
        '</div>'
      ].join("") : "",
      '</section>',
      renderFooter(home.brand),
      '</main>'
    ].join(""));
  }

  function bindCheckoutPage(home) {
    document.querySelectorAll("[data-checkout-field]").forEach(function (input) {
      input.addEventListener("input", function () {
        state.checkout[input.name] = input.value;
        state.checkout.customer_congregation = "";
        state.errors = "";
        if (input.name === "customer_contact" && !state.checkout.send_copy_touched) {
          syncCheckoutCopyEmail();
        }
        saveCheckoutSession();
      });
      input.addEventListener("change", function () {
        state.checkout[input.name] = input.value;
        state.checkout.customer_congregation = "";
        saveCheckoutSession();
      });
    });

    document.querySelectorAll("[data-checkout-delivery-option]").forEach(function (input) {
      input.addEventListener("change", function () {
        state.checkout.delivery_option = input.value;
        state.errors = "";
        saveCheckoutSession();
        trackOrderEvent("delivery_selected", {
          selected_delivery: input.value,
          cart_id: loadCart().cartId,
          item_count: getCartCount()
        });
        renderCheckoutPage(home);
        bindCheckoutPage(home);
      });
    });

    document.querySelectorAll("[data-checkout-copy-toggle]").forEach(function (input) {
      input.addEventListener("change", function () {
        state.checkout.send_copy = input.checked;
        state.checkout.send_copy_touched = true;
        syncCheckoutCopyEmail();
        saveCheckoutSession();
        renderCheckoutPage(home);
        bindCheckoutPage(home);
      });
    });

    document.querySelectorAll("[data-checkout-copy-email]").forEach(function (input) {
      input.addEventListener("input", function () {
        state.checkout.copy_email = input.value;
        saveCheckoutSession();
      });
      input.addEventListener("change", function () {
        state.checkout.copy_email = input.value;
        saveCheckoutSession();
      });
    });

    document.querySelectorAll("[data-checkout-remove]").forEach(function (button) {
      button.addEventListener("click", function () {
        removeCartItem(button.dataset.checkoutRemove);
        state.errors = getCartCount() ? "" : "O carrinho está vazio.";
        if (getCartCount() < 1) {
          state.checkoutStep = 0;
        }
        saveCheckoutSession();
        renderCheckoutPage(home);
        bindCheckoutPage(home);
      });
    });

    document.querySelectorAll("[data-checkout-edit]").forEach(function (button) {
      button.addEventListener("click", function () {
        saveCheckoutSession();
        openCartItemEditor(button.dataset.checkoutEdit, checkoutUrlForStep(state.checkoutStep));
      });
    });

    document.querySelectorAll("[data-checkout-add-product]").forEach(function (link) {
      link.addEventListener("click", function () {
        saveCheckoutSession();
      });
    });

    document.querySelectorAll("[data-checkout-next]").forEach(function (button) {
      button.addEventListener("click", function () {
        var error = validateCheckoutStep(0);
        if (error) {
          state.errors = error;
          renderCheckoutPage(home);
          bindCheckoutPage(home);
          focusCheckoutFirstError();
          return;
        }
        state.errors = "";
        state.checkoutStep = 1;
        saveCheckoutSession();
        updateCheckoutHistory(false);
        trackOrderEvent("cart_checkout_started", {
          cart_id: loadCart().cartId,
          item_count: getCartCount()
        });
        renderCheckoutPage(home);
        bindCheckoutPage(home);
      });
    });

    document.querySelectorAll("[data-checkout-back]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.errors = "";
        state.checkoutStep = 0;
        saveCheckoutSession();
        updateCheckoutHistory(true);
        renderCheckoutPage(home);
        bindCheckoutPage(home);
      });
    });

    document.querySelectorAll("[data-checkout-suspended-submit]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.errors = ordersSuspendedCheckoutMessage();
        renderCheckoutPage(home);
        bindCheckoutPage(home);
      });
    });

    var form = document.querySelector("#cart-checkout-form");
    if (form) {
      form.addEventListener("submit", function (event) {
        var error;
        var payload;

        if (ordersAreSuspended()) {
          event.preventDefault();
          state.errors = ordersSuspendedCheckoutMessage();
          renderCheckoutPage(home);
          bindCheckoutPage(home);
          return;
        }

        error = validateCheckoutStep(0) || validateCheckoutCopyRequest();

        if (error) {
          event.preventDefault();
          if (state.invalidFields.indexOf("copy_email") === -1) {
            state.checkoutStep = 0;
            updateCheckoutHistory(true);
          }
          state.errors = error;
          saveCheckoutSession();
          renderCheckoutPage(home);
          bindCheckoutPage(home);
          focusCheckoutFirstError();
          return;
        }

        form.querySelectorAll("[data-generated-field]").forEach(function (field) {
          field.remove();
        });
        payload = cartSubmissionPayload();
        appendHidden(form, "cart_json", JSON.stringify(payload));
        trackOrderEvent("cart_order_submitted", {
          cart_id: payload.cartId,
          cart_context: payload.cart_context,
          item_count: payload.items.length,
          subtotal_cents: checkoutSubtotalCents()
        });
      });
    }
  }

  function initAddProduct() {
    loadJson(ORDER_HOME_CONTENT).then(function (home) {
      applySiteSettings(home);
      if (window.MiaButterflies && window.MiaButterflies.refresh) {
        window.MiaButterflies.refresh();
      }
      return enrichHomeWithCarousels(home);
    }).then(renderAddProductPage).catch(function (error) {
      app.innerHTML = '<main class="fallback"><h1>Mia &amp; Paper</h1><p>' + escapeHtml(error.message) + '</p></main>';
    });
  }

  function initCheckout() {
    restoreCheckoutSession();
    loadJson(ORDER_HOME_CONTENT).then(function (home) {
      applySiteSettings(home);
      if (window.MiaButterflies && window.MiaButterflies.refresh) {
        window.MiaButterflies.refresh();
      }
      return loadCheckoutDeliveryOptions().then(function () {
        if (state.checkoutStep === 1 && validateCheckoutStep(0)) {
          state.checkoutStep = 0;
          state.errors = "";
          state.invalidFields = [];
        }
        saveCheckoutSession();
        updateCheckoutHistory(true);
        bindCheckoutHistory(home);
        renderCheckoutPage(home);
        bindCheckoutPage(home);
      });
    }).catch(function (error) {
      app.innerHTML = '<main class="fallback"><h1>Mia &amp; Paper</h1><p>' + escapeHtml(error.message) + '</p></main>';
    });
  }

  function adminKeyboardIgnoredTarget(target) {
    var tag = target && target.tagName ? target.tagName.toLowerCase() : "";
    return tag === "input" || tag === "textarea" || tag === "select" || tag === "button" || tag === "a" || !!(target && target.isContentEditable);
  }

  function clampAdminImageValue(key, value) {
    var limits = {
      imageZoom: [20, 500],
      imagePositionX: [-100, 100],
      imagePositionY: [-100, 100],
      imageRotation: [-180, 180]
    };
    var range = limits[key] || [-9999, 9999];
    var number = Number(value);

    if (!isFinite(number)) {
      number = key === "imageZoom" ? 168 : 0;
    }

    return Math.max(range[0], Math.min(range[1], Math.round(number * 100) / 100));
  }

