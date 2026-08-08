<?php
// MATERIAIS_UI_V1
// Quanto custa mesmo fazer uma unidade de cada coisa.
//
// A ideia é simples e a página tenta não a complicar: há um catálogo de
// materiais (o que se compra e quanto custa) e, em cada produto, diz-se
// **quantas unidades saem de um material**. O resto é aritmética.
//
// O campo do rendimento aceita uma multiplicação — "100*10*10" — porque é assim
// que se pensa nestas coisas ("100 cortes, 10 folhas por corte, 10 crachás por
// folha"); obrigar a fazer a conta de cabeça é onde se erra.
//
// Guarda em private/materiais.json, fora da raiz web: são as margens do negócio.
?>
<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Materiais e custos · Mia &amp; Paper</title>
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
  .conteudo { padding: 22px 24px 140px; max-width: 1240px; margin: 0 auto; }

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

  .separadores { display: flex; gap: 6px; margin-bottom: 20px; flex-wrap: wrap; }
  .separadores button {
    background: none; border-color: transparent; color: var(--texto-2);
    display: inline-flex; align-items: center; gap: 7px;
  }
  .separadores button.activo { background: var(--cartao); border-color: var(--linha-forte); color: var(--texto); }
  .separadores button.destaque { color: var(--ciano); }
  .separadores .conta {
    font-size: .66rem; padding: 1px 6px; border-radius: 999px;
    background: var(--campo); border: 1px solid var(--linha); color: var(--texto-3);
  }
  .separadores .conta.feito { color: var(--verde); border-color: rgba(47,224,160,.4); }

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
  .cartao > .corpo.sem-padding { padding: 0; }

  .selo {
    font-size: .68rem; padding: 3px 9px; border-radius: 999px;
    border: 1px solid var(--linha-forte); color: var(--texto-2); background: var(--campo);
  }
  .selo.mono { font-family: var(--mono); color: var(--texto-3); }
  .selo.ok { color: var(--verde); border-color: rgba(47,224,160,.45); background: rgba(47,224,160,.1); }
  .selo.mau { color: var(--rosa); border-color: rgba(255,77,141,.5); background: rgba(255,77,141,.12); }

  .tabela-scroll { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; min-width: 720px; }
  th, td { padding: 8px 10px; text-align: left; font-size: .85rem; border-bottom: 1px solid var(--linha); vertical-align: middle; }
  th { font-size: .64rem; text-transform: uppercase; letter-spacing: .08em; color: var(--texto-3); font-weight: 600; }
  tbody tr:last-child td { border-bottom: 0; }
  tbody tr:hover { background: rgba(255,255,255,.03); }
  td.num, th.num { text-align: right; font-family: var(--mono); }
  tfoot td { border-top: 1px solid var(--linha-forte); font-weight: 600; }

  input[type="text"], input[type="number"], select {
    font: inherit; font-size: .84rem; width: 100%; padding: 5px 8px;
    border-radius: 8px; border: 1px solid var(--linha);
    background: var(--campo); color: var(--texto);
  }
  input:focus, select:focus {
    outline: none; border-color: var(--azul); box-shadow: 0 0 0 3px rgba(77,141,255,.22);
  }
  input.sujo, select.sujo { border-color: var(--ambar); background: rgba(255,182,72,.11); color: var(--ambar); }
  input.mono { font-family: var(--mono); }
  .col-xs { width: 78px; } .col-s { width: 104px; } .col-m { width: 150px; }

  /* O resultado é o que interessa: fica grande e em cima. */
  .resultado {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1px;
    background: var(--linha); border-radius: 12px; overflow: hidden; margin-bottom: 16px;
  }
  .resultado div { background: var(--campo); padding: 13px 15px; }
  .resultado span { display: block; font-size: .64rem; text-transform: uppercase; letter-spacing: .08em; color: var(--texto-3); }
  .resultado strong { display: block; font-size: 1.35rem; font-family: var(--mono); margin-top: 3px; }
  .resultado .destaque strong { color: var(--ciano); }
  .resultado .bom strong { color: var(--verde); }
  .resultado .mau strong { color: var(--rosa); }

  .faixa {
    padding: 11px 15px; border-radius: 11px; margin-bottom: 16px;
    font-size: .84rem; border: 1px solid var(--linha);
  }
  .faixa.info { background: rgba(77,141,255,.1); border-color: rgba(77,141,255,.32); color: #cfe0ff; }
  .faixa.aviso { background: rgba(255,182,72,.1); border-color: rgba(255,182,72,.34); color: #ffdfa8; }
  .faixa code { color: inherit; font-weight: 700; }

  .dica { font-size: .72rem; color: var(--texto-3); }
  .juntar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

  pre {
    margin: 0; padding: 16px; background: var(--fundo-2); color: var(--texto-2);
    font-family: var(--mono); font-size: .78rem; line-height: 1.55;
    white-space: pre-wrap; word-break: break-word; max-height: 74vh; overflow: auto;
  }

  .rodape {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
    display: flex; gap: 12px; align-items: center; padding: 12px 24px;
    background: rgba(16,17,50,.96); border-top: 1px solid var(--linha);
    backdrop-filter: blur(10px); transform: translateY(105%); transition: transform .18s ease;
  }
  .rodape.aberta { transform: none; }
  .rodape .resumo { font-size: .84rem; color: var(--texto-2); }
  .rodape-nota { font-size: .78rem; color: var(--texto-3); margin-right: auto; }

  #alerta { font-size: .82rem; }
  #alerta.ok { color: var(--verde); }
  #alerta.erro { color: var(--rosa); }
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
  <a href="materiais.php" class="activo">Materiais</a>
  <a href="homepage-menu-design.php">Homepage &amp; Menu</a>
  <a href="carrousel.php">Carrosséis</a>
  <a href="admin-funnel.php">Funil</a>
  <a href="admin-orders.php">Encomendas</a>
  <a href="admin-colors.html">Cores</a>
  <a href="admin-uploads.php">Uploads</a>
  <a href="tools/index.php">Ferramentas</a>
</nav>

<header class="barra">
  <h1>Materiais e custos</h1>
  <span id="alerta"></span>
  <button id="desfazer" disabled>Undo</button>
  <button id="guardar" class="primario" disabled>Save</button>
</header>

<div class="conteudo">
  <div class="faixa aviso" id="faixaAberto" hidden>
    Editor aberto sem autenticação, nos mesmos termos dos outros. Antes do deploy, pôr
    <code>MATERIAIS_REQUIRE_ADMIN</code> a <code>true</code> em <code>materiais-api.php</code>.
    Os números daqui ficam em <code>private/materiais.json</code>, fora da raiz web.
  </div>
  <div class="separadores" id="separadores"></div>
  <div id="conteudoAba"></div>
</div>

<div class="rodape" id="rodape">
  <span class="resumo" id="resumo"></span>
  <span class="rodape-nota">Nada disto é gravado até carregares em <strong>Save</strong>.</span>
  <button id="descartar">Descartar tudo</button>
</div>

<script>
(function () {
  "use strict";

  var API = "materiais-api.php";
  var dados = null;
  var aba = "materiais";
  var fila = {};
  var pilhaUndo = [];

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function alerta(t, c) { el("alerta").textContent = t || ""; el("alerta").className = c || ""; }
  function nPendentes() { return Object.keys(fila).length; }

  // Cêntimos com casas suficientes para se ver o que custa meia folha: um
  // material pode valer 0,0005 € por unidade e arredondar isso a 2 casas
  // escondia-o por completo.
  function euros(cents, casas) {
    var n = Number(cents) || 0;
    return (n / 100).toFixed(casas == null ? 2 : casas).replace(".", ",") + " €";
  }
  function eurosFinos(cents) {
    var n = Number(cents) || 0;
    if (n === 0) { return "0,00 €"; }
    return Math.abs(n) < 1 ? euros(cents, 4) : euros(cents, 2);
  }
  function numero(n) {
    return (Math.round((Number(n) || 0) * 1000) / 1000).toLocaleString("pt-PT");
  }

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

  function entradaDoCatalogo(chave) {
    return (dados.catalogo || []).filter(function (c) { return c.chave === chave; })[0] || null;
  }
  function calculoDe(chave) {
    return (dados.calculos || {})[chave] || { linhas: [], materiaisCents: 0, maoDeObraCents: 0, totalCents: 0, minutosPorUnidade: 0 };
  }
  function materialPorId(id) {
    return (dados.materiais || []).filter(function (m) { return m.id === id; })[0] || null;
  }

  // ── Separador dos materiais ──────────────────────────────────────────────

  function abaMateriais() {
    var html = '<div class="faixa info">'
      + '<strong>O que compras, e por quanto.</strong> '
      + 'Escreve a quantidade que vem na embalagem e o que pagaste por ela — a página tira daí o custo de uma unidade. '
      + 'Os <em>estragos</em> são a percentagem que se perde a trabalhar (folhas mal cortadas, crachás falhados).'
      + '</div>';

    html += '<section class="cartao"><header><h2>Custo do tempo</h2></header><div class="corpo">'
      + '<div class="juntar">'
      + '<label style="display:flex;align-items:center;gap:9px;font-size:.85rem">Quanto vale uma hora do teu trabalho'
      + '<input type="number" min="0" step="0.5" class="col-s" value="' + esc((dados.custoHoraCents / 100).toFixed(2)) + '"'
      + ' data-op="custo-hora" data-original="' + esc((dados.custoHoraCents / 100).toFixed(2)) + '"></label>'
      + '<span class="dica">euros por hora · deixa a zero para ignorar o tempo nas contas</span>'
      + '</div></div></section>';

    html += '<section class="cartao"><header><h2>Materiais</h2>'
      + '<span class="selo">' + (dados.materiais || []).length + '</span>'
      + '<button data-material-adicionar>Adicionar material</button>'
      + '</header><div class="corpo sem-padding"><div class="tabela-scroll"><table><thead><tr>'
      + '<th>Material</th><th class="num">Quantidade</th><th>Unidade</th><th class="num">Preço pago</th>'
      + '<th class="num">Estragos</th><th class="num">Custo por unidade</th><th>Nota</th><th></th>'
      + '</tr></thead><tbody>';

    if (!(dados.materiais || []).length) {
      html += '<tr><td colspan="8" style="color:var(--texto-3)">Ainda não há materiais. Começa por um: '
        + '<em>Crachás 32 mm — 1000 unidades — 70 €</em>.</td></tr>';
    }

    (dados.materiais || []).forEach(function (m) {
      var attrs = ' data-op="material" data-id="' + esc(m.id) + '"';
      html += '<tr>'
        + '<td><input type="text" value="' + esc(m.nome) + '" data-original="' + esc(m.nome) + '"' + attrs + ' data-campo="nome"></td>'
        + '<td class="num"><input type="number" min="0" step="any" class="col-s mono" value="' + esc(m.quantidade) + '" data-original="' + esc(m.quantidade) + '"' + attrs + ' data-campo="quantidade"></td>'
        + '<td><input type="text" class="col-m" value="' + esc(m.unidade) + '" data-original="' + esc(m.unidade) + '"' + attrs + ' data-campo="unidade"></td>'
        + '<td class="num"><input type="number" min="0" step="0.01" class="col-s mono" value="' + esc((m.precoCents / 100).toFixed(2)) + '" data-original="' + esc((m.precoCents / 100).toFixed(2)) + '"' + attrs + ' data-campo="precoCents"></td>'
        + '<td class="num"><input type="number" min="0" max="90" step="1" class="col-xs mono" value="' + esc(m.estragosPercent) + '" data-original="' + esc(m.estragosPercent) + '"' + attrs + ' data-campo="estragosPercent"></td>'
        + '<td class="num" style="color:var(--ciano)">' + esc(eurosFinos(custoUnidadeMaterial(m))) + '</td>'
        + '<td><input type="text" value="' + esc(m.nota || "") + '" data-original="' + esc(m.nota || "") + '"' + attrs + ' data-campo="nota" placeholder="onde compras, referência…"></td>'
        + '<td><button class="leve perigo" data-material-remover="' + esc(m.id) + '">×</button></td>'
        + '</tr>';
    });

    html += '</tbody></table></div></div></section>';
    return html;
  }

  // Igual ao mat_custo_unidade_material() do PHP. Aqui só serve para o ecrã
  // responder já; quem manda no valor gravado é sempre o servidor.
  function custoUnidadeMaterial(m) {
    var quantidade = Number(m.quantidade) || 0;
    if (quantidade <= 0) { return 0; }
    return (Number(m.precoCents) || 0) / quantidade * (1 + (Number(m.estragosPercent) || 0) / 100);
  }

  // ── Separador de um produto ──────────────────────────────────────────────

  function abaProduto(chave) {
    var entrada = entradaDoCatalogo(chave);
    var calculo = calculoDe(chave);
    var unidade = entrada ? entrada.unidade : "unidade";
    var preco = entrada ? entrada.precoUnidadeCents : 0;
    var lucro = preco - calculo.totalCents;
    var margem = preco > 0 ? Math.round(lucro / preco * 100) : null;
    var html = "";

    if (!(dados.materiais || []).length) {
      return '<div class="faixa aviso">Primeiro cria os materiais no separador <strong>Materiais</strong>; '
        + 'depois vens cá acrescentá-los a este produto.</div>';
    }

    html += '<div class="resultado">'
      + '<div class="destaque"><span>Custo de 1 ' + esc(unidade) + '</span><strong>' + esc(eurosFinos(calculo.totalCents)) + '</strong></div>'
      + '<div><span>Materiais</span><strong>' + esc(eurosFinos(calculo.materiaisCents)) + '</strong></div>'
      + '<div><span>Tempo</span><strong>' + esc(eurosFinos(calculo.maoDeObraCents)) + '</strong></div>'
      + '<div><span>Preço de 1 à unidade</span><strong>' + esc(euros(preco)) + '</strong></div>'
      + '<div class="' + (lucro >= 0 ? "bom" : "mau") + '"><span>Lucro</span><strong>' + esc(eurosFinos(lucro))
      + (margem === null ? "" : ' <small style="font-size:.7rem">' + margem + '%</small>') + '</strong></div>'
      + '</div>';

    html += '<section class="cartao"><header><h2>Tempo</h2></header><div class="corpo"><div class="juntar">'
      + '<label style="display:flex;align-items:center;gap:9px;font-size:.85rem">Minutos por ' + esc(unidade)
      + '<input type="number" min="0" step="0.5" class="col-s" value="' + esc(calculo.minutosPorUnidade) + '"'
      + ' data-op="minutos" data-produto="' + esc(chave) + '" data-original="' + esc(calculo.minutosPorUnidade) + '"></label>'
      + '<span class="dica">'
      + (dados.custoHoraCents > 0
          ? 'a ' + esc(euros(dados.custoHoraCents)) + '/hora, dá ' + esc(eurosFinos(calculo.maoDeObraCents)) + ' por ' + esc(unidade)
          : 'põe o valor da hora no separador <strong>Materiais</strong> para isto contar')
      + '</span></div></div></section>';

    html += '<section class="cartao"><header><h2>Materiais deste produto</h2>'
      + '<span class="selo">' + calculo.linhas.length + '</span>'
      + '<span class="juntar"><select id="materialNovo" style="width:auto;min-width:200px">'
      + (dados.materiais || []).map(function (m) {
          return '<option value="' + esc(m.id) + '">' + esc(m.nome) + '</option>';
        }).join("")
      + '</select><button data-linha-adicionar="' + esc(chave) + '">Acrescentar</button></span>'
      + '</header><div class="corpo sem-padding"><div class="tabela-scroll"><table><thead><tr>'
      + '<th>Material</th><th class="num">Custo de 1</th>'
      + '<th>Quantos ' + esc(unidade) + 's saem de 1?</th>'
      + '<th>O que essa conta quer dizer</th><th class="num">Por ' + esc(unidade) + '</th><th></th>'
      + '</tr></thead><tbody>';

    if (!calculo.linhas.length) {
      html += '<tr><td colspan="6" style="color:var(--texto-3)">Sem materiais. Escolhe um em cima e carrega em <em>Acrescentar</em>.</td></tr>';
    }

    calculo.linhas.forEach(function (linha, i) {
      var attrs = ' data-op="linha" data-produto="' + esc(chave) + '" data-indice="' + i + '"';
      var resolvido = linha.rendimentoResolvido;
      var mostraConta = String(linha.rendimento).indexOf("*") !== -1 || String(linha.rendimento).toLowerCase().indexOf("x") !== -1;

      html += '<tr>'
        + '<td>' + esc(linha.nome) + (linha.existe ? '' : ' <span class="selo mau">apagado</span>') + '</td>'
        + '<td class="num" style="color:var(--texto-3)">' + esc(eurosFinos(linha.custoMaterialCents)) + '</td>'
        + '<td><input type="text" class="col-m mono" value="' + esc(linha.rendimento) + '" data-original="' + esc(linha.rendimento) + '"'
        + attrs + ' data-campo="rendimento" placeholder="1 ou 100*10*10">'
        + (mostraConta && resolvido > 0 ? '<div class="dica">= ' + esc(numero(resolvido)) + '</div>' : '')
        + (resolvido <= 0 ? '<div class="dica" style="color:var(--rosa)">não é um número</div>' : '')
        + '</td>'
        + '<td><input type="text" value="' + esc(linha.nota || "") + '" data-original="' + esc(linha.nota || "") + '"'
        + attrs + ' data-campo="nota" placeholder="100 cortes × 10 folhas × 10 crachás"></td>'
        + '<td class="num" style="color:var(--ciano)">' + esc(eurosFinos(linha.porUnidadeCents)) + '</td>'
        + '<td><button class="leve perigo" data-linha-remover="' + i + '" data-produto="' + esc(chave) + '">×</button></td>'
        + '</tr>';
    });

    html += '</tbody><tfoot><tr>'
      + '<td colspan="4">Materiais por ' + esc(unidade) + '</td>'
      + '<td class="num">' + esc(eurosFinos(calculo.materiaisCents)) + '</td><td></td>'
      + '</tr></tfoot></table></div></div></section>';

    html += '<section class="cartao"><header><h2>Levar este custo para os preços</h2></header><div class="corpo">'
      + '<p style="margin:0 0 12px;font-size:.84rem;color:var(--texto-2)">'
      + 'O <a href="precos.php">precos.php</a> mostra o lucro por linha e a linha do custo no gráfico a partir de um valor gravado. '
      + 'Isto escreve lá o custo calculado aqui, para não haver dois números diferentes para a mesma coisa.'
      + (entrada && entrada.custoNosPrecosCents !== null
          ? ' Neste momento tem <strong>' + esc(euros(entrada.custoNosPrecosCents)) + '</strong>.'
          : ' Neste momento não tem nada gravado.')
      + '</p>'
      + '<button class="leve" data-enviar="' + esc(chave) + '"' + (calculo.totalCents > 0 ? '' : ' disabled title="O custo ainda é zero."')
      + '>Enviar ' + esc(eurosFinos(calculo.totalCents)) + ' para os preços</button>'
      + '</div></section>';

    return html;
  }

  // ── Separador LLM ────────────────────────────────────────────────────────

  function abaLlm() {
    var linhas = [];
    linhas.push("# Materiais e custos — Mia & Paper");
    linhas.push("");
    linhas.push("Custo da hora de trabalho: " + euros(dados.custoHoraCents));
    linhas.push("");
    linhas.push("## Materiais");
    linhas.push("");
    linhas.push("| Material | Quantidade | Preço pago | Estragos | Custo por unidade | Nota |");
    linhas.push("|---|---:|---:|---:|---:|---|");
    (dados.materiais || []).forEach(function (m) {
      linhas.push("| " + m.nome + " | " + numero(m.quantidade) + " " + (m.unidade || "")
        + " | " + euros(m.precoCents) + " | " + numero(m.estragosPercent) + "% | "
        + eurosFinos(custoUnidadeMaterial(m)) + " | " + (m.nota || "") + " |");
    });
    if (!(dados.materiais || []).length) { linhas.push("| (nenhum) | | | | | |"); }

    linhas.push("");
    linhas.push("## Produtos");

    (dados.catalogo || []).forEach(function (entrada) {
      var calculo = calculoDe(entrada.chave);
      if (!calculo.linhas.length && !calculo.minutosPorUnidade) { return; }
      var lucro = entrada.precoUnidadeCents - calculo.totalCents;

      linhas.push("");
      linhas.push("### " + entrada.etiqueta);
      linhas.push("");
      linhas.push("- Unidade: " + entrada.unidade);
      linhas.push("- Preço de 1 à unidade: " + euros(entrada.precoUnidadeCents));
      linhas.push("- Custo de materiais: " + eurosFinos(calculo.materiaisCents));
      linhas.push("- Tempo: " + numero(calculo.minutosPorUnidade) + " min → " + eurosFinos(calculo.maoDeObraCents));
      linhas.push("- **Custo total por unidade: " + eurosFinos(calculo.totalCents) + "**");
      linhas.push("- Lucro: " + eurosFinos(lucro)
        + (entrada.precoUnidadeCents > 0 ? " (" + Math.round(lucro / entrada.precoUnidadeCents * 100) + "%)" : ""));
      linhas.push("- Custo gravado nos preços: "
        + (entrada.custoNosPrecosCents === null ? "—" : euros(entrada.custoNosPrecosCents)));
      if (calculo.linhas.length) {
        linhas.push("");
        linhas.push("| Material | Custo de 1 | Rende | Por unidade | Nota |");
        linhas.push("|---|---:|---:|---:|---|");
        calculo.linhas.forEach(function (l) {
          linhas.push("| " + l.nome + " | " + eurosFinos(l.custoMaterialCents) + " | "
            + l.rendimento + (String(l.rendimento).indexOf("*") !== -1 ? " = " + numero(l.rendimentoResolvido) : "")
            + " | " + eurosFinos(l.porUnidadeCents) + " | " + (l.nota || "") + " |");
        });
      }
    });

    linhas.push("");
    linhas.push("## Como se calcula");
    linhas.push("");
    linhas.push("- Custo de uma unidade do material = preço pago ÷ quantidade comprada, × (1 + estragos%).");
    linhas.push("- Custo por unidade de produto = custo da unidade do material ÷ quantas unidades saem de 1.");
    linhas.push("- Tempo = minutos por unidade ÷ 60 × custo da hora.");
    linhas.push("- Custo total por unidade = soma dos materiais + tempo.");

    var texto = linhas.join("\n");
    return '<section class="cartao"><header><h2>Tudo em Markdown</h2>'
      + '<button class="leve" id="copiarLlm">Copiar</button></header>'
      + '<div class="corpo sem-padding"><pre id="textoLlm">' + esc(texto) + '</pre></div></section>';
  }

  // ── Separadores ──────────────────────────────────────────────────────────

  function desenharSeparadores() {
    var html = '<button class="destaque' + (aba === "materiais" ? " activo" : "") + '" data-aba="materiais">'
      + 'Materiais<span class="conta">' + (dados.materiais || []).length + '</span></button>';

    html += (dados.catalogo || []).map(function (entrada) {
      var calculo = calculoDe(entrada.chave);
      var feito = calculo.totalCents > 0;
      return '<button class="' + (aba === entrada.chave ? "activo" : "") + '" data-aba="' + esc(entrada.chave) + '">'
        + esc(entrada.etiqueta)
        + '<span class="conta' + (feito ? " feito" : "") + '">'
        + (feito ? eurosFinos(calculo.totalCents) : String(calculo.linhas.length))
        + '</span></button>';
    }).join("");

    html += '<button class="destaque' + (aba === "llm" ? " activo" : "") + '" data-aba="llm">LLM</button>';
    el("separadores").innerHTML = html;
  }

  // Redesenhar reconstrói os campos a partir do `dados`, que não acompanha as
  // edições por gravar — sem isto, mudar de separador fazia as alterações
  // pendentes desaparecerem do ecrã sem saírem da fila.
  function reaplicarFila() {
    Object.keys(fila).forEach(function (chave) {
      var o = fila[chave];
      var selector = "";

      if (o.op === "custo-hora") { selector = '[data-op="custo-hora"]'; }
      else if (o.op === "material") { selector = '[data-op="material"][data-id="' + o.id + '"][data-campo="' + o.campo + '"]'; }
      else if (o.op === "minutos") { selector = '[data-op="minutos"][data-produto="' + o.produto + '"]'; }
      else if (o.op === "linha") { selector = '[data-op="linha"][data-produto="' + o.produto + '"][data-indice="' + o.indice + '"][data-campo="' + o.campo + '"]'; }
      else { return; }

      [].forEach.call(document.querySelectorAll(selector), function (campo) {
        campo.value = o.valor;
        campo.classList.add("sujo");
      });
    });
  }

  function desenhar() {
    el("faixaAberto").hidden = !dados.aberto;
    desenharSeparadores();
    el("conteudoAba").innerHTML = aba === "materiais" ? abaMateriais()
      : (aba === "llm" ? abaLlm() : abaProduto(aba));
    reaplicarFila();
    actualizar();
  }

  // ── Edição ───────────────────────────────────────────────────────────────

  document.addEventListener("input", tratar);
  document.addEventListener("change", tratar);

  function tratar(evento) {
    var alvo = evento.target;
    if (!alvo.dataset || !alvo.dataset.op) { return; }

    var op = alvo.dataset.op;
    var valor = alvo.value;
    var igual = String(alvo.dataset.original) === String(valor);
    var chave;

    alvo.classList.toggle("sujo", !igual);

    if (op === "custo-hora") {
      chave = "custo-hora";
      if (igual) { delete fila[chave]; actualizar(); return; }
      // O ficheiro guarda cêntimos; o ecrã mostra euros.
      enfileirar(chave, { op: "custo-hora", valor: Math.round((parseFloat(valor) || 0) * 100) });
      return;
    }

    if (op === "material") {
      chave = "material:" + alvo.dataset.id + ":" + alvo.dataset.campo;
      if (igual) { delete fila[chave]; actualizar(); return; }
      enfileirar(chave, {
        op: "material", id: alvo.dataset.id, campo: alvo.dataset.campo,
        valor: alvo.dataset.campo === "precoCents" ? Math.round((parseFloat(valor) || 0) * 100) : valor
      });
      return;
    }

    if (op === "minutos") {
      chave = "minutos:" + alvo.dataset.produto;
      if (igual) { delete fila[chave]; actualizar(); return; }
      enfileirar(chave, { op: "minutos", produto: alvo.dataset.produto, valor: valor });
      return;
    }

    if (op === "linha") {
      chave = "linha:" + alvo.dataset.produto + ":" + alvo.dataset.indice + ":" + alvo.dataset.campo;
      if (igual) { delete fila[chave]; actualizar(); return; }
      enfileirar(chave, {
        op: "linha", produto: alvo.dataset.produto,
        indice: parseInt(alvo.dataset.indice, 10), campo: alvo.dataset.campo, valor: valor
      });
    }
  }

  document.addEventListener("click", function (evento) {
    var alvo = evento.target;
    var separador = alvo.closest ? alvo.closest("[data-aba]") : null;
    var addMaterial = alvo.closest ? alvo.closest("[data-material-adicionar]") : null;
    var remMaterial = alvo.closest ? alvo.closest("[data-material-remover]") : null;
    var addLinha = alvo.closest ? alvo.closest("[data-linha-adicionar]") : null;
    var remLinha = alvo.closest ? alvo.closest("[data-linha-remover]") : null;
    var enviar = alvo.closest ? alvo.closest("[data-enviar]") : null;
    var copiar = alvo.id === "copiarLlm" ? alvo : null;

    if (separador) { aba = separador.dataset.aba; desenhar(); return; }

    if (addMaterial) {
      var nome = (window.prompt("Nome do material:") || "").trim();
      if (!nome) { return; }
      enfileirar("material-adicionar:" + nome, { op: "material-adicionar", nome: nome });
      alerta("Material por acrescentar. Falta gravar.", "ok");
      return;
    }

    if (remMaterial) {
      if (!window.confirm("Remover este material? Sai também de todos os produtos onde esteja.")) { return; }
      enfileirar("material-remover:" + remMaterial.dataset.materialRemover,
        { op: "material-remover", id: remMaterial.dataset.materialRemover });
      remMaterial.closest("tr").style.opacity = ".4";
      alerta("Material marcado para remover. Falta gravar.", "ok");
      return;
    }

    if (addLinha) {
      var escolhido = el("materialNovo").value;
      if (!escolhido) { return; }
      enfileirar("linha-adicionar:" + addLinha.dataset.linhaAdicionar + ":" + escolhido + ":" + Date.now(),
        { op: "linha-adicionar", produto: addLinha.dataset.linhaAdicionar, materialId: escolhido });
      alerta("Material por acrescentar a este produto. Falta gravar.", "ok");
      return;
    }

    if (remLinha) {
      // As operações de estrutura só se resolvem no servidor, por isso a lista
      // no ecrã só muda depois do Save: mostrar já a linha fora daria uma
      // numeração diferente da que o servidor vai ver.
      enfileirar("linha-remover:" + remLinha.dataset.produto + ":" + remLinha.dataset.linhaRemover,
        { op: "linha-remover", produto: remLinha.dataset.produto, indice: parseInt(remLinha.dataset.linhaRemover, 10) });
      remLinha.closest("tr").style.opacity = ".4";
      alerta("Linha marcada para remover. Falta gravar.", "ok");
      return;
    }

    if (enviar) {
      enfileirar("enviar:" + enviar.dataset.enviar, { op: "enviar-para-precos", produto: enviar.dataset.enviar });
      alerta("Custo por enviar para os preços. Falta gravar.", "ok");
      return;
    }

    if (copiar) {
      navigator.clipboard.writeText(el("textoLlm").textContent).then(function () {
        alerta("Copiado.", "ok");
      }).catch(function () { alerta("Não consegui copiar. Selecciona e copia à mão.", "erro"); });
    }
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
      desenhar();
      alerta((d.materiais || []).length + " materiais · " + (d.catalogo || []).length + " produtos.", "ok");
    })
    .catch(function (e) { alerta(e.message, "erro"); });
})();
</script>
</body>
</html>
