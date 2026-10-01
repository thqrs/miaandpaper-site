/* 12 · Editor — o palco: página dupla, selecção, arrastar, redimensionar,
   ímanes, teclado, e as operações sobre elementos (no molde ou só nesta página). */
(function () {
  'use strict';
  const A = window.Agenda;
  const M = A.modelo;
  const E = A.editor = {};
  const $ = s => document.querySelector(s);

  E.estado = { edicao: null, pagina: 0, seleccao: null, modo: 'molde', zoom: null, guias: true };
  const PX_MM = 96 / 25.4;
  const IMAN = 1.6;

  /* ---------- páginas geradas (em cache até o projecto mudar) ---------- */
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
    return { estilos: p.estilos, tema: ed.tema || p.tema, feriados: E.gerado().feriados, edicaoId: E.estado.edicao, guias };
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

  E.seleccionado = function () {
    const id = E.estado.seleccao;
    return id ? E.elementosEfectivos().find(el => el.id === id) || null : null;
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

  /* Onde vive o elemento na estrutura: no molde ou numa excepção (acrescentado). */
  function localizar(p, id) {
    const pg = E.paginaActual();
    const exc = excepcao(p, false);
    const acrescentados = exc && exc.acrescentar;
    if (acrescentados) {
      const i = acrescentados.findIndex(el => el.id === id);
      if (i >= 0) return { lista: acrescentados, indice: i, el: acrescentados[i], acrescentado: true };
    }
    const lista = molde(p, pg).elementos;
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

  /* Muda propriedades do elemento seleccionado, no molde ou só nesta página. */
  E.definir = function (props, juntar, id) {
    id = id || E.estado.seleccao;
    if (!id) return;
    M.alterar(p => {
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
    }, juntar ? juntar + ':' + id : null);
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
    const id = E.estado.seleccao;
    if (!id) return;
    M.alterar(p => {
      const loc = localizar(p, id);
      if (!loc) return;
      if (loc.acrescentado || E.estado.modo === 'molde') loc.lista.splice(loc.indice, 1);
      else {
        const exc = excepcao(p, true);
        exc.ocultar = [...new Set([...(exc.ocultar || []), id])];
      }
      limparExcepcao(p);
    });
    E.estado.seleccao = null;
  };

  function semMarcas(el) {
    const c = JSON.parse(JSON.stringify(el));
    delete c._alterado; delete c._acrescentado;
    return c;
  }

  /* Junta um elemento novo: no molde, ou só nesta página. */
  function juntarElemento(el) {
    M.alterar(p => {
      if (E.estado.modo === 'molde') molde(p, E.paginaActual()).elementos.push(el);
      else {
        const exc = excepcao(p, true);
        exc.acrescentar = exc.acrescentar || [];
        exc.acrescentar.push(el);
      }
    });
    E.estado.seleccao = el.id;
  }

  E.duplicar = function () {
    const el = E.seleccionado();
    if (!el) return;
    const novo = Object.assign(semMarcas(el), { id: M.novoId(), x: el.x + 3, y: el.y + 3 });
    juntarElemento(novo);
  };

  let copiado = null;
  E.copiar = () => { const el = E.seleccionado(); if (el) copiado = semMarcas(el); };
  E.colar = () => { if (copiado) juntarElemento(Object.assign(JSON.parse(JSON.stringify(copiado)), { id: M.novoId() })); };

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
    juntarElemento(el);
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

  /* ---------- navegação ---------- */
  E.irPara = function (indice) {
    const n = E.paginas().length;
    E.estado.pagina = Math.max(0, Math.min(n - 1, indice));
    const ids = new Set(E.elementosEfectivos().map(el => el.id));
    if (!ids.has(E.estado.seleccao)) E.estado.seleccao = null;
    E.redesenhar();
  };

  E.seleccionar = function (id) {
    E.estado.seleccao = id;
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

  /* Rectângulo do elemento em coordenadas do ecrã da caixa de conteúdo (mm). */
  function rectEcra(el, pg) {
    const geo = A.desenhar.geometria(M.obter(), pg.lado);
    const espelhado = el.espelhar && pg.lado === 'esquerda';
    return { x: espelhado ? geo.largura - el.x - el.l : el.x, y: el.y, l: el.l, a: el.a, geo, espelhado };
  }

  function conteudoActual() {
    return document.querySelector('#palco .pagina.actual .conteudo');
  }

  function desenharSeleccao() {
    const el = E.seleccionado();
    const conteudo = conteudoActual();
    if (!el || !conteudo) return;
    const r = rectEcra(el, E.paginaActual());
    const s = document.createElement('div');
    s.className = 'seleccao';
    s.id = 'seleccao';
    posicionar(s, r);
    for (const h of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
      const ph = document.createElement('div');
      ph.className = 'puxador p-' + h;
      ph.dataset.puxador = h;
      s.appendChild(ph);
    }
    conteudo.appendChild(s);
    const caixa = conteudo.querySelector(`:scope > .el[data-id="${el.id}"]`);
    if (caixa) caixa.classList.add('seleccionado');
  }

  function posicionar(no, r) {
    Object.assign(no.style, { left: r.x + 'mm', top: r.y + 'mm', width: r.l + 'mm', height: r.a + 'mm' });
  }

  /* ---------- ímanes ---------- */
  function alvos(excluir) {
    const pg = E.paginaActual();
    const geo = A.desenhar.geometria(M.obter(), pg.lado);
    const xs = [0, geo.largura / 2, geo.largura], ys = [0, geo.altura / 2, geo.altura];
    for (const el of E.elementosEfectivos()) {
      if (el.id === excluir || (el.edicoes && !el.edicoes.includes(E.estado.edicao))) continue;
      const r = rectEcra(el, pg);
      xs.push(r.x, r.x + r.l / 2, r.x + r.l);
      ys.push(r.y, r.y + r.a / 2, r.y + r.a);
    }
    return { xs, ys };
  }

  /* Encaixa uma lista de posições candidatas (ex.: esquerda, centro, direita) no alvo mais próximo. */
  function encaixar(posicoes, lista, tolerancia) {
    let melhor = null;
    for (const [i, v] of posicoes.entries()) {
      for (const t of lista) {
        const d = t - v;
        if (Math.abs(d) <= tolerancia && (!melhor || Math.abs(d) < Math.abs(melhor.d))) melhor = { d, linha: t, i };
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

  function escala(paginaDom) {
    return paginaDom.getBoundingClientRect().width / M.obter().formato.pagina.largura;
  }

  function aoPremir(ev) {
    if (ev.button !== 0) return;
    const paginaDom = ev.target.closest('.pagina');
    if (!paginaDom) { if (E.estado.seleccao) E.seleccionar(null); return; }
    const indice = +paginaDom.dataset.indice;
    const puxador = ev.target.dataset && ev.target.dataset.puxador;
    const caixa = ev.target.closest('.conteudo > .el[data-id]');

    if (indice !== E.estado.pagina) {
      E.estado.pagina = indice;
      E.estado.seleccao = caixa ? caixa.dataset.id : null;
      E.redesenhar();
      return;
    }
    if (!puxador && !caixa) { E.seleccionar(null); return; }

    const id = puxador ? E.estado.seleccao : caixa.dataset.id;
    if (id !== E.estado.seleccao) { E.estado.seleccao = id; E.redesenhar(); }
    const el = E.seleccionado();
    if (!el) return;
    ev.preventDefault();
    const r = rectEcra(el, E.paginaActual());
    gesto = {
      tipo: puxador ? 'redimensionar' : 'mover', puxador, el, r0: r, inicio: [ev.clientX, ev.clientY],
      escala: escala(document.querySelector('#palco .pagina.actual')), alvos: alvos(el.id), mexeu: false
    };
    window.addEventListener('pointermove', aoMover);
    window.addEventListener('pointerup', aoLargar, { once: true });
  }

  function aoMover(ev) {
    if (!gesto) return;
    const dx = (ev.clientX - gesto.inicio[0]) / gesto.escala;
    const dy = (ev.clientY - gesto.inicio[1]) / gesto.escala;
    if (!gesto.mexeu && Math.hypot(dx, dy) < .6) return;
    gesto.mexeu = true;
    const r0 = gesto.r0;
    const r = { x: r0.x, y: r0.y, l: r0.l, a: r0.a };
    const linhasX = [], linhasY = [];
    const semIman = ev.altKey;

    if (gesto.tipo === 'mover') {
      r.x = r0.x + dx; r.y = r0.y + dy;
      if (!semIman) {
        const mx = encaixar([r.x, r.x + r.l / 2, r.x + r.l], gesto.alvos.xs, IMAN);
        const my = encaixar([r.y, r.y + r.a / 2, r.y + r.a], gesto.alvos.ys, IMAN);
        if (mx) { r.x += mx.d; linhasX.push(mx.linha); } else r.x = arred(r.x);
        if (my) { r.y += my.d; linhasY.push(my.linha); } else r.y = arred(r.y);
      }
    } else {
      const h = gesto.puxador;
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
        const prop = r0.l / r0.a;
        const l = Math.max(1, x2 - x1);
        const a = l / prop;
        if (h.includes('n')) y1 = y2 - a; else y2 = y1 + a;
      }
      r.x = Math.min(x1, x2 - 1); r.y = Math.min(y1, y2 - 1);
      r.l = Math.max(1, x2 - x1); r.a = Math.max(1, y2 - y1);
    }
    gesto.r = r;
    const caixa = conteudoActual().querySelector(`:scope > .el[data-id="${gesto.el.id}"]`);
    if (caixa) posicionar(caixa, r);
    posicionar(document.getElementById('seleccao'), r);
    mostrarGuias(linhasX, linhasY);
    document.dispatchEvent(new CustomEvent('agendas:arrastar', { detail: r }));
  }

  function aoLargar() {
    window.removeEventListener('pointermove', aoMover);
    const g = gesto;
    gesto = null;
    if (!g || !g.mexeu || !g.r) return;
    const r = g.r;
    const x = g.r0.espelhado ? g.r0.geo.largura - r.x - r.l : r.x;
    const arr = v => Math.round(v * 100) / 100;
    E.definir({ x: arr(x), y: arr(r.y), l: arr(r.l), a: arr(r.a) });
  }

  /* ---------- teclado ---------- */
  function aEscrever(ev) {
    const t = ev.target;
    return t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
  }

  function aoTeclar(ev) {
    const ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && ev.key.toLowerCase() === 'z' && !aEscrever(ev)) { ev.preventDefault(); ev.shiftKey ? M.refazer() : M.desfazer(); return; }
    if (ctrl && ev.key.toLowerCase() === 'y' && !aEscrever(ev)) { ev.preventDefault(); M.refazer(); return; }
    if (aEscrever(ev)) return;
    if (ev.key === 'PageDown') { ev.preventDefault(); E.irPara(E.estado.pagina + 1); return; }
    if (ev.key === 'PageUp') { ev.preventDefault(); E.irPara(E.estado.pagina - 1); return; }
    if (ctrl && ev.key.toLowerCase() === 'v') { ev.preventDefault(); E.colar(); return; }
    const el = E.seleccionado();
    if (!el) return;
    const passo = ev.shiftKey ? 5 : .5;
    const mover = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[ev.key];
    if (mover) {
      ev.preventDefault();
      const espelhado = el.espelhar && E.paginaActual().lado === 'esquerda';
      E.definir({ x: +(el.x + (espelhado ? -mover[0] : mover[0])).toFixed(2), y: +(el.y + mover[1]).toFixed(2) }, 'setas');
    } else if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); E.apagar(); }
    else if (ctrl && ev.key.toLowerCase() === 'd') { ev.preventDefault(); E.duplicar(); }
    else if (ctrl && ev.key.toLowerCase() === 'c') { E.copiar(); }
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
