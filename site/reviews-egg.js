/* REVIEW_BALLOON_EGG_V1
   Easter egg da homepage: quando o utilizador faz scroll rapido junto ao fundo,
   o balao das reviews deixa de estar colado ao "chao" (a posicao elevada que
   evita o footer) e passa a comportar-se como uma bola. Cada subida rapida do
   chao funciona como uma pancada e transfere velocidade para a bola, o que
   permite dar toques seguidos. Se um toque a atirar ate ao topo do ecra, o
   icone da marca e desalojado e cai para a festa, reagindo a inclinacao do
   telemovel quando o sensor esta disponivel.

   Custo: zero no servidor (tudo no cliente) e o requestAnimationFrame so corre
   enquanto ha movimento; em repouso o unico trabalho e um listener de scroll
   que le uma custom property inline. */
(function () {
  "use strict";

  var host = document.getElementById("review-bubbles");
  if (!host) return;

  var GRAVITY = 2600;          // px/s^2
  var KICK_MIN = 300;          // velocidade minima do chao (px/s) para contar
  var KICK_TRANSFER = 1.35;    // quanto da velocidade do chao passa para a bola
  var MAX_LAUNCH = 2500;       // px/s
  var RESTITUTION = 0.4;       // ressalto sem pancada
  var SLEEP_SPEED = 42;        // px/s abaixo do qual a bola adormece
  var SLEEP_MS = 900;          // tempo parada antes de desistir
  var IDLE_MS = 20000;         // travao de seguranca global
  var FLOOR_TAU = 0.075;       // suavizacao do chao (s)
  var KNOCK_RATIO = 0.85;      // fracao da altura do ecra que desaloja o icone
  var ICON_SIZE = 46;
  var MAX_SPIN = 520;          // deg/s; sem isto o icone parece um piao
  var ROLL_DEG = 180 / (Math.PI * (ICON_SIZE / 2)); // graus por px a rolar
  var DEFAULT_PUMPS = 7;       // usado enquanto o reviews.js nao trouxe a definicao
  var PUMP_WINDOW = 1200;      // ms entre movimentos para a serie continuar viva
  var PUMP_RELEASE = 0.6;      // fracao de KICK_MIN a descer que fecha o movimento

  var card = null;
  var cardWidth = 0;
  var cardHeight = 0;
  var hostLeft = 0;

  var active = false;
  var frame = null;
  var lastTime = 0;
  var sleepTime = 0;
  var idleSince = 0;

  var target = 0;              // chao pedido pelo reviews.js (px do fundo)
  var floor = 0;               // chao suavizado, o que a bola realmente toca
  var floorSpeed = 0;          // px/s, positivo a subir
  var ballY = 0;               // aresta inferior da bola (px do fundo)
  var ballSpeed = 0;
  var spin = 0;
  var spinSpeed = 0;
  var squash = 0;

  var icon = null;
  var iconState = null;
  var lastBallTop = 0;
  var tiltX = 0;
  var tiltAsked = false;
  var tiltListening = false;
  var tiltSource = null;
  var tiltSamples = 0;
  var lastTiltAt = 0;

  var scrollFrame = null;
  var lastTarget = null;
  var lastTargetTime = 0;
  var pumps = 0;
  var pumpOpen = false;
  var lastPumpTime = 0;

  // Quantos movimentos completos sao precisos; o reviews.js escreve a definicao
  // do painel de admin no dataset do host. 0 desliga o easter egg.
  function requiredPumps() {
    var raw = host.getAttribute("data-egg-pumps");
    if (raw === null || raw === "") return DEFAULT_PUMPS;
    var value = parseInt(raw, 10);
    return isFinite(value) && value >= 0 ? value : DEFAULT_PUMPS;
  }

  function resetPumps() {
    pumps = 0;
    pumpOpen = false;
  }

  function readTarget() {
    var raw = host.style.getPropertyValue("--review-bottom");
    if (!raw) return null;
    var value = parseFloat(raw);
    return isFinite(value) ? value : null;
  }

  function measure() {
    if (!card) card = host.querySelector(".review-bubble-card");
    if (!card) return false;
    var rect = card.getBoundingClientRect();
    if (!rect.width) return false;
    cardWidth = rect.width;
    cardHeight = rect.height;
    hostLeft = rect.left;
    return true;
  }

  // O chao move-se por causa do footer; enquanto a bola esta em repouso basta
  // observar essa variacao para saber se houve uma pancada.
  function onScroll() {
    if (scrollFrame !== null) return;
    scrollFrame = window.requestAnimationFrame(function () {
      scrollFrame = null;
      var value = readTarget();
      if (value === null) return;
      var now = performance.now();
      if (active) { target = value; lastTarget = value; lastTargetTime = now; return; }
      if (lastTarget === null) { lastTarget = value; lastTargetTime = now; return; }
      var dt = Math.max(0.008, (now - lastTargetTime) / 1000);
      var speed = (value - lastTarget) / dt;
      lastTarget = value;
      lastTargetTime = now;

      var needed = requiredPumps();
      if (!needed) return;

      // A serie morre se o utilizador parar entre movimentos.
      if (pumps && now - lastPumpTime > PUMP_WINDOW) resetPumps();

      if (speed >= KICK_MIN) {
        // Um scroll longo e rapido produz varias amostras seguidas a subir;
        // so conta como movimento novo depois de o chao ter voltado a descer.
        if (!pumpOpen) {
          pumpOpen = true;
          pumps += 1;
          lastPumpTime = now;
          if (pumps >= needed) { resetPumps(); launch(value, speed); }
        } else {
          lastPumpTime = now;
        }
      } else if (speed <= -KICK_MIN * PUMP_RELEASE) {
        pumpOpen = false;
        if (pumps) lastPumpTime = now;
      }
    });
  }

  function launch(value, speed) {
    if (!measure()) return;
    if (host.classList.contains("is-ready") === false) return;
    target = value;
    floor = value;
    floorSpeed = 0;
    ballY = value;
    ballSpeed = Math.min(MAX_LAUNCH, speed * KICK_TRANSFER);
    spin = 0;
    spinSpeed = 0;
    squash = 0;
    active = true;
    sleepTime = 0;
    idleSince = performance.now();
    lastTime = idleSince;
    host.classList.add("egg-live");
    beginTilt();
    frame = window.requestAnimationFrame(step);
  }

  function bounce(impact) {
    squash = Math.min(1, impact / 1400);
    spinSpeed += (Math.random() - 0.5) * Math.min(320, impact * 0.35);
  }

  function step(now) {
    frame = null;
    var dt = Math.min(0.032, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;

    // Chao suavizado: a diferenca entre dois frames da-nos a sua velocidade,
    // que e o que transforma um flick de scroll numa pancada.
    var previousFloor = floor;
    floor += (target - floor) * (1 - Math.exp(-dt / FLOOR_TAU));
    floorSpeed = (floor - previousFloor) / dt;

    ballSpeed -= GRAVITY * dt;
    ballY += ballSpeed * dt;

    if (ballY <= floor) {
      ballY = floor;
      var incoming = Math.abs(ballSpeed);
      var kick = floorSpeed > 0 ? floorSpeed * KICK_TRANSFER : 0;
      var outgoing = incoming * RESTITUTION + kick;
      if (outgoing > SLEEP_SPEED) {
        ballSpeed = Math.min(MAX_LAUNCH, outgoing);
        bounce(incoming + kick);
      } else {
        ballSpeed = 0;
      }
    }

    var airborne = ballY - floor > 1 || Math.abs(ballSpeed) > SLEEP_SPEED;
    if (airborne) sleepTime = 0;
    else sleepTime += dt * 1000;

    // Toque alto: o balao vai bater onde o icone da marca vive.
    if (!icon && ballY + cardHeight >= window.innerHeight * KNOCK_RATIO) {
      knockIcon();
      ballSpeed = -Math.abs(ballSpeed) * 0.6;
      bounce(900);
    }

    spinSpeed += -spin * 90 * dt;
    spinSpeed *= Math.exp(-3.2 * dt);
    spin += spinSpeed * dt;
    spin = Math.max(-14, Math.min(14, spin));
    squash *= Math.exp(-9 * dt);

    var lift = ballY - target;
    host.style.setProperty("--egg-y", (-lift).toFixed(2) + "px");
    host.style.setProperty("--egg-rot", spin.toFixed(2) + "deg");
    host.style.setProperty("--egg-sx", (1 + squash * 0.05).toFixed(3));
    host.style.setProperty("--egg-sy", (1 - squash * 0.05).toFixed(3));

    if (icon) stepIcon(dt);

    // Sem icone basta a bola adormecer. Com icone a festa fica de pe enquanto
    // houver movimento -- a inclinacao do telemovel conta como movimento, e no
    // iOS a permissao so chega no toque seguinte a queda.
    if (airborne || (icon && !iconState.asleep)) idleSince = now;
    if (!icon && sleepTime > SLEEP_MS) return stop();
    if (now - idleSince > IDLE_MS) return stop();
    frame = window.requestAnimationFrame(step);
  }

  function stop() {
    active = false;
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    host.classList.remove("egg-live");
    host.style.removeProperty("--egg-y");
    host.style.removeProperty("--egg-rot");
    host.style.removeProperty("--egg-sx");
    host.style.removeProperty("--egg-sy");
    removeIcon();
    lastTarget = null;
    resetPumps();
  }

  function brandImage() {
    return document.querySelector(".site-header .brand-mark img");
  }

  function knockIcon() {
    var source = brandImage();
    var startX = hostLeft + cardWidth / 2 - ICON_SIZE / 2;
    var startY = window.innerHeight;
    if (source) {
      var rect = source.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        startX = rect.left;
        startY = window.innerHeight - rect.bottom;
      }
      source.style.visibility = "hidden";
    }

    icon = document.createElement("img");
    icon.className = "review-egg-icon";
    icon.src = (source && source.getAttribute("src")) || "content/brand/logo.webp";
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    icon.draggable = false;
    document.body.appendChild(icon);

    var spawnX = Math.max(0, Math.min(window.innerWidth - ICON_SIZE, startX));
    lastBallTop = ballY + cardHeight;
    iconState = {
      x: spawnX,
      y: startY,
      py: startY + 1,
      vx: (Math.random() - 0.5) * 120,
      vy: -80,
      rot: 0,
      vrot: (Math.random() - 0.5) * 90,
      asleep: false
    };
    requestTilt();
  }

  function removeIcon() {
    if (!icon) return;
    icon.parentNode.removeChild(icon);
    icon = null;
    iconState = null;
    var source = brandImage();
    if (source) source.style.removeProperty("visibility");
  }

  function stepIcon(dt) {
    var state = iconState;
    state.py = state.y;
    // Um valor de inclinacao antigo nao pode continuar a empurrar o icone
    // depois de o sensor deixar de reportar.
    var tilt = performance.now() - lastTiltAt < 1500 ? tiltX : 0;
    state.vx += tilt * GRAVITY * dt;
    state.vy -= GRAVITY * dt;
    state.x += state.vx * dt;
    state.y += state.vy * dt;

    var grounded = false;

    var maxX = window.innerWidth - ICON_SIZE;
    if (state.x < 0) { state.x = 0; state.vx = Math.abs(state.vx) * 0.55; }
    else if (state.x > maxX) { state.x = maxX; state.vx = -Math.abs(state.vx) * 0.55; }

    var ceiling = window.innerHeight - ICON_SIZE;
    if (state.y > ceiling) { state.y = ceiling; state.vy = -Math.abs(state.vy) * 0.4; }

    // A bola e uma plataforma, nao um bloco: o icone pousa-lhe em cima e e
    // cuspido quando ela sobe. Solidificar tambem os lados prendia o icone, que
    // partilha o chao com ela e por isso esta sempre dentro da sua caixa; o
    // icone desenha a frente (z-index maior), pelo que passar rente le bem.
    var ballLeft = hostLeft;
    var ballRight = hostLeft + cardWidth;
    var ballTop = ballY + cardHeight;
    var overLid = state.x + ICON_SIZE > ballLeft && state.x < ballRight;
    // O teste tem de ser contra o topo do frame anterior: numa pancada o balao
    // sobe dezenas de px num frame e o icone pousado ficaria "abaixo" do topo
    // novo, deixando a bola passar-lhe atraves em vez de o atirar ao ar.
    if (overLid && state.y < ballTop && state.py >= lastBallTop - 1) {
      state.y = ballTop;
      grounded = true;
      var lift = ballSpeed > 0 ? ballSpeed * 0.85 : 0;
      state.vy = Math.max(Math.abs(state.vy) * 0.45, lift);
      if (state.vy < 40) state.vy = 0;
    }
    lastBallTop = ballTop;

    if (state.y <= floor) {
      state.y = floor;
      grounded = true;
      if (Math.abs(state.vy) > 80) state.vy = Math.abs(state.vy) * 0.45;
      else state.vy = 0;
      state.vx *= Math.exp(-2.6 * dt);
    }

    // Assente rola sem derrapar (a rotacao vem da velocidade, nao de impulsos
    // acumulados); no ar mantem o giro com travagem suave.
    if (grounded) state.vrot = -state.vx * ROLL_DEG;
    else state.vrot *= Math.exp(-1.1 * dt);
    state.vrot = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, state.vrot));
    state.rot += state.vrot * dt;
    if (state.rot > 360 || state.rot < -360) state.rot %= 360;

    // Adormecido e uma leitura de movimento, nunca da inclinacao: com o
    // telemovel parado numa posicao inclinada o icone encosta-se e fica quieto,
    // e a festa tem de poder terminar na mesma.
    state.asleep = grounded && Math.abs(state.vy) < 30 && Math.abs(state.vx) < 26;

    icon.style.transform = "translate3d(" + state.x.toFixed(1) + "px, " + (-state.y).toFixed(1) + "px, 0) rotate(" + state.rot.toFixed(1) + "deg)";
  }

  function screenAngle() {
    if (window.screen && window.screen.orientation && typeof window.screen.orientation.angle === "number") return window.screen.orientation.angle;
    return Number(window.orientation) || 0;
  }

  // Em paisagem o eixo lateral do sensor deixa de ser o gamma.
  function lateralDegrees(beta, gamma) {
    var angle = screenAngle();
    if (angle === 90) return -beta;
    if (angle === 270 || angle === -90) return beta;
    if (angle === 180) return -gamma;
    return gamma;
  }

  function applyTilt(degrees) {
    if (!isFinite(degrees)) return;
    tiltX = Math.max(-1, Math.min(1, Math.sin(degrees * Math.PI / 180))) * 0.9;
    lastTiltAt = performance.now();
    tiltSamples += 1;
  }

  function onTilt(event) {
    var gamma = Number(event.gamma);
    var beta = Number(event.beta);
    if (!isFinite(gamma) && !isFinite(beta)) return;
    applyTilt(lateralDegrees(beta, gamma));
  }

  // Alguns Android nao entregam deviceorientation mas dao a gravidade aqui.
  function onMotion(event) {
    if (tiltSource === "orientation") return;
    var g = event.accelerationIncludingGravity;
    if (!g || !isFinite(Number(g.x))) return;
    tiltSource = "motion";
    var lateral = screenAngle() === 90 ? Number(g.y) : screenAngle() === 270 || screenAngle() === -90 ? -Number(g.y) : -Number(g.x);
    applyTilt(Math.max(-90, Math.min(90, lateral * 9)));
  }

  function listenTilt() {
    if (tiltListening) return;
    tiltListening = true;
    tiltSource = "orientation";
    window.addEventListener("deviceorientation", onTilt);
    // Se em 1,2s nao vier nada do sensor de orientacao, tenta o de movimento.
    window.setTimeout(function () {
      if (tiltSamples === 0 && typeof window.DeviceMotionEvent !== "undefined") {
        tiltSource = null;
        window.addEventListener("devicemotion", onMotion);
      }
    }, 1200);
  }

  // Android e desktop: basta ouvir, por isso ligamos logo no lancamento para o
  // valor ja estar vivo quando o icone cair.
  function beginTilt() {
    if (typeof window.DeviceOrientationEvent === "undefined") return;
    if (typeof window.DeviceOrientationEvent.requestPermission !== "function") listenTilt();
  }

  // iOS: a permissao tem de nascer de um gesto, e so a pedimos quando o icone
  // cai -- ate ai nao ha nada que reaja a inclinacao.
  function requestTilt() {
    if (tiltListening || tiltAsked) return;
    if (typeof window.DeviceOrientationEvent === "undefined") return;
    if (typeof window.DeviceOrientationEvent.requestPermission !== "function") { listenTilt(); return; }
    tiltAsked = true;
    var events = ["touchend", "pointerup", "click"];
    var ask = function () {
      events.forEach(function (name) { document.removeEventListener(name, ask); });
      window.DeviceOrientationEvent.requestPermission().then(function (result) {
        if (result === "granted") listenTilt();
      }).catch(function () {});
    };
    events.forEach(function (name) { document.addEventListener(name, ask, { passive: true }); });
  }

  // Diagnostico opcional (?eggdebug=1): mostra o estado do sensor e da contagem
  // de movimentos num canto do ecra. Nao existe sem o parametro na URL.
  if (/[?&]eggdebug=1(?:&|$)/.test(window.location.search)) {
    var box = document.createElement("div");
    box.setAttribute("style", "position:fixed;top:0;left:0;z-index:9999;max-width:100vw;padding:6px 8px;background:rgba(20,22,18,.88);color:#f4e9d2;font:11px/1.45 ui-monospace,monospace;white-space:pre-wrap;pointer-events:none");
    document.body.appendChild(box);
    window.setInterval(function () {
      var needsPermission = typeof window.DeviceOrientationEvent !== "undefined" && typeof window.DeviceOrientationEvent.requestPermission === "function";
      box.textContent = [
        "seguro(https): " + window.isSecureContext,
        "sensor: " + (typeof window.DeviceOrientationEvent !== "undefined") + (needsPermission ? " (pede permissao)" : ""),
        "a ouvir: " + tiltListening + " | fonte: " + (tiltSource || "-"),
        "leituras: " + tiltSamples + " | tiltX: " + tiltX.toFixed(2),
        "movimentos: " + pumps + "/" + requiredPumps() + " | ativo: " + active + " | icone: " + !!icon
      ].join("\n");
    }, 250);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () {
    if (active) { measure(); }
    lastTarget = null;
  }, { passive: true });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && active) stop();
  });
})();
