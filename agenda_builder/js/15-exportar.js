/* 15 · Exportar — PDF da edição inteira (A5 ou já imposto em A4) e a folha
   de teste da impressora. O PDF sai da impressão do browser ("Guardar como PDF"). */
(function () {
  'use strict';
  const A = window.Agenda;
  const M = A.modelo, E = A.editor, K = A.controlos;
  const no = K.no;
  const $ = s => document.querySelector(s);

  const X = A.exportar = { imposto: true, edicao: null };

  function definirPagina(largura, altura) {
    $('#estilo-pagina').textContent = `@page { size: ${largura}mm ${altura}mm; margin: 0 }`;
  }

  async function esperarRecursos() {
    await document.fonts.ready;
    const limite = new Promise(res => setTimeout(res, 4000));
    const imagens = [...document.querySelectorAll('#impressao img')].map(i => i.decode().catch(() => {}));
    await Promise.race([Promise.all(imagens), limite]);
  }

  function folhas(destino, paginasDom, folha, virar) {
    const { folhas } = A.imposicao.impor(paginasDom.length, virar);
    const meia = n => {
      const m = no('div', 'meia');
      if (n) m.appendChild(paginasDom[n - 1]);
      return m;
    };
    for (const f of folhas) {
      for (const [face, rodar] of [[f.frente, false], [f.verso, f.rodarVerso]]) {
        const s = no('div', 'folha' + (rodar ? ' rodar' : ''));
        Object.assign(s.style, { width: folha.largura + 'mm', height: folha.altura + 'mm' });
        s.append(meia(face[0]), meia(face[1]));
        destino.appendChild(s);
      }
    }
  }

  /* Prepara a impressão sem abrir a janela. "intervalo" ([de, até], 1-based)
     limita as páginas — só para o PDF A5. */
  X.preparar = async function (edicaoId, imposto, intervalo) {
    const p = M.obter();
    let { paginas, feriados } = A.gerador.gerar(p, edicaoId);
    if (intervalo && !imposto) paginas = paginas.slice(intervalo[0] - 1, intervalo[1]);
    const ed = p.edicoes[edicaoId];
    const env = { estilos: p.estilos, tema: ed.tema || p.tema, feriados, edicaoId, guias: false };
    const destino = $('#impressao');
    destino.replaceChildren();
    const doms = paginas.map(pg => A.desenhar.pagina(pg, p, env));
    if (imposto) {
      definirPagina(p.impressao.folha.largura, p.impressao.folha.altura);
      folhas(destino, doms, p.impressao.folha, p.impressao.virar);
    } else {
      definirPagina(p.formato.pagina.largura, p.formato.pagina.altura);
      destino.append(...doms);
    }
    await esperarRecursos();
  };

  X.imprimir = async function (edicaoId, imposto) {
    await X.preparar(edicaoId, imposto);
    window.print();
  };

  /* Quatro páginas numeradas, com setas e uma régua em cruz: imprime-se uma
     folha em duplex, corta-se, e vê-se se a ordem e o verso estão certos. */
  X.folhaTeste = async function () {
    const p = M.obter();
    const fmt = p.formato.pagina;
    const doms = [1, 2, 3, 4].map(n => {
      const pg = no('div', 'pagina pagina-teste');
      Object.assign(pg.style, { width: fmt.largura + 'mm', height: fmt.altura + 'mm' });
      pg.append(no('div', 'teste-numero', String(n)), no('div', 'teste-seta', '↑'), no('div', 'teste-cruz'));
      return pg;
    });
    const destino = $('#impressao');
    destino.replaceChildren();
    definirPagina(p.impressao.folha.largura, p.impressao.folha.altura);
    folhas(destino, doms, p.impressao.folha, p.impressao.virar);
    await esperarRecursos();
    window.print();
  };

  window.addEventListener('afterprint', () => { if (!X.semJanela) $('#impressao').replaceChildren(); });

  X.painel = function () {
    const p = M.obter();
    const frag = document.createDocumentFragment();
    if (!X.edicao || !p.edicoes[X.edicao]) X.edicao = E.estado.edicao;
    const n = A.gerador.gerar(p, X.edicao).paginas.length;
    const total = Math.ceil(n / 4) * 4;
    frag.appendChild(no('h2', null, 'Exportar'));
    frag.appendChild(K.seccao(null,
      K.linha('Edição', K.seleccionar(X.edicao, Object.entries(p.edicoes).map(([id, e]) => [id, e.nome]), v => { X.edicao = v; A.paineis.desenharPainel(); })),
      K.booleano(X.imposto, 'Imposição para imprimir (A4, 2 por face, corta-e-empilha)', v => { X.imposto = v; A.paineis.desenharPainel(); }),
      no('p', 'resumo', X.imposto ? `${n} páginas · ${total / 4} folhas A4` : `${n} páginas A5`),
      K.botao('Criar PDF', () => X.imprimir(X.edicao, X.imposto), 'principal largo')
    ));
    frag.appendChild(K.seccao('Impressora',
      K.linha('Duplex vira pelo', K.opcoes(p.impressao.virar, [['lado-curto', 'Lado curto'], ['lado-longo', 'Lado longo']],
        v => M.alterar(pp => { pp.impressao.virar = v; }))),
      K.botao('Folha de teste', X.folhaTeste, 'largo')
    ));
    return frag;
  };
})();
