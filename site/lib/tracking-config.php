<?php

function mp_tracking_config_path()
{
    return __DIR__ . '/../content/tracking.json';
}

function mp_tracking_config_defaults()
{
    return array(
        'level' => 'medium',
        'batchDelayMs' => 750,
        'batchMaxEvents' => 12,
    );
}

function mp_tracking_config_read()
{
    $defaults = mp_tracking_config_defaults();
    $decoded = json_decode((string)@file_get_contents(mp_tracking_config_path()), true);
    if (!is_array($decoded)) {
        return $defaults;
    }

    $level = isset($decoded['level']) ? strtolower(trim((string)$decoded['level'])) : $defaults['level'];
    if (!in_array($level, array('off', 'minimum', 'medium', 'maximum'), true)) {
        $level = $defaults['level'];
    }

    return array(
        'level' => $level,
        'batchDelayMs' => max(250, min(3000, (int)(isset($decoded['batchDelayMs']) ? $decoded['batchDelayMs'] : $defaults['batchDelayMs']))),
        'batchMaxEvents' => max(2, min(30, (int)(isset($decoded['batchMaxEvents']) ? $decoded['batchMaxEvents'] : $defaults['batchMaxEvents']))),
    );
}

function mp_tracking_config_write(array $input)
{
    $current = mp_tracking_config_read();
    $level = isset($input['level']) ? strtolower(trim((string)$input['level'])) : '';
    if (!in_array($level, array('off', 'minimum', 'medium', 'maximum'), true)) {
        throw new InvalidArgumentException('Escolhe um nível de tracking válido.');
    }
    $current['level'] = $level;

    $json = json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('Não foi possível preparar a configuração de tracking.');
    }

    $path = mp_tracking_config_path();
    $tmp = $path . '.tmp-' . bin2hex(random_bytes(6));
    if (file_put_contents($tmp, $json . "\n", LOCK_EX) === false) {
        throw new RuntimeException('Não foi possível escrever a configuração de tracking.');
    }
    @chmod($tmp, 0644);
    if (!@rename($tmp, $path)) {
        if (!is_file($path) || !@unlink($path) || !@rename($tmp, $path)) {
            @unlink($tmp);
            throw new RuntimeException('Não foi possível publicar a configuração de tracking.');
        }
    }
    return $current;
}
