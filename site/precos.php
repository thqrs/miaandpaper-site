<?php
// PRECOS_UI_V2
// Editor central de precos — painel de controlo.
//
// O que faz: mostra num sitio so TODOS os valores monetarios do site e deixa
// editar a estrutura a serio — quantidades e numero de packs, descontos,
// extras e os seus precos — escrevendo cada coisa de volta no ficheiro onde o
// site ja a le. Nao ha migracao de dados e o caminho de calculo do checkout
// nao muda.
//
// Divisao de responsabilidades:
//  - alteracoes de VALOR e de TEXTO ficam em fila e gravam no botao Guardar;
//  - alteracoes ESTRUTURAIS (packs, extras, modo) gravam logo, arrastando a
//    fila com elas, porque mudam a forma do documento e a pagina tem de voltar
//    a desenhar a partir do estado real do disco.
//
// O botao Verificar corre o cross-check a serio: as funcoes de
// js/10-produto-precos.js dentro de um iframe de uma pagina real, contra as de
// lib/precos-core.php, que sao as que o send-order.php usa para cobrar.
?>
<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Preços · Mia &amp; Paper</title>
<style>
  /* Painel escuro azul-marinho, ao estilo dos dashboards de parede: fundo
     profundo, cartoes com um pouco mais de luz, numeros grandes e um acento
     vivo por metrica. Assumido escuro sempre — nao segue o sistema, porque o
     contraste dos acentos e o ponto todo do esquema. */
  :root {
    --fundo: #14153a;        --fundo-2: #101132;
    --cartao: #1e2050;       --cartao-2: #262a63;    --campo: #171938;
    --linha: #2f3370;        --linha-forte: #3c4288;
    /* --texto-3 e o mais claro que ainda le como "secundario": a 4,97 sobre o
       cartao passa o minimo de contraste, e as etiquetas sao pequenas e em
       maiusculas, onde qualquer coisa mais escura fica ilegivel. */
    --texto: #ffffff;        --texto-2: #a9adde;     --texto-3: #8b8fc6;

    --azul: #4d8dff;         --ciano: #22d3ee;       --rosa: #ff4d8d;
    --verde: #2fe0a0;        --roxo: #a78bfa;        --ambar: #ffb648;

    --ok: var(--verde);      --erro: var(--rosa);    --aviso: var(--ambar);
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
  ::selection { background: var(--azul); color: #fff; }

  /* ── Estrutura ─────────────────────────────────────────────────────────── */
  .app { display: grid; grid-template-columns: 236px 1fr; min-height: 100%; }

  .lateral {
    background: var(--fundo-2); border-right: 1px solid var(--linha);
    padding: 18px 12px; position: sticky; top: 0; height: 100vh; overflow-y: auto;
  }
  .marca { display: flex; align-items: baseline; gap: 8px; padding: 0 8px 16px; }
  .marca strong { font-size: 1.05rem; letter-spacing: -.02em; }
  .marca span { font-size: .7rem; color: var(--texto-3); }
  .lateral h3 {
    font-size: .64rem; text-transform: uppercase; letter-spacing: .12em;
    color: var(--texto-3); padding: 16px 8px 7px; font-weight: 600;
  }
  .nav-item {
    display: flex; align-items: center; gap: 9px; width: 100%;
    padding: 7px 9px; border-radius: 9px; text-decoration: none;
    color: var(--texto-2); font-size: .85rem; border: 0; background: none;
    cursor: pointer; text-align: left; transition: background .13s, color .13s;
  }
  .nav-item:hover { background: var(--cartao); color: var(--texto); }
  .nav-item .ponto {
    width: 7px; height: 7px; border-radius: 50%; background: var(--verde); flex: none;
    box-shadow: 0 0 0 3px rgba(47,224,160,.16);
  }
  .nav-item .ponto.mau { background: var(--rosa); box-shadow: 0 0 0 3px rgba(255,77,141,.18); }
  .nav-item .conta {
    margin-left: auto; font-size: .7rem; color: var(--texto-3);
    font-variant-numeric: tabular-nums; background: var(--cartao);
    padding: 1px 7px; border-radius: 999px;
  }

  .principal { min-width: 0; }

  /* Barra de administração, no topo e igual em todas as páginas de admin. */
  .barra-admin {
    display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
    padding: 8px 24px; background: var(--fundo-2);
    border-bottom: 1px solid var(--linha);
  }
  .barra-admin strong {
    font-size: .74rem; color: var(--texto-3); margin-right: 10px;
    text-transform: uppercase; letter-spacing: .09em;
  }
  .barra-admin a {
    font-size: .8rem; color: var(--texto-2); text-decoration: none;
    padding: 4px 10px; border-radius: 7px; white-space: nowrap;
    transition: background .12s, color .12s;
  }
  .barra-admin a:hover { background: var(--cartao); color: var(--texto); }
  .barra-admin a.activo { background: var(--azul); color: #fff; font-weight: 600; }

  .barra {
    position: sticky; top: 0; z-index: 40;
    background: rgba(20,21,58,.86); backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--linha); padding: 14px 24px;
    display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
  }
  .barra h1 { font-size: 1.1rem; margin-right: auto; }
  .conteudo { padding: 22px 24px 150px; max-width: 1180px; }

  /* ── Peças ─────────────────────────────────────────────────────────────── */
  button {
    font: inherit; font-size: .84rem; padding: 7px 13px; border-radius: 9px;
    border: 1px solid var(--linha-forte); background: var(--cartao);
    color: var(--texto); cursor: pointer;
    transition: background .13s, border-color .13s, transform .08s;
  }
  button:hover:not(:disabled) { background: var(--cartao-2); border-color: var(--azul); }
  button:active:not(:disabled) { transform: translateY(1px); }
  button:disabled { opacity: .38; cursor: default; }
  button.primario {
    background: var(--azul); border-color: var(--azul); color: #fff; font-weight: 600;
    box-shadow: 0 4px 14px rgba(77,141,255,.32);
  }
  button.primario:hover:not(:disabled) { background: #6a9fff; border-color: #6a9fff; }
  button.icone {
    padding: 3px 8px; font-size: .8rem; color: var(--texto-3);
    border-color: transparent; background: none;
  }
  button.icone:hover:not(:disabled) {
    color: var(--rosa); background: rgba(255,77,141,.12); border-color: transparent;
  }
  button.leve { padding: 5px 11px; font-size: .79rem; color: var(--texto-2); }
  button.leve:hover:not(:disabled) { color: var(--texto); }

  /* ── KPIs ──────────────────────────────────────────────────────────────── */
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin-bottom: 22px; }
  .kpi {
    position: relative; overflow: hidden;
    background: var(--cartao); border: 1px solid var(--linha);
    border-radius: var(--raio); padding: 15px 17px; box-shadow: var(--sombra);
  }
  .kpi::before {
    content: ""; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--azul);
  }
  .kpi:nth-child(2)::before { background: var(--ciano); }
  .kpi:nth-child(3)::before { background: var(--roxo); }
  .kpi:nth-child(4)::before { background: var(--verde); }
  .kpi .rotulo {
    font-size: .66rem; text-transform: uppercase; letter-spacing: .11em;
    color: var(--texto-3); font-weight: 600;
  }
  .kpi .valor {
    font-size: 2.1rem; font-weight: 700; line-height: 1.1; margin-top: 5px;
    font-variant-numeric: tabular-nums; letter-spacing: -.03em; color: var(--azul);
  }
  .kpi:nth-child(2) .valor { color: var(--ciano); }
  .kpi:nth-child(3) .valor { color: var(--roxo); }
  .kpi:nth-child(4) .valor { color: var(--verde); }
  .kpi .valor.ok { color: var(--verde); }
  .kpi .valor.mau { color: var(--rosa); }
  .kpi .sub { font-size: .72rem; color: var(--texto-3); margin-top: 2px; }

  /* ── Cartões ───────────────────────────────────────────────────────────── */
  .cartao {
    background: var(--cartao); border: 1px solid var(--linha);
    border-radius: var(--raio); box-shadow: var(--sombra);
    margin-bottom: 18px; overflow: hidden; scroll-margin-top: 74px;
  }
  .cartao > header {
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    padding: 14px 18px; border-bottom: 1px solid var(--linha);
    background: linear-gradient(180deg, rgba(255,255,255,.035), transparent);
  }
  .cartao > header h2 { font-size: 1rem; }
  .miniatura {
    width: 34px; height: 34px; border-radius: 8px; flex: none; object-fit: cover;
    background: var(--campo); border: 1px solid var(--linha);
  }
  .miniatura--vazia {
    display: grid; place-items: center; font-size: .68rem; font-weight: 700;
    color: var(--texto-3); letter-spacing: .04em;
  }

  /* Grelha de produtos com imagem grande, para saltar de relance. */
  .grelha-produtos {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(116px, 1fr)); gap: 12px;
  }
  .cartao-produto {
    display: flex; flex-direction: column; gap: 6px; text-decoration: none;
    padding: 9px; border-radius: 11px; border: 1px solid var(--linha);
    background: var(--campo); transition: border-color .13s, transform .1s;
  }
  .cartao-produto:hover { border-color: var(--azul); transform: translateY(-2px); }
  .cartao-produto.mau { border-color: var(--rosa); }
  .cartao-produto-imagem {
    display: block; width: 100%; aspect-ratio: 1; border-radius: 8px;
    background: var(--fundo-2) center/cover no-repeat;
  }
  .cartao-produto-imagem.vazia {
    display: grid; place-items: center; font-size: 1.3rem; font-weight: 700; color: var(--texto-3);
  }
  .cartao-produto-nome { font-size: .8rem; color: var(--texto); font-weight: 500; line-height: 1.25; }
  .cartao-produto-slug { font-size: .68rem; color: var(--texto-3); font-family: var(--mono); }
  .cartao > .corpo { padding: 16px 18px; }

  .selo {
    font-size: .68rem; padding: 3px 9px; border-radius: 999px; font-weight: 500;
    border: 1px solid var(--linha-forte); color: var(--texto-2);
    background: var(--campo); white-space: nowrap;
  }
  .selo.mono { font-family: var(--mono); color: var(--texto-3); }
  .selo.ok { color: var(--verde); border-color: rgba(47,224,160,.45); background: rgba(47,224,160,.1); }
  .selo.mau { color: var(--rosa); border-color: rgba(255,77,141,.5); background: rgba(255,77,141,.12); }

  .seccao-titulo {
    display: flex; align-items: center; gap: 10px; margin: 22px 0 9px;
    font-size: .7rem; text-transform: uppercase; letter-spacing: .11em;
    color: var(--texto-3); font-weight: 600;
  }
  .seccao-titulo:first-child { margin-top: 0; }
  .seccao-titulo::after { content: ""; flex: 1; height: 1px; background: var(--linha); }

  /* ── Tabelas ───────────────────────────────────────────────────────────── */
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 6px 10px; text-align: left; font-size: .85rem; border-bottom: 1px solid var(--linha); }
  th {
    font-size: .65rem; text-transform: uppercase; letter-spacing: .09em;
    color: var(--texto-3); font-weight: 600;
  }
  tbody tr:last-child td { border-bottom: 0; }
  tbody tr { transition: background .12s; }
  tbody tr:hover { background: rgba(255,255,255,.032); }
  td.numerico { font-variant-numeric: tabular-nums; color: var(--texto-2); }
  .col-estreita { width: 112px; }
  /* DESCONTOS_COLUNAS_V1: a coluna que está a vender destaca-se; as outras são
     rascunhos e ficam esbatidas para não se confundirem com o preço a sério. */
  th.col-desconto { text-align: center; white-space: nowrap; }
  th.col-desconto label { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
  th.col-desconto input { width: auto; margin: 0; accent-color: var(--azul); }
  td.col-desconto input { opacity: .5; }
  th.col-desconto.activa { color: var(--azul); }
  td.col-desconto.activa input { opacity: 1; border-color: var(--linha-forte); }

  .nota-corpo { margin: 0 0 12px; font-size: .84rem; color: var(--texto-2); }
  .coluna-global { display: flex; gap: 8px; flex-wrap: wrap; }
  .coluna-global button { display: inline-flex; align-items: center; gap: 7px; }
  .coluna-global button.activa { border-color: var(--azul); color: var(--azul); }
  .coluna-global .conta {
    font-size: .66rem; padding: 1px 6px; border-radius: 999px;
    background: var(--campo); border: 1px solid var(--linha); color: var(--texto-3);
  }

  .col-accao { width: 42px; text-align: right; }

  input[type="text"] {
    font: inherit; font-size: .85rem; width: 100%; padding: 5px 8px;
    border-radius: 8px; border: 1px solid var(--linha);
    background: var(--campo); color: var(--texto);
    transition: border-color .13s, box-shadow .13s, background .13s;
  }
  input[type="text"]:hover { border-color: var(--linha-forte); }
  input[type="text"]:focus {
    outline: none; border-color: var(--azul); background: #1b1d44;
    box-shadow: 0 0 0 3px rgba(77,141,255,.22);
  }
  input.dinheiro, input.quantidade { text-align: right; font-variant-numeric: tabular-nums; }
  input.sujo {
    border-color: var(--ambar); background: rgba(255,182,72,.11); color: var(--ambar);
    box-shadow: 0 0 0 3px rgba(255,182,72,.13);
  }
  input.mau {
    border-color: var(--rosa); background: rgba(255,77,141,.12); color: var(--rosa);
    box-shadow: 0 0 0 3px rgba(255,77,141,.15);
  }
  input:disabled { opacity: .42; }
  select {
    font: inherit; font-size: .78rem; padding: 5px 9px; border-radius: 8px;
    border: 1px solid var(--linha-forte); background: var(--campo); color: var(--texto);
    cursor: pointer;
  }
  select:hover { border-color: var(--azul); }
  select:focus { outline: none; border-color: var(--azul); box-shadow: 0 0 0 3px rgba(77,141,255,.22); }

  /* Custo do material e lucro. O custo vive na pasta privada, nunca no
     pricing.json público — margens não se publicam. */
  .custo-linha {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    padding: 9px 12px; margin-bottom: 9px; border-radius: 10px;
    background: rgba(167,139,250,.08); border: 1px solid rgba(167,139,250,.28);
  }
  .custo-linha label {
    font-size: .68rem; text-transform: uppercase; letter-spacing: .09em;
    color: var(--roxo); font-weight: 600;
  }
  .custo-linha input { width: 104px; flex: none; }
  .custo-nota { font-size: .74rem; color: var(--texto-3); }

  td.celula-lucro, td.celula-margem { color: var(--verde); font-weight: 600; }
  td.celula-lucro.negativo, td.celula-margem.negativo { color: var(--rosa); }
  td.celula-lucro.sem-custo, td.celula-margem.sem-custo { color: var(--texto-3); font-weight: 400; }

  .caminho { font-family: var(--mono); font-size: .72rem; color: var(--texto-3); margin-top: 2px; }

  .nota { font-size: .79rem; color: var(--texto-2); margin: 0 0 11px; }
  .vazio { font-size: .82rem; color: var(--texto-3); font-style: italic; }

  /* Tabs, uma por produto. Arrastam-se para reordenar. */
  .tabs {
    display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 18px;
    padding-bottom: 10px; border-bottom: 1px solid var(--linha);
  }
  .tab {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: .82rem; padding: 6px 12px; border-radius: 9px 9px 0 0;
    border: 1px solid transparent; background: none; color: var(--texto-2);
    cursor: pointer; white-space: nowrap;
  }
  .tab:hover { background: var(--cartao); color: var(--texto); }
  .tab.activa {
    background: var(--cartao); border-color: var(--linha); color: var(--texto);
    font-weight: 600; box-shadow: inset 0 -2px 0 var(--azul);
  }
  .tab.mau { color: var(--rosa); }
  .tab.a-arrastar { opacity: .4; }
  .tab-thumb { width: 18px; height: 18px; border-radius: 4px; object-fit: cover; }

  /* Gráfico do preço por unidade. A linha existe para todas as quantidades e
     lê-se em qualquer ponto, como o gráfico das páginas de quantidade.
     Escala uniforme (sem preserveAspectRatio="none"): assim a curva mantém a
     proporção e o texto não sai esticado. */
  .curva-envolvente {
    position: relative; margin-top: 10px; padding: 6px 0;
    border-radius: 10px; background: rgba(255,255,255,.02);
  }
  .curva { display: block; width: 100%; height: auto; overflow: visible; cursor: crosshair; }
  .linha-preco { stroke: var(--ciano); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
  .marca-pack { fill: var(--ciano); opacity: .55; }
  .linha-custo { stroke: var(--rosa); stroke-width: 1; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; opacity: .8; }
  .rotulo-custo { fill: var(--rosa); font-size: 15px; font-family: var(--mono); opacity: .9; }
  .agulha { stroke: var(--texto-3); stroke-width: 1; vector-effect: non-scaling-stroke; opacity: .5; }
  .bola { fill: var(--ciano); stroke: var(--fundo); stroke-width: 1.5; }

  .curva-dica {
    position: absolute; bottom: calc(100% + 4px); z-index: 5;
    background: var(--fundo-2); border: 1px solid var(--linha-forte);
    border-radius: 9px; padding: 7px 10px; pointer-events: none;
    box-shadow: var(--sombra); white-space: nowrap;
    display: flex; flex-direction: column; gap: 1px;
  }
  .curva-dica strong { font-size: .82rem; color: var(--ciano); }
  .curva-dica span { font-size: .74rem; color: var(--texto-2); font-variant-numeric: tabular-nums; }
  .curva-dica span.negativo { color: var(--rosa); }

  .faixa {
    border-radius: var(--raio); padding: 13px 16px; margin-bottom: 18px;
    font-size: .84rem; border: 1px solid; line-height: 1.5;
  }
  .faixa.aviso { background: rgba(255,182,72,.1); border-color: rgba(255,182,72,.42); color: var(--texto); }
  .faixa.aviso strong { color: var(--ambar); }
  .faixa.erro { background: rgba(255,77,141,.11); border-color: rgba(255,77,141,.45); }

  /* ── Barra de gravação ─────────────────────────────────────────────────── */
  .rodape {
    position: fixed; left: 236px; right: 0; bottom: 0; z-index: 50;
    background: rgba(30,32,80,.94); backdrop-filter: blur(10px);
    border-top: 1px solid var(--linha-forte);
    padding: 13px 24px; display: flex; gap: 12px; align-items: center;
    box-shadow: 0 -8px 28px rgba(0,0,0,.4); transform: translateY(115%);
    transition: transform .2s cubic-bezier(.2,.7,.3,1);
  }
  .rodape.aberta { transform: none; }
  .rodape .resumo { font-size: .85rem; color: var(--texto-2); }
  .rodape .resumo strong { color: var(--ambar); font-size: 1rem; }
  .rodape-nota { font-size: .78rem; color: var(--texto-3); margin-right: auto; }
  .rodape-nota strong { color: var(--azul); }

  .diag {
    font-family: var(--mono); font-size: .77rem; white-space: pre-wrap; line-height: 1.6;
    max-height: 340px; overflow: auto; background: var(--fundo-2);
    border: 1px solid var(--linha); border-radius: 10px; padding: 13px; margin: 0;
    color: var(--texto-2);
  }
  #alerta { font-size: .82rem; color: var(--texto-2); }
  #alerta.ok { color: var(--verde); }
  #alerta.erro { color: var(--rosa); }
  iframe.motor { position: absolute; width: 340px; height: 220px; left: -10000px; top: 0; border: 0; }

  ::-webkit-scrollbar { width: 11px; height: 11px; }
  ::-webkit-scrollbar-track { background: var(--fundo-2); }
  ::-webkit-scrollbar-thumb { background: var(--linha-forte); border-radius: 99px; border: 3px solid var(--fundo-2); }
  ::-webkit-scrollbar-thumb:hover { background: var(--texto-3); }

  @media (max-width: 860px) {
    .app { grid-template-columns: 1fr; }
    .lateral { position: static; height: auto; }
    .rodape { left: 0; }
    .conteudo { padding: 16px 14px 150px; }
  }
</style>
</head>
<body>

<div class="app">
  <aside class="lateral">
    <div class="marca"><strong>Preços</strong><span>Mia &amp; Paper</span></div>
    <h3>Produtos</h3>
    <nav id="nav"></nav>
    <h3>Ferramentas</h3>
    <button class="nav-item" id="verMarkdown">Vista Markdown</button>
    <button class="nav-item" id="verificar">Verificar preços</button>
    <button class="nav-item" id="recarregar">Recarregar do disco</button>

  </aside>

  <div class="principal">
    <nav class="barra-admin" aria-label="Administração">
      <strong>Mia &amp; Paper Admin</strong>
      <a href="produtos.html">Produtos</a>
      <a href="galeria.html">Galeria</a>
      <a href="multimedia.html">Multimédia</a>
      <a href="reviews.html">Reviews</a>
      <a href="precos.php" class="activo">Preços</a>
  <a href="materiais.php">Materiais</a>
      <a href="homepage-menu-design.php">Homepage &amp; Menu</a>
  <a href="carrousel.php">Carrosséis</a>
      <a href="admin-funnel.php">Funil</a>
      <a href="admin-orders.php">Encomendas</a>
      <a href="admin-colors.html">Cores</a>
      <a href="admin-uploads.php">Uploads</a>
      <a href="tools/index.php">Ferramentas</a>
    </nav>
    <header class="barra">
      <h1>Todos os preços do site</h1>
      <span id="alerta"></span>
      <button id="desfazer" disabled title="Desfaz a última alteração ainda por gravar">Undo</button>
      <button id="guardar" class="primario" disabled>Save</button>
    </header>

    <div class="conteudo">
      <div class="faixa aviso" id="faixaAberto" hidden>
        <strong>Editor aberto sem autenticação</strong>, nos mesmos termos da galeria.
        Quem alcançar o servidor consegue alterar todos os preços.
        Antes do deploy, pôr <code>MIA_ADMIN_OPEN</code> a <code>false</code> em <code>admin-open.php</code>.
      </div>

      <div class="kpis" id="kpis"></div>
      <nav class="tabs" id="tabs" aria-label="Produtos"></nav>
      <div id="conteudo"></div>

      <section class="cartao" id="cartaoMarkdown" hidden>
        <header>
          <h2>Vista Markdown</h2>
          <span class="selo">para colar num LLM</span>
          <button class="leve" id="copiarMarkdown">Copiar tudo</button>
          <button class="leve" id="fecharMarkdown">Fechar</button>
        </header>
        <div class="corpo">
          <p class="nota">Todos os preços, custos, margens e estados numa só página de texto.
            Inclui o que ainda está por gravar, para se poder pedir revisão antes de publicar.</p>
          <pre class="diag" id="markdown"></pre>
        </div>
      </section>

      <section class="cartao" id="cartaoDiag" hidden>
        <header><h2>Cross-check JS ↔ PHP</h2></header>
        <div class="corpo">
          <p class="nota">As funções reais das duas implementações sobre todas as tabelas e todas as quantidades até 500, comparadas cêntimo a cêntimo.</p>
          <pre class="diag" id="diag"></pre>
        </div>
      </section>
    </div>
  </div>
</div>

<div class="rodape" id="rodape">
  <span class="resumo" id="resumo"></span>
  <span class="rodape-nota">Nada disto toca no site até carregares em <strong>Save</strong>.</span>
  <button id="descartar">Descartar tudo</button>
</div>

<iframe class="motor" id="motor" src="stickers.html" title="motor de preços"></iframe>

<script>
(function () {
  "use strict";

  var API = "precos-api.php";
  var dados = null;
  var fila = Object.create(null);     // chave -> operação pendente

  var el = function (id) { return document.getElementById(id); };
  var elAlerta = el("alerta"), elDiag = el("diag"), elCartaoDiag = el("cartaoDiag");

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function attr(o) { return esc(JSON.stringify(o)); }

  // Cêntimos <-> euros. O inteiro é a verdade; o campo é só apresentação.
  function euros(cents) {
    return (Math.max(0, parseInt(cents, 10) || 0) / 100).toFixed(2).replace(".", ",");
  }
  function paraCents(texto) {
    var limpo = String(texto == null ? "" : texto).trim().replace(/\s|€/g, "").replace(",", ".");
    if (limpo === "" || !/^\d+(\.\d{0,2})?$/.test(limpo)) { return null; }
    return Math.round(parseFloat(limpo) * 100);
  }
  function percent(texto) {
    var limpo = String(texto == null ? "" : texto).trim().replace(/\s|%/g, "").replace(",", ".");
    if (limpo === "" || !/^\d+(\.\d{1,2})?$/.test(limpo)) { return null; }
    var n = parseFloat(limpo);
    return n >= 0 && n < 100 ? n : null;
  }

  function alerta(texto, classe) {
    elAlerta.textContent = texto;
    elAlerta.className = classe || "";
  }

  // ── Fila de alterações e Undo ────────────────────────────────────────────
  // NADA escreve em ficheiro antes do Save. As alterações de valor ficam na
  // fila; as estruturais (packs, extras, modo, cápsula) são aplicadas a uma
  // cópia LOCAL dos dados, para a página mostrar o resultado, e só seguem para
  // o servidor quando se carrega em Save.
  //
  // O Undo é uma pilha de fotografias do par (dados, fila) — a mesma ideia do
  // pushUndo() do admin do site, que também guarda o produto inteiro.

  var pilhaUndo = [];
  var LIMITE_UNDO = 60;

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }

  function marcarUndo() {
    pilhaUndo.push({ dados: clonar(dados), fila: clonar(fila) });
    if (pilhaUndo.length > LIMITE_UNDO) { pilhaUndo.shift(); }
  }

  function desfazer() {
    var anterior = pilhaUndo.pop();
    if (!anterior) { return; }
    dados = anterior.dados;
    fila = anterior.fila;
    desenhar();
    alerta("Desfeito.", "");
  }

  function nPendentes() { return Object.keys(fila).length; }

  function actualizarRodape() {
    var n = nPendentes();
    el("rodape").classList.toggle("aberta", n > 0);
    el("resumo").innerHTML = n
      ? "<strong>" + n + "</strong> alteraç" + (n === 1 ? "ão" : "ões") + " por gravar"
      : "";
    el("guardar").disabled = n === 0;
    el("guardar").textContent = n === 0 ? "Save" : "Save (" + n + ")";
    el("desfazer").disabled = pilhaUndo.length === 0;
  }

  // Uma fotografia por campo tocado: mexer duas vezes no mesmo campo conta
  // como uma alteração para o Undo, mas campos diferentes empilham-se.
  var ultimaChaveUndo = "";
  function marcarUndoDeCampo(chave) {
    if (ultimaChaveUndo === chave) { return; }
    ultimaChaveUndo = chave;
    marcarUndo();
  }

  function enfileirar(chave, operacao) {
    marcarUndoDeCampo(chave);
    fila[chave] = operacao;
    actualizarRodape();
  }
  function desenfileirar(chave) {
    delete fila[chave];
    actualizarRodape();
  }

  function operacoes() {
    return Object.keys(fila).map(function (k) { return fila[k]; });
  }

  // Aplica uma operação estrutural à cópia local e põe-na na fila. A chave é
  // única por operação, para várias alterações estruturais se acumularem.
  var contadorEstrutural = 0;
  function estrutural(operacao, aplicarLocal) {
    marcarUndo();
    try {
      aplicarLocal();
    } catch (erro) {
      pilhaUndo.pop();
      alerta("Não consegui aplicar: " + erro.message, "erro");
      return;
    }
    contadorEstrutural++;
    fila["estrutural:" + contadorEstrutural] = operacao;
    ultimaChaveUndo = "";
    desenhar();
  }

  // ── Desconto ─────────────────────────────────────────────────────────────
  // O desconto não é guardado em lado nenhum: é derivado. A base é o preço
  // unitário da quantidade mais baixa da tabela, que é exactamente o que o
  // `product_tier_price_cents` usa como escalão de referência.

  function baseUnitaria(tabela) {
    var qs = Object.keys(tabela).map(Number).filter(function (n) { return n > 0; });
    if (!qs.length) { return 0; }
    var menor = Math.min.apply(null, qs);
    return tabela[String(menor)] / menor;
  }
  function descontoDe(tabela, q) {
    var base = baseUnitaria(tabela);
    if (!base) { return 0; }
    return (1 - (tabela[String(q)] / q) / base) * 100;
  }
  function centsParaDesconto(tabela, q, pct) {
    var base = baseUnitaria(tabela);
    return Math.round(q * base * (1 - pct / 100));
  }

  // DESCONTOS_COLUNAS_V1: quatro escadas de desconto por tabela — D1 a D4 — com
  // uma activa. Os preços continuam a ser a `prices`: escolher uma coluna
  // converte-a em totais, porque é a `prices` que o site lê. As percentagens
  // ficam gravadas para se poder voltar atrás sem as reescrever à mão.
  var COLUNAS = ["D1", "D2", "D3", "D4"];

  function quantidadesDe(tabela) {
    return Object.keys(tabela).map(Number).filter(function (n) { return n > 0; })
      .sort(function (a, b) { return a - b; });
  }

  // Devolve o bloco vivo. Se ainda não existir, nasce com as quatro colunas
  // iguais ao desconto que a tabela já tem — é o que põe os descontos actuais
  // em D1 sem mudar nada no site.
  function descontosDe(slug, priceKey, tabela) {
    var registo = dados.pricing.products[slug];
    var actuais;

    if (!registo.discountsByPriceKey) { registo.discountsByPriceKey = {}; }
    if (!registo.discountsByPriceKey[priceKey]) {
      actuais = {};
      quantidadesDe(tabela).forEach(function (q) {
        actuais[String(q)] = Math.round(descontoDe(tabela, q) * 10) / 10;
      });
      registo.discountsByPriceKey[priceKey] = { activo: "D1" };
      COLUNAS.forEach(function (coluna) {
        registo.discountsByPriceKey[priceKey][coluna] = JSON.parse(JSON.stringify(actuais));
      });
    }

    // Uma quantidade acrescentada depois entra nas quatro colunas.
    quantidadesDe(tabela).forEach(function (q) {
      COLUNAS.forEach(function (coluna) {
        var bloco = registo.discountsByPriceKey[priceKey];
        if (!bloco[coluna]) { bloco[coluna] = {}; }
        if (bloco[coluna][String(q)] == null) {
          bloco[coluna][String(q)] = Math.round(descontoDe(tabela, q) * 10) / 10;
        }
      });
    });
    return registo.discountsByPriceKey[priceKey];
  }

  function enfileirarDescontos(slug, priceKey, tabela) {
    enfileirar("descontos:" + slug + ":" + priceKey, {
      op: "descontos", slug: slug, priceKey: priceKey,
      bloco: descontosDe(slug, priceKey, tabela)
    });
  }

  // Passa a tabela a seguir esta coluna: cada quantidade fica com o total que a
  // percentagem manda. O primeiro escalão é a referência e não se mexe.
  function aplicarColuna(slug, priceKey, coluna) {
    var tabela = dados.pricing.products[slug].prices[priceKey];
    var bloco = descontosDe(slug, priceKey, tabela);
    var qs = quantidadesDe(tabela);

    bloco.activo = coluna;
    qs.forEach(function (q, i) {
      if (i === 0) { return; }
      var pct = Number(bloco[coluna][String(q)]) || 0;
      // A percentagem é guardada a uma casa decimal, e reconstruir o total a
      // partir dela perde cêntimos: 30,6% de 48 unidades dá 49,97 € e não os
      // 50,00 € que lá estão. Se a coluna diz o mesmo que a tabela já diz, não
      // se lhe toca — mudar de coluna nunca pode mexer num preço por si.
      if (Math.abs(pct - descontoDe(tabela, q)) < 0.05) { return; }
      var cents = centsParaDesconto(tabela, q, pct);
      var trail = ["products", slug, "prices", priceKey, String(q)];
      tabela[String(q)] = cents;
      enfileirar("valor:pricing:" + JSON.stringify(trail),
        { op: "valor", ficheiro: "pricing", trail: trail, cents: cents });
    });
    enfileirarDescontos(slug, priceKey, tabela);
  }

  // ── Curva de preço por unidade ───────────────────────────────────────────
  // Serve para ver de relance se a escada é monótona. Uma subida assinala que
  // uma quantidade custa mais do que a seguinte — acontece de propósito no
  // pack-combination, mas convém ser visível.

  // Preço de UMA quantidade qualquer, com as funções reais do site (vêm do
  // iframe de uma página de produto). É o mesmo cálculo que o cliente vê e que
  // o cross-check prova estar de acordo com o PHP.
  function precoDe(tabela, modo, q, preferFewerPacks) {
    var motor = el("motor").contentWindow;
    if (motor && modo === "tier-unit" && typeof motor.tierPriceCents === "function") {
      return motor.tierPriceCents(tabela, q);
    }
    if (motor && modo === "pack-combination" && typeof motor.packCombinationPlan === "function") {
      var plano = motor.packCombinationPlan(tabela, q, !!preferFewerPacks);
      return plano ? plano.cents : null;
    }
    // flat-unit: proporcional ao preço de uma unidade.
    var base = tabela["1"] != null ? tabela["1"] : baseUnitaria(tabela);
    return Math.round(base * q);
  }

  // Gráfico contínuo do preço por unidade, no espírito do
  // FREE_QUANTITY_PRICE_CHART das páginas de quantidade: a linha existe para
  // TODAS as quantidades, não só para os packs, e lê-se em qualquer ponto.
  function curva(tabela, custo, modo, preferFewerPacks) {
    var qs = Object.keys(tabela).map(Number).sort(function (a, b) { return a - b; });
    if (qs.length < 2) { return ""; }

    var maior = qs[qs.length - 1];
    var maximo = Math.max(qs[0] + 10, Math.ceil(maior * 1.2));
    // Caixa larga e com altura folgada: a escala é uniforme, por isso é esta
    // proporção que decide se a curva sai achatada ou legível.
    var L = 1000, A = 300, esq = 16, dir = 16, topo = 26, baixo = 26;
    var largura = L - esq - dir, altura = A - topo - baixo;

    // Série completa: uma leitura por quantidade encomendável.
    var serie = [];
    for (var q = qs[0]; q <= maximo; q++) {
      var cents = precoDe(tabela, modo, q, preferFewerPacks);
      if (cents !== null && cents > 0) { serie.push({ q: q, cents: cents, unit: cents / q }); }
    }
    if (serie.length < 2) { return ""; }

    var unidades = serie.map(function (p) { return p.unit; });
    var min = Math.min.apply(null, unidades);
    var max = Math.max.apply(null, unidades);
    if (custo > 0) { min = Math.min(min, custo); max = Math.max(max, custo); }
    var amp = (max - min) || 1;

    function px(q) { return esq + ((q - serie[0].q) / (maximo - serie[0].q || 1)) * largura; }
    function py(v) { return topo + altura - ((v - min) / amp) * altura; }

    var linha = serie.map(function (p, i) {
      return (i ? "L" : "M") + px(p.q).toFixed(1) + " " + py(p.unit).toFixed(1);
    }).join(" ");

    // Linha do preço de produção. Tudo o que esteja abaixo dela dá prejuízo.
    var linhaCusto = "";
    if (custo > 0) {
      var y = py(custo).toFixed(1);
      linhaCusto = '<line class="linha-custo" x1="' + esq + '" y1="' + y + '" x2="' + (L - dir) + '" y2="' + y + '"></line>'
        + '<text class="rotulo-custo" x="' + (esq + 6) + '" y="' + (py(custo) - 7).toFixed(1) + '">produção ' + esc(euros(custo)) + " €/un</text>";
    }

    // Marcas dos packs configurados, para se saber onde estão os degraus.
    var marcas = qs.filter(function (q) { return q <= maximo; }).map(function (q) {
      var p = serie.filter(function (s) { return s.q === q; })[0];
      if (!p) { return ""; }
      return '<circle class="marca-pack" cx="' + px(q).toFixed(1) + '" cy="' + py(p.unit).toFixed(1) + '" r="5"></circle>';
    }).join("");

    var dados = serie.map(function (p) { return p.q + ":" + p.cents; }).join(",");

    return '<svg class="curva" viewBox="0 0 ' + L + " " + A + '"'
      + ' data-serie="' + esc(dados) + '" data-custo="' + custo + '"'
      + ' data-esq="' + esq + '" data-largura="' + largura + '" data-qmin="' + serie[0].q + '" data-qmax="' + maximo + '">'
      + linhaCusto
      + '<path class="linha-preco" d="' + linha + '" fill="none"></path>'
      + marcas
      + '<line class="agulha" y1="' + topo + '" y2="' + (A - baixo) + '" hidden></line>'
      + '<circle class="bola" r="7" hidden></circle>'
      + '<rect class="area-toque" x="0" y="0" width="' + L + '" height="' + A + '" fill="transparent"></rect>'
      + "</svg>"
      + '<div class="curva-dica" hidden></div>';
  }

  // Ler o gráfico em qualquer ponto da linha, não só nos packs.
  function lerCurva(evento) {
    var svg = evento.target.closest ? evento.target.closest("svg.curva") : null;
    var envolvente = evento.target.closest ? evento.target.closest(".curva-envolvente") : null;
    if (!svg || !envolvente) { return; }

    var dica = envolvente.querySelector(".curva-dica");
    var caixa = svg.getBoundingClientRect();
    var toque = evento.touches && evento.touches[0] ? evento.touches[0] : evento;
    var fracao = (toque.clientX - caixa.left) / (caixa.width || 1);

    var qmin = parseInt(svg.dataset.qmin, 10), qmax = parseInt(svg.dataset.qmax, 10);
    var esq = parseFloat(svg.dataset.esq), largura = parseFloat(svg.dataset.largura);
    var viewL = svg.viewBox.baseVal.width;
    var xNoView = fracao * viewL;
    var q = Math.round(qmin + ((xNoView - esq) / largura) * (qmax - qmin));
    q = Math.max(qmin, Math.min(qmax, q));

    var serie = {};
    svg.dataset.serie.split(",").forEach(function (par) {
      var kv = par.split(":");
      serie[kv[0]] = parseInt(kv[1], 10);
    });

    // Nem toda a quantidade existe no pack-combination: apanha a mais próxima.
    var cents = serie[String(q)];
    if (cents == null) {
      var perto = Object.keys(serie).map(Number).reduce(function (a, b) {
        return Math.abs(b - q) < Math.abs(a - q) ? b : a;
      }, qmin);
      q = perto;
      cents = serie[String(perto)];
    }
    if (cents == null) { return; }

    var custo = parseInt(svg.dataset.custo, 10) || 0;
    var unit = Math.round(cents / q);
    var base = serie[String(qmin)] ? serie[String(qmin)] / qmin : unit;
    var desconto = base ? (1 - (cents / q) / base) * 100 : 0;

    dica.innerHTML = "<strong>" + q + " un.</strong>"
      + "<span>" + esc(euros(unit)) + " € cada · " + esc(euros(cents)) + " € total</span>"
      + "<span>" + desconto.toFixed(0) + "% desconto</span>"
      + (custo
          ? "<span" + (unit - custo < 0 ? ' class="negativo"' : "") + ">lucro "
            + esc(euros(Math.abs(unit - custo))) + " €/un · " + esc(euros(Math.abs(cents - custo * q))) + " € total</span>"
          : "");
    dica.hidden = false;

    // Agulha e bola a seguir o dedo.
    var agulha = svg.querySelector(".agulha"), bola = svg.querySelector(".bola");
    var x = esq + ((q - qmin) / (qmax - qmin || 1)) * largura;
    var caminho = svg.querySelector(".linha-preco");
    var y = topoDaLinha(caminho, x);
    if (agulha) { agulha.setAttribute("x1", x); agulha.setAttribute("x2", x); agulha.hidden = false; }
    if (bola && y !== null) { bola.setAttribute("cx", x); bola.setAttribute("cy", y); bola.hidden = false; }

    var xEcra = caixa.left + (x / viewL) * caixa.width - envolvente.getBoundingClientRect().left;
    dica.style.left = Math.max(4, Math.min(envolvente.clientWidth - dica.offsetWidth - 4,
      xEcra - dica.offsetWidth / 2)) + "px";
  }

  // Onde é que a linha passa neste x — para a bolinha assentar mesmo em cima.
  function topoDaLinha(caminho, x) {
    if (!caminho || !caminho.getTotalLength) { return null; }
    var total = caminho.getTotalLength();
    var lo = 0, hi = total, ponto;
    for (var i = 0; i < 18; i++) {
      var meio = (lo + hi) / 2;
      ponto = caminho.getPointAtLength(meio);
      if (ponto.x < x) { lo = meio; } else { hi = meio; }
    }
    return ponto ? ponto.y : null;
  }

  document.addEventListener("mousemove", lerCurva);
  document.addEventListener("touchstart", lerCurva, { passive: true });
  document.addEventListener("touchmove", lerCurva, { passive: true });
  document.addEventListener("mouseleave", function (evento) {
    var env = evento.target.closest ? evento.target.closest(".curva-envolvente") : null;
    if (!env) { return; }
    var d = env.querySelector(".curva-dica");
    if (d) { d.hidden = true; }
    ["agulha", "bola"].forEach(function (c) {
      var e = env.querySelector("." + c);
      if (e) { e.hidden = true; }
    });
  }, true);

  // ── Desenho ──────────────────────────────────────────────────────────────

  function campoDinheiro(ficheiro, trail, cents, classe) {
    return '<input type="text" inputmode="decimal" class="dinheiro ' + (classe || "") + '"'
      + ' value="' + esc(euros(cents)) + '" data-op="valor"'
      + ' data-ficheiro="' + esc(ficheiro) + '" data-trail="' + attr(trail) + '"'
      + ' data-original="' + cents + '">';
  }

  function registoDe(slug) {
    return dados.pricing && dados.pricing.products ? dados.pricing.products[slug] : null;
  }

  function custoDe(slug, priceKey) {
    var porProduto = dados.custos && dados.custos[slug];
    return porProduto && porProduto[priceKey] ? parseInt(porProduto[priceKey], 10) || 0 : 0;
  }

  // Tabela de VARIANTES (purchase-option): as linhas são produtos diferentes,
  // não quantidades. O `quantity` de cada item é só um índice para alinhar com
  // a tabela do pricing.json, por isso não faz sentido mostrar preço unitário
  // nem desconto — e o número que cobra é o priceCents do item, não a tabela.
  function tabelaVariantes(produto, variantes) {
    var priceKey = variantes[0].priceKey || "";
    var custo = custoDe(produto.slug, priceKey);

    var html = '<div class="seccao-titulo">' + esc(priceKey || "Variantes")
      + ' <span class="selo mono">purchase-option</span></div>';

    html += '<p class="nota">Estas linhas são <strong>variantes</strong>, não quantidades — o cliente escolhe uma. '
      + "O preço que cobra é o do item; o editor escreve também os espelhos no <code>pricing.json</code>, "
      + "para os três ficarem sempre iguais.</p>";

    html += '<div class="custo-linha">'
      + "<label>Custo do material por unidade</label>"
      + '<input type="text" inputmode="decimal" class="dinheiro" value="' + esc(euros(custo)) + '"'
      + ' data-op="custo" data-contexto="' + attr({ slug: produto.slug, priceKey: priceKey }) + '"'
      + ' data-original="' + custo + '">'
      + '<span class="custo-nota">' + (custo ? "lucro calculado por linha" : "põe o custo para veres o lucro") + "</span>"
      + "</div>";

    html += "<table><thead><tr><th>Variante</th><th>Preço</th><th>Lucro</th><th>Margem</th></tr></thead><tbody>";
    variantes.forEach(function (v) {
      html += '<tr data-linha="1">'
        + "<td>" + esc(v.titulo)
        + '<div class="caminho">' + esc(v.valor) + "</div></td>"
        + '<td class="col-estreita"><input type="text" inputmode="decimal" class="dinheiro campo-total"'
        + ' value="' + esc(euros(v.cents)) + '" data-op="variante"'
        + ' data-contexto="' + attr({ slug: produto.slug, valor: v.valor, priceKey: priceKey }) + '"'
        + ' data-original="' + v.cents + '"></td>'
        + celulasLucro(v.cents, 1, custo)
        + "</tr>";
    });
    html += "</tbody></table>";
    return html;
  }

  function tabelaPrecos(produto, priceKey, tabela, modo) {
    var qs = Object.keys(tabela).map(Number).sort(function (a, b) { return a - b; });
    // O desconto mostra-se sempre. Num flat-unit deve dar 0% em todas as
    // linhas — e uma linha que não dê zero é logo um sinal de que a tabela não
    // é proporcional, que é o tipo de erro que passava despercebido.
    var mostraDesconto = true;
    var custo = custoDe(produto.slug, priceKey);
    var ctxTabela = { slug: produto.slug, priceKey: priceKey };

    var html = '<div class="seccao-titulo">' + esc(priceKey)
      + ' <span class="selo mono">' + esc(modo || "—") + "</span></div>";

    // Custo do material. Fica na pasta privada, nunca no pricing.json público.
    html += '<div class="custo-linha">'
      + "<label>Custo do material por unidade</label>"
      + '<input type="text" inputmode="decimal" class="dinheiro" value="' + esc(euros(custo)) + '"'
      + ' data-op="custo" data-contexto="' + attr(ctxTabela) + '" data-original="' + custo + '">'
      + '<span class="custo-nota">' + (custo ? "lucro calculado por linha" : "põe o custo para veres o lucro") + "</span>"
      + "</div>";

    var blocoD = mostraDesconto ? descontosDe(produto.slug, priceKey, tabela) : null;

    html += "<table><thead><tr><th>Quantidade</th><th>Total</th><th>Por unidade</th>"
      + (mostraDesconto
          ? COLUNAS.map(function (coluna) {
              return '<th class="col-desconto' + (blocoD.activo === coluna ? " activa" : "") + '"'
                + ' title="' + (blocoD.activo === coluna ? "Esta é a escada que está a vender" : "Marca para passar a usar esta escada") + '">'
                + '<label><input type="radio" name="coluna-' + esc(produto.slug + "-" + priceKey) + '"'
                + (blocoD.activo === coluna ? " checked" : "") + ' data-op="desconto-coluna"'
                + ' data-contexto="' + attr({ slug: produto.slug, priceKey: priceKey, coluna: coluna }) + '">'
                + coluna + "</label></th>";
            }).join("")
          : "")
      + '<th title="Quanto ganhas em cada unidade que fazes, já com o desconto deste pack">Lucro/un</th>'
      + "<th>Lucro</th><th>Margem</th>"
      + '<th class="col-accao"></th></tr></thead><tbody>';

    qs.forEach(function (q) {
      var cents = tabela[String(q)];
      var contexto = { slug: produto.slug, priceKey: priceKey, quantidade: q };
      var trailTotal = ["products", produto.slug, "prices", priceKey, String(q)];

      html += '<tr data-linha="' + esc(q) + '" data-tabela="' + attr(ctxTabela) + '">';
      html += '<td class="col-estreita"><input type="text" inputmode="numeric" class="quantidade"'
        + ' value="' + q + '" data-op="pack-renomear" data-contexto="' + attr(contexto) + '"'
        + ' data-original="' + q + '"></td>';

      html += '<td class="col-estreita">' + campoDinheiro("pricing", trailTotal, cents, "campo-total") + "</td>";

      // Unitário editável: escreve o total, que é o que o site lê.
      html += '<td class="col-estreita"><input type="text" inputmode="decimal" class="dinheiro campo-unitario"'
        + ' value="' + esc(euros(Math.round(cents / q))) + '" data-op="unitario"'
        + ' data-contexto="' + attr(contexto) + '" data-original="' + Math.round(cents / q) + '"></td>';

      if (mostraDesconto) {
        COLUNAS.forEach(function (coluna) {
          var activa = blocoD.activo === coluna;
          // A coluna activa mostra sempre o desconto que a tabela tem mesmo, e
          // não o que está guardado: são a mesma coisa, mas se alguém mexer no
          // total à mão é o total que manda.
          var d = activa ? descontoDe(tabela, q) : Number(blocoD[coluna][String(q)]) || 0;
          html += '<td class="col-estreita col-desconto' + (activa ? " activa" : "") + '">'
            + '<input type="text" inputmode="decimal" class="dinheiro campo-desconto"'
            + ' value="' + d.toFixed(1).replace(".", ",") + '" data-op="desconto"'
            + ' data-coluna="' + coluna + '"'
            + ' data-contexto="' + attr(contexto) + '" data-original="' + d.toFixed(1) + '"'
            + (q === qs[0] ? " disabled title=\"É o escalão de referência: o desconto conta-se a partir daqui\"" : "")
            + "></td>";
        });
      }

      html += celulasLucro(cents, q, custo);
      html += '<td class="col-accao"><button class="icone" data-op="pack-remover"'
        + ' data-contexto="' + attr(contexto) + '" title="Remover este pack">✕</button></td>';
      html += "</tr>";
    });

    html += "</tbody></table>";
    var tieBreak = registoDe(produto.slug);
    var preferFewer = !!(tieBreak && tieBreak.combinationTieBreakByPriceKey
      && tieBreak.combinationTieBreakByPriceKey[priceKey] === "fewer-packs");
    html += '<div class="curva-envolvente" data-modo="' + esc(modo) + '"'
      + ' data-fewer="' + (preferFewer ? "1" : "") + '">'
      + curva(tabela, custo, modo, preferFewer) + "</div>";
    html += '<div style="margin-top:8px"><button class="leve" data-op="pack-adicionar"'
      + ' data-contexto="' + attr(ctxTabela) + '">+ Pack</button></div>';

    return html;
  }

  // Lucro por unidade, lucro total e margem de uma linha. O lucro por unidade
  // é o que sobra em cada peça que se faz, já com o desconto daquele pack.
  // Sem custo definido não se inventa nada.
  function textoLucro(cents, q, custo) {
    if (!custo) { return { unidade: "—", lucro: "—", margem: "—", negativo: false }; }
    var lucro = cents - custo * q;
    var porUnidade = Math.round(cents / q) - custo;
    var margem = cents > 0 ? (lucro / cents) * 100 : 0;
    return {
      unidade: (porUnidade < 0 ? "−" : "") + euros(Math.abs(porUnidade)) + " €",
      lucro: (lucro < 0 ? "−" : "") + euros(Math.abs(lucro)) + " €",
      margem: margem.toFixed(0) + "%",
      negativo: lucro < 0
    };
  }

  function celulasLucro(cents, q, custo) {
    var v = textoLucro(cents, q, custo);
    var base = "numerico" + (v.negativo ? " negativo" : "") + (custo ? "" : " sem-custo");
    return '<td class="' + base + ' celula-unidade">' + esc(v.unidade) + "</td>"
      + '<td class="' + base + ' celula-lucro">' + esc(v.lucro) + "</td>"
      + '<td class="' + base + ' celula-margem">' + esc(v.margem) + "</td>";
  }

  function coleccao(produto, col) {
    var html = '<div class="seccao-titulo">' + esc(col.nome)
      + ' <span class="selo mono">' + esc(col.caminho) + "</span></div>";

    html += "<table><thead><tr><th>Nome</th><th>Detalhe</th><th>Valor</th>"
      + '<th class="col-accao"></th></tr></thead><tbody>';

    col.itens.forEach(function (item) {
      var titulo = item.textos.filter(function (t) { return t.campo === "title" || t.campo === "label"; })[0];
      var sub = item.textos.filter(function (t) { return t.campo === "subtitle" || t.campo === "text"; })[0];

      html += "<tr>";
      html += "<td>" + (titulo
        ? '<input type="text" value="' + esc(titulo.texto) + '" data-op="texto"'
          + ' data-ficheiro="' + esc(produto.slug) + '" data-trail="' + attr(titulo.trail) + '"'
          + ' data-original="' + esc(titulo.texto) + '">'
        : '<span class="vazio">' + esc(item.identidade || "—") + "</span>") + "</td>";

      html += "<td>" + (sub
        ? '<input type="text" value="' + esc(sub.texto) + '" data-op="texto"'
          + ' data-ficheiro="' + esc(produto.slug) + '" data-trail="' + attr(sub.trail) + '"'
          + ' data-original="' + esc(sub.texto) + '">'
        : "") + "</td>";

      html += '<td class="col-estreita">'
        + item.dinheiro.map(function (d) {
            return campoDinheiro(produto.slug, d.trail, d.cents);
          }).join("")
        + "</td>";

      html += '<td class="col-accao"><button class="icone" data-op="linha-remover"'
        + ' data-ficheiro="' + esc(produto.slug) + '" data-trail="' + attr(item.trail) + '"'
        + ' title="Remover">✕</button></td>';
      html += "</tr>";
    });

    html += "</tbody></table>";
    html += '<div style="margin-top:8px"><button class="leve" data-op="linha-adicionar"'
      + ' data-ficheiro="' + esc(produto.slug) + '" data-trail="' + attr(col.trail) + '">+ Linha</button></div>';
    return html;
  }

  function selectorModo(produto) {
    if (!produto.mainV2 || produto.construtor || !produto.temRegistoCentral) { return ""; }
    var modos = ["flat-unit", "pack-combination", "tier-unit"];
    return '<select data-op="modo" data-contexto="' + attr({ slug: produto.slug })
      + '" data-original="' + esc(produto.pricingMode || "") + '">'
      + modos.map(function (m) {
          return '<option value="' + m + '"' + (m === produto.pricingMode ? " selected" : "") + ">" + m + "</option>";
        }).join("")
      + "</select>";
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────
  // Um produto de cada vez. A tab 1 é a grelha de fotografias, que serve de
  // atalho para as outras. A ordem arrasta-se e fica gravada no browser — é
  // preferência de quem edita, não configuração do site, por isso não vai para
  // ficheiro nenhum.

  var tabActiva = "__grelha__";
  var ordemTabs = [];

  // A ordem vive no servidor (private/editor-preferencias.json), nao no
  // browser: so ha uma pessoa a editar, e assim segue-a de maquina para
  // maquina em vez de ficar presa a este Chrome.
  function lerOrdemGravada() {
    return (dados && dados.ordemTabs) || [];
  }

  function gravarOrdem() {
    fetch(API + "?action=ordem-tabs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordem: ordemTabs })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.ok) { dados.ordemTabs = d.ordemTabs; }
      else { alerta(d.erro || "Não consegui gravar a ordem das tabs.", "erro"); }
    }).catch(function (e) { alerta(e.message, "erro"); });
  }

  // Junta o que está gravado com o que existe agora: respeita a ordem
  // escolhida e acrescenta ao fim o que for novo.
  function reconciliarOrdem() {
    var existentes = dados.produtos.map(function (p) { return p.slug; });
    if (dados.capsula && dados.capsula.length) { existentes.push("__capsula__"); }

    var gravada = lerOrdemGravada().filter(function (s) { return existentes.indexOf(s) !== -1; });
    existentes.forEach(function (s) { if (gravada.indexOf(s) === -1) { gravada.push(s); } });
    ordemTabs = gravada;

    if (tabActiva !== "__grelha__" && ordemTabs.indexOf(tabActiva) === -1) {
      tabActiva = "__grelha__";
    }
  }

  function rotuloTab(slug) {
    if (slug === "__capsula__") { return "Congresso 2026"; }
    var p = dados.produtos.filter(function (x) { return x.slug === slug; })[0];
    return p ? p.titulo : slug;
  }

  function desenharTabs() {
    var html = '<button class="tab' + (tabActiva === "__grelha__" ? " activa" : "")
      + '" data-tab="__grelha__">Produtos</button>';

    html += ordemTabs.map(function (slug) {
      var p = dados.produtos.filter(function (x) { return x.slug === slug; })[0];
      var mau = slug === "__capsula__"
        ? (dados.capsula || []).some(function (c) { return c.espelho && !c.sincronizado; })
        : (p && !p.valido);
      return '<button class="tab' + (tabActiva === slug ? " activa" : "") + (mau ? " mau" : "") + '"'
        + ' data-tab="' + esc(slug) + '" draggable="true">'
        + (p && p.miniatura ? '<img class="tab-thumb" src="' + esc(p.miniatura) + '" alt="">' : "")
        + esc(rotuloTab(slug)) + "</button>";
    }).join("");

    el("tabs").innerHTML = html;
  }

  // Arrastar para reordenar, como as tabs do Chrome.
  var arrastada = null;

  el("tabs").addEventListener("dragstart", function (evento) {
    var tab = evento.target.closest(".tab");
    if (!tab || !tab.dataset.tab || tab.dataset.tab === "__grelha__") { return; }
    arrastada = tab.dataset.tab;
    tab.classList.add("a-arrastar");
    evento.dataTransfer.effectAllowed = "move";
    evento.dataTransfer.setData("text/plain", arrastada);
  });

  el("tabs").addEventListener("dragover", function (evento) {
    if (!arrastada) { return; }
    evento.preventDefault();
    var sobre = evento.target.closest(".tab");
    if (!sobre || !sobre.dataset.tab || sobre.dataset.tab === "__grelha__"
        || sobre.dataset.tab === arrastada) { return; }

    var de = ordemTabs.indexOf(arrastada);
    var para = ordemTabs.indexOf(sobre.dataset.tab);
    if (de === -1 || para === -1) { return; }

    ordemTabs.splice(de, 1);
    ordemTabs.splice(para, 0, arrastada);
    desenharTabs();
  });

  el("tabs").addEventListener("drop", function (evento) { evento.preventDefault(); });

  el("tabs").addEventListener("dragend", function () {
    arrastada = null;
    gravarOrdem();
    desenharTabs();
  });

  el("tabs").addEventListener("click", function (evento) {
    var tab = evento.target.closest(".tab");
    if (!tab || !tab.dataset.tab) { return; }
    abrirTab(tab.dataset.tab);
  });

  function abrirTab(slug) {
    tabActiva = slug;
    desenhar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // DESCONTOS_COLUNAS_V1: pôr o catálogo inteiro na mesma escada de uma vez.
  // É o que se quer numa campanha: mudar todos e depois voltar atrás.
  function contagemColunas() {
    var contas = { D1: 0, D2: 0, D3: 0, D4: 0 };
    dados.produtos.forEach(function (produto) {
      var registo = dados.pricing.products ? dados.pricing.products[produto.slug] : null;
      if (!registo || !registo.prices) { return; }
      Object.keys(registo.prices).forEach(function (priceKey) {
        var bloco = (registo.discountsByPriceKey || {})[priceKey];
        var activo = bloco && bloco.activo ? bloco.activo : "D1";
        if (contas[activo] != null) { contas[activo] += 1; }
      });
    });
    return contas;
  }

  function seccaoColunaGlobal() {
    var contas = contagemColunas();

    return '<section class="cartao"><header><h2>Escada de descontos</h2>'
      + '<span class="selo">todas as tabelas de uma vez</span></header><div class="corpo">'
      + '<p class="nota-corpo">Cada tabela guarda quatro escadas de desconto — D1 a D4 — e usa uma. '
      + 'Isto põe todas as tabelas do catálogo na mesma, para uma campanha começar e acabar num clique.</p>'
      + '<div class="coluna-global">'
      + COLUNAS.map(function (coluna) {
          return '<button class="' + (contas[coluna] ? "activa" : "") + '" data-op="desconto-coluna-global"'
            + ' data-coluna="' + coluna + '">' + coluna
            + '<span class="conta">' + (contas[coluna] || 0) + "</span></button>";
        }).join("")
      + "</div></div></section>";
  }

  function desenhar() {
    el("faixaAberto").hidden = !dados.aberto;

    var nTabelas = 0, nValores = 0, maus = 0;
    dados.produtos.forEach(function (p) {
      var r = dados.pricing.products ? dados.pricing.products[p.slug] : null;
      if (r && r.prices) { nTabelas += Object.keys(r.prices).length; }
      p.coleccoes.forEach(function (c) {
        c.itens.forEach(function (i) { nValores += i.dinheiro.length; });
      });
      nValores += p.soltos.length;
      if (r && r.prices) {
        Object.keys(r.prices).forEach(function (k) { nValores += Object.keys(r.prices[k]).length; });
      }
      if (!p.valido) { maus++; }
    });

    el("kpis").innerHTML =
      kpi("Produtos", dados.produtos.length, "no catálogo")
      + kpi("Tabelas de preço", nTabelas, "em pricing.json")
      + kpi("Valores editáveis", nValores, "em todo o site")
      + kpi("Coerência", maus === 0 ? "OK" : maus, maus === 0 ? "produto ↔ pricing.json" : "produto(s) inválido(s)", maus === 0 ? "ok" : "mau");

    reconciliarOrdem();
    desenharTabs();

    el("nav").innerHTML = ordemTabs.map(function (slug) {
      var p = dados.produtos.filter(function (x) { return x.slug === slug; })[0];
      var r = p && dados.pricing.products ? dados.pricing.products[p.slug] : null;
      var n = r && r.prices ? Object.keys(r.prices).length : 0;
      var mau = slug === "__capsula__" ? false : (p && !p.valido);
      return '<button class="nav-item" data-ir="' + esc(slug) + '">'
        + '<span class="ponto' + (mau ? " mau" : "") + '"></span>'
        + esc(slug === "__capsula__" ? "congresso 2026" : slug)
        + '<span class="conta">' + (n || "") + "</span></button>";
    }).join("");

    // Tab 1: a grelha de fotografias, que é o atalho para as outras tabs.
    if (tabActiva === "__grelha__") {
      var avisoPers = (dados.foraDaPersonalizacao || []).length
        ? '<div class="faixa aviso"><strong>Fora da personalização:</strong> '
          + esc(dados.foraDaPersonalizacao.join(", "))
          + ". O catálogo do passo 2 da personalização é uma lista à mão em "
          + "<code>personalizacao.json</code> e não deriva dos produtos — "
          + "quem não estiver lá não aparece, sem dar erro.</div>"
        : "";

      el("conteudo").innerHTML = avisoPers + seccaoPortes() + seccaoColunaGlobal()
        + '<section class="cartao"><header><h2>Produtos</h2>'
        + '<span class="selo">clica para abrir</span></header>'
        + '<div class="corpo"><div class="grelha-produtos">'
        + ordemTabs.filter(function (s) { return s !== "__capsula__"; }).map(function (slug) {
            var p = dados.produtos.filter(function (x) { return x.slug === slug; })[0];
            if (!p) { return ""; }
            return '<button class="cartao-produto' + (p.valido ? "" : " mau") + '" data-ir="' + esc(p.slug) + '">'
              + miniaturaGrande(p)
              + '<span class="cartao-produto-nome">' + esc(p.titulo) + "</span>"
              + '<span class="cartao-produto-slug">' + esc(p.slug) + "</span></button>";
          }).join("")
        + "</div></div></section>";
      actualizarRodape();
      alerta(maus ? maus + " produto(s) com configuração inválida" : "Tudo coerente.", maus ? "erro" : "ok");
      return;
    }

    if (tabActiva === "__capsula__") {
      el("conteudo").innerHTML = seccaoCapsula();
      actualizarRodape();
      alerta(maus ? maus + " produto(s) com configuração inválida" : "Tudo coerente.", maus ? "erro" : "ok");
      return;
    }

    el("conteudo").innerHTML = dados.produtos.filter(function (p) {
      return p.slug === tabActiva;
    }).map(function (produto) {
      var registo = dados.pricing.products ? dados.pricing.products[produto.slug] : null;
      var corpo = "";

      if (produto.construtor) {
        corpo += '<p class="nota">Construtor da personalização — não tem tabela própria. '
          + "Cada linha do carrinho é cobrada pelo produto de destino.</p>";
      } else if (produto.mainV2 && !produto.temRegistoCentral) {
        corpo += '<p class="nota">Sem entrada em <code>pricing.json</code> — o checkout recusa as encomendas deste produto.</p>';
      }

      // Um produto de variantes não tem escada de quantidades: a tabela do
      // pricing.json é só o espelho, por isso mostra-se a lista de variantes.
      if (produto.variantes && produto.variantes.length) {
        corpo += tabelaVariantes(produto, produto.variantes);
      } else if (registo && registo.prices) {
        Object.keys(registo.prices).forEach(function (priceKey) {
          var modo = (registo.pricingModeByPriceKey && registo.pricingModeByPriceKey[priceKey])
            || registo.pricingMode || "";
          corpo += tabelaPrecos(produto, priceKey, registo.prices[priceKey], modo);
        });
      }

      produto.coleccoes.forEach(function (col) { corpo += coleccao(produto, col); });

      if (produto.soltos.length) {
        corpo += '<div class="seccao-titulo">Valores avulso</div><table><tbody>';
        produto.soltos.forEach(function (s) {
          corpo += "<tr><td>" + esc(s.rotulo || s.tipo)
            + '<div class="selo mono" style="border:0;padding:0;background:none">'
            + esc(s.trail.join(" › ")) + "</div></td>"
            + '<td class="col-estreita">' + campoDinheiro(produto.slug, s.trail, s.cents) + "</td></tr>";
        });
        corpo += "</tbody></table>";
      }

      return '<section class="cartao" id="p-' + esc(produto.slug) + '">'
        + "<header>" + miniatura(produto) + "<h2>" + esc(produto.titulo) + "</h2>"
        + '<span class="selo mono">' + esc(produto.slug) + "</span>"
        + (produto.mainV2 ? '<span class="selo">main-v2</span>' : "")
        + selectorModo(produto)
        + (produto.valido ? "" : '<span class="selo mau">configuração inválida</span>')
        + "</header>"
        + '<div class="corpo">' + (corpo || '<p class="vazio">Sem valores monetários.</p>') + "</div>"
        + "</section>";
    }).join("");

    actualizarRodape();
    alerta(maus ? maus + " produto(s) com configuração inválida" : "Tudo coerente.", maus ? "erro" : "ok");
  }

  // Cápsula do Congresso 2026: só preços. A regra de não lhe mexer é sobre as
  // imagens e o design; os preços têm de acompanhar o catálogo, senão divergem
  // sozinhos — já aconteceu com os portes.
  function seccaoCapsula() {
    if (!dados.capsula || !dados.capsula.length) { return ""; }

    var porSincronizar = dados.capsula.filter(function (c) {
      return c.espelho && !c.sincronizado;
    }).length;

    var linhas = dados.capsula.map(function (c) {
      var estado = !c.espelho
        ? '<span class="selo">sem espelho</span>'
        : (c.sincronizado
            ? '<span class="selo ok">igual ao catálogo</span>'
            : '<span class="selo mau">difere: ' + esc(c.diferencas.join(", ")) + "</span>");

      return "<tr><td>" + esc(c.slug)
        + '<div class="caminho">' + Object.keys(c.prices || {}).join(" · ") + "</div></td>"
        + "<td>" + (c.espelho ? '<code>' + esc(c.espelho) + "</code>" : '<span class="vazio">—</span>') + "</td>"
        + "<td>" + estado + "</td>"
        + '<td class="col-accao">'
        + (c.espelho && !c.sincronizado
            ? '<button class="leve" data-op="capsula-sincronizar" data-slug="' + esc(c.slug) + '">Sincronizar</button>'
            : "")
        + "</td></tr>";
    }).join("");

    return '<section class="cartao" id="p-congresso-2026">'
      + "<header><h2>Congresso 2026</h2>"
      + '<span class="selo mono">congressos/2026</span>'
      + (porSincronizar
          ? '<span class="selo mau">' + porSincronizar + " por sincronizar</span>"
          : '<span class="selo ok">tudo igual ao catálogo</span>')
      + "</header>"
      + '<div class="corpo">'
      + '<p class="nota">A cápsula tem a sua própria tabela de preços, que o <code>send-order.php</code> lê '
      + "quando o pedido vem de lá. Sincronizar copia as tabelas do produto do catálogo que a espelha — "
      + "<strong>só preços</strong>, nunca imagens nem estrutura, e nunca acrescenta nem remove tabelas.</p>"
      + "<table><thead><tr><th>Produto da cápsula</th><th>Espelha</th><th>Estado</th>"
      + '<th class="col-accao"></th></tr></thead><tbody>' + linhas + "</tbody></table>"
      + "</div></section>";
  }

  // Miniatura do produto. Sem imagem, mostra as iniciais do slug — continua a
  // dar para distinguir de relance qual é o cartão.
  function miniatura(produto) {
    if (produto.miniatura) {
      return '<img class="miniatura" src="' + esc(produto.miniatura) + '" alt="" loading="lazy">';
    }
    var iniciais = produto.slug.split("-").map(function (p) { return p.charAt(0); })
      .join("").slice(0, 2).toUpperCase();
    return '<span class="miniatura miniatura--vazia">' + esc(iniciais) + "</span>";
  }

  function miniaturaGrande(produto) {
    if (produto.miniatura) {
      return '<span class="cartao-produto-imagem" style="background-image:url(\''
        + esc(produto.miniatura) + '\')"></span>';
    }
    var iniciais = produto.slug.split("-").map(function (p) { return p.charAt(0); })
      .join("").slice(0, 2).toUpperCase();
    return '<span class="cartao-produto-imagem vazia">' + esc(iniciais) + "</span>";
  }

  // Portes: um valor para o site todo. Antes viviam duplicados nos 13 JSON de
  // produto e já tinham divergido uma vez.
  var ROTULOS_ENTREGA = {
    pickup: "Recolha na casa da Mia",
    shipping: "Envio CTT — até 2 kg",
    join_orders: "Juntar às encomendas"
  };

  function seccaoPortes() {
    var d = dados.delivery || {};
    var ids = Object.keys(d);
    if (!ids.length) { return ""; }

    return '<section class="cartao"><header><h2>Portes</h2>'
      + '<span class="selo mono">pricing.json › delivery</span>'
      + '<span class="selo ok">vale para todos os produtos</span></header>'
      + '<div class="corpo"><p class="nota">Um valor só para o site inteiro. '
      + "Os JSON de produto continuam a dar a estrutura das opções, mas o preço vem daqui.</p>"
      + "<table><thead><tr><th>Opção</th><th>Valor</th></tr></thead><tbody>"
      + ids.map(function (id) {
          return "<tr><td>" + esc(ROTULOS_ENTREGA[id] || id)
            + '<div class="caminho">' + esc(id) + "</div></td>"
            + '<td class="col-estreita">'
            + campoDinheiro("pricing", ["delivery", id], d[id])
            + "</td></tr>";
        }).join("")
      + "</tbody></table></div></section>";
  }

  function kpi(rotulo, valor, sub, classe) {
    return '<div class="kpi"><div class="rotulo">' + esc(rotulo) + "</div>"
      + '<div class="valor ' + (classe || "") + '">' + esc(valor) + "</div>"
      + '<div class="sub">' + esc(sub) + "</div></div>";
  }

  // ── Edições de valor e texto (ficam em fila) ─────────────────────────────

  document.addEventListener("input", function (evento) {
    var alvo = evento.target;
    if (!alvo.dataset || !alvo.dataset.op || alvo.tagName !== "INPUT") { return; }
    var op = alvo.dataset.op;

    if (op === "valor") {
      var cents = paraCents(alvo.value);
      var chave = "valor:" + alvo.dataset.ficheiro + ":" + alvo.dataset.trail;
      alvo.classList.toggle("mau", cents === null);
      if (cents === null) { desenfileirar(chave); alvo.classList.remove("sujo"); return; }
      var igual = cents === parseInt(alvo.dataset.original, 10);
      alvo.classList.toggle("sujo", !igual);
      if (igual) { desenfileirar(chave); } else {
        enfileirar(chave, { op: "valor", ficheiro: alvo.dataset.ficheiro,
          trail: JSON.parse(alvo.dataset.trail), cents: cents });
      }
      return;
    }

    if (op === "texto") {
      var chaveT = "texto:" + alvo.dataset.ficheiro + ":" + alvo.dataset.trail;
      var igualT = alvo.value === alvo.dataset.original;
      alvo.classList.toggle("sujo", !igualT);
      if (igualT) { desenfileirar(chaveT); } else {
        enfileirar(chaveT, { op: "texto", ficheiro: alvo.dataset.ficheiro,
          trail: JSON.parse(alvo.dataset.trail), texto: alvo.value });
      }
      return;
    }

    // Variante (purchase-option): escreve o priceCents do item e os espelhos.
    if (op === "variante") {
      var ctxV = JSON.parse(alvo.dataset.contexto);
      var centsV = paraCents(alvo.value);
      var chaveV = "variante:" + ctxV.slug + ":" + ctxV.valor;
      alvo.classList.toggle("mau", centsV === null);
      if (centsV === null) { desenfileirar(chaveV); alvo.classList.remove("sujo"); return; }
      var igualV = centsV === parseInt(alvo.dataset.original, 10);
      alvo.classList.toggle("sujo", !igualV);
      if (igualV) { desenfileirar(chaveV); } else {
        enfileirar(chaveV, { op: "variante", slug: ctxV.slug, valor: ctxV.valor, cents: centsV });
      }
      recalcularLucros(alvo, null);
      return;
    }

    // Custo do material: não é preço, vai para a pasta privada.
    if (op === "custo") {
      var ctxC = JSON.parse(alvo.dataset.contexto);
      var centsC = paraCents(alvo.value);
      var chaveC = "custo:" + ctxC.slug + ":" + ctxC.priceKey;
      alvo.classList.toggle("mau", centsC === null);
      if (centsC === null) { desenfileirar(chaveC); return; }
      var igualC = centsC === parseInt(alvo.dataset.original, 10);
      alvo.classList.toggle("sujo", !igualC);
      if (igualC) { desenfileirar(chaveC); } else {
        enfileirar(chaveC, { op: "custo", slug: ctxC.slug, priceKey: ctxC.priceKey, cents: centsC });
      }
      recalcularLucros(alvo, centsC);
      return;
    }

    // Escolher a coluna que manda: passa a tabela toda a seguir aquela escada.
    if (op === "desconto-coluna") {
      var ctxCol = JSON.parse(alvo.dataset.contexto);
      aplicarColuna(ctxCol.slug, ctxCol.priceKey, ctxCol.coluna);
      desenhar();
      alerta("A tabela " + ctxCol.priceKey + " passou a usar " + ctxCol.coluna + ". Falta gravar.", "ok");
      return;
    }

    // Unitário e desconto não são guardados: convertem-se no total do pack,
    // que é o único número que o site lê.
    if (op === "unitario" || op === "desconto") {
      var ctx = JSON.parse(alvo.dataset.contexto);
      var tabela = dados.pricing.products[ctx.slug].prices[ctx.priceKey];
      var novos;

      if (op === "unitario") {
        var unit = paraCents(alvo.value);
        alvo.classList.toggle("mau", unit === null);
        if (unit === null) { return; }
        novos = unit * ctx.quantidade;
      } else {
        var pct = percent(alvo.value);
        var coluna = alvo.dataset.coluna || "D1";
        var bloco = descontosDe(ctx.slug, ctx.priceKey, tabela);

        alvo.classList.toggle("mau", pct === null);
        if (pct === null) { return; }

        // A percentagem fica sempre guardada na sua coluna. Só a coluna activa
        // é que mexe no preço — as outras estão a ser preparadas.
        bloco[coluna][String(ctx.quantidade)] = Math.round(pct * 10) / 10;
        alvo.classList.add("sujo");
        enfileirarDescontos(ctx.slug, ctx.priceKey, tabela);
        if (bloco.activo !== coluna) { return; }
        novos = centsParaDesconto(tabela, ctx.quantidade, pct);
      }

      var trail = ["products", ctx.slug, "prices", ctx.priceKey, String(ctx.quantidade)];
      alvo.classList.add("sujo");
      enfileirar("valor:pricing:" + JSON.stringify(trail),
        { op: "valor", ficheiro: "pricing", trail: trail, cents: novos });
      espelharLinha(alvo, ctx, tabela, novos, op);
    }
  });

  // Mantém total, unitário e desconto a dizerem o mesmo no ecrã, seja qual for
  // o campo que a pessoa mexeu.
  function espelharLinha(origem, ctx, tabela, cents, op) {
    var linha = origem.closest("tr");
    if (!linha) { return; }

    var total = linha.querySelector(".campo-total");
    var unitario = linha.querySelector(".campo-unitario");
    var desconto = linha.querySelector(".campo-desconto");

    if (total && op !== "valor") { total.value = euros(cents); total.classList.add("sujo"); }
    if (unitario && op !== "unitario") {
      unitario.value = euros(Math.round(cents / ctx.quantidade));
      unitario.classList.add("sujo");
    }
    desconto = linha.querySelector(".col-desconto.activa .campo-desconto") || desconto;
    if (desconto && op !== "desconto" && !desconto.disabled) {
      // O desconto conta-se sobre a tabela como está gravada; enquanto não se
      // grava, usa-se o valor novo desta linha.
      var copia = {};
      Object.keys(tabela).forEach(function (k) { copia[k] = tabela[k]; });
      copia[String(ctx.quantidade)] = cents;
      desconto.value = descontoDe(copia, ctx.quantidade).toFixed(1).replace(".", ",");
      desconto.classList.add("sujo");
    }

    recalcularLucros(origem, null);
  }

  // Redesenha as células de lucro da tabela a que o campo mexido pertence.
  function recalcularLucros(origem, custoNovo) {
    var bloco = origem.closest(".custo-linha");
    var tabelaEl = bloco ? bloco.parentNode.querySelector("table") : origem.closest("table");
    if (!tabelaEl) { return; }

    var campoCusto = bloco
      ? bloco.querySelector('[data-op="custo"]')
      : (tabelaEl.previousElementSibling && tabelaEl.previousElementSibling.querySelector
          ? tabelaEl.previousElementSibling.querySelector('[data-op="custo"]') : null);
    var custo = (custoNovo === null || custoNovo === undefined)
      ? (campoCusto ? (paraCents(campoCusto.value) || 0) : 0)
      : custoNovo;

    tabelaEl.querySelectorAll("tbody tr").forEach(function (tr) {
      var total = tr.querySelector(".campo-total");
      var quantidade = parseInt(tr.dataset.linha, 10);
      var celulaLucro = tr.querySelector(".celula-lucro");
      var celulaMargem = tr.querySelector(".celula-margem");
      if (!total || !quantidade || !celulaLucro || !celulaMargem) { return; }

      var cents = paraCents(total.value);
      if (cents === null) { return; }

      var celulaUnidade = tr.querySelector(".celula-unidade");
      var v = textoLucro(cents, quantidade, custo);

      if (celulaUnidade) { celulaUnidade.textContent = v.unidade; }
      celulaLucro.textContent = v.lucro;
      celulaMargem.textContent = v.margem;

      [celulaUnidade, celulaLucro, celulaMargem].forEach(function (c) {
        if (!c) { return; }
        c.classList.toggle("negativo", v.negativo);
        c.classList.toggle("sem-custo", !custo);
      });
    });

    actualizarCurva(tabelaEl);
  }

  // O gráfico é desenhado a partir dos campos, não do que está gravado, para
  // acompanhar as edições ainda por gravar.
  function actualizarCurva(tabelaEl) {
    var envolvente = tabelaEl.parentNode.querySelector(".curva-envolvente");
    if (!envolvente) { return; }

    var tab = {};
    tabelaEl.querySelectorAll("tbody tr").forEach(function (tr) {
      var total = tr.querySelector(".campo-total");
      var q = parseInt(tr.dataset.linha, 10);
      if (!total || !q) { return; }
      var cents = paraCents(total.value);
      if (cents !== null) { tab[String(q)] = cents; }
    });

    var custoEl = tabelaEl.parentNode.querySelector('[data-op="custo"]');
    envolvente.innerHTML = curva(tab, custoEl ? (paraCents(custoEl.value) || 0) : 0,
      envolvente.dataset.modo || "", envolvente.dataset.fewer === "1");
  }

  // ── Operações estruturais (gravam já) ────────────────────────────────────

  document.addEventListener("change", function (evento) {
    var alvo = evento.target;
    if (alvo.tagName !== "SELECT" || alvo.dataset.op !== "modo") { return; }
    var ctx = JSON.parse(alvo.dataset.contexto);
    var modo = alvo.value;
    estrutural({ op: "modo", slug: ctx.slug, pricingMode: modo }, function () {
      var r = dados.pricing.products[ctx.slug];
      r.pricingMode = modo;
      r.allowUnitDiscounts = modo !== "flat-unit";
      dados.produtos.forEach(function (p) {
        if (p.slug === ctx.slug) { p.pricingMode = modo; p.allowUnitDiscounts = r.allowUnitDiscounts; }
      });
    });
  });

  // Atalhos: os cartões da grelha e a lista lateral abrem a tab do produto.
  document.addEventListener("click", function (evento) {
    var atalho = evento.target.closest ? evento.target.closest("[data-ir]") : null;
    if (atalho) { abrirTab(atalho.dataset.ir); }
  });

  document.addEventListener("click", function (evento) {
    var alvo = evento.target.closest("[data-op]");
    if (!alvo || alvo.tagName !== "BUTTON") { return; }
    var op = alvo.dataset.op;

    // Pôr o catálogo inteiro na mesma escada de descontos. Vive aqui e não no
    // handler dos campos porque um <button> não dispara `change`.
    if (op === "desconto-coluna-global") {
      var colunaG = alvo.dataset.coluna;
      var tabelas = 0;
      if (!window.confirm("Pôr TODAS as tabelas do catálogo na escada " + colunaG + "?")) { return; }
      dados.produtos.forEach(function (produto) {
        var registo = dados.pricing.products ? dados.pricing.products[produto.slug] : null;
        if (!registo || !registo.prices) { return; }
        Object.keys(registo.prices).forEach(function (priceKey) {
          aplicarColuna(produto.slug, priceKey, colunaG);
          tabelas += 1;
        });
      });
      desenhar();
      alerta(tabelas + " tabelas passaram a usar " + colunaG + ". Falta gravar.", "ok");
      return;
    }

    if (op === "pack-adicionar") {
      var ctx = JSON.parse(alvo.dataset.contexto);
      var q = window.prompt("Quantidade do pack novo:");
      if (q === null) { return; }
      q = parseInt(q, 10);
      if (!q || q < 1) { alerta("Quantidade inválida.", "erro"); return; }
      var preco = window.prompt("Preço total do pack de " + q + " (em euros):", "0,00");
      if (preco === null) { return; }
      var cents = paraCents(preco);
      if (cents === null) { alerta("Preço inválido.", "erro"); return; }

      estrutural({ op: "pack-adicionar", slug: ctx.slug, priceKey: ctx.priceKey, quantidade: q, cents: cents },
        function () {
          var t = dados.pricing.products[ctx.slug].prices[ctx.priceKey];
          if (t[String(q)] != null) { throw new Error("já existe um pack de " + q); }
          t[String(q)] = cents;
          dados.pricing.products[ctx.slug].prices[ctx.priceKey] = ordenarTabela(t);
        });
      return;
    }

    if (op === "pack-remover") {
      var c = JSON.parse(alvo.dataset.contexto);
      if (!window.confirm("Remover o pack de " + c.quantidade + " de " + c.priceKey + "?")) { return; }
      estrutural({ op: "pack-remover", slug: c.slug, priceKey: c.priceKey, quantidade: c.quantidade },
        function () {
          var t = dados.pricing.products[c.slug].prices[c.priceKey];
          if (Object.keys(t).length <= 1) { throw new Error("é o último pack da tabela"); }
          delete t[String(c.quantidade)];
        });
      return;
    }

    if (op === "linha-adicionar") {
      var fich = alvo.dataset.ficheiro, tr = JSON.parse(alvo.dataset.trail);
      estrutural({ op: "linha-adicionar", ficheiro: fich, trail: tr }, function () {
        var col = coleccaoLocal(fich, tr);
        if (!col || !col.itens.length) { throw new Error("coleção sem modelo"); }
        var molde = clonar(col.itens[0]);
        molde.indice = col.itens.length;
        molde.identidade = "novo-" + (col.itens.length + 1);
        molde.trail = tr.concat([col.itens.length]);
        molde.textos = molde.textos.map(function (t) {
          return { campo: t.campo, texto: t.campo === "title" || t.campo === "label" ? "Novo" : "",
                   trail: molde.trail.concat([t.campo]) };
        });
        molde.dinheiro = molde.dinheiro.map(function (d) {
          return { campo: d.campo, tipo: d.tipo, cents: 0, trail: molde.trail.concat([d.campo]) };
        });
        col.itens.push(molde);
      });
      return;
    }

    if (op === "linha-remover") {
      if (!window.confirm("Remover esta linha?")) { return; }
      var f2 = alvo.dataset.ficheiro, t2 = JSON.parse(alvo.dataset.trail);
      estrutural({ op: "linha-remover", ficheiro: f2, trail: t2 }, function () {
        var pai = t2.slice(0, -1), idx = t2[t2.length - 1];
        var col = coleccaoLocal(f2, pai);
        if (!col) { throw new Error("coleção não encontrada"); }
        if (col.itens.length <= 1) { throw new Error("é a última linha"); }
        col.itens = col.itens.filter(function (i) { return i.indice !== idx; });
      });
      return;
    }

    if (op === "capsula-sincronizar") {
      var slug = alvo.dataset.slug;
      if (!window.confirm("Copiar os preços do catálogo para " + slug + " na cápsula do Congresso 2026?\n\n"
          + "Só as tabelas de preço. Imagens, designs e estrutura não são tocados.")) { return; }
      estrutural({ op: "capsula-sincronizar", slug: slug }, function () {
        var c = dados.capsula.filter(function (x) { return x.slug === slug; })[0];
        if (!c || !c.espelho) { throw new Error("sem espelho"); }
        var origem = dados.pricing.products[c.espelho].prices;
        Object.keys(c.prices).forEach(function (pk) {
          if (origem[pk]) { c.prices[pk] = clonar(origem[pk]); }
        });
        c.sincronizado = true;
        c.diferencas = [];
      });
    }
  });

  function ordenarTabela(t) {
    var out = {};
    Object.keys(t).map(Number).sort(function (a, b) { return a - b; })
      .forEach(function (q) { out[String(q)] = t[String(q)]; });
    return out;
  }

  function coleccaoLocal(slug, trail) {
    var prod = dados.produtos.filter(function (p) { return p.slug === slug; })[0];
    if (!prod) { return null; }
    var alvo = JSON.stringify(trail);
    return prod.coleccoes.filter(function (c) { return JSON.stringify(c.trail) === alvo; })[0] || null;
  }

  // Renomear a quantidade de um pack, ao sair do campo.
  document.addEventListener("blur", function (evento) {
    var alvo = evento.target;
    if (!alvo.dataset || alvo.dataset.op !== "pack-renomear") { return; }
    var novo = parseInt(alvo.value, 10);
    var antigo = parseInt(alvo.dataset.original, 10);
    if (!novo || novo === antigo) { alvo.value = antigo; return; }
    var ctx = JSON.parse(alvo.dataset.contexto);
    estrutural({ op: "pack-renomear", slug: ctx.slug, priceKey: ctx.priceKey, de: antigo, para: novo },
      function () {
        var t = dados.pricing.products[ctx.slug].prices[ctx.priceKey];
        if (t[String(novo)] != null) { throw new Error("já existe um pack de " + novo); }
        t[String(novo)] = t[String(antigo)];
        delete t[String(antigo)];
        dados.pricing.products[ctx.slug].prices[ctx.priceKey] = ordenarTabela(t);
      });
  }, true);

  // ── Gravar ───────────────────────────────────────────────────────────────

  function aplicar(extra) {
    var lista = operacoes().concat(extra || []);
    if (!lista.length) { return; }

    el("guardar").disabled = true;
    alerta("A gravar…");

    fetch(API + "?action=save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alteracoes: lista })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        el("guardar").disabled = false;
        if (!d.ok) {
          alerta(d.erro || "Não gravou.", "erro");
          if (d.problemas && d.problemas.length) {
            elCartaoDiag.hidden = false;
            elDiag.textContent = "Gravação recusada:\n\n" + d.problemas.join("\n");
            elCartaoDiag.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          return;
        }
        var onde = window.location.hash;
        dados = d;
        fila = Object.create(null);
        desenhar();
        alerta("Gravado.", "ok");
        if (onde) { var alvo = document.querySelector(onde); if (alvo) { alvo.scrollIntoView(); } }
      })
      .catch(function (e) { el("guardar").disabled = false; alerta(e.message, "erro"); });
  }

  el("guardar").addEventListener("click", function () { aplicar([]); });
  el("desfazer").addEventListener("click", desfazer);
  el("descartar").addEventListener("click", function () {
    if (!window.confirm("Descartar todas as alterações por gravar?")) { return; }
    pilhaUndo = [];
    carregar();
  });

  // Ctrl+Z e Ctrl+S, como em qualquer editor.
  document.addEventListener("keydown", function (evento) {
    if (!(evento.ctrlKey || evento.metaKey)) { return; }
    if (evento.key === "z" || evento.key === "Z") { evento.preventDefault(); desfazer(); }
    if (evento.key === "s" || evento.key === "S") {
      evento.preventDefault();
      if (nPendentes()) { aplicar([]); }
    }
  });

  function carregar() {
    alerta("A carregar…");
    return fetch(API + "?action=data", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { throw new Error(d.erro || "Falha a carregar."); }
        dados = d;
        fila = Object.create(null);
        desenhar();
      })
      .catch(function (e) { alerta(e.message, "erro"); });
  }

  el("recarregar").addEventListener("click", function () {
    if (nPendentes() && !window.confirm("Há alterações por gravar. Descartar?")) { return; }
    carregar();
  });

  // ── Vista Markdown ───────────────────────────────────────────────────────
  // Tudo em texto, para se colar numa conversa com um LLM e pedir revisão de
  // preços ou margens sem ter de descrever a estrutura toda à mão.

  function gerarMarkdown() {
    var L = [];
    var pendentes = nPendentes();

    L.push("# Preços — Mia & Paper");
    L.push("");
    L.push("Gerado em " + new Date().toISOString().slice(0, 16).replace("T", " ") + ".");
    if (pendentes) {
      L.push("");
      L.push("> ⚠️ Há **" + pendentes + "** alteraç" + (pendentes === 1 ? "ão" : "ões")
        + " por gravar. Os números abaixo já as incluem, mas o site ainda não.");
    }
    L.push("");
    L.push("Convenções: preços em euros; o **total** é o que fica gravado, o unitário e o "
      + "desconto são derivados. O desconto conta-se sobre o unitário da quantidade mais baixa "
      + "da tabela. O custo é o do material, por unidade, e não é público.");
    L.push("");

    dados.produtos.forEach(function (produto) {
      var registo = registoDe(produto.slug);
      L.push("## " + produto.titulo + " (`" + produto.slug + "`)");
      L.push("");
      var etiquetas = [];
      if (produto.mainV2) { etiquetas.push("main-v2"); }
      if (produto.pricingMode) { etiquetas.push("modo: " + produto.pricingMode); }
      etiquetas.push(produto.valido ? "configuração válida" : "**configuração inválida**");
      L.push("- " + etiquetas.join(" · "));
      L.push("");

      if (produto.variantes && produto.variantes.length) {
        var custoV = custoDe(produto.slug, produto.variantes[0].priceKey || "");
        L.push("Variantes (o cliente escolhe uma; não são quantidades):");
        L.push("");
        L.push("| Variante | Preço | Lucro | Margem |");
        L.push("|---|---:|---:|---:|");
        produto.variantes.forEach(function (v) {
          var t = textoLucro(v.cents, 1, custoV);
          L.push("| " + v.titulo + " | " + euros(v.cents) + " € | " + t.lucro + " | " + t.margem + " |");
        });
        L.push("");
        if (custoV) { L.push("Custo do material: " + euros(custoV) + " €/un."); L.push(""); }
      } else if (registo && registo.prices) {
        Object.keys(registo.prices).forEach(function (pk) {
          var tabela = registo.prices[pk];
          var custo = custoDe(produto.slug, pk);
          var modo = (registo.pricingModeByPriceKey && registo.pricingModeByPriceKey[pk]) || registo.pricingMode || "";
          L.push("### " + pk + " — " + modo);
          L.push("");
          if (custo) { L.push("Custo do material: **" + euros(custo) + " €/un**."); L.push(""); }
          L.push("| Qtd | Total | Por unidade | Desconto | Lucro/un | Lucro | Margem |");
          L.push("|---:|---:|---:|---:|---:|---:|---:|");
          Object.keys(tabela).map(Number).sort(function (a, b) { return a - b; }).forEach(function (q) {
            var cents = tabela[String(q)];
            var t = textoLucro(cents, q, custo);
            L.push("| " + q + " | " + euros(cents) + " € | " + euros(Math.round(cents / q)) + " € | "
              + descontoDe(tabela, q).toFixed(1).replace(".", ",") + "% | "
              + t.unidade + " | " + t.lucro + " | " + t.margem + " |");
          });
          L.push("");
        });
      }

      produto.coleccoes.forEach(function (col) {
        L.push("**" + col.nome + "** (`" + col.caminho + "`)");
        L.push("");
        L.push("| Item | Valor |");
        L.push("|---|---:|");
        col.itens.forEach(function (item) {
          var titulo = item.textos.filter(function (t) { return t.campo === "title" || t.campo === "label"; })[0];
          item.dinheiro.forEach(function (d) {
            L.push("| " + ((titulo && titulo.texto) || item.identidade || "—")
              + (item.dinheiro.length > 1 ? " · " + d.tipo : "") + " | " + euros(d.cents) + " € |");
          });
        });
        L.push("");
      });
    });

    if (dados.capsula && dados.capsula.length) {
      L.push("## Cápsula do Congresso 2026");
      L.push("");
      L.push("| Produto | Espelha | Estado |");
      L.push("|---|---|---|");
      dados.capsula.forEach(function (c) {
        L.push("| " + c.slug + " | " + (c.espelho || "—") + " | "
          + (!c.espelho ? "sem espelho" : (c.sincronizado ? "igual ao catálogo" : "difere: " + c.diferencas.join(", "))) + " |");
      });
      L.push("");
    }

    return L.join("\n");
  }

  el("verMarkdown").addEventListener("click", function () {
    el("markdown").textContent = gerarMarkdown();
    el("cartaoMarkdown").hidden = false;
    el("cartaoMarkdown").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  el("fecharMarkdown").addEventListener("click", function () { el("cartaoMarkdown").hidden = true; });
  el("copiarMarkdown").addEventListener("click", function () {
    var texto = el("markdown").textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(texto).then(function () { alerta("Markdown copiado.", "ok"); });
    } else {
      var a = document.createElement("textarea");
      a.value = texto; document.body.appendChild(a); a.select();
      document.execCommand("copy"); a.remove();
      alerta("Markdown copiado.", "ok");
    }
  });

  // ── Cross-check ──────────────────────────────────────────────────────────

  el("verificar").addEventListener("click", function () {
    var motor = el("motor").contentWindow;
    elCartaoDiag.hidden = false;
    elDiag.textContent = "A correr…";
    elCartaoDiag.scrollIntoView({ behavior: "smooth", block: "center" });

    if (!motor || typeof motor.tierPriceCents !== "function"
        || typeof motor.packCombinationPlan !== "function") {
      elDiag.textContent = "Não consegui aceder às funções de preço do site.\n"
        + "O iframe de stickers.html ainda não carregou, ou os módulos JS mudaram de forma.";
      return;
    }

    fetch(API + "?action=calcular&ate=500", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { throw new Error(d.erro || "Falha no cálculo do servidor."); }

        var linhas = [], divergencias = 0, comparadas = 0;

        d.tabelas.forEach(function (t) {
          var registo = dados.pricing.products[t.slug] || {};
          var tabela = registo.prices ? registo.prices[t.priceKey] : null;
          if (!tabela) { return; }

          var mausDesta = 0;
          for (var n = 1; n <= d.ate; n++) {
            var php = t.valores[n], js;
            if (t.modo === "tier-unit") {
              js = motor.tierPriceCents(tabela, n);
            } else if (t.modo === "pack-combination") {
              var plano = motor.packCombinationPlan(tabela, n, t.preferFewerPacks);
              js = plano ? plano.cents : null;
            } else {
              js = precoDe(tabela, t.modo, n, t.preferFewerPacks);
            }
            var iguais = (php === null || php === undefined)
              ? (js === null || js === undefined || js === 0)
              : js === php;
            comparadas++;
            if (!iguais) {
              divergencias++; mausDesta++;
              if (mausDesta <= 3) {
                linhas.push("  ✗ " + t.slug + " / " + t.priceKey + " / " + n + " un.  PHP=" + php + "  JS=" + js);
              }
            }
          }
          linhas.push((mausDesta ? "✗ " : "✓ ") + t.slug + " / " + t.priceKey
            + " (" + t.modo + ") — " + (mausDesta ? mausDesta + " divergências" : "sem divergências"));
        });

        elDiag.textContent = (divergencias === 0
          ? "✓ ZERO divergências em " + comparadas + " comparações (1 a " + d.ate + ").\n"
          : "✗ " + divergencias + " DIVERGÊNCIAS em " + comparadas + " comparações.\n"
            + "  O cliente veria um preço diferente do que o servidor cobra. Não publicar.\n")
          + "\n" + linhas.join("\n");

        alerta(divergencias === 0 ? "Cross-check sem divergências." : "Cross-check FALHOU.",
          divergencias === 0 ? "ok" : "erro");
      })
      .catch(function (e) { elDiag.textContent = "Erro: " + e.message; });
  });

  window.addEventListener("beforeunload", function (evento) {
    if (nPendentes()) { evento.preventDefault(); evento.returnValue = ""; }
  });

  // O iframe do motor carrega os 23 módulos e demora — se a página desenhar
  // antes disso, os gráficos saem com o cálculo simples em vez do verdadeiro.
  // Redesenha-os assim que as funções reais aparecem.
  function redesenharGraficos() {
    document.querySelectorAll(".curva-envolvente").forEach(function (env) {
      var tabelaEl = env.parentNode.querySelector("table");
      if (tabelaEl) { actualizarCurva(tabelaEl); }
    });
  }

  (function esperarMotor(tentativas) {
    var motor = el("motor").contentWindow;
    if (motor && typeof motor.packCombinationPlan === "function") {
      redesenharGraficos();
      return;
    }
    if (tentativas > 40) { return; }
    setTimeout(function () { esperarMotor(tentativas + 1); }, 250);
  }(0));

  carregar();
}());
</script>
</body>
</html>
