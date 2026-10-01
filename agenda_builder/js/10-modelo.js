/* 10 · Modelo — o projecto aberto, desfazer/refazer, gravação automática e a API. */
(function () {
  'use strict';
  const A = window.Agenda;
  const M = A.modelo = {};

  let projecto = null;
  let desfazer = [], refazer = [];
  let ultimaJuncao = null;
  let temporizador = null;
  const ouvintes = new Set();
  M.estadoGravacao = 'gravado';

  /* ---------- API ---------- */
  async function api(accao, opcoes = {}) {
    const q = new URLSearchParams(Object.assign({ accao }, opcoes.query || {}));
    const pedido = { method: opcoes.corpo || opcoes.formulario ? 'POST' : 'GET', headers: { 'X-Agendas': '1' } };
    if (opcoes.corpo) {
      pedido.headers['Content-Type'] = 'application/json';
      pedido.body = JSON.stringify(opcoes.corpo);
    }
    if (opcoes.formulario) pedido.body = opcoes.formulario;
    const r = await fetch('api.php?' + q, pedido);
    const dados = await r.json().catch(() => ({ erro: 'Resposta inválida do servidor.' }));
    if (!r.ok || dados.erro) throw new Error(dados.erro || 'Erro ' + r.status);
    return dados;
  }
  M.api = api;

  /* ---------- ids ---------- */
  M.novoId = prefixo => (prefixo || 'e') + Math.random().toString(36).slice(2, 8);

  /* Dá ids aos elementos que não os têm e garante a forma mínima do projecto. */
  /* Um objecto vazio gravado por uma versão antiga pode ter voltado como lista. */
  const objecto = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});

  function normalizar(p) {
    p.biblioteca = objecto(p.biblioteca);
    p.biblioteca.fontes = objecto(p.biblioteca.fontes);
    p.biblioteca.imagens = objecto(p.biblioteca.imagens);
    p.estilos.texto = objecto(p.estilos.texto);
    for (const [chave, molde] of Object.entries(p.moldes)) {
      molde.nome = molde.nome || chave;
      const vistos = new Set();
      for (const el of molde.elementos) {
        if (!el.id || vistos.has(el.id)) el.id = M.novoId();
        vistos.add(el.id);
      }
    }
    for (const ed of Object.values(p.edicoes)) {
      ed.excepcoes = objecto(ed.excepcoes);
      ed.textos = objecto(ed.textos);
      for (const exc of Object.values(ed.excepcoes)) if (exc.alterar) exc.alterar = objecto(exc.alterar);
      ed.feriados = ed.feriados || ['pt'];
    }
    p.sequencia.forEach(b => { b.id = b.id || M.novoId('b'); });
    return p;
  }

  /* Um projecto novo a partir de um modelo (as direcções de 08-direccoes.js). */
  M.criarDeModelo = function (modelo, id, nome) {
    const p = JSON.parse(JSON.stringify(modelo));
    p.id = id;
    p.nome = nome;
    return normalizar(p);
  };

  M.obter = () => projecto;

  M.carregar = function (p) {
    projecto = normalizar(p);
    desfazer = []; refazer = []; ultimaJuncao = null;
    A.biblioteca && A.biblioteca.registarFontes(projecto);
    avisar();
  };

  M.ouvir = fn => ouvintes.add(fn);
  function avisar() { for (const fn of ouvintes) fn(); }

  /* Todas as alterações passam por aqui. "juntar" agrupa alterações seguidas
     do mesmo controlo num só passo de desfazer (ex.: arrastar um número). */
  M.alterar = function (fn, juntar) {
    const agora = Date.now();
    const continua = juntar && ultimaJuncao && ultimaJuncao.chave === juntar && agora - ultimaJuncao.quando < 1500;
    if (!continua) {
      desfazer.push(JSON.stringify(projecto));
      if (desfazer.length > 150) desfazer.shift();
    }
    ultimaJuncao = juntar ? { chave: juntar, quando: agora } : null;
    refazer = [];
    fn(projecto);
    agendarGravacao();
    avisar();
  };

  /* Troca o projecto inteiro (ex.: repor uma versão), num passo que se desfaz. */
  M.substituir = function (novo) {
    desfazer.push(JSON.stringify(projecto));
    refazer = [];
    ultimaJuncao = null;
    projecto = normalizar(novo);
    agendarGravacao();
    avisar();
  };

  M.podeDesfazer = () => desfazer.length > 0;
  M.podeRefazer = () => refazer.length > 0;

  M.desfazer = function () {
    if (!desfazer.length) return;
    refazer.push(JSON.stringify(projecto));
    projecto = JSON.parse(desfazer.pop());
    ultimaJuncao = null;
    agendarGravacao();
    avisar();
  };

  M.refazer = function () {
    if (!refazer.length) return;
    desfazer.push(JSON.stringify(projecto));
    projecto = JSON.parse(refazer.pop());
    ultimaJuncao = null;
    agendarGravacao();
    avisar();
  };

  /* ---------- gravação ---------- */
  function mudarEstado(e) {
    M.estadoGravacao = e;
    document.dispatchEvent(new CustomEvent('agendas:gravacao', { detail: e }));
  }

  function agendarGravacao() {
    mudarEstado('por gravar');
    clearTimeout(temporizador);
    temporizador = setTimeout(M.gravar, 1200);
  }

  M.gravar = async function () {
    clearTimeout(temporizador);
    if (!projecto) return;
    mudarEstado('a gravar');
    try {
      await api('gravar', { corpo: { id: projecto.id, projecto } });
      mudarEstado('gravado');
    } catch (e) {
      mudarEstado('erro');
      console.error(e);
    }
  };

  window.addEventListener('beforeunload', ev => {
    if (M.estadoGravacao !== 'gravado') { M.gravar(); ev.preventDefault(); }
  });
})();
