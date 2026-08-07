<?php
// HOMEPAGE_MENU_API_V1
// Backend do editor do menu e da homepage (homepage-menu-design.php).
//
// Mexe num ficheiro só — content/home.json — que é de onde saem tanto a
// homepage como o menu do hamburguer. Como no precos-api.php: nada se escreve
// sem passar pela validação, a gravação é atómica e verificada, e a revisão
// SHA-256 apanha edições concorrentes.

declare(strict_types=0);

// Aberto até ao deploy, nos mesmos termos da galeria e dos preços.
// ⚠️ ANTES DO DEPLOY pôr a true.
define('HOMEPAGE_REQUIRE_ADMIN', false);

const HOMEPAGE_FILE = __DIR__ . '/content/home.json';

// Campos de uma categoria que este editor deixa mexer. `id` e `href` ficam de
// fora: sao a identidade e o destino, e mexer neles parte links guardados.
const HOMEPAGE_CAMPOS_TEXTO = array('title', 'menuTitle', 'subtitle', 'menuGroup', 'actionText', 'image', 'menuHref', 'menuIcon', 'featureLabel');
const HOMEPAGE_CAMPOS_NUMERO = array('menuOrder', 'menuGroupOrder');
const HOMEPAGE_CAMPOS_BOOL = array('available', 'clickable', 'carouselEnabled', 'menuHidden');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

function hm_responder($payload, $status = 200)
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function hm_erro($mensagem, $status = 400)
{
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

function hm_ler()
{
    $raw = @file_get_contents(HOMEPAGE_FILE);
    if ($raw === false) {
        hm_erro('Não consegui ler o home.json.', 500);
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        hm_erro('O home.json não é JSON válido.', 500);
    }
    return array($data, $raw);
}

function hm_indentacao($raw)
{
    return preg_match('/\n( +)"/', (string)$raw, $m) ? strlen($m[1]) : 2;
}

function hm_reindentar($json, $unidade)
{
    if ($unidade === 4) {
        return $json;
    }
    $linhas = explode("\n", $json);
    foreach ($linhas as $i => $linha) {
        $espacos = strlen($linha) - strlen(ltrim($linha, ' '));
        if ($espacos > 0) {
            $linhas[$i] = str_repeat(' ', intdiv($espacos, 4) * $unidade) . substr($linha, $espacos);
        }
    }
    return implode("\n", $linhas);
}

// Escrita atómica e verificada, igual à do precos-api.php.
function hm_gravar($data, $revisaoEsperada)
{
    $actual = @file_get_contents(HOMEPAGE_FILE);
    if ($actual === false) {
        return 'Não consegui ler o home.json.';
    }
    if ($revisaoEsperada !== '' && !hash_equals(hash('sha256', $actual), $revisaoEsperada)) {
        return 'O home.json mudou noutro separador. Recarrega antes de gravar.';
    }

    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return 'Não consegui serializar o home.json.';
    }
    $json = hm_reindentar($json, hm_indentacao($actual)) . "\n";

    if (@file_put_contents(HOMEPAGE_FILE . '.homepage-bak', $actual, LOCK_EX) === false) {
        return 'Não consegui gravar a cópia de segurança.';
    }

    $tmp = HOMEPAGE_FILE . '.homepage-tmp';
    if (@file_put_contents($tmp, $json, LOCK_EX) !== strlen($json)) {
        @unlink($tmp);
        return 'Não consegui escrever o ficheiro temporário.';
    }
    if (!@rename($tmp, HOMEPAGE_FILE)) {
        @unlink(HOMEPAGE_FILE);
        if (!@rename($tmp, HOMEPAGE_FILE)) {
            @unlink($tmp);
            @file_put_contents(HOMEPAGE_FILE, $actual, LOCK_EX);
            return 'Não consegui substituir o home.json. Repus o original.';
        }
    }

    clearstatcache(true, HOMEPAGE_FILE);
    $confirmacao = @file_get_contents(HOMEPAGE_FILE);
    if ($confirmacao === false || json_decode($confirmacao, true) === null) {
        @file_put_contents(HOMEPAGE_FILE, $actual, LOCK_EX);
        return 'O home.json ficou ilegível depois de gravar. Repus a versão anterior.';
    }

    return '';
}

// ── Leitura ──────────────────────────────────────────────────────────────────

// Os icones sao os PNG que existem na pasta. Um ficheiro novo aparece
// sozinho no selector, sem se tocar em codigo.
function hm_icones_disponiveis()
{
    $nomes = array();
    foreach ((array)glob(__DIR__ . '/content/brand/menu-icons/line-art/*.png') as $f) {
        $nomes[] = basename($f, '.png');
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
            'featured' => !empty($c['featured']),
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
        'categorias' => $categorias,
        'news' => isset($data['news']) ? $data['news'] : array(),
        'productsIntro' => isset($data['productsIntro']) ? $data['productsIntro'] : array(),
        'menuAccordion' => !empty($data['menuAccordion']),
        'menuShowIcons' => !isset($data['menuShowIcons']) || !empty($data['menuShowIcons']),
        'iconesDisponiveis' => hm_icones_disponiveis(),
        'aberto' => !HOMEPAGE_REQUIRE_ADMIN,
    );
}

// ── Gravação ─────────────────────────────────────────────────────────────────

function hm_aplicar()
{
    $body = json_decode((string)file_get_contents('php://input'), true);
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

        // Blocos de texto da homepage.
        if ($op === 'bloco') {
            $bloco = isset($a['bloco']) ? (string)$a['bloco'] : '';
            $campo = isset($a['campo']) ? (string)$a['campo'] : '';
            if (!in_array($bloco, array('news', 'productsIntro'), true)
                || !in_array($campo, array('eyebrow', 'title', 'text'), true)
            ) {
                hm_erro('Bloco ou campo desconhecido.');
            }
            if (!isset($data[$bloco]) || !is_array($data[$bloco])) {
                $data[$bloco] = array();
            }
            $data[$bloco][$campo] = (string)(isset($a['valor']) ? $a['valor'] : '');
            continue;
        }

        // ORDEM_VISUAL_V1
        // A homepage desenha os cartões pela ordem do array `categories`
        // (ver renderHome em js/09-admin-paineis.js); o menu ordena pelo
        // `menuOrder` e agrupa pelo `menuGroup` (js/08-menu-site.js). São duas
        // ordens independentes de propósito — arrastar numa não mexe na outra.
        if ($op === 'ordem-homepage') {
            $ids = isset($a['ids']) && is_array($a['ids']) ? $a['ids'] : array();
            // DESTAQUES_HOMEPAGE_V1: quem esta no cartao "Novidades" fica com
            // `featured`. E a mesma operacao porque arrastar entre os dois
            // cartoes muda as duas coisas ao mesmo tempo: a seccao e a ordem.
            $destaques = isset($a['destaques']) && is_array($a['destaques'])
                ? array_flip(array_map('strval', $a['destaques']))
                : null;
            $porId = array();
            foreach ((array)$data['categories'] as $c) {
                if (isset($c['id'])) {
                    $porId[(string)$c['id']] = $c;
                }
            }
            if (count($ids) !== count($porId)) {
                hm_erro('A ordem da homepage não bate certo com as categorias existentes.');
            }
            if ($destaques !== null && count($destaques) > 3) {
                hm_erro('A secção Novidades mostra no máximo 3 cartões.');
            }
            $nova = array();
            foreach ($ids as $id) {
                $id = (string)$id;
                if (!isset($porId[$id])) {
                    hm_erro('Categoria desconhecida na ordem: ' . $id . '.');
                }
                $categoria = $porId[$id];
                if ($destaques !== null) {
                    if (isset($destaques[$id])) {
                        $categoria['featured'] = true;
                    } else {
                        unset($categoria['featured']);
                    }
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
$action = isset($_GET['action']) ? (string)$_GET['action'] : 'data';

if ($action === 'data') {
    hm_responder(hm_recolher());
}
if ($action === 'save') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        hm_erro('Usa POST para gravar.', 405);
    }
    hm_aplicar();
}
hm_erro('Acção desconhecida.', 404);
