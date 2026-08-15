<?php
/**
 * MIU_API_V1 — endpoint público do chatbot.
 *
 * GET devolve apenas configuração pública e cria o CSRF da sessão do Míu.
 * POST valida, limita e modera antes de qualquer chamada ao fornecedor de IA.
 */

require_once __DIR__ . '/lib/miu-bot.php';
require_once __DIR__ . '/lib/client-ip.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

function miu_api_respond($status, $payload)
{
    http_response_code((int)$status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function miu_api_stream_event($type, $payload = array())
{
    static $started = false;
    if (!$started) {
        $started = true;
        header('Content-Type: application/x-ndjson; charset=utf-8');
        header('Cache-Control: no-store, no-cache, must-revalidate, no-transform');
        header('X-Accel-Buffering: no');
        @ini_set('output_buffering', '0');
        @ini_set('zlib.output_compression', '0');
    }
    echo json_encode(array_merge(array('type' => (string)$type), $payload), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    if (function_exists('ob_flush')) {
        @ob_flush();
    }
    flush();
}

function miu_api_finish_local_reply($conversation, $message, $reply, $contextKey, $wantsStream)
{
    $answer = isset($reply['answer']) ? trim((string)$reply['answer']) : '';
    $replyId = isset($reply['id']) ? (string)$reply['id'] : 'local';
    miu_insert_message((int)$conversation['id'], 'user', miu_text_slice($message, 5000), 'local', '', '', $replyId, $contextKey);
    miu_insert_message((int)$conversation['id'], 'assistant', $answer, 'local', 'local', $replyId, '', $contextKey);

    if ($wantsStream) {
        session_write_close();
        miu_api_stream_event('meta', array(
            'conversationId' => $conversation['public_id'],
            'contextKey' => $contextKey,
            'local' => true,
        ));
        $characters = preg_split('//u', $answer, -1, PREG_SPLIT_NO_EMPTY);
        $chunks = is_array($characters) ? array_chunk($characters, 18) : array(array($answer));
        foreach ($chunks as $chunkCharacters) {
            $chunk = implode('', $chunkCharacters);
            miu_api_stream_event('delta', array('text' => $chunk, 'model' => $replyId));
            usleep(12000);
        }
        miu_api_stream_event('done', array(
            'conversationId' => $conversation['public_id'],
            'provider' => 'local',
            'model' => $replyId,
            'local' => true,
        ));
        exit;
    }

    miu_api_respond(200, array(
        'ok' => true,
        'local' => true,
        'reply' => $answer,
        'conversationId' => $conversation['public_id'],
    ));
}

function miu_api_https()
{
    return (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443);
}

function miu_api_session_start()
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    @ini_set('session.use_only_cookies', '1');
    @ini_set('session.use_strict_mode', '1');
    session_name('miaandpaper_miu_session');
    session_set_cookie_params(array(
        'lifetime' => 0,
        'path' => '/',
        'secure' => miu_api_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ));
    session_start();
}

function miu_api_csrf()
{
    miu_api_session_start();
    if (empty($_SESSION['miu_csrf']) || !is_string($_SESSION['miu_csrf'])) {
        $_SESSION['miu_csrf'] = bin2hex(random_bytes(32));
    }
    return (string)$_SESSION['miu_csrf'];
}

function miu_api_same_origin()
{
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? trim((string)$_SERVER['HTTP_ORIGIN']) : '';
    if ($origin === '') {
        return true;
    }
    $originHost = strtolower((string)parse_url($origin, PHP_URL_HOST));
    $originPort = parse_url($origin, PHP_URL_PORT);
    $requestHostRaw = isset($_SERVER['HTTP_HOST']) ? strtolower((string)$_SERVER['HTTP_HOST']) : '';
    $requestHost = preg_replace('/:\d+$/', '', $requestHostRaw);
    $requestPort = null;
    if (preg_match('/:(\d+)$/', $requestHostRaw, $match)) {
        $requestPort = (int)$match[1];
    }
    if ($originHost === '' || $originHost !== $requestHost) {
        return false;
    }
    return $originPort === null || $requestPort === null || (int)$originPort === (int)$requestPort;
}

function miu_api_page_path($value)
{
    $value = trim((string)$value);
    $path = parse_url($value, PHP_URL_PATH);
    if (!is_string($path) || $path === '' || !preg_match('~^/[a-z0-9/_\-.]*$~i', $path)) {
        return '/';
    }
    return miu_text_slice($path, 500);
}

function miu_api_ui_state($value)
{
    $result = array('selected' => array(), 'errors' => array());
    if (!is_array($value)) {
        return $result;
    }
    foreach (array('selected' => 20, 'errors' => 10) as $key => $limit) {
        $items = isset($value[$key]) && is_array($value[$key]) ? array_slice($value[$key], 0, $limit) : array();
        foreach ($items as $item) {
            if (!is_scalar($item)) {
                continue;
            }
            $text = strip_tags((string)$item);
            $text = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $text);
            $text = preg_replace('/\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/iu', '[email oculto]', (string)$text);
            $text = preg_replace('/\b(?:\+?351[\s.\-]?)?(?:\d[\s.\-]?){9,}\b/u', '[número oculto]', (string)$text);
            $text = preg_replace('/\s+/u', ' ', (string)$text);
            $text = trim(miu_text_slice($text, 180));
            if ($text !== '' && !in_array($text, $result[$key], true)) {
                $result[$key][] = $text;
            }
        }
    }
    return $result;
}

function miu_api_read_json()
{
    $length = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
    if ($length > 32768) {
        miu_api_respond(413, array('ok' => false, 'message' => 'O pedido é demasiado grande.'));
    }
    $contentType = isset($_SERVER['CONTENT_TYPE']) ? strtolower((string)$_SERVER['CONTENT_TYPE']) : '';
    if (strpos($contentType, 'application/json') !== 0) {
        miu_api_respond(415, array('ok' => false, 'message' => 'Formato de pedido inválido.'));
    }
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > 32768) {
        miu_api_respond(413, array('ok' => false, 'message' => 'O pedido é demasiado grande.'));
    }
    $data = json_decode($raw, true, 16);
    if (!is_array($data)) {
        miu_api_respond(400, array('ok' => false, 'message' => 'Não foi possível ler a mensagem.'));
    }
    return $data;
}

try {
    $settings = miu_settings();
} catch (Exception $e) {
    @error_log('[miu] configuração/SQLite indisponível: ' . $e->getMessage());
    miu_api_respond(503, array('ok' => false, 'enabled' => false, 'message' => 'O Míu está temporariamente indisponível.'));
}

$method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string)$_SERVER['REQUEST_METHOD']) : 'GET';

if ($method === 'GET') {
    miu_api_respond(200, array(
        'ok' => true,
        'enabled' => $settings['enabled'] === '1',
        'name' => miu_text_slice($settings['name'], 40),
        'greeting' => miu_text_slice($settings['greeting'], 160),
        'launcherPrompt' => miu_text_slice($settings['launcher_prompt'], 60),
        'quickQuestions' => miu_quick_questions($settings),
        'quickReplies' => miu_quick_replies_global(),
        'localIntents' => array(
            'promptProbe' => miu_quick_reply_intent('prompt_probe'),
            'humanContact' => miu_quick_reply_intent('human_contact'),
        ),
        'maxMessageChars' => max(200, min(2000, (int)$settings['max_message_chars'])),
        'csrf' => miu_api_csrf(),
    ));
}

if ($method !== 'POST') {
    header('Allow: GET, POST');
    miu_api_respond(405, array('ok' => false, 'message' => 'Método não permitido.'));
}

if (!miu_api_same_origin()) {
    miu_api_respond(403, array('ok' => false, 'message' => 'Origem do pedido inválida.'));
}

$body = miu_api_read_json();
miu_api_session_start();
$sentCsrf = isset($body['csrf']) ? (string)$body['csrf'] : '';
if ($sentCsrf === '' || !hash_equals(miu_api_csrf(), $sentCsrf)) {
    miu_api_respond(403, array('ok' => false, 'message' => 'A sessão expirou. Fecha e volta a abrir o Míu.'));
}
if ($settings['enabled'] !== '1') {
    miu_api_respond(503, array('ok' => false, 'message' => 'O Míu está temporariamente indisponível.'));
}

$pageUrl = miu_api_page_path(isset($body['page']) ? $body['page'] : '/');
$action = isset($body['action']) ? trim((string)$body['action']) : 'message';
$stepContext = miu_context_from_request(isset($body['context']) ? $body['context'] : null, $pageUrl);
$uiState = miu_api_ui_state(isset($body['uiState']) ? $body['uiState'] : null);

if ($action === 'context') {
    miu_api_respond(200, array(
        'ok' => true,
        'context' => is_array($stepContext) ? array(
            'key' => $stepContext['context_key'],
            'product' => $stepContext['product_name'],
            'step' => $stepContext['step_name'],
            'includePricing' => (int)$stepContext['include_pricing'] === 1,
            'quickQuestions' => $stepContext['quick_questions_array'],
            'quickReplies' => miu_quick_replies_for_context($stepContext['context_key']),
        ) : null,
    ));
}
if ($action !== 'message' && $action !== 'local') {
    miu_api_respond(400, array('ok' => false, 'message' => 'Acção desconhecida.'));
}

$message = isset($body['message']) ? trim((string)$body['message']) : '';
$localReply = null;
if ($action === 'local') {
    $replyId = isset($body['quickReplyId']) ? trim((string)$body['quickReplyId']) : '';
    $replyContextKey = is_array($stepContext) && !empty($stepContext['context_key'])
        ? (string)$stepContext['context_key']
        : '';
    if ($replyId !== '') {
        $localReply = miu_quick_reply_find($replyId, $replyContextKey);
        if (is_array($localReply)) {
            $message = $localReply['question'];
        }
    } else {
        $localReply = miu_local_intent($message);
    }
    if (!is_array($localReply)) {
        miu_api_respond(400, array('ok' => false, 'message' => 'Resposta local desconhecida.'));
    }
}
$ip = mp_client_ip();
$ip = $ip !== '' ? $ip : '0.0.0.0';
$userAgent = isset($_SERVER['HTTP_USER_AGENT']) ? (string)$_SERVER['HTTP_USER_AGENT'] : '';
$publicId = isset($body['conversationId']) ? trim((string)$body['conversationId']) : '';
$contextKey = is_array($stepContext) ? (string)$stepContext['context_key'] : '';

$minuteLimit = max(2, min(30, (int)$settings['rate_per_minute']));
$hourLimit = max(10, min(300, (int)$settings['rate_per_hour']));
if (miu_rate_count($ip, 60) >= $minuteLimit || miu_rate_count($ip, 3600) >= $hourLimit) {
    header('Retry-After: 60');
    miu_api_respond(429, array(
        'ok' => false,
        'blocked' => true,
        'code' => 'rate_limit',
        'message' => 'Foram enviadas muitas mensagens seguidas. Espera um pouco antes de tentar novamente.',
    ));
}

$conversation = $publicId !== '' ? miu_find_conversation($publicId, $ip) : null;
if (!is_array($conversation)) {
    $conversation = miu_create_conversation($ip, $userAgent, $pageUrl);
} else {
    miu_touch_conversation((int)$conversation['id'], $pageUrl);
}

$wantsStream = !empty($body['stream']);
if ($action === 'local') {
    miu_api_finish_local_reply($conversation, $message, $localReply, $contextKey, $wantsStream);
}

$specialReply = miu_local_intent($message);
if (is_array($specialReply)) {
    miu_api_finish_local_reply($conversation, $message, $specialReply, $contextKey, $wantsStream);
}

$filter = miu_filter_message($message, $settings);
if (!$filter['ok']) {
    miu_insert_message(
        (int)$conversation['id'],
        'user',
        miu_text_slice($message, 5000),
        'blocked',
        '',
        '',
        $filter['code'],
        $contextKey
    );
    miu_api_respond(422, array(
        'ok' => false,
        'blocked' => true,
        'code' => $filter['code'],
        'message' => $filter['message'],
        'conversationId' => $conversation['public_id'],
    ));
}

$turnLimit = max(4, min(30, (int)$settings['max_conversation_turns']));
if (miu_conversation_user_turns((int)$conversation['id']) >= $turnLimit) {
    miu_insert_message((int)$conversation['id'], 'user', miu_text_slice($message, 5000), 'blocked', '', '', 'conversation_limit', $contextKey);
    miu_api_respond(409, array(
        'ok' => false,
        'blocked' => true,
        'resetConversation' => true,
        'code' => 'conversation_limit',
        'message' => 'Esta conversa já ficou muito longa. Começa uma conversa nova para eu continuar a ajudar.',
        'conversationId' => $conversation['public_id'],
    ));
}

miu_insert_message((int)$conversation['id'], 'user', $message, 'accepted', '', '', '', $contextKey);
$context = miu_context_messages((int)$conversation['id'], min(12, $turnLimit));
if ($wantsStream) {
    session_write_close();
    miu_api_stream_event('meta', array(
        'conversationId' => $conversation['public_id'],
        'contextKey' => $contextKey,
    ));
    $reply = miu_generate_reply_stream(
        $settings,
        $context,
        $pageUrl,
        $stepContext,
        $uiState,
        function ($delta, $model) {
            miu_api_stream_event('delta', array('text' => $delta, 'model' => $model));
        }
    );
    if (empty($reply['ok'])) {
        $friendly = 'Neste momento não estou a conseguir responder. Podes tentar novamente daqui a pouco ou usar o [formulário de contacto](contacto.html).';
        miu_insert_message(
            (int)$conversation['id'],
            'assistant',
            $friendly,
            'error',
            isset($reply['provider']) ? $reply['provider'] : '',
            isset($reply['model']) ? $reply['model'] : '',
            isset($reply['error']) ? $reply['error'] : 'Erro desconhecido.',
            $contextKey
        );
        @error_log('[miu] fornecedor indisponível: ' . (isset($reply['error']) ? $reply['error'] : 'erro desconhecido'));
        miu_api_stream_event('error', array('message' => $friendly));
        exit;
    }
    miu_insert_message(
        (int)$conversation['id'],
        'assistant',
        $reply['text'],
        'accepted',
        $reply['provider'],
        $reply['model'],
        '',
        $contextKey
    );
    miu_api_stream_event('done', array(
        'conversationId' => $conversation['public_id'],
        'provider' => $reply['provider'],
        'model' => $reply['model'],
    ));
    exit;
}

$reply = miu_generate_reply($settings, $context, $pageUrl, $stepContext, $uiState);

if (empty($reply['ok'])) {
    $friendly = 'Neste momento não estou a conseguir responder. Podes tentar novamente daqui a pouco ou usar o [formulário de contacto](contacto.html).';
    miu_insert_message(
        (int)$conversation['id'],
        'assistant',
        $friendly,
        'error',
        isset($reply['provider']) ? $reply['provider'] : '',
        isset($reply['model']) ? $reply['model'] : '',
        isset($reply['error']) ? $reply['error'] : 'Erro desconhecido.',
        $contextKey
    );
    @error_log('[miu] fornecedor indisponível: ' . (isset($reply['error']) ? $reply['error'] : 'erro desconhecido'));
    miu_api_respond(503, array(
        'ok' => false,
        'message' => $friendly,
        'conversationId' => $conversation['public_id'],
    ));
}

miu_insert_message(
    (int)$conversation['id'],
    'assistant',
    $reply['text'],
    'accepted',
    $reply['provider'],
    $reply['model'],
    '',
    $contextKey
);

miu_api_respond(200, array(
    'ok' => true,
    'reply' => $reply['text'],
    'conversationId' => $conversation['public_id'],
));
