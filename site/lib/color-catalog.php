<?php

require_once __DIR__ . '/db.php';

function mp_color_catalog_slug($value)
{
    $value = strtolower(trim((string)$value));
    $value = preg_replace('/[^a-z0-9_-]+/', '-', $value);
    return trim((string)$value, '-_');
}

function mp_color_catalog_product_files()
{
    $paths = glob(__DIR__ . '/../content/products/*.json');
    return is_array($paths) ? $paths : array();
}

function mp_color_catalog_flows()
{
    $flows = array();

    foreach (mp_color_catalog_product_files() as $path) {
        $product = json_decode((string)@file_get_contents($path), true);
        if (!is_array($product) || empty($product['slug']) || empty($product['steps']) || !is_array($product['steps'])) {
            continue;
        }
        $productSlug = mp_color_catalog_slug($product['slug']);
        $stepsById = array();
        foreach ($product['steps'] as $candidate) {
            if (is_array($candidate) && !empty($candidate['id'])) {
                $stepsById[(string)$candidate['id']] = $candidate;
            }
        }
        foreach ($product['steps'] as $step) {
            if (!is_array($step) || (isset($step['template']) ? $step['template'] : '') !== 'palette-grid' || empty($step['id'])) {
                continue;
            }
            $stepId = mp_color_catalog_slug($step['id']);
            $key = $productSlug . ':' . $stepId;
            $flowColors = isset($step['configuredColors']) && is_array($step['configuredColors'])
                ? $step['configuredColors']
                : (isset($step['individualColors']) && is_array($step['individualColors']) ? $step['individualColors'] : array());
            if (empty($flowColors) && !empty($step['colorSourceStep']) && isset($stepsById[(string)$step['colorSourceStep']])) {
                $sourceStep = $stepsById[(string)$step['colorSourceStep']];
                $flowColors = isset($sourceStep['configuredColors']) && is_array($sourceStep['configuredColors'])
                    ? $sourceStep['configuredColors']
                    : (isset($sourceStep['individualColors']) && is_array($sourceStep['individualColors']) ? $sourceStep['individualColors'] : array());
            }
            $productLabel = trim((string)(isset($product['name']) ? $product['name'] : (isset($product['title']) ? $product['title'] : '')));
            if ($productLabel === '') {
                $productLabel = ucfirst($productSlug);
            }
            $flows[$key] = array(
                'key' => $key,
                'productSlug' => $productSlug,
                'stepId' => $stepId,
                'label' => $productLabel . ' — ' . trim((string)(isset($step['title']) ? $step['title'] : $stepId)),
                'colors' => $flowColors,
            );
        }
    }

    ksort($flows);
    return array_values($flows);
}

function mp_color_catalog_seed()
{
    $pdo = mp_db();
    $flows = mp_color_catalog_flows();
    $now = mp_db_now();
    $insertColor = $pdo->prepare('INSERT INTO colors (id, name, hex, light_hex, dark_hex, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            light_hex=COALESCE(colors.light_hex, excluded.light_hex),
            dark_hex=COALESCE(colors.dark_hex, excluded.dark_hex)');
    $insertFlow = $pdo->prepare('INSERT OR IGNORE INTO color_flows (color_id, product_slug, step_id, status, updated_at) VALUES (?, ?, ?, ?, ?)');
    $order = 0;

    $pdo->beginTransaction();
    try {
        foreach ($flows as $flow) {
            foreach ($flow['colors'] as $color) {
                if (!is_array($color)) {
                    continue;
                }
                $id = mp_color_catalog_slug(isset($color['id']) ? $color['id'] : (isset($color['value']) ? $color['value'] : ''));
                $hex = strtolower(trim((string)(isset($color['swatch']) ? $color['swatch'] : '')));
                if ($id === '' || !preg_match('/^#[0-9a-f]{6}$/', $hex)) {
                    continue;
                }
                $name = trim((string)(isset($color['title']) ? $color['title'] : (isset($color['value']) ? $color['value'] : $id)));
                $stops = isset($color['colorStops']) && is_array($color['colorStops']) ? array_values($color['colorStops']) : array();
                $lightHex = isset($stops[0]) && preg_match('/^#[0-9a-f]{6}$/i', (string)$stops[0]) ? strtolower((string)$stops[0]) : $hex;
                $darkHex = isset($stops[2]) && preg_match('/^#[0-9a-f]{6}$/i', (string)$stops[2]) ? strtolower((string)$stops[2]) : $hex;
                $insertColor->execute(array($id, $name !== '' ? $name : $id, $hex, $lightHex, $darkHex, $order++, $now, $now));
                $insertFlow->execute(array($id, $flow['productSlug'], $flow['stepId'], 'available', $now));
            }
        }
        $pdo->commit();
    } catch (Exception $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function mp_color_catalog_data()
{
    mp_color_catalog_seed();
    $pdo = mp_db();
    $flows = mp_color_catalog_flows();
    $rows = $pdo->query('SELECT id, name, hex, light_hex, dark_hex, sort_order FROM colors ORDER BY sort_order ASC, name COLLATE NOCASE ASC')->fetchAll();
    $statuses = $pdo->query('SELECT color_id, product_slug, step_id, status FROM color_flows')->fetchAll();
    $statusMap = array();

    foreach ($statuses as $status) {
        $key = (string)$status['product_slug'] . ':' . (string)$status['step_id'];
        if (!isset($statusMap[$key])) {
            $statusMap[$key] = array();
        }
        $statusMap[$key][(string)$status['color_id']] = (string)$status['status'];
    }

    foreach ($flows as &$flow) {
        unset($flow['colors']);
    }
    unset($flow);

    return array(
        'colors' => $rows,
        'flows' => $flows,
        'statuses' => $statusMap,
    );
}

function mp_color_catalog_save($payload)
{
    $colors = isset($payload['colors']) && is_array($payload['colors']) ? $payload['colors'] : array();
    $knownFlows = mp_color_catalog_flows();
    $flowMap = array();
    $clean = array();
    $seen = array();

    if (count($colors) > 80) {
        throw new InvalidArgumentException('A grelha aceita no máximo 80 cores.');
    }
    foreach ($knownFlows as $flow) {
        $flowMap[$flow['key']] = $flow;
    }
    foreach ($colors as $index => $color) {
        if (!is_array($color)) {
            continue;
        }
        $id = mp_color_catalog_slug(isset($color['id']) ? $color['id'] : '');
        $name = trim((string)(isset($color['name']) ? $color['name'] : ''));
        $hex = strtolower(trim((string)(isset($color['hex']) ? $color['hex'] : '')));
        $lightHex = strtolower(trim((string)(isset($color['lightHex']) ? $color['lightHex'] : (isset($color['light_hex']) ? $color['light_hex'] : $hex))));
        $darkHex = strtolower(trim((string)(isset($color['darkHex']) ? $color['darkHex'] : (isset($color['dark_hex']) ? $color['dark_hex'] : $hex))));
        if ($id === '' || isset($seen[$id]) || $name === '' || !preg_match('/^#[0-9a-f]{6}$/', $hex)
            || !preg_match('/^#[0-9a-f]{6}$/', $lightHex) || !preg_match('/^#[0-9a-f]{6}$/', $darkHex)) {
            throw new InvalidArgumentException('Revê o nome e o código hexadecimal das cores.');
        }
        $seen[$id] = true;
        $clean[] = array(
            'id' => $id,
            'name' => function_exists('mb_substr') ? mb_substr($name, 0, 80, 'UTF-8') : substr($name, 0, 80),
            'hex' => $hex,
            'light_hex' => $lightHex,
            'dark_hex' => $darkHex,
            'sort_order' => $index,
            'statuses' => isset($color['statuses']) && is_array($color['statuses']) ? $color['statuses'] : array(),
        );
    }

    $pdo = mp_db();
    $now = mp_db_now();
    $upsert = $pdo->prepare('INSERT INTO colors (id, name, hex, light_hex, dark_hex, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, hex=excluded.hex, light_hex=excluded.light_hex, dark_hex=excluded.dark_hex, sort_order=excluded.sort_order, updated_at=excluded.updated_at');
    $insertStatus = $pdo->prepare('INSERT INTO color_flows (color_id, product_slug, step_id, status, updated_at) VALUES (?, ?, ?, ?, ?)');

    $pdo->beginTransaction();
    try {
        $pdo->exec('DELETE FROM color_flows');
        foreach ($clean as $color) {
            $upsert->execute(array($color['id'], $color['name'], $color['hex'], $color['light_hex'], $color['dark_hex'], $color['sort_order'], $now, $now));
            foreach ($flowMap as $key => $flow) {
                $status = isset($color['statuses'][$key]) ? (string)$color['statuses'][$key] : 'hidden';
                if (!in_array($status, array('available', 'unavailable', 'hidden'), true)) {
                    $status = 'hidden';
                }
                if ($status !== 'hidden') {
                    $insertStatus->execute(array($color['id'], $flow['productSlug'], $flow['stepId'], $status, $now));
                }
            }
        }
        if (empty($clean)) {
            $pdo->exec('DELETE FROM colors');
        } else {
            $placeholders = implode(',', array_fill(0, count($clean), '?'));
            $delete = $pdo->prepare('DELETE FROM colors WHERE id NOT IN (' . $placeholders . ')');
            $delete->execute(array_keys($seen));
        }
        $pdo->commit();
    } catch (Exception $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }

    return mp_color_catalog_data();
}
