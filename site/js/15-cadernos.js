// js/15-cadernos.js — parte 15/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: fluxo dos cadernos: proof photo, chaves legacy de edicao, pre-visualizacoes de compra, imagens interiores, setAdminItemImage, captura de estado de render, opcoes de compra, texto do build.
  function renderCadernosProofPhoto(item, label) {
    var image = item && (item.exampleImage || item.image);

    if (!image) {
      return "";
    }

    return [
      '<span class="crachas-size-card-proof cadernos-proof cadernos-proof--adaptive">',
      '<span class="crachas-size-card-proof-media">',
      '<span class="crachas-size-card-proof-note">' + escapeHtml(label || "Exemplo") + '</span>',
      '<span class="crachas-size-card-proof-frame uploaded-image" style="--image-zoom-scale:1;--image-position-x:0%;--image-position-y:0%;--image-rotation:0deg">',
      '<img class="crachas-size-card-proof-img" src="' + escapeHtml(image) + '" alt="' + escapeHtml(label || item.title || "Exemplo") + '">',
      '</span>',
      '</span>',
      '</span>'
    ].join("");
  }

  function cadernoLaminationKey(item) {
    var value = String(item && (item.laminationKey || item.value) || "");

    if (value === "normal") {
      return "glossy";
    }

    if (value === "glitter_branco") {
      return "glitter";
    }

    if (value === "holografica") {
      return "holografico";
    }

    return value;
  }

  function cadernoLaminationImage(product, item) {
    var cover = selectedCadernoCover(product);
    var images = cover && cover.laminationImages ? cover.laminationImages : {};
    var key = cadernoLaminationKey(item);

    return images[key] || (key === "matte" && cover && cover.image) || images.matte
      || (cover && cover.image) || (item && (item.exampleImage || item.image)) || "";
  }

  function cadernoSlotCoverId(cover) {
    return String((cover && (cover.id || cover.value)) || "unknown-cover");
  }

  function cadernoScopedImageEditKey(product, collection, cover, itemSlotId, slotName) {
    return [
      (product && product.slug) || "cadernos",
      collection || "unknown",
      cadernoSlotCoverId(cover),
      itemSlotId || "unknown",
      slotName || "main"
    ].join(":");
  }

  function cadernoLegacyImageEditKey(product, collection, itemId, slotName) {
    return buildImageEditKey((product && product.slug) || "cadernos", collection, itemId, slotName || "main");
  }

  function cadernoPurchaseImageGroup(item) {
    return item && item.isPack ? "pack" : "caderno";
  }

  function cadernoPurchaseGroupStoreItem(product, item) {
    var step = findStep(product, "pack");
    var group = cadernoPurchaseImageGroup(item);
    var found = null;

    if (!step || !Array.isArray(step.items)) {
      return item;
    }

    step.items.some(function (candidate) {
      if (cadernoPurchaseImageGroup(candidate) === group) {
        found = candidate;
        return true;
      }
      return false;
    });

    return found || item;
  }

  function copyImageEditSlot(source) {
    var copy = {};

    if (!source || typeof source !== "object") {
      return null;
    }

    Object.keys(source).forEach(function (key) {
      copy[key] = source[key];
    });
    return copy;
  }

  function ensureImageEditSlotCopied(item, targetKey, sourceSlot) {
    var copy;

    if (!item || !targetKey || !sourceSlot) {
      return;
    }
    if (!item.imageEdits || typeof item.imageEdits !== "object") {
      item.imageEdits = {};
    }
    if (item.imageEdits[targetKey]) {
      return;
    }
    copy = copyImageEditSlot(sourceSlot);
    if (copy) {
      item.imageEdits[targetKey] = copy;
    }
  }

  function cadernoSummaryImageEditDefaults() {
    return {
      frameScale: 100,
      frameWidth: 120,
      frameHeight: 147,
      frameMarginX: 0,
      frameMarginY: 0,
      zoom: 106,
      positionX: -1,
      positionY: 13,
      rotation: -7
    };
  }

  function ensureCadernoScopedImageSlots(product) {
    var designsStep;
    var laminationStep;
    var packStep;
    var covers;

    if (!isCadernosProduct(product)) {
      return;
    }

    designsStep = findStep(product, "designs");
    laminationStep = findStep(product, "lamination");
    packStep = findStep(product, "pack");
    covers = designsStep && Array.isArray(designsStep.items) ? designsStep.items : [];

    if (laminationStep && Array.isArray(laminationStep.items)) {
      laminationStep.items.forEach(function (item) {
        var legacyKey = cadernoLegacyImageEditKey(product, "lamination", item.id, "main");
        var legacySlot = item && item.imageEdits ? item.imageEdits[legacyKey] : null;

        covers.forEach(function (cover) {
          ensureImageEditSlotCopied(
            item,
            cadernoScopedImageEditKey(product, "lamination", cover, item.id, "main"),
            legacySlot
          );
          ensureImageEditSlotCopied(
            item,
            cadernoScopedImageEditKey(product, "lamination", cover, item.id, "summary"),
            cadernoSummaryImageEditDefaults()
          );
        });
      });
    }

    if (packStep && Array.isArray(packStep.items)) {
      packStep.items.forEach(function (item) {
        var group = cadernoPurchaseImageGroup(item);
        var groupStore = cadernoPurchaseGroupStoreItem(product, item);
        var ownLegacyKey = cadernoLegacyImageEditKey(product, "pack", item.id, "main");
        var ownLegacySlot = item.imageEdits && item.imageEdits[ownLegacyKey];

        covers.forEach(function (cover) {
          var groupMainKey = cadernoScopedImageEditKey(product, "pack", cover, group, "main");
          var groupSummaryKey = cadernoScopedImageEditKey(product, "pack", cover, group, "summary");
          var groupMainSlot = groupStore && groupStore.imageEdits && groupStore.imageEdits[groupMainKey];
          var groupSummarySlot = groupStore && groupStore.imageEdits && groupStore.imageEdits[groupSummaryKey];

          // As quatro opções são quatro locais visuais. Copiamos os ajustes
          // antigos partilhados por grupo, mas daqui em diante cada item tem
          // as suas próprias chaves main/summary.
          ensureImageEditSlotCopied(
            item,
            cadernoScopedImageEditKey(product, "pack", cover, item.id, "main"),
            ownLegacySlot || groupMainSlot
          );
          ensureImageEditSlotCopied(
            item,
            cadernoScopedImageEditKey(product, "pack", cover, item.id, "summary"),
            groupSummarySlot || cadernoSummaryImageEditDefaults()
          );
        });
      });
    }
  }

  function cadernoPreviewOwnSetting(item, key, fallback) {
    return item && item[key] != null ? item[key] : fallback;
  }

  function cadernoLaminationPreviewItem(product, item) {
    var cover = selectedCadernoCover(product) || {};
    var image = cadernoLaminationImage(product, item);
    var editKey = cadernoScopedImageEditKey(product, "lamination", cover, item.id, "main");
    var fallbackKey = cadernoLegacyImageEditKey(product, "lamination", item.id, "main");

    return {
      id: item.id,
      value: item.value,
      title: item.title,
      subtitle: item.subtitle,
      visual: item.visual,
      badge: item.badge,
      image: image,
      exampleImage: image,
      imageFit: item.imageFit || cover.imageFit || "cover",
      imageEdits: item.imageEdits,
      _imageEditKey: editKey,
      _imageEditFallbackKey: fallbackKey,
      frameWidth: cadernoPreviewOwnSetting(item, "frameWidth", 70),
      frameHeight: cadernoPreviewOwnSetting(item, "frameHeight", 124),
      frameScale: cadernoPreviewOwnSetting(item, "frameScale"),
      frameMarginX: cadernoPreviewOwnSetting(item, "frameMarginX"),
      frameMarginY: cadernoPreviewOwnSetting(item, "frameMarginY"),
      imageZoom: cadernoPreviewOwnSetting(item, "imageZoom"),
      imagePositionX: cadernoPreviewOwnSetting(item, "imagePositionX"),
      imagePositionY: cadernoPreviewOwnSetting(item, "imagePositionY"),
      imageRotation: cadernoPreviewOwnSetting(item, "imageRotation")
    };
  }

  function cadernoPurchaseOptionImage(product, item) {
    var cover = selectedCadernoCover(product);
    var images = cover && cover.purchaseOptionImages ? cover.purchaseOptionImages : {};

    return images[item && item.value] || (item && (item.exampleImage || item.image)) || "";
  }

  function cadernoPurchasePreviewItem(product, item) {
    var cover = selectedCadernoCover(product) || {};
    var image = cadernoPurchaseOptionImage(product, item);
    var editKey = cadernoScopedImageEditKey(product, "pack", cover, item.id, "main");
    var fallbackKey = cadernoLegacyImageEditKey(product, "pack", item.id, "main");

    return {
      id: item.id,
      value: item.value,
      title: item.title,
      subtitle: item.subtitle,
      visual: item.visual,
      badge: item.badge,
      image: image,
      exampleImage: image,
      imageFit: item.imageFit || cover.imageFit || "cover",
      imageEdits: item.imageEdits,
      _imageEditKey: editKey,
      _imageEditFallbackKey: fallbackKey,
      _imageEditStoreItemId: item.id,
      frameWidth: cadernoPreviewOwnSetting(item, "frameWidth", 86),
      frameHeight: cadernoPreviewOwnSetting(item, "frameHeight", 64),
      frameScale: cadernoPreviewOwnSetting(item, "frameScale"),
      frameMarginX: cadernoPreviewOwnSetting(item, "frameMarginX"),
      frameMarginY: cadernoPreviewOwnSetting(item, "frameMarginY"),
      imageZoom: cadernoPreviewOwnSetting(item, "imageZoom"),
      imagePositionX: cadernoPreviewOwnSetting(item, "imagePositionX"),
      imagePositionY: cadernoPreviewOwnSetting(item, "imagePositionY"),
      imageRotation: cadernoPreviewOwnSetting(item, "imageRotation")
    };
  }

  function cadernoSummaryCoverPreviewItem(product, cover) {
    if (!cover) {
      return null;
    }

    return imageSlotProxyItem(
      cover,
      cadernoScopedImageEditKey(product, "designs", cover, cover.id, "summary"),
      cadernoLegacyImageEditKey(product, "designs", cover.id, "main"),
      cover
    );
  }

  function cadernoSummaryLaminationPreviewItem(product, item) {
    var cover = selectedCadernoCover(product) || {};
    var preview = cadernoLaminationPreviewItem(product, item);

    preview._imageEditFallbackKey = preview._imageEditKey;
    preview._imageEditKey = cadernoScopedImageEditKey(product, "lamination", cover, item.id, "summary");
    return preview;
  }

  function cadernoSummaryPurchasePreviewItem(product, item) {
    var cover = selectedCadernoCover(product) || {};
    var preview = cadernoPurchasePreviewItem(product, item);

    preview._imageEditFallbackKey = preview._imageEditKey;
    preview._imageEditKey = cadernoScopedImageEditKey(product, "pack", cover, item.id, "summary");
    return preview;
  }

  function cadernoPreviewSpeedSeconds(product) {
    var settings = product && product.interiorPreview ? product.interiorPreview : {};

    return Math.max(2, Math.min(20, Number(settings.speedSeconds) || 4));
  }

  function cadernoCommonInteriorImages(product) {
    var settings = product && product.interiorPreview ? product.interiorPreview : {};

    return Array.isArray(settings.images) ? settings.images.filter(Boolean) : [];
  }

  function cadernoItemInteriorImages(product, item) {
    var settings = product && product.interiorPreview ? product.interiorPreview : {};
    var explicit = item && Array.isArray(item.interiorImages) ? item.interiorImages.filter(Boolean) : [];
    var folder = String(item && item.interiorFolder || "").replace(/\/+$/, "");
    var fileNames = Array.isArray(settings.drawerImageNames) ? settings.drawerImageNames.filter(Boolean) : [];

    if (explicit.length) {
      return explicit;
    }

    if (folder && fileNames.length) {
      return fileNames.map(function (fileName) {
        return folder + "/" + String(fileName).replace(/^\/+/, "");
      });
    }

    return cadernoCommonInteriorImages(product);
  }

  function cadernoPreviewLabel(image, isCover) {
    if (isCover) {
      return "Capa estilo matte";
    }

    return String(image || "").indexOf("-PR") !== -1 ? "Exclusivo Pioneiros" : "Interior";
  }

  function cadernoCoverImage(item) {
    if (item && item.image) {
      return item.image;
    }

    if (item && item.laminationImages && item.laminationImages.matte) {
      return item.laminationImages.matte;
    }

    return "";
  }

  function updateCadernoCoverImageReferences(item, previousImage, nextImage) {
    if (!item || !nextImage) {
      return;
    }

    if (item.laminationImages && typeof item.laminationImages === "object" && item.laminationImages.matte === previousImage) {
      item.laminationImages.matte = nextImage;
    }

    if (Array.isArray(item.interiorImages)) {
      item.interiorImages = item.interiorImages.map(function (image) {
        return image === previousImage ? nextImage : image;
      });
    }
  }

  function setAdminItemImage(product, step, item, image) {
    var previousImage = item && item.image ? item.image : "";

    if (!item) {
      return;
    }

    item.image = image;
    if (isCadernosProduct(product) && step && step.id === "designs") {
      updateCadernoCoverImageReferences(item, previousImage, image);
    }
  }

  function cadernoCoverPreviewFrames(product, item) {
    var frames = [];
    var cover = cadernoCoverImage(item);
    var interior = cadernoItemInteriorImages(product, item);

    if (cover) {
      frames.push({ image: cover, label: cadernoPreviewLabel(cover, true) });
    }

    interior.forEach(function (image) {
      var exists = frames.filter(function (frame) {
        return frame.image === image;
      }).length > 0;

      if (image && !exists) {
        frames.push({ image: image, label: cadernoPreviewLabel(image, false) });
      }
    });

    return frames;
  }

  function clearCadernoPreviewTimers() {
    cadernoPreviewTimers.forEach(function (timer) {
      window.clearInterval(timer);
    });
    cadernoPreviewTimers = [];
  }

  function activateCadernoPreviewFrame(frame, index) {
    var slides = frame.querySelectorAll(".cadernos-cover-preview-slide");
    var labels = frame.querySelectorAll(".cadernos-preview-pill-label");
    var count = slides.length;
    var next = count ? ((index % count) + count) % count : 0;

    slides.forEach(function (slide, slideIndex) {
      slide.classList.toggle("is-active", slideIndex === next);
    });
    labels.forEach(function (label, labelIndex) {
      label.classList.toggle("is-active", labelIndex === next);
    });
    frame.dataset.cadernosPreviewCurrent = String(next);
  }

  function cadernoPreviewIntervalMs(frame) {
    return Math.max(1000, Number(frame.dataset.cadernosPreviewInterval) || 4000);
  }

  function cadernoPreviewCurrentIndex(frame) {
    return Math.max(0, Number(frame.dataset.cadernosPreviewCurrent) || 0);
  }

  function scheduleCadernoPreviewTimer(frame) {
    var slides = frame.querySelectorAll(".cadernos-cover-preview-slide");
    var timer;

    if (slides.length < 2) {
      return;
    }

    timer = window.setInterval(function () {
      activateCadernoPreviewFrame(frame, cadernoPreviewCurrentIndex(frame) + 1);
    }, cadernoPreviewIntervalMs(frame));
    frame._cadernoPreviewTimer = timer;
    cadernoPreviewTimers.push(timer);
  }

  function restartCadernoPreviewTimer(frame) {
    if (frame._cadernoPreviewTimer) {
      window.clearInterval(frame._cadernoPreviewTimer);
    }
    scheduleCadernoPreviewTimer(frame);
  }

  function stepCadernoPreviewFrame(frame, delta, manual) {
    activateCadernoPreviewFrame(frame, cadernoPreviewCurrentIndex(frame) + delta);
    if (manual) {
      restartCadernoPreviewTimer(frame);
    }
  }

  function initCadernoPreviewSlides() {
    clearCadernoPreviewTimers();
    document.querySelectorAll("[data-cadernos-preview]").forEach(function (frame) {
      var slides = frame.querySelectorAll(".cadernos-cover-preview-slide");
      var startX = 0;
      var startY = 0;
      var trackingSwipe = false;

      if (!slides.length) {
        return;
      }

      activateCadernoPreviewFrame(frame, 0);
      scheduleCadernoPreviewTimer(frame);

      frame.querySelectorAll("[data-cadernos-preview-step]").forEach(function (button) {
        button.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          stepCadernoPreviewFrame(frame, Number(button.dataset.cadernosPreviewStep) || 1, true);
        });
      });

      frame.addEventListener("pointerdown", function (event) {
        if (event.pointerType === "mouse" && event.button !== 0) {
          return;
        }
        startX = event.clientX;
        startY = event.clientY;
        trackingSwipe = true;
      });

      frame.addEventListener("pointerup", function (event) {
        var dx;
        var dy;

        if (!trackingSwipe) {
          return;
        }
        trackingSwipe = false;
        dx = event.clientX - startX;
        dy = event.clientY - startY;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.35) {
          stepCadernoPreviewFrame(frame, dx < 0 ? 1 : -1, true);
        }
      });
    });
  }

  function captureCadernoRenderState(product) {
    var frame;

    if (!isCadernosProduct(product)) {
      return null;
    }

    frame = document.querySelector("[data-cadernos-preview]");
    return {
      coverValue: frame ? (frame.dataset.cadernosPreviewCoverValue || "") : "",
      coverItemId: frame ? (frame.dataset.cadernosPreviewItemId || "") : "",
      previewIndex: frame ? cadernoPreviewCurrentIndex(frame) : 0
    };
  }

  function restoreCadernoRenderState(product, renderState) {
    var frame;

    if (!renderState || !isCadernosProduct(product)) {
      return;
    }

    frame = document.querySelector("[data-cadernos-preview]");
    if (
      frame
      && renderState.coverValue === (frame.dataset.cadernosPreviewCoverValue || "")
      && renderState.coverItemId === (frame.dataset.cadernosPreviewItemId || "")
    ) {
      activateCadernoPreviewFrame(frame, renderState.previewIndex || 0);
    }
  }

  function stepItemById(step, itemId) {
    return step && Array.isArray(step.items)
      ? step.items.filter(function (candidate) {
        return candidate && candidate.id === itemId;
      })[0] || null
      : null;
  }

  function renderCadernoCoverDrawer(product, item) {
    var frames = cadernoCoverPreviewFrames(product, item);
    var speed = cadernoPreviewSpeedSeconds(product);

    if (!frames.length) {
      return "";
    }

    return [
      '<div class="cadernos-cover-drawer">',
      '<div class="cadernos-cover-preview-frame" data-cadernos-preview data-cadernos-preview-cover-value="' + escapeHtml(item.value || "") + '" data-cadernos-preview-item-id="' + escapeHtml(item.id || "") + '" data-cadernos-preview-interval="' + (speed * 1000) + '">',
      frames.map(function (frame, index) {
        return '<span class="cadernos-cover-preview-slide' + (index === 0 ? ' is-active' : '')
          + '" data-mia-image="' + escapeHtml(frame.image) + '" data-mia-item-id="' + escapeHtml(item.id || "")
          + '" data-mia-slot-name="drawer" data-mia-slide-index="' + index
          + '" style="background-image:url(&quot;' + escapeHtml(frame.image) + '&quot;)"></span>';
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

  function quadroDesignPreviewFrames(item) {
    var images = [];
    var candidates = [item && item.image].concat(item && Array.isArray(item.drawerImages) ? item.drawerImages : []);

    candidates.forEach(function (image) {
      if (image && images.indexOf(image) === -1) {
        images.push(image);
      }
    });

    return images.map(function (image, index) {
      return {
        image: image,
        label: "Exemplo " + (index + 1) + " de " + images.length
      };
    });
  }

  function renderQuadroDesignDrawer(product, item) {
    var frames = quadroDesignPreviewFrames(item);
    var speed = cadernoPreviewSpeedSeconds(product);

    if (!frames.length) {
      return "";
    }

    return [
      '<div class="cadernos-cover-drawer quadros-design-drawer">',
      '<div class="cadernos-cover-preview-frame quadros-design-preview-frame" data-cadernos-preview data-cadernos-preview-cover-value="' + escapeHtml(item.value || "") + '" data-cadernos-preview-item-id="' + escapeHtml(item.id || "") + '" data-cadernos-preview-interval="' + (speed * 1000) + '">',
      frames.map(function (frame, index) {
        return '<span class="cadernos-cover-preview-slide quadros-design-preview-slide' + (index === 0 ? ' is-active' : '')
          + '" data-mia-image="' + escapeHtml(frame.image) + '" data-mia-item-id="' + escapeHtml(item.id || "")
          + '" data-mia-slot-name="drawer" data-mia-slide-index="' + index
          + '" style="background-image:url(&quot;' + escapeHtml(frame.image) + '&quot;)"></span>';
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

  function quadroDesignCardPrice(item) {
    var fixed = Math.max(0, Number(item && item.priceCents) || 0);
    var minimum = Math.max(0, Number(item && item.priceMinCents) || 0);

    if (fixed) {
      return formatCents(fixed);
    }
    if (minimum) {
      return "Desde " + formatCents(minimum);
    }
    return "";
  }

  function renderQuadrosDesignStep(product, step) {
    var selected = selectedValues(step);
    var html = (step.items || []).map(function (item) {
      var checked = selected.indexOf(item.value) !== -1 ? " checked" : "";
      var frameSize = String(item.frameSize || "Tamanho à escolha");
      var price = quadroDesignCardPrice(item);
      // A coluna da imagem tem de ter largura determinada: as regras globais de
      // .design-image usam percentagens, que numa coluna "auto" seriam circulares.
      var frameColWidth = Math.max(1, parseInt(item.frameWidth, 10) || 96);

      return [
        '<div class="quadros-design-choice">',
        '<label class="choice-card design-grid" style="--frame-col-width:' + frameColWidth + 'px">',
        '<input type="radio" name="' + escapeHtml(step.field) + '" value="' + escapeHtml(item.value) + '" data-choice-step="' + escapeHtml(step.id) + '"' + checked + '>',
        renderDesignCardMedia(product, step, item),
        '<span class="choice-copy">',
        '<strong>' + escapeHtml(item.title || item.value) + '</strong>',
        '<span>' + escapeHtml(item.subtitle || "") + '</span>',
        '</span>',
        // O tamanho e celula propria da grelha (nao vai dentro de .choice-copy) para
        // poder ficar debaixo da imagem em ecras estreitos, onde ha espaco livre.
        '<span class="choice-note quadros-design-size">' + escapeHtml(frameSize) + '</span>',
        price ? '<span class="quadros-design-price">' + escapeHtml(price) + '</span>' : "",
        adminItemControls(step, item),
        '</label>',
        checked ? renderQuadroDesignDrawer(product, item) : "",
        '</div>'
      ].join("");
    }).join("");

    return renderDesignActionControls(product, step)
      + '<div class="design-grid" data-choice-grid-step="' + escapeHtml(step.id) + '">' + html + '</div>'
      + (state.admin ? '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar opção</button>' : "");
  }

  function renderCadernosCoverStep(product, step) {
    var selected = selectedValues(step);
    var config = getStepSectionConfig(product, step);
    var sections = config ? ensureStepSections(step, config.defaults) : [];
    var grouped = config ? groupItemsBySection(step.items, sections) : null;
    var html = "";

    function renderCoverChoice(item) {
      var checked = selected.indexOf(item.value) !== -1 ? " checked" : "";
      var selectedClass = checked ? " is-selected" : "";
      var muted = selected.length && !checked ? " is-muted" : "";

      return [
        '<div class="cadernos-cover-choice">',
        '<label class="choice-card crachas-size-card cadernos-cover-card' + selectedClass + muted + '">',
        '<input type="radio" name="' + escapeHtml(step.field) + '" value="' + escapeHtml(item.value) + '" data-choice-step="' + escapeHtml(step.id) + '"' + checked + '>',
        renderCadernoCoverCardMedia(product, step, item),
        '<span class="choice-copy crachas-size-card-text">',
        '<strong>' + escapeHtml(displayItemTitle(item)) + '</strong>',
        '<span>' + escapeHtml(item.subtitle || "") + '</span>',
        item.note ? '<span class="choice-note">' + escapeHtml(item.note) + '</span>' : "",
        '</span>',
        '<span class="crachas-size-card-selected" aria-hidden="true">✓</span>',
        adminItemControls(step, item),
        '</label>',
        checked ? renderCadernoCoverDrawer(product, item) : "",
        '</div>'
      ].join("");
    }

    if (config && config.mode === "mixed") {
      sections.forEach(function (section) {
        var bucket = grouped[section.id] || [];
        var defaultSection = (config.defaults || []).filter(function (entry) {
          return entry.id === section.id;
        })[0] || {};
        var isVisibleSection = defaultSection.visible !== false;
        var rowsHtml = bucket.map(function (entry) { return renderCoverChoice(entry.item); }).join("");

        if (bucket.length === 0 && !state.admin) {
          return;
        }

        if (isVisibleSection) {
          html += [
            '<section class="design-grid-section' + (bucket.length === 0 ? ' is-empty' : '') + '" data-section-id="' + escapeHtml(section.id) + '">',
            '<h3 class="design-grid-section-title">' + escapeHtml(section.title) + '</h3>',
            bucket.length === 0 && state.admin ? '<p class="design-grid-section-empty">Sem itens atribuídos. Atribui um item a este separador para que apareça no site.</p>' : "",
            '<div class="option-list size-choice-list crachas-size-card-list cadernos-cover-list">' + rowsHtml + '</div>',
            '</section>'
          ].join("");
          return;
        }

        if (state.admin) {
          html += [
            '<div class="design-grid-section design-grid-section-invisible' + (bucket.length === 0 ? ' is-empty' : '') + '" data-section-id="' + escapeHtml(section.id) + '">',
            '<h3 class="design-grid-section-title is-admin-only">' + escapeHtml(section.title) + ' <span class="design-grid-section-hint">(grupo invisível no site público)</span></h3>',
            bucket.length === 0 ? '<p class="design-grid-section-empty">Sem itens neste grupo.</p>' : "",
            '<div class="option-list size-choice-list crachas-size-card-list cadernos-cover-list">' + rowsHtml + '</div>',
            '</div>'
          ].join("");
        } else {
          html += '<div class="option-list size-choice-list crachas-size-card-list cadernos-cover-list">' + rowsHtml + '</div>';
        }
      });
    } else {
      (step.items || []).forEach(function (item) {
        html += renderCoverChoice(item);
      });
      html = '<div class="option-list size-choice-list crachas-size-card-list cadernos-cover-list">' + html + '</div>';
    }

    return html
      + (state.admin ? '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar opção</button>' : "")
      + renderCadernosBuildSummaryV2(product, step);
  }

  function renderCadernosLaminationStep(product, step) {
    var selected = selectedValues(step);
    var html = "";

    (step.items || []).forEach(function (item) {
      var checked = selected.indexOf(item.value) !== -1 ? " checked" : "";
      var selectedClass = checked ? " is-selected" : "";
      var muted = selected.length && !checked ? " is-muted" : "";
      var previewItem = cadernoLaminationPreviewItem(product, item);

      html += [
        '<div class="cadernos-lamination-choice">',
        '<label class="choice-card crachas-size-card cadernos-lamination-card' + selectedClass + muted + '">',
        '<input type="radio" name="' + escapeHtml(step.field) + '" value="' + escapeHtml(item.value) + '" data-choice-step="' + escapeHtml(step.id) + '"' + checked + '>',
        '<span class="crachas-size-card-visual">' + renderVisual(previewItem, "media-list", step) + '</span>',
        '<span class="choice-copy crachas-size-card-text">',
        '<strong>' + escapeHtml(item.title) + '</strong>',
        '<span>' + escapeHtml(item.subtitle || "") + '</span>',
        '</span>',
        '<span class="crachas-size-card-selected" aria-hidden="true">✓</span>',
        adminItemControls(step, item),
        '</label>',
        checked ? renderCadernosProofPhoto(previewItem, "Imagem ilustrativa") : "",
        '</div>'
      ].join("");
    });

    return '<div class="option-list size-choice-list crachas-size-card-list">' + html + '</div>'
      + (state.admin ? '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar opção</button>' : "");
  }

  function renderCadernosPurchaseOptions(product, step) {
    var current = getPackQuantity(product);
    var promo = step && step.promoNote ? String(step.promoNote) : "";
    var html = "";

    (step.items || []).forEach(function (item) {
      var quantity = Number(item.quantity);
      var selected = quantity === current;
      var priceText = item.priceCents != null ? formatCents(item.priceCents) : (item.subtitle || "");
      var previewItem = cadernoPurchasePreviewItem(product, item);

      html += [
        '<div class="cadernos-purchase-choice">',
        '<button class="choice-card crachas-size-card cadernos-purchase-card' + (selected ? ' is-selected' : '') + '" type="button" data-pack-quantity="' + quantity + '" data-track="true" data-track-action="select_pack" data-track-id="cadernos_option_' + quantity + '">',
        '<span class="crachas-size-card-visual">' + renderVisual(previewItem, "media-list", step) + '</span>',
        '<span class="choice-copy crachas-size-card-text">',
        '<strong>' + escapeHtml(item.title || "") + '</strong>',
        item.includes ? '<span class="choice-note">' + escapeHtml(item.includes) + '</span>' : "",
        '</span>',
        '<span class="cadernos-purchase-price">' + escapeHtml(priceText) + '</span>',
        '<span class="crachas-size-card-selected" aria-hidden="true">✓</span>',
        '</button>',
        selected ? renderCadernosProofPhoto(previewItem, "Imagem ilustrativa") : "",
        state.admin ? adminItemControls(step, previewItem) : "",
        '</div>'
      ].join("");
    });

    return [
      '<div class="option-list size-choice-list crachas-size-card-list cadernos-purchase-list">' + html + '</div>',
      promo ? '<p class="cadernos-info-note cadernos-info-note--promo" role="note">' + renderInlineText(promo) + '</p>' : "",
      state.admin ? '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar opção</button>' : ""
    ].join("");
  }

  function renderCadernoOrderQuantitySelector(product, step, selectedQuantity) {
    var config = cadernoOrderQuantityConfig(product);
    var options = cadernoOrderQuantityOptions(product);
    var option = selectedCadernoPurchaseOption(product);
    var html = options.map(function (quantity) {
      var label = option && option.isPack
        ? (quantity === 1 ? "pack" : "packs")
        : (quantity === 1 ? productUnitSingular(product) : productUnit(product));
      return [
        '<button class="pack-option cadernos-order-quantity-option' + (quantity === selectedQuantity ? ' is-selected' : '') + '" type="button" data-caderno-order-quantity="' + quantity + '">',
        '<strong>' + quantity + '</strong>',
        '<span>' + escapeHtml(label) + '</span>',
        '</button>'
      ].join("");
    }).join("");

    return [
      '<section class="cadernos-order-quantity" aria-label="' + escapeHtml(config.title || "Quantidade") + '">',
      '<div class="cadernos-order-quantity-copy">',
      '<strong>' + escapeHtml(config.title || "Quantidade") + '</strong>',
      config.text ? '<span>' + escapeHtml(config.text) + '</span>' : "",
      '</div>',
      '<div class="pack-options cadernos-order-quantity-options">' + html + '</div>',
      '</section>'
    ].join("");
  }

  function renderCadernoPersonalizationStep(product, step) {
    var selected = selectedValues(step);
    var limit = cadernoPersonalizationLimit(product);
    var text = cadernoPersonalizationText();
    var tooLong = text.length > limit;
    var missingText = state.invalidFields.indexOf("cover_personalization_text") !== -1 && !text;
    var textError = missingText
      ? "Escreve o nome ou frase para personalizar a capa."
      : (tooLong ? "O nome/frase tem de ter no máximo " + limit + " caracteres." : "");
    var showExample = step.showExample !== false && !!step.exampleImage;
    var exampleVisible = state.selections.show_caderno_personalization_example !== false;
    var html = "";

    (step.items || []).forEach(function (item) {
      var checked = selected.indexOf(item.value) !== -1 ? " checked" : "";
      var muted = selected.length && !checked ? " is-muted" : "";
      var drawer = item.value === "yes" && checked ? [
        '<div class="cadernos-personalization-drawer">',
        '<label class="cadernos-personalization-field">',
        '<span>Nome/frase <small data-cover-personalization-count>(' + text.length + ' / ' + limit + ')</small></span>',
        '<input class="' + (textError ? "is-missing" : "") + '" type="text" value="' + escapeHtml(state.selections.cover_personalization_text || "") + '" data-cover-personalization-text data-cover-personalization-limit="' + limit + '" aria-describedby="cover-personalization-help"' + (textError ? ' aria-invalid="true"' : '') + '>',
        '</label>',
        textError ? '<p class="form-error" id="cover-personalization-help" role="alert">' + escapeHtml(textError) + '</p>' : '<p class="details-section-note" id="cover-personalization-help">Máximo de ' + limit + ' caracteres.</p>',
        '</div>'
      ].join("") : "";

      html += [
        '<div class="cadernos-personalization-choice">',
        '<label class="choice-card crachas-size-card cadernos-personalization-card' + (checked ? ' is-selected' : '') + muted + '">',
        '<input type="radio" name="' + escapeHtml(step.field) + '" value="' + escapeHtml(item.value) + '" data-choice-step="' + escapeHtml(step.id) + '"' + checked + '>',
        '<span class="choice-copy crachas-size-card-text">',
        '<strong>' + escapeHtml(item.title || "") + '</strong>',
        '<span>' + escapeHtml(item.subtitle || "") + '</span>',
        '</span>',
        '<span class="crachas-size-card-selected" aria-hidden="true">✓</span>',
        adminItemControls(step, item),
        '</label>',
        drawer,
        '</div>'
      ].join("");
    });

    return [
      showExample ? '<button class="example-toggle" type="button" data-caderno-personalization-example-toggle>' + (exampleVisible ? "Ocultar exemplo" : "Ver exemplo") + '</button>' : "",
      showExample ? '<div class="details-example cadernos-personalization-example"' + (exampleVisible ? "" : " hidden") + '><img class="example-image" src="' + escapeHtml(step.exampleImage) + '" alt="' + escapeHtml(step.exampleAlt || "Exemplo de personalização da capa") + '" loading="lazy"></div>' : "",
      '<div class="option-list size-choice-list crachas-size-card-list cadernos-personalization-list">' + html + '</div>',
      step.note ? '<p class="cadernos-info-note cadernos-info-note--important" role="note">' + escapeHtml(step.note) + '</p>' : ""
    ].join("");
  }

  function adminCadernoSummaryImageControls(step, item) {
    var imageSlotAttrs;
    var frameScaleValue;
    var frameDefaultSize;

    if (!state.admin || !step || !item || !item._imageEditKey) {
      return "";
    }

    imageSlotAttrs = adminImageSlotAttrs(item);
    frameScaleValue = frameEditNumber(item, step, false, "frameScale", 100, 40, 300);
    frameDefaultSize = Math.round(defaultFrameBaseSize(item, "media-list", step) * frameScaleValue / 100);

    return [
      '<div class="admin-card-tools admin-card-tools-image-slot">',
      '<p class="admin-card-tools-heading">Imagem deste resumo</p>',
      '<label>Tamanho da moldura (%)<input type="number" min="40" max="300" step="1" value="' + escapeHtml(frameScaleValue) + '" data-admin-edit="frameScale" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>',
      '<label>Largura moldura (px)<input type="number" min="1" max="2000" step="1" value="' + escapeHtml(frameEditNumber(item, step, false, "frameWidth", frameDefaultSize, 1, 2000)) + '" data-admin-edit="frameWidth" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>',
      '<label>Altura moldura (px)<input type="number" min="1" max="2000" step="1" value="' + escapeHtml(frameEditNumber(item, step, false, "frameHeight", frameDefaultSize, 1, 2000)) + '" data-admin-edit="frameHeight" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>',
      '<label>Margem X (px)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(frameEditNumber(item, step, false, "frameMarginX", 0, -100, 100)) + '" data-admin-edit="frameMarginX" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>',
      '<label>Margem Y (px)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(frameEditNumber(item, step, false, "frameMarginY", 0, -100, 100)) + '" data-admin-edit="frameMarginY" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>',
      '<label>Zoom imagem (%)<input type="number" min="20" max="500" step="1" value="' + escapeHtml(imageEditNumber(item, step, false, "imageZoom", 168, 20, 500)) + '" data-admin-edit="imageZoom" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>',
      '<label>Imagem X (%)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(imageEditNumber(item, step, false, "imagePositionX", 0, -100, 100)) + '" data-admin-edit="imagePositionX" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>',
      '<label>Imagem Y (%)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(imageEditNumber(item, step, false, "imagePositionY", 0, -100, 100)) + '" data-admin-edit="imagePositionY" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>',
      '<label>Rotação imagem (°)<input type="number" min="-180" max="180" step="1" value="' + escapeHtml(imageEditNumber(item, step, false, "imageRotation", 0, -180, 180)) + '" data-admin-edit="imageRotation" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>',
      '</div>'
    ].join("");
  }

  function renderCadernosBuildPart(label, title, item, step, extraClass) {
    return [
      '<article class="cadernos-build-part' + (extraClass ? ' ' + escapeHtml(extraClass) : '') + '">',
      item ? renderVisual(item, "media-list", step) : "",
      '<span><strong>' + escapeHtml(label) + '</strong><em>' + escapeHtml(title || "") + '</em></span>',
      adminCadernoSummaryImageControls(step, item),
      '</article>'
    ].join("");
  }

  function renderCadernosBuildTextPart(label, title, detail) {
    return [
      '<article class="cadernos-build-part cadernos-build-part--text">',
      '<span><strong>' + escapeHtml(label) + '</strong><em>' + escapeHtml(title || "") + '</em>' + (detail ? '<small>' + escapeHtml(detail) + '</small>' : "") + '</span>',
      '</article>'
    ].join("");
  }

  function renderCadernosBuildSummary(product, step) {
    var steps = visibleSteps(product);
    var currentIndex = steps.indexOf(step);
    var laminationIndex = steps.indexOf(findStep(product, "lamination"));
    var optionIndex = steps.indexOf(findStep(product, "pack"));
    var cover = selectedCadernoCover(product);
    var lamination = selectedCadernoLamination(product);
    var option = selectedCadernoPurchaseOption(product);
    var parts = "";

    if (!cover || currentIndex < 0) {
      return "";
    }

    parts += renderCadernosBuildPart("Capa", displayItemTitle(cover), cadernoSummaryCoverPreviewItem(product, cover), findStep(product, "designs"), "cadernos-build-part--cover");

    if (currentIndex > laminationIndex && lamination) {
      parts += '<span class="cadernos-build-plus" aria-hidden="true">+</span>';
      parts += [
        '<article class="cadernos-build-part">',
        renderVisual(cadernoSummaryLaminationPreviewItem(product, lamination), "media-list", findStep(product, "lamination")),
        '<span><strong>Laminação</strong><em>' + escapeHtml(lamination.title) + '</em></span>',
        '</article>'
      ].join("");
    }

    if (currentIndex > optionIndex && option) {
      parts += '<span class="cadernos-build-plus" aria-hidden="true">+</span>';
      parts += [
        '<article class="cadernos-build-part cadernos-build-part--text">',
        '<span><strong>' + escapeHtml(option.title) + '</strong><em>' + escapeHtml(option.summary || option.includes || "") + '</em></span>',
        cadernoOrderQuantity(product) > 1 ? '<b>x' + cadernoOrderQuantity(product) + '</b>' : "",
        '</article>'
      ].join("");
    }

    return [
      '<section class="cadernos-build-summary" aria-label="O que vais encomendar">',
      '<h3>O que vais encomendar:</h3>',
      '<div class="cadernos-build-parts">' + parts + '</div>',
      '</section>'
    ].join("");
  }

  function renderCadernosBuildSummaryV2(product, step) {
    var steps = visibleSteps(product);
    var currentIndex = steps.indexOf(step);
    var laminationIndex = steps.indexOf(findStep(product, "lamination"));
    var optionIndex = steps.indexOf(findStep(product, "pack"));
    var personalizationIndex = steps.indexOf(findStep(product, "cover_personalization"));
    var cover = selectedCadernoCover(product);
    var lamination = selectedCadernoLamination(product);
    var option = selectedCadernoPurchaseOption(product);
    var orderQuantity = cadernoOrderQuantity(product);
    var personalization = state.selections.cover_personalization || "";
    var parts = "";

    if (!cover || currentIndex < 0) {
      return "";
    }

    parts += renderCadernosBuildPart("Capa", displayItemTitle(cover), cadernoSummaryCoverPreviewItem(product, cover), findStep(product, "designs"), "cadernos-build-part--cover");

    if (currentIndex >= laminationIndex && lamination) {
      parts += renderCadernosBuildPart("Laminação", lamination.title, cadernoSummaryLaminationPreviewItem(product, lamination), findStep(product, "lamination"), "cadernos-build-part--lamination");
    }

    if (currentIndex >= optionIndex && option) {
      parts += renderCadernosBuildPart(
        option.title + (orderQuantity > 1 ? " x" + orderQuantity : ""),
        option.summary || option.includes || "",
        cadernoSummaryPurchasePreviewItem(product, option),
        findStep(product, "pack"),
        "cadernos-build-part--option"
      );
    }

    if (currentIndex >= personalizationIndex && personalization) {
      parts += renderCadernosBuildTextPart(
        "Personalização",
        personalization === "yes" ? "Sim" : "Não",
        personalization === "yes" ? cadernoPersonalizationText() : ""
      );
    }

    return [
      '<section class="cadernos-build-summary" aria-label="O que vais encomendar">',
      '<h3>O que vais encomendar:</h3>',
      '<div class="cadernos-build-parts">' + parts + '</div>',
      '</section>'
    ].join("");
  }

