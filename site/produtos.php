<?php
/**
 * produtos.php
 *
 * Vista simples de todos os designs que o cliente pode escolher no primeiro
 * passo de cada produto. A lista vem directamente dos JSON activos: não há
 * slugs, produtos ou imagens duplicados neste ficheiro.
 */

header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');

// ADMIN_OPEN_DEV_V1: aberta durante o desenvolvimento; com
// MIA_ADMIN_OPEN=false volta a exigir a sessão administrativa normal.
require_once __DIR__ . '/admin-open.php';
require_once __DIR__ . '/lib/produtos-passo1.php';

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
        . '<title>Acesso negado · Designs dos produtos</title>'
        . '<style>body{font-family:Georgia,serif;max-width:560px;margin:60px auto;padding:0 20px;color:#3b2f1f}a{color:#4f7a3a;font-weight:700}</style>'
        . '<h1>Acesso restrito.</h1><p>Inicia sessão como administradora a partir do <a href="index.html">site</a> e regressa a esta página.</p>';
    exit;
}

function pd_h($valor)
{
    return htmlspecialchars((string)$valor, ENT_QUOTES, 'UTF-8');
}

function pd_caminho_imagem($valor)
{
    $caminho = str_replace('\\', '/', trim((string)$valor));
    if ($caminho === ''
        || strpos($caminho, '..') !== false
        || preg_match('/^(?:[a-z]+:|\/)/i', $caminho)
        || !preg_match('/\.webp$/i', $caminho)) {
        return '';
    }
    return $caminho;
}

function pd_ligacao_produto($produto)
{
    $href = isset($produto['form']['returnTo']) ? trim((string)$produto['form']['returnTo']) : '';
    return preg_match('/^[a-z0-9-]+\.html$/', $href) ? $href : '';
}

$produtos = array();
$totalDesigns = 0;
$pastaProdutos = __DIR__ . '/content/products';
$receitasPasso1 = pd_passo1_receitas();
$slugsPasso1 = array();
$avisosContrato = array();

foreach (glob($pastaProdutos . '/*.json') as $ficheiro) {
    $slug = basename($ficheiro, '.json');
    if (!preg_match('/^[a-z0-9-]+$/', $slug)) {
        continue;
    }

    $produto = json_decode((string)@file_get_contents($ficheiro), true);
    if (!is_array($produto) || empty($produto['steps']) || !is_array($produto['steps'])) {
        continue;
    }

    $primeiroPasso = null;
    $editorDesignStepId = isset($produto['editorDesignStepId']) ? trim((string)$produto['editorDesignStepId']) : '';
    foreach ($produto['steps'] as $indice => $passo) {
        if (!is_array($passo)) {
            continue;
        }
        if ($editorDesignStepId !== '') {
            if (!isset($passo['id']) || (string)$passo['id'] !== $editorDesignStepId) {
                continue;
            }
        } elseif (!empty($passo['hidden'])) {
            continue;
        }
        $primeiroPasso = $passo;
        $primeiroPasso['_indice'] = $indice;
        break;
    }

    $editorTemplate = $primeiroPasso && isset($primeiroPasso['template']) ? (string)$primeiroPasso['template'] : '';
    if (!$primeiroPasso
        || !in_array($editorTemplate, array('design-grid', 'designs-by-size'), true)
        || empty($primeiroPasso['items'])
        || !is_array($primeiroPasso['items'])) {
        continue;
    }

    $slugsPasso1[] = $slug;

    $receita = isset($receitasPasso1[$slug]) ? $receitasPasso1[$slug] : null;
    $erroContrato = '';
    if (!$receita) {
        $erroContrato = 'Falta a receita deste produto em lib/produtos-passo1.php.';
    } elseif ((isset($primeiroPasso['id']) ? (string)$primeiroPasso['id'] : '') !== $receita['stepId']) {
        $erroContrato = 'O id do primeiro passo já não corresponde à receita registada.';
    } else {
        $seccoesActuais = isset($primeiroPasso['sections']) && is_array($primeiroPasso['sections'])
            ? array_values(array_map(function ($seccao) {
                return is_array($seccao) && isset($seccao['id']) ? (string)$seccao['id'] : '';
            }, $primeiroPasso['sections']))
            : array();
        if ($seccoesActuais !== $receita['expectedSections']) {
            $erroContrato = 'As secções do primeiro passo já não correspondem à receita registada.';
        }
    }
    if ($erroContrato !== '') {
        $avisosContrato[] = $slug . ': ' . $erroContrato;
    }

    $designs = array();
    foreach ($primeiroPasso['items'] as $item) {
        if (!is_array($item) || !empty($item['hidden']) || !empty($item['disabled'])) {
            continue;
        }
        $designs[] = array(
            'id' => isset($item['id']) ? trim((string)$item['id']) : '',
            'titulo' => isset($item['title']) && trim((string)$item['title']) !== ''
                ? (string)$item['title']
                : (isset($item['value']) ? (string)$item['value'] : (isset($item['id']) ? (string)$item['id'] : 'Design')),
            'subtitulo' => isset($item['subtitle']) ? trim((string)$item['subtitle']) : '',
            'imagem' => pd_caminho_imagem(isset($item['image']) ? $item['image'] : ''),
        );
    }

    if (!$designs) {
        continue;
    }

    $produtos[] = array(
        'slug' => $slug,
        'nome' => isset($produto['name']) && trim((string)$produto['name']) !== '' ? (string)$produto['name'] : $slug,
        'titulo' => isset($primeiroPasso['title']) ? trim((string)$primeiroPasso['title']) : '',
        'href' => pd_ligacao_produto($produto),
        'seccoes' => isset($primeiroPasso['sections']) && is_array($primeiroPasso['sections'])
            ? array_values(array_filter($primeiroPasso['sections'], function ($seccao) {
                return is_array($seccao) && !empty($seccao['id']);
            }))
            : array(),
        'receita' => $receita,
        'erroContrato' => $erroContrato,
        'designs' => $designs,
    );
    $totalDesigns += count($designs);
}

usort($produtos, function ($a, $b) {
    return strcasecmp($a['nome'], $b['nome']);
});

foreach (array_keys($receitasPasso1) as $slugReceita) {
    if (!in_array($slugReceita, $slugsPasso1, true)) {
        $avisosContrato[] = 'A receita de ' . $slugReceita . ' já não corresponde a um produto com design-grid no primeiro passo.';
    }
}
?>
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Designs dos produtos · Mia &amp; Paper</title>
  <link rel="icon" href="content/brand/logo.webp" type="image/webp">
  <link rel="stylesheet" href="css/01-tokens-agua.css?v=20260908005511">
  <link rel="stylesheet" href="admin-nav.css?v=20260908005511">
  <script src="admin-nav.js?v=20260908005511" defer></script>
  <style>
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }
    a { color: inherit; }
    .pd-cabecalho, .pd-conteudo { width: min(100% - 32px, 1280px); margin-inline: auto; }
    .pd-cabecalho { padding: 48px 0 28px; }
    .pd-voltar { color: var(--muted); font-size: .9rem; text-decoration: none; }
    .pd-voltar:hover { color: var(--ink); text-decoration: underline; }
    h1 { margin: 14px 0 8px; font-family: Georgia, "Times New Roman", serif; font-size: clamp(2rem, 6vw, 3.8rem); line-height: 1.05; }
    .pd-intro { max-width: 680px; margin: 0; color: var(--muted); }
    .pd-indice { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
    .pd-indice a {
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--card);
      padding: 7px 12px;
      text-decoration: none;
      font-size: .86rem;
    }
    .pd-indice a:hover { border-color: var(--gold); }
    .pd-produto { padding: 38px 0 48px; border-top: 1px solid var(--line); scroll-margin-top: 16px; }
    .pd-produto-cabecalho { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
    .pd-produto h2 { margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: clamp(1.55rem, 4vw, 2.25rem); }
    .pd-produto-titulo { margin: 3px 0 0; color: var(--muted); font-size: .92rem; }
    .pd-produto-regra { margin: 5px 0 0; max-width: 720px; color: var(--muted); font-size: .78rem; }
    .pd-produto-regra.is-blocked { color: var(--ink); font-weight: 700; }
    .pd-produto-link { flex: none; color: var(--muted); font-size: .85rem; }
    .pd-produto-accoes { display: flex; flex: none; align-items: center; gap: 10px; }
    .pd-adicionar, .pd-remover, .pd-form-accoes button {
      min-height: 34px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--card);
      color: var(--ink);
      padding: 6px 13px;
      font: 700 .8rem/1 inherit;
      cursor: pointer;
    }
    .pd-adicionar { border-color: var(--gold); }
    .pd-status { margin: 18px 0 0; padding: 10px 13px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
    .pd-status.is-error { border-color: var(--gold); }
    .pd-contratos { margin: 18px 0 0; padding: 12px 15px; border: 2px solid var(--gold); border-radius: 12px; background: var(--card); }
    .pd-contratos strong { display: block; }
    .pd-contratos ul { margin: 6px 0 0; padding-left: 20px; }
    .pd-grelha { display: grid; grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); gap: 14px; }
    .pd-design { overflow: hidden; border: 1px solid var(--line); border-radius: 16px; background: var(--card); }
    .pd-design-abrir {
      display: block;
      width: 100%;
      border: 0;
      padding: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .pd-design:hover, .pd-design:focus-within { border-color: var(--gold); }
    .pd-design-abrir:focus-visible { outline: 3px solid var(--gold-soft); outline-offset: -3px; }
    .pd-upload-direto {
      position: relative;
      display: block;
      width: 100%;
      border: 0;
      padding: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    .pd-upload-direto:focus-visible { outline: 3px solid var(--gold-soft); outline-offset: -3px; }
    .pd-upload-legenda {
      position: absolute;
      inset: auto 8px 8px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: color-mix(in srgb, var(--card) 90%, transparent);
      padding: 5px 9px;
      font-size: .68rem;
      font-weight: 700;
      text-align: center;
    }
    .pd-upload-direto:hover .pd-upload-legenda, .pd-upload-direto:focus-visible .pd-upload-legenda { border-color: var(--gold); }
    .pd-upload-direto.is-dragging { outline: 3px solid var(--gold); outline-offset: -3px; }
    .pd-upload-direto.is-dragging .pd-upload-legenda { background: var(--gold-soft); }
    .pd-upload-direto:disabled { cursor: not-allowed; opacity: .65; }
    .pd-imagem {
      display: grid;
      width: 100%;
      aspect-ratio: 1 / 1;
      place-items: center;
      overflow: hidden;
      background: var(--linen);
    }
    .pd-imagem img { display: block; width: 100%; height: 100%; object-fit: contain; }
    .pd-sem-imagem { padding: 18px; color: var(--muted); text-align: center; font-size: .8rem; }
    .pd-design-texto { padding: 11px 12px 13px; }
    .pd-design strong { display: block; font-size: .9rem; line-height: 1.3; }
    .pd-design small { display: block; margin-top: 3px; color: var(--muted); line-height: 1.3; }
    .pd-editar { display: block; margin-top: 7px; color: var(--gold); font-size: .74rem; font-weight: 700; }
    .pd-design-accoes { display: grid; gap: 8px; padding: 0 12px 12px; }
    .pd-caminho { overflow: hidden; color: var(--muted); font: 400 .66rem/1.35 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
    .pd-identificadores { display: grid; gap: 5px; }
    .pd-identificadores-label { color: var(--muted); font-size: .68rem; font-weight: 700; }
    .pd-identificador { display: flex; flex-wrap: wrap; gap: 4px; }
    .pd-identificador code { max-width: 100%; overflow: hidden; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); color: var(--ink); padding: 2px 5px; font: 700 .65rem/1.3 ui-monospace, monospace; text-overflow: ellipsis; user-select: all; }
    .pd-identificador code:first-child { border-color: var(--gold); color: var(--gold); }
    .pd-identificadores-estado { color: var(--muted); font-size: .68rem; }
    .pd-remover { min-height: 30px; justify-self: start; border-color: var(--line); padding: 4px 10px; color: var(--muted); font-size: .72rem; }
    .pd-remover:hover { color: var(--ink); border-color: var(--gold); }
    .pd-editor {
      width: min(1180px, calc(100% - 24px));
      height: min(900px, calc(100% - 24px));
      max-width: none;
      max-height: none;
      padding: 0;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: var(--card);
      color: var(--ink);
    }
    .pd-editor::backdrop { background: color-mix(in srgb, var(--ink) 58%, transparent); }
    .pd-editor-cabecalho {
      display: flex;
      min-height: 52px;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 9px 12px 9px 18px;
      border-bottom: 1px solid var(--line);
      background: var(--card);
    }
    .pd-editor-cabecalho strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pd-editor-identidade { display: grid; min-width: 0; }
    .pd-editor-identidade small { color: var(--muted); font-size: .72rem; }
    .pd-editor-fechar {
      flex: none;
      min-height: 34px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--paper);
      color: var(--ink);
      padding: 5px 13px;
      font: 700 .82rem/1 inherit;
      cursor: pointer;
    }
    .pd-editor iframe { display: block; width: 100%; height: calc(100% - 53px); border: 0; background: var(--paper); }
    .pd-form-dialog { width: min(520px, calc(100% - 24px)); padding: 0; border: 1px solid var(--line); border-radius: 18px; background: var(--card); color: var(--ink); }
    .pd-form-dialog::backdrop { background: color-mix(in srgb, var(--ink) 58%, transparent); }
    .pd-form { display: grid; gap: 14px; padding: 18px; }
    .pd-form h2 { margin: 0; font-family: Georgia, "Times New Roman", serif; }
    .pd-form label { display: grid; gap: 5px; font-size: .82rem; font-weight: 700; }
    .pd-form input, .pd-form select { width: 100%; min-height: 40px; border: 1px solid var(--line); border-radius: 9px; background: var(--paper); color: var(--ink); padding: 8px 10px; font: inherit; }
    #pd-campos-extra { display: grid; gap: 14px; }
    .pd-form small, .pd-form-aviso { margin: 0; color: var(--muted); font-size: .75rem; font-weight: 400; }
    .pd-form-aviso { padding: 9px 11px; border-left: 3px solid var(--gold); background: var(--paper); }
    .pd-form-accoes { display: flex; justify-content: flex-end; gap: 8px; }
    .pd-form-accoes button[type="submit"] { border-color: var(--gold); background: var(--gold-soft); }
    .pd-form-accoes button:disabled, .pd-adicionar:disabled, .pd-remover:disabled { opacity: .5; cursor: wait; }
    .pd-vazio { padding: 50px 0; border-top: 1px solid var(--line); color: var(--muted); }
    @media (max-width: 560px) {
      .pd-cabecalho { padding-top: 30px; }
      .pd-produto-cabecalho { align-items: start; flex-direction: column; gap: 6px; }
      .pd-produto-accoes { width: 100%; justify-content: space-between; }
      .pd-grelha { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .pd-editor-identidade small { display: none; }
    }
  </style>
</head>
<body>
  <header class="pd-cabecalho">
    <a class="pd-voltar" href="index.html">← Voltar ao site</a>
    <h1>Designs dos produtos</h1>
    <p class="pd-intro"><?= count($produtos) ?> produtos · <?= $totalDesigns ?> designs disponíveis no PASSO 1.</p>
    <p class="pd-intro">Clica na imagem, ou arrasta para lá um ficheiro ou pasta com uma imagem, para a substituir directamente. O caminho por baixo do cartão é o campo <code>item.image</code> do JSON.</p>
    <?php if ($avisosContrato): ?>
      <aside class="pd-contratos" role="alert">
        <strong>As receitas do PASSO 1 precisam de ser actualizadas.</strong>
        <ul><?php foreach ($avisosContrato as $avisoContrato): ?><li><?= pd_h($avisoContrato) ?></li><?php endforeach; ?></ul>
      </aside>
    <?php endif; ?>
    <p class="pd-status" id="pd-status" role="status" hidden></p>
    <?php if ($produtos): ?>
      <nav class="pd-indice" aria-label="Produtos">
        <?php foreach ($produtos as $produto): ?>
          <a href="#<?= pd_h($produto['slug']) ?>"><?= pd_h($produto['nome']) ?> · <?= count($produto['designs']) ?></a>
        <?php endforeach; ?>
      </nav>
    <?php endif; ?>
  </header>

  <main class="pd-conteudo">
    <?php foreach ($produtos as $produto): ?>
      <section class="pd-produto" id="<?= pd_h($produto['slug']) ?>">
        <div class="pd-produto-cabecalho">
          <div>
            <h2><?= pd_h($produto['nome']) ?> <small>· <?= count($produto['designs']) ?></small></h2>
            <?php if ($produto['titulo'] !== ''): ?><p class="pd-produto-titulo"><?= pd_h($produto['titulo']) ?></p><?php endif; ?>
            <p class="pd-produto-regra<?= $produto['erroContrato'] !== '' || empty($produto['receita']['allowCreate']) ? ' is-blocked' : '' ?>"><?= pd_h($produto['erroContrato'] !== '' ? $produto['erroContrato'] : $produto['receita']['note']) ?></p>
          </div>
          <div class="pd-produto-accoes">
            <?php if ($produto['href'] !== ''): ?><a class="pd-produto-link" href="<?= pd_h($produto['href']) ?>">Abrir produto ↗</a><?php endif; ?>
            <button class="pd-adicionar" type="button"
                    data-adicionar-design
                    data-produto="<?= pd_h($produto['slug']) ?>"
                    data-nome="<?= pd_h($produto['nome']) ?>"
                    data-permitido="<?= $produto['erroContrato'] === '' && !empty($produto['receita']['allowCreate']) ? '1' : '0' ?>"
                    data-receita="<?= pd_h(json_encode($produto['receita'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) ?>"
                    data-seccoes="<?= pd_h(json_encode($produto['seccoes'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) ?>"
                    <?= $produto['erroContrato'] === '' && !empty($produto['receita']['allowCreate']) ? '' : 'disabled' ?>>Adicionar design</button>
          </div>
        </div>

        <div class="pd-grelha">
          <?php foreach ($produto['designs'] as $design): ?>
            <article class="pd-design">
              <button class="pd-upload-direto" type="button"
                    data-upload-direto
                    data-produto="<?= pd_h($produto['slug']) ?>"
                    data-item="<?= pd_h($design['id']) ?>"
                    data-titulo="<?= pd_h($design['titulo']) ?>"
                    data-permitido="<?= $produto['erroContrato'] === '' && !empty($produto['receita']['allowDirectUpload']) ? '1' : '0' ?>"
                    <?= $produto['erroContrato'] === '' && !empty($produto['receita']['allowDirectUpload']) ? '' : 'disabled' ?>
                    aria-label="Carregar directamente uma imagem para <?= pd_h($design['titulo']) ?>">
                <span class="pd-imagem">
                  <?php if ($design['imagem'] !== ''): ?>
                    <img src="<?= pd_h($design['imagem']) ?>" alt="" loading="eager" decoding="async">
                  <?php else: ?>
                    <span class="pd-sem-imagem">Imagem ainda não definida</span>
                  <?php endif; ?>
                </span>
                <span class="pd-upload-legenda">Clicar ou arrastar imagem</span>
              </button>
              <button class="pd-design-abrir" type="button"
                    data-editar-design
                    data-produto="<?= pd_h($produto['slug']) ?>"
                    data-item="<?= pd_h($design['id']) ?>"
                    data-titulo="<?= pd_h($produto['nome'] . ' · ' . $design['titulo']) ?>"
                    aria-label="Abrir a Galeria para ajustar <?= pd_h($design['titulo']) ?>">
              <div class="pd-design-texto">
                <strong><?= pd_h($design['titulo']) ?></strong>
                <?php if ($design['subtitulo'] !== ''): ?><small><?= pd_h($design['subtitulo']) ?></small><?php endif; ?>
                <span class="pd-editar">Alterar e ajustar imagem</span>
              </div>
              </button>
              <div class="pd-design-accoes">
                <code class="pd-caminho" title="<?= pd_h($design['imagem'] !== '' ? $design['imagem'] : 'image vazio') ?>"><?= pd_h($design['imagem'] !== '' ? $design['imagem'] : 'image: ""') ?></code>
                <div class="pd-identificadores" data-identificadores data-produto="<?= pd_h($produto['slug']) ?>" data-item="<?= pd_h($design['id']) ?>">
                  <span class="pd-identificadores-label">Identificadores da Galeria</span>
                  <span class="pd-identificadores-estado">A calcular…</span>
                </div>
                <button class="pd-remover" type="button"
                        data-remover-design
                        data-produto="<?= pd_h($produto['slug']) ?>"
                        data-item="<?= pd_h($design['id']) ?>"
                        data-permitido="<?= $produto['erroContrato'] === '' && !empty($produto['receita']['allowRemove']) ? '1' : '0' ?>"
                        data-motivo="<?= pd_h($produto['erroContrato'] !== '' ? $produto['erroContrato'] : (isset($produto['receita']['note']) ? $produto['receita']['note'] : '')) ?>"
                        data-titulo="<?= pd_h($design['titulo']) ?>"
                        <?= $produto['erroContrato'] === '' && !empty($produto['receita']['allowRemove']) ? '' : 'disabled' ?>>Remover design</button>
              </div>
            </article>
          <?php endforeach; ?>
        </div>
      </section>
    <?php endforeach; ?>

    <?php if (!$produtos): ?><p class="pd-vazio">Não foram encontrados produtos com designs no primeiro passo.</p><?php endif; ?>
  </main>

  <input id="pd-upload-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden>

  <dialog class="pd-editor" id="pd-editor" aria-labelledby="pd-editor-titulo">
    <div class="pd-editor-cabecalho">
      <div class="pd-editor-identidade">
        <strong id="pd-editor-titulo">Editar imagem</strong>
        <small>Setas: mover · Ctrl + setas: zoom/rodar · Shift: passos de 5 · Ctrl+Z: anular</small>
      </div>
      <button class="pd-editor-fechar" type="button" data-fechar-editor>Fechar</button>
    </div>
    <iframe id="pd-editor-frame" title="Editor da imagem"></iframe>
  </dialog>

  <dialog class="pd-form-dialog" id="pd-adicionar-dialog" aria-labelledby="pd-adicionar-titulo">
    <form class="pd-form" id="pd-adicionar-form">
      <h2 id="pd-adicionar-titulo">Adicionar design</h2>
      <input type="hidden" name="produto">
      <label>Nome do design
        <input type="text" name="titulo" maxlength="120" required autocomplete="off">
      </label>
      <label>Caminho da imagem
        <input type="text" name="imagem" placeholder="content/designs/.../imagem.webp" autocomplete="off" required>
        <small>É o valor gravado em <code>item.image</code>. A criação exige um ficheiro WebP que já exista.</small>
      </label>
      <label id="pd-seccao-linha">Secção
        <select name="seccao"></select>
      </label>
      <div id="pd-campos-extra"></div>
      <p class="pd-form-aviso" id="pd-form-aviso"></p>
      <p class="pd-form-aviso" id="pd-form-erro" hidden></p>
      <div class="pd-form-accoes">
        <button type="button" data-cancelar-adicao>Cancelar</button>
        <button type="submit">Criar no JSON</button>
      </div>
    </form>
  </dialog>

  <script src="galeria-slots.js?v=2026081701"></script>
  <script>
  (function () {
    "use strict";

    var dialog = document.getElementById("pd-editor");
    var frame = document.getElementById("pd-editor-frame");
    var titulo = document.getElementById("pd-editor-titulo");
    var adicionarDialog = document.getElementById("pd-adicionar-dialog");
    var adicionarForm = document.getElementById("pd-adicionar-form");
    var paginaStatus = document.getElementById("pd-status");
    var uploadInput = document.getElementById("pd-upload-input");
    var acessoAdmin = null;
    var alteracoesGuardadas = false;
    var receitaAtual = null;
    var uploadAlvo = null;

    function mostrarEstado(texto, erro) {
      paginaStatus.textContent = texto || "";
      paginaStatus.hidden = !texto;
      paginaStatus.classList.toggle("is-error", !!erro);
    }

    function respostaJson(response) {
      return response.text().then(function (texto) {
        var dados;
        try { dados = JSON.parse(texto); }
        catch (error) { throw new Error("O servidor devolveu uma resposta inválida."); }
        if (!response.ok || !dados.ok) {
          throw new Error(dados.message || "Não foi possível alterar o produto.");
        }
        return dados;
      });
    }

    function sessaoAdmin() {
      if (!acessoAdmin) {
        acessoAdmin = fetch("admin-api.php?action=status", {
          cache: "no-store",
          credentials: "same-origin"
        }).then(respostaJson).then(function (dados) {
          if (!dados.loggedIn || !dados.csrf) {
            throw new Error("É necessária uma sessão de administração para alterar os JSON.");
          }
          return dados;
        }).catch(function (error) {
          acessoAdmin = null;
          throw error;
        });
      }
      return acessoAdmin;
    }

    function passoDeDesigns(produto, receita) {
      if (!receita || !receita.stepId) { return null; }
      return (produto.steps || []).filter(function (passo) {
        return passo && !passo.hidden && passo.id === receita.stepId && passo.template === "design-grid";
      })[0] || null;
    }

    function receitaDoProduto(slug) {
      var botao = document.querySelector('[data-adicionar-design][data-produto="' + CSS.escape(slug) + '"]');
      try { return botao ? JSON.parse(botao.dataset.receita || "null") : null; }
      catch (error) { return null; }
    }

    function lerProduto(slug) {
      return fetch("content/products/" + encodeURIComponent(slug) + ".json", {
        cache: "no-store",
        credentials: "same-origin"
      }).then(function (response) {
        if (!response.ok) { throw new Error("Não consegui ler o JSON de " + slug + "."); }
        return response.json();
      });
    }

    function carregarIdentificadores() {
      var porProduto = {};
      document.querySelectorAll("[data-identificadores]").forEach(function (node) {
        var slug = node.dataset.produto || "";
        if (!porProduto[slug]) { porProduto[slug] = []; }
        porProduto[slug].push(node);
      });

      Object.keys(porProduto).forEach(function (slug) {
        lerProduto(slug).then(function (produto) {
          var entry = { slug: slug, key: slug, context: "principal", product: produto };
          var slots = window.MiaGaleriaSlots.collect(entry);
          porProduto[slug].forEach(function (node) {
            var itemId = node.dataset.item || "";
            var relacionados = slots.filter(function (slot) {
              var indice = slot.previewStepIndex != null ? slot.previewStepIndex : slot.stepIndex;
              var passo = produto.steps && produto.steps[indice];
              var pertence = String(slot.ownerItemId || slot.itemId || "") === itemId
                || String(slot.itemId || "") === itemId;
              return pertence && passo && passo.id === "designs";
            });

            node.querySelectorAll(".pd-identificador, .pd-identificadores-estado").forEach(function (filho) { filho.remove(); });
            if (!relacionados.length) {
              var vazio = document.createElement("span");
              vazio.className = "pd-identificadores-estado";
              vazio.textContent = "Sem localização editável no passo de designs.";
              node.appendChild(vazio);
              return;
            }

            relacionados.forEach(function (slot) {
              var linha = document.createElement("span");
              var curto = document.createElement("code");
              var longo = document.createElement("code");
              linha.className = "pd-identificador";
              linha.title = slot.detail || "Imagem";
              curto.textContent = slot.shortId || slot.id;
              longo.textContent = slot.id;
              linha.appendChild(curto);
              linha.appendChild(longo);
              node.appendChild(linha);
            });
          });
        }).catch(function (error) {
          porProduto[slug].forEach(function (node) {
            var estado = node.querySelector(".pd-identificadores-estado");
            if (estado) { estado.textContent = "Não foi possível calcular os identificadores."; }
          });
        });
      });
    }

    function gravarProduto(produto) {
      return sessaoAdmin().then(function (admin) {
        return fetch("admin-api.php?action=save-product", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-CSRF": admin.csrf
          },
          body: JSON.stringify({ product: produto })
        }).then(respostaJson);
      });
    }

    function ficheiroImagem(ficheiro) {
      return !!ficheiro && (/^image\/(?:jpeg|png|webp|gif|avif)$/i.test(ficheiro.type || "")
        || /\.(?:jpe?g|png|webp|gif|avif)$/i.test(ficheiro.name || ""));
    }

    function lerEntradaLargada(entrada) {
      if (entrada.isFile) {
        return new Promise(function (resolve, reject) {
          entrada.file(function (ficheiro) { resolve([ficheiro]); }, reject);
        });
      }
      if (!entrada.isDirectory) { return Promise.resolve([]); }

      return new Promise(function (resolve, reject) {
        var leitor = entrada.createReader();
        var entradas = [];
        function lerLote() {
          leitor.readEntries(function (lote) {
            if (!lote.length) {
              Promise.all(entradas.map(lerEntradaLargada)).then(function (grupos) {
                resolve([].concat.apply([], grupos));
              }, reject);
              return;
            }
            entradas = entradas.concat(Array.from(lote));
            lerLote();
          }, reject);
        }
        lerLote();
      });
    }

    function ficheirosLargados(transferencia) {
      var items = Array.from(transferencia.items || []);
      var entradas = items.map(function (item) {
        return item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      }).filter(Boolean);
      if (!entradas.length) { return Promise.resolve(Array.from(transferencia.files || [])); }
      return Promise.all(entradas.map(lerEntradaLargada)).then(function (grupos) {
        return [].concat.apply([], grupos);
      });
    }

    function aplicarUploadDireto(item, receita, caminho) {
      var alvos = receita && receita.directUploadTargets;
      if (!receita || receita.allowDirectUpload !== true || !Array.isArray(alvos) || !alvos.length) {
        throw new Error("A receita deste produto não permite upload directo.");
      }
      alvos.forEach(function (alvo) {
        if (alvo === "image") {
          item.image = caminho;
        } else if (alvo === "laminationImages.matte") {
          if (!item.laminationImages || Array.isArray(item.laminationImages)) { item.laminationImages = {}; }
          item.laminationImages.matte = caminho;
        } else if (alvo === "interiorImages.0") {
          if (!Array.isArray(item.interiorImages)) { item.interiorImages = []; }
          item.interiorImages[0] = caminho;
        } else {
          throw new Error("Alvo de upload directo não suportado na receita: " + alvo + ".");
        }
      });
    }

    function enviarImagem(ficheiro) {
      var dados = new FormData();
      dados.append("files[]", ficheiro, ficheiro.name);
      return sessaoAdmin().then(function (admin) {
        return fetch("galeria-api.php?action=upload", {
          method: "POST",
          credentials: "same-origin",
          headers: { "X-Admin-CSRF": admin.csrf },
          body: dados
        }).then(respostaJson);
      }).then(function (resposta) {
        if (!Array.isArray(resposta.saved) || resposta.saved.length !== 1 || !resposta.saved[0].path) {
          var rejeitado = resposta.rejected && resposta.rejected[0];
          throw new Error(rejeitado && (rejeitado.message || rejeitado.reason)
            ? (rejeitado.message || rejeitado.reason)
            : "A Galeria não devolveu a imagem convertida.");
        }
        return resposta.saved[0].path;
      });
    }

    function substituirImagem(alvo, ficheiro) {
      var slug = alvo.dataset.produto || "";
      var itemId = alvo.dataset.item || "";
      var nome = alvo.dataset.titulo || itemId;
      var receita = receitaDoProduto(slug);
      var produtoActual;
      var itemActual;

      if (alvo.dataset.permitido !== "1" || !receita || receita.allowDirectUpload !== true) {
        mostrarEstado("O contrato deste produto não permite upload directo.", true);
        return;
      }
      if (!ficheiroImagem(ficheiro)) {
        mostrarEstado("Escolhe uma imagem JPG, PNG, WebP, GIF ou AVIF.", true);
        return;
      }

      bloquearEdicao(true);
      mostrarEstado("A carregar e converter a imagem de " + nome + "…", false);
      lerProduto(slug).then(function (produto) {
        var passo = passoDeDesigns(produto, receita);
        if (!passo || !Array.isArray(passo.items)) { throw new Error("O JSON já não corresponde à receita deste produto."); }
        itemActual = passo.items.filter(function (item) { return String(item.id || "") === itemId; })[0];
        if (!itemActual) { throw new Error("Este design já não existe no JSON."); }
        produtoActual = produto;
        return enviarImagem(ficheiro);
      }).then(function (caminho) {
        aplicarUploadDireto(itemActual, receita, caminho);
        return gravarProduto(produtoActual);
      }).then(function () {
        terminarAlteracao("Imagem de " + nome + " substituída e gravada no JSON.");
      }).catch(function (error) {
        mostrarEstado(error.message, true);
        bloquearEdicao(false);
      });
    }

    function bloquearEdicao(bloqueado) {
      document.querySelectorAll("[data-adicionar-design], [data-remover-design], [data-upload-direto]").forEach(function (botao) {
        botao.disabled = bloqueado || botao.dataset.permitido !== "1";
      });
    }

    function terminarAlteracao(mensagem) {
      try { window.sessionStorage.setItem("mia-produtos-flash", mensagem); } catch (error) {}
      window.location.reload();
    }

    function slugSeguro(texto) {
      var slug = String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      slug = slug.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      return slug || "design";
    }

    function valorUnico(items, titulo) {
      var usados = {};
      var candidato = titulo;
      var numero = 2;
      items.forEach(function (item) { usados[String(item.value || "").toLowerCase()] = true; });
      while (usados[candidato.toLowerCase()]) {
        candidato = titulo + " " + numero;
        numero += 1;
      }
      return candidato;
    }

    function idUnico(items, titulo) {
      var usados = {};
      var base = slugSeguro(titulo);
      var candidato = base;
      var numero = 2;
      items.forEach(function (item) { usados[String(item.id || "")] = true; });
      while (usados[candidato]) {
        candidato = base + "-" + numero;
        numero += 1;
      }
      return candidato;
    }

    function validarImagem(caminho) {
      if (!caminho) { return Promise.resolve(); }
      if (caminho.indexOf("content/") !== 0
          || caminho.indexOf("..") !== -1
          || /[?#]/.test(caminho)
          || !/\.webp$/i.test(caminho)) {
        return Promise.reject(new Error("A imagem tem de ser um caminho WebP dentro de content/, sem .., ? ou #."));
      }
      return fetch(caminho, { method: "HEAD", cache: "no-store" }).then(function (response) {
        if (!response.ok) { throw new Error("Não existe nenhum ficheiro nesse caminho."); }
      });
    }

    function desenharCamposExtra(receita) {
      var contentor = document.getElementById("pd-campos-extra");
      contentor.innerHTML = "";
      (receita.extraImages || []).forEach(function (campo) {
        var label = document.createElement("label");
        var input = document.createElement("input");
        var small = document.createElement("small");
        label.appendChild(document.createTextNode(campo.label));
        input.type = "text";
        input.name = "extra_" + campo.name;
        input.placeholder = "content/designs/.../imagem.webp";
        input.required = true;
        input.dataset.extraImagem = campo.name;
        small.textContent = campo.group + "." + campo.key;
        label.appendChild(input);
        label.appendChild(small);
        contentor.appendChild(label);
      });
    }

    try {
      var flash = window.sessionStorage.getItem("mia-produtos-flash");
      if (flash) {
        window.sessionStorage.removeItem("mia-produtos-flash");
        mostrarEstado(flash, false);
      }
    } catch (error) {}

    if (window.MiaGaleriaSlots) { carregarIdentificadores(); }

    document.querySelectorAll("[data-upload-direto]").forEach(function (alvo) {
      alvo.addEventListener("click", function () {
        if (alvo.dataset.permitido !== "1") { return; }
        uploadAlvo = alvo;
        uploadInput.value = "";
        uploadInput.click();
      });
      alvo.addEventListener("dragover", function (event) {
        if (alvo.dataset.permitido !== "1") { return; }
        event.preventDefault();
        if (event.dataTransfer) { event.dataTransfer.dropEffect = "copy"; }
        alvo.classList.add("is-dragging");
      });
      alvo.addEventListener("dragleave", function (event) {
        if (!event.relatedTarget || !alvo.contains(event.relatedTarget)) { alvo.classList.remove("is-dragging"); }
      });
      alvo.addEventListener("drop", function (event) {
        event.preventDefault();
        alvo.classList.remove("is-dragging");
        if (alvo.dataset.permitido !== "1") { return; }
        ficheirosLargados(event.dataTransfer).then(function (ficheiros) {
          var imagens = ficheiros.filter(ficheiroImagem);
          if (imagens.length !== 1) {
            throw new Error(imagens.length
              ? "Larga apenas uma imagem de cada vez neste design."
              : "Não encontrei uma imagem JPG, PNG, WebP, GIF ou AVIF no que largaste.");
          }
          substituirImagem(alvo, imagens[0]);
        }).catch(function (error) { mostrarEstado(error.message, true); });
      });
    });

    uploadInput.addEventListener("change", function () {
      var ficheiro = uploadInput.files && uploadInput.files[0];
      if (uploadAlvo && ficheiro) { substituirImagem(uploadAlvo, ficheiro); }
      uploadInput.value = "";
    });

    document.addEventListener("click", function (event) {
      var botao = event.target.closest("[data-editar-design]");
      var params;
      var editorUrl;
      if (!botao) { return; }

      params = new URLSearchParams({
        embed: "1",
        entry: botao.dataset.produto || "",
        step: "designs",
        item: botao.dataset.item || ""
      });
      editorUrl = "galeria.html?" + params.toString();
      alteracoesGuardadas = false;
      titulo.textContent = botao.dataset.titulo || "Editar imagem";
      if (frame.getAttribute("src") !== editorUrl) { frame.src = editorUrl; }
      dialog.showModal();
    });

    document.querySelector("[data-fechar-editor]").addEventListener("click", function () {
      dialog.close();
    });

    document.querySelectorAll("[data-adicionar-design]").forEach(function (botao) {
      botao.addEventListener("click", function () {
        var seccoes = [];
        var select = adicionarForm.elements.seccao;
        try { seccoes = JSON.parse(botao.dataset.seccoes || "[]"); } catch (error) {}
        try { receitaAtual = JSON.parse(botao.dataset.receita || "null"); } catch (error) { receitaAtual = null; }

        if (botao.dataset.permitido !== "1" || !receitaAtual) {
          mostrarEstado("Este produto não tem uma receita de criação válida.", true);
          return;
        }

        adicionarForm.reset();
        adicionarForm.elements.produto.value = botao.dataset.produto || "";
        document.getElementById("pd-adicionar-titulo").textContent = "Adicionar design a " + (botao.dataset.nome || "produto");
        document.getElementById("pd-form-aviso").textContent = receitaAtual.note || "";
        document.getElementById("pd-form-aviso").hidden = !receitaAtual.note;
        document.getElementById("pd-form-erro").hidden = true;
        desenharCamposExtra(receitaAtual);
        select.innerHTML = seccoes.map(function (seccao) {
          var option = document.createElement("option");
          option.value = seccao.id || "";
          option.textContent = seccao.title || seccao.id || "Secção";
          return option.outerHTML;
        }).join("");
        document.getElementById("pd-seccao-linha").hidden = !seccoes.length;
        adicionarDialog.showModal();
        adicionarForm.elements.titulo.focus();
      });
    });

    document.querySelector("[data-cancelar-adicao]").addEventListener("click", function () {
      adicionarDialog.close();
    });

    adicionarForm.addEventListener("submit", function (event) {
      var slug = String(adicionarForm.elements.produto.value || "");
      var nome = String(adicionarForm.elements.titulo.value || "").trim();
      var imagem = String(adicionarForm.elements.imagem.value || "").trim().replace(/\\/g, "/");
      var seccao = String(adicionarForm.elements.seccao.value || "");
      var extras = {};
      var imagensAValidar = [imagem];
      var submit = adicionarForm.querySelector('[type="submit"]');
      var erro = document.getElementById("pd-form-erro");

      event.preventDefault();
      submit.disabled = true;
      erro.hidden = true;

      adicionarForm.querySelectorAll("[data-extra-imagem]").forEach(function (input) {
        extras[input.dataset.extraImagem] = String(input.value || "").trim().replace(/\\/g, "/");
        imagensAValidar.push(extras[input.dataset.extraImagem]);
      });

      if (!receitaAtual || receitaAtual.allowCreate !== true) {
        erro.textContent = "A receita deste produto não permite criação nesta interface.";
        erro.hidden = false;
        submit.disabled = false;
        return;
      }

      Promise.all(imagensAValidar.map(validarImagem)).then(function () {
        return lerProduto(slug);
      }).then(function (produto) {
        var passo = passoDeDesigns(produto, receitaAtual);
        var items;
        var item;
        var ordens;
        var defaults;
        if (!passo) { throw new Error("O JSON já não corresponde à receita registada para este produto."); }
        items = Array.isArray(passo.items) ? passo.items : (passo.items = []);
        defaults = JSON.parse(JSON.stringify(receitaAtual.defaults || {}));
        item = {
          id: idUnico(items, nome),
          value: valorUnico(items, nome),
          title: nome,
          subtitle: "",
          image: imagem
        };
        Object.keys(defaults).forEach(function (chave) { item[chave] = defaults[chave]; });
        if (receitaAtual.strategy === "caderno-anual") {
          item.laminationImages = {
            matte: imagem,
            glossy: extras.glossy,
            holografico: extras.holografico,
            glitter: extras.glitter
          };
          item.interiorImages = [imagem];
          item.purchaseOptionImages = {
            caderno_normal: extras.caderno_normal,
            caderno_pioneiro: extras.caderno_pioneiro,
            pack_normal: extras.pack_normal,
            pack_pioneiro: extras.pack_pioneiro
          };
        } else if (receitaAtual.strategy === "cover-drawer") {
          item.interiorImages = [extras.interior];
        } else if (receitaAtual.strategy !== "standard") {
          throw new Error("Estratégia de criação não suportada: " + receitaAtual.strategy + ".");
        }
        if (seccao) {
          item.sectionId = seccao;
          ordens = items.filter(function (existente) { return existente.sectionId === seccao; })
            .map(function (existente) { return Number(existente.sectionOrder); })
            .filter(function (ordem) { return isFinite(ordem); });
          item.sectionOrder = ordens.length ? Math.max.apply(Math, ordens) + 1 : 1;
        }
        items.push(item);
        return gravarProduto(produto);
      }).then(function () {
        terminarAlteracao("Design criado no JSON. Recria os snapshots antes de publicar.");
      }).catch(function (error) {
        erro.textContent = error.message;
        erro.hidden = false;
        submit.disabled = false;
      });
    });

    document.querySelectorAll("[data-remover-design]").forEach(function (botao) {
      botao.addEventListener("click", function () {
        var slug = botao.dataset.produto || "";
        var itemId = botao.dataset.item || "";
        var nome = botao.dataset.titulo || itemId;
        var receita = receitaDoProduto(slug);
        if (botao.dataset.permitido !== "1" || !receita || receita.allowRemove !== true) {
          mostrarEstado(botao.dataset.motivo || "A remoção está bloqueada para este produto.", true);
          return;
        }
        if (!window.confirm('Remover "' + nome + '" do PASSO 1? O backend deixará de aceitar este design em novas encomendas.')) {
          return;
        }

        bloquearEdicao(true);
        mostrarEstado("A remover " + nome + "…", false);
        lerProduto(slug).then(function (produto) {
          var passo = passoDeDesigns(produto, receita);
          var antes;
          if (!passo || !Array.isArray(passo.items)) { throw new Error("Não encontrei a lista de designs deste produto."); }
          if (passo.items.length <= 1) { throw new Error("Não é possível remover o único design do produto."); }
          antes = passo.items.length;
          passo.items = passo.items.filter(function (item) { return String(item.id || "") !== itemId; });
          if (passo.items.length === antes) { throw new Error("O design já não existe no JSON."); }
          return gravarProduto(produto);
        }).then(function () {
          terminarAlteracao("Design removido do JSON. Recria os snapshots antes de publicar.");
        }).catch(function (error) {
          mostrarEstado(error.message, true);
          bloquearEdicao(false);
        });
      });
    });

    dialog.addEventListener("close", function () {
      if (alteracoesGuardadas) {
        window.location.reload();
      }
    });

    window.addEventListener("message", function (event) {
      if (event.origin !== window.location.origin || event.source !== frame.contentWindow) { return; }
      if (event.data && event.data.type === "mia-gallery-saved") {
        alteracoesGuardadas = true;
      }
    });
  }());
  </script>
</body>
</html>