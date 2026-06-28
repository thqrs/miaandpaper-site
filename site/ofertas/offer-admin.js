(function () {
  var ADMIN_KEY = "miaandpaper-admin-session-v1";
  var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-offer-admin-open]"));
  var panel = null;

  if (!buttons.length) return;

  function isAdmin() {
    try {
      return window.localStorage.getItem(ADMIN_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function setAdmin(value) {
    try {
      if (value) {
        window.localStorage.setItem(ADMIN_KEY, "1");
      } else {
        window.localStorage.removeItem(ADMIN_KEY);
      }
    } catch (error) {}
  }

  function adminUrl(action) {
    return "/admin-api.php?action=" + encodeURIComponent(action);
  }

  function updateButtons() {
    buttons.forEach(function (button) {
      button.textContent = isAdmin() ? "Admin ativo" : "Login de Administrador";
      button.setAttribute("aria-expanded", panel && !panel.hidden ? "true" : "false");
    });
  }

  function ensurePanel() {
    if (panel) return panel;

    panel = document.createElement("aside");
    panel.className = "offer-admin-panel";
    panel.setAttribute("aria-label", "Admin");
    panel.hidden = true;
    document.body.appendChild(panel);
    return panel;
  }

  function closePanel() {
    if (!panel) return;
    panel.hidden = true;
    updateButtons();
  }

  function renderPanel(message) {
    ensurePanel();

    if (isAdmin()) {
      panel.innerHTML = [
        '<div class="offer-admin-panel-head">',
        '<strong>Admin ativo</strong>',
        '<button type="button" data-offer-admin-close>Fechar</button>',
        '</div>',
        message ? '<p class="offer-admin-message" role="status">' + message + '</p>' : "",
        '<div class="offer-admin-actions">',
        '<button type="button" data-offer-admin-logout>Sair</button>',
        '</div>'
      ].join("");
    } else {
      panel.innerHTML = [
        '<form data-offer-admin-login-form>',
        '<label><span>Password</span><input type="password" name="password" autocomplete="current-password" required></label>',
        message ? '<p class="offer-admin-message" role="status">' + message + '</p>' : "",
        '<div class="offer-admin-actions">',
        '<button type="submit">Entrar</button>',
        '<button type="button" data-offer-admin-close>Fechar</button>',
        '</div>',
        '</form>'
      ].join("");
    }

    bindPanel();
    updateButtons();
  }

  function submitLogin(form) {
    var password = String(new FormData(form).get("password") || "");

    if (window.location.protocol === "file:") {
      renderPanel("O login de administrador só funciona no site publicado.");
      return;
    }

    fetch(adminUrl("login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password: password })
    }).then(function (response) {
      return response.text().then(function (text) {
        var data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (error) {
          data = { message: text || "Resposta inválida do servidor." };
        }
        if (!response.ok || data.ok === false) {
          throw new Error(data.message || "Não foi possível iniciar sessão.");
        }
        setAdmin(true);
        renderPanel("Sessão de administrador iniciada nesta página.");
      });
    }).catch(function (error) {
      renderPanel(error.message || "Não foi possível iniciar sessão.");
    });
  }

  function logout() {
    setAdmin(false);
    if (window.location.protocol !== "file:") {
      fetch(adminUrl("logout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: "{}"
      }).catch(function () {});
    }
    renderPanel("Sessão terminada.");
  }

  function bindPanel() {
    var form = panel.querySelector("[data-offer-admin-login-form]");
    var close = panel.querySelector("[data-offer-admin-close]");
    var exit = panel.querySelector("[data-offer-admin-logout]");

    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        submitLogin(form);
      });
    }

    if (close) {
      close.addEventListener("click", closePanel);
    }

    if (exit) {
      exit.addEventListener("click", logout);
    }
  }

  buttons.forEach(function (button) {
    button.type = "button";
    button.addEventListener("click", function () {
      renderPanel("");
      panel.hidden = false;
      updateButtons();
      var focusTarget = panel.querySelector("input, button");
      if (focusTarget) focusTarget.focus();
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closePanel();
  });

  updateButtons();
}());
