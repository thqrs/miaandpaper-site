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

  function productFamily(product) {
    var slug = String(product && product.slug || "");
    var explicit = String(product && product.family || "");

    if (explicit) {
      return explicit;
    }
    if (slug === "crachas-loja" || slug === "crachas" || slug === "pins") {
      return "crachas";
    }
    if (slug === "imanes-loja" || slug === "imanes") {
      return "imanes";
    }
    if (slug === "mini-cadernos" || slug === "caderninhos") {
      return "caderninhos";
    }
    if (slug === "cadernos-anuais" || slug === "cadernos") {
      return "cadernos";
    }
    return slug;
  }

  function isMainCatalogProduct(product) {
    return !!(product
      && String(product.catalogContext || "") === "main-v2"
      && String(product.orderFlow || "") === "catalog-or-custom");
  }

  function supportsAssortedDesigns(product) {
    return !!(product && ["crachas", "imanes", "imanes-recortados", "caderninhos", "bloquinhos", "stickers", "marcadores", "marcadores-magneticos"].indexOf(productFamily(product)) !== -1);
  }

  function isAssortedSelected(product) {
    return supportsAssortedDesigns(product) && state.selections.assorted_designs === "1";
  }

  function isCadernosProduct(product) {
    return !!(product && productFamily(product) === "cadernos");
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

  // OPTION_DRAWERS_V1: opções por unidade definidas inteiramente no JSON do
  // produto. Cada gaveta é uma escolha única e o servidor repete a mesma
  // validação/cálculo, por isso os preços mostrados não dependem do browser.
  function optionDrawerSteps(product) {
    return product && Array.isArray(product.steps) ? product.steps.filter(function (step) {
      return step && step.template === "option-drawers" && Array.isArray(step.drawers);
    }) : [];
  }

  function optionDrawerRecords(product) {
    var records = [];

    optionDrawerSteps(product).forEach(function (step) {
      step.drawers.forEach(function (drawer) {
        if (drawer && drawer.field && Array.isArray(drawer.items)) {
          records.push({ step: step, drawer: drawer });
        }
      });
    });
    return records;
  }

  function optionDrawerItem(drawer, value) {
    return drawer && Array.isArray(drawer.items) ? drawer.items.filter(function (item) {
      return item && String(item.value) === String(value == null ? "" : value);
    })[0] || null : null;
  }

  function ensureOptionDrawerSelections(product) {
    optionDrawerRecords(product).forEach(function (record) {
      var drawer = record.drawer;
      var field = String(drawer.field);
      var current = state.selections[field];
      var fallback = drawer.defaultValue != null ? String(drawer.defaultValue) : "";

      if ((current == null || current === "") && fallback && optionDrawerItem(drawer, fallback)) {
        state.selections[field] = fallback;
      }
    });
  }

  function selectedOptionDrawerRecords(product) {
    ensureOptionDrawerSelections(product);
    return optionDrawerRecords(product).map(function (record) {
      var field = String(record.drawer.field);
      var item = optionDrawerItem(record.drawer, state.selections[field]);
      return item ? { step: record.step, drawer: record.drawer, item: item } : null;
    }).filter(Boolean);
  }

  function optionDrawerExtraPerUnitCents(product) {
    if (isMainCatalogProduct(product) && isCustomArtworkSelected(product)) {
      return 0;
    }
    return selectedOptionDrawerRecords(product).reduce(function (total, record) {
      return total + Math.max(0, parseInt(record.item.extraPriceCentsPerUnit, 10) || 0);
    }, 0);
  }

  function optionDrawerSummaryRows(product) {
    return selectedOptionDrawerRecords(product).map(function (record) {
      var extra = Math.max(0, parseInt(record.item.extraPriceCentsPerUnit, 10) || 0);
      var value = String(record.item.title || record.item.value || "");
      if (extra) {
        value += " (+" + formatCents(extra) + " por " + productUnitSingular(product) + ")";
      }
      return [String(record.drawer.label || record.drawer.title || "Opção") + ":", value];
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
    if (isCustomArtworkSelected(product)) {
      var upload = customArtworkItems(product)[0] || null;
      var isPdf = upload && (String(upload.mime || "").toLowerCase() === "application/pdf" || /\.pdf$/i.test(String(upload.name || "")));
      return upload ? {
        id: "custom-cover",
        value: "custom-cover",
        title: "Capa personalizada",
        subtitle: isPdf ? "PDF enviado" : "Imagem enviada",
        image: isPdf ? "" : orderUploadPreviewUrl(upload),
        visual: "neutral",
        imageFit: "cover"
      } : null;
    }
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

  function cadernoAddOnsStep(product) {
    return product ? findStep(product, "add_ons") : null;
  }

  function selectedCadernoAddOns(product) {
    var step = cadernoAddOnsStep(product);
    var selected = step && Array.isArray(state.selections[step.id])
      ? state.selections[step.id]
      : [];

    return step && Array.isArray(step.items) ? step.items.filter(function (item) {
      return item && selected.indexOf(item.value) !== -1;
    }) : [];
  }

  function cadernoAddOnsExtraCents(product) {
    return selectedCadernoAddOns(product).reduce(function (total, item) {
      return total + Math.max(0, parseInt(item && item.extraPriceCents, 10) || 0);
    }, 0);
  }

  function cadernoAddOnsLabels(product) {
    return selectedCadernoAddOns(product).map(function (item) {
      return item.title || item.value;
    });
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
    if (isCustomArtworkSelected(product)) {
      return customArtworkTotalQuantity(product);
    }
    var options = cadernoOrderQuantityOptions(product);
    var config = cadernoOrderQuantityConfig(product);
    var minimum = Math.max(1, parseInt(config.minimum, 10) || parseInt(product && product.minimumQuantity, 10) || 1);
    var maximum = Math.max(minimum, parseInt(config.maximum, 10) || 9999);
    var fallback = Math.max(minimum, parseInt(config.default, 10) || options[0] || minimum);
    var selected = Math.max(minimum, Math.min(maximum, parseInt(state.selections.caderno_order_quantity, 10) || fallback));

    return isMainCatalogProduct(product) ? selected : (options.indexOf(selected) !== -1 ? selected : fallback);
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

  // PRICING_MODE_BY_PRICE_KEY_V1: o modo de preço é do produto, mas cada tabela
  // de preços pode ter o seu. Nos ímanes, os finos vendem-se ao escalão (o
  // mínimo é 15, mas depois vale qualquer quantidade) enquanto os de 3 mm
  // continuam a somar packs exactos. Tem de dar sempre o mesmo modo que
  // `main_v2_effective_pricing_mode` no send-order.php.
  function effectivePricingMode(product) {
    var step = freeQuantityStep(product);
    var byKey = (product && product.pricingModeByPriceKey)
      || (step && step.pricingModeByPriceKey)
      || null;
    var priceKey = priceKeyForSize(product, state.selections.size);

    if (byKey && priceKey && byKey[priceKey]) {
      return String(byKey[priceKey]);
    }
    return String((product && product.pricingMode) || (step && step.pricingMode) || "");
  }

  // QUANTITY_PRICING_SWITCH_V1: a escolha do método altera apenas o cálculo.
  // A grelha de packs, o slider e a quantidade continuam a usar a mesma fonte
  // de dados e o mesmo estado, independentemente deste valor.
  function quantityPricingSwitchConfig(product, priceKey) {
    var step = freeQuantityStep(product);
    var mapping = (product && product.quantityPricingSwitchByPriceKey)
      || (step && step.quantityPricingSwitchByPriceKey)
      || {};
    var key = String(priceKey
      || priceKeyForSize(product, state.selections.size)
      || (product && product.defaultPriceKey)
      || "");
    var config = mapping[key];

    return config && typeof config === "object" && config.quantityTiers === true
      ? config
      : null;
  }

  function supportsQuantityPricingSwitch(product, priceKey) {
    return !!quantityPricingSwitchConfig(product, priceKey);
  }

  function selectedQuantityPricingMode(product, priceKey) {
    if (!supportsQuantityPricingSwitch(product, priceKey)) {
      return "packs";
    }
    if (!quantityPricingSwitchEnabled()) {
      return "quantity_tiers";
    }
    return state.selections.quantity_pricing_mode === "packs"
      ? "packs"
      : "quantity_tiers";
  }

  function usesSelectedQuantityTierPricing(product, priceKey) {
    return selectedQuantityPricingMode(product, priceKey) === "quantity_tiers";
  }

  function usesLinearDiscountPricing(product) {
    var step = freeQuantityStep(product);
    return !!(step && effectivePricingMode(product) === "linear-discount-interpolation");
  }

  // TIER_UNIT_PRICING_V1: cada escalão fixa uma percentagem de desconto sobre o
  // preço unitário do escalão mínimo. A partir do mínimo vale qualquer
  // quantidade, e cada unidade extra é vendida com o desconto do escalão em
  // vigor — 16 ímanes finos são 16 x o unitário do escalão de 15.
  function usesTierUnitPricing(product) {
    return effectivePricingMode(product) === "tier-unit";
  }

  // Preço por unidade do escalão em vigor, sem passar pelo total arredondado.
  function tierUnitPriceCents(table, quantity) {
    var tier = 0;

    priceTiers(table).forEach(function (candidate) {
      if (candidate <= quantity) {
        tier = candidate;
      }
    });

    return tier ? (Number(table[String(tier)]) || 0) / tier : 0;
  }

  function priceTiers(table) {
    return Object.keys(table || {})
      .map(function (key) { return parseInt(key, 10) || 0; })
      .filter(function (quantity) { return quantity > 0 && Number(table[String(quantity)]) > 0; })
      .sort(function (a, b) { return a - b; });
  }

  // PACK_COMBINATION_V1: sem descontos intermédios. O preço de N unidades é o da
  // combinação de packs mais barata que dá exactamente N. Tem de dar sempre o
  // mesmo cêntimo que `product_pack_combination_plan` no send-order.php, por
  // isso o algoritmo e o desempate são iguais: troco por programação dinâmica.
  // Por defeito ganha o pack mais pequeno; tabelas com `fewer-packs` usam menos
  // packs quando o custo empata, sem alterar o comportamento dos outros produtos.
  function usesPackCombinationPricing(product) {
    return effectivePricingMode(product) === "pack-combination";
  }

  var packCombinationCache = {};

  function packCombinationTablePacks(table) {
    return Object.keys(table || {})
      .map(function (key) { return { quantity: parseInt(key, 10), cents: parseInt(table[key], 10) }; })
      .filter(function (pack) { return pack.quantity > 0 && pack.cents > 0; })
      .sort(function (a, b) { return a.quantity - b.quantity; });
  }

  function packCombinationPrefersFewerPacks(product, priceKey) {
    var step = freeQuantityStep(product);
    var mapping = (product && product.combinationTieBreakByPriceKey)
      || (step && step.combinationTieBreakByPriceKey)
      || {};
    var key = priceKey || priceKeyForSize(product, state.selections.size);

    return String(mapping[key] || "") === "fewer-packs";
  }

  function packCombinationUsesNextPackUpgrade(product) {
    var step = freeQuantityStep(product);
    var mapping = (product && product.upgradeToNextPackByPriceKey)
      || (step && step.upgradeToNextPackByPriceKey)
      || {};
    var key = priceKeyForSize(product, state.selections.size);

    return mapping[key] === true;
  }

  // Devolve { cents, parts: [{quantity, count}] } ou null se os packs não
  // conseguirem somar exactamente esta quantidade.
  function packCombinationPlan(table, quantity, preferFewerPacks) {
    var target = Math.max(0, parseInt(quantity, 10) || 0);
    var packs = packCombinationTablePacks(table);
    var chave;
    var cost;
    var packCount;
    var pick;
    var n;
    var i;
    var rest;
    var candidate;
    var candidateCount;
    var parts;
    var order;

    if (!packs.length || target <= 0) {
      return null;
    }

    chave = packs.map(function (p) { return p.quantity + ":" + p.cents; }).join(",") + "|" + target + "|" + (preferFewerPacks ? "few" : "small");
    if (Object.prototype.hasOwnProperty.call(packCombinationCache, chave)) {
      return packCombinationCache[chave];
    }

    cost = new Array(target + 1);
    packCount = new Array(target + 1);
    pick = new Array(target + 1);
    cost[0] = 0;
    packCount[0] = 0;
    pick[0] = 0;

    for (n = 1; n <= target; n += 1) {
      cost[n] = null;
      packCount[n] = null;
      pick[n] = 0;
      for (i = 0; i < packs.length; i += 1) {
        if (packs[i].quantity > n) {
          break;
        }
        rest = cost[n - packs[i].quantity];
        if (rest === null) {
          continue;
        }
        candidate = rest + packs[i].cents;
        candidateCount = packCount[n - packs[i].quantity] + 1;
        if (cost[n] === null
          || candidate < cost[n]
          || (preferFewerPacks && candidate === cost[n] && candidateCount < packCount[n])) {
          cost[n] = candidate;
          packCount[n] = candidateCount;
          pick[n] = packs[i].quantity;
        }
      }
    }

    if (cost[target] === null) {
      packCombinationCache[chave] = null;
      return null;
    }

    parts = {};
    n = target;
    while (n > 0 && pick[n] > 0) {
      parts[pick[n]] = (parts[pick[n]] || 0) + 1;
      n -= pick[n];
    }
    order = Object.keys(parts).map(Number).sort(function (a, b) { return b - a; });

    packCombinationCache[chave] = {
      cents: cost[target],
      parts: order.map(function (q) {
        var pack = packs.filter(function (p) { return p.quantity === q; })[0];
        return {
          quantity: q,
          count: parts[q],
          unitCents: pack ? pack.cents : 0,
          cents: pack ? pack.cents * parts[q] : 0
        };
      })
    };
    return packCombinationCache[chave];
  }

  function packCombinationCents(table, quantity, preferFewerPacks) {
    var plan = packCombinationPlan(table, quantity, preferFewerPacks);
    return plan ? plan.cents : 0;
  }

  // Quantidades que os packs conseguem somar. Nos crachás e mini-cadernos é
  // tudo a partir de 1 (há preço de unidade); nos ímanes achatados, cujos packs
  // são todos múltiplos de 15, é só 15, 30, 45...
  function packCombinationReachable(table, quantity) {
    return packCombinationPlan(table, quantity) !== null;
  }

  function packCombinationNextReachable(table, quantity, direction, limit) {
    var step = direction < 0 ? -1 : 1;
    var q = Math.max(1, parseInt(quantity, 10) || 1);
    var ceiling = Math.max(1, parseInt(limit, 10) || 9999);
    var guard = 0;

    while (q >= 1 && q <= ceiling && guard < 10000) {
      if (packCombinationReachable(table, q)) {
        return q;
      }
      q += step;
      guard += 1;
    }
    return 0;
  }

  function usesFlatUnitPricing(product) {
    return effectivePricingMode(product) === "flat-unit";
  }

  // Packs visíveis no passo da quantidade: são os itens do passo que também
  // têm entrada na tabela de preços ativa. Serve para decidir se vale a pena
  // mostrar a grelha de packs num produto de preço unitário fixo — com um
  // único pack de referência ("1+") não vale, e os produtos antigos ficam
  // exatamente como estavam.
  function packSelectorItemCount(product) {
    var packStep = findStep(product, "pack");
    var priceTable = activePriceTableForPackFilter(product);

    if (!packStep || !Array.isArray(packStep.items)) {
      return 0;
    }

    return packStep.items.filter(function (item) {
      return !priceTable || priceTable[String(Number(item.quantity))] != null;
    }).length;
  }

  function showsPackOptions(product) {
    return !usesFlatUnitPricing(product) || packSelectorItemCount(product) > 1;
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

  // O limite de 150 é comum a todos os produtos com quantidade livre. Não deve
  // depender de o produto usar packs combinados ou escalões por unidade.
  var FREE_QUANTITY_RANGE_MAXIMUM = 150;

  function freeQuantityRangeMaximum(product) {
    var config = quantityPricingSwitchConfig(product);
    var configuredMaximum = Math.max(0, parseInt(config && config.sliderMaximum, 10) || 0);
    var rangeLimit = configuredMaximum || FREE_QUANTITY_RANGE_MAXIMUM;

    return Math.max(
      effectiveMinimumFreeQuantity(product),
      Math.min(maximumFreeQuantity(product), rangeLimit)
    );
  }

  function freeQuantityRangePosition(product, quantity) {
    var minimum = effectiveMinimumFreeQuantity(product);
    var maximum = freeQuantityRangeMaximum(product);
    return Math.max(minimum, Math.min(maximum, Math.round(Number(quantity) || minimum)));
  }

  function freeQuantityFromRangePosition(product, position) {
    var minimum = effectiveMinimumFreeQuantity(product);
    var maximum = freeQuantityRangeMaximum(product);
    return Math.max(minimum, Math.min(maximum, Math.round(Number(position) || minimum)));
  }

  function freeQuantityModeForValue(product, quantity) {
    var table = activePriceTableForPackFilter(product);
    var count = Math.max(0, Math.round(Number(quantity) || 0));
    return count && table && table[String(count)] != null ? "pack" : "custom";
  }

  function isCustomArtworkProduct(product) {
    return !!(product && findStep(product, "artwork_upload"));
  }

  function isCustomArtworkSelected(product) {
    return isCustomArtworkProduct(product) && String(state.selections.order_flow || "") === "custom";
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
      cardAudioKey: String(media.audio && media.audio.selectionKey || "card_audio_uploads"),
      feePerFileCents: Math.max(0, parseInt(product && product.customArtwork && product.customArtwork.feePerFileCents, 10) || parseInt(upload.feePerFileCents, 10) || 0),
      feeTitle: String(product && product.customArtwork && (product.customArtwork.feeTitle || product.customArtwork.feeLabel) || upload.feeTitle || upload.feeLabel || "Preparação do design e testes"),
      feeText: String(product && product.customArtwork && (product.customArtwork.feeText || product.customArtwork.feeDescription) || upload.feeText || upload.feeDescription || "Inclui a preparação do ficheiro e os testes necessários antes da produção."),
      preserveOriginal: upload.preserveOriginal === true || !!(product && product.customArtwork && product.customArtwork.preserveOriginal === true),
      allowPdf: upload.allowPdf === true || !!(product && product.customArtwork && Array.isArray(product.customArtwork.acceptedMimeTypes) && product.customArtwork.acceptedMimeTypes.indexOf("application/pdf") !== -1),
      showQuantity: upload.showQuantity === true || upload.quantityPerFile === true,
      purpose: String(upload.purpose || "custom-artwork")
    };
  }

  function customArtworkItems(product) {
    if (!isCustomArtworkProduct(product)) {
      return [];
    }
    return orderUploadItems(customArtworkConfig(product).uploadKey);
  }

  function customArtworkItemQuantity(item) {
    return Math.max(1, Math.min(9999, parseInt(item && item.quantity, 10) || 1));
  }

  function customArtworkTotalQuantity(product) {
    return customArtworkItems(product).reduce(function (total, item) {
      return total + customArtworkItemQuantity(item);
    }, 0);
  }

  function customArtworkFeeCents(product) {
    var config = customArtworkConfig(product);
    return isCustomArtworkSelected(product) ? config.feePerFileCents * customArtworkItems(product).length : 0;
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

  function effectiveMinimumFreeQuantity(product) {
    var minimum = minimumFreeQuantity(product);
    var table;
    var alcancavel;

    if (isMainCatalogProduct(product)
        && !isCustomArtworkSelected(product)
        && !isAssortedSelected(product)) {
      minimum = Math.max(minimum, selectedDesignItems(product).length);
    }

    // No modo escalão não há quantidades proibidas acima do mínimo, mas abaixo
    // do primeiro escalão não há preço: os finos começam nos 15.
    if (usesTierUnitPricing(product)) {
      var tiers = priceTiers(activePriceTableForPackFilter(product));
      return tiers.length ? Math.max(minimum, tiers[0]) : minimum;
    }

    // Com packs combinados o mínimo tem de ser uma quantidade que os packs
    // consigam somar: nos ímanes achatados o primeiro é 15, não 1.
    table = packCombinationTableFor(product);
    if (table) {
      alcancavel = packCombinationNextReachable(table, minimum, 1, maximumFreeQuantity(product));
      if (alcancavel) {
        minimum = alcancavel;
      }
    }
    return minimum;
  }

  function packCombinationTableFor(product) {
    if (!usesPackCombinationPricing(product)) {
      return null;
    }
    var table = activePriceTableForPackFilter(product);
    return table && Object.keys(table).length ? table : null;
  }

  // Encosta uma quantidade à quantidade alcançável mais próxima, preferindo a
  // direcção em que o utilizador estava a andar.
  function snapQuantityToPacks(product, quantity, direction) {
    var table = packCombinationTableFor(product);
    var minimum = effectiveMinimumFreeQuantity(product);
    var maximum = freeQuantityRangeMaximum(product);
    var pedido = Math.max(minimum, Math.min(maximum, Math.round(Number(quantity) || minimum)));
    var acima;
    var abaixo;

    if (!table || packCombinationReachable(table, pedido)) {
      return pedido;
    }

    acima = packCombinationNextReachable(table, pedido, 1, maximum);
    abaixo = packCombinationNextReachable(table, pedido, -1, maximum);
    if (abaixo && abaixo < minimum) {
      abaixo = 0;
    }

    if (direction < 0) {
      return abaixo || acima || pedido;
    }
    if (direction > 0) {
      return acima || abaixo || pedido;
    }
    if (acima && abaixo) {
      return (pedido - abaixo) <= (acima - pedido) ? abaixo : acima;
    }
    return acima || abaixo || pedido;
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

    // Nos fluxos de quantidade livre, os itens do JSON servem apenas de
    // referência visual/preço-base. A quantidade efetiva pode ser qualquer
    // inteiro válido e, ao escolher vários designs, começa em uma unidade por
    // design. Não escondas por isso a referência "1+".
    if (packStep.freeQuantity === true) {
      return packStep.items || [];
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
    if (isCustomArtworkSelected(product) && !isCadernosProduct(product)) {
      return customArtworkTotalQuantity(product);
    }
    if (freeQuantityStep(product)) {
      return Number.isInteger(pack) && pack >= effectiveMinimumFreeQuantity(product) && pack <= maximumFreeQuantity(product)
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

    if (isCustomArtworkSelected(product)) {
      if (!isCadernosProduct(product)) {
        state.selections.pack_quantity = customArtworkTotalQuantity(product);
      }
      state.selections.design_quantities = {};
      state.quantitySignature = "__custom_artwork__";
      state.quantitiesTouched = false;
      state.quantityPackBaseline = customArtworkTotalQuantity(product);
      return;
    }

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
      if (freeQuantityStep(product)) {
        if (!Number.isInteger(current)
            || current < effectiveMinimumFreeQuantity(product)
            || current > maximumFreeQuantity(product)) {
          current = effectiveMinimumFreeQuantity(product);
        }
      } else if (!current || allowedQuantities.indexOf(current) === -1) {
        current = allowed[0] ? Number(allowed[0].quantity) : 0;
      }
      if (current) {
        state.selections.pack_quantity = current;
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

    if (freeQuantityStep(product)) {
      var minimumForSelectedDesigns = effectiveMinimumFreeQuantity(product);
      var maximumForSelectedDesigns = maximumFreeQuantity(product);
      if (!Number.isInteger(current)
          || current < minimumForSelectedDesigns
          || current > maximumForSelectedDesigns) {
        current = Math.min(maximumForSelectedDesigns, minimumForSelectedDesigns);
        state.selections.pack_quantity = current;
      }
    } else if (!current || allowedQuantities.indexOf(current) === -1) {
      current = allowed[0] ? Number(allowed[0].quantity) : 0;
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
      return {
        smartQuantities: true,
        quantityPricingSwitchVisible: true
      };
    }
    if (!state.pricing.settings) {
      state.pricing.settings = {};
    }
    if (state.pricing.settings.smartQuantities === undefined) {
      state.pricing.settings.smartQuantities = true;
    }
    if (state.pricing.settings.quantityPricingSwitchVisible === undefined) {
      state.pricing.settings.quantityPricingSwitchVisible = true;
    }
    return state.pricing.settings;
  }

  function smartQuantitiesEnabled() {
    return siteSettings().smartQuantities !== false;
  }

  function quantityPricingSwitchEnabled() {
    return siteSettings().quantityPricingSwitchVisible !== false;
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

    // O construtor nao tem tabela de precos propria: escreve-la aqui poluiria
    // o content/pricing.json com um produto que nao existe.
    if (isArtworkBuilderProduct(product)) {
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
    return product.unitLabel || (productFamily(product) === "crachas" ? "crachás" : "unidades");
  }

  function productUnitSingular(product) {
    return product.unitSingular || (productFamily(product) === "crachas" ? "crachá" : "unidade");
  }

  function productQuantityLabel(product, quantity) {
    return Number(quantity) + " " + (Number(quantity) === 1 ? productUnitSingular(product) : productUnit(product));
  }

  function productUnitShort(product) {
    return product.unitShort || (productFamily(product) === "crachas" ? "crachá" : "unid.");
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
        ? (usesSelectedQuantityTierPricing(product, priceKey)
          ? tierPriceCents(table, packQuantity)
          : (usesPackCombinationPricing(product)
          ? packCombinationCents(table, packQuantity, packCombinationPrefersFewerPacks(product, priceKey))
          : (usesFlatUnitPricing(product)
            ? Math.round(baselineUnitCents(table) * packQuantity)
            : (usesLinearDiscountPricing(product)
              ? linearDiscountPriceCents(table, packQuantity)
              : tierPriceCents(table, packQuantity)))))
        : Number(table[String(packQuantity)]))
      : 0;
    var unitCents = baselineUnitCents(table);
    var discount = 0;
    var tierUnitCents = 0;

    if (unitCents && cents && packQuantity && cents < unitCents * packQuantity) {
      // No modo escalão o desconto é o do escalão, e é constante dentro dele.
      // Tirá-lo do total arredondado fazia a percentagem saltar entre 7% e 8%
      // de quantidade para quantidade, quando o desconto real não muda.
      tierUnitCents = (usesTierUnitPricing(product) || usesSelectedQuantityTierPricing(product, priceKey))
        ? tierUnitPriceCents(table, packQuantity)
        : 0;
      discount = tierUnitCents
        ? Math.round((1 - (tierUnitCents / unitCents)) * 100)
        : Math.round((1 - (cents / (unitCents * packQuantity))) * 100);
    }

    var basePriceCents = cents;
    var optionExtraPerUnitCents = optionDrawerExtraPerUnitCents(product);
    var optionExtraCents = optionExtraPerUnitCents * packQuantity;
    var productPriceCents = basePriceCents + optionExtraCents;
    var artworkFeeCents = customArtworkFeeCents(product);
    cents = productPriceCents + artworkFeeCents;

    return {
      size: size,
      quantity: packQuantity,
      cents: cents,
      baseCents: Math.max(0, basePriceCents),
      optionExtraPerUnitCents: optionExtraPerUnitCents,
      optionExtraCents: optionExtraCents,
      customizationFeeCents: artworkFeeCents,
      total: cents ? formatCents(cents) : "",
      perPin: productPriceCents ? formatUnitPrice(productPriceCents, packQuantity, productUnitShort(product)) : "",
      discount: discount
    };
  }

  function priceDisplayName(product, size) {
    if (product && productFamily(product) === "crachas") {
      if (size === "25 mm") {
        return "Crachás Pequenos";
      }

      if (size === "32 mm") {
        return "Crachás Médios";
      }
    }

    if (product && productFamily(product) === "imanes") {
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
    var personalizationCents = cadernoPersonalizationExtraCents(product);
    var addOnsCents = cadernoAddOnsExtraCents(product);
    var orderQuantity = cadernoOrderQuantity(product);
    var unitCents = baseCents + personalizationCents + addOnsCents;
    var customizationFeeCents = customArtworkFeeCents(product);
    var totalCents = unitCents * orderQuantity + customizationFeeCents;

    return {
      size: option ? option.title : "",
      quantity: option ? Number(option.quantity) : 0,
      orderQuantity: option ? orderQuantity : 0,
      cents: totalCents,
      baseCents: baseCents,
      personalizationCents: personalizationCents,
      addOnsCents: addOnsCents,
      customizationFeeCents: customizationFeeCents,
      unitCents: unitCents,
      total: totalCents ? formatCents(totalCents) : "",
      baseTotal: baseCents ? formatCents(baseCents) : "",
      baseSubtotal: baseCents ? multipliedPriceText(baseCents, orderQuantity) : "",
      personalizationTotal: personalizationCents ? formatCents(personalizationCents) : "",
      personalizationSubtotal: personalizationCents ? multipliedPriceText(personalizationCents, orderQuantity) : "",
      addOnsTotal: addOnsCents ? formatCents(addOnsCents) : "",
      addOnsSubtotal: addOnsCents ? multipliedPriceText(addOnsCents, orderQuantity) : "",
      productSubtotal: unitCents ? multipliedPriceText(unitCents, orderQuantity) : "",
      unitTotal: unitCents ? formatCents(unitCents) : "",
      perPin: "",
      discount: 0
    };
  }

  function cadernoPriceEquation(info) {
    var parts;

    if (!info || !info.baseTotal) {
      return "";
    }

    if (info.customizationFeeCents) {
      return "Produtos: " + (info.productSubtotal || info.baseSubtotal || info.baseTotal) + " + Preparação dos designs: " + formatCents(info.customizationFeeCents) + " = " + info.total;
    }

    parts = ["Preço base: " + info.baseTotal];
    if (info.addOnsTotal) {
      parts.push("Add-ons: " + info.addOnsTotal);
    }
    if (info.personalizationTotal) {
      parts.push("Personalização: " + info.personalizationTotal);
    }

    return parts.join(" + ") + (parts.length > 1 ? " = " + info.unitTotal : "");
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

