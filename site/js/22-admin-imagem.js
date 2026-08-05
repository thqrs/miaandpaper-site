// js/22-admin-imagem.js — parte 22/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: ajuste de imagens no admin por teclado: undo proprio, leitura/escrita dos numeros (zoom/posicao/rotacao/moldura), bindings de teclas.
  function beginAdminImageKeyboardUndo(product) {
    var active = state.adminActiveImage || {};
    var key = active.stepId + "::" + active.itemId;

    if (state.adminImageKeyboardUndoFor !== key) {
      pushUndo(product);
      state.adminImageKeyboardUndoFor = key;
    }

    if (state.adminImageKeyboardUndoTimer) {
      window.clearTimeout(state.adminImageKeyboardUndoTimer);
    }

    state.adminImageKeyboardUndoTimer = window.setTimeout(function () {
      state.adminImageKeyboardUndoFor = "";
      state.adminImageKeyboardUndoTimer = null;
    }, 900);
  }

  function applyAdminImageStyleToElement(element, item, side) {
    var defaultSize = element.classList.contains("option-image") ? 100 : 168;
    var prefix = side ? "side" : "";
    var zoomKey = prefix ? prefix + "ImageZoom" : "imageZoom";
    var posXKey = prefix ? prefix + "ImagePositionX" : "imagePositionX";
    var posYKey = prefix ? prefix + "ImagePositionY" : "imagePositionY";
    var rotKey = prefix ? prefix + "ImageRotation" : "imageRotation";
    var widthKey = prefix ? prefix + "FrameWidth" : "frameWidth";
    var heightKey = prefix ? prefix + "FrameHeight" : "frameHeight";
    var debugStep = state.product && element.dataset ? findStep(state.product, element.dataset.adminImageStep || element.dataset.miaStepId || "") : null;
    var storeItem = debugStep && element.dataset && element.dataset.adminImageStoreItem
      ? stepItemById(debugStep, element.dataset.adminImageStoreItem)
      : item;
    var sourceItem = element.dataset && element.dataset.miaEditKey
      ? imageSlotProxyItem(item, element.dataset.miaEditKey, element.dataset.miaFallbackEditKey || "", storeItem)
      : item;
    var frameWidth;
    var frameHeight;
    var appliedZoom = imageEditNumber(sourceItem, debugStep, side, zoomKey, defaultSize, 20, 500) / 100;
    var appliedX = imageEditNumber(sourceItem, debugStep, side, posXKey, 0, -100, 100);
    var appliedY = imageEditNumber(sourceItem, debugStep, side, posYKey, 0, -100, 100);
    var appliedRotation = imageEditNumber(sourceItem, debugStep, side, rotKey, 0, -180, 180);
    var debugPayload;
    var debugImage = element.dataset && element.dataset.miaImage ? element.dataset.miaImage : miaSlotDebugImage(sourceItem, side);

    element.style.setProperty("--image-zoom-scale", appliedZoom);
    element.style.setProperty("--image-position-x", appliedX + "%");
    element.style.setProperty("--image-position-y", appliedY + "%");
    element.style.setProperty("--image-rotation", appliedRotation + "deg");
    if (!element.classList.contains("crachas-size-card-proof-frame")) {
      frameWidth = frameEditNumber(sourceItem, debugStep, side, widthKey, element.offsetWidth || 70, 1, 2000);
      frameHeight = frameEditNumber(sourceItem, debugStep, side, heightKey, element.offsetHeight || 70, 1, 2000);
      element.style.setProperty("--frame-width-px", frameWidth + "px");
      element.style.width = frameWidth + "px";
      element.style.setProperty("--frame-height-px", frameHeight + "px");
      element.style.height = frameHeight + "px";
      if (frameWidth && frameHeight) {
        element.style.setProperty("--frame-aspect", frameWidth + " / " + frameHeight);
      }
    }
    debugPayload = miaSlotDebugFramePayload(sourceItem, debugStep, side, debugImage, {
      defaultZoom: defaultSize,
      zoom: appliedZoom,
      x: appliedX,
      y: appliedY,
      rotation: appliedRotation
    });
    miaSlotDebugApplyElementDataset(element, debugPayload);
  }

  function refreshAdminImageAdjustment(stepId, itemId, item, side) {
    var visualSelector = side ? "[data-admin-side-image-visual]" : "[data-admin-image-visual]";
    var editAttr = side ? "adminSideEdit" : "adminEdit";
    var editSelector = side ? "[data-admin-side-edit]" : "[data-admin-edit]";
    var keys = side
      ? ["sideFrameScale", "sideFrameWidth", "sideFrameHeight", "sideFrameMarginX", "sideFrameMarginY", "sideImageZoom", "sideImagePositionX", "sideImagePositionY", "sideImageRotation"]
      : ["frameScale", "frameWidth", "frameHeight", "frameMarginX", "frameMarginY", "imageZoom", "imagePositionX", "imagePositionY", "imageRotation"];
    var zoomKey = side ? "sideImageZoom" : "imageZoom";
    var rotKey = side ? "sideImageRotation" : "imageRotation";
    var active = state.adminActiveImage || {};

    document.querySelectorAll(visualSelector).forEach(function (element) {
      if (
        element.dataset.adminImageStep === stepId
        && element.dataset.adminImageItem === itemId
        && (!active.editKey || element.dataset.miaEditKey === active.editKey)
      ) {
        applyAdminImageStyleToElement(element, item, side);
      }
    });

    document.querySelectorAll(editSelector).forEach(function (input) {
      var key = input.dataset[editAttr];
      var sourceItem;
      if (input.dataset.stepId !== stepId || input.dataset.itemId !== itemId) {
        return;
      }
      if (active.editKey && input.dataset.miaEditKey && input.dataset.miaEditKey !== active.editKey) {
        return;
      }

      sourceItem = input.dataset.miaEditKey
        ? imageSlotProxyItem(item, input.dataset.miaEditKey, input.dataset.miaFallbackEditKey || "", stepItemById(findStep(state.product, stepId), input.dataset.adminImageStoreItemId || itemId))
        : item;

      if (keys.indexOf(key) !== -1) {
        if ((side ? miaSlotDebugSideFlatKeys : miaSlotDebugFlatKeys).indexOf(key) !== -1) {
          input.value = key === zoomKey
            ? imageEditNumber(sourceItem, findStep(state.product, stepId), side, key, 168, 20, 500)
            : imageEditNumber(sourceItem, findStep(state.product, stepId), side, key, 0, key === rotKey ? -180 : -100, key === rotKey ? 180 : 100);
        } else if ((side ? miaSlotDebugSideFrameKeys : miaSlotDebugFrameKeys).indexOf(key) !== -1) {
          input.value = key.indexOf("Scale") !== -1
            ? frameEditNumber(sourceItem, findStep(state.product, stepId), side, key, 100, 40, 300)
            : key.indexOf("Margin") !== -1
              ? frameEditNumber(sourceItem, findStep(state.product, stepId), side, key, 0, -100, 100)
              : frameEditNumber(sourceItem, findStep(state.product, stepId), side, key, 70, 1, 2000);
        } else {
          input.value = item[key] != null ? item[key] : (key === zoomKey ? itemImageNumber(item, key, 168, 20, 500) : itemImageNumber(item, key, 0, -180, 180));
        }
      }
    });

    [side ? "sideImagePositionX" : "imagePositionX", side ? "sideImagePositionY" : "imagePositionY", zoomKey, rotKey].forEach(function (key) {
      var target = document.querySelector('[data-admin-keyboard-value="' + key + '"]');
      if (target) {
        target.textContent = key === zoomKey
          ? imageEditNumber(item, findStep(state.product, stepId), side, key, 168, 20, 500)
          : imageEditNumber(item, findStep(state.product, stepId), side, key, 0, key === rotKey ? -180 : -100, key === rotKey ? 180 : 100);
      }
    });
  }

  function selectAdminImage(product, stepId, itemId, side, editKey, fallbackEditKey, imageStoreItemId) {
    var step = findStep(product, stepId);
    var item = step && step.items ? step.items.filter(function (candidate) {
      return candidate.id === itemId;
    })[0] : null;
    var hasImage = side ? isUploadedSideImage(item) : isUploadedImage(item);

    if (!item || !hasImage) {
      return;
    }

    state.adminActiveImage = {
      stepId: stepId,
      itemId: itemId,
      side: !!side,
      editKey: editKey || "",
      fallbackEditKey: fallbackEditKey || "",
      imageStoreItemId: imageStoreItemId || itemId
    };
    state.adminImageKeyboardUndoFor = "";
    rerenderProduct(product);
  }

  function activeAdminImageElement(active, side) {
    var selector = side ? "[data-admin-side-image-visual]" : "[data-admin-image-visual]";
    var found = null;

    document.querySelectorAll(selector).forEach(function (element) {
      if (
        !found
        && element.dataset.adminImageStep === active.stepId
        && element.dataset.adminImageItem === active.itemId
        && (!active.editKey || element.dataset.miaEditKey === active.editKey)
      ) {
        found = element;
      }
    });

    return found;
  }

  function adminImageCurrentNumber(product, record, key, fallback, min, max) {
    var item = record && record.item;
    var step = record && record.step;

    if (!record || !item) {
      return fallback;
    }

    return imageEditNumber(item, step, !!record.side, key, fallback, min, max);
  }

  function bindAdminImageKeyboard(product) {
    document.querySelectorAll("[data-admin-image-visual]").forEach(function (element) {
      element.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        selectAdminImage(product, element.dataset.adminImageStep, element.dataset.adminImageItem, false, element.dataset.miaEditKey || "", element.dataset.miaFallbackEditKey || "", element.dataset.adminImageStoreItem || "");
      });

      element.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          selectAdminImage(product, element.dataset.adminImageStep, element.dataset.adminImageItem, false, element.dataset.miaEditKey || "", element.dataset.miaFallbackEditKey || "", element.dataset.adminImageStoreItem || "");
        }
      });
    });

    document.querySelectorAll("[data-admin-side-image-visual]").forEach(function (element) {
      element.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        selectAdminImage(product, element.dataset.adminImageStep, element.dataset.adminImageItem, true, element.dataset.miaEditKey || "", element.dataset.miaFallbackEditKey || "", element.dataset.adminImageStoreItem || "");
      });

      element.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          selectAdminImage(product, element.dataset.adminImageStep, element.dataset.adminImageItem, true, element.dataset.miaEditKey || "", element.dataset.miaFallbackEditKey || "", element.dataset.adminImageStoreItem || "");
        }
      });
    });

    if (state.adminImageKeyboardBound) {
      return;
    }

    state.adminImageKeyboardBound = true;
    document.addEventListener("keydown", function (event) {
      var record;
      var item;
      var active;
      var baseKey = "";
      var actualKey = "";
      var delta = 0;
      var step = event.shiftKey ? 5 : 1;
      var current;
      var next;
      var prefix;
      var side;
      var activeElement;
      var editKey;

      if (!state.admin || !state.product || !state.adminActiveImage || adminKeyboardIgnoredTarget(event.target)) {
        return;
      }

      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(event.key) === -1) {
        return;
      }

      record = activeAdminImageRecord(state.product);
      if (!record) {
        return;
      }

      item = record.item;
      active = state.adminActiveImage;
      side = !!record.side;
      prefix = side ? "side" : "";
      activeElement = activeAdminImageElement(active, side);
      editKey = activeElement && activeElement.dataset ? activeElement.dataset.miaEditKey : "";

      if (event.ctrlKey) {
        if (event.key === "ArrowUp") { baseKey = "imageZoom"; delta = step; }
        else if (event.key === "ArrowDown") { baseKey = "imageZoom"; delta = -step; }
        else if (event.key === "ArrowLeft") { baseKey = "imageRotation"; delta = -step; }
        else if (event.key === "ArrowRight") { baseKey = "imageRotation"; delta = step; }
      } else {
        if (event.key === "ArrowLeft") { baseKey = "imagePositionX"; delta = -step; }
        else if (event.key === "ArrowRight") { baseKey = "imagePositionX"; delta = step; }
        else if (event.key === "ArrowUp") { baseKey = "imagePositionY"; delta = -step; }
        else if (event.key === "ArrowDown") { baseKey = "imagePositionY"; delta = step; }
      }

      if (!baseKey) {
        return;
      }

      actualKey = prefix ? prefix + baseKey.charAt(0).toUpperCase() + baseKey.slice(1) : baseKey;

      event.preventDefault();
      event.stopPropagation();

      if (!editKey) {
        return;
      }

      current = baseKey === "imageZoom"
        ? adminImageCurrentNumber(state.product, record, actualKey, 168, 20, 500)
        : adminImageCurrentNumber(state.product, record, actualKey, 0, baseKey === "imageRotation" ? -180 : -100, baseKey === "imageRotation" ? 180 : 100);
      next = clampAdminImageValue(baseKey, current + delta);

      if (next === current) {
        return;
      }

      beginAdminImageKeyboardUndo(state.product);
      writeImageEditSlot(record.storeItem || record.rawItem || item, editKey, actualKey, next);
      refreshAdminImageAdjustment(active.stepId, active.itemId, record.rawItem || item, side);
    });
  }


  function bindAdminItemEditing(product) {
    if (!state.admin) {
      return;
    }

    bindAdminImageKeyboard(product);

    document.querySelectorAll("[data-admin-add-item]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        var step = product.steps.filter(function (candidate) {
          return candidate.id === button.dataset.stepId;
        })[0];
        var count;
        var title;
        var subtitle;

        event.preventDefault();
        event.stopPropagation();

        if (!step) {
          return;
        }

        if (!Array.isArray(step.items)) {
          step.items = [];
        }

        count = step.items.length + 1;
        title = step.id === "designs" ? "Design " + String(count).padStart(2, "0") : "Nova opção";
        subtitle = "Editar texto";

        pushUndo(product);
        if (step.template === "palette-grid") {
          step.items.push({
            id: "paleta-" + Date.now(),
            value: "Nova combinação " + count,
            title: "Nova combinação " + count,
            palette: ["#173a63", "#e8d6b7", "#f5f1e7"]
          });
        } else if (step.template === "quantity-builder") {
          step.items.push({
            id: "pack-" + Date.now(),
            quantity: count,
            title: String(count),
            subtitle: productUnit(product)
          });
        } else {
          step.items.push({
            id: step.id + "-" + Date.now(),
            value: title + " - " + subtitle,
            title: title,
            subtitle: subtitle,
            visual: "neutral"
          });
        }
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-palette-color]").forEach(function (input) {
      input.addEventListener("click", function (event) { event.stopPropagation(); });
      input.addEventListener("change", function () {
        var step = product.steps.filter(function (candidate) { return candidate.id === input.dataset.stepId; })[0];
        var item = stepItemById(step, input.dataset.itemId);
        var index = Math.max(0, Math.min(2, parseInt(input.dataset.adminPaletteColor, 10) || 0));
        if (!item) {
          return;
        }
        pushUndo(product);
        if (!Array.isArray(item.palette)) {
          item.palette = ["#173a63", "#e8d6b7", "#f5f1e7"];
        }
        item.palette[index] = safeSwatchColor(input.value);
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-individual-color]").forEach(function (input) {
      input.addEventListener("click", function (event) { event.stopPropagation(); });
      input.addEventListener("change", function () {
        var step = product.steps.filter(function (candidate) { return candidate.id === input.dataset.stepId; })[0];
        var index = parseInt(input.dataset.adminIndividualColor, 10);
        if (!step) {
          step = currentStep(product);
        }
        if (!step || !Array.isArray(step.individualColors) || !step.individualColors[index]) {
          return;
        }
        pushUndo(product);
        step.individualColors[index].swatch = safeSwatchColor(input.value);
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-add-individual-color]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        var step = product.steps.filter(function (candidate) { return candidate.id === button.dataset.stepId; })[0];
        var count;
        event.preventDefault();
        event.stopPropagation();
        if (!step) {
          return;
        }
        if (!Array.isArray(step.individualColors)) {
          step.individualColors = [];
        }
        count = step.individualColors.length + 1;
        pushUndo(product);
        step.individualColors.push({ id: "cor-" + Date.now(), value: "Cor " + count, title: "Cor " + count, swatch: "#d8d1c2" });
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-delete-individual-color]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        var step = product.steps.filter(function (candidate) { return candidate.id === button.dataset.stepId; })[0];
        var index = parseInt(button.dataset.adminDeleteIndividualColor, 10);
        event.preventDefault();
        event.stopPropagation();
        if (!step || !Array.isArray(step.individualColors) || !step.individualColors[index]) {
          return;
        }
        pushUndo(product);
        step.individualColors.splice(index, 1);
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-section-title]").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("change", function () {
        var index = parseInt(input.dataset.adminSectionTitle, 10);
        var step = product && product.steps ? product.steps.filter(function (candidate) {
          return candidate.id === "designs";
        })[0] : null;
        var config = getStepSectionConfig(product, step);

        if (!config || !step) {
          return;
        }

        var sections = ensureStepSections(step, config.defaults);
        if (!sections[index]) {
          return;
        }

        pushUndo(product);
        sections[index].title = input.value || config.defaults[index].title;
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-section-prefix]").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("change", function () {
        var index = parseInt(input.dataset.adminSectionPrefix, 10);
        var step = product && product.steps ? product.steps.filter(function (candidate) {
          return candidate.id === "designs";
        })[0] : null;
        var config = getStepSectionConfig(product, step);

        if (!config || !step) {
          return;
        }

        var sections = ensureStepSections(step, config.defaults);
        if (!sections[index]) {
          return;
        }

        pushUndo(product);
        sections[index].labelPrefix = input.value || "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-edit]").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("change", function () {
        var step = product.steps.filter(function (candidate) {
          return candidate.id === input.dataset.stepId;
        })[0];
        var item = stepItemById(step, input.dataset.itemId);
        var imageStoreItem = stepItemById(step, input.dataset.adminImageStoreItemId || input.dataset.itemId);
        var editKey = input.dataset.miaEditKey || "";

        if (item) {
          pushUndo(product);
          if (input.dataset.adminEdit === "quantity") {
            item[input.dataset.adminEdit] = Math.max(1, parseInt(input.value, 10) || 1);
          } else if (["frameScale", "frameWidth", "frameHeight", "frameMarginX", "frameMarginY", "imageZoom", "imagePositionX", "imagePositionY", "imageRotation"].indexOf(input.dataset.adminEdit) !== -1) {
            if (miaSlotDebugFlatKeys.indexOf(input.dataset.adminEdit) !== -1 || miaSlotDebugFrameKeys.indexOf(input.dataset.adminEdit) !== -1) {
              writeImageEditSlot(imageStoreItem || item, editKey || miaSlotDebugEditKey(item, step, false), input.dataset.adminEdit, Number(input.value) || 0);
            } else {
              item[input.dataset.adminEdit] = Number(input.value) || 0;
            }
          } else if (input.dataset.adminEdit === "rectOrientation") {
            item.rectOrientation = input.value === "landscape" ? "landscape" : "portrait";
          } else if (input.dataset.adminEdit === "sectionOrder") {
            if (input.value.trim() === "") {
              delete item.sectionOrder;
            } else {
              item.sectionOrder = parseInt(input.value, 10);
              if (!isFinite(item.sectionOrder)) {
                delete item.sectionOrder;
              }
            }
          } else if (input.dataset.adminEdit === "sectionId") {
            item.sectionId = input.value;
          } else {
            item[input.dataset.adminEdit] = input.value;
          }
          rerenderProduct(product);
        }
      });
    });

    document.querySelectorAll("[data-admin-apply-frame]").forEach(function (button) {
      button.addEventListener("click", function () {
        var step = product.steps.filter(function (candidate) {
          return candidate.id === button.dataset.adminApplyFrame;
        })[0];
        var values = {};

        if (!step || !Array.isArray(step.items)) {
          return;
        }

        document.querySelectorAll('[data-admin-bulk-step="' + button.dataset.adminApplyFrame + '"]').forEach(function (input) {
          values[input.dataset.adminBulkFrame] = Number(input.value) || 0;
        });

        pushUndo(product);
        step.items.forEach(function (item) {
          var cover = selectedCadernoCover(product);
          var storeItem = item;
          var editKey = miaSlotDebugEditKey(item, step, false);

          if (isCadernosProduct(product) && cover && step.id === "lamination") {
            editKey = cadernoScopedImageEditKey(product, "lamination", cover, item.id, "main");
          } else if (isCadernosProduct(product) && cover && step.id === "pack") {
            storeItem = cadernoPurchaseGroupStoreItem(product, item) || item;
            editKey = cadernoScopedImageEditKey(product, "pack", cover, cadernoPurchaseImageGroup(item), "main");
          }

          writeImageEditSlot(storeItem, editKey, "frameScale", Math.max(40, Math.min(300, values.frameScale || 100)));
          writeImageEditSlot(storeItem, editKey, "frameMarginX", Math.max(-100, Math.min(100, values.frameMarginX || 0)));
          writeImageEditSlot(storeItem, editKey, "frameMarginY", Math.max(-100, Math.min(100, values.frameMarginY || 0)));
          writeImageEditSlot(storeItem, editKey, "imageZoom", Math.max(20, Math.min(500, values.imageZoom || 168)));
          writeImageEditSlot(storeItem, editKey, "imagePositionX", Math.max(-100, Math.min(100, values.imagePositionX || 0)));
          writeImageEditSlot(storeItem, editKey, "imagePositionY", Math.max(-100, Math.min(100, values.imagePositionY || 0)));
          writeImageEditSlot(storeItem, editKey, "imageRotation", Math.max(-180, Math.min(180, values.imageRotation || 0)));
        });
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-field-edit]").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("change", function () {
        var step = product.steps.filter(function (candidate) {
          return candidate.id === input.dataset.adminFieldStep;
        })[0];
        var field = step && step.fields ? step.fields[parseInt(input.dataset.adminFieldIndex, 10)] : null;
        var key = input.dataset.adminFieldEdit;

        if (field) {
          pushUndo(product);
          field[key] = input.type === "checkbox" ? input.checked : input.value;
          rerenderProduct(product);
        }
      });
    });

    document.querySelectorAll("[data-admin-upload]").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        var step = product.steps.filter(function (candidate) {
          return candidate.id === input.dataset.stepId;
        })[0];
        var item = step && step.items ? step.items.filter(function (candidate) {
          return candidate.id === input.dataset.itemId;
        })[0] : null;
        var reader;

        if (!file || !item || !/^image\//.test(file.type)) {
          return;
        }

        reader = new FileReader();
        reader.onload = function () {
          pushUndo(product);
          setAdminItemImage(product, step, item, String(reader.result || ""));
          rerenderProduct(product);
        };
        reader.readAsDataURL(file);
      });
    });

    // CRACHAS_STEP2_SIDE_PHOTO_ADMIN_V4: handlers paralelos para a foto direita.
    document.querySelectorAll("[data-admin-side-upload]").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        var step = product.steps.filter(function (candidate) {
          return candidate.id === input.dataset.stepId;
        })[0];
        var item = step && step.items ? step.items.filter(function (candidate) {
          return candidate.id === input.dataset.itemId;
        })[0] : null;
        var reader;

        if (!file || !item || !/^image\//.test(file.type)) {
          return;
        }

        reader = new FileReader();
        reader.onload = function () {
          pushUndo(product);
          item.sideImage = String(reader.result || "");
          rerenderProduct(product);
        };
        reader.readAsDataURL(file);
      });
    });

    document.querySelectorAll("[data-admin-side-clear]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        var step = product.steps.filter(function (candidate) {
          return candidate.id === button.dataset.stepId;
        })[0];
        var item = step && step.items ? step.items.filter(function (candidate) {
          return candidate.id === button.dataset.itemId;
        })[0] : null;

        event.preventDefault();
        event.stopPropagation();

        if (!item) {
          return;
        }

        pushUndo(product);
        delete item.sideImage;
        if (state.adminActiveImage && state.adminActiveImage.side && state.adminActiveImage.itemId === item.id) {
          state.adminActiveImage = null;
        }
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-side-edit]").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("change", function () {
        var step = product.steps.filter(function (candidate) {
          return candidate.id === input.dataset.stepId;
        })[0];
        var item = step && step.items ? step.items.filter(function (candidate) {
          return candidate.id === input.dataset.itemId;
        })[0] : null;
        var key;

        if (!item) {
          return;
        }

        key = input.dataset.adminSideEdit;
        pushUndo(product);
        if (["sideFrameScale", "sideFrameWidth", "sideFrameHeight", "sideFrameMarginX", "sideFrameMarginY", "sideImageZoom", "sideImagePositionX", "sideImagePositionY", "sideImageRotation"].indexOf(key) !== -1) {
          if (miaSlotDebugSideFlatKeys.indexOf(key) !== -1 || miaSlotDebugSideFrameKeys.indexOf(key) !== -1) {
            writeImageEditSlot(item, miaSlotDebugEditKey(item, step, true), key, Number(input.value) || 0);
          } else {
            item[key] = Number(input.value) || 0;
          }
        } else {
          item[key] = input.value;
        }
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-interior-upload]").forEach(function (input) {
      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("change", function () {
        var files = Array.prototype.slice.call(input.files || []).filter(function (file) {
          return /^image\//.test(file.type);
        });
        var step = product.steps.filter(function (candidate) {
          return candidate.id === input.dataset.stepId;
        })[0];
        var item = step && step.items ? step.items.filter(function (candidate) {
          return candidate.id === input.dataset.itemId;
        })[0] : null;
        var pending = files.length;
        var images = [];

        if (!item || !pending) {
          return;
        }

        files.forEach(function (file) {
          var reader = new FileReader();
          reader.onload = function () {
            images.push(String(reader.result || ""));
            pending -= 1;
            if (!pending) {
              pushUndo(product);
              item.interiorImages = (item.interiorImages || []).concat(images);
              rerenderProduct(product);
            }
          };
          reader.readAsDataURL(file);
        });
      });
    });

    document.querySelectorAll("[data-admin-interior-clear]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        var step;
        var item;

        event.preventDefault();
        event.stopPropagation();

        step = product.steps.filter(function (candidate) {
          return candidate.id === button.dataset.stepId;
        })[0];
        item = step && step.items ? step.items.filter(function (candidate) {
          return candidate.id === button.dataset.itemId;
        })[0] : null;

        if (!item) {
          return;
        }

        pushUndo(product);
        item.interiorImages = [];
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-admin-delete-item]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        var step;

        event.preventDefault();
        event.stopPropagation();

        step = product.steps.filter(function (candidate) {
          return candidate.id === button.dataset.stepId;
        })[0];

        if (step && step.items) {
          pushUndo(product);
          step.items = step.items.filter(function (item) {
            return item.id !== button.dataset.itemId;
          });
          rerenderProduct(product);
        }
      });
    });
  }

  function initHome() {
    Promise.all([
      loadJson(homeContentPath),
      homeContentPath === "content/home.json" ? Promise.resolve(null) : loadJson("content/home.json").catch(function () { return null; })
    ]).then(function (results) {
      var home = results[0];
      var menuHome = results[1] || home;

      state.siteMenuCategories = Array.isArray(menuHome.categories) ? menuHome.categories : [];
      applySiteSettings(home);
      if (window.MiaButterflies && window.MiaButterflies.refresh) {
        window.MiaButterflies.refresh();
      }
      return enrichHomeWithCarousels(home);
    }).then(renderHome).catch(function (error) {
      app.innerHTML = '<main class="fallback"><h1>Mia &amp; Paper</h1><p>' + escapeHtml(error.message) + '</p></main>';
    });
  }

  function applyContactProductContext() {
    var params;
    var productName;
    var form;
    var subject;
    var message;

    if (page !== "contact") {
      return;
    }
    params = new URLSearchParams(window.location.search);
    productName = String(params.get("produto") || "").trim().slice(0, 60);
    if (!productName) {
      return;
    }

    form = document.querySelector(".contact-form");
    subject = form ? form.querySelector("[name='subject_type']") : null;
    message = form ? form.querySelector("[name='message']") : null;
    if (subject) {
      subject.value = "Encomendas";
    }
    if (message && !String(message.value || "").trim()) {
      message.value = "Quero pedir " + productName + ".";
    }
  }

