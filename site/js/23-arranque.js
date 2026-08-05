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
      seedBuilderDebugUploads(product);
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

  // ==== COLOR_PICKER_V3 ====================================================
  // `?picker=1` abre um painel flutuante para experimentar cores. O painel nao
  // tem uma lista fixa: percorre o registo abaixo e mostra so os controlos que
  // estao mesmo no ecra naquele momento, em qualquer pagina. A cor de cada
  // linha e a que o browser esta a calcular para esse controlo, por isso segue
  // o tema, o passo e a paleta escolhida.
  //
  // Pintar e feito por uma folha de estilo propria (regras com !important) e
  // nao por variaveis: assim funciona com qualquer controlo sem ser preciso
  // preparar o CSS do site controlo a controlo.
  var COLOR_PICKER_SESSION_KEY = "miaandpaper-color-picker";
  var COLOR_PICKER_STORE_KEY = "miaandpaper-color-palettes";
  var COLOR_PICKER_STYLE_ID = "mia-color-picker-style";

  // `read` e a propriedade lida para mostrar a cor actual; `paint` sao as que
  // levam a cor escolhida.
  var COLOR_PICKER_CONTROLS = [
    { id: "botao-principal", label: "Botão principal", selector: ".button.primary", read: "backgroundColor", paint: ["background-color"] },
    { id: "botao-secundario", label: "Botão secundário", selector: ".button.secondary", read: "color", paint: ["color", "border-color"] },
    { id: "pack", label: "Packs", selector: ".pack-option", read: "backgroundColor", paint: ["background-color"] },
    { id: "pack-escolhido", label: "Pack escolhido", selector: ".pack-option.is-selected", read: "borderColor", paint: ["border-color"] },
    { id: "cartao-escolha", label: "Cartões de escolha", selector: ".choice-card", read: "backgroundColor", paint: ["background-color"] },
    { id: "slider", label: "Slider", selector: ".free-quantity-slider input[type=\"range\"]", read: "color", paint: [], varName: "--pick-slider" },
    { id: "slider-botoes", label: "Botões +/−", selector: ".free-quantity-control button", read: "backgroundColor", paint: ["background-color"] },
    { id: "leitura-quantidade", label: "Número da quantidade", selector: ".free-quantity-readout strong", read: "color", paint: ["color"] },
    { id: "caixa-preco", label: "Caixa de preços", selector: ".pack-price-card", read: "backgroundColor", paint: ["background-color"] },
    { id: "grupo", label: "Grupo (cabeçalho)", selector: ".builder-group > .builder-group-tile", read: "backgroundColor", paint: ["background-color"] },
    { id: "gaveta", label: "Gaveta", selector: ".builder-group-drawer", read: "backgroundColor", paint: ["background-color"] },
    { id: "opcao-gaveta", label: "Opção da gaveta", selector: ".builder-variant", read: "backgroundColor", paint: ["background-color"] },
    { id: "quantidade-pack", label: "Botões de pack", selector: ".builder-quantity-tile", read: "backgroundColor", paint: ["background-color"] },
    { id: "quantidade-passo", label: "Botões da quantidade", selector: ".builder-quantity-input button", read: "color", paint: ["color"] },
    { id: "remover", label: "Botão remover", selector: ".builder-card-remove", read: "backgroundColor", paint: ["background-color", "border-color"] },
    { id: "total", label: "Caixa do total", selector: ".builder-total", read: "backgroundColor", paint: ["background-color"] },
    { id: "resumo", label: "O que vais encomendar", selector: ".crachas-step2-summary", read: "backgroundColor", paint: ["background-color"] },
    { id: "passos", label: "Números dos passos", selector: ".step-list button", read: "color", paint: ["color"] },
    { id: "entrega", label: "Opções de entrega", selector: ".delivery-option", read: "backgroundColor", paint: ["background-color"] },
    { id: "cabecalho", label: "Links do cabeçalho", selector: ".header-link", read: "color", paint: ["color"] },
    { id: "carrinho-flutuante", label: "Botão do carrinho", selector: ".cart-floating-button", read: "backgroundColor", paint: ["background-color"] },
    { id: "categoria", label: "Cartões de categoria", selector: ".category-card", read: "backgroundColor", paint: ["background-color"] },
    { id: "review", label: "Balão das reviews", selector: ".review-bubble-card", read: "backgroundColor", paint: ["background-color"] },
    { id: "cookies", label: "Aceitar cookies", selector: ".cookie-banner-accept", read: "backgroundColor", paint: ["background-color"] }
  ];

  // Sugestoes para explorar depressa quanta separacao dar aos tres niveis do
  // passo 2 (cabecalho do grupo / gaveta / opcao). Ficam dentro da familia de
  // cores do site, mas nao se limitam aos tokens oficiais: o que interessa e
  // variar a distancia entre eles.
  var COLOR_PICKER_PRESETS = [
    { id: "preset:suave", name: "Suave", colors: { "grupo": "#fffdf5", "gaveta": "#f6e7bf", "opcao-gaveta": "#fffdf5" } },
    { id: "preset:actual", name: "Média (actual)", colors: { "grupo": "#f6e7bf", "gaveta": "#e7d3a4", "opcao-gaveta": "#ffffff" } },
    { id: "preset:funda", name: "Gaveta funda", colors: { "grupo": "#f9edcd", "gaveta": "#dcc590", "opcao-gaveta": "#fffefa" } },
    { id: "preset:areia", name: "Areia quente", colors: { "grupo": "#f3e3bb", "gaveta": "#e0cb9a", "opcao-gaveta": "#fffdf3" } },
    { id: "preset:oliva", name: "Oliva discreta", colors: { "grupo": "#efe9d6", "gaveta": "#d8d2b2", "opcao-gaveta": "#fffdf5" } },
    { id: "preset:forte", name: "Contraste alto", colors: { "grupo": "#efdcaa", "gaveta": "#cdb27a", "opcao-gaveta": "#ffffff" } },
    { id: "preset:invertida", name: "Gaveta clara", colors: { "grupo": "#e7d3a4", "gaveta": "#fffdf5", "opcao-gaveta": "#f6e7bf" } },
    // Medidas na pagina dos cadernos anuais: cartao da opcao de compra
    // (#fffdf8), painel que abre por baixo (#fffaf0) e a moldura de dentro
    // (#f6ead1). Aqui a cor esta na opcao e nao na gaveta.
    { id: "preset:cadernos", name: "Cadernos", colors: { "grupo": "#fffdf8", "gaveta": "#fffaf0", "opcao-gaveta": "#f6ead1" } },
    { id: "preset:cadernos-2", name: "Cadernos (gaveta com cor)", colors: { "grupo": "#fffdf8", "gaveta": "#f6ead1", "opcao-gaveta": "#fffdf8" } }
  ];

  function colorPickerPreset(id) {
    return COLOR_PICKER_PRESETS.filter(function (preset) {
      return preset.id === id;
    })[0] || null;
  }

  // As linhas (bordas) do ecra, para se poderem afinar em separado dos fundos.
  // So entram as que existem mesmo: o `visiveis()` exige tambem que a borda
  // tenha espessura, senao a linha do painel nao pintava nada.
  var COLOR_PICKER_LINE_CONTROLS = [
    { id: "linha:wizard", label: "Contorno do wizard", selector: ".wizard-shell", read: "borderTopColor", paint: ["border-color"] },
    { id: "linha:cartao-passo", label: "Contorno do passo", selector: ".step-card", read: "borderTopColor", paint: ["border-color"] },
    { id: "linha:titulo", label: "Traço do título", selector: ".section-title", read: "borderBottomColor", paint: ["border-bottom-color"] },
    { id: "linha:painel-imagem", label: "Painel da imagem", selector: ".builder-design-block", read: "borderTopColor", paint: ["border-color"] },
    { id: "linha:imagem", label: "Moldura da imagem", selector: ".builder-design-preview", read: "borderTopColor", paint: ["border-color"] },
    { id: "linha:grupo", label: "Cartão do grupo", selector: ".builder-group > .builder-group-tile", read: "borderTopColor", paint: ["border-color"] },
    { id: "linha:gaveta", label: "Gaveta", selector: ".builder-group-drawer", read: "borderBottomColor", paint: ["border-color"] },
    { id: "linha:opcao", label: "Opção da gaveta", selector: ".builder-variant", read: "borderTopColor", paint: ["border-color"] },
    { id: "linha:cartao-quantidade", label: "Cartão da quantidade", selector: ".builder-card", read: "borderTopColor", paint: ["border-color"] },
    { id: "linha:quantidade", label: "Campo da quantidade", selector: ".builder-quantity-input", read: "borderTopColor", paint: ["border-color"] },
    { id: "linha:quantidade-pack", label: "Botões de pack", selector: ".builder-quantity-tile", read: "borderTopColor", paint: ["border-color"] },
    { id: "linha:total", label: "Caixa do total", selector: ".builder-total", read: "borderTopColor", paint: ["border-color"] },
    { id: "linha:resumo", label: "O que vais encomendar", selector: ".crachas-step2-summary", read: "borderTopColor", paint: ["border-color"] },
    { id: "linha:cartao-escolha", label: "Cartões de escolha", selector: ".choice-card", read: "borderTopColor", paint: ["border-color"] },
    { id: "linha:pack", label: "Packs", selector: ".pack-option", read: "borderTopColor", paint: ["border-color"] },
    { id: "linha:caixa-preco", label: "Caixa de preços", selector: ".pack-price-card", read: "borderTopColor", paint: ["border-color"] },
    { id: "linha:botao-secundario", label: "Botão secundário", selector: ".button.secondary", read: "borderTopColor", paint: ["border-color"] },
    { id: "linha:entrega", label: "Opções de entrega", selector: ".delivery-option", read: "borderTopColor", paint: ["border-color"] }
  ];

  function colorPickerIsLine(id) {
    return String(id || "").indexOf("linha:") === 0;
  }

  function colorPickerRequested() {
    var wanted;
    try {
      wanted = currentUrlParams().get("picker");
    } catch (error) {
      wanted = null;
    }
    if (wanted === "1") {
      try { window.sessionStorage.setItem(COLOR_PICKER_SESSION_KEY, "1"); } catch (error) {}
      return true;
    }
    try {
      if (currentUrlParams().get("line_picker") === "1") {
        try { window.sessionStorage.setItem(COLOR_PICKER_SESSION_KEY, "1"); } catch (error) {}
        return true;
      }
    } catch (error) {}
    if (wanted === "0") {
      try { window.sessionStorage.removeItem(COLOR_PICKER_SESSION_KEY); } catch (error) {}
      return false;
    }
    return safeSessionGetItem(COLOR_PICKER_SESSION_KEY) === "1";
  }

  function colorPickerStore() {
    var guardado = safeStorageGetItem(COLOR_PICKER_STORE_KEY);
    var dados = null;

    try {
      dados = guardado ? JSON.parse(guardado) : null;
    } catch (error) {
      dados = null;
    }
    if (!dados || typeof dados !== "object" || !Array.isArray(dados.palettes)) {
      dados = { activeId: "", palettes: [] };
    }
    dados.activeId = String(dados.activeId || "");
    dados.mode = dados.mode === "linha" ? "linha" : "fundo";
    dados.palettes = dados.palettes.filter(function (palette) {
      return palette && palette.id && palette.colors && typeof palette.colors === "object";
    });
    return dados;
  }

  function colorPickerPersist(dados) {
    safeStorageSetItem(COLOR_PICKER_STORE_KEY, JSON.stringify(dados));
  }

  function colorPickerActive(dados) {
    return colorPickerPreset(dados.activeId) || dados.palettes.filter(function (palette) {
      return palette.id === dados.activeId;
    })[0] || null;
  }

  // Presets e Original nao se editam: mexer neles cria uma paleta a partir do
  // que estava a ser mostrado.
  function colorPickerEditable(dados) {
    return dados.palettes.filter(function (palette) {
      return palette.id === dados.activeId;
    })[0] || null;
  }

  // As cores do proprio design, para o selector nativo as oferecer como
  // swatches em vez de se ter de acertar o hex a olho.
  var COLOR_PICKER_SWATCH_VARS = [
    "--moss", "--gold", "--gold-soft", "--rose", "--sage", "--blue",
    "--ink", "--muted", "--linen", "--paper", "--card"
  ];
  var COLOR_PICKER_SWATCH_ID = "mia-color-picker-swatches";

  function colorPickerSwatches() {
    var lista = document.getElementById(COLOR_PICKER_SWATCH_ID);
    var raiz = window.getComputedStyle(document.documentElement);
    var vistos = {};
    var opcoes = [];

    if (!lista) {
      lista = document.createElement("datalist");
      lista.id = COLOR_PICKER_SWATCH_ID;
      document.body.appendChild(lista);
    }
    COLOR_PICKER_SWATCH_VARS.forEach(function (nome) {
      var hex = String(raiz.getPropertyValue(nome) || "").trim();

      if (/^#[0-9a-f]{3}$/i.test(hex)) {
        hex = "#" + hex.slice(1).split("").map(function (c) { return c + c; }).join("");
      }
      if (!/^#[0-9a-f]{6}$/i.test(hex) || vistos[hex.toLowerCase()]) {
        return;
      }
      vistos[hex.toLowerCase()] = true;
      opcoes.push('<option value="' + escapeHtml(hex) + '"></option>');
    });
    lista.innerHTML = opcoes.join("");
    return lista.id;
  }

  function colorPickerSwatchList() {
    var raiz = window.getComputedStyle(document.documentElement);
    var vistos = {};
    var cores = [];

    COLOR_PICKER_SWATCH_VARS.forEach(function (nome) {
      var hex = String(raiz.getPropertyValue(nome) || "").trim();

      if (/^#[0-9a-f]{3}$/i.test(hex)) {
        hex = "#" + hex.slice(1).split("").map(function (c) { return c + c; }).join("");
      }
      if (!/^#[0-9a-f]{6}$/i.test(hex) || vistos[hex.toLowerCase()]) {
        return;
      }
      vistos[hex.toLowerCase()] = true;
      cores.push({ hex: hex, nome: nome.replace(/^--/, "") });
    });
    return cores;
  }

  function colorPickerClearFlash() {
    document.querySelectorAll(".mia-picker-flash").forEach(function (alvo) {
      alvo.classList.remove("mia-picker-flash");
    });
  }

  // Pisca o sitio onde a cor aparece, para nao haver duvida sobre o que e que
  // cada linha do painel esta a pintar.
  function colorPickerFlash(control) {
    var alvos;

    try {
      alvos = document.querySelectorAll(control.selector);
    } catch (error) {
      return;
    }
    Array.prototype.slice.call(alvos, 0, 40).forEach(function (alvo) {
      alvo.classList.remove("mia-picker-flash");
      // Reinicia a animacao quando se mexe na mesma cor duas vezes seguidas.
      void alvo.offsetWidth;
      alvo.classList.add("mia-picker-flash");
      window.setTimeout(function () {
        alvo.classList.remove("mia-picker-flash");
      }, 1400);
    });
  }

  function colorPickerControl(id) {
    return COLOR_PICKER_CONTROLS.concat(COLOR_PICKER_LINE_CONTROLS).filter(function (control) {
      return control.id === id;
    })[0] || null;
  }

  function colorPickerMatch(control) {
    try {
      return document.querySelector(control.selector);
    } catch (error) {
      return null;
    }
  }

  function colorPickerHex(valor) {
    var partes = String(valor || "").match(/\d+/g);

    if (!partes || partes.length < 3) {
      return "#000000";
    }
    return "#" + partes.slice(0, 3).map(function (parte) {
      return ("0" + Math.max(0, Math.min(255, parseInt(parte, 10) || 0)).toString(16)).slice(-2);
    }).join("");
  }

  // A cor actual vem do elemento real quando ele existe. O slider e a excepcao:
  // a cor dele vive num pseudo-elemento que nao se consegue ler, por isso le-se
  // a variavel que o alimenta.
  function colorPickerCurrent(control, palette) {
    var guardada = palette && palette.colors ? palette.colors[control.id] : "";
    var alvo;
    var probe;
    var valor;

    if (/^#[0-9a-f]{6}$/i.test(String(guardada || ""))) {
      return guardada;
    }
    if (control.varName) {
      probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;color:var(" + control.varName + ", var(--moss))";
      document.body.appendChild(probe);
      valor = window.getComputedStyle(probe).color;
      document.body.removeChild(probe);
      return colorPickerHex(valor);
    }
    alvo = colorPickerMatch(control);
    if (!alvo) {
      return "#000000";
    }
    return colorPickerHex(window.getComputedStyle(alvo)[control.read]);
  }

  // Uma borda a zero nao se ve: nao vale a pena oferecer a cor dela.
  function colorPickerHasBorder(alvo) {
    var estilo = window.getComputedStyle(alvo);

    return ["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"].some(function (lado) {
      return parseFloat(estilo[lado]) > 0;
    });
  }

  function colorPickerApply(palette) {
    var folha = document.getElementById(COLOR_PICKER_STYLE_ID);
    var regras = [];

    if (!folha) {
      folha = document.createElement("style");
      folha.id = COLOR_PICKER_STYLE_ID;
      document.head.appendChild(folha);
    }
    if (!palette || !palette.colors) {
      folha.textContent = "";
      document.documentElement.style.removeProperty("--pick-slider");
      return;
    }

    document.documentElement.style.removeProperty("--pick-slider");
    Object.keys(palette.colors).forEach(function (id) {
      var control = colorPickerControl(id);
      var cor = palette.colors[id];

      if (!control || !/^#[0-9a-f]{6}$/i.test(String(cor || ""))) {
        return;
      }
      if (control.varName) {
        document.documentElement.style.setProperty(control.varName, cor);
      }
      if (control.paint.length) {
        regras.push(control.selector + "{" + control.paint.map(function (prop) {
          return prop + ":" + cor + " !important";
        }).join(";") + "}");
      }
    });
    folha.textContent = regras.join("\n");
  }

  function initColorPicker() {
    var painel;
    var lista;
    var observer = null;
    var observerTimer = 0;
    var dados;
    var seletor;
    var nome;
    var apagar;
    var tiras;
    var modo;
    var ultimoControlo = "";

    if (!document.body || !colorPickerRequested() || document.querySelector(".color-picker-panel")) {
      return;
    }

    dados = colorPickerStore();
    modo = currentUrlParams().get("line_picker") === "1" ? "linha" : String(dados.mode || "fundo");
    colorPickerApply(colorPickerActive(dados));
    colorPickerSwatches();

    painel = document.createElement("aside");
    painel.className = "color-picker-panel";
    painel.setAttribute("aria-label", "Experimentar cores");
    painel.innerHTML = [
      '<header><strong>Cores</strong><button type="button" data-color-picker-close aria-label="Fechar">×</button></header>',
      '<select data-color-picker-select aria-label="Paleta"></select>',
      '<input type="text" maxlength="40" data-color-picker-name aria-label="Nome da paleta" placeholder="Nome da paleta">',
      '<div class="color-picker-modes" role="group" aria-label="O que pintar">',
      '<button type="button" data-color-picker-mode="fundo">Fundos</button>',
      '<button type="button" data-color-picker-mode="linha">Linhas</button>',
      '</div>',
      '<div class="color-picker-list" data-color-picker-list></div>',
      '<div class="color-picker-swatches" data-color-picker-swatches></div>',
      '<div class="color-picker-actions">',
      '<button type="button" data-color-picker-new>+ Paleta</button>',
      '<button type="button" data-color-picker-delete>Apagar</button>',
      '</div>'
    ].join("");
    document.body.appendChild(painel);

    seletor = painel.querySelector("[data-color-picker-select]");
    nome = painel.querySelector("[data-color-picker-name]");
    apagar = painel.querySelector("[data-color-picker-delete]");
    lista = painel.querySelector("[data-color-picker-list]");
    tiras = painel.querySelector("[data-color-picker-swatches]");

    function desenharSeletor() {
      var activa = colorPickerActive(dados);

      seletor.innerHTML = [
        '<option value="">Original (site)</option>',
        '<optgroup label="Sugestões">' + COLOR_PICKER_PRESETS.map(function (preset) {
          return '<option value="' + escapeHtml(preset.id) + '">' + escapeHtml(preset.name) + '</option>';
        }).join("") + '</optgroup>',
        dados.palettes.length ? '<optgroup label="As minhas">' + dados.palettes.map(function (palette) {
          return '<option value="' + escapeHtml(palette.id) + '">' + escapeHtml(palette.name) + '</option>';
        }).join("") + '</optgroup>' : ''
      ].join("");
      var minha = colorPickerEditable(dados);

      seletor.value = activa ? activa.id : "";
      nome.hidden = !minha;
      if (document.activeElement !== nome) {
        nome.value = minha ? minha.name : "";
      }
      apagar.disabled = !minha;
    }

    // O painel e reconstruido a partir do que esta no ecra: navegar ou mudar de
    // passo muda as linhas. So se refaz o HTML quando o conjunto de controlos
    // visiveis muda, senao perdia-se o input que estivesse a ser arrastado.
    // Pela ordem em que se veem no ecra, de cima para baixo: e assim que se
    // procura um controlo, nao pela ordem em que foi registado no codigo.
    function visiveis() {
      var registo = modo === "linha" ? COLOR_PICKER_LINE_CONTROLS : COLOR_PICKER_CONTROLS;

      return registo.map(function (control) {
        var alvo = colorPickerMatch(control);
        var caixa;
        var fixo;

        if (!alvo || (modo === "linha" && !colorPickerHasBorder(alvo))) {
          return null;
        }
        caixa = alvo.getBoundingClientRect();
        fixo = window.getComputedStyle(alvo).position === "fixed";
        return {
          control: control,
          topo: caixa.top + (fixo ? 0 : window.pageYOffset),
          esquerda: caixa.left
        };
      }).filter(Boolean).sort(function (a, b) {
        return a.topo === b.topo ? a.esquerda - b.esquerda : a.topo - b.topo;
      }).map(function (entrada) {
        return entrada.control;
      });
    }

    function desenharLista() {
      var activa = colorPickerActive(dados);
      var presentes = visiveis();
      // A assinatura ignora a ordem: o painel so se refaz quando entra ou sai
      // um controlo. Sem isto as linhas trocavam de sitio a cada re-render,
      // porque a posicao no ecra mexe-se por tudo e por nada.
      var assinatura = modo + "#" + presentes.map(function (control) { return control.id; }).slice().sort().join("|");

      if (lista.dataset.assinatura !== assinatura) {
        lista.dataset.assinatura = assinatura;
        lista.innerHTML = presentes.length ? presentes.map(function (control) {
          return [
            '<label class="color-picker-row" data-color-picker-row="' + escapeHtml(control.id) + '">',
            '<input type="color" data-color-picker-control="' + escapeHtml(control.id) + '">',
            '<span class="color-picker-name">' + escapeHtml(control.label) + '</span>',
            '<code data-color-picker-hex="' + escapeHtml(control.id) + '"></code>',
            '</label>'
          ].join("");
        }).join("") : '<p class="color-picker-empty">Nada para pintar neste ecrã.</p>';
        lista.querySelectorAll("[data-color-picker-control]").forEach(function (input) {
          var control = colorPickerControl(input.dataset.colorPickerControl);

          input.addEventListener("input", function () {
            var alvo = colorPickerEditable(dados);

            // Original e sugestoes nunca se alteram: mexer numa delas abre uma
            // paleta nova ja com as cores que estavam a ser mostradas.
            if (!alvo) {
              alvo = novaPaleta(colorPickerActive(dados));
            }
            alvo.colors[input.dataset.colorPickerControl] = input.value;
            ultimoControlo = input.dataset.colorPickerControl;
            colorPickerApply(alvo);
            colorPickerPersist(dados);
            desenharSeletor();
            // O destaque sai de cena assim que se escolhe: ficava por cima da
            // cor que se esta a tentar avaliar.
            colorPickerClearFlash();
            lista.querySelector('[data-color-picker-hex="' + input.dataset.colorPickerControl + '"]').textContent = input.value;
          });
          // Tocar na linha mostra onde ela manda, antes sequer de escolher.
          input.addEventListener("focus", function () {
            ultimoControlo = input.dataset.colorPickerControl;
            colorPickerFlash(control);
          });
        });
      }

      presentes.forEach(function (control) {
        var input = lista.querySelector('[data-color-picker-control="' + control.id + '"]');
        var hex = colorPickerCurrent(control, activa);

        if (input && document.activeElement !== input) {
          input.value = hex;
        }
        lista.querySelector('[data-color-picker-hex="' + control.id + '"]').textContent = hex;
      });
    }

    function actualizarValores() {
      // Enquanto se esta a escolher uma cor o painel nao se toca: refazer o
      // HTML fecharia o selector nativo a meio da escolha.
      if (lista.contains(document.activeElement)) {
        return;
      }
      colorPickerSwatches();
      desenharLista();
    }

    function desenharTiras() {
      tiras.innerHTML = colorPickerSwatchList().map(function (cor) {
        return '<button type="button" class="color-picker-swatch" data-color-picker-swatch="' + escapeHtml(cor.hex) + '" title="' + escapeHtml(cor.nome + " · " + cor.hex) + '" style="background:' + escapeHtml(cor.hex) + '"></button>';
      }).join("");
    }

    // O swatch escreve na linha em que se mexeu por ultimo. `mousedown` com
    // preventDefault evita que o botao roube o foco a essa linha.
    tiras.addEventListener("mousedown", function (event) {
      var botao = event.target.closest("[data-color-picker-swatch]");
      var input;

      if (!botao) {
        return;
      }
      event.preventDefault();
      input = lista.querySelector('[data-color-picker-control="' + ultimoControlo + '"]');
      if (!input) {
        return;
      }
      input.value = botao.dataset.colorPickerSwatch;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    function desenharModos() {
      painel.querySelectorAll("[data-color-picker-mode]").forEach(function (botao) {
        botao.classList.toggle("is-active", botao.dataset.colorPickerMode === modo);
        botao.setAttribute("aria-pressed", botao.dataset.colorPickerMode === modo ? "true" : "false");
      });
    }

    painel.querySelectorAll("[data-color-picker-mode]").forEach(function (botao) {
      botao.addEventListener("click", function () {
        modo = botao.dataset.colorPickerMode;
        dados.mode = modo;
        colorPickerPersist(dados);
        desenharModos();
        actualizarValores();
      });
    });

    // Ao sair da escolha, actualiza o que ficou por actualizar.
    lista.addEventListener("focusout", function () {
      window.setTimeout(actualizarValores, 0);
    });

    // Tocar em qualquer parte da linha ja a torna a linha em uso: assim o
    // swatch sabe onde escrever mesmo que o `focus` do input nao chegue a
    // disparar (acontece quando a janela nao tem foco).
    lista.addEventListener("pointerdown", function (event) {
      var linha = event.target.closest("[data-color-picker-row]");
      var control;

      if (!linha) {
        return;
      }
      ultimoControlo = linha.dataset.colorPickerRow;
      control = colorPickerControl(ultimoControlo);
      if (control) {
        colorPickerFlash(control);
      }
    });

    function novaPaleta(base) {
      var palette = {
        id: "pal_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6),
        name: base && base.name ? base.name + " (cópia)" : "Paleta " + (dados.palettes.length + 1),
        colors: base && base.colors ? JSON.parse(JSON.stringify(base.colors)) : {}
      };

      dados.palettes.push(palette);
      dados.activeId = palette.id;
      return palette;
    }

    seletor.addEventListener("change", function () {
      dados.activeId = String(seletor.value || "");
      colorPickerApply(colorPickerActive(dados));
      colorPickerPersist(dados);
      desenharSeletor();
      actualizarValores();
    });

    nome.addEventListener("input", function () {
      var activa = colorPickerEditable(dados);
      var opcao;

      if (!activa) {
        return;
      }
      activa.name = nome.value;
      colorPickerPersist(dados);
      opcao = seletor.querySelector('option[value="' + activa.id + '"]');
      if (opcao) {
        opcao.textContent = activa.name;
      }
    });

    painel.querySelector("[data-color-picker-new]").addEventListener("click", function () {
      novaPaleta(colorPickerActive(dados));
      colorPickerApply(colorPickerActive(dados));
      colorPickerPersist(dados);
      desenharSeletor();
      actualizarValores();
      nome.focus();
      nome.select();
    });

    apagar.addEventListener("click", function () {
      dados.palettes = dados.palettes.filter(function (palette) {
        return palette.id !== dados.activeId;
      });
      dados.activeId = "";
      colorPickerApply(null);
      colorPickerPersist(dados);
      desenharSeletor();
      actualizarValores();
    });

    painel.querySelector("[data-color-picker-close]").addEventListener("click", function () {
      try { window.sessionStorage.removeItem(COLOR_PICKER_SESSION_KEY); } catch (error) {}
      if (observer) {
        observer.disconnect();
      }
      painel.remove();
    });

    desenharSeletor();
    desenharModos();
    desenharTiras();
    actualizarValores();

    // O site re-renderiza o passo inteiro a cada escolha: sem isto o painel
    // ficaria a mostrar os controlos do ecra anterior.
    observer = typeof window.MutationObserver === "function" ? new window.MutationObserver(function () {
      window.clearTimeout(observerTimer);
      observerTimer = window.setTimeout(actualizarValores, 140);
    }) : null;
    if (observer) {
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-theme"] });
    }
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
  initColorPicker();
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
