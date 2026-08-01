(function () {
  var app = document.querySelector("#app");
  var page = document.body.dataset.page;
  var productSlug = document.body.dataset.product;
  var homeContentPath = document.body.dataset.homeContent || "content/home.json";
  var ORDER_HOME_CONTENT = "content/order-products.json";
  var ADMIN_KEY = "miaandpaper-admin-session-v1";
  var ADMIN_PANEL_HIDDEN_KEY = "miaandpaper-admin-panel-hidden-v1";
  var ADMIN_API = "admin-api.php";
  var COLORS_API = "colors-api.php";
  var ORDER_UPLOAD_API = "upload-order-photo.php";
  var ORDER_MEDIA_PREVIEW_API = "order-media-preview.php";
  var CART_KEY = "miaandpaper_cart_v1";
  var CART_SCHEMA_VERSION = 1;
  var CARD_DETAILS_SESSION_KEY = "miaandpaper_card_details_session";
  var CHECKOUT_SESSION_KEY = "miaandpaper_checkout_session";
  // O topo nao tem fundo, por isso o texto da marca desvaneceria por cima do conteudo
  // ao fazer scroll. Marcamos o estado no body e o CSS trata da transicao; os icones
  // ficam sempre visiveis porque tem fundo proprio.
  (function installBrandScrollFade() {
    var THRESHOLD = 8;

    function apply() {
      var offset = window.pageYOffset || document.documentElement.scrollTop || 0;
      var value = offset > THRESHOLD ? "1" : "0";

      if (document.body.dataset.scrolled !== value) {
        document.body.dataset.scrolled = value;
      }
    }

    window.addEventListener("scroll", apply, { passive: true });
    apply();
  }());

  var cartMemoryStore = "";
  var cartEscapeBound = false;
  var siteMenuEscapeBound = false;
  var siteMenuGesture = null;
  var siteMenuSuppressClickUntil = 0;
  var checkoutHistoryBound = false;
  var imageViewerZoom = 1;
  var imageViewerEscapeBound = false;
  var cadernoPreviewTimers = [];
  var orderUploadPreviews = {};
  var orderAudioRecorder = null;
  var orderAudioStream = null;
  var orderAudioChunks = [];
  var orderAudioPointerHeld = false;
  var orderAudioPendingStart = false;
  var orderAudioContext = null;
  var orderUploadOperations = [];
  var orderUploadNextOperationId = 1;
  var orderFilePickerRevision = 0;
  var orderActiveFilePicker = null;
  var freeQuantityChartCleanup = function () {};
  var freeQuantityChartRefresh = function () {};

  function installFavicon() {
    var link = document.querySelector('link[rel~="icon"]') || document.createElement("link");
    link.rel = "icon";
    link.type = "image/jpeg";
    link.href = "content/brand/logo.webp";
    if (!link.parentNode) {
      document.head.appendChild(link);
    }
  }

  installFavicon();

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
    adminPanelHidden: safeStorageGetItem(ADMIN_PANEL_HIDDEN_KEY) === "1",
    loginOpen: false,
    adminMessage: "",
    cartPanelOpen: false,
    cartNotice: "",
    siteMenuOpen: false,
    siteMenuCategories: [],
    editingCartItemId: "",
    editingCartReturnTo: "",
    editingCartOriginalItem: null,
    checkoutDeliveryOptions: null,
    checkoutStep: 0,
    checkout: {
      customer_name: "",
      customer_contact: "",
      customer_nif: "",
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
    brandButterflyEnabled: false,
    catalogFooterLinkVisible: true,
    ordersSuspended: false,
    itemDisplayLabels: {},
    adminActiveImage: null,
    adminImageKeyboardBound: false,
    adminImageKeyboardUndoFor: "",
    adminImageKeyboardUndoTimer: null,
    adminIp: "",
    adminIpIgnored: false,
    adminIpLoaded: false,
    adminIpLoading: false,
    packDisabledMessage: "",
    homeUnavailableMessage: "",
    // OPEN_ORDER_HINT_V1: true quando check-open-orders.php devolve
    // has_possible_open_order=true para o nome+contacto correntes.
    openOrderHint: false,
    openOrderHintLastQuery: "",
    orderUploadBusy: false,
    orderUploadMessage: "",
    orderUploadError: "",
    orderUploadFeedbackKind: "",
    orderUploadProgress: null,
    orderAudioRecording: false,
    colorSuggestionsOpen: false,
    quadroColorSuggestionsOpen: true,
    paletteColorSlots: [],
    // Quadrado que a próxima cor escolhida na grelha vai preencher.
    quadroActiveColorSlot: 0,
    // Cor expandida na grelha a mostrar os tons: { value, slot } ou null.
    quadroToneEdit: null,
    // Estado de interacção isolado por passo. Sem este mapa, o degradê do
    // coração e as cores do respectivo fundo partilhariam quadrados, foco e
    // tons, fazendo uma escolha apagar silenciosamente a outra.
    quadroColorUi: {},
    quadroPhotoColorAnalysis: {
      token: "",
      status: "idle",
      detected: [],
      palettes: [],
      error: ""
    },
    progressAnimationFromPercent: null
  };

  var ICON_INSTAGRAM = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" ry="5" fill="none" stroke="currentColor" stroke-width="1.9"></rect><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.9"></circle><circle cx="17.4" cy="6.6" r="1.2" fill="currentColor"></circle></svg>';
  var ICON_MAIL = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="2.5" ry="2.5" fill="none" stroke="currentColor" stroke-width="1.9"></rect><path d="M4.5 7l7.5 6 7.5-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
  var ICON_CART = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.5 5.5h2.4l2 9.2a2 2 0 0 0 2 1.6h6.6a2 2 0 0 0 1.9-1.4l1.3-5.2H8.1" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="10.8" cy="20" r="1.2" fill="currentColor"></circle><circle cx="17.6" cy="20" r="1.2" fill="currentColor"></circle></svg>';
  var ICON_MENU = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"></path></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"></path></svg>';
  var ICON_ZOOM = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="5.7" fill="none" stroke="currentColor" stroke-width="2"></circle><path d="M15 15l4.6 4.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>';
  var ICON_SUN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.9"></circle><g stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><line x1="12" y1="2.5" x2="12" y2="5"></line><line x1="12" y1="19" x2="12" y2="21.5"></line><line x1="2.5" y1="12" x2="5" y2="12"></line><line x1="19" y1="12" x2="21.5" y2="12"></line><line x1="5.2" y1="5.2" x2="7" y2="7"></line><line x1="17" y1="17" x2="18.8" y2="18.8"></line><line x1="5.2" y1="18.8" x2="7" y2="17"></line><line x1="17" y1="7" x2="18.8" y2="5.2"></line></g></svg>';
  var ICON_MOON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.5 14.2A8 8 0 0 1 9.8 3.5a8.2 8.2 0 1 0 10.7 10.7z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"></path></svg>';
  var ICON_UPLOAD = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
  var ICON_PHOTO = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.9"></rect><circle cx="9" cy="10" r="2" fill="none" stroke="currentColor" stroke-width="1.9"></circle><path d="m4 17 5-5 4 4 2-2 5 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
  var ICON_MICROPHONE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="8.5" y="3" width="7" height="12" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.9"></rect><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"></path></svg>';
  var THEME_KEY = "miaandpaperTheme";

  var templateLabels = {
    "media-list": "Imagem + 2 linhas",
    "text-grid": "Texto em grelha",
    "price-pack-grid": "Packs/preços",
    "quantity-builder": "Pack + quantidades",
    "design-grid": "Grelha de designs",
    "color-grid": "Cores",
    "palette-grid": "Combinações de cores",
    "photo-upload": "Envio de fotos",
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
  // STEP_JUMP_CONFIRM_V1: passo pedido por um salto entregue ao histórico do
  // browser. `history.go()` é assíncrono e pode não ir a lado nenhum quando a
  // entrada já foi truncada, por isso guardamos o pedido e confirmamos.
  var wizardPendingJumpStep = null;
  var wizardPendingJumpTimer = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderInlineText(value) {
    return escapeHtml(value)
      .replace(/&lt;s&gt;/g, "<s>")
      .replace(/&lt;\/s&gt;/g, "</s>");
  }

  function plainInlineText(value) {
    return String(value == null ? "" : value).replace(/<s>.*?<\/s>\s*/g, "");
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

  function setRuntimeIndividualColors(step, colors) {
    if (Array.isArray(step && step.configuredColors)) {
      Object.defineProperty(step, "individualColors", {
        value: colors,
        writable: true,
        configurable: true,
        enumerable: false
      });
      return;
    }
    step.individualColors = colors;
  }

  function applyColorCatalog(product, response) {
    var catalog = response && response.catalog ? response.catalog : response;
    var colors = catalog && Array.isArray(catalog.colors) ? catalog.colors : [];
    var statuses = catalog && catalog.statuses && typeof catalog.statuses === "object" ? catalog.statuses : {};

    if (!product || !Array.isArray(product.steps)) {
      return product;
    }

    product.steps.forEach(function (step) {
      if (step && Array.isArray(step.configuredColors)) {
        setRuntimeIndividualColors(step, step.configuredColors.map(function (color) {
          return Object.assign({}, color);
        }));
      }
    });

    // Alguns passos usam exactamente o mesmo papel/catálogo de outro passo,
    // mas precisam de selecções e disponibilidade próprias. A referência evita
    // duplicar dezenas de cores no JSON sem transformar o passo numa cópia
    // independente no editor administrativo.
    product.steps.forEach(function (step) {
      var source;
      var inheritedColors;
      if (!step || !step.colorSourceStep) {
        return;
      }
      source = product.steps.filter(function (candidate) {
        return candidate && candidate.id === step.colorSourceStep;
      })[0] || null;
      inheritedColors = source && (Array.isArray(source.configuredColors)
        ? source.configuredColors
        : (Array.isArray(source.individualColors) ? source.individualColors : []));
      if (inheritedColors && inheritedColors.length) {
        Object.defineProperty(step, "configuredColors", {
          value: inheritedColors.map(function (color) { return Object.assign({}, color); }),
          writable: true,
          configurable: true,
          enumerable: false
        });
        setRuntimeIndividualColors(step, inheritedColors.map(function (color) {
          return Object.assign({}, color);
        }));
      }
      if ((!Array.isArray(step.items) || !step.items.length) && source && Array.isArray(source.items)) {
        Object.defineProperty(step, "items", {
          value: source.items.map(function (item) { return Object.assign({}, item); }),
          writable: true,
          configurable: true,
          enumerable: false
        });
      }
    });

    if (!colors.length) {
      return product;
    }

    product.steps.forEach(function (step) {
      var flowKey;
      var flowStatuses;
      var blockedHex = {};
      var availableHex = {};
      var configuredColors;
      var configuredById = {};
      var sourceColors;
      var resolvedColors;

      if (!step || step.template !== "palette-grid") {
        return;
      }
      flowKey = String(product.slug || "") + ":" + String(step.id || "");
      flowStatuses = statuses[flowKey];
      if (!flowStatuses || typeof flowStatuses !== "object") {
        return;
      }

      configuredColors = Array.isArray(step.configuredColors)
        ? step.configuredColors.slice()
        : (Array.isArray(step.individualColors) ? step.individualColors.slice() : []);
      configuredColors.forEach(function (color) {
        if (color && color.id) {
          configuredById[String(color.id)] = color;
        }
      });
      sourceColors = step.useConfiguredColors === true
        ? configuredColors.map(function (configured) {
          return colors.filter(function (color) {
            return color && String(color.id) === String(configured.id);
          })[0] || {
            id: configured.id,
            name: configured.title || configured.value || configured.id,
            hex: configured.swatch
          };
        })
        : colors;

      resolvedColors = sourceColors.map(function (color) {
        var status = String(flowStatuses[color.id] || "hidden");
        var configured = configuredById[String(color.id)] || {};
        var swatch = safeSwatchColor(color.hex || configured.swatch);
        var catalogStops = validHex(color.light_hex) && validHex(color.dark_hex)
          ? [String(color.light_hex).toLowerCase(), swatch, String(color.dark_hex).toLowerCase()]
          : null;
        if (status === "available") {
          availableHex[swatch.toLowerCase()] = true;
        } else {
          blockedHex[swatch.toLowerCase()] = true;
        }
        if (status === "hidden") {
          return null;
        }
        return {
          id: String(color.id),
          value: String(configured.value || configured.title || color.name),
          title: String(configured.title || configured.value || color.name),
          swatch: swatch,
          colorStops: catalogStops || (Array.isArray(configured.colorStops) ? configured.colorStops.slice(0, 3) : null),
          availability: status
        };
      }).filter(Boolean);
      setRuntimeIndividualColors(step, resolvedColors);

      // O catálogo tem ids diferentes com o mesmo hex (azul-bebe/azul-claro,
      // rosa-bebe/rosa-claro) e cada fluxo só dá estado a um deles. Sem o
      // availableHex, o id sem estado bloqueava a cor para o fluxo todo e as
      // combinações sugeridas com esse hex desapareciam.
      step.items = (step.items || []).filter(function (item) {
        return paletteColors(item).every(function (hex) {
          var key = String(hex).toLowerCase();
          return availableHex[key] || !blockedHex[key];
        });
      });
    });

    return product;
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

    if (!home.hero || typeof home.hero !== "object") {
      home.hero = {};
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

    if (typeof home.brandButterflyEnabled !== "boolean") {
      home.brandButterflyEnabled = false;
    }

    if (typeof home.catalogFooterLinkVisible !== "boolean") {
      home.catalogFooterLinkVisible = true;
    }

    if (typeof home.ordersSuspended !== "boolean") {
      home.ordersSuspended = false;
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

    home.hero.carouselEnabled = home.hero.carouselEnabled !== false;
    home.hero.rotationSeconds = clampNumber(home.hero.rotationSeconds, 5, 3, 30);
    home.hero.resumeSeconds = clampNumber(home.hero.resumeSeconds, 10, 3, 60);

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
      state.brandButterflyEnabled = false;
      state.catalogFooterLinkVisible = true;
      state.ordersSuspended = false;
      state.customPromoEnabled = true;
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
    state.brandButterflyEnabled = home.brandButterflyEnabled === true;
    state.catalogFooterLinkVisible = home.catalogFooterLinkVisible !== false;
    state.ordersSuspended = home.ordersSuspended === true;
    // PERSONALIZACAO_PROMO_V1: interruptor geral do convite ao flow de artwork
    // proprio. Fica ligado por omissao; `"customPromoEnabled": false` no
    // content/order-products.json apaga-o de todos os produtos de uma vez.
    state.customPromoEnabled = home.customPromoEnabled !== false;
    document.body.classList.toggle("is-brand-butterfly-enabled", state.brandButterflyEnabled);
    document.body.classList.toggle("is-catalog-footer-hidden", !state.catalogFooterLinkVisible);
    document.body.classList.toggle("has-orders-suspended", state.ordersSuspended);
  }

  function ordersAreSuspended() {
    return state.ordersSuspended === true;
  }

  function ordersSuspendedBannerMessage() {
    return "Já não estamos a aceitar encomendas para o Congresso de 2026";
  }

  function ordersSuspendedCheckoutMessage() {
    return "Lamento, mas já não é possível fazer encomendas para o Congresso de 2026.";
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
    var onlyPrimaryImages = product && productFamily(product) === "cadernos";

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
      var manualImages = Array.isArray(category.carouselSourceImages)
        ? category.carouselSourceImages.filter(Boolean).slice(0, 12)
        : [];
      var slug = slugFromHref(category.href);

      if (manualImages.length) {
        category.carouselImages = manualImages;
        return category;
      }

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

    startHomeHeroCarousel(home);

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

  function homeHeroImages(hero) {
    var images = Array.isArray(hero && hero.carouselSourceImages)
      ? hero.carouselSourceImages.filter(Boolean).slice(0, 12)
      : [];

    if (!images.length && hero && hero.image) {
      images.push(hero.image);
    }
    return images.filter(function (image, index, all) {
      return all.indexOf(image) === index;
    });
  }

  function renderHomeHeroCarousel(hero) {
    var images = homeHeroImages(hero);
    var showControls = hero.carouselEnabled !== false && images.length > 1;

    if (!images.length) { return ""; }

    return [
      '<div class="home-hero-carousel" data-home-hero-carousel data-index="0">',
      '<div class="home-hero-carousel__track" data-home-hero-track>',
      images.map(function (image, index) {
        return '<span class="home-hero-carousel__frame" data-mia-image="' + escapeHtml(image)
          + '" data-mia-item-id="hero" data-mia-slot-name="home-hero-carousel" data-mia-slide-index="' + index
          + '" style="background-image:url(&quot;' + escapeHtml(image) + '&quot;)" aria-hidden="true"></span>';
      }).join(""),
      '</div>',
      showControls ? '<div class="home-hero-carousel__dots" aria-label="Escolher imagem do destaque">'
        + images.map(function (_image, index) {
          return '<button type="button" data-home-hero-dot="' + index + '" aria-label="Mostrar imagem '
            + (index + 1) + ' de ' + images.length + '" aria-current="' + (index === 0 ? "true" : "false") + '"></button>';
        }).join("") + '</div>' : "",
      '</div>'
    ].join("");
  }

  function startHomeHeroCarousel(home) {
    var hero = home && home.hero ? home.hero : {};
    var section = document.querySelector("[data-home-hero]");
    var carousel = section && section.querySelector("[data-home-hero-carousel]");
    var track = carousel && carousel.querySelector("[data-home-hero-track]");
    var frames = track ? Array.prototype.slice.call(track.children) : [];
    var dots = carousel ? Array.prototype.slice.call(carousel.querySelectorAll("[data-home-hero-dot]")) : [];
    var speed = Math.max(3, Math.min(30, Number(hero.rotationSeconds) || 5)) * 1000;
    var resumeDelay = Math.max(3, Math.min(60, Number(hero.resumeSeconds) || 10)) * 1000;
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var interval = null;
    var resumeTimer = null;
    var pointer = null;
    var index = 0;

    if (!section || !carousel || !track || frames.length <= 1) { return; }

    function show(next) {
      index = (Number(next) + frames.length) % frames.length;
      carousel.dataset.index = String(index);
      track.style.transform = "translate3d(" + (-index * 100) + "%,0,0)";
      dots.forEach(function (dot, dotIndex) {
        dot.setAttribute("aria-current", dotIndex === index ? "true" : "false");
      });
    }

    function begin() {
      if (reduceMotion || hero.carouselEnabled === false || interval) { return; }
      interval = window.setInterval(function () { show(index + 1); }, speed);
      state.homeCarouselTimers.push(interval);
    }

    function pauseTemporarily() {
      if (interval) { window.clearInterval(interval); interval = null; }
      if (resumeTimer) { window.clearTimeout(resumeTimer); }
      if (reduceMotion || hero.carouselEnabled === false) { return; }
      resumeTimer = window.setTimeout(function () {
        resumeTimer = null;
        show(index + 1);
        begin();
      }, resumeDelay);
      state.homeCarouselTimers.push(resumeTimer);
    }

    dots.forEach(function (dot) {
      dot.addEventListener("click", function (event) {
        event.stopPropagation();
        show(Number(dot.dataset.homeHeroDot));
        pauseTemporarily();
      });
    });

    section.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 || event.target.closest("a,button,input,select,textarea")) { return; }
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      if (section.setPointerCapture) { section.setPointerCapture(event.pointerId); }
    });
    section.addEventListener("pointerup", function (event) {
      var current = pointer;
      pointer = null;
      if (!current || current.id !== event.pointerId) { return; }
      if (section.hasPointerCapture && section.hasPointerCapture(event.pointerId)) {
        section.releasePointerCapture(event.pointerId);
      }
      var deltaX = event.clientX - current.x;
      var deltaY = event.clientY - current.y;
      if (Math.abs(deltaX) < 42 || Math.abs(deltaX) <= Math.abs(deltaY)) { return; }
      show(index + (deltaX < 0 ? 1 : -1));
      pauseTemporarily();
    });
    section.addEventListener("pointercancel", function () { pointer = null; });

    show(0);
    begin();
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
    var clone = JSON.parse(JSON.stringify(product));
    if (clone && Array.isArray(clone.steps)) {
      clone.steps.forEach(function (step) {
        if (step && Array.isArray(step.configuredColors)) {
          setRuntimeIndividualColors(step, step.configuredColors.map(function (color) {
            return Object.assign({}, color);
          }));
        }
      });
    }
    return clone;
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
      product_context: String(product.catalogContext || "main"),
      flow_mode: isMainCatalogProduct(product) ? (isCustomArtworkSelected(product) ? "custom" : "catalog") : String(product.orderFlow || ""),
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
      if (isMainCatalogProduct(product)) {
        snap.flow_mode = isCustomArtworkSelected(product) ? "custom" : "catalog";
        snap.product_context = String(product.catalogContext || "main-v2");
      }

      // Cores e variantes sem conteúdo pessoal. Mantém a posição dos tons —
      // num degradê, 0 é a cor inicial e 1 a final.
      (product.steps || []).filter(function (step) {
        return step && step.template === "palette-grid";
      }).forEach(function (step) {
        var keys = quadrosColorSelectionKeys(step);
        var families = Array.isArray(sel[keys.colors]) ? sel[keys.colors].slice(0, 6) : [];
        var tones = Array.isArray(sel[keys.tones]) ? sel[keys.tones].slice(0, 6) : [];
        var prefix = String(step.id || "colors").replace(/[^a-z0-9_]/gi, "_");
        if (families.length) {
          snap[prefix + "_colors"] = families.map(function (value) { return String(value).slice(0, 60); });
          snap[prefix + "_tones"] = tones.map(function (value) { return Math.max(0, Math.min(2, Number(value) || 0)); });
        } else if (sel[keys.mia]) {
          snap[prefix + "_mia"] = 1;
        }
      });
      ["heart_finish", "silhouette", "quadro_super_example"].forEach(function (key) {
        if (sel[key]) snap[key] = String(sel[key]).slice(0, 80);
      });
      ["no_phrase", "no_dedication", "no_text", "silhouette_contact_me"].forEach(function (key) {
        if (sel[key]) snap[key] = 1;
      });

      // Molduras: regista apenas presença/contagem nos passos de texto e
      // anexos. Nunca envia dedicatórias, descrições, nomes de ficheiro,
      // tokens de upload ou qualquer outro conteúdo introduzido pela pessoa.
      if (product.slug === "quadros") {
        [
          ["quadro_uploads", "photo_count"],
          ["quadro_reference_uploads", "reference_photo_count"],
          ["quadro_audio_uploads", "reference_audio_count"],
          ["quadro_silhouette_uploads", "silhouette_photo_count"],
          ["quadro_silhouette_audio_uploads", "silhouette_audio_count"]
        ].forEach(function (record) {
          var uploads = Array.isArray(sel[record[0]]) ? sel[record[0]] : [];
          if (uploads.length) snap[record[1]] = uploads.length;
        });
        if (String(sel.quadro_text || "").trim()) snap.quadro_has_text = 1;
        if (String(sel.quadro_dedication || "").trim()) snap.dedication_has_text = 1;
        if (String(sel.quadro_silhouette_description || "").trim()) snap.silhouette_has_description = 1;
        if (String(sel.quadro_description || "").trim()) snap.super_has_description = 1;
      }

      // Novo fluxo de crachás/ímanes: só presença e contagens, nunca texto,
      // áudio, nomes de ficheiro ou outros dados enviados pela pessoa.
      if (isCustomArtworkSelected(product)) {
        var custom = customArtworkConfig(product);
        var artworkItems = Array.isArray(sel[custom.uploadKey]) ? sel[custom.uploadKey] : [];
        var cardPhotos = Array.isArray(sel[custom.cardPhotoKey]) ? sel[custom.cardPhotoKey] : [];
        var cardAudio = Array.isArray(sel[custom.cardAudioKey]) ? sel[custom.cardAudioKey] : [];
        if (artworkItems.length) {
          snap.artwork_attached = 1;
          snap.artwork_count = artworkItems.length;
          snap.artwork_total_quantity = customArtworkTotalQuantity(product);
          snap.customization_fee_cents = customArtworkFeeCents(product);
        }
        if (sel[custom.helpKey]) snap.artwork_help = 1;
        if (String(sel[custom.cardField] || "").trim()) snap.card_has_text = 1;
        if (cardPhotos.length) snap.card_photo_count = cardPhotos.length;
        if (cardAudio.length) snap.card_audio_count = cardAudio.length;
      }

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
  var ADMIN_CSRF_REQUIRED = { "save-product": true, "save-home": true, "logout": true, "toggle-ignore-current-ip": true };

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

  function updateAdminIpState(data) {
    if (!data || data.adminIp == null) {
      return false;
    }

    var nextIp = String(data.adminIp || "");
    var nextIgnored = data.adminIpIgnored === true;
    var changed = state.adminIp !== nextIp || state.adminIpIgnored !== nextIgnored || !state.adminIpLoaded;

    state.adminIp = nextIp;
    state.adminIpIgnored = nextIgnored;
    state.adminIpLoaded = true;

    return changed;
  }

  function refreshBasicAdminInfo(force) {
    if (!state.admin || state.adminIpLoading || (state.adminIpLoaded && !force)) {
      return;
    }

    state.adminIpLoading = true;
    fetch(ADMIN_API + "?action=status", {
      method: "GET",
      credentials: "same-origin"
    }).then(function (response) {
      return response.json().catch(function () { return {}; });
    }).then(function (data) {
      var changed;

      if (data && data.csrf) {
        adminCsrfToken = String(data.csrf);
      }
      changed = updateAdminIpState(data);
      if (data && data.loggedIn === false) {
        state.admin = false;
        state.loginOpen = false;
        safeStorageRemoveItem(ADMIN_KEY);
        changed = true;
      }
      state.adminIpLoading = false;
      if (changed) {
        rerender();
      }
    }).catch(function () {
      state.adminIpLoading = false;
    });
  }

  function openAdminSurface() {
    state.adminMessage = "";

    fetch(ADMIN_API + "?action=status", {
      method: "GET",
      credentials: "same-origin"
    }).then(function (response) {
      return response.json().catch(function () { return {}; });
    }).then(function (data) {
      if (data && data.csrf) {
        adminCsrfToken = String(data.csrf);
      }
      if (data && data.loggedIn === true) {
        state.admin = true;
        state.loginOpen = false;
        state.adminIpLoaded = false;
        state.adminIpLoading = false;
        safeStorageSetItem(ADMIN_KEY, "1");
      } else {
        state.loginOpen = true;
      }
      rerender();
    }).catch(function () {
      // Se o servidor não conseguir confirmar a sessão, mantém disponível o
      // login normal para o modo protegido usado depois do deploy.
      state.loginOpen = true;
      rerender();
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
    app.innerHTML = renderOrdersSuspendedBanner() + innerHtml + renderAdminSurface(currentProduct) + renderCartSurface();
    if (state.home) {
      applyThemeToggleVisibility(state.home.showThemeToggle === true);
    }
    bindAdminSurface(currentProduct);
    bindThemeToggle();
    bindCartUi();
    bindSiteMenu();
    applyTheme(currentTheme());
  }

  function renderOrdersSuspendedBanner() {
    if (!ordersAreSuspended()) {
      return "";
    }

    return '<div class="orders-suspended-banner" role="status">' + escapeHtml(ordersSuspendedBannerMessage()) + '</div>';
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
    var productSlugValue = String(source.productSlug || "").trim();
    var selections = source.selections && typeof source.selections === "object" && !Array.isArray(source.selections)
      ? cloneJson(source.selections)
      : {};
    var legacyUploadKey;

    if ((productSlugValue === "crachas" || productSlugValue === "imanes")
        && String(selections.order_flow || "") === "custom-artwork") {
      legacyUploadKey = productSlugValue === "crachas" ? "cracha_artwork_uploads" : "iman_artwork_uploads";
      selections.custom_artwork_uploads = (Array.isArray(selections[legacyUploadKey]) ? selections[legacyUploadKey] : []).map(function (upload) {
        var normalizedUpload = Object.assign({}, upload);
        normalizedUpload.quantity = Math.max(1, parseInt(upload && upload.quantity, 10) || parseInt(selections.pack_quantity, 10) || 1);
        normalizedUpload.feeCents = 500;
        return normalizedUpload;
      });
      delete selections[legacyUploadKey];
      selections.order_flow = "custom";
      selections.design_source = "custom";
      selections.catalog_context = "main-v2";
      productSlugValue = productSlugValue === "crachas" ? "crachas-loja" : "imanes-loja";
    }

    if (!id) {
      id = "ci_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    }

    return {
      id: id,
      productSlug: productSlugValue,
      productName: String(source.productName || "Produto").trim() || "Produto",
      summary: {
        title: String(summary.title || source.productName || "Produto").trim() || "Produto",
        subtitle: String(summary.subtitle || "").trim(),
        priceCents: Math.max(0, Number.isFinite(priceCents) ? priceCents : 0),
        priceText: String(summary.priceText || "").trim(),
        priceToConfirm: summary.priceToConfirm === true,
        image: summary.image ? String(summary.image).trim() : null
      },
      selections: selections
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

  function cartHasPriceToConfirm() {
    return getCartItems().some(function (item) {
      return !!(item && item.summary && item.summary.priceToConfirm === true);
    });
  }

  function molduraDisplayText(value) {
    return String(value || "")
      .replace(/\bQUADROS PERSONALIZADOS\b/g, "MOLDURAS PERSONALIZADAS")
      .replace(/\bQuadros personalizados\b/g, "Molduras personalizadas")
      .replace(/\bquadros personalizados\b/g, "molduras personalizadas")
      .replace(/\bQUADRO PERSONALIZADO\b/g, "MOLDURA PERSONALIZADA")
      .replace(/\bQuadro personalizado\b/g, "Moldura personalizada")
      .replace(/\bquadro personalizado\b/g, "moldura personalizada")
      .replace(/\bDOS QUADROS\b/g, "DAS MOLDURAS")
      .replace(/\bDos quadros\b/g, "Das molduras")
      .replace(/\bdos quadros\b/g, "das molduras")
      .replace(/\bDO QUADRO\b/g, "DA MOLDURA")
      .replace(/\bDo quadro\b/g, "Da moldura")
      .replace(/\bdo quadro\b/g, "da moldura")
      .replace(/\bNOS QUADROS\b/g, "NAS MOLDURAS")
      .replace(/\bNos quadros\b/g, "Nas molduras")
      .replace(/\bnos quadros\b/g, "nas molduras")
      .replace(/\bNO QUADRO\b/g, "NA MOLDURA")
      .replace(/\bNo quadro\b/g, "Na moldura")
      .replace(/\bno quadro\b/g, "na moldura")
      .replace(/\bOS QUADROS\b/g, "AS MOLDURAS")
      .replace(/\bOs quadros\b/g, "As molduras")
      .replace(/\bos quadros\b/g, "as molduras")
      .replace(/\bO QUADRO\b/g, "A MOLDURA")
      .replace(/\bO quadro\b/g, "A moldura")
      .replace(/\bo quadro\b/g, "a moldura")
      .replace(/\bUNS QUADROS\b/g, "UMAS MOLDURAS")
      .replace(/\bUns quadros\b/g, "Umas molduras")
      .replace(/\buns quadros\b/g, "umas molduras")
      .replace(/\bUM QUADRO\b/g, "UMA MOLDURA")
      .replace(/\bUm quadro\b/g, "Uma moldura")
      .replace(/\bum quadro\b/g, "uma moldura")
      .replace(/\bQUADROS\b/g, "MOLDURAS")
      .replace(/\bQuadros\b/g, "Molduras")
      .replace(/\bquadros\b/g, "molduras")
      .replace(/\bQUADRO\b/g, "MOLDURA")
      .replace(/\bQuadro\b/g, "Moldura")
      .replace(/\bquadro\b/g, "moldura");
  }

  function molduraCartDesignTitle(item) {
    var selections = item && item.selections && typeof item.selections === "object" ? item.selections : {};
    var designs = Array.isArray(selections.designs) ? selections.designs : [];
    var labels = selections.design_labels && typeof selections.design_labels === "object" ? selections.design_labels : {};
    var firstDesign = designs.length ? designs[0] : "";

    return firstDesign && labels[firstDesign] ? molduraDisplayText(labels[firstDesign]) : "";
  }

  function formatMolduraCartSubtitle(item, value, designTitle) {
    var selections = item && item.selections && typeof item.selections === "object" ? item.selections : {};
    var colors = Array.isArray(selections.colors) ? selections.colors.filter(Boolean) : [];
    var palette = String(selections.color_palette || "").trim();
    var colorNames = colors.join(", ");
    var colorCount = colors.length ? colors.length + (colors.length === 1 ? " Cor" : " Cores") : "";

    return String(value || "").split(/\s+·\s+/).filter(function (part) {
      return String(part).trim().toLowerCase() !== String(designTitle || "").trim().toLowerCase();
    }).map(function (part) {
      var text = String(part).trim();
      var lower = text.toLowerCase();

      if (colorCount && (text === colorNames || text === palette)) {
        return colorCount;
      }
      if (/^foto\s+/i.test(text)) {
        return "Foto" + text.slice(4);
      }
      if (lower === "sem frase") {
        return "Sem frase";
      }
      if (lower === "precisa de ajuda com a foto") {
        return "Precisa de ajuda com a foto";
      }
      return text;
    }).filter(Boolean).join(" · ");
  }

  function formatCartItemSummary(item) {
    var summary = item && item.summary ? item.summary : {};
    var priceCents = parseInt(summary.priceCents, 10);
    var isMoldura = !!(item && item.productSlug === "quadros");
    var productName = String((item && item.productName) || "Produto");
    var title = String(summary.title || (item && item.productName) || "Produto");
    var subtitle = String(summary.subtitle || "");
    var priceText = String(summary.priceText || "").trim() || (priceCents > 0 ? formatCents(priceCents) : "Preço a confirmar");

    if (isMoldura) {
      productName = molduraDisplayText(productName);
      title = molduraDisplayText(title);
      subtitle = molduraDisplayText(subtitle);
      priceText = molduraDisplayText(priceText);
      title = molduraCartDesignTitle(item) || title;
      subtitle = formatMolduraCartSubtitle(item, subtitle, title);
    }

    return {
      productName: productName,
      title: title,
      subtitle: subtitle,
      priceText: priceText,
      image: summary.image ? String(summary.image) : ""
    };
  }

  function cartCustomizationFeeText(item) {
    var selections = item && item.selections && typeof item.selections === "object" ? item.selections : {};
    var count = Math.max(0, parseInt(selections.customization_file_count, 10) || 0);
    var cents = Math.max(0, parseInt(selections.customization_fee_cents, 10) || 0);
    if (!count || !cents) {
      return "";
    }
    return "Preparação e testes: " + count + (count === 1 ? " imagem × 5,00 € = " : " imagens × 5,00 € = ") + formatCents(cents);
  }

  function cartProductPage(productSlugValue, selections) {
    var slug = String(productSlugValue || "").trim().replace(/[^a-z0-9_-]/gi, "");
    var context = selections && typeof selections === "object" ? String(selections.catalog_context || "") : "";
    if (slug === "quadros") {
      return "molduras.html";
    }
    if (slug === "crachas-loja") return "crachas.html";
    if (slug === "imanes-loja") return "imanes.html";
    if (slug === "mini-cadernos") return "mini-cadernos.html";
    if (slug === "cadernos-anuais") return "cadernos-anuais.html";
    if (!context && ["crachas", "imanes", "caderninhos", "cadernos"].indexOf(slug) !== -1) {
      return "congressos/2026/" + slug + ".html";
    }
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
    if (target === "index" || target === "index.html") {
      return "index.html";
    }
    return "checkout.html?step=1";
  }

  function checkoutUrlForStep(stepIndex) {
    return "checkout.html?step=" + (Math.max(0, Math.min(1, Number(stepIndex) || 0)) + 1);
  }

  function cartEditUrl(item, returnTo) {
    var id = item && item.id ? String(item.id) : "";
    var href = cartProductPage(item && item.productSlug, item && item.selections);
    return href + "?mode=edit&cartItem=" + encodeURIComponent(id) + "&returnTo=" + encodeURIComponent(safeCartReturnTo(returnTo));
  }

  // PERSONALIZACAO_BUILDER_V1: as linhas com artwork proprio sao montadas em
  // personalizacao.html e o wizard do catalogo ja nao sabe editá-las (perdeu o
  // passo de upload). Podem ser removidas e refeitas, mas nao editadas.
  function cartItemIsEditable(item) {
    var selections = item && item.selections && typeof item.selections === "object" ? item.selections : {};
    return String(selections.design_source || "") !== "custom";
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
    var customizationFee = cartCustomizationFeeText(item);
    var returnTo = page === "checkout" ? checkoutUrlForStep(state.checkoutStep) : "index.html";
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
      customizationFee ? '<em class="cart-item-customization-fee">' + escapeHtml(customizationFee) + '</em>' : "",
      '</div>',
      '<div class="cart-item-side">',
      '<span class="cart-item-price">' + escapeHtml(summary.priceText) + '</span>',
      '<div class="cart-item-actions">',
      cartItemIsEditable(item) ? '<button type="button" class="cart-edit-button" data-cart-edit="' + escapeHtml(item.id) + '" data-cart-edit-return="' + escapeHtml(returnTo) + '">Editar</button>' : "",
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
    var hasPriceToConfirm = cartHasPriceToConfirm();

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
        '<span>' + (hasPriceToConfirm ? 'Subtotal calculado' : 'Subtotal') + '</span>',
        '<strong>' + escapeHtml(subtotal > 0 ? formatCents(subtotal) : (hasPriceToConfirm ? 'Preço a confirmar' : formatCents(0))) + '</strong>',
        '</div>',
        hasPriceToConfirm ? '<p class="cart-panel-note">O valor do Super Personalizado será confirmado pela Mia.</p>' : '',
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
        openCartItemEditor(button.dataset.cartEdit, button.dataset.cartEditReturn || "index.html");
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
    if (isQuadrosProduct(product) && !state.selections.designs) {
      return false;
    }

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
    delete selections.customer_nif;
    delete selections.delivery_option;
    delete selections.send_copy;
    delete selections.send_copy_touched;
    delete selections.copy_email;

    selections.designs = isCustomArtworkSelected(product) ? [] : (isAssortedSelected(product) ? ["__sortido__"] : selectedDesignValues());
    selections.design_quantities = isCustomArtworkSelected(product) ? {} : cartDesignQuantities(product);
    selections.design_labels = isCustomArtworkSelected(product) ? {} : cartDesignLabels(product);
    selections.assorted_designs = !isCustomArtworkSelected(product) && isAssortedSelected(product) ? "1" : "";
    selections.pack_quantity = getPackQuantity(product);
    selections.size = priceInfo(product).size || selections.size || "";
    if (isMainCatalogProduct(product)) {
      selections.catalog_context = String(product.catalogContext || "main-v2");
      selections.order_flow = isCustomArtworkSelected(product) ? "custom" : "catalog";
      selections.design_source = selections.order_flow;
      if (!isCustomArtworkSelected(product)) {
        delete selections[customArtworkConfig(product).uploadKey];
        delete selections.customization_fee_cents;
        delete selections.customization_file_count;
        delete selections.artwork_total_quantity;
      } else {
        selections.customization_fee_cents = customArtworkFeeCents(product);
        selections.customization_file_count = customArtworkItems(product).length;
        selections.artwork_total_quantity = customArtworkTotalQuantity(product);
      }
    } else if (product && product.orderFlow) {
      selections.order_flow = String(product.orderFlow);
    } else {
      delete selections.order_flow;
    }

    if (isQuadrosProduct(product)) {
      selections.frame_size = priceInfo(product).frameSize || selections.frame_size || "";
    }

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
    var custom;
    var uploads;

    if (isCustomArtworkSelected(product)) {
      custom = customArtworkConfig(product);
      uploads = orderUploadItems(custom.uploadKey);
      if (!uploads.length || String(uploads[0].mime || "").toLowerCase() === "application/pdf" || /\.pdf$/i.test(String(uploads[0].name || ""))) {
        return null;
      }
      return orderUploadPreviewUrl(uploads[0]);
    }

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

    if (isCustomArtworkSelected(product)) {
      var custom = customArtworkConfig(product);
      var customQuantity = isCadernosProduct(product) ? cadernoOrderQuantity(product) : getPackQuantity(product);
      var customCount = customArtworkItems(product).length;
      parts = [
        selectedSizeLabel(product),
        productQuantityLabel(product, customQuantity),
        customCount + (customCount === 1 ? " design personalizado" : " designs personalizados"),
        customArtworkFeeCents(product) ? "preparação " + formatCents(customArtworkFeeCents(product)) : ""
      ].filter(Boolean);
      if (String(state.selections[custom.cardField] || "").trim()
          || orderUploadItems(custom.cardPhotoKey).length
          || orderUploadItems(custom.cardAudioKey).length) {
        parts.push("cartão personalizado");
      }
      return parts.join(" · ");
    }

    if (isQuadrosProduct(product)) {
      parts = [];
      designs = selectedDesignItems(product);
      if (state.selections.silhouette) {
        parts.push(String(state.selections.silhouette));
      }
      if (state.selections.mia_choose_colors) {
        parts.push("Cores escolhidas pela Mia");
      } else if (Array.isArray(state.selections.colors) && state.selections.colors.length) {
        parts.push(state.selections.colors.length + (state.selections.colors.length === 1 ? " Cor" : " Cores"));
      } else if (state.selections.color_palette) {
        parts.push("Cores");
      }
      if (state.selections.photo_orientation) {
        parts.push("Foto " + String(state.selections.photo_orientation).toLowerCase());
      }
      if (state.selections.baby_animal) {
        parts.push(String(state.selections.baby_animal));
      }
      if (state.selections.baby_gender) {
        parts.push(String(state.selections.baby_gender));
      }
      if (state.selections.baby_name) {
        parts.push(String(state.selections.baby_name));
      }
      if (designs[0] && priceInfo(product).frameSize) {
        parts.push(String(priceInfo(product).frameSize));
      }
      if (state.selections.no_phrase) {
        parts.push("Sem frase");
      }
      if (state.selections.quadro_super_example) {
        parts.push(String(state.selections.quadro_super_example));
      }
      if (selectedQuadroPackaging(product)) {
        parts.push(selectedQuadroPackaging(product).title || String(state.selections.packaging || ""));
      }
      if (orderUploadItems("quadro_uploads").length) {
        parts.push(orderUploadItems("quadro_uploads").length + (orderUploadItems("quadro_uploads").length === 1 ? " foto" : " fotos"));
      } else if (state.selections.photo_help) {
        parts.push("Precisa de ajuda com a foto");
      }
      if (orderUploadItems("quadro_reference_uploads").length) {
        parts.push(orderUploadItems("quadro_reference_uploads").length + (orderUploadItems("quadro_reference_uploads").length === 1 ? " foto de referência" : " fotos de referência"));
      }
      if (orderUploadItems("quadro_audio_uploads").length) {
        parts.push(orderUploadItems("quadro_audio_uploads").length + (orderUploadItems("quadro_audio_uploads").length === 1 ? " áudio" : " áudios"));
      }
      if (orderUploadItems("quadro_silhouette_uploads").length) {
        parts.push("silhueta enviada");
      }
      return parts.join(" · ");
    }

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
    var designs;

    if (isQuadrosProduct(product)) {
      designs = selectedDesignItems(product);
      title = designs[0] ? displayItemTitle(designs[0]) : "Moldura personalizada";
    } else if (isCadernosProduct(product)) {
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
        priceText: isQuadrosProduct(product) ? info.total || "Preço a confirmar" : "",
        priceToConfirm: isQuadrosProduct(product) && info.priceToConfirm === true,
        image: cartItemImage(product)
      }
    };
  }

  function addCurrentProductToCart(product, destination) {
    var item;
    var cart;

    // O construtor nao e um produto: cada linha do passo 2 entra no carrinho
    // como uma linha do seu proprio slug.
    if (isArtworkBuilderProduct(product)) {
      addBuilderLinesToCart(product, destination);
      return;
    }

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
      '<button class="button secondary" type="button" data-cart-add-another>Adicionar ao cesto e escolher outro produto</button>',
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

      if (step.template === "palette-grid") {
        normalized[step.id] = Array.isArray(value) ? value : (value ? [value] : []);
        return;
      }

      if (Array.isArray(value)) {
        normalized[step.id] = value[0] || "";
      }
    });

    if (isCadernosProduct(product) && Array.isArray(normalized.designs)) {
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

  function renderBrandButterfly() {
    return '<iframe class="brand-butterfly-frame" src="content/brand/brand-butterfly.html" title="" aria-hidden="true" tabindex="-1" inert sandbox=""></iframe>';
  }

  function renderBrandText(brand) {
    var text = brand || "Mia & Paper";
    var anchorIndex = state.brandButterflyEnabled === true ? text.lastIndexOf("r") : -1;

    if (anchorIndex < 0) {
      return '<span class="brand-text">' + escapeHtml(text) + '</span>';
    }

    return [
      '<span class="brand-text">',
      escapeHtml(text.slice(0, anchorIndex)),
      '<span class="brand-letter-r">',
      escapeHtml(text.charAt(anchorIndex)),
      renderBrandButterfly(),
      '</span>',
      escapeHtml(text.slice(anchorIndex + 1)),
      '</span>'
    ].join("");
  }

  function homeCategoryAnchor(category) {
    var id = String(category && category.id ? category.id : "produto")
      .trim()
      .replace(/[^a-z0-9_-]/gi, "-");
    return "#produto-" + id;
  }

  function siteMenuCategoryHref(category) {
    var href = category ? String(category.menuHref || category.href || "").trim() : "";
    return href || "index.html";
  }

  function renderSiteMenu(categories, instagramUrl) {
    var isOpen = state.siteMenuOpen === true;
    var orderedCategories = categories.map(function (category, index) {
      return { category: category, index: index };
    }).sort(function (a, b) {
      var aOrder = Number(a.category && a.category.menuOrder);
      var bOrder = Number(b.category && b.category.menuOrder);
      aOrder = isFinite(aOrder) && aOrder > 0 ? aOrder : 1000 + a.index;
      bOrder = isFinite(bOrder) && bOrder > 0 ? bOrder : 1000 + b.index;
      return aOrder - bOrder;
    }).map(function (record) {
      return record.category;
    });
    var categoryLinks = orderedCategories.map(function (category) {
      return [
        '<a class="site-menu-category-link" href="' + escapeHtml(siteMenuCategoryHref(category)) + '" data-site-menu-link>',
        '<span>' + escapeHtml(category.menuTitle || category.title || "Produto") + '</span>',
        '<b aria-hidden="true">→</b>',
        '</a>'
      ].join("");
    }).join("");

    return [
      '<div class="site-menu-surface' + (isOpen ? ' is-open' : '') + '" id="site-menu" data-site-menu-surface aria-hidden="' + (isOpen ? 'false' : 'true') + '">',
      '<button type="button" class="site-menu-backdrop" data-site-menu-close aria-label="Fechar menu"></button>',
      '<aside class="site-menu-panel" role="dialog" aria-modal="true" aria-labelledby="site-menu-title">',
      '<div class="site-menu-head">',
      '<div><p>Menu</p><h2 id="site-menu-title">Mia &amp; Paper</h2></div>',
      '<button type="button" class="site-menu-close" data-site-menu-close aria-label="Fechar menu">' + ICON_CLOSE + '</button>',
      '</div>',
      '<nav class="site-menu-nav" aria-label="Produtos">',
      '<a class="site-menu-home-link" href="index.html" data-site-menu-link>Início</a>',
      '<p>Produtos</p>',
      categoryLinks,
      '</nav>',
      '<div class="site-menu-secondary">',
      '<a href="index.html#produtos" data-site-menu-link>Produtos</a>',
      '<a href="contacto.html" data-site-menu-link>Contacto</a>',
      '<a href="' + escapeHtml(instagramUrl || "https://www.instagram.com/miaandpaper/") + '" target="_blank" rel="noopener" data-site-menu-link>Instagram</a>',
      '</div>',
      '</aside>',
      '</div>'
    ].join("");
  }

  function resetSiteMenuDrag(surface) {
    var panel = surface ? surface.querySelector(".site-menu-panel") : null;
    var backdrop = surface ? surface.querySelector(".site-menu-backdrop") : null;

    siteMenuGesture = null;
    if (panel) {
      panel.classList.remove("is-dragging");
      panel.style.removeProperty("transform");
    }
    if (backdrop) {
      backdrop.style.removeProperty("opacity");
    }
  }

  function bindSiteMenuSwipe(surface) {
    var panel = surface ? surface.querySelector(".site-menu-panel") : null;
    var backdrop = surface ? surface.querySelector(".site-menu-backdrop") : null;

    if (!panel || panel.dataset.siteMenuSwipeBound === "1") {
      return;
    }
    panel.dataset.siteMenuSwipeBound = "1";

    panel.addEventListener("pointerdown", function (event) {
      if (!state.siteMenuOpen || event.isPrimary === false || (event.button != null && event.button !== 0)) {
        return;
      }
      siteMenuGesture = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startedAt: Date.now(),
        distance: 0,
        dragging: false
      };
    });

    panel.addEventListener("pointermove", function (event) {
      var gesture = siteMenuGesture;
      var deltaX;
      var deltaY;
      var width;

      if (!gesture || gesture.pointerId !== event.pointerId || !state.siteMenuOpen) {
        return;
      }

      deltaX = event.clientX - gesture.startX;
      deltaY = event.clientY - gesture.startY;
      if (!gesture.dragging) {
        if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) {
          return;
        }
        if (deltaX <= 0 || Math.abs(deltaY) >= Math.abs(deltaX)) {
          siteMenuGesture = null;
          return;
        }
        gesture.dragging = true;
        panel.classList.add("is-dragging");
        if (panel.setPointerCapture) {
          try {
            panel.setPointerCapture(event.pointerId);
          } catch (error) {
            /* Alguns browsers não permitem captura em eventos simulados. */
          }
        }
      }

      gesture.distance = Math.max(0, deltaX);
      width = Math.max(1, panel.getBoundingClientRect().width);
      panel.style.transform = "translateX(" + Math.min(width, gesture.distance) + "px)";
      if (backdrop) {
        backdrop.style.opacity = String(Math.max(0, 1 - (gesture.distance / width)));
      }
      if (event.cancelable) {
        event.preventDefault();
      }
    }, { passive: false });

    function finishSwipe(event) {
      var gesture = siteMenuGesture;
      var width;
      var elapsed;
      var velocity;
      var shouldClose;

      if (!gesture || gesture.pointerId !== event.pointerId) {
        return;
      }
      if (!gesture.dragging) {
        siteMenuGesture = null;
        return;
      }

      width = Math.max(1, panel.getBoundingClientRect().width);
      elapsed = Math.max(1, Date.now() - gesture.startedAt);
      velocity = gesture.distance / elapsed;
      shouldClose = gesture.distance >= Math.min(88, width * 0.24) || (gesture.distance >= 36 && velocity >= 0.55);
      siteMenuSuppressClickUntil = Date.now() + 350;
      resetSiteMenuDrag(surface);
      if (shouldClose) {
        setSiteMenuOpen(false, true);
      }
      if (event.cancelable) {
        event.preventDefault();
      }
    }

    panel.addEventListener("pointerup", finishSwipe);
    panel.addEventListener("pointercancel", function (event) {
      if (siteMenuGesture && siteMenuGesture.pointerId === event.pointerId) {
        resetSiteMenuDrag(surface);
      }
    });
    panel.addEventListener("click", function (event) {
      if (Date.now() < siteMenuSuppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  }

  function setSiteMenuOpen(open, restoreFocus) {
    var surface = document.querySelector("[data-site-menu-surface]");
    var trigger = document.querySelector("[data-site-menu-open]");
    var closeButton = surface ? surface.querySelector(".site-menu-close") : null;

    resetSiteMenuDrag(surface);
    state.siteMenuOpen = open === true;
    document.body.classList.toggle("is-site-menu-open", state.siteMenuOpen);

    if (surface) {
      surface.classList.toggle("is-open", state.siteMenuOpen);
      surface.setAttribute("aria-hidden", state.siteMenuOpen ? "false" : "true");
    }
    if (trigger) {
      trigger.setAttribute("aria-expanded", state.siteMenuOpen ? "true" : "false");
    }

    if (state.siteMenuOpen && closeButton) {
      window.requestAnimationFrame(function () {
        closeButton.focus();
      });
    } else if (!state.siteMenuOpen && restoreFocus && trigger) {
      trigger.focus();
    }
  }

  function bindSiteMenu() {
    var trigger = document.querySelector("[data-site-menu-open]");
    var surface = document.querySelector("[data-site-menu-surface]");

    if (!trigger || !surface) {
      document.body.classList.remove("is-site-menu-open");
      return;
    }

    if (trigger.dataset.siteMenuBound !== "1") {
      trigger.dataset.siteMenuBound = "1";
      trigger.addEventListener("click", function (event) {
        event.preventDefault();
        setSiteMenuOpen(true, false);
      });
    }

    surface.querySelectorAll("[data-site-menu-close]").forEach(function (button) {
      if (button.dataset.siteMenuBound === "1") {
        return;
      }
      button.dataset.siteMenuBound = "1";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        setSiteMenuOpen(false, true);
      });
    });

    surface.querySelectorAll("[data-site-menu-link]").forEach(function (link) {
      if (link.dataset.siteMenuBound === "1") {
        return;
      }
      link.dataset.siteMenuBound = "1";
      link.addEventListener("click", function () {
        setSiteMenuOpen(false, false);
      });
    });

    bindSiteMenuSwipe(surface);

    if (!siteMenuEscapeBound) {
      siteMenuEscapeBound = true;
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && state.siteMenuOpen) {
          setSiteMenuOpen(false, true);
        }
      });
    }
  }

  function renderBrand(brand, homeUrl, instagramUrl, menuCategories) {
    var brandLabel = brand || "Mia & Paper";
    var categories = Array.isArray(menuCategories) ? menuCategories.filter(homeCategoryIsVisible) : [];
    var hasSiteMenu = categories.length > 0;
    var actions = hasSiteMenu ? [
      renderCartHeaderButton(),
      '<button type="button" class="header-link header-link-icon site-menu-trigger" data-site-menu-open aria-expanded="' + (state.siteMenuOpen ? 'true' : 'false') + '" aria-controls="site-menu" aria-label="Abrir menu" title="Menu">' + ICON_MENU + '</button>',
      '<button type="button" class="header-link header-link-icon header-theme-toggle" data-theme-toggle aria-pressed="false" aria-hidden="true" hidden aria-label="Modo escuro" title="Modo escuro">' + ICON_SUN + '</button>'
    ].join("") : [
      '<a class="header-link header-link-icon" href="' + escapeHtml(instagramUrl) + '" target="_blank" rel="noopener" aria-label="Instagram" title="Instagram">' + ICON_INSTAGRAM + '</a>',
      '<a class="header-link header-link-icon" href="contacto.html" aria-label="Enviar mensagem" title="Enviar mensagem">' + ICON_MAIL + '</a>',
      renderCartHeaderButton(),
      '<button type="button" class="header-link header-link-icon header-theme-toggle" data-theme-toggle aria-pressed="false" aria-hidden="true" hidden aria-label="Modo escuro" title="Modo escuro">' + ICON_SUN + '</button>'
    ].join("");

    return [
      '<header class="site-header' + (hasSiteMenu ? ' has-site-menu' : '') + '">',
      '<a class="brand" href="' + escapeHtml(homeUrl || "index.html") + '" aria-label="' + escapeHtml(brandLabel) + '">',
      '<span class="brand-mark"><img src="content/brand/logo.webp" alt="" loading="lazy"></span>',
      renderBrandText(brandLabel),
      '</a>',
      '<nav class="header-actions" aria-label="Links rápidos">' + actions + '</nav>',
      '</header>',
      hasSiteMenu ? renderSiteMenu(categories, instagramUrl) : ""
    ].join("");
  }

  function installStaticSiteNavigation(home) {
    var header = document.querySelector(".site-header");
    var footer = document.querySelector(".site-footer");
    var categories = home && Array.isArray(home.categories) ? home.categories.filter(homeCategoryIsVisible) : [];
    var template;

    if (!header || !categories.length) {
      return;
    }

    state.siteMenuCategories = categories;
    template = document.createElement("template");
    template.innerHTML = renderBrand(home.brand || "Mia & Paper", "index.html", home.instagramUrl, categories);
    header.replaceWith(template.content.cloneNode(true));

    if (footer) {
      template = document.createElement("template");
      template.innerHTML = renderFooter(home.brand || "Mia & Paper", false);
      footer.replaceWith(template.content.cloneNode(true));
    }

    if (!document.querySelector("[data-cart-surface]")) {
      document.body.insertAdjacentHTML("beforeend", renderCartSurface());
    }

    bindSiteMenu();
    bindCartUi();
    bindThemeToggle();
    refreshCartUi();
  }

  function renderFooter(brand, showAdminLogin) {
    return [
      '<footer class="site-footer">',
      '<a class="catalog-footer-link" href="index.html#produtos">Ver produtos</a>',
      '<a href="privacy.html">Política de Privacidade</a>',
      showAdminLogin === false ? "" : '<button type="button" data-admin-open>Login de Administrador</button>',
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
      var imageStyle = hasStaticImage ? ' style="--category-image:url(&quot;' + escapeHtml(category.image) + '&quot;)"' : carouselStyle;
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
      var heroPosition = String(hero.imagePosition || "center").trim();
      var heroStyle;
      var newsCards;
      var heroActions;

      if (!/^[a-z0-9.%\s-]+$/i.test(heroPosition)) {
        heroPosition = "center";
      }
      heroStyle = (heroImage || heroImages.length)
        ? ' style="' + (!heroImages.length && heroImage ? '--home-hero-image:url(&quot;' + escapeHtml(heroImage) + '&quot;);' : '')
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

  function productFamily(product) {
    var slug = String(product && product.slug || "");
    var explicit = String(product && product.family || "");

    if (explicit) {
      return explicit;
    }
    if (slug === "crachas-loja" || slug === "crachas" || slug === "pins") {
      return "crachas";
    }
    if (slug === "imanes-loja" || slug === "imanes") {
      return "imanes";
    }
    if (slug === "mini-cadernos" || slug === "caderninhos") {
      return "caderninhos";
    }
    if (slug === "cadernos-anuais" || slug === "cadernos") {
      return "cadernos";
    }
    return slug;
  }

  function isMainCatalogProduct(product) {
    return !!(product
      && String(product.catalogContext || "") === "main-v2"
      && String(product.orderFlow || "") === "catalog-or-custom");
  }

  function supportsAssortedDesigns(product) {
    return !!(product && ["crachas", "imanes", "imanes-recortados", "caderninhos", "bloquinhos", "stickers", "marcadores"].indexOf(productFamily(product)) !== -1);
  }

  function isAssortedSelected(product) {
    return supportsAssortedDesigns(product) && state.selections.assorted_designs === "1";
  }

  function isCadernosProduct(product) {
    return !!(product && productFamily(product) === "cadernos");
  }

  function isQuadrosProduct(product) {
    return !!(product && product.slug === "quadros");
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
    if (isCustomArtworkSelected(product)) {
      var upload = customArtworkItems(product)[0] || null;
      var isPdf = upload && (String(upload.mime || "").toLowerCase() === "application/pdf" || /\.pdf$/i.test(String(upload.name || "")));
      return upload ? {
        id: "custom-cover",
        value: "custom-cover",
        title: "Capa personalizada",
        subtitle: isPdf ? "PDF enviado" : "Imagem enviada",
        image: isPdf ? "" : orderUploadPreviewUrl(upload),
        visual: "neutral",
        imageFit: "cover"
      } : null;
    }
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
    return step && step.promoNote ? plainInlineText(step.promoNote) : "";
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
    if (isCustomArtworkSelected(product)) {
      return customArtworkTotalQuantity(product);
    }
    var options = cadernoOrderQuantityOptions(product);
    var config = cadernoOrderQuantityConfig(product);
    var minimum = Math.max(1, parseInt(config.minimum, 10) || parseInt(product && product.minimumQuantity, 10) || 1);
    var maximum = Math.max(minimum, parseInt(config.maximum, 10) || 9999);
    var fallback = Math.max(minimum, parseInt(config.default, 10) || options[0] || minimum);
    var selected = Math.max(minimum, Math.min(maximum, parseInt(state.selections.caderno_order_quantity, 10) || fallback));

    return isMainCatalogProduct(product) ? selected : (options.indexOf(selected) !== -1 ? selected : fallback);
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

  function freeQuantityStep(product) {
    var step = product ? findStep(product, "pack") : null;
    return step && step.freeQuantity === true ? step : null;
  }

  // PRICING_MODE_BY_PRICE_KEY_V1: o modo de preço é do produto, mas cada tabela
  // de preços pode ter o seu. Nos ímanes, os finos vendem-se ao escalão (o
  // mínimo é 15, mas depois vale qualquer quantidade) enquanto os de 3 mm
  // continuam a somar packs exactos. Tem de dar sempre o mesmo modo que
  // `main_v2_effective_pricing_mode` no send-order.php.
  function effectivePricingMode(product) {
    var step = freeQuantityStep(product);
    var byKey = (product && product.pricingModeByPriceKey)
      || (step && step.pricingModeByPriceKey)
      || null;
    var priceKey = priceKeyForSize(product, state.selections.size);

    if (byKey && priceKey && byKey[priceKey]) {
      return String(byKey[priceKey]);
    }
    return String((product && product.pricingMode) || (step && step.pricingMode) || "");
  }

  function usesLinearDiscountPricing(product) {
    var step = freeQuantityStep(product);
    return !!(step && effectivePricingMode(product) === "linear-discount-interpolation");
  }

  // TIER_UNIT_PRICING_V1: cada escalão fixa uma percentagem de desconto sobre o
  // preço unitário do escalão mínimo. A partir do mínimo vale qualquer
  // quantidade, e cada unidade extra é vendida com o desconto do escalão em
  // vigor — 16 ímanes finos são 16 x o unitário do escalão de 15.
  function usesTierUnitPricing(product) {
    return effectivePricingMode(product) === "tier-unit";
  }

  // Preço por unidade do escalão em vigor, sem passar pelo total arredondado.
  function tierUnitPriceCents(table, quantity) {
    var tier = 0;

    priceTiers(table).forEach(function (candidate) {
      if (candidate <= quantity) {
        tier = candidate;
      }
    });

    return tier ? (Number(table[String(tier)]) || 0) / tier : 0;
  }

  function priceTiers(table) {
    return Object.keys(table || {})
      .map(function (key) { return parseInt(key, 10) || 0; })
      .filter(function (quantity) { return quantity > 0 && Number(table[String(quantity)]) > 0; })
      .sort(function (a, b) { return a - b; });
  }

  // PACK_COMBINATION_V1: sem descontos intermédios. O preço de N unidades é o da
  // combinação de packs mais barata que dá exactamente N. Tem de dar sempre o
  // mesmo cêntimo que `product_pack_combination_plan` no send-order.php, por
  // isso o algoritmo e o desempate são iguais: troco por programação dinâmica.
  // Por defeito ganha o pack mais pequeno; tabelas com `fewer-packs` usam menos
  // packs quando o custo empata, sem alterar o comportamento dos outros produtos.
  function usesPackCombinationPricing(product) {
    return effectivePricingMode(product) === "pack-combination";
  }

  var packCombinationCache = {};

  function packCombinationTablePacks(table) {
    return Object.keys(table || {})
      .map(function (key) { return { quantity: parseInt(key, 10), cents: parseInt(table[key], 10) }; })
      .filter(function (pack) { return pack.quantity > 0 && pack.cents > 0; })
      .sort(function (a, b) { return a.quantity - b.quantity; });
  }

  function packCombinationPrefersFewerPacks(product, priceKey) {
    var step = freeQuantityStep(product);
    var mapping = (product && product.combinationTieBreakByPriceKey)
      || (step && step.combinationTieBreakByPriceKey)
      || {};
    var key = priceKey || priceKeyForSize(product, state.selections.size);

    return String(mapping[key] || "") === "fewer-packs";
  }

  function packCombinationUsesNextPackUpgrade(product) {
    var step = freeQuantityStep(product);
    var mapping = (product && product.upgradeToNextPackByPriceKey)
      || (step && step.upgradeToNextPackByPriceKey)
      || {};
    var key = priceKeyForSize(product, state.selections.size);

    return mapping[key] === true;
  }

  // Devolve { cents, parts: [{quantity, count}] } ou null se os packs não
  // conseguirem somar exactamente esta quantidade.
  function packCombinationPlan(table, quantity, preferFewerPacks) {
    var target = Math.max(0, parseInt(quantity, 10) || 0);
    var packs = packCombinationTablePacks(table);
    var chave;
    var cost;
    var packCount;
    var pick;
    var n;
    var i;
    var rest;
    var candidate;
    var candidateCount;
    var parts;
    var order;

    if (!packs.length || target <= 0) {
      return null;
    }

    chave = packs.map(function (p) { return p.quantity + ":" + p.cents; }).join(",") + "|" + target + "|" + (preferFewerPacks ? "few" : "small");
    if (Object.prototype.hasOwnProperty.call(packCombinationCache, chave)) {
      return packCombinationCache[chave];
    }

    cost = new Array(target + 1);
    packCount = new Array(target + 1);
    pick = new Array(target + 1);
    cost[0] = 0;
    packCount[0] = 0;
    pick[0] = 0;

    for (n = 1; n <= target; n += 1) {
      cost[n] = null;
      packCount[n] = null;
      pick[n] = 0;
      for (i = 0; i < packs.length; i += 1) {
        if (packs[i].quantity > n) {
          break;
        }
        rest = cost[n - packs[i].quantity];
        if (rest === null) {
          continue;
        }
        candidate = rest + packs[i].cents;
        candidateCount = packCount[n - packs[i].quantity] + 1;
        if (cost[n] === null
          || candidate < cost[n]
          || (preferFewerPacks && candidate === cost[n] && candidateCount < packCount[n])) {
          cost[n] = candidate;
          packCount[n] = candidateCount;
          pick[n] = packs[i].quantity;
        }
      }
    }

    if (cost[target] === null) {
      packCombinationCache[chave] = null;
      return null;
    }

    parts = {};
    n = target;
    while (n > 0 && pick[n] > 0) {
      parts[pick[n]] = (parts[pick[n]] || 0) + 1;
      n -= pick[n];
    }
    order = Object.keys(parts).map(Number).sort(function (a, b) { return b - a; });

    packCombinationCache[chave] = {
      cents: cost[target],
      parts: order.map(function (q) {
        var pack = packs.filter(function (p) { return p.quantity === q; })[0];
        return {
          quantity: q,
          count: parts[q],
          unitCents: pack ? pack.cents : 0,
          cents: pack ? pack.cents * parts[q] : 0
        };
      })
    };
    return packCombinationCache[chave];
  }

  function packCombinationCents(table, quantity, preferFewerPacks) {
    var plan = packCombinationPlan(table, quantity, preferFewerPacks);
    return plan ? plan.cents : 0;
  }

  // Quantidades que os packs conseguem somar. Nos crachás e mini-cadernos é
  // tudo a partir de 1 (há preço de unidade); nos ímanes achatados, cujos packs
  // são todos múltiplos de 15, é só 15, 30, 45...
  function packCombinationReachable(table, quantity) {
    return packCombinationPlan(table, quantity) !== null;
  }

  function packCombinationNextReachable(table, quantity, direction, limit) {
    var step = direction < 0 ? -1 : 1;
    var q = Math.max(1, parseInt(quantity, 10) || 1);
    var ceiling = Math.max(1, parseInt(limit, 10) || 9999);
    var guard = 0;

    while (q >= 1 && q <= ceiling && guard < 10000) {
      if (packCombinationReachable(table, q)) {
        return q;
      }
      q += step;
      guard += 1;
    }
    return 0;
  }

  function usesFlatUnitPricing(product) {
    return effectivePricingMode(product) === "flat-unit";
  }

  // Packs visíveis no passo da quantidade: são os itens do passo que também
  // têm entrada na tabela de preços ativa. Serve para decidir se vale a pena
  // mostrar a grelha de packs num produto de preço unitário fixo — com um
  // único pack de referência ("1+") não vale, e os produtos antigos ficam
  // exatamente como estavam.
  function packSelectorItemCount(product) {
    var packStep = findStep(product, "pack");
    var priceTable = activePriceTableForPackFilter(product);

    if (!packStep || !Array.isArray(packStep.items)) {
      return 0;
    }

    return packStep.items.filter(function (item) {
      return !priceTable || priceTable[String(Number(item.quantity))] != null;
    }).length;
  }

  function showsPackOptions(product) {
    return !usesFlatUnitPricing(product) || packSelectorItemCount(product) > 1;
  }

  function freeQuantitySelectionMode(product) {
    var explicit = String(state.selections.free_quantity_mode || "");
    var current = getPackQuantity(product);
    var table = activePriceTableForPackFilter(product);

    if (explicit === "pack" || explicit === "custom") {
      return explicit;
    }
    return current && table && table[String(current)] != null ? "pack" : "custom";
  }

  var FREE_QUANTITY_RANGE_MAXIMUM = 100;

  function freeQuantityRangeMaximum(product) {
    return Math.max(
      effectiveMinimumFreeQuantity(product),
      Math.min(maximumFreeQuantity(product), FREE_QUANTITY_RANGE_MAXIMUM)
    );
  }

  function freeQuantityRangePosition(product, quantity) {
    var minimum = effectiveMinimumFreeQuantity(product);
    var maximum = freeQuantityRangeMaximum(product);
    return Math.max(minimum, Math.min(maximum, Math.round(Number(quantity) || minimum)));
  }

  function freeQuantityFromRangePosition(product, position) {
    var minimum = effectiveMinimumFreeQuantity(product);
    var maximum = freeQuantityRangeMaximum(product);
    return Math.max(minimum, Math.min(maximum, Math.round(Number(position) || minimum)));
  }

  function freeQuantityModeForValue(product, quantity) {
    var table = activePriceTableForPackFilter(product);
    var count = Math.max(0, Math.round(Number(quantity) || 0));
    return count && table && table[String(count)] != null ? "pack" : "custom";
  }

  function isCustomArtworkProduct(product) {
    return !!(product && findStep(product, "artwork_upload"));
  }

  function isCustomArtworkSelected(product) {
    return isCustomArtworkProduct(product) && String(state.selections.order_flow || "") === "custom";
  }

  function customArtworkConfig(product) {
    var artworkStep = product ? findStep(product, "artwork_upload") : null;
    var detailsStep = product ? findStep(product, "details") : null;
    var upload = artworkStep && artworkStep.upload ? artworkStep.upload : {};
    var media = detailsStep && detailsStep.mediaAttachments ? detailsStep.mediaAttachments : {};
    var field = detailsStep && Array.isArray(detailsStep.fields) ? detailsStep.fields[0] : null;

    return {
      uploadKey: String(upload.selectionKey || "artwork_uploads"),
      helpKey: String(upload.helpKey || "artwork_help"),
      cardField: String(field && field.name || "card_description"),
      cardPhotoKey: String(media.photos && media.photos.selectionKey || "card_reference_uploads"),
      cardAudioKey: String(media.audio && media.audio.selectionKey || "card_audio_uploads"),
      feePerFileCents: Math.max(0, parseInt(product && product.customArtwork && product.customArtwork.feePerFileCents, 10) || parseInt(upload.feePerFileCents, 10) || 0),
      feeTitle: String(product && product.customArtwork && (product.customArtwork.feeTitle || product.customArtwork.feeLabel) || upload.feeTitle || upload.feeLabel || "Preparação do design e testes"),
      feeText: String(product && product.customArtwork && (product.customArtwork.feeText || product.customArtwork.feeDescription) || upload.feeText || upload.feeDescription || "Inclui a preparação do ficheiro e os testes necessários antes da produção."),
      preserveOriginal: upload.preserveOriginal === true || !!(product && product.customArtwork && product.customArtwork.preserveOriginal === true),
      allowPdf: upload.allowPdf === true || !!(product && product.customArtwork && Array.isArray(product.customArtwork.acceptedMimeTypes) && product.customArtwork.acceptedMimeTypes.indexOf("application/pdf") !== -1),
      showQuantity: upload.showQuantity === true || upload.quantityPerFile === true,
      purpose: String(upload.purpose || "custom-artwork")
    };
  }

  function customArtworkItems(product) {
    if (!isCustomArtworkProduct(product)) {
      return [];
    }
    return orderUploadItems(customArtworkConfig(product).uploadKey);
  }

  function customArtworkItemQuantity(item) {
    return Math.max(1, Math.min(9999, parseInt(item && item.quantity, 10) || 1));
  }

  function customArtworkTotalQuantity(product) {
    return customArtworkItems(product).reduce(function (total, item) {
      return total + customArtworkItemQuantity(item);
    }, 0);
  }

  function customArtworkFeeCents(product) {
    var config = customArtworkConfig(product);
    return isCustomArtworkSelected(product) ? config.feePerFileCents * customArtworkItems(product).length : 0;
  }

  function selectedSizeItem(product, size) {
    var step = product ? findStep(product, "size") : null;
    var selected = String(size == null ? state.selections.size || "" : size);
    return step && Array.isArray(step.items) ? step.items.filter(function (item) {
      return item && String(item.value) === selected;
    })[0] || null : null;
  }

  function priceKeyForSize(product, size) {
    var item = selectedSizeItem(product, size);
    return String(item && item.priceKey || size || "");
  }

  function minimumFreeQuantity(product) {
    var item = selectedSizeItem(product);
    return Math.max(1, parseInt(item && item.minQuantity, 10) || 1);
  }

  function maximumFreeQuantity(product) {
    var step = freeQuantityStep(product);
    return Math.max(minimumFreeQuantity(product), parseInt(step && step.maxQuantity, 10) || 9999);
  }

  function effectiveMinimumFreeQuantity(product) {
    var minimum = minimumFreeQuantity(product);
    var table;
    var alcancavel;

    if (isMainCatalogProduct(product)
        && !isCustomArtworkSelected(product)
        && !isAssortedSelected(product)) {
      minimum = Math.max(minimum, selectedDesignItems(product).length);
    }

    // No modo escalão não há quantidades proibidas acima do mínimo, mas abaixo
    // do primeiro escalão não há preço: os finos começam nos 15.
    if (usesTierUnitPricing(product)) {
      var tiers = priceTiers(activePriceTableForPackFilter(product));
      return tiers.length ? Math.max(minimum, tiers[0]) : minimum;
    }

    // Com packs combinados o mínimo tem de ser uma quantidade que os packs
    // consigam somar: nos ímanes achatados o primeiro é 15, não 1.
    table = packCombinationTableFor(product);
    if (table) {
      alcancavel = packCombinationNextReachable(table, minimum, 1, maximumFreeQuantity(product));
      if (alcancavel) {
        minimum = alcancavel;
      }
    }
    return minimum;
  }

  function packCombinationTableFor(product) {
    if (!usesPackCombinationPricing(product)) {
      return null;
    }
    var table = activePriceTableForPackFilter(product);
    return table && Object.keys(table).length ? table : null;
  }

  // Encosta uma quantidade à quantidade alcançável mais próxima, preferindo a
  // direcção em que o utilizador estava a andar.
  function snapQuantityToPacks(product, quantity, direction) {
    var table = packCombinationTableFor(product);
    var minimum = effectiveMinimumFreeQuantity(product);
    var maximum = freeQuantityRangeMaximum(product);
    var pedido = Math.max(minimum, Math.min(maximum, Math.round(Number(quantity) || minimum)));
    var acima;
    var abaixo;

    if (!table || packCombinationReachable(table, pedido)) {
      return pedido;
    }

    acima = packCombinationNextReachable(table, pedido, 1, maximum);
    abaixo = packCombinationNextReachable(table, pedido, -1, maximum);
    if (abaixo && abaixo < minimum) {
      abaixo = 0;
    }

    if (direction < 0) {
      return abaixo || acima || pedido;
    }
    if (direction > 0) {
      return acima || abaixo || pedido;
    }
    if (acima && abaixo) {
      return (pedido - abaixo) <= (acima - pedido) ? abaixo : acima;
    }
    return acima || abaixo || pedido;
  }

  function tierPriceCents(priceTable, quantity) {
    var count = Math.max(0, parseInt(quantity, 10) || 0);
    var tiers;
    var tier;

    if (!priceTable || !count) {
      return 0;
    }
    if (priceTable[String(count)] != null) {
      return Math.max(0, Math.round(Number(priceTable[String(count)]) || 0));
    }
    tiers = Object.keys(priceTable).map(function (key) { return parseInt(key, 10) || 0; })
      .filter(Boolean).sort(function (a, b) { return a - b; });
    if (!tiers.length) {
      return 0;
    }
    tier = tiers[0];
    tiers.forEach(function (candidate) {
      if (candidate <= count) {
        tier = candidate;
      }
    });
    return Math.max(0, Math.round(count * (Number(priceTable[String(tier)]) || 0) / tier));
  }

  // LINEAR_DISCOUNT_PRICING_V1: cada pack define um ponto de desconto.
  // Entre dois packs, a percentagem de desconto evolui em linha reta; assim,
  // chegar a um pack maior nunca provoca uma queda brusca do preco total.
  // Antes do primeiro e depois do ultimo pack mantem-se o desconto do extremo.
  function linearDiscountPriceCents(priceTable, quantity) {
    var count = Math.max(0, parseInt(quantity, 10) || 0);
    var baseline = baselineUnitCents(priceTable);
    var points;
    var lower;
    var upper;
    var discount;

    if (!count || !baseline) {
      return 0;
    }
    if (priceTable && priceTable[String(count)] != null) {
      return Math.max(0, Math.round(Number(priceTable[String(count)]) || 0));
    }

    points = Object.keys(priceTable || {}).map(function (key) {
      var packQuantity = parseInt(key, 10) || 0;
      var packCents = Math.max(0, Number(priceTable[key]) || 0);
      return {
        quantity: packQuantity,
        discount: packQuantity && packCents
          ? Math.max(0, 1 - packCents / (baseline * packQuantity))
          : 0
      };
    }).filter(function (point) {
      return point.quantity > 0;
    }).sort(function (a, b) {
      return a.quantity - b.quantity;
    });

    if (!points.length) {
      return 0;
    }
    lower = points[0];
    upper = points[points.length - 1];
    points.forEach(function (point) {
      if (point.quantity < count) {
        lower = point;
      } else if (point.quantity > count && upper.quantity === points[points.length - 1].quantity) {
        upper = point;
      }
    });

    if (count <= points[0].quantity) {
      discount = points[0].discount;
    } else if (count >= points[points.length - 1].quantity) {
      discount = points[points.length - 1].discount;
    } else {
      discount = lower.discount + (upper.discount - lower.discount)
        * (count - lower.quantity) / (upper.quantity - lower.quantity);
    }
    return Math.max(0, Math.round(count * baseline * (1 - discount)));
  }

  function linearDiscountPriceSeries(priceTable, maximumQuantity) {
    var limit = Math.max(0, parseInt(maximumQuantity, 10) || 0);
    var prices = new Array(limit + 1);
    var quantity;

    prices[0] = 0;
    for (quantity = 1; quantity <= limit; quantity += 1) {
      prices[quantity] = linearDiscountPriceCents(priceTable, quantity);
    }
    return prices;
  }

  function activePriceTableForPackFilter(product) {
    var prices = product && product.prices ? product.prices : {};
    var keys = Object.keys(prices);

    var selectedPriceKey = priceKeyForSize(product, state.selections.size);

    if (selectedPriceKey && prices[selectedPriceKey]) {
      return prices[selectedPriceKey];
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

    // Nos fluxos de quantidade livre, os itens do JSON servem apenas de
    // referência visual/preço-base. A quantidade efetiva pode ser qualquer
    // inteiro válido e, ao escolher vários designs, começa em uma unidade por
    // design. Não escondas por isso a referência "1+".
    if (packStep.freeQuantity === true) {
      return packStep.items || [];
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
    if (isCustomArtworkSelected(product) && !isCadernosProduct(product)) {
      return customArtworkTotalQuantity(product);
    }
    if (freeQuantityStep(product)) {
      return Number.isInteger(pack) && pack >= effectiveMinimumFreeQuantity(product) && pack <= maximumFreeQuantity(product)
        ? pack
        : 0;
    }
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

    if (isCustomArtworkSelected(product)) {
      if (!isCadernosProduct(product)) {
        state.selections.pack_quantity = customArtworkTotalQuantity(product);
      }
      state.selections.design_quantities = {};
      state.quantitySignature = "__custom_artwork__";
      state.quantitiesTouched = false;
      state.quantityPackBaseline = customArtworkTotalQuantity(product);
      return;
    }

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
      if (freeQuantityStep(product)) {
        if (!Number.isInteger(current)
            || current < effectiveMinimumFreeQuantity(product)
            || current > maximumFreeQuantity(product)) {
          current = effectiveMinimumFreeQuantity(product);
        }
      } else if (!current || allowedQuantities.indexOf(current) === -1) {
        current = allowed[0] ? Number(allowed[0].quantity) : 0;
      }
      if (current) {
        state.selections.pack_quantity = current;
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

    if (freeQuantityStep(product)) {
      var minimumForSelectedDesigns = effectiveMinimumFreeQuantity(product);
      var maximumForSelectedDesigns = maximumFreeQuantity(product);
      if (!Number.isInteger(current)
          || current < minimumForSelectedDesigns
          || current > maximumForSelectedDesigns) {
        current = Math.min(maximumForSelectedDesigns, minimumForSelectedDesigns);
        state.selections.pack_quantity = current;
      }
    } else if (!current || allowedQuantities.indexOf(current) === -1) {
      current = allowed[0] ? Number(allowed[0].quantity) : 0;
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
    // Não trocar valores predefinidos falsos (false, "", 0) por um objecto
    // truthy. Isso fazia, por exemplo, "a Mia escolhe" ficar activo apesar de
    // o fundo branco ter sido definido explicitamente.
    if (value === undefined) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(value));
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

    // O construtor nao tem tabela de precos propria: escreve-la aqui poluiria
    // o content/pricing.json com um produto que nao existe.
    if (isArtworkBuilderProduct(product)) {
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

    if (!packStep || packStep.freeQuantity === true || !Array.isArray(packStep.items) || !quantities.length) {
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
    return product.unitLabel || (productFamily(product) === "crachas" ? "crachás" : "unidades");
  }

  function productUnitSingular(product) {
    return product.unitSingular || (productFamily(product) === "crachas" ? "crachá" : "unidade");
  }

  function productQuantityLabel(product, quantity) {
    return Number(quantity) + " " + (Number(quantity) === 1 ? productUnitSingular(product) : productUnit(product));
  }

  function productUnitShort(product) {
    return product.unitShort || (productFamily(product) === "crachas" ? "crachá" : "unid.");
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
  // existir (para casos como "Valor mínimo\n5,55 €").
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
    var priceKey = priceKeyForSize(product, size);
    var table = product.prices && product.prices[priceKey] ? product.prices[priceKey] : null;
    var cents = table && packQuantity
      ? (freeQuantityStep(product)
        ? (usesPackCombinationPricing(product)
          ? packCombinationCents(table, packQuantity, packCombinationPrefersFewerPacks(product, priceKey))
          : (usesFlatUnitPricing(product)
            ? Math.round(baselineUnitCents(table) * packQuantity)
            : (usesLinearDiscountPricing(product)
              ? linearDiscountPriceCents(table, packQuantity)
              : tierPriceCents(table, packQuantity))))
        : Number(table[String(packQuantity)]))
      : 0;
    var unitCents = baselineUnitCents(table);
    var discount = 0;
    var tierUnitCents = 0;

    if (unitCents && cents && packQuantity && cents < unitCents * packQuantity) {
      // No modo escalão o desconto é o do escalão, e é constante dentro dele.
      // Tirá-lo do total arredondado fazia a percentagem saltar entre 7% e 8%
      // de quantidade para quantidade, quando o desconto real não muda.
      tierUnitCents = usesTierUnitPricing(product) ? tierUnitPriceCents(table, packQuantity) : 0;
      discount = tierUnitCents
        ? Math.round((1 - (tierUnitCents / unitCents)) * 100)
        : Math.round((1 - (cents / (unitCents * packQuantity))) * 100);
    }

    var basePriceCents = cents;
    var artworkFeeCents = customArtworkFeeCents(product);
    cents = basePriceCents + artworkFeeCents;

    return {
      size: size,
      quantity: packQuantity,
      cents: cents,
      baseCents: Math.max(0, basePriceCents),
      customizationFeeCents: artworkFeeCents,
      total: cents ? formatCents(cents) : "",
      perPin: basePriceCents ? formatUnitPrice(basePriceCents, packQuantity, productUnitShort(product)) : "",
      discount: discount
    };
  }

  function priceDisplayName(product, size) {
    if (product && productFamily(product) === "crachas") {
      if (size === "25 mm") {
        return "Crachás Pequenos";
      }

      if (size === "32 mm") {
        return "Crachás Médios";
      }
    }

    if (product && productFamily(product) === "imanes") {
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
    var customizationFeeCents = customArtworkFeeCents(product);
    var totalCents = unitCents * orderQuantity + customizationFeeCents;

    return {
      size: option ? option.title : "",
      quantity: option ? Number(option.quantity) : 0,
      orderQuantity: option ? orderQuantity : 0,
      cents: totalCents,
      baseCents: baseCents,
      personalizationCents: extraCents,
      customizationFeeCents: customizationFeeCents,
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

    if (info.customizationFeeCents) {
      return "Produtos: " + (info.baseSubtotal || info.baseTotal) + " + Preparação dos designs: " + formatCents(info.customizationFeeCents) + " = " + info.total;
    }

    if (info.personalizationTotal) {
      return "Preço base: " + info.baseTotal + " + Personalização: " + info.personalizationTotal + " = " + info.unitTotal;
    }

    return "Preço base: " + info.baseTotal;
  }

  function selectedQuadroPackaging(product) {
    return selectedCadernosStepItem(product, "packaging");
  }

  function quadroPackagingExtraCents(product) {
    var packaging = selectedQuadroPackaging(product);
    return packaging ? Math.max(0, Number(packaging.extraPriceCents) || 0) : 0;
  }

  function quadroPriceEquation(info) {
    if (!info || !info.baseTotal) {
      return "";
    }

    if (info.packagingTotal) {
      return "Preço base: " + info.baseTotal + " + Embrulho: " + info.packagingTotal + " = " + info.total;
    }

    return "Preço base: " + info.baseTotal;
  }

  function quadroPriceInfo(product) {
    var option = selectedDesignItems(product)[0] || null;
    var superStep = findStep(product, "super_details");
    var selectedSuperExample = superStep && Array.isArray(superStep.exampleImages) ? superStep.exampleImages.filter(function (item) {
      return item && item.value === state.selections.quadro_super_example;
    })[0] || null : null;
    var frameStep = findStep(product, "frame_size");
    var frameSize = String((option && option.frameSize) || state.selections.frame_size || (selectedSuperExample && selectedSuperExample.frameSize) || "");
    var frameOption = frameStep && Array.isArray(frameStep.items) ? frameStep.items.filter(function (item) {
      return item && item.value === frameSize;
    })[0] || null : null;
    var pricesByDesign = frameOption && frameOption.priceByDesignCents && typeof frameOption.priceByDesignCents === "object"
      ? frameOption.priceByDesignCents
      : {};
    var quantity = getPackQuantity(product) || (option ? 1 : 0);
    var fixedPriceCents = option ? Math.max(0, Number(option.priceCents) || 0) : 0;
    var baseCents = option && !option.quoteOnly ? (fixedPriceCents || Math.max(0, Number(pricesByDesign[option.value]) || 0)) : 0;
    var packagingCents = quadroPackagingExtraCents(product);
    var cents = option && !option.quoteOnly ? baseCents + packagingCents : 0;
    var priceText = option && option.quoteOnly ? String(option.note || "").trim() : "";

    return {
      size: product.defaultPriceKey || "Moldura personalizada",
      frameSize: frameSize,
      quantity: quantity,
      cents: cents,
      total: cents ? formatCents(cents) : priceText,
      baseCents: baseCents,
      baseTotal: baseCents ? formatCents(baseCents) : "",
      packagingCents: packagingCents,
      packagingTotal: packagingCents ? formatCents(packagingCents) : "",
      perPin: "",
      discount: 0,
      priceToConfirm: !!(option && option.quoteOnly),
      priceMinCents: option ? Math.max(0, Number(option.priceMinCents) || 0) : 0,
      priceMaxCents: option ? Math.max(0, Number(option.priceMaxCents) || 0) : 0
    };
  }

  function quadroChoiceNote(product, step, item) {
    var design = selectedDesignItems(product)[0] || null;
    var pricesByDesign;
    var cents;

    if (isQuadrosProduct(product) && step && step.id === "designs" && item && item.priceCents) {
      return formatCents(Math.max(0, Number(item.priceCents) || 0));
    }

    if (!isQuadrosProduct(product) || !step || step.id !== "frame_size" || !design) {
      return item && item.note ? String(item.note) : "";
    }

    pricesByDesign = item && item.priceByDesignCents && typeof item.priceByDesignCents === "object"
      ? item.priceByDesignCents
      : {};
    cents = Math.max(0, Number(pricesByDesign[design.value]) || 0);
    return cents ? formatCents(cents) : "";
  }

  function priceInfo(product) {
    if (isQuadrosProduct(product)) {
      return quadroPriceInfo(product);
    }

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
      { id: "shipping", label: "Envio CTT - até 2 Kg", text: "", feeCents: 540, priceText: "Valor mínimo:\n5,40 €" },
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
    { id: "novidades", title: "Novidades", labelPrefix: "" },
    { id: "porto-2026", title: "Cidade do Porto", labelPrefix: "Porto" },
    { id: "restelo", title: "Cidade de Lisboa e Restelo", labelPrefix: "Lisboa" },
    { id: "criancas", title: "Crianças", labelPrefix: "Criança" },
    { id: "felicidade-eterna", title: "Felicidade Eterna", labelPrefix: "Felicidade" }
  ];

  var IMANES_DEFAULT_SECTIONS = [
    { id: "novidades", title: "Novidades", labelPrefix: "" },
    { id: "verticais", title: "Ímanes Verticais", labelPrefix: "Vertical" },
    { id: "horizontais", title: "Ímanes Horizontais", labelPrefix: "Horizontal" }
  ];

  var INVISIBLE_GROUPS_2 = [
    { id: "grupo-1", title: "Grupo 1", labelPrefix: "" },
    { id: "grupo-2", title: "Grupo 2", labelPrefix: "" }
  ];

  var CADERNOS_DEFAULT_SECTIONS = [
    { id: "novidades", title: "Novidades", labelPrefix: "", visible: true },
    { id: "felicidade-eterna", title: "Felicidade Eterna", labelPrefix: "", visible: true }
  ];

  function getStepSectionConfig(product, step) {
    if (!product || !step || step.id !== "designs") {
      return null;
    }
    if (productFamily(product) === "crachas") {
      return { mode: "visible", defaults: CRACHAS_DEFAULT_SECTIONS };
    }
    if (productFamily(product) === "imanes") {
      return { mode: "visible", defaults: IMANES_DEFAULT_SECTIONS };
    }
    if (productFamily(product) === "cadernos" || productFamily(product) === "caderninhos") {
      return { mode: "mixed", defaults: CADERNOS_DEFAULT_SECTIONS };
    }
    if (product.slug === "lembrancas") {
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

  // PERSONALIZACAO_PROMO_V1: convite discreto ao flow de artwork proprio, no
  // topo do passo dos designs. Vive no bloco `customPromo` do passo `designs`
  // de cada produto: apagar o bloco tira o convite desse produto, e
  // `"customPromoEnabled": false` no content/order-products.json tira-o de
  // todos. Nao ha nada codificado por slug.
  function renderCustomPromo(product, step) {
    var promo = step && step.customPromo ? step.customPromo : null;

    if (!promo || promo.enabled === false || state.customPromoEnabled === false) {
      return "";
    }

    return [
      '<a class="custom-promo" href="' + escapeHtml(promo.href || "personalizacao.html") + '" data-track="true" data-track-action="custom_promo_click" data-track-id="' + escapeHtml((product && product.slug) || "") + '">',
      promo.image
        ? '<span class="custom-promo-media" style="background-image:url(&quot;' + escapeHtml(promo.image) + '&quot;)" aria-hidden="true"></span>'
        : '<span class="custom-promo-media is-icon" aria-hidden="true">' + ICON_UPLOAD + '</span>',
      '<span class="custom-promo-copy">',
      '<strong>' + escapeHtml(promo.title || "Queres um com uma imagem tua?") + '</strong>',
      promo.text ? '<span>' + escapeHtml(promo.text) + '</span>' : "",
      '</span>',
      '<span class="custom-promo-action">' + escapeHtml(promo.actionLabel || "Personalizar") + ' <b aria-hidden="true">→</b></span>',
      '</a>'
    ].join("");
  }

  function renderDesignActionControls(product, step) {
    var supported = supportsAssortedDesigns(product) && step && step.id === "designs" && step.selection === "multi";
    var items = step && Array.isArray(step.items) ? step.items : [];
    var selected = selectedValues(step || {});
    var allSelected = items.length > 0 && selected.length === items.length;
    var assorted = isAssortedSelected(product);
    var selectAllLabel = !assorted && allSelected ? "Limpar Seleção" : "Selecionar tudo";

    var uploadChoice = "";
    // PERSONALIZACAO_BUILDER_V1: os wizards do catalogo deixaram de aceitar
    // artwork proprio — quem traz o seu ficheiro vai por personalizacao.html.
    // O cartao so aparece a quem ainda declara customUploadOption no JSON do
    // passo, que hoje e apenas a capsula do Congresso 2026.
    var uploadOption = step && step.customUploadOption ? step.customUploadOption : null;

    if (uploadOption && isMainCatalogProduct(product) && step && step.id === "designs" && !state.admin) {
      uploadChoice = [
        '<button class="choice-card design-upload-choice' + (isCustomArtworkSelected(product) ? ' is-selected' : '') + '" type="button" data-custom-design-upload data-track="true" data-track-action="select_design_source" data-track-id="custom">',
        '<span class="design-upload-choice-icon" aria-hidden="true">' + ICON_UPLOAD + '</span>',
        '<span class="choice-copy">',
        '<strong>' + escapeHtml(uploadOption.title || "Carregar o meu design") + '</strong>',
        uploadOption.text ? '<span>' + escapeHtml(uploadOption.text) + '</span>' : '',
        '</span>',
        '</button>'
      ].join("");
    }

    if (!supported || state.admin) {
      return uploadChoice + renderCustomPromo(product, step);
    }

    return [
      uploadChoice,
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
      assorted ? '<p class="open-order-hint design-action-message" role="status">Podes passar para o próximo passo. Nota: se escolheres algum design, a opção "Sortido" vai ser automaticamente desmarcada.</p>' : "",
      renderCustomPromo(product, step)
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
      var noteText = quadroChoiceNote(product, step, item);
      var note = noteText ? '<span class="choice-note">' + escapeHtml(noteText) + '</span>' : "";

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

    if (config.mode === "mixed") {
      var mixedHtml = "";

      sections.forEach(function (section) {
        var bucket = grouped[section.id] || [];
        var defaultSection = (config.defaults || []).filter(function (entry) {
          return entry.id === section.id;
        })[0] || {};
        var isVisibleSection = defaultSection.visible !== false;
        var rowsHtml = bucket.map(function (entry) { return renderItemCard(entry.item); }).join("");

        if (bucket.length === 0 && !state.admin) {
          return;
        }

        if (isVisibleSection) {
          mixedHtml += [
            '<section class="design-grid-section' + (bucket.length === 0 ? ' is-empty' : '') + '" data-section-id="' + escapeHtml(section.id) + '">',
            '<h3 class="design-grid-section-title">' + escapeHtml(section.title) + '</h3>',
            bucket.length === 0 && state.admin ? '<p class="design-grid-section-empty">Sem itens atribuídos. Atribui um item a este separador para que apareça no site.</p>' : "",
            '<div class="design-grid">' + rowsHtml + '</div>',
            '</section>'
          ].join("");
          return;
        }

        if (state.admin) {
          mixedHtml += [
            '<div class="design-grid-section design-grid-section-invisible' + (bucket.length === 0 ? ' is-empty' : '') + '" data-section-id="' + escapeHtml(section.id) + '">',
            '<h3 class="design-grid-section-title is-admin-only">' + escapeHtml(section.title) + ' <span class="design-grid-section-hint">(grupo invisível no site público)</span></h3>',
            bucket.length === 0 ? '<p class="design-grid-section-empty">Sem itens neste grupo.</p>' : "",
            '<div class="design-grid">' + rowsHtml + '</div>',
            '</div>'
          ].join("");
        } else {
          mixedHtml += '<div class="design-grid">' + rowsHtml + '</div>';
        }
      });

      return renderDesignActionControls(product, step) + mixedHtml + (state.admin ? '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar opção</button>' : "");
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

  function safeSwatchColor(value) {
    var color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : "#d8d1c2";
  }

  function renderChoiceSwatch(item) {
    if (!item || !item.swatch) {
      return "";
    }

    return '<span class="choice-swatch" style="--choice-swatch:' + escapeHtml(safeSwatchColor(item.swatch)) + '" aria-hidden="true"></span>';
  }

  function paletteSelectionLimit(step) {
    var limit = Math.max(1, parseInt(step && step.colorCount, 10) || 3);
    var mappings = step && step.colorCountByField && typeof step.colorCountByField === "object"
      ? step.colorCountByField
      : {};

    Object.keys(mappings).some(function (fieldName) {
      var fieldMap = mappings[fieldName] || {};
      var selected = String(state.selections[fieldName] || "");
      var mapped = parseInt(fieldMap[selected], 10);

      if (mapped > 0) {
        limit = mapped;
        return true;
      }
      return false;
    });

    return limit;
  }

  function quadrosColorSelectionKeys(step) {
    var configured = step && step.selectionKeys && typeof step.selectionKeys === "object"
      ? step.selectionKeys
      : {};

    return {
      colors: String(configured.colors || "colors"),
      tones: String(configured.tones || "quadro_color_tones"),
      palette: String(configured.palette || "color_palette"),
      mia: String(configured.mia || "mia_choose_colors")
    };
  }

  function quadrosColorUiFor(step, limit) {
    var key = String(step && step.id || "colors");
    var count = Math.max(1, parseInt(limit, 10) || paletteSelectionLimit(step));
    var map = state.quadroColorUi && typeof state.quadroColorUi === "object"
      ? state.quadroColorUi
      : (state.quadroColorUi = {});
    var ui = map[key];

    if (!ui || typeof ui !== "object") {
      ui = {
        slots: [],
        activeSlot: 0,
        pinnedSlot: null,
        pinnedChangeCount: 0,
        hintSlot: null,
        toneEdit: null
      };
      map[key] = ui;
    }
    if (!Number.isInteger(ui.activeSlot) || ui.activeSlot < 0 || ui.activeSlot >= count) {
      ui.activeSlot = 0;
    }
    if (!Number.isInteger(ui.pinnedSlot) || ui.pinnedSlot < 0 || ui.pinnedSlot >= count) {
      ui.pinnedSlot = null;
    }
    if (!Number.isInteger(ui.hintSlot) || ui.hintSlot < 0 || ui.hintSlot >= count) {
      ui.hintSlot = null;
    }
    return ui;
  }

  function quadrosResetColorUi(step) {
    if (state.quadroColorUi && step && step.id) {
      delete state.quadroColorUi[String(step.id)];
    }
    state.paletteColorSlots = [];
    state.quadroActiveColorSlot = 0;
    state.quadroToneEdit = null;
  }

  function quadrosNextEmptySlot(slots, fromIndex) {
    var count = Array.isArray(slots) ? slots.length : 0;
    var offset;

    for (offset = 1; offset < count; offset += 1) {
      var index = (fromIndex + offset) % count;
      if (!slots[index]) {
        return index;
      }
    }
    return null;
  }

  function paletteColors(item, requestedLimit) {
    var colors = item && Array.isArray(item.palette) ? item.palette : [];
    var limit = Math.max(1, parseInt(requestedLimit, 10) || 3);
    return colors.slice(0, limit).map(safeSwatchColor);
  }

  // Descobre a que família pertence cada cor de uma combinação. Além do swatch
  // (o tom principal), procura também nos tons claro e escuro configurados —
  // sem isso, uma combinação que use um tom claro ficava por reconhecer e
  // desaparecia da lista.
  function paletteIndividualValues(step, item, requestedLimit) {
    var colors = paletteColors(item, requestedLimit);
    var individualColors = step && Array.isArray(step.individualColors) ? step.individualColors : [];
    var values = colors.map(function (color) {
      var match = individualColors.filter(function (candidate) {
        return candidate && safeSwatchColor(candidate.swatch).toLowerCase() === color.toLowerCase();
      })[0] || individualColors.filter(function (candidate) {
        return candidate && Array.isArray(candidate.colorStops) && candidate.colorStops.some(function (stop) {
          return validHex(stop) && String(stop).toLowerCase() === color.toLowerCase();
        });
      })[0];
      return match ? match.value : "";
    });

    return values.every(Boolean) ? values : [];
  }

  function currentPaletteColorSlots(step, requestedLimit) {
    var limit = Math.max(1, parseInt(requestedLimit, 10) || paletteSelectionLimit(step));
    var keys = quadrosColorSelectionKeys(step);
    var selected = Array.isArray(state.selections[keys.colors]) ? state.selections[keys.colors].slice(0, limit) : [];
    var ui = step && step.tonePicker === true ? quadrosColorUiFor(step, limit) : null;
    var previous = ui && Array.isArray(ui.slots)
      ? ui.slots.slice(0, limit)
      : (Array.isArray(state.paletteColorSlots) ? state.paletteColorSlots.slice(0, limit) : []);
    var slots = Array.from({ length: limit }, function () { return ""; });

    if (step && step.useConfiguredColors === true) {
      if (previous.filter(Boolean).join("|") === selected.filter(Boolean).join("|")) {
        slots = previous.concat(Array.from({ length: Math.max(0, limit - previous.length) }, function () { return ""; })).slice(0, limit);
      } else {
        selected.forEach(function (value, index) {
          if (index < limit) { slots[index] = value; }
        });
      }
      if (ui) { ui.slots = slots.slice(); }
      state.paletteColorSlots = slots.slice();
      return slots;
    }

    previous.forEach(function (value, index) {
      if (value && selected.indexOf(value) !== -1 && slots.indexOf(value) === -1) {
        slots[index] = value;
      }
    });

    selected.forEach(function (value) {
      var emptyIndex;
      if (!value || slots.indexOf(value) !== -1) {
        return;
      }
      emptyIndex = slots.indexOf("");
      if (emptyIndex !== -1) {
        slots[emptyIndex] = value;
      }
    });

    if (ui) { ui.slots = slots.slice(); }
    state.paletteColorSlots = slots.slice();
    return slots;
  }

  function renderPaletteAdminControls(step, item) {
    if (!state.admin) {
      return "";
    }

    return [
      '<div class="admin-card-tools palette-admin-tools">',
      '<label>Nome<input type="text" value="' + escapeHtml(item.title || "") + '" data-admin-edit="title" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>',
      paletteColors(item).map(function (color, index) {
        return '<label>Cor ' + (index + 1) + '<input type="color" value="' + escapeHtml(color) + '" data-admin-palette-color="' + index + '" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>';
      }).join(""),
      '<button type="button" data-admin-delete-item data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '">Remover combinação</button>',
      '</div>'
    ].join("");
  }

  // A água de cada quadrado é desenhada num <canvas> com física real (MiaWater,
  // mais abaixo). data-water-pour="1" faz o quadrado começar vazio e encher com
  // jorro + salpico; "0" já aparece cheio (só reage à inclinação); "drain"
  // aparece cheio e esvazia-se, para quando se retira a cor.
  function liquidCanvasMarkup(mode, duration) {
    return '<canvas class="pcs__canvas" data-water-pour="' + (mode === true ? "1" : (mode === "drain" ? "drain" : "0")) + '"'
      + (duration ? ' data-water-duration="' + duration + '"' : "")
      + '></canvas>';
  }

  // Ao desmarcar, o quadrado que reaparece por trás dos círculos ainda é o nó
  // do render anterior — traz o certo e a cor sólida do tom. Limpamo-lo já, ou
  // ele reaparecia marcado só para o re-render o desmarcar logo a seguir.
  function quadrosUnmarkFamilySquare(step, value) {
    var square = document.querySelector('[data-quadros-color-family="' + String(value).replace(/"/g, '\\"') + '"]');
    var checks = square ? square.querySelector(".quadros-checks") : null;
    var swatch = square ? square.querySelector("span") : null;
    var item = quadrosColorItem(step, value);

    if (!square) {
      return;
    }
    if (checks) {
      checks.parentNode.removeChild(checks);
    }
    square.classList.remove("is-toned");
    if (item && swatch) {
      swatch.style.setProperty("--individual-color", quadrosColorStops(item)[1]);
    }
  }

  // A água tem de começar a mexer no instante do clique, não no re-render que
  // só chega no fim da animação dos círculos. Por isso mexemos directamente no
  // quadrado da composição e deixamos a memória de preenchimento já actualizada,
  // para o re-render seguinte encontrar tudo no lugar e não reanimar nada.
  function quadrosPrimeSlotWater(step, index, color, duration) {
    var slot = document.querySelector('[data-quadros-color-slot="' + index + '"]');
    var fillKey = step.id + "-slots";
    var memory = paletteFillMemory[fillKey] || [];
    var canvas;

    memory[index] = color || "";
    paletteFillMemory[fillKey] = memory;
    if (!slot) {
      return;
    }
    canvas = slot.querySelector("canvas.pcs__canvas");
    if (canvas) {
      canvas.parentNode.removeChild(canvas);
    }
    if (color) {
      slot.classList.add("is-filled");
      slot.style.setProperty("--palette-preview-color", color);
      slot.insertAdjacentHTML("afterbegin", liquidCanvasMarkup(true, duration));
    } else {
      // A escoar: tira-se o "is-filled" para o fundo com o "?" ficar por baixo
      // da água, a ser revelado à medida que ela desce. A cor fica na variável,
      // que é de onde a canvas a lê.
      slot.classList.remove("is-filled");
      slot.insertAdjacentHTML("afterbegin", liquidCanvasMarkup("drain", duration));
    }
    miaWaterScan();
  }

  // Guarda as cores de cada slot do último render (por passo) para sabermos
  // qual slot foi mesmo escolhido agora — só esse faz a animação de encher.
  var paletteFillMemory = {};

  function hexRgb(value) {
    var hex = safeSwatchColor(value).slice(1);
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16)
    ];
  }

  function rgbHex(rgb) {
    return "#" + rgb.map(function (value) {
      return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
    }).join("");
  }

  function mixHex(value, target, amount) {
    var from = hexRgb(value);
    var to = hexRgb(target);
    var ratio = Math.max(0, Math.min(1, Number(amount) || 0));

    return rgbHex(from.map(function (channel, index) {
      return channel + (to[index] - channel) * ratio;
    }));
  }

  // --- Cor percetual (OKLab) -------------------------------------------------
  // Distâncias em RGB não têm nada a ver com o que o olho vê: um bege e um
  // verde-sálvia ficam "perto", dois azuis parecidos ficam "longe". O OKLab é
  // aproximadamente uniforme, por isso é nele que se comparam cores, se
  // escolhem os tons e se decide o que contrasta com o quê.

  function srgbToLinear(value) {
    var channel = Math.max(0, Math.min(1, value / 255));
    return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  }

  function linearToSrgb(value) {
    var channel = value <= 0.0031308
      ? value * 12.92
      : 1.055 * Math.pow(Math.max(0, value), 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(channel * 255)));
  }

  function rgbLab(rgb) {
    var r = srgbToLinear(rgb[0]);
    var g = srgbToLinear(rgb[1]);
    var b = srgbToLinear(rgb[2]);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  }

  function labRgb(lab) {
    var l = Math.pow(lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2], 3);
    var m = Math.pow(lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2], 3);
    var s = Math.pow(lab[0] - 0.0894841775 * lab[1] - 1.2914855480 * lab[2], 3);

    return [
      linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
    ];
  }

  function labChroma(lab) {
    return Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);
  }

  function labDistance(a, b) {
    var dl = a[0] - b[0];
    var da = a[1] - b[1];
    var db = a[2] - b[2];
    return Math.sqrt(dl * dl + da * da + db * db);
  }

  // Para decidir a que família uma cor pertence, a luminosidade quase não
  // conta: cada família tem um tom claro, um principal e um escuro, por isso o
  // claro/escuro resolve-se logo a seguir. Sem este desconto, um bege claro da
  // fotografia agarra-se ao verde-sálvia (que é claro) em vez do castanho
  // (que é a cor certa, e tem um tom claro à espera).
  function labFamilyDistance(a, b) {
    var dl = (a[0] - b[0]) * 0.35;
    var da = a[1] - b[1];
    var db = a[2] - b[2];
    return Math.sqrt(dl * dl + da * da + db * db);
  }

  function quadrosTonePalette(value) {
    var base = safeSwatchColor(value);
    return [
      mixHex(base, "#ffffff", 0.54),
      base,
      mixHex(base, "#241b10", 0.34)
    ];
  }

  function quadrosColorStops(item) {
    var base = safeSwatchColor(item && item.swatch);
    var configured = item && Array.isArray(item.colorStops)
      ? item.colorStops.slice(0, 3).map(function (color) {
        return validHex(color) ? String(color).toLowerCase() : "";
      })
      : [];

    if (configured.length === 3 && configured.every(Boolean)) {
      return configured;
    }

    return quadrosTonePalette(base);
  }

  function quadrosColorItem(step, value) {
    return (step && Array.isArray(step.individualColors) ? step.individualColors : []).filter(function (item) {
      return item && item.value === value;
    })[0] || null;
  }

  function quadrosColorModeInfo(step) {
    var hasPhoto = orderUploadItems("quadro_uploads").length > 0;
    var canUsePhoto = state.selections.designs === "Foto e Frase"
      && hasPhoto
      && !state.selections.photo_help;
    delete state.selections.quadro_color_mode;
    return { mode: canUsePhoto ? "photo" : "manual", canUsePhoto: canUsePhoto };
  }

  function quadrosToneSelections(step, limit) {
    var keys = quadrosColorSelectionKeys(step);
    var saved = Array.isArray(state.selections[keys.tones])
      ? state.selections[keys.tones].slice(0, limit)
      : [];
    var tones = Array.from({ length: limit }, function (_, index) {
      var tone = Number(saved[index]);
      return tone >= 0 && tone <= 2 ? tone : 1;
    });

    state.selections[keys.tones] = tones;
    return tones;
  }

  function quadrosToneLabel(tone) {
    return tone === 0 ? "claro" : (tone === 2 ? "escuro" : "principal");
  }

  // O quadrado que a próxima cor escolhida vai preencher. Há sempre um activo.
  function quadrosActiveColorSlot(step, limit) {
    var ui = quadrosColorUiFor(step, limit);
    var slot = Number(ui.activeSlot);
    if (!Number.isInteger(slot) || slot < 0 || slot >= limit) {
      slot = 0;
    }
    ui.activeSlot = slot;
    state.quadroActiveColorSlot = slot;
    return slot;
  }

  function quadrosPalettePreviewColors(step, limit) {
    var slots = currentPaletteColorSlots(step, limit);
    var tones = quadrosToneSelections(step, limit);

    return slots.map(function (value, index) {
      var item = quadrosColorItem(step, value);
      return item ? quadrosColorStops(item)[tones[index]] : "";
    }).slice(0, limit);
  }

  // Lugar de cada tom no triângulo: claro em cima, principal em baixo à
  // esquerda, escuro em baixo à direita.
  var QUADROS_TONE_SPOTS = ["top", "left", "right"];
  // Elemento a sério (e não ::after) para poder ser animado a entrar e a sair.
  var QUADROS_CHECK_MARKUP = '<i class="quadros-check" aria-hidden="true">✓</i>';

  function quadrosChecksMarkup(count) {
    if (count < 1) {
      return "";
    }
    return '<b class="quadros-checks" aria-hidden="true">'
      + Array.from({ length: count }, function () { return QUADROS_CHECK_MARKUP; }).join("")
      + '</b>';
  }

  function renderQuadrosToneSwatch(item, color, toneIndex, slot, selected) {
    var title = item.title || item.value;

    return '<button type="button" class="individual-color-choice quadros-tone-swatch quadros-tone-swatch--' + QUADROS_TONE_SPOTS[toneIndex] + (selected ? ' is-selected' : '') + '" data-quadros-tone="' + toneIndex + '" data-quadros-tone-value="' + escapeHtml(item.value) + '" data-quadros-tone-slot="' + slot + '" data-flip-key="tone:' + escapeHtml(item.value) + ':' + toneIndex + '" aria-pressed="' + (selected ? 'true' : 'false') + '" aria-label="Tom ' + quadrosToneLabel(toneIndex) + ' de ' + escapeHtml(title) + '"><span style="--individual-color:' + escapeHtml(color) + '" aria-hidden="true"></span></button>';
  }

  // Os 3 tons nascem do próprio quadrado clicado, que desaparece: ficam em
  // triângulo sobre a célula que vagou (claro em cima, principal em baixo à
  // esquerda, escuro em baixo à direita). Ver quadrosPlaceToneStrip.
  // "chosenTones" contém todos os tons desta família que já estão nos
  // quadrados. A mesma família pode repetir-se; o tom exacto é que é único.
  function renderQuadrosToneStrip(item, chosenTones, slot) {
    var stops = quadrosColorStops(item);
    var selected = Array.isArray(chosenTones) ? chosenTones : [];

    return [
      '<div class="quadros-tone-strip" data-quadros-tone-strip role="group" aria-label="Tom de ' + escapeHtml(item.title || item.value) + '">',
      renderQuadrosToneSwatch(item, stops[0], 0, slot, selected.indexOf(0) !== -1),
      renderQuadrosToneSwatch(item, stops[1], 1, slot, selected.indexOf(1) !== -1),
      renderQuadrosToneSwatch(item, stops[2], 2, slot, selected.indexOf(2) !== -1),
      '</div>'
    ].join("");
  }

  function renderQuadrosColorFamilies(step, slots, tones, activeSlot, toneEdit) {
    var editValue = toneEdit ? toneEdit.value : "";

    return (step.individualColors || []).map(function (item) {
      var expanded = item.value === editValue;
      var chosenHere = item.value === (slots[activeSlot] || "");
      var unavailable = item.availability === "unavailable";
      var stops = quadrosColorStops(item);
      var showName = step.showColorNames === true;
      var title = item.title || item.value;
      var selectedTones = slots.reduce(function (selected, value, index) {
        if (value === item.value && selected.indexOf(tones[index]) === -1) {
          selected.push(tones[index]);
        }
        return selected;
      }, []);
      // Escolhida: o quadrado passa a mostrar o tom exacto que ficou no
      // quadrado da composição, em vez do degradê dos três tons.
      var usedIndex = chosenHere ? activeSlot : slots.indexOf(item.value);
      var tone = usedIndex !== -1 ? tones[usedIndex] : -1;
      var label = title
        + (selectedTones.length ? ", escolhida, " + (selectedTones.length === 1 ? "tom " : "tons ")
          + selectedTones.map(quadrosToneLabel).join(", ") : "")
        + (unavailable ? " — indisponível no momento" : "");

      // Expandida, some: a célula fica livre para os 3 círculos. Continua no
      // DOM (invisível) para a grelha não refluir e para o FLIP saber de onde
      // os círculos devem nascer.
      return [
        '<button type="button" class="individual-color-choice quadros-color-family' + (showName ? ' has-color-name' : '') + (expanded ? ' is-expanded' : '') + (tone !== -1 ? ' is-toned' : '') + (unavailable ? ' is-disabled is-unavailable' : '') + '" data-quadros-color-family="' + escapeHtml(item.value) + '" data-color-id="' + escapeHtml(item.id || "") + '" data-flip-key="fam:' + escapeHtml(item.value) + '"' + (unavailable ? ' disabled' : '') + (expanded ? ' tabindex="-1" aria-hidden="true"' : '') + ' aria-pressed="' + (chosenHere ? 'true' : 'false') + '" aria-expanded="' + (expanded ? 'true' : 'false') + '" title="' + escapeHtml(label) + '" aria-label="' + escapeHtml(label) + '">',
        '<span style="--individual-color-light:' + escapeHtml(stops[0]) + ';--individual-color:' + escapeHtml(tone !== -1 ? stops[tone] : stops[1]) + ';--individual-color-dark:' + escapeHtml(stops[2]) + '" aria-hidden="true"></span>',
        showName ? '<strong>' + escapeHtml(title) + '</strong>' : "",
        quadrosChecksMarkup(selectedTones.length),
        '</button>'
      ].join("");
    }).join("");
  }

  // Fonte única das combinações mostradas: o render e o clique têm de ver a
  // mesma lista pela mesma ordem, senão o índice do botão aponta para outra.
  function quadrosSuggestedPaletteRecords(step, limit, mode) {
    var analysis = state.quadroPhotoColorAnalysis || {};

    var photo = mode === "photo" && analysis.status === "ready" && Array.isArray(analysis.palettes)
      ? analysis.palettes.filter(function (record) {
        return record && Array.isArray(record.values) && record.values.length === limit;
      })
      : [];

    return photo.length ? photo : quadrosDefaultPaletteRecords(step, limit);
  }

  function renderQuadrosSuggestedPalettes(step, limit, mode) {
    var keys = quadrosColorSelectionKeys(step);
    var tones = quadrosToneSelections(step, limit);
    var source = quadrosSuggestedPaletteRecords(step, limit, mode);

    return source.map(function (item, index) {
      // Mostra o tom exacto que vai ficar em cada quadrado. Antes mostrava o
      // degradê dos três tons da família, o que não dizia nada sobre o
      // resultado — e agora as sugestões já não são todas no tom principal.
      var colors = item.values.map(function (value, position) {
        var color = quadrosColorItem(step, value);
        return color
          ? quadrosColorStops(color)[item.tones ? item.tones[position] : 1]
          : "#d8d1c2";
      }).slice(0, limit);
      var selected = Array.isArray(state.selections[keys.colors])
        && item.values.join("|") === state.selections[keys.colors].slice(0, limit).join("|")
        && (item.tones || []).join("|") === tones.join("|");

      return [
        '<button class="palette-choice quadros-suggested-palette' + (selected ? ' is-selected' : '') + '" type="button" data-quadros-palette-index="' + index + '">',
        '<span class="palette-swatches" style="--palette-swatch-count:' + colors.length + '" aria-hidden="true">',
        colors.map(function (color) { return '<span style="--palette-color:' + escapeHtml(color) + '"></span>'; }).join(""),
        '</span>',
        '<strong>' + escapeHtml(item.title || "Combinação sugerida") + '</strong>',
        item.note ? '<small>' + escapeHtml(item.note) + '</small>' : "",
        '</button>'
      ].join("");
    }).join("");
  }

  function renderQuadrosPhotoColorPanel(step) {
    var upload = orderUploadItems("quadro_uploads")[0] || null;
    var analysis = state.quadroPhotoColorAnalysis || {};
    var showAnalysis = step && step.showPhotoColorAnalysis === true;
    var detected = Array.isArray(analysis.detected) && analysis.detected.length
      ? analysis.detected
      : ["#eee3cf", "#d8bf94", "#ad7c58", "#7a5144", "#45342d"];
    var status = analysis.status === "ready"
      ? "Sugestões prontas"
      : analysis.status === "error"
        ? (analysis.error || "Não foi possível analisar a fotografia.")
        : "A analisar a fotografia…";

    return [
      '<div class="quadros-photo-color-panel' + (showAnalysis ? '' : ' is-preview-only') + '">',
      '<div class="quadros-photo-color-preview">',
      upload ? '<img src="' + escapeHtml(orderUploadPreviewUrl(upload)) + '" alt="Fotografia enviada no passo anterior">' : "",
      '</div>',
      showAnalysis ? '<aside class="quadros-photo-color-analysis">' : "",
      showAnalysis ? [
      '<h3>Cores encontradas</h3>',
      '<p>' + (analysis.status === "ready"
        ? "Adaptámos as cores principais às opções disponíveis para as flores."
        : "Estamos a procurar as cores principais da fotografia.") + '</p>',
      '<div class="quadros-detected-colors" aria-label="Cores detectadas">',
      detected.slice(0, 5).map(function (color) {
        return '<span style="--detected-color:' + escapeHtml(safeSwatchColor(color)) + '"></span>';
      }).join(""),
      '</div>',
      '<p class="quadros-analysis-status" role="status">' + escapeHtml(status) + '</p>',
      '</aside>'
      ].join("") : "",
      '</div>'
    ].join("");
  }

  function renderQuadrosColorPicker(product, step) {
    var limit = paletteSelectionLimit(step);
    var keys = quadrosColorSelectionKeys(step);
    var ui = quadrosColorUiFor(step, limit);
    var suggestionsLabel = limit === 1 ? "Cores sugeridas" : "Combinações sugeridas";
    var miaChoiceLabel = limit === 1
      ? "Quero que a Mia escolha a cor por mim"
      : "Quero que a Mia escolha as cores por mim";
    var allowMiaChoice = step.allowMiaChoice !== false;
    var modeInfo = quadrosColorModeInfo(step);
    var mode = modeInfo.mode;
    var miaChooses = !!state.selections[keys.mia];
    var slots = miaChooses ? [] : currentPaletteColorSlots(step, limit);
    var tones = quadrosToneSelections(step, limit);
    var activeSlot = quadrosActiveColorSlot(step, limit);
    var previewColors = miaChooses ? [] : quadrosPalettePreviewColors(step, limit);
    var previewCount = previewColors.filter(Boolean).length;
    var fillKey = step.id + "-slots";
    var previous = paletteFillMemory[fillKey] || [];
    var suggestionsOpen = state.quadroColorSuggestionsOpen !== false;
    var suggested = renderQuadrosSuggestedPalettes(step, limit, mode);
    var toneItem;
    var isGradient = step.compositionStyle === "gradient" || (step.compositionStyleByField && Object.keys(step.compositionStyleByField).some(function (fieldName) {
      var mapping = step.compositionStyleByField[fieldName] || {};
      return mapping[String(state.selections[fieldName] || "")] === "gradient";
    }));
    var isGlitter = step.colorEffect === "glitter" || (step.colorEffectByField && Object.keys(step.colorEffectByField).some(function (fieldName) {
      var mapping = step.colorEffectByField[fieldName] || {};
      return mapping[String(state.selections[fieldName] || "")] === "glitter";
    }));

    state.paletteColorSlots = ui.slots.slice();
    state.quadroActiveColorSlot = ui.activeSlot;
    state.quadroToneEdit = ui.toneEdit;
    toneItem = ui.toneEdit && !miaChooses
      ? quadrosColorItem(step, ui.toneEdit.value)
      : null;

    paletteFillMemory[fillKey] = previewColors.slice();

    return [
      '<section class="palette-picker quadros-color-picker' + (isGradient ? ' is-gradient' : '') + (isGlitter ? ' is-glitter' : '') + '" data-quadros-color-mode-current="' + escapeHtml(mode) + '">',
      mode === "photo" ? renderQuadrosPhotoColorPanel(step) : "",
      '<div class="quadros-color-composition' + (ui.hintSlot !== null ? ' has-next-hint' : '') + '">',
      '<div class="palette-composition' + (isGradient ? ' is-gradient' : '') + '" style="--palette-slot-count:' + limit + '" aria-live="polite" aria-label="' + previewCount + ' de ' + limit + (limit === 1 ? ' cor escolhida' : ' cores escolhidas') + '">',
      Array.from({ length: limit }, function (_, index) {
        var color = previewColors[index] || "";
        var item = slots[index] ? quadrosColorItem(step, slots[index]) : null;
        var active = index === activeSlot;
        var label = (item
          ? (item.title || item.value) + ', tom ' + quadrosToneLabel(tones[index])
          : 'Quadrado por preencher')
          + (active ? '. Selecionado para alteração' : '. Clica para alterar esta cor');
        var hint = ui.hintSlot === index
          ? '<span class="quadros-next-color-hint" role="status">Toca aqui para escolheres a próxima cor</span>'
          : '';
        if (!color) {
          return '<button type="button" class="palette-composition__slot quadros-color-slot' + (active ? ' is-active' : '') + (hint ? ' has-next-hint' : '') + '" data-quadros-color-slot="' + index + '" aria-pressed="' + (active ? 'true' : 'false') + '" aria-label="' + escapeHtml(label) + '">' + hint + '</button>' + (isGradient && index === 0 ? '<span class="quadros-gradient-arrow" aria-hidden="true">→</span>' : '');
        }
        return '<button type="button" class="palette-composition__slot quadros-color-slot is-filled' + (active ? ' is-active' : '') + (hint ? ' has-next-hint' : '') + '" data-quadros-color-slot="' + index + '" aria-pressed="' + (active ? 'true' : 'false') + '" style="--palette-preview-color:' + escapeHtml(color) + '" aria-label="' + escapeHtml(label) + '">' + liquidCanvasMarkup(previous[index] !== color) + hint + '</button>' + (isGradient && index === 0 ? '<span class="quadros-gradient-arrow" aria-hidden="true">→</span>' : '');
      }).join(""),
      '</div>',
      // Setinha por baixo do quadrado activo, em vez de o cercar.
      '<span class="quadros-active-marker" style="--marker-shift:' + (activeSlot - (limit - 1) / 2) + '" aria-hidden="true"></span>',
      '</div>',
      '<div class="individual-color-grid quadros-color-family-grid" data-quadros-color-grid>'
        + renderQuadrosColorFamilies(step, slots, tones, activeSlot, ui.toneEdit)
        + (toneItem ? renderQuadrosToneStrip(
          toneItem,
          slots.reduce(function (selectedTones, value, index) {
            if (value === ui.toneEdit.value && selectedTones.indexOf(tones[index]) === -1) {
              selectedTones.push(tones[index]);
            }
            return selectedTones;
          }, []),
          ui.toneEdit.slot
        ) : "")
        + '</div>',
      '<button class="palette-suggestions-toggle" type="button" data-quadros-suggestions-toggle aria-expanded="' + (suggestionsOpen ? "true" : "false") + '"><span>' + suggestionsLabel + '</span><b aria-hidden="true">⌄</b></button>',
      '<div class="palette-suggestions' + (suggestionsOpen ? ' is-open' : '') + '"' + (suggestionsOpen ? "" : " hidden") + '>',
      '<div class="palette-grid">' + (suggested || '<p class="quadros-palette-empty">Ainda estamos a preparar as sugestões. Podes escolher as cores manualmente.</p>') + '</div>',
      '</div>',
      allowMiaChoice ? [
        '<label class="palette-mia-choice' + (miaChooses ? ' is-selected' : '') + '">',
        '<input type="checkbox" data-mia-color-choice' + (miaChooses ? ' checked' : '') + '>',
        '<span>' + miaChoiceLabel + '</span>',
        '</label>'
      ].join("") : "",
      '</section>'
    ].join("");
  }

  function renderPaletteGrid(product, step) {
    if (!state.admin && isQuadrosProduct(product) && step && step.tonePicker === true) {
      return renderQuadrosColorPicker(product, step);
    }

    var selectionLimit = paletteSelectionLimit(step);
    var miaChooses = !!state.selections.mia_choose_colors;
    var selectedPalette = miaChooses ? "" : String(state.selections.color_palette || "");
    var colorSlots = miaChooses
      ? Array.from({ length: selectionLimit }, function () { return ""; })
      : currentPaletteColorSlots(step, selectionLimit);
    var selectedColors = colorSlots.filter(Boolean);
    var limitReached = selectedColors.length >= selectionLimit;
    var individualColors = step.individualColors || [];
    var selectedPaletteItem = (step.items || []).filter(function (item) {
      return item && item.value === selectedPalette;
    })[0] || null;
    var previewColors = selectedColors.length
      ? colorSlots.map(function (value) {
        var item = individualColors.filter(function (candidate) {
          return candidate && candidate.value === value;
        })[0];
        return item ? safeSwatchColor(item.swatch) : "";
      }).slice(0, selectionLimit)
      : paletteColors(selectedPaletteItem, selectionLimit);
    var previewColorCount = previewColors.filter(Boolean).length;
    var colorChoiceText = selectionLimit === 1 ? "uma cor" : (selectionLimit === 2 ? "duas cores" : selectionLimit === 3 ? "três cores" : selectionLimit + " cores");
    var miaChoiceLabel = selectionLimit === 1 ? "Quero que a Mia escolha a cor" : "Quero que a Mia escolha as cores";
    var fillKey = step.id || "palette";
    var prevFill = paletteFillMemory[fillKey] || [];
    var previewSlots = Array.from({ length: selectionLimit }, function (_, index) {
      var color = previewColors[index] || "";
      if (!color) {
        return '<span class="palette-composition__slot" aria-label="Cor ' + (index + 1) + ' por escolher"></span>';
      }
      // Só anima o encher se este slot mudou desde o último render (cor nova
      // ou trocada); os que já estavam com a mesma cor ficam cheios e quietos.
      var animate = prevFill[index] !== color;
      return '<span class="palette-composition__slot is-filled" style="--palette-preview-color:' + escapeHtml(color) + '" aria-label="Cor ' + (index + 1) + ' escolhida">' + liquidCanvasMarkup(animate) + '</span>';
    }).join("");
    paletteFillMemory[fillKey] = Array.from({ length: selectionLimit }, function (_, index) {
      return previewColors[index] || "";
    });
    var palettes = (step.items || []).map(function (item) {
      var checked = selectedPalette === item.value;
      var suggestedColors = paletteColors(item, selectionLimit);
      var swatches = suggestedColors.map(function (color) {
        return '<span style="--palette-color:' + escapeHtml(color) + '"></span>';
      }).join("");

      return [
        '<div class="palette-choice-wrap">',
        '<label class="palette-choice' + (checked ? ' is-selected' : '') + '">',
        '<input type="radio" name="color_palette" value="' + escapeHtml(item.value) + '" data-palette-choice' + (checked ? ' checked' : '') + '>',
        '<span class="palette-swatches" style="--palette-swatch-count:' + suggestedColors.length + '" aria-hidden="true">' + swatches + '</span>',
        '<strong>' + escapeHtml(item.title || item.value) + '</strong>',
        '</label>',
        renderPaletteAdminControls(step, item),
        '</div>'
      ].join("");
    }).join("");
    var individual = individualColors.map(function (item, index) {
      var checked = selectedColors.indexOf(item.value) !== -1;
      var unavailable = item.availability === "unavailable";
      // Cheio já não bloqueia: clicar numa cor nova substitui o último quadrado
      // mexido (ver handler [data-individual-color]). Só as indisponíveis bloqueiam.
      var disabled = unavailable;

      return [
        '<div class="individual-color-wrap">',
        '<label class="individual-color-choice' + (checked ? ' is-selected' : '') + (disabled ? ' is-disabled' : '') + (unavailable ? ' is-unavailable' : '') + '" title="' + escapeHtml((item.title || item.value) + (unavailable ? ' — indisponível no momento' : '')) + '">',
        '<input type="checkbox" value="' + escapeHtml(item.value) + '" data-individual-color="' + index + '"' + (checked ? ' checked' : '') + (disabled ? ' disabled' : '') + ' aria-label="' + escapeHtml((item.title || item.value) + (unavailable ? ' — indisponível no momento' : '')) + '">',
        '<span style="--individual-color:' + escapeHtml(safeSwatchColor(item.swatch)) + '" aria-hidden="true"></span>',
        '</label>',
        '</div>'
      ].join("");
    }).join("");

    return [
      '<section class="palette-picker">',
      '<div class="palette-composition" style="--palette-slot-count:' + selectionLimit + '" aria-live="polite" aria-label="' + previewColorCount + ' de ' + selectionLimit + (selectionLimit === 1 ? ' cor escolhida' : ' cores escolhidas') + '">' + previewSlots + '</div>',
      '<div class="individual-color-heading"><h3>Escolhe ' + colorChoiceText + '</h3><span>' + previewColorCount + '/' + selectionLimit + '</span></div>',
      '<div class="individual-color-grid">' + individual + '</div>',
      state.admin ? '<a class="admin-add admin-colors-link" href="admin-colors.html" target="_blank" rel="noopener">Gerir cores e disponibilidade</a>' : '',
      '<button class="palette-suggestions-toggle" type="button" data-palette-suggestions-toggle aria-expanded="' + (state.colorSuggestionsOpen ? 'true' : 'false') + '"><span>' + (selectionLimit === 1 ? 'Cores sugeridas' : 'Combinações sugeridas') + '</span><b aria-hidden="true">⌄</b></button>',
      '<div class="palette-suggestions' + (state.colorSuggestionsOpen ? ' is-open' : '') + '"' + (state.colorSuggestionsOpen ? '' : ' hidden') + '>',
      '<div class="palette-grid">' + palettes + '</div>',
      state.admin ? '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar combinação</button>' : '',
      '</div>',
      '<label class="palette-mia-choice' + (miaChooses ? ' is-selected' : '') + '">',
      '<input type="checkbox" data-mia-color-choice' + (miaChooses ? ' checked' : '') + '>',
      '<span>' + miaChoiceLabel + '</span>',
      '</label>',
      '</section>'
    ].join("");
  }

  function orderUploadItems(key) {
    var items = state.selections[key];
    return Array.isArray(items) ? items.filter(function (item) {
      return item && item.token;
    }) : [];
  }

  function formatUploadSize(bytes) {
    var size = Math.max(0, Number(bytes) || 0);
    return size >= 1048576
      ? (size / 1048576).toFixed(size >= 10485760 ? 0 : 1).replace('.', ',') + ' MB'
      : Math.max(1, Math.round(size / 1024)) + ' KB';
  }

  function formatUploadSpeed(bytesPerSecond) {
    var speed = Math.max(0, Number(bytesPerSecond) || 0);
    if (!speed) {
      return "a calcular";
    }
    return formatUploadSize(speed) + "/s";
  }

  function formatUploadEta(seconds) {
    var remaining = Math.max(0, Math.ceil(Number(seconds) || 0));
    if (!remaining) {
      return "quase pronto";
    }
    if (remaining < 60) {
      return "cerca de " + remaining + " s";
    }
    return "cerca de " + Math.ceil(remaining / 60) + " min";
  }

  function renderOrderUploadProgress() {
    var progress = state.orderUploadProgress;
    var percent;
    var width;
    var detail;
    var fileText;

    if (!progress) {
      return "";
    }

    percent = Math.max(0, Math.min(100, Math.round(Number(progress.percent) || 0)));
    width = progress.phase === "upload" ? percent + "%" : "36%";
    fileText = progress.fileCount > 1
      ? "Ficheiro " + progress.fileIndex + " de " + progress.fileCount
      : "A enviar";
    detail = progress.phase === "upload"
      ? percent + "% · " + formatUploadSpeed(progress.speed) + " · " + formatUploadEta(progress.eta)
      : "A preparar o ficheiro…";

    return [
      '<div class="order-upload-progress' + (progress.phase === "upload" ? "" : " is-preparing") + '" data-order-upload-progress role="status" aria-live="polite">',
      '<div class="order-upload-progress__heading"><span data-order-upload-progress-label>' + escapeHtml(fileText) + '</span><strong data-order-upload-progress-detail>' + escapeHtml(detail) + '</strong></div>',
      '<div class="order-upload-progress__track" role="progressbar" aria-label="Progresso do envio" aria-valuemin="0" aria-valuemax="100"' + (progress.phase === "upload" ? ' aria-valuenow="' + percent + '"' : "") + '>',
      '<span data-order-upload-progress-fill style="width:' + width + '"></span>',
      '</div>',
      '</div>'
    ].join("");
  }

  function updateOrderUploadProgressDom() {
    var progress = state.orderUploadProgress;
    if (!progress) {
      return;
    }
    document.querySelectorAll("[data-order-upload-progress]").forEach(function (box) {
      var percent = Math.max(0, Math.min(100, Math.round(Number(progress.percent) || 0)));
      var label = box.querySelector("[data-order-upload-progress-label]");
      var detail = box.querySelector("[data-order-upload-progress-detail]");
      var track = box.querySelector('[role="progressbar"]');
      var fill = box.querySelector("[data-order-upload-progress-fill]");

      box.classList.toggle("is-preparing", progress.phase !== "upload");
      if (label) {
        label.textContent = progress.fileCount > 1
          ? "Ficheiro " + progress.fileIndex + " de " + progress.fileCount
          : "A enviar";
      }
      if (detail) {
        detail.textContent = progress.phase === "upload"
          ? percent + "% · " + formatUploadSpeed(progress.speed) + " · " + formatUploadEta(progress.eta)
          : "A preparar o ficheiro…";
      }
      if (track) {
        if (progress.phase === "upload") {
          track.setAttribute("aria-valuenow", String(percent));
        } else {
          track.removeAttribute("aria-valuenow");
        }
      }
      if (fill) {
        fill.style.width = progress.phase === "upload" ? percent + "%" : "36%";
      }
    });
  }

  function orderUploadPreviewUrl(item) {
    if (!item || !item.token) {
      return "";
    }
    return orderUploadPreviews[item.token] || ORDER_MEDIA_PREVIEW_API + "?token=" + encodeURIComponent(item.token);
  }

  function resetQuadrosPhotoColorAnalysis() {
    state.quadroPhotoColorAnalysis = {
      token: "",
      status: "idle",
      detected: [],
      palettes: [],
      error: ""
    };
  }

  // Lado maior a que a fotografia é reduzida antes de se contarem as cores.
  var QUADROS_PHOTO_SAMPLE_SIZE = 132;
  // Quantos grupos de cor se procuram na fotografia (usam-se os melhores).
  var QUADROS_PHOTO_CLUSTERS = 6;
  // A mesma família pode entrar duas vezes com tons diferentes: castanho claro
  // + castanho escuro fica melhor do que forçar uma terceira família que já não
  // tem nada a ver com a fotografia. Repetir custa, mas não é proibido.
  var QUADROS_FAMILY_REUSE_LIMIT = 2;
  var QUADROS_FAMILY_REUSE_COST = 0.045;
  // Distância mínima entre as cores de uma combinação, para os três quadrados
  // não ficarem praticamente iguais. Baixo de propósito: separar demais afasta
  // a combinação da fotografia sem que ninguém veja diferença nas flores.
  var QUADROS_MIN_SEPARATION = 0.055;
  // Abaixo deste croma no tom principal, a família conta como neutra
  // (branco/creme, cinzento). É a família que é neutra, não o tom: o claro do
  // verde-sálvia é pálido, mas continua a ser verde.
  var QUADROS_NEUTRAL_CHROMA = 0.035;

  // Todos os tons escolhíveis: três por família disponível. O algoritmo antigo
  // só olhava para o swatch (o tom principal) e por isso nunca sugeria um claro
  // ou um escuro, mesmo quando era esse o tom que a fotografia pedia.
  function quadrosToneTargets(step) {
    var targets = [];

    (step && Array.isArray(step.individualColors) ? step.individualColors : []).forEach(function (item) {
      if (!item || item.availability === "unavailable") {
        return;
      }
      var neutral = labChroma(rgbLab(hexRgb(item.swatch))) < QUADROS_NEUTRAL_CHROMA;

      quadrosColorStops(item).forEach(function (color, tone) {
        var hex = safeSwatchColor(color);

        targets.push({
          value: item.value,
          id: item.id || "",
          tone: tone,
          hex: hex,
          neutral: neutral,
          lab: rgbLab(hexRgb(hex))
        });
      });
    });
    return targets;
  }

  function quadrosPickIsUsed(chosen, target) {
    return chosen.some(function (pick) {
      return pick.value === target.value && pick.tone === target.tone;
    });
  }

  // Escolhe o tom (família + claro/principal/escuro) que melhor representa uma
  // cor, respeitando o que já foi escolhido. São duas decisões diferentes e é
  // por isso que são feitas em separado: primeiro qual é a cor (a família, pelo
  // matiz), só depois quão clara ela é (o tom, pela luminosidade). Juntar as
  // duas numa só distância era o que fazia sair verde onde devia sair castanho.
  // As restrições relaxam por camadas: mais vale repetir uma família do que
  // devolver nada.
  function quadrosPickTone(targets, lab, chosen, options) {
    var settings = options || {};
    var toneBias = settings.toneBias || [0, 0, 0];
    // A fase do tom pode mirar noutra cor que não a da família — é assim que a
    // combinação suave clareia sem trocar de família pelo caminho.
    var toneLab = settings.toneLab || lab;
    var relaxations = [
      { separation: settings.separation === undefined ? QUADROS_MIN_SEPARATION : settings.separation,
        lightGap: settings.lightGap || 0,
        reuseLimit: settings.reuseLimit === undefined ? QUADROS_FAMILY_REUSE_LIMIT : settings.reuseLimit },
      { separation: 0.05, lightGap: 0, reuseLimit: QUADROS_FAMILY_REUSE_LIMIT },
      { separation: 0, lightGap: 0, reuseLimit: 3 }
    ];
    var best = null;

    relaxations.some(function (rules) {
      var allowed = targets.filter(function (target) {
        var used = chosen.filter(function (pick) { return pick.value === target.value; }).length;

        if (used >= rules.reuseLimit || quadrosPickIsUsed(chosen, target)) {
          return false;
        }
        return !chosen.some(function (pick) {
          return labDistance(pick.lab, target.lab) < rules.separation
            || Math.abs(pick.lab[0] - target.lab[0]) < rules.lightGap;
        });
      });
      var family = "";
      var familyCost = Infinity;

      allowed.forEach(function (target) {
        var used = chosen.filter(function (pick) { return pick.value === target.value; }).length;
        var cost = labFamilyDistance(lab, target.lab) + used * QUADROS_FAMILY_REUSE_COST;

        if (cost < familyCost) {
          familyCost = cost;
          family = target.value;
        }
      });
      if (!family) {
        return false;
      }

      var toneCost = Infinity;
      allowed.forEach(function (target) {
        var cost = labDistance(toneLab, target.lab) + (toneBias[target.tone] || 0);

        if (target.value === family && cost < toneCost) {
          toneCost = cost;
          best = target;
        }
      });
      return !!best;
    });

    return best;
  }

  // Completa uma combinação a que faltam quadrados: entra a família ainda não
  // usada que mais se afasta das já escolhidas, para não ficar tudo igual.
  function quadrosCompletePalette(targets, picks, limit) {
    while (picks.length < limit) {
      var best = null;
      var bestScore = -Infinity;

      targets.forEach(function (target) {
        var score;

        if (target.tone !== 1 || quadrosPickIsUsed(picks, target)) {
          return;
        }
        score = picks.length
          ? Math.min.apply(null, picks.map(function (pick) { return labDistance(pick.lab, target.lab); }))
          : 0;
        if (picks.some(function (pick) { return pick.value === target.value; })) {
          score -= QUADROS_FAMILY_REUSE_COST * 4;
        }
        if (score > bestScore) {
          bestScore = score;
          best = target;
        }
      });
      if (!best) {
        return picks;
      }
      picks.push(best);
    }
    return picks;
  }

  function quadrosPaletteRecord(title, note, picks, limit) {
    var clean = picks.filter(Boolean).slice(0, limit);

    return {
      title: title,
      note: note,
      values: clean.map(function (pick) { return pick.value; }),
      tones: clean.map(function (pick) { return pick.tone; }),
      palette: clean.map(function (pick) { return pick.hex; })
    };
  }

  // Clareia mantendo o matiz: sobe a luminosidade e baixa um pouco o croma,
  // que é o que distingue uma cor pastel da mesma cor cheia.
  function labSoften(lab, amount) {
    var mix = Math.max(0, Math.min(1, amount));

    return [
      lab[0] + (0.95 - lab[0]) * mix,
      lab[1] * (1 - mix * 0.55),
      lab[2] * (1 - mix * 0.55)
    ];
  }

  function buildQuadrosPhotoPalettes(step, detected, limit) {
    var targets = quadrosToneTargets(step);
    var records = [];
    var accent = detected.slice().sort(function (a, b) {
      return labChroma(b.lab) - labChroma(a.lab);
    })[0] || detected[0];
    var neutralTargets = targets.filter(function (target) {
      return target.neutral;
    });
    var picks;

    if (!targets.length || !detected.length) {
      return [];
    }

    // 1. As cores da fotografia, cada uma no tom que mais se aproxima.
    picks = [];
    detected.forEach(function (color) {
      var pick = picks.length < limit ? quadrosPickTone(targets, color.lab, picks, {}) : null;
      if (pick) { picks.push(pick); }
    });
    records.push(quadrosPaletteRecord(
      "Mais próxima da fotografia",
      "as cores que encontrámos na foto",
      quadrosCompletePalette(targets, picks, limit),
      limit
    ));

    // 2. As mesmas cores em versão pastel: a família continua a ser escolhida
    // pela cor original — só o tom é procurado a partir da versão clareada.
    picks = [];
    detected.forEach(function (color) {
      var pick = picks.length < limit
        ? quadrosPickTone(targets, color.lab, picks, {
          toneLab: labSoften(color.lab, 0.6),
          separation: 0.045,
          toneBias: [0, 0.1, 0.3]
        })
        : null;
      if (pick) { picks.push(pick); }
    });
    records.push(quadrosPaletteRecord(
      "Mais suave",
      "os mesmos tons, mais claros",
      quadrosCompletePalette(targets, picks, limit),
      limit
    ));

    // 3. Contraste: escuro, claro e principal, obrigando a uma diferença real de
    // luminosidade entre os quadrados em vez de trocar de família ao acaso.
    picks = [];
    detected.forEach(function (color, index) {
      var bias = index === 0 ? [0.16, 0.05, 0] : (index === 1 ? [0, 0.05, 0.16] : [0.06, 0, 0.06]);
      var pick = picks.length < limit
        ? quadrosPickTone(targets, color.lab, picks, { toneBias: bias, lightGap: 0.13 })
        : null;
      if (pick) { picks.push(pick); }
    });
    records.push(quadrosPaletteRecord(
      "Com mais contraste",
      "um tom escuro e um tom claro",
      quadrosCompletePalette(targets, picks, limit),
      limit
    ));

    // 4. Equilibrada: a cor dominante, um neutro do catálogo e a cor mais viva
    // da fotografia como acento.
    picks = [];
    picks.push(quadrosPickTone(targets, detected[0].lab, picks, {}));
    picks = picks.filter(Boolean);
    if (limit > 1 && neutralTargets.length) {
      var neutral = quadrosPickTone(neutralTargets, labSoften(detected[0].lab, 0.75), picks, { separation: 0.04 });
      if (neutral) { picks.push(neutral); }
    }
    if (limit > 2 && accent) {
      var vivid = quadrosPickTone(targets, accent.lab, picks, { toneBias: [0.06, 0, 0.04] });
      if (vivid) { picks.push(vivid); }
    }
    records.push(quadrosPaletteRecord(
      "Equilibrada",
      "a cor principal com um neutro",
      quadrosCompletePalette(targets, picks, limit),
      limit
    ));

    return quadrosDedupePalettes(records, limit);
  }

  // Duas regras diferentes podem chegar à mesma combinação (fotos de uma só
  // cor, por exemplo). Mostrar a mesma coisa duas vezes não ajuda ninguém.
  function quadrosDedupePalettes(records, limit) {
    var seen = [];

    return records.filter(function (record) {
      var key;
      if (!record || record.values.length !== limit) {
        return false;
      }
      key = record.values.map(function (value, index) {
        return value + "/" + record.tones[index];
      }).join("|");
      if (seen.indexOf(key) !== -1) {
        return false;
      }
      seen.push(key);
      return true;
    });
  }

  // As combinações fixas do catálogo, convertidas em famílias + tons. O hex de
  // cada cor é procurado entre todos os tons, não só entre os principais; se
  // não bater certo com nenhum, usa-se o tom perceptualmente mais próximo em
  // vez de deitar fora a combinação inteira, como acontecia antes.
  function quadrosDefaultPaletteRecords(step, limit) {
    var targets = quadrosToneTargets(step);

    if (!targets.length) {
      return [];
    }

    return (step && Array.isArray(step.items) ? step.items : []).map(function (item) {
      var picks = [];

      paletteColors(item, limit).forEach(function (color) {
        var exact = targets.filter(function (target) {
          return target.hex.toLowerCase() === color.toLowerCase() && !quadrosPickIsUsed(picks, target);
        })[0];
        var pick = exact || quadrosPickTone(targets, rgbLab(hexRgb(color)), picks, {
          separation: 0.02,
          reuseLimit: 3
        });

        if (pick) { picks.push(pick); }
      });
      return quadrosPaletteRecord(item.title || item.value, "", picks, limit);
    }).filter(function (record) {
      return record.values.length === limit;
    });
  }

  // Pele: num retrato ocupa metade da fotografia e nunca é uma boa cor de flor.
  // Não se exclui (uma foto pode ser quase só pele), reduz-se muito o peso. O
  // critério YCbCr apanha tons claros e escuros; o mínimo de vermelho sobre
  // azul mantém de fora os cremes e os beges frios, que são cores a sério.
  function quadrosIsSkinLike(r, g, b) {
    var cb = -0.169 * r - 0.331 * g + 0.5 * b + 128;
    var cr = 0.5 * r - 0.419 * g - 0.081 * b + 128;

    return cb >= 77 && cb <= 130 && cr >= 137 && cr <= 175 && r > g && g > b && r - b >= 28;
  }

  // Lê a fotografia e devolve baldes de cor com peso. O peso já traz dentro
  // tudo o que decide o que "conta" na foto: onde está o píxel, quão viva é a
  // cor e se é pele.
  function quadrosPhotoBuckets(img) {
    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d", { willReadFrequently: true });
    var sourceWidth = Math.max(1, img.naturalWidth || img.width || 1);
    var sourceHeight = Math.max(1, img.naturalHeight || img.height || 1);
    var scale = Math.min(1, QUADROS_PHOTO_SAMPLE_SIZE / Math.max(sourceWidth, sourceHeight));
    var width = Math.max(1, Math.round(sourceWidth * scale));
    var height = Math.max(1, Math.round(sourceHeight * scale));
    var buckets = {};
    var pixels;
    var index;
    var x;
    var y;

    canvas.width = width;
    canvas.height = height;
    context.drawImage(img, 0, 0, width, height);
    pixels = context.getImageData(0, 0, width, height).data;

    for (index = 0; index < pixels.length; index += 4) {
      var alpha = pixels[index + 3];
      if (alpha < 180) { continue; }

      var r = pixels[index];
      var g = pixels[index + 1];
      var b = pixels[index + 2];
      var lab = rgbLab([r, g, b]);
      // Fora o quase-branco e o quase-preto: são fundo, sombra ou papel, e não
      // existem como cor de flor.
      if (lab[0] < 0.2 || lab[0] > 0.955) { continue; }

      x = (index / 4) % width;
      y = Math.floor((index / 4) / width);
      var dx = ((x + 0.5) / width) * 2 - 1;
      var dy = ((y + 0.5) / height) * 2 - 1;
      // O motivo está no meio da fotografia; as bordas são quase sempre fundo.
      var radius = Math.min(1, Math.sqrt(dx * dx + dy * dy) / Math.SQRT2);
      var focus = 0.32 + 0.68 * Math.pow(1 - radius, 1.6);
      var weight = focus
        * (1 + Math.min(labChroma(lab), 0.22) * 5.5)
        * (quadrosIsSkinLike(r, g, b) ? 0.16 : 1);
      // Agrupar antes de analisar: 32 níveis por canal chegam para o resultado
      // e deixam o k-means a correr sobre uns milhares de baldes, não milhões.
      var key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      var bucket = buckets[key];

      if (bucket) {
        bucket.lab[0] += lab[0] * weight;
        bucket.lab[1] += lab[1] * weight;
        bucket.lab[2] += lab[2] * weight;
        bucket.weight += weight;
      } else {
        buckets[key] = {
          lab: [lab[0] * weight, lab[1] * weight, lab[2] * weight],
          weight: weight
        };
      }
    }

    return Object.keys(buckets).map(function (key) {
      var bucket = buckets[key];
      return {
        lab: bucket.lab.map(function (sum) { return sum / bucket.weight; }),
        weight: bucket.weight
      };
    });
  }

  // k-means em OKLab. Substitui o arredondamento em blocos de 24 do algoritmo
  // antigo, que partia a mesma cor por vários baldes e depois escolhia as
  // dominantes por ordem de contagem — daí saírem cinco variações do mesmo bege.
  // A inicialização é determinística (k-means++ sem sorteio): a mesma fotografia
  // dá sempre a mesma sugestão.
  function quadrosClusterBuckets(buckets, count) {
    var centroids = [];
    var iteration;

    if (!buckets.length) {
      return [];
    }

    centroids.push(buckets.reduce(function (best, bucket) {
      return bucket.weight > best.weight ? bucket : best;
    }, buckets[0]).lab.slice());

    while (centroids.length < count) {
      var seed = null;
      var seedScore = 0;

      buckets.forEach(function (bucket) {
        var nearest = Math.min.apply(null, centroids.map(function (centroid) {
          return labDistance(bucket.lab, centroid);
        }));
        var score = bucket.weight * nearest * nearest;

        if (score > seedScore) {
          seedScore = score;
          seed = bucket;
        }
      });
      if (!seed) { break; }
      centroids.push(seed.lab.slice());
    }

    for (iteration = 0; iteration < 14; iteration += 1) {
      var sums = centroids.map(function () { return [0, 0, 0, 0]; });
      var moved = 0;

      buckets.forEach(function (bucket) {
        var bestIndex = 0;
        var bestDistance = Infinity;

        centroids.forEach(function (centroid, centroidIndex) {
          var distance = labDistance(bucket.lab, centroid);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = centroidIndex;
          }
        });
        sums[bestIndex][0] += bucket.lab[0] * bucket.weight;
        sums[bestIndex][1] += bucket.lab[1] * bucket.weight;
        sums[bestIndex][2] += bucket.lab[2] * bucket.weight;
        sums[bestIndex][3] += bucket.weight;
      });

      sums.forEach(function (sum, centroidIndex) {
        var next;
        if (sum[3] <= 0) { return; }
        next = [sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3]];
        moved = Math.max(moved, labDistance(next, centroids[centroidIndex]));
        centroids[centroidIndex] = next;
      });
      if (moved < 0.002) { break; }
    }

    var weights = centroids.map(function () { return 0; });

    buckets.forEach(function (bucket) {
      var bestIndex = 0;
      var bestDistance = Infinity;

      centroids.forEach(function (centroid, centroidIndex) {
        var distance = labDistance(bucket.lab, centroid);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = centroidIndex;
        }
      });
      weights[bestIndex] += bucket.weight;
    });

    return centroids.map(function (centroid, centroidIndex) {
      return { lab: centroid, weight: weights[centroidIndex] };
    }).filter(function (cluster) {
      return cluster.weight > 0;
    });
  }

  // Junta grupos que ficaram perto demais e ordena pelo que mais se nota: área
  // ocupada, com um empurrão para as cores vivas.
  function quadrosRankClusters(clusters) {
    var merged = [];

    clusters.slice().sort(function (a, b) {
      return b.weight - a.weight;
    }).forEach(function (cluster) {
      var near = merged.filter(function (other) {
        return labDistance(other.lab, cluster.lab) < 0.055;
      })[0];

      if (near) {
        near.weight += cluster.weight;
        return;
      }
      merged.push({ lab: cluster.lab.slice(), weight: cluster.weight });
    });

    return merged.sort(function (a, b) {
      return b.weight * (1 + Math.min(labChroma(b.lab), 0.2) * 2)
        - a.weight * (1 + Math.min(labChroma(a.lab), 0.2) * 2);
    });
  }

  function analyseQuadrosPhoto(img, step) {
    var limit = paletteSelectionLimit(step);
    var detected = quadrosRankClusters(
      quadrosClusterBuckets(quadrosPhotoBuckets(img), QUADROS_PHOTO_CLUSTERS)
    );

    // Fotografia praticamente monocromática: em vez de inventar beges fixos,
    // derivam-se variações da própria cor encontrada.
    while (detected.length && detected.length < 3) {
      detected.push({
        lab: labSoften(detected[0].lab, 0.3 * detected.length),
        weight: detected[0].weight / (detected.length + 1)
      });
    }

    return {
      detected: detected.slice(0, 5).map(function (cluster) { return rgbHex(labRgb(cluster.lab)); }),
      palettes: buildQuadrosPhotoPalettes(step, detected, limit)
    };
  }

  function applyQuadrosSuggestedPalette(step, record) {
    var limit = paletteSelectionLimit(step);
    var keys = quadrosColorSelectionKeys(step);
    var ui = quadrosColorUiFor(step, limit);
    var values = record && Array.isArray(record.values) ? record.values.slice(0, limit) : [];
    var tones = record && Array.isArray(record.tones) ? record.tones.slice(0, limit) : [];
    if (values.length !== limit) {
      return false;
    }

    delete state.selections.quadro_color_mode;
    state.selections[keys.palette] = record.title || "";
    state.selections[keys.colors] = values;
    // A sugestão traz o tom de cada cor. Antes forçava-se sempre o principal,
    // o que deitava fora metade do trabalho de escolher a cor certa.
    state.selections[keys.tones] = Array.from({ length: limit }, function (_, index) {
      var tone = Number(tones[index]);
      return tone >= 0 && tone <= 2 ? tone : 1;
    });
    state.selections[keys.mia] = false;
    ui.slots = values.slice();
    ui.activeSlot = 0;
    ui.pinnedSlot = null;
    ui.pinnedChangeCount = 0;
    ui.hintSlot = null;
    ui.toneEdit = null;
    state.paletteColorSlots = values.slice();
    state.paletteLastSlot = Math.max(0, values.length - 1);
    state.quadroActiveColorSlot = 0;
    state.quadroToneEdit = null;
    return true;
  }

  function initQuadrosPhotoColorAnalysis(product, step) {
    var upload;
    var token;
    var analysis;
    var image;

    if (!isQuadrosProduct(product) || !step || step.id !== "colors"
        || quadrosColorModeInfo(step).mode !== "photo") {
      return;
    }

    upload = orderUploadItems("quadro_uploads")[0] || null;
    if (!upload) {
      return;
    }
    token = String(upload.token || "");
    analysis = state.quadroPhotoColorAnalysis || {};
    if (analysis.token === token && (analysis.status === "loading" || analysis.status === "ready")) {
      return;
    }

    state.quadroPhotoColorAnalysis = {
      token: token,
      status: "loading",
      detected: [],
      palettes: [],
      error: ""
    };
    image = new Image();
    image.onload = function () {
      var result;
      try {
        result = analyseQuadrosPhoto(image, step);
      } catch (error) {
        state.quadroPhotoColorAnalysis.status = "error";
        state.quadroPhotoColorAnalysis.error = "Não foi possível analisar a fotografia, mas podes escolher as cores manualmente.";
        if (state.product === product) { rerenderProduct(product); }
        return;
      }

      state.quadroPhotoColorAnalysis = {
        token: token,
        status: "ready",
        detected: result.detected,
        palettes: result.palettes,
        error: ""
      };
      if (quadrosColorModeInfo(step).canUsePhoto && result.palettes[0]) {
        applyQuadrosSuggestedPalette(step, result.palettes[0]);
      }
      if (state.product === product) { rerenderProduct(product); }
    };
    image.onerror = function () {
      state.quadroPhotoColorAnalysis.status = "error";
      state.quadroPhotoColorAnalysis.error = "Não foi possível abrir a fotografia, mas podes escolher as cores manualmente.";
      if (state.product === product) { rerenderProduct(product); }
    };
    image.src = orderUploadPreviewUrl(upload);
  }

  function orderUploadMeta(item, kind) {
    var text = formatUploadSize(item && item.size);
    var dpi = Math.max(0, Math.round(Number(item && item.dpi) || 0));
    if (kind === "photo" && dpi) {
      text += " (" + dpi + " DPI estimados para 10 × 15 in)";
    }
    return text;
  }

  function orderUploadMaxFiles(config) {
    var configured = Number(config && config.maxFiles);
    if (configured === 0) {
      return Infinity;
    }
    return Math.max(1, configured || ((config && config.multiple === true) ? 5 : 1));
  }

  function renderOrderUploadList(config, kind) {
    var key = config.selectionKey || (kind === "audio" ? "quadro_audio_uploads" : "quadro_uploads");
    return orderUploadItems(key).map(function (item) {
      var preview = orderUploadPreviewUrl(item);
      var isPdf = String(item && item.mime || "").toLowerCase() === "application/pdf"
        || /\.pdf$/i.test(String(item && item.name || ""));
      var media = kind === "audio"
        ? '<audio controls preload="metadata" src="' + escapeHtml(preview) + '"></audio>'
        : (isPdf ? '<span class="order-upload-pdf" aria-hidden="true">PDF</span>' : '<img src="' + escapeHtml(preview) + '" alt="">');
      var fallbackName = kind === "audio" ? "Áudio" : (kind === "artwork" ? "Design" : "Foto");
      var removeLabel = kind === "audio" ? "Remover áudio" : (kind === "artwork" ? "Remover design" : "Remover foto");
      var quantity = customArtworkItemQuantity(item);
      var feeCents = Math.max(0, parseInt(config.feePerFileCents, 10) || parseInt(item && item.feeCents, 10) || 0);
      var quantityControl = "";
      var feeText = "";

      if (config.showQuantity === true) {
        quantityControl = '<label class="artwork-upload-quantity"><span>Quantidade com este design</span><input type="number" min="1" max="9999" step="1" value="' + quantity + '" data-artwork-upload-quantity data-order-upload-key="' + escapeHtml(key) + '" data-order-upload-token="' + escapeHtml(item.token) + '"></label>';
      }
      if (feeCents) {
        feeText = '<small class="artwork-upload-fee"><strong>+' + escapeHtml(formatCents(feeCents)) + '</strong> — ' + escapeHtml(config.feeText || "Preparação do ficheiro e testes antes da produção.") + '</small>';
      }

      return [
        '<li class="order-upload-item order-upload-item--' + escapeHtml(kind) + (isPdf ? ' is-pdf' : '') + '">',
        media,
        '<span><strong>' + escapeHtml(item.name || fallbackName) + '</strong><small>' + escapeHtml(orderUploadMeta(item, kind)) + '</small>' + feeText + quantityControl + '</span>',
        '<button type="button" data-order-upload-remove="' + escapeHtml(item.token) + '" data-order-upload-key="' + escapeHtml(key) + '" aria-label="' + escapeHtml(removeLabel) + '" title="' + escapeHtml(removeLabel) + '">×</button>',
        '</li>'
      ].join("");
    }).join("");
  }

  function renderOrderUploadStatus(kind) {
    if (kind && state.orderUploadFeedbackKind && state.orderUploadFeedbackKind !== kind) {
      return "";
    }
    return [
      state.orderUploadBusy && state.orderUploadProgress ? renderOrderUploadProgress() : '',
      state.orderUploadBusy && !state.orderUploadProgress ? '<p class="order-upload-status" role="status">A processar…</p>' : '',
      state.orderUploadError ? '<p class="form-error order-upload-error order-upload-popup" role="alert">' + escapeHtml(state.orderUploadError) + '</p>' : '',
      state.orderUploadMessage ? '<p class="order-upload-status" role="status">' + escapeHtml(state.orderUploadMessage) + '</p>' : ''
    ].join("");
  }

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
    var artworkMode = String(config.purpose || "") === "custom-artwork" || config.allowPdf === true;
    var accept = artworkMode
      ? "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf"
      : "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
    if (buttonLabel === "Enviar foto") {
      buttonLabel = "Escolher foto";
    }
    var helperText = items.length
      ? items.length + (artworkMode ? (items.length === 1 ? " design anexado" : " designs anexados") : (items.length === 1 ? " foto anexada" : " fotos anexadas"))
      : String(config.helperText || (multiple && isFinite(maxFiles) ? "Até " + maxFiles + (artworkMode ? " designs" : " fotos") : "")).trim();

    return [
      '<label class="order-upload-button' + (settings.compact ? ' order-media-action' : '') + (disabled ? ' is-disabled' : '') + '">',
      '<input type="file" accept="' + accept + '"' + (multiple ? ' multiple' : '') + ' data-order-upload data-order-upload-key="' + escapeHtml(key) + '" data-order-upload-max="' + maxAttribute + '"' + (disabled ? ' disabled' : '') + '>',
      '<span class="order-upload-button-icon">' + (settings.compact ? ICON_PHOTO : ICON_UPLOAD) + '</span>',
      '<strong>' + escapeHtml(buttonLabel) + '</strong>',
      helperText ? '<small' + (items.length ? ' class="is-success"' : '') + '>' + escapeHtml(helperText) + '</small>' : '',
      '</label>'
    ].join("");
  }

  function renderOrderPhotoControl(config, options) {
    var settings = options || {};
    var kind = String(config.purpose || "") === "custom-artwork" ? "artwork" : "photo";
    var uploadList = renderOrderUploadList(config, kind);

    return [
      '<div class="order-photo-control">',
      renderOrderPhotoAction(config, settings),
      uploadList ? '<ul class="order-upload-list">' + uploadList + '</ul>' : '',
      settings.showStatus ? renderOrderUploadStatus(kind) : '',
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

  function renderOriginalArtworkUploadStep(product, step) {
    var config = Object.assign({}, step && step.upload || {}, customArtworkConfig(product));
    var items = orderUploadItems(config.uploadKey || config.selectionKey);
    var feeTotal = config.feePerFileCents * items.length;
    // No construtor a quantidade e a taxa pertencem a cada linha do passo 2
    // (uma imagem pode ir para varios produtos), por isso aqui so se enviam
    // os ficheiros.
    var builder = isArtworkBuilderProduct(product);

    config.selectionKey = config.uploadKey || config.selectionKey;
    config.multiple = true;
    config.maxFiles = Math.min(10, Math.max(1, parseInt(config.maxFiles, 10) || 10));
    config.allowPdf = true;
    config.preserveOriginal = true;
    config.showQuantity = !builder;
    config.purpose = "custom-artwork";
    if (builder) {
      config.feePerFileCents = 0;
    }

    return [
      '<section class="order-photo-upload original-artwork-upload">',
      '<div class="original-artwork-note"><strong>O ficheiro segue tal como o envias.</strong><p>Aceitamos imagens e PDF até 30 MB por ficheiro, sem compressão nem conversão.' + (builder ? '' : ' Podes carregar vários designs e indicar uma quantidade diferente para cada um.') + '</p></div>',
      renderOrderPhotoControl(config, { showStatus: true }),
      !builder && items.length ? '<p class="original-artwork-fee-total"><strong>Preparação e testes:</strong> ' + items.length + (items.length === 1 ? ' imagem × ' : ' imagens × ') + escapeHtml(formatCents(config.feePerFileCents)) + ' = <strong>' + escapeHtml(formatCents(feeTotal)) + '</strong></p>' : '',
      '</section>'
    ].join("");
  }

  // ==== PERSONALIZACAO_BUILDER_V1 ==========================================
  // personalizacao.html e o flow de quem traz o seu proprio artwork. O passo 1
  // envia os ficheiros; o passo 2 monta linhas (design x produto x opcoes x
  // quantidade). Cada linha entra no carrinho como uma linha normal do slug de
  // destino com order_flow=custom, por isso quem manda no preco continua a ser
  // o send-order.php — aqui so se repete o mesmo calculo para o cliente ver.
  // Consequencia: qualquer alteracao a pack-combination / tier-unit / flat-unit
  // tem de ser feita nos dois sitios, tal como ja acontece nos outros produtos.

  function isArtworkBuilderProduct(product) {
    return !!(product && product.artworkBuilder === true);
  }

  function builderStep(product) {
    return product ? findStep(product, "custom_products") : null;
  }

  function builderCatalog(product) {
    var step = builderStep(product);
    return step && Array.isArray(step.products) ? step.products : [];
  }

  function builderFinishOptions(product) {
    var step = builderStep(product);
    return step && Array.isArray(step.finishes) ? step.finishes : [];
  }

  function builderFinishOption(product, value) {
    return builderFinishOptions(product).filter(function (finish) {
      return finish && String(finish.value) === String(value);
    })[0] || null;
  }

  function builderEntry(product, id) {
    return builderCatalog(product).filter(function (entry) {
      return entry && String(entry.id) === String(id || "");
    })[0] || null;
  }

  function builderEntryChoices(entry) {
    return entry && Array.isArray(entry.choices) ? entry.choices : [];
  }

  function builderPriceKeyChoice(entry) {
    return builderEntryChoices(entry).filter(function (choice) {
      return choice && choice.isPriceKey === true;
    })[0] || null;
  }

  function builderUploads(product) {
    return orderUploadItems(customArtworkConfig(product).uploadKey);
  }

  function builderUpload(product, token) {
    return builderUploads(product).filter(function (item) {
      return String(item.token) === String(token || "");
    })[0] || null;
  }

  function builderUploadIsPdf(upload) {
    return String(upload && upload.mime || "").toLowerCase() === "application/pdf"
      || /\.pdf$/i.test(String(upload && upload.name || ""));
  }

  function builderLines(product) {
    if (!Array.isArray(state.selections.builder_lines)) {
      state.selections.builder_lines = [];
    }
    return state.selections.builder_lines;
  }

  function builderLine(product, id) {
    return builderLines(product).filter(function (line) {
      return line && String(line.id) === String(id || "");
    })[0] || null;
  }

  function builderPricing(entry) {
    var products = state.pricing && state.pricing.products ? state.pricing.products : {};
    return entry && entry.slug && products[entry.slug] ? products[entry.slug] : null;
  }

  function builderPriceKey(product, line) {
    var entry = builderEntry(product, line && line.productId);
    var choice = builderPriceKeyChoice(entry);
    var record;

    if (!entry) {
      return "";
    }
    if (entry.size) {
      return String(entry.size);
    }
    if (choice) {
      return String((line && line.choices && line.choices[choice.field]) || "");
    }
    record = builderPricing(entry);
    return record && record.defaultPriceKey ? String(record.defaultPriceKey) : "";
  }

  function builderPricingMode(entry, priceKey) {
    var record = builderPricing(entry);
    var byKey = record && record.pricingModeByPriceKey ? record.pricingModeByPriceKey : null;

    if (byKey && priceKey && byKey[priceKey]) {
      return String(byKey[priceKey]);
    }
    return record && record.pricingMode ? String(record.pricingMode) : "";
  }

  function builderPriceTable(entry, priceKey) {
    var record = builderPricing(entry);
    return record && record.prices && record.prices[priceKey] ? record.prices[priceKey] : null;
  }

  // Espelha product_flat_unit_price_cents(): primeiro a tabela de unitarios,
  // so depois o preco de 1 unidade da tabela de packs.
  function builderFlatUnitCents(entry, priceKey) {
    var record = builderPricing(entry);
    var flat = record && record.flatUnitPricesCents ? record.flatUnitPricesCents : null;
    var table;

    if (flat && flat[priceKey] != null) {
      return Math.max(0, parseInt(flat[priceKey], 10) || 0);
    }
    table = builderPriceTable(entry, priceKey);
    return table && table["1"] != null ? Math.max(0, parseInt(table["1"], 10) || 0) : 0;
  }

  function builderQuantity(line) {
    return Math.max(0, Math.min(9999, parseInt(line && line.quantity, 10) || 0));
  }

  function builderMinimumQuantity(product, line) {
    var entry = builderEntry(product, line && line.productId);
    var priceKey = builderPriceKey(product, line);
    var record = builderPricing(entry);
    var mode = builderPricingMode(entry, priceKey);
    var table = builderPriceTable(entry, priceKey) || {};
    var minimum = Math.max(1, parseInt(record && record.minimumQuantity, 10) || 1);
    var tiers;
    var packs;

    if (mode === "tier-unit") {
      tiers = priceTiers(table);
      return tiers.length ? Math.max(minimum, tiers[0]) : minimum;
    }
    if (mode === "pack-combination") {
      packs = packCombinationTablePacks(table);
      return packs.length ? packs[0].quantity : minimum;
    }
    return minimum;
  }

  function builderQuantityOptions(product, line) {
    var entry = builderEntry(product, line && line.productId);
    var table = builderPriceTable(entry, builderPriceKey(product, line)) || {};

    return Object.keys(table).map(function (key) {
      return parseInt(key, 10) || 0;
    }).filter(function (quantity) {
      return quantity > 0;
    }).sort(function (a, b) {
      return a - b;
    });
  }

  function builderQuantityIsValid(product, line) {
    var entry = builderEntry(product, line && line.productId);
    var priceKey = builderPriceKey(product, line);
    var quantity = builderQuantity(line);

    if (!entry || quantity < builderMinimumQuantity(product, line) || quantity > 9999) {
      return false;
    }
    if (entry.quoteOnly === true) {
      return true;
    }
    if (builderPricingMode(entry, priceKey) === "pack-combination") {
      return packCombinationPlan(builderPriceTable(entry, priceKey), quantity) !== null;
    }
    return true;
  }

  function builderLineBaseCents(product, line) {
    var entry = builderEntry(product, line && line.productId);
    var priceKey = builderPriceKey(product, line);
    var mode = builderPricingMode(entry, priceKey);
    var table = builderPriceTable(entry, priceKey);
    var quantity = builderQuantity(line);
    var plan;

    if (!entry || entry.quoteOnly === true || !quantity || !priceKey) {
      return 0;
    }
    if (mode === "pack-combination") {
      plan = packCombinationPlan(table, quantity);
      return plan ? plan.cents : 0;
    }
    if (mode === "tier-unit") {
      return tierPriceCents(table, quantity);
    }
    return builderFlatUnitCents(entry, priceKey) * quantity;
  }

  function builderLineFinishes(product, line) {
    var entry = builderEntry(product, line && line.productId);
    var allowed = entry && Array.isArray(entry.finishes) ? entry.finishes : [];

    return (line && Array.isArray(line.finishes) ? line.finishes : []).filter(function (value) {
      return allowed.indexOf(value) !== -1;
    });
  }

  function builderFinishExtraPerUnitCents(product, line) {
    return builderLineFinishes(product, line).reduce(function (total, value) {
      var finish = builderFinishOption(product, value);
      return total + (finish ? Math.max(0, parseInt(finish.extraPriceCentsPerUnit, 10) || 0) : 0);
    }, 0);
  }

  function builderFeeCents(product) {
    return Math.max(0, parseInt(customArtworkConfig(product).feePerFileCents, 10) || 0);
  }

  function builderLineTotalCents(product, line) {
    var entry = builderEntry(product, line && line.productId);

    if (!entry || entry.quoteOnly === true || !builderQuantityIsValid(product, line)) {
      return 0;
    }
    return builderLineBaseCents(product, line)
      + builderFinishExtraPerUnitCents(product, line) * builderQuantity(line)
      + builderFeeCents(product);
  }

  function builderTotalCents(product) {
    return builderLines(product).reduce(function (total, line) {
      return total + builderLineTotalCents(product, line);
    }, 0);
  }

  function builderHasQuoteOnly(product) {
    return builderLines(product).some(function (line) {
      var entry = builderEntry(product, line && line.productId);
      return !!(entry && entry.quoteOnly === true);
    });
  }

  function builderUnitLabel(product, line, quantity) {
    var entry = builderEntry(product, line && line.productId);
    var record = builderPricing(entry);
    var count = Math.max(0, parseInt(quantity, 10) || 0);
    var singular = record && record.unitSingular ? String(record.unitSingular) : "unidade";
    var plural = record && record.unitLabel ? String(record.unitLabel) : "unidades";

    return count + " " + (count === 1 ? singular : plural);
  }

  // Devolve o marcador de pack quando a escolha que define a tabela de precos
  // traz um `quantity` proprio (opcoes de compra dos cadernos). 0 quando nao ha.
  function builderPackQuantityMarker(product, line) {
    var entry = builderEntry(product, line && line.productId);
    var choice = builderPriceKeyChoice(entry);
    var value = choice ? String((line.choices && line.choices[choice.field]) || "") : "";
    var item = choice && Array.isArray(choice.items) ? choice.items.filter(function (candidate) {
      return String(candidate.value) === value;
    })[0] : null;

    return item ? Math.max(0, parseInt(item.quantity, 10) || 0) : 0;
  }

  function builderApplyProduct(product, line, productId) {
    var entry = builderEntry(product, productId);

    line.productId = entry ? String(entry.id) : "";
    line.choices = {};
    line.finishes = [];
    builderEntryChoices(entry).forEach(function (choice) {
      var first = choice && Array.isArray(choice.items) ? choice.items[0] : null;
      if (choice && choice.required === true && first) {
        line.choices[choice.field] = String(first.value);
      }
    });
    line.quantity = builderMinimumQuantity(product, line);
  }

  function builderCreateLine(product) {
    var uploads = builderUploads(product);

    return {
      id: "bl_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7),
      designToken: uploads.length === 1 ? String(uploads[0].token) : "",
      productId: "",
      choices: {},
      finishes: [],
      quantity: 0
    };
  }

  function builderRenderDesignField(product, line) {
    var uploads = builderUploads(product);

    return [
      '<div class="builder-field">',
      '<span class="builder-field-label">Design</span>',
      '<div class="builder-design-grid">',
      uploads.map(function (upload) {
        var checked = String(line.designToken || "") === String(upload.token);
        var media = builderUploadIsPdf(upload)
          ? '<span class="builder-design-pdf" aria-hidden="true">PDF</span>'
          : '<img src="' + escapeHtml(orderUploadPreviewUrl(upload)) + '" alt="">';

        return [
          '<label class="builder-design-choice' + (checked ? ' is-selected' : '') + '">',
          '<input type="radio" name="builder-design-' + escapeHtml(line.id) + '" value="' + escapeHtml(upload.token) + '" data-builder-design data-builder-line="' + escapeHtml(line.id) + '"' + (checked ? ' checked' : '') + '>',
          media,
          '<small>' + escapeHtml(upload.name || "Design") + '</small>',
          '</label>'
        ].join("");
      }).join(""),
      '</div>',
      '</div>'
    ].join("");
  }

  function builderRenderProductField(product, line) {
    var order = [];
    var byGroup = {};

    builderCatalog(product).forEach(function (entry) {
      var name = String(entry.group || "Produtos");
      if (!byGroup[name]) {
        byGroup[name] = [];
        order.push(name);
      }
      byGroup[name].push(entry);
    });

    return [
      '<div class="builder-field">',
      '<span class="builder-field-label">Produto</span>',
      order.map(function (name) {
        return [
          '<p class="builder-group-title">' + escapeHtml(name) + '</p>',
          '<div class="builder-product-grid">',
          byGroup[name].map(function (entry) {
            var checked = String(line.productId || "") === String(entry.id);
            var media = entry.image
              ? '<span class="builder-product-media' + (entry.imageShape === "round" ? " is-round" : "") + '" style="background-image:url(&quot;' + escapeHtml(entry.image) + '&quot;)"></span>'
              : '<span class="builder-product-media is-blank" aria-hidden="true"></span>';

            return [
              '<label class="builder-product-choice' + (checked ? ' is-selected' : '') + '">',
              '<input type="radio" name="builder-product-' + escapeHtml(line.id) + '" value="' + escapeHtml(entry.id) + '" data-builder-product data-builder-line="' + escapeHtml(line.id) + '"' + (checked ? ' checked' : '') + '>',
              media,
              '<span class="builder-product-copy"><strong>' + escapeHtml(entry.title) + '</strong>' + (entry.subtitle ? '<small>' + escapeHtml(entry.subtitle) + '</small>' : "") + '</span>',
              '</label>'
            ].join("");
          }).join(""),
          '</div>'
        ].join("");
      }).join(""),
      '</div>'
    ].join("");
  }

  function builderRenderChoiceFields(product, line) {
    var entry = builderEntry(product, line.productId);

    return builderEntryChoices(entry).map(function (choice) {
      var selected = String((line.choices && line.choices[choice.field]) || "");

      return [
        '<div class="builder-field">',
        '<span class="builder-field-label">' + escapeHtml(choice.label || choice.field) + '</span>',
        '<div class="builder-option-grid">',
        (Array.isArray(choice.items) ? choice.items : []).map(function (item) {
          var checked = selected === String(item.value);
          return [
            '<label class="builder-option-choice' + (checked ? ' is-selected' : '') + '">',
            '<input type="radio" name="builder-choice-' + escapeHtml(line.id) + '-' + escapeHtml(choice.field) + '" value="' + escapeHtml(item.value) + '" data-builder-choice="' + escapeHtml(choice.field) + '" data-builder-line="' + escapeHtml(line.id) + '"' + (checked ? ' checked' : '') + '>',
            '<span><strong>' + escapeHtml(item.title) + '</strong>' + (item.subtitle ? '<small>' + escapeHtml(item.subtitle) + '</small>' : "") + '</span>',
            '</label>'
          ].join("");
        }).join(""),
        '</div>',
        '</div>'
      ].join("");
    }).join("");
  }

  function builderRenderFinishField(product, line) {
    var entry = builderEntry(product, line.productId);
    var allowed = entry && Array.isArray(entry.finishes) ? entry.finishes : [];
    var chosen = builderLineFinishes(product, line);

    if (!allowed.length) {
      return "";
    }

    return [
      '<div class="builder-field">',
      '<span class="builder-field-label">Acabamento</span>',
      '<div class="builder-finish-list">',
      allowed.map(function (value) {
        var finish = builderFinishOption(product, value);
        var extra = finish ? Math.max(0, parseInt(finish.extraPriceCentsPerUnit, 10) || 0) : 0;
        var checked = chosen.indexOf(value) !== -1;

        if (!finish) {
          return "";
        }
        return [
          '<label class="builder-finish-choice' + (checked ? ' is-selected' : '') + '">',
          '<input type="checkbox" value="' + escapeHtml(value) + '" data-builder-finish data-builder-line="' + escapeHtml(line.id) + '"' + (checked ? ' checked' : '') + '>',
          '<span><strong>' + escapeHtml(finish.title || value) + '</strong>' + (extra ? '<small>+' + escapeHtml(formatCents(extra)) + ' por unidade</small>' : "") + '</span>',
          '</label>'
        ].join("");
      }).join(""),
      '</div>',
      '</div>'
    ].join("");
  }

  function builderRenderQuantityField(product, line) {
    var options = builderQuantityOptions(product, line);
    var minimum = builderMinimumQuantity(product, line);
    var quantity = builderQuantity(line);

    return [
      '<div class="builder-field">',
      '<span class="builder-field-label">Quantidade</span>',
      options.length ? '<div class="builder-quantity-grid">' + options.map(function (value) {
        return '<button type="button" class="builder-quantity-tile' + (value === quantity ? ' is-selected' : '') + '" data-builder-quantity="' + value + '" data-builder-line="' + escapeHtml(line.id) + '">' + value + '</button>';
      }).join("") + '</div>' : "",
      '<div class="builder-quantity-input">',
      '<button type="button" data-builder-quantity-step="-1" data-builder-line="' + escapeHtml(line.id) + '" aria-label="Menos">−</button>',
      '<input type="number" min="' + minimum + '" max="9999" step="1" value="' + quantity + '" inputmode="numeric" data-builder-quantity-input data-builder-line="' + escapeHtml(line.id) + '">',
      '<button type="button" data-builder-quantity-step="1" data-builder-line="' + escapeHtml(line.id) + '" aria-label="Mais">+</button>',
      '</div>',
      '</div>'
    ].join("");
  }

  function builderRenderLinePrice(product, line) {
    var entry = builderEntry(product, line.productId);
    var quantity = builderQuantity(line);
    var base;
    var extra;
    var fee;

    if (!entry) {
      return "";
    }
    if (entry.quoteOnly === true) {
      return '<p class="builder-line-price is-quote">' + escapeHtml(entry.quoteNote || "Preço a confirmar") + '</p>';
    }
    if (!builderQuantityIsValid(product, line)) {
      return '<p class="builder-line-price is-invalid">' + escapeHtml("A partir de " + builderMinimumQuantity(product, line) + " unidades.") + '</p>';
    }

    base = builderLineBaseCents(product, line);
    extra = builderFinishExtraPerUnitCents(product, line) * quantity;
    fee = builderFeeCents(product);

    return [
      '<p class="builder-line-price">',
      '<span>' + escapeHtml(formatCents(base)) + '</span>',
      extra ? '<span>+ ' + escapeHtml(formatCents(extra)) + ' acabamento</span>' : "",
      fee ? '<span>+ ' + escapeHtml(formatCents(fee)) + ' preparação</span>' : "",
      '<strong>' + escapeHtml(formatCents(base + extra + fee)) + '</strong>',
      '</p>'
    ].join("");
  }

  function builderRenderCard(product, line, index) {
    var entry = builderEntry(product, line.productId);
    var upload = builderUpload(product, line.designToken);
    var title = entry
      ? (entry.quoteOnly === true ? entry.title : builderUnitLabel(product, line, builderQuantity(line)) + " · " + entry.title)
      : "Produto " + (index + 1);

    return [
      '<article class="builder-card" data-builder-card="' + escapeHtml(line.id) + '">',
      '<header class="builder-card-header">',
      '<strong>' + escapeHtml(title) + '</strong>',
      '<button type="button" class="builder-card-remove" data-builder-remove="' + escapeHtml(line.id) + '" aria-label="Remover produto">×</button>',
      '</header>',
      builderRenderDesignField(product, line),
      builderRenderProductField(product, line),
      entry ? builderRenderChoiceFields(product, line) : "",
      entry ? builderRenderFinishField(product, line) : "",
      entry ? builderRenderQuantityField(product, line) : "",
      entry && upload ? builderRenderLinePrice(product, line) : "",
      '</article>'
    ].join("");
  }

  function builderRenderTotals(product) {
    var total = builderTotalCents(product);

    return [
      '<p class="builder-total">',
      '<span>Total</span>',
      '<strong>' + escapeHtml(formatCents(total)) + '</strong>',
      builderHasQuoteOnly(product) ? '<small>Há produtos com preço a confirmar.</small>' : "",
      '</p>'
    ].join("");
  }

  function renderCustomProductBuilderStep(product, step) {
    var lines = builderLines(product);
    var addLabel = String((step && step.addLabel) || "Adicionar produto");

    // Um design apagado no passo 1 deixa de existir: limpa a referencia para a
    // linha nao ficar a apontar para um ficheiro que ja nao segue no pedido.
    lines.forEach(function (line) {
      if (line.designToken && !builderUpload(product, line.designToken)) {
        line.designToken = "";
      }
    });

    return [
      '<section class="custom-product-builder">',
      lines.map(function (line, index) {
        return builderRenderCard(product, line, index);
      }).join(""),
      '<button type="button" class="builder-add" data-builder-add>+ ' + escapeHtml(addLabel) + '</button>',
      lines.length ? builderRenderTotals(product) : "",
      '</section>'
    ].join("");
  }

  function validateBuilderStep(product) {
    var lines = builderLines(product);
    var error = "";

    if (state.orderUploadBusy) {
      return "Espera até todos os ficheiros terminarem de enviar.";
    }
    if (!builderUploads(product).length) {
      return "Carrega pelo menos uma imagem ou um PDF no passo anterior.";
    }
    if (!lines.length) {
      return "Adiciona pelo menos um produto.";
    }

    lines.some(function (line, index) {
      var entry = builderEntry(product, line.productId);
      var position = "no produto " + (index + 1);

      if (!line.designToken || !builderUpload(product, line.designToken)) {
        error = "Escolhe o design " + position + ".";
        return true;
      }
      if (!entry) {
        error = "Escolhe o que queres fazer " + position + ".";
        return true;
      }
      if (builderEntryChoices(entry).some(function (choice) {
        return choice && choice.required === true && !(line.choices && line.choices[choice.field]);
      })) {
        error = "Preenche as opções " + position + ".";
        return true;
      }
      if (!builderQuantityIsValid(product, line)) {
        error = "Escolhe uma quantidade válida " + position + " (a partir de " + builderMinimumQuantity(product, line) + ").";
        return true;
      }
      return false;
    });

    return error;
  }

  function builderCartItem(product, line) {
    var entry = builderEntry(product, line && line.productId);
    var upload = builderUpload(product, line && line.designToken);
    var record = builderPricing(entry);
    var quantity = builderQuantity(line);
    var fee = builderFeeCents(product);
    var finishes = builderLineFinishes(product, line);
    var quoteOnly = !!(entry && entry.quoteOnly === true);
    var selections = {};
    var subtitle = [];

    if (!entry || !upload || !quantity) {
      return null;
    }

    selections.catalog_context = "main-v2";
    selections.order_flow = "custom";
    selections.design_source = "custom";
    selections.designs = [];
    selections.design_quantities = {};
    selections.design_labels = {};
    selections.assorted_designs = "";
    selections.size = entry.size ? String(entry.size) : "";
    // Nos cadernos o `pack_quantity` nao e a quantidade encomendada: e o
    // marcador que identifica a opcao de compra (product_step_item_by_quantity
    // no send-order.php). A quantidade real vai no ficheiro e o servidor
    // copia-a para caderno_order_quantity.
    selections.pack_quantity = builderPackQuantityMarker(product, line) || quantity;
    selections.custom_artwork_uploads = [Object.assign({}, upload, { quantity: quantity, feeCents: fee })];
    selections.customization_file_count = 1;
    selections.customization_fee_cents = fee;
    selections.artwork_total_quantity = quantity;
    selections.finishes = finishes;

    Object.keys((entry.fixedSelections && typeof entry.fixedSelections === "object") ? entry.fixedSelections : {}).forEach(function (key) {
      selections[key] = entry.fixedSelections[key];
    });

    builderEntryChoices(entry).forEach(function (choice) {
      var value = String((line.choices && line.choices[choice.field]) || "");
      var item = (Array.isArray(choice.items) ? choice.items : []).filter(function (candidate) {
        return String(candidate.value) === value;
      })[0] || null;

      selections[choice.field] = value;
      if (item) {
        selections[choice.field + "_label"] = String(item.title || value);
        subtitle.push(String(item.title || value));
      }
    });

    if (finishes.length) {
      subtitle.push(finishes.map(function (value) {
        var finish = builderFinishOption(product, value);
        return finish ? String(finish.title || value) : value;
      }).join(", "));
    }
    subtitle.push(String(upload.name || "design"));

    return {
      id: createCartItemId({ slug: entry.slug }),
      productSlug: String(entry.slug),
      productName: entry.title || (record && record.label) || entry.slug,
      selections: selections,
      summary: {
        title: quoteOnly
          ? entry.title + " · " + quantity
          : builderUnitLabel(product, line, quantity) + (entry.subtitle ? " · " + entry.subtitle : ""),
        subtitle: subtitle.filter(Boolean).join(" · "),
        priceCents: quoteOnly ? 0 : builderLineTotalCents(product, line),
        priceText: quoteOnly ? String(entry.quoteNote || "Preço a confirmar") : "",
        priceToConfirm: quoteOnly,
        image: builderUploadIsPdf(upload) ? null : ORDER_MEDIA_PREVIEW_API + "?token=" + encodeURIComponent(upload.token)
      }
    };
  }

  function addBuilderLinesToCart(product, destination) {
    var items;
    var cart = null;
    var total = 0;

    if (!validateProductForCart(product)) {
      return;
    }

    items = builderLines(product).map(function (line) {
      return builderCartItem(product, line);
    }).filter(Boolean);

    if (!items.length) {
      state.errors = "Adiciona pelo menos um produto.";
      rerenderProduct(product);
      return;
    }

    items.forEach(function (item) {
      total += item.summary.priceCents || 0;
      cart = addOrUpdateCartItem(item);
    });

    trackProductEvent(product, "cart_item_added", {
      cart_id: cart ? cart.cartId : "",
      item_count: cart ? cart.items.length : items.length,
      item_price_cents: total
    });

    // Sem isto, voltar atras no browser reenviaria as mesmas linhas.
    state.selections.builder_lines = [];
    window.location.href = destination;
  }

  function bindCustomProductBuilder(product) {
    function withLine(element, handler) {
      var line = builderLine(product, element.dataset.builderLine);
      if (!line) {
        return;
      }
      handler(line);
      state.errors = "";
      rerenderProduct(product);
    }

    document.querySelectorAll("[data-builder-add]").forEach(function (button) {
      button.addEventListener("click", function () {
        builderLines(product).push(builderCreateLine(product));
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-builder-remove]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = String(button.dataset.builderRemove || "");
        state.selections.builder_lines = builderLines(product).filter(function (line) {
          return String(line.id) !== id;
        });
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-builder-design]").forEach(function (input) {
      input.addEventListener("change", function () {
        withLine(input, function (line) {
          line.designToken = String(input.value || "");
        });
      });
    });

    document.querySelectorAll("[data-builder-product]").forEach(function (input) {
      input.addEventListener("change", function () {
        withLine(input, function (line) {
          builderApplyProduct(product, line, input.value);
        });
      });
    });

    document.querySelectorAll("[data-builder-choice]").forEach(function (input) {
      input.addEventListener("change", function () {
        withLine(input, function (line) {
          var field = String(input.dataset.builderChoice || "");
          if (!line.choices || typeof line.choices !== "object") {
            line.choices = {};
          }
          line.choices[field] = String(input.value || "");
          // A opcao de compra dos cadernos e tambem a tabela de precos: se a
          // quantidade deixar de servir, volta ao minimo desta tabela.
          if (!builderQuantityIsValid(product, line)) {
            line.quantity = builderMinimumQuantity(product, line);
          }
        });
      });
    });

    document.querySelectorAll("[data-builder-finish]").forEach(function (input) {
      input.addEventListener("change", function () {
        withLine(input, function (line) {
          var value = String(input.value || "");
          var current = Array.isArray(line.finishes) ? line.finishes.slice() : [];
          var index = current.indexOf(value);

          if (input.checked && index === -1) {
            current.push(value);
          } else if (!input.checked && index !== -1) {
            current.splice(index, 1);
          }
          line.finishes = current;
        });
      });
    });

    document.querySelectorAll("[data-builder-quantity]").forEach(function (button) {
      button.addEventListener("click", function () {
        withLine(button, function (line) {
          line.quantity = Math.max(1, parseInt(button.dataset.builderQuantity, 10) || 1);
        });
      });
    });

    document.querySelectorAll("[data-builder-quantity-step]").forEach(function (button) {
      button.addEventListener("click", function () {
        withLine(button, function (line) {
          var delta = parseInt(button.dataset.builderQuantityStep, 10) || 0;
          var minimum = builderMinimumQuantity(product, line);
          line.quantity = Math.max(minimum, Math.min(9999, builderQuantity(line) + delta));
        });
      });
    });

    document.querySelectorAll("[data-builder-quantity-input]").forEach(function (input) {
      input.addEventListener("change", function () {
        withLine(input, function (line) {
          var minimum = builderMinimumQuantity(product, line);
          line.quantity = Math.max(minimum, Math.min(9999, parseInt(input.value, 10) || minimum));
        });
      });
    });
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
    var hidePricePreview = product && productFamily(product) === "imanes";

    (step.items || []).forEach(function (item) {
      var checked = selected.indexOf(item.value) !== -1 ? " checked" : "";
      var muted = selected.length && !checked ? " is-muted" : "";
      var info = priceForSize(product, item.value);
      // CRACHAS_SIZE_BEFORE_QUANTITY_V1: nos Crachas o size aparece antes
      // do pack, por isso o placeholder antigo "Escolhe um pack para ver
      // o preco" deixava de fazer sentido. Para crachas mostramos um aviso
      // que aponta para o passo seguinte; outros produtos mantem a frase
      // antiga, que continua valida no fluxo deles.
      var noPriceText = product && productFamily(product) === "crachas"
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
      state.product && ["imanes", "caderninhos", "bloquinhos", "stickers", "marcadores"].indexOf(productFamily(state.product)) !== -1 && step.id === "designs" ? '<label>Formato<select data-admin-edit="rectOrientation" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"><option value="portrait"' + (itemRectOrientation(item) === "portrait" ? " selected" : "") + '>Em pé</option><option value="landscape"' + (itemRectOrientation(item) === "landscape" ? " selected" : "") + '>Deitado</option></select></label>' : "",
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
      state.product && isCadernosProduct(state.product) && step.id === "designs" ? '<label>Imagens do interior (' + escapeHtml((item.interiorImages || []).length) + ')<input type="file" accept="image/*" multiple data-admin-interior-upload data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>' : "",
      state.product && isCadernosProduct(state.product) && step.id === "designs" && (item.interiorImages || []).length ? '<button type="button" data-admin-interior-clear data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '">Limpar interiores</button>' : "",
      getStepSectionConfig(state.product, step) ? renderSectionItemControls(step, item) : "",
      // CRACHAS_STEP2_SIDE_PHOTO_ADMIN_V4: bloco extra para a foto direita
      // que fica visivel so nos cartoes de tamanho dos crachas. Gravado em
      // sideImage / sideFrameWidth / sideFrameHeight / sideFrameScale /
      // sideFrameMarginX|Y / sideImageZoom / sideImagePositionX|Y /
      // sideImageRotation. Nunca toca em image / frameWidth / frameHeight.
      state.product && productFamily(state.product) === "crachas" && step.id === "size" ? renderCrachasSidePhotoAdminControls(step, item) : "",
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

  // Quantas vezes cada pack entra no melhor conjunto para o total escolhido.
  // Serve para pôr o visto nos packs que compõem o total: 27 = 24 + 3 leva um
  // visto em cada, 10 = 5 + 5 leva dois vistos no pack de 5.
  function packCombinationCounts(product) {
    var table = packCombinationTableFor(product);
    var plan = table ? packCombinationPlan(
      table,
      getPackQuantity(product),
      packCombinationPrefersFewerPacks(product)
    ) : null;
    var counts = {};
    var tier;

    if (isCustomArtworkSelected(product) || isAssortedSelected(product)) {
      return counts;
    }

    // No modo escalão o visto vai para o pack que fixa o preço, o mesmo que a
    // caixa lista como "1 pack de 36".
    if (usesTierUnitPricing(product)) {
      tier = tierPlan(activePriceTableForPackFilter(product), getPackQuantity(product));
      if (tier) {
        counts[tier.tier] = 1;
      }
      return counts;
    }

    if (!plan) {
      return counts;
    }

    plan.parts.forEach(function (part) {
      counts[part.quantity] = part.count;
    });

    return counts;
  }

  function renderPackSelector(product) {
    var packStep = findStep(product, "pack");
    var current = getPackQuantity(product);
    var combinationCounts = packCombinationCounts(product);
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
      var marks = combinationCounts[quantity] || 0;
      var classes = "pack-option";
      var vistos = "";
      var i;
      if (quantity === current && packModeSelected) {
        classes += " is-selected";
      }
      if (disabled) {
        classes += " is-disabled";
      }
      if (marks) {
        classes += " is-in-combination";
        for (i = 0; i < marks; i += 1) {
          vistos += "<i>✓</i>";
        }
      }
      // CLICK_TRACKING_V1: data-track-* permite agregar quais packs são
      // mais escolhidos / quantos cliques falham (pack disabled).
      cards += [
        '<button class="' + classes + '" type="button" data-pack-quantity="' + quantity + '" data-track="true" data-track-action="select_pack" data-track-id="pack_' + quantity + '" data-track-label="' + escapeHtml(item.title + ' ' + item.subtitle) + '" aria-pressed="' + (quantity === current && packModeSelected ? 'true' : 'false') + '"' + (disabled ? ' data-pack-disabled="1" aria-disabled="true"' : '') + '>',
        '<strong>' + escapeHtml(item.title) + '</strong>',
        '<span>' + escapeHtml(item.subtitle) + '</span>',
        vistos ? '<span class="pack-option-marks" aria-hidden="true">' + vistos + '</span>' : "",
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

  // Nos produtos com packs combinados a quantidade livre é sempre convertida no
  // melhor conjunto de packs, e a etiqueta diz isso. Nos de preço unitário fixo
  // não há conjunto nenhum a calcular, por isso fica só o convite.
  function freeQuantityModeLabel(product, showPacks) {
    if (!showPacks) {
      return "Define a quantidade";
    }
    if (usesPackCombinationPricing(product)) {
      return "...ou escolhe a tua quantidade e calculamos o melhor conjunto de packs automaticamente";
    }
    return "Ou define outra quantidade";
  }

  function renderFreeQuantityBuilder(product) {
    ensurePackAndQuantities(product);
    var minimum = effectiveMinimumFreeQuantity(product);
    var rangeMaximum = freeQuantityRangeMaximum(product);
    var current = getPackQuantity(product) || minimum;
    var rangePosition = freeQuantityRangePosition(product, current);
    var rangeProgress = rangeMaximum > minimum
      ? ((rangePosition - minimum) / (rangeMaximum - minimum) * 100).toFixed(2)
      : "0";
    var showPacks = showsPackOptions(product);

    if (isCustomArtworkSelected(product)) {
      return [
        '<section class="free-quantity-builder free-quantity-builder--locked" aria-label="Quantidade total">',
        '<p class="free-quantity-mode-label"><span>Quantidade definida por imagem</span></p>',
        '<div class="free-quantity-readout"><strong>' + current + '</strong><small>' + escapeHtml(current === 1 ? productUnitSingular(product) : productUnit(product)) + '</small></div>',
        '<p class="step-helper">Para alterar este total, volta ao passo dos ficheiros e ajusta a quantidade junto de cada imagem.</p>',
        '</section>',
        renderPackPriceOverview(product)
      ].join("");
    }

    return [
      showPacks ? renderPackSelector(product) : "",
      '<section class="free-quantity-builder" aria-label="Quantidade">',
      '<p class="free-quantity-mode-label"><span>' + escapeHtml(freeQuantityModeLabel(product, showPacks)) + '</span></p>',
      '<div class="free-quantity-readout"><strong data-free-quantity-value>' + current + '</strong><small data-free-quantity-unit>' + escapeHtml(current === 1 ? productUnitSingular(product) : productUnit(product)) + '</small></div>',
      '<div class="free-quantity-control">',
      '<button type="button" data-free-quantity-change="-1" aria-label="Retirar uma unidade"' + (current <= minimum ? ' disabled' : '') + '>−</button>',
      '<label class="free-quantity-slider"><span>Quantidade: ' + current + '</span><input type="range" min="' + minimum + '" max="' + rangeMaximum + '" step="1" value="' + rangePosition + '" style="--range-progress:' + rangeProgress + '%" data-free-quantity-range aria-valuetext="' + escapeHtml(productQuantityLabel(product, current)) + '"></label>',
      '<button type="button" data-free-quantity-change="1" aria-label="Acrescentar uma unidade"' + (current >= rangeMaximum ? ' disabled' : '') + '>+</button>',
      '</div>',
      '</section>',
      renderPackPriceOverview(product),
      renderPackCombinationSummary(product),
      renderQuantityDistribution(product),
      renderFreeQuantityPriceChart(product)
    ].join("");
  }

  // Mostra de que packs é feito o total, e se compensa subir para o próximo
  // pack. Sem descontos intermédios, subir de 47 para 48 pode ficar mais barato
  // e é isso que esta caixa diz — em números, não em conselhos.
  function packCombinationSummaryParts(plan, product) {
    return plan.parts.map(function (part) {
      if (part.quantity === 1) {
        return part.count + " " + (part.count === 1 ? productUnitSingular(product) : productUnit(product));
      }
      return part.count + (part.count === 1 ? " pack de " : " packs de ") + part.quantity;
    });
  }

  function packCombinationQuantityLabel(product, quantity) {
    return quantity + " " + (quantity === 1 ? productUnitSingular(product) : productUnit(product));
  }

  function packCombinationUpgrade(product, table, quantity, currentCents) {
    var maximum = maximumFreeQuantity(product);
    var melhor = null;
    var preferFewerPacks = packCombinationPrefersFewerPacks(product);
    var quantities = Object.keys(table).map(Number).sort(function (a, b) { return a - b; }).filter(function (packQuantity) {
      return packQuantity > quantity && packQuantity <= maximum;
    });

    if (packCombinationUsesNextPackUpgrade(product)) {
      quantities = quantities.slice(0, 1);
    }

    quantities.forEach(function (packQuantity) {
      var cents = packCombinationCents(table, packQuantity, preferFewerPacks);
      if (!cents || cents >= currentCents) {
        return;
      }
      if (!melhor || cents < melhor.cents) {
        melhor = {
          quantity: packQuantity,
          cents: cents,
          saving: currentCents - cents,
          plan: packCombinationPlan(table, packQuantity, preferFewerPacks)
        };
      }
    });

    return melhor;
  }

  // No modo escalão não há conjunto de packs a listar, mas continua a haver
  // poupanças por subir de escalão — 35 ímanes recortados custam mais do que 36.
  // É o mesmo aviso, com os mesmos números.
  function tierUpgrade(product, table, quantity, currentCents) {
    var maximum = maximumFreeQuantity(product);
    var melhor = null;

    priceTiers(table).forEach(function (tier) {
      var cents;

      if (tier <= quantity || tier > maximum) {
        return;
      }
      cents = tierPriceCents(table, tier);
      if (!cents || cents >= currentCents) {
        return;
      }
      if (!melhor || cents < melhor.cents) {
        melhor = { quantity: tier, cents: cents, saving: currentCents - cents };
      }
    });

    return melhor;
  }

  // O total do escalão é o pack em vigor mais as unidades soltas ao preço desse
  // pack: 47 recortados são 1 pack de 36 + 11 ímanes ao mesmo preço por unidade.
  function tierPlan(table, quantity) {
    var tier = 0;
    var total = tierPriceCents(table, quantity);
    var tierCents;

    priceTiers(table).forEach(function (candidate) {
      if (candidate <= quantity) {
        tier = candidate;
      }
    });

    if (!tier || !total) {
      return null;
    }

    tierCents = Math.round(Number(table[String(tier)]) || 0);

    return {
      tier: tier,
      cents: total,
      tierCents: tierCents,
      extra: quantity - tier,
      extraCents: total - tierCents
    };
  }

  function renderTierUpgradeSummary(product) {
    var table = activePriceTableForPackFilter(product);
    var quantity = getPackQuantity(product);
    var atual = table && quantity ? tierPriceCents(table, quantity) : 0;
    var plan = atual ? tierPlan(table, quantity) : null;
    var upgrade;

    if (!plan || isCustomArtworkSelected(product) || isAssortedSelected(product)) {
      return "";
    }

    upgrade = tierUpgrade(product, table, quantity, atual);

    return [
      '<section class="pack-combination" aria-label="Como o total é composto">',
      '<p class="pack-combination-title">Para ' + escapeHtml(packCombinationQuantityLabel(product, quantity)) + ', o preço é este:</p>',
      '<ul class="pack-combination-list">',
      '<li><span>1 pack de ' + plan.tier + '</span><strong>' + escapeHtml(formatCents(plan.tierCents)) + '</strong></li>',
      plan.extra > 0
        ? '<li><span>' + escapeHtml(packCombinationQuantityLabel(product, plan.extra))
          + ' ao preço do pack</span><strong>' + escapeHtml(formatCents(plan.extraCents)) + '</strong></li>'
        : "",
      '</ul>',
      '<p class="pack-combination-total"><span>Total</span><strong>' + escapeHtml(formatCents(plan.cents)) + '</strong></p>',
      upgrade
        ? '<p class="pack-combination-upgrade">No entanto, se comprares 1 pack de ' + upgrade.quantity
        + ', consegues ' + escapeHtml(packCombinationQuantityLabel(product, upgrade.quantity))
        + ' por <strong>' + escapeHtml(formatCents(upgrade.cents)) + '</strong>'
        + ' — poupas ' + escapeHtml(formatCents(upgrade.saving))
        + ', e consegues ' + escapeHtml(packCombinationQuantityLabel(product, upgrade.quantity - quantity))
        + ' extra.</p>'
        : "",
      '</section>'
    ].join("");
  }

  function renderPackCombinationSummary(product) {
    if (usesTierUnitPricing(product)) {
      return renderTierUpgradeSummary(product);
    }

    var table = packCombinationTableFor(product);
    var quantity = getPackQuantity(product);
    var plan = table ? packCombinationPlan(
      table,
      quantity,
      packCombinationPrefersFewerPacks(product)
    ) : null;
    var upgrade;

    if (!plan || isCustomArtworkSelected(product) || isAssortedSelected(product)) {
      return "";
    }

    upgrade = packCombinationUpgrade(product, table, quantity, plan.cents);

    return [
      '<section class="pack-combination" aria-label="Como o total é composto">',
      '<p class="pack-combination-title">Para ' + escapeHtml(packCombinationQuantityLabel(product, quantity)) + ', o melhor conjunto de packs é este:</p>',
      '<ul class="pack-combination-list">',
      plan.parts.map(function (part) {
        var etiqueta = part.quantity === 1
          ? part.count + " " + (part.count === 1 ? productUnitSingular(product) : productUnit(product))
          : part.count + (part.count === 1 ? " pack de " : " packs de ") + part.quantity;
        return '<li><span>' + escapeHtml(etiqueta) + '</span><strong>' + escapeHtml(formatCents(part.cents)) + '</strong></li>';
      }).join(""),
      '</ul>',
      '<p class="pack-combination-total"><span>Total</span><strong>' + escapeHtml(formatCents(plan.cents)) + '</strong></p>',
      upgrade && upgrade.plan
        ? '<p class="pack-combination-upgrade">No entanto, se comprares '
          + escapeHtml(packCombinationSummaryParts(upgrade.plan, product).join(" + "))
          + ', consegues ' + escapeHtml(packCombinationQuantityLabel(product, upgrade.quantity))
          + ' por <strong>' + escapeHtml(formatCents(upgrade.cents)) + '</strong>'
          + ' — poupas ' + escapeHtml(formatCents(upgrade.saving))
          + (packCombinationUsesNextPackUpgrade(product) ? ' e consegues ' : ', e consegues ')
          + escapeHtml(packCombinationQuantityLabel(product, upgrade.quantity - quantity))
          + ' extra.</p>'
        : "",
      '</section>'
    ].join("");
  }

  function setFreeQuantity(product, value, mode, trackSelection, direction) {
    var minimum = effectiveMinimumFreeQuantity(product);
    var maximum = maximumFreeQuantity(product);
    var quantity = Math.round(Number(value) || 0);

    quantity = Math.max(minimum, Math.min(maximum, quantity || minimum));
    // Com packs combinados só existem certas quantidades; encosta-se à mais
    // próxima em vez de aceitar uma que não tem preço.
    quantity = snapQuantityToPacks(product, quantity, direction || 0);
    state.selections.pack_quantity = quantity;
    state.selections.free_quantity_mode = mode === "pack"
      ? "pack"
      : freeQuantityModeForValue(product, quantity);
    state.quantitySignature = "";
    state.quantitiesTouched = false;
    state.quantityPackBaseline = 0;
    state.errors = "";
    ensurePackAndQuantities(product);
    if (trackSelection !== false) {
      try { trackOptionSelected(product, "quantity", quantity, productQuantityLabel(product, quantity)); } catch (e) {}
    }
    return quantity;
  }

  // O refresh parcial do slider não volta a desenhar a grelha de packs, por isso
  // os vistos do conjunto são acertados à mão, do mesmo modo que a selecção.
  function applyPackCombinationMarks(button, marks) {
    var alvo = button.querySelector(".pack-option-marks");
    var vistos = "";
    var i;

    button.classList.toggle("is-in-combination", marks > 0);

    if (!marks) {
      if (alvo) {
        alvo.remove();
      }
      return;
    }

    for (i = 0; i < marks; i += 1) {
      vistos += "<i>✓</i>";
    }
    if (!alvo) {
      alvo = document.createElement("span");
      alvo.className = "pack-option-marks";
      alvo.setAttribute("aria-hidden", "true");
      button.appendChild(alvo);
    }
    alvo.innerHTML = vistos;
  }

  function refreshFreeQuantityDraft(product, input) {
    var builder = input && input.closest ? input.closest(".free-quantity-builder") : null;
    var overview = builder && builder.nextElementSibling && builder.nextElementSibling.matches(".pack-price-overview")
      ? builder.nextElementSibling
      : null;
    var wrapper;
    var nextOverview;
    var quantity = getPackQuantity(product);
    var minimum = effectiveMinimumFreeQuantity(product);
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
      var combinationCounts = packCombinationCounts(product);
      packControl.querySelectorAll(".pack-option").forEach(function (button) {
        var selected = freeQuantitySelectionMode(product) === "pack"
          && Number(button.dataset.packQuantity) === quantity;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
        applyPackCombinationMarks(button, combinationCounts[Number(button.dataset.packQuantity)] || 0);
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

    refreshPackCombinationSummary(product);
    refreshQuantityDistribution(product);
    freeQuantityChartRefresh();
  }

  // Também fica de fora do refresh parcial do slider, e é onde está o total.
  function refreshPackCombinationSummary(product) {
    var atual = document.querySelector(".pack-combination");
    var markup = renderPackCombinationSummary(product);
    var ancora = document.querySelector(".pack-price-overview")
      || document.querySelector(".free-quantity-builder");
    var wrapper;
    var proximo;

    if (!markup) {
      if (atual) {
        atual.remove();
      }
      return;
    }

    wrapper = document.createElement("div");
    wrapper.innerHTML = markup;
    proximo = wrapper.firstElementChild;
    if (!proximo) {
      return;
    }

    // No modo escalão a caixa só existe quando há poupança a apontar, por isso
    // pode ser preciso criá-la a meio do arrastar do slider.
    if (atual) {
      atual.replaceWith(proximo);
    } else if (ancora) {
      ancora.insertAdjacentElement("afterend", proximo);
    }
  }

  // Arrastar o slider do total só faz refresh parcial, por isso o bloco de
  // ajuste por design tem de ser redesenhado à parte (as quantidades voltam à
  // divisão automática sempre que o total muda).
  function refreshQuantityDistribution(product) {
    var current = document.querySelector("[data-quantity-distribution]");
    var markup = renderQuantityDistribution(product);
    var wrapper;
    var next;

    if (!current) {
      return;
    }

    if (!markup) {
      current.remove();
      return;
    }

    wrapper = document.createElement("div");
    wrapper.innerHTML = markup;
    next = wrapper.firstElementChild;

    if (next) {
      current.replaceWith(next);
      bindQuantityDistributionEvents(product);
    }
  }

  function bindQuantityDistributionEvents(product) {
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
  }

  function renderDesignQuantityCards(product, items) {
    var designsStep = findStep(product, "designs");
    var cards = "";

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
        renderVisual(item, "design-grid", designsStep),
        '<span class="quantity-badge">x' + quantity + '</span>',
        '</div>',
        '</div>',
        '<div class="quantity-main">',
        '<div>',
        '<strong>' + escapeHtml(displayItemTitle(item)) + '</strong>',
        '<span>' + escapeHtml(item.subtitle) + '</span>',
        '</div>',
        renderPinStack(item, quantity, designsStep),
        controls,
        '</div>',
        '</article>'
      ].join("");
    });

    return cards;
  }

  // Ajuste opcional por design dentro do total livre: o total manda, e cada
  // design começa com a divisão automática. Só aparece quando o passo do pack
  // pede `adjustPerDesign` e há mais do que um design escolhido, para os
  // produtos antigos (crachás, ímanes, mini-cadernos) ficarem como estavam.
  function packAdjustsPerDesign(product) {
    var packStep = findStep(product, "pack");

    return !!(packStep && packStep.adjustPerDesign === true);
  }

  // A dica vem do passo do pack quando o produto a define (produtos antigos);
  // nos novos é montada com o nome da unidade, para não haver produto sem ela.
  function packAdjustHint(product) {
    var packStep = findStep(product, "pack");

    if (packStep && packStep.adjustHint) {
      return packStep.adjustHint;
    }
    return "Se quiseres também podes ajustar a quantidade de cada "
      + productUnitSingular(product) + " individualmente";
  }

  function renderQuantityDistribution(product) {
    var items = selectedDesignItems(product);

    // Os cartões dos designs aparecem sempre que há designs escolhidos, como no
    // fluxo antigo: com um só design mostram a quantidade, sem controlos, porque
    // não há para onde mover. A dica e o "Distribuir por igual" só fazem sentido
    // a partir de dois.
    if (!packAdjustsPerDesign(product)
      || !items.length
      || isAssortedSelected(product)
      || isCustomArtworkSelected(product)) {
      return "";
    }

    return [
      '<div class="quantity-distribution" data-quantity-distribution>',
      items.length > 1 ? '<p class="quantity-adjust-hint">' + escapeHtml(packAdjustHint(product)) + '</p>' : "",
      '<div class="quantity-grid">',
      renderDesignQuantityCards(product, items),
      '</div>',
      renderQuantityStatus(product),
      renderUnassignedPins(product),
      items.length >= 2 ? '<button class="auto-distribute" type="button" data-auto-distribute>Distribuir por igual</button>' : "",
      '</div>'
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

    cards = renderDesignQuantityCards(product, items);

    return [
      renderPackSelector(product),
      renderPackPriceOverview(product),
      items.length > 1 && adjustHint ? '<p class="quantity-adjust-hint">' + escapeHtml(adjustHint) + '</p>' : "",
      '<div class="quantity-grid">',
      cards,
      '</div>',
      renderQuantityStatus(product),
      renderUnassignedPins(product),
      items.length >= 2 ? '<button class="auto-distribute" type="button" data-auto-distribute>Distribuir por igual</button>' : ""
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

    return renderDesignActionControls(product, step)
      + html
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
    var selectedOption;
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

    selectedOption = selectedCadernoPurchaseOption(product);

    return [
      '<div class="option-list size-choice-list crachas-size-card-list cadernos-purchase-list">' + html + '</div>',
      selectedOption && !isCustomArtworkSelected(product) ? renderCadernoOrderQuantitySelector(product, step, cadernoOrderQuantity(product)) : "",
      promo ? '<p class="cadernos-info-note cadernos-info-note--promo" role="note">' + renderInlineText(promo) + '</p>' : "",
      state.admin ? '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar opção</button>' : ""
    ].join("");
  }

  function renderCadernoOrderQuantitySelector(product, step, selectedQuantity) {
    var config = cadernoOrderQuantityConfig(product);
    var minimum;
    var maximum;
    var selectedOption;
    var selectedLabel;

    if (isMainCatalogProduct(product)) {
      minimum = Math.max(1, parseInt(config.minimum, 10) || parseInt(product && product.minimumQuantity, 10) || 1);
      maximum = Math.max(minimum, parseInt(config.maximum, 10) || 9999);
      selectedOption = selectedCadernoPurchaseOption(product);
      selectedLabel = selectedOption && selectedOption.isPack
        ? (selectedQuantity === 1 ? "pack" : "packs")
        : (selectedQuantity === 1 ? productUnitSingular(product) : productUnit(product));

      return [
        '<section class="cadernos-order-quantity" aria-label="' + escapeHtml(config.title || "Quantidade") + '">',
        '<div class="cadernos-order-quantity-copy">',
        '<strong>' + escapeHtml(config.title || "Quantidade") + '</strong>',
        config.text ? '<span>' + escapeHtml(config.text) + '</span>' : "",
        '</div>',
        '<div class="cadernos-order-quantity-control">',
        '<button type="button" data-caderno-order-quantity-change="-1" aria-label="Retirar uma unidade"' + (selectedQuantity <= minimum ? ' disabled' : '') + '>&minus;</button>',
        '<label><span>Quantidade</span><input type="number" min="' + minimum + '" max="' + maximum + '" step="1" value="' + selectedQuantity + '" data-caderno-order-quantity-input></label>',
        '<button type="button" data-caderno-order-quantity-change="1" aria-label="Acrescentar uma unidade"' + (selectedQuantity >= maximum ? ' disabled' : '') + '>+</button>',
        '<small>' + escapeHtml(selectedLabel) + '</small>',
        '</div>',
        '</section>'
      ].join("");
    }

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

  function renderQuadrosBuildSummary(product, step) {
    var design = selectedDesignItems(product)[0];
    var frameStep;
    var info;
    var tiles = "";

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
      ["Tamanho:", selectedSizeLabel(product)],
      ["Preço do produto:", priceLine],
      ["Portes:", shippingLine],
      [totalLabel, totalLine],
      ["Entrega:", deliveryText]
    ];

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

    if (step.template === "original-artwork-upload") {
      return renderOriginalArtworkUploadStep(product, step);
    }

    if (step.template === "custom-product-builder") {
      return renderCustomProductBuilderStep(product, step);
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
    if (mapped) {
      return mapped;
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
      cartEntry ? renderCartEntryActions(product) : [
      '<div class="step-actions">',
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

    if (step.id === "designs" && isQuadrosProduct(state.product) && state.selections.designs && state.selections.designs !== input.value) {
      (state.product.steps || []).filter(function (candidate) {
        return candidate && candidate.template === "palette-grid";
      }).forEach(function (colorStep) {
        var keys = quadrosColorSelectionKeys(colorStep);
        delete state.selections[keys.colors];
        delete state.selections[keys.palette];
        delete state.selections[keys.mia];
        delete state.selections[keys.tones];
      });
      delete state.selections.colors;
      delete state.selections.color_palette;
      delete state.selections.mia_choose_colors;
      delete state.selections.quadro_color_mode;
      delete state.selections.quadro_color_tones;
      state.paletteColorSlots = [];
      state.quadroActiveColorSlot = 0;
      state.quadroToneEdit = null;
      state.quadroColorUi = {};
      resetQuadrosPhotoColorAnalysis();
      delete state.selections.photo_orientation;
      delete state.selections.photo_help;
      delete state.selections.silhouette;
      delete state.selections.quadro_text;
      delete state.selections.quadro_description;
      delete state.selections.no_phrase;
      delete state.selections.quadro_super_example;
      delete state.selections.heart_finish;
      delete state.selections.frame_size;
      delete state.selections.heart_background_colors;
      delete state.selections.heart_background_color_tones;
      delete state.selections.heart_background_palette;
      delete state.selections.mia_choose_heart_background_colors;
      delete state.selections.quadro_dedication;
      delete state.selections.no_dedication;
      delete state.selections.quadro_silhouette_description;
      delete state.selections.silhouette_contact_me;
      delete state.selections.quadro_silhouette_text;
      delete state.selections.no_silhouette_text;
      delete state.selections.no_text;
      delete state.selections.baby_animal;
      delete state.selections.baby_custom_animal;
      delete state.selections.baby_gender;
      delete state.selections.baby_name;
      delete state.selections.baby_birth_date;
      delete state.selections.baby_birth_time;
      delete state.selections.baby_birth_weight;
      state.orderUploadMessage = "";
      state.orderUploadError = "";
      state.invalidFields = [];
    }

    state.selections[step.id] = input.value;
    if (Array.isArray(step.resetSelectionKeys)) {
      step.resetSelectionKeys.forEach(function (key) {
        delete state.selections[String(key)];
      });
    }
    if (Array.isArray(step.resetColorSteps)) {
      step.resetColorSteps.forEach(function (stepId) {
        var colorStep = findStep(state.product, String(stepId));
        if (colorStep) {
          quadrosResetColorUi(colorStep);
        }
      });
    }
    if (step.selection === "single") {
      var selectedDesign = (step.items || []).filter(function (item) {
        return item && item.value === input.value;
      })[0] || null;
      var defaults = selectedDesign && selectedDesign.defaultSelections && typeof selectedDesign.defaultSelections === "object"
        ? selectedDesign.defaultSelections
        : {};

      Object.keys(defaults).forEach(function (key) {
        state.selections[key] = cloneJson(defaults[key]);
      });
    }
    if (step.id === "size" && freeQuantityStep(state.product)) {
      var currentFreeQuantity = parseInt(state.selections.pack_quantity, 10) || 0;
      state.selections.pack_quantity = isMainCatalogProduct(state.product) && usesFlatUnitPricing(state.product)
        ? Math.max(effectiveMinimumFreeQuantity(state.product), currentFreeQuantity)
        : minimumFreeQuantity(state.product);
      delete state.selections.free_quantity_mode;
      state.quantitySignature = "";
      state.quantitiesTouched = false;
      state.quantityPackBaseline = 0;
      ensurePackAndQuantities(state.product);
    }
    if (step.id === "baby_animal" && input.value !== "Outro animal") {
      delete state.selections.baby_custom_animal;
    }
  }

  function detailsStepHasAnyInput(step) {
    var fields = step && Array.isArray(step.fields) ? step.fields : [];
    var attachments = step && step.mediaAttachments ? step.mediaAttachments : {};
    var configs = [attachments.photos, attachments.audio].filter(Boolean);
    var hasFieldValue = fields.some(function (field) {
      return field && String(state.selections[field.name] || "").trim();
    });

    if (step && step.skipOption && step.skipOption.selectionKey && state.selections[step.skipOption.selectionKey]) {
      return true;
    }

    if (step && step.selectableExamples === true && String(state.selections[step.exampleSelectionKey || "details_example"] || "").trim()) {
      return true;
    }

    if (hasFieldValue) {
      return true;
    }

    return configs.some(function (config) {
      var key = config.selectionKey || (config === attachments.audio ? "quadro_audio_uploads" : "quadro_reference_uploads");
      return orderUploadItems(key).length > 0;
    });
  }

  function orderStepHasMediaControls(step) {
    var attachments = step && step.mediaAttachments ? step.mediaAttachments : null;
    return !!(step && (
      step.template === "photo-upload" ||
      step.template === "original-artwork-upload" ||
      (attachments && (attachments.photos || attachments.audio))
    ));
  }

  function validateStep(product, step) {
    var field;
    var i;
    var missing = [];
    var total;
    var packQuantity;

    state.invalidFields = [];

    if (orderStepHasMediaControls(step) && (state.orderUploadBusy || orderAudioPendingStart || state.orderAudioRecording)) {
      return state.orderAudioRecording ? "Solta o botão do áudio para terminar a gravação." : "Espera até o anexo terminar de enviar.";
    }

    if (step.id === "designs" && selectedDesignItems(product).length === 0 && !isAssortedSelected(product) && !isCustomArtworkSelected(product)) {
      if (isQuadrosProduct(product)) {
        return "Escolhe o tipo de moldura que queres criar.";
      }
      if (isCadernosProduct(product)) {
        return "Escolhe uma capa.";
      }
      return "Escolhe pelo menos um design ou a opção Sortido";
    }

    if (step.template === "custom-product-builder") {
      return validateBuilderStep(product);
    }

    if (step.template === "original-artwork-upload") {
      var customConfig = customArtworkConfig(product);
      var customItems = orderUploadItems(customConfig.uploadKey);
      if (state.orderUploadBusy) {
        return "Espera até todos os ficheiros terminarem de enviar.";
      }
      if (!customItems.length) {
        state.invalidFields = [customConfig.uploadKey];
        return "Carrega pelo menos uma imagem ou um PDF para continuar.";
      }
      // No construtor a quantidade e o minimo pertencem a cada linha do passo
      // seguinte, que sabe qual e a tabela de precos de cada produto.
      if (isArtworkBuilderProduct(product)) {
        return "";
      }
      if (customItems.some(function (item) { return customArtworkItemQuantity(item) < 1; })) {
        state.invalidFields = [customConfig.uploadKey];
        return "Indica uma quantidade válida para cada design.";
      }
      if (!isCadernosProduct(product)) {
        // O total vem dos ficheiros, mas o mínimo do produto continua a valer:
        // abaixo do primeiro escalão não há preço, e o servidor recusaria.
        var minimoCustom = effectiveMinimumFreeQuantity(product);
        if (customArtworkTotalQuantity(product) < minimoCustom) {
          state.invalidFields = [customConfig.uploadKey];
          return "A encomenda mínima é de " + productQuantityLabel(product, minimoCustom) + ".";
        }
        state.selections.pack_quantity = customArtworkTotalQuantity(product);
      }
      return "";
    }

    if (isCadernosProduct(product) && step.id === "pack") {
      if (!selectedCadernoPurchaseOption(product)) {
        return "Escolhe uma opção de compra.";
      }
      if ((isMainCatalogProduct(product) && cadernoOrderQuantity(product) < 1)
          || (!isMainCatalogProduct(product) && cadernoOrderQuantityOptions(product).indexOf(cadernoOrderQuantity(product)) === -1)) {
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
      if (step.freeQuantity === true) {
        ensurePackAndQuantities(product);
        packQuantity = getPackQuantity(product);
        if (!packQuantity) {
          return "Indica uma quantidade válida (mínimo " + effectiveMinimumFreeQuantity(product) + ").";
        }
        if (!isCustomArtworkSelected(product)
            && !isAssortedSelected(product)
            && selectedDesignItems(product).length
            && quantityTotal(product) !== packQuantity) {
          return "Confirma a quantidade atribuída a cada design.";
        }
        return "";
      }
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

    if (step.template === "palette-grid") {
      var colorKeys = quadrosColorSelectionKeys(step);
      if (state.selections[colorKeys.mia]) {
        return "";
      }
      var selectionLimit = paletteSelectionLimit(step);
      var selectedPalette = String(state.selections[colorKeys.palette] || "");
      var validPalette = (step.items || []).some(function (item) {
        return item && item.value === selectedPalette && paletteColors(item, selectionLimit).length === selectionLimit;
      });
      var individualValues = Array.isArray(state.selections[colorKeys.colors]) ? state.selections[colorKeys.colors] : [];
      var individualTones = Array.isArray(state.selections[colorKeys.tones]) ? state.selections[colorKeys.tones] : [];
      var allowedIndividualValues = (step.individualColors || []).map(function (item) { return item.value; });
      var validIndividuals = individualValues.length === selectionLimit && individualValues.every(function (value) {
        return allowedIndividualValues.indexOf(value) !== -1;
      });

      if (step.tonePicker === true && validIndividuals) {
        var exactPairs = {};
        validIndividuals = individualTones.length >= selectionLimit && individualValues.every(function (value, index) {
          var tone = Number(individualTones[index]);
          var pair = value + "\u0000" + tone;
          if (!Number.isInteger(tone) || tone < 0 || tone > 2 || exactPairs[pair]) {
            return false;
          }
          exactPairs[pair] = true;
          return true;
        });
      }

      if (!validPalette && !validIndividuals) {
        return step.selectionError || "Escolhe uma combinação ou exatamente " + (selectionLimit === 1 ? "uma cor" : selectionLimit === 2 ? "duas cores" : selectionLimit === 3 ? "três cores" : selectionLimit + " cores") + ".";
      }
      return "";
    }

    if (step.selection === "multi" && step.minSelections != null && selectedValues(step).length < Number(step.minSelections)) {
      return step.selectionError || "Escolhe mais opções para continuar.";
    }

    if (step.selection === "multi" && step.maxSelections != null && selectedValues(step).length > Number(step.maxSelections)) {
      return step.selectionError || "Escolheste opções a mais.";
    }

    if (step.selection === "single" && !state.selections[step.id]) {
      return "Escolhe uma opção.";
    }

    if (step.template === "details-form" || step.template === "photo-upload") {
      var stepFields = Array.isArray(step.fields) ? step.fields : [];
      for (i = 0; i < stepFields.length; i += 1) {
        field = stepFields[i];
        if (field.required && !String(state.selections[field.name] || "").trim()) {
          missing.push(field.name);
        }
        if (field.maxLength && String(state.selections[field.name] || "").length > Number(field.maxLength)) {
          state.invalidFields = [field.name];
          return field.maxLengthError || "O texto é demasiado longo.";
        }
      }

      if (missing.length) {
        state.invalidFields = missing;
        return "Preenche os campos obrigatórios.";
      }

      if (step.requireAnyInput && !detailsStepHasAnyInput(step)) {
        state.invalidFields = stepFields.length && stepFields[0].name ? [stepFields[0].name] : [];
        return step.requireAnyInputError || "Escreve uma mensagem, grava um áudio ou envia uma foto.";
      }
    }

    if (step.template === "photo-upload") {
      var uploadConfig = step.upload || {};
      var uploadKey = uploadConfig.selectionKey || "quadro_uploads";
      var uploadedItems = orderUploadItems(uploadKey);

      if (state.orderUploadBusy) {
        return "Espera até a foto terminar de enviar.";
      }
      if (uploadConfig.requiredUnlessHelp && uploadedItems.length === 0 && !state.selections[uploadConfig.helpKey || "photo_help"]) {
        state.invalidFields = [uploadKey];
        return "Escolhe uma foto ou assinala que precisas de ajuda para a enviar.";
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

      if (!validNifInput(state.selections.customer_nif)) {
        state.invalidFields = ["customer_nif"];
        return "O NIF deve ter 9 dígitos.";
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
    state.orderUploadMessage = "";
    state.orderUploadFeedbackKind = "";
    setCurrentStep(product, state.currentStep + 1);
    pushWizardHistory(product);
    rerenderProduct(product);
  }

  function orderPhotoFileIsSupported(file, allowPdf) {
    var type = String(file && file.type || "").toLowerCase();
    var name = String(file && file.name || "").toLowerCase();
    if (allowPdf && (type === "application/pdf" || /\.pdf$/.test(name))) {
      return true;
    }
    return /^image\/(?:jpeg|png|webp|heic|heif)$/.test(type) || /\.(?:jpe?g|png|webp|heic|heif)$/.test(name);
  }

  function orderMediaConfigForStep(step, key, kind) {
    var direct = step && step.upload ? step.upload : null;
    var attachments = step && step.mediaAttachments ? step.mediaAttachments : {};
    var candidate = kind === "audio" ? attachments.audio : attachments.photos;
    if (direct && (direct.selectionKey || "quadro_uploads") === key) {
      return direct;
    }
    return candidate || {};
  }

  function loadOrderPhotoImage(file) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      var url = URL.createObjectURL(file);
      image.onload = function () {
        resolve({ image: image, url: url, width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("decode"));
      };
      image.src = url;
    });
  }

  function orderCanvasBlob(canvas, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("encode"));
        }
      }, "image/webp", quality);
    });
  }

  function compressOrderPhotoCanvas(canvas, targetBytes) {
    var qualities = [0.78, 0.62, 0.48];

    function tryQuality(index) {
      return orderCanvasBlob(canvas, qualities[index]).then(function (blob) {
        if (blob.size <= targetBytes) {
          return { blob: blob, width: canvas.width, height: canvas.height };
        }
        if (index < qualities.length - 1) {
          return tryQuality(index + 1);
        }

        var width = Math.max(1, Math.round(canvas.width * 0.75));
        var height = Math.max(1, Math.round(canvas.height * 0.75));
        if (Math.max(width, height) < 900) {
          throw new Error("encode");
        }
        var smaller = document.createElement("canvas");
        var smallerContext;
        smaller.width = width;
        smaller.height = height;
        smallerContext = smaller.getContext("2d", { alpha: false });
        smallerContext.fillStyle = "#ffffff";
        smallerContext.fillRect(0, 0, width, height);
        smallerContext.drawImage(canvas, 0, 0, width, height);
        canvas.width = 1;
        canvas.height = 1;
        canvas = smaller;
        return tryQuality(0);
      });
    }

    return tryQuality(0);
  }

  function prepareOrderPhoto(file) {
    var targetBytes = Math.floor(1.5 * 1024 * 1024);
    var maxDimension = 3200;

    return loadOrderPhotoImage(file).then(function (loaded) {
      var longest = Math.max(loaded.width, loaded.height);
      if (file.size <= targetBytes && longest <= 4096) {
        URL.revokeObjectURL(loaded.url);
        return { file: file, width: loaded.width, height: loaded.height };
      }

      var scale = Math.min(1, maxDimension / Math.max(1, longest));
      var width = Math.max(1, Math.round(loaded.width * scale));
      var height = Math.max(1, Math.round(loaded.height * scale));
      var canvas = document.createElement("canvas");
      var context;
      var stem = String(file.name || "foto").replace(/\.[^.]+$/, "");

      canvas.width = width;
      canvas.height = height;
      context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(loaded.image, 0, 0, width, height);
      URL.revokeObjectURL(loaded.url);

      return compressOrderPhotoCanvas(canvas, targetBytes).then(function (result) {
        var prepared = new File([result.blob], stem + "-web.webp", { type: "image/webp", lastModified: Date.now() });
        return { file: prepared, width: result.width, height: result.height };
      });
    }).catch(function () {
      if (file.size <= targetBytes) {
        return { file: file, width: 0, height: 0 };
      }
      throw new Error("Não foi possível preparar esta foto. Tenta escolhê-la novamente.");
    });
  }

  function uploadOrderMediaFile(prepared, kind, operation, config) {
    var formData = new FormData();
    var file = prepared.file;
    formData.append("media[]", file, file.name || (kind === "audio" ? "audio.webm" : "foto"));
    formData.append("kind", kind);
    if (config && config.purpose) {
      formData.append("purpose", String(config.purpose));
    }
    if (prepared.width) {
      formData.append("width", prepared.width);
      formData.append("height", prepared.height);
    }

    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      var startedAt = Date.now();
      var settled = false;

      function finish(callback, value) {
        if (settled) {
          return;
        }
        settled = true;
        if (operation && operation.xhr === xhr) {
          operation.xhr = null;
        }
        callback(value);
      }

      xhr.open("POST", ORDER_UPLOAD_API, true);
      xhr.withCredentials = true;
      xhr.setRequestHeader("Accept", "application/json");
      if (operation) {
        operation.xhr = xhr;
      }

      xhr.upload.addEventListener("progress", function (event) {
        if (!event.lengthComputable || !operation || !orderUploadOperationIsActive(operation)) {
          return;
        }
        var elapsed = Math.max(0.25, (Date.now() - startedAt) / 1000);
        var speed = event.loaded / elapsed;
        state.orderUploadProgress = {
          operationId: operation.id,
          phase: "upload",
          percent: event.total ? event.loaded / event.total * 100 : 0,
          speed: speed,
          eta: speed > 0 ? Math.max(0, event.total - event.loaded) / speed : 0,
          fileIndex: operation.fileIndex || 1,
          fileCount: operation.fileCount || 1
        };
        updateOrderUploadProgressDom();
      });

      xhr.addEventListener("load", function () {
        var payload = {};
        try {
          payload = JSON.parse(xhr.responseText || "{}");
        } catch (error) {}
        if (xhr.status < 200 || xhr.status >= 300 || !payload.ok
            || !Array.isArray(payload.uploads) || !payload.uploads[0]) {
          finish(reject, new Error(payload.message || "Não foi possível enviar o ficheiro."));
          return;
        }
        finish(resolve, payload.uploads[0]);
      });
      xhr.addEventListener("error", function () {
        finish(reject, new Error("Não foi possível enviar o ficheiro."));
      });
      xhr.addEventListener("abort", function () {
        finish(reject, orderUploadCanceledError());
      });
      xhr.send(formData);
    });
  }

  function syncOrderUploadBusy() {
    state.orderUploadBusy = orderUploadOperations.length > 0;
  }

  function orderUploadOperationIsActive(operation) {
    return !!operation && !operation.finished && orderUploadOperations.indexOf(operation) !== -1;
  }

  function beginOrderUploadOperation(type, stepId) {
    var operation = {
      id: orderUploadNextOperationId,
      type: type || "request",
      stepId: String(stepId || ""),
      controller: typeof window.AbortController === "function" ? new window.AbortController() : null,
      xhr: null,
      timeoutId: 0,
      rejectPending: null,
      canceled: false,
      finished: false
    };

    orderUploadNextOperationId += 1;
    orderUploadOperations.push(operation);
    syncOrderUploadBusy();
    return operation;
  }

  function endOrderUploadOperation(operation) {
    if (!operation || operation.finished) {
      return;
    }

    operation.finished = true;
    if (operation.timeoutId) {
      window.clearTimeout(operation.timeoutId);
      operation.timeoutId = 0;
    }
    operation.rejectPending = null;
    orderUploadOperations = orderUploadOperations.filter(function (candidate) {
      return candidate !== operation;
    });
    syncOrderUploadBusy();
    if (state.orderUploadProgress && state.orderUploadProgress.operationId === operation.id
        && !orderUploadOperations.some(function (candidate) { return candidate.type === "upload"; })) {
      state.orderUploadProgress = null;
    }
  }

  function orderUploadCanceledError() {
    var error = new Error("Operação cancelada.");
    error.name = "AbortError";
    return error;
  }

  function cancelOrderUploadOperation(operation) {
    var rejectPending;

    if (!orderUploadOperationIsActive(operation)) {
      return;
    }

    operation.canceled = true;
    rejectPending = operation.rejectPending;
    if (operation.controller) {
      try {
        operation.controller.abort();
      } catch (error) {}
    }
    if (operation.xhr) {
      try {
        operation.xhr.abort();
      } catch (error) {}
      operation.xhr = null;
    }
    if (rejectPending) {
      rejectPending(orderUploadCanceledError());
    }
    endOrderUploadOperation(operation);
  }

  function cancelOrderUploadOperations(predicate) {
    orderUploadOperations.slice().forEach(function (operation) {
      if (!predicate || predicate(operation)) {
        cancelOrderUploadOperation(operation);
      }
    });
  }

  function withOrderUploadTimeout(promise, operation, timeoutMs, message) {
    if (!orderUploadOperationIsActive(operation)) {
      return Promise.reject(orderUploadCanceledError());
    }

    return new Promise(function (resolve, reject) {
      var settled = false;

      function settle(callback, value) {
        if (settled) {
          return;
        }
        settled = true;
        if (operation.timeoutId) {
          window.clearTimeout(operation.timeoutId);
          operation.timeoutId = 0;
        }
        operation.rejectPending = null;
        callback(value);
      }

      operation.rejectPending = function (error) {
        settle(reject, error || orderUploadCanceledError());
      };
      operation.timeoutId = window.setTimeout(function () {
        if (!orderUploadOperationIsActive(operation)) {
          return;
        }
        if (operation.controller) {
          try {
            operation.controller.abort();
          } catch (error) {}
        }
        if (operation.xhr) {
          try {
            operation.xhr.abort();
          } catch (error) {}
          operation.xhr = null;
        }
        settle(reject, new Error(message));
      }, timeoutMs);

      Promise.resolve(promise).then(function (value) {
        settle(resolve, value);
      }, function (error) {
        settle(reject, error);
      });
    });
  }

  function beginOrderFilePickerSession(input, step) {
    if (orderActiveFilePicker && orderActiveFilePicker.input && orderActiveFilePicker.input !== input) {
      orderActiveFilePicker.input.value = "";
    }

    orderFilePickerRevision += 1;
    if (input) {
      input.value = "";
    }
    orderActiveFilePicker = {
      input: input,
      stepId: String(step && step.id || ""),
      revision: orderFilePickerRevision
    };
    return orderActiveFilePicker;
  }

  function invalidateOrderFilePickerSession(input) {
    orderFilePickerRevision += 1;
    if (orderActiveFilePicker && orderActiveFilePicker.input) {
      orderActiveFilePicker.input.value = "";
    }
    if (input && (!orderActiveFilePicker || orderActiveFilePicker.input !== input)) {
      input.value = "";
    }
    orderActiveFilePicker = null;
  }

  function cancelOrderAudioActivity() {
    var recorder = orderAudioRecorder;

    orderAudioPointerHeld = false;
    orderAudioPendingStart = false;
    orderAudioContext = null;
    state.orderAudioRecording = false;
    orderAudioRecorder = null;
    orderAudioChunks = [];
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch (error) {}
    }
    stopOrderAudioTracks();
  }

  function cancelOrderMediaActivityForStep(step) {
    var stepId = String(step && step.id || "");

    invalidateOrderFilePickerSession();
    cancelOrderUploadOperations(function (operation) {
      return operation.type === "upload" && (!operation.stepId || !stepId || operation.stepId === stepId);
    });
    if (orderStepHasMediaControls(step)) {
      cancelOrderAudioActivity();
    }
  }

  function startOrderMediaUpload(product, config, files, kind, stepId) {
    var key = config.selectionKey || (kind === "audio" ? "quadro_audio_uploads" : "quadro_uploads");
    var maxFiles = orderUploadMaxFiles(config);
    var existing = orderUploadItems(key);
    var candidates = Array.prototype.slice.call(files || []).filter(function (file) {
      return file && Number(file.size) > 0;
    });
    var remaining = isFinite(maxFiles) ? Math.max(0, maxFiles - (config.multiple === true ? existing.length : 0)) : candidates.length;
    var selected = candidates.slice(0, remaining || (config.multiple === true ? 0 : 1));
    var uploads = [];
    var chain = Promise.resolve();
    var operation;

    if (!selected.length) {
      return;
    }
    state.orderUploadError = "";
    state.orderUploadMessage = "";
    state.orderUploadFeedbackKind = kind;
    if ((kind === "photo" || kind === "artwork") && selected.some(function (file) { return !orderPhotoFileIsSupported(file, config.allowPdf === true); })) {
      state.orderUploadError = config.allowPdf === true
        ? "Escolhe imagens JPG, PNG, WebP ou HEIC, ou ficheiros PDF."
        : "Escolhe fotos JPG, PNG, WebP ou HEIC.";
      rerenderProduct(product);
      return;
    }

    operation = beginOrderUploadOperation("upload", stepId);
    if (kind === "artwork") {
      try {
        trackProductEvent(product, "artwork_upload_started", {
          file_count: selected.length,
          file_kind: selected.some(function (file) { return String(file.type || "").toLowerCase() === "application/pdf" || /\.pdf$/i.test(String(file.name || "")); }) ? "pdf-or-image" : "image"
        });
      } catch (e) {}
    }
    operation.fileCount = selected.length;
    operation.fileIndex = 1;
    state.orderUploadProgress = {
      operationId: operation.id,
      phase: "preparing",
      percent: 0,
      speed: 0,
      eta: 0,
      fileIndex: 1,
      fileCount: selected.length
    };
    state.errors = "";
    rerenderProduct(product);

    selected.forEach(function (file, fileIndex) {
      chain = chain.then(function () {
        var preparation;
        if (!orderUploadOperationIsActive(operation)) {
          throw orderUploadCanceledError();
        }
        operation.fileIndex = fileIndex + 1;
        state.orderUploadProgress = {
          operationId: operation.id,
          phase: "preparing",
          percent: 0,
          speed: 0,
          eta: 0,
          fileIndex: operation.fileIndex,
          fileCount: operation.fileCount
        };
        updateOrderUploadProgressDom();
        preparation = kind === "photo" && config.preserveOriginal !== true
          ? prepareOrderPhoto(file)
          : Promise.resolve({ file: file, width: 0, height: 0 });
        return withOrderUploadTimeout(
          preparation,
          operation,
          45000,
          "A preparação do ficheiro demorou demasiado. Tenta escolhê-lo novamente."
        );
      }).then(function (prepared) {
        if (!orderUploadOperationIsActive(operation)) {
          throw orderUploadCanceledError();
        }
        return withOrderUploadTimeout(
          uploadOrderMediaFile(prepared, kind, operation, config),
          operation,
          90000,
          "O envio demorou demasiado. Confirma a ligação e tenta novamente."
        ).then(function (upload) {
          if (!orderUploadOperationIsActive(operation)) {
            throw orderUploadCanceledError();
          }
          if (kind === "artwork") {
            upload.quantity = 1;
            upload.feeCents = Math.max(0, parseInt(config.feePerFileCents, 10) || 0);
          }
          uploads.push(upload);
          orderUploadPreviews[upload.token] = URL.createObjectURL(prepared.file);
        });
      });
    });

    chain.then(function () {
      if (!orderUploadOperationIsActive(operation)) {
        throw orderUploadCanceledError();
      }
      state.selections[key] = config.multiple === true
        ? existing.concat(uploads).slice(0, isFinite(maxFiles) ? maxFiles : existing.length + uploads.length)
        : uploads.slice(0, 1);
      if (config.helpKey) {
        state.selections[config.helpKey] = false;
      }
      if (kind === "photo" && key === "quadro_uploads") {
        resetQuadrosPhotoColorAnalysis();
      }
      if (kind === "artwork" && !isCadernosProduct(product)) {
        state.selections.pack_quantity = customArtworkTotalQuantity(product);
      }
      state.invalidFields = state.invalidFields.filter(function (fieldName) { return fieldName !== key; });
      if (kind === "audio") {
        state.orderUploadMessage = uploads.length === 1 ? "Áudio enviado." : uploads.length + " áudios enviados.";
      } else if (kind === "artwork") {
        state.orderUploadMessage = uploads.length === 1 ? "Design enviado sem alterações." : uploads.length + " designs enviados sem alterações.";
        try {
          trackProductEvent(product, "artwork_upload_completed", {
            file_count: uploads.length,
            artwork_count: customArtworkItems(product).length,
            artwork_total_quantity: customArtworkTotalQuantity(product),
            customization_fee_cents: customArtworkFeeCents(product)
          });
        } catch (e) {}
      } else {
        state.orderUploadMessage = uploads.length === 1 ? "Foto enviada." : uploads.length + " fotos enviadas.";
      }
    }).catch(function (error) {
      uploads.forEach(function (upload) {
        if (upload && orderUploadPreviews[upload.token]) {
          URL.revokeObjectURL(orderUploadPreviews[upload.token]);
          delete orderUploadPreviews[upload.token];
        }
      });
      if (!orderUploadOperationIsActive(operation) || operation.canceled) {
        return;
      }
      state.orderUploadError = error && error.message ? error.message : "Não foi possível enviar o ficheiro.";
      if (kind === "artwork") {
        try { trackProductEvent(product, "artwork_upload_failed", { error_code: "upload_failed" }); } catch (e) {}
      }
    }).then(function () {
      var shouldRender = orderUploadOperationIsActive(operation);
      endOrderUploadOperation(operation);
      if (shouldRender && state.product === product) {
        rerenderProduct(product);
      }
    });
  }

  function startOrderPhotoUpload(product, step, input, files) {
    var key = input.dataset.orderUploadKey || "quadro_uploads";
    var config = orderMediaConfigForStep(step, key, "photo");
    var kind = String(config.purpose || "") === "custom-artwork" || step && step.template === "original-artwork-upload"
      ? "artwork"
      : "photo";
    if (kind === "artwork") {
      config = Object.assign({}, config, customArtworkConfig(product), {
        selectionKey: key,
        multiple: true,
        maxFiles: 10,
        allowPdf: true,
        preserveOriginal: true,
        showQuantity: true,
        purpose: "custom-artwork"
      });
    }
    startOrderMediaUpload(product, config, files || [], kind, step && step.id);
  }

  function stopOrderAudioTracks() {
    if (orderAudioStream) {
      orderAudioStream.getTracks().forEach(function (track) { track.stop(); });
    }
    orderAudioStream = null;
  }

  function stopOrderAudioRecording() {
    orderAudioPointerHeld = false;
    if (orderAudioRecorder && orderAudioRecorder.state !== "inactive") {
      orderAudioRecorder.stop();
    }
  }

  function startOrderAudioRecording(product, step, button) {
    var key = button.dataset.orderAudioKey || "quadro_audio_uploads";
    var config = orderMediaConfigForStep(step, key, "audio");

    if (state.orderUploadBusy || orderAudioPendingStart || state.orderAudioRecording) {
      return;
    }
    orderAudioPointerHeld = true;
    orderAudioPendingStart = true;
    orderAudioContext = { product: product, config: config, stepId: String(step && step.id || "") };
    state.orderUploadError = "";
    state.orderUploadMessage = "";
    state.orderUploadFeedbackKind = "audio";

    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      var mimeType = mimeTypes.filter(function (type) {
        return !MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(type);
      })[0] || "";

      orderAudioPendingStart = false;
      if (!orderAudioPointerHeld) {
        stream.getTracks().forEach(function (track) { track.stop(); });
        orderAudioContext = null;
        state.orderUploadMessage = "Microfone pronto. Agora mantém o botão premido enquanto falas.";
        state.orderUploadFeedbackKind = "audio";
        rerenderProduct(product);
        return;
      }

      orderAudioStream = stream;
      orderAudioChunks = [];
      orderAudioRecorder = mimeType ? new MediaRecorder(stream, { mimeType: mimeType }) : new MediaRecorder(stream);
      orderAudioRecorder.ondataavailable = function (event) {
        if (event.data && event.data.size) {
          orderAudioChunks.push(event.data);
        }
      };
      orderAudioRecorder.onstop = function () {
        var recorderType = orderAudioRecorder && orderAudioRecorder.mimeType ? orderAudioRecorder.mimeType : "audio/webm";
        var extension = recorderType.indexOf("mp4") !== -1 ? "m4a" : (recorderType.indexOf("ogg") !== -1 ? "ogg" : "webm");
        var blob = new Blob(orderAudioChunks, { type: recorderType });
        var file = new File([blob], "audio-" + Date.now() + "." + extension, { type: recorderType, lastModified: Date.now() });

        state.orderAudioRecording = false;
        orderAudioRecorder = null;
        orderAudioChunks = [];
        stopOrderAudioTracks();
        if (blob.size && orderAudioContext) {
          startOrderMediaUpload(orderAudioContext.product, orderAudioContext.config, [file], "audio", orderAudioContext.stepId);
        } else if (orderAudioContext) {
          rerenderProduct(orderAudioContext.product);
        }
      };
      orderAudioRecorder.start(250);
      state.orderAudioRecording = true;
      button.classList.add("is-recording");
      button.querySelector("strong").textContent = "A gravar…";
      button.querySelector("small").textContent = "Solta para anexar";
      button.setAttribute("aria-label", "A gravar. Solta para anexar");
    }).catch(function () {
      orderAudioPendingStart = false;
      orderAudioPointerHeld = false;
      stopOrderAudioTracks();
      state.orderUploadError = "Não foi possível usar o microfone. Confirma a permissão e tenta novamente.";
      rerenderProduct(product);
    });
  }

  function applyOrderMediaUploadRemoval(product, key, token) {
    state.selections[key] = orderUploadItems(key).filter(function (item) { return item.token !== token; });
    if (key === customArtworkConfig(product).uploadKey) {
      if (!isCadernosProduct(product)) {
        state.selections.pack_quantity = customArtworkTotalQuantity(product);
      }
      try {
        trackProductEvent(product, "artwork_upload_removed", {
          artwork_count: customArtworkItems(product).length,
          artwork_total_quantity: customArtworkTotalQuantity(product),
          customization_fee_cents: customArtworkFeeCents(product)
        });
      } catch (e) {}
    }
    if (key === "quadro_uploads" && !state.selections[key].length) {
      resetQuadrosPhotoColorAnalysis();
    }
    if (orderUploadPreviews[token]) {
      URL.revokeObjectURL(orderUploadPreviews[token]);
      delete orderUploadPreviews[token];
    }
  }

  function editingCartOriginalHasUpload(key, token) {
    var selections = state.editingCartOriginalItem && state.editingCartOriginalItem.selections;
    var items = selections && Array.isArray(selections[key]) ? selections[key] : [];
    return !!state.editingCartItemId && items.some(function (item) {
      return item && item.token === token;
    });
  }

  function removeOrderMediaUpload(product, key, token) {
    var formData = new FormData();
    var operation;
    var requestOptions;
    var request;

    // Um ficheiro já guardado no item do carrinho tem de continuar disponível
    // caso a pessoa cancele a edição. Retiramo-lo apenas do estado de edição;
    // se guardar, o temporário órfão será removido pela limpeza automática.
    if (editingCartOriginalHasUpload(key, token)) {
      state.orderUploadError = "";
      state.orderUploadMessage = "Ficheiro retirado desta edição. Guarda as alterações para confirmar.";
      state.orderUploadFeedbackKind = key === "quadro_audio_uploads" ? "audio" : (key === customArtworkConfig(product).uploadKey ? "artwork" : "photo");
      applyOrderMediaUploadRemoval(product, key, token);
      rerenderProduct(product);
      return;
    }

    formData.append("action", "delete");
    formData.append("token", token);
    operation = beginOrderUploadOperation("delete", currentStep(product) && currentStep(product).id);
    state.orderUploadError = "";
    state.orderUploadMessage = "";
    state.orderUploadFeedbackKind = key === "quadro_audio_uploads" ? "audio" : (key === customArtworkConfig(product).uploadKey ? "artwork" : "photo");
    rerenderProduct(product);

    requestOptions = {
      method: "POST",
      credentials: "same-origin",
      headers: { "Accept": "application/json" },
      body: formData
    };
    if (operation.controller) {
      requestOptions.signal = operation.controller.signal;
    }

    request = fetch(ORDER_UPLOAD_API, requestOptions).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (payload) {
        if (!response.ok || !payload.ok) {
          throw new Error(payload.message || "Não foi possível remover o ficheiro.");
        }
      });
    });

    withOrderUploadTimeout(request, operation, 45000, "A remoção demorou demasiado. Tenta novamente.").then(function () {
      if (!orderUploadOperationIsActive(operation)) {
        throw orderUploadCanceledError();
      }
      applyOrderMediaUploadRemoval(product, key, token);
    }).catch(function (error) {
      if (!orderUploadOperationIsActive(operation) || operation.canceled) {
        return;
      }
      state.orderUploadError = error && error.message ? error.message : "Não foi possível remover o ficheiro.";
    }).then(function () {
      var shouldRender = orderUploadOperationIsActive(operation);
      endOrderUploadOperation(operation);
      if (shouldRender && state.product === product) {
        rerenderProduct(product);
      }
    });
  }

  // ---- Fluído da grelha de cores (FLIP) ----------------------------------
  // Abrir/fechar os tons muda o número de quadrados, por isso a grelha reflui.
  // Guardamos as posições antes do render e animamos cada quadrado da posição
  // antiga para a nova: as vizinhas parecem ser empurradas em vez de saltar.
  var quadrosFlipRects = null;
  var QUADROS_FLIP_EASING = "cubic-bezier(.34,1.28,.44,1)";
  // Entrada e saída dos círculos duram o mesmo — a saída parecia mais lenta.
  var QUADROS_TONE_TRAVEL = 420;
  var QUADROS_TONE_LEAD = 320;      // crescer + pausa, antes de recolher
  var QUADROS_MARKER_DELAY = 50;    // respiro antes de a setinha arrancar
  var quadrosMarkerShift = null;
  var quadrosMarkerImmediate = false;

  // Faz a setinha deslizar da posição antiga para a que já está no CSS.
  function quadrosAnimateMarkerFrom(marker, from, shift, delay) {
    // Mede a distância real entre centros. Nos degradês existe uma seta e um
    // intervalo entre os quadrados, portanto já não coincide com a largura.
    var slots = document.querySelectorAll("[data-quadros-color-slot]");
    var first = slots[0] ? slots[0].getBoundingClientRect() : null;
    var second = slots[1] ? slots[1].getBoundingClientRect() : null;
    var pitch = first && second
      ? (second.left + second.width / 2) - (first.left + first.width / 2)
      : (first ? first.width : 0);

    if (from === null || from === shift || !pitch || !marker.animate) {
      return;
    }
    marker.animate(
      [
        { transform: "translateX(calc(-50% + " + ((from - shift) * pitch) + "px))" },
        { transform: "translateX(-50%)" }
      ],
      {
        duration: 180,
        delay: delay || 0,
        easing: "cubic-bezier(.3,0,.2,1)",
        // Sem isto ficaria no destino durante o atraso e só depois recuava.
        fill: "backwards"
      }
    );
  }

  // A setinha do quadrado activo desliza para o novo lugar em vez de saltar.
  function quadrosSlideActiveMarker() {
    var marker = document.querySelector(".quadros-active-marker");
    var shift = marker ? parseFloat(marker.style.getPropertyValue("--marker-shift")) : null;
    // Clique directo num quadrado da composição: arranca já, sem respiro.
    var delay = quadrosMarkerImmediate ? 0 : QUADROS_MARKER_DELAY;
    var from;

    quadrosMarkerImmediate = false;
    if (!marker || shift === null || isNaN(shift)) {
      quadrosMarkerShift = null;
      return;
    }
    from = quadrosMarkerShift;
    quadrosMarkerShift = shift;
    quadrosAnimateMarkerFrom(marker, from, shift, delay);
  }

  // Move a setinha já no clique, sem esperar pelo re-render — que só chega no
  // fim da animação dos círculos.
  function quadrosMoveActiveMarker(index, limit) {
    var marker = document.querySelector(".quadros-active-marker");
    var shift = index - (limit - 1) / 2;
    var from = quadrosMarkerShift;

    if (!marker || from === shift) {
      return;
    }
    marker.style.setProperty("--marker-shift", shift);
    quadrosMarkerShift = shift;
    quadrosAnimateMarkerFrom(marker, from, shift, QUADROS_MARKER_DELAY);
  }

  // Os 3 círculos formam um triângulo centrado na célula que o quadrado
  // clicado deixou livre: principal em cima, claro em baixo à esquerda, escuro
  // em baixo à direita. Se o triângulo sair da grelha (colunas das pontas),
  // desloca-se inteiro para dentro, mantendo a forma.
  function quadrosPlaceToneStrip() {
    var grid = document.querySelector("[data-quadros-color-grid]");
    var strip = grid ? grid.querySelector("[data-quadros-tone-strip]") : null;
    var expanded = grid ? grid.querySelector(".quadros-color-family.is-expanded") : null;
    var size;
    var pitch;
    var cx;
    var cy;
    var halfW;
    var halfH;
    var shift = 0;
    var gridRect;
    var minX;
    var maxX;
    var place;

    if (!grid || !strip || !expanded) {
      return;
    }
    size = parseFloat(getComputedStyle(grid).getPropertyValue("--quadros-tone-size")) || 40;
    pitch = size + Math.max(3, size * 0.1);       // distância entre centros
    cx = expanded.offsetLeft + expanded.offsetWidth / 2;
    cy = expanded.offsetTop + expanded.offsetHeight / 2;
    halfW = pitch / 2;
    halfH = pitch * 0.433;                        // metade da altura equilátera

    // O triângulo fica centrado no quadrado clicado, mesmo nas colunas das
    // pontas — nesses casos entra pela margem da página, encostando ao canto.
    // Só se desloca se ameaçar sair do ecrã.
    gridRect = grid.getBoundingClientRect();
    minX = -Math.max(0, gridRect.left - 6);
    maxX = grid.clientWidth + Math.max(0, window.innerWidth - gridRect.right - 6);
    if (cx - halfW - size / 2 < minX) {
      shift = minX - (cx - halfW - size / 2);
    } else if (cx + halfW + size / 2 > maxX) {
      shift = maxX - (cx + halfW + size / 2);
    }

    place = function (name, dx, dy) {
      strip.style.setProperty("--quadros-tone-" + name + "-x", (cx + shift + dx - size / 2) + "px");
      strip.style.setProperty("--quadros-tone-" + name + "-y", (cy + dy - size / 2) + "px");
    };

    strip.style.setProperty("--quadros-tone-origin-x", (cx + shift) + "px");
    strip.style.setProperty("--quadros-tone-origin-y", cy + "px");
    place("top", 0, -halfH);
    place("left", -halfW, halfH);
    place("right", halfW, halfH);
  }

  // Percurso em espiral entre o centro do quadrado clicado e o vértice final do
  // círculo: o raio abre enquanto o ângulo roda, por isso o círculo descreve
  // uma curva em vez de uma linha recta. (dx0, dy0) é a translação no ponto de
  // partida, ou seja o centro do quadrado visto a partir do lugar final.
  var QUADROS_TONE_SWIRL = 150;      // graus de rotação ao longo do percurso
  var QUADROS_TONE_STEPS = 12;

  function quadrosSpiralFrames(dx0, dy0) {
    var radius = Math.hypot(dx0, dy0);
    var endAngle = Math.atan2(-dy0, -dx0);
    var swirl = QUADROS_TONE_SWIRL * Math.PI / 180;
    var frames = [];
    var i;
    var t;
    var angle;

    for (i = 0; i <= QUADROS_TONE_STEPS; i++) {
      t = i / QUADROS_TONE_STEPS;
      angle = endAngle - swirl * (1 - t);
      frames.push({
        transform: "translate("
          + (dx0 + t * radius * Math.cos(angle)).toFixed(2) + "px,"
          + (dy0 + t * radius * Math.sin(angle)).toFixed(2) + "px) rotate("
          + (-QUADROS_TONE_SWIRL * (1 - t)).toFixed(1) + "deg) scale("
          + (0.18 + 0.82 * t).toFixed(3) + ")",
        opacity: Math.min(1, t * 4)
      });
    }
    return frames;
  }

  function quadrosToneOriginDelta(element, expanded) {
    var from = expanded.getBoundingClientRect();
    var to = element.getBoundingClientRect();

    return [
      (from.left + from.width / 2) - (to.left + to.width / 2),
      (from.top + from.height / 2) - (to.top + to.height / 2)
    ];
  }

  // Fecho: os círculos recolhem-se em espiral para dentro do quadrado, que
  // reaparece. O que foi clicado dá primeiro um salto, como confirmação.
  var quadrosToneClosing = false;
  var quadrosToneSettle = null;

  // Se o utilizador clicar noutra cor a meio da recolha, o clique dele ganha:
  // liquidamos o fecho sem re-render (quem chamou vai renderizar a seguir).
  function quadrosSettleToneClose() {
    if (quadrosToneSettle) {
      quadrosToneSettle(true);
    }
  }

  function quadrosDismissToneStrip(product, clicked) {
    var grid = document.querySelector("[data-quadros-color-grid]");
    var strip = grid ? grid.querySelector("[data-quadros-tone-strip]") : null;
    var expanded = grid ? grid.querySelector(".quadros-color-family.is-expanded") : null;
    var pending = 0;
    var settled = false;
    var done;

    done = function (skipRender) {
      var activeStep;
      var activeUi;
      if (settled) {
        return;
      }
      settled = true;
      quadrosToneClosing = false;
      quadrosToneSettle = null;
      state.quadroToneEdit = null;
      activeStep = currentStep(product);
      if (activeStep && activeStep.tonePicker === true) {
        activeUi = quadrosColorUiFor(activeStep, paletteSelectionLimit(activeStep));
        activeUi.toneEdit = null;
      }
      if (skipRender !== true) {
        rerenderProduct(product);
      }
    };

    if (quadrosToneClosing) {
      return;
    }
    if (!strip || !expanded || !document.body.animate) {
      done();
      return;
    }
    quadrosToneClosing = true;
    quadrosToneSettle = done;
    strip.style.pointerEvents = "none";

    // O quadrado reaparece atrás dos círculos, ao mesmo tempo que eles recolhem
    // e ao mesmo ritmo — o inverso exacto da entrada.
    expanded.animate(
      [
        { transform: "scale(.45) rotate(-40deg)", opacity: 0 },
        { transform: "scale(1) rotate(0deg)", opacity: 1 }
      ],
      {
        duration: QUADROS_TONE_TRAVEL,
        delay: QUADROS_TONE_LEAD,
        easing: QUADROS_FLIP_EASING,
        fill: "both"
      }
    );

    Array.prototype.forEach.call(strip.children, function (circle) {
      var delta = quadrosToneOriginDelta(circle, expanded);
      var frames = quadrosSpiralFrames(delta[0], delta[1]).reverse();
      var isClicked = circle === clicked;
      var animation;
      var total;

      if (isClicked) {
        // Cresce, e fica um instante parado no tamanho grande — é essa pausa
        // que faz ler qual foi o círculo escolhido — antes de recolher. Só a
        // parte da recolha conta para o tempo de viagem.
        total = QUADROS_TONE_LEAD + QUADROS_TONE_TRAVEL;
        frames = [
          { transform: "translate(0,0) rotate(0deg) scale(1)", opacity: 1, offset: 0 },
          { transform: "translate(0,0) rotate(0deg) scale(1.26)", opacity: 1, offset: 130 / total },
          { transform: "translate(0,0) rotate(0deg) scale(1.26)", opacity: 1, offset: QUADROS_TONE_LEAD / total }
        ].concat(frames.slice(1).map(function (frame, index, list) {
          frame.offset = (QUADROS_TONE_LEAD + (QUADROS_TONE_TRAVEL * (index + 1)) / list.length) / total;
          return frame;
        }));
      }
      pending += 1;
      animation = circle.animate(frames, {
        duration: isClicked ? QUADROS_TONE_LEAD + QUADROS_TONE_TRAVEL : QUADROS_TONE_TRAVEL,
        // Os que não foram escolhidos esperam pela pausa antes de sair.
        delay: isClicked ? 0 : QUADROS_TONE_LEAD,
        easing: isClicked ? "cubic-bezier(.4,0,.3,1)" : QUADROS_FLIP_EASING,
        fill: "forwards"
      });
      animation.addEventListener("finish", function () {
        pending -= 1;
        if (pending === 0) { done(); }
      });
    });

    if (!pending) {
      done();
      return;
    }
    // Rede de segurança: se a timeline não correr (separador em segundo plano),
    // o "finish" nunca dispara e a grelha ficaria presa no estado aberto.
    // Tem de ser maior que a animação mais longa para não a cortar.
    window.setTimeout(done, QUADROS_TONE_LEAD + QUADROS_TONE_TRAVEL + 260);
  }

  function quadrosCaptureGridRects(origin) {
    var grid = document.querySelector("[data-quadros-color-grid]");
    var rects = {};

    // Corre mesmo com prefers-reduced-motion: sem o movimento os quadrados
    // saltam de sítio e não se percebe o que aconteceu à grelha.
    if (!grid || !document.body.animate) {
      quadrosFlipRects = null;
      return;
    }
    grid.querySelectorAll("[data-flip-key]").forEach(function (element) {
      rects[element.dataset.flipKey] = element.getBoundingClientRect();
    });
    quadrosFlipRects = { rects: rects, origin: origin || "" };
  }

  function quadrosPlayGridFlip() {
    var captured = quadrosFlipRects;
    var grid = document.querySelector("[data-quadros-color-grid]");
    var originRect;

    quadrosFlipRects = null;
    if (!captured || !grid) {
      return;
    }
    originRect = captured.rects["fam:" + captured.origin];

    grid.querySelectorAll("[data-flip-key]").forEach(function (element) {
      var key = element.dataset.flipKey;
      var from = captured.rects[key] || originRect;
      var to = element.getBoundingClientRect();
      var dx;
      var dy;
      var isNew = !captured.rects[key];
      var scale;

      if (!from || !to.width) {
        return;
      }
      if (isNew) {
        // Os círculos brotam do centro do quadrado clicado e abrem em espiral
        // até ao seu vértice do triângulo.
        dx = (from.left + from.width / 2) - (to.left + to.width / 2);
        dy = (from.top + from.height / 2) - (to.top + to.height / 2);
        element.animate(quadrosSpiralFrames(dx, dy), {
          duration: QUADROS_TONE_TRAVEL,
          easing: QUADROS_FLIP_EASING
        });
        return;
      }
      dx = from.left - to.left;
      dy = from.top - to.top;
      scale = 1;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        return;
      }
      element.animate(
        [
          { transform: "translate(" + dx + "px," + dy + "px) scale(" + scale + ")" },
          { transform: "translate(0,0) scale(1)" }
        ],
        {
          duration: 420,
          easing: QUADROS_FLIP_EASING,
          // Escalona pela distância: as mais próximas da cor clicada arrancam
          // primeiro, o que dá a leitura de empurrão a propagar-se.
          delay: Math.min(90, Math.round(Math.hypot(dx, dy) / 14)),
          fill: "backwards"
        }
      );
    });
  }



  // O certo salta a aparecer no quadrado que passou a ter cor, e salta a
  // desvanecer no que a perdeu. Guardamos as cores marcadas do render anterior
  // para saber quais mudaram.
  var quadrosCheckedValues = null;

  function quadrosAnimateChecks() {
    var grid = document.querySelector("[data-quadros-color-grid]");
    var previous = quadrosCheckedValues;
    var current = [];
    var squares;

    if (!grid) {
      quadrosCheckedValues = null;
      return;
    }
    squares = Array.prototype.slice.call(grid.querySelectorAll("[data-quadros-color-family]"));
    squares.forEach(function (square) {
      if (square.querySelector(".quadros-check")) {
        current.push(square.dataset.quadrosColorFamily);
      }
    });
    quadrosCheckedValues = current;
    if (!previous || !grid.animate) {
      return;
    }

    // Entra: salta e aparece.
    current.forEach(function (value) {
      var check;
      if (previous.indexOf(value) !== -1) {
        return;
      }
      check = grid.querySelector('[data-quadros-color-family="' + value.replace(/"/g, '\\"') + '"] .quadros-check');
      if (check) {
        check.animate(
          [
            { transform: "scale(.2)", opacity: 0 },
            { transform: "scale(1.3)", opacity: 1, offset: 0.6 },
            { transform: "scale(1)", opacity: 1 }
          ],
          { duration: 200, easing: "cubic-bezier(.3,0,.2,1)" }
        );
      }
    });

    // A sair não há animação: fazer o certo reaparecer só para o desvanecer
    // dava mais nas vistas do que simplesmente deixá-lo ir.
  }

  // Ligado uma única vez: o bindProduct corre a cada render e duplicaria
  // listeners no document.
  var quadrosColorPanelDismissBound = false;

  function bindQuadrosColorPanelDismiss() {
    if (quadrosColorPanelDismissBound) {
      return;
    }
    quadrosColorPanelDismissBound = true;

    var close = function () {
      if (!state.quadroToneEdit || !state.product) {
        return;
      }
      quadrosDismissToneStrip(state.product, null);
    };

    document.addEventListener("click", function (event) {
      var target = event.target;
      if (target && target.closest && target.closest("[data-quadros-color-grid], [data-quadros-color-slot]")) {
        return;
      }
      close();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        close();
      }
    });
  }

  function bindProduct(product) {
    var form = document.querySelector("#order-form");
    var back = document.querySelector("[data-back]");
    var next = document.querySelector("[data-next]");
    var step = currentStep(product);

    bindQuadrosColorPanelDismiss();
    // Sincronamente, antes de o browser pintar: o MutationObserver do MiaWater
    // só corre no rAF seguinte, o que deixava um frame com as canvases em
    // branco — era o pisca-pisca dos quadrados a cada re-render.
    miaWaterScan();
    quadrosPlaceToneStrip();   // antes do FLIP: as posições finais têm de ser estas
    quadrosPlayGridFlip();
    quadrosSlideActiveMarker();
    quadrosAnimateChecks();
    initFreeQuantityPriceCharts(product);

    document.querySelectorAll("[data-quadros-color-slot]").forEach(function (button) {
      button.addEventListener("click", function () {
        var limit = paletteSelectionLimit(step);
        var slot = Math.max(0, Math.min(limit - 1, Number(button.dataset.quadrosColorSlot) || 0));
        var ui = quadrosColorUiFor(step, limit);

        quadrosSettleToneClose();
        quadrosCaptureGridRects(state.quadroToneEdit ? state.quadroToneEdit.value : "");
        if (ui.pinnedSlot !== slot) {
          ui.pinnedChangeCount = 0;
          ui.hintSlot = null;
        }
        ui.activeSlot = slot;
        ui.pinnedSlot = slot;
        ui.toneEdit = null;
        state.quadroActiveColorSlot = slot;
        state.quadroToneEdit = null;
        state.errors = "";
        // Clique directo no quadrado: a setinha acompanha sem atraso nenhum.
        quadrosMarkerImmediate = true;
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-quadros-color-family]").forEach(function (button) {
      button.addEventListener("click", function () {
        var limit = paletteSelectionLimit(step);
        var ui = quadrosColorUiFor(step, limit);
        var slot = quadrosActiveColorSlot(step, limit);
        var value = button.dataset.quadrosColorFamily;

        quadrosSettleToneClose();
        quadrosCaptureGridRects(value);
        // Clicar numa cor só abre os três tons — nada fica escolhido até se
        // clicar num círculo. A família pode repetir-se; só a combinação exacta
        // de cor + tom é única, e essa verificação é feita ao escolher o tom.
        ui.toneEdit = { value: value, slot: slot };
        state.quadroToneEdit = ui.toneEdit;
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-quadros-tone]").forEach(function (button) {
      button.addEventListener("click", function () {
        var limit = paletteSelectionLimit(step);
        var keys = quadrosColorSelectionKeys(step);
        var ui = quadrosColorUiFor(step, limit);
        var requestedSlot = Math.max(0, Math.min(limit - 1, Number(button.dataset.quadrosToneSlot) || 0));
        var slot = ui.pinnedSlot !== null ? ui.pinnedSlot : requestedSlot;
        var tone = Math.max(0, Math.min(2, Number(button.dataset.quadrosTone) || 0));
        var slots = currentPaletteColorSlots(step, limit);
        var tones = quadrosToneSelections(step, limit);
        var value = button.dataset.quadrosToneValue;
        var existingSlot = slots.findIndex(function (slotValue, index) {
          return slotValue === value && tones[index] === tone;
        });
        var wasChosen = existingSlot !== -1;
        var sameTarget = wasChosen && existingSlot === slot;
        var newColor = quadrosColorStops(quadrosColorItem(step, value))[tone];
        var nextEmpty;

        if (sameTarget) {
          // Voltar a tocar no tom que já ocupa o próprio quadrado continua a
          // funcionar como alternância: o quadrado fica vazio, mas permanece
          // fixado quando foi escolhido expressamente.
          slots[existingSlot] = "";
          tones[existingSlot] = 1;
          ui.activeSlot = existingSlot;
          if (slots.indexOf(value) === -1) {
            quadrosUnmarkFamilySquare(step, value);
          }
          quadrosPrimeSlotWater(step, existingSlot, "");
        } else if (wasChosen && ui.pinnedSlot !== null) {
          // Com um quadrado fixado, o tom é transferido para esse alvo: sai do
          // quadrado antigo, substitui o que estiver no alvo e o triângulo não
          // muda de lugar.
          slots[existingSlot] = "";
          tones[existingSlot] = 1;
          slots[slot] = value;
          tones[slot] = tone;
          ui.activeSlot = slot;
          quadrosPrimeSlotWater(step, existingSlot, "");
          quadrosPrimeSlotWater(step, slot, newColor);
        } else if (wasChosen) {
          // Sem fixação explícita mantém-se o comportamento habitual: retirar
          // o tom duplicado e levar o foco para o quadrado que ficou vazio.
          slots[existingSlot] = "";
          tones[existingSlot] = 1;
          ui.activeSlot = existingSlot;
          if (slots.indexOf(value) === -1) {
            quadrosUnmarkFamilySquare(step, value);
          }
          quadrosPrimeSlotWater(step, existingSlot, "");
        } else {
          slots[slot] = value;
          tones[slot] = tone;
          state.selections[keys.mia] = false;
          // O activo salta para o quadrado seguinte por preencher, para a cor
          // seguinte não substituir esta. Um clique explícito fixa a posição.
          nextEmpty = slots.indexOf("");
          ui.activeSlot = ui.pinnedSlot !== null ? ui.pinnedSlot : (nextEmpty !== -1 ? nextEmpty : slot);
          quadrosPrimeSlotWater(step, slot, newColor);
        }

        if (ui.pinnedSlot !== null) {
          ui.pinnedChangeCount += 1;
          if (ui.pinnedChangeCount % 3 === 0) {
            ui.hintSlot = quadrosNextEmptySlot(slots, ui.pinnedSlot);
          } else if (ui.hintSlot !== null && slots[ui.hintSlot]) {
            ui.hintSlot = null;
          }
        } else {
          ui.pinnedChangeCount = 0;
          ui.hintSlot = null;
        }
        ui.slots = slots.slice();
        ui.toneEdit = null;
        state.quadroActiveColorSlot = ui.activeSlot;
        state.quadroToneEdit = null;
        // A água e a setinha arrancam no instante do clique — o re-render só
        // chega no fim da animação dos círculos.
        quadrosMoveActiveMarker(ui.activeSlot, limit);
        state.selections[keys.palette] = "";
        state.selections[keys.colors] = slots.filter(Boolean);
        state.selections[keys.tones] = tones;
        state.paletteColorSlots = slots.slice();
        state.paletteLastSlot = slot;
        state.errors = "";
        // O re-render vem no fim da animação de recolha (o círculo clicado dá
        // um salto e os três voltam para dentro do quadrado).
        quadrosDismissToneStrip(product, button);
      });
    });

    document.querySelectorAll("[data-quadros-suggestions-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.quadroColorSuggestionsOpen = !state.quadroColorSuggestionsOpen;
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-quadros-palette-index]").forEach(function (button) {
      button.addEventListener("click", function () {
        var limit = paletteSelectionLimit(step);
        var index = Math.max(0, Number(button.dataset.quadrosPaletteIndex) || 0);
        var records = quadrosSuggestedPaletteRecords(step, limit, quadrosColorModeInfo(step).mode);

        if (applyQuadrosSuggestedPalette(step, records[index])) {
          state.errors = "";
          rerenderProduct(product);
        }
      });
    });

    document.querySelectorAll("[data-palette-suggestions-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.colorSuggestionsOpen = !state.colorSuggestionsOpen;
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-palette-choice]").forEach(function (input) {
      input.addEventListener("change", function () {
        var selectedItem = (step.items || []).filter(function (item) {
          return item && item.value === input.value;
        })[0] || null;
        var selectionLimit = paletteSelectionLimit(step);
        var individualValues = paletteIndividualValues(step, selectedItem, selectionLimit);

        state.selections.color_palette = input.value;
        state.selections.colors = individualValues.slice();
        state.selections.mia_choose_colors = false;
        state.paletteColorSlots = individualValues.concat(Array.from({ length: Math.max(0, selectionLimit - individualValues.length) }, function () { return ""; }));
        state.paletteLastSlot = Math.max(0, individualValues.length - 1);   // próximo clique substitui o último
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-individual-color]").forEach(function (input) {
      input.addEventListener("change", function () {
        var selectionLimit = paletteSelectionLimit(step);
        var slots = currentPaletteColorSlots(step, selectionLimit);
        var slotIndex = slots.indexOf(input.value);
        var lastSlot = (typeof state.paletteLastSlot === "number") ? state.paletteLastSlot : -1;
        var emptyIndex, replaceIndex;
        state.selections.color_palette = "";
        state.selections.mia_choose_colors = false;
        if (input.checked && slotIndex === -1) {
          emptyIndex = slots.indexOf("");
          if (emptyIndex !== -1) {
            slots[emptyIndex] = input.value;          // ainda há espaço -> preenche
            lastSlot = emptyIndex;
          } else {
            // já está cheio -> substitui o último quadrado que foi mexido
            // (com 1 cor é sempre o único; com 3 é o mais recente)
            replaceIndex = (lastSlot >= 0 && lastSlot < slots.length) ? lastSlot : slots.length - 1;
            slots[replaceIndex] = input.value;
            lastSlot = replaceIndex;
          }
        } else if (!input.checked && slotIndex !== -1) {
          slots[slotIndex] = "";                        // desmarca -> esvazia esse
          lastSlot = slotIndex;
        } else if (input.checked && slotIndex !== -1) {
          lastSlot = slotIndex;                          // re-clique -> passa a ser o último mexido
        }
        state.paletteLastSlot = lastSlot;
        state.paletteColorSlots = slots;
        state.selections.colors = slots.filter(Boolean);
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-mia-color-choice]").forEach(function (input) {
      input.addEventListener("change", function () {
        var keys = quadrosColorSelectionKeys(step);
        var limit = paletteSelectionLimit(step);
        var ui = quadrosColorUiFor(step, limit);
        state.selections[keys.mia] = input.checked;
        if (input.checked) {
          state.selections[keys.palette] = "";
          state.selections[keys.colors] = [];
          delete state.selections[keys.tones];
          ui.slots = Array.from({ length: limit }, function () { return ""; });
          ui.activeSlot = 0;
          ui.pinnedSlot = null;
          ui.pinnedChangeCount = 0;
          ui.hintSlot = null;
          ui.toneEdit = null;
          state.paletteColorSlots = ui.slots.slice();
          state.paletteLastSlot = -1;
          state.quadroActiveColorSlot = 0;
          state.quadroToneEdit = null;
        }
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-order-upload]").forEach(function (input) {
      input.addEventListener("click", function () {
        beginOrderFilePickerSession(input, step);
      });
      input.addEventListener("cancel", function () {
        invalidateOrderFilePickerSession(input);
      });
      input.addEventListener("change", function () {
        var picker = orderActiveFilePicker;
        var files = Array.prototype.slice.call(input.files || []).filter(function (file) {
          return file && Number(file.size) > 0;
        });
        var revision;

        if (!picker || picker.input !== input) {
          input.value = "";
          return;
        }

        revision = picker.revision;
        orderActiveFilePicker = null;
        input.value = "";
        window.setTimeout(function () {
          var activeStep = currentStep(product);
          input.value = "";
          if (
            revision !== orderFilePickerRevision ||
            !document.documentElement.contains(input) ||
            !activeStep ||
            activeStep.id !== step.id
          ) {
            return;
          }

          orderFilePickerRevision += 1;
          if (files.length > 0) {
            startOrderPhotoUpload(product, step, input, files);
          }
        }, 0);
      });
    });

    document.querySelectorAll("[data-order-upload-remove]").forEach(function (button) {
      button.addEventListener("click", function () {
        var key = button.dataset.orderUploadKey || "quadro_uploads";
        var token = button.dataset.orderUploadRemove;
        removeOrderMediaUpload(product, key, token);
      });
    });

    document.querySelectorAll("[data-artwork-upload-quantity]").forEach(function (input) {
      function syncArtworkQuantity(commit) {
        var key = input.dataset.orderUploadKey || customArtworkConfig(product).uploadKey;
        var token = input.dataset.orderUploadToken || "";
        var parsed = parseInt(input.value, 10);
        var quantity;
        var item = orderUploadItems(key).filter(function (candidate) {
          return String(candidate.token || "") === token;
        })[0] || null;
        if (!item || (!commit && (!isFinite(parsed) || parsed < 1))) {
          return;
        }
        quantity = Math.max(1, Math.min(9999, parsed || 1));
        item.quantity = quantity;
        if (commit) {
          input.value = quantity;
        }
        if (!isCadernosProduct(product)) {
          state.selections.pack_quantity = customArtworkTotalQuantity(product);
        }
        state.errors = "";
        if (commit) {
          try {
            trackProductEvent(product, "artwork_quantity_changed", {
              quantity: quantity,
              artwork_count: customArtworkItems(product).length,
              artwork_total_quantity: customArtworkTotalQuantity(product)
            });
          } catch (e) {}
          rerenderProduct(product);
        }
      }

      input.addEventListener("input", function () {
        syncArtworkQuantity(false);
      });
      input.addEventListener("change", function () {
        syncArtworkQuantity(true);
      });
    });

    document.querySelectorAll("[data-order-audio-record]").forEach(function (button) {
      var release = function () {
        window.removeEventListener("pointerup", release);
        window.removeEventListener("pointercancel", release);
        stopOrderAudioRecording();
      };
      button.addEventListener("pointerdown", function (event) {
        event.preventDefault();
        startOrderAudioRecording(product, step, button);
        window.addEventListener("pointerup", release, { once: true });
        window.addEventListener("pointercancel", release, { once: true });
      });
      button.addEventListener("contextmenu", function (event) {
        event.preventDefault();
      });
    });

    document.querySelectorAll("[data-photo-help-key]").forEach(function (input) {
      input.addEventListener("change", function () {
        state.selections[input.dataset.photoHelpKey] = input.checked;
        if (input.checked) {
          resetQuadrosPhotoColorAnalysis();
        }
        state.errors = "";
        state.orderUploadError = "";
        state.orderUploadFeedbackKind = "photo";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-custom-design-upload]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.selections.order_flow = "custom";
        state.selections.design_source = "custom";
        state.selections.designs = [];
        state.selections.assorted_designs = "";
        state.selections.congregation_gift = false;
        resetQuantityState();
        state.errors = "";
        try { trackOptionSelected(product, "design_source", "custom", "Carregar o meu design"); } catch (e) {}
        goNext(product);
      });
    });

    document.querySelectorAll("[data-select-all-designs]").forEach(function (button) {
      button.addEventListener("click", function () {
        var designStep = findStep(product, "designs");
        var allValues = designStep && Array.isArray(designStep.items) ? designStep.items.map(function (item) { return item.value; }).filter(Boolean) : [];
        var currentValues = selectedDesignValues();
        var allSelected = allValues.length > 0 && currentValues.length === allValues.length;

        state.selections.assorted_designs = "";
        state.selections.order_flow = "catalog";
        state.selections.design_source = "catalog";
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
          state.selections.order_flow = "catalog";
          state.selections.design_source = "catalog";
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
        if (step && step.id === "designs" && input.checked) {
          state.selections.order_flow = "catalog";
          state.selections.design_source = "catalog";
        }
        if (step && step.id === "cover_personalization" && input.value === "no") {
          state.selections.cover_personalization_text = "";
        }
        state.errors = "";
        state.packDisabledMessage = "";
        if (step && step.autoAdvance === true && step.selection === "single" && input.checked) {
          funnelNextTransitionReason = "option_auto_advance";
          goNext(product);
          return;
        }
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
        if (freeQuantityStep(product)) {
          setFreeQuantity(product, newPackQuantity, "pack", false);
        } else {
          state.selections.pack_quantity = newPackQuantity;
        }
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

        if (!freeQuantityStep(product)) {
          ensurePackAndQuantities(product);
        }
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

    document.querySelectorAll("[data-caderno-order-quantity-change]").forEach(function (button) {
      button.addEventListener("click", function () {
        var config = cadernoOrderQuantityConfig(product);
        var minimum = Math.max(1, parseInt(config.minimum, 10) || parseInt(product && product.minimumQuantity, 10) || 1);
        var maximum = Math.max(minimum, parseInt(config.maximum, 10) || 9999);
        var change = parseInt(button.dataset.cadernoOrderQuantityChange, 10) || 0;
        var quantity = Math.max(minimum, Math.min(maximum, cadernoOrderQuantity(product) + change));
        state.selections.caderno_order_quantity = quantity;
        try { trackOptionSelected(product, "caderno_qty", quantity, ""); } catch (e) {}
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-caderno-order-quantity-input]").forEach(function (input) {
      function syncCadernoOrderQuantity(commit) {
        var config = cadernoOrderQuantityConfig(product);
        var minimum = Math.max(1, parseInt(config.minimum, 10) || parseInt(product && product.minimumQuantity, 10) || 1);
        var maximum = Math.max(minimum, parseInt(config.maximum, 10) || 9999);
        var parsed = parseInt(input.value, 10);
        var quantity;
        if (!commit && (!isFinite(parsed) || parsed < minimum)) {
          return;
        }
        quantity = Math.max(minimum, Math.min(maximum, parsed || minimum));
        state.selections.caderno_order_quantity = quantity;
        state.errors = "";
        if (commit) {
          input.value = quantity;
          try { trackOptionSelected(product, "caderno_qty", quantity, ""); } catch (e) {}
          rerenderProduct(product);
        }
      }

      input.addEventListener("input", function () {
        syncCadernoOrderQuantity(false);
      });
      input.addEventListener("change", function () {
        syncCadernoOrderQuantity(true);
      });
    });

    document.querySelectorAll("[data-free-quantity-change]").forEach(function (button) {
      button.addEventListener("click", function () {
        var current = getPackQuantity(product) || effectiveMinimumFreeQuantity(product);
        var change = Number(button.dataset.freeQuantityChange || 0);
        var rangeMaximum = freeQuantityRangeMaximum(product);
        var next = current > rangeMaximum && change < 0 ? rangeMaximum : current + change;
        setFreeQuantity(product, next, "auto", true, change);
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-free-quantity-range]").forEach(function (input) {
      input.addEventListener("input", function () {
        var quantity = freeQuantityFromRangePosition(product, input.value);

        setFreeQuantity(product, quantity, "auto", false);
        refreshFreeQuantityDraft(product, input);
      });
      input.addEventListener("change", function () {
        setFreeQuantity(product, freeQuantityFromRangePosition(product, input.value), "auto");
        refreshFreeQuantityDraft(product, input);
      });
    });

    bindQuantityDistributionEvents(product);

    document.querySelectorAll("[data-detail-field]").forEach(function (input) {
      input.addEventListener("input", function () {
        var characterCount = document.querySelector('[data-character-count-for="' + input.name + '"]');
        state.selections[input.name] = input.value;
        if (characterCount && input.maxLength > 0) {
          characterCount.textContent = input.value.length + " / " + input.maxLength;
        }
        if (input.name === "quadro_text" && String(input.value || "").trim()) {
          state.selections.no_phrase = false;
          var noPhraseInput = document.querySelector('[data-details-skip-key="no_phrase"]');
          if (noPhraseInput) {
            noPhraseInput.checked = false;
          }
        }
        if (step && step.skipOption && step.skipOption.selectionKey && String(input.value || "").trim()) {
          var detailsSkipKey = String(step.skipOption.selectionKey);
          state.selections[detailsSkipKey] = false;
          var detailsSkipInput = document.querySelector('[data-details-skip-key="' + detailsSkipKey.replace(/"/g, '\\"') + '"]');
          if (detailsSkipInput) {
            detailsSkipInput.checked = false;
          }
        }
        if (step && step.template === "details-form") {
          saveCardDetailsSessionField(input.name, input.value);
        }
        refreshQuadrosBuildSummary(product);
        if (input.name === "customer_contact" && state.selections.send_copy && !state.selections.copy_email && isValidEmail(input.value)) {
          state.selections.copy_email = String(input.value).trim();
        }
        if (String(input.value || "").trim()) {
          input.classList.remove("is-missing");
          input.removeAttribute("aria-invalid");
          state.invalidFields = state.invalidFields.filter(function (name) {
            return name !== input.name;
          });
          if (!state.invalidFields.length) {
            state.errors = "";
            var actionError = document.querySelector(".wizard-shell .action-error");
            var nextButton = document.querySelector(".wizard-shell [data-next]");
            if (actionError) {
              actionError.remove();
            }
            if (nextButton) {
              nextButton.removeAttribute("aria-describedby");
            }
          }
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

    document.querySelectorAll("[data-details-skip-key]").forEach(function (input) {
      input.addEventListener("change", function () {
        var skipKey = input.dataset.detailsSkipKey;
        var knownClearFields = {
          no_phrase: "quadro_text",
          no_dedication: "quadro_dedication",
          no_text: "quadro_text",
          no_silhouette_text: "quadro_silhouette_text",
          silhouette_contact_me: "quadro_silhouette_description"
        };
        var clearField = step && step.skipOption && step.skipOption.clearField
          ? String(step.skipOption.clearField)
          : knownClearFields[skipKey];
        state.selections[skipKey] = input.checked;
        if (clearField && input.checked) {
          state.selections[clearField] = "";
        }
        state.errors = "";
        state.invalidFields = [];
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-details-example-value]").forEach(function (button) {
      button.addEventListener("click", function () {
        var key = button.dataset.detailsExampleKey || "details_example";
        var value = button.dataset.detailsExampleValue || "";
        state.selections[key] = state.selections[key] === value ? "" : value;
        state.errors = "";
        state.invalidFields = [];
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

    document.querySelectorAll("[data-order-suspended-submit]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.errors = ordersSuspendedCheckoutMessage();
        rerenderProduct(product);
      });
    });

    bindCustomProductBuilder(product);

    document.querySelectorAll("[data-cart-add-another]").forEach(function (button) {
      button.addEventListener("click", function () {
        addCurrentProductToCart(product, "index.html");
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
        var allPreviousValid;

        if (ordersAreSuspended()) {
          event.preventDefault();
          state.errors = ordersSuspendedCheckoutMessage();
          rerenderProduct(product);
          return;
        }

        allPreviousValid = visibleSteps(product).slice(0, -1).map(function (candidate) {
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
    var allowed = { quadros: true, crachas: true, imanes: true, caderninhos: true, cadernos: true };
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
      '<main class="home-shell home-shell--hub add-product-shell">',
      renderBrand(home.brand || "Mia & Paper", "index.html", home.instagramUrl, home.categories),
      '<section class="home-section home-hub-section home-products-section" aria-labelledby="add-product-title">',
      '<div class="home-section-inner">',
      '<header class="home-section-heading">',
      '<p class="eyebrow">Carrinho</p>',
      '<h1 id="add-product-title">O que queres acrescentar ao teu pedido?</h1>',
      '<p>Escolhe outro produto para o juntares ao mesmo pedido.</p>',
      '</header>',
      '<div class="home-hub-summary">',
      count ? renderCheckoutCartItems({ allowRemove: false, allowEdit: false }) : '<p class="cart-panel-note">Ainda não adicionaste nenhum produto ao pedido.</p>',
      count ? '<a class="button primary add-product-checkout-link" href="' + escapeHtml(checkoutHref) + '" data-add-product-checkout>Finalizar pedido</a>' : "",
      '</div>',
      '<nav class="category-grid category-grid-count-' + Math.max(1, Math.min(5, categories.length)) + '" aria-label="Produtos para adicionar ao pedido">',
      cards,
      '</nav>',
      '</div>',
      '</section>',
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

  function cartItemCatalogContext(item) {
    var selections = item && item.selections && typeof item.selections === "object" ? item.selections : {};
    var explicit = String(selections.catalog_context || "");
    var slug = String(item && item.productSlug || "");
    if (explicit) {
      return explicit;
    }
    return ["crachas", "imanes", "caderninhos", "cadernos"].indexOf(slug) !== -1 ? "congress-2026" : "main";
  }

  function cartCatalogContext(cart) {
    var contexts = [];
    ((cart && cart.items) || []).forEach(function (item) {
      var context = cartItemCatalogContext(item);
      if (contexts.indexOf(context) === -1) contexts.push(context);
    });
    return contexts.length > 1 ? "mixed" : (contexts[0] || "main");
  }

  function loadCheckoutDeliveryOptions() {
    var cart = loadCart();
    var firstItem = cart.items[0] || null;
    var slug = firstItem ? firstItem.productSlug : "";
    var context = firstItem ? cartItemCatalogContext(firstItem) : "main";

    state.checkoutDeliveryOptions = defaultDeliveryOptions();

    if (!slug) {
      return Promise.resolve(state.checkoutDeliveryOptions);
    }

    return loadJson((context === "congress-2026" ? "congressos/2026/content/products/" : "content/products/") + slug + ".json").then(function (product) {
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
        customer_nif: String(state.checkout.customer_nif || ""),
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
      state.checkout.customer_nif = String(checkout.customer_nif || "");
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
      return "Indica um email ou telemóvel válido para podermos confirmar a encomenda.";
    }

    contactError = validateContactInput(state.checkout.customer_contact);
    if (contactError) {
      state.invalidFields = ["customer_contact"];
      return contactError;
    }

    if (!validNifInput(state.checkout.customer_nif)) {
      state.invalidFields = ["customer_nif"];
      return "O NIF deve ter 9 dígitos.";
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
        var customizationFee = cartCustomizationFeeText(item);
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
          customizationFee ? '<em class="cart-item-customization-fee">' + escapeHtml(customizationFee) + '</em>' : "",
          '</div>',
          '<div class="cart-item-side">',
          '<span class="cart-item-price">' + escapeHtml(summary.priceText) + '</span>',
          '<div class="cart-item-actions">',
          opts.allowEdit && cartItemIsEditable(item) ? '<button type="button" class="cart-edit-button" data-checkout-edit="' + escapeHtml(item.id) + '">Editar</button>' : "",
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
      '<div class="dc-field"><label><span>Número de Contribuinte (NIF) <small>(opcional)</small></span><input class="' + (state.invalidFields.indexOf("customer_nif") !== -1 ? "is-missing" : "") + '" type="text" name="customer_nif" value="' + escapeHtml(state.checkout.customer_nif) + '" placeholder="" autocomplete="off" inputmode="numeric" data-checkout-field' + (state.invalidFields.indexOf("customer_nif") !== -1 ? ' aria-invalid="true"' : '') + '></label></div>',
      '</div>',
      '<p class="dc-block-note">Se deixares em branco, a fatura será emitida como consumidor final.</p>',
      '<p class="dc-block-note">A fatura será emitida após confirmação do pagamento. Se indicares email, enviamos por email. Se indicares telemóvel, podemos enviar por WhatsApp.</p>',
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
    var suspended = ordersAreSuspended();
    var hasPriceToConfirm = cartHasPriceToConfirm();
    var productTotalText = hasPriceToConfirm
      ? (subtotal > 0 ? formatCents(subtotal) + " + preço a confirmar" : "Preço a confirmar")
      : formatCents(subtotal);
    var orderTotalText = hasPriceToConfirm ? "A confirmar pela Mia" : formatCents(total);

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
      '<div><dt>Contacto:</dt><dd>' + escapeHtml(state.checkout.customer_contact || "") + '</dd></div>',
      '<div><dt>NIF:</dt><dd>' + escapeHtml(state.checkout.customer_nif || "Não indicado") + '</dd></div>',
      '<div><dt>Entrega:</dt><dd>' + escapeHtml(delivery ? delivery.label : "") + '</dd></div>',
      '<div><dt>Cópia por email:</dt><dd>' + escapeHtml(state.checkout.send_copy ? state.checkout.copy_email : "Não") + '</dd></div>',
      '</dl>',
      '<hr class="confirm-divider" aria-hidden="true">',
      '<dl class="confirm-list">',
      '<div><dt>Total dos produtos:</dt><dd>' + escapeHtml(productTotalText) + '</dd></div>',
      '<div><dt>Portes:</dt><dd>' + escapeHtml(shipping > 0 ? deliveryPriceText(delivery) : "Grátis") + '</dd></div>',
      '<div><dt>' + (hasPriceToConfirm ? 'Total:' : 'Total estimado:') + '</dt><dd>' + escapeHtml(orderTotalText) + '</dd></div>',
      '</dl>',
      '</section>',
      renderPaymentNotice(),
      '<div class="copy-request checkout-copy-request">',
      '<label><input type="checkbox" data-checkout-copy-toggle' + (state.checkout.send_copy ? " checked" : "") + '> <span>Enviar uma cópia deste pedido para o meu email</span></label>',
      state.checkout.send_copy ? '<input class="' + (state.invalidFields.indexOf("copy_email") !== -1 ? "is-missing" : "") + '" type="text" name="copy_email" data-checkout-copy-email placeholder="O teu email" value="' + escapeHtml(state.checkout.copy_email) + '" autocomplete="email">' : "",
      state.checkout.send_copy && state.invalidFields.indexOf("copy_email") !== -1 ? '<p class="form-error" role="alert">Indica um email válido para receber a cópia.</p>' : "",
      '</div>',
      state.errors === ordersSuspendedCheckoutMessage() ? '<p class="form-error action-error checkout-action-error" role="alert">' + escapeHtml(state.errors) + '</p>' : "",
      '<div class="step-actions checkout-actions">',
      '<button class="button secondary" type="button" data-checkout-back>Voltar</button>',
      '<button class="button primary' + (suspended ? ' is-disabled' : '') + '" type="' + (suspended ? "button" : "submit") + '"' + (suspended ? ' data-checkout-suspended-submit aria-disabled="true"' : "") + '>Confirmar pedido</button>',
      '</div>',
      '</form>'
    ].join("");
  }

  function cartSubmissionPayload() {
    var cart = loadCart();
    var session = funnelSession();
    return {
      order_mode: "cart",
      schemaVersion: cart.schemaVersion,
      cartId: cart.cartId,
      funnel_session_id: session && session.id ? session.id : "",
      cart_context: cartCatalogContext(cart),
      items: cart.items,
      checkout: {
        customer_name: String(state.checkout.customer_name || "").trim(),
        customer_contact: String(state.checkout.customer_contact || "").trim(),
        customer_nif: String(state.checkout.customer_nif || "").trim(),
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
      renderBrand(home.brand || "Mia & Paper", "index.html", home.instagramUrl, home.categories),
      '<section class="wizard-shell checkout-wizard" aria-labelledby="checkout-title">',
      renderCheckoutProgress(),
      '<div class="step-card">',
      '<p class="eyebrow">Checkout</p>',
      '<h1 id="checkout-title">' + (state.checkoutStep === 0 ? "Contacto e entrega" : "Confirmar pedido") + '</h1>',
      state.errors && !(state.checkoutStep === 1 && state.errors === ordersSuspendedCheckoutMessage()) ? '<p class="form-error action-error" role="alert">' + escapeHtml(state.errors) + '</p>' : "",
      getCartCount() < 1 ? [
        '<div class="cart-empty-state checkout-empty-state">',
        '<strong>O carrinho está vazio.</strong>',
        '<p>Adiciona um produto antes de finalizar o pedido.</p>',
        '</div>',
        '<a class="button primary" href="index.html">Escolher produto</a>'
      ].join("") : (state.checkoutStep === 0 ? renderCheckoutContactStep() : renderCheckoutConfirmStep()),
      '</div>',
      getCartCount() > 0 && state.checkoutStep === 0 ? [
        '<div class="step-actions checkout-actions">',
        '<a class="button secondary" href="index.html" data-checkout-add-product>Adicionar outro produto</a>',
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

    document.querySelectorAll("[data-checkout-suspended-submit]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.errors = ordersSuspendedCheckoutMessage();
        renderCheckoutPage(home);
        bindCheckoutPage(home);
      });
    });

    var form = document.querySelector("#cart-checkout-form");
    if (form) {
      form.addEventListener("submit", function (event) {
        var error;
        var payload;

        if (ordersAreSuspended()) {
          event.preventDefault();
          state.errors = ordersSuspendedCheckoutMessage();
          renderCheckoutPage(home);
          bindCheckoutPage(home);
          return;
        }

        error = validateCheckoutStep(0) || validateCheckoutCopyRequest();

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
          cart_context: payload.cart_context,
          item_count: payload.items.length,
          subtotal_cents: checkoutSubtotalCents()
        });
      });
    }
  }

  function initAddProduct() {
    loadJson(ORDER_HOME_CONTENT).then(function (home) {
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
    loadJson(ORDER_HOME_CONTENT).then(function (home) {
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
        if (step.template === "palette-grid") {
          step.items.push({
            id: "paleta-" + Date.now(),
            value: "Nova combinação " + count,
            title: "Nova combinação " + count,
            palette: ["#173a63", "#e8d6b7", "#f5f1e7"]
          });
        } else if (step.template === "quantity-builder") {
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

    document.querySelectorAll("[data-admin-palette-color]").forEach(function (input) {
      input.addEventListener("click", function (event) { event.stopPropagation(); });
      input.addEventListener("change", function () {
        var step = product.steps.filter(function (candidate) { return candidate.id === input.dataset.stepId; })[0];
        var item = stepItemById(step, input.dataset.itemId);
        var index = Math.max(0, Math.min(2, parseInt(input.dataset.adminPaletteColor, 10) || 0));
        if (!item) {
          return;
        }
        pushUndo(product);
        if (!Array.isArray(item.palette)) {
          item.palette = ["#173a63", "#e8d6b7", "#f5f1e7"];
        }
        item.palette[index] = safeSwatchColor(input.value);
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-individual-color]").forEach(function (input) {
      input.addEventListener("click", function (event) { event.stopPropagation(); });
      input.addEventListener("change", function () {
        var step = product.steps.filter(function (candidate) { return candidate.id === input.dataset.stepId; })[0];
        var index = parseInt(input.dataset.adminIndividualColor, 10);
        if (!step) {
          step = currentStep(product);
        }
        if (!step || !Array.isArray(step.individualColors) || !step.individualColors[index]) {
          return;
        }
        pushUndo(product);
        step.individualColors[index].swatch = safeSwatchColor(input.value);
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-add-individual-color]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        var step = product.steps.filter(function (candidate) { return candidate.id === button.dataset.stepId; })[0];
        var count;
        event.preventDefault();
        event.stopPropagation();
        if (!step) {
          return;
        }
        if (!Array.isArray(step.individualColors)) {
          step.individualColors = [];
        }
        count = step.individualColors.length + 1;
        pushUndo(product);
        step.individualColors.push({ id: "cor-" + Date.now(), value: "Cor " + count, title: "Cor " + count, swatch: "#d8d1c2" });
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-delete-individual-color]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        var step = product.steps.filter(function (candidate) { return candidate.id === button.dataset.stepId; })[0];
        var index = parseInt(button.dataset.adminDeleteIndividualColor, 10);
        event.preventDefault();
        event.stopPropagation();
        if (!step || !Array.isArray(step.individualColors) || !step.individualColors[index]) {
          return;
        }
        pushUndo(product);
        step.individualColors.splice(index, 1);
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
    Promise.all([
      loadJson(homeContentPath),
      homeContentPath === "content/home.json" ? Promise.resolve(null) : loadJson("content/home.json").catch(function () { return null; })
    ]).then(function (results) {
      var home = results[0];
      var menuHome = results[1] || home;

      state.siteMenuCategories = Array.isArray(menuHome.categories) ? menuHome.categories : [];
      applySiteSettings(home);
      if (window.MiaButterflies && window.MiaButterflies.refresh) {
        window.MiaButterflies.refresh();
      }
      return enrichHomeWithCarousels(home);
    }).then(renderHome).catch(function (error) {
      app.innerHTML = '<main class="fallback"><h1>Mia &amp; Paper</h1><p>' + escapeHtml(error.message) + '</p></main>';
    });
  }

  function applyContactProductContext() {
    var params;
    var productName;
    var form;
    var subject;
    var message;

    if (page !== "contact") {
      return;
    }
    params = new URLSearchParams(window.location.search);
    productName = String(params.get("produto") || "").trim().slice(0, 60);
    if (!productName) {
      return;
    }

    form = document.querySelector(".contact-form");
    subject = form ? form.querySelector("[name='subject_type']") : null;
    message = form ? form.querySelector("[name='message']") : null;
    if (subject) {
      subject.value = "Encomendas";
    }
    if (message && !String(message.value || "").trim()) {
      message.value = "Quero pedir " + productName + ".";
    }
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
      loadJson(ORDER_HOME_CONTENT).catch(function () { return null; }),
      loadJson("content/home.json").catch(function () { return null; }),
      loadJson(COLORS_API).catch(function () { return null; })
    ]).then(function (results) {
      var product;
      var productSiteSettings = Object.assign({}, results[2] || {});
      var menuHome = results[3] || results[2] || {};
      if (results[0] && results[0].ordersSuspended === true) {
        productSiteSettings.ordersSuspended = true;
      }
      applySiteSettings(productSiteSettings);
      state.siteMenuCategories = Array.isArray(menuHome.categories) ? menuHome.categories : [];
      if (window.MiaButterflies && window.MiaButterflies.refresh) {
        window.MiaButterflies.refresh();
      }
      product = applyPricingToProduct(applyColorCatalog(results[0], results[4]), results[1]);
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
      var initialStep = currentStep(product);
      var startedKey = "mp_funnel_wizard_started_" + String(product.catalogContext || "main") + "_" + (product.slug || "");
      var alreadyStarted = false;
      try { alreadyStarted = window.sessionStorage.getItem(startedKey) === "1"; } catch (err) {}
      if (!alreadyStarted) {
        try { window.sessionStorage.setItem(startedKey, "1"); } catch (err) {}
        trackProductEvent(product, 'wizard_started', {
          // Usa o primeiro passo realmente visível. Crachás e ímanes mantêm
          // o antigo passo `designs` no JSON apenas como configuração oculta;
          // registá-lo aqui faria o funil começar numa etapa que a pessoa
          // nunca viu.
          step_id: initialStep ? initialStep.id : '',
          step_index: state.currentStep
        });
      }
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

  var paletteLiquidEffectsReady = false;
  var paletteOrientationPermissionAsked = false;

  // ==== MiaWater: água com física real nos quadrados da paleta ==============
  // Modelo shallow-water 1D por colunas: cada coluna tem altura h[] e entre
  // colunas vizinhas há um fluxo f[]. A pressão (diferença de alturas) e a
  // gravidade ao longo da inclinação empurram o fluxo; mover o fluxo transporta
  // altura conservando a massa -> ondas e slosh reais. O jorro adiciona volume
  // no centro; o salpico são partículas balísticas (gravidade a sério) que ao
  // cair de volta fazem ondinhas na superfície.
  var miaWaterTilt = 0;            // -1..1, partilhado (dedo/rato/telemóvel)
  var miaWaterSims = [];

  function miaWaterClamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function miaWaterWakeAll() {
    for (var i = 0; i < miaWaterSims.length; i++) { miaWaterSims[i].wake(); }
  }

  function miaWaterFindSim(slot) {
    for (var i = 0; i < miaWaterSims.length; i++) {
      if (miaWaterSims[i].slot === slot) { return miaWaterSims[i]; }
    }
    return null;
  }

  function miaWaterScan() {
    for (var i = miaWaterSims.length - 1; i >= 0; i--) {
      if (!miaWaterSims[i].canvas.isConnected) { miaWaterSims[i].destroy(); }
    }
    var list = document.querySelectorAll("canvas.pcs__canvas");
    for (var j = 0; j < list.length; j++) {
      if (!list[j].__miaWater) { list[j].__miaWater = true; miaWaterCreate(list[j]); }
    }
  }

  function miaWaterCreate(canvas) {
    var slot = canvas.parentNode;
    if (!slot) { return; }
    var ctx = canvas.getContext("2d");
    if (!ctx) { return; }

    var TARGET = 0.96;                     // nível cheio (deixa um fio no topo)
    var mode = canvas.getAttribute("data-water-pour");
    var pouring = mode === "1";
    var draining = mode === "drain";
    var level = pouring ? 0 : TARGET;      // altura da água (0..1)
    // data-water-duration dá o tempo (ms) que a água leva a subir ou a descer,
    // para casar com a animação dos círculos. Sem ele, mantém o ritmo antigo.
    var span = Number(canvas.getAttribute("data-water-duration")) || 0;
    var rate = span > 0 ? TARGET / (span / (1000 / 60)) : 0.065;
    var amp = 0;                            // amplitude da ondinha da superfície
    var phase = 0;                          // fase da onda
    var tiltCur = 0;                        // inclinação suavizada
    var W = 1, H = 1, SAMP = 16;
    var dpr = miaWaterClamp(window.devicePixelRatio || 1, 1, 2);
    var running = false, rafId = 0, lastT = 0, acc = 0, restFrames = 0, tSec = 0;
    var rgb, colTop, colBottom, colStream;

    function toRgb(c) {
      ctx.fillStyle = "#000";
      ctx.fillStyle = c;                   // normaliza para #rrggbb ou rgb()/rgba()
      var s = ctx.fillStyle;
      if (s.charAt(0) === "#") {
        return [parseInt(s.substr(1, 2), 16), parseInt(s.substr(3, 2), 16), parseInt(s.substr(5, 2), 16)];
      }
      var m = s.match(/[\d.]+/g) || [79, 122, 58];
      return [Number(m[0]), Number(m[1]), Number(m[2])];
    }
    function mix(a, b, t) {
      return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
    }
    function css(c, alpha) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (alpha == null ? 1 : alpha) + ")"; }
    function readColor() {
      var raw = getComputedStyle(slot).getPropertyValue("--palette-preview-color").trim() || "#4f7a3a";
      rgb = toRgb(raw);
      colTop = css(mix(rgb, [255, 255, 255], 0.14));   // topo da água mais claro
      colBottom = css(mix(rgb, [15, 10, 4], 0.22));    // fundo mais escuro
      colStream = css(mix(rgb, [255, 255, 255], 0.10), 0.95);
    }
    function resize() {
      var r = slot.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Altura da água (fração 0..1) na posição x (0..1): nível + ondinha + inclinação.
    function levelAt(xf) {
      return level
        + amp * Math.sin(xf * 9.4 + phase)
        + tiltCur * 0.18 * (xf - 0.5);
    }

    function physics() {
      tSec += 1 / 60;
      phase += 0.11;                                 // a ondinha anda devagar
      tiltCur += (miaWaterTilt - tiltCur) * 0.18;    // segue a inclinação (responsivo)
      if (pouring) {
        level += rate;                               // sobe até encher
        amp = Math.min(0.03, amp + 0.0022);          // ondula ao encher
        if (level >= TARGET) { level = TARGET; pouring = false; }
      } else if (draining) {
        level -= rate;                               // desce ao mesmo ritmo
        amp = Math.min(0.03, amp + 0.0022);
        if (level <= 0) {
          level = 0;
          draining = false;
        }
      } else {
        amp *= 0.94;                                 // assenta e fica calma
      }
    }

    function render() {
      ctx.clearRect(0, 0, W, H);
      var i, xf, x, y, minY = H;
      ctx.beginPath();                               // corpo de água
      ctx.moveTo(0, H + 2);
      for (i = 0; i <= SAMP; i++) {
        xf = i / SAMP; x = xf * W; y = H - miaWaterClamp(levelAt(xf), 0, 1.05) * H;
        if (y < minY) { minY = y; }
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H + 2);
      ctx.closePath();
      var g = ctx.createLinearGradient(0, miaWaterClamp(minY, 0, H - 1), 0, H);
      g.addColorStop(0, colTop); g.addColorStop(1, colBottom);
      ctx.fillStyle = g; ctx.fill();
      ctx.beginPath();                               // linha de superfície (brilho)
      for (i = 0; i <= SAMP; i++) { xf = i / SAMP; x = xf * W; y = H - miaWaterClamp(levelAt(xf), 0, 1.05) * H; if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); } }
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.1; ctx.lineJoin = "round"; ctx.stroke();
    }

    function frame(t) {
      if (!running) { return; }
      if (!canvas.isConnected) { destroy(); return; }
      if (!lastT) { lastT = t; }
      var dt = t - lastT; lastT = t;
      if (dt > 60) { dt = 60; }
      acc += dt;
      var steps = 0;
      while (acc >= 16.6667 && steps < 5) { physics(); acc -= 16.6667; steps++; }
      render();
      var active = pouring || draining || amp > 0.002 || Math.abs(miaWaterTilt) > 0.01 || Math.abs(tiltCur) > 0.01;
      restFrames = active ? 0 : restFrames + 1;
      if (restFrames > 45) { running = false; rafId = 0; return; }   // dorme parado
      rafId = window.requestAnimationFrame(frame);
    }

    function wake() {
      if (running || !canvas.isConnected) { return; }
      running = true; lastT = 0; restFrames = 0;
      rafId = window.requestAnimationFrame(frame);
    }
    function destroy() {
      running = false;
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
      var idx = miaWaterSims.indexOf(sim);
      if (idx >= 0) { miaWaterSims.splice(idx, 1); }
    }
    function poke() {
      amp = Math.max(amp, 0.02);   // toque/clique -> uma ondinha
      wake();
    }

    var sim = { canvas: canvas, slot: slot, wake: wake, destroy: destroy, poke: poke, resize: function () { resize(); wake(); } };

    readColor();
    resize();
    // Pinta já, no mesmo frame: sem isto o canvas fica um frame em branco a
    // seguir a cada re-render e vê-se o fundo pálido do quadrado a piscar.
    render();
    miaWaterSims.push(sim);
    wake();
  }

  // A água acabou de escoar: o quadrado pode passar a vazio de vez.


  function initPaletteLiquidEffects() {
    if (paletteLiquidEffectsReady) { return; }
    paletteLiquidEffectsReady = true;

    function requestOrientationPermission() {
      if (paletteOrientationPermissionAsked || typeof window.DeviceOrientationEvent === "undefined" || typeof window.DeviceOrientationEvent.requestPermission !== "function") { return; }
      paletteOrientationPermissionAsked = true;
      window.DeviceOrientationEvent.requestPermission().catch(function () {});
    }

    document.addEventListener("pointermove", function (event) {
      var comp = event.target && event.target.closest ? event.target.closest(".palette-composition") : null;
      if (!comp) { return; }
      var rect = comp.getBoundingClientRect();
      miaWaterTilt = miaWaterClamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
      miaWaterWakeAll();
    });

    document.addEventListener("pointerleave", function (event) {
      var t = event.target;
      if (t && t.classList && t.classList.contains("palette-composition")) {
        miaWaterTilt = 0; miaWaterWakeAll();
      }
    }, true);

    document.addEventListener("pointerdown", function (event) {
      var slot = event.target && event.target.closest ? event.target.closest(".palette-composition__slot.is-filled") : null;
      requestOrientationPermission();
      if (!slot) { return; }
      var sim = miaWaterFindSim(slot);
      if (sim) {
        var rect = slot.getBoundingClientRect();
        sim.poke(miaWaterClamp((event.clientX - rect.left) / rect.width, 0, 1));
      }
    });

    window.addEventListener("deviceorientation", function (event) {
      if (event == null || event.gamma == null) { return; }
      miaWaterTilt = miaWaterClamp(Number(event.gamma) / 40, -1, 1);
      miaWaterWakeAll();
    }, true);

    var scanQueued = false;
    function queueScan() {
      if (scanQueued) { return; }
      scanQueued = true;
      window.requestAnimationFrame(function () { scanQueued = false; miaWaterScan(); });
    }
    if (typeof window.MutationObserver === "function" && document.body) {
      new window.MutationObserver(queueScan).observe(document.body, { childList: true, subtree: true });
    }
    window.addEventListener("resize", function () {
      for (var i = 0; i < miaWaterSims.length; i++) { miaWaterSims[i].resize(); }
    });
    miaWaterScan();
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
  if (page !== "preview") {
    initPaletteLiquidEffects();
  }

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
    applyContactProductContext();
    bindThemeToggle();
    refreshCartUi();
    applyTheme(currentTheme());
    loadJson("content/home.json").then(function (home) {
      applySiteSettings(home);
      installStaticSiteNavigation(home);
      refreshCartUi();
      if (window.MiaButterflies && window.MiaButterflies.refresh) {
        window.MiaButterflies.refresh();
      }
    }).catch(function () {});
  }

  // GALERIA_PREVIEW_V1
  // A galeria (galeria-preview.html) desenha os cartões com as MESMAS funções
  // que o site usa, para a pré-visualização ser um fac-símile e não uma cópia
  // que se desactualiza. Só é usada quando data-page="preview".
  window.MiaPreview = {
    renderHome: function (home) {
      var previewHome = cloneJson(home || {});

      state.admin = false;
      if (previewHome.hero && typeof previewHome.hero === "object") {
        previewHome.hero.carouselEnabled = false;
      }
      (previewHome.categories || []).forEach(function (category) {
        category.carouselRandomizeOnLoad = false;
        category.carouselImages = Array.isArray(category.carouselSourceImages)
          ? category.carouselSourceImages.filter(Boolean)
          : [];
      });
      renderHome(previewHome);
    },
    shellClass: function (product) {
      return [
        "product-shell",
        productSlugClass(product),
        productShapeClass(product),
        productOrientationClass(product)
      ].join(" ");
    },
    stepCardClass: function (step) {
      return "step-card" + (isDetailsMediaComposer(step) ? " step-card--media-composer" : "");
    },
    // Devolve o HTML do corpo do passo tal como aparece no site.
    renderStep: function (product, stepIndex, selections) {
      var step = product && product.steps ? product.steps[stepIndex] : null;

      if (!step) {
        return "";
      }

      state.admin = false;
      state.product = product;
      state.selections = selections || {};
      state.currentStep = stepIndex;
      state.itemDisplayLabels = {};
      ensureCadernoScopedImageSlots(product);
      rebuildProductDisplayLabels(product);

      return stepBody(product, step) + renderQuadrosBuildSummary(product, step);
    }
  };

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

  window.addEventListener("pagehide", function () {
    if (page !== "product") {
      return;
    }
    invalidateOrderFilePickerSession();
    cancelOrderUploadOperations(function (operation) {
      return operation.type === "upload";
    });
    cancelOrderAudioActivity();
  });

  window.addEventListener("pageshow", function (event) {
    if (page !== "product" || !event.persisted) {
      return;
    }
    if (window.sessionStorage.getItem("miaandpaper-reset-" + productSlug) === "1") {
      window.location.reload();
      return;
    }
    state.errors = "";
    state.invalidFields = [];
    state.orderUploadError = "";
    state.orderUploadMessage = "";
    state.orderUploadFeedbackKind = "";
    state.orderUploadProgress = null;
    invalidateOrderFilePickerSession();
    cancelOrderUploadOperations(function (operation) {
      return operation.type === "upload";
    });
    cancelOrderAudioActivity();
    syncOrderUploadBusy();
    if (state.product) {
      rerenderProduct(state.product);
    }
  });
}());
