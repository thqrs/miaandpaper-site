/**
 * MIU_ANIMATION_LAB_EXPERIMENTAL_V2
 * Laboratório de comparação entre spritesheets 8×8 (multi-sheet & fluídas) e a produção.
 */
(function () {
  "use strict";

  function absoluteUrl(path, base) {
    return new URL(path, base || document.baseURI).href;
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.decoding = "async";
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error("Não foi possível carregar " + url + ".")); };
      image.src = url;
    });
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

  var PRODUCTION_SOURCES = {
    faceCalm: {
      sheet: "content/brand/miu/miu-sprite.webp",
      columns: 4,
      rows: 2,
      sequence: [0, 0, 0, 1, 2, 3, 0, 0, 0, 7, 0, 0, 0],
      frameDurationsMs: [1300, 1100, 900, 110, 100, 150, 1200, 950, 1200, 700, 1000, 900, 1200]
    },
    faceSmile: {
      sheet: "content/brand/miu/miu-sprite.webp",
      columns: 4,
      rows: 2,
      sequence: [0, 6, 6, 0],
      frameDurationsMs: [100, 320, 260, 180]
    },
    faceTilt: {
      sheet: "content/brand/miu/miu-sprite.webp",
      columns: 4,
      rows: 2,
      sequence: [0, 4, 4, 0, 5, 5, 0],
      frameDurationsMs: [100, 420, 250, 160, 420, 250, 180]
    },
    faceEar: {
      sheet: "content/brand/miu/miu-sprite.webp",
      columns: 4,
      rows: 2,
      sequence: [0, 7, 7, 0],
      frameDurationsMs: [120, 380, 320, 180]
    },
    faceSleep: {
      sheet: "content/brand/miu/miu-sprite-sleep.webp",
      columns: 4,
      rows: 1,
      sequence: [0, 1, 2, 3, 2, 3],
      frameDurationsMs: [650, 700, 650, 1100, 650, 1100]
    },
    faceNeutral: {
      sheet: "content/brand/miu/miu-sprite.webp",
      columns: 4,
      rows: 2,
      sequence: [0],
      frameDurationsMs: [1000]
    }
  };

  function LegacySpritePlayer(canvas, options) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
    this.options = options || {};
    this.source = null;
    this.sourceId = "";
    this.image = null;
    this.frameIndex = 0;
    this.elapsedMs = 0;
    this.speed = 1;
    this.loop = true;
    this.playing = false;
    this.showBounds = false;
    this.boundsColor = this.options.boundsColor || "rgba(114, 85, 30, .9)";
    this.cache = {};
    this._loadToken = 0;
    this._lastTimestamp = 0;
    this._raf = 0;
    this.onRender = typeof this.options.onRender === "function" ? this.options.onRender : function () {};
  }

  LegacySpritePlayer.prototype.setSource = function (sourceId, source, autoplay) {
    var player = this;
    var url;
    var token;
    if (!source) { source = PRODUCTION_SOURCES.faceCalm; sourceId = "faceCalm"; }
    player.pause();
    player.sourceId = sourceId;
    player.source = source;
    player.frameIndex = 0;
    player.elapsedMs = 0;
    player.playing = autoplay !== false;
    url = absoluteUrl(source.sheet);
    token = player._loadToken + 1;
    player._loadToken = token;

    return (player.cache[url] ? Promise.resolve(player.cache[url]) : loadImage(url).then(function (image) {
      player.cache[url] = image;
      return image;
    })).then(function (image) {
      if (token !== player._loadToken) { return; }
      player.image = image;
      player.render();
      player._ensureTick();
    });
  };

  LegacySpritePlayer.prototype._duration = function () {
    var values = this.source && this.source.frameDurationsMs;
    return Math.max(40, Number(values && values[this.frameIndex]) || 180);
  };

  LegacySpritePlayer.prototype._advance = function (deltaMs) {
    var sequence = this.source.sequence || [0];
    var duration;
    if (!this.playing) { return; }
    this.elapsedMs += deltaMs * this.speed;
    duration = this._duration();
    while (this.elapsedMs >= duration && this.playing) {
      this.elapsedMs -= duration;
      if (this.frameIndex + 1 < sequence.length) {
        this.frameIndex += 1;
      } else if (this.loop) {
        this.frameIndex = 0;
      } else {
        this.frameIndex = sequence.length - 1;
        this.elapsedMs = this._duration();
        this.playing = false;
      }
      duration = this._duration();
    }
  };

  LegacySpritePlayer.prototype._tick = function (timestamp) {
    var player = this;
    var delta;
    if (!player.playing) {
      player._lastTimestamp = 0;
      player._raf = 0;
      player.render();
      return;
    }
    if (!player._lastTimestamp) { player._lastTimestamp = timestamp; }
    delta = Math.min(100, Math.max(0, timestamp - player._lastTimestamp));
    player._lastTimestamp = timestamp;
    player._advance(delta);
    player.render();
    if (player.playing) {
      player._raf = requestAnimationFrame(function (nextTimestamp) { player._tick(nextTimestamp); });
    } else {
      player._raf = 0;
    }
  };

  LegacySpritePlayer.prototype._ensureTick = function () {
    var player = this;
    if (!player.playing || player._raf || !player.image) { return; }
    player._raf = requestAnimationFrame(function (timestamp) { player._tick(timestamp); });
  };

  LegacySpritePlayer.prototype.render = function () {
    var context = this.context;
    var columns;
    var rows;
    var frame;
    var sourceWidth;
    var sourceHeight;
    var sourceX;
    var sourceY;
    var bounds;
    if (!this.image || !this.source) { return; }
    columns = Math.max(1, Number(this.source.columns) || 1);
    rows = Math.max(1, Number(this.source.rows) || 1);
    frame = Number((this.source.sequence || [0])[this.frameIndex]) || 0;
    sourceWidth = this.image.naturalWidth / columns;
    sourceHeight = this.image.naturalHeight / rows;
    sourceX = (frame % columns) * sourceWidth;
    sourceY = Math.floor(frame / columns) * sourceHeight;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.save();
    if (this.source.flipX) {
      context.translate(this.canvas.width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(
      this.image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
    context.restore();

    if (this.showBounds) {
      bounds = scanAlphaBounds(
        context.getImageData(0, 0, this.canvas.width, this.canvas.height).data,
        this.canvas.width,
        this.canvas.height
      );
      if (bounds) {
        context.save();
        context.strokeStyle = this.boundsColor;
        context.lineWidth = Math.max(1, this.canvas.width / 128);
        context.setLineDash([6, 4]);
        context.strokeRect(bounds.x + 0.5, bounds.y + 0.5, bounds.width - 1, bounds.height - 1);
        context.restore();
      }
    }

    this.onRender({
      sourceId: this.sourceId,
      file: this.source.sheet,
      frameIndex: this.frameIndex,
      frameCount: (this.source.sequence || [0]).length,
      durationMs: this._duration(),
      playing: this.playing
    });
  };

  LegacySpritePlayer.prototype.play = function () {
    this.playing = true;
    this._lastTimestamp = 0;
    this._ensureTick();
  };

  LegacySpritePlayer.prototype.pause = function () {
    this.playing = false;
    this._lastTimestamp = 0;
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
    if (this.image) { this.render(); }
  };

  LegacySpritePlayer.prototype.replay = function () {
    this.frameIndex = 0;
    this.elapsedMs = 0;
    this.playing = true;
    this._lastTimestamp = 0;
    this.render();
    this._ensureTick();
  };

  LegacySpritePlayer.prototype.setLoop = function (loop) {
    this.loop = Boolean(loop);
  };

  LegacySpritePlayer.prototype.setSpeed = function (speed) {
    this.speed = Math.max(0.1, Math.min(4, Number(speed) || 1));
  };

  LegacySpritePlayer.prototype.setShowBounds = function (show) {
    this.showBounds = Boolean(show);
    if (this.image) { this.render(); }
  };

  function median(values) {
    var list = values.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(list.length / 2);
    if (!list.length) { return 0; }
    if (list.length % 2 === 1) { return list[mid]; }
    return (list[mid - 1] + list[mid]) / 2;
  }

  function distanceToBounds(px, py, box) {
    var dx = 0;
    var dy = 0;
    if (px < box.minX) { dx = box.minX - px; }
    else if (px > box.maxX) { dx = px - box.maxX; }
    if (py < box.minY) { dy = box.minY - py; }
    else if (py > box.maxY) { dy = py - box.maxY; }
    return Math.sqrt((dx * dx) + (dy * dy));
  }

  function detectConnectedGrid(image, columns, rows, options) {
    options = options || {};
    var alphaThreshold = Math.max(1, Number(options.alphaThreshold) || 8);
    var padding = Math.max(0, Number(options.padding) || 4);
    var canvas = document.createElement("canvas");
    var width = image.naturalWidth || image.width;
    var height = image.naturalHeight || image.height;
    var context;
    var imageData;
    var pixels;
    var labels;
    var queue;
    var components = [];
    var componentCount = 0;
    var seedCells = [];
    var seedLabels = {};
    var rowCenters = [];
    var columnCenters = [];
    var rowBounds = [];
    var columnBounds = [];
    var rowMin = [];
    var rowMax = [];
    var columnMin = [];
    var columnMax = [];
    var maxHalfWidth = 0;
    var maxHalfHeight = 0;
    var maxSearchRadius = Math.max(8, Math.round(Math.min(width / columns, height / rows) * 0.38));
    var maxAccessoryDistance = Math.max(width / columns, height / rows) * 0.58;
    var index;
    var row;
    var column;
    var label;
    var component;
    var seedX;
    var seedY;
    var candidateLabel;
    var owner;
    var bestDistance;
    var distance;
    var cell;
    var owned;
    var internalBoundary;
    var previousGap;
    var nextGap;
    var frameCanvas;
    var frameContext;
    var framePixels;
    var frameWidth;
    var frameHeight;
    var frameX;
    var frameY;
    var sourceOffset;
    var targetOffset;
    var x;
    var y;
    var ownerLookup;

    canvas.width = width;
    canvas.height = height;
    context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    imageData = context.getImageData(0, 0, width, height);
    pixels = imageData.data;
    labels = new Int32Array(width * height);
    queue = new Int32Array(width * height);

    function isOpaque(pixelIndex) {
      return pixels[(pixelIndex * 4) + 3] >= alphaThreshold;
    }

    for (index = 0; index < labels.length; index += 1) {
      if (labels[index] || !isOpaque(index)) { continue; }
      componentCount += 1;
      label = componentCount;
      var head = 0;
      var tail = 0;
      var minCompX = width;
      var minCompY = height;
      var maxCompX = -1;
      var maxCompY = -1;
      var area = 0;
      var sumX = 0;
      var sumY = 0;

      labels[index] = label;
      queue[tail] = index;
      tail += 1;

      while (head < tail) {
        var curr = queue[head];
        head += 1;
        var cx = curr % width;
        var cy = Math.floor(curr / width);
        area += 1;
        sumX += cx;
        sumY += cy;
        if (cx < minCompX) { minCompX = cx; }
        if (cx > maxCompX) { maxCompX = cx; }
        if (cy < minCompY) { minCompY = cy; }
        if (cy > maxCompY) { maxCompY = cy; }

        for (var ny = Math.max(0, cy - 1); ny <= Math.min(height - 1, cy + 1); ny += 1) {
          for (var nx = Math.max(0, cx - 1); nx <= Math.min(width - 1, cx + 1); nx += 1) {
            if (nx === cx && ny === cy) { continue; }
            var nIndex = (ny * width) + nx;
            if (!labels[nIndex] && isOpaque(nIndex)) {
              labels[nIndex] = label;
              queue[tail] = nIndex;
              tail += 1;
            }
          }
        }
      }

      components[label] = {
        label: label,
        area: area,
        minX: minCompX,
        minY: minCompY,
        maxX: maxCompX,
        maxY: maxCompY,
        centerX: (minCompX + maxCompX) / 2,
        centerY: (minCompY + maxCompY) / 2,
        centroidX: sumX / Math.max(1, area),
        centroidY: sumY / Math.max(1, area)
      };
    }

    function findUnusedLabelNear(targetX, targetY) {
      var bestLabel = 0;
      var bestScore = -Infinity;
      var comp;
      var dist;
      var score;
      for (var l = 1; l < components.length; l += 1) {
        if (seedLabels[l]) { continue; }
        comp = components[l];
        if (!comp || comp.area < 24) { continue; }
        dist = Math.sqrt(Math.pow(comp.centerX - targetX, 2) + Math.pow(comp.centerY - targetY, 2));
        if (dist > maxSearchRadius) { continue; }
        score = comp.area - (dist * 35);
        if (score > bestScore) {
          bestScore = score;
          bestLabel = l;
        }
      }
      if (bestLabel) { return bestLabel; }
      var minDistance = Infinity;
      for (var l2 = 1; l2 < components.length; l2 += 1) {
        if (seedLabels[l2]) { continue; }
        comp = components[l2];
        if (!comp || comp.area < 8) { continue; }
        dist = Math.sqrt(Math.pow(comp.centerX - targetX, 2) + Math.pow(comp.centerY - targetY, 2));
        if (dist < minDistance) {
          minDistance = dist;
          bestLabel = l2;
        }
      }
      return bestLabel;
    }

    for (row = 0; row < rows; row += 1) {
      seedCells[row] = [];
      for (column = 0; column < columns; column += 1) {
        seedX = ((column + 0.5) * width) / columns;
        seedY = ((row + 0.5) * height) / rows;
        candidateLabel = findUnusedLabelNear(seedX, seedY);
        if (!candidateLabel || !components[candidateLabel]) {
          candidateLabel = 1;
        }
        seedLabels[candidateLabel] = true;
        component = components[candidateLabel] || {
          centerX: seedX,
          centerY: seedY,
          minX: Math.max(0, Math.floor(seedX - 30)),
          minY: Math.max(0, Math.floor(seedY - 30)),
          maxX: Math.min(width - 1, Math.ceil(seedX + 30)),
          maxY: Math.min(height - 1, Math.ceil(seedY + 30))
        };
        seedCells[row][column] = {
          x: column,
          y: row,
          seedLabel: candidateLabel,
          labels: [candidateLabel],
          centerX: component.centerX,
          centerY: component.centerY,
          minX: component.minX,
          minY: component.minY,
          maxX: component.maxX,
          maxY: component.maxY
        };
      }
    }

    for (label = 1; label < components.length; label += 1) {
      component = components[label];
      if (!component || seedLabels[label] || component.area <= 2) { continue; }
      owner = null;
      bestDistance = Infinity;
      for (row = 0; row < rows; row += 1) {
        for (column = 0; column < columns; column += 1) {
          cell = seedCells[row][column];
          distance = distanceToBounds(component.centroidX, component.centroidY, {
            minX: cell.minX,
            minY: cell.minY,
            maxX: cell.maxX,
            maxY: cell.maxY
          });
          if (distance < bestDistance) {
            bestDistance = distance;
            owner = cell;
          }
        }
      }
      if (owner && bestDistance <= maxAccessoryDistance) {
        owner.labels.push(label);
        if (component.minX < owner.minX) { owner.minX = component.minX; }
        if (component.minY < owner.minY) { owner.minY = component.minY; }
        if (component.maxX > owner.maxX) { owner.maxX = component.maxX; }
        if (component.maxY > owner.maxY) { owner.maxY = component.maxY; }
      }
    }

    for (row = 0; row < rows; row += 1) {
      rowCenters[row] = median(seedCells[row].map(function (item) { return item.centerY; }));
      rowMin[row] = Math.min.apply(null, seedCells[row].map(function (item) { return item.minY; }));
      rowMax[row] = Math.max.apply(null, seedCells[row].map(function (item) { return item.maxY; }));
    }
    for (column = 0; column < columns; column += 1) {
      owned = [];
      for (row = 0; row < rows; row += 1) { owned.push(seedCells[row][column]); }
      columnCenters[column] = median(owned.map(function (item) { return item.centerX; }));
      columnMin[column] = Math.min.apply(null, owned.map(function (item) { return item.minX; }));
      columnMax[column] = Math.max.apply(null, owned.map(function (item) { return item.maxX; }));
    }

    rowBounds[0] = Math.max(0, Math.floor(Math.min(
      rowMin[0] - padding,
      rowCenters[0] - ((rowCenters[1] - rowCenters[0]) / 2)
    )));
    for (row = 1; row < rows; row += 1) {
      if (rowMin[row] > rowMax[row - 1]) {
        internalBoundary = (rowMax[row - 1] + rowMin[row]) / 2;
      } else {
        internalBoundary = (rowCenters[row - 1] + rowCenters[row]) / 2;
      }
      rowBounds[row] = Math.round(internalBoundary);
    }
    previousGap = rowCenters[rows - 1] - (rowCenters[rows - 2] || rowCenters[rows - 1]);
    rowBounds[rows] = Math.min(height, Math.ceil(Math.max(
      rowMax[rows - 1] + padding,
      rowCenters[rows - 1] + (previousGap / 2)
    )));

    columnBounds[0] = Math.max(0, Math.floor(Math.min(
      columnMin[0] - padding,
      columnCenters[0] - ((columnCenters[1] - columnCenters[0]) / 2)
    )));
    for (column = 1; column < columns; column += 1) {
      if (columnMin[column] > columnMax[column - 1]) {
        internalBoundary = (columnMax[column - 1] + columnMin[column]) / 2;
      } else {
        internalBoundary = (columnCenters[column - 1] + columnCenters[column]) / 2;
      }
      columnBounds[column] = Math.round(internalBoundary);
    }
    nextGap = columnCenters[columns - 1] - (columnCenters[columns - 2] || columnCenters[columns - 1]);
    columnBounds[columns] = Math.min(width, Math.ceil(Math.max(
      columnMax[columns - 1] + padding,
      columnCenters[columns - 1] + (nextGap / 2)
    )));

    for (row = 1; row < rowBounds.length; row += 1) {
      if (rowBounds[row] <= rowBounds[row - 1]) { rowBounds[row] = rowBounds[row - 1] + 1; }
    }
    for (column = 1; column < columnBounds.length; column += 1) {
      if (columnBounds[column] <= columnBounds[column - 1]) { columnBounds[column] = columnBounds[column - 1] + 1; }
    }

    for (row = 0; row < rows; row += 1) {
      for (column = 0; column < columns; column += 1) {
        cell = seedCells[row][column];
        frameWidth = Math.max(1, cell.maxX - cell.minX + 1);
        frameHeight = Math.max(1, cell.maxY - cell.minY + 1);
        frameCanvas = document.createElement("canvas");
        frameCanvas.width = frameWidth;
        frameCanvas.height = frameHeight;
        frameContext = frameCanvas.getContext("2d", { alpha: true });
        framePixels = frameContext.createImageData(frameWidth, frameHeight);
        ownerLookup = {};
        cell.labels.forEach(function (ownedLabel) { ownerLookup[ownedLabel] = true; });

        for (frameY = 0; frameY < frameHeight; frameY += 1) {
          y = cell.minY + frameY;
          for (frameX = 0; frameX < frameWidth; frameX += 1) {
            x = cell.minX + frameX;
            index = (y * width) + x;
            if (!ownerLookup[labels[index]]) { continue; }
            sourceOffset = index * 4;
            targetOffset = ((frameY * frameWidth) + frameX) * 4;
            framePixels.data[targetOffset] = pixels[sourceOffset];
            framePixels.data[targetOffset + 1] = pixels[sourceOffset + 1];
            framePixels.data[targetOffset + 2] = pixels[sourceOffset + 2];
            framePixels.data[targetOffset + 3] = pixels[sourceOffset + 3];
          }
        }
        frameContext.putImageData(framePixels, 0, 0);

        cell.spriteCanvas = frameCanvas;
        cell.anchorX = columnCenters[column] - cell.minX;
        cell.anchorY = rowCenters[row] - cell.minY;
        cell.sourceX = cell.minX;
        cell.sourceY = cell.minY;
        cell.sourceWidth = frameWidth;
        cell.sourceHeight = frameHeight;
        maxHalfWidth = Math.max(maxHalfWidth, cell.anchorX, frameWidth - cell.anchorX);
        maxHalfHeight = Math.max(maxHalfHeight, cell.anchorY, frameHeight - cell.anchorY);
      }
    }

    return {
      width: width,
      height: height,
      cells: seedCells,
      rowCenters: rowCenters,
      columnCenters: columnCenters,
      rowBounds: rowBounds,
      columnBounds: columnBounds,
      frameSpanWidth: (maxHalfWidth * 2) + 4,
      frameSpanHeight: (maxHalfHeight * 2) + 4
    };
  }

  function FullGridSpritePlayer(canvas, options) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
    this.options = options || {};
    this.config = null;
    this.configUrl = "";
    this.detectedGrids = {};
    this.images = {};
    this.animations = [];
    this.animationMap = {};
    this.animation = null;
    this.animationIndex = 0;
    this.frameIndex = 0;
    this.elapsedMs = 0;
    this.speed = 1;
    this.loop = true;
    this.cycleAll = true;
    this.playing = false;
    this.showBounds = false;
    this._raf = 0;
    this._lastTimestamp = 0;
    this.onRender = typeof this.options.onRender === "function" ? this.options.onRender : function () {};
    this.onPlayState = typeof this.options.onPlayState === "function" ? this.options.onPlayState : function () {};
    this.onAnimationChange = typeof this.options.onAnimationChange === "function" ? this.options.onAnimationChange : function () {};
  }

  FullGridSpritePlayer.prototype.load = function (configPath) {
    var player = this;
    player.configUrl = absoluteUrl(configPath);
    return fetch(player.configUrl, { credentials: "same-origin", cache: "no-store" })
      .then(function (response) {
        if (!response.ok) { throw new Error("Não foi possível carregar o manifesto (HTTP " + response.status + ")."); }
        return response.json();
      })
      .then(function (config) {
        player.config = config;
        player.animations = config.animations || [];
        player.animationMap = {};
        player.animations.forEach(function (animation, idx) {
          animation._index = idx;
          player.animationMap[animation.id] = animation;
        });

        var sheetsDecl = config.sheets || {};
        if (!config.sheets && config.sheet) {
          sheetsDecl = { "1": { file: config.sheet, columns: config.columns || 8, rows: config.rows || 8 } };
        }

        var sheetKeys = Object.keys(sheetsDecl);
        var loadPromises = sheetKeys.map(function (key) {
          var item = sheetsDecl[key];
          var file = typeof item === "string" ? item : item.file;
          var cols = (typeof item === "object" && item.columns) ? Number(item.columns) : (config.columns || 8);
          var rows = (typeof item === "object" && item.rows) ? Number(item.rows) : (config.rows || 8);
          var sheetUrl = new URL(file, player.configUrl).href;

          return loadImage(sheetUrl).then(function (img) {
            player.images[key] = img;
            player.detectedGrids[key] = window.MiuSpriteGrid
              ? window.MiuSpriteGrid.detectConnectedGrid(img, cols, rows)
              : detectConnectedGrid(img, cols, rows);
          });
        });

        return Promise.all(loadPromises).then(function () {
          return player;
        });
      });
  };

  FullGridSpritePlayer.prototype.getAnimations = function () {
    return this.animations;
  };

  FullGridSpritePlayer.prototype.setAnimation = function (animationId, autoplay) {
    var animation = this.animationMap[animationId];
    if (!animation) { throw new Error("Animação desconhecida: " + animationId + "."); }
    this.animation = animation;
    this.animationIndex = animation._index || 0;
    this.frameIndex = 0;
    this.elapsedMs = 0;
    this.loop = animation.loop !== false;
    this.playing = autoplay !== false;
    this.render();
    this._ensureTick();
  };

  FullGridSpritePlayer.prototype.setCycleAll = function (cycle) {
    this.cycleAll = Boolean(cycle);
  };

  FullGridSpritePlayer.prototype._frame = function () {
    if (!this.animation || !this.animation.frames || !this.animation.frames.length) { return null; }
    return this.animation.frames[this.frameIndex] || this.animation.frames[0];
  };

  FullGridSpritePlayer.prototype._duration = function () {
    var frame = this._frame();
    return Math.max(40, Number(frame && frame.durationMs) || 180);
  };

  FullGridSpritePlayer.prototype._advance = function (deltaMs) {
    var frames;
    var duration;
    if (!this.playing || !this.animation) { return; }
    frames = this.animation.frames || [];
    if (!frames.length) { return; }
    this.elapsedMs += deltaMs * this.speed;
    duration = this._duration();
    while (this.elapsedMs >= duration && this.playing) {
      this.elapsedMs -= duration;
      if (this.frameIndex + 1 < frames.length) {
        this.frameIndex += 1;
      } else if (this.cycleAll && this.animations.length > 1) {
        this.animationIndex = (this.animationIndex + 1) % this.animations.length;
        this.animation = this.animations[this.animationIndex];
        this.frameIndex = 0;
        this.onAnimationChange(this.animation);
      } else if (this.loop) {
        this.frameIndex = 0;
      } else {
        this.frameIndex = frames.length - 1;
        this.elapsedMs = this._duration();
        this.playing = false;
        this.onPlayState(false);
      }
      duration = this._duration();
    }
  };

  FullGridSpritePlayer.prototype._tick = function (timestamp) {
    var player = this;
    var delta;
    if (!player.playing) {
      player._lastTimestamp = 0;
      player._raf = 0;
      player.render();
      return;
    }
    if (!player._lastTimestamp) { player._lastTimestamp = timestamp; }
    delta = Math.min(100, Math.max(0, timestamp - player._lastTimestamp));
    player._lastTimestamp = timestamp;
    player._advance(delta);
    player.render();
    if (player.playing) {
      player._raf = requestAnimationFrame(function (nextTimestamp) { player._tick(nextTimestamp); });
    } else {
      player._raf = 0;
    }
  };

  FullGridSpritePlayer.prototype._ensureTick = function () {
    var player = this;
    if (!player.playing || player._raf) { return; }
    player._raf = requestAnimationFrame(function (timestamp) { player._tick(timestamp); });
  };

  FullGridSpritePlayer.prototype.render = function () {
    var context = this.context;
    var frame = this._frame();
    var cellCoord;
    var sheetKey;
    var col;
    var row;
    var grid;
    var cell;
    var scale;
    var destWidth;
    var destHeight;
    var destX;
    var destY;
    var bounds;
    if (!frame) { return; }

    sheetKey = String(frame.sheet || this.config.defaultSheet || "1");
    grid = this.detectedGrids[sheetKey] || Object.values(this.detectedGrids)[0];
    if (!grid) { return; }

    cellCoord = frame.cell || [0, 0];
    col = Math.max(0, Math.min(grid.columnCenters.length - 1, Number(cellCoord[0]) || 0));
    row = Math.max(0, Math.min(grid.rowCenters.length - 1, Number(cellCoord[1]) || 0));
    cell = grid.cells[row] && grid.cells[row][col];
    if (!cell || !cell.spriteCanvas) { return; }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    scale = this.canvas.width / Math.max(grid.frameSpanWidth, grid.frameSpanHeight);
    destWidth = cell.sourceWidth * scale;
    destHeight = cell.sourceHeight * scale;
    destX = (this.canvas.width / 2) - (cell.anchorX * scale);
    destY = (this.canvas.height / 2) - (cell.anchorY * scale);

    context.drawImage(cell.spriteCanvas, 0, 0, cell.sourceWidth, cell.sourceHeight, destX, destY, destWidth, destHeight);

    if (this.showBounds) {
      bounds = scanAlphaBounds(
        context.getImageData(0, 0, this.canvas.width, this.canvas.height).data,
        this.canvas.width,
        this.canvas.height
      );
      if (bounds) {
        context.save();
        context.strokeStyle = "rgba(42, 63, 56, .9)";
        context.lineWidth = Math.max(1, this.canvas.width / 128);
        context.setLineDash([6, 4]);
        context.strokeRect(bounds.x + 0.5, bounds.y + 0.5, bounds.width - 1, bounds.height - 1);
        context.restore();
      }
    }

    this.onRender({
      animation: this.animation,
      frameIndex: this.frameIndex,
      frameCount: (this.animation.frames || []).length,
      cell: [col, row],
      sheet: sheetKey,
      durationMs: this._duration(),
      elapsedMs: this.elapsedMs,
      playing: this.playing
    });
  };

  FullGridSpritePlayer.prototype.play = function () {
    this.playing = true;
    this._lastTimestamp = 0;
    this.onPlayState(true);
    this._ensureTick();
  };

  FullGridSpritePlayer.prototype.pause = function () {
    this.playing = false;
    this._lastTimestamp = 0;
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
    this.onPlayState(false);
    this.render();
  };

  FullGridSpritePlayer.prototype.replay = function () {
    this.frameIndex = 0;
    this.elapsedMs = 0;
    this.playing = true;
    this._lastTimestamp = 0;
    this.onPlayState(true);
    this.render();
    this._ensureTick();
  };

  FullGridSpritePlayer.prototype.setLoop = function (loop) {
    this.loop = Boolean(loop);
  };

  FullGridSpritePlayer.prototype.setSpeed = function (speed) {
    this.speed = Math.max(0.1, Math.min(4, Number(speed) || 1));
  };

  FullGridSpritePlayer.prototype.setShowBounds = function (show) {
    this.showBounds = Boolean(show);
    this.render();
  };

  function appendGroupedOptions(select, items, groupFor, valueFor, labelFor) {
    var groups = {};
    var order = [];
    select.textContent = "";
    items.forEach(function (item) {
      var groupName = groupFor(item) || "Outros";
      if (!groups[groupName]) {
        groups[groupName] = [];
        order.push(groupName);
      }
      groups[groupName].push(item);
    });
    order.forEach(function (groupName) {
      var group = document.createElement("optgroup");
      group.label = groupName;
      groups[groupName].forEach(function (item) {
        var option = document.createElement("option");
        option.value = valueFor(item);
        option.textContent = labelFor(item);
        group.appendChild(option);
      });
      select.appendChild(group);
    });
  }

  function renderSequenceList(container, animation, activeIndex) {
    var frames;
    if (!container || !animation) { return; }
    frames = animation.frames || [];
    container.textContent = "";
    frames.forEach(function (frame, index) {
      var item = document.createElement("li");
      var cell = frame.cell || [0, 0];
      var sheet = frame.sheet ? "S" + frame.sheet + " " : "";
      item.className = "miu-lab-seq-item" + (index === activeIndex ? " is-active" : "");
      item.innerHTML = "<strong>" + sheet + "[" + cell[0] + "," + cell[1] + "]</strong><span>" + (frame.durationMs || 180) + " ms</span>";
      container.appendChild(item);
    });
  }

  function boot() {
    var shell = document.getElementById("miu-lab-shell");
    var animationSelect = document.getElementById("miu-lab-full-animation");
    var legacySelect = document.getElementById("miu-lab-legacy-animation");
    var playButton = document.getElementById("miu-lab-play");
    var pauseButton = document.getElementById("miu-lab-pause");
    var replayButton = document.getElementById("miu-lab-replay");
    var cycleAllToggle = document.getElementById("miu-lab-cycle-all");
    var loopToggle = document.getElementById("miu-lab-loop");
    var boundsToggle = document.getElementById("miu-lab-bounds");
    var gridToggle = document.getElementById("miu-lab-grid");
    var speedControl = document.getElementById("miu-lab-speed");
    var speedOutput = document.getElementById("miu-lab-speed-output");
    var currentStatus = document.getElementById("miu-lab-current-status");
    var fullStatus = document.getElementById("miu-lab-full-status");
    var fullProgress = document.getElementById("miu-lab-full-progress");
    var animationName = document.getElementById("miu-lab-animation-name");
    var playState = document.getElementById("miu-lab-play-state");
    var sequenceList = document.getElementById("miu-lab-full-sequence");
    var sheetWraps = document.querySelectorAll(".miu-lab-atlas-wrap");
    var errorBox = document.getElementById("miu-lab-error");
    var loading = document.getElementById("miu-lab-loading");
    var fullPlayer;
    var legacyPlayer;
    var fullConfigUrl;
    var lastActiveIndex = -1;
    var currentAnimId = "";

    if (!shell) { return; }
    fullConfigUrl = shell.getAttribute("data-full-sprite-animations") || "content/brand/miu/experimental/experimental-full-spritesheet-animations_002.json";

    function showError(error) {
      errorBox.hidden = false;
      errorBox.textContent = error && error.message ? error.message : String(error);
      loading.hidden = true;
    }

    legacyPlayer = new LegacySpritePlayer(document.getElementById("miu-lab-current-canvas"), {
      onRender: function (payload) {
        currentStatus.textContent = "Frame " + (payload.frameIndex + 1) + "/" + payload.frameCount + " · " + payload.file.replace(/^.*\//, "");
      }
    });

    fullPlayer = new FullGridSpritePlayer(document.getElementById("miu-lab-full-canvas"), {
      onRender: function (payload) {
        fullStatus.textContent = "Folha " + payload.sheet + " · Frame " + (payload.frameIndex + 1) + "/" + payload.frameCount + " · Célula [" + payload.cell[0] + "," + payload.cell[1] + "] (" + payload.durationMs + " ms)";
        fullProgress.max = Math.max(1, payload.durationMs || 1);
        fullProgress.value = Math.min(fullProgress.max, payload.elapsedMs || 0);

        if (payload.animation && payload.animation.id !== currentAnimId) {
          currentAnimId = payload.animation.id;
          animationName.textContent = payload.animation.name || payload.animation.id;
          animationSelect.value = payload.animation.id;
          renderSequenceList(sequenceList, payload.animation, payload.frameIndex);
          lastActiveIndex = payload.frameIndex;
        } else if (payload.frameIndex !== lastActiveIndex) {
          lastActiveIndex = payload.frameIndex;
          var items = sequenceList.querySelectorAll(".miu-lab-seq-item");
          items.forEach(function (el, idx) {
            el.classList.toggle("is-active", idx === payload.frameIndex);
          });
        }
      },
      onPlayState: function (isPlaying) {
        playState.textContent = isPlaying ? "A reproduzir" : "Em pausa";
      },
      onAnimationChange: function (nextAnimation) {
        currentAnimId = nextAnimation.id;
        animationName.textContent = nextAnimation.name || nextAnimation.id;
        animationSelect.value = nextAnimation.id;
        renderSequenceList(sequenceList, nextAnimation, 0);
        lastActiveIndex = 0;
      }
    });

    function select8x8Animation(animationId, autoplay) {
      fullPlayer.setAnimation(animationId, autoplay !== false);
      animationSelect.value = animationId;
      currentAnimId = animationId;
      if (fullPlayer.animation) {
        animationName.textContent = fullPlayer.animation.name || fullPlayer.animation.id;
      }
      renderSequenceList(sequenceList, fullPlayer.animation, 0);
      lastActiveIndex = 0;
    }

    fullPlayer.load(fullConfigUrl).then(function () {
      var animations = fullPlayer.getAnimations();
      appendGroupedOptions(
        animationSelect,
        animations,
        function (item) { return item.group || "Animações"; },
        function (item) { return item.id; },
        function (item) { return item.name || item.id; }
      );
      loading.hidden = true;
      shell.classList.add("is-ready");

      var defaultId = (fullPlayer.config && fullPlayer.config.defaultAnimationId) || (animations[0] && animations[0].id) || "idle_blink";
      fullPlayer.setCycleAll(true);
      if (cycleAllToggle) { cycleAllToggle.checked = true; }
      select8x8Animation(defaultId, true);
      legacyPlayer.setSource("faceCalm", PRODUCTION_SOURCES.faceCalm, true).catch(showError);
    }).catch(showError);

    animationSelect.addEventListener("change", function () {
      if (animationSelect.value) {
        if (cycleAllToggle) {
          cycleAllToggle.checked = false;
          fullPlayer.setCycleAll(false);
        }
        select8x8Animation(animationSelect.value, true);
      }
    });

    legacySelect.addEventListener("change", function () {
      var key = legacySelect.value || "faceCalm";
      legacyPlayer.setSource(key, PRODUCTION_SOURCES[key], fullPlayer.playing).catch(showError);
    });

    playButton.addEventListener("click", function () {
      fullPlayer.play();
      legacyPlayer.play();
    });

    pauseButton.addEventListener("click", function () {
      fullPlayer.pause();
      legacyPlayer.pause();
    });

    replayButton.addEventListener("click", function () {
      fullPlayer.replay();
      legacyPlayer.replay();
    });

    if (cycleAllToggle) {
      cycleAllToggle.addEventListener("change", function () {
        fullPlayer.setCycleAll(cycleAllToggle.checked);
      });
    }

    loopToggle.addEventListener("change", function () {
      fullPlayer.setLoop(loopToggle.checked);
      legacyPlayer.setLoop(loopToggle.checked);
    });

    boundsToggle.addEventListener("change", function () {
      fullPlayer.setShowBounds(boundsToggle.checked);
      legacyPlayer.setShowBounds(boundsToggle.checked);
    });

    gridToggle.addEventListener("change", function () {
      sheetWraps.forEach(function (sheetWrap) {
        sheetWrap.classList.toggle("show-grid", gridToggle.checked);
      });
    });

    speedControl.addEventListener("input", function () {
      var speed = Number(speedControl.value) || 1;
      speedOutput.value = speed.toFixed(2).replace(/\.00$/, "") + "×";
      speedOutput.textContent = speedOutput.value;
      fullPlayer.setSpeed(speed);
      legacyPlayer.setSpeed(speed);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}());
