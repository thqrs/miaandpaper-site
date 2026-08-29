/**
 * Míu · Pequenos episódios da oficina
 *
 * Leitor isolado da biblioteca experimental 8×8. Cada frame artístico é
 * preservado; o director limita-se a ordenar clips e a compor prop/FX.
 */
(function (window, document) {
  'use strict';

  var ROOT_URL = new URL('content/brand/miu/experimental/library-v1/', window.location.href);
  var LIBRARY_MANIFEST_URL = new URL('library-manifest.json', ROOT_URL);
  var EPISODE_MANIFEST_URL = new URL('episodes/episode-manifest.json', ROOT_URL);
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var canvas = document.getElementById('episodes-stage');
  var context = canvas.getContext('2d', { alpha: true });
  var libraryManifest = null;
  var episodeManifest = null;
  var episode = null;
  var compiledTimeline = [];
  var assetCache = {};
  var assets = {};
  var selectedIndex = 0;
  var playheadMs = 0;
  var durationMs = 1;
  var playing = false;
  var lastTick = 0;
  var loopRestartAt = 0;
  var activeTimelineIndex = -1;
  var loadingToken = 0;

  function byId(id) {
    return document.getElementById(id);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function tokenColor(name) {
    var style = getComputedStyle(document.documentElement);
    return style.getPropertyValue(name).trim() || getComputedStyle(document.body).color;
  }

  function fetchJson(url) {
    return fetch(url, { credentials: 'same-origin', cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status + ' ao carregar ' + url.pathname);
      return response.json();
    });
  }

  function formatTime(milliseconds) {
    var value = Math.max(0, Math.round(milliseconds));
    var minutes = Math.floor(value / 60000);
    var seconds = Math.floor((value % 60000) / 1000);
    var millis = value % 1000;
    return minutes + ':' + String(seconds).padStart(2, '0') + '.' + String(millis).padStart(3, '0');
  }

  function labelForLayer(layer) {
    return { character: 'Míu', prop: 'Adereço', fx: 'FX' }[layer] || layer;
  }

  function showError(error) {
    var box = byId('episodes-error');
    box.hidden = false;
    box.textContent = error && error.message ? error.message : String(error);
    playing = false;
    updatePlayButton();
  }

  function clearError() {
    byId('episodes-error').hidden = true;
    byId('episodes-error').textContent = '';
  }

  function loadSheet(sheetId) {
    if (assetCache[sheetId]) return assetCache[sheetId];
    assetCache[sheetId] = Promise.resolve().then(function () {
      var declaration = libraryManifest.sheets[sheetId];
      if (!declaration) throw new Error('A folha «' + sheetId + '» não existe no manifesto da biblioteca.');
      var metadataUrl = new URL(declaration.metadata, ROOT_URL);
      var imageUrl = new URL(declaration.file, ROOT_URL);
      return Promise.all([
        fetchJson(metadataUrl),
        window.MiuSpriteGrid.loadImage(imageUrl.href)
      ]).then(function (loaded) {
        var metadata = loaded[0];
        var grid;
        var beats = {};
        try {
          grid = window.MiuSpriteGrid.detectConnectedGrid(
            loaded[1],
            Number(metadata.columns) || 8,
            Number(metadata.rows) || 8
          );
        } catch (error) {
          throw new Error('Folha «' + sheetId + '»: ' + error.message);
        }
        (metadata.beats || []).forEach(function (beat) { beats[beat.id] = beat; });
        return {
          id: sheetId,
          declaration: declaration,
          metadata: metadata,
          beats: beats,
          grid: grid
        };
      });
    });
    return assetCache[sheetId];
  }

  function validateEpisodeReferences(currentEpisode, loadedAssets) {
    currentEpisode.timeline.forEach(function (step) {
      var asset = loadedAssets[step.sheet];
      if (!asset) throw new Error('Falta a folha «' + step.sheet + '» no episódio.');
      if (!asset.beats[step.beat]) {
        throw new Error('O beat «' + step.beat + '» não existe em «' + step.sheet + '».');
      }
    });
  }

  function compileEpisode(currentEpisode) {
    var cursor = 0;
    return currentEpisode.timeline.map(function (step, index) {
      var duration = Math.max(1, Number(step.durationMs) || 1);
      var compiled = {
        index: index,
        step: step,
        startMs: cursor,
        endMs: cursor + duration,
        durationMs: duration
      };
      cursor += duration;
      return compiled;
    });
  }

  function renderEpisodeCards() {
    var list = byId('episodes-list');
    list.innerHTML = '';
    episodeManifest.episodes.forEach(function (item, index) {
      var button = document.createElement('button');
      var missing = item.missingSheets || [];
      button.type = 'button';
      button.className = 'episodes-card';
      button.dataset.index = String(index);
      button.setAttribute('aria-current', index === selectedIndex ? 'true' : 'false');
      button.innerHTML = '<span class="episodes-card-number">' + String(index + 1).padStart(2, '0') + '</span>'
        + '<span class="episodes-card-copy"><strong></strong><small></small></span>';
      button.querySelector('strong').textContent = item.title;
      button.querySelector('small').textContent = formatTime(item.durationMs)
        + (missing.length ? ' · ' + missing.length + ' ponte(s) opcional(is)' : ' · completo');
      button.addEventListener('click', function () { selectEpisode(index, false); });
      list.appendChild(button);
    });
    byId('episodes-count').textContent = episodeManifest.episodes.length + ' episódios';
  }

  function updateEpisodeCardSelection() {
    Array.prototype.forEach.call(document.querySelectorAll('.episodes-card'), function (card, index) {
      card.setAttribute('aria-current', index === selectedIndex ? 'true' : 'false');
    });
  }

  function renderTimeline() {
    var list = byId('episodes-timeline');
    list.innerHTML = '';
    compiledTimeline.forEach(function (compiled) {
      var item = document.createElement('li');
      var button = document.createElement('button');
      var step = compiled.step;
      button.type = 'button';
      button.dataset.timelineIndex = String(compiled.index);
      button.innerHTML = '<span class="episodes-timeline-index"></span>'
        + '<span class="episodes-timeline-layer"></span>'
        + '<span class="episodes-timeline-beat"></span>'
        + '<span class="episodes-timeline-duration"></span>';
      button.querySelector('.episodes-timeline-index').textContent = String(compiled.index + 1).padStart(2, '0');
      button.querySelector('.episodes-timeline-layer').textContent = labelForLayer(step.layer);
      button.querySelector('.episodes-timeline-beat').textContent = step.beat + ' · ' + step.sheet;
      button.querySelector('.episodes-timeline-duration').textContent = step.durationMs + ' ms';
      button.addEventListener('click', function () {
        playheadMs = compiled.startMs + 1;
        loopRestartAt = 0;
        render();
      });
      item.appendChild(button);
      list.appendChild(item);
    });
  }

  function selectEpisode(index, autoplay) {
    var item;
    var token;
    if (!episodeManifest || !episodeManifest.episodes.length) return;
    selectedIndex = (index + episodeManifest.episodes.length) % episodeManifest.episodes.length;
    item = episodeManifest.episodes[selectedIndex];
    token = ++loadingToken;
    playing = false;
    playheadMs = 0;
    loopRestartAt = 0;
    episode = null;
    compiledTimeline = [];
    assets = {};
    updateEpisodeCardSelection();
    updatePlayButton();
    byId('episodes-status').textContent = 'a carregar folhas';
    byId('episodes-number').textContent = 'Temporada 1 · episódio ' + String(selectedIndex + 1).padStart(2, '0');
    byId('episodes-title').textContent = item.title;
    byId('episodes-logline').textContent = 'A preparar o episódio e a centrar os autocolantes…';
    clearStage('A centrar as spritesheets…');
    clearError();

    fetchJson(new URL('episodes/' + item.file, ROOT_URL)).then(function (loadedEpisode) {
      if (token !== loadingToken) return null;
      return Promise.all((loadedEpisode.sheets || []).map(function (sheetId) {
        return loadSheet(sheetId).then(function (asset) { return [sheetId, asset]; });
      })).then(function (loadedSheets) {
        if (token !== loadingToken) return;
        loadedSheets.forEach(function (entry) { assets[entry[0]] = entry[1]; });
        validateEpisodeReferences(loadedEpisode, assets);
        episode = loadedEpisode;
        compiledTimeline = compileEpisode(episode);
        durationMs = compiledTimeline.length ? compiledTimeline[compiledTimeline.length - 1].endMs : 1;
        byId('episodes-number').textContent = 'Temporada ' + episode.season
          + ' · episódio ' + String(episode.episode).padStart(2, '0');
        byId('episodes-title').textContent = episode.title;
        byId('episodes-logline').textContent = episode.logline;
        byId('episodes-status').textContent = episode.status.replace(/-/g, ' ');
        byId('episodes-time-total').textContent = formatTime(durationMs);
        byId('episodes-sheet-summary').textContent = episode.sheets.length + ' folhas · '
          + compiledTimeline.length + ' beats · ' + formatTime(durationMs)
          + ((episode.missingSheets || []).length
            ? ' · pontes opcionais em falta: ' + episode.missingSheets.join(', ')
            : ' · referências completas');
        renderTimeline();
        render();
        if (autoplay) play();
      });
    }).catch(showError);
  }

  function clearStage(message) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = tokenColor('--muted');
    context.font = '700 18px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(message, canvas.width / 2, canvas.height / 2);
  }

  function activeCompiledStep() {
    if (!compiledTimeline.length) return null;
    if (playheadMs >= durationMs) return compiledTimeline[compiledTimeline.length - 1];
    for (var index = 0; index < compiledTimeline.length; index += 1) {
      if (playheadMs < compiledTimeline[index].endMs) return compiledTimeline[index];
    }
    return compiledTimeline[compiledTimeline.length - 1];
  }

  function frameFor(compiled, forceLast) {
    var step = compiled.step;
    var asset = assets[step.sheet];
    var beat = asset && asset.beats[step.beat];
    var frames = beat && beat.frames ? beat.frames : [];
    var local = clamp(playheadMs - compiled.startMs, 0, compiled.durationMs);
    var offset = Math.max(0, Number(step.startOffsetMs) || 0);
    var progress;
    var frameIndex;
    var reduced;
    var coordinates;
    var row;
    if (!frames.length || (!forceLast && local < offset)) return null;
    progress = forceLast ? 1 : clamp((local - offset) / Math.max(1, compiled.durationMs - offset), 0, 1);
    reduced = byId('episodes-reduced').checked;
    if (reduced) {
      var reducedIndices = [0, Math.floor((frames.length - 1) / 2), frames.length - 1];
      frameIndex = reducedIndices[Math.min(2, Math.floor(progress * 3))];
    } else {
      frameIndex = Math.min(frames.length - 1, Math.floor(progress * frames.length));
    }
    coordinates = frames[frameIndex];
    row = asset.grid.cells[Number(coordinates[1])];
    return row && row[Number(coordinates[0])] ? {
      asset: asset,
      beat: beat,
      cell: row[Number(coordinates[0])],
      frameIndex: frameIndex,
      frameCount: frames.length,
      step: step
    } : null;
  }

  function characterFrame(active) {
    var current;
    var index;
    var savedPlayhead;
    if (active.step.layer === 'character') return frameFor(active, false);
    for (index = active.index - 1; index >= 0; index -= 1) {
      if (compiledTimeline[index].step.layer === 'character') {
        current = frameFor(compiledTimeline[index], true);
        if (current) return current;
      }
    }
    for (index = 0; index < compiledTimeline.length; index += 1) {
      if (compiledTimeline[index].step.layer === 'character') {
        savedPlayhead = playheadMs;
        playheadMs = compiledTimeline[index].startMs;
        current = frameFor(compiledTimeline[index], false);
        playheadMs = savedPlayhead;
        return current;
      }
    }
    return null;
  }

  function anchorOffset(anchor, layer) {
    var map = {
      'logical-cell-centre': [0.18, -0.2],
      head: [0, -0.21],
      'head-right': [0.17, -0.19],
      nose: [0, -0.1],
      cheeks: [0, -0.055],
      paw: [0.13, 0.11],
      paper: [0, 0.17],
      badge: [0.12, 0.04],
      box: [0, 0.16],
      pinwheel: [0.19, -0.05],
      bow: [0, 0.13],
      body: [0, 0]
    };
    if (map[anchor]) return map[anchor];
    if (layer === 'fx') return [0.18, -0.2];
    if (layer === 'prop') return [0.19, -0.12];
    return [0, 0.03];
  }

  function drawFrame(frame, layer) {
    var cell = frame.cell;
    var grid = frame.asset.grid;
    var offset = anchorOffset(frame.step.anchor, layer);
    var targetSpan = layer === 'character' ? 0.5 : (layer === 'prop' ? 0.17 : 0.18);
    var scale = Math.min(
      (canvas.width * targetSpan) / Math.max(1, grid.bodySpanWidth || grid.frameSpanWidth),
      (canvas.height * targetSpan) / Math.max(1, grid.bodySpanHeight || grid.frameSpanHeight)
    );
    var x = (canvas.width / 2) + (offset[0] * canvas.width);
    var y = (canvas.height / 2) + (offset[1] * canvas.height);
    context.save();
    context.globalCompositeOperation = frame.step.blend || 'source-over';
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      cell.spriteCanvas,
      x - (cell.anchorX * scale),
      y - (cell.anchorY * scale),
      cell.sourceWidth * scale,
      cell.sourceHeight * scale
    );
    context.restore();
    if (byId('episodes-guides').checked) drawAnchor(x, y, layer);
  }

  function drawAnchor(x, y, layer) {
    context.save();
    context.strokeStyle = tokenColor(layer === 'character' ? '--moss' : '--gold');
    context.globalAlpha = 0.75;
    context.lineWidth = 2;
    context.setLineDash([7, 5]);
    context.beginPath();
    context.moveTo(x - 17, y);
    context.lineTo(x + 17, y);
    context.moveTo(x, y - 17);
    context.lineTo(x, y + 17);
    context.stroke();
    context.restore();
  }

  function updateLayerChips(layers) {
    Array.prototype.forEach.call(document.querySelectorAll('.episodes-layer-chips span'), function (chip) {
      chip.classList.toggle('is-active', Boolean(layers[chip.dataset.layer]));
    });
  }

  function updateTimelineSelection(index) {
    if (activeTimelineIndex === index) return;
    activeTimelineIndex = index;
    Array.prototype.forEach.call(document.querySelectorAll('.episodes-timeline button'), function (button, buttonIndex) {
      button.classList.toggle('is-active', buttonIndex === index);
    });
  }

  function render() {
    var active;
    var character;
    var overlay = null;
    var layers = { character: false, prop: false, fx: false };
    var progress;
    if (!episode || !compiledTimeline.length) return;
    active = activeCompiledStep();
    character = characterFrame(active);
    if (active.step.layer !== 'character') overlay = frameFor(active, false);

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (character) {
      drawFrame(character, 'character');
      layers.character = true;
    }
    if (overlay && overlay.step.layer === 'prop' && byId('episodes-props').checked) {
      drawFrame(overlay, 'prop');
      layers.prop = true;
    }
    if (overlay && overlay.step.layer === 'fx' && byId('episodes-fx').checked) {
      drawFrame(overlay, 'fx');
      layers.fx = true;
    }

    progress = clamp(playheadMs / Math.max(1, durationMs), 0, 1);
    byId('episodes-progress').value = String(Math.round(progress * 1000));
    byId('episodes-time-current').textContent = formatTime(playheadMs);
    byId('episodes-beat').textContent = active.step.beat;
    byId('episodes-sheet').textContent = active.step.sheet;
    byId('episodes-layer').textContent = labelForLayer(active.step.layer);
    byId('episodes-frame').textContent = (overlay || character)
      ? ((overlay || character).frameIndex + 1) + '/' + (overlay || character).frameCount
      : 'hold';
    byId('episodes-handoff').hidden = playheadMs < durationMs;
    updateLayerChips(layers);
    updateTimelineSelection(active.index);
  }

  function updatePlayButton() {
    byId('episodes-play').textContent = playing ? 'Pausa' : (playheadMs >= durationMs ? 'Repetir' : 'Reproduzir');
  }

  function play() {
    if (!episode) return;
    if (playheadMs >= durationMs) playheadMs = 0;
    playing = true;
    loopRestartAt = 0;
    lastTick = performance.now();
    updatePlayButton();
  }

  function pause() {
    playing = false;
    loopRestartAt = 0;
    updatePlayButton();
  }

  function tick(now) {
    var delta;
    var speed;
    if (playing && episode) {
      delta = Math.min(80, Math.max(0, now - lastTick));
      lastTick = now;
      speed = Math.max(0.25, Number(byId('episodes-speed').value) || 1);
      if (loopRestartAt) {
        if (now >= loopRestartAt) {
          playheadMs = 0;
          loopRestartAt = 0;
        }
      } else {
        playheadMs = Math.min(durationMs, playheadMs + (delta * speed));
        if (playheadMs >= durationMs) {
          if (byId('episodes-loop').checked) {
            loopRestartAt = now + 650;
          } else {
            playing = false;
            updatePlayButton();
          }
        }
      }
      render();
    }
    window.requestAnimationFrame(tick);
  }

  function bindControls() {
    byId('episodes-play').addEventListener('click', function () {
      if (playing) pause(); else play();
    });
    byId('episodes-restart').addEventListener('click', function () {
      playheadMs = 0;
      loopRestartAt = 0;
      render();
      play();
    });
    byId('episodes-previous').addEventListener('click', function () { selectEpisode(selectedIndex - 1, false); });
    byId('episodes-next').addEventListener('click', function () { selectEpisode(selectedIndex + 1, false); });
    byId('episodes-progress').addEventListener('input', function (event) {
      playheadMs = durationMs * (Number(event.target.value) / 1000);
      loopRestartAt = 0;
      render();
      updatePlayButton();
    });
    ['episodes-fx', 'episodes-props', 'episodes-guides', 'episodes-reduced'].forEach(function (id) {
      byId(id).addEventListener('change', render);
    });
    prefersReducedMotion.addEventListener('change', function (event) {
      byId('episodes-reduced').checked = event.matches;
      render();
    });
  }

  function start() {
    if (!window.MiuSpriteGrid) {
      showError(new Error('O motor MiuSpriteGrid não ficou disponível.'));
      return;
    }
    byId('episodes-reduced').checked = prefersReducedMotion.matches;
    bindControls();
    Promise.all([
      fetchJson(LIBRARY_MANIFEST_URL),
      fetchJson(EPISODE_MANIFEST_URL)
    ]).then(function (loaded) {
      libraryManifest = loaded[0];
      episodeManifest = loaded[1];
      renderEpisodeCards();
      selectEpisode(0, false);
    }).catch(showError);
    window.requestAnimationFrame(tick);
  }

  start();
})(window, document);
