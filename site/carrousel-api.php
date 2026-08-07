<?php
// CARROUSEL_API_V1
// Backend do editor dos carrosséis (carrousel.php).
//
// Escreve no content/home.json, como o homepage-menu-api.php — por isso a
// leitura, a escrita atómica e a normalização dos slides vivem os dois na
// lib/home-core.php. Aqui só ficam as operações.
//
// CAROUSEL_SLIDES_V1: cada imagem de cada carrossel é um slide com os seus
// parâmetros. Um campo a null herda do bloco `carousel` global — é isso que faz
// com que mexer no separador Global chegue a todos os carrosséis de uma vez.

declare(strict_types=0);

// Aberto até ao deploy, nos mesmos termos da galeria, dos preços e do editor da
// homepage. ⚠️ ANTES DO DEPLOY pôr a true.
define('CARROUSEL_REQUIRE_ADMIN', false);

require_once __DIR__ . '/lib/home-core.php';

const CARROUSEL_MAX_SLIDES = 12;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

function cr_responder($payload, $status = 200)
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function cr_erro($mensagem, $status = 400)
{
    cr_responder(array('ok' => false, 'erro' => $mensagem), $status);
}

function cr_exigir_admin()
{
    if (!CARROUSEL_REQUIRE_ADMIN) {
        return;
    }
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    if (empty($_SESSION['miaandpaper_admin'])) {
        cr_erro('Precisas de sessão de administradora.', 403);
    }
}

function cr_ler()
{
    list($data, $raw, $erro) = home_ler();
    if ($erro !== '') {
        cr_erro($erro, 500);
    }
    return array($data, $raw);
}

// ── Imagens ──────────────────────────────────────────────────────────────────

// Todas as imagens que existem em content/. É a lista que alimenta o selector
// de imagem de cada slide: um ficheiro novo aparece aqui sozinho.
function cr_imagens_disponiveis()
{
    $base = realpath(__DIR__ . '/content');
    $encontradas = array();

    if ($base === false) {
        return $encontradas;
    }
    $iterador = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($iterador as $ficheiro) {
        if (!$ficheiro->isFile()) {
            continue;
        }
        $extensao = strtolower($ficheiro->getExtension());
        if (!in_array($extensao, array('webp', 'png', 'jpg', 'jpeg'), true)) {
            continue;
        }
        $encontradas[] = 'content/' . str_replace('\\', '/', substr($ficheiro->getPathname(), strlen($base) + 1));
    }
    sort($encontradas);
    return $encontradas;
}

// Uma imagem só é aceite se existir mesmo dentro de content/. Trava caminhos
// para fora da raiz web e evita gravar slides que dariam 404 no site.
function cr_imagem_valida($caminho)
{
    $caminho = trim((string)$caminho);
    if ($caminho === '' || strpos($caminho, 'content/') !== 0 || strpos($caminho, '..') !== false) {
        return false;
    }
    $alvo = realpath(__DIR__ . '/' . $caminho);
    $base = realpath(__DIR__ . '/content');
    return $alvo !== false && $base !== false && strpos($alvo, $base) === 0 && is_file($alvo);
}

function cr_slug_do_href($href)
{
    $limpo = explode('#', explode('?', (string)$href)[0])[0];
    return preg_match('/([^\/]+)\.html$/i', $limpo, $m) ? $m[1] : '';
}

// As imagens que o produto daria por si. É o que o botão "puxar do produto"
// escreve, e o mesmo que o site fazia sozinho antes do CAROUSEL_SLIDES_V1.
// Tem de dar o mesmo que `homeCarouselImagesFromProduct()` em
// js/03-conteudo-home.js.
function cr_imagens_do_produto($href)
{
    $slug = cr_slug_do_href($href);
    if ($slug === '' || !preg_match('/^[a-z0-9-]+$/', $slug)) {
        return array();
    }
    $caminho = __DIR__ . '/content/products/' . $slug . '.json';
    if (!is_file($caminho)) {
        return array();
    }
    $produto = json_decode((string)file_get_contents($caminho), true);
    if (!is_array($produto)) {
        return array();
    }

    $passos = isset($produto['steps']) && is_array($produto['steps']) ? $produto['steps'] : array();
    $passo = isset($passos[0]) && is_array($passos[0]) ? $passos[0] : array();
    $familia = isset($produto['family']) ? (string)$produto['family'] : (string)(isset($produto['slug']) ? $produto['slug'] : '');
    $soPrimarias = in_array($familia, array('cadernos', 'cadernos-anuais'), true);
    $imagens = array();

    foreach ((isset($passo['items']) && is_array($passo['items']) ? $passo['items'] : array()) as $item) {
        if (!is_array($item)) {
            continue;
        }
        if (!empty($item['image']) && !in_array($item['image'], $imagens, true)) {
            $imagens[] = (string)$item['image'];
        }
        if (!$soPrimarias && isset($item['interiorImages']) && is_array($item['interiorImages'])) {
            foreach ($item['interiorImages'] as $imagem) {
                if ($imagem && !in_array($imagem, $imagens, true)) {
                    $imagens[] = (string)$imagem;
                }
            }
        }
    }
    return array_slice($imagens, 0, CARROUSEL_MAX_SLIDES);
}

// ── Leitura ──────────────────────────────────────────────────────────────────

function cr_recolher()
{
    list($data, $raw) = cr_ler();
    $cartoes = array();

    foreach ((array)(isset($data['categories']) ? $data['categories'] : array()) as $i => $c) {
        if (!is_array($c)) {
            continue;
        }
        $cartoes[] = array(
            'indice' => $i,
            'id' => isset($c['id']) ? (string)$c['id'] : '',
            'titulo' => isset($c['title']) ? (string)$c['title'] : '',
            'href' => isset($c['href']) ? (string)$c['href'] : '',
            'miniatura' => isset($c['image']) ? (string)$c['image'] : '',
            'activo' => !isset($c['carouselEnabled']) || !empty($c['carouselEnabled']),
            'aleatorio' => !isset($c['carouselRandomizeOnLoad']) || !empty($c['carouselRandomizeOnLoad']),
            'slides' => carousel_slides($c),
            'doProduto' => cr_imagens_do_produto(isset($c['href']) ? $c['href'] : ''),
        );
    }

    return array(
        'ok' => true,
        'revisao' => home_revisao($raw),
        'global' => carousel_global($data),
        'cartoes' => $cartoes,
        'imagens' => cr_imagens_disponiveis(),
        'maxSlides' => CARROUSEL_MAX_SLIDES,
        'aberto' => !CARROUSEL_REQUIRE_ADMIN,
    );
}

// ── Gravação ─────────────────────────────────────────────────────────────────

function &cr_categoria(&$data, $id, &$ok)
{
    $ok = false;
    $nulo = null;
    foreach ($data['categories'] as $i => $c) {
        if (is_array($c) && isset($c['id']) && (string)$c['id'] === (string)$id) {
            $ok = true;
            return $data['categories'][$i];
        }
    }
    return $nulo;
}

// Garante que a categoria tem a lista de slides materializada. A ausência da
// chave quer dizer "ainda não migrado"; a partir do momento em que se edita,
// passa a ser a lista que manda.
function &cr_slides(&$categoria)
{
    if (!isset($categoria['carouselSlides']) || !is_array($categoria['carouselSlides'])) {
        $categoria['carouselSlides'] = array();
    }
    return $categoria['carouselSlides'];
}

function cr_slide_novo($imagem)
{
    $slide = array('image' => (string)$imagem);
    foreach (CAROUSEL_CAMPOS as $campo) {
        $slide[$campo] = null;
    }
    return $slide;
}

function cr_gravar()
{
    $body = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($body) || empty($body['alteracoes']) || !is_array($body['alteracoes'])) {
        cr_erro('Não há nada para gravar.');
    }

    list($data, $raw) = cr_ler();
    $revisao = home_revisao($raw);

    if (!isset($data['categories']) || !is_array($data['categories'])) {
        cr_erro('O home.json não tem categorias.', 500);
    }
    if (!isset($data['carousel']) || !is_array($data['carousel'])) {
        $data['carousel'] = carousel_global($data);
    }

    foreach ($body['alteracoes'] as $a) {
        $op = isset($a['op']) ? (string)$a['op'] : '';

        // ── Separador global ─────────────────────────────────────────────────
        if ($op === 'global') {
            $campo = isset($a['campo']) ? (string)$a['campo'] : '';
            if ($campo === 'enabled' || $campo === 'randomizeOnLoad') {
                $data['carousel'][$campo] = !empty($a['valor']);
                continue;
            }
            $limites = carousel_limites($campo);
            if ($limites === null) {
                cr_erro('O campo "' . $campo . '" não existe no carrossel.');
            }
            if (!is_numeric(isset($a['valor']) ? $a['valor'] : null)) {
                cr_erro('O campo "' . $campo . '" precisa de um número.');
            }
            $data['carousel'][$campo] = max($limites[0], min($limites[1], (float)$a['valor'] + 0));
            continue;
        }

        // Limpa os valores próprios de todos os slides: o global volta a mandar
        // em tudo. É o "propagar a todos" do separador global.
        if ($op === 'repor-globais') {
            foreach ($data['categories'] as $i => $c) {
                if (!is_array($c) || !isset($c['carouselSlides']) || !is_array($c['carouselSlides'])) {
                    continue;
                }
                foreach ($c['carouselSlides'] as $k => $slide) {
                    foreach (CAROUSEL_CAMPOS as $campo) {
                        $data['categories'][$i]['carouselSlides'][$k][$campo] = null;
                    }
                }
            }
            continue;
        }

        // ── Cartão ───────────────────────────────────────────────────────────
        $id = isset($a['cartao']) ? (string)$a['cartao'] : '';
        $ok = false;
        $categoria = &cr_categoria($data, $id, $ok);
        if (!$ok) {
            cr_erro('O cartão "' . $id . '" não existe.');
        }

        if ($op === 'cartao') {
            $campo = isset($a['campo']) ? (string)$a['campo'] : '';
            if (!in_array($campo, array('carouselEnabled', 'carouselRandomizeOnLoad'), true)) {
                cr_erro('O campo "' . $campo . '" não é editável no cartão.');
            }
            $categoria[$campo] = !empty($a['valor']);
            unset($categoria);
            continue;
        }

        $slides = &cr_slides($categoria);

        if ($op === 'slide') {
            $indice = isset($a['indice']) ? (int)$a['indice'] : -1;
            $campo = isset($a['campo']) ? (string)$a['campo'] : '';
            if (!isset($slides[$indice])) {
                cr_erro('A imagem ' . ($indice + 1) . ' de "' . $id . '" já não existe. Recarrega a página.');
            }
            if ($campo === 'image') {
                $imagem = trim((string)(isset($a['valor']) ? $a['valor'] : ''));
                if (!cr_imagem_valida($imagem)) {
                    cr_erro('Não encontrei o ficheiro "' . $imagem . '" dentro de content/.');
                }
                $slides[$indice]['image'] = $imagem;
            } else {
                $limites = carousel_limites($campo);
                if ($limites === null) {
                    cr_erro('O campo "' . $campo . '" não existe no carrossel.');
                }
                $valor = isset($a['valor']) ? $a['valor'] : '';
                // Vazio quer dizer "herda do global" — é assim que se desfaz um
                // valor próprio sem apagar o slide.
                $slides[$indice][$campo] = ($valor === '' || $valor === null)
                    ? null
                    : max($limites[0], min($limites[1], (float)$valor + 0));
            }
            unset($slides, $categoria);
            continue;
        }

        if ($op === 'slide-adicionar') {
            $imagem = trim((string)(isset($a['imagem']) ? $a['imagem'] : ''));
            if (!cr_imagem_valida($imagem)) {
                cr_erro('Não encontrei o ficheiro "' . $imagem . '" dentro de content/.');
            }
            if (count($slides) >= CARROUSEL_MAX_SLIDES) {
                cr_erro('Um carrossel mostra no máximo ' . CARROUSEL_MAX_SLIDES . ' imagens.');
            }
            $slides[] = cr_slide_novo($imagem);
            unset($slides, $categoria);
            continue;
        }

        if ($op === 'slide-remover') {
            $indice = isset($a['indice']) ? (int)$a['indice'] : -1;
            if (!isset($slides[$indice])) {
                cr_erro('A imagem ' . ($indice + 1) . ' de "' . $id . '" já não existe. Recarrega a página.');
            }
            array_splice($slides, $indice, 1);
            unset($slides, $categoria);
            continue;
        }

        if ($op === 'slide-ordem') {
            $ordem = isset($a['ordem']) && is_array($a['ordem']) ? $a['ordem'] : array();
            if (count($ordem) !== count($slides)) {
                cr_erro('A ordem das imagens de "' . $id . '" não bate certo. Recarrega a página.');
            }
            $nova = array();
            $vistos = array();
            foreach ($ordem as $posicao) {
                $posicao = (int)$posicao;
                if (!isset($slides[$posicao]) || isset($vistos[$posicao])) {
                    cr_erro('A ordem das imagens de "' . $id . '" está inválida.');
                }
                $vistos[$posicao] = true;
                $nova[] = $slides[$posicao];
            }
            $slides = $nova;
            unset($slides, $categoria);
            continue;
        }

        if ($op === 'puxar-do-produto') {
            $imagens = cr_imagens_do_produto(isset($categoria['href']) ? $categoria['href'] : '');
            if (!$imagens) {
                cr_erro('O produto de "' . $id . '" não tem imagens no passo dos designs.');
            }
            $novos = array();
            foreach ($imagens as $imagem) {
                $novos[] = cr_slide_novo($imagem);
            }
            $slides = $novos;
            unset($slides, $categoria);
            continue;
        }

        unset($slides, $categoria);
        cr_erro('Operação desconhecida: ' . $op . '.');
    }

    // O `carouselSourceImages` era a lista antiga. Depois de mexer aqui, deixá-lo
    // no ficheiro só dava um segundo sítio a dizer coisa diferente.
    foreach ($data['categories'] as $i => $c) {
        if (is_array($c) && array_key_exists('carouselSourceImages', $c)) {
            unset($data['categories'][$i]['carouselSourceImages']);
        }
    }

    $erro = home_gravar($data, $revisao, '.carrousel-bak');
    if ($erro !== '') {
        cr_erro($erro, 409);
    }

    cr_responder(cr_recolher());
}

// ── Router ───────────────────────────────────────────────────────────────────

cr_exigir_admin();
$action = isset($_GET['action']) ? (string)$_GET['action'] : 'data';

if ($action === 'data') {
    cr_responder(cr_recolher());
}

if ($action === 'save') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        cr_erro('Usa POST para gravar.', 405);
    }
    cr_gravar();
}

cr_erro('Acção desconhecida.', 404);
