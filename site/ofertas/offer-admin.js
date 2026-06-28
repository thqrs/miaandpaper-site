(function () {
  var ADMIN_KEY = "miaandpaper-admin-session-v1";
  var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-offer-admin-open]"));
  var script = document.currentScript || document.querySelector('script[src*="offer-admin.js"]');
  var adminEndpoint = endpointFromScript("../admin-api.php");
  var offersJsonUrl = endpointFromScript("../content/ofertas.json");
  var state = {
    admin: storageGet(ADMIN_KEY) === "1",
    panelOpen: false,
    loginOpen: false,
    csrf: "",
    message: "",
    offers: { schemaVersion: 1, imageEdits: {} },
    imageEdits: {},
    images: [],
    active: null,
    dirty: false,
    saving: false,
    statusLoading: false
  };

  if (!buttons.length) return;

  scanOfferImages();
  loadOffersJson();
  bindAdminButtons();

  if (state.admin) {
    refreshAdminStatus(true);
  } else {
    renderPanel();
  }

  document.addEventListener("keydown", function (event) {
    var edit;
    var key = "";
    var delta = event.shiftKey ? 5 : 1;
    var current;
    var next;

    if (event.key === "Escape") {
      closePanel();
      return;
    }

    if (!state.admin || !state.active || adminIgnoredTarget(event.target)) {
      return;
    }

    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(event.key) === -1) {
      return;
    }

    if (event.ctrlKey) {
      if (event.key === "ArrowUp") { key = "zoom"; }
      else if (event.key === "ArrowDown") { key = "zoom"; delta = -delta; }
      else if (event.key === "ArrowLeft") { key = "rotation"; delta = -delta; }
      else if (event.key === "ArrowRight") { key = "rotation"; }
    } else {
      if (event.key === "ArrowLeft") { key = "x"; delta = -delta; }
      else if (event.key === "ArrowRight") { key = "x"; }
      else if (event.key === "ArrowUp") { key = "y"; delta = -delta; }
      else if (event.key === "ArrowDown") { key = "y"; }
    }

    if (!key) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    edit = ensureImageEdit(state.active);
    current = Number(edit[key]);
    next = clampEditValue(key, current + delta);

    if (next === current) {
      return;
    }

    edit[key] = next;
    state.dirty = true;
    applyEditToImage(state.active.img, edit);
    updateSelectedValues();
    updateDirtyUi();
  });

  function endpointFromScript(relativePath) {
    var src = script && script.src ? script.src : window.location.href;
    try {
      return new URL(relativePath, src).href;
    } catch (error) {
      return relativePath;
    }
  }

  function storageGet(key) {
    try {
      return window.localStorage ? window.localStorage.getItem(key) || "" : "";
    } catch (error) {
      return "";
    }
  }

  function storageSet(key, value) {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (error) {}
  }

  function storageRemove(key) {
    try {
      if (window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (error) {}
  }

  function isFilePage() {
    return window.location.protocol === "file:";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cleanNumber(value, fallback) {
    var number = parseFloat(String(value == null ? "" : value).replace("%", "").replace("deg", ""));
    return isFinite(number) ? number : fallback;
  }

  function roundNumber(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  function cssVarNumber(element, name, fallback) {
    var inline = element.style.getPropertyValue(name);
    var computed = "";

    try {
      computed = window.getComputedStyle(element).getPropertyValue(name);
    } catch (error) {}

    return cleanNumber(inline || computed, fallback);
  }

  function normalizeImagePath(src) {
    var value = String(src || "");
    var marker;

    try {
      value = new URL(value, window.location.href).pathname;
    } catch (error) {}

    value = value.replace(/\\/g, "/").split(/[?#]/)[0];
    try {
      value = decodeURIComponent(value);
    } catch (error) {}

    marker = value.lastIndexOf("/ofertas/");
    if (marker >= 0) {
      value = value.slice(marker + 1);
    } else {
      marker = value.lastIndexOf("/content/");
      if (marker >= 0) {
        value = value.slice(marker + 1);
      }
    }

    while (value.charAt(0) === "/") {
      value = value.slice(1);
    }

    return value;
  }

  function imageKey(img) {
    return normalizeImagePath(img.getAttribute("src") || img.currentSrc || "");
  }

  function imageDefaults(img) {
    var zoom = cssVarNumber(img, "--offer-image-zoom", 1);

    if (zoom > 0 && zoom <= 5) {
      zoom *= 100;
    }

    return {
      zoom: roundNumber(zoom || 100),
      x: roundNumber(cssVarNumber(img, "--offer-image-x", 0)),
      y: roundNumber(cssVarNumber(img, "--offer-image-y", 0)),
      rotation: roundNumber(cssVarNumber(img, "--offer-image-rotation", 0))
    };
  }

  function imageRecordFromElement(img) {
    var frame = img.closest(".congresso-carousel-slide")
      || img.closest(".offer-card-image-frame, .congresso-download-preview, .congresso-photo-frame");
    return {
      img: img,
      frame: frame,
      key: imageKey(img),
      defaults: imageDefaults(img),
      label: (frame && frame.getAttribute("aria-label")) || img.getAttribute("alt") || "Imagem"
    };
  }

  function scanOfferImages() {
    var selector = [
      ".offer-card-image-frame > img",
      ".congresso-download-preview > img",
      ".congresso-carousel-slide > img",
      ".congresso-photo-frame > img"
    ].join(",");

    state.images = Array.prototype.slice.call(document.querySelectorAll(selector)).map(function (img) {
      var record = imageRecordFromElement(img);

      img.dataset.offerAdminKey = record.key;

      if (record.frame) {
        record.frame.dataset.offerAdminKey = record.key;
        record.frame.addEventListener("click", function (event) {
          if (!state.admin) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          selectOfferImage(record);
        }, true);

        record.frame.addEventListener("keydown", function (event) {
          if (!state.admin || (event.key !== "Enter" && event.key !== " ")) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          selectOfferImage(record);
        }, true);
      }

      return record;
    });
  }

  function normalizeOffers(data) {
    var offers = data && typeof data === "object" && !Array.isArray(data)
      ? data
      : { schemaVersion: 1, imageEdits: {} };

    if (!offers.imageEdits || typeof offers.imageEdits !== "object") {
      offers.imageEdits = {};
    }

    return offers;
  }

  function loadOffersJson() {
    fetch(offersJsonUrl, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) {
        return {};
      }
      return response.json().catch(function () { return {}; });
    }).then(function (data) {
      state.offers = normalizeOffers(data);
      state.imageEdits = state.offers.imageEdits || {};
      applyOfferEdits();
      renderPanel();
    }).catch(function () {
      applyOfferEdits();
      renderPanel();
    });
  }

  function editForRecord(record) {
    var edit = state.imageEdits[record.key];
    if (!edit || typeof edit !== "object") {
      return record.defaults;
    }

    return {
      zoom: clampEditValue("zoom", edit.zoom != null ? edit.zoom : record.defaults.zoom),
      x: clampEditValue("x", edit.x != null ? edit.x : record.defaults.x),
      y: clampEditValue("y", edit.y != null ? edit.y : record.defaults.y),
      rotation: clampEditValue("rotation", edit.rotation != null ? edit.rotation : record.defaults.rotation)
    };
  }

  function ensureImageEdit(record) {
    var current = editForRecord(record);
    if (!state.imageEdits[record.key] || typeof state.imageEdits[record.key] !== "object") {
      state.imageEdits[record.key] = {
        zoom: current.zoom,
        x: current.x,
        y: current.y,
        rotation: current.rotation
      };
    }
    return state.imageEdits[record.key];
  }

  function applyEditToImage(img, edit) {
    img.style.setProperty("--offer-image-zoom", String((Number(edit.zoom) || 100) / 100));
    img.style.setProperty("--offer-image-x", String(Number(edit.x) || 0) + "%");
    img.style.setProperty("--offer-image-y", String(Number(edit.y) || 0) + "%");
    img.style.setProperty("--offer-image-rotation", String(Number(edit.rotation) || 0) + "deg");
  }

  function applyOfferEdits() {
    state.images.forEach(function (record) {
      applyEditToImage(record.img, editForRecord(record));
    });
  }

  function clampEditValue(key, value) {
    var number = Number(value);
    var limits = {
      zoom: [100, 500],
      x: [-100, 100],
      y: [-100, 100],
      rotation: [-180, 180]
    };
    var range = limits[key] || [-9999, 9999];

    if (!isFinite(number)) {
      number = key === "zoom" ? 100 : 0;
    }

    return Math.max(range[0], Math.min(range[1], roundNumber(number)));
  }

  function selectOfferImage(record) {
    state.active = record;
    state.panelOpen = true;
    state.loginOpen = false;

    state.images.forEach(function (candidate) {
      if (candidate.frame) {
        candidate.frame.classList.toggle("is-offer-admin-active", candidate.key === record.key);
      }
    });

    renderPanel();
  }

  function updateSelectedValues() {
    var edit = state.active ? editForRecord(state.active) : null;

    ["x", "y", "zoom", "rotation"].forEach(function (key) {
      var target = document.querySelector('[data-offer-admin-value="' + key + '"]');
      if (target) {
        target.textContent = edit ? String(edit[key]) : "-";
      }
    });
  }

  function adminIgnoredTarget(target) {
    var tag = target && target.tagName ? target.tagName.toLowerCase() : "";
    if (target && target.closest && target.closest(".is-offer-admin-selectable")) {
      return false;
    }
    return tag === "input" || tag === "textarea" || tag === "select" || tag === "button" || tag === "a" || !!(target && target.isContentEditable);
  }

  function bindAdminButtons() {
    buttons.forEach(function (button) {
      button.type = "button";
      if (button.dataset.offerAdminBound === "1") {
        return;
      }

      button.dataset.offerAdminBound = "1";
      button.addEventListener("click", function () {
        if (state.admin) {
          state.panelOpen = !state.panelOpen;
          state.loginOpen = false;
          renderPanel();
          return;
        }

        refreshAdminStatus(false).then(function (loggedIn) {
          state.panelOpen = true;
          state.loginOpen = !loggedIn;
          renderPanel();
        });
      });
    });

    updateAdminButtons();
  }

  function updateAdminButtons() {
    buttons.forEach(function (button) {
      button.textContent = state.admin
        ? (state.dirty ? "Admin *" : "Admin")
        : "Login de Administrador";
      button.setAttribute("aria-expanded", state.panelOpen || state.loginOpen ? "true" : "false");
    });
  }

  function updateDirtyUi() {
    var save = document.querySelector("[data-offer-admin-save]");
    updateAdminButtons();
    if (save) {
      save.disabled = state.saving || !state.dirty;
      save.textContent = state.saving ? "A guardar" : "SAVE";
    }
  }

  function renderPanel() {
    var panel = document.querySelector("[data-offer-admin-panel]");
    var selected = state.active ? editForRecord(state.active) : null;
    var selectedHtml;

    updateAdminButtons();
    document.documentElement.classList.toggle("offer-admin-mode", !!state.admin);

    state.images.forEach(function (record) {
      if (record.frame) {
        record.frame.tabIndex = state.admin ? 0 : -1;
        record.frame.classList.toggle("is-offer-admin-selectable", !!state.admin);
        record.frame.classList.toggle("is-offer-admin-active", !!(state.active && state.active.key === record.key));
      }
    });

    if (!state.admin && !state.loginOpen) {
      if (panel) panel.remove();
      return;
    }

    if (state.admin && !state.panelOpen) {
      if (panel) panel.remove();
      return;
    }

    if (!panel) {
      panel = document.createElement("aside");
      panel.setAttribute("data-offer-admin-panel", "");
      panel.className = "offer-admin-panel";
      panel.setAttribute("aria-label", "Admin");
      document.body.appendChild(panel);
    }

    if (!state.admin) {
      panel.innerHTML = [
        '<form data-offer-admin-login-form>',
        '<strong>Admin ofertas</strong>',
        '<label><span>Password</span><input type="password" name="password" autocomplete="current-password" required></label>',
        state.message ? '<p class="offer-admin-message" role="status">' + escapeHtml(state.message) + '</p>' : "",
        '<div class="offer-admin-actions">',
        '<button type="submit">Entrar</button>',
        '<button type="button" data-offer-admin-close>Fechar</button>',
        '</div>',
        '</form>'
      ].join("");
      bindPanel();
      return;
    }

    selectedHtml = selected ? [
      '<p class="offer-admin-selected">Selecionada: <strong>' + escapeHtml(state.active.label) + '</strong></p>',
      '<div class="offer-admin-values">',
      '<span>X <strong data-offer-admin-value="x">' + escapeHtml(selected.x) + '</strong></span>',
      '<span>Y <strong data-offer-admin-value="y">' + escapeHtml(selected.y) + '</strong></span>',
      '<span>Zoom <strong data-offer-admin-value="zoom">' + escapeHtml(selected.zoom) + '</strong></span>',
      '<span>Rot. <strong data-offer-admin-value="rotation">' + escapeHtml(selected.rotation) + '</strong></span>',
      '</div>',
      '<button type="button" data-offer-admin-reset-image>Repor imagem selecionada</button>'
    ].join("") : (
      state.images.length
        ? '<p class="offer-admin-selected">Clica numa imagem desta página para a selecionar.</p>'
        : '<p class="offer-admin-selected">Esta página não tem imagens editáveis.</p>'
    );

    panel.innerHTML = [
      '<div class="offer-admin-panel-head">',
      '<strong>Admin ofertas</strong>',
      '<button type="button" data-offer-admin-save' + (state.saving || !state.dirty ? " disabled" : "") + '>' + (state.saving ? "A guardar" : "SAVE") + '</button>',
      '<button type="button" data-offer-admin-logout>Sair</button>',
      '<button type="button" data-offer-admin-close>Fechar</button>',
      '</div>',
      state.message ? '<p class="offer-admin-message" role="status">' + escapeHtml(state.message) + '</p>' : "",
      selectedHtml,
      '<p class="offer-admin-help"><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> move X/Y · <kbd>Ctrl</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd> zoom · <kbd>Ctrl</kbd> + <kbd>←</kbd>/<kbd>→</kbd> rotação · <kbd>Shift</kbd> aumenta o passo.</p>',
      '<p class="offer-admin-help">Os valores são guardados em <code>content/ofertas.json</code>.</p>'
    ].join("");

    bindPanel();
  }

  function bindPanel() {
    var panel = document.querySelector("[data-offer-admin-panel]");
    var loginForm = panel && panel.querySelector("[data-offer-admin-login-form]");
    var close = panel && panel.querySelector("[data-offer-admin-close]");
    var logoutButton = panel && panel.querySelector("[data-offer-admin-logout]");
    var save = panel && panel.querySelector("[data-offer-admin-save]");
    var resetImage = panel && panel.querySelector("[data-offer-admin-reset-image]");

    if (loginForm) {
      loginForm.addEventListener("submit", function (event) {
        event.preventDefault();
        submitLogin(loginForm);
      });
    }

    if (close) {
      close.addEventListener("click", closePanel);
    }

    if (logoutButton) {
      logoutButton.addEventListener("click", logout);
    }

    if (save) {
      save.addEventListener("click", saveOffers);
    }

    if (resetImage) {
      resetImage.addEventListener("click", function () {
        if (!state.active) {
          return;
        }
        delete state.imageEdits[state.active.key];
        state.dirty = true;
        applyEditToImage(state.active.img, state.active.defaults);
        updateSelectedValues();
        renderPanel();
      });
    }
  }

  function closePanel() {
    state.panelOpen = false;
    state.loginOpen = false;
    renderPanel();
  }

  function refreshAdminStatus(silent) {
    if (isFilePage()) {
      state.admin = false;
      storageRemove(ADMIN_KEY);
      if (!silent) {
        state.message = "O login de administrador só funciona no site publicado.";
      }
      renderPanel();
      return Promise.resolve(false);
    }

    if (state.statusLoading) {
      return Promise.resolve(state.admin);
    }

    state.statusLoading = true;
    return fetch(adminEndpoint + "?action=status", {
      method: "GET",
      credentials: "same-origin"
    }).then(function (response) {
      return response.json().catch(function () { return {}; });
    }).then(function (data) {
      state.statusLoading = false;
      if (data && data.csrf) {
        state.csrf = String(data.csrf);
      }
      if (data && data.loggedIn === true) {
        state.admin = true;
        storageSet(ADMIN_KEY, "1");
      } else {
        state.admin = false;
        storageRemove(ADMIN_KEY);
        if (!silent) {
          state.loginOpen = true;
        }
      }
      renderPanel();
      return state.admin;
    }).catch(function () {
      state.statusLoading = false;
      if (!silent) {
        state.message = "Não foi possível confirmar a sessão de admin.";
      }
      renderPanel();
      return state.admin;
    });
  }

  function ensureCsrf() {
    if (state.csrf) {
      return Promise.resolve(state.csrf);
    }
    return refreshAdminStatus(true).then(function () {
      return state.csrf;
    });
  }

  function adminFetch(action, payload, csrf) {
    var headers = { "Content-Type": "application/json" };
    if (csrf) {
      headers["X-Admin-CSRF"] = csrf;
    }

    return fetch(adminEndpoint + "?action=" + encodeURIComponent(action), {
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
          data = { message: text || "Resposta inválida do servidor." };
        }
        if (!response.ok || data.ok === false) {
          throw new Error(data.message || "Não foi possível concluir a ação.");
        }
        if (data && data.csrf) {
          state.csrf = String(data.csrf);
        }
        return data;
      });
    });
  }

  function adminRequest(action, payload) {
    if (action === "login" || action === "logout") {
      return adminFetch(action, payload, "");
    }
    return ensureCsrf().then(function (csrf) {
      return adminFetch(action, payload, csrf);
    });
  }

  function submitLogin(form) {
    var password = String(new FormData(form).get("password") || "");

    if (isFilePage()) {
      state.message = "O login de administrador só funciona no site publicado.";
      renderPanel();
      return;
    }

    state.message = "";
    adminRequest("login", { password: password }).then(function (data) {
      state.admin = true;
      state.loginOpen = false;
      state.panelOpen = true;
      state.csrf = data && data.csrf ? String(data.csrf) : state.csrf;
      state.message = "Sessão de administrador iniciada nesta página.";
      storageSet(ADMIN_KEY, "1");
      renderPanel();
    }).catch(function (error) {
      state.message = error.message || "Não foi possível iniciar sessão.";
      renderPanel();
    });
  }

  function logout() {
    adminRequest("logout", {}).catch(function () {});
    state.admin = false;
    state.loginOpen = false;
    state.panelOpen = false;
    state.active = null;
    state.message = "";
    storageRemove(ADMIN_KEY);
    renderPanel();
  }

  function saveOffers() {
    if (!state.admin || state.saving || !state.dirty) {
      return;
    }

    state.saving = true;
    state.message = "";
    state.offers.schemaVersion = 1;
    state.offers.imageEdits = state.imageEdits;
    renderPanel();

    adminRequest("save-offers", { offers: state.offers }).then(function (data) {
      state.offers = normalizeOffers(data.offers || state.offers);
      state.imageEdits = state.offers.imageEdits || {};
      state.dirty = false;
      state.saving = false;
      state.message = data.syncFlagCreated === false
        ? "Guardado no servidor, mas não consegui marcar a flag Git."
        : "Guardado em content/ofertas.json.";
      applyOfferEdits();
      renderPanel();
    }).catch(function (error) {
      state.saving = false;
      state.message = error.message || "Não foi possível guardar.";
      renderPanel();
    });
  }
}());
