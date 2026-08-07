// js/17-wizard-render.js — parte 17/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: render dos passos do wizard: media composer dos detalhes, open order hint, aviso de pagamento, pedido de oferta, slideshow do interior, numeracao e labels dos passos, historico do browser (handleWizardPopState).
  function isDetailsMediaComposer(step) {
    var fields = step && Array.isArray(step.fields) ? step.fields : [];
    return !!(
      step &&
      step.template === "details-form" &&
      step.mediaAttachments &&
      fields.length === 1 &&
      fields[0] &&
      fields[0].type === "textarea"
    );
  }

  function normalizeStepExample(record, fallbackAlt) {
    if (typeof record === "string") {
      return record ? { image: record, alt: fallbackAlt || "Exemplo da personalização" } : null;
    }
    if (!record || !record.image) {
      return null;
    }
    return {
      id: String(record.id || record.value || ""),
      image: String(record.image),
      alt: String(record.alt || fallbackAlt || "Exemplo da personalização"),
      value: String(record.value || ""),
      title: String(record.title || record.value || ""),
      text: String(record.text || ""),
      frameSize: String(record.frameSize || ""),
      drawerImages: Array.isArray(record.drawerImages) ? record.drawerImages.filter(Boolean).map(String) : []
    };
  }

  function stepExampleRecords(step) {
    var byField = step && step.exampleByField && typeof step.exampleByField === "object" ? step.exampleByField : {};
    var fieldNames = Object.keys(byField);
    var dynamicExample = null;

    fieldNames.some(function (fieldName) {
      var mapping = byField[fieldName] || {};
      var selected = state.selections[fieldName];
      var values = Array.isArray(selected) ? selected : [selected];

      return values.some(function (value) {
        if (value != null && Object.prototype.hasOwnProperty.call(mapping, String(value))) {
          dynamicExample = normalizeStepExample(mapping[String(value)], step.exampleAlt);
          return !!dynamicExample;
        }
        return false;
      });
    });

    if (dynamicExample) {
      return [dynamicExample];
    }

    if (step && Array.isArray(step.exampleImages)) {
      return step.exampleImages.map(function (record) {
        return normalizeStepExample(record, step.exampleAlt);
      }).filter(Boolean);
    }

    var fallback = step && step.exampleImage;
    var fallbackRecord = normalizeStepExample(fallback, step && step.exampleAlt);
    return fallbackRecord ? [fallbackRecord] : [];
  }

  function renderDetailsForm(step) {
    var currentSection = null;
    var pendingAfterText = "";
    var html = "";
    var examplesAlwaysVisible = step.examplesAlwaysVisible === true;
    var exampleVisible = examplesAlwaysVisible || state.selections.show_details_example !== false;
    var exampleRecords = stepExampleRecords(step);
    var hasMultipleExamples = exampleRecords.length > 1;
    var exampleSelectionKey = String(step.exampleSelectionKey || "details_example");
    var selectedExample = String(state.selections[exampleSelectionKey] || "");
    var mediaComposer = isDetailsMediaComposer(step);
    var example = exampleRecords.length ? [
      '<div class="details-example"' + (exampleVisible ? "" : " hidden") + '>',
      '<div class="details-example-grid' + (hasMultipleExamples ? ' is-multiple' : '') + '">',
      exampleRecords.map(function (record) {
        if (step.selectableExamples === true && record.value) {
          var selected = selectedExample === record.value;
          var choice = [
            '<button type="button" class="details-example-choice' + (selected ? ' is-selected' : '') + '" data-details-example-value="' + escapeHtml(record.value) + '" data-details-example-key="' + escapeHtml(exampleSelectionKey) + '" aria-pressed="' + (selected ? 'true' : 'false') + '">',
            '<img class="example-image" data-mia-image="' + escapeHtml(record.image) + '" src="' + escapeHtml(record.image) + '" alt="' + escapeHtml(record.alt) + '" loading="lazy">',
            '<span class="details-example-choice-copy"><strong>' + escapeHtml(record.title || record.value) + '</strong>' + (record.text ? '<small>' + escapeHtml(record.text) + '</small>' : '') + '</span>',
            '</button>'
          ].join("");
          return selected && record.drawerImages.length
            ? '<div class="quadros-design-choice quadros-details-example-drawer">' + choice + renderQuadroDesignDrawer(state.product, record) + '</div>'
            : choice;
        }
        return [
          '<button type="button" class="details-example-image-button" data-image-viewer-src="' + escapeHtml(record.image) + '" data-image-viewer-alt="' + escapeHtml(record.alt) + '" aria-label="Ver exemplo maior">',
          '<img class="example-image" data-mia-image="' + escapeHtml(record.image) + '" src="' + escapeHtml(record.image) + '" alt="' + escapeHtml(record.alt) + '" loading="lazy">',
          '</button>'
        ].join("");
      }).join(""),
      '</div>',
      '</div>'
    ].join("") : "";

    function closeSection(addon) {
      if (currentSection === null) {
        return;
      }
      html += '</div>';
      if (addon) {
        html += addon;
      }
      if (pendingAfterText) {
        html += '<p class="details-section-note">' + escapeHtml(pendingAfterText) + '</p>';
        pendingAfterText = "";
      }
      html += '</section>';
    }

    (step.fields || []).forEach(function (field, index) {
      var section = field.section || "";
      var isMissing = state.invalidFields.indexOf(field.name) !== -1;
      var sectionTextHtml = "";

      if (section !== currentSection) {
        closeSection();
        currentSection = section;

        if (field.sectionText && field.sectionTextAfter) {
          pendingAfterText = field.sectionText;
        } else if (field.sectionText) {
          sectionTextHtml = '<p>' + escapeHtml(field.sectionText) + '</p>';
        }

        html += [
          '<section class="details-section' + (field.sectionNoBorder ? ' details-section--no-rule' : '') + (mediaComposer ? ' details-section--media-composer' : '') + '">',
          section ? '<h3>' + escapeHtml(section) + '</h3>' : "",
          sectionTextHtml,
          '<div class="details-grid">'
        ].join("");
      } else if (field.sectionText && field.sectionTextAfter && !pendingAfterText) {
        // Permite definir o sectionTextAfter num campo que não é o
        // primeiro da secção (caso conveniente em JSON manual).
        pendingAfterText = field.sectionText;
      }

      html += [
        '<label>',
        field.label ? '<span>' + escapeHtml(field.label) + (field.required || field.hideOptionalLabel ? "" : " <small>(opcional)</small>") + '</span>' : '',
        renderDetailsFieldControl(field, isMissing),
        field.type === "textarea" && field.maxLength ? '<small class="details-character-count" data-character-count-for="' + escapeHtml(field.name) + '">' + String(state.selections[field.name] || "").length + ' / ' + escapeHtml(field.maxLength) + '</small>' : "",
        field.note ? '<small class="details-field-note">' + escapeHtml(field.note) + '</small>' : "",
        '</label>',
        adminFieldControls(step, field, index)
      ].join("");
    });

    var skipOption = step.skipOption && step.skipOption.selectionKey ? [
      '<label class="details-skip-choice">',
      '<input type="checkbox" data-details-skip-key="' + escapeHtml(step.skipOption.selectionKey) + '"' + (state.selections[step.skipOption.selectionKey] ? ' checked' : '') + '>',
      '<span>' + escapeHtml(step.skipOption.label || "Não quero preencher") + '</span>',
      '</label>'
    ].join("") : "";
    var attachments = step.mediaAttachments ? renderOrderMediaAttachments(step.mediaAttachments) : "";
    var formIntro = step.formHeading || step.formText ? [
      '<div class="details-form-intro">',
      step.formHeading ? '<h3>' + escapeHtml(step.formHeading) + '</h3>' : '',
      step.formText ? '<p>' + escapeHtml(step.formText) + '</p>' : '',
      '</div>'
    ].join("") : "";

    closeSection(mediaComposer ? attachments + skipOption : skipOption + attachments);

    var exampleBlock = [
      exampleRecords.length && !examplesAlwaysVisible ? '<button class="example-toggle" type="button" data-example-toggle>' + (exampleVisible ? (hasMultipleExamples ? "Ocultar exemplos" : "Ocultar exemplo") : (hasMultipleExamples ? "Ver exemplos" : "Ver exemplo")) + '</button>' : "",
      example
    ].join("");
    var privacy = isQuadrosProduct(state.product) ? "" : '<p class="privacy-note">Ao partilhar os teus dados, aceitas que estes sejam usados de acordo com a nossa <a href="privacy.html" target="_blank" rel="noopener">política de privacidade</a>.</p>';

    return step.examplesAfterForm
      ? html + exampleBlock + formIntro + privacy
      : exampleBlock + formIntro + html + privacy;
  }

  // DELIVERY_CONTACT_STEP_V1: novo passo "Entrega e contacto" que vive antes
  // do confirm. Junta numa única página: (1) escolha de entrega obrigatória
  // sem default visualmente seleccionado, (2) bloco "Dados de Contacto" com
  // ordem título → campos → texto explicativo (cumpre requisito global),
  // (3) reaproveita renderCrachasSelectedDesigns como "Designs que vais
  // receber". Os campos contact.fields são lidos/escritos directamente em
  // state.selections para o submit final acompanhar o JSON do produto.
  function renderDeliveryContactStep(product, step) {
    var deliveryConfig = step.delivery || {};
    var contactConfig = step.contact || {};
    return [
      '<section class="delivery-contact-step">',
      // OPEN_ORDER_HINT_V1: nota mostrada quando detectamos uma
      // encomenda aberta em SQLite que parece pertencer ao mesmo
      // utilizador (mesmo nome+contacto+IP). Detalhes em
      // check-open-orders.php — nunca expomos dados da encomenda anterior.
      renderDeliveryContactContact(contactConfig),
      renderOpenOrderHint(),
      renderDeliveryContactDelivery(product, deliveryConfig),
      isCadernosProduct(product) ? "" : renderDeliveryContactDesigns(product),
      '</section>'
    ].join("");
  }

  // OPEN_ORDER_HINT_V1
  function renderOpenOrderHint() {
    if (state.openOrderHint !== true) {
      return "";
    }
    return [
      '<aside class="open-order-hint" role="note" aria-label="Possível encomenda aberta">',
      '<strong>Parece que já tens uma encomenda em aberto.</strong>',
      '<span>Caso já tenhas feito uma encomenda que ainda não foi enviada, escolhe <em>"Junta as minhas encomendas"</em> para receberes todas as tuas encomendas na mesma embalagem.</span>',
      '</aside>'
    ].join("");
  }

  function renderDeliveryContactDelivery(product, config) {
    // Sem default visualmente seleccionado: lê state directo.
    var selected = state.selections.delivery_option || "";
    var optionsHtml = "";

    deliveryOptions(product).forEach(function (option) {
      var feeText = deliveryPriceText(option);
      var isSelected = option.id === selected;
      // OPEN_ORDER_HINT_V1: realçar visualmente a opção "Junta as minhas
      // encomendas" quando temos sinal de encomenda aberta do mesmo
      // utilizador. Nunca revelamos detalhes da encomenda anterior — só
      // damos uma sugestão.
      var suggestedClass = (state.openOrderHint === true && option.id === 'join_orders') ? ' is-suggested' : '';
      optionsHtml += [
        '<label class="dc-delivery-option' + (isSelected ? " is-selected" : "") + suggestedClass + '" data-track="true" data-track-action="select_delivery" data-track-id="delivery_' + escapeHtml(option.id) + '" data-track-label="' + escapeHtml(option.label) + '">',
        '<input type="radio" name="delivery_option_dc" value="' + escapeHtml(option.id) + '" data-delivery-option' + (isSelected ? " checked" : "") + '>',
        '<span class="dc-delivery-text">',
        '<strong>' + escapeHtml(option.label) + '</strong>',
        option.text ? '<em>' + escapeHtml(option.text) + '</em>' : "",
        '</span>',
        '<b class="dc-delivery-price">' + escapeHtml(feeText) + '</b>',
        '</label>'
      ].join("");
    });

    return [
      '<section class="dc-block dc-delivery">',
      config.title ? '<h3 class="dc-block-title">' + escapeHtml(config.title) + '</h3>' : "",
      config.subtitle ? '<p class="dc-block-subtitle">' + escapeHtml(config.subtitle) + '</p>' : "",
      '<div class="dc-delivery-options">' + optionsHtml + '</div>',
      '</section>'
    ].join("");
  }

  function renderDeliveryContactContact(config) {
    var fields = (config.fields || []);
    var notesAfter = Array.isArray(config.notesAfter)
      ? config.notesAfter
      : (config.noteAfter ? [config.noteAfter] : []);
    var fieldsHtml = fields.map(function (field) {
      var isMissing = state.invalidFields.indexOf(field.name) !== -1;
      var inputMode = field.inputmode ? ' inputmode="' + escapeHtml(field.inputmode) + '"' : "";
      return [
        '<div class="dc-field">',
        '<label>',
        '<span>' + escapeHtml(field.label) + (field.required ? "" : " <small>(opcional)</small>") + '</span>',
        '<input class="' + (isMissing ? "is-missing" : "") + '" type="text" name="' + escapeHtml(field.name) + '" value="' + escapeHtml(state.selections[field.name] || "") + '" placeholder="' + escapeHtml(field.placeholder || "") + '" autocomplete="' + escapeHtml(field.autocomplete || "off") + '"' + inputMode + (field.required ? " required" : "") + (isMissing ? ' aria-invalid="true"' : "") + ' data-detail-field>',
        '</label>',
        field.note ? '<small class="dc-field-note">' + escapeHtml(field.note) + '</small>' : "",
        '</div>'
      ].join("");
    }).join("");

    return [
      '<section class="dc-block dc-contact">',
      config.title ? '<h3 class="dc-block-title">' + escapeHtml(config.title) + '</h3>' : "",
      '<div class="dc-contact-grid">' + fieldsHtml + '</div>',
      // Phase B: texto explicativo aparece DEPOIS dos campos.
      notesAfter.map(function (note) {
        return '<p class="dc-block-note">' + escapeHtml(note) + '</p>';
      }).join(""),
      '</section>'
    ].join("");
  }

  function renderDeliveryContactDesigns(product) {
    // Reaproveita o componente "Designs que vais encomendar" — mas com o
    // título adaptado ao novo contexto ("Designs que vais receber").
    var items = selectedDesignItems(product);
    var showQuantityBadges = product && productFamily(product) === "crachas";
    var designsStep;
    var tilesHtml;

    if (isCustomArtworkSelected(product)) {
      var custom = customArtworkConfig(product);
      var uploads = orderUploadItems(custom.uploadKey);
      var visual = uploads.length
        ? '<span class="quadros-summary-photo"><img src="' + escapeHtml(orderUploadPreviewUrl(uploads[0])) + '" alt="Imagem enviada para personalização"></span>'
        : '<span class="quadros-summary-note" aria-hidden="true">' + ICON_PHOTO + '</span>';
      tilesHtml = [
        '<article class="crachas-step2-summary-tile">',
        visual,
        '<span class="crachas-step2-summary-tile-name">' + escapeHtml(uploads.length ? "Imagem enviada" : "Ajuda com a imagem") + '</span>',
        '</article>',
        '<article class="crachas-step2-summary-tile quadros-summary-tile">',
        '<span class="quadros-summary-text">' + escapeHtml(String(getPackQuantity(product))) + '</span>',
        '<span class="quadros-summary-tile-label">' + escapeHtml(productQuantityLabel(product, getPackQuantity(product))) + '</span>',
        '<span class="crachas-step2-summary-tile-name">' + escapeHtml(selectedSizeLabel(product)) + '</span>',
        '</article>'
      ].join("");
      return [
        '<section class="crachas-step2-summary dc-designs" aria-label="O que vais encomendar">',
        '<h3 class="crachas-step2-summary-title">O que vais encomendar:</h3>',
        '<div class="crachas-step2-summary-grid">' + tilesHtml + '</div>',
        '</section>'
      ].join("");
    }

    if (!items.length) {
      return "";
    }

    designsStep = findStep(product, "designs");
    tilesHtml = items.map(function (item) {
      var quantity = quantityFor(item.value);
      var visual = renderVisual(item, "design-grid", designsStep);

      if (showQuantityBadges && quantity > 0) {
        visual = [
          '<span class="quantity-visual-wrap dc-design-quantity-wrap">',
          visual,
          '<span class="quantity-badge">x' + quantity + '</span>',
          '</span>'
        ].join("");
      }

      return [
        '<article class="crachas-step2-summary-tile">',
        visual,
        '<span class="crachas-step2-summary-tile-name">' + escapeHtml(displayItemTitle(item)) + '</span>',
        '</article>'
      ].join("");
    }).join("");

    return [
      '<section class="crachas-step2-summary dc-designs" aria-label="Designs que vais receber">',
      '<h3 class="crachas-step2-summary-title">' + (isCadernosProduct(product) ? "Capa escolhida:" : "Designs que vais receber:") + '</h3>',
      '<div class="crachas-step2-summary-grid">' + tilesHtml + '</div>',
      '</section>'
    ].join("");
  }

  function designQuantityText(product) {
    return selectedDesignItems(product).map(function (item) {
      return item.title + " (" + item.subtitle + ") x" + quantityFor(item.value);
    }).join(", ");
  }

  function selectedSizeLabel(product) {
    var step = findStep(product, "size");
    var selected = state.selections.size || "";
    var item = step && step.items ? step.items.filter(function (candidate) {
      return candidate.value === selected;
    })[0] : null;
    var title = item ? String(item.title || "").replace(/^(Pin|Crachá)\s+/i, "") : "";

    if (!selected) {
      return "";
    }

    return title && title.toLocaleLowerCase("pt-PT") !== String(selected).toLocaleLowerCase("pt-PT")
      ? title + " (" + selected + ")"
      : selected;
  }

  // PRICE_SHIPPING_BREAKDOWN_V1: helper que devolve a estrutura de preços
  // para apresentar de forma transparente. Mantém os cents brutos para
  // gravação em SQLite (subtotal/shipping/total) e devolve strings já
  // formatadas para a UI.
  function priceBreakdown(product) {
    var info = priceInfo(product);
    var delivery = getDeliveryOption(product) || { id: '', label: '' };
    var subtotalCents = info.cents || 0;
    var shippingCents = deliveryFeeCents(delivery);
    var isShipping = delivery.id === 'shipping';
    var isEstimate = isShipping; // só CTT é estimativa; recolha/juntar são certos
    var shippingLabel = isShipping ? 'estimativa de portes CTT' : 'portes';
    var shippingText = shippingCents > 0
      ? formatCents(shippingCents)
      : 'Grátis';

    return {
      subtotalCents: subtotalCents,
      shippingCents: shippingCents,
      totalCents: subtotalCents + shippingCents,
      subtotal: subtotalCents ? formatCents(subtotalCents) : '',
      shipping: shippingText,
      shippingLabel: shippingLabel,
      total: subtotalCents ? formatCents(subtotalCents + shippingCents) : '',
      perPin: info.perPin,
      discount: info.discount,
      isShipping: isShipping,
      isEstimate: isEstimate,
      deliveryLabel: delivery.label || ''
    };
  }

  // CONFIRM_REFORMAT_V1 + PRICE_SHIPPING_BREAKDOWN_V1: o resumo agora mostra
  // preço do produto + portes + total separadamente. Para "Vou recolher" ou
  // "Junta as minhas encomendas" os portes aparecem como "Grátis"; para
  // "Envio CTT" aparecem como estimativa.
  function summarySections(product) {
    var info = priceInfo(product);
    var deliveryOption = getDeliveryOption(product);
    var deliveryText = deliveryOption.label;
    var pb = priceBreakdown(product);

    if (isQuadrosProduct(product)) {
      var quadroType = selectedDesignItems(product)[0];
      var quadroTypeValue = quadroType ? quadroType.value : "";
      var quadroWithPhoto = quadroTypeValue === "Foto e Frase";
      var quadroIsSuper = quadroTypeValue === "Super Personalizado";
      var quadroIsBaby = quadroTypeValue === "Quadro para bebé";
      var quadroUploads = orderUploadItems("quadro_uploads");
      var quadroReferenceUploads = orderUploadItems("quadro_reference_uploads");
      var quadroAudioUploads = orderUploadItems("quadro_audio_uploads");
      var quadroSilhouetteUploads = orderUploadItems("quadro_silhouette_uploads");
      var quadroSilhouetteAudioUploads = orderUploadItems("quadro_silhouette_audio_uploads");
      var quadroColorStep = findStep(product, "colors");
      var quadroBackgroundColorStep = findStep(product, "heart_background_colors");
      var quadroColorText = quadroColorSelectionText(quadroColorStep);
      var quadroBackgroundColorText = quadroTypeValue === "Coração e Frase"
        ? quadrosColorSelectionText(quadroBackgroundColorStep)
        : "";
      var quadroTextLabel = quadroTypeValue === "O Amor Nunca Acaba"
        ? "Dedicatória:"
        : (quadroTypeValue === "Silhueta e Frase" ? "Texto em vinil:" : "Frase em vinil:");
      var quadroTextValue = quadroTypeValue === "O Amor Nunca Acaba"
        ? (state.selections.no_dedication ? "Sem dedicatória" : state.selections.quadro_dedication || "")
        : (quadroTypeValue === "Silhueta e Frase"
          ? (state.selections.no_text ? "Sem texto" : state.selections.quadro_text || "")
          : (state.selections.no_phrase ? "Sem frase" : state.selections.quadro_text || ""));
      var quadroOrderRows = [
        ["Tipo:", quadroType ? displayItemTitle(quadroType) : ""],
        ["Foto:", quadroWithPhoto ? (quadroUploads.length ? (quadroUploads.length === 1 ? "Enviada" : quadroUploads.length + " enviadas") : (state.selections.photo_help ? "Precisa de ajuda para enviar" : "")) : ""],
        ["Orientação da moldura:", quadroWithPhoto ? state.selections.photo_orientation || "" : ""],
        ["Silhueta:", state.selections.silhouette || ""],
        ["Acabamento do coração:", quadroTypeValue === "Coração e Frase" ? state.selections.heart_finish || "" : ""],
        ["Animal:", quadroIsBaby ? state.selections.baby_animal || "" : ""],
        ["Menino ou menina:", quadroIsBaby ? state.selections.baby_gender || "" : ""],
        ["Nome da criança:", quadroIsBaby ? state.selections.baby_name || "" : ""],
        ["Data de nascimento:", quadroIsBaby ? state.selections.baby_birth_date || "" : ""],
        ["Hora de nascimento:", quadroIsBaby ? state.selections.baby_birth_time || "" : ""],
        ["Peso à nascença:", quadroIsBaby ? state.selections.baby_birth_weight || "" : ""],
        ["Cores:", quadroIsSuper ? "" : quadroColorText],
        ["Cor do fundo:", quadroBackgroundColorText],
        [quadroTextLabel, quadroIsSuper || quadroIsBaby ? "" : quadroTextValue],
        ["Descrição da silhueta:", state.selections.silhouette === "Outra silhueta" ? state.selections.quadro_silhouette_description || "" : ""],
        ["Contacto para explicar a silhueta:", state.selections.silhouette === "Outra silhueta" && state.selections.silhouette_contact_me ? "Sim" : ""],
        ["Sugestão escolhida:", quadroIsSuper ? state.selections.quadro_super_example || "" : ""],
        ["Descrição:", quadroIsSuper ? state.selections.quadro_description || "" : ""],
        ["Tamanho da moldura:", info.frameSize || ""],
        ["Proteção e embrulho:", selectedQuadroPackaging(product) ? selectedQuadroPackaging(product).title || state.selections.packaging || "" : ""],
        ["Fotos de referência:", quadroReferenceUploads.length ? String(quadroReferenceUploads.length) : ""],
        ["Silhueta enviada:", quadroSilhouetteUploads.length ? "Sim" : ""],
        ["Áudios sobre a silhueta:", quadroSilhouetteAudioUploads.length ? String(quadroSilhouetteAudioUploads.length) : ""],
        ["Áudios:", quadroAudioUploads.length ? String(quadroAudioUploads.length) : ""],
        [info.priceToConfirm ? "Preço previsto:" : "Preço do produto:", info.total || ""]
      ];
      var quadroDeliveryRows = [
        [pb.shippingCents > 0 ? "Portes estimados:" : "Portes:", pb.shippingCents > 0 ? pb.shipping : (pb.subtotal ? "Grátis" : "")],
        [pb.isEstimate ? "Total estimado:" : "Total:", pb.subtotal ? pb.total : ""],
        ["Entrega:", deliveryText || ""]
      ];
      var quadroContactRows = [
        ["Nome de contacto:", state.selections.customer_name || ""],
        ["Contacto:", state.selections.customer_contact || ""],
        ["NIF:", state.selections.customer_nif || "Não indicado"]
      ];
      var quadroKeep = function (row) { return row[1] !== ""; };

      return [
        quadroOrderRows.filter(quadroKeep),
        quadroDeliveryRows.filter(quadroKeep),
        quadroContactRows.filter(quadroKeep)
      ].filter(function (section) { return section.length > 0; });
    }

    if (isCadernosProduct(product)) {
      var cover = selectedCadernoCover(product);
      var lamination = selectedCadernoLamination(product);
      var addOnLabels = cadernoAddOnsLabels(product);
      var option = selectedCadernoPurchaseOption(product);
      var personalization = state.selections.cover_personalization === "yes";
      var personalizationStep = cadernoPersonalizationStep(product);
      var promo = option && option.isPack ? cadernoPromoNote(product) : "";
      var cadernoPriceText = cadernoPriceEquation(info);
      var cadernoShippingLine = pb.shippingCents > 0
        ? pb.shipping + " (estimativa CTT, valor mínimo)"
        : (pb.subtotal ? "Grátis" : "");
      var cadernoTotalLabel = pb.isEstimate ? "Total estimado:" : "Total:";
      if (deliveryOption.text) {
        deliveryText += " - " + deliveryOption.text;
      }

      var cadernoOrderRows = [
        ["Capa escolhida:", cover ? displayItemTitle(cover) : ""],
        ["Laminação escolhida:", lamination ? lamination.title : ""],
        ["Add-ons:", addOnLabels.join(", ")],
        ["Opção escolhida:", option ? option.title : ""]
      ];
      var cadernoPriceRows = [
        ["Preço:", cadernoPriceText],
        ["Acréscimo dos add-ons:", info.addOnsSubtotal || ""],
        ["Inclui:", option && option.includes ? option.includes : ""],
        ["Personalização da capa:", personalization ? "Sim" : "Não"],
        ["Nome/frase:", personalization ? cadernoPersonalizationText() : ""],
      ];
      var cadernoDeliveryRows = [
        ["Portes:", cadernoShippingLine],
        [cadernoTotalLabel, pb.total],
        ["Entrega:", deliveryText],
        ["Nota do Pack:", promo],
        ["Nota:", personalization && option && option.isPack && personalizationStep && personalizationStep.note ? personalizationStep.note : ""]
      ];
      var cadernoContactRows = [
        ["Nome de contacto:", state.selections.customer_name || ""],
        ["Contacto:", state.selections.customer_contact || ""],
        ["NIF:", state.selections.customer_nif || "Não indicado"]
      ];
      var cadernoKeep = function (row) { return row[1] !== ""; };

      return [
        cadernoOrderRows.filter(cadernoKeep),
        cadernoPriceRows.filter(cadernoKeep),
        cadernoDeliveryRows.filter(cadernoKeep),
        cadernoContactRows.filter(cadernoKeep)
      ].filter(function (section) {
        return section.length > 0;
      });
    }

    if (deliveryOption.text) {
      deliveryText += " - " + deliveryOption.text;
    }

    var priceLine = pb.subtotal
      ? pb.subtotal + (pb.perPin ? ", ou seja: " + String(pb.perPin).replace(/\s*\/\s*/, " por cada ") : "")
        + (pb.discount > 0 ? " (devido aos " + pb.discount + "% de desconto)" : "")
      : "";

    var shippingLine = pb.shippingCents > 0
      ? pb.shipping + " (estimativa CTT, valor mínimo)"
      : (pb.subtotal ? "Grátis" : "");

    var totalLabel = pb.isEstimate ? "Total estimado:" : "Total:";
    var totalLine = pb.subtotal ? pb.total : "";

    var orderRows = [
      ["Encomendaste:", getPackQuantity(product) ? productQuantityLabel(product, getPackQuantity(product)) : ""],
      ["Tamanho:", selectedSizeLabel(product)]
    ].concat(optionDrawerSummaryRows(product), [
      ["Preço do produto:", priceLine],
      ["Portes:", shippingLine],
      [totalLabel, totalLine],
      ["Entrega:", deliveryText]
    ]);

    var cardRows;
    if (isCustomArtworkSelected(product)) {
      var custom = customArtworkConfig(product);
      var artworkUploads = orderUploadItems(custom.uploadKey);
      var cardPhotoUploads = orderUploadItems(custom.cardPhotoKey);
      var cardAudioUploads = orderUploadItems(custom.cardAudioKey);
      cardRows = [
        ["Imagem:", artworkUploads.length ? "Enviada" : (state.selections[custom.helpKey] ? "Precisa de ajuda" : "")],
        ["Personalização do cartão:", state.selections[custom.cardField] || ""],
        ["Referências para o cartão:", cardPhotoUploads.length ? String(cardPhotoUploads.length) : ""],
        ["Áudios para o cartão:", cardAudioUploads.length ? String(cardAudioUploads.length) : ""],
        ["Oferta à congregação:", shouldShowGiftRequest(product) && state.selections.congregation_gift ? "Sim" : ""]
      ];
    } else {
      cardRows = [
        ["Nome para o cartão de apresentação:", state.selections.recipient_name || ""],
        ["Telemóvel ou Email:", state.selections.contact || "Não indicado"],
        ["Congregação:", state.selections.congregation || "Não indicado"],
        ["Oferta à congregação:", shouldShowGiftRequest(product) && state.selections.congregation_gift ? "Sim" : ""]
      ];
    }

    var contactRows = [
      ["Nome de contacto:", state.selections.customer_name || ""],
      ["Contacto:", state.selections.customer_contact || ""],
      ["NIF:", state.selections.customer_nif || "Não indicado"]
    ];

    var keep = function (row) { return row[1] !== ""; };

    return [
      orderRows.filter(keep),
      cardRows.filter(keep),
      contactRows.filter(keep)
    ].filter(function (section) {
      return section.length > 0;
    });
  }

  // Mantém-se exportada para qualquer caller externo (admin etc.) — agora
  // delega em summarySections e devolve uma lista plana equivalente.
  function summaryRows(product) {
    var rows = [];
    summarySections(product).forEach(function (section) {
      section.forEach(function (row) { rows.push(row); });
    });
    return rows;
  }

  function renderConfirmCard(product) {
    var hasPack = !!findStep(product, "pack");
    var confirmTitle = product && productFamily(product) === "crachas" ? '<h3 class="confirm-card-title">A tua encomenda:</h3>' : "";
    var designs;

    if (isCadernosProduct(product) || isQuadrosProduct(product) || isCustomArtworkSelected(product)) {
      designs = "";
    } else {
      designs = isAssortedSelected(product)
        ? '<div class="confirm-design-row confirm-design-row--assorted"><strong>Designs: Sortido</strong><span>A Mia vai escolher uma combinação de designs de acordo com a quantidade que escolheste.</span></div>'
        : selectedDesignItems(product).map(function (item) {
          return [
            '<div class="confirm-design-row">',
            renderVisual(item, "design-grid", findStep(product, "designs")),
            '<strong>' + escapeHtml(displayItemTitle(item)) + '</strong>',
            hasPack ? '<span>x' + quantityFor(item.value) + '</span>' : "",
            '</div>'
          ].join("");
        }).join("");
    }

    var sectionsHtml = summarySections(product).map(function (section) {
      return [
        '<dl class="confirm-list">',
        section.map(function (row) {
          return '<div><dt>' + escapeHtml(row[0]) + '</dt><dd>' + escapeHtml(row[1]) + '</dd></div>';
        }).join(""),
        '</dl>'
      ].join("");
    }).join('<hr class="confirm-divider" aria-hidden="true">');

    return [
      '<section class="confirm-card' + (isCadernosProduct(product) ? ' cadernos-confirm-card' : '') + '" aria-label="Resumo do pedido">',
      confirmTitle,
      designs,
      sectionsHtml,
      '</section>'
    ].join("");
  }

  // CONFIRM_REFORMAT_V1: caixa de aviso de pagamento, mostrada só no passo
  // de confirmação imediatamente antes do botão "Enviar pedido". Não
  // bloqueia o submit — apenas informa que a encomenda só começa a ser
  // preparada após confirmação do pagamento (combinado por contacto após
  // envio do pedido).
  function renderPaymentNotice() {
    return [
      '<aside class="payment-notice" role="note" aria-label="Informação sobre pagamento">',
      '<strong>A encomenda só começa a ser preparada após confirmação do pagamento.</strong>',
      '<span>Depois de enviares o pedido, a Mia entra em contacto contigo com os dados para pagamento.</span>',
      '</aside>'
    ].join("");
  }

  function renderConfirm(product) {
    // CONFIRM_REFORMAT_V1: no passo de confirmação não mostramos o picker
    // de entrega (já foi escolhido no passo "Entrega e contacto"). O painel
    // de preço continua para mostrar o total/desconto.
    return [
      renderConfirmCard(product),
      renderPaymentNotice(),
      renderPricePanel(product, { hideDelivery: true })
    ].join("");
  }

  // COPY_REQUEST_AUTOCHECK_V1: a checkbox "Enviar uma cópia deste pedido
  // para o meu email" agora vem pré-seleccionada automaticamente quando
  // customer_contact é um email válido (e não um telemóvel). Só faz auto-tick
  // quando o utilizador ainda não interagiu manualmente com a checkbox
  // (state.selections.send_copy_touched === false). Se o utilizador
  // desactivar a checkbox manualmente, a flag fica em true e a auto-selecção
  // não a volta a ligar.
  function renderCopyRequest() {
    var contactValue = String(state.selections.customer_contact || "").trim();
    var contactIsEmail = isValidEmail(contactValue);

    if (!state.selections.send_copy_touched && contactIsEmail && state.selections.send_copy !== true) {
      state.selections.send_copy = true;
    }

    if (state.selections.send_copy && !state.selections.copy_email && contactIsEmail) {
      state.selections.copy_email = contactValue;
    }

    var checked = state.selections.send_copy ? " checked" : "";

    return [
      '<div class="copy-request">',
      '<label>',
      '<input type="checkbox" data-copy-toggle' + checked + '>',
      '<span>Enviar uma cópia deste pedido para o meu email</span>',
      '</label>',
      state.selections.send_copy ? '<input type="text" data-copy-email placeholder="O teu email" value="' + escapeHtml(state.selections.copy_email || "") + '" autocomplete="email">' : "",
      '</div>'
    ].join("");
  }

  function shouldShowGiftRequest(product) {
    if (hideGiftRequestForSelection(product)) {
      state.selections.congregation_gift = false;
      return false;
    }

    return getPackQuantity(product) >= 12;
  }

  function giftRequestSettings(product) {
    var gift = product && product.giftRequest ? product.giftRequest : {};

    return {
      label: gift.label || "Penso oferecer estes artigos a pessoas da minha congregação.",
      text: gift.text || "Escolhe esta opção se quiseres que a Mia te ajude a escolher designs únicos para a tua congregação."
    };
  }

  function renderGiftRequest(product) {
    var checked = state.selections.congregation_gift ? " checked" : "";
    var gift = giftRequestSettings(product);

    if (!shouldShowGiftRequest(product)) {
      state.selections.congregation_gift = false;
      return "";
    }

    return [
      '<div class="gift-request">',
      '<label>',
      '<input type="checkbox" data-gift-toggle' + checked + '>',
      '<span>' + escapeHtml(gift.label) + '</span>',
      '</label>',
      '<p>' + escapeHtml(gift.text) + '</p>',
      '</div>'
    ].join("");
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  // CONTACT_VALIDATION_V1: se tiver @, valida como email básico. Sem @,
  // trata como telefone e exige pelo menos 9 dígitos depois de limpar
  // espaços, +, parênteses e hífenes.
  function validateContactInput(rawValue) {
    var value = String(rawValue || "").trim();
    var error = "Indica um email ou telemóvel válido para podermos confirmar a encomenda.";
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var phoneDigits;

    if (!value) {
      // Vazio cai no fluxo de "campo obrigatório" gerido no validateStep,
      // não emitimos mensagem específica aqui para não duplicar erros.
      return "";
    }

    if (value.indexOf("@") !== -1) {
      return emailRegex.test(value) ? "" : error;
    }

    phoneDigits = value.replace(/[\s+()-]/g, "");

    return /^\d{9,}$/.test(phoneDigits) ? "" : error;
  }

  function validNifInput(value) {
    var trimmed = String(value || "").trim();
    return !trimmed || /^\d{9}$/.test(trimmed);
  }

  function selectedInteriorImages(product) {
    var selected = selectedDesignItems(product)[0];
    var common = cadernoCommonInteriorImages(product);

    if (common.length) {
      return common;
    }

    if (!selected || !Array.isArray(selected.interiorImages)) {
      return [];
    }

    return selected.interiorImages.filter(Boolean);
  }

  function renderInteriorSlideshow(product) {
    var settings = product && product.interiorPreview ? product.interiorPreview : {};
    var images = selectedInteriorImages(product);
    var speed = cadernoPreviewSpeedSeconds(product);

    if (!isCadernosProduct(product) || settings.enabled === false || !images.length) {
      return "";
    }

    return [
      '<aside class="interior-slideshow" style="--interior-slide-count:' + images.length + ';--interior-slide-speed:' + speed + 's" aria-label="' + escapeHtml(settings.title || "Pré-visualização do interior") + '">',
      '<div class="interior-slideshow-frame">',
      images.map(function (image, index) {
        return '<span class="interior-slide" data-mia-image="' + escapeHtml(image) + '" data-mia-item-id="interior-preview-' + index + '" data-mia-slot-name="interior-slide" style="background-image:url(&quot;' + escapeHtml(image) + '&quot;);--interior-slide-index:' + index + '"></span>';
      }).join(""),
      '</div>',
      '<div class="interior-slideshow-copy">',
      '<strong>' + escapeHtml(settings.title || "Pré-visualização do interior") + '</strong>',
      settings.text ? '<p>' + escapeHtml(settings.text) + '</p>' : "",
      '</div>',
      '</aside>'
    ].join("");
  }

  function optionDrawerUiKey(step, drawer) {
    return String(step && step.id || "opcoes") + "::" + String(drawer && (drawer.id || drawer.field) || "gaveta");
  }

  function renderOptionDrawerChoice(product, step, drawer, item) {
    var selected = String(state.selections[drawer.field] || "") === String(item.value || "");
    var extra = Math.max(0, parseInt(item.extraPriceCentsPerUnit, 10) || 0);

    return [
      '<label class="option-drawer-choice' + (selected ? ' is-selected' : '') + '">',
      '<input type="radio" name="' + escapeHtml(drawer.field) + '" value="' + escapeHtml(item.value || "") + '" data-option-drawer-choice data-option-drawer-field="' + escapeHtml(drawer.field) + '"' + (selected ? ' checked' : '') + '>',
      renderVisual(item, "media-list", step),
      '<span class="option-drawer-choice-copy"><strong>' + escapeHtml(item.title || item.value || "Opção") + '</strong>' + (item.subtitle ? '<small>' + escapeHtml(item.subtitle) + '</small>' : '') + '</span>',
      '<span class="option-drawer-choice-price">' + (extra ? '+ ' + escapeHtml(formatCents(extra)) + '<small>por ' + escapeHtml(productUnitSingular(product)) + '</small>' : '<small>Sem acréscimo</small>') + '</span>',
      '<span class="option-drawer-choice-check" aria-hidden="true">' + ICON_CHECK + '</span>',
      '</label>'
    ].join("");
  }

  // OPTION_DRAWERS_CARDS_V1: a mesma gaveta de opcoes, mas apresentada como os
  // passos do acabamento e do tamanho — um cartao por opcao e uma gaveta que
  // abre por baixo do escolhido com a imagem. Liga-se com "display": "cards"
  // no passo, para as gavetas dos marcadores ficarem como estavam.
  function renderOptionDrawerCard(product, step, drawer, item) {
    var selected = String(state.selections[drawer.field] || "") === String(item.value || "");
    var extra = Math.max(0, parseInt(item.extraPriceCentsPerUnit, 10) || 0);

    return [
      '<div class="cadernos-add-on-choice option-drawer-card-choice">',
      '<label class="choice-card crachas-size-card cadernos-add-on-card' + (selected ? ' is-selected' : '') + '">',
      '<input type="radio" name="' + escapeHtml(drawer.field) + '" value="' + escapeHtml(item.value || "") + '" data-option-drawer-choice data-option-drawer-field="' + escapeHtml(drawer.field) + '"' + (selected ? ' checked' : '') + '>',
      '<span class="crachas-size-card-visual">' + renderVisual(item, "media-list", step) + '</span>',
      '<span class="choice-copy crachas-size-card-text">',
      '<strong>' + escapeHtml(item.title || item.value || "Opção") + '</strong>',
      item.subtitle ? '<span>' + escapeHtml(item.subtitle) + '</span>' : "",
      '</span>',
      '<span class="cadernos-purchase-price">' + (extra ? '+' + escapeHtml(formatCents(extra)) : 'Incluído') + '</span>',
      '<span class="crachas-size-card-selected" aria-hidden="true">✓</span>',
      '</label>',
      selected ? renderCadernoAddOnDrawer(item) : "",
      '</div>'
    ].join("");
  }

  function renderOptionDrawerCards(product, step) {
    ensureOptionDrawerSelections(product);

    return (step.drawers || []).map(function (drawer) {
      // Com uma gaveta so, o titulo do passo ja diz o que se escolhe; com
      // varias, cada grupo precisa do seu cabecalho para nao se misturarem.
      var heading = (step.drawers || []).length > 1
        ? '<h3 class="option-drawer-cards-title">' + escapeHtml(drawer.title || drawer.label || "Opção") + '</h3>'
        : "";

      return heading + '<div class="option-list size-choice-list crachas-size-card-list cadernos-add-on-list">'
        + (drawer.items || []).map(function (item) {
          return renderOptionDrawerCard(product, step, drawer, item);
        }).join("")
        + '</div>';
    }).join("");
  }

  function renderOptionDrawers(product, step) {
    ensureOptionDrawerSelections(product);

    return '<div class="option-drawer-list">' + (step.drawers || []).map(function (drawer) {
      var selected = optionDrawerItem(drawer, state.selections[drawer.field]);
      var selectedExtra = selected ? Math.max(0, parseInt(selected.extraPriceCentsPerUnit, 10) || 0) : 0;
      var key = optionDrawerUiKey(step, drawer);
      var open = state.optionDrawerOpen && state.optionDrawerOpen[key] === true;

      return [
        '<details class="option-drawer' + (selected ? ' has-selection' : '') + '" data-option-drawer="' + escapeHtml(key) + '"' + (open ? ' open' : '') + '>',
        '<summary class="option-drawer-summary">',
        selected ? renderVisual(selected, "media-list", step) : '<span class="option-image neutral" aria-hidden="true"></span>',
        '<span class="option-drawer-summary-copy"><strong>' + escapeHtml(drawer.title || drawer.label || "Opção") + '</strong><small>' + escapeHtml(selected ? (selected.title || selected.value) : "Escolhe uma opção") + '</small></span>',
        '<span class="option-drawer-summary-price">' + (selectedExtra ? '+ ' + escapeHtml(formatCents(selectedExtra)) + '<small>por ' + escapeHtml(productUnitSingular(product)) + '</small>' : '<small>Incluído</small>') + '</span>',
        '<span class="option-drawer-chevron" aria-hidden="true"></span>',
        '</summary>',
        '<div class="option-drawer-body" role="radiogroup" aria-label="' + escapeHtml(drawer.label || drawer.title || "Opção") + '">',
        (drawer.items || []).map(function (item) {
          return renderOptionDrawerChoice(product, step, drawer, item);
        }).join(""),
        '</div>',
        '</details>'
      ].join("");
    }).join("") + '</div>';
  }

  function stepBody(product, step) {
    if (isQuadrosProduct(product) && step.id === "designs") {
      return renderQuadrosDesignStep(product, step);
    }

    if (isCadernosProduct(product) && step.id === "designs") {
      return renderCadernosCoverStep(product, step);
    }

    if (isCadernosProduct(product) && step.id === "lamination") {
      return renderCadernosLaminationStep(product, step) + renderCadernosBuildSummaryV2(product, step);
    }

    if (isCadernosProduct(product) && step.template === "add-ons") {
      return renderCadernosAddOnsStep(product, step) + renderCadernosBuildSummaryV2(product, step);
    }

    if (step.template === "original-artwork-upload") {
      return renderOriginalArtworkUploadStep(product, step);
    }

    if (step.template === "custom-product-builder") {
      return renderCustomProductBuilderStep(product);
    }

    if (step.template === "custom-quantity-builder") {
      return renderCustomQuantityBuilderStep(product);
    }

    if (isCadernosProduct(product) && step.id === "pack") {
      return renderCadernosPurchaseOptions(product, step) + renderInteriorSlideshow(product) + renderCadernosBuildSummaryV2(product, step);
    }

    if (isCadernosProduct(product) && step.template === "cover-personalization") {
      return renderCadernoPersonalizationStep(product, step) + renderCadernosBuildSummaryV2(product, step);
    }

    if (step.template === "quantity-builder") {
      return renderInteriorSlideshow(product) + renderQuantityBuilder(product);
    }

    if (step.template === "option-drawers" && step.display === "cards") {
      return renderOptionDrawerCards(product, step)
        + (isCadernosProduct(product) ? renderCadernosBuildSummaryV2(product, step) : "");
    }

    if (step.template === "option-drawers") {
      return renderOptionDrawers(product, step);
    }

    if (step.template === "palette-grid") {
      return renderPaletteGrid(product, step);
    }

    if (step.template === "photo-upload") {
      return renderPhotoUploadStep(step);
    }

    if (step.template === "details-form") {
      return renderDetailsForm(step);
    }

    if (step.template === "delivery-contact") {
      return renderDeliveryContactStep(product, step) + (isCadernosProduct(product) ? renderCadernosBuildSummaryV2(product, step) : "");
    }

    if (step.template === "confirm") {
      return renderConfirm(product);
    }

    if (step.id === "size") {
      // CRACHAS_STEP2_SIZE_LAYOUT_V1: nos crachas o passo 2 ficou "Escolhe o
      // tamanho" e a UI foi redesenhada para focar so na escolha (cartoes
      // maiores com moldura editavel a direita) e por baixo um resumo
      // compacto dos designs sem quantidades.
      // IMANES_STEP2_SUMMARY_REUSE_V1: imanes usa o layout de tamanho generico
      // mas reaproveita o sumario "Designs que vais encomendar" dos crachas
      // (tiles em grelha 1-5 colunas conforme largura). Outros produtos
      // mantem o sumario antigo de pilulas.
      if (product && productFamily(product) === "crachas") {
        return renderCrachasSizeStep(product, step);
      }
      if (product && productFamily(product) === "imanes") {
        return renderSizeChoiceItems(product, step) + renderCrachasSelectedDesigns(product);
      }
      return renderSizeChoiceItems(product, step) + renderSelectedSummary(product);
    }

    return renderChoiceItems(product, step, step.template) + (step.mediaAttachments ? renderOrderMediaAttachments(step.mediaAttachments) : "");
  }

  function stepConditionMatches(step) {
    var condition = step && step.when;
    var value;

    if (!condition || !condition.field) {
      return true;
    }

    value = state.selections[condition.field];
    if (Object.prototype.hasOwnProperty.call(condition, "equals")) {
      return Array.isArray(value)
        ? value.indexOf(condition.equals) !== -1
        : value === condition.equals;
    }

    if (Array.isArray(condition.in)) {
      return Array.isArray(value)
        ? value.some(function (entry) { return condition.in.indexOf(entry) !== -1; })
        : condition.in.indexOf(value) !== -1;
    }

    if (Object.prototype.hasOwnProperty.call(condition, "notEquals")) {
      return Array.isArray(value)
        ? value.indexOf(condition.notEquals) === -1
        : value !== condition.notEquals;
    }

    return true;
  }

  function visibleSteps(product) {
    var steps = product && Array.isArray(product.steps) ? product.steps : [];

    return state.admin ? steps : steps.filter(function (step) {
      if (isCustomArtworkSelected(product) && !isCadernosProduct(product) && step && step.id === "pack" && step.freeQuantity === true) {
        return false;
      }
      return !step.hidden && stepConditionMatches(step);
    });
  }

  function progressSteps(product) {
    var steps = state.admin ? visibleSteps(product) : productCartSteps(product);
    var placeholderCount = !state.admin && isQuadrosProduct(product) && !state.selections.designs
      ? Math.max(0, Number(product.initialProgressSteps) || 0)
      : 0;

    if (placeholderCount > steps.length) {
      steps = steps.concat(Array.from({ length: placeholderCount - steps.length }, function (_, index) {
        return { id: "progress-placeholder-" + index, label: "Passo seguinte", progressPlaceholder: true };
      }));
    }

    return steps.length ? steps : visibleSteps(product);
  }

  function displayStepNumber(product, step) {
    var steps = progressSteps(product);
    var index = steps.indexOf(step);

    return index >= 0 ? index + 1 : state.currentStep + 1;
  }

  function numberedProgressSteps(product) {
    if (!state.admin && isQuadrosProduct(product) && !state.selections.designs) {
      return visibleSteps(product).slice(0, 1);
    }
    return state.admin ? visibleSteps(product) : productCartSteps(product);
  }

  function renderStepNumbers(product) {
    var visibleNumber = 0;
    var visible = visibleSteps(product);
    var steps = numberedProgressSteps(product);

    return [
      '<ol class="step-list" aria-label="Progresso do pedido">',
      steps.map(function (step, index) {
        var classes = [];
        var isActive;
        var stepIndex = visible.indexOf(step);
        var isVisited;
        var disabled;

        stepIndex = stepIndex >= 0 ? stepIndex : index;
        isVisited = stepIndex <= state.maxVisitedStep;
        disabled = !state.admin && !isVisited;
        visibleNumber += 1;
        isActive = stepIndex === state.currentStep;

        if (isActive) {
          classes.push("is-active");
        }

        if (isVisited && !isActive) {
          classes.push("is-complete");
        }

        if (state.admin && step.hidden) {
          classes.push("is-hidden-step");
        }

        return [
          '<li class="' + classes.join(" ") + '" data-step-key="' + visibleNumber + '">',
          '<button type="button" data-jump-step="' + stepIndex + '" aria-label="Passo ' + visibleNumber + ': ' + escapeHtml(step.label) + '"' + (isActive ? ' aria-current="step"' : '') + (disabled ? " disabled" : "") + '>',
          '<span aria-hidden="true">' + visibleNumber + '</span>',
          '</button>',
          '</li>'
        ].join("");
      }).join(""),
      '</ol>'
    ].join("");
  }

  // STEP_NUMBERS_FLIP_V1: nas molduras a lista de passos começa só com o "1" e
  // só ganha os restantes quando se escolhe o design; trocar de design volta a
  // mudar quantos são. Sem animação os números trocavam de sítio de um frame
  // para o outro e parecia outra lista. Aqui os que já existiam deslizam para a
  // nova posição e os que entram brotam de debaixo do último que já lá estava
  // (na primeira abertura esse é o "1", ao centro, e por isso todos se abrem a
  // partir do centro).
  // Corre mesmo com prefers-reduced-motion — daí ser Web Animations e não CSS:
  // é o movimento que explica que são os mesmos passos, sem ele a lista muda de
  // conteúdo e de posição ao mesmo tempo e não se percebe o que aconteceu.
  var stepNumbersFlip = null;
  var STEP_NUMBERS_FLIP_EASING = "cubic-bezier(.34,1.28,.44,1)";
  var STEP_NUMBERS_FLIP_DURATION = 460;
  var STEP_NUMBERS_BIRTH_DELAY = 110;
  var STEP_NUMBERS_EXIT_DURATION = 320;

  // Medidas relativas à caixa da lista, nunca à janela: o resto da página muda
  // de altura entre passos e um rect absoluto faria a fila inteira deslizar na
  // vertical em cada render, quando o que interessa é só o rearranjo interno.
  function stepNumbersRect(item, listRect) {
    var rect = item.getBoundingClientRect();

    return {
      left: rect.left - listRect.left,
      top: rect.top - listRect.top,
      width: rect.width,
      height: rect.height
    };
  }

  function captureStepNumbersRects() {
    var list = document.querySelector(".step-list");
    var listRect;
    var entries = [];

    if (!list || !document.body.animate) {
      stepNumbersFlip = null;
      return;
    }
    listRect = list.getBoundingClientRect();
    list.querySelectorAll("li[data-step-key]").forEach(function (item) {
      entries.push({
        key: item.dataset.stepKey,
        rect: stepNumbersRect(item, listRect),
        node: item.cloneNode(true)
      });
    });
    stepNumbersFlip = entries.length ? entries : null;
  }

  function appendStepNumbersGhost(list, entry) {
    // O círculo que sai já não existe na lista nova: devolvemos o clone à lista
    // fora do fluxo (absolute) para recuar por baixo dos que ficaram sem mexer
    // no layout deles.
    var ghost = entry.node;
    var button = ghost.querySelector("button");

    ghost.removeAttribute("data-step-key");
    ghost.setAttribute("data-step-ghost", "");
    ghost.setAttribute("aria-hidden", "true");
    // É um clone (`cloneNode` não copia listeners), portanto se apanhar o rato
    // o clique morre ali. Fica sempre transparente ao ponteiro.
    ghost.style.pointerEvents = "none";
    ghost.style.position = "absolute";
    ghost.style.margin = "0";
    ghost.style.zIndex = "0";
    ghost.style.left = entry.rect.left + "px";
    ghost.style.top = entry.rect.top + "px";
    if (button) {
      button.setAttribute("tabindex", "-1");
    }
    list.appendChild(ghost);
    return ghost;
  }

  function playStepNumbersFlip() {
    var captured = stepNumbersFlip;
    var list = document.querySelector(".step-list");
    var previous = {};
    var items = [];
    var listRect;
    var birthRect;
    var survivorRect;

    stepNumbersFlip = null;
    if (!captured || !list || !document.body.animate) {
      return;
    }

    captured.forEach(function (entry) {
      previous[entry.key] = entry.rect;
    });
    listRect = list.getBoundingClientRect();
    list.querySelectorAll("li[data-step-key]").forEach(function (item) {
      items.push({ node: item, key: item.dataset.stepKey, rect: stepNumbersRect(item, listRect) });
    });
    if (!items.length || !items[0].rect.width) {
      return;
    }

    // Onde nascem os novos: o último círculo do render anterior.
    birthRect = captured[captured.length - 1].rect;
    // Para onde recuam os que saem: o último que sobreviveu, já na posição nova.
    survivorRect = items[items.length - 1].rect;

    items.forEach(function (item) {
      var from = previous[item.key];
      var dx;
      var dy;

      if (from) {
        dx = from.left - item.rect.left;
        dy = from.top - item.rect.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          return;
        }
        // Acima dos que nascem, para estes saírem mesmo de debaixo deles.
        item.node.style.zIndex = "1";
        item.node.animate(
          [
            { transform: "translate(" + dx + "px," + dy + "px)" },
            { transform: "translate(0,0)" }
          ],
          {
            duration: STEP_NUMBERS_FLIP_DURATION,
            easing: STEP_NUMBERS_FLIP_EASING,
            fill: "backwards"
          }
        );
        return;
      }

      dx = (birthRect.left + birthRect.width / 2) - (item.rect.left + item.rect.width / 2);
      dy = (birthRect.top + birthRect.height / 2) - (item.rect.top + item.rect.height / 2);
      item.node.style.zIndex = "0";
      item.node.animate(
        [
          { transform: "translate(" + dx + "px," + dy + "px) scale(.42)", opacity: 0 },
          { transform: "translate(" + (dx * 0.68).toFixed(2) + "px," + (dy * 0.68).toFixed(2) + "px) scale(.8)", opacity: 1, offset: 0.32 },
          { transform: "translate(0,0) scale(1)", opacity: 1 }
        ],
        {
          duration: STEP_NUMBERS_FLIP_DURATION,
          // Esperam que os antigos comecem a abrir alas; os mais afastados
          // saem por último, o que dá a leitura de leque a desdobrar-se.
          delay: STEP_NUMBERS_BIRTH_DELAY + Math.min(120, Math.round(Math.hypot(dx, dy) / 2.5)),
          easing: STEP_NUMBERS_FLIP_EASING,
          fill: "backwards"
        }
      );
    });

    captured.forEach(function (entry) {
      var stillHere = items.some(function (item) { return item.key === entry.key; });
      var ghost;
      var animation;
      var remove;
      var dx;
      var dy;

      if (stillHere) {
        return;
      }
      ghost = appendStepNumbersGhost(list, entry);
      dx = (survivorRect.left + survivorRect.width / 2) - (entry.rect.left + entry.rect.width / 2);
      dy = (survivorRect.top + survivorRect.height / 2) - (entry.rect.top + entry.rect.height / 2);
      remove = function () {
        if (ghost.parentNode) {
          ghost.parentNode.removeChild(ghost);
        }
      };
      animation = ghost.animate(
        [
          { transform: "translate(0,0) scale(1)", opacity: 1 },
          { transform: "translate(" + dx + "px," + dy + "px) scale(.42)", opacity: 0 }
        ],
        {
          duration: STEP_NUMBERS_EXIT_DURATION,
          easing: "cubic-bezier(.4,0,.3,1)",
          fill: "forwards"
        }
      );
      animation.addEventListener("finish", remove);
      // Rede de segurança: em separador em segundo plano o "finish" não dispara
      // e o fantasma ficava colado por cima da lista.
      window.setTimeout(remove, STEP_NUMBERS_EXIT_DURATION + 400);
    });
  }

  function progressVisualPercent(product, currentStepIndex) {
    var visible = visibleSteps(product);
    var steps = progressSteps(product);
    var activeStep = visible[currentStepIndex] || null;
    var activeIndex = steps.indexOf(activeStep);
    var percent;

    if (activeIndex < 0) {
      activeIndex = steps.length - 1;
    }
    percent = steps.length <= 1 ? 0 : Math.round((activeIndex / (steps.length - 1)) * 100);
    return activeIndex === 0 ? 5 : percent;
  }

  function renderProgress(product) {
    var visible = visibleSteps(product);
    var steps = progressSteps(product);
    var activeStep = visible[state.currentStep] || null;
    var activeIndex;
    var percent;
    var visualPercent;
    var animationFrom;
    var animateProgress;
    var label;

    if (!steps.length) {
      return "";
    }

    activeIndex = steps.indexOf(activeStep);
    if (activeIndex < 0) {
      activeIndex = steps.length - 1;
    }
    percent = steps.length <= 1 ? 0 : Math.round((activeIndex / (steps.length - 1)) * 100);
    visualPercent = progressVisualPercent(product, state.currentStep);
    animationFrom = state.progressAnimationFromPercent;
    animateProgress = typeof animationFrom === "number"
      && isFinite(animationFrom)
      && animationFrom >= 0
      && animationFrom !== visualPercent;
    state.progressAnimationFromPercent = null;
    label = activeStep && activeStep.label ? activeStep.label : (steps[activeIndex] && steps[activeIndex].label) || "Pedido";

    return [
      '<nav class="wizard-progress' + (activeIndex === 0 ? ' is-empty' : '') + (animateProgress ? ' is-changing' : '') + '" aria-label="Passos do pedido">',
      '<div class="wizard-progress__rail">',
      '<div class="wizard-progress__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + percent + '" aria-valuetext="Passo ' + (activeIndex + 1) + ' de ' + steps.length + ': ' + escapeHtml(label) + '">',
      '<span class="wizard-progress__fill" style="--progress-from:' + (animateProgress ? animationFrom : visualPercent) + '%;--progress-to:' + visualPercent + '%;width:' + visualPercent + '%"></span>',
      '</div>',
      '<ol class="wizard-progress__ticks">',
      steps.map(function (step, index) {
        var stepIndex = visible.indexOf(step);
        var position = steps.length <= 1 ? 100 : (index / (steps.length - 1)) * 100;
        var classes = index < activeIndex ? "is-complete" : (index === activeIndex ? "is-active" : "is-future");
        var disabled = index > activeIndex;
        var stepLabel = "Passo " + (index + 1) + ": " + (step.label || "Pedido");

        return [
          '<li class="' + classes + '" style="left:' + position.toFixed(3) + '%">',
          '<button type="button" data-jump-step="' + (stepIndex >= 0 ? stepIndex : index) + '" aria-label="' + escapeHtml(stepLabel) + '" title="' + escapeHtml(stepLabel) + '"' + (index === activeIndex ? ' aria-current="step"' : '') + (disabled ? ' disabled' : '') + '>',
          '<span aria-hidden="true"></span>',
          '</button>',
          '</li>'
        ].join("");
      }).join(""),
      '</ol>',
      '</div>',
      '</nav>'
    ].join("");
  }

  function mappedStepCopy(step, property) {
    var mappings = step && step[property] && typeof step[property] === "object" ? step[property] : {};
    var result = "";

    Object.keys(mappings).some(function (fieldName) {
      var fieldMap = mappings[fieldName] || {};
      var selected = String(state.selections[fieldName] || "");
      if (Object.prototype.hasOwnProperty.call(fieldMap, selected)) {
        result = String(fieldMap[selected] || "");
        return true;
      }
      return false;
    });
    return result;
  }

  function displayStepText(product, step) {
    var mapped = mappedStepCopy(step, "textByField");
    if (mapped) {
      return mapped;
    }
    if (step && step.id === "pack" && isAssortedSelected(product)) {
      return "Escolhe apenas quantas unidades queres, nós tratamos do resto.";
    }
    if (step && step.template === "palette-grid" && paletteSelectionLimit(step) === 2) {
      return "Escolhe duas cores para criar o degradê.";
    }
    return step && step.text ? step.text : "";
  }

  function displayStepTitle(product, step) {
    var mapped = mappedStepCopy(step, "titleByField");
    var artworkTitles;
    var artworkCount;
    if (mapped) {
      return mapped;
    }
    if (step && step.template === "custom-quantity-builder" && isArtworkBuilderProduct(product)) {
      return builderQuantityStepTitle(product);
    }
    artworkTitles = step && step.titleByArtworkCount;
    if (artworkTitles && typeof artworkTitles === "object" && isArtworkBuilderProduct(product)) {
      artworkCount = customArtworkItems(product).length;
      if (artworkCount === 1 && artworkTitles.one) {
        return String(artworkTitles.one);
      }
      if (artworkCount > 1 && artworkTitles.multiple) {
        return String(artworkTitles.multiple);
      }
    }
    if (step && step.template === "palette-grid" && paletteSelectionLimit(step) === 2) {
      return "Escolhe as cores do degradê";
    }
    return step && step.title ? step.title : "";
  }

  function renderProductPreview(product) {
    var preview = product && product.preview ? product.preview : null;

    if (!preview || !preview.enabled || !preview.image) {
      return "";
    }

    return [
      '<aside class="product-preview" aria-label="Pré-visualização">',
      '<img class="product-preview-image" src="' + escapeHtml(preview.image) + '" alt="' + escapeHtml(preview.title || "Pré-visualização") + '" loading="lazy">',
      '<div class="product-preview-copy">',
      preview.title ? '<strong>' + escapeHtml(preview.title) + '</strong>' : "",
      preview.text ? '<p>' + escapeHtml(preview.text) + '</p>' : "",
      '</div>',
      '</aside>'
    ].join("");
  }

  function renderProductGallery(product) {
    var gallery = product && product.gallery ? product.gallery : null;
    var items = gallery && Array.isArray(gallery.items) ? gallery.items.filter(function (item) {
      return item && item.image;
    }) : [];

    if (!items.length) {
      return "";
    }

    return [
      '<aside class="product-example-gallery" aria-label="' + escapeHtml(gallery.title || "Exemplos") + '">',
      '<div class="product-example-gallery-heading">',
      '<strong>' + escapeHtml(gallery.title || "Exemplos") + '</strong>',
      gallery.text ? '<p>' + escapeHtml(gallery.text) + '</p>' : "",
      '</div>',
      '<div class="product-example-gallery-track">',
      items.map(function (item) {
        return [
          '<button type="button" class="product-example-gallery-item" data-image-viewer-src="' + escapeHtml(item.image) + '" data-image-viewer-alt="' + escapeHtml(item.alt || "Exemplo de moldura personalizada") + '" aria-label="Ver exemplo maior">',
          '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.alt || "Exemplo de moldura personalizada") + '" loading="lazy">',
          '</button>'
        ].join("");
      }).join(""),
      '</div>',
      '</aside>'
    ].join("");
  }

  function renderProduct(product, cadernoRenderState) {
    clearCadernoPreviewTimers();
    syncGiftRequestSelection(product);
    ensureCadernoScopedImageSlots(product);

    var steps = visibleSteps(product);
    var step;
    var isLast;
    var cartEntry;
    var nextLabel;
    var entryIndex;
    var stepNumber;
    var suspended;

    if (!steps.length) {
      steps = product.steps || [];
    }

    entryIndex = cartEntryStepIndex(product);
    if (!state.admin && entryIndex >= 0 && state.currentStep > entryIndex) {
      state.currentStep = entryIndex;
    }

    if (state.currentStep > steps.length - 1) {
      state.currentStep = Math.max(0, steps.length - 1);
    }

    step = steps[state.currentStep];
    isLast = state.currentStep === steps.length - 1;
    cartEntry = isCartEntryStep(product);
    stepNumber = displayStepNumber(product, step);
    nextLabel = isLast ? "Enviar pedido" : state.currentStep === steps.length - 2 ? "Confirmar" : "Continuar";
    suspended = isLast && ordersAreSuspended();

    // Última leitura da lista de passos antiga antes de o innerHTML a apagar.
    captureStepNumbersRects();

    renderChrome([
      '<main class="product-shell ' + productSlugClass(product) + ' ' + productShapeClass(product) + ' ' + productOrientationClass(product) + '">',
      renderBrand(product.brand, "index.html", product.instagramUrl, state.siteMenuCategories),
      '<section class="wizard-shell" aria-labelledby="step-title">',
      renderStepNumbers(product),
      renderCartEditBar(),
      '<form id="order-form" action="' + escapeHtml(product.form.action) + '" method="post" novalidate>',
      '<input type="hidden" name="return_to" value="' + escapeHtml(product.form.returnTo) + '">',
      '<label class="hidden-field" aria-hidden="true"><span>Website</span><input type="text" name="website" tabindex="-1" autocomplete="off"></label>',
      '<div class="step-card' + (isDetailsMediaComposer(step) ? ' step-card--media-composer' : '') + '">',
      '<p class="eyebrow">Passo ' + stepNumber + (state.admin && step.hidden ? ' · oculto' : '') + '</p>',
      '<h2 id="step-title">' + escapeHtml(displayStepTitle(product, step)) + '</h2>',
      renderProgress(product),
      displayStepText(product, step) ? '<p class="step-help">' + escapeHtml(displayStepText(product, step)) + '</p>' : '',
      state.currentStep === 0 ? renderProductPreview(product) + renderProductGallery(product) : "",
      stepBody(product, step),
      renderQuadrosBuildSummary(product, step),
      '</div>',
      cartEntry ? renderCartEntryActions(product, step) : [
      '<div class="step-actions">',
      builderActionTotals(product, step),
      '<button class="button secondary" type="button" data-back data-track="true" data-track-action="back" data-track-id="back">Voltar</button>',
      '<div class="next-action-wrap">',
      state.errors ? '<p class="form-error action-error" id="step-action-error" role="alert">' + escapeHtml(state.errors) + '</p>' : "",
      '<button class="button primary' + (suspended ? ' is-disabled' : '') + '" type="' + (isLast && !suspended ? "submit" : "button") + '" data-next' + (state.errors ? ' aria-describedby="step-action-error"' : '') + (suspended ? ' data-order-suspended-submit aria-disabled="true"' : '') + ' data-track="true" data-track-action="' + (isLast ? 'submit' : 'next') + '" data-track-id="' + (isLast ? 'submit' : 'next') + '">' + escapeHtml(nextLabel) + '</button>',
      '</div>',
      '</div>'
      ].join(""),
      (isLast || cartEntry) ? renderGiftRequest(product) : "",
      isLast ? renderCopyRequest() : "",
      '</form>',
      '</section>',
      renderFooter(product.brand),
      '</main>'
    ].join(""), product);

    playStepNumbersFlip();
    bindProduct(product);
    initQuadrosPhotoColorAnalysis(product, step);
    if (isCadernosProduct(product) || isQuadrosProduct(product)) {
      initCadernoPreviewSlides();
    }
    if (isCadernosProduct(product)) {
      restoreCadernoRenderState(product, cadernoRenderState);
    }

    if (state.scrollStepOnRender) {
      state.scrollStepOnRender = false;
      window.requestAnimationFrame(function () {
        var target = document.querySelector(".wizard-shell");
        if (target) {
          target.scrollIntoView({ block: "start", behavior: "auto" });
        }
      });
    }
  }

  function rebuildProductDisplayLabels(product) {
    var step = product && product.steps ? product.steps.filter(function (candidate) { return candidate && candidate.id === "designs"; })[0] : null;
    var config = getStepSectionConfig(product, step);
    if (!config || !step) {
      state.itemDisplayLabels = {};
      return;
    }
    var sections = ensureStepSections(step, config.defaults);
    var grouped = groupItemsBySection(step.items, sections);
    state.itemDisplayLabels = buildSectionDisplayLabels(step, sections, grouped);
  }

  function rerenderProduct(product) {
    var cadernoRenderState = captureCadernoRenderState(product);

    state.product = product;
    state.maxVisitedStep = Math.max(state.maxVisitedStep, state.currentStep);
    rebuildProductDisplayLabels(product);
    renderProduct(product, cadernoRenderState);
    // SELECTION_SNAPSHOT_V1 (Phase 4): após qualquer re-render, dispara update
    // com debounce. Só é enviado se as selecções realmente mudaram.
    try {
      var stepObj = currentStep(product);
      maybeTrackSelectionUpdated(product, stepObj ? stepObj.id : '');
    } catch (e) {}
  }

  function wizardHistorySupported() {
    return !!(window.history && window.history.pushState && window.history.replaceState);
  }

  function wizardHistoryProductSlug(product) {
    return String((product && product.slug) || productSlug || "");
  }

  function wizardHistoryRecord(product, stepIndex) {
    return {
      miaWizard: true,
      productSlug: wizardHistoryProductSlug(product),
      step: stepIndex,
      id: wizardHistoryNextId++
    };
  }

  function wizardHistoryStepFromState(historyState, product) {
    var step;
    var steps = visibleSteps(product);

    if (!historyState || historyState.miaWizard !== true || historyState.productSlug !== wizardHistoryProductSlug(product)) {
      return null;
    }

    step = Number(historyState.step);
    if (!Number.isInteger(step) || step < 0 || step > steps.length - 1) {
      return null;
    }

    return step;
  }

  function rememberWizardHistoryRecord(record, replaceCurrent) {
    if (replaceCurrent && wizardHistoryIndex >= 0) {
      wizardHistoryEntries[wizardHistoryIndex] = { id: record.id, step: record.step };
      return;
    }

    wizardHistoryEntries = wizardHistoryEntries.slice(0, wizardHistoryIndex + 1);
    wizardHistoryEntries.push({ id: record.id, step: record.step });
    wizardHistoryIndex = wizardHistoryEntries.length - 1;
  }

  function replaceWizardHistory(product) {
    var record;

    if (!wizardHistorySupported()) {
      return;
    }

    record = wizardHistoryRecord(product, state.currentStep);
    rememberWizardHistoryRecord(record, true);
    window.history.replaceState(record, "", window.location.href);
  }

  function pushWizardHistory(product) {
    var record;

    if (!wizardHistorySupported()) {
      return;
    }

    record = wizardHistoryRecord(product, state.currentStep);
    rememberWizardHistoryRecord(record, false);
    window.history.pushState(record, "", window.location.href);
  }

  function wizardHistoryDeltaToStep(stepIndex) {
    var direction = stepIndex > state.currentStep ? 1 : -1;
    var i = wizardHistoryIndex + direction;

    while (i >= 0 && i < wizardHistoryEntries.length) {
      if (wizardHistoryEntries[i].step === stepIndex) {
        return i - wizardHistoryIndex;
      }

      i += direction;
    }

    return 0;
  }

  function handleWizardPopState(event) {
    var product = state.product;
    var step;
    var foundIndex;

    if (page !== "product" || !product) {
      return;
    }

    // TRANSITION_REASON_V1
    funnelNextTransitionReason = 'browser_back';

    step = wizardHistoryStepFromState(event.state, product);

    // STEP_JUMP_CONFIRM_V1: quando isto vem de um salto pedido nos números dos
    // passos, o pedido do utilizador manda. O histórico do browser pode
    // levar-nos para outro sítio — para uma entrada de outra página (sem estado
    // de wizard) ou para uma entrada válida mas de outro passo, porque o
    // espelho `wizardHistoryEntries` desalinha-se do stack real. Antes disso
    // descartava o pedido em silêncio: o utilizador clicava e não acontecia
    // nada.
    if (wizardPendingJumpStep != null) {
      var pedido = wizardPendingJumpStep;
      wizardPendingJumpStep = null;

      if (step !== pedido) {
        state.errors = "";
        syncOrderUploadBusy();
        setCurrentStep(product, pedido);
        replaceWizardHistory(product);
        rerenderProduct(product);
        return;
      }
    }

    if (step == null) {
      if (state.currentStep > 0) {
        // Old browsers or restored entries may not carry wizard state; keep the user inside the wizard until step 1.
        setCurrentStep(product, state.currentStep - 1);
        replaceWizardHistory(product);
        rerenderProduct(product);
      }
      return;
    }

    foundIndex = wizardHistoryEntries.map(function (entry) {
      return entry.id;
    }).indexOf(event.state.id);

    if (foundIndex !== -1) {
      wizardHistoryIndex = foundIndex;
    } else {
      wizardHistoryEntries = [{ id: event.state.id, step: step }];
      wizardHistoryIndex = 0;
    }

    state.errors = "";
    syncOrderUploadBusy();
    setCurrentStep(product, step);
    rerenderProduct(product);
  }

  function initWizardHistory(product) {
    if (wizardHistoryReady || !wizardHistorySupported()) {
      return;
    }

    wizardHistoryReady = true;
    // The first product-page entry is step 1; later steps are pushed as the wizard advances.
    replaceWizardHistory(product);
    window.addEventListener("popstate", handleWizardPopState);
  }

  function goToWizardStep(product, stepIndex) {
    var steps = visibleSteps(product);
    var next = Math.max(0, Math.min(stepIndex, steps.length - 1));
    var previous = state.currentStep;
    var historyDelta;

    if (next === previous) {
      return;
    }

    state.errors = "";
    // STEP_JUMP_CONFIRM_V1: só se entrega o salto ao histórico quando é para
    // trás. `wizardHistoryEntries` é um espelho do stack do browser e um salto
    // para a frente aponta para entradas que qualquer `pushState` entretanto
    // truncou — `history.go(+n)` sobre uma entrada que já não existe não faz
    // nada e, como isto retornava logo, o passo nunca mudava e o utilizador não
    // via nada acontecer. Para a frente aplicamos o passo à mão, como quem
    // carrega em "Continuar".
    historyDelta = wizardHistorySupported() && next < previous ? wizardHistoryDeltaToStep(next) : 0;

    if (historyDelta < 0) {
      // Mesmo para trás a entrada pode não ser deste wizard (o carrinho e as
      // outras páginas também empilham histórico). Guardamos o pedido e, se o
      // `popstate` não o resolver, aplicamos o salto directamente.
      wizardPendingJumpStep = next;
      if (wizardPendingJumpTimer) {
        window.clearTimeout(wizardPendingJumpTimer);
      }
      wizardPendingJumpTimer = window.setTimeout(function () {
        wizardPendingJumpTimer = null;
        if (wizardPendingJumpStep !== next) {
          return;
        }
        wizardPendingJumpStep = null;
        if (state.currentStep !== next) {
          applyWizardStep(product, next, state.currentStep);
        }
      }, 150);
      window.history.go(historyDelta);
      return;
    }

    applyWizardStep(product, next, previous);
  }

  function applyWizardStep(product, next, previous) {
    setCurrentStep(product, next);

    // Forward steps get new browser history entries; backward jumps replace the current one to avoid duplicates.
    if (next > previous) {
      pushWizardHistory(product);
    } else {
      replaceWizardHistory(product);
    }

    rerenderProduct(product);
  }

  function setCurrentStep(product, index) {
    var steps = visibleSteps(product);
    var next = Math.max(0, Math.min(index, steps.length - 1));
    var previous = state.currentStep;
    state.scrollStepOnRender = next !== state.currentStep;
    var prevStepObj = steps[previous] || null;
    var prevStepId = prevStepObj ? prevStepObj.id : '';
    if (next !== previous) {
      cancelOrderMediaActivityForStep(prevStepObj);
      state.builderRemovePendingId = "";
      state.progressAnimationFromPercent = progressVisualPercent(product, previous);
    }
    state.currentStep = next;
    state.maxVisitedStep = Math.max(state.maxVisitedStep, state.currentStep);

    // FUNNEL_TRACKING_V1: dispara step_view sempre que a posição muda.
    // Para o passo de confirmação dispara também confirmation_view (mais
    // específico do funil). Tracking nunca falha em silêncio.
    if (next !== previous) {
      var stepObj = steps[next] || null;
      var stepId = stepObj ? stepObj.id : '';
      // TRANSITION_REASON_V1 (Phase 7): regista o "porquê" da mudança.
      var reason = funnelNextTransitionReason;
      funnelNextTransitionReason = null;
      if (!reason) reason = next > previous ? 'auto_redirect' : 'auto_redirect';
      var extraView = {
        step_id: stepId,
        step_index: next,
        from_step: prevStepId,
        to_step: stepId,
        transition_reason: reason
      };
      // SELECTION_SNAPSHOT_V1 (Phase 4): snapshot ao SAIR do passo anterior.
      try { if (prevStepId) trackStepSelectionSnapshot(product, prevStepId); } catch (e) {}
      trackProductEvent(product, 'step_view', extraView);
      if (stepId === 'confirm') {
        trackProductEvent(product, 'confirmation_view', extraView);
      }
    }
  }

  function rerender() {
    if (page === "product" && state.product) {
      rerenderProduct(state.product);
      return;
    }

    if (page === "home") {
      initHome();
      return;
    }

    if (page === "add-product" && state.home) {
      renderAddProductPage(state.home);
      return;
    }

    if (page === "checkout" && state.home) {
      renderCheckoutPage(state.home);
      bindCheckoutPage(state.home);
    }
  }

