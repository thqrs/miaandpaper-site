import { CORNER_KEYS, MockupDefinition } from "./mockup-definition.js";

function getPath(object, path) {
  return path.split(".").reduce((value, key) => value && value[key], object);
}

function setPath(object, path, value) {
  const keys = path.split(".");
  const final = keys.pop();
  const parent = keys.reduce((value, key) => value[key], object);
  parent[final] = value;
}

function readFile(file, mode = "dataUrl") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}.`));
    reader.onload = () => resolve(reader.result);
    if (mode === "text") reader.readAsText(file); else reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  if (!dataUrl) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("A imagem não pôde ser aberta."));
    image.src = dataUrl;
  });
}

function downloadJson(value, filename) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class MockupEditor {
  constructor(root, renderer, exportRenderer) {
    this.root = root;
    this.renderer = renderer;
    this.exportRenderer = exportRenderer;
    this.preview = root.querySelector("[data-preview]");
    this.canvasWrap = root.querySelector("[data-canvas-wrap]");
    this.handles = root.querySelector("[data-handles]");
    this.status = root.querySelector("[data-status]");
    this.definition = MockupDefinition.create("a6-front");
    this.assets = { baseImage: null, coverImage: null };
    this.renderQueued = false;
    this.dragging = null;
  }

  async start() {
    this.bind();
    await this.applyDefinition(this.definition);
    this.refreshSavedMasters();
    this.setStatus("Carrega uma imagem base e uma capa para começar.");
  }

  bind() {
    this.root.querySelectorAll("[data-field]").forEach((field) => {
      field.addEventListener("input", () => this.onField(field));
      field.addEventListener("change", () => this.onField(field));
    });
    this.root.querySelectorAll("[data-corner]").forEach((field) => field.addEventListener("input", () => {
      const point = this.definition.cover.corners[field.dataset.corner];
      point[Number(field.dataset.axis)] = Number(field.value);
      this.definition = MockupDefinition.normalize(this.definition);
      this.sync(false);
    }));

    this.root.querySelector("[data-base-input]").addEventListener("change", (event) => this.onBase(event.target.files[0]));
    this.root.querySelector("[data-cover-input]").addEventListener("change", (event) => this.onCover(event.target.files[0]));
    this.root.querySelector("[data-edit-master]").addEventListener("change", (event) => { this.handles.hidden = !event.target.checked; });
    this.root.querySelector("[data-save-master]").addEventListener("click", () => this.saveMaster());
    this.root.querySelector("[data-download-master]").addEventListener("click", () => downloadJson(this.definition, `${this.definition.id}.mockup.json`));
    this.root.querySelector("[data-import-master]").addEventListener("change", (event) => this.importMaster(event.target.files[0]));
    this.root.querySelector("[data-saved-masters]").addEventListener("change", (event) => this.loadSavedMaster(event.target.value));
    this.root.querySelector("[data-export-png]").addEventListener("click", () => this.exportPng());

    this.handles.querySelectorAll("[data-handle]").forEach((handle) => {
      handle.addEventListener("pointerdown", (event) => {
        this.dragging = handle.dataset.handle;
        event.preventDefault();
      });
    });
    window.addEventListener("pointermove", (event) => this.dragHandle(event));
    window.addEventListener("pointerup", () => { this.dragging = null; });
    window.addEventListener("pointercancel", () => { this.dragging = null; });
  }

  onField(field) {
    const path = field.dataset.field;
    if (path === "preset") {
      if (field.value) this.applyDefinition(MockupDefinition.create(field.value));
      return;
    }
    const current = getPath(this.definition, path);
    const value = field.tagName === "SELECT" || typeof current === "string" ? field.value : Number(field.value);
    setPath(this.definition, path, value);
    if (path === "name") this.definition.id = String(value || "mockup").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    this.definition = MockupDefinition.normalize(this.definition);
    this.sync();
  }

  async onBase(file) {
    if (!file) return;
    try {
      const dataUrl = await readFile(file);
      const image = await loadImage(dataUrl);
      const oldWidth = this.definition.canvasWidth;
      const oldHeight = this.definition.canvasHeight;
      const scaleX = image.naturalWidth / oldWidth;
      const scaleY = image.naturalHeight / oldHeight;
      CORNER_KEYS.forEach((key) => {
        this.definition.cover.corners[key][0] *= scaleX;
        this.definition.cover.corners[key][1] *= scaleY;
      });
      this.definition.canvasWidth = image.naturalWidth;
      this.definition.canvasHeight = image.naturalHeight;
      this.definition.baseImage = { dataUrl, name: file.name };
      this.assets.baseImage = image;
      this.definition = MockupDefinition.normalize(this.definition);
      this.sync();
      this.setStatus(`Base ${file.name} carregada; o canvas acompanha a resolução original.`);
    } catch (error) { this.setStatus(error.message, true); }
  }

  async onCover(file) {
    if (!file) return;
    try {
      const dataUrl = await readFile(file);
      this.assets.coverImage = await loadImage(dataUrl);
      this.queueRender();
      this.setStatus(`Capa ${file.name} aplicada sem alterar o master.`);
    } catch (error) { this.setStatus(error.message, true); }
  }

  dragHandle(event) {
    if (!this.dragging) return;
    const rect = this.preview.getBoundingClientRect();
    const x = (event.clientX - rect.left) * this.definition.canvasWidth / rect.width;
    const y = (event.clientY - rect.top) * this.definition.canvasHeight / rect.height;
    this.definition.cover.corners[this.dragging] = [
      Math.max(0, Math.min(this.definition.canvasWidth, x)),
      Math.max(0, Math.min(this.definition.canvasHeight, y))
    ];
    this.sync(false);
  }

  async applyDefinition(definition) {
    this.definition = MockupDefinition.normalize(definition);
    try { this.assets.baseImage = await loadImage(this.definition.baseImage.dataUrl); }
    catch (error) { this.assets.baseImage = null; this.setStatus(error.message, true); }
    this.sync();
  }

  sync(updateFields = true) {
    MockupDefinition.updateMargins(this.definition);
    if (updateFields) {
      this.root.querySelectorAll("[data-field]").forEach((field) => {
        if (field.dataset.field === "preset") return;
        const value = getPath(this.definition, field.dataset.field);
        if (value !== undefined && document.activeElement !== field) field.value = value;
      });
    }
    this.root.querySelectorAll("[data-corner]").forEach((field) => {
      if (document.activeElement !== field) field.value = Math.round(this.definition.cover.corners[field.dataset.corner][Number(field.dataset.axis)] * 10) / 10;
    });
    this.root.querySelector("[data-ring-count]").value = `${this.definition.binding.holeCount} (automática)`;
    this.root.querySelector("[data-top-margin]").value = `${this.definition.binding.topMarginMm.toFixed(1)} mm`;
    this.root.querySelector("[data-bottom-margin]").value = `${this.definition.binding.bottomMarginMm.toFixed(1)} mm`;
    this.root.querySelector("[data-counter]").textContent = `${this.definition.binding.holeCount} buracos · ${this.definition.binding.holeCount} argolas`;
    this.root.querySelector("[data-canvas-size]").textContent = `${this.definition.canvasWidth} × ${this.definition.canvasHeight} px`;
    this.canvasWrap.style.setProperty("--mockup-aspect", this.definition.canvasWidth / this.definition.canvasHeight);
    this.updateHandles();
    this.queueRender();
  }

  updateHandles() {
    const corners = this.definition.cover.corners;
    this.handles.setAttribute("viewBox", `0 0 ${this.definition.canvasWidth} ${this.definition.canvasHeight}`);
    this.handles.querySelector("[data-cover-polygon]").setAttribute("points", CORNER_KEYS.map((key) => corners[key].join(",")).join(" "));
    CORNER_KEYS.forEach((key) => this.handles.querySelector(`[data-handle="${key}"]`).setAttribute("transform", `translate(${corners[key][0]} ${corners[key][1]})`));
  }

  queueRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      const previewScale = Math.min(1, 1600 / Math.max(this.definition.canvasWidth, this.definition.canvasHeight));
      const width = Math.max(2, Math.round(this.definition.canvasWidth * previewScale));
      const height = Math.max(2, Math.round(this.definition.canvasHeight * previewScale));
      try { this.renderer.render(this.preview, this.definition, this.assets, width, height); }
      catch (error) { this.setStatus(error.message, true); }
    });
  }

  saveMaster() {
    try {
      const definitions = JSON.parse(localStorage.getItem("mia_mockup_masters_v1") || "{}");
      definitions[this.definition.id] = this.definition;
      localStorage.setItem("mia_mockup_masters_v1", JSON.stringify(definitions));
      this.refreshSavedMasters(this.definition.id);
      this.setStatus(`Master “${this.definition.name}” guardado neste browser.`);
    } catch (error) {
      this.setStatus("O master é demasiado grande para o armazenamento do browser. Descarrega o JSON para o guardar.", true);
    }
  }

  refreshSavedMasters(selected = "") {
    const select = this.root.querySelector("[data-saved-masters]");
    const definitions = JSON.parse(localStorage.getItem("mia_mockup_masters_v1") || "{}");
    select.innerHTML = '<option value="">Escolher…</option>' + Object.keys(definitions).map((id) => `<option value="${id}">${definitions[id].name || id}</option>`).join("");
    select.value = selected;
  }

  async loadSavedMaster(id) {
    if (!id) return;
    const definitions = JSON.parse(localStorage.getItem("mia_mockup_masters_v1") || "{}");
    if (definitions[id]) {
      await this.applyDefinition(definitions[id]);
      this.setStatus(`Master “${this.definition.name}” carregado. A capa actual foi mantida.`);
    }
  }

  async importMaster(file) {
    if (!file) return;
    try {
      const data = JSON.parse(await readFile(file, "text"));
      await this.applyDefinition(data);
      this.setStatus(`Master ${file.name} importado; guarda-o se quiseres mantê-lo neste browser.`);
    } catch (error) { this.setStatus(`JSON inválido: ${error.message}`, true); }
  }

  async exportPng() {
    const width = Number(this.root.querySelector("[data-export-width]").value);
    const height = Number(this.root.querySelector("[data-export-height]").value);
    try {
      this.setStatus("A preparar o PNG em alta resolução…");
      await this.exportRenderer.exportPng(this.definition, this.assets, width, height);
      this.setStatus(`PNG exportado a ${width} × ${height} px.`);
    } catch (error) { this.setStatus(error.message, true); }
  }

  setStatus(message, error = false) {
    this.status.textContent = message;
    this.status.classList.toggle("is-error", error);
  }
}
