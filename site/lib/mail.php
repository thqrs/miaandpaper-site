<?php
/**
 * lib/mail.php — ADMIN_EMAIL_ACTIONS_V1
 *
 * Wrapper minimal sobre mail() reutilizando a configuração existente do
 * site (ficheiro em $configPath, fora do public root). Helpers para
 * envios automáticos despoletados pelo painel de encomendas:
 *
 *   mp_mail_config()              — carrega config (cached por request)
 *   mp_mail_send($to, $subject, $body)
 *   mp_mail_send_paid_for_order($order)
 *   mp_mail_send_shipped_for_order($order)
 *
 * Cada helper de "envio for_order" valida que o destinatário é um email
 * válido, faz o envio, e regista a tentativa em email_log. Devolve um
 * array {success: bool, error: ?string, recipient: string|null}.
 */

require_once __DIR__ . '/db.php';

function mp_mail_config()
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $path = getenv('MIAANDPAPER_MAIL_CONFIG');
    if (!$path) {
        $path = '/home/currwkdi/private/miaandpaper-mail-config.php';
    }

    if (!is_file($path)) {
        $config = array('to' => null, 'from' => null, 'error' => 'config-missing');
        return $config;
    }

    $loaded = require $path;
    if (!is_array($loaded)) {
        $config = array('to' => null, 'from' => null, 'error' => 'config-invalid');
        return $config;
    }

    $config = array(
        'to'   => isset($loaded['to']) ? trim((string)$loaded['to']) : '',
        'from' => isset($loaded['from']) ? trim((string)$loaded['from']) : 'no-reply@miaandpaper.com',
        'error' => null,
    );
    return $config;
}

/**
 * Envia um email simples em text/plain. Devolve array com:
 *   - success (bool)
 *   - error   (string|null) — descrição curta da falha
 */
function mp_mail_send($to, $subject, $body)
{
    $to = trim((string)$to);
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return array('success' => false, 'error' => 'destinatário não é email válido');
    }

    $config = mp_mail_config();
    if (!empty($config['error']) || empty($config['from'])) {
        return array('success' => false, 'error' => 'config indisponível (' . ($config['error'] ?: 'sem from') . ')');
    }

    $from = $config['from'];
    $headers = implode("\r\n", array(
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: "Mia & Paper" <' . $from . '>',
        'Reply-To: "Mia & Paper" <' . $from . '>',
        'X-Mailer: PHP/' . phpversion(),
    ));

    $cleanSubject = trim(str_replace(array("\r", "\n"), '', (string)$subject));
    $ok = @mail($to, $cleanSubject, (string)$body, $headers, '-f' . $from);

    return array(
        'success' => $ok ? true : false,
        'error' => $ok ? null : 'mail() devolveu false',
    );
}

/**
 * Detecta o melhor endereço de email a usar para contactar o cliente.
 * Devolve string vazia se não houver um endereço válido — nesse caso o
 * admin recebe um aviso no painel ("contacto só telemóvel").
 */
function mp_mail_pick_customer_email(array $order)
{
    $candidates = array(
        isset($order['contact_email']) ? $order['contact_email'] : '',
        isset($order['customer_contact']) ? $order['customer_contact'] : '',
    );
    foreach ($candidates as $c) {
        $c = trim((string)$c);
        if ($c !== '' && filter_var($c, FILTER_VALIDATE_EMAIL)) {
            return $c;
        }
    }
    return '';
}

function mp_mail_send_paid_for_order(array $order)
{
    $email = mp_mail_pick_customer_email($order);
    $name = isset($order['customer_name']) && trim((string)$order['customer_name']) !== ''
        ? trim((string)$order['customer_name'])
        : 'Olá';
    $code = isset($order['order_code']) ? $order['order_code'] : '';
    $subject = 'Pagamento confirmado — encomenda ' . $code;
    $body = implode("\n", array(
        'Olá ' . $name . ',',
        '',
        'Confirmámos o pagamento da tua encomenda ' . $code . '.',
        'A encomenda vai agora começar a ser preparada.',
        '',
        'Obrigada,',
        'Mia & Paper',
    ));

    if ($email === '') {
        $logged = mp_db_log_email(array(
            'order_id' => (int)$order['id'],
            'email_type' => 'paid_confirmed',
            'recipient' => '',
            'subject' => $subject,
            'success' => 0,
            'error_message' => 'cliente não tem email válido',
        ));
        return array('success' => false, 'error' => 'cliente não tem email válido', 'recipient' => null, 'log_id' => $logged);
    }

    $result = mp_mail_send($email, $subject, $body);
    $logged = mp_db_log_email(array(
        'order_id' => (int)$order['id'],
        'email_type' => 'paid_confirmed',
        'recipient' => $email,
        'subject' => $subject,
        'success' => $result['success'] ? 1 : 0,
        'error_message' => $result['error'],
    ));
    $result['recipient'] = $email;
    $result['log_id'] = $logged;
    return $result;
}

function mp_mail_send_shipped_for_order(array $order, $trackingNumber)
{
    $email = mp_mail_pick_customer_email($order);
    $name = isset($order['customer_name']) && trim((string)$order['customer_name']) !== ''
        ? trim((string)$order['customer_name'])
        : 'Olá';
    $code = isset($order['order_code']) ? $order['order_code'] : '';
    $tracking = trim((string)$trackingNumber);
    $trackingLine = $tracking !== ''
        ? 'Número de acompanhamento:' . "\n" . $tracking
        : 'Foi enviada sem número de acompanhamento.';

    $subject = 'A tua encomenda foi enviada — ' . $code;
    $body = implode("\n", array(
        'Olá ' . $name . ',',
        '',
        'A tua encomenda ' . $code . ' foi enviada.',
        '',
        $trackingLine,
        '',
        'Obrigada,',
        'Mia & Paper',
    ));

    if ($email === '') {
        $logged = mp_db_log_email(array(
            'order_id' => (int)$order['id'],
            'email_type' => 'shipped',
            'recipient' => '',
            'subject' => $subject,
            'success' => 0,
            'error_message' => 'cliente não tem email válido',
        ));
        return array('success' => false, 'error' => 'cliente não tem email válido', 'recipient' => null, 'log_id' => $logged);
    }

    $result = mp_mail_send($email, $subject, $body);
    $logged = mp_db_log_email(array(
        'order_id' => (int)$order['id'],
        'email_type' => 'shipped',
        'recipient' => $email,
        'subject' => $subject,
        'success' => $result['success'] ? 1 : 0,
        'error_message' => $result['error'],
    ));
    $result['recipient'] = $email;
    $result['log_id'] = $logged;
    return $result;
}
