(function () {
  "use strict";

  var script = document.currentScript;
  var body = document.body;
  if (!script || !body) return;

  var endpoint = script.getAttribute("data-endpoint") || "../track-order-event.php";
  var productSlug = script.getAttribute("data-product") || body.getAttribute("data-product-slug") || "catalogo";
  var pageKind = script.getAttribute("data-page") || body.getAttribute("data-catalog-page") || "catalogo";

  initCatalogAdmin(endpoint, productSlug);

  if (location.protocol === "file:") return;
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return;

  var sessionKey = "mp_catalog_session_v1";
  var attributionKey = "mp_catalog_attribution_v1";
  var eventIndex = 0;
  var pageInstanceId = Math.random().toString(36).slice(2, 10);

  function randomId() {
    if (window.crypto && crypto.getRandomValues) {
      var bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      return Array.prototype.map.call(bytes, function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return "";
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {}
  }

  function sessionGet(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      return "";
    }
  }

  function sessionSet(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (error) {}
  }

  function sessionId() {
    var id = storageGet(sessionKey);
    if (!id) {
      id = "catalog_" + randomId();
      storageSet(sessionKey, id);
    }
    return id;
  }

  function queryValue(name) {
    try {
      return new URLSearchParams(location.search).get(name) || "";
    } catch (error) {
      return "";
    }
  }

  function attribution() {
    var existing = sessionGet(attributionKey);
    if (existing) {
      try {
        return JSON.parse(existing);
      } catch (error) {}
    }
    var data = {
      first_landing_page: location.pathname,
      first_url: location.href,
      first_referrer: document.referrer || "",
      utm_source: queryValue("utm_source"),
      utm_medium: queryValue("utm_medium"),
      utm_campaign: queryValue("utm_campaign"),
      utm_content: queryValue("utm_content"),
      utm_term: queryValue("utm_term"),
      fbclid: queryValue("fbclid"),
      gclid: queryValue("gclid")
    };
    sessionSet(attributionKey, JSON.stringify(data));
    return data;
  }

  function send(eventName, extra) {
    var attr = attribution();
    var payload = Object.assign({
      session_id: sessionId(),
      product_slug: productSlug,
      product_type: "catalogo",
      event_name: eventName,
      step_id: pageKind,
      landing_page: location.pathname,
      referrer: document.referrer || "",
      language: navigator.language || "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      viewport_width: window.innerWidth || 0,
      viewport_height: window.innerHeight || 0,
      screen_width: screen.width || 0,
      screen_height: screen.height || 0,
      device_pixel_ratio: window.devicePixelRatio || 1,
      timestamp_ms: Date.now(),
      page_instance_id: pageInstanceId,
      client_event_index: ++eventIndex,
      first_landing_page: attr.first_landing_page || "",
      first_url: attr.first_url || "",
      first_referrer: attr.first_referrer || "",
      utm_source: attr.utm_source || "",
      utm_medium: attr.utm_medium || "",
      utm_campaign: attr.utm_campaign || "",
      utm_content: attr.utm_content || "",
      utm_term: attr.utm_term || "",
      fbclid: attr.fbclid || "",
      gclid: attr.gclid || ""
    }, extra || {});

    var json = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      var blob = new Blob([json], { type: "application/json" });
      if (navigator.sendBeacon(endpoint, blob)) return;
    }
    fetch(endpoint, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: json
    }).catch(function () {});
  }

  window.addEventListener("pageshow", function () {
    send("catalog_page_view");
  });

  document.addEventListener("click", function (event) {
    var link = event.target.closest("a[data-catalog-track]");
    if (!link) return;
    var trackType = link.getAttribute("data-catalog-track") || "link";
    send("catalog_" + trackType + "_clicked", {
      target_type: trackType,
      target_label: (link.textContent || "").trim().slice(0, 120),
      target_id: link.getAttribute("href") || ""
    });
  });

  function initCatalogAdmin(trackEndpoint, slug) {
    var ADMIN_KEY = "miaandpaper-admin-session-v1";
    var adminEndpoint = endpointRelative(trackEndpoint, "admin-api.php");
    var catalogJsonUrl = endpointRelative(trackEndpoint, "content/catalogo.json");
    var state = {
      admin: catalogStorageGet(ADMIN_KEY) === "1",
      panelOpen: catalogStorageGet(ADMIN_KEY) === "1",
      loginOpen: false,
      csrf: "",
      message: "",
      catalog: { schemaVersion: 1, imageEdits: {} },
      imageEdits: {},
      images: [],
      active: null,
      dirty: false,
      saving: false,
      statusLoading: false
    };

    scanCatalogImages();
    loadCatalogJson();
    ensureAdminOpenButton();

    if (state.admin) {
      refreshAdminStatus(true);
    } else {
      renderCatalogAdmin();
    }

    document.addEventListener("keydown", function (event) {
      var edit;
      var key = "";
      var delta = event.shiftKey ? 5 : 1;
      var current;
      var next;

      if (!state.admin || !state.active || catalogAdminIgnoredTarget(event.target)) {
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
      next = clampCatalogEditValue(key, current + delta);

      if (next === current) {
        return;
      }

      edit[key] = next;
      state.dirty = true;
      applyEditToImage(state.active.img, edit);
      updateSelectedValues();
      updateCatalogDirtyUi();
    });

    function endpointRelative(trackEndpointValue, filename) {
      var clean = String(trackEndpointValue || "").split(/[?#]/)[0];
      var slash = clean.lastIndexOf("/");
      return (slash >= 0 ? clean.slice(0, slash + 1) : "") + filename;
    }

    function catalogStorageGet(key) {
      try {
        return window.localStorage ? window.localStorage.getItem(key) || "" : "";
      } catch (error) {
        return "";
      }
    }

    function catalogStorageSet(key, value) {
      try {
        if (window.localStorage) {
          window.localStorage.setItem(key, value);
        }
      } catch (error) {}
    }

    function catalogStorageRemove(key) {
      try {
        if (window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch (error) {}
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

    function normalizeCatalogImagePath(src) {
      var value = String(src || "").replace(/\\/g, "/").split(/[?#]/)[0];
      var origin = location.origin || "";
      var marker;

      if (origin && value.indexOf(origin) === 0) {
        value = value.slice(origin.length);
      }
      while (value.indexOf("../") === 0) {
        value = value.slice(3);
      }
      while (value.indexOf("./") === 0) {
        value = value.slice(2);
      }
      while (value.charAt(0) === "/") {
        value = value.slice(1);
      }

      marker = value.indexOf("content/");
      if (marker > 0) {
        value = value.slice(marker);
      }

      return value;
    }

    function catalogImageKey(img) {
      return slug + ":" + normalizeCatalogImagePath(img.getAttribute("src") || img.currentSrc || "");
    }

    function imageDefaults(img) {
      var zoom = cssVarNumber(img, "--catalog-design-zoom", 1);

      if (zoom > 0 && zoom <= 5) {
        zoom = zoom * 100;
      }

      return {
        zoom: roundNumber(zoom || 100),
        x: roundNumber(cssVarNumber(img, "--catalog-design-x", 0)),
        y: roundNumber(cssVarNumber(img, "--catalog-design-y", 0)),
        rotation: roundNumber(cssVarNumber(img, "--catalog-design-rotation", 0))
      };
    }

    function imageRecordFromElement(img) {
      var frame = img.closest(".catalog-design-frame");
      return {
        img: img,
        frame: frame,
        key: catalogImageKey(img),
        defaults: imageDefaults(img),
        label: (frame && frame.getAttribute("aria-label")) || img.getAttribute("alt") || "Imagem"
      };
    }

    function scanCatalogImages() {
      state.images = Array.prototype.slice.call(document.querySelectorAll(".catalog-design-frame > .catalog-design-img")).map(function (img) {
        var record = imageRecordFromElement(img);

        if (record.frame) {
          record.frame.dataset.catalogAdminKey = record.key;
          record.frame.addEventListener("click", function (event) {
            if (!state.admin) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            selectCatalogImage(record);
          });
          record.frame.addEventListener("keydown", function (event) {
            if (!state.admin || (event.key !== "Enter" && event.key !== " ")) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            selectCatalogImage(record);
          });
        }

        img.dataset.catalogAdminKey = record.key;
        return record;
      });
    }

    function normalizeLoadedCatalog(data) {
      var catalog = data && typeof data === "object" && !Array.isArray(data)
        ? data
        : { schemaVersion: 1, imageEdits: {} };

      if (!catalog.imageEdits || typeof catalog.imageEdits !== "object") {
        catalog.imageEdits = {};
      }

      return catalog;
    }

    function loadCatalogJson() {
      fetch(catalogJsonUrl, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store"
      }).then(function (response) {
        if (!response.ok) {
          return {};
        }
        return response.json().catch(function () { return {}; });
      }).then(function (data) {
        state.catalog = normalizeLoadedCatalog(data);
        state.imageEdits = state.catalog.imageEdits || {};
        applyCatalogEdits();
        renderCatalogAdmin();
      }).catch(function () {
        applyCatalogEdits();
        renderCatalogAdmin();
      });
    }

    function editForRecord(record) {
      var edit = state.imageEdits[record.key];
      if (!edit || typeof edit !== "object") {
        return record.defaults;
      }

      return {
        zoom: clampCatalogEditValue("zoom", edit.zoom != null ? edit.zoom : record.defaults.zoom),
        x: clampCatalogEditValue("x", edit.x != null ? edit.x : record.defaults.x),
        y: clampCatalogEditValue("y", edit.y != null ? edit.y : record.defaults.y),
        rotation: clampCatalogEditValue("rotation", edit.rotation != null ? edit.rotation : record.defaults.rotation)
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
      img.style.setProperty("--catalog-design-zoom", String((Number(edit.zoom) || 100) / 100));
      img.style.setProperty("--catalog-design-x", String(Number(edit.x) || 0) + "%");
      img.style.setProperty("--catalog-design-y", String(Number(edit.y) || 0) + "%");
      img.style.setProperty("--catalog-design-rotation", String(Number(edit.rotation) || 0) + "deg");
    }

    function applyCatalogEdits() {
      state.images.forEach(function (record) {
        applyEditToImage(record.img, editForRecord(record));
      });
    }

    function clampCatalogEditValue(key, value) {
      var number = Number(value);
      var limits = {
        zoom: [20, 500],
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

    function selectCatalogImage(record) {
      state.active = record;
      state.panelOpen = true;
      state.loginOpen = false;

      state.images.forEach(function (candidate) {
        if (candidate.frame) {
          candidate.frame.classList.toggle("is-catalog-admin-active", candidate.key === record.key);
        }
      });

      renderCatalogAdmin();
    }

    function updateSelectedValues() {
      var edit = state.active ? editForRecord(state.active) : null;

      ["x", "y", "zoom", "rotation"].forEach(function (key) {
        var target = document.querySelector('[data-catalog-admin-value="' + key + '"]');
        if (target) {
          target.textContent = edit ? String(edit[key]) : "-";
        }
      });
    }

    function catalogAdminIgnoredTarget(target) {
      var tag = target && target.tagName ? target.tagName.toLowerCase() : "";
      return tag === "input" || tag === "textarea" || tag === "select" || tag === "button" || tag === "a" || !!(target && target.isContentEditable);
    }

    function ensureAdminOpenButton() {
      var footer = document.querySelector(".catalog-footer");
      var button = document.querySelector("[data-catalog-admin-open]");
      var legacyButton = footer ? footer.querySelector("[data-admin-open]") : null;

      // Se o footer foi copiado da homepage, pode trazer o botão errado:
      // data-admin-open. No catálogo esse botão não tem handler próprio.
      // Em vez de criar um segundo botão, reaproveitamos esse botão e
      // transformamo-lo no botão certo do admin do catálogo.
      if (!button && legacyButton) {
        button = legacyButton;
        button.removeAttribute("data-admin-open");
        button.setAttribute("data-catalog-admin-open", "");
        if (button.className) {
          button.className += " catalog-admin-open";
        } else {
          button.className = "catalog-admin-open";
        }
      }

      // Se não existir botão nenhum, cria um botão no footer.
      if (!button && footer) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "catalog-admin-open";
        button.setAttribute("data-catalog-admin-open", "");
        footer.appendChild(document.createTextNode(" · "));
        footer.appendChild(button);
      }

      if (!button) {
        updateAdminOpenButton();
        return;
      }

      // Garante que o botão funciona mesmo quando já vinha no HTML.
      // Evita também ligar o mesmo click várias vezes após rerenders.
      if (button.dataset.catalogAdminBound !== "1") {
        button.dataset.catalogAdminBound = "1";

        button.addEventListener("click", function () {
          if (state.admin) {
            state.panelOpen = !state.panelOpen;
            state.loginOpen = false;
            renderCatalogAdmin();
            return;
          }

          refreshAdminStatus(false).then(function (loggedIn) {
            if (loggedIn) {
              state.panelOpen = true;
            } else {
              state.loginOpen = true;
              state.panelOpen = true;
            }
            renderCatalogAdmin();
          });
        });
      }

      updateAdminOpenButton();
    }

    function updateAdminOpenButton() {
      var button = document.querySelector("[data-catalog-admin-open]");
      if (!button) {
        return;
      }
      button.textContent = state.admin
        ? (state.dirty ? "Admin *" : "Admin")
        : "Login de Administrador";
      button.setAttribute("aria-expanded", state.panelOpen || state.loginOpen ? "true" : "false");
    }

    function updateCatalogDirtyUi() {
      var save = document.querySelector("[data-catalog-admin-save]");
      updateAdminOpenButton();
      if (save) {
        save.disabled = state.saving || !state.dirty;
        save.textContent = state.saving ? "A guardar" : "SAVE";
      }
    }

    function renderCatalogAdmin() {
      var existing = document.querySelector("[data-catalog-admin-panel]");
      var selected = state.active ? editForRecord(state.active) : null;
      var selectedHtml;
      var panelHtml;

      updateAdminOpenButton();

      document.documentElement.classList.toggle("catalog-admin-mode", !!state.admin);
      state.images.forEach(function (record) {
        if (record.frame) {
          record.frame.tabIndex = state.admin ? 0 : -1;
          record.frame.classList.toggle("is-catalog-admin-selectable", !!state.admin);
          record.frame.classList.toggle("is-catalog-admin-active", !!(state.active && state.active.key === record.key));
        }
      });

      if (!state.admin && !state.loginOpen) {
        if (existing) existing.remove();
        return;
      }

      if (state.admin && !state.panelOpen) {
        if (existing) existing.remove();
        return;
      }

      if (!existing) {
        existing = document.createElement("aside");
        existing.setAttribute("data-catalog-admin-panel", "");
        existing.className = "catalog-admin-panel";
        document.body.appendChild(existing);
      }

      if (!state.admin) {
        existing.innerHTML = [
          '<form data-catalog-admin-login-form>',
          '<strong>Admin catálogo</strong>',
          '<label><span>Password</span><input type="password" name="password" autocomplete="current-password" required></label>',
          state.message ? '<p class="catalog-admin-message">' + escapeHtml(state.message) + '</p>' : "",
          '<div class="catalog-admin-actions">',
          '<button type="submit">Entrar</button>',
          '<button type="button" data-catalog-admin-close>Fechar</button>',
          '</div>',
          '</form>'
        ].join("");
        bindCatalogAdminPanel();
        return;
      }

      selectedHtml = selected ? [
        '<p class="catalog-admin-selected">Selecionada: <strong>' + escapeHtml(state.active.label) + '</strong></p>',
        '<div class="catalog-admin-values">',
        '<span>X <strong data-catalog-admin-value="x">' + escapeHtml(selected.x) + '</strong></span>',
        '<span>Y <strong data-catalog-admin-value="y">' + escapeHtml(selected.y) + '</strong></span>',
        '<span>Zoom <strong data-catalog-admin-value="zoom">' + escapeHtml(selected.zoom) + '</strong></span>',
        '<span>Rot. <strong data-catalog-admin-value="rotation">' + escapeHtml(selected.rotation) + '</strong></span>',
        '</div>',
        '<button type="button" data-catalog-admin-reset-image>Repor imagem selecionada</button>'
      ].join("") : '<p class="catalog-admin-selected">Clica numa imagem do catálogo para a selecionar.</p>';

      panelHtml = [
        '<div class="catalog-admin-head">',
        '<strong>Admin catálogo</strong>',
        '<button type="button" data-catalog-admin-save' + (state.saving || !state.dirty ? " disabled" : "") + '>' + (state.saving ? "A guardar" : "SAVE") + '</button>',
        '<button type="button" data-catalog-admin-logout>Sair</button>',
        '<button type="button" data-catalog-admin-close>Fechar</button>',
        '</div>',
        state.message ? '<p class="catalog-admin-message">' + escapeHtml(state.message) + '</p>' : "",
        selectedHtml,
        '<p class="catalog-admin-help"><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> move X/Y · <kbd>Ctrl</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd> zoom · <kbd>Ctrl</kbd> + <kbd>←</kbd>/<kbd>→</kbd> rotação · <kbd>Shift</kbd> aumenta o passo.</p>',
        '<p class="catalog-admin-help">Os valores são guardados em <code>content/catalogo.json</code>.</p>'
      ].join("");

      existing.innerHTML = panelHtml;
      bindCatalogAdminPanel();
    }

    function bindCatalogAdminPanel() {
      var panel = document.querySelector("[data-catalog-admin-panel]");
      var loginForm = panel && panel.querySelector("[data-catalog-admin-login-form]");
      var close = panel && panel.querySelector("[data-catalog-admin-close]");
      var logout = panel && panel.querySelector("[data-catalog-admin-logout]");
      var save = panel && panel.querySelector("[data-catalog-admin-save]");
      var resetImage = panel && panel.querySelector("[data-catalog-admin-reset-image]");

      if (loginForm) {
        loginForm.addEventListener("submit", function (event) {
          var password;

          event.preventDefault();
          password = String(new FormData(loginForm).get("password") || "");
          state.message = "";

          adminRequest("login", { password: password }).then(function () {
            state.admin = true;
            state.loginOpen = false;
            state.panelOpen = true;
            catalogStorageSet(ADMIN_KEY, "1");
            return refreshAdminStatus(true);
          }).then(function () {
            renderCatalogAdmin();
          }).catch(function (error) {
            state.message = error.message;
            renderCatalogAdmin();
          });
        });
      }

      if (close) {
        close.addEventListener("click", function () {
          state.loginOpen = false;
          state.panelOpen = false;
          renderCatalogAdmin();
        });
      }

      if (logout) {
        logout.addEventListener("click", function () {
          adminRequest("logout", {}).catch(function () {});
          state.admin = false;
          state.loginOpen = false;
          state.panelOpen = false;
          state.active = null;
          catalogStorageRemove(ADMIN_KEY);
          renderCatalogAdmin();
        });
      }

      if (save) {
        save.addEventListener("click", function () {
          saveCatalog();
        });
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
          renderCatalogAdmin();
        });
      }
    }

    function refreshAdminStatus(silent) {
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
          catalogStorageSet(ADMIN_KEY, "1");
        } else {
          state.admin = false;
          catalogStorageRemove(ADMIN_KEY);
          if (!silent) {
            state.loginOpen = true;
          }
        }
        renderCatalogAdmin();
        return state.admin;
      }).catch(function () {
        state.statusLoading = false;
        if (!silent) {
          state.message = "Não foi possível confirmar a sessão de admin.";
        }
        renderCatalogAdmin();
        return state.admin;
      });
    }

    function ensureCatalogCsrf() {
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
      if (action === "login") {
        return adminFetch(action, payload, "");
      }
      return ensureCatalogCsrf().then(function (csrf) {
        return adminFetch(action, payload, csrf);
      });
    }

    function saveCatalog() {
      state.saving = true;
      state.message = "";
      state.catalog.schemaVersion = 1;
      state.catalog.imageEdits = state.imageEdits;
      renderCatalogAdmin();

      adminRequest("save-catalog", { catalog: state.catalog }).then(function (data) {
        state.catalog = normalizeLoadedCatalog(data.catalog || state.catalog);
        state.imageEdits = state.catalog.imageEdits || {};
        state.dirty = false;
        state.saving = false;
        state.message = data.syncFlagCreated === false
          ? "Guardado no servidor, mas não consegui marcar a flag Git."
          : "Guardado em content/catalogo.json.";
        applyCatalogEdits();
        renderCatalogAdmin();
      }).catch(function (error) {
        state.saving = false;
        state.message = error.message;
        renderCatalogAdmin();
      });
    }
  }
})();
