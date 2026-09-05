(function () {
  "use strict";

  var boot = window.MOCKUP_STUDIO_BOOTSTRAP || {};
  var canvas = document.getElementById("mockup-canvas");
  var renderer = new window.MockupStudioRenderer.Renderer(canvas, boot.assetBase);
  var state = {
    preset: null,
    saved: null,
    revision: "",
    csrf: boot.csrf || "",
    history: [],
    dirty: false,
    rendering: false,
    renderQueued: false,
    toastTimer: 0,
    coverBitmap: null
  };

  var controlGroups = {
    "cover-controls": [
      { path: "cover.x", label: "X", min: 0, max: 1200, step: 1 },
      { path: "cover.y", label: "Y", min: 0, max: 1200, step: 1 },
      { path: "cover.width", label: "Largura", min: 100, max: 1200, step: 1 },
      { path: "cover.height", label: "Altura", min: 100, max: 1200, step: 1 },
      { path: "cover.cornerRadius", label: "Cantos", min: 0, max: 180, step: 1 },
      { path: "cover.artZoom", label: "Zoom da arte", min: 0.25, max: 4, step: 0.01 },
      { path: "cover.artX", label: "Arte X", min: -1000, max: 1000, step: 1 },
      { path: "cover.artY", label: "Arte Y", min: -1000, max: 1000, step: 1 }
    ],
    "hole-controls": [
      { path: "holes.count", label: "Quantidade", type: "ring-count", wide: true },
      { path: "holes.x", label: "Posição X", min: 0, max: 1200, step: 1 },
      { path: "holes.firstY", label: "Primeiro Y", min: 0, max: 1200, step: 1 },
      { path: "holes.pitch", label: "Pitch (2:1 · px)", min: 1, max: 400, step: 1 },
      { path: "holes.width", label: "Largura", min: 1, max: 220, step: 1 },
      { path: "holes.height", label: "Altura", min: 1, max: 220, step: 1 }
    ],
    "ring-controls": [
      { path: "rings.style", label: "Estilo", type: "ring-style", wide: true },
      { path: "rings.xOffset", label: "Offset X", min: -500, max: 500, step: 1 },
      { path: "rings.yOffset", label: "Offset Y", min: -500, max: 500, step: 1 },
      { path: "rings.scale", label: "Escala", min: 0.1, max: 4, step: 0.01 },
      { path: "rings.frontOpacity", label: "Frente", type: "opacity" },
      { path: "rings.backOpacity", label: "Traseira", type: "opacity" }
    ],
    "elastic-controls": [
      { path: "elastic.style", label: "Estilo / cor", type: "elastic-style", wide: true },
      { path: "elastic.x", label: "X", min: 0, max: 1200, step: 1 },
      { path: "elastic.y", label: "Y", min: 0, max: 1200, step: 1 },
      { path: "elastic.width", label: "Largura", min: 1, max: 400, step: 1 },
      { path: "elastic.scale", label: "Escala", min: 0.1, max: 4, step: 0.01 },
      { path: "elastic.opacity", label: "Opacidade", type: "opacity" }
    ],
    "shadow-controls": [
      { path: "shadows.cover.opacity", label: "Capa · opacidade", type: "opacity", wide: true },
      { path: "shadows.cover.xOffset", label: "Capa · X", min: -500, max: 500, step: 1 },
      { path: "shadows.cover.yOffset", label: "Capa · Y", min: -500, max: 500, step: 1 },
      { path: "shadows.cover.scale", label: "Capa · escala", min: 0.1, max: 4, step: 0.01 },
      { path: "shadows.holes.opacity", label: "Buracos · opacidade", type: "opacity", wide: true },
      { path: "shadows.holes.xOffset", label: "Buracos · X", min: -200, max: 200, step: 1 },
      { path: "shadows.holes.yOffset", label: "Buracos · Y", min: -200, max: 200, step: 1 },
      { path: "shadows.holes.scale", label: "Buracos · escala", min: 0.1, max: 4, step: 0.01 },
      { path: "rings.shadowOpacity", label: "Argolas · opacidade", type: "opacity", wide: true },
      { path: "elastic.shadowOpacity", label: "Elástico · opacidade", type: "opacity", wide: true }
    ],
    "overlay-controls": [
      { path: "overlays.highlights.opacity", label: "Brilhos", type: "opacity", wide: true },
      { path: "overlays.highlights.xOffset", label: "Brilhos · X", min: -500, max: 500, step: 1 },
      { path: "overlays.highlights.yOffset", label: "Brilhos · Y", min: -500, max: 500, step: 1 },
      { path: "overlays.highlights.scale", label: "Brilhos · escala", min: 0.1, max: 4, step: 0.01 },
      { path: "overlays.reflections.opacity", label: "Reflexos", type: "opacity", wide: true },
      { path: "overlays.reflections.xOffset", label: "Reflexos · X", min: -500, max: 500, step: 1 },
      { path: "overlays.reflections.yOffset", label: "Reflexos · Y", min: -500, max: 500, step: 1 },
      { path: "overlays.reflections.scale", label: "Reflexos · escala", min: 0.1, max: 4, step: 0.01 },
      { path: "overlays.texture.opacity", label: "Textura", type: "opacity", wide: true },
      { path: "overlays.texture.xOffset", label: "Textura · X", min: -500, max: 500, step: 1 },
      { path: "overlays.texture.yOffset", label: "Textura · Y", min: -500, max: 500, step: 1 },
      { path: "overlays.texture.scale", label: "Textura · escala", min: 0.1, max: 4, step: 0.01 }
    ]
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getPath(object, path) {
    return path.split(".").reduce(function (value, key) { return value[key]; }, object);
  }

  function setPath(object, path, value) {
    var parts = path.split(".");
    var target = object;
    parts.slice(0, -1).forEach(function (key) { target = target[key]; });
    target[parts[parts.length - 1]] = value;
  }

  function setSaveState(message, className) {
    var element = document.getElementById("save-state");
    element.textContent = message;
    element.className = "save-state" + (className ? " " + className : "");
  }

  function toast(message, isError) {
    var element = document.getElementById("toast");
    window.clearTimeout(state.toastTimer);
    element.textContent = message;
    element.className = "toast" + (isError ? " is-error" : "");
    element.hidden = false;
    state.toastTimer = window.setTimeout(function () { element.hidden = true; }, 3600);
  }

  function markDirty() {
    state.dirty = true;
    document.getElementById("save-button").disabled = false;
    document.getElementById("undo-button").disabled = state.history.length === 0;
    setSaveState("Por guardar", "is-dirty");
  }

  function pushHistory() {
    if (!state.preset) { return; }
    var snapshot = JSON.stringify(state.preset);
    if (state.history.length && state.history[state.history.length - 1] === snapshot) { return; }
    state.history.push(snapshot);
    if (state.history.length > 40) { state.history.shift(); }
    document.getElementById("undo-button").disabled = false;
  }

  function scheduleRender() {
    if (!state.preset) { return; }
    var title = String(state.preset.label || state.preset.id || "Mockup").replace(/\s+Front$/i, "");
    document.getElementById("preview-title").textContent = title + " · " + state.preset.holes.count + " furos · Cinch " + (state.preset.holes.pitchSystem || "2:1");
    state.renderQueued = true;
    if (state.rendering) { return; }
    window.requestAnimationFrame(renderLoop);
  }

  async function renderLoop() {
    if (!state.renderQueued || !state.preset) { return; }
    state.renderQueued = false;
    state.rendering = true;
    document.getElementById("render-busy").hidden = false;
    try {
      await renderer.render(state.preset);
    } catch (error) {
      toast(error.message || "Falha ao montar o mockup.", true);
    } finally {
      state.rendering = false;
      document.getElementById("render-busy").hidden = true;
      if (state.renderQueued) { window.requestAnimationFrame(renderLoop); }
    }
  }

  function inputOptions(definition) {
    if (definition.type === "ring-count") {
      return Object.keys(state.preset.rings.atlases || {}).map(Number).sort(function (a, b) {
        return a - b;
      }).map(function (count) {
        return { value: String(count), label: count + " argolas" };
      });
    }
    if (definition.type === "ring-style") {
      return Object.keys(state.preset.rings.styles).map(function (key) {
        return { value: key, label: state.preset.rings.styles[key].label };
      });
    }
    if (definition.type === "elastic-style") {
      return Object.keys(state.preset.elastic.styles).map(function (key) {
        return { value: key, label: state.preset.elastic.styles[key].label };
      });
    }
    return [];
  }

  function makeControl(definition) {
    var label = document.createElement("label");
    label.className = "control-field" + (definition.wide ? " is-wide" : "");
    var caption = document.createElement("span");
    caption.textContent = definition.label;
    label.appendChild(caption);

    var value = getPath(state.preset, definition.path);
    var input;
    if (definition.type === "ring-count" || definition.type === "ring-style" || definition.type === "elastic-style") {
      input = document.createElement("select");
      inputOptions(definition).forEach(function (optionData) {
        var option = document.createElement("option");
        option.value = optionData.value;
        option.textContent = optionData.label;
        input.appendChild(option);
      });
      input.value = value;
      label.appendChild(input);
    } else if (definition.type === "opacity") {
      var row = document.createElement("div");
      row.className = "range-row";
      input = document.createElement("input");
      input.type = "range";
      input.min = "0";
      input.max = "1";
      input.step = ".01";
      input.value = value;
      var output = document.createElement("span");
      output.className = "range-value";
      output.textContent = Math.round(value * 100) + "%";
      input.addEventListener("input", function () { output.textContent = Math.round(Number(input.value) * 100) + "%"; });
      row.append(input, output);
      label.appendChild(row);
    } else {
      input = document.createElement("input");
      input.type = "number";
      input.min = definition.min;
      input.max = definition.max;
      input.step = definition.step;
      input.value = value;
      label.appendChild(input);
    }

    input.dataset.path = definition.path;
    input.addEventListener("focus", function () {
      if (!input.dataset.historyStarted) {
        pushHistory();
        input.dataset.historyStarted = "1";
      }
    });
    input.addEventListener("blur", function () { delete input.dataset.historyStarted; });
    input.addEventListener("input", function () {
      var next = input.tagName === "SELECT"
        ? (definition.type === "ring-count" ? Number(input.value) : input.value)
        : Number(input.value);
      if (typeof next === "number" && !Number.isFinite(next)) { return; }
      setPath(state.preset, definition.path, next);
      markDirty();
      scheduleRender();
    });
    input.addEventListener("change", function () {
      if (input.tagName === "SELECT") {
        setPath(state.preset, definition.path, definition.type === "ring-count" ? Number(input.value) : input.value);
        markDirty();
        scheduleRender();
      }
    });
    return label;
  }

  function renderControls() {
    Object.keys(controlGroups).forEach(function (containerId) {
      var container = document.getElementById(containerId);
      container.innerHTML = "";
      controlGroups[containerId].forEach(function (definition) {
        container.appendChild(makeControl(definition));
      });
    });
  }

  function assetUrl(entry) {
    return boot.assetBase + entry.path + "?v=" + Date.now();
  }

  async function fileToPng(file) {
    var bitmap = await createImageBitmap(file);
    if (bitmap.width > 4096 || bitmap.height > 4096) {
      bitmap.close();
      throw new Error("O asset não pode ultrapassar 4096 × 4096 px.");
    }
    var stage = document.createElement("canvas");
    stage.width = bitmap.width;
    stage.height = bitmap.height;
    stage.getContext("2d").drawImage(bitmap, 0, 0);
    bitmap.close();
    var blob = await new Promise(function (resolve) { stage.toBlob(resolve, "image/png"); });
    if (!blob) { throw new Error("Este browser não conseguiu converter o asset para PNG."); }
    return new File([blob], "asset.png", { type: "image/png" });
  }

  function isSvgAsset(entry) {
    return /\.svg$/i.test(entry.path || "");
  }

  async function fileToSvg(file) {
    var text = await file.text();
    if (text.length > 2 * 1024 * 1024 || !/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(text)) {
      throw new Error("Escolhe um SVG válido com até 2 MB.");
    }
    if (/<(?:script|foreignObject)\b|<!DOCTYPE|<!ENTITY|\son[a-z]+\s*=|javascript:/i.test(text)) {
      throw new Error("O SVG contém elementos que não são permitidos.");
    }
    return new File([text], "asset.svg", { type: "image/svg+xml" });
  }

  async function replaceAsset(assetKey, input, card) {
    if (!input.files || !input.files[0]) { return; }
    var status = card.querySelector(".asset-status");
    var button = card.querySelector("button");
    var entry = state.preset.assets[assetKey];
    button.disabled = true;
    status.textContent = isSvgAsset(entry) ? "A validar SVG…" : "A preparar PNG…";
    try {
      var converted = isSvgAsset(entry) ? await fileToSvg(input.files[0]) : await fileToPng(input.files[0]);
      var form = new FormData();
      form.append("preset", state.preset.id);
      form.append("assetKey", assetKey);
      form.append("csrf", state.csrf);
      form.append("asset", converted, isSvgAsset(entry) ? "asset.svg" : "asset.png");
      status.textContent = "A substituir apenas esta peça…";
      var response = await fetch(boot.endpoint + "?action=replace-asset", {
        method: "POST",
        credentials: "same-origin",
        body: form
      });
      var data = await response.json();
      if (!response.ok || !data.ok) { throw new Error(data.message || "Não foi possível substituir o asset."); }
      renderer.invalidateAsset(state.preset.assets[assetKey].path);
      var image = card.querySelector("img");
      image.src = assetUrl(state.preset.assets[assetKey]);
      status.textContent = "Substituído. As restantes layers não foram alteradas.";
      scheduleRender();
      toast("Asset substituído sem mexer nas outras peças.");
    } catch (error) {
      status.textContent = error.message;
      toast(error.message, true);
    } finally {
      button.disabled = false;
      input.value = "";
    }
  }

  function renderAssetManager() {
    var root = document.getElementById("asset-manager");
    var groups = {};
    root.innerHTML = "";
    Object.keys(state.preset.assets).forEach(function (key) {
      var entry = state.preset.assets[key];
      groups[entry.group] = groups[entry.group] || [];
      groups[entry.group].push({ key: key, entry: entry });
    });
    Object.keys(groups).forEach(function (groupName) {
      var section = document.createElement("section");
      section.className = "asset-group";
      var heading = document.createElement("h4");
      heading.textContent = groupName;
      section.appendChild(heading);
      groups[groupName].forEach(function (item) {
        var card = document.createElement("article");
        card.className = "asset-card";
        var header = document.createElement("div");
        header.className = "asset-card-header";
        var thumb = document.createElement("div");
        thumb.className = "asset-thumb";
        var image = document.createElement("img");
        image.src = assetUrl(item.entry);
        image.alt = "";
        thumb.appendChild(image);
        var meta = document.createElement("div");
        meta.className = "asset-meta";
        var name = document.createElement("strong");
        name.textContent = item.entry.label;
        var path = document.createElement("code");
        path.textContent = item.entry.path;
        meta.append(name, path);
        header.append(thumb, meta);

        var actions = document.createElement("div");
        actions.className = "asset-actions";
        var input = document.createElement("input");
        input.type = "file";
        input.accept = isSvgAsset(item.entry) ? "image/svg+xml,.svg" : "image/*";
        input.hidden = true;
        var button = document.createElement("button");
        button.type = "button";
        button.className = "button button-secondary";
        button.textContent = "Substituir";
        button.addEventListener("click", function () { input.click(); });
        input.addEventListener("change", function () { replaceAsset(item.key, input, card); });
        actions.append(input, button);
        var status = document.createElement("div");
        status.className = "asset-status";
        status.textContent = "Slot: " + item.key;
        card.append(header, actions, status);
        section.appendChild(card);
      });
      root.appendChild(section);
    });
  }

  async function apiLoad() {
    var response = await fetch(boot.endpoint + "?action=load&preset=" + encodeURIComponent(boot.presetId), {
      credentials: "same-origin",
      cache: "no-store"
    });
    var data = await response.json();
    if (!response.ok || !data.ok) { throw new Error(data.message || "Não foi possível abrir o preset."); }
    state.preset = data.preset;
    state.saved = clone(data.preset);
    state.revision = data.revision;
    state.csrf = data.csrf || state.csrf;
    state.history = [];
    state.dirty = false;
    renderControls();
    renderAssetManager();
    setSaveState("Guardado", "is-ok");
    document.getElementById("save-button").disabled = true;
    document.getElementById("undo-button").disabled = true;
    scheduleRender();
  }

  async function savePreset() {
    var button = document.getElementById("save-button");
    button.disabled = true;
    setSaveState("A guardar…");
    try {
      var response = await fetch(boot.endpoint + "?action=save", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-CSRF": state.csrf
        },
        body: JSON.stringify({
          preset: state.preset,
          revision: state.revision
        })
      });
      var data = await response.json();
      if (!response.ok || !data.ok) { throw new Error(data.message || "Não foi possível guardar o preset."); }
      state.revision = data.revision;
      state.saved = clone(state.preset);
      state.dirty = false;
      state.history = [];
      document.getElementById("undo-button").disabled = true;
      setSaveState("Guardado", "is-ok");
      toast("Preset A6 guardado.");
    } catch (error) {
      button.disabled = false;
      setSaveState("Erro ao guardar", "is-error");
      toast(error.message, true);
    }
  }

  function undo() {
    if (!state.history.length) { return; }
    state.preset = JSON.parse(state.history.pop());
    state.dirty = JSON.stringify(state.preset) !== JSON.stringify(state.saved);
    renderControls();
    renderAssetManager();
    document.getElementById("save-button").disabled = !state.dirty;
    document.getElementById("undo-button").disabled = state.history.length === 0;
    setSaveState(state.dirty ? "Por guardar" : "Guardado", state.dirty ? "is-dirty" : "is-ok");
    scheduleRender();
  }

  async function loadCover(file) {
    if (!file || !file.type.startsWith("image/")) {
      toast("Escolhe uma imagem válida para a capa.", true);
      return;
    }
    var bitmap = await createImageBitmap(file);
    if (state.coverBitmap) { state.coverBitmap.close(); }
    state.coverBitmap = bitmap;
    renderer.setCoverImage(bitmap);
    document.getElementById("cover-file-name").textContent = file.name + " · " + bitmap.width + " × " + bitmap.height + " px";
    document.getElementById("clear-cover").disabled = false;
    scheduleRender();
  }

  function clearCover() {
    if (state.coverBitmap) { state.coverBitmap.close(); }
    state.coverBitmap = null;
    renderer.setCoverImage(null);
    document.getElementById("cover-file").value = "";
    document.getElementById("cover-file-name").textContent = "Ainda não carregada. A imagem fica apenas neste browser.";
    document.getElementById("clear-cover").disabled = true;
    scheduleRender();
  }

  function exportCanvas(type) {
    var extension = "png";
    canvas.toBlob(function (blob) {
      if (!blob) { toast("Não foi possível exportar a imagem.", true); return; }
      var url = URL.createObjectURL(blob);
      var anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "mockup-" + state.preset.id + "." + extension;
      anchor.click();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }, type, .96);
  }

  function bindTabs() {
    document.querySelectorAll(".editor-tabs button").forEach(function (button) {
      button.addEventListener("click", function () {
        document.querySelectorAll(".editor-tabs button").forEach(function (item) { item.classList.remove("is-active"); });
        document.querySelectorAll(".tab-panel").forEach(function (panel) { panel.classList.remove("is-active"); });
        button.classList.add("is-active");
        document.querySelector('[data-panel="' + button.dataset.tab + '"]').classList.add("is-active");
      });
    });
  }

  function bindCoverDrop() {
    var zone = document.getElementById("cover-drop-zone");
    ["dragenter", "dragover"].forEach(function (eventName) {
      zone.addEventListener(eventName, function (event) { event.preventDefault(); zone.classList.add("is-dragging"); });
    });
    ["dragleave", "drop"].forEach(function (eventName) {
      zone.addEventListener(eventName, function (event) { event.preventDefault(); zone.classList.remove("is-dragging"); });
    });
    zone.addEventListener("drop", function (event) {
      var file = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files[0] : null;
      loadCover(file).catch(function (error) { toast(error.message, true); });
    });
  }

  document.getElementById("save-button").addEventListener("click", savePreset);
  document.getElementById("undo-button").addEventListener("click", undo);
  document.getElementById("cover-file").addEventListener("change", function (event) {
    loadCover(event.target.files[0]).catch(function (error) { toast(error.message, true); });
  });
  document.getElementById("clear-cover").addEventListener("click", clearCover);
  document.getElementById("guides-toggle").addEventListener("change", function (event) {
    renderer.setGuides(event.target.checked);
    scheduleRender();
  });
  document.getElementById("export-png").addEventListener("click", function () { exportCanvas("image/png"); });
  window.addEventListener("beforeunload", function (event) {
    if (!state.dirty) { return; }
    event.preventDefault();
    event.returnValue = "";
  });

  bindTabs();
  bindCoverDrop();
  apiLoad().catch(function (error) {
    setSaveState("Erro ao abrir", "is-error");
    toast(error.message, true);
  });
}());
