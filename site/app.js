(function () {
  var app = document.querySelector("#app");
  var page = document.body.dataset.page;
  var productSlug = document.body.dataset.product;
  var ADMIN_KEY = "miaandpaper-admin-session-v1";
  var ADMIN_API = "admin-api.php";
  var CART_KEY = "miaandpaper_cart_v1";
  var CART_SCHEMA_VERSION = 1;
  var CARD_DETAILS_SESSION_KEY = "miaandpaper_card_details_session";
  var CHECKOUT_SESSION_KEY = "miaandpaper_checkout_session";
  var cartMemoryStore = "";
  var cartEscapeBound = false;
  var checkoutHistoryBound = false;
  var imageViewerZoom = 1;
  var imageViewerEscapeBound = false;
  var cadernoPreviewTimers = [];

  function safeStorageGetItem(key) {
    var value;
    try {
      if (!window.localStorage) {
        return key === CART_KEY ? cartMemoryStore || null : null;
      }
      value = window.localStorage.getItem(key);
      if (value == null && key === CART_KEY && cartMemoryStore) {
        return cartMemoryStore;
      }
      return value;
    } catch (error) {
      return key === CART_KEY ? cartMemoryStore || null : null;
    }
  }

  function safeStorageSetItem(key, value) {
    try {
      if (!window.localStorage) {
        if (key === CART_KEY) {
          cartMemoryStore = value;
        }
        return false;
      }
      window.localStorage.setItem(key, value);
      if (key === CART_KEY) {
        cartMemoryStore = value;
      }
      return true;
    } catch (error) {
      if (key === CART_KEY) {
        cartMemoryStore = value;
      }
      return false;
    }
  }

  function safeStorageRemoveItem(key) {
    try {
      if (window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      /* noop */
    }
    if (key === CART_KEY) {
      cartMemoryStore = "";
    }
  }

  function safeSessionGetItem(key) {
    try {
      return window.sessionStorage ? window.sessionStorage.getItem(key) : null;
    } catch (error) {
      return null;
    }
  }

  function safeSessionSetItem(key, value) {
    try {
      if (window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
        return true;
      }
    } catch (error) {
      /* noop */
    }
    return false;
  }

  function safeSessionRemoveItem(key) {
    try {
      if (window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch (error) {
      /* noop */
    }
  }

  var state = {
    admin: safeStorageGetItem(ADMIN_KEY) === "1",
    loginOpen: false,
    adminMessage: "",
    cartPanelOpen: false,
    cartNotice: "",
    editingCartItemId: "",
    editingCartReturnTo: "",
    editingCartOriginalItem: null,
    checkoutDeliveryOptions: null,
    checkoutStep: 0,
    checkout: {
      customer_name: "",
      customer_contact: "",
      customer_congregation: "",
      delivery_option: "",
      send_copy: false,
      send_copy_touched: false,
      copy_email: ""
    },
    currentStep: 0,
    maxVisitedStep: 0,
    scrollStepOnRender: false,
    product: null,
    selections: {},
    errors: "",
    invalidFields: [],
    quantitySignature: "",
    quantitiesTouched: false,
    quantityPackBaseline: 0,
    undoStack: [],
    home: null,
    pricing: null,
    homeCarouselTimers: [],
    homeDeadlineTimer: null,
    itemDisplayLabels: {},
    adminActiveImage: null,
    adminImageKeyboardBound: false,
    adminImageKeyboardUndoFor: "",
    adminImageKeyboardUndoTimer: null,
    packDisabledMessage: "",
    homeUnavailableMessage: "",
    // OPEN_ORDER_HINT_V1: true quando check-open-orders.php devolve
    // has_possible_open_order=true para o nome+contacto correntes.
    openOrderHint: false,
    openOrderHintLastQuery: ""
  };

  var ICON_INSTAGRAM = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" ry="5" fill="none" stroke="currentColor" stroke-width="1.9"></rect><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.9"></circle><circle cx="17.4" cy="6.6" r="1.2" fill="currentColor"></circle></svg>';
  var ICON_MAIL = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="2.5" ry="2.5" fill="none" stroke="currentColor" stroke-width="1.9"></rect><path d="M4.5 7l7.5 6 7.5-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
  var ICON_CART = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.5 5.5h2.4l2 9.2a2 2 0 0 0 2 1.6h6.6a2 2 0 0 0 1.9-1.4l1.3-5.2H8.1" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="10.8" cy="20" r="1.2" fill="currentColor"></circle><circle cx="17.6" cy="20" r="1.2" fill="currentColor"></circle></svg>';
  var ICON_ZOOM = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="5.7" fill="none" stroke="currentColor" stroke-width="2"></circle><path d="M15 15l4.6 4.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>';
  var ICON_SUN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.9"></circle><g stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><line x1="12" y1="2.5" x2="12" y2="5"></line><line x1="12" y1="19" x2="12" y2="21.5"></line><line x1="2.5" y1="12" x2="5" y2="12"></line><line x1="19" y1="12" x2="21.5" y2="12"></line><line x1="5.2" y1="5.2" x2="7" y2="7"></line><line x1="17" y1="17" x2="18.8" y2="18.8"></line><line x1="5.2" y1="18.8" x2="7" y2="17"></line><line x1="17" y1="7" x2="18.8" y2="5.2"></line></g></svg>';
  var ICON_MOON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.5 14.2A8 8 0 0 1 9.8 3.5a8.2 8.2 0 1 0 10.7 10.7z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"></path></svg>';
  var THEME_KEY = "miaandpaperTheme";

  var templateLabels = {
    "media-list": "Imagem + 2 linhas",
    "text-grid": "Texto em grelha",
    "price-pack-grid": "Packs/preços",
    "quantity-builder": "Pack + quantidades",
    "design-grid": "Grelha de designs",
    "lamination-choice": "Laminação",
    "purchase-option": "Opções de compra",
    "cover-personalization": "Personalização da capa",
    "details-form": "Formulário",
    "confirm": "Confirmação"
  };

  var wizardHistoryReady = false;
  var wizardHistoryEntries = [];
  var wizardHistoryIndex = -1;
  var wizardHistoryNextId = 1;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  var miaSlotDebugFlatKeys = ["imageZoom", "imagePositionX", "imagePositionY", "imageRotation"];
  var miaSlotDebugSideFlatKeys = ["sideImageZoom", "sideImagePositionX", "sideImagePositionY", "sideImageRotation"];
  var miaSlotDebugFrameKeys = ["frameScale", "frameWidth", "frameHeight", "frameMarginX", "frameMarginY"];
  var miaSlotDebugSideFrameKeys = ["sideFrameScale", "sideFrameWidth", "sideFrameHeight", "sideFrameMarginX", "sideFrameMarginY"];

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

  function loadJson(path) {
    return fetch(path, { cache: "no-store" }).then(function (response) {
      if (!response.ok) {
        throw new Error("Não foi possível carregar " + path);
      }
      return response.json();
    });
  }

  function validHex(value) {
    return /^#[0-9a-fA-F]{6}$/.test(String(value || "").trim());
  }

  function themeValue(theme, key, fallback) {
    var value = theme && theme[key] != null ? String(theme[key]).trim() : "";
    return validHex(value) ? value : fallback;
  }

  function clampNumber(value, fallback, min, max) {
    var number = Number(value);

    if (!Number.isFinite(number)) {
      number = fallback;
    }

    return Math.max(min, Math.min(max, number));
  }

  function truthyVisibility(value) {
    var text;

    if (value == null) {
      return true;
    }

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value !== 0;
    }

    text = String(value).trim().toLowerCase();

    return ["false", "0", "no", "nao", "não", "off", "hidden", "oculto", "invisivel", "invisível"].indexOf(text) === -1;
  }

  function homeCategoryIsVisible(category) {
    if (!category || !Object.prototype.hasOwnProperty.call(category, "available")) {
      return true;
    }

    return truthyVisibility(category.available);
  }

  // HOMEPAGE_CAROUSEL_DARKMODE_V1_OFFICIAL_SITE: marcador para confirmar via
  // DevTools → Network → app.js → Response que esta versao tem (1) ordem
  // aleatoria do carrossel da homepage por carregamento, (2) settings de
  // carrossel por cartao, (3) toggle global "mostrar numeros 01/02..." e
  // (4) botao de dark mode no header.
  function ensureHomeCategoryDefaults(category) {
    if (!category || typeof category !== "object") {
      return;
    }

    if (typeof category.carouselEnabled !== "boolean") {
      category.carouselEnabled = true;
    }
    if (typeof category.carouselRandomizeOnLoad !== "boolean") {
      category.carouselRandomizeOnLoad = true;
    }
    if (typeof category.clickable !== "boolean") {
      category.clickable = true;
    }
    category.carouselIntervalMs = clampNumber(category.carouselIntervalMs, 3500, 800, 30000);
  }

  function ensureHomeSettings(home) {
    if (!home.theme || typeof home.theme !== "object") {
      home.theme = {};
    }

    if (!home.carousel || typeof home.carousel !== "object") {
      home.carousel = {};
    }

    if (!home.butterfly || typeof home.butterfly !== "object") {
      home.butterfly = {};
    }

    if (typeof home.showCategoryNumbers !== "boolean") {
      home.showCategoryNumbers = false;
    }

    if (typeof home.showThemeToggle !== "boolean") {
      home.showThemeToggle = false;
    }

    if (Array.isArray(home.categories)) {
      home.categories.forEach(ensureHomeCategoryDefaults);
    }

    home.theme.paper = themeValue(home.theme, "paper", "#fff8df");
    home.theme.card = themeValue(home.theme, "card", "#fffdf5");
    home.theme.linen = themeValue(home.theme, "linen", "#f6e7bf");
    home.theme.sage = themeValue(home.theme, "sage", "#d6bf77");
    home.theme.moss = themeValue(home.theme, "moss", "#72551e");
    home.theme.ink = themeValue(home.theme, "ink", "#2e2413");
    home.theme.muted = themeValue(home.theme, "muted", "#7f6b42");
    home.theme.gold = themeValue(home.theme, "gold", "#d7aa36");
    home.theme.goldSoft = themeValue(home.theme, "goldSoft", "#f4dd91");
    home.theme.rose = themeValue(home.theme, "rose", "#c58a72");
    home.theme.blue = themeValue(home.theme, "blue", "#9a8656");
    home.theme.buttonBg = themeValue(home.theme, "buttonBg", home.theme.moss);
    home.theme.buttonText = themeValue(home.theme, "buttonText", "#fffdf8");

    home.carousel.enabled = home.carousel.enabled !== false;
    home.carousel.speedSeconds = clampNumber(home.carousel.speedSeconds, 8, 3, 30);
    home.carousel.zoomPercent = clampNumber(home.carousel.zoomPercent, 108, 100, 140);
    home.carousel.panPercent = clampNumber(home.carousel.panPercent, 6, 0, 18);
    home.carousel.overlayOpacity = clampNumber(home.carousel.overlayOpacity, 36, 0, 80);

    home.butterfly.enabled = home.butterfly.enabled !== false;
    home.butterfly.idleSeconds = clampNumber(home.butterfly.idleSeconds, 10, 3, 60);
    home.butterfly.maxVisible = Math.round(clampNumber(home.butterfly.maxVisible, 3, 1, 3));
    home.butterfly.restSeconds = clampNumber(home.butterfly.restSeconds, 12, 2, 45);
    home.butterfly.size = clampNumber(home.butterfly.size, 54, 34, 90);
    home.butterfly.wingColorA = themeValue(home.butterfly, "wingColorA", "#e7d3be");
    home.butterfly.wingColorB = themeValue(home.butterfly, "wingColorB", "#d8b686");
    home.butterfly.wingColorC = themeValue(home.butterfly, "wingColorC", "#f3e8d8");
    home.butterfly.bodyColor = themeValue(home.butterfly, "bodyColor", "#8a7058");

    return home;
  }

  function applySiteSettings(home) {
    var root = document.documentElement;
    var theme;

    if (!home) {
      return;
    }

    ensureHomeSettings(home);
    theme = home.theme || {};

    root.style.setProperty("--paper", theme.paper);
    root.style.setProperty("--card", theme.card);
    root.style.setProperty("--linen", theme.linen);
    root.style.setProperty("--sage", theme.sage);
    root.style.setProperty("--moss", theme.moss);
    root.style.setProperty("--ink", theme.ink);
    root.style.setProperty("--muted", theme.muted);
    root.style.setProperty("--gold", theme.gold);
    root.style.setProperty("--gold-soft", theme.goldSoft);
    root.style.setProperty("--rose", theme.rose);
    root.style.setProperty("--blue", theme.blue);
    root.style.setProperty("--button-bg", theme.buttonBg);
    root.style.setProperty("--button-text", theme.buttonText);

    if (home.butterfly) {
      root.style.setProperty("--butterfly-size", home.butterfly.size + "px");
      root.style.setProperty("--butterfly-wing-a", home.butterfly.wingColorA);
      root.style.setProperty("--butterfly-wing-b", home.butterfly.wingColorB);
      root.style.setProperty("--butterfly-wing-c", home.butterfly.wingColorC);
      root.style.setProperty("--butterfly-body", home.butterfly.bodyColor);
      state.butterflySettings = cloneProduct(home.butterfly);
    }

    if (theme.backgroundImage) {
      root.style.setProperty("--site-bg-image", 'url("' + String(theme.backgroundImage).replace(/"/g, "%22") + '")');
      document.body.classList.add("has-site-background");
    } else {
      root.style.removeProperty("--site-bg-image");
      document.body.classList.remove("has-site-background");
    }

    applyThemeToggleVisibility(home.showThemeToggle === true);
  }

  function applyThemeToggleVisibility(visible) {
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      button.hidden = !visible;
      button.setAttribute("aria-hidden", visible ? "false" : "true");
    });
  }

  function slugFromHref(href) {
    var clean = String(href || "").split("?")[0].split("#")[0];
    var match = clean.match(/([^\/]+)\.html$/i);
    return match ? match[1] : "";
  }

  function homeCarouselImagesFromProduct(product) {
    var step = product && product.steps && product.steps[0] ? product.steps[0] : null;
    var images = [];
    var onlyPrimaryImages = product && product.slug === "cadernos";

    (step && step.items ? step.items : []).forEach(function (item) {
      if (item && item.image && images.indexOf(item.image) === -1) {
        images.push(item.image);
      }
      if (!onlyPrimaryImages && item && Array.isArray(item.interiorImages)) {
        item.interiorImages.forEach(function (image) {
          if (image && images.indexOf(image) === -1) {
            images.push(image);
          }
        });
      }
    });

    return images.slice(0, 12);
  }

  function enrichHomeWithCarousels(home) {
    ensureHomeSettings(home);

    return Promise.all((home.categories || []).map(function (category) {
      var slug = slugFromHref(category.href);

      if (!slug) {
        category.carouselImages = [];
        return category;
      }

      return loadJson("content/products/" + slug + ".json").then(function (product) {
        category.carouselImages = homeCarouselImagesFromProduct(product);
        return category;
      }).catch(function () {
        category.carouselImages = [];
        return category;
      });
    })).then(function () {
      return home;
    });
  }

  function clearHomeCarousels() {
    state.homeCarouselTimers.forEach(function (timer) {
      window.clearInterval(timer);
      window.clearTimeout(timer);
    });
    state.homeCarouselTimers = [];
  }

  function startHomeCarousels(home) {
    var carousel = home && home.carousel ? home.carousel : {};
    var globalSpeedMs = Math.max(3, Math.min(30, Number(carousel.speedSeconds) || 8)) * 1000;
    var globalEnabled = carousel.enabled !== false;

    clearHomeCarousels();

    var carouselElements = Array.prototype.slice.call(document.querySelectorAll("[data-home-carousel]"));

    carouselElements.forEach(function (element, carouselIndex) {
      var frames = Array.prototype.slice.call(element.querySelectorAll(".category-carousel-frame"));
      var card = element.closest(".category-card");
      var categoryId = card && card.dataset ? card.dataset.categoryId : "";
      var category = categoryId && Array.isArray(home.categories)
        ? home.categories.filter(function (c) { return c.id === categoryId; })[0]
        : null;
      var speed = globalSpeedMs;
      var enabled = globalEnabled;
      var index = 0;
      var timer;
      var phaseDelay;
      var jitter;

      if (category) {
        if (typeof category.carouselEnabled === "boolean") {
          enabled = enabled && category.carouselEnabled;
        }
        if (typeof category.carouselIntervalMs === "number" && isFinite(category.carouselIntervalMs)) {
          speed = Math.max(800, Math.min(30000, category.carouselIntervalMs));
        }
      }

      if (frames.length <= 1 || !enabled) {
        return;
      }

      frames.forEach(function (frame, frameIndex) {
        frame.classList.toggle("is-active", frameIndex === 0);
      });

      // HOME_CAROUSEL_WAVE_V1: as categorias deixam de trocar todas ao mesmo
      // tempo. A fase segue a ordem dos cartões, com um pequeno jitter
      // determinístico por categoria. Fica tipo "wave": relacionado, mas não
      // perfeitamente sincronizado nem totalmente aleatório.
      jitter = categoryId ? categoryId.split("").reduce(function (sum, ch) { return sum + ch.charCodeAt(0); }, 0) % 420 : 0;
      phaseDelay = Math.round((speed / Math.max(1, carouselElements.length)) * carouselIndex + jitter);
      phaseDelay = Math.max(0, Math.min(speed - 250, phaseDelay));

      timer = window.setTimeout(function () {
        frames[index].classList.remove("is-active");
        index = (index + 1) % frames.length;
        frames[index].classList.add("is-active");

        timer = window.setInterval(function () {
          frames[index].classList.remove("is-active");
          index = (index + 1) % frames.length;
          frames[index].classList.add("is-active");
        }, speed);
        state.homeCarouselTimers.push(timer);
      }, phaseDelay);
      state.homeCarouselTimers.push(timer);
    });
  }

  function clearHomeDeadlineCountdown() {
    if (state.homeDeadlineTimer) {
      window.clearInterval(state.homeDeadlineTimer);
      state.homeDeadlineTimer = null;
    }
  }

  function padDeadlineNumber(value) {
    return String(Math.max(0, value || 0)).padStart(2, "0");
  }

  function setDeadlineRing(unit, angle) {
    if (unit) {
      unit.style.setProperty("--deadline-ring-angle", Math.max(0, Math.min(360, angle || 0)) + "deg");
    }
  }

  function startHomeDeadlineCountdown() {
    var element = document.querySelector("[data-home-deadline-countdown]");
    var targetValue = element && element.dataset ? element.dataset.deadlineTarget : "";
    var target = targetValue ? new Date(targetValue) : null;

    clearHomeDeadlineCountdown();

    if (!element || !target || isNaN(target.getTime())) {
      return;
    }

    function update() {
      var diff = Math.max(0, target.getTime() - Date.now());
      var totalSeconds = Math.floor(diff / 1000);
      var days = Math.floor(totalSeconds / 86400);
      var hours = Math.floor((totalSeconds % 86400) / 3600);
      var minutes = Math.floor((totalSeconds % 3600) / 60);
      var seconds = totalSeconds % 60;
      var daysUnit = element.querySelector('[data-deadline-unit="days"]');
      var hoursUnit = element.querySelector('[data-deadline-unit="hours"]');
      var minutesUnit = element.querySelector('[data-deadline-unit="minutes"]');
      var secondsUnit = element.querySelector('[data-deadline-unit="seconds"]');

      if (daysUnit) {
        daysUnit.querySelector("[data-deadline-value]").textContent = padDeadlineNumber(days);
        setDeadlineRing(daysUnit, days > 0 ? 300 : 0);
      }
      if (hoursUnit) {
        hoursUnit.querySelector("[data-deadline-value]").textContent = padDeadlineNumber(hours);
        setDeadlineRing(hoursUnit, hours / 24 * 360);
      }
      if (minutesUnit) {
        minutesUnit.querySelector("[data-deadline-value]").textContent = padDeadlineNumber(minutes);
        setDeadlineRing(minutesUnit, minutes / 60 * 360);
      }
      if (secondsUnit) {
        secondsUnit.querySelector("[data-deadline-value]").textContent = padDeadlineNumber(seconds);
        setDeadlineRing(secondsUnit, seconds / 60 * 360);
      }
    }

    update();
    state.homeDeadlineTimer = window.setInterval(update, 1000);
  }

  function cloneProduct(product) {
    return JSON.parse(JSON.stringify(product));
  }

  // FUNNEL_TRACKING_V1
  // Helpers leves para tracking próprio do funil de encomenda. Sem
  // dependências externas, sem analytics de terceiros. Os eventos vão por
  // navigator.sendBeacon (com fallback fetch keepalive) para
  // track-order-event.php. Cada erro é silencioso — nunca bloqueia a UI
  // nem a encomenda.
  var FUNNEL_ENDPOINT = "track-order-event.php";
  var FUNNEL_SESSION_KEY = "mp_funnel_session_v1";
  var FUNNEL_CONTACT_STARTED_FLAG = "mp_funnel_contact_started_v1";
  // ORIGINAL_ATTRIBUTION_V1 (Phase 3)
  var FUNNEL_ATTRIBUTION_KEY = "mp_funnel_attribution_v1";
  var FUNNEL_SITE_LANDED_FLAG = "mp_funnel_site_landed_v1";
  // SELECTION_SNAPSHOT_V1 (Phase 4)
  var FUNNEL_SELECTION_DEBOUNCE_MS = 800;
  var funnelSelectionDebounceTimer = null;
  var funnelLastSelectionSignature = "";
  var funnelSelectionByStepFired = {};
  // HEARTBEAT_V1 (Phase 6)
  var FUNNEL_HEARTBEAT_INTERVAL_MS = 45000;
  var FUNNEL_HEARTBEAT_IDLE_LIMIT_MS = 10 * 60 * 1000;
  var funnelHeartbeatTimer = null;
  var funnelHeartbeatLastUserAt = Date.now();
  // TRANSITION_REASON_V1 (Phase 7)
  var funnelNextTransitionReason = null;
  // MAGNIFIER_TRACKING_V1 (Phase 5) — pequeno cache para correlacionar com selecções
  var funnelLastMagnified = null;
  // REPLAY_FIELDS_V1 (Phase B): page_instance_id + client_event_index
  // page_instance_id: fresh per page load (NOT in sessionStorage — different tabs differ)
  // client_event_index: incrementing counter for this page instance
  var FUNNEL_PAGE_INSTANCE_ID = (function () {
    var t = Date.now().toString(36).slice(-4);
    var r = Math.random().toString(36).slice(2, 8);
    return "pg_" + t + r;
  })();
  var funnelClientEventIndex = 0;
  // SEMANTIC_EVENTS_V1 (Phase C): dedupe — não disparar design_selected duas
  // vezes seguidas para o mesmo design.
  var funnelLastDesignSig = "";
  var funnelLastOptionSig = {};

  function funnelGenerateId() {
    var t = Date.now().toString(36);
    var r = Math.random().toString(36).slice(2, 10);
    return t + "-" + r;
  }

  function funnelLoadSession() {
    try {
      var raw = window.sessionStorage.getItem(FUNNEL_SESSION_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.id) return parsed;
      }
    } catch (err) { /* ignore */ }
    return null;
  }

  function funnelSession() {
    var session = funnelLoadSession();
    if (!session) {
      session = {
        id: funnelGenerateId(),
        startedAt: Date.now(),
        lastEventAt: Date.now()
      };
      try { window.sessionStorage.setItem(FUNNEL_SESSION_KEY, JSON.stringify(session)); } catch (err) {}
    }
    return session;
  }

  function funnelSaveSession(session) {
    try {
      window.sessionStorage.setItem(FUNNEL_SESSION_KEY, JSON.stringify(session));
    } catch (err) { /* ignore */ }
  }

  function funnelDeviceType() {
    try {
      if (window.matchMedia && window.matchMedia('(max-width: 600px)').matches) return 'mobile';
    } catch (err) {}
    if (/Mobi|Android/i.test(navigator.userAgent || '')) return 'mobile';
    return 'desktop';
  }

  // FUNNEL_TRACKING_SQLITE_V2: payload alargado com viewport/screen/DPR/
  // orientation/network/timing. NÃO inclui nome, email, telefone ou
  // qualquer texto introduzido em campos pessoais — esses dados ficam só
  // em `orders` (necessários para processar a encomenda).
  function funnelExtraContext() {
    var ctx = {};
    try {
      ctx.viewport_width = window.innerWidth || 0;
      ctx.viewport_height = window.innerHeight || 0;
    } catch (e) {}
    try {
      if (window.screen) {
        ctx.screen_width = window.screen.width || 0;
        ctx.screen_height = window.screen.height || 0;
      }
    } catch (e) {}
    try { ctx.device_pixel_ratio = window.devicePixelRatio || 1; } catch (e) {}
    try {
      var orient = '';
      if (window.screen && window.screen.orientation && window.screen.orientation.type) {
        orient = String(window.screen.orientation.type);
      } else if (window.matchMedia) {
        orient = window.matchMedia('(orientation: portrait)').matches ? 'portrait-primary' : 'landscape-primary';
      }
      ctx.orientation = orient;
    } catch (e) {}
    try { ctx.max_touch_points = (navigator && navigator.maxTouchPoints) || 0; } catch (e) {}
    try { ctx.language = (navigator && navigator.language) || ''; } catch (e) {}
    try {
      ctx.timezone = (Intl && Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions().timeZone) || '';
    } catch (e) {}
    try {
      if (navigator && navigator.connection) {
        ctx.connection_effective_type = navigator.connection.effectiveType || '';
        ctx.save_data = navigator.connection.saveData ? 1 : 0;
      }
    } catch (e) {}
    return ctx;
  }

  // ORIGINAL_ATTRIBUTION_V1 (Phase 3) — guarda na 1ª visita; reutiliza depois.
  function funnelReadAttribution() {
    try {
      var raw = window.sessionStorage.getItem(FUNNEL_ATTRIBUTION_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {}
    return null;
  }

  function funnelGetAttribution() {
    var stored = funnelReadAttribution();
    if (stored) return stored;

    var attribution = {};
    try {
      attribution.first_landing_page = (location && location.pathname) || '';
      attribution.first_url = (location && location.href) ? String(location.href).slice(0, 320) : '';
      attribution.first_referrer = document.referrer || '';
    } catch (e) {}
    try {
      var qs = (location && location.search) ? location.search : '';
      if (qs && qs.length > 1) {
        var params = new URLSearchParams(qs);
        var paramKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
        for (var i = 0; i < paramKeys.length; i++) {
          var v = params.get(paramKeys[i]);
          if (v && typeof v === 'string') attribution[paramKeys[i]] = v.slice(0, 120);
        }
      }
    } catch (e) {}
    try { window.sessionStorage.setItem(FUNNEL_ATTRIBUTION_KEY, JSON.stringify(attribution)); } catch (e) {}
    return attribution;
  }

  function funnelAttributionFields() {
    var attribution = funnelGetAttribution();
    var fields = {};
    if (!attribution) return fields;
    ['first_landing_page', 'first_url', 'first_referrer',
     'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
     'fbclid', 'gclid'].forEach(function (k) {
      if (attribution[k]) fields[k] = String(attribution[k]).slice(0, 320);
    });
    return fields;
  }

  // REPLAY_FIELDS_V1 (Phase B): classifica referrer no cliente. Devolve
  // {referrer_type, external_referrer}. Tudo opcional — servidor reclassifica
  // se vier vazio.
  function funnelClassifyReferrerClient(attribution) {
    var refType = 'unknown';
    var externalRef = '';
    try {
      var utm = (attribution && attribution.utm_source) ? String(attribution.utm_source).toLowerCase() : '';
      var firstRef = (attribution && attribution.first_referrer) ? String(attribution.first_referrer) : '';
      var curRef = document.referrer || '';
      var candidate = firstRef || curRef || '';
      var candidateLower = candidate.toLowerCase();

      function classifyToken(t) {
        if (!t) return '';
        if (t.indexOf('instagram') !== -1 || t === 'ig') return 'instagram';
        if (t.indexOf('facebook') !== -1 || t === 'fb' || t.indexOf('meta') !== -1) return 'facebook';
        if (t.indexOf('whatsapp') !== -1 || t === 'wa') return 'whatsapp';
        if (t.indexOf('google') !== -1) return 'google';
        if (t.indexOf('tiktok') !== -1) return 'tiktok';
        if (t.indexOf('youtube') !== -1) return 'youtube';
        if (t.indexOf('email') !== -1 || t.indexOf('newsletter') !== -1) return 'email';
        return '';
      }
      function classifyUrl(url) {
        if (!url) return '';
        if (url.indexOf('miaandpaper.com') !== -1) return 'internal';
        if (url.indexOf('localhost') !== -1 || url.indexOf('127.0.0.1') !== -1) return 'internal';
        if (url.indexOf('/admin-funnel.php') !== -1 || url.indexOf('/admin-live-dashboard.php') !== -1 || url.indexOf('/admin-orders.php') !== -1) return 'internal_admin';
        if (url.indexOf('instagram') !== -1) return 'instagram';
        if (url.indexOf('facebook') !== -1 || url.indexOf('fb.com') !== -1) return 'facebook';
        if (url.indexOf('whatsapp') !== -1 || url.indexOf('wa.me') !== -1) return 'whatsapp';
        if (url.indexOf('google.') !== -1) return 'google';
        if (url.indexOf('tiktok') !== -1) return 'tiktok';
        if (url.indexOf('youtube') !== -1 || url.indexOf('youtu.be') !== -1) return 'youtube';
        if (url.indexOf('bing.com') !== -1) return 'bing';
        return '';
      }

      if (utm) refType = classifyToken(utm) || 'unknown';
      else if (candidateLower) refType = classifyUrl(candidateLower) || 'unknown';
      else refType = 'direct';

      // external_referrer: só se NÃO for interno
      if (candidate && refType !== 'internal' && refType !== 'internal_admin') {
        externalRef = candidate.slice(0, 240);
      }
    } catch (e) {}
    return { referrer_type: refType, external_referrer: externalRef };
  }

  function trackOrderEvent(eventName, data) {
    try {
      if (!eventName) return;
      var session = funnelSession();
      var now = Date.now();
      funnelClientEventIndex++;
      var base = {
        session_id: session.id,
        event_name: String(eventName),
        device_type: funnelDeviceType(),
        landing_page: (location && location.pathname) || '',
        referrer: document.referrer || '',
        seconds_since_session_start: Math.max(0, Math.round((now - (session.startedAt || now)) / 1000)),
        seconds_since_previous_event: session.lastEventAt ? Math.max(0, Math.round((now - session.lastEventAt) / 1000)) : 0,
        // REPLAY_FIELDS_V1
        page_instance_id: FUNNEL_PAGE_INSTANCE_ID,
        client_event_index: funnelClientEventIndex,
        timestamp_ms: now
      };
      // Junta dados de dispositivo/viewport — sem PII.
      var extra = funnelExtraContext();
      Object.keys(extra).forEach(function (k) { base[k] = extra[k]; });
      // ORIGINAL_ATTRIBUTION_V1: re-envia atribuição original em todos os eventos.
      var attribution = funnelAttributionFields();
      Object.keys(attribution).forEach(function (k) { base[k] = attribution[k]; });
      // REPLAY_FIELDS_V1: referrer_type + external_referrer
      var refInfo = funnelClassifyReferrerClient(attribution);
      if (refInfo.referrer_type) base.referrer_type = refInfo.referrer_type;
      if (refInfo.external_referrer) base.external_referrer = refInfo.external_referrer;
      // HEARTBEAT_V1: estado de visibilidade da página, ajuda a distinguir activo vs idle.
      try { base.is_visible = document.hidden ? 0 : 1; } catch (e) {}
      session.lastEventAt = now;
      funnelSaveSession(session);

      var payload = base;
      if (data && typeof data === 'object') {
        Object.keys(data).forEach(function (key) {
          if (data[key] === undefined || data[key] === null || data[key] === '') return;
          payload[key] = data[key];
        });
      }

      var body = JSON.stringify(payload);

      // sendBeacon é preferido — sobrevive a unload; fetch keepalive como
      // fallback (Safari < 13 não tem sendBeacon).
      if (navigator && typeof navigator.sendBeacon === 'function') {
        try {
          var blob = new Blob([body], { type: 'application/json' });
          if (navigator.sendBeacon(FUNNEL_ENDPOINT, blob)) {
            return;
          }
        } catch (err) { /* fallthrough */ }
      }

      if (window.fetch) {
        window.fetch(FUNNEL_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true,
          credentials: 'same-origin'
        }).catch(function () { /* silent */ });
      }
    } catch (err) {
      /* falha silenciosa: tracking não pode quebrar encomenda */
    }
  }

  // Helper que injecta o contexto do produto e selecções actuais.
  function trackProductEvent(product, eventName, extra) {
    if (!product) return;
    var data = {
      product_slug: product.slug || '',
      product_type: product.slug || '',
      selected_pack: state.selections.pack_quantity || undefined,
      selected_size: state.selections.size || '',
      selected_delivery: state.selections.delivery_option || ''
    };
    if (extra && typeof extra === 'object') {
      Object.keys(extra).forEach(function (key) { data[key] = extra[key]; });
    }
    trackOrderEvent(eventName, data);
  }

  // SELECTION_SNAPSHOT_V1 (Phase 4)
  // Constrói um snapshot leve das selecções actuais para enviar como
  // selection_json. NÃO inclui texto de personalização nem nada PII.
  // Funciona para todos os produtos, mas adapta-se aos cadernos.
  function funnelBuildSelectionSnapshot(product) {
    if (!product) return null;
    var sel = state.selections || {};
    var snap = {};
    try {
      // Designs seleccionados — pode ser array (multi) OU string (single).
      // SELECTION_SNAPSHOT_V2 (Phase C / inspection finding): cadernos usa
      // single-select para capa, então sel.designs é uma string. Antes não
      // estava a ser capturada — por isso "Interesse" não mostrava capas.
      if (Array.isArray(sel.designs)) {
        snap.selected_designs = sel.designs.slice(0, 40).map(function (v) { return String(v).slice(0, 80); });
        snap.selection_count = sel.designs.length;
      } else if (typeof sel.designs === 'string' && sel.designs !== '') {
        snap.selected_designs = [String(sel.designs).slice(0, 80)];
        snap.selection_count = 1;
        snap.selected_cover = String(sel.designs).slice(0, 80);
      }
      if (sel.assorted_designs === "1") snap.assorted = 1;
      if (sel.pack_quantity) snap.selected_pack = Number(sel.pack_quantity) || 0;
      if (sel.size) snap.selected_size = String(sel.size).slice(0, 60);
      if (sel.delivery_option) snap.selected_delivery = String(sel.delivery_option).slice(0, 60);

      // Cadernos: extras específicos.
      try {
        if (typeof isCadernosProduct === 'function' && isCadernosProduct(product)) {
          if (typeof selectedCadernoLamination === 'function') {
            var lam = selectedCadernoLamination(product);
            if (lam && lam.id) snap.lamination = String(lam.id).slice(0, 60);
          }
          if (typeof selectedCadernoPurchaseOption === 'function') {
            var opt = selectedCadernoPurchaseOption(product);
            if (opt && opt.id) snap.caderno_option = String(opt.id).slice(0, 60);
          }
          if (sel.caderno_order_quantity) snap.caderno_qty = Number(sel.caderno_order_quantity) || 0;
          // Personalização (yes/no) sem texto.
          if (sel.cover_personalization) snap.cover_personalization = sel.cover_personalization === 'yes' ? 1 : 0;
          // Cover title (se houver dados de produto) — label estático, não PII.
          try {
            if (typeof sel.designs === 'string' && sel.designs !== '' && product.steps) {
              for (var si = 0; si < product.steps.length; si++) {
                var st = product.steps[si];
                if (st && st.id === 'designs' && Array.isArray(st.items)) {
                  for (var ii = 0; ii < st.items.length; ii++) {
                    var item = st.items[ii];
                    if (item && (item.value === sel.designs || item.id === sel.designs)) {
                      if (item.title) snap.selected_cover_title = String(item.title).slice(0, 80);
                      break;
                    }
                  }
                  break;
                }
              }
            }
          } catch (e2) {}
        }
      } catch (e) {}
    } catch (e) {}
    if (Object.keys(snap).length === 0) return null;
    return snap;
  }

  // SEMANTIC_EVENTS_V1 (Phase C): helper para encontrar o título estático de
  // um item por value/id dentro de uma step do produto. Sem PII (lê do JSON).
  function funnelFindItemInStep(product, stepId, value) {
    try {
      if (!product || !Array.isArray(product.steps)) return null;
      for (var i = 0; i < product.steps.length; i++) {
        var st = product.steps[i];
        if (!st || st.id !== stepId || !Array.isArray(st.items)) continue;
        for (var j = 0; j < st.items.length; j++) {
          var it = st.items[j];
          if (it && (it.value === value || it.id === value)) return it;
        }
      }
    } catch (e) {}
    return null;
  }

  // Dispara design_selected (ou unselected). Cap de PII — só estático.
  function trackDesignToggle(product, designValue, isSelected) {
    if (!product || !designValue) return;
    try {
      var stepInfo = currentStepInfoForTracking();
      var item = funnelFindItemInStep(product, 'designs', designValue);
      var snapshot = funnelBuildSelectionSnapshot(product);
      var imgSrc = '';
      if (item && item.image && typeof item.image === 'string') {
        // Limita a paths locais relativos — nunca aceitar absoluto/URL.
        if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(item.image) && item.image.indexOf('..') === -1) {
          imgSrc = item.image.slice(0, 240);
        }
      }
      var data = {
        product_slug: stepInfo.product_slug,
        product_type: stepInfo.product_slug,
        step_id: stepInfo.step_id || 'designs',
        step_index: stepInfo.step_index,
        design_id: String(designValue).slice(0, 80),
        item_id: String(designValue).slice(0, 80)
      };
      if (item && item.title) data.design_title = String(item.title).slice(0, 120);
      if (imgSrc) data.image_src = imgSrc;
      if (snapshot) data.selection_json = snapshot;
      trackOrderEvent(isSelected ? 'design_selected' : 'design_unselected', data);
    } catch (e) {}
  }

  // Dispara option_selected (lamination, pack, size, delivery, personalization, purchase_option).
  function trackOptionSelected(product, optionType, optionValue, optionLabel) {
    if (!product || !optionType || optionValue === '' || optionValue == null) return;
    try {
      var sig = optionType + '=' + String(optionValue);
      if (funnelLastOptionSig[optionType] === sig) return; // dedupe
      funnelLastOptionSig[optionType] = sig;
      var stepInfo = currentStepInfoForTracking();
      var snapshot = funnelBuildSelectionSnapshot(product);
      var data = {
        product_slug: stepInfo.product_slug,
        product_type: stepInfo.product_slug,
        step_id: stepInfo.step_id,
        step_index: stepInfo.step_index,
        option_type: String(optionType).slice(0, 32),
        option_value: String(optionValue).slice(0, 120)
      };
      if (optionLabel) data.option_label = String(optionLabel).slice(0, 120);
      if (snapshot) data.selection_json = snapshot;
      trackOrderEvent('option_selected', data);
    } catch (e) {}
  }

  function funnelSelectionSignature(snapshot) {
    try { return snapshot ? JSON.stringify(snapshot) : ''; } catch (e) { return ''; }
  }

  // Dispara selection_updated com debounce, só se mudou desde a última.
  function maybeTrackSelectionUpdated(product, stepId) {
    if (!product) return;
    try {
      if (funnelSelectionDebounceTimer) {
        clearTimeout(funnelSelectionDebounceTimer);
        funnelSelectionDebounceTimer = null;
      }
      funnelSelectionDebounceTimer = setTimeout(function () {
        try {
          var snap = funnelBuildSelectionSnapshot(product);
          var sig = funnelSelectionSignature(snap);
          if (!snap || sig === funnelLastSelectionSignature) return;
          funnelLastSelectionSignature = sig;
          trackProductEvent(product, 'selection_updated', {
            step_id: stepId || '',
            selection_count: snap.selection_count || (snap.selected_designs ? snap.selected_designs.length : 0),
            selection_json: snap
          });
        } catch (e) {}
      }, FUNNEL_SELECTION_DEBOUNCE_MS);
    } catch (e) {}
  }

  // Snapshot completo ao sair de um passo (mesmo que igual ao anterior).
  function trackStepSelectionSnapshot(product, stepId) {
    if (!product) return;
    try {
      var snap = funnelBuildSelectionSnapshot(product);
      if (!snap) return;
      var key = (product.slug || '') + '|' + (stepId || '');
      if (funnelSelectionByStepFired[key] === funnelSelectionSignature(snap)) return;
      funnelSelectionByStepFired[key] = funnelSelectionSignature(snap);
      trackProductEvent(product, 'step_selection_snapshot', {
        step_id: stepId || '',
        selection_count: snap.selection_count || (snap.selected_designs ? snap.selected_designs.length : 0),
        selection_json: snap
      });
    } catch (e) {}
  }

  // HEARTBEAT_V1 (Phase 6)
  function funnelHeartbeatTouchUser() {
    funnelHeartbeatLastUserAt = Date.now();
  }

  function startFunnelHeartbeat(product) {
    try {
      if (funnelHeartbeatTimer) return;
      if (!product) return;
      funnelHeartbeatTimer = setInterval(function () {
        try {
          if (document.hidden) return; // só com tab visível
          if (Date.now() - funnelHeartbeatLastUserAt > FUNNEL_HEARTBEAT_IDLE_LIMIT_MS) return;
          var stepInfo = currentStepInfoForTracking();
          trackProductEvent(product, 'heartbeat', {
            step_id: stepInfo.step_id,
            step_index: stepInfo.step_index
          });
        } catch (e) {}
      }, FUNNEL_HEARTBEAT_INTERVAL_MS);
      ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(function (evt) {
        try { document.addEventListener(evt, funnelHeartbeatTouchUser, { passive: true, capture: true }); } catch (e) {
          try { document.addEventListener(evt, funnelHeartbeatTouchUser, true); } catch (e2) {}
        }
      });
    } catch (e) {}
  }

  // MAGNIFIER_TRACKING_V1 (Phase 5)
  // Identifica o "slot" da imagem a partir de pistas leves no URL/atributos
  // sem alterar o comportamento do magnifier existente.
  function funnelClassifyImageSlot(src, alt) {
    var s = String(src || '').toLowerCase();
    var a = String(alt || '').toLowerCase();
    if (/laminac|lamination/.test(s) || /lamin/.test(a)) return 'lamination_example';
    if (/interior/.test(s) || /interior/.test(a)) return 'interior';
    if (/capa|cover/.test(s) || /capa|cover/.test(a)) return 'cover';
    if (/iman|magnet/.test(s)) return 'marker';
    if (/pack/.test(s) || /pack/.test(a)) return 'pack';
    if (/process/.test(s)) return 'process';
    return 'main';
  }

  function funnelExtractDesignIdFromSrc(src) {
    // Heurística simples: nome do ficheiro sem extensão.
    try {
      var clean = String(src || '').split('?')[0];
      var parts = clean.split('/');
      var name = parts[parts.length - 1] || '';
      return name.replace(/\.[a-zA-Z0-9]+$/, '').slice(0, 80);
    } catch (e) { return ''; }
  }

  function trackMagnifierOpened(src, alt) {
    try {
      var product = state.product || null;
      var stepInfo = currentStepInfoForTracking();
      var designId = funnelExtractDesignIdFromSrc(src);
      var slot = funnelClassifyImageSlot(src, alt);
      var srcShort = String(src || '').slice(0, 240);
      funnelLastMagnified = { src: srcShort, design_id: designId, image_slot: slot, at: Date.now() };
      var snapshot = product ? funnelBuildSelectionSnapshot(product) : null;
      var data = {
        product_slug: stepInfo.product_slug,
        step_id: stepInfo.step_id,
        step_index: stepInfo.step_index,
        image_slot: slot,
        image_src: srcShort,
        design_id: designId,
        item_id: designId,
        target_label: String(alt || '').slice(0, 120)
      };
      if (snapshot) data.selection_json = snapshot;
      trackOrderEvent('image_magnified', data);
    } catch (e) {}
  }
  // Exposto para que openImageViewer possa chamar.
  window.__mpTrackMagnifierOpened = trackMagnifierOpened;

  // SITE_LANDED_V1 (Phase 3)
  // Dispara uma vez por sessão; também aplicado em index.html (page === 'home').
  function fireSiteLandedOnce() {
    try {
      if (window.sessionStorage.getItem(FUNNEL_SITE_LANDED_FLAG) === '1') return;
      window.sessionStorage.setItem(FUNNEL_SITE_LANDED_FLAG, '1');
    } catch (e) { /* ignore */ }
    try {
      // Garante que a atribuição é capturada antes do primeiro evento.
      funnelGetAttribution();
      trackOrderEvent('site_landed', {
        landing_page: (location && location.pathname) || '',
        page_load_type: 'first_session_event'
      });
    } catch (e) {}
  }
  // Pre-warm: lê / regista atribuição assim que possível (não envia evento).
  try { funnelGetAttribution(); } catch (e) {}

  // Marca contact_started apenas uma vez por sessão (chave em sessionStorage).
  function maybeFireContactStarted(product) {
    try {
      if (window.sessionStorage.getItem(FUNNEL_CONTACT_STARTED_FLAG) === '1') return;
      window.sessionStorage.setItem(FUNNEL_CONTACT_STARTED_FLAG, '1');
    } catch (err) { /* ignore */ }
    trackProductEvent(product, 'contact_started');
  }

  // Exposto globalmente para futuros pontos de instrumentação (admin etc.).
  window.trackOrderEvent = trackOrderEvent;

  // CLICK_TRACKING_V1: ui_interaction + dead_tap. Listener delegado no
  // document. Identifica o "target lógico" (button, label, link ou elemento
  // com data-track) e emite ui_interaction. Se o clique cair dentro do
  // wizard mas FORA de qualquer elemento interactivo, emite dead_tap com
  // rate-limit (máx 1/seg, ignora repetições próximas <40px).
  var INTERACTIVE_TAGS = { 'BUTTON': true, 'A': true, 'LABEL': true, 'INPUT': true, 'SELECT': true, 'TEXTAREA': true, 'SUMMARY': true };
  var lastDeadTapTime = 0;
  var lastDeadTapX = -1;
  var lastDeadTapY = -1;

  function findTrackTarget(el) {
    var node = el;
    while (node && node !== document.body) {
      if (node.dataset && node.dataset.track === 'true') return node;
      if (node.tagName && INTERACTIVE_TAGS[node.tagName]) return node;
      node = node.parentNode;
    }
    return null;
  }

  function readShortLabel(el) {
    if (!el) return '';
    if (el.dataset && el.dataset.trackLabel) return String(el.dataset.trackLabel).slice(0, 80);
    var t = (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title'))) || '';
    if (!t) {
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      t = text.slice(0, 60);
    }
    return t.slice(0, 80);
  }

  function guessTargetType(el) {
    if (!el || !el.tagName) return 'unknown';
    if (el.dataset && el.dataset.trackType) return el.dataset.trackType;
    var tag = el.tagName;
    if (tag === 'BUTTON') return 'button';
    if (tag === 'A') return 'link';
    if (tag === 'LABEL') return 'card';
    if (tag === 'INPUT') {
      var t = (el.type || '').toLowerCase();
      if (t === 'radio') return 'radio';
      if (t === 'checkbox') return 'checkbox';
      return 'input';
    }
    if (tag === 'SELECT') return 'select';
    return 'unknown';
  }

  function getWizardRoot() {
    return document.querySelector('.wizard-shell, #order-form, .product-shell');
  }

  function isInWizard(el) {
    var root = getWizardRoot();
    if (!root) return false;
    return root.contains(el);
  }

  function isInsideTextInput(el) {
    var node = el;
    while (node && node !== document.body) {
      if (node.tagName === 'INPUT') {
        var t = (node.type || '').toLowerCase();
        if (t !== 'radio' && t !== 'checkbox' && t !== 'submit' && t !== 'button') return true;
      }
      if (node.tagName === 'TEXTAREA') return true;
      node = node.parentNode;
    }
    return false;
  }

  function pointInPercent(event, root) {
    try {
      var rect = root.getBoundingClientRect();
      if (!rect.width || !rect.height) return { x: null, y: null };
      var x = Math.max(0, Math.min(100, Math.round(((event.clientX - rect.left) / rect.width) * 100)));
      var y = Math.max(0, Math.min(100, Math.round(((event.clientY - rect.top) / rect.height) * 100)));
      return { x: x, y: y };
    } catch (e) { return { x: null, y: null }; }
  }

  function currentStepInfoForTracking() {
    var prod = state.product || null;
    var step = prod ? currentStep(prod) : null;
    return {
      product_slug: prod && prod.slug || '',
      step_id: step && step.id || '',
      step_index: state.currentStep || 0
    };
  }

  function handleWizardClickTracking(event) {
    try {
      if (!state.product) return; // só nas páginas de produto
      var target = event.target;
      if (!target || !isInWizard(target)) return;

      var logical = findTrackTarget(target);
      var root = getWizardRoot();
      var pt = root ? pointInPercent(event, root) : { x: null, y: null };
      var info = currentStepInfoForTracking();

      if (logical) {
        // ui_interaction
        trackOrderEvent('ui_interaction', {
          product_slug: info.product_slug,
          step_id: info.step_id,
          step_index: info.step_index,
          interaction_type: 'click',
          target_type: guessTargetType(logical),
          target_id: (logical.dataset && (logical.dataset.trackId || logical.id)) || '',
          target_label: readShortLabel(logical),
          action_name: (logical.dataset && logical.dataset.trackAction) || '',
          x_percent: pt.x,
          y_percent: pt.y
        });
        return;
      }

      // dead_tap candidate. Skip se for dentro de input/textarea.
      if (isInsideTextInput(target)) return;

      var now = Date.now();
      if (now - lastDeadTapTime < 1000) return; // rate limit 1/seg
      if (pt.x !== null && lastDeadTapX !== -1) {
        var dx = Math.abs(pt.x - lastDeadTapX);
        var dy = Math.abs(pt.y - lastDeadTapY);
        if (dx < 5 && dy < 5) return; // skip near-duplicate
      }
      lastDeadTapTime = now;
      lastDeadTapX = pt.x;
      lastDeadTapY = pt.y;

      trackOrderEvent('dead_tap', {
        product_slug: info.product_slug,
        step_id: info.step_id,
        step_index: info.step_index,
        x_percent: pt.x,
        y_percent: pt.y,
        target_tag: (target.tagName || '').toLowerCase(),
        target_class: (target.className && typeof target.className === 'string' ? target.className.slice(0, 100) : '')
      });
    } catch (err) {
      /* silent — tracking não pode bloquear UX */
    }
  }

  document.addEventListener('click', handleWizardClickTracking, true);

  // OPEN_ORDER_HINT_V1
  // Verifica se existe encomenda aberta com o mesmo nome+contacto+IP via
  // POST a check-open-orders.php. Debounced 600ms. Só dispara quando os
  // dois campos têm comprimento mínimo. Cache curta na sessão por chave
  // (nome|contacto) para evitar requests duplicados.
  var OPEN_ORDER_ENDPOINT = "check-open-orders.php";
  var openOrderCheckTimer = null;

  function scheduleOpenOrderCheck(product) {
    if (openOrderCheckTimer) {
      clearTimeout(openOrderCheckTimer);
    }
    openOrderCheckTimer = setTimeout(function () {
      openOrderCheckTimer = null;
      runOpenOrderCheck(product);
    }, 600);
  }

  function runOpenOrderCheck(product) {
    var name = String(state.selections.customer_name || "").trim();
    var contact = String(state.selections.customer_contact || "").trim();
    if (name.length < 3 || contact.length < 4) {
      if (state.openOrderHint) {
        state.openOrderHint = false;
        rerenderProduct(product);
      }
      return;
    }

    var key = name + "|" + contact;
    if (key === state.openOrderHintLastQuery) {
      return; // já perguntámos
    }
    state.openOrderHintLastQuery = key;

    try {
      window.fetch(OPEN_ORDER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name: name, customer_contact: contact }),
        credentials: "same-origin"
      }).then(function (response) {
        return response.json();
      }).then(function (data) {
        var hint = data && data.has_possible_open_order === true;
        if (hint !== state.openOrderHint) {
          state.openOrderHint = hint;
          rerenderProduct(product);
        }
      }).catch(function () {
        /* silencioso — UX não pode quebrar por isto */
      });
    } catch (err) {
      /* silencioso */
    }
  }

  function pushUndo(product) {
    state.undoStack.push(cloneProduct(product));

    if (state.undoStack.length > 20) {
      state.undoStack.shift();
    }
  }

  // ADMIN_API_CSRF_V1: token em memória (não em localStorage — vive
  // enquanto a página estiver aberta, em sintonia com a sessão server).
  var adminCsrfToken = null;
  var ADMIN_CSRF_REQUIRED = { "save-product": true, "save-home": true, "logout": true };

  function ensureAdminCsrf() {
    if (adminCsrfToken) {
      return Promise.resolve(adminCsrfToken);
    }
    return fetch(ADMIN_API + "?action=status", {
      method: "GET",
      credentials: "same-origin"
    }).then(function (response) {
      return response.json().catch(function () { return {}; });
    }).then(function (data) {
      if (data && data.csrf) {
        adminCsrfToken = String(data.csrf);
      }
      return adminCsrfToken;
    }).catch(function () {
      return adminCsrfToken;
    });
  }

  function adminFetch(action, payload, extraHeaders) {
    var headers = { "Content-Type": "application/json" };
    if (extraHeaders) {
      Object.keys(extraHeaders).forEach(function (key) {
        if (extraHeaders[key]) headers[key] = extraHeaders[key];
      });
    }
    return fetch(ADMIN_API + "?action=" + encodeURIComponent(action), {
      method: "POST",
      headers: headers,
      credentials: "same-origin",
      body: JSON.stringify(payload || {})
    }).then(function (response) {
      return response.text().then(function (text) {
        var data = {};

        try {
          data = text ? JSON.parse(text) : {};
        } catch (error) {
          // ADMIN_LOGIN_PT_LOG_V1: mensagens fallback em PT-PT correto.
          data = { message: text || "Resposta inválida do servidor." };
        }

        if (!response.ok || data.ok === false) {
          throw new Error(data.message || "Não foi possível concluir a ação.");
        }

        // O servidor pode devolver um token novo (login roda o token).
        if (data && data.csrf) {
          adminCsrfToken = String(data.csrf);
        }
        return data;
      });
    });
  }

  function adminRequest(action, payload) {
    if (!ADMIN_CSRF_REQUIRED[action]) {
      return adminFetch(action, payload);
    }
    return ensureAdminCsrf().then(function (token) {
      var headers = token ? { "X-Admin-CSRF": token } : {};
      return adminFetch(action, payload, headers).catch(function (err) {
        // Token pode ter expirado/sido rodado pelo servidor — força refresh
        // e tenta uma vez mais.
        if (!token || /CSRF/i.test(String(err.message || ""))) {
          adminCsrfToken = null;
          return ensureAdminCsrf().then(function (newToken) {
            var retryHeaders = newToken ? { "X-Admin-CSRF": newToken } : {};
            return adminFetch(action, payload, retryHeaders);
          });
        }
        throw err;
      });
    });
  }

  function cleanHomeForSave(home) {
    var copy = cloneProduct(home || {});

    (copy.categories || []).forEach(function (category) {
      delete category.carouselImages;
    });

    return copy;
  }

  function saveDraft(content, button) {
    var isProduct = !!(content && content.steps);
    var action = isProduct ? "save-product" : "save-home";
    var payload;

    if (isProduct) {
      syncPricingFromProduct(content);
      payload = { product: content, pricing: state.pricing };
    } else {
      payload = { home: cleanHomeForSave(content) };
    }

    if (button) {
      button.disabled = true;
      button.textContent = "A guardar";
    }

    state.adminMessage = "";

    adminRequest(action, payload).then(function (data) {
      if (isProduct) {
        state.product = data.product || content;
      } else {
        state.home = data.home || content;
      }
      state.adminMessage = data.syncFlagCreated === false
        ? "Guardado no servidor, mas nao consegui marcar a flag Git."
        : "Guardado no servidor. Flag Git marcada para sincronizar.";
      if (isProduct) {
        if (data.pricing) {
          state.pricing = data.pricing;
        }
        rerenderProduct(state.product);
      } else {
        enrichHomeWithCarousels(state.home).then(renderHome).catch(function () {
          renderHome(state.home);
        });
      }
    }).catch(function (error) {
      state.adminMessage = error.message;
      if (button) {
        button.disabled = false;
        button.textContent = "SAVE";
      }
      rerender();
    });
  }

  function renderChrome(innerHtml, currentProduct) {
    app.innerHTML = innerHtml + renderAdminSurface(currentProduct) + renderCartSurface();
    bindAdminSurface(currentProduct);
    bindThemeToggle();
    bindCartUi();
    applyTheme(currentTheme());
  }

  function currentTheme() {
    var stored;
    try {
      stored = window.localStorage.getItem(THEME_KEY);
    } catch (error) {
      stored = null;
    }
    return stored === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    var root = document.documentElement;
    var resolved = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", resolved);
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      var nextLabel = resolved === "dark" ? "Modo claro" : "Modo escuro";
      var icon = resolved === "dark" ? ICON_MOON : ICON_SUN;
      button.setAttribute("aria-pressed", resolved === "dark" ? "true" : "false");
      button.setAttribute("aria-label", nextLabel);
      button.setAttribute("title", nextLabel);
      button.innerHTML = icon;
    });
  }

  function setTheme(theme) {
    var resolved = theme === "dark" ? "dark" : "light";
    try {
      window.localStorage.setItem(THEME_KEY, resolved);
    } catch (error) {
      /* noop */
    }
    applyTheme(resolved);
  }

  function bindThemeToggle() {
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      if (button.dataset.themeToggleBound === "1") {
        return;
      }
      button.dataset.themeToggleBound = "1";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        setTheme(currentTheme() === "dark" ? "light" : "dark");
      });
    });
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function createCartId() {
    return "cart_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function getEmptyCart() {
    var createdAt = nowIso();
    return {
      schemaVersion: CART_SCHEMA_VERSION,
      cartId: createCartId(),
      createdAt: createdAt,
      updatedAt: createdAt,
      items: []
    };
  }

  function normalizeCartItem(item) {
    var source = item && typeof item === "object" ? item : {};
    var summary = source.summary && typeof source.summary === "object" ? source.summary : {};
    var id = String(source.id || "").trim();
    var priceCents = summary.priceCents == null ? 0 : parseInt(summary.priceCents, 10);

    if (!id) {
      id = "ci_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    }

    return {
      id: id,
      productSlug: String(source.productSlug || "").trim(),
      productName: String(source.productName || "Produto").trim() || "Produto",
      summary: {
        title: String(summary.title || source.productName || "Produto").trim() || "Produto",
        subtitle: String(summary.subtitle || "").trim(),
        priceCents: Math.max(0, Number.isFinite(priceCents) ? priceCents : 0),
        image: summary.image ? String(summary.image).trim() : null
      },
      selections: source.selections && typeof source.selections === "object" && !Array.isArray(source.selections)
        ? source.selections
        : {}
    };
  }

  function normalizeCart(cart) {
    var source = cart && typeof cart === "object" ? cart : null;
    var empty;
    var createdAt;
    var updatedAt;

    if (!source) {
      return getEmptyCart();
    }

    empty = getEmptyCart();
    createdAt = String(source.createdAt || "").trim();
    updatedAt = String(source.updatedAt || "").trim();

    return {
      schemaVersion: CART_SCHEMA_VERSION,
      cartId: String(source.cartId || "").trim() || empty.cartId,
      createdAt: createdAt || empty.createdAt,
      updatedAt: updatedAt || createdAt || empty.updatedAt,
      items: Array.isArray(source.items) ? source.items.map(normalizeCartItem) : []
    };
  }

  function loadCart() {
    var stored = safeStorageGetItem(CART_KEY);
    var parsed;
    var normalized;

    if (!stored) {
      return getEmptyCart();
    }

    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      normalized = getEmptyCart();
      safeStorageSetItem(CART_KEY, JSON.stringify(normalized));
      return normalized;
    }

    normalized = normalizeCart(parsed);
    if (!parsed || parsed.schemaVersion !== CART_SCHEMA_VERSION || !Array.isArray(parsed.items)) {
      safeStorageSetItem(CART_KEY, JSON.stringify(normalized));
    }
    return normalized;
  }

  function saveCart(cart) {
    var normalized = normalizeCart(cart);
    normalized.updatedAt = nowIso();
    safeStorageSetItem(CART_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function addOrUpdateCartItem(item) {
    var cart = loadCart();
    var normalizedItem = normalizeCartItem(item);
    var index = cart.items.findIndex(function (existing) {
      return existing.id === normalizedItem.id;
    });

    if (index >= 0) {
      cart.items[index] = normalizedItem;
    } else {
      cart.items.push(normalizedItem);
    }

    return saveCart(cart);
  }

  function removeCartItem(itemId) {
    var cart = loadCart();
    var id = String(itemId || "");
    cart.items = cart.items.filter(function (item) {
      return item.id !== id;
    });
    return saveCart(cart);
  }

  function clearCart() {
    safeStorageRemoveItem(CART_KEY);
    return getEmptyCart();
  }

  function getCartItems() {
    return loadCart().items;
  }

  function getCartCount() {
    return getCartItems().length;
  }

  function getCartSubtotalCents() {
    return getCartItems().reduce(function (total, item) {
      var price = item && item.summary ? parseInt(item.summary.priceCents, 10) : 0;
      return total + (Number.isFinite(price) ? Math.max(0, price) : 0);
    }, 0);
  }

  function formatCartItemSummary(item) {
    var summary = item && item.summary ? item.summary : {};
    var priceCents = parseInt(summary.priceCents, 10);

    return {
      productName: String((item && item.productName) || "Produto"),
      title: String(summary.title || (item && item.productName) || "Produto"),
      subtitle: String(summary.subtitle || ""),
      priceText: priceCents > 0 ? formatCents(priceCents) : "Preço a confirmar",
      image: summary.image ? String(summary.image) : ""
    };
  }

  function cartProductPage(productSlugValue) {
    var slug = String(productSlugValue || "").trim().replace(/[^a-z0-9_-]/gi, "");
    return slug ? slug + ".html" : "adicionar-produto.html";
  }

  function safeCartReturnTo(value) {
    var target = String(value || "").trim();
    var stepMatch;

    if (target === "checkout" || target === "checkout.html") {
      return "checkout.html?step=1";
    }
    stepMatch = target.match(/^checkout(?:\.html)?(?:\?step=([12]))?$/);
    if (stepMatch) {
      return "checkout.html?step=" + (stepMatch[1] || "1");
    }
    if (target === "adicionar-produto" || target === "adicionar-produto.html") {
      return "adicionar-produto.html";
    }
    return "checkout.html?step=1";
  }

  function checkoutUrlForStep(stepIndex) {
    return "checkout.html?step=" + (Math.max(0, Math.min(1, Number(stepIndex) || 0)) + 1);
  }

  function cartEditUrl(item, returnTo) {
    var id = item && item.id ? String(item.id) : "";
    var href = cartProductPage(item && item.productSlug);
    return href + "?mode=edit&cartItem=" + encodeURIComponent(id) + "&returnTo=" + encodeURIComponent(safeCartReturnTo(returnTo));
  }

  function findCartItemById(itemId) {
    var id = String(itemId || "");
    return getCartItems().filter(function (item) {
      return item.id === id;
    })[0] || null;
  }

  function openCartItemEditor(itemId, returnTo) {
    var item = findCartItemById(itemId);

    if (!item || !item.productSlug) {
      state.cartPanelOpen = true;
      state.cartNotice = "Não foi possível abrir este produto para edição.";
      refreshCartUi();
      return;
    }

    window.location.href = cartEditUrl(item, returnTo);
  }

  function loadCardDetailsSession() {
    var stored = safeSessionGetItem(CARD_DETAILS_SESSION_KEY);
    var parsed;

    if (!stored) {
      return {};
    }

    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      return {};
    }

    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  }

  function isCardDetailsSessionField(name) {
    return ["recipient_name", "contact", "congregation"].indexOf(String(name || "")) !== -1;
  }

  function saveCardDetailsSessionField(name, value) {
    var key = String(name || "");
    var details;

    if (!isCardDetailsSessionField(key)) {
      return;
    }

    details = loadCardDetailsSession();
    details[key] = String(value || "");
    safeSessionSetItem(CARD_DETAILS_SESSION_KEY, JSON.stringify(details));
  }

  function persistCurrentCardDetails(product) {
    var step = findStep(product, "details");

    if (!step || step.template !== "details-form" || !Array.isArray(step.fields)) {
      return;
    }

    step.fields.forEach(function (field) {
      var name = field && field.name ? field.name : "";
      if (isCardDetailsSessionField(name) && state.selections[name] != null) {
        saveCardDetailsSessionField(name, state.selections[name]);
      }
    });
  }

  function applySessionCardDetails(product) {
    var step = findStep(product, "details");
    var details = loadCardDetailsSession();

    if (!step || step.template !== "details-form" || !Array.isArray(step.fields)) {
      return;
    }

    step.fields.forEach(function (field) {
      var name = field && field.name ? field.name : "";
      var current = state.selections[name];
      if (!isCardDetailsSessionField(name) || String(current || "").trim()) {
        return;
      }
      if (String(details[name] || "").trim()) {
        state.selections[name] = details[name];
      }
    });
  }

  function cartCountText(count) {
    if (count > 99) {
      return "99+";
    }
    return String(Math.max(0, count));
  }

  function renderCartBadge() {
    var count = getCartCount();
    return count > 0
      ? '<span class="cart-count-badge" aria-hidden="true">' + escapeHtml(cartCountText(count)) + '</span>'
      : "";
  }

  function cartButtonAriaLabel() {
    var count = getCartCount();
    if (!count) {
      return "Carrinho vazio";
    }
    return "Carrinho, " + count + (count === 1 ? " produto" : " produtos");
  }

  function renderCartHeaderButton() {
    return [
      '<button type="button" class="header-link header-link-icon cart-header-button" data-cart-open aria-label="' + escapeHtml(cartButtonAriaLabel()) + '" title="Carrinho">',
      ICON_CART,
      renderCartBadge(),
      '</button>'
    ].join("");
  }

  function renderCartItem(item, index) {
    var summary = formatCartItemSummary(item);
    var returnTo = page === "checkout" ? checkoutUrlForStep(state.checkoutStep) : "adicionar-produto.html";
    var thumb = summary.image
      ? '<img src="' + escapeHtml(summary.image) + '" alt="" loading="lazy">'
      : '<span aria-hidden="true">' + escapeHtml(summary.productName.slice(0, 1).toUpperCase()) + '</span>';

    return [
      '<li class="cart-panel-item">',
      '<div class="cart-item-thumb">' + thumb + '</div>',
      '<div class="cart-item-copy">',
      '<strong>' + escapeHtml(index + 1) + '. ' + escapeHtml(summary.productName) + '</strong>',
      '<span>' + escapeHtml(summary.title) + '</span>',
      summary.subtitle ? '<em>' + escapeHtml(summary.subtitle) + '</em>' : "",
      '</div>',
      '<div class="cart-item-side">',
      '<span class="cart-item-price">' + escapeHtml(summary.priceText) + '</span>',
      '<div class="cart-item-actions">',
      '<button type="button" class="cart-edit-button" data-cart-edit="' + escapeHtml(item.id) + '" data-cart-edit-return="' + escapeHtml(returnTo) + '">Editar</button>',
      '<button type="button" class="cart-remove-button" data-cart-remove="' + escapeHtml(item.id) + '">Remover</button>',
      '</div>',
      '</div>',
      '</li>'
    ].join("");
  }

  function renderCartPanel() {
    var items = getCartItems();
    var count = items.length;
    var subtotal = getCartSubtotalCents();

    return [
      '<aside class="cart-panel' + (state.cartPanelOpen ? ' is-open' : '') + '" id="cart-panel" role="dialog" aria-modal="false" aria-labelledby="cart-panel-title" aria-hidden="' + (state.cartPanelOpen ? "false" : "true") + '">',
      '<div class="cart-panel-head">',
      '<div>',
      '<p class="eyebrow">Carrinho</p>',
      '<h2 id="cart-panel-title">' + (count ? "O teu pedido" : "Carrinho") + '</h2>',
      '</div>',
      '<button type="button" class="cart-close-button" data-cart-close aria-label="Fechar carrinho">×</button>',
      '</div>',
      count ? [
        '<ol class="cart-panel-list">',
        items.map(renderCartItem).join(""),
        '</ol>',
        '<div class="cart-panel-total">',
        '<span>Subtotal</span>',
        '<strong>' + escapeHtml(formatCents(subtotal)) + '</strong>',
        '</div>',
        '<button type="button" class="button primary cart-finalize-button" data-cart-finalize>Finalizar pedido</button>'
      ].join("") : [
        '<div class="cart-empty-state">',
        '<strong>O carrinho está vazio.</strong>',
        '<p>Ainda não adicionaste nenhum produto ao pedido.</p>',
        '</div>',
        '<button type="button" class="button primary cart-finalize-button" disabled>Finalizar pedido</button>'
      ].join(""),
      state.cartNotice ? '<p class="cart-panel-note" role="status">' + escapeHtml(state.cartNotice) + '</p>' : "",
      '</aside>'
    ].join("");
  }

  function renderCartSurface() {
    var count = getCartCount();

    return [
      '<div class="cart-surface' + (state.cartPanelOpen ? ' is-open' : '') + '" data-cart-surface>',
      count ? '<button type="button" class="cart-floating-button" data-cart-open aria-label="' + escapeHtml(cartButtonAriaLabel()) + '"><span class="cart-floating-icon">' + ICON_CART + '</span><span>Carrinho</span><strong>' + escapeHtml(cartCountText(count)) + '</strong></button>' : "",
      state.cartPanelOpen ? '<button type="button" class="cart-panel-backdrop" data-cart-close aria-label="Fechar carrinho"></button>' : "",
      renderCartPanel(),
      '</div>'
    ].join("");
  }

  function updateCartHeaderButtons() {
    document.querySelectorAll(".cart-header-button").forEach(function (button) {
      button.innerHTML = ICON_CART + renderCartBadge();
      button.setAttribute("aria-label", cartButtonAriaLabel());
      button.classList.toggle("has-items", getCartCount() > 0);
    });
  }

  function ensureCartHeaderButton() {
    var actions = document.querySelector(".site-header .header-actions");
    var themeButton;
    var button;

    if (!actions || actions.querySelector("[data-cart-open]")) {
      updateCartHeaderButtons();
      return;
    }

    button = document.createElement("button");
    button.type = "button";
    button.className = "header-link header-link-icon cart-header-button";
    button.setAttribute("data-cart-open", "");
    button.setAttribute("aria-label", cartButtonAriaLabel());
    button.setAttribute("title", "Carrinho");
    button.innerHTML = ICON_CART + renderCartBadge();

    themeButton = actions.querySelector("[data-theme-toggle]");
    if (themeButton) {
      actions.insertBefore(button, themeButton);
    } else {
      actions.appendChild(button);
    }
  }

  function refreshCartUi() {
    var surface = document.querySelector("[data-cart-surface]");
    var html = renderCartSurface();

    ensureCartHeaderButton();

    if (surface) {
      surface.outerHTML = html;
    } else if (document.body) {
      document.body.insertAdjacentHTML("beforeend", html);
    }

    updateCartHeaderButtons();
    bindCartUi();
  }

  function bindCartUi() {
    ensureCartHeaderButton();

    document.querySelectorAll("[data-cart-open]").forEach(function (button) {
      if (button.dataset.cartBound === "1") {
        return;
      }
      button.dataset.cartBound = "1";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        state.cartPanelOpen = true;
        state.cartNotice = "";
        refreshCartUi();
      });
    });

    document.querySelectorAll("[data-cart-close]").forEach(function (button) {
      if (button.dataset.cartBound === "1") {
        return;
      }
      button.dataset.cartBound = "1";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        state.cartPanelOpen = false;
        state.cartNotice = "";
        refreshCartUi();
      });
    });

    document.querySelectorAll("[data-cart-remove]").forEach(function (button) {
      if (button.dataset.cartBound === "1") {
        return;
      }
      button.dataset.cartBound = "1";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        removeCartItem(button.dataset.cartRemove);
        state.cartPanelOpen = true;
        state.cartNotice = "Produto removido do carrinho.";
        refreshCartUi();
      });
    });

    document.querySelectorAll("[data-cart-edit]").forEach(function (button) {
      if (button.dataset.cartBound === "1") {
        return;
      }
      button.dataset.cartBound = "1";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        openCartItemEditor(button.dataset.cartEdit, button.dataset.cartEditReturn || "adicionar-produto.html");
      });
    });

    document.querySelectorAll("[data-cart-finalize]").forEach(function (button) {
      if (button.dataset.cartBound === "1") {
        return;
      }
      button.dataset.cartBound = "1";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        if (getCartCount() > 0) {
          trackOrderEvent("cart_checkout_started", {
            cart_id: loadCart().cartId,
            item_count: getCartCount()
          });
          window.location.href = "checkout.html";
          return;
        }
        state.cartPanelOpen = true;
        state.cartNotice = "Adiciona pelo menos um produto antes de finalizar.";
        refreshCartUi();
      });
    });

    if (!cartEscapeBound) {
      cartEscapeBound = true;
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && state.cartPanelOpen) {
          state.cartPanelOpen = false;
          state.cartNotice = "";
          refreshCartUi();
        }
      });
    }
  }

  function installCartDebugTools() {
    var params = new URLSearchParams(window.location.search || "");

    if (!params.has("cartDebug")) {
      return;
    }

    window.MiaCartDebug = {
      addTestItem: function () {
        addOrUpdateCartItem({
          id: "ci_test_001",
          productSlug: "crachas",
          productName: "Crachás",
          summary: {
            title: "24 crachás · 32 mm",
            subtitle: "Teste visual do carrinho",
            priceCents: 3200,
            image: null
          },
          selections: {}
        });
        state.cartPanelOpen = true;
        state.cartNotice = "Item de teste adicionado ao carrinho.";
        refreshCartUi();
        return loadCart();
      },
      clear: function () {
        clearCart();
        state.cartPanelOpen = true;
        state.cartNotice = "Carrinho limpo.";
        refreshCartUi();
        return loadCart();
      },
      load: loadCart
    };
  }

  function createCartItemId(product) {
    var slug = product && product.slug ? product.slug : "item";
    return "ci_" + slug + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  }

  function productCartSteps(product) {
    var steps = visibleSteps(product);
    var endIndex = steps.findIndex(function (step) {
      return step && (step.id === "delivery_contact" || step.template === "delivery-contact");
    });

    if (endIndex < 0) {
      endIndex = steps.findIndex(function (step) {
        return step && step.id === "confirm";
      });
    }

    return endIndex >= 0 ? steps.slice(0, endIndex) : steps.slice();
  }

  function cartEntryStepIndex(product) {
    var steps = visibleSteps(product);
    var cartSteps = productCartSteps(product);

    if (!cartSteps.length) {
      return -1;
    }

    return steps.indexOf(cartSteps[cartSteps.length - 1]);
  }

  function isCartEntryStep(product) {
    return !state.admin && state.currentStep === cartEntryStepIndex(product);
  }

  function focusProductFirstError() {
    window.requestAnimationFrame(function () {
      var target = document.querySelector(".wizard-shell .is-missing, .wizard-shell [aria-invalid='true']");

      if (!target) {
        target = document.querySelector(".wizard-shell .form-error");
      }
      if (!target) {
        return;
      }

      if (typeof target.focus === "function") {
        try {
          target.focus({ preventScroll: true });
        } catch (error) {
          target.focus();
        }
      }
      if (typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });
  }

  function validateProductForCart(product) {
    var steps = productCartSteps(product);
    var error = "";
    var index = 0;

    for (index = 0; index < steps.length; index += 1) {
      error = validateStep(product, steps[index]);
      if (error) {
        state.currentStep = Math.max(0, visibleSteps(product).indexOf(steps[index]));
        state.maxVisitedStep = Math.max(state.maxVisitedStep, state.currentStep);
        state.errors = error;
        trackProductEvent(product, "validation_error", {
          step_id: steps[index] ? steps[index].id : "",
          step_index: state.currentStep
        });
        rerenderProduct(product);
        focusProductFirstError();
        return false;
      }
    }

    state.errors = "";
    return true;
  }

  function cartDesignLabels(product) {
    var labels = {};

    if (isAssortedSelected(product)) {
      labels.__sortido__ = "Sortido";
      return labels;
    }

    selectedDesignItems(product).forEach(function (item) {
      labels[item.value] = displayItemTitle(item) || item.title || item.value;
    });

    return labels;
  }

  function cartDesignQuantities(product) {
    var quantities = {};

    if (isAssortedSelected(product)) {
      quantities.__sortido__ = getPackQuantity(product);
      return quantities;
    }

    selectedDesignItems(product).forEach(function (item) {
      quantities[item.value] = isCadernosProduct(product) ? 1 : quantityFor(item.value);
    });

    return quantities;
  }

  function currentProductCartSelections(product) {
    var selections = cloneJson(state.selections);
    var cadernoLamination = isCadernosProduct(product) ? selectedCadernoLamination(product) : null;
    var cadernoOption = isCadernosProduct(product) ? selectedCadernoPurchaseOption(product) : null;

    delete selections.customer_name;
    delete selections.customer_contact;
    delete selections.delivery_option;
    delete selections.send_copy;
    delete selections.send_copy_touched;
    delete selections.copy_email;

    selections.designs = isAssortedSelected(product) ? ["__sortido__"] : selectedDesignValues();
    selections.design_quantities = cartDesignQuantities(product);
    selections.design_labels = cartDesignLabels(product);
    selections.assorted_designs = isAssortedSelected(product) ? "1" : "";
    selections.pack_quantity = getPackQuantity(product);
    selections.size = priceInfo(product).size || selections.size || "";

    if (isCadernosProduct(product)) {
      selections.lamination = cadernoLamination ? cadernoLamination.value : "";
      selections.lamination_label = cadernoLamination ? cadernoLamination.title : "";
      selections.purchase_option = cadernoOption ? cadernoOption.value : "";
      selections.purchase_option_label = cadernoOption ? cadernoOption.title : "";
      selections.purchase_includes = cadernoOption && cadernoOption.includes ? cadernoOption.includes : "";
      selections.purchase_is_pack = cadernoOption && cadernoOption.isPack ? "1" : "";
      selections.caderno_order_quantity = cadernoOrderQuantity(product);
      selections.cover_personalization = selections.cover_personalization || "";
      selections.cover_personalization_text = selections.cover_personalization === "yes" ? cadernoPersonalizationText() : "";
      selections.pack_promo_note = cadernoOption && cadernoOption.isPack ? cadernoPromoNote(product) : "";
    }

    selections.congregation_gift = shouldShowGiftRequest(product) && state.selections.congregation_gift ? "1" : "";

    return selections;
  }

  function cartItemImage(product) {
    var item = selectedDesignItems(product)[0] || null;
    var lamination = isCadernosProduct(product) ? selectedCadernoLamination(product) : null;
    var laminationKey = lamination ? (lamination.laminationKey || lamination.value || "") : "";

    if (item && laminationKey && item.laminationImages && item.laminationImages[laminationKey]) {
      return item.laminationImages[laminationKey];
    }

    return item && item.image ? item.image : null;
  }

  function cartItemSubtitle(product) {
    var designs;
    var names;
    var lamination;
    var option;
    var parts;

    if (isCadernosProduct(product)) {
      lamination = selectedCadernoLamination(product);
      option = selectedCadernoPurchaseOption(product);
      parts = [];
      if (lamination) {
        parts.push(lamination.title);
      }
      if (option) {
        parts.push(option.title);
      }
      if (state.selections.cover_personalization === "yes") {
        parts.push("capa personalizada");
      }
      return parts.join(" · ");
    }

    if (isAssortedSelected(product)) {
      return "Designs escolhidos pela Mia";
    }

    designs = selectedDesignItems(product);
    names = designs.slice(0, 3).map(function (item) {
      return displayItemTitle(item);
    });

    if (designs.length > 3) {
      names.push("+" + (designs.length - 3));
    }

    return names.length ? "Designs: " + names.join(", ") : "";
  }

  function buildCartItemFromCurrentProduct(product) {
    var info = priceInfo(product);
    var quantity = isCadernosProduct(product) ? cadernoOrderQuantity(product) : getPackQuantity(product);
    var title;
    var selectedSize;
    var cover;
    var option;

    if (isCadernosProduct(product)) {
      cover = selectedCadernoCover(product);
      option = selectedCadernoPurchaseOption(product);
      title = [
        quantity > 1 ? quantity + " x" : "",
        option ? option.title : "Caderno",
        cover ? "· " + displayItemTitle(cover) : ""
      ].filter(Boolean).join(" ");
    } else {
      selectedSize = selectedSizeLabel(product) || info.size || "";
      title = productQuantityLabel(product, quantity || 0) + (selectedSize ? " · " + selectedSize : "");
    }

    return {
      id: createCartItemId(product),
      productSlug: product.slug || "",
      productName: product.name || product.slug || "Produto",
      selections: currentProductCartSelections(product),
      summary: {
        title: title,
        subtitle: cartItemSubtitle(product),
        priceCents: Math.max(0, parseInt(info.cents, 10) || 0),
        image: cartItemImage(product)
      }
    };
  }

  function addCurrentProductToCart(product, destination) {
    var item;
    var cart;

    if (!validateProductForCart(product)) {
      return;
    }

    persistCurrentCardDetails(product);
    item = buildCartItemFromCurrentProduct(product);
    cart = addOrUpdateCartItem(item);
    trackProductEvent(product, "cart_item_added", {
      cart_id: cart.cartId,
      item_count: cart.items.length,
      item_price_cents: item.summary.priceCents || 0
    });
    window.location.href = destination;
  }

  function saveEditedCartItem(product) {
    var item;
    var cart;

    if (!state.editingCartItemId) {
      addCurrentProductToCart(product, "checkout.html");
      return;
    }

    if (!validateProductForCart(product)) {
      return;
    }

    persistCurrentCardDetails(product);
    item = buildCartItemFromCurrentProduct(product);
    item.id = state.editingCartItemId;
    cart = addOrUpdateCartItem(item);
    trackProductEvent(product, "cart_item_updated", {
      cart_id: cart.cartId,
      item_count: cart.items.length,
      item_price_cents: item.summary.priceCents || 0
    });
    window.location.href = state.editingCartReturnTo || "checkout.html";
  }

  function cancelCartItemEdit() {
    window.location.href = state.editingCartReturnTo || "checkout.html";
  }

  function renderCartEditBar() {
    if (!state.editingCartItemId) {
      return "";
    }

    return [
      '<div class="cart-edit-bar" role="region" aria-label="Edição do item do carrinho">',
      '<span>Estás a editar um produto do carrinho.</span>',
      '<div>',
      '<button class="button secondary" type="button" data-cart-cancel-edit>× Cancelar edição</button>',
      '<button class="button primary" type="button" data-cart-save-edit>✓ Guardar alterações</button>',
      '</div>',
      '</div>'
    ].join("");
  }

  function renderCartEntryActions(product) {
    if (state.editingCartItemId) {
      return [
        '<div class="step-actions">',
        '<button class="button secondary" type="button" data-back data-track="true" data-track-action="back" data-track-id="back">Voltar</button>',
        '<div class="next-action-wrap">',
        state.errors ? '<p class="form-error action-error" role="alert">' + escapeHtml(state.errors) + '</p>' : "",
        '</div>',
        '</div>'
      ].join("");
    }

    return [
      '<div class="step-actions cart-entry-actions">',
      '<button class="button secondary" type="button" data-back data-track="true" data-track-action="back" data-track-id="back">Voltar</button>',
      '<div class="cart-entry-buttons">',
      state.errors ? '<p class="form-error action-error" role="alert">' + escapeHtml(state.errors) + '</p>' : "",
      '<button class="button secondary" type="button" data-cart-add-another>Adicionar outro produto</button>',
      '<button class="button primary" type="button" data-cart-finalize-current>Finalizar pedido</button>',
      '</div>',
      '</div>'
    ].join("");
  }

  function currentUrlParams() {
    try {
      return new URLSearchParams(window.location.search || "");
    } catch (error) {
      return new URLSearchParams("");
    }
  }

  function normalizeSelectionsForProduct(product, selections) {
    var normalized = cloneJson(selections || {});
    var steps = product && Array.isArray(product.steps) ? product.steps : [];

    steps.forEach(function (step) {
      var value;

      if (!step || !step.id || normalized[step.id] == null) {
        return;
      }

      value = normalized[step.id];
      if (step.selection === "multi") {
        normalized[step.id] = Array.isArray(value) ? value : (value ? [value] : []);
        return;
      }

      if (Array.isArray(value)) {
        normalized[step.id] = value[0] || "";
      }
    });

    if (product && product.slug === "cadernos" && Array.isArray(normalized.designs)) {
      normalized.designs = normalized.designs[0] || "";
    }

    return normalized;
  }

  function restoreQuantityStateFromSelections(product) {
    var items = selectedDesignItems(product);
    var quantities = state.selections.design_quantities && typeof state.selections.design_quantities === "object"
      ? state.selections.design_quantities
      : {};

    if (isAssortedSelected(product)) {
      state.quantitySignature = "__assorted__";
      state.quantitiesTouched = false;
      state.quantityPackBaseline = getPackQuantity(product);
      return;
    }

    state.quantitySignature = selectedItemsSignature(items);
    state.quantityPackBaseline = getPackQuantity(product);
    state.quantitiesTouched = !isCadernosProduct(product) && Object.keys(quantities).length > 0;
  }

  function loadCartEditMode(product) {
    var params = currentUrlParams();
    var mode = String(params.get("mode") || "").toLowerCase();
    var itemId = String(params.get("cartItem") || "").trim();
    var item;
    var entryIndex;

    state.editingCartItemId = "";
    state.editingCartReturnTo = "";
    state.editingCartOriginalItem = null;

    if (mode !== "edit" || !itemId) {
      return;
    }

    item = findCartItemById(itemId);
    if (!item || item.productSlug !== product.slug) {
      state.errors = "Não foi possível carregar este item do carrinho para edição.";
      return;
    }

    state.editingCartItemId = item.id;
    state.editingCartReturnTo = safeCartReturnTo(params.get("returnTo"));
    state.editingCartOriginalItem = cloneJson(item);
    state.selections = normalizeSelectionsForProduct(product, item.selections || {});
    state.currentStep = 0;
    entryIndex = cartEntryStepIndex(product);
    state.maxVisitedStep = entryIndex >= 0 ? entryIndex : Math.max(0, visibleSteps(product).length - 1);
    state.packDisabledMessage = "";
    state.invalidFields = [];
    restoreQuantityStateFromSelections(product);
  }

  function renderBrand(brand, homeUrl, instagramUrl) {
    return [
      '<header class="site-header">',
      '<a class="brand" href="' + escapeHtml(homeUrl || "index.html") + '" aria-label="' + escapeHtml(brand) + '">',
      '<span class="brand-mark"><img src="content/brand/logo.jpg" alt="" loading="lazy"></span>',
      '<span>' + escapeHtml(brand) + '</span>',
      '</a>',
      '<nav class="header-actions" aria-label="Links rápidos">',
      '<a class="header-link header-link-icon" href="' + escapeHtml(instagramUrl) + '" target="_blank" rel="noopener" aria-label="Instagram" title="Instagram">' + ICON_INSTAGRAM + '</a>',
      '<a class="header-link header-link-icon" href="contacto.html" aria-label="Enviar mensagem" title="Enviar mensagem">' + ICON_MAIL + '</a>',
      renderCartHeaderButton(),
      '<button type="button" class="header-link header-link-icon header-theme-toggle" data-theme-toggle aria-pressed="false" aria-hidden="true" hidden aria-label="Modo escuro" title="Modo escuro">' + ICON_SUN + '</button>',
      '</nav>',
      '</header>'
    ].join("");
  }

  function renderFooter(brand) {
    return [
      '<footer class="site-footer">',
      '<a href="privacy.html">Política de Privacidade</a>',
      '<button type="button" data-admin-open>Login de Administrador</button>',
      '<span>© ' + escapeHtml(brand || "Mia & Paper") + ' 2026 Todos os Direitos Reservados</span>',
      '</footer>'
    ].join("");
  }

  function centsToEuroInput(cents) {
    return (Math.max(0, Number(cents) || 0) / 100).toFixed(2).replace(".", ",");
  }

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
    return (product && product.imageShape === "round") || (product && product.slug === "crachas") || (product && product.slug === "pins")
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
      '<label><span>Tamanho moldura (%)</span><input type="number" min="40" max="300" step="1" value="' + escapeHtml(frameEditNumber(first, step, false, "frameScale", 100, 40, 300)) + '" data-admin-bulk-frame="frameScale" data-admin-bulk-step="' + escapeHtml(step.id) + '"></label>',
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
      summaryLabel = product.slug === "crachas" ? "Separadores dos crachás" : (product.slug === "imanes" ? "Separadores dos ímanes" : "Separadores deste passo");
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

    if (!product || (product.slug !== "cadernos" && !product.preview)) {
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

    if (!product || product.slug !== "cadernos") {
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
      '<aside class="admin-toolbar" aria-label="Admin mockup">',
      '<div class="admin-toolbar-head">',
      '<strong>Admin</strong>',
      content ? '<button type="button" data-admin-undo' + (state.undoStack.length ? "" : " disabled") + '>UNDO</button>' : "",
      content ? '<button type="button" data-admin-save>SAVE</button>' : "",
      content ? '<button type="button" data-admin-reset>JSON</button>' : "",
      // FUNNEL_DASHBOARD_V1: link rápido para a dashboard do funil. Abre em
      // nova tab para não perder o estado da edição.
      '<a class="admin-funnel-link" href="admin-funnel.php" target="_blank" rel="noopener">Funil</a>',
      // ADMIN_ORDERS_V1: link para o painel de encomendas.
      '<a class="admin-funnel-link" href="admin-orders.php" target="_blank" rel="noopener">Encomendas</a>',
      '<a class="admin-funnel-link" href="cadernos.html">Cadernos</a>',
      '<button type="button" data-admin-exit>Sair</button>',
      '</div>',
      message,
      step ? '<details class="admin-step-panel"><summary>Editar passo</summary><label><span>Template</span><select data-admin-template>' + options + '</select></label>' : "",
      step ? '<label><span>Título</span><input type="text" value="' + escapeHtml(step.title || "") + '" data-admin-step-edit="title"></label>' : "",
      step ? '<label><span>Texto</span><textarea data-admin-step-edit="text">' + escapeHtml(step.text || "") + '</textarea></label>' : "",
      step ? '<label class="admin-check"><input type="checkbox"' + (step.hidden ? "" : " checked") + (step.id === "confirm" ? " disabled" : "") + ' data-admin-step-visible> Passo visível para clientes</label>' : "",
      step ? '<button type="button" data-admin-add-step>Adicionar passo novo</button></details>' : "",
      step ? renderAdminStepImagePanel(step) : "",
      step && getStepSectionConfig(currentProduct, step) ? renderAdminSectionsPanel(currentProduct, step) : "",
      currentProduct ? renderAdminImageKeyboardPanel(currentProduct) : "",
      currentProduct ? renderAdminRectOrientationPanel(currentProduct) : "",
      currentHome ? renderAdminHomeSettingsPanel(currentHome) : "",
      currentProduct ? renderAdminSiteSettingsPanel() : "",
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
    var loginForm = document.querySelector("[data-admin-login-form]");
    var exit = document.querySelector("[data-admin-exit]");
    var template = document.querySelector("[data-admin-template]");
    var undo = document.querySelector("[data-admin-undo]");
    var save = document.querySelector("[data-admin-save]");
    var reset = document.querySelector("[data-admin-reset]");

    if (open) {
      open.addEventListener("click", function () {
        state.loginOpen = true;
        rerender();
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
        window.localStorage.removeItem(ADMIN_KEY);
        adminRequest("logout", {}).catch(function () {});
        rerender();
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

    // CRACHAS_SIZE_CARD_LAYOUT_TOGGLE_V1: caixinha admin para o passo "size"
    // dos crachás. Marcada = sempre 3 colunas (default). Desmarcada = foto
    // passa para a linha de baixo em ecrãs estreitos.
    document.querySelectorAll("[data-admin-step-side-fixed]").forEach(function (input) {
      input.addEventListener("change", function () {
        var step = currentProduct && visibleSteps(currentProduct)[state.currentStep];

        if (!step || step.id !== "size" || currentProduct.slug !== "crachas") {
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
        return '<span class="category-carousel-frame' + (index === 0 ? ' is-active' : '') + '" style="background-image:url(&quot;' + escapeHtml(image) + '&quot;);--carousel-pan-x:' + panX + '%;--carousel-pan-y:' + panY + '%"></span>';
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

  function renderHome(home) {
    ensureHomeSettings(home);
    applySiteSettings(home);
    state.home = home;

    var allCategories = (home.categories || []).map(function (category, originalIndex) {
      return { category: category, originalIndex: originalIndex };
    });
    var visibleCategories = allCategories.filter(function (record) {
      return homeCategoryIsVisible(record.category);
    });
    var displayCategories = state.admin ? allCategories : visibleCategories;
    var gridCount = Math.max(1, Math.min(5, displayCategories.length));

    function renderHomeCategoryCard(record, displayIndex) {
      var category = record.category;
      var originalIndex = record.originalIndex;
      var isVisible = homeCategoryIsVisible(category);
      var isAdminHidden = state.admin && !isVisible;
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
      var imageStyle = hasStaticImage ? ' style="--category-image:url(&quot;' + escapeHtml(category.image) + '&quot;)"' : carouselStyle;
      var isClickable = category.clickable !== false;
      var unavailableMessage = !state.admin && !isClickable && category.unavailableMessage ? String(category.unavailableMessage) : "";
      var disabledClass = !isClickable ? " is-link-disabled" : "";
      var messageClass = unavailableMessage ? " has-unavailable-message" : "";
      var tag = !state.admin && isVisible && isClickable ? "a" : "span";
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
      var dataCategoryId = category.id ? ' data-category-id="' + escapeHtml(category.id) + '"' : "";
      var adminControls = state.admin ? [
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
        '<' + tag + ' class="category-card ' + escapeHtml(category.accent || "gold") + imageClass + hiddenClass + disabledClass + messageClass + '"' + href + dataCategoryId + imageStyle + ' aria-label="' + escapeHtml(category.title || "") + '">',
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

    renderChrome([
      '<main class="home-shell">',
      renderBrand(home.brand, "index.html", home.instagramUrl),
      '<section class="home-intro" aria-labelledby="home-title">',
      '<p class="eyebrow">' + escapeHtml(home.intro.eyebrow) + '</p>',
      '<h1 id="home-title">' + escapeHtml(home.intro.title) + '</h1>',
      '<p>' + escapeHtml(home.intro.text) + '</p>',
      state.admin ? [
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
      ].join("") : "",
      '</section>',
      '<nav class="category-grid category-grid-count-' + gridCount + (state.admin ? ' is-admin-home-grid' : '') + '" aria-label="Categorias">',
      cards,
      '</nav>',
      state.homeUnavailableMessage ? '<p class="open-order-hint home-unavailable-message" role="status" aria-live="polite">' + escapeHtml(state.homeUnavailableMessage) + '</p>' : "",
      renderHomeDeadlineNote(home),
      renderFooter(home.brand),
      '</main>'
    ].join(""));

    bindUnavailableCategoryCards();
    startHomeCarousels(home);
    startHomeDeadlineCountdown();
  }

  function findStep(product, id) {
    return product.steps.filter(function (step) {
      return step.id === id;
    })[0];
  }

  function selectedDesignValues() {
    if (Array.isArray(state.selections.designs)) {
      return state.selections.designs;
    }

    return state.selections.designs ? [state.selections.designs] : [];
  }

  function supportsAssortedDesigns(product) {
    return !!(product && ["crachas", "imanes", "caderninhos"].indexOf(product.slug) !== -1);
  }

  function isAssortedSelected(product) {
    return supportsAssortedDesigns(product) && state.selections.assorted_designs === "1";
  }

  function isCadernosProduct(product) {
    return !!(product && product.slug === "cadernos");
  }

  function allDesignsSelected(product) {
    var step = product ? findStep(product, "designs") : null;
    var allValues = step && Array.isArray(step.items)
      ? step.items.map(function (item) { return item.value; }).filter(Boolean)
      : [];
    var selected = selectedDesignValues();

    return allValues.length > 0
      && selected.length === allValues.length
      && allValues.every(function (value) { return selected.indexOf(value) !== -1; });
  }

  function hideGiftRequestForSelection(product) {
    return isCadernosProduct(product) || isAssortedSelected(product) || allDesignsSelected(product);
  }

  function syncGiftRequestSelection(product) {
    if (hideGiftRequestForSelection(product)) {
      state.selections.congregation_gift = false;
    }
  }

  function resetQuantityState() {
    state.selections.design_quantities = {};
    state.quantitySignature = "";
    state.quantitiesTouched = false;
    state.quantityPackBaseline = 0;
    state.packDisabledMessage = "";
  }

  function selectedDesignItems(product) {
    var step = findStep(product, "designs");
    var values = selectedDesignValues();
    if (!step || isAssortedSelected(product)) {
      return [];
    }

    return (step.items || []).filter(function (item) {
      return values.indexOf(item.value) !== -1;
    });
  }

  function selectedCadernosStepItem(product, stepId) {
    var step = product ? findStep(product, stepId) : null;
    var selected = step ? state.selections[step.id] : "";

    if (!step || !selected) {
      return null;
    }

    return (step.items || []).filter(function (item) {
      return item.value === selected;
    })[0] || null;
  }

  function selectedCadernoCover(product) {
    return selectedDesignItems(product)[0] || null;
  }

  function selectedCadernoLamination(product) {
    return selectedCadernosStepItem(product, "lamination");
  }

  function selectedCadernoPurchaseOption(product) {
    var step = product ? findStep(product, "pack") : null;
    var quantity = Number(state.selections.pack_quantity || 0);

    if (!step || !quantity) {
      return null;
    }

    return (step.items || []).filter(function (item) {
      return Number(item.quantity) === quantity;
    })[0] || null;
  }

  function cadernoPersonalizationStep(product) {
    return product ? findStep(product, "cover_personalization") : null;
  }

  function cadernoPersonalizationLimit(product) {
    var step = cadernoPersonalizationStep(product);
    return Math.max(1, parseInt(step && step.maxLength, 10) || 25);
  }

  function cadernoPersonalizationExtraCents(product) {
    var step = cadernoPersonalizationStep(product);
    return state.selections.cover_personalization === "yes"
      ? Math.max(0, parseInt(step && step.extraPriceCents, 10) || 0)
      : 0;
  }

  function cadernoPersonalizationText() {
    return String(state.selections.cover_personalization_text || "").trim();
  }

  function cadernoPurchasePriceCents(product, option) {
    var prices = product && product.prices ? product.prices : {};
    var table = product && product.defaultPriceKey && prices[product.defaultPriceKey]
      ? prices[product.defaultPriceKey]
      : null;
    var quantity = option ? Number(option.quantity) : 0;

    if (option && option.priceCents != null) {
      return Math.max(0, Number(option.priceCents) || 0);
    }

    return table && quantity ? Math.max(0, Number(table[String(quantity)]) || 0) : 0;
  }

  function cadernoPromoNote(product) {
    var step = product ? findStep(product, "pack") : null;
    return step && step.promoNote ? String(step.promoNote) : "";
  }

  function cadernoOrderQuantityConfig(product) {
    var step = product ? findStep(product, "pack") : null;
    return step && step.orderQuantity ? step.orderQuantity : {};
  }

  function cadernoOrderQuantityOptions(product) {
    var config = cadernoOrderQuantityConfig(product);
    var options = Array.isArray(config.options) ? config.options : [1, 2, 3, 4, 5, 10];
    var clean = [];

    options.forEach(function (option) {
      var number = Math.max(1, parseInt(option, 10) || 0);
      if (number && clean.indexOf(number) === -1) {
        clean.push(number);
      }
    });

    return clean.length ? clean : [1];
  }

  function cadernoOrderQuantity(product) {
    var options = cadernoOrderQuantityOptions(product);
    var fallback = Math.max(1, parseInt(cadernoOrderQuantityConfig(product).default, 10) || options[0] || 1);
    var selected = Math.max(1, parseInt(state.selections.caderno_order_quantity, 10) || fallback);

    return options.indexOf(selected) !== -1 ? selected : fallback;
  }

  function multipliedPriceText(unitCents, quantity) {
    var cents = Math.max(0, Number(unitCents) || 0);
    var count = Math.max(1, Number(quantity) || 1);

    if (!cents) {
      return "";
    }

    if (count === 1) {
      return formatCents(cents);
    }

    return formatCents(cents) + " x " + count + " = " + formatCents(cents * count);
  }

  function activePriceTableForPackFilter(product) {
    var prices = product && product.prices ? product.prices : {};
    var keys = Object.keys(prices);

    if (state.selections.size && prices[state.selections.size]) {
      return prices[state.selections.size];
    }

    if (product && product.defaultPriceKey && prices[product.defaultPriceKey]) {
      return prices[product.defaultPriceKey];
    }

    return keys.length === 1 ? prices[keys[0]] : null;
  }

  function allowedPackItems(product) {
    var packStep = findStep(product, "pack");
    var selectedCount = isAssortedSelected(product) ? 0 : selectedDesignItems(product).length;
    var activePriceTable = activePriceTableForPackFilter(product);
    if (!packStep) {
      return [];
    }

    return (packStep.items || []).filter(function (item) {
      var quantity = Number(item.quantity);
      if (quantity < selectedCount) {
        return false;
      }

      return !activePriceTable || activePriceTable[String(quantity)] != null;
    });
  }

  function getPackQuantity(product) {
    var pack = Number(state.selections.pack_quantity || 0);
    var allowed = allowedPackItems(product).map(function (item) {
      return Number(item.quantity);
    });

    if (allowed.indexOf(pack) === -1) {
      return 0;
    }

    return pack;
  }

  function distributeQuantities(items, packQuantity) {
    var quantities = {};
    var base;
    var rest;

    if (!items.length || !packQuantity) {
      return quantities;
    }

    base = Math.floor(packQuantity / items.length);
    rest = packQuantity % items.length;

    items.forEach(function (item, index) {
      quantities[item.value] = base + (index < rest ? 1 : 0);
    });

    return quantities;
  }

  function selectedItemsSignature(items) {
    return items.map(function (item) {
      return item.value;
    }).join("|");
  }

  function scaleQuantities(items, packQuantity, existing) {
    var currentTotal = 0;
    var rows = [];
    var quantities = {};
    var used = 0;

    if (!items.length || !packQuantity) {
      return quantities;
    }

    items.forEach(function (item) {
      var current = Math.max(1, parseInt(existing[item.value], 10) || 1);
      currentTotal += current;
    });

    if (!currentTotal) {
      return distributeQuantities(items, packQuantity);
    }

    items.forEach(function (item, index) {
      var current = Math.max(1, parseInt(existing[item.value], 10) || 1);
      var raw = current / currentTotal * packQuantity;
      var value = Math.max(1, Math.floor(raw));

      quantities[item.value] = value;
      used += value;
      rows.push({
        value: item.value,
        index: index,
        fraction: raw - Math.floor(raw)
      });
    });

    while (used < packQuantity) {
      rows.sort(function (a, b) {
        return b.fraction - a.fraction || a.index - b.index;
      });
      quantities[rows[(used - items.length) % rows.length].value] += 1;
      used += 1;
    }

    while (used > packQuantity) {
      rows.sort(function (a, b) {
        return quantities[b.value] - quantities[a.value] || a.fraction - b.fraction || a.index - b.index;
      });

      if (quantities[rows[0].value] <= 1) {
        break;
      }

      quantities[rows[0].value] -= 1;
      used -= 1;
    }

    return quantities;
  }

  function addPinsToQuantities(items, addCount, existing) {
    var quantities = {};
    var rows = [];

    if (!items.length || addCount <= 0) {
      return existing || {};
    }

    items.forEach(function (item, index) {
      quantities[item.value] = Math.max(1, parseInt(existing[item.value], 10) || 1);
      rows.push({
        value: item.value,
        index: index
      });
    });

    while (addCount > 0) {
      rows.sort(function (a, b) {
        return quantities[a.value] - quantities[b.value] || a.index - b.index;
      });
      quantities[rows[0].value] += 1;
      addCount -= 1;
    }

    return quantities;
  }

  function ensurePackAndQuantities(product) {
    var items = selectedDesignItems(product);
    var allowed = allowedPackItems(product);
    var current = Number(state.selections.pack_quantity || 0);
    var allowedQuantities = allowed.map(function (item) {
      return Number(item.quantity);
    });
    var signature;
    var existing;
    var total;

    if (!findStep(product, "pack")) {
      state.selections.design_quantities = {};
      state.quantitySignature = selectedItemsSignature(items);
      state.quantitiesTouched = false;
      state.quantityPackBaseline = 0;
      return;
    }

    if (isCadernosProduct(product)) {
      state.selections.design_quantities = {};
      if (items[0]) {
        state.selections.design_quantities[items[0].value] = 1;
      }
      state.quantitySignature = selectedItemsSignature(items);
      state.quantitiesTouched = false;
      state.quantityPackBaseline = getPackQuantity(product);
      return;
    }

    if (isAssortedSelected(product)) {
      if (!current || allowedQuantities.indexOf(current) === -1) {
        current = allowed[0] ? Number(allowed[0].quantity) : 0;
        if (current) {
          state.selections.pack_quantity = current;
        }
      }
      state.selections.design_quantities = {};
      state.quantitySignature = "__assorted__";
      state.quantitiesTouched = false;
      state.quantityPackBaseline = current;
      return;
    }

    if (!items.length) {
      delete state.selections.pack_quantity;
      state.selections.design_quantities = {};
      state.quantitySignature = "";
      state.quantitiesTouched = false;
      state.quantityPackBaseline = 0;
      return;
    }

    if (!current || allowedQuantities.indexOf(current) === -1) {
      current = Number(allowed[0].quantity);
      state.selections.pack_quantity = current;
    }

    signature = selectedItemsSignature(items);
    existing = state.selections.design_quantities || {};

    if (state.quantitySignature !== signature) {
      state.selections.design_quantities = distributeQuantities(items, current);
      state.quantitySignature = signature;
      state.quantitiesTouched = false;
      state.quantityPackBaseline = current;
      return;
    }

    cleanQuantities(product);
    total = quantityTotal(product);
    existing = state.selections.design_quantities || {};

    // SMART_QUANTITIES_V1 + V2: a re-distribuição/escala só corre quando
    // o pack mudou de valor (ou quando ainda não havia baseline). Em
    // re-renders provocados por +/- o pack mantém-se igual ao baseline,
    // por isso não tocamos nas quantidades — caso contrário o scale
    // desfazia o clique do utilizador. Para 3+ designs com a caixinha
    // "Quantidades inteligentes" ligada, escalamos proporcionalmente;
    // caso contrário redistribuímos por igual.
    if (current !== state.quantityPackBaseline) {
      if (items.length >= 3) {
        if (state.quantitiesTouched && smartQuantitiesEnabled()) {
          state.selections.design_quantities = scaleQuantities(items, current, existing);
        } else {
          state.selections.design_quantities = distributeQuantities(items, current);
          state.quantitiesTouched = false;
        }
      } else {
        state.selections.design_quantities = state.quantitiesTouched
          ? scaleQuantities(items, current, existing)
          : distributeQuantities(items, current);
      }
      state.quantityPackBaseline = current;
      return;
    }

    // Pack não mudou. Se os totais não bateram (ex.: design retirado e
    // o seu valor desapareceu na limpeza acima) deixamos como está — o
    // utilizador resolve com +/- ou com "Distribuir por igual". Manter
    // proporções no meio de uma edição manual seria contraintuitivo.
  }

  function cleanQuantities(product) {
    var items = selectedDesignItems(product);
    var allowed = {};
    var clean = {};
    var existing = state.selections.design_quantities || {};

    items.forEach(function (item) {
      allowed[item.value] = true;
      clean[item.value] = Math.max(1, parseInt(existing[item.value], 10) || 1);
    });

    state.selections.design_quantities = clean;
  }

  function quantityFor(value) {
    return Math.max(0, parseInt((state.selections.design_quantities || {})[value], 10) || 0);
  }

  function quantityTotal(product) {
    return selectedDesignItems(product).reduce(function (total, item) {
      return total + quantityFor(item.value);
    }, 0);
  }

  function unassignedCount(product) {
    return Math.max(0, getPackQuantity(product) - quantityTotal(product));
  }

  function formatCents(cents) {
    return (Number(cents) / 100).toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR"
    });
  }

  function pricingRecordFor(product) {
    if (!product || !state.pricing || !state.pricing.products) {
      return null;
    }

    return state.pricing.products[product.slug] || null;
  }

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  // SMART_QUANTITIES_V1: settings globais lidas de pricing.json. Quando
  // smartQuantities=true (default), ao mudar de pack as quantidades dos
  // designs escalam proporcionalmente em vez de fazer reset.
  function siteSettings() {
    if (!state.pricing) {
      return { smartQuantities: true };
    }
    if (!state.pricing.settings) {
      state.pricing.settings = {};
    }
    if (state.pricing.settings.smartQuantities === undefined) {
      state.pricing.settings.smartQuantities = true;
    }
    return state.pricing.settings;
  }

  function smartQuantitiesEnabled() {
    return siteSettings().smartQuantities !== false;
  }

  function applyPricingToProduct(product, pricing) {
    var record;

    state.pricing = pricing || null;
    record = pricing && pricing.products ? pricing.products[product.slug] : null;
    siteSettings();

    if (!record) {
      syncPricingFromProduct(product);
      return product;
    }

    product.prices = cloneJson(record.prices || product.prices || {});
    if (record.defaultPriceKey) {
      product.defaultPriceKey = record.defaultPriceKey;
    }
    if (record.unitLabel) {
      product.unitLabel = record.unitLabel;
    }
    if (record.unitSingular) {
      product.unitSingular = record.unitSingular;
    }
    if (record.unitShort) {
      product.unitShort = record.unitShort;
    }

    syncPackItemsFromPricing(product);
    return product;
  }

  function syncPricingFromProduct(product) {
    var record;

    if (!product || !product.slug) {
      return;
    }

    if (!state.pricing) {
      state.pricing = { currency: "EUR", products: {} };
    }

    if (!state.pricing.products) {
      state.pricing.products = {};
    }

    record = state.pricing.products[product.slug] || {};
    record.id = product.slug;
    record.label = product.hero && product.hero.title ? product.hero.title : (product.title || product.slug);
    record.unitLabel = product.unitLabel || productUnit(product);
    record.unitSingular = product.unitSingular || productUnitSingular(product);
    record.unitShort = product.unitShort || productUnitShort(product);
    record.defaultPriceKey = product.defaultPriceKey || Object.keys(product.prices || {})[0] || "";
    record.prices = cloneJson(product.prices || {});
    state.pricing.products[product.slug] = record;
  }

  function renamePricePack(product, size, oldPack, newPack) {
    var table;
    var cents;

    oldPack = String(oldPack || "");
    newPack = String(Math.max(1, parseInt(newPack, 10) || 1));

    if (!product || !product.prices || !product.prices[size] || !oldPack || oldPack === newPack) {
      return false;
    }

    table = product.prices[size];
    if (table[oldPack] == null) {
      return false;
    }

    cents = Number(table[oldPack]) || 0;
    delete table[oldPack];
    table[newPack] = cents;

    if (Number(state.selections.pack_quantity) === Number(oldPack)) {
      state.selections.pack_quantity = Number(newPack);
      state.quantitySignature = "";
      state.quantitiesTouched = false;
      state.quantityPackBaseline = 0;
    }

    return true;
  }

  function syncPackItemsFromPricing(product) {
    var packStep = product ? findStep(product, "pack") : null;
    var quantities = allPriceQuantities(product && product.prices ? product.prices : {});
    var existing = {};

    if (!packStep || !Array.isArray(packStep.items) || !quantities.length) {
      return;
    }

    packStep.items = packStep.items.filter(function (item) {
      return quantities.indexOf(String(item.quantity)) !== -1;
    });

    packStep.items.forEach(function (item) {
      existing[String(item.quantity)] = true;
    });

    quantities.forEach(function (quantity) {
      var number = Number(quantity);
      if (!number || existing[String(number)]) {
        return;
      }
      packStep.items.push({
        id: "pack-" + number,
        quantity: number,
        title: String(number),
        subtitle: number === 1 ? productUnitSingular(product) : productUnit(product)
      });
    });

    packStep.items.sort(function (a, b) {
      return Number(a.quantity) - Number(b.quantity);
    });
  }

  function productUnit(product) {
    return product.unitLabel || ((product.slug === "crachas" || product.slug === "pins") ? "crachás" : "unidades");
  }

  function productUnitSingular(product) {
    return product.unitSingular || ((product.slug === "crachas" || product.slug === "pins") ? "crachá" : "unidade");
  }

  function productQuantityLabel(product, quantity) {
    return Number(quantity) + " " + (Number(quantity) === 1 ? productUnitSingular(product) : productUnit(product));
  }

  function productUnitShort(product) {
    return product.unitShort || ((product.slug === "crachas" || product.slug === "pins") ? "crachá" : "unid.");
  }

  function formatUnitPrice(cents, quantity, unit) {
    if (!quantity) {
      return "";
    }

    return (Number(cents) / 100 / quantity).toLocaleString("pt-PT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " €/" + unit;
  }

  function deliveryFeeCents(option) {
    return Math.max(0, parseInt(option && option.feeCents, 10) || 0);
  }


  // DELIVERY_OPTIONS_3_V1: opções com feeCents === 0 e sem priceText
  // mostram "Grátis" em vez de "0,00 €". Mantém priceText explícito quando
  // existir (para casos como "Valor mínimo\n8,50 €").
  function deliveryPriceText(option) {
    var text = String(option && option.priceText ? option.priceText : "").trim();

    if (text) {
      return text;
    }

    if (option && deliveryFeeCents(option) === 0) {
      return "Grátis";
    }

    if (option && option.id === "shipping" && deliveryFeeCents(option) === 1000) {
      return "Valor mínimo 10 €, preço a combinar";
    }

    return formatCents(deliveryFeeCents(option));
  }

  // PACK_DISCOUNT_FALLBACK_BASELINE_V1: quando a tabela de precos nao tem
  // chave "1" (ex.: imanes Achatados, que so vendem a partir de 15 unidades),
  // o desconto era sempre 0. Como fallback usamos o pack mais caro por
  // unidade (geralmente o pack mais pequeno) como baseline. Mantemos o
  // comportamento original quando ha preco unitario.
  function baselineUnitCents(priceTable) {
    var unit;
    var max = 0;

    if (!priceTable) {
      return 0;
    }

    unit = Number(priceTable["1"]) || 0;
    if (unit) {
      return unit;
    }

    Object.keys(priceTable).forEach(function (key) {
      var qty = parseInt(key, 10);
      var cents = Number(priceTable[key]);
      var perUnit;

      if (!qty || !cents) {
        return;
      }

      perUnit = cents / qty;
      if (perUnit > max) {
        max = perUnit;
      }
    });

    return max;
  }

  function priceForSize(product, size) {
    var packQuantity = getPackQuantity(product);
    var table = product.prices && product.prices[size] ? product.prices[size] : null;
    var cents = table && packQuantity ? Number(table[String(packQuantity)]) : 0;
    var unitCents = baselineUnitCents(table);
    var discount = 0;

    if (unitCents && cents && packQuantity && cents < unitCents * packQuantity) {
      discount = Math.round((1 - (cents / (unitCents * packQuantity))) * 100);
    }

    return {
      size: size,
      quantity: packQuantity,
      cents: cents,
      total: cents ? formatCents(cents) : "",
      perPin: cents ? formatUnitPrice(cents, packQuantity, productUnitShort(product)) : "",
      discount: discount
    };
  }

  function priceDisplayName(product, size) {
    if (product && (product.slug === "crachas" || product.slug === "pins")) {
      if (size === "25 mm") {
        return "Crachás Pequenos";
      }

      if (size === "32 mm") {
        return "Crachás Médios";
      }
    }

    if (product && product.slug === "imanes") {
      if (size === "Achatados") {
        return "Ímanes finos";
      }

      if (size === "3 mm") {
        return "Ímanes grossos";
      }
    }

    return size;
  }

  function cadernoPriceInfo(product) {
    var option = selectedCadernoPurchaseOption(product);
    var baseCents = cadernoPurchasePriceCents(product, option);
    var extraCents = cadernoPersonalizationExtraCents(product);
    var orderQuantity = cadernoOrderQuantity(product);
    var unitCents = baseCents + extraCents;
    var totalCents = unitCents * orderQuantity;

    return {
      size: option ? option.title : "",
      quantity: option ? Number(option.quantity) : 0,
      orderQuantity: option ? orderQuantity : 0,
      cents: totalCents,
      baseCents: baseCents,
      personalizationCents: extraCents,
      unitCents: unitCents,
      total: totalCents ? formatCents(totalCents) : "",
      baseTotal: baseCents ? formatCents(baseCents) : "",
      baseSubtotal: baseCents ? multipliedPriceText(baseCents, orderQuantity) : "",
      personalizationTotal: extraCents ? formatCents(extraCents) : "",
      personalizationSubtotal: extraCents ? multipliedPriceText(extraCents, orderQuantity) : "",
      unitTotal: unitCents ? formatCents(unitCents) : "",
      perPin: "",
      discount: 0
    };
  }

  function cadernoPriceEquation(info) {
    if (!info || !info.baseTotal) {
      return "";
    }

    if (info.personalizationTotal) {
      return "Preço base: " + info.baseTotal + " + Personalização: " + info.personalizationTotal + " = " + info.unitTotal;
    }

    return "Preço base: " + info.baseTotal;
  }

  function priceInfo(product) {
    if (isCadernosProduct(product)) {
      return cadernoPriceInfo(product);
    }

    var prices = product.prices || {};
    var fallbackKey = product.defaultPriceKey || Object.keys(prices)[0] || "";
    return priceForSize(product, state.selections.size || fallbackKey);
  }

  // CONFIRM_REFORMAT_V1: priceSummaryText agora usa "X € por cada Y" em vez
  // de "X €/Y", e "(com N% de desconto)" em vez de "(N% de desconto)".
  // A substituição é feita só aqui para não afectar outros sítios que
  // dependem do formato compacto "0,98 €/íman" (ex.: pack-price overview).
  function priceSummaryText(info) {
    if (!info.total) {
      return "";
    }

    var perUnitText = String(info.perPin || "").replace(/\s*\/\s*/, " por cada ");
    return info.total + ", ou seja: " + perUnitText + (info.discount > 0 ? " (devido aos " + info.discount + "% de desconto)" : "");
  }

  // DELIVERY_OPTIONS_3_V1: defaults globais alinhados com o pedido — três
  // opções, sem "Sem portes" como label, com "Grátis" mostrado em vez de
  // "0,00 €" via deliveryPriceText. priceText em multi-linha usa "\n" e é
  // renderizado com white-space: pre-line (CSS).
  function defaultDeliveryOptions() {
    return [
      { id: "pickup", label: "Vou recolher na casa da Mia", text: "", feeCents: 0 },
      { id: "shipping", label: "Envio CTT - até 2 Kg", text: "", feeCents: 850, priceText: "Valor mínimo:\n8,50 €" },
      { id: "join_orders", label: "Junta as minhas encomendas", text: "", feeCents: 0 }
    ];
  }

  function deliveryOptions(product) {
    return product && Array.isArray(product.deliveryOptions) && product.deliveryOptions.length
      ? product.deliveryOptions
      : defaultDeliveryOptions();
  }

  // DELIVERY_CONTACT_STEP_V1: getDeliveryOption deixou de mutar state.selections.
  // Continua a devolver a primeira opção como fallback de display/preço, mas
  // state.selections.delivery_option só é escrito quando o utilizador clica
  // num radio. Isto permite que o novo passo "Entrega e contacto" exija uma
  // escolha activa (validateStep verifica state.selections.delivery_option).
  function getDeliveryOption(product) {
    var options = deliveryOptions(product);
    var selected = state.selections.delivery_option || "";
    var found = options.filter(function (option) {
      return option.id === selected;
    })[0];

    if (found) {
      return found;
    }

    return options[0] || { id: "", label: "", text: "", feeCents: 0 };
  }

  function itemImageNumber(item, key, fallback, min, max) {
    var value = Number(item && item[key]);

    if (!isFinite(value)) {
      value = fallback;
    }

    return Math.max(min, Math.min(max, value));
  }

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
        '--uploaded-image:url(&quot;' + escapeHtml(item.image) + '&quot;)',
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
    return !!(item && item.sideImage && (/^data:image\//.test(item.sideImage) || /^content\/(?:uploads|designs)\/[-a-zA-Z0-9_./]+$/.test(item.sideImage)));
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
      '--uploaded-image:url(&quot;' + escapeHtml(item.sideImage) + '&quot;)',
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
      '--uploaded-image:url(&quot;' + escapeHtml(item.image) + '&quot;)',
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

      return '<span class="' + className + itemRectOrientationClass(item) + ' uploaded-image' + (isActive ? ' is-admin-image-active' : '') + '" style="' + frameInfo.style + '"' + (adminAttrs ? "" : ' aria-hidden="true"') + adminAttrs + miaSlotDebugFrameAttrs(frameInfo.debug) + '><span class="uploaded-image-inner"></span></span>';
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
      && ["crachas", "imanes", "caderninhos", "cadernos"].indexOf(product.slug) !== -1
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

  // CRACHAS_SECTIONS_V1 + SECTIONED_STEP_ORDERING_V1 + SECTION_DISPLAY_LABELS_V1 + MINI_CADERNOS_QUANTITY_LABEL_FIX_V1 + CRACHAS_SIZE_BEFORE_QUANTITY_V1 + CRACHAS_STEP2_SIZE_LAYOUT_V1 + CRACHAS_STEP2_SELECTED_DESIGNS_CLEANUP_V2 + CRACHAS_STEP2_SIDE_PHOTO_FIX_V3 + CRACHAS_STEP2_SIDE_PHOTO_ADMIN_V4 + CRACHAS_STEP2_SIZE_CARD_NO_JUMP_V4 + CRACHAS_STEP2_SIDE_IMAGE_UPLOAD_V5 + CRACHAS_PACK_DISABLED_MESSAGE_V1 + CRACHAS_STEP2_MOBILE_COLUMNS_FIX_V6 + PACK_PRICE_OVERVIEW_SIMPLIFIED_V1 + STEP_ACTIONS_STICKY_MOBILE_V1 + PACK_PRICE_OVERVIEW_SENTENCE_V2 + PACK_PRICE_OVERVIEW_THREE_COL_V3 + IMANES_STEP2_SUMMARY_REUSE_V1 + IMANES_SIZE_CARD_TRIM_V1 + PACK_DISCOUNT_FALLBACK_BASELINE_V1 + PACK_PRICE_LABELS_BELOW_V1 + PACK_SELECTION_STYLE_CONSISTENCY_V1 + CRACHAS_SIZE_CARD_LAYOUT_TOGGLE_V1 + SMART_QUANTITIES_V1 + SMART_QUANTITIES_V2_PACK_BASELINE + PACK_PRICE_OVERVIEW_3COL_CENTERED_V4 + PACK_PRICE_OVERVIEW_PRO_V5 + PACK_PRICE_OVERVIEW_V5_ICONS_LEFT + DELIVERY_CONTACT_STEP_V1 + REORDER_CONTACT_BLOCK_V1 + DELIVERY_OPTIONS_3_V1 + CONFIRM_REFORMAT_V1 + COOKIE_BANNER_V1 + ADMIN_LOGIN_PT_LOG_V1 + FUNNEL_TRACKING_V1 + FUNNEL_DASHBOARD_V1 + CRACHAS_SECTIONS_4_V1 + CONFIRM_DISCOUNT_LABEL_V2 + COPY_REQUEST_AUTOCHECK_V1 + CONTACT_VALIDATION_V1 + STEP_LIST_MOBILE_FIT_V1
  // O passo "designs" e renderizado por seccoes (visiveis ou invisiveis)
  // conforme a tabela de configuracao por slug. Defaults sao runtime: nao
  // tocamos em content/products/<slug>.json ate ao primeiro SAVE pelo admin.
  // Items sem sectionId caem na primeira seccao; items sem sectionOrder
  // ficam depois dos que tem ordem, mantendo a ordem original do JSON.
  // CRACHAS_SECTIONS_4_V1: a secção "Crianças" foi acrescentada à lista de
  // defaults para não ser truncada por ensureStepSections (que força
  // step.sections.length = defaults.length). Sem isto, "Gerais" desaparece
  // porque "criancas" passou a estar antes na ordem do JSON.
  var CRACHAS_DEFAULT_SECTIONS = [
    { id: "porto-2026", title: "Cidade do Porto", labelPrefix: "Porto" },
    { id: "restelo", title: "Cidade de Lisboa e Restelo", labelPrefix: "Lisboa" },
    { id: "criancas", title: "Crianças", labelPrefix: "Criança" },
    { id: "felicidade-eterna", title: "Felicidade Eterna", labelPrefix: "Felicidade" }
  ];

  var IMANES_DEFAULT_SECTIONS = [
    { id: "novidades", title: "Novidades", labelPrefix: "Esperança" },
    { id: "verticais", title: "Ímanes Verticais", labelPrefix: "Vertical" },
    { id: "horizontais", title: "Ímanes Horizontais", labelPrefix: "Horizontal" }
  ];

  var INVISIBLE_GROUPS_2 = [
    { id: "grupo-1", title: "Grupo 1", labelPrefix: "" },
    { id: "grupo-2", title: "Grupo 2", labelPrefix: "" }
  ];

  function getStepSectionConfig(product, step) {
    if (!product || !step || step.id !== "designs") {
      return null;
    }
    if (product.slug === "crachas") {
      return { mode: "visible", defaults: CRACHAS_DEFAULT_SECTIONS };
    }
    if (product.slug === "imanes") {
      return { mode: "visible", defaults: IMANES_DEFAULT_SECTIONS };
    }
    if (product.slug === "caderninhos" || product.slug === "cadernos" || product.slug === "lembrancas") {
      return { mode: "invisible", defaults: INVISIBLE_GROUPS_2 };
    }
    return null;
  }

  // Backwards-compat wrapper. Mantido para o codigo existente que usa este
  // nome continuar a funcionar como "tem seccoes definidas?".
  function isCrachasDesignsContext(product, step) {
    return !!getStepSectionConfig(product, step);
  }

  function ensureStepSections(step, defaults) {
    var i;
    var current;

    if (!step || !Array.isArray(step.sections) || step.sections.length === 0) {
      step.sections = defaults.map(function (entry) {
        return { id: entry.id, title: entry.title, labelPrefix: entry.labelPrefix || "" };
      });
      return step.sections;
    }

    for (i = 0; i < defaults.length; i += 1) {
      current = step.sections[i];
      if (!current || typeof current !== "object") {
        step.sections[i] = { id: defaults[i].id, title: defaults[i].title, labelPrefix: defaults[i].labelPrefix || "" };
      } else {
        if (!current.id) {
          current.id = defaults[i].id;
        }
        if (typeof current.title !== "string" || current.title === "") {
          current.title = defaults[i].title;
        }
        if (typeof current.labelPrefix !== "string") {
          current.labelPrefix = defaults[i].labelPrefix || "";
        }
      }
    }
    step.sections.length = defaults.length;
    return step.sections;
  }

  // Mantido como alias retro-compativel de uma chamada anterior.
  function ensureCrachasSections(step) {
    return ensureStepSections(step, CRACHAS_DEFAULT_SECTIONS);
  }

  function pad2(n) {
    var v = String(Math.max(0, Math.floor(Number(n) || 0)));
    return v.length === 1 ? "0" + v : v;
  }

  function buildSectionDisplayLabels(step, sections, grouped) {
    var labels = {};

    sections.forEach(function (section) {
      var bucket = grouped[section.id] || [];
      var prefix = (section.labelPrefix || "").trim();
      bucket.forEach(function (entry, i) {
        if (!entry.item || !entry.item.id) {
          return;
        }
        if (prefix) {
          labels[entry.item.id] = prefix + " " + pad2(i + 1);
        }
      });
    });

    return labels;
  }

  function displayItemTitle(item) {
    if (!item) {
      return "";
    }
    if (state.itemDisplayLabels && item.id && state.itemDisplayLabels[item.id]) {
      return state.itemDisplayLabels[item.id];
    }
    return item.title || "";
  }

  function groupItemsBySection(items, sections) {
    var fallbackId = sections[0] && sections[0].id;
    var byId = {};
    sections.forEach(function (section) {
      byId[section.id] = [];
    });

    (items || []).forEach(function (item, originalIndex) {
      var key = item && item.sectionId && byId[item.sectionId] ? item.sectionId : fallbackId;
      byId[key].push({ item: item, originalIndex: originalIndex });
    });

    Object.keys(byId).forEach(function (key) {
      byId[key].sort(function (a, b) {
        var aRaw = a.item && a.item.sectionOrder;
        var bRaw = b.item && b.item.sectionOrder;
        var aNum = Number(aRaw);
        var bNum = Number(bRaw);
        var aHas = aRaw != null && aRaw !== "" && isFinite(aNum);
        var bHas = bRaw != null && bRaw !== "" && isFinite(bNum);

        if (aHas && bHas) {
          if (aNum !== bNum) {
            return aNum - bNum;
          }
          return a.originalIndex - b.originalIndex;
        }
        if (aHas) {
          return -1;
        }
        if (bHas) {
          return 1;
        }
        return a.originalIndex - b.originalIndex;
      });
    });

    return byId;
  }

  function renderDesignActionControls(product, step) {
    var supported = supportsAssortedDesigns(product) && step && step.id === "designs" && step.selection === "multi";
    var items = step && Array.isArray(step.items) ? step.items : [];
    var selected = selectedValues(step || {});
    var allSelected = items.length > 0 && selected.length === items.length;
    var assorted = isAssortedSelected(product);
    var selectAllLabel = !assorted && allSelected ? "Limpar Seleção" : "Selecionar tudo";

    if (!supported || state.admin) {
      return "";
    }

    return [
      '<div class="design-action-grid" aria-label="Ações rápidas de seleção">',
      '<button class="choice-card design-action-card' + (!assorted && allSelected ? ' is-selected' : '') + '" type="button" data-select-all-designs data-track="true" data-track-action="select_all_designs" data-track-id="select_all_designs">',
      '<span class="design-action-icon" aria-hidden="true">✓</span>',
      '<span class="choice-copy">',
      '<strong>' + escapeHtml(selectAllLabel) + '</strong>',
      '</span>',
      '</button>',
      '<button class="choice-card design-action-card' + (assorted ? ' is-selected' : '') + '" type="button" data-assorted-designs data-track="true" data-track-action="select_assorted" data-track-id="assorted_designs">',
      '<span class="design-action-icon" aria-hidden="true">★</span>',
      '<span class="choice-copy">',
      '<strong>Sortido</strong>',
      '</span>',
      '</button>',
      '</div>',
      assorted ? '<p class="open-order-hint design-action-message" role="status">Podes passar para o próximo passo. Nota: se escolheres algum design, a opção "Sortido" vai ser automaticamente desmarcada.</p>' : ""
    ].join("");
  }

  function renderAssortedSelectedSummary() {
    return [
      '<section class="crachas-step2-summary assorted-step-summary" aria-label="Designs escolhidos">',
      '<h3 class="crachas-step2-summary-title">Designs que vais encomendar:</h3>',
      '<p class="assorted-pill">Sortido — a Mia escolhe os designs</p>',
      '</section>'
    ].join("");
  }

  function renderSectionedDesignChoiceItems(product, step) {
    var config = getStepSectionConfig(product, step);
    if (!config) {
      return "";
    }

    var type = step.selection === "multi" ? "checkbox" : "radio";
    var selected = selectedValues(step);
    var sections = ensureStepSections(step, config.defaults);
    var grouped = groupItemsBySection(step.items, sections);

    state.itemDisplayLabels = buildSectionDisplayLabels(step, sections, grouped);

    function renderItemCard(item) {
      var checked = selected.indexOf(item.value) !== -1 ? " checked" : "";
      var media = renderDesignCardMedia(product, step, item);
      var note = item.note ? '<span class="choice-note">' + escapeHtml(item.note) + '</span>' : "";

      return [
        '<label class="choice-card design-grid">',
        '<input type="' + type + '" name="' + escapeHtml(step.field) + '" value="' + escapeHtml(item.value) + '" data-choice-step="' + escapeHtml(step.id) + '"' + checked + '>',
        media,
        '<span class="choice-copy">',
        '<strong>' + escapeHtml(displayItemTitle(item)) + '</strong>',
        '<span>' + escapeHtml(item.subtitle) + '</span>',
        note,
        '</span>',
        adminItemControls(step, item),
        '</label>'
      ].join("");
    }

    if (config.mode === "invisible") {
      // Sem titulos no site publico. Em admin emitimos os titulos como
      // ajuda para o admin perceber a estrutura, mas em estilo discreto.
      var rowsAll = "";
      sections.forEach(function (section) {
        var bucket = grouped[section.id] || [];

        if (state.admin) {
          rowsAll += [
            '<div class="design-grid-section design-grid-section-invisible' + (bucket.length === 0 ? ' is-empty' : '') + '" data-section-id="' + escapeHtml(section.id) + '">',
            '<h3 class="design-grid-section-title is-admin-only">' + escapeHtml(section.title) + ' <span class="design-grid-section-hint">(grupo invisível no site público)</span></h3>',
            bucket.length === 0 ? '<p class="design-grid-section-empty">Sem itens neste grupo.</p>' : "",
            '<div class="design-grid">' + bucket.map(function (entry) { return renderItemCard(entry.item); }).join("") + '</div>',
            '</div>'
          ].join("");
        } else {
          rowsAll += bucket.map(function (entry) { return renderItemCard(entry.item); }).join("");
        }
      });

      if (state.admin) {
        return rowsAll + '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar opção</button>';
      }
      return renderDesignActionControls(product, step) + '<div class="design-grid">' + rowsAll + '</div>';
    }

    // Modo visivel: 3 (ou 2) seccoes com titulos e linha por baixo.
    var html = "";
    sections.forEach(function (section) {
      var bucket = grouped[section.id] || [];

      if (bucket.length === 0 && !state.admin) {
        return;
      }

      var rowsHtml = bucket.map(function (entry) { return renderItemCard(entry.item); }).join("");

      var emptyNote = bucket.length === 0 && state.admin
        ? '<p class="design-grid-section-empty">Sem itens atribuídos. Atribui um item a este separador para que apareça no site.</p>'
        : "";

      html += [
        '<section class="design-grid-section' + (bucket.length === 0 ? ' is-empty' : '') + '" data-section-id="' + escapeHtml(section.id) + '">',
        '<h3 class="design-grid-section-title">' + escapeHtml(section.title) + '</h3>',
        emptyNote,
        '<div class="design-grid">' + rowsHtml + '</div>',
        '</section>'
      ].join("");
    });

    return renderDesignActionControls(product, step) + html + (state.admin ? '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar opção</button>' : "");
  }

  // Alias retro-compativel.
  function renderCrachasDesignsBySection(product, step) {
    return renderSectionedDesignChoiceItems(product, step);
  }

  function renderChoiceItems(product, step, template) {
    var type = step.selection === "multi" ? "checkbox" : "radio";
    var selected = selectedValues(step);
    var gridClass = template === "media-list" ? "option-list" : template;
    var items = step.items || [];
    var html = "";

    if (template === "design-grid" && getStepSectionConfig(product, step)) {
      return renderSectionedDesignChoiceItems(product, step);
    }

    items.forEach(function (item) {
      var checked = selected.indexOf(item.value) !== -1 ? " checked" : "";
      var image = template === "text-grid" || template === "price-pack-grid"
        ? ""
        : (template === "design-grid" ? renderDesignCardMedia(product, step, item) : renderVisual(item, template, step));
      var note = item.note ? '<span class="choice-note">' + escapeHtml(item.note) + '</span>' : "";

      html += [
        '<label class="choice-card ' + escapeHtml(template) + '">',
        '<input type="' + type + '" name="' + escapeHtml(step.field) + '" value="' + escapeHtml(item.value) + '" data-choice-step="' + escapeHtml(step.id) + '"' + checked + '>',
        image,
        '<span class="choice-copy">',
        '<strong>' + escapeHtml(item.title) + '</strong>',
        '<span>' + escapeHtml(item.subtitle) + '</span>',
        note,
        '</span>',
        adminItemControls(step, item),
        '</label>'
      ].join("");
    });

    return renderDesignActionControls(product, step) + '<div class="' + escapeHtml(gridClass) + '">' + html + '</div>' + (state.admin ? '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar opção</button>' : "");
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
      step.template !== "quantity-builder" ? '<label>Tamanho moldura (%)<input type="number" min="40" max="300" step="1" value="' + escapeHtml(frameScaleValue) + '" data-admin-edit="frameScale" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
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
      '<label>Tamanho moldura (%)<input type="number" min="40" max="300" step="1" value="' + escapeHtml(sideFrameScale) + '" data-admin-side-edit="sideFrameScale" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
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
      if (quantity === current) {
        classes += " is-selected";
      }
      if (disabled) {
        classes += " is-disabled";
      }
      // CLICK_TRACKING_V1: data-track-* permite agregar quais packs são
      // mais escolhidos / quantos cliques falham (pack disabled).
      cards += [
        '<button class="' + classes + '" type="button" data-pack-quantity="' + quantity + '" data-track="true" data-track-action="select_pack" data-track-id="pack_' + quantity + '" data-track-label="' + escapeHtml(item.title + ' ' + item.subtitle) + '"' + (disabled ? ' data-pack-disabled="1" aria-disabled="true"' : '') + '>',
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
    var priceKeys = state.selections.size && prices[state.selections.size] ? [state.selections.size] : Object.keys(prices);
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

  function renderQuantityBuilder(product) {
    var items = selectedDesignItems(product);
    var packStep = findStep(product, "pack");
    var adjustHint = packStep && packStep.adjustHint ? packStep.adjustHint : "";
    var packQuantity;
    var total;
    var unassigned;
    var cards = "";

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

    if (key === "matte" && cover && cover.image) {
      return cover.image;
    }

    return images[key] || images.matte || (cover && cover.image) || (item && (item.exampleImage || item.image)) || "";
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
      ["caderno", "pack"].forEach(function (group) {
        var storeItem = null;
        var legacySlot = null;

        packStep.items.some(function (item) {
          var legacyKey;

          if (cadernoPurchaseImageGroup(item) !== group) {
            return false;
          }
          legacyKey = cadernoLegacyImageEditKey(product, "pack", item.id, "main");
          if (!storeItem) {
            storeItem = item;
          }
          if (item.imageEdits && item.imageEdits[legacyKey]) {
            legacySlot = item.imageEdits[legacyKey];
            storeItem = item;
            return true;
          }
          return false;
        });

        if (!storeItem) {
          return;
        }

        covers.forEach(function (cover) {
          ensureImageEditSlotCopied(
            storeItem,
            cadernoScopedImageEditKey(product, "pack", cover, group, "main"),
            legacySlot
          );
          ensureImageEditSlotCopied(
            storeItem,
            cadernoScopedImageEditKey(product, "pack", cover, group, "summary"),
            cadernoSummaryImageEditDefaults()
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
    var storeItem = cadernoPurchaseGroupStoreItem(product, item);
    var imageGroup = cadernoPurchaseImageGroup(item);
    var editKey = cadernoScopedImageEditKey(product, "pack", cover, imageGroup, "main");
    var fallbackKey = cadernoLegacyImageEditKey(product, "pack", storeItem && storeItem.id || item.id, "main");

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
      imageEdits: storeItem && storeItem.imageEdits ? storeItem.imageEdits : item.imageEdits,
      _imageEditKey: editKey,
      _imageEditFallbackKey: fallbackKey,
      _imageEditStoreItemId: storeItem && storeItem.id,
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
    preview._imageEditKey = cadernoScopedImageEditKey(product, "pack", cover, cadernoPurchaseImageGroup(item), "summary");
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
    var interior = cadernoCommonInteriorImages(product);

    if (cover) {
      frames.push({ image: cover, label: cadernoPreviewLabel(cover, true) });
    }

    if (!interior.length && item && Array.isArray(item.interiorImages)) {
      interior = item.interiorImages.filter(function (image) {
        return image && image !== cover;
      });
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
        return '<span class="cadernos-cover-preview-slide' + (index === 0 ? ' is-active' : '') + '" style="background-image:url(&quot;' + escapeHtml(frame.image) + '&quot;)"></span>';
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

  function renderCadernosCoverStep(product, step) {
    var selected = selectedValues(step);
    var html = "";

    (step.items || []).forEach(function (item) {
      var checked = selected.indexOf(item.value) !== -1 ? " checked" : "";
      var selectedClass = checked ? " is-selected" : "";
      var muted = selected.length && !checked ? " is-muted" : "";

      html += [
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
    });

    return '<div class="option-list size-choice-list crachas-size-card-list cadernos-cover-list">' + html + '</div>'
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
      promo ? '<p class="cadernos-info-note cadernos-info-note--promo" role="note">' + escapeHtml(promo) + '</p>' : "",
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
      '<label>Tamanho moldura (%)<input type="number" min="40" max="300" step="1" value="' + escapeHtml(frameScaleValue) + '" data-admin-edit="frameScale" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>',
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
  function renderDetailsForm(step) {
    var currentSection = null;
    var pendingAfterText = "";
    var html = "";
    var exampleVisible = state.selections.show_details_example !== false;
    var example = [
      '<div class="details-example"' + (exampleVisible ? "" : " hidden") + '>',
      '<img class="example-image" src="media_tiago/exemplo.jpg" alt="Exemplo de cartão de apresentação" loading="lazy">',
      '</div>'
    ].join("");

    function closeSection() {
      if (currentSection === null) {
        return;
      }
      html += '</div>';
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
          '<section class="details-section">',
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
        '<span>' + escapeHtml(field.label) + (field.required ? "" : " <small>(opcional)</small>") + '</span>',
        '<input class="' + (isMissing ? "is-missing" : "") + '" type="text" name="' + escapeHtml(field.name) + '" value="' + escapeHtml(state.selections[field.name] || "") + '" placeholder="' + escapeHtml(field.placeholder) + '" autocomplete="' + escapeHtml(field.autocomplete || "off") + '"' + (field.required ? " required" : "") + (isMissing ? ' aria-invalid="true"' : "") + ' data-detail-field>',
        '</label>',
        adminFieldControls(step, field, index)
      ].join("");
    });

    closeSection();

    return [
      '<button class="example-toggle" type="button" data-example-toggle>' + (exampleVisible ? "Ocultar exemplo" : "Ver exemplo") + '</button>',
      example,
      html,
      '<p class="privacy-note">Ao partilhar os teus dados, aceitas que estes sejam usados de acordo com a nossa <a href="privacy.html" target="_blank" rel="noopener">política de privacidade</a>.</p>'
    ].join("");
  }

  // DELIVERY_CONTACT_STEP_V1: novo passo "Entrega e contacto" que vive antes
  // do confirm. Junta numa única página: (1) escolha de entrega obrigatória
  // sem default visualmente seleccionado, (2) bloco "Dados de Contacto" com
  // ordem título → campos → texto explicativo (cumpre requisito global),
  // (3) reaproveita renderCrachasSelectedDesigns como "Designs que vais
  // receber". Os campos contact.fields são lidos/escritos directamente em
  // state.selections (mesmas keys que antes: customer_name, customer_contact)
  // para o submit final manter o payload inalterado.
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
    var fieldsHtml = fields.map(function (field) {
      var isMissing = state.invalidFields.indexOf(field.name) !== -1;
      return [
        '<label class="dc-field">',
        '<span>' + escapeHtml(field.label) + (field.required ? "" : " <small>(opcional)</small>") + '</span>',
        '<input class="' + (isMissing ? "is-missing" : "") + '" type="text" name="' + escapeHtml(field.name) + '" value="' + escapeHtml(state.selections[field.name] || "") + '" placeholder="' + escapeHtml(field.placeholder || "") + '" autocomplete="' + escapeHtml(field.autocomplete || "off") + '"' + (field.required ? " required" : "") + (isMissing ? ' aria-invalid="true"' : "") + ' data-detail-field>',
        '</label>'
      ].join("");
    }).join("");

    return [
      '<section class="dc-block dc-contact">',
      config.title ? '<h3 class="dc-block-title">' + escapeHtml(config.title) + '</h3>' : "",
      '<div class="dc-contact-grid">' + fieldsHtml + '</div>',
      // Phase B: texto explicativo aparece DEPOIS dos campos.
      config.noteAfter ? '<p class="dc-block-note">' + escapeHtml(config.noteAfter) + '</p>' : "",
      '</section>'
    ].join("");
  }

  function renderDeliveryContactDesigns(product) {
    // Reaproveita o componente "Designs que vais encomendar" — mas com o
    // título adaptado ao novo contexto ("Designs que vais receber").
    var items = selectedDesignItems(product);
    var showQuantityBadges = product && product.slug === "crachas";
    var designsStep;
    var tilesHtml;

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

    return title ? title + " (" + selected + ")" : selected;
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

    if (isCadernosProduct(product)) {
      var cover = selectedCadernoCover(product);
      var lamination = selectedCadernoLamination(product);
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
        ["Opção escolhida:", option ? option.title : ""]
      ];
      var cadernoPriceRows = [
        ["Preço:", cadernoPriceText],
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
        ["Email ou telemóvel:", state.selections.customer_contact || ""]
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
      ["Tamanho:", selectedSizeLabel(product)],
      ["Preço do produto:", priceLine],
      ["Portes:", shippingLine],
      [totalLabel, totalLine],
      ["Entrega:", deliveryText]
    ];

    var cardRows = [
      ["Nome para o cartão de apresentação:", state.selections.recipient_name || ""],
      ["Telemóvel ou Email:", state.selections.contact || "Não indicado"],
      ["Congregação:", state.selections.congregation || "Não indicado"],
      ["Oferta à congregação:", shouldShowGiftRequest(product) && state.selections.congregation_gift ? "Sim" : ""]
    ];

    var contactRows = [
      ["Nome de contacto:", state.selections.customer_name || ""],
      ["Email ou telemóvel:", state.selections.customer_contact || ""]
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
    var confirmTitle = product && product.slug === "crachas" ? '<h3 class="confirm-card-title">A tua encomenda:</h3>' : "";
    var designs;

    if (isCadernosProduct(product)) {
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

  // CONTACT_VALIDATION_V1: aplicado ao campo customer_contact em
  // delivery_contact. Devolve "" quando o valor é um email válido OU um
  // número de telemóvel válido (≥9 dígitos, com +<código> opcional). Caso
  // contrário devolve uma string de erro composta com a mensagem-base do
  // pedido + um detalhe específico para ajudar o utilizador a corrigir.
  //
  // Heurística: se o input tiver letras, assumimos que é tentativa de email
  // e aplicamos regexEmail; se não tiver letras, assumimos telemóvel e
  // verificamos só dígitos e comprimento.
  function validateContactInput(rawValue) {
    var value = String(rawValue || "").trim();
    var base = "Insere um número de telemóvel ou um endereço de email. Detalhes do erro: ";
    var hasLetters = /[a-zA-Z]/;
    var emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
    var phoneRegex = /^(?:\+?[0-9]{1,3})?[0-9]{9,12}$/;
    var onlyDigitsRegex = /^\+?[0-9]+$/;

    if (!value) {
      // Vazio cai no fluxo de "campo obrigatório" gerido no validateStep,
      // não emitimos mensagem específica aqui para não duplicar erros.
      return "";
    }

    if (hasLetters.test(value)) {
      if (!emailRegex.test(value)) {
        return base + "o formato do email é inválido (exemplo válido: nome@dominio.pt). Certifica-te que não tem espaços.";
      }
      return "";
    }

    // Sem letras → assume número de telemóvel. Limpa espaços e hifens
    // antes de validar.
    var cleaned = value.replace(/[\s-]/g, "");

    if (!cleaned || !onlyDigitsRegex.test(cleaned)) {
      return base + "o formato introduzido contém caracteres não permitidos.";
    }

    if (!phoneRegex.test(cleaned) || cleaned.replace("+", "").length < 9) {
      return base + "o número não parece ser um contacto válido (deve ter pelo menos 9 dígitos).";
    }

    return "";
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

    if (!product || product.slug !== "cadernos" || settings.enabled === false || !images.length) {
      return "";
    }

    return [
      '<aside class="interior-slideshow" style="--interior-slide-count:' + images.length + ';--interior-slide-speed:' + speed + 's" aria-label="' + escapeHtml(settings.title || "Pré-visualização do interior") + '">',
      '<div class="interior-slideshow-frame">',
      images.map(function (image, index) {
        return '<span class="interior-slide" style="background-image:url(&quot;' + escapeHtml(image) + '&quot;);--interior-slide-index:' + index + '"></span>';
      }).join(""),
      '</div>',
      '<div class="interior-slideshow-copy">',
      '<strong>' + escapeHtml(settings.title || "Pré-visualização do interior") + '</strong>',
      settings.text ? '<p>' + escapeHtml(settings.text) + '</p>' : "",
      '</div>',
      '</aside>'
    ].join("");
  }

  function stepBody(product, step) {
    if (isCadernosProduct(product) && step.id === "designs") {
      return renderCadernosCoverStep(product, step);
    }

    if (isCadernosProduct(product) && step.id === "lamination") {
      return renderCadernosLaminationStep(product, step) + renderCadernosBuildSummaryV2(product, step);
    }

    if (isCadernosProduct(product) && step.id === "pack") {
      return renderCadernosPurchaseOptions(product, step) + renderCadernosBuildSummaryV2(product, step);
    }

    if (isCadernosProduct(product) && step.template === "cover-personalization") {
      return renderCadernoPersonalizationStep(product, step) + renderCadernosBuildSummaryV2(product, step);
    }

    if (step.template === "quantity-builder") {
      return renderInteriorSlideshow(product) + renderQuantityBuilder(product);
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
      if (product && product.slug === "crachas") {
        return renderCrachasSizeStep(product, step);
      }
      if (product && product.slug === "imanes") {
        return renderSizeChoiceItems(product, step) + renderCrachasSelectedDesigns(product);
      }
      return renderSizeChoiceItems(product, step) + renderSelectedSummary(product);
    }

    return renderChoiceItems(product, step, step.template);
  }

  function visibleSteps(product) {
    var steps = product && Array.isArray(product.steps) ? product.steps : [];

    return state.admin ? steps : steps.filter(function (step) {
      return !step.hidden;
    });
  }

  function progressSteps(product) {
    var steps = state.admin ? visibleSteps(product) : productCartSteps(product);

    return steps.length ? steps : visibleSteps(product);
  }

  function displayStepNumber(product, step) {
    var steps = progressSteps(product);
    var index = steps.indexOf(step);

    return index >= 0 ? index + 1 : state.currentStep + 1;
  }

  function renderProgress(product) {
    var visibleNumber = 0;
    var visible = visibleSteps(product);
    var steps = progressSteps(product);

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
          '<li class="' + classes.join(" ") + '">',
          '<button type="button" data-jump-step="' + stepIndex + '" aria-label="Passo ' + visibleNumber + ': ' + escapeHtml(step.label) + '"' + (disabled ? " disabled" : "") + '>',
          '<span aria-hidden="true">' + visibleNumber + '</span>',
          '</button>',
          '</li>'
        ].join("");
      }).join(""),
      '</ol>'
    ].join("");
  }

  function displayStepText(product, step) {
    if (step && step.id === "pack" && isAssortedSelected(product)) {
      return "Escolhe apenas quantas unidades queres, nós tratamos do resto.";
    }
    return step && step.text ? step.text : "";
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

    renderChrome([
      '<main class="product-shell ' + productSlugClass(product) + ' ' + productShapeClass(product) + ' ' + productOrientationClass(product) + '">',
      renderBrand(product.brand, product.homeUrl, product.instagramUrl),
      '<section class="wizard-shell" aria-labelledby="step-title">',
      renderProgress(product),
      renderCartEditBar(),
      '<form id="order-form" action="' + escapeHtml(product.form.action) + '" method="post" novalidate>',
      '<input type="hidden" name="return_to" value="' + escapeHtml(product.form.returnTo) + '">',
      '<label class="hidden-field" aria-hidden="true"><span>Website</span><input type="text" name="website" tabindex="-1" autocomplete="off"></label>',
      '<div class="step-card">',
      '<p class="eyebrow">Passo ' + stepNumber + (state.admin && step.hidden ? ' · oculto' : '') + '</p>',
      '<h2 id="step-title">' + escapeHtml(step.title) + '</h2>',
      '<p>' + escapeHtml(displayStepText(product, step)) + '</p>',
      state.currentStep === 0 ? renderProductPreview(product) : "",
      stepBody(product, step),
      '</div>',
      cartEntry ? renderCartEntryActions(product) : [
      '<div class="step-actions">',
      '<button class="button secondary" type="button" data-back data-track="true" data-track-action="back" data-track-id="back">Voltar</button>',
      '<div class="next-action-wrap">',
      state.errors ? '<p class="form-error action-error" role="alert">' + escapeHtml(state.errors) + '</p>' : "",
      '<button class="button primary" type="' + (isLast ? "submit" : "button") + '" data-next data-track="true" data-track-action="' + (isLast ? 'submit' : 'next') + '" data-track-id="' + (isLast ? 'submit' : 'next') + '">' + escapeHtml(nextLabel) + '</button>',
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

    bindProduct(product);
    if (isCadernosProduct(product)) {
      initCadernoPreviewSlides();
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
    historyDelta = wizardHistorySupported() ? wizardHistoryDeltaToStep(next) : 0;

    if (historyDelta) {
      window.history.go(historyDelta);
      return;
    }

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

  function currentStep(product) {
    return visibleSteps(product)[state.currentStep];
  }

  function setSelection(step, input) {
    var values;

    if (step.selection === "multi") {
      if (step.id === "designs") {
        state.selections.assorted_designs = "";
      }
      values = state.selections[step.id] || [];
      state.selections[step.id] = input.checked
        ? Array.from(new Set(values.concat(input.value)))
        : values.filter(function (value) { return value !== input.value; });
      state.quantitySignature = "";
      state.quantitiesTouched = false;
      state.quantityPackBaseline = 0;
      return;
    }

    state.selections[step.id] = input.value;
  }

  function validateStep(product, step) {
    var field;
    var i;
    var missing = [];
    var total;
    var packQuantity;

    state.invalidFields = [];

    if (step.id === "designs" && selectedDesignItems(product).length === 0 && !isAssortedSelected(product)) {
      if (isCadernosProduct(product)) {
        return "Escolhe uma capa.";
      }
      return "Escolhe pelo menos um design ou a opção Sortido";
    }

    if (isCadernosProduct(product) && step.id === "pack") {
      if (!selectedCadernoPurchaseOption(product)) {
        return "Escolhe uma opção de compra.";
      }
      if (cadernoOrderQuantityOptions(product).indexOf(cadernoOrderQuantity(product)) === -1) {
        return "Escolhe uma quantidade válida.";
      }
      ensurePackAndQuantities(product);
      return "";
    }

    if (isCadernosProduct(product) && step.id === "cover_personalization") {
      if (!state.selections.cover_personalization) {
        return "Escolhe se queres personalizar a capa.";
      }

      if (state.selections.cover_personalization === "yes") {
        var personalizationText = cadernoPersonalizationText();
        var personalizationLimit = cadernoPersonalizationLimit(product);

        if (!personalizationText) {
          state.invalidFields = ["cover_personalization_text"];
          return "Escreve o nome ou frase para personalizar a capa.";
        }

        if (personalizationText.length > personalizationLimit) {
          state.invalidFields = ["cover_personalization_text"];
          return "O nome/frase tem de ter no máximo " + personalizationLimit + " caracteres.";
        }
      }

      return "";
    }

    if (step.id === "pack") {
      ensurePackAndQuantities(product);
      total = quantityTotal(product);
      packQuantity = getPackQuantity(product);

      if (!packQuantity) {
        return "Escolhe um pack.";
      }

      if (isAssortedSelected(product)) {
        return "";
      }

      if (total !== packQuantity) {
        if (total < packQuantity && selectedDesignItems(product).length >= 3) {
          return "Ainda há unidades sem design.";
        }

        return total < packQuantity ? "Ainda faltam unidades por distribuir." : "Tens unidades a mais neste pack.";
      }
    }

    if (step.selection === "single" && !state.selections[step.id]) {
      return "Escolhe uma opção.";
    }

    if (step.template === "details-form") {
      for (i = 0; i < step.fields.length; i += 1) {
        field = step.fields[i];
        if (field.required && !String(state.selections[field.name] || "").trim()) {
          missing.push(field.name);
        }
      }

      if (missing.length) {
        state.invalidFields = missing;
        return "Preenche os campos obrigatórios.";
      }
    }

    // DELIVERY_CONTACT_STEP_V1 + CONTACT_VALIDATION_V1: validação do novo
    // passo. Exige (1) escolha explícita de entrega, (2) campos
    // obrigatórios de contacto preenchidos, (3) que customer_contact seja
    // um email válido OU um número de telemóvel válido (regex em
    // validateContactInput).
    if (step.template === "delivery-contact") {
      if (!state.selections.delivery_option) {
        return "Escolhe como queres receber a tua encomenda.";
      }

      var contactFields = (step.contact && step.contact.fields) || [];
      for (i = 0; i < contactFields.length; i += 1) {
        field = contactFields[i];
        if (field.required && !String(state.selections[field.name] || "").trim()) {
          missing.push(field.name);
        }
      }

      if (missing.length) {
        state.invalidFields = missing;
        return "Preenche os dados de contacto.";
      }

      var contactError = validateContactInput(state.selections.customer_contact);
      if (contactError) {
        state.invalidFields = ["customer_contact"];
        return contactError;
      }
    }

    return "";
  }

  function goNext(product) {
    var step = currentStep(product);
    var error = state.admin ? "" : validateStep(product, step);

    if (error) {
      // FUNNEL_TRACKING_V1: regista validações falhadas com o ID do passo.
      // TRANSITION_REASON_V1: marca que a próxima transição foi causada por
      // falha de validação (não vai haver, mas se houver redirect lateral...)
      var errCount = state.invalidFields && state.invalidFields.length ? state.invalidFields.length : 1;
      trackProductEvent(product, 'validation_error', {
        step_id: step ? step.id : '',
        step_index: state.currentStep,
        transition_reason: 'validation_failed',
        validation_error_count: errCount
      });
      state.errors = error;
      rerenderProduct(product);
      focusProductFirstError();
      return;
    }

    // FUNNEL_TRACKING_V1: passo concluído com sucesso. Em delivery_contact
    // dispara também contact_completed (funil mais granular).
    trackProductEvent(product, 'step_completed', {
      step_id: step ? step.id : '',
      step_index: state.currentStep
    });
    if (step && step.id === 'delivery_contact') {
      // FUNNEL_TRACKING_SQLITE_V2: deixou de enviar customer_name/email no
      // tracking. Os dados pessoais ficam em `orders` (Fase 2), não em
      // `funnel_events`. O contact_completed continua a ser registado
      // como marco do funil sem PII.
      trackProductEvent(product, 'contact_completed', {
        step_id: step.id
      });
    }

    if (step.id === "designs") {
      ensurePackAndQuantities(product);
    }

    state.errors = "";
    state.packDisabledMessage = "";
    setCurrentStep(product, state.currentStep + 1);
    pushWizardHistory(product);
    rerenderProduct(product);
  }

  function bindProduct(product) {
    var form = document.querySelector("#order-form");
    var back = document.querySelector("[data-back]");
    var next = document.querySelector("[data-next]");
    var step = currentStep(product);

    document.querySelectorAll("[data-select-all-designs]").forEach(function (button) {
      button.addEventListener("click", function () {
        var designStep = findStep(product, "designs");
        var allValues = designStep && Array.isArray(designStep.items) ? designStep.items.map(function (item) { return item.value; }).filter(Boolean) : [];
        var currentValues = selectedDesignValues();
        var allSelected = allValues.length > 0 && currentValues.length === allValues.length;

        state.selections.assorted_designs = "";
        state.selections.designs = allSelected ? [] : allValues;
        if (!allSelected) {
          state.selections.congregation_gift = false;
        }
        resetQuantityState();
        // SEMANTIC_EVENTS_V1: option_selected meta para "select all" ou unselect all
        try { trackOptionSelected(product, 'select_all_designs', allSelected ? 'cleared' : 'all', ''); } catch (e) {}
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-assorted-designs]").forEach(function (button) {
      button.addEventListener("click", function () {
        var active = isAssortedSelected(product);

        state.selections.assorted_designs = active ? "" : "1";
        if (!active) {
          state.selections.designs = [];
          state.selections.congregation_gift = false;
        }
        resetQuantityState();
        // SEMANTIC_EVENTS_V1
        try { trackOptionSelected(product, 'assorted', active ? 'off' : 'on', ''); } catch (e) {}
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-choice-step]").forEach(function (input) {
      input.addEventListener("change", function () {
        // SEMANTIC_EVENTS_V1 (Phase C): captura semantic ANTES de mutar state
        // para podermos distinguir select vs unselect e ler o value correcto.
        try {
          if (step && step.id === 'designs') {
            // Multi (crachas/imanes/caderninhos): checked vs unchecked
            // Single (cadernos): change sempre seleciona um novo
            if (step.selection === 'multi') {
              trackDesignToggle(product, input.value, !!input.checked);
            } else {
              trackDesignToggle(product, input.value, true);
            }
          } else if (step && step.id) {
            // Outras steps com data-choice-step: option_selected
            // (lamination, cover_personalization, size, ...)
            var optType = step.id;
            // Para cover_personalization, normalizar para yes/no apenas.
            var optVal = input.value;
            var optLabel = '';
            var labelEl = input.closest && input.closest('label');
            if (labelEl) {
              optLabel = (labelEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
            }
            trackOptionSelected(product, optType, optVal, optLabel);
          }
        } catch (e) {}

        setSelection(step, input);
        if (step && step.id === "cover_personalization" && input.value === "no") {
          state.selections.cover_personalization_text = "";
        }
        state.errors = "";
        state.packDisabledMessage = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-pack-quantity]").forEach(function (button) {
      button.addEventListener("click", function () {
        var newPackQuantity = Number(button.dataset.packQuantity);

        // CRACHAS_PACK_DISABLED_MESSAGE_V1: pack cinzento nao seleciona,
        // mostra mensagem curta junto aos packs.
        if (button.dataset.packDisabled === "1") {
          state.packDisabledMessage = packDisabledMessageFor(product, newPackQuantity);
          rerenderProduct(product);
          return;
        }

        // SMART_QUANTITIES_V1: o redimensionamento das quantidades é feito
        // por ensurePackAndQuantities, que escolhe entre scaleQuantities
        // (proporcional) e distributeQuantities (reset) consoante a
        // configuração admin "Quantidades inteligentes".
        state.packDisabledMessage = "";
        state.selections.pack_quantity = newPackQuantity;
        // SEMANTIC_EVENTS_V1: pack option chosen.
        try {
          var packLabel = '';
          if (button.dataset && button.dataset.trackLabel) packLabel = button.dataset.trackLabel;
          // Para cadernos a step "pack" pode ser caderno_normal/caderno_pioneiro
          // (item.value) — usamos o data-track-id quando existir.
          var optType = 'pack';
          var optValue = newPackQuantity;
          if (step && step.id === 'pack' && button.dataset && button.dataset.trackId) {
            // Para cadernos o button representa um purchase option (caderno_normal/pioneiro)
            var trackId = button.dataset.trackId || '';
            if (trackId.indexOf('cadernos_option_') === 0) {
              optType = 'purchase_option';
            }
          }
          trackOptionSelected(product, optType, optValue, packLabel);
        } catch (e) {}

        ensurePackAndQuantities(product);
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-caderno-order-quantity]").forEach(function (button) {
      button.addEventListener("click", function () {
        var qty = Number(button.dataset.cadernoOrderQuantity);
        state.selections.caderno_order_quantity = qty;
        // SEMANTIC_EVENTS_V1
        try { trackOptionSelected(product, 'caderno_qty', qty, ''); } catch (e) {}
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-quantity-plus]").forEach(function (button) {
      button.addEventListener("click", function () {
        var value = button.dataset.quantityPlus;
        var donor = donorFor(product, value);
        var changed = selectedDesignItems(product).length >= 3
          ? assignOnePin(product, value)
          : moveOnePin(product, donor, value);

        if (changed) {
          state.errors = "";
          rerenderProduct(product);
        }
      });
    });

    document.querySelectorAll("[data-quantity-minus]").forEach(function (button) {
      button.addEventListener("click", function () {
        var value = button.dataset.quantityMinus;
        var receiver = nextDesignValue(product, value);
        var changed = selectedDesignItems(product).length >= 3
          ? removeOnePin(product, value)
          : moveOnePin(product, value, receiver);

        if (changed) {
          state.errors = "";
          rerenderProduct(product);
        }
      });
    });

    document.querySelectorAll("[data-auto-distribute]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.selections.design_quantities = distributeQuantities(selectedDesignItems(product), getPackQuantity(product));
        state.quantitiesTouched = false;
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-detail-field]").forEach(function (input) {
      input.addEventListener("input", function () {
        state.selections[input.name] = input.value;
        if (step && step.template === "details-form") {
          saveCardDetailsSessionField(input.name, input.value);
        }
        if (input.name === "customer_contact" && state.selections.send_copy && !state.selections.copy_email && isValidEmail(input.value)) {
          state.selections.copy_email = String(input.value).trim();
        }
        if (String(input.value || "").trim()) {
          input.classList.remove("is-missing");
          input.removeAttribute("aria-invalid");
          state.invalidFields = state.invalidFields.filter(function (name) {
            return name !== input.name;
          });
        }
        // FUNNEL_TRACKING_V1: contact_started uma única vez por sessão,
        // disparado quando o utilizador começa a escrever em qualquer
        // campo de contacto (customer_name ou customer_contact).
        if (input.name === 'customer_name' || input.name === 'customer_contact') {
          maybeFireContactStarted(product);
          // OPEN_ORDER_HINT_V1: agendar check debounced quando os dois
          // campos têm um valor mínimo plausível. NUNCA mostra detalhes
          // — endpoint só devolve boolean.
          scheduleOpenOrderCheck(product);
        }
      });
      input.addEventListener("change", function () {
        state.selections[input.name] = input.value;
        if (step && step.template === "details-form") {
          saveCardDetailsSessionField(input.name, input.value);
        }
      });
    });

    document.querySelectorAll("[data-delivery-option]").forEach(function (input) {
      input.addEventListener("change", function () {
        state.selections.delivery_option = input.value;
        // FUNNEL_TRACKING_V1: regista escolha de entrega antes de re-renderizar.
        trackProductEvent(product, 'delivery_selected', {
          selected_delivery: input.value
        });
        // SEMANTIC_EVENTS_V1
        try {
          var labelTxt = '';
          var lab = input.closest && input.closest('label');
          if (lab) labelTxt = (lab.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
          trackOptionSelected(product, 'delivery', input.value, labelTxt);
        } catch (e) {}
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-gift-toggle]").forEach(function (input) {
      input.addEventListener("change", function () {
        state.selections.congregation_gift = input.checked;
      });
    });

    document.querySelectorAll("[data-copy-toggle]").forEach(function (input) {
      input.addEventListener("change", function () {
        state.selections.send_copy = input.checked;
        // COPY_REQUEST_AUTOCHECK_V1: marcar que o utilizador interagiu
        // manualmente para a heurística de auto-tick deixar de ligar a
        // checkbox quando o utilizador a desligou.
        state.selections.send_copy_touched = true;
        if (input.checked && !state.selections.copy_email && isValidEmail(state.selections.customer_contact)) {
          state.selections.copy_email = String(state.selections.customer_contact).trim();
        } else if (!input.checked) {
          state.selections.copy_email = "";
        }
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-copy-email]").forEach(function (input) {
      input.addEventListener("input", function () {
        state.selections.copy_email = input.value;
      });
      input.addEventListener("change", function () {
        state.selections.copy_email = input.value;
      });
    });

    document.querySelectorAll("[data-example-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.selections.show_details_example = !(state.selections.show_details_example !== false);
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-caderno-personalization-example-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.selections.show_caderno_personalization_example = !(state.selections.show_caderno_personalization_example !== false);
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-cover-personalization-text]").forEach(function (input) {
      input.addEventListener("input", function () {
        var limit = Number(input.dataset.coverPersonalizationLimit || 25);
        var help = document.querySelector("#cover-personalization-help");
        var count = document.querySelector("[data-cover-personalization-count]");

        state.selections.cover_personalization_text = input.value;
        if (count) {
          count.textContent = "(" + input.value.length + " / " + limit + ")";
        }
        if (!input.value.trim() && state.invalidFields.indexOf("cover_personalization_text") !== -1) {
          input.classList.add("is-missing");
          input.setAttribute("aria-invalid", "true");
          if (help) {
            help.className = "form-error";
            help.setAttribute("role", "alert");
            help.textContent = "Escreve o nome ou frase para personalizar a capa.";
          }
        } else if (input.value.length > limit) {
          input.classList.add("is-missing");
          input.setAttribute("aria-invalid", "true");
          if (help) {
            help.className = "form-error";
            help.setAttribute("role", "alert");
            help.textContent = "O nome/frase tem de ter no máximo " + limit + " caracteres.";
          }
        } else {
          input.classList.remove("is-missing");
          input.removeAttribute("aria-invalid");
          if (help) {
            help.className = "details-section-note";
            help.removeAttribute("role");
            help.textContent = "Máximo de " + limit + " caracteres.";
          }
          state.invalidFields = state.invalidFields.filter(function (name) {
            return name !== "cover_personalization_text";
          });
        }
        refreshCadernosBuildSummary(product);
      });
      input.addEventListener("change", function () {
        state.selections.cover_personalization_text = input.value;
      });
    });

    if (back) {
      back.addEventListener("click", function () {
        state.errors = "";
        if (state.currentStep === 0) {
          if (state.editingCartItemId) {
            cancelCartItemEdit();
            return;
          }
          window.location.href = product.homeUrl || "index.html";
          return;
        }
        // TRANSITION_REASON_V1
        funnelNextTransitionReason = 'back_button';
        goToWizardStep(product, state.currentStep - 1);
      });
    }

    if (next) {
      next.addEventListener("click", function () {
        if (state.currentStep < visibleSteps(product).length - 1) {
          // TRANSITION_REASON_V1
          funnelNextTransitionReason = 'next_button';
          goNext(product);
        }
      });
    }

    document.querySelectorAll("[data-cart-add-another]").forEach(function (button) {
      button.addEventListener("click", function () {
        addCurrentProductToCart(product, "adicionar-produto.html");
      });
    });

    document.querySelectorAll("[data-cart-finalize-current]").forEach(function (button) {
      button.addEventListener("click", function () {
        addCurrentProductToCart(product, "checkout.html");
      });
    });

    document.querySelectorAll("[data-cart-save-edit]").forEach(function (button) {
      button.addEventListener("click", function () {
        saveEditedCartItem(product);
      });
    });

    document.querySelectorAll("[data-cart-cancel-edit]").forEach(function (button) {
      button.addEventListener("click", function () {
        cancelCartItemEdit();
      });
    });

    document.querySelectorAll("[data-jump-step]").forEach(function (button) {
      button.addEventListener("click", function () {
        // TRANSITION_REASON_V1
        funnelNextTransitionReason = 'direct_step_click';
        goToWizardStep(product, Number(button.dataset.jumpStep));
      });
    });

    if (form) {
      form.addEventListener("submit", function (event) {
        var allPreviousValid = visibleSteps(product).slice(0, -1).map(function (candidate) {
          return validateStep(product, candidate);
        }).filter(Boolean)[0];

        if (allPreviousValid) {
          event.preventDefault();
          // FUNNEL_TRACKING_V1: erro de validação em submit final.
          trackProductEvent(product, 'validation_error', {
            step_id: 'submit',
            step_index: state.currentStep
          });
          state.errors = allPreviousValid;
          rerenderProduct(product);
          focusProductFirstError();
          return;
        }

        // FUNNEL_TRACKING_SQLITE_V2: pedido enviado com sucesso. Disparado
        // antes do navegador iniciar a navegação para send-order.php
        // (sendBeacon sobrevive ao unload). Não inclui PII.
        // SELECTION_SNAPSHOT_V1 (Phase 4): snapshot final no envio.
        var submitExtras = { step_id: 'submit' };
        try {
          var submitSnap = funnelBuildSelectionSnapshot(product);
          if (submitSnap) submitExtras.selection_json = submitSnap;
        } catch (e) {}
        trackProductEvent(product, 'order_submitted', submitExtras);

        addHiddenFields(form, product);
      });
    }

    bindImageViewerTriggers();
    bindAdminItemEditing(product);
  }

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
    var allowed = { crachas: true, imanes: true, caderninhos: true, cadernos: true };
    return (home.categories || []).filter(function (category) {
      return category && allowed[category.id] && homeCategoryIsVisible(category);
    });
  }

  function renderAddProductCategoryCard(category, index, home) {
    var carouselImages = home.carousel && home.carousel.enabled !== false && category.carouselEnabled !== false
      ? (category.carouselImages || [])
      : [];
    var hasCarousel = carouselImages.length > 0;
    var hasStaticImage = category.image && !hasCarousel;
    var imageClass = hasCarousel ? " has-carousel" : (hasStaticImage ? " has-image" : "");
    var globalSpeedSeconds = Number(home.carousel && home.carousel.speedSeconds) || 8;
    var globalZoomPercent = Number(home.carousel && home.carousel.zoomPercent) || 108;
    var globalOverlayOpacity = Number(home.carousel && home.carousel.overlayOpacity) || 36;
    var globalPanPercent = Number(home.carousel && home.carousel.panPercent) || 6;
    var effSpeed = Math.max(3, Math.min(30, effectiveCarouselValue(category, "carouselSpeedSeconds", globalSpeedSeconds)));
    var effZoom = Math.max(100, Math.min(140, effectiveCarouselValue(category, "carouselZoomPercent", globalZoomPercent)));
    var effOverlay = Math.max(0, Math.min(80, effectiveCarouselValue(category, "carouselOverlayOpacity", globalOverlayOpacity)));
    var effPan = Math.max(0, Math.min(18, effectiveCarouselValue(category, "carouselPanPercent", globalPanPercent)));
    var carouselStyle = hasCarousel ? ' style="--carousel-speed:' + escapeHtml(effSpeed) + 's;--carousel-zoom-scale:' + escapeHtml((effZoom / 100).toFixed(3)) + ';--carousel-overlay:' + escapeHtml((effOverlay / 100).toFixed(2)) + ';--carousel-pan:' + escapeHtml(effPan) + '%"' : "";
    var imageStyle = hasStaticImage ? ' style="--category-image:url(&quot;' + escapeHtml(category.image) + '&quot;)"' : carouselStyle;
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
      '<main class="home-shell add-product-shell">',
      renderBrand(home.brand || "Mia & Paper", "index.html", home.instagramUrl),
      '<section class="home-intro add-product-intro" aria-labelledby="add-product-title">',
      '<p class="eyebrow">Carrinho</p>',
      '<h1 id="add-product-title">O que queres acrescentar ao teu pedido?</h1>',
      count ? renderCheckoutCartItems({ allowRemove: false, allowEdit: false }) : '<p class="cart-panel-note">Ainda não adicionaste nenhum produto ao pedido.</p>',
      count ? '<a class="button primary add-product-checkout-link" href="' + escapeHtml(checkoutHref) + '" data-add-product-checkout>Finalizar pedido</a>' : "",
      '</section>',
      '<nav class="category-grid category-grid-count-' + Math.max(1, Math.min(4, categories.length)) + '" aria-label="Produtos para adicionar ao pedido">',
      cards,
      '</nav>',
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

  function loadCheckoutDeliveryOptions() {
    var slug = firstCartProductSlug();

    state.checkoutDeliveryOptions = defaultDeliveryOptions();

    if (!slug) {
      return Promise.resolve(state.checkoutDeliveryOptions);
    }

    return loadJson("content/products/" + slug + ".json").then(function (product) {
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
      return "Indica um email ou telemóvel.";
    }

    contactError = validateContactInput(state.checkout.customer_contact);
    if (contactError) {
      state.invalidFields = ["customer_contact"];
      return contactError;
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
          '</div>',
          '<div class="cart-item-side">',
          '<span class="cart-item-price">' + escapeHtml(summary.priceText) + '</span>',
          '<div class="cart-item-actions">',
          opts.allowEdit ? '<button type="button" class="cart-edit-button" data-checkout-edit="' + escapeHtml(item.id) + '">Editar</button>' : "",
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
      '</div>',
      '<p class="dc-block-note">Estes dados pessoais serão partilhados com a Mia para que ela te possa contactar para confirmar a encomenda.</p>',
      '</section>',
      '<section class="dc-block dc-delivery' + (hasDeliveryError ? ' is-missing' : '') + '"' + (hasDeliveryError ? ' data-checkout-delivery-error tabindex="-1"' : '') + '>',
      '<h3 class="dc-block-title">Como queres receber a tua encomenda?</h3>',
      '<p class="dc-block-subtitle">Caso já tenhas feito uma encomenda que ainda não foi enviada, escolhe "Junta as minhas encomendas" para receberes todas as tuas encomendas na mesma embalagem.</p>',
      hasDeliveryError ? '<p class="form-error" role="alert">Escolhe uma forma de entrega.</p>' : "",
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
      '<div><dt>Email ou telemóvel:</dt><dd>' + escapeHtml(state.checkout.customer_contact || "") + '</dd></div>',
      '<div><dt>Entrega:</dt><dd>' + escapeHtml(delivery ? delivery.label : "") + '</dd></div>',
      '<div><dt>Cópia por email:</dt><dd>' + escapeHtml(state.checkout.send_copy ? state.checkout.copy_email : "Não") + '</dd></div>',
      '</dl>',
      '<hr class="confirm-divider" aria-hidden="true">',
      '<dl class="confirm-list">',
      '<div><dt>Total dos produtos:</dt><dd>' + escapeHtml(formatCents(subtotal)) + '</dd></div>',
      '<div><dt>Portes:</dt><dd>' + escapeHtml(shipping > 0 ? deliveryPriceText(delivery) : "Grátis") + '</dd></div>',
      '<div><dt>Total estimado:</dt><dd>' + escapeHtml(formatCents(total)) + '</dd></div>',
      '</dl>',
      '</section>',
      renderPaymentNotice(),
      '<div class="copy-request checkout-copy-request">',
      '<label><input type="checkbox" data-checkout-copy-toggle' + (state.checkout.send_copy ? " checked" : "") + '> <span>Enviar uma cópia deste pedido para o meu email</span></label>',
      state.checkout.send_copy ? '<input class="' + (state.invalidFields.indexOf("copy_email") !== -1 ? "is-missing" : "") + '" type="text" name="copy_email" data-checkout-copy-email placeholder="O teu email" value="' + escapeHtml(state.checkout.copy_email) + '" autocomplete="email">' : "",
      state.checkout.send_copy && state.invalidFields.indexOf("copy_email") !== -1 ? '<p class="form-error" role="alert">Indica um email válido para receber a cópia.</p>' : "",
      '</div>',
      '<div class="step-actions checkout-actions">',
      '<button class="button secondary" type="button" data-checkout-back>Voltar</button>',
      '<button class="button primary" type="submit">Confirmar pedido</button>',
      '</div>',
      '</form>'
    ].join("");
  }

  function cartSubmissionPayload() {
    var cart = loadCart();
    return {
      order_mode: "cart",
      schemaVersion: cart.schemaVersion,
      cartId: cart.cartId,
      items: cart.items,
      checkout: {
        customer_name: String(state.checkout.customer_name || "").trim(),
        customer_contact: String(state.checkout.customer_contact || "").trim(),
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
      renderBrand(home.brand || "Mia & Paper", "index.html", home.instagramUrl),
      '<section class="wizard-shell checkout-wizard" aria-labelledby="checkout-title">',
      renderCheckoutProgress(),
      '<div class="step-card">',
      '<p class="eyebrow">Checkout</p>',
      '<h1 id="checkout-title">' + (state.checkoutStep === 0 ? "Contacto e entrega" : "Confirmar pedido") + '</h1>',
      state.errors ? '<p class="form-error action-error" role="alert">' + escapeHtml(state.errors) + '</p>' : "",
      getCartCount() < 1 ? [
        '<div class="cart-empty-state checkout-empty-state">',
        '<strong>O carrinho está vazio.</strong>',
        '<p>Adiciona um produto antes de finalizar o pedido.</p>',
        '</div>',
        '<a class="button primary" href="adicionar-produto.html">Escolher produto</a>'
      ].join("") : (state.checkoutStep === 0 ? renderCheckoutContactStep() : renderCheckoutConfirmStep()),
      '</div>',
      getCartCount() > 0 && state.checkoutStep === 0 ? [
        '<div class="step-actions checkout-actions">',
        '<a class="button secondary" href="adicionar-produto.html" data-checkout-add-product>Adicionar outro produto</a>',
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

    var form = document.querySelector("#cart-checkout-form");
    if (form) {
      form.addEventListener("submit", function (event) {
        var error = validateCheckoutStep(0) || validateCheckoutCopyRequest();
        var payload;

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
          item_count: payload.items.length,
          subtotal_cents: checkoutSubtotalCents()
        });
      });
    }
  }

  function initAddProduct() {
    loadJson("content/home.json").then(function (home) {
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
    loadJson("content/home.json").then(function (home) {
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

  function beginAdminImageKeyboardUndo(product) {
    var active = state.adminActiveImage || {};
    var key = active.stepId + "::" + active.itemId;

    if (state.adminImageKeyboardUndoFor !== key) {
      pushUndo(product);
      state.adminImageKeyboardUndoFor = key;
    }

    if (state.adminImageKeyboardUndoTimer) {
      window.clearTimeout(state.adminImageKeyboardUndoTimer);
    }

    state.adminImageKeyboardUndoTimer = window.setTimeout(function () {
      state.adminImageKeyboardUndoFor = "";
      state.adminImageKeyboardUndoTimer = null;
    }, 900);
  }

  function applyAdminImageStyleToElement(element, item, side) {
    var defaultSize = element.classList.contains("option-image") ? 100 : 168;
    var prefix = side ? "side" : "";
    var zoomKey = prefix ? prefix + "ImageZoom" : "imageZoom";
    var posXKey = prefix ? prefix + "ImagePositionX" : "imagePositionX";
    var posYKey = prefix ? prefix + "ImagePositionY" : "imagePositionY";
    var rotKey = prefix ? prefix + "ImageRotation" : "imageRotation";
    var widthKey = prefix ? prefix + "FrameWidth" : "frameWidth";
    var heightKey = prefix ? prefix + "FrameHeight" : "frameHeight";
    var debugStep = state.product && element.dataset ? findStep(state.product, element.dataset.adminImageStep || element.dataset.miaStepId || "") : null;
    var storeItem = debugStep && element.dataset && element.dataset.adminImageStoreItem
      ? stepItemById(debugStep, element.dataset.adminImageStoreItem)
      : item;
    var sourceItem = element.dataset && element.dataset.miaEditKey
      ? imageSlotProxyItem(item, element.dataset.miaEditKey, element.dataset.miaFallbackEditKey || "", storeItem)
      : item;
    var frameWidth;
    var frameHeight;
    var appliedZoom = imageEditNumber(sourceItem, debugStep, side, zoomKey, defaultSize, 20, 500) / 100;
    var appliedX = imageEditNumber(sourceItem, debugStep, side, posXKey, 0, -100, 100);
    var appliedY = imageEditNumber(sourceItem, debugStep, side, posYKey, 0, -100, 100);
    var appliedRotation = imageEditNumber(sourceItem, debugStep, side, rotKey, 0, -180, 180);
    var debugPayload;
    var debugImage = element.dataset && element.dataset.miaImage ? element.dataset.miaImage : miaSlotDebugImage(sourceItem, side);

    element.style.setProperty("--image-zoom-scale", appliedZoom);
    element.style.setProperty("--image-position-x", appliedX + "%");
    element.style.setProperty("--image-position-y", appliedY + "%");
    element.style.setProperty("--image-rotation", appliedRotation + "deg");
    if (!element.classList.contains("crachas-size-card-proof-frame")) {
      frameWidth = frameEditNumber(sourceItem, debugStep, side, widthKey, element.offsetWidth || 70, 1, 2000);
      frameHeight = frameEditNumber(sourceItem, debugStep, side, heightKey, element.offsetHeight || 70, 1, 2000);
      element.style.setProperty("--frame-width-px", frameWidth + "px");
      element.style.width = frameWidth + "px";
      element.style.setProperty("--frame-height-px", frameHeight + "px");
      element.style.height = frameHeight + "px";
      if (frameWidth && frameHeight) {
        element.style.setProperty("--frame-aspect", frameWidth + " / " + frameHeight);
      }
    }
    debugPayload = miaSlotDebugFramePayload(sourceItem, debugStep, side, debugImage, {
      defaultZoom: defaultSize,
      zoom: appliedZoom,
      x: appliedX,
      y: appliedY,
      rotation: appliedRotation
    });
    miaSlotDebugApplyElementDataset(element, debugPayload);
  }

  function refreshAdminImageAdjustment(stepId, itemId, item, side) {
    var visualSelector = side ? "[data-admin-side-image-visual]" : "[data-admin-image-visual]";
    var editAttr = side ? "adminSideEdit" : "adminEdit";
    var editSelector = side ? "[data-admin-side-edit]" : "[data-admin-edit]";
    var keys = side
      ? ["sideFrameScale", "sideFrameWidth", "sideFrameHeight", "sideFrameMarginX", "sideFrameMarginY", "sideImageZoom", "sideImagePositionX", "sideImagePositionY", "sideImageRotation"]
      : ["frameScale", "frameWidth", "frameHeight", "frameMarginX", "frameMarginY", "imageZoom", "imagePositionX", "imagePositionY", "imageRotation"];
    var zoomKey = side ? "sideImageZoom" : "imageZoom";
    var rotKey = side ? "sideImageRotation" : "imageRotation";
    var active = state.adminActiveImage || {};

    document.querySelectorAll(visualSelector).forEach(function (element) {
      if (
        element.dataset.adminImageStep === stepId
        && element.dataset.adminImageItem === itemId
        && (!active.editKey || element.dataset.miaEditKey === active.editKey)
      ) {
        applyAdminImageStyleToElement(element, item, side);
      }
    });

    document.querySelectorAll(editSelector).forEach(function (input) {
      var key = input.dataset[editAttr];
      var sourceItem;
      if (input.dataset.stepId !== stepId || input.dataset.itemId !== itemId) {
        return;
      }
      if (active.editKey && input.dataset.miaEditKey && input.dataset.miaEditKey !== active.editKey) {
        return;
      }

      sourceItem = input.dataset.miaEditKey
        ? imageSlotProxyItem(item, input.dataset.miaEditKey, input.dataset.miaFallbackEditKey || "", stepItemById(findStep(state.product, stepId), input.dataset.adminImageStoreItemId || itemId))
        : item;

      if (keys.indexOf(key) !== -1) {
        if ((side ? miaSlotDebugSideFlatKeys : miaSlotDebugFlatKeys).indexOf(key) !== -1) {
          input.value = key === zoomKey
            ? imageEditNumber(sourceItem, findStep(state.product, stepId), side, key, 168, 20, 500)
            : imageEditNumber(sourceItem, findStep(state.product, stepId), side, key, 0, key === rotKey ? -180 : -100, key === rotKey ? 180 : 100);
        } else if ((side ? miaSlotDebugSideFrameKeys : miaSlotDebugFrameKeys).indexOf(key) !== -1) {
          input.value = key.indexOf("Scale") !== -1
            ? frameEditNumber(sourceItem, findStep(state.product, stepId), side, key, 100, 40, 300)
            : key.indexOf("Margin") !== -1
              ? frameEditNumber(sourceItem, findStep(state.product, stepId), side, key, 0, -100, 100)
              : frameEditNumber(sourceItem, findStep(state.product, stepId), side, key, 70, 1, 2000);
        } else {
          input.value = item[key] != null ? item[key] : (key === zoomKey ? itemImageNumber(item, key, 168, 20, 500) : itemImageNumber(item, key, 0, -180, 180));
        }
      }
    });

    [side ? "sideImagePositionX" : "imagePositionX", side ? "sideImagePositionY" : "imagePositionY", zoomKey, rotKey].forEach(function (key) {
      var target = document.querySelector('[data-admin-keyboard-value="' + key + '"]');
      if (target) {
        target.textContent = key === zoomKey
          ? imageEditNumber(item, findStep(state.product, stepId), side, key, 168, 20, 500)
          : imageEditNumber(item, findStep(state.product, stepId), side, key, 0, key === rotKey ? -180 : -100, key === rotKey ? 180 : 100);
      }
    });
  }

  function selectAdminImage(product, stepId, itemId, side, editKey, fallbackEditKey, imageStoreItemId) {
    var step = findStep(product, stepId);
    var item = step && step.items ? step.items.filter(function (candidate) {
      return candidate.id === itemId;
    })[0] : null;
    var hasImage = side ? isUploadedSideImage(item) : isUploadedImage(item);

    if (!item || !hasImage) {
      return;
    }

    state.adminActiveImage = {
      stepId: stepId,
      itemId: itemId,
      side: !!side,
      editKey: editKey || "",
      fallbackEditKey: fallbackEditKey || "",
      imageStoreItemId: imageStoreItemId || itemId
    };
    state.adminImageKeyboardUndoFor = "";
    rerenderProduct(product);
  }

  function activeAdminImageElement(active, side) {
    var selector = side ? "[data-admin-side-image-visual]" : "[data-admin-image-visual]";
    var found = null;

    document.querySelectorAll(selector).forEach(function (element) {
      if (
        !found
        && element.dataset.adminImageStep === active.stepId
        && element.dataset.adminImageItem === active.itemId
        && (!active.editKey || element.dataset.miaEditKey === active.editKey)
      ) {
        found = element;
      }
    });

    return found;
  }

  function adminImageCurrentNumber(product, record, key, fallback, min, max) {
    var item = record && record.item;
    var step = record && record.step;

    if (!record || !item) {
      return fallback;
    }

    return imageEditNumber(item, step, !!record.side, key, fallback, min, max);
  }

  function bindAdminImageKeyboard(product) {
    document.querySelectorAll("[data-admin-image-visual]").forEach(function (element) {
      element.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        selectAdminImage(product, element.dataset.adminImageStep, element.dataset.adminImageItem, false, element.dataset.miaEditKey || "", element.dataset.miaFallbackEditKey || "", element.dataset.adminImageStoreItem || "");
      });

      element.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          selectAdminImage(product, element.dataset.adminImageStep, element.dataset.adminImageItem, false, element.dataset.miaEditKey || "", element.dataset.miaFallbackEditKey || "", element.dataset.adminImageStoreItem || "");
        }
      });
    });

    document.querySelectorAll("[data-admin-side-image-visual]").forEach(function (element) {
      element.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        selectAdminImage(product, element.dataset.adminImageStep, element.dataset.adminImageItem, true, element.dataset.miaEditKey || "", element.dataset.miaFallbackEditKey || "", element.dataset.adminImageStoreItem || "");
      });

      element.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          selectAdminImage(product, element.dataset.adminImageStep, element.dataset.adminImageItem, true, element.dataset.miaEditKey || "", element.dataset.miaFallbackEditKey || "", element.dataset.adminImageStoreItem || "");
        }
      });
    });

    if (state.adminImageKeyboardBound) {
      return;
    }

    state.adminImageKeyboardBound = true;
    document.addEventListener("keydown", function (event) {
      var record;
      var item;
      var active;
      var baseKey = "";
      var actualKey = "";
      var delta = 0;
      var step = event.shiftKey ? 5 : 1;
      var current;
      var next;
      var prefix;
      var side;
      var activeElement;
      var editKey;

      if (!state.admin || !state.product || !state.adminActiveImage || adminKeyboardIgnoredTarget(event.target)) {
        return;
      }

      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(event.key) === -1) {
        return;
      }

      record = activeAdminImageRecord(state.product);
      if (!record) {
        return;
      }

      item = record.item;
      active = state.adminActiveImage;
      side = !!record.side;
      prefix = side ? "side" : "";
      activeElement = activeAdminImageElement(active, side);
      editKey = activeElement && activeElement.dataset ? activeElement.dataset.miaEditKey : "";

      if (event.ctrlKey) {
        if (event.key === "ArrowUp") { baseKey = "imageZoom"; delta = step; }
        else if (event.key === "ArrowDown") { baseKey = "imageZoom"; delta = -step; }
        else if (event.key === "ArrowLeft") { baseKey = "imageRotation"; delta = -step; }
        else if (event.key === "ArrowRight") { baseKey = "imageRotation"; delta = step; }
      } else {
        if (event.key === "ArrowLeft") { baseKey = "imagePositionX"; delta = -step; }
        else if (event.key === "ArrowRight") { baseKey = "imagePositionX"; delta = step; }
        else if (event.key === "ArrowUp") { baseKey = "imagePositionY"; delta = -step; }
        else if (event.key === "ArrowDown") { baseKey = "imagePositionY"; delta = step; }
      }

      if (!baseKey) {
        return;
      }

      actualKey = prefix ? prefix + baseKey.charAt(0).toUpperCase() + baseKey.slice(1) : baseKey;

      event.preventDefault();
      event.stopPropagation();

      if (!editKey) {
        return;
      }

      current = baseKey === "imageZoom"
        ? adminImageCurrentNumber(state.product, record, actualKey, 168, 20, 500)
        : adminImageCurrentNumber(state.product, record, actualKey, 0, baseKey === "imageRotation" ? -180 : -100, baseKey === "imageRotation" ? 180 : 100);
      next = clampAdminImageValue(baseKey, current + delta);

      if (next === current) {
        return;
      }

      beginAdminImageKeyboardUndo(state.product);
      writeImageEditSlot(record.storeItem || record.rawItem || item, editKey, actualKey, next);
      refreshAdminImageAdjustment(active.stepId, active.itemId, record.rawItem || item, side);
    });
  }


  function bindAdminItemEditing(product) {
    if (!state.admin) {
      return;
    }

    bindAdminImageKeyboard(product);

    document.querySelectorAll("[data-admin-add-item]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        var step = product.steps.filter(function (candidate) {
          return candidate.id === button.dataset.stepId;
        })[0];
        var count;
        var title;
        var subtitle;

        event.preventDefault();
        event.stopPropagation();

        if (!step) {
          return;
        }

        if (!Array.isArray(step.items)) {
          step.items = [];
        }

        count = step.items.length + 1;
        title = step.id === "designs" ? "Design " + String(count).padStart(2, "0") : "Nova opção";
        subtitle = "Editar texto";

        pushUndo(product);
        if (step.template === "quantity-builder") {
          step.items.push({
            id: "pack-" + Date.now(),
            quantity: count,
            title: String(count),
            subtitle: productUnit(product)
          });
        } else {
          step.items.push({
            id: step.id + "-" + Date.now(),
            value: title + " - " + subtitle,
            title: title,
            subtitle: subtitle,
            visual: "neutral"
          });
        }
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-section-title]").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("change", function () {
        var index = parseInt(input.dataset.adminSectionTitle, 10);
        var step = product && product.steps ? product.steps.filter(function (candidate) {
          return candidate.id === "designs";
        })[0] : null;
        var config = getStepSectionConfig(product, step);

        if (!config || !step) {
          return;
        }

        var sections = ensureStepSections(step, config.defaults);
        if (!sections[index]) {
          return;
        }

        pushUndo(product);
        sections[index].title = input.value || config.defaults[index].title;
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-section-prefix]").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("change", function () {
        var index = parseInt(input.dataset.adminSectionPrefix, 10);
        var step = product && product.steps ? product.steps.filter(function (candidate) {
          return candidate.id === "designs";
        })[0] : null;
        var config = getStepSectionConfig(product, step);

        if (!config || !step) {
          return;
        }

        var sections = ensureStepSections(step, config.defaults);
        if (!sections[index]) {
          return;
        }

        pushUndo(product);
        sections[index].labelPrefix = input.value || "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-edit]").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("change", function () {
        var step = product.steps.filter(function (candidate) {
          return candidate.id === input.dataset.stepId;
        })[0];
        var item = stepItemById(step, input.dataset.itemId);
        var imageStoreItem = stepItemById(step, input.dataset.adminImageStoreItemId || input.dataset.itemId);
        var editKey = input.dataset.miaEditKey || "";

        if (item) {
          pushUndo(product);
          if (input.dataset.adminEdit === "quantity") {
            item[input.dataset.adminEdit] = Math.max(1, parseInt(input.value, 10) || 1);
          } else if (["frameScale", "frameWidth", "frameHeight", "frameMarginX", "frameMarginY", "imageZoom", "imagePositionX", "imagePositionY", "imageRotation"].indexOf(input.dataset.adminEdit) !== -1) {
            if (miaSlotDebugFlatKeys.indexOf(input.dataset.adminEdit) !== -1 || miaSlotDebugFrameKeys.indexOf(input.dataset.adminEdit) !== -1) {
              writeImageEditSlot(imageStoreItem || item, editKey || miaSlotDebugEditKey(item, step, false), input.dataset.adminEdit, Number(input.value) || 0);
            } else {
              item[input.dataset.adminEdit] = Number(input.value) || 0;
            }
          } else if (input.dataset.adminEdit === "rectOrientation") {
            item.rectOrientation = input.value === "landscape" ? "landscape" : "portrait";
          } else if (input.dataset.adminEdit === "sectionOrder") {
            if (input.value.trim() === "") {
              delete item.sectionOrder;
            } else {
              item.sectionOrder = parseInt(input.value, 10);
              if (!isFinite(item.sectionOrder)) {
                delete item.sectionOrder;
              }
            }
          } else if (input.dataset.adminEdit === "sectionId") {
            item.sectionId = input.value;
          } else {
            item[input.dataset.adminEdit] = input.value;
          }
          rerenderProduct(product);
        }
      });
    });

    document.querySelectorAll("[data-admin-apply-frame]").forEach(function (button) {
      button.addEventListener("click", function () {
        var step = product.steps.filter(function (candidate) {
          return candidate.id === button.dataset.adminApplyFrame;
        })[0];
        var values = {};

        if (!step || !Array.isArray(step.items)) {
          return;
        }

        document.querySelectorAll('[data-admin-bulk-step="' + button.dataset.adminApplyFrame + '"]').forEach(function (input) {
          values[input.dataset.adminBulkFrame] = Number(input.value) || 0;
        });

        pushUndo(product);
        step.items.forEach(function (item) {
          var cover = selectedCadernoCover(product);
          var storeItem = item;
          var editKey = miaSlotDebugEditKey(item, step, false);

          if (isCadernosProduct(product) && cover && step.id === "lamination") {
            editKey = cadernoScopedImageEditKey(product, "lamination", cover, item.id, "main");
          } else if (isCadernosProduct(product) && cover && step.id === "pack") {
            storeItem = cadernoPurchaseGroupStoreItem(product, item) || item;
            editKey = cadernoScopedImageEditKey(product, "pack", cover, cadernoPurchaseImageGroup(item), "main");
          }

          writeImageEditSlot(storeItem, editKey, "frameScale", Math.max(40, Math.min(300, values.frameScale || 100)));
          writeImageEditSlot(storeItem, editKey, "frameMarginX", Math.max(-100, Math.min(100, values.frameMarginX || 0)));
          writeImageEditSlot(storeItem, editKey, "frameMarginY", Math.max(-100, Math.min(100, values.frameMarginY || 0)));
          writeImageEditSlot(storeItem, editKey, "imageZoom", Math.max(20, Math.min(500, values.imageZoom || 168)));
          writeImageEditSlot(storeItem, editKey, "imagePositionX", Math.max(-100, Math.min(100, values.imagePositionX || 0)));
          writeImageEditSlot(storeItem, editKey, "imagePositionY", Math.max(-100, Math.min(100, values.imagePositionY || 0)));
          writeImageEditSlot(storeItem, editKey, "imageRotation", Math.max(-180, Math.min(180, values.imageRotation || 0)));
        });
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-field-edit]").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("change", function () {
        var step = product.steps.filter(function (candidate) {
          return candidate.id === input.dataset.adminFieldStep;
        })[0];
        var field = step && step.fields ? step.fields[parseInt(input.dataset.adminFieldIndex, 10)] : null;
        var key = input.dataset.adminFieldEdit;

        if (field) {
          pushUndo(product);
          field[key] = input.type === "checkbox" ? input.checked : input.value;
          rerenderProduct(product);
        }
      });
    });

    document.querySelectorAll("[data-admin-upload]").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        var step = product.steps.filter(function (candidate) {
          return candidate.id === input.dataset.stepId;
        })[0];
        var item = step && step.items ? step.items.filter(function (candidate) {
          return candidate.id === input.dataset.itemId;
        })[0] : null;
        var reader;

        if (!file || !item || !/^image\//.test(file.type)) {
          return;
        }

        reader = new FileReader();
        reader.onload = function () {
          pushUndo(product);
          setAdminItemImage(product, step, item, String(reader.result || ""));
          rerenderProduct(product);
        };
        reader.readAsDataURL(file);
      });
    });

    // CRACHAS_STEP2_SIDE_PHOTO_ADMIN_V4: handlers paralelos para a foto direita.
    document.querySelectorAll("[data-admin-side-upload]").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        var step = product.steps.filter(function (candidate) {
          return candidate.id === input.dataset.stepId;
        })[0];
        var item = step && step.items ? step.items.filter(function (candidate) {
          return candidate.id === input.dataset.itemId;
        })[0] : null;
        var reader;

        if (!file || !item || !/^image\//.test(file.type)) {
          return;
        }

        reader = new FileReader();
        reader.onload = function () {
          pushUndo(product);
          item.sideImage = String(reader.result || "");
          rerenderProduct(product);
        };
        reader.readAsDataURL(file);
      });
    });

    document.querySelectorAll("[data-admin-side-clear]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        var step = product.steps.filter(function (candidate) {
          return candidate.id === button.dataset.stepId;
        })[0];
        var item = step && step.items ? step.items.filter(function (candidate) {
          return candidate.id === button.dataset.itemId;
        })[0] : null;

        event.preventDefault();
        event.stopPropagation();

        if (!item) {
          return;
        }

        pushUndo(product);
        delete item.sideImage;
        if (state.adminActiveImage && state.adminActiveImage.side && state.adminActiveImage.itemId === item.id) {
          state.adminActiveImage = null;
        }
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-side-edit]").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("change", function () {
        var step = product.steps.filter(function (candidate) {
          return candidate.id === input.dataset.stepId;
        })[0];
        var item = step && step.items ? step.items.filter(function (candidate) {
          return candidate.id === input.dataset.itemId;
        })[0] : null;
        var key;

        if (!item) {
          return;
        }

        key = input.dataset.adminSideEdit;
        pushUndo(product);
        if (["sideFrameScale", "sideFrameWidth", "sideFrameHeight", "sideFrameMarginX", "sideFrameMarginY", "sideImageZoom", "sideImagePositionX", "sideImagePositionY", "sideImageRotation"].indexOf(key) !== -1) {
          if (miaSlotDebugSideFlatKeys.indexOf(key) !== -1 || miaSlotDebugSideFrameKeys.indexOf(key) !== -1) {
            writeImageEditSlot(item, miaSlotDebugEditKey(item, step, true), key, Number(input.value) || 0);
          } else {
            item[key] = Number(input.value) || 0;
          }
        } else {
          item[key] = input.value;
        }
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-interior-upload]").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("change", function () {
        var files = Array.prototype.slice.call(input.files || []).filter(function (file) {
          return /^image\//.test(file.type);
        });
        var step = product.steps.filter(function (candidate) {
          return candidate.id === input.dataset.stepId;
        })[0];
        var item = step && step.items ? step.items.filter(function (candidate) {
          return candidate.id === input.dataset.itemId;
        })[0] : null;
        var pending = files.length;
        var images = [];

        if (!item || !pending) {
          return;
        }

        files.forEach(function (file) {
          var reader = new FileReader();
          reader.onload = function () {
            images.push(String(reader.result || ""));
            pending -= 1;
            if (!pending) {
              pushUndo(product);
              item.interiorImages = (item.interiorImages || []).concat(images);
              rerenderProduct(product);
            }
          };
          reader.readAsDataURL(file);
        });
      });
    });

    document.querySelectorAll("[data-admin-interior-clear]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        var step;
        var item;

        event.preventDefault();
        event.stopPropagation();

        step = product.steps.filter(function (candidate) {
          return candidate.id === button.dataset.stepId;
        })[0];
        item = step && step.items ? step.items.filter(function (candidate) {
          return candidate.id === button.dataset.itemId;
        })[0] : null;

        if (!item) {
          return;
        }

        pushUndo(product);
        item.interiorImages = [];
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-delete-item]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        var step;

        event.preventDefault();
        event.stopPropagation();

        step = product.steps.filter(function (candidate) {
          return candidate.id === button.dataset.stepId;
        })[0];

        if (step && step.items) {
          pushUndo(product);
          step.items = step.items.filter(function (item) {
            return item.id !== button.dataset.itemId;
          });
          rerenderProduct(product);
        }
      });
    });
  }

  function initHome() {
    loadJson("content/home.json").then(function (home) {
      applySiteSettings(home);
      if (window.MiaButterflies && window.MiaButterflies.refresh) {
        window.MiaButterflies.refresh();
      }
      return enrichHomeWithCarousels(home);
    }).then(renderHome).catch(function (error) {
      app.innerHTML = '<main class="fallback"><h1>Mia &amp; Paper</h1><p>' + escapeHtml(error.message) + '</p></main>';
    });
  }

  function initProduct() {
    if (safeSessionGetItem("miaandpaper-reset-" + productSlug) === "1") {
      try {
        window.sessionStorage.removeItem("miaandpaper-reset-" + productSlug);
      } catch (error) {
        /* noop */
      }
      state.currentStep = 0;
      state.maxVisitedStep = 0;
      state.selections = {};
      state.errors = "";
      state.quantitySignature = "";
      state.quantitiesTouched = false;
      state.quantityPackBaseline = 0;
    }

    Promise.all([
      loadJson("content/products/" + productSlug + ".json"),
      loadJson("content/pricing.json").catch(function () { return null; }),
      loadJson("content/home.json").catch(function () { return null; })
    ]).then(function (results) {
      var product;
      applySiteSettings(results[2]);
      if (window.MiaButterflies && window.MiaButterflies.refresh) {
        window.MiaButterflies.refresh();
      }
      product = applyPricingToProduct(results[0], results[1]);
      state.product = product;
      loadCartEditMode(product);
      applySessionCardDetails(product);
      initWizardHistory(product);
      renderProduct(product);

      // SITE_LANDED_V1 (Phase 3): primeiro evento da sessão, captura
      // atribuição original antes do step_view do produto.
      try { fireSiteLandedOnce(); } catch (e) {}

      // FUNNEL_TRACKING_V1: dispara wizard_started uma vez por sessão por
      // produto + step_view do passo inicial (porque setCurrentStep só
      // dispara em transições, e o passo 0 não é uma transição).
      var startedKey = "mp_funnel_wizard_started_" + (product.slug || "");
      var alreadyStarted = false;
      try { alreadyStarted = window.sessionStorage.getItem(startedKey) === "1"; } catch (err) {}
      if (!alreadyStarted) {
        try { window.sessionStorage.setItem(startedKey, "1"); } catch (err) {}
        trackProductEvent(product, 'wizard_started', {
          step_id: (product.steps && product.steps[0] && product.steps[0].id) || '',
          step_index: 0
        });
      }
      var initialStep = currentStep(product);
      trackProductEvent(product, 'step_view', {
        step_id: initialStep ? initialStep.id : '',
        step_index: state.currentStep,
        transition_reason: 'initial'
      });
      if (initialStep && initialStep.id === 'confirm') {
        trackProductEvent(product, 'confirmation_view', {
          step_id: initialStep.id,
          step_index: state.currentStep
        });
      }
      // HEARTBEAT_V1 (Phase 6): inicia depois de garantir o estado.
      try { startFunnelHeartbeat(product); } catch (e) {}
    }).catch(function (error) {
      app.innerHTML = '<main class="fallback"><h1>Mia &amp; Paper</h1><p>' + escapeHtml(error.message) + '</p></main>';
    });
  }

  function initButterflyFriend() {
    window.MiaButterflies = {
      show: function () { return false; },
      refresh: function () {},
      clear: function () {}
    };
  }

  // COOKIE_BANNER_V1: banner discreto com aceitação obrigatória e estado em
  // localStorage. Não bloqueia a navegação. Visível em todas as páginas até
  // ao primeiro Aceitar, depois nunca mais. Usa a chave
  // "mp_cookie_consent_v1" para que mudanças futuras (mais cookies, mais
  // texto) possam re-mostrar o banner. Espaço futuro: depois de aceite, fica
  // disponível window.MiaCookieConsent para condicionalmente carregar
  // analytics externos (não usado ainda — ver Fase G para tracking próprio).
  var COOKIE_KEY = "mp_cookie_consent_v1";

  function cookieConsentGranted() {
    try {
      return window.localStorage.getItem(COOKIE_KEY) === "1";
    } catch (err) {
      return false;
    }
  }

  function setCookieConsent() {
    try {
      window.localStorage.setItem(COOKIE_KEY, "1");
    } catch (err) {
      /* falha silenciosa: a aceitação dura apenas a sessão */
    }
  }

  function initCookieBanner() {
    if (cookieConsentGranted()) {
      return;
    }

    if (document.querySelector(".cookie-banner")) {
      return;
    }

    var banner = document.createElement("aside");
    banner.className = "cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Aviso de cookies");
    banner.innerHTML = [
      '<div class="cookie-banner-text">',
      '<strong>Este site usa cookies essenciais para funcionar corretamente.</strong>',
      '<a href="privacy.html">Política de Privacidade</a>',
      '</div>',
      '<button type="button" class="cookie-banner-accept">Aceitar</button>'
    ].join("");

    document.body.appendChild(banner);
    requestAnimationFrame(function () {
      banner.classList.add("is-visible");
    });

    banner.querySelector(".cookie-banner-accept").addEventListener("click", function () {
      setCookieConsent();
      banner.classList.remove("is-visible");
      setTimeout(function () {
        if (banner.parentNode) {
          banner.parentNode.removeChild(banner);
        }
      }, 220);
    });
  }

  // Espaço reservado: window.MiaCookieConsent pode ser usado por scripts
  // futuros (ex.: snippet de analytics externo) para verificar consentimento
  // sem reler localStorage. NÃO carregar nada externo nesta tarefa.
  window.MiaCookieConsent = {
    granted: cookieConsentGranted,
    accept: function () {
      setCookieConsent();
    }
  };

  applyTheme(currentTheme());
  bindThemeToggle();

  // SITE_LANDED_V1 (Phase 3): primeira página da sessão (qualquer página).
  // Para o caso de produto, fireSiteLandedOnce é chamado dentro do initProduct
  // após carregar o JSON. Para as outras páginas, disparamos imediatamente
  // — atribuição original já está em sessionStorage.
  if (page !== "product") {
    try { fireSiteLandedOnce(); } catch (e) {}
  }

  if (page === "home") {
    initHome();
  } else if (page === "add-product") {
    initAddProduct();
  } else if (page === "checkout") {
    initCheckout();
  } else if (page === "product") {
    initProduct();
  } else if (page === "contact" || page === "static") {
    bindThemeToggle();
    refreshCartUi();
    applyTheme(currentTheme());
    loadJson("content/home.json").then(function (home) {
      applySiteSettings(home);
      refreshCartUi();
      if (window.MiaButterflies && window.MiaButterflies.refresh) {
        window.MiaButterflies.refresh();
      }
    }).catch(function () {});
  }

  installCartDebugTools();

  window.addEventListener("storage", function (event) {
    if (event.key === CART_KEY) {
      state.cartNotice = "";
      refreshCartUi();
    }
  });

  initButterflyFriend();
  // COOKIE_BANNER_V1: chamado depois do init das páginas para evitar
  // flash do banner antes do conteúdo principal estar pintado.
  if (document.body) {
    initCookieBanner();
  } else {
    document.addEventListener("DOMContentLoaded", initCookieBanner);
  }

  window.addEventListener("pageshow", function (event) {
    if (page === "product" && event.persisted && window.sessionStorage.getItem("miaandpaper-reset-" + productSlug) === "1") {
      window.location.reload();
    }
  });
}());
