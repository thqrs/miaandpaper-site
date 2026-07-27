(function () {
  "use strict";

  var button = document.querySelector("[data-menu-button]");
  var panel = document.querySelector("[data-menu-panel]");
  var closeControls = document.querySelectorAll("[data-menu-close]");

  if (!button || !panel) {
    return;
  }

  function setMenu(open) {
    document.body.classList.toggle("menu-is-open", open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
    panel.setAttribute("aria-hidden", open ? "false" : "true");
  }

  button.addEventListener("click", function () {
    setMenu(!document.body.classList.contains("menu-is-open"));
  });

  closeControls.forEach(function (control) {
    control.addEventListener("click", function () {
      setMenu(false);
    });
  });

  panel.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      setMenu(false);
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      setMenu(false);
    }
  });
})();
