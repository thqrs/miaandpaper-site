<?php
/**
 * check-open-orders.php — OPEN_ORDER_HINT_V1
 *
 * Endpoint mínimo para detectar se a pessoa que está a preencher o
 * formulário já tem uma encomenda aberta. Recebe nome + contacto via POST
 * JSON e cruza com a tabela `orders` (apenas fulfillment_status IN
 * (new, preparing)) E só se o IP da chamada bater certo com o IP da
 * encomenda anterior — para evitar que alguém descubra encomendas de
 * terceiros só com nome + email.
 *
 * Devolve estritamente `{ "has_possible_open_order": bool }`. Nada mais.
 * Nunca devolve detalhes da encomenda anterior (código, produto, valores,
 * datas, designs). Sem 200 vs 4xx mais granular — sempre 200 + JSON.
 */

header('Cache-Control: no-store');
header('Content-Type: application/json; charset=utf-8');

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : '';
if ($method !== 'POST') {
    echo json_encode(array('has_possible_open_order' => false));
    exit;
}

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) === 0 || strlen($raw) > 2048) {
    echo json_encode(array('has_possible_open_order' => false));
    exit;
}

$payload = json_decode($raw, true);
if (!is_array($payload)) {
    echo json_encode(array('has_possible_open_order' => false));
    exit;
}

$customerName = isset($payload['customer_name']) ? (string)$payload['customer_name'] : '';
$customerContact = isset($payload['customer_contact']) ? (string)$payload['customer_contact'] : '';

// Não fazemos a query se algum dos campos for trivial — evita scan de
// dados completo + reduz risco de fishing por palavras comuns ("Maria").
if (strlen(trim($customerName)) < 3 || strlen(trim($customerContact)) < 4) {
    echo json_encode(array('has_possible_open_order' => false));
    exit;
}

require_once __DIR__ . '/lib/db.php';

$ip = isset($_SERVER['REMOTE_ADDR']) ? (string)$_SERVER['REMOTE_ADDR'] : '';

try {
    $row = mp_db_find_open_order($customerName, $customerContact, $ip);
    $has = $row !== null;
} catch (Exception $e) {
    @error_log('[miaandpaper] check-open-orders falhou: ' . $e->getMessage());
    $has = false;
}

echo json_encode(array('has_possible_open_order' => $has));
