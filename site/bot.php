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

$csrf = mp_admin_csrf_token();
$notice = isset($_GET['notice']) ? (string)$_GET['notice'] : '';
$allowedTabs = array('conversations', 'settings', 'contexts', 'replies');
$tab = isset($_GET['tab']) && in_array($_GET['tab'], $allowedTabs, true) ? (string)$_GET['tab'] : 'conversations';

if (isset($_SERVER['REQUEST_METHOD']) && strtoupper((string)$_SERVER['REQUEST_METHOD']) === 'POST') {
    $sentCsrf = isset($_POST['csrf']) ? (string)$_POST['csrf'] : '';
    if (!mp_admin_csrf_is_valid($sentCsrf)) {
        http_response_code(403);
        exit('Pedido recusado: token CSRF inválido.');
    }
    $action = isset($_POST['action']) ? (string)$_POST['action'] : '';
    if ($action === 'save_settings') {
        $current = miu_settings();
        $provider = isset($_POST['provider']) && $_POST['provider'] === 'gemini' ? 'gemini' : 'openrouter';
        miu_save_settings(array(
            'enabled' => !empty($_POST['enabled']) ? '1' : '0',
            'name' => trim(miu_text_slice(isset($_POST['name']) ? $_POST['name'] : 'Míu', 40)),
            'greeting' => trim(miu_text_slice(isset($_POST['greeting']) ? $_POST['greeting'] : 'Em que posso ajudar?', 160)),
            'launcher_prompt' => trim(miu_text_slice(isset($_POST['launcher_prompt']) ? $_POST['launcher_prompt'] : '', 60)),
            'provider' => $provider,
            'fallback_enabled' => !empty($_POST['fallback_enabled']) ? '1' : '0',
            'openrouter_model' => bot_model(isset($_POST['openrouter_model']) ? $_POST['openrouter_model'] : '', $current['openrouter_model']),
            'gemini_model' => bot_model(isset($_POST['gemini_model']) ? $_POST['gemini_model'] : '', $current['gemini_model']),
            'max_message_chars' => (string)bot_int(isset($_POST['max_message_chars']) ? $_POST['max_message_chars'] : 800, 200, 2000, 800),
            'max_conversation_turns' => (string)bot_int(isset($_POST['max_conversation_turns']) ? $_POST['max_conversation_turns'] : 20, 4, 30, 20),
            'rate_per_minute' => (string)bot_int(isset($_POST['rate_per_minute']) ? $_POST['rate_per_minute'] : 6, 2, 30, 6),
            'rate_per_hour' => (string)bot_int(isset($_POST['rate_per_hour']) ? $_POST['rate_per_hour'] : 40, 10, 300, 40),
            'max_output_tokens' => (string)bot_int(isset($_POST['max_output_tokens']) ? $_POST['max_output_tokens'] : 450, 100, 1000, 450),
            'system_prompt' => trim(miu_text_slice(isset($_POST['system_prompt']) ? $_POST['system_prompt'] : '', 20000)),
            'knowledge_base' => trim(miu_text_slice(isset($_POST['knowledge_base']) ? $_POST['knowledge_base'] : '', 50000)),
        ));
        header('Location: bot.php?tab=settings&notice=saved');
        exit;
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
  <link rel="stylesheet" href="css/01-tokens-agua.css?v=2026080501">
  <link rel="stylesheet" href="admin-nav.css?v=2026081001">
  <link rel="stylesheet" href="bot-admin.css?v=2026081501">
  <script src="admin-nav.js?v=2026081001" defer></script>
  <script src="bot-admin.js?v=2026081501" defer></script>
</head>
<body class="miu-admin-body">
<?= mp_parametros_barra('bot.php') ?>
<main class="miu-admin-shell">
  <header class="miu-admin-header">
    <div>
      <h1>Míu</h1>
      <p>Conversas, system prompt, informação enviada à IA e limites do chatbot.</p>
    </div>
    <code class="miu-admin-path">private/miu.sqlite</code>
  </header>

  <nav class="miu-admin-tabs" aria-label="Áreas do Míu">
    <a class="<?= $tab === 'conversations' ? 'is-active' : '' ?>" href="bot.php?tab=conversations">Conversas</a>
    <a class="<?= $tab === 'settings' ? 'is-active' : '' ?>" href="bot.php?tab=settings">Configuração</a>
    <a class="<?= $tab === 'contexts' ? 'is-active' : '' ?>" href="bot.php?tab=contexts">Contexto por passo</a>
    <a class="<?= $tab === 'replies' ? 'is-active' : '' ?>" href="bot.php?tab=replies">Respostas rápidas</a>
  </nav>

  <?php if ($notice === 'saved'): ?><p class="miu-admin-flash">Configuração guardada.</p><?php endif; ?>
  <?php if ($notice === 'context-saved'): ?><p class="miu-admin-flash">Contexto do passo guardado.</p><?php endif; ?>
  <?php if ($notice === 'deleted'): ?><p class="miu-admin-flash">Conversa apagada.</p><?php endif; ?>

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
