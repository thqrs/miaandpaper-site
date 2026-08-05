// js/04-funil-tracking.js — parte 04/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: tracking proprio do funil (FUNNEL_*, trackOrderEvent, atribuicao, heartbeat, snapshots de selecao, cliques no wizard) e verificacao de encomendas abertas (scheduleOpenOrderCheck/runOpenOrderCheck).
  // FUNNEL_TRACKING_V1
  // Helpers leves para tracking próprio do funil de encomenda. Sem
  // dependências externas, sem analytics de terceiros. Os eventos vão por
  // navigator.sendBeacon (com fallback fetch keepalive) para
  // track-order-event.php. Cada erro é silencioso — nunca bloqueia a UI
  // nem a encomenda.
  var FUNNEL_ENDPOINT = "track-order-event.php";
  var FUNNEL_SESSION_KEY = "mp_funnel_session_v1";
  var FUNNEL_CONTACT_STARTED_FLAG = "mp_funnel_contact_started_v1";
  // ORIGINAL_ATTRIBUTION_V1 (Phase 3)
  var FUNNEL_ATTRIBUTION_KEY = "mp_funnel_attribution_v1";
  var FUNNEL_SITE_LANDED_FLAG = "mp_funnel_site_landed_v1";
  // SELECTION_SNAPSHOT_V1 (Phase 4)
  var FUNNEL_SELECTION_DEBOUNCE_MS = 800;
  var funnelSelectionDebounceTimer = null;
  var funnelLastSelectionSignature = "";
  var funnelSelectionByStepFired = {};
  // HEARTBEAT_V1 (Phase 6)
  var FUNNEL_HEARTBEAT_INTERVAL_MS = 45000;
  var FUNNEL_HEARTBEAT_IDLE_LIMIT_MS = 10 * 60 * 1000;
  var funnelHeartbeatTimer = null;
  var funnelHeartbeatLastUserAt = Date.now();
  // TRANSITION_REASON_V1 (Phase 7)
  var funnelNextTransitionReason = null;
  // MAGNIFIER_TRACKING_V1 (Phase 5) — pequeno cache para correlacionar com selecções
  var funnelLastMagnified = null;
  // REPLAY_FIELDS_V1 (Phase B): page_instance_id + client_event_index
  // page_instance_id: fresh per page load (NOT in sessionStorage — different tabs differ)
  // client_event_index: incrementing counter for this page instance
  var FUNNEL_PAGE_INSTANCE_ID = (function () {
    var t = Date.now().toString(36).slice(-4);
    var r = Math.random().toString(36).slice(2, 8);
    return "pg_" + t + r;
  })();
  var funnelClientEventIndex = 0;
  // SEMANTIC_EVENTS_V1 (Phase C): dedupe — não disparar design_selected duas
  // vezes seguidas para o mesmo design.
  var funnelLastDesignSig = "";
  var funnelLastOptionSig = {};

  function funnelGenerateId() {
    var t = Date.now().toString(36);
    var r = Math.random().toString(36).slice(2, 10);
    return t + "-" + r;
  }

  function funnelLoadSession() {
    try {
      var raw = window.sessionStorage.getItem(FUNNEL_SESSION_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.id) return parsed;
      }
    } catch (err) { /* ignore */ }
    return null;
  }

  function funnelSession() {
    var session = funnelLoadSession();
    if (!session) {
      session = {
        id: funnelGenerateId(),
        startedAt: Date.now(),
        lastEventAt: Date.now()
      };
      try { window.sessionStorage.setItem(FUNNEL_SESSION_KEY, JSON.stringify(session)); } catch (err) {}
    }
    return session;
  }

  function funnelSaveSession(session) {
    try {
      window.sessionStorage.setItem(FUNNEL_SESSION_KEY, JSON.stringify(session));
    } catch (err) { /* ignore */ }
  }

  function funnelDeviceType() {
    try {
      if (window.matchMedia && window.matchMedia('(max-width: 600px)').matches) return 'mobile';
    } catch (err) {}
    if (/Mobi|Android/i.test(navigator.userAgent || '')) return 'mobile';
    return 'desktop';
  }

  // FUNNEL_TRACKING_SQLITE_V2: payload alargado com viewport/screen/DPR/
  // orientation/network/timing. NÃO inclui nome, email, telefone ou
  // qualquer texto introduzido em campos pessoais — esses dados ficam só
  // em `orders` (necessários para processar a encomenda).
  function funnelExtraContext() {
    var ctx = {};
    try {
      ctx.viewport_width = window.innerWidth || 0;
      ctx.viewport_height = window.innerHeight || 0;
    } catch (e) {}
    try {
      if (window.screen) {
        ctx.screen_width = window.screen.width || 0;
        ctx.screen_height = window.screen.height || 0;
      }
    } catch (e) {}
    try { ctx.device_pixel_ratio = window.devicePixelRatio || 1; } catch (e) {}
    try {
      var orient = '';
      if (window.screen && window.screen.orientation && window.screen.orientation.type) {
        orient = String(window.screen.orientation.type);
      } else if (window.matchMedia) {
        orient = window.matchMedia('(orientation: portrait)').matches ? 'portrait-primary' : 'landscape-primary';
      }
      ctx.orientation = orient;
    } catch (e) {}
    try { ctx.max_touch_points = (navigator && navigator.maxTouchPoints) || 0; } catch (e) {}
    try { ctx.language = (navigator && navigator.language) || ''; } catch (e) {}
    try {
      ctx.timezone = (Intl && Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions().timeZone) || '';
    } catch (e) {}
    try {
      if (navigator && navigator.connection) {
        ctx.connection_effective_type = navigator.connection.effectiveType || '';
        ctx.save_data = navigator.connection.saveData ? 1 : 0;
      }
    } catch (e) {}
    return ctx;
  }

  // ORIGINAL_ATTRIBUTION_V1 (Phase 3) — guarda na 1ª visita; reutiliza depois.
  function funnelReadAttribution() {
    try {
      var raw = window.sessionStorage.getItem(FUNNEL_ATTRIBUTION_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {}
    return null;
  }

  function funnelGetAttribution() {
    var stored = funnelReadAttribution();
    if (stored) return stored;

    var attribution = {};
    try {
      attribution.first_landing_page = (location && location.pathname) || '';
      attribution.first_url = (location && location.href) ? String(location.href).slice(0, 320) : '';
      attribution.first_referrer = document.referrer || '';
    } catch (e) {}
    try {
      var qs = (location && location.search) ? location.search : '';
      if (qs && qs.length > 1) {
        var params = new URLSearchParams(qs);
        var paramKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
        for (var i = 0; i < paramKeys.length; i++) {
          var v = params.get(paramKeys[i]);
          if (v && typeof v === 'string') attribution[paramKeys[i]] = v.slice(0, 120);
        }
      }
    } catch (e) {}
    try { window.sessionStorage.setItem(FUNNEL_ATTRIBUTION_KEY, JSON.stringify(attribution)); } catch (e) {}
    return attribution;
  }

  function funnelAttributionFields() {
    var attribution = funnelGetAttribution();
    var fields = {};
    if (!attribution) return fields;
    ['first_landing_page', 'first_url', 'first_referrer',
     'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
     'fbclid', 'gclid'].forEach(function (k) {
      if (attribution[k]) fields[k] = String(attribution[k]).slice(0, 320);
    });
    return fields;
  }

  // REPLAY_FIELDS_V1 (Phase B): classifica referrer no cliente. Devolve
  // {referrer_type, external_referrer}. Tudo opcional — servidor reclassifica
  // se vier vazio.
  function funnelClassifyReferrerClient(attribution) {
    var refType = 'unknown';
    var externalRef = '';
    try {
      var utm = (attribution && attribution.utm_source) ? String(attribution.utm_source).toLowerCase() : '';
      var firstRef = (attribution && attribution.first_referrer) ? String(attribution.first_referrer) : '';
      var curRef = document.referrer || '';
      var candidate = firstRef || curRef || '';
      var candidateLower = candidate.toLowerCase();

      function classifyToken(t) {
        if (!t) return '';
        if (t.indexOf('instagram') !== -1 || t === 'ig') return 'instagram';
        if (t.indexOf('facebook') !== -1 || t === 'fb' || t.indexOf('meta') !== -1) return 'facebook';
        if (t.indexOf('whatsapp') !== -1 || t === 'wa') return 'whatsapp';
        if (t.indexOf('google') !== -1) return 'google';
        if (t.indexOf('tiktok') !== -1) return 'tiktok';
        if (t.indexOf('youtube') !== -1) return 'youtube';
        if (t.indexOf('email') !== -1 || t.indexOf('newsletter') !== -1) return 'email';
        return '';
      }
      function classifyUrl(url) {
        if (!url) return '';
        if (url.indexOf('miaandpaper.com') !== -1) return 'internal';
        if (url.indexOf('localhost') !== -1 || url.indexOf('127.0.0.1') !== -1) return 'internal';
        if (url.indexOf('/admin-funnel.php') !== -1 || url.indexOf('/admin-live-dashboard.php') !== -1 || url.indexOf('/admin-orders.php') !== -1) return 'internal_admin';
        if (url.indexOf('instagram') !== -1) return 'instagram';
        if (url.indexOf('facebook') !== -1 || url.indexOf('fb.com') !== -1) return 'facebook';
        if (url.indexOf('whatsapp') !== -1 || url.indexOf('wa.me') !== -1) return 'whatsapp';
        if (url.indexOf('google.') !== -1) return 'google';
        if (url.indexOf('tiktok') !== -1) return 'tiktok';
        if (url.indexOf('youtube') !== -1 || url.indexOf('youtu.be') !== -1) return 'youtube';
        if (url.indexOf('bing.com') !== -1) return 'bing';
        return '';
      }

      if (utm) refType = classifyToken(utm) || 'unknown';
      else if (candidateLower) refType = classifyUrl(candidateLower) || 'unknown';
      else refType = 'direct';

      // external_referrer: só se NÃO for interno
      if (candidate && refType !== 'internal' && refType !== 'internal_admin') {
        externalRef = candidate.slice(0, 240);
      }
    } catch (e) {}
    return { referrer_type: refType, external_referrer: externalRef };
  }

  function trackOrderEvent(eventName, data) {
    try {
      if (!eventName) return;
      var session = funnelSession();
      var now = Date.now();
      funnelClientEventIndex++;
      var base = {
        session_id: session.id,
        event_name: String(eventName),
        device_type: funnelDeviceType(),
        landing_page: (location && location.pathname) || '',
        referrer: document.referrer || '',
        seconds_since_session_start: Math.max(0, Math.round((now - (session.startedAt || now)) / 1000)),
        seconds_since_previous_event: session.lastEventAt ? Math.max(0, Math.round((now - session.lastEventAt) / 1000)) : 0,
        // REPLAY_FIELDS_V1
        page_instance_id: FUNNEL_PAGE_INSTANCE_ID,
        client_event_index: funnelClientEventIndex,
        timestamp_ms: now
      };
      // Junta dados de dispositivo/viewport — sem PII.
      var extra = funnelExtraContext();
      Object.keys(extra).forEach(function (k) { base[k] = extra[k]; });
      // ORIGINAL_ATTRIBUTION_V1: re-envia atribuição original em todos os eventos.
      var attribution = funnelAttributionFields();
      Object.keys(attribution).forEach(function (k) { base[k] = attribution[k]; });
      // REPLAY_FIELDS_V1: referrer_type + external_referrer
      var refInfo = funnelClassifyReferrerClient(attribution);
      if (refInfo.referrer_type) base.referrer_type = refInfo.referrer_type;
      if (refInfo.external_referrer) base.external_referrer = refInfo.external_referrer;
      // HEARTBEAT_V1: estado de visibilidade da página, ajuda a distinguir activo vs idle.
      try { base.is_visible = document.hidden ? 0 : 1; } catch (e) {}
      session.lastEventAt = now;
      funnelSaveSession(session);

      var payload = base;
      if (data && typeof data === 'object') {
        Object.keys(data).forEach(function (key) {
          if (data[key] === undefined || data[key] === null || data[key] === '') return;
          payload[key] = data[key];
        });
      }

      var body = JSON.stringify(payload);

      // sendBeacon é preferido — sobrevive a unload; fetch keepalive como
      // fallback (Safari < 13 não tem sendBeacon).
      if (navigator && typeof navigator.sendBeacon === 'function') {
        try {
          var blob = new Blob([body], { type: 'application/json' });
          if (navigator.sendBeacon(FUNNEL_ENDPOINT, blob)) {
            return;
          }
        } catch (err) { /* fallthrough */ }
      }

      if (window.fetch) {
        window.fetch(FUNNEL_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true,
          credentials: 'same-origin'
        }).catch(function () { /* silent */ });
      }
    } catch (err) {
      /* falha silenciosa: tracking não pode quebrar encomenda */
    }
  }

  // Helper que injecta o contexto do produto e selecções actuais.
  function trackProductEvent(product, eventName, extra) {
    if (!product) return;
    var data = {
      product_slug: product.slug || '',
      product_type: product.slug || '',
      product_context: String(product.catalogContext || "main"),
      flow_mode: isMainCatalogProduct(product) ? (isCustomArtworkSelected(product) ? "custom" : "catalog") : String(product.orderFlow || ""),
      selected_pack: state.selections.pack_quantity || undefined,
      selected_size: state.selections.size || '',
      selected_delivery: state.selections.delivery_option || ''
    };
    if (extra && typeof extra === 'object') {
      Object.keys(extra).forEach(function (key) { data[key] = extra[key]; });
    }
    trackOrderEvent(eventName, data);
  }

  // SELECTION_SNAPSHOT_V1 (Phase 4)
  // Constrói um snapshot leve das selecções actuais para enviar como
  // selection_json. NÃO inclui texto de personalização nem nada PII.
  // Funciona para todos os produtos, mas adapta-se aos cadernos.
  function funnelBuildSelectionSnapshot(product) {
    if (!product) return null;
    var sel = state.selections || {};
    var snap = {};
    try {
      // Designs seleccionados — pode ser array (multi) OU string (single).
      // SELECTION_SNAPSHOT_V2 (Phase C / inspection finding): cadernos usa
      // single-select para capa, então sel.designs é uma string. Antes não
      // estava a ser capturada — por isso "Interesse" não mostrava capas.
      if (Array.isArray(sel.designs)) {
        snap.selected_designs = sel.designs.slice(0, 40).map(function (v) { return String(v).slice(0, 80); });
        snap.selection_count = sel.designs.length;
      } else if (typeof sel.designs === 'string' && sel.designs !== '') {
        snap.selected_designs = [String(sel.designs).slice(0, 80)];
        snap.selection_count = 1;
        snap.selected_cover = String(sel.designs).slice(0, 80);
      }
      if (sel.assorted_designs === "1") snap.assorted = 1;
      if (sel.pack_quantity) snap.selected_pack = Number(sel.pack_quantity) || 0;
      if (sel.size) snap.selected_size = String(sel.size).slice(0, 60);
      if (sel.delivery_option) snap.selected_delivery = String(sel.delivery_option).slice(0, 60);
      selectedOptionDrawerRecords(product).forEach(function (record) {
        var key = "extra_" + String(record.drawer.field || record.drawer.id || "option").replace(/[^a-z0-9_]/gi, "_");
        snap[key] = String(record.item.value || record.item.id || "").slice(0, 80);
      });
      if (isMainCatalogProduct(product)) {
        snap.flow_mode = isCustomArtworkSelected(product) ? "custom" : "catalog";
        snap.product_context = String(product.catalogContext || "main-v2");
      }

      // Cores e variantes sem conteúdo pessoal. Mantém a posição dos tons —
      // num degradê, 0 é a cor inicial e 1 a final.
      (product.steps || []).filter(function (step) {
        return step && step.template === "palette-grid";
      }).forEach(function (step) {
        var keys = quadrosColorSelectionKeys(step);
        var families = Array.isArray(sel[keys.colors]) ? sel[keys.colors].slice(0, 6) : [];
        var tones = Array.isArray(sel[keys.tones]) ? sel[keys.tones].slice(0, 6) : [];
        var prefix = String(step.id || "colors").replace(/[^a-z0-9_]/gi, "_");
        if (families.length) {
          snap[prefix + "_colors"] = families.map(function (value) { return String(value).slice(0, 60); });
          snap[prefix + "_tones"] = tones.map(function (value) { return Math.max(0, Math.min(2, Number(value) || 0)); });
        } else if (sel[keys.mia]) {
          snap[prefix + "_mia"] = 1;
        }
      });
      ["heart_finish", "silhouette", "quadro_super_example"].forEach(function (key) {
        if (sel[key]) snap[key] = String(sel[key]).slice(0, 80);
      });
      ["no_phrase", "no_dedication", "no_text", "silhouette_contact_me"].forEach(function (key) {
        if (sel[key]) snap[key] = 1;
      });

      // Molduras: regista apenas presença/contagem nos passos de texto e
      // anexos. Nunca envia dedicatórias, descrições, nomes de ficheiro,
      // tokens de upload ou qualquer outro conteúdo introduzido pela pessoa.
      if (product.slug === "quadros") {
        [
          ["quadro_uploads", "photo_count"],
          ["quadro_reference_uploads", "reference_photo_count"],
          ["quadro_audio_uploads", "reference_audio_count"],
          ["quadro_silhouette_uploads", "silhouette_photo_count"],
          ["quadro_silhouette_audio_uploads", "silhouette_audio_count"]
        ].forEach(function (record) {
          var uploads = Array.isArray(sel[record[0]]) ? sel[record[0]] : [];
          if (uploads.length) snap[record[1]] = uploads.length;
        });
        if (String(sel.quadro_text || "").trim()) snap.quadro_has_text = 1;
        if (String(sel.quadro_dedication || "").trim()) snap.dedication_has_text = 1;
        if (String(sel.quadro_silhouette_description || "").trim()) snap.silhouette_has_description = 1;
        if (String(sel.quadro_description || "").trim()) snap.super_has_description = 1;
      }

      // Novo fluxo de crachás/ímanes: só presença e contagens, nunca texto,
      // áudio, nomes de ficheiro ou outros dados enviados pela pessoa.
      if (isCustomArtworkSelected(product)) {
        var custom = customArtworkConfig(product);
        var artworkItems = Array.isArray(sel[custom.uploadKey]) ? sel[custom.uploadKey] : [];
        var cardPhotos = Array.isArray(sel[custom.cardPhotoKey]) ? sel[custom.cardPhotoKey] : [];
        var cardAudio = Array.isArray(sel[custom.cardAudioKey]) ? sel[custom.cardAudioKey] : [];
        if (artworkItems.length) {
          snap.artwork_attached = 1;
          snap.artwork_count = artworkItems.length;
          snap.artwork_total_quantity = customArtworkTotalQuantity(product);
          snap.customization_fee_cents = customArtworkFeeCents(product);
        }
        if (sel[custom.helpKey]) snap.artwork_help = 1;
        if (String(sel[custom.cardField] || "").trim()) snap.card_has_text = 1;
        if (cardPhotos.length) snap.card_photo_count = cardPhotos.length;
        if (cardAudio.length) snap.card_audio_count = cardAudio.length;
      }

      // Cadernos: extras específicos.
      try {
        if (typeof isCadernosProduct === 'function' && isCadernosProduct(product)) {
          if (typeof selectedCadernoLamination === 'function') {
            var lam = selectedCadernoLamination(product);
            if (lam && lam.id) snap.lamination = String(lam.id).slice(0, 60);
          }
          if (typeof selectedCadernoPurchaseOption === 'function') {
            var opt = selectedCadernoPurchaseOption(product);
            if (opt && opt.id) snap.caderno_option = String(opt.id).slice(0, 60);
          }
          if (sel.caderno_order_quantity) snap.caderno_qty = Number(sel.caderno_order_quantity) || 0;
          if (Array.isArray(sel.add_ons) && sel.add_ons.length) {
            snap.add_ons = sel.add_ons.slice(0, 12).map(function (value) { return String(value).slice(0, 60); });
            snap.add_on_count = sel.add_ons.length;
          }
          // Personalização (yes/no) sem texto.
          if (sel.cover_personalization) snap.cover_personalization = sel.cover_personalization === 'yes' ? 1 : 0;
          // Cover title (se houver dados de produto) — label estático, não PII.
          try {
            if (typeof sel.designs === 'string' && sel.designs !== '' && product.steps) {
              for (var si = 0; si < product.steps.length; si++) {
                var st = product.steps[si];
                if (st && st.id === 'designs' && Array.isArray(st.items)) {
                  for (var ii = 0; ii < st.items.length; ii++) {
                    var item = st.items[ii];
                    if (item && (item.value === sel.designs || item.id === sel.designs)) {
                      if (item.title) snap.selected_cover_title = String(item.title).slice(0, 80);
                      break;
                    }
                  }
                  break;
                }
              }
            }
          } catch (e2) {}
        }
      } catch (e) {}
    } catch (e) {}
    if (Object.keys(snap).length === 0) return null;
    return snap;
  }

  // SEMANTIC_EVENTS_V1 (Phase C): helper para encontrar o título estático de
  // um item por value/id dentro de uma step do produto. Sem PII (lê do JSON).
  function funnelFindItemInStep(product, stepId, value) {
    try {
      if (!product || !Array.isArray(product.steps)) return null;
      for (var i = 0; i < product.steps.length; i++) {
        var st = product.steps[i];
        if (!st || st.id !== stepId || !Array.isArray(st.items)) continue;
        for (var j = 0; j < st.items.length; j++) {
          var it = st.items[j];
          if (it && (it.value === value || it.id === value)) return it;
        }
      }
    } catch (e) {}
    return null;
  }

  // Dispara design_selected (ou unselected). Cap de PII — só estático.
  function trackDesignToggle(product, designValue, isSelected) {
    if (!product || !designValue) return;
    try {
      var stepInfo = currentStepInfoForTracking();
      var item = funnelFindItemInStep(product, 'designs', designValue);
      var snapshot = funnelBuildSelectionSnapshot(product);
      var imgSrc = '';
      if (item && item.image && typeof item.image === 'string') {
        // Limita a paths locais relativos — nunca aceitar absoluto/URL.
        if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(item.image) && item.image.indexOf('..') === -1) {
          imgSrc = item.image.slice(0, 240);
        }
      }
      var data = {
        product_slug: stepInfo.product_slug,
        product_type: stepInfo.product_slug,
        step_id: stepInfo.step_id || 'designs',
        step_index: stepInfo.step_index,
        design_id: String(designValue).slice(0, 80),
        item_id: String(designValue).slice(0, 80)
      };
      if (item && item.title) data.design_title = String(item.title).slice(0, 120);
      if (imgSrc) data.image_src = imgSrc;
      if (snapshot) data.selection_json = snapshot;
      trackOrderEvent(isSelected ? 'design_selected' : 'design_unselected', data);
    } catch (e) {}
  }

  // Dispara option_selected (lamination, pack, size, delivery, personalization, purchase_option).
  function trackOptionSelected(product, optionType, optionValue, optionLabel) {
    if (!product || !optionType || optionValue === '' || optionValue == null) return;
    try {
      var sig = optionType + '=' + String(optionValue);
      if (funnelLastOptionSig[optionType] === sig) return; // dedupe
      funnelLastOptionSig[optionType] = sig;
      var stepInfo = currentStepInfoForTracking();
      var snapshot = funnelBuildSelectionSnapshot(product);
      var data = {
        product_slug: stepInfo.product_slug,
        product_type: stepInfo.product_slug,
        step_id: stepInfo.step_id,
        step_index: stepInfo.step_index,
        option_type: String(optionType).slice(0, 32),
        option_value: String(optionValue).slice(0, 120)
      };
      if (optionLabel) data.option_label = String(optionLabel).slice(0, 120);
      if (snapshot) data.selection_json = snapshot;
      trackOrderEvent('option_selected', data);
    } catch (e) {}
  }

  function funnelSelectionSignature(snapshot) {
    try { return snapshot ? JSON.stringify(snapshot) : ''; } catch (e) { return ''; }
  }

  // Dispara selection_updated com debounce, só se mudou desde a última.
  function maybeTrackSelectionUpdated(product, stepId) {
    if (!product) return;
    try {
      if (funnelSelectionDebounceTimer) {
        clearTimeout(funnelSelectionDebounceTimer);
        funnelSelectionDebounceTimer = null;
      }
      funnelSelectionDebounceTimer = setTimeout(function () {
        try {
          var snap = funnelBuildSelectionSnapshot(product);
          var sig = funnelSelectionSignature(snap);
          if (!snap || sig === funnelLastSelectionSignature) return;
          funnelLastSelectionSignature = sig;
          trackProductEvent(product, 'selection_updated', {
            step_id: stepId || '',
            selection_count: snap.selection_count || (snap.selected_designs ? snap.selected_designs.length : 0),
            selection_json: snap
          });
        } catch (e) {}
      }, FUNNEL_SELECTION_DEBOUNCE_MS);
    } catch (e) {}
  }

  // Snapshot completo ao sair de um passo (mesmo que igual ao anterior).
  function trackStepSelectionSnapshot(product, stepId) {
    if (!product) return;
    try {
      var snap = funnelBuildSelectionSnapshot(product);
      if (!snap) return;
      var key = (product.slug || '') + '|' + (stepId || '');
      if (funnelSelectionByStepFired[key] === funnelSelectionSignature(snap)) return;
      funnelSelectionByStepFired[key] = funnelSelectionSignature(snap);
      trackProductEvent(product, 'step_selection_snapshot', {
        step_id: stepId || '',
        selection_count: snap.selection_count || (snap.selected_designs ? snap.selected_designs.length : 0),
        selection_json: snap
      });
    } catch (e) {}
  }

  // HEARTBEAT_V1 (Phase 6)
  function funnelHeartbeatTouchUser() {
    funnelHeartbeatLastUserAt = Date.now();
  }

  function startFunnelHeartbeat(product) {
    try {
      if (funnelHeartbeatTimer) return;
      if (!product) return;
      funnelHeartbeatTimer = setInterval(function () {
        try {
          if (document.hidden) return; // só com tab visível
          if (Date.now() - funnelHeartbeatLastUserAt > FUNNEL_HEARTBEAT_IDLE_LIMIT_MS) return;
          var stepInfo = currentStepInfoForTracking();
          trackProductEvent(product, 'heartbeat', {
            step_id: stepInfo.step_id,
            step_index: stepInfo.step_index
          });
        } catch (e) {}
      }, FUNNEL_HEARTBEAT_INTERVAL_MS);
      ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(function (evt) {
        try { document.addEventListener(evt, funnelHeartbeatTouchUser, { passive: true, capture: true }); } catch (e) {
          try { document.addEventListener(evt, funnelHeartbeatTouchUser, true); } catch (e2) {}
        }
      });
    } catch (e) {}
  }

  // MAGNIFIER_TRACKING_V1 (Phase 5)
  // Identifica o "slot" da imagem a partir de pistas leves no URL/atributos
  // sem alterar o comportamento do magnifier existente.
  function funnelClassifyImageSlot(src, alt) {
    var s = String(src || '').toLowerCase();
    var a = String(alt || '').toLowerCase();
    if (/laminac|lamination/.test(s) || /lamin/.test(a)) return 'lamination_example';
    if (/interior/.test(s) || /interior/.test(a)) return 'interior';
    if (/capa|cover/.test(s) || /capa|cover/.test(a)) return 'cover';
    if (/iman|magnet/.test(s)) return 'marker';
    if (/pack/.test(s) || /pack/.test(a)) return 'pack';
    if (/process/.test(s)) return 'process';
    return 'main';
  }

  function funnelExtractDesignIdFromSrc(src) {
    // Heurística simples: nome do ficheiro sem extensão.
    try {
      var clean = String(src || '').split('?')[0];
      var parts = clean.split('/');
      var name = parts[parts.length - 1] || '';
      return name.replace(/\.[a-zA-Z0-9]+$/, '').slice(0, 80);
    } catch (e) { return ''; }
  }

  function trackMagnifierOpened(src, alt) {
    try {
      var product = state.product || null;
      var stepInfo = currentStepInfoForTracking();
      var designId = funnelExtractDesignIdFromSrc(src);
      var slot = funnelClassifyImageSlot(src, alt);
      var srcShort = String(src || '').slice(0, 240);
      funnelLastMagnified = { src: srcShort, design_id: designId, image_slot: slot, at: Date.now() };
      var snapshot = product ? funnelBuildSelectionSnapshot(product) : null;
      var data = {
        product_slug: stepInfo.product_slug,
        step_id: stepInfo.step_id,
        step_index: stepInfo.step_index,
        image_slot: slot,
        image_src: srcShort,
        design_id: designId,
        item_id: designId,
        target_label: String(alt || '').slice(0, 120)
      };
      if (snapshot) data.selection_json = snapshot;
      trackOrderEvent('image_magnified', data);
    } catch (e) {}
  }
  // Exposto para que openImageViewer possa chamar.
  window.__mpTrackMagnifierOpened = trackMagnifierOpened;

  // SITE_LANDED_V1 (Phase 3)
  // Dispara uma vez por sessão; também aplicado em index.html (page === 'home').
  function fireSiteLandedOnce() {
    try {
      if (window.sessionStorage.getItem(FUNNEL_SITE_LANDED_FLAG) === '1') return;
      window.sessionStorage.setItem(FUNNEL_SITE_LANDED_FLAG, '1');
    } catch (e) { /* ignore */ }
    try {
      // Garante que a atribuição é capturada antes do primeiro evento.
      funnelGetAttribution();
      trackOrderEvent('site_landed', {
        landing_page: (location && location.pathname) || '',
        page_load_type: 'first_session_event'
      });
    } catch (e) {}
  }
  // Pre-warm: lê / regista atribuição assim que possível (não envia evento).
  try { funnelGetAttribution(); } catch (e) {}

  // Marca contact_started apenas uma vez por sessão (chave em sessionStorage).
  function maybeFireContactStarted(product) {
    try {
      if (window.sessionStorage.getItem(FUNNEL_CONTACT_STARTED_FLAG) === '1') return;
      window.sessionStorage.setItem(FUNNEL_CONTACT_STARTED_FLAG, '1');
    } catch (err) { /* ignore */ }
    trackProductEvent(product, 'contact_started');
  }

  // Exposto globalmente para futuros pontos de instrumentação (admin etc.).
  window.trackOrderEvent = trackOrderEvent;

  // CLICK_TRACKING_V1: ui_interaction + dead_tap. Listener delegado no
  // document. Identifica o "target lógico" (button, label, link ou elemento
  // com data-track) e emite ui_interaction. Se o clique cair dentro do
  // wizard mas FORA de qualquer elemento interactivo, emite dead_tap com
  // rate-limit (máx 1/seg, ignora repetições próximas <40px).
  var INTERACTIVE_TAGS = { 'BUTTON': true, 'A': true, 'LABEL': true, 'INPUT': true, 'SELECT': true, 'TEXTAREA': true, 'SUMMARY': true };
  var lastDeadTapTime = 0;
  var lastDeadTapX = -1;
  var lastDeadTapY = -1;

  function findTrackTarget(el) {
    var node = el;
    while (node && node !== document.body) {
      if (node.dataset && node.dataset.track === 'true') return node;
      if (node.tagName && INTERACTIVE_TAGS[node.tagName]) return node;
      node = node.parentNode;
    }
    return null;
  }

  function readShortLabel(el) {
    if (!el) return '';
    if (el.dataset && el.dataset.trackLabel) return String(el.dataset.trackLabel).slice(0, 80);
    var t = (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title'))) || '';
    if (!t) {
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      t = text.slice(0, 60);
    }
    return t.slice(0, 80);
  }

  function guessTargetType(el) {
    if (!el || !el.tagName) return 'unknown';
    if (el.dataset && el.dataset.trackType) return el.dataset.trackType;
    var tag = el.tagName;
    if (tag === 'BUTTON') return 'button';
    if (tag === 'A') return 'link';
    if (tag === 'LABEL') return 'card';
    if (tag === 'INPUT') {
      var t = (el.type || '').toLowerCase();
      if (t === 'radio') return 'radio';
      if (t === 'checkbox') return 'checkbox';
      return 'input';
    }
    if (tag === 'SELECT') return 'select';
    return 'unknown';
  }

  function getWizardRoot() {
    return document.querySelector('.wizard-shell, #order-form, .product-shell');
  }

  function isInWizard(el) {
    var root = getWizardRoot();
    if (!root) return false;
    return root.contains(el);
  }

  function isInsideTextInput(el) {
    var node = el;
    while (node && node !== document.body) {
      if (node.tagName === 'INPUT') {
        var t = (node.type || '').toLowerCase();
        if (t !== 'radio' && t !== 'checkbox' && t !== 'submit' && t !== 'button') return true;
      }
      if (node.tagName === 'TEXTAREA') return true;
      node = node.parentNode;
    }
    return false;
  }

  function pointInPercent(event, root) {
    try {
      var rect = root.getBoundingClientRect();
      if (!rect.width || !rect.height) return { x: null, y: null };
      var x = Math.max(0, Math.min(100, Math.round(((event.clientX - rect.left) / rect.width) * 100)));
      var y = Math.max(0, Math.min(100, Math.round(((event.clientY - rect.top) / rect.height) * 100)));
      return { x: x, y: y };
    } catch (e) { return { x: null, y: null }; }
  }

  function currentStepInfoForTracking() {
    var prod = state.product || null;
    var step = prod ? currentStep(prod) : null;
    return {
      product_slug: prod && prod.slug || '',
      step_id: step && step.id || '',
      step_index: state.currentStep || 0
    };
  }

  function handleWizardClickTracking(event) {
    try {
      if (!state.product) return; // só nas páginas de produto
      var target = event.target;
      if (!target || !isInWizard(target)) return;

      var logical = findTrackTarget(target);
      var root = getWizardRoot();
      var pt = root ? pointInPercent(event, root) : { x: null, y: null };
      var info = currentStepInfoForTracking();

      if (logical) {
        // ui_interaction
        trackOrderEvent('ui_interaction', {
          product_slug: info.product_slug,
          step_id: info.step_id,
          step_index: info.step_index,
          interaction_type: 'click',
          target_type: guessTargetType(logical),
          target_id: (logical.dataset && (logical.dataset.trackId || logical.id)) || '',
          target_label: readShortLabel(logical),
          action_name: (logical.dataset && logical.dataset.trackAction) || '',
          x_percent: pt.x,
          y_percent: pt.y
        });
        return;
      }

      // dead_tap candidate. Skip se for dentro de input/textarea.
      if (isInsideTextInput(target)) return;

      var now = Date.now();
      if (now - lastDeadTapTime < 1000) return; // rate limit 1/seg
      if (pt.x !== null && lastDeadTapX !== -1) {
        var dx = Math.abs(pt.x - lastDeadTapX);
        var dy = Math.abs(pt.y - lastDeadTapY);
        if (dx < 5 && dy < 5) return; // skip near-duplicate
      }
      lastDeadTapTime = now;
      lastDeadTapX = pt.x;
      lastDeadTapY = pt.y;

      trackOrderEvent('dead_tap', {
        product_slug: info.product_slug,
        step_id: info.step_id,
        step_index: info.step_index,
        x_percent: pt.x,
        y_percent: pt.y,
        target_tag: (target.tagName || '').toLowerCase(),
        target_class: (target.className && typeof target.className === 'string' ? target.className.slice(0, 100) : '')
      });
    } catch (err) {
      /* silent — tracking não pode bloquear UX */
    }
  }

  document.addEventListener('click', handleWizardClickTracking, true);

  // OPEN_ORDER_HINT_V1
  // Verifica se existe encomenda aberta com o mesmo nome+contacto+IP via
  // POST a check-open-orders.php. Debounced 600ms. Só dispara quando os
  // dois campos têm comprimento mínimo. Cache curta na sessão por chave
  // (nome|contacto) para evitar requests duplicados.
  var OPEN_ORDER_ENDPOINT = "check-open-orders.php";
  var openOrderCheckTimer = null;

  function scheduleOpenOrderCheck(product) {
    if (openOrderCheckTimer) {
      clearTimeout(openOrderCheckTimer);
    }
    openOrderCheckTimer = setTimeout(function () {
      openOrderCheckTimer = null;
      runOpenOrderCheck(product);
    }, 600);
  }

  function runOpenOrderCheck(product) {
    var name = String(state.selections.customer_name || "").trim();
    var contact = String(state.selections.customer_contact || "").trim();
    if (name.length < 3 || contact.length < 4) {
      if (state.openOrderHint) {
        state.openOrderHint = false;
        rerenderProduct(product);
      }
      return;
    }

    var key = name + "|" + contact;
    if (key === state.openOrderHintLastQuery) {
      return; // já perguntámos
    }
    state.openOrderHintLastQuery = key;

    try {
      window.fetch(OPEN_ORDER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name: name, customer_contact: contact }),
        credentials: "same-origin"
      }).then(function (response) {
        return response.json();
      }).then(function (data) {
        var hint = data && data.has_possible_open_order === true;
        if (hint !== state.openOrderHint) {
          state.openOrderHint = hint;
          rerenderProduct(product);
        }
      }).catch(function () {
        /* silencioso — UX não pode quebrar por isto */
      });
    } catch (err) {
      /* silencioso */
    }
  }

