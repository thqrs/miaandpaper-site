/* 08 · Direcções — três propostas de estilo para a agenda diária, cada uma um
   projecto completo (formato, estilos, tema, moldes, sequência, edições).
   Só dados: quando existir o servidor, isto passa a ser JSON gravado. */
(function (raiz) {
  'use strict';
  const A = raiz.Agenda = raiz.Agenda || {};

  const E = (tipo, x, y, l, a, props) => Object.assign({ tipo, x, y, l, a }, props);
  const EDICOES_TJ = ['publicador', 'pioneiro'];
  const SO_TODOS_E_PUBLICADOR = ['todos', 'publicador'];

  const FORMATO = {
    pagina: { largura: 148, altura: 210 },
    margens: { topo: 12, base: 11, interior: 17, exterior: 10 },
    furos: { lado: 'interior', distancia: 4, diametro: 5 },
    naoImprimivel: 3,
    primeiraPagina: 'direita'
  };

  const CORES = { tinta: '#3f3b38', tintaSuave: '#9b948c', linha: '#dcd6cf', papel: '#ffffff' };

  /* Tons suaves e adultos, um por mês. Os tons claros são calculados. */
  const TEMA = {
    meses: [
      { forte: '#7d8fa6' }, { forte: '#a4839b' }, { forte: '#b0877d' }, { forte: '#8e9c7f' },
      { forte: '#b3966a' }, { forte: '#7f9a95' }, { forte: '#bf8a73' }, { forte: '#a29058' },
      { forte: '#8b80a1' }, { forte: '#a3775f' }, { forte: '#7b8a7a' }, { forte: '#8f6f78' }
    ],
    neutro: { forte: '#9a8088' }
  };

  const EDICOES = {
    todos: { nome: 'Todos', periodo: { inicio: '2027-01-01', fim: '2027-12-31' }, feriados: ['pt'], textos: {} },
    publicador: { nome: 'Publicador', periodo: { inicio: '2027-01-01', fim: '2027-12-31' }, feriados: ['pt'], textos: {} },
    pioneiro: { nome: 'Pioneiro', periodo: { inicio: '2027-01-01', fim: '2027-12-31' }, feriados: ['pt'], textos: {} }
  };

  const SEQUENCIA = [
    { molde: 'dia', repetir: 'dia' },
    { molde: 'revisita', edicoes: EDICOES_TJ },
    { molde: 'estudo', edicoes: EDICOES_TJ },
    { molde: 'designacoes', edicoes: EDICOES_TJ }
  ];

  const IMPRESSAO = { folha: { largura: 297, altura: 210 }, porFace: 2, ordem: 'corta-e-empilha', virar: 'lado-curto' };

  /* Coluna lateral da página diária: prioridades, lembretes e, por edição,
     gratidão ou o registo do ministério do pioneiro. */
  function colunaLateral(x, y, l, s) {
    return [
      E('texto', x, y, l, 6, { texto: 'Prioridades', estilo: s }),
      E('lista', x, y + 7, l, 24, { itens: 4, marcador: 'caixa' }),
      E('texto', x, y + 35, l, 6, { texto: 'Lembretes', estilo: s }),
      E('linhas', x, y + 39, l, 30, { espacamento: 6 }),
      E('texto', x, y + 73, l, 6, { texto: 'Gratidão', estilo: s, edicoes: SO_TODOS_E_PUBLICADOR }),
      E('linhas', x, y + 77, l, 24, { espacamento: 6, edicoes: SO_TODOS_E_PUBLICADOR }),
      E('texto', x, y + 73, l, 6, { texto: 'Ministério', estilo: s, edicoes: ['pioneiro'] }),
      E('campo', x, y + 81, l, 6, { rotulo: 'Horas', estiloRotulo: 'rotulo', edicoes: ['pioneiro'] }),
      E('campo', x, y + 89, l, 6, { rotulo: 'Estudos', estiloRotulo: 'rotulo', edicoes: ['pioneiro'] }),
      E('campo', x, y + 97, l, 6, { rotulo: 'Revisitas', estiloRotulo: 'rotulo', edicoes: ['pioneiro'] })
    ];
  }

  function miniMes(x, y, l, a) {
    return E('mini-mes', x, y, l, a, {
      destacar: 'dia', estiloCabecalho: 'mmCab', estiloNumero: 'mmNum', estiloDestaque: 'mmDestaque'
    });
  }

  /* Páginas de preencher (logbook), partilhadas pelas três direcções. */
  function logbook(decoracao) {
    const tabela = (y, colunas, alturaLinha) => E('tabela', 0, y, 121, 187 - y, {
      colunas, alturaLinha, alturaCabecalho: 7, estiloCabecalho: 'cabecalhoTabela', corCabecalho: '@mes.forte'
    });
    const campo = (rotulo, x, y, l) => E('campo', x, y, l, 6, { rotulo, estiloRotulo: 'rotulo' });
    const titulo = texto => E('texto', 0, 0, 100, 12, { texto, estilo: 'tituloPagina' });
    const deco = decoracao ? [decoracao] : [];
    return {
      revisita: {
        nome: 'Revisita', elementos: [
          ...deco, titulo('Revisita'),
          campo('Nome', 0, 16, 121),
          campo('Contacto', 0, 24, 58), campo('Primeira conversa', 63, 24, 58),
          campo('Morada', 0, 32, 121),
          campo('Assunto de interesse', 0, 40, 121),
          tabela(51, [
            { titulo: 'Data', largura: 15 },
            { titulo: 'Falámos sobre', largura: 55 },
            { titulo: 'Pergunta que ficou no ar', largura: 51 }
          ], 11)
        ]
      },
      estudo: {
        nome: 'Estudo bíblico', elementos: [
          ...deco, titulo('Estudo bíblico'),
          campo('Nome', 0, 16, 121),
          campo('Contacto', 0, 24, 58), campo('Dia e hora', 63, 24, 58),
          campo('Morada', 0, 32, 121),
          campo('Publicação', 0, 40, 58), campo('Início', 63, 40, 58),
          tabela(51, [
            { titulo: 'Data', largura: 14 },
            { titulo: 'Lição', largura: 11, alinhar: 'center' },
            { titulo: 'Falámos sobre', largura: 50 },
            { titulo: 'Pergunta que ficou no ar', largura: 46 }
          ], 11)
        ]
      },
      designacoes: {
        nome: 'Designações', elementos: [
          ...deco, titulo('Designações'),
          tabela(18, [
            { titulo: 'Data', largura: 14 },
            { titulo: 'Reunião', largura: 16 },
            { titulo: 'Designação', largura: 28 },
            { titulo: 'Tema e fonte', largura: 35 },
            { titulo: 'Ajudante', largura: 20 },
            { titulo: '✓', largura: 7, alinhar: 'center' }
          ], 10)
        ]
      }
    };
  }

  function projecto(id, nome, estilosTexto, dia, decoracaoLogbook) {
    return {
      versao: 1, id, nome,
      formato: FORMATO,
      estilos: { cores: CORES, texto: estilosTexto },
      tema: TEMA,
      moldes: Object.assign({ dia: { nome: 'Dia', contexto: 'dia', elementos: dia } }, logbook(decoracaoLogbook)),
      sequencia: SEQUENCIA,
      edicoes: EDICOES,
      impressao: IMPRESSAO
    };
  }

  /* ---------------- Clássica: Cormorant Garamond + Jost ---------------- */
  const classica = projecto('classica', 'Clássica', {
    texto:      { fonte: 'Cormorant Garamond', peso: 500, tamanho: 11 },
    numeroDia:  { fonte: 'Cormorant Garamond', peso: 500, tamanho: 60, cor: '@mes.forte', alturaLinha: .8 },
    nomeDia:    { fonte: 'Sacramento', peso: 400, tamanho: 24, cor: '@mes.forte', alturaLinha: 1.05, letraDesenhada: true },
    mesAno:     { fonte: 'Cormorant Garamond', peso: 500, italico: true, tamanho: 12.5 },
    feriado:    { fonte: 'Jost', peso: 500, tamanho: 5.8, maiusculas: true, espacamento: .26, cor: '@mes.forte' },
    secao:      { fonte: 'Cormorant Garamond', peso: 500, italico: true, tamanho: 12, cor: '@mes.forte' },
    horas:      { fonte: 'Cormorant Garamond', peso: 500, italico: true, tamanho: 8.5, cor: 'tintaSuave', alturaLinha: 1 },
    mmCab:      { fonte: 'Jost', peso: 500, tamanho: 4.8, cor: 'tintaSuave', alturaLinha: 1 },
    mmNum:      { fonte: 'Jost', peso: 400, tamanho: 5.2, alturaLinha: 1 },
    mmDestaque: { fonte: 'Jost', peso: 500, tamanho: 5.2, alturaLinha: 1 },
    tituloPagina:    { fonte: 'Sacramento', peso: 400, tamanho: 30, cor: '@mes.forte', alturaLinha: 1, letraDesenhada: true },
    rotulo:          { fonte: 'Jost', peso: 400, tamanho: 5.6, maiusculas: true, espacamento: .2, cor: 'tintaSuave' },
    cabecalhoTabela: { fonte: 'Jost', peso: 500, tamanho: 5.2, maiusculas: true, espacamento: .18, cor: '@mes.forte', alturaLinha: 1.1 }
  }, [
    E('texto', 0, 0, 30, 22, { texto: '{dia.numero}', estilo: 'numeroDia' }),
    E('texto', 31, 0, 54, 11, { texto: '{dia.nome}', estilo: 'nomeDia', vertical: 'meio' }),
    E('texto', 31, 11.5, 54, 6, { texto: '{mes.nome} {mes.ano}', estilo: 'mesAno' }),
    E('texto', 31, 18.3, 54, 5, { texto: '{dia.rotuloFeriado}', estilo: 'feriado' }),
    miniMes(85, 0, 36, 26),
    E('forma', 0, 29, 121, 1, { forma: 'linha', cor: '@mes.forte', espessura: .25 }),
    E('linhas-horas', 0, 35, 78, 119, { inicio: 7, fim: 22, larguraRotulo: 8, meia: true, estiloRotulo: 'horas' }),
    ...colunaLateral(84, 33, 37, 'secao'),
    E('texto', 0, 158, 40, 6, { texto: 'Notas', estilo: 'secao' }),
    E('linhas', 0, 165, 90, 22, { estilo: 'pontos', espacamento: 5, cor: 'tintaSuave', raio: .16 }),
    E('decoracao', 88, 151, 35, 43, { desenho: 'canto', semente: 7 })
  ], E('decoracao', 102, -3, 20, 17, { desenho: 'raminho', semente: 5 }));

  /* ---------------- Editorial: Playfair Display + Montserrat ---------------- */
  const editorial = projecto('editorial', 'Editorial', {
    texto:      { fonte: 'Montserrat', peso: 400, tamanho: 8.5 },
    numeroDia:  { fonte: 'Playfair Display', peso: 400, tamanho: 76, cor: '@mes.forte', alturaLinha: .8 },
    nomeDia:    { fonte: 'Montserrat', peso: 500, tamanho: 6.5, maiusculas: true, espacamento: .32 },
    mesAno:     { fonte: 'Playfair Display', peso: 400, italico: true, tamanho: 15 },
    feriado:    { fonte: 'Montserrat', peso: 500, tamanho: 5.4, maiusculas: true, espacamento: .3, cor: '@mes.forte' },
    secao:      { fonte: 'Montserrat', peso: 500, tamanho: 5.6, maiusculas: true, espacamento: .3, cor: '@mes.forte', alturaLinha: 1.6 },
    horas:      { fonte: 'Montserrat', peso: 400, tamanho: 5.8, cor: 'tintaSuave', alturaLinha: 1 },
    mmCab:      { fonte: 'Montserrat', peso: 600, tamanho: 4.5, cor: 'tintaSuave', alturaLinha: 1 },
    mmNum:      { fonte: 'Montserrat', peso: 400, tamanho: 4.9, alturaLinha: 1 },
    mmDestaque: { fonte: 'Montserrat', peso: 600, tamanho: 4.9, alturaLinha: 1 },
    tituloPagina:    { fonte: 'Playfair Display', peso: 400, italico: true, tamanho: 22, cor: '@mes.forte', alturaLinha: 1 },
    rotulo:          { fonte: 'Montserrat', peso: 500, tamanho: 5.2, maiusculas: true, espacamento: .26, cor: 'tintaSuave' },
    cabecalhoTabela: { fonte: 'Montserrat', peso: 500, tamanho: 4.9, maiusculas: true, espacamento: .22, cor: '@mes.forte', alturaLinha: 1.1 }
  }, [
    E('texto', 0, 3, 60, 5, { texto: '{dia.nome}', estilo: 'nomeDia' }),
    E('texto', 0, 9, 60, 8, { texto: '{mes.nome} · {mes.ano}', estilo: 'mesAno' }),
    E('texto', 0, 19, 60, 5, { texto: '{dia.rotuloFeriado}', estilo: 'feriado' }),
    E('decoracao', 47, 1, 16, 15, { desenho: 'raminho', semente: 9 }),
    E('texto', 61, -2, 60, 29, { texto: '{dia.numero}', estilo: 'numeroDia', alinhar: 'right' }),
    E('forma', 0, 29, 121, 1, { forma: 'linha', cor: 'linha', espessura: .3 }),
    E('campo', 0, 34, 121, 6, { rotulo: 'Intenção do dia', estiloRotulo: 'rotulo', edicoes: SO_TODOS_E_PUBLICADOR }),
    E('campo', 0, 34, 58, 6, { rotulo: 'Horas', estiloRotulo: 'rotulo', edicoes: ['pioneiro'] }),
    E('campo', 63, 34, 58, 6, { rotulo: 'Estudos', estiloRotulo: 'rotulo', edicoes: ['pioneiro'] }),
    E('linhas-horas', 0, 46, 121, 106, { inicio: 7, fim: 22, larguraRotulo: 7, formato: '00', meia: true, estiloRotulo: 'horas' }),
    E('texto', 0, 158, 60, 5, { texto: 'Notas', estilo: 'secao' }),
    E('linhas', 0, 161, 78, 26, { espacamento: 6.5 }),
    miniMes(85, 160, 36, 27)
  ], null);

  /* ---------------- Botânica: Pinyon Script + Cormorant Garamond + Jost ---------------- */
  const botanica = projecto('botanica', 'Botânica', {
    texto:      { fonte: 'Cormorant Garamond', peso: 500, tamanho: 11 },
    nomeDia:    { fonte: 'Pinyon Script', peso: 400, tamanho: 28, cor: '@mes.forte', alturaLinha: 1, letraDesenhada: true },
    dataLinha:  { fonte: 'Cormorant Garamond', peso: 600, tamanho: 8.5, maiusculas: true, espacamento: .22 },
    feriado:    { fonte: 'Jost', peso: 500, tamanho: 5.6, maiusculas: true, espacamento: .26, cor: '@mes.forte' },
    secao:      { fonte: 'Cormorant Garamond', peso: 500, italico: true, tamanho: 12, cor: '@mes.forte' },
    horas:      { fonte: 'Cormorant Garamond', peso: 500, italico: true, tamanho: 8.5, cor: 'tintaSuave', alturaLinha: 1 },
    mmCab:      { fonte: 'Jost', peso: 500, tamanho: 4.8, cor: 'tintaSuave', alturaLinha: 1 },
    mmNum:      { fonte: 'Jost', peso: 400, tamanho: 5.2, alturaLinha: 1 },
    mmDestaque: { fonte: 'Jost', peso: 500, tamanho: 5.2, alturaLinha: 1 },
    tituloPagina:    { fonte: 'Pinyon Script', peso: 400, tamanho: 30, cor: '@mes.forte', alturaLinha: 1, letraDesenhada: true },
    rotulo:          { fonte: 'Jost', peso: 400, tamanho: 5.6, maiusculas: true, espacamento: .2, cor: 'tintaSuave' },
    cabecalhoTabela: { fonte: 'Jost', peso: 500, tamanho: 5.2, maiusculas: true, espacamento: .18, cor: '@mes.forte', alturaLinha: 1.1 }
  }, [
    E('decoracao', 53, -8, 70, 38, { desenho: 'grinalda', semente: 11 }),
    E('texto', 0, 0, 78, 13, { texto: '{dia.nome}', estilo: 'nomeDia' }),
    E('texto', 0, 14.5, 78, 5, { texto: '{dia.numero} de {mes.nome} de {mes.ano}', estilo: 'dataLinha' }),
    E('texto', 0, 20.5, 78, 5, { texto: '{dia.rotuloFeriado}', estilo: 'feriado' }),
    E('linhas-horas', 0, 30, 78, 124, { inicio: 7, fim: 22, larguraRotulo: 8, meia: true, estiloRotulo: 'horas' }),
    miniMes(85, 31, 36, 26),
    ...colunaLateral(84, 61, 37, 'secao').map(el => Object.assign({}, el, { a: el.tipo === 'linhas' ? Math.min(el.a, 24) : el.a })),
    E('texto', 0, 159, 40, 6, { texto: 'Notas', estilo: 'secao' }),
    E('linhas', 0, 165, 78, 22, { espacamento: 6 })
  ], E('decoracao', 72, -8, 50, 26, { desenho: 'grinalda', semente: 4 }));

  A.direccoes = [classica, editorial, botanica];
  A.logbook = logbook;

  /* Paletas para comparar. "Da direcção" usa o tema do próprio projecto. */
  const umaCor = forte => ({ todosOsMeses: { forte }, neutro: { forte } });
  A.temas = [
    { id: 'direccao', nome: 'Um tom por mês', amostra: '#8f6f78', tema: null },
    { id: 'salvia', nome: 'Sálvia', amostra: '#7a8b72', tema: umaCor('#7a8b72') },
    { id: 'rosa', nome: 'Rosa antigo', amostra: '#b27f7c', tema: umaCor('#b27f7c') },
    { id: 'terracota', nome: 'Terracota', amostra: '#b0705a', tema: umaCor('#b0705a') },
    { id: 'champanhe', nome: 'Champanhe', amostra: '#a88c5f', tema: umaCor('#a88c5f') },
    { id: 'tinta', nome: 'Azul-tinta', amostra: '#5d6e88', tema: umaCor('#5d6e88') }
  ];

  /* Letras desenhadas para o dia da semana e os títulos. O factor iguala o
     tamanho visual entre letras (Sacramento = 1). */
  A.letrasDesenhadas = [
    { fonte: 'Sacramento', factor: 1 },
    { fonte: 'Parisienne', factor: .78 },
    { fonte: 'Allura', factor: .9 },
    { fonte: 'Ephesis', factor: 1 },
    { fonte: 'Italianno', factor: 1.12 },
    { fonte: 'Pinyon Script', factor: .8 }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
