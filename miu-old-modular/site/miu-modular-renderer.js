/**
 * MIU_MODULAR_RENDERER_EXPERIMENTAL_V1
 *
 * Renderer Canvas autónomo para o laboratório modular do Míu. Não é carregado
 * por nenhuma página pública e não altera o renderer actual de site/js/24-miu.js.
 */
(function (global) {
  "use strict";

  var DEFAULT_LAYER_ORDER = ["ears", "base", "eyes", "brows", "mouth", "whiskers", "paws", "effects", "props"];

  function fetchJson(url) {
    return fetch(url, { credentials: "same-origin", cache: "no-store" }).then(function (response) {
      if (!response.ok) {
        throw new Error("Não foi possível carregar " + url + " (HTTP " + response.status + ").");
      }
      return response.json();
    });
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.decoding = "async";
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error("Não foi possível carregar a imagem " + url + ".")); };
      image.src = url;
    });
  }

  function absoluteUrl(path, base) {
    return new URL(path, base).href;
  }

  function copyObject(source) {
    var result = {};
    Object.keys(source || {}).forEach(function (key) { result[key] = source[key]; });
    return result;
  }

  function mergeObjects() {
    var result = {};
    Array.prototype.forEach.call(arguments, function (source) {
      Object.keys(source || {}).forEach(function (key) { result[key] = source[key]; });
    });
    return result;
  }

  function listValue(value) {
    if (Array.isArray(value)) { return value.slice(); }
    if (typeof value === "string" && value) { return [value]; }
    return [];
  }

  function positiveNumber(value, fallback) {
    value = Number(value);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function scanAlphaBounds(data, width, height) {
    var minX = width;
    var minY = height;
    var maxX = -1;
    var maxY = -1;
    var x;
    var y;
    var offset;

    for (y = 0; y < height; y += 1) {
      for (x = 0; x < width; x += 1) {
        offset = ((y * width) + x) * 4 + 3;
        if (data[offset] > 2) {
          if (x < minX) { minX = x; }
          if (x > maxX) { maxX = x; }
          if (y < minY) { minY = y; }
          if (y > maxY) { maxY = y; }
        }
      }
    }

    if (maxX < minX || maxY < minY) { return null; }
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  function MiuModularRenderer(canvas, options) {
    if (!canvas || typeof canvas.getContext !== "function") {
      throw new Error("O renderer modular precisa de um elemento canvas.");
    }

    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
    this.options = options || {};
    this.logicalWidth = 128;
    this.logicalHeight = 128;
    this.layerOrder = DEFAULT_LAYER_ORDER.slice();
    this.parts = {};
    this.images = {};
    this.atlases = [];
    this.config = null;
    this.configUrl = "";
    this.animationMap = {};
    this.currentAnimation = null;
    this.staticStateId = "";
    this.frameIndex = 0;
    this.elapsedMs = 0;
    this.speed = 1;
    this.loop = true;
    this.playing = false;
    this.showBounds = false;
    this.showLayers = false;
    this._lastTimestamp = 0;
    this._raf = 0;
    this._lastResolvedFrame = null;
    this.onRender = typeof this.options.onRender === "function" ? this.options.onRender : function () {};
    this.onPlayState = typeof this.options.onPlayState === "function" ? this.options.onPlayState : function () {};
    this.boundsColor = this.options.boundsColor || "rgba(114, 85, 30, .9)";
    this.layerColors = this.options.layerColors || {
      ears: "rgba(197, 138, 114, .9)",
      base: "rgba(114, 85, 30, .9)",
      eyes: "rgba(215, 170, 54, .95)",
      brows: "rgba(181, 132, 50, .95)",
      mouth: "rgba(154, 134, 86, .95)",
      whiskers: "rgba(111, 98, 75, .9)",
      paws: "rgba(180, 126, 96, .9)",
      effects: "rgba(199, 68, 56, .9)",
      props: "rgba(127, 107, 66, .95)"
    };
  }

  MiuModularRenderer.prototype.load = function (animationConfigUrl) {
    var renderer = this;
    renderer.configUrl = absoluteUrl(animationConfigUrl, window.location.href);

    return fetchJson(renderer.configUrl).then(function (config) {
      var atlasPaths;
      if (!config || config.schemaVersion !== 1 || !Array.isArray(config.atlases) || !config.atlases.length) {
        throw new Error("O manifesto de animações modular não é compatível.");
      }
      renderer.config = config;
      renderer.animationMap = {};
      (config.animations || []).forEach(function (animation) {
        if (animation && animation.id) { renderer.animationMap[animation.id] = animation; }
      });
      atlasPaths = config.atlases.map(function (path) { return absoluteUrl(path, renderer.configUrl); });
      return Promise.all(atlasPaths.map(function (url) {
        return fetchJson(url).then(function (atlas) { return { atlas: atlas, url: url }; });
      }));
    }).then(function (atlasEntries) {
      var sheetLoads = [];
      renderer.atlases = atlasEntries;
      renderer.parts = {};
      renderer.images = {};

      atlasEntries.forEach(function (entry) {
        var atlas = entry.atlas;
        if (!atlas || atlas.schemaVersion !== 1 || !atlas.grid || !atlas.parts) {
          throw new Error("O atlas " + entry.url + " não é compatível.");
        }
        if (atlas.grid.cellWidth !== atlas.grid.cellHeight) {
          throw new Error("O renderer experimental exige células quadradas.");
        }
        renderer.logicalWidth = atlas.coordinateSystem && atlas.coordinateSystem.logicalWidth
          ? atlas.coordinateSystem.logicalWidth : atlas.grid.cellWidth;
        renderer.logicalHeight = atlas.coordinateSystem && atlas.coordinateSystem.logicalHeight
          ? atlas.coordinateSystem.logicalHeight : atlas.grid.cellHeight;
        if (Array.isArray(atlas.layerOrder) && atlas.layerOrder.length) {
          renderer.layerOrder = atlas.layerOrder.slice();
        }

        (atlas.sheets || []).forEach(function (sheet) {
          var sheetKey = atlas.id + "::" + sheet.id;
          var sheetUrl = absoluteUrl(sheet.file, entry.url);
          if (renderer.images[sheetKey]) {
            throw new Error("Identificador de sheet repetido: " + sheetKey + ".");
          }
          renderer.images[sheetKey] = { image: null, url: sheetUrl, meta: sheet };
          sheetLoads.push(loadImage(sheetUrl).then(function (image) {
            if (image.naturalWidth !== sheet.width || image.naturalHeight !== sheet.height) {
              throw new Error("A dimensão real de " + sheet.file + " não coincide com o manifesto.");
            }
            renderer.images[sheetKey].image = image;
          }));
        });

        Object.keys(atlas.parts).forEach(function (groupId) {
          Object.keys(atlas.parts[groupId] || {}).forEach(function (partId) {
            var source = atlas.parts[groupId][partId];
            var fullId = groupId + "." + partId;
            var part;
            if (renderer.parts[fullId]) {
              throw new Error("Peça modular repetida: " + fullId + ".");
            }
            part = copyObject(source);
            part.id = fullId;
            part.group = groupId;
            part.cell = Array.isArray(part.cell) ? part.cell.slice(0, 2) : [];
            part.cellWidth = atlas.grid.cellWidth;
            part.cellHeight = atlas.grid.cellHeight;
            part.sourceX = Number(part.cell[1]) * atlas.grid.cellWidth;
            part.sourceY = Number(part.cell[0]) * atlas.grid.cellHeight;
            part.sheetKey = atlas.id + "::" + part.sheet;
            renderer.parts[fullId] = part;
          });
        });
      });

      return Promise.all(sheetLoads);
    }).then(function () {
      renderer._measurePartBounds();
      renderer.setAnimation(renderer.config.defaultAnimationId, false);
      return renderer;
    });
  };

  MiuModularRenderer.prototype._measurePartBounds = function () {
    var renderer = this;
    var work = document.createElement("canvas");
    var context;
    work.width = renderer.logicalWidth;
    work.height = renderer.logicalHeight;
    context = work.getContext("2d", { alpha: true, willReadFrequently: true });

    Object.keys(renderer.parts).forEach(function (partId) {
      var part = renderer.parts[partId];
      var sheet = renderer.images[part.sheetKey];
      var pixels;
      context.clearRect(0, 0, work.width, work.height);
      context.drawImage(
        sheet.image,
        part.sourceX,
        part.sourceY,
        part.cellWidth,
        part.cellHeight,
        0,
        0,
        renderer.logicalWidth,
        renderer.logicalHeight
      );
      pixels = context.getImageData(0, 0, work.width, work.height);
      part.contentBounds = scanAlphaBounds(pixels.data, pixels.width, pixels.height);
    });
  };

  MiuModularRenderer.prototype._state = function (stateId) {
    var state = this.config && this.config.states ? this.config.states[stateId] : null;
    if (!state) { throw new Error("Estado modular desconhecido: " + stateId + "."); }
    return state;
  };

  MiuModularRenderer.prototype._resolveFrame = function () {
    var animation = this.currentAnimation;
    var frame;
    var state;
    var layers;
    var transform;

    if (!animation) {
      state = this._state(this.staticStateId || this.config.defaultStateId);
      return {
        animation: null,
        frameIndex: 0,
        frameCount: 1,
        durationMs: 0,
        stateId: this.staticStateId || this.config.defaultStateId,
        state: state,
        layers: copyObject(state.layers),
        transform: copyObject(state.transform)
      };
    }

    frame = animation.frames[this.frameIndex] || animation.frames[0];
    state = this._state(frame.state);
    layers = mergeObjects(state.layers, frame.layers);
    transform = mergeObjects(animation.transform, state.transform, frame.transform);
    return {
      animation: animation,
      frameIndex: this.frameIndex,
      frameCount: animation.frames.length,
      durationMs: positiveNumber(frame.durationMs, 180),
      stateId: frame.state,
      state: state,
      layers: layers,
      transform: transform
    };
  };

  MiuModularRenderer.prototype._partIdsForLayers = function (layers) {
    var renderer = this;
    var ids = [];
    renderer.layerOrder.forEach(function (layerName) {
      listValue(layers[layerName]).forEach(function (partId) {
        if (!renderer.parts[partId]) {
          throw new Error("A animação refere uma peça inexistente: " + partId + ".");
        }
        ids.push(partId);
      });
    });
    return ids;
  };

  MiuModularRenderer.prototype._applyTransform = function (context, transform) {
    var centreX = this.logicalWidth / 2;
    var centreY = this.logicalHeight / 2;
    var x = Number(transform.x) || 0;
    var y = Number(transform.y) || 0;
    var rotation = (Number(transform.rotation) || 0) * Math.PI / 180;
    var scale = positiveNumber(transform.scale, 1);
    var scaleX = transform.flipX ? -scale : scale;
    var scaleY = transform.flipY ? -scale : scale;

    context.translate(centreX + x, centreY + y);
    if (rotation) { context.rotate(rotation); }
    context.scale(scaleX, scaleY);
    context.translate(-centreX, -centreY);
  };

  MiuModularRenderer.prototype._drawParts = function (context, partIds) {
    var renderer = this;
    partIds.forEach(function (partId) {
      var part = renderer.parts[partId];
      var sheet = renderer.images[part.sheetKey];
      context.drawImage(
        sheet.image,
        part.sourceX,
        part.sourceY,
        part.cellWidth,
        part.cellHeight,
        0,
        0,
        renderer.logicalWidth,
        renderer.logicalHeight
      );
    });
  };

  MiuModularRenderer.prototype._drawLayerGuides = function (context, partIds) {
    var renderer = this;
    var lineWidth = Math.max(0.75, renderer.logicalWidth / renderer.canvas.width * 1.5);
    partIds.forEach(function (partId) {
      var part = renderer.parts[partId];
      var bounds = part.contentBounds;
      if (!bounds) { return; }
      context.save();
      context.strokeStyle = renderer.layerColors[part.layer] || renderer.boundsColor;
      context.lineWidth = lineWidth;
      context.setLineDash([3, 2]);
      context.strokeRect(bounds.x + 0.5, bounds.y + 0.5, Math.max(1, bounds.width - 1), Math.max(1, bounds.height - 1));
      context.restore();
    });
  };

  MiuModularRenderer.prototype._canvasBounds = function () {
    var pixels = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    return scanAlphaBounds(pixels.data, pixels.width, pixels.height);
  };

  MiuModularRenderer.prototype.render = function () {
    var resolved = this._resolveFrame();
    var context = this.context;
    var scaleX = this.canvas.width / this.logicalWidth;
    var scaleY = this.canvas.height / this.logicalHeight;
    var partIds = this._partIdsForLayers(resolved.layers);
    var aggregateBounds;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.save();
    context.scale(scaleX, scaleY);
    this._applyTransform(context, resolved.transform || {});
    this._drawParts(context, partIds);
    context.restore();

    if (this.showBounds) {
      aggregateBounds = this._canvasBounds();
    }

    if (this.showLayers) {
      context.save();
      context.scale(scaleX, scaleY);
      this._applyTransform(context, resolved.transform || {});
      this._drawLayerGuides(context, partIds);
      context.restore();
    }

    if (aggregateBounds) {
      context.save();
      context.strokeStyle = this.boundsColor;
      context.lineWidth = Math.max(1, this.canvas.width / 128);
      context.setLineDash([6, 4]);
      context.strokeRect(
        aggregateBounds.x + 0.5,
        aggregateBounds.y + 0.5,
        Math.max(1, aggregateBounds.width - 1),
        Math.max(1, aggregateBounds.height - 1)
      );
      context.restore();
    }

    this._lastResolvedFrame = resolved;
    this.onRender({
      animationId: resolved.animation ? resolved.animation.id : "",
      animationName: resolved.animation ? resolved.animation.name : "Estado fixo",
      stateId: resolved.stateId,
      stateName: resolved.state.name,
      frameIndex: resolved.frameIndex,
      frameCount: resolved.frameCount,
      durationMs: resolved.durationMs,
      elapsedMs: this.elapsedMs,
      playing: this.playing,
      loop: this.loop,
      speed: this.speed,
      parts: partIds.slice()
    });
  };

  MiuModularRenderer.prototype._advance = function (deltaMs) {
    var animation = this.currentAnimation;
    var frame;
    var duration;
    if (!animation || !this.playing) { return; }

    this.elapsedMs += deltaMs * this.speed;
    frame = animation.frames[this.frameIndex] || animation.frames[0];
    duration = positiveNumber(frame.durationMs, 180);

    while (this.elapsedMs >= duration && this.playing) {
      this.elapsedMs -= duration;
      if (this.frameIndex + 1 < animation.frames.length) {
        this.frameIndex += 1;
      } else if (this.loop) {
        this.frameIndex = 0;
      } else {
        this.frameIndex = animation.frames.length - 1;
        this.elapsedMs = positiveNumber(animation.frames[this.frameIndex].durationMs, 180);
        this.playing = false;
        this.onPlayState(false);
      }
      frame = animation.frames[this.frameIndex] || animation.frames[0];
      duration = positiveNumber(frame.durationMs, 180);
    }
  };

  MiuModularRenderer.prototype._tick = function (timestamp) {
    var renderer = this;
    var delta;
    if (!renderer.playing) {
      renderer._lastTimestamp = 0;
      renderer._raf = 0;
      renderer.render();
      return;
    }
    if (!renderer._lastTimestamp) { renderer._lastTimestamp = timestamp; }
    delta = Math.min(100, Math.max(0, timestamp - renderer._lastTimestamp));
    renderer._lastTimestamp = timestamp;
    renderer._advance(delta);
    renderer.render();
    if (renderer.playing) {
      renderer._raf = requestAnimationFrame(function (nextTimestamp) { renderer._tick(nextTimestamp); });
    } else {
      renderer._raf = 0;
    }
  };

  MiuModularRenderer.prototype._ensureTick = function () {
    var renderer = this;
    if (renderer._raf || !renderer.playing) { return; }
    renderer._raf = requestAnimationFrame(function (timestamp) { renderer._tick(timestamp); });
  };

  MiuModularRenderer.prototype.setAnimation = function (animationId, autoplay) {
    var animation = this.animationMap[animationId];
    if (!animation) { throw new Error("Animação modular desconhecida: " + animationId + "."); }
    this.currentAnimation = animation;
    this.staticStateId = "";
    this.frameIndex = 0;
    this.elapsedMs = 0;
    this.loop = animation.loop !== false;
    this.playing = autoplay !== false;
    this._lastTimestamp = 0;
    this.render();
    this.onPlayState(this.playing);
    this._ensureTick();
  };

  MiuModularRenderer.prototype.setState = function (stateId) {
    this._state(stateId);
    this.pause();
    this.currentAnimation = null;
    this.staticStateId = stateId;
    this.frameIndex = 0;
    this.elapsedMs = 0;
    this.render();
  };

  MiuModularRenderer.prototype.play = function () {
    if (!this.currentAnimation) {
      this.setAnimation(this.config.defaultAnimationId, true);
      return;
    }
    this.playing = true;
    this._lastTimestamp = 0;
    this.onPlayState(true);
    this._ensureTick();
  };

  MiuModularRenderer.prototype.pause = function () {
    this.playing = false;
    this._lastTimestamp = 0;
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
    this.onPlayState(false);
    if (this.config) { this.render(); }
  };

  MiuModularRenderer.prototype.replay = function () {
    if (!this.currentAnimation) {
      this.setAnimation(this.config.defaultAnimationId, true);
      return;
    }
    this.frameIndex = 0;
    this.elapsedMs = 0;
    this.playing = true;
    this._lastTimestamp = 0;
    this.render();
    this.onPlayState(true);
    this._ensureTick();
  };

  MiuModularRenderer.prototype.setLoop = function (loop) {
    this.loop = Boolean(loop);
    if (this.config) { this.render(); }
  };

  MiuModularRenderer.prototype.setSpeed = function (speed) {
    this.speed = Math.max(0.1, Math.min(4, positiveNumber(speed, 1)));
    if (this.config) { this.render(); }
  };

  MiuModularRenderer.prototype.setShowBounds = function (show) {
    this.showBounds = Boolean(show);
    if (this.config) { this.render(); }
  };

  MiuModularRenderer.prototype.setShowLayers = function (show) {
    this.showLayers = Boolean(show);
    if (this.config) { this.render(); }
  };

  MiuModularRenderer.prototype.getAnimations = function () {
    return this.config ? (this.config.animations || []).slice() : [];
  };

  MiuModularRenderer.prototype.getStates = function () {
    return this.config ? copyObject(this.config.states) : {};
  };

  MiuModularRenderer.prototype.getCurrentSource = function (sourceId) {
    return this.config && this.config.currentSources ? this.config.currentSources[sourceId] : null;
  };

  MiuModularRenderer.prototype.destroy = function () {
    this.pause();
    this.parts = {};
    this.images = {};
    this.config = null;
  };

  global.MiuModularRenderer = MiuModularRenderer;
}(window));
