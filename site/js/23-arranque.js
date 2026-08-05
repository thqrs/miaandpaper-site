// js/23-arranque.js — parte 23/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: arranque do site: initProduct, agua da paleta (MiaWater, fisica shallow-water nos quadrados), initCookieBanner + window.MiaCookieConsent, window.MiaPreview, bootstrap (applyTheme, render inicial por pagina, initButterflyFriend, listeners de storage/pagehide/pageshow).
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
      var startedKey = "mp_funnel_wizard_started_" + (product.slug || "");
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
