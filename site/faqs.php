<?php
/**
 * FAQ_EDITOR_V2 — editor visual de content/faqs.json.
 *
 * O modo aberto de desenvolvimento é controlado apenas por admin-open.php.
 * Quando MIA_ADMIN_OPEN passar a false, esta página volta a exigir a sessão
 * administrativa normal. Todas as gravações continuam protegidas por CSRF.
 */

require_once __DIR__ . '/admin-open.php';

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
        . '<title>Acesso negado · FAQs</title>'
        . '<style>body{font-family:Georgia,serif;max-width:560px;margin:60px auto;padding:0 20px;color:#3b2f1f}a{color:#4f7a3a;font-weight:700}</style>'
        . '<h1>Acesso restrito.</h1><p>Inicia sessão como administradora a partir do <a href="index.html">site</a> e regressa a esta página.</p>';
    exit;
}

define('FAQS_FILE', __DIR__ . '/content/faqs.json');

function faqs_h($value)
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function faqs_text($value, $max)
{
    $value = trim((string)$value);
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $max, 'UTF-8');
    }
    return substr($value, 0, $max);
}

function faqs_default_data()
{
    return array(
        'schemaVersion' => 2,
        'title' => 'Perguntas frequentes',
        'intro' => 'Respostas às dúvidas mais comuns sobre encomendas, personalização e entrega.',
        'items' => array(),
    );
}

function faqs_read(&$invalid)
{
    $invalid = false;
    if (!is_file(FAQS_FILE)) {
        return faqs_default_data();
    }
    $raw = file_get_contents(FAQS_FILE);
    $data = json_decode((string)$raw, true);
    if (!is_array($data)) {
        $invalid = true;
        return faqs_default_data();
    }
    return faqs_normalize($data, false);
}

function faqs_revision()
{
    return is_file(FAQS_FILE) ? (string)hash_file('sha256', FAQS_FILE) : '';
}

function faqs_safe_id($value, $fallback)
{
    $id = preg_replace('/[^a-z0-9_-]+/i', '-', faqs_text($value, 80));
    $id = trim((string)$id, '-');
    return $id !== '' ? $id : $fallback;
}

function faqs_safe_href($value)
{
    $href = trim((string)$value);
    if ($href === '' || preg_match('/[\x00-\x1F\x7F]/', $href) || strpos($href, '//') === 0) {
        return '';
    }
    $scheme = parse_url($href, PHP_URL_SCHEME);
    if ($scheme !== null && $scheme !== false && $scheme !== '') {
        $scheme = strtolower((string)$scheme);
        if (!in_array($scheme, array('http', 'https', 'mailto', 'tel'), true)) {
            return '';
        }
    }
    return faqs_text($href, 1000);
}

function faqs_clean_dom_node($node)
{
    $children = array();
    foreach ($node->childNodes as $child) {
        $children[] = $child;
    }
    foreach ($children as $child) {
        if ($child->nodeType === XML_COMMENT_NODE) {
            $node->removeChild($child);
            continue;
        }
        if ($child->nodeType !== XML_ELEMENT_NODE) {
            continue;
        }
        $tag = strtolower((string)$child->nodeName);
        if (in_array($tag, array('script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'form', 'input', 'button'), true)) {
            $node->removeChild($child);
            continue;
        }
        faqs_clean_dom_node($child);
        $allowed = in_array($tag, array('p', 'div', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a'), true);
        if (!$allowed) {
            while ($child->firstChild) {
                $node->insertBefore($child->firstChild, $child);
            }
            $node->removeChild($child);
            continue;
        }
        $attributes = array();
        if ($child->hasAttributes()) {
            foreach ($child->attributes as $attribute) {
                $attributes[] = $attribute->nodeName;
            }
        }
        foreach ($attributes as $attributeName) {
            if ($tag !== 'a' || strtolower((string)$attributeName) !== 'href') {
                $child->removeAttribute($attributeName);
            }
        }
        if ($tag === 'a') {
            $href = faqs_safe_href($child->getAttribute('href'));
            if ($href === '') {
                $child->removeAttribute('href');
            } else {
                $child->setAttribute('href', $href);
            }
        }
    }
}

function faqs_plain_to_html($value)
{
    $value = faqs_text($value, 10000);
    if ($value === '') {
        return '';
    }
    $parts = preg_split('/\R\s*\R/u', $value);
    $html = array();
    foreach ($parts as $part) {
        $part = trim((string)$part);
        if ($part !== '') {
            $html[] = '<p>' . nl2br(faqs_h($part), false) . '</p>';
        }
    }
    return implode('', $html);
}

function faqs_sanitize_html($value)
{
    $value = faqs_text($value, 30000);
    if ($value === '') {
        return '';
    }
    if (!class_exists('DOMDocument')) {
        return faqs_plain_to_html(html_entity_decode(strip_tags($value), ENT_QUOTES, 'UTF-8'));
    }
    $document = new DOMDocument('1.0', 'UTF-8');
    $previousErrors = libxml_use_internal_errors(true);
    $loaded = $document->loadHTML(
        '<?xml encoding="UTF-8"><div id="faqs-sanitize-root">' . $value . '</div>',
        LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
    );
    $root = $loaded ? $document->getElementById('faqs-sanitize-root') : null;
    if (!$root) {
        libxml_clear_errors();
        libxml_use_internal_errors($previousErrors);
        return faqs_plain_to_html(html_entity_decode(strip_tags($value), ENT_QUOTES, 'UTF-8'));
    }
    faqs_clean_dom_node($root);
    $html = '';
    foreach ($root->childNodes as $child) {
        $html .= $document->saveHTML($child);
    }
    libxml_clear_errors();
    libxml_use_internal_errors($previousErrors);
    return trim($html);
}

function faqs_html_has_content($value)
{
    $plain = html_entity_decode(strip_tags((string)$value), ENT_QUOTES, 'UTF-8');
    return trim(preg_replace('/\s+/u', ' ', $plain)) !== '';
}

function faqs_normalize($input, $fromForm)
{
    $input = is_array($input) ? $input : array();
    $title = faqs_text(isset($input['title']) ? $input['title'] : '', 120);
    $intro = faqs_text(isset($input['intro']) ? $input['intro'] : '', 1000);
    $rows = isset($input['items']) && is_array($input['items']) ? $input['items'] : array();
    $items = array();
    $seen = array();

    foreach (array_slice(array_values($rows), 0, 100) as $index => $row) {
        if (!is_array($row)) {
            continue;
        }
        $question = faqs_text(isset($row['question']) ? $row['question'] : '', 500);
        $answerHtml = isset($row['answerHtml'])
            ? faqs_sanitize_html($row['answerHtml'])
            : faqs_plain_to_html(isset($row['answer']) ? $row['answer'] : '');
        if ($question === '' && !faqs_html_has_content($answerHtml)) {
            continue;
        }
        $fallback = 'faq-' . substr(sha1(uniqid('', true) . '-' . $index), 0, 10);
        $id = faqs_safe_id(isset($row['id']) ? $row['id'] : '', $fallback);
        $base = $id;
        $suffix = 2;
        while (isset($seen[$id])) {
            $id = $base . '-' . $suffix;
            $suffix += 1;
        }
        $seen[$id] = true;
        $enabled = $fromForm
            ? isset($row['enabled']) && (string)$row['enabled'] === '1'
            : !isset($row['enabled']) || $row['enabled'] !== false;
        $items[] = array(
            'id' => $id,
            'enabled' => $enabled,
            'question' => $question,
            'answerHtml' => $answerHtml,
        );
    }

    return array(
        'schemaVersion' => 2,
        'title' => $title !== '' ? $title : 'Perguntas frequentes',
        'intro' => $intro,
        'items' => $items,
    );
}

function faqs_save($data)
{
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return false;
    }
    $json .= "\n";
    $tmp = FAQS_FILE . '.tmp-' . bin2hex(random_bytes(4));
    if (is_file(FAQS_FILE)) {
        @copy(FAQS_FILE, FAQS_FILE . '.faqs-bak');
    }
    if (file_put_contents($tmp, $json, LOCK_EX) === false) {
        return false;
    }
    if (!@rename($tmp, FAQS_FILE)) {
        if (file_put_contents(FAQS_FILE, $json, LOCK_EX) === false) {
            @unlink($tmp);
            return false;
        }
        @unlink($tmp);
    }
    return true;
}

$message = '';
$messageClass = '';
$invalidFile = false;
$data = faqs_read($invalidFile);
$revision = faqs_revision();

if (!empty($_SESSION['faqs_flash'])) {
    $message = (string)$_SESSION['faqs_flash'];
    $messageClass = 'ok';
    unset($_SESSION['faqs_flash']);
}

if (isset($_SERVER['REQUEST_METHOD']) && strtoupper((string)$_SERVER['REQUEST_METHOD']) === 'POST') {
    $sentCsrf = isset($_POST['csrf']) ? (string)$_POST['csrf'] : '';
    if (!mp_admin_csrf_is_valid($sentCsrf)) {
        http_response_code(403);
        $message = 'Pedido bloqueado por segurança. Recarrega a página e tenta novamente.';
        $messageClass = 'erro';
    } else {
        $submitted = faqs_normalize($_POST, true);
        $sentRevision = isset($_POST['revision']) ? (string)$_POST['revision'] : '';
        $currentRevision = faqs_revision();
        if ($sentRevision !== '' && $currentRevision !== '' && !hash_equals($currentRevision, $sentRevision)) {
            http_response_code(409);
            $data = $submitted;
            $revision = $currentRevision;
            $message = 'As FAQs foram alteradas noutra janela. Revê o conteúdo e carrega novamente em Guardar para substituir a versão atual.';
            $messageClass = 'erro';
        } elseif (!faqs_save($submitted)) {
            http_response_code(500);
            $data = $submitted;
            $message = 'Não foi possível guardar content/faqs.json.';
            $messageClass = 'erro';
        } else {
            $_SESSION['faqs_flash'] = 'Perguntas frequentes guardadas.';
            header('Location: faqs.php');
            exit;
        }
    }
}

if ($invalidFile && $message === '') {
    $message = 'O ficheiro content/faqs.json não é JSON válido. Ao guardar, será substituído e ficará uma cópia de segurança.';
    $messageClass = 'erro';
}

$editorItems = $data['items'];
if (!$editorItems) {
    $editorItems = array(array('id' => '', 'enabled' => true, 'question' => '', 'answerHtml' => ''));
}
?>
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>FAQs · Mia &amp; Paper</title>
  <link rel="stylesheet" href="admin-nav.css?v=20260908013100">
  <style>
    :root {
      --fundo: #14153a; --fundo-2: #101132; --cartao: #1e2050;
      --cartao-2: #262a63; --campo: #171938; --linha: #2f3370;
      --linha-forte: #3c4288; --texto: #ffffff; --texto-2: #a9adde;
      --texto-3: #8b8fc6; --azul: #4d8dff; --verde: #2fe0a0;
      --rosa: #ff4d8d; --ambar: #ffb648; --raio: 14px;
      --sombra: 0 1px 2px rgba(0,0,0,.35), 0 10px 30px rgba(0,0,0,.28);
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: var(--fundo); color: var(--texto); font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
    button, input, textarea, .faq-rich-editor { font: inherit; }
    .faq-admin-bar { position: sticky; top: 46px; z-index: 40; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px clamp(16px, 3vw, 30px); border-bottom: 1px solid var(--linha); background: rgba(20,21,58,.94); backdrop-filter: blur(10px); }
    .faq-admin-bar h1 { margin: 0 auto 0 0; font-size: 1.1rem; }
    .faq-admin-bar a { color: var(--texto-2); font-size: .84rem; font-weight: 700; text-decoration: none; }
    .faq-admin-bar a:hover { color: var(--texto); }
    button { min-height: 38px; padding: 7px 13px; border: 1px solid var(--linha-forte); border-radius: 9px; background: var(--cartao); color: var(--texto); cursor: pointer; }
    button:hover:not(:disabled) { border-color: var(--azul); background: var(--cartao-2); }
    button:disabled { opacity: .38; cursor: default; }
    button.primary { border-color: var(--azul); background: var(--azul); font-weight: 800; box-shadow: 0 4px 14px rgba(77,141,255,.32); }
    button.danger { color: var(--rosa); }
    .faq-admin-main { width: min(100%, 920px); margin: 0 auto; padding: 24px clamp(14px, 3vw, 26px) 100px; }
    .notice { margin: 0 0 18px; padding: 12px 15px; border: 1px solid var(--linha-forte); border-radius: 12px; background: rgba(77,141,255,.1); color: var(--texto-2); }
    .notice.open { border-color: rgba(255,182,72,.42); background: rgba(255,182,72,.1); }
    .notice.open strong { color: var(--ambar); }
    .notice.ok { border-color: rgba(47,224,160,.45); background: rgba(47,224,160,.1); color: var(--verde); }
    .notice.erro { border-color: rgba(255,77,141,.5); background: rgba(255,77,141,.1); color: #ff9abb; }
    .page-fields, .faq-row { border: 1px solid var(--linha); border-radius: var(--raio); background: var(--cartao); box-shadow: var(--sombra); }
    .page-fields { display: grid; gap: 14px; margin-bottom: 20px; padding: 18px; }
    label { display: grid; gap: 6px; color: var(--texto-2); font-size: .8rem; font-weight: 750; }
    input[type="text"], textarea { width: 100%; padding: 10px 11px; border: 1px solid var(--linha); border-radius: 9px; background: var(--campo); color: var(--texto); }
    input[type="text"]:focus, textarea:focus { outline: none; border-color: var(--azul); box-shadow: 0 0 0 3px rgba(77,141,255,.22); }
    textarea { min-height: 150px; resize: vertical; line-height: 1.55; }
    .faq-rich-wrap { display: grid; gap: 0; }
    .faq-rich-label { margin-bottom: 6px; color: var(--texto-2); font-size: .8rem; font-weight: 750; }
    .faq-rich-toolbar { display: flex; flex-wrap: wrap; gap: 6px; padding: 7px; border: 1px solid var(--linha); border-bottom: 0; border-radius: 9px 9px 0 0; background: var(--fundo-2); }
    .faq-rich-toolbar button { min-width: 34px; min-height: 30px; padding: 4px 8px; font-size: .78rem; }
    .faq-rich-link-panel { display: grid; grid-template-columns: minmax(180px, 1fr) auto auto; align-items: end; gap: 7px; padding: 7px; border: 1px solid var(--linha); border-bottom: 0; background: var(--fundo-2); }
    .faq-rich-link-panel[hidden] { display: none; }
    .faq-rich-link-panel label { gap: 3px; }
    .faq-rich-link-panel input { width: 100%; min-height: 34px; padding: 6px 8px; border: 1px solid var(--linha); border-radius: 7px; background: var(--campo); color: var(--texto); }
    .faq-rich-link-panel button { min-height: 34px; padding: 5px 9px; font-size: .78rem; }
    .faq-rich-link-status { grid-column: 1 / -1; margin: 0; color: var(--ambar); font-size: .75rem; }
    .faq-rich-editor { min-height: 150px; padding: 10px 11px; overflow-wrap: anywhere; border: 1px solid var(--linha); border-radius: 0 0 9px 9px; background: var(--campo); color: var(--texto); line-height: 1.55; outline: none; }
    .faq-rich-editor:focus { border-color: var(--azul); box-shadow: 0 0 0 3px rgba(77,141,255,.22); }
    .faq-rich-editor:empty::before { color: var(--texto-3); content: attr(data-placeholder); pointer-events: none; }
    .faq-rich-editor p { margin: 0 0 .8em; }
    .faq-rich-editor p:last-child { margin-bottom: 0; }
    .faq-rich-editor ul, .faq-rich-editor ol { margin: .5em 0; padding-left: 1.5em; }
    .faq-rich-editor a { color: var(--verde); }
    .faq-rows { display: grid; gap: 14px; }
    .faq-row { overflow: hidden; }
    .faq-row-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--linha); background: rgba(255,255,255,.035); }
    .faq-row-head strong { margin-right: auto; font-size: .9rem; }
    .faq-row-head button { min-height: 32px; padding: 4px 9px; font-size: .78rem; }
    .faq-row-body { display: grid; gap: 13px; padding: 15px; }
    .faq-visible { display: flex; align-items: center; gap: 8px; width: max-content; color: var(--texto-2); }
    .faq-visible input { width: 18px; height: 18px; accent-color: var(--azul); }
    .add { width: 100%; margin-top: 14px; border-style: dashed; color: var(--texto-2); }
    .hint { margin: 0; color: var(--texto-3); font-size: .78rem; }
    .save-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 50; display: flex; align-items: center; justify-content: flex-end; gap: 12px; padding: 12px clamp(16px, 3vw, 30px); border-top: 1px solid var(--linha-forte); background: rgba(30,32,80,.95); backdrop-filter: blur(10px); }
    .save-note { margin-right: auto; color: var(--texto-3); font-size: .8rem; }
    .save-note strong { color: var(--ambar); }
    @media (max-width: 620px) {
      .faq-admin-bar { top: 46px; }
      .faq-admin-bar h1 { width: 100%; }
      .faq-row-head { flex-wrap: wrap; }
      .faq-row-head strong { width: 100%; }
      .save-note { display: none; }
      .save-bar button { flex: 1; }
    }
  </style>
</head>
<body>
  <header class="faq-admin-bar admin-secondary-bar">
    <h1>Perguntas frequentes</h1>
    <a href="perguntasfrequentes.html" target="_blank" rel="noopener">Ver página pública ↗</a>
    <button type="submit" form="faqsForm" class="primary" data-save>Guardar</button>
  </header>

  <main class="faq-admin-main">
    <?php if (MIA_ADMIN_OPEN): ?>
      <p class="notice open"><strong>Editor aberto sem autenticação.</strong> Antes do deploy, põe <code>MIA_ADMIN_OPEN</code> a <code>false</code> em <code>admin-open.php</code>.</p>
    <?php endif; ?>
    <?php if ($message !== ''): ?>
      <p class="notice <?= faqs_h($messageClass) ?>" role="status"><?= faqs_h($message) ?></p>
    <?php endif; ?>

    <form id="faqsForm" method="post" action="faqs.php">
      <input type="hidden" name="csrf" value="<?= faqs_h(mp_admin_csrf_token()) ?>">
      <input type="hidden" name="revision" value="<?= faqs_h($revision) ?>">

      <section class="page-fields" aria-labelledby="page-fields-title">
        <h2 id="page-fields-title">Topo da página</h2>
        <label>Título
          <input type="text" name="title" maxlength="120" value="<?= faqs_h($data['title']) ?>" required>
        </label>
        <label>Texto de introdução
          <textarea name="intro" maxlength="1000" rows="3"><?= faqs_h($data['intro']) ?></textarea>
        </label>
      </section>

      <div class="faq-rows" data-faq-rows>
        <?php foreach ($editorItems as $index => $item): ?>
          <article class="faq-row" data-faq-row>
            <header class="faq-row-head">
              <strong>FAQ <span data-row-number><?= (int)$index + 1 ?></span></strong>
              <button type="button" data-action="up" aria-label="Subir pergunta">↑ Subir</button>
              <button type="button" data-action="down" aria-label="Descer pergunta">↓ Descer</button>
              <button type="button" class="danger" data-action="remove">Remover</button>
            </header>
            <div class="faq-row-body">
              <input type="hidden" data-field="id" name="items[<?= (int)$index ?>][id]" value="<?= faqs_h($item['id']) ?>">
              <label>Pergunta
                <input type="text" data-field="question" name="items[<?= (int)$index ?>][question]" maxlength="500" value="<?= faqs_h($item['question']) ?>" placeholder="Escreve aqui a pergunta">
              </label>
              <div class="faq-rich-wrap">
                <span class="faq-rich-label">Resposta</span>
                <div class="faq-rich-toolbar" role="toolbar" aria-label="Formatar resposta">
                  <button type="button" data-rich-command="bold" aria-label="Negrito"><strong>B</strong></button>
                  <button type="button" data-rich-command="italic" aria-label="Itálico"><em>I</em></button>
                  <button type="button" data-rich-command="insertUnorderedList">• Lista</button>
                  <button type="button" data-rich-command="insertOrderedList">1. Lista</button>
                  <button type="button" data-rich-command="createLink">Link</button>
                  <button type="button" data-rich-command="unlink">Tirar link</button>
                </div>
                <div class="faq-rich-link-panel" data-rich-link-panel hidden>
                  <label>Endereço do link
                    <input type="text" data-rich-link-url placeholder="contacto.html ou https://..." autocomplete="off">
                  </label>
                  <button type="button" data-rich-link-apply>Aplicar</button>
                  <button type="button" data-rich-link-cancel>Cancelar</button>
                  <p class="faq-rich-link-status" data-rich-link-status aria-live="polite"></p>
                </div>
                <div class="faq-rich-editor" contenteditable="true" role="textbox" aria-multiline="true" data-rich-editor data-placeholder="Escreve aqui a resposta."><?= $item['answerHtml'] ?></div>
                <textarea hidden data-field="answerHtml" data-rich-input maxlength="30000"><?= faqs_h($item['answerHtml']) ?></textarea>
              </div>
              <label class="faq-visible">
                <input type="checkbox" data-field="enabled" name="items[<?= (int)$index ?>][enabled]" value="1"<?= $item['enabled'] ? ' checked' : '' ?>>
                Mostrar no site
              </label>
            </div>
          </article>
        <?php endforeach; ?>
      </div>
      <button type="button" class="add" data-add>+ Adicionar pergunta</button>
      <p class="hint">A ordem aqui é a ordem da página. Uma pergunta incompleta ou sem o visto “Mostrar no site” não aparece publicamente.</p>
    </form>
  </main>

  <div class="save-bar">
    <span class="save-note" data-save-note>Nada toca no site antes de carregares em <strong>Guardar</strong>.</span>
    <button type="button" data-reset>Repor</button>
    <button type="submit" form="faqsForm" class="primary" data-save>Guardar</button>
  </div>

  <template id="faqRowTemplate">
    <article class="faq-row" data-faq-row>
      <header class="faq-row-head">
        <strong>FAQ <span data-row-number></span></strong>
        <button type="button" data-action="up" aria-label="Subir pergunta">↑ Subir</button>
        <button type="button" data-action="down" aria-label="Descer pergunta">↓ Descer</button>
        <button type="button" class="danger" data-action="remove">Remover</button>
      </header>
      <div class="faq-row-body">
        <input type="hidden" data-field="id" value="">
        <label>Pergunta<input type="text" data-field="question" maxlength="500" placeholder="Escreve aqui a pergunta"></label>
        <div class="faq-rich-wrap">
          <span class="faq-rich-label">Resposta</span>
          <div class="faq-rich-toolbar" role="toolbar" aria-label="Formatar resposta">
            <button type="button" data-rich-command="bold" aria-label="Negrito"><strong>B</strong></button>
            <button type="button" data-rich-command="italic" aria-label="Itálico"><em>I</em></button>
            <button type="button" data-rich-command="insertUnorderedList">• Lista</button>
            <button type="button" data-rich-command="insertOrderedList">1. Lista</button>
            <button type="button" data-rich-command="createLink">Link</button>
            <button type="button" data-rich-command="unlink">Tirar link</button>
          </div>
          <div class="faq-rich-link-panel" data-rich-link-panel hidden>
            <label>Endereço do link
              <input type="text" data-rich-link-url placeholder="contacto.html ou https://..." autocomplete="off">
            </label>
            <button type="button" data-rich-link-apply>Aplicar</button>
            <button type="button" data-rich-link-cancel>Cancelar</button>
            <p class="faq-rich-link-status" data-rich-link-status aria-live="polite"></p>
          </div>
          <div class="faq-rich-editor" contenteditable="true" role="textbox" aria-multiline="true" data-rich-editor data-placeholder="Escreve aqui a resposta."></div>
          <textarea hidden data-field="answerHtml" data-rich-input maxlength="30000"></textarea>
        </div>
        <label class="faq-visible"><input type="checkbox" data-field="enabled" value="1" checked> Mostrar no site</label>
      </div>
    </article>
  </template>

  <script src="admin-nav.js?v=20260908013100"></script>
  <script>
  (function () {
    "use strict";
    var form = document.getElementById("faqsForm");
    var rows = document.querySelector("[data-faq-rows]");
    var template = document.getElementById("faqRowTemplate");
    var dirty = false;

    function setDirty(value) {
      dirty = value;
      document.querySelectorAll("[data-save]").forEach(function (button) {
        button.textContent = value ? "Guardar alterações" : "Guardar";
      });
    }

    function syncRichRow(row) {
      var editor = row.querySelector("[data-rich-editor]");
      var input = row.querySelector("[data-rich-input]");
      if (editor && input) { input.value = editor.innerHTML; }
    }

    function syncAllRich() {
      rows.querySelectorAll("[data-faq-row]").forEach(syncRichRow);
    }

    function rememberRichSelection(editor) {
      var selection = window.getSelection();
      var range;
      if (!selection || !selection.rangeCount) { return; }
      range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        editor.faqSelectionRange = range.cloneRange();
      }
    }

    function restoreRichSelection(editor) {
      var selection;
      if (!editor.faqSelectionRange) { return; }
      selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(editor.faqSelectionRange);
    }

    function safeEditorHref(value) {
      var href = String(value || "").trim();
      var scheme;
      if (!href || /[\u0000-\u001f\u007f]/.test(href) || href.indexOf("//") === 0) { return ""; }
      scheme = href.match(/^([a-z][a-z0-9+.-]*):/i);
      if (scheme && !/^(https?|mailto|tel)$/i.test(scheme[1])) { return ""; }
      return href;
    }

    function reindex() {
      var allRows = Array.prototype.slice.call(rows.querySelectorAll("[data-faq-row]"));
      allRows.forEach(function (row, index) {
        row.querySelector("[data-row-number]").textContent = String(index + 1);
        row.querySelectorAll("[data-field]").forEach(function (field) {
          field.name = "items[" + index + "][" + field.dataset.field + "]";
        });
        row.querySelector('[data-action="up"]').disabled = index === 0;
        row.querySelector('[data-action="down"]').disabled = index === allRows.length - 1;
      });
    }

    function addRow() {
      rows.appendChild(template.content.cloneNode(true));
      reindex();
      setDirty(true);
      var added = rows.lastElementChild;
      if (added) { added.querySelector('[data-field="question"]').focus(); }
    }

    document.querySelector("[data-add]").addEventListener("click", addRow);
    rows.addEventListener("mousedown", function (event) {
      var richButton = event.target.closest("[data-rich-command]");
      var editor;
      if (richButton) {
        editor = richButton.closest("[data-faq-row]").querySelector("[data-rich-editor]");
        rememberRichSelection(editor);
        event.preventDefault();
      }
    });
    rows.addEventListener("click", function (event) {
      var richButton = event.target.closest("[data-rich-command]");
      var linkApply = event.target.closest("[data-rich-link-apply]");
      var linkCancel = event.target.closest("[data-rich-link-cancel]");
      var button = event.target.closest("[data-action]");
      var row;
      var action;
      var editor;
      var link;
      var panel;
      var status;
      var selection;
      if (linkApply || linkCancel) {
        row = event.target.closest("[data-faq-row]");
        editor = row.querySelector("[data-rich-editor]");
        panel = row.querySelector("[data-rich-link-panel]");
        status = panel.querySelector("[data-rich-link-status]");
        if (linkCancel) {
          panel.hidden = true;
          status.textContent = "";
          editor.focus();
          restoreRichSelection(editor);
          return;
        }
        link = safeEditorHref(panel.querySelector("[data-rich-link-url]").value);
        if (!link) {
          status.textContent = "Escreve um endereço HTTP(S), mailto:, tel: ou relativo.";
          panel.querySelector("[data-rich-link-url]").focus();
          return;
        }
        editor.focus();
        restoreRichSelection(editor);
        selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          status.textContent = "Selecciona primeiro o texto que deve ficar ligado.";
          return;
        }
        document.execCommand("createLink", false, link);
        panel.hidden = true;
        panel.querySelector("[data-rich-link-url]").value = "";
        status.textContent = "";
        rememberRichSelection(editor);
        syncRichRow(row);
        setDirty(true);
        return;
      }
      if (richButton) {
        row = richButton.closest("[data-faq-row]");
        editor = row.querySelector("[data-rich-editor]");
        action = richButton.dataset.richCommand;
        editor.focus();
        restoreRichSelection(editor);
        if (action === "createLink") {
          panel = row.querySelector("[data-rich-link-panel]");
          status = panel.querySelector("[data-rich-link-status]");
          selection = window.getSelection();
          panel.hidden = false;
          status.textContent = !selection || selection.isCollapsed
            ? "Selecciona primeiro o texto que deve ficar ligado."
            : "";
          if (status.textContent) {
            editor.focus();
          } else {
            panel.querySelector("[data-rich-link-url]").focus();
          }
          return;
        } else {
          document.execCommand(action, false, null);
        }
        rememberRichSelection(editor);
        syncRichRow(row);
        setDirty(true);
        return;
      }
      if (!button) { return; }
      row = button.closest("[data-faq-row]");
      action = button.dataset.action;
      if (action === "remove") {
        if (rows.querySelectorAll("[data-faq-row]").length === 1) {
          row.querySelectorAll('input[type="text"], textarea, input[type="hidden"]').forEach(function (field) { field.value = ""; });
          row.querySelector("[data-rich-editor]").innerHTML = "";
          row.querySelector('[data-field="enabled"]').checked = true;
        } else {
          row.remove();
        }
      } else if (action === "up" && row.previousElementSibling) {
        rows.insertBefore(row, row.previousElementSibling);
      } else if (action === "down" && row.nextElementSibling) {
        rows.insertBefore(row.nextElementSibling, row);
      }
      reindex();
      setDirty(true);
    });

    form.addEventListener("input", function (event) {
      var richEditor = event.target.closest && event.target.closest("[data-rich-editor]");
      if (richEditor) {
        rememberRichSelection(richEditor);
        syncRichRow(richEditor.closest("[data-faq-row]"));
      }
      setDirty(true);
    });
    form.addEventListener("mouseup", function (event) {
      var richEditor = event.target.closest && event.target.closest("[data-rich-editor]");
      if (richEditor) { rememberRichSelection(richEditor); }
    });
    form.addEventListener("keyup", function (event) {
      var richEditor = event.target.closest && event.target.closest("[data-rich-editor]");
      if (richEditor) { rememberRichSelection(richEditor); }
    });
    form.addEventListener("keydown", function (event) {
      var linkInput = event.target.closest && event.target.closest("[data-rich-link-url]");
      var panel;
      if (!linkInput || (event.key !== "Enter" && event.key !== "Escape")) { return; }
      event.preventDefault();
      panel = linkInput.closest("[data-rich-link-panel]");
      panel.querySelector(event.key === "Enter" ? "[data-rich-link-apply]" : "[data-rich-link-cancel]").click();
    });
    form.addEventListener("change", function () { setDirty(true); });
    form.addEventListener("submit", function () {
      syncAllRich();
      reindex();
      dirty = false;
    });
    document.querySelector("[data-reset]").addEventListener("click", function () {
      if (!dirty || window.confirm("Descartar as alterações ainda não guardadas?")) {
        window.location.reload();
      }
    });
    window.addEventListener("beforeunload", function (event) {
      if (!dirty) { return; }
      event.preventDefault();
      event.returnValue = "";
    });
    syncAllRich();
    reindex();
  }());
  </script>
</body>
</html>