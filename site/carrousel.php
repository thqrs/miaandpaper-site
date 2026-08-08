<?php
// CARROUSEL_UI_V1
// Editor dos carrosséis dos cartões da homepage. Mesmos termos do precos.php e
// do homepage-menu-design.php: aberto até ao deploy, barra de admin no topo,
// Save e Undo, e nada toca no site antes do Save.
//
// Um separador por cartão, mais um separador Global. Cada imagem é um slide com
// os seus parâmetros; deixar um campo vazio faz esse valor herdar do Global —
// é assim que mexer no Global chega a todos os carrosséis de uma vez.
?>
<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Carrosséis · Mia &amp; Paper</title>
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
  a { color: var(--azul); }

  .barra-admin {
    display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
    padding: 8px 24px; background: var(--fundo-2); border-bottom: 1px solid var(--linha);
  }
  .barra-admin strong {
    font-size: .74rem; color: var(--texto-3); margin-right: 10px;
    text-transform: uppercase; letter-spacing: .09em;
  }
  .barra-admin a {
    font-size: .8rem; color: var(--texto-2); text-decoration: none;
    padding: 4px 10px; border-radius: 7px; white-space: nowrap;
  }
  .barra-admin a:hover { background: var(--cartao); color: var(--texto); }
  .barra-admin a.activo { background: var(--azul); color: #fff; font-weight: 600; }

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
  button.leve { background: none; border-color: var(--linha); color: var(--texto-2); }
  button.perigo { color: var(--rosa); border-color: rgba(255,77,141,.4); }

  .separadores {
    display: flex; gap: 6px; margin-bottom: 20px; flex-wrap: wrap;
    padding-bottom: 4px;
  }
  .separadores button {
    background: none; border-color: transparent; color: var(--texto-2);
    display: inline-flex; align-items: center; gap: 7px;
  }
  .separadores button.activo { background: var(--cartao); border-color: var(--linha-forte); color: var(--texto); }
  .separadores button.global { color: var(--ciano); }
  .separadores .conta {
    font-size: .66rem; padding: 1px 6px; border-radius: 999px;
    background: var(--campo); border: 1px solid var(--linha); color: var(--texto-3);
  }
  .separadores .mini-thumb {
    width: 20px; height: 20px; border-radius: 5px; flex: none;
    background: var(--fundo-2) center/cover no-repeat; border: 1px solid var(--linha);
  }
  .separadores button.apagado { opacity: .5; }

  .cartao {
    background: var(--cartao); border: 1px solid var(--linha);
    border-radius: var(--raio); box-shadow: var(--sombra); margin-bottom: 16px; overflow: hidden;
  }
  .cartao > header {
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    padding: 13px 18px; border-bottom: 1px solid var(--linha);
    background: linear-gradient(180deg, rgba(255,255,255,.035), transparent);
  }
  .cartao > header h2 { font-size: 1rem; margin-right: auto; }
  .cartao > .corpo { padding: 15px 18px; }

  .selo {
    font-size: .68rem; padding: 3px 9px; border-radius: 999px;
    border: 1px solid var(--linha-forte); color: var(--texto-2); background: var(--campo);
  }
  .selo.mono { font-family: var(--mono); color: var(--texto-3); }

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
  label.linha-flex { display: flex; align-items: center; gap: 8px; font-size: .84rem; }

  /* Grelha de parâmetros: a mesma no Global e em cada imagem, para se ler do
     mesmo jeito nos dois sítios. */
  .params { display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 10px; }
  .params label { display: flex; flex-direction: column; gap: 4px; font-size: .7rem; color: var(--texto-3); }
  .params label span { text-transform: uppercase; letter-spacing: .06em; }

  /* Uma imagem do carrossel. */
  .slide {
    display: grid; grid-template-columns: 108px minmax(0, 1fr) auto; gap: 13px;
    padding: 13px; border: 1px solid var(--linha); border-radius: 12px;
    background: var(--campo); margin-bottom: 10px; align-items: start;
  }
  .slide.a-arrastar { opacity: .35; }
  .slide-preview {
    width: 108px; height: 76px; border-radius: 9px; overflow: hidden;
    background: var(--fundo-2) center/cover no-repeat; border: 1px solid var(--linha);
    display: grid; place-items: center; font-size: .66rem; color: var(--texto-3);
  }
  .slide-corpo { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .slide-accoes { display: flex; flex-direction: column; gap: 6px; }
  .slide-accoes button { padding: 4px 9px; font-size: .74rem; }
  .slide-pega { cursor: grab; color: var(--texto-3); user-select: none; text-align: center; }
  .slide-num {
    font-size: .66rem; color: var(--texto-3); font-family: var(--mono);
  }

  .faixa {
    padding: 11px 15px; border-radius: 11px; margin-bottom: 16px;
    font-size: .84rem; border: 1px solid var(--linha);
  }
  .faixa.info { background: rgba(77,141,255,.1); border-color: rgba(77,141,255,.32); color: #cfe0ff; }
  .faixa.aviso { background: rgba(255,182,72,.1); border-color: rgba(255,182,72,.34); color: #ffdfa8; }

  .rodape {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
    display: flex; gap: 12px; align-items: center; padding: 12px 24px;
    background: rgba(16,17,50,.96); border-top: 1px solid var(--linha);
    backdrop-filter: blur(10px); transform: translateY(105%);
    transition: transform .18s ease;
  }
  .rodape.aberta { transform: none; }
  .rodape .resumo { font-size: .84rem; color: var(--texto-2); }
  .rodape-nota { font-size: .78rem; color: var(--texto-3); margin-right: auto; }

  #alerta { font-size: .82rem; }
  #alerta.ok { color: var(--verde); }
  #alerta.erro { color: var(--rosa); }

  @media (max-width: 720px) {
    .slide { grid-template-columns: 1fr; }
    .slide-preview { width: 100%; height: 120px; }
    .slide-accoes { flex-direction: row; flex-wrap: wrap; }
  }
</style>
</head>
<body>

<nav class="barra-admin" aria-label="Administração">
  <strong>Mia &amp; Paper Admin</strong>
  <a href="produtos.html">Produtos</a>
  <a href="galeria.html">Galeria</a>
  <a href="multimedia.html">Multimédia</a>
  <a href="reviews.html">Reviews</a>
  <a href="precos.php">Preços</a>
  <a href="materiais.php">Materiais</a>
  <a href="homepage-menu-design.php">Homepage &amp; Menu</a>
  <a href="carrousel.php" class="activo">Carrosséis</a>
  <a href="admin-funnel.php">Funil</a>
  <a href="admin-orders.php">Encomendas</a>
  <a href="admin-colors.html">Cores</a>
  <a href="admin-uploads.php">Uploads</a>
  <a href="tools/index.php">Ferramentas</a>
</nav>

<header class="barra">
  <h1>Carrosséis</h1>
  <span id="alerta"></span>
  <button id="desfazer" disabled>Undo</button>
  <button id="guardar" class="primario" disabled>Save</button>
</header>

<div class="conteudo">
  <div class="faixa aviso" id="faixaAberto" hidden>
    Editor aberto sem autenticação, nos mesmos termos da galeria, dos preços e do editor da homepage.
    Antes do deploy, pôr <code>CARROUSEL_REQUIRE_ADMIN</code> a <code>true</code> em <code>carrousel-api.php</code>.
  </div>
  <div class="separadores" id="separadores"></div>
  <div id="conteudoAba"></div>
</div>

<datalist id="imagensDisponiveis"></datalist>

<div class="rodape" id="rodape">
  <span class="resumo" id="resumo"></span>
  <span class="rodape-nota">Nada disto toca no site até carregares em <strong>Save</strong>.</span>
  <button id="descartar">Descartar tudo</button>
</div>

<script>
(function () {
  "use strict";

  var API = "carrousel-api.php";
  // Aspa simples como constante: escrever ' dentro de strings JS geradas por
  // script é onde isto se parte sempre.
  var ASPA = String.fromCharCode(39);
  var CAMPOS = [
    { chave: "intervalMs", etiqueta: "Tempo no ecrã (ms)", min: 800, max: 30000, passo: 100 },
    { chave: "speedSeconds", etiqueta: "Movimento (s)", min: 3, max: 30, passo: 1 },
    { chave: "zoomPercent", etiqueta: "Zoom (%)", min: 100, max: 140, passo: 1 },
    { chave: "panPercent", etiqueta: "Pan (%)", min: 0, max: 18, passo: 1 },
    { chave: "overlayOpacity", etiqueta: "Escurecer (%)", min: 0, max: 80, passo: 1 }
  ];

  var dados = null;
  var aba = "global";
  var fila = {};
  var pilhaUndo = [];

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function alerta(t, c) { el("alerta").textContent = t || ""; el("alerta").className = c || ""; }
  function nPendentes() { return Object.keys(fila).length; }

  function actualizar() {
    var n = nPendentes();
    el("rodape").classList.toggle("aberta", n > 0);
    el("resumo").innerHTML = n ? "<strong>" + n + "</strong> alteraç" + (n === 1 ? "ão" : "ões") + " por gravar" : "";
    el("guardar").disabled = n === 0;
    el("guardar").textContent = n === 0 ? "Save" : "Save (" + n + ")";
    el("desfazer").disabled = pilhaUndo.length === 0;
  }

  function marcarUndo(chave) {
    pilhaUndo.push({ chave: chave, anterior: fila[chave] ? JSON.parse(JSON.stringify(fila[chave])) : null });
    if (pilhaUndo.length > 80) { pilhaUndo.shift(); }
  }

  function enfileirar(chave, operacao) {
    marcarUndo(chave);
    fila[chave] = operacao;
    actualizar();
  }

  // ── Desenho ──────────────────────────────────────────────────────────────

  function cartaoPorId(id) {
    return (dados.cartoes || []).filter(function (c) { return c.id === id; })[0] || null;
  }

  // Um campo de parâmetro. No Global tem sempre valor; num slide, vazio quer
  // dizer "herda", e o placeholder mostra o que vai herdar.
  function campoParametro(campo, valor, herdado, attrs) {
    return '<label><span>' + esc(campo.etiqueta) + '</span>'
      + '<input type="number" min="' + campo.min + '" max="' + campo.max + '" step="' + campo.passo + '"'
      + ' value="' + esc(valor == null ? "" : valor) + '"'
      + (herdado != null ? ' placeholder="' + esc(herdado) + ' (global)"' : '')
      + ' data-original="' + esc(valor == null ? "" : valor) + '"'
      + attrs + '></label>';
  }

  function abaGlobal() {
    var g = dados.global;

    return '<div class="faixa info"><strong>Estes são os valores por omissão de todos os carrosséis.</strong> '
      + 'Cada imagem só usa os seus quando lhe puseres um número; deixá-la vazia faz herdar daqui. '
      + 'Mudar um valor aqui chega a todas as imagens que não tenham o seu.</div>'

      + '<section class="cartao"><header><h2>Todos os carrosséis</h2></header><div class="corpo">'
      + '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:15px">'
      + '<label class="linha-flex"><input type="checkbox"' + (g.enabled ? " checked" : "")
      + ' data-op="global" data-campo="enabled" data-original="' + (g.enabled ? "1" : "") + '">'
      + '<span>Carrosséis ligados no site</span></label>'
      + '<label class="linha-flex"><input type="checkbox"' + (g.randomizeOnLoad ? " checked" : "")
      + ' data-op="global" data-campo="randomizeOnLoad" data-original="' + (g.randomizeOnLoad ? "1" : "") + '">'
      + '<span>Baralhar a ordem das imagens a cada visita</span></label>'
      + '</div>'
      + '<div class="params">'
      + CAMPOS.map(function (campo) {
          return campoParametro(campo, g[campo.chave], null, ' data-op="global" data-campo="' + campo.chave + '"');
        }).join("")
      + '</div>'
      + '</div></section>'

      + '<section class="cartao"><header><h2>Propagar a todas as imagens</h2></header><div class="corpo">'
      + '<p style="margin:0 0 12px;font-size:.84rem;color:var(--texto-2)">'
      + 'Limpa os valores próprios de todas as imagens de todos os cartões. A partir daí, tudo segue o que está aqui em cima.</p>'
      + '<button class="leve" data-repor-globais>Repor todas as imagens no global</button>'
      + '</div></section>';
  }

  function abaCartao(id) {
    var c = cartaoPorId(id);
    var g = dados.global;

    if (!c) { return '<div class="faixa aviso">Cartão desconhecido.</div>'; }

    var html = '<div class="faixa info">'
      + '<strong>' + esc(c.titulo || c.id) + '.</strong> '
      + 'Arrasta as imagens para as ordenar. Um campo vazio herda do separador <em>Global</em>.'
      + '</div>';

    html += '<section class="cartao"><header><h2>Este cartão</h2>'
      + '<span class="selo mono">' + esc(c.id) + '</span>'
      // O botão aparece sempre: escondê-lo quando não há nada para puxar só
      // deixava a pensar que faltava alguma coisa. Desligado, diz porquê.
      + (c.doProduto.length
          ? '<button class="leve" data-puxar="' + esc(c.id) + '">Puxar as ' + c.doProduto.length + ' imagens do produto</button>'
          : '<button class="leve" disabled title="Este cartão não aponta para uma página de produto com imagens no passo dos designs.">Puxar do produto</button>')
      + '</header><div class="corpo" style="display:flex;flex-direction:column;gap:10px">'
      + '<label class="linha-flex"><input type="checkbox"' + (c.activo ? " checked" : "")
      + ' data-op="cartao" data-cartao="' + esc(c.id) + '" data-campo="carouselEnabled"'
      + ' data-original="' + (c.activo ? "1" : "") + '"><span>Carrossel ligado neste cartão</span></label>'
      + '<label class="linha-flex"><input type="checkbox"' + (c.aleatorio ? " checked" : "")
      + ' data-op="cartao" data-cartao="' + esc(c.id) + '" data-campo="carouselRandomizeOnLoad"'
      + ' data-original="' + (c.aleatorio ? "1" : "") + '"><span>Baralhar a ordem neste cartão</span></label>'
      + '</div></section>';

    html += '<section class="cartao"><header><h2>Imagens</h2>'
      + '<span class="selo">' + c.slides.length + ' de ' + dados.maxSlides + '</span>'
      + '</header><div class="corpo">';

    if (!c.slides.length) {
      html += '<p style="margin:0 0 12px;font-size:.84rem;color:var(--texto-2)">'
        + 'Sem imagens: este cartão mostra a imagem fixa em vez de um carrossel.</p>';
    }

    html += '<div id="listaSlides" data-cartao="' + esc(c.id) + '">'
      + c.slides.map(function (slide, i) { return linhaSlide(c, slide, i, g); }).join("")
      + '</div>';

    html += '<div style="display:flex;gap:8px;align-items:center;margin-top:12px">'
      + '<input type="text" id="novaImagem" list="imagensDisponiveis" placeholder="content/designs/..." style="flex:1">'
      + '<button data-adicionar="' + esc(c.id) + '">Adicionar imagem</button>'
      + '</div>';

    html += '</div></section>';
    return html;
  }

  function linhaSlide(c, slide, i, g) {
    var attrs = ' data-op="slide" data-cartao="' + esc(c.id) + '" data-indice="' + i + '"';

    return '<div class="slide" draggable="true" data-indice="' + i + '">'
      + '<span class="slide-preview" style="background-image:url(' + ASPA + esc(slide.image) + ASPA + ')"></span>'
      + '<span class="slide-corpo">'
      + '<span class="slide-num">Imagem ' + (i + 1) + '</span>'
      + '<input type="text" list="imagensDisponiveis" value="' + esc(slide.image) + '"'
      + ' data-original="' + esc(slide.image) + '"' + attrs + ' data-campo="image">'
      + '<span class="params">'
      + CAMPOS.map(function (campo) {
          return campoParametro(campo, slide[campo.chave], g[campo.chave], attrs + ' data-campo="' + campo.chave + '"');
        }).join("")
      + '</span>'
      + '</span>'
      + '<span class="slide-accoes">'
      + '<span class="slide-pega" title="Arrastar para reordenar">⠿</span>'
      + '<button class="leve perigo" data-remover="' + i + '">Remover</button>'
      + '</span>'
      + '</div>';
  }

  function desenharSeparadores() {
    var html = '<button class="global' + (aba === "global" ? " activo" : "") + '" data-aba="global">Global</button>';

    html += (dados.cartoes || []).map(function (c) {
      return '<button class="' + (aba === c.id ? "activo" : "") + (c.activo ? "" : " apagado") + '" data-aba="' + esc(c.id) + '"'
        + (c.activo ? '' : ' title="Carrossel desligado neste cartão"') + '>'
        + (c.miniatura ? '<span class="mini-thumb" style="background-image:url(' + ASPA + esc(c.miniatura) + ASPA + ')"></span>' : '')
        + esc(c.titulo || c.id)
        + '<span class="conta">' + c.slides.length + '</span>'
        + '</button>';
    }).join("");

    el("separadores").innerHTML = html;
  }

  // Redesenhar reconstrói os campos a partir do `dados`, que não acompanha as
  // edições por gravar — sem isto, mudar de separador fazia as alterações
  // pendentes desaparecerem do ecrã sem saírem da fila.
  function reaplicarFila() {
    Object.keys(fila).forEach(function (chave) {
      var o = fila[chave];
      var selector = "";

      if (o.op === "global") {
        selector = '[data-op="global"][data-campo="' + o.campo + '"]';
      } else if (o.op === "cartao") {
        selector = '[data-op="cartao"][data-cartao="' + o.cartao + '"][data-campo="' + o.campo + '"]';
      } else if (o.op === "slide") {
        selector = '[data-op="slide"][data-cartao="' + o.cartao + '"][data-indice="' + o.indice + '"][data-campo="' + o.campo + '"]';
      } else {
        return;
      }
      [].forEach.call(document.querySelectorAll(selector), function (campo) {
        if (campo.type === "checkbox") { campo.checked = !!o.valor; } else { campo.value = o.valor; }
        campo.classList.add("sujo");
      });
    });
  }

  function desenhar() {
    el("faixaAberto").hidden = !dados.aberto;
    desenharSeparadores();
    el("conteudoAba").innerHTML = aba === "global" ? abaGlobal() : abaCartao(aba);
    reaplicarFila();
    actualizar();
  }

  // ── Edição ───────────────────────────────────────────────────────────────

  function tratar(evento) {
    var alvo = evento.target;
    if (!alvo.dataset || !alvo.dataset.op) { return; }

    var op = alvo.dataset.op;
    var eBool = alvo.type === "checkbox";
    var valor = eBool ? alvo.checked : alvo.value;
    var original = alvo.dataset.original;
    var igual = eBool ? ((original === "1") === valor) : (String(original) === String(valor));
    var chave;

    alvo.classList.toggle("sujo", !igual);

    if (op === "global") {
      chave = "global:" + alvo.dataset.campo;
      if (igual) { delete fila[chave]; actualizar(); return; }
      enfileirar(chave, { op: "global", campo: alvo.dataset.campo, valor: valor });
      return;
    }

    if (op === "cartao") {
      chave = "cartao:" + alvo.dataset.cartao + ":" + alvo.dataset.campo;
      if (igual) { delete fila[chave]; actualizar(); return; }
      enfileirar(chave, { op: "cartao", cartao: alvo.dataset.cartao, campo: alvo.dataset.campo, valor: valor });
      return;
    }

    if (op === "slide") {
      chave = "slide:" + alvo.dataset.cartao + ":" + alvo.dataset.indice + ":" + alvo.dataset.campo;
      if (igual) { delete fila[chave]; actualizar(); return; }
      enfileirar(chave, {
        op: "slide", cartao: alvo.dataset.cartao,
        indice: parseInt(alvo.dataset.indice, 10), campo: alvo.dataset.campo, valor: valor
      });
      // A pré-visualização acompanha o caminho novo, para se ver logo se está certo.
      if (alvo.dataset.campo === "image") {
        var caixa = alvo.closest(".slide").querySelector(".slide-preview");
        caixa.style.backgroundImage = "url(" + ASPA + valor + ASPA + ")";
      }
    }
  }

  document.addEventListener("input", tratar);
  document.addEventListener("change", tratar);

  // ── Botões ───────────────────────────────────────────────────────────────

  document.addEventListener("click", function (evento) {
    var alvo = evento.target;
    var separador = alvo.closest ? alvo.closest("[data-aba]") : null;
    var adicionar = alvo.closest ? alvo.closest("[data-adicionar]") : null;
    var remover = alvo.closest ? alvo.closest("[data-remover]") : null;
    var puxar = alvo.closest ? alvo.closest("[data-puxar]") : null;
    var repor = alvo.closest ? alvo.closest("[data-repor-globais]") : null;

    if (separador) { aba = separador.dataset.aba; desenhar(); return; }

    if (adicionar) {
      var caminho = (el("novaImagem").value || "").trim();
      if (!caminho) { alerta("Escreve ou escolhe o caminho da imagem.", "erro"); return; }
      enfileirar("adicionar:" + adicionar.dataset.adicionar + ":" + caminho,
        { op: "slide-adicionar", cartao: adicionar.dataset.adicionar, imagem: caminho });
      alerta("Imagem por acrescentar. Falta gravar.", "ok");
      return;
    }

    if (remover) {
      // As operações de estrutura só se resolvem no servidor, por isso a lista
      // no ecrã só muda depois do Save: mostrar já a linha fora daria uma
      // numeração diferente da que o servidor vai ver.
      enfileirar("remover:" + aba + ":" + remover.dataset.remover,
        { op: "slide-remover", cartao: aba, indice: parseInt(remover.dataset.remover, 10) });
      remover.closest(".slide").style.opacity = ".4";
      alerta("Imagem marcada para remover. Falta gravar.", "ok");
      return;
    }

    if (puxar) {
      if (!window.confirm("Substituir as imagens deste cartão pelas do produto?")) { return; }
      enfileirar("puxar:" + puxar.dataset.puxar, { op: "puxar-do-produto", cartao: puxar.dataset.puxar });
      alerta("Imagens do produto por aplicar. Falta gravar.", "ok");
      return;
    }

    if (repor) {
      if (!window.confirm("Limpar os valores próprios de todas as imagens de todos os cartões?")) { return; }
      enfileirar("repor-globais", { op: "repor-globais" });
      alerta("Reposição por aplicar. Falta gravar.", "ok");
    }
  });

  // ── Arrastar para ordenar ────────────────────────────────────────────────

  var aArrastar = null;

  document.addEventListener("dragstart", function (evento) {
    if (evento.target.closest && evento.target.closest("input, select, textarea, button")) {
      evento.preventDefault();
      return;
    }
    aArrastar = evento.target.closest ? evento.target.closest(".slide") : null;
    if (!aArrastar) { return; }
    aArrastar.classList.add("a-arrastar");
    evento.dataTransfer.effectAllowed = "move";
    evento.dataTransfer.setData("text/plain", "x");
  });

  document.addEventListener("dragover", function (evento) {
    if (!aArrastar) { return; }
    evento.preventDefault();
    var caixa = evento.target.closest ? evento.target.closest("#listaSlides") : null;
    if (!caixa) { return; }
    var sobre = evento.target.closest(".slide");
    if (!sobre || sobre === aArrastar) { return; }
    var r = sobre.getBoundingClientRect();
    caixa.insertBefore(aArrastar, (evento.clientY - r.top) / r.height > 0.5 ? sobre.nextSibling : sobre);
  });

  document.addEventListener("drop", function (evento) { if (aArrastar) { evento.preventDefault(); } });

  document.addEventListener("dragend", function () {
    if (!aArrastar) { return; }
    aArrastar.classList.remove("a-arrastar");
    aArrastar = null;
    var lista = el("listaSlides");
    if (!lista) { return; }
    var ordem = [].map.call(lista.querySelectorAll(".slide"), function (s) {
      return parseInt(s.dataset.indice, 10);
    });
    enfileirar("ordem:" + lista.dataset.cartao, { op: "slide-ordem", cartao: lista.dataset.cartao, ordem: ordem });
  });

  // ── Undo, descartar, gravar ──────────────────────────────────────────────

  el("desfazer").addEventListener("click", function () {
    var passo = pilhaUndo.pop();
    if (!passo) { return; }
    if (passo.anterior) { fila[passo.chave] = passo.anterior; } else { delete fila[passo.chave]; }
    desenhar();
    alerta("Alteração desfeita.", "ok");
  });

  el("descartar").addEventListener("click", function () {
    if (!nPendentes() || !window.confirm("Descartar todas as alterações por gravar?")) { return; }
    fila = {};
    pilhaUndo = [];
    desenhar();
    alerta("Alterações descartadas.", "ok");
  });

  el("guardar").addEventListener("click", function () {
    var lista = Object.keys(fila).map(function (k) { return fila[k]; });
    if (!lista.length) { return; }

    el("guardar").disabled = true;
    alerta("A gravar…");

    fetch(API + "?action=save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alteracoes: lista })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.d.ok) { throw new Error(res.d.erro || "Não consegui gravar."); }
        dados = res.d;
        fila = {};
        pilhaUndo = [];
        if (aba !== "global" && !cartaoPorId(aba)) { aba = "global"; }
        desenhar();
        alerta("Gravado.", "ok");
      })
      .catch(function (e) {
        actualizar();
        alerta(e.message, "erro");
      });
  });

  // ── Arranque ─────────────────────────────────────────────────────────────

  fetch(API + "?action=data", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.ok) { throw new Error(d.erro || "Não consegui carregar."); }
      dados = d;
      el("imagensDisponiveis").innerHTML = (d.imagens || []).map(function (i) {
        return '<option value="' + esc(i) + '"></option>';
      }).join("");
      desenhar();
      alerta(d.cartoes.length + " cartões · "
        + d.cartoes.reduce(function (t, c) { return t + c.slides.length; }, 0) + " imagens.", "ok");
    })
    .catch(function (e) { alerta(e.message, "erro"); });
})();
</script>
</body>
</html>
