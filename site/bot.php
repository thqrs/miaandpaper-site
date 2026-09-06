<?php
/**
 * BOT_ADMIN_V1 — painel de conversas e configuração do Míu.
 *
 * A página usa o guard central, CSRF e a base private/miu.sqlite. As chaves
 * nunca são recebidas nem mostradas aqui; configuram-se fora da raiz pública.
 */

require_once __DIR__ . '/admin-open.php';

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
        . '<title>Acesso negado · Míu</title><h1>Acesso restrito.</h1>'
        . '<p>Inicia sessão como administradora a partir do site e regressa a esta página.</p>';
    exit;
}

require_once __DIR__ . '/lib/miu-bot.php';
require_once __DIR__ . '/lib/miu-animations.php';
require_once __DIR__ . '/lib/parametros.php';

function bot_h($value)
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function bot_int($value, $minimum, $maximum, $fallback)
{
    $value = filter_var($value, FILTER_VALIDATE_INT);
    if ($value === false) {
        return (int)$fallback;
    }
    return max((int)$minimum, min((int)$maximum, (int)$value));
}

function bot_model($value, $fallback)
{
    $value = trim((string)$value);
    return $value !== '' && preg_match('/^[a-z0-9._:\/-]{2,160}$/i', $value) ? $value : $fallback;
}

function bot_local_date($value)
{
    try {
        $date = new DateTime((string)$value, new DateTimeZone('UTC'));
        $date->setTimezone(new DateTimeZone('Europe/Lisbon'));
        return $date->format('d/m/Y H:i:s');
    } catch (Exception $e) {
        return (string)$value;
    }
}


/**
 * Spritesheets soltas para testes rápidos no painel do Míu.
 *
 * A pasta é deliberadamente separada da biblioteca activa de animações:
 * colocar aqui um WebP/PNG nunca altera animations.json nem o site público.
 * O nome pode incluir "4x2", "8x1", etc. para pré-preencher a grelha.
 */
function bot_miu_test_sprites()
{
    $directory = __DIR__ . '/content/brand/miu/test-sprites';
    if (!is_dir($directory)) {
        return array();
    }

    $entries = scandir($directory);
    if (!is_array($entries)) {
        return array();
    }

    $sprites = array();
    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..' || $entry === '' || $entry[0] === '.') {
            continue;
        }
        $extension = strtolower((string)pathinfo($entry, PATHINFO_EXTENSION));
        if (!in_array($extension, array('webp', 'png'), true)) {
            continue;
        }

        $path = $directory . DIRECTORY_SEPARATOR . $entry;
        if (!is_file($path)) {
            continue;
        }

        $columns = 4;
        $rows = 2;
        if (preg_match('/(?:^|[-_])([1-9][0-9]?)x([1-9][0-9]?)(?:[-_.]|$)/i', $entry, $matches)) {
            $columns = min(16, max(1, (int)$matches[1]));
            $rows = min(16, max(1, (int)$matches[2]));
        }

        $width = 0;
        $height = 0;
        $size = @getimagesize($path);
        if (is_array($size)) {
            $width = isset($size[0]) ? (int)$size[0] : 0;
            $height = isset($size[1]) ? (int)$size[1] : 0;
        }

        $sprites[] = array(
            'name' => $entry,
            'url' => 'content/brand/miu/test-sprites/' . rawurlencode($entry),
            'columns' => $columns,
            'rows' => $rows,
            'width' => $width,
            'height' => $height,
        );
    }

    usort($sprites, function ($a, $b) {
        return strnatcasecmp($a['name'], $b['name']);
    });
    return $sprites;
}

$csrf = mp_admin_csrf_token();
$notice = isset($_GET['notice']) ? (string)$_GET['notice'] : '';
$settingsError = isset($_SESSION['miu_settings_error']) ? (string)$_SESSION['miu_settings_error'] : '';
unset($_SESSION['miu_settings_error']);
$animationError = isset($_SESSION['miu_animation_error']) ? (string)$_SESSION['miu_animation_error'] : '';
unset($_SESSION['miu_animation_error']);
$allowedTabs = array('conversations', 'settings', 'appearance', 'contexts', 'replies', 'animations');
$tab = isset($_GET['tab']) && in_array($_GET['tab'], $allowedTabs, true) ? (string)$_GET['tab'] : 'conversations';

if (isset($_SERVER['REQUEST_METHOD']) && strtoupper((string)$_SERVER['REQUEST_METHOD']) === 'POST') {
    $sentCsrf = isset($_POST['csrf']) ? (string)$_POST['csrf'] : '';
    if (!mp_admin_csrf_is_valid($sentCsrf)) {
        http_response_code(403);
        exit('Pedido recusado: token CSRF inválido.');
    }
    $action = isset($_POST['action']) ? (string)$_POST['action'] : '';
    if ($action === 'save_settings') {
        try {
            $current = miu_settings();
            $provider = isset($_POST['provider']) && $_POST['provider'] === 'gemini' ? 'gemini' : 'openrouter';
            miu_save_settings(array(
                'enabled' => !empty($_POST['enabled']) ? '1' : '0',
                'name' => trim(miu_text_slice(isset($_POST['name']) ? $_POST['name'] : 'Míu', 40)),
                'greeting' => trim(miu_text_slice(isset($_POST['greeting']) ? $_POST['greeting'] : 'Olá! Em que posso ajudar?', 160)),
                'launcher_prompt' => trim(miu_text_slice(isset($_POST['launcher_prompt']) ? $_POST['launcher_prompt'] : '', 60)),
                'provider' => $provider,
                'fallback_enabled' => !empty($_POST['fallback_enabled']) ? '1' : '0',
                'openrouter_model' => bot_model(isset($_POST['openrouter_model']) ? $_POST['openrouter_model'] : '', $current['openrouter_model']),
                'gemini_model' => bot_model(isset($_POST['gemini_model']) ? $_POST['gemini_model'] : '', $current['gemini_model']),
                'max_message_chars' => (string)bot_int(isset($_POST['max_message_chars']) ? $_POST['max_message_chars'] : 800, 200, 2000, 800),
                'max_conversation_turns' => (string)bot_int(isset($_POST['max_conversation_turns']) ? $_POST['max_conversation_turns'] : 20, 4, 30, 20),
                'rate_per_minute' => (string)bot_int(isset($_POST['rate_per_minute']) ? $_POST['rate_per_minute'] : 6, 2, 30, 6),
                'rate_per_hour' => (string)bot_int(isset($_POST['rate_per_hour']) ? $_POST['rate_per_hour'] : 40, 10, 300, 40),
                'max_output_tokens' => (string)bot_int(isset($_POST['max_output_tokens']) ? $_POST['max_output_tokens'] : 220, 100, 1000, 220),
                'system_prompt' => trim(miu_text_slice(isset($_POST['system_prompt']) ? $_POST['system_prompt'] : '', 20000)),
                'knowledge_base' => trim(miu_text_slice(isset($_POST['knowledge_base']) ? $_POST['knowledge_base'] : '', 50000)),
            ));
            header('Location: bot.php?tab=settings&notice=saved');
            exit;
        } catch (Exception $e) {
            $_SESSION['miu_settings_error'] = 'Não foi possível guardar as definições do Míu. O ficheiro anterior foi mantido. (' . $e->getMessage() . ')';
            header('Location: bot.php?tab=settings&notice=save-failed');
            exit;
        }
    }
    if ($action === 'save_context') {
        $contextKey = isset($_POST['context_key']) ? trim((string)$_POST['context_key']) : '';
        miu_context_save(
            $contextKey,
            isset($_POST['objectives']) ? $_POST['objectives'] : '',
            !empty($_POST['include_pricing'])
        );
        header('Location: bot.php?tab=contexts&notice=context-saved');
        exit;
    }
    if ($action === 'delete_conversation') {
        $deleteId = bot_int(isset($_POST['conversation_id']) ? $_POST['conversation_id'] : 0, 1, PHP_INT_MAX, 0);
        if ($deleteId > 0) {
            miu_admin_delete_conversation($deleteId);
        }
        header('Location: bot.php?tab=conversations&notice=deleted');
        exit;
    }
    if ($action === 'save_appearance') {
        try {
            miu_animation_save_appearance_from_request($_POST);
            header('Location: bot.php?tab=appearance&notice=appearance-saved');
            exit;
        } catch (Exception $e) {
            $_SESSION['miu_animation_error'] = $e->getMessage();
            header('Location: bot.php?tab=appearance&notice=appearance-error');
            exit;
        }
    }
    if (in_array($action, array('save_animation_display', 'create_animation', 'update_animation', 'delete_animation'), true)) {
        try {
            if ($action === 'save_animation_display') {
                miu_animation_save_display_from_request($_POST);
                $animationNotice = 'animations-saved';
            } elseif ($action === 'create_animation') {
                miu_animation_create_from_request($_POST, $_FILES);
                $animationNotice = 'animation-created';
            } elseif ($action === 'update_animation') {
                miu_animation_update_from_request($_POST, $_FILES);
                $animationNotice = 'animation-saved';
            } else {
                miu_animation_delete_by_id(isset($_POST['animation_id']) ? $_POST['animation_id'] : '');
                $animationNotice = 'animation-deleted';
            }
            header('Location: bot.php?tab=animations&notice=' . rawurlencode($animationNotice));
            exit;
        } catch (Exception $e) {
            $_SESSION['miu_animation_error'] = $e->getMessage();
            header('Location: bot.php?tab=animations&notice=animation-error');
            exit;
        }
    }
    http_response_code(400);
    exit('Acção desconhecida.');
}

miu_context_sync_all();
$settings = miu_settings();
$secrets = miu_secret_config();
$stats = miu_admin_stats();
$page = bot_int(isset($_GET['page']) ? $_GET['page'] : 1, 1, 100000, 1);
$detailId = bot_int(isset($_GET['id']) ? $_GET['id'] : 0, 0, PHP_INT_MAX, 0);
$perPage = 30;
$pageCount = max(1, (int)ceil($stats['conversations'] / $perPage));
$page = min($page, $pageCount);
$conversations = miu_admin_conversations($page, $perPage);
$detail = $detailId > 0 ? miu_admin_conversation($detailId) : null;
$contextRows = $tab === 'contexts' ? miu_context_admin_rows() : array();
$animationConfig = in_array($tab, array('animations', 'appearance'), true) ? miu_animation_config() : null;
$animationTriggers = $tab === 'animations' ? miu_animation_trigger_options() : array();
$animationMotions = $tab === 'animations' ? miu_animation_motion_options() : array();
$miuTestSprites = bot_miu_test_sprites();
$quickReplyCatalog = miu_quick_reply_catalog();
$quickReplyGlobal = isset($quickReplyCatalog['global']) && is_array($quickReplyCatalog['global']) ? $quickReplyCatalog['global'] : array();
$quickReplyContexts = isset($quickReplyCatalog['contexts']) && is_array($quickReplyCatalog['contexts']) ? $quickReplyCatalog['contexts'] : array();
$quickReplyIntents = isset($quickReplyCatalog['intents']) && is_array($quickReplyCatalog['intents']) ? $quickReplyCatalog['intents'] : array();
$quickReplyCount = isset($quickReplyGlobal['items']) && is_array($quickReplyGlobal['items']) ? count($quickReplyGlobal['items']) : 0;
$quickReplyProductGroups = array();
foreach ($quickReplyContexts as $contextKey => $quickReplyContext) {
    $contextItems = isset($quickReplyContext['items']) && is_array($quickReplyContext['items']) ? $quickReplyContext['items'] : array();
    $quickReplyCount += count($contextItems);
    $productGroupKey = (isset($quickReplyContext['scope']) ? $quickReplyContext['scope'] : '')
        . ':' . (isset($quickReplyContext['productSlug']) ? $quickReplyContext['productSlug'] : '');
    if (!isset($quickReplyProductGroups[$productGroupKey])) {
        $quickReplyProductGroups[$productGroupKey] = array(
            'scope' => isset($quickReplyContext['scope']) ? $quickReplyContext['scope'] : '',
            'product_slug' => isset($quickReplyContext['productSlug']) ? $quickReplyContext['productSlug'] : '',
            'product_name' => isset($quickReplyContext['productName']) ? $quickReplyContext['productName'] : '',
            'reply_count' => 0,
            'contexts' => array(),
        );
    }
    $quickReplyProductGroups[$productGroupKey]['reply_count'] += count($contextItems);
    $quickReplyProductGroups[$productGroupKey]['contexts'][$contextKey] = $quickReplyContext;
}
$contextGroups = array();
foreach ($contextRows as $contextRow) {
    $groupKey = $contextRow['scope'] . ':' . $contextRow['product_slug'];
    if (!isset($contextGroups[$groupKey])) {
        $contextGroups[$groupKey] = array(
            'scope' => $contextRow['scope'],
            'product_slug' => $contextRow['product_slug'],
            'product_name' => $contextRow['product_name'],
            'rows' => array(),
        );
    }
    $contextGroups[$groupKey]['rows'][] = $contextRow;
}
?>
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Míu · Conversas e configuração | Mia &amp; Paper</title>
  <link rel="stylesheet" href="css/01-tokens-agua.css?v=20260906225352">
  <link rel="stylesheet" href="admin-nav.css?v=20260906225352">
  <link rel="stylesheet" href="bot-admin.css?v=2026081501">
  <link rel="stylesheet" href="css/13-miu.css?v=20260906225352">
  <script src="admin-nav.js?v=20260906225352" defer></script>
  <script src="bot-admin.js?v=2026081501" defer></script>
  <script src="js/24-miu.js?v=20260906225352" defer></script>
</head>
<body class="miu-admin-body" data-miu-admin-chat="1">
<?= mp_parametros_barra('bot.php') ?>

<aside class="miu-debug-dock" data-miu-debug-panel aria-label="Laboratório rápido de animações do Míu">
  <header class="miu-debug-dock__head">
    <div><strong>Laboratório Míu</strong><small>Testes locais</small></div>
    <button type="button" data-miu-debug-toggle aria-expanded="true" title="Recolher painel">−</button>
  </header>
  <div class="miu-debug-dock__body" data-miu-debug-body>
    <section>
      <h2>Cara do chat</h2>
      <div class="miu-debug-buttons" data-miu-debug-face-buttons>
        <span class="miu-debug-loading">A carregar…</span>
      </div>
    </section>

    <section>
      <h2>Animações de corpo inteiro</h2>
      <div class="miu-debug-buttons" data-miu-debug-interactive-buttons>
        <span class="miu-debug-loading">A carregar…</span>
      </div>
    </section>

    <section class="miu-debug-sprite-lab">
      <h2>Sprites à toa</h2>
      <p>Coloca <code>.webp</code> ou <code>.png</code> em <code>content/brand/miu/test-sprites/</code> e recarrega esta página. Se o nome tiver <code>4x2</code>, <code>8x1</code>, etc., a grelha é detectada automaticamente.</p>
      <?php if (!$miuTestSprites): ?>
        <div class="miu-debug-empty">A pasta está vazia.</div>
      <?php else: ?>
        <div class="miu-debug-lab-list">
          <?php foreach ($miuTestSprites as $sprite): ?>
          <div class="miu-debug-lab-row" data-miu-debug-lab-row>
            <div class="miu-debug-lab-name">
              <strong title="<?= bot_h($sprite['name']) ?>"><?= bot_h($sprite['name']) ?></strong>
              <?php if ($sprite['width'] > 0 && $sprite['height'] > 0): ?><small><?= (int)$sprite['width'] ?>×<?= (int)$sprite['height'] ?> px</small><?php endif; ?>
            </div>
            <div class="miu-debug-lab-fields">
              <label title="Colunas"><span>C</span><input type="number" min="1" max="16" value="<?= (int)$sprite['columns'] ?>" data-miu-debug-cols></label>
              <label title="Linhas"><span>L</span><input type="number" min="1" max="16" value="<?= (int)$sprite['rows'] ?>" data-miu-debug-rows></label>
              <label title="Milissegundos por frame"><span>ms</span><input type="number" min="40" max="5000" step="10" value="180" data-miu-debug-ms></label>
            </div>
            <button class="miu-debug-play" type="button" data-miu-debug-lab-play data-sheet-url="<?= bot_h($sprite['url']) ?>">▶ Testar</button>
          </div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </section>

    <div class="miu-debug-dock__actions">
      <button type="button" data-miu-debug-stop>■ Parar / base</button>
      <button type="button" data-miu-debug-reload>↻ Recarregar ficheiros</button>
    </div>
    <p class="miu-debug-status" data-miu-debug-status aria-live="polite"></p>
  </div>
</aside>
<main class="miu-admin-shell">
  <header class="miu-admin-header">
    <div>
      <h1>Míu</h1>
      <p>Conversas, comportamento, imagem, animações e informação enviada à IA.</p>
    </div>
    <code class="miu-admin-path">private/miu.sqlite</code>
  </header>

  <nav class="miu-admin-tabs" aria-label="Áreas do Míu">
    <a class="<?= $tab === 'conversations' ? 'is-active' : '' ?>" href="bot.php?tab=conversations">Conversas</a>
    <a class="<?= $tab === 'settings' ? 'is-active' : '' ?>" href="bot.php?tab=settings">Configuração</a>
    <a class="<?= $tab === 'appearance' ? 'is-active' : '' ?>" href="bot.php?tab=appearance">Aparência</a>
    <a class="<?= $tab === 'contexts' ? 'is-active' : '' ?>" href="bot.php?tab=contexts">Contexto por passo</a>
    <a class="<?= $tab === 'replies' ? 'is-active' : '' ?>" href="bot.php?tab=replies">Respostas rápidas</a>
    <a class="<?= $tab === 'animations' ? 'is-active' : '' ?>" href="bot.php?tab=animations">Imagem e animações</a>
  </nav>

  <?php if ($notice === 'saved'): ?><p class="miu-admin-flash">Configuração guardada.</p><?php endif; ?>
  <?php if ($notice === 'save-failed'): ?><p class="miu-admin-flash miu-admin-flash--error"><?= bot_h($settingsError !== '' ? $settingsError : 'Não foi possível guardar as definições do Míu. O ficheiro anterior foi mantido.') ?></p><?php endif; ?>
  <?php if ($notice === 'context-saved'): ?><p class="miu-admin-flash">Contexto do passo guardado.</p><?php endif; ?>
  <?php if ($notice === 'deleted'): ?><p class="miu-admin-flash">Conversa apagada.</p><?php endif; ?>
  <?php if ($notice === 'appearance-saved'): ?><p class="miu-admin-flash">Aparência do Míu guardada.</p><?php endif; ?>
  <?php if ($notice === 'animations-saved'): ?><p class="miu-admin-flash">Comportamento visual do Míu guardado.</p><?php endif; ?>
  <?php if ($notice === 'animation-created'): ?><p class="miu-admin-flash">Animação adicionada.</p><?php endif; ?>
  <?php if ($notice === 'animation-saved'): ?><p class="miu-admin-flash">Animação actualizada.</p><?php endif; ?>
  <?php if ($notice === 'animation-deleted'): ?><p class="miu-admin-flash">Animação apagada.</p><?php endif; ?>
  <?php if ($animationError !== ''): ?><p class="miu-admin-flash miu-admin-flash--error"><?= bot_h($animationError) ?></p><?php endif; ?>

  <?php if ($tab === 'conversations'): ?>
  <section class="miu-admin-grid" aria-label="Resumo">
    <div class="miu-stat"><span>Conversas</span><strong><?= (int)$stats['conversations'] ?></strong></div>
    <div class="miu-stat"><span>Hoje</span><strong><?= (int)$stats['today'] ?></strong></div>
    <div class="miu-stat"><span>Mensagens aceites</span><strong><?= (int)$stats['messages'] ?></strong></div>
    <div class="miu-stat"><span>Bloqueadas</span><strong><?= (int)$stats['blocked'] ?></strong></div>
  </section>
  <?php endif; ?>

  <?php if ($tab === 'settings'): ?>
  <section class="miu-admin-card" aria-labelledby="miu-settings-title">
    <header class="miu-admin-card__head">
      <div><h2 id="miu-settings-title">Configuração</h2><p>As alterações aplicam-se à mensagem seguinte.</p></div>
      <span class="miu-badge <?= $settings['enabled'] === '1' ? 'is-ready' : 'is-blocked' ?>"><?= $settings['enabled'] === '1' ? 'Míu activo' : 'Míu fechado' ?></span>
    </header>
    <form class="miu-admin-card__body" method="post" action="bot.php">
      <input type="hidden" name="csrf" value="<?= bot_h($csrf) ?>">
      <input type="hidden" name="action" value="save_settings">
      <div class="miu-settings-grid">
        <div class="miu-json-note miu-settings-span"><strong>Fonte única da configuração</strong><p>Estas definições são guardadas diretamente em <code>site/content/miu-defaults.json</code>, que é a fonte única da configuração global do Míu. O ficheiro faz parte do código do projeto e será incluído no futuro deploy.</p></div>
        <label class="miu-check">
          <input type="checkbox" name="enabled" value="1" <?= $settings['enabled'] === '1' ? 'checked' : '' ?>>
          <span><strong>Mostrar o Míu no site</strong><small>Quando está fechado, o botão não aparece e a API recusa mensagens.</small></span>
        </label>
        <label class="miu-check">
          <input type="checkbox" name="fallback_enabled" value="1" <?= $settings['fallback_enabled'] === '1' ? 'checked' : '' ?>>
          <span><strong>Usar o outro fornecedor como alternativa</strong><small>Só tenta o segundo quando o primeiro falha e a respectiva chave existe.</small></span>
        </label>

        <label class="miu-field"><span>Nome</span><input type="text" name="name" maxlength="40" value="<?= bot_h($settings['name']) ?>"></label>
        <label class="miu-field"><span>Primeira pergunta</span><input type="text" name="greeting" maxlength="160" value="<?= bot_h($settings['greeting']) ?>"></label>
        <label class="miu-field"><span>Balão junto ao botão</span><input type="text" name="launcher_prompt" maxlength="60" value="<?= bot_h($settings['launcher_prompt']) ?>"><small>Por omissão: “Fala comigo!”. Deixar vazio para esconder.</small></label>

        <div class="miu-field">
          <span>Fornecedor principal</span>
          <select name="provider"><option value="openrouter" <?= $settings['provider'] === 'openrouter' ? 'selected' : '' ?>>OpenRouter</option><option value="gemini" <?= $settings['provider'] === 'gemini' ? 'selected' : '' ?>>Gemini</option></select>
          <div class="miu-key-status">
            <span class="miu-badge <?= miu_provider_is_configured('openrouter', $secrets) ? 'is-ready' : 'is-blocked' ?>">OpenRouter: <?= miu_provider_is_configured('openrouter', $secrets) ? 'chave pronta' : 'sem chave' ?></span>
            <span class="miu-badge <?= miu_provider_is_configured('gemini', $secrets) ? 'is-ready' : 'is-blocked' ?>">Gemini: <?= miu_provider_is_configured('gemini', $secrets) ? 'chave pronta' : 'sem chave' ?></span>
          </div>
        </div>
        <label class="miu-field"><span>Modelo OpenRouter</span><input type="text" name="openrouter_model" maxlength="160" value="<?= bot_h($settings['openrouter_model']) ?>"><small>Para o router gratuito: <code>openrouter/free</code>.</small></label>
        <label class="miu-field"><span>Modelo Gemini</span><input type="text" name="gemini_model" maxlength="160" value="<?= bot_h($settings['gemini_model']) ?>"><small>O nome é editável sem alterar PHP.</small></label>
        <label class="miu-field"><span>Máximo da resposta, em tokens</span><input type="number" name="max_output_tokens" min="100" max="1000" value="<?= (int)$settings['max_output_tokens'] ?>"></label>

        <label class="miu-field"><span>Caracteres por mensagem</span><input type="number" name="max_message_chars" min="200" max="2000" value="<?= (int)$settings['max_message_chars'] ?>"></label>
        <label class="miu-field"><span>Perguntas por conversa</span><input type="number" name="max_conversation_turns" min="4" max="30" value="<?= (int)$settings['max_conversation_turns'] ?>"></label>
        <label class="miu-field"><span>Pedidos por IP / minuto</span><input type="number" name="rate_per_minute" min="2" max="30" value="<?= (int)$settings['rate_per_minute'] ?>"></label>
        <label class="miu-field"><span>Pedidos por IP / hora</span><input type="number" name="rate_per_hour" min="10" max="300" value="<?= (int)$settings['rate_per_hour'] ?>"></label>

        <div class="miu-json-note miu-settings-span"><strong>Perguntas e respostas predefinidas</strong><p>São geridas em <code>content/miu-quick-replies.json</code> e podem ser revistas na TAB <a href="bot.php?tab=replies">Respostas rápidas</a>.</p></div>
        <label class="miu-field miu-settings-span"><span>System prompt</span><textarea class="miu-field--prompt" name="system_prompt" maxlength="20000" data-max-count="20000"><?= bot_h($settings['system_prompt']) ?></textarea><small>Define o papel, o tom, os limites e a forma dos links.</small><span class="miu-char-count" data-char-count></span></label>
        <label class="miu-field miu-settings-span"><span>Base de informação enviada à API</span><textarea class="miu-field--knowledge" name="knowledge_base" maxlength="50000" data-max-count="50000"><?= bot_h($settings['knowledge_base']) ?></textarea><small>É anexada à system prompt em todas as respostas. Não incluir segredos nem dados de clientes.</small><span class="miu-char-count" data-char-count></span></label>
      </div>
      <div class="miu-admin-actions"><button class="miu-button" type="submit">Guardar configuração</button></div>
    </form>
  </section>
  <?php endif; ?>

  <?php if ($tab === 'appearance' && $animationConfig): ?>
  <section class="miu-admin-card" aria-labelledby="miu-appearance-title">
    <header class="miu-admin-card__head"><div><h2 id="miu-appearance-title">Aparência do Míu</h2><p>Configura separadamente a cara na barra do chat, o avatar das respostas e o Míu do canto inferior direito.</p></div></header>
    <form class="miu-admin-card__body" method="post" action="bot.php?tab=appearance">
      <input type="hidden" name="csrf" value="<?= bot_h($csrf) ?>">
      <input type="hidden" name="action" value="save_appearance">
      <div class="miu-settings-grid">
        <label class="miu-field"><span>Míu principal no canto — Desktop</span><input type="number" name="launcher_px" min="24" max="120" value="<?= (int)$animationConfig['display']['launcherPx'] ?>"><small>Escala a cara no balão ou o corpo inteiro na alcofinha, conforme o tipo escolhido.</small></label>
        <label class="miu-field"><span>Míu principal no canto — Mobile</span><input type="number" name="launcher_px_mobile" min="24" max="120" value="<?= (int)$animationConfig['display']['launcherPxMobile'] ?>"><small>Aplicado até 520 px de largura.</small></label>
        <div class="miu-settings-span miu-launcher-mode-settings" role="group" aria-label="Tipo do Míu principal no canto inferior direito">
          <span class="miu-launcher-mode-settings__title">Tipo do Míu principal</span>
          <div class="miu-launcher-mode-settings__choices">
            <label class="miu-toggle"><input type="checkbox" name="launcher_mode_circle" value="1" data-miu-launcher-mode="circle" <?= $animationConfig['display']['launcherMode'] === 'circle' ? 'checked' : '' ?>><span><strong>Cara no balão</strong><small>Usa a cara animada recortada dentro de um balão circular em outline, com a ponta virada para a direita.</small></span></label>
            <label class="miu-toggle"><input type="checkbox" name="launcher_mode_basket" value="1" data-miu-launcher-mode="basket" <?= $animationConfig['display']['launcherMode'] === 'basket' ? 'checked' : '' ?>><span><strong>Corpo inteiro na alcofinha</strong><small>Troca o balão pela animação de corpo inteiro pousada dentro da alcofinha.</small></span></label>
          </div>
        </div>
        <label class="miu-field"><span>Míu na barra do chat — Desktop</span><input type="number" name="header_px" min="16" max="120" value="<?= (int)$animationConfig['display']['headerPx'] ?>"></label>
        <label class="miu-field"><span>Míu na barra do chat — Mobile</span><input type="number" name="header_px_mobile" min="16" max="120" value="<?= (int)$animationConfig['display']['headerPxMobile'] ?>"><small>Aplicado até 520 px de largura.</small></label>
        <label class="miu-toggle miu-settings-span"><input type="checkbox" name="header_visible" value="1" <?= $animationConfig['display']['headerVisible'] ? 'checked' : '' ?>><span><strong>Mostrar Míu na barra do chat</strong><small>Desmarca para esconder completamente a mascote da barra de cima.</small></span></label>
        <label class="miu-toggle miu-settings-span"><input type="checkbox" name="header_circle" value="1" <?= $animationConfig['display']['headerCircle'] ? 'checked' : '' ?>><span>Mostrar círculo no Míu da barra do chat</span></label>
        <label class="miu-field"><span>Míu após as respostas — Desktop</span><input type="number" name="message_px" min="16" max="80" value="<?= (int)$animationConfig['display']['messagePx'] ?>"></label>
        <label class="miu-field"><span>Míu após as respostas — Mobile</span><input type="number" name="message_px_mobile" min="16" max="80" value="<?= (int)$animationConfig['display']['messagePxMobile'] ?>"></label>
        <label class="miu-toggle miu-settings-span"><input type="checkbox" name="message_circle" value="1" <?= $animationConfig['display']['messageCircle'] ? 'checked' : '' ?>><span>Mostrar círculo nos avatares das respostas</span></label>
        <label class="miu-field"><span>Míu interactivo de corpo inteiro — Desktop</span><input type="number" name="interactive_px" min="48" max="240" value="<?= (int)$animationConfig['display']['interactivePx'] ?>"><small>Usado nas animações que podem sair do círculo ao entrar nos produtos.</small></label>
        <label class="miu-field"><span>Míu interactivo de corpo inteiro — Mobile</span><input type="number" name="interactive_px_mobile" min="48" max="240" value="<?= (int)$animationConfig['display']['interactivePxMobile'] ?>"></label>
        <label class="miu-field"><span>Mostrar “<?= bot_h($settings['launcher_prompt']) ?>” durante</span><input type="number" name="prompt_seconds" min="0" max="60" value="<?= (int)$animationConfig['display']['promptSeconds'] ?>"><small>Segundos. 0 mantém escondido o balão inicial.</small></label>
        <label class="miu-toggle miu-settings-span"><input type="checkbox" name="errors_via_miu" value="1" <?= $animationConfig['display']['errorsViaMiu'] ? 'checked' : '' ?>><span><strong>O Míu diz os erros e avisos do site</strong><small>Ligado por omissão. Quando está desligado, as mensagens aparecem nos locais normais dos formulários.</small></span></label>
      </div>
      <div class="miu-admin-actions"><button class="miu-button" type="submit">Guardar aparência</button></div>
    </form>
  </section>
  <?php endif; ?>

  <?php if ($tab === 'animations' && $animationConfig): ?>
  <section class="miu-admin-card" aria-labelledby="miu-animations-title">
    <div class="miu-admin-card__head">
      <div><h2 id="miu-animations-title">Imagem e animações</h2><p>As folhas abaixo são a biblioteca do Míu de corpo inteiro para contextos interactivos. O círculo e o chat usam sempre as folhas próprias da cara do Míu (<code>miu-sprite*.webp</code>).</p></div>
      <span class="miu-badge is-ready"><?= count($animationConfig['animations']) ?> animações</span>
    </div>
    <div class="miu-admin-card__body">
      <div class="miu-json-note">
        <strong>Sprites mais leves</strong>
        <p>O Míu aparece normalmente a <?= (int)$animationConfig['display']['launcherPx'] ?> px. Uma folha com frames de <strong>96–128 px</strong> já deixa margem para ecrãs Retina; não precisas dos actuais 192 px por frame. Mantém fundo transparente; WebP é preferível, mas PNG também funciona.</p>
      </div>

      <form class="miu-animation-global" method="post" action="bot.php?tab=animations">
        <input type="hidden" name="csrf" value="<?= bot_h($csrf) ?>">
        <input type="hidden" name="action" value="save_animation_display">
        <div class="miu-settings-grid">
          <label class="miu-field"><span>Animação base</span><select name="base_animation_id"><?php foreach ($animationConfig['animations'] as $animation): ?><option value="<?= bot_h($animation['id']) ?>" <?= $animationConfig['baseAnimationId'] === $animation['id'] ? 'selected' : '' ?>><?= bot_h($animation['name']) ?></option><?php endforeach; ?></select><small>Base guardada para os contextos interactivos de corpo inteiro; não substitui a cara do chat.</small></label>
          <label class="miu-field"><span>Adormecer após</span><input type="number" name="sleep_after_seconds" min="5" max="600" value="<?= (int)round($animationConfig['display']['sleepAfterMs'] / 1000) ?>"><small>Segundos sem interacção. Usa as animações com gatilho “inactividade”.</small></label>
          <label class="miu-field"><span>Acção aleatória: mínimo</span><input type="number" name="idle_random_min_seconds" min="3" max="300" value="<?= (int)round($animationConfig['display']['idleRandomMinMs'] / 1000) ?>"><small>Intervalo mínimo, em segundos, entre tentativas de acções espontâneas.</small></label>
          <label class="miu-field"><span>Acção aleatória: máximo</span><input type="number" name="idle_random_max_seconds" min="3" max="600" value="<?= (int)round($animationConfig['display']['idleRandomMaxMs'] / 1000) ?>"></label>
          <label class="miu-field"><span>Distância máxima que pode vaguear</span><input type="number" name="max_roam_px" min="0" max="800" value="<?= (int)$animationConfig['display']['maxRoamPx'] ?>"><small>Reservado para os contextos interactivos de corpo inteiro; a cara do chat não vagueia.</small></label>
        </div>
        <button class="miu-button" type="submit">Guardar comportamento visual</button>
      </form>

      <div class="miu-animation-heading">
        <div><h3>Animações existentes</h3><p>Cada folha pode reagir a uma ou várias situações.</p></div>
      </div>
      <div class="miu-animation-list">
      <?php foreach ($animationConfig['animations'] as $animation): ?>
        <?php
          $sheetPath = MIU_ANIMATIONS_DIR . '/' . $animation['file'];
          $sheetInfo = @getimagesize($sheetPath);
          $sheetWidth = $sheetInfo ? (int)$sheetInfo[0] : 0;
          $sheetHeight = $sheetInfo ? (int)$sheetInfo[1] : 0;
          $frameWidth = $sheetWidth && $animation['columns'] ? (int)($sheetWidth / $animation['columns']) : 0;
          $frameHeight = $sheetHeight && $animation['rows'] ? (int)($sheetHeight / $animation['rows']) : 0;
          $sheetVersion = is_file($sheetPath) ? (string)filemtime($sheetPath) : '1';
          $sequenceText = implode(',', $animation['sequence']);
          $durationText = implode(',', $animation['frameDurationsMs']);
        ?>
        <article class="miu-animation-card" data-animation-preview-card>
          <header class="miu-animation-card__head">
            <div class="miu-animation-preview-wrap">
              <span class="miu-animation-preview" aria-hidden="true"
                data-animation-preview
                data-sheet="<?= bot_h('content/brand/miu/' . $animation['file'] . '?v=' . $sheetVersion) ?>"
                data-columns="<?= (int)$animation['columns'] ?>"
                data-rows="<?= (int)$animation['rows'] ?>"
                data-sequence="<?= bot_h($sequenceText) ?>"
                data-durations="<?= bot_h($durationText) ?>"
                data-flip="<?= $animation['flipX'] ? '1' : '0' ?>"></span>
            </div>
            <div class="miu-animation-card__title"><h3><?= bot_h($animation['name']) ?></h3><code><?= bot_h($animation['id']) ?></code><p><?= bot_h($animation['file']) ?><?php if ($frameWidth && $frameHeight): ?> · <?= $frameWidth ?>×<?= $frameHeight ?> px/frame<?php endif; ?></p></div>
            <span class="miu-badge <?= $animation['enabled'] ? 'is-ready' : 'is-blocked' ?>"><?= $animation['enabled'] ? 'Activa' : 'Desligada' ?></span>
          </header>
          <form class="miu-animation-form" method="post" enctype="multipart/form-data" action="bot.php?tab=animations">
            <input type="hidden" name="csrf" value="<?= bot_h($csrf) ?>">
            <input type="hidden" name="action" value="update_animation">
            <input type="hidden" name="animation_id" value="<?= bot_h($animation['id']) ?>">
            <div class="miu-settings-grid">
              <label class="miu-field"><span>Nome</span><input type="text" name="animation_name" maxlength="80" value="<?= bot_h($animation['name']) ?>"></label>
              <label class="miu-field"><span>Substituir spritesheet</span><input type="file" name="sheet" accept="image/webp,image/png,.webp,.png"><small>Opcional. Se não escolheres ficheiro, mantém o actual.</small></label>
              <label class="miu-field"><span>Colunas</span><input type="number" name="columns" min="1" max="16" value="<?= (int)$animation['columns'] ?>"></label>
              <label class="miu-field"><span>Linhas</span><input type="number" name="rows" min="1" max="16" value="<?= (int)$animation['rows'] ?>"></label>
            </div>
            <fieldset class="miu-animation-triggers"><legend>Quando pode acontecer</legend><?php foreach ($animationTriggers as $triggerId => $triggerLabel): ?><label><input type="checkbox" name="triggers[]" value="<?= bot_h($triggerId) ?>" <?= in_array($triggerId, $animation['triggers'], true) ? 'checked' : '' ?>> <span><?= bot_h($triggerLabel) ?></span></label><?php endforeach; ?></fieldset>
            <label class="miu-field"><span>Produtos desta animação</span><input type="text" name="product_scopes" value="<?= bot_h(implode(', ', isset($animation['products']) ? $animation['products'] : array())) ?>" placeholder="Ex.: pasta-de-folhetos, porta-chaves ou *"><small>Separados por vírgulas. <code>*</code> = todos os produtos. É usado sobretudo com “Ao entrar num produto”.</small></label>
            <details class="miu-animation-advanced">
              <summary>Frames e comportamento avançado</summary>
              <div class="miu-settings-grid">
                <label class="miu-field miu-settings-span"><span>Ordem dos frames</span><input type="text" name="sequence" value="<?= bot_h($sequenceText) ?>"><small>Índices começam em 0, da esquerda para a direita e depois a linha seguinte. Ex.: 0,1,2,3,2,1.</small></label>
                <label class="miu-field miu-settings-span"><span>Duração de cada frame (ms)</span><input type="text" name="durations" value="<?= bot_h($durationText) ?>"><small>Uma duração por posição da sequência. Se deixares inválido, usa o valor geral abaixo.</small></label>
                <label class="miu-field"><span>Duração geral por frame</span><input type="number" name="frame_ms" min="40" max="10000" value="180"></label>
                <label class="miu-field"><span>Repetições</span><input type="number" name="repeat" min="0" max="20" value="<?= (int)$animation['repeat'] ?>"><small>0 = continua até outra acção a substituir.</small></label>
                <label class="miu-field"><span>Frame usado em avatar</span><input type="number" name="static_frame" min="0" max="<?= max(0, $animation['columns'] * $animation['rows'] - 1) ?>" value="<?= (int)$animation['staticFrame'] ?>"></label>
                <label class="miu-field"><span>Probabilidade</span><input type="number" name="probability" min="0" max="100" value="<?= (int)round($animation['probability'] * 100) ?>"><small>100 = sempre elegível quando o gatilho acontece.</small></label>
                <label class="miu-field"><span>Peso entre animações do mesmo gatilho</span><input type="number" name="weight" min="1" max="100" value="<?= (int)$animation['weight'] ?>"></label>
                <label class="miu-field"><span>Cooldown</span><input type="number" name="cooldown_seconds" min="0" max="3600" value="<?= (int)round($animation['cooldownMs'] / 1000) ?>"><small>Segundos antes de poder voltar a acontecer.</small></label>
                <label class="miu-field"><span>Movimento</span><select name="motion_type"><?php foreach ($animationMotions as $motionId => $motionLabel): ?><option value="<?= bot_h($motionId) ?>" <?= $animation['motion']['type'] === $motionId ? 'selected' : '' ?>><?= bot_h($motionLabel) ?></option><?php endforeach; ?></select></label>
                <label class="miu-field"><span>Distância / altura do movimento</span><input type="number" name="motion_distance" min="0" max="600" value="<?= (int)$animation['motion']['distancePx'] ?>"><small>Pixels. Para um salto, é a altura; para andar, a distância.</small></label>
                <label class="miu-toggle"><input type="checkbox" name="flip_x" value="1" <?= $animation['flipX'] ? 'checked' : '' ?>><span>Espelhar horizontalmente</span></label>
                <label class="miu-toggle"><input type="checkbox" name="enabled" value="1" <?= $animation['enabled'] ? 'checked' : '' ?>><span>Animação activa</span></label>
              </div>
            </details>
            <div class="miu-animation-actions"><button class="miu-button" type="submit">Guardar animação</button></div>
          </form>
          <form class="miu-animation-delete" method="post" action="bot.php?tab=animations" data-confirm="Apagar esta animação e a spritesheet carregada por este painel?"><input type="hidden" name="csrf" value="<?= bot_h($csrf) ?>"><input type="hidden" name="action" value="delete_animation"><input type="hidden" name="animation_id" value="<?= bot_h($animation['id']) ?>"><button class="miu-button miu-button--danger" type="submit">Apagar</button></form>
        </article>
      <?php endforeach; ?>
      </div>
    </div>
  </section>

  <section class="miu-admin-card" aria-labelledby="miu-animation-new-title">
    <div class="miu-admin-card__head"><div><h2 id="miu-animation-new-title">Adicionar animação</h2><p>Uma spritesheet nova fica disponível no site assim que a guardares.</p></div></div>
    <form class="miu-admin-card__body miu-animation-form" method="post" enctype="multipart/form-data" action="bot.php?tab=animations">
      <input type="hidden" name="csrf" value="<?= bot_h($csrf) ?>">
      <input type="hidden" name="action" value="create_animation">
      <div class="miu-settings-grid">
        <label class="miu-field"><span>Nome</span><input type="text" name="animation_name" maxlength="80" required placeholder="Ex.: Derrubar caneta"></label>
        <label class="miu-field"><span>Identificador</span><input type="text" name="animation_id" maxlength="64" placeholder="Automático a partir do nome"><small>Depois de criada, fica estável.</small></label>
        <label class="miu-field miu-settings-span"><span>Spritesheet WebP ou PNG</span><input type="file" name="sheet" accept="image/webp,image/png,.webp,.png" required><small>Fundo transparente. Recomendação: 96–128 px por frame. Máximo 8 MB.</small></label>
        <label class="miu-field"><span>Colunas</span><input type="number" name="columns" min="1" max="16" value="4" required></label>
        <label class="miu-field"><span>Linhas</span><input type="number" name="rows" min="1" max="16" value="1" required></label>
      </div>
      <fieldset class="miu-animation-triggers"><legend>Quando pode acontecer</legend><?php foreach ($animationTriggers as $triggerId => $triggerLabel): ?><label><input type="checkbox" name="triggers[]" value="<?= bot_h($triggerId) ?>"> <span><?= bot_h($triggerLabel) ?></span></label><?php endforeach; ?></fieldset>
      <label class="miu-field"><span>Produtos desta animação</span><input type="text" name="product_scopes" placeholder="Ex.: pasta-de-folhetos, porta-chaves ou *"><small>Separados por vírgulas. <code>*</code> = todos os produtos.</small></label>
      <details class="miu-animation-advanced">
        <summary>Frames e comportamento avançado</summary>
        <div class="miu-settings-grid">
          <label class="miu-field miu-settings-span"><span>Ordem dos frames</span><input type="text" name="sequence" placeholder="Vazio = 0,1,2,3…"><small>Podes repetir frames: 0,1,2,3,2,1,0.</small></label>
          <label class="miu-field miu-settings-span"><span>Duração de cada frame (ms)</span><input type="text" name="durations" placeholder="Ex.: 250,120,120,400"><small>Opcional. Se vazio, usa a duração geral.</small></label>
          <label class="miu-field"><span>Duração geral por frame</span><input type="number" name="frame_ms" min="40" max="10000" value="180"></label>
          <label class="miu-field"><span>Repetições</span><input type="number" name="repeat" min="0" max="20" value="1"><small>0 = contínua.</small></label>
          <label class="miu-field"><span>Frame usado em avatar</span><input type="number" name="static_frame" min="0" max="255" value="0"></label>
          <label class="miu-field"><span>Probabilidade</span><input type="number" name="probability" min="0" max="100" value="100"></label>
          <label class="miu-field"><span>Peso</span><input type="number" name="weight" min="1" max="100" value="1"></label>
          <label class="miu-field"><span>Cooldown (segundos)</span><input type="number" name="cooldown_seconds" min="0" max="3600" value="0"></label>
          <label class="miu-field"><span>Movimento</span><select name="motion_type"><?php foreach ($animationMotions as $motionId => $motionLabel): ?><option value="<?= bot_h($motionId) ?>"><?= bot_h($motionLabel) ?></option><?php endforeach; ?></select></label>
          <label class="miu-field"><span>Distância / altura</span><input type="number" name="motion_distance" min="0" max="600" value="90"></label>
          <label class="miu-toggle"><input type="checkbox" name="flip_x" value="1"><span>Espelhar horizontalmente</span></label>
          <label class="miu-toggle"><input type="checkbox" name="enabled" value="1" checked><span>Animação activa</span></label>
        </div>
      </details>
      <button class="miu-button" type="submit">Adicionar animação</button>
    </form>
  </section>
  <?php endif; ?>

  <?php if ($tab === 'contexts'): ?>
  <section class="miu-admin-card" aria-labelledby="miu-contexts-title">
    <header class="miu-admin-card__head">
      <div><h2 id="miu-contexts-title">Contexto injectado por produto e passo</h2><p>Os preços são lidos do pricing.json; aqui guardam-se os objectivos e a decisão de os incluir. As respostas rápidas vêm do JSON central.</p></div>
      <span class="miu-badge is-ready"><?= count($contextRows) ?> passos</span>
    </header>
    <div class="miu-admin-card__body">
      <label class="miu-field miu-context-search"><span>Filtrar produtos ou passos</span><input type="search" placeholder="Ex.: crachás, cartão, entrega…" data-context-filter></label>
      <div class="miu-context-products">
        <?php foreach ($contextGroups as $group): ?>
          <details class="miu-context-product" data-context-group data-context-search="<?= bot_h($group['product_name'] . ' ' . $group['product_slug'] . ' ' . $group['scope']) ?>">
            <summary><span><strong><?= bot_h($group['product_name']) ?></strong><small><?= bot_h($group['scope']) ?> · <?= bot_h($group['product_slug']) ?></small></span><span><?= count($group['rows']) ?> passos</span></summary>
            <div class="miu-context-steps">
              <?php foreach ($group['rows'] as $contextRow): ?>
                <?php $contextQuickReplies = miu_quick_replies_for_context($contextRow['context_key']); ?>
                <form class="miu-context-step" method="post" action="bot.php?tab=contexts" data-context-step data-context-search="<?= bot_h($contextRow['step_name'] . ' ' . $contextRow['step_id'] . ' ' . $contextRow['step_template']) ?>">
                  <input type="hidden" name="csrf" value="<?= bot_h($csrf) ?>">
                  <input type="hidden" name="action" value="save_context">
                  <input type="hidden" name="context_key" value="<?= bot_h($contextRow['context_key']) ?>">
                  <header><div><h3><?= bot_h($contextRow['step_name']) ?></h3><p><code><?= bot_h($contextRow['step_id']) ?></code> · <?= bot_h($contextRow['step_template']) ?></p></div><span class="miu-badge <?= (int)$contextRow['include_pricing'] === 1 ? 'is-ready' : '' ?>"><?= (int)$contextRow['include_pricing'] === 1 ? 'com preços' : 'sem preços' ?></span></header>
                  <label class="miu-field"><span>Objectivos e informação deste passo</span><textarea name="objectives" maxlength="10000" data-max-count="10000"><?= bot_h($contextRow['objectives']) ?></textarea><span class="miu-char-count" data-char-count></span></label>
                  <details class="miu-context-preview"><summary><?= count($contextQuickReplies) ?> respostas rápidas deste passo</summary><div class="miu-context-replies"><?php foreach ($contextQuickReplies as $reply): ?><article><strong><?= bot_h($reply['question']) ?></strong><p><?= bot_h($reply['answer']) ?></p></article><?php endforeach; ?></div></details>
                  <label class="miu-check"><input type="checkbox" name="include_pricing" value="1" <?= (int)$contextRow['include_pricing'] === 1 ? 'checked' : '' ?>><span><strong>Injectar a tabela de preços actual</strong><small>O valor vem do editor central; não fica duplicado nesta base.</small></span></label>
                  <details class="miu-context-preview"><summary>Ver exactamente o contexto injectado</summary><pre><?= bot_h(miu_context_prompt($contextRow)) ?></pre></details>
                  <div class="miu-admin-actions"><button class="miu-button" type="submit">Guardar este passo</button></div>
                </form>
              <?php endforeach; ?>
            </div>
          </details>
        <?php endforeach; ?>
      </div>
    </div>
  </section>
  <?php endif; ?>

  <?php if ($tab === 'replies'): ?>
  <section class="miu-admin-card" aria-labelledby="miu-replies-title">
    <header class="miu-admin-card__head">
      <div><h2 id="miu-replies-title">Respostas rápidas</h2><p>Estas respostas são transmitidas localmente e nunca chamam o OpenRouter nem o Gemini.</p></div>
      <span class="miu-badge is-ready"><?= (int)$quickReplyCount ?> perguntas</span>
    </header>
    <div class="miu-admin-card__body">
      <div class="miu-json-note"><strong>Fonte única para edição em massa</strong><p><code>site/content/miu-quick-replies.json</code>. O identificador de cada resposta deve manter-se estável.</p></div>
      <div class="miu-reply-groups">
        <?php $globalItems = isset($quickReplyGlobal['items']) && is_array($quickReplyGlobal['items']) ? $quickReplyGlobal['items'] : array(); ?>
        <details class="miu-reply-group" open>
          <summary><span><strong><?= bot_h(isset($quickReplyGlobal['label']) ? $quickReplyGlobal['label'] : 'Perguntas gerais') ?></strong><small><?= bot_h(isset($quickReplyGlobal['description']) ? $quickReplyGlobal['description'] : '') ?></small></span><span><?= count($globalItems) ?></span></summary>
          <div class="miu-reply-list">
            <?php foreach ($globalItems as $reply): ?>
            <article class="miu-reply-item">
              <header><strong><?= bot_h(isset($reply['question']) ? $reply['question'] : '') ?></strong><code><?= bot_h(isset($reply['id']) ? $reply['id'] : '') ?></code></header>
              <p><?= bot_h(isset($reply['answer']) ? $reply['answer'] : '') ?></p>
            </article>
            <?php endforeach; ?>
          </div>
        </details>

        <?php foreach ($quickReplyProductGroups as $productGroup): ?>
          <details class="miu-reply-group miu-reply-product">
            <summary><span><strong><?= bot_h($productGroup['product_name']) ?></strong><small><?= bot_h($productGroup['scope']) ?> · <?= bot_h($productGroup['product_slug']) ?> · <?= count($productGroup['contexts']) ?> passos</small></span><span><?= (int)$productGroup['reply_count'] ?></span></summary>
            <div class="miu-reply-contexts">
              <?php foreach ($productGroup['contexts'] as $contextKey => $context): ?>
                <?php $contextItems = isset($context['items']) && is_array($context['items']) ? $context['items'] : array(); ?>
                <details class="miu-reply-context">
                  <summary><span><strong><?= bot_h(isset($context['stepName']) ? $context['stepName'] : $contextKey) ?></strong><small><code><?= bot_h(isset($context['stepId']) ? $context['stepId'] : '') ?></code></small></span><span><?= count($contextItems) ?></span></summary>
                  <div class="miu-reply-list">
                    <?php foreach ($contextItems as $reply): ?>
                    <article class="miu-reply-item">
                      <header><strong><?= bot_h(isset($reply['question']) ? $reply['question'] : '') ?></strong><code><?= bot_h(isset($reply['id']) ? $reply['id'] : '') ?></code></header>
                      <p><?= bot_h(isset($reply['answer']) ? $reply['answer'] : '') ?></p>
                    </article>
                    <?php endforeach; ?>
                  </div>
                </details>
              <?php endforeach; ?>
            </div>
          </details>
        <?php endforeach; ?>

        <details class="miu-reply-group" open>
          <summary><span><strong>Respostas automáticas de segurança e contacto</strong><small>Aplicadas também a variações escritas pela pessoa.</small></span><span><?= count($quickReplyIntents) ?></span></summary>
          <div class="miu-reply-list">
            <?php foreach ($quickReplyIntents as $intentKey => $reply): ?>
            <article class="miu-reply-item">
              <header><strong><?= bot_h(isset($reply['label']) ? $reply['label'] : $intentKey) ?></strong><code><?= bot_h(isset($reply['id']) ? $reply['id'] : '') ?></code></header>
              <p><?= bot_h(isset($reply['answer']) ? $reply['answer'] : '') ?></p>
            </article>
            <?php endforeach; ?>
          </div>
        </details>
      </div>
    </div>
  </section>
  <?php endif; ?>

  <?php if ($tab === 'conversations' && $detail): ?>
  <section class="miu-admin-card" aria-labelledby="miu-conversation-title">
    <header class="miu-admin-card__head">
      <div><h2 id="miu-conversation-title">Conversa #<?= (int)$detail['id'] ?></h2><p><?= bot_h(bot_local_date($detail['started_at'])) ?></p></div>
      <a class="miu-button miu-button--secondary" href="bot.php?tab=conversations&amp;page=<?= (int)$page ?>">Fechar detalhe</a>
    </header>
    <div class="miu-admin-card__body">
      <div class="miu-conversation-meta">
        <div><span>IP</span><code><?= bot_h($detail['ip_address']) ?></code></div>
        <div><span>Primeira mensagem</span><strong><?= bot_h(bot_local_date($detail['started_at'])) ?></strong></div>
        <div><span>Última actividade</span><strong><?= bot_h(bot_local_date($detail['updated_at'])) ?></strong></div>
        <div><span>Página</span><code><?= bot_h($detail['page_url']) ?></code></div>
        <div class="miu-settings-span"><span>User-agent</span><code><?= bot_h($detail['user_agent']) ?></code></div>
      </div>
      <div class="miu-admin-messages">
        <?php foreach ($detail['messages'] as $message): ?>
          <article class="miu-admin-message <?= $message['role'] === 'user' ? 'is-user' : '' ?> <?= $message['status'] === 'blocked' ? 'is-blocked' : '' ?> <?= $message['status'] === 'error' ? 'is-error' : '' ?>">
            <div class="miu-admin-message__meta"><span><?= $message['role'] === 'user' ? 'Pessoa' : 'Míu' ?></span><span><?= bot_h($message['status']) ?></span><span><?= bot_h(bot_local_date($message['created_at'])) ?></span><?php if ($message['provider']): ?><span><?= bot_h($message['provider']) ?> · <?= bot_h($message['model']) ?></span><?php endif; ?><?php if (!empty($message['context_key'])): ?><span><?= bot_h($message['context_key']) ?></span><?php endif; ?></div>
            <p><?= bot_h($message['content']) ?></p>
            <?php if ($message['error_detail']): ?><div class="miu-admin-error"><?= bot_h($message['error_detail']) ?></div><?php endif; ?>
          </article>
        <?php endforeach; ?>
      </div>
      <div class="miu-admin-actions">
        <form method="post" action="bot.php" data-confirm="Apagar esta conversa e todas as mensagens? Esta acção não pode ser desfeita.">
          <input type="hidden" name="csrf" value="<?= bot_h($csrf) ?>"><input type="hidden" name="action" value="delete_conversation"><input type="hidden" name="conversation_id" value="<?= (int)$detail['id'] ?>">
          <button class="miu-button miu-button--danger" type="submit">Apagar conversa</button>
        </form>
      </div>
    </div>
  </section>
  <?php endif; ?>

  <?php if ($tab === 'conversations'): ?>
  <section class="miu-admin-card" aria-labelledby="miu-list-title">
    <header class="miu-admin-card__head"><div><h2 id="miu-list-title">Conversas</h2><p>Hora de Lisboa; as mensagens bloqueadas também ficam visíveis para auditoria.</p></div></header>
    <?php if (!$conversations): ?><p class="miu-empty">Ainda não há conversas.</p><?php else: ?>
    <div class="miu-table-wrap"><table class="miu-table"><thead><tr><th>Quando</th><th>IP</th><th>Página</th><th>Mensagens</th><th>Última pergunta</th><th></th></tr></thead><tbody>
      <?php foreach ($conversations as $conversation): ?><tr>
        <td><?= bot_h(bot_local_date($conversation['updated_at'])) ?></td><td><code><?= bot_h($conversation['ip_address']) ?></code></td><td><code><?= bot_h($conversation['page_url']) ?></code></td>
        <td><?= (int)$conversation['message_count'] ?><?php if ((int)$conversation['blocked_count'] > 0): ?> <span class="miu-badge is-blocked"><?= (int)$conversation['blocked_count'] ?> bloqueada(s)</span><?php endif; ?></td>
        <td><span class="miu-preview"><?= bot_h($conversation['last_user_message']) ?></span></td><td><a href="bot.php?tab=conversations&amp;id=<?= (int)$conversation['id'] ?>&amp;page=<?= (int)$page ?>">Abrir</a></td>
      </tr><?php endforeach; ?>
    </tbody></table></div>
    <?php if ($pageCount > 1): ?><nav class="miu-pagination" aria-label="Páginas de conversas"><?php if ($page > 1): ?><a href="bot.php?tab=conversations&amp;page=<?= $page - 1 ?>">Anterior</a><?php endif; ?><span><?= $page ?> / <?= $pageCount ?></span><?php if ($page < $pageCount): ?><a href="bot.php?tab=conversations&amp;page=<?= $page + 1 ?>">Seguinte</a><?php endif; ?></nav><?php endif; ?>
    <?php endif; ?>
  </section>
  <?php endif; ?>
</main>
</body>
</html>