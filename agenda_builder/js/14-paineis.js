/* 14 · Painéis — topo (projecto, edições, desfazer, exportar), esquerda
   (sequência de páginas e biblioteca) e direita (propriedades). */
(function () {
  'use strict';
  const A = window.Agenda;
  const M = A.modelo, E = A.editor, K = A.controlos, B = A.biblioteca;
  const $ = s => document.querySelector(s);
  const no = K.no;
  const C = A.calendario;

  const P = A.paineis = { lateral: 'paginas', painel: 'propriedades', alvoEstilo: 'estilo' };

  const CAMPOS = [
    ['Dia', '{dia.numero}'], ['Dia da semana', '{dia.nome}'], ['Mês', '{mes.nome}'], ['Ano', '{mes.ano}'],
    ['Feriado', '{dia.rotuloFeriado}'], ['Ano da agenda', '{periodo.rotulo}'], ['Ano anterior', '{periodo.anterior}'],
    ['Semana', '{semana.titulo}'], ['Ano da semana', '{semana.ano}'], ['Nº da semana', '{semana.numero}'],
    ['Evento', '{dia.evento}'], ['Frase do mês', '{conteudo.fraseMes}'], ['Texto da semana', '{conteudo.textoSemana}']
  ];
  const REPETIR = [['', 'Uma vez'], ['dia', 'Cada dia'], ['semana', 'Cada semana'], ['mes', 'Cada mês']];

  /* ---------- rótulos ---------- */
  function rotuloPagina(pg) {
    if (!pg) return '';
    if (pg.ctx.dia && pg.molde && M.obter().sequencia[pg.bloco].repetir === 'dia') {
      const d = pg.ctx.dia;
      return `${d.abrev.replace('.', '')} ${d.numero} ${C.MESES_ABREV[d.mes - 1]} ${d.ano}`;
    }
    if (pg.ctx.semana) {
      const d = pg.ctx.dia;
      return `Semana de ${d.numero} ${C.MESES_ABREV[d.mes - 1]} ${d.ano}`;
    }
    if (pg.ctx.mes && M.obter().sequencia[pg.bloco].repetir === 'mes') return `${pg.ctx.mes.nome} ${pg.ctx.mes.ano}`;
    return pg.molde ? M.obter().moldes[pg.molde].nome : 'Página em branco';
  }

  function contarPaginasDoMolde(nome) {
    return E.paginas().filter(pg => pg.molde === nome).length;
  }

  /* ---------- topo ---------- */
  function desenharTopo() {
    const p = M.obter();
    const nome = $('#nome-projecto');
    if (document.activeElement !== nome) nome.value = p.nome;

    const tabs = $('#edicoes-tabs');
    tabs.replaceChildren(...Object.entries(p.edicoes).map(([id, ed]) =>
      K.botao(ed.nome, () => { E.estado.edicao = id; E.irPara(0); }, 'tab' + (id === E.estado.edicao ? ' activo' : ''))));
    tabs.appendChild(K.botao('+', novaEdicao, 'tab mais'));
    tabs.lastChild.title = 'Nova edição';

    $('#desfazer').disabled = !M.podeDesfazer();
    $('#refazer').disabled = !M.podeRefazer();
    $('#exportar').classList.toggle('activo', P.painel === 'exportar');
    $('#conteudos').classList.toggle('activo', P.painel === 'conteudos');
  }

  function novaEdicao() {
    const p = M.obter();
    const base = p.edicoes[E.estado.edicao];
    let n = 2, id;
    do { id = 'edicao-' + n++; } while (p.edicoes[id]);
    M.alterar(pp => {
      pp.edicoes[id] = JSON.parse(JSON.stringify(Object.assign({}, base, { nome: base.nome + ' (cópia)', excepcoes: {} })));
    });
    E.estado.edicao = id;
    E.irPara(0);
  }

  /* ---------- esquerda: sequência ---------- */
  /* A primeira página do bloco com desenho (salta a de enchimento). */
  function primeiraPaginaDoBloco(indice) {
    const ps = E.paginas();
    const i = ps.findIndex(pg => pg.bloco === indice && pg.molde);
    return i >= 0 ? i : ps.findIndex(pg => pg.bloco === indice);
  }

  function miniatura(pg) {
    const caixa = no('div', 'miniatura');
    if (!pg) return caixa;
    const dom = A.desenhar.pagina(pg, M.obter(), E.env(false));
    caixa.appendChild(dom);
    return caixa;
  }

  function desenharSequencia() {
    const p = M.obter();
    const lista = no('div', 'sequencia');
    const actual = E.paginaActual();
    p.sequencia.forEach((b, i) => {
      const primeira = primeiraPaginaDoBloco(i);
      const visivel = primeira >= 0;
      const n = E.paginas().filter(pg => pg.bloco === i).length;
      const item = no('button', 'bloco' + (actual && actual.bloco === i ? ' activo' : '') + (visivel ? '' : ' fora'));
      item.type = 'button';
      item.appendChild(miniatura(visivel ? E.paginas()[primeira] : null));
      const info = no('div', 'bloco-info');
      const nomes = (b.moldes || [b.molde]).map(m => (p.moldes[m] || {}).nome || m).join(' + ');
      info.append(no('strong', null, nomes),
        no('span', null, (REPETIR.find(r => r[0] === (b.repetir || '')) || REPETIR[0])[1] + (b.repetir ? '' : (b.vezes > 1 ? ' × ' + b.vezes : ''))),
        no('span', 'contagem', visivel ? n + (n === 1 ? ' página' : ' páginas') : 'Não entra nesta edição'));
      item.appendChild(info);
      item.addEventListener('click', () => { if (visivel) { E.estado.seleccao = null; E.irPara(primeira); } });
      lista.appendChild(item);
    });
    const total = E.paginas().length;
    const rodape = no('div', 'total', `${total} páginas · ${Math.ceil(total / 4)} folhas A4`);
    const mais = K.botao(P.mostrarProntas ? 'Fechar' : '+ Página nova', () => { P.mostrarProntas = !P.mostrarProntas; desenharLateral(); }, 'largo' + (P.mostrarProntas ? '' : ' principal'));
    const prontas = no('div', 'prontas');
    if (P.mostrarProntas) for (const pr of A.prontas.lista) prontas.appendChild(K.botao(pr.nome, () => novoBloco(pr.id), 'pronta'));
    $('#lateral-conteudo').replaceChildren(lista, mais, prontas, rodape);
  }

  function novoBloco(tipo) {
    const actual = E.paginaActual();
    const depois = actual ? actual.bloco + 1 : M.obter().sequencia.length;
    M.alterar(pp => { A.prontas.juntar(pp, tipo, depois); });
    P.mostrarProntas = false;
    E.estado.seleccao = null;
    E.estado.modo = 'molde';
    const i = primeiraPaginaDoBloco(depois);
    E.irPara(i >= 0 ? i : E.estado.pagina);
  }

  /* ---------- esquerda: biblioteca ---------- */
  function desenharBiblioteca() {
    const p = M.obter();
    const fontes = no('div', 'lista-fontes');
    const importadas = Object.values(p.biblioteca.fontes);
    for (const fam of B.familias(p)) {
      const linha = no('div', 'fonte-amostra', fam);
      linha.style.fontFamily = `'${fam}'`;
      if (importadas.some(f => f.familia === fam)) linha.classList.add('importada');
      fontes.appendChild(linha);
    }
    const imagens = no('div', 'grelha-imagens');
    for (const img of Object.values(p.biblioteca.imagens)) {
      const b = no('button', 'imagem-lib');
      b.type = 'button';
      b.title = img.nome;
      const i = no('img');
      i.src = img.ficheiro;
      i.alt = img.nome;
      b.appendChild(i);
      b.addEventListener('click', () => inserirImagem(img));
      imagens.appendChild(b);
    }
    $('#lateral-conteudo').replaceChildren(
      K.seccao('Fontes', fontes, K.botao('Importar fontes', async () => importar(await B.escolher(B.ACEITAR_FONTES)), 'largo')),
      K.seccao('Imagens', imagens, K.botao('Importar imagens', async () => importar(await B.escolher(B.ACEITAR_IMAGENS)), 'largo'))
    );
  }

  function inserirImagem(img) {
    const l = 40;
    const a = img.largura && img.altura ? +(l * img.altura / img.largura).toFixed(1) : 40;
    E.inserir('imagem', { src: img.ficheiro, l, a });
  }

  async function importar(ficheiros) {
    if (!ficheiros.length) return;
    document.body.classList.add('a-importar');
    try {
      const imagens = await B.importar(ficheiros);
      if (imagens.length === 1 && E.paginaActual() && E.paginaActual().molde) inserirImagem(imagens[0]);
    } catch (e) {
      alert(e.message);
    } finally {
      document.body.classList.remove('a-importar');
    }
  }
  P.importar = importar;

  function desenharLateral() {
    document.querySelectorAll('#lateral-tabs .tab').forEach(t => t.classList.toggle('activo', t.dataset.tab === P.lateral));
    if (P.lateral === 'paginas') desenharSequencia(); else desenharBiblioteca();
  }

  /* ---------- barra por cima do palco ---------- */
  function desenharBarraPalco() {
    const pg = E.paginaActual();
    const modo = $('#modo');
    modo.replaceChildren();
    if (pg && pg.molde) {
      const molde = M.obter().moldes[pg.molde];
      const n = contarPaginasDoMolde(pg.molde);
      modo.append(
        K.botao(`Molde «${molde.nome}» · ${n} ${n === 1 ? 'página' : 'páginas'}`, () => E.mudarModo('molde'), E.estado.modo === 'molde' ? 'activo' : ''),
        K.botao(`Só esta página · ${rotuloPagina(pg)}`, () => E.mudarModo('pagina'), E.estado.modo === 'pagina' ? 'activo pagina' : '')
      );
    }
    $('#pagina-rotulo').textContent = pg ? `${rotuloPagina(pg)} · ${pg.numero} de ${E.paginas().length}` : '';
    $('#guias').checked = E.estado.guias;

    const inserir = $('#inserir');
    if (!inserir.childElementCount) {
      const tipos = Object.entries(A.componentes.DESCRICOES).sort((a, b) => a[1].ordem - b[1].ordem);
      for (const [tipo, d] of tipos) {
        inserir.appendChild(K.botao(d.nome, async () => {
          if (tipo === 'imagem') {
            const imgs = Object.values(M.obter().biblioteca.imagens);
            if (!imgs.length) return importar(await B.escolher(B.ACEITAR_IMAGENS));
            P.lateral = 'biblioteca';
            return desenharLateral();
          }
          E.inserir(tipo);
        }, 'inserir-' + tipo));
      }
    }
  }

  /* ---------- direita ---------- */
  function envPainel() {
    const env = E.env(false);
    env.ctx = (E.paginaActual() || {}).ctx || {};
    return env;
  }

  function usosDoEstilo(nome) {
    let n = 0;
    for (const m of Object.values(M.obter().moldes)) {
      for (const el of m.elementos) {
        const d = A.componentes.descrever(el.tipo);
        for (const prop of d.propriedades) if (prop.tipo === 'estilo' && el[prop.chave] === nome) n++;
      }
    }
    return n;
  }

  function editorDeEstilo(el, chave) {
    const p = M.obter();
    const nome = el[chave];
    const estilo = p.estilos.texto[nome] || {};
    const efectivo = Object.assign({}, estilo, el.sobre || {});
    const env = envPainel();
    const caixa = no('div', 'editor-estilo');

    const usos = usosDoEstilo(nome);
    caixa.appendChild(K.opcoes(P.alvoEstilo, [
      ['estilo', `Estilo «${nome}» · ${usos} ${usos === 1 ? 'uso' : 'usos'}`], ['elemento', 'Só este elemento']
    ], v => { P.alvoEstilo = v; desenharPainel(); }));

    const mudar = (k, v, juntar) => {
      if (P.alvoEstilo === 'estilo') M.alterar(pp => { pp.estilos.texto[nome][k] = v; if (v === undefined) delete pp.estilos.texto[nome][k]; }, juntar ? 'estilo:' + nome + ':' + k : null);
      else E.definir({ sobre: { [k]: v } }, juntar ? 'sobre:' + k : null);
    };

    const familias = B.familias(p);
    caixa.appendChild(K.linha('Letra', K.seleccionar(efectivo.fonte, familias.map(f => [f, f]), v => mudar('fonte', v),
      f => ({ fontFamily: `'${f}'`, fontSize: '16px' }))));
    caixa.appendChild(K.numero(efectivo.tamanho, { etiqueta: 'Tamanho', min: 3, max: 200, passo: .5, unidade: 'pt' }, (v, j) => mudar('tamanho', v, j)));
    caixa.appendChild(K.linha('Peso', K.seleccionar(String(efectivo.peso || 400),
      [['300', 'Fino'], ['400', 'Normal'], ['500', 'Médio'], ['600', 'Semi-negrito'], ['700', 'Negrito']], v => mudar('peso', +v))));
    const toggles = no('div', 'segmentos');
    toggles.append(
      K.botao('Itálico', () => mudar('italico', !efectivo.italico || undefined), efectivo.italico ? 'activo' : ''),
      K.botao('MAIÚSCULAS', () => mudar('maiusculas', !efectivo.maiusculas || undefined), efectivo.maiusculas ? 'activo' : '')
    );
    caixa.appendChild(K.linha('Forma', toggles));
    caixa.appendChild(K.numero(efectivo.espacamento || 0, { etiqueta: 'Espaçamento', min: -.1, max: 1, passo: .01, unidade: 'em' }, (v, j) => mudar('espacamento', v, j)));
    caixa.appendChild(K.numero(efectivo.alturaLinha || 1.15, { etiqueta: 'Entrelinha', min: .6, max: 3, passo: .05 }, (v, j) => mudar('alturaLinha', v, j)));
    caixa.appendChild(K.linha('Cor', K.cor(efectivo.cor || 'tinta', env, (v, j) => mudar('cor', v, j))));
    if (P.alvoEstilo === 'estilo') {
      caixa.appendChild(K.linha('Nome do estilo', K.texto(nome, v => renomearEstilo(nome, v))));
    } else if (el.sobre && Object.keys(el.sobre).length) {
      caixa.appendChild(K.botao('Voltar ao estilo', () => E.definir({ sobre: undefined }), 'largo'));
    }
    return caixa;
  }

  let renomearTemporizador = null;
  function renomearEstilo(antigo, novo) {
    clearTimeout(renomearTemporizador);
    renomearTemporizador = setTimeout(() => {
      novo = novo.trim();
      const p = M.obter();
      if (!novo || novo === antigo || p.estilos.texto[novo]) return;
      M.alterar(pp => {
        pp.estilos.texto[novo] = pp.estilos.texto[antigo];
        delete pp.estilos.texto[antigo];
        const trocar = el => {
          for (const prop of A.componentes.descrever(el.tipo).propriedades) if (prop.tipo === 'estilo' && el[prop.chave] === antigo) el[prop.chave] = novo;
        };
        for (const m of Object.values(pp.moldes)) m.elementos.forEach(trocar);
        for (const ed of Object.values(pp.edicoes)) for (const exc of Object.values(ed.excepcoes)) (exc.acrescentar || []).forEach(trocar);
      });
    }, 700);
  }

  function novoEstilo(el, chave) {
    const p = M.obter();
    let n = 2, nome;
    do { nome = (el[chave] || 'estilo') + ' ' + n++; } while (p.estilos.texto[nome]);
    M.alterar(pp => { pp.estilos.texto[nome] = Object.assign({}, pp.estilos.texto[el[chave]], el.sobre || {}); });
    E.definir({ [chave]: nome, sobre: undefined });
  }

  function controloPropriedade(el, prop) {
    const env = envPainel();
    const v = el[prop.chave];
    const mudar = (valor, juntar) => E.definir({ [prop.chave]: prop.guardar ? prop.guardar(valor) : valor }, juntar ? 'prop:' + prop.chave : null);
    switch (prop.tipo) {
      case 'numero':
        return K.numero(prop.mostrar ? prop.mostrar(v) : v, prop, mudar);
      case 'texto':
        return K.linha(prop.etiqueta, K.texto(v, mudar));
      case 'textoLongo':
        return K.linha(prop.etiqueta, K.textoComCampos(v, CAMPOS, mudar));
      case 'opcoes':
        return K.linha(prop.etiqueta, K.opcoes(v, prop.opcoes, mudar));
      case 'booleano':
        return K.booleano(v == null ? prop.omissao : v, prop.etiqueta, mudar);
      case 'cor':
        return K.linha(prop.etiqueta, K.cor(v, env, mudar, prop.nenhum));
      case 'estilo': {
        const nomes = Object.keys(M.obter().estilos.texto);
        const fila = no('div', 'fila');
        fila.append(K.seleccionar(v, nomes.map(n => [n, n]), mudar), K.botao('Novo', () => novoEstilo(el, prop.chave)));
        const bloco = no('div');
        bloco.appendChild(K.linha(prop.etiqueta, fila));
        if (prop.principal && v) bloco.appendChild(editorDeEstilo(el, prop.chave));
        return bloco;
      }
      case 'imagem': {
        const g = no('div', 'grelha-imagens pequena');
        if (prop.nenhum) g.appendChild(K.botao('Sem imagem', () => mudar(undefined), !v ? 'activo' : ''));
        for (const img of Object.values(M.obter().biblioteca.imagens)) {
          const b = no('button', 'imagem-lib' + (v === img.ficheiro ? ' activo' : ''));
          b.type = 'button';
          const i = no('img');
          i.src = img.ficheiro;
          i.alt = img.nome;
          b.appendChild(i);
          b.addEventListener('click', () => mudar(img.ficheiro));
          g.appendChild(b);
        }
        g.appendChild(K.botao('Importar', async () => importar(await B.escolher(B.ACEITAR_IMAGENS))));
        return K.linha(prop.etiqueta, g);
      }
      case 'colunas': {
        const cols = (v || []).map(c => Object.assign({}, c));
        const caixa = no('div', 'colunas');
        const guardar = juntar => mudar(cols.map(c => Object.assign({}, c)), juntar);
        cols.forEach((c, i) => {
          const fila = no('div', 'fila');
          const t = K.texto(c.titulo, val => { c.titulo = val; guardar(true); });
          const w = no('input');
          w.type = 'number'; w.min = 1; w.value = c.largura; w.title = 'Largura relativa';
          w.addEventListener('input', () => { c.largura = Math.max(1, +w.value || 1); guardar(true); });
          fila.append(t, w, K.botao('×', () => { cols.splice(i, 1); guardar(); }, 'pequeno'));
          caixa.appendChild(fila);
        });
        caixa.appendChild(K.botao('+ Coluna', () => { cols.push({ titulo: 'Coluna', largura: 20 }); guardar(); }, 'largo'));
        return K.linha(prop.etiqueta, caixa);
      }
    }
    return null;
  }

  function painelElemento(el) {
    const d = A.componentes.descrever(el.tipo === 'forma' && el.forma === 'linha' ? 'linha' : el.tipo);
    const descr = A.componentes.descrever(el.tipo);
    const pg = E.paginaActual();
    const p = M.obter();
    const geo = A.desenhar.geometria(p, pg.lado);
    const frag = document.createDocumentFragment();

    const cabeca = no('div', 'cabeca-elemento');
    cabeca.append(no('h2', null, d.nome));
    const accoes = no('div', 'fila');
    accoes.append(
      K.botao('Duplicar', E.duplicar), K.botao('Para a frente', () => E.ordem(1)), K.botao('Para trás', () => E.ordem(-1)),
      K.botao('Apagar', E.apagar, 'perigo'));
    cabeca.appendChild(accoes);
    if (el._alterado) cabeca.appendChild(K.botao('Repor como no molde', () => E.repor(), 'largo destaque'));
    frag.appendChild(cabeca);

    const def = (k, juntar) => (v, j) => E.definir({ [k]: v }, j ? juntar || k : null);
    const alinhar = no('div', 'segmentos alinhar');
    const pos = (x, y) => () => E.definir(Object.assign({}, x != null ? { x: +x.toFixed(2) } : {}, y != null ? { y: +y.toFixed(2) } : {}));
    alinhar.append(
      K.botao('Esquerda', pos(0, null)), K.botao('Centro', pos((geo.largura - el.l) / 2, null)), K.botao('Direita', pos(geo.largura - el.l, null)),
      K.botao('Topo', pos(null, 0)), K.botao('Meio', pos(null, (geo.altura - el.a) / 2)), K.botao('Base', pos(null, geo.altura - el.a)));
    frag.appendChild(K.seccao('Posição',
      K.numero(el.x, { etiqueta: 'X', passo: .5, unidade: 'mm' }, def('x', 'pos')),
      K.numero(el.y, { etiqueta: 'Y', passo: .5, unidade: 'mm' }, def('y', 'pos')),
      K.numero(el.l, { etiqueta: 'Largura', min: 1, passo: .5, unidade: 'mm' }, def('l', 'tam')),
      K.numero(el.a, { etiqueta: 'Altura', min: 1, passo: .5, unidade: 'mm' }, def('a', 'tam')),
      K.linha('Alinhar à página', alinhar),
      K.numero(el.rodar || 0, { etiqueta: 'Rodar', min: -180, max: 180, passo: 1, unidade: '°' }, (v, j) => E.definir({ rodar: v || undefined }, j ? 'rodar' : null)),
      K.numero(el.opacidade == null ? 100 : el.opacidade * 100, { etiqueta: 'Opacidade', min: 0, max: 100, passo: 5, unidade: '%' },
        (v, j) => E.definir({ opacidade: v >= 100 ? undefined : v / 100 }, j ? 'opacidade' : null)),
      K.booleano(el.espelhar, 'Espelhar nas páginas da esquerda', v => E.definir({ espelhar: v || undefined }))
    ));

    if (descr.propriedades.length) {
      frag.appendChild(K.seccao(d.nome, ...descr.propriedades.map(prop => controloPropriedade(el, prop))));
    }

    const ligacoes = opcoesLigacao(pg);
    if (ligacoes.length > 1) {
      const actual = el.liga ? (el.liga.dia != null ? 'dia:' + el.liga.dia : 'mes:' + el.liga.mes) : '';
      frag.appendChild(K.seccao('Ligado a', K.seleccionar(actual, ligacoes, v => {
        if (!v) return E.definir({ liga: undefined });
        const [tipo, n] = v.split(':');
        E.definir({ liga: { [tipo]: +n } });
      })));
    }

    const edicoes = Object.entries(p.edicoes);
    if (edicoes.length > 1) {
      const lista = no('div', 'lista-edicoes');
      for (const [id, ed] of edicoes) {
        const activo = !el.edicoes || el.edicoes.includes(id);
        lista.appendChild(K.booleano(activo, ed.nome, v => {
          let novas = new Set(el.edicoes || edicoes.map(x => x[0]));
          if (v) novas.add(id); else novas.delete(id);
          novas = [...novas];
          E.definir({ edicoes: novas.length === edicoes.length ? undefined : novas });
        }));
      }
      frag.appendChild(K.seccao('Aparece em', lista));
    }
    return frag;
  }

  /* Vários elementos seleccionados: alinhar, distribuir, duplicar, apagar. */
  function painelVarios() {
    const n = E.ids().length;
    const frag = document.createDocumentFragment();
    const cabeca = no('div', 'cabeca-elemento');
    cabeca.appendChild(no('h2', null, `${n} elementos`));
    const accoes = no('div', 'fila');
    accoes.append(K.botao('Duplicar', E.duplicar), K.botao('Apagar', E.apagar, 'perigo'));
    cabeca.appendChild(accoes);
    frag.appendChild(cabeca);
    const alinhar = no('div', 'segmentos alinhar');
    for (const [como, rotulo] of [['esquerda', 'Esquerda'], ['centro', 'Centro'], ['direita', 'Direita'], ['topo', 'Topo'], ['meio', 'Meio'], ['base', 'Base']]) {
      alinhar.appendChild(K.botao(rotulo, () => E.alinhar(como)));
    }
    const distribuir = no('div', 'segmentos');
    distribuir.append(K.botao('Na horizontal', () => E.distribuir('h')), K.botao('Na vertical', () => E.distribuir('v')));
    frag.appendChild(K.seccao('Alinhar entre si', alinhar));
    if (n >= 3) frag.appendChild(K.seccao('Distribuir com espaço igual', distribuir));
    return frag;
  }

  /* A que pode um elemento ligar-se nesta página: dias da semana ou meses do período. */
  function opcoesLigacao(pg) {
    const r = [['', 'Esta página']];
    if (pg.ctx.semana) pg.ctx.semana.dias.forEach((d, i) => r.push(['dia:' + i, d.nome]));
    else if (!pg.ctx.dia && !(M.obter().sequencia[pg.bloco].repetir === 'mes') && pg.ctx.periodo) {
      pg.ctx.periodo.meses.forEach((m, i) => r.push(['mes:' + i, `${m.nome} ${m.ano}`]));
    }
    return r;
  }

  function nomeCamada(el) {
    const d = A.componentes.descrever(el.tipo === 'forma' && el.forma === 'linha' ? 'linha' : el.tipo);
    const texto = el.texto || el.rotulo || '';
    return d.nome + (texto ? ' · ' + texto.replace(/\{[\w.]+\}/g, m => (CAMPOS.find(c => c[1] === m) || [m])[0]).slice(0, 26) : '');
  }

  function seccaoCamadas() {
    const lista = no('div', 'camadas');
    const els = E.elementosEfectivos();
    const seleccionados = new Set(E.ids());
    for (const el of [...els].reverse()) {
      const fora = el.edicoes && !el.edicoes.includes(E.estado.edicao);
      const b = K.botao(nomeCamada(el), ev => {
        if (!ev.shiftKey) return E.seleccionar(el.id);
        const ids = E.ids();
        const novos = ids.includes(el.id) ? ids.filter(x => x !== el.id) : [...ids, el.id];
        E.seleccionar(novos[0] || null, novos);
      }, 'camada' + (seleccionados.has(el.id) ? ' activo' : '') + (fora ? ' fora' : '') + (el._alterado || el._acrescentado ? ' com-excepcao' : ''));
      lista.appendChild(b);
    }
    const pg = E.paginaActual();
    const exc = pg && M.obter().edicoes[E.estado.edicao].excepcoes[pg.chave];
    for (const id of (exc && exc.ocultar) || []) {
      const el = M.obter().moldes[pg.molde].elementos.find(x => x.id === id);
      if (!el) continue;
      const fila = no('div', 'camada oculta');
      fila.append(no('span', null, nomeCamada(el)), K.botao('Repor', () => E.repor(id), 'pequeno'));
      lista.appendChild(fila);
    }
    return K.seccao('Camadas', lista);
  }

  /* Sem nada seleccionado: o bloco desta página, o molde, o formato, as cores e a edição. */
  function painelPagina() {
    const p = M.obter();
    const pg = E.paginaActual();
    const frag = document.createDocumentFragment();
    if (!pg) return frag;
    const b = p.sequencia[pg.bloco];
    const iBloco = pg.bloco;
    const mudarBloco = fn => M.alterar(pp => fn(pp.sequencia[iBloco]));

    if (pg.molde) {
      const molde = p.moldes[pg.molde];
      frag.appendChild(K.seccao('Página',
        K.linha('Nome', K.texto(molde.nome, v => M.alterar(pp => { pp.moldes[pg.molde].nome = v; }, 'nome-molde'))),
        K.linha('Molde', K.seleccionar(pg.molde, Object.entries(p.moldes).map(([k, m]) => [k, m.nome]),
          v => mudarBloco(bb => { if (bb.moldes) bb.moldes = bb.moldes.map(m => m === pg.molde ? v : m); else bb.molde = v; }))),
        K.botao('Duplicar este molde', () => duplicarMolde(pg.molde, iBloco), 'largo')
      ));
    }

    const ed = Object.entries(p.edicoes);
    const blocoSec = K.seccao('Repetição',
      K.opcoes(b.repetir || '', REPETIR, v => mudarBloco(bb => { if (v) bb.repetir = v; else delete bb.repetir; })),
      !b.repetir ? K.numero(b.vezes || 1, { etiqueta: 'Quantas páginas', min: 1, max: 200, passo: 1 }, (v, j) => M.alterar(pp => { pp.sequencia[iBloco].vezes = v; }, j ? 'vezes' : null)) : null,
      K.linha('Começa em', K.opcoes(b.comecaEm || '', [['', 'Qualquer'], ['esquerda', 'Esquerda'], ['direita', 'Direita']],
        v => mudarBloco(bb => { if (v) bb.comecaEm = v; else delete bb.comecaEm; }))),
      ed.length > 1 ? K.linha('Aparece em', listaEdicoesBloco(b, iBloco)) : null,
      (() => {
        const f = no('div', 'fila');
        f.append(
          K.botao('Subir', () => moverBloco(iBloco, -1)), K.botao('Descer', () => moverBloco(iBloco, 1)),
          K.botao('Remover', () => removerBloco(iBloco), 'perigo'));
        return f;
      })()
    );
    frag.appendChild(blocoSec);

    const m = p.formato.margens;
    const margem = (k, rotulo) => K.numero(m[k], { etiqueta: rotulo, min: 0, max: 40, passo: .5, unidade: 'mm' },
      (v, j) => M.alterar(pp => { pp.formato.margens[k] = v; }, j ? 'margem:' + k : null));
    frag.appendChild(K.seccao('Margens', margem('topo', 'Topo'), margem('base', 'Base'), margem('interior', 'Interior (furos)'), margem('exterior', 'Exterior')));

    frag.appendChild(seccaoCores());
    frag.appendChild(seccaoEdicao());
    frag.appendChild(seccaoCamadas());
    frag.appendChild(seccaoVersoes());
    return frag;
  }

  function seccaoVersoes() {
    const caixa = no('div', 'versoes');
    if (!P.versoes) {
      caixa.appendChild(K.botao('Ver versões anteriores', async () => {
        P.versoes = (await M.api('versoes', { query: { id: M.obter().id } })).versoes;
        desenharPainel();
      }, 'largo'));
    } else if (!P.versoes.length) {
      caixa.appendChild(no('p', 'resumo', 'Ainda não há versões anteriores.'));
    } else {
      for (const v of P.versoes.slice(0, 40)) {
        const quando = `${v.slice(6, 8)}/${v.slice(4, 6)} às ${v.slice(9, 11)}:${v.slice(11, 13)}`;
        const fila = no('div', 'fila versao');
        fila.append(no('span', null, quando), K.botao('Repor', async () => {
          if (!confirm(`Voltar à versão de ${quando}? Pode desfazer a seguir.`)) return;
          const { projecto } = await M.api('abrir-versao', { query: { id: M.obter().id, versao: v } });
          M.substituir(projecto);
          P.versoes = null;
        }, 'pequeno'));
        caixa.appendChild(fila);
      }
    }
    return K.seccao('Versões', caixa);
  }

  function listaEdicoesBloco(b, iBloco) {
    const p = M.obter();
    const todas = Object.keys(p.edicoes);
    const lista = no('div', 'lista-edicoes');
    for (const id of todas) {
      lista.appendChild(K.booleano(!b.edicoes || b.edicoes.includes(id), p.edicoes[id].nome, v => M.alterar(pp => {
        const bb = pp.sequencia[iBloco];
        const s = new Set(bb.edicoes || todas);
        if (v) s.add(id); else s.delete(id);
        if (s.size === todas.length) delete bb.edicoes; else bb.edicoes = [...s];
      })));
    }
    return lista;
  }

  function duplicarMolde(chave, iBloco) {
    const p = M.obter();
    let n = 2, id;
    do { id = chave + '-' + n++; } while (p.moldes[id]);
    M.alterar(pp => {
      const copia = JSON.parse(JSON.stringify(pp.moldes[chave]));
      copia.nome = copia.nome + ' (cópia)';
      copia.elementos.forEach(el => { el.id = M.novoId(); });
      pp.moldes[id] = copia;
      const bb = pp.sequencia[iBloco];
      if (bb.moldes) bb.moldes = bb.moldes.map(m => m === chave ? id : m); else bb.molde = id;
    });
  }

  function moverBloco(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= M.obter().sequencia.length) return;
    M.alterar(pp => { pp.sequencia.splice(j, 0, pp.sequencia.splice(i, 1)[0]); });
    E.irPara(primeiraPaginaDoBloco(j));
  }

  function removerBloco(i) {
    if (M.obter().sequencia.length <= 1) return;
    M.alterar(pp => { pp.sequencia.splice(i, 1); });
    E.estado.seleccao = null;
    E.irPara(Math.max(0, primeiraPaginaDoBloco(Math.max(0, i - 1))));
  }

  function seccaoCores() {
    const p = M.obter();
    const t = p.tema;
    const porMes = !t.todosOsMeses;
    const caixa = no('div');
    const presets = no('div', 'presets');
    for (const pre of A.temas.filter(x => x.tema)) {
      const b = K.botao(pre.nome, () => M.alterar(pp => { pp.tema = Object.assign(JSON.parse(JSON.stringify(pre.tema)), { decoracoes: pp.tema.decoracoes }); }), 'preset');
      const s = no('span', 'ponto');
      s.style.background = pre.amostra;
      b.prepend(s);
      presets.appendChild(b);
    }
    caixa.appendChild(presets);
    caixa.appendChild(K.opcoes(porMes ? 'mes' : 'uma', [['mes', 'Um tom por mês'], ['uma', 'Uma cor']], v => M.alterar(pp => {
      if (v === 'uma' && !pp.tema.todosOsMeses) pp.tema.todosOsMeses = { forte: (pp.tema.meses ? pp.tema.meses[0].forte : pp.tema.neutro.forte) };
      if (v === 'mes') {
        const base = pp.tema.todosOsMeses ? pp.tema.todosOsMeses.forte : '#8f6f78';
        delete pp.tema.todosOsMeses;
        if (!pp.tema.meses) pp.tema.meses = Array.from({ length: 12 }, () => ({ forte: base }));
      }
    })));
    const cores = no('div', 'cores-meses');
    const cor = (valor, rotulo, aoMudar) => {
      const l = no('label', 'cor-mes');
      const i = no('input');
      i.type = 'color';
      i.value = valor;
      i.addEventListener('input', () => aoMudar(i.value));
      l.append(i, no('span', null, rotulo));
      return l;
    };
    if (porMes) {
      t.meses.forEach((mes, k) => cores.appendChild(cor(mes.forte, C.MESES_ABREV[k], v => M.alterar(pp => {
        pp.tema.meses[k] = { forte: v };
      }, 'tema-mes-' + k))));
    } else {
      cores.appendChild(cor(t.todosOsMeses.forte, 'Cor', v => M.alterar(pp => {
        pp.tema.todosOsMeses = { forte: v };
        pp.tema.neutro = { forte: v };
      }, 'tema-uma')));
    }
    caixa.appendChild(cores);
    const nomes = { tinta: 'Texto', tintaSuave: 'Texto suave', linha: 'Linhas' };
    const base = no('div', 'cores-meses');
    for (const [k, rotulo] of Object.entries(nomes)) {
      base.appendChild(cor(p.estilos.cores[k], rotulo, v => M.alterar(pp => { pp.estilos.cores[k] = v; }, 'cor-' + k)));
    }
    caixa.appendChild(base);
    return K.seccao('Cores', caixa);
  }

  function seccaoEdicao() {
    const p = M.obter();
    const id = E.estado.edicao;
    const ed = p.edicoes[id];
    const mudar = (fn, juntar) => M.alterar(pp => fn(pp.edicoes[id]), juntar);
    const data = (valor, aoMudar) => {
      const i = no('input');
      i.type = 'date';
      i.value = valor;
      i.addEventListener('change', () => { if (i.value) aoMudar(i.value); });
      return i;
    };
    const feriados = new Set(ed.feriados || []);
    return K.seccao(`Edição «${ed.nome}»`,
      K.linha('Nome', K.texto(ed.nome, v => mudar(e => { e.nome = v; }, 'nome-ed'))),
      K.linha('Começa', data(ed.periodo.inicio, v => mudar(e => { e.periodo.inicio = v; }))),
      K.linha('Acaba', data(ed.periodo.fim, v => mudar(e => { e.periodo.fim = v; }))),
      K.booleano(feriados.has('pt'), 'Feriados de Portugal', v => mudar(e => {
        const s = new Set(e.feriados || []); if (v) s.add('pt'); else s.delete('pt'); e.feriados = [...s];
      })),
      K.booleano(feriados.has('pt-carnaval'), 'Carnaval', v => mudar(e => {
        const s = new Set(e.feriados || []); if (v) s.add('pt-carnaval'); else s.delete('pt-carnaval'); e.feriados = [...s];
      })),
      Object.keys(p.edicoes).length > 1 ? K.botao('Apagar esta edição', () => {
        if (!confirm(`Apagar a edição «${ed.nome}»?`)) return;
        M.alterar(pp => { delete pp.edicoes[id]; for (const b of pp.sequencia) if (b.edicoes) b.edicoes = b.edicoes.filter(x => x !== id); });
        E.estado.edicao = Object.keys(M.obter().edicoes)[0];
        E.irPara(0);
      }, 'perigo largo') : null
    );
  }

  function desenharPainel() {
    const painel = $('#painel');
    const topo = painel.scrollTop;
    let conteudo;
    if (P.painel === 'exportar') conteudo = A.exportar.painel();
    else if (P.painel === 'conteudos') conteudo = A.conteudos.painel();
    else {
      const el = E.seleccionado();
      conteudo = document.createDocumentFragment();
      if (E.ids().length > 1) {
        conteudo.appendChild(painelVarios());
        conteudo.appendChild(seccaoCamadas());
      } else if (el) {
        conteudo.appendChild(painelElemento(el));
        conteudo.appendChild(seccaoCamadas());
      } else conteudo.appendChild(painelPagina());
    }
    painel.replaceChildren(conteudo);
    painel.scrollTop = topo;
  }
  P.desenharPainel = desenharPainel;

  /* ---------- tudo ---------- */
  let pedido = null;
  function desenharTudo() {
    pedido = null;
    if (!M.obter()) return;
    if (E.estado.pagina >= E.paginas().length) E.estado.pagina = Math.max(0, E.paginas().length - 1);
    desenharTopo();
    desenharBarraPalco();
    E.desenharPalco();
    desenharLateral();
    // Não refazer o painel enquanto se escreve nele: perdia-se o cursor.
    const foco = document.activeElement;
    const aEscrever = foco && $('#painel').contains(foco) &&
      (foco.tagName === 'TEXTAREA' || (foco.tagName === 'INPUT' && foco.type !== 'checkbox'));
    if (!aEscrever) desenharPainel();
  }
  /* Um redesenho por fotograma. O temporizador cobre separadores em segundo
     plano, onde o requestAnimationFrame não corre. */
  P.agendar = function () {
    if (pedido) return;
    pedido = true;
    const correr = () => { if (pedido) desenharTudo(); };
    requestAnimationFrame(correr);
    setTimeout(correr, 100);
  };

  P.iniciar = function () {
    document.addEventListener('agendas:redesenhar', P.agendar);
    document.addEventListener('agendas:fontes', P.agendar);
    // As fontes do Google chegam depois do primeiro desenho; quando chegam, redesenha.
    document.fonts.ready.then(P.agendar);
    document.fonts.addEventListener('loadingdone', P.agendar);
    M.ouvir(P.agendar);
    document.addEventListener('agendas:gravacao', ev => {
      const t = { gravado: 'Gravado', 'a gravar': 'A gravar…', 'por gravar': 'Por gravar', erro: 'Erro ao gravar' }[ev.detail];
      const g = $('#gravacao');
      g.textContent = t;
      g.dataset.estado = ev.detail;
    });
    // Ao sair de um campo, o painel é refeito com os valores novos.
    $('#painel').addEventListener('focusout', () => setTimeout(() => {
      if (!$('#painel').contains(document.activeElement)) desenharPainel();
    }, 0));

    $('#nome-projecto').addEventListener('input', ev => M.alterar(p => { p.nome = ev.target.value; }, 'nome-projecto'));
    $('#desfazer').addEventListener('click', M.desfazer);
    $('#refazer').addEventListener('click', M.refazer);
    $('#exportar').addEventListener('click', () => { P.painel = P.painel === 'exportar' ? 'propriedades' : 'exportar'; P.agendar(); });
    $('#conteudos').addEventListener('click', () => { P.painel = P.painel === 'conteudos' ? 'propriedades' : 'conteudos'; P.agendar(); });
    $('#anterior').addEventListener('click', () => E.irPara(E.estado.pagina - 1));
    $('#seguinte').addEventListener('click', () => E.irPara(E.estado.pagina + 1));
    $('#zoom-ajustar').addEventListener('click', E.zoomAjustar);
    $('#guias').addEventListener('change', ev => { E.estado.guias = ev.target.checked; P.agendar(); });
    document.querySelectorAll('#lateral-tabs .tab').forEach(t => t.addEventListener('click', () => { P.lateral = t.dataset.tab; desenharLateral(); }));

    // Arrastar ficheiros para qualquer parte da janela.
    window.addEventListener('dragover', ev => { ev.preventDefault(); document.body.classList.add('a-largar'); });
    window.addEventListener('dragleave', ev => { if (!ev.relatedTarget) document.body.classList.remove('a-largar'); });
    window.addEventListener('drop', ev => {
      ev.preventDefault();
      document.body.classList.remove('a-largar');
      importar([...ev.dataTransfer.files]);
    });
  };
})();
