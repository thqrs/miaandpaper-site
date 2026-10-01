<?php
// ORCAMENTOS_API_V1
// Backend da página dos orçamentos (orcamentos.php).
//
// Os orçamentos e as definições (dados da empresa, IVA, notas por omissão)
// vivem na base SQLite privada — ver lib/orcamentos.php. O PDF é gerado a
// pedido, nunca fica guardado: muda-se o orçamento, o PDF seguinte já sai certo.
//
// "Do catálogo" não tem preços próprios: inclui o precos-api.php em modo
// embutido e corre o mesmo precos_calcular() que o cross-check do editor de
// preços usa, sobre o content/pricing.json. O que daqui sai é o que o checkout
// cobraria por aquela quantidade.

declare(strict_types=0);

require_once __DIR__ . '/admin-open.php';
require_once __DIR__ . '/lib/orcamento-pdf.php';

const ORC_PRICING_FILE = __DIR__ . '/content/pricing.json';

header('Cache-Control: no-store, no-cache, must-revalidate');

function orc_responder($payload, $status = 200)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function orc_erro($mensagem, $status = 400)
{
    orc_responder(array('ok' => false, 'erro' => $mensagem), $status);
}

function orc_exigir_post_csrf()
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        orc_erro('Usa POST.', 405);
    }
    $enviado = isset($_SERVER['HTTP_X_ADMIN_CSRF']) ? (string)$_SERVER['HTTP_X_ADMIN_CSRF'] : '';
    if (!mp_admin_csrf_is_valid($enviado)) {
        orc_erro('Pedido bloqueado por CSRF. Recarrega a página.', 403);
    }
}

function orc_corpo()
{
    $corpo = json_decode((string)file_get_contents('php://input'), true);
    return is_array($corpo) ? $corpo : array();
}

function orc_pricing()
{
    $pricing = is_file(ORC_PRICING_FILE) ? json_decode((string)file_get_contents(ORC_PRICING_FILE), true) : null;
    return is_array($pricing) && isset($pricing['products']) && is_array($pricing['products']) ? $pricing : array('products' => array());
}

/** Os produtos que se podem acrescentar a um orçamento, com as suas medidas. */
function orc_catalogo()
{
    $catalogo = array();
    foreach (orc_pricing()['products'] as $slug => $produto) {
        if (empty($produto['prices']) || !is_array($produto['prices'])) {
            continue;
        }
        $catalogo[] = array(
            'slug' => (string)$slug,
            'nome' => isset($produto['label']) ? (string)$produto['label'] : (string)$slug,
            'chaves' => array_map('strval', array_keys($produto['prices'])),
            'chaveOmissao' => isset($produto['defaultPriceKey']) ? (string)$produto['defaultPriceKey'] : '',
            'minimo' => max(1, (int)(isset($produto['minimumQuantity']) ? $produto['minimumQuantity'] : 1)),
            'imagemCents' => isset($produto['customArtworkFeePerFileCents']) ? (int)$produto['customArtworkFeePerFileCents'] : 0,
        );
    }
    return $catalogo;
}

/**
 * As linhas que um produto do catálogo acrescenta ao orçamento: o artigo ao
 * preço unitário mais alto da tabela (o "preço real"), o desconto de
 * quantidade que a tabela lhe dá, e as imagens originais se as houver.
 */
function orc_linhas_catalogo($slug, $chave, $quantidade, $imagens)
{
    $pricing = orc_pricing();
    if (!isset($pricing['products'][$slug]['prices'][$chave])) {
        orc_erro('Produto ou medida desconhecidos.');
    }
    $produto = $pricing['products'][$slug];
    $quantidade = max(1, min(1000, (int)$quantidade));

    if (!defined('MP_API_EMBUTIDA')) {
        define('MP_API_EMBUTIDA', true);
    }
    require_once __DIR__ . '/precos-api.php';

    $soEsta = $produto;
    $soEsta['prices'] = array($chave => $produto['prices'][$chave]);
    $tabelas = precos_calcular(array('products' => array($slug => $soEsta)), $quantidade);
    $valores = isset($tabelas[0]['valores']) ? $tabelas[0]['valores'] : array();
    if (!isset($valores[$quantidade])) {
        orc_erro('A tabela deste produto não tem preço para ' . $quantidade . ' unidades.');
    }
    $total = (int)$valores[$quantidade];

    // O preço unitário de referência é o da primeira quantidade que a tabela
    // vende (1 na maioria; o pack mais pequeno quando não se vende à unidade).
    $unitario = 0;
    foreach ($valores as $n => $valor) {
        if ($valor !== null) {
            $unitario = (int)round($valor / $n);
            break;
        }
    }

    $nome = isset($produto['label']) ? (string)$produto['label'] : $slug;
    $descricao = count($produto['prices']) > 1 ? $nome . ' ' . $chave : $nome;
    $idItem = bin2hex(random_bytes(5));
    $semDesconto = $quantidade * $unitario;
    $linhas = array();

    if ($unitario <= 0 || $semDesconto <= $total) {
        $linhas[] = array('id' => $idItem, 'tipo' => 'item', 'descricao' => $descricao, 'detalhe' => '',
            'quantidade' => $quantidade, 'precoUnitCents' => (int)round($total / $quantidade));
    } else {
        $linhas[] = array('id' => $idItem, 'tipo' => 'item', 'descricao' => $descricao, 'detalhe' => '',
            'quantidade' => $quantidade, 'precoUnitCents' => $unitario);
        $diferenca = $semDesconto - $total;
        // Só se mostra em percentagem quando é redonda ("– 20 %"); um "– 5,05 %"
        // parece um erro ao cliente, por isso aí vai o valor em euros.
        $percentagem = (int)round($diferenca * 100 / $semDesconto);
        $desconto = array('id' => bin2hex(random_bytes(5)), 'tipo' => 'desconto', 'descricao' => 'Desconto de quantidade',
            'detalhe' => '', 'alvo' => $idItem, 'percentagem' => 0, 'valorCents' => 0);
        if ($percentagem > 0 && orc_arredondar($semDesconto * $percentagem / 100) === $diferenca) {
            $desconto['modo'] = 'percent';
            $desconto['percentagem'] = $percentagem;
        } else {
            $desconto['modo'] = 'valor';
            $desconto['valorCents'] = $diferenca;
        }
        $linhas[] = $desconto;
    }

    $imagens = max(0, min(100, (int)$imagens));
    $porImagem = isset($produto['customArtworkFeePerFileCents']) ? (int)$produto['customArtworkFeePerFileCents'] : 0;
    if ($imagens > 0 && $porImagem > 0) {
        $linhas[] = array('id' => bin2hex(random_bytes(5)), 'tipo' => 'item', 'descricao' => 'Imagens originais',
            'detalhe' => '', 'quantidade' => $imagens, 'precoUnitCents' => $porImagem);
    }

    return array('linhas' => $linhas, 'totalTabelaCents' => $total);
}

function orc_enviar_pdf($orcamento, $definicoes, $descarregar)
{
    $bytes = orc_pdf($orcamento, $definicoes);
    header('Content-Type: application/pdf');
    header('Content-Length: ' . strlen($bytes));
    header('Content-Disposition: ' . ($descarregar ? 'attachment' : 'inline') . '; filename="' . orc_pdf_nome($orcamento) . '"');
    header('X-Content-Type-Options: nosniff');
    echo $bytes;
    exit;
}

// ── Router ───────────────────────────────────────────────────────────────────

if (empty($_SESSION['miaandpaper_admin'])) {
    orc_erro('Precisas de sessão de administradora.', 403);
}

$action = isset($_GET['action']) ? (string)$_GET['action'] : 'data';

try {
    // PARAMETROS_V1: esquema desta API, na forma do manifesto geral.
    if ($action === 'parametros') {
        require_once __DIR__ . '/lib/parametros.php';
        orc_responder(array('ok' => true, 'recurso' => mp_parametros_manifesto_recurso('orcamentos-api.php')));
    }

    if ($action === 'data') {
        orc_responder(array(
            'ok' => true,
            'csrf' => mp_admin_csrf_token(),
            'definicoes' => orc_ler_definicoes(),
            'orcamentos' => orc_lista(),
            'catalogo' => orc_catalogo(),
        ));
    }

    if ($action === 'obter') {
        $orcamento = orc_obter(isset($_GET['id']) ? (int)$_GET['id'] : 0);
        if ($orcamento === null) {
            orc_erro('Orçamento não encontrado.', 404);
        }
        orc_responder(array('ok' => true, 'orcamento' => $orcamento));
    }

    if ($action === 'preco') {
        $resultado = orc_linhas_catalogo(
            isset($_GET['slug']) ? (string)$_GET['slug'] : '',
            isset($_GET['chave']) ? (string)$_GET['chave'] : '',
            isset($_GET['qtd']) ? (int)$_GET['qtd'] : 1,
            isset($_GET['imagens']) ? (int)$_GET['imagens'] : 0
        );
        orc_responder(array('ok' => true) + $resultado);
    }

    if ($action === 'gravar') {
        orc_exigir_post_csrf();
        $corpo = orc_corpo();
        $definicoes = orc_ler_definicoes();
        $orcamento = orc_normalizar(isset($corpo['orcamento']) ? $corpo['orcamento'] : array(), $definicoes);
        $id = orc_gravar(isset($corpo['id']) ? (int)$corpo['id'] : 0, $orcamento, $definicoes);
        if ($id <= 0) {
            orc_erro('Este orçamento já não existe. Recarrega a página.', 404);
        }
        orc_responder(array('ok' => true, 'orcamento' => orc_obter($id), 'orcamentos' => orc_lista()));
    }

    if ($action === 'apagar') {
        orc_exigir_post_csrf();
        $corpo = orc_corpo();
        orc_apagar(isset($corpo['id']) ? (int)$corpo['id'] : 0);
        orc_responder(array('ok' => true, 'orcamentos' => orc_lista()));
    }

    if ($action === 'definicoes') {
        orc_exigir_post_csrf();
        $corpo = orc_corpo();
        $definicoes = orc_normalizar_definicoes(isset($corpo['definicoes']) ? $corpo['definicoes'] : array());
        orc_gravar_definicoes($definicoes);
        orc_responder(array('ok' => true, 'definicoes' => $definicoes));
    }

    // Pré-visualização do que está no editor, gravado ou não.
    if ($action === 'previa') {
        orc_exigir_post_csrf();
        $corpo = orc_corpo();
        $definicoes = orc_ler_definicoes();
        $orcamento = orc_normalizar(isset($corpo['orcamento']) ? $corpo['orcamento'] : array(), $definicoes);
        $id = isset($corpo['id']) ? (int)$corpo['id'] : 0;
        $gravado = $id > 0 ? orc_obter($id) : null;
        $orcamento['numero'] = $gravado !== null ? $gravado['numero'] : '';
        orc_enviar_pdf($orcamento, $definicoes, false);
    }

    if ($action === 'pdf') {
        $orcamento = orc_obter(isset($_GET['id']) ? (int)$_GET['id'] : 0);
        if ($orcamento === null) {
            orc_erro('Orçamento não encontrado.', 404);
        }
        orc_enviar_pdf($orcamento, orc_ler_definicoes(), isset($_GET['descarregar']));
    }
} catch (Exception $e) {
    orc_erro('Erro no servidor: ' . $e->getMessage(), 500);
}

orc_erro('Acção desconhecida.', 404);
