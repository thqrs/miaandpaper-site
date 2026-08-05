<?php
/**
 * modulos.php — MODULOS_V2
 *
 * Inventário visual dos módulos de interface do site, gerado no momento do
 * pedido.
 *
 * ── O que mudou da V1 ───────────────────────────────────────────────────────
 *
 * A primeira versão listava as 634 classes do styles.css e desenhava cada uma
 * como `<div class="X">Exemplo</div>`. Era inútil: uma classe solta fora da
 * sua estrutura não mostra nada — 634 cartões com a palavra "Exemplo" em
 * fundos ligeiramente diferentes.
 *
 * Esta versão mostra **módulos inteiros**: o passo de designs como aparece no
 * site, a caixa de packs e preços, o formulário de dados, o resumo final, a
 * homepage. Cada um desenhado pelo próprio `app.js`, dentro de um iframe, em
 * claro e escuro lado a lado.
 *
 * ── Como se mantém sozinha ──────────────────────────────────────────────────
 *
 * Os módulos são descobertos a ler `content/products/*.json` e a agrupar os
 * passos pelo seu `template`. Passo novo, produto novo ou template novo
 * aparecem aqui sem se tocar em nada. Não há lista escrita à mão.
 *
 * O desenho é feito por `modulos-preview.html`, que chama
 * `MiaPreview.renderStep()` — a mesma função que a galeria usa. Não há uma
 * segunda implementação da interface: o que se vê aqui é o que o site desenha.
 *
 * O inventário de classes da V1 continua no fim da página, encolhido, porque
 * a marcação de classes órfãs é útil.
 */

header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');

require_once __DIR__ . '/lib/snapshot.php';
mp_snapshot_start('modulos', array());

$RAIZ = __DIR__;
$CSS_PATH = $RAIZ . '/styles.css';

function mod_h($v)
{
    return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
}

// ---------------------------------------------------------------------------
// 1. Descobrir os módulos de interface
// ---------------------------------------------------------------------------

/**
 * O que cada template é, em português. Um template sem descrição aparece na
 * mesma — só sem a legenda. É o único texto escrito à mão nesta página, e a
 * sua falta não esconde nada.
 */
function mod_descricao_template($template)
{
    $mapa = array(
        'design-grid' => 'Grelha de designs para escolher. O passo 1 da maioria dos produtos.',
        'quantity-builder' => 'Packs e quantidade livre, com o cálculo do melhor conjunto e a sugestão de poupança.',
        'option-drawers' => 'Gavetas independentes para escolher opções extra e acréscimos por unidade.',
        'price-pack-grid' => 'Tabela de packs e preços, sem escolha de quantidade.',
        'details-form' => 'Campos de texto — normalmente os dados do cartão de apresentação.',
        'delivery-contact' => 'Escolha de entrega mais os dados de contacto e o NIF.',
        'confirm' => 'Resumo de tudo antes de enviar o pedido.',
        'original-artwork-upload' => 'Envio dos ficheiros do cliente, com pré-visualização e taxa de preparação.',
        'custom-product-builder' => 'Escolher em que produtos aplicar um design enviado. Só na personalização.',
        'media-list' => 'Lista com imagem e duas linhas de texto por opção.',
        'text-grid' => 'Grelha só de texto, para escolhas sem imagem.',
        'palette-grid' => 'Paleta de cores. Os quadrados têm água em canvas, não é CSS.',
        'photo-upload' => 'Envio de fotos do cliente para as molduras.',
        'lamination-choice' => 'Escolha de laminação dos cadernos, com amostra de cada acabamento.',
        'purchase-option' => 'Opções de compra do caderno: normal, pioneiro e os packs.',
        'cover-personalization' => 'Texto a gravar na capa.',
    );
    return isset($mapa[$template]) ? $mapa[$template] : '';
}

$modulos = array();

foreach (glob($RAIZ . '/content/products/*.json') as $ficheiro) {
    $slug = basename($ficheiro, '.json');
    if (!preg_match('/^[a-z0-9-]+$/', $slug)) {
        continue;
    }
    $produto = json_decode((string)@file_get_contents($ficheiro), true);
    if (!is_array($produto) || empty($produto['steps'])) {
        continue;
    }

    foreach ($produto['steps'] as $indice => $passo) {
        $template = isset($passo['template']) ? (string)$passo['template'] : '';
        if ($template === '') {
            continue;
        }
        if (!isset($modulos[$template])) {
            $modulos[$template] = array();
        }

        // Um exemplo com fotos mostra o módulo; um exemplo com molduras vazias
        // mostra caixas cinzentas. Contamos as imagens para pôr os melhores
        // exemplos à frente — sem escolher produtos à mão.
        $comImagem = 0;
        foreach ((isset($passo['items']) && is_array($passo['items'])) ? $passo['items'] : array() as $item) {
            if (!empty($item['image'])) {
                $comImagem++;
            }
        }

        $modulos[$template][] = array(
            'slug' => $slug,
            'produto' => isset($produto['name']) ? $produto['name'] : $slug,
            'passo' => $indice,
            'passoId' => isset($passo['id']) ? $passo['id'] : '',
            'titulo' => isset($passo['title']) ? $passo['title'] : (isset($passo['label']) ? $passo['label'] : ''),
            'comImagem' => $comImagem,
        );
    }
}

// Dentro de cada módulo: primeiro os exemplos com mais imagens.
foreach ($modulos as $template => $usos) {
    usort($usos, function ($a, $b) {
        if ($a['comImagem'] !== $b['comImagem']) {
            return $b['comImagem'] - $a['comImagem'];
        }
        return strcmp($a['slug'], $b['slug']);
    });
    $modulos[$template] = $usos;
}

// Os mais usados primeiro: são a espinha do site.
uasort($modulos, function ($a, $b) {
    return count($b) - count($a);
});

$totalExemplos = 0;
foreach ($modulos as $usos) {
    $totalExemplos += count($usos);
}

// ---------------------------------------------------------------------------
// 1-A. A paleta
// ---------------------------------------------------------------------------
//
// São os 13 tokens que o `app.js` aplica a partir de `content/home.json`
// (`applyTheme`). São a paleta a sério do site: tudo o resto no CSS refere-se
// a eles por `var()`, por isso mudá-los muda o site inteiro.
//
// Os nomes vêm do JSON, não de uma lista escrita aqui — se lá aparecer uma cor
// nova, aparece também neste painel.

/** `goldSoft` no JSON é `--gold-soft` no CSS. */
function mod_token_css($chaveJson)
{
    return '--' . strtolower(preg_replace('/([a-z0-9])([A-Z])/', '$1-$2', $chaveJson));
}

$homeJson = json_decode((string)@file_get_contents($RAIZ . '/content/home.json'), true);
$temaClaro = array();
if (is_array($homeJson) && !empty($homeJson['theme']) && is_array($homeJson['theme'])) {
    foreach ($homeJson['theme'] as $chave => $valor) {
        $valor = trim((string)$valor);
        if (preg_match('/^#[0-9a-f]{3,8}$/i', $valor)) {
            $temaClaro[mod_token_css($chave)] = $valor;
        }
    }
}

// Os valores do modo escuro vivem no bloco `html[data-theme="dark"]` do CSS.
$temaEscuro = array();
if (preg_match('/html\[data-theme="dark"\]\s*\{([^}]*)\}/', $cssBrutoParaTema = (is_file($CSS_PATH) ? file_get_contents($CSS_PATH) : ''), $bloco)) {
    if (preg_match_all('/(--[a-z0-9-]+)\s*:\s*([^;!]+)/i', $bloco[1], $pares, PREG_SET_ORDER)) {
        foreach ($pares as $par) {
            $nome = trim($par[1]);
            $valor = trim($par[2]);
            if (isset($temaClaro[$nome]) && preg_match('/^#[0-9a-f]{3,8}$/i', $valor)) {
                $temaEscuro[$nome] = $valor;
            }
        }
    }
}
// Um token sem valor próprio no escuro herda o claro.
foreach ($temaClaro as $nome => $valor) {
    if (!isset($temaEscuro[$nome])) {
        $temaEscuro[$nome] = $valor;
    }
}

/**
 * Segunda camada: os tokens `--ui-*` (CSS_UNIFORMITY_LAYER_V1).
 *
 * Descobri-os ao testar este painel: mudar `--card` não mudava o fundo dos
 * cartões. A razão é que `.step-card` tem duas regras, e a que ganha usa
 * `var(--ui-card)` — um token com valor PRÓPRIO (`#fffdf8`), não derivado de
 * `--card`. Ou seja: a paleta da marca não controla as superfícies dos
 * componentes.
 *
 * Por isso o painel tem de mostrar as duas camadas, senão mexer nas cores
 * parece não fazer nada. Está registado no RELATORIO-DESIGN-CSS.md.
 */
function mod_tokens_de_bloco($css, $seletor, $prefixo)
{
    $out = array();
    $padrao = '/' . preg_quote($seletor, '/') . '\s*\{([^}]*)\}/';
    if (!preg_match_all($padrao, $css, $blocos)) {
        return $out;
    }
    foreach ($blocos[1] as $corpo) {
        if (!preg_match_all('/(' . preg_quote($prefixo, '/') . '[a-z0-9-]+)\s*:\s*([^;!]+)/i', $corpo, $pares, PREG_SET_ORDER)) {
            continue;
        }
        foreach ($pares as $par) {
            $valor = trim($par[2]);
            // Só cores directas. Os que apontam para outro token (`var(--line)`)
            // já se mexem sozinhos quando se mexe no token de origem.
            if (preg_match('/^#[0-9a-f]{3,8}$/i', $valor) || preg_match('/^rgba?\(/i', $valor)) {
                $out[trim($par[1])] = $valor;
            }
        }
    }
    return $out;
}

$cssParaTokens = is_file($CSS_PATH) ? file_get_contents($CSS_PATH) : '';
$uiClaro = mod_tokens_de_bloco($cssParaTokens, ':root', '--ui-');
$uiEscuro = mod_tokens_de_bloco($cssParaTokens, 'html[data-theme="dark"]', '--ui-');
foreach ($uiClaro as $nome => $valor) {
    if (!isset($uiEscuro[$nome])) {
        $uiEscuro[$nome] = $valor;
    }
}

// Terceira camada: os restantes tokens de cor de `:root`. Sem isto, os chips
// dos módulos apontavam para tokens (`--line`, `--hero-foreground`) que não
// tinham linha na tabela — via-se que eram usados mas não se podia experimentar.
$outrosClaro = mod_tokens_de_bloco($cssParaTokens, ':root', '--');
$outrosEscuro = mod_tokens_de_bloco($cssParaTokens, 'html[data-theme="dark"]', '--');
foreach (array_merge(array_keys($temaClaro), array_keys($uiClaro)) as $jaTem) {
    unset($outrosClaro[$jaTem], $outrosEscuro[$jaTem]);
}
foreach ($outrosClaro as $nome => $valor) {
    if (!isset($outrosEscuro[$nome])) {
        $outrosEscuro[$nome] = $valor;
    }
}
ksort($outrosClaro);

/** As três camadas, para a tabela do painel. */
$grupos = array(
    array('titulo' => 'Paleta da marca', 'nota' => 'vem de content/home.json', 'claro' => $temaClaro, 'escuro' => $temaEscuro),
    array('titulo' => 'Superfícies da interface', 'nota' => 'camada --ui-* do styles.css', 'claro' => $uiClaro, 'escuro' => $uiEscuro),
    array('titulo' => 'Outras cores', 'nota' => 'restantes tokens de :root', 'claro' => $outrosClaro, 'escuro' => $outrosEscuro),
);

// ---------------------------------------------------------------------------
// 2. Inventário de classes (secção encolhida no fim)
// ---------------------------------------------------------------------------

function mod_prefixos_dinamicos()
{
    return array(
        'category-grid-count-', 'review-theme-', 'review-size-', 'review-position-',
        'review-image-', 'item-rect-orientation-', 'product-rect-orientation-',
        'product-shape-', 'line-',
    );
}

$cssBruto = is_file($CSS_PATH) ? file_get_contents($CSS_PATH) : '';
$cssBytes = strlen($cssBruto);
$cssLimpo = preg_replace('/\/\*.*?\*\//s', '', $cssBruto);

$classes = array();
if (preg_match_all('/([^{}]+)\{([^{}]*)\}/', $cssLimpo, $m)) {
    foreach ($m[1] as $i => $seletor) {
        $seletor = trim($seletor);
        if ($seletor === '' || $seletor[0] === '@') {
            continue;
        }
        if (preg_match_all('/\.([a-zA-Z][a-zA-Z0-9_-]*)/', $seletor, $achadas)) {
            foreach (array_unique($achadas[1]) as $classe) {
                if (!isset($classes[$classe])) {
                    $classes[$classe] = 0;
                }
                $classes[$classe]++;
            }
        }
    }
}
ksort($classes);

$blobFontes = '';
foreach (array('*.html', '*.js', '*.php', 'content/*.json', 'content/products/*.json') as $padrao) {
    foreach (glob($RAIZ . '/' . $padrao) as $f) {
        if (basename($f) === 'modulos.php') {
            continue;
        }
        $blobFontes .= (string)@file_get_contents($f) . "\n";
    }
}

$orfas = array();
$dinamicas = 0;
foreach ($classes as $classe => $n) {
    $eDinamica = false;
    foreach (mod_prefixos_dinamicos() as $pref) {
        if (strpos($classe, $pref) === 0) {
            $eDinamica = true;
            break;
        }
    }
    if ($eDinamica) {
        $dinamicas++;
        continue;
    }
    if (!preg_match('/(?<![A-Za-z0-9_-])' . preg_quote($classe, '/') . '(?![A-Za-z0-9_-])/', $blobFontes)) {
        $orfas[] = $classe;
    }
}
?>
<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<script>(function(){try{var t=window.localStorage.getItem("miaandpaperTheme");if(t==="dark"){document.documentElement.setAttribute("data-theme","dark");}}catch(e){}}());</script>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Módulos · Mia &amp; Paper admin</title>
<link rel="icon" href="content/brand/logo.webp" type="image/webp">
<link rel="stylesheet" href="admin-nav.css?v=2026073101">
<script src="admin-nav.js?v=2026073101" defer></script>
<style>
/* Prefixo md- — esta página não carrega o styles.css do site, de propósito.
   O CSS do site vive dentro dos iframes, onde não pode contaminar nada
   nem ser contaminado. Foi o erro da V1: as amostras eram desenhadas na
   própria página e as classes `position: fixed` fugiam por todo o lado. */
:root { --md-papel: #fff8df; --md-cartao: #fffdf5; --md-tinta: #2e2413; --md-suave: #7f6b42; --md-linha: rgba(0,0,0,0.11); }
:root[data-theme="dark"] { --md-papel: #15110a; --md-cartao: #221a0f; --md-tinta: #f3e6c4; --md-suave: #b89e6e; --md-linha: rgba(216,192,138,0.22); }
* { box-sizing: border-box; }
body { margin: 0; font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif;
  background: var(--md-papel); color: var(--md-tinta); }
.md-page { max-width: 1320px; margin: 0 auto; padding: 20px 18px 90px; }
h1 { font-size: 1.5rem; margin: 0 0 6px; }
.md-intro { color: var(--md-suave); font-size: 0.9rem; margin: 0 0 16px; max-width: 78ch; }
.md-stats { display: flex; flex-wrap: wrap; gap: 9px; margin: 0 0 18px; padding: 0; list-style: none; }
.md-stats li { background: var(--md-cartao); border: 1px solid var(--md-linha); border-radius: 10px; padding: 7px 12px; font-size: 0.8rem; }
.md-stats strong { display: block; font-size: 1.1rem; }

.md-controlos { position: sticky; top: 0; z-index: 20; display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
  background: var(--md-papel); padding: 10px 0; border-bottom: 1px solid var(--md-linha); margin-bottom: 16px; }
.md-controlos input[type="search"] { flex: 1 1 220px; min-width: 170px; padding: 7px 10px; border-radius: 8px;
  border: 1px solid var(--md-linha); font: inherit; background: var(--md-cartao); color: inherit; }
.md-controlos label { font-size: 0.82rem; display: inline-flex; gap: 5px; align-items: center; cursor: pointer; white-space: nowrap; }
.md-controlos select { font: inherit; font-size: 0.82rem; padding: 6px 8px; border-radius: 8px;
  border: 1px solid var(--md-linha); background: var(--md-cartao); color: inherit; }

.md-indice { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 24px; }
.md-indice a { font-size: 0.75rem; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--md-linha);
  text-decoration: none; color: inherit; background: var(--md-cartao); }

.md-modulo { margin: 0 0 34px; scroll-margin-top: 62px; }
.md-modulo h2 { font-size: 1.08rem; margin: 0 0 3px; }
.md-modulo h2 code { font-size: 0.88rem; background: var(--md-cartao); border: 1px solid var(--md-linha);
  padding: 1px 7px; border-radius: 6px; }
.md-modulo-desc { color: var(--md-suave); font-size: 0.85rem; margin: 0 0 12px; max-width: 78ch; }

.md-exemplo { border: 1px solid var(--md-linha); border-radius: 12px; background: var(--md-cartao);
  overflow: hidden; margin: 0 0 14px; }
.md-exemplo-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline;
  padding: 9px 13px; border-bottom: 1px solid var(--md-linha); font-size: 0.83rem; }
.md-exemplo-head strong { font-size: 0.9rem; }
.md-exemplo-head .md-passo { color: var(--md-suave); }
.md-exemplo-head a { margin-left: auto; font-size: 0.78rem; color: inherit; opacity: 0.7; }

.md-temas { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--md-linha); }
body.md-um-tema .md-temas { grid-template-columns: 1fr; }
body.md-um-tema .md-tema--escuro { display: none; }
.md-tema { position: relative; background: var(--md-papel); }
.md-tema--escuro { background: #15110a; }
.md-tema::before { content: attr(data-tema); position: absolute; top: 4px; left: 7px; z-index: 2;
  font-size: 0.58rem; letter-spacing: 0.09em; text-transform: uppercase; opacity: 0.4; pointer-events: none; }
.md-tema iframe { display: block; width: 100%; border: 0; height: 220px; transition: height 0.18s ease; }
.md-tema--aguarda { min-height: 130px; display: grid; place-items: center; }
.md-tema--aguarda::after { content: "a desenhar…"; font-size: 0.76rem; opacity: 0.45; }

.md-mais { font: inherit; font-size: 0.8rem; padding: 6px 12px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--md-linha); background: var(--md-cartao); color: inherit; }

/* ── Paleta ─────────────────────────────────────────────────────────── */
.md-paleta { background: var(--md-cartao); border: 1px solid var(--md-linha); border-radius: 12px;
  padding: 11px 14px; margin: 0 0 20px; }
.md-paleta > summary { cursor: pointer; font-weight: 600; font-size: 0.9rem; }
.md-paleta-corpo { margin-top: 12px; }
.md-paleta-nota { font-size: 0.82rem; color: var(--md-suave); margin: 0 0 12px; max-width: 76ch; }
.md-paleta-nota strong { color: var(--md-tinta); }
.md-paleta-tabela { border-collapse: collapse; font-size: 0.82rem; }
.md-paleta-tabela th { text-align: left; font-size: 0.7rem; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--md-suave); padding: 0 12px 5px 0; font-weight: 600; }
.md-paleta-tabela td { padding: 3px 12px 3px 0; vertical-align: middle; }
.md-paleta-tabela input[type="color"] { width: 34px; height: 24px; padding: 0; border: 1px solid var(--md-linha);
  border-radius: 5px; background: none; cursor: pointer; vertical-align: middle; }
.md-hex { font-size: 0.72rem; color: var(--md-suave); margin-left: 5px; }
.md-paleta-uso { font-size: 0.72rem; color: var(--md-suave); }
.md-paleta-grupo td { padding-top: 14px; font-size: 0.74rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em; color: var(--md-tinta); }
.md-paleta-grupo span { font-weight: 400; text-transform: none; letter-spacing: 0;
  color: var(--md-suave); margin-left: 6px; }
.md-paleta-accoes { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin-top: 12px; font-size: 0.82rem; }
.md-paleta-accoes button { font: inherit; font-size: 0.82rem; padding: 6px 12px; border-radius: 8px;
  border: 1px solid var(--md-linha); background: var(--md-papel); color: inherit; cursor: pointer; }
.md-paleta.md-mexida > summary::after { content: " · alterada (não gravada)"; color: #9a4a2c; font-weight: 400; }

/* Chips dos tokens que cada módulo usa mesmo. */
.md-usados { display: flex; flex-wrap: wrap; gap: 5px; padding: 7px 13px; border-bottom: 1px solid var(--md-linha); }
.md-usados button { display: inline-flex; align-items: center; gap: 5px; font: inherit; font-size: 0.7rem;
  padding: 2px 7px 2px 3px; border-radius: 999px; border: 1px solid var(--md-linha);
  background: var(--md-papel); color: inherit; cursor: pointer; }
.md-usados i { width: 11px; height: 11px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.2); display: block; }
.md-usados button.is-alvo { outline: 2px solid var(--md-suave); outline-offset: 1px; }

.md-classes { margin: 40px 0 0; border-top: 1px solid var(--md-linha); padding-top: 20px; }
.md-classes summary { cursor: pointer; font-weight: 600; }
.md-classes-corpo { margin-top: 12px; font-size: 0.85rem; color: var(--md-suave); }
.md-orfas { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
.md-orfas code { background: var(--md-cartao); border: 1px solid var(--md-linha); padding: 2px 7px;
  border-radius: 5px; font-size: 0.78rem; color: var(--md-tinta); }
.md-nada { padding: 30px; text-align: center; color: var(--md-suave); }
[hidden] { display: none !important; }
@media (max-width: 720px) { .md-temas { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="md-page">

  <header>
    <h1>Módulos de interface</h1>
    <p class="md-intro">
      Cada módulo desenhado pelo próprio <code>app.js</code>, com os dados reais
      dos produtos, em claro e escuro lado a lado. Descobertos a ler
      <code>content/products/*.json</code> e agrupados pelo <code>template</code>
      de cada passo — passo novo ou produto novo aparecem aqui sozinhos.
    </p>
    <p class="md-intro">
      Para experimentar sem risco nenhum, há o
      <a href="modulos-temp.html"><strong>sandbox</strong></a>: uma cópia estática
      desta página, com o CSS e a marcação dentro do próprio ficheiro. Mexe-se à
      vontade e o site não dá por nada. Esta página é a que está sempre certa;
      a outra é a que se pode partir.
    </p>
    <ul class="md-stats">
      <li><strong><?= count($modulos) ?></strong>módulos</li>
      <li><strong><?= $totalExemplos ?></strong>exemplos reais</li>
      <li><strong><?= count($classes) ?></strong>classes no CSS</li>
      <li><strong><?= count($orfas) ?></strong>classes sem uso</li>
    </ul>
  </header>

  <div class="md-controlos">
    <input type="search" id="mdBusca" placeholder="Procurar módulo ou produto…" autocomplete="off">
    <label><input type="checkbox" id="mdUmTema"> só o tema claro</label>
    <label>largura
      <select id="mdLargura">
        <option value="">automática</option>
        <option value="390">390 (telemóvel)</option>
        <option value="540">540</option>
        <option value="768">768 (tablet)</option>
        <option value="1024">1024</option>
      </select>
    </label>
    <label><input type="checkbox" id="mdTema"> página em escuro</label>
  </div>

  <?php
    // `rgba(...)` não entra num <input type="color">; guarda-se o original
    // para o "repor" e mostra-se o hex aproximado no selector.
    function mod_hex_para_input($valor)
    {
        if (preg_match('/^#([0-9a-f]{6})/i', $valor, $m)) {
            return '#' . strtolower($m[1]);
        }
        if (preg_match('/^#([0-9a-f]{3})$/i', $valor, $m)) {
            $c = strtolower($m[1]);
            return '#' . $c[0] . $c[0] . $c[1] . $c[1] . $c[2] . $c[2];
        }
        if (preg_match('/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i', $valor, $m)) {
            return sprintf('#%02x%02x%02x', (int)$m[1], (int)$m[2], (int)$m[3]);
        }
        return '#000000';
    }
    $totalTokens = count($temaClaro) + count($uiClaro) + count($outrosClaro);
  ?>
  <details class="md-paleta" id="mdPaleta">
    <summary>Paleta — experimentar cores (<?= $totalTokens ?> tokens)</summary>
    <div class="md-paleta-corpo">
      <p class="md-paleta-nota">
        Mexer aqui muda só o que está no ecrã, neste separador. <strong>Não grava
        nada</strong> — nem no <code>content/home.json</code>, nem no CSS, nem no
        site. Fechar a página desfaz tudo.
        Para mudar a paleta a sério, é no <a href="produtos.html">painel de produtos</a>.
      </p>
      <p class="md-paleta-nota">
        São <strong>duas camadas</strong>. A paleta da marca é a que se edita no
        admin; a camada <code>--ui-*</code> é a que os componentes usam mesmo, e
        tem valores próprios que <em>não</em> derivam da primeira. É por isso que
        mudar <code>--card</code> não muda o fundo dos cartões — quem manda aí é
        <code>--ui-card</code>.
      </p>
      <table class="md-paleta-tabela">
        <thead><tr><th>token</th><th>claro</th><th>escuro</th><th>usado por</th></tr></thead>
        <tbody>
        <?php foreach ($grupos as $grupo): ?>
          <tr class="md-paleta-grupo">
            <td colspan="4"><?= mod_h($grupo['titulo']) ?> <span><?= mod_h($grupo['nota']) ?></span></td>
          </tr>
          <?php foreach ($grupo['claro'] as $token => $valorClaro): ?>
            <?php $valorEscuro = isset($grupo['escuro'][$token]) ? $grupo['escuro'][$token] : $valorClaro; ?>
            <tr data-token="<?= mod_h($token) ?>">
              <td><code><?= mod_h($token) ?></code></td>
              <td>
                <input type="color" data-tema="claro" data-token="<?= mod_h($token) ?>"
                       value="<?= mod_h(mod_hex_para_input($valorClaro)) ?>"
                       data-inicial="<?= mod_h(mod_hex_para_input($valorClaro)) ?>"
                       data-original="<?= mod_h($valorClaro) ?>">
                <code class="md-hex"><?= mod_h($valorClaro) ?></code>
              </td>
              <td>
                <input type="color" data-tema="escuro" data-token="<?= mod_h($token) ?>"
                       value="<?= mod_h(mod_hex_para_input($valorEscuro)) ?>"
                       data-inicial="<?= mod_h(mod_hex_para_input($valorEscuro)) ?>"
                       data-original="<?= mod_h($valorEscuro) ?>">
                <code class="md-hex"><?= mod_h($valorEscuro) ?></code>
              </td>
              <td class="md-paleta-uso" data-uso="<?= mod_h($token) ?>"></td>
            </tr>
          <?php endforeach; ?>
        <?php endforeach; ?>
        </tbody>
      </table>
      <div class="md-paleta-accoes">
        <button type="button" id="mdReporCores">Repor as cores do site</button>
        <label><input type="checkbox" id="mdSoUsados"> mostrar só os tokens usados pelos módulos visíveis</label>
      </div>
    </div>
  </details>

  <nav class="md-indice" aria-label="Índice de módulos">
    <?php foreach ($modulos as $template => $usos): ?>
      <a href="#mod-<?= mod_h($template) ?>"><?= mod_h($template) ?> <span><?= count($usos) ?></span></a>
    <?php endforeach; ?>
  </nav>

  <?php foreach ($modulos as $template => $usos): ?>
    <?php $descricao = mod_descricao_template($template); ?>
    <section class="md-modulo" id="mod-<?= mod_h($template) ?>" data-modulo="<?= mod_h(strtolower($template)) ?>">
      <h2><code><?= mod_h($template) ?></code></h2>
      <?php if ($descricao !== ''): ?>
        <p class="md-modulo-desc"><?= mod_h($descricao) ?> · <?= count($usos) ?> <?= count($usos) === 1 ? 'utilização' : 'utilizações' ?></p>
      <?php else: ?>
        <p class="md-modulo-desc"><?= count($usos) ?> <?= count($usos) === 1 ? 'utilização' : 'utilizações' ?></p>
      <?php endif; ?>

      <?php foreach ($usos as $i => $uso): ?>
        <?php
          $id = $template . '-' . $uso['slug'] . '-' . $uso['passo'];
          $src = 'modulos-preview.html?product=' . rawurlencode($uso['slug']) . '&step=' . (int)$uso['passo'];
          $escondido = $i >= 2;
        ?>
        <article class="md-exemplo"
                 data-busca="<?= mod_h(strtolower($template . ' ' . $uso['slug'] . ' ' . $uso['produto'] . ' ' . $uso['titulo'])) ?>"
                 <?= $escondido ? 'data-extra="1" hidden' : '' ?>>
          <div class="md-exemplo-head">
            <strong><?= mod_h($uso['produto']) ?></strong>
            <span class="md-passo">passo <?= (int)$uso['passo'] + 1 ?> · <?= mod_h($uso['passoId']) ?><?= $uso['titulo'] !== '' ? ' · ' . mod_h($uso['titulo']) : '' ?></span>
            <a href="<?= mod_h($uso['slug']) ?>.html" target="_blank" rel="noopener">abrir no site ↗</a>
          </div>
          <div class="md-usados" data-usados hidden></div>
          <div class="md-temas">
            <div class="md-tema md-tema--aguarda" data-tema="claro" data-src="<?= mod_h($src) ?>&amp;theme=light&amp;id=<?= mod_h($id) ?>-l" data-id="<?= mod_h($id) ?>-l"></div>
            <div class="md-tema md-tema--escuro md-tema--aguarda" data-tema="escuro" data-src="<?= mod_h($src) ?>&amp;theme=dark&amp;id=<?= mod_h($id) ?>-d" data-id="<?= mod_h($id) ?>-d"></div>
          </div>
        </article>
      <?php endforeach; ?>

      <?php if (count($usos) > 2): ?>
        <button type="button" class="md-mais" data-mais>Ver os outros <?= count($usos) - 2 ?> exemplos</button>
      <?php endif; ?>
    </section>
  <?php endforeach; ?>

  <p class="md-nada" id="mdNada" hidden>Nada corresponde a esta procura.</p>

  <details class="md-classes">
    <summary>Inventário de classes do CSS (<?= count($classes) ?> classes, <?= count($orfas) ?> sem uso)</summary>
    <div class="md-classes-corpo">
      <p>
        <?= number_format($cssBytes / 1024, 0, ',', ' ') ?> KB de CSS ·
        <?= count($classes) ?> classes ·
        <?= count($classes) - count($orfas) - $dinamicas ?> em uso ·
        <?= $dinamicas ?> montadas em código ·
        <?= count($orfas) ?> sem referência encontrada.
      </p>
      <p>
        Estas não aparecem em nenhum HTML, JS, PHP ou JSON de conteúdo. Podem
        ser código morto — ou algo à espera de ser ligado. Convém confirmar uma
        a uma antes de apagar.
      </p>
      <div class="md-orfas">
        <?php foreach ($orfas as $classe): ?><code>.<?= mod_h($classe) ?></code><?php endforeach; ?>
      </div>
    </div>
  </details>
</div>

<script>
(function () {
  "use strict";

  var busca = document.getElementById("mdBusca");
  var umTema = document.getElementById("mdUmTema");
  var tema = document.getElementById("mdTema");
  var largura = document.getElementById("mdLargura");
  var nada = document.getElementById("mdNada");

  /* ── Desenho preguiçoso ────────────────────────────────────────────────
     Cada exemplo são dois iframes, e cada iframe carrega o app.js (828 KB).
     Criá-los todos de uma vez punha o browser de joelhos. Só se criam
     quando entram no ecrã. */
  var observador = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (entrada) {
      if (!entrada.isIntersecting) { return; }
      criar(entrada.target);
      observador.unobserve(entrada.target);
    });
  }, { rootMargin: "400px 0px" });

  function criar(caixa) {
    if (caixa.dataset.pronto) { return; }
    caixa.dataset.pronto = "1";
    var iframe = document.createElement("iframe");
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("title", "Pré-visualização do módulo");
    iframe.src = caixa.dataset.src;
    caixa.classList.remove("md-tema--aguarda");
    caixa.appendChild(iframe);
    aplicarLargura(iframe);
  }

  function observarVisiveis() {
    [].forEach.call(document.querySelectorAll(".md-tema:not([data-pronto])"), function (caixa) {
      if (caixa.closest("[hidden]")) { return; }
      observador.observe(caixa);
    });
    arrancarPrimeiros();
  }

  /* O observador só dispara quando há composição — num separador em segundo
     plano, ou com a janela escondida, pode nunca disparar e a página ficava
     vazia. Estes primeiros são criados de qualquer maneira. */
  function arrancarPrimeiros() {
    var porFazer = [].filter.call(
      document.querySelectorAll(".md-tema:not([data-pronto])"),
      function (caixa) { return !caixa.closest("[hidden]"); }
    );
    porFazer.slice(0, 6).forEach(criar);
  }

  /* ── Altura: cada iframe diz a sua ───────────────────────────────────
     Nada de folga somada à altura recebida. A versão anterior somava 4 px,
     e como o iframe media o documento (que herda a altura do iframe), cada
     ronda crescia mais 4 px — os módulos iam-se esticando até taparem a
     página. O iframe passou a medir só o conteúdo; aqui aplica-se o valor
     tal e qual. */
  window.addEventListener("message", function (evento) {
    if (evento.origin !== window.location.origin) { return; }
    var dados = evento.data || {};
    if (dados.type !== "mia-modulo-altura" || !dados.id) { return; }

    var caixa = document.querySelector('[data-id="' + String(dados.id).replace(/"/g, "") + '"]');
    var iframe = caixa && caixa.querySelector("iframe");
    if (!iframe) { return; }

    // Os tokens vêm junto com a primeira medição.
    if (dados.tokens && !caixa.classList.contains("md-tema--escuro")) {
      mostrarUsados(caixa, dados.tokens);
    }
    if (dados.primeira) { enviarPaleta(iframe, caixa.classList.contains("md-tema--escuro")); }

    var altura = Math.max(90, Math.min(1600, Number(dados.altura) || 0));
    var actual = parseFloat(iframe.style.height) || 0;

    if (Math.abs(altura - actual) < 2) { return; }

    /* Guarda contra o ciclo antigo, sem impedir ajustes legítimos.
       O que estava avariado era um crescimento monótono — cada ronda um
       pouco mais alto, sem nunca encolher. Encolher, ou alternar, é normal
       (a coluna mudou de largura, uma imagem carregou). Só se corta quando
       são muitos aumentos seguidos sem uma única redução. */
    if (altura > actual) {
      caixa.dataset.subidas = String((Number(caixa.dataset.subidas) || 0) + 1);
    } else {
      caixa.dataset.subidas = "0";
    }

    if (Number(caixa.dataset.subidas) > 10) {
      if (!caixa.dataset.avisado) {
        caixa.dataset.avisado = "1";
        console.warn("modulos: altura a crescer sem parar em", dados.id, "— fixada em", actual + "px");
      }
      return;
    }

    iframe.style.height = altura + "px";
  });

  /* ── Largura de ecrã simulada ──────────────────────────────────────── */
  function aplicarLargura(iframe) {
    var v = largura.value;
    if (!v) {
      iframe.style.width = "100%";
      iframe.style.transform = "";
      iframe.style.transformOrigin = "";
      return;
    }
    // Largura fixa e encolhida para caber na coluna, para se ver o layout
    // real dessa largura sem obrigar a coluna a crescer.
    var coluna = iframe.parentElement.clientWidth;
    var escala = Math.min(1, coluna / Number(v));
    iframe.style.width = v + "px";
    iframe.style.transformOrigin = "top left";
    iframe.style.transform = "scale(" + escala.toFixed(3) + ")";
  }

  largura.addEventListener("change", function () {
    [].forEach.call(document.querySelectorAll(".md-tema iframe"), aplicarLargura);
  });

  /* ── Filtro ───────────────────────────────────────────────────────── */
  function filtrar() {
    var termo = busca.value.trim().toLowerCase();
    var visiveis = 0;

    [].forEach.call(document.querySelectorAll(".md-modulo"), function (seccao) {
      var aqui = 0;
      [].forEach.call(seccao.querySelectorAll(".md-exemplo"), function (ex) {
        var bate = !termo || ex.dataset.busca.indexOf(termo) !== -1;
        // Com procura activa mostram-se todos; sem ela volta a haver "ver mais".
        var extra = ex.dataset.extra === "1";
        ex.hidden = !bate || (!termo && extra && !seccao.dataset.expandido);
        if (bate) { aqui++; }
      });
      var botao = seccao.querySelector("[data-mais]");
      if (botao) { botao.hidden = !!termo || !!seccao.dataset.expandido; }
      seccao.hidden = aqui === 0;
      visiveis += aqui;
    });

    nada.hidden = visiveis > 0;
    observarVisiveis();
  }

  busca.addEventListener("input", filtrar);

  [].forEach.call(document.querySelectorAll("[data-mais]"), function (botao) {
    botao.addEventListener("click", function () {
      var seccao = botao.closest(".md-modulo");
      seccao.dataset.expandido = "1";
      botao.hidden = true;
      filtrar();
    });
  });

  umTema.addEventListener("change", function () {
    document.body.classList.toggle("md-um-tema", umTema.checked);
    observarVisiveis();
  });

  tema.checked = document.documentElement.getAttribute("data-theme") === "dark";
  tema.addEventListener("change", function () {
    document.documentElement.setAttribute("data-theme", tema.checked ? "dark" : "light");
    try { window.localStorage.setItem("miaandpaperTheme", tema.checked ? "dark" : "light"); } catch (e) {}
  });

  /* ── Paleta ───────────────────────────────────────────────────────────
     Mudar uma cor manda o valor para dentro de cada iframe, que o aplica
     como custom property. Nada sai daqui: não há pedido ao servidor, não há
     escrita em ficheiro nenhum, e recarregar a página repõe tudo. */
  var paletaCaixa = document.getElementById("mdPaleta");
  var inputsCor = [].slice.call(paletaCaixa.querySelectorAll('input[type="color"]'));
  var usoPorToken = {};   // token -> nº de iframes que o usam

  function paletaActual(tema) {
    var valores = {};
    inputsCor.forEach(function (input) {
      if (input.dataset.tema !== tema) { return; }
      // Um token intocado devolve o valor ORIGINAL do CSS, que pode ser
      // `rgba(...)` com transparência. O <input type="color"> só sabe hex,
      // por isso usá-lo aqui faria os fundos translúcidos ficarem opacos só
      // por se ter aberto o painel.
      valores[input.dataset.token] = (input.value === input.dataset.inicial)
        ? input.dataset.original
        : input.value;
    });
    return valores;
  }

  function enviarPaleta(iframe, escuro) {
    if (!iframe || !iframe.contentWindow) { return; }
    iframe.contentWindow.postMessage({
      type: "mia-modulo-paleta",
      valores: paletaActual(escuro ? "escuro" : "claro")
    }, window.location.origin);
  }

  function difundirPaleta() {
    [].forEach.call(document.querySelectorAll(".md-tema"), function (caixa) {
      enviarPaleta(caixa.querySelector("iframe"), caixa.classList.contains("md-tema--escuro"));
    });
    var mexida = inputsCor.some(function (i) { return i.value !== i.dataset.inicial; });
    paletaCaixa.classList.toggle("md-mexida", mexida);
  }

  inputsCor.forEach(function (input) {
    input.addEventListener("input", function () {
      var hex = input.parentElement.querySelector(".md-hex");
      if (hex) { hex.textContent = input.value; }
      difundirPaleta();
    });
  });

  document.getElementById("mdReporCores").addEventListener("click", function () {
    inputsCor.forEach(function (input) {
      input.value = input.dataset.inicial;
      var hex = input.parentElement.querySelector(".md-hex");
      if (hex) { hex.textContent = input.dataset.original; }
    });
    difundirPaleta();
  });

  document.getElementById("mdSoUsados").addEventListener("change", function (e) {
    [].forEach.call(paletaCaixa.querySelectorAll("tbody tr"), function (linha) {
      linha.hidden = e.target.checked && !usoPorToken[linha.dataset.token];
    });
  });

  /* Chips: quais os tokens que este módulo usa mesmo. A conta é feita dentro
     do iframe, a comparar as cores computadas de cada elemento com os valores
     dos tokens — não é adivinhado a partir do nome das classes. */
  function mostrarUsados(caixa, tokens) {
    var exemplo = caixa.closest(".md-exemplo");
    var alvo = exemplo && exemplo.querySelector("[data-usados]");
    if (!alvo || alvo.dataset.feito) { return; }
    alvo.dataset.feito = "1";

    tokens.forEach(function (token) {
      usoPorToken[token] = (usoPorToken[token] || 0) + 1;
      var input = paletaCaixa.querySelector('input[data-tema="claro"][data-token="' + token + '"]');
      var chip = document.createElement("button");
      chip.type = "button";
      chip.innerHTML = '<i style="background:' + (input ? input.value : "transparent") + '"></i>'
        + token.replace(/^--/, "");
      chip.addEventListener("click", function () {
        paletaCaixa.open = true;
        var linha = paletaCaixa.querySelector('tr[data-token="' + token + '"]');
        if (linha) {
          linha.scrollIntoView({ block: "center", behavior: "smooth" });
          [].forEach.call(document.querySelectorAll(".md-usados button"), function (b) {
            b.classList.remove("is-alvo");
          });
          chip.classList.add("is-alvo");
          var i = linha.querySelector('input[type="color"]');
          if (i) { i.focus(); }
        }
      });
      alvo.appendChild(chip);
    });

    alvo.hidden = tokens.length === 0;
    // Actualiza a coluna "usado por" da tabela.
    Object.keys(usoPorToken).forEach(function (token) {
      var celula = paletaCaixa.querySelector('[data-uso="' + token + '"]');
      if (celula) { celula.textContent = usoPorToken[token] + "×"; }
    });
  }

  observarVisiveis();
}());
</script>
</body>
</html>
<?php mp_snapshot_end(); ?>
