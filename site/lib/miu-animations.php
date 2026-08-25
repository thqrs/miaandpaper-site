<?php
/**
 * Configuração e uploads das animações do Míu.
 *
 * As spritesheets são imagens públicas (WebP ou PNG) em content/brand/miu/.
 * O browser recorta os frames em runtime; não há build Python nem frames individuais obrigatórios.
 */

if (!defined('MIU_ANIMATIONS_CONFIG_PATH')) {
    define('MIU_ANIMATIONS_CONFIG_PATH', __DIR__ . '/../content/brand/miu/animations.json');
}
if (!defined('MIU_ANIMATIONS_DIR')) {
    define('MIU_ANIMATIONS_DIR', __DIR__ . '/../content/brand/miu');
}
if (!defined('MIU_ANIMATIONS_UPLOAD_DIR')) {
    define('MIU_ANIMATIONS_UPLOAD_DIR', MIU_ANIMATIONS_DIR . '/sprites');
}
if (!defined('MIU_ANIMATIONS_MAX_BYTES')) {
    define('MIU_ANIMATIONS_MAX_BYTES', 8 * 1024 * 1024);
}

function miu_animation_trigger_options()
{
    return array(
        'page_load' => 'Ao carregar a página',
        'product_enter' => 'Ao entrar num produto',
        'launcher_hover' => 'Ao passar o rato pelo Míu',
        'launcher_open' => 'Ao abrir a conversa',
        'launcher_close' => 'Ao fechar a conversa',
        'step_change' => 'Ao mudar de passo no produto',
        'message_sent' => 'Ao enviar uma pergunta',
        'reply_start' => 'Enquanto começa a responder',
        'reply_end' => 'Quando termina uma resposta',
        'quick_reply' => 'Ao usar uma resposta rápida',
        'conversation_reset' => 'Ao começar uma conversa nova',
        'idle_random' => 'Aleatoriamente quando está parado',
        'inactivity' => 'Depois de algum tempo sem interacção',
    );
}

function miu_animation_motion_options()
{
    return array(
        'none' => 'Sem deslocação',
        'left' => 'Andar para a esquerda',
        'right' => 'Andar para a direita',
        'jump' => 'Saltar',
    );
}

function miu_animation_slug($value)
{
    $value = trim((string)$value);
    if (function_exists('iconv')) {
        $converted = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        if (is_string($converted) && $converted !== '') {
            $value = $converted;
        }
    }
    $value = strtolower($value);
    $value = preg_replace('/[^a-z0-9]+/', '-', $value);
    $value = trim((string)$value, '-');
    return substr($value !== '' ? $value : 'animacao', 0, 64);
}

function miu_animation_int($value, $min, $max, $fallback)
{
    $parsed = filter_var($value, FILTER_VALIDATE_INT);
    if ($parsed === false) {
        return (int)$fallback;
    }
    return max((int)$min, min((int)$max, (int)$parsed));
}

function miu_animation_float($value, $min, $max, $fallback)
{
    if (!is_numeric($value)) {
        return (float)$fallback;
    }
    return max((float)$min, min((float)$max, (float)$value));
}

function miu_animation_bool($value, $fallback)
{
    if (is_bool($value)) {
        return $value;
    }
    if (is_int($value) || is_float($value)) {
        return (bool)$value;
    }
    $text = strtolower(trim((string)$value));
    if (in_array($text, array('1', 'true', 'yes', 'sim', 'on'), true)) {
        return true;
    }
    if (in_array($text, array('0', 'false', 'no', 'nao', 'não', 'off', ''), true)) {
        return false;
    }
    return (bool)$fallback;
}

function miu_animation_clean_products($value)
{
    $parts = is_array($value) ? $value : preg_split('/[\s,;]+/', trim((string)$value));
    $clean = array();
    foreach ((array)$parts as $part) {
        $part = strtolower(trim((string)$part));
        if ($part === '*') {
            $clean['*'] = '*';
            continue;
        }
        $slug = preg_replace('/[^a-z0-9_-]+/', '', $part);
        if ($slug !== '') {
            $clean[$slug] = $slug;
        }
    }
    return array_values($clean);
}

function miu_animation_normalize_display($display)
{
    $display = is_array($display) ? $display : array();
    $legacySmall = miu_animation_int(isset($display['smallPx']) ? $display['smallPx'] : 26, 18, 64, 26);
    $minRandom = miu_animation_int(isset($display['idleRandomMinMs']) ? $display['idleRandomMinMs'] : 14000, 3000, 300000, 14000);
    $maxRandom = miu_animation_int(isset($display['idleRandomMaxMs']) ? $display['idleRandomMaxMs'] : 28000, 3000, 600000, 28000);
    if ($maxRandom < $minRandom) {
        $maxRandom = $minRandom;
    }
    $launcherPx = miu_animation_int(isset($display['launcherPx']) ? $display['launcherPx'] : 46, 24, 120, 46);
    $headerPx = miu_animation_int(isset($display['headerPx']) ? $display['headerPx'] : $legacySmall, 16, 120, $legacySmall);
    // V6 guardava por engano o modo circle/basket na barra do chat.
    // Se launcherMode ainda não existir, aproveitamos headerMode=basket como migração
    // suave para o Míu principal, que era o destino pretendido dessa opção.
    $legacyHeaderModeRaw = strtolower(trim((string)(isset($display['headerMode']) ? $display['headerMode'] : 'circle')));
    $launcherModeRaw = strtolower(trim((string)(isset($display['launcherMode']) ? $display['launcherMode'] : ($legacyHeaderModeRaw === 'basket' ? 'basket' : 'circle'))));
    $launcherMode = $launcherModeRaw === 'basket' ? 'basket' : 'circle';
    $messagePx = miu_animation_int(isset($display['messagePx']) ? $display['messagePx'] : $legacySmall, 16, 80, $legacySmall);
    $interactivePx = miu_animation_int(isset($display['interactivePx']) ? $display['interactivePx'] : 96, 48, 240, 96);
    return array(
        // Os nomes sem sufixo continuam a representar desktop para manter
        // compatibilidade com configurações já guardadas.
        'launcherPx' => $launcherPx,
        'launcherPxMobile' => miu_animation_int(isset($display['launcherPxMobile']) ? $display['launcherPxMobile'] : $launcherPx, 24, 120, $launcherPx),
        'headerPx' => $headerPx,
        'headerPxMobile' => miu_animation_int(isset($display['headerPxMobile']) ? $display['headerPxMobile'] : $headerPx, 16, 120, $headerPx),
        'headerVisible' => miu_animation_bool(isset($display['headerVisible']) ? $display['headerVisible'] : true, true),
        'launcherMode' => $launcherMode,
        'messagePx' => $messagePx,
        'messagePxMobile' => miu_animation_int(isset($display['messagePxMobile']) ? $display['messagePxMobile'] : $messagePx, 16, 80, $messagePx),
        'interactivePx' => $interactivePx,
        'interactivePxMobile' => miu_animation_int(isset($display['interactivePxMobile']) ? $display['interactivePxMobile'] : $interactivePx, 48, 240, $interactivePx),
        // Campo legado: continua coerente para leitores antigos. No modo alcofinha
        // o launcher não usa o balão/círculo da cara.
        'launcherCircle' => $launcherMode === 'circle',
        'headerCircle' => miu_animation_bool(isset($display['headerCircle']) ? $display['headerCircle'] : true, true),
        'messageCircle' => miu_animation_bool(isset($display['messageCircle']) ? $display['messageCircle'] : true, true),
        'promptSeconds' => miu_animation_int(isset($display['promptSeconds']) ? $display['promptSeconds'] : 5, 0, 60, 5),
        'errorsViaMiu' => miu_animation_bool(isset($display['errorsViaMiu']) ? $display['errorsViaMiu'] : true, true),
        // Compatibilidade temporária com código/configuração antigos.
        'smallPx' => $legacySmall,
        'sleepAfterMs' => miu_animation_int(isset($display['sleepAfterMs']) ? $display['sleepAfterMs'] : 45000, 5000, 600000, 45000),
        'idleRandomMinMs' => $minRandom,
        'idleRandomMaxMs' => $maxRandom,
        'maxRoamPx' => miu_animation_int(isset($display['maxRoamPx']) ? $display['maxRoamPx'] : 180, 0, 800, 180),
    );
}

function miu_animation_default_config()
{
    return array(
        'schemaVersion' => 2,
        'updatedAt' => gmdate('c'),
        'baseAnimationId' => 'lili-calma',
        'display' => array(
            'launcherPx' => 46,
            'launcherPxMobile' => 46,
            'headerPx' => 26,
            'headerPxMobile' => 26,
            'headerVisible' => true,
            'launcherMode' => 'circle',
            'messagePx' => 26,
            'messagePxMobile' => 26,
            'interactivePx' => 96,
            'interactivePxMobile' => 96,
            'launcherCircle' => true,
            'headerCircle' => true,
            'messageCircle' => true,
            'promptSeconds' => 5,
            'errorsViaMiu' => true,
            'smallPx' => 26,
            'sleepAfterMs' => 45000,
            'idleRandomMinMs' => 14000,
            'idleRandomMaxMs' => 28000,
            'maxRoamPx' => 180,
        ),
        'animations' => array(
            array(
                'id' => 'lili-calma',
                'name' => 'Lili — calma / piscar',
                'file' => 'sprites/lili-idle.webp',
                'columns' => 4,
                'rows' => 2,
                'sequence' => array(0, 0, 0, 1, 2, 3, 0, 4, 5, 6, 0, 7),
                'frameDurationsMs' => array(1300, 1100, 900, 110, 110, 220, 700, 520, 520, 480, 900, 650),
                'repeat' => 0,
                'enabled' => true,
                'triggers' => array(),
                'probability' => 1,
                'weight' => 1,
                'cooldownMs' => 0,
                'flipX' => false,
                'staticFrame' => 0,
                'motion' => array('type' => 'none', 'distancePx' => 0),
                'transform' => array('xPx' => 0, 'yPx' => 0, 'rotationDeg' => 0),
            ),
            array(
                'id' => 'lili-dormir',
                'name' => 'Lili — adormecer',
                'file' => 'sprites/lili-sleep.webp',
                'columns' => 4,
                'rows' => 2,
                'sequence' => array(0, 1, 2, 3, 4, 5, 6, 7, 6, 7),
                'frameDurationsMs' => array(500, 450, 650, 700, 700, 900, 1200, 1500, 1300, 1500),
                'repeat' => 0,
                'enabled' => true,
                'triggers' => array('inactivity'),
                'probability' => 1,
                'weight' => 1,
                'cooldownMs' => 0,
                'flipX' => false,
                'staticFrame' => 7,
                'motion' => array('type' => 'none', 'distancePx' => 0),
                'transform' => array('xPx' => 0, 'yPx' => 0, 'rotationDeg' => 0),
            ),
            array(
                'id' => 'lili-andar-esquerda',
                'name' => 'Lili — andar para a esquerda',
                'file' => 'sprites/lili-walk.webp',
                'columns' => 4,
                'rows' => 2,
                'sequence' => array(0, 1, 2, 3, 4, 5, 6, 7),
                'frameDurationsMs' => array(130, 130, 130, 130, 130, 130, 130, 130),
                'repeat' => 2,
                'enabled' => true,
                'triggers' => array('idle_random'),
                'probability' => 0.72,
                'weight' => 3,
                'cooldownMs' => 7000,
                'flipX' => true,
                'staticFrame' => 0,
                'motion' => array('type' => 'left', 'distancePx' => 72),
                'transform' => array('xPx' => 0, 'yPx' => 0, 'rotationDeg' => 0),
            ),
            array(
                'id' => 'lili-andar-direita',
                'name' => 'Lili — andar para a direita',
                'file' => 'sprites/lili-walk.webp',
                'columns' => 4,
                'rows' => 2,
                'sequence' => array(0, 1, 2, 3, 4, 5, 6, 7),
                'frameDurationsMs' => array(130, 130, 130, 130, 130, 130, 130, 130),
                'repeat' => 2,
                'enabled' => true,
                'triggers' => array('idle_random'),
                'probability' => 0.72,
                'weight' => 3,
                'cooldownMs' => 7000,
                'flipX' => false,
                'staticFrame' => 0,
                'motion' => array('type' => 'right', 'distancePx' => 72),
                'transform' => array('xPx' => 0, 'yPx' => 0, 'rotationDeg' => 0),
            ),
            array(
                'id' => 'lili-saltar',
                'name' => 'Lili — saltar',
                'file' => 'sprites/lili-jump.webp',
                'columns' => 4,
                'rows' => 2,
                'sequence' => array(1, 2, 3, 4, 5, 6, 7, 0),
                'frameDurationsMs' => array(180, 150, 120, 120, 130, 150, 180, 300),
                'repeat' => 1,
                'enabled' => true,
                'triggers' => array('launcher_hover', 'message_sent', 'idle_random', 'product_enter'),
                'products' => array('*'),
                'probability' => 0.38,
                'weight' => 2,
                'cooldownMs' => 9000,
                'flipX' => false,
                'staticFrame' => 0,
                'motion' => array('type' => 'jump', 'distancePx' => 34),
                'transform' => array('xPx' => 0, 'yPx' => 0, 'rotationDeg' => 0),
            ),
            array(
                'id' => 'lili-atirar',
                'name' => 'Lili — atirar coisas ao chão',
                'file' => 'sprites/lili-knock.webp',
                'columns' => 4,
                'rows' => 2,
                'sequence' => array(0, 1, 2, 3, 4, 5, 6, 7),
                'frameDurationsMs' => array(300, 220, 220, 240, 220, 220, 350, 550),
                'repeat' => 1,
                'enabled' => true,
                'triggers' => array('idle_random', 'reply_end'),
                'probability' => 0.28,
                'weight' => 1,
                'cooldownMs' => 18000,
                'flipX' => false,
                'staticFrame' => 7,
                'motion' => array('type' => 'none', 'distancePx' => 0),
                'transform' => array('xPx' => 0, 'yPx' => 0, 'rotationDeg' => 0),
            ),
        ),
    );
}

function miu_animation_read_json()
{
    if (!is_file(MIU_ANIMATIONS_CONFIG_PATH)) {
        return miu_animation_default_config();
    }
    $raw = @file_get_contents(MIU_ANIMATIONS_CONFIG_PATH);
    $decoded = is_string($raw) ? json_decode($raw, true) : null;
    return is_array($decoded) ? $decoded : miu_animation_default_config();
}

function miu_animation_clean_file($file)
{
    $file = str_replace('\\', '/', trim((string)$file));
    if ($file === '' || strpos($file, '..') !== false || $file[0] === '/' || !preg_match('/^[a-z0-9_\/-]+\.(?:webp|png)$/i', $file)) {
        return '';
    }
    return $file;
}

function miu_animation_clean_sequence($value, $frameCount)
{
    $parts = is_array($value) ? $value : preg_split('/[\s,;]+/', trim((string)$value));
    $sequence = array();
    foreach ((array)$parts as $part) {
        if ($part === '' || !is_numeric($part)) {
            continue;
        }
        $index = (int)$part;
        if ($index >= 0 && $index < $frameCount) {
            $sequence[] = $index;
        }
        if (count($sequence) >= 128) {
            break;
        }
    }
    if (!$sequence) {
        for ($i = 0; $i < $frameCount; $i += 1) {
            $sequence[] = $i;
        }
    }
    return $sequence;
}

function miu_animation_clean_durations($value, $sequenceCount, $fallbackMs)
{
    $parts = is_array($value) ? $value : preg_split('/[\s,;]+/', trim((string)$value));
    $durations = array();
    foreach ((array)$parts as $part) {
        if ($part === '' || !is_numeric($part)) {
            continue;
        }
        $durations[] = miu_animation_int($part, 40, 10000, $fallbackMs);
        if (count($durations) >= 128) {
            break;
        }
    }
    if (count($durations) !== (int)$sequenceCount) {
        $durations = array_fill(0, max(1, (int)$sequenceCount), miu_animation_int($fallbackMs, 40, 10000, 180));
    }
    return $durations;
}

function miu_animation_sanitize_item($item)
{
    if (!is_array($item)) {
        return null;
    }
    $columns = miu_animation_int(isset($item['columns']) ? $item['columns'] : 1, 1, 16, 1);
    $rows = miu_animation_int(isset($item['rows']) ? $item['rows'] : 1, 1, 16, 1);
    $frameCount = $columns * $rows;
    $id = miu_animation_slug(isset($item['id']) ? $item['id'] : 'animacao');
    $file = miu_animation_clean_file(isset($item['file']) ? $item['file'] : '');
    if ($file === '') {
        return null;
    }
    $sequence = miu_animation_clean_sequence(isset($item['sequence']) ? $item['sequence'] : array(), $frameCount);
    $fallbackMs = miu_animation_int(isset($item['frameMs']) ? $item['frameMs'] : 180, 40, 10000, 180);
    $durations = miu_animation_clean_durations(isset($item['frameDurationsMs']) ? $item['frameDurationsMs'] : array(), count($sequence), $fallbackMs);
    $allowedTriggers = miu_animation_trigger_options();
    $triggers = array();
    foreach (isset($item['triggers']) && is_array($item['triggers']) ? $item['triggers'] : array() as $trigger) {
        $trigger = (string)$trigger;
        if (isset($allowedTriggers[$trigger]) && !in_array($trigger, $triggers, true)) {
            $triggers[] = $trigger;
        }
    }
    $products = miu_animation_clean_products(isset($item['products']) ? $item['products'] : array());
    $motionOptions = miu_animation_motion_options();
    $motion = isset($item['motion']) && is_array($item['motion']) ? $item['motion'] : array();
    $motionType = isset($motion['type']) && isset($motionOptions[$motion['type']]) ? (string)$motion['type'] : 'none';
    $transform = isset($item['transform']) && is_array($item['transform']) ? $item['transform'] : array();

    $res = array(
        'id' => $id,
        'name' => substr(trim((string)(isset($item['name']) ? $item['name'] : $id)), 0, 80),
        'file' => $file,
        'columns' => $columns,
        'rows' => $rows,
        'sequence' => $sequence,
        'frameDurationsMs' => $durations,
        'repeat' => miu_animation_int(isset($item['repeat']) ? $item['repeat'] : 1, 0, 20, 1),
        'enabled' => !isset($item['enabled']) || (bool)$item['enabled'],
        'triggers' => $triggers,
        'products' => $products,
        'probability' => miu_animation_float(isset($item['probability']) ? $item['probability'] : 1, 0, 1, 1),
        'weight' => miu_animation_int(isset($item['weight']) ? $item['weight'] : 1, 1, 100, 1),
        'cooldownMs' => miu_animation_int(isset($item['cooldownMs']) ? $item['cooldownMs'] : 0, 0, 3600000, 0),
        'flipX' => !empty($item['flipX']),
        'staticFrame' => miu_animation_int(isset($item['staticFrame']) ? $item['staticFrame'] : 0, 0, max(0, $frameCount - 1), 0),
        'motion' => array(
            'type' => $motionType,
            'distancePx' => miu_animation_int(isset($motion['distancePx']) ? $motion['distancePx'] : 0, 0, 600, 0),
        ),
        'transform' => array(
            'xPx' => miu_animation_int(isset($transform['xPx']) ? $transform['xPx'] : 0, -600, 600, 0),
            'yPx' => miu_animation_int(isset($transform['yPx']) ? $transform['yPx'] : 0, -600, 600, 0),
            'rotationDeg' => miu_animation_float(isset($transform['rotationDeg']) ? $transform['rotationDeg'] : 0, -360, 360, 0),
        ),
    );

    if (isset($item['frameWidth']) && is_numeric($item['frameWidth']) && (int)$item['frameWidth'] > 0) {
        $res['frameWidth'] = (int)$item['frameWidth'];
    }
    if (isset($item['frameHeight']) && is_numeric($item['frameHeight']) && (int)$item['frameHeight'] > 0) {
        $res['frameHeight'] = (int)$item['frameHeight'];
    }
    if (isset($item['sheetWidth']) && is_numeric($item['sheetWidth']) && (int)$item['sheetWidth'] > 0) {
        $res['sheetWidth'] = (int)$item['sheetWidth'];
    }
    if (isset($item['sheetHeight']) && is_numeric($item['sheetHeight']) && (int)$item['sheetHeight'] > 0) {
        $res['sheetHeight'] = (int)$item['sheetHeight'];
    }
    if (isset($item['aspectRatio']) && is_numeric($item['aspectRatio']) && (float)$item['aspectRatio'] > 0) {
        $res['aspectRatio'] = round((float)$item['aspectRatio'], 4);
    } elseif (!empty($res['frameWidth']) && !empty($res['frameHeight'])) {
        $res['aspectRatio'] = round($res['frameWidth'] / $res['frameHeight'], 4);
    }

    return $res;
}

function miu_animation_config()
{
    $raw = miu_animation_read_json();
    $display = isset($raw['display']) && is_array($raw['display']) ? $raw['display'] : array();
    $animations = array();
    $ids = array();
    foreach (isset($raw['animations']) && is_array($raw['animations']) ? $raw['animations'] : array() as $item) {
        $clean = miu_animation_sanitize_item($item);
        if (!$clean || isset($ids[$clean['id']])) {
            continue;
        }
        $ids[$clean['id']] = true;
        $animations[] = $clean;
    }
    if (!$animations) {
        $fallback = miu_animation_default_config();
        $animations = $fallback['animations'];
        $ids = array();
        foreach ($animations as $fallbackAnimation) { $ids[$fallbackAnimation['id']] = true; }
    }
    $baseId = miu_animation_slug(isset($raw['baseAnimationId']) ? $raw['baseAnimationId'] : 'lili-calma');
    if (!isset($ids[$baseId])) {
        $baseId = $animations[0]['id'];
    }
    $minRandom = miu_animation_int(isset($display['idleRandomMinMs']) ? $display['idleRandomMinMs'] : 14000, 3000, 300000, 14000);
    $maxRandom = miu_animation_int(isset($display['idleRandomMaxMs']) ? $display['idleRandomMaxMs'] : 28000, 3000, 600000, 28000);
    if ($maxRandom < $minRandom) {
        $maxRandom = $minRandom;
    }
    return array(
        'schemaVersion' => 2,
        'updatedAt' => isset($raw['updatedAt']) ? (string)$raw['updatedAt'] : '',
        'baseAnimationId' => $baseId,
        'display' => miu_animation_normalize_display($display),
        'animations' => $animations,
    );
}

function miu_animation_write_config($config)
{
    $clean = miu_animation_config_from_array($config);
    $clean['updatedAt'] = gmdate('c');
    $dir = dirname(MIU_ANIMATIONS_CONFIG_PATH);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('Não foi possível criar a pasta de configuração das animações.');
    }
    $json = json_encode($clean, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) {
        throw new RuntimeException('Não foi possível serializar a configuração das animações.');
    }
    if (@file_put_contents(MIU_ANIMATIONS_CONFIG_PATH, $json . "\n", LOCK_EX) === false) {
        throw new RuntimeException('Não foi possível guardar a configuração das animações.');
    }
    return $clean;
}

function miu_animation_config_from_array($raw)
{
    if (!is_array($raw)) {
        $raw = array();
    }
    $display = isset($raw['display']) && is_array($raw['display']) ? $raw['display'] : array();
    $animations = array();
    $ids = array();
    foreach (isset($raw['animations']) && is_array($raw['animations']) ? $raw['animations'] : array() as $item) {
        $clean = miu_animation_sanitize_item($item);
        if (!$clean || isset($ids[$clean['id']])) {
            continue;
        }
        $ids[$clean['id']] = true;
        $animations[] = $clean;
    }
    if (!$animations) {
        $animations = miu_animation_default_config()['animations'];
        foreach ($animations as $item) {
            $ids[$item['id']] = true;
        }
    }
    $baseId = miu_animation_slug(isset($raw['baseAnimationId']) ? $raw['baseAnimationId'] : '');
    if (!isset($ids[$baseId])) {
        $baseId = $animations[0]['id'];
    }
    $minRandom = miu_animation_int(isset($display['idleRandomMinMs']) ? $display['idleRandomMinMs'] : 14000, 3000, 300000, 14000);
    $maxRandom = miu_animation_int(isset($display['idleRandomMaxMs']) ? $display['idleRandomMaxMs'] : 28000, 3000, 600000, 28000);
    if ($maxRandom < $minRandom) {
        $maxRandom = $minRandom;
    }
    return array(
        'schemaVersion' => 2,
        'updatedAt' => isset($raw['updatedAt']) ? (string)$raw['updatedAt'] : '',
        'baseAnimationId' => $baseId,
        'display' => miu_animation_normalize_display($display),
        'animations' => $animations,
    );
}

function miu_animation_public_config()
{
    $config = miu_animation_config();
    $version = is_file(MIU_ANIMATIONS_CONFIG_PATH) ? (string)@filemtime(MIU_ANIMATIONS_CONFIG_PATH) : '1';
    foreach ($config['animations'] as &$animation) {
        $animation['sheetUrl'] = 'content/brand/miu/' . $animation['file'] . '?v=' . rawurlencode($version);
    }
    unset($animation);
    // A configuração pública transporta também a biblioteca da cara. Mantemos
    // as animações de corpo inteiro no campo histórico `animations` para não
    // quebrar leitores antigos.
    if (function_exists('miu_face_animation_public_config')) {
        $config['faceAnimations'] = miu_face_animation_public_config();
    }
    return $config;
}

function miu_animation_find_index($config, $id)
{
    $id = miu_animation_slug($id);
    foreach ($config['animations'] as $index => $animation) {
        if ($animation['id'] === $id) {
            return $index;
        }
    }
    return -1;
}

function miu_animation_validate_sheet($path, $columns, $rows)
{
    if (!is_file($path) || filesize($path) <= 0) {
        throw new RuntimeException('A spritesheet recebida está vazia.');
    }
    if (filesize($path) > MIU_ANIMATIONS_MAX_BYTES) {
        throw new RuntimeException('A spritesheet é demasiado grande. O limite é 8 MB.');
    }
    $info = @getimagesize($path);
    $allowedTypes = array(IMAGETYPE_WEBP, IMAGETYPE_PNG);
    if (!$info || !isset($info[0], $info[1], $info[2]) || !in_array((int)$info[2], $allowedTypes, true)) {
        throw new RuntimeException('A spritesheet tem de ser uma imagem WebP ou PNG válida.');
    }
    $width = (int)$info[0];
    $height = (int)$info[1];
    if ($width < $columns || $height < $rows || $width > 8192 || $height > 8192) {
        throw new RuntimeException('As dimensões da spritesheet não são válidas.');
    }
    $frameWidth = $width / max(1, $columns);
    $frameHeight = $height / max(1, $rows);
    if (abs($frameWidth - $frameHeight) > 1.5) {
        throw new RuntimeException('Cada célula da grelha deve ser aproximadamente quadrada para o Míu não ficar deformado.');
    }
    return array(
        'width' => $width,
        'height' => $height,
        'frameWidth' => round($frameWidth, 1),
        'frameHeight' => round($frameHeight, 1),
        'type' => (int)$info[2],
    );
}

function miu_animation_store_upload($file, $id, $columns, $rows)
{
    if (!is_array($file) || !isset($file['error']) || (int)$file['error'] !== UPLOAD_ERR_OK || empty($file['tmp_name'])) {
        throw new RuntimeException('Escolhe uma spritesheet WebP ou PNG para carregar.');
    }
    $info = miu_animation_validate_sheet($file['tmp_name'], $columns, $rows);
    if (!is_dir(MIU_ANIMATIONS_UPLOAD_DIR) && !@mkdir(MIU_ANIMATIONS_UPLOAD_DIR, 0775, true) && !is_dir(MIU_ANIMATIONS_UPLOAD_DIR)) {
        throw new RuntimeException('Não foi possível criar a pasta das spritesheets.');
    }
    $safeId = miu_animation_slug($id);
    $extension = $info['type'] === IMAGETYPE_PNG ? 'png' : 'webp';
    $filename = $safeId . '-' . gmdate('Ymd-His') . '-' . substr(bin2hex(random_bytes(4)), 0, 8) . '.' . $extension;
    $target = MIU_ANIMATIONS_UPLOAD_DIR . '/' . $filename;
    if (!@move_uploaded_file($file['tmp_name'], $target)) {
        throw new RuntimeException('Não foi possível guardar a spritesheet no servidor.');
    }
    return array(
        'file' => 'sprites/' . $filename,
        'image' => $info,
    );
}

function miu_animation_remove_uploaded_file($relativeFile)
{
    $relativeFile = miu_animation_clean_file($relativeFile);
    if (strpos($relativeFile, 'sprites/') !== 0) {
        return;
    }
    $path = MIU_ANIMATIONS_DIR . '/' . $relativeFile;
    if (is_file($path)) {
        @unlink($path);
    }
}

function miu_animation_item_from_post($post, $existing, $uploadedFile)
{
    $existing = is_array($existing) ? $existing : array();
    $name = trim((string)(isset($post['animation_name']) ? $post['animation_name'] : (isset($existing['name']) ? $existing['name'] : '')));
    if ($name === '') {
        throw new RuntimeException('Dá um nome à animação.');
    }
    $columns = miu_animation_int(isset($post['columns']) ? $post['columns'] : (isset($existing['columns']) ? $existing['columns'] : 1), 1, 16, 1);
    $rows = miu_animation_int(isset($post['rows']) ? $post['rows'] : (isset($existing['rows']) ? $existing['rows'] : 1), 1, 16, 1);
    $frameCount = $columns * $rows;
    $sequence = miu_animation_clean_sequence(isset($post['sequence']) ? $post['sequence'] : (isset($existing['sequence']) ? $existing['sequence'] : array()), $frameCount);
    $frameMs = miu_animation_int(isset($post['frame_ms']) ? $post['frame_ms'] : 180, 40, 10000, 180);
    $durationsRaw = isset($post['durations']) ? $post['durations'] : '';
    $durations = miu_animation_clean_durations($durationsRaw, count($sequence), $frameMs);
    $allowedTriggers = miu_animation_trigger_options();
    $triggers = array();
    foreach (isset($post['triggers']) && is_array($post['triggers']) ? $post['triggers'] : array() as $trigger) {
        if (isset($allowedTriggers[$trigger])) {
            $triggers[] = (string)$trigger;
        }
    }
    $motionOptions = miu_animation_motion_options();
    $motionType = isset($post['motion_type']) && isset($motionOptions[$post['motion_type']]) ? (string)$post['motion_type'] : 'none';
    $existingTransform = isset($existing['transform']) && is_array($existing['transform']) ? $existing['transform'] : array();
    $probabilityPercent = miu_animation_float(isset($post['probability']) ? $post['probability'] : 100, 0, 100, 100);

    return array(
        'id' => isset($existing['id']) ? $existing['id'] : miu_animation_slug(isset($post['animation_id']) && trim((string)$post['animation_id']) !== '' ? $post['animation_id'] : $name),
        'name' => substr($name, 0, 80),
        'file' => $uploadedFile !== '' ? $uploadedFile : (isset($existing['file']) ? $existing['file'] : ''),
        'columns' => $columns,
        'rows' => $rows,
        'sequence' => $sequence,
        'frameDurationsMs' => $durations,
        'repeat' => miu_animation_int(isset($post['repeat']) ? $post['repeat'] : 1, 0, 20, 1),
        'enabled' => !empty($post['enabled']),
        'triggers' => array_values(array_unique($triggers)),
        'products' => miu_animation_clean_products(isset($post['product_scopes']) ? $post['product_scopes'] : (isset($existing['products']) ? $existing['products'] : array())),
        'probability' => $probabilityPercent / 100,
        'weight' => miu_animation_int(isset($post['weight']) ? $post['weight'] : 1, 1, 100, 1),
        'cooldownMs' => miu_animation_int(isset($post['cooldown_seconds']) ? ((int)$post['cooldown_seconds']) * 1000 : 0, 0, 3600000, 0),
        'flipX' => !empty($post['flip_x']),
        'staticFrame' => miu_animation_int(isset($post['static_frame']) ? $post['static_frame'] : 0, 0, max(0, $frameCount - 1), 0),
        'motion' => array(
            'type' => $motionType,
            'distancePx' => miu_animation_int(isset($post['motion_distance']) ? $post['motion_distance'] : 0, 0, 600, 0),
        ),
        'transform' => array(
            'xPx' => miu_animation_int(isset($post['transform_x']) ? $post['transform_x'] : (isset($existingTransform['xPx']) ? $existingTransform['xPx'] : 0), -600, 600, 0),
            'yPx' => miu_animation_int(isset($post['transform_y']) ? $post['transform_y'] : (isset($existingTransform['yPx']) ? $existingTransform['yPx'] : 0), -600, 600, 0),
            'rotationDeg' => miu_animation_float(isset($post['transform_rotation']) ? $post['transform_rotation'] : (isset($existingTransform['rotationDeg']) ? $existingTransform['rotationDeg'] : 0), -360, 360, 0),
        ),
    );
}

function miu_animation_create_from_request($post, $files)
{
    $config = miu_animation_config();
    $name = trim((string)(isset($post['animation_name']) ? $post['animation_name'] : ''));
    $id = miu_animation_slug(isset($post['animation_id']) && trim((string)$post['animation_id']) !== '' ? $post['animation_id'] : $name);
    if (miu_animation_find_index($config, $id) >= 0) {
        throw new RuntimeException('Já existe uma animação com esse identificador.');
    }
    $columns = miu_animation_int(isset($post['columns']) ? $post['columns'] : 1, 1, 16, 1);
    $rows = miu_animation_int(isset($post['rows']) ? $post['rows'] : 1, 1, 16, 1);
    $upload = miu_animation_store_upload(isset($files['sheet']) ? $files['sheet'] : null, $id, $columns, $rows);
    try {
        $item = miu_animation_item_from_post($post, array('id' => $id), $upload['file']);
        $config['animations'][] = $item;
        miu_animation_write_config($config);
    } catch (Exception $e) {
        miu_animation_remove_uploaded_file($upload['file']);
        throw $e;
    }
    return $upload['image'];
}

function miu_animation_update_from_request($post, $files)
{
    $config = miu_animation_config();
    $id = miu_animation_slug(isset($post['animation_id']) ? $post['animation_id'] : '');
    $index = miu_animation_find_index($config, $id);
    if ($index < 0) {
        throw new RuntimeException('A animação já não existe.');
    }
    $existing = $config['animations'][$index];
    $columns = miu_animation_int(isset($post['columns']) ? $post['columns'] : $existing['columns'], 1, 16, $existing['columns']);
    $rows = miu_animation_int(isset($post['rows']) ? $post['rows'] : $existing['rows'], 1, 16, $existing['rows']);
    $uploadedFile = '';
    $uploadInfo = null;
    $file = isset($files['sheet']) ? $files['sheet'] : null;
    if (is_array($file) && isset($file['error']) && (int)$file['error'] !== UPLOAD_ERR_NO_FILE) {
        $upload = miu_animation_store_upload($file, $id, $columns, $rows);
        $uploadedFile = $upload['file'];
        $uploadInfo = $upload['image'];
    } else {
        $existingPath = MIU_ANIMATIONS_DIR . '/' . $existing['file'];
        miu_animation_validate_sheet($existingPath, $columns, $rows);
    }
    try {
        $item = miu_animation_item_from_post($post, $existing, $uploadedFile);
        $config['animations'][$index] = $item;
        miu_animation_write_config($config);
        if ($uploadedFile !== '' && $existing['file'] !== $uploadedFile) {
            miu_animation_remove_uploaded_file($existing['file']);
        }
    } catch (Exception $e) {
        if ($uploadedFile !== '') {
            miu_animation_remove_uploaded_file($uploadedFile);
        }
        throw $e;
    }
    return $uploadInfo;
}

function miu_animation_delete_by_id($id)
{
    $config = miu_animation_config();
    $index = miu_animation_find_index($config, $id);
    if ($index < 0) {
        return;
    }
    $item = $config['animations'][$index];
    if (count($config['animations']) <= 1) {
        throw new RuntimeException('O Míu precisa de pelo menos uma animação.');
    }
    array_splice($config['animations'], $index, 1);
    if ($config['baseAnimationId'] === $item['id']) {
        $config['baseAnimationId'] = $config['animations'][0]['id'];
    }
    miu_animation_write_config($config);
    miu_animation_remove_uploaded_file($item['file']);
}

function miu_animation_save_display_from_request($post)
{
    $config = miu_animation_config();
    $baseId = miu_animation_slug(isset($post['base_animation_id']) ? $post['base_animation_id'] : $config['baseAnimationId']);
    if (miu_animation_find_index($config, $baseId) < 0) {
        $baseId = $config['baseAnimationId'];
    }
    $sleepSeconds = miu_animation_int(isset($post['sleep_after_seconds']) ? $post['sleep_after_seconds'] : round($config['display']['sleepAfterMs'] / 1000), 5, 600, 45);
    $randomMinSeconds = miu_animation_int(isset($post['idle_random_min_seconds']) ? $post['idle_random_min_seconds'] : round($config['display']['idleRandomMinMs'] / 1000), 3, 300, 14);
    $randomMaxSeconds = miu_animation_int(isset($post['idle_random_max_seconds']) ? $post['idle_random_max_seconds'] : round($config['display']['idleRandomMaxMs'] / 1000), 3, 600, 28);
    if ($randomMaxSeconds < $randomMinSeconds) {
        $randomMaxSeconds = $randomMinSeconds;
    }
    $config['baseAnimationId'] = $baseId;
    $config['display']['sleepAfterMs'] = $sleepSeconds * 1000;
    $config['display']['idleRandomMinMs'] = $randomMinSeconds * 1000;
    $config['display']['idleRandomMaxMs'] = $randomMaxSeconds * 1000;
    $config['display']['maxRoamPx'] = miu_animation_int(isset($post['max_roam_px']) ? $post['max_roam_px'] : $config['display']['maxRoamPx'], 0, 800, 180);
    return miu_animation_write_config($config);
}

function miu_animation_save_appearance_from_request($post)
{
    $config = miu_animation_config();
    $display = $config['display'];
    $display['launcherPx'] = miu_animation_int(isset($post['launcher_px']) ? $post['launcher_px'] : $display['launcherPx'], 24, 120, 46);
    $display['launcherPxMobile'] = miu_animation_int(isset($post['launcher_px_mobile']) ? $post['launcher_px_mobile'] : $display['launcherPxMobile'], 24, 120, $display['launcherPx']);
    $display['headerPx'] = miu_animation_int(isset($post['header_px']) ? $post['header_px'] : $display['headerPx'], 16, 120, 26);
    $display['headerPxMobile'] = miu_animation_int(isset($post['header_px_mobile']) ? $post['header_px_mobile'] : $display['headerPxMobile'], 16, 120, $display['headerPx']);
    $display['messagePx'] = miu_animation_int(isset($post['message_px']) ? $post['message_px'] : $display['messagePx'], 16, 80, 26);
    $display['messagePxMobile'] = miu_animation_int(isset($post['message_px_mobile']) ? $post['message_px_mobile'] : $display['messagePxMobile'], 16, 80, $display['messagePx']);
    $display['interactivePx'] = miu_animation_int(isset($post['interactive_px']) ? $post['interactive_px'] : $display['interactivePx'], 48, 240, 96);
    $display['interactivePxMobile'] = miu_animation_int(isset($post['interactive_px_mobile']) ? $post['interactive_px_mobile'] : $display['interactivePxMobile'], 48, 240, $display['interactivePx']);
    // São checkboxes no painel, mas representam opções mutuamente exclusivas
    // para o Míu PRINCIPAL no canto inferior direito.
    $display['launcherMode'] = !empty($post['launcher_mode_basket']) ? 'basket' : 'circle';
    $display['launcherCircle'] = $display['launcherMode'] === 'circle';
    $display['headerVisible'] = !empty($post['header_visible']);
    $display['headerCircle'] = !empty($post['header_circle']);
    $display['messageCircle'] = !empty($post['message_circle']);
    $display['promptSeconds'] = miu_animation_int(isset($post['prompt_seconds']) ? $post['prompt_seconds'] : $display['promptSeconds'], 0, 60, 5);
    $display['errorsViaMiu'] = !empty($post['errors_via_miu']);
    // smallPx continua apenas como compatibilidade para leitores antigos.
    $display['smallPx'] = $display['messagePx'];
    $config['display'] = $display;
    return miu_animation_write_config($config);
}

// As animações da cara vivem num manifesto separado, mas usam os mesmos
// sanitizadores de grelha, tempos e gatilhos definidos acima.
require_once __DIR__ . '/miu-face-animations.php';
