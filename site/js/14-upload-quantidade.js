// js/14-upload-quantidade.js — parte 14/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: acoes de foto do pedido (renderOrderPhotoAction, renderPhotoUploadStep), donorFor, descontos de pack, grafico de preco por quantidade, renderQuantityBuilder.
  function renderOrderPhotoAction(config, options) {
    var settings = options || {};
    var key = config.selectionKey || "quadro_uploads";
    var items = orderUploadItems(key);
    var multiple = config.multiple === true;
    var maxFiles = orderUploadMaxFiles(config);
    var helpDisabled = !!settings.helpDisabled;
    var disabled = state.orderUploadBusy || helpDisabled || items.length >= maxFiles;
    var maxAttribute = isFinite(maxFiles) ? maxFiles : 0;
    var buttonLabel = String(config.buttonLabel || "Escolher foto");
    var artworkMode = String(config.purpose || "") === "custom-artwork" || config.allowPdf === true;
    var accept = artworkMode
      ? "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf"
      : "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
    if (buttonLabel === "Enviar foto") {
      buttonLabel = "Escolher foto";
    }
    if (items.length && config.uploadedButtonLabel) {
      buttonLabel = String(config.uploadedButtonLabel);
    }
    var helperText = config.hideHelperText === true
      ? ""
      : orderUploadHelperText(config, artworkMode, multiple, maxFiles, items.length);

    return [
      '<label class="order-upload-button' + (settings.compact ? ' order-media-action' : '') + (disabled ? ' is-disabled' : '') + '">',
      '<input type="file" accept="' + accept + '"' + (multiple ? ' multiple' : '') + ' data-order-upload data-order-upload-key="' + escapeHtml(key) + '" data-order-upload-max="' + maxAttribute + '"' + (disabled ? ' disabled' : '') + '>',
      '<span class="order-upload-button-icon">' + (settings.compact ? ICON_PHOTO : ICON_UPLOAD) + '</span>',
      '<strong>' + escapeHtml(buttonLabel) + '</strong>',
      helperText ? '<small' + (items.length ? ' class="is-success"' : '') + '>' + escapeHtml(helperText) + '</small>' : '',
      '</label>'
    ].join("");
  }

  function renderOrderPhotoControl(config, options) {
    var settings = options || {};
    var kind = String(config.purpose || "") === "custom-artwork" ? "artwork" : "photo";
    var uploadList = renderOrderUploadList(config, kind);

    return [
      '<div class="order-photo-control">',
      renderOrderPhotoAction(config, settings),
      uploadList ? '<ul class="order-upload-list">' + uploadList + '</ul>' : '',
      settings.showStatus ? renderOrderUploadStatus(kind) : '',
      '</div>'
    ].join("");
  }

  function renderOrderAudioAction(config, options) {
    var settings = options || {};
    var key = config.selectionKey || "quadro_audio_uploads";
    var disabled = state.orderUploadBusy || !(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    var title = state.orderAudioRecording ? "A gravar…" : String(config.buttonLabel || "Áudio");
    var helperText = state.orderAudioRecording ? "Solta para anexar" : String(config.helperText || "Mantém premido para falar");

    return [
      '<button type="button" class="order-audio-record-button' + (settings.compact ? ' order-media-action' : '') + (state.orderAudioRecording ? ' is-recording' : '') + '" data-order-audio-record data-order-audio-key="' + escapeHtml(key) + '" aria-label="' + escapeHtml(title + ". " + helperText) + '"' + (disabled ? ' disabled' : '') + '>',
      '<span class="order-audio-record-icon">' + ICON_MICROPHONE + '</span>',
      '<span><strong>' + escapeHtml(title) + '</strong><small>' + escapeHtml(helperText) + '</small></span>',
      '</button>'
    ].join("");
  }

  function renderOrderAudioControl(config) {
    var uploadList = renderOrderUploadList(config, "audio");

    return [
      '<div class="order-audio-control">',
      renderOrderAudioAction(config),
      uploadList ? '<ul class="order-upload-list order-audio-list">' + uploadList + '</ul>' : '',
      renderOrderUploadStatus("audio"),
      '</div>'
    ].join("");
  }

  function renderOrderMediaAttachments(config) {
    var photos = config && config.photos ? config.photos : null;
    var audio = config && config.audio ? config.audio : null;
    var photoList = photos ? renderOrderUploadList(photos, "photo") : "";
    var audioList = audio ? renderOrderUploadList(audio, "audio") : "";

    if (!photos && !audio) {
      return "";
    }

    return [
      '<div class="order-media-attachments">',
      '<div class="order-media-action-bar">',
      audio ? renderOrderAudioAction(audio, { compact: true }) : '',
      photos ? renderOrderPhotoAction(photos, { compact: true }) : '',
      '</div>',
      audioList ? '<ul class="order-upload-list order-audio-list order-media-upload-list">' + audioList + '</ul>' : '',
      photoList ? '<ul class="order-upload-list order-media-upload-list">' + photoList + '</ul>' : '',
      renderOrderUploadStatus(),
      '</div>'
    ].join("");
  }

  function renderPhotoUploadStep(step) {
    var config = step.upload || {};
    var hasUploads = orderUploadItems(config.selectionKey || "quadro_uploads").length > 0;
    // Com foto enviada o pedido de ajuda deixa de fazer sentido: escondemos a
    // opção (e a mensagem) para não aparecerem os dois no passo nem no resumo.
    var helpSelected = !!(config.helpKey && state.selections[config.helpKey] && !hasUploads);

    return [
      '<section class="order-photo-upload">',
      renderOrderPhotoControl(config, { helpDisabled: helpSelected }),
      renderOrderUploadStatus("photo"),
      config.helpKey && !hasUploads ? [
        '<label class="photo-help-choice">',
        '<input type="checkbox" data-photo-help-key="' + escapeHtml(config.helpKey) + '"' + (state.selections[config.helpKey] ? ' checked' : '') + '>',
        '<span>' + escapeHtml(config.helpLabel || "Preciso de ajuda para enviar a foto") + '</span>',
        '</label>',
        helpSelected ? '<p class="photo-help-message">Podes carregar em continuar, e depois ajudamos-te a enviar uma foto</p>' : ''
      ].join("") : '',
      '</section>'
    ].join("");
  }

  function renderOriginalArtworkUploadStep(product, step) {
    var config = Object.assign({}, step && step.upload || {}, customArtworkConfig(product));
    var items = orderUploadItems(config.uploadKey || config.selectionKey);
    var feeTotal = config.feePerFileCents * items.length;
    // No construtor a quantidade e a taxa pertencem a cada linha do passo 2
    // (uma imagem pode ir para varios produtos), por isso aqui so se enviam
    // os ficheiros.
    var builder = isArtworkBuilderProduct(product);

    config.selectionKey = config.uploadKey || config.selectionKey;
    config.multiple = true;
    config.maxFiles = Math.min(10, Math.max(1, parseInt(config.maxFiles, 10) || 10));
    config.allowPdf = true;
    config.preserveOriginal = true;
    config.showQuantity = !builder;
    config.purpose = "custom-artwork";
    if (builder) {
      // No construtor a taxa e por produto (passo 2), nunca por imagem.
      config.feePerFileCents = 0;
      config.hideFee = true;
    }

    return [
      '<section class="order-photo-upload original-artwork-upload">',
      builder ? '' : '<div class="original-artwork-note"><strong>O ficheiro segue tal como o envias.</strong><p>Aceitamos imagens e PDF até 30 MB por ficheiro, sem compressão nem conversão. Podes carregar vários designs e indicar uma quantidade diferente para cada um.</p></div>',
      renderOrderPhotoControl(config, { showStatus: true }),
      !builder && items.length ? '<p class="original-artwork-fee-total"><strong>Preparação e testes:</strong> ' + items.length + (items.length === 1 ? ' imagem × ' : ' imagens × ') + escapeHtml(formatCents(config.feePerFileCents)) + ' = <strong>' + escapeHtml(formatCents(feeTotal)) + '</strong></p>' : '',
      '</section>'
    ].join("");
  }

  // ==== PERSONALIZACAO_BUILDER_V1 ==========================================
  // personalizacao.html e o flow de quem traz o seu proprio artwork. O passo 1
  // envia os ficheiros; o passo 2 monta linhas (design x produto x opcoes x
  // quantidade). Cada linha entra no carrinho como uma linha normal do slug de
  // destino com order_flow=custom, por isso quem manda no preco continua a ser
  // o send-order.php — aqui so se repete o mesmo calculo para o cliente ver.
  // Consequencia: qualquer alteracao a pack-combination / tier-unit / flat-unit
  // tem de ser feita nos dois sitios, tal como ja acontece nos outros produtos.

  function isArtworkBuilderProduct(product) {
    return !!(product && product.artworkBuilder === true);
  }

  function builderStep(product) {
    return product ? findStep(product, "custom_products") : null;
  }

  function builderCatalog(product) {
    var step = builderStep(product);
    return step && Array.isArray(step.products) ? step.products : [];
  }

  function builderFinishOptions(product) {
    var step = builderStep(product);
    return step && Array.isArray(step.finishes) ? step.finishes : [];
  }

  function builderFinishOption(product, value) {
    return builderFinishOptions(product).filter(function (finish) {
      return finish && String(finish.value) === String(value);
    })[0] || null;
  }

  function builderEntry(product, id) {
    return builderCatalog(product).filter(function (entry) {
      return entry && String(entry.id) === String(id || "");
    })[0] || null;
  }

  function builderEntryChoices(entry) {
    return entry && Array.isArray(entry.choices) ? entry.choices : [];
  }

  function builderPriceKeyChoice(entry) {
    return builderEntryChoices(entry).filter(function (choice) {
      return choice && choice.isPriceKey === true;
    })[0] || null;
  }

  function builderUploads(product) {
    return orderUploadItems(customArtworkConfig(product).uploadKey);
  }

  function builderUpload(product, token) {
    return builderUploads(product).filter(function (item) {
      return String(item.token) === String(token || "");
    })[0] || null;
  }

  function builderUploadIsPdf(upload) {
    return String(upload && upload.mime || "").toLowerCase() === "application/pdf"
      || /\.pdf$/i.test(String(upload && upload.name || ""));
  }

  function builderLines(product) {
    if (!Array.isArray(state.selections.builder_lines)) {
      state.selections.builder_lines = [];
    }
    return state.selections.builder_lines;
  }

  function builderLine(product, id) {
    return builderLines(product).filter(function (line) {
      return line && String(line.id) === String(id || "");
    })[0] || null;
  }

  function builderPricing(entry) {
    var products = state.pricing && state.pricing.products ? state.pricing.products : {};
    return entry && entry.slug && products[entry.slug] ? products[entry.slug] : null;
  }

  function builderPriceKey(product, line) {
    var entry = builderEntry(product, line && line.productId);
    var choice = builderPriceKeyChoice(entry);
    var record;

    if (!entry) {
      return "";
    }
    if (entry.size) {
      return String(entry.size);
    }
    if (choice) {
      return String((line && line.choices && line.choices[choice.field]) || "");
    }
    record = builderPricing(entry);
    return record && record.defaultPriceKey ? String(record.defaultPriceKey) : "";
  }

  function builderPricingMode(entry, priceKey) {
    var record = builderPricing(entry);
    var byKey = record && record.pricingModeByPriceKey ? record.pricingModeByPriceKey : null;

    if (byKey && priceKey && byKey[priceKey]) {
      return String(byKey[priceKey]);
    }
    return record && record.pricingMode ? String(record.pricingMode) : "";
  }

  function builderPriceTable(entry, priceKey) {
    var record = builderPricing(entry);
    return record && record.prices && record.prices[priceKey] ? record.prices[priceKey] : null;
  }

  // Espelha product_flat_unit_price_cents(): primeiro a tabela de unitarios,
  // so depois o preco de 1 unidade da tabela de packs.
  function builderFlatUnitCents(entry, priceKey) {
    var record = builderPricing(entry);
    var flat = record && record.flatUnitPricesCents ? record.flatUnitPricesCents : null;
    var table;

    if (flat && flat[priceKey] != null) {
      return Math.max(0, parseInt(flat[priceKey], 10) || 0);
    }
    table = builderPriceTable(entry, priceKey);
    return table && table["1"] != null ? Math.max(0, parseInt(table["1"], 10) || 0) : 0;
  }

  function builderQuantity(line) {
    return Math.max(0, Math.min(9999, parseInt(line && line.quantity, 10) || 0));
  }

  function builderMinimumQuantity(product, line) {
    var entry = builderEntry(product, line && line.productId);
    var priceKey = builderPriceKey(product, line);
    var record = builderPricing(entry);
    var mode = builderPricingMode(entry, priceKey);
    var table = builderPriceTable(entry, priceKey) || {};
    var minimum = Math.max(1, parseInt(record && record.minimumQuantity, 10) || 1);
    var tiers;
    var packs;

    if (mode === "tier-unit") {
      tiers = priceTiers(table);
      return tiers.length ? Math.max(minimum, tiers[0]) : minimum;
    }
    if (mode === "pack-combination") {
      packs = packCombinationTablePacks(table);
      return packs.length ? packs[0].quantity : minimum;
    }
    return minimum;
  }

  function builderQuantityOptions(product, line) {
    var entry = builderEntry(product, line && line.productId);
    var table = builderPriceTable(entry, builderPriceKey(product, line)) || {};

    return Object.keys(table).map(function (key) {
      return parseInt(key, 10) || 0;
    }).filter(function (quantity) {
      return quantity > 0;
    }).sort(function (a, b) {
      return a - b;
    });
  }

  function builderQuantityIsValid(product, line) {
    var entry = builderEntry(product, line && line.productId);
    var priceKey = builderPriceKey(product, line);
    var quantity = builderQuantity(line);

    if (!entry || quantity < builderMinimumQuantity(product, line) || quantity > 9999) {
      return false;
    }
    if (entry.quoteOnly === true) {
      return true;
    }
    if (builderPricingMode(entry, priceKey) === "pack-combination") {
      return packCombinationPlan(builderPriceTable(entry, priceKey), quantity) !== null;
    }
    return true;
  }

  function builderLineBaseCents(product, line) {
    var entry = builderEntry(product, line && line.productId);
    var priceKey = builderPriceKey(product, line);
    var mode = builderPricingMode(entry, priceKey);
    var table = builderPriceTable(entry, priceKey);
    var quantity = builderQuantity(line);
    var plan;

    if (!entry || entry.quoteOnly === true || !quantity || !priceKey) {
      return 0;
    }
    if (mode === "pack-combination") {
      plan = packCombinationPlan(table, quantity);
      return plan ? plan.cents : 0;
    }
    if (mode === "tier-unit") {
      return tierPriceCents(table, quantity);
    }
    return builderFlatUnitCents(entry, priceKey) * quantity;
  }

  function builderLineFinishes(product, line) {
    var entry = builderEntry(product, line && line.productId);
    var allowed = entry && Array.isArray(entry.finishes) ? entry.finishes : [];

    return (line && Array.isArray(line.finishes) ? line.finishes : []).filter(function (value) {
      return allowed.indexOf(value) !== -1;
    });
  }

  function builderFinishExtraPerUnitCents(product, line) {
    return builderLineFinishes(product, line).reduce(function (total, value) {
      var finish = builderFinishOption(product, value);
      return total + (finish ? Math.max(0, parseInt(finish.extraPriceCentsPerUnit, 10) || 0) : 0);
    }, 0);
  }

  function builderFeeCents(product) {
    return Math.max(0, parseInt(customArtworkConfig(product).feePerFileCents, 10) || 0);
  }

  function builderLineTotalCents(product, line) {
    var entry = builderEntry(product, line && line.productId);

    if (!entry || entry.quoteOnly === true || !builderQuantityIsValid(product, line)) {
      return 0;
    }
    return builderLineBaseCents(product, line)
      + builderFinishExtraPerUnitCents(product, line) * builderQuantity(line)
      + builderFeeCents(product);
  }

  function builderTotalCents(product) {
    return builderLines(product).reduce(function (total, line) {
      return total + builderLineTotalCents(product, line);
    }, 0);
  }

  function builderAdjustmentTotalCents(product) {
    return builderLines(product).length * builderFeeCents(product);
  }

  function builderHasQuoteOnly(product) {
    return builderLines(product).some(function (line) {
      var entry = builderEntry(product, line && line.productId);
      return !!(entry && entry.quoteOnly === true);
    });
  }

  function builderUnitLabel(product, line, quantity) {
    var entry = builderEntry(product, line && line.productId);
    var record = builderPricing(entry);
    var count = Math.max(0, parseInt(quantity, 10) || 0);
    var singular = record && record.unitSingular ? String(record.unitSingular) : "unidade";
    var plural = record && record.unitLabel ? String(record.unitLabel) : "unidades";

    return count + " " + (count === 1 ? singular : plural);
  }

  // Devolve o marcador de pack quando a escolha que define a tabela de precos
  // traz um `quantity` proprio (opcoes de compra dos cadernos). 0 quando nao ha.
  function builderPackQuantityMarker(product, line) {
    var entry = builderEntry(product, line && line.productId);
    var choice = builderPriceKeyChoice(entry);
    var value = choice ? String((line.choices && line.choices[choice.field]) || "") : "";
    var item = choice && Array.isArray(choice.items) ? choice.items.filter(function (candidate) {
      return String(candidate.value) === value;
    })[0] : null;

    return item ? Math.max(0, parseInt(item.quantity, 10) || 0) : 0;
  }

  // FINISH_GROUPS_V1: um grupo de acabamentos e uma escolha obrigatoria, por
  // isso a linha nasce com a primeira opcao de cada grupo ja marcada — e a capa
  // mole, que nao acrescenta nada ao preco.
  function builderDefaultFinishes(product, entry) {
    var allowed = entry && Array.isArray(entry.finishes) ? entry.finishes : [];
    var vistos = [];
    var defaults = [];

    allowed.forEach(function (value) {
      var finish = builderFinishOption(product, value);
      var grupo = finish && finish.group ? String(finish.group) : "";

      if (!grupo || vistos.indexOf(grupo) !== -1) {
        return;
      }
      vistos.push(grupo);
      defaults.push(value);
    });
    return defaults;
  }

  function builderApplyProduct(product, line, productId) {
    var entry = builderEntry(product, productId);

    line.productId = entry ? String(entry.id) : "";
    line.choices = {};
    line.finishes = builderDefaultFinishes(product, entry);
    builderEntryChoices(entry).forEach(function (choice) {
      var first = choice && Array.isArray(choice.items) ? choice.items[0] : null;
      if (choice && choice.required === true && first) {
        line.choices[choice.field] = String(first.value);
      }
    });
    line.quantity = builderMinimumQuantity(product, line);
  }

  function builderCreateLine(product, designToken, productId) {
    var line = {
      id: "bl_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7),
      designToken: String(designToken || ""),
      productId: "",
      choices: {},
      finishes: [],
      quantity: 0
    };

    builderApplyProduct(product, line, productId);
    return line;
  }

  // ==== PERSONALIZACAO_BUILDER_V2 ==========================================
  // O passo 2 deixou de ser "adiciona uma linha de cada vez": agora e uma
  // matriz imagem x produto. Marcar um produto numa imagem cria a linha,
  // desmarcar apaga-a. O passo 3 pega nessas linhas e so pergunta as
  // quantidades (e as opcoes que mudam o preco). A estrutura da linha nao
  // mudou, por isso builderCartItem / send-order.php continuam iguais.

  function builderLineFor(product, designToken, productId) {
    return builderLines(product).filter(function (line) {
      return line
        && String(line.designToken) === String(designToken || "")
        && String(line.productId) === String(productId || "");
    })[0] || null;
  }

  function builderIsSelected(product, designToken, productId) {
    return !!builderLineFor(product, designToken, productId);
  }

  function builderToggleSelection(product, designToken, productId, on) {
    var existing = builderLineFor(product, designToken, productId);

    if (on && !existing) {
      builderLines(product).push(builderCreateLine(product, designToken, productId));
      return;
    }
    if (!on && existing) {
      state.selections.builder_lines = builderLines(product).filter(function (line) {
        return line !== existing;
      });
    }
  }

  // Os grupos vem do JSON (entry.group) e mantem a ordem do catalogo: cada um
  // vira uma gaveta com os seus tamanhos/variantes.
  function builderGroups(product) {
    var order = [];
    var byName = {};

    builderCatalog(product).forEach(function (entry) {
      var name = String(entry.group || "Produtos");
      if (!byName[name]) {
        byName[name] = { name: name, entries: [], image: "", imageShape: "rect" };
        order.push(name);
      }
      byName[name].entries.push(entry);
      if (!byName[name].image && entry.image) {
        byName[name].image = String(entry.image);
        byName[name].imageShape = String(entry.imageShape || "rect");
      }
    });

    return order.map(function (name) {
      return byName[name];
    });
  }

  function builderGroupSelectedEntries(product, designToken, group) {
    return group.entries.filter(function (entry) {
      return builderIsSelected(product, designToken, entry.id);
    });
  }

  function builderGroupKey(designToken, groupName) {
    return String(designToken || "") + "::" + String(groupName || "");
  }

  function builderGroupIsOpen(product, designToken, group) {
    var key = builderGroupKey(designToken, group.name);

    if (!state.builderOpenGroups || typeof state.builderOpenGroups !== "object") {
      state.builderOpenGroups = {};
    }
    if (Object.prototype.hasOwnProperty.call(state.builderOpenGroups, key)) {
      return state.builderOpenGroups[key] === true;
    }
    // PERSONALIZACAO_DE_ONDE_VIM_V1: quem chegou aqui pelo link de um produto
    // encontra a gaveta desse produto ja aberta, em vez de ter de a procurar.
    if (group.name === builderGrupoDeOrigem(product)) {
      return true;
    }

    // Sem decisao da pessoa, a gaveta fica aberta se ja la houver escolhas:
    // assim nada do que escolheu desaparece de vista ao voltar ao passo.
    return builderGroupSelectedEntries(product, designToken, group).length > 0;
  }

  // Qual o grupo do passo 2 que corresponde ao produto de onde a pessoa veio.
  // O slug chega no `?de=` do link; o grupo e o do primeiro item do catalogo
  // que aponte para esse produto.
  var builderGrupoOrigemCache;

  function builderGrupoDeOrigem(product) {
    if (builderGrupoOrigemCache !== undefined) {
      return builderGrupoOrigemCache;
    }

    var slug = "";
    try {
      slug = new URLSearchParams(window.location.search).get("de") || "";
    } catch (erro) {
      slug = "";
    }

    builderGrupoOrigemCache = "";
    if (slug) {
      var entrada = builderCatalog(product).filter(function (e) {
        return e && String(e.slug) === slug;
      })[0];
      if (entrada && entrada.group) {
        builderGrupoOrigemCache = String(entrada.group);
      }
    }
    return builderGrupoOrigemCache;
  }

  // Linhas de uma imagem, pela ordem do catalogo (e nao pela ordem em que
  // foram marcadas), para o passo 3 ficar sempre igual ao passo 2.
  function builderLinesForDesign(product, designToken) {
    var lines = builderLines(product);

    return builderCatalog(product).map(function (entry) {
      return lines.filter(function (line) {
        return line
          && String(line.designToken) === String(designToken || "")
          && String(line.productId) === String(entry.id);
      })[0] || null;
    }).filter(Boolean);
  }

  function builderRenderUploadMedia(upload, className) {
    if (builderUploadIsPdf(upload)) {
      return '<span class="' + className + ' is-pdf" aria-hidden="true">PDF</span>';
    }
    return '<span class="' + className + '" style="background-image:url(&quot;' + escapeHtml(orderUploadPreviewUrl(upload)) + '&quot;)" role="img" aria-label="' + escapeHtml(upload.name || "Design") + '"></span>';
  }

  function builderRenderEntryMedia(entry, className) {
    var extra = entry && entry.imageShape === "round" ? " is-round" : "";

    if (!entry || !entry.image) {
      return '<span class="' + className + extra + ' is-blank" aria-hidden="true"></span>';
    }
    return '<span class="' + className + extra + '" style="background-image:url(&quot;' + escapeHtml(entry.image) + '&quot;)" aria-hidden="true"></span>';
  }

  function builderRenderGroup(product, upload, group) {
    var token = String(upload.token);
    var selected = builderGroupSelectedEntries(product, token, group);
    var open = builderGroupIsOpen(product, token, group);
    var single = group.entries.length === 1;

    if (single) {
      // Um grupo com uma unica variante nao precisa de gaveta: o proprio
      // cartao e a escolha.
      return builderRenderVariant(product, token, group.entries[0], "builder-group-tile");
    }

    return [
      '<div class="builder-group' + (selected.length ? ' has-selection' : '') + (open ? ' is-open' : '') + '">',
      '<button type="button" class="builder-group-tile" data-builder-group="' + escapeHtml(group.name) + '" data-builder-design-token="' + escapeHtml(token) + '" aria-expanded="' + (open ? 'true' : 'false') + '">',
      builderRenderEntryMedia({ image: group.image, imageShape: group.imageShape }, "builder-tile-media"),
      '<span class="builder-tile-copy"><strong>' + escapeHtml(group.name) + '</strong></span>',
      '<span class="builder-group-chevron" aria-hidden="true"></span>',
      '</button>',
      open ? '<div class="builder-group-drawer">' + group.entries.map(function (entry) {
        return builderRenderVariant(product, token, entry, "builder-variant");
      }).join("") + '</div>' : "",
      '</div>'
    ].join("");
  }

  function builderRenderVariant(product, token, entry, className) {
    var checked = builderIsSelected(product, token, entry.id);
    var fee = builderFeeCents(product);

    return [
      '<label class="' + className + (checked ? ' is-selected' : '') + '">',
      '<input type="checkbox" data-builder-select data-builder-design-token="' + escapeHtml(token) + '" value="' + escapeHtml(entry.id) + '"' + (checked ? ' checked' : '') + '>',
      builderRenderEntryMedia(entry, "builder-tile-media"),
      '<span class="builder-tile-copy"><strong>' + escapeHtml(entry.title) + '</strong>' + (entry.subtitle ? '<small>' + escapeHtml(entry.subtitle) + '</small>' : "") + '</span>',
      // A taxa de ajuste e o unico preco que ja se sabe neste passo (o resto
      // depende da quantidade): fica a vista para nao aparecer so no fim.
      fee ? '<span class="builder-variant-price"><strong>+ ' + escapeHtml(formatCents(fee)) + '</strong><small>Para ajustes e testes de impressão</small></span>' : "",
      '</label>'
    ].join("");
  }

  // As imagens sao tratadas pela ordem em que foram enviadas: e assim que
  // aparecem no ecra e e assim que se fala delas nos avisos.
  var BUILDER_ORDINALS = [
    "primeira", "segunda", "terceira", "quarta", "quinta",
    "sexta", "sétima", "oitava", "nona", "décima"
  ];

  function builderDesignOrdinal(index) {
    return BUILDER_ORDINALS[index] || (index + 1) + ".ª";
  }

  function builderDesignTitle(index) {
    var ordinal = builderDesignOrdinal(index);
    return ordinal.charAt(0).toUpperCase() + ordinal.slice(1) + " imagem";
  }

  function builderRenderDesignPicker(product, upload, index) {
    return [
      '<article class="builder-design-block" data-builder-design-block="' + escapeHtml(upload.token) + '">',
      '<h3 class="section-title">' + escapeHtml(builderDesignTitle(index)) + '</h3>',
      '<div class="builder-design-figure">' + builderRenderUploadMedia(upload, "builder-design-preview") + '</div>',
      '<div class="builder-group-list">',
      builderGroups(product).map(function (group) {
        return builderRenderGroup(product, upload, group);
      }).join(""),
      '</div>',
      '</article>'
    ].join("");
  }

  // A mesma caixa "O que vais encomendar" dos crachas e das molduras: um tile
  // por linha, com a imagem de origem, para se ver o pedido a crescer sem ter
  // de percorrer os cartoes todos.
  function builderRenderOrderSummary(product, options) {
    var settings = options || {};
    var tiles = "";

    builderUploads(product).forEach(function (upload) {
      builderLinesForDesign(product, upload.token).forEach(function (line) {
        var entry = builderEntry(product, line.productId);

        tiles += [
          '<article class="crachas-step2-summary-tile builder-summary-tile">',
          builderRenderUploadMedia(upload, "builder-summary-thumb"),
          '<span class="crachas-step2-summary-tile-name">' + escapeHtml(entry.title) + '</span>',
          settings.withQuantity ? '<span class="builder-summary-qty">' + escapeHtml(builderUnitLabel(product, line, builderQuantity(line))) + '</span>' : "",
          '</article>'
        ].join("");
      });
    });

    if (!tiles) {
      return "";
    }

    return [
      '<section class="crachas-step2-summary builder-summary" aria-label="O que vais encomendar">',
      '<h3 class="crachas-step2-summary-title">O que vais encomendar:</h3>',
      '<div class="crachas-step2-summary-grid">' + tiles + '</div>',
      '</section>'
    ].join("");
  }

  function builderRenderChoiceFields(product, line) {
    var entry = builderEntry(product, line.productId);

    return builderEntryChoices(entry).map(function (choice) {
      var selected = String((line.choices && line.choices[choice.field]) || "");

      return [
        '<div class="builder-field">',
        '<span class="builder-field-label">' + escapeHtml(choice.label || choice.field) + '</span>',
        '<div class="builder-option-grid">',
        (Array.isArray(choice.items) ? choice.items : []).map(function (item) {
          var checked = selected === String(item.value);
          return [
            '<label class="builder-option-choice' + (checked ? ' is-selected' : '') + '">',
            '<input type="radio" name="builder-choice-' + escapeHtml(line.id) + '-' + escapeHtml(choice.field) + '" value="' + escapeHtml(item.value) + '" data-builder-choice="' + escapeHtml(choice.field) + '" data-builder-line="' + escapeHtml(line.id) + '"' + (checked ? ' checked' : '') + '>',
            '<span><strong>' + escapeHtml(item.title) + '</strong>' + (item.subtitle ? '<small>' + escapeHtml(item.subtitle) + '</small>' : "") + '</span>',
            '</label>'
          ].join("");
        }).join(""),
        '</div>',
        '</div>'
      ].join("");
    }).join("");
  }

  function builderRenderFinishChoice(product, line, value, chosen, grouped) {
    var finish = builderFinishOption(product, value);
    var extra = finish ? Math.max(0, parseInt(finish.extraPriceCentsPerUnit, 10) || 0) : 0;
    var checked = chosen.indexOf(value) !== -1;
    var detail;

    if (!finish) {
      return "";
    }
    // Num grupo exclusivo a opcao sem acrescimo tambem precisa de dizer alguma
    // coisa: senao a capa mole ficava sem legenda ao lado da dura com preco.
    detail = extra
      ? '<small>+' + escapeHtml(formatCents(extra)) + ' por unidade</small>'
      : (grouped ? '<small>Incluído no preço</small>' : "");

    return [
      '<label class="builder-finish-choice' + (checked ? ' is-selected' : '') + '">',
      '<input type="' + (grouped ? 'radio' : 'checkbox') + '"' + (grouped ? ' name="builder-finish-' + escapeHtml(line.id) + '-' + escapeHtml(finish.group) + '"' : '') + ' value="' + escapeHtml(value) + '" data-builder-finish data-builder-line="' + escapeHtml(line.id) + '"' + (checked ? ' checked' : '') + '>',
      '<span><strong>' + escapeHtml(finish.title || value) + '</strong>' + detail + '</span>',
      '</label>'
    ].join("");
  }

  function builderRenderFinishField(product, line) {
    var entry = builderEntry(product, line.productId);
    var allowed = entry && Array.isArray(entry.finishes) ? entry.finishes : [];
    var chosen = builderLineFinishes(product, line);
    var soltos = [];
    var grupos = [];
    var html = "";

    if (!allowed.length) {
      return "";
    }

    // FINISH_GROUPS_V1: acabamentos com `group` sao alternativas entre si
    // (capa mole ou dura), por isso saem em radios e num campo proprio; os
    // restantes continuam a ser caixas que se acumulam.
    allowed.forEach(function (value) {
      var finish = builderFinishOption(product, value);
      var grupo = finish && finish.group ? String(finish.group) : "";
      var registado;

      if (!finish) {
        return;
      }
      if (!grupo) {
        soltos.push(value);
        return;
      }
      registado = grupos.filter(function (candidato) {
        return candidato.id === grupo;
      })[0];
      if (!registado) {
        registado = { id: grupo, label: finish.groupLabel || finish.group, values: [] };
        grupos.push(registado);
      }
      registado.values.push(value);
    });

    grupos.forEach(function (grupo) {
      html += [
        '<div class="builder-field">',
        '<span class="builder-field-label">' + escapeHtml(grupo.label) + '</span>',
        '<div class="builder-finish-list">',
        grupo.values.map(function (value) {
          return builderRenderFinishChoice(product, line, value, chosen, true);
        }).join(""),
        '</div>',
        '</div>'
      ].join("");
    });

    if (soltos.length) {
      html += [
        '<div class="builder-field">',
        '<span class="builder-field-label">Acabamento</span>',
        '<div class="builder-finish-list">',
        soltos.map(function (value) {
          return builderRenderFinishChoice(product, line, value, chosen, false);
        }).join(""),
        '</div>',
        '</div>'
      ].join("");
    }

    return html;
  }

  // O titulo do passo 3 diz o que a pessoa escolheu no passo 2: com um produto
  // so, chama-o pelo nome; com varios, fala deles em geral.
  function builderQuantityStepTitle(product) {
    var lines = builderLines(product);
    var entry = lines.length === 1 ? builderEntry(product, lines[0].productId) : null;
    var record;

    if (!entry) {
      return "Diz-me quantas unidades queres de cada produto";
    }
    // O plural do produto e nao o nome da variante: ha nomes no singular
    // ("Bloco Argolas A6") que dariam "quantos Bloco Argolas A6 queres". Assim
    // a frase fica igual a das paginas do catalogo, e o cartao logo por baixo
    // diz qual e a variante.
    record = builderPricing(entry);
    return "Diz-me quantos " + (record && record.unitLabel ? String(record.unitLabel) : "produtos") + " queres";
  }

  // Desconto face ao preco de uma unidade, pela mesma conta do priceForSize()
  // dos outros produtos: no modo escalao vale o unitario do escalao, senao a
  // diferenca entre o total e o preco unitario vezes a quantidade.
  function builderDiscountPercent(product, line) {
    var entry = builderEntry(product, line && line.productId);
    var priceKey = builderPriceKey(product, line);
    var table = builderPriceTable(entry, priceKey);
    var quantity = builderQuantity(line);
    var base = builderLineBaseCents(product, line);
    var unitCents = baselineUnitCents(table);
    var tierUnit;

    if (!unitCents || !base || !quantity || base >= unitCents * quantity) {
      return 0;
    }
    tierUnit = builderPricingMode(entry, priceKey) === "tier-unit"
      ? tierUnitPriceCents(table, quantity)
      : 0;
    return tierUnit
      ? Math.round((1 - (tierUnit / unitCents)) * 100)
      : Math.round((1 - (base / (unitCents * quantity))) * 100);
  }

  // Limite do slider: o maior pack da tabela, ou o que o produto configurar
  // para o slider, para nao ficar preso no ultimo escalao.
  function builderRangeMaximum(product, line) {
    var entry = builderEntry(product, line && line.productId);
    var record = builderPricing(entry);
    var priceKey = builderPriceKey(product, line);
    var config = record && record.quantityPricingSwitchByPriceKey && record.quantityPricingSwitchByPriceKey[priceKey];
    var configurado = Math.max(0, parseInt(config && config.sliderMaximum, 10) || 0);
    var opcoes = builderQuantityOptions(product, line);
    var maiorPack = opcoes.length ? opcoes[opcoes.length - 1] : 0;

    return Math.max(builderMinimumQuantity(product, line), configurado || maiorPack || 100);
  }

  function builderRenderQuantityField(product, line) {
    var options = builderQuantityOptions(product, line);
    var minimum = builderMinimumQuantity(product, line);
    var quantity = builderQuantity(line);

    var entry = builderEntry(product, line.productId);
    var record = builderPricing(entry);
    var hasProductOptions = builderEntryChoices(entry).length > 0
      || (entry && Array.isArray(entry.finishes) && entry.finishes.length > 0);
    var singular = record && record.unitSingular ? String(record.unitSingular) : "unidade";
    var plural = record && record.unitLabel ? String(record.unitLabel) : "unidades";
    var maximo = builderRangeMaximum(product, line);
    var posicao = Math.max(minimum, Math.min(maximo, quantity));
    var progresso = maximo > minimum ? ((posicao - minimum) / (maximo - minimum) * 100).toFixed(2) : "0";

    // Mesmo desenho dos outros produtos: .pack-option para os packs e
    // .free-quantity-builder para a quantidade livre. Muda so a origem dos
    // dados, que aqui e a linha e nao o produto inteiro.
    return [
      '<div class="builder-field">',
      hasProductOptions ? '<span class="builder-field-label">Quantidade</span>' : "",
      options.length ? [
        '<div class="pack-control">',
        '<div class="pack-options">',
        options.map(function (value) {
          return [
            '<button class="pack-option' + (value === quantity ? ' is-selected' : '') + '" type="button" data-builder-quantity="' + value + '" data-builder-line="' + escapeHtml(line.id) + '" aria-pressed="' + (value === quantity ? 'true' : 'false') + '">',
            '<strong>' + value + '</strong>',
            '<span>' + escapeHtml(value === 1 ? singular : plural) + '</span>',
            '</button>'
          ].join("");
        }).join(""),
        '</div>',
        '</div>'
      ].join("") : "",
      '<section class="free-quantity-builder" aria-label="Quantidade">',
      '<p class="free-quantity-mode-label"><span>' + escapeHtml(options.length ? "...ou escolhe uma quantidade específica" : "Define a quantidade") + '</span></p>',
      '<div class="free-quantity-readout"><strong>' + quantity + '</strong><small>' + escapeHtml(quantity === 1 ? singular : plural) + '</small></div>',
      '<div class="free-quantity-control">',
      '<button type="button" data-builder-quantity-step="-1" data-builder-line="' + escapeHtml(line.id) + '" aria-label="Retirar uma unidade"' + (quantity <= minimum ? ' disabled' : '') + '>−</button>',
      '<label class="free-quantity-slider"><span>Quantidade: ' + quantity + '</span><input type="range" min="' + minimum + '" max="' + maximo + '" step="1" value="' + posicao + '" style="--range-progress:' + progresso + '%" data-builder-quantity-range data-builder-line="' + escapeHtml(line.id) + '" aria-valuetext="' + escapeHtml(builderUnitLabel(product, line, quantity)) + '"></label>',
      '<button type="button" data-builder-quantity-step="1" data-builder-line="' + escapeHtml(line.id) + '" aria-label="Acrescentar uma unidade"' + (quantity >= maximo ? ' disabled' : '') + '>+</button>',
      '</div>',
      '</section>',
      '</div>'
    ].join("");
  }

  // Mesma caixa de preços dos outros produtos (pack-price-card): à esquerda o
  // preço por unidade e o desconto, à direita o total dos produtos. A taxa de
  // ajuste já foi apresentada no passo 2 e não entra neste resumo do passo 3.
  function builderRenderPriceBox(product, line) {
    var entry = builderEntry(product, line.productId);
    var quantity = builderQuantity(line);
    var base;
    var extra;
    var perUnit;
    var desconto;

    if (!entry) {
      return "";
    }
    if (entry.quoteOnly === true) {
      return [
        '<section class="pack-price-overview builder-price-box" aria-label="Preço">',
        '<article class="pack-price-card pack-price-card--solo">',
        '<div class="summary-total summary-total--solo">',
        '<div class="total-top"><div class="total-value">' + escapeHtml(entry.quoteNote || "Preço a confirmar") + '</div></div>',
        '</div>',
        '</article>',
        '</section>'
      ].join("");
    }
    if (!builderQuantityIsValid(product, line)) {
      return '<p class="builder-line-price is-invalid">' + escapeHtml("A partir de " + builderUnitLabel(product, line, builderMinimumQuantity(product, line)) + ".") + '</p>';
    }

    base = builderLineBaseCents(product, line);
    extra = builderFinishExtraPerUnitCents(product, line) * quantity;
    perUnit = quantity ? Math.round((base + extra) / quantity) : 0;
    desconto = builderDiscountPercent(product, line);

    return [
      '<section class="pack-price-overview builder-price-box" aria-label="Preço">',
      '<article class="pack-price-card">',
      '<div class="summary-left">',
      '<div class="summary-row">',
      tagIconSvg(),
      '<span class="summary-value">' + escapeHtml(formatCents(perUnit)) + '</span>',
      '<span class="summary-label">cada</span>',
      '</div>',
      desconto > 0 ? '<div class="summary-row is-discount">' + percentBadgeIconSvg() + '<span class="summary-value">' + desconto + '%</span><span class="summary-label">desconto</span></div>' : "",
      '</div>',
      '<div class="summary-divider" aria-hidden="true"></div>',
      '<div class="summary-total">',
      '<div class="total-top"><div class="total-value">' + escapeHtml(formatCents(base + extra)) + '</div></div>',
      '<div class="total-label">total</div>',
      '</div>',
      '</article>',
      '</section>'
    ].join("");
  }

  function builderRenderCard(product, line) {
    var entry = builderEntry(product, line.productId);
    var pendingRemoval = String(state.builderRemovePendingId || "") === String(line.id);

    if (!entry) {
      return "";
    }

    return [
      '<article class="builder-card" data-builder-card="' + escapeHtml(line.id) + '">',
      '<header class="builder-card-header">',
      builderRenderEntryMedia(entry, "builder-tile-media"),
      '<span class="builder-tile-copy"><strong>' + escapeHtml(entry.title) + '</strong>' + (entry.subtitle ? '<small>' + escapeHtml(entry.subtitle) + '</small>' : "") + '</span>',
      '<button type="button" class="builder-card-remove" data-builder-remove="' + escapeHtml(line.id) + '" aria-label="Remover ' + escapeHtml(entry.title) + '" aria-expanded="' + (pendingRemoval ? 'true' : 'false') + '"' + (pendingRemoval ? ' aria-controls="builder-remove-confirmation"' : '') + '>×</button>',
      '</header>',
      pendingRemoval ? [
        '<div id="builder-remove-confirmation" data-builder-remove-confirmation role="alert">',
        '<p>Queres remover?</p>',
        '<div class="actions">',
        '<button type="button" class="button secondary" data-builder-confirm-remove="' + escapeHtml(line.id) + '">Sim</button>',
        '<button type="button" class="button secondary" data-builder-cancel-remove="' + escapeHtml(line.id) + '">Não</button>',
        '</div>',
        '</div>'
      ].join("") : "",
      builderRenderChoiceFields(product, line),
      builderRenderFinishField(product, line),
      builderRenderQuantityField(product, line),
      '<div class="builder-field">',
      '<span class="builder-field-label">Sub-total</span>',
      builderRenderPriceBox(product, line),
      '</div>',
      '</article>'
    ].join("");
  }

  // O total vive na barra de accoes e nao no fim do passo: em mobile essa barra
  // e sticky, por isso o preco acompanha sempre quem esta a escolher.
  function builderActionTotals(product, step) {
    var template = String(step && step.template || "");

    if (!isArtworkBuilderProduct(product)
      || (template !== "custom-product-builder" && template !== "custom-quantity-builder")
      || !builderLines(product).length) {
      return "";
    }
    return builderRenderTotals(product, {
      adjustmentsOnly: template === "custom-product-builder"
    });
  }

  function builderRenderTotals(product, options) {
    var settings = options || {};
    var total = settings.adjustmentsOnly ? builderAdjustmentTotalCents(product) : builderTotalCents(product);

    return [
      '<p class="builder-total">',
      '<span>Total</span>',
      '<strong>' + escapeHtml(formatCents(total)) + '</strong>',
      !settings.adjustmentsOnly && builderHasQuoteOnly(product) ? '<small>Há produtos com preço a confirmar.</small>' : "",
      '</p>'
    ].join("");
  }

  // ==== PERSONALIZACAO_BUILDER_DEBUG =======================================
  // `personalizacao.html?debug=builder` finge duas imagens ja enviadas e salta
  // para o passo dos produtos, para se poder ver os passos 2 e 3 sem esperar
  // por uploads reais. `&images=N` escolhe quantas (1 a 10), util para ver os
  // textos do passo 1 e o titulo do passo 2 em cada contagem.
  // `personalizacao.html?debugstep3` e o atalho para ver o passo 3 cheio: tres
  // imagens e todos os produtos do catalogo marcados em cada uma. Os tokens sao
  // falsos: serve so para ver o ecra, um pedido feito assim nao teria
  // ficheiros no servidor.
  var BUILDER_DEBUG_PREVIEWS = [
    "content/designs/loja/crachas-loja/uploads/crachas-25-3d7d4ac2504c.webp",
    "content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/novos/a_jovem_cadeira_minicaderno.webp"
  ];

  function builderDebugConfig() {
    var params = currentUrlParams();
    var wantsStep3 = params.has("debugstep3");
    var images = parseInt(params.get("images"), 10) || 0;

    if (!wantsStep3 && params.get("debug") !== "builder") {
      return null;
    }
    return {
      count: Math.max(1, Math.min(10, images || (wantsStep3 ? 3 : 2))),
      stepId: String(params.get("step") || (wantsStep3 ? "custom_quantities" : "custom_products")),
      selectEverything: wantsStep3
    };
  }

  // Marca todos os produtos do catalogo em todas as imagens: o passo 3 abre com
  // uma linha por combinacao, ja com a quantidade minima de cada uma.
  function seedBuilderDebugSelections(product) {
    builderUploads(product).forEach(function (upload) {
      builderCatalog(product).forEach(function (entry) {
        builderToggleSelection(product, upload.token, entry.id, true);
      });
    });
  }

  function seedBuilderDebugUploads(product) {
    var config = isArtworkBuilderProduct(product) ? builderDebugConfig() : null;
    var key;
    var steps;
    var index;
    var previews;

    if (!config) {
      return;
    }

    key = customArtworkConfig(product).uploadKey;
    if (!orderUploadItems(key).length) {
      previews = [];
      while (previews.length < config.count) {
        previews.push(BUILDER_DEBUG_PREVIEWS[previews.length % BUILDER_DEBUG_PREVIEWS.length]);
      }

      state.selections[key] = previews.map(function (preview, position) {
        var token = "debug-artwork-" + (position + 1);
        orderUploadPreviews[token] = preview;
        return {
          token: token,
          name: "placeholder-" + (position + 1) + ".webp",
          size: 120000,
          mime: "image/webp",
          kind: "artwork",
          quantity: 1,
          feeCents: builderFeeCents(product)
        };
      });
    }

    if (config.selectEverything) {
      seedBuilderDebugSelections(product);
    }

    steps = visibleSteps(product);
    index = steps.findIndex(function (step) {
      return step && step.id === config.stepId;
    });
    if (index >= 0) {
      state.currentStep = index;
      state.maxVisitedStep = Math.max(state.maxVisitedStep, index);
    }
  }

  // BUILDER_EMPTY_BACK_V1: leva de volta ao passo onde se escolhem os
  // produtos. Usa o `id` do passo e nao um numero, porque a personalizacao tem
  // passos condicionais e o indice visivel muda conforme o caminho.
  function voltarAoPassoDeProdutos(product) {
    var steps = visibleSteps(product);
    var index = steps.findIndex(function (step) {
      return step && step.id === "custom_products";
    });

    if (index >= 0) {
      state.currentStep = index;
      state.maxVisitedStep = Math.max(state.maxVisitedStep, index);
    }
    rerenderProduct(product);
  }

  // Um design apagado no passo 1 deixa de existir: as linhas que apontavam
  // para esse ficheiro tem de desaparecer com ele.
  function builderPruneOrphanLines(product) {
    var lines = builderLines(product);
    var kept = lines.filter(function (line) {
      return !!builderUpload(product, line.designToken) && !!builderEntry(product, line.productId);
    });

    if (kept.length !== lines.length) {
      state.selections.builder_lines = kept;
    }
  }

  function renderCustomProductBuilderStep(product) {
    builderPruneOrphanLines(product);

    return [
      '<section class="custom-product-builder builder-picker">',
      builderUploads(product).map(function (upload, index) {
        return builderRenderDesignPicker(product, upload, index);
      }).join(""),
      builderRenderOrderSummary(product),
      '</section>'
    ].join("");
  }

  function renderCustomQuantityBuilderStep(product) {
    builderPruneOrphanLines(product);

    return [
      '<section class="custom-product-builder builder-quantities">',
      builderUploads(product).map(function (upload, index) {
        var lines = builderLinesForDesign(product, upload.token);

        if (!lines.length) {
          return "";
        }
        return [
          '<article class="builder-design-block" data-builder-design-block="' + escapeHtml(upload.token) + '">',
          '<h3 class="section-title">' + escapeHtml(builderDesignTitle(index)) + '</h3>',
          '<div class="builder-design-figure">' + builderRenderUploadMedia(upload, "builder-design-preview") + '</div>',
          '<h3 class="section-title">' + (lines.length === 1 ? 'Produto escolhido:' : 'Produtos escolhidos:') + '</h3>',
          '<div class="builder-card-list">',
          lines.map(function (line) {
            return builderRenderCard(product, line);
          }).join(""),
          '</div>',
          '</article>'
        ].join("");
      }).join(""),
      builderRenderOrderSummary(product, { withQuantity: true }),
      '</section>'
    ].join("");
  }

  // Passo 2: cada imagem tem de ir para algum lado. Quem nao quer nada com uma
  // imagem apaga-a no passo anterior.
  function validateBuilderProductsStep(product) {
    var uploads = builderUploads(product);
    var semProduto;

    if (state.orderUploadBusy) {
      return "Espera até todos os ficheiros terminarem de enviar.";
    }
    if (!uploads.length) {
      return "Carrega pelo menos uma imagem ou um PDF no passo anterior.";
    }

    semProduto = uploads.map(function (upload, index) {
      return builderLinesForDesign(product, upload.token).length === 0 ? index : -1;
    }).filter(function (index) {
      return index >= 0;
    });

    if (semProduto.length === uploads.length) {
      return "Escolhe pelo menos um produto.";
    }
    if (semProduto.length) {
      return "Escolhe pelo menos um produto para a tua " + builderDesignOrdinal(semProduto[0]) + " imagem.";
    }
    return "";
  }

  // Passo 3: opcoes obrigatorias preenchidas e quantidade que a tabela de
  // precos aceita.
  function validateBuilderStep(product) {
    var lines = builderLines(product);
    var error = "";

    if (state.orderUploadBusy) {
      return "Espera até todos os ficheiros terminarem de enviar.";
    }
    if (!lines.length) {
      return "Escolhe pelo menos um produto no passo anterior.";
    }

    lines.some(function (line) {
      var entry = builderEntry(product, line.productId);
      var position = entry ? "em " + entry.title : "";

      if (!entry) {
        return false;
      }
      if (builderEntryChoices(entry).some(function (choice) {
        return choice && choice.required === true && !(line.choices && line.choices[choice.field]);
      })) {
        error = "Preenche as opções " + position + ".";
        return true;
      }
      if (!builderQuantityIsValid(product, line)) {
        error = "Escolhe uma quantidade válida " + position + " (a partir de " + builderUnitLabel(product, line, builderMinimumQuantity(product, line)) + ").";
        return true;
      }
      return false;
    });

    return error;
  }

  function builderCartItem(product, line) {
    var entry = builderEntry(product, line && line.productId);
    var upload = builderUpload(product, line && line.designToken);
    var record = builderPricing(entry);
    var quantity = builderQuantity(line);
    var fee = builderFeeCents(product);
    var finishes = builderLineFinishes(product, line);
    var quoteOnly = !!(entry && entry.quoteOnly === true);
    var selections = {};
    var subtitle = [];

    if (!entry || !upload || !quantity) {
      return null;
    }

    selections.catalog_context = "main-v2";
    selections.order_flow = "custom";
    selections.design_source = "custom";
    selections.designs = [];
    selections.design_quantities = {};
    selections.design_labels = {};
    selections.assorted_designs = "";
    selections.size = entry.size ? String(entry.size) : "";
    // Nos cadernos o `pack_quantity` nao e a quantidade encomendada: e o
    // marcador que identifica a opcao de compra (product_step_item_by_quantity
    // no send-order.php). A quantidade real vai no ficheiro e o servidor
    // copia-a para caderno_order_quantity.
    selections.pack_quantity = builderPackQuantityMarker(product, line) || quantity;
    selections.custom_artwork_uploads = [Object.assign({}, upload, { quantity: quantity, feeCents: fee })];
    selections.customization_file_count = 1;
    selections.customization_fee_cents = fee;
    selections.artwork_total_quantity = quantity;
    selections.finishes = finishes;

    Object.keys((entry.fixedSelections && typeof entry.fixedSelections === "object") ? entry.fixedSelections : {}).forEach(function (key) {
      selections[key] = entry.fixedSelections[key];
    });

    builderEntryChoices(entry).forEach(function (choice) {
      var value = String((line.choices && line.choices[choice.field]) || "");
      var item = (Array.isArray(choice.items) ? choice.items : []).filter(function (candidate) {
        return String(candidate.value) === value;
      })[0] || null;

      selections[choice.field] = value;
      if (item) {
        selections[choice.field + "_label"] = String(item.title || value);
        subtitle.push(String(item.title || value));
      }
    });

    if (finishes.length) {
      subtitle.push(finishes.map(function (value) {
        var finish = builderFinishOption(product, value);
        return finish ? String(finish.title || value) : value;
      }).join(", "));
    }
    subtitle.push(String(upload.name || "design"));

    return {
      id: createCartItemId({ slug: entry.slug }),
      productSlug: String(entry.slug),
      // No carrinho estas linhas ficam ao lado das do catalogo normal: sem a
      // marca, um "Crachás pequenos" feito com o desenho de quem encomenda
      // seria indistinguivel de um da loja.
      productName: (entry.title || (record && record.label) || entry.slug) + " (Personalização)",
      selections: selections,
      summary: {
        title: quoteOnly
          ? entry.title + " · " + quantity
          : builderUnitLabel(product, line, quantity) + (entry.subtitle ? " · " + entry.subtitle : ""),
        subtitle: subtitle.filter(Boolean).join(" · "),
        priceCents: quoteOnly ? 0 : builderLineTotalCents(product, line),
        priceText: quoteOnly ? String(entry.quoteNote || "Preço a confirmar") : "",
        priceToConfirm: quoteOnly,
        image: builderUploadIsPdf(upload) ? null : ORDER_MEDIA_PREVIEW_API + "?token=" + encodeURIComponent(upload.token)
      }
    };
  }

  function addBuilderLinesToCart(product, destination) {
    var items;
    var cart = null;
    var total = 0;

    if (!validateProductForCart(product)) {
      return;
    }

    items = builderLines(product).map(function (line) {
      return builderCartItem(product, line);
    }).filter(Boolean);

    if (!items.length) {
      state.errors = "Adiciona pelo menos um produto.";
      rerenderProduct(product);
      return;
    }

    items.forEach(function (item) {
      total += item.summary.priceCents || 0;
      cart = addOrUpdateCartItem(item);
    });

    trackProductEvent(product, "cart_item_added", {
      cart_id: cart ? cart.cartId : "",
      item_count: cart ? cart.items.length : items.length,
      item_price_cents: total
    });

    // Sem isto, voltar atras no browser reenviaria as mesmas linhas.
    state.selections.builder_lines = [];
    state.builderOpenGroups = {};
    window.location.href = destination;
  }

  function bindCustomProductBuilder(product) {
    function dismissBuilderRemovalPrompt() {
      var prompt;

      if (!state.builderRemovePendingId) {
        return;
      }
      state.builderRemovePendingId = "";
      prompt = document.querySelector("[data-builder-remove-confirmation]");
      if (prompt) {
        prompt.remove();
      }
      document.querySelectorAll("[data-builder-remove][aria-expanded='true']").forEach(function (button) {
        button.setAttribute("aria-expanded", "false");
        button.removeAttribute("aria-controls");
      });
    }

    function withLine(element, handler) {
      var line = builderLine(product, element.dataset.builderLine);
      if (!line) {
        return;
      }
      state.builderRemovePendingId = "";
      handler(line);
      state.errors = "";
      rerenderProduct(product);
    }

    document.querySelectorAll("[data-builder-remove]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = String(button.dataset.builderRemove || "");
        var nextId = String(state.builderRemovePendingId || "") === id ? "" : id;
        state.builderRemovePendingId = nextId;
        state.errors = "";
        rerenderProduct(product);
        var confirmButton = nextId ? document.querySelector("[data-builder-confirm-remove]") : null;
        if (confirmButton) {
          confirmButton.focus();
        }
      });
    });

    document.querySelectorAll("[data-builder-confirm-remove]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = String(button.dataset.builderConfirmRemove || "");
        state.selections.builder_lines = builderLines(product).filter(function (line) {
          return String(line.id) !== id;
        });
        state.builderRemovePendingId = "";
        state.errors = "";

        // BUILDER_EMPTY_BACK_V1: sem produtos nenhuns, este passo nao tem o que
        // mostrar — pedia "quantos queres de cada um?" sem haver nenhum. Volta
        // ao passo da escolha, que e onde a pessoa tem de decidir a seguir.
        if (!builderLines(product).length) {
          voltarAoPassoDeProdutos(product);
          return;
        }

        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-builder-cancel-remove]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.builderRemovePendingId = "";
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("button").forEach(function (button) {
      if (button.matches("[data-builder-remove], [data-builder-confirm-remove], [data-builder-cancel-remove]")) {
        return;
      }
      button.addEventListener("click", dismissBuilderRemovalPrompt, true);
    });

    // Passo 2: abrir/fechar a gaveta de um grupo. So uma gaveta aberta de cada
    // vez por imagem, para a lista nao crescer sem fim no telemovel.
    document.querySelectorAll("[data-builder-group]").forEach(function (button) {
      button.addEventListener("click", function () {
        var token = String(button.dataset.builderDesignToken || "");
        var name = String(button.dataset.builderGroup || "");
        var open = button.getAttribute("aria-expanded") === "true";

        if (!state.builderOpenGroups || typeof state.builderOpenGroups !== "object") {
          state.builderOpenGroups = {};
        }
        builderGroups(product).forEach(function (group) {
          state.builderOpenGroups[builderGroupKey(token, group.name)] = false;
        });
        state.builderOpenGroups[builderGroupKey(token, name)] = !open;
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-builder-select]").forEach(function (input) {
      input.addEventListener("change", function () {
        builderToggleSelection(product, input.dataset.builderDesignToken, input.value, input.checked);
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-builder-choice]").forEach(function (input) {
      input.addEventListener("change", function () {
        withLine(input, function (line) {
          var field = String(input.dataset.builderChoice || "");
          if (!line.choices || typeof line.choices !== "object") {
            line.choices = {};
          }
          line.choices[field] = String(input.value || "");
          // A opcao de compra dos cadernos e tambem a tabela de precos: se a
          // quantidade deixar de servir, volta ao minimo desta tabela.
          if (!builderQuantityIsValid(product, line)) {
            line.quantity = builderMinimumQuantity(product, line);
          }
        });
      });
    });

    document.querySelectorAll("[data-builder-finish]").forEach(function (input) {
      input.addEventListener("change", function () {
        withLine(input, function (line) {
          var value = String(input.value || "");
          var escolhido = builderFinishOption(product, value);
          var grupo = escolhido && escolhido.group ? String(escolhido.group) : "";
          var current = Array.isArray(line.finishes) ? line.finishes.slice() : [];
          var index;

          // Num grupo exclusivo marcar um desmarca o irmao; fora de grupo cada
          // acabamento continua a somar-se aos outros.
          if (grupo) {
            current = current.filter(function (outro) {
              var finish = builderFinishOption(product, outro);
              return !(finish && String(finish.group || "") === grupo);
            });
            if (input.checked) {
              current.push(value);
            }
            line.finishes = current;
            return;
          }

          index = current.indexOf(value);
          if (input.checked && index === -1) {
            current.push(value);
          } else if (!input.checked && index !== -1) {
            current.splice(index, 1);
          }
          line.finishes = current;
        });
      });
    });

    document.querySelectorAll("[data-builder-quantity]").forEach(function (button) {
      button.addEventListener("click", function () {
        withLine(button, function (line) {
          line.quantity = Math.max(1, parseInt(button.dataset.builderQuantity, 10) || 1);
        });
      });
    });

    document.querySelectorAll("[data-builder-quantity-step]").forEach(function (button) {
      button.addEventListener("click", function () {
        withLine(button, function (line) {
          var delta = parseInt(button.dataset.builderQuantityStep, 10) || 0;
          var minimum = builderMinimumQuantity(product, line);
          line.quantity = Math.max(minimum, Math.min(9999, builderQuantity(line) + delta));
        });
      });
    });

    document.querySelectorAll("[data-builder-quantity-range]").forEach(function (input) {
      input.addEventListener("input", function () {
        withLine(input, function (line) {
          var minimo = builderMinimumQuantity(product, line);
          var maximo = builderRangeMaximum(product, line);
          line.quantity = Math.max(minimo, Math.min(maximo, parseInt(input.value, 10) || minimo));
        });
      });
    });

    document.querySelectorAll("[data-builder-quantity-input]").forEach(function (input) {
      input.addEventListener("change", function () {
        withLine(input, function (line) {
          var minimum = builderMinimumQuantity(product, line);
          line.quantity = Math.max(minimum, Math.min(9999, parseInt(input.value, 10) || minimum));
        });
      });
    });
  }

  function renderChoiceItems(product, step, template) {
    var type = step.selection === "multi" ? "checkbox" : "radio";
    var selected = selectedValues(step);
    var gridClass = template === "media-list" ? "option-list" : template;
    var items = step.items || [];
    var maxSelections = Math.max(0, parseInt(step.maxSelections, 10) || 0);
    var limitReached = maxSelections > 0 && selected.length >= maxSelections;
    var selectionCounter = maxSelections > 0
      ? '<p class="choice-selection-counter" aria-live="polite">Escolhidas ' + selected.length + ' de ' + maxSelections + ' cores</p>'
      : "";
    var html = "";

    if (template === "design-grid" && getStepSectionConfig(product, step)) {
      return renderSectionedDesignChoiceItems(product, step);
    }

    items.forEach(function (item) {
      var checked = selected.indexOf(item.value) !== -1 ? " checked" : "";
      var disabled = step.selection === "multi" && limitReached && !checked ? " disabled" : "";
      var image;
      if (item.swatch) {
        image = renderChoiceSwatch(item);
      } else if (template === "text-grid" && item.image && (step.id === "frame_size" || isQuadrosProduct(product))) {
        image = renderVisual(item, "media-list", step);
      } else if (template === "text-grid" || template === "price-pack-grid") {
        image = "";
      } else {
        image = template === "design-grid" ? renderDesignCardMedia(product, step, item) : renderVisual(item, template, step);
      }
      var noteText = quadroChoiceNote(product, step, item);
      var note = noteText ? '<span class="choice-note">' + escapeHtml(noteText) + '</span>' : "";
      var card = [
        '<label class="choice-card ' + escapeHtml(template) + '">',
        '<input type="' + type + '" name="' + escapeHtml(step.field) + '" value="' + escapeHtml(item.value) + '" data-choice-step="' + escapeHtml(step.id) + '"' + checked + disabled + '>',
        image,
        '<span class="choice-copy">',
        '<strong>' + escapeHtml(item.title) + '</strong>',
        '<span>' + escapeHtml(item.subtitle) + '</span>',
        note,
        '</span>',
        adminItemControls(step, item),
        '</label>'
      ].join("");

      html += isQuadrosProduct(product) && checked && Array.isArray(item.drawerImages) && item.drawerImages.length
        ? '<div class="quadros-design-choice quadros-option-drawer-choice">' + card + renderQuadroDesignDrawer(product, item) + '</div>'
        : card;
    });

    return renderDesignActionControls(product, step) + selectionCounter + '<div class="' + escapeHtml(gridClass) + '" data-choice-grid-step="' + escapeHtml(step.id) + '">' + html + '</div>' + (state.admin ? '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar opção</button>' : "");
  }

  function renderSizeChoiceItems(product, step) {
    var selected = selectedValues(step);
    var html = "";
    // IMANES_SIZE_CARD_NOTE_RESTORE_V1: nos imanes continuamos a esconder
    // apenas a coluna direita de preco/placeholder, mas voltamos a mostrar o
    // texto do campo "Nota" do JSON dentro do cartao.
    var hidePricePreview = product && productFamily(product) === "imanes";

    (step.items || []).forEach(function (item) {
      var checked = selected.indexOf(item.value) !== -1 ? " checked" : "";
      var muted = selected.length && !checked ? " is-muted" : "";
      var info = priceForSize(product, item.value);
      // CRACHAS_SIZE_BEFORE_QUANTITY_V1: nos Crachas o size aparece antes
      // do pack, por isso o placeholder antigo "Escolhe um pack para ver
      // o preco" deixava de fazer sentido. Para crachas mostramos um aviso
      // que aponta para o passo seguinte; outros produtos mantem a frase
      // antiga, que continua valida no fluxo deles.
      var noPriceText = product && productFamily(product) === "crachas"
        ? "No próximo passo escolhes a quantidade e vês o preço final."
        : "Escolhe um pack para ver o preço.";
      var price = info.cents
        ? [
          '<strong>' + escapeHtml(info.total + ' para ' + productQuantityLabel(product, info.quantity) + '.') + '</strong>',
          '<p>' + escapeHtml('Ou seja, ' + info.perPin + (info.discount > 0 ? '. Poupas ' + info.discount + '%' : '.')) + '</p>'
        ].join("")
        : [
          '<p>' + escapeHtml(noPriceText) + '</p>'
        ].join("");

      html += [
        '<label class="choice-card media-list size-choice' + muted + '">',
        '<input type="radio" name="' + escapeHtml(step.field) + '" value="' + escapeHtml(item.value) + '" data-choice-step="' + escapeHtml(step.id) + '"' + checked + '>',
        renderVisual(item, "media-list", step),
        '<span class="choice-copy">',
        '<strong>' + escapeHtml(item.title) + '</strong>',
        '<span>' + escapeHtml(item.subtitle) + '</span>',
        item.note ? '<span class="choice-note">' + escapeHtml(item.note) + '</span>' : "",
        '</span>',
        hidePricePreview ? "" : '<span class="size-price-preview">' + price + '</span>',
        adminItemControls(step, item),
        '</label>'
      ].join("");
    });

    return '<div class="option-list size-choice-list">' + html + '</div>' + (state.admin ? '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar opção</button>' : "");
  }

  function adminImageSlotAttrs(item) {
    var attrs = "";

    if (item && item._imageEditKey) {
      attrs += ' data-mia-edit-key="' + escapeHtml(item._imageEditKey) + '"';
    }
    if (item && item._imageEditFallbackKey) {
      attrs += ' data-mia-fallback-edit-key="' + escapeHtml(item._imageEditFallbackKey) + '"';
    }
    if (item && item._imageEditStoreItemId) {
      attrs += ' data-admin-image-store-item-id="' + escapeHtml(item._imageEditStoreItemId) + '"';
    }
    return attrs;
  }

  function adminItemControls(step, item) {
    var frameScaleValue;
    var frameDefaultSize;
    var imageSlotAttrs;

    if (!state.admin) {
      return "";
    }

    imageSlotAttrs = adminImageSlotAttrs(item);
    frameScaleValue = step.template !== "quantity-builder"
      ? frameEditNumber(item, step, false, "frameScale", 100, 40, 300)
      : 100;
    frameDefaultSize = Math.round(defaultFrameBaseSize(item, step.template, step) * frameScaleValue / 100);

    return [
      '<div class="admin-card-tools">',
      '<label>Título<input type="text" value="' + escapeHtml(item.title) + '" data-admin-edit="title" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>',
      '<label>Linha 2<input type="text" value="' + escapeHtml(item.subtitle || "") + '" data-admin-edit="subtitle" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>',
      '<label>Valor<input type="text" value="' + escapeHtml(item.value || "") + '" data-admin-edit="value" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>',
      state.product && ["imanes", "caderninhos", "bloquinhos", "stickers", "marcadores", "marcadores-magneticos"].indexOf(productFamily(state.product)) !== -1 && step.id === "designs" ? '<label>Formato<select data-admin-edit="rectOrientation" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"><option value="portrait"' + (itemRectOrientation(item) === "portrait" ? " selected" : "") + '>Em pé</option><option value="landscape"' + (itemRectOrientation(item) === "landscape" ? " selected" : "") + '>Deitado</option></select></label>' : "",
      item.quantity != null ? '<label>Quantidade<input type="number" min="1" step="1" value="' + escapeHtml(item.quantity) + '" data-admin-edit="quantity" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>' : "",
      '<label>Nota<input type="text" value="' + escapeHtml(item.note || "") + '" data-admin-edit="note" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>',
      step.template !== "quantity-builder" ? '<label>Imagem<input type="file" accept="image/*" data-admin-upload data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>' : "",
      step.template !== "quantity-builder" ? '<label>Tamanho da moldura (%)<input type="number" min="40" max="300" step="1" value="' + escapeHtml(frameScaleValue) + '" data-admin-edit="frameScale" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
      step.template !== "quantity-builder" ? '<label>Largura moldura (px)<input type="number" min="1" max="2000" step="1" value="' + escapeHtml(frameEditNumber(item, step, false, "frameWidth", frameDefaultSize, 1, 2000)) + '" data-admin-edit="frameWidth" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
      step.template !== "quantity-builder" ? '<label>Altura moldura (px)<input type="number" min="1" max="2000" step="1" value="' + escapeHtml(frameEditNumber(item, step, false, "frameHeight", frameDefaultSize, 1, 2000)) + '" data-admin-edit="frameHeight" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
      step.template !== "quantity-builder" ? '<label>Margem moldura X (px)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(frameEditNumber(item, step, false, "frameMarginX", 0, -100, 100)) + '" data-admin-edit="frameMarginX" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
      step.template !== "quantity-builder" ? '<label>Margem moldura Y (px)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(frameEditNumber(item, step, false, "frameMarginY", 0, -100, 100)) + '" data-admin-edit="frameMarginY" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
      step.template !== "quantity-builder" ? '<label>Zoom imagem (%)<input type="number" min="20" max="500" step="1" value="' + escapeHtml(imageEditNumber(item, step, false, "imageZoom", 168, 20, 500)) + '" data-admin-edit="imageZoom" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
      step.template !== "quantity-builder" ? '<label>Imagem X (%)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(imageEditNumber(item, step, false, "imagePositionX", 0, -100, 100)) + '" data-admin-edit="imagePositionX" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
      step.template !== "quantity-builder" ? '<label>Imagem Y (%)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(imageEditNumber(item, step, false, "imagePositionY", 0, -100, 100)) + '" data-admin-edit="imagePositionY" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
      step.template !== "quantity-builder" ? '<label>Rotação imagem (°)<input type="number" min="-180" max="180" step="1" value="' + escapeHtml(imageEditNumber(item, step, false, "imageRotation", 0, -180, 180)) + '" data-admin-edit="imageRotation" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"' + imageSlotAttrs + '></label>' : "",
      state.product && isCadernosProduct(state.product) && step.id === "designs" ? '<label>Imagens do interior (' + escapeHtml((item.interiorImages || []).length) + ')<input type="file" accept="image/*" multiple data-admin-interior-upload data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>' : "",
      state.product && isCadernosProduct(state.product) && step.id === "designs" && (item.interiorImages || []).length ? '<button type="button" data-admin-interior-clear data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '">Limpar interiores</button>' : "",
      getStepSectionConfig(state.product, step) ? renderSectionItemControls(step, item) : "",
      // CRACHAS_STEP2_SIDE_PHOTO_ADMIN_V4: bloco extra para a foto direita
      // que fica visivel so nos cartoes de tamanho dos crachas. Gravado em
      // sideImage / sideFrameWidth / sideFrameHeight / sideFrameScale /
      // sideFrameMarginX|Y / sideImageZoom / sideImagePositionX|Y /
      // sideImageRotation. Nunca toca em image / frameWidth / frameHeight.
      state.product && productFamily(state.product) === "crachas" && step.id === "size" ? renderCrachasSidePhotoAdminControls(step, item) : "",
      '<button type="button" data-admin-delete-item data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '">Del</button>',
      '</div>'
    ].join("");
  }

  function renderCrachasSidePhotoAdminControls(step, item) {
    var stepId = escapeHtml(step.id);
    var itemId = escapeHtml(item.id);
    var sideFrameScale = frameEditNumber(item, step, true, "sideFrameScale", 100, 40, 300);
    var defaultWidth = Math.round(defaultSideFrameWidth(item) * sideFrameScale / 100);
    var defaultHeight = Math.round(defaultSideFrameHeight(item) * sideFrameScale / 100);

    return [
      '<div class="admin-card-tools-section admin-card-tools-side">',
      '<p class="admin-card-tools-heading">Foto de comparação</p>',
      '<label>Imagem<input type="file" accept="image/*" data-admin-side-upload data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      isUploadedSideImage(item) ? '<button type="button" data-admin-side-clear data-step-id="' + stepId + '" data-item-id="' + itemId + '">Limpar foto de comparação</button>' : "",
      '<label>Tamanho da moldura (%)<input type="number" min="40" max="300" step="1" value="' + escapeHtml(sideFrameScale) + '" data-admin-side-edit="sideFrameScale" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      '<label>Largura moldura (px)<input type="number" min="1" max="2000" step="1" value="' + escapeHtml(frameEditNumber(item, step, true, "sideFrameWidth", defaultWidth, 1, 2000)) + '" data-admin-side-edit="sideFrameWidth" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      '<label>Altura moldura (px)<input type="number" min="1" max="2000" step="1" value="' + escapeHtml(frameEditNumber(item, step, true, "sideFrameHeight", defaultHeight, 1, 2000)) + '" data-admin-side-edit="sideFrameHeight" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      '<label>Margem moldura X (px)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(frameEditNumber(item, step, true, "sideFrameMarginX", 0, -100, 100)) + '" data-admin-side-edit="sideFrameMarginX" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      '<label>Margem moldura Y (px)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(frameEditNumber(item, step, true, "sideFrameMarginY", 0, -100, 100)) + '" data-admin-side-edit="sideFrameMarginY" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      '<label>Zoom imagem (%)<input type="number" min="20" max="500" step="1" value="' + escapeHtml(imageEditNumber(item, step, true, "sideImageZoom", 168, 20, 500)) + '" data-admin-side-edit="sideImageZoom" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      '<label>Imagem X (%)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(imageEditNumber(item, step, true, "sideImagePositionX", 0, -100, 100)) + '" data-admin-side-edit="sideImagePositionX" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      '<label>Imagem Y (%)<input type="number" min="-100" max="100" step="1" value="' + escapeHtml(imageEditNumber(item, step, true, "sideImagePositionY", 0, -100, 100)) + '" data-admin-side-edit="sideImagePositionY" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      '<label>Rotação imagem (°)<input type="number" min="-180" max="180" step="1" value="' + escapeHtml(imageEditNumber(item, step, true, "sideImageRotation", 0, -180, 180)) + '" data-admin-side-edit="sideImageRotation" data-step-id="' + stepId + '" data-item-id="' + itemId + '"></label>',
      '</div>'
    ].join("");
  }

  function renderSectionItemControls(step, item) {
    var config = getStepSectionConfig(state.product, step);
    if (!config) {
      return "";
    }
    var sections = ensureStepSections(step, config.defaults);
    var fallbackId = sections[0] && sections[0].id;
    var currentId = item && item.sectionId ? item.sectionId : fallbackId;
    var sectionOrderRaw = item && item.sectionOrder != null ? item.sectionOrder : "";
    var optionsHtml = sections.map(function (section) {
      return '<option value="' + escapeHtml(section.id) + '"' + (section.id === currentId ? " selected" : "") + ">" + escapeHtml(section.title) + "</option>";
    }).join("");
    var separatorLabel = config.mode === "invisible" ? "Grupo (não visível no site)" : "Separador";
    var orderLabel = config.mode === "invisible" ? "Ordem dentro do grupo" : "Ordem dentro do separador";
    var originalTitleHint = item && item.title && displayItemTitle(item) !== item.title
      ? '<p class="admin-original-title">Original: ' + escapeHtml(item.title) + '</p>'
      : "";

    return [
      originalTitleHint,
      '<label>' + escapeHtml(separatorLabel) + '<select data-admin-edit="sectionId" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '">' + optionsHtml + '</select></label>',
      '<label>' + escapeHtml(orderLabel) + '<input type="number" step="1" placeholder="(sem ordem)" value="' + escapeHtml(sectionOrderRaw) + '" data-admin-edit="sectionOrder" data-admin-allow-empty="1" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>'
    ].join("");
  }

  // Alias retro-compativel.
  function renderCrachasSectionItemControls(step, item) {
    return renderSectionItemControls(step, item);
  }

  function renderPinStack(item, quantity, step) {
    var count = Math.min(quantity, 12);
    var rest = quantity - count;
    var html = "";
    var i;

    for (i = 0; i < count; i += 1) {
      if (isUploadedImage(item)) {
        html += '<span class="pin-stack-dot' + itemRectOrientationClass(item) + ' uploaded-image" style="' + uploadedStackStyle(item, step) + '" aria-hidden="true"><span class="uploaded-image-inner"></span></span>';
      } else {
        html += '<span class="' + escapeHtml(item.visual || "neutral") + '">' + escapeHtml(item.badge || "") + '</span>';
      }
    }

    if (rest > 0) {
      html += '<strong>+' + rest + '</strong>';
    }

    return '<div class="pin-stack" aria-hidden="true">' + html + '</div>';
  }

  function nextDesignValue(product, value) {
    var items = selectedDesignItems(product);
    var index = items.map(function (item) {
      return item.value;
    }).indexOf(value);

    if (items.length < 2 || index === -1) {
      return "";
    }

    return items[(index + 1) % items.length].value;
  }

  function donorFor(product, targetValue) {
    var donor = null;

    selectedDesignItems(product).forEach(function (item) {
      var quantity = quantityFor(item.value);

      if (item.value === targetValue || quantity <= 1) {
        return;
      }

      if (!donor || quantity > donor.quantity) {
        donor = {
          value: item.value,
          quantity: quantity
        };
      }
    });

    return donor ? donor.value : "";
  }

  function canAdjustQuantity(product, value, direction) {
    var itemCount = selectedDesignItems(product).length;

    if (itemCount < 2) {
      return false;
    }

    if (direction < 0) {
      return quantityFor(value) > 1;
    }

    if (itemCount >= 3) {
      return unassignedCount(product) > 0;
    }

    return donorFor(product, value) !== "";
  }

  function moveOnePin(product, fromValue, toValue) {
    var quantities = state.selections.design_quantities || {};

    if (!fromValue || !toValue || fromValue === toValue || quantityFor(fromValue) <= 1) {
      return false;
    }

    quantities[fromValue] = quantityFor(fromValue) - 1;
    quantities[toValue] = quantityFor(toValue) + 1;
    state.selections.design_quantities = quantities;
    state.quantitiesTouched = true;
    return true;
  }

  function removeOnePin(product, value) {
    var quantities = state.selections.design_quantities || {};

    if (quantityFor(value) <= 1) {
      return false;
    }

    quantities[value] = quantityFor(value) - 1;
    state.selections.design_quantities = quantities;
    state.quantitiesTouched = true;
    return true;
  }

  function assignOnePin(product, value) {
    var quantities = state.selections.design_quantities || {};

    if (unassignedCount(product) <= 0) {
      return false;
    }

    quantities[value] = quantityFor(value) + 1;
    state.selections.design_quantities = quantities;
    state.quantitiesTouched = true;
    return true;
  }

  // CRACHAS_PACK_DISABLED_MESSAGE_V1
  // Mostra TODOS os packs com preco mas marca como desativado quando a
  // quantidade nao chega para todos os designs escolhidos. Clicar num pack
  // desativado nao seleciona; em vez disso mostra uma mensagem curta junto
  // aos packs explicando porque o pack nao serve.
  // PACK_SAVINGS_RIBBON_V1: dentro de cada botao de pack, quando ha
  // desconto face ao preco unitario, mostra uma fita "Poupas X%" no
  // canto superior direito. Funciona para qualquer produto que tenha
  // tabela de precos com unitario (chave "1") e packs maiores baratos.
  function packDiscountPercent(priceTable, quantity) {
    var unitCents;
    var packCents;

    if (!priceTable || !quantity || quantity < 2) {
      return 0;
    }

    unitCents = baselineUnitCents(priceTable);
    packCents = Number(priceTable[String(quantity)]) || 0;

    if (!unitCents || !packCents || packCents >= unitCents * quantity) {
      return 0;
    }

    return Math.round((1 - packCents / (unitCents * quantity)) * 100);
  }

  // PACK_SAVINGS_INFO_V1: caixa por baixo dos packs com o valor poupado
  // (em €), a percentagem face ao preco unitario, e um nudge para escolher
  // um pack maior se houver um com maior desconto.
  function renderPackSavingsInfo(product, priceTable, currentQuantity) {
    var unitCents;
    var packCents;
    var savedCents;
    var discount;
    var unitSingular;
    var hasBetterPack = false;
    var lines = [];

    if (!priceTable || !currentQuantity) {
      return "";
    }

    unitCents = Number(priceTable["1"]) || 0;
    packCents = Number(priceTable[String(currentQuantity)]) || 0;

    if (!unitCents || !packCents) {
      return "";
    }

    savedCents = (unitCents * currentQuantity) - packCents;
    discount = packDiscountPercent(priceTable, currentQuantity);
    unitSingular = (product && product.unitSingular) ? product.unitSingular : "unidade";

    Object.keys(priceTable).forEach(function (key) {
      var qty = parseInt(key, 10);
      if (qty > currentQuantity && packDiscountPercent(priceTable, qty) > discount) {
        hasBetterPack = true;
      }
    });

    if (savedCents <= 0 || discount <= 0) {
      if (hasBetterPack) {
        return '<p class="pack-savings-info pack-savings-info--nudge">Escolhe um pack maior para começares a poupar.</p>';
      }
      return "";
    }

    lines.push('Com este pack <strong>poupas ' + escapeHtml(formatCents(savedCents)) + '</strong>, ou seja <strong>' + discount + '%</strong> em relação ao preço de um ' + escapeHtml(unitSingular) + ' individual.');
    if (hasBetterPack) {
      lines.push(' Escolhe um pack maior para poupares mais.');
    }

    return '<p class="pack-savings-info">' + lines.join("") + '</p>';
  }

  function packDisabledMessageFor(product, quantity) {
    var unitSingular = (product && product.unitSingular) ? product.unitSingular : (product && product.unitShort ? product.unitShort : "unidade");
    var unitLabel = (product && product.unitLabel) ? product.unitLabel : unitSingular + "s";
    var unit = quantity === 1 ? unitSingular : unitLabel;
    var verb = quantity === 1 ? "não chega" : "não chegam";
    return quantity + " " + unit + " " + verb + " para todos os designs que escolheste. Escolhe um número maior.";
  }

  // Quantas vezes cada pack entra no melhor conjunto para o total escolhido.
  // Serve para pôr o visto nos packs que compõem o total: 27 = 24 + 3 leva um
  // visto em cada, 10 = 5 + 5 leva dois vistos no pack de 5.
  function packCombinationCounts(product) {
    var table = packCombinationTableFor(product);
    var plan = table ? packCombinationPlan(
      table,
      getPackQuantity(product),
      packCombinationPrefersFewerPacks(product)
    ) : null;
    var counts = {};
    var tier;
    var quantity;

    // No modo por quantidade os cartões continuam a escolher exactamente a
    // mesma quantidade, mas deixam de representar uma combinação de packs.
    // Assim, só há visto quando a quantidade coincide com um cartão existente.
    if (usesSelectedQuantityTierPricing(product)) {
      quantity = getPackQuantity(product);
      table = activePriceTableForPackFilter(product);
      if (quantity && table && table[String(quantity)] != null) {
        counts[quantity] = 1;
      }
      return counts;
    }

    if (isCustomArtworkSelected(product) || isAssortedSelected(product)) {
      return counts;
    }

    // No modo escalão o visto vai para o pack que fixa o preço, o mesmo que a
    // caixa lista como "1 pack de 36".
    if (usesTierUnitPricing(product)) {
      tier = tierPlan(activePriceTableForPackFilter(product), getPackQuantity(product));
      if (tier) {
        counts[tier.tier] = 1;
      }
      return counts;
    }

    if (!plan) {
      return counts;
    }

    plan.parts.forEach(function (part) {
      counts[part.quantity] = part.count;
    });

    return counts;
  }

  function renderPackSelector(product) {
    var packStep = findStep(product, "pack");
    var current = getPackQuantity(product);
    var combinationCounts = packCombinationCounts(product);
    var packModeSelected = !freeQuantityStep(product) || freeQuantitySelectionMode(product) === "pack";
    var selectedCount = selectedDesignItems(product).length;
    var priceTable = activePriceTableForPackFilter(product);
    var visibleItems = packStep && Array.isArray(packStep.items)
      ? packStep.items.filter(function (item) {
          var quantity = Number(item.quantity);
          return !priceTable || priceTable[String(quantity)] != null;
        })
      : [];
    var cards = "";
    var adminEditor = "";
    var message = state.packDisabledMessage || "";

    visibleItems.forEach(function (item) {
      var quantity = Number(item.quantity);
      var disabled = quantity < selectedCount;
      var marks = combinationCounts[quantity] || 0;
      var classes = "pack-option";
      var vistos = "";
      var i;
      if (quantity === current && packModeSelected) {
        classes += " is-selected";
      }
      if (disabled) {
        classes += " is-disabled";
      }
      if (marks) {
        classes += " is-in-combination";
        for (i = 0; i < marks; i += 1) {
          vistos += "<i>✓</i>";
        }
      }
      // CLICK_TRACKING_V1: data-track-* permite agregar quais packs são
      // mais escolhidos / quantos cliques falham (pack disabled).
      cards += [
        '<button class="' + classes + '" type="button" data-pack-quantity="' + quantity + '" data-track="true" data-track-action="select_pack" data-track-id="pack_' + quantity + '" data-track-label="' + escapeHtml(item.title + ' ' + item.subtitle) + '" aria-pressed="' + (quantity === current && packModeSelected ? 'true' : 'false') + '"' + (disabled ? ' data-pack-disabled="1" aria-disabled="true"' : '') + '>',
        '<strong>' + escapeHtml(item.title) + '</strong>',
        '<span>' + escapeHtml(item.subtitle) + '</span>',
        vistos ? '<span class="pack-option-marks" aria-hidden="true">' + vistos + '</span>' : "",
        '</button>'
      ].join("");
    });

    if (state.admin && packStep) {
      adminEditor = [
        '<div class="admin-pack-items">',
        (packStep.items || []).map(function (item) {
          return adminItemControls(packStep, item);
        }).join(""),
        '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(packStep.id) + '">Adicionar pack</button>',
        '</div>'
      ].join("");
    }

    return [
      '<div class="pack-control">',
      '<div class="pack-options">',
      cards,
      '</div>',
      message ? '<p class="pack-disabled-message" role="status" aria-live="polite">' + escapeHtml(message) + '</p>' : "",
      adminEditor,
      '</div>'
    ].join("");
  }

  function renderQuantityStatus(product) {
    var packQuantity = getPackQuantity(product);
    var total = quantityTotal(product);
    var diff = packQuantity - total;
    var text = diff === 0 ? "Pack completo" : diff > 0 ? "Faltam " + diff : "Tens " + Math.abs(diff) + " a mais";

    if (diff === 0) {
      return "";
    }

    if (diff > 0 && selectedDesignItems(product).length >= 3) {
      return "";
    }

    return [
      '<div class="quantity-status ' + (diff === 0 ? "is-complete" : "needs-work") + '">',
      '<strong>' + total + ' / ' + escapeHtml(productQuantityLabel(product, packQuantity)) + '</strong>',
      '<span>' + escapeHtml(text) + '</span>',
      '</div>'
    ].join("");
  }

  // PACK_PRICE_OVERVIEW_PRO_V5 + V5_ICONS_LEFT: caixa de resumo com layout
  // assimétrico (esquerda: 2 linhas Cada/Desconto, cada uma com ícone
  // pequeno · direita: Total grande sem ícone, separados por divisor
  // vertical subtil). Quando o pack é 1 unidade, colapsa numa coluna
  // centrada com só o total. Mantém os mesmos cálculos e dependências de
  // pricing.
  function tagIconSvg() {
    return [
      '<svg class="summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" aria-hidden="true" focusable="false">',
      '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>',
      '<circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none"></circle>',
      '</svg>'
    ].join("");
  }

  function percentBadgeIconSvg() {
    return [
      '<svg class="summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" aria-hidden="true" focusable="false">',
      '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76z"></path>',
      '<line x1="9" y1="15" x2="15" y2="9"></line>',
      '<circle cx="9.5" cy="9.5" r="0.8" fill="currentColor" stroke="none"></circle>',
      '<circle cx="14.5" cy="14.5" r="0.8" fill="currentColor" stroke="none"></circle>',
      '</svg>'
    ].join("");
  }

  function renderPackPriceOverview(product) {
    var packQuantity = getPackQuantity(product);
    var prices = product.prices || {};
    var priceKeys = state.selections.size ? [state.selections.size] : Object.keys(prices);
    var unitSingular = (product && product.unitSingular) ? product.unitSingular : (product && product.unitShort ? product.unitShort : "unidade");
    var rows = "";

    if (!packQuantity) {
      return "";
    }

    priceKeys.forEach(function (size) {
      var info = priceForSize(product, size);
      var perUnit;
      var solo = packQuantity === 1;
      var hasHeader = priceKeys.length > 1;
      var headerHtml = hasHeader ? '<header>' + escapeHtml(priceDisplayName(product, size)) + '</header>' : "";
      var leftHtml;

      if (!info.cents) {
        return;
      }

      perUnit = info.perPin.replace(/\s*\/.*$/, "");

      if (solo) {
        rows += [
          '<article class="pack-price-card pack-price-card--solo">',
          headerHtml,
          '<div class="summary-total summary-total--solo">',
          '<div class="total-top"><div class="total-value">' + escapeHtml(info.total) + '</div></div>',
          '<div class="total-label">por 1 ' + escapeHtml(unitSingular) + '</div>',
          '</div>',
          '</article>'
        ].join("");
        return;
      }

      leftHtml = '<div class="summary-left">'
        + '<div class="summary-row">'
        + tagIconSvg()
        + '<span class="summary-value">' + escapeHtml(perUnit) + '</span>'
        + '<span class="summary-label">cada</span>'
        + '</div>';

      if (info.discount > 0) {
        leftHtml += '<div class="summary-row is-discount">'
          + percentBadgeIconSvg()
          + '<span class="summary-value">' + info.discount + '%</span>'
          + '<span class="summary-label">desconto</span>'
          + '</div>';
      }

      leftHtml += '</div>';

      rows += [
        '<article class="pack-price-card">',
        headerHtml,
        leftHtml,
        '<div class="summary-divider" aria-hidden="true"></div>',
        '<div class="summary-total">',
        '<div class="total-top"><div class="total-value">' + escapeHtml(info.total) + '</div></div>',
        '<div class="total-label">total</div>',
        '</div>',
        '</article>'
      ].join("");
    });

    if (!rows) {
      return "";
    }

    return '<section class="pack-price-overview" aria-label="Preços deste pack">' + rows + '</section>';
  }

  function renderQuantityPricingSwitch(product) {
    var priceKey = priceKeyForSize(product, state.selections.size);
    var quantityTiers = selectedQuantityPricingMode(product, priceKey) === "quantity_tiers";

    if (!freeQuantityStep(product)
      || !supportsQuantityPricingSwitch(product, priceKey)
      || !quantityPricingSwitchEnabled()) {
      return "";
    }

    return [
      '<section class="quantity-pricing-switch" aria-label="Método de cálculo do preço">',
      '<div class="quantity-pricing-switch__copy">',
      '<strong>Método de cálculo</strong>',
      '<span>' + (quantityTiers ? 'Desconto por quantidade' : 'Combinação de packs') + '</span>',
      '</div>',
      '<button type="button" class="quantity-pricing-switch__control" role="switch" aria-checked="' + (quantityTiers ? 'true' : 'false') + '" data-quantity-pricing-toggle aria-label="Alternar entre combinação de packs e desconto por quantidade">',
      '<span aria-hidden="true"></span>',
      '</button>',
      '<div class="quantity-pricing-switch__labels" aria-hidden="true"><span>Packs</span><span>Por quantidade</span></div>',
      '</section>'
    ].join("");
  }

  function renderUnassignedPins(product) {
    var count = unassignedCount(product);
    var pins = "";
    var i;

    if (count <= 0 || selectedDesignItems(product).length < 3) {
      return "";
    }

    for (i = 0; i < count; i += 1) {
      pins += '<span class="sad-pin" aria-hidden="true">:(</span>';
    }

    return [
      '<section class="unassigned-pins" aria-label="Unidades sem design">',
      '<div>',
      '<strong>Unidades sem design:</strong>',
      '<span>' + count + '</span>',
      '</div>',
      '<div class="sad-pin-list">',
      pins,
      '</div>',
      '</section>'
    ].join("");
  }

  function renderFreeQuantityPriceChart(product) {
    var table = activePriceTableForPackFilter(product);

    if (!usesLinearDiscountPricing(product) || !table) {
      return "";
    }

    return [
      '<section class="free-price-chart" aria-labelledby="free-price-chart-title">',
      '<header class="free-price-chart-heading">',
      '<div><span>Vê antes de escolher</span><h3 id="free-price-chart-title">Como o preço total varia</h3></div>',
      '<p id="free-price-chart-help">Clica ou toca na linha para consultar outra quantidade.</p>',
      '</header>',
      '<div class="free-price-chart-stage" data-free-price-chart tabindex="0" role="group" aria-describedby="free-price-chart-help free-price-chart-tooltip">',
      '<canvas data-free-price-chart-canvas aria-hidden="true"></canvas>',
      '<span class="free-price-chart-current" data-free-price-chart-current hidden>A tua quantidade</span>',
      '</div>',
      '<div class="free-price-chart-tooltip" id="free-price-chart-tooltip" data-free-price-chart-tooltip aria-live="polite"></div>',
      '<div class="free-price-chart-axis-labels" aria-hidden="true"><span>Preço total</span><span>Quantidade</span></div>',
      '</section>'
    ].join("");
  }

  function freePriceChartMaximum(product, priceTable, current) {
    var minimum = minimumFreeQuantity(product);
    var maximum = maximumFreeQuantity(product);
    var largestPack = Object.keys(priceTable || {}).reduce(function (largest, key) {
      return Math.max(largest, parseInt(key, 10) || 0);
    }, minimum);
    var target = Math.max(minimum + 20, Math.ceil(largestPack * 1.25), Math.ceil(current * 1.15));

    target = Math.ceil(target / 5) * 5;
    return Math.max(minimum, Math.min(maximum, target));
  }

  function initFreeQuantityPriceCharts(product) {
    var stage;
    var canvas;
    var tooltip;
    var currentLabel;
    var priceTable;
    var context;
    var observer = null;
    var inspectedQuantity;
    var hasInteracted = false;
    var series = [];
    var chartMinimum = 1;
    var chartMaximum = 1;
    var plot = null;

    freeQuantityChartCleanup();
    freeQuantityChartCleanup = function () {};
    freeQuantityChartRefresh = function () {};

    stage = document.querySelector("[data-free-price-chart]");
    if (!stage || !usesLinearDiscountPricing(product)) {
      return;
    }

    canvas = stage.querySelector("[data-free-price-chart-canvas]");
    tooltip = document.querySelector("[data-free-price-chart-tooltip]");
    currentLabel = stage.querySelector("[data-free-price-chart-current]");
    priceTable = activePriceTableForPackFilter(product);
    context = canvas && canvas.getContext ? canvas.getContext("2d") : null;

    if (!canvas || !tooltip || !priceTable || !context) {
      return;
    }

    function cssColor(name, fallback) {
      var value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return value || fallback;
    }

    function currentQuantity() {
      return getPackQuantity(product) || minimumFreeQuantity(product);
    }

    function prepareSeries(resetInspection) {
      var current = currentQuantity();
      chartMinimum = minimumFreeQuantity(product);
      chartMaximum = freePriceChartMaximum(product, priceTable, current);
      series = linearDiscountPriceSeries(priceTable, chartMaximum);
      if (resetInspection || !inspectedQuantity || inspectedQuantity < chartMinimum || inspectedQuantity > chartMaximum) {
        inspectedQuantity = current;
      }
      stage.setAttribute(
        "aria-label",
        "Gráfico do preço total entre " + chartMinimum + " e " + chartMaximum + " unidades. Usa as setas para consultar quantidades."
      );
    }

    function detailsFor(quantity) {
      var cents = series[quantity] || linearDiscountPriceCents(priceTable, quantity);
      var baseline = baselineUnitCents(priceTable);
      var discount = baseline && cents < baseline * quantity
        ? Math.round((1 - cents / (baseline * quantity)) * 100)
        : 0;

      return {
        total: formatCents(cents),
        each: formatUnitPrice(cents, quantity, productUnitShort(product)).replace(/\s*\/.*$/, ""),
        discount: discount
      };
    }

    function updateTooltip() {
      var details = detailsFor(inspectedQuantity);
      var isCurrent = inspectedQuantity === currentQuantity();

      tooltip.innerHTML = [
        '<strong>' + escapeHtml(productQuantityLabel(product, inspectedQuantity)) + (hasInteracted && isCurrent ? ' <em>A tua quantidade</em>' : '') + '</strong>',
        '<span><b>' + escapeHtml(details.each) + '</b> cada</span>',
        '<span><b>' + details.discount + '%</b> desconto</span>',
        '<span><b>' + escapeHtml(details.total) + '</b> total</span>'
      ].join("");
    }

    function draw() {
      var rect = canvas.getBoundingClientRect();
      var width = Math.max(280, Math.round(rect.width));
      var height = Math.max(230, Math.round(rect.height));
      var ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      var left = width < 430 ? 48 : 58;
      var right = 18;
      var top = 20;
      var bottom = 38;
      var graphWidth = Math.max(1, width - left - right);
      var graphHeight = Math.max(1, height - top - bottom);
      var values = [];
      var maximumCents;
      var yMaximum;
      var ink = cssColor("--ink", "#2e2413");
      var muted = cssColor("--muted", "#7f6b42");
      var line = cssColor("--line", "#dfcfaa");
      var moss = cssColor("--moss", "#72551e");
      var gold = cssColor("--gold", "#d7aa36");
      var quantity;
      var tick;
      var current = currentQuantity();

      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.font = (width < 430 ? "11px" : "12px") + " system-ui, -apple-system, sans-serif";
      context.lineCap = "round";
      context.lineJoin = "round";

      for (quantity = chartMinimum; quantity <= chartMaximum; quantity += 1) {
        values.push(series[quantity] || 0);
      }
      maximumCents = values.reduce(function (maximum, cents) { return Math.max(maximum, cents); }, 0);
      yMaximum = Math.max(100, Math.ceil(maximumCents * 1.08 / 100) * 100);

      function xFor(value) {
        return left + ((value - chartMinimum) / Math.max(1, chartMaximum - chartMinimum)) * graphWidth;
      }

      function yFor(cents) {
        return top + graphHeight - (cents / yMaximum) * graphHeight;
      }

      plot = { left: left, right: left + graphWidth, top: top, bottom: top + graphHeight, width: graphWidth };

      context.strokeStyle = line;
      context.fillStyle = muted;
      context.lineWidth = 1;
      for (tick = 0; tick <= 4; tick += 1) {
        var yValue = Math.round(yMaximum * tick / 4);
        var y = yFor(yValue);
        context.globalAlpha = tick === 0 ? 0.8 : 0.48;
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(left + graphWidth, y);
        context.stroke();
        context.globalAlpha = 1;
        context.textAlign = "right";
        context.textBaseline = "middle";
        context.fillText((yValue / 100).toLocaleString("pt-PT", { maximumFractionDigits: 0 }) + " €", left - 8, y);
      }

      context.textBaseline = "top";
      for (tick = 0; tick <= 4; tick += 1) {
        var xQuantity = Math.round(chartMinimum + (chartMaximum - chartMinimum) * tick / 4);
        var x = xFor(xQuantity);
        context.textAlign = tick === 0 ? "left" : (tick === 4 ? "right" : "center");
        context.fillStyle = muted;
        context.fillText(String(xQuantity), x, top + graphHeight + 10);
      }

      context.beginPath();
      for (quantity = chartMinimum; quantity <= chartMaximum; quantity += 1) {
        var pointX = xFor(quantity);
        var pointY = yFor(series[quantity] || 0);
        if (quantity === chartMinimum) {
          context.moveTo(pointX, pointY);
        } else {
          context.lineTo(pointX, pointY);
        }
      }
      context.strokeStyle = moss;
      context.lineWidth = 2.6;
      context.globalAlpha = 0.94;
      context.stroke();
      context.globalAlpha = 1;

      function drawMarker(value, fill, radius, hollow) {
        var markerX = xFor(value);
        var markerY = yFor(series[value] || 0);
        context.beginPath();
        context.arc(markerX, markerY, radius, 0, Math.PI * 2);
        context.fillStyle = hollow ? cssColor("--card", "#fffdf5") : fill;
        context.fill();
        context.strokeStyle = fill;
        context.lineWidth = hollow ? 2.5 : 2;
        context.stroke();
        return { x: markerX, y: markerY };
      }

      context.save();
      context.setLineDash([4, 5]);
      context.strokeStyle = gold;
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(xFor(current), top);
      context.lineTo(xFor(current), top + graphHeight);
      context.stroke();
      context.restore();

      var currentPoint = drawMarker(current, gold, 5, false);
      if (inspectedQuantity !== current) {
        drawMarker(inspectedQuantity, moss, 5, true);
      }

      if (currentLabel) {
        currentLabel.hidden = !(hasInteracted && inspectedQuantity === current);
        currentLabel.style.left = Math.max(72, Math.min(width - 72, currentPoint.x)) + "px";
        currentLabel.style.top = Math.max(2, Math.min(height - 32, currentPoint.y - 34)) + "px";
      }

      context.fillStyle = ink;
      updateTooltip();
    }

    function quantityFromPointer(event) {
      var rect = stage.getBoundingClientRect();
      var localX;
      var ratio;

      if (!plot || !rect.width) {
        return currentQuantity();
      }
      localX = Math.max(plot.left, Math.min(plot.right, event.clientX - rect.left));
      ratio = (localX - plot.left) / Math.max(1, plot.width);
      return Math.max(chartMinimum, Math.min(chartMaximum, Math.round(chartMinimum + ratio * (chartMaximum - chartMinimum))));
    }

    function handleClick(event) {
      inspectedQuantity = quantityFromPointer(event);
      hasInteracted = true;
      draw();
    }

    function handleKeydown(event) {
      var next = inspectedQuantity;

      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        next -= 1;
      } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        next += 1;
      } else if (event.key === "Home") {
        next = chartMinimum;
      } else if (event.key === "End") {
        next = chartMaximum;
      } else {
        return;
      }

      event.preventDefault();
      inspectedQuantity = Math.max(chartMinimum, Math.min(chartMaximum, next));
      hasInteracted = true;
      draw();
    }

    function handleResize() {
      window.requestAnimationFrame(draw);
    }

    prepareSeries(true);
    stage.addEventListener("click", handleClick);
    stage.addEventListener("keydown", handleKeydown);

    if (typeof window.ResizeObserver === "function") {
      observer = new window.ResizeObserver(handleResize);
      observer.observe(stage);
    } else {
      window.addEventListener("resize", handleResize);
    }

    freeQuantityChartRefresh = function () {
      hasInteracted = false;
      prepareSeries(true);
      draw();
    };
    freeQuantityChartCleanup = function () {
      stage.removeEventListener("click", handleClick);
      stage.removeEventListener("keydown", handleKeydown);
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener("resize", handleResize);
      }
      freeQuantityChartRefresh = function () {};
    };

    draw();
  }

  // Nos produtos com packs combinados a quantidade livre é sempre convertida no
  // melhor conjunto de packs, e a etiqueta diz isso. Nos de preço unitário fixo
  // não há conjunto nenhum a calcular, por isso fica só o convite.
  function freeQuantityModeLabel(product, showPacks) {
    if (!showPacks) {
      return "Define a quantidade";
    }
    if (usesPackCombinationPricing(product)) {
      return "...ou escolhe uma quantidade específica";
    }
    return "...ou escolhe uma quantidade específica";
  }

  function renderFreeQuantityBuilder(product) {
    ensurePackAndQuantities(product);
    var minimum = effectiveMinimumFreeQuantity(product);
    var rangeMaximum = freeQuantityRangeMaximum(product);
    var current = getPackQuantity(product) || minimum;
    var rangePosition = freeQuantityRangePosition(product, current);
    var rangeProgress = rangeMaximum > minimum
      ? ((rangePosition - minimum) / (rangeMaximum - minimum) * 100).toFixed(2)
      : "0";
    var showPacks = showsPackOptions(product);

    if (isCustomArtworkSelected(product)) {
      return [
        '<section class="free-quantity-builder free-quantity-builder--locked" aria-label="Quantidade total">',
        '<p class="free-quantity-mode-label"><span>Quantidade definida por imagem</span></p>',
        '<div class="free-quantity-readout"><strong>' + current + '</strong><small>' + escapeHtml(current === 1 ? productUnitSingular(product) : productUnit(product)) + '</small></div>',
        '<p class="step-helper">Para alterar este total, volta ao passo dos ficheiros e ajusta a quantidade junto de cada imagem.</p>',
        '</section>',
        renderPackPriceOverview(product),
        renderQuantityPricingSwitch(product),
        renderPackCombinationSummary(product)
      ].join("");
    }

    return [
      showPacks ? renderPackSelector(product) : "",
      '<section class="free-quantity-builder" aria-label="Quantidade">',
      '<p class="free-quantity-mode-label"><span>' + escapeHtml(freeQuantityModeLabel(product, showPacks)) + '</span></p>',
      '<div class="free-quantity-readout"><strong data-free-quantity-value>' + current + '</strong><small data-free-quantity-unit>' + escapeHtml(current === 1 ? productUnitSingular(product) : productUnit(product)) + '</small></div>',
      '<div class="free-quantity-control">',
      '<button type="button" data-free-quantity-change="-1" aria-label="Retirar uma unidade"' + (current <= minimum ? ' disabled' : '') + '>−</button>',
      '<label class="free-quantity-slider"><span>Quantidade: ' + current + '</span><input type="range" min="' + minimum + '" max="' + rangeMaximum + '" step="1" value="' + rangePosition + '" style="--range-progress:' + rangeProgress + '%" data-free-quantity-range aria-valuetext="' + escapeHtml(productQuantityLabel(product, current)) + '"></label>',
      '<button type="button" data-free-quantity-change="1" aria-label="Acrescentar uma unidade"' + (current >= rangeMaximum ? ' disabled' : '') + '>+</button>',
      '</div>',
      '</section>',
      renderPackPriceOverview(product),
      renderQuantityPricingSwitch(product),
      renderPackCombinationSummary(product),
      renderQuantityDistribution(product),
      renderFreeQuantityPriceChart(product)
    ].join("");
  }

  // Mostra de que packs é feito o total, e se compensa subir para o próximo
  // pack. Sem descontos intermédios, subir de 47 para 48 pode ficar mais barato
  // e é isso que esta caixa diz — em números, não em conselhos.
  function packCombinationSummaryParts(plan, product) {
    return plan.parts.map(function (part) {
      if (part.quantity === 1) {
        return part.count + " " + (part.count === 1 ? productUnitSingular(product) : productUnit(product));
      }
      return part.count + (part.count === 1 ? " pack de " : " packs de ") + part.quantity;
    });
  }

  function packCombinationQuantityLabel(product, quantity) {
    return quantity + " " + (quantity === 1 ? productUnitSingular(product) : productUnit(product));
  }

  function packCombinationUpgrade(product, table, quantity, currentCents) {
    var maximum = maximumFreeQuantity(product);
    var melhor = null;
    var preferFewerPacks = packCombinationPrefersFewerPacks(product);
    var quantities = Object.keys(table).map(Number).sort(function (a, b) { return a - b; }).filter(function (packQuantity) {
      return packQuantity > quantity && packQuantity <= maximum;
    });

    if (packCombinationUsesNextPackUpgrade(product)) {
      quantities = quantities.slice(0, 1);
    }

    quantities.forEach(function (packQuantity) {
      var cents = packCombinationCents(table, packQuantity, preferFewerPacks);
      if (!cents || cents >= currentCents) {
        return;
      }
      if (!melhor || cents < melhor.cents) {
        melhor = {
          quantity: packQuantity,
          cents: cents,
          saving: currentCents - cents,
          plan: packCombinationPlan(table, packQuantity, preferFewerPacks)
        };
      }
    });

    return melhor;
  }

  // No modo escalão não há conjunto de packs a listar, mas continua a haver
  // poupanças por subir de escalão — 35 ímanes recortados custam mais do que 36.
  // É o mesmo aviso, com os mesmos números.
  function tierUpgrade(product, table, quantity, currentCents) {
    var maximum = maximumFreeQuantity(product);
    var melhor = null;

    priceTiers(table).forEach(function (tier) {
      var cents;

      if (tier <= quantity || tier > maximum) {
        return;
      }
      cents = tierPriceCents(table, tier);
      if (!cents || cents >= currentCents) {
        return;
      }
      if (!melhor || cents < melhor.cents) {
        melhor = { quantity: tier, cents: cents, saving: currentCents - cents };
      }
    });

    return melhor;
  }

  // O total do escalão é o pack em vigor mais as unidades soltas ao preço desse
  // pack: 47 recortados são 1 pack de 36 + 11 ímanes ao mesmo preço por unidade.
  function tierPlan(table, quantity) {
    var tier = 0;
    var total = tierPriceCents(table, quantity);
    var tierCents;

    priceTiers(table).forEach(function (candidate) {
      if (candidate <= quantity) {
        tier = candidate;
      }
    });

    if (!tier || !total) {
      return null;
    }

    tierCents = Math.round(Number(table[String(tier)]) || 0);

    return {
      tier: tier,
      cents: total,
      tierCents: tierCents,
      extra: quantity - tier,
      extraCents: total - tierCents
    };
  }

  function renderTierUpgradeSummary(product) {
    var table = activePriceTableForPackFilter(product);
    var quantity = getPackQuantity(product);
    var atual = table && quantity ? tierPriceCents(table, quantity) : 0;
    var plan = atual ? tierPlan(table, quantity) : null;
    var upgrade;

    if (!plan || isCustomArtworkSelected(product) || isAssortedSelected(product)) {
      return "";
    }

    upgrade = tierUpgrade(product, table, quantity, atual);

    return [
      '<section class="pack-combination" aria-label="Como o total é composto">',
      '<p class="pack-combination-title">Para ' + escapeHtml(packCombinationQuantityLabel(product, quantity)) + ', o preço é este:</p>',
      '<ul class="pack-combination-list">',
      '<li><span>1 pack de ' + plan.tier + '</span><strong>' + escapeHtml(formatCents(plan.tierCents)) + '</strong></li>',
      plan.extra > 0
        ? '<li><span>' + escapeHtml(packCombinationQuantityLabel(product, plan.extra))
          + ' ao preço do pack</span><strong>' + escapeHtml(formatCents(plan.extraCents)) + '</strong></li>'
        : "",
      '</ul>',
      '<p class="pack-combination-total"><span>Total</span><strong>' + escapeHtml(formatCents(plan.cents)) + '</strong></p>',
      upgrade
        ? '<p class="pack-combination-upgrade">Atenção! Se comprares 1 pack de ' + upgrade.quantity
        + ', consegues ' + escapeHtml(packCombinationQuantityLabel(product, upgrade.quantity))
        + ' por <strong>' + escapeHtml(formatCents(upgrade.cents)) + '</strong>'
        + ' — poupas <strong>' + escapeHtml(formatCents(upgrade.saving)) + '</strong>'
        + ' e consegues <strong>' + escapeHtml(packCombinationQuantityLabel(product, upgrade.quantity - quantity))
        + ' extra.</strong></p>'
        : "",
      '</section>'
    ].join("");
  }

  function quantityTierPricingResult(product, table, quantity) {
    var baseline = baselineUnitCents(table);
    var tiers = priceTiers(table);
    var tier = 0;
    var nextTier = 0;
    var unitCents;
    var totalCents;
    var savingCents;

    tiers.forEach(function (candidate) {
      if (candidate <= quantity) {
        tier = candidate;
      } else if (!nextTier) {
        nextTier = candidate;
      }
    });

    if (!tier || !baseline) {
      return null;
    }

    unitCents = tierUnitPriceCents(table, quantity);
    totalCents = tierPriceCents(table, quantity);
    savingCents = Math.max(0, Math.round(baseline * quantity) - totalCents);

    return {
      tier: tier,
      unitCents: unitCents,
      totalCents: totalCents,
      savingCents: savingCents,
      discount: Math.max(0, Math.round((1 - unitCents / baseline) * 100)),
      nextTier: nextTier,
      nextTierDiscount: nextTier
        ? Math.max(0, Math.round((1 - (Number(table[String(nextTier)]) / nextTier) / baseline) * 100))
        : 0,
      nextTierUnitCents: nextTier ? Number(table[String(nextTier)]) / nextTier : 0
    };
  }

  function renderQuantityTierPricingSummary(product) {
    var table = activePriceTableForPackFilter(product);
    var quantity = getPackQuantity(product);
    var result = table && quantity ? quantityTierPricingResult(product, table, quantity) : null;
    var nextTierCents;
    var saving;

    if (!result || !result.nextTier) {
      return "";
    }

    nextTierCents = Math.max(0, Number(table[String(result.nextTier)]) || 0);
    saving = result.totalCents - nextTierCents;

    // O cartão principal já mostra desconto, unitário, total e poupança. Esta
    // caixa só acrescenta valor quando subir já para o escalão seguinte custa
    // menos no total e dá mais unidades.
    if (!nextTierCents || saving <= 0) {
      return "";
    }

    return [
      '<section class="pack-combination quantity-tier-summary" aria-label="Recomendação de poupança">',
      '<p class="pack-combination-upgrade">Atenção! Se comprares 1 pack de ' + result.nextTier
        + ', consegues ' + escapeHtml(packCombinationQuantityLabel(product, result.nextTier))
        + ' por <strong>' + escapeHtml(formatCents(nextTierCents)) + '</strong>'
        + ' — poupas <strong>' + escapeHtml(formatCents(saving)) + '</strong>'
        + ' e consegues <strong>' + escapeHtml(packCombinationQuantityLabel(product, result.nextTier - quantity))
        + ' extra.</strong></p>',
      '</section>'
    ].join("");
  }

  function renderPackCombinationSummary(product) {
    if (usesSelectedQuantityTierPricing(product)) {
      return renderQuantityTierPricingSummary(product);
    }
    if (usesTierUnitPricing(product)) {
      return renderTierUpgradeSummary(product);
    }

    var table = packCombinationTableFor(product);
    var quantity = getPackQuantity(product);
    var plan = table ? packCombinationPlan(
      table,
      quantity,
      packCombinationPrefersFewerPacks(product)
    ) : null;
    var upgrade;

    if (!plan || isCustomArtworkSelected(product) || isAssortedSelected(product)) {
      return "";
    }

    upgrade = packCombinationUpgrade(product, table, quantity, plan.cents);

    return [
      '<section class="pack-combination" aria-label="Como o total é composto">',
      '<p class="pack-combination-title">Para ' + escapeHtml(packCombinationQuantityLabel(product, quantity)) + ', o melhor conjunto de packs é este:</p>',
      '<ul class="pack-combination-list">',
      plan.parts.map(function (part) {
        var etiqueta = part.quantity === 1
          ? part.count + " " + (part.count === 1 ? productUnitSingular(product) : productUnit(product))
          : part.count + (part.count === 1 ? " pack de " : " packs de ") + part.quantity;
        return '<li><span>' + escapeHtml(etiqueta) + '</span><strong>' + escapeHtml(formatCents(part.cents)) + '</strong></li>';
      }).join(""),
      '</ul>',
      '<p class="pack-combination-total"><span>Total</span><strong>' + escapeHtml(formatCents(plan.cents)) + '</strong></p>',
      upgrade && upgrade.plan
        ? '<p class="pack-combination-upgrade">Atenção! Se comprares '
          + escapeHtml(packCombinationSummaryParts(upgrade.plan, product).join(" + "))
          + ', consegues ' + escapeHtml(packCombinationQuantityLabel(product, upgrade.quantity))
          + ' por <strong>' + escapeHtml(formatCents(upgrade.cents)) + '</strong>'
          + ' — poupas <strong>' + escapeHtml(formatCents(upgrade.saving)) + '</strong>'
          + ' e consegues <strong>' + escapeHtml(packCombinationQuantityLabel(product, upgrade.quantity - quantity))
          + ' extra.</strong></p>'
        : "",
      '</section>'
    ].join("");
  }

  function setFreeQuantity(product, value, mode, trackSelection, direction) {
    var minimum = effectiveMinimumFreeQuantity(product);
    var maximum = maximumFreeQuantity(product);
    var quantity = Math.round(Number(value) || 0);

    quantity = Math.max(minimum, Math.min(maximum, quantity || minimum));
    // Com packs combinados só existem certas quantidades; encosta-se à mais
    // próxima em vez de aceitar uma que não tem preço.
    quantity = snapQuantityToPacks(product, quantity, direction || 0);
    state.selections.pack_quantity = quantity;
    state.selections.free_quantity_mode = mode === "pack"
      ? "pack"
      : freeQuantityModeForValue(product, quantity);
    state.quantitySignature = "";
    state.quantitiesTouched = false;
    state.quantityPackBaseline = 0;
    state.errors = "";
    ensurePackAndQuantities(product);
    if (trackSelection !== false) {
      try { trackOptionSelected(product, "quantity", quantity, productQuantityLabel(product, quantity)); } catch (e) {}
    }
    return quantity;
  }

  // O refresh parcial do slider não volta a desenhar a grelha de packs, por isso
  // os vistos do conjunto são acertados à mão, do mesmo modo que a selecção.
  function applyPackCombinationMarks(button, marks) {
    var alvo = button.querySelector(".pack-option-marks");
    var vistos = "";
    var i;

    button.classList.toggle("is-in-combination", marks > 0);

    if (!marks) {
      if (alvo) {
        alvo.remove();
      }
      return;
    }

    for (i = 0; i < marks; i += 1) {
      vistos += "<i>✓</i>";
    }
    if (!alvo) {
      alvo = document.createElement("span");
      alvo.className = "pack-option-marks";
      alvo.setAttribute("aria-hidden", "true");
      button.appendChild(alvo);
    }
    alvo.innerHTML = vistos;
  }

  function refreshFreeQuantityDraft(product, input) {
    var builder = input && input.closest ? input.closest(".free-quantity-builder") : null;
    var overview = builder && builder.nextElementSibling && builder.nextElementSibling.matches(".pack-price-overview")
      ? builder.nextElementSibling
      : null;
    var wrapper;
    var nextOverview;
    var quantity = getPackQuantity(product);
    var minimum = effectiveMinimumFreeQuantity(product);
    var rangeMaximum = freeQuantityRangeMaximum(product);
    var minus = builder ? builder.querySelector('[data-free-quantity-change="-1"]') : null;
    var plus = builder ? builder.querySelector('[data-free-quantity-change="1"]') : null;
    var range = builder ? builder.querySelector("[data-free-quantity-range]") : null;
    var rangeLabel = builder ? builder.querySelector(".free-quantity-slider > span") : null;
    var value = builder ? builder.querySelector("[data-free-quantity-value]") : null;
    var unit = builder ? builder.querySelector("[data-free-quantity-unit]") : null;
    var packControl = builder && builder.previousElementSibling && builder.previousElementSibling.matches(".pack-control")
      ? builder.previousElementSibling
      : null;

    if (minus) {
      minus.disabled = !quantity || quantity <= minimum;
    }
    if (plus) {
      plus.disabled = !quantity || quantity >= rangeMaximum;
    }
    if (value) {
      value.textContent = quantity || minimum;
    }
    if (unit) {
      unit.textContent = (quantity || minimum) === 1 ? productUnitSingular(product) : productUnit(product);
    }
    if (rangeLabel) {
      rangeLabel.textContent = "Quantidade: " + (quantity || minimum);
    }
    if (range && quantity) {
      var rangePosition = freeQuantityRangePosition(product, quantity);
      range.value = rangePosition;
      range.style.setProperty("--range-progress", (rangeMaximum > minimum
        ? ((rangePosition - minimum) / (rangeMaximum - minimum) * 100).toFixed(2)
        : "0") + "%");
      range.setAttribute("aria-valuetext", productQuantityLabel(product, quantity));
    }
    if (packControl) {
      var combinationCounts = packCombinationCounts(product);
      packControl.querySelectorAll(".pack-option").forEach(function (button) {
        var selected = freeQuantitySelectionMode(product) === "pack"
          && Number(button.dataset.packQuantity) === quantity;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
        applyPackCombinationMarks(button, combinationCounts[Number(button.dataset.packQuantity)] || 0);
      });
    }

    wrapper = document.createElement("div");
    wrapper.innerHTML = renderPackPriceOverview(product);
    nextOverview = wrapper.firstElementChild;

    if (overview && nextOverview) {
      overview.replaceWith(nextOverview);
    } else if (overview) {
      overview.remove();
    } else if (builder && nextOverview) {
      builder.insertAdjacentElement("afterend", nextOverview);
    }

    refreshPackCombinationSummary(product);
    refreshQuantityDistribution(product);
    freeQuantityChartRefresh();
  }

  // Também fica de fora do refresh parcial do slider, e é onde está o total.
  function refreshPackCombinationSummary(product) {
    var atual = document.querySelector(".pack-combination");
    var markup = renderPackCombinationSummary(product);
    var ancora = document.querySelector(".quantity-pricing-switch")
      || document.querySelector(".pack-price-overview")
      || document.querySelector(".free-quantity-builder");
    var wrapper;
    var proximo;

    if (!markup) {
      if (atual) {
        atual.remove();
      }
      return;
    }

    wrapper = document.createElement("div");
    wrapper.innerHTML = markup;
    proximo = wrapper.firstElementChild;
    if (!proximo) {
      return;
    }

    // No modo escalão a caixa só existe quando há poupança a apontar, por isso
    // pode ser preciso criá-la a meio do arrastar do slider.
    if (atual) {
      atual.replaceWith(proximo);
    } else if (ancora) {
      ancora.insertAdjacentElement("afterend", proximo);
    }
  }

  // Arrastar o slider do total só faz refresh parcial, por isso o bloco de
  // ajuste por design tem de ser redesenhado à parte (as quantidades voltam à
  // divisão automática sempre que o total muda).
  function refreshQuantityDistribution(product) {
    var current = document.querySelector("[data-quantity-distribution]");
    var markup = renderQuantityDistribution(product);
    var wrapper;
    var next;

    if (!current) {
      return;
    }

    if (!markup) {
      current.remove();
      return;
    }

    wrapper = document.createElement("div");
    wrapper.innerHTML = markup;
    next = wrapper.firstElementChild;

    if (next) {
      current.replaceWith(next);
      bindQuantityDistributionEvents(product);
    }
  }

  function bindQuantityDistributionEvents(product) {
    document.querySelectorAll("[data-quantity-plus]").forEach(function (button) {
      button.addEventListener("click", function () {
        var value = button.dataset.quantityPlus;
        var donor = donorFor(product, value);
        var changed = selectedDesignItems(product).length >= 3
          ? assignOnePin(product, value)
          : moveOnePin(product, donor, value);

        if (changed) {
          state.errors = "";
          rerenderProduct(product);
        }
      });
    });

    document.querySelectorAll("[data-quantity-minus]").forEach(function (button) {
      button.addEventListener("click", function () {
        var value = button.dataset.quantityMinus;
        var receiver = nextDesignValue(product, value);
        var changed = selectedDesignItems(product).length >= 3
          ? removeOnePin(product, value)
          : moveOnePin(product, value, receiver);

        if (changed) {
          state.errors = "";
          rerenderProduct(product);
        }
      });
    });

    document.querySelectorAll("[data-auto-distribute]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.selections.design_quantities = distributeQuantities(selectedDesignItems(product), getPackQuantity(product));
        state.quantitiesTouched = false;
        state.errors = "";
        rerenderProduct(product);
      });
    });
  }

  function renderDesignQuantityCards(product, items) {
    var designsStep = findStep(product, "designs");
    var cards = "";

    items.forEach(function (item) {
      var quantity = quantityFor(item.value);
      var controls = "";

      if (items.length > 1) {
        controls = [
          '<div class="quantity-controls">',
          '<button type="button" data-quantity-minus="' + escapeHtml(item.value) + '"' + (!canAdjustQuantity(product, item.value, -1) ? " disabled" : "") + '>−</button>',
          '<span>' + quantity + '</span>',
          '<button type="button" data-quantity-plus="' + escapeHtml(item.value) + '"' + (!canAdjustQuantity(product, item.value, 1) ? " disabled" : "") + '>+</button>',
          '</div>'
        ].join("");
      }

      cards += [
        '<article class="quantity-card" data-quantity-card="' + escapeHtml(item.value) + '">',
        '<div class="quantity-hero">',
        '<div class="quantity-visual-wrap">',
        renderVisual(item, "design-grid", designsStep),
        '<span class="quantity-badge">x' + quantity + '</span>',
        '</div>',
        '</div>',
        '<div class="quantity-main">',
        '<div>',
        '<strong>' + escapeHtml(displayItemTitle(item)) + '</strong>',
        '<span>' + escapeHtml(item.subtitle) + '</span>',
        '</div>',
        renderPinStack(item, quantity, designsStep),
        controls,
        '</div>',
        '</article>'
      ].join("");
    });

    return cards;
  }

  // Ajuste opcional por design dentro do total livre: o total manda, e cada
  // design começa com a divisão automática. Só aparece quando o passo do pack
  // pede `adjustPerDesign` e há mais do que um design escolhido, para os
  // produtos antigos (crachás, ímanes, mini-cadernos) ficarem como estavam.
  function packAdjustsPerDesign(product) {
    var packStep = findStep(product, "pack");

    return !!(packStep && packStep.adjustPerDesign === true);
  }

  // A dica vem do passo do pack quando o produto a define (produtos antigos);
  // nos novos é montada com o nome da unidade, para não haver produto sem ela.
  function packAdjustHint(product) {
    var packStep = findStep(product, "pack");

    if (packStep && packStep.adjustHint) {
      return packStep.adjustHint;
    }
    return "Se quiseres também podes ajustar a quantidade de cada "
      + productUnitSingular(product) + " individualmente";
  }

  function renderQuantityDistribution(product) {
    var items = selectedDesignItems(product);

    // Os cartões dos designs aparecem sempre que há designs escolhidos, como no
    // fluxo antigo: com um só design mostram a quantidade, sem controlos, porque
    // não há para onde mover. A dica e o "Distribuir por igual" só fazem sentido
    // a partir de dois.
    if (!packAdjustsPerDesign(product)
      || !items.length
      || isAssortedSelected(product)
      || isCustomArtworkSelected(product)) {
      return "";
    }

    return [
      '<div class="quantity-distribution" data-quantity-distribution>',
      items.length > 1 ? '<p class="quantity-adjust-hint">' + escapeHtml(packAdjustHint(product)) + '</p>' : "",
      '<div class="quantity-grid">',
      renderDesignQuantityCards(product, items),
      '</div>',
      renderQuantityStatus(product),
      renderUnassignedPins(product),
      items.length >= 2 ? '<button class="auto-distribute" type="button" data-auto-distribute>Distribuir por igual</button>' : "",
      '</div>'
    ].join("");
  }

  function renderQuantityBuilder(product) {
    var items = selectedDesignItems(product);
    var packStep = findStep(product, "pack");
    var adjustHint = packStep && packStep.adjustHint ? packStep.adjustHint : "";
    var packQuantity;
    var total;
    var unassigned;
    var cards = "";

    if (packStep && packStep.freeQuantity === true) {
      return renderFreeQuantityBuilder(product);
    }

    ensurePackAndQuantities(product);

    if (isAssortedSelected(product)) {
      return [
        renderPackSelector(product),
        renderPackPriceOverview(product)
      ].join("");
    }

    if (!items.length) {
      return '<p class="empty-state">Volta atrás e escolhe pelo menos um design.</p>';
    }

    packQuantity = getPackQuantity(product);
    total = quantityTotal(product);
    unassigned = unassignedCount(product);

    cards = renderDesignQuantityCards(product, items);

    return [
      renderPackSelector(product),
      renderPackPriceOverview(product),
      items.length > 1 && adjustHint ? '<p class="quantity-adjust-hint">' + escapeHtml(adjustHint) + '</p>' : "",
      '<div class="quantity-grid">',
      cards,
      '</div>',
      renderQuantityStatus(product),
      renderUnassignedPins(product),
      items.length >= 2 ? '<button class="auto-distribute" type="button" data-auto-distribute>Distribuir por igual</button>' : ""
    ].join("");
  }

  function renderSelectedSummary(product) {
    var items = selectedDesignItems(product);
    var quantities = state.selections.design_quantities || {};
    var html = "";

    if (!items.length) {
      return "";
    }

    items.forEach(function (item) {
      html += [
        '<span class="selected-pill">',
        renderVisual(item, "design-grid", findStep(product, "designs")),
        '<span>' + escapeHtml(displayItemTitle(item)) + '</span>',
        quantities[item.value] ? '<strong>x' + escapeHtml(quantities[item.value]) + '</strong>' : "",
        '</span>'
      ].join("");
    });

    return '<div class="selected-summary">' + html + '</div>';
  }

  // CRACHAS_STEP2_SIZE_LAYOUT_V2
  // Layout dedicado ao passo 2 dos crachas (escolha de tamanho).
  // Agora os cartões mostram apenas: visual do tamanho | texto | check de
  // seleccionado. A foto de comparação aparece grande por baixo, apenas
  // quando esse tamanho está seleccionado.
  function renderCrachasSidePhoto(item, step) {
    var hasSide = isUploadedSideImage(item);
    var active;
    var adminAttrs;
    var frameInfo;

    if (!hasSide) {
      return "";
    }

    active = !!(state.admin && step && state.adminActiveImage && state.adminActiveImage.side && state.adminActiveImage.stepId === step.id && state.adminActiveImage.itemId === item.id);
    adminAttrs = state.admin && step
      ? ' data-admin-side-image-visual data-admin-image-step="' + escapeHtml(step.id) + '" data-admin-image-item="' + escapeHtml(item.id) + '" tabindex="0" role="button" title="Selecionar foto de comparação para ajustar com o teclado"'
      : ' aria-hidden="true"';
    frameInfo = uploadedSideProofInfo(item, step);

    return [
      '<span class="crachas-size-card-proof crachas-size-card-proof--wide">',
      '<span class="crachas-size-card-proof-media">',
      '<span class="crachas-size-card-proof-note">Exemplo do tamanho</span>',
      '<span class="crachas-size-card-proof-frame uploaded-image' + (active ? ' is-admin-image-active' : '') + '" style="' + frameInfo.style + '"' + adminAttrs + miaSlotDebugFrameAttrs(frameInfo.debug) + '>',
      '<img class="crachas-size-card-proof-img" src="' + escapeHtml(item.sideImage) + '" alt="Exemplo do tamanho escolhido em comparação com uma moeda de 50 cêntimos">',
      '</span>',
      '</span>',
      '</span>'
    ].join("");
  }

  function renderCrachasSelectedDesigns(product) {
    var items = selectedDesignItems(product);
    var designsStep;
    var tilesHtml;

    if (isAssortedSelected(product)) {
      return renderAssortedSelectedSummary();
    }

    if (!items.length) {
      return "";
    }

    designsStep = findStep(product, "designs");
    tilesHtml = items.map(function (item) {
      return [
        '<article class="crachas-step2-summary-tile">',
        renderVisual(item, "design-grid", designsStep),
        '<span class="crachas-step2-summary-tile-name">' + escapeHtml(displayItemTitle(item)) + '</span>',
        '</article>'
      ].join("");
    }).join("");

    return [
      '<section class="crachas-step2-summary" aria-label="Designs escolhidos">',
      '<h3 class="crachas-step2-summary-title">Designs que vais encomendar:</h3>',
      '<div class="crachas-step2-summary-grid">' + tilesHtml + '</div>',
      '</section>'
    ].join("");
  }

  function renderCrachasSizeStep(product, step) {
    var selected = selectedValues(step);
    var html = "";

    (step.items || []).forEach(function (item) {
      var checked = selected.indexOf(item.value) !== -1 ? " checked" : "";
      var selectedClass = checked ? " is-selected" : "";
      var muted = selected.length && !checked ? " is-muted" : "";

      html += [
        '<div class="crachas-size-choice">',
        '<label class="choice-card crachas-size-card' + selectedClass + muted + '">',
        '<input type="radio" name="' + escapeHtml(step.field) + '" value="' + escapeHtml(item.value) + '" data-choice-step="' + escapeHtml(step.id) + '"' + checked + '>',
        '<span class="crachas-size-card-visual">' + renderVisual(item, "media-list", step) + '</span>',
        '<span class="choice-copy crachas-size-card-text">',
        '<strong>' + escapeHtml(item.title) + '</strong>',
        '<span>' + escapeHtml(item.subtitle || "") + '</span>',
        item.note ? '<span class="choice-note">' + escapeHtml(item.note) + '</span>' : "",
        '</span>',
        '<span class="crachas-size-card-selected" aria-hidden="true">✓</span>',
        adminItemControls(step, item),
        '</label>',
        checked ? renderCrachasSidePhoto(item, step) : "",
        '</div>'
      ].join("");
    });

    return [
      '<div class="option-list size-choice-list crachas-size-card-list">' + html + '</div>',
      state.admin ? '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar opção</button>' : "",
      renderCrachasSelectedDesigns(product)
    ].join("");
  }

