// js/03-conteudo-home.js — parte 03/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: loadJson, catalogo de cores (applyColorCatalog), settings do site (ensureHomeSettings/applySiteSettings, suspensao de encomendas), carrosseis da home e do hero, countdown de deadline, cloneProduct.
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

