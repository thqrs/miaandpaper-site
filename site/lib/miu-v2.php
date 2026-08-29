<?php
/**
 * MIU_DIRECTOR_V2_CONFIG — contrato reversível do Míu visual de produção.
 *
 * `engine: v1` mantém integralmente o renderer histórico de 24-miu.js.
 * `engine: v2` activa o director de sprites 8×8; uma falha de carregamento
 * nunca desliga o V1, que fica visível até a V2 declarar que está pronta.
 */

if (!defined('MIU_V2_CONFIG_PATH')) {
    define('MIU_V2_CONFIG_PATH', __DIR__ . '/../content/brand/miu/miu-v2-config.json');
}

function miu_v2_bool($value, $fallback)
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

function miu_v2_int($value, $minimum, $maximum, $fallback)
{
    $parsed = filter_var($value, FILTER_VALIDATE_INT);
    if ($parsed === false) {
        return (int)$fallback;
    }
    return max((int)$minimum, min((int)$maximum, (int)$parsed));
}

function miu_v2_float($value, $minimum, $maximum, $fallback)
{
    if (!is_numeric($value)) {
        return (float)$fallback;
    }
    return max((float)$minimum, min((float)$maximum, (float)$value));
}

function miu_v2_id($value, $fallback)
{
    $value = strtolower(trim((string)$value));
    return preg_match('/^[a-z0-9][a-z0-9_-]{0,79}$/', $value) ? $value : (string)$fallback;
}

function miu_v2_path($value, $fallback, $extension)
{
    $value = str_replace('\\', '/', trim((string)$value));
    $pattern = $extension === 'js'
        ? '~^miu-[a-z0-9_./-]+\.js$~i'
        : '~^content/brand/miu/[a-z0-9_./-]+\.json$~i';
    if ($value === '' || strpos($value, '..') !== false || $value[0] === '/' || !preg_match($pattern, $value)) {
        return (string)$fallback;
    }
    return $value;
}

function miu_v2_id_list($value, $fallback, $maximum)
{
    $parts = is_array($value) ? $value : preg_split('/[\s,;]+/', trim((string)$value));
    $result = array();
    foreach ((array)$parts as $part) {
        $id = miu_v2_id($part, '');
        if ($id !== '') {
            $result[$id] = $id;
        }
        if (count($result) >= (int)$maximum) {
            break;
        }
    }
    return $result ? array_values($result) : (array)$fallback;
}

function miu_v2_default_config()
{
    return array(
        'schemaVersion' => 2,
        'updatedAt' => gmdate('c'),
        'engine' => 'v2',
        'assets' => array(
            'runtime' => 'miu-v2-runtime.js',
            'cacheVersion' => '2026083001',
            'coreManifest' => 'content/brand/miu/v2/core-manifest.json',
            'libraryManifest' => 'content/brand/miu/experimental/library-v1/library-manifest.json',
            'episodeManifest' => 'content/brand/miu/experimental/library-v1/episodes/episode-manifest.json',
        ),
        'appearance' => array(
            'sizeDesktopPx' => 60,
            'sizeMobilePx' => 60,
            'canvasResolution' => 360,
            'offsetXPx' => 0,
            'offsetYPx' => 5,
            'scale' => 0.96,
            'rigIntensity' => 0.62,
            'showFx' => true,
        ),
        'mesh' => array(
            'enabled' => true,
            'rows' => 6,
            'maxOffsetPx' => 2.4,
            'followThrough' => 0.18,
            'squashInfluence' => 0.012,
        ),
        'timing' => array(
            'speed' => 1,
            'quietWindowMs' => 190,
            'minimumAttentionMs' => 150,
            'idleMinMs' => 14000,
            'idleMaxMs' => 28000,
            'reactionHoldMs' => 110,
            'recoveryDelayMs' => 90,
        ),
        'thresholds' => array(
            'smallMax' => 0.28,
            'mediumMax' => 0.62,
            'velocityWeight' => 0.045,
        ),
        'animations' => array(
            'idle' => array(
                array('id' => 'v5_idle_blink', 'weight' => 6),
                array('id' => 'v5_idle_gaze', 'weight' => 2.5),
                array('id' => 'v5_idle_ear_twitch', 'weight' => 1.8),
                array('id' => 'v5_idle_micro_expression', 'weight' => 1.2),
            ),
            'attention' => 'v5_attention_start',
            'trackingUp' => 'v5_tracking_up',
            'trackingDown' => 'v5_tracking_down',
            'upSmall' => 'v5_quantity_up_small',
            'upMedium' => 'v5_quantity_up_medium',
            'upLarge' => 'v5_quantity_up_large',
            'downSmall' => 'v5_quantity_down_small',
            'downMedium' => 'v5_quantity_down_medium',
            'downLarge' => 'v5_quantity_down_large',
            'recovery' => 'v5_recovery',
            'rejoice' => 'v5_rejoice',
        ),
        'triggers' => array(
            'quantity' => true,
            'packs' => true,
            'continueRejoice' => true,
            'continueStepIds' => array('pack', 'quantity', 'quantidade'),
            'launcherAttention' => true,
            'chatReactions' => true,
        ),
        'library' => array(
            'manualEmotions' => true,
            'manualEpisodes' => true,
            'ambientEpisodes' => false,
            'ambientMinMs' => 60000,
            'ambientMaxMs' => 120000,
            'ambientProbability' => 0.12,
            'episodeIds' => array(
                's01e01-borboleta-no-nariz',
                's01e02-o-novelo-rebelde',
                's01e03-a-flor-teimosa',
                's01e04-o-cracha-careta',
                's01e05-a-caixa-e-minha',
                's01e06-a-grande-corrida',
                's01e07-chuva-de-confettis',
                's01e08-o-catavento-hipnotico',
                's01e09-a-encomenda-perfeita',
                's01e10-um-dia-na-oficina',
                's01e11-a-coleccao-de-caretas',
                's01e12-a-coroa-da-oficina',
                's01e13-o-pompom-impossivel',
                's01e14-a-carta-sem-palavras',
            ),
        ),
        'reducedMotion' => array(
            'enabled' => true,
            'keepEmotion' => true,
            'secondaryMotion' => 0,
            'framePolicy' => 'first-middle-last',
        ),
        'debug' => array(
            'console' => false,
        ),
    );
}

function miu_v2_sanitize_idle($value, $fallback)
{
    $result = array();
    foreach (is_array($value) ? $value : array() as $item) {
        if (!is_array($item)) {
            continue;
        }
        $id = miu_v2_id(isset($item['id']) ? $item['id'] : '', '');
        if ($id === '') {
            continue;
        }
        $result[] = array(
            'id' => $id,
            'weight' => round(miu_v2_float(isset($item['weight']) ? $item['weight'] : 1, 0.05, 100, 1), 3),
        );
        if (count($result) >= 20) {
            break;
        }
    }
    return $result ? $result : $fallback;
}

function miu_v2_sanitize_config($raw)
{
    $defaults = miu_v2_default_config();
    $raw = is_array($raw) ? $raw : array();
    $assets = isset($raw['assets']) && is_array($raw['assets']) ? $raw['assets'] : array();
    $appearance = isset($raw['appearance']) && is_array($raw['appearance']) ? $raw['appearance'] : array();
    $mesh = isset($raw['mesh']) && is_array($raw['mesh']) ? $raw['mesh'] : array();
    $timing = isset($raw['timing']) && is_array($raw['timing']) ? $raw['timing'] : array();
    $thresholds = isset($raw['thresholds']) && is_array($raw['thresholds']) ? $raw['thresholds'] : array();
    $animations = isset($raw['animations']) && is_array($raw['animations']) ? $raw['animations'] : array();
    $triggers = isset($raw['triggers']) && is_array($raw['triggers']) ? $raw['triggers'] : array();
    $library = isset($raw['library']) && is_array($raw['library']) ? $raw['library'] : array();
    $reduced = isset($raw['reducedMotion']) && is_array($raw['reducedMotion']) ? $raw['reducedMotion'] : array();
    $debug = isset($raw['debug']) && is_array($raw['debug']) ? $raw['debug'] : array();

    $smallMax = miu_v2_float(isset($thresholds['smallMax']) ? $thresholds['smallMax'] : 0.28, 0.05, 0.7, 0.28);
    $mediumMax = miu_v2_float(isset($thresholds['mediumMax']) ? $thresholds['mediumMax'] : 0.62, $smallMax + 0.05, 0.95, 0.62);
    $idleMin = miu_v2_int(isset($timing['idleMinMs']) ? $timing['idleMinMs'] : 14000, 250, 60000, 14000);
    $idleMax = miu_v2_int(isset($timing['idleMaxMs']) ? $timing['idleMaxMs'] : 28000, $idleMin, 120000, 28000);
    $ambientMin = miu_v2_int(isset($library['ambientMinMs']) ? $library['ambientMinMs'] : 60000, 15000, 1800000, 60000);
    $ambientMax = miu_v2_int(isset($library['ambientMaxMs']) ? $library['ambientMaxMs'] : 120000, $ambientMin, 3600000, 120000);

    $animationKeys = array(
        'attention', 'trackingUp', 'trackingDown', 'upSmall', 'upMedium', 'upLarge',
        'downSmall', 'downMedium', 'downLarge', 'recovery', 'rejoice',
    );
    $cleanAnimations = array(
        'idle' => miu_v2_sanitize_idle(isset($animations['idle']) ? $animations['idle'] : array(), $defaults['animations']['idle']),
    );
    foreach ($animationKeys as $key) {
        $cleanAnimations[$key] = miu_v2_id(
            isset($animations[$key]) ? $animations[$key] : $defaults['animations'][$key],
            $defaults['animations'][$key]
        );
    }

    $cacheVersion = preg_replace('/[^a-z0-9._-]+/i', '', (string)(isset($assets['cacheVersion']) ? $assets['cacheVersion'] : $defaults['assets']['cacheVersion']));
    if ($cacheVersion === '') {
        $cacheVersion = $defaults['assets']['cacheVersion'];
    }

    return array(
        'schemaVersion' => 2,
        'updatedAt' => isset($raw['updatedAt']) ? (string)$raw['updatedAt'] : '',
        'engine' => isset($raw['engine']) && $raw['engine'] === 'v1' ? 'v1' : 'v2',
        'assets' => array(
            'runtime' => miu_v2_path(isset($assets['runtime']) ? $assets['runtime'] : '', $defaults['assets']['runtime'], 'js'),
            'cacheVersion' => substr($cacheVersion, 0, 80),
            'coreManifest' => miu_v2_path(isset($assets['coreManifest']) ? $assets['coreManifest'] : '', $defaults['assets']['coreManifest'], 'json'),
            'libraryManifest' => miu_v2_path(isset($assets['libraryManifest']) ? $assets['libraryManifest'] : '', $defaults['assets']['libraryManifest'], 'json'),
            'episodeManifest' => miu_v2_path(isset($assets['episodeManifest']) ? $assets['episodeManifest'] : '', $defaults['assets']['episodeManifest'], 'json'),
        ),
        'appearance' => array(
            'sizeDesktopPx' => miu_v2_int(isset($appearance['sizeDesktopPx']) ? $appearance['sizeDesktopPx'] : 60, 52, 240, 60),
            'sizeMobilePx' => miu_v2_int(isset($appearance['sizeMobilePx']) ? $appearance['sizeMobilePx'] : 60, 52, 200, 60),
            'canvasResolution' => miu_v2_int(isset($appearance['canvasResolution']) ? $appearance['canvasResolution'] : 360, 192, 720, 360),
            'offsetXPx' => miu_v2_int(isset($appearance['offsetXPx']) ? $appearance['offsetXPx'] : 0, -120, 120, 0),
            'offsetYPx' => miu_v2_int(isset($appearance['offsetYPx']) ? $appearance['offsetYPx'] : 5, -120, 120, 5),
            'scale' => round(miu_v2_float(isset($appearance['scale']) ? $appearance['scale'] : 0.96, 0.45, 1.8, 0.96), 3),
            'rigIntensity' => round(miu_v2_float(isset($appearance['rigIntensity']) ? $appearance['rigIntensity'] : 0.62, 0, 1.5, 0.62), 3),
            'showFx' => miu_v2_bool(isset($appearance['showFx']) ? $appearance['showFx'] : true, true),
        ),
        'mesh' => array(
            'enabled' => miu_v2_bool(isset($mesh['enabled']) ? $mesh['enabled'] : true, true),
            'rows' => miu_v2_int(isset($mesh['rows']) ? $mesh['rows'] : 6, 2, 12, 6),
            'maxOffsetPx' => round(miu_v2_float(isset($mesh['maxOffsetPx']) ? $mesh['maxOffsetPx'] : 2.4, 0, 8, 2.4), 3),
            'followThrough' => round(miu_v2_float(isset($mesh['followThrough']) ? $mesh['followThrough'] : 0.18, 0, 1, 0.18), 3),
            'squashInfluence' => round(miu_v2_float(isset($mesh['squashInfluence']) ? $mesh['squashInfluence'] : 0.012, 0, 0.05, 0.012), 4),
        ),
        'timing' => array(
            'speed' => round(miu_v2_float(isset($timing['speed']) ? $timing['speed'] : 1, 0.25, 2.5, 1), 3),
            'quietWindowMs' => miu_v2_int(isset($timing['quietWindowMs']) ? $timing['quietWindowMs'] : 190, 80, 800, 190),
            'minimumAttentionMs' => miu_v2_int(isset($timing['minimumAttentionMs']) ? $timing['minimumAttentionMs'] : 150, 50, 1000, 150),
            'idleMinMs' => $idleMin,
            'idleMaxMs' => $idleMax,
            'reactionHoldMs' => miu_v2_int(isset($timing['reactionHoldMs']) ? $timing['reactionHoldMs'] : 110, 0, 1200, 110),
            'recoveryDelayMs' => miu_v2_int(isset($timing['recoveryDelayMs']) ? $timing['recoveryDelayMs'] : 90, 0, 1200, 90),
        ),
        'thresholds' => array(
            'smallMax' => round($smallMax, 3),
            'mediumMax' => round($mediumMax, 3),
            'velocityWeight' => round(miu_v2_float(isset($thresholds['velocityWeight']) ? $thresholds['velocityWeight'] : 0.045, 0, 0.3, 0.045), 4),
        ),
        'animations' => $cleanAnimations,
        'triggers' => array(
            'quantity' => miu_v2_bool(isset($triggers['quantity']) ? $triggers['quantity'] : true, true),
            'packs' => miu_v2_bool(isset($triggers['packs']) ? $triggers['packs'] : true, true),
            'continueRejoice' => miu_v2_bool(isset($triggers['continueRejoice']) ? $triggers['continueRejoice'] : true, true),
            'continueStepIds' => miu_v2_id_list(isset($triggers['continueStepIds']) ? $triggers['continueStepIds'] : array(), $defaults['triggers']['continueStepIds'], 30),
            'launcherAttention' => miu_v2_bool(isset($triggers['launcherAttention']) ? $triggers['launcherAttention'] : true, true),
            'chatReactions' => miu_v2_bool(isset($triggers['chatReactions']) ? $triggers['chatReactions'] : true, true),
        ),
        'library' => array(
            'manualEmotions' => miu_v2_bool(isset($library['manualEmotions']) ? $library['manualEmotions'] : true, true),
            'manualEpisodes' => miu_v2_bool(isset($library['manualEpisodes']) ? $library['manualEpisodes'] : true, true),
            'ambientEpisodes' => miu_v2_bool(isset($library['ambientEpisodes']) ? $library['ambientEpisodes'] : false, false),
            'ambientMinMs' => $ambientMin,
            'ambientMaxMs' => $ambientMax,
            'ambientProbability' => round(miu_v2_float(isset($library['ambientProbability']) ? $library['ambientProbability'] : 0.12, 0, 1, 0.12), 3),
            'episodeIds' => miu_v2_id_list(isset($library['episodeIds']) ? $library['episodeIds'] : array(), $defaults['library']['episodeIds'], 80),
        ),
        'reducedMotion' => array(
            'enabled' => miu_v2_bool(isset($reduced['enabled']) ? $reduced['enabled'] : true, true),
            'keepEmotion' => miu_v2_bool(isset($reduced['keepEmotion']) ? $reduced['keepEmotion'] : true, true),
            'secondaryMotion' => round(miu_v2_float(isset($reduced['secondaryMotion']) ? $reduced['secondaryMotion'] : 0, 0, 0.25, 0), 3),
            'framePolicy' => 'first-middle-last',
        ),
        'debug' => array(
            'console' => miu_v2_bool(isset($debug['console']) ? $debug['console'] : false, false),
        ),
    );
}

function miu_v2_config()
{
    if (!is_file(MIU_V2_CONFIG_PATH)) {
        return miu_v2_default_config();
    }
    $raw = @file_get_contents(MIU_V2_CONFIG_PATH);
    $decoded = is_string($raw) ? json_decode($raw, true) : null;
    return miu_v2_sanitize_config(is_array($decoded) ? $decoded : array());
}

function miu_v2_write_config($config)
{
    $clean = miu_v2_sanitize_config($config);
    $clean['updatedAt'] = gmdate('c');
    $directory = dirname(MIU_V2_CONFIG_PATH);
    if (!is_dir($directory) && !@mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Não foi possível criar a pasta de configuração do Míu V2.');
    }
    $json = json_encode($clean, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json) || @file_put_contents(MIU_V2_CONFIG_PATH, $json . "\n", LOCK_EX) === false) {
        throw new RuntimeException('Não foi possível guardar a configuração do Míu V2. O ficheiro anterior foi mantido.');
    }
    return $clean;
}

function miu_v2_public_config()
{
    return miu_v2_config();
}

function miu_v2_core_animation_ids()
{
    $config = miu_v2_config();
    $relative = isset($config['assets']['coreManifest']) ? $config['assets']['coreManifest'] : '';
    $prefix = 'content/brand/miu/';
    if (strpos($relative, $prefix) !== 0) {
        return array();
    }
    $path = dirname(__DIR__) . '/content/brand/miu/' . substr($relative, strlen($prefix));
    $raw = is_file($path) ? @file_get_contents($path) : false;
    $manifest = is_string($raw) ? json_decode($raw, true) : null;
    $result = array();
    foreach (is_array($manifest) && isset($manifest['animations']) && is_array($manifest['animations']) ? $manifest['animations'] : array() as $animation) {
        $id = isset($animation['id']) ? miu_v2_id($animation['id'], '') : '';
        if ($id !== '') {
            $result[$id] = isset($animation['name']) ? (string)$animation['name'] : $id;
        }
    }
    return $result;
}
