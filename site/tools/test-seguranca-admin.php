<?php
/** Integração HTTP da protecção de administração. Run: php site/tools/test-seguranca-admin.php */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Só pode correr na linha de comandos.\n");
}

$site = realpath(__DIR__ . '/..');
$raiz = dirname($site);
$anonimo = $raiz . '/tests/bootstrap-admin-security.php';
$admin = $raiz . '/tests/bootstrap-admin-session.php';
require_once $site . '/lib/private-paths.php';
$falhas = array();

function teste_seguranca($condicao, $mensagem)
{
    global $falhas;
    if ($condicao) {
        echo "OK   $mensagem\n";
    } else {
        $falhas[] = $mensagem;
        echo "FALHA $mensagem\n";
    }
}

function porta_livre_teste()
{
    $socket = stream_socket_server('tcp://127.0.0.1:0', $erro, $mensagem);
    if ($socket === false) {
        throw new RuntimeException('Não consegui reservar uma porta de teste: ' . $mensagem);
    }
    $nome = stream_socket_get_name($socket, false);
    fclose($socket);
    return (int)substr(strrchr($nome, ':'), 1);
}

function iniciar_servidor_teste($site, $bootstrap)
{
    $porta = porta_livre_teste();
    $prepend = str_replace('\\', '/', $bootstrap);
    $raiz = str_replace('\\', '/', $site);
    $pipes = array();
    // Array + bypass_shell é importante no Windows: com uma shell intermédia,
    // proc_terminate() mata o cmd mas deixa o servidor PHP órfão.
    $processo = proc_open(array(
        PHP_BINARY, '-d', 'auto_prepend_file=' . $prepend,
        '-S', '127.0.0.1:' . $porta, '-t', $raiz,
    ), array(
        0 => array('pipe', 'r'),
        1 => array('pipe', 'w'),
        2 => array('pipe', 'w'),
    ), $pipes, $site, null, array('bypass_shell' => true));
    if (!is_resource($processo)) {
        throw new RuntimeException('Não consegui iniciar o servidor PHP temporário.');
    }
    fclose($pipes[0]);
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);
    return array($processo, $pipes, 'http://127.0.0.1:' . $porta . '/');
}

function parar_servidor_teste($servidor)
{
    list($processo, $pipes) = $servidor;
    $estado = proc_get_status($processo);
    if (!empty($estado['running'])) {
        proc_terminate($processo);
        for ($i = 0; $i < 20 && !empty($estado['running']); $i++) {
            usleep(100000);
            $estado = proc_get_status($processo);
        }
        if (!empty($estado['running'])) proc_terminate($processo, 9);
    }
    foreach ($pipes as $pipe) if (is_resource($pipe)) fclose($pipe);
    proc_close($processo);
}

function pedido_teste($url, $metodo = 'GET', $corpo = '')
{
    $cabecalhos = "Accept: application/json\r\n";
    if ($metodo === 'POST') $cabecalhos .= "Content-Type: application/json\r\n";
    $contexto = stream_context_create(array('http' => array(
        'method' => $metodo,
        'header' => $cabecalhos,
        'content' => $corpo,
        'ignore_errors' => true,
        'timeout' => 10,
    )));
    // Durante o arranque ainda não existe servidor a escutar. Tratamos apenas
    // esse aviso transitório como «sem resposta»; os estados HTTP recebidos
    // continuam a ser verificados pelos testes abaixo.
    $http_response_header = array();
    set_error_handler(function ($gravidade, $mensagem) {
        if ($gravidade === E_WARNING && strpos($mensagem, 'file_get_contents(') === 0
            && strpos($mensagem, 'Failed to open stream') !== false) {
            return true;
        }
        return false;
    });
    try {
        $resposta = file_get_contents($url, false, $contexto);
    } finally {
        restore_error_handler();
    }
    $estado = 0;
    foreach ($http_response_header as $cabecalho) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $cabecalho, $m)) {
            $estado = (int)$m[1];
            break;
        }
    }
    return array($estado, $resposta === false ? '' : $resposta);
}

function esperar_servidor_teste($base)
{
    for ($i = 0; $i < 30; $i++) {
        list($estado) = pedido_teste($base . 'comando.php?formato=json');
        if ($estado > 0) return true;
        usleep(100000);
    }
    return false;
}

// Produção: MIA_ADMIN_OPEN=false e nenhum cookie/sessão de administrador.
$servidor = iniciar_servidor_teste($site, $anonimo);
try {
    list(, , $base) = $servidor;
    teste_seguranca(esperar_servidor_teste($base), 'servidor temporário de produção arrancou');
    $escritas = array(
        'materiais-api.php?action=save' => 'materiais-api.php',
        'precos-api.php?action=save' => 'precos-api.php',
        'homepage-menu-api.php?action=save' => 'homepage-menu-api.php',
        'carrousel-api.php?action=save' => 'carrousel-api.php',
        'galeria-api.php?action=save' => 'galeria-api.php',
        'reviews-api.php?action=save' => 'reviews-api.php',
    );
    foreach ($escritas as $url => $nome) {
        list($get) = pedido_teste($base . $url);
        list($post) = pedido_teste($base . $url, 'POST', '{}');
        teste_seguranca($get === 403 && $post === 403, $nome . ' recusa GET e POST de escrita anónimos');
    }
    list($comando) = pedido_teste($base . 'comando.php?formato=json&op=custo-hora&cents=0');
    list($override) = pedido_teste($base . 'comando.php?formato=json&op=custo-hora&cents=0&override=true');
    list($postComando) = pedido_teste($base . 'comando.php?formato=json&op=custo-hora&cents=0', 'POST', '{}');
    teste_seguranca($comando === 403 && $override === 403 && $postComando === 403, 'comando.php e override recusam qualquer apply anónimo');
} finally {
    parar_servidor_teste($servidor);
}

// Sessão válida: as APIs continuam legíveis, mas nenhum GET aplica comandos.
$servidor = iniciar_servidor_teste($site, $admin);
try {
    list(, , $base) = $servidor;
    teste_seguranca(esperar_servidor_teste($base), 'servidor temporário com sessão admin arrancou');
    $leituras = array(
        'materiais-api.php?action=data', 'precos-api.php?action=data',
        'homepage-menu-api.php?action=data', 'carrousel-api.php?action=data',
        'galeria-api.php?action=done', 'reviews-api.php?action=load',
    );
    $leiturasOk = true;
    foreach ($leituras as $url) {
        list($estado) = pedido_teste($base . $url);
        $leiturasOk = $leiturasOk && $estado === 200;
    }
    teste_seguranca($leiturasOk, 'sessão admin válida continua a aceder às seis APIs administrativas');

    list($estadoMateriais, $corpoMateriais) = pedido_teste($base . 'materiais-api.php?action=data');
    $materiais = json_decode($corpoMateriais, true);
    $cents = $estadoMateriais === 200 && is_array($materiais) && isset($materiais['custoHoraCents'])
        ? (int)$materiais['custoHoraCents'] : null;
    list($estadoOverride, $corpoOverride) = pedido_teste(
        $base . 'comando.php?formato=json&op=custo-hora&cents=' . rawurlencode((string)$cents) . '&override=true'
    );
    $override = json_decode($corpoOverride, true);
    $overrideOk = $cents !== null && $estadoOverride === 200 && is_array($override)
        && !empty($override['ok']) && empty($override['aplicado']) && empty($override['tentouAplicar']);
    teste_seguranca($overrideOk, 'GET autenticado nunca aplica, mesmo com override=true');

    // Batch aplicado com sucesso: `aplicado` continua a referir-se ao estado
    // final. Usamos duas escritas no-op para não alterar dados do projecto.
    $batchOkQuery = http_build_query(array(
        'formato' => 'json', 'override' => 'true',
        'c' => array(
            array('op' => 'custo-hora', 'cents' => (string)$cents),
            array('op' => 'custo-hora', 'cents' => (string)$cents),
        ),
    ), '', '&', PHP_QUERY_RFC3986);
    list($estadoBatchOk, $corpoBatchOk) = pedido_teste($base . 'comando.php?' . $batchOkQuery);
    $batchOk = json_decode($corpoBatchOk, true);
    teste_seguranca($cents !== null && $estadoBatchOk === 200 && is_array($batchOk)
        && !empty($batchOk['ok']) && empty($batchOk['aplicado'])
        && empty($batchOk['tentouAplicar']) && empty($batchOk['rollback']),
        'batch em GET fica apenas em preview');

    // Falha tardia: a primeira API grava e a segunda falha. Confirma a resposta
    // JSON, a causa em `erros` e o hash exacto depois do rollback.
    $pathMateriais = mp_private_path('materiais.json');
    $bytesAntes = $pathMateriais !== null && is_file($pathMateriais)
        ? (string)file_get_contents($pathMateriais) : null;
    $hashAntes = $bytesAntes === null ? null : hash('sha256', $bytesAntes);
    $sufixo = substr(sha1(uniqid('', true)), 0, 8);
    $batchFalhadoQuery = http_build_query(array(
        'formato' => 'json', 'override' => 'true',
        'c' => array(
            array('op' => 'material', 'nome' => '__cmd-resposta-' . $sufixo, 'euros' => '1.00'),
            array('op' => 'enviar-para-precos', 'produto' => '__cmd-inexistente-' . $sufixo, 'chave' => 'Teste'),
        ),
    ), '', '&', PHP_QUERY_RFC3986);
    list($estadoBatchFalhado, $corpoBatchFalhado) = pedido_teste($base . 'comando.php?' . $batchFalhadoQuery);
    $batchFalhado = json_decode($corpoBatchFalhado, true);
    $bytesDepois = $pathMateriais !== null && is_file($pathMateriais)
        ? (string)file_get_contents($pathMateriais) : null;
    $temErroAplicacao = false;
    foreach ((array)(is_array($batchFalhado) && isset($batchFalhado['erros']) ? $batchFalhado['erros'] : array()) as $erro) {
        if (strpos((string)$erro, 'Aplicação em ') === 0) $temErroAplicacao = true;
    }
    teste_seguranca($hashAntes !== null && $estadoBatchFalhado === 200 && is_array($batchFalhado)
        && empty($batchFalhado['aplicado']) && empty($batchFalhado['tentouAplicar'])
        && empty($batchFalhado['rollback'])
        && $hashAntes === ($bytesDepois === null ? null : hash('sha256', $bytesDepois))
        && !$temErroAplicacao,
        'batch inválido em GET não tenta escrever nem altera o ficheiro');
} finally {
    parar_servidor_teste($servidor);
}

if ($falhas) {
    fwrite(STDERR, "\n" . count($falhas) . " teste(s) de segurança falharam.\n");
    exit(1);
}
echo "\nTodos os testes de segurança administrativa passaram.\n";
