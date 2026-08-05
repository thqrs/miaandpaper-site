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
    var prices;
    var sizeKeys;
    var quantities;
    var html = "";

    ensureAdminPriceShell(product);

    prices = product && product.prices ? product.prices : {};
    sizeKeys = Object.keys(prices);
    quantities = allPriceQuantities(prices);

    if (!sizeKeys.length || !quantities.length) {
      return [
        '<details class="admin-step-panel admin-price-panel">',
        '<summary>Preços</summary>',
        '<p>Este produto ainda não tem packs suficientes para criar uma tabela de preços.</p>',
        '</details>'
      ].join("");
    }

    html += [
      '<p class="admin-price-help">Fonte central: <code>content/pricing.json</code>. Podes editar o total do pack ou o valor unitário; o outro campo é recalculado.</p>',
      '<div class="admin-price-table-wrap">',
      '<table class="admin-price-table">',
      '<thead><tr>',
      '<th>Subtipo</th>',
      '<th>Pack/unidades</th>',
      '<th>Total do pack</th>',
      '<th>Preço unitário</th>',
      '</tr></thead>',
      '<tbody>'
    ].join("");

    sizeKeys.forEach(function (size) {
      quantities.forEach(function (quantity) {
        var cents = prices[size] && prices[size][quantity] != null ? Number(prices[size][quantity]) : 0;
        var unitCents = Number(quantity) ? cents / Number(quantity) : 0;

        if (prices[size] && prices[size][quantity] == null) {
          return;
        }

        html += [
          '<tr>',
          '<td><strong>' + escapeHtml(priceDisplayName(product, size)) + '</strong><small>' + escapeHtml(size) + '</small></td>',
          '<td><input type="number" min="1" step="1" value="' + escapeHtml(quantity) + '" data-admin-price-pack-edit data-admin-price-size="' + escapeHtml(size) + '" data-admin-price-pack="' + escapeHtml(quantity) + '"><small>' + escapeHtml(productQuantityLabel(product, quantity)) + '</small></td>',
          '<td><input type="text" inputmode="decimal" value="' + escapeHtml(centsToEuroInput(cents)) + '" data-admin-price-kind="total" data-admin-price-size="' + escapeHtml(size) + '" data-admin-price-pack="' + escapeHtml(quantity) + '"></td>',
          '<td><input type="text" inputmode="decimal" value="' + escapeHtml(centsToEuroInput(unitCents)) + '" data-admin-price-kind="unit" data-admin-price-size="' + escapeHtml(size) + '" data-admin-price-pack="' + escapeHtml(quantity) + '"></td>',
          '</tr>'
        ].join("");
      });
    });

    html += '</tbody></table></div>';

    return '<details class="admin-step-panel admin-price-panel"><summary>Preços</summary>' + html + '</details>';
  }

  function renderAdminDeliveryPanel(product) {
    var options = product && product.deliveryOptions ? product.deliveryOptions : [];
    var html = "";

    options.forEach(function (option, index) {
      html += [
        '<section>',
        '<strong>Entrega ' + (index + 1) + '</strong>',
        '<label><span>Texto principal</span><input type="text" value="' + escapeHtml(option.label || "") + '" data-admin-delivery-index="' + index + '" data-admin-delivery-edit="label"></label>',
        '<label><span>Linha 2</span><input type="text" value="' + escapeHtml(option.text || "") + '" data-admin-delivery-index="' + index + '" data-admin-delivery-edit="text"></label>',
        '<label><span>Texto do preço</span><input type="text" value="' + escapeHtml(option.priceText || "") + '" data-admin-delivery-index="' + index + '" data-admin-delivery-edit="priceText" placeholder="Ex.: Valor mínimo 10 €, preço a combinar"></label>',
        '<label><span>Preço técnico em cêntimos</span><input type="number" min="0" step="1" value="' + escapeHtml(option.feeCents || 0) + '" data-admin-delivery-index="' + index + '" data-admin-delivery-edit="feeCents"></label>',
        '</section>'
      ].join("");
    });

    return html ? '<details class="admin-step-panel admin-price-panel"><summary>Editar entrega</summary>' + html + '</details>' : "";
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
    var carousel;

    if (!home) {
      return "";
    }

    ensureHomeSettings(home);
    theme = home.theme || {};
    carousel = home.carousel || {};

    return [
      '<details class="admin-step-panel admin-global-panel">',
      '<summary>Configuração global</summary>',
      '<p class="admin-price-help">Cores globais, fundo do site e carousel automático das imagens do Passo 1.</p>',
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
      '<label class="admin-check"><input type="checkbox"' + (carousel.enabled !== false ? " checked" : "") + ' data-admin-home-carousel="enabled"> Carousel automático nos cartões (defaults globais)</label>',
      '<div class="admin-image-control-grid">',
      '<label><span>Velocidade (segundos)</span><input type="number" min="3" max="30" step="1" value="' + escapeHtml(carousel.speedSeconds || 8) + '" data-admin-home-carousel="speedSeconds"></label>',
      '<label><span>Zoom movimento (%)</span><input type="number" min="100" max="140" step="1" value="' + escapeHtml(carousel.zoomPercent || 108) + '" data-admin-home-carousel="zoomPercent"></label>',
      '<label><span>Pan movimento (%)</span><input type="number" min="0" max="18" step="1" value="' + escapeHtml(carousel.panPercent || 6) + '" data-admin-home-carousel="panPercent"></label>',
      '<label><span>Escurecer imagem (%)</span><input type="number" min="0" max="80" step="1" value="' + escapeHtml(carousel.overlayOpacity || 36) + '" data-admin-home-carousel="overlayOpacity"></label>',
      '</div>',
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
      // ADMIN_ORDERS_V1: link para o painel de encomendas.
      '<a class="admin-funnel-link" href="admin-orders.php" target="_blank" rel="noopener">Encomendas</a>',
      '<a class="admin-funnel-link" href="admin-colors.html" target="_blank" rel="noopener">Cores</a>',
      '<a class="admin-funnel-link" href="admin-uploads.php" target="_blank" rel="noopener">Uploads assistidos</a>',
      '<a class="admin-funnel-link" href="galeria.html" target="_blank" rel="noopener">Galeria</a>',
      '<a class="admin-funnel-link" href="multimedia.html" target="_blank" rel="noopener">Multimédia</a>',
      '<a class="admin-funnel-link" href="reviews.html" target="_blank" rel="noopener">Reviews</a>',
      '<a class="admin-funnel-link" href="produtos.html" target="_blank" rel="noopener">Produtos</a>',
      // TOOLS_INDEX_V1: link para as ferramentas internas (só admin; a página
      // valida a sessão no servidor, como admin-funnel.php).
      '<a class="admin-funnel-link" href="tools/index.php" target="_blank" rel="noopener">Ferramentas</a>',
      '<a class="admin-funnel-link" href="cadernos-anuais.html">Cadernos</a>',
      '<button type="button" data-admin-exit>Sair</button>',
      '</div>',
      message,
      renderBasicAdminTrackingPanel(),
      step ? '<details class="admin-step-panel"><summary>Editar passo</summary><label><span>Template</span><select data-admin-template>' + options + '</select></label>' : "",
      step ? '<label><span>Título</span><input type="text" value="' + escapeHtml(step.title || "") + '" data-admin-step-edit="title"></label>' : "",
      step ? '<label><span>Texto</span><textarea data-admin-step-edit="text">' + escapeHtml(step.text || "") + '</textarea></label>' : "",
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

    document.querySelectorAll("[data-admin-home-carousel]").forEach(function (input) {
      input.addEventListener("change", function () {
        var key = input.dataset.adminHomeCarousel;

        if (!currentHome) {
          return;
        }

        ensureHomeSettings(currentHome);
        pushUndo(currentHome);
        currentHome.carousel[key] = input.type === "checkbox" ? input.checked : Number(input.value);
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

  // HOMEPAGE_CAROUSEL_DARKMODE_FIX_V2_OFFICIAL_SITE: overrides de carrossel
  // por cartao (speed/zoom/pan/overlay) com fallback para os globais em
  // home.carousel.*. Quando o campo na categoria for null/undefined, usa o
  // global; quando for um numero finito, sobrepoe so esse cartao.
  function effectiveCarouselValue(category, key, fallback) {
    if (category && category[key] != null) {
      var raw = Number(category[key]);
      if (isFinite(raw)) {
        return raw;
      }
    }
    return Number(fallback);
  }

  function renderHomeCarousel(category, carousel) {
    var globalPan = Math.max(0, Math.min(18, Number(carousel && carousel.panPercent) || 6));
    var pan = Math.max(0, Math.min(18, effectiveCarouselValue(category, "carouselPanPercent", globalPan)));
    var rawImages = category.carouselImages || [];
    var sourceImages = category.id === "cadernos" ? rawImages.slice() : rawImages.slice(0, 12);
    var randomize = category.carouselRandomizeOnLoad !== false;
    // Runtime-only shuffle: a ordem original em content/products/<slug>.json
    // nao e tocada. Cada page-load embaralha localmente.
    var images = randomize && sourceImages.length > 1 ? shuffleCopy(sourceImages) : sourceImages;

    if (!images.length) {
      return "";
    }

    return [
      '<span class="category-carousel" data-home-carousel aria-hidden="true">',
      images.map(function (image, index) {
        var direction = index % 4;
        var panX = direction === 0 || direction === 3 ? pan : -pan;
        var panY = direction < 2 ? -pan : pan;
        return '<span class="category-carousel-frame' + (index === 0 ? ' is-active' : '')
          + '" data-mia-image="' + escapeHtml(image)
          + '" data-mia-item-id="' + escapeHtml(category.id || "")
          + '" data-mia-slot-name="home-carousel" data-mia-slide-index="' + index
          + '" style="background-image:url(&quot;' + escapeHtml(image) + '&quot;);--carousel-pan-x:' + panX + '%;--carousel-pan-y:' + panY + '%"></span>';
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
    var isClickable = !adminEditing && category.clickable !== false && String(category.href || "").trim();
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
    var displayCategories = adminEditing ? allCategories.filter(function (record) {
      return record.category.showOnHome !== false;
    }) : homeCategories;
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
      var globalSpeedSeconds = Number(home.carousel.speedSeconds) || 8;
      var globalZoomPercent = Number(home.carousel.zoomPercent) || 108;
      var globalOverlayOpacity = Number(home.carousel.overlayOpacity) || 36;
      var globalPanPercent = Number(home.carousel.panPercent) || 6;
      var effSpeed = Math.max(3, Math.min(30, effectiveCarouselValue(category, "carouselSpeedSeconds", globalSpeedSeconds)));
      var effZoom = Math.max(100, Math.min(140, effectiveCarouselValue(category, "carouselZoomPercent", globalZoomPercent)));
      var effOverlay = Math.max(0, Math.min(80, effectiveCarouselValue(category, "carouselOverlayOpacity", globalOverlayOpacity)));
      var effPan = Math.max(0, Math.min(18, effectiveCarouselValue(category, "carouselPanPercent", globalPanPercent)));
      var carouselStyle = hasCarousel ? ' style="--carousel-speed:' + escapeHtml(effSpeed) + 's;--carousel-zoom-scale:' + escapeHtml((effZoom / 100).toFixed(3)) + ';--carousel-overlay:' + escapeHtml((effOverlay / 100).toFixed(2)) + ';--carousel-pan:' + escapeHtml(effPan) + '%"' : "";
      var imageStyle = hasStaticImage ? ' style="--category-image:url(&quot;' + escapeHtml(siteAssetUrl(category.image)) + '&quot;)"' : carouselStyle;
      var isClickable = category.clickable !== false;
      var unavailableMessage = !adminEditing && !isClickable && category.unavailableMessage ? String(category.unavailableMessage) : "";
      var disabledClass = !isClickable ? " is-link-disabled" : "";
      var messageClass = unavailableMessage ? " has-unavailable-message" : "";
      var tag = !adminEditing && isVisible && isClickable ? "a" : "span";
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
        '<label class="admin-check"><input type="checkbox"' + (category.carouselEnabled !== false ? " checked" : "") + ' data-admin-home-category="' + originalIndex + '" data-admin-home-category-edit="carouselEnabled"> Carrossel ativo</label>',
        '<label><span>Intervalo carrossel (ms)</span><input type="number" min="800" max="30000" step="100" value="' + escapeHtml(category.carouselIntervalMs != null ? category.carouselIntervalMs : 3500) + '" data-admin-home-category="' + originalIndex + '" data-admin-home-category-edit="carouselIntervalMs"></label>',
        '<label class="admin-check"><input type="checkbox"' + (category.carouselRandomizeOnLoad !== false ? " checked" : "") + ' data-admin-home-category="' + originalIndex + '" data-admin-home-category-edit="carouselRandomizeOnLoad"> Aleatório ao carregar</label>',
        '<label><span>Velocidade (segundos) — global ' + escapeHtml(globalSpeedSeconds) + '</span><input type="number" min="3" max="30" step="1" placeholder="' + escapeHtml(globalSpeedSeconds) + '" value="' + escapeHtml(category.carouselSpeedSeconds != null ? category.carouselSpeedSeconds : "") + '" data-admin-home-category="' + originalIndex + '" data-admin-home-category-edit="carouselSpeedSeconds" data-admin-home-category-allow-empty="1"></label>',
        '<label><span>Zoom movimento (%) — global ' + escapeHtml(globalZoomPercent) + '</span><input type="number" min="100" max="140" step="1" placeholder="' + escapeHtml(globalZoomPercent) + '" value="' + escapeHtml(category.carouselZoomPercent != null ? category.carouselZoomPercent : "") + '" data-admin-home-category="' + originalIndex + '" data-admin-home-category-edit="carouselZoomPercent" data-admin-home-category-allow-empty="1"></label>',
        '<label><span>Pan movimento (%) — global ' + escapeHtml(globalPanPercent) + '</span><input type="number" min="0" max="18" step="1" placeholder="' + escapeHtml(globalPanPercent) + '" value="' + escapeHtml(category.carouselPanPercent != null ? category.carouselPanPercent : "") + '" data-admin-home-category="' + originalIndex + '" data-admin-home-category-edit="carouselPanPercent" data-admin-home-category-allow-empty="1"></label>',
        '<label><span>Escurecer imagem (%) — global ' + escapeHtml(globalOverlayOpacity) + '</span><input type="number" min="0" max="80" step="1" placeholder="' + escapeHtml(globalOverlayOpacity) + '" value="' + escapeHtml(category.carouselOverlayOpacity != null ? category.carouselOverlayOpacity : "") + '" data-admin-home-category="' + originalIndex + '" data-admin-home-category-edit="carouselOverlayOpacity" data-admin-home-category-allow-empty="1"></label>',
        '</span>'
      ].join("") : "";

      return [
        '<' + tag + ' class="category-card ' + escapeHtml(category.accent || "gold") + imageClass + hiddenClass + disabledClass + messageClass + '"' + anchorId + href + dataCategoryId + homeImageAttrs + imageStyle + ' aria-label="' + escapeHtml(category.title || "") + '">',
        carouselHtml,
        numberHtml,
        '<span class="category-art" aria-hidden="true"></span>',
        '<strong>' + escapeHtml(category.title || "") + '</strong>',
        '<span>' + escapeHtml(category.subtitle || "") + '</span>',
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
        '<nav class="category-grid category-grid-count-' + gridCount + (adminEditing ? ' is-admin-home-grid' : '') + '" aria-label="Categorias">',
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
      var featuredCategories = menuCategories.filter(function (category) { return category.featured === true; });
      var hero = home.hero || {};
      var news = home.news || {};
      var productsIntro = home.productsIntro || {};
      var heroImage = hero.image || (menuCategories[0] && menuCategories[0].image) || "";
      var heroImages = homeHeroImages(hero);
      var heroCarouselHtml = renderHomeHeroCarousel(hero);
      var heroCarouselDotsHtml = renderHomeHeroCarouselDots(hero);
      var heroPosition = String(hero.imagePosition || "center").trim();
      var heroStyle;
      var newsCards;
      var heroActions;

      if (!/^[a-z0-9.%\s-]+$/i.test(heroPosition)) {
        heroPosition = "center";
      }
      heroStyle = (heroImage || heroImages.length)
        ? ' style="' + (!heroImages.length && heroImage ? '--home-hero-image:url(&quot;' + escapeHtml(siteAssetUrl(heroImage)) + '&quot;);' : '')
          + '--home-hero-position:' + escapeHtml(heroPosition) + '"'
        : "";

      if (!featuredCategories.length) {
        featuredCategories = menuCategories.filter(function (category) {
          return category.clickable !== false && String(category.href || "").trim();
        }).slice(0, 2);
      }
      newsCards = featuredCategories.slice(0, 3).map(function (category) {
        return renderHomeFeatureCard(category, adminEditing);
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
        '<section class="home-section home-news-section" id="novidades" aria-labelledby="home-news-title">',
        '<div class="home-section-inner">',
        '<header class="home-section-heading">',
        news.eyebrow ? '<p class="eyebrow">' + escapeHtml(news.eyebrow) + '</p>' : "",
        '<h2 id="home-news-title">' + escapeHtml(news.title || "O que há de novo") + '</h2>',
        news.text ? '<p>' + escapeHtml(news.text) + '</p>' : "",
        '</header>',
        '<div class="home-news-grid">' + newsCards + '</div>',
        '</div>',
        '</section>',
        '<section class="home-section home-products-section" id="produtos" aria-labelledby="home-products-title">',
        '<div class="home-section-inner">',
        '<header class="home-section-heading">',
        productsIntro.eyebrow ? '<p class="eyebrow">' + escapeHtml(productsIntro.eyebrow) + '</p>' : "",
        '<h2 id="home-products-title">' + escapeHtml(productsIntro.title || "Escolhe o que queres pedir") + '</h2>',
        productsIntro.text ? '<p>' + escapeHtml(productsIntro.text) + '</p>' : "",
        '</header>',
        '<nav class="category-grid category-grid-count-' + gridCount + (adminEditing ? ' is-admin-home-grid' : '') + '" aria-label="Categorias">',
        cards,
        '</nav>',
        state.homeUnavailableMessage ? '<p class="open-order-hint home-unavailable-message" role="status" aria-live="polite">' + escapeHtml(state.homeUnavailableMessage) + '</p>' : "",
        '</div>',
        '</section>',
        renderHomeDeadlineNote(home),
        renderFooter(home.brand),
        '</main>'
      ].join(""));
    }

    bindUnavailableCategoryCards();
    startHomeCarousels(home);
    startHomeDeadlineCountdown();
  }

