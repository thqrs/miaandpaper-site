<?php
/**
 * lib/comandos.php — COMANDOS_V1
 *
 * O vocabulário de alterações que cabem num link.
 *
 * ── Porquê ──────────────────────────────────────────────────────────────────
 *
 * Uma factura chega em papel. Alguém tem de a transformar em materiais no
 * site, com preço, unidade e estragos. Fazê-lo à mão no editor é meia hora;
 * pedir a um modelo de linguagem que leia a factura e devolva **links** é um
 * minuto — desde que exista um vocabulário fixo que ele consiga escrever sem
 * ver o código.
 *
 * É isso que está aqui: cada operação declara o que aceita, e o `comando.php`
 * pega num link, mostra o que vai mudar, e grava.
 *
 * ── O que este ficheiro NÃO faz ─────────────────────────────────────────────
 *
 * Não escreve ficheiros. Cada operação traduz-se nas operações nativas que os
 * editores já usam (`precos-api.php`, `materiais-api.php`, …) e é essa API,
 * incluída via `lib/pedido.php`, que valida e grava. Uma regra de negócio
 * escrita aqui seria uma segunda opinião sobre o que é um desconto válido — e
 * duas opiniões acabam sempre a discordar.
 *
 * Cada operação tem duas metades:
 *
 *   `prever`  — lê o estado actual e devolve as linhas «isto passa a ser isto»
 *   `traduzir` — devolve as operações nativas a entregar à API
 *
 * A primeira é o que se vê antes de confirmar; a segunda é o que grava.
 */

require_once __DIR__ . '/pedido.php';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Carregar as APIs, uma vez cada
// ─────────────────────────────────────────────────────────────────────────────

function cmd_api($nome)
{
    static $carregadas = array();
    if (isset($carregadas[$nome])) {
        return;
    }

    // `require` dentro de uma função herda o âmbito local. A galeria declara
    // estes quatro valores para as suas próprias funções globais; declará-los
    // aqui como globais conserva exactamente o mesmo âmbito que a API tem
    // quando é servida por HTTP.
    global $GALERIA_LIBRARY_DIRS, $GALERIA_IMAGE_EXTENSIONS,
        $GALERIA_DIMENSIONS, $GALERIA_DIMENSIONS_DIRTY;

    if (!defined('MP_API_EMBUTIDA')) {
        define('MP_API_EMBUTIDA', true);
    }
    require_once __DIR__ . '/../' . $nome . '-api.php';
    $carregadas[$nome] = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Ajudas de leitura de argumentos
// ─────────────────────────────────────────────────────────────────────────────

class CmdErro extends Exception
{
}

function cmd_erro($mensagem)
{
    throw new CmdErro($mensagem);
}

function cmd_texto(array $args, $nome, $omissao = null)
{
    if (!isset($args[$nome]) || $args[$nome] === '') {
        if ($omissao === null) {
            cmd_erro('Falta o parâmetro `' . $nome . '`.');
        }
        return $omissao;
    }
    return trim((string)$args[$nome]);
}

function cmd_numero(array $args, $nome, $omissao = null)
{
    $valor = cmd_texto($args, $nome, $omissao === null ? null : (string)$omissao);
    $valor = str_replace(array(' ', "\xc2\xa0"), '', (string)$valor);
    $valor = str_replace(',', '.', $valor);
    // `is_numeric()` aceita expoentes que podem transbordar para INF. Além de
    // não serem úteis num URL de administração, acabavam por ser convertidos
    // pelas APIs para outro valor (por vezes zero). Aceitamos só decimais
    // finitos, com vírgula ou ponto, e aplicamos os limites de cada operação
    // antes de mostrar o preview.
    if (!preg_match('/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/D', $valor)) {
        cmd_erro('`' . $nome . '` tem de ser um número decimal finito — recebi "' . $valor . '".');
    }
    $numero = (float)$valor;
    if (!is_finite($numero)) {
        cmd_erro('`' . $nome . '` tem de ser um número finito.');
    }
    return $numero;
}

/** Número finito dentro do intervalo que a API correspondente aceita. */
function cmd_numero_intervalo(array $args, $nome, $minimo, $maximo, $omissao = null)
{
    $numero = cmd_numero($args, $nome, $omissao);
    if ($numero < $minimo || $numero > $maximo) {
        cmd_erro('`' . $nome . '` tem de estar entre ' . $minimo . ' e ' . $maximo . '.');
    }
    return $numero;
}

/** Inteiro dentro do intervalo. Nunca deixa a API truncar decimais no apply. */
function cmd_inteiro_intervalo(array $args, $nome, $minimo, $maximo, $omissao = null)
{
    $numero = cmd_numero_intervalo($args, $nome, $minimo, $maximo, $omissao);
    if (floor($numero) !== $numero) {
        cmd_erro('`' . $nome . '` tem de ser um número inteiro.');
    }
    return (int)$numero;
}

function cmd_booleano(array $args, $nome, $omissao = null)
{
    if (!isset($args[$nome]) || $args[$nome] === '') {
        if ($omissao === null) {
            cmd_erro('Falta o parâmetro `' . $nome . '` (usa 1 ou 0).');
        }
        return (bool)$omissao;
    }
    $valor = strtolower(trim((string)$args[$nome]));
    if (in_array($valor, array('1', 'true', 'sim', 'on'), true)) {
        return true;
    }
    if (in_array($valor, array('0', 'false', 'nao', 'não', 'off'), true)) {
        return false;
    }
    cmd_erro('`' . $nome . '` tem de ser 1 ou 0.');
}

function cmd_enum(array $args, $nome, array $valores, $omissao = null)
{
    $valor = cmd_texto($args, $nome, $omissao);
    if (!in_array($valor, $valores, true)) {
        cmd_erro('`' . $nome . '` tem de ser um de: ' . implode(', ', $valores) . '.');
    }
    return $valor;
}

/** Lista curta em CSV, para não obrigar um LLM a inventar arrays de query. */
function cmd_csv(array $args, $nome, $obrigatorio = true)
{
    $valor = cmd_texto($args, $nome, $obrigatorio ? null : '');
    $lista = array_values(array_filter(array_map('trim', explode(',', $valor)), function ($item) {
        return $item !== '';
    }));
    if ($obrigatorio && !$lista) {
        cmd_erro('`' . $nome . '` não trazia nenhum valor.');
    }
    return $lista;
}

/** Destino do custo de materiais: aceita `produto::tabela` por compatibilidade
 * e a forma clara `produto=…&chave=…` para links novos. */
function cmd_custo_destino(array $args)
{
    $produto = cmd_texto($args, 'produto');
    $chave = cmd_texto($args, 'chave', '');
    if (strpos($produto, '::') !== false) {
        if ($chave !== '') {
            cmd_erro('Usa a tabela em `chave`, ou dentro de `produto`, mas não nas duas formas.');
        }
        $partes = explode('::', $produto, 2);
        if ($partes[0] === '' || $partes[1] === '') {
            cmd_erro('O destino tem de ser `produto::tabela`.');
        }
        return $produto;
    }
    if ($chave === '') {
        cmd_erro('Falta `chave`: indica a tabela de preços que deve receber este custo.');
    }
    return $produto . '::' . $chave;
}

/** Constrói a carga completa que `ordem-menu` pede, a partir de um gesto curto. */
function cmd_menu_mover(array $args)
{
    $cartao = cmd_texto($args, 'cartao');
    $grupoDestino = cmd_texto($args, 'grupo');
    $antesDe = cmd_texto($args, 'antes', '');
    $estado = cmd_estado('home');
    $porGrupo = array();
    $ordemGrupos = array();
    $encontrado = false;
    foreach ((array)$estado['categories'] as $categoria) {
        $id = isset($categoria['id']) ? (string)$categoria['id'] : '';
        if ($id === '') continue;
        $grupo = isset($categoria['menuGroup']) && trim((string)$categoria['menuGroup']) !== ''
            ? trim((string)$categoria['menuGroup']) : 'Outros';
        $ordem = isset($categoria['menuGroupOrder']) ? (int)$categoria['menuGroupOrder'] : 999;
        if (!isset($porGrupo[$grupo])) {
            $porGrupo[$grupo] = array();
            $ordemGrupos[$grupo] = $ordem;
        }
        if ($id === $cartao) {
            $encontrado = true;
            continue;
        }
        $porGrupo[$grupo][] = array('id' => $id, 'ordem' => isset($categoria['menuOrder']) ? (int)$categoria['menuOrder'] : 999);
    }
    if (!$encontrado) cmd_erro('Não existe o cartão "' . $cartao . '" no menu.');
    if (!isset($porGrupo[$grupoDestino])) {
        $porGrupo[$grupoDestino] = array();
        $ordemGrupos[$grupoDestino] = count($ordemGrupos) + 1;
    }
    foreach ($porGrupo as &$itens) {
        usort($itens, function ($a, $b) { return $a['ordem'] - $b['ordem']; });
    }
    unset($itens);

    $novo = array('id' => $cartao, 'ordem' => 0);
    $posicao = count($porGrupo[$grupoDestino]);
    if ($antesDe !== '') {
        $posicao = -1;
        foreach ($porGrupo[$grupoDestino] as $i => $item) {
            if ($item['id'] === $antesDe) { $posicao = $i; break; }
        }
        if ($posicao < 0) cmd_erro('O cartão `antes` não está no grupo "' . $grupoDestino . '".');
    }
    array_splice($porGrupo[$grupoDestino], $posicao, 0, array($novo));
    uasort($ordemGrupos, function ($a, $b) { return $a - $b; });

    $grupos = array();
    foreach (array_keys($ordemGrupos) as $nome) {
        $grupos[] = array('nome' => $nome, 'itens' => array_map(function ($item) { return $item['id']; }, $porGrupo[$nome]));
    }
    $antes = 'posição actual';
    $depois = $grupoDestino . ' · posição ' . ($posicao + 1);
    return array($grupos, $antes, $depois);
}

/** Obtém o cartão de carrossel e os slides já normalizados pelo núcleo comum. */
function cmd_carrossel_cartao(array $args)
{
    $id = cmd_texto($args, 'cartao');
    cmd_api('carrousel');
    $estado = cmd_estado('home');
    foreach ((array)$estado['categories'] as $categoria) {
        if (is_array($categoria) && isset($categoria['id']) && (string)$categoria['id'] === $id) {
            return array($categoria, carousel_slides($categoria));
        }
    }
    cmd_erro('Não existe o cartão de carrossel "' . $id . '".');
}

function cmd_carrossel_global_valor(array $args)
{
    cmd_api('carrousel');
    $campo = cmd_enum($args, 'campo', array_merge(array('enabled', 'randomizeOnLoad'), CAROUSEL_CAMPOS));
    $valor = in_array($campo, array('enabled', 'randomizeOnLoad'), true)
        ? cmd_booleano($args, 'valor') : cmd_carrossel_numero($args, 'valor', $campo);
    return array($campo, $valor);
}

function cmd_carrossel_numero(array $args, $nome, $campo)
{
    cmd_api('carrousel');
    $limites = carousel_limites($campo);
    if ($limites === null) {
        cmd_erro('O campo de carrossel "' . $campo . '" não existe.');
    }
    return cmd_numero_intervalo($args, $nome, $limites[0], $limites[1]);
}

/** Carga completa e segura para as operações curtas de slides. */
function cmd_carrossel_slides_alterar(array $args)
{
    $acao = cmd_enum($args, 'accao', array('adicionar', 'alterar', 'remover'));
    list($cartao, $slides) = cmd_carrossel_cartao($args);
    $indice = isset($args['indice']) && $args['indice'] !== ''
        ? cmd_inteiro_intervalo($args, 'indice', 0, CARROUSEL_MAX_SLIDES) : count($slides);
    if ($acao === 'adicionar') {
        if ($indice < 0 || $indice > count($slides)) cmd_erro('`indice` está fora da lista de slides.');
        $imagem = cmd_texto($args, 'caminho');
        $novo = array('image' => $imagem, 'visible' => isset($args['visivel']) ? cmd_booleano($args, 'visivel') : true);
        foreach (CAROUSEL_CAMPOS as $campo) {
            $novo[$campo] = isset($args[$campo]) && $args[$campo] !== ''
                ? cmd_carrossel_numero($args, $campo, $campo) : null;
        }
        array_splice($slides, $indice, 0, array($novo));
        $antes = 'sem slide nesta posição';
        $depois = $imagem;
    } else {
        if (!isset($slides[$indice])) cmd_erro('Não existe o slide ' . $indice . ' desse cartão.');
        $antes = isset($slides[$indice]['image']) ? $slides[$indice]['image'] : 'slide ' . $indice;
        if ($acao === 'remover') {
            array_splice($slides, $indice, 1);
            $depois = 'removido';
        } else {
            if (isset($args['caminho']) && $args['caminho'] !== '') $slides[$indice]['image'] = cmd_texto($args, 'caminho');
            if (isset($args['visivel']) && $args['visivel'] !== '') $slides[$indice]['visible'] = cmd_booleano($args, 'visivel');
            foreach (CAROUSEL_CAMPOS as $campo) {
                if (isset($args[$campo]) && $args[$campo] !== '') {
                    $slides[$indice][$campo] = cmd_carrossel_numero($args, $campo, $campo);
                }
            }
            $depois = isset($slides[$indice]['image']) ? $slides[$indice]['image'] : 'alterado';
        }
    }
    return array($cartao, $slides, $antes, $depois, $acao);
}

function cmd_review_valor(array $args, $campo)
{
    if (in_array($campo, array('enabled', 'linkEnabled'), true)) return cmd_booleano($args, 'valor');
    if ($campo === 'order') return cmd_inteiro_intervalo($args, 'valor', 1, 9999);
    if ($campo === 'stars') return cmd_inteiro_intervalo($args, 'valor', 1, 5);
    if ($campo === 'ratingMode') return cmd_enum($args, 'valor', array('default', 'stars', 'icon', 'none'));
    if ($campo === 'icon') return cmd_enum($args, 'valor', array('default', 'heart', 'flower', 'sparkle', 'check', 'quote', 'custom'));
    return cmd_texto($args, 'valor', '');
}

function cmd_reviews_definicao_valor(array $args, $campo)
{
    if (in_array($campo, array('enabled', 'showImage', 'showName', 'showText'), true)) return cmd_booleano($args, 'valor');
    if ($campo === 'intervalMs') return cmd_inteiro_intervalo($args, 'valor', 2000, 60000);
    if ($campo === 'defaultStars') return cmd_inteiro_intervalo($args, 'valor', 1, 5);
    if ($campo === 'eggPumps') return cmd_inteiro_intervalo($args, 'valor', 0, 20);
    $enums = array(
        'position' => array('left', 'right'), 'size' => array('compact', 'normal', 'large'),
        'theme' => array('paper', 'rose', 'sage', 'dark'), 'imageShape' => array('rounded', 'circle', 'square'),
        'defaultRatingMode' => array('stars', 'icon', 'none'),
        'defaultIcon' => array('heart', 'flower', 'sparkle', 'check', 'quote', 'custom'),
    );
    if (isset($enums[$campo])) return cmd_enum($args, 'valor', $enums[$campo]);
    return cmd_texto($args, 'valor', '');
}

/** A API das reviews ordena e normaliza antes de gravar; o batch vê essa saída. */
function cmd_reviews_normalizados(array $estado)
{
    cmd_api('reviews');
    return reviews_normalize($estado);
}

function cmd_home_categoria_valor(array $args, $campo)
{
    cmd_api('homepage-menu');
    if (in_array($campo, HOMEPAGE_CAMPOS_TEXTO, true)) return cmd_texto($args, 'valor', '');
    if (in_array($campo, HOMEPAGE_CAMPOS_NUMERO, true)) return cmd_inteiro_intervalo($args, 'valor', 0, 999);
    if (in_array($campo, HOMEPAGE_CAMPOS_BOOL, true)) return cmd_booleano($args, 'valor');
    cmd_erro('O campo da homepage "' . $campo . '" não é editável.');
}

function cmd_seccao_valor(array $args, $campo)
{
    if (in_array($campo, array('eyebrow', 'title', 'text'), true)) return cmd_texto($args, 'valor', '');
    if ($campo === 'layout') return cmd_enum($args, 'valor', array('feature', 'grid'));
    if ($campo === 'maxCards') return cmd_inteiro_intervalo($args, 'valor', 1, 12);
    if ($campo === 'repeatInGrid') return cmd_booleano($args, 'valor');
    cmd_erro('O campo da secção "' . $campo . '" não é editável.');
}

/**
 * O dinheiro entra em euros ou em cêntimos.
 *
 * Uma factura diz «0,12 €», não «12 cêntimos». Aceitar as duas formas evita o
 * erro de cem vezes, que num preço não dá erro nenhum — só fica errado.
 */
function cmd_cents(array $args, $obrigatorio = true)
{
    if (isset($args['cents']) && $args['cents'] !== '') {
        return cmd_inteiro_intervalo($args, 'cents', 0, 100000000);
    }
    if (isset($args['euros']) && $args['euros'] !== '') {
        $cents = (int)round(cmd_numero_intervalo($args, 'euros', 0, 1000000) * 100);
        if ($cents < 0 || $cents > 100000000) {
            cmd_erro('`euros` está fora do intervalo aceite.');
        }
        return $cents;
    }
    if ($obrigatorio) {
        cmd_erro('Falta o valor: usa `euros=1.50` ou `cents=150`.');
    }
    return null;
}

function cmd_quantidade_pack(array $args, $nome = 'qtd')
{
    return cmd_inteiro_intervalo($args, $nome, 1, 100000);
}

function cmd_quantidade_material(array $args, $nome = 'quantidade', $omissao = null)
{
    return cmd_numero_intervalo($args, $nome, 0, 10000000, $omissao);
}

function cmd_estragos(array $args, $nome = 'estragos', $omissao = null)
{
    return cmd_numero_intervalo($args, $nome, 0, 90, $omissao);
}

function cmd_minutos(array $args, $nome = 'minutos', $omissao = null)
{
    return cmd_numero_intervalo($args, $nome, 0, 10000, $omissao);
}

function cmd_ordem_tabs(array $args)
{
    $ordem = cmd_csv($args, 'ordem');
    foreach ($ordem as $slug) {
        if (!preg_match('/^[a-z0-9-]+$/', $slug)) {
            cmd_erro('`ordem` só pode conter slugs de produto.');
        }
    }
    return $ordem;
}

/** Valida pelo mesmo parser de rendimento que a API dos materiais utiliza. */
function cmd_rendimento(array $args, $nome = 'rendimento', $omissao = '1')
{
    cmd_api('materiais');
    $rendimento = cmd_texto($args, $nome, $omissao);
    if (mat_rendimento($rendimento) <= 0) {
        cmd_erro('`' . $nome . '` tem de ser uma multiplicação decimal finita maior que zero (ex.: 100*10).');
    }
    return $rendimento;
}

function cmd_euros($cents)
{
    return number_format(((int)$cents) / 100, 2, ',', ' ') . ' €';
}

/** `products.imanes-loja.prices.3 mm.30` → array de passos. */
function cmd_trail($valor)
{
    $valor = (string)$valor;
    $partes = strpos($valor, '/') !== false ? explode('/', $valor) : explode('.', $valor);
    $limpo = array();
    foreach ($partes as $p) {
        $p = trim($p);
        if ($p !== '') {
            $limpo[] = $p;
        }
    }
    if (!$limpo) {
        cmd_erro('`trail` vazio.');
    }
    return $limpo;
}

/** Segue um caminho dentro de um array. Devolve null se não existir. */
function cmd_ler_trail($dados, array $trail)
{
    $no = $dados;
    foreach ($trail as $passo) {
        if (!is_array($no) || !array_key_exists($passo, $no)) {
            return null;
        }
        $no = $no[$passo];
    }
    return $no;
}

function cmd_mostrar($valor)
{
    if ($valor === null) {
        return '—';
    }
    if (is_bool($valor)) {
        return $valor ? 'sim' : 'não';
    }
    if (is_array($valor)) {
        return count($valor) . ' entradas';
    }
    return (string)$valor;
}

/** Uma linha do «antes → depois» que aparece na confirmação. */
function cmd_linha($ficheiro, $onde, $antes, $depois)
{
    return array(
        'ficheiro' => $ficheiro,
        'onde' => $onde,
        'antes' => $antes,
        'depois' => $depois,
        'igual' => (string)$antes === (string)$depois,
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Estado, lido uma vez por pedido
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estado em memória da pré-visualização.
 *
 * Um batch é lido pela ordem do URL. Cada comando seguinte tem de ver o
 * resultado proposto pelos anteriores, embora ainda não exista uma escrita em
 * disco. Sem isto, duas linhas `material` numa factura partiam ambas do mesmo
 * catálogo e a segunda apagava a primeira quando chegava à API.
 */
function &cmd_cache_estado()
{
    static $cache = array();
    return $cache;
}

/** Cada análise começa por uma fotografia nova; dentro do batch ela é estagiada. */
function cmd_reiniciar_estado()
{
    $cache = &cmd_cache_estado();
    $cache = array();
}

function cmd_estado($dominio)
{
    $cache = &cmd_cache_estado();
    if (array_key_exists($dominio, $cache)) {
        return $cache[$dominio];
    }

    if ($dominio === 'precos') {
        cmd_api('precos');
        $dados = precos_recolher();
        $cache[$dominio] = isset($dados['pricing']) && is_array($dados['pricing'])
            ? $dados['pricing'] : array('products' => array());
    } elseif ($dominio === 'precos-tabs') {
        cmd_api('precos');
        $prefs = precos_ler_prefs();
        $cache[$dominio] = isset($prefs['ordemTabs']) && is_array($prefs['ordemTabs'])
            ? array_values($prefs['ordemTabs']) : array();
    } elseif ($dominio === 'custos') {
        cmd_api('precos');
        $cache[$dominio] = precos_ler_custos();
    } elseif ($dominio === 'materiais') {
        cmd_api('materiais');
        $cache[$dominio] = mat_ler();
    } elseif ($dominio === 'home') {
        cmd_api('homepage-menu');
        list($home, , $erro) = home_ler();
        if ($erro !== '') {
            cmd_erro($erro);
        }
        $cache[$dominio] = $home;
    } elseif ($dominio === 'reviews') {
        cmd_api('reviews');
        $cache[$dominio] = reviews_read();
    } elseif ($dominio === 'galeria-done') {
        cmd_api('galeria');
        $cache[$dominio] = galeria_read_done();
    } else {
        $cache[$dominio] = array();
    }

    return $cache[$dominio];
}

function cmd_definir_estado($dominio, $estado)
{
    $cache = &cmd_cache_estado();
    $cache[$dominio] = $estado;
}

/** O JSON de um produto do catálogo, para as operações que lá escrevem. */
function cmd_produto_json($slug)
{
    $chaveCache = 'produto:' . $slug;
    $cache = &cmd_cache_estado();
    if (array_key_exists($chaveCache, $cache)) {
        return $cache[$chaveCache];
    }
    cmd_api('precos');
    $path = precos_caminho_produto($slug);
    if ($path === '') {
        cmd_erro('Produto desconhecido: ' . $slug . '.');
    }
    list($data, , $erro) = precos_ler_json($path);
    if ($erro !== '') {
        cmd_erro($erro);
    }
    $cache[$chaveCache] = $data;
    return $data;
}

function cmd_definir_produto_json($slug, $dados)
{
    $cache = &cmd_cache_estado();
    $cache['produto:' . $slug] = $dados;
}

/** Encontra um material pelo id ou pelo nome, sem obrigar a saber ids. */
function cmd_material(array $estado, $referencia)
{
    $referencia = trim((string)$referencia);
    foreach ($estado['materiais'] as $i => $m) {
        if ((string)$m['id'] === $referencia) {
            return array($i, $m);
        }
    }
    $alvo = function_exists('mb_strtolower') ? mb_strtolower($referencia, 'UTF-8') : strtolower($referencia);
    foreach ($estado['materiais'] as $i => $m) {
        $nome = (string)(isset($m['nome']) ? $m['nome'] : '');
        $nome = function_exists('mb_strtolower') ? mb_strtolower($nome, 'UTF-8') : strtolower($nome);
        if ($nome === $alvo) {
            return array($i, $m);
        }
    }
    return array(-1, null);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. O registo de operações
// ─────────────────────────────────────────────────────────────────────────────

function cmd_registo()
{
    static $registo = null;
    if ($registo !== null) {
        return $registo;
    }

    $registo = array(

        // ══ Preços ══════════════════════════════════════════════════════════

        'preco' => array(
            'dominio' => 'precos',
            'titulo' => 'Preço de um escalão',
            'descricao' => 'Muda o preço total de uma quantidade que já existe na tabela. Para criar uma quantidade nova usa `pack-adicionar`.',
            'parametros' => array(
                'produto' => 'slug do produto, ex.: imanes-loja',
                'chave' => 'tabela de preços dentro do produto, ex.: "3 mm"',
                'qtd' => 'quantidade do escalão, ex.: 30',
                'euros|cents' => 'preço total desse escalão',
            ),
            'exemplo' => 'op=preco&produto=imanes-loja&chave=3 mm&qtd=30&euros=60',
            'prever' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $chave = cmd_texto($a, 'chave');
                $qtd = (string)cmd_quantidade_pack($a);
                $cents = cmd_cents($a);
                $trail = array('products', $produto, 'prices', $chave, $qtd);
                $antes = cmd_ler_trail(cmd_estado('precos'), $trail);
                if ($antes === null) {
                    cmd_erro('Não existe o escalão ' . $qtd . ' na tabela "' . $chave . '" de ' . $produto . '. Usa `pack-adicionar` para o criar.');
                }
                return array(cmd_linha('content/pricing.json', implode(' → ', $trail), cmd_euros($antes), cmd_euros($cents)));
            },
            'traduzir' => function (array $a) {
                return array('precos' => array(array(
                    'op' => 'valor',
                    'ficheiro' => 'pricing',
                    'trail' => array('products', cmd_texto($a, 'produto'), 'prices', cmd_texto($a, 'chave'), (string)cmd_quantidade_pack($a)),
                    'cents' => cmd_cents($a),
                )));
            },
        ),

        'ordem-tabs' => array(
            'dominio' => 'precos',
            'titulo' => 'Ordem das tabs de preços',
            'descricao' => 'Define a ordem das tabs guardada nas preferências privadas do editor de preços. Aceita slugs de produto, incluindo os produtos independentes `congresso-2026-*`, separados por vírgulas.',
            'parametros' => array(
                'ordem' => 'slugs de produto por ordem, separados por vírgulas',
            ),
            'exemplo' => 'op=ordem-tabs&ordem=imanes-loja,agendas,congresso-2026-imanes',
            'prever' => function (array $a) {
                $depois = cmd_ordem_tabs($a);
                $antes = cmd_estado('precos-tabs');
                return array(cmd_linha('private/editor-preferencias.json', 'ordem das tabs', implode(', ', $antes), implode(', ', $depois)));
            },
            'traduzir' => function (array $a) {
                return array('precos' => array(array('op' => 'ordem-tabs', 'ordem' => cmd_ordem_tabs($a))));
            },
        ),

        'pack-adicionar' => array(
            'dominio' => 'precos',
            'titulo' => 'Pack novo',
            'descricao' => 'Acrescenta uma quantidade nova à tabela, com o seu preço. O desconto entra a zero nas quatro escadas; usa `desconto` a seguir para o definir.',
            'parametros' => array(
                'produto' => 'slug do produto',
                'chave' => 'tabela de preços',
                'qtd' => 'quantidade do pack novo',
                'euros|cents' => 'preço total do pack',
            ),
            'exemplo' => 'op=pack-adicionar&produto=imanes-recortados&chave=Recortados&qtd=8&euros=18',
            'prever' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $chave = cmd_texto($a, 'chave');
                $qtd = (string)cmd_quantidade_pack($a);
                $cents = cmd_cents($a);
                $tabela = cmd_ler_trail(cmd_estado('precos'), array('products', $produto, 'prices', $chave));
                if ($tabela === null) {
                    cmd_erro('Não encontrei a tabela "' . $chave . '" em ' . $produto . '.');
                }
                if (isset($tabela[$qtd])) {
                    cmd_erro('O escalão ' . $qtd . ' já existe em "' . $chave . '". Usa `preco` para lhe mudar o valor.');
                }
                return array(cmd_linha(
                    'content/pricing.json',
                    $produto . ' → ' . $chave . ' → pack de ' . $qtd,
                    'não existe',
                    cmd_euros($cents)
                ));
            },
            'traduzir' => function (array $a) {
                return array('precos' => array(array(
                    'op' => 'pack-adicionar',
                    'slug' => cmd_texto($a, 'produto'),
                    'priceKey' => cmd_texto($a, 'chave'),
                    'quantidade' => cmd_quantidade_pack($a),
                    'cents' => cmd_cents($a),
                )));
            },
        ),

        'pack-remover' => array(
            'dominio' => 'precos',
            'titulo' => 'Remover um pack',
            'descricao' => 'Tira uma quantidade da tabela, e o desconto correspondente.',
            'parametros' => array(
                'produto' => 'slug do produto',
                'chave' => 'tabela de preços',
                'qtd' => 'quantidade a remover',
            ),
            'exemplo' => 'op=pack-remover&produto=imanes-recortados&chave=Recortados&qtd=12',
            'prever' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $chave = cmd_texto($a, 'chave');
                $qtd = (string)cmd_quantidade_pack($a);
                $antes = cmd_ler_trail(cmd_estado('precos'), array('products', $produto, 'prices', $chave, $qtd));
                if ($antes === null) {
                    cmd_erro('Não existe o escalão ' . $qtd . ' em "' . $chave . '" de ' . $produto . '.');
                }
                return array(cmd_linha('content/pricing.json', $produto . ' → ' . $chave . ' → pack de ' . $qtd, cmd_euros($antes), 'removido'));
            },
            'traduzir' => function (array $a) {
                return array('precos' => array(array(
                    'op' => 'pack-remover',
                    'slug' => cmd_texto($a, 'produto'),
                    'priceKey' => cmd_texto($a, 'chave'),
                    'quantidade' => cmd_quantidade_pack($a),
                )));
            },
        ),

        'desconto' => array(
            'dominio' => 'precos',
            'titulo' => 'Desconto de um escalão',
            'descricao' => 'A percentagem de desconto de uma quantidade, numa das quatro escadas. Sem `escada`, mexe na que estiver activa.',
            'parametros' => array(
                'produto' => 'slug do produto',
                'chave' => 'tabela de preços',
                'qtd' => 'quantidade do escalão',
                'percent' => 'percentagem, ex.: 12.5',
                'escada' => 'D1, D2, D3 ou D4 (opcional)',
            ),
            'exemplo' => 'op=desconto&produto=imanes-loja&chave=3 mm&qtd=3&percent=6',
            'prever' => function (array $a) {
                list($produto, $chave, $qtd, $escada, $percent, $antes) = cmd_desconto_alvo($a);
                return array(cmd_linha(
                    'content/pricing.json',
                    $produto . ' → ' . $chave . ' → ' . $escada . ' → ' . $qtd . ' unidades',
                    $antes === null ? '—' : $antes . ' %',
                    $percent . ' %'
                ));
            },
            'traduzir' => function (array $a) {
                list($produto, $chave, $qtd, $escada, $percent) = cmd_desconto_alvo($a);
                $bloco = cmd_ler_trail(cmd_estado('precos'), array('products', $produto, 'discountsByPriceKey', $chave));
                $bloco = is_array($bloco) ? $bloco : array('activo' => 'D1');
                if (!isset($bloco[$escada]) || !is_array($bloco[$escada])) {
                    $bloco[$escada] = array();
                }
                $bloco[$escada][$qtd] = $percent;
                return array('precos' => array(array(
                    'op' => 'descontos',
                    'slug' => $produto,
                    'priceKey' => $chave,
                    'bloco' => $bloco,
                )));
            },
        ),

        'desconto-activo' => array(
            'dominio' => 'precos',
            'titulo' => 'Escada de desconto activa',
            'descricao' => 'Escolhe qual das quatro escadas de desconto é a que o site aplica.',
            'parametros' => array(
                'produto' => 'slug do produto',
                'chave' => 'tabela de preços',
                'escada' => 'D1, D2, D3 ou D4',
            ),
            'exemplo' => 'op=desconto-activo&produto=imanes-loja&chave=3 mm&escada=D2',
            'prever' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $chave = cmd_texto($a, 'chave');
                $escada = cmd_escada($a, null);
                $bloco = cmd_ler_trail(cmd_estado('precos'), array('products', $produto, 'discountsByPriceKey', $chave));
                if (!is_array($bloco)) {
                    cmd_erro('Não encontrei descontos para "' . $chave . '" em ' . $produto . '.');
                }
                return array(cmd_linha('content/pricing.json', $produto . ' → ' . $chave . ' → escada activa', isset($bloco['activo']) ? $bloco['activo'] : '—', $escada));
            },
            'traduzir' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $chave = cmd_texto($a, 'chave');
                $bloco = cmd_ler_trail(cmd_estado('precos'), array('products', $produto, 'discountsByPriceKey', $chave));
                $bloco = is_array($bloco) ? $bloco : array();
                $bloco['activo'] = cmd_escada($a, null);
                return array('precos' => array(array('op' => 'descontos', 'slug' => $produto, 'priceKey' => $chave, 'bloco' => $bloco)));
            },
        ),

        'custo' => array(
            'dominio' => 'precos',
            'titulo' => 'Custo por unidade',
            'descricao' => 'O custo de produzir uma unidade, usado para o lucro. Guardado fora da raiz web.',
            'parametros' => array(
                'produto' => 'slug do produto',
                'chave' => 'tabela de preços',
                'euros|cents' => 'custo de uma unidade',
            ),
            'exemplo' => 'op=custo&produto=imanes-loja&chave=3 mm&euros=0.42',
            'prever' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $chave = cmd_texto($a, 'chave');
                $cents = cmd_cents($a);
                $custos = cmd_estado('custos');
                $antes = isset($custos['produtos'][$produto][$chave])
                    ? cmd_euros($custos['produtos'][$produto][$chave]) : '—';
                // A API remove a entrada quando o custo é zero; o preview não
                // pode fingir que fica um campo explícito com 0,00 €.
                $depois = $cents === 0 ? '— (sem custo guardado)' : cmd_euros($cents);
                return array(cmd_linha('private/custos.json', $produto . ' → ' . $chave, $antes, $depois));
            },
            'traduzir' => function (array $a) {
                return array('precos' => array(array(
                    'op' => 'custo',
                    'slug' => cmd_texto($a, 'produto'),
                    'priceKey' => cmd_texto($a, 'chave'),
                    'cents' => cmd_cents($a),
                )));
            },
        ),

        'valor' => array(
            'dominio' => 'precos',
            'titulo' => 'Qualquer valor monetário',
            'descricao' => 'A operação geral: escreve um valor em cêntimos em qualquer caminho do pricing.json ou do JSON de um produto. Serve para portes, extras e acabamentos. O caminho vê-se em precos-api.php?action=data.',
            'parametros' => array(
                'ficheiro' => '"pricing" ou o slug de um produto',
                'trail' => 'caminho separado por pontos, ex.: delivery.ctt.cents',
                'euros|cents' => 'o valor',
            ),
            'exemplo' => 'op=valor&ficheiro=pricing&trail=products.imanes-loja.prices.3 mm.30&euros=60',
            'prever' => function (array $a) {
                $ficheiro = cmd_texto($a, 'ficheiro');
                $trail = cmd_trail(cmd_texto($a, 'trail'));
                $cents = cmd_cents($a);
                $dados = $ficheiro === 'pricing' ? cmd_estado('precos') : cmd_produto_json($ficheiro);
                $antes = cmd_ler_trail($dados, $trail);
                if ($antes === null) {
                    cmd_erro('Não encontrei ' . implode(' → ', $trail) . ' em ' . $ficheiro . '.');
                }
                return array(cmd_linha(
                    $ficheiro === 'pricing' ? 'content/pricing.json' : 'content/products/' . $ficheiro . '.json',
                    implode(' → ', $trail),
                    cmd_euros($antes),
                    cmd_euros($cents)
                ));
            },
            'traduzir' => function (array $a) {
                return array('precos' => array(array(
                    'op' => 'valor',
                    'ficheiro' => cmd_texto($a, 'ficheiro'),
                    'trail' => cmd_trail(cmd_texto($a, 'trail')),
                    'cents' => cmd_cents($a),
                )));
            },
        ),

        // ══ Materiais ═══════════════════════════════════════════════════════

        'pack-renomear' => array(
            'dominio' => 'precos',
            'titulo' => 'Renomear a quantidade de um pack',
            'descricao' => 'Muda a quantidade de um escalão e conserva o seu preço. Actualiza também os botões do produto.',
            'parametros' => array(
                'produto' => 'slug do produto',
                'chave' => 'tabela de preços',
                'de' => 'quantidade actual',
                'para' => 'quantidade nova',
            ),
            'exemplo' => 'op=pack-renomear&produto=imanes-recortados&chave=Recortados&de=12&para=10',
            'prever' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $chave = cmd_texto($a, 'chave');
                $de = (string)cmd_quantidade_pack($a, 'de');
                $para = cmd_quantidade_pack($a, 'para');
                $tabela = cmd_ler_trail(cmd_estado('precos'), array('products', $produto, 'prices', $chave));
                if (!is_array($tabela) || !isset($tabela[$de])) {
                    cmd_erro('Não existe o pack de ' . $de . ' em "' . $chave . '".');
                }
                if ($para < 1 || ($para !== (int)$de && isset($tabela[(string)$para]))) {
                    cmd_erro('A quantidade nova é inválida ou já existe nessa tabela.');
                }
                return array(cmd_linha('content/pricing.json', $produto . ' → ' . $chave, $de . ' unidades', $para . ' unidades'));
            },
            'traduzir' => function (array $a) {
                return array('precos' => array(array(
                    'op' => 'pack-renomear', 'slug' => cmd_texto($a, 'produto'), 'priceKey' => cmd_texto($a, 'chave'),
                    'de' => cmd_quantidade_pack($a, 'de'), 'para' => cmd_quantidade_pack($a, 'para'),
                )));
            },
        ),

        'texto' => array(
            'dominio' => 'precos',
            'titulo' => 'Texto de uma opção de produto',
            'descricao' => 'Altera um texto já existente numa opção, extra ou acabamento. Nunca muda ids nem values.',
            'parametros' => array(
                'produto' => 'slug do produto',
                'trail' => 'caminho do campo de texto dentro do JSON do produto',
                'texto' => 'texto novo',
            ),
            'exemplo' => 'op=texto&produto=imanes-loja&trail=steps.1.items.0.title&texto=Íman+redondo',
            'prever' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $trail = cmd_trail(cmd_texto($a, 'trail'));
                $antes = cmd_ler_trail(cmd_produto_json($produto), $trail);
                if (!is_string($antes)) {
                    cmd_erro('O caminho não aponta para um texto existente.');
                }
                return array(cmd_linha('content/products/' . $produto . '.json', implode(' → ', $trail), $antes, cmd_texto($a, 'texto', '')));
            },
            'traduzir' => function (array $a) {
                return array('precos' => array(array(
                    'op' => 'texto', 'ficheiro' => cmd_texto($a, 'produto'),
                    'trail' => cmd_trail(cmd_texto($a, 'trail')), 'texto' => cmd_texto($a, 'texto', ''),
                )));
            },
        ),

        'linha-adicionar' => array(
            'dominio' => 'precos',
            'titulo' => 'Linha nova numa coleção de preços',
            'descricao' => 'Acrescenta uma linha vazia baseada na coleção existente. Em seguida define os seus textos e preços com `texto` e `valor`.',
            'parametros' => array('produto' => 'slug do produto', 'trail' => 'caminho da coleção, sem índice'),
            'exemplo' => 'op=linha-adicionar&produto=agendas&trail=steps.4.items',
            'prever' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $trail = cmd_trail(cmd_texto($a, 'trail'));
                $copia = cmd_produto_json($produto);
                $identidade = '';
                $erro = precos_adicionar_linha($copia, $trail, $identidade);
                if ($erro !== '') {
                    cmd_erro($erro);
                }
                return array(cmd_linha('content/products/' . $produto . '.json', implode(' → ', $trail), 'coleção actual', 'linha nova' . ($identidade !== '' ? ' (' . $identidade . ')' : '')));
            },
            'traduzir' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $trail = cmd_trail(cmd_texto($a, 'trail'));
                $copia = cmd_produto_json($produto);
                $identidade = '';
                $erro = precos_adicionar_linha($copia, $trail, $identidade);
                if ($erro !== '') {
                    cmd_erro($erro);
                }
                cmd_definir_produto_json($produto, $copia);
                return array('precos' => array(array('op' => 'linha-adicionar', 'ficheiro' => $produto, 'trail' => $trail)));
            },
        ),

        'linha-remover' => array(
            'dominio' => 'precos',
            'titulo' => 'Remover linha de uma coleção de preços',
            'descricao' => 'Remove uma linha pelo seu índice. A coleção nunca pode ficar vazia.',
            'parametros' => array('produto' => 'slug do produto', 'trail' => 'caminho da linha, terminado no índice'),
            'exemplo' => 'op=linha-remover&produto=agendas&trail=steps.4.items.3',
            'prever' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $trail = cmd_trail(cmd_texto($a, 'trail'));
                $copia = cmd_produto_json($produto);
                $antes = cmd_ler_trail($copia, $trail);
                if (!is_array($antes)) {
                    cmd_erro('O caminho não aponta para uma linha existente.');
                }
                $erro = precos_remover_linha($copia, $trail);
                if ($erro !== '') {
                    cmd_erro($erro);
                }
                return array(cmd_linha('content/products/' . $produto . '.json', implode(' → ', $trail), cmd_mostrar($antes), 'removida'));
            },
            'traduzir' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $trail = cmd_trail(cmd_texto($a, 'trail'));
                $copia = cmd_produto_json($produto);
                $erro = precos_remover_linha($copia, $trail);
                if ($erro !== '') {
                    cmd_erro($erro);
                }
                cmd_definir_produto_json($produto, $copia);
                return array('precos' => array(array('op' => 'linha-remover', 'ficheiro' => $produto, 'trail' => $trail)));
            },
        ),

        'modo' => array(
            'dominio' => 'precos',
            'titulo' => 'Modo de preço de um produto',
            'descricao' => 'Muda o modo nos três locais que o checkout compara.',
            'parametros' => array('produto' => 'slug do produto', 'modo' => 'tier-unit, flat-unit, pack-combination ou linear-discount-interpolation'),
            'exemplo' => 'op=modo&produto=imanes-loja&modo=tier-unit',
            'prever' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $modo = cmd_enum($a, 'modo', PRECOS_MODOS);
                $estado = cmd_estado('precos');
                if (!isset($estado['products'][$produto])) {
                    cmd_erro('O produto não existe no pricing.json.');
                }
                return array(cmd_linha('content/pricing.json', $produto . ' → modo', isset($estado['products'][$produto]['pricingMode']) ? $estado['products'][$produto]['pricingMode'] : '—', $modo));
            },
            'traduzir' => function (array $a) {
                return array('precos' => array(array('op' => 'modo', 'slug' => cmd_texto($a, 'produto'), 'pricingMode' => cmd_enum($a, 'modo', PRECOS_MODOS))));
            },
        ),

        'variante' => array(
            'dominio' => 'precos',
            'titulo' => 'Preço de uma variante',
            'descricao' => 'Muda o preço de uma variante purchase-option e todos os espelhos que o checkout usa.',
            'parametros' => array('produto' => 'slug do produto', 'variante' => 'value da variante', 'euros|cents' => 'novo preço'),
            'exemplo' => 'op=variante&produto=agendas&variante=agenda_normal&euros=29.90',
            'prever' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $valor = cmd_texto($a, 'variante');
                $antes = null;
                $dados = cmd_produto_json($produto);
                $passo = precos_passo_pack($dados);
                if ($passo !== null) {
                    foreach ((array)$dados['steps'][$passo]['items'] as $item) {
                        if (isset($item['value']) && (string)$item['value'] === $valor) {
                            $antes = isset($item['priceCents']) ? (int)$item['priceCents'] : null;
                            break;
                        }
                    }
                }
                if ($antes === null) {
                    cmd_erro('Não encontrei a variante "' . $valor . '".');
                }
                return array(cmd_linha('content/products/' . $produto . '.json', 'variante ' . $valor, cmd_euros($antes), cmd_euros(cmd_cents($a))));
            },
            'traduzir' => function (array $a) {
                return array('precos' => array(array('op' => 'variante', 'slug' => cmd_texto($a, 'produto'), 'valor' => cmd_texto($a, 'variante'), 'cents' => cmd_cents($a))));
            },
        ),

        'material' => array(
            'dominio' => 'materiais',
            'titulo' => 'Material novo ou alterado',
            'descricao' => 'Acrescenta um material ao catálogo, ou actualiza-o se já existir um com o mesmo nome. É esta a operação para meter uma factura no site.',
            'parametros' => array(
                'nome' => 'nome do material',
                'euros|cents' => 'preço pago pela quantidade indicada',
                'quantidade' => 'quantas unidades vieram por esse preço (omissão: 1)',
                'unidade' => 'un, m, folha, kg… (opcional)',
                'estragos' => 'percentagem de desperdício, 0 a 90 (opcional)',
                'nota' => 'texto livre, ex.: número da factura (opcional)',
            ),
            'exemplo' => 'op=material&nome=Íman 32 mm&quantidade=500&unidade=un&euros=42.50&nota=Factura 2026-114',
            'prever' => function (array $a) {
                $nome = cmd_texto($a, 'nome');
                $cents = cmd_cents($a);
                list($i, $actual) = cmd_material(cmd_estado('materiais'), $nome);
                $qtd = isset($a['quantidade']) && $a['quantidade'] !== '' ? cmd_quantidade_material($a) : 1;
                $depois = cmd_euros($cents) . ' por ' . rtrim(rtrim(number_format($qtd, 2, ',', ' '), '0'), ',')
                    . ' ' . cmd_texto($a, 'unidade', 'un');
                $antes = $actual === null
                    ? 'não existe'
                    : cmd_euros($actual['precoCents']) . ' por ' . $actual['quantidade'] . ' ' . $actual['unidade'];
                return array(cmd_linha('private/materiais.json', ($i < 0 ? 'material novo: ' : 'material: ') . $nome, $antes, $depois));
            },
            'traduzir' => function (array $a) {
                $estado = cmd_estado('materiais');
                $nome = cmd_texto($a, 'nome');
                list($i, $actual) = cmd_material($estado, $nome);
                $novo = array(
                    'id' => $actual !== null ? $actual['id'] : 'm' . substr(bin2hex(random_bytes(6)), 0, 10),
                    'nome' => $nome,
                    'quantidade' => isset($a['quantidade']) && $a['quantidade'] !== '' ? cmd_quantidade_material($a) : ($actual !== null ? $actual['quantidade'] : 1),
                    'unidade' => cmd_texto($a, 'unidade', $actual !== null ? $actual['unidade'] : 'un'),
                    'precoCents' => cmd_cents($a),
                    'estragosPercent' => isset($a['estragos']) && $a['estragos'] !== ''
                        ? cmd_estragos($a)
                        : ($actual !== null ? $actual['estragosPercent'] : 0),
                    'nota' => cmd_texto($a, 'nota', $actual !== null ? $actual['nota'] : ''),
                );
                $lista = $estado['materiais'];
                if ($i >= 0) {
                    $lista[$i] = $novo;
                } else {
                    $lista[] = $novo;
                }
                return array('materiais' => array(array('op' => 'materiais-definir', 'materiais' => $lista)));
            },
        ),

        'material-apagar' => array(
            'dominio' => 'materiais',
            'titulo' => 'Apagar um material',
            'descricao' => 'Tira o material do catálogo, e as linhas dos produtos que o usavam.',
            'parametros' => array('nome' => 'nome ou id do material'),
            'exemplo' => 'op=material-apagar&nome=Íman 32 mm',
            'prever' => function (array $a) {
                $nome = cmd_texto($a, 'nome');
                list($i, $actual) = cmd_material(cmd_estado('materiais'), $nome);
                if ($i < 0) {
                    cmd_erro('Não encontrei o material "' . $nome . '".');
                }
                return array(cmd_linha('private/materiais.json', 'material: ' . $actual['nome'], cmd_euros($actual['precoCents']), 'apagado'));
            },
            'traduzir' => function (array $a) {
                $estado = cmd_estado('materiais');
                list($i) = cmd_material($estado, cmd_texto($a, 'nome'));
                $lista = $estado['materiais'];
                unset($lista[$i]);
                return array('materiais' => array(array('op' => 'materiais-definir', 'materiais' => array_values($lista))));
            },
        ),

        'custo-hora' => array(
            'dominio' => 'materiais',
            'titulo' => 'Custo da hora de trabalho',
            'descricao' => 'Quanto vale uma hora de trabalho, para o custo por unidade contar o tempo.',
            'parametros' => array('euros|cents' => 'valor da hora'),
            'exemplo' => 'op=custo-hora&euros=12',
            'prever' => function (array $a) {
                $cents = cmd_cents($a);
                $estado = cmd_estado('materiais');
                return array(cmd_linha('private/materiais.json', 'custo por hora', cmd_euros($estado['custoHoraCents']), cmd_euros($cents)));
            },
            'traduzir' => function (array $a) {
                return array('materiais' => array(array('op' => 'custo-hora', 'valor' => cmd_cents($a))));
            },
        ),

        'produto-material' => array(
            'dominio' => 'materiais',
            'titulo' => 'Ligar um material a um produto',
            'descricao' => 'Diz que um produto gasta um material, e quantas unidades saem de cada compra. O rendimento aceita multiplicações, ex.: 100*10*10.',
            'parametros' => array(
                'produto' => 'chave do produto na página dos materiais',
                'material' => 'nome ou id do material',
                'rendimento' => 'quantas unidades saem de uma compra (omissão: 1)',
                'minutos' => 'minutos por unidade (opcional)',
                'nota' => 'texto livre (opcional)',
            ),
            'exemplo' => 'op=produto-material&produto=imanes-loja&material=Íman 32 mm&rendimento=500',
            'prever' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $material = cmd_texto($a, 'material');
                $estado = cmd_estado('materiais');
                list($i, $m) = cmd_material($estado, $material);
                if ($i < 0) {
                    cmd_erro('Não encontrei o material "' . $material . '". Cria-o primeiro com `op=material`.');
                }
                $rendimento = cmd_rendimento($a);
                $linhas = isset($estado['produtos'][$produto]['linhas']) ? $estado['produtos'][$produto]['linhas'] : array();
                $antes = 'sem ligação';
                foreach ($linhas as $linha) {
                    if ($linha['materialId'] === $m['id']) {
                        $antes = 'rendimento ' . $linha['rendimento'];
                    }
                }
                return array(cmd_linha('private/materiais.json', $produto . ' ← ' . $m['nome'], $antes, 'rendimento ' . $rendimento));
            },
            'traduzir' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $estado = cmd_estado('materiais');
                list(, $m) = cmd_material($estado, cmd_texto($a, 'material'));
                $actual = isset($estado['produtos'][$produto]) ? $estado['produtos'][$produto] : array('minutosPorUnidade' => 0, 'linhas' => array());
                $linhas = array();
                $substituiu = false;
                foreach ($actual['linhas'] as $linha) {
                    if ($linha['materialId'] === $m['id']) {
                        $linha['rendimento'] = cmd_rendimento($a);
                        $linha['nota'] = cmd_texto($a, 'nota', isset($linha['nota']) ? $linha['nota'] : '');
                        $substituiu = true;
                    }
                    $linhas[] = $linha;
                }
                if (!$substituiu) {
                    $linhas[] = array(
                        'materialId' => $m['id'],
                        'rendimento' => cmd_rendimento($a),
                        'nota' => cmd_texto($a, 'nota', ''),
                    );
                }
                return array('materiais' => array(array(
                    'op' => 'produto-definir',
                    'produto' => $produto,
                    'minutosPorUnidade' => isset($a['minutos']) && $a['minutos'] !== '' ? cmd_minutos($a) : $actual['minutosPorUnidade'],
                    'linhas' => $linhas,
                )));
            },
        ),

        'produto-material-apagar' => array(
            'dominio' => 'materiais',
            'titulo' => 'Desligar um material de um produto',
            'descricao' => 'Remove apenas a associação de um material; não apaga o material do catálogo.',
            'parametros' => array(
                'produto' => 'chave do produto na página dos materiais',
                'material' => 'nome ou id do material',
            ),
            'exemplo' => 'op=produto-material-apagar&produto=imanes-loja&material=Íman 32 mm',
            'prever' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $estado = cmd_estado('materiais');
                list($i, $material) = cmd_material($estado, cmd_texto($a, 'material'));
                if ($i < 0) {
                    cmd_erro('Não encontrei o material pedido.');
                }
                $linhas = isset($estado['produtos'][$produto]['linhas']) ? $estado['produtos'][$produto]['linhas'] : array();
                foreach ($linhas as $linha) {
                    if (isset($linha['materialId']) && $linha['materialId'] === $material['id']) {
                        return array(cmd_linha('private/materiais.json', $produto . ' ← ' . $material['nome'], 'rendimento ' . $linha['rendimento'], 'associação removida'));
                    }
                }
                cmd_erro('Esse produto não usa o material "' . $material['nome'] . '".');
            },
            'traduzir' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $estado = cmd_estado('materiais');
                list(, $material) = cmd_material($estado, cmd_texto($a, 'material'));
                $actual = isset($estado['produtos'][$produto]) ? $estado['produtos'][$produto] : array('minutosPorUnidade' => 0, 'linhas' => array());
                $linhas = array_values(array_filter($actual['linhas'], function ($linha) use ($material) {
                    return !isset($linha['materialId']) || $linha['materialId'] !== $material['id'];
                }));
                return array('materiais' => array(array(
                    'op' => 'produto-definir', 'produto' => $produto,
                    'minutosPorUnidade' => $actual['minutosPorUnidade'], 'linhas' => $linhas,
                )));
            },
        ),

        'produto-minutos' => array(
            'dominio' => 'materiais',
            'titulo' => 'Minutos por unidade',
            'descricao' => 'Quanto tempo leva a fazer uma unidade deste produto.',
            'parametros' => array(
                'produto' => 'chave do produto na página dos materiais',
                'minutos' => 'minutos por unidade',
            ),
            'exemplo' => 'op=produto-minutos&produto=imanes-loja&minutos=0.5',
            'prever' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $minutos = cmd_minutos($a);
                $estado = cmd_estado('materiais');
                $antes = isset($estado['produtos'][$produto]['minutosPorUnidade']) ? $estado['produtos'][$produto]['minutosPorUnidade'] : 0;
                return array(cmd_linha('private/materiais.json', $produto . ' → minutos por unidade', $antes, $minutos));
            },
            'traduzir' => function (array $a) {
                $produto = cmd_texto($a, 'produto');
                $estado = cmd_estado('materiais');
                $actual = isset($estado['produtos'][$produto]) ? $estado['produtos'][$produto] : array('linhas' => array());
                return array('materiais' => array(array(
                    'op' => 'produto-definir',
                    'produto' => $produto,
                    'minutosPorUnidade' => cmd_minutos($a),
                    'linhas' => $actual['linhas'],
                )));
            },
        ),

        'enviar-para-precos' => array(
            'dominio' => 'materiais',
            'titulo' => 'Enviar o custo para os preços',
            'descricao' => 'Escreve o custo por unidade calculado dos materiais no ficheiro de custos que o precos.php lê.',
            'parametros' => array(
                'produto' => 'produto dos materiais; também aceita a forma antiga produto::tabela',
                'chave' => 'tabela de preços de destino (obrigatória se produto não incluir ::tabela)',
            ),
            'exemplo' => 'op=enviar-para-precos&produto=imanes-loja&chave=3 mm',
            'prever' => function (array $a) {
                $destino = cmd_custo_destino($a);
                return array(cmd_linha('private/custos.json', $destino, 'custo actual', 'o que os materiais calculam agora'));
            },
            'traduzir' => function (array $a) {
                return array('materiais' => array(array('op' => 'enviar-para-precos', 'produto' => cmd_custo_destino($a))));
            },
        ),

        // ══ Imagens ═════════════════════════════════════════════════════════

        'imagem' => array(
            'dominio' => 'galeria',
            'titulo' => 'Imagem de um produto',
            'descricao' => 'Troca o caminho de uma imagem dentro do JSON de um produto, ou da homepage. O caminho tem de existir dentro de content/. O `trail` vê-se em galeria-api.php?action=data.',
            'parametros' => array(
                'entrada' => 'slug do produto, "home", ou contexto:slug',
                'trail' => 'caminho dentro do JSON, ex.: steps.2.options.5.image',
                'caminho' => 'ficheiro dentro de content/, ex.: content/uploads/galeria/x.webp',
            ),
            'exemplo' => 'op=imagem&entrada=imanes-loja&trail=steps.0.items.0.image&caminho=content/designs/loja/imanes-loja/catalog/Fotos_dos_Imans/esperanca/esperanca-02.webp',
            'prever' => function (array $a) {
                list($entrada, $trail, $caminho, $antes) = cmd_imagem_alvo($a);
                return array(cmd_linha($entrada['rotulo'], implode(' → ', $trail), $antes, $caminho));
            },
            'traduzir' => function (array $a) {
                list($entrada, $trail, $caminho) = cmd_imagem_alvo($a);
                $produto = $entrada['dados'];
                cmd_definir_trail($produto, $trail, $caminho);
                $semAlteracao = $produto === $entrada['dados'];
                $entrada['dados'] = $produto;
                cmd_definir_galeria_entrada($entrada);
                return array('galeria' => array(array(
                    'key' => $entrada['chave'],
                    'slug' => $entrada['slug'],
                    'product' => $produto,
                    'revision' => $entrada['revisao'],
                    'semAlteracao' => $semAlteracao,
                )));
            },
        ),

        'imagem-concluida' => array(
            'dominio' => 'galeria',
            'titulo' => 'Estado de revisão de uma imagem',
            'descricao' => 'Marca um slot da galeria como concluído ou pendente. Não muda a imagem publicada.',
            'parametros' => array(
                'chave' => 'identificador estável do slot, devolvido pela galeria',
                'concluida' => '1 para concluída, 0 para pendente',
            ),
            'exemplo' => 'op=imagem-concluida&chave=imanes-loja|designs|esperanca-01|image&concluida=1',
            'prever' => function (array $a) {
                $chave = cmd_texto($a, 'chave');
                if (strlen($chave) > 400) cmd_erro('A chave da imagem é demasiado comprida.');
                cmd_api('galeria');
                $done = cmd_estado('galeria-done');
                $antes = in_array($chave, $done, true) ? 'concluída' : 'pendente';
                return array(cmd_linha('content/galeria-estado.json', $chave, $antes, cmd_booleano($a, 'concluida') ? 'concluída' : 'pendente'));
            },
            'traduzir' => function (array $a) {
                $chave = cmd_texto($a, 'chave');
                $done = cmd_booleano($a, 'concluida');
                $estado = cmd_estado('galeria-done');
                return array('galeria' => array(array(
                    'op' => 'estado-concluida', 'key' => $chave, 'done' => $done,
                    'semAlteracao' => in_array($chave, $estado, true) === $done,
                )));
            },
        ),

        // ══ Homepage e menu ═════════════════════════════════════════════════

        'homepage-campo' => array(
            'dominio' => 'home',
            'titulo' => 'Campo de um cartão da homepage',
            'descricao' => 'Muda um texto ou a imagem de um cartão da homepage. O índice conta do zero, pela ordem em que aparecem em homepage-menu-api.php?action=data.',
            'parametros' => array(
                'indice' => 'posição do cartão, a começar em 0',
                'campo' => 'title, menuTitle, subtitle, menuGroup, actionText, image, menuHref, menuIcon, featureLabel, menuOrder, menuGroupOrder, available, clickable, carouselEnabled ou menuHidden',
                'valor' => 'texto, número ou 1/0 conforme o campo',
            ),
            'exemplo' => 'op=homepage-campo&indice=0&campo=subtitle&valor=Feitos à mão, um a um',
            'prever' => function (array $a) {
                cmd_api('homepage-menu');
                $indice = cmd_inteiro_intervalo($a, 'indice', 0, 999);
                $campo = cmd_enum($a, 'campo', array_merge(HOMEPAGE_CAMPOS_TEXTO, HOMEPAGE_CAMPOS_NUMERO, HOMEPAGE_CAMPOS_BOOL));
                $valor = cmd_home_categoria_valor($a, $campo);
                $estado = cmd_estado('home');
                if (!isset($estado['categories'][$indice])) {
                    cmd_erro('Não existe o cartão ' . $indice . ' na homepage.');
                }
                $antes = isset($estado['categories'][$indice][$campo]) ? $estado['categories'][$indice][$campo] : null;
                $rotulo = isset($estado['categories'][$indice]['title']) ? $estado['categories'][$indice]['title'] : ('cartão ' . $indice);
                return array(cmd_linha('content/home.json', $rotulo . ' → ' . $campo, cmd_mostrar($antes), $valor));
            },
            'traduzir' => function (array $a) {
                cmd_api('homepage-menu');
                return array('home' => array(array(
                    'op' => 'categoria',
                    'indice' => cmd_inteiro_intervalo($a, 'indice', 0, 999),
                    'campo' => $campo = cmd_enum($a, 'campo', array_merge(HOMEPAGE_CAMPOS_TEXTO, HOMEPAGE_CAMPOS_NUMERO, HOMEPAGE_CAMPOS_BOOL)),
                    'valor' => cmd_home_categoria_valor($a, $campo),
                )));
            },
        ),

        'seccao-campo' => array(
            'dominio' => 'home',
            'titulo' => 'Texto de uma secção da homepage',
            'descricao' => 'Muda o sobretítulo, o título ou o texto de uma secção da homepage.',
            'parametros' => array(
                'seccao' => 'id da secção',
                'campo' => 'eyebrow, title, text, layout, maxCards ou repeatInGrid',
                'valor' => 'texto, número ou 1/0 conforme o campo',
            ),
            'exemplo' => 'op=seccao-campo&seccao=novidades&campo=title&valor=Novidades',
            'prever' => function (array $a) {
                $id = cmd_texto($a, 'seccao');
                $campo = cmd_enum($a, 'campo', array('eyebrow', 'title', 'text', 'layout', 'maxCards', 'repeatInGrid'));
                $valor = cmd_seccao_valor($a, $campo);
                $estado = cmd_estado('home');
                $antes = null;
                foreach ((isset($estado['homeSections']) ? $estado['homeSections'] : array()) as $s) {
                    if (isset($s['id']) && $s['id'] === $id) {
                        $antes = isset($s[$campo]) ? $s[$campo] : '';
                    }
                }
                if ($antes === null) {
                    cmd_erro('Não existe a secção "' . $id . '".');
                }
                return array(cmd_linha('content/home.json', 'secção ' . $id . ' → ' . $campo, cmd_mostrar($antes), $valor));
            },
            'traduzir' => function (array $a) {
                return array('home' => array(array(
                    'op' => 'seccao',
                    'seccao' => cmd_texto($a, 'seccao'),
                    'campo' => $campo = cmd_enum($a, 'campo', array('eyebrow', 'title', 'text', 'layout', 'maxCards', 'repeatInGrid')),
                    'valor' => cmd_seccao_valor($a, $campo),
                )));
            },
        ),

        'seccao-adicionar' => array(
            'dominio' => 'home',
            'titulo' => 'Secção nova na homepage',
            'descricao' => 'Cria uma secção vazia no fim da homepage.',
            'parametros' => array(
                'seccao' => 'id novo, só minúsculas, números e hífenes',
                'titulo' => 'título da secção (opcional)',
            ),
            'exemplo' => 'op=seccao-adicionar&seccao=novidades&titulo=Novidades',
            'prever' => function (array $a) {
                $id = cmd_texto($a, 'seccao');
                return array(cmd_linha('content/home.json', 'secção ' . $id, 'não existe', cmd_texto($a, 'titulo', $id)));
            },
            'traduzir' => function (array $a) {
                return array('home' => array(array(
                    'op' => 'seccao-adicionar',
                    'seccao' => cmd_texto($a, 'seccao'),
                    'titulo' => cmd_texto($a, 'titulo', cmd_texto($a, 'seccao')),
                )));
            },
        ),

        'seccao-remover' => array(
            'dominio' => 'home',
            'titulo' => 'Remover uma secção da homepage',
            'descricao' => 'Remove a secção e desloca os seus cartões para a primeira grelha restante, tal como o editor.',
            'parametros' => array('seccao' => 'id da secção'),
            'exemplo' => 'op=seccao-remover&seccao=novidades',
            'prever' => function (array $a) {
                $id = cmd_texto($a, 'seccao');
                $estado = cmd_estado('home');
                $indice = hm_indice_seccao($estado, $id);
                if ($indice < 0) cmd_erro('Não existe a secção "' . $id . '".');
                $restantes = $estado['homeSections'];
                array_splice($restantes, $indice, 1);
                if (hm_primeira_grelha($restantes) === '') cmd_erro('Não posso remover a última secção em grelha.');
                $movidos = 0;
                foreach ($estado['categories'] as $categoria) {
                    if (isset($categoria['section']) && (string)$categoria['section'] === $id) $movidos++;
                }
                return array(cmd_linha('content/home.json', 'secção ' . $id, $movidos . ' cartões associados', 'removida; cartões deslocados'));
            },
            'traduzir' => function (array $a) {
                return array('home' => array(array('op' => 'seccao-remover', 'seccao' => cmd_texto($a, 'seccao'))));
            },
        ),

        'ordem-homepage' => array(
            'dominio' => 'home',
            'titulo' => 'Ordem dos cartões na homepage',
            'descricao' => 'Define a ordem completa dos ids de cartão, separados por vírgulas. A lista tem de conter cada cartão exactamente uma vez.',
            'parametros' => array('ids' => 'ids completos, por ordem, separados por vírgulas'),
            'exemplo' => 'op=ordem-homepage&ids=personalizacao,quadros,agendas,cadernos-geral,mini-cadernos-geral,blocos-a6,bloquinhos,pasta-de-folhetos,crachas-geral,porta-chaves,imanes-geral,imanes-recortados,stickers,marcadores,marcadores-magneticos,postais,congressos,ofertas',
            'prever' => function (array $a) {
                $ids = cmd_csv($a, 'ids');
                $estado = cmd_estado('home');
                $actuais = array();
                foreach ($estado['categories'] as $categoria) if (isset($categoria['id'])) $actuais[] = (string)$categoria['id'];
                if (count($ids) !== count($actuais) || count(array_unique($ids)) !== count($ids)
                    || array_diff($ids, $actuais) || array_diff($actuais, $ids)) {
                    cmd_erro('`ids` tem de listar todos os cartões existentes, uma vez cada.');
                }
                return array(cmd_linha('content/home.json', 'ordem da homepage', implode(', ', $actuais), implode(', ', $ids)));
            },
            'traduzir' => function (array $a) {
                return array('home' => array(array('op' => 'ordem-homepage', 'ids' => cmd_csv($a, 'ids'))));
            },
        ),

        'ordem-menu' => array(
            'dominio' => 'home',
            'titulo' => 'Mover um cartão no menu',
            'descricao' => 'Move um cartão para um grupo e posição do menu, sem exigir que o link transporte toda a estrutura interna.',
            'parametros' => array(
                'cartao' => 'id do cartão a mover',
                'grupo' => 'nome do grupo de destino',
                'antes' => 'id do cartão antes do qual entra; vazio significa fim do grupo (opcional)',
            ),
            'exemplo' => 'op=ordem-menu&cartao=agendas&grupo=Cadernos e papelaria&antes=cadernos-geral',
            'prever' => function (array $a) {
                list(, $antes, $depois) = cmd_menu_mover($a);
                return array(cmd_linha('content/home.json', 'menu', $antes, $depois));
            },
            'traduzir' => function (array $a) {
                list($grupos) = cmd_menu_mover($a);
                return array('home' => array(array('op' => 'ordem-menu', 'grupos' => $grupos)));
            },
        ),

        'menu-accordion' => array(
            'dominio' => 'home',
            'titulo' => 'Abrir grupos do menu em acordeão',
            'descricao' => 'Activa ou desactiva o comportamento de acordeão no menu móvel.',
            'parametros' => array('activo' => '1 para activar, 0 para desactivar'),
            'exemplo' => 'op=menu-accordion&activo=1',
            'prever' => function (array $a) {
                $activo = cmd_booleano($a, 'activo');
                $estado = cmd_estado('home');
                return array(cmd_linha('content/home.json', 'menu acordeão', !empty($estado['menuAccordion']) ? 'activo' : 'inactivo', $activo ? 'activo' : 'inactivo'));
            },
            'traduzir' => function (array $a) {
                return array('home' => array(array('op' => 'menu-accordion', 'valor' => cmd_booleano($a, 'activo'))));
            },
        ),

        'menu-icones' => array(
            'dominio' => 'home',
            'titulo' => 'Mostrar ícones no menu',
            'descricao' => 'Mostra ou esconde os ícones dos cartões no menu.',
            'parametros' => array('activo' => '1 para mostrar, 0 para esconder'),
            'exemplo' => 'op=menu-icones&activo=1',
            'prever' => function (array $a) {
                $activo = cmd_booleano($a, 'activo');
                $estado = cmd_estado('home');
                return array(cmd_linha('content/home.json', 'ícones do menu', !empty($estado['menuShowIcons']) ? 'visíveis' : 'escondidos', $activo ? 'visíveis' : 'escondidos'));
            },
            'traduzir' => function (array $a) {
                return array('home' => array(array('op' => 'menu-icones', 'valor' => cmd_booleano($a, 'activo'))));
            },
        ),

        // ══ Carrosséis ══════════════════════════════════════════════════════

        'carrossel-global' => array(
            'dominio' => 'carrossel',
            'titulo' => 'Definição global dos carrosséis',
            'descricao' => 'Muda um campo do bloco global, que todos os carrosséis herdam quando não têm valor próprio.',
            'parametros' => array(
                'campo' => 'enabled, randomizeOnLoad, intervalMs, speedSeconds, zoomPercent, panPercent ou overlayOpacity',
                'valor' => '1/0 nos booleanos; número nos restantes campos',
            ),
            'exemplo' => 'op=carrossel-global&campo=enabled&valor=1',
            'prever' => function (array $a) {
                list($campo, $valor) = cmd_carrossel_global_valor($a);
                $estado = cmd_estado('home');
                $antes = isset($estado['carousel'][$campo]) ? $estado['carousel'][$campo] : null;
                return array(cmd_linha('content/home.json', 'carrossel global → ' . $campo, cmd_mostrar($antes), $valor));
            },
            'traduzir' => function (array $a) {
                list($campo, $valor) = cmd_carrossel_global_valor($a);
                return array('carrossel' => array(array(
                    'op' => 'global',
                    'campo' => $campo,
                    'valor' => $valor,
                )));
            },
        ),

        'carrossel-repor-globais' => array(
            'dominio' => 'carrossel',
            'titulo' => 'Repor heranças globais dos carrosséis',
            'descricao' => 'Limpa os ajustes próprios dos slides para os valores globais voltarem a mandar.',
            'parametros' => array(),
            'exemplo' => 'op=carrossel-repor-globais',
            'prever' => function (array $a) {
                $estado = cmd_estado('home');
                $n = 0;
                foreach ((array)$estado['categories'] as $categoria) $n += count(carousel_slides($categoria));
                return array(cmd_linha('content/home.json', 'carrosséis', $n . ' slides com possíveis ajustes', 'ajustes próprios limpos'));
            },
            'traduzir' => function (array $a) {
                return array('carrossel' => array(array('op' => 'repor-globais')));
            },
        ),

        'carrossel-cartao' => array(
            'dominio' => 'carrossel',
            'titulo' => 'Estado de um cartão de carrossel',
            'descricao' => 'Activa/desactiva o carrossel de um cartão e decide se as imagens aparecem em ordem aleatória.',
            'parametros' => array(
                'cartao' => 'id do cartão da homepage',
                'activo' => '1 ou 0 (opcional)',
                'aleatorio' => '1 ou 0 (opcional)',
            ),
            'exemplo' => 'op=carrossel-cartao&cartao=agendas&aleatorio=0',
            'prever' => function (array $a) {
                list($cartao, $slides) = cmd_carrossel_cartao($a);
                if ((!isset($a['activo']) || $a['activo'] === '') && (!isset($a['aleatorio']) || $a['aleatorio'] === '')) {
                    cmd_erro('Indica `activo` ou `aleatorio`.');
                }
                $antes = (!isset($cartao['carouselEnabled']) || !empty($cartao['carouselEnabled']) ? 'activo' : 'inactivo')
                    . ', ' . (!isset($cartao['carouselRandomizeOnLoad']) || !empty($cartao['carouselRandomizeOnLoad']) ? 'aleatório' : 'por ordem');
                $depois = isset($a['activo']) && $a['activo'] !== '' ? (cmd_booleano($a, 'activo') ? 'activo' : 'inactivo')
                    : (!isset($cartao['carouselEnabled']) || !empty($cartao['carouselEnabled']) ? 'activo' : 'inactivo');
                $depois .= ', ' . (isset($a['aleatorio']) && $a['aleatorio'] !== '' ? (cmd_booleano($a, 'aleatorio') ? 'aleatório' : 'por ordem') : (!isset($cartao['carouselRandomizeOnLoad']) || !empty($cartao['carouselRandomizeOnLoad']) ? 'aleatório' : 'por ordem'));
                return array(cmd_linha('content/home.json', $cartao['id'] . ' (' . count($slides) . ' slides)', $antes, $depois));
            },
            'traduzir' => function (array $a) {
                list($cartao, $slides) = cmd_carrossel_cartao($a);
                $op = array('op' => 'cartao-definir', 'cartao' => $cartao['id'], 'slides' => $slides);
                if (isset($a['activo']) && $a['activo'] !== '') $op['activo'] = cmd_booleano($a, 'activo');
                if (isset($a['aleatorio']) && $a['aleatorio'] !== '') $op['aleatorio'] = cmd_booleano($a, 'aleatorio');
                return array('carrossel' => array($op));
            },
        ),

        'carrossel-slide' => array(
            'dominio' => 'carrossel',
            'titulo' => 'Adicionar, alterar ou remover um slide',
            'descricao' => 'Edita uma imagem de carrossel. Os campos numéricos são opcionais e, se omitidos, deixam o slide herdar o global.',
            'parametros' => array(
                'cartao' => 'id do cartão da homepage', 'accao' => 'adicionar, alterar ou remover',
                'indice' => 'posição a começar em 0; ao adicionar, omitir para pôr no fim',
                'caminho' => 'imagem dentro de content/, obrigatória ao adicionar',
                'visivel' => '1 ou 0 (opcional)', 'intervalMs' => '800 a 30000 (opcional)',
                'speedSeconds' => '3 a 30 (opcional)', 'zoomPercent' => '100 a 140 (opcional)',
                'panPercent' => '0 a 18 (opcional)', 'overlayOpacity' => '0 a 80 (opcional)',
            ),
            'exemplo' => 'op=carrossel-slide&cartao=agendas&accao=adicionar&caminho=content/uploads/galeria/agenda.webp',
            'prever' => function (array $a) {
                list($cartao, , $antes, $depois, $accao) = cmd_carrossel_slides_alterar($a);
                return array(cmd_linha('content/home.json', $cartao['id'] . ' → slide ' . (isset($a['indice']) ? $a['indice'] : 'fim'), $antes, $accao . ': ' . $depois));
            },
            'traduzir' => function (array $a) {
                list($cartao, $slides) = cmd_carrossel_slides_alterar($a);
                return array('carrossel' => array(array(
                    'op' => 'cartao-definir', 'cartao' => $cartao['id'],
                    'activo' => !isset($cartao['carouselEnabled']) || !empty($cartao['carouselEnabled']),
                    'aleatorio' => !isset($cartao['carouselRandomizeOnLoad']) || !empty($cartao['carouselRandomizeOnLoad']),
                    'slides' => $slides,
                )));
            },
        ),

        // ══ Reviews ═════════════════════════════════════════════════════════

        'review' => array(
            'dominio' => 'reviews',
            'titulo' => 'Review nova ou alterada',
            'descricao' => 'Acrescenta um testemunho, ou actualiza o que tiver o mesmo id.',
            'parametros' => array(
                'nome' => 'quem escreveu',
                'texto' => 'o testemunho',
                'id' => 'id da review a actualizar (opcional)',
                'estrelas' => '1 a 5 (opcional)',
                'imagem' => 'caminho da imagem (opcional)',
                'data' => 'registo interno, ex.: 2026-08-08 (opcional)',
                'nota' => 'de que encomenda veio, registo interno (opcional)',
            ),
            'exemplo' => 'op=review&nome=Ana&texto=Ficaram lindos&estrelas=5&data=2026-08-08',
            'prever' => function (array $a) {
                $nome = cmd_texto($a, 'nome');
                $id = cmd_texto($a, 'id', '');
                $estado = cmd_estado('reviews');
                $antes = 'review nova';
                foreach ($estado['reviews'] as $r) {
                    if ($id !== '' && $r['id'] === $id) {
                        $antes = $r['name'] . ': ' . $r['text'];
                    }
                }
                return array(cmd_linha('content/reviews.json', 'review de ' . $nome, $antes, cmd_texto($a, 'texto', '')));
            },
            'traduzir' => function (array $a) {
                $estado = cmd_estado('reviews');
                $id = cmd_texto($a, 'id', '');
                $nova = array(
                    'id' => $id !== '' ? $id : 'review-' . substr(sha1(uniqid('', true)), 0, 10),
                    'enabled' => true,
                    'order' => count($estado['reviews']) + 1,
                    'name' => cmd_texto($a, 'nome'),
                    'text' => cmd_texto($a, 'texto', ''),
                    'date' => cmd_texto($a, 'data', ''),
                    'orderNote' => cmd_texto($a, 'nota', ''),
                    'image' => cmd_texto($a, 'imagem', ''),
                    'ratingMode' => isset($a['estrelas']) && $a['estrelas'] !== '' ? 'stars' : 'default',
                    'stars' => isset($a['estrelas']) && $a['estrelas'] !== '' ? cmd_inteiro_intervalo($a, 'estrelas', 1, 5) : 5,
                );
                $lista = array();
                $substituiu = false;
                foreach ($estado['reviews'] as $r) {
                    if ($id !== '' && $r['id'] === $id) {
                        $lista[] = array_merge($r, $nova);
                        $substituiu = true;
                    } else {
                        $lista[] = $r;
                    }
                }
                if (!$substituiu) {
                    $lista[] = $nova;
                }
                $estado['reviews'] = $lista;
                return array('reviews' => array(cmd_reviews_normalizados($estado)));
            },
        ),

        'review-campo' => array(
            'dominio' => 'reviews',
            'titulo' => 'Campo de uma review',
            'descricao' => 'Altera um campo de uma review existente sem apagar os restantes dados.',
            'parametros' => array(
                'id' => 'id da review',
                'campo' => 'enabled, order, name, text, date, orderNote, image, linkEnabled, link, ratingMode, stars, icon ou customIcon',
                'valor' => 'novo valor; 1 ou 0 nos campos booleanos',
            ),
            'exemplo' => 'op=review-campo&id=review-wa-01&campo=enabled&valor=1',
            'prever' => function (array $a) {
                $id = cmd_texto($a, 'id');
                $campo = cmd_enum($a, 'campo', array('enabled', 'order', 'name', 'text', 'date', 'orderNote', 'image', 'linkEnabled', 'link', 'ratingMode', 'stars', 'icon', 'customIcon'));
                $estado = cmd_estado('reviews');
                foreach ($estado['reviews'] as $i => $review) {
                    if ($review['id'] === $id) {
                        $proposto = $estado;
                        $proposto['reviews'][$i][$campo] = cmd_review_valor($a, $campo);
                        $normalizado = cmd_reviews_normalizados($proposto);
                        foreach ($normalizado['reviews'] as $final) {
                            if ($final['id'] === $id) {
                                return array(cmd_linha('content/reviews.json', $id . ' → ' . $campo, cmd_mostrar(isset($review[$campo]) ? $review[$campo] : ''), cmd_mostrar(isset($final[$campo]) ? $final[$campo] : '')));
                            }
                        }
                        cmd_erro('A normalização removeu a review "' . $id . '".');
                    }
                }
                cmd_erro('Não existe a review "' . $id . '".');
            },
            'traduzir' => function (array $a) {
                $id = cmd_texto($a, 'id');
                $campo = cmd_enum($a, 'campo', array('enabled', 'order', 'name', 'text', 'date', 'orderNote', 'image', 'linkEnabled', 'link', 'ratingMode', 'stars', 'icon', 'customIcon'));
                $estado = cmd_estado('reviews');
                foreach ($estado['reviews'] as $i => $review) {
                    if ($review['id'] === $id) {
                        $estado['reviews'][$i][$campo] = cmd_review_valor($a, $campo);
                        return array('reviews' => array(cmd_reviews_normalizados($estado)));
                    }
                }
                cmd_erro('Não existe a review "' . $id . '".');
            },
        ),

        'reviews-definicoes' => array(
            'dominio' => 'reviews',
            'titulo' => 'Definição global das reviews',
            'descricao' => 'Muda uma definição do painel de reviews, incluindo posição, tema, ritmo e apresentação.',
            'parametros' => array(
                'campo' => 'enabled, intervalMs, position, size, theme, imageShape, showImage, showName, showText, defaultRatingMode, defaultStars, defaultIcon, defaultCustomIcon ou eggPumps',
                'valor' => 'novo valor; 1 ou 0 nos campos booleanos',
            ),
            'exemplo' => 'op=reviews-definicoes&campo=position&valor=right',
            'prever' => function (array $a) {
                $campo = cmd_enum($a, 'campo', array('enabled', 'intervalMs', 'position', 'size', 'theme', 'imageShape', 'showImage', 'showName', 'showText', 'defaultRatingMode', 'defaultStars', 'defaultIcon', 'defaultCustomIcon', 'eggPumps'));
                $estado = cmd_estado('reviews');
                return array(cmd_linha('content/reviews.json', 'definições → ' . $campo, cmd_mostrar(isset($estado['settings'][$campo]) ? $estado['settings'][$campo] : ''), cmd_mostrar(cmd_reviews_definicao_valor($a, $campo))));
            },
            'traduzir' => function (array $a) {
                $campo = cmd_enum($a, 'campo', array('enabled', 'intervalMs', 'position', 'size', 'theme', 'imageShape', 'showImage', 'showName', 'showText', 'defaultRatingMode', 'defaultStars', 'defaultIcon', 'defaultCustomIcon', 'eggPumps'));
                $estado = cmd_estado('reviews');
                if (!isset($estado['settings']) || !is_array($estado['settings'])) $estado['settings'] = array();
                $estado['settings'][$campo] = cmd_reviews_definicao_valor($a, $campo);
                return array('reviews' => array(cmd_reviews_normalizados($estado)));
            },
        ),

        'review-apagar' => array(
            'dominio' => 'reviews',
            'titulo' => 'Apagar uma review',
            'descricao' => 'Remove um testemunho pelo id.',
            'parametros' => array('id' => 'id da review'),
            'exemplo' => 'op=review-apagar&id=review-wa-01',
            'prever' => function (array $a) {
                $id = cmd_texto($a, 'id');
                $estado = cmd_estado('reviews');
                foreach ($estado['reviews'] as $r) {
                    if ($r['id'] === $id) {
                        return array(cmd_linha('content/reviews.json', 'review ' . $id, $r['name'] . ': ' . $r['text'], 'apagada'));
                    }
                }
                cmd_erro('Não existe a review "' . $id . '".');
            },
            'traduzir' => function (array $a) {
                $id = cmd_texto($a, 'id');
                $estado = cmd_estado('reviews');
                $lista = array();
                foreach ($estado['reviews'] as $r) {
                    if ($r['id'] !== $id) {
                        $lista[] = $r;
                    }
                }
                $estado['reviews'] = $lista;
                return array('reviews' => array(cmd_reviews_normalizados($estado)));
            },
        ),
    );

    return $registo;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Ajudas partilhadas por mais de uma operação
// ─────────────────────────────────────────────────────────────────────────────

function cmd_escada(array $a, $omissao)
{
    $escada = isset($a['escada']) && $a['escada'] !== '' ? strtoupper(trim((string)$a['escada'])) : $omissao;
    if ($escada === null) {
        cmd_erro('Falta a `escada` (D1, D2, D3 ou D4).');
    }
    if (!in_array($escada, array('D1', 'D2', 'D3', 'D4'), true)) {
        cmd_erro('Escada desconhecida: ' . $escada . '. Só existem D1, D2, D3 e D4.');
    }
    return $escada;
}

/** Resolve os alvos de `op=desconto`, usados na previsão e na tradução. */
function cmd_desconto_alvo(array $a)
{
    $produto = cmd_texto($a, 'produto');
    $chave = cmd_texto($a, 'chave');
    $qtd = (string)cmd_quantidade_pack($a);
    $percent = round(cmd_numero_intervalo($a, 'percent', 0, 99), 1);
    if ($percent > 99) {
        cmd_erro('`percent` tem de estar entre 0 e 99.');
    }

    $bloco = cmd_ler_trail(cmd_estado('precos'), array('products', $produto, 'discountsByPriceKey', $chave));
    if (!is_array($bloco)) {
        cmd_erro('Não encontrei descontos para a tabela "' . $chave . '" em ' . $produto . '.');
    }
    // Sem `escada`, mexe-se na que está a ser aplicada — que é o que a pessoa
    // quer dizer quando pede «muda o desconto do pack de 3».
    $escada = cmd_escada($a, isset($bloco['activo']) ? $bloco['activo'] : 'D1');

    $tabela = cmd_ler_trail(cmd_estado('precos'), array('products', $produto, 'prices', $chave, $qtd));
    if ($tabela === null) {
        cmd_erro('Não existe o escalão ' . $qtd . ' na tabela "' . $chave . '" de ' . $produto . '.');
    }

    $antes = isset($bloco[$escada][$qtd]) ? $bloco[$escada][$qtd] : null;
    return array($produto, $chave, $qtd, $escada, $percent, $antes);
}

/** Carrega uma entrada da galeria uma vez por batch. */
function cmd_galeria_entrada($entradaId)
{
    $entradaId = trim((string)$entradaId);
    $chaveCache = 'galeria:' . $entradaId;
    $cache = &cmd_cache_estado();
    if (isset($cache[$chaveCache])) {
        return $cache[$chaveCache];
    }

    cmd_api('galeria');
    $chave = $entradaId === 'home' ? 'home' : $entradaId;
    $path = galeria_entry_path($chave, $entradaId);
    if (!$path || !is_file($path)) {
        cmd_erro('Não encontrei a entrada "' . $entradaId . '". Usa o slug do produto ou "home".');
    }

    $bruto = (string)@file_get_contents($path);
    $dados = json_decode($bruto, true);
    if (!is_array($dados)) {
        cmd_erro('O ficheiro de "' . $entradaId . '" não contém JSON válido.');
    }
    $parsed = $chave === 'home' ? array('slug' => 'home') : galeria_parse_entry_key($chave, $entradaId);
    $cache[$chaveCache] = array(
        'cacheKey' => $chaveCache,
        'chave' => $chave,
        'slug' => $parsed ? $parsed['slug'] : $entradaId,
        'dados' => $dados,
        'revisao' => hash('sha256', $bruto),
        'rotulo' => str_replace('\\', '/', substr($path, strlen(dirname(__DIR__)) + 1)),
    );
    return $cache[$chaveCache];
}

function cmd_definir_galeria_entrada(array $entrada)
{
    $cache = &cmd_cache_estado();
    $cache[$entrada['cacheKey']] = $entrada;
}

/** Resolve os alvos de `op=imagem`. */
function cmd_imagem_alvo(array $a)
{
    $entradaId = cmd_texto($a, 'entrada');
    $trail = cmd_trail(cmd_texto($a, 'trail'));
    $caminho = cmd_texto($a, 'caminho');

    cmd_api('galeria');
    if (!galeria_is_image_path($caminho) || !galeria_is_library_path($caminho)) {
        cmd_erro('"' . $caminho . '" não é uma imagem dentro de content/.');
    }

    // A API da galeria também valida a forma do caminho. Para um comando vindo
    // de um URL exigimos ainda que o ficheiro exista mesmo: assim um typo não
    // deixa uma imagem partida publicada e o realpath confirma que não há
    // travessia de directórios disfarçada por links simbólicos.
    $raizSite = realpath(__DIR__ . '/..');
    $ficheiro = $raizSite === false ? false : realpath($raizSite . DIRECTORY_SEPARATOR
        . str_replace('/', DIRECTORY_SEPARATOR, $caminho));
    if ($raizSite === false || $ficheiro === false || !is_file($ficheiro)
        || strncmp($ficheiro, $raizSite . DIRECTORY_SEPARATOR, strlen($raizSite) + 1) !== 0) {
        cmd_erro('Não encontrei a imagem "' . $caminho . '" na biblioteca.');
    }

    $entrada = cmd_galeria_entrada($entradaId);
    $dados = $entrada['dados'];
    $antes = cmd_ler_trail($dados, $trail);
    if ($antes === null) {
        cmd_erro('Não encontrei ' . implode(' → ', $trail) . ' em ' . basename($entrada['rotulo']) . '.');
    }
    if (is_array($antes)) {
        cmd_erro(implode(' → ', $trail) . ' não é uma imagem — é um bloco com ' . count($antes) . ' entradas.');
    }

    return array($entrada, $trail, $caminho, (string)$antes);
}

/** Escreve um valor no fundo de um caminho, sem criar chaves que não existiam. */
function cmd_definir_trail(&$dados, array $trail, $valor)
{
    $no = &$dados;
    foreach ($trail as $passo) {
        if (!is_array($no) || !array_key_exists($passo, $no)) {
            cmd_erro('Caminho inválido: ' . implode(' → ', $trail) . '.');
        }
        $no = &$no[$passo];
    }
    $no = $valor;
}

/**
 * Aplica em memória as operações nativas acabadas de compilar.
 *
 * Não substitui a validação das APIs: serve apenas para que a linha seguinte
 * de um batch veja a mesma fotografia de estado que a API receberá no fim.
 * As APIs continuam a validar e a escrever o resultado real.
 */
function cmd_estagiar_nativas(array $porDominio)
{
    foreach ($porDominio as $dominio => $alteracoes) {
        foreach ($alteracoes as $a) {
            if (!is_array($a)) {
                continue;
            }
            $op = isset($a['op']) ? (string)$a['op'] : '';

            if ($dominio === 'precos') {
                if ($op === 'ordem-tabs') {
                    cmd_definir_estado('precos-tabs', array_values((array)$a['ordem']));
                } elseif ($op === 'valor') {
                    $ficheiro = isset($a['ficheiro']) ? (string)$a['ficheiro'] : '';
                    $trail = isset($a['trail']) && is_array($a['trail']) ? $a['trail'] : array();
                    if ($ficheiro === 'pricing') {
                        $estado = cmd_estado('precos');
                        cmd_definir_trail($estado, $trail, (int)$a['cents']);
                        cmd_definir_estado('precos', $estado);
                    } elseif ($ficheiro !== '') {
                        $produto = cmd_produto_json($ficheiro);
                        cmd_definir_trail($produto, $trail, (int)$a['cents']);
                        cmd_definir_produto_json($ficheiro, $produto);
                    }
                } elseif ($op === 'texto') {
                    $ficheiro = isset($a['ficheiro']) ? (string)$a['ficheiro'] : '';
                    if ($ficheiro !== '') {
                        $produto = cmd_produto_json($ficheiro);
                        cmd_definir_trail($produto, (array)$a['trail'], (string)$a['texto']);
                        cmd_definir_produto_json($ficheiro, $produto);
                    }
                } elseif ($op === 'pack-adicionar' || $op === 'pack-remover' || $op === 'pack-renomear') {
                    $estado = cmd_estado('precos');
                    $tabela = &cmd_ler_trail_referencia($estado, array('products', (string)$a['slug'], 'prices', (string)$a['priceKey']));
                    if ($op === 'pack-adicionar') {
                        $tabela[(string)(int)$a['quantidade']] = (int)$a['cents'];
                    } elseif ($op === 'pack-remover') {
                        unset($tabela[(string)(int)$a['quantidade']]);
                    } else {
                        $de = (string)(int)$a['de'];
                        $cents = $tabela[$de];
                        unset($tabela[$de]);
                        $tabela[(string)(int)$a['para']] = $cents;
                    }
                    uksort($tabela, function ($x, $y) { return (int)$x - (int)$y; });
                    unset($tabela);
                    cmd_definir_estado('precos', $estado);
                } elseif ($op === 'descontos') {
                    $estado = cmd_estado('precos');
                    $estado['products'][(string)$a['slug']]['discountsByPriceKey'][(string)$a['priceKey']] = $a['bloco'];
                    cmd_definir_estado('precos', $estado);
                } elseif ($op === 'custo') {
                    $custos = cmd_estado('custos');
                    $slug = (string)$a['slug'];
                    $chave = (string)$a['priceKey'];
                    $cents = (int)$a['cents'];
                    if (!isset($custos['produtos']) || !is_array($custos['produtos'])) {
                        $custos['produtos'] = array();
                    }
                    if ($cents === 0) {
                        unset($custos['produtos'][$slug][$chave]);
                    } else {
                        $custos['produtos'][$slug][$chave] = $cents;
                    }
                    cmd_definir_estado('custos', $custos);
                } elseif ($op === 'modo') {
                    $slug = (string)$a['slug'];
                    $modo = (string)$a['pricingMode'];
                    $estado = cmd_estado('precos');
                    $estado['products'][$slug]['pricingMode'] = $modo;
                    $estado['products'][$slug]['allowUnitDiscounts'] = $modo !== 'flat-unit';
                    cmd_definir_estado('precos', $estado);

                    $produto = cmd_produto_json($slug);
                    $produto['pricingMode'] = $modo;
                    $produto['allowUnitDiscounts'] = $modo !== 'flat-unit';
                    $indice = precos_passo_pack($produto);
                    if ($indice !== null) {
                        if (array_key_exists('pricingMode', $produto['steps'][$indice])) {
                            $produto['steps'][$indice]['pricingMode'] = $modo;
                        }
                        if (array_key_exists('allowUnitDiscounts', $produto['steps'][$indice])) {
                            $produto['steps'][$indice]['allowUnitDiscounts'] = $modo !== 'flat-unit';
                        }
                    }
                    cmd_definir_produto_json($slug, $produto);
                } elseif ($op === 'variante') {
                    $slug = (string)$a['slug'];
                    $valor = (string)$a['valor'];
                    $cents = (int)$a['cents'];
                    $produto = cmd_produto_json($slug);
                    $indice = precos_passo_pack($produto);
                    $quantidade = 0;
                    if ($indice !== null) {
                        foreach ($produto['steps'][$indice]['items'] as $i => $item) {
                            if (isset($item['value']) && (string)$item['value'] === $valor) {
                                $quantidade = isset($item['quantity']) ? (int)$item['quantity'] : 0;
                                $produto['steps'][$indice]['items'][$i]['priceCents'] = $cents;
                                break;
                            }
                        }
                    }
                    cmd_definir_produto_json($slug, $produto);
                    $estado = cmd_estado('precos');
                    $chave = isset($estado['products'][$slug]['defaultPriceKey'])
                        ? (string)$estado['products'][$slug]['defaultPriceKey'] : '';
                    if ($chave !== '' && $quantidade > 0
                        && isset($estado['products'][$slug]['prices'][$chave][(string)$quantidade])) {
                        $estado['products'][$slug]['prices'][$chave][(string)$quantidade] = $cents;
                    }
                    if (isset($estado['products'][$slug]['flatUnitPricesCents'][$valor])) {
                        $estado['products'][$slug]['flatUnitPricesCents'][$valor] = $cents;
                    }
                    cmd_definir_estado('precos', $estado);
                }
                continue;
            }

            if ($dominio === 'materiais') {
                $estado = cmd_estado('materiais');
                if ($op === 'custo-hora') {
                    $estado['custoHoraCents'] = (int)$a['valor'];
                } elseif ($op === 'materiais-definir') {
                    $estado['materiais'] = (array)$a['materiais'];
                } elseif ($op === 'produto-definir') {
                    $estado['produtos'][(string)$a['produto']] = array(
                        'minutosPorUnidade' => isset($a['minutosPorUnidade']) ? $a['minutosPorUnidade'] : 0,
                        'linhas' => isset($a['linhas']) && is_array($a['linhas']) ? $a['linhas'] : array(),
                    );
                }
                cmd_definir_estado('materiais', $estado);
                continue;
            }

            if ($dominio === 'home') {
                $estado = cmd_estado('home');
                if ($op === 'categoria' && isset($estado['categories'][(int)$a['indice']])) {
                    $estado['categories'][(int)$a['indice']][(string)$a['campo']] = isset($a['valor']) ? $a['valor'] : null;
                } elseif ($op === 'seccao') {
                    $indice = hm_indice_seccao($estado, (string)$a['seccao']);
                    if ($indice >= 0) {
                        $estado['homeSections'][$indice][(string)$a['campo']] = isset($a['valor']) ? $a['valor'] : null;
                    }
                } elseif ($op === 'seccao-adicionar') {
                    hm_indice_seccao($estado, '');
                    $estado['homeSections'][] = array(
                        'id' => (string)$a['seccao'], 'layout' => 'grid',
                        'eyebrow' => '', 'title' => (string)$a['titulo'], 'text' => '',
                    );
                } elseif ($op === 'seccao-remover') {
                    $id = (string)$a['seccao'];
                    $indice = hm_indice_seccao($estado, $id);
                    if ($indice >= 0) {
                        array_splice($estado['homeSections'], $indice, 1);
                        $refugio = hm_seccao_refugio($estado['homeSections']);
                        foreach ($estado['categories'] as $i => $categoria) {
                            if (isset($categoria['section']) && (string)$categoria['section'] === $id) {
                                $estado['categories'][$i]['section'] = $refugio;
                            }
                        }
                    }
                } elseif ($op === 'ordem-homepage') {
                    $porId = array();
                    foreach ($estado['categories'] as $categoria) {
                        if (isset($categoria['id'])) $porId[(string)$categoria['id']] = $categoria;
                    }
                    $nova = array();
                    foreach ((array)$a['ids'] as $id) {
                        if (isset($porId[(string)$id])) $nova[] = $porId[(string)$id];
                    }
                    $estado['categories'] = $nova;
                } elseif ($op === 'ordem-menu') {
                    foreach ((array)$a['grupos'] as $iGrupo => $grupo) {
                        foreach ((array)(isset($grupo['itens']) ? $grupo['itens'] : array()) as $iItem => $id) {
                            foreach ($estado['categories'] as $i => $categoria) {
                                if (isset($categoria['id']) && (string)$categoria['id'] === (string)$id) {
                                    $estado['categories'][$i]['menuGroup'] = (string)$grupo['nome'];
                                    $estado['categories'][$i]['menuGroupOrder'] = $iGrupo + 1;
                                    $estado['categories'][$i]['menuOrder'] = $iItem + 1;
                                }
                            }
                        }
                    }
                } elseif ($op === 'menu-accordion') {
                    $estado['menuAccordion'] = !empty($a['valor']);
                } elseif ($op === 'menu-icones') {
                    $estado['menuShowIcons'] = !empty($a['valor']);
                }
                cmd_definir_estado('home', $estado);
                continue;
            }

            if ($dominio === 'carrossel') {
                $estado = cmd_estado('home');
                if (!isset($estado['carousel']) || !is_array($estado['carousel'])) {
                    $estado['carousel'] = carousel_global($estado);
                }
                if ($op === 'global') {
                    $estado['carousel'][(string)$a['campo']] = isset($a['valor']) ? $a['valor'] : null;
                } elseif ($op === 'repor-globais') {
                    foreach ($estado['categories'] as $i => $categoria) {
                        if (!isset($categoria['carouselSlides']) || !is_array($categoria['carouselSlides'])) continue;
                        foreach ($categoria['carouselSlides'] as $j => $slide) {
                            foreach (CAROUSEL_CAMPOS as $campo) $estado['categories'][$i]['carouselSlides'][$j][$campo] = null;
                        }
                    }
                } elseif ($op === 'cartao-definir') {
                    foreach ($estado['categories'] as $i => $categoria) {
                        if (!isset($categoria['id']) || (string)$categoria['id'] !== (string)$a['cartao']) continue;
                        if (isset($a['activo'])) $estado['categories'][$i]['carouselEnabled'] = !empty($a['activo']);
                        if (isset($a['aleatorio'])) $estado['categories'][$i]['carouselRandomizeOnLoad'] = !empty($a['aleatorio']);
                        $estado['categories'][$i]['carouselSlides'] = (array)$a['slides'];
                        break;
                    }
                }
                cmd_definir_estado('home', $estado);
                continue;
            }

            if ($dominio === 'galeria') {
                foreach ($alteracoes as $galeria) {
                    if (!is_array($galeria) || !isset($galeria['op']) || $galeria['op'] !== 'estado-concluida') continue;
                    $done = cmd_estado('galeria-done');
                    $done = array_values(array_filter($done, function ($chave) use ($galeria) {
                        return (string)$chave !== (string)$galeria['key'];
                    }));
                    if (!empty($galeria['done'])) $done[] = (string)$galeria['key'];
                    sort($done);
                    cmd_definir_estado('galeria-done', $done);
                }
                continue;
            }

            if ($dominio === 'reviews' && isset($a['reviews']) && is_array($a['reviews'])) {
                cmd_definir_estado('reviews', $a);
            }
        }
    }
}

/** Referência segura a um caminho já existente dentro de um array. */
function &cmd_ler_trail_referencia(&$dados, array $trail)
{
    $no = &$dados;
    foreach ($trail as $passo) {
        if (!is_array($no) || !array_key_exists($passo, $no)) {
            cmd_erro('Caminho inválido: ' . implode(' → ', $trail) . '.');
        }
        $no = &$no[$passo];
    }
    return $no;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Ler os comandos de um URL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aceita duas formas:
 *
 *   ?op=preco&produto=…                    — um comando só
 *   ?c[0][op]=preco&c[0][produto]=…&c[1]… — vários, pela ordem dos índices
 */
function cmd_ler_pedido(array $query)
{
    $comandos = array();

    if (isset($query['c']) && is_array($query['c'])) {
        $indices = array_keys($query['c']);
        sort($indices, SORT_NATURAL);
        foreach ($indices as $i) {
            if (is_array($query['c'][$i])) {
                $comandos[] = $query['c'][$i];
            }
        }
    }

    if (isset($query['op']) && !is_array($query['op'])) {
        $solto = $query;
        unset($solto['c'], $solto['override'], $solto['csrf'], $solto['formato']);
        $comandos[] = $solto;
    }

    return $comandos;
}

/** Recusa gralhas e parâmetros escondidos antes de chegar a uma operação. */
function cmd_validar_argumentos(array $op, array $args)
{
    $permitidos = array('op' => true);
    foreach ((array)$op['parametros'] as $nome => $_) {
        foreach (explode('|', (string)$nome) as $alternativa) {
            $permitidos[$alternativa] = true;
        }
    }
    foreach ($args as $nome => $valor) {
        if (!isset($permitidos[$nome])) {
            cmd_erro('O parâmetro `' . $nome . '` não existe nesta operação.');
        }
        if (is_array($valor)) {
            cmd_erro('O parâmetro `' . $nome . '` tem de ter um valor simples, não uma lista.');
        }
    }
}

/**
 * Lê cada comando, valida-o e devolve o que vai mudar.
 *
 * Nada é escrito aqui. Um comando que não passe pára o lote inteiro: metade de
 * uma factura aplicada é pior do que nenhuma.
 */
function cmd_analisar(array $comandos)
{
    cmd_reiniciar_estado();
    $registo = cmd_registo();
    $resultado = array('ok' => true, 'comandos' => array(), 'nativas' => array(), 'erros' => array());

    if (count($comandos) > 40) {
        return array(
            'ok' => false, 'comandos' => array(), 'nativas' => array(),
            'erros' => array('Um batch aceita no máximo 40 comandos.'),
        );
    }

    foreach ($comandos as $n => $args) {
        $nome = isset($args['op']) ? trim((string)$args['op']) : '';
        $linha = array('n' => $n + 1, 'op' => $nome, 'args' => $args, 'mudancas' => array(), 'erro' => '');

        if (!isset($registo[$nome])) {
            $linha['erro'] = $nome === ''
                ? 'Comando sem `op`.'
                : 'Não existe a operação `' . $nome . '`.';
            $resultado['ok'] = false;
            $resultado['erros'][] = $linha['erro'];
            $resultado['comandos'][] = $linha;
            continue;
        }

        $op = $registo[$nome];
        $linha['titulo'] = $op['titulo'];
        $linha['dominio'] = $op['dominio'];

        try {
            cmd_validar_argumentos($op, $args);
            $linha['mudancas'] = call_user_func($op['prever'], $args);
            $nativasDaOperacao = call_user_func($op['traduzir'], $args);
            foreach ($nativasDaOperacao as $dominio => $nativas) {
                if (!isset($resultado['nativas'][$dominio])) {
                    $resultado['nativas'][$dominio] = array();
                }
                foreach ($nativas as $nativa) {
                    $resultado['nativas'][$dominio][] = $nativa;
                }
            }
            cmd_estagiar_nativas($nativasDaOperacao);
        } catch (CmdErro $e) {
            // Um `prever` pode ter conseguido construir linhas antes de a
            // tradução descobrir uma regra mais específica. Um comando
            // inválido nunca pode transportar um preview que pareça válido.
            $linha['mudancas'] = array();
            $linha['erro'] = $e->getMessage();
            $resultado['ok'] = false;
            $resultado['erros'][] = 'Comando ' . ($n + 1) . ' (' . $nome . '): ' . $e->getMessage();
        }

        $resultado['comandos'][] = $linha;
    }

    if (!$comandos) {
        $resultado['ok'] = false;
        $resultado['erros'][] = 'O link não trazia comando nenhum.';
    }

    return $resultado;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Gravar — sempre pela API do editor, nunca por escrita própria
// ─────────────────────────────────────────────────────────────────────────────

/** Os ficheiros que uma operação de conteúdo pode tocar, fora da cápsula. */
function cmd_ficheiros_transacao(array $nativas = array())
{
    cmd_api('precos');
    cmd_api('materiais');
    cmd_api('homepage-menu');
    cmd_api('reviews');
    cmd_api('galeria');

    $ficheiros = array(PRECOS_PRICING_FILE, HOME_FILE, REVIEWS_FILE, precos_custos_path(), precos_prefs_path(), GALERIA_STATE_FILE);
    $materiais = function_exists('mat_path') ? mat_path() : mp_private_path('materiais.json');
    if ($materiais !== '') {
        $ficheiros[] = $materiais;
    }
    foreach ((array)glob(PRECOS_PRODUCTS_DIR . '/*.json') as $path) {
        $ficheiros[] = $path;
    }

    // A galeria pode editar JSONs de contextos que não pertencem ao catálogo.
    // Junta-os à fotografia, mas nunca aceita um caminho vindo directamente do URL.
    if (isset($nativas['galeria']) && is_array($nativas['galeria'])) {
        cmd_api('galeria');
        foreach ($nativas['galeria'] as $entrada) {
            if (!is_array($entrada)) {
                continue;
            }
            $chave = isset($entrada['key']) ? (string)$entrada['key'] : '';
            $slug = isset($entrada['slug']) ? (string)$entrada['slug'] : '';
            $path = galeria_entry_path($chave, $slug);
            if ($path && is_file($path)) {
                $ficheiros[] = $path;
            }
        }
    }
    return array_values(array_unique(array_filter($ficheiros, function ($path) {
        return is_string($path) && $path !== '';
    })));
}

function cmd_ler_ficheiro_transacao($path)
{
    $existe = is_file($path);
    $bytes = $existe ? @file_get_contents($path) : false;
    if ($existe && $bytes === false) {
        cmd_erro('Não consegui preparar a transação: não li ' . basename($path) . '.');
    }
    return array('existe' => $existe, 'bytes' => $existe ? (string)$bytes : '', 'hash' => $existe ? hash('sha256', (string)$bytes) : '');
}

function cmd_transacao_abrir(array $nativas = array())
{
    $base = array();
    foreach (cmd_ficheiros_transacao($nativas) as $path) {
        $base[$path] = cmd_ler_ficheiro_transacao($path);
    }
    return array('base' => $base, 'visto' => $base);
}

function cmd_transacao_registar(&$transacao)
{
    foreach (array_keys($transacao['base']) as $path) {
        $transacao['visto'][$path] = cmd_ler_ficheiro_transacao($path);
    }
}

/** Restaura bytes sem reinterpretar JSON, para o rollback ser exacto. */
function cmd_restaurar_bytes($path, $bytes)
{
    if (!is_dir(dirname($path))) {
        return false;
    }
    $temporario = $path . '.comandos-rollback-' . bin2hex(random_bytes(4));
    if (@file_put_contents($temporario, $bytes, LOCK_EX) !== strlen($bytes)) {
        @unlink($temporario);
        return false;
    }
    if (@rename($temporario, $path)) {
        return true;
    }
    // Em Windows rename não substitui um ficheiro existente.
    if (is_file($path) && @unlink($path) && @rename($temporario, $path)) {
        return true;
    }
    @unlink($temporario);
    return false;
}

/**
 * Rollback compensatório. Só repõe um ficheiro se ele ainda tiver os bytes que
 * o próprio batch deixou; uma alteração concorrente nunca é apagada.
 */
function cmd_transacao_reverter(array $transacao)
{
    $problemas = array();
    foreach ($transacao['base'] as $path => $antes) {
        $depois = $transacao['visto'][$path];
        if ($antes['existe'] === $depois['existe'] && $antes['hash'] === $depois['hash']) {
            continue;
        }
        $actual = cmd_ler_ficheiro_transacao($path);
        if ($actual['existe'] !== $depois['existe'] || $actual['hash'] !== $depois['hash']) {
            $problemas[] = basename($path) . ': mudou entretanto; não o repus por segurança.';
            continue;
        }
        if ($antes['existe']) {
            if (!cmd_restaurar_bytes($path, $antes['bytes'])) {
                $problemas[] = basename($path) . ': falhou a reposição.';
            }
        } elseif (is_file($path) && !@unlink($path)) {
            $problemas[] = basename($path) . ': foi criado e não consegui removê-lo.';
        }
    }
    return $problemas;
}

function cmd_aplicar(array $nativas)
{
    $relatorio = array();
    try {
        $transacao = cmd_transacao_abrir($nativas);
    } catch (CmdErro $erro) {
        return array(array('dominio' => 'transacao', 'ok' => false, 'estado' => 500, 'mensagem' => $erro->getMessage()));
    }

    foreach ($nativas as $dominio => $alteracoes) {
        if ($dominio === 'precos') {
            cmd_api('precos');
            $relatorio[] = cmd_correr($dominio, 'precos_gravar', array('alteracoes' => $alteracoes));
        } elseif ($dominio === 'materiais') {
            cmd_api('materiais');
            $relatorio[] = cmd_correr($dominio, 'mat_gravar_pedido', array('alteracoes' => $alteracoes));
        } elseif ($dominio === 'home') {
            cmd_api('homepage-menu');
            $relatorio[] = cmd_correr($dominio, 'hm_aplicar', array('alteracoes' => $alteracoes));
        } elseif ($dominio === 'carrossel') {
            cmd_api('carrousel');
            $relatorio[] = cmd_correr($dominio, 'cr_gravar', array('alteracoes' => $alteracoes));
        } elseif ($dominio === 'galeria') {
            cmd_api('galeria');
            $porEntrada = array();
            $estadosConcluidos = array();
            foreach ($alteracoes as $entrada) {
                if (isset($entrada['op']) && $entrada['op'] === 'estado-concluida') {
                    $chaveEstado = (string)$entrada['key'];
                    // Se a linha final é um no-op, mas uma anterior já tinha
                    // mudado o mesmo estado, conserva a alteração anterior.
                    if (!isset($estadosConcluidos[$chaveEstado]) || empty($entrada['semAlteracao'])) {
                        $estadosConcluidos[$chaveEstado] = $entrada;
                    }
                    continue;
                }
                $chaveEntrada = (string)$entrada['key'] . '|' . (string)$entrada['slug'];
                // Idem para duas trocas sucessivas da mesma imagem num batch.
                if (!isset($porEntrada[$chaveEntrada]) || empty($entrada['semAlteracao'])) {
                    $porEntrada[$chaveEntrada] = $entrada;
                }
            }
            foreach ($porEntrada as $entrada) {
                $relatorio[] = !empty($entrada['semAlteracao'])
                    ? array('dominio' => $dominio, 'ok' => true, 'estado' => 200, 'mensagem' => 'Sem alterações.')
                    : cmd_correr($dominio, 'galeria_gravar_entrada', $entrada, true);
            }
            foreach ($estadosConcluidos as $entrada) {
                $relatorio[] = !empty($entrada['semAlteracao'])
                    ? array('dominio' => $dominio, 'ok' => true, 'estado' => 200, 'mensagem' => 'Sem alterações.')
                    : cmd_correr($dominio, function ($dados) {
                    galeria_update_done($dados['key'], $dados['done']);
                    mp_responder_embutido(array('ok' => true), 200);
                }, array('key' => $entrada['key'], 'done' => $entrada['done']), true);
            }
        } elseif ($dominio === 'reviews') {
            cmd_api('reviews');
            if ($alteracoes) {
                // Cada operação transporta o estado completo; só a fotografia
                // final interessa e evita escritas intermédias.
                $relatorio[] = cmd_gravar_reviews($alteracoes[count($alteracoes) - 1]);
            }
        }

        cmd_transacao_registar($transacao);
        $falhou = false;
        foreach ($relatorio as $resultado) {
            if (empty($resultado['ok'])) {
                $falhou = true;
                break;
            }
        }
        if ($falhou) {
            $problemas = cmd_transacao_reverter($transacao);
            $relatorio[] = array(
                'dominio' => 'transacao',
                'ok' => empty($problemas),
                // Só é true quando os bytes iniciais foram todos repostos.
                // `comando.php` usa-o para não confundir tentativa com estado
                // final persistido na sua resposta JSON.
                'rollback' => empty($problemas),
                'estado' => empty($problemas) ? 200 : 500,
                'mensagem' => empty($problemas)
                    ? 'Batch revertido: nada ficou aplicado.'
                    : 'Falhou o rollback: ' . implode(' ', $problemas),
            );
            break;
        }
    }

    return $relatorio;
}

function cmd_correr($dominio, $funcao, $corpo, $comoArgumento = false)
{
    if ($comoArgumento) {
        list($ok, $payload, $estado) = mp_correr_api(function () use ($funcao, $corpo) {
            call_user_func($funcao, $corpo);
        });
    } else {
        list($ok, $payload, $estado) = mp_correr_api($funcao, $corpo);
    }

    return array(
        'dominio' => $dominio,
        'ok' => $ok,
        'estado' => $estado,
        'mensagem' => is_array($payload) && isset($payload['erro'])
            ? (string)$payload['erro']
            : (is_array($payload) && isset($payload['message']) ? (string)$payload['message'] : ''),
    );
}

/** As reviews não têm função de gravação com corpo — passa pelo normalizador. */
function cmd_gravar_reviews($dados)
{
    $normalizado = reviews_normalize($dados);
    $ok = reviews_save($normalizado);
    return array(
        'dominio' => 'reviews',
        'ok' => (bool)$ok,
        'estado' => $ok ? 200 : 500,
        'mensagem' => $ok ? '' : 'Não foi possível gravar content/reviews.json.',
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Manifesto das operações, para o mesmo sítio onde vivem os parâmetros
// ─────────────────────────────────────────────────────────────────────────────

function cmd_manifesto_tipo($nome)
{
    if (in_array($nome, array('euros', 'percent', 'quantidade', 'estragos', 'minutos', 'de', 'para', 'qtd', 'indice', 'intervalMs', 'speedSeconds', 'zoomPercent', 'panPercent', 'overlayOpacity'), true)) return 'number';
    if (in_array($nome, array('cents', 'order', 'stars', 'estrelas', 'maxCards', 'defaultStars', 'eggPumps'), true)) return 'integer';
    if (in_array($nome, array('activo', 'aleatorio', 'visivel', 'concluida'), true)) return 'boolean';
    return 'string';
}

/** Limites que não dependem de outro parâmetro, expostos no manifesto. */
function cmd_manifesto_limites($operacao, $nome)
{
    $gerais = array(
        'euros' => array('minimum' => 0, 'maximum' => 1000000),
        'cents' => array('minimum' => 0, 'maximum' => 100000000),
        'qtd' => array('minimum' => 1, 'maximum' => 100000),
        'de' => array('minimum' => 1, 'maximum' => 100000),
        'para' => array('minimum' => 1, 'maximum' => 100000),
        'quantidade' => array('minimum' => 0, 'maximum' => 10000000),
        'estragos' => array('minimum' => 0, 'maximum' => 90),
        'minutos' => array('minimum' => 0, 'maximum' => 10000),
        'percent' => array('minimum' => 0, 'maximum' => 99),
        'estrelas' => array('minimum' => 1, 'maximum' => 5),
        'stars' => array('minimum' => 1, 'maximum' => 5),
        'order' => array('minimum' => 1, 'maximum' => 9999),
        'maxCards' => array('minimum' => 1, 'maximum' => 12),
        'defaultStars' => array('minimum' => 1, 'maximum' => 5),
        'eggPumps' => array('minimum' => 0, 'maximum' => 20),
    );
    if (isset($gerais[$nome])) return $gerais[$nome];
    if ($operacao === 'homepage-campo' && $nome === 'indice') return array('minimum' => 0, 'maximum' => 999);
    if ($operacao === 'carrossel-slide' && $nome === 'indice') return array('minimum' => 0, 'maximum' => CARROUSEL_MAX_SLIDES);
    return null;
}

/** Limites de `valor` dependentes do campo escolhido na mesma operação. */
function cmd_manifesto_limites_por_campo($operacao, $nome)
{
    if ($nome !== 'valor') return null;
    if ($operacao === 'homepage-campo') {
        return array('menuOrder' => array('minimum' => 0, 'maximum' => 999), 'menuGroupOrder' => array('minimum' => 0, 'maximum' => 999));
    }
    if ($operacao === 'seccao-campo') return array('maxCards' => array('minimum' => 1, 'maximum' => 12));
    if ($operacao === 'carrossel-global') {
        return array(
            'speedSeconds' => array('minimum' => 3, 'maximum' => 30),
            'zoomPercent' => array('minimum' => 100, 'maximum' => 140),
            'panPercent' => array('minimum' => 0, 'maximum' => 18),
            'overlayOpacity' => array('minimum' => 0, 'maximum' => 80),
            'intervalMs' => array('minimum' => 800, 'maximum' => 30000),
        );
    }
    if ($operacao === 'review-campo') return array('order' => array('minimum' => 1, 'maximum' => 9999), 'stars' => array('minimum' => 1, 'maximum' => 5));
    if ($operacao === 'reviews-definicoes') return array(
        'intervalMs' => array('minimum' => 2000, 'maximum' => 60000),
        'defaultStars' => array('minimum' => 1, 'maximum' => 5),
        'eggPumps' => array('minimum' => 0, 'maximum' => 20),
    );
    return null;
}

function cmd_manifesto_enum($operacao, $nome)
{
    $mapa = array(
        'modo' => array('modo' => PRECOS_MODOS),
        'desconto' => array('escada' => array('D1', 'D2', 'D3', 'D4')),
        'desconto-activo' => array('escada' => array('D1', 'D2', 'D3', 'D4')),
        'carrossel-global' => array('campo' => array('enabled', 'randomizeOnLoad', 'intervalMs', 'speedSeconds', 'zoomPercent', 'panPercent', 'overlayOpacity')),
        'carrossel-slide' => array('accao' => array('adicionar', 'alterar', 'remover')),
        'review-campo' => array('campo' => array('enabled', 'order', 'name', 'text', 'date', 'orderNote', 'image', 'linkEnabled', 'link', 'ratingMode', 'stars', 'icon', 'customIcon')),
        'reviews-definicoes' => array('campo' => array('enabled', 'intervalMs', 'position', 'size', 'theme', 'imageShape', 'showImage', 'showName', 'showText', 'defaultRatingMode', 'defaultStars', 'defaultIcon', 'defaultCustomIcon', 'eggPumps')),
        'seccao-campo' => array('campo' => array('eyebrow', 'title', 'text', 'layout', 'maxCards', 'repeatInGrid')),
        'homepage-campo' => array('campo' => array('title', 'menuTitle', 'subtitle', 'menuGroup', 'actionText', 'image', 'menuHref', 'menuIcon', 'featureLabel', 'menuOrder', 'menuGroupOrder', 'available', 'clickable', 'carouselEnabled', 'menuHidden')),
    );
    return isset($mapa[$operacao][$nome]) ? $mapa[$operacao][$nome] : null;
}

function cmd_manifesto_omissao($operacao, $nome, $descricao)
{
    $omissoes = array(
        'material' => array('quantidade' => 1, 'unidade' => 'un', 'estragos' => 0),
        'produto-material' => array('rendimento' => '1'),
        'carrossel-slide' => array('indice' => 'fim', 'visivel' => true),
    );
    if (isset($omissoes[$operacao][$nome])) return $omissoes[$operacao][$nome];
    return null;
}

function cmd_manifesto_opcional($descricao)
{
    return stripos((string)$descricao, 'opcional') !== false
        || stripos((string)$descricao, 'omissão') !== false
        || stripos((string)$descricao, 'omitir') !== false
        || stripos((string)$descricao, 'vazio significa') !== false;
}

/** Regras que dependem de outro campo e não cabem no texto do parâmetro. */
function cmd_manifesto_requisito_condicional($operacao, $parametro)
{
    $regras = array(
        'carrossel-slide' => array(
            'caminho' => array('if' => array('accao' => 'adicionar'), 'then' => array('required' => true)),
            'indice' => array('if' => array('accao' => array('alterar', 'remover')), 'then' => array('required' => true)),
        ),
    );
    return isset($regras[$operacao][$parametro]) ? $regras[$operacao][$parametro] : null;
}

function cmd_manifesto_restricoes($operacao)
{
    $regras = array(
        'carrossel-cartao' => array('x-peloMenosUm' => array('activo', 'aleatorio')),
    );
    return isset($regras[$operacao]) ? $regras[$operacao] : array();
}

/** Os exemplos do registry são cómodos de ler; no manifesto saem como URL real. */
function cmd_manifesto_url_exemplo($query)
{
    $argumentos = array();
    parse_str((string)$query, $argumentos);
    return 'comando.php?' . http_build_query($argumentos, '', '&', PHP_QUERY_RFC3986);
}

/** Manifesto único: deriva directamente do registo que de facto executa. */
function cmd_manifesto()
{
    cmd_api('precos');
    cmd_api('carrousel');
    $ops = array();
    foreach (cmd_registo() as $nome => $op) {
        $propriedades = array('op' => array('type' => 'string', 'const' => $nome, 'description' => 'Nome da operação.'));
        $obrigatorios = array('op');
        $umDe = array();
        foreach ((array)$op['parametros'] as $parametro => $descricao) {
            $alternativas = explode('|', (string)$parametro);
            $opcional = cmd_manifesto_opcional($descricao);
            foreach ($alternativas as $alternativa) {
                $tipo = cmd_manifesto_tipo($alternativa);
                $campo = array('type' => $tipo, 'description' => (string)$descricao);
                if ($tipo === 'boolean') {
                    $campo['x-urlValues'] = array('1', '0', 'true', 'false', 'sim', 'não');
                }
                $enum = cmd_manifesto_enum($nome, $alternativa);
                if ($enum !== null) $campo['enum'] = $enum;
                $limites = cmd_manifesto_limites($nome, $alternativa);
                if ($limites !== null) $campo = array_merge($campo, $limites);
                $limitesPorCampo = cmd_manifesto_limites_por_campo($nome, $alternativa);
                if ($limitesPorCampo !== null) $campo['x-limitsByField'] = $limitesPorCampo;
                if ($alternativa === 'rendimento') $campo['x-format'] = 'produto de decimais positivos; máximo 100000000';
                $omissao = cmd_manifesto_omissao($nome, $alternativa, $descricao);
                if ($omissao !== null) $campo['default'] = $omissao;
                $condicao = cmd_manifesto_requisito_condicional($nome, $alternativa);
                if ($condicao !== null) $campo['x-requiredWhen'] = $condicao;
                $propriedades[$alternativa] = $campo;
                if (!$opcional && $omissao === null && $condicao === null && count($alternativas) === 1) $obrigatorios[] = $alternativa;
            }
            if (count($alternativas) > 1 && !$opcional) $umDe[] = $alternativas;
        }
        $esquema = array(
            'type' => 'object',
            'properties' => (object)$propriedades,
            'required' => $obrigatorios,
            'additionalProperties' => false,
            'x-umDe' => $umDe,
        );
        foreach (cmd_manifesto_restricoes($nome) as $chave => $valor) {
            $esquema[$chave] = $valor;
        }
        $ops[] = array(
            'nome' => $nome,
            'titulo' => $op['titulo'],
            'descricao' => $op['descricao'],
            'dominio' => $op['dominio'],
            'alteraDados' => true,
            'esquemaEntrada' => $esquema,
            'exemplo' => cmd_manifesto_url_exemplo($op['exemplo']),
        );
    }
    return array(
        'versao' => '1',
        'endpoint' => 'comando.php',
        'documento' => 'tools/README-comandos.md',
        'autorizacao' => 'Sessão de administração; a confirmação normal usa CSRF.',
        'url' => array(
            'unico' => 'comando.php?op={operacao}&{parametro}={valor}',
            'batch' => 'comando.php?c[0][op]={operacao}&c[0][{parametro}]={valor}&c[1][op]={operacao}',
            'maximoComandos' => 40,
        ),
        'execucao' => array(
            'previewPorOmissao' => true,
            'previewMostra' => array('antes', 'alteracao', 'depois'),
            'confirmacao' => array('metodo' => 'POST', 'csrf' => true),
            'override' => array('query' => 'override=true', 'aplicaDirectamente' => true, 'protecao' => 'Só navegação directa na sessão admin; bloqueado de outro site e de carregamentos embebidos.'),
            'batch' => array('transaccional' => true, 'comportamentoErro' => 'Valida o lote completo antes de gravar; se uma API falhar, repõe os ficheiros já alterados pelo lote se não houve alteração concorrente.'),
        ),
        'exemplos' => array(
            'unico' => 'comando.php?op=material&nome=%C3%8Dman%2032%20mm&quantidade=500&euros=42.50',
            'batch' => 'comando.php?c%5B0%5D%5Bop%5D=material&c%5B0%5D%5Bnome%5D=Cart%C3%A3o&c%5B0%5D%5Beuros%5D=12.50&c%5B1%5D%5Bop%5D=custo-hora&c%5B1%5D%5Beuros%5D=12',
        ),
        'operacoes' => $ops,
    );
}
