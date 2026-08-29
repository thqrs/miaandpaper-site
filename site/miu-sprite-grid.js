/**
 * Míu Sprite Grid
 *
 * Extracção partilhável das células «autocolante» das spritesheets do Míu.
 * Mantém a centragem anatómica por medianas usada no laboratório 8×8.
 */
(function (window, document) {
  'use strict';

  function median(values) {
    var list = values.slice().sort(function (a, b) { return a - b; });
    var middle = Math.floor(list.length / 2);
    if (!list.length) return 0;
    return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
  }

  function distanceToBounds(x, y, box) {
    var dx = x < box.minX ? box.minX - x : (x > box.maxX ? x - box.maxX : 0);
    var dy = y < box.minY ? box.minY - y : (y > box.maxY ? y - box.maxY : 0);
    return Math.sqrt((dx * dx) + (dy * dy));
  }

  function detectConnectedGrid(image, columns, rows, options) {
    options = options || {};
    var alphaThreshold = Math.max(1, Number(options.alphaThreshold) || 8);
    var width = image.naturalWidth || image.width;
    var height = image.naturalHeight || image.height;
    var canvas = document.createElement('canvas');
    var context;
    var pixels;
    var labels;
    var queue;
    var components = [];
    var componentCount = 0;
    var seedCells = [];
    var seedLabels = {};
    var rowCenters = [];
    var columnCenters = [];
    var maxHalfWidth = 0;
    var maxHalfHeight = 0;
    var maxSearchRadius = Math.max(8, Math.round(Math.min(width / columns, height / rows) * 0.38));
    var maxAccessoryDistance = Math.max(width / columns, height / rows) * 0.58;
    var index;
    var row;
    var column;
    var label;
    var component;

    canvas.width = width;
    canvas.height = height;
    context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    pixels = context.getImageData(0, 0, width, height).data;
    labels = new Int32Array(width * height);
    queue = new Int32Array(width * height);

    function isOpaque(pixelIndex) {
      return pixels[(pixelIndex * 4) + 3] >= alphaThreshold;
    }

    for (index = 0; index < labels.length; index += 1) {
      if (labels[index] || !isOpaque(index)) continue;
      componentCount += 1;
      label = componentCount;
      var head = 0;
      var tail = 0;
      var minX = width;
      var minY = height;
      var maxX = -1;
      var maxY = -1;
      var area = 0;
      var sumX = 0;
      var sumY = 0;

      labels[index] = label;
      queue[tail] = index;
      tail += 1;

      while (head < tail) {
        var current = queue[head];
        var currentX = current % width;
        var currentY = Math.floor(current / width);
        head += 1;
        area += 1;
        sumX += currentX;
        sumY += currentY;
        minX = Math.min(minX, currentX);
        minY = Math.min(minY, currentY);
        maxX = Math.max(maxX, currentX);
        maxY = Math.max(maxY, currentY);

        for (var nearY = Math.max(0, currentY - 1); nearY <= Math.min(height - 1, currentY + 1); nearY += 1) {
          for (var nearX = Math.max(0, currentX - 1); nearX <= Math.min(width - 1, currentX + 1); nearX += 1) {
            if (nearX === currentX && nearY === currentY) continue;
            var nearIndex = (nearY * width) + nearX;
            if (!labels[nearIndex] && isOpaque(nearIndex)) {
              labels[nearIndex] = label;
              queue[tail] = nearIndex;
              tail += 1;
            }
          }
        }
      }

      components[label] = {
        label: label,
        area: area,
        minX: minX,
        minY: minY,
        maxX: maxX,
        maxY: maxY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
        centroidX: sumX / Math.max(1, area),
        centroidY: sumY / Math.max(1, area)
      };
    }

    function findUnusedLabelNear(targetX, targetY) {
      var bestLabel = 0;
      var bestScore = -Infinity;
      var nearestDistance = Infinity;
      var candidate;
      var distance;
      var score;

      for (var candidateLabel = 1; candidateLabel < components.length; candidateLabel += 1) {
        if (seedLabels[candidateLabel]) continue;
        candidate = components[candidateLabel];
        if (!candidate || candidate.area < 24) continue;
        distance = Math.hypot(candidate.centerX - targetX, candidate.centerY - targetY);
        if (distance > maxSearchRadius) continue;
        score = candidate.area - (distance * 35);
        if (score > bestScore) {
          bestScore = score;
          bestLabel = candidateLabel;
        }
      }
      if (bestLabel) return bestLabel;

      for (var fallbackLabel = 1; fallbackLabel < components.length; fallbackLabel += 1) {
        if (seedLabels[fallbackLabel]) continue;
        candidate = components[fallbackLabel];
        if (!candidate || candidate.area < 8) continue;
        distance = Math.hypot(candidate.centerX - targetX, candidate.centerY - targetY);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          bestLabel = fallbackLabel;
        }
      }
      return bestLabel;
    }

    for (row = 0; row < rows; row += 1) {
      seedCells[row] = [];
      for (column = 0; column < columns; column += 1) {
        var seedX = ((column + 0.5) * width) / columns;
        var seedY = ((row + 0.5) * height) / rows;
        var seedLabel = findUnusedLabelNear(seedX, seedY);
        component = components[seedLabel];
        if (seedLabel && component) {
          seedLabels[seedLabel] = true;
          seedCells[row][column] = {
            x: column,
            y: row,
            labels: [seedLabel],
            centerX: component.centerX,
            centerY: component.centerY,
            minX: component.minX,
            minY: component.minY,
            maxX: component.maxX,
            maxY: component.maxY,
            bodyWidth: component.maxX - component.minX + 1,
            bodyHeight: component.maxY - component.minY + 1,
            rawCrop: false
          };
          continue;
        }

        /*
         * Uma geração pode ligar acidentalmente dois autocolantes por uma linha
         * de píxeis. Nesse caso o CCL global deixa de ter 64 componentes. A
         * célula em falta usa apenas a sua caixa lógica, mantendo alpha e sem
         * contaminar as restantes células.
         */
        var logicalMinX = Math.floor((column * width) / columns);
        var logicalMaxX = Math.min(width - 1, Math.ceil(((column + 1) * width) / columns) - 1);
        var logicalMinY = Math.floor((row * height) / rows);
        var logicalMaxY = Math.min(height - 1, Math.ceil(((row + 1) * height) / rows) - 1);
        var cropMinX = logicalMaxX;
        var cropMinY = logicalMaxY;
        var cropMaxX = logicalMinX;
        var cropMaxY = logicalMinY;
        var cropFound = false;
        for (var cropY = logicalMinY; cropY <= logicalMaxY; cropY += 1) {
          for (var cropX = logicalMinX; cropX <= logicalMaxX; cropX += 1) {
            if (!isOpaque((cropY * width) + cropX)) continue;
            cropFound = true;
            cropMinX = Math.min(cropMinX, cropX);
            cropMinY = Math.min(cropMinY, cropY);
            cropMaxX = Math.max(cropMaxX, cropX);
            cropMaxY = Math.max(cropMaxY, cropY);
          }
        }
        if (!cropFound) throw new Error('Não foi possível isolar a célula [' + column + ',' + row + '].');
        seedCells[row][column] = {
          x: column,
          y: row,
          labels: [],
          centerX: (cropMinX + cropMaxX) / 2,
          centerY: (cropMinY + cropMaxY) / 2,
          minX: cropMinX,
          minY: cropMinY,
          maxX: cropMaxX,
          maxY: cropMaxY,
          bodyWidth: cropMaxX - cropMinX + 1,
          bodyHeight: cropMaxY - cropMinY + 1,
          rawCrop: true
        };
      }
    }

    for (label = 1; label < components.length; label += 1) {
      component = components[label];
      if (!component || seedLabels[label] || component.area <= 2) continue;
      var owner = null;
      var bestDistance = Infinity;
      for (row = 0; row < rows; row += 1) {
        for (column = 0; column < columns; column += 1) {
          var candidateCell = seedCells[row][column];
          var ownerDistance = distanceToBounds(component.centroidX, component.centroidY, candidateCell);
          if (ownerDistance < bestDistance) {
            bestDistance = ownerDistance;
            owner = candidateCell;
          }
        }
      }
      if (owner && bestDistance <= maxAccessoryDistance) {
        owner.labels.push(label);
        owner.minX = Math.min(owner.minX, component.minX);
        owner.minY = Math.min(owner.minY, component.minY);
        owner.maxX = Math.max(owner.maxX, component.maxX);
        owner.maxY = Math.max(owner.maxY, component.maxY);
      }
    }

    for (row = 0; row < rows; row += 1) {
      rowCenters[row] = median(seedCells[row].map(function (cell) { return cell.centerY; }));
    }
    for (column = 0; column < columns; column += 1) {
      var columnCells = [];
      for (row = 0; row < rows; row += 1) columnCells.push(seedCells[row][column]);
      columnCenters[column] = median(columnCells.map(function (cell) { return cell.centerX; }));
    }

    for (row = 0; row < rows; row += 1) {
      for (column = 0; column < columns; column += 1) {
        var cell = seedCells[row][column];
        var frameWidth = Math.max(1, cell.maxX - cell.minX + 1);
        var frameHeight = Math.max(1, cell.maxY - cell.minY + 1);
        var frameCanvas = document.createElement('canvas');
        var frameContext;
        var framePixels;
        var ownerLookup = {};

        frameCanvas.width = frameWidth;
        frameCanvas.height = frameHeight;
        frameContext = frameCanvas.getContext('2d', { alpha: true });
        framePixels = frameContext.createImageData(frameWidth, frameHeight);
        cell.labels.forEach(function (ownedLabel) { ownerLookup[ownedLabel] = true; });

        for (var frameY = 0; frameY < frameHeight; frameY += 1) {
          var sourceY = cell.minY + frameY;
          for (var frameX = 0; frameX < frameWidth; frameX += 1) {
            var sourceX = cell.minX + frameX;
            var sourceIndex = (sourceY * width) + sourceX;
            if (!cell.rawCrop && !ownerLookup[labels[sourceIndex]]) continue;
            if (cell.rawCrop && !isOpaque(sourceIndex)) continue;
            var sourceOffset = sourceIndex * 4;
            var targetOffset = ((frameY * frameWidth) + frameX) * 4;
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
      bodySpanWidth: median([].concat.apply([], seedCells).map(function (item) { return item.bodyWidth; })),
      bodySpanHeight: median([].concat.apply([], seedCells).map(function (item) { return item.bodyHeight; })),
      frameSpanWidth: (maxHalfWidth * 2) + 4,
      frameSpanHeight: (maxHalfHeight * 2) + 4
    };
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error('Não foi possível carregar ' + url)); };
      image.src = url;
    });
  }

  window.MiuSpriteGrid = {
    detectConnectedGrid: detectConnectedGrid,
    loadImage: loadImage
  };
})(window, document);
