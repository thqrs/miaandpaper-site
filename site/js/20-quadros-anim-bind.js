// js/20-quadros-anim-bind.js — parte 20/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: animacoes dos quadros (FLIP da grelha de cores, espiral dos tons, setinha do marcador, grid flip) e bindProduct (liga todos os handlers do wizard, incluindo formato/capa/variação agrupados, atribuição A4/A6 dentro da preview e o toggle dos cantos metálicos).
  // ---- Fluído da grelha de cores (FLIP) ----------------------------------
  // Abrir/fechar os tons muda o número de quadrados, por isso a grelha reflui.
  // Guardamos as posições antes do render e animamos cada quadrado da posição
  // antiga para a nova: as vizinhas parecem ser empurradas em vez de saltar.
  var quadrosFlipRects = null;
  var QUADROS_FLIP_EASING = "cubic-bezier(.34,1.28,.44,1)";
  // Entrada e saída dos círculos duram o mesmo — a saída parecia mais lenta.
  var QUADROS_TONE_TRAVEL = 420;
  var QUADROS_TONE_LEAD = 320;      // crescer + pausa, antes de recolher
  var QUADROS_MARKER_DELAY = 50;    // respiro antes de a setinha arrancar
  var quadrosMarkerShift = null;
  var quadrosMarkerImmediate = false;

  // Faz a setinha deslizar da posição antiga para a que já está no CSS.
  function quadrosAnimateMarkerFrom(marker, from, shift, delay) {
    // Mede a distância real entre centros. Nos degradês existe uma seta e um
    // intervalo entre os quadrados, portanto já não coincide com a largura.
    var slots = document.querySelectorAll("[data-quadros-color-slot]");
    var first = slots[0] ? slots[0].getBoundingClientRect() : null;
    var second = slots[1] ? slots[1].getBoundingClientRect() : null;
    var pitch = first && second
      ? (second.left + second.width / 2) - (first.left + first.width / 2)
      : (first ? first.width : 0);

    if (from === null || from === shift || !pitch || !marker.animate) {
      return;
    }
    marker.animate(
      [
        { transform: "translateX(calc(-50% + " + ((from - shift) * pitch) + "px))" },
        { transform: "translateX(-50%)" }
      ],
      {
        duration: 180,
        delay: delay || 0,
        easing: "cubic-bezier(.3,0,.2,1)",
        // Sem isto ficaria no destino durante o atraso e só depois recuava.
        fill: "backwards"
      }
    );
  }

  // A setinha do quadrado activo desliza para o novo lugar em vez de saltar.
  function quadrosSlideActiveMarker() {
    var marker = document.querySelector(".quadros-active-marker");
    var shift = marker ? parseFloat(marker.style.getPropertyValue("--marker-shift")) : null;
    // Clique directo num quadrado da composição: arranca já, sem respiro.
    var delay = quadrosMarkerImmediate ? 0 : QUADROS_MARKER_DELAY;
    var from;

    quadrosMarkerImmediate = false;
    if (!marker || shift === null || isNaN(shift)) {
      quadrosMarkerShift = null;
      return;
    }
    from = quadrosMarkerShift;
    quadrosMarkerShift = shift;
    quadrosAnimateMarkerFrom(marker, from, shift, delay);
  }

  // Move a setinha já no clique, sem esperar pelo re-render — que só chega no
  // fim da animação dos círculos.
  function quadrosMoveActiveMarker(index, limit) {
    var marker = document.querySelector(".quadros-active-marker");
    var shift = index - (limit - 1) / 2;
    var from = quadrosMarkerShift;

    if (!marker || from === shift) {
      return;
    }
    marker.style.setProperty("--marker-shift", shift);
    quadrosMarkerShift = shift;
    quadrosAnimateMarkerFrom(marker, from, shift, QUADROS_MARKER_DELAY);
  }

  // Os 3 círculos formam um triângulo centrado na célula que o quadrado
  // clicado deixou livre: principal em cima, claro em baixo à esquerda, escuro
  // em baixo à direita. Se o triângulo sair da grelha (colunas das pontas),
  // desloca-se inteiro para dentro, mantendo a forma.
  function quadrosPlaceToneStrip() {
    var grid = document.querySelector("[data-quadros-color-grid]");
    var strip = grid ? grid.querySelector("[data-quadros-tone-strip]") : null;
    var expanded = grid ? grid.querySelector(".quadros-color-family.is-expanded") : null;
    var size;
    var pitch;
    var cx;
    var cy;
    var halfW;
    var halfH;
    var shift = 0;
    var gridRect;
    var minX;
    var maxX;
    var place;

    if (!grid || !strip || !expanded) {
      return;
    }
    size = parseFloat(getComputedStyle(grid).getPropertyValue("--quadros-tone-size")) || 40;
    pitch = size + Math.max(3, size * 0.1);       // distância entre centros
    cx = expanded.offsetLeft + expanded.offsetWidth / 2;
    cy = expanded.offsetTop + expanded.offsetHeight / 2;
    halfW = pitch / 2;
    halfH = pitch * 0.433;                        // metade da altura equilátera

    // O triângulo fica centrado no quadrado clicado, mesmo nas colunas das
    // pontas — nesses casos entra pela margem da página, encostando ao canto.
    // Só se desloca se ameaçar sair do ecrã.
    gridRect = grid.getBoundingClientRect();
    minX = -Math.max(0, gridRect.left - 6);
    maxX = grid.clientWidth + Math.max(0, window.innerWidth - gridRect.right - 6);
    if (cx - halfW - size / 2 < minX) {
      shift = minX - (cx - halfW - size / 2);
    } else if (cx + halfW + size / 2 > maxX) {
      shift = maxX - (cx + halfW + size / 2);
    }

    place = function (name, dx, dy) {
      strip.style.setProperty("--quadros-tone-" + name + "-x", (cx + shift + dx - size / 2) + "px");
      strip.style.setProperty("--quadros-tone-" + name + "-y", (cy + dy - size / 2) + "px");
    };

    strip.style.setProperty("--quadros-tone-origin-x", (cx + shift) + "px");
    strip.style.setProperty("--quadros-tone-origin-y", cy + "px");
    place("top", 0, -halfH);
    place("left", -halfW, halfH);
    place("right", halfW, halfH);
  }

  // Percurso em espiral entre o centro do quadrado clicado e o vértice final do
  // círculo: o raio abre enquanto o ângulo roda, por isso o círculo descreve
  // uma curva em vez de uma linha recta. (dx0, dy0) é a translação no ponto de
  // partida, ou seja o centro do quadrado visto a partir do lugar final.
  var QUADROS_TONE_SWIRL = 150;      // graus de rotação ao longo do percurso
  var QUADROS_TONE_STEPS = 12;

  function quadrosSpiralFrames(dx0, dy0) {
    var radius = Math.hypot(dx0, dy0);
    var endAngle = Math.atan2(-dy0, -dx0);
    var swirl = QUADROS_TONE_SWIRL * Math.PI / 180;
    var frames = [];
    var i;
    var t;
    var angle;

    for (i = 0; i <= QUADROS_TONE_STEPS; i++) {
      t = i / QUADROS_TONE_STEPS;
      angle = endAngle - swirl * (1 - t);
      frames.push({
        transform: "translate("
          + (dx0 + t * radius * Math.cos(angle)).toFixed(2) + "px,"
          + (dy0 + t * radius * Math.sin(angle)).toFixed(2) + "px) rotate("
          + (-QUADROS_TONE_SWIRL * (1 - t)).toFixed(1) + "deg) scale("
          + (0.18 + 0.82 * t).toFixed(3) + ")",
        opacity: Math.min(1, t * 4)
      });
    }
    return frames;
  }

  function quadrosToneOriginDelta(element, expanded) {
    var from = expanded.getBoundingClientRect();
    var to = element.getBoundingClientRect();

    return [
      (from.left + from.width / 2) - (to.left + to.width / 2),
      (from.top + from.height / 2) - (to.top + to.height / 2)
    ];
  }

  // Fecho: os círculos recolhem-se em espiral para dentro do quadrado, que
  // reaparece. O que foi clicado dá primeiro um salto, como confirmação.
  var quadrosToneClosing = false;
  var quadrosToneSettle = null;

  // Se o utilizador clicar noutra cor a meio da recolha, o clique dele ganha:
  // liquidamos o fecho sem re-render (quem chamou vai renderizar a seguir).
  function quadrosSettleToneClose() {
    if (quadrosToneSettle) {
      quadrosToneSettle(true);
    }
  }

  function quadrosDismissToneStrip(product, clicked) {
    var grid = document.querySelector("[data-quadros-color-grid]");
    var strip = grid ? grid.querySelector("[data-quadros-tone-strip]") : null;
    var expanded = grid ? grid.querySelector(".quadros-color-family.is-expanded") : null;
    var pending = 0;
    var settled = false;
    var done;

    done = function (skipRender) {
      var activeStep;
      var activeUi;
      if (settled) {
        return;
      }
      settled = true;
      quadrosToneClosing = false;
      quadrosToneSettle = null;
      state.quadroToneEdit = null;
      activeStep = currentStep(product);
      if (activeStep && activeStep.tonePicker === true) {
        activeUi = quadrosColorUiFor(activeStep, paletteSelectionLimit(activeStep));
        activeUi.toneEdit = null;
      }
      if (skipRender !== true) {
        rerenderProduct(product);
      }
    };

    if (quadrosToneClosing) {
      return;
    }
    if (!strip || !expanded || !document.body.animate) {
      done();
      return;
    }
    quadrosToneClosing = true;
    quadrosToneSettle = done;
    strip.style.pointerEvents = "none";

    // O quadrado reaparece atrás dos círculos, ao mesmo tempo que eles recolhem
    // e ao mesmo ritmo — o inverso exacto da entrada.
    expanded.animate(
      [
        { transform: "scale(.45) rotate(-40deg)", opacity: 0 },
        { transform: "scale(1) rotate(0deg)", opacity: 1 }
      ],
      {
        duration: QUADROS_TONE_TRAVEL,
        delay: QUADROS_TONE_LEAD,
        easing: QUADROS_FLIP_EASING,
        fill: "both"
      }
    );

    Array.prototype.forEach.call(strip.children, function (circle) {
      var delta = quadrosToneOriginDelta(circle, expanded);
      var frames = quadrosSpiralFrames(delta[0], delta[1]).reverse();
      var isClicked = circle === clicked;
      var animation;
      var total;

      if (isClicked) {
        // Cresce, e fica um instante parado no tamanho grande — é essa pausa
        // que faz ler qual foi o círculo escolhido — antes de recolher. Só a
        // parte da recolha conta para o tempo de viagem.
        total = QUADROS_TONE_LEAD + QUADROS_TONE_TRAVEL;
        frames = [
          { transform: "translate(0,0) rotate(0deg) scale(1)", opacity: 1, offset: 0 },
          { transform: "translate(0,0) rotate(0deg) scale(1.26)", opacity: 1, offset: 130 / total },
          { transform: "translate(0,0) rotate(0deg) scale(1.26)", opacity: 1, offset: QUADROS_TONE_LEAD / total }
        ].concat(frames.slice(1).map(function (frame, index, list) {
          frame.offset = (QUADROS_TONE_LEAD + (QUADROS_TONE_TRAVEL * (index + 1)) / list.length) / total;
          return frame;
        }));
      }
      pending += 1;
      animation = circle.animate(frames, {
        duration: isClicked ? QUADROS_TONE_LEAD + QUADROS_TONE_TRAVEL : QUADROS_TONE_TRAVEL,
        // Os que não foram escolhidos esperam pela pausa antes de sair.
        delay: isClicked ? 0 : QUADROS_TONE_LEAD,
        easing: isClicked ? "cubic-bezier(.4,0,.3,1)" : QUADROS_FLIP_EASING,
        fill: "forwards"
      });
      animation.addEventListener("finish", function () {
        pending -= 1;
        if (pending === 0) { done(); }
      });
    });

    if (!pending) {
      done();
      return;
    }
    // Rede de segurança: se a timeline não correr (separador em segundo plano),
    // o "finish" nunca dispara e a grelha ficaria presa no estado aberto.
    // Tem de ser maior que a animação mais longa para não a cortar.
    window.setTimeout(done, QUADROS_TONE_LEAD + QUADROS_TONE_TRAVEL + 260);
  }

  function quadrosCaptureGridRects(origin) {
    var grid = document.querySelector("[data-quadros-color-grid]");
    var rects = {};

    // Corre mesmo com prefers-reduced-motion: sem o movimento os quadrados
    // saltam de sítio e não se percebe o que aconteceu à grelha.
    if (!grid || !document.body.animate) {
      quadrosFlipRects = null;
      return;
    }
    grid.querySelectorAll("[data-flip-key]").forEach(function (element) {
      rects[element.dataset.flipKey] = element.getBoundingClientRect();
    });
    quadrosFlipRects = { rects: rects, origin: origin || "" };
  }

  function quadrosPlayGridFlip() {
    var captured = quadrosFlipRects;
    var grid = document.querySelector("[data-quadros-color-grid]");
    var originRect;

    quadrosFlipRects = null;
    if (!captured || !grid) {
      return;
    }
    originRect = captured.rects["fam:" + captured.origin];

    grid.querySelectorAll("[data-flip-key]").forEach(function (element) {
      var key = element.dataset.flipKey;
      var from = captured.rects[key] || originRect;
      var to = element.getBoundingClientRect();
      var dx;
      var dy;
      var isNew = !captured.rects[key];
      var scale;

      if (!from || !to.width) {
        return;
      }
      if (isNew) {
        // Os círculos brotam do centro do quadrado clicado e abrem em espiral
        // até ao seu vértice do triângulo.
        dx = (from.left + from.width / 2) - (to.left + to.width / 2);
        dy = (from.top + from.height / 2) - (to.top + to.height / 2);
        element.animate(quadrosSpiralFrames(dx, dy), {
          duration: QUADROS_TONE_TRAVEL,
          easing: QUADROS_FLIP_EASING
        });
        return;
      }
      dx = from.left - to.left;
      dy = from.top - to.top;
      scale = 1;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        return;
      }
      element.animate(
        [
          { transform: "translate(" + dx + "px," + dy + "px) scale(" + scale + ")" },
          { transform: "translate(0,0) scale(1)" }
        ],
        {
          duration: 420,
          easing: QUADROS_FLIP_EASING,
          // Escalona pela distância: as mais próximas da cor clicada arrancam
          // primeiro, o que dá a leitura de empurrão a propagar-se.
          delay: Math.min(90, Math.round(Math.hypot(dx, dy) / 14)),
          fill: "backwards"
        }
      );
    });
  }



  // O certo salta a aparecer no quadrado que passou a ter cor, e salta a
  // desvanecer no que a perdeu. Guardamos as cores marcadas do render anterior
  // para saber quais mudaram.
  var quadrosCheckedValues = null;

  function quadrosAnimateChecks() {
    var grid = document.querySelector("[data-quadros-color-grid]");
    var previous = quadrosCheckedValues;
    var current = [];
    var squares;

    if (!grid) {
      quadrosCheckedValues = null;
      return;
    }
    squares = Array.prototype.slice.call(grid.querySelectorAll("[data-quadros-color-family]"));
    squares.forEach(function (square) {
      if (square.querySelector(".quadros-check")) {
        current.push(square.dataset.quadrosColorFamily);
      }
    });
    quadrosCheckedValues = current;
    if (!previous || !grid.animate) {
      return;
    }

    // Entra: salta e aparece.
    current.forEach(function (value) {
      var check;
      if (previous.indexOf(value) !== -1) {
        return;
      }
      check = grid.querySelector('[data-quadros-color-family="' + value.replace(/"/g, '\\"') + '"] .quadros-check');
      if (check) {
        check.animate(
          [
            { transform: "scale(.2)", opacity: 0 },
            { transform: "scale(1.3)", opacity: 1, offset: 0.6 },
            { transform: "scale(1)", opacity: 1 }
          ],
          { duration: 200, easing: "cubic-bezier(.3,0,.2,1)" }
        );
      }
    });

    // A sair não há animação: fazer o certo reaparecer só para o desvanecer
    // dava mais nas vistas do que simplesmente deixá-lo ir.
  }

  // Ligado uma única vez: o bindProduct corre a cada render e duplicaria
  // listeners no document.
  var quadrosColorPanelDismissBound = false;

  function bindQuadrosColorPanelDismiss() {
    if (quadrosColorPanelDismissBound) {
      return;
    }
    quadrosColorPanelDismissBound = true;

    var close = function () {
      if (!state.quadroToneEdit || !state.product) {
        return;
      }
      quadrosDismissToneStrip(state.product, null);
    };

    document.addEventListener("click", function (event) {
      var target = event.target;
      if (target && target.closest && target.closest("[data-quadros-color-grid], [data-quadros-color-slot]")) {
        return;
      }
      close();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        close();
      }
    });
  }

  function bindProduct(product) {
    var form = document.querySelector("#order-form");
    var back = document.querySelector("[data-back]");
    var next = document.querySelector("[data-next]");
    var step = currentStep(product);

    bindQuadrosColorPanelDismiss();
    // Sincronamente, antes de o browser pintar: o MutationObserver do MiaWater
    // só corre no rAF seguinte, o que deixava um frame com as canvases em
    // branco — era o pisca-pisca dos quadrados a cada re-render.
    miaWaterScan();
    quadrosPlaceToneStrip();   // antes do FLIP: as posições finais têm de ser estas
    quadrosPlayGridFlip();
    quadrosSlideActiveMarker();
    quadrosAnimateChecks();
    initFreeQuantityPriceCharts(product);

    document.querySelectorAll("[data-quadros-color-slot]").forEach(function (button) {
      button.addEventListener("click", function () {
        var limit = paletteSelectionLimit(step);
        var slot = Math.max(0, Math.min(limit - 1, Number(button.dataset.quadrosColorSlot) || 0));
        var ui = quadrosColorUiFor(step, limit);

        quadrosSettleToneClose();
        quadrosCaptureGridRects(state.quadroToneEdit ? state.quadroToneEdit.value : "");
        if (ui.pinnedSlot !== slot) {
          ui.pinnedChangeCount = 0;
          ui.hintSlot = null;
        }
        ui.activeSlot = slot;
        ui.pinnedSlot = slot;
        ui.toneEdit = null;
        state.quadroActiveColorSlot = slot;
        state.quadroToneEdit = null;
        state.errors = "";
        // Clique directo no quadrado: a setinha acompanha sem atraso nenhum.
        quadrosMarkerImmediate = true;
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-quadros-color-family]").forEach(function (button) {
      button.addEventListener("click", function () {
        var limit = paletteSelectionLimit(step);
        var ui = quadrosColorUiFor(step, limit);
        var slot = quadrosActiveColorSlot(step, limit);
        var value = button.dataset.quadrosColorFamily;

        quadrosSettleToneClose();
        quadrosCaptureGridRects(value);
        // Clicar numa cor só abre os três tons — nada fica escolhido até se
        // clicar num círculo. A família pode repetir-se; só a combinação exacta
        // de cor + tom é única, e essa verificação é feita ao escolher o tom.
        ui.toneEdit = { value: value, slot: slot };
        state.quadroToneEdit = ui.toneEdit;
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-quadros-tone]").forEach(function (button) {
      button.addEventListener("click", function () {
        var limit = paletteSelectionLimit(step);
        var keys = quadrosColorSelectionKeys(step);
        var ui = quadrosColorUiFor(step, limit);
        var requestedSlot = Math.max(0, Math.min(limit - 1, Number(button.dataset.quadrosToneSlot) || 0));
        var slot = ui.pinnedSlot !== null ? ui.pinnedSlot : requestedSlot;
        var tone = Math.max(0, Math.min(2, Number(button.dataset.quadrosTone) || 0));
        var slots = currentPaletteColorSlots(step, limit);
        var tones = quadrosToneSelections(step, limit);
        var value = button.dataset.quadrosToneValue;
        var existingSlot = slots.findIndex(function (slotValue, index) {
          return slotValue === value && tones[index] === tone;
        });
        var wasChosen = existingSlot !== -1;
        var sameTarget = wasChosen && existingSlot === slot;
        var newColor = quadrosColorStops(quadrosColorItem(step, value))[tone];
        var nextEmpty;

        if (sameTarget) {
          // Voltar a tocar no tom que já ocupa o próprio quadrado continua a
          // funcionar como alternância: o quadrado fica vazio, mas permanece
          // fixado quando foi escolhido expressamente.
          slots[existingSlot] = "";
          tones[existingSlot] = 1;
          ui.activeSlot = existingSlot;
          if (slots.indexOf(value) === -1) {
            quadrosUnmarkFamilySquare(step, value);
          }
          quadrosPrimeSlotWater(step, existingSlot, "");
        } else if (wasChosen && ui.pinnedSlot !== null) {
          // Com um quadrado fixado, o tom é transferido para esse alvo: sai do
          // quadrado antigo, substitui o que estiver no alvo e o triângulo não
          // muda de lugar.
          slots[existingSlot] = "";
          tones[existingSlot] = 1;
          slots[slot] = value;
          tones[slot] = tone;
          ui.activeSlot = slot;
          quadrosPrimeSlotWater(step, existingSlot, "");
          quadrosPrimeSlotWater(step, slot, newColor);
        } else if (wasChosen) {
          // Sem fixação explícita mantém-se o comportamento habitual: retirar
          // o tom duplicado e levar o foco para o quadrado que ficou vazio.
          slots[existingSlot] = "";
          tones[existingSlot] = 1;
          ui.activeSlot = existingSlot;
          if (slots.indexOf(value) === -1) {
            quadrosUnmarkFamilySquare(step, value);
          }
          quadrosPrimeSlotWater(step, existingSlot, "");
        } else {
          slots[slot] = value;
          tones[slot] = tone;
          state.selections[keys.mia] = false;
          // O activo salta para o quadrado seguinte por preencher, para a cor
          // seguinte não substituir esta. Um clique explícito fixa a posição.
          nextEmpty = slots.indexOf("");
          ui.activeSlot = ui.pinnedSlot !== null ? ui.pinnedSlot : (nextEmpty !== -1 ? nextEmpty : slot);
          quadrosPrimeSlotWater(step, slot, newColor);
        }

        if (ui.pinnedSlot !== null) {
          ui.pinnedChangeCount += 1;
          if (ui.pinnedChangeCount % 3 === 0) {
            ui.hintSlot = quadrosNextEmptySlot(slots, ui.pinnedSlot);
          } else if (ui.hintSlot !== null && slots[ui.hintSlot]) {
            ui.hintSlot = null;
          }
        } else {
          ui.pinnedChangeCount = 0;
          ui.hintSlot = null;
        }
        ui.slots = slots.slice();
        ui.toneEdit = null;
        state.quadroActiveColorSlot = ui.activeSlot;
        state.quadroToneEdit = null;
        // A água e a setinha arrancam no instante do clique — o re-render só
        // chega no fim da animação dos círculos.
        quadrosMoveActiveMarker(ui.activeSlot, limit);
        state.selections[keys.palette] = "";
        state.selections[keys.colors] = slots.filter(Boolean);
        state.selections[keys.tones] = tones;
        state.paletteColorSlots = slots.slice();
        state.paletteLastSlot = slot;
        state.errors = "";
        // O re-render vem no fim da animação de recolha (o círculo clicado dá
        // um salto e os três voltam para dentro do quadrado).
        quadrosDismissToneStrip(product, button);
      });
    });

    document.querySelectorAll("[data-quadros-suggestions-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.quadroColorSuggestionsOpen = !state.quadroColorSuggestionsOpen;
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-quadros-palette-index]").forEach(function (button) {
      button.addEventListener("click", function () {
        var limit = paletteSelectionLimit(step);
        var index = Math.max(0, Number(button.dataset.quadrosPaletteIndex) || 0);
        var records = quadrosSuggestedPaletteRecords(step, limit, quadrosColorModeInfo(step).mode);

        if (applyQuadrosSuggestedPalette(step, records[index])) {
          state.errors = "";
          rerenderProduct(product);
        }
      });
    });

    document.querySelectorAll("[data-palette-suggestions-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.colorSuggestionsOpen = !state.colorSuggestionsOpen;
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-palette-choice]").forEach(function (input) {
      input.addEventListener("change", function () {
        var selectedItem = (step.items || []).filter(function (item) {
          return item && item.value === input.value;
        })[0] || null;
        var selectionLimit = paletteSelectionLimit(step);
        var individualValues = paletteIndividualValues(step, selectedItem, selectionLimit);

        state.selections.color_palette = input.value;
        state.selections.colors = individualValues.slice();
        state.selections.mia_choose_colors = false;
        state.paletteColorSlots = individualValues.concat(Array.from({ length: Math.max(0, selectionLimit - individualValues.length) }, function () { return ""; }));
        state.paletteLastSlot = Math.max(0, individualValues.length - 1);   // próximo clique substitui o último
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-individual-color]").forEach(function (input) {
      input.addEventListener("change", function () {
        var selectionLimit = paletteSelectionLimit(step);
        var slots = currentPaletteColorSlots(step, selectionLimit);
        var slotIndex = slots.indexOf(input.value);
        var lastSlot = (typeof state.paletteLastSlot === "number") ? state.paletteLastSlot : -1;
        var emptyIndex, replaceIndex;
        state.selections.color_palette = "";
        state.selections.mia_choose_colors = false;
        if (input.checked && slotIndex === -1) {
          emptyIndex = slots.indexOf("");
          if (emptyIndex !== -1) {
            slots[emptyIndex] = input.value;          // ainda há espaço -> preenche
            lastSlot = emptyIndex;
          } else {
            // já está cheio -> substitui o último quadrado que foi mexido
            // (com 1 cor é sempre o único; com 3 é o mais recente)
            replaceIndex = (lastSlot >= 0 && lastSlot < slots.length) ? lastSlot : slots.length - 1;
            slots[replaceIndex] = input.value;
            lastSlot = replaceIndex;
          }
        } else if (!input.checked && slotIndex !== -1) {
          slots[slotIndex] = "";                        // desmarca -> esvazia esse
          lastSlot = slotIndex;
        } else if (input.checked && slotIndex !== -1) {
          lastSlot = slotIndex;                          // re-clique -> passa a ser o último mexido
        }
        state.paletteLastSlot = lastSlot;
        state.paletteColorSlots = slots;
        state.selections.colors = slots.filter(Boolean);
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-mia-color-choice]").forEach(function (input) {
      input.addEventListener("change", function () {
        var keys = quadrosColorSelectionKeys(step);
        var limit = paletteSelectionLimit(step);
        var ui = quadrosColorUiFor(step, limit);
        state.selections[keys.mia] = input.checked;
        if (input.checked) {
          state.selections[keys.palette] = "";
          state.selections[keys.colors] = [];
          delete state.selections[keys.tones];
          ui.slots = Array.from({ length: limit }, function () { return ""; });
          ui.activeSlot = 0;
          ui.pinnedSlot = null;
          ui.pinnedChangeCount = 0;
          ui.hintSlot = null;
          ui.toneEdit = null;
          state.paletteColorSlots = ui.slots.slice();
          state.paletteLastSlot = -1;
          state.quadroActiveColorSlot = 0;
          state.quadroToneEdit = null;
        }
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-order-upload]").forEach(function (input) {
      input.addEventListener("click", function () {
        beginOrderFilePickerSession(input, step);
      });
      input.addEventListener("cancel", function () {
        invalidateOrderFilePickerSession(input);
      });
      input.addEventListener("change", function () {
        var picker = orderActiveFilePicker;
        var escolhidos = Array.prototype.slice.call(input.files || []);
        var files = escolhidos.filter(function (file) {
          return file && Number(file.size) > 0;
        });
        var revision;

        // Um ficheiro que chega com 0 bytes (placeholder do iCloud/OneDrive por
        // descarregar, permissão negada) era descartado aqui sem sinal nenhum:
        // a pessoa escolhia a foto e não acontecia nada.
        if (files.length < escolhidos.length) {
          logOrderUploadRejection("ficheiro_vazio_no_picker", {
            fase: "picker",
            chave: input.dataset.orderUploadKey || "",
            passo: step && step.id ? step.id : "",
            ficheiros: escolhidos.filter(function (file) {
              return !file || !(Number(file.size) > 0);
            }).map(orderUploadFileInfo)
          });
        }

        if (!picker || picker.input !== input) {
          logOrderUploadRejection("sessao_do_picker_perdida", {
            fase: "picker",
            chave: input.dataset.orderUploadKey || "",
            passo: step && step.id ? step.id : "",
            diagnostico: picker
              ? "O change chegou de um input diferente do que abriu o picker."
              : "Não havia sessão de picker aberta quando o change chegou.",
            ficheiros: escolhidos.map(orderUploadFileInfo)
          });
          input.value = "";
          return;
        }

        revision = picker.revision;
        orderActiveFilePicker = null;
        input.value = "";
        window.setTimeout(function () {
          var activeStep = currentStep(product);
          input.value = "";
          if (
            revision !== orderFilePickerRevision ||
            !document.documentElement.contains(input) ||
            !activeStep ||
            activeStep.id !== step.id
          ) {
            // Guarda contra escolhas de um passo que já não é o actual. Quando
            // dispara sem o passo ter mudado é bug nosso, e sem registo não há
            // maneira de saber que aconteceu.
            logOrderUploadRejection("escolha_descartada", {
              fase: "picker",
              chave: input.dataset.orderUploadKey || "",
              passo: step && step.id ? step.id : "",
              passoActual: activeStep && activeStep.id ? activeStep.id : "(nenhum)",
              revisaoEsperada: revision,
              revisaoActual: orderFilePickerRevision,
              inputNoDom: document.documentElement.contains(input),
              ficheiros: files.map(orderUploadFileInfo)
            });
            return;
          }

          orderFilePickerRevision += 1;
          if (files.length > 0) {
            startOrderPhotoUpload(product, step, input, files);
          }
        }, 0);
      });
    });

    document.querySelectorAll("[data-order-upload-remove]").forEach(function (button) {
      button.addEventListener("click", function () {
        var key = button.dataset.orderUploadKey || "quadro_uploads";
        var token = button.dataset.orderUploadRemove;
        removeOrderMediaUpload(product, key, token);
      });
    });

    document.querySelectorAll("[data-artwork-upload-quantity]").forEach(function (input) {
      function syncArtworkQuantity(commit) {
        var key = input.dataset.orderUploadKey || customArtworkConfig(product).uploadKey;
        var token = input.dataset.orderUploadToken || "";
        var parsed = parseInt(input.value, 10);
        var quantity;
        var item = orderUploadItems(key).filter(function (candidate) {
          return String(candidate.token || "") === token;
        })[0] || null;
        if (!item || (!commit && (!isFinite(parsed) || parsed < 1))) {
          return;
        }
        quantity = Math.max(1, Math.min(9999, parsed || 1));
        item.quantity = quantity;
        if (commit) {
          input.value = quantity;
        }
        if (!isCadernosProduct(product)) {
          state.selections.pack_quantity = customArtworkTotalQuantity(product);
        }
        state.errors = "";
        if (commit) {
          try {
            trackProductEvent(product, "artwork_quantity_changed", {
              quantity: quantity,
              artwork_count: customArtworkItems(product).length,
              artwork_total_quantity: customArtworkTotalQuantity(product)
            });
          } catch (e) {}
          rerenderProduct(product);
        }
      }

      input.addEventListener("input", function () {
        syncArtworkQuantity(false);
      });
      input.addEventListener("change", function () {
        syncArtworkQuantity(true);
      });
    });

    document.querySelectorAll("[data-order-audio-record]").forEach(function (button) {
      var release = function () {
        window.removeEventListener("pointerup", release);
        window.removeEventListener("pointercancel", release);
        stopOrderAudioRecording();
      };
      button.addEventListener("pointerdown", function (event) {
        event.preventDefault();
        startOrderAudioRecording(product, step, button);
        window.addEventListener("pointerup", release, { once: true });
        window.addEventListener("pointercancel", release, { once: true });
      });
      button.addEventListener("contextmenu", function (event) {
        event.preventDefault();
      });
    });

    document.querySelectorAll("[data-photo-help-key]").forEach(function (input) {
      input.addEventListener("change", function () {
        state.selections[input.dataset.photoHelpKey] = input.checked;
        if (input.checked) {
          resetQuadrosPhotoColorAnalysis();
        }
        state.errors = "";
        state.orderUploadError = "";
        state.orderUploadFeedbackKind = "photo";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-custom-design-upload]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.selections.order_flow = "custom";
        state.selections.design_source = "custom";
        state.selections.designs = [];
        state.selections.assorted_designs = "";
        state.selections.congregation_gift = false;
        resetQuantityState();
        state.errors = "";
        try { trackOptionSelected(product, "design_source", "custom", "Carregar o meu design"); } catch (e) {}
        goNext(product);
      });
    });

    document.querySelectorAll("[data-select-all-designs]").forEach(function (button) {
      button.addEventListener("click", function () {
        var designStep = findStep(product, "designs");
        var allValues = designStep && Array.isArray(designStep.items) ? designStep.items.map(function (item) { return item.value; }).filter(Boolean) : [];
        var currentValues = selectedDesignValues();
        var allSelected = allValues.length > 0 && currentValues.length === allValues.length;

        state.selections.assorted_designs = "";
        state.selections.order_flow = "catalog";
        state.selections.design_source = "catalog";
        state.selections.designs = allSelected ? [] : allValues;
        if (!allSelected) {
          state.selections.congregation_gift = false;
        }
        resetQuantityState();
        // SEMANTIC_EVENTS_V1: option_selected meta para "select all" ou unselect all
        try { trackOptionSelected(product, 'select_all_designs', allSelected ? 'cleared' : 'all', ''); } catch (e) {}
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-assorted-designs]").forEach(function (button) {
      button.addEventListener("click", function () {
        var active = isAssortedSelected(product);

        state.selections.assorted_designs = active ? "" : "1";
        if (!active) {
          state.selections.order_flow = "catalog";
          state.selections.design_source = "catalog";
          state.selections.designs = [];
          state.selections.congregation_gift = false;
        }
        resetQuantityState();
        // SEMANTIC_EVENTS_V1
        try { trackOptionSelected(product, 'assorted', active ? 'off' : 'on', ''); } catch (e) {}
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-option-drawer]").forEach(function (drawer) {
      drawer.addEventListener("toggle", function () {
        if (!state.optionDrawerOpen || typeof state.optionDrawerOpen !== "object") {
          state.optionDrawerOpen = {};
        }
        state.optionDrawerOpen[drawer.dataset.optionDrawer] = drawer.open;
      });
    });

    document.querySelectorAll("[data-option-drawer-choice]").forEach(function (input) {
      input.addEventListener("change", function () {
        var field = String(input.dataset.optionDrawerField || "");
        if (!field || !input.checked) {
          return;
        }
        state.selections[field] = input.value;
        state.errors = "";
        try { trackOptionSelected(product, field, input.value, input.closest("label").textContent || ""); } catch (e) {}
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-copy-step-selection]").forEach(function (button) {
      button.addEventListener("click", function () {
        var step = findStep(product, String(button.dataset.copyStepSelection || ""));
        var config = step && step.copySelection;
        var sourceField = String(config && config.sourceField || "");
        var targetField = String(config && config.targetField || "");
        var sourceValue = sourceField ? String(state.selections[sourceField] || "") : "";
        var valueMap = config && config.valueMap && typeof config.valueMap === "object" ? config.valueMap : {};
        var targetValue = Object.prototype.hasOwnProperty.call(valueMap, sourceValue)
          ? String(valueMap[sourceValue] || "")
          : sourceValue;

        if (!sourceValue || !targetField || !targetValue) {
          return;
        }
        if (Array.isArray(config.resetSelectionKeys)) {
          config.resetSelectionKeys.forEach(function (key) {
            delete state.selections[String(key)];
          });
        }
        state.selections[targetField] = targetValue;
        if (step.template === "designs-by-size") {
          syncGroupedDesignSelections(product, step);
          resetQuantityState();
        }
        state.errors = "";
        try { trackOptionSelected(product, targetField, targetValue, button.textContent || ""); } catch (e) {}
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-assignment-preview-open]").forEach(function (button) {
      function openAssignmentPreview(event) {
        var stepId = String(button.dataset.assignmentStep || "");
        var value = String(button.dataset.assignmentValue || "");
        var currentValue;
        var previousCard;
        var step;
        var config;
        var previousHasOnlyA6 = false;
        var nextHasOnlyA6 = false;

        function hasOnlySecondaryAssignment(card) {
          var selected = card ? Array.prototype.filter.call(card.querySelectorAll("[data-assignment-toggle]"), function (candidate) {
            return candidate.getAttribute("aria-pressed") === "true";
          }) : [];
          var secondary = config && config.groups[1];
          return selected.length === 1 && secondary
            && String(selected[0].dataset.assignmentGroup || "") === String(secondary.id || secondary.label || "");
        }

        if (event && event.type === "click" && event.target && event.target.closest("button")) {
          return;
        }
        if (!stepId || !value) {
          return;
        }
        step = findStep(product, stepId);
        config = assignmentPickerConfig(step);
        currentValue = state.assignmentPickerOpen && String(state.assignmentPickerOpen[stepId] || "");
        if (currentValue === value
          && state.assignmentPickerControlsExpanded
          && String(state.assignmentPickerControlsExpanded[stepId] || "") === value) {
          return;
        }
        previousCard = Array.prototype.filter.call(document.querySelectorAll("[data-assignment-preview-open]"), function (candidate) {
          return String(candidate.dataset.assignmentStep || "") === stepId
            && String(candidate.dataset.assignmentValue || "") === currentValue;
        })[0] || null;
        previousHasOnlyA6 = currentValue && hasOnlySecondaryAssignment(previousCard);
        nextHasOnlyA6 = hasOnlySecondaryAssignment(button);

        if (state.assignmentPickerMotionTimer) {
          window.clearTimeout(state.assignmentPickerMotionTimer);
        }
        state.assignmentPickerMotion = previousHasOnlyA6 || nextHasOnlyA6 ? {
          stepId: stepId,
          leavingValue: previousHasOnlyA6 ? currentValue : "",
          revealingValue: nextHasOnlyA6 ? value : ""
        } : null;
        if (!state.assignmentPickerOpen || typeof state.assignmentPickerOpen !== "object") {
          state.assignmentPickerOpen = {};
        }
        if (!state.assignmentPickerControlsExpanded || typeof state.assignmentPickerControlsExpanded !== "object") {
          state.assignmentPickerControlsExpanded = {};
        }
        state.assignmentPickerOpen[stepId] = value;
        state.assignmentPickerControlsExpanded[stepId] = value;
        state.errors = "";
        rerenderProduct(product);

        if (state.assignmentPickerMotion) {
          state.assignmentPickerMotionTimer = window.setTimeout(function () {
            state.assignmentPickerMotion = null;
            state.assignmentPickerMotionTimer = null;
            rerenderProduct(product);
          }, 250);
        }
      }

      button.addEventListener("click", openAssignmentPreview);
      button.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openAssignmentPreview(event);
        }
      });
    });

    document.querySelectorAll("[data-assignment-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        var step = findStep(product, String(button.dataset.assignmentStep || ""));
        var config = assignmentPickerConfig(step);
        var groupId = String(button.dataset.assignmentGroup || "");
        var field = String(button.dataset.assignmentField || "");
        var value = String(button.dataset.assignmentValue || "");
        var itemValue = String(button.dataset.assignmentItem || "");
        var previousValue = String(state.selections[field] || "");
        var resetKeys;
        var resetValues = {};
        var group = config ? config.groups.filter(function (candidate) {
          return String(candidate && (candidate.id || candidate.label) || "") === groupId;
        })[0] || null : null;

        if (!step || !group || !field || !value) {
          return;
        }
        if (state.assignmentPickerMotionTimer) {
          window.clearTimeout(state.assignmentPickerMotionTimer);
          state.assignmentPickerMotionTimer = null;
        }
        state.assignmentPickerMotion = null;
        resetKeys = step.resetFieldsByGroup && Array.isArray(step.resetFieldsByGroup[groupId])
          ? step.resetFieldsByGroup[groupId].map(String)
          : [];
        if (previousValue && previousValue !== value) {
          resetKeys.forEach(function (key) {
            if (Object.prototype.hasOwnProperty.call(state.selections, key)) {
              resetValues[key] = Array.isArray(state.selections[key])
                ? state.selections[key].slice()
                : state.selections[key];
            }
          });
        }

        if (previousValue === value) {
          delete state.selections[field];
        } else {
          state.selections[field] = value;
          if (previousValue) {
            if (!Array.isArray(state.assignmentPickerUndos)) {
              state.assignmentPickerUndos = [];
            }
            state.assignmentPickerUndoSequence = Number(state.assignmentPickerUndoSequence || 0) + 1;
            state.assignmentPickerUndos.push({
              id: String(Date.now()) + "-" + String(state.assignmentPickerUndoSequence),
              stepId: String(step.id || ""),
              groupId: groupId,
              field: field,
              previousValue: previousValue,
              newValue: value,
              itemValue: itemValue,
              resetKeys: resetKeys,
              resetValues: resetValues,
              expiresAt: Date.now() + 5000,
              message: String(config.undoMessage || "Escolha {group} atualizada.").replace("{group}", group.label || group.id || "")
            });
          }
        }
        if (state.assignmentPickerControlsExpanded && step.id) {
          state.assignmentPickerControlsExpanded[step.id] = itemValue;
        }
        resetKeys.forEach(function (key) { delete state.selections[key]; });
        resetQuantityState();
        state.errors = "";
        state.packDisabledMessage = "";
        try { trackOptionSelected(product, field, state.selections[field] || "off", button.textContent || ""); } catch (e) {}
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-assignment-undo]").forEach(function (button) {
      button.addEventListener("click", function () {
        var undoId = String(button.dataset.assignmentUndoId || "");
        var undos = Array.isArray(state.assignmentPickerUndos) ? state.assignmentPickerUndos : [];
        var undoIndex = undos.findIndex(function (candidate) {
          return String(candidate && candidate.id || "") === undoId;
        });
        var undo = undoIndex >= 0 ? undos[undoIndex] : null;
        if (!undo) {
          return;
        }
        if (Date.now() > Number(undo.expiresAt || 0)) {
          undos.splice(undoIndex, 1);
          state.assignmentPickerUndos = undos;
          rerenderProduct(product);
          return;
        }
        state.selections[undo.field] = undo.previousValue;
        (undo.resetKeys || []).forEach(function (key) {
          delete state.selections[key];
          if (Object.prototype.hasOwnProperty.call(undo.resetValues || {}, key)) {
            state.selections[key] = Array.isArray(undo.resetValues[key])
              ? undo.resetValues[key].slice()
              : undo.resetValues[key];
          }
        });
        if (state.assignmentPickerUndoInterval) {
          window.clearInterval(state.assignmentPickerUndoInterval);
        }
        undos.splice(undoIndex, 1);
        state.assignmentPickerUndos = undos;
        state.assignmentPickerUndoInterval = null;
        resetQuantityState();
        state.errors = "";
        state.packDisabledMessage = "";
        try { trackOptionSelected(product, undo.field, undo.previousValue, "Reverter"); } catch (e) {}
        rerenderProduct(product);
      });
    });

    if (state.assignmentPickerUndoInterval) {
      window.clearInterval(state.assignmentPickerUndoInterval);
      state.assignmentPickerUndoInterval = null;
    }
    if (Array.isArray(state.assignmentPickerUndos) && state.assignmentPickerUndos.length) {
      state.assignmentPickerUndoInterval = window.setInterval(function () {
        var now = Date.now();
        var undos = Array.isArray(state.assignmentPickerUndos) ? state.assignmentPickerUndos : [];
        var activeUndos = undos.filter(function (undo) {
          return undo && Number(undo.expiresAt || 0) > now;
        });
        var changed = activeUndos.length !== undos.length;
        state.assignmentPickerUndos = activeUndos;
        document.querySelectorAll("[data-assignment-undo-countdown]").forEach(function (countdown) {
          var countdownId = String(countdown.dataset.assignmentUndoId || "");
          var undo = activeUndos.filter(function (candidate) {
            return String(candidate && candidate.id || "") === countdownId;
          })[0] || null;
          if (undo) {
            countdown.textContent = String(Math.max(1, Math.ceil((Number(undo.expiresAt || 0) - now) / 1000)));
          }
        });
        if (changed) {
          window.clearInterval(state.assignmentPickerUndoInterval);
          state.assignmentPickerUndoInterval = null;
          rerenderProduct(product);
        }
      }, 200);
    }

    document.querySelectorAll("[data-pf-metal-corners-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        var field = String(button.dataset.pfMetalCornersField || "");
        var value = String(button.dataset.pfMetalCornersValue || "");
        if (!field || !value) {
          return;
        }
        if (String(state.selections[field] || "") === value) {
          delete state.selections[field];
        } else {
          state.selections[field] = value;
        }
        state.errors = "";
        try { trackOptionSelected(product, field, state.selections[field] || "off", button.textContent || ""); } catch (e) {}
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-continuous-variation-choice]").forEach(function (input) {
      input.addEventListener("change", function () {
        var field = String(input.dataset.continuousVariationField || "");
        var stepId = String(input.dataset.continuousVariationStep || "");
        var variationStep = stepId ? findStep(product, stepId) : null;
        if (!input.checked || !field || !variationStep) {
          return;
        }
        state.selections[field] = input.value;
        syncGroupedDesignSelections(product, variationStep);
        if (variationStep.aggregateField === "designs") {
          state.selections.order_flow = "catalog";
          state.selections.design_source = "catalog";
        }
        resetQuantityState();
        state.errors = "";
        state.packDisabledMessage = "";
        try { trackDesignToggle(product, input.value, true); } catch (e) {}
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-grouped-design-choice]").forEach(function (input) {
      input.addEventListener("change", function () {
        var active = currentStep(product);
        var field = String(input.dataset.groupedDesignField || "");
        if (!input.checked || !active || active.template !== "designs-by-size" || !field) {
          return;
        }
        state.selections[field] = input.value;
        var resetFields = active.resetFieldsByGroup && Array.isArray(active.resetFieldsByGroup[input.dataset.groupedDesignGroup])
          ? active.resetFieldsByGroup[input.dataset.groupedDesignGroup]
          : [];
        resetFields.forEach(function (key) {
          delete state.selections[key];
        });
        syncGroupedDesignSelections(product, active);
        if (active.aggregateField === "designs") {
          state.selections.order_flow = "catalog";
          state.selections.design_source = "catalog";
        }
        resetQuantityState();
        state.errors = "";
        state.packDisabledMessage = "";
        try { trackDesignToggle(product, input.value, true); } catch (e) {}
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-grouped-format-choice]").forEach(function (input) {
      input.addEventListener("change", function () {
        var active = currentStep(product);
        var formatStep = findStep(product, String(input.dataset.groupedFormatStep || "size"));
        if (!input.checked || !active || !formatStep) {
          return;
        }
        setSelection(formatStep, input);
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-choice-step]").forEach(function (input) {
      input.addEventListener("change", function () {
        // SEMANTIC_EVENTS_V1 (Phase C): captura semantic ANTES de mutar state
        // para podermos distinguir select vs unselect e ler o value correcto.
        try {
          if (step && step.id === 'designs') {
            // Multi (crachas/imanes/caderninhos): checked vs unchecked
            // Single (cadernos): change sempre seleciona um novo
            if (step.selection === 'multi') {
              trackDesignToggle(product, input.value, !!input.checked);
            } else {
              trackDesignToggle(product, input.value, true);
            }
          } else if (step && step.id) {
            // Outras steps com data-choice-step: option_selected
            // (lamination, cover_personalization, size, ...)
            var optType = step.id;
            // Para cover_personalization, normalizar para yes/no apenas.
            var optVal = input.value;
            var optLabel = '';
            var labelEl = input.closest && input.closest('label');
            if (labelEl) {
              optLabel = (labelEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
            }
            trackOptionSelected(product, optType, optVal, optLabel);
          }
        } catch (e) {}

        setSelection(step, input);
        if (step && step.id === "designs" && input.checked) {
          state.selections.order_flow = "catalog";
          state.selections.design_source = "catalog";
        }
        if (step && step.id === "cover_personalization" && input.value === "no") {
          state.selections.cover_personalization_text = "";
        }
        state.errors = "";
        state.packDisabledMessage = "";
        if (step && step.autoAdvance === true && step.selection === "single" && input.checked) {
          funnelNextTransitionReason = "option_auto_advance";
          goNext(product);
          return;
        }
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-pack-quantity]").forEach(function (button) {
      button.addEventListener("click", function () {
        var newPackQuantity = Number(button.dataset.packQuantity);
        var previousPackQuantity = getPackQuantity(product) || newPackQuantity;

        // CRACHAS_PACK_DISABLED_MESSAGE_V1: pack cinzento nao seleciona,
        // mostra mensagem curta junto aos packs.
        if (button.dataset.packDisabled === "1") {
          state.packDisabledMessage = packDisabledMessageFor(product, newPackQuantity);
          rerenderProduct(product);
          return;
        }

        // SMART_QUANTITIES_V1: o redimensionamento das quantidades é feito
        // por ensurePackAndQuantities, que escolhe entre scaleQuantities
        // (proporcional) e distributeQuantities (reset) consoante a
        // configuração admin "Quantidades inteligentes".
        state.packDisabledMessage = "";
        if (freeQuantityStep(product)) {
          setFreeQuantity(product, newPackQuantity, "pack", false);
        } else {
          state.selections.pack_quantity = newPackQuantity;
        }
        // SEMANTIC_EVENTS_V1: pack option chosen.
        try {
          var packLabel = '';
          if (button.dataset && button.dataset.trackLabel) packLabel = button.dataset.trackLabel;
          // Para cadernos a step "pack" pode ser caderno_normal/caderno_pioneiro
          // (item.value) — usamos o data-track-id quando existir.
          var optType = 'pack';
          var optValue = newPackQuantity;
          if (step && step.id === 'pack' && button.dataset && button.dataset.trackId) {
            // Para cadernos o button representa um purchase option (caderno_normal/pioneiro)
            var trackId = button.dataset.trackId || '';
            if (trackId.indexOf('cadernos_option_') === 0) {
              optType = 'purchase_option';
            }
          }
          trackOptionSelected(product, optType, optValue, packLabel);
        } catch (e) {}

        if (!freeQuantityStep(product)) {
          ensurePackAndQuantities(product);
          var packValues = Array.prototype.map.call(document.querySelectorAll("[data-pack-quantity]"), function (packButton) {
            return Number(packButton.dataset.packQuantity);
          }).filter(function (value) { return Number.isFinite(value); });
          miuDispatchProductEvent("miu-quantity-change", {
            previousValue: previousPackQuantity,
            currentValue: newPackQuantity,
            min: packValues.length ? Math.min.apply(Math, packValues) : newPackQuantity,
            max: packValues.length ? Math.max.apply(Math, packValues) : newPackQuantity,
            source: "pack",
            importance: miuReactionImportanceFromOptions(packValues, previousPackQuantity, newPackQuantity)
          });
        }
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-caderno-order-quantity]").forEach(function (button) {
      button.addEventListener("click", function () {
        var qty = Number(button.dataset.cadernoOrderQuantity);
        var previousQty = cadernoOrderQuantity(product);
        var config = cadernoOrderQuantityConfig(product);
        var cadernoQuantities = Array.prototype.map.call(document.querySelectorAll("[data-caderno-order-quantity]"), function (quantityButton) {
          return Number(quantityButton.dataset.cadernoOrderQuantity);
        });
        state.selections.caderno_order_quantity = qty;
        miuDispatchProductEvent("miu-quantity-change", {
          previousValue: previousQty,
          currentValue: qty,
          min: Math.max(1, parseInt(config.minimum, 10) || parseInt(product && product.minimumQuantity, 10) || 1),
          max: Math.max(qty, parseInt(config.maximum, 10) || 9999),
          source: "pack",
          importance: miuReactionImportanceFromOptions(cadernoQuantities, previousQty, qty)
        });
        // SEMANTIC_EVENTS_V1
        try { trackOptionSelected(product, 'caderno_qty', qty, ''); } catch (e) {}
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-caderno-order-quantity-change]").forEach(function (button) {
      button.addEventListener("click", function () {
        var config = cadernoOrderQuantityConfig(product);
        var minimum = Math.max(1, parseInt(config.minimum, 10) || parseInt(product && product.minimumQuantity, 10) || 1);
        var maximum = Math.max(minimum, parseInt(config.maximum, 10) || 9999);
        var change = parseInt(button.dataset.cadernoOrderQuantityChange, 10) || 0;
        var previousQuantity = cadernoOrderQuantity(product);
        var quantity = Math.max(minimum, Math.min(maximum, previousQuantity + change));
        state.selections.caderno_order_quantity = quantity;
        miuDispatchProductEvent("miu-quantity-change", {
          previousValue: previousQuantity,
          currentValue: quantity,
          min: minimum,
          max: maximum,
          source: "quantity"
        });
        try { trackOptionSelected(product, "caderno_qty", quantity, ""); } catch (e) {}
        state.errors = "";
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-caderno-order-quantity-input]").forEach(function (input) {
      function syncCadernoOrderQuantity(commit) {
        var config = cadernoOrderQuantityConfig(product);
        var minimum = Math.max(1, parseInt(config.minimum, 10) || parseInt(product && product.minimumQuantity, 10) || 1);
        var maximum = Math.max(minimum, parseInt(config.maximum, 10) || 9999);
        var parsed = parseInt(input.value, 10);
        var quantity;
        if (!commit && (!isFinite(parsed) || parsed < minimum)) {
          return;
        }
        var previousQuantity = cadernoOrderQuantity(product);
        quantity = Math.max(minimum, Math.min(maximum, parsed || minimum));
        state.selections.caderno_order_quantity = quantity;
        state.errors = "";
        if (commit) {
          input.value = quantity;
          miuDispatchProductEvent("miu-quantity-change", {
            previousValue: previousQuantity,
            currentValue: quantity,
            min: minimum,
            max: maximum,
            source: "quantity"
          });
          try { trackOptionSelected(product, "caderno_qty", quantity, ""); } catch (e) {}
          rerenderProduct(product);
        }
      }

      input.addEventListener("input", function () {
        syncCadernoOrderQuantity(false);
      });
      input.addEventListener("change", function () {
        syncCadernoOrderQuantity(true);
      });
    });

    document.querySelectorAll("[data-free-quantity-change]").forEach(function (button) {
      button.addEventListener("click", function () {
        var current = getPackQuantity(product) || effectiveMinimumFreeQuantity(product);
        var change = Number(button.dataset.freeQuantityChange || 0);
        var rangeMaximum = freeQuantityRangeMaximum(product);
        var next = current > rangeMaximum && change < 0 ? rangeMaximum : current + change;
        setFreeQuantity(product, next, "auto", true, change);
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-free-quantity-range]").forEach(function (input) {
      input.addEventListener("input", function () {
        var quantity = freeQuantityFromRangePosition(product, input.value);

        setFreeQuantity(product, quantity, "auto", false);
        refreshFreeQuantityDraft(product, input);
      });
      input.addEventListener("change", function () {
        setFreeQuantity(product, freeQuantityFromRangePosition(product, input.value), "auto");
        refreshFreeQuantityDraft(product, input);
      });
    });

    document.querySelectorAll("[data-quantity-pricing-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        var priceKey = priceKeyForSize(product, state.selections.size);

        if (!supportsQuantityPricingSwitch(product, priceKey)) {
          return;
        }

        state.selections.quantity_pricing_mode = selectedQuantityPricingMode(product, priceKey) === "quantity_tiers"
          ? "packs"
          : "quantity_tiers";
        state.errors = "";
        rerenderProduct(product);
      });
    });

    bindQuantityDistributionEvents(product);

    document.querySelectorAll("[data-detail-field]").forEach(function (input) {
      input.addEventListener("input", function () {
        var characterCount = document.querySelector('[data-character-count-for="' + input.name + '"]');
        state.selections[input.name] = input.value;
        if (characterCount && input.maxLength > 0) {
          characterCount.textContent = input.value.length + " / " + input.maxLength;
        }
        if (input.name === "quadro_text" && String(input.value || "").trim()) {
          state.selections.no_phrase = false;
          var noPhraseInput = document.querySelector('[data-details-skip-key="no_phrase"]');
          if (noPhraseInput) {
            noPhraseInput.checked = false;
          }
        }
        if (step && step.skipOption && step.skipOption.selectionKey && String(input.value || "").trim()) {
          var detailsSkipKey = String(step.skipOption.selectionKey);
          state.selections[detailsSkipKey] = false;
          var detailsSkipInput = document.querySelector('[data-details-skip-key="' + detailsSkipKey.replace(/"/g, '\\"') + '"]');
          if (detailsSkipInput) {
            detailsSkipInput.checked = false;
          }
        }
        if (step && step.template === "details-form") {
          saveCardDetailsSessionField(input.name, input.value);
        }
        refreshQuadrosBuildSummary(product);
        if (input.name === "customer_contact" && state.selections.send_copy && !state.selections.copy_email && isValidEmail(input.value)) {
          state.selections.copy_email = String(input.value).trim();
        }
        if (String(input.value || "").trim()) {
          input.classList.remove("is-missing");
          input.removeAttribute("aria-invalid");
          state.invalidFields = state.invalidFields.filter(function (name) {
            return name !== input.name;
          });
          if (!state.invalidFields.length) {
            state.errors = "";
            var actionError = document.querySelector(".wizard-shell .action-error");
            var nextButton = document.querySelector(".wizard-shell [data-next]");
            if (actionError) {
              actionError.remove();
            }
            if (nextButton) {
              nextButton.removeAttribute("aria-describedby");
            }
          }
        }
        // FUNNEL_TRACKING_V1: contact_started uma única vez por sessão,
        // disparado quando o utilizador começa a escrever em qualquer
        // campo de contacto (customer_name ou customer_contact).
        if (input.name === 'customer_name' || input.name === 'customer_contact') {
          maybeFireContactStarted(product);
          // OPEN_ORDER_HINT_V1: agendar check debounced quando os dois
          // campos têm um valor mínimo plausível. NUNCA mostra detalhes
          // — endpoint só devolve boolean.
          scheduleOpenOrderCheck(product);
        }
      });
      input.addEventListener("change", function () {
        state.selections[input.name] = input.value;
        if (step && step.template === "details-form") {
          saveCardDetailsSessionField(input.name, input.value);
        }
      });
    });

    document.querySelectorAll("[data-delivery-option]").forEach(function (input) {
      input.addEventListener("change", function () {
        state.selections.delivery_option = input.value;
        // FUNNEL_TRACKING_V1: regista escolha de entrega antes de re-renderizar.
        trackProductEvent(product, 'delivery_selected', {
          selected_delivery: input.value
        });
        // SEMANTIC_EVENTS_V1
        try {
          var labelTxt = '';
          var lab = input.closest && input.closest('label');
          if (lab) labelTxt = (lab.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
          trackOptionSelected(product, 'delivery', input.value, labelTxt);
        } catch (e) {}
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-gift-toggle]").forEach(function (input) {
      input.addEventListener("change", function () {
        state.selections.congregation_gift = input.checked;
      });
    });

    document.querySelectorAll("[data-copy-toggle]").forEach(function (input) {
      input.addEventListener("change", function () {
        state.selections.send_copy = input.checked;
        // COPY_REQUEST_AUTOCHECK_V1: marcar que o utilizador interagiu
        // manualmente para a heurística de auto-tick deixar de ligar a
        // checkbox quando o utilizador a desligou.
        state.selections.send_copy_touched = true;
        if (input.checked && !state.selections.copy_email && isValidEmail(state.selections.customer_contact)) {
          state.selections.copy_email = String(state.selections.customer_contact).trim();
        } else if (!input.checked) {
          state.selections.copy_email = "";
        }
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-copy-email]").forEach(function (input) {
      input.addEventListener("input", function () {
        state.selections.copy_email = input.value;
      });
      input.addEventListener("change", function () {
        state.selections.copy_email = input.value;
      });
    });

    document.querySelectorAll("[data-example-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.selections.show_details_example = !(state.selections.show_details_example !== false);
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-details-skip-key]").forEach(function (input) {
      input.addEventListener("change", function () {
        var skipKey = input.dataset.detailsSkipKey;
        var knownClearFields = {
          no_phrase: "quadro_text",
          no_dedication: "quadro_dedication",
          no_text: "quadro_text",
          no_silhouette_text: "quadro_silhouette_text",
          silhouette_contact_me: "quadro_silhouette_description"
        };
        var clearField = step && step.skipOption && step.skipOption.clearField
          ? String(step.skipOption.clearField)
          : knownClearFields[skipKey];
        state.selections[skipKey] = input.checked;
        if (clearField && input.checked) {
          state.selections[clearField] = "";
        }
        state.errors = "";
        state.invalidFields = [];
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-details-example-value]").forEach(function (button) {
      button.addEventListener("click", function () {
        var key = button.dataset.detailsExampleKey || "details_example";
        var value = button.dataset.detailsExampleValue || "";
        state.selections[key] = state.selections[key] === value ? "" : value;
        state.errors = "";
        state.invalidFields = [];
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-caderno-personalization-example-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.selections.show_caderno_personalization_example = !(state.selections.show_caderno_personalization_example !== false);
        rerenderProduct(product);
      });
    });

    document.querySelectorAll("[data-cover-personalization-text]").forEach(function (input) {
      input.addEventListener("input", function () {
        var limit = Number(input.dataset.coverPersonalizationLimit || 25);
        var help = document.querySelector("#cover-personalization-help");
        var count = document.querySelector("[data-cover-personalization-count]");

        state.selections.cover_personalization_text = input.value;
        if (count) {
          count.textContent = "(" + input.value.length + " / " + limit + ")";
        }
        if (!input.value.trim() && state.invalidFields.indexOf("cover_personalization_text") !== -1) {
          input.classList.add("is-missing");
          input.setAttribute("aria-invalid", "true");
          if (help) {
            help.className = "form-error";
            help.setAttribute("role", "alert");
            help.textContent = "Escreve o nome ou frase para personalizar a capa.";
          }
        } else if (input.value.length > limit) {
          input.classList.add("is-missing");
          input.setAttribute("aria-invalid", "true");
          if (help) {
            help.className = "form-error";
            help.setAttribute("role", "alert");
            help.textContent = "O nome/frase tem de ter no máximo " + limit + " caracteres.";
          }
        } else {
          input.classList.remove("is-missing");
          input.removeAttribute("aria-invalid");
          if (help) {
            help.className = "details-section-note";
            help.removeAttribute("role");
            help.textContent = "Máximo de " + limit + " caracteres.";
          }
          state.invalidFields = state.invalidFields.filter(function (name) {
            return name !== "cover_personalization_text";
          });
        }
        refreshCadernosBuildSummary(product);
      });
      input.addEventListener("change", function () {
        state.selections.cover_personalization_text = input.value;
      });
    });

    if (back) {
      back.addEventListener("click", function () {
        state.errors = "";
        if (state.currentStep === 0) {
          if (state.editingCartItemId) {
            cancelCartItemEdit();
            return;
          }
          window.location.href = product.homeUrl || "index.html";
          return;
        }
        // TRANSITION_REASON_V1
        funnelNextTransitionReason = 'back_button';
        goToWizardStep(product, state.currentStep - 1);
      });
    }

    if (next) {
      next.addEventListener("click", function () {
        if (state.currentStep < visibleSteps(product).length - 1) {
          // TRANSITION_REASON_V1
          funnelNextTransitionReason = 'next_button';
          goNext(product);
        }
      });
    }

    document.querySelectorAll("[data-order-suspended-submit]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.errors = ordersSuspendedCheckoutMessage();
        rerenderProduct(product);
      });
    });

    bindCustomProductBuilder(product);

    document.querySelectorAll("[data-cart-add-another]").forEach(function (button) {
      button.addEventListener("click", function () {
        addCurrentProductToCart(product, "index.html");
      });
    });

    document.querySelectorAll("[data-cart-finalize-current]").forEach(function (button) {
      button.addEventListener("click", function () {
        addCurrentProductToCart(product, "checkout.html");
      });
    });

    document.querySelectorAll("[data-cart-save-edit]").forEach(function (button) {
      button.addEventListener("click", function () {
        saveEditedCartItem(product);
      });
    });

    document.querySelectorAll("[data-cart-cancel-edit]").forEach(function (button) {
      button.addEventListener("click", function () {
        cancelCartItemEdit();
      });
    });

    document.querySelectorAll("[data-jump-step]").forEach(function (button) {
      button.addEventListener("click", function () {
        // TRANSITION_REASON_V1
        funnelNextTransitionReason = 'direct_step_click';
        goToWizardStep(product, Number(button.dataset.jumpStep));
      });
    });

    if (form) {
      form.addEventListener("submit", function (event) {
        var allPreviousValid;

        if (ordersAreSuspended()) {
          event.preventDefault();
          state.errors = ordersSuspendedCheckoutMessage();
          rerenderProduct(product);
          return;
        }

        allPreviousValid = visibleSteps(product).slice(0, -1).map(function (candidate) {
          return validateStep(product, candidate);
        }).filter(Boolean)[0];

        if (allPreviousValid) {
          event.preventDefault();
          // FUNNEL_TRACKING_V1: erro de validação em submit final.
          trackProductEvent(product, 'validation_error', {
            step_id: 'submit',
            step_index: state.currentStep
          });
          state.errors = allPreviousValid;
          rerenderProduct(product);
          focusProductFirstError();
          return;
        }

        // FUNNEL_TRACKING_SQLITE_V2: pedido enviado com sucesso. Disparado
        // antes do navegador iniciar a navegação para send-order.php
        // (sendBeacon sobrevive ao unload). Não inclui PII.
        // SELECTION_SNAPSHOT_V1 (Phase 4): snapshot final no envio.
        var submitExtras = { step_id: 'submit' };
        try {
          var submitSnap = funnelBuildSelectionSnapshot(product);
          if (submitSnap) submitExtras.selection_json = submitSnap;
        } catch (e) {}
        trackProductEvent(product, 'order_submitted', submitExtras);

        addHiddenFields(form, product);
      });
    }

    bindLazyDesignImages();
    bindImageViewerTriggers();
    bindAdminItemEditing(product);
  }
