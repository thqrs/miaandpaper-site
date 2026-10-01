/* 04 · Componentes — cada tipo de elemento sabe desenhar-se dentro da sua caixa.
   desenhar(el, ctx, env, caixa) devolve o conteúdo (Node ou string HTML); a
   caixa (posição e tamanho em mm) é criada por 05-desenhar.js. */
(function (raiz) {
  'use strict';
  const A = raiz.Agenda = raiz.Agenda || {};
  const REGISTO = {};
  const f = n => (Math.round(n * 1000) / 1000).toString();

  function registar(tipo, def) { REGISTO[tipo] = def; }

  /* Aplica um estilo de texto (nome em env.estilos.texto, mais sobreposições do elemento). */
  function aplicarTexto(no, nomeEstilo, sobre, env, ctx) {
    const e = Object.assign({}, env.estilos.texto[nomeEstilo] || {}, sobre || {});
    const s = no.style;
    if (e.fonte) s.fontFamily = `'${e.fonte}', serif`;
    if (e.peso) s.fontWeight = e.peso;
    if (e.tamanho) s.fontSize = e.tamanho + 'pt';
    s.fontStyle = e.italico ? 'italic' : 'normal';
    s.textTransform = e.maiusculas ? 'uppercase' : 'none';
    s.letterSpacing = (e.espacamento || 0) + 'em';
    s.lineHeight = e.alturaLinha || 1.15;
    s.color = A.campos.cor(e.cor || 'tinta', env, ctx);
    return e;
  }

  function div(classe) { const d = document.createElement('div'); if (classe) d.className = classe; return d; }

  function svgLinhas(caixa, linhas) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(caixa.l)} ${f(caixa.a)}" ` +
      `width="${f(caixa.l)}mm" height="${f(caixa.a)}mm" style="position:absolute;left:0;top:0;overflow:visible">${linhas}</svg>`;
  }

  function linha(x1, y1, x2, y2, cor, esp, tracejado) {
    return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${cor}" ` +
      `stroke-width="${f(esp)}"${tracejado ? ` stroke-dasharray="${tracejado}" stroke-linecap="round"` : ''}/>`;
  }

  /* ---------- texto ---------- */
  registar('texto', {
    desenhar(el, ctx, env) {
      const d = div('el-texto');
      aplicarTexto(d, el.estilo, el.sobre, env, ctx);
      d.style.textAlign = el.alinhar || 'left';
      d.style.justifyContent = { topo: 'flex-start', meio: 'center', base: 'flex-end' }[el.vertical || 'topo'];
      d.textContent = A.campos.texto(el.texto, ctx);
      return d;
    }
  });

  /* ---------- forma ---------- */
  registar('forma', {
    desenhar(el, ctx, env, caixa) {
      const cor = A.campos.cor(el.cor, env, ctx);
      if (el.forma === 'linha') {
        return svgLinhas(caixa, linha(0, caixa.a / 2, caixa.l, caixa.a / 2, cor, el.espessura || .25, el.tracejado));
      }
      const d = div('el-forma');
      d.style.background = el.preencher ? A.campos.cor(el.preencher, env, ctx) : 'transparent';
      if (el.contorno) d.style.border = `${el.espessura || .25}mm solid ${cor}`;
      d.style.borderRadius = el.forma === 'circulo' ? '50%' : (el.raio || 0) + 'mm';
      return d;
    }
  });

  /* ---------- imagem (PNG, JPG, SVG, WebP, no original) ---------- */
  function imagem(src, ajuste, posicao) {
    const i = document.createElement('img');
    i.className = 'el-imagem';
    i.alt = '';
    i.src = src;
    i.style.objectFit = ajuste || 'contain';
    i.style.objectPosition = posicao || 'center';
    return i;
  }

  registar('imagem', {
    desenhar(el) { return imagem(el.src, el.ajuste, el.posicao); }
  });

  /* ---------- decoração ----------
     Se o tema tiver uma imagem para esta decoração (ex.: flores pintadas),
     usa-a; senão desenha a versão em traço. */
  registar('decoracao', {
    desenhar(el, ctx, env, caixa) {
      const pintada = el.imagem || (env.tema.decoracoes && env.tema.decoracoes[el.desenho]);
      if (pintada) return imagem(pintada, 'contain', el.posicao || 'right bottom');
      return A.decoracoes.desenhar(el.desenho, caixa.l, caixa.a, {
        cor: A.campos.cor(el.cor || '@mes.forte', env, ctx),
        corFolha: A.campos.cor(el.corFolha || '@mes.claro', env, ctx),
        corPetala: el.corPetala ? A.campos.cor(el.corPetala, env, ctx) : null,
        espessura: el.espessura, semente: el.semente
      });
    }
  });

  /* ---------- mini-mês ---------- */
  registar('mini-mes', {
    desenhar(el, ctx, env, caixa) {
      const C = A.calendario;
      const mes = ctx.mes;
      const d = div('el-minimes');
      if (!mes) return d;
      const temTitulo = !!el.titulo;
      const linhas = 7 + (temTitulo ? 1 : 0);
      const alt = caixa.a / linhas, larg = caixa.l / 7;
      const corDestaque = A.campos.cor(el.corDestaque || '@mes.forte', env, ctx);
      const corFeriado = A.campos.cor(el.corFeriado || '@mes.forte', env, ctx);
      const diam = Math.min(alt, larg) * .88;
      let y = 0;

      function celula(x, y, texto, estilo, extra) {
        const c = div('mm-cel');
        Object.assign(c.style, { left: x + 'mm', top: y + 'mm', width: larg + 'mm', height: alt + 'mm' });
        const t = document.createElement('span');
        aplicarTexto(t, estilo, null, env, ctx);
        t.textContent = texto;
        if (extra) extra(c, t);
        c.appendChild(t);
        d.appendChild(c);
      }

      if (temTitulo) {
        const t = div('mm-titulo');
        Object.assign(t.style, { top: 0, height: alt + 'mm' });
        aplicarTexto(t, el.estiloTitulo, null, env, ctx);
        t.textContent = mes.nome;
        d.appendChild(t);
        y += alt;
      }

      const comeca = el.semanaComeca === 'domingo' ? 0 : 1;
      for (let i = 0; i < 7; i++) {
        celula(i * larg, y, C.DIAS_INICIAL[(i + comeca) % 7], el.estiloCabecalho);
      }
      y += alt;

      const primeiro = C.data(mes.ano, mes.numero, 1);
      const desvio = (primeiro.getUTCDay() - comeca + 7) % 7;
      const hoje = el.destacar === 'dia' && ctx.dia ? ctx.dia.chave : null;
      for (let n = 1; n <= mes.dias; n++) {
        const pos = desvio + n - 1;
        const dt = C.data(mes.ano, mes.numero, n);
        const k = C.chave(dt);
        const feriado = env.feriados.get(k) || (el.marcarEventos !== false && env.eventos && env.eventos.get(k));
        const ehHoje = k === hoje;
        celula((pos % 7) * larg, y + Math.floor(pos / 7) * alt, String(n),
          ehHoje ? el.estiloDestaque || el.estiloNumero : el.estiloNumero, (c, t) => {
            if (ehHoje || feriado) {
              const circ = div('mm-circ');
              Object.assign(circ.style, { width: diam + 'mm', height: diam + 'mm' });
              if (ehHoje) circ.style.background = corDestaque;
              else circ.style.border = `.18mm solid ${corFeriado}`;
              c.appendChild(circ);
            }
            if (ehHoje) t.style.color = A.campos.cor(el.corTextoDestaque || 'papel', env, ctx);
          });
      }
      return d;
    }
  });

  /* ---------- calendário do mês em grelha (página mensal) ---------- */
  registar('calendario-mes', {
    desenhar(el, ctx, env, caixa) {
      const C = A.calendario;
      const d = div('el-calmes');
      const mes = ctx.mes;
      if (!mes) return d;
      const comeca = el.semanaComeca === 'domingo' ? 0 : 1;
      const desvio = (C.data(mes.ano, mes.numero, 1).getUTCDay() - comeca + 7) % 7;
      const precisa = Math.ceil((desvio + mes.dias) / 7);
      const linhas = el.linhas === '6' ? 6 : el.linhas === '5-partilhadas' ? Math.min(5, precisa) : precisa;
      const cab = el.alturaCabecalho == null ? 6 : el.alturaCabecalho;
      const esp = el.espaco == null ? 2 : el.espaco;
      const lc = (caixa.l - 6 * esp) / 7;
      const ac = (caixa.a - cab - (linhas - 1) * esp) / linhas;
      const corCelula = A.campos.cor(el.corCelula || '@mes.claro', env, ctx);
      const corFds = A.campos.cor(el.corFds || el.corCelula || '@mes.claro', env, ctx);
      const corFeriado = A.campos.cor(el.corFeriado || '@mes.forte', env, ctx);
      const nomes = { inicial: C.DIAS_INICIAL, abreviado: C.DIAS_ABREV, nome: C.DIAS }[el.cabecalho || 'abreviado'];

      for (let c = 0; c < 7; c++) {
        const t = div('calmes-cab');
        aplicarTexto(t, el.estiloCabecalho, null, env, ctx);
        Object.assign(t.style, { left: c * (lc + esp) + 'mm', width: lc + 'mm', height: cab + 'mm' });
        t.textContent = nomes[(c + comeca) % 7];
        d.appendChild(t);
      }

      const posicao = el.numeroPosicao || 'topo-esq';
      for (let r = 0; r < linhas; r++) {
        for (let c = 0; c < 7; c++) {
          const n = r * 7 + c - desvio + 1;
          const dentro = n >= 1 && n <= mes.dias;
          const partilhado = el.linhas === '5-partilhadas' && precisa === 6 && r === 4 && n + 7 <= mes.dias;
          if (!dentro && el.foraDoMes === 'nada') continue;
          const dow = (c + comeca) % 7;
          const cel = div('calmes-cel');
          Object.assign(cel.style, {
            left: c * (lc + esp) + 'mm', top: cab + r * (ac + esp) + 'mm', width: lc + 'mm', height: ac + 'mm',
            background: dow === 0 || dow === 6 ? corFds : corCelula, borderRadius: (el.raio || 0) + 'mm'
          });
          if (dentro) {
            const num = div('calmes-num pos-' + posicao);
            const e = aplicarTexto(num, el.estiloNumero, null, env, ctx);
            const t = document.createElement('span');
            t.className = 'calmes-n';
            t.textContent = partilhado ? `${n} / ${n + 7}` : String(n);
            const k = C.chave(C.data(mes.ano, mes.numero, n));
            if (env.feriados.get(k) && el.feriado !== 'nada') {
              t.classList.add('com-feriado');
              t.style.setProperty('--diam', (e.tamanho || 8) * .3528 * 1.75 + 'mm');
              t.style.setProperty('--cor-feriado', corFeriado);
            }
            num.appendChild(t);
            cel.appendChild(num);
            const evs = env.eventos && env.eventos.get(k);
            if (evs && el.eventos !== 'nada') {
              const ev = div('calmes-evento');
              aplicarTexto(ev, el.estiloEvento || el.estiloCabecalho, null, env, ctx);
              ev.textContent = evs.join(' · ');
              cel.appendChild(ev);
            }
          }
          d.appendChild(cel);
        }
      }
      return d;
    }
  });

  /* ---------- linhas das horas ---------- */
  registar('linhas-horas', {
    desenhar(el, ctx, env, caixa) {
      const d = div('el-horas');
      const n = el.fim - el.inicio;
      const passo = caixa.a / n;
      const x0 = el.larguraRotulo == null ? 8 : el.larguraRotulo;
      const cor = A.campos.cor(el.corLinha || 'linha', env, ctx);
      const corMeia = A.campos.cor(el.corMeia || el.corLinha || 'linha', env, ctx);
      let s = '';
      for (let i = 0; i <= n; i++) s += linha(el.linhaInteira ? 0 : x0, i * passo, caixa.l, i * passo, cor, el.espessura || .2);
      if (el.meia) {
        for (let i = 0; i < n; i++) s += linha(x0, (i + .5) * passo, caixa.l, (i + .5) * passo, corMeia, el.espessura || .2, '0.01 0.9');
      }
      d.innerHTML = svgLinhas(caixa, s);
      if (x0 <= 0) return d; // sem coluna das horas: só as linhas
      for (let i = 0; i < n; i++) {
        const h = el.inicio + i;
        const r = div('horas-rotulo');
        aplicarTexto(r, el.estiloRotulo, null, env, ctx);
        Object.assign(r.style, { top: (i * passo + (el.rotuloDesce || .9)) + 'mm', width: (x0 - 1.6) + 'mm' });
        r.textContent = el.formato === '00' ? String(h).padStart(2, '0')
          : el.formato === ':00' ? h + ':00' : h + 'h';
        d.appendChild(r);
      }
      return d;
    }
  });

  /* ---------- linhas (pautado, pontos) ---------- */
  registar('linhas', {
    desenhar(el, ctx, env, caixa) {
      const cor = A.campos.cor(el.cor || 'linha', env, ctx);
      const e = el.espacamento || 6;
      let s = '';
      if (el.estilo === 'pontos') {
        const r = el.raio || .2;
        const ox = (caixa.l % e) / 2, oy = (caixa.a % e) / 2;
        for (let y = oy; y <= caixa.a + .01; y += e) {
          for (let x = ox; x <= caixa.l + .01; x += e) s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${cor}"/>`;
        }
      } else {
        for (let y = e; y <= caixa.a + .01; y += e) s += linha(0, y, caixa.l, y, cor, el.espessura || .2);
      }
      return svgLinhas(caixa, s);
    }
  });

  /* ---------- campo: rótulo seguido de linha até ao fim ---------- */
  registar('campo', {
    desenhar(el, ctx, env) {
      const d = div('el-campo');
      const r = document.createElement('span');
      aplicarTexto(r, el.estiloRotulo, null, env, ctx);
      r.textContent = A.campos.texto(el.rotulo, ctx);
      const l = document.createElement('span');
      l.className = 'campo-linha';
      l.style.borderBottom = `${el.espessura || .2}mm solid ${A.campos.cor(el.corLinha || 'linha', env, ctx)}`;
      d.append(r, l);
      return d;
    }
  });

  /* ---------- lista com marcador ---------- */
  registar('lista', {
    desenhar(el, ctx, env, caixa) {
      const d = div('el-lista');
      const alt = caixa.a / el.itens;
      const corLinha = A.campos.cor(el.corLinha || 'linha', env, ctx);
      const corMarca = A.campos.cor(el.corMarcador || 'tintaSuave', env, ctx);
      for (let i = 0; i < el.itens; i++) {
        const item = div('lista-item');
        item.style.height = alt + 'mm';
        const m = div('lista-marca');
        if (el.marcador === 'caixa') {
          Object.assign(m.style, { width: '2.4mm', height: '2.4mm', border: `.2mm solid ${corMarca}`, borderRadius: '.4mm' });
        } else {
          Object.assign(m.style, { width: '1mm', height: '1mm', background: corMarca, borderRadius: '50%' });
        }
        const l = div('lista-linha');
        l.style.borderBottom = `.2mm solid ${corLinha}`;
        item.append(m, l);
        d.appendChild(item);
      }
      return d;
    }
  });

  /* ---------- tabela para preencher ---------- */
  registar('tabela', {
    desenhar(el, ctx, env, caixa) {
      const d = div('el-tabela');
      const cab = el.alturaCabecalho || 7;
      const n = Math.floor((caixa.a - cab) / el.alturaLinha);
      // As linhas esticam para encher a caixa: nunca fica meia linha no fundo.
      const alt = (caixa.a - cab) / n;
      const total = el.colunas.reduce((s, c) => s + c.largura, 0);
      const cor = A.campos.cor(el.corLinha || 'linha', env, ctx);
      const corCab = A.campos.cor(el.corCabecalho || el.corLinha || 'linha', env, ctx);
      let s = linha(0, cab, caixa.l, cab, corCab, el.espessuraCabecalho || .3);
      for (let i = 1; i <= n; i++) s += linha(0, cab + i * alt, caixa.l, cab + i * alt, cor, .2);
      let x = 0;
      el.colunas.forEach((c, i) => {
        const w = caixa.l * c.largura / total;
        if (i > 0 && el.verticais !== false) {
          s += linha(x, cab + (el.verticaisDesdeCabecalho ? -cab : 0) + 1.2, x, cab + n * alt, cor, .2);
        }
        const t = div('tabela-cab');
        aplicarTexto(t, el.estiloCabecalho, null, env, ctx);
        Object.assign(t.style, {
          left: (x + (i ? 1.5 : 0)) + 'mm', width: (w - 2) + 'mm', height: (cab - 1.2) + 'mm',
          justifyContent: c.alinhar === 'center' ? 'center' : 'flex-start'
        });
        t.textContent = c.titulo;
        d.appendChild(t);
        x += w;
      });
      d.insertAdjacentHTML('afterbegin', svgLinhas(caixa, s));
      return d;
    }
  });

  /* ---------- descrições para o painel de propriedades ----------
     Cada componente diz o nome, as propriedades editáveis e os valores de um
     elemento novo. O painel é gerado a partir daqui. */
  const ALINHAR = [['left', 'Esquerda'], ['center', 'Centro'], ['right', 'Direita']];
  const VERTICAL = [['topo', 'Topo'], ['meio', 'Meio'], ['base', 'Base']];
  const DESCRICOES = {
    texto: {
      nome: 'Texto', ordem: 1,
      propriedades: [
        { chave: 'texto', tipo: 'textoLongo', etiqueta: 'Texto' },
        { chave: 'estilo', tipo: 'estilo', etiqueta: 'Estilo', principal: true },
        { chave: 'alinhar', tipo: 'opcoes', etiqueta: 'Alinhar', opcoes: ALINHAR },
        { chave: 'vertical', tipo: 'opcoes', etiqueta: 'Vertical', opcoes: VERTICAL }
      ],
      omissao: { l: 50, a: 9, texto: 'Texto', alinhar: 'left', vertical: 'topo' }
    },
    campo: {
      nome: 'Campo', ordem: 2,
      propriedades: [
        { chave: 'rotulo', tipo: 'texto', etiqueta: 'Rótulo' },
        { chave: 'estiloRotulo', tipo: 'estilo', etiqueta: 'Estilo', principal: true },
        { chave: 'corLinha', tipo: 'cor', etiqueta: 'Linha' },
        { chave: 'espessura', tipo: 'numero', etiqueta: 'Espessura', min: .1, max: 1, passo: .05, unidade: 'mm' }
      ],
      omissao: { l: 60, a: 6, rotulo: 'Nome' }
    },
    forma: {
      nome: 'Forma', ordem: 3,
      propriedades: [
        { chave: 'forma', tipo: 'opcoes', etiqueta: 'Forma', opcoes: [['rect', 'Rectângulo'], ['circulo', 'Círculo'], ['linha', 'Linha']] },
        { chave: 'preencher', tipo: 'cor', etiqueta: 'Fundo', nenhum: true },
        { chave: 'cor', tipo: 'cor', etiqueta: 'Contorno' },
        { chave: 'contorno', tipo: 'booleano', etiqueta: 'Com contorno' },
        { chave: 'espessura', tipo: 'numero', etiqueta: 'Espessura', min: .1, max: 3, passo: .05, unidade: 'mm' },
        { chave: 'raio', tipo: 'numero', etiqueta: 'Cantos', min: 0, max: 30, passo: .5, unidade: 'mm' }
      ],
      omissao: { l: 40, a: 25, forma: 'rect', preencher: '@mes.claro', cor: '@mes.forte', raio: 3, espessura: .25 }
    },
    linha: {
      nome: 'Linha', ordem: 4, tipoReal: 'forma',
      omissao: { l: 60, a: 2, forma: 'linha', cor: '@mes.forte', espessura: .25 }
    },
    imagem: {
      nome: 'Imagem', ordem: 5,
      propriedades: [
        { chave: 'src', tipo: 'imagem', etiqueta: 'Imagem' },
        { chave: 'ajuste', tipo: 'opcoes', etiqueta: 'Ajuste', opcoes: [['contain', 'Caber'], ['cover', 'Encher']] }
      ],
      omissao: { l: 40, a: 40, ajuste: 'contain' }
    },
    decoracao: {
      nome: 'Flor', ordem: 6,
      propriedades: [
        { chave: 'imagem', tipo: 'imagem', etiqueta: 'Imagem pintada', nenhum: true },
        { chave: 'desenho', tipo: 'opcoes', etiqueta: 'Desenho', opcoes: [['canto', 'Canto'], ['raminho', 'Raminho'], ['grinalda', 'Grinalda']] },
        { chave: 'cor', tipo: 'cor', etiqueta: 'Traço' },
        { chave: 'corFolha', tipo: 'cor', etiqueta: 'Folhas' },
        { chave: 'espessura', tipo: 'numero', etiqueta: 'Espessura', min: .1, max: 1, passo: .02, unidade: 'mm' },
        { chave: 'semente', tipo: 'numero', etiqueta: 'Variação', min: 1, max: 999, passo: 1 }
      ],
      omissao: { l: 24, a: 22, desenho: 'raminho', semente: 1 }
    },
    'linhas-horas': {
      nome: 'Horas', ordem: 7,
      propriedades: [
        { chave: 'inicio', tipo: 'numero', etiqueta: 'Primeira hora', min: 0, max: 23, passo: 1 },
        { chave: 'fim', tipo: 'numero', etiqueta: 'Última hora', min: 1, max: 24, passo: 1, mostrar: v => v - 1, guardar: v => v + 1 },
        { chave: 'meia', tipo: 'booleano', etiqueta: 'Meias horas' },
        { chave: 'formato', tipo: 'opcoes', etiqueta: 'Formato', opcoes: [['h', '7h'], ['00', '07'], [':00', '7:00']] },
        { chave: 'estiloRotulo', tipo: 'estilo', etiqueta: 'Estilo das horas', principal: true },
        { chave: 'larguraRotulo', tipo: 'numero', etiqueta: 'Coluna das horas', min: 0, max: 30, passo: .5, unidade: 'mm' },
        { chave: 'corLinha', tipo: 'cor', etiqueta: 'Linhas' },
        { chave: 'espessura', tipo: 'numero', etiqueta: 'Espessura', min: .1, max: 1, passo: .05, unidade: 'mm' }
      ],
      omissao: { l: 78, a: 110, inicio: 7, fim: 22, meia: true, formato: 'h', larguraRotulo: 8 }
    },
    linhas: {
      nome: 'Pautado', ordem: 8,
      propriedades: [
        { chave: 'estilo', tipo: 'opcoes', etiqueta: 'Tipo', opcoes: [['pautado', 'Linhas'], ['pontos', 'Pontos']] },
        { chave: 'espacamento', tipo: 'numero', etiqueta: 'Espaçamento', min: 3, max: 15, passo: .5, unidade: 'mm' },
        { chave: 'cor', tipo: 'cor', etiqueta: 'Cor' },
        { chave: 'espessura', tipo: 'numero', etiqueta: 'Espessura', min: .1, max: 1, passo: .05, unidade: 'mm' },
        { chave: 'raio', tipo: 'numero', etiqueta: 'Tamanho dos pontos', min: .1, max: .8, passo: .02, unidade: 'mm' }
      ],
      omissao: { l: 60, a: 30, estilo: 'pautado', espacamento: 6 }
    },
    lista: {
      nome: 'Lista', ordem: 9,
      propriedades: [
        { chave: 'itens', tipo: 'numero', etiqueta: 'Itens', min: 1, max: 40, passo: 1 },
        { chave: 'marcador', tipo: 'opcoes', etiqueta: 'Marcador', opcoes: [['caixa', 'Caixa'], ['ponto', 'Ponto']] },
        { chave: 'corMarcador', tipo: 'cor', etiqueta: 'Marcador' },
        { chave: 'corLinha', tipo: 'cor', etiqueta: 'Linhas' }
      ],
      omissao: { l: 40, a: 26, itens: 4, marcador: 'caixa' }
    },
    tabela: {
      nome: 'Tabela', ordem: 10,
      propriedades: [
        { chave: 'colunas', tipo: 'colunas', etiqueta: 'Colunas' },
        { chave: 'alturaLinha', tipo: 'numero', etiqueta: 'Altura das linhas', min: 4, max: 40, passo: .5, unidade: 'mm' },
        { chave: 'estiloCabecalho', tipo: 'estilo', etiqueta: 'Estilo do cabeçalho', principal: true },
        { chave: 'corCabecalho', tipo: 'cor', etiqueta: 'Linha do cabeçalho' },
        { chave: 'corLinha', tipo: 'cor', etiqueta: 'Linhas' },
        { chave: 'verticais', tipo: 'booleano', etiqueta: 'Linhas verticais', omissao: true }
      ],
      omissao: {
        l: 121, a: 80, alturaLinha: 10, alturaCabecalho: 7, corCabecalho: '@mes.forte',
        colunas: [{ titulo: 'Data', largura: 15 }, { titulo: 'Notas', largura: 60 }]
      }
    },
    'calendario-mes': {
      nome: 'Mês', ordem: 12,
      propriedades: [
        { chave: 'linhas', tipo: 'opcoes', etiqueta: 'Linhas', opcoes: [['auto', 'As precisas'], ['5-partilhadas', '5 (23/30)'], ['6', 'Sempre 6']] },
        { chave: 'semanaComeca', tipo: 'opcoes', etiqueta: 'Semana começa', opcoes: [['segunda', 'Segunda'], ['domingo', 'Domingo']] },
        { chave: 'cabecalho', tipo: 'opcoes', etiqueta: 'Dias', opcoes: [['inicial', 'S T Q'], ['abreviado', 'Seg. Ter.'], ['nome', 'Segunda']] },
        { chave: 'numeroPosicao', tipo: 'opcoes', etiqueta: 'Número', opcoes: [['topo-esq', 'Esquerda'], ['topo-centro', 'Centro'], ['topo-dir', 'Direita']] },
        { chave: 'estiloNumero', tipo: 'estilo', etiqueta: 'Números', principal: true },
        { chave: 'estiloCabecalho', tipo: 'estilo', etiqueta: 'Dias da semana' },
        { chave: 'corCelula', tipo: 'cor', etiqueta: 'Caixas' },
        { chave: 'corFds', tipo: 'cor', etiqueta: 'Fim-de-semana' },
        { chave: 'corFeriado', tipo: 'cor', etiqueta: 'Feriados' },
        { chave: 'eventos', tipo: 'opcoes', etiqueta: 'Eventos', opcoes: [['mostrar', 'Escritos no dia'], ['nada', 'Não mostrar']] },
        { chave: 'estiloEvento', tipo: 'estilo', etiqueta: 'Estilo dos eventos' },
        { chave: 'espaco', tipo: 'numero', etiqueta: 'Espaço', min: 0, max: 10, passo: .25, unidade: 'mm' },
        { chave: 'raio', tipo: 'numero', etiqueta: 'Cantos', min: 0, max: 10, passo: .25, unidade: 'mm' },
        { chave: 'foraDoMes', tipo: 'opcoes', etiqueta: 'Fora do mês', opcoes: [['caixa', 'Caixa vazia'], ['nada', 'Nada']] }
      ],
      omissao: {
        l: 121, a: 150, linhas: '5-partilhadas', semanaComeca: 'segunda', cabecalho: 'abreviado', numeroPosicao: 'topo-esq',
        corCelula: '@mes.claro', corFds: { cor: '@mes.forte', intensidade: .28 }, espaco: 2, raio: 2.5, foraDoMes: 'caixa'
      }
    },
    'mini-mes': {
      nome: 'Mini-mês', ordem: 11,
      propriedades: [
        { chave: 'destacar', tipo: 'opcoes', etiqueta: 'Destacar', opcoes: [['dia', 'O dia'], ['nenhum', 'Nada']] },
        { chave: 'titulo', tipo: 'booleano', etiqueta: 'Nome do mês' },
        { chave: 'semanaComeca', tipo: 'opcoes', etiqueta: 'Semana começa', opcoes: [['segunda', 'Segunda'], ['domingo', 'Domingo']] },
        { chave: 'estiloNumero', tipo: 'estilo', etiqueta: 'Números', principal: true },
        { chave: 'estiloCabecalho', tipo: 'estilo', etiqueta: 'Dias da semana' },
        { chave: 'estiloDestaque', tipo: 'estilo', etiqueta: 'Dia destacado' },
        { chave: 'estiloTitulo', tipo: 'estilo', etiqueta: 'Nome do mês' },
        { chave: 'corDestaque', tipo: 'cor', etiqueta: 'Destaque' },
        { chave: 'corFeriado', tipo: 'cor', etiqueta: 'Feriados e eventos' },
        { chave: 'marcarEventos', tipo: 'booleano', etiqueta: 'Marcar os eventos', omissao: true }
      ],
      omissao: { l: 36, a: 26, destacar: 'dia', semanaComeca: 'segunda' }
    }
  };

  function descrever(tipo) {
    const d = DESCRICOES[tipo];
    return d ? Object.assign({ propriedades: [] }, d) : { nome: tipo, propriedades: [], omissao: {} };
  }

  A.componentes = { registar, obter: tipo => REGISTO[tipo], aplicarTexto, descrever, DESCRICOES };
})(typeof window !== 'undefined' ? window : globalThis);
