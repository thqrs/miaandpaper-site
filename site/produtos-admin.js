(function () {
  "use strict";

  var DRAFT_KEY = "miaandpaper_products_mockup_v1";
  var GRAPH_DRAFT_KEY = "miaandpaper_products_graph_playground_v1";
  var GRAPH_POSITIONS_KEY = "miaandpaper_products_graph_positions_v2";
  var GALLERY_DONE_SYNC_KEY = "miaandpaper_gallery_done_sync_v1";
  var GALLERY_DONE_CHANNEL_NAME = "miaandpaper-gallery-done-v1";
  var galleryDoneChannel = typeof window.BroadcastChannel === "function"
    ? new window.BroadcastChannel(GALLERY_DONE_CHANNEL_NAME)
    : null;
  var galleryDoneRefreshPending = false;
  var PAGE_PARAMS = new URLSearchParams(window.location.search || "");
  var VISITOR_MODE = PAGE_PARAMS.get("visitors") === "1";
  var BAND_TITLE_SPACE = 30;
  var ZOOM_FAR = .46;
  var ZOOM_MID = .74;
  var ROUTE_CLEARANCE = 6;
  var GRID_LEFT = 246;
  var NODE_WIDTH = 168;
  var COLUMN_PITCH = 194;
  var COLUMN_PITCH_TIDY = 240;
  var LANE_OFFSETS = [0, 4, -4, 6, -6];
  var LANE_OFFSETS_TIDY = [0, 5, -5, 10, -10, 15, -15, 20, -20, 25, -25];
  var STEP_ROW = 84;
  var STEP_ROW_TIDY = 112;
  var PRODUCT_ROW = 68;
  var PRODUCT_ROW_TIDY = 96;
  var state = {
    payload: null,
    records: [],
    baseRecords: [],
    draft: { overrides: {}, custom: [] },
    categoryFilter: "all",
    search: "",
    kindFilter: "all",
    stateFilter: "all",
    currentKey: "",
    activeView: PAGE_PARAMS.get("view") === "graph" ? "graph" : "database",
    visitorMode: VISITOR_MODE,
    visitorPayload: { visitors: [], events: [], meta: {} },
    visitorIndex: { byNode: {}, currentNodeByVisitor: {}, visitors: {} },
    pendingNew: null,
    graphDraft: { addedEdges: [], removedEdges: [] },
    graphPositions: {},
    graph: {
      nodes: [],
      nodeById: {},
      baseEdges: [],
      allNodeById: {},
      allBaseEdges: [],
      clusters: [],
      hiddenFamilies: {},
      selectedId: "",
      linkSourceId: "",
      playground: false,
      collapsed: true,
      tidyEdges: true,
      memberRemap: {},
      layoutOriginX: 12,
      routes: null,
      expanded: false,
      galleryExpanded: false,
      zoom: 1,
      panX: 24,
      panY: 24,
      worldWidth: 1500,
      worldHeight: 900,
      fitted: false,
      panPointer: null,
      panMoved: false
    }
  };

  var statusNode = document.querySelector("[data-status]");
  var statsNode = document.querySelector("[data-stats]");
  var workspaceNode = document.querySelector("[data-workspace]");
  var switcherNode = document.querySelector("[data-view-switcher]");
  var listNode = document.querySelector("[data-products-list]");
  var rowTemplate = document.querySelector("#product-row-template");
  var treeNode = document.querySelector("[data-site-tree]");
  var sitemapNode = document.querySelector("[data-sitemap]");
  var editor = document.querySelector("[data-editor]");
  var editorForm = document.querySelector("[data-editor-form]");

  function text(value) {
    return String(value == null ? "" : value);
  }

  function escapeHtml(value) {
    return text(value).replace(/[&<>'"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character];
    });
  }

  function normalize(value) {
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-PT");
  }

  function safeImagePath(value) {
    var path = text(value).replace(/\\/g, "/");
    return path && !/^(?:[a-z]+:|\/|\.\.)/i.test(path) && path.indexOf("../") === -1 && !/[\x00-\x1f"'?#]/.test(path)
      ? path
      : "";
  }

  function readDraft() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "null");
      if (parsed && typeof parsed === "object") {
        state.draft.overrides = parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {};
        state.draft.custom = Array.isArray(parsed.custom) ? parsed.custom : [];
      }
    } catch (error) {
      state.draft = { overrides: {}, custom: [] };
    }
  }

  function saveDraft() {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(state.draft));
    updateDraftControl();
  }

  function readGraphDraft() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(GRAPH_DRAFT_KEY) || "null");
      if (parsed && typeof parsed === "object") {
        state.graphDraft.addedEdges = Array.isArray(parsed.addedEdges) ? parsed.addedEdges : [];
        state.graphDraft.removedEdges = Array.isArray(parsed.removedEdges) ? parsed.removedEdges : [];
      }
    } catch (error) {
      state.graphDraft = { addedEdges: [], removedEdges: [] };
    }
  }

  function saveGraphDraft() {
    window.localStorage.setItem(GRAPH_DRAFT_KEY, JSON.stringify(state.graphDraft));
    renderGraphChanges();
  }

  function readGraphPositions() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(GRAPH_POSITIONS_KEY) || "null");
      state.graphPositions = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      state.graphPositions = {};
    }
  }

  function saveGraphPositions() {
    try {
      window.localStorage.setItem(GRAPH_POSITIONS_KEY, JSON.stringify(state.graphPositions));
    } catch (error) {
      // A teia continua funcional mesmo se o browser bloquear o armazenamento local.
    }
    updateGraphPositionResetUi();
  }

  function updateGraphPositionResetUi() {
    var button = document.querySelector("[data-graph-reset-layout]");
    if (button) { button.disabled = Object.keys(state.graphPositions).length === 0; }
  }

  function resetGraphPositions() {
    if (!Object.keys(state.graphPositions).length) { return; }
    if (!window.confirm("Repor todos os nodes nas posições automáticas?")) { return; }
    state.graphPositions = {};
    window.localStorage.removeItem(GRAPH_POSITIONS_KEY);
    state.graph.fitted = false;
    renderGraph();
    fitGraph();
  }

  function hasDraft() {
    return Object.keys(state.draft.overrides).length > 0 || state.draft.custom.length > 0;
  }

  function updateDraftControl() {
    var clear = document.querySelector("[data-clear-draft]");
    if (clear) {
      clear.hidden = !hasDraft();
    }
  }

  function productSingular(slug, product) {
    var pricingProducts = state.payload && state.payload.pricing && state.payload.pricing.products;
    var pricing = pricingProducts && pricingProducts[slug] ? pricingProducts[slug] : null;
    var map = {
      caderninhos: "Mini-Caderno",
      "mini-cadernos": "Mini-Caderno",
      cadernos: "Caderno",
      "cadernos-anuais": "Caderno",
      crachas: "Crachá",
      "crachas-loja": "Crachá",
      pins: "Crachá",
      imanes: "Íman",
      "imanes-loja": "Íman",
      stickers: "Sticker",
      marcadores: "Marcador",
      bloquinhos: "Bloquinho",
      quadros: "Moldura",
      lembrancas: "Lembrança"
    };
    var singular = pricing && pricing.unitSingular ? pricing.unitSingular : map[slug];
    if (!singular && product && product.name) {
      singular = text(product.name).replace(/s$/i, "");
    }
    return singular ? singular.charAt(0).toLocaleUpperCase("pt-PT") + singular.slice(1) : "Produto";
  }

  function familyLabel(slug, product) {
    if (slug === "home") { return "Homepage"; }
    var map = {
      caderninhos: "Mini-Cadernos",
      "mini-cadernos": "Mini-Cadernos",
      cadernos: "Cadernos",
      "cadernos-anuais": "Cadernos anuais",
      crachas: "Crachás",
      "crachas-loja": "Crachás",
      pins: "Crachás (ficheiro antigo)",
      imanes: "Ímanes",
      "imanes-loja": "Ímanes",
      stickers: "Stickers",
      marcadores: "Marcadores",
      bloquinhos: "Bloquinhos",
      quadros: "Molduras",
      lembrancas: "Lembranças"
    };
    return map[slug] || text(product && product.name) || slug;
  }

  function composeName(slug, product, item) {
    var singular = productSingular(slug, product);
    var title = text(item && (item.publicTitle || item.title || item.value || item.id)).trim();
    var normalizedTitle = normalize(title);
    var normalizedSingular = normalize(singular);

    if (slug === "quadros" && normalizedTitle === "super personalizado") {
      return "Moldura Super Personalizada";
    }
    if (!title) {
      return singular;
    }
    if (normalizedTitle.indexOf(normalizedSingular) === 0
        || (slug === "quadros" && /^(moldura|quadro)\b/i.test(title))) {
      return title;
    }
    return singular + " " + title;
  }

  function formatCents(cents) {
    return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(Number(cents || 0) / 100);
  }

  function collectNumbers(node, found) {
    if (node == null) {
      return;
    }
    if (typeof node === "number" && isFinite(node)) {
      found.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(function (entry) { collectNumbers(entry, found); });
      return;
    }
    if (typeof node === "object") {
      Object.keys(node).forEach(function (key) { collectNumbers(node[key], found); });
    }
  }

  function priceLabel(product, item) {
    if (item && item.quoteOnly) {
      return item.priceMinCents ? "desde " + formatCents(item.priceMinCents) : "A confirmar";
    }
    if (item && Number(item.priceCents) > 0) {
      return formatCents(item.priceCents);
    }
    var numbers = [];
    collectNumbers(product && product.prices, numbers);
    numbers = numbers.filter(function (value) { return Number(value) > 0; }).sort(function (a, b) { return a - b; });
    if (!numbers.length) {
      return "Por definir";
    }
    if (numbers[0] === numbers[numbers.length - 1]) {
      return formatCents(numbers[0]);
    }
    return formatCents(numbers[0]) + " – " + formatCents(numbers[numbers.length - 1]);
  }

  function sourceRoutes(source) {
    var routes = [];
    var homes = state.payload.homes || [];
    var home = homes.filter(function (entry) { return entry.id === "home"; })[0];
    var congressHome = homes.filter(function (entry) { return entry.id === "congressos"; })[0];
    var cleanPage = text(source.page).replace(/^\.\//, "");

    homes.forEach(function (entry) {
      (entry.categories || []).forEach(function (category) {
        if (text(category.href).replace(/^\.\//, "") === cleanPage) {
          routes.push([entry.label, category.title || category.menuTitle || source.slug]);
        }
      });
    });

    if (source.context === "congresso-2026" && congressHome) {
      (congressHome.categories || []).forEach(function (category) {
        if (text(category.href).replace(/^\.\//, "") === cleanPage) {
          routes.push(["Homepage", "Congressos", category.title || source.slug]);
        }
      });
    }

    if (source.page && !routes.length) {
      routes.push([source.contextLabel || "Site", familyLabel(source.slug, source.data)]);
    }

    if (source.context === "principal" && state.payload.catalogPages && state.payload.catalogPages[source.slug]) {
      routes.push(["Catálogo", familyLabel(source.slug, source.data)]);
    }

    // Evita percursos repetidos quando Homepage e Congressos apontam para a
    // mesma página.
    return routes.filter(function (route, index, all) {
      var key = route.join("|");
      return all.findIndex(function (candidate) { return candidate.join("|") === key; }) === index;
    });
  }

  function sourceFamilyKey(source) {
    return text(source && source.context || "principal") + "|" + text(source && source.slug);
  }

  function recordFamilyKey(record) {
    return text(record && record.sourceContext || record && record.contexts && record.contexts[0] || "principal")
      + "|" + text(record && record.slug);
  }

  function canonicalRecordKey(source, item) {
    var image = safeImagePath(item && item.image);
    var identity = image ? "image:" + normalize(image) : "item:" + normalize(item && (item.id || item.value || item.title));
    return sourceFamilyKey(source) + "|" + identity;
  }

  function customRecordKey(source) {
    return sourceFamilyKey(source) + "|custom-artwork";
  }

  function mergeUnique(target, values, keyFunction) {
    values.forEach(function (value) {
      var key = keyFunction(value);
      if (!target.some(function (candidate) { return keyFunction(candidate) === key; })) {
        target.push(value);
      }
    });
  }

  function deriveRecords(payload) {
    var byKey = {};

    (payload.products || []).forEach(function (source) {
      var product = source.data || {};
      var steps = Array.isArray(product.steps) ? product.steps : [];
      var designStep = steps.filter(function (step) { return step && step.id === "designs"; })[0];
      var routes = sourceRoutes(source);

      (designStep && Array.isArray(designStep.items) ? designStep.items : []).forEach(function (item) {
        var key = canonicalRecordKey(source, item);
        var record = byKey[key];
        if (!record) {
          record = {
            key: key,
            name: composeName(source.slug, product, item),
            kind: item && item.quoteOnly === true ? "configurable" : "real",
            state: source.page ? "active" : "orphan",
            category: familyLabel(source.slug, product),
            slug: source.slug,
            sourceId: text(item && (item.id || item.value)),
            sourceFile: source.sourceFile,
            sourceContext: source.context,
            page: source.page || "",
            image: safeImagePath(item && item.image),
            price: priceLabel(product, item),
            notes: "",
            routes: [],
            sources: [],
            contexts: [],
            local: false
          };
          byKey[key] = record;
        }
        mergeUnique(record.routes, routes, function (route) { return route.join("|"); });
        record.sources.push({
          file: source.sourceFile,
          context: source.context,
          contextLabel: source.contextLabel,
          page: source.page,
          hiddenChoice: designStep && designStep.hidden === true,
          stepId: designStep ? designStep.id : "",
          itemId: text(item && item.id)
        });
        if (record.contexts.indexOf(source.context) === -1) {
          record.contexts.push(source.context);
        }
        if (!record.page && source.page) {
          record.page = source.page;
          record.state = "active";
        }
      });

      var artworkStep = steps.filter(function (step) { return step && step.id === "artwork_upload"; })[0];
      if (artworkStep) {
        var customKey = customRecordKey(source);
        var custom = byKey[customKey];
        if (!custom) {
          custom = {
            key: customKey,
            name: productSingular(source.slug, product) + " personalizado",
            kind: "configurable",
            state: source.page ? "active" : "orphan",
            category: familyLabel(source.slug, product),
            slug: source.slug,
            sourceId: "custom-artwork",
            sourceFile: source.sourceFile,
            sourceContext: source.context,
            page: source.page || "",
            image: "",
            price: priceLabel(product, null),
            notes: product.customArtwork && Number(product.customArtwork.feePerFileCents) > 0
              ? "A imagem é enviada durante o pedido. Inclui " + formatCents(product.customArtwork.feePerFileCents) + " de preparação por ficheiro."
              : "A imagem é enviada pela pessoa durante o pedido.",
            routes: [],
            sources: [],
            contexts: [],
            local: false
          };
          byKey[customKey] = custom;
        }
        mergeUnique(custom.routes, routes, function (route) { return route.join("|"); });
        custom.sources.push({
          file: source.sourceFile,
          context: source.context,
          contextLabel: source.contextLabel,
          page: source.page,
          hiddenChoice: false,
          stepId: "artwork_upload",
          itemId: "custom-artwork"
        });
        if (custom.contexts.indexOf(source.context) === -1) {
          custom.contexts.push(source.context);
        }
      }
    });

    return Object.keys(byKey).map(function (key) { return byKey[key]; }).sort(function (a, b) {
      return a.category.localeCompare(b.category, "pt-PT") || a.name.localeCompare(b.name, "pt-PT");
    });
  }

  function applyDrafts() {
    var records = state.baseRecords.map(function (base) {
      return Object.assign({}, base, state.draft.overrides[base.key] || {}, {
        routes: base.routes.slice(),
        sources: base.sources.slice(),
        contexts: base.contexts.slice(),
        edited: !!state.draft.overrides[base.key]
      });
    });
    state.draft.custom.forEach(function (entry) {
      records.push(Object.assign({
        routes: [["Registo local"]],
        sources: [],
        contexts: [],
        sourceFile: "Rascunho do browser",
        sourceContext: "local",
        image: "",
        price: "Por definir",
        local: true,
        edited: true
      }, entry));
    });
    state.records = records.sort(function (a, b) {
      return text(a.category).localeCompare(text(b.category), "pt-PT") || text(a.name).localeCompare(text(b.name), "pt-PT");
    });
  }

  function recordIsOrphan(record) {
    return !record.page && !record.routes.some(function (route) {
      return route[0] !== "Catálogo" && route[0] !== "Registo local";
    });
  }

  function stateDisplay(record) {
    if (recordIsOrphan(record) && record.state === "orphan") {
      return { label: "Sem percurso", className: "is-orphan" };
    }
    return {
      active: { label: "Activo", className: "is-active" },
      draft: { label: "Rascunho", className: "is-draft" },
      hidden: { label: "Oculto", className: "is-hidden" },
      orphan: { label: "Sem percurso", className: "is-orphan" }
    }[record.state] || { label: "Activo", className: "is-active" };
  }

  function recordRoute(record) {
    var preferred = record.routes.filter(function (route) { return route[0] === "Homepage"; })[0]
      || record.routes.filter(function (route) { return route[0] !== "Catálogo"; })[0]
      || record.routes[0];
    return preferred || ["Sem página pública"];
  }

  function routeHtml(route) {
    return route.map(function (part, index) {
      return (index ? " <span aria-hidden=\"true\">›</span> " : "") + (index === route.length - 1 ? "<b>" + escapeHtml(part) + "</b>" : escapeHtml(part));
    }).join("");
  }

  function matchesCategory(record) {
    if (state.categoryFilter === "all") {
      return true;
    }
    if (state.categoryFilter === "orphan") {
      return recordIsOrphan(record);
    }
    if (state.categoryFilter === "congresso-2026") {
      return record.contexts.indexOf("congresso-2026") !== -1;
    }
    if (state.categoryFilter === "catalog") {
      return record.routes.some(function (route) { return route[0] === "Catálogo"; });
    }
    return recordFamilyKey(record) === state.categoryFilter;
  }

  function filteredRecords() {
    var query = normalize(state.search);
    return state.records.filter(function (record) {
      var routeText = record.routes.map(function (route) { return route.join(" "); }).join(" ");
      var haystack = normalize([record.name, record.sourceId, record.category, record.sourceFile, routeText].join(" "));
      var stateMatches = state.stateFilter === "all"
        || (state.stateFilter === "orphan" ? recordIsOrphan(record) : record.state === state.stateFilter);
      return (!query || haystack.indexOf(query) !== -1)
        && (state.kindFilter === "all" || record.kind === state.kindFilter)
        && stateMatches
        && matchesCategory(record);
    });
  }

  function productThumb(node, record) {
    node.innerHTML = "";
    var path = safeImagePath(record.image);
    if (path) {
      var image = document.createElement("img");
      image.src = path;
      image.alt = "";
      image.loading = "lazy";
      node.appendChild(image);
      return;
    }
    node.textContent = text(record.name).trim().charAt(0).toLocaleUpperCase("pt-PT") || "P";
  }

  function renderTable() {
    var records = filteredRecords();
    var fragment = document.createDocumentFragment();
    listNode.innerHTML = "";

    records.forEach(function (record) {
      var row = rowTemplate.content.firstElementChild.cloneNode(true);
      var kind = row.querySelector("[data-kind]");
      var stateInfo = stateDisplay(record);
      productThumb(row.querySelector("[data-thumb]"), record);
      row.querySelector("[data-name]").textContent = record.name;
      row.querySelector("[data-id]").textContent = record.sourceContext + " · " + record.slug + " · " + record.sourceId;
      row.querySelector("[data-edited]").hidden = !record.edited;
      kind.textContent = record.kind === "configurable" ? "Configurável" : "Produto real";
      kind.classList.add(record.kind === "configurable" ? "is-configurable" : "is-real");
      row.querySelector("[data-route]").innerHTML = routeHtml(recordRoute(record));
      row.querySelector("[data-route-more]").textContent = record.routes.length > 1 ? "+ " + (record.routes.length - 1) + " percurso" + (record.routes.length > 2 ? "s" : "") : "";
      row.querySelector("[data-price]").textContent = record.price;
      row.querySelector("[data-state]").textContent = stateInfo.label;
      row.querySelector("[data-state]").classList.add(stateInfo.className);
      row.querySelector("[data-edit]").addEventListener("click", function () { openEditor(record.key); });
      fragment.appendChild(row);
    });
    listNode.appendChild(fragment);
    document.querySelector("[data-results-count]").textContent = records.length + " de " + state.records.length + " registos";
    document.querySelector("[data-empty]").hidden = records.length > 0;
    if (state.payload && document.querySelector("[data-llm-scope]").value === "filtered") {
      renderLlm();
    }
  }

  function recordCountForFamily(familyKey) {
    return state.records.filter(function (record) { return recordFamilyKey(record) === familyKey; }).length;
  }

  function treeButton(label, value, count, level, icon) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "tree-button" + (level === 1 ? " is-child" : level === 2 ? " is-grandchild" : "");
    button.classList.toggle("is-active", state.categoryFilter === value);
    button.innerHTML = '<span class="tree-icon">' + escapeHtml(icon) + '</span><span>' + escapeHtml(label) + '</span><small>' + escapeHtml(count) + '</small>';
    button.addEventListener("click", function () {
      state.categoryFilter = value;
      renderTree();
      renderTable();
    });
    return button;
  }

  function renderTree() {
    var categories = {};
    state.records.forEach(function (record) {
      var familyKey = recordFamilyKey(record);
      if (!categories[familyKey]) {
        categories[familyKey] = {
          label: record.category,
          contextLabel: record.sources[0] && record.sources[0].contextLabel || record.sourceContext
        };
      }
    });
    treeNode.innerHTML = "";
    treeNode.appendChild(treeButton("Todos os produtos", "all", state.records.length, 0, "MP"));
    Object.keys(categories).sort(function (a, b) {
      return categories[a].label.localeCompare(categories[b].label, "pt-PT")
        || text(categories[a].contextLabel).localeCompare(text(categories[b].contextLabel), "pt-PT");
    }).forEach(function (familyKey) {
      var category = categories[familyKey];
      var label = category.label + (category.contextLabel ? " · " + category.contextLabel : "");
      treeNode.appendChild(treeButton(label, familyKey, recordCountForFamily(familyKey), 1, category.label.charAt(0)));
    });

    var divider = document.createElement("div");
    divider.className = "tree-divider";
    treeNode.appendChild(divider);
    var congressCount = state.records.filter(function (record) { return record.contexts.indexOf("congresso-2026") !== -1; }).length;
    var catalogCount = state.records.filter(function (record) { return record.routes.some(function (route) { return route[0] === "Catálogo"; }); }).length;
    var orphanCount = state.records.filter(recordIsOrphan).length;
    treeNode.appendChild(treeButton("Congresso 2026", "congresso-2026", congressCount, 0, "26"));
    treeNode.appendChild(treeButton("Catálogo", "catalog", catalogCount, 0, "C"));
    treeNode.appendChild(treeButton("Sem percurso", "orphan", orphanCount, 0, "!"));
  }

  function sourceForFlow(familyKey) {
    var sources = (state.payload.products || []).filter(function (source) {
      return sourceFamilyKey(source) === familyKey;
    });
    return sources.sort(function (a, b) {
      var aSteps = (a.data && a.data.steps || []).filter(function (step) { return !step.hidden; }).length;
      var bSteps = (b.data && b.data.steps || []).filter(function (step) { return !step.hidden; }).length;
      return (b.page ? 1 : 0) - (a.page ? 1 : 0) || bSteps - aSteps;
    })[0] || null;
  }

  function flowNode(title, subtitle, className) {
    return '<div class="flow-node ' + escapeHtml(className || "") + '"><strong>' + escapeHtml(title) + '</strong><small>' + escapeHtml(subtitle || "") + '</small></div>';
  }

  function renderSitemap() {
    var groups = {};
    state.records.forEach(function (record) {
      var familyKey = recordFamilyKey(record);
      if (!groups[familyKey]) {
        groups[familyKey] = [];
      }
      groups[familyKey].push(record);
    });

    sitemapNode.innerHTML = Object.keys(groups).sort(function (a, b) {
      return groups[a][0].category.localeCompare(groups[b][0].category, "pt-PT");
    }).map(function (familyKey) {
      var records = groups[familyKey];
      var source = sourceForFlow(familyKey);
      var product = source ? source.data || {} : {};
      var steps = Array.isArray(product.steps) ? product.steps : [];
      var route = recordRoute(records[0]);
      var flow = flowNode(route[0] || "Site", "Entrada", "is-start") + '<span class="flow-arrow">→</span>';
      flow += flowNode(records[0].category, source && source.page ? source.page : "Sem página pública", source && source.page ? "" : "is-hidden");
      steps.forEach(function (step) {
        if (!step || step.id === "confirm" || step.id === "delivery_contact") {
          return;
        }
        flow += '<span class="flow-arrow">→</span>';
        flow += flowNode(step.title || step.label || step.id, step.when ? "Passo condicional" : "Passo " + (steps.indexOf(step) + 1), (step.when ? "is-conditional " : "") + (step.hidden ? "is-hidden" : ""));
      });
      flow += '<span class="flow-arrow">→</span>' + flowNode("Carrinho", "Produto adicionado", "is-cart");

      var productButtons = records.slice(0, 12).map(function (record) {
        return '<button type="button" class="flow-product' + (record.kind === "configurable" ? " is-configurable" : "") + '" data-flow-product="' + escapeHtml(record.key) + '">' + escapeHtml(record.name) + '</button>';
      }).join("");
      if (records.length > 12) {
        productButtons += '<span class="flow-more">+ ' + (records.length - 12) + ' produtos</span>';
      }

      return [
        '<article class="flow-card">',
        '<header class="flow-card-head"><div><h3>' + escapeHtml(records[0].category) + '</h3><p>' + records.length + ' registos · ' + escapeHtml(source ? source.contextLabel : "Sem fonte") + '</p></div><button type="button" class="row-action" data-flow-filter="' + escapeHtml(familyKey) + '">Ver na base de dados</button></header>',
        '<div class="flow-line">' + flow + '</div>',
        '<div class="flow-products">' + productButtons + '</div>',
        '</article>'
      ].join("");
    }).join("");

    sitemapNode.querySelectorAll("[data-flow-product]").forEach(function (button) {
      button.addEventListener("click", function () { openEditor(button.dataset.flowProduct); });
    });
    sitemapNode.querySelectorAll("[data-flow-filter]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.categoryFilter = button.dataset.flowFilter;
        setView("database");
        renderTree();
        renderTable();
      });
    });
  }

  function stepRowHeight() {
    return state.graph.tidyEdges ? STEP_ROW_TIDY : STEP_ROW;
  }

  function productRowHeight() {
    return state.graph.tidyEdges ? PRODUCT_ROW_TIDY : PRODUCT_ROW;
  }

  function columnPitch() {
    return state.graph.tidyEdges ? COLUMN_PITCH_TIDY : COLUMN_PITCH;
  }

  function columnX(index) {
    return state.graph.layoutOriginX + (GRID_LEFT - 12) + index * columnPitch();
  }

  function graphCartX() {
    return columnX(6) + 22;
  }

  function graphWorldWidth() {
    return Math.max(840, graphCartX() + 188);
  }

  function applyStoredGraphPositions(nodes) {
    nodes.forEach(function (node) {
      var saved = state.graphPositions[node.id];
      if (!saved || !isFinite(Number(saved.x)) || !isFinite(Number(saved.y))) { return; }
      node.x = Math.max(12, Number(saved.x));
      node.y = Math.max(12, Number(saved.y));
    });
  }

  function graphExtent(nodes, axis, sizeKey, fallback) {
    return Math.max(fallback, nodes.reduce(function (maximum, node) {
      return Math.max(maximum, Number(node[axis]) + Number(node[sizeKey]) + 72);
    }, 0));
  }

  function columnGaps() {
    var gaps = [state.graph.layoutOriginX + 214];
    for (var index = 0; index < 7; index += 1) {
      gaps.push(Math.round((columnX(index) + NODE_WIDTH + columnX(index + 1)) / 2));
    }
    return gaps;
  }

  function graphProductNodeId(record) {
    return "product|" + record.key;
  }

  function graphEdgeId(from, to, kind) {
    return "base|" + from + "|" + to + "|" + (kind || "flow");
  }

  function graphNodeTypeLabel(node) {
    if (node && node.groupKind === "checkout") { return "Fecho do percurso compactado"; }
    if (node && node.groupKind === "products") { return node.count + " produtos compactados"; }
    var label = {
      page: "Ligação da homepage",
      family: "Família",
      step: node && node.conditional ? "Passo condicional" : "Passo",
      product: node && node.configurable ? "Produto configurável" : "Produto real",
      cart: "Carrinho"
    }[node && node.type] || "Node";
    return node && node.hidden ? label + " · oculto ao cliente" : label;
  }

  function buildGraphDataLegacy() {
    var groups = {};
    var nodes = [];
    var nodeById = {};
    var edges = [];
    var edgeKeys = {};
    var clusters = [];
    var clusterY = 28;
    var familyFilter = state.graph.family;
    var allMode = familyFilter === "all";

    state.records.forEach(function (record) {
      var familyKey = recordFamilyKey(record);
      if (!groups[familyKey]) {
        groups[familyKey] = [];
      }
      groups[familyKey].push(record);
    });

    function addNode(node) {
      nodes.push(node);
      nodeById[node.id] = node;
    }

    function addEdge(from, to, kind, label) {
      var key = from + "|" + to + "|" + (kind || "flow");
      if (!from || !to || from === to || edgeKeys[key]) {
        return;
      }
      edgeKeys[key] = true;
      edges.push({ id: graphEdgeId(from, to, kind), from: from, to: to, kind: kind || "flow", label: label || "" });
    }

    Object.keys(groups).sort(function (a, b) {
      return groups[a][0].category.localeCompare(groups[b][0].category, "pt-PT");
    }).forEach(function (familyKey) {
      if (!allMode && familyFilter !== familyKey) {
        return;
      }

      var records = groups[familyKey];
      var source = sourceForFlow(familyKey);
      var product = source ? source.data || {} : {};
      var steps = Array.isArray(product.steps) ? product.steps : [];
      var familyId = "family|" + familyKey;
      var cartId = "cart|" + familyKey;
      var columns = 6;
      var clusterTop = clusterY + BAND_TITLE_SPACE;
      var stepRows = Math.max(1, Math.ceil(steps.length / columns));
      var productStartY = clusterTop + 62 + stepRows * stepRowHeight() + 46;
      var productRows = Math.max(1, Math.ceil(records.length / columns));
      var clusterHeight = Math.max(410, productStartY - clusterY + productRows * productRowHeight() + 74);
      var stepById = {};
      var productNodeByKey = {};

      clusters.push({
        slug: familyKey,
        label: records[0].category + " · " + (source ? source.contextLabel : records[0].sourceContext),
        y: clusterY,
        height: clusterHeight,
        productStartY: productStartY,
        columns: columns
      });

      addNode({
        id: familyId, type: "family", family: familyKey, label: records[0].category,
        subtitle: records.length + " produtos", x: 28, y: clusterTop + 28, width: 178, height: 62
      });
      addNode({
        id: cartId, type: "cart", family: familyKey, label: "Carrinho",
        subtitle: records[0].category, x: graphCartX(), y: clusterTop + 30, width: 150, height: 58
      });

      steps.forEach(function (step, index) {
        var id = "step|" + familyKey + "|" + text(step.id || index);
        var node = {
          id: id,
          type: "step",
          family: familyKey,
          stepId: text(step.id || index),
          field: text(step.field),
          label: text(step.title || step.label || step.id),
          subtitle: text(step.template || "passo"),
          conditional: !!step.when,
          hidden: step.hidden === true,
          condition: step.when || null,
          x: columnX(index % columns),
          y: clusterTop + 26 + Math.floor(index / columns) * stepRowHeight(),
          width: 168,
          height: 54
        };
        addNode(node);
        stepById[step.id] = node;
      });

      records.forEach(function (record, index) {
        var id = graphProductNodeId(record);
        var node = {
          id: id,
          type: "product",
          family: familyKey,
          recordKey: record.key,
          sourceId: record.sourceId,
          label: record.name,
          subtitle: record.price,
          configurable: record.kind === "configurable",
          x: columnX(index % columns),
          y: productStartY + Math.floor(index / columns) * productRowHeight(),
          width: 168,
          height: 50
        };
        addNode(node);
        productNodeByKey[record.key] = node;
      });

      if (!steps.length) {
        records.forEach(function (record) {
          addEdge(familyId, graphProductNodeId(record), "product", "Produto");
          addEdge(graphProductNodeId(record), cartId, "cart", "Adicionar ao carrinho");
        });
        clusterY += clusterHeight;
        return;
      }

      addEdge(familyId, "step|" + familyKey + "|" + text(steps[0].id || 0), "entry", "Entrada");

      var designIndex = steps.findIndex(function (step) { return step && step.id === "designs"; });
      var designStep = designIndex >= 0 ? steps[designIndex] : null;
      var designNode = designStep ? stepById[designStep.id] : null;
      var normalProductNodes = records.filter(function (record) { return record.sourceId !== "custom-artwork"; }).map(function (record) {
        return productNodeByKey[record.key];
      }).filter(Boolean);
      var customProductNodes = records.filter(function (record) { return record.sourceId === "custom-artwork"; }).map(function (record) {
        return productNodeByKey[record.key];
      }).filter(Boolean);

      if (designNode) {
        normalProductNodes.forEach(function (node) {
          addEdge(designNode.id, node.id, "product", "Escolha de produto");
        });
      }

      var previousUnconditional = null;
      var cartBoundaryUsed = false;
      steps.forEach(function (step, index) {
        var current = stepById[step.id];
        if (!current || step.when) {
          return;
        }
        if (!previousUnconditional) {
          previousUnconditional = current;
          return;
        }

        var isBoundary = step.id === "delivery_contact" || step.template === "delivery-contact" || step.id === "confirm";
        var bridgeNodes = [];
        if (previousUnconditional.stepId === "designs" && normalProductNodes.length) {
          bridgeNodes = normalProductNodes;
        } else if (previousUnconditional.stepId === "artwork_upload" && customProductNodes.length) {
          bridgeNodes = customProductNodes;
        }

        if (isBoundary && !cartBoundaryUsed) {
          if (bridgeNodes.length) {
            bridgeNodes.forEach(function (node) { addEdge(node.id, cartId, "cart", "Adicionar ao carrinho"); });
          } else {
            addEdge(previousUnconditional.id, cartId, "cart", "Adicionar ao carrinho");
          }
          addEdge(cartId, current.id, "checkout", "Continuar pedido");
          cartBoundaryUsed = true;
        } else if (bridgeNodes.length) {
          bridgeNodes.forEach(function (node) { addEdge(node.id, current.id, "flow", "Continuar"); });
        } else {
          addEdge(previousUnconditional.id, current.id, "flow", "Continuar");
        }
        previousUnconditional = current;
      });

      var artworkStep = stepById.artwork_upload;
      if (artworkStep && customProductNodes.length) {
        customProductNodes.forEach(function (node) {
          addEdge(artworkStep.id, node.id, "product", "Produto configurável");
        });
      }

      steps.forEach(function (step, index) {
        if (!step || !step.when || !stepById[step.id]) {
          return;
        }
        var current = stepById[step.id];
        var condition = step.when;
        var controller = steps.filter(function (candidate) {
          return candidate && (candidate.id === condition.field || candidate.field === condition.field || candidate.field === condition.field + "[]");
        })[0];
        var linkedFromProduct = false;

        if (condition.field === "designs" && designStep && Array.isArray(designStep.items)) {
          var accepted = condition.in || (condition.equals != null ? [condition.equals] : []);
          designStep.items.forEach(function (item) {
            if (accepted.length && accepted.indexOf(item.value) === -1) {
              return;
            }
            var recordKey = canonicalRecordKey(source, item);
            var node = productNodeByKey[recordKey];
            if (node) {
              addEdge(node.id, current.id, "conditional", "Quando " + accepted.join(" / "));
              linkedFromProduct = true;
            }
          });
        }
        if (!linkedFromProduct && controller && stepById[controller.id]) {
          addEdge(stepById[controller.id].id, current.id, "conditional", "Condição");
        }

        var nextUnconditional = steps.slice(index + 1).filter(function (candidate) { return candidate && !candidate.when; })[0];
        if (nextUnconditional && stepById[nextUnconditional.id]) {
          var nextIsBoundary = nextUnconditional.id === "delivery_contact" || nextUnconditional.template === "delivery-contact" || nextUnconditional.id === "confirm";
          if (nextIsBoundary) {
            addEdge(current.id, cartId, "cart", "Adicionar ao carrinho");
          } else {
            addEdge(current.id, stepById[nextUnconditional.id].id, "merge", "Retomar fluxo");
          }
        }
      });

      if (!cartBoundaryUsed && previousUnconditional) {
        if (previousUnconditional.stepId === "designs" && normalProductNodes.length) {
          normalProductNodes.forEach(function (node) { addEdge(node.id, cartId, "cart", "Adicionar ao carrinho"); });
        } else if (previousUnconditional.stepId === "artwork_upload" && customProductNodes.length) {
          customProductNodes.forEach(function (node) { addEdge(node.id, cartId, "cart", "Adicionar ao carrinho"); });
        } else {
          addEdge(previousUnconditional.id, cartId, "cart", "Adicionar ao carrinho");
        }
      }

      clusterY += clusterHeight;
    });

    if (allMode) {
      state.graph.allNodeById = Object.assign({}, nodeById);
      state.graph.allBaseEdges = edges.slice();
    }

    if (state.graph.collapsed) {
      var collapsed = collapseGraphData(nodes, nodeById, edges, clusters);
      nodes = collapsed.nodes;
      nodeById = collapsed.nodeById;
      edges = collapsed.edges;
      clusterY = collapsed.bottom;
    }

    state.graph.nodes = nodes;
    state.graph.nodeById = nodeById;
    state.graph.baseEdges = edges;
    state.graph.clusters = clusters;
    state.graph.worldWidth = graphWorldWidth();
    state.graph.worldHeight = Math.max(720, clusterY + 20);
  }

  function graphSourceKey(source) {
    return sourceFamilyKey(source);
  }

  function graphGalleryEntryKey(source) {
    return source && source.context === "congresso-2026"
      ? "congresso-2026|" + source.slug
      : text(source && source.slug);
  }

  function graphGallerySlots(source) {
    if (!window.MiaGaleriaSlots || !window.MiaGaleriaSlots.collect) { return []; }
    try {
      return window.MiaGaleriaSlots.collect({
        key: graphGalleryEntryKey(source),
        slug: source.slug,
        kind: source.kind || "product",
        context: source.context,
        contextLabel: source.contextLabel,
        product: source.data || {}
      });
    } catch (error) {
      return [];
    }
  }

  function graphSources() {
    var products = (state.payload && state.payload.products || []).slice();
    var home = (state.payload && state.payload.homes || []).filter(function (entry) {
      return entry && entry.id === "home" && entry.data;
    })[0];

    if (home) {
      products.push({
        context: "principal",
        contextLabel: "Site principal",
        slug: "home",
        kind: "home",
        sourceFile: home.sourceFile,
        page: home.page,
        revision: home.revision,
        data: home.data
      });
    }
    return products;
  }

  function graphDoneLookup() {
    var lookup = {};
    (state.payload && state.payload.galleryDone || []).forEach(function (key) { lookup[text(key)] = true; });
    return lookup;
  }

  function galleryDoneSignature(done) {
    return (done || []).map(text).filter(Boolean).sort().join("\n");
  }

  function replaceGalleryDone(done) {
    var next;
    if (!state.payload) { return; }
    next = (done || []).map(text).filter(Boolean).filter(function (key, index, all) {
      return all.indexOf(key) === index;
    });
    if (galleryDoneSignature(next) === galleryDoneSignature(state.payload.galleryDone)) { return; }
    state.payload.galleryDone = next;
    renderGraph();
  }

  function applyGalleryDoneChange(change) {
    var done;
    var key;
    if (!state.payload) { return; }
    done = Array.isArray(state.payload.galleryDone) ? state.payload.galleryDone.slice() : [];
    key = text(change && change.key);
    if (!key) { return; }
    if (change.done && done.indexOf(key) === -1) { done.push(key); }
    if (!change.done) { done = done.filter(function (candidate) { return candidate !== key; }); }
    replaceGalleryDone(done);
  }

  function refreshGalleryDone() {
    if (!state.payload || galleryDoneRefreshPending) { return; }
    galleryDoneRefreshPending = true;
    fetch("produtos-api.php?action=gallery-state", { cache: "no-store", credentials: "same-origin" })
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok || !data.ok) { throw new Error(data && data.message || "Estado indisponível."); }
          return data;
        });
      })
      .then(function (data) { replaceGalleryDone(data.done || []); })
      .catch(function () { /* mantém o último estado se a consulta falhar */ })
      .then(function () { galleryDoneRefreshPending = false; });
  }

  function graphSlotIsDone(slot, done) {
    return !!(done[text(slot && slot.doneKey)] || (slot && slot.doneAliases || []).some(function (alias) {
      return !!done[text(alias)];
    }));
  }

  function graphSlotStats(slots, done) {
    var total = slots.length;
    var pending = slots.filter(function (slot) { return !graphSlotIsDone(slot, done); }).length;
    return { total: total, pending: pending };
  }

  function graphConditionValues(condition) {
    if (!condition) { return []; }
    if (Array.isArray(condition.in)) { return condition.in.slice(); }
    if (Object.prototype.hasOwnProperty.call(condition, "equals")) { return [condition.equals]; }
    if (Object.prototype.hasOwnProperty.call(condition, "notEquals")) { return [condition.notEquals]; }
    return [];
  }

  function graphConditionMatches(condition, selections) {
    var actual;
    var accepted;
    if (!condition || !condition.field) { return true; }
    actual = selections[condition.field];
    accepted = graphConditionValues(condition);
    if (Object.prototype.hasOwnProperty.call(condition, "equals")) {
      return Array.isArray(actual)
        ? actual.indexOf(condition.equals) !== -1
        : actual === condition.equals;
    }
    if (Array.isArray(condition.in)) {
      return Array.isArray(actual)
        ? actual.some(function (value) { return accepted.indexOf(value) !== -1; })
        : accepted.indexOf(actual) !== -1;
    }
    if (Object.prototype.hasOwnProperty.call(condition, "notEquals")) {
      return Array.isArray(actual)
        ? actual.indexOf(condition.notEquals) === -1
        : actual !== condition.notEquals;
    }
    return true;
  }

  // Para desenhar as ligações condicionais não basta saber qual é o próximo
  // passo sem `when`: é preciso simular os percursos que o renderer pode
  // realmente mostrar. Para cada campo usado numa condição bastam os valores
  // mencionados no JSON e um valor sentinela que representa "qualquer outro".
  function graphConditionScenarios(steps, baseSelections) {
    var domains = {};
    var scenarios = [Object.assign({}, baseSelections || {})];
    var otherValue = "\u0000other";

    (steps || []).forEach(function (step) {
      var condition = step && step.when;
      if (!condition || !condition.field
          || Object.prototype.hasOwnProperty.call(baseSelections || {}, condition.field)) { return; }
      if (!domains[condition.field]) { domains[condition.field] = []; }
      graphConditionValues(condition).forEach(function (value) {
        if (domains[condition.field].indexOf(value) === -1) { domains[condition.field].push(value); }
      });
    });

    Object.keys(domains).forEach(function (field) {
      var values = domains[field].concat([otherValue]);
      var expanded = [];
      scenarios.forEach(function (scenario) {
        values.forEach(function (value) {
          var next = Object.assign({}, scenario);
          next[field] = value;
          expanded.push(next);
        });
      });
      // Rede de segurança para um JSON futuro com demasiadas combinações.
      scenarios = expanded.slice(0, 512);
    });

    // Uma selecção aninhada só pode existir se o passo que a recolhe também
    // estiver visível. Por exemplo, `baby_animal` não pode activar um passo
    // num percurso de Foto, porque a pergunta do animal nunca apareceu.
    return scenarios.filter(function (scenario) {
      return Object.keys(domains).every(function (field) {
        var controller = (steps || []).filter(function (step) {
          return step && (step.id === field || step.field === field || step.field === field + "[]");
        })[0];
        var controllerVisible = !controller || !controller.when || graphConditionMatches(controller.when, scenario);
        return controllerVisible || scenario[field] === otherValue;
      });
    });
  }

  function visitorContext(event, visitor) {
    var explicit = text(event && event.context || visitor && visitor.context);
    var landing = text(event && (event.landingPage || event.landing_page)
      || visitor && (visitor.landingPage || visitor.landing_page));

    if (explicit === "congresso-2026" || explicit === "principal") { return explicit; }
    return /(?:^|\/)congressos\/2026(?:\/|$|[?#])/i.test(landing)
      ? "congresso-2026"
      : "principal";
  }

  function visitorEventNodeId(event, nodeById, visitor) {
    var slug = text(event && event.productSlug);
    var eventName = text(event && event.eventName);
    var stepId = text(event && (event.toStep || event.stepId));
    var context = visitorContext(event, visitor);
    var candidate;

    function resolve(id) {
      if (nodeById[id]) { return id; }
      var mapped = state.graph.memberRemap[id];
      return mapped && nodeById[mapped] ? mapped : "";
    }

    if (slug === "pins") { slug = "crachas"; }
    if (!slug || slug === "home") {
      candidate = "step|principal|home|hero";
      return resolve(candidate) || resolve("family|principal|home");
    }

    if (["cart_item_added", "cart_checkout_started", "order_submitted", "cart_order_submitted"].indexOf(eventName) !== -1) {
      candidate = "cart|" + context + "|" + slug;
      candidate = resolve(candidate);
      if (candidate) { return candidate; }
    }
    if (stepId) {
      candidate = "step|" + context + "|" + slug + "|" + stepId;
      candidate = resolve(candidate);
      if (candidate) { return candidate; }
    }
    candidate = "family|" + context + "|" + slug;
    candidate = resolve(candidate);
    if (candidate) { return candidate; }
    return "";
  }

  function visitorActionLabel(event) {
    var labels = {
      site_landed: "entrou no site",
      wizard_started: "abriu o produto",
      product_view: "viu o produto",
      step_view: "chegou a este passo",
      step_completed: "completou o passo",
      design_selected: "escolheu um design",
      design_unselected: "retirou um design",
      option_selected: "escolheu uma opção",
      image_magnified: "ampliou uma imagem",
      validation_error: "teve um erro de validação",
      cart_item_added: "adicionou ao carrinho",
      cart_checkout_started: "iniciou o checkout",
      contact_completed: "completou o contacto",
      confirmation_view: "viu a confirmação",
      order_submitted: "enviou o pedido",
      cart_order_submitted: "enviou o pedido",
      ui_interaction: "clicou"
    };
    return labels[text(event && event.eventName)] || text(event && event.eventName || "interagiu");
  }

  function visitorEventDetail(event) {
    if (!event) { return ""; }
    if (event.designTitle || event.designId) { return text(event.designTitle || event.designId); }
    if (event.optionLabel || event.optionValue) {
      return [event.optionType, event.optionLabel || event.optionValue].filter(Boolean).join(": ");
    }
    return text(event.targetLabel || event.stepId || "");
  }

  function rebuildVisitorGraphIndex(nodeById) {
    var visitorMap = {};
    var byNode = {};
    var currentNodeByVisitor = {};
    var events = (state.visitorPayload && state.visitorPayload.events || []).slice().sort(function (a, b) {
      return Number(a.ts || 0) - Number(b.ts || 0);
    });

    (state.visitorPayload && state.visitorPayload.visitors || []).forEach(function (visitor) {
      visitorMap[text(visitor.key)] = visitor;
    });

    events.forEach(function (event) {
      var visitorKey = text(event.visitorKey);
      var visitor = visitorMap[visitorKey] || null;
      var nodeId = visitorEventNodeId(event, nodeById, visitor);
      var bucket;
      if (!visitorKey || !nodeId) { return; }
      byNode[nodeId] = byNode[nodeId] || {};
      bucket = byNode[nodeId][visitorKey] = byNode[nodeId][visitorKey] || {
        visitorKey: visitorKey,
        visitor: visitorMap[visitorKey] || { key: visitorKey, miniId: visitorKey.slice(-4) },
        nodeId: nodeId,
        events: [],
        lastTs: 0,
        isHere: false
      };
      bucket.events.push(event);
      bucket.lastTs = Math.max(bucket.lastTs, Number(event.ts || 0));
      currentNodeByVisitor[visitorKey] = nodeId;
    });

    Object.keys(currentNodeByVisitor).forEach(function (visitorKey) {
      var nodeId = currentNodeByVisitor[visitorKey];
      var record = byNode[nodeId] && byNode[nodeId][visitorKey];
      var visitor = visitorMap[visitorKey] || {};
      var lastTs = Math.max(record ? record.lastTs : 0, Date.parse(visitor.lastAt || "") || 0);
      if (record) {
        record.isHere = !visitor.submitted && lastTs > 0 && Date.now() - lastTs <= 180000;
      }
    });

    state.visitorIndex = { byNode: byNode, currentNodeByVisitor: currentNodeByVisitor, visitors: visitorMap };
  }

  function visitorRecordsForNode(node) {
    var grouped = {};
    var byNode = state.visitorIndex.byNode || {};

    function merge(records) {
      Object.keys(records || {}).forEach(function (visitorKey) {
        var source = records[visitorKey];
        var target = grouped[visitorKey] = grouped[visitorKey] || {
          visitorKey: visitorKey,
          visitor: source.visitor,
          nodeId: source.nodeId,
          events: [],
          lastTs: 0,
          isHere: false
        };
        target.events = target.events.concat(source.events || []);
        target.lastTs = Math.max(target.lastTs, source.lastTs || 0);
        target.isHere = target.isHere || source.isHere;
      });
    }

    if (node && node.type === "family") {
      Object.keys(byNode).forEach(function (nodeId) {
        var related = state.graph.nodeById[nodeId];
        if (related && related.family === node.family) { merge(byNode[nodeId]); }
      });
    } else if (node) {
      merge(byNode[node.id]);
    }

    return Object.keys(grouped).map(function (key) {
      grouped[key].events.sort(function (a, b) { return Number(b.ts || 0) - Number(a.ts || 0); });
      return grouped[key];
    }).sort(function (a, b) {
      return Number(b.isHere) - Number(a.isHere) || b.lastTs - a.lastTs;
    });
  }

  function applyVisitorGraphStats(nodes) {
    nodes.forEach(function (node) {
      var records = visitorRecordsForNode(node);
      node.visitorTotal = records.length;
      node.visitorHere = records.filter(function (record) { return record.isHere; }).length;
    });
  }

  function graphVisitorBadgeMarkup(node) {
    if (!state.visitorMode || !node || !node.visitorTotal) { return ""; }
    return '<span class="graph-node-visitors" aria-hidden="true">'
      + (node.visitorHere ? '<i class="is-live"></i>' : '<i></i>')
      + node.visitorTotal + '</span>';
  }

  function formatVisitorTime(timestamp) {
    if (!timestamp) { return "sem hora"; }
    try {
      return new Date(Number(timestamp)).toLocaleString("pt-PT", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
      });
    } catch (error) {
      return "sem hora";
    }
  }

  function graphVisitorsMarkup(node) {
    if (!state.visitorMode) { return ""; }
    var records = visitorRecordsForNode(node);
    var here = records.filter(function (record) { return record.isHere; }).length;
    var meta = state.visitorPayload && state.visitorPayload.meta || {};
    var rows = records.map(function (record) {
      var visitor = record.visitor || {};
      var actions = record.events.slice(0, 4).map(function (event) {
        var detail = visitorEventDetail(event);
        return '<li><span>' + escapeHtml(visitorActionLabel(event) + (detail ? " · " + detail : ""))
          + '</span><time>' + escapeHtml(formatVisitorTime(event.ts)) + '</time></li>';
      }).join("");
      return '<article class="inspector-visitor' + (record.isHere ? ' is-here' : '') + '">'
        + '<header><strong>Visitante #' + escapeHtml(visitor.miniId || record.visitorKey.slice(-4)) + '</strong>'
        + '<span>' + (record.isHere ? "Agora neste percurso" : "Passou por aqui") + '</span></header>'
        + '<small>' + escapeHtml([visitor.productName, visitor.device, visitor.viewport].filter(Boolean).join(" · ")) + '</small>'
        + '<ul>' + actions + '</ul></article>';
    }).join("");

    return '<section class="inspector-visitors"><div class="inspector-visitors-head">'
      + '<div><strong>Visitantes na Teia</strong><small>' + escapeHtml(text(meta.startDate || "") + (meta.endDate ? " → " + meta.endDate : "")) + '</small></div>'
      + '<span><b>' + here + '</b> agora · <b>' + records.length + '</b> passaram</span></div>'
      + (rows || '<p class="inspector-none">Não há visitantes registados neste node para o período escolhido.</p>')
      + '</section>';
  }

  function graphSourceProductRecords(source) {
    var product = source && source.data || {};
    var steps = Array.isArray(product.steps) ? product.steps : [];
    var designs = steps.filter(function (step) { return step && step.id === "designs"; })[0];
    var artwork = steps.filter(function (step) { return step && step.id === "artwork_upload"; })[0];
    var hasCustomProduct = !!artwork;
    var rows = [];

    // Nos fluxos personalizados, os designs antigos ficam no JSON apenas como
    // configuração oculta. Os produtos reais são representados no contexto do
    // Congresso, onde são de facto escolhidos; aqui entra apenas o produto
    // configurável que antecede o upload.
    if (designs && (!designs.hidden || !hasCustomProduct)) {
      (designs.items || []).forEach(function (item) {
        var key = canonicalRecordKey(source, item);
        var record = state.records.filter(function (candidate) { return candidate.key === key; })[0];
        if (record) {
          rows.push({ record: record, item: item, itemId: text(item.id), itemValue: text(item.value) });
        }
      });
    }

    if (hasCustomProduct) {
      var customKey = customRecordKey(source);
      var custom = state.records.filter(function (candidate) { return candidate.key === customKey; })[0];
      if (custom) {
        rows.push({ record: custom, item: null, itemId: "", itemValue: "custom-artwork" });
      }
    }

    return rows;
  }

  // GRAPH_CONTEXT_V2 — cada JSON/contexto é uma família própria. Isto evita
  // aplicar o percurso personalizado do site principal aos produtos normais
  // do Congresso que usam o mesmo slug.
  function buildGraphData() {
    var nodes = [];
    var nodeById = {};
    var edges = [];
    var edgeKeys = {};
    var clusters = [];
    var clusterY = 28;
    var done = graphDoneLookup();
    var pendingHomeLinks = [];
    var sources = graphSources().sort(function (a, b) {
      if (a.kind === "home") { return -1; }
      if (b.kind === "home") { return 1; }
      return familyLabel(a.slug, a.data).localeCompare(familyLabel(b.slug, b.data), "pt-PT")
        || text(a.contextLabel).localeCompare(text(b.contextLabel), "pt-PT");
    }).filter(function (source) {
      return !state.graph.hiddenFamilies[graphSourceKey(source)];
    });
    var allMode = Object.keys(state.graph.hiddenFamilies).length === 0;
    var hasHomepage = sources.some(function (source) { return source.kind === "home"; });
    var hasProductFamilies = sources.some(function (source) { return source.kind !== "home"; });
    var homeCluster = null;
    state.graph.layoutOriginX = hasHomepage && hasProductFamilies ? 430 : 12;
    if (hasHomepage && hasProductFamilies) { clusterY = 300; }

    function addNode(node) {
      node.galleryCount = Math.max(0, Number(node.galleryCount) || 0);
      node.galleryPendingCount = Math.max(0, Number(node.galleryPendingCount) || 0);
      node.hasEditableImages = node.galleryCount > 0;
      node.hasPendingImages = node.galleryPendingCount > 0;
      nodes.push(node);
      nodeById[node.id] = node;
    }

    function addEdge(from, to, kind, label) {
      var key = from + "|" + to + "|" + (kind || "flow");
      if (!from || !to || from === to || edgeKeys[key]) { return; }
      edgeKeys[key] = true;
      edges.push({ id: graphEdgeId(from, to, kind), from: from, to: to, kind: kind || "flow", label: label || "" });
    }

    sources.forEach(function (source) {
      var entryKey = graphSourceKey(source);

      if (source.kind === "home") {
        var home = source.data || {};
        var homeSlots = graphGallerySlots(source);
        var homeFamilyId = "family|" + entryKey;
        var homeTop = 28 + BAND_TITLE_SPACE;
        var heroY = homeTop + 26;
        var newsY = heroY + stepRowHeight();
        var productsY = newsY + stepRowHeight();
        var categories = (home.categories || []).filter(function (category) {
          var availability = normalize(category && category.available);
          return category && category.showOnHome !== false && category.clickable !== false
            && ["false", "0", "no", "nao", "off", "hidden"].indexOf(availability) === -1;
        });
        var categoryColumns = 1;
        var categoryStartX = 222;
        var categoryRows = Math.max(1, categories.length);
        var homeHeight = Math.max(620, productsY - 28 + categoryRows * productRowHeight() + 92);
        var allHomeStats = graphSlotStats(homeSlots, done);
        var heroStats = graphSlotStats(homeSlots.filter(function (slot) { return slot.section === "Topo da homepage"; }), done);
        var newsStats = graphSlotStats(homeSlots.filter(function (slot) { return slot.slotName === "home-feature"; }), done);

        homeCluster = {
          slug: entryKey,
          label: "Homepage · Site principal",
          isHome: true,
          x: 12,
          width: 400,
          y: 28,
          height: homeHeight,
          productStartY: productsY,
          columns: categoryColumns
        };
        clusters.push(homeCluster);

        addNode({
          id: homeFamilyId,
          type: "family",
          family: entryKey,
          entryKey: entryKey,
          galleryEntryKey: "home",
          context: "principal",
          contextLabel: "Site principal",
          galleryCount: allHomeStats.total,
          galleryPendingCount: allHomeStats.pending,
          label: "Homepage",
          subtitle: categories.length + " ligações públicas",
          x: 32, y: heroY - 4, width: 168, height: 62
        });
        addNode({
          id: "step|" + entryKey + "|hero",
          type: "step",
          family: entryKey,
          entryKey: entryKey,
          galleryEntryKey: "home",
          gallerySection: "Topo da homepage",
          context: "principal",
          contextLabel: "Site principal",
          stepId: "hero",
          galleryCount: heroStats.total,
          galleryPendingCount: heroStats.pending,
          label: "Hero",
          subtitle: "carrossel · entrada",
          x: 222, y: heroY, width: 168, height: 54
        });
        addNode({
          id: "step|" + entryKey + "|novidades",
          type: "step",
          family: entryKey,
          entryKey: entryKey,
          galleryEntryKey: "home",
          gallerySlotName: "home-feature",
          context: "principal",
          contextLabel: "Site principal",
          stepId: "novidades",
          galleryCount: newsStats.total,
          galleryPendingCount: newsStats.pending,
          label: text(home.news && home.news.title || "Novidades"),
          subtitle: "secção da homepage",
          x: 222, y: newsY, width: 168, height: 54
        });
        addNode({
          id: "step|" + entryKey + "|produtos",
          type: "step",
          family: entryKey,
          entryKey: entryKey,
          galleryEntryKey: "home",
          gallerySectionPrefix: "Produto — ",
          context: "principal",
          contextLabel: "Site principal",
          stepId: "produtos",
          galleryCount: Math.max(0, allHomeStats.total - heroStats.total),
          galleryPendingCount: Math.max(0, allHomeStats.pending - heroStats.pending),
          label: text(home.productsIntro && home.productsIntro.title || "Produtos"),
          subtitle: "secção da homepage",
          x: 222, y: productsY, width: 168, height: 54
        });

        addEdge(homeFamilyId, "step|" + entryKey + "|hero", "entry", "Entrada");
        addEdge("step|" + entryKey + "|hero", "step|" + entryKey + "|novidades", "flow", "Ver novidades");
        addEdge("step|" + entryKey + "|hero", "step|" + entryKey + "|produtos", "flow", "Explorar produtos");
        addEdge("step|" + entryKey + "|novidades", "step|" + entryKey + "|produtos", "flow", "Continuar na página");

        categories.forEach(function (category, index) {
          var categorySlots = homeSlots.filter(function (slot) {
            return text(slot.itemId) === text(category.id);
          });
          var categoryStats = graphSlotStats(categorySlots, done);
          var categoryId = "page|" + entryKey + "|" + text(category.id || index);
          var categoryNode = {
            id: categoryId,
            type: "page",
            family: entryKey,
            entryKey: entryKey,
            galleryEntryKey: "home",
            galleryItemId: text(category.id),
            context: "principal",
            contextLabel: "Site principal",
            galleryCount: categoryStats.total,
            galleryPendingCount: categoryStats.pending,
            label: text(category.title || category.menuTitle || category.id),
            subtitle: text(category.href || "ligação"),
            x: categoryStartX + (index % categoryColumns) * columnPitch(),
            y: productsY + Math.floor(index / categoryColumns) * productRowHeight(),
            width: 168,
            height: 50
          };
          addNode(categoryNode);
          addEdge("step|" + entryKey + "|produtos", categoryId, "product", "Abrir categoria");
          if (category.featured === true) {
            addEdge("step|" + entryKey + "|novidades", categoryId, "product", "Abrir destaque");
          }
          pendingHomeLinks.push({ from: categoryId, href: text(category.href).replace(/^\.\//, ""), fallbackIndex: index });
        });

        return;
      }

      var product = source.data || {};
      var recordsInfo = graphSourceProductRecords(source);
      var records = recordsInfo.map(function (row) { return row.record; });
      var steps = Array.isArray(product.steps) ? product.steps : [];
      var familyName = familyLabel(source.slug, product);
      var familyId = "family|" + entryKey;
      var cartId = "cart|" + entryKey;
      var columns = 4;
      var clusterTop = clusterY + BAND_TITLE_SPACE;
      var stepLayout = {};
      var cartY = 0;
      var designStepIndex = steps.findIndex(function (step) { return step && step.id === "designs"; });
      var artworkStepIndex = steps.findIndex(function (step) { return step && step.id === "artwork_upload"; });
      var initialDesignStep = designStepIndex >= 0 ? steps[designStepIndex] : null;
      var initialArtworkStep = artworkStepIndex >= 0 ? steps[artworkStepIndex] : null;
      var catalogOrCustom = product.orderFlow === "catalog-or-custom"
        && !!initialDesignStep && !!initialArtworkStep;
      var boundaryIndex = steps.findIndex(function (step) {
        return step && !step.when && (step.id === "delivery_contact" || step.template === "delivery-contact" || step.id === "confirm");
      });
      var catalogRecordCount = catalogOrCustom
        ? recordsInfo.filter(function (row) { return row.record.sourceId !== "custom-artwork"; }).length
        : records.length;
      var productRows = Math.max(1, Math.ceil(catalogRecordCount / columns));
      var mainCursor = clusterTop + 26;
      var productStartY;
      var productBoxHeight = Math.max(112, productRows * productRowHeight() + 38);
      var productBoxBottom;
      var branchBottom;

      if (designStepIndex >= 0) {
        steps.forEach(function (step, index) {
          if (!step || step.when || index > designStepIndex) { return; }
          stepLayout[index] = { x: columnX(0), y: mainCursor };
          mainCursor += stepRowHeight();
        });
        productStartY = stepLayout[designStepIndex] ? stepLayout[designStepIndex].y : clusterTop + 26;
      } else {
        productStartY = clusterTop + 26;
      }

      productBoxBottom = productStartY - 28 + productBoxHeight;

      var branchGroups = [];
      var branchByKey = {};
      var branchKeyByStep = {};
      steps.forEach(function (step, index) {
        if (!step || !step.when) { return; }
        var condition = step.when || {};
        var accepted = condition.in || (condition.equals != null ? [condition.equals] : []);
        var controller = steps.filter(function (candidate) {
          return candidate && (candidate.id === condition.field || candidate.field === condition.field || candidate.field === condition.field + "[]");
        })[0];
        var key = condition.field === "designs"
          ? "design:" + accepted.join("|")
          : (controller && branchKeyByStep[controller.id]) || "field:" + text(condition.field);
        var label = condition.field === "designs" && accepted.length ? accepted.join(" / ") : text(condition.field || "Condição");
        var chooserField = text(initialDesignStep && (initialDesignStep.orderFlowField
          || initialDesignStep.customUploadOption && initialDesignStep.customUploadOption.field)
          || product.customArtwork && product.customArtwork.selectionField);
        if (catalogOrCustom && chooserField && condition.field === chooserField) {
          label = text(initialDesignStep.customUploadOption && (initialDesignStep.customUploadOption.title
            || initialDesignStep.customUploadOption.label) || "Personalizado");
        }
        if (!branchByKey[key]) {
          branchByKey[key] = { key: key, label: label, members: [] };
          branchGroups.push(branchByKey[key]);
        }
        branchByKey[key].members.push({ step: step, index: index });
        branchKeyByStep[step.id] = key;
      });

      var branchStartY = productBoxBottom + 48;
      var branchLaneByKey = {};
      var conditionOrdinal = 0;
      var conditionRowHeight = state.graph.tidyEdges ? 86 : 72;
      branchGroups.forEach(function (group, index) { branchLaneByKey[group.key] = index % columns; });
      steps.forEach(function (step, index) {
        if (!step || !step.when) { return; }
        var group = branchByKey[branchKeyByStep[step.id]];
        stepLayout[index] = {
          x: columnX(2) + (branchLaneByKey[branchKeyByStep[step.id]] || 0) * columnPitch(),
          y: branchStartY + conditionOrdinal * conditionRowHeight,
          branchLabel: group ? group.label : text(step.when.field || "Condição")
        };
        conditionOrdinal += 1;
      });
      branchBottom = conditionOrdinal ? branchStartY + (conditionOrdinal - 1) * conditionRowHeight + 54 : productBoxBottom;

      if (designStepIndex >= 0) {
        mainCursor = Math.max(productBoxBottom, branchBottom) + 46;
        steps.forEach(function (step, index) {
          if (!step || step.when || index <= designStepIndex) { return; }
          if (index === boundaryIndex && !cartY) {
            cartY = mainCursor;
            mainCursor += stepRowHeight();
          }
          stepLayout[index] = { x: columnX(0), y: mainCursor };
          mainCursor += stepRowHeight();
        });
      } else {
        steps.forEach(function (step, index) {
          if (!step || step.when) { return; }
          if (index === boundaryIndex && !cartY) {
            cartY = mainCursor;
            mainCursor += stepRowHeight();
          }
          stepLayout[index] = { x: columnX(0), y: mainCursor };
          mainCursor += stepRowHeight();
        });
      }
      if (!cartY) { cartY = mainCursor; mainCursor += stepRowHeight(); }
      var flowBottom = Math.max(cartY + 58, mainCursor, branchBottom, productBoxBottom);
      var clusterHeight = Math.max(410, flowBottom - clusterY + 74);
      var stepById = {};
      var productNodeByKey = {};
      var galleryKey = graphGalleryEntryKey(source);
      var gallerySlots = graphGallerySlots(source);
      var galleryStepCounts = {};
      var galleryStepPending = {};
      var galleryItemCounts = {};
      var galleryItemPending = {};
      var galleryStats = graphSlotStats(gallerySlots, done);

      gallerySlots.forEach(function (slot) {
        var visibleStepIndex = slot.previewStepIndex != null ? slot.previewStepIndex : slot.stepIndex;
        var ownerItemId = text(slot.ownerItemId || slot.itemId);
        galleryStepCounts[visibleStepIndex] = (galleryStepCounts[visibleStepIndex] || 0) + 1;
        if (!graphSlotIsDone(slot, done)) {
          galleryStepPending[visibleStepIndex] = (galleryStepPending[visibleStepIndex] || 0) + 1;
        }
        if (ownerItemId) {
          galleryItemCounts[ownerItemId] = (galleryItemCounts[ownerItemId] || 0) + 1;
          if (!graphSlotIsDone(slot, done)) {
            galleryItemPending[ownerItemId] = (galleryItemPending[ownerItemId] || 0) + 1;
          }
        }
      });

      clusters.push({
        slug: entryKey,
        label: familyName + " · " + source.contextLabel,
        x: state.graph.layoutOriginX,
        y: clusterY,
        height: clusterHeight,
        productStartY: productStartY,
        columns: columns,
        productBox: {
          x: columnX(2) - 18,
          y: productStartY - 28,
          width: NODE_WIDTH + (columns - 1) * columnPitch() + 36,
          height: productBoxHeight,
          count: catalogRecordCount,
          label: familyName
        },
        conditionBox: branchGroups.length ? {
          x: columnX(2) - 18,
          y: branchStartY - 28,
          width: NODE_WIDTH + (columns - 1) * columnPitch() + 36,
          height: Math.max(104, branchBottom - branchStartY + 82),
          count: branchGroups.length
        } : null
      });

      addNode({
        id: familyId,
        type: "family",
        family: entryKey,
        entryKey: entryKey,
        galleryEntryKey: galleryKey,
        context: source.context,
        contextLabel: source.contextLabel,
        galleryCount: galleryStats.total,
        galleryPendingCount: galleryStats.pending,
        label: familyName,
        subtitle: source.contextLabel + " · " + records.length + " produto" + (records.length === 1 ? "" : "s"),
        x: state.graph.layoutOriginX + 16, y: clusterTop + 22, width: 178, height: 62
      });
      addNode({
        id: cartId,
        type: "cart",
        family: entryKey,
        entryKey: entryKey,
        galleryEntryKey: galleryKey,
        context: source.context,
        contextLabel: source.contextLabel,
        galleryCount: gallerySlots.filter(function (slot) { return !!slot.summaryKey; }).length,
        galleryPendingCount: gallerySlots.filter(function (slot) {
          return !!slot.summaryKey && !graphSlotIsDone(slot, done);
        }).length,
        label: "Carrinho",
        subtitle: familyName + " · " + source.contextLabel,
        x: columnX(0), y: cartY, width: 168, height: 58
      });

      steps.forEach(function (step, index) {
        var stepId = text(step.id || index);
        var id = "step|" + entryKey + "|" + stepId;
        var node = {
          id: id,
          type: "step",
          family: entryKey,
          entryKey: entryKey,
          galleryEntryKey: galleryKey,
          context: source.context,
          contextLabel: source.contextLabel,
          stepId: stepId,
          stepIndex: index,
          galleryCount: galleryStepCounts[index] || 0,
          galleryPendingCount: galleryStepPending[index] || 0,
          field: text(step.field),
          label: text(step.title || step.label || step.id),
          subtitle: (step.when && stepLayout[index].branchLabel ? "Quando " + stepLayout[index].branchLabel + " · " : "")
            + text(step.template || "passo") + " · " + source.contextLabel,
          conditional: !!step.when,
          hidden: step.hidden === true,
          condition: step.when || null,
          branchLabel: stepLayout[index].branchLabel || "",
          x: stepLayout[index].x,
          y: stepLayout[index].y,
          width: 168,
          height: 54
        };
        addNode(node);
        stepById[step.id] = node;
      });

      var catalogNodeIndex = 0;
      recordsInfo.forEach(function (row) {
        var record = row.record;
        var id = "product|" + entryKey + "|" + record.key;
        var isCustomArtwork = record.sourceId === "custom-artwork";
        var customLayout = catalogOrCustom && isCustomArtwork && stepLayout[artworkStepIndex];
        var gridIndex = customLayout ? 0 : catalogNodeIndex++;
        var node = {
          id: id,
          type: "product",
          family: entryKey,
          entryKey: entryKey,
          galleryEntryKey: galleryKey,
          context: source.context,
          contextLabel: source.contextLabel,
          recordKey: record.key,
          sourceId: record.sourceId,
          galleryItemId: row.itemId,
          galleryCount: row.itemId ? (galleryItemCounts[row.itemId] || 0) : 0,
          galleryPendingCount: row.itemId ? (galleryItemPending[row.itemId] || 0) : 0,
          sourceValue: row.itemValue,
          label: record.name,
          subtitle: record.price + " · " + source.contextLabel,
          configurable: record.kind === "configurable",
          x: customLayout ? customLayout.x + columnPitch() : columnX(2) + (gridIndex % columns) * columnPitch(),
          y: customLayout ? customLayout.y + 2 : productStartY + Math.floor(gridIndex / columns) * productRowHeight(),
          width: 168,
          height: 50
        };
        addNode(node);
        productNodeByKey[record.key] = node;
      });

      if (!steps.length) {
        recordsInfo.forEach(function (row) {
          var id = productNodeByKey[row.record.key] && productNodeByKey[row.record.key].id;
          addEdge(familyId, id, "product", "Produto");
          addEdge(id, cartId, "cart", "Adicionar ao carrinho");
        });
        clusterY += clusterHeight;
        return;
      }

      var designIndex = steps.findIndex(function (step) { return step && step.id === "designs"; });
      var designStep = designIndex >= 0 ? steps[designIndex] : null;
      var designNode = designStep ? stepById[designStep.id] : null;
      var normalProductNodes = recordsInfo.filter(function (row) { return row.record.sourceId !== "custom-artwork"; }).map(function (row) {
        return productNodeByKey[row.record.key];
      }).filter(Boolean);
      var customProductNodes = recordsInfo.filter(function (row) { return row.record.sourceId === "custom-artwork"; }).map(function (row) {
        return productNodeByKey[row.record.key];
      }).filter(Boolean);
      var artworkStep = stepById.artwork_upload;
      var customEntryMode = !!(artworkStep && customProductNodes.length);
      var hasConditionalSteps = steps.some(function (step) { return !!(step && step.when); });

      // Os catálogos novos começam todos no mesmo Passo 1. A pessoa pode
      // seguir pelos designs existentes ou abrir o upload original; os dois
      // percursos só voltam a juntar-se nos passos comuns e no carrinho.
      if (catalogOrCustom && designNode && artworkStep) {
        var customOption = designStep.customUploadOption || {};
        var customSettings = product.customArtwork || {};
        var orderFlowField = text(customOption.field || designStep.orderFlowField
          || customSettings.selectionField || "order_flow");
        var catalogFlowValue = text(designStep.catalogFlowValue || customSettings.catalogValue || "catalog");
        var customFlowValue = text(customOption.value || customSettings.customValue || "custom");
        var designSelectionField = text(designStep.field || "designs").replace(/\[\]$/, "") || "designs";
        var beforeChooser = familyId;

        steps.slice(0, designIndex + 1).forEach(function (step) {
          var current = step && stepById[step.id];
          if (!current || step.when) { return; }
          addEdge(beforeChooser, current.id, beforeChooser === familyId ? "entry" : "flow", "Continuar");
          beforeChooser = current.id;
        });

        function addBranchPath(startId, startIndex, baseSelections) {
          var scenarios = graphConditionScenarios(steps.slice(startIndex + 1), baseSelections);
          scenarios.forEach(function (selections) {
            var previous = startId;
            var cartUsed = false;

            steps.slice(startIndex + 1).forEach(function (step) {
              var current = step && stepById[step.id];
              var isBoundary;
              if (!current || (step.when && !graphConditionMatches(step.when, selections))) { return; }

              isBoundary = step.id === "delivery_contact" || step.template === "delivery-contact" || step.id === "confirm";
              if (isBoundary && !cartUsed) {
                addEdge(previous, cartId, "cart", "Adicionar ao carrinho");
                addEdge(cartId, current.id, "checkout", "Continuar pedido");
                cartUsed = true;
              } else {
                addEdge(previous, current.id, step.when ? "conditional" : "flow",
                  step.when ? "Condição válida" : "Continuar");
              }
              previous = current.id;
            });

            if (!cartUsed) { addEdge(previous, cartId, "cart", "Adicionar ao carrinho"); }
          });
        }

        recordsInfo.filter(function (row) {
          return row.record.sourceId !== "custom-artwork" && !!productNodeByKey[row.record.key];
        }).forEach(function (row) {
          var productNode = productNodeByKey[row.record.key];
          var catalogSelections = {};
          catalogSelections[orderFlowField] = catalogFlowValue;
          catalogSelections[designSelectionField] = row.itemValue;
          addEdge(designNode.id, productNode.id, "product", "Escolher design existente");
          addBranchPath(productNode.id, designIndex, catalogSelections);
        });

        var customSelections = {};
        customSelections[orderFlowField] = customFlowValue;
        addEdge(designNode.id, artworkStep.id, "conditional", "Personalizar · carregar ficheiros");
        customProductNodes.forEach(function (node) {
          var feeLabel = Number(customSettings.feePerFileCents) > 0
            ? "Imagem personalizada · " + formatCents(customSettings.feePerFileCents) + " por ficheiro"
            : "Imagem personalizada";
          addEdge(artworkStep.id, node.id, "product", feeLabel);
          addBranchPath(node.id, artworkStepIndex, customSelections);
        });

        clusterY += clusterHeight;
        return;
      }

      // Um fluxo com condições é uma sequência de passos visíveis, não um
      // conjunto de atalhos para o próximo passo comum. Enumeramos os estados
      // relevantes das condições e ligamos apenas pares que podem aparecer
      // consecutivamente no site. Assim os ramos voltam a juntar-se no seu
      // verdadeiro fim, sem falsos saltos directos para entrega/embalagem.
      if (designNode && hasConditionalSteps) {
        var beforeDesign = familyId;
        steps.slice(0, designIndex + 1).forEach(function (step) {
          var current = step && stepById[step.id];
          if (!current || step.when) { return; }
          addEdge(beforeDesign, current.id, beforeDesign === familyId ? "entry" : "flow", "Continuar");
          beforeDesign = current.id;
        });

        recordsInfo.filter(function (row) {
          return row.record.sourceId !== "custom-artwork" && !!productNodeByKey[row.record.key];
        }).forEach(function (row) {
          var productNode = productNodeByKey[row.record.key];
          var scenarios = graphConditionScenarios(steps.slice(designIndex + 1), { designs: row.itemValue });
          addEdge(designNode.id, productNode.id, "product", "Escolha de produto");

          scenarios.forEach(function (selections) {
            var previous = productNode.id;
            var cartUsed = false;

            steps.slice(designIndex + 1).forEach(function (step) {
              var current = step && stepById[step.id];
              var isBoundary;
              if (!current || (step.when && !graphConditionMatches(step.when, selections))) { return; }

              isBoundary = step.id === "delivery_contact" || step.template === "delivery-contact" || step.id === "confirm";
              if (isBoundary && !cartUsed) {
                addEdge(previous, cartId, "cart", "Adicionar ao carrinho");
                addEdge(cartId, current.id, "checkout", "Continuar pedido");
                cartUsed = true;
              } else {
                addEdge(previous, current.id, step.when ? "conditional" : "flow",
                  step.when ? "Condição válida" : "Continuar");
              }
              previous = current.id;
            });

            if (!cartUsed) { addEdge(previous, cartId, "cart", "Adicionar ao carrinho"); }
          });
        });

        clusterY += clusterHeight;
        return;
      }

      if (customEntryMode) {
        customProductNodes.forEach(function (node) {
          addEdge(familyId, node.id, "product", "Escolher produto personalizado");
          addEdge(node.id, artworkStep.id, "flow", "Começar personalização");
        });
      } else {
        addEdge(familyId, "step|" + entryKey + "|" + text(steps[0].id || 0), "entry", "Entrada");
      }

      if (designNode) {
        normalProductNodes.forEach(function (node) {
          addEdge(designNode.id, node.id, "product", "Escolha de produto");
        });
      }

      var previousUnconditional = null;
      var cartBoundaryUsed = false;
      steps.forEach(function (step) {
        var current = stepById[step.id];
        if (!current || step.when) { return; }
        if (!previousUnconditional) {
          previousUnconditional = current;
          return;
        }

        if (customEntryMode && previousUnconditional.stepId === "designs" && current.stepId === "artwork_upload") {
          previousUnconditional = current;
          return;
        }

        var isBoundary = step.id === "delivery_contact" || step.template === "delivery-contact" || step.id === "confirm";
        var bridgeNodes = previousUnconditional.stepId === "designs" ? normalProductNodes : [];

        if (isBoundary && !cartBoundaryUsed) {
          if (bridgeNodes.length) {
            bridgeNodes.forEach(function (node) { addEdge(node.id, cartId, "cart", "Adicionar ao carrinho"); });
          } else {
            addEdge(previousUnconditional.id, cartId, "cart", "Adicionar ao carrinho");
          }
          addEdge(cartId, current.id, "checkout", "Continuar pedido");
          cartBoundaryUsed = true;
        } else if (bridgeNodes.length) {
          bridgeNodes.forEach(function (node) { addEdge(node.id, current.id, "flow", "Continuar"); });
        } else {
          addEdge(previousUnconditional.id, current.id, "flow", "Continuar");
        }
        previousUnconditional = current;
      });

      steps.forEach(function (step, index) {
        if (!step || !step.when || !stepById[step.id]) { return; }
        var current = stepById[step.id];
        var condition = step.when;
        var controller = steps.filter(function (candidate) {
          return candidate && (candidate.id === condition.field || candidate.field === condition.field || candidate.field === condition.field + "[]");
        })[0];
        var linkedFromProduct = false;

        if (condition.field === "designs" && designStep && Array.isArray(designStep.items)) {
          var accepted = condition.in || (condition.equals != null ? [condition.equals] : []);
          designStep.items.forEach(function (item) {
            if (accepted.length && accepted.indexOf(item.value) === -1) { return; }
            var recordKey = canonicalRecordKey(source, item);
            var node = productNodeByKey[recordKey];
            if (node) {
              addEdge(node.id, current.id, "conditional", "Quando " + accepted.join(" / "));
              linkedFromProduct = true;
            }
          });
        }
        if (!linkedFromProduct && controller && stepById[controller.id]) {
          addEdge(stepById[controller.id].id, current.id, "conditional", "Condição");
        }

        var nextUnconditional = steps.slice(index + 1).filter(function (candidate) { return candidate && !candidate.when; })[0];
        if (nextUnconditional && stepById[nextUnconditional.id]) {
          var nextIsBoundary = nextUnconditional.id === "delivery_contact" || nextUnconditional.template === "delivery-contact" || nextUnconditional.id === "confirm";
          if (nextIsBoundary) {
            addEdge(current.id, cartId, "cart", "Adicionar ao carrinho");
          } else {
            addEdge(current.id, stepById[nextUnconditional.id].id, "merge", "Retomar fluxo");
          }
        }
      });

      if (!cartBoundaryUsed && previousUnconditional) {
        if (previousUnconditional.stepId === "designs" && normalProductNodes.length) {
          normalProductNodes.forEach(function (node) { addEdge(node.id, cartId, "cart", "Adicionar ao carrinho"); });
        } else {
          addEdge(previousUnconditional.id, cartId, "cart", "Adicionar ao carrinho");
        }
      }

      clusterY += clusterHeight;
    });

    pendingHomeLinks.forEach(function (link) {
      var target = sources.filter(function (source) {
        return source.kind !== "home" && text(source.page).replace(/^\.\//, "") === link.href;
      })[0];
      if (target) {
        link.targetId = "family|" + graphSourceKey(target);
        addEdge(link.from, link.targetId, "entry", "Abrir produto");
      }
    });

    if (allMode) {
      state.graph.allNodeById = Object.assign({}, nodeById);
      state.graph.allBaseEdges = edges.slice();
    }

    state.graph.memberRemap = {};
    if (state.graph.collapsed) {
      var collapsed = collapseGraphData(nodes, nodeById, edges, clusters);
      nodes = collapsed.nodes;
      nodeById = collapsed.nodeById;
      edges = collapsed.edges;
      clusterY = collapsed.bottom;
      state.graph.memberRemap = collapsed.remap || {};
    }

    var usedHomeRows = {};
    pendingHomeLinks.forEach(function (link) {
      var pageNode = nodeById[link.from];
      var targetNode = link.targetId && nodeById[link.targetId];
      if (!pageNode) { return; }
      var wanted = targetNode ? Math.round(targetNode.y + (targetNode.height - pageNode.height) / 2) : 344 + link.fallbackIndex * productRowHeight();
      while (usedHomeRows[wanted]) { wanted += productRowHeight(); }
      usedHomeRows[wanted] = true;
      pageNode.y = Math.max(344, wanted);
    });
    if (homeCluster) {
      var homeBottom = nodes.filter(function (node) { return node.family === homeCluster.slug; }).reduce(function (bottom, node) {
        return Math.max(bottom, node.y + node.height + 42);
      }, homeCluster.y + homeCluster.height);
      homeCluster.height = Math.max(homeCluster.height, homeBottom - homeCluster.y, clusterY - homeCluster.y);
      clusterY = Math.max(clusterY, homeCluster.y + homeCluster.height);
    }

    applyStoredGraphPositions(nodes);

    state.graph.nodes = nodes;
    state.graph.nodeById = nodeById;
    state.graph.baseEdges = edges;
    state.graph.clusters = clusters;
    rebuildVisitorGraphIndex(nodeById);
    applyVisitorGraphStats(nodes);
    state.graph.worldWidth = graphExtent(nodes, "x", "width", hasProductFamilies ? graphWorldWidth() : (hasHomepage ? 430 : 840));
    state.graph.worldHeight = graphExtent(nodes, "y", "height", Math.max(720, clusterY + 20));
  }

  function commonLabelPrefix(values) {
    var prefix = values[0] || "";
    values.forEach(function (value) {
      var index = 0;
      while (index < prefix.length && index < value.length && prefix.charAt(index) === value.charAt(index)) {
        index += 1;
      }
      prefix = prefix.slice(0, index);
    });
    return prefix
      .replace(/[\s\-–—·,:;(]+$/, "")
      .replace(/\s*\d+$/, "")
      .replace(/[\s\-–—·,:;(]+$/, "")
      .trim();
  }

  function groupNodeLabel(members, fallback) {
    var prefix = commonLabelPrefix(members.map(function (member) { return member.label; }));
    return prefix.length >= 3 ? prefix : fallback;
  }

  function groupNodeSubtitle(members) {
    var subtitles = {};
    members.forEach(function (member) { subtitles[member.subtitle] = true; });
    var unique = Object.keys(subtitles);
    return members.length + " produtos" + (unique.length === 1 && unique[0] ? " · " + unique[0] : "");
  }

  function collapseGraphData(nodes, nodeById, edges, clusters) {
    var remap = {};
    var nextNodes = [];
    var nextNodeById = {};
    var consumed = {};

    function memberDescriptor(member) {
      return {
        id: member.id,
        type: member.type,
        stepId: member.stepId || "",
        label: member.label,
        subtitle: member.subtitle,
        recordKey: member.recordKey,
        entryKey: member.entryKey,
        galleryEntryKey: member.galleryEntryKey,
        galleryItemId: member.galleryItemId,
        context: member.context,
        contextLabel: member.contextLabel
      };
    }

    function registerGroup(group, members) {
      members.forEach(function (member) {
        consumed[member.id] = group.id;
        remap[member.id] = group.id;
      });
      nextNodeById[group.id] = group;
    }

    var productsByFamily = {};
    nodes.forEach(function (node) {
      if (node.type === "product") {
        // Mantém o produto personalizado fora do grupo dos designs de
        // catálogo. Caso contrário, o modo compacto apagava visualmente a
        // bifurcação principal dos novos fluxos.
        var groupKey = node.family + "|" + (node.configurable ? "configurable" : "catalog");
        (productsByFamily[groupKey] = productsByFamily[groupKey] || []).push(node);
      }
    });
    Object.keys(productsByFamily).forEach(function (groupKey) {
      var members = productsByFamily[groupKey];
      if (members.length < 2) { return; }
      var first = members[0];
      var family = first.family;
      var familyNode = nodeById["family|" + family];
      var group = {
        id: "group|" + family + "|products-" + (first.configurable ? "configurable" : "catalog"),
        type: "product",
        family: family,
        group: true,
        groupKind: "products",
        count: members.length,
        members: members.map(memberDescriptor),
        entryKey: first.entryKey,
        galleryEntryKey: first.galleryEntryKey,
        context: first.context,
        contextLabel: first.contextLabel,
        galleryCount: members.reduce(function (total, member) { return total + (member.galleryCount || 0); }, 0),
        galleryPendingCount: members.reduce(function (total, member) { return total + (member.galleryPendingCount || 0); }, 0),
        hasEditableImages: members.some(function (member) { return member.hasEditableImages; }),
        hasPendingImages: members.some(function (member) { return member.hasPendingImages; }),
        configurable: members.some(function (member) { return member.configurable; }),
        label: familyNode ? familyNode.label : groupNodeLabel(members, first.label),
        subtitle: members.length + " opções de produto",
        x: first.x,
        y: first.y,
        width: first.width,
        height: first.height
      };
      registerGroup(group, members);
    });

    var checkoutByFamily = {};
    nodes.forEach(function (node) {
      if (node.type === "cart" || (node.type === "step" && ["delivery_contact", "confirm"].indexOf(node.stepId) !== -1)) {
        (checkoutByFamily[node.family] = checkoutByFamily[node.family] || []).push(node);
      }
    });
    Object.keys(checkoutByFamily).forEach(function (family) {
      var order = { cart: 0, delivery_contact: 1, confirm: 2 };
      var members = checkoutByFamily[family].sort(function (a, b) {
        return (a.type === "cart" ? 0 : order[a.stepId] || 9) - (b.type === "cart" ? 0 : order[b.stepId] || 9);
      });
      if (members.length < 2) { return; }
      var first = members[0];
      var group = {
        id: "group|" + family + "|checkout",
        type: "cart",
        family: family,
        group: true,
        groupKind: "checkout",
        count: members.length,
        members: members.map(memberDescriptor),
        entryKey: first.entryKey,
        galleryEntryKey: first.galleryEntryKey,
        context: first.context,
        contextLabel: first.contextLabel,
        galleryCount: members.reduce(function (total, member) { return total + (member.galleryCount || 0); }, 0),
        galleryPendingCount: members.reduce(function (total, member) { return total + (member.galleryPendingCount || 0); }, 0),
        hasEditableImages: members.some(function (member) { return member.hasEditableImages; }),
        hasPendingImages: members.some(function (member) { return member.hasPendingImages; }),
        label: "Finalizar encomenda",
        subtitle: members.map(function (member) { return member.type === "cart" ? "Carrinho" : member.label; }).join(" → "),
        x: first.x,
        y: first.y,
        width: first.width,
        height: Math.max(first.height, 58)
      };
      registerGroup(group, members);
    });

    nodes.forEach(function (node) {
      if (consumed[node.id]) {
        var group = nextNodeById[consumed[node.id]];
        if (nextNodes.indexOf(group) === -1) { nextNodes.push(group); }
        return;
      }
      remap[node.id] = node.id;
      nextNodes.push(node);
      nextNodeById[node.id] = node;
    });

    var nextEdges = [];
    var seen = {};
    edges.forEach(function (edge) {
      var from = remap[edge.from] || edge.from;
      var to = remap[edge.to] || edge.to;
      if (from === to) { return; }
      var key = from + "|" + to + "|" + edge.kind;
      if (seen[key]) { return; }
      seen[key] = true;
      var merged = consumed[edge.from] || consumed[edge.to];
      nextEdges.push({
        id: merged ? "group|" + key : edge.id,
        from: from,
        to: to,
        kind: edge.kind,
        label: edge.label,
        grouped: !!merged
      });
    });

    var productClusters = clusters.filter(function (cluster) { return !cluster.isHome; });
    var bottom = productClusters.length ? productClusters[0].y : 28;
    productClusters.forEach(function (cluster) {
      var products = nextNodes.filter(function (node) {
        return node.type === "product" && node.family === cluster.slug;
      });
      products.forEach(function (node, index) {
        var box = cluster.productBox;
        node.x = box ? box.x + 24 + (index % cluster.columns) * columnPitch() : columnX(2) + (index % cluster.columns) * columnPitch();
        node.y = box ? box.y + 44 + Math.floor(index / cluster.columns) * productRowHeight() : cluster.productStartY + Math.floor(index / cluster.columns) * productRowHeight();
      });
      if (cluster.productBox && products.length === 1 && products[0].groupKind === "products") {
        cluster.productBox.width = NODE_WIDTH + 72;
        cluster.productBox.height = 122;
        products[0].x = cluster.productBox.x + 30;
        products[0].y = cluster.productBox.y + 46;
      }
      var familyBottom = nextNodes.filter(function (node) { return node.family === cluster.slug; }).reduce(function (maximum, node) {
        return Math.max(maximum, node.y + node.height);
      }, cluster.y + 320);
      if (cluster.productBox) { familyBottom = Math.max(familyBottom, cluster.productBox.y + cluster.productBox.height); }
      if (cluster.conditionBox) { familyBottom = Math.max(familyBottom, cluster.conditionBox.y + cluster.conditionBox.height); }
      var height = Math.max(360, familyBottom - cluster.y + 54);
      var delta = bottom - cluster.y;
      if (delta) {
        nextNodes.forEach(function (node) {
          if (node.family === cluster.slug) { node.y += delta; }
        });
        cluster.productStartY += delta;
        if (cluster.productBox) { cluster.productBox.y += delta; }
        if (cluster.conditionBox) { cluster.conditionBox.y += delta; }
        cluster.y = bottom;
      }
      cluster.height = height;
      bottom += height;
    });

    return { nodes: nextNodes, nodeById: nextNodeById, edges: nextEdges, bottom: bottom, remap: remap };
  }

  function effectiveGraphEdges() {
    var removed = state.graphDraft.removedEdges;
    var nodes = state.graph.nodeById;
    var base = state.graph.baseEdges.filter(function (edge) {
      return removed.indexOf(edge.id) === -1 && nodes[edge.from] && nodes[edge.to];
    });
    var added = state.graphDraft.addedEdges.filter(function (edge) {
      return nodes[edge.from] && nodes[edge.to];
    }).map(function (edge) {
      return Object.assign({}, edge, { kind: "playground", playground: true });
    });
    return base.concat(added);
  }

  function renderGraphFamilyOptions() {
    var container = document.querySelector("[data-graph-family-options]");
    var summary = document.querySelector("[data-graph-family-summary]");
    var labels = {};
    graphSources().forEach(function (source) {
      labels[graphSourceKey(source)] = familyLabel(source.slug, source.data) + " · " + source.contextLabel;
    });
    var keys = Object.keys(labels).sort(function (a, b) {
      return labels[a].localeCompare(labels[b], "pt-PT");
    });
    var visible = keys.filter(function (key) { return !state.graph.hiddenFamilies[key]; });

    summary.textContent = visible.length === keys.length
      ? "Todas as famílias"
      : (visible.length ? visible.length + " de " + keys.length + " famílias" : "Nenhuma família");
    container.innerHTML = '<label class="graph-family-option"><input type="checkbox" data-graph-family-all'
      + (visible.length === keys.length ? " checked" : "") + '><span>Todas as famílias</span></label>'
      + keys.map(function (key) {
        return '<label class="graph-family-option"><input type="checkbox" data-graph-family-option="' + escapeHtml(key) + '"'
          + (state.graph.hiddenFamilies[key] ? "" : " checked") + '><span>' + escapeHtml(labels[key]) + '</span></label>';
      }).join("");

    var all = container.querySelector("[data-graph-family-all]");
    all.indeterminate = visible.length > 0 && visible.length < keys.length;
    all.addEventListener("change", function () {
      state.graph.hiddenFamilies = {};
      if (!all.checked) {
        keys.forEach(function (key) { state.graph.hiddenFamilies[key] = true; });
      }
      state.graph.selectedId = "";
      state.graph.linkSourceId = "";
      state.graph.fitted = false;
      renderGraphFamilyOptions();
      renderGraph();
      fitGraph();
    });
    container.querySelectorAll("[data-graph-family-option]").forEach(function (checkbox) {
      checkbox.addEventListener("change", function () {
        var key = checkbox.dataset.graphFamilyOption;
        if (checkbox.checked) { delete state.graph.hiddenFamilies[key]; }
        else { state.graph.hiddenFamilies[key] = true; }
        state.graph.selectedId = "";
        state.graph.linkSourceId = "";
        state.graph.fitted = false;
        renderGraphFamilyOptions();
        renderGraph();
        fitGraph();
      });
    });
  }

  function graphNodeClass(node, focus) {
    var classes = ["graph-node", "is-" + node.type];
    if (node.conditional) { classes.push("is-conditional"); }
    if (node.hidden) { classes.push("is-hidden-node"); }
    if (node.configurable) { classes.push("is-configurable"); }
    if (node.group) { classes.push("is-group"); }
    if (node.hasEditableImages) { classes.push("has-editable-images"); }
    if (node.hasPendingImages) { classes.push("has-pending-images"); }
    if (state.graph.selectedId === node.id) { classes.push("is-selected"); }
    if (state.graph.linkSourceId === node.id) { classes.push("is-link-source"); }
    if (focus && !focus[node.id]) { classes.push("is-dimmed"); }
    return classes.join(" ");
  }

  function graphFocusSet() {
    var selected = state.graph.selectedId;
    if (!selected || !state.graph.nodeById[selected]) {
      return null;
    }
    var focus = {};
    focus[selected] = true;
    effectiveGraphEdges().forEach(function (edge) {
      if (edge.from === selected) { focus[edge.to] = true; }
      if (edge.to === selected) { focus[edge.from] = true; }
    });
    return focus;
  }

  function graphNodeIcon(node) {
    if (node.group) { return "×" + node.count; }
    if (node.type === "family") { return "F"; }
    if (node.type === "step") { return node.conditional ? "?" : "P"; }
    if (node.type === "page") { return "L"; }
    if (node.type === "cart") { return "C"; }
    return node.configurable ? "±" : "•";
  }

  function bindGraphNodeDrag(button, node) {
    button.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) { return; }
      var start = {
        id: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        x: node.x,
        y: node.y,
        moved: false
      };
      button.setPointerCapture(event.pointerId);

      function move(moveEvent) {
        if (moveEvent.pointerId !== start.id) { return; }
        var deltaX = (moveEvent.clientX - start.clientX) / state.graph.zoom;
        var deltaY = (moveEvent.clientY - start.clientY) / state.graph.zoom;
        if (!start.moved && Math.hypot(deltaX, deltaY) < 4) { return; }
        start.moved = true;
        button.dataset.graphDragged = "true";
        button.classList.add("is-dragging");
        node.x = Math.max(12, Math.min(state.graph.worldWidth - node.width - 12, start.x + deltaX));
        node.y = Math.max(12, Math.min(state.graph.worldHeight - node.height - 12, start.y + deltaY));
        button.style.left = Math.round(node.x) + "px";
        button.style.top = Math.round(node.y) + "px";
        state.graph.routes = null;
        state.graph.fitted = false;
        drawGraphEdges();
      }

      function stop(stopEvent) {
        if (stopEvent.pointerId !== start.id) { return; }
        if (button.hasPointerCapture(start.id)) { button.releasePointerCapture(start.id); }
        button.removeEventListener("pointermove", move);
        button.removeEventListener("pointerup", stop);
        button.removeEventListener("pointercancel", stop);
        button.classList.remove("is-dragging");
        if (start.moved) {
          state.graphPositions[node.id] = { x: Math.round(node.x), y: Math.round(node.y) };
          saveGraphPositions();
          window.setTimeout(function () { delete button.dataset.graphDragged; }, 0);
        }
      }

      button.addEventListener("pointermove", move);
      button.addEventListener("pointerup", stop);
      button.addEventListener("pointercancel", stop);
    });
  }

  function renderGraph() {
    var nodesContainer = document.querySelector("[data-graph-nodes]");
    var world = document.querySelector("[data-graph-world]");
    var canvas = document.querySelector("[data-graph-canvas]");
    buildGraphData();
    state.graph.routes = null;
    world.style.width = state.graph.worldWidth + "px";
    world.style.height = state.graph.worldHeight + "px";
    nodesContainer.style.width = state.graph.worldWidth + "px";
    nodesContainer.style.height = state.graph.worldHeight + "px";
    canvas.width = state.graph.worldWidth;
    canvas.height = state.graph.worldHeight;
    canvas.style.width = state.graph.worldWidth + "px";
    canvas.style.height = state.graph.worldHeight + "px";

    var focus = graphFocusSet();
    nodesContainer.innerHTML = state.graph.nodes.map(function (node) {
      var imageLabel = node.galleryCount === 1 ? "1 imagem editável" : node.galleryCount + " imagens editáveis";
      var pendingLabel = node.galleryPendingCount === 1 ? "1 imagem por finalizar" : node.galleryPendingCount + " imagens por finalizar";
      var visitorLabel = node.visitorTotal ? node.visitorTotal + " visitantes passaram" + (node.visitorHere ? "; " + node.visitorHere + " agora" : "") : "";
      return '<button type="button" class="' + graphNodeClass(node, focus) + '" data-graph-node="' + escapeHtml(node.id) + '" aria-label="'
        + escapeHtml(node.label + (node.hasEditableImages ? ". " + imageLabel : "") + (node.hasPendingImages ? ". " + pendingLabel : "") + (visitorLabel ? ". " + visitorLabel : ""))
        + '" style="left:' + node.x + 'px;top:' + node.y + 'px;width:' + node.width + 'px;height:' + node.height + 'px">'
        + '<span class="graph-node-icon">' + escapeHtml(graphNodeIcon(node)) + '</span>'
        + '<span class="graph-node-copy"><strong>' + escapeHtml(node.label) + '</strong><small>' + escapeHtml(node.subtitle) + '</small></span>'
        + (node.hasEditableImages ? '<span class="graph-node-media" aria-hidden="true">'
          + (node.hasPendingImages ? '<i class="graph-node-pending-dot"></i>' : '') + '▣ ' + node.galleryCount + '</span>' : "")
        + graphVisitorBadgeMarkup(node)
        + '</button>';
    }).join("");

    nodesContainer.querySelectorAll("[data-graph-node]").forEach(function (button) {
      var node = state.graph.nodeById[button.dataset.graphNode];
      if (node) { bindGraphNodeDrag(button, node); }
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        if (button.dataset.graphDragged === "true") {
          delete button.dataset.graphDragged;
          return;
        }
        selectGraphNode(button.dataset.graphNode);
      });
    });
    document.querySelector("[data-graph-empty]").hidden = state.graph.nodes.length > 0;
    applyGraphTransform();
    drawGraphEdges();
    renderGraphInspector();
    renderGraphChangeCount();
    updateGraphPositionResetUi();
    updateGraphPlaygroundUi();
  }

  function applyGraphTransform() {
    var world = document.querySelector("[data-graph-world]");
    var viewport = document.querySelector("[data-graph-viewport]");
    var zoom = state.graph.zoom;
    world.style.transform = "translate(" + state.graph.panX + "px," + state.graph.panY + "px) scale(" + zoom + ")";
    document.querySelector("[data-graph-zoom-label]").textContent = Math.round(zoom * 100) + "%";
    viewport.classList.toggle("is-zoom-far", zoom < ZOOM_FAR);
    viewport.classList.toggle("is-zoom-mid", zoom >= ZOOM_FAR && zoom < ZOOM_MID);
    if (state.graph.drawnZoom !== zoom) {
      drawGraphEdges();
    }
  }

  function roundedRectPath(context, x, y, width, height, radius) {
    var r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function drawGraphBands(context, canvas) {
    var zoom = state.graph.zoom;
    var fontSize = Math.max(15, Math.min(46, 15 / zoom));
    state.graph.clusters.forEach(function (cluster, index) {
      var bandX = cluster.x == null ? 12 : cluster.x;
      var bandWidth = cluster.width || Math.max(320, canvas.width - bandX - 12);
      context.save();
      context.fillStyle = index % 2 ? "rgba(61, 128, 96, .055)" : "rgba(57, 115, 183, .055)";
      roundedRectPath(context, bandX, cluster.y + 4, bandWidth, cluster.height - 14, 20);
      context.fill();
      context.strokeStyle = cluster.isHome ? "rgba(40, 115, 154, .34)" : "rgba(100, 116, 139, .2)";
      context.lineWidth = cluster.isHome ? 1.8 : 1;
      context.stroke();
      context.fillStyle = "rgba(30, 41, 59, .52)";
      context.font = "700 " + fontSize + "px Georgia, serif";
      context.textBaseline = "top";
      context.fillText(cluster.label, bandX + 18, cluster.y + 12);

      if (cluster.productBox) {
        var box = cluster.productBox;
        context.fillStyle = "rgba(255, 255, 255, .56)";
        context.strokeStyle = "rgba(184, 117, 19, .58)";
        context.lineWidth = 1.5;
        roundedRectPath(context, box.x, box.y, box.width, box.height, 14);
        context.fill();
        context.stroke();
        context.fillStyle = "rgba(120, 75, 12, .76)";
        context.font = "700 " + Math.max(12, 12 / zoom) + "px Inter, sans-serif";
        context.fillText("Escolha de produto · " + box.count + " opções", box.x + 14, box.y + 9);
        context.fillStyle = "#b87513";
        context.beginPath();
        context.arc(box.x, box.y + 24, 5.5, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.arc(box.x + box.width - 12, box.y + box.height, 5.5, 0, Math.PI * 2);
        context.fill();
      }

      if (cluster.conditionBox) {
        var conditionBox = cluster.conditionBox;
        context.setLineDash([7, 5]);
        context.strokeStyle = "rgba(133, 86, 160, .48)";
        context.lineWidth = 1.2;
        roundedRectPath(context, conditionBox.x, conditionBox.y, conditionBox.width, conditionBox.height, 14);
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = "rgba(96, 63, 115, .72)";
        context.font = "700 " + Math.max(12, 12 / zoom) + "px Inter, sans-serif";
        context.fillText("Personalização condicional · " + conditionBox.count + " percursos", conditionBox.x + 14, conditionBox.y + 9);
      }
      context.restore();
    });
  }

  function segmentHitsNode(x1, y1, x2, y2, node) {
    var left = node.x - ROUTE_CLEARANCE;
    var right = node.x + node.width + ROUTE_CLEARANCE;
    var top = node.y - ROUTE_CLEARANCE;
    var bottom = node.y + node.height + ROUTE_CLEARANCE;
    if (x1 === x2) {
      return x1 > left && x1 < right && Math.min(y1, y2) < bottom && Math.max(y1, y2) > top;
    }
    return y1 > top && y1 < bottom && Math.min(x1, x2) < right && Math.max(x1, x2) > left;
  }

  function pathIsClear(points, from, to) {
    var nodes = state.graph.nodes;
    for (var i = 1; i < points.length; i += 1) {
      for (var j = 0; j < nodes.length; j += 1) {
        var node = nodes[j];
        if (node === from || node === to) { continue; }
        if (segmentHitsNode(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], node)) {
          return false;
        }
      }
    }
    return true;
  }

  function laneIndex(lanes, counters, key, bucket) {
    if (lanes[key] === undefined) {
      counters[bucket] = counters[bucket] || 0;
      lanes[key] = counters[bucket];
      counters[bucket] += 1;
    }
    return lanes[key];
  }

  function trunkCandidates(from, lane, gaps) {
    var minX = from.x + from.width - 2;
    var offsets = state.graph.tidyEdges ? LANE_OFFSETS_TIDY : LANE_OFFSETS;
    var offset = offsets[lane % offsets.length];
    var reachable = gaps.filter(function (gap) {
      return gap >= minX;
    }).slice(0, 3);
    return reachable.map(function (gap) {
      return gap + offset;
    }).concat(offset === 0 ? [] : reachable);
  }

  function graphClusterForFamily(family) {
    return state.graph.clusters.filter(function (cluster) { return cluster.slug === family; })[0] || null;
  }

  function productBoxRoute(from, to) {
    var cluster = graphClusterForFamily(from.type === "product" ? from.family : to.family);
    var box = cluster && cluster.productBox;
    var start;
    var target;
    var entryY;
    var exitX;
    var exitY;
    var channelY;
    if (!box) { return null; }

    if (to.type === "product" && from.type !== "product") {
      start = [from.x + from.width, from.y + from.height / 2];
      entryY = box.y + 24;
      return {
        // A caixa representa uma escolha entre produtos. A ligação termina no
        // porto de entrada; não desenhamos uma seta para cada opção interna.
        points: [start, [box.x - 18, start[1]], [box.x - 18, entryY], [box.x, entryY]],
        head: "right"
      };
    }

    if (from.type === "product" && to.type !== "product") {
      exitX = box.x + box.width - 12;
      exitY = box.y + box.height;
      target = [to.x + to.width / 2, to.y];
      channelY = Math.min(to.y - 14, exitY + 22);
      return {
        // Todas as opções partilham o mesmo porto de saída. As arestas lógicas
        // continuam distintas, mas dentro da caixa não há linhas nem setas.
        points: [[exitX, exitY], [exitX, channelY], [target[0], channelY], target],
        head: "down"
      };
    }
    return null;
  }

  function buildGraphRoutes() {
    var trunkLanes = {};
    var trunkCounts = {};
    var channelLanes = {};
    var channelCounts = {};
    var routes = {};
    var gaps = columnGaps();
    var channelLaneCount = state.graph.tidyEdges ? 8 : 4;
    var edges = effectiveGraphEdges();
    var inTotal = {};
    var outTotal = {};
    var inSeen = {};
    var outSeen = {};

    edges.forEach(function (edge) {
      inTotal[edge.to] = (inTotal[edge.to] || 0) + 1;
      outTotal[edge.from] = (outTotal[edge.from] || 0) + 1;
    });

    edges.forEach(function (edge) {
      var from = state.graph.nodeById[edge.from];
      var to = state.graph.nodeById[edge.to];
      if (!from || !to) { return; }

      inSeen[edge.to] = (inSeen[edge.to] || 0) + 1;
      outSeen[edge.from] = (outSeen[edge.from] || 0) + 1;
      var inFraction = inSeen[edge.to] / (inTotal[edge.to] + 1);
      var outFraction = outSeen[edge.from] / (outTotal[edge.from] + 1);

      var exitRight = [from.x + from.width, from.y + from.height * outFraction];
      var exitDown = [from.x + from.width * outFraction, from.y + from.height];
      var enterLeft = [to.x, to.y + to.height * inFraction];
      var enterTop = [to.x + to.width * inFraction, to.y];
      var candidate;
      var boxedRoute = productBoxRoute(from, to);

      if (boxedRoute) {
        routes[edge.id] = boxedRoute;
        return;
      }

      if (to.y >= from.y + from.height && Math.abs((from.x + from.width / 2) - (to.x + to.width / 2)) < 2) {
        candidate = [[from.x + from.width / 2, from.y + from.height], [to.x + to.width / 2, to.y]];
        if (pathIsClear(candidate, from, to)) {
          routes[edge.id] = { points: candidate, head: "down" };
          return;
        }
      }

      if (to.x >= from.x + from.width && Math.abs(exitRight[1] - enterLeft[1]) < 2) {
        candidate = [exitRight, enterLeft];
        if (pathIsClear(candidate, from, to)) {
          routes[edge.id] = { points: candidate, head: "right" };
          return;
        }
      }

      var trunkLane = laneIndex(trunkLanes, trunkCounts, from.id, from.family + ":" + Math.round(from.x + from.width));
      var channelLane = laneIndex(channelLanes, channelCounts, from.id + ">" + to.y, to.y);
      var trunks = trunkCandidates(from, trunkLane, gaps);
      var channels = [];
      for (var c = 0; c < channelLaneCount; c += 1) {
        channels.push(to.y - (8 + ((channelLane + c) % channelLaneCount) * 4));
      }

      for (var t = 0; t < trunks.length; t += 1) {
        var trunkX = trunks[t];
        if (to.x >= from.x + from.width) {
          candidate = [exitRight, [trunkX, exitRight[1]], [trunkX, enterLeft[1]], enterLeft];
          if (pathIsClear(candidate, from, to)) {
            routes[edge.id] = { points: candidate, head: "right" };
            return;
          }
        }
        for (var k = 0; k < channels.length; k += 1) {
          candidate = [exitRight, [trunkX, exitRight[1]], [trunkX, channels[k]], [enterTop[0], channels[k]], enterTop];
          if (pathIsClear(candidate, from, to)) {
            routes[edge.id] = { points: candidate, head: "down" };
            return;
          }
        }
      }

      for (var m = 0; m < channels.length; m += 1) {
        candidate = [exitDown, [exitDown[0], channels[m]], [enterTop[0], channels[m]], enterTop];
        if (pathIsClear(candidate, from, to)) {
          routes[edge.id] = { points: candidate, head: "down" };
          return;
        }
      }
      routes[edge.id] = null;
    });

    return routes;
  }

  function strokeRoutedPath(context, points) {
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    for (var i = 1; i < points.length - 1; i += 1) {
      var previous = points[i - 1];
      var corner = points[i];
      var next = points[i + 1];
      var radius = Math.min(
        6,
        Math.abs(corner[0] - previous[0] || corner[1] - previous[1]) / 2,
        Math.abs(next[0] - corner[0] || next[1] - corner[1]) / 2
      );
      if (radius < 1) {
        context.lineTo(corner[0], corner[1]);
      } else {
        context.arcTo(corner[0], corner[1], next[0], next[1], radius);
      }
    }
    context.lineTo(points[points.length - 1][0], points[points.length - 1][1]);
  }

  function drawArrowHead(context, x, y, head) {
    context.beginPath();
    if (head === "down") {
      context.moveTo(x, y);
      context.lineTo(x - 4.5, y - 8);
      context.lineTo(x + 4.5, y - 8);
    } else {
      context.moveTo(x, y);
      context.lineTo(x - 8, y - 4.5);
      context.lineTo(x - 8, y + 4.5);
    }
    context.closePath();
    context.fill();
  }

  function drawGraphEdges() {
    var canvas = document.querySelector("[data-graph-canvas]");
    var context = canvas.getContext("2d");
    var selected = state.graph.selectedId && state.graph.nodeById[state.graph.selectedId] ? state.graph.selectedId : "";
    context.clearRect(0, 0, canvas.width, canvas.height);
    state.graph.drawnZoom = state.graph.zoom;
    drawGraphBands(context, canvas);

    if (state.graph.tidyEdges && !state.graph.routes) {
      state.graph.routes = buildGraphRoutes();
    }
    var routes = state.graph.tidyEdges ? state.graph.routes : null;

    effectiveGraphEdges().forEach(function (edge) {
      var from = state.graph.nodeById[edge.from];
      var to = state.graph.nodeById[edge.to];
      if (!from || !to) { return; }
      var route = routes ? routes[edge.id] : null;
      if (!route) { route = productBoxRoute(from, to); }
      if (!route && to.y >= from.y + from.height && Math.abs((from.x + from.width / 2) - (to.x + to.width / 2)) < 2) {
        var direct = [[from.x + from.width / 2, from.y + from.height], [to.x + to.width / 2, to.y]];
        if (pathIsClear(direct, from, to)) { route = { points: direct, head: "down" }; }
      }
      var involved = selected && (edge.from === selected || edge.to === selected);
      var endX;
      var endY;
      var head = "right";

      context.save();
      context.strokeStyle = edge.playground ? "#d97706" : (edge.kind === "conditional" ? "#8556a0" : (involved ? "#2563a7" : "#64748b"));
      context.lineWidth = involved ? 2.8 : (edge.playground ? 2.4 : 1.35);
      context.globalAlpha = selected ? (involved ? 1 : .1) : (edge.playground ? 1 : .55);
      context.lineJoin = "round";
      if (edge.playground) { context.setLineDash([8, 5]); }

      if (route) {
        var last = route.points[route.points.length - 1];
        endX = last[0];
        endY = last[1];
        head = route.head;
        strokeRoutedPath(context, route.points);
      } else {
        var startX = from.x + from.width;
        var startY = from.y + from.height / 2;
        endX = to.x;
        endY = to.y + to.height / 2;
        if (endX < startX) {
          startX = from.x + from.width / 2;
          startY = from.y + from.height;
          endX = to.x + to.width / 2;
          endY = to.y;
          head = "down";
        }
        var distance = Math.max(42, Math.abs(endX - startX) * .42);
        context.beginPath();
        context.moveTo(startX, startY);
        if (head === "down") {
          context.bezierCurveTo(startX, startY + distance, endX, endY - distance, endX, endY);
        } else {
          context.bezierCurveTo(startX + distance, startY, endX - distance, endY, endX, endY);
        }
      }

      context.stroke();
      context.setLineDash([]);
      context.fillStyle = context.strokeStyle;
      drawArrowHead(context, endX, endY, head);
      context.restore();
    });
  }

  function wheelPixels(value, mode) {
    if (mode === 1) { return value * 18; }
    if (mode === 2) { return value * 420; }
    return value;
  }

  function zoomGraph(multiplier, clientX, clientY) {
    var viewport = document.querySelector("[data-graph-viewport]");
    var rect = viewport.getBoundingClientRect();
    var pointX = clientX == null ? rect.width / 2 : clientX - rect.left;
    var pointY = clientY == null ? rect.height / 2 : clientY - rect.top;
    var worldX = (pointX - state.graph.panX) / state.graph.zoom;
    var worldY = (pointY - state.graph.panY) / state.graph.zoom;
    var next = Math.max(.055, Math.min(1.8, state.graph.zoom * multiplier));
    state.graph.panX = pointX - worldX * next;
    state.graph.panY = pointY - worldY * next;
    state.graph.zoom = next;
    state.graph.fitted = false;
    applyGraphTransform();
  }

  function fitGraph() {
    var viewport = document.querySelector("[data-graph-viewport]");
    var inspector = document.querySelector("[data-graph-inspector]");
    var width = viewport.clientWidth - (inspector.hidden ? 0 : inspector.offsetWidth);
    var height = viewport.clientHeight;
    if (width <= 0 || !height) { return; }
    var widthZoom = (width - 42) / state.graph.worldWidth;
    var zoom = Math.min(widthZoom, (height - 90) / state.graph.worldHeight, 1);
    state.graph.zoom = Math.max(.055, zoom);
    state.graph.panX = Math.max(18, (width - state.graph.worldWidth * state.graph.zoom) / 2);
    state.graph.panY = Math.max(58, (height - state.graph.worldHeight * state.graph.zoom) / 2);
    state.graph.fitted = true;
    applyGraphTransform();
  }

  function selectGraphNode(nodeId) {
    if (state.graph.playground && state.graph.linkSourceId) {
      if (state.graph.linkSourceId === nodeId) {
        state.graph.linkSourceId = "";
      } else {
        addPlaygroundEdge(state.graph.linkSourceId, nodeId);
        state.graph.linkSourceId = "";
      }
    }
    state.graph.selectedId = nodeId;
    renderGraph();
  }

  function graphEdgeOtherNode(edge, nodeId) {
    return state.graph.nodeById[edge.from === nodeId ? edge.to : edge.from];
  }

  function graphGalleryUrl(node) {
    if (!node || !node.galleryEntryKey) { return ""; }
    var params = new URLSearchParams();
    params.set("embed", "1");
    params.set("entry", node.galleryEntryKey);
    params.set("pending", "1");

    if (node.gallerySection) {
      params.set("section", node.gallerySection);
    } else if (node.gallerySectionPrefix) {
      params.set("section-prefix", node.gallerySectionPrefix);
    } else if (node.gallerySlotName) {
      params.set("slot", node.gallerySlotName);
    } else if (node.type === "step" && node.stepId && node.galleryEntryKey !== "home") {
      params.set("step", node.stepId);
    } else if (node.type === "product" && node.group) {
      var items = node.members.map(function (member) { return member.galleryItemId; }).filter(Boolean);
      if (items.length) { params.set("item", items.join(",")); }
    } else if (node.type === "product" && node.configurable) {
      params.set("step", "artwork_upload");
    } else if ((node.type === "product" || node.type === "page") && node.galleryItemId) {
      params.set("item", node.galleryItemId);
    } else if (node.type === "cart") {
      params.set("summary", "1");
    }

    return "galeria.html?" + params.toString();
  }

  function graphGalleryMarkup(node) {
    var url = graphGalleryUrl(node);
    if (!url) { return ""; }
    return '<section class="inspector-media">'
      + '<div class="inspector-media-actions"><button type="button" class="graph-gallery-expand" data-graph-gallery-expand aria-pressed="false" data-tooltip="Expandir a Galeria para 90% da teia">'
      + '<span aria-hidden="true">⛶</span><span data-graph-gallery-expand-label>Expandir Galeria</span></button></div>'
      + '<iframe class="inspector-gallery-frame" src="' + escapeHtml(url) + '" title="Galeria das imagens relacionadas com ' + escapeHtml(node.label) + '"></iframe>'
      + '</section>';
  }

  function updateGraphGalleryExpandedUi() {
    var stage = document.querySelector("[data-graph-stage]");
    var button = document.querySelector("[data-graph-gallery-expand]");
    stage.classList.toggle("is-gallery-expanded", state.graph.galleryExpanded);
    if (!button) { return; }
    button.setAttribute("aria-pressed", state.graph.galleryExpanded ? "true" : "false");
    button.setAttribute("aria-label", state.graph.galleryExpanded ? "Reduzir Galeria" : "Expandir Galeria para 90% da teia");
    button.dataset.tooltip = state.graph.galleryExpanded ? "Voltar ao painel lateral" : "Expandir a Galeria para 90% da teia";
    button.querySelector("[data-graph-gallery-expand-label]").textContent = state.graph.galleryExpanded ? "Reduzir Galeria" : "Expandir Galeria";
  }

  function renderGraphInspector() {
    var inspector = document.querySelector("[data-graph-inspector]");
    var stage = document.querySelector("[data-graph-stage]");
    var node = state.graph.nodeById[state.graph.selectedId];
    if (!node) {
      state.graph.galleryExpanded = false;
      inspector.innerHTML = "";
      inspector.hidden = true;
      stage.classList.remove("has-inspector");
      updateGraphGalleryExpandedUi();
      return;
    }
    inspector.hidden = false;
    stage.classList.add("has-inspector");
    var edges = effectiveGraphEdges();
    var incoming = edges.filter(function (edge) { return edge.to === node.id; });
    var outgoing = edges.filter(function (edge) { return edge.from === node.id; });

    function edgeList(list, direction) {
      if (!list.length) { return '<p class="inspector-none">Nenhuma ligação.</p>'; }
      return '<div class="inspector-edge-list">' + list.map(function (edge) {
        var other = graphEdgeOtherNode(edge, node.id) || { label: edge.from === node.id ? edge.to : edge.from, type: "node" };
        return '<div class="inspector-edge"><span><strong>' + escapeHtml(other.label) + '</strong><small>' + escapeHtml(direction + " · " + (edge.playground ? "playground" : edge.kind)) + '</small></span>'
          + (state.graph.playground && !edge.grouped ? '<button type="button" data-graph-remove-edge="' + escapeHtml(edge.id) + '" aria-label="Remover ligação">×</button>' : "")
          + '</div>';
      }).join("") + '</div>';
    }

    function memberList() {
      if (!node.group) { return ""; }
      var label = node.groupKind === "checkout" ? "Passos compactados" : "Produtos agrupados";
      return '<details class="inspector-disclosure"><summary>' + label + ' <span>' + node.count + '</span></summary><div class="inspector-disclosure-body"><ul class="inspector-members">'
        + node.members.map(function (member) {
          return '<li><strong>' + escapeHtml(member.label) + '</strong><small>' + escapeHtml(member.subtitle) + '</small></li>';
        }).join("")
        + '</ul></div></details>';
    }

    function edgeSection(label, list, direction) {
      return '<details class="inspector-disclosure"' + (state.graph.playground ? " open" : "") + '><summary>'
        + label + ' <span>' + list.length + '</span></summary><div class="inspector-disclosure-body">'
        + edgeList(list, direction) + '</div></details>';
    }

    inspector.innerHTML = '<header class="inspector-head"><button type="button" class="inspector-close" data-graph-close-inspector aria-label="Fechar">×</button><span class="kind-badge ' + (node.type === "product" ? (node.configurable ? "is-configurable" : "is-real") : "is-active") + '">' + escapeHtml(graphNodeTypeLabel(node)) + '</span><h3>' + escapeHtml(node.label) + '</h3><code>' + escapeHtml(node.id) + '</code></header>'
      + '<div class="inspector-body">'
      + (state.graph.playground && !node.group ? '<button type="button" class="inspector-link-action' + (state.graph.linkSourceId === node.id ? " is-active" : "") + '" data-graph-start-link>' + (state.graph.linkSourceId === node.id ? "Cancelar nova ligação" : "Ligar a outro node") + '</button>' : "")
      + graphVisitorsMarkup(node)
      + graphGalleryMarkup(node)
      + memberList()
      + edgeSection("Entradas", incoming, "de")
      + edgeSection("Saídas", outgoing, "para")
      + '</div>';

    inspector.querySelector("[data-graph-close-inspector]").addEventListener("click", function () {
      state.graph.galleryExpanded = false;
      state.graph.selectedId = "";
      state.graph.linkSourceId = "";
      renderGraph();
    });

    var galleryExpand = inspector.querySelector("[data-graph-gallery-expand]");
    if (galleryExpand) {
      galleryExpand.addEventListener("click", function () {
        state.graph.galleryExpanded = !state.graph.galleryExpanded;
        updateGraphGalleryExpandedUi();
      });
    }
    updateGraphGalleryExpandedUi();

    var start = inspector.querySelector("[data-graph-start-link]");
    if (start) {
      start.addEventListener("click", function () {
        state.graph.linkSourceId = state.graph.linkSourceId === node.id ? "" : node.id;
        document.querySelector("[data-graph-viewport]").classList.toggle("is-linking", !!state.graph.linkSourceId);
        renderGraph();
      });
    }
    inspector.querySelectorAll("[data-graph-remove-edge]").forEach(function (button) {
      button.addEventListener("click", function () { removePlaygroundEdge(button.dataset.graphRemoveEdge); });
    });
  }

  function addPlaygroundEdge(from, to) {
    var fromNode = state.graph.nodeById[from];
    var toNode = state.graph.nodeById[to];
    if ((fromNode && fromNode.group) || (toNode && toNode.group)) {
      return;
    }
    var baseMatch = state.graph.baseEdges.filter(function (edge) { return edge.from === from && edge.to === to; })[0];
    if (baseMatch && state.graphDraft.removedEdges.indexOf(baseMatch.id) !== -1) {
      state.graphDraft.removedEdges = state.graphDraft.removedEdges.filter(function (id) { return id !== baseMatch.id; });
      saveGraphDraft();
      return;
    }
    if (effectiveGraphEdges().some(function (edge) { return edge.from === from && edge.to === to; })) {
      return;
    }
    state.graphDraft.addedEdges.push({
      id: "playground|" + Date.now().toString(36) + "|" + Math.random().toString(36).slice(2, 7),
      from: from,
      to: to,
      kind: "playground"
    });
    saveGraphDraft();
  }

  function removePlaygroundEdge(edgeId) {
    var added = state.graphDraft.addedEdges.some(function (edge) { return edge.id === edgeId; });
    if (added) {
      state.graphDraft.addedEdges = state.graphDraft.addedEdges.filter(function (edge) { return edge.id !== edgeId; });
    } else if (state.graphDraft.removedEdges.indexOf(edgeId) === -1) {
      state.graphDraft.removedEdges.push(edgeId);
    }
    saveGraphDraft();
    renderGraph();
  }

  function renderGraphChangeCount() {
    var count = state.graphDraft.addedEdges.length + state.graphDraft.removedEdges.length;
    document.querySelector("[data-graph-reset]").hidden = count === 0;
  }

  function updateGraphPlaygroundUi() {
    var viewport = document.querySelector("[data-graph-viewport]");
    var toggle = document.querySelector("[data-graph-playground]");
    var collapse = document.querySelector("[data-graph-collapse]");
    toggle.setAttribute("aria-pressed", state.graph.playground ? "true" : "false");
    toggle.classList.toggle("is-active", state.graph.playground);
    toggle.dataset.tooltip = state.graph.playground ? "Sair do playground de ligações" : "Entrar no playground para experimentar ligações";
    collapse.setAttribute("aria-pressed", state.graph.collapsed ? "true" : "false");
    collapse.classList.toggle("is-active", state.graph.collapsed);
    collapse.dataset.tooltip = state.graph.collapsed ? "Expandir produtos e passos finais" : "Compactar produtos e passos finais";
    var tidy = document.querySelector("[data-graph-tidy]");
    tidy.setAttribute("aria-pressed", state.graph.tidyEdges ? "true" : "false");
    tidy.classList.toggle("is-active", state.graph.tidyEdges);
    tidy.dataset.tooltip = state.graph.tidyEdges ? "Voltar a usar ligações curvas" : "Organizar as ligações em ângulo recto";
    document.querySelector("[data-graph-stage]").classList.toggle("is-playground", state.graph.playground);
    viewport.classList.toggle("is-playground", state.graph.playground);
    viewport.classList.toggle("is-linking", state.graph.playground && !!state.graph.linkSourceId);
  }

  function graphIsFullscreen() {
    return state.graph.expanded || document.fullscreenElement === document.querySelector("[data-graph-stage]");
  }

  function updateGraphFullscreenUi() {
    var stage = document.querySelector("[data-graph-stage]");
    var button = document.querySelector("[data-graph-fullscreen]");
    var active = graphIsFullscreen();
    stage.classList.toggle("is-expanded", state.graph.expanded);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.setAttribute("aria-label", active ? "Sair do ecrã inteiro" : "Ecrã inteiro");
    button.dataset.tooltip = active ? "Sair do ecrã inteiro" : "Usar a teia em ecrã inteiro";
    document.body.classList.toggle("has-graph-expanded", state.graph.expanded);
  }

  function useExpandedFallback(expanded) {
    state.graph.expanded = expanded;
    updateGraphFullscreenUi();
    fitGraph();
  }

  function toggleGraphFullscreen() {
    var stage = document.querySelector("[data-graph-stage]");
    if (document.fullscreenElement) {
      document.exitFullscreen();
      return;
    }
    if (state.graph.expanded) {
      useExpandedFallback(false);
      return;
    }
    if (stage.requestFullscreen) {
      var request = stage.requestFullscreen();
      if (request && request.catch) {
        request.catch(function () {
          if (!document.fullscreenElement && !state.graph.expanded) {
            useExpandedFallback(true);
          }
        });
      }
      return;
    }
    useExpandedFallback(true);
  }

  function resetGraphDraft() {
    if (!window.confirm("Limpar todas as alterações do playground?")) { return; }
    state.graphDraft = { addedEdges: [], removedEdges: [] };
    state.graph.linkSourceId = "";
    window.localStorage.removeItem(GRAPH_DRAFT_KEY);
    renderGraph();
    renderGraphChanges();
  }

  function graphChangeNodeDescriptor(nodeId) {
    var node = state.graph.allNodeById[nodeId] || state.graph.nodeById[nodeId];
    return node ? { id: node.id, type: node.type, family: node.family, name: node.label } : { id: nodeId, type: "unknown", family: "", name: nodeId };
  }

  function graphChangesStructure() {
    var allBaseEdges = state.graph.allBaseEdges.length ? state.graph.allBaseEdges : state.graph.baseEdges;
    var removed = state.graphDraft.removedEdges.map(function (id) {
      return allBaseEdges.filter(function (edge) { return edge.id === id; })[0];
    }).filter(Boolean);
    return {
      schema: "miaandpaper-graph-playground-changes-v1",
      language: "pt-PT",
      authoritative: false,
      warning: "Rascunho local do playground. Estas alterações ainda não foram aplicadas aos JSON nem ao site real.",
      summary: {
        added_connections: state.graphDraft.addedEdges.length,
        removed_connections: removed.length
      },
      added_connections: state.graphDraft.addedEdges.map(function (edge) {
        return { from: graphChangeNodeDescriptor(edge.from), to: graphChangeNodeDescriptor(edge.to) };
      }),
      removed_connections: removed.map(function (edge) {
        return { from: graphChangeNodeDescriptor(edge.from), to: graphChangeNodeDescriptor(edge.to), original_kind: edge.kind, original_label: edge.label || null };
      })
    };
  }

  function graphChangesMarkdown(structure) {
    var lines = [
      "# Mia & Paper — alterações propostas à teia de produtos",
      "",
      "> IMPORTANTE: este é um rascunho local do playground. Nada foi aplicado ao site real.",
      "",
      "## Resumo",
      "",
      "- Ligações a acrescentar: " + structure.summary.added_connections,
      "- Ligações a remover: " + structure.summary.removed_connections,
      "",
      "## Ligações a acrescentar",
      ""
    ];
    if (!structure.added_connections.length) {
      lines.push("- Nenhuma.");
    } else {
      structure.added_connections.forEach(function (edge) {
        lines.push("- `" + edge.from.id + "` (**" + edge.from.name + "**) → `" + edge.to.id + "` (**" + edge.to.name + "**)");
      });
    }
    lines.push("", "## Ligações a remover", "");
    if (!structure.removed_connections.length) {
      lines.push("- Nenhuma.");
    } else {
      structure.removed_connections.forEach(function (edge) {
        lines.push("- `" + edge.from.id + "` (**" + edge.from.name + "**) → `" + edge.to.id + "` (**" + edge.to.name + "**)");
        lines.push("  - ligação actual: `" + edge.original_kind + "`" + (edge.original_label ? "; " + edge.original_label : ""));
      });
    }
    lines.push("", "## Instrução para a LLM", "", "Analisa estas diferenças face à estrutura actual do projecto. Antes de implementar, confirma que cada ligação é compatível com as condições e validações dos passos afectados. Preserva os identificadores existentes e não alteres dados de produto sem necessidade.", "");
    return lines.join("\n");
  }

  function renderGraphChanges() {
    if (!state.payload) { return; }
    var structure = graphChangesStructure();
    var format = document.querySelector("[data-graph-llm-format]").value;
    var output = format === "json" ? JSON.stringify(structure, null, 2) + "\n" : graphChangesMarkdown(structure);
    var total = structure.summary.added_connections + structure.summary.removed_connections;
    document.querySelector('[data-graph-stat="added"]').textContent = structure.summary.added_connections;
    document.querySelector('[data-graph-stat="removed"]').textContent = structure.summary.removed_connections;
    document.querySelector('[data-graph-stat="status"]').textContent = total ? "Rascunho local" : "Sem alterações";
    document.querySelector("[data-graph-llm-output]").value = output;
    document.querySelector("[data-graph-llm-size]").textContent = output.length.toLocaleString("pt-PT") + " caracteres · cerca de " + Math.ceil(output.length / 4).toLocaleString("pt-PT") + " tokens";
    document.querySelector("[data-graph-llm-status]").textContent = "";
    renderGraphChangeCount();
  }

  function uniqueStrings(values) {
    return values.filter(function (value, index, all) {
      return value && all.indexOf(value) === index;
    });
  }

  function llmSelectedRecords() {
    var scope = document.querySelector("[data-llm-scope]");
    return scope && scope.value === "filtered" ? filteredRecords() : state.records.slice();
  }

  function llmStepRecord(step, complete) {
    var record = {
      id: text(step.id),
      title: text(step.title || step.label || step.id),
      template: text(step.template),
      visible: step.hidden !== true
    };
    if (step.when) {
      record.condition = step.when;
    }
    if (complete) {
      record.field = text(step.field);
      record.selection = text(step.selection);
      record.item_count = Array.isArray(step.items) ? step.items.length : 0;
    }
    return record;
  }

  function llmProductRecord(record, complete) {
    var product = {
      id: record.sourceId,
      name: record.name,
      type: record.kind === "configurable" ? "configurable" : "real",
      state: recordIsOrphan(record) ? "no_public_path" : record.state,
      price: record.price
    };
    if (complete) {
      product.page = record.page || null;
      product.image = record.image || null;
      product.routes = record.routes;
      product.contexts = record.contexts;
      product.source_files = uniqueStrings(record.sources.map(function (source) { return source.file; }).concat(record.sourceFile || []));
      product.notes = record.notes || null;
      product.local_draft = record.local === true;
      product.edited_in_mockup = record.edited === true;
    }
    return product;
  }

  function llmStructure() {
    var records = llmSelectedRecords();
    var complete = document.querySelector("[data-llm-detail]").value === "complete";
    var groups = {};

    records.forEach(function (record) {
      var familyKey = recordFamilyKey(record);
      if (!groups[familyKey]) {
        groups[familyKey] = [];
      }
      groups[familyKey].push(record);
    });

    var families = Object.keys(groups).sort(function (a, b) {
      return groups[a][0].category.localeCompare(groups[b][0].category, "pt-PT");
    }).map(function (familyKey) {
      var groupRecords = groups[familyKey];
      var source = sourceForFlow(familyKey);
      var steps = source && source.data && Array.isArray(source.data.steps) ? source.data.steps : [];
      var routes = [];
      groupRecords.forEach(function (record) {
        mergeUnique(routes, record.routes, function (route) { return route.join("|"); });
      });
      var family = {
        slug: groupRecords[0].slug,
        context: source ? source.context : groupRecords[0].sourceContext,
        name: groupRecords[0].category,
        product_count: groupRecords.length,
        public_pages: uniqueStrings(groupRecords.map(function (record) { return record.page; })),
        routes_to_products: routes,
        order_steps: steps.map(function (step) { return llmStepRecord(step, complete); }),
        products: groupRecords.map(function (record) { return llmProductRecord(record, complete); })
      };
      if (complete) {
        family.source_context = source ? source.contextLabel : null;
        family.source_files = uniqueStrings(groupRecords.reduce(function (files, record) {
          return files.concat(record.sources.map(function (entry) { return entry.file; }), record.sourceFile || []);
        }, []));
      }
      return family;
    });

    return {
      schema: "miaandpaper-products-context-v1",
      language: "pt-PT",
      purpose: "Contexto copiável para uma LLM sobre os produtos e percursos de encomenda da Mia & Paper.",
      definitions: {
        product_record: "Uma opção concreta ou configurável que pode originar uma linha no carrinho.",
        real: "Design ou peça previamente definida.",
        configurable: "Produto criado ou especificado durante o pedido; não corresponde a uma peça pré-definida.",
        no_public_path: "Existe numa fonte de produtos, mas não tem uma página pública activa que chegue ao carrinho.",
        routes_to_products: "Percursos de navegação antes da escolha do produto; ao final seguem o produto e o carrinho.",
        conditional_step: "Um passo com condition só aparece quando a selecção anterior cumpre essa condição."
      },
      snapshot: {
        scope: document.querySelector("[data-llm-scope]").value === "filtered" ? "current_filters" : "all_products",
        detail: complete ? "complete" : "compact",
        product_count: records.length,
        real_count: records.filter(function (record) { return record.kind === "real"; }).length,
        configurable_count: records.filter(function (record) { return record.kind === "configurable"; }).length,
        no_public_path_count: records.filter(recordIsOrphan).length
      },
      families: families
    };
  }

  function markdownInline(value) {
    return text(value).replace(/[\r\n]+/g, " ").replace(/`/g, "'").trim();
  }

  function llmMarkdown(structure) {
    var lines = [
      "# Mia & Paper — produtos e percursos de encomenda",
      "",
      "> Usa este bloco como contexto factual. Mantém os identificadores e distingue produtos reais de produtos configuráveis.",
      "",
      "## Semântica",
      "",
      "- **Registo de produto:** " + structure.definitions.product_record,
      "- **real:** " + structure.definitions.real,
      "- **configurable:** " + structure.definitions.configurable,
      "- **no_public_path:** " + structure.definitions.no_public_path,
      "- Um passo com `condition` é condicional e não aparece em todos os pedidos.",
      "",
      "## Resumo",
      "",
      "- Âmbito: `" + structure.snapshot.scope + "`",
      "- Detalhe: `" + structure.snapshot.detail + "`",
      "- Produtos: " + structure.snapshot.product_count,
      "- Reais: " + structure.snapshot.real_count,
      "- Configuráveis: " + structure.snapshot.configurable_count,
      "- Sem percurso público: " + structure.snapshot.no_public_path_count
    ];

    structure.families.forEach(function (family) {
      lines.push("", "## " + markdownInline(family.name) + " (`" + markdownInline(family.slug) + "`)", "");
      lines.push("- Registos: " + family.product_count);
      lines.push("- Páginas: " + (family.public_pages.length ? family.public_pages.map(function (page) { return "`" + markdownInline(page) + "`"; }).join(", ") : "nenhuma"));
      lines.push("- Contexto: `" + markdownInline(family.context || "principal") + "`");
      if (family.source_context) {
        lines.push("- Contexto-fonte: " + markdownInline(family.source_context));
      }
      if (family.source_files) {
        lines.push("- Fontes: " + family.source_files.map(function (file) { return "`" + markdownInline(file) + "`"; }).join(", "));
      }

      lines.push("", "### Percursos", "");
      if (!family.routes_to_products.length) {
        lines.push("- Sem percurso público activo.");
      } else {
        family.routes_to_products.forEach(function (route) {
          lines.push("- " + route.map(markdownInline).join(" → ") + " → [produto] → Carrinho");
        });
      }

      lines.push("", "### Passos do pedido", "");
      family.order_steps.forEach(function (step, index) {
        var suffix = step.condition ? " — condição: `" + JSON.stringify(step.condition) + "`" : "";
        var hidden = step.visible ? "" : " — oculto no fluxo actual";
        lines.push((index + 1) + ". `" + markdownInline(step.id) + "` — " + markdownInline(step.title) + " (`" + markdownInline(step.template) + "`)" + suffix + hidden);
      });

      lines.push("", "### Produtos", "");
      family.products.forEach(function (product) {
        lines.push("- `" + markdownInline(product.id) + "` — **" + markdownInline(product.name) + "**");
        lines.push("  - type: `" + product.type + "`; state: `" + product.state + "`; price: " + markdownInline(product.price));
        if (Object.prototype.hasOwnProperty.call(product, "page")) {
          lines.push("  - page: " + (product.page ? "`" + markdownInline(product.page) + "`" : "null") + "; image: " + (product.image ? "`" + markdownInline(product.image) + "`" : "null"));
          lines.push("  - sources: " + (product.source_files.length ? product.source_files.map(function (file) { return "`" + markdownInline(file) + "`"; }).join(", ") : "rascunho local"));
          if (product.notes) {
            lines.push("  - notes: " + markdownInline(product.notes));
          }
        }
      });
    });

    return lines.join("\n") + "\n";
  }

  function renderLlm() {
    if (!state.payload) {
      return;
    }
    var structure = llmStructure();
    var format = document.querySelector("[data-llm-format]").value;
    var output = format === "json" ? JSON.stringify(structure, null, 2) + "\n" : llmMarkdown(structure);
    var estimatedTokens = Math.max(1, Math.ceil(output.length / 4));
    document.querySelector("[data-llm-output]").value = output;
    document.querySelector("[data-llm-size]").textContent = output.length.toLocaleString("pt-PT") + " caracteres · cerca de " + estimatedTokens.toLocaleString("pt-PT") + " tokens";
    document.querySelector("[data-llm-status]").textContent = "";
  }

  function fallbackCopy(value, output) {
    output.focus();
    output.select();
    output.setSelectionRange(0, value.length);
    if (!document.execCommand("copy")) {
      throw new Error("copy_failed");
    }
    return true;
  }

  function copyOutput(value, output, status, successMessage) {
    var copied;
    if (window.navigator.clipboard && window.isSecureContext) {
      copied = window.navigator.clipboard.writeText(value);
    } else {
      copied = new Promise(function (resolve, reject) {
        try {
          resolve(fallbackCopy(value, output));
        } catch (error) {
          reject(error);
        }
      });
    }
    copied.then(function () {
      status.textContent = successMessage;
    }).catch(function () {
      status.textContent = "Não foi possível copiar automaticamente. Selecciona o texto e usa Ctrl+C.";
    });
  }

  function copyLlm() {
    var output = document.querySelector("[data-llm-output]");
    copyOutput(output.value, output, document.querySelector("[data-llm-status]"), "Copiado. Já podes colar o contexto numa conversa.");
  }

  function copyGraphChanges() {
    var output = document.querySelector("[data-graph-llm-output]");
    copyOutput(output.value, output, document.querySelector("[data-graph-llm-status]"), "Alterações copiadas. Já podes colá-las numa conversa.");
  }

  function downloadLlm() {
    var format = document.querySelector("[data-llm-format]").value;
    var value = document.querySelector("[data-llm-output]").value;
    var blob = new Blob([value], { type: format === "json" ? "application/json" : "text/markdown" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "miaandpaper-produtos-contexto." + (format === "json" ? "json" : "md");
    link.click();
    window.setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function downloadGraphChanges() {
    var format = document.querySelector("[data-graph-llm-format]").value;
    var value = document.querySelector("[data-graph-llm-output]").value;
    var blob = new Blob([value], { type: format === "json" ? "application/json" : "text/markdown" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "miaandpaper-teia-alteracoes." + (format === "json" ? "json" : "md");
    link.click();
    window.setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function renderStats() {
    document.querySelector('[data-stat="total"]').textContent = state.records.length;
    document.querySelector('[data-stat="real"]').textContent = state.records.filter(function (record) { return record.kind === "real"; }).length;
    document.querySelector('[data-stat="configurable"]').textContent = state.records.filter(function (record) { return record.kind === "configurable"; }).length;
    document.querySelector('[data-stat="orphan"]').textContent = state.records.filter(recordIsOrphan).length;
  }

  function renderAll() {
    applyDrafts();
    renderStats();
    renderTree();
    renderTable();
    renderSitemap();
    renderLlm();
    renderGraphFamilyOptions();
    if (Object.keys(state.graph.hiddenFamilies).length) {
      var hiddenFamilies = state.graph.hiddenFamilies;
      state.graph.hiddenFamilies = {};
      buildGraphData();
      state.graph.hiddenFamilies = hiddenFamilies;
    }
    renderGraph();
    renderGraphChanges();
    updateDraftControl();
  }

  function setView(view) {
    state.activeView = view;
    workspaceNode.classList.toggle("is-wide", view === "graph");
    document.querySelectorAll("[data-view]").forEach(function (button) {
      button.setAttribute("aria-selected", button.dataset.view === view ? "true" : "false");
    });
    document.querySelectorAll("[data-view-panel]").forEach(function (panel) {
      panel.hidden = panel.dataset.viewPanel !== view;
    });
    if (view === "llm") {
      renderLlm();
    }
    if (view === "graph") {
      renderGraph();
      if (!state.graph.fitted) {
        fitGraph();
      }
    }
    if (view === "graph-llm") {
      renderGraphChanges();
    }
  }

  function findRecord(key) {
    return state.records.filter(function (record) { return record.key === key; })[0] || null;
  }

  function editorPreview(record) {
    var thumb = document.createElement("div");
    thumb.className = "product-thumb";
    productThumb(thumb, record);
    var copy = document.createElement("div");
    copy.innerHTML = '<strong>' + escapeHtml(record.name) + '</strong><span>' + escapeHtml(record.category) + ' · ' + escapeHtml(record.price) + '</span>';
    var node = document.querySelector("[data-editor-preview]");
    node.innerHTML = "";
    node.appendChild(thumb);
    node.appendChild(copy);
  }

  function openEditor(key) {
    var record = findRecord(key);
    if (!record) {
      return;
    }
    state.currentKey = key;
    document.querySelector("[data-editor-title]").textContent = record.local ? "Editar produto local" : "Editar produto";
    editorForm.elements.name.value = record.name;
    editorForm.elements.kind.value = record.kind;
    editorForm.elements.state.value = record.state === "orphan" ? "active" : record.state;
    editorForm.elements.category.value = record.category;
    editorForm.elements.sourceId.value = record.sourceId;
    editorForm.elements.page.value = record.page;
    editorForm.elements.notes.value = record.notes || "";
    editorPreview(record);

    var source = document.querySelector("[data-editor-source]");
    source.innerHTML = record.local
      ? '<strong>Origem:</strong> registo criado neste browser.'
      : '<strong>Origem actual:</strong> <code>' + escapeHtml(record.sourceFile) + '</code>'
        + '<br><strong>Contexto:</strong> <code>' + escapeHtml(record.sourceContext) + '</code>'
        + '<br><strong>Local:</strong> passo <code>designs</code>, item <code>' + escapeHtml(record.sourceId) + '</code>'
        + (record.page ? '<br><a href="' + escapeHtml(record.page) + '" target="_blank" rel="noopener">Abrir página de encomenda ↗</a>' : '<br>Este ficheiro não tem uma página pública activa.');
    document.querySelector("[data-delete-local]").hidden = !record.local;
    document.querySelector("[data-reset-record]").hidden = record.local;
    editor.showModal();
  }

  function openNewEditor() {
    var key = "local_" + Date.now().toString(36);
    var record = {
      key: key,
      name: "Novo produto",
      kind: "real",
      state: "draft",
      category: "Por definir",
      slug: "local",
      sourceId: key,
      page: "",
      notes: "",
      price: "Por definir",
      routes: [["Registo local"]],
      sources: [],
      contexts: [],
      sourceFile: "Rascunho do browser",
      sourceContext: "local",
      image: "",
      local: true,
      edited: true
    };
    state.pendingNew = record;
    state.records.push(record);
    openEditor(key);
  }

  function saveEditor(event) {
    event.preventDefault();
    var record = findRecord(state.currentKey);
    if (!record) {
      return;
    }
    var values = {
      name: text(editorForm.elements.name.value).trim(),
      kind: editorForm.elements.kind.value,
      state: editorForm.elements.state.value,
      category: text(editorForm.elements.category.value).trim(),
      sourceId: text(editorForm.elements.sourceId.value).trim(),
      page: text(editorForm.elements.page.value).trim(),
      notes: text(editorForm.elements.notes.value).trim()
    };
    if (!values.name) {
      editorForm.elements.name.focus();
      return;
    }
    if (record.local) {
      var index = state.draft.custom.findIndex(function (entry) { return entry.key === record.key; });
      if (index !== -1) {
        state.draft.custom[index] = Object.assign({}, state.draft.custom[index], values);
      } else {
        state.draft.custom.push(Object.assign({}, record, values));
      }
    } else {
      state.draft.overrides[record.key] = values;
    }
    saveDraft();
    state.pendingNew = null;
    renderAll();
    editor.close();
  }

  function closeEditor() {
    if (state.pendingNew) {
      state.pendingNew = null;
      applyDrafts();
    }
    editor.close();
  }

  function resetRecord() {
    if (state.currentKey && state.draft.overrides[state.currentKey]) {
      delete state.draft.overrides[state.currentKey];
      saveDraft();
      renderAll();
      editor.close();
    }
  }

  function deleteLocalRecord() {
    var record = findRecord(state.currentKey);
    if (!record || !record.local) {
      return;
    }
    state.draft.custom = state.draft.custom.filter(function (entry) { return entry.key !== record.key; });
    saveDraft();
    renderAll();
    editor.close();
  }

  function resetFilters() {
    state.search = "";
    state.kindFilter = "all";
    state.stateFilter = "all";
    state.categoryFilter = "all";
    document.querySelector("[data-search]").value = "";
    document.querySelector("[data-kind-filter]").value = "all";
    document.querySelector("[data-state-filter]").value = "all";
    renderTree();
    renderTable();
  }

  function exportDraft() {
    var payload = {
      exportedAt: new Date().toISOString(),
      note: "Rascunho do mockup produtos.html; não foi aplicado aos JSON do site.",
      overrides: state.draft.overrides,
      custom: state.draft.custom
    };
    var blob = new Blob([JSON.stringify(payload, null, 2) + "\n"], { type: "application/json" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "miaandpaper-produtos-rascunho.json";
    link.click();
    window.setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function bindUi() {
    document.querySelector("[data-search]").addEventListener("input", function (event) {
      state.search = event.target.value;
      renderTable();
    });
    document.querySelector("[data-kind-filter]").addEventListener("change", function (event) {
      state.kindFilter = event.target.value;
      renderTable();
    });
    document.querySelector("[data-state-filter]").addEventListener("change", function (event) {
      state.stateFilter = event.target.value;
      renderTable();
    });
    document.querySelector("[data-reset-filters]").addEventListener("click", resetFilters);
    document.querySelector("[data-add-product]").addEventListener("click", openNewEditor);
    document.querySelector("[data-export]").addEventListener("click", exportDraft);
    document.querySelector("[data-llm-copy]").addEventListener("click", copyLlm);
    document.querySelector("[data-llm-download]").addEventListener("click", downloadLlm);
    document.querySelector("[data-graph-llm-copy]").addEventListener("click", copyGraphChanges);
    document.querySelector("[data-graph-llm-download]").addEventListener("click", downloadGraphChanges);
    document.querySelector("[data-graph-llm-format]").addEventListener("change", renderGraphChanges);
    document.querySelectorAll("[data-llm-format], [data-llm-detail], [data-llm-scope]").forEach(function (select) {
      select.addEventListener("change", renderLlm);
    });
    document.querySelector("[data-graph-zoom-out]").addEventListener("click", function () { zoomGraph(1 / 1.18); });
    document.querySelector("[data-graph-zoom-in]").addEventListener("click", function () { zoomGraph(1.18); });
    document.querySelector("[data-graph-zoom-label]").addEventListener("click", function () {
      zoomGraph(1 / state.graph.zoom);
    });
    document.querySelector("[data-graph-fit]").addEventListener("click", fitGraph);
    document.querySelector("[data-graph-reset-layout]").addEventListener("click", resetGraphPositions);
    document.querySelector("[data-graph-tidy]").addEventListener("click", function () {
      state.graph.tidyEdges = !state.graph.tidyEdges;
      state.graph.routes = null;
      renderGraph();
      if (state.graph.fitted) {
        fitGraph();
      }
    });
    document.querySelector("[data-graph-collapse]").addEventListener("click", function () {
      state.graph.collapsed = !state.graph.collapsed;
      state.graph.selectedId = "";
      state.graph.linkSourceId = "";
      renderGraph();
      if (state.graph.fitted) {
        fitGraph();
      }
    });
    document.querySelector("[data-graph-playground]").addEventListener("click", function () {
      state.graph.playground = !state.graph.playground;
      if (!state.graph.playground) {
        state.graph.linkSourceId = "";
      }
      renderGraph();
    });
    document.querySelector("[data-graph-reset]").addEventListener("click", resetGraphDraft);
    document.querySelector("[data-graph-fullscreen]").addEventListener("click", toggleGraphFullscreen);
    document.querySelector("[data-graph-legend-toggle]").addEventListener("click", function () {
      var legend = document.querySelector("[data-graph-legend]");
      var open = legend.hidden;
      legend.hidden = !open;
      this.setAttribute("aria-expanded", open ? "true" : "false");
      this.classList.toggle("is-active", open);
      this.dataset.tooltip = open ? "Esconder a legenda" : "Mostrar a legenda";
    });
    document.addEventListener("fullscreenchange", function () {
      updateGraphFullscreenUi();
      fitGraph();
    });
    window.addEventListener("resize", function () {
      if (state.activeView === "graph" && state.graph.fitted) {
        fitGraph();
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && state.graph.galleryExpanded && !editor.open) {
        event.preventDefault();
        state.graph.galleryExpanded = false;
        updateGraphGalleryExpandedUi();
        return;
      }
      if (event.key === "Escape" && state.graph.expanded && !editor.open) {
        event.preventDefault();
        useExpandedFallback(false);
      }
    });

    var graphViewport = document.querySelector("[data-graph-viewport]");
    graphViewport.addEventListener("wheel", function (event) {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        zoomGraph(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX, event.clientY);
        return;
      }
      var stepX = wheelPixels(event.deltaX, event.deltaMode);
      var stepY = wheelPixels(event.deltaY, event.deltaMode);
      if (event.shiftKey) {
        state.graph.panX -= stepX || stepY;
      } else {
        state.graph.panX -= stepX;
        state.graph.panY -= stepY;
      }
      state.graph.fitted = false;
      applyGraphTransform();
    }, { passive: false });
    graphViewport.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 || event.target.closest("[data-graph-node]")) { return; }
      state.graph.panMoved = false;
      state.graph.panPointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        panX: state.graph.panX,
        panY: state.graph.panY
      };
      graphViewport.setPointerCapture(event.pointerId);
      graphViewport.classList.add("is-panning");
    });
    graphViewport.addEventListener("pointermove", function (event) {
      var pointer = state.graph.panPointer;
      if (!pointer || pointer.id !== event.pointerId) { return; }
      var deltaX = event.clientX - pointer.x;
      var deltaY = event.clientY - pointer.y;
      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        state.graph.panMoved = true;
      }
      state.graph.panX = pointer.panX + deltaX;
      state.graph.panY = pointer.panY + deltaY;
      state.graph.fitted = false;
      applyGraphTransform();
    });
    graphViewport.addEventListener("click", function (event) {
      if (state.graph.panMoved || event.target.closest("[data-graph-node]")) { return; }
      if (!state.graph.selectedId && !state.graph.linkSourceId) { return; }
      state.graph.selectedId = "";
      state.graph.linkSourceId = "";
      renderGraph();
    });
    graphViewport.addEventListener("dblclick", function (event) {
      if (event.target.closest("[data-graph-node]")) { return; }
      fitGraph();
    });
    function stopGraphPan(event) {
      var pointer = state.graph.panPointer;
      if (!pointer || pointer.id !== event.pointerId) { return; }
      if (graphViewport.hasPointerCapture(event.pointerId)) {
        graphViewport.releasePointerCapture(event.pointerId);
      }
      state.graph.panPointer = null;
      graphViewport.classList.remove("is-panning");
    }
    graphViewport.addEventListener("pointerup", stopGraphPan);
    graphViewport.addEventListener("pointercancel", stopGraphPan);
    graphViewport.addEventListener("keydown", function (event) {
      if (event.target !== graphViewport) { return; }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomGraph(1.18);
      } else if (event.key === "-") {
        event.preventDefault();
        zoomGraph(1 / 1.18);
      } else if (event.key === "0") {
        event.preventDefault();
        fitGraph();
      }
    });
    document.querySelector("[data-clear-draft]").addEventListener("click", function () {
      if (window.confirm("Limpar todas as alterações guardadas neste browser?")) {
        state.draft = { overrides: {}, custom: [] };
        window.localStorage.removeItem(DRAFT_KEY);
        renderAll();
      }
    });
    document.querySelectorAll("[data-view]").forEach(function (button) {
      button.addEventListener("click", function () { setView(button.dataset.view); });
    });
    document.querySelector("[data-editor-close]").addEventListener("click", closeEditor);
    document.querySelector("[data-reset-record]").addEventListener("click", resetRecord);
    document.querySelector("[data-delete-local]").addEventListener("click", deleteLocalRecord);
    editorForm.addEventListener("submit", saveEditor);
    editor.addEventListener("click", function (event) {
      if (event.target === editor) {
        closeEditor();
      }
    });
    editor.addEventListener("cancel", function (event) {
      event.preventDefault();
      closeEditor();
    });
  }

  function load() {
    readDraft();
    readGraphDraft();
    readGraphPositions();
    if (state.visitorMode) { document.body.classList.add("is-visitor-graph"); }
    bindUi();
    fetch("produtos-api.php?action=data", { cache: "no-store", credentials: "same-origin" })
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok || !data.ok) {
            throw new Error(data && data.message ? data.message : "Não foi possível carregar os produtos.");
          }
          return data;
        });
      })
      .then(function (payload) {
        state.payload = payload;
        state.baseRecords = deriveRecords(payload);
        renderAll();
        statusNode.hidden = true;
        statsNode.hidden = false;
        workspaceNode.hidden = false;
        switcherNode.hidden = false;
        setView(state.activeView);
        if (state.visitorMode && window.parent !== window) {
          window.parent.postMessage({ type: "mia-visitor-graph-ready" }, window.location.origin);
        }
      })
      .catch(function (error) {
        statusNode.classList.add("is-error");
        statusNode.innerHTML = '<strong>Não foi possível abrir a base de produtos.</strong><br>'
          + escapeHtml(error.message)
          + (window.location.protocol === "file:" ? '<br>Abre a página através do servidor local, como a galeria.' : "");
      });
  }

  window.addEventListener("message", function (event) {
    var data = event.data || {};
    if (event.origin !== window.location.origin) { return; }

    if (data.type === "mia-gallery-done" && state.payload) {
      applyGalleryDoneChange(data);
      return;
    }

    if (data.type === "mia-visitor-graph-data" && state.visitorMode) {
      state.visitorPayload = data.payload && typeof data.payload === "object"
        ? data.payload
        : { visitors: [], events: [], meta: {} };
      if (state.payload) {
        renderGraph();
        if (state.graph.fitted) { fitGraph(); }
      }
    }
  });

  if (galleryDoneChannel) {
    galleryDoneChannel.addEventListener("message", function (event) {
      if (event.data && event.data.type === "mia-gallery-done") { applyGalleryDoneChange(event.data); }
    });
  }
  window.addEventListener("storage", function (event) {
    var data;
    if (event.key !== GALLERY_DONE_SYNC_KEY || !event.newValue) { return; }
    try { data = JSON.parse(event.newValue); } catch (error) { return; }
    if (data && data.type === "mia-gallery-done") { applyGalleryDoneChange(data); }
  });
  window.addEventListener("focus", refreshGalleryDone);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) { refreshGalleryDone(); }
  });

  load();
}());
