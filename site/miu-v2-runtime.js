/**
 * Míu Animation Director V2 · runtime público, sem dependências externas.
 *
 * O valor de quantidade nunca escolhe uma frame. Um gesto abre atenção,
 * agrega os eventos, mede direcção/magnitude/velocidade, toca uma reacção e
 * regressa ao idle vivo. As caras continuam sempre a vir dos PNG artísticos.
 */
(function (window, document) {
  'use strict';

  var activeController = null;
  var spriteGridPromise = null;

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function finite(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function randomBetween(minimum, maximum) {
    return minimum + (Math.random() * Math.max(0, maximum - minimum));
  }

  function easeOutCubic(value) {
    var amount = clamp(value, 0, 1);
    return 1 - Math.pow(1 - amount, 3);
  }

  function fetchJson(url) {
    return window.fetch(url, { credentials: 'same-origin', cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status + ' ao carregar ' + url);
      return response.json();
    });
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error('Não foi possível carregar ' + url)); };
      image.src = url;
    });
  }

  function loadScriptOnce(url) {
    if (window.MiuSpriteGrid) return Promise.resolve(window.MiuSpriteGrid);
    if (spriteGridPromise) return spriteGridPromise;
    spriteGridPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = function () {
        if (window.MiuSpriteGrid) resolve(window.MiuSpriteGrid);
        else reject(new Error('MiuSpriteGrid não ficou disponível.'));
      };
      script.onerror = function () { reject(new Error('Não foi possível carregar o detector de sprites.')); };
      document.head.appendChild(script);
    });
    return spriteGridPromise;
  }

  function Actor(reducedMotion) {
    this.reducedMotion = reducedMotion;
    this.gridDetector = null;
    this.manifest = null;
    this.manifestUrl = '';
    this.animations = {};
    this.grids = {};
    this.sheetPromises = {};
    this.animation = null;
    this.animationId = '';
    this.frames = [];
    this.frameIndex = 0;
    this.elapsedInFrame = 0;
    this.elapsedTotal = 0;
    this.durationTotal = 1;
    this.loop = false;
    this.finished = false;
  }

  Actor.prototype.configure = function (manifest, manifestUrl, gridDetector) {
    var actor = this;
    actor.manifest = manifest || {};
    actor.manifestUrl = manifestUrl;
    actor.gridDetector = typeof gridDetector === 'function' ? gridDetector : null;
    (manifest.animations || []).forEach(function (animation) {
      if (animation && animation.id) actor.animations[String(animation.id)] = animation;
    });
  };

  Actor.prototype.loadSheet = function (sheetId) {
    var actor = this;
    var key = String(sheetId);
    var declaration = actor.manifest && actor.manifest.sheets ? actor.manifest.sheets[key] : null;
    if (actor.grids[key]) return Promise.resolve(actor.grids[key]);
    if (actor.sheetPromises[key]) return actor.sheetPromises[key];
    if (!declaration || !declaration.file || !declaration.grid) {
      return Promise.reject(new Error('Folha V2 desconhecida: ' + key));
    }
    var imageUrl = new URL(declaration.file, actor.manifestUrl).href;
    actor.sheetPromises[key] = loadImage(imageUrl).then(function (image) {
      var grid = declaration.grid;
      if (actor.gridDetector) {
        var detected = actor.gridDetector(
          image,
          Math.max(1, Math.round(finite(grid.columns, 8))),
          Math.max(1, Math.round(finite(grid.rows, 8)))
        );
        detected.image = image;
        detected.kind = 'detected';
        detected.anchorStrategy = 'connected-components-median-anatomical-centres';
        actor.grids[key] = detected;
        return detected;
      }
      grid.image = image;
      grid.kind = 'precomputed';
      actor.grids[key] = grid;
      return grid;
    });
    return actor.sheetPromises[key];
  };

  Actor.prototype.registerDetectedGrid = function (sheetId, grid) {
    grid.kind = 'detected';
    this.grids[String(sheetId)] = grid;
  };

  Actor.prototype.animationSheets = function (animation) {
    var result = {};
    (animation && animation.frames ? animation.frames : []).forEach(function (frame) {
      result[String(frame.sheet)] = true;
    });
    return Object.keys(result);
  };

  Actor.prototype.prepare = function (animation) {
    var actor = this;
    return Promise.all(actor.animationSheets(animation).map(function (sheetId) {
      return actor.grids[sheetId] ? Promise.resolve(actor.grids[sheetId]) : actor.loadSheet(sheetId);
    }));
  };

  Actor.prototype.reduceFrames = function (frames) {
    if (!this.reducedMotion || frames.length <= 3) return frames.slice();
    return [frames[0], frames[Math.floor((frames.length - 1) / 2)], frames[frames.length - 1]];
  };

  Actor.prototype.playDefinition = function (animation, options) {
    options = options || {};
    var frames = Array.isArray(animation.frames) ? animation.frames : [];
    if (!frames.length) return false;
    this.animation = animation;
    this.animationId = String(animation.id || options.id || 'custom');
    this.frames = options.keepAllFrames ? frames.slice() : this.reduceFrames(frames);
    this.frameIndex = 0;
    this.elapsedInFrame = 0;
    this.elapsedTotal = 0;
    this.durationTotal = this.frames.reduce(function (sum, frame) {
      return sum + Math.max(16, finite(frame.durationMs, 100));
    }, 0);
    this.loop = options.loop === undefined ? Boolean(animation.loop) : Boolean(options.loop);
    this.finished = false;
    return true;
  };

  Actor.prototype.play = function (animationId, options) {
    var animation = this.animations[String(animationId)];
    if (!animation) return Promise.reject(new Error('Animação V2 desconhecida: ' + animationId));
    var actor = this;
    return actor.prepare(animation).then(function () {
      actor.playDefinition(animation, options || {});
      return animation;
    });
  };

  Actor.prototype.playCustom = function (id, frames, options) {
    return this.playDefinition({ id: id, frames: frames, loop: false }, options || {});
  };

  Actor.prototype.tick = function (deltaMs, speed) {
    if (!this.frames.length || this.finished) return false;
    this.elapsedInFrame += deltaMs * speed;
    this.elapsedTotal += deltaMs * speed;
    var completed = false;
    while (!this.finished) {
      var duration = Math.max(16, finite(this.frames[this.frameIndex].durationMs, 100));
      if (this.elapsedInFrame < duration) break;
      this.elapsedInFrame -= duration;
      this.frameIndex += 1;
      if (this.frameIndex < this.frames.length) continue;
      if (this.loop && !this.reducedMotion) {
        this.frameIndex = 0;
        this.elapsedTotal %= this.durationTotal;
      } else {
        this.frameIndex = this.frames.length - 1;
        this.elapsedInFrame = 0;
        this.elapsedTotal = this.durationTotal;
        this.finished = true;
        completed = true;
      }
    }
    return completed;
  };

  Actor.prototype.progress = function () {
    return clamp(this.elapsedTotal / Math.max(1, this.durationTotal), 0, 1);
  };

  Actor.prototype.current = function () {
    if (!this.frames.length) return null;
    var frame = this.frames[this.frameIndex];
    var grid = this.grids[String(frame.sheet)];
    var coordinates = frame.cell || [0, 0];
    var row = grid && grid.cells ? grid.cells[finite(coordinates[1], 0)] : null;
    var cell = row ? row[finite(coordinates[0], 0)] : null;
    return grid && cell ? { frame: frame, grid: grid, cell: cell } : null;
  };

  function Controller(options) {
    this.config = options.config;
    this.root = options.root;
    this.launcher = options.launcher;
    this.siteRoot = options.siteRoot;
    this.onReady = typeof options.onReady === 'function' ? options.onReady : function () {};
    this.reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    this.reducedMotion = this.config.reducedMotion && this.config.reducedMotion.enabled !== false && this.reducedQuery.matches;
    this.actor = new Actor(this.reducedMotion);
    this.canvas = null;
    this.context = null;
    this.raf = 0;
    this.lastTimestamp = 0;
    this.phase = 'loading';
    this.phaseStartedAt = performance.now();
    this.phaseCompletedAt = 0;
    this.currentValue = 0;
    this.previousValue = 0;
    this.minimum = 0;
    this.maximum = 10;
    this.velocity = 0;
    this.direction = 'none';
    this.magnitude = 'none';
    this.magnitudeScore = 0;
    this.effect = 'none';
    this.oneShot = '';
    this.special = '';
    this.gesture = null;
    this.queuedQuantity = null;
    this.nextIdleAt = 0;
    this.nextAmbientAt = 0;
    this.playSerial = 0;
    this.libraryManifest = null;
    this.libraryPromise = null;
    this.dynamicSheetPromises = {};
    this.dynamicSheetData = {};
    this.episodeManifest = null;
    this.episodeManifestPromise = null;
    this.boundQuantity = this.onQuantityEvent.bind(this);
    this.boundStep = this.onStepCompleted.bind(this);
    this.boundVisibility = this.onVisibility.bind(this);
    this.boundLayout = this.scheduleNavigationClearance.bind(this);
    this.navigationClearance = 0;
    this.layoutFrame = 0;
    this.layoutObserver = null;
    this.lastIdleAnimationId = '';
    this.lastVariationIndex = {};
    this.activeVariation = 'none';
    this.motionVariationBias = 0;
    this.lastHoverAt = -Infinity;
  }

  Controller.prototype.log = function () {
    if (!this.config.debug || !this.config.debug.console || !window.console) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[Míu V2]');
    window.console.log.apply(window.console, args);
  };

  Controller.prototype.scheduleNavigationClearance = function () {
    var controller = this;
    if (controller.layoutFrame) return;
    controller.layoutFrame = window.requestAnimationFrame(function () {
      controller.layoutFrame = 0;
      controller.updateNavigationClearance();
    });
  };

  Controller.prototype.updateNavigationClearance = function () {
    if (!this.root || !this.root.isConnected) return;
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    if (viewportWidth > 700) {
      if (!this.navigationClearance) return;
      this.navigationClearance = 0;
      this.root.style.setProperty('--miu-navigation-clearance', '0px');
      return;
    }
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    var rootRect = this.root.getBoundingClientRect();
    var computedBottom = parseFloat(window.getComputedStyle(this.root).bottom) || 0;
    var baseBottom = Math.max(0, computedBottom - this.navigationClearance);
    var baselineTop = viewportHeight - baseBottom - rootRect.height;
    var targetTop = Infinity;

    Array.prototype.forEach.call(document.querySelectorAll('.step-actions'), function (actions) {
      var style = window.getComputedStyle(actions);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      var rect = actions.getBoundingClientRect();
      if (rect.height <= 0 || rect.width <= 0 || rect.bottom <= 0 || rect.top >= viewportHeight) return;
      var pinnedToBottom = (style.position === 'sticky' || style.position === 'fixed') && rect.bottom >= viewportHeight - 3;
      var overlapsBaseline = rect.bottom > baselineTop && rect.top < viewportHeight - baseBottom;
      var navigationIsLow = rect.top >= viewportHeight * 0.52;
      if (pinnedToBottom || overlapsBaseline || navigationIsLow) targetTop = Math.min(targetTop, rect.top);
    });

    var clearance = targetTop < Infinity
      ? Math.max(0, viewportHeight - targetTop + 8 - baseBottom)
      : 0;
    clearance = Math.min(clearance, Math.max(0, viewportHeight - rootRect.height - baseBottom - 8));
    if (Math.abs(clearance - this.navigationClearance) < 0.5) return;
    this.navigationClearance = clearance;
    this.root.style.setProperty('--miu-navigation-clearance', clearance.toFixed(2) + 'px');
  };

  Controller.prototype.watchNavigationClearance = function () {
    var controller = this;
    window.addEventListener('resize', controller.boundLayout, { passive: true });
    document.addEventListener('scroll', controller.boundLayout, { passive: true, capture: true });
    if (window.MutationObserver && document.body) {
      controller.layoutObserver = new MutationObserver(controller.boundLayout);
      controller.layoutObserver.observe(document.body, { childList: true, subtree: true });
    }
    controller.scheduleNavigationClearance();
  };

  Controller.prototype.setPhase = function (phase) {
    if (this.phase === phase) return false;
    this.phase = phase;
    this.phaseStartedAt = performance.now();
    this.phaseCompletedAt = 0;
    this.emitState();
    return true;
  };

  Controller.prototype.emitState = function () {
    var detail = this.snapshot();
    try { document.dispatchEvent(new CustomEvent('mia:miu-v2-state', { detail: detail })); } catch (error) {}
  };

  Controller.prototype.animationVariant = function (animation, group) {
    var variation = this.config.variation || {};
    var patterns = group && Array.isArray(variation[group + 'Patterns'])
      ? variation[group + 'Patterns'] : [];
    if (variation.enabled === false || !patterns.length || !animation || !Array.isArray(animation.frames)) {
      this.activeVariation = 'none';
      this.motionVariationBias = 0;
      return animation;
    }

    var available = [];
    for (var index = 0; index < patterns.length; index += 1) {
      if (patterns.length === 1 || index !== this.lastVariationIndex[group]) available.push(index);
    }
    var selectedIndex = available[Math.floor(Math.random() * available.length)];
    var pattern = patterns[selectedIndex] || [];
    var frames = pattern.map(function (frameIndex) {
      return animation.frames[Math.round(finite(frameIndex, 0))];
    }).filter(Boolean);
    if (frames.length < 2) {
      this.activeVariation = 'none';
      this.motionVariationBias = 0;
      return animation;
    }

    this.lastVariationIndex[group] = selectedIndex;
    this.activeVariation = group + '-' + (selectedIndex + 1);
    this.motionVariationBias = selectedIndex % 3 === 1 ? -1 : (selectedIndex % 3 === 2 ? 1 : 0);
    return Object.assign({}, animation, { frames: frames });
  };

  Controller.prototype.play = function (animationId, options) {
    var controller = this;
    options = options || {};
    var serial = ++controller.playSerial;
    var animation = controller.actor.animations[String(animationId)];
    if (!animation) {
      controller.log('Animação V2 desconhecida:', animationId);
      return Promise.resolve(false);
    }
    var playable = controller.animationVariant(animation, options.variantGroup || '');
    return controller.actor.prepare(playable).then(function () {
      if (serial !== controller.playSerial) return false;
      controller.actor.playDefinition(playable, options);
      controller.emitState();
      return true;
    }).catch(function (error) {
      controller.log(error.message);
      return false;
    });
  };

  Controller.prototype.baseIdleId = function () {
    var items = this.config.animations && Array.isArray(this.config.animations.idle)
      ? this.config.animations.idle : [];
    return items.length && items[0] && items[0].id
      ? String(items[0].id) : 'v1_idle_calm_complete';
  };

  Controller.prototype.pickIdle = function () {
    var items = this.config.animations && Array.isArray(this.config.animations.idle)
      ? this.config.animations.idle : [];
    if (!items.length) return this.baseIdleId();
    var controller = this;
    var eligible = items.filter(function (item) {
      return items.length === 1 || String(item.id) !== controller.lastIdleAnimationId;
    });
    var total = eligible.reduce(function (sum, item) { return sum + Math.max(0.05, finite(item.weight, 1)); }, 0);
    var cursor = Math.random() * total;
    for (var index = 0; index < eligible.length; index += 1) {
      cursor -= Math.max(0.05, finite(eligible[index].weight, 1));
      if (cursor <= 0) {
        controller.lastIdleAnimationId = String(eligible[index].id);
        return controller.lastIdleAnimationId;
      }
    }
    controller.lastIdleAnimationId = String(eligible[0].id);
    return controller.lastIdleAnimationId;
  };

  Controller.prototype.startIdle = function (animationId) {
    this.gesture = null;
    this.oneShot = '';
    this.special = '';
    this.effect = 'none';
    this.direction = 'none';
    this.magnitude = 'none';
    this.magnitudeScore = 0;
    this.setPhase('idle');
    var selectedAnimationId = animationId || this.pickIdle();
    if (animationId) this.lastIdleAnimationId = String(animationId);
    this.play(selectedAnimationId, { loop: false });
    this.nextIdleAt = 0;
    this.scheduleAmbient();
  };

  Controller.prototype.scheduleIdle = function () {
    var timing = this.config.timing || {};
    this.nextIdleAt = performance.now() + randomBetween(finite(timing.idleMinMs, 14000), finite(timing.idleMaxMs, 28000));
  };

  Controller.prototype.scheduleAmbient = function () {
    var library = this.config.library || {};
    if (!library.ambientEpisodes) { this.nextAmbientAt = 0; return; }
    this.nextAmbientAt = performance.now() + randomBetween(finite(library.ambientMinMs, 60000), finite(library.ambientMaxMs, 120000));
  };

  Controller.prototype.beginGesture = function (options) {
    options = options || {};
    if (this.oneShot || this.special) return false;
    if (this.gesture) return true;
    var now = performance.now();
    var start = finite(options.previousValue, this.currentValue);
    this.gesture = {
      source: String(options.source || 'quantity'),
      startValue: start,
      lastValue: start,
      startedAt: now,
      lastInputAt: now,
      maxSpeed: 0,
      endRequested: false,
      importance: clamp(finite(options.importance, 0), 0, 1)
    };
    this.currentValue = start;
    this.previousValue = start;
    this.effect = 'attention';
    this.direction = 'none';
    this.magnitude = 'pending';
    this.setPhase('attention');
    this.play(this.config.animations.attention, { loop: true, variantGroup: 'attention' });
    return true;
  };

  Controller.prototype.updateQuantity = function (options) {
    options = options || {};
    var value = finite(options.value, finite(options.currentValue, this.currentValue));
    var minimum = finite(options.min, this.minimum);
    var maximum = finite(options.max, this.maximum);
    if (maximum <= minimum) maximum = minimum + 1;
    value = clamp(value, minimum, maximum);

    if (this.oneShot || this.special) {
      this.queuedQuantity = options;
      return this.snapshot();
    }
    if (options.silent === true) {
      this.minimum = minimum;
      this.maximum = maximum;
      this.previousValue = value;
      this.currentValue = value;
      return this.snapshot();
    }
    if (!this.gesture) {
      this.beginGesture({
        previousValue: finite(options.previousValue, this.currentValue),
        source: options.source,
        importance: options.importance
      });
    }
    if (!this.gesture) return this.snapshot();

    var now = performance.now();
    var delta = value - this.gesture.lastValue;
    var elapsedSeconds = Math.max(0.016, (now - this.gesture.lastInputAt) / 1000);
    var instantVelocity = delta / elapsedSeconds;
    this.minimum = minimum;
    this.maximum = maximum;
    this.previousValue = this.currentValue;
    this.currentValue = value;
    this.velocity = clamp((this.velocity * 0.58) + (instantVelocity * 0.42), -250, 250);
    this.gesture.maxSpeed = Math.max(this.gesture.maxSpeed, Math.abs(instantVelocity));
    this.gesture.lastValue = value;
    this.gesture.lastInputAt = now;
    this.gesture.endRequested = options.end === true;

    var totalDelta = value - this.gesture.startValue;
    this.direction = totalDelta > 0 ? 'up' : (totalDelta < 0 ? 'down' : 'none');
    this.effect = 'attention';
    var trackingId = this.direction === 'down' ? this.config.animations.trackingDown : this.config.animations.trackingUp;
    var phaseChanged = this.setPhase('tracking');
    if (phaseChanged || this.actor.animationId !== trackingId) {
      this.play(trackingId, { loop: true });
    }
    return this.snapshot();
  };

  Controller.prototype.endGesture = function () {
    if (!this.gesture) return false;
    this.gesture.endRequested = true;
    return true;
  };

  Controller.prototype.finishGesture = function () {
    if (!this.gesture || this.oneShot || this.special) return false;
    var gesture = this.gesture;
    var range = Math.max(1, this.maximum - this.minimum);
    var delta = this.currentValue - gesture.startValue;
    var direction = delta > 0 ? 'up' : (delta < 0 ? 'down' : 'none');
    var relative = Math.abs(delta) / range;
    var velocityBoost = Math.min(0.25, (gesture.maxSpeed / range) * finite(this.config.thresholds.velocityWeight, 0.045));
    var score = clamp(Math.max(relative, gesture.importance) + velocityBoost, 0, 1);
    this.gesture = null;
    this.velocity *= 0.35;
    if (direction === 'none' || score < 0.015) {
      this.direction = 'none';
      this.magnitude = 'none';
      this.magnitudeScore = 0;
      this.startRecovery();
      return true;
    }
    var magnitude = score < finite(this.config.thresholds.smallMax, 0.28)
      ? 'small' : (score < finite(this.config.thresholds.mediumMax, 0.62) ? 'medium' : 'large');
    var key = direction + magnitude.charAt(0).toUpperCase() + magnitude.slice(1);
    this.direction = direction;
    this.magnitude = magnitude;
    this.magnitudeScore = score;
    this.effect = direction === 'up'
      ? (magnitude === 'small' ? 'sparkle_soft' : (magnitude === 'medium' ? 'sparkles' : 'wow'))
      : (magnitude === 'small' ? 'sweat' : (magnitude === 'medium' ? 'wet_eyes' : 'tearful'));
    this.setPhase('reaction');
    this.play(this.config.animations[key], { loop: false, variantGroup: 'reaction' });
    return true;
  };

  Controller.prototype.startRecovery = function () {
    this.effect = 'none';
    this.setPhase('recovery');
    this.play(this.config.animations.recovery, { loop: false });
  };

  Controller.prototype.playReaction = function (direction, magnitude, score) {
    if (this.oneShot || this.special) return false;
    magnitude = magnitude || 'small';
    var key = direction + magnitude.charAt(0).toUpperCase() + magnitude.slice(1);
    this.gesture = null;
    this.direction = direction;
    this.magnitude = magnitude;
    this.magnitudeScore = finite(score, 0.2);
    this.effect = direction === 'up' ? (magnitude === 'large' ? 'wow' : 'sparkle_soft') : 'sweat';
    this.setPhase('reaction');
    this.play(this.config.animations[key], { loop: false, variantGroup: 'reaction' });
    return true;
  };

  Controller.prototype.playOneShot = function (name) {
    if (name !== 'rejoice') return false;
    this.gesture = null;
    this.oneShot = 'rejoice';
    this.special = '';
    this.direction = 'up';
    this.magnitude = 'large';
    this.magnitudeScore = 1;
    this.effect = 'celebrate';
    this.setPhase('one-shot');
    this.play(this.config.animations.rejoice, { loop: false });
    return true;
  };

  Controller.prototype.attentionPulse = function (source) {
    if (this.oneShot || this.special || this.gesture) return false;
    this.beginGesture({ previousValue: this.currentValue, source: source || 'attention', importance: 0 });
    if (this.gesture) this.gesture.endRequested = true;
    return true;
  };

  Controller.prototype.onQuantityEvent = function (event) {
    var detail = event && event.detail ? event.detail : {};
    var source = String(detail.source || 'quantity');
    if (source === 'pack' && this.config.triggers.packs === false) return;
    if (source !== 'pack' && this.config.triggers.quantity === false) return;
    this.updateQuantity({
      value: finite(detail.currentValue, detail.value),
      previousValue: detail.previousValue,
      min: detail.min,
      max: detail.max,
      source: source,
      importance: detail.importance
    });
  };

  Controller.prototype.onStepCompleted = function (event) {
    var detail = event && event.detail ? event.detail : {};
    var stepId = String(detail.stepId || '');
    var ids = this.config.triggers.continueStepIds || [];
    if (this.config.triggers.continueRejoice && ids.indexOf(stepId) !== -1) {
      this.playOneShot('rejoice');
    }
  };

  Controller.prototype.onVisibility = function () {
    if (!document.hidden) this.lastTimestamp = performance.now();
  };

  Controller.prototype.trigger = function (name) {
    if (name === 'launcher_hover' && this.config.triggers.launcherAttention) {
      var now = performance.now();
      var cooldown = finite(this.config.variation && this.config.variation.hoverCooldownMs, 4200);
      if (now - this.lastHoverAt < cooldown) return false;
      var played = this.attentionPulse('launcher-hover');
      if (played) this.lastHoverAt = now;
      return played;
    }
    if (name === 'launcher_open' && this.config.triggers.chatReactions) return this.playReaction('up', 'small', 0.18);
    if (name === 'message_sent' && this.config.triggers.chatReactions) return this.attentionPulse('message');
    if (name === 'reply_end' && this.config.triggers.chatReactions) return this.playReaction('up', 'small', 0.2);
    if (name === 'inactivity' && this.phase === 'idle') {
      this.play(this.pickIdle(), { loop: false });
      return true;
    }
    return false;
  };

  Controller.prototype.loadLibraryManifest = function () {
    var controller = this;
    if (controller.libraryManifest) return Promise.resolve(controller.libraryManifest);
    if (controller.libraryPromise) return controller.libraryPromise;
    var url = new URL(controller.config.assets.libraryManifest, controller.siteRoot).href;
    controller.libraryPromise = fetchJson(url).then(function (manifest) {
      controller.libraryManifest = { data: manifest, url: url };
      return controller.libraryManifest;
    });
    return controller.libraryPromise;
  };

  Controller.prototype.loadDynamicSheet = function (sheetId) {
    var controller = this;
    var key = 'library:' + String(sheetId);
    if (controller.dynamicSheetData[key]) return Promise.resolve(controller.dynamicSheetData[key]);
    if (controller.dynamicSheetPromises[key]) return controller.dynamicSheetPromises[key];
    controller.dynamicSheetPromises[key] = controller.loadLibraryManifest().then(function (library) {
      var declaration = library.data.sheets ? library.data.sheets[sheetId] : null;
      if (!declaration) throw new Error('Folha da biblioteca desconhecida: ' + sheetId);
      var imageUrl = new URL(declaration.file, library.url).href;
      var metadataUrl = new URL(declaration.metadata, library.url).href;
      var detectorUrl = new URL('miu-sprite-grid.js?v=' + encodeURIComponent(controller.config.assets.cacheVersion || ''), controller.siteRoot).href;
      return Promise.all([
        loadImage(imageUrl),
        fetchJson(metadataUrl),
        loadScriptOnce(detectorUrl)
      ]).then(function (parts) {
        var grid = parts[2].detectConnectedGrid(parts[0], 8, 8);
        controller.actor.registerDetectedGrid(key, grid);
        controller.dynamicSheetData[key] = { grid: grid, metadata: parts[1], key: key, declaration: declaration };
        return controller.dynamicSheetData[key];
      });
    });
    return controller.dynamicSheetPromises[key];
  };

  Controller.prototype.setMood = function (name, intensity) {
    if (!this.config.library.manualEmotions || this.oneShot || this.special) return false;
    var aliases = {
      happy: 'ekman-happiness', happiness: 'ekman-happiness', alegria: 'ekman-happiness',
      sad: 'ekman-sadness', sadness: 'ekman-sadness', tristeza: 'ekman-sadness',
      angry: 'ekman-anger', anger: 'ekman-anger', zanga: 'ekman-anger',
      fear: 'ekman-fear', medo: 'ekman-fear',
      surprise: 'ekman-surprise', surpresa: 'ekman-surprise',
      disgust: 'ekman-disgust', desagrado: 'ekman-disgust',
      contempt: 'ekman-contempt', desdem: 'ekman-contempt', 'desdém': 'ekman-contempt'
    };
    var sheetId = aliases[String(name || '').toLowerCase()] || String(name || '');
    var controller = this;
    controller.special = 'mood:' + sheetId;
    controller.oneShot = '';
    controller.gesture = null;
    controller.effect = 'none';
    controller.setPhase('mood');
    controller.loadDynamicSheet(sheetId).then(function (loaded) {
      if (controller.special !== 'mood:' + sheetId) return;
      var rows = loaded.metadata.variants || loaded.metadata.beats || [];
      var amount = clamp(finite(intensity, 0.5), 0, 1);
      var usableMaximum = Math.max(0, rows.length - 2);
      var row = rows[Math.round(amount * usableMaximum)] || rows[0];
      var duration = Math.max(45, finite(loaded.metadata.defaultFrameDurationMs, 110));
      var frames = (row.frames || []).map(function (cell) {
        return { sheet: loaded.key, cell: cell, durationMs: duration };
      });
      controller.actor.playCustom(controller.special, frames, { loop: false });
      controller.emitState();
    }).catch(function (error) {
      controller.log(error.message);
      controller.special = '';
      controller.startRecovery();
    });
    return true;
  };

  Controller.prototype.loadEpisodeManifest = function () {
    var controller = this;
    if (controller.episodeManifest) return Promise.resolve(controller.episodeManifest);
    if (controller.episodeManifestPromise) return controller.episodeManifestPromise;
    var url = new URL(controller.config.assets.episodeManifest, controller.siteRoot).href;
    controller.episodeManifestPromise = fetchJson(url).then(function (manifest) {
      controller.episodeManifest = { data: manifest, url: url };
      return controller.episodeManifest;
    });
    return controller.episodeManifestPromise;
  };

  Controller.prototype.playEpisode = function (episodeId) {
    if (!this.config.library.manualEpisodes || this.oneShot || this.special) return false;
    var controller = this;
    var id = String(episodeId || '');
    controller.special = 'episode:' + id;
    controller.oneShot = '';
    controller.gesture = null;
    controller.effect = 'none';
    controller.setPhase('episode-loading');
    controller.loadEpisodeManifest().then(function (manifest) {
      var summary = (manifest.data.episodes || []).find(function (item) { return String(item.id) === id; });
      if (!summary) throw new Error('Episódio desconhecido: ' + id);
      var episodeUrl = new URL(summary.file, manifest.url).href;
      return fetchJson(episodeUrl);
    }).then(function (episode) {
      var counts = {};
      (episode.timeline || []).forEach(function (step) {
        if (step.type === 'clip' && step.layer === 'character' && String(step.sheet).indexOf('transition-') !== 0) {
          counts[step.sheet] = (counts[step.sheet] || 0) + 1;
        }
      });
      var primarySheet = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
      if (!primarySheet) throw new Error('O episódio não tem uma folha principal de personagem.');
      return Promise.all([Promise.resolve(episode), controller.loadDynamicSheet(primarySheet)]).then(function (parts) {
        return { episode: parts[0], primarySheet: primarySheet, loaded: parts[1] };
      });
    }).then(function (bundle) {
      if (controller.special !== 'episode:' + id) return;
      var metadataRows = bundle.loaded.metadata.beats || bundle.loaded.metadata.variants || [];
      var rowById = {};
      metadataRows.forEach(function (row) { rowById[String(row.id)] = row; });
      var frames = [];
      (bundle.episode.timeline || []).forEach(function (step) {
        if (step.type !== 'clip' || step.layer !== 'character' || step.sheet !== bundle.primarySheet) return;
        var row = rowById[String(step.beat)];
        if (!row || !Array.isArray(row.frames) || !row.frames.length) return;
        var duration = Math.max(45, finite(step.durationMs, 480) / row.frames.length);
        row.frames.forEach(function (cell) {
          frames.push({ sheet: bundle.loaded.key, cell: cell, durationMs: duration });
        });
      });
      if (!frames.length) throw new Error('O episódio não produziu frames reproduzíveis.');
      controller.setPhase('episode');
      controller.actor.playCustom(controller.special, frames, { loop: false, keepAllFrames: true });
      controller.emitState();
    }).catch(function (error) {
      controller.log(error.message);
      controller.special = '';
      controller.startRecovery();
    });
    return true;
  };

  Controller.prototype.maybePlayAmbientEpisode = function (now) {
    var library = this.config.library || {};
    if (!library.ambientEpisodes || !this.nextAmbientAt || now < this.nextAmbientAt || this.phase !== 'idle') return;
    this.scheduleAmbient();
    if (Math.random() > finite(library.ambientProbability, 0.12)) return;
    var ids = Array.isArray(library.episodeIds) ? library.episodeIds : [];
    if (ids.length) this.playEpisode(ids[Math.floor(Math.random() * ids.length)]);
  };

  Controller.prototype.processQueuedQuantity = function () {
    if (!this.queuedQuantity) return;
    var queued = this.queuedQuantity;
    this.queuedQuantity = null;
    this.updateQuantity(queued);
  };

  Controller.prototype.tickState = function (now, completed) {
    var timing = this.config.timing || {};
    if (this.gesture && !this.oneShot && !this.special) {
      var quietFor = now - this.gesture.lastInputAt;
      var attentiveFor = now - this.gesture.startedAt;
      if (quietFor >= finite(timing.quietWindowMs, 190) && attentiveFor >= finite(timing.minimumAttentionMs, 150)) {
        this.finishGesture();
      }
    }

    if (completed && !this.phaseCompletedAt) this.phaseCompletedAt = now;
    if (this.phase === 'idle') {
      if (completed && !this.nextIdleAt) this.scheduleIdle();
      if (this.nextIdleAt && now >= this.nextIdleAt) {
        this.play(this.pickIdle(), { loop: false });
        this.nextIdleAt = 0;
        this.phaseCompletedAt = 0;
      }
      this.maybePlayAmbientEpisode(now);
      return;
    }

    if (this.phase === 'reaction' && this.phaseCompletedAt && now - this.phaseCompletedAt >= finite(timing.reactionHoldMs, 110)) {
      this.startRecovery();
      return;
    }
    if (this.phase === 'one-shot' && this.phaseCompletedAt && now - this.phaseCompletedAt >= finite(timing.recoveryDelayMs, 90)) {
      this.oneShot = '';
      this.startRecovery();
      return;
    }
    if ((this.phase === 'mood' || this.phase === 'episode') && this.phaseCompletedAt) {
      this.special = '';
      this.startRecovery();
      return;
    }
    if (this.phase === 'recovery' && this.phaseCompletedAt) {
      this.startIdle();
      this.processQueuedQuantity();
    }
  };

  Controller.prototype.secondaryMotion = function (now) {
    var intensity = finite(this.config.appearance.rigIntensity, 0.62);
    if (this.reducedMotion) intensity = finite(this.config.reducedMotion.secondaryMotion, 0);
    var seconds = now / 1000;
    var elapsed = now - this.phaseStartedAt;
    var progress = this.actor.progress();
    var score = Math.max(0.22, this.magnitudeScore || 0.22);
    var variationScale = this.canvas && this.canvas.clientWidth > 0 ? this.canvas.width / this.canvas.clientWidth : 1;
    var variationOffset = this.motionVariationBias
      * finite(this.config.variation && this.config.variation.rigBiasPx, 1.2)
      * variationScale * intensity;
    var motion = { x: 0, y: 0, rotate: 0, scaleX: 0, scaleY: 0 };
    if (!intensity) return motion;
    if (this.phase === 'idle') {
      motion.x = Math.sin(seconds * 0.52) * 0.65 * intensity;
      motion.y = Math.sin(seconds * 1.42) * 1.25 * intensity;
      motion.rotate = Math.sin(seconds * 0.44) * 0.006 * intensity;
      motion.scaleX = Math.sin(seconds * 1.42) * 0.004 * intensity;
      motion.scaleY = -motion.scaleX;
    } else if (this.phase === 'attention' || this.phase === 'tracking') {
      var attention = easeOutCubic(elapsed / 180);
      var trend = this.direction === 'down' ? -1 : (this.direction === 'up' ? 1 : 0);
      motion.x = trend * Math.min(3.5, Math.abs(this.velocity) * 0.1) * intensity;
      motion.x += variationOffset;
      motion.y = -5 * attention * intensity;
      motion.rotate = (trend * 0.012 * attention * intensity) + (this.motionVariationBias * 0.005 * attention * intensity);
      motion.scaleX = 0.018 * attention * intensity;
      motion.scaleY = 0.018 * attention * intensity;
    } else if (this.phase === 'reaction') {
      var arc = Math.sin(progress * Math.PI);
      if (this.direction === 'up') {
        motion.y = -16 * arc * score * intensity;
        motion.x += variationOffset * arc * 0.65;
        motion.rotate = (Math.sin(progress * Math.PI * 2) * 0.025 * score * intensity)
          + (this.motionVariationBias * 0.004 * arc * intensity);
        motion.scaleX = -0.025 * arc * score * intensity;
        motion.scaleY = 0.04 * arc * score * intensity;
      } else {
        motion.x += variationOffset * arc * 0.45;
        motion.y = 10 * arc * score * intensity;
        motion.rotate = -0.018 * arc * score * intensity;
        motion.scaleX = 0.035 * arc * score * intensity;
        motion.scaleY = -0.035 * arc * score * intensity;
      }
    } else if (this.phase === 'one-shot') {
      var jump = Math.sin(progress * Math.PI);
      motion.y = -20 * jump * intensity;
      motion.rotate = Math.sin(progress * Math.PI * 3) * 0.035 * (1 - progress) * intensity;
      motion.scaleX = -0.035 * jump * intensity;
      motion.scaleY = 0.055 * jump * intensity;
    } else if (this.phase === 'recovery') {
      var decay = Math.pow(1 - progress, 2);
      var settle = Math.sin(progress * Math.PI * 3) * decay;
      motion.y = settle * 3 * intensity;
      motion.rotate = settle * 0.012 * intensity;
    }
    return motion;
  };

  Controller.prototype.idleAlignment = function (current, scale) {
    var appearance = this.config.appearance || {};
    var cell = current && current.cell;
    var grid = current && current.grid;
    if (this.phase !== 'idle' || appearance.idleLockToBubbleCenter === false || !cell || !grid || grid.kind !== 'detected') {
      return { x: 0, y: 0 };
    }
    var localCenterX = finite(cell.centerX, NaN) - finite(cell.minX, NaN);
    var localCenterY = finite(cell.centerY, NaN) - finite(cell.minY, NaN);
    if (!Number.isFinite(localCenterX) || !Number.isFinite(localCenterY)) return { x: 0, y: 0 };
    return {
      x: (finite(cell.anchorX, localCenterX) - localCenterX) * scale,
      y: (finite(cell.anchorY, localCenterY) - localCenterY) * scale
    };
  };

  /**
   * A mesh V2 não cria poses nem redesenha a cara. Divide apenas o sprite já
   * desenhado em bandas horizontais rígidas e dá-lhes um follow-through muito
   * pequeno. A progressão volta sempre a zero no princípio e no fim do take, por
   * isso o keyframe artístico final é apresentado sem deformação local.
   */
  Controller.prototype.meshEnvelope = function (now, rowProgress) {
    var progress = this.actor.progress();
    var follow = clamp(finite(this.config.mesh && this.config.mesh.followThrough, 0.18), 0, 1);
    var lag = clamp(rowProgress * follow * 0.16, 0, 0.16);
    var localProgress = clamp((progress - lag) / Math.max(0.01, 1 - lag), 0, 1);

    if (this.phase === 'idle') {
      return Math.sin((now / 1000) * 1.4 - (rowProgress * follow * 1.8)) * 0.16;
    }
    if (this.phase === 'mood' || this.phase === 'episode' || this.phase === 'loading') return 0;
    if (this.phase === 'recovery') {
      return Math.sin(localProgress * Math.PI * 2) * Math.pow(1 - localProgress, 2) * 0.46;
    }
    return Math.sin(localProgress * Math.PI);
  };

  Controller.prototype.drawSprite = function (current, scale, now, cssScale) {
    var context = this.context;
    var grid = current.grid;
    var cell = current.cell;
    var mesh = this.config.mesh || {};
    var rigIntensity = clamp(finite(this.config.appearance.rigIntensity, 0.62), 0, 1.5);
    var meshEnabled = mesh.enabled !== false && !this.reducedMotion && rigIntensity > 0;
    var maximumOffset = clamp(finite(mesh.maxOffsetPx, 2.4), 0, 8) * cssScale * rigIntensity;
    var rows = Math.round(clamp(finite(mesh.rows, 6), 2, 12));
    var source = grid.kind === 'detected' && cell.spriteCanvas ? cell.spriteCanvas : grid.image;
    var sourceX = grid.kind === 'detected' ? 0 : cell.sourceX;
    var sourceY = grid.kind === 'detected' ? 0 : cell.sourceY;
    var sourceWidth = cell.sourceWidth;
    var sourceHeight = cell.sourceHeight;
    var destinationX = -cell.anchorX * scale;
    var destinationY = -cell.anchorY * scale;

    if (!meshEnabled || !maximumOffset || !source) {
      context.drawImage(
        source,
        sourceX, sourceY, sourceWidth, sourceHeight,
        destinationX, destinationY, sourceWidth * scale, sourceHeight * scale
      );
      return;
    }

    var phaseGain = this.phase === 'one-shot' ? 1 : (this.phase === 'reaction' ? 0.82 : (this.phase === 'attention' || this.phase === 'tracking' ? 0.58 : 0.34));
    var direction = this.direction === 'down' ? -1 : (this.direction === 'up' ? 1 : 0);
    var squashInfluence = clamp(finite(mesh.squashInfluence, 0.012), 0, 0.05);

    for (var index = 0; index < rows; index += 1) {
      var sliceTop = Math.floor((sourceHeight * index) / rows);
      var sliceBottom = index === rows - 1 ? sourceHeight : Math.floor((sourceHeight * (index + 1)) / rows);
      var sliceHeight = Math.max(1, sliceBottom - sliceTop);
      var rowProgress = rows <= 1 ? 0 : index / (rows - 1);
      var headWeight = Math.pow(1 - rowProgress, 1.35);
      var lowerBodyWeight = Math.pow(clamp((rowProgress - 0.58) / 0.42, 0, 1), 1.2);
      var envelope = this.meshEnvelope(now, rowProgress);
      var amplitude = maximumOffset * phaseGain * envelope;
      var idleSway = Math.sin((now / 1000) * 2.1 - (rowProgress * 0.9));
      var localX = amplitude * headWeight * ((direction * 0.52) + (idleSway * 0.18));
      var verticalDirection = this.phase === 'reaction' && this.direction === 'down' ? 0.48 : -0.42;
      var localY = amplitude * headWeight * verticalDirection;
      var localSquash = 1 + (squashInfluence * envelope * lowerBodyWeight * (this.direction === 'down' ? 1 : -0.55));
      var baseWidth = sourceWidth * scale;
      var sliceWidth = baseWidth * localSquash;
      var sliceX = destinationX + localX - ((sliceWidth - baseWidth) / 2);
      var sliceY = destinationY + (sliceTop * scale) + localY;

      context.drawImage(
        source,
        sourceX, sourceY + sliceTop, sourceWidth, sliceHeight,
        sliceX, sliceY, sliceWidth, (sliceHeight * scale) + 0.35
      );
    }
  };

  Controller.prototype.tokenColor = function (token) {
    var styles = window.getComputedStyle(document.documentElement);
    return styles.getPropertyValue(token).trim() || styles.color;
  };

  Controller.prototype.drawSparkle = function (x, y, radius, rotation) {
    var context = this.context;
    context.save();
    context.translate(x, y);
    context.rotate(rotation || 0);
    context.beginPath();
    context.moveTo(0, -radius);
    context.quadraticCurveTo(radius * 0.18, -radius * 0.18, radius, 0);
    context.quadraticCurveTo(radius * 0.18, radius * 0.18, 0, radius);
    context.quadraticCurveTo(-radius * 0.18, radius * 0.18, -radius, 0);
    context.quadraticCurveTo(-radius * 0.18, -radius * 0.18, 0, -radius);
    context.fill();
    context.restore();
  };

  Controller.prototype.drawDrop = function (x, y, size) {
    var context = this.context;
    context.beginPath();
    context.moveTo(x, y - size);
    context.bezierCurveTo(x + size, y, x + size * 0.7, y + size, x, y + size);
    context.bezierCurveTo(x - size * 0.7, y + size, x - size, y, x, y - size);
    context.fill();
  };

  Controller.prototype.drawEffects = function (now) {
    if (!this.config.appearance.showFx || this.effect === 'none') return;
    var context = this.context;
    var cx = this.canvas.width / 2;
    var cy = this.canvas.height / 2;
    var pulse = this.reducedMotion ? 0.82 : 0.72 + (Math.sin((now / 1000) * 9) * 0.18);
    var gold = this.tokenColor('--gold');
    var moss = this.tokenColor('--moss');
    var water = this.tokenColor('--sage');
    context.save();
    context.globalAlpha = this.reducedMotion ? 0.68 : clamp(finite(this.config.appearance.rigIntensity, 0.62), 0.25, 1);
    if (this.effect === 'attention') {
      context.fillStyle = moss;
      context.font = '700 54px Georgia, serif';
      context.fillText('?', cx + 86, cy - 92);
    }
    if (['sparkle_soft', 'sparkles', 'celebrate', 'wow'].indexOf(this.effect) !== -1) {
      context.fillStyle = gold;
      var count = this.effect === 'sparkle_soft' ? 2 : (this.effect === 'sparkles' ? 4 : 7);
      for (var index = 0; index < count; index += 1) {
        var angle = -1.2 + (index / Math.max(1, count - 1) * 2.4) + (this.reducedMotion ? 0 : now / 1800);
        var distance = 106 + ((index % 2) * 26);
        this.drawSparkle(cx + Math.cos(angle) * distance, cy - 10 + Math.sin(angle) * distance * 0.72, (7 + ((index % 3) * 3)) * pulse, angle);
      }
    }
    if (this.effect === 'wow') {
      context.strokeStyle = moss;
      context.lineWidth = 4;
      context.globalAlpha *= 0.55;
      for (var ray = 0; ray < 12; ray += 1) {
        var rayAngle = (Math.PI * 2 * ray) / 12;
        context.beginPath();
        context.moveTo(cx + Math.cos(rayAngle) * 126, cy + Math.sin(rayAngle) * 126);
        context.lineTo(cx + Math.cos(rayAngle) * 155, cy + Math.sin(rayAngle) * 155);
        context.stroke();
      }
    }
    if (this.effect === 'sweat') {
      context.fillStyle = water;
      this.drawDrop(cx + 88, cy - 55, 12 * pulse);
    }
    if (this.effect === 'wet_eyes' || this.effect === 'tearful') {
      context.strokeStyle = water;
      context.fillStyle = water;
      context.lineWidth = this.effect === 'tearful' ? 6 : 4;
      [-34, 34].forEach(function (offset) {
        context.beginPath();
        context.ellipse(cx + offset, cy - 20, 19, 8 + (pulse * 2), 0, 0.15, Math.PI - 0.15);
        context.stroke();
      });
      if (this.effect === 'tearful') this.drawDrop(cx + 40, cy + 4, 9);
    }
    context.restore();
  };

  Controller.prototype.render = function (now) {
    var current = this.actor.current();
    var context = this.context;
    var canvas = this.canvas;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!current) return;
    var grid = current.grid;
    var cell = current.cell;
    var motion = this.secondaryMotion(now);
    var bodyHeight = Math.max(1, finite(grid.bodySpanHeight, finite(cell.sourceHeight, canvas.height * 0.66)));
    var scale = ((canvas.height * 0.68) / bodyHeight) * finite(this.config.appearance.scale, 0.96);
    var idleAlignment = this.idleAlignment(current, scale);
    var cssScale = canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : 1;
    var offsetX = finite(this.config.appearance.offsetXPx, 0) * cssScale;
    var offsetY = finite(this.config.appearance.offsetYPx, 0) * cssScale;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.save();
    /* A personagem fica dentro da zona redonda do ícone. O recorte acontece
       só durante o desenho do sprite: os FX anime são desenhados depois e
       podem respirar à volta do balão sem fazer a cabeça flutuar na página. */
    context.beginPath();
    context.arc(canvas.width / 2, canvas.height * 0.47, canvas.width * 0.455, 0, Math.PI * 2);
    context.clip();
    context.translate(
      (canvas.width / 2) + offsetX + motion.x + idleAlignment.x,
      (canvas.height / 2) + offsetY + motion.y + idleAlignment.y
    );
    context.rotate(motion.rotate);
    context.scale(1 + motion.scaleX, 1 + motion.scaleY);
    this.drawSprite(current, scale, now, cssScale);
    context.restore();
    this.drawEffects(now);
  };

  Controller.prototype.loop = function (timestamp) {
    if (!this.canvas || !this.canvas.isConnected) return;
    var delta = this.lastTimestamp ? Math.min(64, timestamp - this.lastTimestamp) : 16;
    this.lastTimestamp = timestamp;
    var completed = this.actor.tick(delta, finite(this.config.timing.speed, 1));
    this.tickState(timestamp, completed);
    this.render(timestamp);
    this.raf = window.requestAnimationFrame(this.loop.bind(this));
  };

  Controller.prototype.snapshot = function () {
    var current = this.actor.current();
    return {
      engine: 'v2',
      phase: this.phase,
      animation: this.actor.animationId,
      frame: this.actor.frameIndex,
      frameCount: this.actor.frames.length,
      value: this.currentValue,
      previousValue: this.previousValue,
      min: this.minimum,
      max: this.maximum,
      normalized: this.maximum <= this.minimum ? 0.5 : clamp((this.currentValue - this.minimum) / (this.maximum - this.minimum), 0, 1),
      direction: this.direction,
      magnitude: this.magnitude,
      magnitudeScore: this.magnitudeScore,
      velocity: this.velocity,
      effect: this.effect,
      oneShot: this.oneShot || null,
      special: this.special || null,
      reducedMotion: this.reducedMotion,
      rigIntensity: finite(this.config.appearance.rigIntensity, 0.62),
      variation: this.activeVariation,
      hoverCooldownMs: finite(this.config.variation && this.config.variation.hoverCooldownMs, 4200),
      navigationClearancePx: this.navigationClearance,
      spriteIsolation: current && current.grid ? current.grid.kind : null,
      anchorStrategy: current && current.grid ? current.grid.anchorStrategy || null : null,
      meshEnabled: Boolean(this.config.mesh && this.config.mesh.enabled !== false && !this.reducedMotion),
      meshRows: finite(this.config.mesh && this.config.mesh.rows, 6)
    };
  };

  Controller.prototype.reset = function () {
    this.queuedQuantity = null;
    this.gesture = null;
    this.playSerial += 1;
    this.startIdle(this.baseIdleId());
    return this.snapshot();
  };

  Controller.prototype.publicApi = function () {
    var controller = this;
    return {
      quantity: {
        begin: function (options) { return controller.beginGesture(options || {}); },
        set: function (options) { return controller.updateQuantity(options || {}); },
        end: function () { return controller.endGesture(); }
      },
      updateQuantityReaction: function (options) { return controller.updateQuantity(options || {}); },
      selectPack: function (options) {
        options = options || {};
        options.source = 'pack';
        options.importance = finite(options.importance, 0.2);
        return controller.updateQuantity(options);
      },
      playOneShot: function (name) { return controller.playOneShot(name); },
      setMood: function (name, intensity) { return controller.setMood(name, intensity); },
      playEpisode: function (id) { return controller.playEpisode(id); },
      trigger: function (name) { return controller.trigger(name); },
      rig: {
        setIntensity: function (value) {
          controller.config.appearance.rigIntensity = clamp(finite(value, controller.config.appearance.rigIntensity), 0, 1.5);
          controller.emitState();
          return controller.snapshot();
        }
      },
      mesh: {
        enable: function (enabled) {
          controller.config.mesh = controller.config.mesh || {};
          controller.config.mesh.enabled = Boolean(enabled);
          controller.emitState();
          return controller.snapshot();
        },
        set: function (options) {
          options = options || {};
          controller.config.mesh = controller.config.mesh || {};
          if (options.rows !== undefined) controller.config.mesh.rows = Math.round(clamp(finite(options.rows, 6), 2, 12));
          if (options.maxOffsetPx !== undefined) controller.config.mesh.maxOffsetPx = clamp(finite(options.maxOffsetPx, 2.4), 0, 8);
          if (options.followThrough !== undefined) controller.config.mesh.followThrough = clamp(finite(options.followThrough, 0.18), 0, 1);
          if (options.squashInfluence !== undefined) controller.config.mesh.squashInfluence = clamp(finite(options.squashInfluence, 0.012), 0, 0.05);
          controller.emitState();
          return controller.snapshot();
        }
      },
      reset: function () { return controller.reset(); },
      debug: function () { return controller.snapshot(); },
      destroy: function () { return controller.destroy(); },
      config: controller.config
    };
  };

  Controller.prototype.mount = function () {
    var controller = this;
    var manifestUrl = new URL(controller.config.assets.coreManifest, controller.siteRoot).href;
    var detectorUrl = new URL(
      'miu-sprite-grid.js?v=' + encodeURIComponent(controller.config.assets.cacheVersion || ''),
      controller.siteRoot
    ).href;
    return Promise.all([fetchJson(manifestUrl), loadScriptOnce(detectorUrl)]).then(function (parts) {
      controller.actor.configure(parts[0], manifestUrl, parts[1].detectConnectedGrid);
      return controller.actor.play(controller.baseIdleId(), { loop: false });
    }).then(function () {
      var resolution = finite(controller.config.appearance.canvasResolution, 360);
      return Promise.resolve().then(function () {
        controller.lastIdleAnimationId = controller.baseIdleId();
        controller.canvas = document.createElement('canvas');
        controller.canvas.className = 'miu-v2-canvas';
        controller.canvas.width = resolution;
        controller.canvas.height = resolution;
        controller.canvas.setAttribute('aria-hidden', 'true');
        controller.context = controller.canvas.getContext('2d', { alpha: true });
        controller.launcher.appendChild(controller.canvas);
        controller.root.style.setProperty('--miu-v2-size-desktop', finite(controller.config.appearance.sizeDesktopPx, 60) + 'px');
        controller.root.style.setProperty('--miu-v2-size-mobile', finite(controller.config.appearance.sizeMobilePx, 60) + 'px');
        controller.setPhase('idle');
        controller.root.classList.add('is-miu-v2-ready');
        document.addEventListener('mia:miu-quantity-change', controller.boundQuantity);
        document.addEventListener('mia:step-completed', controller.boundStep);
        document.addEventListener('visibilitychange', controller.boundVisibility);
        controller.watchNavigationClearance();
        controller.onReady(controller);
        controller.raf = window.requestAnimationFrame(controller.loop.bind(controller));
        var preload = function () {
          ['5', '6'].forEach(function (sheetId) {
            controller.actor.loadSheet(sheetId).catch(function (error) { controller.log(error.message); });
          });
        };
        if (window.requestIdleCallback) window.requestIdleCallback(preload, { timeout: 2500 });
        else window.setTimeout(preload, 500);
        return controller;
      });
    });
  };

  Controller.prototype.destroy = function () {
    window.cancelAnimationFrame(this.raf);
    document.removeEventListener('mia:miu-quantity-change', this.boundQuantity);
    document.removeEventListener('mia:step-completed', this.boundStep);
    document.removeEventListener('visibilitychange', this.boundVisibility);
    window.removeEventListener('resize', this.boundLayout);
    document.removeEventListener('scroll', this.boundLayout, true);
    if (this.layoutObserver) this.layoutObserver.disconnect();
    if (this.layoutFrame) window.cancelAnimationFrame(this.layoutFrame);
    if (this.root) this.root.style.removeProperty('--miu-navigation-clearance');
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    if (this.root) this.root.classList.remove('is-miu-v2-ready');
    if (activeController === this) activeController = null;
    return true;
  };

  window.MiuV2Production = {
    mount: function (options) {
      if (activeController) activeController.destroy();
      activeController = new Controller(options);
      return activeController.mount().then(function (controller) {
        window.miu = controller.publicApi();
        return controller;
      });
    },
    current: function () { return activeController; }
  };
})(window, document);
