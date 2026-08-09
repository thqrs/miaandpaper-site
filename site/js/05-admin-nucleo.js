// js/05-admin-nucleo.js — parte 05/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: pushUndo, CSRF admin, adminFetch/adminRequest, estado do IP admin, refreshBasicAdminInfo, openAdminSurface, cleanHomeForSave, saveDraft.
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
      if (data && data.homeRevision) {
        state.homeRevision = String(data.homeRevision);
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
      if (data && data.homeRevision) {
        state.homeRevision = String(data.homeRevision);
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
      if (data && data.homeRevision) {
        state.homeRevision = String(data.homeRevision);
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
      payload = { product: content };
    } else {
      payload = { home: cleanHomeForSave(content), revision: state.homeRevision || "" };
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
        state.homeRevision = data.homeRevision || state.homeRevision;
      }
      state.adminMessage = data.syncFlagCreated === false
        ? "Guardado no servidor, mas nao consegui marcar a flag Git."
        : "Guardado no servidor. Flag Git marcada para sincronizar.";
      if (isProduct) {
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
