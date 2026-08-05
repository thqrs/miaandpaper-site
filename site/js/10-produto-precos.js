// js/10-produto-precos.js — parte 10/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: modelo do produto e precos: findStep, isQuadrosProduct, passo de quantidade livre, tabelas e packs (priceKeyForSize/priceForSize/linearDiscountPriceSeries), renamePricePack, resumo de preco.
  function findStep(product, id) {
    return product.steps.filter(function (step) {
      return step.id === id;
    })[0];
  }

  function selectedDesignValues() {
    if (Array.isArray(state.selections.designs)) {
      return state.selections.designs;
    }

    return state.selections.designs ? [state.selections.designs] : [];
  }

  function supportsAssortedDesigns(product) {
    return !!(product && ["crachas", "imanes", "caderninhos"].indexOf(product.slug) !== -1);
  }

  function isAssortedSelected(product) {
    return supportsAssortedDesigns(product) && state.selections.assorted_designs === "1";
  }

  function isCadernosProduct(product) {
    return !!(product && product.slug === "cadernos");
  }

  function isQuadrosProduct(product) {
    return !!(product && product.slug === "quadros");
  }

  function allDesignsSelected(product) {
    var step = product ? findStep(product, "designs") : null;
    var allValues = step && Array.isArray(step.items)
      ? step.items.map(function (item) { return item.value; }).filter(Boolean)
      : [];
    var selected = selectedDesignValues();

    return allValues.length > 0
      && selected.length === allValues.length
      && allValues.every(function (value) { return selected.indexOf(value) !== -1; });
  }

  function hideGiftRequestForSelection(product) {
    return isCadernosProduct(product) || isAssortedSelected(product) || allDesignsSelected(product);
  }

  function syncGiftRequestSelection(product) {
    if (hideGiftRequestForSelection(product)) {
      state.selections.congregation_gift = false;
    }
  }

  function resetQuantityState() {
    state.selections.design_quantities = {};
    state.quantitySignature = "";
    state.quantitiesTouched = false;
    state.quantityPackBaseline = 0;
    state.packDisabledMessage = "";
  }

  function selectedDesignItems(product) {
    var step = findStep(product, "designs");
    var values = selectedDesignValues();
    if (!step || isAssortedSelected(product)) {
      return [];
    }

    return (step.items || []).filter(function (item) {
      return values.indexOf(item.value) !== -1;
    });
  }

  function selectedCadernosStepItem(product, stepId) {
    var step = product ? findStep(product, stepId) : null;
    var selected = step ? state.selections[step.id] : "";

    if (!step || !selected) {
      return null;
    }

    return (step.items || []).filter(function (item) {
      return item.value === selected;
    })[0] || null;
  }

  function selectedCadernoCover(product) {
    return selectedDesignItems(product)[0] || null;
  }

  function selectedCadernoLamination(product) {
    return selectedCadernosStepItem(product, "lamination");
  }

  function selectedCadernoPurchaseOption(product) {
    var step = product ? findStep(product, "pack") : null;
    var quantity = Number(state.selections.pack_quantity || 0);

    if (!step || !quantity) {
      return null;
    }

    return (step.items || []).filter(function (item) {
      return Number(item.quantity) === quantity;
    })[0] || null;
  }

  function cadernoPersonalizationStep(product) {
    return product ? findStep(product, "cover_personalization") : null;
  }

  function cadernoPersonalizationLimit(product) {
    var step = cadernoPersonalizationStep(product);
    return Math.max(1, parseInt(step && step.maxLength, 10) || 25);
  }

  function cadernoPersonalizationExtraCents(product) {
    var step = cadernoPersonalizationStep(product);
    return state.selections.cover_personalization === "yes"
      ? Math.max(0, parseInt(step && step.extraPriceCents, 10) || 0)
      : 0;
  }

  function cadernoPersonalizationText() {
    return String(state.selections.cover_personalization_text || "").trim();
  }

  function cadernoPurchasePriceCents(product, option) {
    var prices = product && product.prices ? product.prices : {};
    var table = product && product.defaultPriceKey && prices[product.defaultPriceKey]
      ? prices[product.defaultPriceKey]
      : null;
    var quantity = option ? Number(option.quantity) : 0;

    if (option && option.priceCents != null) {
      return Math.max(0, Number(option.priceCents) || 0);
    }

    return table && quantity ? Math.max(0, Number(table[String(quantity)]) || 0) : 0;
  }

  function cadernoPromoNote(product) {
    var step = product ? findStep(product, "pack") : null;
    return step && step.promoNote ? plainInlineText(step.promoNote) : "";
  }

  function cadernoOrderQuantityConfig(product) {
    var step = product ? findStep(product, "pack") : null;
    return step && step.orderQuantity ? step.orderQuantity : {};
  }

  function cadernoOrderQuantityOptions(product) {
    var config = cadernoOrderQuantityConfig(product);
    var options = Array.isArray(config.options) ? config.options : [1, 2, 3, 4, 5, 10];
    var clean = [];

    options.forEach(function (option) {
      var number = Math.max(1, parseInt(option, 10) || 0);
      if (number && clean.indexOf(number) === -1) {
        clean.push(number);
      }
    });

    return clean.length ? clean : [1];
  }

  function cadernoOrderQuantity(product) {
    var options = cadernoOrderQuantityOptions(product);
    var fallback = Math.max(1, parseInt(cadernoOrderQuantityConfig(product).default, 10) || options[0] || 1);
    var selected = Math.max(1, parseInt(state.selections.caderno_order_quantity, 10) || fallback);

    return options.indexOf(selected) !== -1 ? selected : fallback;
  }

  function multipliedPriceText(unitCents, quantity) {
    var cents = Math.max(0, Number(unitCents) || 0);
    var count = Math.max(1, Number(quantity) || 1);

    if (!cents) {
      return "";
    }

    if (count === 1) {
      return formatCents(cents);
    }

    return formatCents(cents) + " x " + count + " = " + formatCents(cents * count);
  }

  function freeQuantityStep(product) {
    var step = product ? findStep(product, "pack") : null;
    return step && step.freeQuantity === true ? step : null;
  }

  function usesLinearDiscountPricing(product) {
    var step = freeQuantityStep(product);
    return !!(step && step.pricingMode === "linear-discount-interpolation");
  }

  function freeQuantitySelectionMode(product) {
    var explicit = String(state.selections.free_quantity_mode || "");
    var current = getPackQuantity(product);
    var table = activePriceTableForPackFilter(product);

    if (explicit === "pack" || explicit === "custom") {
      return explicit;
    }
    return current && table && table[String(current)] != null ? "pack" : "custom";
  }

  var FREE_QUANTITY_RANGE_MAXIMUM = 100;

  function freeQuantityRangeMaximum(product) {
    return Math.max(
      minimumFreeQuantity(product),
      Math.min(maximumFreeQuantity(product), FREE_QUANTITY_RANGE_MAXIMUM)
    );
  }

  function freeQuantityRangePosition(product, quantity) {
    var minimum = minimumFreeQuantity(product);
    var maximum = freeQuantityRangeMaximum(product);
    return Math.max(minimum, Math.min(maximum, Math.round(Number(quantity) || minimum)));
  }

  function freeQuantityFromRangePosition(product, position) {
    var minimum = minimumFreeQuantity(product);
    var maximum = freeQuantityRangeMaximum(product);
    return Math.max(minimum, Math.min(maximum, Math.round(Number(position) || minimum)));
  }

  function freeQuantityModeForValue(product, quantity) {
    var table = activePriceTableForPackFilter(product);
    var count = Math.max(0, Math.round(Number(quantity) || 0));
    return count && table && table[String(count)] != null ? "pack" : "custom";
  }

  function isCustomArtworkProduct(product) {
    return !!(product && findStep(product, "artwork_upload") && freeQuantityStep(product));
  }

  function customArtworkConfig(product) {
    var artworkStep = product ? findStep(product, "artwork_upload") : null;
    var detailsStep = product ? findStep(product, "details") : null;
    var upload = artworkStep && artworkStep.upload ? artworkStep.upload : {};
    var media = detailsStep && detailsStep.mediaAttachments ? detailsStep.mediaAttachments : {};
    var field = detailsStep && Array.isArray(detailsStep.fields) ? detailsStep.fields[0] : null;

    return {
      uploadKey: String(upload.selectionKey || "artwork_uploads"),
      helpKey: String(upload.helpKey || "artwork_help"),
      cardField: String(field && field.name || "card_description"),
      cardPhotoKey: String(media.photos && media.photos.selectionKey || "card_reference_uploads"),
      cardAudioKey: String(media.audio && media.audio.selectionKey || "card_audio_uploads")
    };
  }

  function selectedSizeItem(product, size) {
    var step = product ? findStep(product, "size") : null;
    var selected = String(size == null ? state.selections.size || "" : size);
    return step && Array.isArray(step.items) ? step.items.filter(function (item) {
      return item && String(item.value) === selected;
    })[0] || null : null;
  }

  function priceKeyForSize(product, size) {
    var item = selectedSizeItem(product, size);
    return String(item && item.priceKey || size || "");
  }

  function minimumFreeQuantity(product) {
    var item = selectedSizeItem(product);
    return Math.max(1, parseInt(item && item.minQuantity, 10) || 1);
  }

  function maximumFreeQuantity(product) {
    var step = freeQuantityStep(product);
    return Math.max(minimumFreeQuantity(product), parseInt(step && step.maxQuantity, 10) || 9999);
  }

  function tierPriceCents(priceTable, quantity) {
    var count = Math.max(0, parseInt(quantity, 10) || 0);
    var tiers;
    var tier;

    if (!priceTable || !count) {
      return 0;
    }
    if (priceTable[String(count)] != null) {
      return Math.max(0, Math.round(Number(priceTable[String(count)]) || 0));
    }
    tiers = Object.keys(priceTable).map(function (key) { return parseInt(key, 10) || 0; })
      .filter(Boolean).sort(function (a, b) { return a - b; });
    if (!tiers.length) {
      return 0;
    }
    tier = tiers[0];
    tiers.forEach(function (candidate) {
      if (candidate <= count) {
        tier = candidate;
      }
    });
    return Math.max(0, Math.round(count * (Number(priceTable[String(tier)]) || 0) / tier));
  }

  // LINEAR_DISCOUNT_PRICING_V1: cada pack define um ponto de desconto.
  // Entre dois packs, a percentagem de desconto evolui em linha reta; assim,
  // chegar a um pack maior nunca provoca uma queda brusca do preco total.
  // Antes do primeiro e depois do ultimo pack mantem-se o desconto do extremo.
  function linearDiscountPriceCents(priceTable, quantity) {
    var count = Math.max(0, parseInt(quantity, 10) || 0);
    var baseline = baselineUnitCents(priceTable);
    var points;
    var lower;
    var upper;
    var discount;

    if (!count || !baseline) {
      return 0;
    }
    if (priceTable && priceTable[String(count)] != null) {
      return Math.max(0, Math.round(Number(priceTable[String(count)]) || 0));
    }

    points = Object.keys(priceTable || {}).map(function (key) {
      var packQuantity = parseInt(key, 10) || 0;
      var packCents = Math.max(0, Number(priceTable[key]) || 0);
      return {
        quantity: packQuantity,
        discount: packQuantity && packCents
          ? Math.max(0, 1 - packCents / (baseline * packQuantity))
          : 0
      };
    }).filter(function (point) {
      return point.quantity > 0;
    }).sort(function (a, b) {
      return a.quantity - b.quantity;
    });

    if (!points.length) {
      return 0;
    }
    lower = points[0];
    upper = points[points.length - 1];
    points.forEach(function (point) {
      if (point.quantity < count) {
        lower = point;
      } else if (point.quantity > count && upper.quantity === points[points.length - 1].quantity) {
        upper = point;
      }
    });

    if (count <= points[0].quantity) {
      discount = points[0].discount;
    } else if (count >= points[points.length - 1].quantity) {
      discount = points[points.length - 1].discount;
    } else {
      discount = lower.discount + (upper.discount - lower.discount)
        * (count - lower.quantity) / (upper.quantity - lower.quantity);
    }
    return Math.max(0, Math.round(count * baseline * (1 - discount)));
  }

  function linearDiscountPriceSeries(priceTable, maximumQuantity) {
    var limit = Math.max(0, parseInt(maximumQuantity, 10) || 0);
    var prices = new Array(limit + 1);
    var quantity;

    prices[0] = 0;
    for (quantity = 1; quantity <= limit; quantity += 1) {
      prices[quantity] = linearDiscountPriceCents(priceTable, quantity);
    }
    return prices;
  }

  function activePriceTableForPackFilter(product) {
    var prices = product && product.prices ? product.prices : {};
    var keys = Object.keys(prices);

    var selectedPriceKey = priceKeyForSize(product, state.selections.size);

    if (selectedPriceKey && prices[selectedPriceKey]) {
      return prices[selectedPriceKey];
    }

    if (product && product.defaultPriceKey && prices[product.defaultPriceKey]) {
      return prices[product.defaultPriceKey];
    }

    return keys.length === 1 ? prices[keys[0]] : null;
  }

  function allowedPackItems(product) {
    var packStep = findStep(product, "pack");
    var selectedCount = isAssortedSelected(product) ? 0 : selectedDesignItems(product).length;
    var activePriceTable = activePriceTableForPackFilter(product);
    if (!packStep) {
      return [];
    }

    return (packStep.items || []).filter(function (item) {
      var quantity = Number(item.quantity);
      if (quantity < selectedCount) {
        return false;
      }

      return !activePriceTable || activePriceTable[String(quantity)] != null;
    });
  }

  function getPackQuantity(product) {
    var pack = Number(state.selections.pack_quantity || 0);
    if (freeQuantityStep(product)) {
      return Number.isInteger(pack) && pack >= minimumFreeQuantity(product) && pack <= maximumFreeQuantity(product)
        ? pack
        : 0;
    }
    var allowed = allowedPackItems(product).map(function (item) {
      return Number(item.quantity);
    });

    if (allowed.indexOf(pack) === -1) {
      return 0;
    }

    return pack;
  }

  function distributeQuantities(items, packQuantity) {
    var quantities = {};
    var base;
    var rest;

    if (!items.length || !packQuantity) {
      return quantities;
    }

    base = Math.floor(packQuantity / items.length);
    rest = packQuantity % items.length;

    items.forEach(function (item, index) {
      quantities[item.value] = base + (index < rest ? 1 : 0);
    });

    return quantities;
  }

  function selectedItemsSignature(items) {
    return items.map(function (item) {
      return item.value;
    }).join("|");
  }

  function scaleQuantities(items, packQuantity, existing) {
    var currentTotal = 0;
    var rows = [];
    var quantities = {};
    var used = 0;

    if (!items.length || !packQuantity) {
      return quantities;
    }

    items.forEach(function (item) {
      var current = Math.max(1, parseInt(existing[item.value], 10) || 1);
      currentTotal += current;
    });

    if (!currentTotal) {
      return distributeQuantities(items, packQuantity);
    }

    items.forEach(function (item, index) {
      var current = Math.max(1, parseInt(existing[item.value], 10) || 1);
      var raw = current / currentTotal * packQuantity;
      var value = Math.max(1, Math.floor(raw));

      quantities[item.value] = value;
      used += value;
      rows.push({
        value: item.value,
        index: index,
        fraction: raw - Math.floor(raw)
      });
    });

    while (used < packQuantity) {
      rows.sort(function (a, b) {
        return b.fraction - a.fraction || a.index - b.index;
      });
      quantities[rows[(used - items.length) % rows.length].value] += 1;
      used += 1;
    }

    while (used > packQuantity) {
      rows.sort(function (a, b) {
        return quantities[b.value] - quantities[a.value] || a.fraction - b.fraction || a.index - b.index;
      });

      if (quantities[rows[0].value] <= 1) {
        break;
      }

      quantities[rows[0].value] -= 1;
      used -= 1;
    }

    return quantities;
  }

  function addPinsToQuantities(items, addCount, existing) {
    var quantities = {};
    var rows = [];

    if (!items.length || addCount <= 0) {
      return existing || {};
    }

    items.forEach(function (item, index) {
      quantities[item.value] = Math.max(1, parseInt(existing[item.value], 10) || 1);
      rows.push({
        value: item.value,
        index: index
      });
    });

    while (addCount > 0) {
      rows.sort(function (a, b) {
        return quantities[a.value] - quantities[b.value] || a.index - b.index;
      });
      quantities[rows[0].value] += 1;
      addCount -= 1;
    }

    return quantities;
  }

  function ensurePackAndQuantities(product) {
    var items = selectedDesignItems(product);
    var allowed = allowedPackItems(product);
    var current = Number(state.selections.pack_quantity || 0);
    var allowedQuantities = allowed.map(function (item) {
      return Number(item.quantity);
    });
    var signature;
    var existing;
    var total;

    if (!findStep(product, "pack")) {
      state.selections.design_quantities = {};
      state.quantitySignature = selectedItemsSignature(items);
      state.quantitiesTouched = false;
      state.quantityPackBaseline = 0;
      return;
    }

    if (isCadernosProduct(product)) {
      state.selections.design_quantities = {};
      if (items[0]) {
        state.selections.design_quantities[items[0].value] = 1;
      }
      state.quantitySignature = selectedItemsSignature(items);
      state.quantitiesTouched = false;
      state.quantityPackBaseline = getPackQuantity(product);
      return;
    }

    if (isAssortedSelected(product)) {
      if (!current || allowedQuantities.indexOf(current) === -1) {
        current = allowed[0] ? Number(allowed[0].quantity) : 0;
        if (current) {
          state.selections.pack_quantity = current;
        }
      }
      state.selections.design_quantities = {};
      state.quantitySignature = "__assorted__";
      state.quantitiesTouched = false;
      state.quantityPackBaseline = current;
      return;
    }

    if (!items.length) {
      delete state.selections.pack_quantity;
      state.selections.design_quantities = {};
      state.quantitySignature = "";
      state.quantitiesTouched = false;
      state.quantityPackBaseline = 0;
      return;
    }

    if (!current || allowedQuantities.indexOf(current) === -1) {
      current = Number(allowed[0].quantity);
      state.selections.pack_quantity = current;
    }

    signature = selectedItemsSignature(items);
    existing = state.selections.design_quantities || {};

    if (state.quantitySignature !== signature) {
      state.selections.design_quantities = distributeQuantities(items, current);
      state.quantitySignature = signature;
      state.quantitiesTouched = false;
      state.quantityPackBaseline = current;
      return;
    }

    cleanQuantities(product);
    total = quantityTotal(product);
    existing = state.selections.design_quantities || {};

    // SMART_QUANTITIES_V1 + V2: a re-distribuição/escala só corre quando
    // o pack mudou de valor (ou quando ainda não havia baseline). Em
    // re-renders provocados por +/- o pack mantém-se igual ao baseline,
    // por isso não tocamos nas quantidades — caso contrário o scale
    // desfazia o clique do utilizador. Para 3+ designs com a caixinha
    // "Quantidades inteligentes" ligada, escalamos proporcionalmente;
    // caso contrário redistribuímos por igual.
    if (current !== state.quantityPackBaseline) {
      if (items.length >= 3) {
        if (state.quantitiesTouched && smartQuantitiesEnabled()) {
          state.selections.design_quantities = scaleQuantities(items, current, existing);
        } else {
          state.selections.design_quantities = distributeQuantities(items, current);
          state.quantitiesTouched = false;
        }
      } else {
        state.selections.design_quantities = state.quantitiesTouched
          ? scaleQuantities(items, current, existing)
          : distributeQuantities(items, current);
      }
      state.quantityPackBaseline = current;
      return;
    }

    // Pack não mudou. Se os totais não bateram (ex.: design retirado e
    // o seu valor desapareceu na limpeza acima) deixamos como está — o
    // utilizador resolve com +/- ou com "Distribuir por igual". Manter
    // proporções no meio de uma edição manual seria contraintuitivo.
  }

  function cleanQuantities(product) {
    var items = selectedDesignItems(product);
    var allowed = {};
    var clean = {};
    var existing = state.selections.design_quantities || {};

    items.forEach(function (item) {
      allowed[item.value] = true;
      clean[item.value] = Math.max(1, parseInt(existing[item.value], 10) || 1);
    });

    state.selections.design_quantities = clean;
  }

  function quantityFor(value) {
    return Math.max(0, parseInt((state.selections.design_quantities || {})[value], 10) || 0);
  }

  function quantityTotal(product) {
    return selectedDesignItems(product).reduce(function (total, item) {
      return total + quantityFor(item.value);
    }, 0);
  }

  function unassignedCount(product) {
    return Math.max(0, getPackQuantity(product) - quantityTotal(product));
  }

  function formatCents(cents) {
    return (Number(cents) / 100).toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR"
    });
  }

  function pricingRecordFor(product) {
    if (!product || !state.pricing || !state.pricing.products) {
      return null;
    }

    return state.pricing.products[product.slug] || null;
  }

  function cloneJson(value) {
    // Não trocar valores predefinidos falsos (false, "", 0) por um objecto
    // truthy. Isso fazia, por exemplo, "a Mia escolhe" ficar activo apesar de
    // o fundo branco ter sido definido explicitamente.
    if (value === undefined) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(value));
  }

  // SMART_QUANTITIES_V1: settings globais lidas de pricing.json. Quando
  // smartQuantities=true (default), ao mudar de pack as quantidades dos
  // designs escalam proporcionalmente em vez de fazer reset.
  function siteSettings() {
    if (!state.pricing) {
      return { smartQuantities: true };
    }
    if (!state.pricing.settings) {
      state.pricing.settings = {};
    }
    if (state.pricing.settings.smartQuantities === undefined) {
      state.pricing.settings.smartQuantities = true;
    }
    return state.pricing.settings;
  }

  function smartQuantitiesEnabled() {
    return siteSettings().smartQuantities !== false;
  }

  function applyPricingToProduct(product, pricing) {
    var record;

    state.pricing = pricing || null;
    record = pricing && pricing.products ? pricing.products[product.slug] : null;
    siteSettings();

    if (!record) {
      syncPricingFromProduct(product);
      return product;
    }

    product.prices = cloneJson(record.prices || product.prices || {});
    if (record.defaultPriceKey) {
      product.defaultPriceKey = record.defaultPriceKey;
    }
    if (record.unitLabel) {
      product.unitLabel = record.unitLabel;
    }
    if (record.unitSingular) {
      product.unitSingular = record.unitSingular;
    }
    if (record.unitShort) {
      product.unitShort = record.unitShort;
    }

    syncPackItemsFromPricing(product);
    return product;
  }

  function syncPricingFromProduct(product) {
    var record;

    if (!product || !product.slug) {
      return;
    }

    if (!state.pricing) {
      state.pricing = { currency: "EUR", products: {} };
    }

    if (!state.pricing.products) {
      state.pricing.products = {};
    }

    record = state.pricing.products[product.slug] || {};
    record.id = product.slug;
    record.label = product.hero && product.hero.title ? product.hero.title : (product.title || product.slug);
    record.unitLabel = product.unitLabel || productUnit(product);
    record.unitSingular = product.unitSingular || productUnitSingular(product);
    record.unitShort = product.unitShort || productUnitShort(product);
    record.defaultPriceKey = product.defaultPriceKey || Object.keys(product.prices || {})[0] || "";
    record.prices = cloneJson(product.prices || {});
    state.pricing.products[product.slug] = record;
  }

  function renamePricePack(product, size, oldPack, newPack) {
    var table;
    var cents;

    oldPack = String(oldPack || "");
    newPack = String(Math.max(1, parseInt(newPack, 10) || 1));

    if (!product || !product.prices || !product.prices[size] || !oldPack || oldPack === newPack) {
      return false;
    }

    table = product.prices[size];
    if (table[oldPack] == null) {
      return false;
    }

    cents = Number(table[oldPack]) || 0;
    delete table[oldPack];
    table[newPack] = cents;

    if (Number(state.selections.pack_quantity) === Number(oldPack)) {
      state.selections.pack_quantity = Number(newPack);
      state.quantitySignature = "";
      state.quantitiesTouched = false;
      state.quantityPackBaseline = 0;
    }

    return true;
  }

  function syncPackItemsFromPricing(product) {
    var packStep = product ? findStep(product, "pack") : null;
    var quantities = allPriceQuantities(product && product.prices ? product.prices : {});
    var existing = {};

    if (!packStep || packStep.freeQuantity === true || !Array.isArray(packStep.items) || !quantities.length) {
      return;
    }

    packStep.items = packStep.items.filter(function (item) {
      return quantities.indexOf(String(item.quantity)) !== -1;
    });

    packStep.items.forEach(function (item) {
      existing[String(item.quantity)] = true;
    });

    quantities.forEach(function (quantity) {
      var number = Number(quantity);
      if (!number || existing[String(number)]) {
        return;
      }
      packStep.items.push({
        id: "pack-" + number,
        quantity: number,
        title: String(number),
        subtitle: number === 1 ? productUnitSingular(product) : productUnit(product)
      });
    });

    packStep.items.sort(function (a, b) {
      return Number(a.quantity) - Number(b.quantity);
    });
  }

  function productUnit(product) {
    return product.unitLabel || ((product.slug === "crachas" || product.slug === "pins") ? "crachás" : "unidades");
  }

  function productUnitSingular(product) {
    return product.unitSingular || ((product.slug === "crachas" || product.slug === "pins") ? "crachá" : "unidade");
  }

  function productQuantityLabel(product, quantity) {
    return Number(quantity) + " " + (Number(quantity) === 1 ? productUnitSingular(product) : productUnit(product));
  }

  function productUnitShort(product) {
    return product.unitShort || ((product.slug === "crachas" || product.slug === "pins") ? "crachá" : "unid.");
  }

  function formatUnitPrice(cents, quantity, unit) {
    if (!quantity) {
      return "";
    }

    return (Number(cents) / 100 / quantity).toLocaleString("pt-PT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " €/" + unit;
  }

  function deliveryFeeCents(option) {
    return Math.max(0, parseInt(option && option.feeCents, 10) || 0);
  }


  // DELIVERY_OPTIONS_3_V1: opções com feeCents === 0 e sem priceText
  // mostram "Grátis" em vez de "0,00 €". Mantém priceText explícito quando
  // existir (para casos como "Valor mínimo\n5,55 €").
  function deliveryPriceText(option) {
    var text = String(option && option.priceText ? option.priceText : "").trim();

    if (text) {
      return text;
    }

    if (option && deliveryFeeCents(option) === 0) {
      return "Grátis";
    }

    if (option && option.id === "shipping" && deliveryFeeCents(option) === 1000) {
      return "Valor mínimo 10 €, preço a combinar";
    }

    return formatCents(deliveryFeeCents(option));
  }

  // PACK_DISCOUNT_FALLBACK_BASELINE_V1: quando a tabela de precos nao tem
  // chave "1" (ex.: imanes Achatados, que so vendem a partir de 15 unidades),
  // o desconto era sempre 0. Como fallback usamos o pack mais caro por
  // unidade (geralmente o pack mais pequeno) como baseline. Mantemos o
  // comportamento original quando ha preco unitario.
  function baselineUnitCents(priceTable) {
    var unit;
    var max = 0;

    if (!priceTable) {
      return 0;
    }

    unit = Number(priceTable["1"]) || 0;
    if (unit) {
      return unit;
    }

    Object.keys(priceTable).forEach(function (key) {
      var qty = parseInt(key, 10);
      var cents = Number(priceTable[key]);
      var perUnit;

      if (!qty || !cents) {
        return;
      }

      perUnit = cents / qty;
      if (perUnit > max) {
        max = perUnit;
      }
    });

    return max;
  }

  function priceForSize(product, size) {
    var packQuantity = getPackQuantity(product);
    var priceKey = priceKeyForSize(product, size);
    var table = product.prices && product.prices[priceKey] ? product.prices[priceKey] : null;
    var cents = table && packQuantity
      ? (freeQuantityStep(product)
        ? (usesLinearDiscountPricing(product)
          ? linearDiscountPriceCents(table, packQuantity)
          : tierPriceCents(table, packQuantity))
        : Number(table[String(packQuantity)]))
      : 0;
    var unitCents = baselineUnitCents(table);
    var discount = 0;

    if (unitCents && cents && packQuantity && cents < unitCents * packQuantity) {
      discount = Math.round((1 - (cents / (unitCents * packQuantity))) * 100);
    }

    return {
      size: size,
      quantity: packQuantity,
      cents: cents,
      total: cents ? formatCents(cents) : "",
      perPin: cents ? formatUnitPrice(cents, packQuantity, productUnitShort(product)) : "",
      discount: discount
    };
  }

  function priceDisplayName(product, size) {
    if (product && (product.slug === "crachas" || product.slug === "pins")) {
      if (size === "25 mm") {
        return "Crachás Pequenos";
      }

      if (size === "32 mm") {
        return "Crachás Médios";
      }
    }

    if (product && product.slug === "imanes") {
      if (size === "Achatados") {
        return "Ímanes finos";
      }

      if (size === "3 mm") {
        return "Ímanes grossos";
      }
    }

    return size;
  }

  function cadernoPriceInfo(product) {
    var option = selectedCadernoPurchaseOption(product);
    var baseCents = cadernoPurchasePriceCents(product, option);
    var extraCents = cadernoPersonalizationExtraCents(product);
    var orderQuantity = cadernoOrderQuantity(product);
    var unitCents = baseCents + extraCents;
    var totalCents = unitCents * orderQuantity;

    return {
      size: option ? option.title : "",
      quantity: option ? Number(option.quantity) : 0,
      orderQuantity: option ? orderQuantity : 0,
      cents: totalCents,
      baseCents: baseCents,
      personalizationCents: extraCents,
      unitCents: unitCents,
      total: totalCents ? formatCents(totalCents) : "",
      baseTotal: baseCents ? formatCents(baseCents) : "",
      baseSubtotal: baseCents ? multipliedPriceText(baseCents, orderQuantity) : "",
      personalizationTotal: extraCents ? formatCents(extraCents) : "",
      personalizationSubtotal: extraCents ? multipliedPriceText(extraCents, orderQuantity) : "",
      unitTotal: unitCents ? formatCents(unitCents) : "",
      perPin: "",
      discount: 0
    };
  }

  function cadernoPriceEquation(info) {
    if (!info || !info.baseTotal) {
      return "";
    }

    if (info.personalizationTotal) {
      return "Preço base: " + info.baseTotal + " + Personalização: " + info.personalizationTotal + " = " + info.unitTotal;
    }

    return "Preço base: " + info.baseTotal;
  }

  function selectedQuadroPackaging(product) {
    return selectedCadernosStepItem(product, "packaging");
  }

  function quadroPackagingExtraCents(product) {
    var packaging = selectedQuadroPackaging(product);
    return packaging ? Math.max(0, Number(packaging.extraPriceCents) || 0) : 0;
  }

  function quadroPriceEquation(info) {
    if (!info || !info.baseTotal) {
      return "";
    }

    if (info.packagingTotal) {
      return "Preço base: " + info.baseTotal + " + Embrulho: " + info.packagingTotal + " = " + info.total;
    }

    return "Preço base: " + info.baseTotal;
  }

  function quadroPriceInfo(product) {
    var option = selectedDesignItems(product)[0] || null;
    var superStep = findStep(product, "super_details");
    var selectedSuperExample = superStep && Array.isArray(superStep.exampleImages) ? superStep.exampleImages.filter(function (item) {
      return item && item.value === state.selections.quadro_super_example;
    })[0] || null : null;
    var frameStep = findStep(product, "frame_size");
    var frameSize = String((option && option.frameSize) || state.selections.frame_size || (selectedSuperExample && selectedSuperExample.frameSize) || "");
    var frameOption = frameStep && Array.isArray(frameStep.items) ? frameStep.items.filter(function (item) {
      return item && item.value === frameSize;
    })[0] || null : null;
    var pricesByDesign = frameOption && frameOption.priceByDesignCents && typeof frameOption.priceByDesignCents === "object"
      ? frameOption.priceByDesignCents
      : {};
    var quantity = getPackQuantity(product) || (option ? 1 : 0);
    var fixedPriceCents = option ? Math.max(0, Number(option.priceCents) || 0) : 0;
    var baseCents = option && !option.quoteOnly ? (fixedPriceCents || Math.max(0, Number(pricesByDesign[option.value]) || 0)) : 0;
    var packagingCents = quadroPackagingExtraCents(product);
    var cents = option && !option.quoteOnly ? baseCents + packagingCents : 0;
    var priceText = option && option.quoteOnly ? String(option.note || "").trim() : "";

    return {
      size: product.defaultPriceKey || "Moldura personalizada",
      frameSize: frameSize,
      quantity: quantity,
      cents: cents,
      total: cents ? formatCents(cents) : priceText,
      baseCents: baseCents,
      baseTotal: baseCents ? formatCents(baseCents) : "",
      packagingCents: packagingCents,
      packagingTotal: packagingCents ? formatCents(packagingCents) : "",
      perPin: "",
      discount: 0,
      priceToConfirm: !!(option && option.quoteOnly),
      priceMinCents: option ? Math.max(0, Number(option.priceMinCents) || 0) : 0,
      priceMaxCents: option ? Math.max(0, Number(option.priceMaxCents) || 0) : 0
    };
  }

  function quadroChoiceNote(product, step, item) {
    var design = selectedDesignItems(product)[0] || null;
    var pricesByDesign;
    var cents;

    if (isQuadrosProduct(product) && step && step.id === "designs" && item && item.priceCents) {
      return formatCents(Math.max(0, Number(item.priceCents) || 0));
    }

    if (!isQuadrosProduct(product) || !step || step.id !== "frame_size" || !design) {
      return item && item.note ? String(item.note) : "";
    }

    pricesByDesign = item && item.priceByDesignCents && typeof item.priceByDesignCents === "object"
      ? item.priceByDesignCents
      : {};
    cents = Math.max(0, Number(pricesByDesign[design.value]) || 0);
    return cents ? formatCents(cents) : "";
  }

  function priceInfo(product) {
    if (isQuadrosProduct(product)) {
      return quadroPriceInfo(product);
    }

    if (isCadernosProduct(product)) {
      return cadernoPriceInfo(product);
    }

    var prices = product.prices || {};
    var fallbackKey = product.defaultPriceKey || Object.keys(prices)[0] || "";
    return priceForSize(product, state.selections.size || fallbackKey);
  }

  // CONFIRM_REFORMAT_V1: priceSummaryText agora usa "X € por cada Y" em vez
  // de "X €/Y", e "(com N% de desconto)" em vez de "(N% de desconto)".
  // A substituição é feita só aqui para não afectar outros sítios que
  // dependem do formato compacto "0,98 €/íman" (ex.: pack-price overview).
  function priceSummaryText(info) {
    if (!info.total) {
      return "";
    }

    var perUnitText = String(info.perPin || "").replace(/\s*\/\s*/, " por cada ");
    return info.total + ", ou seja: " + perUnitText + (info.discount > 0 ? " (devido aos " + info.discount + "% de desconto)" : "");
  }

  // DELIVERY_OPTIONS_3_V1: defaults globais alinhados com o pedido — três
  // opções, sem "Sem portes" como label, com "Grátis" mostrado em vez de
  // "0,00 €" via deliveryPriceText. priceText em multi-linha usa "\n" e é
  // renderizado com white-space: pre-line (CSS).
  function defaultDeliveryOptions() {
    return [
      { id: "pickup", label: "Vou recolher na casa da Mia", text: "", feeCents: 0 },
      { id: "shipping", label: "Envio CTT - até 2 Kg", text: "", feeCents: 540, priceText: "Valor mínimo:\n5,40 €" },
      { id: "join_orders", label: "Junta as minhas encomendas", text: "", feeCents: 0 }
    ];
  }

  function deliveryOptions(product) {
    return product && Array.isArray(product.deliveryOptions) && product.deliveryOptions.length
      ? product.deliveryOptions
      : defaultDeliveryOptions();
  }

  // DELIVERY_CONTACT_STEP_V1: getDeliveryOption deixou de mutar state.selections.
  // Continua a devolver a primeira opção como fallback de display/preço, mas
  // state.selections.delivery_option só é escrito quando o utilizador clica
  // num radio. Isto permite que o novo passo "Entrega e contacto" exija uma
  // escolha activa (validateStep verifica state.selections.delivery_option).
  function getDeliveryOption(product) {
    var options = deliveryOptions(product);
    var selected = state.selections.delivery_option || "";
    var found = options.filter(function (option) {
      return option.id === selected;
    })[0];

    if (found) {
      return found;
    }

    return options[0] || { id: "", label: "", text: "", feeCents: 0 };
  }

  function itemImageNumber(item, key, fallback, min, max) {
    var value = Number(item && item[key]);

    if (!isFinite(value)) {
      value = fallback;
    }

    return Math.max(min, Math.min(max, value));
  }

