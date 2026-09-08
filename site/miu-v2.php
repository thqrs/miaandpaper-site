<?php
/**
 * MIU_DIRECTOR_V2_ADMIN — interruptor, afinação e ensaio do Míu V2.
 *
 * Esta página nunca apaga assets. A mudança V1/V2 altera apenas um campo no
 * JSON; o renderer histórico continua carregado como fallback operacional.
 */

require_once __DIR__ . '/admin-open.php';

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
        . '<title>Acesso negado · Míu V2</title><h1>Acesso restrito.</h1>'
        . '<p>Inicia sessão como administradora a partir do site e regressa a esta página.</p>';
    exit;
}

require_once __DIR__ . '/lib/miu-v2.php';

function miu_v2_admin_h($value)
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function miu_v2_admin_post($key, $fallback)
{
    return isset($_POST[$key]) ? $_POST[$key] : $fallback;
}

function miu_v2_admin_checkbox($key)
{
    return !empty($_POST[$key]);
}

function miu_v2_admin_redirect($kind, $message)
{
    $_SESSION['miu_v2_flash'] = array('kind' => $kind, 'message' => $message);
    header('Location: miu-v2.php');
    exit;
}

$csrf = mp_admin_csrf_token();

if (isset($_SERVER['REQUEST_METHOD']) && strtoupper((string)$_SERVER['REQUEST_METHOD']) === 'POST') {
    $sentCsrf = isset($_POST['csrf']) ? (string)$_POST['csrf'] : '';
    if (!mp_admin_csrf_is_valid($sentCsrf)) {
        http_response_code(403);
        exit('Pedido recusado: token CSRF inválido.');
    }
    $action = isset($_POST['action']) ? (string)$_POST['action'] : '';
    try {
        if ($action === 'set_engine') {
            $config = miu_v2_config();
            $config['engine'] = isset($_POST['engine']) && $_POST['engine'] === 'v1' ? 'v1' : 'v2';
            miu_v2_write_config($config);
            miu_v2_admin_redirect('success', $config['engine'] === 'v2'
                ? 'Míu V2 activado. O V1 continua guardado e disponível como fallback.'
                : 'Rollback lógico concluído: o site voltou a usar o renderer V1.');
        }

        if ($action === 'restore_defaults') {
            miu_v2_write_config(miu_v2_default_config());
            miu_v2_admin_redirect('success', 'Parâmetros V2 repostos. O motor fica activo com os valores documentados de origem.');
        }

        if ($action === 'save_json') {
            $rawJson = isset($_POST['config_json']) ? (string)$_POST['config_json'] : '';
            $decoded = json_decode($rawJson, true, 64);
            if (!is_array($decoded)) {
                throw new RuntimeException('O JSON avançado não é válido: ' . json_last_error_msg());
            }
            miu_v2_write_config($decoded);
            miu_v2_admin_redirect('success', 'Configuração avançada validada e guardada.');
        }

        if ($action === 'save_controls') {
            $config = miu_v2_config();
            $config['appearance'] = array(
                'sizeDesktopPx' => miu_v2_admin_post('size_desktop_px', 60),
                'sizeMobilePx' => miu_v2_admin_post('size_mobile_px', 60),
                'canvasResolution' => miu_v2_admin_post('canvas_resolution', 360),
                'offsetXPx' => miu_v2_admin_post('offset_x_px', 0),
                'offsetYPx' => miu_v2_admin_post('offset_y_px', 0),
                'scale' => miu_v2_admin_post('scale', 0.96),
                'rigIntensity' => miu_v2_admin_post('rig_intensity', 0.62),
                'showFx' => miu_v2_admin_checkbox('show_fx'),
                'idleLockToBubbleCenter' => miu_v2_admin_checkbox('idle_lock_to_bubble_center'),
            );
            $config['mesh'] = array(
                'enabled' => miu_v2_admin_checkbox('mesh_enabled'),
                'rows' => miu_v2_admin_post('mesh_rows', 6),
                'maxOffsetPx' => miu_v2_admin_post('mesh_max_offset_px', 2.4),
                'followThrough' => miu_v2_admin_post('mesh_follow_through', 0.18),
                'squashInfluence' => miu_v2_admin_post('mesh_squash_influence', 0.012),
            );
            $config['timing'] = array(
                'speed' => miu_v2_admin_post('speed', 1),
                'quietWindowMs' => miu_v2_admin_post('quiet_window_ms', 190),
                'minimumAttentionMs' => miu_v2_admin_post('minimum_attention_ms', 150),
                'idleMinMs' => miu_v2_admin_post('idle_min_ms', 14000),
                'idleMaxMs' => miu_v2_admin_post('idle_max_ms', 28000),
                'reactionHoldMs' => miu_v2_admin_post('reaction_hold_ms', 110),
                'recoveryDelayMs' => miu_v2_admin_post('recovery_delay_ms', 90),
            );
            $config['thresholds'] = array(
                'smallMax' => miu_v2_admin_post('small_max', 0.28),
                'mediumMax' => miu_v2_admin_post('medium_max', 0.62),
                'velocityWeight' => miu_v2_admin_post('velocity_weight', 0.045),
            );
            $config['variation']['enabled'] = miu_v2_admin_checkbox('variation_enabled');
            $config['variation']['hoverCooldownMs'] = miu_v2_admin_post('hover_cooldown_ms', 4200);
            $config['variation']['rigBiasPx'] = miu_v2_admin_post('variation_rig_bias_px', 1.2);
            $config['triggers'] = array(
                'quantity' => miu_v2_admin_checkbox('trigger_quantity'),
                'packs' => miu_v2_admin_checkbox('trigger_packs'),
                'continueRejoice' => miu_v2_admin_checkbox('trigger_continue'),
                'continueStepIds' => miu_v2_admin_post('continue_step_ids', ''),
                'launcherAttention' => miu_v2_admin_checkbox('trigger_launcher'),
                'chatReactions' => miu_v2_admin_checkbox('trigger_chat'),
            );
            $config['library'] = array(
                'manualEmotions' => miu_v2_admin_checkbox('manual_emotions'),
                'manualEpisodes' => miu_v2_admin_checkbox('manual_episodes'),
                'ambientEpisodes' => miu_v2_admin_checkbox('ambient_episodes'),
                'ambientMinMs' => miu_v2_admin_post('ambient_min_ms', 60000),
                'ambientMaxMs' => miu_v2_admin_post('ambient_max_ms', 120000),
                'ambientProbability' => miu_v2_admin_post('ambient_probability', 0.12),
                'episodeIds' => miu_v2_admin_post('episode_ids', ''),
            );
            $config['reducedMotion']['enabled'] = miu_v2_admin_checkbox('reduced_enabled');
            $config['reducedMotion']['keepEmotion'] = miu_v2_admin_checkbox('reduced_keep_emotion');
            $config['reducedMotion']['secondaryMotion'] = miu_v2_admin_post('reduced_secondary_motion', 0);
            $config['debug']['console'] = miu_v2_admin_checkbox('debug_console');

            $animationKeys = array(
                'attention', 'trackingUp', 'trackingDown', 'upSmall', 'upMedium', 'upLarge',
                'downSmall', 'downMedium', 'downLarge', 'recovery', 'rejoice',
            );
            foreach ($animationKeys as $key) {
                $config['animations'][$key] = miu_v2_admin_post('animation_' . $key, $config['animations'][$key]);
            }
            foreach ($config['animations']['idle'] as $index => $idle) {
                $config['animations']['idle'][$index]['weight'] = miu_v2_admin_post('idle_weight_' . $index, $idle['weight']);
            }
            miu_v2_write_config($config);
            miu_v2_admin_redirect('success', 'Afinações V2 guardadas. Recarrega uma página pública para confirmar o resultado final.');
        }

        throw new RuntimeException('Acção desconhecida.');
    } catch (Exception $e) {
        miu_v2_admin_redirect('error', 'Não foi possível guardar: ' . $e->getMessage());
    }
}

$config = miu_v2_config();
$animationIds = miu_v2_core_animation_ids();
$flash = isset($_SESSION['miu_v2_flash']) && is_array($_SESSION['miu_v2_flash']) ? $_SESSION['miu_v2_flash'] : null;
unset($_SESSION['miu_v2_flash']);
$configJson = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

function miu_v2_admin_animation_select($name, $selected, $animationIds)
{
    echo '<select name="' . miu_v2_admin_h($name) . '">';
    foreach ($animationIds as $id => $label) {
        echo '<option value="' . miu_v2_admin_h($id) . '"' . ((string)$selected === (string)$id ? ' selected' : '') . '>'
            . miu_v2_admin_h($label) . '</option>';
    }
    echo '</select>';
}
?>
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Míu V2 · Produção | Mia &amp; Paper</title>
  <link rel="stylesheet" href="css/01-tokens-agua.css?v=20260908010816">
  <link rel="stylesheet" href="admin-nav.css?v=20260908010816">
  <link rel="stylesheet" href="bot-admin.css?v=2026081501">
  <link rel="stylesheet" href="miu-v2-admin.css?v=2026082901">
  <link rel="stylesheet" href="css/13-miu.css?v=20260908010816">
  <script src="admin-nav.js?v=20260908010816" defer></script>
  <script src="js/24-miu.js?v=20260908010816" defer></script>
</head>
<body class="miu-admin-body miu-v2-admin" data-miu-admin-chat="1" data-page="miu-v2-admin">
<main class="miu-admin-shell miu-v2-admin__shell">
  <header class="miu-admin-header">
    <div>
      <p class="miu-v2-admin__eyebrow">Produção reversível</p>
      <h1>Míu V2</h1>
      <p>Idle vivo, atenção, reacções por gesto, emoções e pequenos episódios — sem remover o Míu anterior.</p>
    </div>
    <code class="miu-admin-path">checkpoint 469d9f2</code>
  </header>

  <?php if ($flash): ?>
    <p class="miu-v2-admin__notice <?= $flash['kind'] === 'error' ? 'is-error' : 'is-success' ?>" role="status"><?= miu_v2_admin_h($flash['message']) ?></p>
  <?php endif; ?>

  <section class="miu-admin-card miu-v2-admin__switch" aria-labelledby="miu-v2-engine-title">
    <header class="miu-admin-card__head">
      <div><h2 id="miu-v2-engine-title">Motor activo</h2><p>Este é o interruptor de rollback. Não move, converte nem apaga nenhum asset.</p></div>
      <span class="miu-v2-admin__status <?= $config['engine'] === 'v2' ? 'is-v2' : 'is-v1' ?>"><?= miu_v2_admin_h(strtoupper($config['engine'])) ?></span>
    </header>
    <div class="miu-v2-admin__engine-actions">
      <form method="post">
        <input type="hidden" name="csrf" value="<?= miu_v2_admin_h($csrf) ?>">
        <input type="hidden" name="action" value="set_engine">
        <input type="hidden" name="engine" value="v2">
        <button class="miu-v2-admin__primary" type="submit">Activar V2</button>
      </form>
      <form method="post">
        <input type="hidden" name="csrf" value="<?= miu_v2_admin_h($csrf) ?>">
        <input type="hidden" name="action" value="set_engine">
        <input type="hidden" name="engine" value="v1">
        <button type="submit">Voltar ao V1</button>
      </form>
    </div>
    <p>O V1 continua em <code>js/24-miu.js</code>, <code>css/13-miu.css</code> e nos sprites históricos. A V2 só o oculta depois de desenhar o primeiro frame; qualquer falha mantém o V1.</p>
  </section>

  <section class="miu-admin-card" aria-labelledby="miu-v2-preview-title">
    <header class="miu-admin-card__head"><div><h2 id="miu-v2-preview-title">Ensaio no motor real</h2><p>O Míu no canto desta página usa exactamente a configuração pública guardada.</p></div></header>
    <div class="miu-v2-admin__demo" data-miu-v2-demo>
      <label>Valor anterior <input type="number" value="2" min="0" max="100" data-demo-previous></label>
      <label>Novo valor <input type="number" value="8" min="0" max="100" data-demo-current></label>
      <label>Máximo <input type="number" value="10" min="1" max="10000" data-demo-max></label>
      <button type="button" data-demo-action="quantity">Reagir à alteração</button>
      <button type="button" data-demo-action="rejoice">Rejoice</button>
      <button type="button" data-demo-action="happy">Alegria Ekman</button>
      <button type="button" data-demo-action="sad">Tristeza suave</button>
      <button type="button" data-demo-action="butterfly">Episódio · borboleta</button>
      <button type="button" data-demo-action="reset">Voltar ao idle</button>
    </div>
    <pre class="miu-v2-admin__debug" data-demo-debug>O motor está a carregar…</pre>
  </section>

  <form class="miu-admin-card miu-v2-admin__form" method="post" aria-labelledby="miu-v2-controls-title">
    <input type="hidden" name="csrf" value="<?= miu_v2_admin_h($csrf) ?>">
    <input type="hidden" name="action" value="save_controls">
    <header class="miu-admin-card__head"><div><h2 id="miu-v2-controls-title">Afinação visual e comportamento</h2><p>Os campos são validados no servidor e têm limites seguros.</p></div></header>

    <fieldset>
      <legend>Aparência</legend>
      <div class="miu-v2-admin__grid">
        <label>Tamanho desktop (px)<input type="number" name="size_desktop_px" min="52" max="240" value="<?= (int)$config['appearance']['sizeDesktopPx'] ?>"></label>
        <label>Tamanho mobile (px)<input type="number" name="size_mobile_px" min="52" max="200" value="<?= (int)$config['appearance']['sizeMobilePx'] ?>"></label>
        <label>Resolução do canvas<input type="number" name="canvas_resolution" min="192" max="720" value="<?= (int)$config['appearance']['canvasResolution'] ?>"></label>
        <label>Offset X (px)<input type="number" name="offset_x_px" min="-120" max="120" value="<?= (int)$config['appearance']['offsetXPx'] ?>"></label>
        <label>Offset Y (px)<input type="number" name="offset_y_px" min="-120" max="120" value="<?= (int)$config['appearance']['offsetYPx'] ?>"></label>
        <label>Escala da arte<input type="number" name="scale" min="0.45" max="1.8" step="0.01" value="<?= miu_v2_admin_h($config['appearance']['scale']) ?>"></label>
        <label>Intensidade do rig<input type="number" name="rig_intensity" min="0" max="1.5" step="0.01" value="<?= miu_v2_admin_h($config['appearance']['rigIntensity']) ?>"></label>
        <label class="miu-v2-admin__check"><input type="checkbox" name="show_fx" value="1" <?= $config['appearance']['showFx'] ? 'checked' : '' ?>> Mostrar FX anime</label>
        <label class="miu-v2-admin__check"><input type="checkbox" name="idle_lock_to_bubble_center" value="1" <?= $config['appearance']['idleLockToBubbleCenter'] ? 'checked' : '' ?>> Centrar o idle como a primeira pose histórica</label>
        <label class="miu-v2-admin__check"><input type="checkbox" name="mesh_enabled" value="1" <?= $config['mesh']['enabled'] ? 'checked' : '' ?>> Activar mesh local</label>
        <label>Bandas da mesh<input type="number" name="mesh_rows" min="2" max="12" value="<?= (int)$config['mesh']['rows'] ?>"></label>
        <label>Offset máximo da mesh (px)<input type="number" name="mesh_max_offset_px" min="0" max="8" step="0.1" value="<?= miu_v2_admin_h($config['mesh']['maxOffsetPx']) ?>"></label>
        <label>Follow-through da mesh<input type="number" name="mesh_follow_through" min="0" max="1" step="0.01" value="<?= miu_v2_admin_h($config['mesh']['followThrough']) ?>"></label>
        <label>Squash local da base<input type="number" name="mesh_squash_influence" min="0" max="0.05" step="0.001" value="<?= miu_v2_admin_h($config['mesh']['squashInfluence']) ?>"></label>
      </div>
    </fieldset>

    <fieldset>
      <legend>Variação sem repetição</legend>
      <div class="miu-v2-admin__checks">
        <label><input type="checkbox" name="variation_enabled" value="1" <?= $config['variation']['enabled'] ? 'checked' : '' ?>> Variar atenção e reacções sem repetir a versão anterior</label>
      </div>
      <div class="miu-v2-admin__grid">
        <label>Intervalo entre hovers (ms)<input type="number" name="hover_cooldown_ms" min="0" max="60000" value="<?= (int)$config['variation']['hoverCooldownMs'] ?>"></label>
        <label>Assimetria subtil do rig (px)<input type="number" name="variation_rig_bias_px" min="0" max="6" step="0.1" value="<?= miu_v2_admin_h($config['variation']['rigBiasPx']) ?>"></label>
      </div>
      <p class="miu-v2-admin__hint">As variações usam apenas frames artísticos existentes, em ordens temporais alternativas. Os padrões exactos continuam disponíveis no JSON avançado.</p>
    </fieldset>

    <fieldset>
      <legend>Tempos e classificação do gesto</legend>
      <div class="miu-v2-admin__grid">
        <label>Velocidade global<input type="number" name="speed" min="0.25" max="2.5" step="0.01" value="<?= miu_v2_admin_h($config['timing']['speed']) ?>"></label>
        <label>Janela silenciosa (ms)<input type="number" name="quiet_window_ms" min="80" max="800" value="<?= (int)$config['timing']['quietWindowMs'] ?>"></label>
        <label>Atenção mínima (ms)<input type="number" name="minimum_attention_ms" min="50" max="1000" value="<?= (int)$config['timing']['minimumAttentionMs'] ?>"></label>
        <label>Idle mínimo (ms)<input type="number" name="idle_min_ms" min="250" max="60000" value="<?= (int)$config['timing']['idleMinMs'] ?>"></label>
        <label>Idle máximo (ms)<input type="number" name="idle_max_ms" min="250" max="120000" value="<?= (int)$config['timing']['idleMaxMs'] ?>"></label>
        <label>Hold da reacção (ms)<input type="number" name="reaction_hold_ms" min="0" max="1200" value="<?= (int)$config['timing']['reactionHoldMs'] ?>"></label>
        <label>Atraso de recovery (ms)<input type="number" name="recovery_delay_ms" min="0" max="1200" value="<?= (int)$config['timing']['recoveryDelayMs'] ?>"></label>
        <label>Limite pequeno<input type="number" name="small_max" min="0.05" max="0.7" step="0.01" value="<?= miu_v2_admin_h($config['thresholds']['smallMax']) ?>"></label>
        <label>Limite médio<input type="number" name="medium_max" min="0.1" max="0.95" step="0.01" value="<?= miu_v2_admin_h($config['thresholds']['mediumMax']) ?>"></label>
        <label>Peso da velocidade<input type="number" name="velocity_weight" min="0" max="0.3" step="0.001" value="<?= miu_v2_admin_h($config['thresholds']['velocityWeight']) ?>"></label>
      </div>
    </fieldset>

    <fieldset>
      <legend>Animações por papel</legend>
      <div class="miu-v2-admin__grid miu-v2-admin__grid--animations">
        <?php foreach (array(
            'attention' => 'Entrada em atenção', 'trackingUp' => 'Acompanhar subida', 'trackingDown' => 'Acompanhar descida',
            'upSmall' => 'Subida pequena', 'upMedium' => 'Subida média', 'upLarge' => 'Subida grande',
            'downSmall' => 'Descida pequena', 'downMedium' => 'Descida média', 'downLarge' => 'Descida grande',
            'recovery' => 'Recuperação', 'rejoice' => 'Rejoice',
        ) as $key => $label): ?>
          <label><?= miu_v2_admin_h($label) ?><?php miu_v2_admin_animation_select('animation_' . $key, $config['animations'][$key], $animationIds); ?></label>
        <?php endforeach; ?>
      </div>
      <div class="miu-v2-admin__idle-weights">
        <?php foreach ($config['animations']['idle'] as $index => $idle): ?>
          <label><span><?= miu_v2_admin_h($idle['id']) ?></span><input type="number" name="idle_weight_<?= (int)$index ?>" min="0.05" max="100" step="0.05" value="<?= miu_v2_admin_h($idle['weight']) ?>"></label>
        <?php endforeach; ?>
      </div>
    </fieldset>

    <fieldset>
      <legend>Gatilhos</legend>
      <div class="miu-v2-admin__checks">
        <label><input type="checkbox" name="trigger_quantity" value="1" <?= $config['triggers']['quantity'] ? 'checked' : '' ?>> Alterações contínuas de quantidade</label>
        <label><input type="checkbox" name="trigger_packs" value="1" <?= $config['triggers']['packs'] ? 'checked' : '' ?>> Escolha de packs</label>
        <label><input type="checkbox" name="trigger_continue" value="1" <?= $config['triggers']['continueRejoice'] ? 'checked' : '' ?>> Rejoice ao concluir o passo configurado</label>
        <label><input type="checkbox" name="trigger_launcher" value="1" <?= $config['triggers']['launcherAttention'] ? 'checked' : '' ?>> Atenção ao passar pelo launcher</label>
        <label><input type="checkbox" name="trigger_chat" value="1" <?= $config['triggers']['chatReactions'] ? 'checked' : '' ?>> Reacções ao chat</label>
      </div>
      <label>IDs de passo que celebram ao continuar<input type="text" name="continue_step_ids" value="<?= miu_v2_admin_h(implode(', ', $config['triggers']['continueStepIds'])) ?>"></label>
    </fieldset>

    <fieldset>
      <legend>Biblioteca expressiva e episódios</legend>
      <div class="miu-v2-admin__checks">
        <label><input type="checkbox" name="manual_emotions" value="1" <?= $config['library']['manualEmotions'] ? 'checked' : '' ?>> Permitir <code>miu.setMood()</code></label>
        <label><input type="checkbox" name="manual_episodes" value="1" <?= $config['library']['manualEpisodes'] ? 'checked' : '' ?>> Permitir <code>miu.playEpisode()</code></label>
        <label><input type="checkbox" name="ambient_episodes" value="1" <?= $config['library']['ambientEpisodes'] ? 'checked' : '' ?>> Episódios ambientais automáticos</label>
      </div>
      <p class="miu-v2-admin__hint">Os episódios ambientais começam desligados: cada história carrega a sua folha PNG apenas quando é chamada.</p>
      <div class="miu-v2-admin__grid">
        <label>Intervalo mínimo (ms)<input type="number" name="ambient_min_ms" min="15000" max="1800000" value="<?= (int)$config['library']['ambientMinMs'] ?>"></label>
        <label>Intervalo máximo (ms)<input type="number" name="ambient_max_ms" min="15000" max="3600000" value="<?= (int)$config['library']['ambientMaxMs'] ?>"></label>
        <label>Probabilidade (0–1)<input type="number" name="ambient_probability" min="0" max="1" step="0.01" value="<?= miu_v2_admin_h($config['library']['ambientProbability']) ?>"></label>
      </div>
      <label>IDs de episódios<textarea name="episode_ids" rows="5"><?= miu_v2_admin_h(implode("\n", $config['library']['episodeIds'])) ?></textarea></label>
    </fieldset>

    <fieldset>
      <legend>Reduced motion e diagnóstico</legend>
      <div class="miu-v2-admin__checks">
        <label><input type="checkbox" name="reduced_enabled" value="1" <?= $config['reducedMotion']['enabled'] ? 'checked' : '' ?>> Respeitar <code>prefers-reduced-motion</code></label>
        <label><input type="checkbox" name="reduced_keep_emotion" value="1" <?= $config['reducedMotion']['keepEmotion'] ? 'checked' : '' ?>> Manter informação emocional</label>
        <label><input type="checkbox" name="debug_console" value="1" <?= $config['debug']['console'] ? 'checked' : '' ?>> Log técnico na consola</label>
      </div>
      <label>Movimento secundário em reduced motion<input type="number" name="reduced_secondary_motion" min="0" max="0.25" step="0.01" value="<?= miu_v2_admin_h($config['reducedMotion']['secondaryMotion']) ?>"></label>
    </fieldset>

    <button class="miu-v2-admin__primary" type="submit">Guardar afinações</button>
  </form>

  <section class="miu-admin-card" aria-labelledby="miu-v2-json-title">
    <header class="miu-admin-card__head"><div><h2 id="miu-v2-json-title">Configuração avançada integral</h2><p>Permite alterar todos os parâmetros do contrato. O servidor limpa caminhos, IDs, limites e tipos antes de gravar.</p></div></header>
    <form method="post">
      <input type="hidden" name="csrf" value="<?= miu_v2_admin_h($csrf) ?>">
      <input type="hidden" name="action" value="save_json">
      <textarea class="miu-v2-admin__json" name="config_json" rows="34" spellcheck="false"><?= miu_v2_admin_h($configJson) ?></textarea>
      <button type="submit">Validar e guardar JSON</button>
    </form>
  </section>

  <section class="miu-admin-card" aria-labelledby="miu-v2-recovery-title">
    <header class="miu-admin-card__head"><div><h2 id="miu-v2-recovery-title">Reversão e arquivo</h2><p>O plano, inventário, comandos e critérios de validação estão documentados fora da raiz pública.</p></div></header>
    <ul>
      <li>Rollback instantâneo: botão <strong>Voltar ao V1</strong> no topo.</li>
      <li>Checkpoint Git anterior: <code>469d9f2</code>.</li>
      <li>Arquivo protegido: <code>protected/miu-v1-checkpoint-469d9f2/</code>.</li>
      <li>Plano completo: <code>docs/13-miu-v2-producao.md</code>.</li>
    </ul>
    <form method="post" data-confirm-defaults>
      <input type="hidden" name="csrf" value="<?= miu_v2_admin_h($csrf) ?>">
      <input type="hidden" name="action" value="restore_defaults">
      <button type="submit">Repor parâmetros V2 de origem</button>
    </form>
  </section>
</main>

<script>
(function () {
  'use strict';
  var demo = document.querySelector('[data-miu-v2-demo]');
  var debug = document.querySelector('[data-demo-debug]');
  if (demo) {
    demo.addEventListener('click', function (event) {
      var button = event.target.closest('[data-demo-action]');
      if (!button || !window.miu) return;
      var action = button.getAttribute('data-demo-action');
      var previous = Number(demo.querySelector('[data-demo-previous]').value);
      var current = Number(demo.querySelector('[data-demo-current]').value);
      var maximum = Number(demo.querySelector('[data-demo-max]').value);
      if (action === 'quantity') window.miu.updateQuantityReaction({ previousValue: previous, value: current, min: 0, max: maximum, source: 'admin-demo', end: true });
      if (action === 'rejoice') window.miu.playOneShot('rejoice');
      if (action === 'happy') window.miu.setMood('happiness', 0.72);
      if (action === 'sad') window.miu.setMood('sadness', 0.68);
      if (action === 'butterfly') window.miu.playEpisode('s01e01-borboleta-no-nariz');
      if (action === 'reset') window.miu.reset();
    });
  }
  document.addEventListener('mia:miu-v2-state', function (event) {
    if (debug) debug.textContent = JSON.stringify(event.detail, null, 2);
  });
  window.setInterval(function () {
    if (debug && window.miu && typeof window.miu.debug === 'function') debug.textContent = JSON.stringify(window.miu.debug(), null, 2);
  }, 500);
  var defaults = document.querySelector('[data-confirm-defaults]');
  if (defaults) defaults.addEventListener('submit', function (event) {
    if (!window.confirm('Repor todos os parâmetros V2 de origem? O arquivo V1 não é alterado.')) event.preventDefault();
  });
}());
</script>
</body>
</html>