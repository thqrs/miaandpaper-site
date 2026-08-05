// js/12-crachas-imanes.js — parte 12/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: seccoes por defeito de crachas/imanes/cadernos (CRACHAS_DEFAULT_SECTIONS, IMANES_DEFAULT_SECTIONS, CADERNOS_DEFAULT_SECTIONS) e render de designs por seccao.
  // CRACHAS_SECTIONS_V1 + SECTIONED_STEP_ORDERING_V1 + SECTION_DISPLAY_LABELS_V1 + MINI_CADERNOS_QUANTITY_LABEL_FIX_V1 + CRACHAS_SIZE_BEFORE_QUANTITY_V1 + CRACHAS_STEP2_SIZE_LAYOUT_V1 + CRACHAS_STEP2_SELECTED_DESIGNS_CLEANUP_V2 + CRACHAS_STEP2_SIDE_PHOTO_FIX_V3 + CRACHAS_STEP2_SIDE_PHOTO_ADMIN_V4 + CRACHAS_STEP2_SIZE_CARD_NO_JUMP_V4 + CRACHAS_STEP2_SIDE_IMAGE_UPLOAD_V5 + CRACHAS_PACK_DISABLED_MESSAGE_V1 + CRACHAS_STEP2_MOBILE_COLUMNS_FIX_V6 + PACK_PRICE_OVERVIEW_SIMPLIFIED_V1 + STEP_ACTIONS_STICKY_MOBILE_V1 + PACK_PRICE_OVERVIEW_SENTENCE_V2 + PACK_PRICE_OVERVIEW_THREE_COL_V3 + IMANES_STEP2_SUMMARY_REUSE_V1 + IMANES_SIZE_CARD_TRIM_V1 + PACK_DISCOUNT_FALLBACK_BASELINE_V1 + PACK_PRICE_LABELS_BELOW_V1 + PACK_SELECTION_STYLE_CONSISTENCY_V1 + CRACHAS_SIZE_CARD_LAYOUT_TOGGLE_V1 + SMART_QUANTITIES_V1 + SMART_QUANTITIES_V2_PACK_BASELINE + PACK_PRICE_OVERVIEW_3COL_CENTERED_V4 + PACK_PRICE_OVERVIEW_PRO_V5 + PACK_PRICE_OVERVIEW_V5_ICONS_LEFT + DELIVERY_CONTACT_STEP_V1 + REORDER_CONTACT_BLOCK_V1 + DELIVERY_OPTIONS_3_V1 + CONFIRM_REFORMAT_V1 + COOKIE_BANNER_V1 + ADMIN_LOGIN_PT_LOG_V1 + FUNNEL_TRACKING_V1 + FUNNEL_DASHBOARD_V1 + CRACHAS_SECTIONS_4_V1 + CONFIRM_DISCOUNT_LABEL_V2 + COPY_REQUEST_AUTOCHECK_V1 + CONTACT_VALIDATION_V1 + STEP_LIST_MOBILE_FIT_V1
  // O passo "designs" e renderizado por seccoes (visiveis ou invisiveis)
  // conforme a tabela de configuracao por slug. Defaults sao runtime: nao
  // tocamos em content/products/<slug>.json ate ao primeiro SAVE pelo admin.
  // Items sem sectionId caem na primeira seccao; items sem sectionOrder
  // ficam depois dos que tem ordem, mantendo a ordem original do JSON.
  // CRACHAS_SECTIONS_4_V1: a secção "Crianças" foi acrescentada à lista de
  // defaults para não ser truncada por ensureStepSections (que força
  // step.sections.length = defaults.length). Sem isto, "Gerais" desaparece
  // porque "criancas" passou a estar antes na ordem do JSON.
  var CRACHAS_DEFAULT_SECTIONS = [
    { id: "novidades", title: "Novidades", labelPrefix: "" },
    { id: "porto-2026", title: "Cidade do Porto", labelPrefix: "Porto" },
    { id: "restelo", title: "Cidade de Lisboa e Restelo", labelPrefix: "Lisboa" },
    { id: "criancas", title: "Crianças", labelPrefix: "Criança" },
    { id: "felicidade-eterna", title: "Felicidade Eterna", labelPrefix: "Felicidade" }
  ];

  var IMANES_DEFAULT_SECTIONS = [
    { id: "novidades", title: "Novidades", labelPrefix: "" },
    { id: "verticais", title: "Ímanes Verticais", labelPrefix: "Vertical" },
    { id: "horizontais", title: "Ímanes Horizontais", labelPrefix: "Horizontal" }
  ];

  var INVISIBLE_GROUPS_2 = [
    { id: "grupo-1", title: "Grupo 1", labelPrefix: "" },
    { id: "grupo-2", title: "Grupo 2", labelPrefix: "" }
  ];

  var CADERNOS_DEFAULT_SECTIONS = [
    { id: "novidades", title: "Novidades", labelPrefix: "", visible: true },
    { id: "felicidade-eterna", title: "Felicidade Eterna", labelPrefix: "", visible: true }
  ];

  function getStepSectionConfig(product, step) {
    if (!product || !step || step.id !== "designs") {
      return null;
    }
    if (product.slug === "crachas") {
      return { mode: "visible", defaults: CRACHAS_DEFAULT_SECTIONS };
    }
    if (product.slug === "imanes") {
      return { mode: "visible", defaults: IMANES_DEFAULT_SECTIONS };
    }
    if (product.slug === "cadernos" || product.slug === "caderninhos") {
      return { mode: "mixed", defaults: CADERNOS_DEFAULT_SECTIONS };
    }
    if (product.slug === "lembrancas") {
      return { mode: "invisible", defaults: INVISIBLE_GROUPS_2 };
    }
    return null;
  }

  // Backwards-compat wrapper. Mantido para o codigo existente que usa este
  // nome continuar a funcionar como "tem seccoes definidas?".
  function isCrachasDesignsContext(product, step) {
    return !!getStepSectionConfig(product, step);
  }

  function ensureStepSections(step, defaults) {
    var i;
    var current;

    if (!step || !Array.isArray(step.sections) || step.sections.length === 0) {
      step.sections = defaults.map(function (entry) {
        return { id: entry.id, title: entry.title, labelPrefix: entry.labelPrefix || "" };
      });
      return step.sections;
    }

    for (i = 0; i < defaults.length; i += 1) {
      current = step.sections[i];
      if (!current || typeof current !== "object") {
        step.sections[i] = { id: defaults[i].id, title: defaults[i].title, labelPrefix: defaults[i].labelPrefix || "" };
      } else {
        if (!current.id) {
          current.id = defaults[i].id;
        }
        if (typeof current.title !== "string" || current.title === "") {
          current.title = defaults[i].title;
        }
        if (typeof current.labelPrefix !== "string") {
          current.labelPrefix = defaults[i].labelPrefix || "";
        }
      }
    }
    step.sections.length = defaults.length;
    return step.sections;
  }

  // Mantido como alias retro-compativel de uma chamada anterior.
  function ensureCrachasSections(step) {
    return ensureStepSections(step, CRACHAS_DEFAULT_SECTIONS);
  }

  function pad2(n) {
    var v = String(Math.max(0, Math.floor(Number(n) || 0)));
    return v.length === 1 ? "0" + v : v;
  }

  function buildSectionDisplayLabels(step, sections, grouped) {
    var labels = {};

    sections.forEach(function (section) {
      var bucket = grouped[section.id] || [];
      var prefix = (section.labelPrefix || "").trim();
      bucket.forEach(function (entry, i) {
        if (!entry.item || !entry.item.id) {
          return;
        }
        if (prefix) {
          labels[entry.item.id] = prefix + " " + pad2(i + 1);
        }
      });
    });

    return labels;
  }

  function displayItemTitle(item) {
    if (!item) {
      return "";
    }
    if (state.itemDisplayLabels && item.id && state.itemDisplayLabels[item.id]) {
      return state.itemDisplayLabels[item.id];
    }
    return item.title || "";
  }

  function groupItemsBySection(items, sections) {
    var fallbackId = sections[0] && sections[0].id;
    var byId = {};
    sections.forEach(function (section) {
      byId[section.id] = [];
    });

    (items || []).forEach(function (item, originalIndex) {
      var key = item && item.sectionId && byId[item.sectionId] ? item.sectionId : fallbackId;
      byId[key].push({ item: item, originalIndex: originalIndex });
    });

    Object.keys(byId).forEach(function (key) {
      byId[key].sort(function (a, b) {
        var aRaw = a.item && a.item.sectionOrder;
        var bRaw = b.item && b.item.sectionOrder;
        var aNum = Number(aRaw);
        var bNum = Number(bRaw);
        var aHas = aRaw != null && aRaw !== "" && isFinite(aNum);
        var bHas = bRaw != null && bRaw !== "" && isFinite(bNum);

        if (aHas && bHas) {
          if (aNum !== bNum) {
            return aNum - bNum;
          }
          return a.originalIndex - b.originalIndex;
        }
        if (aHas) {
          return -1;
        }
        if (bHas) {
          return 1;
        }
        return a.originalIndex - b.originalIndex;
      });
    });

    return byId;
  }

  function renderDesignActionControls(product, step) {
    var supported = supportsAssortedDesigns(product) && step && step.id === "designs" && step.selection === "multi";
    var items = step && Array.isArray(step.items) ? step.items : [];
    var selected = selectedValues(step || {});
    var allSelected = items.length > 0 && selected.length === items.length;
    var assorted = isAssortedSelected(product);
    var selectAllLabel = !assorted && allSelected ? "Limpar Seleção" : "Selecionar tudo";

    if (!supported || state.admin) {
      return "";
    }

    return [
      '<div class="design-action-grid" aria-label="Ações rápidas de seleção">',
      '<button class="choice-card design-action-card' + (!assorted && allSelected ? ' is-selected' : '') + '" type="button" data-select-all-designs data-track="true" data-track-action="select_all_designs" data-track-id="select_all_designs">',
      '<span class="design-action-icon" aria-hidden="true">✓</span>',
      '<span class="choice-copy">',
      '<strong>' + escapeHtml(selectAllLabel) + '</strong>',
      '</span>',
      '</button>',
      '<button class="choice-card design-action-card' + (assorted ? ' is-selected' : '') + '" type="button" data-assorted-designs data-track="true" data-track-action="select_assorted" data-track-id="assorted_designs">',
      '<span class="design-action-icon" aria-hidden="true">★</span>',
      '<span class="choice-copy">',
      '<strong>Sortido</strong>',
      '</span>',
      '</button>',
      '</div>',
      assorted ? '<p class="open-order-hint design-action-message" role="status">Podes passar para o próximo passo. Nota: se escolheres algum design, a opção "Sortido" vai ser automaticamente desmarcada.</p>' : ""
    ].join("");
  }

  function renderAssortedSelectedSummary() {
    return [
      '<section class="crachas-step2-summary assorted-step-summary" aria-label="Designs escolhidos">',
      '<h3 class="crachas-step2-summary-title">Designs que vais encomendar:</h3>',
      '<p class="assorted-pill">Sortido — a Mia escolhe os designs</p>',
      '</section>'
    ].join("");
  }

  function renderSectionedDesignChoiceItems(product, step) {
    var config = getStepSectionConfig(product, step);
    if (!config) {
      return "";
    }

    var type = step.selection === "multi" ? "checkbox" : "radio";
    var selected = selectedValues(step);
    var sections = ensureStepSections(step, config.defaults);
    var grouped = groupItemsBySection(step.items, sections);

    state.itemDisplayLabels = buildSectionDisplayLabels(step, sections, grouped);

    function renderItemCard(item) {
      var checked = selected.indexOf(item.value) !== -1 ? " checked" : "";
      var media = renderDesignCardMedia(product, step, item);
      var noteText = quadroChoiceNote(product, step, item);
      var note = noteText ? '<span class="choice-note">' + escapeHtml(noteText) + '</span>' : "";

      return [
        '<label class="choice-card design-grid">',
        '<input type="' + type + '" name="' + escapeHtml(step.field) + '" value="' + escapeHtml(item.value) + '" data-choice-step="' + escapeHtml(step.id) + '"' + checked + '>',
        media,
        '<span class="choice-copy">',
        '<strong>' + escapeHtml(displayItemTitle(item)) + '</strong>',
        '<span>' + escapeHtml(item.subtitle) + '</span>',
        note,
        '</span>',
        adminItemControls(step, item),
        '</label>'
      ].join("");
    }

    if (config.mode === "invisible") {
      // Sem titulos no site publico. Em admin emitimos os titulos como
      // ajuda para o admin perceber a estrutura, mas em estilo discreto.
      var rowsAll = "";
      sections.forEach(function (section) {
        var bucket = grouped[section.id] || [];

        if (state.admin) {
          rowsAll += [
            '<div class="design-grid-section design-grid-section-invisible' + (bucket.length === 0 ? ' is-empty' : '') + '" data-section-id="' + escapeHtml(section.id) + '">',
            '<h3 class="design-grid-section-title is-admin-only">' + escapeHtml(section.title) + ' <span class="design-grid-section-hint">(grupo invisível no site público)</span></h3>',
            bucket.length === 0 ? '<p class="design-grid-section-empty">Sem itens neste grupo.</p>' : "",
            '<div class="design-grid">' + bucket.map(function (entry) { return renderItemCard(entry.item); }).join("") + '</div>',
            '</div>'
          ].join("");
        } else {
          rowsAll += bucket.map(function (entry) { return renderItemCard(entry.item); }).join("");
        }
      });

      if (state.admin) {
        return rowsAll + '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar opção</button>';
      }
      return renderDesignActionControls(product, step) + '<div class="design-grid">' + rowsAll + '</div>';
    }

    if (config.mode === "mixed") {
      var mixedHtml = "";

      sections.forEach(function (section) {
        var bucket = grouped[section.id] || [];
        var defaultSection = (config.defaults || []).filter(function (entry) {
          return entry.id === section.id;
        })[0] || {};
        var isVisibleSection = defaultSection.visible !== false;
        var rowsHtml = bucket.map(function (entry) { return renderItemCard(entry.item); }).join("");

        if (bucket.length === 0 && !state.admin) {
          return;
        }

        if (isVisibleSection) {
          mixedHtml += [
            '<section class="design-grid-section' + (bucket.length === 0 ? ' is-empty' : '') + '" data-section-id="' + escapeHtml(section.id) + '">',
            '<h3 class="design-grid-section-title">' + escapeHtml(section.title) + '</h3>',
            bucket.length === 0 && state.admin ? '<p class="design-grid-section-empty">Sem itens atribuídos. Atribui um item a este separador para que apareça no site.</p>' : "",
            '<div class="design-grid">' + rowsHtml + '</div>',
            '</section>'
          ].join("");
          return;
        }

        if (state.admin) {
          mixedHtml += [
            '<div class="design-grid-section design-grid-section-invisible' + (bucket.length === 0 ? ' is-empty' : '') + '" data-section-id="' + escapeHtml(section.id) + '">',
            '<h3 class="design-grid-section-title is-admin-only">' + escapeHtml(section.title) + ' <span class="design-grid-section-hint">(grupo invisível no site público)</span></h3>',
            bucket.length === 0 ? '<p class="design-grid-section-empty">Sem itens neste grupo.</p>' : "",
            '<div class="design-grid">' + rowsHtml + '</div>',
            '</div>'
          ].join("");
        } else {
          mixedHtml += '<div class="design-grid">' + rowsHtml + '</div>';
        }
      });

      return renderDesignActionControls(product, step) + mixedHtml + (state.admin ? '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar opção</button>' : "");
    }

    // Modo visivel: 3 (ou 2) seccoes com titulos e linha por baixo.
    var html = "";
    sections.forEach(function (section) {
      var bucket = grouped[section.id] || [];

      if (bucket.length === 0 && !state.admin) {
        return;
      }

      var rowsHtml = bucket.map(function (entry) { return renderItemCard(entry.item); }).join("");

      var emptyNote = bucket.length === 0 && state.admin
        ? '<p class="design-grid-section-empty">Sem itens atribuídos. Atribui um item a este separador para que apareça no site.</p>'
        : "";

      html += [
        '<section class="design-grid-section' + (bucket.length === 0 ? ' is-empty' : '') + '" data-section-id="' + escapeHtml(section.id) + '">',
        '<h3 class="design-grid-section-title">' + escapeHtml(section.title) + '</h3>',
        emptyNote,
        '<div class="design-grid">' + rowsHtml + '</div>',
        '</section>'
      ].join("");
    });

    return renderDesignActionControls(product, step) + html + (state.admin ? '<button class="admin-add" type="button" data-admin-add-item data-step-id="' + escapeHtml(step.id) + '">Adicionar opção</button>' : "");
  }

  // Alias retro-compativel.
  function renderCrachasDesignsBySection(product, step) {
    return renderSectionedDesignChoiceItems(product, step);
  }

  function safeSwatchColor(value) {
    var color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : "#d8d1c2";
  }

  function renderChoiceSwatch(item) {
    if (!item || !item.swatch) {
      return "";
    }

    return '<span class="choice-swatch" style="--choice-swatch:' + escapeHtml(safeSwatchColor(item.swatch)) + '" aria-hidden="true"></span>';
  }

  function paletteSelectionLimit(step) {
    var limit = Math.max(1, parseInt(step && step.colorCount, 10) || 3);
    var mappings = step && step.colorCountByField && typeof step.colorCountByField === "object"
      ? step.colorCountByField
      : {};

    Object.keys(mappings).some(function (fieldName) {
      var fieldMap = mappings[fieldName] || {};
      var selected = String(state.selections[fieldName] || "");
      var mapped = parseInt(fieldMap[selected], 10);

      if (mapped > 0) {
        limit = mapped;
        return true;
      }
      return false;
    });

    return limit;
  }

  function quadrosColorSelectionKeys(step) {
    var configured = step && step.selectionKeys && typeof step.selectionKeys === "object"
      ? step.selectionKeys
      : {};

    return {
      colors: String(configured.colors || "colors"),
      tones: String(configured.tones || "quadro_color_tones"),
      palette: String(configured.palette || "color_palette"),
      mia: String(configured.mia || "mia_choose_colors")
    };
  }

