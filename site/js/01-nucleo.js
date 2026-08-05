// js/01-nucleo.js — parte 01/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: constantes de configuracao (chaves de storage, endpoints), storage seguro (safeStorage*/safeSession*), var state do wizard, templateLabels, escapeHtml/renderInlineText, favicon e fade da marca no scroll.
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
  // Igual a ORDER_MEDIA_*_MAX_BYTES no upload-order-photo.php. Aqui serve só
  // para não gastar a ligação de alguém a subir 200 MB que vão ser recusados no
  // fim; quem manda continua a ser o servidor.
  var ORDER_UPLOAD_MAX_BYTES = 40 * 1024 * 1024;
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
  var orderUploadRejectionLog = [];
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
    // Gavetas abertas no passo dos produtos da personalizacao: chave
    // designToken::grupo. E estado de interface, por isso vive fora das
    // selections (nao vai para o carrinho nem para o pedido).
    builderOpenGroups: {},
    // Gavetas de opções extra dos produtos. Tal como builderOpenGroups, é
    // apenas estado de interface e nunca segue no pedido.
    optionDrawerOpen: {},
    builderRemovePendingId: "",
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
  var ICON_BACK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 12H5m0 0 5.5-5.5M5 12l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 12.5 4.3 4.3L19 7" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
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
    "option-drawers": "Gavetas de opções extra",
    "details-form": "Formulário",
    "custom-product-builder": "Personalização: produtos",
    "custom-quantity-builder": "Personalização: quantidades",
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

  // Um url() relativo dentro de uma custom property (--x:url(content/...))
  // consumida por uma folha em css/ resolve contra css/, nao contra a pagina —
  // toda a imagem passada por var() ao CSS tem de vir daqui ja absoluta.
  function siteAssetUrl(value) {
    try {
      return new URL(String(value), document.baseURI).href;
    } catch (e) {
      return String(value);
    }
  }

  var miaSlotDebugFlatKeys = ["imageZoom", "imagePositionX", "imagePositionY", "imageRotation"];
  var miaSlotDebugSideFlatKeys = ["sideImageZoom", "sideImagePositionX", "sideImagePositionY", "sideImageRotation"];
  var miaSlotDebugFrameKeys = ["frameScale", "frameWidth", "frameHeight", "frameMarginX", "frameMarginY"];
  var miaSlotDebugSideFrameKeys = ["sideFrameScale", "sideFrameWidth", "sideFrameHeight", "sideFrameMarginX", "sideFrameMarginY"];

