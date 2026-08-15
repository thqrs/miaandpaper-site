(function () {
  "use strict";

  document.querySelectorAll("[data-max-count]").forEach(function (field) {
    var output = field.parentElement.querySelector("[data-char-count]");
    var limit = Number(field.dataset.maxCount || 0);
    var update = function () {
      if (output) { output.textContent = field.value.length + (limit ? "/" + limit : ""); }
    };
    field.addEventListener("input", update);
    update();
  });

  document.querySelectorAll("[data-confirm]").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      if (!window.confirm(form.dataset.confirm)) { event.preventDefault(); }
    });
  });

  var contextFilter = document.querySelector("[data-context-filter]");
  if (contextFilter) {
    var normalize = function (value) {
      return String(value || "").toLocaleLowerCase("pt-PT").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };
    var filterContexts = function () {
      var query = normalize(contextFilter.value.trim());
      document.querySelectorAll("[data-context-group]").forEach(function (group) {
        var visible = 0;
        group.querySelectorAll("[data-context-step]").forEach(function (step) {
          var matches = !query || normalize(step.textContent).indexOf(query) !== -1;
          step.hidden = !matches;
          if (matches) { visible += 1; }
        });
        group.hidden = visible === 0;
        if (query && visible) { group.open = true; }
      });
    };
    contextFilter.addEventListener("input", filterContexts);
  }
}());
