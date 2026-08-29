/**
 * Míu Animation Director · laboratório isolado
 *
 * A quantidade não escolhe uma expressão. Um gesto completo produz atenção,
 * é classificado pela direcção/magnitude/velocidade e dispara uma reacção única.
 */
(function (window, document) {
  'use strict';

  var MANIFEST_URL = 'content/brand/miu/experimental/experimental-full-spritesheet-animations_002.json';
  var QUIET_WINDOW_MS = 190;
  var MIN_ATTENTION_MS = 150;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var IDLE_ACTIONS = [
    { id: 'v5_idle_blink', weight: 6 },
    { id: 'v5_idle_gaze', weight: 2.5 },
    { id: 'v5_idle_ear_twitch', weight: 1.8 },
    { id: 'v5_idle_micro_expression', weight: 1.2 }
  ];

  var REACTIONS = {
    up: {
      small: { animation: 'v5_quantity_up_small', label: 'Oh! Mais.', fx: 'sparkle_soft' },
      medium: { animation: 'v5_quantity_up_medium', label: 'Oh! Boa!', fx: 'sparkles' },
      large: { animation: 'v5_quantity_up_large', label: 'Uau!', fx: 'wow' }
    },
    down: {
      small: { animation: 'v5_quantity_down_small', label: 'Oh… menos.', fx: 'sweat' },
      medium: { animation: 'v5_quantity_down_medium', label: 'Aww…', fx: 'wet_eyes' },
      large: { animation: 'v5_quantity_down_large', label: 'Oh não…', fx: 'tearful' }
    }
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, amount) {
    return a + ((b - a) * amount);
  }

  function smoothstep(value) {
    var t = clamp(value, 0, 1);
    return t * t * (3 - (2 * t));
  }

  function easeOutCubic(value) {
    var t = clamp(value, 0, 1);
    return 1 - Math.pow(1 - t, 3);
  }

  function normalizeQuantity(value, min, max) {
    if (max <= min) return 0.5;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  function formatSigned(value, decimals) {
    var number = Number(value);
    var text = number.toFixed(decimals || 0);
    return number > 0 ? '+' + text : text;
  }

  function randomBetween(min, max) {
    return min + (Math.random() * (max - min));
  }

  function loadManifest() {
    var absoluteManifestUrl = new URL(MANIFEST_URL, window.location.href);
    return fetch(absoluteManifestUrl.href, { credentials: 'same-origin', cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('Manifesto indisponível (HTTP ' + response.status + ').');
        return response.json();
      })
      .then(function (manifest) {
        var grids = {};
        var declarations = manifest.sheets || {};
        var directorSheets = { '5': true, '6': true };
        return Promise.all(Object.keys(declarations).filter(function (sheetId) {
          return directorSheets[sheetId];
        }).map(function (sheetId) {
          var declaration = declarations[sheetId];
          var imageUrl = new URL(declaration.file, absoluteManifestUrl).href;
          return window.MiuSpriteGrid.loadImage(imageUrl).then(function (image) {
            try {
              grids[sheetId] = window.MiuSpriteGrid.detectConnectedGrid(
                image,
                Number(declaration.columns) || 8,
                Number(declaration.rows) || 8
              );
            } catch (error) {
              throw new Error('Folha ' + sheetId + ' · ' + error.message);
            }
          });
        })).then(function () {
          return { manifest: manifest, grids: grids };
        });
      });
  }

  function SpriteActor() {
    this.grids = {};
    this.animations = {};
    this.animation = null;
    this.animationId = '';
    this.frameIndex = 0;
    this.elapsedInFrame = 0;
    this.elapsedTotal = 0;
    this.durationTotal = 1;
    this.loop = false;
    this.finished = false;
  }

  SpriteActor.prototype.configure = function (bundle) {
    var actor = this;
    actor.grids = bundle.grids;
    (bundle.manifest.animations || []).forEach(function (animation) {
      actor.animations[animation.id] = animation;
    });
  };

  SpriteActor.prototype.play = function (animationId, options) {
    var animation = this.animations[animationId];
    if (!animation) throw new Error('Animação desconhecida: ' + animationId);
    options = options || {};
    this.animation = animation;
    this.animationId = animationId;
    this.frameIndex = 0;
    this.elapsedInFrame = 0;
    this.elapsedTotal = 0;
    this.durationTotal = animation.frames.reduce(function (sum, frame) {
      return sum + Math.max(16, Number(frame.durationMs) || 100);
    }, 0);
    this.loop = options.loop === undefined ? Boolean(animation.loop) : Boolean(options.loop);
    this.finished = false;
  };

  SpriteActor.prototype.tick = function (deltaMs, speed) {
    if (!this.animation || this.finished) return false;
    var frames = this.animation.frames;
    var scaledDelta = deltaMs * speed;
    this.elapsedInFrame += scaledDelta;
    this.elapsedTotal += scaledDelta;
    var completed = false;

    while (!this.finished) {
      var duration = Math.max(16, Number(frames[this.frameIndex].durationMs) || 100);
      if (this.elapsedInFrame < duration) break;
      this.elapsedInFrame -= duration;
      this.frameIndex += 1;
      if (this.frameIndex < frames.length) continue;
      if (this.loop) {
        this.frameIndex = 0;
        this.elapsedTotal %= this.durationTotal;
      } else {
        this.frameIndex = frames.length - 1;
        this.elapsedInFrame = 0;
        this.elapsedTotal = this.durationTotal;
        this.finished = true;
        completed = true;
      }
    }
    return completed;
  };

  SpriteActor.prototype.currentFrame = function () {
    if (!this.animation) return null;
    return this.animation.frames[this.frameIndex] || null;
  };

  SpriteActor.prototype.progress = function () {
    return clamp(this.elapsedTotal / Math.max(1, this.durationTotal), 0, 1);
  };

  SpriteActor.prototype.currentCell = function () {
    var frame = this.currentFrame();
    if (!frame) return null;
    var grid = this.grids[String(frame.sheet)];
    if (!grid) return null;
    var coordinates = frame.cell || [0, 0];
    var row = grid.cells[Number(coordinates[1])];
    return row ? { grid: grid, cell: row[Number(coordinates[0])], frame: frame } : null;
  };

  function AnimationDirector(actor) {
    this.actor = actor;
    this.min = 0;
    this.max = 10;
    this.value = 6;
    this.previousValue = 6;
    this.phase = 'loading';
    this.phaseStartedAt = performance.now();
    this.idleStartedAt = this.phaseStartedAt;
    this.nextIdleAt = 0;
    this.lastIdleAction = '';
    this.gesture = null;
    this.velocity = 0;
    this.direction = 'none';
    this.magnitude = 'none';
    this.magnitudeScore = 0;
    this.reaction = '—';
    this.effect = 'none';
    this.oneShot = null;
    this.eventLog = [];
    this.demoRunning = false;
  }

  AnimationDirector.prototype.log = function (message) {
    var seconds = (performance.now() / 1000).toFixed(1);
    this.eventLog.unshift(seconds + 's · ' + message);
    this.eventLog = this.eventLog.slice(0, 6);
  };

  AnimationDirector.prototype.setPhase = function (phase) {
    if (this.phase === phase) return;
    this.phase = phase;
    this.phaseStartedAt = performance.now();
    this.log('fase → ' + phase);
  };

  AnimationDirector.prototype.start = function () {
    this.startIdle('v5_idle_blink');
  };

  AnimationDirector.prototype.startIdle = function (animationId) {
    this.gesture = null;
    this.direction = 'none';
    this.magnitude = 'none';
    this.magnitudeScore = 0;
    this.reaction = 'quietinho';
    this.effect = 'none';
    this.oneShot = null;
    this.setPhase('idle');
    this.idleStartedAt = performance.now();
    this.playIdleAction(animationId || 'v5_idle_blink');
  };

  AnimationDirector.prototype.playIdleAction = function (animationId) {
    this.lastIdleAction = animationId;
    this.actor.play(animationId, { loop: false });
    this.nextIdleAt = 0;
    this.log('idle · ' + animationId);
  };

  AnimationDirector.prototype.scheduleNextIdle = function () {
    this.nextIdleAt = performance.now() + randomBetween(650, 2200);
  };

  AnimationDirector.prototype.pickIdleAction = function () {
    var elapsedIdle = performance.now() - this.idleStartedAt;
    var pool = IDLE_ACTIONS.filter(function (item) {
      return !item.afterMs || elapsedIdle >= item.afterMs;
    });
    var total = pool.reduce(function (sum, item) { return sum + item.weight; }, 0);
    var cursor = Math.random() * total;
    for (var index = 0; index < pool.length; index += 1) {
      cursor -= pool[index].weight;
      if (cursor <= 0) return pool[index].id;
    }
    return 'v5_idle_blink';
  };

  AnimationDirector.prototype.beginInteraction = function (options) {
    options = options || {};
    if (this.oneShot) {
      this.log('interacção recebida durante ' + this.oneShot + ' (reacção adiada)');
      return false;
    }
    if (this.gesture) return true;
    var now = performance.now();
    this.gesture = {
      event: options.event || 'quantity_change',
      source: options.source || 'slider',
      startValue: this.value,
      lastValue: this.value,
      startedAt: now,
      lastInputAt: now,
      maxSpeed: 0,
      importance: clamp(Number(options.importance) || 0, 0, 1),
      semanticDirection: options.semanticDirection || '',
      holdOpen: Boolean(options.holdOpen),
      endRequested: false
    };
    this.direction = 'none';
    this.magnitude = 'pending';
    this.magnitudeScore = 0;
    this.reaction = 'Oi? O que aconteceu?';
    this.effect = 'attention';
    this.setPhase('attention');
    this.actor.play('v5_attention_start', { loop: true });
    this.log('atenção · ' + this.gesture.source + ' desde ' + this.value);
    return true;
  };

  AnimationDirector.prototype.updateQuantity = function (options) {
    options = options || {};
    var nextMin = Number.isFinite(Number(options.min)) ? Number(options.min) : this.min;
    var nextMax = Number.isFinite(Number(options.max)) ? Number(options.max) : this.max;
    var nextValue = clamp(Number(options.value), nextMin, nextMax);
    var now = performance.now();

    this.min = nextMin;
    this.max = nextMax;
    this.previousValue = this.value;

    if (!this.gesture && !this.oneShot && options.silent !== true) {
      this.beginInteraction(options);
    }

    var delta = nextValue - this.value;
    this.value = nextValue;

    if (this.oneShot) return this.snapshot();
    if (!this.gesture) return this.snapshot();

    var elapsedSeconds = Math.max(0.016, (now - this.gesture.lastInputAt) / 1000);
    var instantVelocity = delta / elapsedSeconds;
    this.velocity = clamp((this.velocity * 0.58) + (instantVelocity * 0.42), -80, 80);
    if (now - this.gesture.startedAt >= 50) {
      this.gesture.maxSpeed = Math.max(this.gesture.maxSpeed, Math.abs(instantVelocity));
    }
    this.gesture.lastValue = nextValue;
    this.gesture.lastInputAt = now;
    this.gesture.endRequested = false;

    var gestureDelta = nextValue - this.gesture.startValue;
    this.direction = this.gesture.event === 'pack_selected'
      ? (this.gesture.semanticDirection || 'up')
      : (gestureDelta > 0 ? 'up' : (gestureDelta < 0 ? 'down' : 'none'));
    var trackingAnimation = this.direction === 'up'
      ? 'v5_tracking_up'
      : (this.direction === 'down' ? 'v5_tracking_down' : 'v5_attention_start');
    if (this.actor.animationId !== trackingAnimation) {
      this.actor.play(trackingAnimation, { loop: true });
    }
    this.reaction = this.direction === 'up'
      ? 'a acompanhar ↑'
      : (this.direction === 'down' ? 'a acompanhar ↓' : 'atento');
    this.effect = 'attention';
    this.setPhase('tracking');
    return this.snapshot();
  };

  AnimationDirector.prototype.requestInteractionEnd = function () {
    if (!this.gesture || this.oneShot) return false;
    this.gesture.endRequested = true;
    return true;
  };

  AnimationDirector.prototype.finishGesture = function () {
    if (!this.gesture || this.oneShot) return;
    var gesture = this.gesture;
    var range = Math.max(1, this.max - this.min);
    var signedDelta = this.value - gesture.startValue;
    var isPackSelection = gesture.event === 'pack_selected';
    var direction = isPackSelection
      ? 'up'
      : (signedDelta > 0 ? 'up' : (signedDelta < 0 ? 'down' : gesture.semanticDirection));
    var relativeDelta = isPackSelection ? 0 : Math.abs(signedDelta) / range;
    var velocityBoost = isPackSelection ? 0 : Math.min(0.22, (gesture.maxSpeed / range) * 0.045);
    var score = clamp(isPackSelection ? gesture.importance : Math.max(relativeDelta, gesture.importance) + velocityBoost, 0, 1);

    this.gesture = null;
    this.velocity *= 0.35;

    if (!direction || direction === 'none' || score < 0.015) {
      this.log('gesto sem alteração · regressar');
      this.startRecovery();
      return;
    }

    var magnitude = score < 0.28 ? 'small' : (score < 0.62 ? 'medium' : 'large');
    var reaction = REACTIONS[direction][magnitude];
    this.direction = direction;
    this.magnitude = magnitude;
    this.magnitudeScore = score;
    this.reaction = isPackSelection
      ? (magnitude === 'small' ? 'Olá!' : (magnitude === 'medium' ? 'Oh! Boa!' : 'Uau!'))
      : reaction.label;
    this.effect = reaction.fx;
    this.setPhase('reaction');
    this.actor.play(reaction.animation, { loop: false });
    this.log((gesture.event || 'quantity_change') + ' · ' + direction + ' · ' + magnitude + ' · Δ ' + formatSigned(signedDelta));
  };

  AnimationDirector.prototype.startRecovery = function () {
    this.effect = 'none';
    this.reaction = 'a assentar';
    this.setPhase('recovery');
    this.actor.play('v5_recovery', { loop: false });
  };

  AnimationDirector.prototype.playOneShot = function (name) {
    if (name !== 'rejoice') return false;
    this.gesture = null;
    this.oneShot = name;
    this.direction = 'up';
    this.magnitude = 'large';
    this.magnitudeScore = 1;
    this.reaction = 'Yay!';
    this.effect = 'celebrate';
    this.setPhase('one-shot');
    this.actor.play('v5_rejoice', { loop: false });
    this.log('one-shot prioritário · rejoice');
    return true;
  };

  AnimationDirector.prototype.selectPack = function (options) {
    options = options || {};
    this.beginInteraction({
      event: 'pack_selected',
      source: options.label || 'pack',
      importance: options.importance,
      semanticDirection: 'up'
    });
    this.updateQuantity({
      value: options.value,
      min: options.min,
      max: options.max,
      event: 'pack_selected',
      source: options.label || 'pack',
      importance: options.importance,
      semanticDirection: 'up'
    });
    if (this.gesture) {
      this.gesture.importance = clamp(Number(options.importance) || 0, 0, 1);
      this.gesture.semanticDirection = 'up';
      this.gesture.event = 'pack_selected';
      this.gesture.endRequested = true;
    }
  };

  AnimationDirector.prototype.onAnimationComplete = function () {
    if (this.phase === 'reaction' || this.phase === 'one-shot') {
      this.oneShot = null;
      this.startRecovery();
      return;
    }
    if (this.phase === 'recovery') {
      this.startIdle('v5_idle_blink');
      return;
    }
    if (this.phase === 'idle') this.scheduleNextIdle();
  };

  AnimationDirector.prototype.tick = function (now, deltaMs, speed) {
    var completed = this.actor.tick(deltaMs, speed);
    if (completed) this.onAnimationComplete();

    if (this.gesture && !this.oneShot) {
      var quietFor = now - this.gesture.lastInputAt;
      var attentiveFor = now - this.gesture.startedAt;
      if (
        quietFor >= QUIET_WINDOW_MS
        && attentiveFor >= MIN_ATTENTION_MS
        && (this.gesture.endRequested || !this.gesture.holdOpen || quietFor >= 1800)
      ) {
        this.finishGesture();
      }
    }

    if (this.phase === 'idle' && this.actor.finished && this.nextIdleAt && now >= this.nextIdleAt) {
      this.playIdleAction(this.pickIdleAction());
    }

    this.velocity *= Math.exp(-(deltaMs / 1000) * 2.8);
    if (Math.abs(this.velocity) < 0.01) this.velocity = 0;
  };

  AnimationDirector.prototype.reset = function () {
    this.min = 0;
    this.max = 10;
    this.value = 6;
    this.previousValue = 6;
    this.velocity = 0;
    this.eventLog = [];
    this.startIdle('v5_idle_blink');
    this.log('reset');
    return this.snapshot();
  };

  AnimationDirector.prototype.snapshot = function () {
    var gestureDelta = this.gesture ? this.value - this.gesture.startValue : 0;
    return {
      value: this.value,
      previousValue: this.previousValue,
      normalizedPosition: normalizeQuantity(this.value, this.min, this.max),
      phase: this.phase,
      gestureStart: this.gesture ? this.gesture.startValue : null,
      gestureDelta: gestureDelta,
      direction: this.direction,
      magnitude: this.magnitude,
      magnitudeScore: this.magnitudeScore,
      velocity: this.velocity,
      reaction: this.reaction,
      effect: this.effect,
      oneShot: this.oneShot,
      animation: this.actor.animationId,
      frame: this.actor.frameIndex + 1,
      frameCount: this.actor.animation ? this.actor.animation.frames.length : 0,
      idleAction: this.lastIdleAction,
      eventLog: this.eventLog.slice()
    };
  };

  function tokenColor(name) {
    var style = getComputedStyle(document.documentElement);
    return style.getPropertyValue(name).trim() || getComputedStyle(document.body).color;
  }

  function drawCell(context, actor, motion, showGuides) {
    var current = actor.currentCell();
    if (!current || !current.cell) return;
    var canvas = context.canvas;
    var grid = current.grid;
    var cell = current.cell;
    /* O corpo mantém a mesma escala entre folhas; FX e acessórios não encolhem o Míu. */
    var scale = Math.min(
      (canvas.width * 0.38) / Math.max(1, grid.bodySpanWidth || grid.frameSpanWidth),
      (canvas.height * 0.38) / Math.max(1, grid.bodySpanHeight || grid.frameSpanHeight)
    );

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.save();
    context.translate((canvas.width / 2) + motion.x, (canvas.height / 2) + motion.y);
    context.rotate(motion.rotate);
    context.scale(1 + motion.scaleX, 1 + motion.scaleY);
    context.drawImage(
      cell.spriteCanvas,
      -cell.anchorX * scale,
      -cell.anchorY * scale,
      cell.sourceWidth * scale,
      cell.sourceHeight * scale
    );
    context.restore();

    if (showGuides) {
      context.save();
      context.strokeStyle = tokenColor('--moss');
      context.globalAlpha = 0.6;
      context.lineWidth = 2;
      context.setLineDash([8, 6]);
      context.beginPath();
      context.moveTo((canvas.width / 2) - 20, canvas.height / 2);
      context.lineTo((canvas.width / 2) + 20, canvas.height / 2);
      context.moveTo(canvas.width / 2, (canvas.height / 2) - 20);
      context.lineTo(canvas.width / 2, (canvas.height / 2) + 20);
      context.stroke();
      context.restore();
    }
  }

  function secondaryMotion(director, actor, now, intensity) {
    if (reducedMotion.matches || byId('rig5-frames-only').checked) {
      return { x: 0, y: 0, rotate: 0, scaleX: 0, scaleY: 0 };
    }
    var seconds = now / 1000;
    var elapsed = now - director.phaseStartedAt;
    var progress = actor.progress();
    var strength = intensity * Math.max(0.32, director.magnitudeScore || 0.32);
    var motion = { x: 0, y: 0, rotate: 0, scaleX: 0, scaleY: 0 };

    if (director.phase === 'idle') {
      motion.x = Math.sin(seconds * 0.52) * 0.65 * intensity;
      motion.y = Math.sin(seconds * 1.42) * 1.25 * intensity;
      motion.rotate = Math.sin(seconds * 0.44) * 0.006 * intensity;
      motion.scaleX = Math.sin(seconds * 1.42) * 0.004 * intensity;
      motion.scaleY = -motion.scaleX;
      return motion;
    }

    if (director.phase === 'attention' || director.phase === 'tracking') {
      var attention = easeOutCubic(elapsed / 180);
      var trend = director.direction === 'down' ? -1 : (director.direction === 'up' ? 1 : 0);
      motion.x = trend * Math.min(3.5, Math.abs(director.velocity) * 0.10) * intensity;
      motion.y = -5 * attention * intensity;
      motion.rotate = trend * 0.012 * attention * intensity;
      motion.scaleX = 0.018 * attention * intensity;
      motion.scaleY = 0.018 * attention * intensity;
      return motion;
    }

    if (director.phase === 'reaction') {
      var arc = Math.sin(progress * Math.PI);
      if (director.direction === 'up') {
        motion.y = -16 * arc * strength;
        motion.rotate = Math.sin(progress * Math.PI * 2) * 0.025 * strength;
        motion.scaleX = -0.025 * arc * strength;
        motion.scaleY = 0.04 * arc * strength;
      } else {
        motion.y = 10 * arc * strength;
        motion.rotate = -0.018 * arc * strength;
        motion.scaleX = 0.035 * arc * strength;
        motion.scaleY = -0.035 * arc * strength;
      }
      return motion;
    }

    if (director.phase === 'one-shot') {
      var jump = Math.sin(progress * Math.PI);
      motion.y = -20 * jump * intensity;
      motion.rotate = Math.sin(progress * Math.PI * 3) * 0.035 * (1 - progress) * intensity;
      motion.scaleX = -0.035 * jump * intensity;
      motion.scaleY = 0.055 * jump * intensity;
      return motion;
    }

    if (director.phase === 'recovery') {
      var decay = Math.pow(1 - progress, 2);
      var settle = Math.sin(progress * Math.PI * 3) * decay;
      motion.y = settle * 3 * intensity;
      motion.rotate = settle * 0.012 * intensity;
    }
    return motion;
  }

  function drawSparkle(context, x, y, radius, rotation) {
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
  }

  function drawDrop(context, x, y, size) {
    context.beginPath();
    context.moveTo(x, y - size);
    context.bezierCurveTo(x + size, y, x + size * 0.7, y + size, x, y + size);
    context.bezierCurveTo(x - size * 0.7, y + size, x - size, y, x, y - size);
    context.fill();
  }

  function drawEffects(context, director, now, intensity) {
    if (byId('rig5-frames-only').checked || director.effect === 'none') return;
    var canvas = context.canvas;
    var cx = canvas.width / 2;
    var cy = canvas.height / 2;
    var progress = director.actor.progress();
    var pulse = 0.72 + (Math.sin((now / 1000) * 9) * 0.18);
    var gold = tokenColor('--gold');
    var moss = tokenColor('--moss');
    var water = tokenColor('--sage');

    context.save();
    context.globalAlpha = reducedMotion.matches ? 0.72 : clamp(intensity, 0.25, 1);

    if (director.effect === 'attention') {
      context.fillStyle = moss;
      context.font = '700 68px Georgia, serif';
      context.fillText('?', cx + 104, cy - 112 - (reducedMotion.matches ? 0 : Math.sin(now / 170) * 4));
      context.globalAlpha *= 0.45;
      context.strokeStyle = moss;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(cx, cy - 10, 126 + (pulse * 3), -0.8, 0.1);
      context.stroke();
    }

    if (director.effect === 'sparkle_soft' || director.effect === 'sparkles' || director.effect === 'celebrate' || director.effect === 'wow') {
      context.fillStyle = gold;
      var count = director.effect === 'sparkle_soft' ? 2 : (director.effect === 'sparkles' ? 4 : 7);
      for (var sparkleIndex = 0; sparkleIndex < count; sparkleIndex += 1) {
        var angle = (-1.2 + (sparkleIndex / Math.max(1, count - 1)) * 2.4) + (now / 1800);
        var distance = 118 + ((sparkleIndex % 2) * 35);
        drawSparkle(
          context,
          cx + (Math.cos(angle) * distance),
          cy - 16 + (Math.sin(angle) * distance * 0.78),
          (8 + ((sparkleIndex % 3) * 4)) * pulse,
          angle
        );
      }
    }

    if (director.effect === 'wow') {
      context.strokeStyle = moss;
      context.lineWidth = 5;
      context.globalAlpha *= 0.58;
      for (var ray = 0; ray < 14; ray += 1) {
        var rayAngle = (Math.PI * 2 * ray) / 14;
        var inner = 150 + ((ray % 2) * 9);
        var outer = inner + 36 + (pulse * 9);
        context.beginPath();
        context.moveTo(cx + Math.cos(rayAngle) * inner, cy + Math.sin(rayAngle) * inner);
        context.lineTo(cx + Math.cos(rayAngle) * outer, cy + Math.sin(rayAngle) * outer);
        context.stroke();
      }
      context.globalAlpha = 0.9;
      context.fillStyle = gold;
      context.font = '700 72px Georgia, serif';
      context.fillText('!', cx + 112, cy - 114);
    }

    if (director.effect === 'sweat') {
      context.fillStyle = water;
      context.globalAlpha *= 0.78;
      drawDrop(context, cx + 110, cy - 74, 15 * pulse);
    }

    if (director.effect === 'wet_eyes' || director.effect === 'tearful') {
      context.strokeStyle = water;
      context.fillStyle = water;
      context.lineWidth = director.effect === 'tearful' ? 7 : 5;
      context.globalAlpha *= director.effect === 'tearful' ? 0.82 : 0.6;
      [-42, 42].forEach(function (offset) {
        context.beginPath();
        context.ellipse(cx + offset, cy - 26, 24, 10 + (pulse * 2), 0, 0.15, Math.PI - 0.15);
        context.stroke();
        drawSparkle(context, cx + offset - 7, cy - 36, 5 + (pulse * 2), 0);
      });
      if (director.effect === 'tearful') {
        drawDrop(context, cx + 47, cy + 3 + (reducedMotion.matches ? 0 : progress * 15), 11);
        context.globalAlpha *= 0.55;
        context.beginPath();
        context.moveTo(cx - 79, cy - 5);
        context.quadraticCurveTo(cx - 60, cy - 17, cx - 42, cy - 5);
        context.quadraticCurveTo(cx - 22, cy + 7, cx - 4, cy - 5);
        context.stroke();
      }
    }

    context.restore();
  }

  var quantityInput = byId('rig5-quantity');
  var rawCanvas = byId('rig5-raw');
  var directorCanvas = byId('rig5-director');
  var rawContext = rawCanvas.getContext('2d');
  var directorContext = directorCanvas.getContext('2d');
  var intensityInput = byId('rig5-intensity');
  var speedInput = byId('rig5-speed');
  var guideInput = byId('rig5-guides');
  var demoTimers = [];
  var actor = new SpriteActor();
  var director = new AnimationDirector(actor);
  var lastTimestamp = 0;

  function updateUi() {
    var snapshot = director.snapshot();
    quantityInput.value = String(snapshot.value);
    byId('rig5-quantity-value').textContent = String(snapshot.value);
    byId('rig5-summary-value').textContent = String(snapshot.value);
    byId('rig5-summary-phase').textContent = snapshot.phase;
    byId('rig5-summary-delta').textContent = formatSigned(snapshot.gestureDelta);
    byId('rig5-summary-reaction').textContent = snapshot.reaction;

    byId('rig5-debug-value').textContent = String(snapshot.value);
    byId('rig5-debug-position').textContent = snapshot.normalizedPosition.toFixed(3) + ' · não escolhe a cara';
    byId('rig5-debug-start').textContent = snapshot.gestureStart === null ? '—' : String(snapshot.gestureStart);
    byId('rig5-debug-delta').textContent = formatSigned(snapshot.gestureDelta);
    byId('rig5-debug-velocity').textContent = snapshot.velocity.toFixed(2) + ' u/s';
    byId('rig5-debug-phase').textContent = snapshot.phase;
    byId('rig5-debug-direction').textContent = snapshot.direction;
    byId('rig5-debug-magnitude').textContent = snapshot.magnitude + (snapshot.magnitudeScore ? ' · ' + snapshot.magnitudeScore.toFixed(2) : '');
    byId('rig5-debug-reaction').textContent = snapshot.reaction;
    byId('rig5-debug-animation').textContent = snapshot.animation || '—';
    byId('rig5-debug-fx').textContent = snapshot.effect;
    byId('rig5-debug-one-shot').textContent = snapshot.oneShot || '—';
    byId('rig5-debug-frame').textContent = snapshot.frame + '/' + snapshot.frameCount;

    byId('rig5-raw-status').textContent = (snapshot.animation || '—') + ' · frame artístico ' + snapshot.frame + '/' + snapshot.frameCount;
    byId('rig5-director-status').textContent = snapshot.phase + ' · ' + snapshot.reaction + ' · FX ' + snapshot.effect;
    byId('rig5-motion-badge').textContent = reducedMotion.matches ? 'Reduced motion' : snapshot.phase;
    byId('rig5-intensity-out').textContent = intensityInput.value + '%';
    byId('rig5-speed-out').textContent = (Number(speedInput.value) / 100).toFixed(2) + '×';

    Array.prototype.forEach.call(document.querySelectorAll('[data-phase]'), function (lane) {
      var lanePhase = lane.dataset.phase;
      var active = lanePhase === snapshot.phase
        || (lanePhase === 'attention' && snapshot.phase === 'tracking');
      lane.classList.toggle('is-active', active);
    });

    var log = byId('rig5-event-log');
    log.innerHTML = '';
    (snapshot.eventLog.length ? snapshot.eventLog : ['—']).forEach(function (entry) {
      var item = document.createElement('li');
      item.textContent = entry;
      log.appendChild(item);
    });
  }

  function render(timestamp) {
    var intensity = Number(intensityInput.value) / 100;
    var motion = secondaryMotion(director, actor, timestamp, intensity);
    drawCell(rawContext, actor, { x: 0, y: 0, rotate: 0, scaleX: 0, scaleY: 0 }, guideInput.checked);
    drawCell(directorContext, actor, motion, guideInput.checked);
    drawEffects(directorContext, director, timestamp, intensity);
  }

  function loop(timestamp) {
    var deltaMs = lastTimestamp ? Math.min(50, timestamp - lastTimestamp) : 16;
    lastTimestamp = timestamp;
    director.tick(timestamp, deltaMs, Number(speedInput.value) / 100);
    render(timestamp);
    updateUi();
    window.requestAnimationFrame(loop);
  }

  function startSliderGesture() {
    director.beginInteraction({ event: 'quantity_change', source: 'slider', holdOpen: true });
  }

  function updateFromSlider() {
    director.updateQuantity({
      value: quantityInput.value,
      min: quantityInput.min,
      max: quantityInput.max,
      event: 'quantity_change',
      source: 'slider'
    });
  }

  function endSliderGesture() {
    director.requestInteractionEnd();
  }

  function performDiscreteChange(value, source) {
    director.beginInteraction({ event: 'quantity_change', source: source || 'button' });
    director.updateQuantity({
      value: value,
      min: quantityInput.min,
      max: quantityInput.max,
      event: 'quantity_change',
      source: source || 'button'
    });
    director.requestInteractionEnd();
  }

  function cancelDemo(message) {
    demoTimers.forEach(function (timer) { window.clearTimeout(timer); });
    demoTimers = [];
    director.demoRunning = false;
    byId('rig5-stop-demo').disabled = true;
    if (message) byId('rig5-demo-status').textContent = message;
  }

  function runGesture(values, interval, label, options) {
    options = options || {};
    cancelDemo();
    director.demoRunning = true;
    byId('rig5-stop-demo').disabled = false;
    byId('rig5-demo-status').textContent = label + ' · atenção contínua durante o gesto.';

    if (Number.isFinite(Number(options.startValue))) {
      director.updateQuantity({ value: Number(options.startValue), min: 0, max: 10, silent: true });
    }
    director.beginInteraction({
      event: options.event || 'quantity_change',
      source: label,
      importance: options.importance,
      semanticDirection: options.semanticDirection,
      holdOpen: true
    });
    values.forEach(function (value, index) {
      demoTimers.push(window.setTimeout(function () {
        director.updateQuantity({
          value: value,
          min: 0,
          max: 10,
          event: options.event || 'quantity_change',
          source: label,
          importance: options.importance,
          semanticDirection: options.semanticDirection
        });
        if (index === values.length - 1) {
          director.requestInteractionEnd();
          demoTimers.push(window.setTimeout(function () {
            cancelDemo(label + ' · gesto concluído; uma única reacção foi escolhida.');
          }, 700));
        }
      }, index * interval));
    });
  }

  quantityInput.addEventListener('pointerdown', startSliderGesture);
  quantityInput.addEventListener('keydown', function (event) {
    if (event.key.indexOf('Arrow') === 0 || event.key === 'Home' || event.key === 'End') startSliderGesture();
  });
  quantityInput.addEventListener('input', updateFromSlider);
  quantityInput.addEventListener('change', endSliderGesture);
  quantityInput.addEventListener('pointerup', endSliderGesture);
  quantityInput.addEventListener('pointercancel', endSliderGesture);
  quantityInput.addEventListener('keyup', endSliderGesture);

  Array.prototype.forEach.call(document.querySelectorAll('[data-quantity-nudge]'), function (button) {
    button.addEventListener('click', function () {
      performDiscreteChange(director.value + Number(button.dataset.quantityNudge), 'botão ' + button.textContent.trim());
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-pack-value]'), function (button) {
    button.addEventListener('click', function () {
      director.selectPack({
        value: Number(button.dataset.packValue),
        min: 0,
        max: 10,
        importance: Number(button.dataset.packImportance),
        label: button.textContent.trim()
      });
    });
  });

  byId('rig5-attention').addEventListener('click', function () {
    director.beginInteraction({ event: 'debug_attention', source: 'debug' });
    window.setTimeout(function () { director.requestInteractionEnd(); }, 520);
  });

  byId('rig5-continue').addEventListener('click', function () {
    cancelDemo();
    director.playOneShot('rejoice');
  });

  byId('rig5-reset').addEventListener('click', function () {
    cancelDemo('Reset concluído.');
    director.reset();
  });

  byId('rig5-demo-buttons').addEventListener('click', function (event) {
    var button = event.target.closest('[data-demo]');
    if (!button) return;
    var demo = button.dataset.demo;
    if (demo === 'small-up') runGesture([2, 3], 260, '1 → 3', { startValue: 1 });
    if (demo === 'large-up') runGesture([3, 5, 7, 9], 75, '2 → 9 rápido', { startValue: 2 });
    if (demo === 'large-down') runGesture([8, 6, 4, 2], 75, '9 → 2 rápido', { startValue: 9 });
    if (demo === 'slow-down') runGesture([7, 6, 5, 4], 420, '8 → 4 lento', { startValue: 8 });
    if (demo === 'oscillation') runGesture([6, 5, 6, 5], 130, '5 ↔ 6', { startValue: 5 });
    if (demo === 'pack-large') runGesture([10], 120, 'Pack grande', {
      startValue: director.value,
      event: 'pack_selected',
      importance: 0.9,
      semanticDirection: 'up'
    });
    if (demo === 'purchase') {
      cancelDemo();
      director.updateQuantity({ value: 6, min: 0, max: 10, silent: true });
      director.playOneShot('rejoice');
      byId('rig5-demo-status').textContent = 'Compra concluída · rejoice prioritário e regresso ao idle.';
    }
  });

  byId('rig5-stop-demo').addEventListener('click', function () {
    cancelDemo('Demonstração parada.');
    director.startRecovery();
  });

  function handleReducedMotion() {
    byId('rig5-motion-badge').textContent = reducedMotion.matches ? 'Reduced motion' : director.phase;
  }
  if (typeof reducedMotion.addEventListener === 'function') reducedMotion.addEventListener('change', handleReducedMotion);
  else if (typeof reducedMotion.addListener === 'function') reducedMotion.addListener(handleReducedMotion);

  window.miu = {
    quantity: {
      begin: function (options) { return director.beginInteraction(options); },
      set: function (options) { return director.updateQuantity(options); },
      end: function () { return director.requestInteractionEnd(); }
    },
    updateQuantityReaction: function (options) {
      options = options || {};
      if (Number.isFinite(Number(options.previousValue))) {
        director.updateQuantity({
          value: Number(options.previousValue),
          min: options.min,
          max: options.max,
          silent: true
        });
      }
      director.beginInteraction(options);
      director.updateQuantity(options);
      director.requestInteractionEnd();
      return director.snapshot();
    },
    selectPack: function (options) { return director.selectPack(options); },
    playOneShot: function (name) { return director.playOneShot(name); },
    reset: function () { return director.reset(); },
    debug: function () { return director.snapshot(); },
    config: {
      reactions: REACTIONS,
      idleActions: IDLE_ACTIONS,
      normalizeQuantity: normalizeQuantity
    }
  };

  loadManifest().then(function (bundle) {
    actor.configure(bundle);
    director.start();
    byId('rig5-loading').hidden = true;
    window.requestAnimationFrame(loop);
  }).catch(function (error) {
    var errorBox = byId('rig5-error');
    errorBox.hidden = false;
    errorBox.textContent = error.message;
    byId('rig5-loading').textContent = 'Falha ao carregar o laboratório.';
  });
})(window, document);
