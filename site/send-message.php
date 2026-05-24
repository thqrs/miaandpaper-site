<?php

require_once __DIR__ . '/lib/private-paths.php';

$configPath = mp_private_mail_config_path();

function h($value)
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function home_category_is_visible($category)
{
    if (!is_array($category) || !array_key_exists('available', $category)) {
        return true;
    }

    $value = $category['available'];

    if (is_bool($value)) {
        return $value;
    }

    if (is_numeric($value)) {
        return ((int)$value) !== 0;
    }

    $text = strtolower(trim((string)$value));

    return !in_array($text, array('false', '0', 'no', 'nao', 'não', 'off', 'hidden', 'oculto', 'invisivel', 'invisível'), true);
}

function field($name)
{
    return trim((string)(isset($_POST[$name]) ? $_POST[$name] : ''));
}

function clean_header($value)
{
    return trim(str_replace(array("\r", "\n"), '', (string)$value));
}

function render_home_cards()
{
    $path = __DIR__ . '/content/home.json';
    $home = is_file($path) ? json_decode(file_get_contents($path), true) : array();
    $categories = isset($home['categories']) && is_array($home['categories']) ? $home['categories'] : array();

    if (!$categories) {
        return '';
    }

    $visibleCategories = array_values(array_filter($categories, 'home_category_is_visible'));

    if (!$visibleCategories) {
        return '';
    }

    $gridCount = max(1, min(5, count($visibleCategories)));
    $html = '<nav class="category-grid category-grid-count-' . h($gridCount) . '" aria-label="Categorias">';
    $index = 1;
    foreach ($visibleCategories as $category) {
        $title = isset($category['title']) ? $category['title'] : '';
        $subtitle = isset($category['subtitle']) ? $category['subtitle'] : '';
        $href = isset($category['href']) ? $category['href'] : 'index.html';
        $accent = isset($category['accent']) ? preg_replace('/[^a-z0-9_-]/i', '', $category['accent']) : 'gold';
        $html .= '<a class="category-card ' . h($accent) . '" href="' . h($href) . '">';
        $html .= '<span class="category-number">' . str_pad((string)$index, 2, '0', STR_PAD_LEFT) . '</span>';
        $html .= '<span class="category-art" aria-hidden="true"></span>';
        $html .= '<strong>' . h($title) . '</strong>';
        $html .= '<span>' . h($subtitle) . '</span>';
        $html .= '</a>';
        $index += 1;
    }
    $html .= '</nav>';

    return $html;
}

function render_page($title, $message, $type, $details = array())
{
    http_response_code($type === 'error' ? 400 : 200);
    $cards = $type === 'success' ? render_home_cards() : '';
    ?>
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?php echo h($title); ?> | Mia &amp; Paper</title>
  <link rel="stylesheet" href="styles.css?v=20260524021000">
</head>
<body data-page="contact-result">
  <main class="message-result-shell">
    <header class="site-header">
      <a class="brand" href="index.html" aria-label="Mia & Paper">
        <span class="brand-mark"><img src="content/brand/logo.jpg" alt="" loading="lazy"></span>
        <span>Mia &amp; Paper</span>
      </a>
      <nav class="header-actions" aria-label="Links rápidos">
        <a class="header-link" href="https://www.instagram.com/miaandpaper/" target="_blank" rel="noopener">Instagram</a>
        <span class="header-separator" aria-hidden="true">|</span>
        <a class="header-link" href="contacto.html">Enviar Mensagem</a>
      </nav>
    </header>

    <section class="message-result-card <?php echo h($type); ?>">
      <p class="eyebrow"><?php echo $type === 'success' ? 'Mensagem enviada' : 'Não foi possível enviar'; ?></p>
      <h1><?php echo h($title); ?></h1>
      <p><?php echo h($message); ?></p>
      <?php if ($details): ?>
        <ul>
          <?php foreach ($details as $detail): ?>
            <li><?php echo h($detail); ?></li>
          <?php endforeach; ?>
        </ul>
      <?php endif; ?>
      <div class="result-actions">
        <a class="button primary" href="index.html">Voltar à página inicial</a>
        <a class="button secondary" href="contacto.html">Enviar outra mensagem</a>
      </div>
    </section>

    <?php echo $cards; ?>

    <footer class="site-footer">
      <a href="privacy.html">Política de Privacidade</a>
      <span>© Mia &amp; Paper 2026 Todos os Direitos Reservados</span>
    </footer>
  </main>
</body>
</html>
    <?php
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: contacto.html');
    exit;
}

if (field('website') !== '') {
    render_page('Mensagem enviada.', 'Mensagem enviada. A Mia, ou um representante, vai entrar em contacto contigo em breve.', 'success');
}

$name = clean_header(field('name'));
$contact = clean_header(field('contact'));
$subjectType = clean_header(field('subject_type'));
$message = trim((string)(isset($_POST['message']) ? $_POST['message'] : ''));
$sendCopy = isset($_POST['send_copy']);

$allowedSubjects = array('Encomendas', 'Pedidos Especiais', 'Dúvidas', 'Outro Assunto');
$errors = array();

if ($name === '') {
    $errors[] = 'Indica o teu nome.';
}
if ($contact === '') {
    $errors[] = 'Indica um contacto.';
}
if (!in_array($subjectType, $allowedSubjects, true)) {
    $errors[] = 'Escolhe um assunto válido.';
}
if ($message === '') {
    $errors[] = 'Escreve a mensagem.';
}
if ($sendCopy && !filter_var($contact, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Para receberes uma cópia, o contacto tem de ser um email válido.';
}

if ($errors) {
    render_page('Faltam alguns dados.', 'Revê o formulário e tenta novamente.', 'error', $errors);
}

if (!$configPath || !is_file($configPath)) {
    render_page('Falta configurar o envio.', 'O formulário está pronto, mas falta o ficheiro privado de configuração.', 'error', array('Ficheiro esperado: ' . $configPath));
}

$config = require $configPath;
if (!is_array($config)) {
    render_page('Configuração inválida.', 'O ficheiro privado existe, mas não devolve a configuração esperada.', 'error');
}

$recipient = clean_header(isset($config['to']) ? $config['to'] : '');
$from = clean_header(isset($config['from']) ? $config['from'] : 'no-reply@miaandpaper.com');

if (!filter_var($recipient, FILTER_VALIDATE_EMAIL) || !filter_var($from, FILTER_VALIDATE_EMAIL)) {
    render_page('Configuração inválida.', 'O email de destino ou de envio não está válido no ficheiro privado.', 'error');
}

$subject = 'Mensagem do site - ' . $subjectType;
$body = array(
    'Nova mensagem recebida no site Mia & Paper.',
    '',
    'Nome: ' . $name,
    'Contacto: ' . $contact,
    'Assunto: ' . $subjectType,
    'Cópia pedida: ' . ($sendCopy ? 'Sim' : 'Não'),
    '',
    'Mensagem:',
    $message,
);

$headers = array(
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'From: "Mia & Paper" <' . $from . '>',
    'Reply-To: ' . (filter_var($contact, FILTER_VALIDATE_EMAIL) ? $contact : $from),
    'X-Mailer: PHP/' . phpversion(),
);

$sent = mail($recipient, $subject, implode("\r\n", $body), implode("\r\n", $headers), '-f' . $from);

if (!$sent) {
    render_page('Não foi possível enviar.', 'O servidor não conseguiu enviar o email. Tenta novamente ou envia mensagem pelo Instagram.', 'error');
}

if ($sendCopy && filter_var($contact, FILTER_VALIDATE_EMAIL)) {
    $copyBody = array(
        'Olá ' . $name . ',',
        '',
        'A tua mensagem foi recebida no site Mia & Paper. Esta é a cópia automática do que enviaste:',
        '',
        'Assunto: ' . $subjectType,
        '',
        $message,
        '',
        'A Mia responde-te assim que conseguir.',
    );
    $copyHeaders = array(
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: "Mia & Paper" <' . $from . '>',
        'Reply-To: "Mia & Paper" <' . $from . '>',
        'X-Mailer: PHP/' . phpversion(),
    );
    mail($contact, 'Cópia da tua mensagem - Mia & Paper', implode("\r\n", $copyBody), implode("\r\n", $copyHeaders), '-f' . $from);
}

render_page('Mensagem enviada.', 'Mensagem enviada. A Mia, ou um representante, vai entrar em contacto contigo em breve. Podes voltar à página inicial ou fazer outro pedido.', 'success');
