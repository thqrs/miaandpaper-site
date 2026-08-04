// GALERIA_SLOTS_V1
// Descoberta dos sítios com imagem no JSON de um produto. Partilhado pela
// galeria (galeria.html) e pela lista de multimédia (multimedia.html) para as
// duas verem exactamente as mesmas imagens e os mesmos nomes.
(function () {
  "use strict";

  // Exige também um nome antes da extensão. Valores de configuração de
  // uploads como ".jpg" e ".pdf" não são caminhos de imagens da página.
  var IMAGE_RE = /(?:^|\/)[^\/.][^\/]*\.(?:jpe?g|png|webp|gif|avif)$/i;

  // Caminho relativo dentro do site. Aceita espaços (há imagens activas dos
  // cadernos com espaços no nome), mas não URLs, caminhos absolutos, query
  // strings nem segmentos que possam sair da raiz do site.
  function isImagePath(value) {
    var path = String(value == null ? "" : value);
    var parts;

    if (!path || !IMAGE_RE.test(path) || /^[a-z][a-z0-9+.-]*:/i.test(path)
        || path.charAt(0) === "/" || path.indexOf("\\") !== -1
        || /["'?#|\u0000-\u001f\u007f]/.test(path)) {
      return false;
    }

    parts = path.split("/");
    return parts.every(function (part) { return part !== "" && part !== "." && part !== ".."; });
  }

  function isEmptyImageField(trail) {
    var last = trail[trail.length - 1];
    var beforeLast = trail[trail.length - 2];

    return /images?$/i.test(String(last)) || /images?$/i.test(String(beforeLast));
  }

  // "" = imagem principal do item, "side" = foto de comparação, null = sem
  // ajustes próprios (gavetas, slides, placeholders).
  var ADJUSTABLE = { image: "", sideImage: "side" };

  var PROP_LABELS = {
    image: "imagem principal",
    drawerImages: "gaveta",
    sideImage: "foto de comparação",
    exampleImage: "exemplo",
    exampleImages: "exemplo",
    laminationImages: "laminação",
    purchaseOptionImages: "opção de compra",
    summaryPlaceholders: "caixa do resumo",
    featureImage: "imagem de destaque",
    carouselSourceImages: "carrossel da homepage"
  };

  function labelFor(node) {
    return (node && (node.title || node.value || node.label || node.id)) || "";
  }

  // A mesma família pode existir em mais de um contexto (por exemplo,
  // imanes no site principal e no Congresso 2026). A chave da entrada mantém
  // esses JSON separados; o slug continua a ser o slug real do produto, usado
  // pelo renderer e pelas imageEdits.
  function entryKey(entry) {
    return String(entry && (entry.key || entry.slug) || "");
  }

  // --- identificadores legíveis ---------------------------------------------
  // Cada localização única de imagem ganha um código estável e fácil de ler,
  // do tipo MOLDURA-P4-HORIZONTAL-CHOICE, para se poder dizer "usa esta foto
  // nesta localização". A mesma imagem pode servir várias localizações; cada
  // código é único e tem as suas próprias propriedades (zoom, rotação, x, y…).
  var PRODUCT_CODES = {
    quadros: "MOLDURA", cadernos: "CADERNO", caderninhos: "MINICADERNO",
    crachas: "CRACHA", imanes: "IMAN", lembrancas: "LEMBRANCA", pins: "PINS",
    "cadernos-anuais": "CADERNO-ANUAL", "mini-cadernos": "MINICADERNO-LOJA",
    agendas: "AGENDA",
    "crachas-loja": "CRACHA-LOJA", "imanes-loja": "IMAN-LOJA",
    stickers: "STICKER", marcadores: "MARCADOR", bloquinhos: "BLOQUINHO",
    postais: "POSTAL", home: "HOMEPAGE"
  };

  // Coordenadas compactas para conversa e pesquisa. O prefixo identifica o
  // contexto/família e os quatro algarismos identificam o local dentro dela.
  // A identificação longa continua a ser a chave canónica e descritiva.
  var SHORT_ENTRY_CODES = {
    home: "HP",
    caderninhos: "MN",
    cadernos: "CA",
    crachas: "CR",
    imanes: "IM",
    "mini-cadernos": "ML",
    "cadernos-anuais": "AL",
    agendas: "AG",
    "crachas-loja": "RL",
    "imanes-loja": "IL",
    quadros: "MO",
    lembrancas: "LE",
    postais: "PO",
    pins: "PI",
    stickers: "ST",
    marcadores: "MK",
    bloquinhos: "BQ",
    "congresso-2026|caderninhos": "QN",
    "congresso-2026|cadernos": "QA",
    "congresso-2026|crachas": "QR",
    "congresso-2026|imanes": "QI"
  };

  // Campos da caixa "O que vais encomendar" (imagens de substituição próprias).
  var ENCOMENDA_LABELS = {
    frame_size: "TAMANHO", phrase: "FRASE", baby_details: "DADOS_BEBE",
    baby_custom_animal: "ANIMAL", super_description: "IDEIA",
    photo_help: "AJUDA_FOTO", audio: "AUDIO"
  };

  function seg(text) {
    var value = String(text == null ? "" : text);
    if (value.normalize) {
      value = value.normalize("NFD").replace(/[̀-ͯ]/g, "");   // tira acentos
    }
    return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function pad3(n) { return ("00" + n).slice(-3); }

  function pad4(n) { return ("000" + n).slice(-4); }

  function productCode(slug) {
    return PRODUCT_CODES[slug] || seg(slug);
  }

  // `slug` identifica a fonte concreta; `family` identifica apenas o renderer
  // e as regras visuais partilhadas. Os catálogos novos têm slugs próprios para
  // nunca colidirem com a cápsula do Congresso, mas um caderno anual continua
  // a precisar dos contextos visuais especiais dos cadernos.
  function productFamily(entry) {
    return String(entry && entry.product && entry.product.family || entry && entry.slug || "");
  }

  function shortEntryCode(entry) {
    var key = entryKey(entry);
    var normalized = seg(key || (entry && entry.slug));
    var hash = 0;
    var i;
    if (SHORT_ENTRY_CODES[key]) { return SHORT_ENTRY_CODES[key]; }
    if (entry && key === String(entry.slug || "") && SHORT_ENTRY_CODES[entry.slug]) {
      return SHORT_ENTRY_CODES[entry.slug];
    }
    for (i = 0; i < normalized.length; i += 1) {
      hash = ((hash * 31) + normalized.charCodeAt(i)) % 676;
    }
    return String.fromCharCode(65 + Math.floor(hash / 26)) + String.fromCharCode(65 + (hash % 26));
  }

  function assignShortIdentifiers(entry, slots) {
    var prefix = shortEntryCode(entry);
    slots.slice().sort(function (a, b) {
      var aKey = String(a.id || "") + "|" + String(a.sourceKey || a.key || "");
      var bKey = String(b.id || "") + "|" + String(b.sourceKey || b.key || "");
      return aKey < bKey ? -1 : (aKey > bKey ? 1 : 0);
    }).forEach(function (slot, index) {
      slot.shortId = prefix + "-" + pad4(index + 1);
    });
  }

  function roleFor(slot) {
    var t = slot.trail;
    var last = t[t.length - 1];
    var i;

    if (slot.interiorPreview) { return "INTERIOR-" + pad3(slot.interiorPreview.index + 1); }
    if (slot.gaveta) { return "GAVETA-" + pad3(slot.gaveta.index + 1); }
    if (slot.summaryKey) { return "ENCOMENDA-" + (ENCOMENDA_LABELS[slot.summaryKey] || seg(slot.summaryKey)); }

    // Procura, do fim para o início, a colecção de imagens que contém este slot.
    for (i = t.length - 1; i >= 1; i--) {
      if (t[i] === "laminationImages") { return "LAMINACAO-" + seg(t[i + 1]); }
      if (t[i] === "purchaseOptionImages") { return "COMPRA-" + seg(t[i + 1]); }
      if (t[i] === "drawerImages") { return "GAVETA-" + pad3(Number(t[i + 1]) + 1); }
      if (t[i] === "exampleImages") { return "EXEMPLO-" + pad3(Number(t[i + 1]) + 1); }
      if (t[i] === "exampleByField") { return "EXEMPLO-" + seg(t[i + 1]) + "-" + seg(t[i + 2]); }
    }

    if (last === "sideImage") { return "COMPARACAO"; }
    if (last === "exampleImage") { return "EXEMPLO"; }
    if (last === "image") { return "CHOICE"; }
    return seg(slot.prop);
  }

  function baseIdentifier(entry, slot) {
    var code = productCode(entry.slug);
    var role = roleFor(slot);

    if (slot.summaryKey) {
      return code + "-" + role + (slot.idSuffix ? "-" + seg(slot.idSuffix) : "");
    }

    var item = slot.itemTrail ? resolveTrail(entry.product, slot.itemTrail) : null;
    var itemSeg = seg(slot.itemLabel) || (item && item.id ? seg(item.id) : "ITEM");
    // Nos passos de formulário o "item" é o próprio passo (etiqueta = título
    // longo do passo); usamos antes o id do passo, mais curto.
    if (slot.itemTrail && slot.itemTrail.length === 2 && item && item.id) {
      itemSeg = seg(item.id);
    }

    return code + "-P" + (slot.stepIndex + 1) + "-" + itemSeg + "-" + role
      + (slot.idSuffix ? "-" + seg(slot.idSuffix) : "");
  }

  // Garante unicidade: se dois itens diferentes tiverem a mesma etiqueta e
  // gerarem o mesmo código, acrescenta o id estável do item para desempatar.
  function assignIdentifiers(entry, slots) {
    var counts = {};
    slots.forEach(function (slot) {
      slot.id = baseIdentifier(entry, slot);
      counts[slot.id] = (counts[slot.id] || 0) + 1;
    });
    slots.forEach(function (slot) {
      if (counts[slot.id] > 1 && slot.itemTrail) {
        var item = resolveTrail(entry.product, slot.itemTrail);
        if (item && item.id) { slot.id += "-" + seg(item.id); }
      }
    });

    // Rede de segurança: se ainda houver repetidos, numera-os pela ordem do
    // JSON (estável). Não deve chegar aqui com os papéis actuais.
    var used = {};
    slots.forEach(function (slot) {
      if (used[slot.id]) {
        var n = used[slot.id] + 1;
        used[slot.id] = n;
        slot.id += "-" + pad3(n);
      } else {
        used[slot.id] = 1;
      }
    });

    // A chave de concluído antiga é mantida quando já é única, para não
    // perder o trabalho marcado. Se colidir (ex.: exemplos aninhados das
    // molduras), acrescenta o caminho relativo dentro do item e guarda a chave
    // antiga como alias para permitir migração transparente.
    var doneSources = {};
    slots.forEach(function (slot) {
      if (!doneSources[slot.doneKey]) { doneSources[slot.doneKey] = {}; }
      doneSources[slot.doneKey][slot.sourceKey || slot.key] = true;
    });
    slots.forEach(function (slot) {
      if (Object.keys(doneSources[slot.doneKey]).length < 2) { return; }
      var legacy = slot.doneKey;
      var offset = slot.itemTrail ? slot.itemTrail.length : 0;
      var suffix = slot.trail.slice(offset).map(function (part) {
        return String(part).replace(/\|/g, "%7C");
      }).join(".");
      slot.doneAliases = [legacy];
      slot.doneKey = legacy + "|" + (suffix || slot.id);
    });
  }

  function previewSelections(entry, trail, context) {
    var selections = {};
    var step = entry.product.steps && entry.product.steps[context.stepIndex];
    var item = context.itemTrail ? resolveTrail(entry.product, context.itemTrail) : null;
    var dynamicIndex = trail.indexOf("exampleByField");

    // Vistas condicionais (gavetas das molduras, sideImage, etc.) precisam de
    // ter o item dono seleccionado para o site desenhar a imagem certa.
    if (step && step.id && item && item !== step && item.value != null) {
      if (trail.indexOf("exampleImages") !== -1 && step.selectableExamples === true) {
        selections[String(step.exampleSelectionKey || "details_example")] = item.value;
      } else {
        selections[step.id] = step.selection === "multi" ? [item.value] : item.value;
      }
    }

    // exampleByField.<campo>.<valor>.image: força exactamente essa variante.
    if (dynamicIndex !== -1 && trail.length > dynamicIndex + 2) {
      selections[String(trail[dynamicIndex + 1])] = trail[dynamicIndex + 2];
    }

    return selections;
  }

  function makeSlot(entry, trail, context) {
    var last = trail[trail.length - 1];
    var beforeLast = trail[trail.length - 2];
    var propName = typeof last === "number" ? String(beforeLast) : String(last);
    var friendly = PROP_LABELS[propName] || propName;
    var itemId = context.itemTrail ? String(resolveTrail(entry.product, context.itemTrail).id || "") : "";
    var detail;

    if (typeof last === "number") {
      detail = friendly + " " + (last + 1);
    } else if (typeof beforeLast === "string" && PROP_LABELS[beforeLast]) {
      detail = PROP_LABELS[beforeLast] + " " + last;
    } else {
      detail = friendly;
    }

    var sourceKey = entryKey(entry) + ":" + trail.join(".");
    var directItemProperty = typeof last !== "number" && context.itemTrail
      && trail.length === context.itemTrail.length + 1;
    var item = context.itemTrail ? resolveTrail(entry.product, context.itemTrail) : null;
    var step = entry.product.steps && entry.product.steps[context.stepIndex];
    // As imagens principais de registos aninhados em exampleImages/
    // exampleByField são <img> simples no renderer de exemplos: não têm
    // imageEdits nem data-mia-edit-key. Se fossem tratadas como propriedades
    // ajustáveis directas, a preview exigia uma chave que nunca existe e não
    // conseguia localizar a imagem. As drawerImages desses mesmos registos são
    // contextualizadas separadamente mais abaixo.
    var nestedSimpleImage = trail.indexOf("exampleImages") !== -1
      || trail.indexOf("exampleByField") !== -1;
    var adjustable = directItemProperty && !nestedSimpleImage && ADJUSTABLE[propName] !== undefined;
    var slotName = adjustable ? (ADJUSTABLE[propName] || "main") : "";

    var slot = {
      key: sourceKey,
      sourceKey: sourceKey,
      // Chave estável para guardar estado: não usa índices de array do passo,
      // por isso sobrevive a reordenações dos itens.
      doneKey: itemId
        ? entryKey(entry) + "|" + itemId + "|" + propName + (typeof last === "number" ? "|" + last : "")
        : entryKey(entry) + "|" + trail.join("."),
      slug: entryKey(entry),
      productSlug: entry.slug,
      trail: trail,
      itemTrail: context.itemTrail || null,
      section: context.section,
      stepIndex: context.stepIndex,
      summaryKey: context.summaryKey || "",
      itemLabel: context.itemLabel,
      template: context.template,
      prop: propName,
      detail: detail,
      previewSelections: previewSelections(entry, trail, context),
      previewStepIndex: context.stepIndex,
      renderItemTrail: adjustable ? context.itemTrail : null,
      editItemTrail: adjustable ? context.itemTrail : null,
      fitItemTrail: adjustable ? context.itemTrail : null,
      itemId: adjustable && item && item.id ? String(item.id) : "",
      ownerItemId: item && item.id ? String(item.id) : "",
      slotName: slotName,
      expectedEditKey: adjustable && item && item.id && step && step.id
        ? [entry.slug, step.id, item.id, slotName].join(":")
        : "",
      allowedFields: propName === "sideImage"
        ? ["imageZoom", "imagePositionX", "imagePositionY", "imageRotation"]
        : null,
      allowFit: propName !== "sideImage",
      // Só uma propriedade directa do item é um visual ajustável. Uma folha
      // aninhada chamada "image" (exampleImages, exampleByField…) é normalmente
      // um <img> simples e não tem imageEdits no site.
      adjustPrefix: adjustable ? ADJUSTABLE[propName] : null
    };

    if (trail.indexOf("drawerImages") !== -1) {
      slot.renderItemTrail = context.itemTrail || null;
      slot.itemId = item && item.id ? String(item.id) : "";
      slot.slotName = "drawer";
      slot.slideIndex = Number(trail[trail.indexOf("drawerImages") + 1]) + 1;
    }

    return slot;
  }

  function stepIndexById(product, id) {
    var found = -1;
    (product.steps || []).some(function (step, index) {
      if (step && step.id === id) { found = index; return true; }
      return false;
    });
    return found;
  }

  function cloneSelections(values) {
    var copy = {};
    Object.keys(values || {}).forEach(function (key) {
      copy[key] = Array.isArray(values[key]) ? values[key].slice() : values[key];
    });
    return copy;
  }

  // Um caminho de imagem pode aparecer em mais de um contexto visual. Nos
  // cadernos, por exemplo, a mesma fonte é desenhada no cartão de escolha e no
  // resumo, com editKeys e stores diferentes. Estes descritores representam os
  // locais reais sem duplicar o campo de origem no JSON.
  function expandCadernoVisualContexts(entry, slots) {
    var product = entry.product;
    var designsIndex = stepIndexById(product, "designs");
    var laminationIndex = stepIndexById(product, "lamination");
    var packIndex = stepIndexById(product, "pack");
    var laminationStep = product.steps && product.steps[laminationIndex];
    var packStep = product.steps && product.steps[packIndex];
    var expanded = [];

    if (productFamily(entry) !== "cadernos" || designsIndex < 0) { return slots; }

    function summaryVariant(slot, expectedEditKey) {
      var summary = Object.assign({}, slot);
      summary.key = slot.sourceKey + "::summary";
      summary.idSuffix = "RESUMO";
      summary.detail = slot.detail + " · resumo";
      summary.expectedEditKey = expectedEditKey;
      summary.previewSelections = cloneSelections(slot.previewSelections);
      return summary;
    }

    function laminationItemFor(key) {
      var normalized = key === "hologrofico" ? "holografico" : key;
      var found = null;
      (laminationStep && laminationStep.items || []).some(function (item, index) {
        var itemKey = String(item && (item.laminationKey || item.value) || "");
        if (itemKey === "normal") { itemKey = "glossy"; }
        if (itemKey === "glitter_branco") { itemKey = "glitter"; }
        if (itemKey === "holografica") { itemKey = "holografico"; }
        if (itemKey === normalized) { found = { item: item, index: index }; return true; }
        return false;
      });
      return found;
    }

    slots.forEach(function (slot) {
      var trail = slot.trail;
      var cover;
      var target;
      var targetTrail;
      var selections;
      var mainKey;
      var summaryKey;
      var collectionAt = trail.indexOf("laminationImages");
      var purchaseAt = trail.indexOf("purchaseOptionImages");
      var isCoverImage = trail.length === 5 && trail[0] === "steps"
        && trail[1] === designsIndex && trail[2] === "items" && trail[4] === "image";

      if (isCoverImage) {
        cover = resolveTrail(product, slot.itemTrail);
        if (!cover || !cover.id) { expanded.push(slot); return; }
        slot.previewSelections = { designs: cover.value };
        slot.previewStepIndex = designsIndex;
        slot.expectedEditKey = [entry.slug, "designs", cover.id, "main"].join(":");
        expanded.push(slot);
        expanded.push(summaryVariant(
          slot,
          [entry.slug, "designs", cover.id, cover.id, "summary"].join(":")
        ));
        return;
      }

      if (collectionAt !== -1 && laminationIndex >= 0) {
        cover = resolveTrail(product, slot.itemTrail);
        target = laminationItemFor(String(trail[collectionAt + 1]));
        if (!cover || !cover.id || !target || !target.item || !target.item.id) {
          expanded.push(slot);
          return;
        }
        targetTrail = ["steps", laminationIndex, "items", target.index];
        if (String(trail[collectionAt + 1]) === "holografico") {
          slot.doneAliases = (slot.doneAliases || []).concat([
            entryKey(entry) + "|" + cover.id + "|hologrofico"
          ]);
        }
        selections = { designs: cover.value, lamination: target.item.value };
        mainKey = [entry.slug, "lamination", cover.id, target.item.id, "main"].join(":");
        summaryKey = [entry.slug, "lamination", cover.id, target.item.id, "summary"].join(":");
        Object.assign(slot, {
          previewStepIndex: laminationIndex,
          previewSelections: selections,
          renderItemTrail: targetTrail,
          editItemTrail: targetTrail,
          fitItemTrail: targetTrail,
          itemId: String(target.item.id),
          slotName: "main",
          expectedEditKey: mainKey,
          adjustPrefix: "",
          allowFit: true
        });
        expanded.push(slot);
        expanded.push(summaryVariant(slot, summaryKey));
        return;
      }

      if (purchaseAt !== -1 && packIndex >= 0) {
        cover = resolveTrail(product, slot.itemTrail);
        target = null;
        (packStep && packStep.items || []).some(function (item, index) {
          if (String(item && item.value) === String(trail[purchaseAt + 1])) {
            target = { item: item, index: index };
            return true;
          }
          return false;
        });
        if (!cover || !cover.id || !target || !target.item || !target.item.id) {
          expanded.push(slot);
          return;
        }
        targetTrail = ["steps", packIndex, "items", target.index];
        selections = { designs: cover.value, pack_quantity: Number(target.item.quantity) };
        mainKey = [entry.slug, "pack", cover.id, target.item.id, "main"].join(":");
        summaryKey = [entry.slug, "pack", cover.id, target.item.id, "summary"].join(":");
        Object.assign(slot, {
          previewStepIndex: packIndex,
          previewSelections: selections,
          renderItemTrail: targetTrail,
          editItemTrail: targetTrail,
          fitItemTrail: targetTrail,
          itemId: String(target.item.id),
          slotName: "main",
          expectedEditKey: mainKey,
          adjustPrefix: "",
          allowFit: true
        });
        expanded.push(slot);
        expanded.push(summaryVariant(slot, summaryKey));
        return;
      }

      expanded.push(slot);
    });

    return expanded;
  }

  function resolveTrail(root, trail) {
    var node = root;
    for (var i = 0; i < trail.length && node != null; i++) { node = node[trail[i]]; }
    return node == null ? {} : node;
  }

  function collectHome(entry) {
    var home = entry.product || {};
    var slots = [];
    var usedIds = {};

    function makeHomeSlot(trail, image) {
      var categoryIndex = trail[0] === "categories" && typeof trail[1] === "number" ? trail[1] : -1;
      var category = categoryIndex >= 0 && Array.isArray(home.categories) ? home.categories[categoryIndex] || {} : null;
      var prop = String(trail[trail.length - 1]);
      var collection = trail.length > 1 ? String(trail[trail.length - 2]) : "";
      var carouselIndex = collection === "carouselSourceImages" && typeof trail[trail.length - 1] === "number"
        ? Number(trail[trail.length - 1])
        : -1;
      var role = "IMAGEM";
      var slotName = "";
      var slideIndex = null;
      var section = "Homepage";
      var label = "";

      if (trail[0] === "hero" && trail[1] === "image") {
        role = "HERO";
        slotName = "home-hero";
        section = "Topo da homepage";
        label = "Imagem principal";
      } else if (trail[0] === "hero" && trail[1] === "carouselSourceImages" && typeof trail[2] === "number") {
        carouselIndex = Number(trail[2]);
        role = "HERO-CARROSSEL-" + pad3(carouselIndex + 1);
        slotName = "home-hero-carousel";
        slideIndex = carouselIndex;
        section = "Topo da homepage";
        label = "Imagem do hero " + (carouselIndex + 1);
      } else if (category) {
        section = "Produto — " + labelFor(category);
        label = labelFor(category);
        if (trail[2] === "featureImage") {
          role = "DESTAQUE";
          slotName = "home-feature";
        } else if (trail[2] === "image") {
          if (category.featured === true && !category.featureImage) {
            role = "DESTAQUE";
            slotName = "home-feature";
          } else {
            role = "CARTAO";
            slotName = "home-card";
          }
        } else if (trail[2] === "carouselSourceImages" && typeof trail[3] === "number") {
          carouselIndex = Number(trail[3]);
          role = "CARROSSEL-" + pad3(carouselIndex + 1);
          slotName = "home-carousel";
          slideIndex = carouselIndex;
        } else {
          role = seg(trail.slice(2).join("-")) || "IMAGEM";
        }
      } else {
        role = seg(trail.join("-")) || "IMAGEM";
        label = prop;
      }

      var baseId = "HOMEPAGE-" + (category ? seg(category.title || category.id) + "-" : "") + role;
      var duplicate = usedIds[baseId] || 0;
      usedIds[baseId] = duplicate + 1;

      return {
        key: entryKey(entry) + ":" + trail.join("."),
        sourceKey: entryKey(entry) + ":" + trail.join("."),
        doneKey: entryKey(entry) + "|" + trail.join("."),
        slug: entryKey(entry),
        productSlug: entry.slug,
        kind: "home",
        trail: trail,
        itemTrail: category ? ["categories", categoryIndex] : null,
        section: section,
        stepIndex: 0,
        summaryKey: "",
        itemLabel: label,
        template: "home",
        prop: carouselIndex >= 0 ? "carouselSourceImages" : prop,
        detail: carouselIndex >= 0 ? "carrossel " + (carouselIndex + 1) : (PROP_LABELS[prop] || label || prop),
        previewSelections: {},
        previewStepIndex: 0,
        renderItemTrail: null,
        editItemTrail: null,
        fitItemTrail: null,
        itemId: category ? String(category.id || "") : (trail[0] === "hero" ? "hero" : ""),
        slotName: slotName,
        expectedEditKey: "",
        allowedFields: [],
        allowFit: false,
        adjustPrefix: null,
        slideIndex: slideIndex,
        id: duplicate ? baseId + "-" + pad3(duplicate + 1) : baseId,
        image: image
      };
    }

    function walk(node, trail) {
      if (typeof node === "string") {
        var prop = String(trail[trail.length - 1] || "");
        if (isImagePath(node) || (node === "" && (prop === "image" || prop === "featureImage"))) {
          slots.push(makeHomeSlot(trail, node));
        }
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(function (child, index) { walk(child, trail.concat([index])); });
        return;
      }
      if (!node || typeof node !== "object") { return; }
      Object.keys(node).forEach(function (key) {
        var categoryHasCarousel;
        var heroHasCarousel;
        if (trail[0] === "hero" && trail.length === 1 && key === "image") {
          heroHasCarousel = node.carouselEnabled !== false
            && Array.isArray(node.carouselSourceImages)
            && node.carouselSourceImages.some(Boolean);
          // A imagem simples é o fallback do hero; com carrossel, cada slide
          // tem o seu próprio slot e não criamos uma linha duplicada.
          if (heroHasCarousel) { return; }
        }
        if (trail[0] === "categories" && trail.length === 2 && key === "image") {
          categoryHasCarousel = (!home.carousel || home.carousel.enabled !== false)
            && node.carouselEnabled !== false
            && Array.isArray(node.carouselSourceImages)
            && node.carouselSourceImages.some(Boolean);
          // A imagem simples só aparece no cartão quando não há carrossel.
          // Nas categorias em destaque continua a ser usada no bloco Novidades.
          if (categoryHasCarousel && node.featured !== true && !node.featureImage) {
            return;
          }
        }
        walk(node[key], trail.concat([key]));
      });
    }

    walk(home, []);
    assignShortIdentifiers(entry, slots);
    return slots;
  }

  function collect(entry) {
    var product = entry.product;
    var slots = [];

    if (entry.kind === "home" || entry.slug === "home") {
      return collectHome(entry);
    }

    function walk(node, trail, context) {
      if (node == null) { return; }

      if (typeof node === "string") {
        if (isImagePath(node) || (node === "" && isEmptyImageField(trail))) {
          slots.push(makeSlot(entry, trail, context));
        }
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(function (child, index) { walk(child, trail.concat([index]), context); });
        return;
      }
      if (typeof node !== "object") { return; }

      var next = Object.assign({}, context);
      if (node.id != null && (node.value != null || node.title != null || node.image != null)) {
        next.itemTrail = trail.slice();
        next.itemLabel = labelFor(node);
      }
      Object.keys(node).forEach(function (key) {
        if (key === "individualColors") { return; }   // as cores ficam de fora
        // As imagens do interior (gavetas) são tratadas à parte, mais abaixo,
        // para as compor a partir da pasta + lista partilhada de nomes.
        if (key === "interiorImages") { return; }
        walk(node[key], trail.concat([key]), next);
      });
    }

    // Nomes dos ficheiros do interior partilhados por todas as capas (a mesma
    // gaveta é aberta em cada capa, mas cada uma vem da sua própria pasta).
    var drawerNames = (product.interiorPreview && Array.isArray(product.interiorPreview.drawerImageNames))
      ? product.interiorPreview.drawerImageNames.filter(Boolean)
      : [];

    function collectGaveta(step, stepIndex, item, itemIndex) {
      var folder = String(item.interiorFolder || "").replace(/\/+$/, "");
      if (!folder || !drawerNames.length) { return; }

      var coverLabel = labelFor(item);
      var itemTrail = ["steps", stepIndex, "items", itemIndex];
      // Caminhos que o site compõe por defeito (pasta + nome). O item pode ter
      // um interiorImages próprio a substituir — nesse caso a galeria lê de lá.
      var siblings = drawerNames.map(function (name) {
        return folder + "/" + String(name).replace(/^\/+/, "");
      });

      drawerNames.forEach(function (name, index) {
        var trail = itemTrail.concat(["interiorImages", index]);
        slots.push({
          key: entryKey(entry) + ":" + trail.join("."),
          sourceKey: entryKey(entry) + ":" + trail.join("."),
          doneKey: entryKey(entry) + "|" + (item.id || "?") + "|gaveta|" + name,
          slug: entryKey(entry),
          productSlug: entry.slug,
          trail: trail,
          itemTrail: itemTrail,
          section: "Gaveta — " + coverLabel,
          stepIndex: stepIndex,
          summaryKey: "",
          itemLabel: coverLabel,
          template: step && step.template,
          prop: "interiorImages",
          detail: "gaveta " + (index + 1) + " · " + name,
          adjustPrefix: null,
          previewStepIndex: stepIndex,
          previewSelections: (function () {
            var selected = {};
            selected[step.id] = item.value;
            return selected;
          }()),
          renderItemTrail: itemTrail,
          editItemTrail: null,
          fitItemTrail: null,
          itemId: String(item.id || ""),
          ownerItemId: String(item.id || ""),
          slotName: "drawer",
          expectedEditKey: "",
          slideIndex: index + 1,
          allowFit: false,
          gaveta: { folder: folder, name: name, index: index, siblings: siblings }
        });
      });
    }

    (product.steps || []).forEach(function (step, index) {
      var context = {
        section: "Passo " + (index + 1) + " — " + (step.title || step.label || step.id || ""),
        stepIndex: index,
        itemTrail: null,
        itemLabel: "",
        template: step && step.template,
        summaryKey: ""
      };
      walk(step, ["steps", index], context);

      (step.items || []).forEach(function (item, itemIndex) {
        // Itens sem imagem nenhuma também aparecem, para se lhes poder atribuir uma.
        // Apenas templates que realmente desenham item.image: quantity-builder
        // e cover-personalization, por exemplo, têm items mas não usam imagens.
        var emptyImageTemplates = {
          "design-grid": true, "media-list": true, "text-grid": true,
          "lamination-choice": true, "purchase-option": true, "add-ons": true
        };
        var imageTrail = ["steps", index, "items", itemIndex, "image"];
        var alreadyCollected = slots.some(function (slot) {
          return slot.trail.join(".") === imageTrail.join(".");
        });

        if (item && item.swatch) {
          /* cores não têm imagem */
        } else if (!alreadyCollected && emptyImageTemplates[step && step.template]
            && !(item && typeof item.image === "string" && item.image)) {
          slots.push(makeSlot(entry, imageTrail, Object.assign({}, context, {
            itemTrail: ["steps", index, "items", itemIndex],
            itemLabel: labelFor(item)
          })));
        }
        if (item && item.interiorFolder) { collectGaveta(step, index, item, itemIndex); }
      });
    });

    // O catálogo novo dos cadernos mostra, no passo `pack`, um slideshow com
    // as imagens globais de interior. Estes ficheiros vivem fora dos passos do
    // JSON, por isso precisam de slots explícitos. A cápsula do Congresso não
    // entra aqui: mantém o renderer e os contextos de galeria que já tinha.
    if (entry.slug === "cadernos-anuais" && entry.context !== "congresso-2026") {
      var packIndex = stepIndexById(product, "pack");
      var packStep = product.steps && product.steps[packIndex];
      var interiorImages = product.interiorPreview && Array.isArray(product.interiorPreview.images)
        ? product.interiorPreview.images
        : [];

      if (packIndex >= 0 && packStep) {
        interiorImages.forEach(function (image, imageIndex) {
          var trail;
          var sourceKey;
          if (!(isImagePath(image) || image === "")) { return; }
          trail = ["interiorPreview", "images", imageIndex];
          sourceKey = entryKey(entry) + ":" + trail.join(".");
          slots.push({
            key: sourceKey,
            sourceKey: sourceKey,
            doneKey: entryKey(entry) + "|interiorPreview|" + imageIndex,
            slug: entryKey(entry),
            productSlug: entry.slug,
            trail: trail,
            itemTrail: null,
            section: "Passo " + (packIndex + 1) + " — "
              + (packStep.title || packStep.label || packStep.id || "") + " · interiores",
            stepIndex: packIndex,
            summaryKey: "",
            itemLabel: "Interior " + (imageIndex + 1),
            template: packStep.template,
            prop: "interiorPreviewImages",
            detail: "imagem do interior " + (imageIndex + 1),
            adjustPrefix: null,
            previewStepIndex: packIndex,
            previewSelections: {},
            renderItemTrail: null,
            editItemTrail: null,
            fitItemTrail: null,
            itemId: "interior-preview-" + imageIndex,
            ownerItemId: "interior-preview-" + imageIndex,
            slotName: "interior-slide",
            expectedEditKey: "",
            slideIndex: null,
            allowFit: false,
            interiorPreview: { index: imageIndex }
          });
        });
      }
    }

    Object.keys(product.summaryPlaceholders || {}).forEach(function (key) {
      slots.push(makeSlot(entry, ["summaryPlaceholders", key], {
        section: "Caixa «O que vais encomendar»",
        stepIndex: 0,
        itemTrail: null,
        itemLabel: "",
        template: "design-grid",
        summaryKey: key
      }));
    });

    slots = expandCadernoVisualContexts(entry, slots);
    assignIdentifiers(entry, slots);
    assignShortIdentifiers(entry, slots);

    return slots;
  }

  window.MiaGaleriaSlots = {
    collect: collect,
    resolveTrail: resolveTrail,
    isImagePath: isImagePath,
    productCode: productCode,
    shortEntryCode: shortEntryCode,
    PROP_LABELS: PROP_LABELS
  };
}());
