<?php
/**
 * Testes unitários e de integração para site/view-uploads.php
 * Executar: php tests/view-uploads.test.php
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Apenas na linha de comandos.\n");
}

function verify($condition, $message) {
    if (!$condition) {
        throw new RuntimeException("FALHA: " . $message);
    }
}

$siteRoot = realpath(__DIR__ . '/../site');

// 1. Validar sintaxe
exec('php -l ' . escapeshellarg($siteRoot . '/view-uploads.php') . ' 2>&1', $out, $code);
verify($code === 0, 'Sintaxe PHP inválida em view-uploads.php: ' . implode("\n", $out));

// 2. Testar bloqueio sem sessão de admin
// Arrancamos um servidor PHP temporário de teste
$socket = stream_socket_server('tcp://127.0.0.1:0', $errCode, $errMsg);
verify($socket !== false, 'Não foi possível reservar porta temporária');
$port = (int)substr(strrchr(stream_socket_get_name($socket, false), ':'), 1);
fclose($socket);

$descriptors = array(
    0 => array('pipe', 'r'),
    1 => array('pipe', 'w'),
    2 => array('pipe', 'w')
);
$pipes = array();

// Teste 2.1: Acesso anónimo (MIA_ADMIN_OPEN false)
$cmdAnon = array(
    PHP_BINARY,
    '-d', 'auto_prepend_file=' . realpath(__DIR__ . '/bootstrap-admin-security.php'),
    '-S', '127.0.0.1:' . $port,
    '-t', $siteRoot
);
$proc = proc_open($cmdAnon, $descriptors, $pipes, $siteRoot, null, array('bypass_shell' => true));
verify(is_resource($proc), 'Não foi possível iniciar servidor temporário');
usleep(200000); // 200ms para iniciar

try {
    $ctx = stream_context_create(array('http' => array('ignore_errors' => true)));
    $res = @file_get_contents("http://127.0.0.1:{$port}/view-uploads.php", false, $ctx);
    $statusLine = isset($http_response_header[0]) ? $http_response_header[0] : '';
    verify(strpos($statusLine, '403') !== false, 'Acesso anónimo deve devolver 403 Forbidden, obteve: ' . $statusLine);
    echo "OK: Acesso anónimo recusado com 403\n";

    // Testar tentativa de streaming anónimo
    $resStream = @file_get_contents("http://127.0.0.1:{$port}/view-uploads.php?action=stream&token=0346d9f27541e715fe635bb988119c11", false, $ctx);
    $streamStatus = isset($http_response_header[0]) ? $http_response_header[0] : '';
    verify(strpos($streamStatus, '403') !== false, 'Streaming anónimo deve devolver 403 Forbidden, obteve: ' . $streamStatus);
    echo "OK: Streaming anónimo recusado com 403\n";
} finally {
    proc_terminate($proc);
}

// Teste 2.2: Acesso com sessão de admin
$socket2 = stream_socket_server('tcp://127.0.0.1:0', $errCode, $errMsg);
$port2 = (int)substr(strrchr(stream_socket_get_name($socket2, false), ':'), 1);
fclose($socket2);

$cmdAdmin = array(
    PHP_BINARY,
    '-d', 'auto_prepend_file=' . realpath(__DIR__ . '/bootstrap-admin-session.php'),
    '-S', '127.0.0.1:' . $port2,
    '-t', $siteRoot
);
$proc2 = proc_open($cmdAdmin, $descriptors, $pipes, $siteRoot, null, array('bypass_shell' => true));
verify(is_resource($proc2), 'Não foi possível iniciar servidor com sessão admin');
usleep(200000);

try {
    $ctx = stream_context_create(array('http' => array('ignore_errors' => true)));
    $html = @file_get_contents("http://127.0.0.1:{$port2}/view-uploads.php", false, $ctx);
    $statusLine = isset($http_response_header[0]) ? $http_response_header[0] : '';
    verify(strpos($statusLine, '200') !== false, 'Admin deve receber 200 OK, obteve: ' . $statusLine);
    verify(strpos($html, 'Ficheiros enviados por clientes') !== false, 'HTML deve conter título da página');
    verify(strpos($html, 'searchInput') !== false, 'HTML deve conter barra de pesquisa');
    verify(strpos($html, 'filesGrid') !== false, 'HTML deve conter grelha de ficheiros');
    echo "OK: Admin recebe 200 OK e página renderizada\n";

    // Testar token inválido no streaming
    $badToken = @file_get_contents("http://127.0.0.1:{$port2}/view-uploads.php?action=stream&token=../hack", false, $ctx);
    $badStatus = isset($http_response_header[0]) ? $http_response_header[0] : '';
    verify(strpos($badStatus, '400') !== false, 'Token inválido deve devolver 400 Bad Request, obteve: ' . $badStatus);
    echo "OK: Path traversal em token recusado com 400\n";

    // Testar streaming de ficheiro existente em tmp
    $sampleToken = '0346d9f27541e715fe635bb988119c11';
    $streamRes = @file_get_contents("http://127.0.0.1:{$port2}/view-uploads.php?action=stream&token={$sampleToken}", false, $ctx);
    $streamStatus = isset($http_response_header[0]) ? $http_response_header[0] : '';
    verify(strpos($streamStatus, '200') !== false, 'Streaming de ficheiro existente deve dar 200 OK, obteve: ' . $streamStatus);
    verify(strlen($streamRes) > 1000, 'Conteúdo do ficheiro deve ser transferido');
    echo "OK: Streaming de ficheiro existente em tmp devolve 200 OK e ficheiro completo\n";

    // Testar HTTP Range para áudio/stream
    $ctxRange = stream_context_create(array('http' => array(
        'ignore_errors' => true,
        'header' => "Range: bytes=0-499\r\n"
    )));
    $rangeRes = @file_get_contents("http://127.0.0.1:{$port2}/view-uploads.php?action=stream&token={$sampleToken}", false, $ctxRange);
    $rangeStatus = isset($http_response_header[0]) ? $http_response_header[0] : '';
    verify(strpos($rangeStatus, '206') !== false, 'Range request deve devolver 206 Partial Content, obteve: ' . $rangeStatus);
    verify(strlen($rangeRes) === 500, 'Range bytes=0-499 deve devolver exactamente 500 bytes, obteve: ' . strlen($rangeRes));
    echo "OK: HTTP Range parcial devolve 206 e 500 bytes exactos\n";

} finally {
    proc_terminate($proc2);
}

echo "TODOS OS TESTES DE view-uploads.php PASSARAM COM SUCESSO!\n";
