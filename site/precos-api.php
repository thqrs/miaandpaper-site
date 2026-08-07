<?php
// PRECOS_API_V1
// Backend do editor central de precos (precos.php).
//
// Ideia: NAO ha migracao de dados. Cada valor monetario continua a viver onde
// o site ja o le — as tabelas base e os modos em content/pricing.json, os
// portes/acabamentos/extras/tamanhos no JSON de cada produto. Esta API so
// oferece um sitio unico para os EDITAR, e reescreve cada valor no seu ficheiro
// canonico. Assim o caminho de calculo do checkout nao muda, e nao ha risco de
// a pagina passar a mostrar um preco diferente do que e cobrado.
//
// A validacao usa lib/precos-core.php — o mesmo codigo que o send-order.php
// corre para aceitar ou recusar a encomenda. Uma gravacao que deixasse os dois
// ficheiros em desacordo e recusada AQUI, em vez de falhar em silencio no
// checkout do cliente.

declare(strict_types=0);

// Igual ao GALERIA_REQUIRE_ADMIN: aberto ate ao deploy, por decisao do Tiago.
// ⚠️ ANTES DO DEPLOY pôr a true. Escrever precos e mais perigoso do que trocar
// imagens — com isto a false, quem alcancar o servidor poe os precos a zero.
define('PRECOS_REQUIRE_ADMIN', false);

require_once __DIR__ . '/lib/precos-core.php';
require_once __DIR__ . '/lib/private-paths.php';

const PRECOS_PRODUCTS_DIR = __DIR__ . '/content/products';
const PRECOS_PRICING_FILE = __DIR__ . '/content/pricing.json';

// A capsula do Congresso 2026 tem a sua propria tabela de precos, que o
// send-order.php le quando o pedido vem de la. A regra de "nao mexer na
// capsula" e sobre as IMAGENS e o DESIGN — os precos podem e devem acompanhar
// o catalogo, senao divergem sozinhos (ja aconteceu com os portes).
const PRECOS_CAPSULA_FILE = __DIR__ . '/congressos/2026/content/pricing.json';

// Que produto do catalogo manda em cada produto da capsula, para o botao de
// sincronizar. `lembrancas` fica de fora: e uma oferta, esta tudo a zero.
const PRECOS_CAPSULA_ESPELHO = array(
    'crachas' => 'crachas-loja',
    'pins' => 'crachas-loja',
    'imanes' => 'imanes-loja',
    'caderninhos' => 'mini-cadernos',
    'cadernos' => 'cadernos-anuais',
);

// Campos monetarios reconhecidos dentro do JSON de um produto. A varredura e
// generica, como a da galeria: um campo novo com um destes nomes aparece
// sozinho no editor, sem se tocar em codigo.
const PRECOS_CAMPOS = array(
    'priceCents' => 'Preço',
    'extraPriceCents' => 'Extra',
    'extraPriceCentsPerUnit' => 'Extra por unidade',
    'feeCents' => 'Portes',
);

// Campos de texto editaveis num item. Deliberadamente NAO inclui `id` nem
// `value`: esses sao a identidade do item e sao referidos pelas seleccoes
// gravadas no browser, pelas encomendas ja feitas e pelas allowlists do
// send-order.php. Renomear um partiria coisas em silencio.
const PRECOS_TEXTOS = array('title', 'subtitle', 'label', 'text', 'priceText');

// Modos aceites, iguais aos de lib/precos-core.php.
const PRECOS_MODOS = array('flat-unit', 'pack-combination', 'tier-unit', 'linear-discount-interpolation');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

function precos_responder($payload, $status = 200)
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function precos_erro($mensagem, $status = 400)
{
    precos_responder(array('ok' => false, 'erro' => $mensagem), $status);
}

function precos_exigir_admin()
{
    if (!PRECOS_REQUIRE_ADMIN) {
        return;
    }
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    if (empty($_SESSION['miaandpaper_admin'])) {
        precos_erro('Precisas de sessão de administradora.', 403);
    }
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $token = isset($_SERVER['HTTP_X_CSRF_TOKEN']) ? (string)$_SERVER['HTTP_X_CSRF_TOKEN'] : '';
        if ($token === '' || empty($_SESSION['mp_precos_csrf']) || !hash_equals($_SESSION['mp_precos_csrf'], $token)) {
            precos_erro('Token CSRF inválido.', 403);
        }
    }
}

// Um slug so pode apontar para um ficheiro que ja existe em content/products.
// Nunca criamos ficheiros novos por aqui.
function precos_caminho_produto($slug)
{
    $slug = (string)$slug;
    if ($slug === '' || !preg_match('/^[a-z0-9-]+$/', $slug)) {
        return '';
    }
    $path = PRECOS_PRODUCTS_DIR . '/' . $slug . '.json';
    return is_file($path) ? $path : '';
}

function precos_ler_json($path)
{
    $raw = @file_get_contents($path);
    if ($raw === false) {
        return array(null, '', 'Não consegui ler ' . basename($path) . '.');
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return array(null, $raw, 'JSON inválido em ' . basename($path) . '.');
    }
    return array($data, $raw, '');
}

function precos_revisao($raw)
{
    return hash('sha256', (string)$raw);
}

// Percorre o JSON e devolve um "slot" por valor monetario, com o trail que o
// localiza. Como na galeria, tudo e resolvido pelo trail e nunca por
// referencia guardada.
// Primeira imagem que apareça no JSON do produto, para o cabeçalho do cartão.
// Serve só para se reconhecer o produto de relance — se não houver, o editor
// mostra as iniciais.
function precos_miniatura($node, $profundidade = 0)
{
    if ($profundidade > 12 || !is_array($node)) {
        return '';
    }
    foreach ($node as $chave => $valor) {
        if (($chave === 'image' || $chave === 'sideImage')
            && is_string($valor) && trim($valor) !== ''
            && !preg_match('#^(https?:|data:|/|\.\.)#', $valor)
        ) {
            return $valor;
        }
    }
    foreach ($node as $valor) {
        if (is_array($valor)) {
            $achado = precos_miniatura($valor, $profundidade + 1);
            if ($achado !== '') {
                return $achado;
            }
        }
    }
    return '';
}

function precos_e_lista($valor)
{
    return is_array($valor) && ($valor === array() || array_keys($valor) === range(0, count($valor) - 1));
}

function precos_tem_dinheiro($item)
{
    if (!is_array($item)) {
        return false;
    }
    foreach (PRECOS_CAMPOS as $campo => $_) {
        if (array_key_exists($campo, $item) && !is_array($item[$campo])) {
            return true;
        }
    }
    return false;
}

// Descreve um item de uma coleccao: o que se pode editar nele.
function precos_descrever_item($item, $trailItem, $indice)
{
    $textos = array();
    foreach (PRECOS_TEXTOS as $campo) {
        if (isset($item[$campo]) && is_string($item[$campo])) {
            $textos[] = array(
                'campo' => $campo,
                'texto' => $item[$campo],
                'trail' => array_merge($trailItem, array($campo)),
            );
        }
    }

    $dinheiro = array();
    foreach (PRECOS_CAMPOS as $campo => $tipo) {
        if (array_key_exists($campo, $item) && !is_array($item[$campo])) {
            $dinheiro[] = array(
                'campo' => $campo,
                'tipo' => $tipo,
                'cents' => (int)$item[$campo],
                'trail' => array_merge($trailItem, array($campo)),
            );
        }
    }

    $identidade = '';
    foreach (array('id', 'value') as $campo) {
        if (isset($item[$campo]) && is_string($item[$campo])) {
            $identidade = $item[$campo];
            break;
        }
    }

    return array(
        'indice' => $indice,
        'trail' => $trailItem,
        'identidade' => $identidade,
        'textos' => $textos,
        'dinheiro' => $dinheiro,
    );
}

// Varredura generica, no espirito da galeria: qualquer LISTA cujos elementos
// tenham um campo monetario e uma coleccao editavel — dá para acrescentar e
// remover linhas. Um campo novo com um dos nomes de PRECOS_CAMPOS aparece
// sozinho, sem se tocar em codigo.
function precos_varrer($node, $trail, &$coleccoes, &$soltos, $rotulo)
{
    if (!is_array($node)) {
        return;
    }

    foreach ($node as $chave => $valor) {
        $novoTrail = $trail;
        $novoTrail[] = $chave;

        // Os portes deixaram de ser por produto: vêm do bloco `delivery` do
        // pricing.json. Mostrá-los 13 vezes só convidava a editar a cópia
        // errada, por isso a varredura salta-os.
        if ($chave === 'deliveryOptions') {
            continue;
        }

        if (precos_e_lista($valor)) {
            $comDinheiro = 0;
            foreach ($valor as $item) {
                if (precos_tem_dinheiro($item)) {
                    $comDinheiro++;
                }
            }

            if ($comDinheiro > 0) {
                $itens = array();
                foreach ($valor as $i => $item) {
                    if (!precos_tem_dinheiro($item)) {
                        continue;
                    }
                    $itens[] = precos_descrever_item($item, array_merge($novoTrail, array($i)), $i);
                }
                $coleccoes[] = array(
                    'trail' => $novoTrail,
                    'nome' => is_string($chave) ? $chave : (string)$chave,
                    'caminho' => implode(' › ', $novoTrail),
                    'completa' => $comDinheiro === count($valor),
                    'itens' => $itens,
                );

                // Continua a descer à procura de coleccoes aninhadas — os
                // `steps` dos cadernos têm um `extraPriceCents` directo E as
                // gavetas da capa mais abaixo, e parar aqui escondia-as.
                //
                // Os valores soltos vão para um saco descartável: o dinheiro
                // desta lista já foi contado nos `itens` acima, e recolhê-lo
                // outra vez mostrava o mesmo valor duas vezes (era assim que os
                // portes apareciam a dobrar).
                $descartar = array();
                precos_varrer($valor, $novoTrail, $coleccoes, $descartar, $rotulo);
                continue;
            }
        }

        if (is_array($valor)) {
            $proximoRotulo = $rotulo;
            foreach (array('label', 'title', 'name', 'id', 'value') as $campo) {
                if (isset($valor[$campo]) && is_string($valor[$campo]) && trim($valor[$campo]) !== '') {
                    $proximoRotulo = trim($valor[$campo]);
                    break;
                }
            }
            precos_varrer($valor, $novoTrail, $coleccoes, $soltos, $proximoRotulo);
            continue;
        }

        // Valor monetario que nao esta dentro de uma coleccao — por exemplo o
        // extraPriceCents do proprio passo de personalizacao da capa.
        if (isset(PRECOS_CAMPOS[$chave]) && (is_int($valor) || is_float($valor) || ctype_digit((string)$valor))) {
            $soltos[] = array(
                'trail' => $novoTrail,
                'campo' => $chave,
                'tipo' => PRECOS_CAMPOS[$chave],
                'rotulo' => $rotulo,
                'cents' => (int)$valor,
            );
        }
    }
}

function precos_valor_por_trail($data, $trail)
{
    $node = $data;
    foreach ($trail as $chave) {
        if (!is_array($node) || !array_key_exists($chave, $node)) {
            return null;
        }
        $node = $node[$chave];
    }
    return $node;
}

// Escreve um inteiro no fim do trail. Recusa criar chaves novas: so se altera
// um valor que ja exista, e so se o que la esta tambem for um numero.
function precos_definir_por_trail(&$data, $trail, $cents)
{
    $node = &$data;
    $ultimo = array_pop($trail);

    foreach ($trail as $chave) {
        if (!is_array($node) || !array_key_exists($chave, $node)) {
            return false;
        }
        $node = &$node[$chave];
    }

    if (!is_array($node) || !array_key_exists($ultimo, $node)) {
        return false;
    }
    $actual = $node[$ultimo];
    if (!is_int($actual) && !is_float($actual) && !ctype_digit((string)$actual)) {
        return false;
    }

    $node[$ultimo] = (int)$cents;
    return true;
}

// EXTRAS_CENTRAIS_V1 ─────────────────────────────────────────────────────────
// O mesmo acabamento vive em varios ficheiros ao mesmo tempo (o `finishOptions`
// de cada produto, a gaveta de outros, o catalogo da personalizacao). O bloco
// `optionExtras` do pricing.json e quem manda em runtime; estas funcoes fazem
// com que uma edicao no editor va la parar E seja replicada por todas as
// copias, para nenhuma delas ficar a dizer um numero que ja nao e cobrado.
function precos_chave_central($node)
{
    if (!is_array($node)) {
        return '';
    }
    if (isset($node['value']) && is_scalar($node['value'])) {
        return (string)$node['value'];
    }
    if (isset($node['id']) && is_scalar($node['id'])) {
        return (string)$node['id'];
    }
    return '';
}

// Reescreve todas as ocorrencias da chave dentro de uma arvore. Devolve quantas
// mudou, para o chamador saber se vale a pena gravar o ficheiro.
function precos_replicar_extra(&$node, $chave, $cents)
{
    $mudou = 0;

    if (!is_array($node)) {
        return 0;
    }
    if (precos_chave_central($node) === $chave) {
        foreach (array('extraPriceCents', 'extraPriceCentsPerUnit') as $campo) {
            if (isset($node[$campo]) && is_numeric($node[$campo]) && (int)$node[$campo] !== $cents) {
                $node[$campo] = $cents;
                $mudou += 1;
            }
        }
    }
    foreach ($node as $k => $filho) {
        if (is_array($filho)) {
            $mudou += precos_replicar_extra($node[$k], $chave, $cents);
        }
    }
    return $mudou;
}

// Devolve uma referencia ao no do trail. $criar=false nunca inventa chaves.
function &precos_no_por_trail(&$data, $trail, &$ok)
{
    $ok = true;
    $node = &$data;
    foreach ($trail as $chave) {
        if (!is_array($node) || !array_key_exists($chave, $node)) {
            $ok = false;
            $nulo = null;
            return $nulo;
        }
        $node = &$node[$chave];
    }
    return $node;
}

// Escreve uma string num campo de texto ja existente. So os campos de
// PRECOS_TEXTOS — nunca `id` nem `value`, que sao identidade.
function precos_definir_texto(&$data, $trail, $texto)
{
    $campo = end($trail);
    if (!in_array((string)$campo, PRECOS_TEXTOS, true)) {
        return 'O campo "' . $campo . '" não é editável aqui.';
    }

    $texto = (string)$texto;
    if (strlen($texto) > 400) {
        return 'Texto demasiado longo.';
    }
    // Sem caracteres de controlo, excepto a quebra de linha que o priceText usa.
    if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', $texto)) {
        return 'O texto tem caracteres de controlo.';
    }

    $caminho = $trail;
    array_pop($caminho);
    $ok = false;
    $node = &precos_no_por_trail($data, $caminho, $ok);
    if (!$ok || !is_array($node) || !array_key_exists($campo, $node) || !is_string($node[$campo])) {
        return 'Não encontrei o texto em ' . implode(' → ', $trail) . '.';
    }

    $node[$campo] = $texto;
    return '';
}

// Acrescenta uma linha a uma coleccao, modelada pelo primeiro item existente:
// as strings ficam vazias, os numeros a zero. Nao copia estruturas aninhadas —
// seria adivinhar de mais.
function precos_adicionar_linha(&$data, $trail, &$identidadeNova)
{
    $ok = false;
    $lista = &precos_no_por_trail($data, $trail, $ok);
    if (!$ok || !precos_e_lista($lista)) {
        return 'Não encontrei a coleção em ' . implode(' → ', $trail) . '.';
    }

    $modelo = null;
    foreach ($lista as $item) {
        if (precos_tem_dinheiro($item)) {
            $modelo = $item;
            break;
        }
    }
    if ($modelo === null) {
        return 'A coleção está vazia — não há por onde modelar a linha nova.';
    }

    $novo = array();
    foreach ($modelo as $campo => $valor) {
        if (is_array($valor)) {
            continue;
        }
        if (is_bool($valor)) {
            $novo[$campo] = false;
        } elseif (is_int($valor) || is_float($valor)) {
            $novo[$campo] = 0;
        } else {
            $novo[$campo] = '';
        }
    }

    // Identidade unica dentro da coleccao.
    $campoId = array_key_exists('id', $novo) ? 'id' : (array_key_exists('value', $novo) ? 'value' : '');
    if ($campoId !== '') {
        $usados = array();
        foreach ($lista as $item) {
            if (isset($item[$campoId])) {
                $usados[(string)$item[$campoId]] = true;
            }
        }
        $n = count($lista) + 1;
        do {
            $candidato = 'novo-' . $n;
            $n++;
        } while (isset($usados[$candidato]));
        $novo[$campoId] = $candidato;
        $identidadeNova = $candidato;
    }

    if (array_key_exists('title', $novo)) {
        $novo['title'] = 'Novo';
    } elseif (array_key_exists('label', $novo)) {
        $novo['label'] = 'Novo';
    }

    $lista[] = $novo;
    return '';
}

// Remove uma linha. Nunca deixa a coleccao vazia — um produto sem opcoes de
// entrega, ou sem tamanhos, parte o checkout de formas que a validacao de
// precos nao apanha.
function precos_remover_linha(&$data, $trail)
{
    $indice = array_pop($trail);
    if (!is_int($indice) && !ctype_digit((string)$indice)) {
        return 'Caminho de remoção inválido.';
    }
    $indice = (int)$indice;

    $ok = false;
    $lista = &precos_no_por_trail($data, $trail, $ok);
    if (!$ok || !precos_e_lista($lista)) {
        return 'Não encontrei a coleção em ' . implode(' → ', $trail) . '.';
    }
    if (!array_key_exists($indice, $lista)) {
        return 'A linha ' . $indice . ' já não existe.';
    }
    if (count($lista) <= 1) {
        return 'Não posso remover a última linha de ' . implode(' → ', $trail) . '.';
    }

    array_splice($lista, $indice, 1);
    return '';
}

// ── Packs ────────────────────────────────────────────────────────────────────
// Um pack vive em dois sitios: a quantidade e o preco em pricing.json, e o
// botao que o cliente carrega nos `items` do passo `pack` do JSON do produto.
// Estas funcoes mexem sempre nos dois, para nao ficar um sem o outro.

function &precos_tabela(&$pricing, $slug, $priceKey, &$ok)
{
    return precos_no_por_trail($pricing, array('products', $slug, 'prices', $priceKey), $ok);
}

// AGENDAS_VARIANTES_V1
// Nem toda a "tabela de precos" e uma escada de quantidades. Quando o passo
// `pack` tem o template `purchase-option`, os itens sao VARIANTES do produto
// (Agenda Normal, Pack Pioneiro...) e o campo `quantity` de cada um e so um
// indice para alinhar com a tabela — nao e uma quantidade a serio.
//
// Isso importa porque o preco que cobra e o `priceCents` do item; a tabela em
// pricing.json e apenas o recurso (ver `purchaseOptionCents` em
// js/10-produto-precos.js e `product_flat_unit_price_cents` no send-order).
// Mostrar isto como quantidades faria o editor dizer "2 agendas = 34,90 €" e,
// pior, deixar editar um numero que nao cobra nada.
function precos_variantes(&$produto, $registoCentral)
{
    $indice = precos_passo_pack($produto);
    if ($indice === null) {
        return array();
    }
    $passo = $produto['steps'][$indice];
    if (!isset($passo['template']) || $passo['template'] !== 'purchase-option') {
        return array();
    }
    if (empty($passo['items']) || !is_array($passo['items'])) {
        return array();
    }

    $priceKey = isset($registoCentral['defaultPriceKey']) ? (string)$registoCentral['defaultPriceKey'] : '';
    $variantes = array();

    foreach ($passo['items'] as $i => $item) {
        if (!isset($item['priceCents'])) {
            continue;
        }
        $valor = isset($item['value']) ? (string)$item['value'] : '';
        $variantes[] = array(
            'valor' => $valor,
            'titulo' => isset($item['title']) ? (string)$item['title'] : $valor,
            'indice' => isset($item['quantity']) ? (int)$item['quantity'] : ($i + 1),
            'cents' => (int)$item['priceCents'],
            'priceKey' => $priceKey,
            // Onde é que o mesmo número está espelhado, para o editor avisar.
            'espelhos' => array_values(array_filter(array(
                isset($registoCentral['prices'][$priceKey][(string)(int)(isset($item['quantity']) ? $item['quantity'] : 0)])
                    ? 'pricing.json → prices' : '',
                ($valor !== '' && isset($registoCentral['flatUnitPricesCents'][$valor]))
                    ? 'pricing.json → flatUnitPricesCents' : '',
            ))),
        );
    }

    return $variantes;
}

function precos_passo_pack(&$produto)
{
    if (!isset($produto['steps']) || !is_array($produto['steps'])) {
        return null;
    }
    foreach ($produto['steps'] as $i => $passo) {
        if (isset($passo['id']) && $passo['id'] === 'pack') {
            return $i;
        }
    }
    return null;
}

// Espelha em `steps[pack].items` as quantidades que a tabela tem. Faz o mesmo
// que `syncPackItemsFromPricing()` em js/10-produto-precos.js, mas grava no
// ficheiro — o JS so corrige em memoria, e nem sequer corre quando o passo tem
// `freeQuantity: true`, que e o caso de todos os produtos main-v2.
function precos_sincronizar_packs(&$produto, $quantidades, $unidade, $unidadeSingular)
{
    $indice = precos_passo_pack($produto);
    if ($indice === null || !isset($produto['steps'][$indice]['items'])
        || !is_array($produto['steps'][$indice]['items'])) {
        return;
    }

    sort($quantidades, SORT_NUMERIC);
    $existentes = array();
    foreach ($produto['steps'][$indice]['items'] as $item) {
        if (isset($item['quantity'])) {
            $existentes[(int)$item['quantity']] = $item;
        }
    }

    $novos = array();
    foreach ($quantidades as $q) {
        $q = (int)$q;
        if (isset($existentes[$q])) {
            $novos[] = $existentes[$q];
            continue;
        }
        $novos[] = array(
            'id' => 'pack-' . $q,
            'quantity' => $q,
            'title' => (string)$q,
            'subtitle' => $q === 1 ? $unidadeSingular : $unidade,
        );
    }

    $produto['steps'][$indice]['items'] = $novos;
}

// O JSON_PRETTY_PRINT do PHP indenta sempre a 4 espacos, mas os JSON de produto
// deste repositorio usam 2. Sem isto, mudar um preco reescrevia o ficheiro
// inteiro e o diff de git ficava com 400 linhas em vez de 1 — impossivel de
// rever, e impossivel de perceber o que mudou de facto.
function precos_detectar_indentacao($raw)
{
    if (preg_match('/\n( +)"/', (string)$raw, $m)) {
        return strlen($m[1]);
    }
    return 4;
}

// Seguro por construcao: o json_encode escapa as quebras de linha dentro das
// strings (\n), por isso nenhuma linha do resultado comeca dentro de um valor.
// Mexer so no espaco a esquerda nunca toca no conteudo.
function precos_reindentar($json, $unidade)
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

// Escrita atomica: monta o ficheiro novo ao lado e so depois o poe no lugar
// com um rename. Um leitor nunca ve um ficheiro a meio, e uma escrita mais
// curta do que o original nao pode deixar cauda do conteudo antigo — que e
// exactamente como um JSON de produto se transforma em lixo.
//
// Depois de renomear, volta a ler e a descodificar o que ficou no disco. Se
// nao for JSON valido, repoe a copia de seguranca e devolve erro. Isto edita
// dinheiro: mais vale recusar a alteracao do que deixar um ficheiro partido.
function precos_gravar_json($path, $data, $revisaoEsperada)
{
    $nome = basename($path);

    $actual = @file_get_contents($path);
    if ($actual === false) {
        return 'Não consegui ler ' . $nome . '.';
    }
    if ($revisaoEsperada !== '' && !hash_equals(precos_revisao($actual), $revisaoEsperada)) {
        return 'O ficheiro ' . $nome . ' mudou noutro separador. Recarrega antes de gravar.';
    }

    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return 'Não consegui serializar ' . $nome . '.';
    }
    $json = precos_reindentar($json, precos_detectar_indentacao($actual)) . "\n";

    // Rede de segurança antes de tocar no original. O sufixo "-bak" já está
    // bloqueado no .htaccess e ignorado pelo git.
    if (@file_put_contents($path . '.precos-bak', $actual, LOCK_EX) === false) {
        return 'Não consegui gravar a cópia de segurança de ' . $nome . '.';
    }

    $temporario = $path . '.precos-tmp';
    if (@file_put_contents($temporario, $json, LOCK_EX) !== strlen($json)) {
        @unlink($temporario);
        return 'Não consegui escrever o ficheiro temporário de ' . $nome . '.';
    }

    // Em Windows o rename falha se o destino existir; apagar primeiro deixa
    // uma janela minuscula, mas o .precos-bak cobre-a.
    if (!@rename($temporario, $path)) {
        @unlink($path);
        if (!@rename($temporario, $path)) {
            @unlink($temporario);
            @file_put_contents($path, $actual, LOCK_EX);
            return 'Não consegui substituir ' . $nome . '. O ficheiro original foi reposto.';
        }
    }

    clearstatcache(true, $path);
    $confirmacao = @file_get_contents($path);
    if ($confirmacao === false || json_decode($confirmacao, true) === null) {
        @file_put_contents($path, $actual, LOCK_EX);
        return 'O ficheiro ' . $nome . ' ficou ilegível depois de gravar. Repus a versão anterior e não alterei nada.';
    }

    return '';
}

// ── Custos do material ───────────────────────────────────────────────────────
// O custo por unidade e a margem sao dados comerciais. NAO podem ir para o
// content/pricing.json, que e servido publicamente — qualquer pessoa que abra
// https://miaandpaper.com/content/pricing.json veria as margens do negocio.
// Vivem na pasta privada, ao lado da base de dados, fora da raiz web e fora do
// deploy. O site publico nunca os le; so este editor.
//
// Formato: { "produtos": { "<slug>": { "<tabela>": custoPorUnidadeEmCentimos } } }

function precos_custos_path()
{
    return mp_private_path('custos.json');
}

function precos_ler_custos()
{
    $path = precos_custos_path();
    if ($path === '' || !is_file($path)) {
        return array('produtos' => array());
    }
    $data = json_decode((string)@file_get_contents($path), true);
    if (!is_array($data) || !isset($data['produtos']) || !is_array($data['produtos'])) {
        return array('produtos' => array());
    }
    return $data;
}

function precos_gravar_custos($custos)
{
    $path = precos_custos_path();
    if ($path === '') {
        return 'Não consegui resolver a pasta privada para gravar os custos.';
    }
    $pasta = dirname($path);
    if (!is_dir($pasta) && !@mkdir($pasta, 0700, true) && !is_dir($pasta)) {
        return 'Não consegui criar a pasta privada.';
    }
    $json = json_encode($custos, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || @file_put_contents($path, $json . "\n", LOCK_EX) === false) {
        return 'Não consegui gravar os custos.';
    }
    return '';
}

// ── Preferências do editor ───────────────────────────────────────────────────
// A ordem das tabs é de quem edita, não do site. Fica na pasta privada, ao
// lado dos custos: só há uma pessoa a editar, e assim segue-a de máquina para
// máquina em vez de ficar presa a um browser.

function precos_prefs_path()
{
    return mp_private_path('editor-preferencias.json');
}

function precos_ler_prefs()
{
    $path = precos_prefs_path();
    if ($path === '' || !is_file($path)) {
        return array();
    }
    $data = json_decode((string)@file_get_contents($path), true);
    return is_array($data) ? $data : array();
}

function precos_gravar_prefs($prefs)
{
    $path = precos_prefs_path();
    if ($path === '') {
        return 'Não consegui resolver a pasta privada.';
    }
    $pasta = dirname($path);
    if (!is_dir($pasta) && !@mkdir($pasta, 0700, true) && !is_dir($pasta)) {
        return 'Não consegui criar a pasta privada.';
    }
    $json = json_encode($prefs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || @file_put_contents($path, $json . "\n", LOCK_EX) === false) {
        return 'Não consegui gravar as preferências.';
    }
    return '';
}

// ── Leitura ──────────────────────────────────────────────────────────────────

function precos_recolher()
{
    list($pricing, $pricingRaw, $erro) = precos_ler_json(PRECOS_PRICING_FILE);
    if ($erro !== '') {
        precos_erro($erro, 500);
    }

    $produtos = array();
    foreach (glob(PRECOS_PRODUCTS_DIR . '/*.json') as $path) {
        $nome = basename($path, '.json');
        if (!preg_match('/^[a-z0-9-]+$/', $nome)) {
            continue;
        }

        list($data, $raw, $erroProduto) = precos_ler_json($path);
        if ($erroProduto !== '') {
            precos_erro($erroProduto, 500);
        }

        $coleccoes = array();
        $soltos = array();
        precos_varrer($data, array(), $coleccoes, $soltos, '');

        $registoCentral = isset($pricing['products'][$nome]) ? $pricing['products'][$nome] : null;
        $ehMainV2 = isset($data['catalogContext']) && $data['catalogContext'] === 'main-v2';
        // O construtor da personalizacao nao tem tabela de precos propria: cada
        // linha do carrinho e cobrada pelo slug de destino. Ter registo central
        // seria poluir o pricing.json com um produto que nao se vende.
        $ehConstrutor = $nome === 'personalizacao';

        $produtos[] = array(
            'slug' => $nome,
            'titulo' => isset($data['hero']['title']) ? $data['hero']['title'] : (isset($data['title']) ? $data['title'] : $nome),
            'mainV2' => $ehMainV2,
            'construtor' => $ehConstrutor,
            'revisao' => precos_revisao($raw),
            'coleccoes' => $coleccoes,
            'soltos' => $soltos,
            'variantes' => precos_variantes($data, $registoCentral === null ? array() : $registoCentral),
            'miniatura' => precos_miniatura($data),
            'pricingMode' => isset($data['pricingMode']) ? $data['pricingMode'] : null,
            'allowUnitDiscounts' => isset($data['allowUnitDiscounts']) ? $data['allowUnitDiscounts'] : null,
            'temPassoPack' => precos_passo_pack($data) !== null,
            'temRegistoCentral' => $registoCentral !== null,
            'valido' => !$ehMainV2 || $ehConstrutor || (
                $registoCentral !== null
                && main_v2_pricing_is_valid($registoCentral)
                && main_v2_pricing_modes_agree($data, $registoCentral)
            ),
        );
    }

    // Cápsula do Congresso 2026: só a tabela de preços, e só para comparar e
    // sincronizar. Nada de imagens nem de estrutura — é isso que a regra da
    // cápsula protege.
    $capsula = array();
    $capsulaRevisao = '';
    if (is_file(PRECOS_CAPSULA_FILE)) {
        list($capsulaData, $capsulaRaw, $erroCapsula) = precos_ler_json(PRECOS_CAPSULA_FILE);
        if ($erroCapsula === '') {
            $capsulaRevisao = precos_revisao($capsulaRaw);
            foreach ((array)(isset($capsulaData['products']) ? $capsulaData['products'] : array()) as $slug => $registo) {
                $espelho = isset(PRECOS_CAPSULA_ESPELHO[$slug]) ? PRECOS_CAPSULA_ESPELHO[$slug] : '';
                $catalogo = $espelho !== '' && isset($pricing['products'][$espelho])
                    ? $pricing['products'][$espelho]
                    : null;

                $diferencas = array();
                if ($catalogo !== null) {
                    foreach ((array)(isset($registo['prices']) ? $registo['prices'] : array()) as $pk => $tab) {
                        $doCatalogo = isset($catalogo['prices'][$pk]) ? $catalogo['prices'][$pk] : null;
                        if ($doCatalogo === null) {
                            $diferencas[] = $pk . ': o catálogo não tem esta tabela';
                        } elseif (array_map('intval', (array)$tab) !== array_map('intval', (array)$doCatalogo)) {
                            $diferencas[] = $pk;
                        }
                    }
                }

                $capsula[] = array(
                    'slug' => $slug,
                    'espelho' => $espelho,
                    'prices' => isset($registo['prices']) ? $registo['prices'] : array(),
                    'sincronizado' => $espelho !== '' && $catalogo !== null && empty($diferencas),
                    'diferencas' => $diferencas,
                );
            }
        }
    }

    // PERSONALIZACAO_COBERTURA_V1
    // O catálogo do passo 2 da personalização é uma lista à mão dentro do
    // personalizacao.json — não deriva dos produtos. Criar um produto e
    // esquecer esta lista faz o produto não aparecer na personalização, sem
    // dar erro nenhum (foi o que aconteceu às agendas). Este aviso apanha-o.
    $foraDaPersonalizacao = array();
    $pathPers = PRECOS_PRODUCTS_DIR . '/personalizacao.json';
    if (is_file($pathPers)) {
        list($pers, , $erroPers) = precos_ler_json($pathPers);
        if ($erroPers === '') {
            $noBuilder = array();
            foreach ((array)(isset($pers['steps']) ? $pers['steps'] : array()) as $passo) {
                if (!isset($passo['id']) || $passo['id'] !== 'custom_products') {
                    continue;
                }
                foreach ((array)(isset($passo['products']) ? $passo['products'] : array()) as $entrada) {
                    if (!empty($entrada['slug'])) {
                        $noBuilder[(string)$entrada['slug']] = true;
                    }
                }
            }
            foreach ($produtos as $p) {
                if ($p['mainV2'] && !$p['construtor'] && !isset($noBuilder[$p['slug']])) {
                    $foraDaPersonalizacao[] = $p['slug'];
                }
            }
        }
    }

    $custos = precos_ler_custos();

    return array(
        'ok' => true,
        'foraDaPersonalizacao' => $foraDaPersonalizacao,
        'pricing' => $pricing,
        'pricingRevisao' => precos_revisao($pricingRaw),
        'produtos' => $produtos,
        'capsula' => $capsula,
        'capsulaRevisao' => $capsulaRevisao,
        'delivery' => isset($pricing['delivery']) ? $pricing['delivery'] : array(),
        'ordemTabs' => (function () {
            $prefs = precos_ler_prefs();
            return isset($prefs['ordemTabs']) && is_array($prefs['ordemTabs']) ? $prefs['ordemTabs'] : array();
        })(),
        'custos' => isset($custos['produtos']) ? $custos['produtos'] : array(),
        'custosPrivados' => precos_custos_path() !== '',
        'aberto' => !PRECOS_REQUIRE_ADMIN,
        'csrf' => PRECOS_REQUIRE_ADMIN && !empty($_SESSION['mp_precos_csrf']) ? $_SESSION['mp_precos_csrf'] : '',
    );
}

// ── Cross-check JS ↔ PHP ─────────────────────────────────────────────────────
// Devolve o preco calculado pelo PHP para todas as quantidades pedidas. A
// pagina calcula o mesmo com as funcoes reais de js/10-produto-precos.js e
// compara. E o cross-check que o AGENTS.md exige, automatizado.

function precos_calcular($pricing, $ate)
{
    $resultado = array();
    $ate = max(1, min(1000, (int)$ate));

    foreach ((array)(isset($pricing['products']) ? $pricing['products'] : array()) as $slug => $registo) {
        if (empty($registo['prices']) || !is_array($registo['prices'])) {
            continue;
        }
        foreach ($registo['prices'] as $priceKey => $tabela) {
            if (!is_array($tabela) || empty($tabela)) {
                continue;
            }
            $modo = main_v2_effective_pricing_mode($registo, (string)$priceKey);
            $preferFewer = isset($registo['combinationTieBreakByPriceKey'][$priceKey])
                && (string)$registo['combinationTieBreakByPriceKey'][$priceKey] === 'fewer-packs';

            $valores = array();
            for ($n = 1; $n <= $ate; $n++) {
                if ($modo === 'tier-unit') {
                    $valores[$n] = product_tier_price_cents($tabela, $n);
                } elseif ($modo === 'pack-combination') {
                    $plano = product_pack_combination_plan($tabela, $n, $preferFewer);
                    $valores[$n] = $plano === null ? null : $plano['cents'];
                } else {
                    $valores[$n] = null; // flat-unit e resolvido pela tabela directa
                }
            }

            $resultado[] = array(
                'slug' => (string)$slug,
                'priceKey' => (string)$priceKey,
                'modo' => $modo,
                'preferFewerPacks' => $preferFewer,
                'valores' => $valores,
            );
        }
    }

    return $resultado;
}

// ── Gravacao ─────────────────────────────────────────────────────────────────

function precos_gravar()
{
    $body = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($body)) {
        precos_erro('Pedido inválido.');
    }

    $alteracoes = isset($body['alteracoes']) && is_array($body['alteracoes']) ? $body['alteracoes'] : array();
    if (empty($alteracoes)) {
        precos_erro('Não há nada para gravar.');
    }

    // 1. Carregar tudo o que vai ser tocado, uma vez só.
    list($pricing, $pricingRaw, $erro) = precos_ler_json(PRECOS_PRICING_FILE);
    if ($erro !== '') {
        precos_erro($erro, 500);
    }
    $pricingRevisao = precos_revisao($pricingRaw);
    $pricingMudou = false;

    $produtos = array();       // slug => array('path','data','revisao')
    $custosPendentes = array();   // slug => priceKey => cents
    $capsulaPendente = array();   // slug da capsula => slug do catalogo a copiar

    // Carrega um produto uma vez só e devolve-o por referência.
    $abrir = function ($slug) use (&$produtos) {
        if (!isset($produtos[$slug])) {
            $path = precos_caminho_produto($slug);
            if ($path === '') {
                precos_erro('Produto desconhecido: ' . $slug . '.');
            }
            list($data, $raw, $erroProduto) = precos_ler_json($path);
            if ($erroProduto !== '') {
                precos_erro($erroProduto, 500);
            }
            $produtos[$slug] = array('path' => $path, 'data' => $data, 'revisao' => precos_revisao($raw));
        }
        return $slug;
    };

    foreach ($alteracoes as $alteracao) {
        $op = isset($alteracao['op']) ? (string)$alteracao['op'] : 'valor';
        $ficheiro = isset($alteracao['ficheiro']) ? (string)$alteracao['ficheiro'] : '';
        $trail = isset($alteracao['trail']) && is_array($alteracao['trail']) ? $alteracao['trail'] : array();

        // ── Valor monetário ──────────────────────────────────────────────────
        if ($op === 'valor') {
            $cents = isset($alteracao['cents']) ? $alteracao['cents'] : null;
            if (empty($trail) || !is_numeric($cents)) {
                precos_erro('Alteração inválida: falta o caminho ou o valor.');
            }
            $cents = (int)$cents;
            if ($cents < 0 || $cents > 100000000) {
                precos_erro('Valor fora do intervalo aceite.');
            }

            if ($ficheiro === 'pricing') {
                if (!precos_definir_por_trail($pricing, $trail, $cents)) {
                    precos_erro('Não encontrei ' . implode(' → ', $trail) . ' no pricing.json.');
                }
                $pricingMudou = true;
                continue;
            }
            $abrir($ficheiro);
            if (!precos_definir_por_trail($produtos[$ficheiro]['data'], $trail, $cents)) {
                precos_erro('Não encontrei ' . implode(' → ', $trail) . ' em ' . $ficheiro . '.json.');
            }

            // EXTRAS_CENTRAIS_V1: se o valor editado for um extra com chave no
            // bloco central, a mesma edicao vai ao pricing.json e a todas as
            // outras copias. Sem isto o editor mudava uma copia e o site
            // continuava a cobrar pelo central — exactamente a confusao que
            // este bloco existe para acabar.
            $trailNo = $trail;
            array_pop($trailNo);
            $okNo = false;
            $noEditado = precos_no_por_trail($produtos[$ficheiro]['data'], $trailNo, $okNo);
            $chaveCentral = $okNo ? precos_chave_central($noEditado) : '';

            if ($chaveCentral !== '' && isset($pricing['optionExtras'][$chaveCentral])) {
                if ((int)$pricing['optionExtras'][$chaveCentral] !== $cents) {
                    $pricing['optionExtras'][$chaveCentral] = $cents;
                    $pricingMudou = true;
                }
                foreach (glob(PRECOS_PRODUCTS_DIR . '/*.json') as $outroPath) {
                    $outroSlug = basename($outroPath, '.json');
                    if (!preg_match('/^[a-z0-9-]+$/', $outroSlug)) {
                        continue;
                    }
                    // Um ficheiro que nao tenha esta chave nao chega a ser
                    // aberto: so gravamos o que muda mesmo.
                    $jaAberto = isset($produtos[$outroSlug]);
                    $abrir($outroSlug);
                    $replicadas = precos_replicar_extra($produtos[$outroSlug]['data'], $chaveCentral, $cents);
                    if ($replicadas === 0 && !$jaAberto) {
                        unset($produtos[$outroSlug]);
                    }
                }
            }
            continue;
        }

        // ── Texto (etiquetas dos extras) ─────────────────────────────────────
        if ($op === 'texto') {
            if ($ficheiro === 'pricing') {
                precos_erro('Os textos do pricing.json não se editam aqui.');
            }
            $abrir($ficheiro);
            $erroTexto = precos_definir_texto(
                $produtos[$ficheiro]['data'],
                $trail,
                isset($alteracao['texto']) ? $alteracao['texto'] : ''
            );
            if ($erroTexto !== '') {
                precos_erro($erroTexto);
            }
            continue;
        }

        // ── Linhas de uma colecção (extras, opções, tamanhos) ────────────────
        if ($op === 'linha-adicionar' || $op === 'linha-remover') {
            if ($ficheiro === 'pricing') {
                precos_erro('Para packs usa as operações de pack.');
            }
            $abrir($ficheiro);
            $identidade = '';
            $erroLinha = $op === 'linha-adicionar'
                ? precos_adicionar_linha($produtos[$ficheiro]['data'], $trail, $identidade)
                : precos_remover_linha($produtos[$ficheiro]['data'], $trail);
            if ($erroLinha !== '') {
                precos_erro($erroLinha);
            }
            continue;
        }

        // ── Packs ────────────────────────────────────────────────────────────
        if ($op === 'pack-adicionar' || $op === 'pack-remover' || $op === 'pack-renomear') {
            $slug = isset($alteracao['slug']) ? (string)$alteracao['slug'] : '';
            $priceKey = isset($alteracao['priceKey']) ? (string)$alteracao['priceKey'] : '';
            if ($slug === '' || $priceKey === '') {
                precos_erro('Falta o produto ou a tabela de preços.');
            }

            $ok = false;
            $tabela = &precos_tabela($pricing, $slug, $priceKey, $ok);
            if (!$ok || !is_array($tabela)) {
                precos_erro('Não encontrei a tabela ' . $priceKey . ' de ' . $slug . '.');
            }

            if ($op === 'pack-adicionar') {
                $q = (int)(isset($alteracao['quantidade']) ? $alteracao['quantidade'] : 0);
                $cents = (int)(isset($alteracao['cents']) ? $alteracao['cents'] : 0);
                if ($q < 1 || $q > 100000) {
                    precos_erro('Quantidade de pack inválida.');
                }
                if (array_key_exists((string)$q, $tabela)) {
                    precos_erro('A tabela ' . $priceKey . ' já tem um pack de ' . $q . '.');
                }
                if ($cents < 0 || $cents > 100000000) {
                    precos_erro('Preço de pack fora do intervalo.');
                }
                $tabela[(string)$q] = $cents;
            } elseif ($op === 'pack-remover') {
                $q = (string)(int)(isset($alteracao['quantidade']) ? $alteracao['quantidade'] : 0);
                if (!array_key_exists($q, $tabela)) {
                    precos_erro('A tabela ' . $priceKey . ' não tem um pack de ' . $q . '.');
                }
                if (count($tabela) <= 1) {
                    precos_erro('Não posso remover o último pack de ' . $priceKey . '.');
                }
                unset($tabela[$q]);
            } else {
                $de = (string)(int)(isset($alteracao['de']) ? $alteracao['de'] : 0);
                $para = (int)(isset($alteracao['para']) ? $alteracao['para'] : 0);
                if (!array_key_exists($de, $tabela)) {
                    precos_erro('A tabela ' . $priceKey . ' não tem um pack de ' . $de . '.');
                }
                if ($para < 1 || $para > 100000) {
                    precos_erro('Quantidade de pack inválida.');
                }
                if ((string)$para !== $de && array_key_exists((string)$para, $tabela)) {
                    precos_erro('A tabela ' . $priceKey . ' já tem um pack de ' . $para . '.');
                }
                $cents = $tabela[$de];
                unset($tabela[$de]);
                $tabela[(string)$para] = $cents;
            }

            // Ordena por quantidade, para o ficheiro ficar legível e para o
            // desempate do pack-combination continuar a ver os packs por ordem.
            $ordenada = $tabela;
            uksort($ordenada, function ($a, $b) { return (int)$a - (int)$b; });
            $tabela = $ordenada;
            unset($tabela);
            $pricingMudou = true;

            // Espelha os botões de pack no JSON do produto.
            $registo = isset($pricing['products'][$slug]) ? $pricing['products'][$slug] : array();
            $quantidades = array();
            foreach ((array)(isset($registo['prices']) ? $registo['prices'] : array()) as $tab) {
                foreach ((array)$tab as $q => $_) {
                    $quantidades[(int)$q] = true;
                }
            }
            if (precos_caminho_produto($slug) !== '') {
                $abrir($slug);
                precos_sincronizar_packs(
                    $produtos[$slug]['data'],
                    array_keys($quantidades),
                    isset($registo['unitLabel']) ? $registo['unitLabel'] : 'unidades',
                    isset($registo['unitSingular']) ? $registo['unitSingular'] : 'unidade'
                );
            }
            continue;
        }

        // ── Modo de preço ────────────────────────────────────────────────────
        // Escreve nos TRÊS sítios que têm de concordar: o topo do JSON do
        // produto, o passo `pack` desse JSON, e o pricing.json.
        if ($op === 'modo') {
            $slug = isset($alteracao['slug']) ? (string)$alteracao['slug'] : '';
            $modo = isset($alteracao['pricingMode']) ? (string)$alteracao['pricingMode'] : '';
            if (!in_array($modo, PRECOS_MODOS, true)) {
                precos_erro('Modo de preço desconhecido: ' . $modo . '.');
            }
            $descontos = $modo !== 'flat-unit';

            if (!isset($pricing['products'][$slug])) {
                precos_erro('O produto ' . $slug . ' não tem entrada no pricing.json.');
            }
            $pricing['products'][$slug]['pricingMode'] = $modo;
            $pricing['products'][$slug]['allowUnitDiscounts'] = $descontos;
            $pricingMudou = true;

            $abrir($slug);
            $produtos[$slug]['data']['pricingMode'] = $modo;
            $produtos[$slug]['data']['allowUnitDiscounts'] = $descontos;
            $indicePack = precos_passo_pack($produtos[$slug]['data']);
            if ($indicePack !== null) {
                if (array_key_exists('pricingMode', $produtos[$slug]['data']['steps'][$indicePack])) {
                    $produtos[$slug]['data']['steps'][$indicePack]['pricingMode'] = $modo;
                }
                if (array_key_exists('allowUnitDiscounts', $produtos[$slug]['data']['steps'][$indicePack])) {
                    $produtos[$slug]['data']['steps'][$indicePack]['allowUnitDiscounts'] = $descontos;
                }
            }
            continue;
        }

        // ── Preço de uma variante (purchase-option) ──────────────────────────
        // O mesmo número vive em três sítios e só um deles cobra. Escrevemos
        // nos três de uma vez, senão o editor deixaria mudar um valor que não
        // tem efeito nenhum no que o cliente paga.
        if ($op === 'variante') {
            $slug = isset($alteracao['slug']) ? (string)$alteracao['slug'] : '';
            $valor = isset($alteracao['valor']) ? (string)$alteracao['valor'] : '';
            $cents = isset($alteracao['cents']) ? $alteracao['cents'] : null;
            if ($slug === '' || $valor === '' || !is_numeric($cents)) {
                precos_erro('Variante inválida: falta o produto, a variante ou o valor.');
            }
            $cents = (int)$cents;
            if ($cents < 0 || $cents > 100000000) {
                precos_erro('Preço de variante fora do intervalo.');
            }

            $abrir($slug);
            $indicePack = precos_passo_pack($produtos[$slug]['data']);
            if ($indicePack === null) {
                precos_erro('O produto ' . $slug . ' não tem passo de packs.');
            }

            $encontrado = false;
            $indiceQuantidade = 0;
            foreach ($produtos[$slug]['data']['steps'][$indicePack]['items'] as $i => $item) {
                if (isset($item['value']) && (string)$item['value'] === $valor) {
                    // 1. O que cobra.
                    $produtos[$slug]['data']['steps'][$indicePack]['items'][$i]['priceCents'] = $cents;
                    $indiceQuantidade = isset($item['quantity']) ? (int)$item['quantity'] : 0;
                    $encontrado = true;
                    break;
                }
            }
            if (!$encontrado) {
                precos_erro('Não encontrei a variante ' . $valor . ' em ' . $slug . '.');
            }

            // 2. e 3. Os espelhos em pricing.json, se existirem.
            $priceKey = isset($pricing['products'][$slug]['defaultPriceKey'])
                ? (string)$pricing['products'][$slug]['defaultPriceKey'] : '';
            if ($priceKey !== '' && $indiceQuantidade > 0
                && isset($pricing['products'][$slug]['prices'][$priceKey][(string)$indiceQuantidade])
            ) {
                $pricing['products'][$slug]['prices'][$priceKey][(string)$indiceQuantidade] = $cents;
                $pricingMudou = true;
            }
            if (isset($pricing['products'][$slug]['flatUnitPricesCents'][$valor])) {
                $pricing['products'][$slug]['flatUnitPricesCents'][$valor] = $cents;
                $pricingMudou = true;
            }
            continue;
        }

        // ── Custo do material ────────────────────────────────────────────────
        if ($op === 'custo') {
            $slug = isset($alteracao['slug']) ? (string)$alteracao['slug'] : '';
            $priceKey = isset($alteracao['priceKey']) ? (string)$alteracao['priceKey'] : '';
            $cents = isset($alteracao['cents']) ? $alteracao['cents'] : null;
            if ($slug === '' || $priceKey === '' || !is_numeric($cents)) {
                precos_erro('Custo inválido: falta o produto, a tabela ou o valor.');
            }
            $cents = (int)$cents;
            if ($cents < 0 || $cents > 100000000) {
                precos_erro('Custo fora do intervalo aceite.');
            }
            $custosPendentes[$slug][$priceKey] = $cents;
            continue;
        }

        // ── Sincronizar a cápsula com o catálogo ─────────────────────────────
        if ($op === 'capsula-sincronizar') {
            $slug = isset($alteracao['slug']) ? (string)$alteracao['slug'] : '';
            if (!isset(PRECOS_CAPSULA_ESPELHO[$slug])) {
                precos_erro('A cápsula não tem um espelho definido para ' . $slug . '.');
            }
            $espelho = PRECOS_CAPSULA_ESPELHO[$slug];
            if (!isset($pricing['products'][$espelho]['prices'])) {
                precos_erro('O catálogo não tem preços para ' . $espelho . '.');
            }
            $capsulaPendente[$slug] = $espelho;
            continue;
        }

        precos_erro('Operação desconhecida: ' . $op . '.');
    }

    // 2. Validar ANTES de escrever seja o que for. Esta e a razao de existir
    //    desta API: hoje uma incoerencia entre os dois ficheiros so aparece no
    //    checkout, em silencio para o cliente.
    $problemas = precos_validar($pricing, $produtos);
    if (!empty($problemas)) {
        precos_responder(array(
            'ok' => false,
            'erro' => 'Gravação recusada: a configuração ficaria inválida.',
            'problemas' => $problemas,
        ), 422);
    }

    // 3. Escrever. O pricing.json primeiro; se falhar, nada mais e tocado.
    if ($pricingMudou) {
        $erroEscrita = precos_gravar_json(PRECOS_PRICING_FILE, $pricing, $pricingRevisao);
        if ($erroEscrita !== '') {
            precos_erro($erroEscrita, 409);
        }
    }

    $gravados = array();
    foreach ($produtos as $slug => $info) {
        $erroEscrita = precos_gravar_json($info['path'], $info['data'], $info['revisao']);
        if ($erroEscrita !== '') {
            precos_responder(array(
                'ok' => false,
                'erro' => $erroEscrita,
                'gravadosAntes' => $gravados,
                'aviso' => 'Alguns ficheiros já tinham sido gravados. Recarrega a página para ver o estado real.',
            ), 409);
        }
        $gravados[] = $slug;
    }

    // Cápsula: copia as tabelas do produto do catálogo que a espelha. Só as
    // tabelas que existem nos dois — nunca acrescenta nem remove tabelas, para
    // não inventar um tamanho que a cápsula nunca vendeu.
    if (!empty($capsulaPendente)) {
        list($capsulaData, $capsulaRaw, $erroCapsula) = precos_ler_json(PRECOS_CAPSULA_FILE);
        if ($erroCapsula !== '') {
            precos_erro($erroCapsula, 500);
        }
        $copiadas = 0;
        foreach ($capsulaPendente as $slug => $espelho) {
            if (!isset($capsulaData['products'][$slug]['prices'])) {
                continue;
            }
            foreach ($capsulaData['products'][$slug]['prices'] as $pk => $_) {
                if (isset($pricing['products'][$espelho]['prices'][$pk])) {
                    $capsulaData['products'][$slug]['prices'][$pk] = $pricing['products'][$espelho]['prices'][$pk];
                    $copiadas++;
                }
            }
        }
        if ($copiadas > 0) {
            $erroEscrita = precos_gravar_json(PRECOS_CAPSULA_FILE, $capsulaData, precos_revisao($capsulaRaw));
            if ($erroEscrita !== '') {
                precos_erro($erroEscrita, 409);
            }
            $gravados[] = 'congressos/2026';
        }
    }

    // Custos por último: vivem fora da raiz web e não afectam o site.
    if (!empty($custosPendentes)) {
        $custos = precos_ler_custos();
        foreach ($custosPendentes as $slug => $tabelas) {
            foreach ($tabelas as $pk => $cents) {
                if ($cents === 0) {
                    unset($custos['produtos'][$slug][$pk]);
                } else {
                    $custos['produtos'][$slug][$pk] = $cents;
                }
            }
            if (empty($custos['produtos'][$slug])) {
                unset($custos['produtos'][$slug]);
            }
        }
        $erroCustos = precos_gravar_custos($custos);
        if ($erroCustos !== '') {
            precos_erro($erroCustos, 500);
        }
        $gravados[] = 'custos';
    }

    precos_responder(array_merge(array('ok' => true, 'gravados' => $gravados), precos_recolher()));
}

// Corre a validacao real sobre o estado que FICARIA gravado. Os produtos que
// nao foram tocados sao lidos do disco, para uma alteracao no pricing.json nao
// poder partir um produto que nem foi aberto.
function precos_validar($pricing, $produtosTocados)
{
    $problemas = array();

    foreach (glob(PRECOS_PRODUCTS_DIR . '/*.json') as $path) {
        $slug = basename($path, '.json');
        if (!preg_match('/^[a-z0-9-]+$/', $slug)) {
            continue;
        }

        if (isset($produtosTocados[$slug])) {
            $data = $produtosTocados[$slug]['data'];
        } else {
            list($data, , $erroProduto) = precos_ler_json($path);
            if ($erroProduto !== '') {
                $problemas[] = $erroProduto;
                continue;
            }
        }

        if (!isset($data['catalogContext']) || $data['catalogContext'] !== 'main-v2') {
            continue;
        }

        // O construtor da personalizacao nao tem tabela propria; nao e erro.
        if ($slug === 'personalizacao') {
            continue;
        }

        $registo = isset($pricing['products'][$slug]) ? $pricing['products'][$slug] : null;
        if ($registo === null) {
            $problemas[] = $slug . ': não tem entrada no pricing.json.';
            continue;
        }
        if (!main_v2_pricing_is_valid($registo)) {
            $problemas[] = $slug . ': o modo de preço e o allowUnitDiscounts do pricing.json não são coerentes.';
        }
        if (!main_v2_pricing_modes_agree($data, $registo)) {
            $problemas[] = $slug . ': o modo de preço do JSON do produto não coincide com o do pricing.json.';
        }
        foreach ((array)(isset($registo['prices']) ? $registo['prices'] : array()) as $priceKey => $tabela) {
            foreach ((array)$tabela as $quantidade => $cents) {
                if ((int)$cents < 0) {
                    $problemas[] = $slug . ' / ' . $priceKey . ': o preço de ' . $quantidade . ' é negativo.';
                }
            }
        }
    }

    return $problemas;
}

// ── Router ───────────────────────────────────────────────────────────────────

precos_exigir_admin();

$action = isset($_GET['action']) ? (string)$_GET['action'] : 'data';

if ($action === 'data') {
    precos_responder(precos_recolher());
}

if ($action === 'calcular') {
    list($pricing, , $erro) = precos_ler_json(PRECOS_PRICING_FILE);
    if ($erro !== '') {
        precos_erro($erro, 500);
    }
    $ate = isset($_GET['ate']) ? (int)$_GET['ate'] : 500;
    precos_responder(array('ok' => true, 'tabelas' => precos_calcular($pricing, $ate), 'ate' => $ate));
}

if ($action === 'ordem-tabs') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        precos_erro('Usa POST.', 405);
    }
    $body = json_decode((string)file_get_contents('php://input'), true);
    $ordem = is_array($body) && isset($body['ordem']) && is_array($body['ordem']) ? $body['ordem'] : null;
    if ($ordem === null) {
        precos_erro('Falta a ordem.');
    }
    $limpa = array();
    foreach ($ordem as $slug) {
        $slug = (string)$slug;
        if ($slug === '__capsula__' || preg_match('/^[a-z0-9-]+$/', $slug)) {
            $limpa[] = $slug;
        }
    }
    $prefs = precos_ler_prefs();
    $prefs['ordemTabs'] = $limpa;
    $erro = precos_gravar_prefs($prefs);
    if ($erro !== '') {
        precos_erro($erro, 500);
    }
    precos_responder(array('ok' => true, 'ordemTabs' => $limpa));
}

if ($action === 'save') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        precos_erro('Usa POST para gravar.', 405);
    }
    precos_gravar();
}

precos_erro('Acção desconhecida.', 404);
