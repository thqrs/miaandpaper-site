// js/13-quadros-cores.js — parte 13/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: paleta e tons dos quadros: quadrosColorUiFor, conversoes de cor (hexRgb/rgbLab/labSoften), tone strips, renderQuadrosColorPicker, analise de cor das fotos (quadrosPhotoBuckets).
  function quadrosColorUiFor(step, limit) {
    var key = String(step && step.id || "colors");
    var count = Math.max(1, parseInt(limit, 10) || paletteSelectionLimit(step));
    var map = state.quadroColorUi && typeof state.quadroColorUi === "object"
      ? state.quadroColorUi
      : (state.quadroColorUi = {});
    var ui = map[key];

    if (!ui || typeof ui !== "object") {
      ui = {
        slots: [],
        activeSlot: 0,
        pinnedSlot: null,
        pinnedChangeCount: 0,
        hintSlot: null,
        toneEdit: null
      };
      map[key] = ui;
    }
    if (!Number.isInteger(ui.activeSlot) || ui.activeSlot < 0 || ui.activeSlot >= count) {
      ui.activeSlot = 0;
    }
    if (!Number.isInteger(ui.pinnedSlot) || ui.pinnedSlot < 0 || ui.pinnedSlot >= count) {
      ui.pinnedSlot = null;
    }
    if (!Number.isInteger(ui.hintSlot) || ui.hintSlot < 0 || ui.hintSlot >= count) {
      ui.hintSlot = null;
    }
    return ui;
  }

  function quadrosResetColorUi(step) {
    if (state.quadroColorUi && step && step.id) {
      delete state.quadroColorUi[String(step.id)];
    }
    state.paletteColorSlots = [];
    state.quadroActiveColorSlot = 0;
    state.quadroToneEdit = null;
  }

  function quadrosNextEmptySlot(slots, fromIndex) {
    var count = Array.isArray(slots) ? slots.length : 0;
    var offset;

    for (offset = 1; offset < count; offset += 1) {
      var index = (fromIndex + offset) % count;
      if (!slots[index]) {
        return index;
      }
    }
    return null;
  }

  function paletteColors(item, requestedLimit) {
    var colors = item && Array.isArray(item.palette) ? item.palette : [];
    var limit = Math.max(1, parseInt(requestedLimit, 10) || 3);
    return colors.slice(0, limit).map(safeSwatchColor);
  }

  // Descobre a que família pertence cada cor de uma combinação. Além do swatch
  // (o tom principal), procura também nos tons claro e escuro configurados —
  // sem isso, uma combinação que use um tom claro ficava por reconhecer e
  // desaparecia da lista.
  function paletteIndividualValues(step, item, requestedLimit) {
    var colors = paletteColors(item, requestedLimit);
    var individualColors = step && Array.isArray(step.individualColors) ? step.individualColors : [];
    var values = colors.map(function (color) {
      var match = individualColors.filter(function (candidate) {
        return candidate && safeSwatchColor(candidate.swatch).toLowerCase() === color.toLowerCase();
      })[0] || individualColors.filter(function (candidate) {
        return candidate && Array.isArray(candidate.colorStops) && candidate.colorStops.some(function (stop) {
          return validHex(stop) && String(stop).toLowerCase() === color.toLowerCase();
        });
      })[0];
      return match ? match.value : "";
    });

    return values.every(Boolean) ? values : [];
  }

  function currentPaletteColorSlots(step, requestedLimit) {
    var limit = Math.max(1, parseInt(requestedLimit, 10) || paletteSelectionLimit(step));
    var keys = quadrosColorSelectionKeys(step);
    var selected = Array.isArray(state.selections[keys.colors]) ? state.selections[keys.colors].slice(0, limit) : [];
    var ui = step && step.tonePicker === true ? quadrosColorUiFor(step, limit) : null;
    var previous = ui && Array.isArray(ui.slots)
      ? ui.slots.slice(0, limit)
      : (Array.isArray(state.paletteColorSlots) ? state.paletteColorSlots.slice(0, limit) : []);
    var slots = Array.from({ length: limit }, function () { return ""; });

    if (step && step.useConfiguredColors === true) {
      if (previous.filter(Boolean).join("|") === selected.filter(Boolean).join("|")) {
        slots = previous.concat(Array.from({ length: Math.max(0, limit - previous.length) }, function () { return ""; })).slice(0, limit);
      } else {
        selected.forEach(function (value, index) {
          if (index < limit) { slots[index] = value; }
        });
      }
      if (ui) { ui.slots = slots.slice(); }
      state.paletteColorSlots = slots.slice();
      return slots;
    }

    previous.forEach(function (value, index) {
      if (value && selected.indexOf(value) !== -1 && slots.indexOf(value) === -1) {
        slots[index] = value;
      }
    });

    selected.forEach(function (value) {
      var emptyIndex;
      if (!value || slots.indexOf(value) !== -1) {
        return;
      }
      emptyIndex = slots.indexOf("");
      if (emptyIndex !== -1) {
        slots[emptyIndex] = value;
      }
    });

    if (ui) { ui.slots = slots.slice(); }
    state.paletteColorSlots = slots.slice();
    return slots;
  }

  function renderPaletteAdminControls(step, item) {
    if (!state.admin) {
      return "";
    }

    return [
      '<div class="admin-card-tools palette-admin-tools">',
      '<label>Nome<input type="text" value="' + escapeHtml(item.title || "") + '" data-admin-edit="title" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>',
      paletteColors(item).map(function (color, index) {
        return '<label>Cor ' + (index + 1) + '<input type="color" value="' + escapeHtml(color) + '" data-admin-palette-color="' + index + '" data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '"></label>';
      }).join(""),
      '<button type="button" data-admin-delete-item data-step-id="' + escapeHtml(step.id) + '" data-item-id="' + escapeHtml(item.id) + '">Remover combinação</button>',
      '</div>'
    ].join("");
  }

  // A água de cada quadrado é desenhada num <canvas> com física real (MiaWater,
  // mais abaixo). data-water-pour="1" faz o quadrado começar vazio e encher com
  // jorro + salpico; "0" já aparece cheio (só reage à inclinação); "drain"
  // aparece cheio e esvazia-se, para quando se retira a cor.
  function liquidCanvasMarkup(mode, duration) {
    return '<canvas class="pcs__canvas" data-water-pour="' + (mode === true ? "1" : (mode === "drain" ? "drain" : "0")) + '"'
      + (duration ? ' data-water-duration="' + duration + '"' : "")
      + '></canvas>';
  }

  // Ao desmarcar, o quadrado que reaparece por trás dos círculos ainda é o nó
  // do render anterior — traz o certo e a cor sólida do tom. Limpamo-lo já, ou
  // ele reaparecia marcado só para o re-render o desmarcar logo a seguir.
  function quadrosUnmarkFamilySquare(step, value) {
    var square = document.querySelector('[data-quadros-color-family="' + String(value).replace(/"/g, '\\"') + '"]');
    var checks = square ? square.querySelector(".quadros-checks") : null;
    var swatch = square ? square.querySelector("span") : null;
    var item = quadrosColorItem(step, value);

    if (!square) {
      return;
    }
    if (checks) {
      checks.parentNode.removeChild(checks);
    }
    square.classList.remove("is-toned");
    if (item && swatch) {
      swatch.style.setProperty("--individual-color", quadrosColorStops(item)[1]);
    }
  }

  // A água tem de começar a mexer no instante do clique, não no re-render que
  // só chega no fim da animação dos círculos. Por isso mexemos directamente no
  // quadrado da composição e deixamos a memória de preenchimento já actualizada,
  // para o re-render seguinte encontrar tudo no lugar e não reanimar nada.
  function quadrosPrimeSlotWater(step, index, color, duration) {
    var slot = document.querySelector('[data-quadros-color-slot="' + index + '"]');
    var fillKey = step.id + "-slots";
    var memory = paletteFillMemory[fillKey] || [];
    var canvas;

    memory[index] = color || "";
    paletteFillMemory[fillKey] = memory;
    if (!slot) {
      return;
    }
    canvas = slot.querySelector("canvas.pcs__canvas");
    if (canvas) {
      canvas.parentNode.removeChild(canvas);
    }
    if (color) {
      slot.classList.add("is-filled");
      slot.style.setProperty("--palette-preview-color", color);
      slot.insertAdjacentHTML("afterbegin", liquidCanvasMarkup(true, duration));
    } else {
      // A escoar: tira-se o "is-filled" para o fundo com o "?" ficar por baixo
      // da água, a ser revelado à medida que ela desce. A cor fica na variável,
      // que é de onde a canvas a lê.
      slot.classList.remove("is-filled");
      slot.insertAdjacentHTML("afterbegin", liquidCanvasMarkup("drain", duration));
    }
    miaWaterScan();
  }

  // Guarda as cores de cada slot do último render (por passo) para sabermos
  // qual slot foi mesmo escolhido agora — só esse faz a animação de encher.
  var paletteFillMemory = {};

  function hexRgb(value) {
    var hex = safeSwatchColor(value).slice(1);
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16)
    ];
  }

  function rgbHex(rgb) {
    return "#" + rgb.map(function (value) {
      return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
    }).join("");
  }

  function mixHex(value, target, amount) {
    var from = hexRgb(value);
    var to = hexRgb(target);
    var ratio = Math.max(0, Math.min(1, Number(amount) || 0));

    return rgbHex(from.map(function (channel, index) {
      return channel + (to[index] - channel) * ratio;
    }));
  }

  // --- Cor percetual (OKLab) -------------------------------------------------
  // Distâncias em RGB não têm nada a ver com o que o olho vê: um bege e um
  // verde-sálvia ficam "perto", dois azuis parecidos ficam "longe". O OKLab é
  // aproximadamente uniforme, por isso é nele que se comparam cores, se
  // escolhem os tons e se decide o que contrasta com o quê.

  function srgbToLinear(value) {
    var channel = Math.max(0, Math.min(1, value / 255));
    return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  }

  function linearToSrgb(value) {
    var channel = value <= 0.0031308
      ? value * 12.92
      : 1.055 * Math.pow(Math.max(0, value), 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(channel * 255)));
  }

  function rgbLab(rgb) {
    var r = srgbToLinear(rgb[0]);
    var g = srgbToLinear(rgb[1]);
    var b = srgbToLinear(rgb[2]);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  }

  function labRgb(lab) {
    var l = Math.pow(lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2], 3);
    var m = Math.pow(lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2], 3);
    var s = Math.pow(lab[0] - 0.0894841775 * lab[1] - 1.2914855480 * lab[2], 3);

    return [
      linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
    ];
  }

  function labChroma(lab) {
    return Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);
  }

  function labDistance(a, b) {
    var dl = a[0] - b[0];
    var da = a[1] - b[1];
    var db = a[2] - b[2];
    return Math.sqrt(dl * dl + da * da + db * db);
  }

  // Para decidir a que família uma cor pertence, a luminosidade quase não
  // conta: cada família tem um tom claro, um principal e um escuro, por isso o
  // claro/escuro resolve-se logo a seguir. Sem este desconto, um bege claro da
  // fotografia agarra-se ao verde-sálvia (que é claro) em vez do castanho
  // (que é a cor certa, e tem um tom claro à espera).
  function labFamilyDistance(a, b) {
    var dl = (a[0] - b[0]) * 0.35;
    var da = a[1] - b[1];
    var db = a[2] - b[2];
    return Math.sqrt(dl * dl + da * da + db * db);
  }

  function quadrosTonePalette(value) {
    var base = safeSwatchColor(value);
    return [
      mixHex(base, "#ffffff", 0.54),
      base,
      mixHex(base, "#241b10", 0.34)
    ];
  }

  function quadrosColorStops(item) {
    var base = safeSwatchColor(item && item.swatch);
    var configured = item && Array.isArray(item.colorStops)
      ? item.colorStops.slice(0, 3).map(function (color) {
        return validHex(color) ? String(color).toLowerCase() : "";
      })
      : [];

    if (configured.length === 3 && configured.every(Boolean)) {
      return configured;
    }

    return quadrosTonePalette(base);
  }

  function quadrosColorItem(step, value) {
    return (step && Array.isArray(step.individualColors) ? step.individualColors : []).filter(function (item) {
      return item && item.value === value;
    })[0] || null;
  }

  function quadrosColorModeInfo(step) {
    var hasPhoto = orderUploadItems("quadro_uploads").length > 0;
    var canUsePhoto = state.selections.designs === "Foto e Frase"
      && hasPhoto
      && !state.selections.photo_help;
    delete state.selections.quadro_color_mode;
    return { mode: canUsePhoto ? "photo" : "manual", canUsePhoto: canUsePhoto };
  }

  function quadrosToneSelections(step, limit) {
    var keys = quadrosColorSelectionKeys(step);
    var saved = Array.isArray(state.selections[keys.tones])
      ? state.selections[keys.tones].slice(0, limit)
      : [];
    var tones = Array.from({ length: limit }, function (_, index) {
      var tone = Number(saved[index]);
      return tone >= 0 && tone <= 2 ? tone : 1;
    });

    state.selections[keys.tones] = tones;
    return tones;
  }

  function quadrosToneLabel(tone) {
    return tone === 0 ? "claro" : (tone === 2 ? "escuro" : "principal");
  }

  // O quadrado que a próxima cor escolhida vai preencher. Há sempre um activo.
  function quadrosActiveColorSlot(step, limit) {
    var ui = quadrosColorUiFor(step, limit);
    var slot = Number(ui.activeSlot);
    if (!Number.isInteger(slot) || slot < 0 || slot >= limit) {
      slot = 0;
    }
    ui.activeSlot = slot;
    state.quadroActiveColorSlot = slot;
    return slot;
  }

  function quadrosPalettePreviewColors(step, limit) {
    var slots = currentPaletteColorSlots(step, limit);
    var tones = quadrosToneSelections(step, limit);

    return slots.map(function (value, index) {
      var item = quadrosColorItem(step, value);
      return item ? quadrosColorStops(item)[tones[index]] : "";
    }).slice(0, limit);
  }

  // Lugar de cada tom no triângulo: claro em cima, principal em baixo à
  // esquerda, escuro em baixo à direita.
  var QUADROS_TONE_SPOTS = ["top", "left", "right"];
  // Elemento a sério (e não ::after) para poder ser animado a entrar e a sair.
  var QUADROS_CHECK_MARKUP = '<i class="quadros-check" aria-hidden="true">✓</i>';

  function quadrosChecksMarkup(count) {
    if (count < 1) {
      return "";
    }
    return '<b class="quadros-checks" aria-hidden="true">'
      + Array.from({ length: count }, function () { return QUADROS_CHECK_MARKUP; }).join("")
      + '</b>';
  }

  function renderQuadrosToneSwatch(item, color, toneIndex, slot, selected) {
    var title = item.title || item.value;

    return '<button type="button" class="individual-color-choice quadros-tone-swatch quadros-tone-swatch--' + QUADROS_TONE_SPOTS[toneIndex] + (selected ? ' is-selected' : '') + '" data-quadros-tone="' + toneIndex + '" data-quadros-tone-value="' + escapeHtml(item.value) + '" data-quadros-tone-slot="' + slot + '" data-flip-key="tone:' + escapeHtml(item.value) + ':' + toneIndex + '" aria-pressed="' + (selected ? 'true' : 'false') + '" aria-label="Tom ' + quadrosToneLabel(toneIndex) + ' de ' + escapeHtml(title) + '"><span style="--individual-color:' + escapeHtml(color) + '" aria-hidden="true"></span></button>';
  }

  // Os 3 tons nascem do próprio quadrado clicado, que desaparece: ficam em
  // triângulo sobre a célula que vagou (claro em cima, principal em baixo à
  // esquerda, escuro em baixo à direita). Ver quadrosPlaceToneStrip.
  // "chosenTones" contém todos os tons desta família que já estão nos
  // quadrados. A mesma família pode repetir-se; o tom exacto é que é único.
  function renderQuadrosToneStrip(item, chosenTones, slot) {
    var stops = quadrosColorStops(item);
    var selected = Array.isArray(chosenTones) ? chosenTones : [];

    return [
      '<div class="quadros-tone-strip" data-quadros-tone-strip role="group" aria-label="Tom de ' + escapeHtml(item.title || item.value) + '">',
      renderQuadrosToneSwatch(item, stops[0], 0, slot, selected.indexOf(0) !== -1),
      renderQuadrosToneSwatch(item, stops[1], 1, slot, selected.indexOf(1) !== -1),
      renderQuadrosToneSwatch(item, stops[2], 2, slot, selected.indexOf(2) !== -1),
      '</div>'
    ].join("");
  }

  function renderQuadrosColorFamilies(step, slots, tones, activeSlot, toneEdit) {
    var editValue = toneEdit ? toneEdit.value : "";

    return (step.individualColors || []).map(function (item) {
      var expanded = item.value === editValue;
      var chosenHere = item.value === (slots[activeSlot] || "");
      var unavailable = item.availability === "unavailable";
      var stops = quadrosColorStops(item);
      var showName = step.showColorNames === true;
      var title = item.title || item.value;
      var selectedTones = slots.reduce(function (selected, value, index) {
        if (value === item.value && selected.indexOf(tones[index]) === -1) {
          selected.push(tones[index]);
        }
        return selected;
      }, []);
      // Escolhida: o quadrado passa a mostrar o tom exacto que ficou no
      // quadrado da composição, em vez do degradê dos três tons.
      var usedIndex = chosenHere ? activeSlot : slots.indexOf(item.value);
      var tone = usedIndex !== -1 ? tones[usedIndex] : -1;
      var label = title
        + (selectedTones.length ? ", escolhida, " + (selectedTones.length === 1 ? "tom " : "tons ")
          + selectedTones.map(quadrosToneLabel).join(", ") : "")
        + (unavailable ? " — indisponível no momento" : "");

      // Expandida, some: a célula fica livre para os 3 círculos. Continua no
      // DOM (invisível) para a grelha não refluir e para o FLIP saber de onde
      // os círculos devem nascer.
      return [
        '<button type="button" class="individual-color-choice quadros-color-family' + (showName ? ' has-color-name' : '') + (expanded ? ' is-expanded' : '') + (tone !== -1 ? ' is-toned' : '') + (unavailable ? ' is-disabled is-unavailable' : '') + '" data-quadros-color-family="' + escapeHtml(item.value) + '" data-color-id="' + escapeHtml(item.id || "") + '" data-flip-key="fam:' + escapeHtml(item.value) + '"' + (unavailable ? ' disabled' : '') + (expanded ? ' tabindex="-1" aria-hidden="true"' : '') + ' aria-pressed="' + (chosenHere ? 'true' : 'false') + '" aria-expanded="' + (expanded ? 'true' : 'false') + '" title="' + escapeHtml(label) + '" aria-label="' + escapeHtml(label) + '">',
        '<span style="--individual-color-light:' + escapeHtml(stops[0]) + ';--individual-color:' + escapeHtml(tone !== -1 ? stops[tone] : stops[1]) + ';--individual-color-dark:' + escapeHtml(stops[2]) + '" aria-hidden="true"></span>',
        showName ? '<strong>' + escapeHtml(title) + '</strong>' : "",
        quadrosChecksMarkup(selectedTones.length),
        '</button>'
      ].join("");
    }).join("");
  }

  // Fonte única das combinações mostradas: o render e o clique têm de ver a
  // mesma lista pela mesma ordem, senão o índice do botão aponta para outra.
  function quadrosSuggestedPaletteRecords(step, limit, mode) {
    var analysis = state.quadroPhotoColorAnalysis || {};

    var photo = mode === "photo" && analysis.status === "ready" && Array.isArray(analysis.palettes)
      ? analysis.palettes.filter(function (record) {
        return record && Array.isArray(record.values) && record.values.length === limit;
      })
      : [];

    return photo.length ? photo : quadrosDefaultPaletteRecords(step, limit);
  }

  function renderQuadrosSuggestedPalettes(step, limit, mode) {
    var keys = quadrosColorSelectionKeys(step);
    var tones = quadrosToneSelections(step, limit);
    var source = quadrosSuggestedPaletteRecords(step, limit, mode);

    return source.map(function (item, index) {
      // Mostra o tom exacto que vai ficar em cada quadrado. Antes mostrava o
      // degradê dos três tons da família, o que não dizia nada sobre o
      // resultado — e agora as sugestões já não são todas no tom principal.
      var colors = item.values.map(function (value, position) {
        var color = quadrosColorItem(step, value);
        return color
          ? quadrosColorStops(color)[item.tones ? item.tones[position] : 1]
          : "#d8d1c2";
      }).slice(0, limit);
      var selected = Array.isArray(state.selections[keys.colors])
        && item.values.join("|") === state.selections[keys.colors].slice(0, limit).join("|")
        && (item.tones || []).join("|") === tones.join("|");

      return [
        '<button class="palette-choice quadros-suggested-palette' + (selected ? ' is-selected' : '') + '" type="button" data-quadros-palette-index="' + index + '">',
        '<span class="palette-swatches" style="--palette-swatch-count:' + colors.length + '" aria-hidden="true">',
        colors.map(function (color) { return '<span style="--palette-color:' + escapeHtml(color) + '"></span>'; }).join(""),
        '</span>',
        '<strong>' + escapeHtml(item.title || "Combinação sugerida") + '</strong>',
        item.note ? '<small>' + escapeHtml(item.note) + '</small>' : "",
        '</button>'
      ].join("");
    }).join("");
  }

  function renderQuadrosPhotoColorPanel(step) {
    var upload = orderUploadItems("quadro_uploads")[0] || null;
    var analysis = state.quadroPhotoColorAnalysis || {};
    var showAnalysis = step && step.showPhotoColorAnalysis === true;
    var detected = Array.isArray(analysis.detected) && analysis.detected.length
      ? analysis.detected
      : ["#eee3cf", "#d8bf94", "#ad7c58", "#7a5144", "#45342d"];
    var status = analysis.status === "ready"
      ? "Sugestões prontas"
      : analysis.status === "error"
        ? (analysis.error || "Não foi possível analisar a fotografia.")
        : "A analisar a fotografia…";

    return [
      '<div class="quadros-photo-color-panel' + (showAnalysis ? '' : ' is-preview-only') + '">',
      '<div class="quadros-photo-color-preview">',
      upload ? '<img src="' + escapeHtml(orderUploadPreviewUrl(upload)) + '" alt="Fotografia enviada no passo anterior">' : "",
      '</div>',
      showAnalysis ? '<aside class="quadros-photo-color-analysis">' : "",
      showAnalysis ? [
      '<h3>Cores encontradas</h3>',
      '<p>' + (analysis.status === "ready"
        ? "Adaptámos as cores principais às opções disponíveis para as flores."
        : "Estamos a procurar as cores principais da fotografia.") + '</p>',
      '<div class="quadros-detected-colors" aria-label="Cores detectadas">',
      detected.slice(0, 5).map(function (color) {
        return '<span style="--detected-color:' + escapeHtml(safeSwatchColor(color)) + '"></span>';
      }).join(""),
      '</div>',
      '<p class="quadros-analysis-status" role="status">' + escapeHtml(status) + '</p>',
      '</aside>'
      ].join("") : "",
      '</div>'
    ].join("");
  }

  function renderQuadrosColorPicker(product, step) {
    var limit = paletteSelectionLimit(step);
    var keys = quadrosColorSelectionKeys(step);
    var ui = quadrosColorUiFor(step, limit);
    var suggestionsLabel = limit === 1 ? "Cores sugeridas" : "Combinações sugeridas";
    var miaChoiceLabel = limit === 1
      ? "Quero que a Mia escolha a cor por mim"
      : "Quero que a Mia escolha as cores por mim";
    var allowMiaChoice = step.allowMiaChoice !== false;
    var modeInfo = quadrosColorModeInfo(step);
    var mode = modeInfo.mode;
    var miaChooses = !!state.selections[keys.mia];
    var slots = miaChooses ? [] : currentPaletteColorSlots(step, limit);
    var tones = quadrosToneSelections(step, limit);
    var activeSlot = quadrosActiveColorSlot(step, limit);
    var previewColors = miaChooses ? [] : quadrosPalettePreviewColors(step, limit);
    var previewCount = previewColors.filter(Boolean).length;
    var fillKey = step.id + "-slots";
    var previous = paletteFillMemory[fillKey] || [];
    var suggestionsOpen = state.quadroColorSuggestionsOpen !== false;
    var suggested = renderQuadrosSuggestedPalettes(step, limit, mode);
    var toneItem;
    var isGradient = step.compositionStyle === "gradient" || (step.compositionStyleByField && Object.keys(step.compositionStyleByField).some(function (fieldName) {
      var mapping = step.compositionStyleByField[fieldName] || {};
      return mapping[String(state.selections[fieldName] || "")] === "gradient";
    }));
    var isGlitter = step.colorEffect === "glitter" || (step.colorEffectByField && Object.keys(step.colorEffectByField).some(function (fieldName) {
      var mapping = step.colorEffectByField[fieldName] || {};
      return mapping[String(state.selections[fieldName] || "")] === "glitter";
    }));

    state.paletteColorSlots = ui.slots.slice();
    state.quadroActiveColorSlot = ui.activeSlot;
    state.quadroToneEdit = ui.toneEdit;
    toneItem = ui.toneEdit && !miaChooses
      ? quadrosColorItem(step, ui.toneEdit.value)
      : null;

    paletteFillMemory[fillKey] = previewColors.slice();

    return [
      '<section class="palette-picker quadros-color-picker' + (isGradient ? ' is-gradient' : '') + (isGlitter ? ' is-glitter' : '') + '" data-quadros-color-mode-current="' + escapeHtml(mode) + '">',
      mode === "photo" ? renderQuadrosPhotoColorPanel(step) : "",
      '<div class="quadros-color-composition' + (ui.hintSlot !== null ? ' has-next-hint' : '') + '">',
      '<div class="palette-composition' + (isGradient ? ' is-gradient' : '') + '" style="--palette-slot-count:' + limit + '" aria-live="polite" aria-label="' + previewCount + ' de ' + limit + (limit === 1 ? ' cor escolhida' : ' cores escolhidas') + '">',
      Array.from({ length: limit }, function (_, index) {
        var color = previewColors[index] || "";
        var item = slots[index] ? quadrosColorItem(step, slots[index]) : null;
        var active = index === activeSlot;
        var label = (item
          ? (item.title || item.value) + ', tom ' + quadrosToneLabel(tones[index])
          : 'Quadrado por preencher')
          + (active ? '. Selecionado para alteração' : '. Clica para alterar esta cor');
        var hint = ui.hintSlot === index
          ? '<span class="quadros-next-color-hint" role="status">Toca aqui para escolheres a próxima cor</span>'
          : '';
        if (!color) {
          return '<button type="button" class="palette-composition__slot quadros-color-slot' + (active ? ' is-active' : '') + (hint ? ' has-next-hint' : '') + '" data-quadros-color-slot="' + index + '" aria-pressed="' + (active ? 'true' : 'false') + '" aria-label="' + escapeHtml(label) + '">' + hint + '</button>' + (isGradient && index === 0 ? '<span class="quadros-gradient-arrow" aria-hidden="true">→</span>' : '');
        }
        return '<button type="button" class="palette-composition__slot quadros-color-slot is-filled' + (active ? ' is-active' : '') + (hint ? ' has-next-hint' : '') + '" data-quadros-color-slot="' + index + '" aria-pressed="' + (active ? 'true' : 'false') + '" style="--palette-preview-color:' + escapeHtml(color) + '" aria-label="' + escapeHtml(label) + '">' + liquidCanvasMarkup(previous[index] !== color) + hint + '</button>' + (isGradient && index === 0 ? '<span class="quadros-gradient-arrow" aria-hidden="true">→</span>' : '');
      }).join(""),
      '</div>',
      // Setinha por baixo do quadrado activo, em vez de o cercar.
      '<span class="quadros-active-marker" style="--marker-shift:' + (activeSlot - (limit - 1) / 2) + '" aria-hidden="true"></span>',
      '</div>',
      '<div class="individual-color-grid quadros-color-family-grid" data-quadros-color-grid>'
        + renderQuadrosColorFamilies(step, slots, tones, activeSlot, ui.toneEdit)
        + (toneItem ? renderQuadrosToneStrip(
          toneItem,
          slots.reduce(function (selectedTones, value, index) {
            if (value === ui.toneEdit.value && selectedTones.indexOf(tones[index]) === -1) {
              selectedTones.push(tones[index]);
            }
            return selectedTones;
          }, []),
          ui.toneEdit.slot
        ) : "")
        + '</div>',
      '<button class="palette-suggestions-toggle" type="button" data-quadros-suggestions-toggle aria-expanded="' + (suggestionsOpen ? "true" : "false") + '"><span>' + suggestionsLabel + '</span><b aria-hidden="true">⌄</b></button>',
      '<div class="palette-suggestions' + (suggestionsOpen ? ' is-open' : '') + '"' + (suggestionsOpen ? "" : " hidden") + '>',
      '<div class="palette-grid">' + (suggested || '<p class="quadros-palette-empty">Ainda estamos a preparar as sugestões. Podes escolher as cores manualmente.</p>') + '</div>',
      '</div>',
      allowMiaChoice ? [
        '<label class="palette-mia-choice' + (miaChooses ? ' is-selected' : '') + '">',
        '<input type="checkbox" data-mia-color-choice' + (miaChooses ? ' checked' : '') + '>',
        '<span>' + miaChoiceLabel + '</span>',
        '</label>'
      ].join("") : "",
      '</section>'
    ].join("");
  }

  function renderPaletteGrid(product, step) {
    if (!state.admin && isQuadrosProduct(product) && step && step.tonePicker === true) {
      return renderQuadrosColorPicker(product, step);
    }

    var selectionLimit = paletteSelectionLimit(step);
    var miaChooses = !!state.selections.mia_choose_colors;
    var selectedPalette = miaChooses ? "" : String(state.selections.color_palette || "");
    var colorSlots = miaChooses
      ? Array.from({ length: selectionLimit }, function () { return ""; })
      : currentPaletteColorSlots(step, selectionLimit);
    var selectedColors = colorSlots.filter(Boolean);
    var limitReached = selectedColors.length >= selectionLimit;
    var individualColors = step.individualColors || [];
    var selectedPaletteItem = (step.items || []).filter(function (item) {
      return item && item.value === selectedPalette;
    })[0] || null;
    var previewColors = selectedColors.length
      ? colorSlots.map(function (value) {
        var item = individualColors.filter(function (candidate) {
          return candidate && candidate.value === value;
        })[0];
        return item ? safeSwatchColor(item.swatch) : "";
      }).slice(0, selectionLimit)
      : paletteColors(selectedPaletteItem, selectionLimit);
    var previewColorCount = previewColors.filter(Boolean).length;
    var colorChoiceText = selectionLimit === 1 ? "uma cor" : (selectionLimit === 2 ? "duas cores" : selectionLimit === 3 ? "três cores" : selectionLimit + " cores");
    var miaChoiceLabel = selectionLimit === 1 ? "Quero que a Mia escolha a cor" : "Quero que a Mia escolha as cores";
    var fillKey = step.id || "palette";
    var prevFill = paletteFillMemory[fillKey] || [];
    var previewSlots = Array.from({ length: selectionLimit }, function (_, index) {
      var color = previewColors[index] || "";
      if (!color) {
        return '<span class="palette-composition__slot" aria-label="Cor ' + (index + 1) + ' por escolher"></span>';
      }
      // Só anima o encher se este slot mudou desde o último render (cor nova
      // ou trocada); os que já estavam com a mesma cor ficam cheios e quietos.
      var animate = prevFill[index] !== color;
      return '<span class="palette-composition__slot is-filled" style="--palette-preview-color:' + escapeHtml(color) + '" aria-label="Cor ' + (index + 1) + ' escolhida">' + liquidCanvasMarkup(animate) + '</span>';
    }).join("");
    paletteFillMemory[fillKey] = Array.from({ length: selectionLimit }, function (_, index) {
      return previewColors[index] || "";
    });
    var palettes = (step.items || []).map(function (item) {
      var checked = selectedPalette === item.value;
      var suggestedColors = paletteColors(item, selectionLimit);
      var swatches = suggestedColors.map(function (color) {
        return '<span style="--palette-color:' + escapeHtml(color) + '"></span>';
      }).join("");

      return [
        '<div class="palette-choice-wrap">',
        '<label class="palette-choice' + (checked ? ' is-selected' : '') + '">',
        '<input type="radio" name="color_palette" value="' + escapeHtml(item.value) + '" data-palette-choice' + (checked ? ' checked' : '') + '>',
        '<span class="palette-swatches" style="--palette-swatch-count:' + suggestedColors.length + '" aria-hidden="true">' + swatches + '</span>',
        '<strong>' + escapeHtml(item.title || item.value) + '</strong>',
        '</label>',
        renderPaletteAdminControls(step, item),
        '</div>'
      ].join("");
    }).join("");
    var individual = individualColors.map(function (item, index) {
      var checked = selectedColors.indexOf(item.value) !== -1;
      var unavailable = item.availability === "unavailable";
      // Cheio já não bloqueia: clicar numa cor nova substitui o último quadrado
      // mexido (ver handler [data-individual-color]). Só as indisponíveis bloqueiam.
      var disabled = unavailable;

      return [
        '<div class="individual-color-wrap">',
        '<label class="individual-color-choice' + (checked ? ' is-selected' : '') + (disabled ? ' is-disabled' : '') + (unavailable ? ' is-unavailable' : '') + '" title="' + escapeHtml((item.title || item.value) + (unavailable ? ' — indisponível no momento' : '')) + '">',
        '<input type="checkbox" value="' + escapeHtml(item.value) + '" data-individual-color="' + index + '"' + (checked ? ' checked' : '') + (disabled ? ' disabled' : '') + ' aria-label="' + escapeHtml((item.title || item.value) + (unavailable ? ' — indisponível no momento' : '')) + '">',
        '<span style="--individual-color:' + escapeHtml(safeSwatchColor(item.swatch)) + '" aria-hidden="true"></span>',
        '</label>',
        '</div>'
      ].join("");
    }).join("");

    return [
      '<section class="palette-picker">',
      '<div class="palette-composition" style="--palette-slot-count:' + selectionLimit + '" aria-live="polite" aria-label="' + previewColorCount + ' de ' + selectionLimit + (selectionLimit === 1 ? ' cor escolhida' : ' cores escolhidas') + '">' + previewSlots + '</div>',
      '<div class="individual-color-heading"><h3>Escolhe ' + colorChoiceText + '</h3><span>' + previewColorCount + '/' + selectionLimit + '</span></div>',
      '<div class="individual-color-grid">' + individual + '</div>',
      state.admin ? '<a class="admin-add admin-colors-link" href="admin-colors.html" target="_blank" rel="noopener">Gerir cores e disponibilidade</a>' : '',
      '<button class="palette-suggestions-toggle" type="button" data-palette-suggestions-toggle aria-expanded="' + (state.colorSuggestionsOpen ? 'true' : 'false') + '"><span>' + (selectionLimit === 1 ? 'Cores sugeridas' : 'Combinações sugeridas') + '</span><b aria-hidden="true">⌄</b></button>',
      '<div class="palette-suggestions' + (state.colorSuggestionsOpen ? ' is-open' : '') + '"' + (state.colorSuggestionsOpen ? '' : ' hidden') + '>',
      '<div class="palette-grid">' + palettes + '</div>',
      state.admin ? '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar combinação</button>' : '',
      '</div>',
      '<label class="palette-mia-choice' + (miaChooses ? ' is-selected' : '') + '">',
      '<input type="checkbox" data-mia-color-choice' + (miaChooses ? ' checked' : '') + '>',
      '<span>' + miaChoiceLabel + '</span>',
      '</label>',
      '</section>'
    ].join("");
  }

  function orderUploadItems(key) {
    var items = state.selections[key];
    return Array.isArray(items) ? items.filter(function (item) {
      return item && item.token;
    }) : [];
  }

  function formatUploadSize(bytes) {
    var size = Math.max(0, Number(bytes) || 0);
    return size >= 1048576
      ? (size / 1048576).toFixed(size >= 10485760 ? 0 : 1).replace('.', ',') + ' MB'
      : Math.max(1, Math.round(size / 1024)) + ' KB';
  }

  function formatUploadSpeed(bytesPerSecond) {
    var speed = Math.max(0, Number(bytesPerSecond) || 0);
    if (!speed) {
      return "a calcular";
    }
    return formatUploadSize(speed) + "/s";
  }

  function formatUploadEta(seconds) {
    var remaining = Math.max(0, Math.ceil(Number(seconds) || 0));
    if (!remaining) {
      return "quase pronto";
    }
    if (remaining < 60) {
      return "cerca de " + remaining + " s";
    }
    return "cerca de " + Math.ceil(remaining / 60) + " min";
  }

  function renderOrderUploadProgress() {
    var progress = state.orderUploadProgress;
    var percent;
    var width;
    var detail;
    var fileText;

    if (!progress) {
      return "";
    }

    percent = Math.max(0, Math.min(100, Math.round(Number(progress.percent) || 0)));
    width = progress.phase === "upload" ? percent + "%" : "36%";
    fileText = progress.fileCount > 1
      ? "Ficheiro " + progress.fileIndex + " de " + progress.fileCount
      : "A enviar";
    detail = progress.phase === "upload"
      ? percent + "% · " + formatUploadSpeed(progress.speed) + " · " + formatUploadEta(progress.eta)
      : "A preparar o ficheiro…";

    return [
      '<div class="order-upload-progress' + (progress.phase === "upload" ? "" : " is-preparing") + '" data-order-upload-progress role="status" aria-live="polite">',
      '<div class="order-upload-progress__heading"><span data-order-upload-progress-label>' + escapeHtml(fileText) + '</span><strong data-order-upload-progress-detail>' + escapeHtml(detail) + '</strong></div>',
      '<div class="order-upload-progress__track" role="progressbar" aria-label="Progresso do envio" aria-valuemin="0" aria-valuemax="100"' + (progress.phase === "upload" ? ' aria-valuenow="' + percent + '"' : "") + '>',
      '<span data-order-upload-progress-fill style="width:' + width + '"></span>',
      '</div>',
      '</div>'
    ].join("");
  }

  function updateOrderUploadProgressDom() {
    var progress = state.orderUploadProgress;
    if (!progress) {
      return;
    }
    document.querySelectorAll("[data-order-upload-progress]").forEach(function (box) {
      var percent = Math.max(0, Math.min(100, Math.round(Number(progress.percent) || 0)));
      var label = box.querySelector("[data-order-upload-progress-label]");
      var detail = box.querySelector("[data-order-upload-progress-detail]");
      var track = box.querySelector('[role="progressbar"]');
      var fill = box.querySelector("[data-order-upload-progress-fill]");

      box.classList.toggle("is-preparing", progress.phase !== "upload");
      if (label) {
        label.textContent = progress.fileCount > 1
          ? "Ficheiro " + progress.fileIndex + " de " + progress.fileCount
          : "A enviar";
      }
      if (detail) {
        detail.textContent = progress.phase === "upload"
          ? percent + "% · " + formatUploadSpeed(progress.speed) + " · " + formatUploadEta(progress.eta)
          : "A preparar o ficheiro…";
      }
      if (track) {
        if (progress.phase === "upload") {
          track.setAttribute("aria-valuenow", String(percent));
        } else {
          track.removeAttribute("aria-valuenow");
        }
      }
      if (fill) {
        fill.style.width = progress.phase === "upload" ? percent + "%" : "36%";
      }
    });
  }

  function orderUploadPreviewUrl(item) {
    if (!item || !item.token) {
      return "";
    }
    return orderUploadPreviews[item.token] || ORDER_MEDIA_PREVIEW_API + "?token=" + encodeURIComponent(item.token);
  }

  function resetQuadrosPhotoColorAnalysis() {
    state.quadroPhotoColorAnalysis = {
      token: "",
      status: "idle",
      detected: [],
      palettes: [],
      error: ""
    };
  }

  // Lado maior a que a fotografia é reduzida antes de se contarem as cores.
  var QUADROS_PHOTO_SAMPLE_SIZE = 132;
  // Quantos grupos de cor se procuram na fotografia (usam-se os melhores).
  // 8 em vez de 6: com poucos grupos, uma cor viva com sombras dentro (flores
  // enroladas) fundia-se num tom escuro só, e o azul-royal saía marinho.
  var QUADROS_PHOTO_CLUSTERS = 8;
  // A mesma família pode entrar duas vezes com tons diferentes: castanho claro
  // + castanho escuro fica melhor do que forçar uma terceira família que já não
  // tem nada a ver com a fotografia. Repetir custa, mas não é proibido.
  var QUADROS_FAMILY_REUSE_LIMIT = 2;
  var QUADROS_FAMILY_REUSE_COST = 0.045;
  // Distância mínima entre as cores de uma combinação, para os três quadrados
  // não ficarem praticamente iguais. Baixo de propósito: separar demais afasta
  // a combinação da fotografia sem que ninguém veja diferença nas flores.
  var QUADROS_MIN_SEPARATION = 0.055;
  // Abaixo deste croma no tom principal, a família conta como neutra
  // (branco/creme, cinzento). É a família que é neutra, não o tom: o claro do
  // verde-sálvia é pálido, mas continua a ser verde.
  var QUADROS_NEUTRAL_CHROMA = 0.035;

  // Todos os tons escolhíveis: três por família disponível. O algoritmo antigo
  // só olhava para o swatch (o tom principal) e por isso nunca sugeria um claro
  // ou um escuro, mesmo quando era esse o tom que a fotografia pedia.
  function quadrosToneTargets(step) {
    var targets = [];

    (step && Array.isArray(step.individualColors) ? step.individualColors : []).forEach(function (item) {
      if (!item || item.availability === "unavailable") {
        return;
      }
      var neutral = labChroma(rgbLab(hexRgb(item.swatch))) < QUADROS_NEUTRAL_CHROMA;

      quadrosColorStops(item).forEach(function (color, tone) {
        var hex = safeSwatchColor(color);

        targets.push({
          value: item.value,
          id: item.id || "",
          tone: tone,
          hex: hex,
          neutral: neutral,
          lab: rgbLab(hexRgb(hex))
        });
      });
    });
    return targets;
  }

  function quadrosPickIsUsed(chosen, target) {
    return chosen.some(function (pick) {
      return pick.value === target.value && pick.tone === target.tone;
    });
  }

  // Escolhe o tom (família + claro/principal/escuro) que melhor representa uma
  // cor, respeitando o que já foi escolhido. São duas decisões diferentes e é
  // por isso que são feitas em separado: primeiro qual é a cor (a família, pelo
  // matiz), só depois quão clara ela é (o tom, pela luminosidade). Juntar as
  // duas numa só distância era o que fazia sair verde onde devia sair castanho.
  // As restrições relaxam por camadas: mais vale repetir uma família do que
  // devolver nada.
  function quadrosPickTone(targets, lab, chosen, options) {
    var settings = options || {};
    var toneBias = settings.toneBias || [0, 0, 0];
    // A fase do tom pode mirar noutra cor que não a da família — é assim que a
    // combinação suave clareia sem trocar de família pelo caminho.
    var toneLab = settings.toneLab || lab;
    var relaxations = [
      { separation: settings.separation === undefined ? QUADROS_MIN_SEPARATION : settings.separation,
        lightGap: settings.lightGap || 0,
        reuseLimit: settings.reuseLimit === undefined ? QUADROS_FAMILY_REUSE_LIMIT : settings.reuseLimit },
      { separation: 0.05, lightGap: 0, reuseLimit: QUADROS_FAMILY_REUSE_LIMIT },
      { separation: 0, lightGap: 0, reuseLimit: 3 }
    ];
    var best = null;

    relaxations.some(function (rules) {
      var allowed = targets.filter(function (target) {
        var used = chosen.filter(function (pick) { return pick.value === target.value; }).length;

        if (used >= rules.reuseLimit || quadrosPickIsUsed(chosen, target)) {
          return false;
        }
        return !chosen.some(function (pick) {
          return labDistance(pick.lab, target.lab) < rules.separation
            || Math.abs(pick.lab[0] - target.lab[0]) < rules.lightGap;
        });
      });
      var family = "";
      var familyCost = Infinity;

      allowed.forEach(function (target) {
        var used = chosen.filter(function (pick) { return pick.value === target.value; }).length;
        var cost = labFamilyDistance(lab, target.lab) + used * QUADROS_FAMILY_REUSE_COST;

        if (cost < familyCost) {
          familyCost = cost;
          family = target.value;
        }
      });
      if (!family) {
        return false;
      }

      var toneCost = Infinity;
      allowed.forEach(function (target) {
        var cost = labDistance(toneLab, target.lab) + (toneBias[target.tone] || 0);

        if (target.value === family && cost < toneCost) {
          toneCost = cost;
          best = target;
        }
      });
      return !!best;
    });

    return best;
  }

  // Completa uma combinação a que faltam quadrados: entra a família ainda não
  // usada que mais se afasta das já escolhidas, para não ficar tudo igual.
  function quadrosCompletePalette(targets, picks, limit) {
    while (picks.length < limit) {
      var best = null;
      var bestScore = -Infinity;

      targets.forEach(function (target) {
        var score;

        if (target.tone !== 1 || quadrosPickIsUsed(picks, target)) {
          return;
        }
        score = picks.length
          ? Math.min.apply(null, picks.map(function (pick) { return labDistance(pick.lab, target.lab); }))
          : 0;
        if (picks.some(function (pick) { return pick.value === target.value; })) {
          score -= QUADROS_FAMILY_REUSE_COST * 4;
        }
        if (score > bestScore) {
          bestScore = score;
          best = target;
        }
      });
      if (!best) {
        return picks;
      }
      picks.push(best);
    }
    return picks;
  }

  function quadrosPaletteRecord(title, note, picks, limit) {
    var clean = picks.filter(Boolean).slice(0, limit);

    return {
      title: title,
      note: note,
      values: clean.map(function (pick) { return pick.value; }),
      tones: clean.map(function (pick) { return pick.tone; }),
      palette: clean.map(function (pick) { return pick.hex; })
    };
  }

  // Clareia mantendo o matiz: sobe a luminosidade e baixa um pouco o croma,
  // que é o que distingue uma cor pastel da mesma cor cheia.
  function labSoften(lab, amount) {
    var mix = Math.max(0, Math.min(1, amount));

    return [
      lab[0] + (0.95 - lab[0]) * mix,
      lab[1] * (1 - mix * 0.55),
      lab[2] * (1 - mix * 0.55)
    ];
  }

  function buildQuadrosPhotoPalettes(step, detected, limit) {
    var targets = quadrosToneTargets(step);
    var records = [];
    var accent = detected.slice().sort(function (a, b) {
      return labChroma(b.lab) - labChroma(a.lab);
    })[0] || detected[0];
    var neutralTargets = targets.filter(function (target) {
      return target.neutral;
    });
    var picks;

    if (!targets.length || !detected.length) {
      return [];
    }

    // 1. As cores da fotografia, cada uma no tom que mais se aproxima.
    picks = [];
    detected.forEach(function (color) {
      var pick = picks.length < limit ? quadrosPickTone(targets, color.lab, picks, {}) : null;
      if (pick) { picks.push(pick); }
    });
    records.push(quadrosPaletteRecord(
      "Mais próxima da fotografia",
      "as cores que encontrámos na foto",
      quadrosCompletePalette(targets, picks, limit),
      limit
    ));

    // 2. As mesmas cores em versão pastel: a família continua a ser escolhida
    // pela cor original — só o tom é procurado a partir da versão clareada.
    picks = [];
    detected.forEach(function (color) {
      var pick = picks.length < limit
        ? quadrosPickTone(targets, color.lab, picks, {
          toneLab: labSoften(color.lab, 0.6),
          separation: 0.045,
          toneBias: [0, 0.1, 0.3]
        })
        : null;
      if (pick) { picks.push(pick); }
    });
    records.push(quadrosPaletteRecord(
      "Mais suave",
      "os mesmos tons, mais claros",
      quadrosCompletePalette(targets, picks, limit),
      limit
    ));

    // 3. Contraste: escuro, claro e principal, obrigando a uma diferença real de
    // luminosidade entre os quadrados em vez de trocar de família ao acaso.
    picks = [];
    detected.forEach(function (color, index) {
      var bias = index === 0 ? [0.16, 0.05, 0] : (index === 1 ? [0, 0.05, 0.16] : [0.06, 0, 0.06]);
      var pick = picks.length < limit
        ? quadrosPickTone(targets, color.lab, picks, { toneBias: bias, lightGap: 0.13 })
        : null;
      if (pick) { picks.push(pick); }
    });
    records.push(quadrosPaletteRecord(
      "Com mais contraste",
      "um tom escuro e um tom claro",
      quadrosCompletePalette(targets, picks, limit),
      limit
    ));

    // 4. Equilibrada: a cor dominante, um neutro do catálogo e a cor mais viva
    // da fotografia como acento.
    picks = [];
    picks.push(quadrosPickTone(targets, detected[0].lab, picks, {}));
    picks = picks.filter(Boolean);
    if (limit > 1 && neutralTargets.length) {
      var neutral = quadrosPickTone(neutralTargets, labSoften(detected[0].lab, 0.75), picks, { separation: 0.04 });
      if (neutral) { picks.push(neutral); }
    }
    if (limit > 2 && accent) {
      var vivid = quadrosPickTone(targets, accent.lab, picks, { toneBias: [0.06, 0, 0.04] });
      if (vivid) { picks.push(vivid); }
    }
    records.push(quadrosPaletteRecord(
      "Equilibrada",
      "a cor principal com um neutro",
      quadrosCompletePalette(targets, picks, limit),
      limit
    ));

    return quadrosDedupePalettes(records, limit);
  }

  // Duas regras diferentes podem chegar à mesma combinação (fotos de uma só
  // cor, por exemplo). Mostrar a mesma coisa duas vezes não ajuda ninguém.
  function quadrosDedupePalettes(records, limit) {
    var seen = [];

    return records.filter(function (record) {
      var key;
      if (!record || record.values.length !== limit) {
        return false;
      }
      key = record.values.map(function (value, index) {
        return value + "/" + record.tones[index];
      }).join("|");
      if (seen.indexOf(key) !== -1) {
        return false;
      }
      seen.push(key);
      return true;
    });
  }

  // As combinações fixas do catálogo, convertidas em famílias + tons. O hex de
  // cada cor é procurado entre todos os tons, não só entre os principais; se
  // não bater certo com nenhum, usa-se o tom perceptualmente mais próximo em
  // vez de deitar fora a combinação inteira, como acontecia antes.
  function quadrosDefaultPaletteRecords(step, limit) {
    var targets = quadrosToneTargets(step);

    if (!targets.length) {
      return [];
    }

    return (step && Array.isArray(step.items) ? step.items : []).map(function (item) {
      var picks = [];

      paletteColors(item, limit).forEach(function (color) {
        var exact = targets.filter(function (target) {
          return target.hex.toLowerCase() === color.toLowerCase() && !quadrosPickIsUsed(picks, target);
        })[0];
        var pick = exact || quadrosPickTone(targets, rgbLab(hexRgb(color)), picks, {
          separation: 0.02,
          reuseLimit: 3
        });

        if (pick) { picks.push(pick); }
      });
      return quadrosPaletteRecord(item.title || item.value, "", picks, limit);
    }).filter(function (record) {
      return record.values.length === limit;
    });
  }

  // Pele: num retrato ocupa metade da fotografia e nunca é uma boa cor de flor.
  // Não se exclui (uma foto pode ser quase só pele), reduz-se muito o peso. O
  // critério YCbCr apanha tons claros e escuros; o mínimo de vermelho sobre
  // azul mantém de fora os cremes e os beges frios, que são cores a sério.
  function quadrosIsSkinLike(r, g, b) {
    var cb = -0.169 * r - 0.331 * g + 0.5 * b + 128;
    var cr = 0.5 * r - 0.419 * g - 0.081 * b + 128;

    return cb >= 77 && cb <= 130 && cr >= 137 && cr <= 175 && r > g && g > b && r - b >= 28;
  }

  // Lê a fotografia e devolve baldes de cor com peso. O peso já traz dentro
  // tudo o que decide o que "conta" na foto: onde está o píxel, quão viva é a
  // cor e se é pele.
  function quadrosPhotoBuckets(img) {
    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d", { willReadFrequently: true });
    var sourceWidth = Math.max(1, img.naturalWidth || img.width || 1);
    var sourceHeight = Math.max(1, img.naturalHeight || img.height || 1);
    var scale = Math.min(1, QUADROS_PHOTO_SAMPLE_SIZE / Math.max(sourceWidth, sourceHeight));
    var width = Math.max(1, Math.round(sourceWidth * scale));
    var height = Math.max(1, Math.round(sourceHeight * scale));
    var buckets = {};
    var pixels;
    var index;
    var x;
    var y;

    canvas.width = width;
    canvas.height = height;
    context.drawImage(img, 0, 0, width, height);
    pixels = context.getImageData(0, 0, width, height).data;

    for (index = 0; index < pixels.length; index += 4) {
      var alpha = pixels[index + 3];
      if (alpha < 180) { continue; }

      var r = pixels[index];
      var g = pixels[index + 1];
      var b = pixels[index + 2];
      var lab = rgbLab([r, g, b]);
      // Fora o quase-branco e o quase-preto: são fundo, sombra ou papel, e não
      // existem como cor de flor.
      if (lab[0] < 0.2 || lab[0] > 0.955) { continue; }

      x = (index / 4) % width;
      y = Math.floor((index / 4) / width);
      var dx = ((x + 0.5) / width) * 2 - 1;
      var dy = ((y + 0.5) / height) * 2 - 1;
      // O motivo está no meio da fotografia; as bordas são quase sempre fundo.
      var radius = Math.min(1, Math.sqrt(dx * dx + dy * dy) / Math.SQRT2);
      var focus = 0.32 + 0.68 * Math.pow(1 - radius, 1.6);
      var weight = focus
        * (1 + Math.min(labChroma(lab), 0.22) * 5.5)
        * (quadrosIsSkinLike(r, g, b) ? 0.16 : 1);
      // Paredes, papel e fundos lavados sao a maior mancha de quase todas as
      // fotografias de clientes e quase nunca a cor que se quer nas flores:
      // pesam pouco, sem desaparecerem (uma foto toda em tons claros ainda
      // os pode escolher).
      if (lab[0] > 0.82 && labChroma(lab) < 0.03) { weight *= 0.25; }
      // Agrupar antes de analisar: 32 níveis por canal chegam para o resultado
      // e deixam o k-means a correr sobre uns milhares de baldes, não milhões.
      var key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      var bucket = buckets[key];

      if (bucket) {
        bucket.lab[0] += lab[0] * weight;
        bucket.lab[1] += lab[1] * weight;
        bucket.lab[2] += lab[2] * weight;
        bucket.weight += weight;
      } else {
        buckets[key] = {
          lab: [lab[0] * weight, lab[1] * weight, lab[2] * weight],
          weight: weight
        };
      }
    }

    return Object.keys(buckets).map(function (key) {
      var bucket = buckets[key];
      return {
        lab: bucket.lab.map(function (sum) { return sum / bucket.weight; }),
        weight: bucket.weight
      };
    });
  }

  // k-means em OKLab. Substitui o arredondamento em blocos de 24 do algoritmo
  // antigo, que partia a mesma cor por vários baldes e depois escolhia as
  // dominantes por ordem de contagem — daí saírem cinco variações do mesmo bege.
  // A inicialização é determinística (k-means++ sem sorteio): a mesma fotografia
  // dá sempre a mesma sugestão.
  function quadrosClusterBuckets(buckets, count) {
    var centroids = [];
    var iteration;

    if (!buckets.length) {
      return [];
    }

    centroids.push(buckets.reduce(function (best, bucket) {
      return bucket.weight > best.weight ? bucket : best;
    }, buckets[0]).lab.slice());

    while (centroids.length < count) {
      var seed = null;
      var seedScore = 0;

      buckets.forEach(function (bucket) {
        var nearest = Math.min.apply(null, centroids.map(function (centroid) {
          return labDistance(bucket.lab, centroid);
        }));
        var score = bucket.weight * nearest * nearest;

        if (score > seedScore) {
          seedScore = score;
          seed = bucket;
        }
      });
      if (!seed) { break; }
      centroids.push(seed.lab.slice());
    }

    for (iteration = 0; iteration < 14; iteration += 1) {
      var sums = centroids.map(function () { return [0, 0, 0, 0]; });
      var moved = 0;

      buckets.forEach(function (bucket) {
        var bestIndex = 0;
        var bestDistance = Infinity;

        centroids.forEach(function (centroid, centroidIndex) {
          var distance = labDistance(bucket.lab, centroid);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = centroidIndex;
          }
        });
        sums[bestIndex][0] += bucket.lab[0] * bucket.weight;
        sums[bestIndex][1] += bucket.lab[1] * bucket.weight;
        sums[bestIndex][2] += bucket.lab[2] * bucket.weight;
        sums[bestIndex][3] += bucket.weight;
      });

      sums.forEach(function (sum, centroidIndex) {
        var next;
        if (sum[3] <= 0) { return; }
        next = [sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3]];
        moved = Math.max(moved, labDistance(next, centroids[centroidIndex]));
        centroids[centroidIndex] = next;
      });
      if (moved < 0.002) { break; }
    }

    var weights = centroids.map(function () { return 0; });

    buckets.forEach(function (bucket) {
      var bestIndex = 0;
      var bestDistance = Infinity;

      centroids.forEach(function (centroid, centroidIndex) {
        var distance = labDistance(bucket.lab, centroid);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = centroidIndex;
        }
      });
      weights[bestIndex] += bucket.weight;
    });

    return centroids.map(function (centroid, centroidIndex) {
      return { lab: centroid, weight: weights[centroidIndex] };
    }).filter(function (cluster) {
      return cluster.weight > 0;
    });
  }

  // Junta grupos que ficaram perto demais e ordena pelo que mais se nota.
  // A área ocupada mandava (peso × pequeno bónus de croma) e o resultado era o
  // fundo — parede, papel, céu lavado — à cabeça de quase todas as fotografias,
  // com as flores a sério em terceiro. Agora manda o carácter: a raiz do peso
  // trava o domínio da área, o croma multiplica, e as cores vivas passam
  // sempre à frente dos neutros — os neutros só lideram quando a fotografia
  // não tem nenhuma cor viva.
  function quadrosClusterSalience(cluster) {
    return Math.pow(cluster.weight, 0.6)
      * (0.03 + Math.min(labChroma(cluster.lab), 0.25) * 2.2);
  }

  function quadrosRankClusters(clusters) {
    var merged = [];

    clusters.slice().sort(function (a, b) {
      return b.weight - a.weight;
    }).forEach(function (cluster) {
      var near = merged.filter(function (other) {
        return labDistance(other.lab, cluster.lab) < 0.055;
      })[0];

      if (near) {
        near.weight += cluster.weight;
        return;
      }
      merged.push({ lab: cluster.lab.slice(), weight: cluster.weight });
    });

    merged.sort(function (a, b) {
      return quadrosClusterSalience(b) - quadrosClusterSalience(a);
    });

    var vivid = merged.filter(function (cluster) { return labChroma(cluster.lab) >= 0.05; });
    var pale = merged.filter(function (cluster) { return labChroma(cluster.lab) < 0.05; });

    return vivid.concat(pale);
  }

  function analyseQuadrosPhoto(img, step) {
    var limit = paletteSelectionLimit(step);
    var detected = quadrosRankClusters(
      quadrosClusterBuckets(quadrosPhotoBuckets(img), QUADROS_PHOTO_CLUSTERS)
    );

    // Fotografia praticamente monocromática: em vez de inventar beges fixos,
    // derivam-se variações da própria cor encontrada.
    while (detected.length && detected.length < 3) {
      detected.push({
        lab: labSoften(detected[0].lab, 0.3 * detected.length),
        weight: detected[0].weight / (detected.length + 1)
      });
    }

    return {
      detected: detected.slice(0, 5).map(function (cluster) { return rgbHex(labRgb(cluster.lab)); }),
      palettes: buildQuadrosPhotoPalettes(step, detected, limit)
    };
  }

  function applyQuadrosSuggestedPalette(step, record) {
    var limit = paletteSelectionLimit(step);
    var keys = quadrosColorSelectionKeys(step);
    var ui = quadrosColorUiFor(step, limit);
    var values = record && Array.isArray(record.values) ? record.values.slice(0, limit) : [];
    var tones = record && Array.isArray(record.tones) ? record.tones.slice(0, limit) : [];
    if (values.length !== limit) {
      return false;
    }

    delete state.selections.quadro_color_mode;
    state.selections[keys.palette] = record.title || "";
    state.selections[keys.colors] = values;
    // A sugestão traz o tom de cada cor. Antes forçava-se sempre o principal,
    // o que deitava fora metade do trabalho de escolher a cor certa.
    state.selections[keys.tones] = Array.from({ length: limit }, function (_, index) {
      var tone = Number(tones[index]);
      return tone >= 0 && tone <= 2 ? tone : 1;
    });
    state.selections[keys.mia] = false;
    ui.slots = values.slice();
    ui.activeSlot = 0;
    ui.pinnedSlot = null;
    ui.pinnedChangeCount = 0;
    ui.hintSlot = null;
    ui.toneEdit = null;
    state.paletteColorSlots = values.slice();
    state.paletteLastSlot = Math.max(0, values.length - 1);
    state.quadroActiveColorSlot = 0;
    state.quadroToneEdit = null;
    return true;
  }

  function initQuadrosPhotoColorAnalysis(product, step) {
    var upload;
    var token;
    var analysis;
    var image;

    if (!isQuadrosProduct(product) || !step || step.id !== "colors"
        || quadrosColorModeInfo(step).mode !== "photo") {
      return;
    }

    upload = orderUploadItems("quadro_uploads")[0] || null;
    if (!upload) {
      return;
    }
    token = String(upload.token || "");
    analysis = state.quadroPhotoColorAnalysis || {};
    if (analysis.token === token && (analysis.status === "loading" || analysis.status === "ready")) {
      return;
    }

    state.quadroPhotoColorAnalysis = {
      token: token,
      status: "loading",
      detected: [],
      palettes: [],
      error: ""
    };
    image = new Image();
    image.onload = function () {
      var result;
      try {
        result = analyseQuadrosPhoto(image, step);
      } catch (error) {
        state.quadroPhotoColorAnalysis.status = "error";
        state.quadroPhotoColorAnalysis.error = "Não foi possível analisar a fotografia, mas podes escolher as cores manualmente.";
        if (state.product === product) { rerenderProduct(product); }
        return;
      }

      state.quadroPhotoColorAnalysis = {
        token: token,
        status: "ready",
        detected: result.detected,
        palettes: result.palettes,
        error: ""
      };
      if (quadrosColorModeInfo(step).canUsePhoto && result.palettes[0]) {
        applyQuadrosSuggestedPalette(step, result.palettes[0]);
      }
      if (state.product === product) { rerenderProduct(product); }
    };
    image.onerror = function () {
      state.quadroPhotoColorAnalysis.status = "error";
      state.quadroPhotoColorAnalysis.error = "Não foi possível abrir a fotografia, mas podes escolher as cores manualmente.";
      if (state.product === product) { rerenderProduct(product); }
    };
    image.src = orderUploadPreviewUrl(upload);
  }

  function orderUploadMeta(item, kind) {
    var text = formatUploadSize(item && item.size);
    var dpi = Math.max(0, Math.round(Number(item && item.dpi) || 0));
    if (kind === "photo" && dpi) {
      text += " (" + dpi + " DPI estimados para 10 × 15 in)";
    }
    return text;
  }

  function orderUploadMaxFiles(config) {
    var configured = Number(config && config.maxFiles);
    if (configured === 0) {
      return Infinity;
    }
    return Math.max(1, configured || ((config && config.multiple === true) ? 5 : 1));
  }

  function renderOrderUploadList(config, kind) {
    var key = config.selectionKey || (kind === "audio" ? "quadro_audio_uploads" : "quadro_uploads");
    return orderUploadItems(key).map(function (item) {
      var preview = orderUploadPreviewUrl(item);
      var isPdf = String(item && item.mime || "").toLowerCase() === "application/pdf"
        || /\.pdf$/i.test(String(item && item.name || ""));
      var media = kind === "audio"
        ? '<audio controls preload="metadata" src="' + escapeHtml(preview) + '"></audio>'
        : (isPdf ? '<span class="order-upload-pdf" aria-hidden="true">PDF</span>' : '<img src="' + escapeHtml(preview) + '" alt="">');
      var fallbackName = kind === "audio" ? "Áudio" : (kind === "artwork" ? "Design" : "Foto");
      var removeLabel = kind === "audio" ? "Remover áudio" : (kind === "artwork" ? "Remover design" : "Remover foto");
      var quantity = customArtworkItemQuantity(item);
      var feeCents = config.hideFee === true
        ? 0
        : Math.max(0, parseInt(config.feePerFileCents, 10) || parseInt(item && item.feeCents, 10) || 0);
      var quantityControl = "";
      var feeText = "";

      if (config.showQuantity === true) {
        quantityControl = '<label class="artwork-upload-quantity"><span>Quantidade com este design</span><input type="number" min="1" max="9999" step="1" value="' + quantity + '" data-artwork-upload-quantity data-order-upload-key="' + escapeHtml(key) + '" data-order-upload-token="' + escapeHtml(item.token) + '"></label>';
      }
      if (feeCents) {
        feeText = '<small class="artwork-upload-fee"><strong>+' + escapeHtml(formatCents(feeCents)) + '</strong> — ' + escapeHtml(config.feeText || "Preparação do ficheiro e testes antes da produção.") + '</small>';
      }

      return [
        '<li class="order-upload-item order-upload-item--' + escapeHtml(kind) + (isPdf ? ' is-pdf' : '') + '">',
        media,
        '<span><strong>' + escapeHtml(item.name || fallbackName) + '</strong><small>' + escapeHtml(orderUploadMeta(item, kind)) + '</small>' + feeText + quantityControl + '</span>',
        '<button type="button" data-order-upload-remove="' + escapeHtml(item.token) + '" data-order-upload-key="' + escapeHtml(key) + '" aria-label="' + escapeHtml(removeLabel) + '" title="' + escapeHtml(removeLabel) + '">×</button>',
        '</li>'
      ].join("");
    }).join("");
  }

  function renderOrderUploadStatus(kind) {
    if (kind && state.orderUploadFeedbackKind && state.orderUploadFeedbackKind !== kind) {
      return "";
    }
    return [
      state.orderUploadBusy && state.orderUploadProgress ? renderOrderUploadProgress() : '',
      state.orderUploadBusy && !state.orderUploadProgress ? '<p class="order-upload-status" role="status">A processar…</p>' : '',
      state.orderUploadError ? siteErrorMarkup(state.orderUploadError, "form-error order-upload-error order-upload-popup") : '',
      state.orderUploadMessage ? '<p class="order-upload-status" role="status">' + escapeHtml(state.orderUploadMessage) + '</p>' : ''
    ].join("");
  }

  function orderUploadHelperText(config, artworkMode, multiple, maxFiles, itemCount) {
    var messages = config && config.helperTextByUploadCount;
    var template = "";
    var remaining = isFinite(maxFiles) ? Math.max(0, maxFiles - itemCount) : 0;

    if (messages && typeof messages === "object") {
      if (isFinite(maxFiles) && itemCount >= maxFiles && messages.full) {
        template = messages.full;
      } else if (itemCount === 1 && messages.one) {
        template = messages.one;
      } else if (itemCount > 1 && messages.multiple) {
        template = messages.multiple;
      } else if (!itemCount && messages.empty) {
        template = messages.empty;
      }
    }
    if (template) {
      return String(template)
        .replace(/\{maxFiles\}/g, isFinite(maxFiles) ? String(maxFiles) : "")
        .replace(/\{remaining\}/g, String(remaining));
    }
    return itemCount
      ? itemCount + (artworkMode ? (itemCount === 1 ? " design anexado" : " designs anexados") : (itemCount === 1 ? " foto anexada" : " fotos anexadas"))
      : String(config.helperText || (multiple && isFinite(maxFiles) ? "Até " + maxFiles + (artworkMode ? " designs" : " fotos") : "")).trim();
  }

