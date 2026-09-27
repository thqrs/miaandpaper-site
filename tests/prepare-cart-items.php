<?php
// Exercita a validação real sem executar o envio de email nem criar pedidos.
$site = dirname(__DIR__) . '/site';
require_once $site . '/lib/private-paths.php';
require_once $site . '/lib/db.php';
require_once $site . '/lib/precos-core.php';
$tokens = token_get_all(file_get_contents($site . '/send-order.php'));
$functions = '';
for ($i = 0; $i < count($tokens); $i++) {
    if (!is_array($tokens[$i]) || $tokens[$i][0] !== T_FUNCTION) continue;
    $depth = 0;
    $started = false;
    do {
        $token = $tokens[$i];
        if ($token === '{' || (is_array($token) && in_array($token[0], array(T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES), true))) {
            $started = true;
            $depth++;
        } elseif ($token === '}') {
            $depth--;
        }
        $functions .= is_array($token)
            ? ($token[0] === T_DIR ? var_export($site, true) : $token[1])
            : $token;
        $i++;
    } while ($i < count($tokens) && (!$started || $depth > 0));
    $i--;
    $functions .= "\n";
}
eval($functions);
$items = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$results = array();
foreach ($items as $item) $results[] = cart_prepare_item($item, array(), array());
echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
