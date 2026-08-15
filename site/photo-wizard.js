(function () {
  "use strict";

  var root = document.getElementById("photo-wizard");
  var csrf = (document.querySelector('meta[name="photo-wizard-csrf"]') || {}).content || "";
  var state = {
    products: [], currentIndex: 0, candidates: [], candidatePage: 1,
    candidateTotal: 0, hasMore: false, showingAll: false, search: "",
    selectedToken: "", requestNumber: 0, busy: false, searchTimer: 0,
    decisions: {}, lastKey: "", pendingLocations: 0
  };
  var previewFrame = null;
  var previewPending = null;
  var summarySelections = {
    frame_size: { designs: "Foto e Frase" },
    phrase: { designs: "Foto e Frase", quadro_text: "Com frase" },
    baby_details: { designs: "Quadro para bebé", baby_name: "Exemplo" },
    baby_custom_animal: { designs: "Quadro para bebé", baby_animal: "Outro animal", baby_custom_animal: "Girafa" },
    super_description: { designs: "Super Personalizado", quadro_description: "Exemplo de ideia" },
    photo_help: { designs: "Foto e Frase", photo_help: true },
    audio: { designs: "Foto e Frase", quadro_audio_uploads: [{ token: "exemplo" }] }
  };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function api(action, payload) {
    return fetch("photo-wizard.php", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({}, payload || {}, { action: action, csrf: csrf }))
    }).then(responseJson);
  }

  function responseJson(response) {
    return response.text().then(function (text) {
      var data;
      try { data = JSON.parse(text); } catch (error) { throw new Error("O servidor devolveu uma resposta inválida."); }
      if (!response.ok || data.ok === false) { throw new Error(data.message || "Não foi possível concluir o pedido."); }
      return data;
    });
  }

  function showError(error) {
    root.innerHTML = '<p class="wizard-error" role="alert">' + esc(error.message || error) + "</p>";
  }

  function decisionKey(slot) { return "gallery::" + slot.doneKey; }

  function slotValue(entry, slot) {
    var value = window.MiaGaleriaSlots.resolveTrail(entry.product, slot.trail);
    if (typeof value === "string" && value) { return value; }
    if (slot.gaveta) { return slot.gaveta.siblings[slot.gaveta.index] || ""; }
    return "";
  }

  function buildProducts(gallery) {
    var done = {};
    var seen = {};
    var products = [];
    state.pendingLocations = 0;
    (gallery.done || []).forEach(function (key) { done[key] = true; });
    (gallery.products || []).forEach(function (entry) {
      window.MiaGaleriaSlots.collect(entry).forEach(function (slot) {
        var key = decisionKey(slot);
        var currentImage;
        var isDone = done[slot.doneKey] || (slot.doneAliases || []).some(function (alias) { return done[alias]; });
        if (isDone) { return; }
        state.pendingLocations += 1;
        if (seen[key]) { return; }
        seen[key] = true;
        currentImage = slotValue(entry, slot);
        products.push({
          key: key,
          familyLabel: (entry.product && entry.product.name) || entry.contextLabel || "Imagem do site",
          variantLabel: slot.itemLabel || slot.section || slot.detail || "Imagem",
          detail: slot.detail || slot.slotName || "imagem",
          currentImage: currentImage,
          page: (gallery.pages || {})[slot.slug] || "",
          entry: entry,
          slot: slot,
          target: {
            labels: [
              entry.product && entry.product.name,
              entry.product && entry.product.intro && entry.product.intro.eyebrow,
              entry.product && entry.product.intro && entry.product.intro.title,
              slot.section, slot.itemLabel, slot.detail, slot.slotName,
              currentImage ? currentImage.split(/[\\/]/).pop() : ""
            ].filter(Boolean),
            currentImage: currentImage
          }
        });
      });
    });
    products.forEach(function (product, index) { product.galleryOrder = index; });
    products.sort(function (a, b) {
      var rankA = familyRank(a.familyLabel);
      var rankB = familyRank(b.familyLabel);
      return rankA === rankB ? a.galleryOrder - b.galleryOrder : rankA - rankB;
    });
    return products;
  }

  function familyRank(label) {
    var value = String(label || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    var order = [
      /cracha/, /^imanes?$/, /iman.*recort/, /mini.*caderno/, /bloquinho/,
      /bloco.*a6/, /marcador/, /sticker/, /caderno.*anual/, /agenda/, /moldura|quadro/
    ];
    for (var index = 0; index < order.length; index += 1) {
      if (order[index].test(value)) { return index; }
    }
    return order.length;
  }

  function applyReview(data) {
    state.decisions = data.decisions || {};
    state.lastKey = data.lastKey || state.lastKey;
    state.products.forEach(function (product) {
      var decision = state.decisions[product.key] || {};
      product.status = ["selected", "deferred", "not_found"].indexOf(decision.status) !== -1 ? decision.status : "pending";
      product.statusLabel = product.status === "selected" ? "✓ escolhido"
        : product.status === "deferred" ? "↷ deixado para depois" : "○ por escolher";
      product.wasNotFound = product.status === "not_found";
      product.selectedToken = decision.selectedToken || "";
    });
  }

  function completedCount() {
    return state.products.filter(function (product) { return product.status === "selected"; }).length;
  }

  function currentProduct() { return state.products[state.currentIndex] || null; }
  function imageUrl(token) { return "photo-wizard.php/image/" + encodeURIComponent(token); }

  function currentImageMarkup(product) {
    if (!product.currentImage) { return '<div class="current-image"><span>sem imagem</span></div>'; }
    return '<div class="current-image"><img src="' + esc(product.currentImage) + '" alt="Imagem actual"></div>';
  }

  function previewMarkup(product) {
    var slot = product.slot;
    var pageLink = product.page
      ? '<a class="wizard-preview-link" href="' + esc(product.page) + '" target="_blank" rel="noopener">Abrir ' + esc(product.page) + ' ↗</a>'
      : '<span class="wizard-preview-note">Nenhuma página pública usa este produto.</span>';
    return '<section class="wizard-site-preview" aria-labelledby="site-preview-title">'
      + '<h2 class="wizard-section-title" id="site-preview-title">Onde aparece no site</h2>'
      + '<div class="wizard-preview-crop is-waiting" data-preview-crop><span>A desenhar a página…</span></div>'
      + '<div class="wizard-preview-info"><strong>' + esc(slot.itemLabel || slot.detail) + '</strong>'
      + '<span>' + esc(slot.detail) + '</span><span>' + esc(slot.section || product.familyLabel) + '</span>' + pageLink
      + '<details><summary>Detalhes</summary><div><strong>Código:</strong> ' + esc(slot.shortId || slot.id)
      + '<br><strong>Local:</strong> ' + esc(slot.id) + (product.currentImage ? '<br><strong>Imagem actual:</strong> ' + esc(product.currentImage) : '')
      + '</div></details></div></section>';
  }

  function wizardMarkup(product) {
    var position = state.currentIndex + 1;
    return '<header class="wizard-top">'
      + '<p class="wizard-progress-copy">' + completedCount() + " de " + state.products.length + " decisões concluídas"
      + (state.pendingLocations !== state.products.length ? " · " + state.pendingLocations + " locais da Galeria" : "") + "</p>"
      + '<p class="wizard-position">Imagem ' + position + " de " + state.products.length + "</p>"
      + '<nav class="wizard-navigation" aria-label="Navegação entre imagens">'
      + '<button type="button" data-previous' + (position === 1 ? " disabled" : "") + '>← Anterior</button>'
      + '<button type="button" data-next' + (position === state.products.length ? " disabled" : "") + '>Seguinte →</button></nav></header>'
      + '<section class="wizard-heading"><h1>' + esc(product.familyLabel) + "</h1><p>" + esc(product.variantLabel) + "</p>"
      + '<span class="wizard-status">' + esc(product.statusLabel) + "</span>"
      + '<p class="wizard-candidates-summary">' + esc(product.detail) + "</p></section>"
      + '<section class="wizard-current"><h2 class="wizard-section-title">Imagem actual</h2>' + currentImageMarkup(product) + "</section>"
      + '<section class="wizard-candidates"><div class="wizard-candidates-head"><h2 class="wizard-section-title">Melhores candidatas</h2>'
      + '<p class="wizard-candidates-summary" id="candidate-summary">A procurar…</p></div>'
      + '<div class="candidate-grid" id="candidate-grid" aria-live="polite"></div>'
      + '<div class="wizard-empty" id="candidate-empty"><strong>A procurar as melhores candidatas…</strong></div>'
      + '<button type="button" class="wizard-button wizard-load-more" id="candidate-more" hidden>mostrar mais candidatas</button>'
      + '<div class="wizard-search-tools"><button type="button" class="wizard-button" id="search-all">pesquisar todas as imagens</button>'
      + '<div class="wizard-search" id="search-wrap" hidden><label for="candidate-search">Pesquisa opcional</label>'
      + '<input type="search" id="candidate-search" placeholder="produto, tema, cor ou texto visível" autocomplete="off"></div></div>'
      + '<div class="wizard-secondary-actions"><button type="button" class="wizard-button is-quiet" data-not-found>Não encontrei a imagem</button>'
      + '<button type="button" class="wizard-button is-quiet" data-defer>Deixar para depois</button></div></section>'
      + previewMarkup(product)
      + '<div class="wizard-confirm-wrap" id="confirm-wrap" hidden><button type="button" class="wizard-confirm" id="confirm-image">✓ USAR ESTA IMAGEM</button></div>';
  }

  function previewRequest(product) {
    var slot = product.slot;
    var entry = product.entry;
    return {
      type: "mia-preview-render",
      key: slot.key,
      kind: slot.kind || entry.kind || "product",
      context: entry.context || "principal",
      product: entry.product,
      stepIndex: slot.previewStepIndex == null ? slot.stepIndex : slot.previewStepIndex,
      itemId: slot.itemId || "",
      slotName: slot.slotName || "",
      expectedEditKey: slot.expectedEditKey || "",
      slideIndex: slot.slideIndex == null ? null : slot.slideIndex,
      image: product.currentImage,
      selections: Object.assign({}, slot.summaryKey ? (summarySelections[slot.summaryKey] || {}) : {}, slot.previewSelections || {}),
      highlight: true
    };
  }

  function sendPreview() {
    if (!previewFrame || !previewFrame.contentWindow || !currentProduct()) { return; }
    previewPending = previewRequest(currentProduct());
    if (previewFrame.dataset.ready === "yes") {
      previewFrame.contentWindow.postMessage(previewPending, window.location.origin);
      previewPending = null;
    }
  }

  function mountPreview() {
    var crop = root.querySelector("[data-preview-crop]");
    var product = currentProduct();
    var context;
    if (!crop || !product) { return; }
    context = product.entry.context === "congresso-2026" ? "congresso-2026" : "principal";
    previewFrame = document.createElement("iframe");
    previewFrame.src = "galeria-preview.html?v=2026072901&context=" + encodeURIComponent(context);
    previewFrame.title = "Pré-visualização de " + product.variantLabel;
    previewFrame.setAttribute("scrolling", "no");
    previewFrame.style.width = "390px";
    previewFrame.style.height = "1600px";
    previewFrame.style.visibility = "hidden";
    crop.innerHTML = "";
    crop.appendChild(previewFrame);
    sendPreview();
  }

  function reasonMarkup(reasons) {
    if (!reasons || !reasons.length) { return "<span>Sem classificação compatível</span>"; }
    return reasons.slice(0, 2).map(function (reason) {
      return "<span>" + esc((Number(reason.confidence) > 0 ? Math.round(reason.confidence) + "% " : "") + reason.label) + "</span>";
    }).join("");
  }

  function candidateMarkup(candidate) {
    var selected = candidate.token === state.selectedToken;
    return '<article class="candidate-card' + (selected ? " is-selected" : "") + '" data-candidate="' + esc(candidate.token) + '">'
      + '<button type="button" class="candidate-photo" data-select="' + esc(candidate.token) + '" aria-pressed="' + selected + '">'
      + '<img src="' + esc(imageUrl(candidate.token)) + '" alt="Fotografia candidata" loading="lazy"></button>'
      + '<div class="candidate-copy"><p class="candidate-reasons">' + reasonMarkup(candidate.reasons) + "</p>"
      + '<div class="candidate-tools"><button type="button" data-toggle-description="' + esc(candidate.token) + '">Ver descrição</button>'
      + '<button type="button" data-toggle-details="' + esc(candidate.token) + '">Detalhes</button></div>'
      + '<p class="candidate-description" data-description="' + esc(candidate.token) + '" hidden>' + esc(candidate.description || "Sem descrição.") + "</p>"
      + '<div class="candidate-details" data-details="' + esc(candidate.token) + '" hidden><strong>Ficheiro:</strong> ' + esc(candidate.fileName)
      + "<br><strong>Caminho:</strong> " + esc(candidate.path) + "<br><strong>Score:</strong> " + esc(candidate.score) + "</div></div></article>";
  }

  function renderCandidateList() {
    var grid = document.getElementById("candidate-grid");
    var empty = document.getElementById("candidate-empty");
    var more = document.getElementById("candidate-more");
    var summary = document.getElementById("candidate-summary");
    var confirm = document.getElementById("confirm-wrap");
    if (!grid) { return; }
    grid.innerHTML = state.candidates.map(candidateMarkup).join("");
    grid.hidden = !state.candidates.length;
    empty.hidden = !!state.candidates.length;
    if (!state.candidates.length) {
      empty.innerHTML = state.showingAll ? "<strong>Nenhuma imagem corresponde à pesquisa.</strong>" : "<strong>Não há candidatas razoáveis.</strong>Podes pesquisar todas as imagens.";
    }
    more.hidden = !state.hasMore;
    more.textContent = state.showingAll ? "mostrar mais imagens" : "mostrar mais candidatas";
    summary.textContent = state.candidateTotal ? state.candidates.length + " de " + state.candidateTotal : "nenhuma candidata classificada";
    confirm.hidden = !state.selectedToken;
  }

  function renderWizard() {
    var product = currentProduct();
    if (!product) { root.innerHTML = '<p class="wizard-loading">Não há imagens por concluir na Galeria.</p>'; return; }
    state.candidates = []; state.candidatePage = 1; state.candidateTotal = 0; state.hasMore = false;
    state.showingAll = false; state.search = ""; state.selectedToken = product.selectedToken || "";
    root.innerHTML = wizardMarkup(product);
    bindWizard(); mountPreview(); loadCandidates(true); window.scrollTo({ top: 0, behavior: "auto" });
  }

  function loadCandidates(reset) {
    var product = currentProduct();
    var requestNumber = ++state.requestNumber;
    if (reset) { state.candidates = []; state.candidatePage = 1; renderCandidateList(); }
    api("candidates", { key: product.key, target: product.target, page: state.candidatePage, all: state.showingAll, search: state.search })
      .then(function (data) {
        if (requestNumber !== state.requestNumber) { return; }
        state.candidates = reset ? data.candidates : state.candidates.concat(data.candidates);
        state.candidateTotal = data.total; state.hasMore = data.hasMore; renderCandidateList();
      }).catch(showError);
  }

  function nextUnselectedIndex() {
    var length = state.products.length;
    for (var offset = 1; offset <= length; offset += 1) {
      var index = (state.currentIndex + offset) % length;
      if (state.products[index].status !== "selected") { return index; }
    }
    return state.currentIndex;
  }

  function saveDecision(status) {
    var product = currentProduct();
    var followingIndex = nextUnselectedIndex();
    var following = state.products[followingIndex];
    if (state.busy || (status === "selected" && !state.selectedToken)) { return; }
    state.busy = true; root.setAttribute("aria-busy", "true");
    api("save", {
      key: product.key, status: status, imageToken: status === "selected" ? state.selectedToken : "",
      nextKey: following ? following.key : product.key,
      summary: { familyLabel: product.familyLabel, variantLabel: product.variantLabel, detail: product.detail }
    }).then(function (data) {
      applyReview(data); state.currentIndex = followingIndex; state.busy = false; root.removeAttribute("aria-busy");
      if (completedCount() === state.products.length) { renderReview(); } else { renderWizard(); }
    }).catch(function (error) { state.busy = false; root.removeAttribute("aria-busy"); showError(error); });
  }

  function moveTo(index) {
    if (state.busy || index < 0 || index >= state.products.length) { return; }
    state.currentIndex = index;
    api("position", { key: currentProduct().key }).then(renderWizard).catch(renderWizard);
  }

  function bindWizard() {
    root.querySelector("[data-previous]").addEventListener("click", function () { moveTo(state.currentIndex - 1); });
    root.querySelector("[data-next]").addEventListener("click", function () { moveTo(state.currentIndex + 1); });
    root.querySelector("[data-not-found]").addEventListener("click", function () { saveDecision("not_found"); });
    root.querySelector("[data-defer]").addEventListener("click", function () { saveDecision("deferred"); });
    document.getElementById("confirm-image").addEventListener("click", function () { saveDecision("selected"); });
    document.getElementById("candidate-more").addEventListener("click", function () { state.candidatePage += 1; loadCandidates(false); });
    document.getElementById("search-all").addEventListener("click", function (event) {
      state.showingAll = !state.showingAll;
      event.currentTarget.textContent = state.showingAll ? "voltar às melhores candidatas" : "pesquisar todas as imagens";
      document.getElementById("search-wrap").hidden = !state.showingAll;
      if (!state.showingAll) { state.search = ""; document.getElementById("candidate-search").value = ""; }
      loadCandidates(true);
    });
    document.getElementById("candidate-search").addEventListener("input", function (event) {
      clearTimeout(state.searchTimer);
      state.searchTimer = window.setTimeout(function () { state.search = event.target.value.trim(); loadCandidates(true); }, 280);
    });
    document.getElementById("candidate-grid").addEventListener("click", function (event) {
      var select = event.target.closest("[data-select]");
      var description = event.target.closest("[data-toggle-description]");
      var details = event.target.closest("[data-toggle-details]");
      var target;
      if (select) {
        state.selectedToken = select.dataset.select;
        renderCandidateList();
      } else if (description) {
        target = root.querySelector('[data-description="' + CSS.escape(description.dataset.toggleDescription) + '"]');
        target.hidden = !target.hidden; description.textContent = target.hidden ? "Ver descrição" : "Fechar descrição";
      } else if (details) {
        target = root.querySelector('[data-details="' + CSS.escape(details.dataset.toggleDetails) + '"]');
        target.hidden = !target.hidden; details.textContent = target.hidden ? "Detalhes" : "Fechar detalhes";
      }
    });
  }

  window.addEventListener("message", function (event) {
    var data = event.data || {};
    var crop;
    if (event.origin !== window.location.origin || !previewFrame || event.source !== previewFrame.contentWindow) { return; }
    if (data.type === "mia-preview-ready") {
      previewFrame.dataset.ready = "yes";
      sendPreview();
      return;
    }
    if (data.type !== "mia-preview-measured" || !currentProduct() || data.key !== currentProduct().slot.key) { return; }
    crop = root.querySelector("[data-preview-crop]");
    if (!crop) { return; }
    previewFrame.style.height = Math.max(400, data.documentHeight || 600) + "px";
    crop.classList.remove("is-waiting", "is-missing");
    if (!data.found) {
      crop.classList.add("is-missing");
      crop.style.width = "100%";
      crop.style.height = "90px";
      previewFrame.style.visibility = "hidden";
      return;
    }
    crop.style.width = Math.min(data.rect.width, crop.parentElement.clientWidth) + "px";
    crop.style.height = data.rect.height + "px";
    previewFrame.style.visibility = "visible";
    previewFrame.style.marginLeft = (-data.rect.left) + "px";
    previewFrame.style.marginTop = (-data.rect.top) + "px";
    crop.scrollLeft = 0;
    crop.scrollTop = 0;
  });

  function renderReview() {
    root.innerHTML = '<header class="review-header"><p class="wizard-progress-copy">' + completedCount() + " de " + state.products.length
      + ' imagens concluídas</p><h1>REVISÃO FINAL</h1><p>Confirma visualmente as escolhas antes de qualquer aplicação.</p></header>'
      + '<section class="review-list">' + state.products.map(function (product, index) {
        return '<article class="review-row"><img src="' + esc(imageUrl(product.selectedToken)) + '" alt="Imagem escolhida"><div><h2>'
          + esc(product.familyLabel + " — " + product.variantLabel) + '</h2><p>✓ escolhido</p><button type="button" class="wizard-button is-quiet" data-edit-product="'
          + index + '">Alterar esta escolha</button></div></article>';
      }).join("") + '</section><div class="review-actions"><button type="button" class="wizard-button review-apply" disabled>APLICAR MAPEAMENTO AO SITE</button>'
      + '<p class="review-note">A aplicação ao site está desactivada. Nenhum JSON público foi alterado.</p></div>';
    root.querySelectorAll("[data-edit-product]").forEach(function (button) {
      button.addEventListener("click", function () { state.currentIndex = Number(button.dataset.editProduct); renderWizard(); });
    });
  }

  Promise.all([
    api("data"),
    fetch("galeria-api.php?action=data", { credentials: "same-origin" }).then(responseJson)
  ]).then(function (results) {
    var review = results[0];
    csrf = review.csrf || csrf;
    state.products = buildProducts(results[1]);
    applyReview(review);
    state.currentIndex = Math.max(0, state.products.findIndex(function (product) {
      return product.key === state.lastKey && product.status !== "selected";
    }));
    if (completedCount() === state.products.length && state.products.length) { renderReview(); } else { renderWizard(); }
  }).catch(showError);
}());
