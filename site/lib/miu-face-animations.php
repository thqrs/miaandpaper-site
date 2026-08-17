<?php
/**
 * Configuração das animações da cara do Míu.
 *
 * Esta biblioteca existe separada das animações de corpo inteiro para que a
 * página sprites.php possa editar as expressões da bolha sem misturar as duas
 * bibliotecas. O browser recebe a configuração através de bot-api.php.
 */

if (!defined('MIU_FACE_ANIMATIONS_CONFIG_PATH')) {
    define('MIU_FACE_ANIMATIONS_CONFIG_PATH', __DIR__ . '/../content/brand/miu/face-animations.json');
}
if (!defined('MIU_FACE_ANIMATIONS_DIR')) {
    define('MIU_FACE_ANIMATIONS_DIR', __DIR__ . '/../content/brand/miu');
}

function miu_face_animation_default_config()
{
    return array(
        'schemaVersion' => 1,
        'updatedAt' => gmdate('c'),
        'baseAnimationId' => 'miu-cara-calma',
        'animations' => array(
            array(
                'id' => 'miu-cara-calma',
                'name' => 'Míu — cara calma',
                'file' => 'miu-sprite.webp',
                'smallFile' => 'miu-sprite-small.webp',
                'columns' => 4,
                'rows' => 2,
                'sequence' => array(0, 0, 0, 1, 2, 3, 0, 0, 0, 7, 0, 0, 0),
                'frameDurationsMs' => array(1300, 1100, 900, 110, 100, 150, 1200, 950, 1200, 700, 1000, 900, 1200),
                'repeat' => 0,
                'enabled' => true,
                'triggers' => array(),
                'products' => array(),
                'probability' => 1,
                'weight' => 1,
                'cooldownMs' => 0,
                'flipX' => false,
                'staticFrame' => 0,
                'motion' => array('type' => 'none', 'distancePx' => 0),
                'transform' => array('xPx' => 0, 'yPx' => 0, 'rotationDeg' => 0),
                'contexts' => array('launcher', 'header', 'message'),
            ),
            array(
                'id' => 'miu-cara-sorriso',
                'name' => 'Míu — cara sorriso',
                'file' => 'miu-sprite.webp',
                'smallFile' => 'miu-sprite-small.webp',
                'columns' => 4,
                'rows' => 2,
                'sequence' => array(0, 6, 6, 0),
                'frameDurationsMs' => array(100, 320, 260, 180),
                'repeat' => 1,
                'enabled' => true,
                'triggers' => array('launcher_hover', 'launcher_open', 'message_sent', 'reply_end', 'conversation_reset'),
                'products' => array(),
                'probability' => 1,
                'weight' => 3,
                'cooldownMs' => 650,
                'flipX' => false,
                'staticFrame' => 6,
                'motion' => array('type' => 'none', 'distancePx' => 0),
                'transform' => array('xPx' => 0, 'yPx' => 0, 'rotationDeg' => 0),
                'contexts' => array('launcher'),
            ),
            array(
                'id' => 'miu-cara-inclina',
                'name' => 'Míu — cara inclina',
                'file' => 'miu-sprite.webp',
                'smallFile' => 'miu-sprite-small.webp',
                'columns' => 4,
                'rows' => 2,
                'sequence' => array(0, 4, 4, 0, 5, 5, 0),
                'frameDurationsMs' => array(100, 420, 250, 160, 420, 250, 180),
                'repeat' => 1,
                'enabled' => true,
                'triggers' => array('idle_random'),
                'products' => array(),
                'probability' => 0.58,
                'weight' => 2,
                'cooldownMs' => 7000,
                'flipX' => false,
                'staticFrame' => 4,
                'motion' => array('type' => 'none', 'distancePx' => 0),
                'transform' => array('xPx' => 0, 'yPx' => 0, 'rotationDeg' => 0),
                'contexts' => array('launcher'),
            ),
            array(
                'id' => 'miu-cara-orelha',
                'name' => 'Míu — cara orelha',
                'file' => 'miu-sprite.webp',
                'smallFile' => 'miu-sprite-small.webp',
                'columns' => 4,
                'rows' => 2,
                'sequence' => array(0, 7, 7, 0),
                'frameDurationsMs' => array(120, 380, 320, 180),
                'repeat' => 1,
                'enabled' => true,
                'triggers' => array('idle_random', 'launcher_close'),
                'products' => array(),
                'probability' => 0.5,
                'weight' => 1,
                'cooldownMs' => 9000,
                'flipX' => false,
                'staticFrame' => 7,
                'motion' => array('type' => 'none', 'distancePx' => 0),
                'transform' => array('xPx' => 0, 'yPx' => 0, 'rotationDeg' => 0),
                'contexts' => array('launcher'),
            ),
            array(
                'id' => 'miu-cara-dormir',
                'name' => 'Míu — cara a dormir',
                'file' => 'miu-sprite-sleep.webp',
                'smallFile' => '',
                'columns' => 4,
                'rows' => 1,
                'sequence' => array(0, 1, 2, 3, 2, 3),
                'frameDurationsMs' => array(650, 700, 650, 1100, 650, 1100),
                'repeat' => 0,
                'enabled' => true,
                'triggers' => array('inactivity'),
                'products' => array(),
                'probability' => 1,
                'weight' => 1,
                'cooldownMs' => 0,
                'flipX' => false,
                'staticFrame' => 3,
                'motion' => array('type' => 'none', 'distancePx' => 0),
                'transform' => array('xPx' => 0, 'yPx' => 0, 'rotationDeg' => 0),
                'contexts' => array('launcher'),
            ),
        ),
    );
}

function miu_face_animation_clean_file($file)
{
    $file = str_replace('\\', '/', trim((string)$file));
    if ($file === '') {
        return '';
    }
    if (strpos($file, '..') !== false || $file[0] === '/' || !preg_match('/^[a-z0-9_\/-]+\.(?:webp|png)$/i', $file)) {
        return '';
    }
    return $file;
}

function miu_face_animation_context_options()
{
    return array(
        'launcher' => 'Míu principal / bolha',
        'header' => 'Barra superior do chat',
        'message' => 'Avatar junto às respostas',
    );
}

function miu_face_animation_sanitize_item($item)
{
    if (!is_array($item)) {
        return null;
    }
    $columns = miu_animation_int(isset($item['columns']) ? $item['columns'] : 1, 1, 16, 1);
    $rows = miu_animation_int(isset($item['rows']) ? $item['rows'] : 1, 1, 16, 1);
    $frameCount = $columns * $rows;
    $id = miu_animation_slug(isset($item['id']) ? $item['id'] : 'miu-cara');
    $file = miu_face_animation_clean_file(isset($item['file']) ? $item['file'] : '');
    if ($file === '') {
        return null;
    }
    $smallFile = miu_face_animation_clean_file(isset($item['smallFile']) ? $item['smallFile'] : '');
    $sequence = miu_animation_clean_sequence(isset($item['sequence']) ? $item['sequence'] : array(), $frameCount);
    $fallbackMs = miu_animation_int(isset($item['frameMs']) ? $item['frameMs'] : 180, 40, 10000, 180);
    $durations = miu_animation_clean_durations(isset($item['frameDurationsMs']) ? $item['frameDurationsMs'] : array(), count($sequence), $fallbackMs);

    $triggerOptions = miu_animation_trigger_options();
    $triggers = array();
    foreach (isset($item['triggers']) && is_array($item['triggers']) ? $item['triggers'] : array() as $trigger) {
        $trigger = (string)$trigger;
        if (isset($triggerOptions[$trigger]) && !in_array($trigger, $triggers, true)) {
            $triggers[] = $trigger;
        }
    }

    $contextOptions = miu_face_animation_context_options();
    $contexts = array();
    foreach (isset($item['contexts']) && is_array($item['contexts']) ? $item['contexts'] : array('launcher') as $context) {
        $context = (string)$context;
        if (isset($contextOptions[$context]) && !in_array($context, $contexts, true)) {
            $contexts[] = $context;
        }
    }
    if (!$contexts) {
        $contexts[] = 'launcher';
    }

    $transform = isset($item['transform']) && is_array($item['transform']) ? $item['transform'] : array();

    return array(
        'id' => $id,
        'name' => substr(trim((string)(isset($item['name']) ? $item['name'] : $id)), 0, 80),
        'file' => $file,
        'smallFile' => $smallFile,
        'columns' => $columns,
        'rows' => $rows,
        'sequence' => $sequence,
        'frameDurationsMs' => $durations,
        'repeat' => miu_animation_int(isset($item['repeat']) ? $item['repeat'] : 1, 0, 20, 1),
        'enabled' => !isset($item['enabled']) || (bool)$item['enabled'],
        'triggers' => $triggers,
        'products' => miu_animation_clean_products(isset($item['products']) ? $item['products'] : array()),
        'probability' => miu_animation_float(isset($item['probability']) ? $item['probability'] : 1, 0, 1, 1),
        'weight' => miu_animation_int(isset($item['weight']) ? $item['weight'] : 1, 1, 100, 1),
        'cooldownMs' => miu_animation_int(isset($item['cooldownMs']) ? $item['cooldownMs'] : 0, 0, 3600000, 0),
        'flipX' => !empty($item['flipX']),
        'staticFrame' => miu_animation_int(isset($item['staticFrame']) ? $item['staticFrame'] : 0, 0, max(0, $frameCount - 1), 0),
        'motion' => array('type' => 'none', 'distancePx' => 0),
        'transform' => array(
            'xPx' => miu_animation_int(isset($transform['xPx']) ? $transform['xPx'] : 0, -600, 600, 0),
            'yPx' => miu_animation_int(isset($transform['yPx']) ? $transform['yPx'] : 0, -600, 600, 0),
            'rotationDeg' => miu_animation_float(isset($transform['rotationDeg']) ? $transform['rotationDeg'] : 0, -360, 360, 0),
        ),
        'contexts' => $contexts,
    );
}

function miu_face_animation_config_from_array($raw)
{
    $raw = is_array($raw) ? $raw : array();
    $animations = array();
    $ids = array();
    foreach (isset($raw['animations']) && is_array($raw['animations']) ? $raw['animations'] : array() as $item) {
        $clean = miu_face_animation_sanitize_item($item);
        if (!$clean || isset($ids[$clean['id']])) {
            continue;
        }
        $ids[$clean['id']] = true;
        $animations[] = $clean;
    }
    if (!$animations) {
        $fallback = miu_face_animation_default_config();
        $animations = $fallback['animations'];
        foreach ($animations as $item) {
            $ids[$item['id']] = true;
        }
    }
    $baseId = miu_animation_slug(isset($raw['baseAnimationId']) ? $raw['baseAnimationId'] : 'miu-cara-calma');
    if (!isset($ids[$baseId])) {
        $baseId = $animations[0]['id'];
    }
    return array(
        'schemaVersion' => 1,
        'updatedAt' => isset($raw['updatedAt']) ? (string)$raw['updatedAt'] : '',
        'baseAnimationId' => $baseId,
        'animations' => $animations,
    );
}

function miu_face_animation_config()
{
    if (!is_file(MIU_FACE_ANIMATIONS_CONFIG_PATH)) {
        return miu_face_animation_default_config();
    }
    $raw = @file_get_contents(MIU_FACE_ANIMATIONS_CONFIG_PATH);
    $decoded = is_string($raw) ? json_decode($raw, true) : null;
    return miu_face_animation_config_from_array($decoded);
}

function miu_face_animation_write_config($config)
{
    $clean = miu_face_animation_config_from_array($config);
    $clean['updatedAt'] = gmdate('c');
    $dir = dirname(MIU_FACE_ANIMATIONS_CONFIG_PATH);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('Não foi possível criar a pasta da configuração da cara do Míu.');
    }
    $json = json_encode($clean, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json) || @file_put_contents(MIU_FACE_ANIMATIONS_CONFIG_PATH, $json . "\n", LOCK_EX) === false) {
        throw new RuntimeException('Não foi possível guardar as animações da cara do Míu.');
    }
    return $clean;
}

function miu_face_animation_public_config()
{
    $config = miu_face_animation_config();
    $version = is_file(MIU_FACE_ANIMATIONS_CONFIG_PATH) ? (string)@filemtime(MIU_FACE_ANIMATIONS_CONFIG_PATH) : '1';
    foreach ($config['animations'] as &$animation) {
        $animation['sheetUrl'] = 'content/brand/miu/' . $animation['file'] . '?v=' . rawurlencode($version);
        $animation['smallSheetUrl'] = $animation['smallFile'] !== ''
            ? 'content/brand/miu/' . $animation['smallFile'] . '?v=' . rawurlencode($version)
            : '';
    }
    unset($animation);
    return $config;
}
