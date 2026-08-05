// js/14-upload-quantidade.js — parte 14/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: acoes de foto do pedido (renderOrderPhotoAction, renderPhotoUploadStep), donorFor, descontos de pack, grafico de preco por quantidade, renderQuantityBuilder.
  function renderOrderPhotoAction(config, options) {
    var settings = options || {};
    var key = config.selectionKey || "quadro_uploads";
    var items = orderUploadItems(key);
    var multiple = config.multiple === true;
    var maxFiles = orderUploadMaxFiles(config);
    var helpDisabled = !!settings.helpDisabled;
    var disabled = state.orderUploadBusy || helpDisabled || items.length >= maxFiles;
    var maxAttribute = isFinite(maxFiles) ? maxFiles : 0;
    var buttonLabel = String(config.buttonLabel || "Escolher foto");
    if (buttonLabel === "Enviar foto") {
      buttonLabel = "Escolher foto";
    }
    var helperText = items.length
      ? items.length + (items.length === 1 ? " foto anexada" : " fotos anexadas")
      : String(config.helperText || (multiple && isFinite(maxFiles) ? "Até " + maxFiles + " fotos" : "")).trim();

    return [
      '<label class="order-upload-button' + (settings.compact ? ' order-media-action' : '') + (disabled ? ' is-disabled' : '') + '">',
      '<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"' + (multiple ? ' multiple' : '') + ' data-order-upload data-order-upload-key="' + escapeHtml(key) + '" data-order-upload-max="' + maxAttribute + '"' + (disabled ? ' disabled' : '') + '>',
      '<span class="order-upload-button-icon">' + (settings.compact ? ICON_PHOTO : ICON_UPLOAD) + '</span>',
      '<strong>' + escapeHtml(buttonLabel) + '</strong>',
      helperText ? '<small' + (items.length ? ' class="is-success"' : '') + '>' + escapeHtml(helperText) + '</small>' : '',
      '</label>'
    ].join("");
  }

  function renderOrderPhotoControl(config, options) {
    var settings = options || {};
    var uploadList = renderOrderUploadList(config, "photo");

    return [
      '<div class="order-photo-control">',
      renderOrderPhotoAction(config, settings),
      uploadList ? '<ul class="order-upload-list">' + uploadList + '</ul>' : '',
      settings.showStatus ? renderOrderUploadStatus("photo") : '',
      '</div>'
    ].join("");
  }

  function renderOrderAudioAction(config, options) {
    var settings = options || {};
    var key = config.selectionKey || "quadro_audio_uploads";
    var disabled = state.orderUploadBusy || !(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    var title = state.orderAudioRecording ? "A gravar…" : String(config.buttonLabel || "Áudio");
    var helperText = state.orderAudioRecording ? "Solta para anexar" : String(config.helperText || "Mantém premido para falar");

    return [
      '<button type="button" class="order-audio-record-button' + (settings.compact ? ' order-media-action' : '') + (state.orderAudioRecording ? ' is-recording' : '') + '" data-order-audio-record data-order-audio-key="' + escapeHtml(key) + '" aria-label="' + escapeHtml(title + ". " + helperText) + '"' + (disabled ? ' disabled' : '') + '>',
      '<span class="order-audio-record-icon">' + ICON_MICROPHONE + '</span>',
      '<span><strong>' + escapeHtml(title) + '</strong><small>' + escapeHtml(helperText) + '</small></span>',
      '</button>'
    ].join("");
  }

  function renderOrderAudioControl(config) {
    var uploadList = renderOrderUploadList(config, "audio");

    return [
      '<div class="order-audio-control">',
      renderOrderAudioAction(config),
      uploadList ? '<ul class="order-upload-list order-audio-list">' + uploadList + '</ul>' : '',
      renderOrderUploadStatus("audio"),
      '</div>'
    ].join("");
  }

  function renderOrderMediaAttachments(config) {
    var photos = config && config.photos ? config.photos : null;
    var audio = config && config.audio ? config.audio : null;
    var photoList = photos ? renderOrderUploadList(photos, "photo") : "";
    var audioList = audio ? renderOrderUploadList(audio, "audio") : "";

    if (!photos && !audio) {
      return "";
    }

    return [
      '<div class="order-media-attachments">',
      '<div class="order-media-action-bar">',
      audio ? renderOrderAudioAction(audio, { compact: true }) : '',
      photos ? renderOrderPhotoAction(photos, { compact: true }) : '',
      '</div>',
      audioList ? '<ul class="order-upload-list order-audio-list order-media-upload-list">' + audioList + '</ul>' : '',
      photoList ? '<ul class="order-upload-list order-media-upload-list">' + photoList + '</ul>' : '',
      renderOrderUploadStatus(),
      '</div>'
    ].join("");
  }

  function renderPhotoUploadStep(step) {
    var config = step.upload || {};
    var hasUploads = orderUploadItems(config.selectionKey || "quadro_uploads").length > 0;
    // Com foto enviada o pedido de ajuda deixa de fazer sentido: escondemos a
    // opção (e a mensagem) para não aparecerem os dois no passo nem no resumo.
    var helpSelected = !!(config.helpKey && state.selections[config.helpKey] && !hasUploads);

    return [
      '<section class="order-photo-upload">',
      renderOrderPhotoControl(config, { helpDisabled: helpSelected }),
      renderOrderUploadStatus("photo"),
      config.helpKey && !hasUploads ? [
        '<label class="photo-help-choice">',
        '<input type="checkbox" data-photo-help-key="' + escapeHtml(config.helpKey) + '"' + (state.selections[config.helpKey] ? ' checked' : '') + '>',
        '<span>' + escapeHtml(config.helpLabel || "Preciso de ajuda para enviar a foto") + '</span>',
        '</label>',
        helpSelected ? '<p class="photo-help-message">Podes carregar em continuar, e depois ajudamos-te a enviar uma foto</p>' : ''
      ].join("") : '',
      '</section>'
    ].join("");
  }

  function renderChoiceItems(product, step, template) {
    var type = step.selection === "multi" ? "checkbox" : "radio";
    var selected = selectedValues(step);
    var gridClass = template === "media-list" ? "option-list" : template;
    var items = step.items || [];
    var maxSelections = Math.max(0, parseInt(step.maxSelections, 10) || 0);
    var limitReached = maxSelections > 0 && selected.length >= maxSelections;
    var selectionCounter = maxSelections > 0
      ? '<p class="choice-selection-counter" aria-live="polite">Escolhidas ' + selected.length + ' de ' + maxSelections + ' cores</p>'
      : "";
    var html = "";

    if (template === "design-grid" && getStepSectionConfig(product, step)) {
      return renderSectionedDesignChoiceItems(product, step);
    }

    items.forEach(function (item) {
      var checked = selected.indexOf(item.value) !== -1 ? " checked" : "";
      var disabled = step.selection === "multi" && limitReached && !checked ? " disabled" : "";
      var image;
      if (item.swatch) {
        image = renderChoiceSwatch(item);
      } else if (template === "text-grid" && item.image && (step.id === "frame_size" || isQuadrosProduct(product))) {
        image = renderVisual(item, "media-list", step);
      } else if (template === "text-grid" || template === "price-pack-grid") {
        image = "";
      } else {
        image = template === "design-grid" ? renderDesignCardMedia(product, step, item) : renderVisual(item, template, step);
      }
      var noteText = quadroChoiceNote(product, step, item);
      var note = noteText ? '<span class="choice-note">' + escapeHtml(noteText) + '</span>' : "";
      var card = [
        '<label class="choice-card ' + escapeHtml(template) + '">',
        '<input type="' + type + '" name="' + escapeHtml(step.field) + '" value="' + escapeHtml(item.value) + '" data-choice-step="' + escapeHtml(step.id) + '"' + checked + disabled + '>',
        image,
        '<span class="choice-copy">',
        '<strong>' + escapeHtml(item.title) + '</strong>',
        '<span>' + escapeHtml(item.subtitle) + '</span>',
        note,
        '</span>',
        adminItemControls(step, item),
        '</label>'
      ].join("");

      html += isQuadrosProduct(product) && checked && Array.isArray(item.drawerImages) && item.drawerImages.length
        ? '<div class="quadros-design-choice quadros-option-drawer-choice">' + card + renderQuadroDesignDrawer(product, item) + '</div>'
        : card;
    });

    return renderDesignActionControls(product, step) + selectionCounter + '<div class="' + escapeHtml(gridClass) + '" data-choice-grid-step="' + escapeHtml(step.id) + '">' + html + '</div>' + (state.admin ? '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar opção</button>' : "");
  }

  function renderSizeChoiceItems(product, step) {
    var selected = selectedValues(step);
    var html = "";
    // IMANES_SIZE_CARD_NOTE_RESTORE_V1: nos imanes continuamos a esconder
    // apenas a coluna direita de preco/placeholder, mas voltamos a mostrar o
    // texto do campo "Nota" do JSON dentro do cartao.
    var hidePricePreview = product && product.slug === "imanes";

    (step.items || []).forEach(function (item) {
      var checked = selected.indexOf(item.value) !== -1 ? " checked" : "";
      var muted = selected.length && !checked ? " is-muted" : "";
      var info = priceForSize(product, item.value);
      // CRACHAS_SIZE_BEFORE_QUANTITY_V1: nos Crachas o size aparece antes
      // do pack, por isso o placeholder antigo "Escolhe um pack para ver
      // o preco" deixava de fazer sentido. Para crachas mostramos um aviso
      // que aponta para o passo seguinte; outros produtos mantem a frase
      // antiga, que continua valida no fluxo deles.
      var noPriceText = product && product.slug === "crachas"
        ? "No próximo passo escolhes a quantidade e vês o preço final."
        : "Escolhe um pack para ver o preço.";
      var price = info.cents
        ? [
          '<strong>' + escapeHtml(info.total + ' para ' + productQuantityLabel(product, info.quantity) + '.') + '</strong>',
          '<p>' + escapeHtml('Ou seja, ' + info.perPin + (info.discount > 0 ? '. Poupas ' + info.discount + '%' : '.')) + '</p>'
        ].join("")
        : [
          '<p>' + escapeHtml(noPriceText) + '</p>'
        ].join("");

      html += [
        '<label class="choice-card media-list size-choice' + muted + '">',
        '<input type="radio" name="' + escapeHtml(step.field) + '" value="' + escapeHtml(item.value) + '" data-choice-step="' + escapeHtml(step.id) + '"' + checked + '>',
        renderVisual(item, "media-list", step),
        '<span class="choice-copy">',
        '<strong>' + escapeHtml(item.title) + '</strong>',
        '<span>' + escapeHtml(item.subtitle) + '</span>',
        item.note ? '<span class="choice-note">' + escapeHtml(item.note) + '</span>' : "",
        '</span>',
        hidePricePreview ? "" : '<span class="size-price-preview">' + price + '</span>',
        adminItemControls(step, item),
        '</label>'
      ].join("");
    });

    return '<div class="option-list size-choice-list">' + html + '</div>' + (state.admin ? '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar opção</button>' : "");
  }

  function adminImageSlotAttrs(item) {
    var attrs = "";

    if (item && item._imageEditKey) {
      attrs += ' data-mia-edit-key="' + escapeHtml(item._imageEditKey) + '"';
    }
    if (item && item._imageEditFallbackKey) {
      attrs += ' data-mia-fallback-edit-key="' + escapeHtml(item._imageEditFallbackKey) + '"';
    }
    if (item && item._imageEditStoreItemId) {
      attrs += ' data-admin-image-store-item-id="' + escapeHtml(item._imageEditStoreItemId) + '"';
    }
    return attrs;
  }

  function adminItemControls(step, item) {
    var frameScaleValue;
    var frameDefaultSize;
    var imageSlotAttrs;

    if (!state.admin) {
      return "";
    }

    imageSlotAttrs = adminImageSlotAttrs(item);
    frameScaleValue = step.template !== "quantity-builder"
      ? frameEditNumber(item, step, false, "frameScale", 100, 40, 300)
      : 100;
    frameDefaultSize = Math.round(defaultFrameBaseSize(item, step.template, step) * frameScaleValue / 100);

    return [
      '<div class="admin-card-tools">',
      '<label>Título<input type="text" value="' + escapeHtml(item.title) + '" data-admin-edit="title" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>',
      '<label>Linha 2<input type="text" value="' + escapeHtml(item.subtitle || "") + '" data-admin-edit="subtitle" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>',
      '<label>Valor<input type="text" value="' + escapeHtml(item.value || "") + '" data-admin-edit="value" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>',
      state.product && (state.product.slug === "imanes" || state.product.slug === "caderninhos") && step.id === "designs" ? '<label>Formato<select data-admin-edit="rectOrientation" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"><option value="portrait"' + (itemRectOrientation(item) === "portrait" ? " selected" : "") + '>Em pé</option><option value="landscape"' + (itemRectOrientation(item) === "landscape" ? " selected" : "") + '>Deitado</option></select></label>' : "",
      item.quantity != null ? '<label>Quantidade<input type="number" min="1" step="1" value="' + escapeHtml(item.quantity) + '" data-admin-edit="quantity" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>' : "",
      '<label>Nota<input type="text" value="' + escapeHtml(item.note || "") + '" data-admin-edit="note" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>',
      step.template !== "quantity-builder" ? '<label>Imagem<input type="file" accept="image/*" data-admin-upload data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>' : "",
      step.template !== "quantity-builder" ? '<label>Tamanho da moldura (%)<input type="number" min="40" max="300" step="1" value="' + escapeHtml(frameScaleValue) + '" data-admin-edit="frameScale" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
      step.template !== "quantity-builder" ? '<label>Largura moldura (px)<input type="number" min="1" max="2000" step="1" value="' + escapeHtml(frameEditNumber(item, step, false, "frameWidth", frameDefaultSize, 1, 2000)) + '" data-admin-edit="frameWidth" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
      step.template !== "quantity-builder" ? '<label>Altura moldura (px)<input type="number" min="1" max="2000" step="1" value="' + escapeHtml(frameEditNumber(item, step, false, "frameHeight", frameDefaultSize, 1, 2000)) + '" data-admin-edit="frameHeight" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
      step.template !== "quantity-builder" ? '<label>Margem moldura X (px)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(frameEditNumber(item, step, false, "frameMarginX", 0, -100, 100)) + '" data-admin-edit="frameMarginX" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
      step.template !== "quantity-builder" ? '<label>Margem moldura Y (px)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(frameEditNumber(item, step, false, "frameMarginY", 0, -100, 100)) + '" data-admin-edit="frameMarginY" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
      step.template !== "quantity-builder" ? '<label>Zoom imagem (%)<input type="number" min="20" max="500" step="1" value="' + escapeHtml(imageEditNumber(item, step, false, "imageZoom", 168, 20, 500)) + '" data-admin-edit="imageZoom" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
      step.template !== "quantity-builder" ? '<label>Imagem X (%)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(imageEditNumber(item, step, false, "imagePositionX", 0, -100, 100)) + '" data-admin-edit="imagePositionX" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
      step.template !== "quantity-builder" ? '<label>Imagem Y (%)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(imageEditNumber(item, step, false, "imagePositionY", 0, -100, 100)) + '" data-admin-edit="imagePositionY" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
      step.template !== "quantity-builder" ? '<label>Rotação imagem (°)<input type="number" min="-180" max="180" step="1" value="' + escapeHtml(imageEditNumber(item, step, false, "imageRotation", 0, -180, 180)) + '" data-admin-edit="imageRotation" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
      state.product && state.product.slug === "cadernos" && step.id === "designs" ? '<label>Imagens do interior (' + escapeHtml((item.interiorImages || []).length) + ')<input type="file" accept="image/*" multiple data-admin-interior-upload data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>' : "",
      state.product && state.product.slug === "cadernos" && step.id === "designs" && (item.interiorImages || []).length ? '<button type="button" data-admin-interior-clear data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '">Limpar interiores</button>' : "",
      getStepSectionConfig(state.product, step) ? renderSectionItemControls(step, item) : "",
      // CRACHAS_STEP2_SIDE_PHOTO_ADMIN_V4: bloco extra para a foto direita
      // que fica visivel so nos cartoes de tamanho dos crachas. Gravado em
      // sideImage / sideFrameWidth / sideFrameHeight / sideFrameScale /
      // sideFrameMarginX|Y / sideImageZoom / sideImagePositionX|Y /
      // sideImageRotation. Nunca toca em image / frameWidth / frameHeight.
      state.product && state.product.slug === "crachas" && step.id === "size" ? renderCrachasSidePhotoAdminControls(step, item) : "",
      '<button type="button" data-admin-delete-item data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '">Del</button>',
      '</div>'
    ].join("");
  }

  function renderCrachasSidePhotoAdminControls(step, item) {
    var stepId = escapeHtml(step.id);
    var itemId = escapeHtml(item.id);
    var sideFrameScale = frameEditNumber(item, step, true, "sideFrameScale", 100, 40, 300);
    var defaultWidth = Math.round(defaultSideFrameWidth(item) * sideFrameScale / 100);
    var defaultHeight = Math.round(defaultSideFrameHeight(item) * sideFrameScale / 100);

    return [
      '<div class="admin-card-tools-section admin-card-tools-side">',
      '<p class="admin-card-tools-heading">Foto de comparação</p>',
      '<label>Imagem<input type="file" accept="image/*" data-admin-side-upload data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      isUploadedSideImage(item) ? '<button type="button" data-admin-side-clear data-step-id="' + stepId + '" data-item-id="' + itemId + '">Limpar foto de comparação</button>' : "",
      '<label>Tamanho da moldura (%)<input type="number" min="40" max="300" step="1" value="' + escapeHtml(sideFrameScale) + '" data-admin-side-edit="sideFrameScale" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      '<label>Largura moldura (px)<input type="number" min="1" max="2000" step="1" value="' + escapeHtml(frameEditNumber(item, step, true, "sideFrameWidth", defaultWidth, 1, 2000)) + '" data-admin-side-edit="sideFrameWidth" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      '<label>Altura moldura (px)<input type="number" min="1" max="2000" step="1" value="' + escapeHtml(frameEditNumber(item, step, true, "sideFrameHeight", defaultHeight, 1, 2000)) + '" data-admin-side-edit="sideFrameHeight" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      '<label>Margem moldura X (px)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(frameEditNumber(item, step, true, "sideFrameMarginX", 0, -100, 100)) + '" data-admin-side-edit="sideFrameMarginX" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      '<label>Margem moldura Y (px)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(frameEditNumber(item, step, true, "sideFrameMarginY", 0, -100, 100)) + '" data-admin-side-edit="sideFrameMarginY" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      '<label>Zoom imagem (%)<input type="number" min="20" max="500" step="1" value="' + escapeHtml(imageEditNumber(item, step, true, "sideImageZoom", 168, 20, 500)) + '" data-admin-side-edit="sideImageZoom" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      '<label>Imagem X (%)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(imageEditNumber(item, step, true, "sideImagePositionX", 0, -100, 100)) + '" data-admin-side-edit="sideImagePositionX" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      '<label>Imagem Y (%)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(imageEditNumber(item, step, true, "sideImagePositionY", 0, -100, 100)) + '" data-admin-side-edit="sideImagePositionY" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      '<label>Rotação imagem (°)<input type="number" min="-180" max="180" step="1" value="' + escapeHtml(imageEditNumber(item, step, true, "sideImageRotation", 0, -180, 180)) + '" data-admin-side-edit="sideImageRotation" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      '</div>'
    ].join("");
  }

  function renderSectionItemControls(step, item) {
    var config = getStepSectionConfig(state.product, step);
    if (!config) {
      return "";
    }
    var sections = ensureStepSections(step, config.defaults);
    var fallbackId = sections[0] && sections[0].id;
    var currentId = item && item.sectionId ? item.sectionId : fallbackId;
    var sectionOrderRaw = item && item.sectionOrder != null ? item.sectionOrder : "";
    var optionsHtml = sections.map(function (section) {
      return '<option value="' + escapeHtml(section.id) + '"' + (section.id === currentId ? " selected" : "") + ">" + escapeHtml(section.title) + "</option>";
    }).join("");
    var separatorLabel = config.mode === "invisible" ? "Grupo (não visível no site)" : "Separador";
    var orderLabel = config.mode === "invisible" ? "Ordem dentro do grupo" : "Ordem dentro do separador";
    var originalTitleHint = item && item.title && displayItemTitle(item) !== item.title
      ? '<p class="admin-original-title">Original: ' + escapeHtml(item.title) + '</p>'
      : "";

    return [
      originalTitleHint,
      '<label>' + escapeHtml(separatorLabel) + '<select data-admin-edit="sectionId" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '">' + optionsHtml + '</select></label>',
      '<label>' + escapeHtml(orderLabel) + '<input type="number" step="1" placeholder="(sem ordem)" value="' + escapeHtml(sectionOrderRaw) + '" data-admin-edit="sectionOrder" data-admin-allow-empty="1" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>'
    ].join("");
  }

  // Alias retro-compativel.
  function renderCrachasSectionItemControls(step, item) {
    return renderSectionItemControls(step, item);
  }

  function renderPinStack(item, quantity, step) {
    var count = Math.min(quantity, 12);
    var rest = quantity - count;
    var html = "";
    var i;

    for (i = 0; i < count; i += 1) {
      if (isUploadedImage(item)) {
        html += '<span class="pin-stack-dot' + itemRectOrientationClass(item) + ' uploaded-image" style="' + uploadedStackStyle(item, step) + '" aria-hidden="true"><span class="uploaded-image-inner"></span></span>';
      } else {
        html += '<span class="' + escapeHtml(item.visual || "neutral") + '">' + escapeHtml(item.badge || "") + '</span>';
      }
    }

    if (rest > 0) {
      html += '<strong>+' + rest + '</strong>';
    }

    return '<div class="pin-stack" aria-hidden="true">' + html + '</div>';
  }

  function nextDesignValue(product, value) {
    var items = selectedDesignItems(product);
    var index = items.map(function (item) {
      return item.value;
    }).indexOf(value);

    if (items.length < 2 || index === -1) {
      return "";
    }

    return items[(index + 1) % items.length].value;
  }

  function donorFor(product, targetValue) {
    var donor = null;

    selectedDesignItems(product).forEach(function (item) {
      var quantity = quantityFor(item.value);

      if (item.value === targetValue || quantity <= 1) {
        return;
      }

      if (!donor || quantity > donor.quantity) {
        donor = {
          value: item.value,
          quantity: quantity
        };
      }
    });

    return donor ? donor.value : "";
  }

  function canAdjustQuantity(product, value, direction) {
    var itemCount = selectedDesignItems(product).length;

    if (itemCount < 2) {
      return false;
    }

    if (direction < 0) {
      return quantityFor(value) > 1;
    }

    if (itemCount >= 3) {
      return unassignedCount(product) > 0;
    }

    return donorFor(product, value) !== "";
  }

  function moveOnePin(product, fromValue, toValue) {
    var quantities = state.selections.design_quantities || {};

    if (!fromValue || !toValue || fromValue === toValue || quantityFor(fromValue) <= 1) {
      return false;
    }

    quantities[fromValue] = quantityFor(fromValue) - 1;
    quantities[toValue] = quantityFor(toValue) + 1;
    state.selections.design_quantities = quantities;
    state.quantitiesTouched = true;
    return true;
  }

  function removeOnePin(product, value) {
    var quantities = state.selections.design_quantities || {};

    if (quantityFor(value) <= 1) {
      return false;
    }

    quantities[value] = quantityFor(value) - 1;
    state.selections.design_quantities = quantities;
    state.quantitiesTouched = true;
    return true;
  }

  function assignOnePin(product, value) {
    var quantities = state.selections.design_quantities || {};

    if (unassignedCount(product) <= 0) {
      return false;
    }

    quantities[value] = quantityFor(value) + 1;
    state.selections.design_quantities = quantities;
    state.quantitiesTouched = true;
    return true;
  }

  // CRACHAS_PACK_DISABLED_MESSAGE_V1
  // Mostra TODOS os packs com preco mas marca como desativado quando a
  // quantidade nao chega para todos os designs escolhidos. Clicar num pack
  // desativado nao seleciona; em vez disso mostra uma mensagem curta junto
  // aos packs explicando porque o pack nao serve.
  // PACK_SAVINGS_RIBBON_V1: dentro de cada botao de pack, quando ha
  // desconto face ao preco unitario, mostra uma fita "Poupas X%" no
  // canto superior direito. Funciona para qualquer produto que tenha
  // tabela de precos com unitario (chave "1") e packs maiores baratos.
  function packDiscountPercent(priceTable, quantity) {
    var unitCents;
    var packCents;

    if (!priceTable || !quantity || quantity < 2) {
      return 0;
    }

    unitCents = baselineUnitCents(priceTable);
    packCents = Number(priceTable[String(quantity)]) || 0;

    if (!unitCents || !packCents || packCents >= unitCents * quantity) {
      return 0;
    }

    return Math.round((1 - packCents / (unitCents * quantity)) * 100);
  }

  // PACK_SAVINGS_INFO_V1: caixa por baixo dos packs com o valor poupado
  // (em €), a percentagem face ao preco unitario, e um nudge para escolher
  // um pack maior se houver um com maior desconto.
  function renderPackSavingsInfo(product, priceTable, currentQuantity) {
    var unitCents;
    var packCents;
    var savedCents;
    var discount;
    var unitSingular;
    var hasBetterPack = false;
    var lines = [];

    if (!priceTable || !currentQuantity) {
      return "";
    }

    unitCents = Number(priceTable["1"]) || 0;
    packCents = Number(priceTable[String(currentQuantity)]) || 0;

    if (!unitCents || !packCents) {
      return "";
    }

    savedCents = (unitCents * currentQuantity) - packCents;
    discount = packDiscountPercent(priceTable, currentQuantity);
    unitSingular = (product && product.unitSingular) ? product.unitSingular : "unidade";

    Object.keys(priceTable).forEach(function (key) {
      var qty = parseInt(key, 10);
      if (qty > currentQuantity && packDiscountPercent(priceTable, qty) > discount) {
        hasBetterPack = true;
      }
    });

    if (savedCents <= 0 || discount <= 0) {
      if (hasBetterPack) {
        return '<p class="pack-savings-info pack-savings-info--nudge">Escolhe um pack maior para começares a poupar.</p>';
      }
      return "";
    }

    lines.push('Com este pack <strong>poupas ' + escapeHtml(formatCents(savedCents)) + '</strong>, ou seja <strong>' + discount + '%</strong> em relação ao preço de um ' + escapeHtml(unitSingular) + ' individual.');
    if (hasBetterPack) {
      lines.push(' Escolhe um pack maior para poupares mais.');
    }

    return '<p class="pack-savings-info">' + lines.join("") + '</p>';
  }

  function packDisabledMessageFor(product, quantity) {
    var unitSingular = (product && product.unitSingular) ? product.unitSingular : (product && product.unitShort ? product.unitShort : "unidade");
    var unitLabel = (product && product.unitLabel) ? product.unitLabel : unitSingular + "s";
    var unit = quantity === 1 ? unitSingular : unitLabel;
    var verb = quantity === 1 ? "não chega" : "não chegam";
    return quantity + " " + unit + " " + verb + " para todos os designs que escolheste. Escolhe um número maior.";
  }

  function renderPackSelector(product) {
    var packStep = findStep(product, "pack");
    var current = getPackQuantity(product);
    var packModeSelected = !freeQuantityStep(product) || freeQuantitySelectionMode(product) === "pack";
    var selectedCount = selectedDesignItems(product).length;
    var priceTable = activePriceTableForPackFilter(product);
    var visibleItems = packStep && Array.isArray(packStep.items)
      ? packStep.items.filter(function (item) {
          var quantity = Number(item.quantity);
          return !priceTable || priceTable[String(quantity)] != null;
        })
      : [];
    var cards = "";
    var adminEditor = "";
    var message = state.packDisabledMessage || "";

    visibleItems.forEach(function (item) {
      var quantity = Number(item.quantity);
      var disabled = quantity < selectedCount;
      var classes = "pack-option";
      if (quantity === current && packModeSelected) {
        classes += " is-selected";
      }
      if (disabled) {
        classes += " is-disabled";
      }
      // CLICK_TRACKING_V1: data-track-* permite agregar quais packs são
      // mais escolhidos / quantos cliques falham (pack disabled).
      cards += [
        '<button class="' + classes + '" type="button" data-pack-quantity="' + quantity + '" data-track="true" data-track-action="select_pack" data-track-id="pack_' + quantity + '" data-track-label="' + escapeHtml(item.title + ' ' + item.subtitle) + '" aria-pressed="' + (quantity === current && packModeSelected ? 'true' : 'false') + '"' + (disabled ? ' data-pack-disabled="1" aria-disabled="true"' : '') + '>',
        '<strong>' + escapeHtml(item.title) + '</strong>',
        '<span>' + escapeHtml(item.subtitle) + '</span>',
        '</button>'
      ].join("");
    });

    if (state.admin && packStep) {
      adminEditor = [
        '<div class="admin-pack-items">',
        (packStep.items || []).map(function (item) {
          return adminItemControls(packStep, item);
        }).join(""),
        '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(packStep.id) + '">Adicionar pack</button>',
        '</div>'
      ].join("");
    }

    return [
      '<div class="pack-control">',
      '<div class="pack-options">',
      cards,
      '</div>',
      message ? '<p class="pack-disabled-message" role="status" aria-live="polite">' + escapeHtml(message) + '</p>' : "",
      adminEditor,
      '</div>'
    ].join("");
  }

  function renderQuantityStatus(product) {
    var packQuantity = getPackQuantity(product);
    var total = quantityTotal(product);
    var diff = packQuantity - total;
    var text = diff === 0 ? "Pack completo" : diff > 0 ? "Faltam " + diff : "Tens " + Math.abs(diff) + " a mais";

    if (diff === 0) {
      return "";
    }

    if (diff > 0 && selectedDesignItems(product).length >= 3) {
      return "";
    }

    return [
      '<div class="quantity-status ' + (diff === 0 ? "is-complete" : "needs-work") + '">',
      '<strong>' + total + ' / ' + escapeHtml(productQuantityLabel(product, packQuantity)) + '</strong>',
      '<span>' + escapeHtml(text) + '</span>',
      '</div>'
    ].join("");
  }

  // PACK_PRICE_OVERVIEW_PRO_V5 + V5_ICONS_LEFT: caixa de resumo com layout
  // assimétrico (esquerda: 2 linhas Cada/Desconto, cada uma com ícone
  // pequeno · direita: Total grande sem ícone, separados por divisor
  // vertical subtil). Quando o pack é 1 unidade, colapsa numa coluna
  // centrada com só o total. Mantém os mesmos cálculos e dependências de
  // pricing.
  function tagIconSvg() {
    return [
      '<svg class="summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" aria-hidden="true" focusable="false">',
      '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>',
      '<circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none"></circle>',
      '</svg>'
    ].join("");
  }

  function percentBadgeIconSvg() {
    return [
      '<svg class="summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" aria-hidden="true" focusable="false">',
      '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76z"></path>',
      '<line x1="9" y1="15" x2="15" y2="9"></line>',
      '<circle cx="9.5" cy="9.5" r="0.8" fill="currentColor" stroke="none"></circle>',
      '<circle cx="14.5" cy="14.5" r="0.8" fill="currentColor" stroke="none"></circle>',
      '</svg>'
    ].join("");
  }

  function renderPackPriceOverview(product) {
    var packQuantity = getPackQuantity(product);
    var prices = product.prices || {};
    var priceKeys = state.selections.size ? [state.selections.size] : Object.keys(prices);
    var unitSingular = (product && product.unitSingular) ? product.unitSingular : (product && product.unitShort ? product.unitShort : "unidade");
    var rows = "";

    if (!packQuantity) {
      return "";
    }

    priceKeys.forEach(function (size) {
      var info = priceForSize(product, size);
      var perUnit;
      var solo = packQuantity === 1;
      var hasHeader = priceKeys.length > 1;
      var headerHtml = hasHeader ? '<header>' + escapeHtml(priceDisplayName(product, size)) + '</header>' : "";
      var leftHtml;

      if (!info.cents) {
        return;
      }

      perUnit = info.perPin.replace(/\s*\/.*$/, "");

      if (solo) {
        rows += [
          '<article class="pack-price-card pack-price-card--solo">',
          headerHtml,
          '<div class="summary-total summary-total--solo">',
          '<div class="total-top"><div class="total-value">' + escapeHtml(info.total) + '</div></div>',
          '<div class="total-label">por 1 ' + escapeHtml(unitSingular) + '</div>',
          '</div>',
          '</article>'
        ].join("");
        return;
      }

      leftHtml = '<div class="summary-left">'
        + '<div class="summary-row">'
        + tagIconSvg()
        + '<span class="summary-value">' + escapeHtml(perUnit) + '</span>'
        + '<span class="summary-label">cada</span>'
        + '</div>';

      if (info.discount > 0) {
        leftHtml += '<div class="summary-row is-discount">'
          + percentBadgeIconSvg()
          + '<span class="summary-value">' + info.discount + '%</span>'
          + '<span class="summary-label">desconto</span>'
          + '</div>';
      }

      leftHtml += '</div>';

      rows += [
        '<article class="pack-price-card">',
        headerHtml,
        leftHtml,
        '<div class="summary-divider" aria-hidden="true"></div>',
        '<div class="summary-total">',
        '<div class="total-top"><div class="total-value">' + escapeHtml(info.total) + '</div></div>',
        '<div class="total-label">total</div>',
        '</div>',
        '</article>'
      ].join("");
    });

    if (!rows) {
      return "";
    }

    return '<section class="pack-price-overview" aria-label="Preços deste pack">' + rows + '</section>';
  }

  function renderUnassignedPins(product) {
    var count = unassignedCount(product);
    var pins = "";
    var i;

    if (count <= 0 || selectedDesignItems(product).length < 3) {
      return "";
    }

    for (i = 0; i < count; i += 1) {
      pins += '<span class="sad-pin" aria-hidden="true">:(</span>';
    }

    return [
      '<section class="unassigned-pins" aria-label="Unidades sem design">',
      '<div>',
      '<strong>Unidades sem design:</strong>',
      '<span>' + count + '</span>',
      '</div>',
      '<div class="sad-pin-list">',
      pins,
      '</div>',
      '</section>'
    ].join("");
  }

  function renderFreeQuantityPriceChart(product) {
    var table = activePriceTableForPackFilter(product);

    if (!usesLinearDiscountPricing(product) || !table) {
      return "";
    }

    return [
      '<section class="free-price-chart" aria-labelledby="free-price-chart-title">',
      '<header class="free-price-chart-heading">',
      '<div><span>Vê antes de escolher</span><h3 id="free-price-chart-title">Como o preço total varia</h3></div>',
      '<p id="free-price-chart-help">Clica ou toca na linha para consultar outra quantidade.</p>',
      '</header>',
      '<div class="free-price-chart-stage" data-free-price-chart tabindex="0" role="group" aria-describedby="free-price-chart-help free-price-chart-tooltip">',
      '<canvas data-free-price-chart-canvas aria-hidden="true"></canvas>',
      '<span class="free-price-chart-current" data-free-price-chart-current hidden>A tua quantidade</span>',
      '</div>',
      '<div class="free-price-chart-tooltip" id="free-price-chart-tooltip" data-free-price-chart-tooltip aria-live="polite"></div>',
      '<div class="free-price-chart-axis-labels" aria-hidden="true"><span>Preço total</span><span>Quantidade</span></div>',
      '</section>'
    ].join("");
  }

  function freePriceChartMaximum(product, priceTable, current) {
    var minimum = minimumFreeQuantity(product);
    var maximum = maximumFreeQuantity(product);
    var largestPack = Object.keys(priceTable || {}).reduce(function (largest, key) {
      return Math.max(largest, parseInt(key, 10) || 0);
    }, minimum);
    var target = Math.max(minimum + 20, Math.ceil(largestPack * 1.25), Math.ceil(current * 1.15));

    target = Math.ceil(target / 5) * 5;
    return Math.max(minimum, Math.min(maximum, target));
  }

  function initFreeQuantityPriceCharts(product) {
    var stage;
    var canvas;
    var tooltip;
    var currentLabel;
    var priceTable;
    var context;
    var observer = null;
    var inspectedQuantity;
    var hasInteracted = false;
    var series = [];
    var chartMinimum = 1;
    var chartMaximum = 1;
    var plot = null;

    freeQuantityChartCleanup();
    freeQuantityChartCleanup = function () {};
    freeQuantityChartRefresh = function () {};

    stage = document.querySelector("[data-free-price-chart]");
    if (!stage || !usesLinearDiscountPricing(product)) {
      return;
    }

    canvas = stage.querySelector("[data-free-price-chart-canvas]");
    tooltip = document.querySelector("[data-free-price-chart-tooltip]");
    currentLabel = stage.querySelector("[data-free-price-chart-current]");
    priceTable = activePriceTableForPackFilter(product);
    context = canvas && canvas.getContext ? canvas.getContext("2d") : null;

    if (!canvas || !tooltip || !priceTable || !context) {
      return;
    }

    function cssColor(name, fallback) {
      var value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return value || fallback;
    }

    function currentQuantity() {
      return getPackQuantity(product) || minimumFreeQuantity(product);
    }

    function prepareSeries(resetInspection) {
      var current = currentQuantity();
      chartMinimum = minimumFreeQuantity(product);
      chartMaximum = freePriceChartMaximum(product, priceTable, current);
      series = linearDiscountPriceSeries(priceTable, chartMaximum);
      if (resetInspection || !inspectedQuantity || inspectedQuantity < chartMinimum || inspectedQuantity > chartMaximum) {
        inspectedQuantity = current;
      }
      stage.setAttribute(
        "aria-label",
        "Gráfico do preço total entre " + chartMinimum + " e " + chartMaximum + " unidades. Usa as setas para consultar quantidades."
      );
    }

    function detailsFor(quantity) {
      var cents = series[quantity] || linearDiscountPriceCents(priceTable, quantity);
      var baseline = baselineUnitCents(priceTable);
      var discount = baseline && cents < baseline * quantity
        ? Math.round((1 - cents / (baseline * quantity)) * 100)
        : 0;

      return {
        total: formatCents(cents),
        each: formatUnitPrice(cents, quantity, productUnitShort(product)).replace(/\s*\/.*$/, ""),
        discount: discount
      };
    }

    function updateTooltip() {
      var details = detailsFor(inspectedQuantity);
      var isCurrent = inspectedQuantity === currentQuantity();

      tooltip.innerHTML = [
        '<strong>' + escapeHtml(productQuantityLabel(product, inspectedQuantity)) + (hasInteracted && isCurrent ? ' <em>A tua quantidade</em>' : '') + '</strong>',
        '<span><b>' + escapeHtml(details.each) + '</b> cada</span>',
        '<span><b>' + details.discount + '%</b> desconto</span>',
        '<span><b>' + escapeHtml(details.total) + '</b> total</span>'
      ].join("");
    }

    function draw() {
      var rect = canvas.getBoundingClientRect();
      var width = Math.max(280, Math.round(rect.width));
      var height = Math.max(230, Math.round(rect.height));
      var ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      var left = width < 430 ? 48 : 58;
      var right = 18;
      var top = 20;
      var bottom = 38;
      var graphWidth = Math.max(1, width - left - right);
      var graphHeight = Math.max(1, height - top - bottom);
      var values = [];
      var maximumCents;
      var yMaximum;
      var ink = cssColor("--ink", "#2e2413");
      var muted = cssColor("--muted", "#7f6b42");
      var line = cssColor("--line", "#dfcfaa");
      var moss = cssColor("--moss", "#72551e");
      var gold = cssColor("--gold", "#d7aa36");
      var quantity;
      var tick;
      var current = currentQuantity();

      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.font = (width < 430 ? "11px" : "12px") + " system-ui, -apple-system, sans-serif";
      context.lineCap = "round";
      context.lineJoin = "round";

      for (quantity = chartMinimum; quantity <= chartMaximum; quantity += 1) {
        values.push(series[quantity] || 0);
      }
      maximumCents = values.reduce(function (maximum, cents) { return Math.max(maximum, cents); }, 0);
      yMaximum = Math.max(100, Math.ceil(maximumCents * 1.08 / 100) * 100);

      function xFor(value) {
        return left + ((value - chartMinimum) / Math.max(1, chartMaximum - chartMinimum)) * graphWidth;
      }

      function yFor(cents) {
        return top + graphHeight - (cents / yMaximum) * graphHeight;
      }

      plot = { left: left, right: left + graphWidth, top: top, bottom: top + graphHeight, width: graphWidth };

      context.strokeStyle = line;
      context.fillStyle = muted;
      context.lineWidth = 1;
      for (tick = 0; tick <= 4; tick += 1) {
        var yValue = Math.round(yMaximum * tick / 4);
        var y = yFor(yValue);
        context.globalAlpha = tick === 0 ? 0.8 : 0.48;
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(left + graphWidth, y);
        context.stroke();
        context.globalAlpha = 1;
        context.textAlign = "right";
        context.textBaseline = "middle";
        context.fillText((yValue / 100).toLocaleString("pt-PT", { maximumFractionDigits: 0 }) + " €", left - 8, y);
      }

      context.textBaseline = "top";
      for (tick = 0; tick <= 4; tick += 1) {
        var xQuantity = Math.round(chartMinimum + (chartMaximum - chartMinimum) * tick / 4);
        var x = xFor(xQuantity);
        context.textAlign = tick === 0 ? "left" : (tick === 4 ? "right" : "center");
        context.fillStyle = muted;
        context.fillText(String(xQuantity), x, top + graphHeight + 10);
      }

      context.beginPath();
      for (quantity = chartMinimum; quantity <= chartMaximum; quantity += 1) {
        var pointX = xFor(quantity);
        var pointY = yFor(series[quantity] || 0);
        if (quantity === chartMinimum) {
          context.moveTo(pointX, pointY);
        } else {
          context.lineTo(pointX, pointY);
        }
      }
      context.strokeStyle = moss;
      context.lineWidth = 2.6;
      context.globalAlpha = 0.94;
      context.stroke();
      context.globalAlpha = 1;

      function drawMarker(value, fill, radius, hollow) {
        var markerX = xFor(value);
        var markerY = yFor(series[value] || 0);
        context.beginPath();
        context.arc(markerX, markerY, radius, 0, Math.PI * 2);
        context.fillStyle = hollow ? cssColor("--card", "#fffdf5") : fill;
        context.fill();
        context.strokeStyle = fill;
        context.lineWidth = hollow ? 2.5 : 2;
        context.stroke();
        return { x: markerX, y: markerY };
      }

      context.save();
      context.setLineDash([4, 5]);
      context.strokeStyle = gold;
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(xFor(current), top);
      context.lineTo(xFor(current), top + graphHeight);
      context.stroke();
      context.restore();

      var currentPoint = drawMarker(current, gold, 5, false);
      if (inspectedQuantity !== current) {
        drawMarker(inspectedQuantity, moss, 5, true);
      }

      if (currentLabel) {
        currentLabel.hidden = !(hasInteracted && inspectedQuantity === current);
        currentLabel.style.left = Math.max(72, Math.min(width - 72, currentPoint.x)) + "px";
        currentLabel.style.top = Math.max(2, Math.min(height - 32, currentPoint.y - 34)) + "px";
      }

      context.fillStyle = ink;
      updateTooltip();
    }

    function quantityFromPointer(event) {
      var rect = stage.getBoundingClientRect();
      var localX;
      var ratio;

      if (!plot || !rect.width) {
        return currentQuantity();
      }
      localX = Math.max(plot.left, Math.min(plot.right, event.clientX - rect.left));
      ratio = (localX - plot.left) / Math.max(1, plot.width);
      return Math.max(chartMinimum, Math.min(chartMaximum, Math.round(chartMinimum + ratio * (chartMaximum - chartMinimum))));
    }

    function handleClick(event) {
      inspectedQuantity = quantityFromPointer(event);
      hasInteracted = true;
      draw();
    }

    function handleKeydown(event) {
      var next = inspectedQuantity;

      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        next -= 1;
      } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        next += 1;
      } else if (event.key === "Home") {
        next = chartMinimum;
      } else if (event.key === "End") {
        next = chartMaximum;
      } else {
        return;
      }

      event.preventDefault();
      inspectedQuantity = Math.max(chartMinimum, Math.min(chartMaximum, next));
      hasInteracted = true;
      draw();
    }

    function handleResize() {
      window.requestAnimationFrame(draw);
    }

    prepareSeries(true);
    stage.addEventListener("click", handleClick);
    stage.addEventListener("keydown", handleKeydown);

    if (typeof window.ResizeObserver === "function") {
      observer = new window.ResizeObserver(handleResize);
      observer.observe(stage);
    } else {
      window.addEventListener("resize", handleResize);
    }

    freeQuantityChartRefresh = function () {
      hasInteracted = false;
      prepareSeries(true);
      draw();
    };
    freeQuantityChartCleanup = function () {
      stage.removeEventListener("click", handleClick);
      stage.removeEventListener("keydown", handleKeydown);
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener("resize", handleResize);
      }
      freeQuantityChartRefresh = function () {};
    };

    draw();
  }

  function renderFreeQuantityBuilder(product) {
    var minimum = minimumFreeQuantity(product);
    var rangeMaximum = freeQuantityRangeMaximum(product);
    var current = getPackQuantity(product) || minimum;
    var rangePosition = freeQuantityRangePosition(product, current);
    var rangeProgress = rangeMaximum > minimum
      ? ((rangePosition - minimum) / (rangeMaximum - minimum) * 100).toFixed(2)
      : "0";

    return [
      renderPackSelector(product),
      '<section class="free-quantity-builder" aria-label="Quantidade">',
      '<p class="free-quantity-mode-label"><span>Ou define outra quantidade</span></p>',
      '<div class="free-quantity-readout"><strong data-free-quantity-value>' + current + '</strong><small data-free-quantity-unit>' + escapeHtml(current === 1 ? productUnitSingular(product) : productUnit(product)) + '</small></div>',
      '<div class="free-quantity-control">',
      '<button type="button" data-free-quantity-change="-1" aria-label="Retirar uma unidade"' + (current <= minimum ? ' disabled' : '') + '>−</button>',
      '<label class="free-quantity-slider"><span>Quantidade: ' + current + '</span><input type="range" min="' + minimum + '" max="' + rangeMaximum + '" step="1" value="' + rangePosition + '" style="--range-progress:' + rangeProgress + '%" data-free-quantity-range aria-valuetext="' + escapeHtml(productQuantityLabel(product, current)) + '"></label>',
      '<button type="button" data-free-quantity-change="1" aria-label="Acrescentar uma unidade"' + (current >= rangeMaximum ? ' disabled' : '') + '>+</button>',
      '</div>',
      '</section>',
      renderPackPriceOverview(product),
      renderFreeQuantityPriceChart(product)
    ].join("");
  }

  function setFreeQuantity(product, value, mode, trackSelection) {
    var minimum = minimumFreeQuantity(product);
    var maximum = maximumFreeQuantity(product);
    var quantity = Math.round(Number(value) || 0);

    quantity = Math.max(minimum, Math.min(maximum, quantity || minimum));
    state.selections.pack_quantity = quantity;
    state.selections.free_quantity_mode = mode === "pack"
      ? "pack"
      : freeQuantityModeForValue(product, quantity);
    state.quantitySignature = "";
    state.quantitiesTouched = false;
    state.quantityPackBaseline = 0;
    state.errors = "";
    if (trackSelection !== false) {
      try { trackOptionSelected(product, "quantity", quantity, productQuantityLabel(product, quantity)); } catch (e) {}
    }
    return quantity;
  }

  function refreshFreeQuantityDraft(product, input) {
    var builder = input && input.closest ? input.closest(".free-quantity-builder") : null;
    var overview = builder && builder.nextElementSibling && builder.nextElementSibling.matches(".pack-price-overview")
      ? builder.nextElementSibling
      : null;
    var wrapper;
    var nextOverview;
    var quantity = getPackQuantity(product);
    var minimum = minimumFreeQuantity(product);
    var rangeMaximum = freeQuantityRangeMaximum(product);
    var minus = builder ? builder.querySelector('[data-free-quantity-change="-1"]') : null;
    var plus = builder ? builder.querySelector('[data-free-quantity-change="1"]') : null;
    var range = builder ? builder.querySelector("[data-free-quantity-range]") : null;
    var rangeLabel = builder ? builder.querySelector(".free-quantity-slider > span") : null;
    var value = builder ? builder.querySelector("[data-free-quantity-value]") : null;
    var unit = builder ? builder.querySelector("[data-free-quantity-unit]") : null;
    var packControl = builder && builder.previousElementSibling && builder.previousElementSibling.matches(".pack-control")
      ? builder.previousElementSibling
      : null;

    if (minus) {
      minus.disabled = !quantity || quantity <= minimum;
    }
    if (plus) {
      plus.disabled = !quantity || quantity >= rangeMaximum;
    }
    if (value) {
      value.textContent = quantity || minimum;
    }
    if (unit) {
      unit.textContent = (quantity || minimum) === 1 ? productUnitSingular(product) : productUnit(product);
    }
    if (rangeLabel) {
      rangeLabel.textContent = "Quantidade: " + (quantity || minimum);
    }
    if (range && quantity) {
      var rangePosition = freeQuantityRangePosition(product, quantity);
      range.value = rangePosition;
      range.style.setProperty("--range-progress", (rangeMaximum > minimum
        ? ((rangePosition - minimum) / (rangeMaximum - minimum) * 100).toFixed(2)
        : "0") + "%");
      range.setAttribute("aria-valuetext", productQuantityLabel(product, quantity));
    }
    if (packControl) {
      packControl.querySelectorAll(".pack-option").forEach(function (button) {
        var selected = freeQuantitySelectionMode(product) === "pack"
          && Number(button.dataset.packQuantity) === quantity;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
      });
    }

    wrapper = document.createElement("div");
    wrapper.innerHTML = renderPackPriceOverview(product);
    nextOverview = wrapper.firstElementChild;

    if (overview && nextOverview) {
      overview.replaceWith(nextOverview);
    } else if (overview) {
      overview.remove();
    } else if (builder && nextOverview) {
      builder.insertAdjacentElement("afterend", nextOverview);
    }

    freeQuantityChartRefresh();
  }

  function renderQuantityBuilder(product) {
    var items = selectedDesignItems(product);
    var packStep = findStep(product, "pack");
    var adjustHint = packStep && packStep.adjustHint ? packStep.adjustHint : "";
    var packQuantity;
    var total;
    var unassigned;
    var cards = "";

    if (packStep && packStep.freeQuantity === true) {
      return renderFreeQuantityBuilder(product);
    }

    ensurePackAndQuantities(product);

    if (isAssortedSelected(product)) {
      return [
        renderPackSelector(product),
        renderPackPriceOverview(product)
      ].join("");
    }

    if (!items.length) {
      return '<p class="empty-state">Volta atrás e escolhe pelo menos um design.</p>';
    }

    packQuantity = getPackQuantity(product);
    total = quantityTotal(product);
    unassigned = unassignedCount(product);

    items.forEach(function (item) {
      var quantity = quantityFor(item.value);
      var controls = "";

      if (items.length > 1) {
        controls = [
          '<div class="quantity-controls">',
          '<button type="button" data-quantity-minus="' + escapeHtml(item.value) + '"' + (!canAdjustQuantity(product, item.value, -1) ? " disabled" : "") + '>−</button>',
          '<span>' + quantity + '</span>',
          '<button type="button" data-quantity-plus="' + escapeHtml(item.value) + '"' + (!canAdjustQuantity(product, item.value, 1) ? " disabled" : "") + '>+</button>',
          '</div>'
        ].join("");
      }

      cards += [
        '<article class="quantity-card" data-quantity-card="' + escapeHtml(item.value) + '">',
        '<div class="quantity-hero">',
        '<div class="quantity-visual-wrap">',
        renderVisual(item, "design-grid", findStep(product, "designs")),
        '<span class="quantity-badge">x' + quantity + '</span>',
        '</div>',
        '</div>',
        '<div class="quantity-main">',
        '<div>',
        '<strong>' + escapeHtml(displayItemTitle(item)) + '</strong>',
        '<span>' + escapeHtml(item.subtitle) + '</span>',
        '</div>',
        renderPinStack(item, quantity, findStep(product, "designs")),
        controls,
        '</div>',
        '</article>'
      ].join("");
    });

    return [
      renderPackSelector(product),
      renderPackPriceOverview(product),
      items.length > 1 && adjustHint ? '<p class="quantity-adjust-hint">' + escapeHtml(adjustHint) + '</p>' : "",
      '<div class="quantity-grid">',
      cards,
      '</div>',
      renderQuantityStatus(product),
      renderUnassignedPins(product),
      items.length >= 3 ? '<button class="auto-distribute" type="button" data-auto-distribute>Distribuir por igual</button>' : ""
    ].join("");
  }

  function renderSelectedSummary(product) {
    var items = selectedDesignItems(product);
    var quantities = state.selections.design_quantities || {};
    var html = "";

    if (!items.length) {
      return "";
    }

    items.forEach(function (item) {
      html += [
        '<span class="selected-pill">',
        renderVisual(item, "design-grid", findStep(product, "designs")),
        '<span>' + escapeHtml(displayItemTitle(item)) + '</span>',
        quantities[item.value] ? '<strong>x' + escapeHtml(quantities[item.value]) + '</strong>' : "",
        '</span>'
      ].join("");
    });

    return '<div class="selected-summary">' + html + '</div>';
  }

  // CRACHAS_STEP2_SIZE_LAYOUT_V2
  // Layout dedicado ao passo 2 dos crachas (escolha de tamanho).
  // Agora os cartões mostram apenas: visual do tamanho | texto | check de
  // seleccionado. A foto de comparação aparece grande por baixo, apenas
  // quando esse tamanho está seleccionado.
  function renderCrachasSidePhoto(item, step) {
    var hasSide = isUploadedSideImage(item);
    var active;
    var adminAttrs;
    var frameInfo;

    if (!hasSide) {
      return "";
    }

    active = !!(state.admin && step && state.adminActiveImage && state.adminActiveImage.side && state.adminActiveImage.stepId === step.id && state.adminActiveImage.itemId === item.id);
    adminAttrs = state.admin && step
      ? ' data-admin-side-image-visual data-admin-image-step="' + escapeHtml(step.id) + '" data-admin-image-item="' + escapeHtml(item.id) + '" tabindex="0" role="button" title="Selecionar foto de comparação para ajustar com o teclado"'
      : ' aria-hidden="true"';
    frameInfo = uploadedSideProofInfo(item, step);

    return [
      '<span class="crachas-size-card-proof crachas-size-card-proof--wide">',
      '<span class="crachas-size-card-proof-media">',
      '<span class="crachas-size-card-proof-note">Exemplo do tamanho</span>',
      '<span class="crachas-size-card-proof-frame uploaded-image' + (active ? ' is-admin-image-active' : '') + '" style="' + frameInfo.style + '"' + adminAttrs + miaSlotDebugFrameAttrs(frameInfo.debug) + '>',
      '<img class="crachas-size-card-proof-img" src="' + escapeHtml(item.sideImage) + '" alt="Exemplo do tamanho escolhido em comparação com uma moeda de 50 cêntimos">',
      '</span>',
      '</span>',
      '</span>'
    ].join("");
  }

  function renderCrachasSelectedDesigns(product) {
    var items = selectedDesignItems(product);
    var designsStep;
    var tilesHtml;

    if (isAssortedSelected(product)) {
      return renderAssortedSelectedSummary();
    }

    if (!items.length) {
      return "";
    }

    designsStep = findStep(product, "designs");
    tilesHtml = items.map(function (item) {
      return [
        '<article class="crachas-step2-summary-tile">',
        renderVisual(item, "design-grid", designsStep),
        '<span class="crachas-step2-summary-tile-name">' + escapeHtml(displayItemTitle(item)) + '</span>',
        '</article>'
      ].join("");
    }).join("");

    return [
      '<section class="crachas-step2-summary" aria-label="Designs escolhidos">',
      '<h3 class="crachas-step2-summary-title">Designs que vais encomendar:</h3>',
      '<div class="crachas-step2-summary-grid">' + tilesHtml + '</div>',
      '</section>'
    ].join("");
  }

  function renderCrachasSizeStep(product, step) {
    var selected = selectedValues(step);
    var html = "";

    (step.items || []).forEach(function (item) {
      var checked = selected.indexOf(item.value) !== -1 ? " checked" : "";
      var selectedClass = checked ? " is-selected" : "";
      var muted = selected.length && !checked ? " is-muted" : "";

      html += [
        '<div class="crachas-size-choice">',
        '<label class="choice-card crachas-size-card' + selectedClass + muted + '">',
        '<input type="radio" name="' + escapeHtml(step.field) + '" value="' + escapeHtml(item.value) + '" data-choice-step="' + escapeHtml(step.id) + '"' + checked + '>',
        '<span class="crachas-size-card-visual">' + renderVisual(item, "media-list", step) + '</span>',
        '<span class="choice-copy crachas-size-card-text">',
        '<strong>' + escapeHtml(item.title) + '</strong>',
        '<span>' + escapeHtml(item.subtitle || "") + '</span>',
        item.note ? '<span class="choice-note">' + escapeHtml(item.note) + '</span>' : "",
        '</span>',
        '<span class="crachas-size-card-selected" aria-hidden="true">✓</span>',
        adminItemControls(step, item),
        '</label>',
        checked ? renderCrachasSidePhoto(item, step) : "",
        '</div>'
      ].join("");
    });

    return [
      '<div class="option-list size-choice-list crachas-size-card-list">' + html + '</div>',
      state.admin ? '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar opção</button>' : "",
      renderCrachasSelectedDesigns(product)
    ].join("");
  }

