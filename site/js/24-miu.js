/* js/24-miu.js — interface autónoma do Míu: contexto, streaming e filtros locais. */

var miuScriptElement = document.currentScript;
var miuScriptUrl = miuScriptElement && miuScriptElement.src ? miuScriptElement.src : "js/24-miu.js";
var miuSiteRootUrl = new URL("../", miuScriptUrl);
var miuApiUrl = new URL("bot-api.php", miuSiteRootUrl).href;
var miuStorageKey = "miaandpaper_miu_v1";
var miuRoot = null;
var miuPanel = null;
var miuMessagesHost = null;
var miuForm = null;
var miuInput = null;
var miuStatus = null;
var miuCount = null;
var miuConfig = null;
var miuBusy = false;
var miuConversationId = "";
var miuMessages = [];
var miuEmailedUserCount = 0;
var miuFinishTimer = 0;
var miuInactivityFinishTimer = 0;
var MIU_INACTIVITY_FINISH_MS = 30 * 60 * 1000; // 30 minutos
var MIU_PANEL_CLOSED_FINISH_MS = 2 * 60 * 1000; // 2 minutos após fechar o painel
var miuPageContext = null;
var miuContextSignature = "";
var miuContextTimer = 0;
var miuContextObserver = null;
var miuContextInterval = 0;
var miuSleepTimer = 0;
var miuSleepDelayMs = 45000;
var miuAnimationConfig = null;
var miuInteractiveAnimationConfig = null; // biblioteca do Míu de corpo inteiro, usada nos contextos interactivos
var miuLauncherPromptDayKey = "miaandpaper_miu_launcher_prompt_day_v1";
var miuInteractiveSprite = null;
var miuInteractiveWrap = null;
var miuLauncherBodySprite = null;
var miuLauncherBodyTimer = 0;
var miuLauncherBodySerial = 0;
var miuInteractiveTimer = 0;
var miuInteractiveSerial = 0;
var miuLauncherCallout = null;
var miuLauncherCalloutTimer = 0;
var miuAnimationById = {};
var miuLauncherSprite = null;
var miuAnimationTimer = 0;
var miuIdleActionTimer = 0;
var miuAnimationSerial = 0;
var miuAnimationCooldowns = {};
var miuRoamX = 0;
var miuRootMotion = null;
var miuReducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
var miuDebugForceMotion = false;
var miuDebugPanelStorageKey = "miaandpaper_miu_debug_lab_v2";
var miuDebugObjectUrls = {};
var miuDebugActiveTest = null;
var miuV2Controller = null;
var miuV2RuntimePromise = null;
var miuFooterClearance = 0;
var miuFooterSyncFrame = 0;

function miuIsAdminChatPage()
{
  return !!(document.body && document.body.getAttribute("data-miu-admin-chat") === "1");
}

function miuV2LoadRuntime(config)
{
  if (window.MiuV2Production) { return Promise.resolve(window.MiuV2Production); }
  if (miuV2RuntimePromise) { return miuV2RuntimePromise; }
  var assets = config && config.assets ? config.assets : {};
  var source = String(assets.runtime || "miu-v2-runtime.js");
  var version = String(assets.cacheVersion || "").replace(/[^a-z0-9._-]/gi, "");
  var runtimeUrl = new URL(source, miuSiteRootUrl);
  if (version) { runtimeUrl.searchParams.set("v", version); }
  miuV2RuntimePromise = new Promise(function (resolve, reject) {
    var script = document.createElement("script");
    script.src = runtimeUrl.href;
    script.async = true;
    script.onload = function () {
      if (window.MiuV2Production) { resolve(window.MiuV2Production); }
      else { reject(new Error("O runtime do Míu V2 não ficou disponível.")); }
    };
    script.onerror = function () { reject(new Error("Não foi possível carregar o runtime do Míu V2.")); };
    document.head.appendChild(script);
  });
  return miuV2RuntimePromise;
}

function miuV2Boot()
{
  var config = miuConfig && miuConfig.directorV2 ? miuConfig.directorV2 : null;
  if (!config || config.engine !== "v2" || !miuRoot || !miuLauncherSprite) { return; }
  // Enquanto o CCL prepara o primeiro PNG V2, nenhuma arte V1 fica visível.
  // A primeira cara histórica serve apenas de referência geométrica para o
  // idle; não volta a piscar no arranque, tal como a Lili de corpo inteiro.
  miuRoot.classList.add("is-miu-v2-loading");
  miuRoot.classList.remove("miu-launcher-mode-basket", "is-interactive", "is-sleeping");
  miuRoot.classList.add("miu-launcher-mode-circle");
  miuAnimationCancelTimer();
  miuLauncherBodyStop();
  miuInteractiveStop();
  miuV2LoadRuntime(config).then(function (runtime) {
    return runtime.mount({
      config: config,
      root: miuRoot,
      launcher: miuRoot.querySelector(".miu-launcher"),
      siteRoot: miuSiteRootUrl,
      onReady: function (controller) {
        miuV2Controller = controller;
        miuRoot.classList.remove("is-miu-v2-loading");
        // O V1 continua no DOM como fallback, mas deixa de gastar timers
        // assim que o primeiro frame V2 está realmente pronto.
        miuAnimationCancelTimer();
        miuLauncherBodyStop();
        miuInteractiveStop();
      }
    });
  }).catch(function (error) {
    // Falhar em silêncio para o cliente é intencional: o Míu V1 nunca chegou
    // a ser escondido e continua operacional. A classe facilita o diagnóstico.
    if (miuRoot) {
      miuRoot.classList.remove("is-miu-v2-loading");
      miuRoot.classList.add("miu-v2-failed");
      miuApplyLauncherAppearance(miuAnimationConfig && miuAnimationConfig.display ? miuAnimationConfig.display : {});
      miuAnimationPlayBase();
      miuScheduleSleep();
      miuAnimationScheduleRandom();
    }
    if (miuIsAdminChatPage() && window.console) { window.console.error(error); }
  });
}

function miuAnimationSetup(config)
{
  /*
   * A barra do chat e os avatares das respostas usam a cara do Míu. O Míu
   * principal no canto pode alternar entre a cara dentro do balão e a
   * animação de corpo inteiro na alcofinha. As restantes sprites continuam
   * disponíveis para contextos interactivos e para o laboratório.
   */
  miuInteractiveAnimationConfig = config && Array.isArray(config.animations) ? config : null;
  var display = miuInteractiveAnimationConfig && miuInteractiveAnimationConfig.display
    ? miuInteractiveAnimationConfig.display : {};

  miuSleepDelayMs = Math.max(5000, Number(display.sleepAfterMs || 45000));
  miuAnimationConfig = {
    schemaVersion: 1,
    baseAnimationId: "miu-cara-calma",
    display: {
      launcherPx: Math.max(24, Number(display.launcherPx || 46)),
      launcherPxMobile: Math.max(24, Number(display.launcherPxMobile || display.launcherPx || 46)),
      headerPx: Math.max(16, Number(display.headerPx || display.smallPx || 26)),
      headerPxMobile: Math.max(16, Number(display.headerPxMobile || display.headerPx || display.smallPx || 26)),
      headerVisible: display.headerVisible !== false,
      launcherMode: String(display.launcherMode || display.headerMode || "circle").toLowerCase() === "basket" ? "basket" : "circle",
      messagePx: Math.max(16, Number(display.messagePx || display.smallPx || 26)),
      messagePxMobile: Math.max(16, Number(display.messagePxMobile || display.messagePx || display.smallPx || 26)),
      interactivePx: Math.max(48, Number(display.interactivePx || 96)),
      interactivePxMobile: Math.max(48, Number(display.interactivePxMobile || display.interactivePx || 96)),
      launcherCircle: display.launcherCircle !== false,
      headerCircle: display.headerCircle !== false,
      messageCircle: display.messageCircle !== false,
      promptSeconds: Math.max(0, Number(display.promptSeconds == null ? 5 : display.promptSeconds)),
      errorsViaMiu: display.errorsViaMiu !== false,
      smallPx: Math.max(18, Number(display.smallPx || 26)),
      sleepAfterMs: miuSleepDelayMs,
      idleRandomMinMs: Math.max(5000, Number(display.idleRandomMinMs || 14000)),
      idleRandomMaxMs: Math.max(7000, Number(display.idleRandomMaxMs || 28000)),
      maxRoamPx: Math.max(0, Number(display.maxRoamPx || 180))
    },
    animations: [
      {
        id: "miu-cara-calma",
        name: "Míu — cara calma",
        sheetUrl: "content/brand/miu/miu-sprite.webp",
        columns: 4,
        rows: 2,
        sequence: [0, 0, 0, 1, 2, 3, 0, 0, 0, 7, 0, 0, 0],
        frameDurationsMs: [1300, 1100, 900, 110, 100, 150, 1200, 950, 1200, 700, 1000, 900, 1200],
        repeat: 0,
        enabled: true,
        triggers: [],
        probability: 1,
        weight: 1,
        cooldownMs: 0,
        flipX: false,
        staticFrame: 0,
        motion: { type: "none", distancePx: 0 }
      },
      {
        id: "miu-cara-sorriso",
        name: "Míu — cara sorriso",
        sheetUrl: "content/brand/miu/miu-sprite.webp",
        columns: 4,
        rows: 2,
        sequence: [0, 6, 6, 0],
        frameDurationsMs: [100, 320, 260, 180],
        repeat: 1,
        enabled: true,
        triggers: ["launcher_hover", "launcher_open", "message_sent", "reply_end", "conversation_reset"],
        probability: 1,
        weight: 3,
        cooldownMs: 650,
        flipX: false,
        staticFrame: 6,
        motion: { type: "none", distancePx: 0 }
      },
      {
        id: "miu-cara-inclina",
        name: "Míu — cara inclina",
        sheetUrl: "content/brand/miu/miu-sprite.webp",
        columns: 4,
        rows: 2,
        sequence: [0, 4, 4, 0, 5, 5, 0],
        frameDurationsMs: [100, 420, 250, 160, 420, 250, 180],
        repeat: 1,
        enabled: true,
        triggers: ["idle_random"],
        probability: 0.58,
        weight: 2,
        cooldownMs: 7000,
        flipX: false,
        staticFrame: 4,
        motion: { type: "none", distancePx: 0 }
      },
      {
        id: "miu-cara-orelha",
        name: "Míu — cara orelha",
        sheetUrl: "content/brand/miu/miu-sprite.webp",
        columns: 4,
        rows: 2,
        sequence: [0, 7, 7, 0],
        frameDurationsMs: [120, 380, 320, 180],
        repeat: 1,
        enabled: true,
        triggers: ["idle_random", "launcher_close"],
        probability: 0.5,
        weight: 1,
        cooldownMs: 9000,
        flipX: false,
        staticFrame: 7,
        motion: { type: "none", distancePx: 0 }
      },
      {
        id: "miu-cara-dormir",
        name: "Míu — cara a dormir",
        sheetUrl: "content/brand/miu/miu-sprite-sleep.webp",
        columns: 4,
        rows: 1,
        sequence: [0, 1, 2, 3, 2, 3],
        frameDurationsMs: [650, 700, 650, 1100, 650, 1100],
        repeat: 0,
        enabled: true,
        triggers: ["inactivity"],
        probability: 1,
        weight: 1,
        cooldownMs: 0,
        flipX: false,
        staticFrame: 3,
        motion: { type: "none", distancePx: 0 }
      }
    ]
  };

  // Desde sprites.php, as expressões da cara deixam de estar presas a este
  // fallback hardcoded. Se a API trouxer a biblioteca editável, ela é a fonte
  // activa; o bloco acima fica apenas como compatibilidade para instalações
  // que ainda não tenham face-animations.json.
  var configuredFace = config && config.faceAnimations && Array.isArray(config.faceAnimations.animations)
    ? config.faceAnimations : null;
  if (configuredFace && configuredFace.animations.length) {
    miuAnimationConfig.baseAnimationId = String(configuredFace.baseAnimationId || configuredFace.animations[0].id || "miu-cara-calma");
    miuAnimationConfig.animations = configuredFace.animations;
  }

  miuAnimationById = {};
  miuAnimationConfig.animations.forEach(function (animation) {
    if (animation && animation.id) { miuAnimationById[String(animation.id)] = animation; }
  });
}
function miuAnimationBase()
{
  if (!miuAnimationConfig) { return null; }
  var configured = miuAnimationById[String(miuAnimationConfig.baseAnimationId || "")] || null;
  if (configured && configured.enabled !== false) { return configured; }
  var enabled = miuAnimationConfig.animations.find(function (animation) { return animation && animation.enabled !== false; });
  return enabled || configured || miuAnimationConfig.animations[0] || null;
}

function miuAnimationSheetUrl(animation)
{
  if (!animation) { return ""; }
  var source = String(animation.sheetUrl || "").trim();
  // As animações vindas da API trazem sheetUrl. O fallback por `file` torna
  // o laboratório robusto também quando trabalha com uma configuração local
  // ou um objecto ainda não enriquecido por miu_animation_public_config().
  if (!source && animation.file) { source = "content/brand/miu/" + String(animation.file).replace(/^\/+/, ""); }
  if (!source) { return ""; }
  try { return new URL(source, miuSiteRootUrl).href; }
  catch (error) { return ""; }
}

function miuLauncherBodyAnimation()
{
  var config = miuInteractiveAnimationConfig;
  if (!config || !Array.isArray(config.animations) || !config.animations.length) { return null; }
  var baseId = String(config.baseAnimationId || "");
  var found = null;
  config.animations.some(function (animation) {
    if (animation && String(animation.id || "") === baseId) { found = animation; return true; }
    return false;
  });
  if (found && found.enabled !== false) { return found; }
  var enabled = config.animations.find(function (animation) { return animation && animation.enabled !== false; });
  return enabled || found || config.animations[0] || null;
}

function miuLauncherBodyStop()
{
  miuLauncherBodySerial += 1;
  window.clearTimeout(miuLauncherBodyTimer);
  miuLauncherBodyTimer = 0;
}

function miuLauncherBodyPlayBase()
{
  miuLauncherBodyStop();
  if (!miuLauncherBodySprite || !miuRoot || !miuRoot.classList.contains("miu-launcher-mode-basket")) { return false; }
  var animation = miuLauncherBodyAnimation();
  if (!animation || !miuAnimationSheetUrl(animation)) { return false; }
  var serial = miuLauncherBodySerial;
  var sequence = Array.isArray(animation.sequence) && animation.sequence.length ? animation.sequence.slice() : [Number(animation.staticFrame || 0)];
  var durations = Array.isArray(animation.frameDurationsMs) && animation.frameDurationsMs.length === sequence.length
    ? animation.frameDurationsMs.slice() : sequence.map(function () { return 180; });
  var cursor = 0;

  function draw() {
    if (serial !== miuLauncherBodySerial || !miuLauncherBodySprite) { return; }
    miuAnimationApplyFrame(miuLauncherBodySprite, animation, sequence[cursor]);
    if (miuReducedMotion && !miuDebugForceMotion) { return; }
    var delay = Math.max(40, Number(durations[cursor] || 180));
    cursor = (cursor + 1) % sequence.length;
    miuLauncherBodyTimer = window.setTimeout(draw, delay);
  }
  draw();
  return true;
}

function miuApplyHeaderAppearance(display)
{
  if (!miuRoot) { return; }
  display = display || {};
  miuRoot.classList.toggle("miu-header-hidden", display.headerVisible === false);
  miuRoot.classList.toggle("miu-no-circle-header", display.headerCircle === false);
}

function miuApplyLauncherAppearance(display)
{
  if (!miuRoot) { return; }
  display = display || {};
  var mode = String(display.launcherMode || display.headerMode || "circle").toLowerCase() === "basket" ? "basket" : "circle";
  display.launcherMode = mode;
  display.launcherCircle = mode === "circle"; // compatibilidade com leitores antigos
  miuRoot.classList.toggle("miu-launcher-mode-circle", mode === "circle");
  miuRoot.classList.toggle("miu-launcher-mode-basket", mode === "basket");
  if (mode === "basket") { miuLauncherBodyPlayBase(); }
  else { miuLauncherBodyStop(); }
}

function miuAnimationFramePosition(index, columns, rows)
{
  var column = index % columns;
  var row = Math.floor(index / columns);
  return {
    x: columns <= 1 ? 0 : (column / (columns - 1)) * 100,
    y: rows <= 1 ? 0 : (row / (rows - 1)) * 100
  };
}

function miuAnimationApplyFrame(element, animation, frameIndex)
{
  if (!element || !animation) { return; }
  var columns = Math.max(1, Number(animation.columns || 1));
  var rows = Math.max(1, Number(animation.rows || 1));
  var maxFrame = columns * rows - 1;
  var index = Math.max(0, Math.min(maxFrame, Number(frameIndex || 0)));
  var position = miuAnimationFramePosition(index, columns, rows);
  element.style.backgroundImage = 'url("' + miuAnimationSheetUrl(animation).replace(/"/g, "%22") + '")';
  element.style.backgroundSize = (columns * 100) + "% " + (rows * 100) + "%";
  element.style.backgroundPosition = position.x + "% " + position.y + "%";
  element.style.backgroundRepeat = "no-repeat";
  var transform = animation.transform && typeof animation.transform === "object" ? animation.transform : {};
  var x = Math.max(-600, Math.min(600, Number(transform.xPx || 0)));
  var y = Math.max(-600, Math.min(600, Number(transform.yPx || 0)));
  var rotation = Math.max(-360, Math.min(360, Number(transform.rotationDeg || 0)));
  var parts = [];
  if (x || y) { parts.push("translate3d(" + x + "px," + y + "px,0)"); }
  if (rotation) { parts.push("rotate(" + rotation + "deg)"); }
  if (animation.flipX) { parts.push("scaleX(-1)"); }
  element.style.transform = parts.length ? parts.join(" ") : "none";
}

function miuAnimationApplyStatic(element, variantIndex)
{
  if (!element) { return; }
  var stableFrames = [0, 6, 0, 4, 0, 5, 0, 7];
  var index = stableFrames[Math.abs(Number(variantIndex || 0)) % stableFrames.length];
  var small = element.classList && element.classList.contains("miu-face--small");
  var base = miuAnimationBase() || {};
  var normalSheet = String(base.sheetUrl || "content/brand/miu/miu-sprite.webp");
  var smallSheet = String(base.smallSheetUrl || "content/brand/miu/miu-sprite-small.webp");
  miuAnimationApplyFrame(element, {
    sheetUrl: small ? smallSheet : normalSheet,
    columns: Math.max(1, Number(base.columns || 4)),
    rows: Math.max(1, Number(base.rows || 2)),
    flipX: false,
    transform: { xPx: 0, yPx: 0, rotationDeg: 0 }
  }, index);
}
function miuAnimationCycleMs(animation)
{
  var durations = animation && Array.isArray(animation.frameDurationsMs) ? animation.frameDurationsMs : [];
  return Math.max(120, durations.reduce(function (sum, value) { return sum + Math.max(40, Number(value || 180)); }, 0));
}

function miuAnimationCancelTimer()
{
  window.clearTimeout(miuAnimationTimer);
  miuAnimationTimer = 0;
  miuAnimationSerial += 1;
}

function miuAnimationSetRootX(value)
{
  if (!miuRoot) { return; }
  miuRoamX = Number(value || 0);
  miuRoot.style.transform = "translate3d(" + miuRoamX + "px,0,0)";
}

function miuAnimationResetRoam()
{
  if (miuRootMotion && typeof miuRootMotion.cancel === "function") { miuRootMotion.cancel(); }
  miuRootMotion = null;
  miuAnimationSetRootX(0);
}

function miuSyncFooterClearance()
{
  miuFooterSyncFrame = 0;
  if (!miuRoot || !miuRoot.isConnected) { return; }
  if (miuRoot.classList.contains("is-miu-v2-ready")) { miuFooterClearance = 0; return; }
  var vh = window.innerHeight || document.documentElement.clientHeight || 0;
  var styleB = 0;
  try { styleB = parseFloat(window.getComputedStyle(miuRoot).bottom) || 0; }
  catch (e1) { styleB = 0; }
  var baseB = Math.max(0, styleB - miuFooterClearance);
  var need = 0;
  var blockers = document.querySelectorAll(".cookie-banner.is-visible, .site-footer");
  Array.prototype.forEach.call(blockers, function (el) {
    if (!el) { return; }
    var r = el.getBoundingClientRect();
    if (r.height > 0 && r.top < vh && r.bottom > 0) {
      need = Math.max(need, vh - r.top + 14 - baseB);
    }
  });
  need = Math.max(0, need);
  var rootH = 0;
  try { rootH = miuRoot.getBoundingClientRect().height || 0; }
  catch (e2) { rootH = 0; }
  if (rootH > 0) {
    need = Math.min(need, Math.max(0, vh - rootH - baseB - 8));
  }
  if (Math.abs(need - miuFooterClearance) < 0.5) { return; }
  miuFooterClearance = need;
  miuRoot.style.setProperty("--miu-navigation-clearance", need.toFixed(2) + "px");
}

function miuScheduleFooterSync()
{
  if (miuFooterSyncFrame) { return; }
  miuFooterSyncFrame = window.requestAnimationFrame(miuSyncFooterClearance);
}

function miuWatchFooterClearance()
{
  window.addEventListener("resize", miuScheduleFooterSync, { passive: true });
  window.addEventListener("scroll", miuScheduleFooterSync, { passive: true });
  document.addEventListener("scroll", miuScheduleFooterSync, { passive: true, capture: true });
  if (window.MutationObserver && document.body) {
    var obs = new MutationObserver(miuScheduleFooterSync);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }
  miuScheduleFooterSync();
}

function miuAnimationMotion(animation)
{
  if (!miuRoot || !animation || !animation.motion || (miuReducedMotion && !miuDebugForceMotion)) { return; }
  var type = String(animation.motion.type || "none");
  var distance = Math.max(0, Number(animation.motion.distancePx || 0));
  if (type === "none" || distance <= 0 || miuRoot.classList.contains("is-open")) { return; }
  var maxRoam = miuAnimationConfig && miuAnimationConfig.display ? Math.max(0, Number(miuAnimationConfig.display.maxRoamPx || 0)) : 180;
  var duration = Math.max(320, Math.min(5000, miuAnimationCycleMs(animation) * (Number(animation.repeat || 1) || 1)));
  var startX = miuRoamX;
  var targetX = startX;
  if (type === "left") { targetX = Math.max(-maxRoam, startX - distance); }
  if (type === "right") { targetX = Math.min(0, startX + distance); }
  if (miuRootMotion && typeof miuRootMotion.cancel === "function") { miuRootMotion.cancel(); }
  miuRootMotion = null;

  if (type === "jump") {
    if (typeof miuRoot.animate === "function") {
      miuRootMotion = miuRoot.animate([
        { transform: "translate3d(" + startX + "px,0,0)" },
        { transform: "translate3d(" + startX + "px," + (-distance) + "px,0)", offset: 0.48 },
        { transform: "translate3d(" + startX + "px,0,0)" }
      ], { duration: Math.min(duration, 1200), easing: "ease-in-out" });
      miuRootMotion.onfinish = function () { miuRootMotion = null; miuAnimationSetRootX(startX); };
    }
    return;
  }

  if (targetX === startX) { return; }
  if (typeof miuRoot.animate === "function") {
    miuRootMotion = miuRoot.animate([
      { transform: "translate3d(" + startX + "px,0,0)" },
      { transform: "translate3d(" + targetX + "px,0,0)" }
    ], { duration: duration, easing: "linear" });
    miuRootMotion.onfinish = function () { miuRootMotion = null; miuAnimationSetRootX(targetX); };
  } else {
    miuAnimationSetRootX(targetX);
  }
}

function miuAnimationPlay(animation, restoreBase)
{
  if (!animation || !miuLauncherSprite) { return false; }
  miuAnimationCancelTimer();
  var serial = miuAnimationSerial;
  var sequence = Array.isArray(animation.sequence) && animation.sequence.length ? animation.sequence.slice() : [0];
  var durations = Array.isArray(animation.frameDurationsMs) && animation.frameDurationsMs.length === sequence.length
    ? animation.frameDurationsMs.slice() : sequence.map(function () { return 180; });
  var repeat = Math.max(0, Number(animation.repeat || 0));
  var cursor = 0;
  var cycles = 0;
  miuAnimationMotion(animation);

  function draw()
  {
    if (serial !== miuAnimationSerial || !miuLauncherSprite) { return; }
    miuAnimationApplyFrame(miuLauncherSprite, animation, sequence[cursor]);
    if (miuReducedMotion && !miuDebugForceMotion) {
      if (restoreBase && animation.id !== (miuAnimationBase() || {}).id) {
        miuAnimationTimer = window.setTimeout(function () { miuAnimationPlayBase(); }, 650);
      }
      return;
    }
    var delay = Math.max(40, Number(durations[cursor] || 180));
    cursor += 1;
    if (cursor >= sequence.length) {
      cursor = 0;
      cycles += 1;
      if (repeat > 0 && cycles >= repeat) {
        if (restoreBase) { miuAnimationTimer = window.setTimeout(miuAnimationPlayBase, delay); }
        return;
      }
    }
    miuAnimationTimer = window.setTimeout(draw, delay);
  }
  draw();
  return true;
}

function miuAnimationPlayBase()
{
  if (miuRoot && (miuRoot.classList.contains("is-miu-v2-loading") || miuRoot.classList.contains("is-miu-v2-ready"))) { return; }
  var base = miuAnimationBase();
  if (base) { miuAnimationPlay(base, false); }
}

function miuAnimationCandidates(trigger)
{
  if (!miuAnimationConfig) { return []; }
  var now = Date.now();
  return miuAnimationConfig.animations.filter(function (animation) {
    if (!animation || !animation.enabled || !Array.isArray(animation.triggers) || animation.triggers.indexOf(trigger) === -1) { return false; }
    if (Number(miuAnimationCooldowns[animation.id] || 0) > now) { return false; }
    // Ao entrar num produto tem de existir sempre uma animação elegível. A
    // probabilidade continua a controlar os gatilhos aleatórios/ambientais,
    // mas não pode fazer o product_enter desaparecer em 62% das visitas.
    if (trigger === "product_enter") { return true; }
    var probability = Math.max(0, Math.min(1, Number(animation.probability == null ? 1 : animation.probability)));
    return Math.random() <= probability;
  });
}

function miuAnimationTrigger(trigger)
{
  if (miuRoot && miuRoot.classList.contains("is-miu-v2-loading")) { return true; }
  if (miuV2Controller && typeof miuV2Controller.trigger === "function") {
    return !!miuV2Controller.trigger(trigger);
  }
  var candidates = miuAnimationCandidates(trigger);
  if (!candidates.length) { return false; }
  var totalWeight = candidates.reduce(function (sum, animation) { return sum + Math.max(1, Number(animation.weight || 1)); }, 0);
  var pick = Math.random() * totalWeight;
  var selected = candidates[candidates.length - 1];
  candidates.some(function (animation) {
    pick -= Math.max(1, Number(animation.weight || 1));
    if (pick <= 0) { selected = animation; return true; }
    return false;
  });
  miuAnimationCooldowns[selected.id] = Date.now() + Math.max(0, Number(selected.cooldownMs || 0));
  return miuAnimationPlay(selected, Number(selected.repeat || 0) > 0);
}

function miuAnimationScheduleRandom()
{
  window.clearTimeout(miuIdleActionTimer);
  miuIdleActionTimer = 0;
  if (!miuRoot || miuBusy || miuRoot.classList.contains("is-open") || miuRoot.classList.contains("is-sleeping") || !miuAnimationConfig
    || miuRoot.classList.contains("is-miu-v2-loading") || miuRoot.classList.contains("is-miu-v2-ready")) { return; }
  var display = miuAnimationConfig.display || {};
  var minimum = Math.max(3000, Number(display.idleRandomMinMs || 14000));
  var maximum = Math.max(minimum, Number(display.idleRandomMaxMs || 28000));
  var delay = minimum + Math.random() * (maximum - minimum);
  miuIdleActionTimer = window.setTimeout(function () {
    if (miuRoot && !miuBusy && !miuRoot.classList.contains("is-open") && !miuRoot.classList.contains("is-sleeping")) {
      miuAnimationTrigger("idle_random");
    }
    miuAnimationScheduleRandom();
  }, delay);
}

function miuFaceMarkup(extraClass)
{
  return '<span class="miu-face' + (extraClass ? " " + extraClass : "") + '" aria-hidden="true"></span>';
}

function miuLoadLocalState()
{
  var parsed;
  try { parsed = JSON.parse(window.sessionStorage.getItem(miuStorageKey) || "{}"); }
  catch (error) { parsed = {}; }
  miuConversationId = /^[a-f0-9]{48}$/.test(String(parsed.conversationId || "")) ? parsed.conversationId : "";
  miuMessages = Array.isArray(parsed.messages) ? parsed.messages.slice(-30).filter(function (message) {
    return message && (message.role === "user" || message.role === "assistant") && typeof message.text === "string";
  }) : [];
  miuEmailedUserCount = Math.max(0, Number(parsed.emailedUserCount || 0));
}

function miuSaveLocalState()
{
  try {
    window.sessionStorage.setItem(miuStorageKey, JSON.stringify({
      conversationId: miuConversationId,
      messages: miuMessages.slice(-30),
      emailedUserCount: miuEmailedUserCount
    }));
  } catch (error) {}
}

function miuNotifyFinished(useKeepalive)
{
  if (!miuConversationId || miuBusy) { return; }
  var userMessageCount = miuMessages.filter(function (m) {
    return m && m.role === "user";
  }).length;
  if (userMessageCount === 0 || userMessageCount <= miuEmailedUserCount) {
    return;
  }
  miuEmailedUserCount = userMessageCount;
  miuSaveLocalState();

  var payload = JSON.stringify({
    action: "finish",
    csrf: miuConfig ? miuConfig.csrf : "",
    conversationId: miuConversationId,
    page: window.location.pathname
  });

  if (useKeepalive && window.fetch) {
    try {
      window.fetch(miuApiUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true
      });
      return;
    } catch (e) {}
  }
  if (window.fetch) {
    window.fetch(miuApiUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: payload
    }).catch(function () {});
  }
}

function miuRestartInactivityFinishTimer()
{
  if (miuInactivityFinishTimer) {
    window.clearTimeout(miuInactivityFinishTimer);
    miuInactivityFinishTimer = 0;
  }
  miuInactivityFinishTimer = window.setTimeout(function () {
    miuNotifyFinished(false);
  }, MIU_INACTIVITY_FINISH_MS);
}

function miuSchedulePanelClosedFinish()
{
  if (miuFinishTimer) {
    window.clearTimeout(miuFinishTimer);
    miuFinishTimer = 0;
  }
  miuFinishTimer = window.setTimeout(function () {
    miuNotifyFinished(false);
  }, MIU_PANEL_CLOSED_FINISH_MS);
}

function miuCancelPanelClosedFinish()
{
  if (miuFinishTimer) {
    window.clearTimeout(miuFinishTimer);
    miuFinishTimer = 0;
  }
}

function miuSafeSiteHref(value)
{
  var raw = String(value || "").trim();
  var url;
  if (!raw || /[\u0000-\u001f\u007f]/.test(raw) || raw.indexOf("//") === 0) { return ""; }
  try { url = new URL(raw, miuSiteRootUrl); }
  catch (error) { return ""; }
  if (url.protocol !== "http:" && url.protocol !== "https:") { return ""; }
  if (url.origin === window.location.origin || /^(?:www\.)?miaandpaper\.com$/i.test(url.hostname)) { return url.href; }
  return "";
}

function miuAppendInline(parent, text)
{
  var source = String(text || "");
  var inlinePattern = /\[([^\]]{1,160})\]\(([^)\s]{1,500})\)|\*\*([^*\n]{1,160})\*\*/g;
  var lastIndex = 0;
  var match;
  while ((match = inlinePattern.exec(source))) {
    if (match.index > lastIndex) { parent.appendChild(document.createTextNode(source.slice(lastIndex, match.index))); }
    if (match[3]) {
      var strong = document.createElement("strong");
      strong.textContent = match[3];
      parent.appendChild(strong);
    } else if (miuSafeSiteHref(match[2])) {
      var anchor = document.createElement("a");
      anchor.href = miuSafeSiteHref(match[2]);
      anchor.textContent = match[1];
      parent.appendChild(anchor);
    } else {
      parent.appendChild(document.createTextNode(match[1]));
    }
    lastIndex = inlinePattern.lastIndex;
  }
  if (lastIndex < source.length) { parent.appendChild(document.createTextNode(source.slice(lastIndex))); }
}

function miuRenderText(container, text)
{
  String(text || "").replace(/\r/g, "").split(/\n{2,}/).forEach(function (paragraph) {
    var node = document.createElement("p");
    paragraph.split("\n").forEach(function (line, index) {
      if (index) { node.appendChild(document.createElement("br")); }
      miuAppendInline(node, line.replace(/^[-*]\s+/, "• "));
    });
    container.appendChild(node);
  });
}

function miuMessageNode(role, text, extraClass, avatarIndex)
{
  var node = document.createElement("div");
  node.className = "miu-message miu-message--" + role + (extraClass ? " " + extraClass : "");
  if (role === "assistant") {
    var row = document.createElement("div");
    var avatar = document.createElement("span");
    var avatarFace = document.createElement("span");
    row.className = "miu-message-row miu-message-row--assistant";
    miuRenderText(node, text);
    avatar.className = "miu-message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatarFace.className = "miu-face miu-face--small miu-face--message";
    avatar.appendChild(avatarFace);
    miuAnimationApplyStatic(avatarFace, avatarIndex);
    row.appendChild(node);
    row.appendChild(avatar);
    return row;
  }
  node.textContent = text;
  return node;
}

function miuMessageBubble(node)
{
  if (!node) { return null; }
  return node.classList && node.classList.contains("miu-message") ? node : node.querySelector(".miu-message");
}

function miuNextAssistantAvatarIndex()
{
  return 1 + miuMessages.filter(function (message) { return message.role === "assistant"; }).length;
}

function miuScrollToEnd()
{
  if (miuMessagesHost) { miuMessagesHost.scrollTop = miuMessagesHost.scrollHeight; }
}

function miuCurrentQuickReplies()
{
  if (miuPageContext && Array.isArray(miuPageContext.quickReplies) && miuPageContext.quickReplies.length) {
    return miuPageContext.quickReplies;
  }
  return miuConfig && Array.isArray(miuConfig.quickReplies) ? miuConfig.quickReplies : [];
}

function miuRenderMessages()
{
  if (!miuMessagesHost || !miuConfig) { return; }
  miuMessagesHost.innerHTML = "";
  var avatarIndex = 0;
  miuMessagesHost.appendChild(miuMessageNode("assistant", miuConfig.greeting || "Olá! Em que posso ajudar?", "", avatarIndex));
  miuMessages.forEach(function (message) {
    if (message.role === "assistant") { avatarIndex += 1; }
    miuMessagesHost.appendChild(miuMessageNode(message.role, message.text, "", avatarIndex));
  });
  var quickReplies = miuCurrentQuickReplies();
  if (!miuMessages.length && quickReplies.length) {
    var suggestions = document.createElement("div");
    suggestions.className = "miu-suggestions";
    suggestions.setAttribute("aria-label", "Perguntas sugeridas");
    quickReplies.forEach(function (reply) {
      if (!reply || !reply.id || !reply.question || !reply.answer) { return; }
      var button = document.createElement("button");
      button.type = "button";
      button.className = "miu-suggestion";
      button.textContent = reply.question;
      button.addEventListener("click", function () { miuSendLocalReply(reply.question, reply.answer, reply.id); });
      suggestions.appendChild(button);
    });
    miuMessagesHost.appendChild(suggestions);
  }
  miuScrollToEnd();
}

function miuSetStatus(message)
{
  if (miuStatus) { miuStatus.textContent = message || ""; }
}

function miuUpdateCount()
{
  var length = miuInput ? miuInput.value.length : 0;
  if (miuCount && miuConfig) { miuCount.textContent = length + "/" + miuConfig.maxMessageChars; }
  if (miuInput) {
    miuInput.style.height = "auto";
    miuInput.style.height = Math.min(96, miuInput.scrollHeight) + "px";
  }
}

function miuSetBusy(busy)
{
  miuBusy = !!busy;
  if (miuRoot) { miuRoot.classList.toggle("is-busy", miuBusy); }
  if (miuInput) { miuInput.disabled = miuBusy; }
  if (miuForm) {
    Array.prototype.forEach.call(miuRoot.querySelectorAll(".miu-send, .miu-suggestion"), function (button) {
      button.disabled = miuBusy;
    });
  }
  miuWakeLauncher();
}

function miuScheduleSleep()
{
  window.clearTimeout(miuSleepTimer);
  miuSleepTimer = 0;
  if (!miuRoot || miuBusy || miuRoot.classList.contains("is-open")
    || miuRoot.classList.contains("is-miu-v2-loading") || miuRoot.classList.contains("is-miu-v2-ready")) { return; }
  miuSleepTimer = window.setTimeout(function () {
    if (miuRoot && !miuBusy && !miuRoot.classList.contains("is-open")) {
      miuRoot.classList.add("is-sleeping");
      if (!miuAnimationTrigger("inactivity")) { miuAnimationPlayBase(); }
      window.clearTimeout(miuIdleActionTimer);
      miuIdleActionTimer = 0;
    }
  }, miuSleepDelayMs);
}

function miuWakeLauncher(keepAnimation)
{
  window.clearTimeout(miuSleepTimer);
  miuSleepTimer = 0;
  if (miuRoot) { miuRoot.classList.remove("is-sleeping"); }
  if (!keepAnimation) { miuAnimationPlayBase(); }
  miuScheduleSleep();
  miuAnimationScheduleRandom();
}

function miuNormalizeForFilter(text)
{
  var replacements = {
    "á":"a", "à":"a", "â":"a", "ã":"a", "ä":"a", "é":"e", "è":"e", "ê":"e", "ë":"e",
    "í":"i", "ì":"i", "î":"i", "ï":"i", "ó":"o", "ò":"o", "ô":"o", "õ":"o", "ö":"o",
    "ú":"u", "ù":"u", "û":"u", "ü":"u", "ç":"c", "0":"o", "1":"i", "3":"e", "4":"a",
    "5":"s", "7":"t", "@":"a", "$":"s"
  };
  return String(text || "").toLowerCase().split("").map(function (character) {
    return Object.prototype.hasOwnProperty.call(replacements, character) ? replacements[character] : character;
  }).join("").replace(/(.)\1{2,}/g, "$1$1").replace(/[^a-z0-9]+/g, " ");
}

function miuLocalFilter(message)
{
  if (!message) { return "Escreve uma pergunta antes de enviar."; }
  if (message.length > miuConfig.maxMessageChars) {
    return "A mensagem é demasiado longa. Resume-a a " + miuConfig.maxMessageChars + " caracteres.";
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)) {
    return "A mensagem contém caracteres que não consigo processar.";
  }
  if (/(.)\1{14,}/.test(message)) { return "A mensagem tem demasiados caracteres repetidos."; }
  if ((message.match(/https?:\/\/|www\./gi) || []).length > 2) { return "A mensagem tem demasiados links."; }
  var normalized = miuNormalizeForFilter(message);
  var blockedPatterns = [
    /\b(?:puta|puto|caralho|merda|foder|fodase|cabrao|paneleiro|retardado)\b/,
    /\b(?:fuck|fucking|bitch|cunt|asshole|motherfucker)\b/,
    /\b(?:nazi|heil hitler|white power)\b/,
    /\b(?:porn|porno|sexo explicito|nudes?|pedofil)\b/,
    /\b(?:vou te matar|matar te|quero matar|ameaca de morte)\b/,
    /\b(?:ignora|esquece|ultrapassa|contorna) (?:todas? )?(?:as )?(?:instrucoes|regras|restricoes)\b/,
    /\b(?:system prompt|prompt do sistema|revela (?:o )?prompt|mostra (?:o )?prompt|api key|chave de api|password|palavra passe|segredo do sistema)\b/,
    /\b(?:developer message|mensagem de programador|modo jailbreak|jailbreak)\b/
  ];
  if (blockedPatterns.some(function (pattern) { return pattern.test(normalized); })) {
    return "Não consigo enviar essa mensagem. Experimenta reformulá-la com respeito e dentro do tema da Mia & Paper.";
  }
  return "";
}

function miuLocalIntentReply(message)
{
  var normalized = miuNormalizeForFilter(message);
  var promptProbe = normalized.indexOf("prompt") !== -1
    || /\b(?:system message|developer message|mensagem (?:do|de) sistema|mensagem de programador)\b/.test(normalized)
    || /\b(?:instrucoes|regras|configuracao) (?:internas|originais|secretas|do sistema)\b/.test(normalized)
    || /\b(?:revela|mostra|repete|escreve|diz).{0,45}\b(?:instrucoes|regras internas|segredo do sistema)\b/.test(normalized)
    || /\b(?:ignora|esquece|ultrapassa|contorna).{0,40}\b(?:instrucoes|regras|restricoes)\b/.test(normalized)
    || /\b(?:api key|chave de api|password|palavra passe|segredo do sistema|jailbreak|modo jailbreak)\b/.test(normalized);
  if (promptProbe && miuConfig.localIntents && miuConfig.localIntents.promptProbe) {
    return miuConfig.localIntents.promptProbe;
  }
  var humanContact = /\b(?:falar|contactar|conversar) (?:com )?(?:a )?(?:mia|alguem|uma pessoa|uma pessoa real|um humano|assistente humano)\b/.test(normalized)
    || /\b(?:apoio humano|atendimento humano|contacto da mia|formulario de contacto)\b/.test(normalized);
  if (humanContact && miuConfig.localIntents && miuConfig.localIntents.humanContact) {
    return miuConfig.localIntents.humanContact;
  }
  return null;
}

function miuLogLocalReply(message, replyId)
{
  window.fetch(miuApiUrl, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      action: "local",
      csrf: miuConfig.csrf,
      conversationId: miuConversationId,
      message: message,
      quickReplyId: replyId && replyId.indexOf("intent-") !== 0 ? replyId : "",
      page: window.location.pathname,
      context: miuReadWizardContext(),
      stream: false
    })
  }).then(function (response) {
    return response.ok ? response.json() : null;
  }).then(function (data) {
    if (data && data.conversationId) {
      miuConversationId = data.conversationId;
      miuSaveLocalState();
    }
  }).catch(function () {});
}

function miuSendLocalReply(question, answer, replyId)
{
  question = String(question || "").trim();
  answer = String(answer || "").trim();
  if (miuBusy || !question || !answer) { return; }

  miuWakeLauncher();
  miuSetStatus("");
  miuMessages.push({ role: "user", text: question });
  miuSaveLocalState();
  miuRenderMessages();
  if (miuInput) { miuInput.value = ""; miuUpdateCount(); }

  var pendingMessage = miuThinkingNode(miuNextAssistantAvatarIndex());
  var bubble = miuMessageBubble(pendingMessage);
  var visibleText = "";
  var offset = 0;
  var chunkSize = Math.max(2, Math.ceil(answer.length / 55));
  miuMessagesHost.appendChild(pendingMessage);
  miuScrollToEnd();
  miuSetBusy(true);
  miuAnimationTrigger("quick_reply");
  window.setTimeout(function () { if (miuBusy) { miuAnimationTrigger("reply_start"); } }, 360);
  miuLogLocalReply(question, String(replyId || ""));

  window.setTimeout(function writeChunk() {
    offset = Math.min(answer.length, offset + chunkSize);
    visibleText = answer.slice(0, offset);
    pendingMessage.removeAttribute("data-miu-thinking");
    pendingMessage.classList.add("is-streaming");
    bubble.innerHTML = "";
    miuRenderText(bubble, visibleText);
    miuScrollToEnd();
    if (offset < answer.length) {
      window.setTimeout(writeChunk, 22);
      return;
    }
    pendingMessage.classList.remove("is-streaming");
    miuMessages.push({ role: "assistant", text: answer });
    miuSaveLocalState();
    miuRenderMessages();
    miuSetBusy(false);
    miuAnimationTrigger("reply_end");
    miuRestartInactivityFinishTimer();
    if (miuInput) { miuInput.focus(); }
  }, 180);
}

function miuThinkingNode(avatarIndex)
{
  var row = miuMessageNode("assistant", "", "", avatarIndex);
  var bubble = miuMessageBubble(row);
  row.dataset.miuThinking = "1";
  bubble.innerHTML = '<span class="miu-thinking" aria-label="Míu está a pensar"><i></i><i></i><i></i></span>';
  return row;
}

function miuRemoveThinking()
{
  var node = miuMessagesHost && miuMessagesHost.querySelector("[data-miu-thinking]");
  if (node) { node.remove(); }
}

function miuContextScope()
{
  return window.location.pathname.indexOf("/congressos/2026/") !== -1 ? "congress-2026" : "main";
}

function miuReadWizardContext()
{
  if (miuIsAdminChatPage()) { return null; }
  var product = null;
  var step = null;
  var productSlug = "";
  var stepId = "";
  try {
    if (typeof state !== "undefined" && state && state.product) { product = state.product; }
    if (product && typeof product === "object") {
      productSlug = String(product.slug || (document.body && document.body.dataset.product) || "");
      if (typeof currentStep === "function") { step = currentStep(product); }
      if ((!step || typeof step !== "object") && typeof visibleSteps === "function") {
        var steps = visibleSteps(product);
        var index = typeof state !== "undefined" && state ? Number(state.currentStep || 0) : 0;
        step = Array.isArray(steps) ? steps[index] : null;
      }
      if ((!step || typeof step !== "object") && Array.isArray(product.steps)) {
        var fallbackIndex = typeof state !== "undefined" && state ? Number(state.currentStep || 0) : 0;
        step = product.steps[fallbackIndex];
      }
      stepId = step && step.id ? String(step.id) : "";
    } else if (document.body) {
      productSlug = String(document.body.dataset.miuProduct || "");
      stepId = String(document.body.dataset.miuStep || "");
    }
  } catch (error) { return null; }
  if (!/^[a-z0-9][a-z0-9_-]{0,100}$/i.test(productSlug) || !/^[a-z0-9][a-z0-9_-]{0,100}$/i.test(stepId)) { return null; }
  return { scope: miuContextScope(), product: productSlug, step: stepId };
}

function miuUiCleanText(value, maxLength)
{
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email oculto]")
    .replace(/\b(?:\+?351[\s.-]?)?(?:\d[\s.-]?){9,}\b/g, "[número oculto]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength || 180);
}

function miuUiIsVisible(element)
{
  if (!element || element.closest(".miu-root, .admin-global-nav, [aria-hidden='true']")) { return false; }
  var style = window.getComputedStyle(element);
  var rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0
    && rect.width > 0 && rect.height > 0;
}

function miuUiControlLabel(element)
{
  var direct = element.getAttribute("aria-label") || element.getAttribute("data-track-label") || element.getAttribute("title");
  var label = element.labels && element.labels.length ? element.labels[0] : element.closest("label");
  var labelText = "";
  if (!direct && label) {
    var labelCopy = label.cloneNode(true);
    Array.prototype.forEach.call(labelCopy.querySelectorAll("input, select, textarea, button"), function (control) {
      control.remove();
    });
    labelText = labelCopy.innerText || labelCopy.textContent;
  }
  return miuUiCleanText(direct || labelText || element.innerText || element.textContent, 140);
}

function miuReadVisibleUiState()
{
  if (miuIsAdminChatPage()) { return { selected: [], errors: [] }; }
  var scope = document.querySelector(".wizard-shell .step-card")
    || document.querySelector(".wizard-shell")
    || document.querySelector("#order-form")
    || document.querySelector(".product-shell")
    || document.body;
  var selected = [];
  var errors = [];

  function addUnique(list, value, limit)
  {
    value = miuUiCleanText(value, 180);
    if (value && list.indexOf(value) === -1 && list.length < limit) { list.push(value); }
  }

  Array.prototype.forEach.call(scope.querySelectorAll("select, input[type='checkbox'], input[type='radio'], input[type='number'], input[type='range']"), function (control) {
    if (!miuUiIsVisible(control) || control.disabled) { return; }
    var type = String(control.type || "").toLowerCase();
    var label = miuUiControlLabel(control);
    if (control.tagName === "SELECT") {
      var option = control.options && control.selectedIndex >= 0 ? control.options[control.selectedIndex] : null;
      if (option && miuUiCleanText(option.textContent, 100)) {
        addUnique(selected, (label ? label + ": " : "") + option.textContent, 20);
      }
    } else if ((type === "checkbox" || type === "radio") && control.checked) {
      addUnique(selected, label || control.value, 20);
    } else if ((type === "number" || type === "range") && control.value !== "") {
      addUnique(selected, (label ? label + ": " : "Valor: ") + control.value, 20);
    }
  });

  Array.prototype.forEach.call(scope.querySelectorAll(".is-selected, [aria-pressed='true'], [aria-selected='true'], [data-selected='true']"), function (element) {
    if (miuUiIsVisible(element)) { addUnique(selected, miuUiControlLabel(element), 20); }
  });

  Array.prototype.forEach.call(document.querySelectorAll(".form-error, .action-error, .field-error, .is-missing, [role='alert'], [aria-invalid='true']"), function (element) {
    if (!miuUiIsVisible(element)) { return; }
    var text = element.matches("input, select, textarea")
      ? miuUiControlLabel(element)
      : element.innerText || element.textContent;
    addUnique(errors, text, 10);
  });

  return { selected: selected, errors: errors };
}

function miuRefreshContext(force)
{
  if (!miuConfig || !miuRoot) { return; }
  var context = miuReadWizardContext();
  var signature = context ? [context.scope, context.product, context.step].join(":") : "none";
  var previousSignature = miuContextSignature;
  if (!force && signature === miuContextSignature) { return; }
  miuContextSignature = signature;
  if (previousSignature && previousSignature !== signature) { miuAnimationTrigger("step_change"); }
  if (!context) {
    miuPageContext = null;
    if (!miuMessages.length) { miuRenderMessages(); }
    return;
  }
  window.fetch(miuApiUrl, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ action: "context", csrf: miuConfig.csrf, page: window.location.pathname, context: context })
  }).then(function (response) {
    return response.ok ? response.json() : null;
  }).then(function (data) {
    if (signature !== miuContextSignature) { return; }
    miuPageContext = data && data.ok && data.context ? data.context : null;
    if (!miuMessages.length) { miuRenderMessages(); }
  }).catch(function () {});
}

function miuScheduleContextRefresh()
{
  window.clearTimeout(miuContextTimer);
  miuContextTimer = window.setTimeout(function () { miuRefreshContext(false); }, 120);
}

function miuWatchContext()
{
  if (miuIsAdminChatPage()) {
    miuPageContext = null;
    miuContextSignature = "none";
    return;
  }
  if (window.MutationObserver && document.body) {
    miuContextObserver = new MutationObserver(miuScheduleContextRefresh);
    miuContextObserver.observe(document.body, { childList: true, subtree: true, attributes: true });
  }
  document.addEventListener("click", miuScheduleContextRefresh, true);
  document.addEventListener("change", miuScheduleContextRefresh, true);
  window.addEventListener("popstate", miuScheduleContextRefresh);
  miuContextInterval = window.setInterval(function () { miuRefreshContext(false); }, 1200);
  miuRefreshContext(true);
}

function miuRequestBody(message)
{
  return {
    action: "message",
    csrf: miuConfig.csrf,
    conversationId: miuConversationId,
    message: message,
    page: window.location.pathname,
    context: miuReadWizardContext(),
    uiState: miuReadVisibleUiState(),
    stream: true
  };
}

function miuFinalizeStreamNode(node, text)
{
  if (!node) { return; }
  var bubble = miuMessageBubble(node);
  node.removeAttribute("data-miu-thinking");
  node.classList.remove("is-streaming");
  bubble.innerHTML = "";
  miuRenderText(bubble, text);
  miuScrollToEnd();
}

function miuConsumeStream(response, node)
{
  var reader = response.body && response.body.getReader ? response.body.getReader() : null;
  var decoder = window.TextDecoder ? new TextDecoder("utf-8") : null;
  var buffer = "";
  var fullText = "";
  var finished = false;
  var streamError = "";
  var bubble = miuMessageBubble(node);

  function processEvent(event)
  {
    if (!event || !event.type) { return; }
    if (event.conversationId) { miuConversationId = String(event.conversationId); }
    if (event.type === "delta" && typeof event.text === "string") {
      fullText += event.text;
      node.removeAttribute("data-miu-thinking");
      node.classList.add("is-streaming");
      bubble.textContent = fullText;
      miuScrollToEnd();
    } else if (event.type === "done") {
      finished = true;
    } else if (event.type === "error") {
      streamError = String(event.message || "Não foi possível obter uma resposta.");
      fullText = streamError;
      node.removeAttribute("data-miu-thinking");
      bubble.textContent = fullText;
      miuScrollToEnd();
    }
  }

  function processLines(finalChunk)
  {
    var lines = buffer.split("\n");
    if (!finalChunk) { buffer = lines.pop(); } else { buffer = ""; }
    lines.forEach(function (line) {
      line = line.trim();
      if (!line) { return; }
      try { processEvent(JSON.parse(line)); } catch (error) {}
    });
  }

  function complete()
  {
    if (!fullText) { throw new Error("empty_stream"); }
    miuFinalizeStreamNode(node, fullText);
    return { ok: finished && !streamError, reply: fullText, error: streamError };
  }

  if (!reader || !decoder) {
    return response.text().then(function (raw) {
      buffer = raw;
      processLines(true);
      return complete();
    });
  }
  function readNext()
  {
    return reader.read().then(function (result) {
      if (result.done) {
        buffer += decoder.decode();
        processLines(true);
        return complete();
      }
      buffer += decoder.decode(result.value, { stream: true });
      processLines(false);
      return readNext();
    });
  }
  return readNext();
}

function miuHandleJsonResult(response)
{
  return response.json().catch(function () { return {}; }).then(function (data) {
    return { response: response, data: data };
  });
}

function miuSendMessage(forcedMessage)
{
  var message = String(forcedMessage || (miuInput ? miuInput.value : "")).trim();
  var replyCompleted = false;
  if (miuBusy) { return; }
  if (message.length > miuConfig.maxMessageChars) {
    miuSetStatus("A mensagem é demasiado longa. Resume-a a " + miuConfig.maxMessageChars + " caracteres.");
    return;
  }
  var localIntent = miuLocalIntentReply(message);
  if (localIntent && localIntent.answer) {
    if (localIntent.id === "intent-prompt-probe") {
      miuConversationId = "";
      miuSaveLocalState();
    }
    miuSendLocalReply(message, localIntent.answer, localIntent.id);
    return;
  }
  var localError = miuLocalFilter(message);
  if (localError) { miuSetStatus(localError); return; }

  miuSetStatus("");
  miuMessages.push({ role: "user", text: message });
  miuSaveLocalState();
  miuRenderMessages();
  if (miuInput) { miuInput.value = ""; miuUpdateCount(); }
  var pendingMessage = miuThinkingNode(miuNextAssistantAvatarIndex());
  miuMessagesHost.appendChild(pendingMessage);
  miuScrollToEnd();
  miuSetBusy(true);
  miuAnimationTrigger("message_sent");
  window.setTimeout(function () { if (miuBusy) { miuAnimationTrigger("reply_start"); } }, 360);

  window.fetch(miuApiUrl, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "Accept": "application/x-ndjson, application/json" },
    body: JSON.stringify(miuRequestBody(message))
  }).then(function (response) {
    var contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!response.ok || contentType.indexOf("application/x-ndjson") === -1) {
      return miuHandleJsonResult(response).then(function (result) {
        var data = result.data || {};
        miuRemoveThinking();
        if (data.conversationId) { miuConversationId = data.conversationId; }
        if (!result.response.ok || !data.ok) {
          if (data.blocked) { miuMessages.pop(); miuRenderMessages(); }
          if (data.message) {
            miuSetStatus(data.message);
            if (!data.blocked) { miuMessagesHost.appendChild(miuMessageNode("notice", data.message)); }
          } else { miuSetStatus("Não foi possível obter uma resposta. Tenta novamente."); }
          miuSaveLocalState();
          miuScrollToEnd();
          return;
        }
        miuMessages.push({ role: "assistant", text: data.reply });
        miuSaveLocalState();
        miuRenderMessages();
        replyCompleted = true;
      });
    }
    return miuConsumeStream(response, pendingMessage).then(function (result) {
      miuMessages.push({ role: "assistant", text: result.reply });
      miuSaveLocalState();
      miuRenderMessages();
      replyCompleted = true;
      if (!result.ok && result.error) { miuSetStatus("A resposta foi interrompida."); }
    });
  }).catch(function () {
    miuRemoveThinking();
    miuMessages.pop();
    miuSaveLocalState();
    miuRenderMessages();
    miuSetStatus("Não foi possível ligar ao Míu. Confirma a ligação e tenta novamente.");
  }).then(function () {
    miuSetBusy(false);
    if (replyCompleted) {
      miuAnimationTrigger("reply_end");
      miuRestartInactivityFinishTimer();
    }
    if (miuInput) { miuInput.focus(); }
  });
}

function miuResetConversation()
{
  miuNotifyFinished(false);
  miuEmailedUserCount = 0;
  miuCancelPanelClosedFinish();
  if (miuInactivityFinishTimer) {
    window.clearTimeout(miuInactivityFinishTimer);
    miuInactivityFinishTimer = 0;
  }
  miuConversationId = "";
  miuMessages = [];
  miuSaveLocalState();
  miuSetStatus("");
  miuRenderMessages();
  miuAnimationTrigger("conversation_reset");
  if (miuInput) { miuInput.focus(); }
}

function miuSetOpen(open)
{
  if (!miuRoot || !miuPanel) { return; }
  var wasOpen = miuRoot.classList.contains("is-open");
  if (!!open === wasOpen) { return; }
  if (open) {
    miuAnimationResetRoam();
    miuCancelPanelClosedFinish();
    var miniCatFace = miuRoot.querySelector(".miu-panel__mini-cat .miu-face");
    if (miniCatFace && !miniCatFace.getAttribute("data-miu-ready")) {
      miniCatFace.setAttribute("data-miu-ready", "1");
      miuAnimationApplyStatic(miniCatFace, 0);
    }
  } else {
    miuSchedulePanelClosedFinish();
  }
  miuRoot.classList.toggle("is-open", !!open);
  document.body.classList.toggle("is-miu-open", !!open);
  miuPanel.setAttribute("aria-hidden", open ? "false" : "true");
  miuRoot.querySelector(".miu-launcher").setAttribute("aria-expanded", open ? "true" : "false");
  miuWakeLauncher();
  miuAnimationTrigger(open ? "launcher_open" : "launcher_close");
  if (open) {
    miuRefreshContext(false);
    if (miuInput) { window.setTimeout(function () { miuInput.focus(); }, 80); }
  }
}

function miuInteractiveProductSlug()
{
  return document.body ? String(document.body.getAttribute("data-product") || "").trim().toLowerCase() : "";
}

function miuInteractiveCandidates(trigger)
{
  var config = miuInteractiveAnimationConfig;
  var slug = miuInteractiveProductSlug();
  if (!config || !slug || !Array.isArray(config.animations)) { return []; }
  return config.animations.filter(function (animation) {
    if (!animation || !animation.enabled || !Array.isArray(animation.triggers) || animation.triggers.indexOf(trigger) === -1) { return false; }
    var products = Array.isArray(animation.products) ? animation.products : [];
    if (products.length && products.indexOf("*") === -1 && products.indexOf(slug) === -1) { return false; }
    // Ao entrar num produto tem de existir sempre uma animação elegível. A
    // probabilidade continua a controlar os gatilhos aleatórios/ambientais,
    // mas não pode fazer o product_enter desaparecer em 62% das visitas.
    if (trigger === "product_enter") { return true; }
    var probability = Math.max(0, Math.min(1, Number(animation.probability == null ? 1 : animation.probability)));
    return Math.random() <= probability;
  });
}

function miuInteractiveStop()
{
  window.clearTimeout(miuInteractiveTimer);
  miuInteractiveTimer = 0;
  miuInteractiveSerial += 1;
  if (miuInteractiveWrap && typeof miuInteractiveWrap.getAnimations === "function") {
    miuInteractiveWrap.getAnimations().forEach(function (animation) { try { animation.cancel(); } catch (error) {} });
  }
  if (miuRoot) {
    miuRoot.classList.remove("is-interactive");
    miuRoot.classList.remove("is-debug-interactive-active");
  }
  if (miuInteractiveWrap) { miuInteractiveWrap.style.transform = ""; }
}

function miuInteractiveMotion(animation, duration)
{
  if (!miuInteractiveWrap || !animation || !animation.motion || (miuReducedMotion && !miuDebugForceMotion) || typeof miuInteractiveWrap.animate !== "function") { return; }
  var type = String(animation.motion.type || "none");
  var distance = Math.max(0, Number(animation.motion.distancePx || 0));
  var maxRoam = miuInteractiveAnimationConfig && miuInteractiveAnimationConfig.display
    ? Math.max(0, Number(miuInteractiveAnimationConfig.display.maxRoamPx || 180)) : 180;
  if (!distance || type === "none") { return; }
  distance = Math.min(distance, maxRoam || distance);
  if (type === "jump") {
    miuInteractiveWrap.animate([
      { transform: "translate3d(0,0,0)" },
      { transform: "translate3d(0," + (-distance) + "px,0)", offset: .48 },
      { transform: "translate3d(0,0,0)" }
    ], { duration: Math.min(1600, Math.max(360, duration)), easing: "ease-in-out" });
  } else {
    var x = type === "left" ? -distance : distance;
    miuInteractiveWrap.animate([
      { transform: "translate3d(0,0,0)" },
      { transform: "translate3d(" + x + "px,0,0)" },
      { transform: "translate3d(0,0,0)" }
    ], { duration: Math.min(5000, Math.max(500, duration)), easing: "ease-in-out" });
  }
}

function miuInteractivePlay(animation)
{
  if (!animation || !miuInteractiveSprite || !miuRoot) { return false; }
  miuInteractiveStop();
  var serial = miuInteractiveSerial;
  var sequence = Array.isArray(animation.sequence) && animation.sequence.length ? animation.sequence.slice() : [0];
  var durations = Array.isArray(animation.frameDurationsMs) && animation.frameDurationsMs.length === sequence.length
    ? animation.frameDurationsMs.slice() : sequence.map(function () { return 180; });
  var configuredRepeat = Math.max(0, Number(animation.repeat == null ? 1 : animation.repeat));
  var loopUntilStopped = configuredRepeat === 0;
  var repeat = loopUntilStopped ? 1 : Math.max(1, configuredRepeat);
  var cycleMs = durations.reduce(function (total, ms) { return total + Math.max(40, Number(ms || 180)); }, 0);
  var cursor = 0;
  var cycles = 0;
  var sheetUrl = miuAnimationSheetUrl(animation);
  if (!sheetUrl) { return false; }
  // Guardamos a URL resolvida no objecto para que o primeiro frame possa ser
  // desenhado mesmo em configurações de laboratório que só tenham `file`.
  animation.sheetUrl = sheetUrl;
  miuRoot.classList.add("is-interactive");
  if (miuDebugForceMotion && miuIsAdminChatPage()) { miuRoot.classList.add("is-debug-interactive-active"); }
  miuInteractiveMotion(animation, cycleMs * repeat);

  function draw() {
    if (serial !== miuInteractiveSerial || !miuInteractiveSprite) { return; }
    miuAnimationApplyFrame(miuInteractiveSprite, animation, sequence[cursor]);
    if (miuReducedMotion && !miuDebugForceMotion) {
      miuInteractiveTimer = window.setTimeout(miuInteractiveStop, 900);
      return;
    }
    var delay = Math.max(40, Number(durations[cursor] || 180));
    cursor += 1;
    if (cursor >= sequence.length) {
      cursor = 0;
      cycles += 1;
      if (!loopUntilStopped && cycles >= repeat) {
        miuInteractiveTimer = window.setTimeout(miuInteractiveStop, Math.min(500, delay));
        return;
      }
    }
    miuInteractiveTimer = window.setTimeout(draw, delay);
  }
  draw();
  return true;
}

function miuInteractiveTrigger(trigger)
{
  if (miuRoot && (miuRoot.classList.contains("is-miu-v2-loading") || miuRoot.classList.contains("is-miu-v2-ready"))) { return false; }
  var candidates = miuInteractiveCandidates(trigger);
  if (!candidates.length) { return false; }
  var totalWeight = candidates.reduce(function (sum, animation) { return sum + Math.max(1, Number(animation.weight || 1)); }, 0);
  var pick = Math.random() * totalWeight;
  var selected = candidates[candidates.length - 1];
  candidates.some(function (animation) {
    pick -= Math.max(1, Number(animation.weight || 1));
    if (pick <= 0) { selected = animation; return true; }
    return false;
  });
  return miuInteractivePlay(selected);
}

function miuDebugReadPanelState()
{
  try {
    var raw = window.localStorage.getItem(miuDebugPanelStorageKey);
    var parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) { return {}; }
}

function miuDebugWritePanelState(patch)
{
  var state = miuDebugReadPanelState();
  Object.keys(patch || {}).forEach(function (key) { state[key] = patch[key]; });
  try { window.localStorage.setItem(miuDebugPanelStorageKey, JSON.stringify(state)); }
  catch (error) {}
}

function miuDebugSetCollapsed(panel, collapsed)
{
  if (!panel) { return; }
  var toggle = panel.querySelector("[data-miu-debug-toggle]");
  panel.classList.toggle("is-collapsed", !!collapsed);
  if (toggle) {
    toggle.textContent = collapsed ? "+" : "−";
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    toggle.title = collapsed ? "Abrir painel" : "Recolher painel";
  }
}

function miuDebugParseIntegerList(value)
{
  return String(value || "").split(",").map(function (part) {
    return Number(String(part).trim());
  }).filter(function (value) {
    return Number.isFinite(value) && value >= 0 && Math.floor(value) === value;
  });
}

function miuDebugFormValue(form, name)
{
  var field = form ? form.elements.namedItem(name) : null;
  return field ? field.value : "";
}

function miuDebugFormChecked(form, name)
{
  var field = form ? form.elements.namedItem(name) : null;
  return !!(field && field.checked);
}

function miuDebugFindInteractiveAnimation(id)
{
  var animations = miuInteractiveAnimationConfig && Array.isArray(miuInteractiveAnimationConfig.animations)
    ? miuInteractiveAnimationConfig.animations : [];
  var selected = null;
  animations.some(function (animation) {
    if (String(animation.id || "") === String(id || "")) { selected = animation; return true; }
    return false;
  });
  return selected;
}

function miuDebugAnimationDraftFromForm(form, animation)
{
  if (!form || !animation) { return animation; }
  var columns = Math.max(1, Math.min(16, Number(miuDebugFormValue(form, "columns")) || Number(animation.columns || 1)));
  var rows = Math.max(1, Math.min(16, Number(miuDebugFormValue(form, "rows")) || Number(animation.rows || 1)));
  var frameCount = columns * rows;
  var sequence = miuDebugParseIntegerList(miuDebugFormValue(form, "sequence"));
  if (!sequence.length) {
    sequence = [];
    for (var i = 0; i < frameCount; i += 1) { sequence.push(i); }
  }
  sequence = sequence.map(function (frame) { return Math.max(0, Math.min(frameCount - 1, frame)); });
  var frameMs = Math.max(40, Math.min(10000, Number(miuDebugFormValue(form, "frame_ms")) || 180));
  var durations = miuDebugParseIntegerList(miuDebugFormValue(form, "durations"));
  if (durations.length !== sequence.length) {
    durations = sequence.map(function () { return frameMs; });
  } else {
    durations = durations.map(function (ms) { return Math.max(40, Math.min(10000, Number(ms) || frameMs)); });
  }

  animation.name = String(miuDebugFormValue(form, "animation_name") || animation.name || animation.id || "Animação");
  animation.columns = columns;
  animation.rows = rows;
  animation.sequence = sequence;
  animation.frameDurationsMs = durations;
  animation.repeat = Math.max(0, Math.min(20, Number(miuDebugFormValue(form, "repeat")) || 0));
  animation.staticFrame = Math.max(0, Math.min(frameCount - 1, Number(miuDebugFormValue(form, "static_frame")) || 0));
  animation.probability = Math.max(0, Math.min(1, (Number(miuDebugFormValue(form, "probability")) || 0) / 100));
  animation.weight = Math.max(1, Math.min(100, Number(miuDebugFormValue(form, "weight")) || 1));
  animation.cooldownMs = Math.max(0, Math.min(3600000, (Number(miuDebugFormValue(form, "cooldown_seconds")) || 0) * 1000));
  animation.flipX = miuDebugFormChecked(form, "flip_x");
  animation.enabled = miuDebugFormChecked(form, "enabled");
  animation.motion = animation.motion || {};
  animation.motion.type = String(miuDebugFormValue(form, "motion_type") || "none");
  animation.motion.distancePx = Math.max(0, Math.min(600, Number(miuDebugFormValue(form, "motion_distance")) || 0));

  var triggerFields = form.querySelectorAll('input[name="triggers[]"]:checked');
  animation.triggers = Array.prototype.map.call(triggerFields, function (field) { return String(field.value || ""); });
  animation.products = String(miuDebugFormValue(form, "product_scopes") || "").split(",").map(function (item) {
    return item.trim();
  }).filter(Boolean);

  var fileField = form.elements.namedItem("sheet");
  if (fileField && fileField.files && fileField.files[0]) {
    var animationId = String(animation.id || "draft");
    if (miuDebugObjectUrls[animationId]) {
      try { window.URL.revokeObjectURL(miuDebugObjectUrls[animationId]); } catch (error) {}
    }
    miuDebugObjectUrls[animationId] = window.URL.createObjectURL(fileField.files[0]);
    animation.sheetUrl = miuDebugObjectUrls[animationId];
  }
  return animation;
}

function miuDebugSyncAnimationForm(form)
{
  if (!form) { return; }
  var action = String(miuDebugFormValue(form, "action") || "");
  if (action !== "update_animation") { return; }
  var id = String(miuDebugFormValue(form, "animation_id") || "");
  var animation = miuDebugFindInteractiveAnimation(id);
  if (!animation) { return; }
  miuDebugAnimationDraftFromForm(form, animation);

  var button = document.querySelector('[data-miu-debug-kind="interactive"][data-miu-debug-animation-id="' + id.replace(/"/g, '\\"') + '"]');
  if (button) {
    button.textContent = String(animation.name || animation.id || "Animação") + (animation.enabled === false ? " · off" : "");
    button.classList.toggle("is-disabled-config", animation.enabled === false);
  }

  var card = form.closest("[data-animation-preview-card]");
  var preview = card ? card.querySelector("[data-animation-preview]") : null;
  if (preview) {
    preview.setAttribute("data-columns", String(animation.columns));
    preview.setAttribute("data-rows", String(animation.rows));
    preview.setAttribute("data-sequence", animation.sequence.join(","));
    preview.setAttribute("data-durations", animation.frameDurationsMs.join(","));
    preview.setAttribute("data-flip", animation.flipX ? "1" : "0");
    if (animation.sheetUrl) { preview.setAttribute("data-sheet", animation.sheetUrl); }
  }

  if (miuDebugActiveTest && miuDebugActiveTest.kind === "interactive" && String(miuDebugActiveTest.id || "") === id) {
    miuDebugForceMotion = true;
    miuInteractivePlay(animation);
    miuDebugSetStatus("Pré-visualização em tempo real: " + String(animation.name || animation.id));
  }
}

function miuDebugApplyAppearanceDraft(form, previewPrompt, changedTarget)
{
  if (!form || !miuAnimationConfig || !miuAnimationConfig.display) { return; }
  var display = miuAnimationConfig.display;
  display.launcherPx = Math.max(24, Math.min(120, Number(miuDebugFormValue(form, "launcher_px")) || display.launcherPx || 46));
  display.launcherPxMobile = Math.max(24, Math.min(120, Number(miuDebugFormValue(form, "launcher_px_mobile")) || display.launcherPxMobile || display.launcherPx));
  display.headerPx = Math.max(16, Math.min(120, Number(miuDebugFormValue(form, "header_px")) || display.headerPx || 26));
  display.headerPxMobile = Math.max(16, Math.min(120, Number(miuDebugFormValue(form, "header_px_mobile")) || display.headerPxMobile || display.headerPx));
  var circleMode = form.querySelector('[name="launcher_mode_circle"]');
  var basketMode = form.querySelector('[name="launcher_mode_basket"]');
  if (changedTarget && changedTarget.getAttribute && changedTarget.getAttribute("data-miu-launcher-mode")) {
    var changedMode = changedTarget.getAttribute("data-miu-launcher-mode");
    if (changedTarget.checked) {
      if (changedMode === "circle" && basketMode) { basketMode.checked = false; }
      if (changedMode === "basket" && circleMode) { circleMode.checked = false; }
    } else if (circleMode && basketMode && !circleMode.checked && !basketMode.checked) {
      changedTarget.checked = true;
    }
  }
  display.launcherMode = basketMode && basketMode.checked ? "basket" : "circle";
  display.headerVisible = miuDebugFormChecked(form, "header_visible");
  display.headerCircle = miuDebugFormChecked(form, "header_circle");
  display.messagePx = Math.max(16, Math.min(80, Number(miuDebugFormValue(form, "message_px")) || display.messagePx || 26));
  display.messagePxMobile = Math.max(16, Math.min(80, Number(miuDebugFormValue(form, "message_px_mobile")) || display.messagePxMobile || display.messagePx));
  display.interactivePx = Math.max(48, Math.min(240, Number(miuDebugFormValue(form, "interactive_px")) || display.interactivePx || 96));
  display.interactivePxMobile = Math.max(48, Math.min(240, Number(miuDebugFormValue(form, "interactive_px_mobile")) || display.interactivePxMobile || display.interactivePx));
  display.promptSeconds = Math.max(0, Math.min(60, Number(miuDebugFormValue(form, "prompt_seconds")) || 0));
  display.launcherCircle = display.launcherMode === "circle";
  display.messageCircle = miuDebugFormChecked(form, "message_circle");
  display.errorsViaMiu = miuDebugFormChecked(form, "errors_via_miu");

  if (miuInteractiveAnimationConfig) {
    miuInteractiveAnimationConfig.display = miuInteractiveAnimationConfig.display || {};
    Object.keys(display).forEach(function (key) { miuInteractiveAnimationConfig.display[key] = display[key]; });
  }

  if (miuRoot) {
    miuRoot.style.setProperty("--miu-launcher-sprite-size-desktop", display.launcherPx + "px");
    miuRoot.style.setProperty("--miu-launcher-sprite-size-mobile", display.launcherPxMobile + "px");
    miuRoot.style.setProperty("--miu-header-sprite-size-desktop", display.headerPx + "px");
    miuRoot.style.setProperty("--miu-header-sprite-size-mobile", display.headerPxMobile + "px");
    miuRoot.style.setProperty("--miu-message-sprite-size-desktop", display.messagePx + "px");
    miuRoot.style.setProperty("--miu-message-sprite-size-mobile", display.messagePxMobile + "px");
    miuRoot.style.setProperty("--miu-interactive-sprite-size-desktop", display.interactivePx + "px");
    miuRoot.style.setProperty("--miu-interactive-sprite-size-mobile", display.interactivePxMobile + "px");
    miuApplyLauncherAppearance(display);
    miuApplyHeaderAppearance(display);
    miuRoot.classList.toggle("miu-no-circle-message", display.messageCircle === false);
  }

  if (previewPrompt === true) {
    if (display.promptSeconds > 0 && miuConfig && miuConfig.launcherPrompt) {
      miuShowLauncherMessage(miuConfig.launcherPrompt, display.promptSeconds * 1000, false);
    } else {
      miuHideLauncherMessage();
    }
  }
}

function miuDebugApplyGlobalAnimationDraft(form)
{
  if (!form || !miuInteractiveAnimationConfig) { return; }
  var display = miuInteractiveAnimationConfig.display = miuInteractiveAnimationConfig.display || {};
  miuInteractiveAnimationConfig.baseAnimationId = String(miuDebugFormValue(form, "base_animation_id") || miuInteractiveAnimationConfig.baseAnimationId || "");
  if (miuRoot && miuRoot.classList.contains("miu-launcher-mode-basket")) { miuLauncherBodyPlayBase(); }
  display.sleepAfterMs = Math.max(5000, (Number(miuDebugFormValue(form, "sleep_after_seconds")) || 45) * 1000);
  display.idleRandomMinMs = Math.max(3000, (Number(miuDebugFormValue(form, "idle_random_min_seconds")) || 14) * 1000);
  display.idleRandomMaxMs = Math.max(display.idleRandomMinMs, (Number(miuDebugFormValue(form, "idle_random_max_seconds")) || 28) * 1000);
  display.maxRoamPx = Math.max(0, Math.min(800, Number(miuDebugFormValue(form, "max_roam_px")) || 0));
  miuSleepDelayMs = display.sleepAfterMs;
  if (miuAnimationConfig && miuAnimationConfig.display) {
    miuAnimationConfig.display.sleepAfterMs = display.sleepAfterMs;
    miuAnimationConfig.display.idleRandomMinMs = display.idleRandomMinMs;
    miuAnimationConfig.display.idleRandomMaxMs = display.idleRandomMaxMs;
    miuAnimationConfig.display.maxRoamPx = display.maxRoamPx;
  }
  miuScheduleSleep();
  miuAnimationScheduleRandom();
}

function miuDebugSetStatus(text)
{
  var node = document.querySelector("[data-miu-debug-status]");
  if (node) { node.textContent = String(text || ""); }
}

function miuDebugButton(label, kind, id, disabled)
{
  var button = document.createElement("button");
  button.type = "button";
  button.className = "miu-debug-animation-button";
  button.textContent = label;
  button.setAttribute("data-miu-debug-kind", kind);
  button.setAttribute("data-miu-debug-animation-id", id);
  if (disabled) {
    button.classList.add("is-disabled-config");
    button.title = "Esta animação está desactivada na configuração, mas podes testá-la aqui.";
  }
  return button;
}

function miuDebugPopulateAnimationButtons()
{
  if (!miuIsAdminChatPage()) { return; }

  var faceHost = document.querySelector("[data-miu-debug-face-buttons]");
  if (faceHost) {
    faceHost.innerHTML = "";
    var faceAnimations = miuAnimationConfig && Array.isArray(miuAnimationConfig.animations)
      ? miuAnimationConfig.animations : [];
    faceAnimations.forEach(function (animation) {
      faceHost.appendChild(miuDebugButton(String(animation.name || animation.id), "face", String(animation.id || ""), false));
    });
    if (!faceAnimations.length) {
      faceHost.innerHTML = '<span class="miu-debug-loading">Sem animações.</span>';
    }
  }

  var interactiveHost = document.querySelector("[data-miu-debug-interactive-buttons]");
  if (interactiveHost) {
    interactiveHost.innerHTML = "";
    var interactiveAnimations = miuInteractiveAnimationConfig && Array.isArray(miuInteractiveAnimationConfig.animations)
      ? miuInteractiveAnimationConfig.animations : [];
    interactiveAnimations.forEach(function (animation) {
      var label = String(animation.name || animation.id || "Animação");
      if (animation.enabled === false) { label += " · off"; }
      interactiveHost.appendChild(miuDebugButton(label, "interactive", String(animation.id || ""), animation.enabled === false));
    });
    if (!interactiveAnimations.length) {
      interactiveHost.innerHTML = '<span class="miu-debug-loading">Sem animações configuradas.</span>';
    }
  }
}

function miuDebugPlayConfigured(kind, id)
{
  miuDebugForceMotion = true;
  miuDebugActiveTest = { kind: kind, id: String(id || "") };
  if (kind === "face") {
    var face = miuAnimationById[String(id || "")];
    if (!face) { miuDebugSetStatus("Não encontrei essa animação da cara."); return false; }
    miuInteractiveStop();
    miuAnimationPlay(face, face.id !== (miuAnimationBase() || {}).id);
    miuDebugSetStatus("A testar: " + String(face.name || face.id));
    return true;
  }

  if (kind === "interactive") {
    var animations = miuInteractiveAnimationConfig && Array.isArray(miuInteractiveAnimationConfig.animations)
      ? miuInteractiveAnimationConfig.animations : [];
    var selected = null;
    animations.some(function (animation) {
      if (String(animation.id || "") === String(id || "")) { selected = animation; return true; }
      return false;
    });
    if (!selected) { miuDebugSetStatus("Não encontrei essa animação de corpo inteiro."); return false; }
    miuAnimationCancelTimer();
    var played = miuInteractivePlay(selected);
    miuDebugSetStatus(played ? "A testar: " + String(selected.name || selected.id) : "Não foi possível iniciar a animação.");
    return played;
  }
  return false;
}

function miuDebugPlayLooseSprite(row, button)
{
  miuDebugForceMotion = true;
  if (!row || !button) { return false; }
  var sheetUrl = String(button.getAttribute("data-sheet-url") || "");
  miuDebugActiveTest = { kind: "loose", sheetUrl: sheetUrl };
  var colsInput = row.querySelector("[data-miu-debug-cols]");
  var rowsInput = row.querySelector("[data-miu-debug-rows]");
  var msInput = row.querySelector("[data-miu-debug-ms]");
  var columns = Math.max(1, Math.min(16, Number(colsInput ? colsInput.value : 4) || 4));
  var rows = Math.max(1, Math.min(16, Number(rowsInput ? rowsInput.value : 2) || 2));
  var frameMs = Math.max(40, Math.min(5000, Number(msInput ? msInput.value : 180) || 180));
  var frameCount = columns * rows;
  var sequence = [];
  var durations = [];
  var index;
  for (index = 0; index < frameCount; index += 1) {
    sequence.push(index);
    durations.push(frameMs);
  }

  var animation = {
    id: "miu-debug-loose-sprite",
    name: "Sprite de teste",
    sheetUrl: sheetUrl,
    columns: columns,
    rows: rows,
    sequence: sequence,
    frameDurationsMs: durations,
    repeat: 1,
    enabled: true,
    probability: 1,
    weight: 1,
    cooldownMs: 0,
    flipX: false,
    staticFrame: 0,
    motion: { type: "none", distancePx: 0 },
    transform: { xPx: 0, yPx: 0, rotationDeg: 0 }
  };

  miuAnimationCancelTimer();
  var played = miuInteractivePlay(animation);
  miuDebugSetStatus(played
    ? "Sprite de teste: " + sheetUrl.split("/").pop() + " · " + columns + "×" + rows + " · " + frameMs + " ms"
    : "Não foi possível testar a spritesheet.");
  return played;
}

function miuDebugStopAll()
{
  miuDebugForceMotion = false;
  miuDebugActiveTest = null;
  miuInteractiveStop();
  miuAnimationPlayBase();
  miuDebugSetStatus("Parado. A cara voltou à animação base.");
}

function miuDebugPanelSetup()
{
  if (!miuIsAdminChatPage()) { return; }
  var panel = document.querySelector("[data-miu-debug-panel]");
  if (!panel || panel.getAttribute("data-miu-debug-ready") === "1") { return; }
  panel.setAttribute("data-miu-debug-ready", "1");

  var savedPanelState = miuDebugReadPanelState();
  miuDebugSetCollapsed(panel, savedPanelState.collapsed === true);
  miuDebugPopulateAnimationButtons();

  var appearanceForm = document.querySelector('form input[name="action"][value="save_appearance"]');
  appearanceForm = appearanceForm ? appearanceForm.closest("form") : null;
  if (appearanceForm) {
    appearanceForm.addEventListener("input", function (event) {
      miuDebugApplyAppearanceDraft(appearanceForm, event.target && event.target.name === "prompt_seconds", event.target || null);
    });
    appearanceForm.addEventListener("change", function (event) {
      miuDebugApplyAppearanceDraft(appearanceForm, event.target && event.target.name === "prompt_seconds", event.target || null);
    });
  }

  var globalAnimationForm = document.querySelector('form input[name="action"][value="save_animation_display"]');
  globalAnimationForm = globalAnimationForm ? globalAnimationForm.closest("form") : null;
  if (globalAnimationForm) {
    globalAnimationForm.addEventListener("input", function () { miuDebugApplyGlobalAnimationDraft(globalAnimationForm); });
    globalAnimationForm.addEventListener("change", function () { miuDebugApplyGlobalAnimationDraft(globalAnimationForm); });
  }

  Array.prototype.forEach.call(document.querySelectorAll("form.miu-animation-form"), function (form) {
    var action = String(miuDebugFormValue(form, "action") || "");
    if (action !== "update_animation") { return; }
    form.addEventListener("input", function () { miuDebugSyncAnimationForm(form); });
    form.addEventListener("change", function () { miuDebugSyncAnimationForm(form); });
  });

  panel.addEventListener("input", function (event) {
    var row = event.target && event.target.closest ? event.target.closest("[data-miu-debug-lab-row]") : null;
    if (!row || !miuDebugActiveTest || miuDebugActiveTest.kind !== "loose") { return; }
    var button = row.querySelector("[data-miu-debug-lab-play]");
    if (!button || String(button.getAttribute("data-sheet-url") || "") !== String(miuDebugActiveTest.sheetUrl || "")) { return; }
    miuDebugPlayLooseSprite(row, button);
  });

  panel.addEventListener("click", function (event) {
    var animationButton = event.target.closest("[data-miu-debug-animation-id]");
    if (animationButton && panel.contains(animationButton)) {
      var id = String(animationButton.getAttribute("data-miu-debug-animation-id") || "");
      var kind = String(animationButton.getAttribute("data-miu-debug-kind") || "");
      if (kind === "interactive") {
        var form = document.querySelector('form.miu-animation-form input[name="animation_id"][value="' + id.replace(/"/g, '\\"') + '"]');
        if (form) { miuDebugSyncAnimationForm(form.closest("form")); }
      }
      miuDebugPlayConfigured(kind, id);
      return;
    }

    var labButton = event.target.closest("[data-miu-debug-lab-play]");
    if (labButton && panel.contains(labButton)) {
      miuDebugPlayLooseSprite(labButton.closest("[data-miu-debug-lab-row]"), labButton);
      return;
    }

    if (event.target.closest("[data-miu-debug-stop]")) {
      miuDebugStopAll();
      return;
    }

    if (event.target.closest("[data-miu-debug-reload]")) {
      window.location.reload();
      return;
    }

    var toggle = event.target.closest("[data-miu-debug-toggle]");
    if (toggle) {
      var collapsed = !panel.classList.contains("is-collapsed");
      miuDebugSetCollapsed(panel, collapsed);
      miuDebugWritePanelState({ collapsed: collapsed });
    }
  });
}

function miuHideLauncherMessage()
{
  window.clearTimeout(miuLauncherCalloutTimer);
  miuLauncherCalloutTimer = 0;
  if (miuLauncherCallout) {
    miuLauncherCallout.classList.remove("is-callout-visible");
    miuLauncherCallout.classList.remove("is-site-message");
    miuLauncherCallout.classList.remove("is-site-message-pulsing");
  }
}

function miuShowLauncherMessage(text, durationMs, siteMessage)
{
  var clean = String(text || "").replace(/[<>]/g, "").trim();
  if (!miuLauncherCallout || !clean) { return false; }
  window.clearTimeout(miuLauncherCalloutTimer);
  miuLauncherCallout.textContent = clean;
  miuLauncherCallout.classList.toggle("is-site-message", siteMessage === true);
  miuLauncherCallout.classList.remove("is-site-message-pulsing");
  if (siteMessage === true) {
    /* Reinicia o aviso visual mesmo quando dois erros chegam enquanto o
       mesmo balão ainda está visível. */
    void miuLauncherCallout.offsetWidth;
    miuLauncherCallout.classList.add("is-site-message-pulsing");
  }
  miuLauncherCallout.classList.add("is-callout-visible");
  var duration = durationMs == null || durationMs === "" ? 5200 : Math.max(250, Number(durationMs));
  miuLauncherCalloutTimer = window.setTimeout(miuHideLauncherMessage, duration);
  return true;
}

function miuClaimDailyLauncherPrompt()
{
  var now = new Date();
  var day = [
    now.getFullYear(),
    ("0" + (now.getMonth() + 1)).slice(-2),
    ("0" + now.getDate()).slice(-2)
  ].join("-");

  try {
    if (window.localStorage.getItem(miuLauncherPromptDayKey) === day) {
      return false;
    }
    window.localStorage.setItem(miuLauncherPromptDayKey, day);
  } catch (error) {
    // Sem storage, o balão continua disponível em vez de desaparecer para
    // sempre neste browser.
  }
  return true;
}

window.miuUsesSiteErrorPopups = function () {
  return !!(miuAnimationConfig && miuAnimationConfig.display && miuAnimationConfig.display.errorsViaMiu);
};
window.miuShowSiteMessage = function (text, durationMs) {
  return miuShowLauncherMessage(text, durationMs || 5600, true);
};

function miuBuildInterface()
{
  var launcherPrompt = String(miuConfig.launcherPrompt || "").replace(/[<>&]/g, "").trim();
  miuRoot = document.createElement("div");
  miuRoot.className = "miu-root";
  miuRoot.innerHTML = [
    '<section class="miu-panel" role="dialog" aria-label="Conversa com o Míu" aria-hidden="true">',
      '<header class="miu-panel__head">',
        '<span class="miu-panel__mascot" aria-hidden="true">',
          '<span class="miu-panel__mini-cat">', miuFaceMarkup("miu-face--small miu-face--mini miu-face--header"), '</span>',
        '</span>',
        '<span class="miu-panel__title"><strong>', String(miuConfig.name || "Míu").replace(/[<>&]/g, ""), '</strong></span>',
        '<button class="miu-panel__icon-button miu-panel__new" type="button" title="Nova conversa" aria-label="Começar nova conversa">↻</button>',
        '<button class="miu-panel__icon-button miu-panel__minimize" type="button" title="Minimizar" aria-label="Minimizar conversa"><span aria-hidden="true">−</span></button>',
      '</header>',
      '<div class="miu-messages" role="log" aria-live="polite" aria-relevant="additions text"></div>',
      '<form class="miu-composer">',
        '<div class="miu-composer__row">',
          '<textarea rows="1" placeholder="Escreve a tua pergunta…" aria-label="Mensagem para o Míu"></textarea>',
          '<button class="miu-send" type="submit" aria-label="Enviar mensagem"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 17 8-17 8 3-8-3-8Zm3 8h14"/></svg></button>',
        '</div>',
        '<div class="miu-composer__meta"><span class="miu-status" role="status"></span><span class="miu-count"></span></div>',
      '</form>',
    '</section>',
    '<span class="miu-interactive-wrap" aria-hidden="true"><span class="miu-interactive-sprite"></span></span>',
    '<button class="miu-launcher" type="button" aria-label="Abrir o Míu, assistente virtual" aria-expanded="false">',
      '<svg class="miu-launcher__bubble-outline" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326z"/></svg>',
      '<span class="miu-launcher__bubble-face">', miuFaceMarkup("miu-face--launcher"), '</span>',
      '<span class="miu-launcher__basket" aria-hidden="true"><span class="miu-launcher__basket-body"></span><span class="miu-launcher__basket-front"></span></span>',
      '<span class="miu-launcher__callout" aria-live="polite"></span>',
    '</button>'
  ].join("");
  document.body.appendChild(miuRoot);
  miuPanel = miuRoot.querySelector(".miu-panel");
  miuMessagesHost = miuRoot.querySelector(".miu-messages");
  miuForm = miuRoot.querySelector(".miu-composer");
  miuInput = miuForm.querySelector("textarea");
  miuStatus = miuRoot.querySelector(".miu-status");
  miuCount = miuRoot.querySelector(".miu-count");
  var launcher = miuRoot.querySelector(".miu-launcher");
  var minimize = miuRoot.querySelector(".miu-panel__minimize");
  var reset = miuRoot.querySelector(".miu-panel__new");
  var display = miuAnimationConfig && miuAnimationConfig.display ? miuAnimationConfig.display : {};
  miuLauncherSprite = launcher.querySelector(".miu-launcher__bubble-face .miu-face");
  miuInteractiveWrap = miuRoot.querySelector(".miu-interactive-wrap");
  miuInteractiveSprite = miuRoot.querySelector(".miu-interactive-sprite");
  miuLauncherBodySprite = miuRoot.querySelector(".miu-launcher__basket-body");
  miuLauncherCallout = miuRoot.querySelector(".miu-launcher__callout");
  miuRoot.style.setProperty("--miu-launcher-sprite-size-desktop", Math.max(24, Number(display.launcherPx || 46)) + "px");
  miuRoot.style.setProperty("--miu-launcher-sprite-size-mobile", Math.max(24, Number(display.launcherPxMobile || display.launcherPx || 46)) + "px");
  miuRoot.style.setProperty("--miu-header-sprite-size-desktop", Math.max(16, Number(display.headerPx || 26)) + "px");
  miuRoot.style.setProperty("--miu-header-sprite-size-mobile", Math.max(16, Number(display.headerPxMobile || display.headerPx || 26)) + "px");
  miuRoot.style.setProperty("--miu-message-sprite-size-desktop", Math.max(16, Number(display.messagePx || 26)) + "px");
  miuRoot.style.setProperty("--miu-message-sprite-size-mobile", Math.max(16, Number(display.messagePxMobile || display.messagePx || 26)) + "px");
  miuRoot.style.setProperty("--miu-interactive-sprite-size-desktop", Math.max(48, Number(display.interactivePx || 96)) + "px");
  miuRoot.style.setProperty("--miu-interactive-sprite-size-mobile", Math.max(48, Number(display.interactivePxMobile || display.interactivePx || 96)) + "px");
  miuApplyLauncherAppearance(display);
  miuApplyHeaderAppearance(display);
  miuRoot.classList.toggle("miu-no-circle-message", display.messageCircle === false);
  miuAnimationPlayBase();
  miuV2Boot();

  launcher.addEventListener("click", function () { miuSetOpen(!miuRoot.classList.contains("is-open")); });
  launcher.addEventListener("mouseenter", function () {
    if (!miuRoot.classList.contains("is-open")) {
      miuWakeLauncher();
      miuAnimationTrigger("launcher_hover");
    }
  });
  minimize.addEventListener("click", function () { miuSetOpen(false); launcher.focus(); });
  reset.addEventListener("click", function () {
    if (!miuMessages.length || window.confirm("Começar uma conversa nova?")) { miuResetConversation(); }
  });
  miuForm.addEventListener("submit", function (event) { event.preventDefault(); miuSendMessage(); });
  miuInput.addEventListener("input", function () { miuWakeLauncher(); miuSetStatus(""); miuUpdateCount(); });
  miuInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); miuSendMessage(); }
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && miuRoot.classList.contains("is-open")) { miuSetOpen(false); launcher.focus(); }
  });
  window.addEventListener("pagehide", function () { miuNotifyFinished(true); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      miuNotifyFinished(true);
    }
  });
  if (miuMessages.some(function (m) { return m && m.role === "user"; })) {
    miuRestartInactivityFinishTimer();
  }
  miuRenderMessages();
  miuUpdateCount();
  miuWatchContext();
  miuWatchFooterClearance();
  miuScheduleSleep();
  miuAnimationScheduleRandom();
  if (launcherPrompt && Number(display.promptSeconds || 0) > 0 && miuClaimDailyLauncherPrompt()) {
    window.setTimeout(function () { miuShowLauncherMessage(launcherPrompt, Number(display.promptSeconds) * 1000); }, 280);
  }
  window.setTimeout(function () { miuAnimationTrigger("page_load"); }, 220);
  if (miuInteractiveProductSlug()) {
    window.setTimeout(function () { miuInteractiveTrigger("product_enter"); }, 650);
  }
}

function miuShouldStart()
{
  var page = document.body ? document.body.getAttribute("data-page") : "";
  var allowAdmin = miuIsAdminChatPage();
  if (page === "preview" || window.self !== window.top) { return false; }
  if (!allowAdmin && document.querySelector(".admin-global-nav")) { return false; }
  return true;
}

function miuInit()
{
  if (!document.body || !window.fetch || !window.URL || !miuShouldStart() || miuRoot) { return; }
  if (miuIsAdminChatPage()) { miuStorageKey = "miaandpaper_miu_admin_v1"; }
  miuLoadLocalState();
  window.fetch(miuApiUrl, { credentials: "same-origin", headers: { "Accept": "application/json" } })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (config) {
      if (!config || !config.ok || !config.csrf || (!config.enabled && !miuIsAdminChatPage())) { return; }
      miuConfig = config;
      miuAnimationSetup(config.animations);
      miuBuildInterface();
      miuDebugPanelSetup();
    }).catch(function () {});
}

function miuScheduleInit()
{
  function afterMainContent() {
    if (miuIsAdminChatPage()) {
      miuInit();
      return;
    }
    // O conteúdo e a primeira imagem útil têm prioridade. Só depois do load
    // procuramos uma janela ociosa; o timeout garante que o Míu não desaparece
    // em equipamentos que nunca reportem idle.
    if (window.requestIdleCallback) {
      window.requestIdleCallback(miuInit, { timeout: 3500 });
    } else {
      window.setTimeout(miuInit, 900);
    }
  }

  if (document.readyState === "complete") afterMainContent();
  else window.addEventListener("load", afterMainContent, { once: true });
}

if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", miuScheduleInit); }
else { miuScheduleInit(); }
