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

  function miuAdminFramePosition(index, columns, rows)
  {
    var column = index % columns;
    var row = Math.floor(index / columns);
    return {
      x: columns <= 1 ? 0 : (column / (columns - 1)) * 100,
      y: rows <= 1 ? 0 : (row / (rows - 1)) * 100
    };
  }

  document.querySelectorAll("[data-animation-preview]").forEach(function (preview) {
    var columns = Math.max(1, Number(preview.dataset.columns || 1));
    var rows = Math.max(1, Number(preview.dataset.rows || 1));
    var sequence = String(preview.dataset.sequence || "0").split(",").map(Number).filter(function (value) {
      return Number.isFinite(value) && value >= 0 && value < columns * rows;
    });
    var durations = String(preview.dataset.durations || "180").split(",").map(Number);
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var cursor = 0;
    if (!sequence.length) { sequence = [0]; }
    preview.style.backgroundImage = 'url("' + String(preview.dataset.sheet || "").replace(/"/g, "%22") + '")';
    preview.style.backgroundSize = (columns * 100) + "% " + (rows * 100) + "%";
    preview.style.transform = preview.dataset.flip === "1" ? "scaleX(-1)" : "none";
    var draw = function () {
      var index = sequence[cursor % sequence.length];
      var position = miuAdminFramePosition(index, columns, rows);
      preview.style.backgroundPosition = position.x + "% " + position.y + "%";
      if (reduceMotion) { return; }
      var delay = Math.max(60, Number(durations[cursor % durations.length] || 180));
      cursor = (cursor + 1) % sequence.length;
      window.setTimeout(draw, delay);
    };
    draw();
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
