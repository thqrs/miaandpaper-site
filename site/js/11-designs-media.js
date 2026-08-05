// js/11-designs-media.js — parte 11/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: media dos cartoes de design: isUploadedImage, uploadedStackStyle, visualizador de imagem (closeImageViewer), renderDesignCardMedia.
  function isUploadedImage(item) {
    return !!(item && item.image && (/^data:image\//.test(item.image) || /^content\/(?:uploads|designs)\/[^"'<>]+$/.test(item.image)));
  }

  // APP_FRAME_PX_V7_OFFICIAL_SITE_FOLDER: permite controlar diretamente width/height inline
  // das molduras pelo painel ADMIN (campos Largura moldura (px) / Altura moldura (px)).
  function defaultFrameBaseSize(item, template, step) {
    if (template === "media-list" && step && step.id === "size" && item) {
      if (item.value === "25 mm") {
        return 58;
      }

      if (item.value === "32 mm") {
        return 74;
      }
    }

    return template === "media-list" ? 70 : 102;
  }

  function uploadedFrameInfo(item, template, step) {
    var defaultSize = template === "media-list" ? 100 : 168;
    var baseFrameSize = defaultFrameBaseSize(item, template, step);
    var frameScale = frameEditNumber(item, step, false, "frameScale", 100, 40, 300) / 100;
    var frameMarginX = frameEditNumber(item, step, false, "frameMarginX", 0, -100, 100);
    var frameMarginY = frameEditNumber(item, step, false, "frameMarginY", 0, -100, 100);
    var frameRenderSize = Math.round(baseFrameSize * frameScale * 100) / 100;
    var frameWidth = frameEditNumber(item, step, false, "frameWidth", frameRenderSize, 1, 2000);
    var frameHeight = frameEditNumber(item, step, false, "frameHeight", frameRenderSize, 1, 2000);
    var frameMarginTop = Math.max(frameMarginY, 0);
    var frameMarginRight = Math.max(-frameMarginX, 0);
    var frameMarginBottom = Math.max(-frameMarginY, 0);
    var frameMarginLeft = Math.max(frameMarginX, 0);
    var imageZoom = imageEditNumber(item, step, false, "imageZoom", defaultSize, 20, 500) / 100;
    var imagePositionX = imageEditNumber(item, step, false, "imagePositionX", 0, -100, 100);
    var imagePositionY = imageEditNumber(item, step, false, "imagePositionY", 0, -100, 100);
    var imageRotation = imageEditNumber(item, step, false, "imageRotation", 0, -180, 180);
    var imageFit = item && item.imageFit === "contain" ? "contain" : "cover";

    return {
      style: [
        '--uploaded-image:url(&quot;' + escapeHtml(siteAssetUrl(item.image)) + '&quot;)',
        "--image-zoom-scale:" + imageZoom,
        "--image-position-x:" + imagePositionX + "%",
        "--image-position-y:" + imagePositionY + "%",
        "--image-rotation:" + imageRotation + "deg",
        "--image-fit:" + imageFit,
        "--image-frame-render-size:" + frameRenderSize + "px",
        "--image-frame-scale:1",
        "--frame-width-px:" + frameWidth + "px",
        "--frame-height-px:" + frameHeight + "px",
        "--frame-aspect:" + frameWidth + "/" + frameHeight,
        "height:" + frameHeight + "px",
        "width:" + frameWidth + "px",
        "--image-frame-shift-x:0px",
        "--image-frame-shift-y:0px",
        "--image-frame-transform-y:0px",
        "--image-frame-margin-top:" + frameMarginTop + "px",
        "--image-frame-margin-right:" + frameMarginRight + "px",
        "--image-frame-margin-bottom:" + frameMarginBottom + "px",
        "--image-frame-margin-left:" + frameMarginLeft + "px"
      ].join(";"),
      debug: miaSlotDebugFramePayload(item, step, false, item && item.image, {
        defaultZoom: defaultSize,
        zoom: imageZoom,
        x: imagePositionX,
        y: imagePositionY,
        rotation: imageRotation
      })
    };
  }

  function uploadedFrameStyle(item, template, step) {
    return uploadedFrameInfo(item, template, step).style;
  }

  // CRACHAS_STEP2_SIDE_PHOTO_ADMIN_V4
  // Mirror dedicado para a foto da direita do passo 2 dos crachas:
  // ler/escrever em sideImage / sideImageZoom / sideImagePositionX|Y /
  // sideImageRotation / sideImageFit / sideFrameScale / sideFrameWidth /
  // sideFrameHeight / sideFrameMarginX|Y. Defaults uniformes (84x108)
  // para Pequeno e Medio para evitar saltos de altura entre cartoes.
  function defaultSideFrameWidth(item) { return 84; }
  function defaultSideFrameHeight(item) { return 108; }

  function isUploadedSideImage(item) {
    return !!(item && item.sideImage && (/^data:image\//.test(item.sideImage)
      || /^content\/(?:uploads|designs)\/[^"'<>?#]+$/.test(item.sideImage)));
  }

  function uploadedSideFrameStyle(item) {
    var defaultSize = 100;
    var frameScale = frameEditNumber(item, null, true, "sideFrameScale", 100, 40, 300) / 100;
    var frameMarginX = frameEditNumber(item, null, true, "sideFrameMarginX", 0, -100, 100);
    var frameMarginY = frameEditNumber(item, null, true, "sideFrameMarginY", 0, -100, 100);
    var frameWidth = frameEditNumber(item, null, true, "sideFrameWidth", Math.round(defaultSideFrameWidth(item) * frameScale), 1, 2000);
    var frameHeight = frameEditNumber(item, null, true, "sideFrameHeight", Math.round(defaultSideFrameHeight(item) * frameScale), 1, 2000);
    var frameMarginTop = Math.max(frameMarginY, 0);
    var frameMarginRight = Math.max(-frameMarginX, 0);
    var frameMarginBottom = Math.max(-frameMarginY, 0);
    var frameMarginLeft = Math.max(frameMarginX, 0);
    var imageZoom = itemImageNumber(item, "sideImageZoom", defaultSize, 20, 500) / 100;
    var imagePositionX = itemImageNumber(item, "sideImagePositionX", 0, -100, 100);
    var imagePositionY = itemImageNumber(item, "sideImagePositionY", 0, -100, 100);
    var imageRotation = itemImageNumber(item, "sideImageRotation", 0, -180, 180);
    var imageFit = item && item.sideImageFit === "contain" ? "contain" : "cover";

    return [
      '--uploaded-image:url(&quot;' + escapeHtml(siteAssetUrl(item.sideImage)) + '&quot;)',
      "--image-zoom-scale:" + imageZoom,
      "--image-position-x:" + imagePositionX + "%",
      "--image-position-y:" + imagePositionY + "%",
      "--image-rotation:" + imageRotation + "deg",
      "--image-fit:" + imageFit,
      "--image-frame-render-size:" + Math.max(frameWidth, frameHeight) + "px",
      "--image-frame-scale:1",
      "--frame-width-px:" + frameWidth + "px",
      "--frame-height-px:" + frameHeight + "px",
      "--frame-aspect:" + frameWidth + "/" + frameHeight,
      "height:" + frameHeight + "px",
      "width:" + frameWidth + "px",
      "--image-frame-shift-x:0px",
      "--image-frame-shift-y:0px",
      "--image-frame-transform-y:0px",
      "--image-frame-margin-top:" + frameMarginTop + "px",
      "--image-frame-margin-right:" + frameMarginRight + "px",
      "--image-frame-margin-bottom:" + frameMarginBottom + "px",
      "--image-frame-margin-left:" + frameMarginLeft + "px"
    ].join(";");
  }

  // CRACHAS_STEP2_PROOF_PHOTO_CROP_FIX_V1
  // A foto grande de comparação não deve herdar a moldura antiga 84x108
  // da miniatura lateral. Usa a mesma imagem/valores de X/Y/zoom, mas o
  // contentor grande controla o recorte de forma independente.
  function uploadedSideProofInfo(item, step) {
    var imageZoom = Math.max(1, imageEditNumber(item, step, true, "sideImageZoom", 100, 20, 500) / 100);
    var imagePositionX = imageEditNumber(item, step, true, "sideImagePositionX", 0, -100, 100);
    var imagePositionY = imageEditNumber(item, step, true, "sideImagePositionY", 0, -100, 100);
    var imageRotation = imageEditNumber(item, step, true, "sideImageRotation", 0, -180, 180);

    return {
      style: [
        "--image-zoom-scale:" + imageZoom,
        "--image-position-x:" + imagePositionX + "%",
        "--image-position-y:" + imagePositionY + "%",
        "--image-rotation:" + imageRotation + "deg"
      ].join(";"),
      debug: miaSlotDebugFramePayload(item, step, true, item && item.sideImage, {
        defaultZoom: 100,
        zoom: imageZoom,
        x: imagePositionX,
        y: imagePositionY,
        rotation: imageRotation
      })
    };
  }

  function uploadedSideProofStyle(item) {
    return uploadedSideProofInfo(item, null).style;
  }

  function uploadedStackStyle(item, step) {
    var defaultSize = 168;
    var imageZoom = imageEditNumber(item, step, false, "imageZoom", defaultSize, 20, 500) / 100;
    var imagePositionX = imageEditNumber(item, step, false, "imagePositionX", 0, -100, 100);
    var imagePositionY = imageEditNumber(item, step, false, "imagePositionY", 0, -100, 100);
    var imageRotation = imageEditNumber(item, step, false, "imageRotation", 0, -180, 180);
    var imageFit = item && item.imageFit === "contain" ? "contain" : "cover";

    return [
      '--uploaded-image:url(&quot;' + escapeHtml(siteAssetUrl(item.image)) + '&quot;)',
      "--image-zoom-scale:" + imageZoom,
      "--image-position-x:" + imagePositionX + "%",
      "--image-position-y:" + imagePositionY + "%",
      "--image-rotation:" + imageRotation + "deg",
      "--image-fit:" + imageFit,
      "--image-frame-scale:1",
      "--image-frame-shift-x:0px",
      "--image-frame-shift-y:0px",
      "--image-frame-transform-y:0px",
      "--image-frame-margin-top:0px",
      "--image-frame-margin-right:0px",
      "--image-frame-margin-bottom:0px",
      "--image-frame-margin-left:0px"
    ].join(";");
  }

  function renderVisual(item, template, step) {
    var visual = item.visual || "neutral";
    var text = item.badge || "";
    var className = template === "media-list" ? "option-image" : "design-image";
    var isActive;
    var adminAttrs = "";
    var frameInfo;
    var renderEditKey;

    if (isUploadedImage(item)) {
      renderEditKey = step ? miaSlotDebugEditKey(item, step, false) : "";
      isActive = !!(
        state.admin
        && step
        && state.adminActiveImage
        && state.adminActiveImage.stepId === step.id
        && state.adminActiveImage.itemId === item.id
        && (!state.adminActiveImage.editKey || state.adminActiveImage.editKey === renderEditKey)
      );
      if (state.admin && step) {
        adminAttrs = ' data-admin-image-visual data-admin-image-step="' + escapeHtml(step.id) + '" data-admin-image-item="' + escapeHtml(item.id) + '" tabindex="0" role="button" title="Selecionar imagem para ajustar com o teclado"';
        if (item._imageEditStoreItemId) {
          adminAttrs += ' data-admin-image-store-item="' + escapeHtml(item._imageEditStoreItemId) + '"';
        }
      }
      frameInfo = uploadedFrameInfo(item, template, step);

      return '<span class="' + className + itemRectOrientationClass(item) + itemFrameShapeClass(item) + ' uploaded-image' + (isActive ? ' is-admin-image-active' : '') + '" style="' + frameInfo.style + '"' + (adminAttrs ? "" : ' aria-hidden="true"') + adminAttrs + miaSlotDebugFrameAttrs(frameInfo.debug) + '><span class="uploaded-image-inner"></span></span>';
    }

    return '<span class="' + className + " " + escapeHtml(visual) + '" aria-hidden="true">' + escapeHtml(text) + '</span>';
  }

  function imageViewerBigCandidate(src) {
    var value = String(src || "");
    var queryIndex = value.search(/[?#]/);
    var path = queryIndex >= 0 ? value.slice(0, queryIndex) : value;
    var suffix = queryIndex >= 0 ? value.slice(queryIndex) : "";
    var slash = path.lastIndexOf("/");
    var dot = path.lastIndexOf(".");

    if (!value || dot <= slash) {
      return "";
    }

    return path.slice(0, dot) + "_big" + path.slice(dot) + suffix;
  }

  function resolveImageViewerSource(src, callback) {
    var fallback = String(src || "");
    var candidate = imageViewerBigCandidate(fallback);
    var probe;
    var finished = false;

    if (!candidate || candidate === fallback) {
      callback(fallback);
      return;
    }

    probe = new Image();
    probe.onload = function () {
      if (!finished) {
        finished = true;
        callback(candidate);
      }
    };
    probe.onerror = function () {
      if (!finished) {
        finished = true;
        callback(fallback);
      }
    };
    probe.src = candidate;
  }

  function setImageViewerZoom(value) {
    var image = document.querySelector("[data-image-viewer-img]");

    imageViewerZoom = Math.max(1, Math.min(3, Math.round(value * 10) / 10));
    if (image) {
      image.style.setProperty("--image-viewer-zoom", imageViewerZoom);
    }
  }

  function closeImageViewer() {
    var viewer = document.querySelector("[data-image-viewer]");

    if (viewer && viewer.parentNode) {
      viewer.parentNode.removeChild(viewer);
    }
    if (document.body) {
      document.body.classList.remove("image-viewer-open");
    }
    imageViewerZoom = 1;
  }

  function bindImageViewerOverlay(viewer) {
    viewer.addEventListener("click", function (event) {
      if (event.target === viewer || event.target.classList.contains("image-viewer-stage")) {
        closeImageViewer();
      }
    });

    viewer.querySelectorAll("[data-image-viewer-close]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        closeImageViewer();
      });
    });

    viewer.querySelectorAll("[data-image-viewer-zoom]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        setImageViewerZoom(imageViewerZoom + (button.dataset.imageViewerZoom === "in" ? 0.25 : -0.25));
      });
    });

    if (!imageViewerEscapeBound) {
      imageViewerEscapeBound = true;
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && document.querySelector("[data-image-viewer]")) {
          closeImageViewer();
        }
      });
    }
  }

  function openImageViewer(src, alt) {
    var source = String(src || "");
    var label = String(alt || "Imagem maior");
    var viewer;
    var image;

    if (!source || !document.body) {
      return;
    }

    // MAGNIFIER_TRACKING_V1 (Phase 5): fire-and-forget. Erro silencioso.
    try { if (typeof trackMagnifierOpened === 'function') trackMagnifierOpened(source, label); } catch (e) {}

    closeImageViewer();
    imageViewerZoom = 1;
    document.body.insertAdjacentHTML("beforeend", [
      '<div class="image-viewer" data-image-viewer role="dialog" aria-modal="true" aria-label="Imagem maior">',
      '<button type="button" class="image-viewer-close" data-image-viewer-close aria-label="Fechar imagem">×</button>',
      '<div class="image-viewer-stage">',
      '<img class="image-viewer-img" data-image-viewer-img data-image-viewer-original="' + escapeHtml(source) + '" src="' + escapeHtml(source) + '" alt="' + escapeHtml(label) + '">',
      '</div>',
      '<div class="image-viewer-controls" aria-label="Zoom da imagem">',
      '<button type="button" data-image-viewer-zoom="out" aria-label="Diminuir zoom">−</button>',
      '<button type="button" data-image-viewer-zoom="in" aria-label="Aumentar zoom">+</button>',
      '</div>',
      '</div>'
    ].join(""));
    document.body.classList.add("image-viewer-open");
    viewer = document.querySelector("[data-image-viewer]");
    image = viewer ? viewer.querySelector("[data-image-viewer-img]") : null;
    if (!viewer || !image) {
      return;
    }

    setImageViewerZoom(1);
    bindImageViewerOverlay(viewer);
    resolveImageViewerSource(source, function (resolved) {
      var current = document.querySelector("[data-image-viewer-img]");

      if (current && current.dataset.imageViewerOriginal === source) {
        current.src = resolved;
      }
    });
  }

  function shouldShowDesignZoom(product, step, item) {
    return !state.admin
      && product
      && ["crachas", "imanes", "caderninhos", "cadernos"].indexOf(productFamily(product)) !== -1
      && step
      && step.id === "designs"
      && item
      && item.image;
  }

  function renderDesignZoomButton(product, step, item) {
    if (!shouldShowDesignZoom(product, step, item)) {
      return "";
    }

    return '<button type="button" class="design-zoom-button" data-image-viewer-src="' + escapeHtml(item.image) + '" data-image-viewer-alt="' + escapeHtml(displayItemTitle(item) || item.title || "Design") + '" aria-label="Ver imagem maior">' + ICON_ZOOM + '</button>';
  }

  function renderDesignCardMedia(product, step, item) {
    var visual = renderVisual(item, "design-grid", step);
    var zoomButton = renderDesignZoomButton(product, step, item);
    var mediaStyle = isUploadedImage(item) ? ' style="' + uploadedFrameStyle(item, "design-grid", step) + '"' : "";

    if (!zoomButton) {
      return visual;
    }

    return '<span class="design-card-media"' + mediaStyle + '>' + visual + zoomButton + '</span>';
  }

  function renderCadernoCoverCardMedia(product, step, item) {
    var visual = renderVisual(item, "media-list", step);
    var zoomButton = renderDesignZoomButton(product, step, item);

    return '<span class="crachas-size-card-visual cadernos-cover-media">' + visual + zoomButton + '</span>';
  }

  function bindImageViewerTriggers() {
    document.querySelectorAll("[data-image-viewer-src]").forEach(function (button) {
      if (button.dataset.imageViewerBound === "1") {
        return;
      }
      button.dataset.imageViewerBound = "1";
      button.addEventListener("pointerdown", function (event) {
        event.stopPropagation();
      });
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        openImageViewer(button.dataset.imageViewerSrc, button.dataset.imageViewerAlt);
      });
    });
  }

  function selectedValues(step) {
    var value = state.selections[step.id];
    if (step.selection === "multi") {
      return Array.isArray(value) ? value : [];
    }
    return value ? [value] : [];
  }

