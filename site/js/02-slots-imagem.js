// js/02-slots-imagem.js — parte 02/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: edicao de imagem por slot (miaSlotDebug*, imageEdit*): zoom/posicao/rotacao e moldura por item e por lado, chaves de edicao, proxies e datasets.
  function buildImageEditKey(productSlug, collection, itemId, slotName) {
    return [
      productSlug || "unknown",
      collection || "unknown",
      itemId || "unknown",
      slotName || "main"
    ].join(":");
  }

  function miaSlotDebugIsFlatKey(key) {
    return miaSlotDebugFlatKeys.indexOf(key) !== -1 || miaSlotDebugSideFlatKeys.indexOf(key) !== -1;
  }

  function miaSlotDebugIsFrameKey(key) {
    return miaSlotDebugFrameKeys.indexOf(key) !== -1 || miaSlotDebugSideFrameKeys.indexOf(key) !== -1;
  }

  function miaSlotDebugCollection(step) {
    return step && step.id ? String(step.id) : "";
  }

  function miaSlotDebugImage(item, side, fallback) {
    if (fallback) {
      return String(fallback);
    }
    if (!item) {
      return "";
    }
    if (side && item.sideImage) {
      return String(item.sideImage);
    }
    return String(item.image || item.exampleImage || "");
  }

  function imageEditSlotName(side) {
    return side ? "side" : "main";
  }

  function miaSlotDebugEditKey(item, step, side) {
    if (item && side && item._sideImageEditKey) {
      return String(item._sideImageEditKey);
    }
    if (item && !side && item._imageEditKey) {
      return String(item._imageEditKey);
    }
    return buildImageEditKey(
      state.product && state.product.slug,
      miaSlotDebugCollection(step),
      item && item.id,
      imageEditSlotName(side)
    );
  }

  function miaSlotDebugFallbackEditKey(item, side) {
    if (item && side && item._sideImageEditFallbackKey) {
      return String(item._sideImageEditFallbackKey);
    }
    if (item && !side && item._imageEditFallbackKey) {
      return String(item._imageEditFallbackKey);
    }
    return "";
  }

  function imageEditSlotProperty(key) {
    var normalized = String(key || "");

    if (normalized === "sideImageZoom") { normalized = "imageZoom"; }
    if (normalized === "sideImagePositionX") { normalized = "imagePositionX"; }
    if (normalized === "sideImagePositionY") { normalized = "imagePositionY"; }
    if (normalized === "sideImageRotation") { normalized = "imageRotation"; }
    if (normalized === "sideFrameScale") { normalized = "frameScale"; }
    if (normalized === "sideFrameWidth") { normalized = "frameWidth"; }
    if (normalized === "sideFrameHeight") { normalized = "frameHeight"; }
    if (normalized === "sideFrameMarginX") { normalized = "frameMarginX"; }
    if (normalized === "sideFrameMarginY") { normalized = "frameMarginY"; }

    if (normalized === "imageZoom") { return "zoom"; }
    if (normalized === "imagePositionX") { return "positionX"; }
    if (normalized === "imagePositionY") { return "positionY"; }
    if (normalized === "imageRotation") { return "rotation"; }

    return normalized;
  }

  function miaSlotDebugSlot(item, editKey) {
    if (!item || !item.imageEdits || typeof item.imageEdits !== "object" || !editKey) {
      return null;
    }
    return item.imageEdits[editKey] && typeof item.imageEdits[editKey] === "object"
      ? item.imageEdits[editKey]
      : null;
  }

  function miaSlotDebugNumberSource(item, key, fallback, min, max, editKey) {
    var slot = miaSlotDebugSlot(item, editKey);
    var fallbackEditKey = miaSlotDebugFallbackEditKey(item, /^side/.test(String(key || "")));
    var fallbackSlot = fallbackEditKey && fallbackEditKey !== editKey ? miaSlotDebugSlot(item, fallbackEditKey) : null;
    var slotKey = imageEditSlotProperty(key);
    var hasSlot = !!(slot && slot[slotKey] != null);
    var hasLegacySlot = !!(slot && slot[key] != null);
    var hasFallbackSlot = !!(fallbackSlot && fallbackSlot[slotKey] != null);
    var hasFallbackLegacySlot = !!(fallbackSlot && fallbackSlot[key] != null);
    var hasFlat = !!(item && item[key] != null);
    var raw;
    var from;

    if (hasSlot) {
      raw = slot[slotKey];
      from = "slot";
    } else if (hasLegacySlot) {
      raw = slot[key];
      from = "slot";
    } else if (hasFallbackSlot) {
      raw = fallbackSlot[slotKey];
      from = "slot";
    } else if (hasFallbackLegacySlot) {
      raw = fallbackSlot[key];
      from = "slot";
    } else if (hasFlat) {
      raw = item[key];
      from = "flat";
    } else {
      raw = fallback;
      from = "default";
    }

    return {
      v: itemImageNumber({ value: raw }, "value", fallback, min, max),
      from: from,
      raw: raw
    };
  }

  function ensureImageEditSlot(item, editKey) {
    if (!item || !editKey) {
      return null;
    }
    if (!item.imageEdits || typeof item.imageEdits !== "object") {
      item.imageEdits = {};
    }
    if (!item.imageEdits[editKey] || typeof item.imageEdits[editKey] !== "object") {
      item.imageEdits[editKey] = {};
    }
    return item.imageEdits[editKey];
  }

  function writeImageEditSlot(item, editKey, flatKey, value) {
    var slot = ensureImageEditSlot(item, editKey);
    var slotKey = imageEditSlotProperty(flatKey);

    if (!slot) {
      return false;
    }

    slot[slotKey] = value;
    return true;
  }

  function imageEditNumber(item, step, side, key, fallback, min, max) {
    return miaSlotDebugNumberSource(
      item,
      key,
      fallback,
      min,
      max,
      miaSlotDebugEditKey(item, step, side)
    ).v;
  }

  function frameEditNumber(item, step, side, key, fallback, min, max) {
    return miaSlotDebugNumberSource(
      item,
      key,
      fallback,
      min,
      max,
      miaSlotDebugEditKey(item, step, side)
    ).v;
  }

  function imageSlotProxyItem(item, editKey, fallbackEditKey, storeItem) {
    var proxy;

    if (!item || !editKey) {
      return item;
    }

    proxy = Object.create(item);
    proxy.imageEdits = storeItem && storeItem.imageEdits ? storeItem.imageEdits : item.imageEdits;
    proxy._imageEditKey = editKey;
    proxy._imageEditFallbackKey = fallbackEditKey || "";
    if (storeItem && storeItem.id) {
      proxy._imageEditStoreItemId = storeItem.id;
    }
    return proxy;
  }

  function miaSlotDebugFramePayload(item, step, side, image, applied) {
    var editKey = miaSlotDebugEditKey(item, step, side);
    var fallbackEditKey = miaSlotDebugFallbackEditKey(item, side);
    var slotName = imageEditSlotName(side);
    var prefix = side ? "side" : "";
    var zoomKey = prefix ? "sideImageZoom" : "imageZoom";
    var xKey = prefix ? "sideImagePositionX" : "imagePositionX";
    var yKey = prefix ? "sideImagePositionY" : "imagePositionY";
    var rotationKey = prefix ? "sideImageRotation" : "imageRotation";
    var defaultZoom = applied && applied.defaultZoom != null ? applied.defaultZoom : 168;
    var zoom = miaSlotDebugNumberSource(item, zoomKey, defaultZoom, 20, 500, editKey);
    var x = miaSlotDebugNumberSource(item, xKey, 0, -100, 100, editKey);
    var y = miaSlotDebugNumberSource(item, yKey, 0, -100, 100, editKey);
    var rotation = miaSlotDebugNumberSource(item, rotationKey, 0, -180, 180, editKey);

    return {
      stepId: step && step.id ? String(step.id) : "",
      itemId: item && item.id ? String(item.id) : "",
      collection: miaSlotDebugCollection(step),
      editKey: editKey,
      fallbackEditKey: fallbackEditKey,
      slotName: slotName,
      image: miaSlotDebugImage(item, side, image),
      sources: {
        imageZoom: { v: zoom.v, from: zoom.from },
        imagePositionX: { v: x.v, from: x.from },
        imagePositionY: { v: y.v, from: y.from },
        imageRotation: { v: rotation.v, from: rotation.from }
      },
      appliedZoom: applied && applied.zoom != null ? applied.zoom : zoom.v / 100,
      appliedX: applied && applied.x != null ? applied.x : x.v,
      appliedY: applied && applied.y != null ? applied.y : y.v,
      appliedRotation: applied && applied.rotation != null ? applied.rotation : rotation.v,
      side: !!side
    };
  }

  function miaSlotDebugFrameAttrs(payload) {
    if (!payload) {
      return "";
    }
    return [
      ' data-mia-edit-key="' + escapeHtml(payload.editKey) + '"',
      payload.fallbackEditKey ? ' data-mia-fallback-edit-key="' + escapeHtml(payload.fallbackEditKey) + '"' : "",
      ' data-mia-step-id="' + escapeHtml(payload.stepId) + '"',
      ' data-mia-item-id="' + escapeHtml(payload.itemId) + '"',
      ' data-mia-collection="' + escapeHtml(payload.collection) + '"',
      ' data-mia-slot-name="' + escapeHtml(payload.slotName) + '"',
      ' data-mia-image="' + escapeHtml(payload.image) + '"',
      ' data-mia-source-image-zoom="' + escapeHtml(payload.sources.imageZoom.from) + '"',
      ' data-mia-source-image-position-x="' + escapeHtml(payload.sources.imagePositionX.from) + '"',
      ' data-mia-source-image-position-y="' + escapeHtml(payload.sources.imagePositionY.from) + '"',
      ' data-mia-source-image-rotation="' + escapeHtml(payload.sources.imageRotation.from) + '"',
      ' data-mia-applied-image-zoom="' + escapeHtml(payload.appliedZoom) + '"',
      ' data-mia-applied-image-position-x="' + escapeHtml(payload.appliedX) + '"',
      ' data-mia-applied-image-position-y="' + escapeHtml(payload.appliedY) + '"',
      ' data-mia-applied-image-rotation="' + escapeHtml(payload.appliedRotation) + '"',
      payload.side ? ' data-mia-side="1"' : ""
    ].join("");
  }

  function miaSlotDebugApplyElementDataset(element, payload) {
    if (!element || !payload || !element.dataset) {
      return;
    }
    element.dataset.miaEditKey = payload.editKey;
    if (payload.fallbackEditKey) {
      element.dataset.miaFallbackEditKey = payload.fallbackEditKey;
    }
    element.dataset.miaStepId = payload.stepId;
    element.dataset.miaItemId = payload.itemId;
    element.dataset.miaCollection = payload.collection;
    element.dataset.miaSlotName = payload.slotName;
    element.dataset.miaImage = payload.image;
    element.dataset.miaSourceImageZoom = payload.sources.imageZoom.from;
    element.dataset.miaSourceImagePositionX = payload.sources.imagePositionX.from;
    element.dataset.miaSourceImagePositionY = payload.sources.imagePositionY.from;
    element.dataset.miaSourceImageRotation = payload.sources.imageRotation.from;
    element.dataset.miaAppliedImageZoom = payload.appliedZoom;
    element.dataset.miaAppliedImagePositionX = payload.appliedX;
    element.dataset.miaAppliedImagePositionY = payload.appliedY;
    element.dataset.miaAppliedImageRotation = payload.appliedRotation;
    if (payload.side) {
      element.dataset.miaSide = "1";
    }
  }

