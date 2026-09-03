// js/09-admin-paineis.js — parte 09/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: paineis de administracao no site: parseEuroCents, painel de entregas, painel de seccoes, settings da home, renderAdminSurface, cartoes de categorias indisponiveis.
  function parseEuroCents(value) {
    var cleaned = String(value == null ? "" : value)
      .replace(/€/g, "")
      .replace(/\s+/g, "")
      .replace(/,/g, ".");
    var number = parseFloat(cleaned);

    if (!isFinite(number)) {
      return 0;
    }

    return Math.max(0, Math.round(number * 100));
  }

  function allPriceQuantities(prices) {
    var seen = {};
    var quantities = [];

    Object.keys(prices || {}).forEach(function (size) {
      Object.keys(prices[size] || {}).forEach(function (quantity) {
        if (!seen[quantity]) {
          seen[quantity] = true;
          quantities.push(quantity);
        }
      });
    });

    quantities.sort(function (a, b) {
      return Number(a) - Number(b);
    });

    return quantities;
  }

  function ensureAdminPriceShell(product) {
    var packStep = product ? findStep(product, "pack") : null;
    var key;

    if (!product) {
      return;
    }

    if (!product.prices || typeof product.prices !== "object") {
      product.prices = {};
    }

    if (Object.keys(product.prices).length) {
      return;
    }

    key = product.defaultPriceKey || product.unitShort || product.unitSingular || "Preço";
    product.defaultPriceKey = key;
    product.prices[key] = {};

    (packStep && packStep.items ? packStep.items : []).forEach(function (item) {
      var quantity = Number(item.quantity);
      if (quantity) {
        product.prices[key][String(quantity)] = 0;
      }
    });
  }

  // SMART_QUANTITIES_V1: caixinha admin global "Quantidades inteligentes".
  // Vive em pricing.json em settings.smartQuantities (default true). Afecta
  // todos os produtos que tenham gestor de quantidades por design.
  function renderAdminSiteSettingsPanel() {
    var smart = smartQuantitiesEnabled();
    return [
      '<details class="admin-step-panel">',
      '<summary>Configurações do site</summary>',
      '<label class="admin-check"><input type="checkbox"' + (smart ? " checked" : "") + ' data-admin-smart-quantities> Quantidades inteligentes</label>',
      '<p class="admin-price-help">Quando ligado, ao mudar o pack as quantidades dos designs escalam proporcionalmente (ex.: 3/3/3/15 com pack 24 → 6/6/6/30 ao escolher pack 48). Quando desligado, o pack é redistribuído por igual sempre que muda. Em ambos os casos o botão "Distribuir por igual" continua disponível.</p>',
      '</details>'
    ].join("");
  }

  function renderAdminQuantityPricingSwitchSetting() {
    return [
      '<label class="admin-check admin-quantity-pricing-setting">',
      '<input type="checkbox"' + (quantityPricingSwitchEnabled() ? " checked" : "") + ' data-admin-quantity-pricing-switch-visible> ',
      'Mostrar escolha entre “Packs” e “Por quantidade”',
      '</label>'
    ].join("");
  }

  function renderAdminPricePanel(product) {
    return [
      '<details class="admin-step-panel admin-price-panel">',
      '<summary>Preços e packs</summary>',
      '<p class="admin-price-help">Os preços, packs, descontos e modos de cálculo editam-se apenas no editor central.</p>',
      '<p><a class="button secondary" href="precos.php">Abrir editor de preços</a></p>',
      '</details>'
    ].join("");
  }

  function renderAdminDeliveryPanel(product) {
    return product && product.deliveryOptions
      ? '<details class="admin-step-panel admin-price-panel"><summary>Entrega</summary><p class="admin-price-help">Os portes e respectivos textos monetários editam-se no <a href="precos.php">editor de preços</a>.</p></details>'
      : "";
  }

  function renderAdminRectOrientationPanel(product) {
    return "";
  }

  function productSlugClass(product) {
    return "product-" + String(product && product.slug ? product.slug : "item").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  }

  function productShapeClass(product) {
    return (product && product.imageShape === "round") || (product && productFamily(product) === "crachas")
      ? "product-shape-round"
      : "product-shape-rect";
  }

  function productRectOrientation(product) {
    return product && product.rectOrientation === "landscape" ? "landscape" : "portrait";
  }

  function productOrientationClass(product) {
    return productShapeClass(product) === "product-shape-rect"
      ? "product-rect-orientation-" + productRectOrientation(product)
      : "";
  }

  function itemRectOrientation(item) {
    return item && item.rectOrientation === "landscape" ? "landscape" : "portrait";
  }

  function itemRectOrientationClass(item) {
    return item && item.image ? " item-rect-orientation-" + itemRectOrientation(item) : "";
  }

  function itemFrameShapeClass(item) {
    return item && item.frameShape === "rounded-square" ? " item-frame-rounded-square" : "";
  }

  function renderAdminStepImagePanel(step) {
    var items = step && step.items ? step.items : [];
    var first = items[0] || {};

    if (!items.length || step.template === "quantity-builder") {
      return "";
    }

    return [
      '<details class="admin-step-panel admin-image-panel">',
      '<summary>Imagens deste passo</summary>',
      '<p>Aplica a mesma moldura e/ou o mesmo recorte interno da imagem a todos os itens deste passo.</p>',
      '<div class="admin-image-control-grid">',
      '<label><span>Tamanho da moldura (%)</span><input type="number" min="40" max="300" step="1" value="' + escapeHtml(frameEditNumber(first, step, false, "frameScale", 100, 40, 300)) + '" data-admin-bulk-frame="frameScale" data-admin-bulk-step="' + escapeHtml(step.id) + '"></label>',
      '<label><span>Margem moldura X (px)</span><input type="number" min="-100" max="100" step="1" value="' + escapeHtml(frameEditNumber(first, step, false, "frameMarginX", 0, -100, 100)) + '" data-admin-bulk-frame="frameMarginX" data-admin-bulk-step="' + escapeHtml(step.id) + '"></label>',
      '<label><span>Margem moldura Y (px)</span><input type="number" min="-100" max="100" step="1" value="' + escapeHtml(frameEditNumber(first, step, false, "frameMarginY", 0, -100, 100)) + '" data-admin-bulk-frame="frameMarginY" data-admin-bulk-step="' + escapeHtml(step.id) + '"></label>',
      '<label><span>Zoom imagem (%)</span><input type="number" min="20" max="500" step="1" value="' + escapeHtml(imageEditNumber(first, step, false, "imageZoom", 168, 20, 500)) + '" data-admin-bulk-frame="imageZoom" data-admin-bulk-step="' + escapeHtml(step.id) + '"></label>',
      '<label><span>Imagem X (%)</span><input type="number" min="-100" max="100" step="1" value="' + escapeHtml(imageEditNumber(first, step, false, "imagePositionX", 0, -100, 100)) + '" data-admin-bulk-frame="imagePositionX" data-admin-bulk-step="' + escapeHtml(step.id) + '"></label>',
      '<label><span>Imagem Y (%)</span><input type="number" min="-100" max="100" step="1" value="' + escapeHtml(imageEditNumber(first, step, false, "imagePositionY", 0, -100, 100)) + '" data-admin-bulk-frame="imagePositionY" data-admin-bulk-step="' + escapeHtml(step.id) + '"></label>',
      '<label><span>Rotação imagem (°)</span><input type="number" min="-180" max="180" step="1" value="' + escapeHtml(imageEditNumber(first, step, false, "imageRotation", 0, -180, 180)) + '" data-admin-bulk-frame="imageRotation" data-admin-bulk-step="' + escapeHtml(step.id) + '"></label>',
      '</div>',
      '<button type="button" data-admin-apply-frame="' + escapeHtml(step.id) + '">Aplicar a todos</button>',
      '</details>'
    ].join("");
  }

  function renderAdminSectionsPanel(product, step) {
    var config = getStepSectionConfig(product, step);
    if (!config) {
      return "";
    }
    var sections = ensureStepSections(step, config.defaults);
    var summaryLabel;
    var helpText;
    if (config.mode === "visible") {
      summaryLabel = productFamily(product) === "crachas" ? "Separadores dos crachás" : (productFamily(product) === "imanes" ? "Separadores dos ímanes" : "Separadores deste passo");
      helpText = "Os " + sections.length + " títulos abaixo aparecem como secções no Passo 1. Cada item tem o seu separador, prefixo de nome e ordem.";
    } else {
      summaryLabel = "Grupos invisíveis (Passo 1)";
      helpText = "Estes grupos não aparecem ao visitante. Servem para definir a ordem dos itens dentro de cada grupo. O fluxo público mostra grupo 1 primeiro, depois grupo 2.";
    }

    var rows = sections.map(function (section, idx) {
      var prefixField = config.mode === "visible"
        ? '<label><span>Prefixo separador ' + (idx + 1) + ' (ex.: ' + escapeHtml(config.defaults[idx].labelPrefix || "") + ')</span><input type="text" value="' + escapeHtml(section.labelPrefix || "") + '" placeholder="' + escapeHtml(config.defaults[idx].labelPrefix || "") + '" data-admin-section-prefix="' + idx + '"></label>'
        : "";
      return '<label><span>Título ' + (config.mode === "visible" ? "separador" : "grupo") + ' ' + (idx + 1) + '</span><input type="text" value="' + escapeHtml(section.title) + '" data-admin-section-title="' + idx + '"></label>' + prefixField;
    }).join("");

    return [
      '<details class="admin-step-panel admin-image-panel" open>',
      '<summary>' + escapeHtml(summaryLabel) + '</summary>',
      '<p class="admin-price-help">' + escapeHtml(helpText) + '</p>',
      rows,
      '</details>'
    ].join("");
  }

  // Alias retro-compativel.
  function renderAdminCrachasSectionsPanel(step) {
    return renderAdminSectionsPanel(state.product, step);
  }

  function activeAdminImageRecord(product) {
    var active = state.adminActiveImage;
    var step;
    var item;
    var storeItem;
    var sourceItem;
    var hasImage;

    if (!product || !active || !active.stepId || !active.itemId) {
      return null;
    }

    step = findStep(product, active.stepId);
    item = stepItemById(step, active.itemId);
    storeItem = stepItemById(step, active.imageStoreItemId || active.itemId);
    sourceItem = active.editKey
      ? imageSlotProxyItem(item, active.editKey, active.fallbackEditKey || "", storeItem)
      : item;

    hasImage = active.side ? isUploadedSideImage(item) : isUploadedImage(item);
    if (!step || !item || !hasImage) {
      return null;
    }

    return {
      step: step,
      item: sourceItem,
      rawItem: item,
      storeItem: storeItem || item,
      side: !!active.side,
      editKey: active.editKey || "",
      fallbackEditKey: active.fallbackEditKey || ""
    };
  }

  function renderAdminImageKeyboardPanel(product) {
    var record = activeAdminImageRecord(product);
    var item = record && record.item;
    var side = record && record.side;
    var keyX = side ? "sideImagePositionX" : "imagePositionX";
    var keyY = side ? "sideImagePositionY" : "imagePositionY";
    var keyZ = side ? "sideImageZoom" : "imageZoom";
    var keyR = side ? "sideImageRotation" : "imageRotation";
    var label = item
      ? (displayItemTitle(item) || item.value || item.id) + (side ? " (foto direita)" : "")
      : "";

    if (!product) {
      return "";
    }

    return [
      '<details class="admin-step-panel admin-keyboard-panel" open>',
      '<summary>Ajuste rápido por teclado</summary>',
      item ? '<p class="admin-keyboard-selected">Selecionado: <strong>' + escapeHtml(label) + '</strong></p>' : '<p class="admin-keyboard-selected">Clica numa imagem para a selecionar.</p>',
      '<div class="admin-keyboard-values">',
      '<span>X <strong data-admin-keyboard-value="' + keyX + '">' + escapeHtml(item ? imageEditNumber(item, record.step, side, keyX, 0, -100, 100) : "–") + '</strong></span>',
      '<span>Y <strong data-admin-keyboard-value="' + keyY + '">' + escapeHtml(item ? imageEditNumber(item, record.step, side, keyY, 0, -100, 100) : "–") + '</strong></span>',
      '<span>Zoom <strong data-admin-keyboard-value="' + keyZ + '">' + escapeHtml(item ? imageEditNumber(item, record.step, side, keyZ, 168, 20, 500) : "–") + '</strong></span>',
      '<span>Rot. <strong data-admin-keyboard-value="' + keyR + '">' + escapeHtml(item ? imageEditNumber(item, record.step, side, keyR, 0, -180, 180) : "–") + '</strong></span>',
      '</div>',
      '<p class="admin-keyboard-help"><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> move X/Y · <kbd>Ctrl</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd> zoom · <kbd>Ctrl</kbd> + <kbd>←</kbd>/<kbd>→</kbd> rotação · <kbd>Shift</kbd> = passo maior.</p>',
      '<p class="admin-keyboard-help">Depois de ajustar, carrega em <strong>SAVE</strong> para gravar no JSON.</p>',
      '</details>'
    ].join("");
  }

  function renderBasicAdminTrackingPanel() {
    var ipText = state.adminIpLoaded && state.adminIp
      ? state.adminIp
      : (state.adminIpLoading ? "a confirmar..." : "indisponivel");
    var statusText = state.adminIpLoaded && state.adminIp
      ? (state.adminIpIgnored ? "Este IP esta na ignore list do tracking." : "Este IP ainda entra no tracking.")
      : "O IP aparece aqui depois de confirmado pelo servidor.";
    var buttonText = state.adminIpIgnored ? "Remover da ignore list" : "Ignorar este IP";
    var disabled = !state.adminIpLoaded || !state.adminIp;

    return [
      '<details class="admin-step-panel" open>',
      '<summary>Tracking</summary>',
      '<p class="admin-price-help">IP detectado: <code>' + escapeHtml(ipText) + '</code></p>',
      '<p class="admin-price-help">' + escapeHtml(statusText) + '</p>',
      '<button type="button" data-admin-toggle-own-ip-ignore' + (disabled ? " disabled" : "") + '>' + escapeHtml(buttonText) + '</button>',
      '</details>'
    ].join("");
  }


  function renderAdminHomeSettingsPanel(home) {
    var theme;

    if (!home) {
      return "";
    }

    ensureHomeSettings(home);
    theme = home.theme || {};

    return [
      '<details class="admin-step-panel admin-global-panel">',
      '<summary>Configuração global</summary>',
      '<p class="admin-price-help">Cores globais e fundo do site.</p>',
      '<div class="admin-image-control-grid">',
      '<label><span>Fundo página</span><input type="text" value="' + escapeHtml(theme.paper || "") + '" data-admin-home-theme="paper" placeholder="#fff8df"></label>',
      '<label><span>Cartões</span><input type="text" value="' + escapeHtml(theme.card || "") + '" data-admin-home-theme="card" placeholder="#fffdf5"></label>',
      '<label><span>Texto principal</span><input type="text" value="' + escapeHtml(theme.ink || "") + '" data-admin-home-theme="ink" placeholder="#2e2413"></label>',
      '<label><span>Texto secundário</span><input type="text" value="' + escapeHtml(theme.muted || "") + '" data-admin-home-theme="muted" placeholder="#7f6b42"></label>',
      '<label><span>Botões</span><input type="text" value="' + escapeHtml(theme.buttonBg || "") + '" data-admin-home-theme="buttonBg" placeholder="#72551e"></label>',
      '<label><span>Texto botões</span><input type="text" value="' + escapeHtml(theme.buttonText || "") + '" data-admin-home-theme="buttonText" placeholder="#fffdf8"></label>',
      '<label><span>Dourado</span><input type="text" value="' + escapeHtml(theme.gold || "") + '" data-admin-home-theme="gold" placeholder="#d7aa36"></label>',
      '<label><span>Verde/sage</span><input type="text" value="' + escapeHtml(theme.sage || "") + '" data-admin-home-theme="sage" placeholder="#d6bf77"></label>',
      '<label><span>Rosa</span><input type="text" value="' + escapeHtml(theme.rose || "") + '" data-admin-home-theme="rose" placeholder="#c58a72"></label>',
      '<label><span>Azul/neutro</span><input type="text" value="' + escapeHtml(theme.blue || "") + '" data-admin-home-theme="blue" placeholder="#9a8656"></label>',
      '</div>',
      '<label>Imagem de fundo do site<input type="file" accept="image/*" data-admin-home-background></label>',
      theme.backgroundImage ? '<button type="button" data-admin-home-background-remove>Remover imagem de fundo</button>' : "",
      '<hr>',
      '<label class="admin-check"><input type="checkbox"' + (home.showCategoryNumbers === true ? " checked" : "") + ' data-admin-home-toggle="showCategoryNumbers"> Mostrar números dos cartões (01, 02, ...)</label>',
      '<label class="admin-check"><input type="checkbox"' + (home.showThemeToggle === true ? " checked" : "") + ' data-admin-home-toggle="showThemeToggle"> Mostrar botão claro/escuro no header</label>',
      '<label class="admin-check"><input type="checkbox"' + (home.brandButterflyEnabled === true ? " checked" : "") + ' data-admin-home-toggle="brandButterflyEnabled"> Mostrar borboleta no texto da marca</label>',
      '<label class="admin-check"><input type="checkbox"' + (home.catalogFooterLinkVisible !== false ? " checked" : "") + ' data-admin-home-toggle="catalogFooterLinkVisible"> Mostrar link do catálogo no footer</label>',
      '<label class="admin-check"><input type="checkbox"' + (home.ordersSuspended === true ? " checked" : "") + ' data-admin-home-toggle="ordersSuspended"> encomendas suspensas</label>',
      // CAROUSEL_SLIDES_V1: os carrosseis mudaram-se todos para o carrousel.php,
      // onde cada imagem tem os seus parametros. Ter os dois sitios a escrever
      // nos mesmos campos era pedir para divergirem.
      '<p class="admin-price-help">Os carrosséis dos cartões editam-se em <a href="carrousel.php">carrousel.php</a>: imagens, velocidade, zoom, pan e escurecimento, por imagem ou de uma vez para todas.</p>',
      '</details>'
    ].join("");
  }

  function renderAdminProductPreviewPanel(product) {
    var preview = product && product.preview ? product.preview : {};

    if (!product || (productFamily(product) !== "cadernos" && !product.preview)) {
      return "";
    }

    return [
      '<details class="admin-step-panel admin-global-panel">',
      '<summary>Pré-visualização</summary>',
      '<p class="admin-price-help">Útil para mostrar o interior dos cadernos sem criar mais um passo no pedido.</p>',
      '<label class="admin-check"><input type="checkbox"' + (preview.enabled ? " checked" : "") + ' data-admin-preview-edit="enabled"> Mostrar pré-visualização</label>',
      '<label><span>Título</span><input type="text" value="' + escapeHtml(preview.title || "") + '" data-admin-preview-edit="title"></label>',
      '<label><span>Texto</span><textarea data-admin-preview-edit="text">' + escapeHtml(preview.text || "") + '</textarea></label>',
      '<label><span>Imagem</span><input type="file" accept="image/*" data-admin-preview-image></label>',
      preview.image ? '<button type="button" data-admin-preview-image-remove>Remover imagem</button>' : "",
      '</details>'
    ].join("");
  }

  function renderAdminQuadrosColorSettingsPanel(product, step) {
    if (!product || product.slug !== "quadros" || !step || step.id !== "colors") {
      return "";
    }

    return [
      '<details class="admin-step-panel admin-global-panel" open>',
      '<summary>Apresentação das cores</summary>',
      '<p class="admin-price-help">Estas opções alteram apenas o que a pessoa vê neste passo.</p>',
      '<label class="admin-check"><input type="checkbox"' + (step.showPhotoColorAnalysis === true ? " checked" : "") + ' data-admin-quadros-color-setting="showPhotoColorAnalysis" data-step-id="' + escapeHtml(step.id) + '"> Mostrar caixa “Cores encontradas”</label>',
      '<label class="admin-check"><input type="checkbox"' + (step.showColorNames === true ? " checked" : "") + ' data-admin-quadros-color-setting="showColorNames" data-step-id="' + escapeHtml(step.id) + '"> Mostrar nomes dentro dos swatches</label>',
      '</details>'
    ].join("");
  }


  function renderAdminGiftPanel(product) {
    var gift = product && product.giftRequest ? product.giftRequest : {};

    if (!product) {
      return "";
    }

    return [
      '<details class="admin-step-panel admin-global-panel">',
      '<summary>Texto da checkbox de congregação</summary>',
      '<p class="admin-price-help">Aparece no fim quando o pack tem 12 ou mais unidades.</p>',
      '<label><span>Texto da opção</span><input type="text" value="' + escapeHtml(gift.label || "Penso oferecer estes artigos a pessoas da minha congregação.") + '" data-admin-gift-edit="label"></label>',
      '<label><span>Explicação</span><textarea data-admin-gift-edit="text">' + escapeHtml(gift.text || "Escolhe esta opção se quiseres que a Mia te ajude a escolher designs únicos para a tua congregação.") + '</textarea></label>',
      '</details>'
    ].join("");
  }

  function renderAdminInteriorPanel(product) {
    var interior = product && product.interiorPreview ? product.interiorPreview : {};

    if (!isCadernosProduct(product)) {
      return "";
    }

    return [
      '<details class="admin-step-panel admin-global-panel">',
      '<summary>Slideshow do interior</summary>',
      '<p class="admin-price-help">Controla a pré-visualização do interior dos cadernos. A velocidade também é usada na gaveta da capa.</p>',
      '<label class="admin-check"><input type="checkbox"' + (interior.enabled !== false ? " checked" : "") + ' data-admin-interior-edit="enabled"> Mostrar slideshow</label>',
      '<label><span>Título</span><input type="text" value="' + escapeHtml(interior.title || "Pré-visualização do interior") + '" data-admin-interior-edit="title"></label>',
      '<label><span>Texto</span><textarea data-admin-interior-edit="text">' + escapeHtml(interior.text || "Vê um exemplo das páginas interiores deste caderno.") + '</textarea></label>',
      '<label><span>Velocidade (segundos)</span><input type="number" min="2" max="20" step="1" value="' + escapeHtml(interior.speedSeconds || 4) + '" data-admin-interior-edit="speedSeconds"></label>',
      '</details>'
    ].join("");
  }

  // ADMIN_OVERLAY_EDITOR_V1: os formulários deixam de participar no layout do
  // site. Cada bloco é movido para um diálogo fixo e o elemento real recebe
  // apenas um contorno sobreposto, sem mudar largura, altura ou grelha.
  function adminEditBlockKey(block, index) {
    var input;

    if (block.classList.contains("home-intro-tools")) {
      return "home:intro";
    }

    input = block.querySelector("[data-admin-home-category]");
    if (input) {
      return "home:category:" + input.dataset.adminHomeCategory;
    }

    input = block.querySelector("[data-admin-field-step][data-admin-field-index]");
    if (input) {
      return "field:" + input.dataset.adminFieldStep + ":" + input.dataset.adminFieldIndex;
    }

    input = block.querySelector("[data-step-id][data-item-id]");
    if (input) {
      return "item:" + input.dataset.stepId + ":" + input.dataset.itemId + ":"
        + (input.dataset.miaEditKey || "main") + ":" + (block.className || "");
    }

    return "block:" + index;
  }

  function adminEditBlockTitle(block, host) {
    var title;

    if (block.classList.contains("home-intro-tools")) {
      return "Editar apresentação da homepage";
    }
    if (block.classList.contains("field-admin-tools")) {
      return "Editar campo";
    }
    if (block.classList.contains("palette-admin-tools")) {
      return "Editar combinação de cores";
    }
    if (block.classList.contains("admin-card-tools-image-slot")) {
      return "Editar imagem";
    }

    title = host && host.querySelector("strong");
    return title && String(title.textContent || "").trim()
      ? "Editar “" + String(title.textContent).trim() + "”"
      : "Editar conteúdo";
  }

  function adminEditBlockHost(block) {
    if (block.classList.contains("home-intro-tools")) {
      return document.querySelector(".home-brand-hero__copy")
        || document.querySelector(".home-section-heading");
    }

    return block.closest([
      ".choice-card",
      ".category-card",
      ".cadernos-build-part",
      ".palette-family-choice",
      ".individual-color-choice",
      ".builder-design-card",
      ".details-grid > label",
      ".field-control",
      ".step-card"
    ].join(", ")) || block.parentElement;
  }

  function adminCreateEditDialog(layer, block, host, key, title, compact) {
    var id = "admin-edit-dialog-" + layer.querySelectorAll(".admin-edit-dialog").length;
    var dialog = document.createElement("section");
    var headingId = id + "-title";
    var target;

    dialog.className = "admin-edit-dialog";
    dialog.id = id;
    dialog.hidden = true;
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", headingId);
    dialog.dataset.adminEditKey = key;
    dialog.innerHTML = [
      '<header class="admin-edit-dialog__head">',
      '<h2 id="' + headingId + '">' + escapeHtml(title) + '</h2>',
      '<button type="button" class="admin-edit-dialog__close" data-admin-edit-close aria-label="Fechar editor">×</button>',
      '</header>',
      '<div class="admin-edit-dialog__body"></div>'
    ].join("");
    dialog.querySelector(".admin-edit-dialog__body").appendChild(block);
    layer.appendChild(dialog);

    if (host) {
      target = document.createElement("span");
      target.className = "admin-edit-target" + (compact ? " admin-edit-target--compact" : "");
      target.dataset.adminEditOpen = id;
      target.setAttribute("role", "button");
      target.tabIndex = 0;
      target.setAttribute("aria-label", title);
      target.innerHTML = '<span aria-hidden="true">' + (compact ? "+" : "Editar") + '</span>';
      host.classList.add("is-admin-editable");
      host.appendChild(target);
    }

    return dialog;
  }

  function adminSetActiveImageFromHost(host) {
    var visual;

    if (!state.product || !host) {
      return;
    }

    visual = host.querySelector("[data-admin-image-visual], [data-admin-side-image-visual]");
    if (!visual) {
      return;
    }

    state.adminActiveImage = {
      stepId: visual.dataset.adminImageStep,
      itemId: visual.dataset.adminImageItem,
      side: visual.hasAttribute("data-admin-side-image-visual"),
      editKey: visual.dataset.miaEditKey || "",
      fallbackEditKey: visual.dataset.miaFallbackEditKey || "",
      imageStoreItemId: visual.dataset.adminImageStoreItem || visual.dataset.adminImageItem
    };
    state.adminImageKeyboardUndoFor = "";
  }

  function adminOpenEditDialog(layer, dialog, target, restoreFocus) {
    var host = target && target.closest(".is-admin-editable");
    var firstField;

    layer.querySelectorAll(".admin-edit-dialog").forEach(function (candidate) {
      candidate.hidden = candidate !== dialog;
    });
    adminSetActiveImageFromHost(host);
    layer.classList.add("is-open");
    document.body.classList.add("is-admin-edit-dialog-open");
    dialog.hidden = false;
    dialog._adminRestoreFocus = restoreFocus || target || null;
    state.adminEditDialogKey = dialog.dataset.adminEditKey || "";

    firstField = dialog.querySelector(".admin-edit-dialog__body input:not([type=file]), .admin-edit-dialog__body textarea, .admin-edit-dialog__body select, .admin-edit-dialog__body button");
    if (firstField) {
      window.requestAnimationFrame(function () { firstField.focus(); });
    }
  }

  function adminCloseEditDialogs(layer) {
    var dialog = layer.querySelector(".admin-edit-dialog:not([hidden])");
    var restoreFocus = dialog && dialog._adminRestoreFocus;

    layer.classList.remove("is-open");
    document.body.classList.remove("is-admin-edit-dialog-open");
    layer.querySelectorAll(".admin-edit-dialog").forEach(function (candidate) {
      candidate.hidden = true;
    });
    state.adminEditDialogKey = "";
    if (restoreFocus && document.contains(restoreFocus)) {
      restoreFocus.focus();
    }
  }

  function prepareAdminEditingLayer(currentProduct) {
    var toolbar;
    var layer;
    var stepPanel;
    var previous;
    var previousTarget;

    if (!state.admin) {
      return;
    }

    toolbar = document.querySelector(".admin-toolbar");
    if (!toolbar) {
      return;
    }

    layer = document.createElement("div");
    layer.className = "admin-edit-layer";
    layer.innerHTML = '<button type="button" class="admin-edit-backdrop" data-admin-edit-close aria-label="Fechar editor"></button>';
    app.appendChild(layer);

    Array.prototype.slice.call(document.querySelectorAll(".admin-card-tools")).forEach(function (block, index) {
      var host = adminEditBlockHost(block);
      var key = adminEditBlockKey(block, index);
      var wrapper = block.closest(".home-admin-edit-band");

      adminCreateEditDialog(layer, block, host, key, adminEditBlockTitle(block, host), false);
      if (wrapper && !wrapper.querySelector(".admin-card-tools")) {
        wrapper.remove();
      }
    });

    Array.prototype.slice.call(document.querySelectorAll(".admin-add")).forEach(function (button, index) {
      var host = button.closest(".step-card") || button.parentElement;
      adminCreateEditDialog(layer, button, host, "add:" + index, "Adicionar opção", true);
    });

    stepPanel = toolbar.querySelector(".admin-step-copy-panel");
    if (stepPanel) {
      adminCreateEditDialog(
        layer,
        stepPanel,
        document.querySelector(".step-card > h2"),
        "step:" + (currentProduct && currentProduct.steps[state.currentStep] ? currentProduct.steps[state.currentStep].id : state.currentStep),
        "Editar título e texto do passo",
        false
      );
    }

    layer.addEventListener("click", function (event) {
      var closer = event.target.closest("[data-admin-edit-close]");
      if (closer) {
        event.preventDefault();
        adminCloseEditDialogs(layer);
      }
    });

    layer.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && layer.classList.contains("is-open")) {
        event.preventDefault();
        adminCloseEditDialogs(layer);
      }
    });

    document.querySelectorAll("[data-admin-edit-open]").forEach(function (opener) {
      opener.addEventListener("click", function (event) {
        var dialog = document.getElementById(opener.dataset.adminEditOpen);
        event.preventDefault();
        event.stopPropagation();
        if (dialog) {
          adminOpenEditDialog(layer, dialog, opener, opener);
        }
      });
      opener.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          opener.click();
        }
      });
    });

    if (state.adminEditDialogKey) {
      previous = Array.prototype.slice.call(layer.querySelectorAll(".admin-edit-dialog")).filter(function (dialog) {
        return dialog.dataset.adminEditKey === state.adminEditDialogKey;
      })[0];
      previousTarget = previous ? document.querySelector('[data-admin-edit-open="' + previous.id + '"]') : null;
      if (previous) {
        adminOpenEditDialog(layer, previous, previousTarget, previousTarget);
      }
    }
  }

  function renderAdminSurface(currentProduct) {
    var currentHome = !currentProduct && page === "home" ? state.home : null;
    var content = currentProduct || currentHome;
    var step = currentProduct ? currentProduct.steps[state.currentStep] : null;
    var message = state.adminMessage
      ? '<p class="admin-message" role="status">' + escapeHtml(state.adminMessage) + '</p>'
      : "";

    if (!state.admin && !state.loginOpen) {
      return "";
    }

    if (!state.admin) {
      return [
        '<aside class="admin-login" aria-label="Admin">',
        '<form data-admin-login-form>',
        '<label><span>Password</span><input type="password" name="password" autocomplete="current-password" required></label>',
        message,
        '<div class="admin-actions">',
        '<button type="submit">Entrar</button>',
        '<button type="button" data-admin-close>Fechar</button>',
        '</div>',
        '</form>',
        '</aside>'
      ].join("");
    }

    var options = "";
    Object.keys(templateLabels).forEach(function (id) {
      options += '<option value="' + escapeHtml(id) + '"' + (step && step.template === id ? " selected" : "") + ">" + escapeHtml(templateLabels[id]) + "</option>";
    });

    return [
      '<aside class="admin-toolbar' + (state.adminPanelHidden ? ' is-collapsed' : '') + '" aria-label="Painel de administração">',
      '<div class="admin-toolbar-head">',
      '<strong>Admin</strong>',
      '<button type="button" class="admin-panel-toggle" data-admin-panel-toggle aria-expanded="' + (state.adminPanelHidden ? 'false' : 'true') + '">' + (state.adminPanelHidden ? 'Mostrar painel' : 'Esconder painel') + '</button>',
      content ? '<button type="button" data-admin-undo' + (state.undoStack.length ? "" : " disabled") + '>UNDO</button>' : "",
      content ? '<button type="button" data-admin-save>SAVE</button>' : "",
      content ? '<button type="button" data-admin-reset>JSON</button>' : "",
      // FUNNEL_DASHBOARD_V1: link rápido para a dashboard do funil. Abre em
      // nova tab para não perder o estado da edição.
      '<a class="admin-funnel-link" href="admin-funnel.php" target="_blank" rel="noopener">Funil</a>',
      '<a class="admin-funnel-link" href="tracking.php" target="_blank" rel="noopener">Tracking</a>',
      // ADMIN_ORDERS_V1: link para o painel de encomendas.
      '<a class="admin-funnel-link" href="admin-orders.php" target="_blank" rel="noopener">Encomendas</a>',
      '<a class="admin-funnel-link" href="admin-colors.html" target="_blank" rel="noopener">Cores</a>',
      '<a class="admin-funnel-link" href="admin-uploads.php" target="_blank" rel="noopener">Uploads assistidos</a>',
      '<a class="admin-funnel-link" href="galeria.html" target="_blank" rel="noopener">Galeria</a>',
      '<a class="admin-funnel-link" href="multimedia.html" target="_blank" rel="noopener">Multimédia</a>',
      '<a class="admin-funnel-link" href="reviews.html" target="_blank" rel="noopener">Reviews</a>',
      '<a class="admin-funnel-link" href="produtos.html" target="_blank" rel="noopener">Produtos</a>',
      // PRECOS_UI_V1: editor central de precos. Todos os valores monetarios do
      // site num sitio so — packs, descontos, extras, portes e custos.
      '<a class="admin-funnel-link" href="precos.php" target="_blank" rel="noopener">Preços</a>',
      // MATERIAIS_UI_V1: o custo real de uma unidade, que alimenta o lucro
      // que o precos.php mostra.
      '<a class="admin-funnel-link" href="materiais.php" target="_blank" rel="noopener">Materiais</a>',
      '<a class="admin-funnel-link" href="homepage-menu-design.php" target="_blank" rel="noopener">Homepage & Menu</a>',
      // CARROUSEL_UI_V1: os carrosseis dos cartoes saem daqui e passam a ter
      // pagina propria, com os parametros de cada imagem.
      '<a class="admin-funnel-link" href="carrousel.php" target="_blank" rel="noopener">Carrosséis</a>',
      // TOOLS_INDEX_V1: link para as ferramentas internas (só admin; a página
      // valida a sessão no servidor, como admin-funnel.php).
      '<a class="admin-funnel-link" href="tools/index.php" target="_blank" rel="noopener">Ferramentas</a>',
      '<a class="admin-funnel-link" href="cadernos-anuais.html">Cadernos</a>',
      '<button type="button" data-admin-exit>Sair</button>',
      '</div>',
      message,
      renderBasicAdminTrackingPanel(),
      step ? '<details class="admin-step-panel admin-step-copy-panel" open><summary>Editar passo</summary><label><span>Template</span><select data-admin-template>' + options + '</select></label>' : "",
      step ? '<label><span>Título</span><input type="text" value="' + escapeHtml(step.title || "") + '" data-admin-step-edit="title"></label>' : "",
      step ? '<label><span>Texto</span><textarea data-admin-step-edit="text">' + escapeHtml(step.text || "") + '</textarea></label>' : "",
      step && state.currentStep === 0 ? '<label><span>Aviso de antecedência</span><textarea data-admin-step-edit="leadTimeNotice">' + escapeHtml(stepLeadTimeNotice(currentProduct, step)) + '</textarea><small>Este aviso aparece logo abaixo do progresso. Deixa o campo vazio para o esconder neste produto.</small></label>' : "",
      step ? '<label class="admin-check"><input type="checkbox"' + (step.hidden ? "" : " checked") + (step.id === "confirm" ? " disabled" : "") + ' data-admin-step-visible> Passo visível para clientes</label>' : "",
      step ? '<button type="button" data-admin-add-step>Adicionar passo novo</button></details>' : "",
      step ? renderAdminStepImagePanel(step) : "",
      step ? renderAdminQuadrosColorSettingsPanel(currentProduct, step) : "",
      step && getStepSectionConfig(currentProduct, step) ? renderAdminSectionsPanel(currentProduct, step) : "",
      currentProduct ? renderAdminImageKeyboardPanel(currentProduct) : "",
      currentProduct ? renderAdminRectOrientationPanel(currentProduct) : "",
      currentHome ? renderAdminHomeSettingsPanel(currentHome) : "",
      currentProduct ? renderAdminSiteSettingsPanel() : "",
      currentProduct ? renderAdminQuantityPricingSwitchSetting() : "",
      currentProduct ? renderAdminPricePanel(currentProduct) : "",
      currentProduct ? renderAdminDeliveryPanel(currentProduct) : "",
      currentProduct ? renderAdminProductPreviewPanel(currentProduct) : "",
      currentProduct ? renderAdminGiftPanel(currentProduct) : "",
      currentProduct ? renderAdminInteriorPanel(currentProduct) : "",
      '</aside>'
    ].join("");
  }

  function bindAdminSurface(currentProduct) {
    var currentHome = !currentProduct && page === "home" ? state.home : null;
    var content = currentProduct || currentHome;
    var open = document.querySelector("[data-admin-open]");
    var close = document.querySelector("[data-admin-close]");
    var toolbar = document.querySelector(".admin-toolbar");
    var panelToggle = document.querySelector("[data-admin-panel-toggle]");
    var loginForm = document.querySelector("[data-admin-login-form]");
    var exit = document.querySelector("[data-admin-exit]");
    var template = document.querySelector("[data-admin-template]");
    var undo = document.querySelector("[data-admin-undo]");
    var save = document.querySelector("[data-admin-save]");
    var reset = document.querySelector("[data-admin-reset]");
    var toggleOwnIpIgnore = document.querySelector("[data-admin-toggle-own-ip-ignore]");

    if (state.admin) {
      refreshBasicAdminInfo(false);
    }

    if (toolbar && panelToggle) {
      panelToggle.addEventListener("click", function () {
        state.adminPanelHidden = !state.adminPanelHidden;
        safeStorageSetItem(ADMIN_PANEL_HIDDEN_KEY, state.adminPanelHidden ? "1" : "0");
        toolbar.classList.toggle("is-collapsed", state.adminPanelHidden);
        panelToggle.setAttribute("aria-expanded", state.adminPanelHidden ? "false" : "true");
        panelToggle.textContent = state.adminPanelHidden ? "Mostrar painel" : "Esconder painel";
      });
    }

    if (open) {
      open.addEventListener("click", function () {
        openAdminSurface();
      });
    }

    if (close) {
      close.addEventListener("click", function () {
        state.loginOpen = false;
        rerender();
      });
    }

    if (loginForm) {
      loginForm.addEventListener("submit", function (event) {
        var password;

        event.preventDefault();

        password = String(new FormData(loginForm).get("password") || "");
        state.adminMessage = "";

        adminRequest("login", { password: password }).then(function () {
          state.admin = true;
          state.loginOpen = false;
          state.adminIpLoaded = false;
          state.adminIpLoading = false;
          window.localStorage.setItem(ADMIN_KEY, "1");
          rerender();
        }).catch(function (error) {
          state.adminMessage = error.message;
          rerender();
        });
      });
    }

    if (exit) {
      exit.addEventListener("click", function () {
        state.admin = false;
        state.loginOpen = false;
        state.adminMessage = "";
        state.adminIp = "";
        state.adminIpIgnored = false;
        state.adminIpLoaded = false;
        window.localStorage.removeItem(ADMIN_KEY);
        adminRequest("logout", {}).catch(function () {});
        rerender();
      });
    }

    if (toggleOwnIpIgnore) {
      toggleOwnIpIgnore.addEventListener("click", function () {
        toggleOwnIpIgnore.disabled = true;
        state.adminMessage = "";
        adminRequest("toggle-ignore-current-ip", {}).then(function (data) {
          updateAdminIpState(data);
          state.adminMessage = data.message || (state.adminIpIgnored ? "IP ignorado no tracking." : "IP removido da ignore list.");
          rerender();
        }).catch(function (error) {
          state.adminMessage = error.message;
          rerender();
        });
      });
    }

    if (template && currentProduct) {
      template.addEventListener("change", function () {
        pushUndo(currentProduct);
        currentProduct.steps[state.currentStep].template = template.value;
        rerenderProduct(currentProduct);
      });
    }

    document.querySelectorAll("[data-admin-step-edit]").forEach(function (input) {
      input.addEventListener("change", function () {
        var key = input.dataset.adminStepEdit;

        if (currentProduct && currentProduct.steps[state.currentStep]) {
          pushUndo(currentProduct);
          currentProduct.steps[state.currentStep][key] = input.value;
          rerenderProduct(currentProduct);
        }
      });
    });


    document.querySelectorAll("[data-admin-step-visible]").forEach(function (input) {
      input.addEventListener("change", function () {
        var step = currentProduct && visibleSteps(currentProduct)[state.currentStep];

        if (!step || step.id === "confirm") {
          return;
        }

        pushUndo(currentProduct);
        step.hidden = !input.checked;
        rerenderProduct(currentProduct);
      });
    });

    document.querySelectorAll("[data-admin-quadros-color-setting]").forEach(function (input) {
      input.addEventListener("change", function () {
        var step = currentProduct ? findStep(currentProduct, input.dataset.stepId) : null;
        var key = input.dataset.adminQuadrosColorSetting;

        if (!step || currentProduct.slug !== "quadros" || ["showPhotoColorAnalysis", "showColorNames"].indexOf(key) === -1) {
          return;
        }

        pushUndo(currentProduct);
        step[key] = !!input.checked;
        rerenderProduct(currentProduct);
      });
    });

    // CRACHAS_SIZE_CARD_LAYOUT_TOGGLE_V1: caixinha admin para o passo "size"
    // dos crachás. Marcada = sempre 3 colunas (default). Desmarcada = foto
    // passa para a linha de baixo em ecrãs estreitos.
    document.querySelectorAll("[data-admin-step-side-fixed]").forEach(function (input) {
      input.addEventListener("change", function () {
        var step = currentProduct && visibleSteps(currentProduct)[state.currentStep];

        if (!step || step.id !== "size" || productFamily(currentProduct) !== "crachas") {
          return;
        }

        pushUndo(currentProduct);
        step.sideImageWraps = !input.checked;
        rerenderProduct(currentProduct);
      });
    });

    // SMART_QUANTITIES_V1: caixinha admin global. Afecta todas as paginas com
    // gestor de quantidades. Persiste em pricing.json via SAVE.
    document.querySelectorAll("[data-admin-smart-quantities]").forEach(function (input) {
      input.addEventListener("change", function () {
        if (currentProduct) {
          pushUndo(currentProduct);
        }
        siteSettings().smartQuantities = !!input.checked;
        if (currentProduct) {
          rerenderProduct(currentProduct);
        } else {
          rerender();
        }
      });
    });

    document.querySelectorAll("[data-admin-quantity-pricing-switch-visible]").forEach(function (input) {
      input.addEventListener("change", function () {
        if (currentProduct) {
          pushUndo(currentProduct);
        }
        siteSettings().quantityPricingSwitchVisible = !!input.checked;
        if (!input.checked) {
          state.selections.quantity_pricing_mode = "quantity_tiers";
        }
        if (currentProduct) {
          rerenderProduct(currentProduct);
        } else {
          rerender();
        }
      });
    });

    document.querySelectorAll("[data-admin-add-step]").forEach(function (button) {
      button.addEventListener("click", function () {
        var insertAt;
        var id;
        var count;

        if (!currentProduct || !Array.isArray(currentProduct.steps)) {
          return;
        }

        pushUndo(currentProduct);
        count = currentProduct.steps.length + 1;
        id = "extra-" + Date.now();
        insertAt = Math.max(0, currentProduct.steps.length - 1);
        currentProduct.steps.splice(insertAt, 0, {
          id: id,
          label: "Novo",
          title: "Novo passo",
          text: "Edita este texto no modo admin.",
          template: "text-grid",
          selection: "single",
          field: id,
          items: [
            {
              id: id + "-opcao-1",
              value: "Opção 1",
              title: "Opção 1",
              subtitle: "Editar texto",
              visual: "neutral"
            }
          ]
        });
        state.currentStep = insertAt;
        state.maxVisitedStep = Math.max(state.maxVisitedStep, state.currentStep);
        rerenderProduct(currentProduct);
      });
    });

    document.querySelectorAll("[data-admin-price-pack-edit]").forEach(function (input) {
      input.addEventListener("change", function () {
        var size = input.dataset.adminPriceSize;
        var oldPack = input.dataset.adminPricePack;
        var newPack = Math.max(1, parseInt(input.value, 10) || 1);

        if (currentProduct && currentProduct.prices && currentProduct.prices[size] && currentProduct.prices[size][oldPack] != null && String(newPack) !== String(oldPack)) {
          pushUndo(currentProduct);
          renamePricePack(currentProduct, size, oldPack, newPack);
          syncPricingFromProduct(currentProduct);
          syncPackItemsFromPricing(currentProduct);
          rerenderProduct(currentProduct);
        }
      });
    });

    document.querySelectorAll("[data-admin-price-size]").forEach(function (input) {
      input.addEventListener("change", function () {
        var size = input.dataset.adminPriceSize;
        var pack = input.dataset.adminPricePack;
        var quantity = Math.max(1, parseInt(pack, 10) || 1);
        var cents;

        if (currentProduct && currentProduct.prices && currentProduct.prices[size]) {
          pushUndo(currentProduct);
          if (input.dataset.adminPriceKind === "unit") {
            cents = parseEuroCents(input.value) * quantity;
          } else {
            cents = parseEuroCents(input.value);
          }
          currentProduct.prices[size][pack] = Math.max(0, Math.round(cents));
          syncPricingFromProduct(currentProduct);
          syncPackItemsFromPricing(currentProduct);
          rerenderProduct(currentProduct);
        }
      });
    });

    document.querySelectorAll("[data-admin-delivery-edit]").forEach(function (input) {
      input.addEventListener("change", function () {
        var index = parseInt(input.dataset.adminDeliveryIndex, 10);
        var key = input.dataset.adminDeliveryEdit;
        var option = currentProduct && currentProduct.deliveryOptions ? currentProduct.deliveryOptions[index] : null;

        if (option) {
          pushUndo(currentProduct);
          option[key] = key === "feeCents" ? Math.max(0, parseInt(input.value, 10) || 0) : input.value;
          rerenderProduct(currentProduct);
        }
      });
    });

    document.querySelectorAll("[data-admin-home-edit]").forEach(function (input) {
      input.addEventListener("change", function () {
        var key = input.dataset.adminHomeEdit;

        if (!currentHome) {
          return;
        }

        pushUndo(currentHome);

        if (key.indexOf("intro.") === 0) {
          currentHome.intro[key.split(".")[1]] = input.value;
        } else if (input.type === "checkbox") {
          currentHome[key] = input.checked;
        } else {
          currentHome[key] = input.value;
        }

        renderHome(currentHome);
      });
    });

    document.querySelectorAll("[data-admin-home-category]").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("change", function () {
        var index = parseInt(input.dataset.adminHomeCategory, 10);
        var key = input.dataset.adminHomeCategoryEdit;
        var category = currentHome && currentHome.categories ? currentHome.categories[index] : null;
        var allowEmpty = input.dataset.adminHomeCategoryAllowEmpty === "1";
        var raw;

        if (!category) {
          return;
        }

        pushUndo(currentHome);
        if (input.type === "checkbox") {
          category[key] = input.checked;
        } else if (input.type === "number") {
          if (allowEmpty && input.value.trim() === "") {
            delete category[key];
          } else {
            raw = Number(input.value);
            category[key] = isFinite(raw) ? raw : 0;
          }
        } else {
          category[key] = input.value;
        }
        renderHome(currentHome);
      });
    });

    document.querySelectorAll("[data-admin-home-image]").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        var index = parseInt(input.dataset.adminHomeImage, 10);
        var category = currentHome && currentHome.categories ? currentHome.categories[index] : null;
        var reader;

        if (!file || !category || !/^image\//.test(file.type)) {
          return;
        }

        reader = new FileReader();
        reader.onload = function () {
          pushUndo(currentHome);
          category.image = String(reader.result || "");
          renderHome(currentHome);
        };
        reader.readAsDataURL(file);
      });
    });

    document.querySelectorAll("[data-admin-home-image-remove]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        var index = parseInt(button.dataset.adminHomeImageRemove, 10);
        var category = currentHome && currentHome.categories ? currentHome.categories[index] : null;

        event.preventDefault();
        event.stopPropagation();

        if (!category) {
          return;
        }

        pushUndo(currentHome);
        delete category.image;
        renderHome(currentHome);
      });
    });

    document.querySelectorAll("[data-admin-home-theme]").forEach(function (input) {
      input.addEventListener("change", function () {
        var key = input.dataset.adminHomeTheme;

        if (!currentHome) {
          return;
        }

        ensureHomeSettings(currentHome);
        pushUndo(currentHome);
        currentHome.theme[key] = input.value;
        applySiteSettings(currentHome);
        renderHome(currentHome);
      });
    });

    document.querySelectorAll("[data-admin-home-toggle]").forEach(function (input) {
      input.addEventListener("change", function () {
        var key = input.dataset.adminHomeToggle;

        if (!currentHome) {
          return;
        }

        ensureHomeSettings(currentHome);
        pushUndo(currentHome);
        currentHome[key] = !!input.checked;
        renderHome(currentHome);
      });
    });

    document.querySelectorAll("[data-admin-home-butterfly]").forEach(function (input) {
      input.addEventListener("change", function () {
        var key = input.dataset.adminHomeButterfly;

        if (!currentHome) {
          return;
        }

        ensureHomeSettings(currentHome);
        pushUndo(currentHome);
        currentHome.butterfly[key] = input.type === "checkbox" ? input.checked : (input.type === "number" ? Number(input.value) : input.value);
        ensureHomeSettings(currentHome);
        applySiteSettings(currentHome);
        renderHome(currentHome);
      });
    });

    document.querySelectorAll("[data-admin-home-background]").forEach(function (input) {
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        var reader;

        if (!currentHome || !file || !/^image\//.test(file.type)) {
          return;
        }

        reader = new FileReader();
        reader.onload = function () {
          ensureHomeSettings(currentHome);
          pushUndo(currentHome);
          currentHome.theme.backgroundImage = String(reader.result || "");
          applySiteSettings(currentHome);
          renderHome(currentHome);
        };
        reader.readAsDataURL(file);
      });
    });

    document.querySelectorAll("[data-admin-home-background-remove]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();

        if (!currentHome) {
          return;
        }

        ensureHomeSettings(currentHome);
        pushUndo(currentHome);
        delete currentHome.theme.backgroundImage;
        applySiteSettings(currentHome);
        renderHome(currentHome);
      });
    });

    document.querySelectorAll("[data-admin-preview-edit]").forEach(function (input) {
      input.addEventListener("change", function () {
        var key = input.dataset.adminPreviewEdit;

        if (!currentProduct) {
          return;
        }

        if (!currentProduct.preview || typeof currentProduct.preview !== "object") {
          currentProduct.preview = {};
        }

        pushUndo(currentProduct);
        currentProduct.preview[key] = input.type === "checkbox" ? input.checked : input.value;
        rerenderProduct(currentProduct);
      });
    });

    document.querySelectorAll("[data-admin-preview-image]").forEach(function (input) {
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        var reader;

        if (!currentProduct || !file || !/^image\//.test(file.type)) {
          return;
        }

        reader = new FileReader();
        reader.onload = function () {
          if (!currentProduct.preview || typeof currentProduct.preview !== "object") {
            currentProduct.preview = {};
          }
          pushUndo(currentProduct);
          currentProduct.preview.image = String(reader.result || "");
          currentProduct.preview.enabled = true;
          rerenderProduct(currentProduct);
        };
        reader.readAsDataURL(file);
      });
    });

    document.querySelectorAll("[data-admin-preview-image-remove]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();

        if (!currentProduct || !currentProduct.preview) {
          return;
        }

        pushUndo(currentProduct);
        delete currentProduct.preview.image;
        rerenderProduct(currentProduct);
      });
    });

    document.querySelectorAll("[data-admin-gift-edit]").forEach(function (input) {
      input.addEventListener("change", function () {
        var key = input.dataset.adminGiftEdit;

        if (!currentProduct) {
          return;
        }

        if (!currentProduct.giftRequest || typeof currentProduct.giftRequest !== "object") {
          currentProduct.giftRequest = {};
        }

        pushUndo(currentProduct);
        currentProduct.giftRequest[key] = input.value;
        rerenderProduct(currentProduct);
      });
    });

    document.querySelectorAll("[data-admin-interior-edit]").forEach(function (input) {
      input.addEventListener("change", function () {
        var key = input.dataset.adminInteriorEdit;

        if (!currentProduct) {
          return;
        }

        if (!currentProduct.interiorPreview || typeof currentProduct.interiorPreview !== "object") {
          currentProduct.interiorPreview = {};
        }

        pushUndo(currentProduct);
        currentProduct.interiorPreview[key] = input.type === "checkbox" ? input.checked : (key === "speedSeconds" ? Math.max(2, Math.min(20, Number(input.value) || 4)) : input.value);
        rerenderProduct(currentProduct);
      });
    });

    if (undo && content) {
      undo.addEventListener("click", function () {
        var previous = state.undoStack.pop();

        if (previous) {
          if (currentProduct) {
            rerenderProduct(previous);
          } else {
            renderHome(previous);
          }
        }
      });
    }

    if (save && content) {
      save.addEventListener("click", function () {
        saveDraft(content, save);
      });
    }

    if (reset && currentProduct) {
      reset.addEventListener("click", function () {
        window.location.reload();
      });
    }
  }

  function shuffleCopy(list) {
    var copy = list.slice();
    var i = copy.length;
    var j;
    var tmp;
    while (i > 1) {
      j = Math.floor(Math.random() * i);
      i -= 1;
      tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  // CAROUSEL_SLIDES_V1: os parâmetros deixaram de viver no cartão e passaram a
  // ser de cada slide, por isso saem em variáveis CSS em cada moldura em vez de
  // uma vez só no cartão. O que estiver a null herda do global — a cascata é
  // decidida toda em `resolvedCarouselSlides()`.
  function renderHomeCarousel(category, carousel) {
    var slides = resolvedCarouselSlides(category, carousel);
    var randomize = category.carouselRandomizeOnLoad !== false
      && (!carousel || carousel.randomizeOnLoad !== false);
    // Runtime-only shuffle: a ordem gravada no home.json nao e tocada. Cada
    // page-load embaralha localmente.
    var ordenados = randomize && slides.length > 1 ? shuffleCopy(slides) : slides;

    if (!ordenados.length) {
      return "";
    }

    return [
      '<span class="category-carousel" data-home-carousel aria-hidden="true">',
      ordenados.map(function (slide, index) {
        var direction = index % 4;
        var panX = direction === 0 || direction === 3 ? slide.panPercent : -slide.panPercent;
        var panY = direction < 2 ? -slide.panPercent : slide.panPercent;
        return '<span class="category-carousel-frame' + (index === 0 ? ' is-active' : '')
          + '" data-mia-image="' + escapeHtml(slide.image)
          + '" data-mia-item-id="' + escapeHtml(category.id || "")
          + '" data-mia-slot-name="home-carousel" data-mia-slide-index="' + index
          + '" data-carousel-interval="' + escapeHtml(slide.intervalMs)
          + (index === 0
            ? '" style="background-image:url(&quot;' + escapeHtml(slide.image) + '&quot;)'
            : '" data-lazy-carousel-image="' + escapeHtml(slide.image) + '" style="')
          + ';--carousel-pan-x:' + panX + '%;--carousel-pan-y:' + panY + '%'
          + ';--carousel-speed:' + escapeHtml(slide.speedSeconds) + 's'
          + ';--carousel-zoom-scale:' + escapeHtml((slide.zoomPercent / 100).toFixed(3))
          + ';--carousel-overlay:' + escapeHtml((slide.overlayOpacity / 100).toFixed(2)) + '"></span>';
      }).join(""),
      '</span>'
    ].join("");
  }

  function bindUnavailableCategoryCards() {
    document.querySelectorAll("[data-home-unavailable-message]").forEach(function (card) {
      var showMessage = function () {
        var message = card.getAttribute("data-home-unavailable-message") || "Já falta pouco!";
        state.homeUnavailableMessage = message;
        if (state.home) {
          renderHome(state.home);
        }
      };

      card.addEventListener("click", function (event) {
        event.preventDefault();
        showMessage();
      });

      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          showMessage();
        }
      });
    });
  }

  function renderHomeDeadlineNote(home) {
    var label = home.deadlineNoticeLabel || "Data limite para encomendar lembranças";
    var dateText = home.deadlineNoticeDateText || "19 de junho de 2026";
    var suffix = home.deadlineNoticeSuffix || "Excepto situações pontuais.";
    var target = home.deadlineDate || "2026-06-19T23:59:59+01:00";

    if (home.deadlineNoticeEnabled === false) {
      return "";
    }

    return [
      '<section class="home-deadline-note" aria-label="Data limite para encomendas">',
      '<div class="home-deadline-note__inner" data-home-deadline-countdown data-deadline-target="' + escapeHtml(target) + '">',
      '<span class="home-deadline-note__label">' + escapeHtml(label) + '</span>',
      '<p class="home-deadline-note__text"><strong>' + escapeHtml(dateText) + '</strong>' + (suffix ? '<em>' + escapeHtml(suffix) + '</em>' : '') + '</p>',
      '<div class="home-deadline-note__timer" aria-label="Contagem decrescente até à data limite">',
      '<div class="home-deadline-note__unit" data-deadline-unit="days"><div class="home-deadline-note__ring"><span class="home-deadline-note__value" data-deadline-value>00</span></div><span class="home-deadline-note__name">dias</span></div>',
      '<div class="home-deadline-note__unit" data-deadline-unit="hours"><div class="home-deadline-note__ring"><span class="home-deadline-note__value" data-deadline-value>00</span></div><span class="home-deadline-note__name">horas</span></div>',
      '<div class="home-deadline-note__unit" data-deadline-unit="minutes"><div class="home-deadline-note__ring"><span class="home-deadline-note__value" data-deadline-value>00</span></div><span class="home-deadline-note__name">minutos</span></div>',
      '<div class="home-deadline-note__unit" data-deadline-unit="seconds"><div class="home-deadline-note__ring"><span class="home-deadline-note__value" data-deadline-value>00</span></div><span class="home-deadline-note__name">segundos</span></div>',
      '</div>',
      '</div>',
      '</section>'
    ].join("");
  }

  function renderHomeIntroAdminTools(home, adminEditing) {
    if (!adminEditing) {
      return "";
    }

    return [
      '<div class="admin-card-tools home-intro-tools">',
      '<label>Marca<input type="text" value="' + escapeHtml(home.brand || "") + '" data-admin-home-edit="brand"></label>',
      '<label>Instagram<input type="text" value="' + escapeHtml(home.instagramUrl || "") + '" data-admin-home-edit="instagramUrl"></label>',
      '<label>Etiqueta<input type="text" value="' + escapeHtml(home.intro.eyebrow || "") + '" data-admin-home-edit="intro.eyebrow"></label>',
      '<label>Título<input type="text" value="' + escapeHtml(home.intro.title || "") + '" data-admin-home-edit="intro.title"></label>',
      '<label>Texto<textarea data-admin-home-edit="intro.text">' + escapeHtml(home.intro.text || "") + '</textarea></label>',
      '<label class="admin-check"><input type="checkbox"' + (home.deadlineNoticeEnabled !== false ? " checked" : "") + ' data-admin-home-edit="deadlineNoticeEnabled"> Mostrar aviso de data limite</label>',
      '<label>Aviso etiqueta<input type="text" value="' + escapeHtml(home.deadlineNoticeLabel || "") + '" data-admin-home-edit="deadlineNoticeLabel"></label>',
      '<label>Aviso data<input type="text" value="' + escapeHtml(home.deadlineNoticeDateText || "") + '" data-admin-home-edit="deadlineNoticeDateText"></label>',
      '<label>Aviso texto<input type="text" value="' + escapeHtml(home.deadlineNoticeSuffix || "") + '" data-admin-home-edit="deadlineNoticeSuffix"></label>',
      '<label>Countdown ISO<input type="text" value="' + escapeHtml(home.deadlineDate || "") + '" data-admin-home-edit="deadlineDate"></label>',
      '</div>'
    ].join("");
  }

  function renderHomeFeatureCard(category, adminEditing) {
    var isClickable = category.clickable !== false && String(category.href || "").trim();
    var tag = isClickable ? "a" : "article";
    var href = isClickable ? ' href="' + escapeHtml(category.href) + '"' : "";
    var image = category.featureImage || category.image || "";
    var title = category.featureTitle || category.title || "";
    var text = category.featureText || category.subtitle || "";
    var cta = category.featureCta || "Ver produto";

    return [
      '<' + tag + ' class="home-news-card"' + href + '>',
      image ? '<span class="home-news-card__media"><img src="' + escapeHtml(image) + '" alt="" loading="lazy" data-mia-image="' + escapeHtml(image) + '" data-mia-item-id="' + escapeHtml(category.id || "") + '" data-mia-slot-name="home-feature"></span>' : "",
      '<span class="home-news-card__copy">',
      category.featureLabel ? '<span class="home-news-card__label">' + escapeHtml(category.featureLabel) + '</span>' : "",
      '<strong>' + escapeHtml(title) + '</strong>',
      text ? '<span>' + escapeHtml(text) + '</span>' : "",
      isClickable ? '<b>' + escapeHtml(cta) + ' <span aria-hidden="true">→</span></b>' : "",
      '</span>',
      '</' + tag + '>'
    ].join("");
  }

  // SECCOES_HOMEPAGE_V1: as secções da homepage passaram a ser dados. Um
  // ficheiro sem `homeSections` — a cápsula do congresso — continua a dar as
  // duas de sempre, montadas a partir do `news` e do `productsIntro`.
  function homeSectionList(home) {
    var lista = home && Array.isArray(home.homeSections) ? home.homeSections : null;
    var news = (home && home.news) || {};
    var produtos = (home && home.productsIntro) || {};

    if (lista) {
      lista = lista.filter(function (seccao) {
        return seccao && String(seccao.id || "").trim();
      });
      if (lista.length) {
        return lista;
      }
    }
    return [
      {
        id: "novidades",
        layout: "feature",
        maxCards: 3,
        repeatInGrid: true,
        eyebrow: news.eyebrow || "",
        title: news.title || "O que há de novo",
        text: news.text || ""
      },
      {
        id: "produtos",
        layout: "grid",
        eyebrow: produtos.eyebrow || "",
        title: produtos.title || "Escolhe o que queres pedir",
        text: produtos.text || ""
      }
    ];
  }

  function homeSectionIsFeature(seccao) {
    return String((seccao && seccao.layout) || "grid") === "feature";
  }

  // Reparte os cartões pelas secções. Quem não tiver secção — ou tiver uma que
  // já não existe — cai na primeira grelha, para nada desaparecer da homepage
  // só por se ter apagado uma secção.
  function splitHomeSections(seccoes, records) {
    var porId = {};
    var repetem = {};
    var refugio = "";
    var primeiroDestaque = "";

    seccoes.forEach(function (seccao) {
      var id = String(seccao.id);
      porId[id] = [];
      if (homeSectionIsFeature(seccao)) {
        // `repeatInGrid`: o cartão aparece em destaque E continua na grelha.
        // É o que a homepage sempre fez com os destaques, por isso vem ligado
        // na migração — desligá-lo tira-os da grelha.
        repetem[id] = seccao.repeatInGrid !== false;
        if (!primeiroDestaque) { primeiroDestaque = id; }
      } else if (!refugio) {
        refugio = id;
      }
    });
    if (!refugio && seccoes.length) {
      refugio = String(seccoes[0].id);
    }

    records.forEach(function (record) {
      var id = String(record.category.section || "");
      // `featured` é o campo antigo e continua a valer como "primeira secção
      // de destaques", para um ficheiro por migrar dar o mesmo que dava.
      if (!id && record.category.featured === true && primeiroDestaque) {
        id = primeiroDestaque;
      }
      if (!porId[id]) {
        id = refugio;
      }
      if (!porId[id]) {
        return;
      }
      porId[id].push(record);
      if (repetem[id] && refugio && porId[refugio] && refugio !== id) {
        porId[refugio].push(record);
      }
    });
    return porId;
  }

  function renderHome(home) {
    ensureHomeSettings(home);
    applySiteSettings(home);
    state.home = home;

    var adminEditing = state.admin && home.adminEditable !== false;
    var allCategories = (home.categories || []).map(function (category, originalIndex) {
      return { category: category, originalIndex: originalIndex };
    });
    var visibleCategories = allCategories.filter(function (record) {
      return homeCategoryIsVisible(record.category);
    });
    var homeCategories = visibleCategories.filter(function (record) {
      return record.category.showOnHome !== false;
    });
    var displayCategories = homeCategories;
    var gridCount = Math.max(1, Math.min(7, displayCategories.length));

    function renderHomeCategoryCard(record, displayIndex) {
      var category = record.category;
      var originalIndex = record.originalIndex;
      var isVisible = homeCategoryIsVisible(category);
      var isAdminHidden = adminEditing && !isVisible;
      var hiddenClass = isAdminHidden ? " is-admin-hidden" : "";
      var carouselImages = home.carousel.enabled !== false && category.carouselEnabled !== false ? (category.carouselImages || []) : [];
      var hasCarousel = carouselImages.length > 0;
      var hasStaticImage = category.image && !hasCarousel;
      var imageClass = hasCarousel ? " has-carousel" : (hasStaticImage ? " has-image" : "");
      // CAROUSEL_SLIDES_V1: o cartão já não carrega parâmetros de carrossel —
      // cada moldura traz os seus, do carrousel.php.
      var imageStyle = hasStaticImage ? ' style="--category-image:url(&quot;' + escapeHtml(siteAssetUrl(category.image)) + '&quot;)"' : "";
      var isClickable = category.clickable !== false;
      var unavailableMessage = !adminEditing && !isClickable && category.unavailableMessage ? String(category.unavailableMessage) : "";
      var disabledClass = !isClickable ? " is-link-disabled" : "";
      var messageClass = unavailableMessage ? " has-unavailable-message" : "";
      var tag = isVisible && isClickable ? "a" : "span";
      var href = tag === "a"
        ? ' href="' + escapeHtml(category.href) + '"'
        : ' aria-disabled="' + (!isClickable ? "true" : "false") + '"' + (unavailableMessage ? ' role="button" tabindex="0" data-home-unavailable-message="' + escapeHtml(unavailableMessage) + '"' : "");
      var carouselHtml = hasCarousel ? renderHomeCarousel(category, home.carousel) : "";
      var adminBadge = isAdminHidden ? '<span class="admin-hidden-badge">Oculto no site</span>' : (!isClickable ? '<span class="admin-hidden-badge">Link inativo</span>' : "");
      var showNumbers = home.showCategoryNumbers === true;
      // V2 fix: emite sempre o slot do numero (com visibility hidden quando
      // toggle desligado) para o grid space-between manter o titulo no
      // centro visual do cartao em vez de o empurrar para cima.
      var numberHtml = showNumbers
        ? '<span class="category-number">' + String(displayIndex + 1).padStart(2, "0") + '</span>'
        : '<span class="category-number is-placeholder" aria-hidden="true">00</span>';
      var anchorId = ' id="' + escapeHtml(homeCategoryAnchor(category).slice(1)) + '"';
      var dataCategoryId = category.id ? ' data-category-id="' + escapeHtml(category.id) + '"' : "";
      var homeImageAttrs = hasStaticImage
        ? ' data-mia-image="' + escapeHtml(category.image) + '" data-mia-item-id="' + escapeHtml(category.id || "") + '" data-mia-slot-name="home-card"'
        : "";
      var adminControls = adminEditing ? [
        '<span class="admin-card-tools home-admin-tools">',
        adminBadge,
        '<label>Título<input type="text" value="' + escapeHtml(category.title || "") + '" data-admin-home-category="' + originalIndex + '" data-admin-home-category-edit="title"></label>',
        '<label>Linha 2<input type="text" value="' + escapeHtml(category.subtitle || "") + '" data-admin-home-category="' + originalIndex + '" data-admin-home-category-edit="subtitle"></label>',
        '<label>Link<input type="text" value="' + escapeHtml(category.href || "") + '" data-admin-home-category="' + originalIndex + '" data-admin-home-category-edit="href"></label>',
        '<label>Imagem de fundo<input type="file" accept="image/*" data-admin-home-image="' + originalIndex + '"></label>',
        category.image ? '<button type="button" data-admin-home-image-remove="' + originalIndex + '">Remover imagem</button>' : "",
        '<label class="admin-check"><input type="checkbox"' + (isVisible ? " checked" : "") + ' data-admin-home-category="' + originalIndex + '" data-admin-home-category-edit="available"> Visível</label>',
        '<label class="admin-check"><input type="checkbox"' + (category.clickable !== false ? " checked" : "") + ' data-admin-home-category="' + originalIndex + '" data-admin-home-category-edit="clickable"> Link ativo</label>',
        '</span>'
      ].join("") : "";

      return [
        '<' + tag + ' class="category-card ' + escapeHtml(category.accent || "gold") + imageClass + hiddenClass + disabledClass + messageClass + '"' + anchorId + href + dataCategoryId + homeImageAttrs + imageStyle + ' aria-label="' + escapeHtml(category.title || "") + '">',
        carouselHtml,
        numberHtml,
        '<span class="category-art" aria-hidden="true"></span>',
        '<strong>' + escapeHtml(category.title || "") + '</strong>',
        '<span>' + escapeHtml(category.subtitle || "") + '</span>',
        // ACTION_TEXT_V1: o "Ver opcoes ->" era um ::after do CSS, igual em
        // todos os cartoes. Passou a ser texto a serio, editavel por cartao em
        // homepage-menu-design.php. Sem `actionText` o CSS continua a por o
        // texto por omissao, por isso nada muda em quem nao o definiu.
        category.actionText
          ? '<span class="category-action">' + escapeHtml(category.actionText) + '</span>'
          : "",
        adminControls,
        '</' + tag + '>'
      ].join("");
    }

    var cards = displayCategories.map(function (record, displayIndex) {
      return renderHomeCategoryCard(record, displayIndex);
    }).join("");
    var adminIntroTools = renderHomeIntroAdminTools(home, adminEditing);

    if (home.layout !== "brand-home") {
      renderChrome([
        '<main class="home-shell home-shell--hub">',
        renderBrand(home.brand, "index.html", home.instagramUrl, state.siteMenuCategories.length ? state.siteMenuCategories : visibleCategories.map(function (record) { return record.category; })),
        '<section class="home-section home-hub-section home-products-section" aria-labelledby="home-title">',
        '<div class="home-section-inner">',
        home.backLink && home.backLink.href ? '<p class="home-back-row"><a class="home-back-link" href="' + escapeHtml(home.backLink.href) + '">&larr; ' + escapeHtml(home.backLink.label || "Voltar") + '</a></p>' : "",
        '<header class="home-section-heading">',
        '<p class="eyebrow">' + escapeHtml(home.intro.eyebrow) + '</p>',
        '<h1 id="home-title">' + escapeHtml(home.intro.title) + '</h1>',
        '<p>' + escapeHtml(home.intro.text) + '</p>',
        '</header>',
        adminIntroTools ? '<div class="home-admin-edit-band">' + adminIntroTools + '</div>' : "",
        '<nav class="category-grid category-grid-count-' + gridCount + '" aria-label="Categorias">',
        cards,
        '</nav>',
        state.homeUnavailableMessage ? '<p class="open-order-hint home-unavailable-message" role="status" aria-live="polite">' + escapeHtml(state.homeUnavailableMessage) + '</p>' : "",
        renderHomeDeadlineNote(home),
        '</div>',
        '</section>',
        renderFooter(home.brand),
        '</main>'
      ].join(""));
    } else {
      var menuCategories = visibleCategories.map(function (record) { return record.category; });
      var seccoes = homeSectionList(home);
      var porSeccao = splitHomeSections(seccoes, displayCategories);
      var hero = home.hero || {};
      var heroImage = hero.image || (menuCategories[0] && menuCategories[0].image) || "";
      var heroImages = homeHeroImages(hero);
      var heroCarouselHtml = renderHomeHeroCarousel(hero);
      var heroCarouselDotsHtml = renderHomeHeroCarouselDots(hero);
      var heroPosition = String(hero.imagePosition || "center").trim();
      var heroStyle;
      var heroActions;
      var seccoesHtml;

      if (!/^[a-z0-9.%\s-]+$/i.test(heroPosition)) {
        heroPosition = "center";
      }
      heroStyle = (heroImage || heroImages.length)
        ? ' style="' + (!heroImages.length && heroImage ? '--home-hero-image:url(&quot;' + escapeHtml(siteAssetUrl(heroImage)) + '&quot;);' : '')
          + '--home-hero-position:' + escapeHtml(heroPosition) + '"'
        : "";

      seccoesHtml = seccoes.map(function (seccao) {
        var id = String(seccao.id);
        var destaque = homeSectionIsFeature(seccao);
        var registos = porSeccao[id] || [];
        var tituloId = "home-section-title-" + id.replace(/[^a-z0-9-]/gi, "");
        var limite;
        var corpo;
        var contagem;

        if (destaque) {
          limite = Math.max(1, parseInt(seccao.maxCards, 10) || 3);
          // Sem nada atribuído, uma secção de destaques mostrava um título
          // sozinho. No site esconde-se; em edição fica, senão não havia como
          // lá arrastar nada de volta.
          if (!registos.length) {
            return "";
          } else {
            corpo = '<div class="home-news-grid">' + registos.slice(0, limite).map(function (record) {
              return renderHomeFeatureCard(record.category, adminEditing);
            }).join("") + '</div>';
          }
        } else {
          contagem = Math.max(1, Math.min(7, registos.length));
          corpo = '<nav class="category-grid category-grid-count-' + contagem
            + '" aria-label="' + escapeHtml(seccao.title || "Categorias") + '">'
            + registos.map(function (record, indice) {
              return renderHomeCategoryCard(record, indice);
            }).join("")
            + '</nav>';
        }

        return [
          '<section class="home-section ' + (destaque ? 'home-news-section' : 'home-products-section')
            + '" id="' + escapeHtml(id) + '" aria-labelledby="' + escapeHtml(tituloId) + '">',
          '<div class="home-section-inner">',
          '<header class="home-section-heading">',
          seccao.eyebrow ? '<p class="eyebrow">' + escapeHtml(seccao.eyebrow) + '</p>' : "",
          '<h2 id="' + escapeHtml(tituloId) + '">' + escapeHtml(seccao.title || "") + '</h2>',
          seccao.text ? '<p>' + escapeHtml(seccao.text) + '</p>' : "",
          '</header>',
          corpo,
          !destaque && state.homeUnavailableMessage ? '<p class="open-order-hint home-unavailable-message" role="status" aria-live="polite">' + escapeHtml(state.homeUnavailableMessage) + '</p>' : "",
          '</div>',
          '</section>'
        ].join("");
      }).join("");

      heroActions = [
        '<div class="home-brand-hero__actions">',
        hero.primaryLabel && hero.primaryHref ? '<a class="home-hero-action home-hero-action--primary" href="' + escapeHtml(hero.primaryHref) + '">' + escapeHtml(hero.primaryLabel) + '<span aria-hidden="true">→</span></a>' : "",
        hero.secondaryLabel && hero.secondaryHref ? '<a class="home-hero-action home-hero-action--secondary" href="' + escapeHtml(hero.secondaryHref) + '">' + escapeHtml(hero.secondaryLabel) + '<span aria-hidden="true">→</span></a>' : "",
        '</div>'
      ].join("");

      renderChrome([
        '<main class="home-shell home-shell--brand">',
        renderBrand(home.brand, "index.html", home.instagramUrl, menuCategories),
        '<section class="home-brand-hero" data-home-hero aria-labelledby="home-title"'
          + (!heroImages.length && heroImage ? ' data-mia-image="' + escapeHtml(heroImage) + '" data-mia-item-id="hero" data-mia-slot-name="home-hero"' : "")
          + heroStyle + '>',
        heroCarouselHtml,
        '<div class="home-brand-hero__inner">',
        '<div class="home-brand-hero__copy">',
        '<p class="eyebrow">' + escapeHtml(home.intro.eyebrow) + '</p>',
        '<h1 id="home-title">' + escapeHtml(home.intro.title) + '</h1>',
        '<p>' + escapeHtml(home.intro.text) + '</p>',
        heroActions,
        heroCarouselDotsHtml,
        '</div>',
        '</div>',
        '</section>',
        adminIntroTools ? '<section class="home-admin-edit-band"><div class="home-section-inner">' + adminIntroTools + '</div></section>' : "",
        seccoesHtml,
        renderHomeDeadlineNote(home),
        renderFooter(home.brand),
        '</main>'
      ].join(""));
    }

    bindUnavailableCategoryCards();
    startHomeCarousels(home);
    startHomeDeadlineCountdown();
  }
