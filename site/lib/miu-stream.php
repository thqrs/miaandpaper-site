<?php
/**
 * MIU_STREAM_V1 — streaming SSE dos fornecedores para callback local.
 *
 * O endpoint público transforma os deltas em NDJSON. Aqui ficam apenas a
 * ligação aos fornecedores, o parser SSE e a captura do modelo realmente usado.
 */

function miu_stream_error_from_raw($raw, $status)
{
    $candidates = preg_split('/\r\n|\r|\n/', (string)$raw);
    foreach ((array)$candidates as $line) {
        $line = trim((string)$line);
        if (strpos($line, 'data:') === 0) {
            $line = trim(substr($line, 5));
        }
        $data = json_decode($line, true);
        if (is_array($data) && isset($data['error'])) {
            if (is_array($data['error']) && isset($data['error']['message'])) {
                return (string)$data['error']['message'];
            }
            if (is_scalar($data['error'])) {
                return (string)$data['error'];
            }
        }
    }
    return 'O fornecedor respondeu com HTTP ' . (int)$status . '.';
}

function miu_http_sse($url, $headers, $payload, $extractor, $emit)
{
    if (!function_exists('curl_init')) {
        return array('ok' => false, 'status' => 0, 'text' => '', 'model' => '', 'error' => 'Streaming requer a extensão PHP cURL.');
    }
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return array('ok' => false, 'status' => 0, 'text' => '', 'model' => '', 'error' => 'Não foi possível codificar o pedido.');
    }

    $raw = '';
    $lineBuffer = '';
    $text = '';
    $model = '';
    $tooLarge = false;
    $processLine = function ($line) use ($extractor, $emit, &$text, &$model) {
        $line = trim((string)$line);
        if (strpos($line, 'data:') !== 0) {
            return;
        }
        $dataText = trim(substr($line, 5));
        if ($dataText === '' || $dataText === '[DONE]') {
            return;
        }
        $data = json_decode($dataText, true);
        if (!is_array($data)) {
            return;
        }
        $part = call_user_func($extractor, $data);
        if (!is_array($part)) {
            return;
        }
        if (!empty($part['model'])) {
            $model = miu_text_slice((string)$part['model'], 160);
        }
        $delta = isset($part['text']) ? (string)$part['text'] : '';
        if ($delta === '' || miu_text_length($text) >= 5000) {
            return;
        }
        $remaining = 5000 - miu_text_length($text);
        $delta = miu_text_slice($delta, $remaining);
        $text .= $delta;
        call_user_func($emit, $delta, $model);
    };

    $curl = curl_init($url);
    curl_setopt_array($curl, array(
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $json,
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_CONNECTTIMEOUT => 6,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_USERAGENT => 'MiaAndPaper-Miu/1.0',
        CURLOPT_WRITEFUNCTION => function ($curlHandle, $chunk) use (&$raw, &$lineBuffer, &$tooLarge, $processLine) {
            if (strlen($raw) + strlen($chunk) > 2097152) {
                $tooLarge = true;
                return 0;
            }
            $raw .= $chunk;
            $lineBuffer .= $chunk;
            while (($position = strpos($lineBuffer, "\n")) !== false) {
                $line = substr($lineBuffer, 0, $position);
                $lineBuffer = substr($lineBuffer, $position + 1);
                $processLine($line);
            }
            return strlen($chunk);
        },
    ));
    $caBundle = miu_local_curl_ca_bundle();
    if ($caBundle !== null) {
        curl_setopt($curl, CURLOPT_CAINFO, $caBundle);
    }
    $executed = curl_exec($curl);
    if ($lineBuffer !== '') {
        $processLine($lineBuffer);
    }
    $status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);

    if ($status >= 200 && $status < 300 && trim($text) !== '') {
        return array('ok' => true, 'status' => $status, 'text' => trim($text), 'model' => $model, 'error' => '');
    }
    if ($tooLarge) {
        $error = 'Resposta externa demasiado grande.';
    } elseif ($executed === false && $curlError !== '') {
        $error = $curlError;
    } else {
        $error = miu_stream_error_from_raw($raw, $status);
    }
    return array('ok' => false, 'status' => $status, 'text' => trim($text), 'model' => $model, 'error' => $error);
}

function miu_stream_openrouter_extract($data)
{
    $content = isset($data['choices'][0]['delta']['content']) ? $data['choices'][0]['delta']['content'] : '';
    if (is_array($content)) {
        $chunks = array();
        foreach ($content as $part) {
            if (is_array($part) && isset($part['text'])) {
                $chunks[] = (string)$part['text'];
            }
        }
        $content = implode('', $chunks);
    }
    return array(
        'text' => is_scalar($content) ? (string)$content : '',
        'model' => isset($data['model']) ? (string)$data['model'] : '',
    );
}

function miu_stream_gemini_extract($data)
{
    $parts = isset($data['candidates'][0]['content']['parts']) && is_array($data['candidates'][0]['content']['parts'])
        ? $data['candidates'][0]['content']['parts']
        : array();
    $chunks = array();
    foreach ($parts as $part) {
        if (is_array($part) && isset($part['text'])) {
            $chunks[] = (string)$part['text'];
        }
    }
    return array(
        'text' => implode('', $chunks),
        'model' => isset($data['modelVersion']) ? (string)$data['modelVersion'] : '',
    );
}

function miu_stream_call_openrouter($settings, $secrets, $context, $systemInstruction, $emit)
{
    $messages = array(array('role' => 'system', 'content' => $systemInstruction));
    foreach ($context as $message) {
        $messages[] = array('role' => $message['role'], 'content' => $message['content']);
    }
    $requestedModel = trim((string)$settings['openrouter_model']);
    if ($requestedModel === '') {
        $requestedModel = 'openrouter/free';
    }
    $result = miu_http_sse(
        'https://openrouter.ai/api/v1/chat/completions',
        array(
            'Authorization: Bearer ' . $secrets['openrouter_api_key'],
            'Content-Type: application/json',
            'Accept: text/event-stream',
            'HTTP-Referer: https://miaandpaper.com/',
            'X-Title: Mia & Paper — Míu',
        ),
        array(
            'model' => $requestedModel,
            'messages' => $messages,
            'temperature' => 0.35,
            'max_tokens' => max(100, min(1000, (int)$settings['max_output_tokens'])),
            'reasoning' => array('effort' => 'none', 'exclude' => true),
            'stream' => true,
        ),
        'miu_stream_openrouter_extract',
        $emit
    );
    $result['provider'] = 'openrouter';
    $result['model'] = $result['model'] !== '' ? $result['model'] : $requestedModel;
    return $result;
}

function miu_stream_call_gemini($settings, $secrets, $context, $systemInstruction, $emit)
{
    $contents = array();
    foreach ($context as $message) {
        $role = $message['role'] === 'assistant' ? 'model' : 'user';
        $lastIndex = count($contents) - 1;
        if ($lastIndex >= 0 && $contents[$lastIndex]['role'] === $role) {
            $contents[$lastIndex]['parts'][0]['text'] .= "\n\n" . $message['content'];
        } else {
            $contents[] = array('role' => $role, 'parts' => array(array('text' => $message['content'])));
        }
    }
    $model = trim((string)$settings['gemini_model']);
    if ($model === '') {
        $model = 'gemini-2.5-flash-lite';
    }
    $result = miu_http_sse(
        'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':streamGenerateContent?alt=sse',
        array('x-goog-api-key: ' . $secrets['gemini_api_key'], 'Content-Type: application/json', 'Accept: text/event-stream'),
        array(
            'system_instruction' => array('parts' => array(array('text' => $systemInstruction))),
            'contents' => $contents,
            'generationConfig' => array(
                'temperature' => 0.35,
                'maxOutputTokens' => max(100, min(1000, (int)$settings['max_output_tokens'])),
            ),
        ),
        'miu_stream_gemini_extract',
        $emit
    );
    $result['provider'] = 'gemini';
    $result['model'] = $result['model'] !== '' ? $result['model'] : $model;
    return $result;
}

function miu_generate_reply_stream($settings, $context, $pageUrl, $stepContext, $uiState, $emit)
{
    $secrets = miu_secret_config();
    $primary = $settings['provider'] === 'gemini' ? 'gemini' : 'openrouter';
    $providers = array($primary);
    if ($settings['fallback_enabled'] === '1') {
        $providers[] = $primary === 'gemini' ? 'openrouter' : 'gemini';
    }
    $instruction = miu_system_instruction($settings, $pageUrl, $stepContext, $uiState);
    $errors = array();
    foreach ($providers as $provider) {
        if (!miu_provider_is_configured($provider, $secrets)) {
            $errors[] = $provider . ': chave não configurada';
            continue;
        }
        $result = $provider === 'gemini'
            ? miu_stream_call_gemini($settings, $secrets, $context, $instruction, $emit)
            : miu_stream_call_openrouter($settings, $secrets, $context, $instruction, $emit);
        if (!empty($result['ok'])) {
            return $result;
        }
        if (!empty($result['text'])) {
            return $result;
        }
        $errors[] = $provider . ': ' . $result['error'];
    }
    return array(
        'ok' => false,
        'provider' => $primary,
        'model' => $primary === 'gemini' ? $settings['gemini_model'] : $settings['openrouter_model'],
        'text' => '',
        'error' => implode(' | ', $errors),
    );
}
