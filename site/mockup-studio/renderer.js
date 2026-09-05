(function () {
  "use strict";

  function roundedRectPath(ctx, x, y, width, height, radius) {
    var r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function holePositions(preset) {
    var holes = preset.holes;
    if (Array.isArray(holes.positionsY) && holes.positionsY.length) {
      return holes.positionsY.slice(0, holes.count);
    }
    return Array.from({ length: holes.count }, function (_, index) {
      return holes.firstY + holes.pitch * index;
    });
  }

  function coverMask(ctx, preset) {
    var cover = preset.cover;
    var holes = preset.holes;
    ctx.beginPath();
    roundedRectPath(ctx, cover.x, cover.y, cover.width, cover.height, cover.cornerRadius);
    holePositions(preset).forEach(function (y) {
      ctx.rect(holes.x, y, holes.width, holes.height);
    });
    ctx.clip("evenodd");
  }

  function MockupRenderer(canvas, baseUrl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.baseUrl = String(baseUrl || "").replace(/\/?$/, "/");
    this.cache = new Map();
    this.coverImage = null;
    this.guides = false;
    this.cacheVersion = "";
    this.renderSequence = 0;
  }

  MockupRenderer.prototype.setCoverImage = function (image) {
    this.coverImage = image || null;
  };

  MockupRenderer.prototype.setGuides = function (enabled) {
    this.guides = Boolean(enabled);
  };

  MockupRenderer.prototype.invalidateAsset = function (path) {
    var prefix = this.baseUrl + path;
    Array.from(this.cache.keys()).forEach(function (key) {
      if (key.indexOf(prefix) === 0) { this.cache.delete(key); }
    }, this);
    this.cacheVersion = Date.now().toString(36);
  };

  MockupRenderer.prototype.assetUrl = function (preset, assetKey) {
    var entry = preset.assets[assetKey];
    if (!entry) { throw new Error("Asset desconhecido: " + assetKey); }
    var version = this.cacheVersion || preset.assetVersion || "";
    return this.baseUrl + entry.path + (version ? "?v=" + version : "");
  };

  MockupRenderer.prototype.load = function (preset, assetKey) {
    var url = this.assetUrl(preset, assetKey);
    if (this.cache.has(url)) { return this.cache.get(url); }
    var promise = new Promise(function (resolve, reject) {
      var image = new Image();
      image.decoding = "async";
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error("Não foi possível carregar " + assetKey)); };
      image.src = url;
    });
    this.cache.set(url, promise);
    return promise;
  };

  MockupRenderer.prototype.preload = async function (preset) {
    var keys = Object.keys(preset.assets || {});
    await Promise.all(keys.map(function (key) { return this.load(preset, key); }, this));
  };

  MockupRenderer.prototype.drawAsset = async function (preset, assetKey, options) {
    var image = await this.load(preset, assetKey);
    var ctx = this.ctx;
    var opt = options || {};
    var width = opt.width == null ? image.naturalWidth * (opt.scale || 1) : opt.width;
    var height = opt.height == null
      ? image.naturalHeight * (opt.scale || 1)
      : opt.height;
    ctx.save();
    ctx.globalAlpha = opt.opacity == null ? 1 : opt.opacity;
    ctx.globalCompositeOperation = opt.blendMode || "source-over";
    ctx.drawImage(image, opt.x || 0, opt.y || 0, width, height);
    ctx.restore();
  };

  MockupRenderer.prototype.drawAssetFrame = async function (preset, assetKey, options) {
    var image = await this.load(preset, assetKey);
    var ctx = this.ctx;
    var opt = options || {};
    ctx.save();
    ctx.globalAlpha = opt.opacity == null ? 1 : opt.opacity;
    ctx.globalCompositeOperation = opt.blendMode || "source-over";
    ctx.drawImage(
      image,
      opt.sourceX || 0,
      opt.sourceY || 0,
      opt.sourceWidth,
      opt.sourceHeight || image.naturalHeight,
      opt.x || 0,
      opt.y || 0,
      opt.width,
      opt.height
    );
    ctx.restore();
  };

  MockupRenderer.prototype.drawCover = function (preset) {
    var ctx = this.ctx;
    var cover = preset.cover;
    ctx.save();
    coverMask(ctx, preset);
    ctx.fillStyle = cover.placeholderColor || "#eee4d3";
    ctx.fillRect(cover.x, cover.y, cover.width, cover.height);

    if (this.coverImage) {
      var image = this.coverImage;
      var iw = image.naturalWidth || image.width;
      var ih = image.naturalHeight || image.height;
      var zoom = Math.max(0.05, Number(cover.artZoom) || 1);
      var scale = Math.max(cover.width / iw, cover.height / ih) * zoom;
      var width = iw * scale;
      var height = ih * scale;
      var x = cover.x + (cover.width - width) / 2 + (Number(cover.artX) || 0);
      var y = cover.y + (cover.height - height) / 2 + (Number(cover.artY) || 0);
      ctx.drawImage(image, x, y, width, height);
    } else {
      var centreX = cover.x + cover.width / 2;
      var centreY = cover.y + cover.height / 2;
      ctx.strokeStyle = "rgba(87, 94, 73, .28)";
      ctx.lineWidth = 3;
      ctx.setLineDash([13, 12]);
      ctx.strokeRect(cover.x + 76, cover.y + 96, cover.width - 152, cover.height - 192);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(64, 73, 56, .68)";
      ctx.textAlign = "center";
      ctx.font = "600 30px system-ui, sans-serif";
      ctx.fillText("Carrega a arte da capa", centreX, centreY - 6);
      ctx.fillStyle = "rgba(64, 73, 56, .48)";
      ctx.font = "400 19px system-ui, sans-serif";
      ctx.fillText("crop automático · zoom · reposição", centreX, centreY + 34);
    }
    ctx.restore();
  };

  MockupRenderer.prototype.drawRings = async function (preset, part) {
    var rings = preset.rings;
    var style = rings.styles[rings.style];
    var atlas = rings.atlases && rings.atlases[String(preset.holes.count)];
    if (rings.mode === "atlas" && atlas) {
      var frameWidth = atlas.frameWidth || rings.frameWidth;
      var gap = atlas.gap == null ? rings.atlasGap : atlas.gap;
      var image = await this.load(preset, atlas[part]);
      var frame = Number(style.frame) || 0;
      var opacityAtlas = part === "front" ? rings.frontOpacity : rings.backOpacity;
      if (part === "back") {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(0, 0, preset.cover.x, preset.canvas.height);
        this.ctx.clip();
      }
      await this.drawAssetFrame(preset, atlas[part], {
        sourceX: frame * (frameWidth + gap),
        sourceY: 0,
        sourceWidth: frameWidth,
        sourceHeight: image.naturalHeight,
        x: preset.holes.x + rings.xOffset,
        y: preset.holes.firstY + rings.yOffset,
        width: frameWidth * rings.scale,
        height: image.naturalHeight * rings.scale,
        opacity: opacityAtlas
      });
      if (part === "back") { this.ctx.restore(); }
      return;
    }
    var assetKey = style[part];
    var opacity = part === "front" ? rings.frontOpacity : rings.backOpacity;
    var scale = rings.scale;
    var holes = preset.holes;
    var ys = holePositions(preset);
    for (var index = 0; index < ys.length; index += 1) {
      await this.drawAsset(preset, assetKey, {
        x: holes.x + rings.xOffset,
        y: ys[index] + rings.yOffset,
        scale: scale,
        opacity: opacity
      });
    }
  };

  MockupRenderer.prototype.drawRingShadows = async function (preset) {
    var rings = preset.rings;
    var style = rings.styles[rings.style];
    var atlas = rings.atlases && rings.atlases[String(preset.holes.count)];
    if (rings.mode === "atlas" && atlas) {
      await this.drawAsset(preset, atlas.shadow, {
        x: preset.holes.x + rings.xOffset + 4,
        y: preset.holes.firstY + rings.yOffset + 4,
        scale: rings.scale,
        opacity: rings.shadowOpacity
      });
      return;
    }
    var holes = preset.holes;
    var ys = holePositions(preset);
    for (var index = 0; index < ys.length; index += 1) {
      await this.drawAsset(preset, style.shadow, {
        x: holes.x + rings.xOffset + 4,
        y: ys[index] + rings.yOffset + 4,
        scale: rings.scale,
        opacity: rings.shadowOpacity
      });
    }
  };

  MockupRenderer.prototype.drawHoleShadows = async function (preset) {
    var layer = preset.shadows.holes;
    var holes = preset.holes;
    var ys = holePositions(preset);
    for (var index = 0; index < ys.length; index += 1) {
      await this.drawAsset(preset, layer.asset, {
        x: holes.x + layer.xOffset,
        y: ys[index] + layer.yOffset,
        scale: layer.scale,
        opacity: layer.opacity
      });
    }
  };

  MockupRenderer.prototype.drawElastic = async function (preset) {
    var elastic = preset.elastic;
    var style = elastic.styles[elastic.style];
    var image = await this.load(preset, style.asset);
    var width = elastic.width * elastic.scale;
    var height = image.naturalHeight * (width / image.naturalWidth);
    await this.drawAsset(preset, style.shadow, {
      x: elastic.x + 7,
      y: elastic.y + 7,
      width: width,
      height: height,
      opacity: elastic.shadowOpacity
    });
    await this.drawAsset(preset, style.asset, {
      x: elastic.x,
      y: elastic.y,
      width: width,
      height: height,
      opacity: elastic.opacity
    });
  };

  MockupRenderer.prototype.drawOverlay = async function (preset, layer) {
    var ctx = this.ctx;
    var cover = preset.cover;
    ctx.save();
    coverMask(ctx, preset);
    await this.drawAsset(preset, layer.asset, {
      x: cover.x + layer.xOffset,
      y: cover.y + layer.yOffset,
      width: cover.width * layer.scale,
      height: cover.height * layer.scale,
      opacity: layer.opacity,
      blendMode: layer.blendMode
    });
    ctx.restore();
  };

  MockupRenderer.prototype.drawGuides = function (preset) {
    if (!this.guides) { return; }
    var ctx = this.ctx;
    var cover = preset.cover;
    var holes = preset.holes;
    ctx.save();
    ctx.strokeStyle = "rgba(219, 72, 77, .9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.strokeRect(cover.x, cover.y, cover.width, cover.height);
    ctx.strokeStyle = "rgba(53, 117, 204, .95)";
    holePositions(preset).forEach(function (y) {
      ctx.strokeRect(holes.x, y, holes.width, holes.height);
    });
    ctx.restore();
  };

  MockupRenderer.prototype.render = async function (preset) {
    var sequence = ++this.renderSequence;
    var canvas = this.canvas;
    var ctx = this.ctx;
    canvas.width = preset.canvas.width;
    canvas.height = preset.canvas.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    await this.preload(preset);
    if (sequence !== this.renderSequence) { return; }

    var background = preset.background;
    await this.drawAsset(preset, background.asset, {
      x: background.x,
      y: background.y,
      width: canvas.width * background.scale,
      height: canvas.height * background.scale,
      opacity: background.opacity
    });

    var coverShadow = preset.shadows.cover;
    await this.drawAsset(preset, coverShadow.asset, {
      x: preset.cover.x + coverShadow.xOffset,
      y: preset.cover.y + coverShadow.yOffset,
      scale: coverShadow.scale,
      opacity: coverShadow.opacity
    });

    var depth = preset.base.depth;
    await this.drawAsset(preset, depth.asset, {
      x: preset.cover.x + depth.xOffset,
      y: preset.cover.y + depth.yOffset,
      scale: depth.scale,
      opacity: depth.opacity
    });

    await this.drawRingShadows(preset);
    await this.drawRings(preset, "back");
    this.drawCover(preset);
    await this.drawHoleShadows(preset);
    await this.drawRings(preset, "front");
    await this.drawElastic(preset);
    await this.drawOverlay(preset, preset.overlays.highlights);
    await this.drawOverlay(preset, preset.overlays.reflections);
    await this.drawOverlay(preset, preset.overlays.texture);
    this.drawGuides(preset);
  };

  window.MockupStudioRenderer = {
    Renderer: MockupRenderer,
    holePositions: holePositions
  };
}());
