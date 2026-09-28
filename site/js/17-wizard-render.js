// js/17-wizard-render.js — parte 17/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: render dos passos do wizard, escolhas agrupadas de capa/variação, configuração de várias unidades e fluxo das pastas (atribuição A4/A6 dentro da preview): media composer, avisos, pedido de oferta, slideshow, numeração e histórico do browser.
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
  function coverPersonalizationSummaryRows(product) {
    if (!coverPersonalizationStep(product)) {
      return [];
    }

    return coverPersonalizationQuestions(product).reduce(function (rows, question) {
      var value = String(state.selections[question.field] || "");
      if (value !== "yes" && value !== "no") {
        return rows;
      }
      rows.push([
        question.label + ":",
        value === "yes"
          ? "Sim" + (coverPersonalizationQuestionText(question) ? " — " + coverPersonalizationQuestionText(question) : "")
          : "Não"
      ]);
      return rows;
    }, []);
  }

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
        ["Acabamento da Capa:", lamination ? lamination.title : ""],
        ["Extras:", addOnLabels.join(", ")],
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
    ].concat(optionDrawerSummaryRows(product), coverPersonalizationSummaryRows(product), [
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
      '<strong>A Mia começa a preparar a encomenda quando os detalhes e o pagamento estiverem confirmados.</strong>',
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

  function renderCopySelectionButton(step) {
    var config = step && step.copySelection;
    var sourceField = String(config && config.sourceField || "");
    var sourceValue = sourceField ? String(state.selections[sourceField] || "") : "";

    if (!config || !sourceField || !config.targetField) {
      return "";
    }

    return [
      '<button type="button" class="pf-copy-selection" data-copy-step-selection="' + escapeHtml(step.id || "") + '"' + (sourceValue ? '' : ' disabled') + '>',
      '<span class="pf-copy-selection-check" aria-hidden="true">✓</span>',
      '<span>' + escapeHtml(config.title || "Usar a mesma escolha") + '</span>',
      '</button>'
    ].join("");
  }

  function renderOptionDrawerChoice(product, step, drawer, item) {
    var selected = String(state.selections[drawer.field] || "") === String(item.value || "");
    var extra = Math.max(0, parseInt(item.extraPriceCentsPerUnit, 10) || 0);

    return [
      '<label class="option-drawer-choice' + (selected ? ' is-selected' : '') + '">',
      '<input type="radio" name="' + escapeHtml(drawer.field) + '" value="' + escapeHtml(item.value || "") + '" data-option-drawer-choice data-option-drawer-field="' + escapeHtml(drawer.field) + '"' + (selected ? ' checked' : '') + '>',
      renderVisual(item, "media-list", step),
      '<span class="option-drawer-choice-copy"><strong>' + escapeHtml(item.title || item.value || "Opção") + '</strong>' + (item.subtitle ? '<small>' + escapeHtml(item.subtitle) + '</small>' : '') + '</span>',
      '<span class="option-drawer-choice-price">' + (item.priceLabel ? '<small>' + escapeHtml(item.priceLabel) + '</small>' : (extra ? '+ ' + escapeHtml(formatCents(extra)) + '<small>por ' + escapeHtml(productUnitSingular(product)) + '</small>' : '<small>Sem acréscimo</small>')) + '</span>',
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
    var priceText = item.priceLabel
      ? escapeHtml(item.priceLabel)
      : (extra ? '+' + escapeHtml(formatCents(extra)) : (step.hideIncludedLabel ? '' : 'Incluído'));

    return [
      '<div class="cadernos-add-on-choice option-drawer-card-choice">',
      '<label class="choice-card crachas-size-card cadernos-add-on-card' + (selected ? ' is-selected' : '') + '">',
      '<input type="radio" name="' + escapeHtml(drawer.field) + '" value="' + escapeHtml(item.value || "") + '" data-option-drawer-choice data-option-drawer-field="' + escapeHtml(drawer.field) + '"' + (selected ? ' checked' : '') + '>',
      '<span class="crachas-size-card-visual">' + renderVisual(item, "media-list", step) + '</span>',
      '<span class="choice-copy crachas-size-card-text">',
      '<strong>' + escapeHtml(item.title || item.value || "Opção") + '</strong>',
      item.subtitle ? '<span>' + escapeHtml(item.subtitle) + '</span>' : "",
      '</span>',
      priceText ? '<span class="cadernos-purchase-price">' + priceText + '</span>' : '',
      '<span class="crachas-size-card-selected" aria-hidden="true">✓</span>',
      '</label>',
      selected ? renderCadernoAddOnDrawer(item) : "",
      '</div>'
    ].join("");
  }

  function isCoverCardStep(product, step) {
    return !!(step && (step.cardStyle === "cover" || step.display === "pasta-de-folhetos-finish-cards" || (product && productFamily(product) === "pasta-de-folhetos" && step.id === "extras")));
  }

  function renderOptionDrawerCoverCard(product, step, drawer, item) {
    var selected = String(state.selections[drawer.field] || "") === String(item.value || "");
    var mediaStep = Object.assign({}, step, { showDesignZoom: false });
    var multiple = configuredUnitsActive(product, step);
    var muted = multiple && state.selections[drawer.field] && !selected ? ' is-muted' : '';

    return [
      '<div class="cadernos-cover-choice pf-finish-choice">',
      '<label class="choice-card crachas-size-card cadernos-cover-card pf-finish-card' + (selected ? ' is-selected' : '') + muted + '">',
      '<input type="radio" name="' + escapeHtml(drawer.field) + '" value="' + escapeHtml(item.value || "") + '" data-option-drawer-choice data-option-drawer-field="' + escapeHtml(drawer.field) + '"' + (selected ? ' checked' : '') + '>',
      renderCadernoCoverCardMedia(product, mediaStep, item),
      '<span class="pf-assignment-card-footer">',
      '<span class="choice-copy crachas-size-card-text">',
      '<strong>' + escapeHtml(item.title || item.value || "Opção") + '</strong>',
      item.subtitle ? '<span>' + escapeHtml(item.subtitle) + '</span>' : '',
      '</span>',
      '</span>',
      '<span class="crachas-size-card-selected" aria-hidden="true">✓</span>',
      adminItemControls(step, item),
      '</label>',
      '</div>'
    ].join("");
  }

  // Itens com "miaChoice" (ex.: "A Mia escolhe") são escolhidos pelo botão
  // "Quero que a Mia escolha", não por um cartão próprio.
  function notMiaChoiceItem(item) {
    return !(item && item.miaChoice);
  }

  function renderOptionDrawerCards(product, step) {
    ensureOptionDrawerSelections(product);
    var drawers = optionDrawersForStep(product, step);
    var isCover = isCoverCardStep(product, step);

    return drawers.map(function (drawer) {
      // Com uma gaveta so, o titulo do passo ja diz o que se escolhe; com
      // varias, cada grupo precisa do seu cabecalho para nao se misturarem.
      var heading = drawers.length > 1
        ? '<h3 class="option-drawer-cards-title">' + escapeHtml(drawer.title || drawer.label || "Opção") + '</h3>'
        : "";

      var drawerClass = String(drawer.field || drawer.id || "option").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");

      if (isCover) {
        return heading + '<div class="option-list size-choice-list crachas-size-card-list cadernos-cover-list pf-fluid-cover-list pf-finish-list pf-fluid-drawer-list--' + escapeHtml(drawerClass) + '" data-pf-drawer-field="' + escapeHtml(drawer.field || "") + '">'
          + optionDrawerAvailableItems(product, drawer).filter(notMiaChoiceItem).map(function (item) {
            return renderOptionDrawerCoverCard(product, step, drawer, item);
          }).join("")
          + '</div>';
      }

      return heading + '<div class="option-list size-choice-list crachas-size-card-list cadernos-add-on-list pf-fluid-drawer-list pf-fluid-drawer-list--' + escapeHtml(drawerClass) + '" data-pf-drawer-field="' + escapeHtml(drawer.field || "") + '">'
        + optionDrawerAvailableItems(product, drawer).filter(notMiaChoiceItem).map(function (item) {
          return renderOptionDrawerCard(product, step, drawer, item);
        }).join("")
        + '</div>';
    }).join("");
  }

  function renderOptionDrawers(product, step) {
    ensureOptionDrawerSelections(product);

    return '<div class="option-drawer-list">' + optionDrawersForStep(product, step).map(function (drawer) {
      var selected = optionDrawerItem(drawer, state.selections[drawer.field], product);
      var selectedExtra = selected ? Math.max(0, parseInt(selected.extraPriceCentsPerUnit, 10) || 0) : 0;
      var key = optionDrawerUiKey(step, drawer);
      var open = state.optionDrawerOpen && state.optionDrawerOpen[key] === true;

      return [
        '<details class="option-drawer' + (selected ? ' has-selection' : '') + '" data-option-drawer="' + escapeHtml(key) + '"' + (open ? ' open' : '') + '>',
        '<summary class="option-drawer-summary">',
        selected ? renderVisual(selected, "media-list", step) : '<span class="option-image neutral" aria-hidden="true"></span>',
        '<span class="option-drawer-summary-copy"><strong>' + escapeHtml(drawer.title || drawer.label || "Opção") + '</strong><small>' + escapeHtml(selected ? (selected.title || selected.value) : "Escolhe uma opção") + '</small></span>',
        '<span class="option-drawer-summary-price">' + (selected && selected.priceLabel ? '<small>' + escapeHtml(selected.priceLabel) + '</small>' : (selectedExtra ? '+ ' + escapeHtml(formatCents(selectedExtra)) + '<small>por ' + escapeHtml(productUnitSingular(product)) + '</small>' : '<small>Incluído</small>')) + '</span>',
        '<span class="option-drawer-chevron" aria-hidden="true"></span>',
        '</summary>',
        '<div class="option-drawer-body" role="radiogroup" aria-label="' + escapeHtml(drawer.label || drawer.title || "Opção") + '">',
        optionDrawerAvailableItems(product, drawer).map(function (item) {
          return renderOptionDrawerChoice(product, step, drawer, item);
        }).join(""),
        '</div>',
        '</details>'
      ].join("");
    }).join("") + '</div>';
  }

  function renderFixedPurchaseSizeStep(product, step) {
    var selected = selectedValues(step);
    var html = "";

    (step.items || []).forEach(function (item) {
      var checked = selected.indexOf(item.value) !== -1;
      var info = priceForSize(product, item.value);
      var priceText = info && info.cents ? info.total : (item.priceCents != null ? formatCents(item.priceCents) : "");

      html += [
        '<label class="choice-card crachas-size-card cadernos-purchase-card' + (checked ? ' is-selected' : '') + '">',
        '<input type="radio" name="' + escapeHtml(step.field) + '" value="' + escapeHtml(item.value) + '" data-choice-step="' + escapeHtml(step.id) + '"' + (checked ? ' checked' : '') + '>',
        '<span class="crachas-size-card-visual">' + renderVisual(item, "media-list", step) + '</span>',
        '<span class="choice-copy crachas-size-card-text">',
        '<strong>' + escapeHtml(item.title || item.value || "") + '</strong>',
        item.subtitle ? '<span>' + escapeHtml(item.subtitle) + '</span>' : '',
        '</span>',
        priceText ? '<span class="cadernos-purchase-price">' + escapeHtml(priceText) + '</span>' : '',
        '<span class="crachas-size-card-selected" aria-hidden="true">✓</span>',
        adminItemControls(step, item),
        '</label>'
      ].join("");
    });

    return '<div class="option-list size-choice-list crachas-size-card-list cadernos-purchase-list">' + html + '</div>';
  }

  function renderPastaDeFolhetosSizeStep(product, step) {
    var selected = String(state.selections[step.field || "size"] || "");
    var html = "";

    (step.items || []).forEach(function (item) {
      var checked = selected === String(item.value || "");
      var info = priceForSize(product, item.value);
      var priceText = info && info.cents ? info.total : (item.priceCents != null ? formatCents(item.priceCents) : "");

      html += [
        '<div class="pf-size-choice">',
        '<label class="choice-card crachas-size-card cadernos-purchase-card pf-size-card' + (checked ? ' is-selected' : '') + '">',
        '<input type="radio" name="' + escapeHtml(step.field || "size") + '" value="' + escapeHtml(item.value || "") + '" data-choice-step="' + escapeHtml(step.id || "size") + '"' + (checked ? ' checked' : '') + '>',
        '<span class="crachas-size-card-visual">' + renderVisual(item, "media-list", step) + '</span>',
        '<span class="choice-copy crachas-size-card-text"><strong>' + escapeHtml(item.title || item.value || "") + '</strong>' + (item.subtitle ? '<span>' + escapeHtml(item.subtitle) + '</span>' : '') + '</span>',
        priceText ? '<span class="cadernos-purchase-price">' + escapeHtml(priceText) + '</span>' : '',
        '<span class="crachas-size-card-selected" aria-hidden="true">✓</span>',
        adminItemControls(step, item),
        '</label>',
        checked ? renderCadernoCoverDrawer(product, item) : '',
        '</div>'
      ].join("");
    });

    return '<div class="pf-size-list">' + html + '</div>';
  }

  function pastaDeFolhetosDetailsVariationStep(product, step) {
    var config = step && step.pastaDeFolhetosDetails;
    var stepId = config ? String(config.variationStepId || "") : "";
    return stepId ? findStep(product, stepId) : null;
  }

  function pastaDeFolhetosDetailsGroups(step, variationStep) {
    var config = step && step.pastaDeFolhetosDetails;
    return config && Array.isArray(config.fixedGroups)
      ? config.fixedGroups.map(String)
      : designGroupsForStep(variationStep);
  }

  // Design próprio: as argolas e a fita não vêm da capa do catálogo mas das
  // gavetas em pastaDeFolhetosDetails.ownDesignRibbonSteps (uma por tamanho).
  function ownDesignRibbonDrawer(product, step, group) {
    var steps = step && step.pastaDeFolhetosDetails && step.pastaDeFolhetosDetails.ownDesignRibbonSteps;
    var source = steps && steps[group] ? findStep(product, String(steps[group])) : null;
    var drawer = source ? optionDrawersForStep(product, source)[0] : null;
    return drawer && drawer.field && Array.isArray(drawer.items) && drawer.items.length ? drawer : null;
  }

  function syncPastaDeFolhetosDetailSelections(product, step) {
    var variationStep = pastaDeFolhetosDetailsVariationStep(product, step);
    var config = step && step.pastaDeFolhetosDetails;

    if (!variationStep) {
      return;
    }

    // Como nas capas do catálogo, começa na primeira (dourada).
    if (isCustomArtworkSelected(product)) {
      pastaDeFolhetosDetailsGroups(step, variationStep).forEach(function (group) {
        var drawer = ownDesignRibbonDrawer(product, step, group);
        var current = drawer ? String(state.selections[drawer.field] || "") : "";
        if (drawer && !drawer.items.some(function (item) { return String(item.value || "") === current; })) {
          state.selections[drawer.field] = String(drawer.items[0].value || "");
        }
      });
    }

    pastaDeFolhetosDetailsGroups(step, variationStep).forEach(function (group) {
      var field = groupedDesignField(variationStep, group);
      var items = groupedDesignItems(variationStep, group);
      var current = field ? String(state.selections[field] || "") : "";
      var valid = current && items.some(function (item) {
        return item && String(item.value || "") === current;
      });

      if (!field) {
        return;
      }
      if (!valid && items.length) {
        var defaultItem = items.filter(function (it) {
          return it && (it.default === true || it.isDefault === true);
        })[0] || null;
        var shouldPreselect = !!defaultItem
          || items.length === 1
          || Boolean(config && (config.defaultToFirst || config.defaultToFirstVariation || config.preselectDefault))
          || Boolean(variationStep && (variationStep.defaultToFirst || variationStep.defaultToFirstVariation || variationStep.preselectDefault));

        if (shouldPreselect) {
          state.selections[field] = (defaultItem || items[0]).value;
        } else {
          delete state.selections[field];
        }
      } else if (!valid) {
        delete state.selections[field];
      }
    });

    syncGroupedDesignSelections(product, variationStep);
  }

  function renderPastaDeFolhetosMetalCorners(product, step) {
    var config = step && step.pastaDeFolhetosDetails || {};
    var sourceStepId = String(config.metalCornersSourceStepId || "");
    var sourceStep = sourceStepId ? findStep(product, sourceStepId) : step;
    var drawers = optionDrawersForStep(product, sourceStep);
    var drawer = drawers.length ? drawers[0] : null;
    var item = drawer && Array.isArray(drawer.items) ? drawer.items[0] : null;
    var field = drawer ? String(drawer.field || "") : "";
    var value = item ? String(item.value || "") : "";
    var selected = field && value && String(state.selections[field] || "") === value;
    var extra = Math.max(0, parseInt(item && item.extraPriceCentsPerUnit, 10) || 0);
    var groups = Array.isArray(config.metalCornersGroups) ? config.metalCornersGroups : [];

    if (!drawer || !item || !field || !value) {
      return "";
    }

    if (groups.length) {
      return '<div class="pf-metal-corners-groups">' + groups.map(function (group) {
        var groupField = String(group && group.field || "");
        var groupLabel = String(group && (group.label || group.id) || "");
        var groupSelected = groupField && String(state.selections[groupField] || "") === value;

        return [
          '<button type="button" class="pf-metal-corners-toggle' + (groupSelected ? ' is-selected' : '') + '" data-pf-metal-corners-toggle data-pf-metal-corners-field="' + escapeHtml(groupField) + '" data-pf-metal-corners-value="' + escapeHtml(value) + '" aria-pressed="' + (groupSelected ? 'true' : 'false') + '">',
          '<span class="pf-metal-corners-image">' + renderVisual(item, "media-list", sourceStep) + '</span>',
          '<span class="pf-metal-corners-copy"><strong>' + escapeHtml((item.title || "Quero cantos metálicos") + (groupLabel ? " · " + groupLabel : "")) + '</strong><small>' + escapeHtml(item.subtitle || "") + '</small></span>',
          '<span class="pf-metal-corners-price">+' + escapeHtml(formatCents(extra)) + '</span>',
          '<span class="pf-metal-corners-check" aria-hidden="true">✓</span>',
          '</button>'
        ].join("");
      }).join("") + '</div>';
    }

    return [
      '<button type="button" class="pf-metal-corners-toggle' + (selected ? ' is-selected' : '') + '" data-pf-metal-corners-toggle data-pf-metal-corners-field="' + escapeHtml(field) + '" data-pf-metal-corners-value="' + escapeHtml(value) + '" aria-pressed="' + (selected ? 'true' : 'false') + '">',
      '<span class="pf-metal-corners-image">' + renderVisual(item, "media-list", step) + '</span>',
      '<span class="pf-metal-corners-copy"><strong>' + escapeHtml(item.title || "Quero cantos metálicos") + '</strong><small>' + escapeHtml(item.subtitle || "") + '</small></span>',
      '<span class="pf-metal-corners-price">+' + escapeHtml(formatCents(extra)) + '</span>',
      '<span class="pf-metal-corners-check" aria-hidden="true">✓</span>',
      '</button>'
    ].join("");
  }

  function renderPastaDeFolhetosDetails(product, step) {
    var config = step && step.pastaDeFolhetosDetails || {};
    var variationStep = pastaDeFolhetosDetailsVariationStep(product, step);
    var html = '<div class="pf-details-step">' + renderPastaDeFolhetosMetalCorners(product, step);

    if (!variationStep) {
      return html + '</div>';
    }

    syncPastaDeFolhetosDetailSelections(product, step);
    pastaDeFolhetosDetailsGroups(step, variationStep).forEach(function (group) {
      var field = groupedDesignField(variationStep, group);
      var items = groupedDesignItems(variationStep, group);
      var selected = field ? String(state.selections[field] || "") : "";
      var ribbon = isCustomArtworkSelected(product) ? ownDesignRibbonDrawer(product, step, group) : null;

      if (ribbon) {
        html += [
          '<section class="pf-details-variation is-own-design" data-design-size-group="' + escapeHtml(group) + '">',
          '<h3>' + escapeHtml(config.variationTitle || "Escolhe as argolas e fita") + ' · ' + escapeHtml(group) + '</h3>',
          '<div class="unit-row-options unit-row-options--ribbon" role="radiogroup">',
          ribbon.items.map(function (item) {
            var value = String(item.value || "");
            return renderConfiguredUnitRowChoice(ribbon.field, value, String(state.selections[ribbon.field] || "") === value,
              'data-option-drawer-choice data-option-drawer-field="' + escapeHtml(ribbon.field) + '"',
              "", item.choiceTitle || item.title || value, item.choiceNote || "");
          }).join(""),
          '</div>',
          '</section>'
        ].join("");
        return;
      }

      if (items.length < 2) {
        return;
      }

      html += [
        '<section class="pf-details-variation" data-design-size-group="' + escapeHtml(group) + '">',
        '<h3>' + escapeHtml(config.variationTitle || "Escolhe as argolas e fita") + ' · ' + escapeHtml(group) + '</h3>',
        '<div class="pf-details-variation-list" role="radiogroup">',
        items.map(function (item) {
          var checked = selected === String(item.value || "");
          return [
            '<label class="pf-details-variation-card' + (checked ? ' is-selected' : '') + '">',
            '<input type="radio" name="' + escapeHtml(field) + '" value="' + escapeHtml(item.value || "") + '" data-continuous-variation-choice data-continuous-variation-step="' + escapeHtml(variationStep.id || "") + '" data-continuous-variation-field="' + escapeHtml(field) + '" data-continuous-variation-group="' + escapeHtml(group) + '"' + (checked ? ' checked' : '') + '>',
            '<span class="pf-details-variation-image">' + renderVisual(item, "media-list", variationStep) + '</span>',
            '<span class="pf-details-variation-copy"><strong>' + escapeHtml(item.title || item.value || "") + '</strong><small>' + escapeHtml(item.subtitle || "") + '</small></span>',
            '<span class="pf-details-variation-check" aria-hidden="true">✓</span>',
            '</label>'
          ].join("");
        }).join(""),
        '</div>',
        '</section>'
      ].join("");
    });

    return html + '</div>';
  }

  // DESIGNS_BY_SIZE_V1: um único passo de design pode pedir uma escolha
  // independente por grupo de tamanho. O JSON define tudo: campo do tamanho,
  // grupos necessários por valor e campo de seleção de cada grupo.
  function designGroupsForStep(step) {
    if (step && Array.isArray(step.fixedGroups)) {
      return step.fixedGroups.map(String);
    }
    var sizeField = String(step && step.sizeField || "size");
    var selectedSize = String(state.selections[sizeField] || "");
    var map = step && step.sizeGroups && typeof step.sizeGroups === "object" ? step.sizeGroups : {};
    return Array.isArray(map[selectedSize]) ? map[selectedSize].map(String) : [];
  }

  function groupedDesignField(step, group) {
    var fields = step && step.selectionFields && typeof step.selectionFields === "object" ? step.selectionFields : {};
    return String(fields[group] || "");
  }

  function groupedDesignItems(step, group) {
    var sourceId = String(step && step.itemsSourceStepId || "");
    var itemStep = sourceId ? findStep(state.product, sourceId) : step;
    var parentFields = step && step.parentSelectionFields && typeof step.parentSelectionFields === "object" ? step.parentSelectionFields : {};
    var parentField = String(parentFields[group] || "");
    var parentValue = parentField ? String(state.selections[parentField] || "") : "";
    var parentProperty = String(step && step.parentItemProperty || "parentValue");

    return (itemStep && Array.isArray(itemStep.items) ? itemStep.items : []).filter(function (item) {
      if (!item || String(item.sizeGroup || "") !== String(group || "")) {
        return false;
      }
      if (step.hideVariationOnly && item.isVariationOnly) {
        return false;
      }
      return !parentField || (!!parentValue && String(item[parentProperty] || "") === parentValue);
    });
  }

  function syncGroupedDesignSelections(product, step) {
    var expected = designGroupsForStep(step);
    var values = [];

    expected.forEach(function (group) {
      var field = groupedDesignField(step, group);
      var value = field ? String(state.selections[field] || "") : "";
      var valid = value && groupedDesignItems(step, group).some(function (item) {
        return String(item.value || "") === value;
      });
      if (valid) {
        values.push(value);
      }
    });
    var aggregateField = String(step && step.aggregateField || "");
    if (aggregateField) {
      state.selections[aggregateField] = values;
    }
    return values;
  }

  function groupedDesignOrderTitle(product, item) {
    var step = product && findStep(product, "designs");
    var parentStep = step && step.parentStepId ? findStep(product, String(step.parentStepId)) : null;
    var parentProperty = String(step && step.parentItemProperty || "parentValue");
    var parentValue = item ? String(item[parentProperty] || "") : "";
    var parentItem = parentStep && Array.isArray(parentStep.items) ? parentStep.items.filter(function (candidate) {
      return candidate && String(candidate.value || "") === parentValue;
    })[0] || null : null;
    var parentTitle = parentItem ? String(parentItem.title || parentItem.value || "") : "";
    var variationTitle = item ? String(displayItemTitle(item) || item.title || item.value || "") : "";

    return parentTitle && variationTitle ? parentTitle + " · " + variationTitle : (variationTitle || parentTitle);
  }

  function renderGroupedFormatChoices(product, step) {
    var formatStepId = String(step && step.formatStepId || "");
    var formatStep = formatStepId ? findStep(product, formatStepId) : null;
    var selected = String(state.selections[formatStep && formatStep.field || "size"] || "");
    var html = "";

    if (!formatStep || !Array.isArray(formatStep.items)) {
      return "";
    }

    formatStep.items.forEach(function (item) {
      var checked = selected === String(item.value || "");
      var info = priceForSize(product, item.value);
      var priceText = info && info.cents ? info.total : (item.priceCents != null ? formatCents(item.priceCents) : "");
      html += [
        '<label class="choice-card crachas-size-card cadernos-purchase-card' + (checked ? ' is-selected' : '') + '">',
        '<input type="radio" name="' + escapeHtml(formatStep.field || "size") + '" value="' + escapeHtml(item.value || "") + '" data-grouped-format-choice data-grouped-format-step="' + escapeHtml(formatStep.id || "size") + '"' + (checked ? ' checked' : '') + '>',
        '<span class="crachas-size-card-visual">' + renderVisual(item, "media-list", formatStep) + '</span>',
        '<span class="choice-copy crachas-size-card-text"><strong>' + escapeHtml(item.title || item.value || "") + '</strong>' + (item.subtitle ? '<span>' + escapeHtml(item.subtitle) + '</span>' : '') + '</span>',
        priceText ? '<span class="cadernos-purchase-price">' + escapeHtml(priceText) + '</span>' : '',
        '<span class="crachas-size-card-selected" aria-hidden="true">✓</span>',
        '</label>'
      ].join("");
    });

    return [
      '<section class="design-grid-section grouped-design-section grouped-format-section">',
      '<h3 class="design-grid-section-title">' + escapeHtml(step.formatTitle || "Escolhe o formato") + '</h3>',
      '<div class="option-list size-choice-list crachas-size-card-list cadernos-purchase-list">' + html + '</div>',
      '</section>'
    ].join("");
  }

  // ASSIGNMENT_PICKER_V1: um catálogo visual abre uma única preview por linha;
  // os botões no próprio cartão atribuem ou retiram o item de cada grupo.
  // A origem, os campos e qualquer mapa de valores vêm sempre do JSON.
  function assignmentPickerConfig(step) {
    var config = step && step.assignmentPicker;
    return config && Array.isArray(config.groups) ? config : null;
  }

  function assignmentPickerSourceStep(product, step) {
    var config = assignmentPickerConfig(step) || {};
    var sourceId = String(config.sourceStepId || "");
    return sourceId ? findStep(product, sourceId) : step;
  }

  function assignmentPickerItems(product, step) {
    var config = assignmentPickerConfig(step) || {};
    var sourceStep = assignmentPickerSourceStep(product, step);
    var drawerId = String(config.sourceDrawerId || "");
    var items = sourceStep && Array.isArray(sourceStep.items) ? sourceStep.items : [];

    if (drawerId && sourceStep && Array.isArray(sourceStep.drawers)) {
      var drawer = sourceStep.drawers.filter(function (candidate) {
        return candidate && String(candidate.id || candidate.field || "") === drawerId;
      })[0] || null;
      items = drawer && Array.isArray(drawer.items) ? drawer.items : [];
    }

    if (config.sourceGroup != null) {
      items = items.filter(function (item) {
        return item && String(item.sizeGroup || "") === String(config.sourceGroup);
      });
    }

    return items;
  }

  function assignmentPickerValue(group, item) {
    var sourceValue = String(item && item.value || "");
    var valueMap = group && group.valueMap && typeof group.valueMap === "object" ? group.valueMap : {};
    return Object.prototype.hasOwnProperty.call(valueMap, sourceValue)
      ? String(valueMap[sourceValue] || "")
      : sourceValue;
  }

  function assignmentPickerAssignedItem(product, step, group) {
    var field = String(group && group.field || "");
    var selected = field ? String(state.selections[field] || "") : "";
    var sourceStep = assignmentPickerSourceStep(product, step);
    var sourceItems = sourceStep && Array.isArray(sourceStep.items) ? sourceStep.items : [];
    var exactItem = selected ? sourceItems.filter(function (item) {
      return item && String(item.value || "") === selected;
    })[0] : null;
    // O mapa pode atribuir a outro tamanho: mostrar a fotografia desse item.
    if (exactItem) {
      return exactItem;
    }
    return selected ? assignmentPickerItems(product, step).filter(function (item) {
      return assignmentPickerValue(group, item) === selected;
    })[0] || null : null;
  }

  // PREVIEW_DRAWER_V1: a imagem ilustrativa usa a gaveta já existente de
  // passagem de várias imagens (o mesmo esquema do drawer dos quadros:
  // data-cadernos-preview, setas data-cadernos-preview-step, pill, auto e
  // swipe tratados por initCadernoPreviewSlides). Só a origem das fotos
  // vem do JSON, sem listas de slugs no código:
  // - designs-by-size: step.selectedImagePreview.variationStepId aponta para
  //   o passo de variações (ex. "designs").
  // - assignment-picker: step.assignmentPicker.variationStepId faz o mesmo,
  //   combinando A4 + A6 através dos groups/valueMap.
  // Sem a flag, mantém-se a foto fixa anterior. A gaveta nunca altera a
  // seleção nem o checkout.
  function variationItemsForCover(product, variationStepId, coverValue, sizeGroup) {
    var variationStep = variationStepId ? findStep(product, String(variationStepId)) : null;
    var items = variationStep && Array.isArray(variationStep.items) ? variationStep.items : [];
    var parentProperty = String((variationStep && variationStep.parentItemProperty) || "coverValue");
    var wantedCover = String(coverValue || "");
    var wantedGroup = String(sizeGroup || "");
    if (!variationStep || !wantedCover) {
      return [];
    }
    return items.filter(function (item) {
      if (!item) {
        return false;
      }
      if (wantedGroup && String(item.sizeGroup || "") !== wantedGroup) {
        return false;
      }
      return String(item[parentProperty] || "") === wantedCover;
    });
  }

  function singlePreviewDrawerItems(product, step, selectedItem, group) {
    var config = step && step.selectedImagePreview;
    var variationStepId = config && String(config.variationStepId || "");
    if (!variationStepId || !selectedItem) {
      return selectedItem ? [selectedItem] : [];
    }
    var list = variationItemsForCover(product, variationStepId, selectedItem.value, group || selectedItem.sizeGroup);
    return list.length ? list : [selectedItem];
  }

  function assignmentPreviewDrawerItems(product, step, openItem) {
    var config = assignmentPickerConfig(step) || {};
    var variationStepId = String(config.variationStepId || "");
    if (!variationStepId || !openItem) {
      return openItem ? [openItem] : [];
    }
    var list = [];
    var seen = {};
    config.groups.forEach(function (group) {
      var coverValue = assignmentPickerValue(group, openItem);
      var sizeGroup = String((group && (group.id || group.label)) || "");
      variationItemsForCover(product, variationStepId, coverValue, sizeGroup).forEach(function (item) {
        var key = String(item && item.value || "");
        if (key && !seen[key]) {
          seen[key] = true;
          list.push(item);
        }
      });
    });
    return list.length ? list : [openItem];
  }

  function renderPreviewDrawer(product, coverValue, coverItemId, frames, hint) {
    var speed = typeof cadernoPreviewSpeedSeconds === "function" ? cadernoPreviewSpeedSeconds(product) : 4;
    var hintAttr = hint ? ' data-preview-drawer-hint="' + escapeHtml(hint) + '"' : '';
    if (!frames.length) {
      return "";
    }
    return [
      '<div class="cadernos-cover-drawer quadros-design-drawer">',
      '<div class="cadernos-cover-preview-frame quadros-design-preview-frame" data-cadernos-preview data-cadernos-preview-cover-value="' + escapeHtml(coverValue || "") + '" data-cadernos-preview-item-id="' + escapeHtml(coverItemId || "") + '" data-cadernos-preview-interval="' + (speed * 1000) + '"' + hintAttr + '>',
      frames.map(function (frame, index) {
        return '<span class="cadernos-cover-preview-slide quadros-design-preview-slide' + (index === 0 ? ' is-active' : '') + (hint ? ' has-hint' : '')
          + '" data-mia-image="' + escapeHtml(frame.image) + '" data-mia-item-id="' + escapeHtml(frame.itemId || "")
          + '" data-mia-slot-name="drawer" data-mia-slide-index="' + index
          + '" style="background-image:url(&quot;' + escapeHtml(frame.image) + '&quot;)"'
          + (hint ? ' tabindex="0" role="button" aria-label="' + escapeHtml(frame.label) + '"' : '') + '></span>';
      }).join(""),
      frames.length > 1 ? '<button type="button" class="cadernos-preview-arrow cadernos-preview-arrow--prev" data-cadernos-preview-step="-1" aria-label="Imagem anterior">‹</button>' : "",
      frames.length > 1 ? '<button type="button" class="cadernos-preview-arrow cadernos-preview-arrow--next" data-cadernos-preview-step="1" aria-label="Imagem seguinte">›</button>' : "",
      '<span class="crachas-size-card-proof-note cadernos-preview-pill" aria-hidden="true">',
      frames.map(function (frame, index) {
        return '<span class="cadernos-preview-pill-label' + (index === 0 ? ' is-active' : '') + '">' + escapeHtml(frame.label) + '</span>';
      }).join(""),
      '</span>',
      '</div>',
      '</div>'
    ].join("");
  }

  function previewDrawerFrames(items, withGroup) {
    return (items || []).filter(function (item) {
      return item && item.image;
    }).map(function (item) {
      var title = String(item.title || item.value || "Opção");
      return {
        image: String(item.image),
        label: withGroup && item.sizeGroup ? String(item.sizeGroup) + " · " + title : title,
        itemId: String(item.id || "")
      };
    });
  }

  function productUsesPreviewDrawers(product) {
    if (!product || !Array.isArray(product.steps)) {
      return false;
    }
    return product.steps.some(function (step) {
      if (step && step.assignmentPicker && step.assignmentPicker.variationStepId) {
        return true;
      }
      return !!(step && step.selectedImagePreview && step.selectedImagePreview.variationStepId);
    });
  }

  function renderAssignmentPickerSlots(product, step) {
    var config = assignmentPickerConfig(step) || {};
    var sourceStep = assignmentPickerSourceStep(product, step);

    return (config.slotsTitle ? '<h3 class="section-title pf-assignment-slots-title">' + escapeHtml(config.slotsTitle) + '</h3>' : '')
      + '<div class="pf-assignment-slots" aria-label="Escolhas atribuídas">' + config.groups.map(function (group) {
      var item = assignmentPickerAssignedItem(product, step, group);
      return [
        '<div class="pf-assignment-slot' + (item ? ' has-selection' : '') + '" data-assignment-slot="' + escapeHtml(group.id || group.label || "") + '">',
        '<span class="pf-assignment-slot-media">' + (item ? renderVisual(item, "media-list", sourceStep) : '<span class="pf-assignment-slot-empty" aria-hidden="true">?</span>') + '</span>',
        '<strong>' + escapeHtml(group.label || group.id || "") + '</strong>',
        '</div>'
      ].join("");
    }).join("") + '</div>';
  }

  function renderAssignmentPickerPreview(product, step, item) {
    var config = assignmentPickerConfig(step) || {};

    if (!config.variationStepId) {
      return [
        '<div class="pf-assignment-preview" data-assignment-preview role="status" aria-live="polite">',
        renderCadernosProofPhoto(item, config.previewLabel || "Imagem ilustrativa"),
        '</div>'
      ].join("");
    }

    return [
      '<div class="pf-assignment-preview" data-assignment-preview role="status" aria-live="polite">',
      renderPreviewDrawer(product, item && item.value, item && item.id, previewDrawerFrames(assignmentPreviewDrawerItems(product, step, item), true), config.drawerHint),
      '</div>'
    ].join("");
  }

  function renderAssignmentPickerUndo(step, kind) {
    var now = Date.now();
    var undos = Array.isArray(state.assignmentPickerUndos) ? state.assignmentPickerUndos.filter(function (undo) {
      return undo && String(undo.stepId || "") === String(step.id || "") && Number(undo.expiresAt || 0) > now
        && String(undo.kind || "") === String(kind || "");
    }) : [];

    if (!undos.length) {
      return "";
    }
    return '<div class="pf-assignment-undo-stack" role="status" aria-live="polite">' + undos.slice().reverse().map(function (undo) {
      var remaining = Math.max(1, Math.ceil((Number(undo.expiresAt || 0) - now) / 1000));
      return [
        '<div class="pf-assignment-undo" data-assignment-undo-id="' + escapeHtml(undo.id || "") + '" style="--assignment-undo-duration:' + Math.max(0, Number(undo.expiresAt || 0) - now) + 'ms">',
        '<span>' + escapeHtml(undo.message || "Escolha atualizada.") + '</span>',
        '<button type="button" data-assignment-undo data-assignment-undo-id="' + escapeHtml(undo.id || "") + '">Reverter (<span data-assignment-undo-countdown data-assignment-undo-id="' + escapeHtml(undo.id || "") + '">' + remaining + '</span>s)</button>',
        '<span class="pf-assignment-undo-progress" aria-hidden="true"></span>',
        '</div>'
      ].join("");
    }).join("") + '</div>';
  }

  // Inclinação da faixa do cartão dividido (graus): editar SÓ este número.
  var PF_SPLIT_ANGLE = 12;

  function assignmentSplitClip(top) {
    var rise = Math.tan(PF_SPLIT_ANGLE * Math.PI / 180) * 80;
    var gap = 0.75;
    var left = 50 + rise / 2;
    var right = 50 - rise / 2;
    if (top) {
      return "polygon(0 0, 100% 0, 100% " + (right - gap) + "%, 0 " + (left - gap) + "%)";
    }
    return "polygon(0 " + (left + gap) + "%, 100% " + (right + gap) + "%, 100% 100%, 0 100%)";
  }

  function renderAssignmentPickerCardMedia(product, step, sourceStep, item, displayItems) {
    var mediaStep = Object.assign({}, sourceStep || step, { showDesignZoom: false });
    var shown = displayItems && displayItems.length ? displayItems : [item];
    if (shown.length < 2 || !shown[0] || !shown[1]) {
      if (state.assignmentSplitSeen) {
        delete state.assignmentSplitSeen[String(step.id || "") + "::" + String(item.value || "")];
      }
      return renderCadernoCoverCardMedia(product, mediaStep, shown[0] || item);
    }
    var clipTop = assignmentSplitClip(true);
    var clipBottom = assignmentSplitClip(false);
    var splitKey = String(step.id || "") + "::" + String(item.value || "");
    var splitEntering = !(state.assignmentSplitSeen && state.assignmentSplitSeen[splitKey]);
    if (!state.assignmentSplitSeen) {
      state.assignmentSplitSeen = {};
    }
    state.assignmentSplitSeen[splitKey] = true;
    return [
      '<span class="crachas-size-card-visual cadernos-cover-media pf-assignment-split' + (splitEntering ? ' is-entering' : '') + '">',
      '<span class="pf-assignment-split-half pf-assignment-split-top" style="-webkit-clip-path:' + clipTop + ';clip-path:' + clipTop + '">'
        + renderVisual(shown[0], "media-list", mediaStep) + '</span>',
      '<span class="pf-assignment-split-half pf-assignment-split-bottom" style="-webkit-clip-path:' + clipBottom + ';clip-path:' + clipBottom + '">'
        + renderVisual(shown[1], "media-list", mediaStep) + '</span>',
      '<span class="pf-assignment-split-band" aria-hidden="true" style="transform:rotate(-' + PF_SPLIT_ANGLE + 'deg)"></span>',
      '</span>'
    ].join("");
  }

  // Pedir todas as variantes ao abrir o passo, antes da primeira atribuição.
  // Reutilizar o cache do renderer evita voltar ao placeholder no clique.
  var assignmentPreloadedImages = {};
  function preloadAssignmentPickerImages(product, step) {
    var config = assignmentPickerConfig(step);
    var source = assignmentPickerSourceStep(product, step);
    if (!config || !source) return;
    var sourceItems = source.items || [];
    function preloadUrl(image) {
      if (!image) return;
      var url = siteAssetUrl(image);
      if (assignmentPreloadedImages[url]) return;
      var preloaded = new Image();
      assignmentPreloadedImages[url] = preloaded;
      preloaded.onerror = function () {
        delete assignmentPreloadedImages[url];
        delete designLoadedImageUrls[url];
      };
      preloaded.src = url;
      designLoadedImageUrls[url] = true;
      if (preloaded.decode) preloaded.decode().catch(function () {});
    }
    assignmentPickerItems(product, step).forEach(function (item) {
      config.groups.forEach(function (group) {
        var value = assignmentPickerValue(group, item);
        var variant = sourceItems.filter(function (candidate) {
          return String(candidate.value || "") === value;
        })[0] || item;
        if (variant && variant.image) preloadUrl(variant.image);
      });
      // PREVIEW_DRAWER_V1: pedir também as fotos de fita/argolas para a
      // gaveta A4 + A6 não piscar ao abrir.
      if (config.variationStepId) {
        assignmentPreviewDrawerItems(product, step, item).forEach(function (cycleItem) {
          if (cycleItem && cycleItem.image) preloadUrl(cycleItem.image);
        });
      }
    });
  }

  function renderAssignmentPicker(product, step) {
    preloadAssignmentPickerImages(product, step);
    var config = assignmentPickerConfig(step) || {};
    var sourceStep = assignmentPickerSourceStep(product, step);
    var items = assignmentPickerItems(product, step).filter(notMiaChoiceItem);
    var openValue = state.assignmentPickerOpen && String(state.assignmentPickerOpen[step.id] || "");
    var openItem = openValue ? items.filter(function (item) {
      return String(item.value || "") === openValue;
    })[0] || null : null;
    var openIndex = openItem ? items.indexOf(openItem) : -1;
    var cards = items.map(function (item) {
      var itemGroups = config.groups.filter(function (group) {
        var field = String(group && group.field || "");
        return field && String(state.selections[field] || "") === assignmentPickerValue(group, item);
      });
      // ASSIGNMENT_MUTE_V1: o desvanecido segue o clique (cartão aberto em
      // preview), não a atribuição: com um cartão aberto, todos os outros
      // desvanecem, independentemente do que está atribuído a A4/A6.
      // Data-driven: vale para qualquer assignment-picker.
      var muted = openItem && item !== openItem ? " is-muted" : "";
      // ASSIGNMENT_COVER_IMAGE_V1: o cartão mostra a imagem do grupo que
      // lhe foi atribuído; com os dois grupos no mesmo cartão mostra as
      // duas artes (A4 em cima, A6 em baixo) separadas por faixa clara.
      // Sem atribuição ou sem mapa, fica a imagem do próprio cartão.
      var displayItems = [];
      itemGroups.forEach(function (group) {
        var shown = assignmentPickerAssignedItem(product, step, group);
        var alreadyShown = false;
        displayItems.forEach(function (seen) {
          if (String(seen.value || "") === String((shown || {}).value || "")) {
            alreadyShown = true;
          }
        });
        if (shown && !alreadyShown) {
          displayItems[displayItems.length] = shown;
        }
      });
      var open = openItem === item;
      var opening = state.assignmentPickerOpening
        && String(state.assignmentPickerOpening[step.id] || "") === String(item.value || "");
      var controls = '<span class="pf-assignment-card-controls" role="group" aria-label="Atribuir esta escolha">' + config.groups.map(function (group) {
        var field = String(group && group.field || "");
        var value = assignmentPickerValue(group, item);
        var selected = field && value && String(state.selections[field] || "") === value;

        return [
          '<button type="button" class="pf-assignment-card-toggle' + (selected ? ' is-selected' : '') + '" data-assignment-toggle data-assignment-step="' + escapeHtml(step.id || "") + '" data-assignment-group="' + escapeHtml(group.id || group.label || "") + '" data-assignment-field="' + escapeHtml(field) + '" data-assignment-value="' + escapeHtml(value) + '" data-assignment-item="' + escapeHtml(item.value || "") + '" aria-pressed="' + (selected ? 'true' : 'false') + '">',
          '<span>' + escapeHtml(group.label || group.id || "") + '</span>',
          '<span class="pf-assignment-card-check" aria-hidden="true">' + ICON_CHECK + '</span>',
          '</button>'
        ].join("");
      }).join("") + '</span>';

      return [
        '<div class="cadernos-cover-choice pf-assignment-choice">',
        '<div class="choice-card crachas-size-card cadernos-cover-card pf-assignment-card' + (itemGroups.length ? ' is-assigned' : '') + muted + (open ? ' is-open' : '') + (opening ? ' is-opening' : '') + '" data-assignment-preview-open data-assignment-step="' + escapeHtml(step.id || "") + '" data-assignment-value="' + escapeHtml(item.value || "") + '" role="button" tabindex="0" aria-label="Mostrar opções para ' + escapeHtml(item.title || item.value || "este design") + '" aria-expanded="' + (open ? 'true' : 'false') + '">',
        '<div class="pf-assignment-card-media">',
        '<div class="pf-assignment-card-trigger">',
        renderAssignmentPickerCardMedia(product, step, sourceStep, item, displayItems),
        '</div>',
        controls,
        '</div>',
        '<span class="pf-assignment-card-footer">',
        '<span class="choice-copy crachas-size-card-text"><strong>' + escapeHtml(item.title || item.value || "Opção") + '</strong>' + (item.subtitle ? '<span>' + escapeHtml(item.subtitle) + '</span>' : '') + '</span>',
        '</span>',
        adminItemControls(sourceStep, item),
        '</div>',
        '</div>'
      ].join("");
    }).join("");
    // Com várias unidades a gaveta de pré-visualização baralha: a carta já
    // mostra para onde vai a escolha.
    var preview = openItem && !configuredUnitsActive(product, step)
      ? '<div class="pf-assignment-preview-row" style="--assignment-preview-row-one:' + (openIndex + 2) + ';--assignment-preview-row-three:' + (Math.floor(openIndex / 3) + 2) + ';--assignment-preview-row-two:' + (Math.floor(openIndex / 2) + 2) + '">' + renderAssignmentPickerPreview(product, step, openItem) + '</div>'
      : "";

    return [
      '<div class="pasta-de-folhetos-fluid pf-assignment-picker">',
      // Com várias unidades, a fila de miniaturas já mostra estas escolhas.
      configuredUnitLayoutActive(product, step) ? "" : renderAssignmentPickerSlots(product, step),
      '<div class="option-list size-choice-list crachas-size-card-list cadernos-cover-list pf-fluid-cover-list pf-assignment-list">',
      cards,
      preview,
      renderOwnDesignCards(product, step),
      '</div>',
      renderAssignmentPickerUndo(step),
      '</div>'
    ].join("");
  }

  // CONTINUOUS_CONFIGURATOR_V1: alguns produtos têm várias decisões que
  // pertencem visualmente à mesma personalização. O passo principal declara
  // os passos de variação/extras no JSON; esses passos podem ficar escondidos
  // no wizard público sem alterar os campos enviados ao checkout.
  function continuousConfiguratorConfig(step) {
    var config = step && step.continuousConfigurator;
    return config && config.enabled === true ? config : null;
  }

  function continuousConfiguratorStep(product, step, key) {
    var config = continuousConfiguratorConfig(step);
    var id = config ? String(config[key] || "") : "";
    return id ? findStep(product, id) : null;
  }

  function continuousConfiguratorSelectedItem(step, group) {
    var field = groupedDesignField(step, group);
    var value = field ? String(state.selections[field] || "") : "";
    return groupedDesignItems(step, group).filter(function (item) {
      return item && String(item.value || "") === value;
    })[0] || null;
  }

  function syncContinuousConfigurator(product, step) {
    var config = continuousConfiguratorConfig(step);
    var variationStep = continuousConfiguratorStep(product, step, "variationStepId");
    var groups;

    if (!config || !variationStep) {
      return;
    }

    groups = designGroupsForStep(step);
    groups.forEach(function (group) {
      var coverField = groupedDesignField(step, group);
      var coverValue = coverField ? String(state.selections[coverField] || "") : "";
      var variationField = groupedDesignField(variationStep, group);
      var variations = coverValue ? groupedDesignItems(variationStep, group) : [];
      var currentValue = variationField ? String(state.selections[variationField] || "") : "";
      var currentValid = currentValue && variations.some(function (item) {
        return item && String(item.value || "") === currentValue;
      });

      if (!variationField) {
        return;
      }
      if (!coverValue) {
        delete state.selections[variationField];
        return;
      }
      if (!currentValid) {
        var defaultItem = variations.filter(function (it) {
          return it && (it.default === true || it.isDefault === true);
        })[0] || null;
        var shouldPreselect = !!defaultItem
          || variations.length === 1
          || Boolean(config && (config.defaultToFirst || config.defaultToFirstVariation || config.preselectDefault))
          || Boolean(variationStep && (variationStep.defaultToFirst || variationStep.defaultToFirstVariation || variationStep.preselectDefault));

        if (shouldPreselect && variations.length) {
          state.selections[variationField] = (defaultItem || variations[0]).value;
        } else {
          delete state.selections[variationField];
        }
      }
    });

    syncGroupedDesignSelections(product, variationStep);
    ensureOptionDrawerSelections(product);
  }

  function renderContinuousVariationPicker(product, step, group) {
    var config = continuousConfiguratorConfig(step) || {};
    var variationStep = continuousConfiguratorStep(product, step, "variationStepId");
    var coverField = groupedDesignField(step, group);
    var coverValue = coverField ? String(state.selections[coverField] || "") : "";
    var variationField = variationStep ? groupedDesignField(variationStep, group) : "";
    var variations = variationStep && coverValue ? groupedDesignItems(variationStep, group) : [];
    var selectedValue = variationField ? String(state.selections[variationField] || "") : "";
    var invalid = state.invalidFields && state.invalidFields.indexOf(variationField) !== -1;

    if (!coverValue || !variationStep || !variationField || !variations.length) {
      return "";
    }

    if (variations.length === 1) {
      return [
        '<div class="pf-fluid-variation is-auto">',
        '<div class="pf-fluid-variation-heading"><strong>' + escapeHtml(config.variationTitle || "Argolas e fita") + '</strong></div>',
        '<div class="pf-fluid-auto-note"><span class="pf-fluid-auto-check" aria-hidden="true">✓</span><span>Esta capa só existe com <b>' + escapeHtml(variations[0].title || variations[0].value || "esta combinação") + '</b> — já ficou escolhida automaticamente.</span></div>',
        '</div>'
      ].join("");
    }

    return [
      '<div class="pf-fluid-variation' + (invalid ? ' is-missing' : '') + '">',
      '<div class="pf-fluid-variation-heading"><strong>' + escapeHtml(config.variationTitle || "Argolas e fita") + '</strong><small>Escolhe a combinação para esta capa.</small></div>',
      '<div class="pf-fluid-variation-list" role="radiogroup" aria-label="' + escapeHtml((config.variationTitle || "Argolas e fita") + " " + group) + '">',
      variations.map(function (item) {
        var checked = selectedValue === String(item.value || "");
        return [
          '<label class="pf-fluid-variation-choice' + (checked ? ' is-selected' : '') + '">',
          '<input type="radio" name="' + escapeHtml(variationField) + '" value="' + escapeHtml(item.value || "") + '" data-continuous-variation-choice data-continuous-variation-step="' + escapeHtml(variationStep.id || "") + '" data-continuous-variation-field="' + escapeHtml(variationField) + '" data-continuous-variation-group="' + escapeHtml(group) + '"' + (checked ? ' checked' : '') + '>',
          '<span class="pf-fluid-variation-media">' + renderVisual(item, "media-list", variationStep) + '</span>',
          '<span class="pf-fluid-variation-copy"><strong>' + escapeHtml(item.title || item.value || "Opção") + '</strong>' + (item.subtitle ? '<small>' + escapeHtml(item.subtitle) + '</small>' : '') + '</span>',
          '<span class="pf-fluid-variation-check" aria-hidden="true">✓</span>',
          '</label>'
        ].join("");
      }).join(""),
      '</div>',
      '</div>'
    ].join("");
  }

  function renderContinuousConfiguratorSummary(product, step) {
    var config = continuousConfiguratorConfig(step) || {};
    var variationStep = continuousConfiguratorStep(product, step, "variationStepId");
    var extrasStep = continuousConfiguratorStep(product, step, "extrasStepId");
    var groups = designGroupsForStep(step);
    var size = String(state.selections[step.sizeField || "size"] || "");
    var info = priceInfo(product);
    var rows = [];

    if (size) {
      rows.push('<div class="pf-fluid-summary-row"><span>Formato</span><strong>' + escapeHtml(size) + '</strong></div>');
    }

    groups.forEach(function (group) {
      var coverItem = continuousConfiguratorSelectedItem(step, group);
      var variationItem = variationStep ? continuousConfiguratorSelectedItem(variationStep, group) : null;
      if (coverItem) {
        rows.push('<div class="pf-fluid-summary-row"><span>Capa ' + escapeHtml(group) + '</span><strong>' + escapeHtml(coverItem.title || coverItem.value || "") + '</strong></div>');
      }
      if (variationItem) {
        rows.push('<div class="pf-fluid-summary-row"><span>Argolas + fita ' + escapeHtml(group) + '</span><strong>' + escapeHtml(variationItem.title || variationItem.value || "") + '</strong></div>');
      }
    });

    if (extrasStep && Array.isArray(extrasStep.drawers)) {
      extrasStep.drawers.forEach(function (drawer) {
        var selected = drawer && drawer.field ? optionDrawerItem(drawer, state.selections[drawer.field], product) : null;
        if (selected) {
          rows.push('<div class="pf-fluid-summary-row"><span>' + escapeHtml(drawer.title || drawer.label || "Opção") + '</span><strong>' + escapeHtml(selected.title || selected.value || "") + '</strong></div>');
        }
      });
    }

    if (info && info.total) {
      rows.push('<div class="pf-fluid-summary-row pf-fluid-summary-total"><span>Total</span><strong>' + escapeHtml(info.total) + '</strong></div>');
    }

    return [
      '<aside class="pf-fluid-summary" aria-live="polite">',
      '<h3>' + escapeHtml(config.summaryTitle || "O que vais encomendar") + '</h3>',
      rows.length ? rows.join("") : '<p>Escolhe o formato para começar.</p>',
      '</aside>'
    ].join("");
  }

  function renderContinuousConfigurator(product, step) {
    var config = continuousConfiguratorConfig(step) || {};
    var groups;
    var titles = step && step.groupTitles && typeof step.groupTitles === "object" ? step.groupTitles : {};
    var extrasStep = continuousConfiguratorStep(product, step, "extrasStepId");
    var html;

    syncContinuousConfigurator(product, step);
    groups = designGroupsForStep(step);
    html = '<div class="pasta-de-folhetos-fluid">' + renderGroupedFormatChoices(product, step) + renderDesignActionControls(product, step);

    if (!groups.length) {
      return html + '<p class="open-order-hint" role="status">Escolhe primeiro um tamanho.</p></div>';
    }

    groups.forEach(function (group) {
      var field = groupedDesignField(step, group);
      var selected = field ? String(state.selections[field] || "") : "";
      var selectedVariation = continuousConfiguratorStep(product, step, "variationStepId");
      var selectedVariationItem = selectedVariation ? continuousConfiguratorSelectedItem(selectedVariation, group) : null;
      var items = groupedDesignItems(step, group);
      var coverMissing = state.invalidFields && state.invalidFields.indexOf(field) !== -1;
      var cards = items.map(function (item) {
        var checked = selected === String(item.value || "");
        var displayItem = checked && selectedVariationItem && selectedVariationItem.image
          ? Object.assign({}, item, { image: selectedVariationItem.image })
          : item;
        return [
          '<div class="cadernos-cover-choice grouped-design-choice">',
          '<label class="choice-card crachas-size-card cadernos-cover-card' + (checked ? ' is-selected' : '') + '">',
          '<input type="radio" name="' + escapeHtml(field) + '" value="' + escapeHtml(item.value || "") + '" data-grouped-design-choice data-grouped-design-group="' + escapeHtml(group) + '" data-grouped-design-field="' + escapeHtml(field) + '"' + (checked ? ' checked' : '') + '>',
          renderCadernoCoverCardMedia(product, step, displayItem),
          '<span class="choice-copy crachas-size-card-text"><strong>' + escapeHtml(item.title || item.value || "Opção") + '</strong>' + (item.subtitle ? '<span>' + escapeHtml(item.subtitle) + '</span>' : '') + '</span>',
          '<span class="crachas-size-card-selected" aria-hidden="true">✓</span>',
          adminItemControls(step, item),
          '</label>',
          '</div>'
        ].join("");
      }).join("");

      html += [
        '<section class="pf-fluid-size-section' + (coverMissing ? ' is-missing' : '') + '" data-design-size-group="' + escapeHtml(group) + '">',
        '<div class="pf-fluid-size-heading"><div><span class="pf-fluid-size-kicker">' + escapeHtml(group) + '</span><h3>' + escapeHtml(titles[group] || ("Personaliza o " + group)) + '</h3></div>' + (selected ? '<span class="pf-fluid-done">✓ Capa escolhida</span>' : '') + '</div>',
        '<h4 class="pf-fluid-subtitle">' + escapeHtml(config.coverTitle || "Escolhe a capa") + '</h4>',
        '<div class="option-list size-choice-list crachas-size-card-list cadernos-cover-list pf-fluid-cover-list">' + cards + '</div>',
        renderContinuousVariationPicker(product, step, group),
        '</section>'
      ].join("");
    });

    if (extrasStep) {
      html += [
        '<section class="pf-fluid-extras">',
        '<div class="pf-fluid-size-heading"><div><span class="pf-fluid-size-kicker">Final</span><h3>' + escapeHtml(config.extrasTitle || extrasStep.title || "Acabamento e extras") + '</h3></div></div>',
        extrasStep.text ? '<p class="pf-fluid-extras-copy">' + escapeHtml(extrasStep.text) + '</p>' : '',
        renderOptionDrawerCards(product, extrasStep),
        '</section>'
      ].join("");
    }

    html += renderContinuousConfiguratorSummary(product, step) + '</div>';
    return html;
  }

  function renderDesignsBySizeStep(product, step) {
    if (continuousConfiguratorConfig(step)) {
      return renderContinuousConfigurator(product, step);
    }

    var groups = designGroupsForStep(step);
    var titles = step && step.groupTitles && typeof step.groupTitles === "object" ? step.groupTitles : {};
    var verticalColumns = step && step.display === "pasta-de-folhetos-design-columns";
    var html = (verticalColumns ? '<div class="pasta-de-folhetos-fluid pf-design-step">' : '')
      + renderCopySelectionButton(step)
      + renderGroupedFormatChoices(product, step)
      + renderDesignActionControls(product, step);

    syncGroupedDesignSelections(product, step);

    if (!groups.length) {
      return html + '<p class="open-order-hint" role="status">Escolhe primeiro um tamanho.</p>'
        + (verticalColumns ? '</div>' : '');
    }

    // A grelha representa apenas a unidade activa, tal como na compra de uma capa.
    groups.forEach(function (group, groupIndex) {
      var field = groupedDesignField(step, group);
      var selected = field ? String(state.selections[field] || "") : "";
      var items = groupedDesignItems(step, group);
      var previewValue = selected;
      var selectedItem = previewValue ? items.filter(function (item) {
        return String(item.value || "") === previewValue;
      })[0] || null : null;
      var selectedIndex = selectedItem ? items.indexOf(selectedItem) : -1;
      var cards = items.map(function (item) {
        var checked = selected === String(item.value || "");
        var muted = selected && !checked ? " is-muted" : "";
        return [
          '<div class="cadernos-cover-choice grouped-design-choice">',
          '<label class="choice-card crachas-size-card cadernos-cover-card' + (checked ? ' is-selected' : '') + muted + '">',
          '<input type="radio" name="' + escapeHtml(field) + '" value="' + escapeHtml(item.value || "") + '" data-grouped-design-choice data-grouped-design-group="' + escapeHtml(group) + '" data-grouped-design-field="' + escapeHtml(field) + '"' + (checked ? ' checked' : '') + '>',
          renderCadernoCoverCardMedia(product, step, item),
          '<span class="choice-copy crachas-size-card-text">',
          '<strong>' + escapeHtml(item.title || item.value || "Opção") + '</strong>',
          item.subtitle ? '<span>' + escapeHtml(item.subtitle) + '</span>' : '',
          '</span>',
          '<span class="crachas-size-card-selected" aria-hidden="true">✓</span>',
          adminItemControls(step, item),
          '</label>',
          '</div>'
        ].join("");
      }).join("");
      var selectedPreview = "";
      if (selectedItem && step.selectedImagePreview && !configuredUnitsActive(product, step)) {
        if (step.selectedImagePreview.variationStepId) {
          selectedPreview = '<div class="grouped-design-selected-preview" data-selected-image-preview role="status" aria-live="polite" style="--selected-preview-row-three:' + (Math.floor(selectedIndex / 3) + 2) + ';--selected-preview-row-two:' + (Math.floor(selectedIndex / 2) + 2) + '">'
            + renderPreviewDrawer(product, selectedItem.value, selectedItem.id, previewDrawerFrames(singlePreviewDrawerItems(product, step, selectedItem, group), false), step.selectedImagePreview.drawerHint)
            + '</div>';
        } else {
          selectedPreview = '<div class="grouped-design-selected-preview" data-selected-image-preview role="status" aria-live="polite" style="--selected-preview-row-three:' + (Math.floor(selectedIndex / 3) + 2) + ';--selected-preview-row-two:' + (Math.floor(selectedIndex / 2) + 2) + '">' + renderCadernosProofPhoto(selectedItem, step.selectedImagePreview.label || "Imagem ilustrativa") + '</div>';
        }
      }

      html += [
        '<section class="design-grid-section grouped-design-section" data-design-size-group="' + escapeHtml(group) + '">',
        '<h3 class="design-grid-section-title">' + escapeHtml(titles[group] || ("Escolhe o design " + group)) + '</h3>',
        '<div class="option-list size-choice-list crachas-size-card-list cadernos-cover-list' + (verticalColumns ? ' pf-fluid-cover-list' : '') + '">' + cards + selectedPreview + (groupIndex === groups.length - 1 ? renderOwnDesignCards(product, step) : '') + '</div>',
        '</section>'
      ].join("");
    });

    return html + (verticalColumns ? '</div>' : '');
  }

  function stepBody(product, step) {
    if (step.template === "assignment-picker" && assignmentPickerConfig(step)) {
      return renderAssignmentPicker(product, step);
    }

    if (step.template === "designs-by-size") {
      return renderDesignsBySizeStep(product, step);
    }

    if (isQuadrosProduct(product) && step.id === "designs") {
      return renderQuadrosDesignStep(product, step);
    }

    if ((isCadernosProduct(product) || step.display === "cover-drawer") && step.id === "designs") {
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

    if (step.template === "cover-personalization") {
      return renderCadernoPersonalizationStep(product, step) + (isCadernosProduct(product) ? renderCadernosBuildSummaryV2(product, step) : "");
    }

    if (step.template === "quantity-builder") {
      return renderInteriorSlideshow(product) + renderQuantityBuilder(product);
    }

    if (step.display === "pasta-de-folhetos-size") {
      return renderPastaDeFolhetosSizeStep(product, step);
    }

    if (step.pastaDeFolhetosDetails) {
      return renderPastaDeFolhetosDetails(product, step);
    }

    if (step.template === "option-drawers" && (step.display === "cards" || step.display === "pasta-de-folhetos-finish-cards")) {
      return (productFamily(product) === "pasta-de-folhetos" ? '<div class="pasta-de-folhetos-fluid pf-finish-step">' : '')
        + renderCopySelectionButton(step)
        + renderOptionDrawerCards(product, step)
        + (productFamily(product) === "pasta-de-folhetos" ? '</div>' : '')
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
      if (step.display === "crachas-cards" || (product && productFamily(product) === "crachas")) {
        return renderCrachasSizeStep(product, step);
      }
      if (step.display === "purchase-cards") {
        return renderFixedPurchaseSizeStep(product, step);
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

    steps = steps.filter(function (step) {
      return step && step.dataOnly !== true;
    });

    steps = steps.filter(stepConditionMatches);

    return state.admin ? steps : steps.filter(function (step) {
      if (isCustomArtworkSelected(product) && !isCadernosProduct(product) && step && step.id === "pack" && step.freeQuantity === true) {
        return false;
      }
      return !step.hidden;
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

  function stepLeadTimeNotice(product, step) {
    var defaultText = "Os pedidos devem ser feitos com, pelo menos, 7 dias de antecedência em relação à data em que pretendes que sejam enviados.";

    if (state.currentStep !== 0 || !step) {
      return "";
    }
    if (Object.prototype.hasOwnProperty.call(step, "leadTimeNotice")) {
      return String(step.leadTimeNotice || "").trim();
    }
    return defaultText;
  }

  function renderStepLeadTimeNotice(product, step) {
    var notice = stepLeadTimeNotice(product, step);
    return notice
      ? '<p class="order-lead-time-notice">' + escapeHtml(notice) + '</p>'
      : "";
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
        var isVisited;
        var position = steps.length <= 1 ? 100 : (index / (steps.length - 1)) * 100;
        var classes = index < activeIndex ? "is-complete" : (index === activeIndex ? "is-active" : "is-future");
        var disabled;
        var stepLabel = "Passo " + (index + 1) + ": " + (step.label || "Pedido");

        stepIndex = stepIndex >= 0 ? stepIndex : index;
        isVisited = stepIndex <= state.maxVisitedStep;
        disabled = !state.admin && !isVisited;

        return [
          '<li class="' + classes + '" style="left:' + position.toFixed(3) + '%">',
          '<button type="button" data-jump-step="' + stepIndex + '" aria-label="' + escapeHtml(stepLabel) + '" title="' + escapeHtml(stepLabel) + '"' + (index === activeIndex ? ' aria-current="step"' : '') + (disabled ? ' disabled' : '') + '>',
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
    if (step && step.multipleTitle && configuredUnitLayoutActive(product, step)) {
      return String(step.multipleTitle);
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

  // UNIT_CONFIGURATION_V1: com "unitConfiguration" no JSON do produto, o passo
  // das capas ganha um seletor de quantidade. Cada unidade guarda as suas
  // escolhas em selections.configured_units e o configurador de sempre edita a
  // unidade activa: state.selections tem sempre os campos dessa unidade. A fila
  // de miniaturas mostra as unidades; no carrinho, cada uma é uma linha normal,
  // validada e calculada pelo servidor. Com quantidade 1 nada disto aparece.
  function unitConfiguration(product) {
    var config = product && product.unitConfiguration;
    return config && Array.isArray(config.fields) ? config : null;
  }

  function configuredUnitList() {
    return Array.isArray(state.selections.configured_units) ? state.selections.configured_units : [];
  }

  function configuredUnitIndex(product) {
    var units = configuredUnitList();
    return Math.max(0, Math.min(units.length ? units.length - 1 : 0, state.configuredUnitIndex || 0));
  }

  function configuredUnitFields(product) {
    var result = {};
    (unitConfiguration(product).fields || []).forEach(function (key) {
      if (state.selections[key] !== undefined) result[key] = cloneJson(state.selections[key]);
    });
    return result;
  }

  function saveConfiguredUnit(product) {
    var units = configuredUnitList();
    if (unitConfiguration(product) && units.length) units[configuredUnitIndex(product)] = configuredUnitFields(product);
  }

  function loadConfiguredUnit(product, index) {
    var units = configuredUnitList();
    if (!units[index]) return;
    (unitConfiguration(product).fields || []).forEach(function (key) {
      delete state.selections[key];
      if (units[index][key] !== undefined) state.selections[key] = cloneJson(units[index][key]);
    });
    state.configuredUnitIndex = index;
    if (state.assignmentPickerUnit !== index) {
      state.assignmentPickerOpen = {};
      state.assignmentPickerUnit = index;
    }
    // O "reverter" aponta para um campo da unidade que o criou; o das acções
    // "em todas" vale para todas as unidades e fica.
    state.assignmentPickerUndos = configuredUnitActionUndos();
    if (state.assignmentPickerUndoInterval) {
      window.clearInterval(state.assignmentPickerUndoInterval);
      state.assignmentPickerUndoInterval = null;
    }
  }

  function configuredUnitCount(product) {
    return unitConfiguration(product) ? Math.max(1, configuredUnitList().length) : 1;
  }

  // Os textos têm uma variante "pack…" para quando o tamanho escolhido é o
  // conjunto (ex.: label/packLabel, nextLabel/packNextLabel).
  function configuredUnitText(product, key) {
    var config = unitConfiguration(product) || {};
    var packKey = "pack" + key.charAt(0).toUpperCase() + key.slice(1);
    var isPack = config.packSize && String(state.selections[config.sizeField || "size"] || "") === String(config.packSize);
    return String((isPack && config[packKey]) || config[key] || "");
  }

  function configuredUnitLabel(product) {
    return configuredUnitText(product, "label") || "Unidade";
  }

  function isConfiguredUnitStep(product, step) {
    var config = unitConfiguration(product);
    return !!(config && step && (config.stepIds || []).indexOf(step.id) !== -1);
  }

  function isConfiguredQuantityStep(product, step) {
    var config = unitConfiguration(product);
    return !!(config && step && (config.quantityStepIds || []).indexOf(step.id) !== -1);
  }

  function configuredUnitsActive(product, step) {
    return !state.admin && isConfiguredUnitStep(product, step) && configuredUnitCount(product) > 1;
  }

  // Os tamanhos em unitConfiguration.singleUnitLayoutSizes usam a fila, as
  // cartas e os passos em linhas já com uma só unidade. Só muda o desenho: a
  // unidade continua a viver em state.selections, como sempre.
  function configuredUnitLayoutActive(product, step) {
    var config = unitConfiguration(product);
    if (configuredUnitsActive(product, step)) return true;
    if (!config || state.admin || !isConfiguredUnitStep(product, step)) return false;
    return (config.singleUnitLayoutSizes || []).indexOf(String(state.selections[config.sizeField || "size"] || "")) !== -1;
  }

  // Unidades a desenhar: com uma só, a própria escolha actual.
  function configuredUnitViewList(product) {
    return configuredUnitList().length ? configuredUnitList() : [configuredUnitFields(product)];
  }

  // Passos de escolha (capas, acabamento): a grelha escolhe para a unidade
  // destacada e o destaque salta para a próxima por escolher.
  function isConfiguredPickStep(product, step) {
    var config = unitConfiguration(product);
    var ids = config && (config.pickStepIds || config.quantityStepIds) || [];
    return !!(step && ids.indexOf(step.id) !== -1);
  }

  // Passos em linhas (nomes, detalhes): uma linha por unidade, tudo à vista.
  function isConfiguredRowStep(product, step) {
    var config = unitConfiguration(product);
    return !!(config && step && (config.rowStepIds || []).indexOf(step.id) !== -1);
  }

  // Nos restantes passos o "Continuar" passa pelas unidades uma a uma.
  function configuredUnitsPending(product, step) {
    return configuredUnitsActive(product, step) && !isConfiguredPickStep(product, step)
      && !isConfiguredRowStep(product, step)
      && configuredUnitIndex(product) < configuredUnitCount(product) - 1;
  }

  function configuredUnitFirstPending(ready) {
    return ready.indexOf(false);
  }

  // Grupos de capa de cada unidade (A4, ou A4 + A6), lidos do passo das capas
  // que está visível para o tamanho escolhido.
  function configuredUnitCoverGroups(product) {
    var config = unitConfiguration(product);
    var step = config ? visibleSteps(product).filter(function (candidate) {
      return (config.quantityStepIds || []).indexOf(candidate.id) !== -1;
    })[0] : null;
    var assignment = assignmentPickerConfig(step);
    var source;
    if (!step) return [];
    if (assignment) {
      source = assignmentPickerSourceStep(product, step);
      return assignment.groups.map(function (group) {
        return { id: String(group.id || group.label || ""), field: String(group.field || ""), step: source, cover: true };
      });
    }
    return designGroupsForStep(step).map(function (group) {
      return { id: group, field: groupedDesignField(step, group), step: step, cover: true };
    });
  }

  function configuredUnitCoverItem(group, unit) {
    var value = String(unit && unit[group.field] || "");
    if (group.cover && value === OWN_DESIGN_VALUE) return ownDesignItem(ownDesignUpload(unit));
    return value ? (group.items || (group.step && group.step.items) || []).filter(function (item) {
      return String(item.value || "") === value;
    })[0] || null : null;
  }

  // Lugares de cada unidade na fila do passo: as capas no passo das capas;
  // nos outros passos de escolha (acabamento), os campos desse passo — um por
  // tamanho no conjunto.
  function configuredUnitSlotGroups(product, step) {
    var assignment;
    var items;
    var source;
    if (!step || !isConfiguredPickStep(product, step) || isConfiguredQuantityStep(product, step)) return configuredUnitCoverGroups(product);
    assignment = assignmentPickerConfig(step);
    if (assignment) {
      items = assignmentPickerItems(product, step);
      source = assignmentPickerSourceStep(product, step);
      return assignment.groups.map(function (group) {
        return { id: String(group.id || group.label || ""), field: String(group.field || ""), step: source, items: items };
      });
    }
    return optionDrawersForStep(product, step).map(function (drawer) {
      return { id: String(drawer.id || drawer.field || ""), field: String(drawer.field || ""), step: step, items: drawer.items || [] };
    });
  }

  function configuredUnitIsComplete(product, unit, step) {
    var groups = configuredUnitSlotGroups(product, step);
    return groups.length > 0 && groups.every(function (group) {
      return !!configuredUnitCoverItem(group, unit);
    });
  }

  // Depois de uma escolha que completa a unidade activa, o destaque segue para
  // a próxima unidade sem capa. Trocar a capa de uma unidade já completa não
  // mexe no destaque (e mantém o "reverter" do conjunto válido).
  function advanceConfiguredUnitAfterChoice(product, step, wasReady) {
    var ready;
    var index;
    var i;
    if (!configuredUnitsActive(product, step) || !isConfiguredPickStep(product, step)) return;
    ready = configuredUnitsStepReady(product, step);
    index = configuredUnitIndex(product);
    if (!ready[index]) return;
    // Trocar a escolha de uma unidade pronta também anima a miniatura.
    state.configuredUnitFilled = index;
    if (wasReady) return;
    for (i = 1; i < ready.length; i += 1) {
      if (!ready[(index + i) % ready.length]) {
        loadConfiguredUnit(product, (index + i) % ready.length);
        return;
      }
    }
  }

  function configuredUnitActiveReady(product, step) {
    return !!(configuredUnitsActive(product, step) && configuredUnitsStepReady(product, step)[configuredUnitIndex(product)]);
  }

  function setConfiguredUnitCount(product, quantity) {
    var config = unitConfiguration(product);
    var index;
    var units;
    var i;
    if (!config) return;
    saveConfiguredUnit(product);
    index = configuredUnitIndex(product);
    units = configuredUnitList().length ? configuredUnitList() : [configuredUnitFields(product)];
    quantity = Math.max(1, Math.min(config.maxQuantity || 30, parseInt(quantity, 10) || 1));
    // Reduzir e voltar a aumentar devolve as escolhas das unidades retiradas.
    if (!configuredUnitList().length) state.configuredUnitStash = [];
    if (!state.configuredUnitStash) state.configuredUnitStash = [];
    units.slice(quantity).forEach(function (unit, offset) { state.configuredUnitStash[quantity + offset] = unit; });
    while (units.length < quantity) units.push(state.configuredUnitStash[units.length] || {});
    units = units.slice(0, quantity);
    state.selections.configured_units = units;
    state.configuredUnitSameName = false;
    state.configuredUnitActionUndo = null;
    state.assignmentPickerUndos = (state.assignmentPickerUndos || []).filter(function (undo) { return undo.kind !== "unit-action"; });
    Object.keys(state.configuredUnitSeen || {}).forEach(function (stepId) {
      Object.keys(state.configuredUnitSeen[stepId]).forEach(function (seen) {
        if (Number(seen) >= quantity) delete state.configuredUnitSeen[stepId][seen];
      });
    });
    index = Math.min(index, quantity - 1);
    // Ao acrescentar, o destaque vai logo para a primeira unidade por escolher.
    if (configuredUnitIsComplete(product, units[index])) {
      for (i = 0; i < units.length; i += 1) {
        if (!configuredUnitIsComplete(product, units[i])) { index = i; break; }
      }
    }
    loadConfiguredUnit(product, index);
  }

  // Ao passar para a unidade seguinte com "Continuar", os campos de
  // carryOverFields (acabamento, cantos…) vêm da anterior se esta ainda não
  // passou por este passo — é só um ponto de partida, mudam-se à vontade.
  function showNextConfiguredUnit(product, step) {
    var config = unitConfiguration(product);
    var from = configuredUnitIndex(product);
    var to = from + 1;
    var units = configuredUnitList();
    var seen = state.configuredUnitSeen && state.configuredUnitSeen[step.id] || {};
    saveConfiguredUnit(product);
    if (!units[to]) return;
    if (!seen[to]) {
      (config.carryOverFields || []).forEach(function (key) {
        if (units[to][key] === undefined && units[from][key] !== undefined) units[to][key] = cloneJson(units[from][key]);
      });
    }
    loadConfiguredUnit(product, to);
  }

  function markConfiguredUnitSeen(product, step) {
    if (!state.configuredUnitSeen) state.configuredUnitSeen = {};
    if (!state.configuredUnitSeen[step.id]) state.configuredUnitSeen[step.id] = {};
    state.configuredUnitSeen[step.id][configuredUnitIndex(product)] = true;
  }

  function configuredUnitSelections(product) {
    var base;
    var units;
    saveConfiguredUnit(product);
    base = cloneJson(state.selections);
    units = base.configured_units && base.configured_units.length ? base.configured_units : [configuredUnitFields(product)];
    delete base.configured_units;
    return units.map(function (unit) {
      var selections = cloneJson(base);
      (unitConfiguration(product).fields || []).forEach(function (key) { delete selections[key]; });
      return Object.assign(selections, cloneJson(unit));
    });
  }

  // Um passo pronto para cada unidade, sem tocar na unidade activa.
  function configuredUnitsStepReady(product, step) {
    var original = state.selections;
    var invalid = state.invalidFields;
    var list = configuredUnitSelections(product);
    try {
      return list.map(function (selections) {
        state.selections = selections;
        return !validateSingleUnitStep(product, step);
      });
    } finally {
      state.selections = original;
      state.invalidFields = invalid;
    }
  }

  function configuredDesignValueCounts(product, field) {
    var counts = {};
    saveConfiguredUnit(product);
    configuredUnitList().forEach(function (unit) {
      var value = String(unit[field] || "");
      if (value) counts[value] = (counts[value] || 0) + 1;
    });
    return counts;
  }

  // Fora do passo das capas, cada lugar leva a capa da unidade num canto,
  // para se saber a que pasta vai o acabamento.
  function configuredUnitCoversHtml(product, unit, step) {
    var groups = configuredUnitSlotGroups(product, step);
    var covers = configuredUnitCoverGroups(product);
    var withRef = !!(step && isConfiguredPickStep(product, step) && !isConfiguredQuantityStep(product, step) && groups.length && covers.length);
    var assorted = isAssortedSelected(product);
    return groups.map(function (group, index) {
      var item = configuredUnitCoverItem(group, unit);
      var mia = item ? !!item.miaChoice : assorted && !withRef;
      var coverGroup = withRef ? covers.filter(function (candidate) { return candidate.id === group.id; })[0] || covers[index] || covers[0] : null;
      var ref = coverGroup ? configuredUnitCoverItem(coverGroup, unit) : null;
      if (item && item.miaChoice) item = null;
      return '<span class="unit-slot-cover' + (item ? '' : ' is-empty' + (mia ? ' is-mia' : '')) + (withRef ? ' has-ref' : '') + '">'
        + (item ? renderUnitVisual(item, group.step) : '')
        + (ref ? '<span class="unit-slot-ref">' + renderUnitVisual(ref, coverGroup.step) + '</span>' : '')
        + '</span>';
    }).join("");
  }

  // Três por linha no telemóvel. Nos ecrãs largos, entre três e cinco
  // consoante a altura: só num ecrã alto a fila de uma linha, colada ao topo,
  // não rouba espaço à grelha; num baixo passa mais cedo a duas linhas e a
  // versão pequena da fila toma o lugar dela ao descer.
  function configuredUnitTrayColumns() {
    var height = window.innerHeight || 0;
    if (!window.matchMedia || !window.matchMedia("(min-width: 600px)").matches) return 3;
    return height >= 900 ? 5 : height >= 720 ? 4 : 3;
  }

  // No telemóvel, com mais unidades do que colunas, a fila é sempre uma faixa
  // de uma linha que desliza (em vez de várias linhas): poupa altura.
  function configuredUnitStripMode(count) {
    var wide = window.matchMedia && window.matchMedia("(min-width: 600px)").matches;
    return !wide && count > configuredUnitTrayColumns();
  }

  function watchConfiguredUnitTrayColumns(product) {
    var timer;
    state.configuredUnitColumns = configuredUnitTrayColumns();
    if (state.configuredUnitResizeBound) return;
    state.configuredUnitResizeBound = true;
    window.addEventListener("resize", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        if (!document.querySelector("[data-unit-tray], [data-unit-mini]")) return;
        if (configuredUnitTrayColumns() === state.configuredUnitColumns
          && !!document.querySelector("[data-unit-mini].is-strip") === configuredUnitStripMode(configuredUnitCount(product))) return;
        rerenderProduct(state.product || product);
      }, 150);
    });
  }

  function renderConfiguredUnitTray(product, step) {
    var units = configuredUnitViewList(product);
    var index = configuredUnitIndex(product);
    var groups = configuredUnitSlotGroups(product, step);
    var label = configuredUnitLabel(product);
    var quantityStep = isConfiguredQuantityStep(product, step);
    var pick = isConfiguredPickStep(product, step);
    var ready = configuredUnitsStepReady(product, step);
    var firstPending = configuredUnitFirstPending(ready);
    var previousCount = state.configuredUnitTrayCount || 0;
    var filled = state.configuredUnitFilled;
    var columns = configuredUnitTrayColumns();
    var marker = '<span class="unit-active-marker" data-unit-marker aria-hidden="true"></span>';
    var slots;
    var html;

    state.configuredUnitTrayCount = units.length;
    state.configuredUnitFilled = null;
    function slotHtml(unit, unitIndex, mini) {
      var complete = configuredUnitIsComplete(product, unit, step);
      // Entre as unidades por escolher, só a próxima se pode abrir.
      var locked = pick && !ready[unitIndex] && unitIndex !== firstPending && unitIndex !== index;
      var covers = configuredUnitCoversHtml(product, unit, step);
      var badge = quantityStep ? '' : ready[unitIndex]
        ? '<span class="unit-slot-ready" aria-hidden="true">' + ICON_CHECK + '</span>'
        : (pick ? '<span class="unit-slot-ready is-pending" aria-hidden="true">?</span>' : '');
      return [
        '<button type="button" class="unit-slot' + (groups.length > 1 ? ' is-pair' : '')
          + (unitIndex === index ? ' is-active' : '')
          + (complete ? '' : ' is-empty')
          + (!quantityStep && ready[unitIndex] ? ' is-ready' : '')
          + (!quantityStep && pick && !ready[unitIndex] ? ' is-pending' : '')
          + (locked ? ' is-locked' : '')
          + (!mini && unitIndex >= previousCount && previousCount ? ' is-new' : '')
          + (filled === unitIndex ? ' is-filling' : '')
          + '" data-unit-slot="' + unitIndex + '"'
          + (mini ? ' tabindex="-1"' : ' aria-pressed="' + (unitIndex === index) + '" aria-label="' + escapeHtml(label + ' ' + (unitIndex + 1)) + '"')
          + (locked ? ' disabled' : '') + '>',
        '<span class="unit-slot-covers">' + covers + '</span>',
        '<span class="unit-slot-number" aria-hidden="true">' + (unitIndex + 1) + '</span>',
        badge,
        '</button>'
      ].join("");
    }

    if (configuredUnitStripMode(units.length)) {
      return [
        '<div class="unit-tray is-strip" role="group" aria-label="' + escapeHtml(configuredUnitText(product, "trayLabel") || label) + '">',
        '<div class="unit-tray-mini is-visible is-strip" style="--unit-columns:' + columns + '" data-unit-mini>',
        '<button type="button" class="unit-mini-arrow" data-unit-mini-step="-1" aria-label="Anteriores">&lsaquo;</button>',
        '<div class="unit-mini-window" data-unit-mini-window><div class="unit-mini-track" data-unit-mini-track>',
        units.map(function (unit, unitIndex) { return slotHtml(unit, unitIndex, false); }).join("") + marker,
        '</div></div>',
        '<button type="button" class="unit-mini-arrow" data-unit-mini-step="1" aria-label="Seguintes">&rsaquo;</button>',
        '</div>',
        '</div>'
      ].join("");
    }

    slots = units.map(function (unit, unitIndex) { return slotHtml(unit, unitIndex, false); }).join("");
    html = '<div class="unit-tray' + (units.length > columns ? ' is-multirow' : '') + '" style="--unit-columns:' + Math.min(columns, units.length) + '" role="group" aria-label="' + escapeHtml(configuredUnitText(product, "trayLabel") || label) + '"><div class="unit-tray-track" data-unit-tray>' + slots + marker + '</div></div>';

    // Com mais unidades do que colunas, a fila completa não fica colada ao
    // topo; ao descer aparece esta versão de uma linha: uma janela com tantas
    // unidades como colunas, a da direita é a que se está a escolher, e as
    // setas deixam ver as outras.
    if (units.length > columns) {
      html += [
        '<div class="unit-tray-mini-anchor">',
        // Nasce já no estado em que estava, para não piscar a cada escolha.
        '<div class="unit-tray-mini' + (state.configuredUnitMiniVisible ? ' is-visible' : '') + '" style="--unit-columns:' + columns + '" data-unit-mini aria-hidden="true">',
        '<button type="button" class="unit-mini-arrow" data-unit-mini-step="-1" tabindex="-1">&lsaquo;</button>',
        '<div class="unit-mini-window" data-unit-mini-window><div class="unit-mini-track" data-unit-mini-track>',
        units.map(function (unit, unitIndex) { return slotHtml(unit, unitIndex, true); }).join("") + marker,
        '</div></div>',
        '<button type="button" class="unit-mini-arrow" data-unit-mini-step="1" tabindex="-1">&rsaquo;</button>',
        '</div>',
        '</div>'
      ].join("");
    }
    return html;
  }

  function renderConfiguredUnitControls(product, step) {
    var config = unitConfiguration(product);
    var quantity;
    var max;
    var html = "";
    if (state.admin || !isConfiguredUnitStep(product, step)) return "";
    saveConfiguredUnit(product);
    quantity = configuredUnitCount(product);
    if (quantity > 1) markConfiguredUnitSeen(product, step);
    if (isConfiguredQuantityStep(product, step)) {
      max = config.maxQuantity || 30;
      html += [
        '<div class="unit-quantity">',
        '<label class="unit-quantity-label" for="unit-quantity-input">' + escapeHtml(configuredUnitText(product, "quantityLabel") || "Quantidade") + '</label>',
        '<div class="unit-quantity-stepper">',
        '<button type="button" data-unit-delta="-1" aria-label="Menos uma"' + (quantity <= 1 ? ' disabled' : '') + '>&minus;</button>',
        '<input id="unit-quantity-input" type="number" inputmode="numeric" min="1" max="' + max + '" step="1" value="' + quantity + '" data-unit-quantity>',
        '<button type="button" data-unit-delta="1" aria-label="Mais uma"' + (quantity >= max ? ' disabled' : '') + '>+</button>',
        '</div>',
        '</div>'
      ].join("");
    }
    if (configuredUnitLayoutActive(product, step) && !isConfiguredRowStep(product, step)) html += renderConfiguredUnitTray(product, step);
    if (quantity > 1) html += renderConfiguredUnitActions(product, step);
    html += renderConfiguredUnitMiaChoice(product, step);
    return html;
  }

  // DESIGN PRÓPRIO: com "ownDesignCard" no passo das capas e
  // customArtwork.designCard no JSON, a grelha ganha um cartão para enviar a
  // própria imagem (+ a taxa de customArtwork). Uma unidade com design
  // próprio guarda nos campos das capas o valor OWN_DESIGN_VALUE e segue para
  // o carrinho como os designs da personalização: order_flow "custom" e o
  // ficheiro em customArtwork.selectionKey. Cada imagem enviada fica na
  // grelha como mais um cartão, para se poder usar noutras pastas.
  var OWN_DESIGN_VALUE = "__own_design__";
  var OWN_DESIGN_INCOMING = "own_design_incoming";

  function ownDesignCardConfig(product, step) {
    var card = product && product.customArtwork && product.customArtwork.designCard;
    return card && step && step.ownDesignCard === true && !state.admin ? card : null;
  }

  function ownDesignUpload(selections) {
    var list;
    if (!selections || String(selections.order_flow || "") !== "custom") return null;
    list = selections[customArtworkConfig(state.product).uploadKey];
    return Array.isArray(list) && list[0] && list[0].token ? list[0] : null;
  }

  function ownDesignIsPdf(upload) {
    return !!(upload && (String(upload.mime || "").toLowerCase() === "application/pdf" || /\.pdf$/i.test(String(upload.name || ""))));
  }

  function ownDesignItem(upload) {
    var card = state.product && state.product.customArtwork && state.product.customArtwork.designCard || {};
    if (!upload) return null;
    return {
      id: "own-design-" + upload.token,
      value: OWN_DESIGN_VALUE,
      title: String(card.uploadedTitle || "O teu design"),
      image: ownDesignIsPdf(upload) ? "" : orderUploadPreviewUrl(upload),
      imageFit: "cover",
      visual: "neutral",
      ownDesign: true
    };
  }

  // As imagens já enviadas, sem repetir, pela ordem das unidades.
  function ownDesignLibrary(product) {
    var seen = {};
    var list = [];
    configuredUnitSelections(product).forEach(function (selections) {
      var upload = ownDesignUpload(selections);
      if (upload && !seen[upload.token]) {
        seen[upload.token] = true;
        list.push(upload);
      }
    });
    return list;
  }

  // A imagem enviada não é um ficheiro do site: vai numa <img> simples.
  function renderUnitVisual(item, step) {
    if (!item || !item.ownDesign) return renderVisual(item, "media-list", step);
    return item.image
      ? '<span class="option-image pf-own-design-img"><img src="' + escapeHtml(item.image) + '" alt="" decoding="async"></span>'
      : '<span class="option-image pf-own-design-img is-pdf">PDF</span>';
  }

  function ownDesignFeeText(product) {
    var fee = customArtworkConfig(product).feePerFileCents;
    return fee ? "+" + formatCents(fee).replace(",00", "") : "";
  }

  // Põe o design próprio na unidade (a activa, ou outra pelo índice).
  function assignOwnDesign(product, step, upload, unitIndex) {
    var config = customArtworkConfig(product);
    var units = configuredUnitList();
    var target;
    var groups = configuredUnitCoverGroups(product);
    saveConfiguredUnit(product);
    target = units.length && unitIndex != null && unitIndex !== configuredUnitIndex(product) ? units[unitIndex] : state.selections;
    if (!target) return;
    leaveConfiguredUnitMiaAssorted(product, step);
    groups.forEach(function (group) {
      target[group.field] = OWN_DESIGN_VALUE;
      ((step.resetFieldsByGroup || {})[group.id] || []).forEach(function (field) { delete target[field]; });
    });
    target.covers = [];
    target.order_flow = "custom";
    target.design_source = "custom";
    target[config.uploadKey] = [Object.assign({}, upload, { quantity: 1, feeCents: config.feePerFileCents })];
  }

  // Escolher uma capa do catálogo tira o design próprio da unidade activa.
  function leaveOwnDesign(product, step) {
    var config = customArtworkConfig(product);
    if (!ownDesignCardConfig(product, step) || String(state.selections.order_flow || "") !== "custom") return;
    configuredUnitCoverGroups(product).forEach(function (group) {
      if (state.selections[group.field] === OWN_DESIGN_VALUE) delete state.selections[group.field];
    });
    delete state.selections[config.uploadKey];
    state.selections.order_flow = "catalog";
    state.selections.design_source = "catalog";
  }

  function ownDesignUploading(step) {
    var progress = state.orderUploadProgress;
    return !!(state.orderUploadBusy && progress && state.ownDesignUploadStep === step.id);
  }

  function renderOwnDesignCards(product, step) {
    var card = ownDesignCardConfig(product, step);
    var library;
    var active;
    var custom;
    var accept;
    var uploading;
    var fee;
    if (!card) return "";
    library = ownDesignLibrary(product);
    active = ownDesignUpload(state.selections);
    custom = customArtworkConfig(product);
    accept = (product.customArtwork.acceptedExtensions || []).concat(product.customArtwork.acceptedMimeTypes || []).join(",");
    uploading = ownDesignUploading(step);
    fee = ownDesignFeeText(product);
    return library.map(function (upload, index) {
      var item = ownDesignItem(upload);
      var selected = !!(active && active.token === upload.token);
      var muted = !selected && (state.selections[configuredUnitCoverGroups(product)[0] && configuredUnitCoverGroups(product)[0].field] || "") ? " is-muted" : "";
      return [
        '<div class="cadernos-cover-choice pf-own-design-choice">',
        '<button type="button" class="choice-card crachas-size-card cadernos-cover-card pf-own-design-card' + (selected ? ' is-selected' : '') + muted + '" data-own-design-pick="' + escapeHtml(upload.token) + '" aria-pressed="' + selected + '">',
        '<span class="crachas-size-card-visual cadernos-cover-media pf-own-design-media">',
        item.image ? '<img src="' + escapeHtml(item.image) + '" alt="" loading="lazy" decoding="async">' : '<span class="pf-own-design-circle" aria-hidden="true">PDF</span>',
        '</span>',
        '<span class="choice-copy crachas-size-card-text"><strong>' + escapeHtml(item.title + (library.length > 1 ? " " + (index + 1) : "")) + '</strong>' + (fee ? '<span>' + escapeHtml(fee) + '</span>' : '') + '</span>',
        '<span class="crachas-size-card-selected" aria-hidden="true">✓</span>',
        '</button>',
        '</div>'
      ].join("");
    }).join("") + [
      '<div class="cadernos-cover-choice pf-own-design-choice">',
      '<label class="choice-card crachas-size-card cadernos-cover-card pf-own-design-card pf-own-design-upload' + (uploading ? ' is-uploading' : '') + '">',
      '<input type="file" class="visually-hidden" accept="' + escapeHtml(accept) + '" data-own-design-input' + (uploading ? ' disabled' : '') + '>',
      '<span class="crachas-size-card-visual cadernos-cover-media pf-own-design-media">',
      uploading ? renderOrderUploadProgress() : '<span class="pf-own-design-circle" aria-hidden="true">' + ICON_UPLOAD + '</span>',
      '</span>',
      '<span class="choice-copy crachas-size-card-text"><strong>' + escapeHtml(library.length ? (card.anotherTitle || card.title || "Enviar outro design") : (card.title || "Enviar o meu próprio design")) + '</strong>' + (fee ? '<span>' + escapeHtml(fee) + '</span>' : '') + '</span>',
      '</label>',
      !uploading && state.orderUploadError && state.ownDesignUploadStep === step.id ? '<p class="pf-own-design-error" role="alert">' + escapeHtml(state.orderUploadError) + '</p>' : '',
      '</div>'
    ].join("");
  }

  function startOwnDesignUpload(product, step, input) {
    var custom = customArtworkConfig(product);
    var unit = configuredUnitList().length ? configuredUnitIndex(product) : null;
    var source = input.closest(".pf-own-design-card");
    state.ownDesignUploadStep = step.id;
    startOrderMediaUpload(product, {
      selectionKey: OWN_DESIGN_INCOMING,
      allowPdf: custom.allowPdf,
      preserveOriginal: true,
      feePerFileCents: custom.feePerFileCents,
      purpose: custom.purpose,
      onComplete: function (uploads) {
        var wasReady;
        delete state.selections[OWN_DESIGN_INCOMING];
        // O envio acabou (o "ocupado" só se desliga a seguir).
        state.ownDesignUploadStep = "";
        if (!uploads[0] || currentStep(product) !== step) return;
        wasReady = configuredUnitActiveReady(product, step);
        if (unit === null || unit === configuredUnitIndex(product)) {
          source = document.querySelector(".pf-own-design-upload .pf-own-design-media") || source;
          queueConfiguredUnitDeal(product, step, source, configuredUnitCoverGroups(product)[0].field);
        }
        assignOwnDesign(product, step, uploads[0], unit);
        state.errors = "";
        advanceConfiguredUnitAfterChoice(product, step, wasReady);
      }
    }, input.files, "artwork", step.id);
  }

  function bindOwnDesignCards(product) {
    document.querySelectorAll("[data-own-design-input]").forEach(function (input) {
      input.addEventListener("change", function () {
        var step = currentStep(product);
        if (!input.files || !input.files.length || !ownDesignCardConfig(product, step)) return;
        startOwnDesignUpload(product, step, input);
      });
    });
    document.querySelectorAll("[data-own-design-pick]").forEach(function (button) {
      button.addEventListener("click", function () {
        var step = currentStep(product);
        var token = String(button.dataset.ownDesignPick || "");
        var upload = ownDesignLibrary(product).filter(function (candidate) { return candidate.token === token; })[0];
        var active = ownDesignUpload(state.selections);
        var wasReady;
        if (!upload || !step) return;
        if (active && active.token === token) return;
        wasReady = configuredUnitActiveReady(product, step);
        queueConfiguredUnitDeal(product, step, button.querySelector(".pf-own-design-media"), configuredUnitCoverGroups(product)[0].field);
        assignOwnDesign(product, step, upload, null);
        state.errors = "";
        advanceConfiguredUnitAfterChoice(product, step, wasReady);
        rerenderProduct(product);
      });
    });
  }

  // "Quero que a Mia escolha" (unitConfiguration.miaChoice no JSON):
  // assorted  as capas ficam "Sortido", como nos crachás (assorted_designs);
  // value     os campos recebem o valor do item "A Mia escolhe" da gaveta.
  // Vale para todas as unidades; desligar repõe o que lá estava.
  function configuredUnitMiaChoice(product, step) {
    var config = unitConfiguration(product);
    var choice = config && config.miaChoice && step ? config.miaChoice[step.id] : null;
    return choice && (choice.type === "assorted" || (choice.type === "value" && Array.isArray(choice.fields))) ? choice : null;
  }

  function configuredUnitMiaChoicePressed(product, step, choice) {
    if (choice.type === "assorted") return isAssortedSelected(product);
    return configuredUnitSelections(product).every(function (selections) {
      return choice.fields.every(function (field) { return String(selections[field] || "") === String(choice.value); });
    });
  }

  // Corre fn sobre cada unidade (ou sobre a escolha actual, com uma só).
  function eachConfiguredUnitSelections(product, fn) {
    var units = configuredUnitList();
    var index = configuredUnitIndex(product);
    saveConfiguredUnit(product);
    if (!units.length) {
      fn(state.selections, 0);
      return;
    }
    units.forEach(fn);
    loadConfiguredUnit(product, index);
  }

  function configuredUnitMiaFields(product, step, choice) {
    var fields = [];
    if (choice.type === "value") return choice.fields.slice();
    configuredUnitCoverGroups(product).forEach(function (group) {
      fields.push(group.field);
      fields = fields.concat((step.resetFieldsByGroup || {})[group.id] || []);
    });
    return fields.concat(ownDesignFields(product));
  }

  function toggleConfiguredUnitMiaChoice(product, step) {
    var choice = configuredUnitMiaChoice(product, step);
    var fields;
    var stash;
    var turnOff;
    if (!choice) return false;
    fields = configuredUnitMiaFields(product, step, choice);
    turnOff = configuredUnitMiaChoicePressed(product, step, choice);
    stash = state.miaChoiceStash && state.miaChoiceStash[step.id];
    if (turnOff) {
      eachConfiguredUnitSelections(product, function (unit, i) {
        fields.forEach(function (field) {
          delete unit[field];
          if (stash && stash[i] && stash[i][field] !== undefined) unit[field] = cloneJson(stash[i][field]);
        });
      });
      if (choice.type === "assorted") state.selections.assorted_designs = "";
      if (state.miaChoiceStash) delete state.miaChoiceStash[step.id];
      return true;
    }
    if (!state.miaChoiceStash) state.miaChoiceStash = {};
    state.miaChoiceStash[step.id] = [];
    eachConfiguredUnitSelections(product, function (unit, i) {
      state.miaChoiceStash[step.id][i] = {};
      fields.forEach(function (field) {
        if (unit[field] !== undefined) state.miaChoiceStash[step.id][i][field] = cloneJson(unit[field]);
        delete unit[field];
        if (choice.type === "value") unit[field] = String(choice.value);
      });
    });
    if (choice.type === "assorted") state.selections.assorted_designs = "1";
    return true;
  }

  // Escolher uma capa depois de pedir à Mia desliga o "Sortido".
  function leaveConfiguredUnitMiaAssorted(product, step) {
    var choice = configuredUnitMiaChoice(product, step);
    if (!choice || choice.type !== "assorted" || !isAssortedSelected(product)) return;
    state.selections.assorted_designs = "";
    if (state.miaChoiceStash) delete state.miaChoiceStash[step.id];
  }

  function renderConfiguredUnitMiaChoice(product, step) {
    var choice = configuredUnitMiaChoice(product, step);
    var pressed;
    if (!choice) return "";
    pressed = configuredUnitMiaChoicePressed(product, step, choice);
    return '<div class="unit-actions unit-actions--mia"><button type="button" class="unit-action unit-action--mia' + (pressed ? ' is-pressed' : '') + '" data-unit-mia-choice aria-pressed="' + pressed + '">'
      + '<span class="unit-action-copy"><span>' + escapeHtml(choice.label || "Quero que a Mia escolha") + '</span></span>'
      + '<span class="unit-action-check" aria-hidden="true">' + ICON_CHECK + '</span></button></div>';
  }

  // Botões "em todas" de cada passo (unitConfiguration.unitActions no JSON):
  // same       copia os campos da unidade activa (ou da primeira que os tem);
  // same-name  abre um único campo cujo nome/frase se aplica a todas as capas;
  // none       todas sem personalização;
  // toggle-all liga ou desliga os valores em todas.
  function configuredUnitActions(product, step) {
    var config = unitConfiguration(product);
    var actions = config && config.unitActions && step ? config.unitActions[step.id] : null;
    return Array.isArray(actions) ? actions : [];
  }

  function configuredPersonalizationQuestions(product, step) {
    var size = String(state.selections[(unitConfiguration(product) || {}).sizeField || "size"] || "");
    return (step && Array.isArray(step.questions) ? step.questions : []).filter(function (question) {
      return !Array.isArray(question.sizes) || question.sizes.indexOf(size) !== -1;
    });
  }

  // Campos que acompanham as capas quando o design é próprio.
  function ownDesignFields(product) {
    return isCustomArtworkProduct(product) && product.customArtwork && product.customArtwork.designCard
      ? ["order_flow", "design_source", customArtworkConfig(product).uploadKey]
      : [];
  }

  // O que o "em todas" copia: os campos exigidos e, nas capas, também o
  // design próprio (ou a sua ausência).
  function configuredUnitActionCopyFields(product, action) {
    return configuredUnitActionFields(product, action).concat(action.coverFields ? ownDesignFields(product) : []);
  }

  function configuredUnitActionFields(product, action) {
    return action.coverFields ? configuredUnitCoverGroups(product).map(function (group) { return group.field; }) : (action.fields || []);
  }

  function undoConfiguredUnitAction(product, step) {
    var undo = state.configuredUnitActionUndo;
    var units = configuredUnitList();
    if (!undo || undo.stepId !== step.id || undo.units !== units) return false;
    var index = configuredUnitIndex(product);
    saveConfiguredUnit(product);
    units.forEach(function (unit, i) {
      undo.fields.forEach(function (field) {
        delete unit[field];
        if (undo.before[i][field] !== undefined) unit[field] = cloneJson(undo.before[i][field]);
      });
    });
    state.configuredUnitSameName = undo.sameName;
    state.configuredUnitActionUndo = null;
    loadConfiguredUnit(product, index);
    return true;
  }

  // Custo do extra em todas as capas, usando os mesmos dados do cálculo do pedido.
  function configuredUnitActionPrice(product, step, action) {
    if (action.type === "same-name") {
      return configuredUnitCount(product) * coverPersonalizationQuestions(product).reduce(function (total, question) {
        return total + question.extraPriceCents;
      }, 0);
    }
    if (action.type !== "toggle-all") return null;
    var original = state.selections;
    var total = 0;
    try {
      configuredUnitSelections(product).forEach(function (selections) {
        state.selections = selections;
        Object.keys(action.values || {}).forEach(function (field) { delete selections[field]; });
        var baseline = optionDrawerExtraPerUnitCents(product);
        Object.keys(action.values || {}).forEach(function (field) { selections[field] = action.values[field]; });
        total += optionDrawerExtraPerUnitCents(product) - baseline;
      });
    } finally {
      state.selections = original;
    }
    return total;
  }

  function configuredUnitHasFields(unit, fields) {
    return fields.every(function (field) { return unit[field] !== undefined && unit[field] !== ""; });
  }

  function configuredUnitActionSource(product, fields) {
    var units = configuredUnitList();
    var active = units[configuredUnitIndex(product)];
    if (active && configuredUnitHasFields(active, fields)) return active;
    return units.filter(function (unit) { return configuredUnitHasFields(unit, fields); })[0] || null;
  }

  function configuredUnitActionPressed(product, step, action) {
    var units = configuredUnitList();
    var questions;
    var first;
    if (action.type === "same-name") return !!state.configuredUnitSameName;
    if (action.type === "none") {
      questions = configuredPersonalizationQuestions(product, step);
      return units.every(function (unit) {
        return questions.every(function (question) { return unit[question.field] === "no"; });
      });
    }
    if (action.type === "toggle-all") {
      return units.every(function (unit) {
        return Object.keys(action.values || {}).every(function (field) { return unit[field] === action.values[field]; });
      });
    }
    first = units[0] || {};
    return configuredUnitHasFields(first, configuredUnitActionFields(product, action)) && units.every(function (unit) {
      return configuredUnitActionCopyFields(product, action).every(function (field) {
        return JSON.stringify(unit[field] === undefined ? null : unit[field]) === JSON.stringify(first[field] === undefined ? null : first[field]);
      });
    });
  }

  function applyConfiguredUnitAction(product, step, action) {
    var units;
    var index = configuredUnitIndex(product);
    var questions = configuredPersonalizationQuestions(product, step);
    var textFields = questions.map(function (question) { return question.textField; });
    var source;
    var fields = configuredUnitActionFields(product, action);
    var turnOff;
    saveConfiguredUnit(product);
    units = configuredUnitList();
    if (action.type === "same" && !configuredUnitActionSource(product, fields)) return false;
    var affected = action.type === "same" ? configuredUnitActionCopyFields(product, action) : action.type === "toggle-all" ? Object.keys(action.values || {})
      : questions.reduce(function (keys, question) { return keys.concat([question.field, question.textField]); }, []);
    var resetGroups = action.coverFields ? configuredUnitCoverGroups(product) : [];
    resetGroups.forEach(function (group) { affected = affected.concat((step.resetFieldsByGroup || {})[group.id] || []); });
    state.configuredUnitActionUndo = { stepId: step.id, units: units, before: cloneJson(units), fields: affected, sameName: !!state.configuredUnitSameName };
    if (action.type === "same") {
      source = configuredUnitActionSource(product, fields);
      source = cloneJson(source);
      units.forEach(function (unit) {
        resetGroups.forEach(function (group) {
          if (unit[group.field] === source[group.field]) return;
          ((step.resetFieldsByGroup || {})[group.id] || []).forEach(function (field) { delete unit[field]; });
        });
        configuredUnitActionCopyFields(product, action).forEach(function (field) {
          if (source[field] === undefined) delete unit[field];
          else unit[field] = cloneJson(source[field]);
        });
      });
    } else if (action.type === "same-name") {
      if (state.configuredUnitSameName) {
        state.configuredUnitSameName = false;
      } else {
        source = configuredUnitActionSource(product, textFields);
        source = source ? cloneJson(source) : null;
        var commonText = source ? String(source[textFields[0]] || "") : "";
        units.forEach(function (unit) {
          questions.forEach(function (question) {
            unit[question.field] = "yes";
            unit[question.textField] = commonText;
          });
        });
        state.configuredUnitSameName = true;
      }
    } else if (action.type === "none") {
      units.forEach(function (unit) {
        questions.forEach(function (question) {
          unit[question.field] = "no";
          unit[question.textField] = "";
        });
      });
      state.configuredUnitSameName = false;
    } else if (action.type === "toggle-all") {
      turnOff = configuredUnitActionPressed(product, step, action);
      units.forEach(function (unit) {
        Object.keys(action.values || {}).forEach(function (field) {
          if (turnOff) delete unit[field];
          else unit[field] = action.values[field];
        });
      });
    }
    loadConfiguredUnit(product, index);
    return true;
  }

  // O reverter das acções "em todas" usa o mesmo pop com temporizador do
  // seletor A4/A6 (state.assignmentPickerUndos), marcado com kind.
  function configuredUnitActionUndos() {
    return (state.assignmentPickerUndos || []).filter(function (undo) { return undo && undo.kind === "unit-action"; });
  }

  function pushConfiguredUnitActionUndo(step, action) {
    state.assignmentPickerUndoSequence = Number(state.assignmentPickerUndoSequence || 0) + 1;
    state.assignmentPickerUndos = (state.assignmentPickerUndos || []).filter(function (undo) { return undo.kind !== "unit-action"; });
    state.assignmentPickerUndos.push({
      id: String(Date.now()) + "-" + String(state.assignmentPickerUndoSequence),
      kind: "unit-action",
      stepId: String(step.id || ""),
      expiresAt: Date.now() + 5000,
      message: String(action.undoMessage || "Alteração aplicada a todas.")
    });
  }

  // O item (capa, acabamento, cantos) que corresponde a um campo e valor,
  // procurado nos dados dos passos, para o botão mostrar o que vai aplicar.
  function configuredUnitFieldItem(product, field, value) {
    var found = null;
    value = String(value || "");
    if (!value) return null;
    configuredUnitCoverGroups(product).forEach(function (group) {
      var unit = {};
      if (found || group.field !== field) return;
      unit[field] = value;
      found = configuredUnitCoverItem(group, unit) ? { item: configuredUnitCoverItem(group, unit), step: group.step } : null;
    });
    (product.steps || []).forEach(function (step) {
      var config = assignmentPickerConfig(step);
      if (found || !config) return;
      config.groups.forEach(function (group) {
        if (found || String(group.field || "") !== field) return;
        assignmentPickerItems(product, step).forEach(function (item) {
          if (!found && assignmentPickerValue(group, item) === value) found = { item: item, step: assignmentPickerSourceStep(product, step) };
        });
      });
    });
    [true, false].forEach(function (sameField) {
      (product.steps || []).forEach(function (step) {
        if (found) return;
        optionDrawersForStep(product, step).forEach(function (drawer) {
          if (found || (sameField && String(drawer.field || "") !== field) || !Array.isArray(drawer.items)) return;
          drawer.items.forEach(function (item) {
            if (!found && String(item.value || "") === value) found = { item: item, step: step };
          });
        });
      });
    });
    return found;
  }

  function configuredUnitActionPreview(product, step, action) {
    var entries = [];
    var seen = {};
    var source;
    if (action.type === "same") {
      source = configuredUnitActionSource(product, configuredUnitActionFields(product, action));
      if (!source) return "";
      configuredUnitActionFields(product, action).forEach(function (field) {
        entries.push(source[field] === OWN_DESIGN_VALUE
          ? { item: ownDesignItem(ownDesignUpload(source)), step: step }
          : configuredUnitFieldItem(product, field, source[field]));
      });
    } else if (action.type === "toggle-all") {
      Object.keys(action.values || {}).forEach(function (field) {
        entries.push(configuredUnitFieldItem(product, field, action.values[field]));
      });
    }
    entries = entries.filter(function (entry) {
      var key = entry && entry.item && entry.item.image ? entry.item.image : "";
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
    if (!entries.length) return "";
    return '<span class="unit-action-preview' + (entries.length > 1 ? ' is-pair' : '') + '" aria-hidden="true">' + entries.map(function (entry) {
      return '<span class="unit-action-thumb">' + renderUnitVisual(entry.item, entry.step) + '</span>';
    }).join("") + '</span>';
  }

  // [imagem] + texto + [visto]. Um "same" sem nada escolhido para copiar é
  // só um aviso (emptyLabel), com o lugar da imagem vazio.
  function renderConfiguredUnitActions(product, step) {
    var actions = configuredUnitActions(product, step);
    if (!actions.length) return "";
    return '<div class="unit-actions">' + actions.map(function (action, actionIndex) {
      var pressed;
      var price;
      var preview;
      if (action.type === "same" && !configuredUnitActionSource(product, configuredUnitActionFields(product, action))) {
        return '<p class="unit-action is-hint has-preview" role="note">'
          + '<span class="unit-action-preview" aria-hidden="true"><span class="unit-action-thumb is-empty"></span></span>'
          + '<span class="unit-action-copy"><span>' + escapeHtml(action.emptyLabel || action.label || "") + '</span></span></p>';
      }
      pressed = configuredUnitActionPressed(product, step, action);
      price = configuredUnitActionPrice(product, step, action);
      preview = configuredUnitActionPreview(product, step, action);
      return '<button type="button" class="unit-action' + (preview ? ' has-preview' : '') + (pressed ? ' is-pressed' : '') + '" data-unit-action="' + actionIndex + '" aria-pressed="' + pressed + '">'
        + preview
        + '<span class="unit-action-copy"><span>' + escapeHtml(action.label || "") + '</span>' + (price !== null ? '<span class="unit-action-price">+ ' + escapeHtml(formatCents(price)) + '</span>' : '') + '</span>'
        + '<span class="unit-action-check" aria-hidden="true">' + ICON_CHECK + '</span></button>';
    }).join("") + '</div>' + renderAssignmentPickerUndo(step, "unit-action");
  }

  // Avisos do passo: step.notice sempre; o das fitas (variationNotice) só
  // quando alguma capa escolhida tem mais de uma cor.
  function renderVariationNotice(product, step) {
    var variationStep;
    var list;
    var original = state.selections;
    var many = false;
    var notice = step && step.notice ? '<p class="unit-notice" role="note">' + escapeHtml(step.notice) + '</p>' : "";
    if (!step || !step.variationNotice || !step.pastaDeFolhetosDetails) return notice;
    variationStep = pastaDeFolhetosDetailsVariationStep(product, step);
    if (!variationStep) return "";
    list = configuredUnitCount(product) > 1 ? configuredUnitSelections(product) : [state.selections];
    try {
      list.forEach(function (selections) {
        state.selections = selections;
        pastaDeFolhetosDetailsGroups(step, variationStep).forEach(function (group) {
          if (groupedDesignItems(variationStep, group).length > 1) many = true;
        });
      });
    } finally {
      state.selections = original;
    }
    return notice + (many ? '<p class="unit-notice" role="note">' + escapeHtml(step.variationNotice) + '</p>' : "");
  }

  function setConfiguredUnitSharedName(product, value) {
    coverPersonalizationQuestions(product).forEach(function (question) {
      state.selections[question.textField] = value;
      configuredUnitList().forEach(function (unit) { unit[question.textField] = value; });
    });
  }

  function renderConfiguredUnitSharedName(product) {
    var questions = coverPersonalizationQuestions(product);
    var question = questions[0];
    var limit = Math.min.apply(Math, questions.map(function (item) { return item.maxLength; }));
    var text = String(state.selections[question.textField] || "");
    var error = state.invalidFields.some(function (field) { return questions.some(function (item) { return item.textField === field; }); });
    return '<div class="cadernos-personalization-drawer unit-shared-name" data-unit-shared-name>'
      + '<label class="cadernos-personalization-field"><span>Nome/frase para todas <small data-cover-personalization-count>(' + text.length + ' / ' + limit + ')</small></span>'
      + '<input type="text" value="' + escapeHtml(text) + '" data-cover-personalization-text data-cover-personalization-text-field="' + escapeHtml(question.textField) + '" data-cover-personalization-limit="' + limit + '" data-cover-personalization-help-id="unit-shared-name-help" aria-describedby="unit-shared-name-help"' + (error ? ' class="is-missing" aria-invalid="true"' : '') + '></label>'
      + (error ? siteErrorMarkup(text.trim() ? 'O nome/frase tem de ter no máximo ' + limit + ' caracteres.' : 'Escreve o nome ou frase para personalizar a capa.', 'form-error', 'unit-shared-name-help')
        : '<p class="details-section-note" id="unit-shared-name-help">Máximo de ' + limit + ' caracteres. Este nome/frase será aplicado a todas as capas.</p>') + '</div>';
  }

  // Passos em linhas: uma linha por capa — no conjunto, a A4 e a A6 de cada
  // unidade, separadas da unidade seguinte — com a capa grande à esquerda e
  // as escolhas dessa capa à direita. Os rádios ganham um sufixo por linha;
  // os handlers de sempre lêem o campo dos data-atributos.
  function configuredUnitRowKind(step) {
    if (!step) return "";
    if (step.template === "cover-personalization") return "name";
    if (step.pastaDeFolhetosDetails) return "details";
    if (step.template === "assignment-picker" && assignmentPickerConfig(step)) return "choice";
    if (step.template === "option-drawers") return "choice";
    return "";
  }

  function renderConfiguredUnitRowChoice(name, value, checked, attrs, media, title, note) {
    return '<label class="unit-choice' + (media ? ' has-media' : '') + (checked ? ' is-selected' : '') + '">'
      + '<input type="radio" name="' + escapeHtml(name) + '" value="' + escapeHtml(value) + '" ' + attrs + (checked ? ' checked' : '') + '>'
      + (media ? '<span class="unit-choice-media">' + media + '</span>' : '')
      + '<span class="unit-choice-copy"><strong>' + escapeHtml(title) + '</strong>' + (note ? '<small>' + escapeHtml(note) + '</small>' : '') + '</span>'
      + '<span class="unit-choice-check" aria-hidden="true">' + ICON_CHECK + '</span>'
      + '</label>';
  }

  // Acabamentos: as opções da gaveta (capa única) ou do seletor A4/A6 (conjunto).
  function configuredUnitRowChoiceSets(product, step, group) {
    var config = assignmentPickerConfig(step);
    var target;
    if (config) {
      target = config.groups.filter(function (candidate) {
        return String(candidate && (candidate.id || candidate.label) || "") === group.id;
      })[0];
      return target ? [{
        field: String(target.field || ""),
        step: assignmentPickerSourceStep(product, step),
        items: assignmentPickerItems(product, step).filter(notMiaChoiceItem).map(function (item) {
          return { item: item, value: assignmentPickerValue(target, item) };
        })
      }] : [];
    }
    ensureOptionDrawerSelections(product);
    return optionDrawersForStep(product, step).map(function (drawer) {
      return {
        field: String(drawer.field || ""),
        step: step,
        items: optionDrawerAvailableItems(product, drawer).filter(notMiaChoiceItem).map(function (item) {
          return { item: item, value: String(item.value || "") };
        })
      };
    });
  }

  function renderConfiguredUnitRowChoices(product, step, group, suffix) {
    var fields = [];
    var html = configuredUnitRowChoiceSets(product, step, group).map(function (set) {
      var current = String(state.selections[set.field] || "");
      fields.push(set.field);
      return set.items.map(function (entry) {
        var extra = Math.max(0, parseInt(entry.item.extraPriceCentsPerUnit, 10) || 0);
        return renderConfiguredUnitRowChoice(set.field + suffix, entry.value, current === entry.value,
          'data-option-drawer-choice data-option-drawer-field="' + escapeHtml(set.field) + '"',
          renderVisual(entry.item, "media-list", set.step),
          entry.item.title || entry.value || "Opção",
          extra ? "+ " + formatCents(extra) : "");
      }).join("");
    }).join("");
    return { fields: fields, html: '<div class="unit-row-options unit-row-options--choice">' + html + '</div>' };
  }

  function configuredUnitRowQuestion(product, group) {
    var questions = coverPersonalizationQuestions(product);
    return questions.filter(function (question) { return question.size === group.id; })[0]
      || (questions.length === 1 ? questions[0] : null);
  }

  // Nome: [Sim, quero personalizar · preço] [Não]; o campo abre por baixo do Sim.
  function renderConfiguredUnitRowName(product, step, group, suffix) {
    var question = configuredUnitRowQuestion(product, group);
    var selected;
    var text;
    var helpId;
    var error = "";
    var choices;
    if (!question) return { fields: [], html: "" };
    selected = String(state.selections[question.field] || "");
    text = coverPersonalizationQuestionText(question);
    helpId = "unit-name-help" + suffix;
    if (state.invalidFields.indexOf(question.textField) !== -1 && (!text || text.length > question.maxLength)) {
      error = !text ? "Escreve o nome ou frase para personalizar a capa." : "O nome/frase tem de ter no máximo " + question.maxLength + " caracteres.";
    }
    choices = (question.items || []).map(function (item) {
      var value = String(item.value || "");
      return renderConfiguredUnitRowChoice(question.field + suffix, value, selected === value,
        'data-choice-step="' + escapeHtml(step.id) + '" data-choice-field="' + escapeHtml(question.field) + '" data-cover-personalization-text-field="' + escapeHtml(question.textField) + '" data-unit-name-choice="' + escapeHtml(suffix) + '"',
        "", item.title || value,
        value === "yes" && question.extraPriceCents ? formatCents(question.extraPriceCents) : "");
    }).join("");
    return {
      fields: [question.field, question.textField],
      html: '<div class="unit-row-options unit-row-options--name">' + choices
        + (selected === "yes" ? [
          '<div class="cadernos-personalization-drawer unit-row-name">',
          '<label class="cadernos-personalization-field">',
          '<span>Nome/frase <small data-cover-personalization-count>(' + text.length + ' / ' + question.maxLength + ')</small></span>',
          '<input' + (error ? ' class="is-missing" aria-invalid="true"' : '') + ' type="text" value="' + escapeHtml(state.selections[question.textField] || "") + '" data-cover-personalization-text data-cover-personalization-text-field="' + escapeHtml(question.textField) + '" data-cover-personalization-help-id="' + escapeHtml(helpId) + '" data-cover-personalization-limit="' + question.maxLength + '" data-unit-name-input="' + escapeHtml(suffix) + '" aria-describedby="' + escapeHtml(helpId) + '">',
          '</label>',
          error ? siteErrorMarkup(error, "form-error", helpId) : '<p class="details-section-note" id="' + escapeHtml(helpId) + '">Máximo de ' + question.maxLength + ' caracteres.</p>',
          '</div>'
        ].join("") : "")
        + '</div>'
    };
  }

  // Detalhes: [Quero cantos metálicos · preço] e, se a capa tiver várias,
  // as fitas. A capa da linha mostra a fita escolhida.
  function renderConfiguredUnitRowDetails(product, step, group, suffix) {
    var config = step.pastaDeFolhetosDetails || {};
    var source = config.metalCornersSourceStepId ? findStep(product, String(config.metalCornersSourceStepId)) : step;
    var drawer = optionDrawersForStep(product, source)[0];
    var item = drawer && Array.isArray(drawer.items) ? drawer.items[0] : null;
    var field = drawer ? String(drawer.field || "") : "";
    var cornerGroups = Array.isArray(config.metalCornersGroups) ? config.metalCornersGroups : [];
    var variationStep = pastaDeFolhetosDetailsVariationStep(product, step);
    var variationField = variationStep ? groupedDesignField(variationStep, group.id) : "";
    var variations = variationStep ? groupedDesignItems(variationStep, group.id) : [];
    var fields = [];
    var html = "";
    var selected;
    var extra;
    var ribbon;
    if (cornerGroups.length) {
      field = String((cornerGroups.filter(function (candidate) {
        return String(candidate && (candidate.id || candidate.label) || "") === group.id;
      })[0] || {}).field || "");
    }
    if (item && field) {
      selected = String(state.selections[field] || "") === String(item.value || "");
      extra = Math.max(0, parseInt(item.extraPriceCentsPerUnit, 10) || 0);
      fields.push(field);
      html += '<button type="button" class="unit-choice unit-choice--wide' + (selected ? ' is-selected' : '') + '" data-pf-metal-corners-toggle data-pf-metal-corners-field="' + escapeHtml(field) + '" data-pf-metal-corners-value="' + escapeHtml(item.value || "") + '" aria-pressed="' + selected + '">'
        + (item.image ? '<span class="unit-choice-thumb" aria-hidden="true">' + renderVisual(item, "media-list", source) + '</span>' : '')
        + '<span class="unit-choice-copy"><strong>' + escapeHtml(item.title || "Quero cantos metálicos") + '</strong>' + (extra ? '<small>+ ' + escapeHtml(formatCents(extra)) + '</small>' : '') + '</span>'
        + '<span class="unit-choice-check" aria-hidden="true">' + ICON_CHECK + '</span>'
        + '</button>';
    }
    ribbon = isCustomArtworkSelected(product) ? ownDesignRibbonDrawer(product, step, group.id) : null;
    if (ribbon) {
      fields.push(ribbon.field);
      html += ribbon.items.map(function (entry) {
        var value = String(entry.value || "");
        return renderConfiguredUnitRowChoice(ribbon.field + suffix, value, String(state.selections[ribbon.field] || "") === value,
          'data-option-drawer-choice data-option-drawer-field="' + escapeHtml(ribbon.field) + '"',
          "", entry.choiceTitle || entry.title || value, entry.choiceNote || "");
      }).join("");
    } else if (variationField && variations.length > 1) {
      fields.push(variationField);
      html += variations.map(function (variation) {
        var value = String(variation.value || "");
        return renderConfiguredUnitRowChoice(variationField + suffix, value, String(state.selections[variationField] || "") === value,
          'data-continuous-variation-choice data-continuous-variation-step="' + escapeHtml(variationStep.id || "") + '" data-continuous-variation-field="' + escapeHtml(variationField) + '" data-continuous-variation-group="' + escapeHtml(group.id) + '"',
          "", variation.title || value, "");
      }).join("");
    }
    return { fields: fields, html: '<div class="unit-row-options unit-row-options--details">' + html + '</div>' };
  }

  // A capa da linha: no passo dos detalhes, a fotografia da fita escolhida.
  function configuredUnitRowCoverItem(product, step, group, unit) {
    var variationStep = step.pastaDeFolhetosDetails ? pastaDeFolhetosDetailsVariationStep(product, step) : null;
    var field = variationStep ? groupedDesignField(variationStep, group.id) : "";
    var value = field ? String(state.selections[field] || "") : "";
    var variation = value ? groupedDesignItems(variationStep, group.id).filter(function (item) {
      return String(item.value || "") === value;
    })[0] : null;
    return variation && variation.image ? { item: variation, step: variationStep } : { item: configuredUnitCoverItem(group, unit), step: group.step };
  }

  function renderConfiguredUnitRows(product, step) {
    if (state.configuredUnitSameName && step.template === "cover-personalization") return renderConfiguredUnitSharedName(product);
    var kind = configuredUnitRowKind(step);
    var groups = configuredUnitCoverGroups(product);
    var active = configuredUnitIndex(product);
    var invalid = state.invalidFields;
    var label = configuredUnitLabel(product);
    var html;
    if (!kind || !groups.length) return renderConfiguredUnitBodyRows(product, step);
    saveConfiguredUnit(product);
    try {
      html = configuredUnitViewList(product).map(function (unit, unitIndex) {
        var rows;
        loadConfiguredUnit(product, unitIndex);
        state.invalidFields = unitIndex === active ? invalid : [];
        if (kind === "details") syncPastaDeFolhetosDetailSelections(product, step);
        rows = groups.map(function (group, groupIndex) {
          var suffix = "__u" + unitIndex + "g" + groupIndex;
          var body = kind === "name" ? renderConfiguredUnitRowName(product, step, group, suffix)
            : kind === "details" ? renderConfiguredUnitRowDetails(product, step, group, suffix)
            : renderConfiguredUnitRowChoices(product, step, group, suffix);
          var cover = configuredUnitRowCoverItem(product, step, group, configuredUnitFields(product));
          // Duas linhas: a unidade ("Pasta 1", "Conjunto 1") e a capa ("A4";
          // no conjunto "Pasta A4"). Com uma só unidade, só a capa.
          var unitLine = configuredUnitCount(product) > 1 ? label + " " + (unitIndex + 1) : "";
          var coverLine = groups.length > 1 ? ((unitConfiguration(product).label || "") + " " + group.id).trim() : group.id;
          var rowLabel = (unitLine ? unitLine + " " : "") + coverLine;
          var invalidRow = body.fields.some(function (field) { return state.invalidFields.indexOf(field) !== -1; });
          return [
            '<section class="unit-row' + (invalidRow ? ' is-invalid' : '') + '" data-unit-row="' + unitIndex + '">',
            '<div class="unit-row-cover" aria-hidden="true">',
            '<span class="unit-slot-cover' + (cover.item ? '' : ' is-empty' + (isAssortedSelected(product) ? ' is-mia' : '')) + '">' + (cover.item ? renderUnitVisual(cover.item, cover.step) : '') + '</span>',
            '<span class="unit-slot-number unit-row-label">' + (unitLine ? '<span>' + escapeHtml(unitLine) + '</span>' : '') + '<span>' + escapeHtml(coverLine) + '</span></span>',
            '</div>',
            '<div class="unit-row-body" role="group" aria-label="' + escapeHtml(rowLabel) + '">' + body.html + '</div>',
            '</section>'
          ].join("");
        }).join("");
        saveConfiguredUnit(product);
        return '<div class="unit-row-set">' + rows + '</div>';
      }).join("");
    } finally {
      loadConfiguredUnit(product, active);
      state.invalidFields = invalid;
    }
    return '<div class="unit-rows unit-rows--' + kind + '">' + html + '</div>';
  }

  // Passos sem desenho próprio em linhas: o corpo do passo é desenhado uma
  // vez por unidade, com a miniatura da capa à esquerda.
  function renderConfiguredUnitBodyRows(product, step) {
    var active = configuredUnitIndex(product);
    var invalid = state.invalidFields;
    var html;
    saveConfiguredUnit(product);
    try {
      html = configuredUnitViewList(product).map(function (unit, unitIndex) {
        var body;
        loadConfiguredUnit(product, unitIndex);
        state.invalidFields = unitIndex === active ? invalid : [];
        body = stepBody(product, step);
        saveConfiguredUnit(product);
        // Cada linha é o seu grupo de rádios; os handlers lêem o campo dos
        // data-atributos, não do name.
        body = body.replace(/(<input type="radio" name=")([^"]+)"/g, '$1$2__u' + unitIndex + '"');
        if (unitIndex) {
          (body.match(/ id="[^"]+"/g) || []).forEach(function (match) {
            var id = match.slice(5, -1);
            body = body.split('"' + id + '"').join('"' + id + '-u' + unitIndex + '"');
          });
        }
        return [
          '<section class="unit-row" data-unit-row="' + unitIndex + '">',
          '<div class="unit-row-cover" aria-hidden="true"><span class="unit-slot-covers' + (configuredUnitCoverGroups(product).length > 1 ? ' is-pair' : '') + '">' + configuredUnitCoversHtml(product, configuredUnitViewList(product)[unitIndex]) + '</span><span class="unit-slot-number">' + (unitIndex + 1) + '</span></div>',
          '<div class="unit-row-body" role="group" aria-label="' + escapeHtml(configuredUnitLabel(product) + ' ' + (unitIndex + 1)) + '">' + body + '</div>',
          '</section>'
        ].join("");
      }).join("");
    } finally {
      loadConfiguredUnit(product, active);
      state.invalidFields = invalid;
    }
    return '<div class="unit-rows">' + html + '</div>';
  }

  // Mexer numa linha torna essa unidade a activa antes de os handlers de
  // sempre correrem, que escrevem em state.selections.
  function bindConfiguredUnitRows(product) {
    document.querySelectorAll("[data-unit-row]").forEach(function (row) {
      var index = Number(row.dataset.unitRow);
      function activate() {
        if (configuredUnitIndex(product) === index) return;
        saveConfiguredUnit(product);
        loadConfiguredUnit(product, index);
      }
      ["pointerdown", "mousedown", "touchstart", "focusin", "click", "change", "input", "keydown"].forEach(function (type) {
        row.addEventListener(type, activate, true);
      });
      // Escolher "Sim" leva o cursor para o campo do nome que abre.
      row.addEventListener("change", function (event) {
        var input = event.target;
        if (input && input.dataset && input.dataset.unitNameChoice && input.value === "yes") {
          state.configuredUnitFocusName = input.dataset.unitNameChoice;
        }
      }, true);
    });
    if (state.configuredUnitFocusName) {
      var nameInput = document.querySelector('[data-unit-name-input="' + state.configuredUnitFocusName + '"]');
      state.configuredUnitFocusName = "";
      if (nameInput) nameInput.focus({ preventScroll: true });
    }
  }

  function bindConfiguredUnitMini(product) {
    var mini = document.querySelector("[data-unit-mini]");
    var full = document.querySelector("[data-unit-tray]");
    var win = mini && mini.querySelector("[data-unit-mini-window]");
    var strip = !!(mini && mini.classList.contains("is-strip"));
    var active = configuredUnitIndex(product);
    var columns = configuredUnitTrayColumns();
    var count = configuredUnitCount(product);
    var last = Math.max(0, count - columns);
    var shown = state.configuredUnitMiniShown;
    var grew = state.configuredUnitMiniCount != null && count > state.configuredUnitMiniCount;
    var changed = state.configuredUnitMiniCount != null && count !== state.configuredUnitMiniCount;
    var deal = state.configuredUnitDeal;
    var headerTop;
    var target;
    var reveal;
    var settle;

    state.configuredUnitMiniCount = count;
    if (state.configuredUnitMiniScroll) {
      window.removeEventListener("scroll", state.configuredUnitMiniScroll);
      state.configuredUnitMiniScroll = null;
    }
    if (!mini || !win || (!full && !strip)) {
      state.configuredUnitMiniShown = null;
      state.configuredUnitMiniVisible = false;
      return;
    }

    // A janela desliza por scroll nativo (dedo, trackpad ou setas), com
    // encaixe em cada unidade.
    function slotWidth() {
      return win.clientWidth / columns || 1;
    }

    function current() {
      return Math.max(0, Math.min(last, Math.round(win.scrollLeft / slotWidth())));
    }

    function arrows(value) {
      mini.querySelector('[data-unit-mini-step="-1"]').disabled = value === 0;
      mini.querySelector('[data-unit-mini-step="1"]').disabled = value === last;
    }

    function place(value, animate) {
      value = Math.max(0, Math.min(last, value));
      win.scrollTo({ left: value * slotWidth(), behavior: animate ? "smooth" : "auto" });
      arrows(value);
      state.configuredUnitMiniShown = value;
    }

    // A janela segue a unidade activa (fica à direita; na faixa do telemóvel,
    // ao centro); deslizar ou as setas só a mexem até a unidade activa mudar.
    // Na faixa, acrescentar ou tirar unidades mostra a última.
    if (strip && changed) {
      state.configuredUnitMiniFor = active + ":" + columns;
      state.configuredUnitMiniStart = last;
      if (shown == null && grew) shown = 0;
    } else if (state.configuredUnitMiniFor !== active + ":" + columns || state.configuredUnitMiniStart == null) {
      state.configuredUnitMiniFor = active + ":" + columns;
      state.configuredUnitMiniStart = active - (strip ? Math.floor(columns / 2) : columns - 1);
    }
    target = Math.max(0, Math.min(last, state.configuredUnitMiniStart));
    // Desliza da posição anterior para a nova.
    place(shown == null ? target : shown, false);
    state.configuredUnitMiniPending = null;
    // Na faixa, a unidade que vai receber a carta tem de estar à vista:
    // a janela desliza até ela e só depois a carta voa.
    if (strip && deal && (deal.unit < state.configuredUnitMiniShown || deal.unit >= state.configuredUnitMiniShown + columns)) {
      reveal = deal.unit >= target && deal.unit < target + columns ? target
        : Math.max(0, Math.min(last, deal.unit - Math.floor(columns / 2)));
      shown = reveal;
      place(reveal, true);
      state.configuredUnitDealWait = 340;
    }
    if (shown != null && shown !== target) {
      if (state.configuredUnitDeal) {
        state.configuredUnitMiniPending = function () { place(target, true); };
      } else {
        window.setTimeout(function () { place(target, true); }, 30);
      }
    }

    win.addEventListener("scroll", function () {
      var value = current();
      arrows(value);
      window.clearTimeout(settle);
      settle = window.setTimeout(function () {
        state.configuredUnitMiniShown = current();
        state.configuredUnitMiniStart = state.configuredUnitMiniShown;
      }, 120);
    }, { passive: true });

    mini.querySelectorAll("[data-unit-mini-step]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.configuredUnitMiniStart = Math.max(0, Math.min(last, current() + Number(button.dataset.unitMiniStep)));
        place(state.configuredUnitMiniStart, true);
      });
    });

    if (strip) {
      state.configuredUnitMiniVisible = false;
      return;
    }
    headerTop = parseFloat(getComputedStyle(mini.parentNode).top) || 0;
    state.configuredUnitMiniScroll = function () {
      state.configuredUnitMiniVisible = full.getBoundingClientRect().bottom < headerTop;
      mini.classList.toggle("is-visible", state.configuredUnitMiniVisible);
    };
    state.configuredUnitMiniScroll();
    window.addEventListener("scroll", state.configuredUnitMiniScroll, { passive: true });
  }

  // Escolher uma capa para a unidade destacada "dá a carta": uma cópia voa do
  // cartão da grelha para o lugar dela na fila — levanta, roda no caminho e
  // assenta com um pequeno ressalto. O handler regista a origem antes do
  // render; a animação corre depois, já com a fila nova. Se o lugar já tinha
  // uma capa, guarda-se uma cópia dela para ser descartada antes. Sem origem
  // (a capa foi retirada), só há o descarte.
  function queueConfiguredUnitDeal(product, step, source, field) {
    var fields;
    var unit;
    var group;
    var slot;
    var old = null;
    if (!configuredUnitLayoutActive(product, step) || !isConfiguredPickStep(product, step)) return;
    fields = configuredUnitSlotGroups(product, step).map(function (group) { return group.field; });
    if (fields.indexOf(field) === -1) return;
    unit = configuredUnitIndex(product);
    group = fields.indexOf(field);
    if (state.selections[field]) {
      slot = document.querySelector('[data-unit-mini].is-visible [data-unit-slot="' + unit + '"]')
        || document.querySelector('[data-unit-tray] [data-unit-slot="' + unit + '"]');
      old = slot ? slot.querySelectorAll(".unit-slot-cover")[group] : null;
      old = old && !old.classList.contains("is-empty") ? old.cloneNode(true) : null;
    }
    if (!source && !old) return;
    state.configuredUnitDeal = { unit: unit, group: group, rect: source ? source.getBoundingClientRect() : null, old: old };
  }

  // A capa substituída salta do lugar e sai de cena, rodando, como uma
  // carta descartada.
  function discardConfiguredUnitCover(old, to) {
    var done = function () { old.remove(); };
    var animation;
    old.removeAttribute("style");
    Array.prototype.forEach.call(old.querySelectorAll(".unit-slot-ref"), function (ref) { ref.remove(); });
    old.classList.remove("is-empty", "is-awaiting-deal", "has-ref");
    old.classList.add("unit-deal-card");
    old.setAttribute("aria-hidden", "true");
    old.style.left = to.left + "px";
    old.style.top = to.top + "px";
    old.style.width = to.width + "px";
    old.style.height = to.height + "px";
    document.body.appendChild(old);
    animation = old.animate([
      { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1, easing: "cubic-bezier(.2,.8,.3,1)" },
      { transform: "translate(-4px,-24px) scale(1.1) rotate(-9deg)", opacity: 1, offset: 0.3, easing: "cubic-bezier(.6,0,.9,.4)" },
      { transform: "translate(" + Math.round(to.width * 1.6) + "px," + Math.round(to.height * 0.9) + "px) scale(.6) rotate(38deg)", opacity: 0 }
    ], { duration: 360, fill: "both" });
    animation.onfinish = done;
    animation.oncancel = done;
    window.setTimeout(done, 420);
  }

  function configuredUnitDealTarget(unit, group) {
    var mini = document.querySelector("[data-unit-mini].is-visible");
    var slot = mini
      ? mini.querySelector('[data-unit-slot="' + unit + '"]')
      : document.querySelector('[data-unit-tray] [data-unit-slot="' + unit + '"]');
    var cover = slot ? slot.querySelectorAll(".unit-slot-cover")[group] : null;
    var rect;
    var win;
    var bounds;
    if (!cover) return null;
    // A carta substitui o "pop" da capa nova (e mede-se já sem ele).
    document.querySelectorAll('[data-unit-slot="' + unit + '"].is-filling').forEach(function (filling) {
      filling.classList.remove("is-filling");
    });
    rect = cover.getBoundingClientRect();
    if (rect.top + rect.height < 0 || rect.top > window.innerHeight) return null;
    win = slot.closest("[data-unit-mini-window]");
    if (win) {
      bounds = win.getBoundingClientRect();
      if (rect.left + rect.width / 2 < bounds.left || rect.left + rect.width / 2 > bounds.right) return null;
    }
    return { slot: slot, cover: cover, rect: rect };
  }

  function playConfiguredUnitDeal() {
    var deal = state.configuredUnitDeal;
    // A janela pequena guardou o deslize para a unidade seguinte: corre ao
    // assentar ou, sem carta (capa fora do ecrã), já.
    var slide = state.configuredUnitMiniPending;
    var wait = state.configuredUnitDealWait || 0;
    var waiting = [];
    var next = [];
    state.configuredUnitMiniPending = null;
    state.configuredUnitDeal = null;
    state.configuredUnitDealWait = 0;
    if (deal && deal.rect && document.body.animate) {
      // Até a carta assentar, o lugar mantém o "?" e o rebordo tracejado —
      // numa troca, vê-se por trás da capa antiga a cair — e o destaque fica
      // nesta unidade; só depois passa para a seguinte.
      document.querySelectorAll('[data-unit-slot="' + deal.unit + '"]').forEach(function (slot) {
        var cover = slot.querySelectorAll(".unit-slot-cover")[deal.group];
        slot.classList.remove("is-filling");
        if (cover && !cover.classList.contains("is-empty")) waiting.push(cover);
      });
      waiting.forEach(function (cover) { cover.classList.add("is-empty", "is-awaiting-deal"); });
      next = Array.prototype.filter.call(document.querySelectorAll(".unit-slot.is-active"), function (slot) {
        return Number(slot.dataset.unitSlot) !== deal.unit;
      });
      next.forEach(function (slot) { slot.classList.remove("is-active"); });
      if (next.length) {
        document.querySelectorAll('[data-unit-slot="' + deal.unit + '"]').forEach(function (slot) { slot.classList.add("is-active"); });
      }
    }
    function settle() {
      waiting.forEach(function (cover) { cover.classList.remove("is-empty", "is-awaiting-deal"); });
      if (next.length && document.body.contains(next[0])) {
        document.querySelectorAll('[data-unit-slot="' + deal.unit + '"]').forEach(function (slot) { slot.classList.remove("is-active"); });
        next.forEach(function (slot) { slot.classList.add("is-active"); });
        placeConfiguredUnitMarkers();
      }
      if (slide) slide();
    }
    // A faixa do telemóvel pode ter de deslizar até à unidade primeiro.
    if (wait && deal) {
      window.setTimeout(function () { flyConfiguredUnitDeal(deal, settle); }, wait);
      return;
    }
    flyConfiguredUnitDeal(deal, settle);
  }

  function flyConfiguredUnitDeal(deal, settle) {
    var target = deal && document.body.animate ? configuredUnitDealTarget(deal.unit, deal.group) : null;
    var to;
    var from;
    var fly;
    var scale;
    var dx;
    var dy;
    var flight;
    var delay;
    if (!target || !deal.rect) {
      if (target && deal.old) discardConfiguredUnitCover(deal.old, target.rect);
      settle();
      return;
    }
    to = target.rect;
    from = deal.rect;
    fly = target.cover.cloneNode(true);
    Array.prototype.forEach.call(fly.querySelectorAll(".unit-slot-ref"), function (ref) { ref.remove(); });
    fly.classList.remove("is-empty", "is-awaiting-deal", "has-ref");
    fly.classList.add("unit-deal-card");
    fly.setAttribute("aria-hidden", "true");
    fly.style.left = to.left + "px";
    fly.style.top = to.top + "px";
    fly.style.width = to.width + "px";
    fly.style.height = to.height + "px";
    document.body.appendChild(fly);
    delay = deal.old ? 150 : 0;
    if (deal.old) discardConfiguredUnitCover(deal.old, to);
    scale = Math.max(0.2, Math.min(from.width / to.width, from.height / to.height));
    dx = from.left + from.width / 2 - (to.left + to.width / 2);
    dy = from.top + from.height / 2 - (to.top + to.height / 2);
    flight = fly.animate([
      { transform: "translate(" + dx + "px," + dy + "px) scale(" + scale + ") rotate(0deg)", easing: "cubic-bezier(.2,.7,.3,1)" },
      { transform: "translate(" + dx + "px," + (dy - 16) + "px) scale(" + (scale * 1.06) + ") rotate(-6deg)", offset: 0.16, easing: "cubic-bezier(.55,0,.25,1)" },
      { transform: "translate(0,0) scale(1.1) rotate(8deg)", offset: 0.84, easing: "ease-out" },
      { transform: "translate(0,0) scale(1) rotate(0deg)" }
    ], { duration: 400, delay: delay, fill: "both" });
    function land() {
      if (!fly.parentNode) return;
      fly.remove();
      settle();
      target.cover.animate([
        { transform: "scale(1.12) rotate(-3deg)" },
        { transform: "scale(.95) rotate(2deg)", offset: 0.55 },
        { transform: "scale(1) rotate(0deg)" }
      ], { duration: 240, easing: "ease-out" });
    }
    flight.onfinish = land;
    flight.oncancel = land;
    // Os eventos da animação só chegam com frames; o lugar não pode ficar à espera.
    window.setTimeout(land, 460 + delay);
  }

  // A setinha por baixo da unidade activa desliza do sítio onde estava, como
  // a do seletor de cores das molduras.
  function placeConfiguredUnitMarkers() {
    var previous = state.configuredUnitMarkers || {};
    state.configuredUnitMarkers = {};
    document.querySelectorAll("[data-unit-marker]").forEach(function (marker) {
      var track = marker.parentNode;
      var key = track.hasAttribute("data-unit-mini-track") ? "mini" : "full";
      var slot = track.querySelector(".unit-slot.is-active");
      var from = previous[key];
      var to;
      if (!slot) {
        marker.hidden = true;
        return;
      }
      to = { x: slot.offsetLeft + slot.offsetWidth / 2, y: slot.offsetTop + slot.offsetHeight };
      marker.style.left = to.x + "px";
      marker.style.top = to.y + "px";
      state.configuredUnitMarkers[key] = to;
      if (from && (from.x !== to.x || from.y !== to.y) && marker.animate) {
        marker.animate([
          { transform: "translate(calc(-50% + " + (from.x - to.x) + "px), " + (from.y - to.y) + "px)" },
          { transform: "translate(-50%, 0)" }
        ], { duration: 180, delay: 50, easing: "cubic-bezier(.3,0,.2,1)", fill: "backwards" });
      }
    });
  }

  // Cada vez que um design é escolhido (também a segunda vez, ×2), o seu
  // visto ou contador salta, como o das cores.
  function animateConfiguredDesignBadges() {
    var previous = state.configuredDesignBadges;
    var current = {};
    document.querySelectorAll(".configured-units-card").forEach(function (card) {
      var input = card.querySelector("input");
      var badge = card.querySelector(".crachas-size-card-selected");
      var key = input ? input.name + "=" + input.value : "";
      var text = card.classList.contains("is-selected") && badge ? badge.textContent : "";
      current[key] = text;
      if (previous && text && previous[key] !== text && badge.animate) {
        badge.animate([
          { transform: "scale(.2)", opacity: 0 },
          { transform: "scale(1.3)", opacity: 1, offset: 0.6 },
          { transform: "scale(1)", opacity: 1 }
        ], { duration: 220, easing: "cubic-bezier(.3,0,.2,1)" });
      }
    });
    state.configuredDesignBadges = document.querySelector(".configured-units-card") ? current : null;
  }

  function bindConfiguredUnitActions(product) {
    document.querySelectorAll("[data-unit-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        var step = currentStep(product);
        var actionIndex = Number(button.dataset.unitAction);
        var action = configuredUnitActions(product, step)[actionIndex];
        var undo = state.configuredUnitActionUndo;
        if (!action) return;
        // Voltar a carregar num botão já aplicado desfaz o que ele fez, sem
        // novo "Reverter"; o pop que estiver aberto sai.
        if (configuredUnitActionPressed(product, step, action)) {
          if (undo && undo.actionIndex === actionIndex && undoConfiguredUnitAction(product, step)) {
            state.assignmentPickerUndos = (state.assignmentPickerUndos || []).filter(function (entry) { return entry.kind !== "unit-action"; });
          } else if (action.type === "toggle-all" || action.type === "same-name") {
            // Sem estado anterior guardado, estes desligam-se em todas.
            applyConfiguredUnitAction(product, step, action);
            state.configuredUnitActionUndo = null;
          } else {
            return;
          }
          state.errors = "";
          state.invalidFields = [];
          rerenderProduct(product);
          return;
        }
        if (!applyConfiguredUnitAction(product, step, action)) return;
        if (state.configuredUnitActionUndo) state.configuredUnitActionUndo.actionIndex = actionIndex;
        pushConfiguredUnitActionUndo(step, action);
        state.errors = "";
        state.invalidFields = [];
        rerenderProduct(product);
      });
    });
    document.querySelectorAll("[data-unit-mia-choice]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (!toggleConfiguredUnitMiaChoice(product, currentStep(product))) return;
        try { trackOptionSelected(product, "mia_choice", state.selections.assorted_designs === "1" ? "on" : "toggle", ""); } catch (e) {}
        state.errors = "";
        state.invalidFields = [];
        rerenderProduct(product);
      });
    });
    document.querySelectorAll("[data-unit-shared-name]").forEach(function (wrapper) {
      function sync(event) {
        var input = event.target;
        if (!input || !input.hasAttribute("data-cover-personalization-text")) return;
        setConfiguredUnitSharedName(product, input.value);
      }
      wrapper.addEventListener("input", sync);
      wrapper.addEventListener("change", sync);
    });
  }

  function bindConfiguredUnitControls(product) {
    watchConfiguredUnitTrayColumns(product);
    bindConfiguredUnitRows(product);
    bindConfiguredUnitActions(product);
    bindConfiguredUnitMini(product);
    bindOwnDesignCards(product);
    playConfiguredUnitDeal();
    placeConfiguredUnitMarkers();
    animateConfiguredDesignBadges();

    function refresh(focusSelector) {
      var target;
      state.errors = "";
      state.invalidFields = [];
      rerenderProduct(product);
      target = focusSelector ? document.querySelector(focusSelector) : null;
      if (target) target.focus({ preventScroll: true });
    }

    document.querySelectorAll("[data-unit-quantity]").forEach(function (input) {
      input.addEventListener("change", function () {
        setConfiguredUnitCount(product, input.value);
        refresh("[data-unit-quantity]");
      });
      input.addEventListener("focus", function () { input.select(); });
    });
    document.querySelectorAll("[data-unit-delta]").forEach(function (button) {
      button.addEventListener("click", function () {
        var delta = Number(button.dataset.unitDelta);
        setConfiguredUnitCount(product, configuredUnitCount(product) + delta);
        refresh('[data-unit-delta="' + delta + '"]:not(:disabled)');
      });
    });
    document.querySelectorAll("[data-unit-slot]").forEach(function (button) {
      button.addEventListener("click", function () {
        var index = Number(button.dataset.unitSlot);
        if (index === configuredUnitIndex(product)) return;
        saveConfiguredUnit(product);
        loadConfiguredUnit(product, index);
        refresh('[data-unit-slot="' + index + '"]');
      });
    });
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
    // Com várias unidades, o passo só acaba na última; até lá o botão segue
    // para a próxima (também no passo que normalmente mostra o carrinho).
    if (configuredUnitsPending(product, step)) {
      nextLabel = configuredUnitText(product, "nextLabel") || nextLabel;
      cartEntry = false;
    }
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
      renderStepLeadTimeNotice(product, step),
      displayStepText(product, step) ? '<p class="step-help">' + escapeHtml(displayStepText(product, step)) + '</p>' : '',
      state.currentStep === 0 ? renderProductPreview(product) + renderProductGallery(product) : "",
      renderVariationNotice(product, step),
      renderConfiguredUnitControls(product, step),
      configuredUnitLayoutActive(product, step) && isConfiguredRowStep(product, step) ? renderConfiguredUnitRows(product, step) : stepBody(product, step),
      renderQuadrosBuildSummary(product, step),
      '</div>',
      cartEntry ? renderCartEntryActions(product, step) : [
      '<div class="step-actions">',
      builderActionTotals(product, step),
      '<button class="button secondary" type="button" data-back data-track="true" data-track-action="back" data-track-id="back">Voltar</button>',
      '<div class="next-action-wrap">',
      state.errors ? siteErrorMarkup(state.errors, "form-error action-error", "step-action-error") : "",
      '<button class="button primary' + (suspended ? ' is-disabled' : '') + '" type="' + (isLast && !suspended ? "submit" : "button") + '" data-next' + (state.errors && !siteErrorsUseMiu() ? ' aria-describedby="step-action-error"' : '') + (suspended ? ' data-order-suspended-submit aria-disabled="true"' : '') + ' data-track="true" data-track-action="' + (isLast ? 'submit' : 'next') + '" data-track-id="' + (isLast ? 'submit' : 'next') + '">' + escapeHtml(nextLabel) + '</button>',
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
    if (document.querySelector("[data-cadernos-preview]") || isCadernosProduct(product) || isQuadrosProduct(product) || productUsesPreviewDrawers(product)) {
      initCadernoPreviewSlides();
    }
    if (isCadernosProduct(product) || productFamily(product) === "pasta-de-folhetos") {
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

    if (next === previous) {
      return;
    }

    state.errors = "";
    // STEP_JUMP_DIRECT_V1: um clique nos números tem resposta imediata. Esperar
    // por `history.go()` tornava o rato intermitente quando o stack real e o
    // espelho do wizard não estavam perfeitamente alinhados.
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
      // Cada passo começa na primeira unidade, venha-se de onde se vier.
      if (configuredUnitCount(product) > 1) {
        saveConfiguredUnit(product);
        loadConfiguredUnit(product, 0);
        // Nos passos de escolha, começa na primeira unidade por escolher.
        if (isConfiguredPickStep(product, steps[next])) {
          loadConfiguredUnit(product, Math.max(0, configuredUnitFirstPending(configuredUnitsStepReady(product, steps[next]))));
        }
      }
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
