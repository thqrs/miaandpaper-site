/* 09 · Páginas prontas — pontos de partida para o "+ Página nova". Cada uma
   devolve os moldes e o bloco da sequência. Usam os estilos do projecto pelo
   nome e acrescentam os que faltarem, para servirem a qualquer direcção. */
(function () {
  'use strict';
  const A = window.Agenda;
  const E = (tipo, x, y, l, a, props) => Object.assign({ tipo, x, y, l, a }, props);
  const W = 121, H = 187; // caixa de conteúdo A5 com as margens de omissão

  /* Estilos de reserva, se o projecto não tiver um com este nome. */
  const ESTILOS = {
    texto:          { fonte: 'Cormorant Garamond', peso: 500, tamanho: 11 },
    secao:          { fonte: 'Cormorant Garamond', peso: 500, italico: true, tamanho: 12, cor: '@mes.forte' },
    rotulo:         { fonte: 'Jost', peso: 400, tamanho: 5.6, maiusculas: true, espacamento: .2, cor: 'tintaSuave' },
    tituloPagina:   { fonte: 'Cormorant Garamond', peso: 500, tamanho: 24, cor: '@mes.forte', alturaLinha: 1 },
    tituloMes:      { fonte: 'Cormorant Garamond', peso: 500, tamanho: 34, cor: '@mes.forte', alturaLinha: 1 },
    tituloSemana:   { fonte: 'Cormorant Garamond', peso: 500, italico: true, tamanho: 16, cor: '@mes.forte', alturaLinha: 1 },
    numeroSemana:   { fonte: 'Cormorant Garamond', peso: 500, tamanho: 17, cor: '@mes.forte', alturaLinha: 1 },
    feriado:        { fonte: 'Jost', peso: 500, tamanho: 5, maiusculas: true, espacamento: .22, cor: '@mes.forte' },
    horas:          { fonte: 'Cormorant Garamond', peso: 500, italico: true, tamanho: 8, cor: 'tintaSuave', alturaLinha: 1 },
    numeroMes:      { fonte: 'Jost', peso: 400, tamanho: 7 },
    cabecalhoMes:   { fonte: 'Jost', peso: 500, tamanho: 5.6, maiusculas: true, espacamento: .2, cor: 'tintaSuave' },
    mmCab:          { fonte: 'Jost', peso: 500, tamanho: 4.8, cor: 'tintaSuave', alturaLinha: 1 },
    mmNum:          { fonte: 'Jost', peso: 400, tamanho: 5.2, alturaLinha: 1 },
    mmDestaque:     { fonte: 'Jost', peso: 500, tamanho: 5.2, alturaLinha: 1 },
    mmTitulo:       { fonte: 'Cormorant Garamond', peso: 500, italico: true, tamanho: 10.5, cor: '@mes.forte', alturaLinha: 1 },
    cabecalhoTabela:{ fonte: 'Jost', peso: 500, tamanho: 5.2, maiusculas: true, espacamento: .18, cor: '@mes.forte', alturaLinha: 1.1 }
  };

  function estilosUsados(moldes) {
    const nomes = new Set();
    for (const m of Object.values(moldes)) {
      for (const el of m.elementos) {
        for (const prop of A.componentes.descrever(el.tipo).propriedades) {
          if (prop.tipo === 'estilo' && el[prop.chave]) nomes.add(el[prop.chave]);
        }
      }
    }
    return nomes;
  }

  /* Coluna de um dia numa semana: dia abreviado, número, feriado e horas. */
  function colunaDia(x, l, dia, y0, alturaHoras) {
    return [
      E('texto', x, y0, l, 4, { texto: '{dia.abrev}', estilo: 'rotulo', alinhar: 'center', liga: { dia } }),
      E('texto', x, y0 + 4, l, 8, { texto: '{dia.numero}', estilo: 'numeroSemana', alinhar: 'center', liga: { dia } }),
      E('texto', x, y0 + 12.5, l, 3.5, { texto: '{dia.rotuloFeriado}', estilo: 'feriado', alinhar: 'center', liga: { dia } }),
      E('linhas-horas', x, y0 + 18, l, alturaHoras, { inicio: 7, fim: 22, larguraRotulo: 0, meia: true, linhaInteira: true, estiloRotulo: 'horas', liga: { dia } })
    ];
  }

  const PRONTAS = [
    {
      id: 'branco', nome: 'Em branco',
      criar: () => ({ moldes: { pagina: { nome: 'Página', elementos: [] } }, bloco: {} })
    },
    {
      id: 'dia', nome: 'Dia (uma página por dia)',
      criar: () => {
        const base = A.direccoes[0];
        return { moldes: { dia: JSON.parse(JSON.stringify(base.moldes.dia)) }, estilos: base.estilos.texto, bloco: { repetir: 'dia' } };
      }
    },
    {
      id: 'semana-horas', nome: 'Semana em 2 páginas, com horas',
      criar: () => {
        const yCol = 14, hHoras = H - yCol - 18;
        const col = (W - 6) / 4;
        const horas = E('linhas-horas', 0, yCol + 18, 6, hHoras, { inicio: 7, fim: 22, larguraRotulo: 6, meia: false, estiloRotulo: 'horas', corLinha: 'papel' });
        const esq = [
          E('texto', 0, 0, 90, 9, { texto: '{semana.titulo}', estilo: 'tituloSemana' }),
          E('texto', 90, 2, 31, 6, { texto: 'Semana {semana.numero} · {semana.ano}', estilo: 'rotulo', alinhar: 'right' }),
          JSON.parse(JSON.stringify(horas))
        ];
        for (let i = 0; i < 4; i++) esq.push(...colunaDia(6 + i * col, col - 1.5, i, yCol, hHoras));
        const dir = [JSON.parse(JSON.stringify(horas))];
        for (let i = 0; i < 3; i++) dir.push(...colunaDia(6 + i * col, col - 1.5, 4 + i, yCol, hHoras));
        dir.push(
          E('texto', 6 + 3 * col, yCol + 4, col - 1.5, 8, { texto: 'Notas', estilo: 'secao', alinhar: 'center' }),
          E('linhas', 6 + 3 * col, yCol + 18, col - 1.5, hHoras, { estilo: 'pontos', espacamento: 5, cor: 'tintaSuave', raio: .16 })
        );
        return {
          moldes: {
            'semana-esq': { nome: 'Semana (esquerda)', elementos: esq },
            'semana-dir': { nome: 'Semana (direita)', elementos: dir }
          },
          bloco: { repetir: 'semana', comecaEm: 'esquerda' }
        };
      }
    },
    {
      id: 'mes', nome: 'Mês (grelha)',
      criar: () => ({
        moldes: {
          mes: {
            nome: 'Mês', elementos: [
              E('texto', 0, 0, W, 14, { texto: '{mes.nome}', estilo: 'tituloMes', alinhar: 'center' }),
              E('texto', 0, 14, W, 5, { texto: '{mes.ano}', estilo: 'rotulo', alinhar: 'center' }),
              Object.assign(E('calendario-mes', 0, 24, W, H - 24), JSON.parse(JSON.stringify(A.componentes.descrever('calendario-mes').omissao)),
                { x: 0, y: 24, l: W, a: H - 24, estiloNumero: 'numeroMes', estiloCabecalho: 'cabecalhoMes' })
            ]
          }
        },
        bloco: { repetir: 'mes' }
      })
    },
    {
      id: 'ano', nome: 'Calendário do ano',
      criar: () => {
        const els = [E('texto', 0, 0, W, 12, { texto: 'Calendário {periodo.rotulo}', estilo: 'tituloPagina', alinhar: 'center' })];
        const gx = 6, gy = 7, cw = (W - 2 * gx) / 3, ch = (H - 18 - 3 * gy) / 4;
        for (let k = 0; k < 12; k++) {
          els.push(E('mini-mes', (k % 3) * (cw + gx), 18 + Math.floor(k / 3) * (ch + gy), cw, ch, {
            titulo: true, destacar: 'nenhum', semanaComeca: 'segunda', liga: { mes: k },
            estiloTitulo: 'mmTitulo', estiloCabecalho: 'mmCab', estiloNumero: 'mmNum', estiloDestaque: 'mmDestaque'
          }));
        }
        return { moldes: { ano: { nome: 'Calendário do ano', elementos: els } }, bloco: {} };
      }
    },
    {
      id: 'notas', nome: 'Notas',
      criar: () => ({
        moldes: {
          notas: {
            nome: 'Notas', elementos: [
              E('texto', 0, 0, W, 12, { texto: 'Notas', estilo: 'tituloPagina' }),
              E('linhas', 0, 16, W, H - 16, { estilo: 'pontos', espacamento: 5, cor: 'tintaSuave', raio: .16 })
            ]
          }
        },
        bloco: { vezes: 4 }
      })
    },
    { id: 'revisita', nome: 'Revisita', criar: () => ({ moldes: { revisita: A.logbook(null).revisita }, bloco: { vezes: 10 } }) },
    { id: 'estudo', nome: 'Estudo bíblico', criar: () => ({ moldes: { estudo: A.logbook(null).estudo }, bloco: { vezes: 6 } }) },
    { id: 'designacoes', nome: 'Designações', criar: () => ({ moldes: { designacoes: A.logbook(null).designacoes }, bloco: { vezes: 2 } }) }
  ];

  /* Junta uma página pronta ao projecto, depois do bloco "depois".
     Devolve o índice do bloco novo. */
  function juntar(p, id, depois) {
    const pronta = PRONTAS.find(x => x.id === id);
    const { moldes, bloco, estilos } = pronta.criar(p);
    const chaves = [];
    for (const [k, m] of Object.entries(moldes)) {
      let chave = k, n = 2;
      while (p.moldes[chave]) chave = k + '-' + n++;
      m.elementos.forEach(el => { el.id = A.modelo.novoId(); });
      p.moldes[chave] = JSON.parse(JSON.stringify(m));
      chaves.push(chave);
    }
    for (const nome of estilosUsados(moldes)) {
      if (!p.estilos.texto[nome]) p.estilos.texto[nome] = Object.assign({}, (estilos && estilos[nome]) || ESTILOS[nome] || ESTILOS.texto);
    }
    const b = Object.assign({ id: A.modelo.novoId('b') }, bloco);
    if (chaves.length === 1) b.molde = chaves[0]; else b.moldes = chaves;
    p.sequencia.splice(depois, 0, b);
    return depois;
  }

  A.prontas = { lista: PRONTAS.map(({ id, nome }) => ({ id, nome })), juntar };
})();
