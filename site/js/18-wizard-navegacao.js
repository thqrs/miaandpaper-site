// js/18-wizard-navegacao.js — parte 18/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: navegacao do wizard: currentStep, validacoes e goNext.
  function currentStep(product) {
    return visibleSteps(product)[state.currentStep];
  }
  function setSelection(step, input) {
    var values;

    if (step.selection === "multi") {
      if (step.id === "designs") {
        state.selections.assorted_designs = "";
      }
      values = state.selections[step.id] || [];
      state.selections[step.id] = input.checked
        ? Array.from(new Set(values.concat(input.value)))
        : values.filter(function (value) { return value !== input.value; });
      state.quantitySignature = "";
      state.quantitiesTouched = false;
      state.quantityPackBaseline = 0;
      return;
    }

    if (step.id === "designs" && isQuadrosProduct(state.product) && state.selections.designs && state.selections.designs !== input.value) {
      (state.product.steps || []).filter(function (candidate) {
        return candidate && candidate.template === "palette-grid";
      }).forEach(function (colorStep) {
        var keys = quadrosColorSelectionKeys(colorStep);
        delete state.selections[keys.colors];
        delete state.selections[keys.palette];
        delete state.selections[keys.mia];
        delete state.selections[keys.tones];
      });
      delete state.selections.colors;
      delete state.selections.color_palette;
      delete state.selections.mia_choose_colors;
      delete state.selections.quadro_color_mode;
      delete state.selections.quadro_color_tones;
      state.paletteColorSlots = [];
      state.quadroActiveColorSlot = 0;
      state.quadroToneEdit = null;
      state.quadroColorUi = {};
      resetQuadrosPhotoColorAnalysis();
      delete state.selections.photo_orientation;
      delete state.selections.photo_help;
      delete state.selections.silhouette;
      delete state.selections.quadro_text;
      delete state.selections.quadro_description;
      delete state.selections.no_phrase;
      delete state.selections.quadro_super_example;
      delete state.selections.heart_finish;
      delete state.selections.frame_size;
      delete state.selections.heart_background_colors;
      delete state.selections.heart_background_color_tones;
      delete state.selections.heart_background_palette;
      delete state.selections.mia_choose_heart_background_colors;
      delete state.selections.quadro_dedication;
      delete state.selections.no_dedication;
      delete state.selections.quadro_silhouette_description;
      delete state.selections.silhouette_contact_me;
      delete state.selections.quadro_silhouette_text;
      delete state.selections.no_silhouette_text;
      delete state.selections.no_text;
      delete state.selections.baby_animal;
      delete state.selections.baby_custom_animal;
      delete state.selections.baby_gender;
      delete state.selections.baby_name;
      delete state.selections.baby_birth_date;
      delete state.selections.baby_birth_time;
      delete state.selections.baby_birth_weight;
      state.orderUploadMessage = "";
      state.orderUploadError = "";
      state.invalidFields = [];
    }

    state.selections[step.id] = input.value;
    if (Array.isArray(step.resetSelectionKeys)) {
      step.resetSelectionKeys.forEach(function (key) {
        delete state.selections[String(key)];
      });
    }
    if (Array.isArray(step.resetColorSteps)) {
      step.resetColorSteps.forEach(function (stepId) {
        var colorStep = findStep(state.product, String(stepId));
        if (colorStep) {
          quadrosResetColorUi(colorStep);
        }
      });
    }
    if (step.selection === "single") {
      var selectedDesign = (step.items || []).filter(function (item) {
        return item && item.value === input.value;
      })[0] || null;
      var defaults = selectedDesign && selectedDesign.defaultSelections && typeof selectedDesign.defaultSelections === "object"
        ? selectedDesign.defaultSelections
        : {};

      Object.keys(defaults).forEach(function (key) {
        state.selections[key] = cloneJson(defaults[key]);
      });
    }
    if (step.id === "size" && freeQuantityStep(state.product)) {
      var currentFreeQuantity = parseInt(state.selections.pack_quantity, 10) || 0;
      state.selections.pack_quantity = isMainCatalogProduct(state.product) && usesFlatUnitPricing(state.product)
        ? Math.max(effectiveMinimumFreeQuantity(state.product), currentFreeQuantity)
        : minimumFreeQuantity(state.product);
      delete state.selections.free_quantity_mode;
      state.quantitySignature = "";
      state.quantitiesTouched = false;
      state.quantityPackBaseline = 0;
      ensurePackAndQuantities(state.product);
    }
    if (step.id === "baby_animal" && input.value !== "Outro animal") {
      delete state.selections.baby_custom_animal;
    }
  }

  function detailsStepHasAnyInput(step) {
    var fields = step && Array.isArray(step.fields) ? step.fields : [];
    var attachments = step && step.mediaAttachments ? step.mediaAttachments : {};
    var configs = [attachments.photos, attachments.audio].filter(Boolean);
    var hasFieldValue = fields.some(function (field) {
      return field && String(state.selections[field.name] || "").trim();
    });

    if (step && step.skipOption && step.skipOption.selectionKey && state.selections[step.skipOption.selectionKey]) {
      return true;
    }

    if (step && step.selectableExamples === true && String(state.selections[step.exampleSelectionKey || "details_example"] || "").trim()) {
      return true;
    }

    if (hasFieldValue) {
      return true;
    }

    return configs.some(function (config) {
      var key = config.selectionKey || (config === attachments.audio ? "quadro_audio_uploads" : "quadro_reference_uploads");
      return orderUploadItems(key).length > 0;
    });
  }

  function orderStepHasMediaControls(step) {
    var attachments = step && step.mediaAttachments ? step.mediaAttachments : null;
    return !!(step && (
      step.template === "photo-upload" ||
      step.template === "original-artwork-upload" ||
      (attachments && (attachments.photos || attachments.audio))
    ));
  }

  function validateStep(product, step) {
    var field;
    var i;
    var missing = [];
    var total;
    var packQuantity;

    state.invalidFields = [];

    if (orderStepHasMediaControls(step) && (state.orderUploadBusy || orderAudioPendingStart || state.orderAudioRecording)) {
      return state.orderAudioRecording ? "Solta o botão do áudio para terminar a gravação." : "Espera até o anexo terminar de enviar.";
    }

    if (step.template === "assignment-picker" && assignmentPickerConfig(step)) {
      var assignmentConfig = assignmentPickerConfig(step);
      var assignmentItems = assignmentPickerItems(product, step);

      for (i = 0; i < assignmentConfig.groups.length; i += 1) {
        var assignmentGroup = assignmentConfig.groups[i];
        var assignmentField = String(assignmentGroup && assignmentGroup.field || "");
        var assignmentValue = assignmentField ? String(state.selections[assignmentField] || "") : "";
        var assignmentValid = assignmentValue && assignmentItems.some(function (item) {
          return assignmentPickerValue(assignmentGroup, item) === assignmentValue;
        });

        if (!assignmentValid) {
          state.invalidFields = assignmentField ? [assignmentField] : [];
          return String(step.groupSelectionError || "Atribui uma escolha ao {group} para continuar.")
            .replace("{group}", assignmentGroup.label || assignmentGroup.id || "tamanho");
        }
      }
      return "";
    }

    if (step.template === "designs-by-size") {
      var requiredGroups = designGroupsForStep(step);
      if (!requiredGroups.length) {
        return "Escolhe primeiro A4, A6 ou PACK.";
      }
      for (i = 0; i < requiredGroups.length; i += 1) {
        var requiredGroup = requiredGroups[i];
        var groupedField = groupedDesignField(step, requiredGroup);
        var groupedValue = groupedField ? String(state.selections[groupedField] || "") : "";
        var groupedValid = groupedValue && groupedDesignItems(step, requiredGroup).some(function (item) {
          return String(item.value || "") === groupedValue;
        });
        if (!groupedValid) {
          state.invalidFields = groupedField ? [groupedField] : [];
          return step.groupSelectionError
            ? String(step.groupSelectionError).replace("{group}", requiredGroup)
            : "Escolhe o design " + requiredGroup + " para continuar.";
        }
      }
      syncGroupedDesignSelections(product, step);

      // CONTINUOUS_CONFIGURATOR_V1: o passo visível também valida os passos
      // ligados que ficaram escondidos no wizard. O checkout continua a
      // receber e validar exactamente os mesmos campos de antes.
      if (continuousConfiguratorConfig(step)) {
        var continuousVariationStep = continuousConfiguratorStep(product, step, "variationStepId");
        var continuousExtrasStep = continuousConfiguratorStep(product, step, "extrasStepId");
        var continuousError;

        syncContinuousConfigurator(product, step);
        if (continuousVariationStep) {
          continuousError = validateStep(product, continuousVariationStep);
          if (continuousError) {
            return continuousError;
          }
        }
        if (continuousExtrasStep) {
          continuousError = validateStep(product, continuousExtrasStep);
          if (continuousError) {
            return continuousError;
          }
        }
      }
      return "";
    }

    if (step.id === "designs" && selectedDesignItems(product).length === 0 && !isAssortedSelected(product) && !isCustomArtworkSelected(product)) {
      if (isQuadrosProduct(product)) {
        return "Escolhe o tipo de moldura que queres criar.";
      }
      if (step.selectionError) {
        return String(step.selectionError);
      }
      if (isCadernosProduct(product)) {
        return "Escolhe uma capa.";
      }
      return "Escolhe pelo menos um design ou a opção Sortido";
    }

    if (step.template === "custom-product-builder") {
      return validateBuilderProductsStep(product);
    }

    if (step.template === "custom-quantity-builder") {
      return validateBuilderStep(product);
    }

    if (step.template === "original-artwork-upload") {
      var customConfig = customArtworkConfig(product);
      var customItems = orderUploadItems(customConfig.uploadKey);
      if (state.orderUploadBusy) {
        return "Espera até todos os ficheiros terminarem de enviar.";
      }
      if (!customItems.length) {
        state.invalidFields = [customConfig.uploadKey];
        return "Carrega pelo menos uma imagem ou um PDF para continuar.";
      }
      // No construtor a quantidade e o minimo pertencem a cada linha do passo
      // seguinte, que sabe qual e a tabela de precos de cada produto.
      if (isArtworkBuilderProduct(product)) {
        return "";
      }
      if (customItems.some(function (item) { return customArtworkItemQuantity(item) < 1; })) {
        state.invalidFields = [customConfig.uploadKey];
        return "Indica uma quantidade válida para cada design.";
      }
      if (!isCadernosProduct(product)) {
        // O total vem dos ficheiros, mas o mínimo do produto continua a valer:
        // abaixo do primeiro escalão não há preço, e o servidor recusaria.
        var minimoCustom = effectiveMinimumFreeQuantity(product);
        if (customArtworkTotalQuantity(product) < minimoCustom) {
          state.invalidFields = [customConfig.uploadKey];
          return "A encomenda mínima é de " + productQuantityLabel(product, minimoCustom) + ".";
        }
        state.selections.pack_quantity = customArtworkTotalQuantity(product);
      }
      return "";
    }

    if (isCadernosProduct(product) && step.id === "pack") {
      if (!selectedCadernoPurchaseOption(product)) {
        return "Escolhe uma opção de compra.";
      }
      if ((isMainCatalogProduct(product) && cadernoOrderQuantity(product) < 1)
          || (!isMainCatalogProduct(product) && cadernoOrderQuantityOptions(product).indexOf(cadernoOrderQuantity(product)) === -1)) {
        return "Escolhe uma quantidade válida.";
      }
      ensurePackAndQuantities(product);
      return "";
    }

    if (isCadernosProduct(product) && step.id === "cover_personalization") {
      if (!state.selections.cover_personalization) {
        return "Escolhe se queres personalizar a capa.";
      }

      if (state.selections.cover_personalization === "yes") {
        var personalizationText = cadernoPersonalizationText();
        var personalizationLimit = cadernoPersonalizationLimit(product);

        if (!personalizationText) {
          state.invalidFields = ["cover_personalization_text"];
          return "Escreve o nome ou frase para personalizar a capa.";
        }

        if (personalizationText.length > personalizationLimit) {
          state.invalidFields = ["cover_personalization_text"];
          return "O nome/frase tem de ter no máximo " + personalizationLimit + " caracteres.";
        }
      }

      return "";
    }

    if (step.id === "pack") {
      if (step.freeQuantity === true) {
        ensurePackAndQuantities(product);
        packQuantity = getPackQuantity(product);
        if (!packQuantity) {
          return "Indica uma quantidade válida (mínimo " + effectiveMinimumFreeQuantity(product) + ").";
        }
        if (!isCustomArtworkSelected(product)
            && !isAssortedSelected(product)
            && selectedDesignItems(product).length
            && quantityTotal(product) !== packQuantity) {
          return "Confirma a quantidade atribuída a cada design.";
        }
        return "";
      }
      ensurePackAndQuantities(product);
      total = quantityTotal(product);
      packQuantity = getPackQuantity(product);

      if (!packQuantity) {
        return "Escolhe um pack.";
      }

      if (isAssortedSelected(product)) {
        return "";
      }

      if (total !== packQuantity) {
        if (total < packQuantity && selectedDesignItems(product).length >= 3) {
          return "Ainda há unidades sem design.";
        }

        return total < packQuantity ? "Ainda faltam unidades por distribuir." : "Tens unidades a mais neste pack.";
      }
    }

    if (step.selection === "single" && step.field && step.id !== "designs" && step.template !== "palette-grid" && !state.selections[step.field]) {
      return step.selectionError ? String(step.selectionError) : "Escolhe uma opção para continuar.";
    }

    if (step.template === "palette-grid") {
      var colorKeys = quadrosColorSelectionKeys(step);
      if (state.selections[colorKeys.mia]) {
        return "";
      }
      var selectionLimit = paletteSelectionLimit(step);
      var selectedPalette = String(state.selections[colorKeys.palette] || "");
      var validPalette = (step.items || []).some(function (item) {
        return item && item.value === selectedPalette && paletteColors(item, selectionLimit).length === selectionLimit;
      });
      var individualValues = Array.isArray(state.selections[colorKeys.colors]) ? state.selections[colorKeys.colors] : [];
      var individualTones = Array.isArray(state.selections[colorKeys.tones]) ? state.selections[colorKeys.tones] : [];
      var allowedIndividualValues = (step.individualColors || []).map(function (item) { return item.value; });
      var validIndividuals = individualValues.length === selectionLimit && individualValues.every(function (value) {
        return allowedIndividualValues.indexOf(value) !== -1;
      });

      if (step.tonePicker === true && validIndividuals) {
        var exactPairs = {};
        validIndividuals = individualTones.length >= selectionLimit && individualValues.every(function (value, index) {
          var tone = Number(individualTones[index]);
          var pair = value + "\u0000" + tone;
          if (!Number.isInteger(tone) || tone < 0 || tone > 2 || exactPairs[pair]) {
            return false;
          }
          exactPairs[pair] = true;
          return true;
        });
      }

      if (!validPalette && !validIndividuals) {
        return step.selectionError || "Escolhe uma combinação ou exatamente " + (selectionLimit === 1 ? "uma cor" : selectionLimit === 2 ? "duas cores" : selectionLimit === 3 ? "três cores" : selectionLimit + " cores") + ".";
      }
      return "";
    }

    if (step.template === "option-drawers") {
      var stepDrawers = optionDrawersForStep(product, step);
      if (step.pastaDeFolhetosDetails) {
        var detailsVariationStep = pastaDeFolhetosDetailsVariationStep(product, step);
        var detailsGroups;
        syncPastaDeFolhetosDetailSelections(product, step);
        if (detailsVariationStep) {
          detailsGroups = pastaDeFolhetosDetailsGroups(step, detailsVariationStep);
          for (i = 0; i < detailsGroups.length; i += 1) {
            var detailsGroup = detailsGroups[i];
            var detailsField = groupedDesignField(detailsVariationStep, detailsGroup);
            var detailsValue = detailsField ? String(state.selections[detailsField] || "") : "";
            var detailsValid = detailsValue && groupedDesignItems(detailsVariationStep, detailsGroup).some(function (item) {
              return String(item.value || "") === detailsValue;
            });
            if (!detailsValid) {
              state.invalidFields = detailsField ? [detailsField] : [];
              return String(detailsVariationStep.groupSelectionError || "Escolhe a variação {group} para continuar.")
                .replace("{group}", detailsGroup);
            }
          }
        }
      }
      ensureOptionDrawerSelections(product);
      for (i = 0; i < stepDrawers.length; i += 1) {
        var optionDrawer = stepDrawers[i];
        var optionDrawerValue = optionDrawer && optionDrawer.field ? state.selections[optionDrawer.field] : "";
        if (!optionDrawer || !optionDrawer.field) {
          continue;
        }
        if (!optionDrawerValue && optionDrawer.required === true) {
          state.invalidFields = [optionDrawer.field];
          // A frase automatica sai do rotulo da gaveta e nem sempre soa bem
          // ("Escolhe capa."); com `selectionError` o JSON escreve a sua.
          return optionDrawer.selectionError
            || ("Escolhe " + String(optionDrawer.label || optionDrawer.title || "uma opção").toLowerCase() + ".");
        }
        if (optionDrawerValue && !optionDrawerItem(optionDrawer, optionDrawerValue, product)) {
          state.invalidFields = [optionDrawer.field];
          return "Uma das opções escolhidas deixou de estar disponível.";
        }
      }
      return "";
    }

    if (step.selection === "multi" && step.minSelections != null && selectedValues(step).length < Number(step.minSelections)) {
      return step.selectionError || "Escolhe mais opções para continuar.";
    }

    if (step.selection === "multi" && step.maxSelections != null && selectedValues(step).length > Number(step.maxSelections)) {
      return step.selectionError || "Escolheste opções a mais.";
    }

    if (step.selection === "single" && !state.selections[step.id]) {
      return "Escolhe uma opção.";
    }

    if (step.template === "details-form" || step.template === "photo-upload") {
      var stepFields = Array.isArray(step.fields) ? step.fields : [];
      for (i = 0; i < stepFields.length; i += 1) {
        field = stepFields[i];
        if (field.required && !String(state.selections[field.name] || "").trim()) {
          missing.push(field.name);
        }
        if (field.maxLength && String(state.selections[field.name] || "").length > Number(field.maxLength)) {
          state.invalidFields = [field.name];
          return field.maxLengthError || "O texto é demasiado longo.";
        }
      }

      if (missing.length) {
        state.invalidFields = missing;
        return "Preenche os campos obrigatórios.";
      }

      if (step.requireAnyInput && !detailsStepHasAnyInput(step)) {
        state.invalidFields = stepFields.length && stepFields[0].name ? [stepFields[0].name] : [];
        return step.requireAnyInputError || "Escreve uma mensagem, grava um áudio ou envia uma foto.";
      }
    }

    if (step.template === "photo-upload") {
      var uploadConfig = step.upload || {};
      var uploadKey = uploadConfig.selectionKey || "quadro_uploads";
      var uploadedItems = orderUploadItems(uploadKey);

      if (state.orderUploadBusy) {
        return "Espera até a foto terminar de enviar.";
      }
      if (uploadConfig.requiredUnlessHelp && uploadedItems.length === 0 && !state.selections[uploadConfig.helpKey || "photo_help"]) {
        state.invalidFields = [uploadKey];
        return "Escolhe uma foto ou assinala que precisas de ajuda para a enviar.";
      }
    }

    // DELIVERY_CONTACT_STEP_V1 + CONTACT_VALIDATION_V1: validação do novo
    // passo. Exige (1) escolha explícita de entrega, (2) campos
    // obrigatórios de contacto preenchidos, (3) que customer_contact seja
    // um email válido OU um número de telemóvel válido (regex em
    // validateContactInput).
    if (step.template === "delivery-contact") {
      if (!state.selections.delivery_option) {
        return "Escolhe como queres receber a tua encomenda.";
      }

      var contactFields = (step.contact && step.contact.fields) || [];
      for (i = 0; i < contactFields.length; i += 1) {
        field = contactFields[i];
        if (field.required && !String(state.selections[field.name] || "").trim()) {
          missing.push(field.name);
        }
      }

      if (missing.length) {
        state.invalidFields = missing;
        return "Preenche os dados de contacto.";
      }

      var contactError = validateContactInput(state.selections.customer_contact);
      if (contactError) {
        state.invalidFields = ["customer_contact"];
        return contactError;
      }

      if (!validNifInput(state.selections.customer_nif)) {
        state.invalidFields = ["customer_nif"];
        return "O NIF deve ter 9 dígitos.";
      }
    }

    return "";
  }

  function goNext(product) {
    var step = currentStep(product);
    var error = state.admin ? "" : validateStep(product, step);

    if (error) {
      // FUNNEL_TRACKING_V1: regista validações falhadas com o ID do passo.
      // TRANSITION_REASON_V1: marca que a próxima transição foi causada por
      // falha de validação (não vai haver, mas se houver redirect lateral...)
      var errCount = state.invalidFields && state.invalidFields.length ? state.invalidFields.length : 1;
      trackProductEvent(product, 'validation_error', {
        step_id: step ? step.id : '',
        step_index: state.currentStep,
        transition_reason: 'validation_failed',
        validation_error_count: errCount
      });
      state.errors = error;
      rerenderProduct(product);
      focusProductFirstError();
      return;
    }

    // FUNNEL_TRACKING_V1: passo concluído com sucesso. Em delivery_contact
    // dispara também contact_completed (funil mais granular).
    trackProductEvent(product, 'step_completed', {
      step_id: step ? step.id : '',
      step_index: state.currentStep
    });
    miuDispatchProductEvent("step-completed", {
      stepId: step ? String(step.id || "") : "",
      stepTemplate: step ? String(step.template || "") : ""
    });
    if (step && step.id === 'delivery_contact') {
      // FUNNEL_TRACKING_SQLITE_V2: deixou de enviar customer_name/email no
      // tracking. Os dados pessoais ficam em `orders` (Fase 2), não em
      // `funnel_events`. O contact_completed continua a ser registado
      // como marco do funil sem PII.
      trackProductEvent(product, 'contact_completed', {
        step_id: step.id
      });
    }

    if (step.id === "designs") {
      ensurePackAndQuantities(product);
    }

    state.errors = "";
    state.packDisabledMessage = "";
    state.orderUploadMessage = "";
    state.orderUploadFeedbackKind = "";
    setCurrentStep(product, state.currentStep + 1);
    pushWizardHistory(product);
    rerenderProduct(product);
  }

  // ORDER_MEDIA_REJECT_LOG_V1 — o lado do browser do log de recusas. Metade das
  // falhas de envio (tipo recusado, foto que não descodifica, ligação que
  // desiste) nunca chegam ao servidor, por isso não aparecem em
  // private/order-uploads/rejeicoes.log. Ficam aqui, com o `code` do servidor
  // quando houve resposta, para os dois lados se cruzarem.
  //
  // Na consola: `MiaUploadDebug.dump()`. Como o problema costuma ser no
  // telemóvel de outra pessoa, `MiaUploadDebug.copy()` devolve o texto pronto a
  // colar.
  function orderUploadFileInfo(file) {
    if (!file) {
      return null;
    }
    var bytes = Number(file.size) || 0;
    return {
      nome: String(file.name || "(sem nome)"),
      tipo: String(file.type || "(o browser não disse)"),
      bytes: bytes,
      mb: Math.round(bytes / 10485.76) / 100,
      modificado: file.lastModified ? new Date(file.lastModified).toISOString() : ""
    };
  }

  function logOrderUploadRejection(code, entry) {
    var record = Object.assign({
      code: String(code || "desconhecido"),
      quando: new Date().toISOString(),
      pagina: window.location.pathname + window.location.search,
      online: navigator.onLine !== false,
      ligacao: navigator.connection && navigator.connection.effectiveType ? navigator.connection.effectiveType : ""
    }, entry || {});

    orderUploadRejectionLog.push(record);
    if (orderUploadRejectionLog.length > 30) {
      orderUploadRejectionLog.shift();
    }
    try {
      if (window.console && window.console.error) {
        window.console.error("[mia] ficheiro recusado: " + record.code, record);
      }
    } catch (error) {}
    return record;
  }

  window.MiaUploadDebug = {
    rejeicoes: function () {
      return orderUploadRejectionLog.slice();
    },
    dump: function () {
      if (window.console && window.console.table && orderUploadRejectionLog.length) {
        window.console.table(orderUploadRejectionLog);
      }
      return orderUploadRejectionLog.slice();
    },
    copy: function () {
      return JSON.stringify({
        userAgent: navigator.userAgent,
        rejeicoes: orderUploadRejectionLog
      }, null, 2);
    },
    limpar: function () {
      orderUploadRejectionLog = [];
    }
  };

  function orderPhotoFileIsSupported(file, allowPdf) {
    var type = String(file && file.type || "").toLowerCase();
    var name = String(file && file.name || "").toLowerCase();
    if (allowPdf && (type === "application/pdf" || /\.pdf$/.test(name))) {
      return true;
    }
    return /^image\/(?:jpeg|png|webp|heic|heif)$/.test(type) || /\.(?:jpe?g|png|webp|heic|heif)$/.test(name);
  }

  function orderMediaConfigForStep(step, key, kind) {
    var direct = step && step.upload ? step.upload : null;
    var attachments = step && step.mediaAttachments ? step.mediaAttachments : {};
    var candidate = kind === "audio" ? attachments.audio : attachments.photos;
    if (direct && (direct.selectionKey || "quadro_uploads") === key) {
      return direct;
    }
    return candidate || {};
  }

  function loadOrderPhotoImage(file) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      var url = URL.createObjectURL(file);
      image.onload = function () {
        resolve({ image: image, url: url, width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("decode"));
      };
      image.src = url;
    });
  }

  var orderCanvasWebpEncodingSupported = null;

  function orderCanvasSupportsWebpEncoding() {
    var probe;
    if (orderCanvasWebpEncodingSupported !== null) {
      return orderCanvasWebpEncodingSupported;
    }
    try {
      probe = document.createElement("canvas");
      probe.width = 1;
      probe.height = 1;
      orderCanvasWebpEncodingSupported = probe.toDataURL("image/webp", 0.5).indexOf("data:image/webp") === 0;
    } catch (error) {
      orderCanvasWebpEncodingSupported = false;
    }
    return orderCanvasWebpEncodingSupported;
  }

  function orderCanvasBlob(canvas, quality) {
    var requestedType = orderCanvasSupportsWebpEncoding() ? "image/webp" : "image/jpeg";
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("encode"));
        }
      }, requestedType, quality);
    });
  }
