/* 16 · Arranque — abre o último projecto (ou cria o primeiro) e liga tudo. */
(function () {
  'use strict';
  const A = window.Agenda;
  const M = A.modelo, E = A.editor, P = A.paineis;
  const $ = s => document.querySelector(s);
  const ULTIMO = 'agendas:ultimo-projecto';

  function lembrar(id) { try { localStorage.setItem(ULTIMO, id); } catch (e) { /* sem armazenamento */ } }
  function lembrado() { try { return localStorage.getItem(ULTIMO); } catch (e) { return null; } }

  async function abrir(id) {
    if (M.obter() && M.estadoGravacao !== 'gravado') await M.gravar();
    const { projecto } = await M.api('abrir', { query: { id } });
    M.carregar(projecto);
    E.estado.edicao = Object.keys(projecto.edicoes)[0];
    E.estado.pagina = 0;
    E.estado.seleccao = null;
    lembrar(id);
    await preencherProjectos();
    E.redesenhar();
  }

  async function criar(modelo) {
    const { projectos } = await M.api('listar');
    let n = projectos.length + 1, id;
    do { id = 'agenda-' + n++; } while (projectos.some(p => p.id === id));
    const p = M.criarDeModelo(modelo, id, 'Agenda nova');
    await M.api('gravar', { corpo: { id, projecto: p } });
    await abrir(id);
  }

  async function preencherProjectos() {
    const sel = $('#projectos');
    const { projectos } = await M.api('listar');
    sel.replaceChildren();
    const abrirGrupo = document.createElement('optgroup');
    abrirGrupo.label = 'Abrir';
    for (const p of projectos) {
      const o = document.createElement('option');
      o.value = 'abrir:' + p.id;
      o.textContent = p.nome || p.id;
      abrirGrupo.appendChild(o);
    }
    const novo = document.createElement('optgroup');
    novo.label = 'Nova agenda a partir de';
    A.direccoes.forEach((d, i) => {
      const o = document.createElement('option');
      o.value = 'novo:' + i;
      o.textContent = d.nome;
      novo.appendChild(o);
    });
    sel.append(abrirGrupo, novo);
    sel.value = 'abrir:' + M.obter().id;
  }

  async function iniciar() {
    E.iniciar();
    P.iniciar();
    $('#projectos').addEventListener('change', async ev => {
      const [accao, valor] = ev.target.value.split(':');
      if (accao === 'abrir') await abrir(valor);
      else await criar(A.direccoes[+valor]);
    });
    try {
      const { projectos } = await M.api('listar');
      if (!projectos.length) return criar(A.direccoes[0]);
      const q = new URLSearchParams(location.search);
      const pedido = q.get('projecto');
      const id = projectos.some(p => p.id === pedido) ? pedido
        : projectos.some(p => p.id === lembrado()) ? lembrado() : projectos[0].id;
      await abrir(id);
      // ?projecto=agenda-1&pdf=publicador&imposto=1&paginas=380-381 prepara o PDF
      // sem abrir a janela (para o Edge/Chrome com --print-to-pdf).
      const ed = q.get('pdf');
      if (ed && M.obter().edicoes[ed]) {
        const m = /^(\d+)-(\d+)$/.exec(q.get('paginas') || '');
        A.exportar.semJanela = true;
        await A.exportar.preparar(ed, q.get('imposto') === '1', m ? [+m[1], +m[2]] : null);
        document.body.dataset.pronto = '1';
      }
    } catch (e) {
      document.body.classList.add('sem-servidor');
      $('#palco').textContent = 'Não consegui falar com o servidor. Abre o editor pelo servidor-rede.bat.';
      console.error(e);
    }
  }

  iniciar();
})();
