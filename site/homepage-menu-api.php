<?php
// HOMEPAGE_MENU_API_V1
// Backend do editor do menu e da homepage (homepage-menu-design.php).
//
// Mexe num ficheiro só — content/home.json — que é de onde saem tanto a
// homepage como o menu do hamburguer. Como no precos-api.php: nada se escreve
// sem passar pela validação, a gravação é atómica e verificada, e a revisão
// SHA-256 apanha edições concorrentes.

declare(strict_types=0);

// ADMIN_OPEN_DEV_V1 é a única configuração: em desenvolvimento pode abrir os
// editores; com MIA_ADMIN_OPEN=false esta API exige sempre sessão de admin.
require_once __DIR__ . '/admin-open.php';
define('HOMEPAGE_REQUIRE_ADMIN', !MIA_ADMIN_OPEN);

// HOME_CORE_V1: a leitura e a escrita do home.json vivem na lib, partilhadas
// com o carrousel-api.php. Dois editores no mesmo ficheiro com duas cópias da
// escrita atómica era o caminho certo para uma delas ficar para trás.
require_once __DIR__ . '/lib/home-core.php';
require_once __DIR__ . '/lib/pedido.php';   // COMANDOS_V1: a API tambem se chama de dentro

const HOMEPAGE_FILE = HOME_FILE;

// Campos de uma categoria que este editor deixa mexer. `id` e `href` ficam de
// fora: sao a identidade e o destino, e mexer neles parte links guardados.
const HOMEPAGE_CAMPOS_TEXTO = array('title', 'menuTitle', 'subtitle', 'menuGroup', 'actionText', 'image', 'menuHref', 'menuIcon', 'featureLabel');
const HOMEPAGE_CAMPOS_NUMERO = array('menuOrder', 'menuGroupOrder');
const HOMEPAGE_CAMPOS_BOOL = array('available', 'clickable', 'carouselEnabled', 'menuHidden');

// COMANDOS_V1: em modo embutido quem manda nos cabecalhos e a pagina que
// incluiu esta API.
if (!mp_modo_embutido()) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
}

function hm_responder($payload, $status = 200)
{
    if (mp_modo_embutido()) {
        mp_responder_embutido($payload, $status);
    }
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function hm_erro($mensagem, $status = 400)
{
    if (mp_modo_embutido()) {
        mp_responder_embutido(array('ok' => false, 'erro' => $mensagem), $status);
    }
    hm_responder(array('ok' => false, 'erro' => $mensagem), $status);
}

function hm_exigir_admin()
{
    if (!HOMEPAGE_REQUIRE_ADMIN) {
        return;
    }
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    if (empty($_SESSION['miaandpaper_admin'])) {
        hm_erro('Precisas de sessão de administradora.', 403);
    }
}

function hm_exigir_csrf()
{
    $sent = isset($_SERVER['HTTP_X_ADMIN_CSRF']) ? (string)$_SERVER['HTTP_X_ADMIN_CSRF'] : '';
    if (!mp_admin_csrf_is_valid($sent)) {
        hm_erro('Pedido bloqueado por CSRF. Recarrega o editor.', 403);
    }
}

function hm_ler()
{
    list($data, $raw, $erro) = home_ler();
    if ($erro !== '') {
        hm_erro($erro, 500);
    }
    return array($data, $raw);
}

// Escrita atómica e verificada: vive toda na lib partilhada.
function hm_gravar($data, $revisaoEsperada)
{
    return home_gravar($data, $revisaoEsperada, '.homepage-bak');
}

// ── Leitura ──────────────────────────────────────────────────────────────────

// Os icones sao os PNG que existem na pasta. Um ficheiro novo aparece
// sozinho no selector, sem se tocar em codigo.
function hm_icones_disponiveis()
{
    $nomes = array();
    foreach ((array)glob(__DIR__ . '/content/brand/menu-icons/line-art/*.webp') as $f) {
        $nomes[] = basename($f, '.webp');
    }
    sort($nomes);
    return $nomes;
}

function hm_recolher()
{
    list($data, $raw) = hm_ler();

    $categorias = array();
    foreach ((array)(isset($data['categories']) ? $data['categories'] : array()) as $i => $c) {
        $categorias[] = array(
            'indice' => $i,
            'id' => isset($c['id']) ? (string)$c['id'] : '',
            'href' => isset($c['href']) ? (string)$c['href'] : '',
            'title' => isset($c['title']) ? (string)$c['title'] : '',
            'menuTitle' => isset($c['menuTitle']) ? (string)$c['menuTitle'] : '',
            'subtitle' => isset($c['subtitle']) ? (string)$c['subtitle'] : '',
            'actionText' => isset($c['actionText']) ? (string)$c['actionText'] : '',
            'image' => isset($c['image']) ? (string)$c['image'] : '',
            'menuGroup' => isset($c['menuGroup']) ? (string)$c['menuGroup'] : '',
            'menuGroupOrder' => isset($c['menuGroupOrder']) ? (int)$c['menuGroupOrder'] : 0,
            'menuOrder' => isset($c['menuOrder']) ? (int)$c['menuOrder'] : 0,
            'menuHref' => isset($c['menuHref']) ? (string)$c['menuHref'] : '',
            'menuIcon' => isset($c['menuIcon']) ? (string)$c['menuIcon'] : '',
            'section' => isset($c['section']) ? (string)$c['section'] : '',
            'featureLabel' => isset($c['featureLabel']) ? (string)$c['featureLabel'] : '',
            'available' => !empty($c['available']),
            'clickable' => !isset($c['clickable']) || !empty($c['clickable']),
            'carouselEnabled' => !empty($c['carouselEnabled']),
            'menuHidden' => !empty($c['menuHidden']),
            'livre' => !empty($c['freeCard']),
        );
    }

    return array(
        'ok' => true,
        'revisao' => hash('sha256', $raw),
        'csrf' => mp_admin_csrf_token(),
        'categorias' => $categorias,
        'seccoes' => hm_seccoes($data),
        'menuAccordion' => !empty($data['menuAccordion']),
        'menuShowIcons' => !isset($data['menuShowIcons']) || !empty($data['menuShowIcons']),
        'iconesDisponiveis' => hm_icones_disponiveis(),
        'aberto' => !HOMEPAGE_REQUIRE_ADMIN,
    );
}

// ── Gravação ─────────────────────────────────────────────────────────────────

// SECCOES_HOMEPAGE_V1: as secções da homepage são dados. Um ficheiro sem
// `homeSections` — a cápsula do congresso — dá as duas de sempre, montadas a
// partir do `news` e do `productsIntro`. Tem de dar o mesmo que
// `homeSectionList()` em js/09-admin-paineis.js.
function hm_seccoes($data)
{
    $lista = isset($data['homeSections']) && is_array($data['homeSections']) ? $data['homeSections'] : array();
    $seccoes = array();

    foreach ($lista as $s) {
        if (!is_array($s) || !isset($s['id']) || trim((string)$s['id']) === '') {
            continue;
        }
        $seccoes[] = array(
            'id' => (string)$s['id'],
            'layout' => (isset($s['layout']) && (string)$s['layout'] === 'feature') ? 'feature' : 'grid',
            'maxCards' => max(1, min(12, isset($s['maxCards']) ? (int)$s['maxCards'] : 3)),
            'repeatInGrid' => !empty($s['repeatInGrid']),
            'eyebrow' => isset($s['eyebrow']) ? (string)$s['eyebrow'] : '',
            'title' => isset($s['title']) ? (string)$s['title'] : '',
            'text' => isset($s['text']) ? (string)$s['text'] : '',
        );
    }
    if ($seccoes) {
        return $seccoes;
    }

    $news = isset($data['news']) && is_array($data['news']) ? $data['news'] : array();
    $produtos = isset($data['productsIntro']) && is_array($data['productsIntro']) ? $data['productsIntro'] : array();
    return array(
        array(
            'id' => 'novidades', 'layout' => 'feature', 'maxCards' => 3, 'repeatInGrid' => true,
            'eyebrow' => isset($news['eyebrow']) ? (string)$news['eyebrow'] : '',
            'title' => isset($news['title']) ? (string)$news['title'] : 'Novidades',
            'text' => isset($news['text']) ? (string)$news['text'] : '',
        ),
        array(
            'id' => 'produtos', 'layout' => 'grid', 'maxCards' => 3, 'repeatInGrid' => false,
            'eyebrow' => isset($produtos['eyebrow']) ? (string)$produtos['eyebrow'] : '',
            'title' => isset($produtos['title']) ? (string)$produtos['title'] : 'Produtos',
            'text' => isset($produtos['text']) ? (string)$produtos['text'] : '',
        ),
    );
}

// Devolve o índice da secção no `homeSections` gravado, materializando o bloco
// se ele ainda não existir (ficheiro por migrar).
function hm_indice_seccao(&$data, $id)
{
    if (!isset($data['homeSections']) || !is_array($data['homeSections']) || !$data['homeSections']) {
        $data['homeSections'] = hm_seccoes($data);
        unset($data['news'], $data['productsIntro']);
    }
    foreach ($data['homeSections'] as $i => $s) {
        if (is_array($s) && isset($s['id']) && (string)$s['id'] === (string)$id) {
            return $i;
        }
    }
    return -1;
}

// A primeira secção em grelha, ou vazio se não houver nenhuma. Distinto de
// `hm_seccao_refugio()`: aqui interessa saber se existe mesmo uma grelha.
function hm_primeira_grelha($seccoes)
{
    foreach ($seccoes as $s) {
        if (!isset($s['layout']) || (string)$s['layout'] !== 'feature') {
            return (string)$s['id'];
        }
    }
    return '';
}

// Para onde vão os cartões órfãos, para nada desaparecer da homepage por se
// ter removido uma secção. Sem grelha nenhuma, serve a primeira secção que
// houver — mas isso é um estado que as guardas não deixam gravar.
function hm_seccao_refugio($seccoes)
{
    $grelha = hm_primeira_grelha($seccoes);

    if ($grelha !== '') {
        return $grelha;
    }
    return $seccoes ? (string)$seccoes[0]['id'] : '';
}

function hm_aplicar()
{
    $body = mp_corpo_pedido();
    if (!is_array($body) || empty($body['alteracoes']) || !is_array($body['alteracoes'])) {
        hm_erro('Não há nada para gravar.');
    }

    list($data, $raw) = hm_ler();
    $revisao = hash('sha256', $raw);

    foreach ($body['alteracoes'] as $a) {
        $op = isset($a['op']) ? (string)$a['op'] : '';

        // Um campo de uma categoria.
        if ($op === 'categoria') {
            $indice = isset($a['indice']) ? (int)$a['indice'] : -1;
            $campo = isset($a['campo']) ? (string)$a['campo'] : '';
            if (!isset($data['categories'][$indice])) {
                hm_erro('Categoria ' . $indice . ' não existe.');
            }
            if (in_array($campo, HOMEPAGE_CAMPOS_TEXTO, true)) {
                $valor = (string)(isset($a['valor']) ? $a['valor'] : '');
                if (strlen($valor) > 400 || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', $valor)) {
                    hm_erro('Texto inválido em ' . $campo . '.');
                }
                $data['categories'][$indice][$campo] = $valor;
            } elseif (in_array($campo, HOMEPAGE_CAMPOS_NUMERO, true)) {
                $n = (int)(isset($a['valor']) ? $a['valor'] : 0);
                if ($n < 0 || $n > 999) {
                    hm_erro('Ordem fora do intervalo.');
                }
                $data['categories'][$indice][$campo] = $n;
            } elseif (in_array($campo, HOMEPAGE_CAMPOS_BOOL, true)) {
                $data['categories'][$indice][$campo] = !empty($a['valor']);
            } else {
                hm_erro('O campo "' . $campo . '" não é editável aqui.');
            }
            continue;
        }

        // Comportamento das secções do menu.
        if ($op === 'menu-accordion') {
            $data['menuAccordion'] = !empty($a['valor']);
            continue;
        }

        // SECCOES_HOMEPAGE_V1: um campo de uma secção da homepage.
        if ($op === 'seccao') {
            $id = isset($a['seccao']) ? (string)$a['seccao'] : '';
            $campo = isset($a['campo']) ? (string)$a['campo'] : '';
            $i = hm_indice_seccao($data, $id);
            if ($i < 0) {
                hm_erro('A secção "' . $id . '" não existe.');
            }
            if (in_array($campo, array('eyebrow', 'title', 'text'), true)) {
                $valor = (string)(isset($a['valor']) ? $a['valor'] : '');
                if (strlen($valor) > 400 || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', $valor)) {
                    hm_erro('Texto inválido em ' . $campo . '.');
                }
                $data['homeSections'][$i][$campo] = $valor;
            } elseif ($campo === 'layout') {
                $data['homeSections'][$i]['layout'] =
                    ((string)(isset($a['valor']) ? $a['valor'] : '') === 'feature') ? 'feature' : 'grid';
            } elseif ($campo === 'maxCards') {
                $data['homeSections'][$i]['maxCards'] = max(1, min(12, (int)(isset($a['valor']) ? $a['valor'] : 3)));
            } elseif ($campo === 'repeatInGrid') {
                $data['homeSections'][$i]['repeatInGrid'] = !empty($a['valor']);
            } else {
                hm_erro('O campo "' . $campo . '" não é editável numa secção.');
            }
            continue;
        }

        if ($op === 'seccao-adicionar') {
            $id = trim((string)(isset($a['seccao']) ? $a['seccao'] : ''));
            if ($id === '' || !preg_match('/^[a-z0-9-]+$/', $id)) {
                hm_erro('Identificador de secção inválido: "' . $id . '".');
            }
            if (hm_indice_seccao($data, $id) >= 0) {
                hm_erro('Já existe uma secção "' . $id . '".');
            }
            $titulo = (string)(isset($a['titulo']) ? $a['titulo'] : $id);
            if (strlen($titulo) > 400) {
                hm_erro('Título de secção demasiado comprido.');
            }
            $data['homeSections'][] = array(
                'id' => $id, 'layout' => 'grid',
                'eyebrow' => '', 'title' => $titulo, 'text' => '',
            );
            continue;
        }

        if ($op === 'seccao-remover') {
            $id = (string)(isset($a['seccao']) ? $a['seccao'] : '');
            if (hm_indice_seccao($data, $id) < 0) {
                hm_erro('A secção "' . $id . '" não existe.');
            }
            $restantes = array();
            foreach ($data['homeSections'] as $s) {
                if ((string)$s['id'] !== $id) {
                    $restantes[] = $s;
                }
            }
            if (hm_primeira_grelha($restantes) === '') {
                hm_erro('Tem de sobrar uma secção em grelha: é para onde vão os cartões das removidas.');
            }
            $data['homeSections'] = $restantes;
            // Os cartões da secção removida passam para a primeira grelha, em
            // vez de ficarem a apontar para uma secção que já não existe.
            $refugio = hm_seccao_refugio($restantes);
            foreach ($data['categories'] as $k => $c) {
                if (isset($c['section']) && (string)$c['section'] === $id) {
                    $data['categories'][$k]['section'] = $refugio;
                }
            }
            continue;
        }

        // ORDEM_VISUAL_V1
        // A homepage desenha os cartões pela ordem do array `categories`
        // (ver renderHome em js/09-admin-paineis.js); o menu ordena pelo
        // `menuOrder` e agrupa pelo `menuGroup` (js/08-menu-site.js). São duas
        // ordens independentes de propósito — arrastar numa não mexe na outra.
        if ($op === 'ordem-homepage') {
            // SECCOES_HOMEPAGE_V1: o editor manda as secções pela ordem em que
            // ficaram e o que está dentro de cada uma. A forma antiga (só uma
            // lista de ids) continua a valer: reordena e não mexe nas secções —
            // é o que o botão "herdar a ordem do menu" faz.
            $porSeccao = isset($a['seccoes']) && is_array($a['seccoes']) ? $a['seccoes'] : null;
            $ids = array();
            $seccaoDe = array();

            if ($porSeccao !== null) {
                hm_indice_seccao($data, '');   // materializa o homeSections
                $ordenadas = array();
                foreach ($porSeccao as $bloco) {
                    $sid = isset($bloco['id']) ? (string)$bloco['id'] : '';
                    $i = hm_indice_seccao($data, $sid);
                    if ($i < 0) {
                        hm_erro('Secção desconhecida na ordem: ' . $sid . '.');
                    }
                    $ordenadas[] = $data['homeSections'][$i];
                    foreach ((isset($bloco['itens']) && is_array($bloco['itens']) ? $bloco['itens'] : array()) as $cid) {
                        $ids[] = (string)$cid;
                        $seccaoDe[(string)$cid] = $sid;
                    }
                }
                if (count($ordenadas) !== count($data['homeSections'])) {
                    hm_erro('A ordem das secções não bate certo com as que existem.');
                }
                if (hm_primeira_grelha($ordenadas) === '') {
                    hm_erro('Tem de haver pelo menos uma secção em grelha.');
                }
                $data['homeSections'] = $ordenadas;
            } else {
                $ids = array_map('strval', isset($a['ids']) && is_array($a['ids']) ? $a['ids'] : array());
            }

            $porId = array();
            foreach ((array)$data['categories'] as $c) {
                if (isset($c['id'])) {
                    $porId[(string)$c['id']] = $c;
                }
            }
            if (count($ids) !== count($porId)) {
                hm_erro('A ordem da homepage não bate certo com as categorias existentes.');
            }
            $nova = array();
            foreach ($ids as $id) {
                if (!isset($porId[$id])) {
                    hm_erro('Categoria desconhecida na ordem: ' . $id . '.');
                }
                $categoria = $porId[$id];
                if (isset($seccaoDe[$id])) {
                    $categoria['section'] = $seccaoDe[$id];
                    unset($categoria['featured']);   // o campo antigo deixa de mandar
                }
                $nova[] = $categoria;
            }
            $data['categories'] = $nova;
            continue;
        }

        if ($op === 'ordem-menu') {
            $grupos = isset($a['grupos']) && is_array($a['grupos']) ? $a['grupos'] : array();
            $destino = array();   // id => array(grupo, ordemGrupo, ordem)
            foreach ($grupos as $iGrupo => $grupo) {
                $nome = isset($grupo['nome']) ? trim((string)$grupo['nome']) : '';
                if ($nome === '') {
                    hm_erro('Um dos grupos do menu ficou sem nome.');
                }
                $itens = isset($grupo['itens']) && is_array($grupo['itens']) ? $grupo['itens'] : array();
                foreach ($itens as $iItem => $id) {
                    $destino[(string)$id] = array($nome, $iGrupo + 1, $iItem + 1);
                }
            }
            foreach ($data['categories'] as $i => $c) {
                $id = isset($c['id']) ? (string)$c['id'] : '';
                if ($id === '' || !isset($destino[$id])) {
                    continue;
                }
                $data['categories'][$i]['menuGroup'] = $destino[$id][0];
                $data['categories'][$i]['menuGroupOrder'] = $destino[$id][1];
                $data['categories'][$i]['menuOrder'] = $destino[$id][2];
            }
            continue;
        }

        // Mostrar ou esconder os ícones no menu do hamburguer.
        if ($op === 'menu-icones') {
            $data['menuShowIcons'] = !empty($a['valor']);
            continue;
        }

        hm_erro('Operação desconhecida: ' . $op . '.');
    }

    $erro = hm_gravar($data, $revisao);
    if ($erro !== '') {
        hm_erro($erro, 409);
    }

    hm_responder(array_merge(array('ok' => true), hm_recolher()));
}

// ── Router ───────────────────────────────────────────────────────────────────

hm_exigir_admin();
// COMANDOS_V1: incluida so pelas funcoes. Sem router, sem guarda, sem resposta.
if (mp_modo_embutido()) {
    return;
}

$action = isset($_GET['action']) ? (string)$_GET['action'] : 'data';

// PARAMETROS_V1: esquema desta API, na forma do manifesto geral.
if ($action === 'parametros') {
    require_once __DIR__ . '/lib/parametros.php';
    hm_responder(array('ok' => true, 'recurso' => mp_parametros_manifesto_recurso('homepage-menu-api.php')));
}

if ($action === 'data') {
    hm_responder(hm_recolher());
}
if ($action === 'save') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        hm_erro('Usa POST para gravar.', 405);
    }
    hm_exigir_csrf();
    hm_aplicar();
}
hm_erro('Acção desconhecida.', 404);
