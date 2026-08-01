<?php
/**
 * lib/snapshot.php — SNAPSHOT_V1
 *
 * Congela o HTML de páginas caras num ficheiro, e serve esse ficheiro até
 * alguém mandar refazer.
 *
 * ── Porquê ──────────────────────────────────────────────────────────────────
 *
 * O funil e o live dashboard recalculam tudo a cada pedido: lêem 20 mil linhas
 * de `funnel_events` e agregam-nas em PHP. Medido a 31/07/2026, com 20 612
 * eventos em 30 dias:
 *
 *     admin-funnel.php?period=30d          3,6 s
 *     admin-live-dashboard.php?view=teia   3,5 s
 *     modulos.php                          0,5 s
 *
 * Um índice em `funnel_events(created_at)` tirou ~1 s (a query passou de SCAN
 * a SEARCH), mas o resto é trabalho de agregação que não desaparece sem
 * reescrever os dois ficheiros.
 *
 * ── O compromisso, dito com todas as letras ─────────────────────────────────
 *
 * Um snapshot de uma página de ANÁLISE mostra números velhos. Para o
 * `modulos.php`, que só depende do CSS, isso é irrelevante — o CSS não muda
 * sozinho. Para o funil, muda: enquanto o snapshot estiver activo não se vêem
 * as visitas novas.
 *
 * Por isso, todas as páginas com snapshot mostram uma barra no topo com a
 * idade do snapshot e dois botões: **Actualizar** (refaz) e **Ver ao vivo**
 * (ignora o snapshot só neste carregamento, com `?snapshot=off`).
 *
 * ── Quando refazer ──────────────────────────────────────────────────────────
 *
 * Sempre que se muda a ESTRUTURA do site: produto novo, passo novo, classe
 * nova no CSS, linha nova no mapa de metro. E antes de cada deploy, para o
 * servidor arrancar já com snapshots feitos.
 *
 * ── Onde ficam ──────────────────────────────────────────────────────────────
 *
 * `private/snapshots/<chave>.html` — fora da raiz web, servidos por PHP.
 * Contêm dados de clientes (nomes, IPs), por isso nunca podem ser públicos.
 */

require_once __DIR__ . '/private-paths.php';

define('MP_SNAPSHOT_MAX_AGE_WARN', 7 * 24 * 3600);

function mp_snapshot_dir()
{
    $dir = mp_private_path('snapshots');
    if ($dir === null) {
        return null;
    }
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
        return null;
    }
    return $dir;
}

/**
 * A chave inclui a página e os parâmetros que mudam o resultado, para que
 * `?period=7d` e `?period=90d` não se sobreponham.
 */
function mp_snapshot_key($pagina, array $params = array())
{
    $partes = array(preg_replace('/[^a-z0-9_-]/i', '', (string)$pagina));
    ksort($params);
    foreach ($params as $nome => $valor) {
        $valor = preg_replace('/[^a-z0-9_.-]/i', '', (string)$valor);
        if ($valor !== '') {
            $partes[] = preg_replace('/[^a-z0-9_-]/i', '', (string)$nome) . '-' . $valor;
        }
    }
    return implode('__', $partes);
}

function mp_snapshot_path($chave)
{
    $dir = mp_snapshot_dir();
    if ($dir === null) {
        return null;
    }
    return $dir . DIRECTORY_SEPARATOR . preg_replace('/[^a-z0-9_-]/i', '', (string)$chave) . '.html';
}

function mp_snapshot_info($chave)
{
    $path = mp_snapshot_path($chave);
    if ($path === null || !is_file($path)) {
        return null;
    }
    return array(
        'path' => $path,
        'at' => (int)@filemtime($path),
        'bytes' => (int)@filesize($path),
    );
}

function mp_snapshot_idade_legivel($segundos)
{
    $segundos = max(0, (int)$segundos);
    if ($segundos < 90) {
        return 'agora mesmo';
    }
    if ($segundos < 5400) {
        return 'há ' . round($segundos / 60) . ' min';
    }
    if ($segundos < 172800) {
        return 'há ' . round($segundos / 3600) . ' h';
    }
    return 'há ' . round($segundos / 86400) . ' dias';
}

/** Barra que aparece no topo de qualquer página com snapshot. */
function mp_snapshot_barra($chave, $info, $aoVivo)
{
    $q = $_GET;
    unset($q['snapshot']);
    $base = strtok((string)$_SERVER['REQUEST_URI'], '?');
    $urlVivo = $base . '?' . http_build_query(array_merge($q, array('snapshot' => 'off')));
    $urlRefazer = $base . '?' . http_build_query(array_merge($q, array('snapshot' => 'refazer')));
    $urlSnapshot = $base . ($q ? '?' . http_build_query($q) : '');

    $idade = $info ? (time() - $info['at']) : 0;
    $velho = $info && $idade > MP_SNAPSHOT_MAX_AGE_WARN;

    $estilo = 'display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:7px 14px;'
        . 'font:600 0.78rem/1.4 system-ui,sans-serif;border-bottom:1px solid rgba(0,0,0,0.12);';
    $estilo .= $aoVivo
        ? 'background:#f3e7c8;color:#5c4a1e;'
        : ($velho ? 'background:#f0d3c4;color:#7a3a1c;' : 'background:#dce9d2;color:#33521f;');

    $texto = $aoVivo
        ? 'A ver ao vivo — calculado agora, sem snapshot.'
        : ($info
            ? 'Snapshot de ' . htmlspecialchars(gmdate('Y-m-d H:i', $info['at']), ENT_QUOTES, 'UTF-8')
                . ' UTC (' . htmlspecialchars(mp_snapshot_idade_legivel($idade), ENT_QUOTES, 'UTF-8') . ')'
                . ($velho ? ' — já tem mais de uma semana.' : '')
            : 'Sem snapshot — a mostrar dados calculados agora.');

    $links = '<a href="' . htmlspecialchars($urlRefazer, ENT_QUOTES, 'UTF-8') . '" style="color:inherit;">Actualizar snapshot</a>';
    if (!$aoVivo && $info) {
        $links .= ' · <a href="' . htmlspecialchars($urlVivo, ENT_QUOTES, 'UTF-8') . '" style="color:inherit;">Ver ao vivo</a>';
    }
    if ($aoVivo && $info) {
        $links .= ' · <a href="' . htmlspecialchars($urlSnapshot, ENT_QUOTES, 'UTF-8') . '" style="color:inherit;">Voltar ao snapshot</a>';
    }

    return '<div data-mp-snapshot-bar style="' . $estilo . '">'
        . '<span>' . $texto . '</span>'
        . '<span style="margin-left:auto;">' . $links . '</span>'
        . '</div>';
}

/**
 * Chamar no topo da página, depois de resolver os parâmetros que definem a
 * chave. Se houver snapshot utilizável, esta função escreve-o e **termina o
 * pedido**. Caso contrário devolve o controlo e começa a capturar a saída.
 *
 *   `?snapshot=off`     — ignora o snapshot neste carregamento
 *   `?snapshot=refazer` — recalcula e regrava
 */
function mp_snapshot_start($pagina, array $params = array())
{
    // Um POST é uma acção (marcar um IP a ignorar, arquivar dados). Nunca
    // pode ser respondido com HTML congelado, nem gravar um snapshot novo.
    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] !== 'GET') {
        return;
    }

    $chave = mp_snapshot_key($pagina, $params);
    $modo = isset($_GET['snapshot']) ? (string)$_GET['snapshot'] : '';
    $info = mp_snapshot_info($chave);

    if ($modo !== 'off' && $modo !== 'refazer' && $info !== null) {
        $html = @file_get_contents($info['path']);
        if ($html !== false && $html !== '') {
            header('X-Mia-Snapshot: ' . gmdate('c', $info['at']));
            echo mp_snapshot_barra($chave, $info, false);
            echo $html;
            exit;
        }
    }

    $GLOBALS['mp_snapshot_chave'] = $chave;
    $GLOBALS['mp_snapshot_gravar'] = ($modo !== 'off');
    $GLOBALS['mp_snapshot_info'] = $info;

    echo mp_snapshot_barra($chave, $info, $modo === 'off');
    ob_start();
}

/** Chamar no fim da página. Grava o que foi capturado e envia-o na mesma. */
function mp_snapshot_end()
{
    if (!isset($GLOBALS['mp_snapshot_chave'])) {
        return;
    }
    $html = ob_get_clean();
    $chave = $GLOBALS['mp_snapshot_chave'];

    if (!empty($GLOBALS['mp_snapshot_gravar'])) {
        $path = mp_snapshot_path($chave);
        if ($path !== null) {
            // Escrita atómica: um pedido a ler ao mesmo tempo nunca apanha
            // meio ficheiro.
            $tmp = $path . '.tmp';
            if (@file_put_contents($tmp, $html, LOCK_EX) !== false) {
                @rename($tmp, $path);
                @chmod($path, 0600);
            }
        }
    }

    unset($GLOBALS['mp_snapshot_chave'], $GLOBALS['mp_snapshot_gravar'], $GLOBALS['mp_snapshot_info']);
    echo $html;
}

/** Lista tudo o que está guardado — usado pelo painel de ferramentas. */
function mp_snapshot_listar()
{
    $dir = mp_snapshot_dir();
    $out = array();
    if ($dir === null || !is_dir($dir)) {
        return $out;
    }
    foreach (glob($dir . DIRECTORY_SEPARATOR . '*.html') as $f) {
        $out[] = array(
            'chave' => basename($f, '.html'),
            'at' => (int)@filemtime($f),
            'bytes' => (int)@filesize($f),
        );
    }
    usort($out, function ($a, $b) { return $b['at'] - $a['at']; });
    return $out;
}

function mp_snapshot_apagar($chave)
{
    $path = mp_snapshot_path($chave);
    return $path !== null && is_file($path) ? @unlink($path) : false;
}

/**
 * As páginas e parâmetros que o botão "criar todos" percorre. Acrescentar
 * aqui quando se criar uma página nova com snapshot.
 */
function mp_snapshot_alvos()
{
    $alvos = array(
        array('url' => 'modulos.php', 'pagina' => 'modulos', 'params' => array()),
    );

    // Atenção: as duas páginas têm listas de períodos DIFERENTES. O funil não
    // tem "today" nem "yesterday" (cai para 30d); o dashboard não tem "all".
    // Pedir um período que a página não conhece cria uma linha nesta tabela
    // que nunca se preenche, porque a chave é gravada com o período já
    // validado — e não com o que foi pedido.
    foreach (array('7d', '30d', '90d', 'all') as $periodo) {
        $alvos[] = array(
            'url' => 'admin-funnel.php?period=' . $periodo,
            'pagina' => 'funil',
            'params' => array('period' => $periodo),
        );
    }
    foreach (array('today', '7d', '30d', '90d') as $periodo) {
        foreach (array('metro', 'teia') as $vista) {
            $alvos[] = array(
                'url' => 'admin-live-dashboard.php?period=' . $periodo . '&view=' . $vista,
                'pagina' => 'dashboard',
                'params' => array('period' => $periodo, 'view' => $vista),
            );
        }
    }
    return $alvos;
}
