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
<link rel="stylesheet" href="admin-nav.css?v=20260907003042">
<script src="admin-nav.js?v=20260907003042" defer></script>
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

  /* Selector de imagens: a mesma ideia da galeria — vê-se a imagem antes de
     se escolher, em vez de se escrever um caminho de cor. */
  .escolher-fundo {
    position: fixed; inset: 0; z-index: 60; display: grid; place-items: center;
    background: rgba(8,9,26,.72); backdrop-filter: blur(3px); padding: 24px;
  }
  .escolher {
    width: min(1000px, 100%); max-height: 84vh; display: flex; flex-direction: column;
    background: var(--cartao); border: 1px solid var(--linha-forte);
    border-radius: var(--raio); box-shadow: var(--sombra); overflow: hidden;
  }
  .escolher > header {
    display: flex; gap: 10px; align-items: center; padding: 13px 16px;
    border-bottom: 1px solid var(--linha);
  }
  .escolher > header h2 { font-size: 1rem; }
  .escolher-grelha {
    padding: 14px; overflow: auto;
    display: grid; grid-template-columns: repeat(auto-fill, minmax(122px, 1fr)); gap: 10px;
  }
  .escolher-item {
    border: 1px solid var(--linha); border-radius: 10px; background: var(--campo);
    padding: 0; overflow: hidden; cursor: pointer; text-align: left;
  }
  .escolher-item:hover { border-color: var(--azul); }
  .escolher-item img {
    display: block; width: 100%; height: 84px; object-fit: cover; background: var(--fundo-2);
  }
  .escolher-item span {
    display: block; padding: 5px 7px; font-size: .64rem; color: var(--texto-3);
    font-family: var(--mono); word-break: break-all; line-height: 1.35;
  }
  .escolher-vazio { padding: 24px; color: var(--texto-3); font-size: .85rem; }

  .slide-visto {
    display: flex; align-items: center; gap: 6px; font-size: .7rem; color: var(--texto-3);
    white-space: nowrap;
  }
  .slide.desligado .slide-preview,
  .slide.desligado .slide-corpo { opacity: .4; }

  @media (max-width: 720px) {
    .slide { grid-template-columns: 1fr; }
    .slide-preview { width: 100%; height: 120px; }
    .slide-accoes { flex-direction: row; flex-wrap: wrap; }
  }
</style>
</head>
<body>

<header class="barra admin-secondary-bar">
  <h1>Carrosséis</h1>
  <span id="alerta"></span>
  <button id="desfazer" disabled>Undo</button>
  <button id="guardar" class="primario" disabled>Save</button>
</header>

<div class="conteudo">
  <div class="faixa aviso" id="faixaAberto" hidden>
    Editor aberto sem autenticação, nos mesmos termos da galeria, dos preços e do editor da homepage.
    Antes do deploy, pôr <code>MIA_ADMIN_OPEN</code> a <code>false</code> em <code>admin-open.php</code>.
  </div>
  <div class="separadores" id="separadores"></div>
  <div id="conteudoAba"></div>
</div>

<datalist id="imagensDisponiveis"></datalist>

<div class="escolher-fundo" id="escolherFundo" hidden>
  <div class="escolher" role="dialog" aria-modal="true" aria-label="Escolher imagem">
    <header>
      <h2>Escolher imagem</h2>
      <input type="text" id="escolherFiltro" placeholder="filtrar por nome…" style="flex:1;max-width:320px">
      <span class="selo" id="escolherConta"></span>
      <button class="leve" id="escolherFechar">Fechar</button>
    </header>
    <div class="escolher-grelha" id="escolherGrelha"></div>
  </div>
</div>

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
  var csrf = "";
  var original = null;   // cópia do que está gravado, para saber o que ainda não foi
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
      + '<input type="text" id="novaImagem" list="imagensDisponiveis" placeholder="deixa vazio para escolher da lista" style="flex:1">'
      + '<button data-adicionar="' + esc(c.id) + '">Adicionar imagem</button>'
      + '</div>';

    html += '</div></section>';
    return html;
  }

  function linhaSlide(c, slide, i, g) {
    var attrs = ' data-op="slide" data-cartao="' + esc(c.id) + '" data-indice="' + i + '"';

    return '<div class="slide' + (slide.visible === false ? ' desligado' : '') + '" draggable="true" data-indice="' + i + '">'
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
      + '<label class="slide-visto" title="Sem o visto, a imagem fica na lista mas sai do carrossel">'
      + '<input type="checkbox"' + (slide.visible === false ? '' : ' checked')
      + attrs + ' data-campo="visible">no carrossel</label>'
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

  // ESTADO_COMPLETO_V1: as alterações mexem já no `dados` e vêem-se no ecrã; a
  // fila leva o cartão inteiro, não operações de índice. Antes, acrescentar ou
  // puxar imagens só aparecia depois do Save — parecia que o botão estava
  // morto — e remover duas de uma vez apagava a errada.

  function guardarUndo() {
    pilhaUndo.push({ dados: JSON.parse(JSON.stringify(dados)), fila: JSON.parse(JSON.stringify(fila)) });
    if (pilhaUndo.length > 60) { pilhaUndo.shift(); }
  }

  function marcarCartao(id) {
    var c = cartaoPorId(id);
    if (!c) { return; }
    fila["cartao:" + id] = {
      op: "cartao-definir", cartao: id,
      activo: c.activo, aleatorio: c.aleatorio, slides: c.slides
    };
  }

  // Marca a amarelo o que difere do que está gravado.
  function marcarSujos() {
    if (!original) { return; }
    [].forEach.call(document.querySelectorAll("[data-op]"), function (campo) {
      var d = campo.dataset;
      var antes;
      var c;
      var slide;

      if (d.op === "global") {
        antes = original.global[d.campo];
      } else if (d.op === "cartao") {
        c = (original.cartoes || []).filter(function (x) { return x.id === d.cartao; })[0];
        antes = c ? (d.campo === "carouselEnabled" ? c.activo : c.aleatorio) : null;
      } else if (d.op === "slide") {
        c = (original.cartoes || []).filter(function (x) { return x.id === d.cartao; })[0];
        slide = c ? c.slides[Number(d.indice)] : null;
        if (!slide) { campo.classList.add("sujo"); return; }
        antes = d.campo === "visible" ? slide.visible !== false : slide[d.campo];
      } else {
        return;
      }

      if (campo.type === "checkbox") {
        campo.classList.toggle("sujo", campo.checked !== !!antes);
      } else {
        campo.classList.toggle("sujo", String(campo.value) !== String(antes == null ? "" : antes));
      }
    });
  }

  function desenhar() {
    el("faixaAberto").hidden = !dados.aberto;
    desenharSeparadores();
    el("conteudoAba").innerHTML = aba === "global" ? abaGlobal() : abaCartao(aba);
    marcarSujos();
    actualizar();
  }

  // ── Edição ───────────────────────────────────────────────────────────────

  // `input` só mexe nos dados (escrever não pode redesenhar, senão perde-se o
  // cursor); `change` — que dispara ao sair do campo — redesenha.
  document.addEventListener("input", function (e) { tratar(e, false); });
  document.addEventListener("change", function (e) { tratar(e, true); });

  function tratar(evento, redesenhar) {
    var alvo = evento.target;
    if (!alvo.dataset || !alvo.dataset.op) { return; }

    var d = alvo.dataset;
    var eBool = alvo.type === "checkbox";
    var valor = eBool ? alvo.checked : alvo.value;
    var c;
    var slide;

    guardarUndo();

    if (d.op === "global") {
      dados.global[d.campo] = eBool ? valor : (valor === "" ? dados.global[d.campo] : parseFloat(valor));
      fila["global:" + d.campo] = { op: "global", campo: d.campo, valor: dados.global[d.campo] };
    } else if (d.op === "cartao") {
      c = cartaoPorId(d.cartao);
      if (c) {
        if (d.campo === "carouselEnabled") { c.activo = valor; } else { c.aleatorio = valor; }
      }
      marcarCartao(d.cartao);
    } else if (d.op === "slide") {
      c = cartaoPorId(d.cartao);
      slide = c ? c.slides[Number(d.indice)] : null;
      if (slide) {
        if (d.campo === "visible") { slide.visible = valor; }
        else if (d.campo === "image") { slide.image = valor; }
        else { slide[d.campo] = valor === "" ? null : parseFloat(valor); }
      }
      marcarCartao(d.cartao);
    } else {
      pilhaUndo.pop();
      return;
    }

    if (redesenhar) {
      desenhar();
    } else {
      alvo.classList.add("sujo");
      // A pré-visualização acompanha o caminho novo, para se ver logo se está certo.
      if (d.op === "slide" && d.campo === "image") {
        alvo.closest(".slide").querySelector(".slide-preview").style.backgroundImage = "url(" + ASPA + valor + ASPA + ")";
      }
      actualizar();
    }
  }

  // ── Selector de imagens ──────────────────────────────────────────────────
  // Escrever um caminho de cor é convidar a erros de dedo; aqui vê-se a imagem
  // antes de se escolher, como na galeria.

  var escolherDestino = null;   // { cartao } para acrescentar, ou { cartao, indice } para trocar

  function abrirEscolher(destino) {
    escolherDestino = destino;
    el("escolherFiltro").value = "";
    desenharEscolher();
    el("escolherFundo").hidden = false;
    el("escolherFiltro").focus();
  }

  function fecharEscolher() {
    escolherDestino = null;
    el("escolherFundo").hidden = true;
  }

  function desenharEscolher() {
    var filtro = (el("escolherFiltro").value || "").trim().toLowerCase();
    var lista = (dados.imagens || []).filter(function (i) {
      return !filtro || i.toLowerCase().indexOf(filtro) !== -1;
    });
    var mostrar = lista.slice(0, 240);

    el("escolherConta").textContent = lista.length + (lista.length > mostrar.length ? " (a mostrar " + mostrar.length + ")" : "");
    el("escolherGrelha").innerHTML = mostrar.length
      ? mostrar.map(function (i) {
          return '<button type="button" class="escolher-item" data-escolher-imagem="' + esc(i) + '">'
            + '<img src="' + esc(i) + '" alt="" loading="lazy">'
            + '<span>' + esc(i.replace("content/", "")) + '</span></button>';
        }).join("")
      : '<p class="escolher-vazio">Nenhuma imagem com esse nome.</p>';
  }

  el("escolherFiltro").addEventListener("input", desenharEscolher);
  el("escolherFechar").addEventListener("click", fecharEscolher);
  el("escolherFundo").addEventListener("click", function (evento) {
    if (evento.target === el("escolherFundo")) { fecharEscolher(); }
  });
  document.addEventListener("keydown", function (evento) {
    if (evento.key === "Escape" && !el("escolherFundo").hidden) { fecharEscolher(); }
  });

  // Devolve "" quando acrescentou, ou o motivo por que não. Quem chama é que
  // decide o que dizer — o "puxar" acrescenta muitas de uma vez e não pode
  // gritar a cada uma que já lá estava.
  function acrescentarImagem(idCartao, caminho) {
    var c = cartaoPorId(idCartao);

    if (!c) { return "cartão desconhecido"; }
    if (c.slides.length >= dados.maxSlides) {
      return "este carrossel já tem o máximo de " + dados.maxSlides + " imagens";
    }
    if (c.slides.some(function (s) { return s.image === caminho; })) {
      return "essa imagem já está neste carrossel";
    }
    c.slides.push({
      image: caminho, visible: true,
      intervalMs: null, speedSeconds: null, zoomPercent: null, panPercent: null, overlayOpacity: null
    });
    return "";
  }

  function primeiraMaiuscula(texto) {
    return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) + "." : "";
  }

  // ── Botões ───────────────────────────────────────────────────────────────

  document.addEventListener("click", function (evento) {
    var alvo = evento.target;
    var separador = alvo.closest ? alvo.closest("[data-aba]") : null;
    var adicionar = alvo.closest ? alvo.closest("[data-adicionar]") : null;
    var remover = alvo.closest ? alvo.closest("[data-remover]") : null;
    var puxar = alvo.closest ? alvo.closest("[data-puxar]") : null;
    var repor = alvo.closest ? alvo.closest("[data-repor-globais]") : null;
    var escolhida = alvo.closest ? alvo.closest("[data-escolher-imagem]") : null;
    var caminho;
    var c;
    var novas;
    var motivo;

    if (separador) { aba = separador.dataset.aba; desenhar(); return; }

    if (escolhida) {
      caminho = escolhida.dataset.escolherImagem;
      guardarUndo();
      if (escolherDestino && escolherDestino.indice != null) {
        c = cartaoPorId(escolherDestino.cartao);
        if (c && c.slides[escolherDestino.indice]) { c.slides[escolherDestino.indice].image = caminho; }
        marcarCartao(escolherDestino.cartao);
      } else {
        motivo = acrescentarImagem(escolherDestino ? escolherDestino.cartao : "", caminho);
        if (motivo) {
          pilhaUndo.pop();
          alerta(primeiraMaiuscula(motivo), "erro");
          fecharEscolher();
          return;
        }
        marcarCartao(escolherDestino.cartao);
      }
      fecharEscolher();
      desenhar();
      alerta("Imagem escolhida. Falta gravar.", "ok");
      return;
    }

    if (adicionar) {
      caminho = (el("novaImagem").value || "").trim();
      // Sem caminho escrito, abre o selector em vez de reclamar.
      if (!caminho) { abrirEscolher({ cartao: adicionar.dataset.adicionar }); return; }
      guardarUndo();
      motivo = acrescentarImagem(adicionar.dataset.adicionar, caminho);
      if (motivo) {
        pilhaUndo.pop();
        alerta(primeiraMaiuscula(motivo), "erro");
        return;
      }
      marcarCartao(adicionar.dataset.adicionar);
      desenhar();
      alerta("Imagem acrescentada. Falta gravar.", "ok");
      return;
    }

    if (remover) {
      guardarUndo();
      c = cartaoPorId(aba);
      if (c) { c.slides.splice(Number(remover.dataset.remover), 1); }
      marcarCartao(aba);
      desenhar();
      alerta("Imagem removida. Falta gravar.", "ok");
      return;
    }

    if (puxar) {
      // Acrescenta as que faltam em vez de substituir: quem já tratou de um
      // carrossel à mão não quer perder esse trabalho por carregar aqui.
      c = cartaoPorId(puxar.dataset.puxar);
      if (!c) { return; }
      guardarUndo();
      novas = 0;
      motivo = "";
      c.doProduto.forEach(function (imagem) {
        var falhou = acrescentarImagem(c.id, imagem);
        if (falhou) { motivo = falhou; } else { novas += 1; }
      });
      if (!novas) {
        pilhaUndo.pop();
        alerta(primeiraMaiuscula(motivo) || "Já lá estão todas as imagens do produto.", "ok");
        return;
      }
      marcarCartao(c.id);
      desenhar();
      alerta(novas + (novas === 1 ? " imagem acrescentada" : " imagens acrescentadas") + ". Falta gravar.", "ok");
      return;
    }

    if (repor) {
      if (!window.confirm("Limpar os valores próprios de todas as imagens de todos os cartões?")) { return; }
      guardarUndo();
      (dados.cartoes || []).forEach(function (cartao) {
        cartao.slides.forEach(function (slide) {
          ["intervalMs", "speedSeconds", "zoomPercent", "panPercent", "overlayOpacity"].forEach(function (campo) {
            slide[campo] = null;
          });
        });
        marcarCartao(cartao.id);
      });
      desenhar();
      alerta("Todas as imagens voltaram ao global. Falta gravar.", "ok");
    }
  });

  // Trocar a imagem de um slide: dois cliques no campo abrem o selector.
  document.addEventListener("dblclick", function (evento) {
    var campo = evento.target.closest ? evento.target.closest('[data-op="slide"][data-campo="image"]') : null;
    if (!campo) { return; }
    abrirEscolher({ cartao: campo.dataset.cartao, indice: Number(campo.dataset.indice) });
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
    var c = lista ? cartaoPorId(lista.dataset.cartao) : null;
    if (!lista || !c) { return; }
    guardarUndo();
    c.slides = [].map.call(lista.querySelectorAll(".slide"), function (linha) {
      return c.slides[Number(linha.dataset.indice)];
    });
    marcarCartao(c.id);
    desenhar();
  });

  // ── Undo, descartar, gravar ──────────────────────────────────────────────

  el("desfazer").addEventListener("click", function () {
    var passo = pilhaUndo.pop();
    if (!passo) { return; }
    dados = passo.dados;
    fila = passo.fila;
    desenhar();
    alerta("Alteração desfeita.", "ok");
  });

  el("descartar").addEventListener("click", function () {
    if (!nPendentes() || !window.confirm("Descartar todas as alterações por gravar?")) { return; }
    dados = JSON.parse(JSON.stringify(original));
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
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Admin-CSRF": csrf },
      body: JSON.stringify({ alteracoes: lista })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.d.ok) { throw new Error(res.d.erro || "Não consegui gravar."); }
        csrf = res.d.csrf || csrf;
        dados = res.d;
        original = JSON.parse(JSON.stringify(res.d));
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

  fetch(API + "?action=data", { cache: "no-store", credentials: "same-origin" })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.ok) { throw new Error(d.erro || "Não consegui carregar."); }
      csrf = d.csrf || "";
      dados = d;
      original = JSON.parse(JSON.stringify(d));
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