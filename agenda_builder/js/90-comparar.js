/* 09 · Aplicação — pré-visualização das direcções e impressão. */
(function () {
  'use strict';
  const A = window.Agenda;
  const C = A.calendario;

  const estado = { direccao: 0, edicao: 'publicador', semana: '2027-01-04', guias: true, tema: 'direccao', letra: '' };
  const $ = s => document.querySelector(s);

  function projecto() { return A.direccoes[estado.direccao]; }

  function gerarPreview() {
    const fim = C.chave(C.somarDias(C.deChave(estado.semana), 6));
    return A.gerador.gerar(projecto(), estado.edicao, { inicio: estado.semana, fim });
  }

  /* Troca a letra dos estilos marcados com letraDesenhada, mantendo o tamanho visual. */
  function estilosComLetra(estilos) {
    if (!estado.letra) return estilos;
    const factor = f => (A.letrasDesenhadas.find(l => l.fonte === f) || { factor: 1 }).factor;
    const nova = A.letrasDesenhadas.find(l => l.fonte === estado.letra);
    const texto = {};
    for (const [nome, e] of Object.entries(estilos.texto)) {
      texto[nome] = e.letraDesenhada
        ? Object.assign({}, e, { fonte: nova.fonte, tamanho: +(e.tamanho / factor(e.fonte) * nova.factor).toFixed(1) })
        : e;
    }
    return Object.assign({}, estilos, { texto });
  }

  function temaActivo() {
    const t = A.temas.find(x => x.id === estado.tema);
    return (t && t.tema) || projecto().tema;
  }

  function env(feriados, guias) {
    const p = projecto();
    return { estilos: estilosComLetra(p.estilos), tema: temaActivo(), feriados, edicaoId: estado.edicao, guias };
  }

  function chips(alvo, itens, activo, aoEscolher) {
    alvo.replaceChildren(...itens.map(([valor, nome, amostra]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (valor === activo ? ' activo' : '');
      if (amostra) {
        const a = document.createElement('span');
        a.className = 'amostra';
        a.style.background = amostra;
        b.appendChild(a);
      }
      b.append(nome);
      b.addEventListener('click', () => aoEscolher(valor));
      return b;
    }));
  }

  function desenharBarra() {
    chips($('#direccoes'), A.direccoes.map((d, i) => [i, d.nome]), estado.direccao, v => { estado.direccao = v; tudo(); });
    chips($('#edicoes'), Object.entries(projecto().edicoes).map(([id, e]) => [id, e.nome]), estado.edicao,
      v => { estado.edicao = v; tudo(); });
    chips($('#temas'), A.temas.map(t => [t.id, t.nome, t.amostra]), estado.tema, v => { estado.tema = v; tudo(); });
    const temLetra = Object.values(projecto().estilos.texto).some(e => e.letraDesenhada);
    $('#grupo-letra').hidden = !temLetra;
  }

  function preencherLetras() {
    const sel = $('#letra');
    const omissao = document.createElement('option');
    omissao.value = '';
    omissao.textContent = 'Da direcção';
    sel.appendChild(omissao);
    for (const l of A.letrasDesenhadas) {
      const o = document.createElement('option');
      o.value = l.fonte;
      o.textContent = l.fonte;
      o.style.fontFamily = `'${l.fonte}'`;
      o.style.fontSize = '18px';
      sel.appendChild(o);
    }
    sel.value = estado.letra;
    sel.addEventListener('change', () => { estado.letra = sel.value; desenharLivro(); });
  }

  function preencherSemanas() {
    const sel = $('#semana');
    const ini = C.inicioSemana(C.data(2027, 1, 1));
    for (let s = ini; s.getUTCFullYear() <= 2027; s = C.somarDias(s, 7)) {
      const f = C.somarDias(s, 6);
      const o = document.createElement('option');
      o.value = C.chave(s);
      o.textContent = `${s.getUTCDate()} ${C.MESES_ABREV[s.getUTCMonth()]} – ${f.getUTCDate()} ${C.MESES_ABREV[f.getUTCMonth()]}`;
      sel.appendChild(o);
    }
    sel.value = estado.semana;
    sel.addEventListener('change', () => { estado.semana = sel.value; desenharLivro(); });
  }

  /* Agrupa as páginas em páginas duplas (esquerda | direita). */
  function duplas(paginas) {
    const r = [];
    let actual = null;
    for (const p of paginas) {
      if (p.lado === 'esquerda' || !actual) { actual = { esquerda: null, direita: null }; r.push(actual); }
      actual[p.lado] = p;
      if (p.lado === 'direita') actual = null;
    }
    return r;
  }

  function desenharLivro() {
    const { paginas, feriados } = gerarPreview();
    const e = env(feriados, estado.guias);
    const livro = $('#livro');
    livro.replaceChildren();
    for (const d of duplas(paginas)) {
      const bloco = document.createElement('div');
      bloco.className = 'dupla';
      for (const lado of ['esquerda', 'direita']) {
        const slot = document.createElement('div');
        slot.className = 'slot ' + lado;
        if (d[lado]) slot.appendChild(A.desenhar.pagina(d[lado], projecto(), e));
        bloco.appendChild(slot);
      }
      livro.appendChild(bloco);
    }
    ajustarEscala();
  }

  function ajustarEscala() {
    const largura = $('#livro').clientWidth - 48;
    const dupla = 296 * 96 / 25.4;
    document.documentElement.style.setProperty('--escala', Math.min(1, largura / dupla).toFixed(3));
  }

  function tudo() { desenharBarra(); desenharLivro(); }

  /* ---------- impressão ---------- */
  function prepararImpressao(imposto) {
    const p = projecto();
    const { paginas, feriados } = gerarPreview();
    const e = env(feriados, false);
    const destino = $('#impressao');
    destino.replaceChildren();
    const folha = p.impressao.folha;
    $('#estilo-pagina').textContent = imposto
      ? `@page { size: ${folha.largura}mm ${folha.altura}mm; margin: 0 }`
      : `@page { size: ${p.formato.pagina.largura}mm ${p.formato.pagina.altura}mm; margin: 0 }`;

    if (!imposto) {
      for (const pg of paginas) destino.appendChild(A.desenhar.pagina(pg, p, e));
    } else {
      const { folhas } = A.imposicao.impor(paginas.length, p.impressao.virar);
      const meia = n => {
        const m = document.createElement('div');
        m.className = 'meia';
        if (n) m.appendChild(A.desenhar.pagina(paginas[n - 1], p, e));
        return m;
      };
      for (const f of folhas) {
        for (const [face, rodar] of [[f.frente, false], [f.verso, f.rodarVerso]]) {
          const s = document.createElement('div');
          s.className = 'folha' + (rodar ? ' rodar' : '');
          Object.assign(s.style, { width: folha.largura + 'mm', height: folha.altura + 'mm' });
          s.append(meia(face[0]), meia(face[1]));
          destino.appendChild(s);
        }
      }
    }
  }

  async function imprimir(imposto) {
    prepararImpressao(imposto);
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('#impressao img')].map(i => i.decode().catch(() => {})));
    window.print();
  }

  window.addEventListener('afterprint', () => $('#impressao').replaceChildren());

  /* ?direccao=1&edicao=pioneiro&semana=2027-03-01&imprimir=imposto
     O último prepara a impressão sem abrir a janela, para gerar o PDF sem
     cliques (Edge ou Chrome com --print-to-pdf). */
  function lerParametros() {
    const q = new URLSearchParams(location.search);
    if (q.has('direccao')) estado.direccao = Math.max(0, Math.min(A.direccoes.length - 1, +q.get('direccao') || 0));
    if (q.has('edicao') && projecto().edicoes[q.get('edicao')]) estado.edicao = q.get('edicao');
    if (A.temas.some(t => t.id === q.get('cores'))) estado.tema = q.get('cores');
    if (A.letrasDesenhadas.some(l => l.fonte === q.get('letra'))) estado.letra = q.get('letra');
    if (/^\d{4}-\d{2}-\d{2}$/.test(q.get('semana') || '')) estado.semana = C.chave(C.inicioSemana(C.deChave(q.get('semana'))));
    return q.get('imprimir');
  }

  function iniciar() {
    const imprimirAgora = lerParametros();
    preencherSemanas();
    preencherLetras();
    $('#guias').checked = estado.guias;
    $('#guias').addEventListener('change', ev => { estado.guias = ev.target.checked; desenharLivro(); });
    $('#pdf-a5').addEventListener('click', () => imprimir(false));
    $('#pdf-imposto').addEventListener('click', () => imprimir(true));
    window.addEventListener('resize', ajustarEscala);
    tudo();
    document.fonts.ready.then(desenharLivro);
    if (imprimirAgora) prepararImpressao(imprimirAgora === 'imposto');
  }

  iniciar();
})();
