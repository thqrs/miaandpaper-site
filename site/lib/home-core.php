<?php
// HOME_CORE_V1
// Leitura e escrita do content/home.json, partilhadas por quem lhe mexe:
// homepage-menu-api.php (secções, menu, cartões) e carrousel-api.php
// (carrosséis). Antes isto vivia só no primeiro; com dois editores a escrever
// no mesmo ficheiro, ter duas cópias da escrita atómica era o caminho certo
// para uma delas ficar para trás.
//
// Nenhuma função aqui responde HTTP nem faz exit: devolvem erro em string para
// quem chama decidir o formato. Assim a lib serve APIs e scripts na mesma.

if (!defined('HOME_FILE')) {
    define('HOME_FILE', __DIR__ . '/../content/home.json');
}

// Devolve array(dados|null, raw, erro).
function home_ler()
{
    $raw = @file_get_contents(HOME_FILE);
    if ($raw === false) {
        return array(null, '', 'Não consegui ler o home.json.');
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return array(null, $raw, 'O home.json não é JSON válido.');
    }
    return array($data, $raw, '');
}

function home_revisao($raw)
{
    return hash('sha256', (string)$raw);
}

// O JSON_PRETTY_PRINT do PHP indenta a 4; o ficheiro pode estar a outra coisa.
// Sem isto, mudar um valor dava um diff do ficheiro inteiro.
function home_indentacao($raw)
{
    return preg_match('/\n( +)"/', (string)$raw, $m) ? strlen($m[1]) : 4;
}

function home_reindentar($json, $unidade)
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

// Escrita atómica e verificada: cópia de segurança, ficheiro temporário,
// rename, e releitura a confirmar que ficou JSON válido. Se a confirmação
// falhar, repõe o original. Devolve '' quando correu bem.
function home_gravar($data, $revisaoEsperada, $sufixoBackup = '.home-bak')
{
    $actual = @file_get_contents(HOME_FILE);
    if ($actual === false) {
        return 'Não consegui ler o home.json.';
    }
    if ($revisaoEsperada !== '' && !hash_equals(home_revisao($actual), $revisaoEsperada)) {
        return 'O home.json mudou noutro separador. Recarrega antes de gravar.';
    }

    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return 'Não consegui serializar o home.json.';
    }
    $json = home_reindentar($json, home_indentacao($actual)) . "\n";

    if (@file_put_contents(HOME_FILE . $sufixoBackup, $actual, LOCK_EX) === false) {
        return 'Não consegui gravar a cópia de segurança.';
    }

    $tmp = HOME_FILE . '.home-tmp';
    if (@file_put_contents($tmp, $json, LOCK_EX) !== strlen($json)) {
        @unlink($tmp);
        return 'Não consegui escrever o ficheiro temporário.';
    }
    if (!@rename($tmp, HOME_FILE)) {
        @unlink(HOME_FILE);
        if (!@rename($tmp, HOME_FILE)) {
            @unlink($tmp);
            @file_put_contents(HOME_FILE, $actual, LOCK_EX);
            return 'Não consegui substituir o home.json. Repus o original.';
        }
    }

    clearstatcache(true, HOME_FILE);
    $confirmacao = @file_get_contents(HOME_FILE);
    if ($confirmacao === false || json_decode($confirmacao, true) === null) {
        @file_put_contents(HOME_FILE, $actual, LOCK_EX);
        return 'O home.json ficou ilegível depois de gravar. Repus a versão anterior.';
    }

    return '';
}

// ── Carrosséis ───────────────────────────────────────────────────────────────
// CAROUSEL_SLIDES_V1: cada imagem é um slide com os seus parâmetros. Null herda
// do bloco `carousel` global. Tem de dar o mesmo que `resolvedCarouselSlides()`
// em js/03-conteudo-home.js.

const CAROUSEL_CAMPOS = array('speedSeconds', 'zoomPercent', 'panPercent', 'overlayOpacity', 'intervalMs');

function carousel_limites($campo)
{
    $limites = array(
        'speedSeconds' => array(3, 30, 8),
        'zoomPercent' => array(100, 140, 120),
        'panPercent' => array(0, 18, 6),
        'overlayOpacity' => array(0, 80, 20),
        'intervalMs' => array(800, 30000, 3500),
    );
    return isset($limites[$campo]) ? $limites[$campo] : null;
}

function carousel_global($data)
{
    $c = isset($data['carousel']) && is_array($data['carousel']) ? $data['carousel'] : array();
    $saida = array('enabled' => !isset($c['enabled']) || !empty($c['enabled']));

    foreach (CAROUSEL_CAMPOS as $campo) {
        list($min, $max, $omissao) = carousel_limites($campo);
        $valor = isset($c[$campo]) && is_numeric($c[$campo]) ? (float)$c[$campo] : $omissao;
        $saida[$campo] = max($min, min($max, $valor));
    }
    $saida['randomizeOnLoad'] = !isset($c['randomizeOnLoad']) || !empty($c['randomizeOnLoad']);
    return $saida;
}

// Normaliza um slide: imagem obrigatória, parâmetros a null ou dentro dos
// limites. Devolve null se não houver imagem — um slide sem imagem não existe.
function carousel_slide($bruto)
{
    if (!is_array($bruto)) {
        return null;
    }
    $imagem = isset($bruto['image']) ? trim((string)$bruto['image']) : '';
    if ($imagem === '') {
        return null;
    }

    // CAROUSEL_VISIBLE_V1: desligar o visto tira a imagem do carrossel sem a
    // apagar da lista — é para experimentar sem perder o caminho do ficheiro.
    // A ausência do campo quer dizer visível: os slides migrados não o têm.
    $slide = array(
        'image' => $imagem,
        'visible' => !isset($bruto['visible']) || !empty($bruto['visible']),
    );
    foreach (CAROUSEL_CAMPOS as $campo) {
        list($min, $max) = carousel_limites($campo);
        $slide[$campo] = isset($bruto[$campo]) && is_numeric($bruto[$campo])
            ? max($min, min($max, (float)$bruto[$campo]))
            : null;
    }
    return $slide;
}

function carousel_slides($categoria)
{
    if (!is_array($categoria) || !isset($categoria['carouselSlides']) || !is_array($categoria['carouselSlides'])) {
        return array();
    }
    $slides = array();
    foreach ($categoria['carouselSlides'] as $bruto) {
        $slide = carousel_slide($bruto);
        if ($slide !== null) {
            $slides[] = $slide;
        }
    }
    return array_slice($slides, 0, 12);
}
