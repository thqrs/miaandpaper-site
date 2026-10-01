/* 12 · Editor — o palco: página dupla, selecção (um ou vários elementos),
   arrastar, redimensionar, rectângulo de selecção, ímanes, teclado, e as
   operações sobre elementos (no molde ou só nesta página). */
(function () {
  'use strict';
  const A = window.Agenda;
  const M = A.modelo;
  const E = A.editor = {};
  const $ = s => document.querySelector(s);

  /* seleccao: o elemento principal (o do painel); outros: os restantes da selecção múltipla. */
  E.estado = { edicao: null, pagina: 0, seleccao: null, outros: [], modo: 'molde', zoom: null, guias: true };
  const PX_MM = 96 / 25.4;
  const IMAN = 1.6;

  /* ---------- páginas geradas (em cache até o projecto ou a edição mudarem) ---------- */
  let cache = null;
  M.ouvir(() => { cache = null; });
  E.gerado = function () {
    if (!cache || cache.edicao !== E.estado.edicao) {
      cache = A.gerador.gerar(M.obter(), E.estado.edicao);
      cache.edicao = E.estado.edicao;
    }
    return cache;
  };
  E.paginas = () => E.gerado().paginas;
  E.paginaActual = () => E.paginas()[Math.min(E.estado.pagina, E.paginas().length - 1)];

  E.env = function (guias) {
    const p = M.obter();
    const ed = p.edicoes[E.estado.edicao];
    const g = E.gerado();
    return { estilos: p.estilos, tema: ed.tema || p.tema, feriados: g.feriados, eventos: g.eventos, edicaoId: E.estado.edicao, guias };
  };

  /* ---------- elementos ---------- */
  function molde(p, pagina) { return p.moldes[pagina.molde]; }

  E.elementosEfectivos = function (pagina) {
    pagina = pagina || E.paginaActual();
    if (!pagina || !pagina.molde) return [];
    const p = M.obter();
    const exc = p.edicoes[E.estado.edicao].excepcoes[pagina.chave];
    return A.gerador.aplicarExcepcao(molde(p, pagina).elementos, exc);
  };

  E.ids = () => (E.estado.seleccao ? [E.estado.seleccao, ...E.estado.outros] : []);

  E.seleccionado = function () {
    const id = E.estado.seleccao;
    return id ? E.elementosEfectivos().find(el => el.id === id) || null : null;
  };

  E.seleccionados = function () {
    const ids = new Set(E.ids());
    return E.elementosEfectivos().filter(el => ids.has(el.id));
  };

  /* Excepção da página actual, criada se for preciso. */
  function excepcao(p, criar) {
    const pg = E.paginaActual();
    const lista = p.edicoes[E.estado.edicao].excepcoes;
    if (!lista[pg.chave] && criar) lista[pg.chave] = {};
    return lista[pg.chave];
  }

  function limparExcepcao(p) {
    const pg = E.paginaActual();
    const lista = p.edicoes[E.estado.edicao].excepcoes;
    const exc = lista[pg.chave];
    if (!exc) return;
    if (exc.alterar) for (const k of Object.keys(exc.alterar)) if (!Object.keys(exc.alterar[k]).length) delete exc.alterar[k];
    for (const k of ['alterar', 'ocultar', 'acrescentar']) {
      if (exc[k] && !Object.keys(exc[k]).length) delete exc[k];
    }
    if (!Object.keys(exc).length) delete lista[pg.chave];
  }

  /* Onde vive o elemento: no molde ou numa excepção (acrescentado só nesta página). */
  function localizar(p, id) {
    const exc = excepcao(p, false);
    const acrescentados = exc && exc.acrescentar;
    if (acrescentados) {
      const i = acrescentados.findIndex(el => el.id === id);
      if (i >= 0) return { lista: acrescentados, indice: i, el: acrescentados[i], acrescentado: true };
    }
    const lista = molde(p, E.paginaActual()).elementos;
    const i = lista.findIndex(el => el.id === id);
    return i >= 0 ? { lista, indice: i, el: lista[i], acrescentado: false } : null;
  }

  function aplicarProps(alvo, props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined) delete alvo[k];
      else if (k === 'sobre' && v && typeof v === 'object') {
        alvo.sobre = Object.assign({}, alvo.sobre, v);
        for (const [kk, vv] of Object.entries(v)) if (vv === undefined) delete alvo.sobre[kk];
        if (!Object.keys(alvo.sobre).length) delete alvo.sobre;
      } else alvo[k] = v;
    }
  }

  function definirEm(p, id, props) {
    const loc = localizar(p, id);
    if (!loc) return;
    if (loc.acrescentado || E.estado.modo === 'molde') {
      aplicarProps(loc.el, props);
    } else {
      const exc = excepcao(p, true);
      exc.alterar = exc.alterar || {};
      exc.alterar[id] = exc.alterar[id] || {};
      aplicarProps(exc.alterar[id], props);
      limparExcepcao(p);
    }
  }

  /* Muda propriedades de um elemento (o seleccionado, por omissão). */
  E.definir = function (props, juntar, id) {
    id = id || E.estado.seleccao;
    if (!id) return;
    M.alterar(p => definirEm(p, id, props), juntar ? juntar + ':' + id : null);
  };

  /* Várias alterações num só passo de desfazer: [[id, props], …]. */
  E.definirVarios = function (lista, juntar) {
    if (!lista.length) return;
    M.alterar(p => { for (const [id, props] of lista) definirEm(p, id, props); }, juntar || null);
  };

  E.repor = function (id) {
    id = id || E.estado.seleccao;
    M.alterar(p => {
      const exc = excepcao(p, false);
      if (exc && exc.alterar) delete exc.alterar[id];
      if (exc && exc.ocultar) exc.ocultar = exc.ocultar.filter(x => x !== id);
      limparExcepcao(p);
    });
  };

  E.apagar = function () {
    const ids = E.ids();
    if (!ids.length) return;
    M.alterar(p => {
      for (const id of ids) {
        const loc = localizar(p, id);
        if (!loc) continue;
        if (loc.acrescentado || E.estado.modo === 'molde') loc.lista.splice(loc.indice, 1);
        else {
          const exc = excepcao(p, true);
          exc.ocultar = [...new Set([...(exc.ocultar || []), id])];
        }
      }
      limparExcepcao(p);
    });
    E.estado.seleccao = null;
    E.estado.outros = [];
  };

  function semMarcas(el) {
    const c = JSON.parse(JSON.stringify(el));
    delete c._alterado; delete c._acrescentado;
    return c;
  }

  /* Junta elementos novos (no molde ou só nesta página) e selecciona-os. */
  function juntarElementos(els) {
    M.alterar(p => {
      for (const el of els) {
        if (E.estado.modo === 'molde') molde(p, E.paginaActual()).elementos.push(el);
        else {
          const exc = excepcao(p, true);
          exc.acrescentar = exc.acrescentar || [];
          exc.acrescentar.push(el);
        }
      }
    });
    E.estado.seleccao = els[0].id;
    E.estado.outros = els.slice(1).map(el => el.id);
  }

  E.duplicar = function () {
    const els = E.seleccionados();
    if (!els.length) return;
    juntarElementos(els.map(el => Object.assign(semMarcas(el), { id: M.novoId(), x: el.x + 3, y: el.y + 3 })));
  };

  let copiados = [];
  E.copiar = () => { copiados = E.seleccionados().map(semMarcas); };
  E.colar = () => {
    if (copiados.length) juntarElementos(copiados.map(el => Object.assign(JSON.parse(JSON.stringify(el)), { id: M.novoId() })));
  };

  E.inserir = function (tipo, extra) {
    const pg = E.paginaActual();
    if (!pg || !pg.molde) return;
    const d = A.componentes.descrever(tipo);
    const p = M.obter();
    const geo = A.desenhar.geometria(p, pg.lado);
    const el = Object.assign({ id: M.novoId(), tipo: d.tipoReal || tipo }, JSON.parse(JSON.stringify(d.omissao || {})), extra || {});
    const estilos = Object.keys(p.estilos.texto);
    const omissao = ['texto', 'rotulo', 'secao'].find(n => estilos.includes(n)) || estilos[0];
    for (const prop of d.propriedades) if (prop.tipo === 'estilo' && !el[prop.chave]) el[prop.chave] = omissao;
    el.l = Math.min(el.l || 40, geo.largura);
    el.a = Math.min(el.a || 20, geo.altura);
    el.x = Math.round((geo.largura - el.l) / 2);
    el.y = Math.round((geo.altura - el.a) / 2);
    juntarElementos([el]);
  };

  /* Muda a ordem (para a frente / para trás) dentro da mesma lista. */
  E.ordem = function (delta) {
    const id = E.estado.seleccao;
    if (!id) return;
    M.alterar(p => {
      const loc = localizar(p, id);
      if (!loc) return;
      const j = Math.max(0, Math.min(loc.lista.length - 1, loc.indice + delta));
      loc.lista.splice(j, 0, loc.lista.splice(loc.indice, 1)[0]);
    });
  };

  /* ---------- alinhar e distribuir vários ---------- */
  function rectsSeleccionados() {
    const pg = E.paginaActual();
    return E.seleccionados().map(el => Object.assign(rectEcra(el, pg), { el }));
  }

  function guardarRect(r, x, y) {
    const pg = E.paginaActual();
    const geo = A.desenhar.geometria(M.obter(), pg.lado);
    const espelhado = r.el.espelhar && pg.lado === 'esquerda';
    const xr = +(espelhado ? geo.largura - x - r.l : x).toFixed(2);
    return [r.el.id, { x: xr, y: +y.toFixed(2) }];
  }

  E.alinhar = function (como) {
    const rs = rectsSeleccionados();
    if (rs.length < 2) return;
    const x1 = Math.min(...rs.map(r => r.x)), x2 = Math.max(...rs.map(r => r.x + r.l));
    const y1 = Math.min(...rs.map(r => r.y)), y2 = Math.max(...rs.map(r => r.y + r.a));
    E.definirVarios(rs.map(r => {
      const x = { esquerda: x1, centro: (x1 + x2 - r.l) / 2, direita: x2 - r.l }[como];
      const y = { topo: y1, meio: (y1 + y2 - r.a) / 2, base: y2 - r.a }[como];
      return guardarRect(r, x == null ? r.x : x, y == null ? r.y : y);
    }));
  };

  E.distribuir = function (eixo) {
    const rs = rectsSeleccionados();
    if (rs.length < 3) return;
    const pos = eixo === 'h' ? 'x' : 'y', tam = eixo === 'h' ? 'l' : 'a';
    rs.sort((a, b) => a[pos] - b[pos]);
    const inicio = rs[0][pos], fim = rs[rs.length - 1][pos] + rs[rs.length - 1][tam];
    const ocupado = rs.reduce((s, r) => s + r[tam], 0);
    const folga = (fim - inicio - ocupado) / (rs.length - 1);
    let cursor = inicio;
    E.definirVarios(rs.map(r => {
      const v = cursor;
      cursor += r[tam] + folga;
      return eixo === 'h' ? guardarRect(r, v, r.y) : guardarRect(r, r.x, v);
    }));
  };

  /* ---------- navegação ---------- */
  E.irPara = function (indice) {
    const n = E.paginas().length;
    E.estado.pagina = Math.max(0, Math.min(n - 1, indice));
    const ids = new Set(E.elementosEfectivos().map(el => el.id));
    if (!ids.has(E.estado.seleccao)) { E.estado.seleccao = null; E.estado.outros = []; }
    E.estado.outros = E.estado.outros.filter(id => ids.has(id));
    E.redesenhar();
  };

  E.seleccionar = function (id, ids) {
    E.estado.seleccao = id;
    E.estado.outros = (ids || []).filter(x => x !== id);
    E.redesenhar();
  };

  E.mudarModo = function (modo) {
    E.estado.modo = modo;
    E.redesenhar();
  };

  /* ---------- desenho do palco ---------- */
  function paginasDaDupla() {
    const ps = E.paginas();
    const i = Math.min(E.estado.pagina, ps.length - 1);
    const p = ps[i];
    if (!p) return [];
    if (p.lado === 'direita') return [i > 0 && ps[i - 1].lado === 'esquerda' ? i - 1 : null, i];
    return [i, i + 1 < ps.length && ps[i + 1].lado === 'direita' ? i + 1 : null];
  }

  function zoomAjustado(palco) {
    const fmt = M.obter().formato.pagina;
    const largura = (palco.clientWidth - 48) / (fmt.largura * 2 * PX_MM);
    const altura = (palco.clientHeight - 48) / (fmt.altura * PX_MM);
    return Math.max(.3, Math.min(largura, altura));
  }

  E.redesenhar = function () {
    if (!M.obter()) return;
    document.dispatchEvent(new Event('agendas:redesenhar'));
  };

  E.desenharPalco = function () {
    const palco = $('#palco');
    const p = M.obter();
    const zoom = E.estado.zoom || zoomAjustado(palco);
    document.documentElement.style.setProperty('--zoom', zoom);
    const env = E.env(E.estado.guias);
    const dupla = document.createElement('div');
    dupla.className = 'dupla-edicao modo-' + E.estado.modo;
    dupla.style.zoom = zoom;
    for (const i of paginasDaDupla()) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      if (i != null) {
        const pg = E.paginas()[i];
        const dom = A.desenhar.pagina(pg, p, env);
        dom.dataset.indice = i;
        if (i === E.estado.pagina) dom.classList.add('actual');
        slot.appendChild(dom);
      }
      dupla.appendChild(slot);
    }
    palco.replaceChildren(dupla);
    desenharSeleccao();
  };

  /* Rectângulo do elemento como aparece na página (mm, caixa de conteúdo). */
  function rectEcra(el, pg) {
    const geo = A.desenhar.geometria(M.obter(), pg.lado);
    const espelhado = el.espelhar && pg.lado === 'esquerda';
    return { x: espelhado ? geo.largura - el.x - el.l : el.x, y: el.y, l: el.l, a: el.a, geo, espelhado };
  }

  function conteudoActual() {
    return document.querySelector('#palco .pagina.actual .conteudo');
  }

  function caixaDe(id) {
    const c = conteudoActual();
    return c && c.querySelector(`:scope > .el[data-id="${id}"]`);
  }

  function desenharSeleccao() {
    const conteudo = conteudoActual();
    const els = E.seleccionados();
    if (!conteudo || !els.length) return;
    const unico = els.length === 1;
    for (const el of els) {
      const s = document.createElement('div');
      s.className = 'seleccao' + (unico ? '' : ' multipla');
      s.dataset.para = el.id;
      posicionar(s, rectEcra(el, E.paginaActual()));
      if (unico) {
        s.id = 'seleccao';
        for (const h of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
          const ph = document.createElement('div');
          ph.className = 'puxador p-' + h;
          ph.dataset.puxador = h;
          s.appendChild(ph);
        }
      }
      conteudo.appendChild(s);
      const caixa = caixaDe(el.id);
      if (caixa) caixa.classList.add('seleccionado');
    }
  }

  function posicionar(no, r) {
    if (!no) return;
    Object.assign(no.style, { left: r.x + 'mm', top: r.y + 'mm', width: r.l + 'mm', height: r.a + 'mm' });
  }

  /* ---------- ímanes ---------- */
  function alvos(excluir) {
    const pg = E.paginaActual();
    const geo = A.desenhar.geometria(M.obter(), pg.lado);
    const xs = [0, geo.largura / 2, geo.largura], ys = [0, geo.altura / 2, geo.altura];
    for (const el of E.elementosEfectivos()) {
      if (excluir.has(el.id) || (el.edicoes && !el.edicoes.includes(E.estado.edicao))) continue;
      const r = rectEcra(el, pg);
      xs.push(r.x, r.x + r.l / 2, r.x + r.l);
      ys.push(r.y, r.y + r.a / 2, r.y + r.a);
    }
    return { xs, ys };
  }

  function encaixar(posicoes, lista, tolerancia) {
    let melhor = null;
    for (const v of posicoes) {
      for (const t of lista) {
        const d = t - v;
        if (Math.abs(d) <= tolerancia && (!melhor || Math.abs(d) < Math.abs(melhor.d))) melhor = { d, linha: t };
      }
    }
    return melhor;
  }

  function mostrarGuias(linhasX, linhasY) {
    const conteudo = conteudoActual();
    if (!conteudo) return;
    conteudo.querySelectorAll('.guia-iman').forEach(g => g.remove());
    for (const x of linhasX) {
      const g = document.createElement('div');
      g.className = 'guia-iman v';
      g.style.left = x + 'mm';
      conteudo.appendChild(g);
    }
    for (const y of linhasY) {
      const g = document.createElement('div');
      g.className = 'guia-iman h';
      g.style.top = y + 'mm';
      conteudo.appendChild(g);
    }
  }

  const arred = v => Math.round(v * 2) / 2;

  /* ---------- rato ---------- */
  let gesto = null;

  function escala() {
    return document.querySelector('#palco .pagina.actual').getBoundingClientRect().width / M.obter().formato.pagina.largura;
  }

  /* Posição do rato em mm, relativa à caixa de conteúdo da página actual. */
  function emMm(ev) {
    const c = conteudoActual().getBoundingClientRect();
    const k = escala();
    return [(ev.clientX - c.left) / k, (ev.clientY - c.top) / k];
  }

  function aoPremir(ev) {
    if (ev.button !== 0) return;
    const paginaDom = ev.target.closest('.pagina');
    if (!paginaDom) { if (E.ids().length) E.seleccionar(null); return; }
    const indice = +paginaDom.dataset.indice;
    const puxador = ev.target.dataset && ev.target.dataset.puxador;
    const caixa = ev.target.closest('.conteudo > .el[data-id]');

    if (indice !== E.estado.pagina) {
      E.estado.pagina = indice;
      E.estado.seleccao = caixa ? caixa.dataset.id : null;
      E.estado.outros = [];
      E.redesenhar();
      return;
    }
    ev.preventDefault();

    // Shift + clique: junta ou tira da selecção.
    if (caixa && ev.shiftKey && !puxador) {
      const id = caixa.dataset.id;
      const ids = E.ids();
      const novos = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
      E.seleccionar(novos[0] || null, novos);
      return;
    }

    // Clique no vazio: rectângulo de selecção.
    if (!puxador && !caixa) {
      gesto = { tipo: 'rectangulo', inicio: emMm(ev), mexeu: false, aditivo: ev.shiftKey };
      window.addEventListener('pointermove', aoMover);
      window.addEventListener('pointerup', aoLargar, { once: true });
      return;
    }

    const id = puxador ? E.estado.seleccao : caixa.dataset.id;
    if (!E.ids().includes(id)) { E.estado.seleccao = id; E.estado.outros = []; E.redesenhar(); }
    const els = puxador ? [E.seleccionado()] : E.seleccionados();
    if (!els.length || !els[0]) return;
    const pg = E.paginaActual();
    gesto = {
      tipo: puxador ? 'redimensionar' : 'mover', puxador, inicio: [ev.clientX, ev.clientY], escala: escala(),
      itens: els.map(el => ({ el, r0: rectEcra(el, pg) })), alvos: alvos(new Set(els.map(el => el.id))), mexeu: false
    };
    window.addEventListener('pointermove', aoMover);
    window.addEventListener('pointerup', aoLargar, { once: true });
  }

  function caixaEnvolvente(rs) {
    const x1 = Math.min(...rs.map(r => r.x)), y1 = Math.min(...rs.map(r => r.y));
    const x2 = Math.max(...rs.map(r => r.x + r.l)), y2 = Math.max(...rs.map(r => r.y + r.a));
    return { x: x1, y: y1, l: x2 - x1, a: y2 - y1 };
  }

  function aoMover(ev) {
    if (!gesto) return;
    if (gesto.tipo === 'rectangulo') return moverRectangulo(ev);
    const dx = (ev.clientX - gesto.inicio[0]) / gesto.escala;
    const dy = (ev.clientY - gesto.inicio[1]) / gesto.escala;
    if (!gesto.mexeu && Math.hypot(dx, dy) < .6) return;
    gesto.mexeu = true;
    const linhasX = [], linhasY = [];
    const semIman = ev.altKey;

    if (gesto.tipo === 'mover') {
      const caixa0 = caixaEnvolvente(gesto.itens.map(i => i.r0));
      let mx = dx, my = dy;
      if (!semIman) {
        const x = caixa0.x + dx, y = caixa0.y + dy;
        const ix = encaixar([x, x + caixa0.l / 2, x + caixa0.l], gesto.alvos.xs, IMAN);
        const iy = encaixar([y, y + caixa0.a / 2, y + caixa0.a], gesto.alvos.ys, IMAN);
        mx = ix ? dx + ix.d : arred(x) - caixa0.x;
        my = iy ? dy + iy.d : arred(y) - caixa0.y;
        if (ix) linhasX.push(ix.linha);
        if (iy) linhasY.push(iy.linha);
      }
      for (const it of gesto.itens) {
        it.r = { x: it.r0.x + mx, y: it.r0.y + my, l: it.r0.l, a: it.r0.a };
        posicionar(caixaDe(it.el.id), it.r);
        posicionar(document.querySelector(`#palco .seleccao[data-para="${it.el.id}"]`), it.r);
      }
    } else {
      const it = gesto.itens[0], r0 = it.r0, h = gesto.puxador;
      let x1 = r0.x, y1 = r0.y, x2 = r0.x + r0.l, y2 = r0.y + r0.a;
      if (h.includes('w')) x1 += dx;
      if (h.includes('e')) x2 += dx;
      if (h.includes('n')) y1 += dy;
      if (h.includes('s')) y2 += dy;
      if (!semIman) {
        const snap = (v, lista, linhas) => {
          const m = encaixar([v], lista, IMAN);
          if (m) { linhas.push(m.linha); return v + m.d; }
          return arred(v);
        };
        if (h.includes('w')) x1 = snap(x1, gesto.alvos.xs, linhasX);
        if (h.includes('e')) x2 = snap(x2, gesto.alvos.xs, linhasX);
        if (h.includes('n')) y1 = snap(y1, gesto.alvos.ys, linhasY);
        if (h.includes('s')) y2 = snap(y2, gesto.alvos.ys, linhasY);
      }
      if (ev.shiftKey && h.length === 2) {
        const a = Math.max(1, x2 - x1) * r0.a / r0.l;
        if (h.includes('n')) y1 = y2 - a; else y2 = y1 + a;
      }
      it.r = { x: Math.min(x1, x2 - 1), y: Math.min(y1, y2 - 1), l: Math.max(1, x2 - x1), a: Math.max(1, y2 - y1) };
      posicionar(caixaDe(it.el.id), it.r);
      posicionar(document.getElementById('seleccao'), it.r);
    }
    mostrarGuias(linhasX, linhasY);
  }

  function moverRectangulo(ev) {
    const [x, y] = emMm(ev);
    const [x0, y0] = gesto.inicio;
    if (!gesto.mexeu && Math.hypot(x - x0, y - y0) < 1) return;
    gesto.mexeu = true;
    gesto.r = { x: Math.min(x, x0), y: Math.min(y, y0), l: Math.abs(x - x0), a: Math.abs(y - y0) };
    let no = document.getElementById('rectangulo-seleccao');
    if (!no) {
      no = document.createElement('div');
      no.id = 'rectangulo-seleccao';
      no.className = 'rectangulo-seleccao';
      conteudoActual().appendChild(no);
    }
    posicionar(no, gesto.r);
  }

  function aoLargar() {
    window.removeEventListener('pointermove', aoMover);
    const g = gesto;
    gesto = null;
    if (!g) return;
    if (g.tipo === 'rectangulo') {
      if (!g.mexeu) { E.seleccionar(null); return; }
      const r = g.r, pg = E.paginaActual();
      const dentro = E.elementosEfectivos().filter(el => {
        if (el.edicoes && !el.edicoes.includes(E.estado.edicao)) return false;
        const e = rectEcra(el, pg);
        return e.x < r.x + r.l && e.x + e.l > r.x && e.y < r.y + r.a && e.y + e.a > r.y;
      }).map(el => el.id);
      const ids = g.aditivo ? [...new Set([...E.ids(), ...dentro])] : dentro;
      E.seleccionar(ids[0] || null, ids);
      return;
    }
    if (!g.mexeu) return;
    const arr = v => Math.round(v * 100) / 100;
    E.definirVarios(g.itens.filter(it => it.r).map(it => {
      const r = it.r;
      const x = it.r0.espelhado ? it.r0.geo.largura - r.x - r.l : r.x;
      return [it.el.id, { x: arr(x), y: arr(r.y), l: arr(r.l), a: arr(r.a) }];
    }));
  }

  /* ---------- teclado ---------- */
  function aEscrever(ev) {
    const t = ev.target;
    return t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
  }

  function aoTeclar(ev) {
    const ctrl = ev.ctrlKey || ev.metaKey;
    const tecla = ev.key.toLowerCase();
    if (ctrl && tecla === 'z' && !aEscrever(ev)) { ev.preventDefault(); ev.shiftKey ? M.refazer() : M.desfazer(); return; }
    if (ctrl && tecla === 'y' && !aEscrever(ev)) { ev.preventDefault(); M.refazer(); return; }
    if (aEscrever(ev)) return;
    if (ev.key === 'PageDown') { ev.preventDefault(); E.irPara(E.estado.pagina + 1); return; }
    if (ev.key === 'PageUp') { ev.preventDefault(); E.irPara(E.estado.pagina - 1); return; }
    if (ctrl && tecla === 'v') { ev.preventDefault(); E.colar(); return; }
    if (ctrl && tecla === 'a') {
      ev.preventDefault();
      const ids = E.elementosEfectivos().filter(el => !el.edicoes || el.edicoes.includes(E.estado.edicao)).map(el => el.id);
      E.seleccionar(ids[0] || null, ids);
      return;
    }
    const els = E.seleccionados();
    if (!els.length) return;
    const passo = ev.shiftKey ? 5 : .5;
    const mover = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[ev.key];
    if (mover) {
      ev.preventDefault();
      const lado = E.paginaActual().lado;
      E.definirVarios(els.map(el => {
        const espelhado = el.espelhar && lado === 'esquerda';
        return [el.id, { x: +(el.x + (espelhado ? -mover[0] : mover[0])).toFixed(2), y: +(el.y + mover[1]).toFixed(2) }];
      }), 'setas');
    } else if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); E.apagar(); }
    else if (ctrl && tecla === 'd') { ev.preventDefault(); E.duplicar(); }
    else if (ctrl && tecla === 'c') { E.copiar(); }
    else if (ev.key === 'Escape') E.seleccionar(null);
  }

  function aoRodar(ev) {
    if (!ev.ctrlKey) return;
    ev.preventDefault();
    const actual = E.estado.zoom || zoomAjustado($('#palco'));
    E.estado.zoom = Math.max(.3, Math.min(4, actual * (ev.deltaY < 0 ? 1.1 : 1 / 1.1)));
    E.redesenhar();
  }

  E.zoomAjustar = () => { E.estado.zoom = null; E.redesenhar(); };

  E.iniciar = function () {
    const palco = $('#palco');
    palco.addEventListener('pointerdown', aoPremir);
    palco.addEventListener('wheel', aoRodar, { passive: false });
    window.addEventListener('keydown', aoTeclar);
    window.addEventListener('resize', () => { if (!E.estado.zoom) E.redesenhar(); });
  };
})();
