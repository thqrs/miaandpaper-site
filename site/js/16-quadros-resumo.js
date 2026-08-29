// js/16-quadros-resumo.js — parte 16/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: resumo 'o que vais encomendar' de quadros/molduras e produtos opt-in: QUADROS_SUMMARY_LABELS, placeholders e tiles, texto de cores escolhidas, refreshQuadrosBuildSummary.
  // MOLDURAS_SUMMARY_V1
  // O "O que vais encomendar:" das molduras passa a usar o mesmo bloco visual
  // do "Designs que vais encomendar:" dos crachas (.crachas-step2-summary) e
  // cresce passo a passo: cada escolha entra logo como um tile com imagem — a
  // foto enviada (ou o pedido de ajuda), a orientacao, a silhueta, os
  // quadrados das cores, a frase, etc. Vale para todos os fluxos de moldura.
  var QUADROS_SUMMARY_LABELS = {
    designs: "Moldura",
    frame_size: "Tamanho",
    photo_orientation: "Orientação",
    baby_gender: "Menino ou menina",
    baby_animal: "Silhueta",
    silhouette: "Silhueta",
    heart_finish: "Acabamento",
    packaging: "Proteção e embrulho"
  };

  function quadrosSummaryLabel(step) {
    return QUADROS_SUMMARY_LABELS[step && step.id] || (step && (step.label || step.title)) || "";
  }

  function quadrosSummaryTile(visual, label, name) {
    return [
      '<article class="crachas-step2-summary-tile quadros-summary-tile">',
      visual || "",
      label ? '<span class="quadros-summary-tile-label">' + escapeHtml(label) + '</span>' : "",
      name ? '<span class="crachas-step2-summary-tile-name">' + escapeHtml(name) + '</span>' : "",
      '</article>'
    ].join("");
  }

  // Imagens de substituição para as escolhas que não têm foto própria (tamanho,
  // frase, dados do bebé, áudio…), definidas em `summaryPlaceholders` no JSON
  // do produto para poderem ser trocadas por fotos reais sem mexer no código.
  function quadrosSummaryPlaceholder(key) {
    var map = state.product && state.product.summaryPlaceholders ? state.product.summaryPlaceholders : {};
    return key && map[key] ? String(map[key]) : "";
  }

  function quadrosSummaryPlaceholderVisual(key) {
    var image = quadrosSummaryPlaceholder(key);

    if (!image) {
      return "";
    }

    return '<span class="quadros-summary-photo"><img src="' + escapeHtml(image) + '" alt=""></span>';
  }

  function quadrosSummaryTextTile(label, text, placeholderKey) {
    var value = String(text == null ? "" : text).trim();
    var visual;

    if (!value) {
      return "";
    }

    if (value.length > 90) {
      value = value.slice(0, 89).replace(/\s+\S*$/, "") + "…";
    }

    visual = quadrosSummaryPlaceholderVisual(placeholderKey);

    return visual
      ? quadrosSummaryTile(visual, label, value)
      : quadrosSummaryTile('<span class="quadros-summary-text">' + escapeHtml(value) + '</span>', label, "");
  }

  function quadrosSummaryNoteTile(label, name, placeholderKey, icon) {
    return quadrosSummaryTile(
      quadrosSummaryPlaceholderVisual(placeholderKey)
        || '<span class="quadros-summary-note" aria-hidden="true">' + (icon || ICON_PHOTO) + '</span>',
      label,
      name
    );
  }

  function quadrosSummaryImageTile(item, step, label, name) {
    var template = step && step.template === "media-list" ? "media-list" : "design-grid";

    return quadrosSummaryTile(renderVisual(item, template, step), label, name);
  }

  function quadrosSummaryPhotoTiles(key, label, alt) {
    return orderUploadItems(key).slice(0, 4).map(function (upload) {
      return quadrosSummaryTile(
        '<span class="quadros-summary-photo"><img src="' + escapeHtml(orderUploadPreviewUrl(upload)) + '" alt="' + escapeHtml(alt || label || "Foto enviada") + '"></span>',
        label,
        ""
      );
    }).join("");
  }

  function quadrosSummaryAudioTile(key) {
    var count = orderUploadItems(key).length;

    if (!count) {
      return "";
    }

    return quadrosSummaryNoteTile("Áudio", count === 1 ? "1 gravação" : count + " gravações", "audio", ICON_MICROPHONE);
  }

  function quadrosSummaryAttachmentTiles(step) {
    var media = step && step.mediaAttachments ? step.mediaAttachments : null;
    var tiles = "";

    if (!media) {
      return "";
    }

    if (media.photos) {
      tiles += quadrosSummaryPhotoTiles(
        media.photos.selectionKey || "quadro_reference_uploads",
        step.id === "silhouette_details" ? "Silhueta enviada" : "Referência",
        "Foto enviada com o pedido"
      );
    }
    if (media.audio) {
      tiles += quadrosSummaryAudioTile(media.audio.selectionKey || "quadro_audio_uploads");
    }

    return tiles;
  }

  function quadrosSummaryUploadTiles(step) {
    var config = step.upload || {};
    var key = config.selectionKey || "quadro_uploads";
    var tiles = quadrosSummaryPhotoTiles(key, "Foto", "Foto enviada para a moldura");

    if (tiles) {
      return tiles;
    }

    if (config.helpKey && state.selections[config.helpKey]) {
      return quadrosSummaryNoteTile("Foto", "Vamos ajudar-te a enviar", "photo_help", ICON_PHOTO);
    }

    return "";
  }

  function quadrosSummaryColorsTile(step) {
    var limit = paletteSelectionLimit(step);
    var individualColors = Array.isArray(step.individualColors) ? step.individualColors : [];
    var keys = quadrosColorSelectionKeys(step);
    var label = step.summaryLabel || (limit === 1 ? "Cor" : "Cores");
    var slots;
    var tones;

    if (state.selections[keys.mia]) {
      return quadrosSummaryTile(
        '<span class="quadros-summary-colors" aria-hidden="true">'
        + Array.from({ length: limit }, function () { return '<span></span>'; }).join("")
        + '</span>',
        label,
        "Escolha da Mia"
      );
    }

    slots = currentPaletteColorSlots(step, limit);
    tones = quadrosToneSelections(step, limit);
    if (!slots.filter(Boolean).length) {
      return "";
    }

    return quadrosSummaryTile(
      '<span class="quadros-summary-colors" role="img" aria-label="' + escapeHtml(slots.map(function (value, index) {
        var item = quadrosColorItem(step, value);
        return item ? (item.title || item.value) + ", tom " + quadrosToneLabel(tones[index]) : "";
      }).filter(Boolean).join("; ")) + '">'
      + slots.map(function (value, index) {
        var match = individualColors.filter(function (candidate) {
          return candidate && candidate.value === value;
        })[0];

        if (!value || !match) {
          return '<span></span>';
        }

        return '<span class="is-filled" style="--quadros-summary-swatch:' + safeSwatchColor(quadrosColorStops(match)[tones[index]]) + '" title="' + escapeHtml((match.title || value) + ", tom " + quadrosToneLabel(tones[index])) + '"></span>';
      }).join("")
      + '</span>',
      label,
      ""
    );
  }

  function quadrosColorSelectionText(step) {
    var limit;
    var keys;
    var slots;
    var tones;

    if (!step) {
      return "";
    }
    limit = paletteSelectionLimit(step);
    keys = quadrosColorSelectionKeys(step);
    if (state.selections[keys.mia]) {
      return "Escolha da Mia";
    }
    slots = currentPaletteColorSlots(step, limit);
    tones = quadrosToneSelections(step, limit);
    return slots.map(function (value, index) {
      var item = quadrosColorItem(step, value);
      return item ? (item.title || item.value) + " (tom " + quadrosToneLabel(tones[index]) + ")" : "";
    }).filter(Boolean).join(", ");
  }

  function quadrosSummaryDetailsTiles(step) {
    var tiles = "";
    var exampleValue;
    var record;

    if (step.id === "baby_custom_animal") {
      return quadrosSummaryTextTile("Animal", state.selections.baby_custom_animal, "baby_custom_animal");
    }

    if (step.id === "baby_details") {
      tiles += quadrosSummaryTextTile("Nome", state.selections.baby_name, "baby_details");
      tiles += quadrosSummaryTextTile("Nascimento", [state.selections.baby_birth_date, state.selections.baby_birth_time].filter(Boolean).join(" · "), "baby_details");
      tiles += quadrosSummaryTextTile("Peso", state.selections.baby_birth_weight, "baby_details");
      return tiles;
    }

    if (step.id === "phrase_details") {
      if (state.selections.no_phrase) {
        tiles += quadrosSummaryTextTile("Frase", "Sem frase", "phrase");
      } else if (
        String(state.selections.quadro_text || "").trim()
        || orderUploadItems("quadro_reference_uploads").length
        || orderUploadItems("quadro_audio_uploads").length
      ) {
        tiles += quadrosSummaryTextTile("Frase", "Com frase", "phrase");
      }
      return tiles + quadrosSummaryAttachmentTiles(step);
    }

    if (step.id === "love_dedication") {
      if (state.selections.no_dedication) {
        tiles += quadrosSummaryTextTile("Dedicatória", "Sem dedicatória", "phrase");
      } else if (String(state.selections.quadro_dedication || "").trim()
          || orderUploadItems("quadro_reference_uploads").length
          || orderUploadItems("quadro_audio_uploads").length) {
        tiles += quadrosSummaryTextTile("Dedicatória", "Com dedicatória", "phrase");
      }
      return tiles + quadrosSummaryAttachmentTiles(step);
    }

    if (step.id === "silhouette_details") {
      if (state.selections.silhouette_contact_me) {
        tiles += quadrosSummaryTextTile("Silhueta", "Contacto para explicar", "super_description");
      } else {
        tiles += quadrosSummaryTextTile("Silhueta", state.selections.quadro_silhouette_description, "super_description");
      }
      return tiles + quadrosSummaryAttachmentTiles(step);
    }

    if (step.id === "silhouette_text_details") {
      if (state.selections.no_text) {
        tiles += quadrosSummaryTextTile("Texto", "Sem texto", "phrase");
      } else if (String(state.selections.quadro_text || "").trim()
          || orderUploadItems("quadro_reference_uploads").length
          || orderUploadItems("quadro_audio_uploads").length) {
        tiles += quadrosSummaryTextTile("Texto", "Com texto", "phrase");
      }
      return tiles + quadrosSummaryAttachmentTiles(step);
    }

    if (step.id === "super_details") {
      exampleValue = String(state.selections[step.exampleSelectionKey || "details_example"] || "");
      record = exampleValue && Array.isArray(step.exampleImages) ? step.exampleImages.filter(function (entry) {
        return entry && entry.value === exampleValue;
      })[0] : null;

      if (record && record.image) {
        tiles += quadrosSummaryTile(
          '<span class="quadros-summary-photo"><img src="' + escapeHtml(record.image) + '" alt="' + escapeHtml(record.title || exampleValue) + '"></span>',
          "Estilo",
          record.title || exampleValue
        );
      } else {
        tiles += quadrosSummaryTextTile("Estilo", exampleValue, "super_description");
      }

      tiles += quadrosSummaryTextTile("A tua ideia", state.selections.quadro_description, "super_description");
      return tiles + quadrosSummaryAttachmentTiles(step);
    }

    return "";
  }

  function quadrosSummaryStepTiles(step) {
    var value;
    var item;

    if (!step || step.hidden || !stepConditionMatches(step)) {
      return "";
    }

    if (step.template === "photo-upload") {
      return quadrosSummaryUploadTiles(step);
    }

    if (step.template === "palette-grid") {
      return quadrosSummaryColorsTile(step);
    }

    if (step.template === "details-form") {
      return quadrosSummaryDetailsTiles(step);
    }

    value = step.field ? state.selections[step.field] : "";
    value = Array.isArray(value) ? value[0] : value;
    item = value ? (step.items || []).filter(function (candidate) {
      return candidate && candidate.value === value;
    })[0] : null;

    if (!value) {
      return quadrosSummaryAttachmentTiles(step);
    }

    return (item
      ? quadrosSummaryImageTile(item, step, quadrosSummaryLabel(step), displayItemTitle(item))
      : quadrosSummaryTextTile(quadrosSummaryLabel(step), String(value))
    ) + quadrosSummaryAttachmentTiles(step);
  }

  function buildSummaryItem(step, value) {
    var selected = String(value || "");

    return selected && step && Array.isArray(step.items)
      ? step.items.filter(function (item) {
        return item && String(item.value || "") === selected;
      })[0] || null
      : null;
  }

  function renderPortaFolhetosBuildSummary(product, step) {
    var config = product && product.buildSummary;
    var sizeStep;
    var coverStep;
    var variationStep;
    var size;
    var sizeItem;
    var groups;
    var tiles = "";

    if (!config || config.mode !== "porta-folhetos" || (step && step.template === "confirm")) {
      return "";
    }

    sizeStep = findStep(product, config.sizeStepId || "size");
    coverStep = findStep(product, config.coverStepId || "covers");
    variationStep = findStep(product, config.variationStepId || "designs");
    size = String(state.selections[sizeStep && sizeStep.field || "size"] || "");
    sizeItem = buildSummaryItem(sizeStep, size);
    groups = config.sizeGroups && Array.isArray(config.sizeGroups[size]) ? config.sizeGroups[size] : [];

    if (!sizeItem) {
      return "";
    }

    tiles += quadrosSummaryImageTile(sizeItem, sizeStep, "Tamanho", displayItemTitle(sizeItem));

    groups.forEach(function (group) {
      var groupConfig = config.groups && config.groups[group] || {};
      var coverItem = buildSummaryItem(coverStep, state.selections[groupConfig.coverField]);
      var variationItem = buildSummaryItem(variationStep, state.selections[groupConfig.variationField]);
      var previewItem;

      if (coverItem) {
        previewItem = variationItem && variationItem.image
          ? Object.assign({}, coverItem, { image: variationItem.image })
          : coverItem;
        tiles += quadrosSummaryImageTile(previewItem, coverStep, "Design " + group, displayItemTitle(coverItem));
      }
      if (variationItem) {
        tiles += quadrosSummaryTextTile("Argolas + fita " + group, variationItem.title || variationItem.value || "");
      }
    });

    selectedOptionDrawerRecords(product).forEach(function (record) {
      var field = record && record.drawer && record.drawer.field || "";
      var label = config.drawerLabels && config.drawerLabels[field]
        || record.drawer && (record.drawer.title || record.drawer.label)
        || "Opção";

      if (record && record.item) {
        tiles += record.item.image
          ? quadrosSummaryImageTile(record.item, record.step, label, record.item.title || record.item.value || "")
          : quadrosSummaryTextTile(label, record.item.title || record.item.value || "");
      }
    });

    return [
      '<section class="crachas-step2-summary quadros-summary porta-folhetos-build-summary" aria-label="O que vais encomendar">',
      '<h3 class="crachas-step2-summary-title">' + escapeHtml(config.title || "O que vais encomendar:") + '</h3>',
      '<div class="crachas-step2-summary-grid quadros-summary-grid">' + tiles + '</div>',
      '</section>'
    ].join("");
  }

  function renderQuadrosBuildSummary(product, step) {
    var design = selectedDesignItems(product)[0];
    var frameStep;
    var info;
    var tiles = "";

    if (product && product.buildSummary && product.buildSummary.mode === "porta-folhetos") {
      return renderPortaFolhetosBuildSummary(product, step);
    }

    if (!isQuadrosProduct(product) || !design || (step && step.template === "confirm")) {
      return "";
    }

    info = priceInfo(product);
    frameStep = findStep(product, "frame_size");

    (product.steps || []).forEach(function (entry) {
      if (!entry || entry.id === "pack" || entry.id === "delivery_contact" || entry.id === "confirm") {
        return;
      }

      tiles += quadrosSummaryStepTiles(entry);

      // Nos fluxos sem passo de tamanho, a medida vem do proprio tipo de
      // moldura — mostramo-la logo a seguir para o resumo ficar completo.
      if (entry.id === "designs" && info.frameSize && !(frameStep && !frameStep.hidden && stepConditionMatches(frameStep))) {
        tiles += quadrosSummaryTextTile("Tamanho", info.frameSize, "frame_size");
      }
    });

    if (!tiles) {
      return "";
    }

    return [
      '<section class="crachas-step2-summary quadros-summary" aria-label="O que vais encomendar">',
      '<h3 class="crachas-step2-summary-title">O que vais encomendar:</h3>',
      '<div class="crachas-step2-summary-grid quadros-summary-grid">' + tiles + '</div>',
      '</section>'
    ].join("");
  }

  function refreshCadernosBuildSummary(product) {
    var current = document.querySelector(".cadernos-build-summary");
    var wrapper = document.createElement("div");
    var html;

    if (!isCadernosProduct(product) || !current) {
      return;
    }

    html = renderCadernosBuildSummaryV2(product, currentStep(product));
    if (!html) {
      return;
    }

    wrapper.innerHTML = html;
    if (wrapper.firstChild) {
      current.replaceWith(wrapper.firstChild);
    }
  }

  // MOLDURAS_SUMMARY_V1: escrever num campo (frase, dados do bebé, ideia) não
  // re-renderiza o passo — para não perder o cursor — por isso actualizamos o
  // resumo no sítio, para a informação aparecer à medida que é escrita.
  function refreshQuadrosBuildSummary(product) {
    var current = document.querySelector(".quadros-summary");
    var wrapper = document.createElement("div");
    var html;

    if (!isQuadrosProduct(product) || !current) {
      return;
    }

    html = renderQuadrosBuildSummary(product, currentStep(product));
    if (!html) {
      return;
    }

    wrapper.innerHTML = html;
    if (wrapper.firstChild) {
      current.replaceWith(wrapper.firstChild);
    }
  }

  // CONFIRM_REFORMAT_V1: opts.hideDelivery permite ao passo de confirmação
  // suprimir o picker de entrega (já foi escolhido em delivery_contact).
  function renderPricePanel(product, opts) {
    var info = priceInfo(product);
    var hideDelivery = opts && opts.hideDelivery === true;
    var delivery = hideDelivery ? "" : renderDeliveryChooser(product);
    var hasPrices = Object.keys(product.prices || {}).length > 0;

    if (!hasPrices) {
      return hideDelivery ? "" : renderDeliveryChooser(product, "standalone");
    }

    if (isCadernosProduct(product)) {
      var cadernoOption = selectedCadernoPurchaseOption(product);
      var cadernoPriceText = cadernoPriceEquation(info);

      if (!cadernoOption) {
        return "";
      }

      return [
        '<aside class="price-panel">',
        '<span>Preço do pedido</span>',
        '<strong>' + escapeHtml(info.total) + '</strong>',
        '<p>' + escapeHtml(cadernoOption.title) + '</p>',
        cadernoPriceText ? '<small class="price-panel-shipping-note">' + escapeHtml(cadernoPriceText) + '</small>' : "",
        delivery,
        '</aside>'
      ].join("");
    }

    if (isQuadrosProduct(product)) {
      var quadroPriceText = quadroPriceEquation(info);

      if (!info.quantity || !info.total) {
        return delivery;
      }

      return [
        '<aside class="price-panel">',
        '<span>' + (info.priceToConfirm ? 'Preço previsto' : 'Preço da moldura') + '</span>',
        '<strong>' + escapeHtml(info.total) + '</strong>',
        info.priceToConfirm ? '<small class="price-panel-shipping-note">O preço final depende da complexidade e será confirmado pela Mia.</small>' : '',
        quadroPriceText ? '<small class="price-panel-shipping-note">' + escapeHtml(quadroPriceText) + '</small>' : '',
        info.priceToConfirm && info.packagingTotal ? '<small class="price-panel-shipping-note">Embrulho para oferecer: +' + escapeHtml(info.packagingTotal) + '.</small>' : '',
        delivery,
        '</aside>'
      ].join("");
    }

    if (!info.quantity) {
      return "";
    }

    if (!info.size) {
      return [
        '<aside class="price-panel muted">',
        '<span>Pack escolhido</span>',
        '<strong>' + escapeHtml(productQuantityLabel(product, info.quantity)) + '</strong>',
        '<p>Escolhe o tamanho para ver o preço.</p>',
        delivery,
        '</aside>'
      ].join("");
    }

    // PRICE_SHIPPING_BREAKDOWN_V1: mostra produto + portes separadamente.
    // Quando portes > 0 (CTT) o label deixa claro que é estimativa.
    var pb = priceBreakdown(product);
    var priceLineHtml;
    if (pb.shippingCents > 0) {
      priceLineHtml = '<strong>'
        + escapeHtml(pb.subtotal) + ' + ' + escapeHtml(pb.shipping)
        + '</strong>'
        + '<small class="price-panel-shipping-note">(estimativa de portes CTT, valor mínimo)</small>';
    } else {
      priceLineHtml = '<strong>' + escapeHtml(pb.subtotal || info.total) + '</strong>'
        + (pb.deliveryLabel ? '<small class="price-panel-shipping-note">Portes: <strong>Grátis</strong></small>' : '');
    }

    return [
      '<aside class="price-panel">',
      '<span>Preço do pedido</span>',
      priceLineHtml,
      '<p>' + escapeHtml(productQuantityLabel(product, info.quantity) + ' · ' + info.size + ' · ' + info.perPin) + '</p>',
      info.customizationFeeCents ? '<small class="price-panel-shipping-note">Preparação e testes dos designs: +' + escapeHtml(formatCents(info.customizationFeeCents)) + '.</small>' : '',
      info.discount > 0 ? '<em>Poupas ' + info.discount + '%</em>' : "",
      delivery,
      '</aside>'
    ].join("");
  }

  function renderDeliveryChooser(product) {
    var selected = getDeliveryOption(product).id;
    var html = "";
    var standalone = arguments.length > 1 && arguments[1] === "standalone";

    deliveryOptions(product).forEach(function (option) {
      var fee = deliveryPriceText(option);

      html += [
        '<label class="delivery-option">',
        '<input type="radio" name="delivery_option_ui" value="' + escapeHtml(option.id) + '" data-delivery-option ' + (option.id === selected ? "checked" : "") + '>',
        '<span>',
        '<strong>' + escapeHtml(option.label) + '</strong>',
        option.text ? '<em>' + escapeHtml(option.text) + '</em>' : "",
        '</span>',
        '<b class="delivery-price' + (String(fee).length > 9 ? ' is-text-price' : '') + '">' + escapeHtml(fee) + '</b>',
        '</label>'
      ].join("");
    });

    return [
      '<div class="delivery-choice ' + (standalone ? "is-standalone" : "") + '">',
      '<span>Entrega</span>',
      html,
      '<p>Caso já tenhas feito uma encomenda que ainda não foi enviada, escolhe "Junta as minhas encomendas" para receberes todas as tuas encomendas na mesma embalagem.</p>',
      (standalone || selected === "shipping") ? '<p>O preço do pedido não inclui portes.</p>' : "",
      '</div>'
    ].join("");
  }

  function adminFieldControls(step, field, index) {
    if (!state.admin) {
      return "";
    }

    return [
      '<div class="admin-card-tools field-admin-tools">',
      '<label>Etiqueta<input type="text" value="' + escapeHtml(field.label || "") + '" data-admin-field-step="' + escapeHtml(step.id) + '" data-admin-field-index="' + index + '" data-admin-field-edit="label"></label>',
      '<label>Placeholder<input type="text" value="' + escapeHtml(field.placeholder || "") + '" data-admin-field-step="' + escapeHtml(step.id) + '" data-admin-field-index="' + index + '" data-admin-field-edit="placeholder"></label>',
      '<label>Secção<input type="text" value="' + escapeHtml(field.section || "") + '" data-admin-field-step="' + escapeHtml(step.id) + '" data-admin-field-index="' + index + '" data-admin-field-edit="section"></label>',
      '<label>Texto da secção<textarea data-admin-field-step="' + escapeHtml(step.id) + '" data-admin-field-index="' + index + '" data-admin-field-edit="sectionText">' + escapeHtml(field.sectionText || "") + '</textarea></label>',
      '<label class="admin-check"><input type="checkbox"' + (field.required ? " checked" : "") + ' data-admin-field-step="' + escapeHtml(step.id) + '" data-admin-field-index="' + index + '" data-admin-field-edit="required"> Obrigatório</label>',
      '</div>'
    ].join("");
  }

  // DELIVERY_CONTACT_STEP_V1 + REORDER_CONTACT_BLOCK_V1: renderDetailsForm
  // ganhou suporte a `field.sectionTextAfter: true`. Quando uma secção tem
  // pelo menos um campo com esse flag, o `sectionText` correspondente é
  // diferido para depois dos campos (ordem global pretendida para
  // "Dados de Contacto" e qualquer outro bloco que adopte o mesmo padrão).
  // Comportamento por defeito (sem o flag) mantém-se: texto antes dos campos.
  function renderDetailsFieldControl(field, isMissing) {
    var value = state.selections[field.name] || "";
    var maxLength = Math.max(0, parseInt(field.maxLength, 10) || 0);
    var inputMode = field.inputmode ? ' inputmode="' + escapeHtml(field.inputmode) + '"' : "";
    var attributes = ' class="' + (isMissing ? "is-missing" : "") + '" name="' + escapeHtml(field.name) + '" placeholder="' + escapeHtml(field.placeholder || "") + '"' + inputMode + (field.required ? " required" : "") + (isMissing ? ' aria-invalid="true"' : "") + (maxLength ? ' maxlength="' + maxLength + '"' : "") + ' data-detail-field';

    if (field.type === "textarea") {
      return '<textarea rows="3"' + attributes + '>' + escapeHtml(value) + '</textarea>';
    }

    return '<input type="text" value="' + escapeHtml(value) + '" autocomplete="' + escapeHtml(field.autocomplete || "off") + '"' + attributes + '>';
  }
