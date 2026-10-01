/* 17 · Conteúdos — o que muda de edição para edição e está preso a datas:
   eventos (Memorial, assembleias…), a frase de cada mês e o texto de cada
   semana. Colar uma coluna de uma folha de cálculo num campo enche os
   seguintes, um por linha. */
(function () {
  'use strict';
  const A = window.Agenda;
  const M = A.modelo, E = A.editor, K = A.controlos;
  const C = A.calendario;
  const no = K.no;

  const T = A.conteudos = {};

  function edicao(p) { return p.edicoes[E.estado.edicao]; }

  /* Linhas coladas: uma por linha; de várias colunas fica a última preenchida. */
  function linhasColadas(texto) {
    const linhas = texto.replace(/\r/g, '').split('\n');
    while (linhas.length && !linhas[linhas.length - 1].trim()) linhas.pop();
    return linhas.map(l => {
      const celulas = l.split('\t').map(c => c.trim()).filter(Boolean);
      return celulas.length ? celulas[celulas.length - 1] : '';
    });
  }

  /* Uma tabela "rótulo | campo" ligada a ed.conteudos[lista][chave]. */
  function tabela(lista, linhas) {
    const caixa = no('div', 'tabela-conteudos');
    const valores = (edicao(M.obter()).conteudos || {})[lista] || {};
    linhas.forEach(([chave, rotulo], i) => {
      const fila = no('label', 'fila-conteudo');
      const entrada = K.texto(valores[chave] || '', v => M.alterar(p => {
        const ed = edicao(p);
        ed.conteudos = ed.conteudos || {};
        ed.conteudos[lista] = ed.conteudos[lista] || {};
        if (v) ed.conteudos[lista][chave] = v; else delete ed.conteudos[lista][chave];
      }, 'conteudo:' + lista + ':' + chave));
      entrada.addEventListener('paste', ev => {
        const coladas = linhasColadas(ev.clipboardData.getData('text'));
        if (coladas.length < 2) return;
        ev.preventDefault();
        M.alterar(p => {
          const ed = edicao(p);
          ed.conteudos = ed.conteudos || {};
          ed.conteudos[lista] = ed.conteudos[lista] || {};
          coladas.forEach((texto, j) => {
            const alvo = linhas[i + j];
            if (!alvo) return;
            if (texto) ed.conteudos[lista][alvo[0]] = texto; else delete ed.conteudos[lista][alvo[0]];
          });
        });
        entrada.blur();
      });
      fila.append(no('span', 'rotulo-conteudo', rotulo), entrada);
      caixa.appendChild(fila);
    });
    return caixa;
  }

  function seccaoEventos() {
    const p = M.obter();
    const ed = edicao(p);
    const lista = no('div', 'eventos');
    const mudar = (i, k, v, juntar) => M.alterar(pp => {
      const e = edicao(pp).eventos[i];
      if (v) e[k] = v; else delete e[k];
    }, juntar ? 'evento:' + i + ':' + k : null);
    (ed.eventos || []).forEach((ev, i) => {
      const fila = no('div', 'evento');
      const data = (valor, k) => {
        const d = no('input');
        d.type = 'date';
        d.value = valor || '';
        d.addEventListener('change', () => mudar(i, k, d.value));
        return d;
      };
      const nome = K.texto(ev.nome, v => mudar(i, 'nome', v, true), 'Nome');
      fila.append(nome, data(ev.de, 'de'), data(ev.ate, 'ate'),
        K.botao('×', () => M.alterar(pp => { edicao(pp).eventos.splice(i, 1); }), 'pequeno'));
      lista.appendChild(fila);
    });
    const novo = K.botao('+ Evento', () => M.alterar(pp => {
      const e = edicao(pp);
      e.eventos = e.eventos || [];
      e.eventos.push({ nome: '', de: e.periodo.inicio });
    }), 'largo');
    return K.seccao('Eventos', lista, novo);
  }

  T.painel = function () {
    const p = M.obter();
    const ed = edicao(p);
    const ini = C.deChave(ed.periodo.inicio), fim = C.deChave(ed.periodo.fim);
    const frag = document.createDocumentFragment();
    frag.appendChild(no('h2', null, `Conteúdos · ${ed.nome}`));
    frag.appendChild(seccaoEventos());

    const meses = C.listaMeses(ini, fim).map(m => [A.gerador.chaveMes(m), `${m.abrev} ${m.ano}`]);
    frag.appendChild(K.seccao('Frase de cada mês', tabela('fraseMes', meses)));

    const semanas = C.listaSemanas(ini, fim).map(s => [C.chave(s), `${s.getUTCDate()} ${C.MESES_ABREV[s.getUTCMonth()]}`]);
    frag.appendChild(K.seccao('Texto de cada semana', tabela('textoSemana', semanas)));
    return frag;
  };
})();
