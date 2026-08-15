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
var miuPageContext = null;
var miuContextSignature = "";
var miuContextTimer = 0;
var miuContextObserver = null;
var miuContextInterval = 0;
var miuSleepTimer = 0;
var miuSleepDelayMs = 45000;

function miuSpriteMarkup(extraClass)
{
  return '<span class="miu-sprite' + (extraClass ? " " + extraClass : "") + '" aria-hidden="true"></span>';
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
}

function miuSaveLocalState()
{
  try {
    window.sessionStorage.setItem(miuStorageKey, JSON.stringify({
      conversationId: miuConversationId,
      messages: miuMessages.slice(-30)
    }));
  } catch (error) {}
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
    var poses = [0, 4, 6, 5, 7, 1, 2, 3];
    var pose = poses[Math.abs(Number(avatarIndex) || 0) % poses.length];
    row.className = "miu-message-row miu-message-row--assistant";
    miuRenderText(node, text);
    avatar.className = "miu-message-avatar miu-sprite miu-sprite--pose-" + pose;
    avatar.setAttribute("aria-hidden", "true");
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
  miuMessagesHost.appendChild(miuMessageNode("assistant", miuConfig.greeting || "Em que posso ajudar?", "", avatarIndex));
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
  if (!miuRoot || miuBusy || miuRoot.classList.contains("is-open")) { return; }
  miuSleepTimer = window.setTimeout(function () {
    if (miuRoot && !miuBusy && !miuRoot.classList.contains("is-open")) {
      miuRoot.classList.add("is-sleeping");
    }
  }, miuSleepDelayMs);
}

function miuWakeLauncher()
{
  window.clearTimeout(miuSleepTimer);
  miuSleepTimer = 0;
  if (miuRoot) { miuRoot.classList.remove("is-sleeping"); }
  miuScheduleSleep();
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
  if (!force && signature === miuContextSignature) { return; }
  miuContextSignature = signature;
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
      });
    }
    return miuConsumeStream(response, pendingMessage).then(function (result) {
      miuMessages.push({ role: "assistant", text: result.reply });
      miuSaveLocalState();
      miuRenderMessages();
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
    if (miuInput) { miuInput.focus(); }
  });
}

function miuResetConversation()
{
  miuConversationId = "";
  miuMessages = [];
  miuSaveLocalState();
  miuSetStatus("");
  miuRenderMessages();
  if (miuInput) { miuInput.focus(); }
}

function miuSetOpen(open)
{
  if (!miuRoot || !miuPanel) { return; }
  miuRoot.classList.toggle("is-open", !!open);
  document.body.classList.toggle("is-miu-open", !!open);
  miuPanel.setAttribute("aria-hidden", open ? "false" : "true");
  miuRoot.querySelector(".miu-launcher").setAttribute("aria-expanded", open ? "true" : "false");
  miuWakeLauncher();
  if (open) {
    miuRefreshContext(false);
    if (miuInput) { window.setTimeout(function () { miuInput.focus(); }, 80); }
  }
}

function miuBuildInterface()
{
  var launcherPrompt = String(miuConfig.launcherPrompt || "").replace(/[<>&]/g, "").trim();
  miuRoot = document.createElement("div");
  miuRoot.className = "miu-root";
  miuRoot.innerHTML = [
    '<section class="miu-panel" role="dialog" aria-label="Conversa com o Míu" aria-hidden="true">',
      '<header class="miu-panel__head">',
        '<span class="miu-panel__mini-cat">', miuSpriteMarkup("miu-sprite--mini"), '</span>',
        '<span class="miu-panel__title"><strong>', String(miuConfig.name || "Míu").replace(/[<>&]/g, ""), '</strong></span>',
        '<button class="miu-panel__icon-button miu-panel__new" type="button" title="Nova conversa" aria-label="Começar nova conversa">↻</button>',
        '<button class="miu-panel__icon-button miu-panel__close" type="button" aria-label="Fechar conversa">×</button>',
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
    '<button class="miu-launcher" type="button" aria-label="Abrir o Míu, assistente virtual" aria-expanded="false">',
      miuSpriteMarkup("miu-sprite--launcher"),
      launcherPrompt ? '<span class="miu-launcher__callout" aria-hidden="true">' + launcherPrompt + '</span>' : '',
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
  var close = miuRoot.querySelector(".miu-panel__close");
  var reset = miuRoot.querySelector(".miu-panel__new");

  launcher.addEventListener("click", function () { miuSetOpen(!miuRoot.classList.contains("is-open")); });
  close.addEventListener("click", function () { miuSetOpen(false); launcher.focus(); });
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
  miuRenderMessages();
  miuUpdateCount();
  miuWatchContext();
  miuScheduleSleep();
}

function miuShouldStart()
{
  var page = document.body ? document.body.getAttribute("data-page") : "";
  if (page === "preview" || window.self !== window.top) { return false; }
  if (document.querySelector(".admin-global-nav")) { return false; }
  return true;
}

function miuInit()
{
  if (!document.body || !window.fetch || !window.URL || !miuShouldStart() || miuRoot) { return; }
  miuLoadLocalState();
  window.fetch(miuApiUrl, { credentials: "same-origin", headers: { "Accept": "application/json" } })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (config) {
      if (!config || !config.ok || !config.enabled || !config.csrf) { return; }
      miuConfig = config;
      miuBuildInterface();
    }).catch(function () {});
}

if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", miuInit); }
else { miuInit(); }
