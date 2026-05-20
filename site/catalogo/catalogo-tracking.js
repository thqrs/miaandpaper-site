(function () {
  "use strict";

  var script = document.currentScript;
  var body = document.body;
  if (!script || !body) return;
  if (location.protocol === "file:") return;
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return;

  var endpoint = script.getAttribute("data-endpoint") || "../track-order-event.php";
  var productSlug = script.getAttribute("data-product") || body.getAttribute("data-product-slug") || "catalogo";
  var pageKind = script.getAttribute("data-page") || body.getAttribute("data-catalog-page") || "catalogo";
  var sessionKey = "mp_catalog_session_v1";
  var attributionKey = "mp_catalog_attribution_v1";
  var eventIndex = 0;
  var pageInstanceId = Math.random().toString(36).slice(2, 10);

  function randomId() {
    if (window.crypto && crypto.getRandomValues) {
      var bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      return Array.prototype.map.call(bytes, function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return "";
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {}
  }

  function sessionGet(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      return "";
    }
  }

  function sessionSet(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (error) {}
  }

  function sessionId() {
    var id = storageGet(sessionKey);
    if (!id) {
      id = "catalog_" + randomId();
      storageSet(sessionKey, id);
    }
    return id;
  }

  function queryValue(name) {
    try {
      return new URLSearchParams(location.search).get(name) || "";
    } catch (error) {
      return "";
    }
  }

  function attribution() {
    var existing = sessionGet(attributionKey);
    if (existing) {
      try {
        return JSON.parse(existing);
      } catch (error) {}
    }
    var data = {
      first_landing_page: location.pathname,
      first_url: location.href,
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

  function send(eventName, extra) {
    var attr = attribution();
    var payload = Object.assign({
      session_id: sessionId(),
      product_slug: productSlug,
      product_type: "catalogo",
      event_name: eventName,
      step_id: pageKind,
      landing_page: location.pathname,
      referrer: document.referrer || "",
      language: navigator.language || "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      viewport_width: window.innerWidth || 0,
      viewport_height: window.innerHeight || 0,
      screen_width: screen.width || 0,
      screen_height: screen.height || 0,
      device_pixel_ratio: window.devicePixelRatio || 1,
      timestamp_ms: Date.now(),
      page_instance_id: pageInstanceId,
      client_event_index: ++eventIndex,
      first_landing_page: attr.first_landing_page || "",
      first_url: attr.first_url || "",
      first_referrer: attr.first_referrer || "",
      utm_source: attr.utm_source || "",
      utm_medium: attr.utm_medium || "",
      utm_campaign: attr.utm_campaign || "",
      utm_content: attr.utm_content || "",
      utm_term: attr.utm_term || "",
      fbclid: attr.fbclid || "",
      gclid: attr.gclid || ""
    }, extra || {});

    var json = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      var blob = new Blob([json], { type: "application/json" });
      if (navigator.sendBeacon(endpoint, blob)) return;
    }
    fetch(endpoint, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: json
    }).catch(function () {});
  }

  window.addEventListener("pageshow", function () {
    send("catalog_page_view");
  });

  document.addEventListener("click", function (event) {
    var link = event.target.closest("a[data-catalog-track]");
    if (!link) return;
    var trackType = link.getAttribute("data-catalog-track") || "link";
    send("catalog_" + trackType + "_clicked", {
      target_type: trackType,
      target_label: (link.textContent || "").trim().slice(0, 120),
      target_id: link.getAttribute("href") || ""
    });
  });
})();
