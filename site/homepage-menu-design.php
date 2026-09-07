<?php
// HOMEPAGE_MENU_UI_V1
// Editor do menu e da homepage. Mesmos termos do precos.php: aberto até ao
// deploy, barra de admin no topo, Save e Undo, e nada toca no site antes do
// Save.
//
// Tudo o que esta página edita sai de content/home.json, que alimenta ao mesmo
// tempo a grelha da homepage e o menu do hamburguer.
?>
<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Homepage &amp; Menu · Mia &amp; Paper</title>
<link rel="stylesheet" href="admin-nav.css?v=20260907212423">
<script src="admin-nav.js?v=20260907212423" defer></script>
<style>
  :root {
    --fundo: #14153a;        --fundo-2: #101132;
    --cartao: #1e2050;       --cartao-2: #262a63;    --campo: #171938;
    --linha: #2f3370;        --linha-forte: #3c4288;
    --texto: #ffffff;        --texto-2: #a9adde;     --texto-3: #8b8fc6;
    --azul: #4d8dff;         --ciano: #22d3ee;       --rosa: #ff4d8d;
    --verde: #2fe0a0;        --roxo: #a78bfa;        --ambar: #ffb648;
    --raio: 14px;
    --sombra: 0 1px 2px rgba(0,0,0,.35), 0 10px 30px rgba(0,0,0,.28);
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0; background: var(--fundo); color: var(--texto);
    font: 15px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3 { margin: 0; font-weight: 600; letter-spacing: -.015em; }
  code { font-family: var(--mono); font-size: .85em; color: var(--ciano); }

  .barra {
    position: sticky; top: 0; z-index: 40;
    background: rgba(20,21,58,.9); backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--linha); padding: 14px 24px;
    display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
  }
  .barra h1 { font-size: 1.1rem; margin-right: auto; }
  .conteudo { padding: 22px 24px 140px; max-width: 1180px; margin: 0 auto; }

  button {
    font: inherit; font-size: .84rem; padding: 7px 13px; border-radius: 9px;
    border: 1px solid var(--linha-forte); background: var(--cartao);
    color: var(--texto); cursor: pointer;
  }
  button:hover:not(:disabled) { background: var(--cartao-2); border-color: var(--azul); }
  button:disabled { opacity: .38; cursor: default; }
  button.primario {
    background: var(--azul); border-color: var(--azul); color: #fff; font-weight: 600;
    box-shadow: 0 4px 14px rgba(77,141,255,.32);
  }

  .separadores { display: flex; gap: 6px; margin-bottom: 20px; }
  .separadores button {
    background: none; border-color: transparent; color: var(--texto-2);
  }
  .separadores button.activo { background: var(--cartao); border-color: var(--linha-forte); color: var(--texto); }

  .cartao {
    background: var(--cartao); border: 1px solid var(--linha);
    border-radius: var(--raio); box-shadow: var(--sombra); margin-bottom: 16px; overflow: hidden;
  }
  .cartao > header {
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    padding: 13px 18px; border-bottom: 1px solid var(--linha);
    background: linear-gradient(180deg, rgba(255,255,255,.035), transparent);
  }
  .cartao > header h2 { font-size: 1rem; }
  .cartao > .corpo { padding: 15px 18px; }

  .selo {
    font-size: .68rem; padding: 3px 9px; border-radius: 999px;
    border: 1px solid var(--linha-forte); color: var(--texto-2); background: var(--campo);
  }
  .selo.mono { font-family: var(--mono); color: var(--texto-3); }
  .selo.mau { color: var(--rosa); border-color: rgba(255,77,141,.5); background: rgba(255,77,141,.12); }
  .selo.ok { color: var(--verde); border-color: rgba(47,224,160,.45); background: rgba(47,224,160,.1); }

  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 7px 9px; text-align: left; font-size: .85rem; border-bottom: 1px solid var(--linha); vertical-align: middle; }
  th { font-size: .65rem; text-transform: uppercase; letter-spacing: .09em; color: var(--texto-3); font-weight: 600; }
  tbody tr:last-child td { border-bottom: 0; }
  tbody tr:hover { background: rgba(255,255,255,.03); }

  input[type="text"], input[type="number"], select {
    font: inherit; font-size: .84rem; width: 100%; padding: 5px 8px;
    border-radius: 8px; border: 1px solid var(--linha);
    background: var(--campo); color: var(--texto);
  }
  input:focus, select:focus {
    outline: none; border-color: var(--azul); box-shadow: 0 0 0 3px rgba(77,141,255,.22);
  }
  input.sujo, select.sujo { border-color: var(--ambar); background: rgba(255,182,72,.11); color: var(--ambar); }
  input[type="checkbox"] { width: auto; accent-color: var(--azul); }
  .col-min { width: 74px; }
  .col-med { width: 160px; }

  .thumb {
    width: 46px; height: 46px; border-radius: 9px; flex: none;
    background: var(--fundo-2) center/cover no-repeat; border: 1px solid var(--linha);
    display: grid; place-items: center; font-size: .7rem; color: var(--texto-3); font-weight: 700;
  }
  .linha-flex { display: flex; align-items: center; gap: 10px; }

  /* Editor visual: cartões grandes (grupos) com mini-cartões arrastáveis. */
  .grupos { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; align-items: start; }
  .grupo {
    background: var(--cartao); border: 1px solid var(--linha); border-radius: var(--raio);
    box-shadow: var(--sombra); overflow: hidden;
  }
  .grupo > header {
    display: flex; align-items: center; gap: 8px; padding: 10px 13px;
    border-bottom: 1px solid var(--linha); background: rgba(255,255,255,.04); cursor: grab;
  }
  .grupo > header h3 { font-size: .9rem; margin-right: auto; }
  .grupo-pega, .mini-pega { color: var(--texto-3); font-size: .95rem; cursor: grab; user-select: none; }
  .grupo-itens { padding: 9px; display: flex; flex-direction: column; gap: 7px; min-height: 54px; }

  .mini {
    display: flex; align-items: center; gap: 9px; padding: 7px 9px;
    border-radius: 10px; border: 1px solid var(--linha); background: var(--campo);
  }
  .mini:hover { border-color: var(--linha-forte); }
  .mini.a-arrastar, .grupo.a-arrastar { opacity: .35; }
  .mini-thumb {
    width: 34px; height: 34px; border-radius: 7px; flex: none;
    background: var(--fundo-2) center/cover no-repeat; border: 1px solid var(--linha);
    display: grid; place-items: center; font-size: .62rem; color: var(--texto-3); font-weight: 700;
  }
  .mini-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .mini-texto input.secundario { font-size: .76rem; color: var(--texto-2); }
  .mini-slug { font-size: .68rem; color: var(--texto-3); font-family: var(--mono); }
  .mini-icone { display: flex; align-items: center; gap: 6px; }
  .mini-icone img { width: 20px; height: 20px; flex: none; filter: brightness(0) invert(1); opacity: .8; }
  .mini-icone-auto {
    font-size: .6rem; color: var(--texto-3); border: 1px dashed var(--linha-forte);
    border-radius: 5px; padding: 1px 4px; flex: none;
  }
  .mini-icone select { font-size: .72rem; padding: 2px 5px; }
  .mini-check { flex: none; display: grid; place-items: center; }

  /* O título de uma secção do menu é o nome do seu grupo (`menuGroup`). */
  .grupo-menu > header { cursor: default; }
  .grupo-menu > header .grupo-pega { cursor: grab; }
  .grupo-titulo { flex: 1; min-width: 0; font-size: .9rem; font-weight: 600; }

  /* SECCOES_HOMEPAGE_V1: o cabeçalho de uma secção da homepage é editável,
     por isso cresce para duas linhas e leva os seus próprios controlos. */
  .grupo-seccao > header { flex-wrap: wrap; align-items: flex-start; cursor: default; }
  .grupo-seccao > header .grupo-pega { cursor: grab; padding-top: 5px; }
  .seccao-campos { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .seccao-campos input.titulo { font-size: .9rem; font-weight: 700; }
  .seccao-campos input.secundario { font-size: .74rem; color: var(--texto-2); }
  .seccao-opcoes {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    width: 100%; padding-top: 8px; border-top: 1px dashed var(--linha);
    font-size: .74rem; color: var(--texto-3);
  }
  .seccao-opcoes label { display: flex; align-items: center; gap: 5px; }
  .seccao-opcoes select, .seccao-opcoes input[type="number"] { font-size: .74rem; padding: 2px 5px; width: auto; }
  .seccao-opcoes input[type="number"] { width: 54px; }
  .seccao-remover { margin-left: auto; color: var(--rosa, #ff4d8d); }
  .seccao-adicionar { margin-top: 12px; }

  .nota { font-size: .8rem; color: var(--texto-2); margin: 0 0 12px; }
  .faixa {
    border-radius: var(--raio); padding: 12px 15px; margin-bottom: 18px;
    font-size: .84rem; border: 1px solid; line-height: 1.5;
  }
  .faixa.aviso { background: rgba(255,182,72,.1); border-color: rgba(255,182,72,.42); }
  .faixa.aviso strong { color: var(--ambar); }
  .faixa.info { background: rgba(77,141,255,.1); border-color: rgba(77,141,255,.4); }
  .faixa.info strong { color: var(--azul); }

  .rodape {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
    background: rgba(30,32,80,.94); backdrop-filter: blur(10px);
    border-top: 1px solid var(--linha-forte); padding: 12px 24px;
    display: flex; gap: 12px; align-items: center;
    transform: translateY(115%); transition: transform .2s cubic-bezier(.2,.7,.3,1);
  }
  .rodape.aberta { transform: none; }
  .rodape .resumo { font-size: .85rem; color: var(--texto-2); }
  .rodape .resumo strong { color: var(--ambar); font-size: 1rem; }
  .rodape-nota { font-size: .78rem; color: var(--texto-3); margin-right: auto; }
  .rodape-nota strong { color: var(--azul); }

  #alerta { font-size: .82rem; color: var(--texto-2); }
  #alerta.ok { color: var(--verde); }
  #alerta.erro { color: var(--rosa); }

  ::-webkit-scrollbar { width: 11px; height: 11px; }
  ::-webkit-scrollbar-track { background: var(--fundo-2); }
  ::-webkit-scrollbar-thumb { background: var(--linha-forte); border-radius: 99px; border: 3px solid var(--fundo-2); }
</style>
</head>
<body>

<header class="barra admin-secondary-bar">
  <h1>Homepage &amp; Menu</h1>
  <span id="alerta"></span>
  <button id="desfazer" disabled>Undo</button>
  <button id="guardar" class="primario" disabled>Save</button>
</header>

<div class="conteudo">
  <div class="faixa aviso" id="faixaAberto" hidden>
    <strong>Editor aberto sem autenticação</strong>, nos mesmos termos da galeria e dos preços.
    Antes do deploy, pôr <code>MIA_ADMIN_OPEN</code> a <code>false</code> em <code>admin-open.php</code>.
  </div>

  <div class="separadores">
    <button data-aba="menu" class="activo">Menu</button>
    <button data-aba="homepage">Homepage</button>
  </div>

  <div id="conteudoAba"></div>
</div>

<div class="rodape" id="rodape">
  <span class="resumo" id="resumo"></span>
  <span class="rodape-nota">Nada disto toca no site até carregares em <strong>Save</strong>.</span>
  <button id="descartar">Descartar tudo</button>
</div>

<script>
(function () {
  "use strict";

  var API = "homepage-menu-api.php";
  var dados = null;
  var csrf = "";
  var fila = Object.create(null);
  var pilhaUndo = [];
  var ultimaChave = "";
  var aba = "menu";

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  // Aspa simples como constante: escrever ' dentro de strings JS geradas
  // por script é onde isto se parte sempre.
  var ASPA = String.fromCharCode(39);
  function clonar(o) { return JSON.parse(JSON.stringify(o)); }
  function alerta(t, c) { el("alerta").textContent = t; el("alerta").className = c || ""; }

  function marcarUndo(chave) {
    if (chave && ultimaChave === chave) { return; }
    ultimaChave = chave || "";
    pilhaUndo.push({ dados: clonar(dados), fila: clonar(fila) });
    if (pilhaUndo.length > 60) { pilhaUndo.shift(); }
  }

  function nPendentes() { return Object.keys(fila).length; }

  function actualizar() {
    var n = nPendentes();
    el("rodape").classList.toggle("aberta", n > 0);
    el("resumo").innerHTML = n ? "<strong>" + n + "</strong> alteraç" + (n === 1 ? "ão" : "ões") + " por gravar" : "";
    el("guardar").disabled = n === 0;
    el("guardar").textContent = n === 0 ? "Save" : "Save (" + n + ")";
    el("desfazer").disabled = pilhaUndo.length === 0;
  }

  function enfileirar(chave, operacao) {
    marcarUndo(chave);
    fila[chave] = operacao;
    actualizar();
  }

  // ── Desenho ──────────────────────────────────────────────────────────────

  function thumb(c) {
    if (c.image) { return '<span class="thumb" style="background-image:url(\'' + esc(c.image) + '\')"></span>'; }
    return '<span class="thumb">' + esc((c.id || "?").slice(0, 2).toUpperCase()) + "</span>";
  }

  function campo(c, campoNome, tipo, classe) {
    var valor = c[campoNome];
    var comum = ' data-op="categoria" data-indice="' + c.indice + '" data-campo="' + campoNome + '"'
      + ' data-original="' + esc(tipo === "bool" ? (valor ? "1" : "") : valor) + '"';
    if (tipo === "bool") {
      return '<input type="checkbox"' + (valor ? " checked" : "") + comum + ">";
    }
    if (tipo === "numero") {
      return '<input type="number" min="0" max="999" value="' + esc(valor) + '" class="' + (classe || "") + '"' + comum + ">";
    }
    return '<input type="text" value="' + esc(valor) + '" class="' + (classe || "") + '"' + comum + ">";
  }

  // ── Editor visual ────────────────────────────────────────────────────────
  // Cartão grande = grupo (a subcategoria do menu, ou a lista da homepage).
  // Mini-cartão = uma entrada. Arrasta-se dentro de um cartão, entre cartões,
  // e os próprios cartões entre si. Não há números para editar.

  // O ícone de cada entrada do menu. A lista são os PNG que existem na pasta,
  // por isso um ficheiro novo aparece aqui sozinho. Vazio = o site decide pelo
  // id, que é o comportamento de sempre.
  function selectorIcone(c) {
    var lista = dados.iconesDisponiveis || [];
    var actual = c.menuIcon || "";
    return '<span class="mini-icone">'
      + (actual
          ? '<img src="content/brand/menu-icons/line-art/' + esc(actual) + '.webp" alt="">'
          : '<span class="mini-icone-auto" title="Escolhido pelo site">auto</span>')
      + '<select data-op="categoria" data-indice="' + c.indice + '" data-campo="menuIcon"'
      + ' data-original="' + esc(actual) + '">'
      + '<option value=""' + (actual ? "" : " selected") + '>(automático)</option>'
      + lista.map(function (nome) {
          return '<option value="' + esc(nome) + '"' + (nome === actual ? " selected" : "") + '>'
            + esc(nome) + '</option>';
        }).join("")
      + '</select></span>';
  }

  function miniCartao(c, contexto) {
    return '<div class="mini" draggable="true" data-id="' + esc(c.id) + '" data-ctx="' + contexto + '">'
      + '<span class="mini-pega" aria-hidden="true">⠿</span>'
      + (c.image
          ? '<span class="mini-thumb" style="background-image:url(' + ASPA + esc(c.image) + ASPA + ')"></span>'
          : '<span class="mini-thumb vazia">' + esc((c.id || "?").slice(0, 2).toUpperCase()) + '</span>')
      + '<span class="mini-texto">'
      + '<input type="text" value="' + esc(contexto === "menu" ? c.menuTitle : c.title) + '"'
      + ' data-op="categoria" data-indice="' + c.indice + '"'
      + ' data-campo="' + (contexto === "menu" ? "menuTitle" : "title") + '"'
      + ' data-original="' + esc(contexto === "menu" ? c.menuTitle : c.title) + '">'
      + (contexto === "home"
          ? '<input type="text" class="secundario" value="' + esc(c.subtitle) + '" placeholder="subtítulo"'
            + ' data-op="categoria" data-indice="' + c.indice + '" data-campo="subtitle"'
            + ' data-original="' + esc(c.subtitle) + '">'
            + '<input type="text" class="secundario" value="' + esc(c.actionText) + '"'
            + ' placeholder="Escolher os designs →" title="Texto do botão do cartão"'
            + ' data-op="categoria" data-indice="' + c.indice + '" data-campo="actionText"'
            + ' data-original="' + esc(c.actionText) + '">'
            + '<input type="text" class="secundario" value="' + esc(c.featureLabel) + '"'
            + ' placeholder="etiqueta (só em Novidades)" title="Etiqueta por cima do título, só usada na secção Novidades"'
            + ' data-op="categoria" data-indice="' + c.indice + '" data-campo="featureLabel"'
            + ' data-original="' + esc(c.featureLabel) + '">'
          : selectorIcone(c))
      + '</span>'
      + (contexto === "home"
          ? '<label class="mini-check" title="Disponível"><input type="checkbox"' + (c.available ? " checked" : "")
            + ' data-op="categoria" data-indice="' + c.indice + '" data-campo="available"'
            + ' data-original="' + (c.available ? "1" : "") + '"></label>'
          : '<label class="mini-check" title="Esconder do menu"><input type="checkbox"' + (c.menuHidden ? " checked" : "")
            + ' data-op="categoria" data-indice="' + c.indice + '" data-campo="menuHidden"'
            + ' data-original="' + (c.menuHidden ? "1" : "") + '"></label>')
      + '</div>';
  }

  // SECCOES_HOMEPAGE_V1: uma secção da homepage é um cartão grande com o
  // cabeçalho editável. Arrasta-se para reordenar as secções na página, e os
  // mini-cartões entram e saem dela como nos grupos do menu.
  function campoSeccao(s, campoNome, classe, marcador) {
    var valor = s[campoNome] == null ? "" : s[campoNome];
    return '<input type="text" class="' + classe + '" value="' + esc(valor) + '"'
      + (marcador ? ' placeholder="' + esc(marcador) + '"' : '')
      + ' data-op="seccao" data-seccao="' + esc(s.id) + '" data-campo="' + campoNome + '"'
      + ' data-original="' + esc(valor) + '">';
  }

  function cartaoSeccao(s, itens) {
    var destaque = s.layout === "feature";

    return '<section class="grupo grupo-seccao" data-grupo="' + esc(s.id) + '" data-ctx="home"'
      + ' data-chave="' + esc(s.id) + '" draggable="true">'
      + '<header>'
      + '<span class="grupo-pega" aria-hidden="true">⠿</span>'
      + '<span class="seccao-campos">'
      + campoSeccao(s, "title", "titulo", "Título da secção")
      + campoSeccao(s, "eyebrow", "secundario", "sobretítulo (opcional)")
      + campoSeccao(s, "text", "secundario", "texto de apoio (opcional)")
      + '</span>'
      + '<span class="selo">' + itens.length + '</span>'
      + '<span class="seccao-opcoes">'
      + '<label>Aspecto'
      + '<select data-op="seccao" data-seccao="' + esc(s.id) + '" data-campo="layout"'
      + ' data-original="' + esc(s.layout) + '">'
      + '<option value="grid"' + (destaque ? "" : " selected") + '>Grelha</option>'
      + '<option value="feature"' + (destaque ? " selected" : "") + '>Destaques</option>'
      + '</select></label>'
      + (destaque
          ? '<label>Máximo<input type="number" min="1" max="12" value="' + esc(s.maxCards || 3) + '"'
            + ' data-op="seccao" data-seccao="' + esc(s.id) + '" data-campo="maxCards"'
            + ' data-original="' + esc(s.maxCards || 3) + '"></label>'
            + '<label title="Retira da grelha os cartões que já aparecem nesta secção de destaques">'
            + '<input type="checkbox"' + (!s.repeatInGrid ? " checked" : "")
            + ' data-op="seccao" data-seccao="' + esc(s.id) + '" data-campo="repeatInGrid"'
            + ' data-inverter="1" data-original="' + (!s.repeatInGrid ? "1" : "") + '">não repetir na grelha</label>'
          : "")
      + '<button class="leve seccao-remover" data-remover-seccao="' + esc(s.id) + '">Remover secção</button>'
      + '</span>'
      + '</header>'
      + '<div class="grupo-itens" data-alvo="' + esc(s.id) + '">'
      + itens.map(function (c) { return miniCartao(c, "home"); }).join('')
      + '</div></section>';
  }

  function cartaoGrupo(titulo, itens, contexto, arrastavel, chave) {
    var tituloHtml = contexto === "menu"
      ? '<input type="text" class="grupo-titulo" value="' + esc(titulo) + '"'
        + ' aria-label="Título da secção do menu" data-op="menu-grupo-titulo"'
        + ' data-original="' + esc(titulo) + '">'
      : '<h3>' + esc(titulo) + '</h3>';

    return '<section class="grupo' + (contexto === "menu" ? ' grupo-menu' : '')
      + '" data-grupo="' + esc(titulo) + '" data-ctx="' + contexto + '"'
      + (chave ? ' data-chave="' + esc(chave) + '"' : '')
      + (arrastavel ? ' draggable="true"' : '') + '>'
      + '<header>' + (arrastavel ? '<span class="grupo-pega" aria-hidden="true">⠿</span>' : '')
      + tituloHtml
      + '<span class="selo">' + itens.length + '</span></header>'
      + '<div class="grupo-itens" data-alvo="' + esc(titulo) + '">'
      + itens.map(function (c) { return miniCartao(c, contexto); }).join('')
      + '</div></section>';
  }

  // Uma operação de menu pendente pode ter mudado grupos, nomes e ordens sem
  // ainda alterar `dados`. Usa-se esta vista derivada ao redesenhar a aba para
  // que uma herança ou uma edição do título não desapareça ao trocar de aba.
  function categoriasDoMenuPendente() {
    var op = fila["ordem-menu"];
    var porId = {};
    var vistas = {};
    var resultado = [];

    if (!op || !Array.isArray(op.grupos)) { return dados.categorias.slice(); }

    dados.categorias.forEach(function (c) { porId[c.id] = c; });
    op.grupos.forEach(function (grupo, indiceGrupo) {
      var nome = String(grupo.nome == null ? "" : grupo.nome);
      (Array.isArray(grupo.itens) ? grupo.itens : []).forEach(function (id, indiceItem) {
        var base = porId[String(id)];
        if (!base || vistas[base.id]) { return; }
        var copia = Object.assign({}, base);
        copia.menuGroup = nome;
        copia.menuGroupOrder = indiceGrupo + 1;
        copia.menuOrder = indiceItem + 1;
        resultado.push(copia);
        vistas[base.id] = true;
      });
    });

    // Se a fila estiver incompleta por causa de uma operação antiga, não se
    // perde nenhum cartão no editor. A API continua a validar a lista completa.
    dados.categorias.forEach(function (c) {
      if (!vistas[c.id]) { resultado.push(c); }
    });
    return resultado;
  }

  function abaMenu() {
    var grupos = {};
    var ordem = [];
    categoriasDoMenuPendente().sort(function (a, b) {
      return (a.menuGroupOrder || 0) - (b.menuGroupOrder || 0) || (a.menuOrder || 0) - (b.menuOrder || 0);
    }).forEach(function (c) {
      var g = c.menuGroup || "(sem grupo)";
      if (!grupos[g]) { grupos[g] = []; ordem.push(g); }
      grupos[g].push(c);
    });

    var html = '<div class="faixa info"><strong>Arrasta para ordenar.</strong> '
      + 'Os mini-cartões movem-se dentro de um grupo e entre grupos; os grupos movem-se entre si. '
      + 'Esta ordem é só do menu — a da homepage é independente.</div>';

    html += '<section class="cartao"><header><h2>Definições do menu</h2>'
      + '<button class="leve" data-herdar="menu">Herdar ordem, títulos e visibilidade da homepage</button></header>'
      + '<div class="corpo">'
      + '<label class="linha-flex"><input type="checkbox" data-op="menu-accordion"'
      + (dados.menuAccordion ? " checked" : "") + ' data-original="' + (dados.menuAccordion ? "1" : "") + '">'
      + '<span>Abrir uma secção fecha as outras (acordeão)</span></label>'
      + '<label class="linha-flex"><input type="checkbox" data-op="menu-open-all"'
      + (dados.menuOpenAll ? " checked" : "") + ' data-original="' + (dados.menuOpenAll ? "1" : "") + '">'
      + '<span>Abrir todas as secções ao abrir o hamburguer</span></label>'
      + '<label class="linha-flex"><input type="checkbox" data-op="menu-icones"'
      + (dados.menuShowIcons ? " checked" : "") + ' data-original="' + (dados.menuShowIcons ? "1" : "") + '">'
      + '<span>Mostrar os ícones ao lado de cada entrada</span></label>'
      + '</div></section>';

    html += '<div class="grupos" data-ctx="menu">'
      + ordem.map(function (g) { return cartaoGrupo(g, grupos[g], "menu", true); }).join('')
      + '</div>';
    return html;
  }

  function abaHomepage() {
    // SECCOES_HOMEPAGE_V1: as secções são dados, por isso acrescentam-se,
    // removem-se e reordenam-se aqui. Cada cartão grande é uma secção da
    // página; arrastar um mini-cartão entre elas muda a secção onde aparece.
    var seccoes = dados.seccoes || [];
    var refugio = "";
    var porSeccao = {};

    seccoes.forEach(function (s) {
      porSeccao[s.id] = [];
      if (!refugio && s.layout !== "feature") { refugio = s.id; }
    });
    if (!refugio && seccoes.length) { refugio = seccoes[0].id; }

    dados.categorias.forEach(function (c) {
      var id = porSeccao[c.section] ? c.section : refugio;
      if (porSeccao[id]) { porSeccao[id].push(c); }
    });

    var html = '<div class="faixa info"><strong>Cada cartão grande é uma secção da homepage.</strong> '
      + 'Arrasta as secções para as ordenar na página e os mini-cartões para os mudar de secção. '
      + 'É independente do menu.</div>';

    html += '<section class="cartao"><header><h2>Ordem</h2>'
      + '<button class="leve" data-herdar="home">Herdar a ordem do menu</button></header></section>';

    html += '<div class="grupos" data-ctx="home">'
      + seccoes.map(function (s) { return cartaoSeccao(s, porSeccao[s.id] || []); }).join('')
      + '</div>'
      + '<button class="leve seccao-adicionar" data-adicionar-seccao>+ Adicionar secção</button>';
    return html;
  }

  // Redesenhar reconstrói os campos a partir do `dados`, que não acompanha as
  // edições por gravar — sem isto, acrescentar uma secção fazia as alterações
  // pendentes desaparecerem do ecrã sem saírem da fila.
  function reaplicarFila() {
    Object.keys(fila).forEach(function (chave) {
      var o = fila[chave];
      var selector = "";

      if (o.op === "categoria") {
        selector = '[data-op="categoria"][data-indice="' + o.indice + '"][data-campo="' + o.campo + '"]';
      } else if (o.op === "seccao") {
        selector = '[data-op="seccao"][data-seccao="' + o.seccao + '"][data-campo="' + o.campo + '"]';
      } else {
        return;
      }
      [].forEach.call(document.querySelectorAll(selector), function (campo) {
        if (campo.type === "checkbox") {
          campo.checked = campo.dataset.inverter === "1" ? !o.valor : !!o.valor;
        } else {
          campo.value = o.valor;
        }
        campo.classList.add("sujo");
      });
    });
  }

  function desenhar() {
    el("faixaAberto").hidden = !dados.aberto;
    el("conteudoAba").innerHTML = aba === "menu" ? abaMenu() : abaHomepage();
    [].forEach.call(document.querySelectorAll(".separadores button"), function (b) {
      b.classList.toggle("activo", b.dataset.aba === aba);
    });
    reaplicarFila();
    actualizar();
  }

  // ── Edição ───────────────────────────────────────────────────────────────

  function tratar(evento) {
    var alvo = evento.target;
    if (!alvo.dataset || !alvo.dataset.op) { return; }
    var op = alvo.dataset.op;
    var eBool = alvo.type === "checkbox";
    var valorVisivel = eBool ? alvo.checked : alvo.value;
    var valor = eBool && alvo.dataset.inverter === "1" ? !valorVisivel : valorVisivel;
    var original = alvo.dataset.original;
    var igual = eBool ? ((original === "1") === valorVisivel) : (String(original) === String(valor));

    alvo.classList.toggle("sujo", !igual);

    if (op === "menu-icones") {
      var chaveI = "menu-icones";
      if (igual) { delete fila[chaveI]; actualizar(); return; }
      enfileirar(chaveI, { op: "menu-icones", valor: valor });
      return;
    }
    if (op === "menu-accordion") {
      var chaveA = "menu-accordion";
      if (igual) { delete fila[chaveA]; actualizar(); return; }
      enfileirar(chaveA, { op: "menu-accordion", valor: valor });
      return;
    }
    if (op === "menu-open-all") {
      var chaveO = "menu-open-all";
      if (igual) { delete fila[chaveO]; actualizar(); return; }
      enfileirar(chaveO, { op: "menu-open-all", valor: valor });
      return;
    }
    if (op === "menu-grupo-titulo") {
      // O nome do grupo é enviado juntamente com a ordem completa do menu,
      // para que todos os itens desse grupo recebam o novo título no Save.
      guardarOrdemDoDom("menu");
      return;
    }
    if (op === "seccao") {
      var chaveS = "seccao:" + alvo.dataset.seccao + ":" + alvo.dataset.campo;
      if (igual) { delete fila[chaveS]; actualizar(); return; }
      enfileirar(chaveS, {
        op: "seccao", seccao: alvo.dataset.seccao, campo: alvo.dataset.campo, valor: valor
      });
      // Mudar o aspecto muda os controlos que a secção mostra (máximo,
      // repetir na grelha), por isso vale a pena redesenhar já.
      if (alvo.dataset.campo === "layout") {
        dados.seccoes.forEach(function (s) {
          if (s.id === alvo.dataset.seccao) { s.layout = valor; }
        });
        desenhar();
      }
      return;
    }
    if (op === "categoria") {
      var chaveC = "cat:" + alvo.dataset.indice + ":" + alvo.dataset.campo;
      if (igual) { delete fila[chaveC]; actualizar(); return; }
      enfileirar(chaveC, {
        op: "categoria", indice: parseInt(alvo.dataset.indice, 10),
        campo: alvo.dataset.campo, valor: valor
      });
    }
  }

  document.addEventListener("input", tratar);
  document.addEventListener("change", tratar);

  // ── Arrastar ─────────────────────────────────────────────────────────────
  // Um só handler para mini-cartões e para grupos. O DOM é a verdade enquanto
  // se arrasta; ao largar, lê-se o DOM e enfileira-se a ordem inteira.

  var aArrastar = null;

  document.addEventListener("dragstart", function (evento) {
    // Os cabeçalhos das secções têm campos de texto: seleccionar texto lá
    // dentro não pode arrastar a secção inteira.
    if (evento.target.closest && evento.target.closest("input, select, textarea, button")) {
      evento.preventDefault();
      return;
    }
    var mini = evento.target.closest ? evento.target.closest(".mini") : null;
    var grupo = evento.target.closest ? evento.target.closest(".grupo") : null;
    aArrastar = mini || grupo;
    if (!aArrastar) { return; }
    aArrastar.classList.add("a-arrastar");
    evento.dataTransfer.effectAllowed = "move";
    evento.dataTransfer.setData("text/plain", "x");
  });

  document.addEventListener("dragover", function (evento) {
    if (!aArrastar) { return; }
    evento.preventDefault();

    if (aArrastar.classList.contains("mini")) {
      var caixa = evento.target.closest(".grupo-itens");
      if (!caixa) { return; }
      var sobre = evento.target.closest(".mini");
      if (sobre === aArrastar) { return; }
      if (!sobre) { caixa.appendChild(aArrastar); return; }
      var r = sobre.getBoundingClientRect();
      caixa.insertBefore(aArrastar, (evento.clientY - r.top) / r.height > 0.5 ? sobre.nextSibling : sobre);
      return;
    }

    var sobreGrupo = evento.target.closest(".grupo");
    if (!sobreGrupo || sobreGrupo === aArrastar) { return; }
    var pai = sobreGrupo.parentNode;
    var rg = sobreGrupo.getBoundingClientRect();
    pai.insertBefore(aArrastar, (evento.clientY - rg.top) / rg.height > 0.5 ? sobreGrupo.nextSibling : sobreGrupo);
  });

  document.addEventListener("drop", function (evento) {
    if (aArrastar) { evento.preventDefault(); }
  });

  document.addEventListener("dragend", function () {
    if (!aArrastar) { return; }
    aArrastar.classList.remove("a-arrastar");
    var contexto = aArrastar.closest(".grupos") ? aArrastar.closest(".grupos").dataset.ctx : aba;
    aArrastar = null;
    guardarOrdemDoDom(contexto);
  });

  // Lê o DOM e enfileira a ordem completa — uma operação, não uma por linha.
  function guardarOrdemDoDom(contexto) {
    if (contexto === "home") {
      // SECCOES_HOMEPAGE_V1: uma só operação leva a ordem das secções, a ordem
      // dos cartões e a secção de cada um — arrastar mexe nas três coisas ao
      // mesmo tempo, e separá-las deixaria estados intermédios inválidos.
      var seccoes = [].map.call(document.querySelectorAll('.grupos[data-ctx="home"] .grupo'), function (g) {
        return {
          id: g.dataset.chave,
          itens: [].map.call(g.querySelectorAll(".mini"), function (m) { return m.dataset.id; })
        };
      });
      enfileirar("ordem-homepage", { op: "ordem-homepage", seccoes: seccoes });
      return;
    }

    var grupos = [].map.call(document.querySelectorAll('.grupos[data-ctx="menu"] .grupo'), function (g) {
      var titulo = g.querySelector(".grupo-titulo");
      return {
        nome: titulo ? titulo.value : g.dataset.grupo,
        itens: [].map.call(g.querySelectorAll(".mini"), function (m) { return m.dataset.id; })
      };
    }).filter(function (g) { return g.itens.length; });

    enfileirar("ordem-menu", { op: "ordem-menu", grupos: grupos });
  }

  function seccoesParaHeranca() {
    return (dados.seccoes || []).map(function (s) {
      var copia = Object.assign({}, s);
      var pendente = fila["seccao:" + s.id + ":title"];
      if (pendente && pendente.op === "seccao" && pendente.campo === "title") {
        copia.title = pendente.valor;
      }
      return copia;
    });
  }

  // A ordem da homepage pode ter sido arrastada mas ainda não gravada. Nesse
  // caso, a herança deve usar essa ordem e essas secções, e não o JSON antigo.
  function categoriasDaHomepageParaHeranca() {
    var porId = {};
    var vistas = {};
    var resultado = [];
    var op = fila["ordem-homepage"];

    dados.categorias.forEach(function (c) { porId[c.id] = c; });

    if (op && Array.isArray(op.seccoes)) {
      op.seccoes.forEach(function (bloco) {
        var sid = String(bloco.id == null ? "" : bloco.id);
        (Array.isArray(bloco.itens) ? bloco.itens : []).forEach(function (id) {
          var base = porId[String(id)];
          if (!base || vistas[base.id]) { return; }
          var copia = Object.assign({}, base);
          copia.section = sid;
          resultado.push(copia);
          vistas[base.id] = true;
        });
      });
    } else if (op && Array.isArray(op.ids)) {
      op.ids.forEach(function (id) {
        var base = porId[String(id)];
        if (!base || vistas[base.id]) { return; }
        resultado.push(base);
        vistas[base.id] = true;
      });
    }

    dados.categorias.forEach(function (c) {
      if (!vistas[c.id]) { resultado.push(c); }
    });
    return resultado.length ? resultado : dados.categorias.slice();
  }

  // A herança do menu usa a mesma divisão que a homepage: cada grupo recebe o
  // título da secção correspondente e os cartões conservam a ordem em que
  // aparecem nessa secção. Títulos vazios usam o id, porque a API não aceita
  // um grupo de menu sem nome.
  function ordemMenuDaHomepage() {
    var seccoes = seccoesParaHeranca();
    var porId = {};
    var refugio = "";
    var grupos = {};
    var ordem = [];

    seccoes.forEach(function (s) {
      var id = String(s.id);
      porId[id] = s;
      if (!refugio && s.layout !== "feature") { refugio = id; }
    });
    if (!refugio && seccoes.length) { refugio = String(seccoes[0].id); }

    categoriasDaHomepageParaHeranca().forEach(function (c) {
      var id = porId[c.section] ? String(c.section) : refugio;
      var s = porId[id];
      var nome = String(s && s.title != null ? s.title : id).trim() || id || "Produtos";
      if (!grupos[nome]) {
        grupos[nome] = { nome: nome, itens: [] };
        ordem.push(nome);
      }
      grupos[nome].itens.push(c.id);
    });
    return ordem.map(function (nome) { return grupos[nome]; });
  }

  // SECCOES_HOMEPAGE_V1: acrescentar e remover secções. Ambas mexem no
  // `dados` local e redesenham, para o cartão aparecer/desaparecer já; a
  // gravação continua a ser só no Save.
  document.addEventListener("click", function (evento) {
    var remover = evento.target.closest ? evento.target.closest("[data-remover-seccao]") : null;
    var adicionar = evento.target.closest ? evento.target.closest("[data-adicionar-seccao]") : null;
    var titulo;
    var id;

    if (remover) {
      id = remover.dataset.removerSeccao;
      if (dados.seccoes.filter(function (s) { return s.layout !== "feature"; }).length < 2
          && (dados.seccoes.filter(function (s) { return s.id === id; })[0] || {}).layout !== "feature") {
        alerta("Tem de sobrar uma secção em grelha: é para onde vão os cartões das secções removidas.", "erro");
        return;
      }
      if (!window.confirm("Remover a secção? Os cartões dela passam para a primeira grelha.")) { return; }
      dados.seccoes = dados.seccoes.filter(function (s) { return s.id !== id; });
      enfileirar("seccao-remover:" + id, { op: "seccao-remover", seccao: id });
      desenhar();
      return;
    }

    if (adicionar) {
      titulo = (window.prompt("Título da secção nova:") || "").trim();
      if (!titulo) { return; }
      // O id sai do título, mas tem de ser único: é ele a âncora (#id) e a
      // chave que liga cada cartão à sua secção. Os acentos saem antes de
      // limpar o resto, senão "Verão" dava "ver-o".
      id = titulo.toLowerCase()
        .replace(/[áàâãä]/g, "a").replace(/[éèêë]/g, "e").replace(/[íìîï]/g, "i")
        .replace(/[óòôõö]/g, "o").replace(/[úùûü]/g, "u").replace(/ç/g, "c")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "seccao";
      while (dados.seccoes.filter(function (s) { return s.id === id; }).length) {
        id += "-2";
      }
      dados.seccoes.push({ id: id, layout: "grid", title: titulo, eyebrow: "", text: "" });
      enfileirar("seccao-adicionar:" + id, { op: "seccao-adicionar", seccao: id, titulo: titulo });
      desenhar();
      return;
    }
  });

  // Herdar a ordem do outro separador.
  document.addEventListener("click", function (evento) {
    var botao = evento.target.closest ? evento.target.closest("[data-herdar]") : null;
    if (!botao) { return; }

    if (botao.dataset.herdar === "menu") {
      if (!window.confirm("Pôr o menu pela mesma ordem da homepage, com os títulos das suas secções e a mesma visibilidade?")) { return; }
      // A ordem, a divisão em grupos e os títulos usam também alterações da
      // homepage ainda não gravadas.
      marcarUndo("herdar-menu");
      dados.categorias.forEach(function (c) {
        var pendente = fila["cat:" + c.indice + ":available"];
        var disponivel = pendente ? !!pendente.valor : !!c.available;
        var esconder = !disponivel;
        var chave = "cat:" + c.indice + ":menuHidden";

        if (!!c.menuHidden === esconder) {
          delete fila[chave];
        } else {
          fila[chave] = {
            op: "categoria", indice: c.indice, campo: "menuHidden", valor: esconder
          };
        }
      });
      fila["ordem-menu"] = {
        op: "ordem-menu",
        grupos: ordemMenuDaHomepage()
      };
      desenhar();
      alerta("O menu passou a seguir a ordem, os títulos e a visibilidade da homepage. Falta gravar.", "ok");
      return;
    }

    if (!window.confirm("Pôr a homepage pela mesma ordem do menu?")) { return; }
    var ordenadas = dados.categorias.slice().sort(function (a, b) {
      return (a.menuGroupOrder || 0) - (b.menuGroupOrder || 0) || (a.menuOrder || 0) - (b.menuOrder || 0);
    });
    enfileirar("ordem-homepage", {
      op: "ordem-homepage",
      ids: ordenadas.map(function (c) { return c.id; })
    });
    alerta("A homepage passou a seguir a ordem do menu. Falta gravar.", "ok");
  });

  document.addEventListener("click", function (evento) {
    var b = evento.target.closest ? evento.target.closest(".separadores button") : null;
    if (!b) { return; }
    aba = b.dataset.aba;
    desenhar();
  });

  // ── Gravar ───────────────────────────────────────────────────────────────

  el("guardar").addEventListener("click", function () {
    var lista = Object.keys(fila).map(function (k) { return fila[k]; });
    if (!lista.length) { return; }
    el("guardar").disabled = true;
    alerta("A gravar…");

    fetch(API + "?action=save", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Admin-CSRF": csrf },
      body: JSON.stringify({ alteracoes: lista })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) { alerta(d.erro || "Não gravou.", "erro"); actualizar(); return; }
      csrf = d.csrf || csrf;
      dados = d; fila = Object.create(null); pilhaUndo = []; ultimaChave = "";
      desenhar();
      alerta("Gravado.", "ok");
    }).catch(function (e) { alerta(e.message, "erro"); actualizar(); });
  });

  el("desfazer").addEventListener("click", function () {
    var anterior = pilhaUndo.pop();
    if (!anterior) { return; }
    dados = anterior.dados; fila = anterior.fila; ultimaChave = "";
    desenhar();
    alerta("Desfeito.", "");
  });

  el("descartar").addEventListener("click", function () {
    if (!window.confirm("Descartar todas as alterações por gravar?")) { return; }
    pilhaUndo = []; carregar();
  });

  document.addEventListener("keydown", function (evento) {
    if (!(evento.ctrlKey || evento.metaKey)) { return; }
    if (evento.key === "z" || evento.key === "Z") { evento.preventDefault(); el("desfazer").click(); }
    if (evento.key === "s" || evento.key === "S") { evento.preventDefault(); el("guardar").click(); }
  });

  window.addEventListener("beforeunload", function (evento) {
    if (nPendentes()) { evento.preventDefault(); evento.returnValue = ""; }
  });

  function carregar() {
    alerta("A carregar…");
    return fetch(API + "?action=data", { cache: "no-store", credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { throw new Error(d.erro || "Falha a carregar."); }
        csrf = d.csrf || "";
        dados = d; fila = Object.create(null); ultimaChave = "";
        desenhar();
        alerta(dados.categorias.length + " categorias carregadas.", "ok");
      })
      .catch(function (e) { alerta(e.message, "erro"); });
  }

  carregar();
}());
</script>
</body>
</html>