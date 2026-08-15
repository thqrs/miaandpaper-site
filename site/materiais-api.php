<?php
// MATERIAIS_API_V1
// Backend da página dos materiais (materiais.php): calcular o custo real de uma
// unidade de cada produto.
//
// Guarda em private/materiais.json, fora da raiz web, pelo mesmo motivo que os
// custos: são as margens do negócio e o content/ é servido publicamente.
//
// O resultado não fica aqui parado — o botão "enviar para os preços" escreve o
// custo por unidade no private/custos.json, que é de onde o precos.php tira o
// lucro por linha e a linha do custo no gráfico. Sem isso, o custo passava a
// existir em dois sítios com hipótese de discordarem.

declare(strict_types=0);

// ADMIN_OPEN_DEV_V1 é a única configuração: em desenvolvimento pode abrir os
// editores; com MIA_ADMIN_OPEN=false esta API exige sempre sessão de admin.
require_once __DIR__ . '/admin-open.php';
define('MATERIAIS_REQUIRE_ADMIN', !MIA_ADMIN_OPEN);

require_once __DIR__ . '/lib/private-paths.php';
require_once __DIR__ . '/lib/pedido.php';   // COMANDOS_V1: a API tambem se chama de dentro

// COMANDOS_V1: em modo embutido quem manda nos cabecalhos e a pagina que
// incluiu esta API.
if (!mp_modo_embutido()) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
}

function mat_responder($payload, $status = 200)
{
    if (mp_modo_embutido()) {
        mp_responder_embutido($payload, $status);
    }
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function mat_erro($mensagem, $status = 400)
{
    if (mp_modo_embutido()) {
        mp_responder_embutido(array('ok' => false, 'erro' => $mensagem), $status);
    }
    mat_responder(array('ok' => false, 'erro' => $mensagem), $status);
}

function mat_exigir_admin()
{
    if (!MATERIAIS_REQUIRE_ADMIN) {
        return;
    }
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    if (empty($_SESSION['miaandpaper_admin'])) {
        mat_erro('Precisas de sessão de administradora.', 403);
    }
}

// ── Ficheiro ─────────────────────────────────────────────────────────────────

function mat_path()
{
    $p = mp_private_path('materiais.json');
    return $p === null ? '' : $p;
}

function mat_vazio()
{
    return array('custoHoraCents' => 0, 'materiais' => array(), 'produtos' => array());
}

function mat_ler()
{
    $path = mat_path();
    if ($path === '' || !is_file($path)) {
        return mat_vazio();
    }
    $data = json_decode((string)@file_get_contents($path), true);
    if (!is_array($data)) {
        return mat_vazio();
    }
    return array(
        'custoHoraCents' => max(0, (int)(isset($data['custoHoraCents']) ? $data['custoHoraCents'] : 0)),
        'materiais' => isset($data['materiais']) && is_array($data['materiais']) ? $data['materiais'] : array(),
        'produtos' => isset($data['produtos']) && is_array($data['produtos']) ? $data['produtos'] : array(),
    );
}

function mat_gravar($data)
{
    $path = mat_path();
    if ($path === '') {
        return 'Não consegui resolver a pasta privada.';
    }
    $pasta = dirname($path);
    if (!is_dir($pasta) && !@mkdir($pasta, 0700, true) && !is_dir($pasta)) {
        return 'Não consegui criar a pasta privada.';
    }
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return 'Não consegui serializar os materiais.';
    }
    // Escrita atómica, como nos outros editores: um ficheiro a meio é pior do
    // que um ficheiro velho.
    $tmp = $path . '.mat-tmp';
    if (@file_put_contents($tmp, $json . "\n", LOCK_EX) === false) {
        return 'Não consegui escrever o ficheiro temporário.';
    }
    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        return 'Não consegui substituir o materiais.json.';
    }
    return '';
}

// ── Cálculo ──────────────────────────────────────────────────────────────────

// O rendimento aceita uma multiplicação — "100*10*10" — porque é assim que se
// pensa nestas coisas ("100 cortes de 10 folhas, 10 crachás por folha") e obrigar
// a fazer a conta de cabeça é onde se erra. Só decimais finitos, ponto, x e *.
const MAT_MAX_RENDIMENTO = 100000000;
function mat_rendimento($expressao)
{
    $limpo = str_replace(array(' ', ','), array('', '.'), (string)$expressao);
    $limpo = str_replace(array('x', 'X', '×'), '*', $limpo);

    if ($limpo === '' || !preg_match('/^(?:\d+(?:\.\d+)?|\.\d+)(?:\*(?:\d+(?:\.\d+)?|\.\d+))*$/D', $limpo)) {
        return 0.0;
    }
    $total = 1.0;
    foreach (explode('*', $limpo) as $parte) {
        $n = (float)$parte;
        if (!is_finite($n) || $n <= 0 || $n > MAT_MAX_RENDIMENTO) {
            return 0.0;
        }
        $total *= $n;
        if (!is_finite($total) || $total > MAT_MAX_RENDIMENTO) {
            return 0.0;
        }
    }
    return $total;
}

function mat_exigir_csrf()
{
    $sent = isset($_SERVER['HTTP_X_ADMIN_CSRF']) ? (string)$_SERVER['HTTP_X_ADMIN_CSRF'] : '';
    if (!mp_admin_csrf_is_valid($sent)) {
        mat_erro('Pedido bloqueado por CSRF. Recarrega o editor.', 403);
    }
}

function mat_material($data, $id)
{
    foreach ($data['materiais'] as $m) {
        if (is_array($m) && isset($m['id']) && (string)$m['id'] === (string)$id) {
            return $m;
        }
    }
    return null;
}

// Custo de UMA unidade do material (uma folha, uma lâmina, um crachá em bruto),
// já com os estragos por cima.
function mat_custo_unidade_material($material)
{
    $quantidade = (float)(isset($material['quantidade']) ? $material['quantidade'] : 0);
    $preco = (float)(isset($material['precoCents']) ? $material['precoCents'] : 0);
    $estragos = max(0.0, min(90.0, (float)(isset($material['estragosPercent']) ? $material['estragosPercent'] : 0)));

    if ($quantidade <= 0) {
        return 0.0;
    }
    return ($preco / $quantidade) * (1 + $estragos / 100);
}

// Custo por unidade de produto de cada linha, e o total.
function mat_calcular($data, $chave)
{
    $produto = isset($data['produtos'][$chave]) && is_array($data['produtos'][$chave])
        ? $data['produtos'][$chave]
        : array();
    $minutos = max(0.0, (float)(isset($produto['minutosPorUnidade']) ? $produto['minutosPorUnidade'] : 0));
    $custoHora = max(0, (int)$data['custoHoraCents']);
    $linhas = array();
    $materiaisCents = 0.0;

    foreach ((isset($produto['linhas']) && is_array($produto['linhas']) ? $produto['linhas'] : array()) as $linha) {
        if (!is_array($linha)) {
            continue;
        }
        $material = mat_material($data, isset($linha['materialId']) ? $linha['materialId'] : '');
        $rendimento = mat_rendimento(isset($linha['rendimento']) ? $linha['rendimento'] : '');
        $porUnidade = 0.0;

        if ($material !== null && $rendimento > 0) {
            $porUnidade = mat_custo_unidade_material($material) / $rendimento;
        }
        $materiaisCents += $porUnidade;
        $linhas[] = array(
            'materialId' => isset($linha['materialId']) ? (string)$linha['materialId'] : '',
            'nome' => $material !== null && isset($material['nome']) ? (string)$material['nome'] : '(material apagado)',
            'existe' => $material !== null,
            'rendimento' => isset($linha['rendimento']) ? (string)$linha['rendimento'] : '',
            'rendimentoResolvido' => $rendimento,
            'nota' => isset($linha['nota']) ? (string)$linha['nota'] : '',
            'custoMaterialCents' => $material !== null ? mat_custo_unidade_material($material) : 0.0,
            'porUnidadeCents' => $porUnidade,
        );
    }

    $maoDeObraCents = $custoHora > 0 && $minutos > 0 ? ($custoHora * $minutos / 60) : 0.0;

    return array(
        'minutosPorUnidade' => $minutos,
        'linhas' => $linhas,
        'materiaisCents' => $materiaisCents,
        'maoDeObraCents' => $maoDeObraCents,
        'totalCents' => $materiaisCents + $maoDeObraCents,
    );
}

// ── Catálogo de produtos ─────────────────────────────────────────────────────
// Os separadores são as tabelas de preços do pricing.json, para baterem certo
// com as do precos.php — é para lá que o custo vai.

function mat_catalogo()
{
    $raw = @file_get_contents(__DIR__ . '/content/pricing.json');
    $pricing = $raw === false ? null : json_decode($raw, true);
    $lista = array();

    if (!is_array($pricing) || empty($pricing['products'])) {
        return $lista;
    }
    foreach ($pricing['products'] as $slug => $produto) {
        if (!is_array($produto) || empty($produto['prices']) || !is_array($produto['prices'])) {
            continue;
        }
        foreach ($produto['prices'] as $priceKey => $tabela) {
            $primeiraQuantidade = 0;
            $primeiroTotalCents = 0;
            foreach ((array)$tabela as $quantidade => $totalCents) {
                $q = (int)$quantidade;
                if ($q > 0 && ($primeiraQuantidade === 0 || $q < $primeiraQuantidade)) {
                    $primeiraQuantidade = $q;
                    $primeiroTotalCents = (int)$totalCents;
                }
            }
            $precoUnidadeCents = $primeiraQuantidade > 0
                ? $primeiroTotalCents / $primeiraQuantidade
                : 0;
            $lista[] = array(
                'chave' => $slug . '::' . $priceKey,
                'slug' => (string)$slug,
                'priceKey' => (string)$priceKey,
                'etiqueta' => (isset($produto['label']) ? (string)$produto['label'] : (string)$slug) . ' · ' . $priceKey,
                'unidade' => isset($produto['unitSingular']) ? (string)$produto['unitSingular'] : 'unidade',
                // Referência comparável por unidade. Quando não há escalão 1,
                // usa o unitário do menor escalão em vez de inventar 0 €.
                'precoUnidadeCents' => $precoUnidadeCents,
                'primeiroEscalaoQuantidade' => $primeiraQuantidade,
                'primeiroEscalaoTotalCents' => $primeiroTotalCents,
            );
        }
    }
    return $lista;
}

// ── Custos do precos.php ─────────────────────────────────────────────────────

function mat_custos_path()
{
    $p = mp_private_path('custos.json');
    return $p === null ? '' : $p;
}

function mat_ler_custos()
{
    $path = mat_custos_path();
    if ($path === '' || !is_file($path)) {
        return array('produtos' => array());
    }
    $data = json_decode((string)@file_get_contents($path), true);
    if (!is_array($data) || !isset($data['produtos']) || !is_array($data['produtos'])) {
        return array('produtos' => array());
    }
    return $data;
}

function mat_gravar_custos($custos)
{
    $path = mat_custos_path();
    if ($path === '') {
        return 'Não consegui resolver a pasta privada.';
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

// ── Leitura ──────────────────────────────────────────────────────────────────

function mat_recolher()
{
    $data = mat_ler();
    $custos = mat_ler_custos();
    $catalogo = mat_catalogo();
    $calculos = array();

    foreach ($catalogo as $i => $entrada) {
        $calculo = mat_calcular($data, $entrada['chave']);
        $calculos[$entrada['chave']] = $calculo;
        // O que o precos.php tem gravado hoje, para se ver se está em dia.
        $catalogo[$i]['custoNosPrecosCents'] = isset($custos['produtos'][$entrada['slug']][$entrada['priceKey']])
            ? (int)$custos['produtos'][$entrada['slug']][$entrada['priceKey']]
            : null;
    }

    return array(
        'ok' => true,
        'custoHoraCents' => $data['custoHoraCents'],
        'materiais' => $data['materiais'],
        'produtos' => $data['produtos'],
        'catalogo' => $catalogo,
        'calculos' => $calculos,
        'aberto' => !MATERIAIS_REQUIRE_ADMIN,
        'csrf' => mp_admin_csrf_token(),
    );
}

// ── Gravação ─────────────────────────────────────────────────────────────────

function mat_texto($valor, $max = 160)
{
    $texto = trim((string)$valor);
    $texto = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $texto);
    // O mbstring não está garantido (localmente está desligado), e cortar com
    // substr a meio de um acento deixava bytes inválidos no JSON.
    if (function_exists('mb_substr')) {
        return mb_substr($texto, 0, $max, 'UTF-8');
    }
    return preg_replace('/^(.{0,' . (int)$max . '}).*$/us', '$1', $texto);
}

function mat_gravar_pedido()
{
    $body = mp_corpo_pedido();
    if (!is_array($body) || empty($body['alteracoes']) || !is_array($body['alteracoes'])) {
        mat_erro('Não há nada para gravar.');
    }

    $data = mat_ler();
    $enviarParaPrecos = array();

    foreach ($body['alteracoes'] as $a) {
        $op = isset($a['op']) ? (string)$a['op'] : '';

        if ($op === 'custo-hora') {
            $data['custoHoraCents'] = max(0, min(100000000, (int)(isset($a['valor']) ? $a['valor'] : 0)));
            continue;
        }

        // ESTADO_COMPLETO_V1: o catálogo e cada produto viajam inteiros, não em
        // operações de índice. Com índices, remover duas linhas na mesma gravação
        // apagava a errada — a segunda já contava com a primeira fora. Assim a
        // página mostra a alteração no momento e o que se grava é o que se vê.
        if ($op === 'materiais-definir') {
            $lista = isset($a['materiais']) && is_array($a['materiais']) ? $a['materiais'] : array();
            $materiais = array();
            $vistos = array();

            foreach ($lista as $m) {
                if (!is_array($m)) {
                    continue;
                }
                $id = isset($m['id']) ? (string)$m['id'] : '';
                if ($id === '' || !preg_match('/^m[a-z0-9]{4,20}$/', $id) || isset($vistos[$id])) {
                    $id = 'm' . substr(bin2hex(random_bytes(6)), 0, 10);
                }
                $vistos[$id] = true;
                $materiais[] = array(
                    'id' => $id,
                    'nome' => mat_texto(isset($m['nome']) ? $m['nome'] : 'Material novo'),
                    'quantidade' => max(0, min(10000000, (float)(isset($m['quantidade']) ? $m['quantidade'] : 0))),
                    'unidade' => mat_texto(isset($m['unidade']) ? $m['unidade'] : '', 40),
                    'precoCents' => max(0, min(100000000, (int)round((float)(isset($m['precoCents']) ? $m['precoCents'] : 0)))),
                    'estragosPercent' => max(0, min(90, (float)(isset($m['estragosPercent']) ? $m['estragosPercent'] : 0))),
                    'nota' => mat_texto(isset($m['nota']) ? $m['nota'] : ''),
                );
            }
            $data['materiais'] = $materiais;

            // Um material que saiu do catálogo tem de sair dos produtos, senão
            // ficavam linhas a apontar para coisa nenhuma.
            foreach ($data['produtos'] as $chave => $produto) {
                if (!isset($produto['linhas']) || !is_array($produto['linhas'])) {
                    continue;
                }
                $linhas = array();
                foreach ($produto['linhas'] as $linha) {
                    if (is_array($linha) && mat_material($data, isset($linha['materialId']) ? $linha['materialId'] : '') !== null) {
                        $linhas[] = $linha;
                    }
                }
                $data['produtos'][$chave]['linhas'] = $linhas;
            }
            continue;
        }

        if ($op === 'produto-definir') {
            $chave = (string)(isset($a['produto']) ? $a['produto'] : '');
            if ($chave === '') {
                mat_erro('Operação sem produto.');
            }
            $linhas = array();
            foreach ((isset($a['linhas']) && is_array($a['linhas']) ? $a['linhas'] : array()) as $linha) {
                if (!is_array($linha)) {
                    continue;
                }
                $materialId = (string)(isset($linha['materialId']) ? $linha['materialId'] : '');
                if (mat_material($data, $materialId) === null) {
                    continue;
                }
                $rendimento = mat_texto(isset($linha['rendimento']) ? $linha['rendimento'] : '1', 60);
                if ($rendimento !== '' && mat_rendimento($rendimento) <= 0) {
                    mat_erro('"' . $rendimento . '" não é um número nem uma multiplicação (ex.: 100*10*10).');
                }
                $linhas[] = array(
                    'materialId' => $materialId,
                    'rendimento' => $rendimento,
                    'nota' => mat_texto(isset($linha['nota']) ? $linha['nota'] : ''),
                );
            }
            $data['produtos'][$chave] = array(
                'minutosPorUnidade' => max(0, min(10000, (float)(isset($a['minutosPorUnidade']) ? $a['minutosPorUnidade'] : 0))),
                'linhas' => $linhas,
            );
            continue;
        }

        if ($op === 'enviar-para-precos') {
            $chave = (string)(isset($a['produto']) ? $a['produto'] : '');
            if ($chave === '') {
                mat_erro('Operação sem produto.');
            }
            $enviarParaPrecos[] = $chave;
            continue;
        }

        mat_erro('Operação desconhecida: ' . $op . '.');
    }

    $erro = mat_gravar($data);
    if ($erro !== '') {
        mat_erro($erro, 500);
    }

    // Só depois de os materiais estarem gravados é que o custo vai para o
    // precos.php: assim o número que lá fica corresponde sempre a contas que
    // existem mesmo neste ficheiro.
    if ($enviarParaPrecos) {
        $custos = mat_ler_custos();
        foreach ($enviarParaPrecos as $chave) {
            $partes = explode('::', $chave, 2);
            if (count($partes) !== 2) {
                continue;
            }
            $calculo = mat_calcular($data, $chave);
            if ($calculo['totalCents'] <= 0) {
                mat_erro('O custo de "' . $chave . '" ainda é zero: não há nada para enviar.');
            }
            $custos['produtos'][$partes[0]][$partes[1]] = (int)round($calculo['totalCents']);
        }
        $erroCustos = mat_gravar_custos($custos);
        if ($erroCustos !== '') {
            mat_erro($erroCustos, 500);
        }
    }

    mat_responder(mat_recolher());
}

// ── Router ───────────────────────────────────────────────────────────────────

mat_exigir_admin();
// COMANDOS_V1: incluida so pelas funcoes. Sem router, sem guarda, sem resposta.
if (mp_modo_embutido()) {
    return;
}

$action = isset($_GET['action']) ? (string)$_GET['action'] : 'data';

// PARAMETROS_V1: esquema desta API, na forma do manifesto geral.
if ($action === 'parametros') {
    require_once __DIR__ . '/lib/parametros.php';
    mat_responder(array('ok' => true, 'recurso' => mp_parametros_manifesto_recurso('materiais-api.php')));
}

if ($action === 'data') {
    mat_responder(mat_recolher());
}

if ($action === 'save') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        mat_erro('Usa POST para gravar.', 405);
    }
    mat_exigir_csrf();
    mat_gravar_pedido();
}

mat_erro('Acção desconhecida.', 404);
