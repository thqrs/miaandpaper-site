(function () {
  "use strict";

  var state = { data: null, revision: "", csrf: "", dirty: false, saving: false };
  var statusBox = document.querySelector("[data-status]");
  var editor = document.querySelector("[data-editor]");
  var login = document.querySelector("[data-login]");
  var list = document.querySelector("[data-list]");
  var savebar = document.querySelector("[data-savebar]");
  var dirtyLabel = document.querySelector("[data-dirty]");
  var template = document.getElementById("review-card-template");
  var iconMap = { heart: "♥", flower: "✿", sparkle: "✦", check: "✓", quote: "❝" };

  function setStatus(message, type) {
    statusBox.textContent = message;
    statusBox.className = "reviews-status" + (type ? " is-" + type : "");
  }

  function request(url, options) {
    return fetch(url, options || {}).then(function (response) {
      return response.text().then(function (text) {
        var data;
        try { data = text ? JSON.parse(text) : {}; } catch (error) { data = {}; }
        if (!response.ok || data.ok === false) {
          var err = new Error(data.message || "Não foi possível concluir a ação.");
          err.status = response.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  function defaults() {
    return {
      schemaVersion: 1,
      settings: { enabled: true, intervalMs: 5500, position: "left", size: "normal", theme: "paper", imageShape: "rounded", showImage: true, showName: true, showText: true, defaultRatingMode: "stars", defaultStars: 5, defaultIcon: "heart", defaultCustomIcon: "✦", eggPumps: 7 },
      reviews: []
    };
  }

  function normalizeClient(data) {
    var base = defaults();
    data = data && typeof data === "object" ? data : {};
    base.settings = Object.assign(base.settings, data.settings || {});
    base.reviews = Array.isArray(data.reviews) ? data.reviews : [];
    base.reviews.forEach(function (review, index) {
      review.id = review.id || newId();
      review.order = Number(review.order) || index + 1;
      if (typeof review.enabled !== "boolean") review.enabled = true;
      if (typeof review.linkEnabled !== "boolean") review.linkEnabled = false;
      // Reviews antigas nao tinham estes campos: sem isto o input ficava
      // "undefined" em vez de vazio.
      if (typeof review.date !== "string") review.date = "";
      if (typeof review.orderNote !== "string") review.orderNote = "";
    });
    return base;
  }

  function newId() {
    return "review-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function markDirty(value) {
    state.dirty = value !== false;
    dirtyLabel.textContent = state.dirty ? "Há alterações por guardar." : "Sem alterações por guardar.";
  }

  function reviewById(id) {
    return state.data.reviews.find(function (review) { return review.id === id; });
  }

  function ratingPreview(review) {
    var settings = state.data.settings;
    var mode = review.ratingMode === "default" || !review.ratingMode ? settings.defaultRatingMode : review.ratingMode;
    if (mode === "none") return "Sem avaliação";
    if (mode === "stars") return "★".repeat(Math.max(1, Math.min(5, Number(review.stars) || Number(settings.defaultStars) || 5)));
    var icon = review.icon === "default" || !review.icon ? settings.defaultIcon : review.icon;
    if (icon === "custom") return review.customIcon || settings.defaultCustomIcon || "✦";
    return iconMap[icon] || "✦";
  }

  function refreshCard(card, review) {
    card.classList.toggle("is-disabled", !review.enabled);
    card.querySelector("[data-card-title]").textContent = review.name || "Review sem nome";
    var image = card.querySelector("[data-image-preview]");
    image.src = review.image || "content/brand/logo.webp";
    image.onerror = function () { image.onerror = null; image.src = "content/brand/logo.webp"; };
    var preview = card.querySelector("[data-live-preview]");
    preview.innerHTML = "<strong>" + escapeHtml(review.name || "Cliente Mia & Paper") + "</strong> · " + escapeHtml(review.text || "Sem texto") + " · " + escapeHtml(ratingPreview(review));
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function setControlValue(control, value) {
    if (control.type === "checkbox") control.checked = Boolean(value);
    else control.value = value == null ? "" : value;
  }

  function renderSettings() {
    document.querySelectorAll("[data-setting]").forEach(function (control) {
      var key = control.dataset.setting;
      var value = key === "intervalSeconds" ? (Number(state.data.settings.intervalMs) || 5500) / 1000 : state.data.settings[key];
      setControlValue(control, value);
    });
  }

  function renderList() {
    list.innerHTML = "";
    state.data.reviews.sort(function (a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0); });
    state.data.reviews.forEach(function (review) {
      var fragment = template.content.cloneNode(true);
      var card = fragment.querySelector("[data-review-card]");
      card.dataset.reviewId = review.id;
      card.querySelectorAll("[data-field]").forEach(function (control) {
        setControlValue(control, review[control.dataset.field]);
      });
      refreshCard(card, review);
      list.appendChild(fragment);
    });
    if (!state.data.reviews.length) list.innerHTML = '<p class="reviews-status">Ainda não há reviews. Carrega em “Adicionar review”.</p>';
  }

  function render() {
    renderSettings();
    renderList();
    editor.hidden = false;
    login.hidden = true;
    savebar.hidden = false;
  }

  function addReview(source) {
    var review = source ? JSON.parse(JSON.stringify(source)) : {
      enabled: true, name: "", text: "", date: "", orderNote: "", image: "", linkEnabled: false, link: "", ratingMode: "default", stars: 5, icon: "default", customIcon: ""
    };
    review.id = newId();
    review.order = state.data.reviews.length + 1;
    state.data.reviews.push(review);
    markDirty();
    renderList();
    var card = list.querySelector('[data-review-id="' + review.id + '"]');
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function reorder(id, direction) {
    var rows = state.data.reviews.slice().sort(function (a, b) { return a.order - b.order; });
    var index = rows.findIndex(function (row) { return row.id === id; });
    var target = index + direction;
    if (index < 0 || target < 0 || target >= rows.length) return;
    var swap = rows[index]; rows[index] = rows[target]; rows[target] = swap;
    rows.forEach(function (row, idx) { row.order = idx + 1; });
    state.data.reviews = rows;
    markDirty();
    renderList();
  }

  function save() {
    if (state.saving) return;
    state.saving = true;
    setStatus("A guardar…");
    request("reviews-api.php?action=save", {
      method: "POST",
      credentials: "same-origin",
      headers: Object.assign({ "Content-Type": "application/json" }, state.csrf ? { "X-Admin-CSRF": state.csrf } : {}),
      body: JSON.stringify({ data: state.data, revision: state.revision })
    }).then(function (response) {
      state.data = normalizeClient(response.data);
      state.revision = response.revision || "";
      state.saving = false;
      markDirty(false);
      setStatus("Reviews guardadas. A homepage passa a usar estas definições.", "success");
      render();
    }).catch(function (error) {
      state.saving = false;
      setStatus(error.message, "error");
    });
  }

  function upload(file, review, card) {
    var form = new FormData();
    form.append("image", file);
    setStatus("A enviar e converter a imagem para WebP…");
    request("reviews-api.php?action=upload", {
      method: "POST",
      credentials: "same-origin",
      headers: state.csrf ? { "X-Admin-CSRF": state.csrf } : {},
      body: form
    }).then(function (response) {
      review.image = response.path;
      card.querySelector('[data-field="image"]').value = review.image;
      refreshCard(card, review);
      markDirty();
      setStatus("Imagem enviada em WebP. Guarda as alterações para a associar à review.", "success");
    }).catch(function (error) { setStatus(error.message, "error"); });
  }

  document.addEventListener("input", function (event) {
    var setting = event.target.closest("[data-setting]");
    if (setting && state.data) {
      var key = setting.dataset.setting;
      var value = setting.type === "checkbox" ? setting.checked : setting.value;
      if (key === "intervalSeconds") state.data.settings.intervalMs = Math.round(Number(value || 5.5) * 1000);
      else if (key === "defaultStars") state.data.settings[key] = Number(value) || 5;
      else if (key === "eggPumps") state.data.settings[key] = Math.max(0, Math.min(20, Math.round(Number(value) || 0)));
      else state.data.settings[key] = value;
      markDirty();
      renderList();
      return;
    }
    var field = event.target.closest("[data-field]");
    var card = event.target.closest("[data-review-card]");
    if (!field || !card || !state.data) return;
    var review = reviewById(card.dataset.reviewId);
    if (!review) return;
    var fieldValue = field.type === "checkbox" ? field.checked : field.value;
    if (field.type === "number") fieldValue = Number(fieldValue) || 1;
    review[field.dataset.field] = fieldValue;
    markDirty();
    refreshCard(card, review);
  });

  document.addEventListener("change", function (event) {
    if (event.target.matches('[data-field="order"]')) {
      state.data.reviews.forEach(function (row) { row.order = Number(row.order) || 1; });
      renderList();
    }
    var uploadInput = event.target.closest("[data-upload]");
    var card = event.target.closest("[data-review-card]");
    if (uploadInput && card && uploadInput.files && uploadInput.files[0]) upload(uploadInput.files[0], reviewById(card.dataset.reviewId), card);
  });

  document.addEventListener("click", function (event) {
    if (event.target.closest("[data-add]")) { addReview(); return; }
    if (event.target.closest("[data-save]")) { save(); return; }
    var card = event.target.closest("[data-review-card]");
    if (!card || !state.data) return;
    var id = card.dataset.reviewId;
    var review = reviewById(id);
    var move = event.target.closest("[data-move]");
    if (move) { reorder(id, move.dataset.move === "up" ? -1 : 1); return; }
    if (event.target.closest("[data-duplicate]")) { addReview(review); return; }
    if (event.target.closest("[data-delete]") && window.confirm("Apagar esta review?")) {
      state.data.reviews = state.data.reviews.filter(function (row) { return row.id !== id; });
      state.data.reviews.forEach(function (row, index) { row.order = index + 1; });
      markDirty(); renderList();
    }
  });

  document.querySelector("[data-login-form]").addEventListener("submit", function (event) {
    event.preventDefault();
    var password = new FormData(event.currentTarget).get("password") || "";
    request("admin-api.php?action=login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: password }) })
      .then(load)
      .catch(function (error) { setStatus(error.message, "error"); });
  });

  window.addEventListener("beforeunload", function (event) {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  function load() {
    setStatus("A carregar reviews…");
    return request("reviews-api.php?action=load", { credentials: "same-origin", cache: "no-store" }).then(function (response) {
      state.data = normalizeClient(response.data);
      state.revision = response.revision || "";
      state.csrf = response.csrf || "";
      markDirty(false);
      setStatus(response.requiresAdmin ? "Editor protegido por sessão de administração." : "Editor aberto. Antes do deploy, põe MIA_ADMIN_OPEN a false em admin-open.php.");
      render();
    }).catch(function (error) {
      if (error.status === 403) {
        editor.hidden = true; savebar.hidden = true; login.hidden = false;
        setStatus(error.message, "error");
        return;
      }
      setStatus(error.message, "error");
    });
  }

  load();
})();
