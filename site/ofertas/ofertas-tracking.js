(function () {
  "use strict";

  var script = document.currentScript;
  var body = document.body;
  if (!script || !body) return;

  var endpoint = script.getAttribute("data-endpoint") || "../track-order-event.php";
  var productSlug = script.getAttribute("data-product") || body.getAttribute("data-product-slug") || "ofertas";
  var pageKind = script.getAttribute("data-page") || body.getAttribute("data-catalog-page") || "ofertas";
  var offerName = script.getAttribute("data-offer-name") || document.title || "Ofertas";
  var sessionKey = "mp_funnel_session_v1";
  var attributionKey = "mp_funnel_attribution_v1";
  var siteLandedFlag = "mp_funnel_site_landed_v1";
  var pageInstanceId = "of_" + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 8);
  var eventIndex = 0;
  var maxScrollSent = 0;
  var heartbeatTimer = null;
  var lastUserAt = Date.now();

  if (location.protocol === "file:") return;
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return;

  function randomId() {
    if (window.crypto && crypto.getRandomValues) {
      var bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      return Array.prototype.map.call(bytes, function (byte) {
        return byte.toString(16).padStart(2, "0");
      }).join("");
    }
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function sessionGet(key) {
    try {
      return window.sessionStorage ? window.sessionStorage.getItem(key) || "" : "";
    } catch (error) {
      return "";
    }
  }

  function sessionSet(key, value) {
    try {
      if (window.sessionStorage) window.sessionStorage.setItem(key, value);
    } catch (error) {}
  }

  function loadSession() {
    var raw = sessionGet(sessionKey);
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.id) return parsed;
      } catch (error) {}
    }
    return null;
  }

  function currentSession() {
    var session = loadSession();
    if (!session) {
      session = {
        id: randomId(),
        startedAt: Date.now(),
        lastEventAt: Date.now()
      };
      sessionSet(sessionKey, JSON.stringify(session));
    }
    return session;
  }

  function saveSession(session) {
    sessionSet(sessionKey, JSON.stringify(session));
  }

  function queryValue(name) {
    try {
      return new URLSearchParams(location.search || "").get(name) || "";
    } catch (error) {
      return "";
    }
  }

  function readAttribution() {
    var raw = sessionGet(attributionKey);
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      } catch (error) {}
    }

    var data = {
      first_landing_page: location.pathname || "",
      first_url: String(location.href || "").slice(0, 320),
      first_referrer: document.referrer || "",
      utm_source: queryValue("utm_source"),
      utm_medium: queryValue("utm_medium"),
      utm_campaign: queryValue("utm_campaign"),
      utm_content: queryValue("utm_content"),
      utm_term: queryValue("utm_term"),
      fbclid: queryValue("fbclid"),
      gclid: queryValue("gclid")
    };
    sessionSet(attributionKey, JSON.stringify(data));
    return data;
  }

  function deviceType() {
    try {
      if (window.matchMedia && window.matchMedia("(max-width: 600px)").matches) return "mobile";
    } catch (error) {}
    return /Mobi|Android/i.test(navigator.userAgent || "") ? "mobile" : "desktop";
  }

  function referrerInfo(attr) {
    var refType = "unknown";
    var externalRef = "";
    var source = String((attr && attr.utm_source) || "").toLowerCase();
    var candidate = String((attr && attr.first_referrer) || document.referrer || "");
    var lower = candidate.toLowerCase();

    function classify(value) {
      if (!value) return "";
      if (value.indexOf("instagram") !== -1 || value === "ig") return "instagram";
      if (value.indexOf("facebook") !== -1 || value === "fb" || value.indexOf("meta") !== -1) return "facebook";
      if (value.indexOf("whatsapp") !== -1 || value === "wa" || value.indexOf("wa.me") !== -1) return "whatsapp";
      if (value.indexOf("google") !== -1) return "google";
      if (value.indexOf("tiktok") !== -1) return "tiktok";
      if (value.indexOf("youtube") !== -1 || value.indexOf("youtu.be") !== -1) return "youtube";
      if (value.indexOf("bing") !== -1) return "bing";
      return "";
    }

    if (source) refType = classify(source) || "unknown";
    else if (lower) refType = classify(lower) || "unknown";
    else refType = "direct";

    if (candidate && lower.indexOf("miaandpaper.com") === -1 && lower.indexOf("localhost") === -1 && lower.indexOf("127.0.0.1") === -1) {
      externalRef = candidate.slice(0, 240);
    }

    return {
      referrer_type: refType,
      external_referrer: externalRef
    };
  }

  function contextFields() {
    var attr = readAttribution();
    var ref = referrerInfo(attr);
    var fields = {
      product_slug: productSlug,
      product_type: "oferta",
      step_id: pageKind,
      device_type: deviceType(),
      landing_page: location.pathname || "",
      referrer: document.referrer || "",
      language: navigator.language || "",
      timezone: "",
      viewport_width: window.innerWidth || 0,
      viewport_height: window.innerHeight || 0,
      screen_width: window.screen ? window.screen.width || 0 : 0,
      screen_height: window.screen ? window.screen.height || 0 : 0,
      device_pixel_ratio: window.devicePixelRatio || 1,
      max_touch_points: navigator.maxTouchPoints || 0,
      page_instance_id: pageInstanceId,
      first_landing_page: attr.first_landing_page || "",
      first_url: attr.first_url || "",
      first_referrer: attr.first_referrer || "",
      utm_source: attr.utm_source || "",
      utm_medium: attr.utm_medium || "",
      utm_campaign: attr.utm_campaign || "",
      utm_content: attr.utm_content || "",
      utm_term: attr.utm_term || "",
      fbclid: attr.fbclid || "",
      gclid: attr.gclid || "",
      referrer_type: ref.referrer_type,
      external_referrer: ref.external_referrer
    };

    try {
      fields.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (error) {}
    try {
      fields.orientation = window.matchMedia("(orientation: portrait)").matches ? "portrait-primary" : "landscape-primary";
    } catch (error) {}
    try {
      if (navigator.connection) {
        fields.connection_effective_type = navigator.connection.effectiveType || "";
        fields.save_data = navigator.connection.saveData ? 1 : 0;
      }
    } catch (error) {}
    try {
      fields.is_visible = document.hidden ? 0 : 1;
    } catch (error) {}

    return fields;
  }

  function send(eventName, extra) {
    try {
      var session = currentSession();
      var now = Date.now();
      var payload = contextFields();

      payload.session_id = session.id;
      payload.event_name = eventName;
      payload.timestamp_ms = now;
      payload.client_event_index = ++eventIndex;
      payload.seconds_since_session_start = Math.max(0, Math.round((now - (session.startedAt || now)) / 1000));
      payload.seconds_since_previous_event = session.lastEventAt ? Math.max(0, Math.round((now - session.lastEventAt) / 1000)) : 0;

      Object.keys(extra || {}).forEach(function (key) {
        if (extra[key] !== undefined && extra[key] !== null && extra[key] !== "") {
          payload[key] = extra[key];
        }
      });

      session.lastEventAt = now;
      saveSession(session);

      var json = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        try {
          var blob = new Blob([json], { type: "application/json" });
          if (navigator.sendBeacon(endpoint, blob)) return;
        } catch (error) {}
      }

      if (window.fetch) {
        window.fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: json,
          keepalive: true,
          credentials: "same-origin"
        }).catch(function () {});
      }
    } catch (error) {}
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function basename(path) {
    return String(path || "").split(/[?#]/)[0].split("/").pop() || "";
  }

  function hrefPath(link) {
    try {
      return new URL(link.getAttribute("href") || "", location.href).pathname;
    } catch (error) {
      return link.getAttribute("href") || "";
    }
  }

  function linkLabel(link) {
    var card = link.closest(".catalog-product-card, .congresso-download-card, .offer-panel");
    var heading = card ? card.querySelector("h2, h3, strong") : null;
    return cleanText(link.getAttribute("aria-label") || (heading && heading.textContent) || link.textContent || link.getAttribute("href") || "link").slice(0, 120);
  }

  function isPdfLink(link) {
    return /\.pdf(?:[?#].*)?$/i.test(link.getAttribute("href") || "") || (link.hasAttribute("download") && /\.pdf$/i.test(basename(link.getAttribute("href") || "")));
  }

  function pdfDownloadData(link) {
    var card = link.closest(".congresso-download-card, .offer-panel") || link;
    var meta = card.querySelectorAll ? card.querySelectorAll(".congresso-download-meta span") : [];
    var heading = card.querySelector ? card.querySelector("h2, h3, strong") : null;
    var href = link.getAttribute("href") || "";
    var file = basename(href);
    var label = cleanText((heading && heading.textContent) || link.getAttribute("aria-label") || link.textContent || file);
    var id = cleanText(meta[0] ? meta[0].textContent : "");
    var size = cleanText(meta[1] ? meta[1].textContent : "");
    var kind = card.classList && card.classList.contains("is-featured") ? "all" : "single";

    if (!id) id = kind === "all" ? "todos" : label.toLowerCase().replace(/\s+/g, "-").slice(0, 80);

    return {
      action_name: "download_pdf",
      target_type: "pdf_download",
      target_id: file || id,
      target_label: label,
      option_type: "offer_pdf",
      option_value: id,
      option_label: label,
      offer_slug: productSlug,
      download_id: id,
      download_label: label,
      download_file: file,
      download_kind: kind,
      download_size: size,
      download_url: hrefPath(link),
      download_name: link.getAttribute("download") || file,
      selection_json: {
        offer_slug: productSlug,
        offer_page: pageKind,
        download: {
          id: id,
          label: label,
          file: file,
          kind: kind,
          size: size,
          href: hrefPath(link),
          download_name: link.getAttribute("download") || file
        }
      }
    };
  }

  function classifyLink(link) {
    if (link.classList.contains("catalog-brand")) return "home";
    if (link.classList.contains("catalog-back-link")) return "back";
    if (link.classList.contains("catalog-footer-link")) return "catalog";
    if (link.closest(".catalog-footer")) return "footer";
    if (link.closest(".catalog-product-card")) return link.getAttribute("href") && link.getAttribute("href").indexOf("convite-congresso") !== -1 ? "open_offer" : "open_product";
    return "link";
  }

  function trackPageView() {
    if (sessionGet(siteLandedFlag) !== "1") {
      sessionSet(siteLandedFlag, "1");
      send("site_landed", {
        action_name: "offer_site_landed",
        target_type: "offer_page",
        target_id: pageKind,
        target_label: offerName
      });
    }

    send("offer_page_view", {
      action_name: "view_offer_page",
      target_type: "offer_page",
      target_id: pageKind,
      target_label: offerName
    });
  }

  function trackScrollDepth() {
    var doc = document.documentElement;
    var bodyEl = document.body;
    var total = Math.max(
      bodyEl.scrollHeight,
      doc.scrollHeight,
      bodyEl.offsetHeight,
      doc.offsetHeight
    ) - window.innerHeight;
    var depth = total > 0 ? Math.round((window.scrollY / total) * 100) : 100;
    var threshold = depth >= 100 ? 100 : depth >= 75 ? 75 : depth >= 50 ? 50 : depth >= 25 ? 25 : 0;

    if (threshold > maxScrollSent) {
      maxScrollSent = threshold;
      send("offer_scroll_depth", {
        action_name: "scroll_depth",
        target_type: "page",
        target_id: pageKind,
        target_label: offerName,
        scroll_depth_percent: threshold
      });
    }
  }

  function bindDownloadSectionView() {
    var section = document.querySelector("#downloads, .offer-pdf-frame");
    if (!section || !("IntersectionObserver" in window)) return;

    var seen = false;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (seen || !entry.isIntersecting) return;
        seen = true;
        observer.disconnect();
        send("offer_downloads_seen", {
          action_name: "view_downloads",
          target_type: "section",
          target_id: "downloads",
          target_label: "Downloads"
        });
      });
    }, { threshold: 0.3 });

    observer.observe(section);
  }

  document.addEventListener("pointerdown", function () {
    lastUserAt = Date.now();
  }, { passive: true });

  document.addEventListener("keydown", function () {
    lastUserAt = Date.now();
  });

  window.addEventListener("pageshow", trackPageView);
  window.addEventListener("scroll", function () {
    window.clearTimeout(trackScrollDepth._timer);
    trackScrollDepth._timer = window.setTimeout(trackScrollDepth, 180);
  }, { passive: true });

  document.addEventListener("click", function (event) {
    var link = event.target.closest("a[href]");
    var button;

    lastUserAt = Date.now();

    if (link) {
      if (isPdfLink(link)) {
        send("offer_pdf_download_clicked", pdfDownloadData(link));
        return;
      }

      var type = classifyLink(link);
      send("ui_interaction", {
        action_name: type,
        target_type: type,
        target_id: hrefPath(link),
        target_label: linkLabel(link)
      });
      return;
    }

    button = event.target.closest("button");
    if (!button) return;

    if (button.matches("[data-lightbox-src], [data-carousel-lightbox], .congresso-image-zoom-button")) {
      send("offer_image_zoom_clicked", {
        action_name: "zoom_image",
        target_type: "image",
        target_id: button.getAttribute("data-lightbox-src") || "carousel",
        target_label: button.getAttribute("data-lightbox-alt") || button.getAttribute("aria-label") || "Ampliar imagem",
        image_src: button.getAttribute("data-lightbox-src") || "",
        image_slot: button.hasAttribute("data-carousel-lightbox") ? "carousel" : "completed"
      });
    } else if (button.hasAttribute("data-congresso-carousel-step")) {
      send("ui_interaction", {
        action_name: Number(button.getAttribute("data-congresso-carousel-step")) > 0 ? "carousel_next" : "carousel_previous",
        target_type: "carousel",
        target_id: "todos-os-envelopes",
        target_label: "Todos os Envelopes"
      });
    }
  });

  bindDownloadSectionView();

  heartbeatTimer = window.setInterval(function () {
    if (document.hidden) return;
    if (Date.now() - lastUserAt > 10 * 60 * 1000) return;
    send("heartbeat", {
      action_name: "offer_heartbeat",
      target_type: "offer_page",
      target_id: pageKind,
      target_label: offerName
    });
  }, 45000);

  window.addEventListener("pagehide", function () {
    if (heartbeatTimer) window.clearInterval(heartbeatTimer);
  });
}());
