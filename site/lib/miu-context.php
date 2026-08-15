<?php
/**
 * MIU_CONTEXT_V1 — contexto validado de produto/passo e configuração editável.
 *
 * Os objectivos editáveis vivem no SQLite do Míu; as perguntas e respostas
 * rápidas têm fonte única em content/miu-quick-replies.json. Os preços nunca
 * são copiados: são lidos do pricing.json certo quando a prompt é construída.
 */

function miu_context_db_migrate($pdo)
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS bot_step_contexts ('
        . 'context_key TEXT PRIMARY KEY, scope TEXT NOT NULL, product_slug TEXT NOT NULL, '
        . 'product_name TEXT NOT NULL, step_id TEXT NOT NULL, step_name TEXT NOT NULL, '
        . 'step_template TEXT NOT NULL DEFAULT \'\', step_order INTEGER NOT NULL DEFAULT 0, '
        . 'objectives TEXT NOT NULL DEFAULT \'\', quick_questions TEXT NOT NULL DEFAULT \'[]\', '
        . 'include_pricing INTEGER NOT NULL DEFAULT 0, is_custom INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)'
    );
    $columns = $pdo->query('PRAGMA table_info(bot_step_contexts)')->fetchAll();
    $hasCustom = false;
    foreach ($columns as $column) {
        if (isset($column['name']) && $column['name'] === 'is_custom') {
            $hasCustom = true;
            break;
        }
    }
    if (!$hasCustom) {
        $pdo->exec('ALTER TABLE bot_step_contexts ADD COLUMN is_custom INTEGER NOT NULL DEFAULT 0');
    }
    $pdo->exec(
        'CREATE INDEX IF NOT EXISTS bot_step_contexts_product_idx '
        . 'ON bot_step_contexts(scope, product_name, step_order)'
    );
}

function miu_context_sources()
{
    $site = dirname(__DIR__);
    return array(
        'main' => array(
            'label' => 'Catálogo principal',
            'products' => $site . '/content/products',
            'pricing' => $site . '/content/pricing.json',
        ),
        'congress-2026' => array(
            'label' => 'Congresso 2026',
            'products' => $site . '/congressos/2026/content/products',
            'pricing' => $site . '/congressos/2026/content/pricing.json',
        ),
    );
}

function miu_context_safe_id($value)
{
    $value = trim((string)$value);
    return preg_match('/^[a-z0-9][a-z0-9_-]{0,100}$/i', $value) ? $value : '';
}

function miu_context_key($scope, $productSlug, $stepId)
{
    return $scope . ':' . $productSlug . ':' . $stepId;
}

function miu_context_read_json($path)
{
    $raw = is_file($path) ? file_get_contents($path) : '';
    $data = json_decode((string)$raw, true);
    return is_array($data) ? $data : null;
}

function miu_context_read_product($scope, $productSlug)
{
    $sources = miu_context_sources();
    $productSlug = miu_context_safe_id($productSlug);
    if (!isset($sources[$scope]) || $productSlug === '') {
        return null;
    }
    $product = miu_context_read_json($sources[$scope]['products'] . '/' . $productSlug . '.json');
    if (!is_array($product) || !isset($product['steps']) || !is_array($product['steps'])) {
        return null;
    }
    $jsonSlug = isset($product['slug']) ? (string)$product['slug'] : $productSlug;
    return $jsonSlug === $productSlug ? $product : null;
}

function miu_context_find_step($product, $stepId)
{
    $stepId = miu_context_safe_id($stepId);
    if ($stepId === '' || !isset($product['steps']) || !is_array($product['steps'])) {
        return null;
    }
    foreach ($product['steps'] as $index => $step) {
        if (is_array($step) && isset($step['id']) && (string)$step['id'] === $stepId) {
            $step['_miu_order'] = (int)$index;
            return $step;
        }
    }
    return null;
}

function miu_context_product_name($product, $fallback)
{
    foreach (array('name', 'title', 'label') as $key) {
        if (isset($product[$key]) && trim((string)$product[$key]) !== '') {
            return trim((string)$product[$key]);
        }
    }
    return (string)$fallback;
}

function miu_context_step_name($step)
{
    foreach (array('title', 'label', 'id') as $key) {
        if (isset($step[$key]) && trim((string)$step[$key]) !== '') {
            return trim((string)$step[$key]);
        }
    }
    return 'Passo';
}

function miu_context_default_questions($scope, $productSlug, $step)
{
    $stepId = isset($step['id']) ? (string)$step['id'] : '';
    return miu_quick_reply_questions_for_context(miu_context_key($scope, $productSlug, $stepId));
}

function miu_context_default_objectives($productName, $step)
{
    $stepName = miu_context_step_name($step);
    $template = isset($step['template']) ? (string)$step['template'] : '';
    $parts = array(
        'Ajudar a pessoa a perceber e concluir o passo “' . $stepName . '” do produto “' . $productName . '”.',
        'Explicar apenas as opções realmente presentes neste passo e não inventar disponibilidade, medidas ou condições.',
    );
    if (isset($step['text']) && trim((string)$step['text']) !== '') {
        $parts[] = 'Texto mostrado no site: ' . trim((string)$step['text']);
    }
    if (!empty($step['fields']) && is_array($step['fields'])) {
        $fieldLines = array();
        foreach (array_slice($step['fields'], 0, 20) as $field) {
            if (!is_array($field)) {
                continue;
            }
            $label = isset($field['label']) ? trim((string)$field['label']) : '';
            if ($label === '') {
                continue;
            }
            $description = $label . (!empty($field['required']) ? ' (obrigatório)' : ' (opcional)');
            if (!empty($field['placeholder'])) {
                $description .= ' — ' . trim((string)$field['placeholder']);
            }
            $fieldLines[] = '- ' . $description;
            if (!empty($field['sectionText'])) {
                $fieldLines[] = '- Nota mostrada: ' . trim((string)$field['sectionText']);
            }
        }
        if ($fieldLines) {
            $parts[] = "Campos realmente mostrados neste passo:\n" . implode("\n", $fieldLines);
        }
    }
    if (
        !empty($step['items'])
        && is_array($step['items'])
        && $template !== 'design-grid'
        && count($step['items']) <= 30
    ) {
        $itemLines = array();
        foreach ($step['items'] as $item) {
            if (!is_array($item)) {
                continue;
            }
            $title = isset($item['title']) ? trim((string)$item['title']) : '';
            if ($title === '' && isset($item['value'])) {
                $title = trim((string)$item['value']);
            }
            if ($title === '' && isset($item['quantity'])) {
                $title = (string)(int)$item['quantity'];
            }
            if ($title === '') {
                continue;
            }
            $detail = !empty($item['subtitle']) ? ' — ' . trim((string)$item['subtitle']) : '';
            $itemLines[] = '- ' . $title . $detail;
        }
        if ($itemLines) {
            $parts[] = "Opções realmente mostradas neste passo:\n" . implode("\n", $itemLines);
        }
    }
    if (in_array($template, array('quantity-builder', 'purchase-option', 'custom-quantity-builder'), true)) {
        $parts[] = 'Explicar quantidades e preços usando exclusivamente a tabela actual injectada abaixo.';
    } elseif ($template === 'delivery-contact') {
        $parts[] = 'Esclarecer entrega, contacto e pagamento sem pedir dados pessoais dentro do chat.';
    } elseif ($template === 'confirm') {
        $parts[] = 'Ajudar a rever o pedido; nunca afirmar que ficou confirmado ou pago antes do envio real.';
    } elseif (in_array($template, array('photo-upload', 'original-artwork-upload'), true)) {
        $parts[] = 'Orientar sobre qualidade e formato do ficheiro sem pedir que seja enviado pelo chat.';
    }
    return implode("\n", $parts);
}

function miu_context_default_include_pricing($step)
{
    $template = isset($step['template']) ? (string)$step['template'] : '';
    return in_array($template, array('quantity-builder', 'purchase-option', 'custom-quantity-builder'), true) ? 1 : 0;
}

function miu_context_seed_row($scope, $productSlug, $product, $step)
{
    $productName = miu_context_product_name($product, $productSlug);
    $stepId = (string)$step['id'];
    $questions = miu_context_default_questions($scope, $productSlug, $step);
    $now = gmdate('Y-m-d H:i:s');
    $stmt = miu_db()->prepare(
        'INSERT INTO bot_step_contexts '
        . '(context_key, scope, product_slug, product_name, step_id, step_name, step_template, step_order, '
        . 'objectives, quick_questions, include_pricing, is_custom, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) '
        . 'ON CONFLICT(context_key) DO UPDATE SET product_name = excluded.product_name, '
        . 'step_name = excluded.step_name, step_template = excluded.step_template, step_order = excluded.step_order, '
        . 'objectives = CASE WHEN bot_step_contexts.is_custom = 0 THEN excluded.objectives ELSE bot_step_contexts.objectives END, '
        . 'quick_questions = excluded.quick_questions, '
        . 'include_pricing = CASE WHEN bot_step_contexts.is_custom = 0 THEN excluded.include_pricing ELSE bot_step_contexts.include_pricing END'
    );
    $stmt->execute(array(
        miu_context_key($scope, $productSlug, $stepId),
        $scope,
        $productSlug,
        $productName,
        $stepId,
        miu_context_step_name($step),
        isset($step['template']) ? (string)$step['template'] : '',
        isset($step['_miu_order']) ? (int)$step['_miu_order'] : 0,
        miu_context_default_objectives($productName, $step),
        json_encode($questions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        miu_context_default_include_pricing($step),
        0,
        $now,
    ));
}

function miu_context_sync_all()
{
    $sources = miu_context_sources();
    $seen = 0;
    foreach ($sources as $scope => $source) {
        $files = glob($source['products'] . '/*.json');
        if (!is_array($files)) {
            continue;
        }
        sort($files, SORT_STRING);
        foreach ($files as $path) {
            $productSlug = pathinfo($path, PATHINFO_FILENAME);
            $product = miu_context_read_product($scope, $productSlug);
            if (!is_array($product)) {
                continue;
            }
            foreach ($product['steps'] as $index => $step) {
                if (!is_array($step) || empty($step['id'])) {
                    continue;
                }
                $step['_miu_order'] = (int)$index;
                miu_context_seed_row($scope, $productSlug, $product, $step);
                $seen++;
            }
        }
    }
    return $seen;
}

function miu_context_questions_from_json($json)
{
    $decoded = json_decode((string)$json, true);
    if (!is_array($decoded)) {
        return array();
    }
    $questions = array();
    foreach (array_slice($decoded, 0, 6) as $question) {
        $question = trim(miu_text_slice((string)$question, 120));
        if ($question !== '' && !in_array($question, $questions, true)) {
            $questions[] = $question;
        }
    }
    return $questions;
}

function miu_context_get($scope, $productSlug, $stepId)
{
    $sources = miu_context_sources();
    $scope = isset($sources[$scope]) ? $scope : '';
    $productSlug = miu_context_safe_id($productSlug);
    $stepId = miu_context_safe_id($stepId);
    if ($scope === '' || $productSlug === '' || $stepId === '') {
        return null;
    }
    $product = miu_context_read_product($scope, $productSlug);
    $step = is_array($product) ? miu_context_find_step($product, $stepId) : null;
    if (!is_array($step)) {
        return null;
    }
    miu_context_seed_row($scope, $productSlug, $product, $step);
    $stmt = miu_db()->prepare('SELECT * FROM bot_step_contexts WHERE context_key = ? LIMIT 1');
    $stmt->execute(array(miu_context_key($scope, $productSlug, $stepId)));
    $row = $stmt->fetch();
    if (!is_array($row)) {
        return null;
    }
    $row['quick_questions_array'] = miu_context_questions_from_json($row['quick_questions']);
    return $row;
}

function miu_context_scope_for_page($pageUrl)
{
    return strpos((string)$pageUrl, '/congressos/2026/') !== false ? 'congress-2026' : 'main';
}

function miu_context_from_request($request, $pageUrl)
{
    if (!is_array($request)) {
        return null;
    }
    $scope = miu_context_scope_for_page($pageUrl);
    $requestedScope = isset($request['scope']) ? (string)$request['scope'] : '';
    if ($requestedScope !== '' && $requestedScope !== $scope) {
        return null;
    }
    return miu_context_get(
        $scope,
        isset($request['product']) ? $request['product'] : '',
        isset($request['step']) ? $request['step'] : ''
    );
}

function miu_context_format_euros($cents)
{
    return number_format(((int)$cents) / 100, 2, ',', ' ') . ' €';
}

function miu_context_pricing_text($scope, $productSlug)
{
    $sources = miu_context_sources();
    if (!isset($sources[$scope])) {
        return '';
    }
    $pricing = miu_context_read_json($sources[$scope]['pricing']);
    $entry = isset($pricing['products'][$productSlug]) && is_array($pricing['products'][$productSlug])
        ? $pricing['products'][$productSlug]
        : null;
    if (!is_array($entry)) {
        return '';
    }
    $lines = array();
    if (!empty($entry['pricingMode'])) {
        $lines[] = 'Modo de preço: ' . (string)$entry['pricingMode'];
    }
    if (isset($entry['minimumQuantity'])) {
        $lines[] = 'Quantidade mínima: ' . (int)$entry['minimumQuantity'];
    }
    if (!empty($entry['prices']) && is_array($entry['prices'])) {
        foreach ($entry['prices'] as $priceKey => $table) {
            if (!is_array($table)) {
                continue;
            }
            $lines[] = 'Tabela “' . $priceKey . '” (quantidade — total):';
            foreach ($table as $quantity => $cents) {
                if (is_numeric($cents)) {
                    $lines[] = '- ' . $quantity . ' — ' . miu_context_format_euros($cents);
                }
            }
        }
    }
    if (!empty($entry['flatUnitPricesCents']) && is_array($entry['flatUnitPricesCents'])) {
        $lines[] = 'Preços unitários/opções:';
        foreach ($entry['flatUnitPricesCents'] as $label => $cents) {
            if (is_numeric($cents)) {
                $lines[] = '- ' . $label . ' — ' . miu_context_format_euros($cents);
            }
        }
    }
    return miu_text_slice(implode("\n", $lines), 14000);
}

function miu_context_prompt($row)
{
    if (!is_array($row)) {
        return '';
    }
    $sources = miu_context_sources();
    $scopeLabel = isset($sources[$row['scope']]['label']) ? $sources[$row['scope']]['label'] : $row['scope'];
    $parts = array(
        '--- CONTEXTO ACTUAL VALIDADO DO WIZARD ---',
        'Contexto comercial: ' . $scopeLabel,
        'Produto: ' . $row['product_name'] . ' (' . $row['product_slug'] . ')',
        'Passo actual: ' . $row['step_name'] . ' (' . $row['step_id'] . ')',
        'Objectivos deste passo:',
        trim((string)$row['objectives']),
    );
    if ((int)$row['include_pricing'] === 1) {
        $pricing = miu_context_pricing_text($row['scope'], $row['product_slug']);
        if ($pricing !== '') {
            $parts[] = 'TABELA DE PREÇOS ACTUAL DESTE PRODUTO';
            $parts[] = $pricing;
            $parts[] = 'Usa estes valores apenas para explicar este passo. Não extrapoles quantidades nem preços ausentes.';
        }
    }
    return implode("\n", array_filter($parts, function ($part) {
        return trim((string)$part) !== '';
    }));
}

function miu_context_admin_rows()
{
    return miu_db()->query(
        'SELECT * FROM bot_step_contexts ORDER BY scope, product_name COLLATE NOCASE, step_order, step_name COLLATE NOCASE'
    )->fetchAll();
}

function miu_context_save($contextKey, $objectives, $includePricing)
{
    $contextKey = trim((string)$contextKey);
    $stmt = miu_db()->prepare(
        'UPDATE bot_step_contexts SET objectives = ?, include_pricing = ?, is_custom = 1, updated_at = ? '
        . 'WHERE context_key = ?'
    );
    $stmt->execute(array(
        trim(miu_text_slice($objectives, 10000)),
        $includePricing ? 1 : 0,
        gmdate('Y-m-d H:i:s'),
        $contextKey,
    ));
    return $stmt->rowCount() > 0;
}
