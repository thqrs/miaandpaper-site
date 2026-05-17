<?php
/**
 * track-order-event.php — FUNNEL_TRACKING_SQLITE_V2
 *
 * Endpoint do funil. Recebe POST JSON e:
 *   1) escreve em SQLite (tabela funnel_events) via lib/db.php → fonte
 *      principal a partir desta fase;
 *   2) ainda escreve uma cópia privada em order-funnel-events.jsonl
 *      como fallback temporário (auditoria + recuperação se a base falhar).
 *
 * O servidor adiciona timestamp_iso e ip_number (IP completo — o utilizador
 * pediu explicitamente que se guardasse). Não guarda nome / email /
 * telefone / morada / conteúdo de campos pessoais — esses ficam em
 * `orders` para processamento da encomenda, não em `funnel_events`.
 *
 * Devolve sempre 204 No Content; o cliente não sabe (nem precisa) se a
 * escrita funcionou. Falhas escrevem em error_log.
 */

header('Cache-Control: no-store');
header('Content-Type: application/json; charset=utf-8');

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : '';
if ($method !== 'POST') {
    http_response_code(204);
    exit;
}

// Carrega lib/db.php cedo — helpers como mp_funnel_strip_pii,
// mp_funnel_classify_referrer e mp_tracking_client_ip são usados abaixo.
require_once __DIR__ . '/lib/db.php';

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) === 0 || strlen($raw) > 12288) {
    http_response_code(204);
    exit;
}

$payload = json_decode($raw, true);
if (!is_array($payload)) {
    http_response_code(204);
    exit;
}

function funnel_clean_string($value, $max)
{
    if (!is_scalar($value)) return '';
    $value = (string)$value;
    $clean = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $value);
    if ($clean === null) $clean = '';
    if (strlen($clean) > $max) $clean = substr($clean, 0, $max);
    return $clean;
}

function funnel_clean_int($value)
{
    if (!is_numeric($value)) return null;
    $i = (int)$value;
    if ($i < 0) return 0;
    if ($i > 2147483647) return 2147483647;
    return $i;
}

// 64-bit-safe clean para timestamps em milissegundos (que excedem INT32 já em 2001).
// Limita ao final do ano 2100 em ms como cap defensivo. PHP_INT_MAX em 64-bit
// é 9.2e18, então não há overflow.
function funnel_clean_int64($value)
{
    if (!is_numeric($value)) return null;
    $i = (int)$value;
    if ($i < 0) return 0;
    // 2100-01-01 em ms = 4102444800000
    if ($i > 4102444800000) return 4102444800000;
    return $i;
}

function funnel_clean_float($value)
{
    if (!is_numeric($value)) return null;
    $f = (float)$value;
    if (!is_finite($f)) return null;
    return round($f, 4);
}

// Whitelist de strings (column → max length).
$stringFields = array(
    'session_id'         => 64,
    'product_slug'       => 60,
    'product_type'       => 30,
    'event_name'         => 60,
    'step_id'            => 60,
    'device_type'        => 16,
    'orientation'        => 16,
    'landing_page'       => 240,
    'referrer'           => 240,
    'language'           => 16,
    'timezone'           => 64,
    'connection_effective_type' => 16,
    'page_load_type'     => 16,
    // Selected order context (não é PII):
    'selected_size'      => 60,
    'selected_delivery'  => 60,
    // Phase 9 (ui_interaction / dead_tap):
    'interaction_type'   => 16,
    'target_type'        => 32,
    'target_id'          => 80,
    'target_label'       => 120,
    'target_tag'         => 16,
    'target_class'       => 120,
    'action_name'        => 60,
    // ORIGINAL_ATTRIBUTION_V1 (Phase 3): captura única na 1ª página da sessão
    // e re-enviada com todos os eventos posteriores.
    'first_landing_page' => 240,
    'first_referrer'     => 240,
    'first_url'          => 320,
    'utm_source'         => 60,
    'utm_medium'         => 60,
    'utm_campaign'       => 80,
    'utm_content'        => 80,
    'utm_term'           => 80,
    'fbclid'             => 120,
    'gclid'              => 120,
    // TRANSITION_REASON_V1 (Phase 7)
    'from_step'          => 60,
    'to_step'            => 60,
    'transition_reason'  => 24,
    // MAGNIFIER_TRACKING_V1 (Phase 5)
    'image_slot'         => 32,
    'image_src'          => 240,
    'design_id'          => 80,
    'item_id'            => 80,
    'collection'         => 60,
    // REPLAY_FIELDS_V1 (Phase B)
    'page_instance_id'   => 32,
    'external_referrer'  => 240,
    'referrer_type'      => 24,
    // SEMANTIC_EVENTS_V1 (Phase C)
    'design_title'       => 120,
    'option_type'        => 32,
    'option_value'       => 120,
    'option_label'       => 120,
);

// Whitelist de inteiros.
$intFields = array(
    'step_index',
    'selected_pack',
    'seconds_since_session_start',
    'seconds_since_previous_event',
    'viewport_width',
    'viewport_height',
    'screen_width',
    'screen_height',
    'max_touch_points',
    'save_data',
    'page_load_ms',
    'dom_content_loaded_ms',
    'lcp_ms',
    'time_in_previous_step',
    'clicked_back_button',
    'scroll_depth_percent',
    'opened_discount_explanation',
    // TRANSITION_REASON_V1 + HEARTBEAT_V1 + SELECTION_SNAPSHOT_V1
    'validation_error_count',
    'selection_count',
    'is_visible',
    // REPLAY_FIELDS_V1 (Phase B)
    'client_event_index',
);

// 64-bit fields (use funnel_clean_int64) — fora do whitelist int normal.
$bigIntFields = array(
    'timestamp_ms',
);

// Floats / decimals.
$floatFields = array(
    'device_pixel_ratio',
    'x_percent',
    'y_percent',
);

$cleaned = array();
foreach ($stringFields as $key => $maxLen) {
    if (isset($payload[$key])) {
        $cleaned[$key] = funnel_clean_string($payload[$key], $maxLen);
    }
}
foreach ($intFields as $key) {
    if (isset($payload[$key])) {
        $v = funnel_clean_int($payload[$key]);
        if ($v !== null) $cleaned[$key] = $v;
    }
}
foreach ($bigIntFields as $key) {
    if (isset($payload[$key])) {
        $v = funnel_clean_int64($payload[$key]);
        if ($v !== null) $cleaned[$key] = $v;
    }
}
foreach ($floatFields as $key) {
    if (isset($payload[$key])) {
        $v = funnel_clean_float($payload[$key]);
        if ($v !== null) $cleaned[$key] = $v;
    }
}

// SELECTION_SNAPSHOT_V1 (Phase 4) + PII_FILTER_BANNED_V2 (Phase M):
// aceita selection_json como objecto (preferido — limpamos e re-serializamos
// com tamanho limitado) ou string JSON. Limite 2 KB depois de re-encode.
// A filtragem de PII vai pela lista canónica em lib/db.php — mp_funnel_strip_pii.
$selectionJsonClean = null;
if (isset($payload['selection_json'])) {
    $sel = $payload['selection_json'];
    if (is_string($sel)) {
        $decoded = json_decode($sel, true);
        if (is_array($decoded)) $sel = $decoded;
    }
    if (is_array($sel)) {
        $sel = mp_funnel_strip_pii($sel);
        $encoded = json_encode($sel, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded !== false && strlen($encoded) <= 2048) {
            $selectionJsonClean = $encoded;
        }
    }
}

// Eventos sem identificador mínimo são descartados.
if (empty($cleaned['event_name']) || empty($cleaned['session_id'])) {
    http_response_code(204);
    exit;
}

// REFERRER_FALLBACK_V1 (Phase B): se o cliente não enviou referrer_type,
// fazer a classificação no servidor para que os relatórios sejam sempre
// consistentes. Não sobrepõe valor do cliente quando este existe.
if (empty($cleaned['referrer_type'])) {
    $cleaned['referrer_type'] = mp_funnel_classify_referrer(
        isset($cleaned['referrer']) ? $cleaned['referrer'] : '',
        isset($cleaned['first_referrer']) ? $cleaned['first_referrer'] : '',
        isset($cleaned['utm_source']) ? $cleaned['utm_source'] : ''
    );
}
// EXTERNAL_REFERRER_V1 (Phase B): se não veio do cliente, derivar de
// first_referrer/referrer e descartar internos (mesma origem ou admin).
if (empty($cleaned['external_referrer'])) {
    $candidate = '';
    if (!empty($cleaned['first_referrer'])) $candidate = $cleaned['first_referrer'];
    elseif (!empty($cleaned['referrer'])) $candidate = $cleaned['referrer'];
    $candidateLower = strtolower((string)$candidate);
    $isInternal = false;
    if ($candidate === '') {
        $isInternal = true;
    } else {
        // Considera interno se host coincide com o nosso ou aponta para admin
        $host = '';
        if (isset($_SERVER['HTTP_HOST']) && $_SERVER['HTTP_HOST'] !== '') $host = strtolower(trim($_SERVER['HTTP_HOST']));
        if ($host !== '' && strpos($candidateLower, '://' . $host) !== false) $isInternal = true;
        if (strpos($candidateLower, 'miaandpaper.com') !== false) $isInternal = true;
        if (strpos($candidateLower, '/admin-') !== false || strpos($candidateLower, 'admin-funnel.php') !== false || strpos($candidateLower, 'admin-live-dashboard.php') !== false) $isInternal = true;
        if (strpos($candidateLower, 'localhost') !== false || strpos($candidateLower, '127.0.0.1') !== false) $isInternal = true;
    }
    if (!$isInternal && $candidate !== '') {
        $cleaned['external_referrer'] = substr($candidate, 0, 240);
    }
}

$timestampIso = gmdate('Y-m-d\TH:i:s\Z');

// TRACKING_CLIENT_IP_V1: IP efectivo via lib/db.php (já carregado no topo).
// Sob Cloudflare ou reverse proxy, REMOTE_ADDR é o IP do proxy e todos os
// visitantes parecem iguais; mp_tracking_client_ip() devolve o IP real do
// visitante quando é seguro fazê-lo (e fica no REMOTE_ADDR caso contrário).
$ipNumber = funnel_clean_string(mp_tracking_client_ip(), 64);

// Linha "wide" para SQLite: colunas nativas conhecidas + event_json com o
// resto dos campos limpos.
$row = array(
    'created_at'           => $timestampIso,
    'session_id'           => isset($cleaned['session_id']) ? $cleaned['session_id'] : null,
    'product_slug'         => isset($cleaned['product_slug']) ? $cleaned['product_slug'] : null,
    'product_type'         => isset($cleaned['product_type']) ? $cleaned['product_type'] : null,
    'event_name'           => isset($cleaned['event_name']) ? $cleaned['event_name'] : null,
    'step_id'              => isset($cleaned['step_id']) ? $cleaned['step_id'] : null,
    'step_index'           => isset($cleaned['step_index']) ? $cleaned['step_index'] : null,
    'device_type'          => isset($cleaned['device_type']) ? $cleaned['device_type'] : null,
    'viewport_width'       => isset($cleaned['viewport_width']) ? $cleaned['viewport_width'] : null,
    'viewport_height'      => isset($cleaned['viewport_height']) ? $cleaned['viewport_height'] : null,
    'screen_width'         => isset($cleaned['screen_width']) ? $cleaned['screen_width'] : null,
    'screen_height'        => isset($cleaned['screen_height']) ? $cleaned['screen_height'] : null,
    'device_pixel_ratio'   => isset($cleaned['device_pixel_ratio']) ? $cleaned['device_pixel_ratio'] : null,
    'orientation'          => isset($cleaned['orientation']) ? $cleaned['orientation'] : null,
    'ip_number'            => $ipNumber,
    'event_json'           => json_encode($cleaned, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    'selection_json'       => $selectionJsonClean,
    'first_referrer'       => isset($cleaned['first_referrer']) ? $cleaned['first_referrer'] : null,
    'utm_source'           => isset($cleaned['utm_source']) ? $cleaned['utm_source'] : null,
);

// ----- Escrita principal: SQLite -----
$writeOk = false;
$skipReason = '';
try {
    // TRACKING_IGNORE_AND_ARCHIVE_V1: drop silencioso se o IP estiver na
    // ignore list (admin / agentes em desenvolvimento). Devolve 204 na
    // mesma — o cliente não distingue.
    if (mp_db_is_ip_ignored($ipNumber)) {
        $skipReason = 'ignore_list';
    }

    // FUNNEL_RATE_LIMIT_V1: limite 60 eventos / IP / 60 s. Acima disso, drop
    // silencioso (e regista no error_log a primeira vez por janela). Usa o
    // índice idx_funnel_ip_created para o COUNT ser O(log n).
    if ($skipReason === '' && $ipNumber !== '') {
        $windowStart = gmdate('Y-m-d\TH:i:s\Z', time() - 60);
        $recentCount = mp_db_count_recent_funnel_events($ipNumber, $windowStart);
        if ($recentCount >= 60) {
            $skipReason = 'rate_limit';
            @error_log('[miaandpaper] funnel rate-limit atingido para IP ' . $ipNumber . ' (' . $recentCount . ' eventos em 60s)');
        }
    }

    if ($skipReason === '') {
        $id = mp_db_log_funnel_event($row);
        $writeOk = ($id !== false);
    } else {
        // TRACKING_SKIPPED_LOG_V1: regista o motivo do drop num JSONL privado
        // para que o admin possa confirmar que o evento chegou mas foi
        // intencionalmente ignorado. Sem PII.
        mp_tracking_log_skipped_event(array(
            'timestamp_iso' => $timestampIso,
            'effective_ip'  => $ipNumber,
            'skip_reason'   => $skipReason,
            'event_name'    => isset($cleaned['event_name']) ? $cleaned['event_name'] : '',
            'product_slug'  => isset($cleaned['product_slug']) ? $cleaned['product_slug'] : '',
            'session_id'    => isset($cleaned['session_id']) ? $cleaned['session_id'] : '',
            'user_agent'    => isset($_SERVER['HTTP_USER_AGENT']) ? (string)$_SERVER['HTTP_USER_AGENT'] : '',
        ));
    }
} catch (Exception $e) {
    @error_log('[miaandpaper] funnel SQLite write falhou: ' . $e->getMessage());
}

// ----- Fallback: JSONL em pasta privada -----
// FUNNEL_DAILY_JSONL_V1 (Phase G): escrita por dia em
//   private/funnel-jsonl/YYYY-MM-DD.jsonl
// Mantemos COMPATIBILIDADE com o ficheiro único antigo
//   private/order-funnel-events.jsonl
// — esse continua a ser escrito (não estraga ferramentas antigas), mas o
// replay/dashboard usa preferencialmente os ficheiros por dia.
// Skip se ignore list (não interessa nem como fallback). Em rate-limit
// continuamos a escrever no JSONL para que o admin possa auditar abuso.
if ($skipReason !== 'ignore_list') {
    $lineBase = array_merge(array('timestamp_iso' => $timestampIso, 'ip' => $ipNumber, 'skip_reason' => $skipReason), $cleaned);
    if ($selectionJsonClean !== null) {
        $sjsDecoded = json_decode($selectionJsonClean, true);
        if (is_array($sjsDecoded)) $lineBase['selection_snapshot'] = $sjsDecoded;
    }

    // 1) JSONL diário (novo, preferido para replay)
    try { mp_funnel_append_jsonl_event($lineBase); } catch (Exception $e) {
        @error_log('[miaandpaper] daily jsonl exception: ' . $e->getMessage());
    }

    // 2) JSONL legado (mantido para compatibilidade)
    $logPath = mp_private_path('order-funnel-events.jsonl');
    if ($logPath !== null) {
        $encoded = json_encode($lineBase, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded !== false) {
            @file_put_contents($logPath, $encoded . "\n", FILE_APPEND | LOCK_EX);
            @chmod($logPath, 0600);
        }
    }
}

http_response_code(204);
