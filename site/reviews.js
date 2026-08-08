(function () {
  "use strict";

  var host = document.getElementById("review-bubbles");
  if (!host) return;

  var fallbackImage = "content/brand/logo.webp";
  var intervalMs = 5500;
  var settings = {};
  var reviews = [];
  var currentIndex = 0;
  var timer = null;
  var pointerStart = null;
  var dragging = false;
  var suppressClick = false;
  var positionSyncFrame = null;
  var iconMap = { heart: "♥", flower: "✿", sparkle: "✦", check: "✓", quote: "❝" };

  function createElement(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (typeof text === "string") element.textContent = text;
    return element;
  }

  function safeReviewLink(value) {
    var link = String(value || "").trim();
    if (!link) return "";
    try {
      var parsed = new URL(link, window.location.href);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return link;
    } catch (error) {}
    return "";
  }

  function scheduleNext() {
    window.clearTimeout(timer);
    timer = null;
    if (reviews.length < 2 || dragging || document.hidden) return;
    timer = window.setTimeout(function () { showReview(currentIndex + 1, "next"); }, intervalMs);
  }

  // Mantém as reviews acima do aviso de cookies e do footer quando qualquer
  // um deles entra no viewport.
  function syncReviewOffset() {
    var banner = document.querySelector(".cookie-banner.is-visible");
    var footer = document.querySelector(".site-footer");
    var bottom = window.innerWidth <= 540 ? 12 : 18;
    var rect;
    [banner, footer].forEach(function (element) {
      if (!element) return;
      rect = element.getBoundingClientRect();
      if (rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0) {
        bottom = Math.max(bottom, window.innerHeight - rect.top + 14);
      }
    });
    host.style.setProperty("--review-bottom", Math.round(bottom) + "px");
  }

  function scheduleReviewOffset() {
    if (positionSyncFrame !== null) return;
    positionSyncFrame = window.requestAnimationFrame(function () {
      positionSyncFrame = null;
      syncReviewOffset();
    });
  }

  var card = createElement("a", "review-bubble-card");
  card.setAttribute("aria-label", "Avaliação de cliente");
  card.setAttribute("tabindex", "0");
  card.setAttribute("draggable", "false");
  var imageWrap = createElement("div", "review-bubble-image-wrap");
  var productImage = createElement("img", "review-bubble-image");
  productImage.alt = "Produto associado à avaliação";
  productImage.loading = "eager";
  productImage.decoding = "async";
  productImage.referrerPolicy = "no-referrer";
  productImage.draggable = false;
  imageWrap.appendChild(productImage);
  var content = createElement("div", "review-bubble-content");
  content.setAttribute("aria-live", "polite");
  content.setAttribute("aria-atomic", "true");
  var reviewName = createElement("p", "review-bubble-name");
  var reviewText = createElement("p", "review-bubble-text");
  var rating = createElement("span", "review-bubble-stars");
  content.appendChild(reviewName);
  content.appendChild(reviewText);
  content.appendChild(rating);
  card.appendChild(imageWrap);
  card.appendChild(content);
  host.appendChild(card);

  // REVIEW_DISMISS_V2: fechar esconde as reviews até ao fim da sessão do
  // separador, e deixa no lugar uma pega para as voltar a chamar.
  // sessionStorage e não localStorage de propósito: quem fecha está a dizer
  // "agora não", não "nunca mais".
  var dismissKey = "miaandpaper:reviews-dismissed";

  function reviewsDismissed() {
    try { return window.sessionStorage.getItem(dismissKey) === "1"; } catch (error) { return false; }
  }

  var dismiss = createElement("button", "review-bubble-dismiss", "⌄");
  dismiss.type = "button";
  dismiss.setAttribute("aria-label", "Esconder as avaliações nesta visita");
  dismiss.title = "Esconder as avaliações nesta visita";

  // A pega vive fora do host: o host é escondido inteiro e ela tem de ficar.
  var restore = createElement("button", "review-bubble-restore", "⌃");
  restore.type = "button";
  restore.hidden = true;
  restore.setAttribute("aria-label", "Mostrar as avaliações");
  restore.title = "Mostrar as avaliações";
  document.body.appendChild(restore);

  // O easter egg lê o `data-egg-pumps` para saber quantos movimentos precisa.
  // Sem balão não há bola para saltar, por isso tira-se o atributo enquanto as
  // reviews estão escondidas e repõe-se quando voltam.
  var eggPumps = "";

  function esconderReviews() {
    window.clearTimeout(timer);
    timer = null;
    eggPumps = host.getAttribute("data-egg-pumps") || eggPumps;
    host.removeAttribute("data-egg-pumps");
    host.classList.remove("is-ready");
    window.setTimeout(function () {
      host.hidden = true;
      restore.hidden = false;
    }, 320);
  }

  function mostrarReviews() {
    restore.hidden = true;
    host.hidden = false;
    if (eggPumps) { host.setAttribute("data-egg-pumps", eggPumps); }
    // Um instante antes da classe, senão a transição não pega e o balão
    // aparece de repente. setTimeout e não requestAnimationFrame: o rAF não
    // corre quando o separador não está a compor, e o balão ficaria preso.
    window.setTimeout(function () {
      host.classList.add("is-ready");
      syncReviewOffset();
      scheduleNext();
    }, 16);
  }

  dismiss.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    try { window.sessionStorage.setItem(dismissKey, "1"); } catch (error) {}
    esconderReviews();
  });

  restore.addEventListener("click", function (event) {
    event.preventDefault();
    try { window.sessionStorage.removeItem(dismissKey); } catch (error) {}
    mostrarReviews();
  });

  host.appendChild(dismiss);

  productImage.addEventListener("error", function () {
    if (productImage.getAttribute("src") !== fallbackImage) productImage.src = fallbackImage;
  });

  function reviewRating(review) {
    var mode = !review.ratingMode || review.ratingMode === "default" ? settings.defaultRatingMode : review.ratingMode;
    if (mode === "none") return { text: "", label: "" };
    if (mode === "stars") {
      var count = Math.max(1, Math.min(5, Number(review.stars) || Number(settings.defaultStars) || 5));
      return { text: "★".repeat(count), label: count + " em 5 estrelas" };
    }
    var icon = !review.icon || review.icon === "default" ? settings.defaultIcon : review.icon;
    var text = icon === "custom" ? (review.customIcon || settings.defaultCustomIcon || "✦") : (iconMap[icon] || "✦");
    return { text: text, label: "Símbolo de avaliação" };
  }

  function showReview(index, direction) {
    if (!reviews.length) return;
    currentIndex = (index + reviews.length) % reviews.length;
    var review = reviews[currentIndex];
    var link = review.linkEnabled ? safeReviewLink(review.link) : "";
    var ratingData = reviewRating(review);
    productImage.src = review.image || fallbackImage;
    reviewName.textContent = review.name || "Cliente Mia & Paper";
    reviewText.textContent = review.text || "";
    rating.textContent = ratingData.text;
    rating.setAttribute("aria-label", ratingData.label);
    imageWrap.hidden = settings.showImage === false;
    reviewName.hidden = settings.showName === false;
    reviewText.hidden = settings.showText === false;
    rating.hidden = !ratingData.text;

    if (link) {
      card.setAttribute("href", link);
      card.classList.add("has-link");
      card.setAttribute("aria-label", "Avaliação de " + reviewName.textContent + "; abrir ligação");
    } else {
      card.removeAttribute("href");
      card.classList.remove("has-link");
      card.setAttribute("aria-label", "Avaliação de " + reviewName.textContent);
    }

    card.classList.remove("is-entering-next", "is-entering-previous");
    void card.offsetWidth;
    card.classList.add(direction === "previous" ? "is-entering-previous" : "is-entering-next");
    scheduleNext();
  }

  card.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") { event.preventDefault(); showReview(currentIndex - 1, "previous"); }
    else if (event.key === "ArrowRight") { event.preventDefault(); showReview(currentIndex + 1, "next"); }
  });
  card.addEventListener("click", function (event) {
    if (!card.hasAttribute("href") || suppressClick) event.preventDefault();
  });
  card.addEventListener("pointerdown", function (event) {
    suppressClick = false;
    pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    dragging = true;
    window.clearTimeout(timer);
    card.classList.add("is-dragging");
    try { card.setPointerCapture(event.pointerId); } catch (error) {}
  });
  card.addEventListener("pointermove", function (event) {
    if (!pointerStart || event.pointerId !== pointerStart.id) return;
    var deltaX = event.clientX - pointerStart.x;
    var deltaY = event.clientY - pointerStart.y;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      event.preventDefault();
      if (Math.abs(deltaX) > 8) suppressClick = true;
      card.style.setProperty("--review-drag-x", Math.max(-72, Math.min(72, deltaX * 0.45)) + "px");
    }
  });

  function finishSwipe(event) {
    if (!pointerStart || event.pointerId !== pointerStart.id) return;
    var deltaX = event.clientX - pointerStart.x;
    var deltaY = event.clientY - pointerStart.y;
    pointerStart = null;
    dragging = false;
    card.classList.remove("is-dragging");
    card.style.removeProperty("--review-drag-x");
    if (Math.abs(deltaX) >= 44 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) showReview(currentIndex + (deltaX < 0 ? 1 : -1), deltaX < 0 ? "next" : "previous");
    else scheduleNext();
    window.setTimeout(function () { suppressClick = false; }, 0);
  }
  card.addEventListener("pointerup", finishSwipe);
  card.addEventListener("pointercancel", function () {
    pointerStart = null; dragging = false; suppressClick = false;
    card.classList.remove("is-dragging");
    card.style.removeProperty("--review-drag-x");
    scheduleNext();
  });

  document.addEventListener("visibilitychange", scheduleNext);
  window.addEventListener("resize", scheduleReviewOffset);
  window.addEventListener("scroll", scheduleReviewOffset, { passive: true });
  new MutationObserver(scheduleReviewOffset).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

  fetch("content/reviews.json", { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("Não foi possível carregar content/reviews.json");
      return response.json();
    })
    .then(function (data) {
      settings = Object.assign({ enabled: true, intervalMs: 5500, position: "left", size: "normal", theme: "paper", imageShape: "rounded", showImage: true, showName: true, showText: true, defaultRatingMode: "stars", defaultStars: 5, defaultIcon: "heart", defaultCustomIcon: "✦", eggPumps: 7 }, data.settings || {});
      if (settings.enabled === false) return;
      // Lido pelo reviews-egg.js: movimentos necessários até o balão saltar.
      eggPumps = String(Math.max(0, Math.min(20, Number(settings.eggPumps) >= 0 ? Number(settings.eggPumps) : 7)));
      intervalMs = Math.max(2000, Math.min(60000, Number(settings.intervalMs) || 5500));
      reviews = (Array.isArray(data.reviews) ? data.reviews : []).filter(function (review) { return review && review.enabled !== false && review.text; }).sort(function (a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0); });
      if (!reviews.length) return;
      host.classList.add("review-position-" + settings.position);
      card.classList.add("review-size-" + settings.size, "review-theme-" + settings.theme, "review-image-" + settings.imageShape);
      if (settings.showImage === false) card.classList.add("without-image");
      showReview(0, "next");

      // Escondidas de propósito: prepara-se tudo na mesma, para a pega as
      // trazer de volta sem ter de recarregar nada.
      if (reviewsDismissed()) {
        window.clearTimeout(timer);
        timer = null;
        host.hidden = true;
        restore.hidden = false;
        return;
      }

      host.setAttribute("data-egg-pumps", eggPumps);
      syncReviewOffset();
      host.classList.add("is-ready");
    })
    .catch(function (error) { console.warn("Reviews da homepage:", error.message); });
})();
