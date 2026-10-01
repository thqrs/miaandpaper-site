<?php
// ORCAMENTOS_UI_V1
// Orçamentos em PDF, com o logótipo e as cores do site.
//
// Cada orçamento mostra o preço real e cada desconto numa linha própria — o
// cliente vê "100 crachás × 1,75 €", "desconto de quantidade – 20 %",
// "oferta – 3 €" e o total, em vez de um número só. O modelo e as contas estão
// em lib/orcamentos.php; o PDF em lib/orcamento-pdf.php; o estado em
// orcamentos-api.php (base SQLite privada, fora do repositório).

require_once __DIR__ . '/admin-open.php';

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
        . '<title>Acesso negado · Orçamentos</title>'
        . '<style>body{font-family:Georgia,serif;max-width:560px;margin:60px auto;padding:0 20px;color:#3b2f1f}a{color:#4f7a3a;font-weight:700}</style>'
        . '<h1>Acesso restrito.</h1><p>Inicia sessão como administradora a partir do <a href="index.html">site</a> e regressa a esta página.</p>';
    exit;
}
?>
<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Orçamentos · Mia &amp; Paper</title>
<link rel="stylesheet" href="admin-nav.css?v=20261001160327">
<script src="admin-nav.js?v=20261001160327" defer></script>
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
  body {
    margin: 0; background: var(--fundo); color: var(--texto);
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3 { margin: 0; font-weight: 600; letter-spacing: -.015em; }

  .barra {
    position: sticky; top: 0; z-index: 40;
    background: rgba(20,21,58,.9); backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--linha); padding: 14px 24px;
    display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
  }
  .barra h1 { font-size: 1.1rem; margin-right: auto; }
  #alerta { font-size: .82rem; }
  #alerta.ok { color: var(--verde); }
  #alerta.erro { color: var(--rosa); }

  .conteudo {
    display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 20px;
    padding: 22px 24px 120px; max-width: 1340px; margin: 0 auto;
  }
  @media (max-width: 900px) { .conteudo { grid-template-columns: 1fr; padding: 16px 16px 140px; } }

  button {
    font: inherit; font-size: .84rem; padding: 7px 13px; border-radius: 9px;
    border: 1px solid var(--linha-forte); background: var(--cartao);
    color: var(--texto); cursor: pointer;
  }
  button:hover:not(:disabled) { background: var(--cartao-2); border-color: var(--azul); }
  button:disabled { opacity: .38; cursor: default; }
  button.primario { background: var(--azul); border-color: var(--azul); color: #fff; font-weight: 600; box-shadow: 0 4px 14px rgba(77,141,255,.32); }
  button.leve { background: none; border-color: var(--linha); color: var(--texto-2); }
  button.perigo { color: var(--rosa); border-color: rgba(255,77,141,.4); background: none; }
  button.icone { padding: 4px 8px; background: none; border-color: transparent; color: var(--texto-3); }
  button.icone:hover:not(:disabled) { color: var(--texto); }

  .cartao {
    background: var(--cartao); border: 1px solid var(--linha);
    border-radius: var(--raio); box-shadow: var(--sombra); margin-bottom: 16px;
  }
  .cartao > header {
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    padding: 13px 18px; border-bottom: 1px solid var(--linha);
    background: linear-gradient(180deg, rgba(255,255,255,.035), transparent);
    border-radius: var(--raio) var(--raio) 0 0;
  }
  .cartao > header h2 { font-size: 1rem; margin-right: auto; }
  .corpo { padding: 15px 18px; }

  label.campo { display: flex; flex-direction: column; gap: 4px; font-size: .7rem; color: var(--texto-3); text-transform: uppercase; letter-spacing: .07em; }
  input, select, textarea {
    font: inherit; font-size: .88rem; width: 100%; padding: 7px 9px;
    border-radius: 8px; border: 1px solid var(--linha);
    background: var(--campo); color: var(--texto); text-transform: none; letter-spacing: 0;
  }
  textarea { resize: vertical; min-height: 64px; line-height: 1.45; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--azul); box-shadow: 0 0 0 3px rgba(77,141,255,.22); }
  .grelha-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .grelha-3 { display: grid; grid-template-columns: minmax(0, 2fr) repeat(2, minmax(0, 1fr)); gap: 12px; }
  .inteira { grid-column: 1 / -1; }
  @media (max-width: 640px) { .grelha-2, .grelha-3 { grid-template-columns: 1fr; } }

  /* Lista */
  .lista { position: sticky; top: 76px; align-self: start; max-height: calc(100vh - 100px); display: flex; flex-direction: column; }
  @media (max-width: 900px) { .lista { position: static; max-height: 340px; } }
  .lista .corpo { padding: 12px; border-bottom: 1px solid var(--linha); }
  #lista { overflow-y: auto; padding: 6px; }
  .orc {
    display: block; width: 100%; text-align: left; border: 1px solid transparent; background: none;
    padding: 9px 10px; border-radius: 10px; margin-bottom: 2px;
  }
  .orc.activo { background: var(--cartao-2); border-color: var(--linha-forte); }
  .orc .topo { display: flex; justify-content: space-between; gap: 8px; font-size: .78rem; color: var(--texto-3); font-family: var(--mono); }
  .orc strong { display: block; font-size: .9rem; margin: 2px 0 1px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .orc .sub { display: flex; justify-content: space-between; gap: 8px; font-size: .78rem; color: var(--texto-2); }
  .orc .sub span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .orc .sub span:last-child { white-space: nowrap; }
  .vazio { padding: 18px 10px; color: var(--texto-3); font-size: .84rem; text-align: center; }

  .estado { font-size: .64rem; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--linha-forte); color: var(--texto-2); text-transform: uppercase; letter-spacing: .06em; font-family: system-ui, sans-serif; }
  .estado.enviado { color: var(--ciano); border-color: rgba(34,211,238,.45); }
  .estado.aceite { color: var(--verde); border-color: rgba(47,224,160,.45); }
  .estado.recusado { color: var(--rosa); border-color: rgba(255,77,141,.45); }

  /* Linhas */
  .linhas { width: 100%; border-collapse: collapse; }
  .linhas th { font-size: .64rem; text-transform: uppercase; letter-spacing: .08em; color: var(--texto-3); font-weight: 600; text-align: left; padding: 0 6px 8px; }
  .linhas td { padding: 8px 6px; border-top: 1px solid var(--linha); vertical-align: top; }
  .linhas .num { text-align: right; }
  .linhas td.total { font-family: var(--mono); font-size: .9rem; white-space: nowrap; padding-top: 15px; }
  .linhas tr.desconto td { background: rgba(47,224,160,.05); }
  .linhas tr.desconto td.total { color: var(--verde); }
  .linhas .detalhe { margin-top: 5px; font-size: .8rem; color: var(--texto-2); }
  .linhas .accoes { white-space: nowrap; text-align: right; }
  .col-qtd { width: 84px; } .col-preco { width: 112px; } .col-total { width: 110px; } .col-accoes { width: 104px; }
  .desconto-campos { display: grid; grid-template-columns: 70px 1fr; gap: 6px; }
  .tipo-linha { font-size: .62rem; color: var(--verde); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 4px; }
  @media (max-width: 760px) {
    .linhas thead { display: none; }
    .linhas tr { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 10px 0; border-top: 1px solid var(--linha); }
    .linhas td { border: 0; padding: 0; }
    .linhas td.descricao, .linhas td.accoes { grid-column: 1 / -1; }
    .col-qtd, .col-preco, .col-total, .col-accoes { width: auto; }
  }

  .acrescentar { display: flex; gap: 8px; flex-wrap: wrap; align-items: end; padding-top: 14px; }
  .catalogo {
    display: flex; gap: 8px; flex-wrap: wrap; align-items: end; margin-top: 14px;
    padding: 12px; border-radius: 11px; background: var(--campo); border: 1px dashed var(--linha-forte);
  }
  .catalogo label.campo { min-width: 90px; }
  .catalogo .largo { flex: 1 1 180px; }

  .totais { margin-left: auto; max-width: 360px; padding-top: 14px; font-size: .9rem; }
  .totais div { display: flex; justify-content: space-between; gap: 16px; padding: 3px 0; color: var(--texto-2); }
  .totais div b { font-family: var(--mono); font-weight: 500; color: var(--texto); }
  .totais .menos b, .totais .menos { color: var(--verde); }
  .totais .total { margin-top: 6px; padding-top: 9px; border-top: 1px solid var(--linha-forte); font-size: 1.15rem; color: var(--texto); font-weight: 600; }
  .totais .total b { color: var(--ciano); font-weight: 700; }

  .rodape {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 12px 24px;
    background: rgba(16,17,50,.96); border-top: 1px solid var(--linha); backdrop-filter: blur(10px);
  }
  .rodape .resumo { margin-right: auto; font-size: .86rem; color: var(--texto-2); }
  .rodape .resumo b { color: var(--texto); font-family: var(--mono); }
  .rodape .sujo { color: var(--ambar); }

  .modal { position: fixed; inset: 0; z-index: 100; background: rgba(6,7,25,.72); display: flex; align-items: center; justify-content: center; padding: 20px; }
  .modal[hidden] { display: none; }
  .modal .caixa { background: var(--cartao); border: 1px solid var(--linha-forte); border-radius: var(--raio); box-shadow: var(--sombra); width: min(920px, 100%); max-height: 100%; display: flex; flex-direction: column; overflow: hidden; }
  .modal .caixa > header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--linha); }
  .modal .caixa > header h2 { font-size: 1rem; margin-right: auto; }
  .modal iframe { border: 0; width: 100%; height: 82vh; background: #fff; }
  .modal .corpo { overflow-y: auto; }
  .modal .corpo h3 { font-size: .74rem; text-transform: uppercase; letter-spacing: .08em; color: var(--texto-3); margin: 18px 0 10px; }
  .modal .corpo h3:first-child { margin-top: 0; }
  .modal footer { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--linha); }
</style>
</head>
<body>

<header class="barra admin-secondary-bar">
  <h1>Orçamentos</h1>
  <span id="alerta"></span>
  <button id="abrirDefinicoes" class="leve">Definições</button>
  <button id="novo">Novo orçamento</button>
</header>

<div class="conteudo">
  <aside class="cartao lista">
    <div class="corpo"><input type="search" id="procurar" placeholder="Procurar" aria-label="Procurar orçamentos"></div>
    <div id="lista"></div>
  </aside>

  <main>
    <section class="cartao">
      <header><h2 id="tituloEditor">Novo orçamento</h2><span class="estado" id="estadoSelo"></span></header>
      <div class="corpo grelha-3">
        <label class="campo inteira">Assunto<input data-campo="titulo" maxlength="200" placeholder="Crachás para o encontro de primavera"></label>
        <label class="campo">Data<input type="date" data-campo="data"></label>
        <label class="campo">Validade (dias)<input type="number" min="0" max="365" data-campo="validadeDias"></label>
        <label class="campo">Estado
          <select data-campo="estado">
            <option value="rascunho">Rascunho</option>
            <option value="enviado">Enviado</option>
            <option value="aceite">Aceite</option>
            <option value="recusado">Recusado</option>
          </select>
        </label>
      </div>
    </section>

    <section class="cartao">
      <header><h2>Cliente</h2></header>
      <div class="corpo grelha-2">
        <label class="campo">Nome<input data-campo="cliente.nome" maxlength="160" autocomplete="off"></label>
        <label class="campo">Empresa ou entidade<input data-campo="cliente.empresa" maxlength="160" autocomplete="off"></label>
        <label class="campo">Email<input type="email" data-campo="cliente.email" maxlength="160" autocomplete="off"></label>
        <label class="campo">Telefone<input data-campo="cliente.telefone" maxlength="160" autocomplete="off"></label>
        <label class="campo">NIF<input data-campo="cliente.nif" maxlength="160" autocomplete="off"></label>
        <label class="campo">Morada<textarea data-campo="cliente.morada" maxlength="400" rows="2"></textarea></label>
      </div>
    </section>

    <section class="cartao">
      <header><h2>Linhas</h2></header>
      <div class="corpo">
        <table class="linhas">
          <thead><tr><th>Descrição</th><th class="num col-qtd">Qtd.</th><th class="num col-preco">Preço un.</th><th class="num col-total">Total</th><th class="col-accoes"></th></tr></thead>
          <tbody id="linhas"></tbody>
        </table>

        <div class="acrescentar">
          <button id="maisArtigo">+ Artigo</button>
          <button id="maisDesconto">+ Desconto</button>
        </div>

        <div class="catalogo">
          <label class="campo largo">Do catálogo<select id="catProduto"></select></label>
          <label class="campo" id="catChaveCampo">Medida<select id="catChave"></select></label>
          <label class="campo">Quantidade<input type="number" id="catQtd" min="1" max="1000" value="10"></label>
          <label class="campo" id="catImagensCampo">Imagens originais<input type="number" id="catImagens" min="0" max="100" value="0"></label>
          <button id="catAcrescentar">Acrescentar</button>
        </div>

        <div class="totais" id="totais"></div>
      </div>
    </section>

    <section class="cartao">
      <header><h2>Portes e notas</h2></header>
      <div class="corpo grelha-2">
        <label class="campo">Portes · descrição<input data-campo="portesDescricao" maxlength="160" placeholder="Portes"></label>
        <label class="campo">Portes · valor (€)<input data-campo="portes" inputmode="decimal" placeholder="0,00"></label>
        <label class="campo inteira">Notas<textarea data-campo="notas" rows="4" maxlength="4000"></textarea></label>
      </div>
    </section>
  </main>
</div>

<div class="rodape">
  <span class="resumo" id="resumo"></span>
  <button id="apagar" class="perigo">Apagar</button>
  <button id="duplicar" class="leve">Duplicar</button>
  <button id="previa">Pré-visualizar PDF</button>
  <button id="descarregar">Descarregar PDF</button>
  <button id="gravar" class="primario">Gravar</button>
</div>

<div class="modal" id="modalPrevia" hidden>
  <div class="caixa">
    <header><h2 id="tituloPrevia">Pré-visualização</h2><button class="leve" data-fechar>Fechar</button></header>
    <iframe id="framePrevia" title="Pré-visualização do PDF"></iframe>
  </div>
</div>

<div class="modal" id="modalDefinicoes" hidden>
  <div class="caixa" style="width:min(720px,100%)">
    <header><h2>Definições dos orçamentos</h2><button class="leve" data-fechar>Fechar</button></header>
    <div class="corpo" id="formDefinicoes">
      <h3>Empresa</h3>
      <div class="grelha-2">
        <label class="campo">Nome<input data-def="empresa.nome"></label>
        <label class="campo">Titular<input data-def="empresa.titular"></label>
        <label class="campo">NIF<input data-def="empresa.nif"></label>
        <label class="campo">Site<input data-def="empresa.site"></label>
        <label class="campo">Email<input data-def="empresa.email"></label>
        <label class="campo">Telefone<input data-def="empresa.telefone"></label>
        <label class="campo inteira">Morada<textarea data-def="empresa.morada" rows="2"></textarea></label>
        <label class="campo inteira">IBAN<input data-def="empresa.iban"></label>
      </div>
      <h3>IVA</h3>
      <div class="grelha-2">
        <label class="campo">Regime
          <select data-def="ivaModo">
            <option value="nenhum">Não mostrar</option>
            <option value="isento">Isento</option>
            <option value="incluido">Incluído nos preços</option>
            <option value="acrescido">Acrescido aos preços</option>
          </select>
        </label>
        <label class="campo">Taxa (%)<input type="number" min="0" max="100" step="0.01" data-def="ivaTaxa"></label>
        <label class="campo inteira">Menção de isenção<input data-def="mencaoIsencao"></label>
      </div>
      <h3>Por omissão</h3>
      <div class="grelha-2">
        <label class="campo">Validade (dias)<input type="number" min="0" max="365" data-def="validadeDias"></label>
        <label class="campo">Rodapé<input data-def="rodape" placeholder="Nome · site · email · telefone"></label>
        <label class="campo inteira">Notas<textarea data-def="notasPadrao" rows="4"></textarea></label>
      </div>
    </div>
    <footer><button class="leve" data-fechar>Cancelar</button><button class="primario" id="gravarDefinicoes">Gravar definições</button></footer>
  </div>
</div>

<script>
(function () {
  "use strict";

  var API = "orcamentos-api.php";
  var csrf = "";
  var definicoes = null;
  var catalogo = [];
  var lista = [];
  var actual = null;      // { id, numero, orcamento }
  var sujo = false;
  var urlPrevia = "";

  var $ = function (id) { return document.getElementById(id); };

  // ── Utilidades ─────────────────────────────────────────────────────────

  function novoId() {
    var bytes = new Uint8Array(5);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }

  function euros(cents) {
    var negativo = cents < 0;
    var partes = (Math.abs(cents) / 100).toFixed(2).split(".");
    var texto = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ") + "," + partes[1] + " €";
    return negativo ? "– " + texto : texto;
  }

  function paraCents(texto) {
    var limpo = String(texto || "").replace(/[€\s]/g, "").replace(",", ".");
    var n = parseFloat(limpo);
    return isFinite(n) ? Math.round(n * 100) : 0;
  }

  function centsParaTexto(cents) {
    return cents ? (cents / 100).toFixed(2).replace(".", ",") : "";
  }

  function numero(texto) {
    var n = parseFloat(String(texto || "").replace(",", "."));
    return isFinite(n) ? n : 0;
  }

  function escapar(texto) {
    return String(texto == null ? "" : texto).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function hoje() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  function dataPt(ymd) {
    var p = String(ymd || "").split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : ymd;
  }

  function alerta(texto, tipo) {
    var el = $("alerta");
    el.textContent = texto || "";
    el.className = tipo || "";
    if (tipo === "ok") {
      setTimeout(function () { if (el.textContent === texto) { el.textContent = ""; } }, 3500);
    }
  }

  function pedido(accao, corpo, extra) {
    var opcoes = corpo === undefined ? {} : {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-CSRF": csrf },
      body: JSON.stringify(corpo)
    };
    return fetch(API + "?action=" + accao + (extra || ""), opcoes).then(function (r) {
      var tipo = r.headers.get("Content-Type") || "";
      if (tipo.indexOf("application/pdf") === 0) {
        return r.blob();
      }
      return r.json().then(function (d) {
        if (!r.ok || !d.ok) { throw new Error(d.erro || "Erro " + r.status); }
        return d;
      });
    });
  }

  // ── Contas: espelho de orc_totais() em lib/orcamentos.php ──────────────

  function totais(o) {
    var porLinha = {};
    var itens = 0;
    o.linhas.forEach(function (l) {
      if (l.tipo === "item") {
        porLinha[l.id] = Math.round(l.quantidade * l.precoUnitCents);
        itens += porLinha[l.id];
      }
    });
    var descontos = 0;
    o.linhas.forEach(function (l) {
      if (l.tipo !== "desconto") { return; }
      var valor;
      if (l.modo === "valor") {
        valor = -l.valorCents;
      } else {
        var base = l.alvo !== "todos" && porLinha[l.alvo] !== undefined ? porLinha[l.alvo] : itens;
        valor = -Math.round(base * l.percentagem / 100);
      }
      porLinha[l.id] = valor;
      descontos += valor;
    });
    var subtotal = itens + descontos;
    var comPortes = subtotal + o.portesCents;
    var taxa = Number(definicoes.ivaTaxa) || 0;
    var iva = 0;
    var total = comPortes;
    if (definicoes.ivaModo === "acrescido") {
      iva = Math.round(comPortes * taxa / 100);
      total = comPortes + iva;
    } else if (definicoes.ivaModo === "incluido") {
      iva = comPortes - Math.round(comPortes / (1 + taxa / 100));
    }
    return { porLinha: porLinha, itens: itens, descontos: descontos, subtotal: subtotal, iva: iva, total: total };
  }

  // ── Estado ─────────────────────────────────────────────────────────────

  function linhaItem() {
    return { id: novoId(), tipo: "item", descricao: "", detalhe: "", quantidade: 1, precoUnitCents: 0 };
  }

  function linhaDesconto() {
    return { id: novoId(), tipo: "desconto", descricao: "Desconto", detalhe: "", modo: "percent", percentagem: 10, valorCents: 0, alvo: "todos" };
  }

  function orcamentoVazio() {
    return {
      titulo: "", data: hoje(), validadeDias: definicoes.validadeDias, estado: "rascunho",
      cliente: { nome: "", empresa: "", nif: "", email: "", telefone: "", morada: "" },
      linhas: [linhaItem()], portesDescricao: "", portesCents: 0, notas: ""
    };
  }

  function marcarSujo(valor) {
    sujo = valor;
    actualizarResumo();
  }

  function confirmarDescarte() {
    return !sujo || window.confirm("Há alterações por gravar. Continuar sem gravar?");
  }

  function abrir(id, numero, orcamento) {
    actual = { id: id || 0, numero: numero || "", orcamento: orcamento };
    preencherCampos();
    desenharLinhas();
    desenharLista();
    marcarSujo(false);
    var url = new URL(window.location.href);
    if (actual.id) { url.searchParams.set("id", actual.id); } else { url.searchParams.delete("id"); }
    window.history.replaceState(null, "", url.toString());
  }

  function abrirGravado(id) {
    return pedido("obter", undefined, "&id=" + encodeURIComponent(id)).then(function (d) {
      var o = d.orcamento;
      abrir(o.id, o.numero, o);
    });
  }

  // ── Campos gerais ──────────────────────────────────────────────────────

  function lerCampo(o, caminho) {
    if (caminho === "portes") { return centsParaTexto(o.portesCents); }
    return caminho.split(".").reduce(function (obj, k) { return obj ? obj[k] : ""; }, o);
  }

  function escreverCampo(o, caminho, valor) {
    if (caminho === "portes") { o.portesCents = Math.max(0, paraCents(valor)); return; }
    if (caminho === "validadeDias") { o.validadeDias = Math.max(0, Math.min(365, parseInt(valor, 10) || 0)); return; }
    var partes = caminho.split(".");
    var alvo = o;
    for (var i = 0; i < partes.length - 1; i++) { alvo = alvo[partes[i]]; }
    alvo[partes[partes.length - 1]] = valor;
  }

  function preencherCampos() {
    var o = actual.orcamento;
    document.querySelectorAll("[data-campo]").forEach(function (el) {
      var valor = lerCampo(o, el.dataset.campo);
      el.value = valor == null ? "" : valor;
    });
    document.querySelector('[data-campo="notas"]').placeholder = definicoes.notasPadrao || "";
    $("tituloEditor").textContent = actual.numero ? "Orçamento " + actual.numero : "Novo orçamento";
    actualizarSelo();
    $("apagar").disabled = !actual.id;
    $("duplicar").disabled = !actual.id;
  }

  function actualizarSelo() {
    var selo = $("estadoSelo");
    var estado = actual.orcamento.estado;
    selo.textContent = estado;
    selo.className = "estado " + estado;
  }

  document.querySelectorAll("[data-campo]").forEach(function (el) {
    el.addEventListener("input", function () {
      escreverCampo(actual.orcamento, el.dataset.campo, el.value);
      if (el.dataset.campo === "estado") { actualizarSelo(); }
      marcarSujo(true);
      desenharTotais();
    });
    if (el.dataset.campo === "portes") {
      el.addEventListener("blur", function () { el.value = centsParaTexto(actual.orcamento.portesCents); });
    }
  });

  // ── Linhas ─────────────────────────────────────────────────────────────

  function opcoesAlvo(l) {
    var html = '<option value="todos">todos os artigos</option>';
    actual.orcamento.linhas.forEach(function (item, i) {
      if (item.tipo !== "item") { return; }
      html += '<option value="' + item.id + '"' + (l.alvo === item.id ? " selected" : "") + ">"
        + escapar(item.descricao || "Artigo " + (i + 1)) + "</option>";
    });
    return html;
  }

  function desenharLinhas() {
    var o = actual.orcamento;
    var html = "";
    o.linhas.forEach(function (l, i) {
      var accoes = '<td class="accoes">'
        + '<button class="icone" data-mover="-1" data-i="' + i + '" title="Subir"' + (i === 0 ? " disabled" : "") + ">↑</button>"
        + '<button class="icone" data-mover="1" data-i="' + i + '" title="Descer"' + (i === o.linhas.length - 1 ? " disabled" : "") + ">↓</button>"
        + '<button class="icone" data-remover="' + i + '" title="Remover">×</button></td>';
      var descricao = '<td class="descricao">'
        + (l.tipo === "desconto" ? '<div class="tipo-linha">Desconto</div>' : "")
        + '<input data-l="' + i + '" data-k="descricao" value="' + escapar(l.descricao) + '" placeholder="' + (l.tipo === "item" ? "Crachás 32 mm" : "Desconto de quantidade") + '">'
        + '<input class="detalhe" data-l="' + i + '" data-k="detalhe" value="' + escapar(l.detalhe) + '" placeholder="' + (l.tipo === "item" ? "Detalhe (opcional)" : "Detalhe (automático se vazio)") + '"></td>';
      if (l.tipo === "item") {
        html += "<tr>" + descricao
          + '<td class="num"><input class="num" inputmode="decimal" data-l="' + i + '" data-k="quantidade" value="' + escapar(String(l.quantidade).replace(".", ",")) + '"></td>'
          + '<td class="num"><input class="num" inputmode="decimal" data-l="' + i + '" data-k="preco" value="' + centsParaTexto(l.precoUnitCents) + '" placeholder="0,00"></td>'
          + '<td class="num total" data-total="' + l.id + '"></td>' + accoes + "</tr>";
      } else {
        html += '<tr class="desconto">' + descricao
          + '<td colspan="2"><div class="desconto-campos">'
          + '<select data-l="' + i + '" data-k="modo"><option value="percent"' + (l.modo === "percent" ? " selected" : "") + '>%</option><option value="valor"' + (l.modo === "valor" ? " selected" : "") + ">€</option></select>"
          + '<input class="num" inputmode="decimal" data-l="' + i + '" data-k="valor" value="' + (l.modo === "percent" ? String(l.percentagem).replace(".", ",") : centsParaTexto(l.valorCents)) + '">'
          + "</div>"
          + (l.modo === "percent" ? '<select class="detalhe" data-l="' + i + '" data-k="alvo" title="Sobre">' + opcoesAlvo(l) + "</select>" : "")
          + "</td>"
          + '<td class="num total" data-total="' + l.id + '"></td>' + accoes + "</tr>";
      }
    });
    $("linhas").innerHTML = html;
    desenharTotais();
  }

  function desenharTotais() {
    var o = actual.orcamento;
    var t = totais(o);
    document.querySelectorAll("[data-total]").forEach(function (td) {
      td.textContent = euros(t.porLinha[td.dataset.total] || 0);
    });
    var html = "";
    if (t.descontos < 0) {
      html += "<div><span>Preço sem descontos</span><b>" + euros(t.itens) + "</b></div>";
      html += '<div class="menos"><span>Descontos</span><b>' + euros(t.descontos) + "</b></div>";
    }
    if (o.portesCents > 0) {
      html += "<div><span>" + escapar(o.portesDescricao || "Portes") + "</span><b>" + euros(o.portesCents) + "</b></div>";
    }
    if (definicoes.ivaModo === "acrescido") {
      html += "<div><span>IVA " + definicoes.ivaTaxa + " %</span><b>" + euros(t.iva) + "</b></div>";
    }
    html += '<div class="total"><span>Total</span><b>' + euros(t.total) + "</b></div>";
    if (definicoes.ivaModo === "incluido") {
      html += "<div><span>Inclui IVA " + definicoes.ivaTaxa + " %</span><b>" + euros(t.iva) + "</b></div>";
    }
    if (t.descontos < 0 && t.itens > 0) {
      html += '<div class="menos"><span>Poupa</span><b>' + euros(-t.descontos) + " · " + Math.round(-t.descontos * 100 / t.itens) + " %</b></div>";
    }
    $("totais").innerHTML = html;
    actualizarResumo(t);
  }

  function actualizarResumo(t) {
    if (!actual) { return; }
    t = t || totais(actual.orcamento);
    $("resumo").innerHTML = (actual.numero ? "N.º " + escapar(actual.numero) + " · " : "") + "Total <b>" + euros(t.total) + "</b>"
      + (sujo ? ' · <span class="sujo">por gravar</span>' : "");
  }

  $("linhas").addEventListener("input", function (e) {
    var el = e.target;
    if (!el.dataset.k) { return; }
    var l = actual.orcamento.linhas[+el.dataset.l];
    var k = el.dataset.k;
    if (k === "descricao" || k === "detalhe") { l[k] = el.value; }
    else if (k === "quantidade") { l.quantidade = Math.max(0, numero(el.value)); }
    else if (k === "preco") { l.precoUnitCents = paraCents(el.value); }
    else if (k === "valor") {
      if (l.modo === "percent") { l.percentagem = Math.max(0, Math.min(100, numero(el.value))); }
      else { l.valorCents = Math.max(0, paraCents(el.value)); }
    }
    else if (k === "alvo") { l.alvo = el.value; }
    marcarSujo(true);
    desenharTotais();
  });

  $("linhas").addEventListener("change", function (e) {
    var el = e.target;
    var l = el.dataset.l !== undefined ? actual.orcamento.linhas[+el.dataset.l] : null;
    if (!l) { return; }
    if (el.dataset.k === "modo") {
      var t = totais(actual.orcamento);
      // Trocar de % para € mantém o valor descontado, e vice-versa quando dá.
      if (el.value === "valor") { l.valorCents = -(t.porLinha[l.id] || 0); }
      l.modo = el.value;
      desenharLinhas();
      marcarSujo(true);
    } else if (el.dataset.k === "descricao" && l.tipo === "item") {
      // O nome do artigo aparece nos selectores "sobre" dos descontos.
      desenharLinhas();
    } else if (el.dataset.k === "preco") {
      el.value = centsParaTexto(l.precoUnitCents);
    }
  });

  $("linhas").addEventListener("click", function (e) {
    var botao = e.target.closest("button");
    if (!botao) { return; }
    var linhas = actual.orcamento.linhas;
    if (botao.dataset.remover !== undefined) {
      linhas.splice(+botao.dataset.remover, 1);
    } else if (botao.dataset.mover !== undefined) {
      var i = +botao.dataset.i;
      var j = i + (+botao.dataset.mover);
      var tmp = linhas[i]; linhas[i] = linhas[j]; linhas[j] = tmp;
    } else {
      return;
    }
    desenharLinhas();
    marcarSujo(true);
  });

  $("maisArtigo").addEventListener("click", function () {
    actual.orcamento.linhas.push(linhaItem());
    desenharLinhas();
    marcarSujo(true);
    var campos = $("linhas").querySelectorAll('[data-k="descricao"]');
    campos[campos.length - 1].focus();
  });

  $("maisDesconto").addEventListener("click", function () {
    actual.orcamento.linhas.push(linhaDesconto());
    desenharLinhas();
    marcarSujo(true);
  });

  // ── Catálogo ───────────────────────────────────────────────────────────

  function produtoCatalogo() {
    var slug = $("catProduto").value;
    return catalogo.filter(function (p) { return p.slug === slug; })[0] || null;
  }

  function desenharCatalogo() {
    $("catProduto").innerHTML = catalogo.map(function (p) {
      return '<option value="' + escapar(p.slug) + '">' + escapar(p.nome) + "</option>";
    }).join("");
    actualizarCatalogo();
  }

  function actualizarCatalogo() {
    var p = produtoCatalogo();
    if (!p) { return; }
    $("catChave").innerHTML = p.chaves.map(function (c) {
      return '<option' + (c === p.chaveOmissao ? " selected" : "") + ">" + escapar(c) + "</option>";
    }).join("");
    $("catChaveCampo").hidden = p.chaves.length < 2;
    $("catImagensCampo").hidden = !p.imagemCents;
    $("catQtd").min = p.minimo;
    if (+$("catQtd").value < p.minimo) { $("catQtd").value = p.minimo; }
  }

  $("catProduto").addEventListener("change", actualizarCatalogo);

  $("catAcrescentar").addEventListener("click", function () {
    var p = produtoCatalogo();
    if (!p) { return; }
    var botao = this;
    botao.disabled = true;
    pedido("preco", undefined, "&slug=" + encodeURIComponent(p.slug) + "&chave=" + encodeURIComponent($("catChave").value)
      + "&qtd=" + encodeURIComponent($("catQtd").value) + "&imagens=" + encodeURIComponent(p.imagemCents ? $("catImagens").value : 0))
      .then(function (d) {
        var linhas = actual.orcamento.linhas;
        // Uma linha de artigo ainda vazia é substituída em vez de ficar a sobrar.
        if (linhas.length === 1 && linhas[0].tipo === "item" && !linhas[0].descricao && !linhas[0].precoUnitCents) {
          linhas.length = 0;
        }
        Array.prototype.push.apply(linhas, d.linhas);
        desenharLinhas();
        marcarSujo(true);
        alerta("Acrescentado: " + p.nome + " · tabela " + euros(d.totalTabelaCents), "ok");
      })
      .catch(function (erro) { alerta(erro.message, "erro"); })
      .then(function () { botao.disabled = false; });
  });

  // ── Lista ──────────────────────────────────────────────────────────────

  function desenharLista() {
    var termo = $("procurar").value.trim().toLowerCase();
    var filtrada = lista.filter(function (o) {
      return !termo || (o.numero + " " + o.cliente + " " + o.titulo).toLowerCase().indexOf(termo) !== -1;
    });
    if (!filtrada.length) {
      $("lista").innerHTML = '<div class="vazio">' + (lista.length ? "Nada encontrado." : "Ainda não há orçamentos.") + "</div>";
      return;
    }
    $("lista").innerHTML = filtrada.map(function (o) {
      return '<button class="orc' + (actual && actual.id === o.id ? " activo" : "") + '" data-id="' + o.id + '">'
        + '<span class="topo"><span>' + escapar(o.numero) + " · " + dataPt(o.data) + '</span><span class="estado ' + escapar(o.estado) + '">' + escapar(o.estado) + "</span></span>"
        + "<strong>" + escapar(o.cliente || "Sem cliente") + "</strong>"
        + '<span class="sub"><span>' + escapar(o.titulo) + "</span><span>" + euros(o.totalCents) + "</span></span></button>";
    }).join("");
  }

  $("procurar").addEventListener("input", desenharLista);

  $("lista").addEventListener("click", function (e) {
    var botao = e.target.closest("[data-id]");
    if (!botao || !confirmarDescarte()) { return; }
    abrirGravado(+botao.dataset.id).catch(function (erro) { alerta(erro.message, "erro"); });
  });

  // ── Acções ─────────────────────────────────────────────────────────────

  function gravar() {
    $("gravar").disabled = true;
    return pedido("gravar", { id: actual.id, orcamento: actual.orcamento })
      .then(function (d) {
        lista = d.orcamentos;
        abrir(d.orcamento.id, d.orcamento.numero, d.orcamento);
        alerta("Gravado.", "ok");
        return d.orcamento.id;
      })
      .catch(function (erro) { alerta(erro.message, "erro"); throw erro; })
      .then(function (id) { $("gravar").disabled = false; return id; }, function (erro) { $("gravar").disabled = false; throw erro; });
  }

  $("gravar").addEventListener("click", function () { gravar().catch(function () {}); });

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      gravar().catch(function () {});
    }
    if (e.key === "Escape") { fecharModais(); }
  });

  $("novo").addEventListener("click", function () {
    if (!confirmarDescarte()) { return; }
    abrir(0, "", orcamentoVazio());
  });

  $("duplicar").addEventListener("click", function () {
    if (!confirmarDescarte()) { return; }
    var copia = JSON.parse(JSON.stringify(actual.orcamento));
    copia.data = hoje();
    copia.estado = "rascunho";
    abrir(0, "", copia);
    marcarSujo(true);
    alerta("Cópia por gravar: recebe número novo ao gravar.", "ok");
  });

  $("apagar").addEventListener("click", function () {
    if (!actual.id || !window.confirm("Apagar o orçamento " + actual.numero + "? Não se pode desfazer.")) { return; }
    pedido("apagar", { id: actual.id }).then(function (d) {
      lista = d.orcamentos;
      abrir(0, "", orcamentoVazio());
      alerta("Apagado.", "ok");
    }).catch(function (erro) { alerta(erro.message, "erro"); });
  });

  $("previa").addEventListener("click", function () {
    var botao = this;
    botao.disabled = true;
    pedido("previa", { id: actual.id, orcamento: actual.orcamento }).then(function (blob) {
      if (urlPrevia) { URL.revokeObjectURL(urlPrevia); }
      urlPrevia = URL.createObjectURL(blob);
      $("framePrevia").src = urlPrevia;
      $("tituloPrevia").textContent = actual.numero ? "Orçamento " + actual.numero : "Pré-visualização (sem número até gravar)";
      $("modalPrevia").hidden = false;
    }).catch(function (erro) { alerta(erro.message, "erro"); })
      .then(function () { botao.disabled = false; });
  });

  $("descarregar").addEventListener("click", function () {
    var pronto = sujo || !actual.id ? gravar() : Promise.resolve(actual.id);
    pronto.then(function (id) {
      window.location.href = API + "?action=pdf&descarregar=1&id=" + encodeURIComponent(id);
    }).catch(function () {});
  });

  window.addEventListener("beforeunload", function (e) {
    if (sujo) { e.preventDefault(); e.returnValue = ""; }
  });

  // ── Definições ─────────────────────────────────────────────────────────

  function fecharModais() {
    $("modalPrevia").hidden = true;
    $("modalDefinicoes").hidden = true;
  }

  document.querySelectorAll("[data-fechar]").forEach(function (b) { b.addEventListener("click", fecharModais); });
  document.querySelectorAll(".modal").forEach(function (m) {
    m.addEventListener("click", function (e) { if (e.target === m) { fecharModais(); } });
  });

  $("abrirDefinicoes").addEventListener("click", function () {
    document.querySelectorAll("[data-def]").forEach(function (el) {
      var valor = lerCampo(definicoes, el.dataset.def);
      el.value = valor == null ? "" : valor;
    });
    $("modalDefinicoes").hidden = false;
  });

  $("gravarDefinicoes").addEventListener("click", function () {
    var nova = JSON.parse(JSON.stringify(definicoes));
    document.querySelectorAll("[data-def]").forEach(function (el) {
      escreverCampo(nova, el.dataset.def, el.value);
    });
    pedido("definicoes", { definicoes: nova }).then(function (d) {
      definicoes = d.definicoes;
      fecharModais();
      preencherCampos();
      desenharTotais();
      alerta("Definições gravadas.", "ok");
    }).catch(function (erro) { alerta(erro.message, "erro"); });
  });

  // ── Arranque ───────────────────────────────────────────────────────────

  pedido("data").then(function (d) {
    csrf = d.csrf;
    definicoes = d.definicoes;
    catalogo = d.catalogo;
    lista = d.orcamentos;
    desenharCatalogo();
    var id = parseInt(new URLSearchParams(window.location.search).get("id"), 10);
    if (id > 0) {
      return abrirGravado(id).catch(function (erro) {
        alerta(erro.message, "erro");
        abrir(0, "", orcamentoVazio());
      });
    }
    abrir(0, "", orcamentoVazio());
  }).catch(function (erro) { alerta(erro.message, "erro"); });
}());
</script>
</body>
</html>