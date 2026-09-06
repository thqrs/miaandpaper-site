<?php

// ORDERS_SQLITE_V1: a camada de persistência foi adicionada nesta fase.
// O ficheiro lib/db.php é carregado tolerantemente — se SQLite não estiver
// disponível, o site continua a enviar pedidos por email (comportamento
// antigo), mas mp_db() lança e tratamos isso explicitamente no fluxo.
require_once __DIR__ . '/lib/private-paths.php';
require_once __DIR__ . '/lib/db.php';
// PRECOS_CORE_V1: as funcoes de calculo e validacao de preco vivem em
// lib/precos-core.php, para o editor (precos.php) validar com exactamente o
// mesmo codigo que aqui recusa a encomenda. Nao redefinir nenhuma delas aqui.
require_once __DIR__ . '/lib/precos-core.php';

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

function parse_email_recipients($value)
{
    $raw = clean_header($value);
    if ($raw === '') {
        return array();
    }

    $parts = preg_split('/[;,]+/', $raw);
    $emails = array();

    foreach ($parts as $part) {
        $email = trim((string)$part);
        if ($email === '') {
            continue;
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return false;
        }
        $emails[strtolower($email)] = $email;
    }

    return array_values($emails);
}

function safe_return_to()
{
    $returnTo = field('return_to');
    $allowed = array('index.html', 'molduras.html', 'quadros.html', 'crachas.html', 'pins.html', 'cadernos.html', 'caderninhos.html', 'mini-cadernos.html', 'blocos-a6.html', 'bloquinhos.html', 'cadernos-anuais.html', 'agendas.html', 'imanes.html', 'imanes-recortados.html', 'stickers.html', 'marcadores.html', 'marcadores-magneticos.html', 'porta-chaves.html', 'pasta-de-folhetos.html', 'lembrancas.html', 'personalizacao.html', 'adicionar-produto.html', 'checkout.html');

    if (in_array($returnTo, $allowed, true)) {
        return $returnTo;
    }

    return 'index.html';
}

function safe_product_slug()
{
    $slug = strtolower(field('product_slug'));
    $allowed = array('quadros', 'crachas', 'pins', 'cadernos', 'caderninhos', 'imanes', 'lembrancas', 'crachas-loja', 'imanes-loja', 'imanes-recortados', 'mini-cadernos', 'blocos-a6', 'bloquinhos', 'cadernos-anuais', 'agendas', 'stickers', 'marcadores', 'marcadores-magneticos', 'porta-chaves', 'pasta-de-folhetos', 'personalizacao');

    if (in_array($slug, $allowed, true)) {
        return $slug;
    }

    return 'crachas';
}

function posted_list($name)
{
    $values = isset($_POST[$name]) ? $_POST[$name] : array();
    if (!is_array($values)) {
        $values = array($values);
    }

    $clean = array();
    foreach ($values as $value) {
        $value = trim((string)$value);
        if ($value !== '') {
            $clean[] = $value;
        }
    }

    return $clean;
}

function format_euros($cents)
{
    $formatted = number_format(((int)$cents) / 100, 2, ',', '');
    return preg_replace('/,00$/', '', $formatted) . ' €';
}

function format_unit_price($cents, $quantity, $unit)
{
    if ($quantity <= 0) {
        return '';
    }

    return number_format(((int)$cents) / 100 / (int)$quantity, 2, ',', '') . ' €/' . $unit;
}

function payment_debug_requested()
{
    $value = isset($_GET['checkout_debug']) ? strtolower(trim((string)$_GET['checkout_debug'])) : '';
    return in_array($value, array('1', 'true', 'yes', 'sim', 'on'), true);
}

function payment_country_code_from_server()
{
    $geoip = isset($_SERVER['GEOIP_COUNTRY_CODE']) ? strtoupper(trim((string)$_SERVER['GEOIP_COUNTRY_CODE'])) : '';
    if (preg_match('/^[A-Z]{2}$/', $geoip)) {
        return $geoip;
    }

    $remote = isset($_SERVER['REMOTE_ADDR']) ? mp_client_ip_normalize($_SERVER['REMOTE_ADDR']) : '';
    if ($remote === '' || !mp_client_ip_remote_is_trusted($remote)) {
        return '';
    }

    foreach (array('HTTP_CF_IPCOUNTRY', 'HTTP_X_COUNTRY_CODE') as $header) {
        $value = isset($_SERVER[$header]) ? strtoupper(trim((string)$_SERVER[$header])) : '';
        if (preg_match('/^[A-Z]{2}$/', $value)) {
            return $value;
        }
    }

    return '';
}

function payment_country_code_for_ip($ip)
{
    $serverCode = payment_country_code_from_server();
    if ($serverCode !== '') {
        return $serverCode;
    }

    $ip = mp_db_normalize_ip($ip);
    if ($ip === '' || !mp_tracking_ip_is_public($ip)) {
        return '';
    }

    $cached = mp_ip_lookup_get($ip);
    $cachedCode = is_array($cached) && !empty($cached['country_code'])
        ? strtoupper(trim((string)$cached['country_code']))
        : '';
    if (preg_match('/^[A-Z]{2}$/', $cachedCode)) {
        return $cachedCode;
    }

    // CHECKOUT_COUNTRY_V1: consulta mínima, só para decidir se as instruções
    // de MB WAY podem ser mostradas. Não pede cidade, operador, coordenadas
    // nem guarda a resposta completa usada pelo enriquecimento do painel.
    $body = mp_ip_lookup_http_get(
        'https://ipwho.is/' . rawurlencode($ip) . '?fields=success,country_code,is_eu',
        array('Accept: application/json'),
        2
    );
    $data = is_string($body) ? json_decode($body, true) : null;
    $countryCode = is_array($data) && !empty($data['success']) && !empty($data['country_code'])
        ? strtoupper(trim((string)$data['country_code']))
        : '';

    if (!preg_match('/^[A-Z]{2}$/', $countryCode)) {
        return '';
    }

    mp_ip_lookup_save($ip, array(
        'country_code' => $countryCode,
        'country_name' => '',
        'source' => 'ipwho.is-country',
        'raw_json' => null,
        'lookup_error' => '',
        'last_checked_at' => mp_db_now(),
    ));

    return $countryCode;
}

function payment_country_is_eu($countryCode)
{
    return in_array(strtoupper(trim((string)$countryCode)), array(
        'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
        'FR', 'GR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL',
        'PT', 'RO', 'SE', 'SI', 'SK',
    ), true);
}

function payment_delivery_is_eligible($deliveryOption, $customerName, $customerContact, $ipNumber)
{
    if ($deliveryOption === 'shipping') {
        return true;
    }
    if ($deliveryOption !== 'join_orders') {
        return false;
    }

    return (bool)mp_db_find_open_shipping_order($customerName, $customerContact, $ipNumber);
}

function payment_instagram_url()
{
    $fallback = 'https://www.instagram.com/miaandpaper/';
    $path = __DIR__ . '/content/home.json';
    if (!is_file($path)) {
        return $fallback;
    }
    $home = json_decode(file_get_contents($path), true);
    $url = is_array($home) && !empty($home['instagramUrl']) ? trim((string)$home['instagramUrl']) : '';
    return preg_match('#^https://#i', $url) ? $url : $fallback;
}

function payment_success_details($totalCents, $customerContact, $items, $shippingCents, $deliveryEligible, $hasPriceToConfirm, $ipNumber)
{
    if ($hasPriceToConfirm || !$deliveryEligible || (int)$totalCents <= 0) {
        return null;
    }

    $countryCode = payment_country_code_for_ip($ipNumber);
    if (!payment_country_is_eu($countryCode)) {
        return null;
    }

    return array(
        'total_cents' => (int)$totalCents,
        'contact' => trim((string)$customerContact),
        'items' => is_array($items) ? $items : array(),
        'shipping_cents' => max(0, (int)$shippingCents),
        'mbway_number' => '96 300 16 05',
        'instagram_url' => payment_instagram_url(),
        'country_code' => $countryCode,
    );
}

function parse_design_quantities($values)
{
    $quantities = array();

    foreach ($values as $value) {
        $parts = explode('||', $value, 2);
        if (count($parts) !== 2) {
            continue;
        }

        $design = trim($parts[0]);
        $quantity = (int)$parts[1];

        if ($design !== '' && $quantity > 0) {
            $quantities[$design] = $quantity;
        }
    }

    return $quantities;
}

// SECTION_DISPLAY_LABELS_V1: parser para a array paralela design_labels[]
// (item.value || displayLabel). Devolve mapa designValue => displayLabel.
function parse_design_labels($values)
{
    $labels = array();

    foreach ($values as $value) {
        $parts = explode('||', $value, 2);
        if (count($parts) !== 2) {
            continue;
        }

        $design = trim($parts[0]);
        $label = trim($parts[1]);

        if ($design !== '' && $label !== '') {
            $labels[$design] = $label;
        }
    }

    return $labels;
}

function load_product_config($slug)
{
    $congressSlugs = array('crachas', 'imanes', 'caderninhos', 'cadernos');
    $base = in_array((string)$slug, $congressSlugs, true)
        ? __DIR__ . '/congressos/2026/content/products/'
        : __DIR__ . '/content/products/';
    $path = $base . $slug . '.json';

    if (!is_file($path)) {
        return array();
    }

    $data = json_decode(file_get_contents($path), true);

    if (!is_array($data)) {
        return array();
    }

    apply_central_option_extras($data, central_option_extras($base));
    return $data;
}

// EXTRAS_CENTRAIS_V1: o mesmo acabamento aparece no `finishOptions` de dez
// produtos, na gaveta de outros e ainda no catalogo da personalizacao — sempre
// pelo mesmo nome e sempre pelo mesmo valor. O bloco `optionExtras` do
// pricing.json passa a mandar em todos, aqui como no browser. O par disto em JS
// e `applyCentralOptionExtras()` em js/10-produto-precos.js.
//
// A capsula do congresso le o seu proprio pricing.json: se la nao houver bloco
// nenhum, nada e substituido e ela fica exatamente como esta.
function central_option_extras($base)
{
    static $cache = array();

    $path = rtrim(str_replace('content/products/', 'content/', $base), '/') . '/pricing.json';
    if (isset($cache[$path])) {
        return $cache[$path];
    }

    $extras = array();
    $raw = @file_get_contents($path);
    if ($raw !== false) {
        $data = json_decode($raw, true);
        if (is_array($data) && !empty($data['optionExtras']) && is_array($data['optionExtras'])) {
            foreach ($data['optionExtras'] as $chave => $cents) {
                $extras[(string)$chave] = max(0, (int)$cents);
            }
        }
    }
    $cache[$path] = $extras;
    return $extras;
}

function apply_central_option_extras(&$node, $extras)
{
    if (empty($extras) || !is_array($node)) {
        return;
    }

    // A chave e o `value` da opcao; um passo inteiro (a personalizacao da capa)
    // nao tem `value`, por isso vale tambem o `id`.
    $chave = '';
    if (isset($node['value']) && is_scalar($node['value'])) {
        $chave = (string)$node['value'];
    } elseif (isset($node['id']) && is_scalar($node['id'])) {
        $chave = (string)$node['id'];
    }
    if ($chave !== '' && isset($extras[$chave])) {
        foreach (array('extraPriceCents', 'extraPriceCentsPerUnit') as $campo) {
            if (isset($node[$campo]) && is_numeric($node[$campo])) {
                $node[$campo] = $extras[$chave];
            }
        }
    }

    foreach ($node as $k => $filho) {
        if (is_array($filho)) {
            apply_central_option_extras($node[$k], $extras);
        }
    }
}

function load_pricing_product($slug)
{
    $congressSlugs = array('crachas', 'imanes', 'caderninhos', 'cadernos');
    $path = in_array((string)$slug, $congressSlugs, true)
        ? __DIR__ . '/congressos/2026/content/pricing.json'
        : __DIR__ . '/content/pricing.json';

    if (!is_file($path)) {
        return array();
    }
    $data = json_decode(file_get_contents($path), true);
    return !empty($data['products'][$slug]) && is_array($data['products'][$slug])
        ? $data['products'][$slug]
        : array();
}

function load_main_pricing_settings()
{
    static $settings = null;

    if ($settings !== null) {
        return $settings;
    }

    $path = __DIR__ . '/content/pricing.json';
    if (!is_file($path)) {
        $settings = array();
        return $settings;
    }

    $data = json_decode(file_get_contents($path), true);
    $settings = !empty($data['settings']) && is_array($data['settings'])
        ? $data['settings']
        : array();

    return $settings;
}

function product_step($product, $id)
{
    if (empty($product['steps']) || !is_array($product['steps'])) {
        return array();
    }

    foreach ($product['steps'] as $step) {
        if (isset($step['id']) && $step['id'] === $id) {
            return is_array($step) ? $step : array();
        }
    }

    return array();
}

function product_has_card_details_step($product)
{
    $step = product_step($product, 'details');
    if (empty($step) || empty($step['template']) || $step['template'] !== 'details-form') {
        return false;
    }
    if (!empty($step['fields']) && is_array($step['fields'])) {
        foreach ($step['fields'] as $f) {
            if (isset($f['name']) && in_array($f['name'], array('recipient_name', 'congregation'), true)) {
                return true;
            }
        }
    }
    return false;
}

function product_cover_personalization_questions($personalizationStep, $selectedSize = '')
{
    if (empty($personalizationStep) || !is_array($personalizationStep)) {
        return array();
    }

    $questions = !empty($personalizationStep['questions']) && is_array($personalizationStep['questions'])
        ? $personalizationStep['questions']
        : array(array(
            'id' => 'cover_personalization',
            'label' => 'Personalização da capa',
            'field' => 'cover_personalization',
            'textField' => 'cover_personalization_text',
            'title' => !empty($personalizationStep['title']) ? $personalizationStep['title'] : 'Personalização da capa',
            'maxLength' => isset($personalizationStep['maxLength']) ? (int)$personalizationStep['maxLength'] : 25,
            'extraPriceCents' => isset($personalizationStep['extraPriceCents']) ? (int)$personalizationStep['extraPriceCents'] : 0,
            'sizes' => array()
        ));

    $currentSize = (string)$selectedSize;
    $result = array();
    foreach ($questions as $q) {
        if (!is_array($q)) {
            continue;
        }
        $sizes = isset($q['sizes']) && is_array($q['sizes']) ? array_map('strval', $q['sizes']) : array();
        if (!empty($sizes) && $currentSize !== '' && !in_array($currentSize, $sizes, true)) {
            continue;
        }
        $result[] = array(
            'id' => isset($q['id']) ? (string)$q['id'] : 'cover_personalization',
            'label' => isset($q['label']) ? (string)$q['label'] : 'Personalização da capa',
            'field' => isset($q['field']) ? (string)$q['field'] : 'cover_personalization',
            'textField' => isset($q['textField']) ? (string)$q['textField'] : 'cover_personalization_text',
            'title' => isset($q['title']) ? (string)$q['title'] : 'Personalização da capa',
            'maxLength' => isset($q['maxLength']) ? (int)$q['maxLength'] : (isset($personalizationStep['maxLength']) ? (int)$personalizationStep['maxLength'] : 25),
            'extraPriceCents' => isset($q['extraPriceCents']) ? (int)$q['extraPriceCents'] : (isset($personalizationStep['extraPriceCents']) ? (int)$personalizationStep['extraPriceCents'] : 0),
            'sizes' => $sizes
        );
    }

    return $result;
}

function product_design_values($product, $fallback)
{
    $step = product_step($product, 'designs');
    $values = array();

    if (!empty($step['items']) && is_array($step['items'])) {
        foreach ($step['items'] as $item) {
            if (!empty($item['value'])) {
                $values[] = (string)$item['value'];
            }
        }
    }

    return !empty($values) ? $values : $fallback;
}

function product_step_values($product, $stepId)
{
    $step = product_step($product, $stepId);
    $values = array();

    if (!empty($step['items']) && is_array($step['items'])) {
        foreach ($step['items'] as $item) {
            if (isset($item['value']) && trim((string)$item['value']) !== '') {
                $values[] = trim((string)$item['value']);
            }
        }
    }

    return $values;
}

function product_step_item_by_value($step, $value)
{
    if (empty($step['items']) || !is_array($step['items'])) {
        return array();
    }

    foreach ($step['items'] as $item) {
        if (isset($item['value']) && (string)$item['value'] === (string)$value) {
            return is_array($item) ? $item : array();
        }
    }

    return array();
}

function product_step_item_by_quantity($step, $quantity)
{
    if (empty($step['items']) || !is_array($step['items'])) {
        return array();
    }

    foreach ($step['items'] as $item) {
        if (isset($item['quantity']) && (int)$item['quantity'] === (int)$quantity) {
            return is_array($item) ? $item : array();
        }
    }

    return array();
}

function product_order_quantity_options($step)
{
    $options = array();
    $config = isset($step['orderQuantity']) && is_array($step['orderQuantity']) ? $step['orderQuantity'] : array();
    $rawOptions = isset($config['options']) && is_array($config['options']) ? $config['options'] : array(1, 2, 3, 4, 5, 10);

    foreach ($rawOptions as $option) {
        $number = (int)$option;
        if ($number > 0 && !in_array($number, $options, true)) {
            $options[] = $number;
        }
    }

    return !empty($options) ? $options : array(1);
}

function product_order_quantity_default($step, $options)
{
    $config = isset($step['orderQuantity']) && is_array($step['orderQuantity']) ? $step['orderQuantity'] : array();
    $default = isset($config['default']) ? (int)$config['default'] : 0;

    return in_array($default, $options, true) ? $default : (int)$options[0];
}

function product_prices($product, $fallback)
{
    $prices = array();

    if (!empty($product['prices']) && is_array($product['prices'])) {
        foreach ($product['prices'] as $size => $packs) {
            if (!is_array($packs)) {
                continue;
            }

            $prices[(string)$size] = array();
            foreach ($packs as $quantity => $cents) {
                $prices[(string)$size][(int)$quantity] = (int)$cents;
            }
        }
    }

    return !empty($prices) ? $prices : $fallback;
}

function load_pricing_prices($slug)
{
    $prices = array();
    $product = load_pricing_product($slug);
    if (empty($product['prices']) || !is_array($product['prices'])) {
        return array();
    }

    foreach ($product['prices'] as $size => $packs) {
        if (!is_array($packs)) {
            continue;
        }

        $prices[(string)$size] = array();
        foreach ($packs as $quantity => $cents) {
            $prices[(string)$size][(int)$quantity] = (int)$cents;
        }
    }

    return $prices;
}

// PORTES_CENTRAIS_V1: os portes viviam duplicados nos 13 JSON de produto e já
// tinham divergido uma vez (5,55 € contra 8,50 €). O valor passou a vir do
// bloco `delivery` do content/pricing.json; o JSON do produto continua a dar a
// estrutura (id, etiqueta, texto) e serve de recurso se o central não tiver a
// opção. O par disto em JS é `applyCentralDeliveryFees()` em
// js/10-produto-precos.js.
function central_delivery_fees()
{
    static $fees = null;
    if ($fees !== null) {
        return $fees;
    }
    $fees = array();
    $raw = @file_get_contents(__DIR__ . '/content/pricing.json');
    if ($raw !== false) {
        $data = json_decode($raw, true);
        if (is_array($data) && !empty($data['delivery']) && is_array($data['delivery'])) {
            foreach ($data['delivery'] as $id => $cents) {
                $fees[(string)$id] = max(0, (int)$cents);
            }
        }
    }
    return $fees;
}

function product_delivery_options($product, $fallback)
{
    $options = array();
    $centrais = central_delivery_fees();

    if (!empty($product['deliveryOptions']) && is_array($product['deliveryOptions'])) {
        foreach ($product['deliveryOptions'] as $option) {
            if (empty($option['id']) || empty($option['label'])) {
                continue;
            }

            $id = (string)$option['id'];
            $label = (string)$option['label'];
            $text = isset($option['text']) ? trim((string)$option['text']) : '';

            $priceText = isset($option['priceText']) ? trim((string)$option['priceText']) : '';
            $options[$id] = array(
                'label' => $text !== '' ? $label . ' - ' . $text : $label,
                'fee_cents' => array_key_exists($id, $centrais)
                    ? $centrais[$id]
                    : (isset($option['feeCents']) ? (int)$option['feeCents'] : 0),
                'price_text' => $priceText,
            );
        }
    }

    return !empty($options) ? $options : $fallback;
}

function cart_allowed_product_slug($slug)
{
    // Slugs validos para uma LINHA do carrinho. `personalizacao` nao entra
    // aqui de proposito: e a pagina de origem, nao um produto — cada linha
    // que sai de la traz o slug do produto real (crachas-loja, marcadores...).
    $slug = strtolower(trim((string)$slug));
    $allowed = array('quadros', 'crachas', 'pins', 'cadernos', 'caderninhos', 'imanes', 'lembrancas', 'crachas-loja', 'imanes-loja', 'imanes-recortados', 'mini-cadernos', 'blocos-a6', 'bloquinhos', 'cadernos-anuais', 'agendas', 'stickers', 'marcadores', 'marcadores-magneticos', 'porta-chaves', 'pasta-de-folhetos');

    return in_array($slug, $allowed, true) ? $slug : '';
}

function cart_text($value)
{
    return trim((string)$value);
}

function cart_clean_funnel_session_id($value)
{
    $value = trim((string)$value);
    return preg_match('/^[A-Za-z0-9._:-]{8,64}$/', $value) ? $value : '';
}

function cart_bool($value)
{
    if (is_bool($value)) {
        return $value;
    }

    $text = strtolower(trim((string)$value));
    return in_array($text, array('1', 'true', 'yes', 'sim', 'on'), true);
}

function cart_selection($selections, $name, $default = '')
{
    if (!is_array($selections) || !array_key_exists($name, $selections)) {
        return $default;
    }

    return $selections[$name];
}

function cart_string_selection($selections, $name, $default = '')
{
    return cart_text(cart_selection($selections, $name, $default));
}

function cart_list_selection($selections, $name)
{
    $value = cart_selection($selections, $name, array());
    $values = is_array($value) ? $value : array($value);
    $clean = array();

    foreach ($values as $item) {
        $text = cart_text($item);
        if ($text !== '') {
            $clean[] = $text;
        }
    }

    return $clean;
}

function quadro_tone_label($tone)
{
    $tone = (int)$tone;
    if ($tone === 0) {
        return 'claro';
    }
    if ($tone === 2) {
        return 'escuro';
    }
    return 'principal';
}

function quadro_color_families($step, $product = array())
{
    if (isset($step['configuredColors']) && is_array($step['configuredColors'])) {
        return $step['configuredColors'];
    }
    if (isset($step['individualColors']) && is_array($step['individualColors'])) {
        return $step['individualColors'];
    }
    if (!empty($step['colorSourceStep']) && is_array($product)) {
        $sourceStep = product_step($product, (string)$step['colorSourceStep']);
        if (!empty($sourceStep) && $sourceStep !== $step) {
            return quadro_color_families($sourceStep, $product);
        }
    }
    return array();
}

// Cada cor escolhida tem uma família e um tom (claro, principal ou escuro).
// Sem o tom e sem o hexadecimal, quem produz o quadro não sabe qual dos três
// tons da família há-de usar.
function quadro_color_label($families, $value, $tone)
{
    $title = cart_text($value);
    $index = max(0, min(2, (int)$tone));
    $hex = '';

    foreach ($families as $family) {
        if (!is_array($family) || !isset($family['value']) || (string)$family['value'] !== (string)$value) {
            continue;
        }
        if (!empty($family['title'])) {
            $title = cart_text($family['title']);
        }
        $stops = isset($family['colorStops']) && is_array($family['colorStops']) ? $family['colorStops'] : array();
        if (isset($stops[$index]) && preg_match('/^#[0-9a-f]{6}$/i', trim((string)$stops[$index]))) {
            $hex = strtolower(trim((string)$stops[$index]));
        } elseif (!empty($family['swatch'])) {
            $hex = strtolower(cart_text($family['swatch']));
        }
        break;
    }

    return $title . ' — tom ' . quadro_tone_label($index) . ($hex !== '' ? ' (' . $hex . ')' : '');
}

function quadro_color_selection_keys($step)
{
    $configured = isset($step['selectionKeys']) && is_array($step['selectionKeys'])
        ? $step['selectionKeys']
        : array();

    return array(
        'colors' => !empty($configured['colors']) ? (string)$configured['colors'] : 'colors',
        'tones' => !empty($configured['tones']) ? (string)$configured['tones'] : 'quadro_color_tones',
        'palette' => !empty($configured['palette']) ? (string)$configured['palette'] : 'color_palette',
        'mia' => !empty($configured['mia']) ? (string)$configured['mia'] : 'mia_choose_colors',
    );
}

function quadro_prepare_color_selection($product, $step, $selections, $count)
{
    $count = max(1, (int)$count);
    $keys = quadro_color_selection_keys($step);
    $families = quadro_color_families($step, $product);
    $allowedValues = array();
    foreach ($families as $family) {
        if (is_array($family) && isset($family['value']) && trim((string)$family['value']) !== '') {
            $allowedValues[] = trim((string)$family['value']);
        }
    }

    $rawColors = cart_selection($selections, $keys['colors'], array());
    $rawTones = cart_selection($selections, $keys['tones'], array());
    $rawColors = is_array($rawColors) ? array_values($rawColors) : array($rawColors);
    $rawTones = is_array($rawTones) ? array_values($rawTones) : array($rawTones);
    $values = array();
    $tones = array();
    $labels = array();
    $pairs = array();
    $individualValid = count($rawColors) === $count && count($rawTones) === $count && !empty($allowedValues);

    for ($index = 0; $index < $count; $index += 1) {
        $value = isset($rawColors[$index]) ? cart_text($rawColors[$index]) : '';
        $toneText = isset($rawTones[$index]) ? trim((string)$rawTones[$index]) : '';
        $toneValid = preg_match('/^[0-2]$/', $toneText) === 1;
        $tone = $toneValid ? (int)$toneText : 1;

        if ($value === '' || !in_array($value, $allowedValues, true) || !$toneValid) {
            $individualValid = false;
            continue;
        }

        $pair = $value . "\x1f" . $tone;
        if (isset($pairs[$pair])) {
            $individualValid = false;
        }
        $pairs[$pair] = true;
        $values[] = $value;
        $tones[] = $tone;
        $labels[] = quadro_color_label($families, $value, $tone);
    }

    $palette = cart_string_selection($selections, $keys['palette']);
    $paletteItem = product_step_item_by_value($step, $palette);
    if (empty($paletteItem) && !empty($step['colorSourceStep'])) {
        $paletteItem = product_step_item_by_value(product_step($product, (string)$step['colorSourceStep']), $palette);
    }
    $paletteColors = array();
    if (!empty($paletteItem['palette']) && is_array($paletteItem['palette'])) {
        foreach (array_slice($paletteItem['palette'], 0, $count) as $paletteColor) {
            $paletteColor = strtolower(trim((string)$paletteColor));
            if (preg_match('/^#[0-9a-f]{6}$/', $paletteColor)) {
                $paletteColors[] = $paletteColor;
            }
        }
    }
    $paletteValid = $palette !== '' && !empty($paletteItem) && count($paletteColors) === $count;
    $mia = cart_bool(cart_selection($selections, $keys['mia'], false));
    $allowMia = !array_key_exists('allowMiaChoice', $step) || !empty($step['allowMiaChoice']);

    if ($mia && $allowMia) {
        $palette = '';
        $paletteItem = array();
        $paletteColors = array();
        $values = array();
        $tones = array();
        $labels = array();
    } elseif ($individualValid) {
        // O valor/tom exacto é a fonte de verdade. A paleta fica apenas como
        // contexto caso a pessoa tenha partido de uma sugestão.
        if (!$paletteValid) {
            $palette = '';
            $paletteItem = array();
            $paletteColors = array();
        }
    } elseif ($paletteValid) {
        $values = array();
        $tones = array();
        $labels = array();
    } else {
        $palette = '';
        $paletteItem = array();
        $paletteColors = array();
    }

    return array(
        'valid' => ($mia && $allowMia) || $individualValid || $paletteValid,
        'mia' => $mia && $allowMia,
        'values' => $values,
        'tones' => $tones,
        'labels' => $labels,
        'palette' => $palette,
        'palette_item' => $paletteItem,
        'palette_colors' => $paletteColors,
    );
}

function product_selected_size_item($product, $value)
{
    return product_step_item_by_value(product_step($product, 'size'), $value);
}

// PERSONALIZACAO_BUILDER_V1: acabamentos opcionais (ex.: laminacao holografica)
// declarados em `finishOptions` no JSON do produto. O extra e por unidade e vem
// do proprio JSON, tal como o `extraPriceCents` da personalizacao da capa dos
// cadernos — o pricing.json continua a ser so a tabela de precos base.
function product_finish_options($product)
{
    return isset($product['finishOptions']) && is_array($product['finishOptions'])
        ? $product['finishOptions']
        : array();
}

function product_finish_option($product, $value)
{
    foreach (product_finish_options($product) as $option) {
        if (is_array($option) && isset($option['value']) && (string)$option['value'] === (string)$value) {
            return $option;
        }
    }
    return array();
}

// Variantes de producao sem impacto no preco (ex.: marcadores com/sem borda),
// declaradas em `variantOptions`.
function product_variant_options($product)
{
    return isset($product['variantOptions']) && is_array($product['variantOptions'])
        ? $product['variantOptions']
        : array();
}

function product_variant_item($variant, $value)
{
    $items = isset($variant['items']) && is_array($variant['items']) ? $variant['items'] : array();
    foreach ($items as $item) {
        if (is_array($item) && isset($item['value']) && (string)$item['value'] === (string)$value) {
            return $item;
        }
    }
    return array();
}

// Condições declaradas nos passos do wizard. O servidor aplica as mesmas
// regras do browser para não exigir nem cobrar opções de um percurso oculto.
function product_step_condition_matches($step, $selections)
{
    $condition = isset($step['when']) && is_array($step['when']) ? $step['when'] : array();
    $field = isset($condition['field']) ? (string)$condition['field'] : '';
    if ($field === '') {
        return true;
    }
    $value = array_key_exists($field, $selections) ? $selections[$field] : null;
    if (array_key_exists('equals', $condition)) {
        return is_array($value)
            ? in_array($condition['equals'], $value, true)
            : $value === $condition['equals'];
    }
    if (isset($condition['in']) && is_array($condition['in'])) {
        if (is_array($value)) {
            return count(array_intersect($value, $condition['in'])) > 0;
        }
        return in_array($value, $condition['in'], true);
    }
    if (array_key_exists('notEquals', $condition)) {
        return is_array($value)
            ? !in_array($condition['notEquals'], $value, true)
            : $value !== $condition['notEquals'];
    }
    return true;
}

// Gavetas de opções do catálogo. Cada escolha pode acrescentar um valor por
// unidade; o servidor volta a ler esse valor no JSON e nunca aceita o preço
// enviado pelo browser. Um passo pode reutilizar as gavetas de outro e mudar
// apenas os campos/rótulos através de drawerOverrides.
function product_option_drawers($product, $selections)
{
    $drawers = array();
    $steps = isset($product['steps']) && is_array($product['steps']) ? $product['steps'] : array();
    foreach ($steps as $step) {
        if (!is_array($step)
            || !isset($step['template'])
            || (string)$step['template'] !== 'option-drawers'
            || !product_step_condition_matches($step, $selections)
        ) {
            continue;
        }
        $drawerStep = $step;
        if (!empty($step['drawersSourceStepId'])) {
            $drawerStep = product_step($product, (string)$step['drawersSourceStepId']);
        }
        $stepDrawers = isset($drawerStep['drawers']) && is_array($drawerStep['drawers']) ? $drawerStep['drawers'] : array();
        $overrides = isset($step['drawerOverrides']) && is_array($step['drawerOverrides']) ? $step['drawerOverrides'] : array();
        if (!empty($stepDrawers)) {
            foreach ($stepDrawers as $drawer) {
                if (is_array($drawer)) {
                    $key = isset($drawer['field']) ? (string)$drawer['field'] : (isset($drawer['id']) ? (string)$drawer['id'] : '');
                    if ($key !== '' && isset($overrides[$key]) && is_array($overrides[$key])) {
                        $drawer = array_merge($drawer, $overrides[$key]);
                    }
                    $drawers[] = $drawer;
                }
            }
        }
    }
    return $drawers;
}

function product_option_drawer_item($drawer, $value, $product = array(), $designs = array())
{
    $items = isset($drawer['items']) && is_array($drawer['items']) ? $drawer['items'] : array();
    $allowed = null;

    // Uma capa pode limitar as opções das gavetas seguintes (por exemplo,
    // as cores de argola/fita disponíveis para esse design). Se o JSON não
    // declarar uma restrição, mantêm-se todas as opções da gaveta.
    if (is_array($product) && count($designs) === 1 && !empty($drawer['field'])) {
        $designStep = product_step($product, 'designs');
        $designItem = product_step_item_by_value($designStep, (string)$designs[0]);
        $availability = isset($designItem['optionAvailability']) && is_array($designItem['optionAvailability'])
            ? $designItem['optionAvailability']
            : array();
        if (isset($availability[$drawer['field']]) && is_array($availability[$drawer['field']])) {
            $allowed = array_map('strval', $availability[$drawer['field']]);
        }
    }

    foreach ($items as $item) {
        $itemValue = is_array($item) && isset($item['value']) ? (string)$item['value'] : '';
        if ($itemValue !== ''
            && $itemValue === (string)$value
            && ($allowed === null || in_array($itemValue, $allowed, true))
        ) {
            return $item;
        }
    }
    return array();
}


// LINEAR_DISCOUNT_PRICING_V1: cada pack define um ponto de desconto. Entre
// dois packs, a percentagem evolui em linha reta; antes do primeiro e depois
// do ultimo mantem-se o desconto do extremo. Os totais dos packs continuam
// exatamente iguais aos configurados no produto.
function product_linear_discount_price_cents($table, $quantity)
{
    if (!is_array($table) || empty($table) || (int)$quantity <= 0) {
        return 0;
    }

    $quantity = (int)$quantity;
    $points = array();
    $baselineUnitCents = isset($table[1]) ? (float)$table[1] : 0.0;
    $hasConfiguredUnit = $baselineUnitCents > 0;

    foreach ($table as $packQuantity => $totalCents) {
        $packQuantity = (int)$packQuantity;
        $totalCents = (float)$totalCents;
        if ($packQuantity <= 0 || $totalCents <= 0) {
            continue;
        }
        if (!$hasConfiguredUnit) {
            $baselineUnitCents = max($baselineUnitCents, $totalCents / $packQuantity);
        }
        $points[$packQuantity] = $totalCents;
    }

    if (empty($points) || $baselineUnitCents <= 0) {
        return 0;
    }
    ksort($points, SORT_NUMERIC);
    if (isset($points[$quantity])) {
        return (int)round($points[$quantity]);
    }

    $quantities = array_keys($points);
    $firstQuantity = (int)$quantities[0];
    $lastQuantity = (int)$quantities[count($quantities) - 1];
    $lowerQuantity = $firstQuantity;
    $upperQuantity = $lastQuantity;
    foreach ($quantities as $packQuantity) {
        $packQuantity = (int)$packQuantity;
        if ($packQuantity < $quantity) {
            $lowerQuantity = $packQuantity;
        } elseif ($packQuantity > $quantity) {
            $upperQuantity = $packQuantity;
            break;
        }
    }

    $firstDiscount = max(0.0, 1.0 - $points[$firstQuantity] / ($baselineUnitCents * $firstQuantity));
    $lastDiscount = max(0.0, 1.0 - $points[$lastQuantity] / ($baselineUnitCents * $lastQuantity));
    if ($quantity <= $firstQuantity) {
        $discount = $firstDiscount;
    } elseif ($quantity >= $lastQuantity) {
        $discount = $lastDiscount;
    } else {
        $lowerDiscount = max(0.0, 1.0 - $points[$lowerQuantity] / ($baselineUnitCents * $lowerQuantity));
        $upperDiscount = max(0.0, 1.0 - $points[$upperQuantity] / ($baselineUnitCents * $upperQuantity));
        $discount = $lowerDiscount + ($upperDiscount - $lowerDiscount)
            * (($quantity - $lowerQuantity) / ($upperQuantity - $lowerQuantity));
    }

    return max(0, (int)round($quantity * $baselineUnitCents * (1.0 - $discount)));
}

function cart_assoc_int_selection($selections, $name)
{
    $value = cart_selection($selections, $name, array());
    $clean = array();

    if (!is_array($value)) {
        return $clean;
    }

    foreach ($value as $key => $amount) {
        $text = cart_text($key);
        $quantity = (int)$amount;
        if ($text !== '' && $quantity > 0) {
            $clean[$text] = $quantity;
        }
    }

    return $clean;
}

function cart_assoc_text_selection($selections, $name)
{
    $value = cart_selection($selections, $name, array());
    $clean = array();

    if (!is_array($value)) {
        return $clean;
    }

    foreach ($value as $key => $label) {
        $text = cart_text($key);
        $labelText = cart_text($label);
        if ($text !== '' && $labelText !== '') {
            $clean[$text] = $labelText;
        }
    }

    return $clean;
}

function cart_is_main_v2_slug($slug)
{
    return in_array((string)$slug, array('crachas-loja', 'imanes-loja', 'imanes-recortados', 'mini-cadernos', 'blocos-a6', 'bloquinhos', 'cadernos-anuais', 'agendas', 'stickers', 'marcadores', 'marcadores-magneticos', 'porta-chaves', 'pasta-de-folhetos'), true);
}

function cart_is_congress_slug($slug)
{
    return in_array((string)$slug, array('crachas', 'imanes', 'caderninhos', 'cadernos'), true);
}

function product_authoritative_design_labels($product, $designs)
{
    $step = product_step($product, 'designs');
    $parentStep = !empty($step['parentStepId']) ? product_step($product, (string)$step['parentStepId']) : array();
    $parentItemProperty = !empty($step['parentItemProperty']) ? (string)$step['parentItemProperty'] : 'parentValue';
    $labels = array();
    foreach ((array)$designs as $design) {
        if ($design === '__sortido__') {
            $labels[$design] = 'Sortido';
            continue;
        }
        $item = product_step_item_by_value($step, $design);
        if (!empty($item)) {
            $variationLabel = !empty($item['title']) ? cart_text($item['title']) : cart_text($design);
            $parentValue = isset($item[$parentItemProperty]) ? (string)$item[$parentItemProperty] : '';
            $parentItem = $parentValue !== '' ? product_step_item_by_value($parentStep, $parentValue) : array();
            $parentLabel = !empty($parentItem['title']) ? cart_text($parentItem['title']) : '';
            $labels[$design] = $parentLabel !== '' ? $parentLabel . ' · ' . $variationLabel : $variationLabel;
        }
    }
    return $labels;
}




function main_v2_quantity_pricing_switch_enabled($product, $priceKey)
{
    if (!is_array($product) || !isset($product['quantityPricingSwitchByPriceKey'][$priceKey])) {
        return false;
    }
    $config = $product['quantityPricingSwitchByPriceKey'][$priceKey];
    return is_array($config) && !empty($config['quantityTiers']);
}

function main_v2_selected_pricing_mode($product, $priceKey, $selection)
{
    if ((string)$selection === 'quantity_tiers'
        && main_v2_quantity_pricing_switch_enabled($product, $priceKey)
    ) {
        return 'tier-unit';
    }
    return main_v2_effective_pricing_mode($product, $priceKey);
}

function main_v2_uses_price_ladder($product, $priceKey = '')
{
    return main_v2_effective_pricing_mode($product, $priceKey) === 'linear-discount-interpolation';
}

function main_v2_uses_pack_combination($product, $priceKey = '')
{
    return main_v2_effective_pricing_mode($product, $priceKey) === 'pack-combination';
}

function main_v2_pack_combination_prefers_fewer_packs($product, $priceKey = '')
{
    $sources = array($product, product_step($product, 'pack'));
    foreach ($sources as $source) {
        if (!is_array($source) || empty($source['combinationTieBreakByPriceKey']) || !is_array($source['combinationTieBreakByPriceKey'])) {
            continue;
        }
        if (isset($source['combinationTieBreakByPriceKey'][$priceKey])) {
            return (string)$source['combinationTieBreakByPriceKey'][$priceKey] === 'fewer-packs';
        }
    }
    return false;
}

// TIER_UNIT_PRICING_V1: cada escalão fixa uma percentagem de desconto sobre o
// unitário do escalão mínimo. Acima do mínimo vale qualquer quantidade, e cada
// unidade extra é vendida com o desconto do escalão em vigor — o mesmo que
// `tierPriceCents` faz no app.js.
function main_v2_uses_tier_unit($product, $priceKey = '')
{
    return main_v2_effective_pricing_mode($product, $priceKey) === 'tier-unit';
}



function product_pack_combination_cents($table, $quantity, $preferFewerPacks = false)
{
    $plano = product_pack_combination_plan($table, $quantity, $preferFewerPacks);
    return $plano === null ? 0 : (int)$plano['cents'];
}

// "1 pack de 24 + 4 packs de 5 + 1 pack de 3", para o email e para o admin.
function product_pack_combination_line($plano, $unitLabel, $unitSingular)
{
    if (!is_array($plano) || empty($plano['parts'])) {
        return '';
    }

    $fora = array();
    foreach ($plano['parts'] as $packQuantity => $count) {
        if ($packQuantity === 1) {
            $fora[] = $count . ' ' . ($count === 1 ? $unitSingular : $unitLabel);
        } else {
            $fora[] = $count . ($count === 1 ? ' pack de ' : ' packs de ') . $packQuantity;
        }
    }

    return implode(' + ', $fora);
}

function product_flat_unit_price_cents($product, $pricingProduct, $priceKey)
{
    foreach (array($pricingProduct, $product) as $source) {
        if (!empty($source['flatUnitPricesCents']) && is_array($source['flatUnitPricesCents']) && isset($source['flatUnitPricesCents'][$priceKey])) {
            return max(0, (int)$source['flatUnitPricesCents'][$priceKey]);
        }
    }
    foreach (array($pricingProduct, $product) as $source) {
        if (!empty($source['prices'][$priceKey]) && is_array($source['prices'][$priceKey]) && isset($source['prices'][$priceKey]['1'])) {
            return max(0, (int)$source['prices'][$priceKey]['1']);
        }
    }
    return 0;
}

function cart_valid_contact($value)
{
    $value = trim((string)$value);

    if ($value === '') {
        return false;
    }

    if (strpos($value, '@') !== false) {
        return (bool)preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $value);
    }

    $clean = preg_replace('/[\s+()\-]/', '', $value);
    return (bool)preg_match('/^\d{9,}$/', (string)$clean);
}

function cart_valid_nif($value)
{
    $value = trim((string)$value);
    return $value === '' || (bool)preg_match('/^\d{9}$/', $value);
}

function order_upload_pdf_is_valid($path)
{
    $size = @filesize($path);
    if ($size === false || $size < 12) {
        return false;
    }
    $handle = @fopen($path, 'rb');
    if ($handle === false) {
        return false;
    }
    $header = (string)fread($handle, 16);
    $tailLength = min(8192, (int)$size);
    if (@fseek($handle, -$tailLength, SEEK_END) !== 0) {
        fclose($handle);
        return false;
    }
    $tail = (string)fread($handle, $tailLength);
    fclose($handle);
    return preg_match('/^%PDF-[12]\.[0-9]/', $header) === 1
        && preg_match('/%%EOF[\x00\x09\x0A\x0C\x0D\x20]*$/s', $tail) === 1;
}

function order_upload_temp_info($token)
{
    $token = strtolower(trim((string)$token));
    if (!preg_match('/^[a-f0-9]{32,40}$/', $token)) {
        return null;
    }

    $dir = mp_private_path('order-uploads' . DIRECTORY_SEPARATOR . 'tmp');
    if ($dir === null) {
        return null;
    }
    $metadataPath = $dir . DIRECTORY_SEPARATOR . $token . '.json';
    if (!is_file($metadataPath)) {
        return null;
    }

    $metadata = json_decode((string)@file_get_contents($metadataPath), true);
    if (!is_array($metadata) || empty($metadata['stored_name'])) {
        return null;
    }
    $storedName = basename((string)$metadata['stored_name']);
    if (strpos($storedName, $token . '.') !== 0 || !preg_match('/\.(?:jpe?g|png|webp|heic|heif|pdf|webm|ogg|wav|mp3|m4a|mp4)$/i', $storedName)) {
        return null;
    }
    $filePath = $dir . DIRECTORY_SEPARATOR . $storedName;
    if (!is_file($filePath)) {
        return null;
    }

    $extension = strtolower(pathinfo($storedName, PATHINFO_EXTENSION));
    $mime = isset($metadata['mime']) ? strtolower(cart_text($metadata['mime'])) : '';
    $kind = isset($metadata['kind']) ? strtolower(cart_text($metadata['kind'])) : '';
    $allowedMimes = array(
        'jpg' => array('image/jpeg'),
        'jpeg' => array('image/jpeg'),
        'png' => array('image/png'),
        'webp' => array('image/webp'),
        'heic' => array('image/heic'),
        'heif' => array('image/heif'),
        'pdf' => array('application/pdf'),
        'webm' => array('audio/webm', 'video/webm'),
        'ogg' => array('audio/ogg'),
        'wav' => array('audio/wav', 'audio/x-wav'),
        'mp3' => array('audio/mpeg'),
        'm4a' => array('audio/mp4', 'video/mp4'),
        'mp4' => array('audio/mp4', 'video/mp4'),
    );
    if (!isset($allowedMimes[$extension]) || !in_array($mime, $allowedMimes[$extension], true) || !in_array($kind, array('photo', 'audio', 'artwork'), true)) {
        return null;
    }
    if ($kind === 'artwork' && (!isset($metadata['purpose']) || $metadata['purpose'] !== 'custom-artwork')) {
        return null;
    }
    if ($extension === 'pdf' && ($kind !== 'artwork' || !order_upload_pdf_is_valid($filePath))) {
        return null;
    }

    $actualSize = @filesize($filePath);
    if ($actualSize === false || $actualSize < 1 || (isset($metadata['size']) && (int)$metadata['size'] !== (int)$actualSize)) {
        return null;
    }
    $sha256 = isset($metadata['sha256']) ? strtolower(cart_text($metadata['sha256'])) : '';
    if ($kind === 'artwork' && !preg_match('/^[a-f0-9]{64}$/', $sha256)) {
        return null;
    }
    if ($sha256 !== '') {
        $actualSha256 = @hash_file('sha256', $filePath);
        if (!preg_match('/^[a-f0-9]{64}$/', $sha256) || !is_string($actualSha256) || !hash_equals($sha256, $actualSha256)) {
            return null;
        }
    }

    return array(
        'token' => $token,
        'name' => isset($metadata['name']) ? cart_text($metadata['name']) : 'foto',
        'size' => (int)$actualSize,
        'sha256' => $sha256,
        'mime' => $mime,
        'kind' => $kind,
        'purpose' => isset($metadata['purpose']) ? cart_text($metadata['purpose']) : '',
        'width' => isset($metadata['width']) ? max(0, (int)$metadata['width']) : 0,
        'height' => isset($metadata['height']) ? max(0, (int)$metadata['height']) : 0,
        'dpi' => isset($metadata['dpi']) ? max(0, (int)$metadata['dpi']) : 0,
        'stored_name' => $storedName,
        'temp_path' => $filePath,
        'metadata_path' => $metadataPath,
    );
}

function cart_artwork_upload_selection($selections, $name, &$invalid, $feeCents, $maxFiles = 10)
{
    $values = isset($selections[$name]) && is_array($selections[$name]) ? $selections[$name] : array();
    $uploads = array();
    $seen = array();
    $invalid = count($values) > $maxFiles;

    // Não faças hash/validação de uma lista arbitrariamente grande.
    // O pedido continuará inválido, mas o trabalho fica limitado ao máximo
    // documentado para este flow.
    if ($maxFiles > 0 && count($values) > $maxFiles) {
        $values = array_slice($values, 0, $maxFiles);
    }

    foreach ($values as $value) {
        if (!is_array($value) || !isset($value['token']) || !array_key_exists('quantity', $value)) {
            $invalid = true;
            continue;
        }
        $rawQuantity = $value['quantity'];
        $quantityText = is_scalar($rawQuantity) ? trim((string)$rawQuantity) : '';
        if (!preg_match('/^[1-9][0-9]{0,3}$/', $quantityText)) {
            $invalid = true;
            continue;
        }
        $quantity = (int)$quantityText;
        if ($quantity < 1 || $quantity > 9999) {
            $invalid = true;
            continue;
        }
        $info = order_upload_temp_info($value['token']);
        if ($info === null || $info['kind'] !== 'artwork') {
            $invalid = true;
            continue;
        }
        if (isset($seen[$info['token']])) {
            $invalid = true;
            continue;
        }
        $seen[$info['token']] = true;
        $info['quantity'] = $quantity;
        $info['fee_cents'] = max(0, (int)$feeCents);
        $uploads[] = $info;
    }

    return $uploads;
}

function cart_upload_selection($selections, $name, &$invalid, $maxFiles = 5, $expectedKind = '')
{
    $values = isset($selections[$name]) && is_array($selections[$name]) ? $selections[$name] : array();
    $uploads = array();
    $seen = array();
    $invalid = false;

    foreach ($values as $value) {
        $token = is_array($value) && isset($value['token']) ? $value['token'] : $value;
        $info = order_upload_temp_info($token);
        if ($info === null) {
            $invalid = true;
            continue;
        }
        if ($expectedKind !== '' && $info['kind'] !== $expectedKind) {
            $invalid = true;
            continue;
        }
        if (isset($seen[$info['token']])) {
            continue;
        }
        $seen[$info['token']] = true;
        $uploads[] = $info;
        if ($maxFiles > 0 && count($uploads) >= $maxFiles) {
            break;
        }
    }

    return $uploads;
}

function order_upload_copy_to_order(&$items, $orderCode)
{
    $safeCode = preg_replace('/[^A-Za-z0-9_-]/', '', (string)$orderCode);
    $relativeDir = 'order-uploads/orders/' . $safeCode;
    $dir = mp_private_path(str_replace('/', DIRECTORY_SEPARATOR, $relativeDir));
    $tokens = array();

    if ($safeCode === '' || $dir === null) {
        throw new RuntimeException('Não foi possível preparar os anexos da encomenda.');
    }

    $attachmentFields = array(
        'quadro_uploads',
        'quadro_reference_uploads',
        'quadro_silhouette_uploads',
        'quadro_silhouette_audio_uploads',
        'quadro_audio_uploads',
        'artwork_uploads',
        'card_reference_uploads',
        'card_audio_uploads',
    );

    foreach ($items as $item) {
        foreach ($attachmentFields as $attachmentField) {
            if (empty($item[$attachmentField])) {
                continue;
            }
            if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
                throw new RuntimeException('Não foi possível criar a pasta dos anexos da encomenda.');
            }
            break 2;
        }
    }

    foreach ($items as $itemIndex => $item) {
        foreach ($attachmentFields as $attachmentField) {
            if (empty($item[$attachmentField]) || !is_array($item[$attachmentField])) {
                continue;
            }
            $stored = array();
            foreach ($item[$attachmentField] as $upload) {
                $info = isset($upload['token']) ? order_upload_temp_info($upload['token']) : null;
                if ($info === null) {
                    throw new RuntimeException('Um anexo deixou de estar disponível.');
                }
                $extension = strtolower(pathinfo($info['stored_name'], PATHINFO_EXTENSION));
                $filename = $info['token'] . '.' . $extension;
                $destination = $dir . DIRECTORY_SEPARATOR . $filename;
                if (!is_file($destination) && !@copy($info['temp_path'], $destination)) {
                    throw new RuntimeException('Não foi possível associar um anexo à encomenda.');
                }
                @chmod($destination, 0600);
                $copiedSize = @filesize($destination);
                $copiedSha256 = @hash_file('sha256', $destination);
                $expectedSha256 = $info['sha256'] !== '' ? $info['sha256'] : @hash_file('sha256', $info['temp_path']);
                if (
                    (int)$copiedSize !== (int)$info['size']
                    || !is_string($expectedSha256)
                    || !is_string($copiedSha256)
                    || !hash_equals($expectedSha256, $copiedSha256)
                ) {
                    @unlink($destination);
                    throw new RuntimeException('Não foi possível confirmar a cópia de um anexo.');
                }
                $tokens[$info['token']] = $info;
                $storedUpload = array(
                    'id' => $info['token'],
                    'name' => $info['name'],
                    'size' => $info['size'],
                    'sha256' => $expectedSha256,
                    'mime' => $info['mime'],
                    'kind' => $info['kind'],
                    'width' => $info['width'],
                    'height' => $info['height'],
                    'dpi' => $info['dpi'],
                    'relative_path' => $relativeDir . '/' . $filename,
                );
                if ($info['purpose'] !== '') {
                    $storedUpload['purpose'] = $info['purpose'];
                }
                if (isset($upload['quantity'])) {
                    $storedUpload['quantity'] = max(1, min(9999, (int)$upload['quantity']));
                }
                if (isset($upload['fee_cents'])) {
                    $storedUpload['fee_cents'] = max(0, (int)$upload['fee_cents']);
                }
                $stored[] = $storedUpload;
            }
            $items[$itemIndex][$attachmentField] = $stored;
        }
    }

    return array_values($tokens);
}

function order_upload_consume_temp($uploads)
{
    foreach ($uploads as $upload) {
        if (!empty($upload['temp_path'])) {
            @unlink($upload['temp_path']);
        }
        if (!empty($upload['metadata_path'])) {
            @unlink($upload['metadata_path']);
        }
    }
}

function order_upload_cleanup_order($orderCode)
{
    $safeCode = preg_replace('/[^A-Za-z0-9_-]/', '', (string)$orderCode);
    if ($safeCode === '') {
        return;
    }
    $dir = mp_private_path('order-uploads' . DIRECTORY_SEPARATOR . 'orders' . DIRECTORY_SEPARATOR . $safeCode);
    if ($dir === null || !is_dir($dir)) {
        return;
    }
    $files = glob($dir . DIRECTORY_SEPARATOR . '*');
    if (is_array($files)) {
        foreach ($files as $file) {
            if (is_file($file)) {
                @unlink($file);
            }
        }
    }
    @rmdir($dir);
}

function cart_prepare_item($item, $defaultPackPrices, $defaultAllowedDesigns)
{
    $errors = array();
    $slug = isset($item['productSlug']) ? cart_allowed_product_slug($item['productSlug']) : '';
    $selections = isset($item['selections']) && is_array($item['selections']) ? $item['selections'] : array();
    $productConfig = $slug !== '' ? load_product_config($slug) : array();
    $productName = isset($productConfig['name']) ? trim((string)$productConfig['name']) : '';
    $isMainV2 = cart_is_main_v2_slug($slug);
    $isCongress = cart_is_congress_slug($slug);
    $usesConfiguredPricing = $isMainV2 || $isCongress;
    $catalogContext = cart_string_selection($selections, 'catalog_context');
    $isCadernos = in_array($slug, array('cadernos', 'cadernos-anuais'), true)
        || (!empty($productConfig['family']) && (string)$productConfig['family'] === 'cadernos');
    $isQuadros = $slug === 'quadros';

    if ($slug === '' || empty($productConfig)) {
        return array('errors' => array('Um dos produtos do carrinho não é válido.'));
    }

    if ($productName === '') {
        $productName = isset($item['productName']) ? cart_text($item['productName']) : $slug;
    }

    if ($isMainV2 && $catalogContext !== 'main-v2') {
        $errors[] = 'O contexto do catálogo principal não é válido.';
    }
    if ($isMainV2 && (
        !isset($productConfig['catalogContext'])
        || $productConfig['catalogContext'] !== 'main-v2'
        || !main_v2_pricing_is_valid($productConfig)
    )) {
        $errors[] = 'A configuração deste produto não pertence ao catálogo principal.';
    }
    if ($isCongress && $catalogContext !== '' && $catalogContext !== 'congress-2026') {
        $errors[] = 'O contexto do produto de Congresso não é válido.';
    }

    $pricingProduct = load_pricing_product($slug);
    if ($isMainV2 && (
        empty($pricingProduct)
        || !isset($pricingProduct['catalogContext'])
        || $pricingProduct['catalogContext'] !== 'main-v2'
        || !main_v2_pricing_is_valid($pricingProduct)
        || !main_v2_pricing_modes_agree($productConfig, $pricingProduct)
    )) {
        $errors[] = 'A tabela de preços deste produto não é válida.';
    }
    if ($isCongress && (
        empty($pricingProduct)
        || !main_v2_pricing_is_valid($pricingProduct)
        || !main_v2_pricing_modes_agree($productConfig, $pricingProduct)
    )) {
        $errors[] = 'A tabela de preços deste produto do Congresso não é válida.';
    }
    $centralPackPrices = load_pricing_prices($slug);
    $packPrices = !empty($centralPackPrices) ? $centralPackPrices : product_prices($productConfig, empty($productConfig) ? $defaultPackPrices : array());
    $allowedDesigns = product_design_values($productConfig, $defaultAllowedDesigns);
    $packStep = product_step($productConfig, 'pack');
    $hasPackStep = !empty($packStep);
    $fixedProductQuantity = !$hasPackStep && isset($productConfig['fixedQuantity'])
        ? max(0, (int)$productConfig['fixedQuantity'])
        : 0;
    $hasPrices = !empty($packPrices);
    $orderFlow = cart_string_selection($selections, 'order_flow');
    $designSource = cart_string_selection($selections, 'design_source');
    $artworkUploadKey = $isMainV2 ? 'custom_artwork_uploads' : ($slug === 'crachas' ? 'cracha_artwork_uploads' : 'iman_artwork_uploads');
    $artworkHelpKey = $isMainV2 ? '' : ($slug === 'crachas' ? 'cracha_artwork_help' : 'iman_artwork_help');
    $hasLegacyCustomArtworkSignal = !$isMainV2 && $orderFlow === '' && (
        !empty($selections[$artworkUploadKey])
        || ($artworkHelpKey !== '' && !empty($selections[$artworkHelpKey]))
    );
    $isLegacyCustomArtwork = in_array($slug, array('crachas', 'imanes'), true)
        && !empty(product_step($productConfig, 'artwork_upload'))
        && !empty($packStep['freeQuantity'])
        && ($orderFlow === 'custom-artwork' || $hasLegacyCustomArtworkSignal);
    $isMainCustomArtwork = $isMainV2 && $orderFlow === 'custom' && $designSource === 'custom';
    $isCustomArtwork = $isLegacyCustomArtwork || $isMainCustomArtwork;
    $usesLinearDiscountPricing = $isLegacyCustomArtwork
        && isset($packStep['pricingMode'])
        && $packStep['pricingMode'] === 'linear-discount-interpolation';

    if ($isMainV2 && (!in_array($orderFlow, array('catalog', 'custom'), true) || !in_array($designSource, array('catalog', 'custom'), true) || $orderFlow !== $designSource)) {
        $errors[] = 'Escolhe apenas designs do catálogo ou ficheiros personalizados.';
    }

    $size = cart_string_selection($selections, 'size');
    $packQuantity = (int)cart_selection($selections, 'pack_quantity', 0);
    $quantityPricingMode = cart_string_selection($selections, 'quantity_pricing_mode');
    $designs = cart_list_selection($selections, 'designs');
    $designQuantities = cart_assoc_int_selection($selections, 'design_quantities');
    $designLabels = cart_assoc_text_selection($selections, 'design_labels');
    $assortedDesigns = cart_bool(cart_selection($selections, 'assorted_designs', false)) || in_array('__sortido__', $designs, true);
    $recipientName = cart_string_selection($selections, 'recipient_name');
    $contact = cart_string_selection($selections, 'contact');
    $congregation = cart_string_selection($selections, 'congregation');
    $congregationGift = cart_bool(cart_selection($selections, 'congregation_gift', false));
    $hasCardDetailsStep = product_has_card_details_step($productConfig);
    $sizeStep = product_step($productConfig, 'size');
    $customUsesSize = $isCustomArtwork && !empty($sizeStep);
    $selectedSizeItem = $customUsesSize ? product_selected_size_item($productConfig, $size) : array();
    $defaultPriceKey = !empty($pricingProduct['defaultPriceKey'])
        ? cart_text($pricingProduct['defaultPriceKey'])
        : (!empty($productConfig['defaultPriceKey']) ? cart_text($productConfig['defaultPriceKey']) : '');
    $priceKey = $customUsesSize && !empty($selectedSizeItem['priceKey'])
        ? cart_text($selectedSizeItem['priceKey'])
        : ($isCustomArtwork && $defaultPriceKey !== '' ? $defaultPriceKey : $size);
    $sizeLabel = $customUsesSize && !empty($selectedSizeItem['title'])
        ? cart_text($selectedSizeItem['title'])
        : ($size !== '' ? $size : $priceKey);
    if ($customUsesSize && $sizeLabel !== '' && $size !== '' && strcasecmp($sizeLabel, $size) !== 0) {
        $sizeLabel .= ' (' . $size . ')';
    }
    $minimumQuantity = $isLegacyCustomArtwork && isset($selectedSizeItem['minQuantity'])
        ? max(1, (int)$selectedSizeItem['minQuantity'])
        : 1;

    // PERSONALIZACAO_BUILDER_V1: um tamanho pode existir sem tabela de precos
    // (crachas grandes). Nesse caso a linha segue com o preco por confirmar em
    // vez de ser recusada por falta de preco.
    $sizeQuoteOnly = $customUsesSize && !empty($selectedSizeItem['quoteOnly']);

    $selectedFinishes = $isMainCustomArtwork ? cart_list_selection($selections, 'finishes') : array();
    $finishLabels = array();
    $finishExtraPerUnitCents = 0;
    foreach ($selectedFinishes as $finishValue) {
        $finishOption = product_finish_option($productConfig, $finishValue);
        if (empty($finishOption)) {
            $errors[] = 'Um dos acabamentos escolhidos em ' . $productName . ' não é válido.';
            continue;
        }
        $finishLabels[] = isset($finishOption['title']) ? cart_text($finishOption['title']) : $finishValue;
        $finishExtraPerUnitCents += max(0, (int)(isset($finishOption['extraPriceCentsPerUnit']) ? $finishOption['extraPriceCentsPerUnit'] : 0));
    }
    $selections['finishes'] = $selectedFinishes;

    $variantLabels = array();
    foreach (product_variant_options($productConfig) as $variant) {
        $variantField = isset($variant['field']) ? cart_text($variant['field']) : '';
        $variantValue = $variantField !== '' ? cart_string_selection($selections, $variantField) : '';
        $variantItem = $variantField !== '' ? product_variant_item($variant, $variantValue) : array();

        if ($variantField === '') {
            continue;
        }
        if ($variantValue === '') {
            if (!empty($variant['required']) && $isMainCustomArtwork) {
                $errors[] = 'Escolhe ' . strtolower(isset($variant['label']) ? cart_text($variant['label']) : $variantField) . ' em ' . $productName . '.';
            }
            continue;
        }
        if (empty($variantItem)) {
            $errors[] = 'Uma das opções escolhidas em ' . $productName . ' não é válida.';
            continue;
        }
        $variantLabels[] = (isset($variant['label']) ? cart_text($variant['label']) . ': ' : '')
            . (isset($variantItem['title']) ? cart_text($variantItem['title']) : $variantValue);
    }

    $optionDrawerLabels = array();
    $optionDrawerExtraPerUnitCents = 0;
    foreach (product_option_drawers($productConfig, $selections) as $drawer) {
            // Por omissão, as gavetas pertencem apenas ao fluxo do catálogo.
            // Produtos que precisem das mesmas escolhas em Personalização
            // declaram explicitamente customArtworkEnabled no próprio JSON.
            if ($isMainCustomArtwork && empty($drawer['customArtworkEnabled'])) {
                continue;
            }
            $drawerField = isset($drawer['field']) ? cart_text($drawer['field']) : '';
            $drawerValue = $drawerField !== '' ? cart_string_selection($selections, $drawerField) : '';
            if ($drawerValue === '' && isset($drawer['defaultValue'])) {
                $drawerValue = cart_text($drawer['defaultValue']);
            }
            $drawerItem = $drawerField !== '' ? product_option_drawer_item($drawer, $drawerValue, $productConfig, $designs) : array();

            if ($drawerField === '') {
                continue;
            }
            if ($drawerValue === '') {
                if (!empty($drawer['required'])) {
                    $errors[] = 'Escolhe ' . strtolower(isset($drawer['label']) ? cart_text($drawer['label']) : $drawerField) . ' em ' . $productName . '.';
                }
                continue;
            }
            if (empty($drawerItem)) {
                $errors[] = 'Uma das opções extra escolhidas em ' . $productName . ' não é válida.';
                continue;
            }

            $selections[$drawerField] = $drawerValue;
            $optionDrawerLabel = (isset($drawer['label']) ? cart_text($drawer['label']) . ': ' : '')
                . (isset($drawerItem['title']) ? cart_text($drawerItem['title']) : $drawerValue);
            if (!empty($drawerItem['priceLabel'])) {
                $optionDrawerLabel .= ' (' . cart_text($drawerItem['priceLabel']) . ')';
            }
            $optionDrawerLabels[] = $optionDrawerLabel;
            $optionDrawerExtraPerUnitCents += max(0, (int)(isset($drawerItem['extraPriceCentsPerUnit']) ? $drawerItem['extraPriceCentsPerUnit'] : 0));
    }

    $cardDescriptionKey = $slug === 'crachas' ? 'cracha_card_description' : 'iman_card_description';
    $cardReferenceKey = $slug === 'crachas' ? 'cracha_card_reference_uploads' : 'iman_card_reference_uploads';
    $cardAudioKey = $slug === 'crachas' ? 'cracha_card_audio_uploads' : 'iman_card_audio_uploads';
    $artworkUploadInvalid = false;
    $cardReferenceUploadInvalid = false;
    $cardAudioUploadInvalid = false;
    $customizationFeePerFileCents = $isMainCustomArtwork
        ? max(0, (int)(isset($pricingProduct['customArtworkFeePerFileCents']) ? $pricingProduct['customArtworkFeePerFileCents'] : 0))
        : 0;
    if ($isMainCustomArtwork) {
        $artworkUploads = cart_artwork_upload_selection($selections, $artworkUploadKey, $artworkUploadInvalid, $customizationFeePerFileCents, 10);
    } elseif ($isLegacyCustomArtwork) {
        $artworkUploads = cart_upload_selection($selections, $artworkUploadKey, $artworkUploadInvalid, 1, 'photo');
    } else {
        $artworkUploads = array();
    }
    $artworkHelp = $isLegacyCustomArtwork && $artworkHelpKey !== '' ? cart_bool(cart_selection($selections, $artworkHelpKey, false)) : false;
    $cardDescription = $isLegacyCustomArtwork ? cart_string_selection($selections, $cardDescriptionKey) : '';
    $cardReferenceUploads = $isLegacyCustomArtwork
        ? cart_upload_selection($selections, $cardReferenceKey, $cardReferenceUploadInvalid, 0, 'photo')
        : array();
    $cardAudioUploads = $isLegacyCustomArtwork
        ? cart_upload_selection($selections, $cardAudioKey, $cardAudioUploadInvalid, 0, 'audio')
        : array();
    $artworkTotalQuantity = 0;
    foreach ($artworkUploads as $artworkUpload) {
        $artworkTotalQuantity += isset($artworkUpload['quantity']) ? (int)$artworkUpload['quantity'] : 0;
    }
    $hasUnexpectedMainArtworkUploads = $isMainV2 && !$isMainCustomArtwork && !empty($selections['custom_artwork_uploads']);
    $hasUnexpectedCustomDesigns = $isMainCustomArtwork && (!empty($designs) || $assortedDesigns || !empty($designQuantities));
    $customizationFileCount = $isMainCustomArtwork ? count($artworkUploads) : 0;
    $customizationFeeCents = $customizationFileCount * $customizationFeePerFileCents;
    if ($isMainCustomArtwork) {
        if ($isCadernos) {
            $selections['caderno_order_quantity'] = $artworkTotalQuantity;
        } else {
            $packQuantity = $artworkTotalQuantity;
            $selections['pack_quantity'] = $packQuantity;
        }
        $selections['customization_file_count'] = $customizationFileCount;
        $selections['customization_fee_cents'] = $customizationFeeCents;
        $selections['artwork_total_quantity'] = $artworkTotalQuantity;
    } elseif ($isMainV2) {
        unset($selections['custom_artwork_uploads'], $selections['customization_file_count'], $selections['customization_fee_cents'], $selections['artwork_total_quantity']);
    }

    // Produtos sem passo de pack podem declarar uma quantidade fixa no JSON.
    // O servidor volta a impô-la para que o browser não consiga alterar a
    // quantidade e para que o resumo/email mostre, por exemplo, a capa x1.
    if ($fixedProductQuantity > 0) {
        $packQuantity = $fixedProductQuantity;
        $selections['pack_quantity'] = $packQuantity;
        if (!$isCustomArtwork && !$assortedDesigns && count($designs) === 1) {
            $designQuantities = array($designs[0] => $packQuantity);
            $selections['design_quantities'] = $designQuantities;
        }
    }

    $quadroType = $isQuadros && !empty($designs) ? (string)$designs[0] : '';
    $quadroTypeStep = $isQuadros ? product_step($productConfig, 'designs') : array();
    $quadroTypeItem = $isQuadros ? product_step_item_by_value($quadroTypeStep, $quadroType) : array();
    $quadroTypeLabel = !empty($quadroTypeItem['title']) ? cart_text($quadroTypeItem['title']) : $quadroType;
    $quadroPaletteStepId = $isQuadros && $quadroType === 'Quadro para bebé' ? 'baby_color' : 'colors';
    $quadroPaletteStep = $isQuadros ? product_step($productConfig, $quadroPaletteStepId) : array();
    $quadroSuperStep = $isQuadros ? product_step($productConfig, 'super_details') : array();
    $quadroColorCount = $isQuadros && isset($quadroPaletteStep['colorCount']) ? max(1, (int)$quadroPaletteStep['colorCount']) : 3;
    if ($isQuadros && !empty($quadroPaletteStep['colorCountByField']['designs'][$quadroType])) {
        $quadroColorCount = max(1, (int)$quadroPaletteStep['colorCountByField']['designs'][$quadroType]);
    }
    $quadroColorSelection = $isQuadros
        ? quadro_prepare_color_selection($productConfig, $quadroPaletteStep, $selections, $quadroColorCount)
        : array('valid' => false, 'mia' => false, 'values' => array(), 'tones' => array(), 'labels' => array(), 'palette' => '', 'palette_item' => array(), 'palette_colors' => array());
    $quadroPalette = $quadroColorSelection['palette'];
    $quadroPaletteItem = $quadroColorSelection['palette_item'];
    $quadroPaletteColors = $quadroColorSelection['palette_colors'];
    $quadroColorValues = $quadroColorSelection['values'];
    $quadroColorTones = $quadroColorSelection['tones'];
    $quadroColors = $quadroColorSelection['labels'];
    $quadroMiaColors = $quadroColorSelection['mia'];
    $quadroPhotoOrientation = $isQuadros ? cart_string_selection($selections, 'photo_orientation') : '';
    $quadroText = $isQuadros ? cart_string_selection($selections, 'quadro_text') : '';
    $quadroNoPhrase = $isQuadros ? cart_bool(cart_selection($selections, 'no_phrase', false)) : false;
    $quadroNoText = $isQuadros ? cart_bool(cart_selection($selections, 'no_text', false)) : false;
    $quadroDedication = $isQuadros ? cart_string_selection($selections, 'quadro_dedication') : '';
    $quadroNoDedication = $isQuadros ? cart_bool(cart_selection($selections, 'no_dedication', false)) : false;
    $quadroDescription = $isQuadros ? cart_string_selection($selections, 'quadro_description') : '';
    $quadroSuperExample = $isQuadros ? cart_string_selection($selections, 'quadro_super_example') : '';
    $quadroHeartFinish = $isQuadros ? cart_string_selection($selections, 'heart_finish') : '';
    $quadroSilhouette = $isQuadros ? cart_string_selection($selections, 'silhouette') : '';
    $quadroSilhouetteDescription = $isQuadros ? cart_string_selection($selections, 'quadro_silhouette_description') : '';
    $quadroSilhouetteContactMe = $isQuadros ? cart_bool(cart_selection($selections, 'silhouette_contact_me', false)) : false;
    $quadroBackgroundStep = $isQuadros ? product_step($productConfig, 'heart_background_colors') : array();
    $quadroBackgroundSelection = $isQuadros && !empty($quadroBackgroundStep)
        ? quadro_prepare_color_selection($productConfig, $quadroBackgroundStep, $selections, 1)
        : array('valid' => false, 'mia' => false, 'values' => array(), 'tones' => array(), 'labels' => array(), 'palette' => '', 'palette_item' => array(), 'palette_colors' => array());
    $quadroBackgroundPalette = $quadroBackgroundSelection['palette'];
    $quadroBackgroundPaletteItem = $quadroBackgroundSelection['palette_item'];
    $quadroBackgroundPaletteColors = $quadroBackgroundSelection['palette_colors'];
    $quadroBackgroundColorValues = $quadroBackgroundSelection['values'];
    $quadroBackgroundColorTones = $quadroBackgroundSelection['tones'];
    $quadroBackgroundColors = $quadroBackgroundSelection['labels'];
    $quadroBackgroundMia = $quadroBackgroundSelection['mia'];
    $quadroFrameSize = $isQuadros ? cart_string_selection($selections, 'frame_size') : '';
    if ($isQuadros && !empty($quadroTypeItem['frameSize'])) {
        $quadroFrameSize = cart_text($quadroTypeItem['frameSize']);
    }
    $quadroFrameStep = $isQuadros ? product_step($productConfig, 'frame_size') : array();
    $quadroFrameItem = $isQuadros ? product_step_item_by_value($quadroFrameStep, $quadroFrameSize) : array();
    $quadroFramePriceCents = 0;
    if (!empty($quadroFrameItem['priceByDesignCents']) && is_array($quadroFrameItem['priceByDesignCents']) && isset($quadroFrameItem['priceByDesignCents'][$quadroType])) {
        $quadroFramePriceCents = max(0, (int)$quadroFrameItem['priceByDesignCents'][$quadroType]);
    }
    $quadroPackaging = $isQuadros ? cart_string_selection($selections, 'packaging') : '';
    $quadroPackagingStep = $isQuadros ? product_step($productConfig, 'packaging') : array();
    $quadroPackagingItem = $isQuadros ? product_step_item_by_value($quadroPackagingStep, $quadroPackaging) : array();
    $quadroPackagingLabel = !empty($quadroPackagingItem['title']) ? cart_text($quadroPackagingItem['title']) : $quadroPackaging;
    $quadroPackagingExtraCents = !empty($quadroPackagingItem) && isset($quadroPackagingItem['extraPriceCents'])
        ? max(0, (int)$quadroPackagingItem['extraPriceCents'])
        : 0;
    $quadroBabyAnimal = $isQuadros ? cart_string_selection($selections, 'baby_animal') : '';
    $quadroBabyGender = $isQuadros ? cart_string_selection($selections, 'baby_gender') : '';
    $quadroBabyName = $isQuadros ? cart_string_selection($selections, 'baby_name') : '';
    $quadroBabyBirthDate = $isQuadros ? cart_string_selection($selections, 'baby_birth_date') : '';
    $quadroBabyBirthTime = $isQuadros ? cart_string_selection($selections, 'baby_birth_time') : '';
    $quadroBabyBirthWeight = $isQuadros ? cart_string_selection($selections, 'baby_birth_weight') : '';
    $quadroPhotoHelp = $isQuadros ? cart_bool(cart_selection($selections, 'photo_help', false)) : false;
    $quadroUploadInvalid = false;
    $quadroReferenceUploadInvalid = false;
    $quadroSilhouetteUploadInvalid = false;
    $quadroSilhouetteAudioUploadInvalid = false;
    $quadroAudioUploadInvalid = false;
    $quadroUploads = $isQuadros ? cart_upload_selection($selections, 'quadro_uploads', $quadroUploadInvalid, 1, 'photo') : array();
    $quadroReferenceUploads = $isQuadros ? cart_upload_selection($selections, 'quadro_reference_uploads', $quadroReferenceUploadInvalid, 0, 'photo') : array();
    $quadroSilhouetteUploads = $isQuadros ? cart_upload_selection($selections, 'quadro_silhouette_uploads', $quadroSilhouetteUploadInvalid, 0, 'photo') : array();
    $quadroSilhouetteAudioUploads = $isQuadros ? cart_upload_selection($selections, 'quadro_silhouette_audio_uploads', $quadroSilhouetteAudioUploadInvalid, 0, 'audio') : array();
    $quadroAudioUploads = $isQuadros ? cart_upload_selection($selections, 'quadro_audio_uploads', $quadroAudioUploadInvalid, 0, 'audio') : array();
    $allowedQuadroSilhouettes = $isQuadros ? product_step_values($productConfig, 'silhouette') : array();
    $quadroQuoteOnly = $isQuadros && !empty($quadroTypeItem['quoteOnly']);
    $quadroPriceMinCents = $quadroQuoteOnly && isset($quadroTypeItem['priceMinCents']) ? max(0, (int)$quadroTypeItem['priceMinCents']) : 0;
    $quadroPriceMaxCents = $quadroQuoteOnly && isset($quadroTypeItem['priceMaxCents']) ? max(0, (int)$quadroTypeItem['priceMaxCents']) : 0;
    $quadroPriceNote = $quadroQuoteOnly && isset($quadroTypeItem['note']) ? cart_text($quadroTypeItem['note']) : '';

    $lamination = cart_string_selection($selections, 'lamination');
    $coverPersonalization = cart_string_selection($selections, 'cover_personalization');
    $coverPersonalizationText = cart_string_selection($selections, 'cover_personalization_text');
    $laminationStep = product_step($productConfig, 'lamination');
    $addOnsStep = product_step($productConfig, 'add_ons');
    $purchaseStep = product_step($productConfig, 'pack');
    $personalizationStep = product_step($productConfig, 'cover_personalization');
    $hasPersonalizationStep = !empty($personalizationStep);
    $coverPersonalizationQuestions = product_cover_personalization_questions($personalizationStep, $size);
    $laminationItem = $isCadernos ? product_step_item_by_value($laminationStep, $lamination) : array();
    $purchaseItem = $isCadernos ? product_step_item_by_quantity($purchaseStep, $packQuantity) : array();
    $cadernoOrderQuantityOptions = $isCadernos ? product_order_quantity_options($purchaseStep) : array(1);
    $cadernoOrderQuantity = $isCadernos ? (int)cart_selection($selections, 'caderno_order_quantity', 1) : 1;
    $selectedAddOns = $isCadernos ? array_values(array_unique(cart_list_selection($selections, 'add_ons'))) : array();
    $addOnLabels = array();
    $addOnsExtraCents = 0;

    foreach ($selectedAddOns as $addOnValue) {
        $addOnItem = product_step_item_by_value($addOnsStep, $addOnValue);
        if (empty($addOnItem)) {
            $errors[] = 'Um dos add-ons escolhidos em ' . $productName . ' não é válido.';
            continue;
        }
        $addOnLabels[] = !empty($addOnItem['title']) ? cart_text($addOnItem['title']) : $addOnValue;
        $addOnsExtraCents += max(0, (int)(isset($addOnItem['extraPriceCents']) ? $addOnItem['extraPriceCents'] : 0));
    }
    $selections['add_ons'] = $selectedAddOns;
    $selections['add_on_labels'] = $addOnLabels;

    if ($isCadernos && $cadernoOrderQuantity <= 0) {
        $cadernoOrderQuantity = product_order_quantity_default($purchaseStep, $cadernoOrderQuantityOptions);
    }

    if ($assortedDesigns) {
        $designs = array('__sortido__');
        if ($packQuantity > 0) {
            $designQuantities = array('__sortido__' => $packQuantity);
        }
        $designLabels = array('__sortido__' => 'Sortido');
    }

    $uniqueDesigns = array_values(array_unique($designs));
    $allDesignsSelected = !$assortedDesigns
        && !empty($allowedDesigns)
        && count($uniqueDesigns) === count($allowedDesigns)
        && count(array_diff($allowedDesigns, $uniqueDesigns)) === 0;
    $showCongregationGiftLine = $hasCardDetailsStep && !$isCadernos && !$isQuadros && !$isCustomArtwork && !$assortedDesigns && !$allDesignsSelected;
    if (!$showCongregationGiftLine) {
        $congregationGift = false;
    }

    if ($isCadernos || $isQuadros) {
        $size = isset($productConfig['defaultPriceKey']) && trim((string)$productConfig['defaultPriceKey']) !== ''
            ? (string)$productConfig['defaultPriceKey']
            : ($isQuadros ? 'Moldura personalizada' : 'Cadernos');
    }

    if ($size === '' && count($packPrices) === 1) {
        $keys = array_keys($packPrices);
        $size = (string)$keys[0];
    }
    if (!$isCustomArtwork) {
        $priceKey = $size;
        $sizeLabel = $size;
    }

    if ($customUsesSize && empty($selectedSizeItem)) {
        $errors[] = 'Escolhe um tipo válido para ' . $productName . '.';
    } elseif (!$sizeQuoteOnly && $hasPrices && !array_key_exists($priceKey, $packPrices)) {
        $errors[] = 'Escolhe um tamanho válido para ' . $productName . '.';
    }

    if ($hasPackStep && $packQuantity <= 0) {
        $errors[] = $isCadernos ? 'Escolhe uma opção de compra para ' . $productName . '.' : ($isCustomArtwork ? 'Indica a quantidade para ' . $productName . '.' : 'Escolhe um pack para ' . $productName . '.');
    } elseif (!$isCadernos && ($isCustomArtwork || $usesConfiguredPricing) && ($packQuantity < $minimumQuantity || $packQuantity > 9999)) {
        $errors[] = 'A quantidade de ' . $productName . ' deve ser entre ' . $minimumQuantity . ' e 9999.';
    } elseif ($hasPrices && $hasPackStep && !$isCustomArtwork && !$usesConfiguredPricing && (!isset($packPrices[$priceKey]) || !isset($packPrices[$priceKey][$packQuantity]))) {
        $errors[] = $isCadernos ? 'Escolhe uma opção de compra válida para ' . $productName . '.' : 'Escolhe um pack válido para ' . $productName . '.';
    }

    if ($hasUnexpectedMainArtworkUploads) {
        $errors[] = 'Não podes juntar ficheiros personalizados a uma escolha do catálogo.';
    }

    if (!$isCustomArtwork && empty($designs) && !$assortedDesigns) {
        $errors[] = $isCadernos ? 'Escolhe uma capa para ' . $productName . '.' : 'Escolhe pelo menos um design para ' . $productName . '.';
    } elseif (!$isCustomArtwork && !$assortedDesigns) {
        foreach ($designs as $design) {
            if (!in_array($design, $allowedDesigns, true)) {
                $errors[] = 'Um dos designs escolhidos em ' . $productName . ' não é válido.';
                break;
            }
        }
    }

    // DESIGNS_BY_SIZE_V1: alguns produtos pedem exactamente um design por
    // grupo exigido pelo tamanho escolhido (por exemplo A4, A6 ou ambos).
    // A regra vive no JSON do passo, não numa lista de slugs.
    $designStepConfig = product_step($productConfig, 'designs');
    if (!$isCustomArtwork && !$assortedDesigns
        && !empty($designStepConfig['sizeGroups']) && is_array($designStepConfig['sizeGroups'])
        && isset($designStepConfig['sizeGroups'][$size]) && is_array($designStepConfig['sizeGroups'][$size])
    ) {
        $requiredDesignGroups = array_values(array_map('strval', $designStepConfig['sizeGroups'][$size]));
        $selectedDesignGroups = array();
        $parentSelectionFields = !empty($designStepConfig['parentSelectionFields']) && is_array($designStepConfig['parentSelectionFields'])
            ? $designStepConfig['parentSelectionFields']
            : array();
        $parentItemProperty = !empty($designStepConfig['parentItemProperty'])
            ? (string)$designStepConfig['parentItemProperty']
            : 'parentValue';
        foreach ($designs as $designValue) {
            $designItemForGroup = product_step_item_by_value($designStepConfig, $designValue);
            $groupValue = !empty($designItemForGroup['sizeGroup']) ? (string)$designItemForGroup['sizeGroup'] : '';
            if ($groupValue === '' || !in_array($groupValue, $requiredDesignGroups, true)) {
                $errors[] = 'Um dos designs escolhidos não corresponde ao formato selecionado em ' . $productName . '.';
                continue;
            }
            if (isset($selectedDesignGroups[$groupValue])) {
                $errors[] = 'Escolhe apenas um design ' . $groupValue . ' em ' . $productName . '.';
                continue;
            }
            $parentField = !empty($parentSelectionFields[$groupValue]) ? (string)$parentSelectionFields[$groupValue] : '';
            if ($parentField !== '') {
                $selectedParentValue = isset($selections[$parentField]) ? cart_text($selections[$parentField]) : '';
                $itemParentValue = isset($designItemForGroup[$parentItemProperty]) ? cart_text($designItemForGroup[$parentItemProperty]) : '';
                if ($selectedParentValue === '' || $itemParentValue === '' || $selectedParentValue !== $itemParentValue) {
                    $errors[] = 'A combinação escolhida não pertence à capa ' . $groupValue . ' em ' . $productName . '.';
                    continue;
                }
            }
            $selectedDesignGroups[$groupValue] = $designValue;
        }
        foreach ($requiredDesignGroups as $requiredDesignGroup) {
            if (empty($selectedDesignGroups[$requiredDesignGroup])) {
                $errors[] = 'Escolhe o design ' . $requiredDesignGroup . ' em ' . $productName . '.';
            }
        }
        if (count($designs) !== count($requiredDesignGroups)) {
            $errors[] = 'A quantidade de designs escolhidos não corresponde ao formato selecionado em ' . $productName . '.';
        }
    }
    if ($isMainV2 && !$isCustomArtwork) {
        $designLabels = product_authoritative_design_labels($productConfig, $designs);
    }

    if ($isLegacyCustomArtwork) {
        if ($artworkUploadInvalid || $cardReferenceUploadInvalid || $cardAudioUploadInvalid) {
            $errors[] = 'Um dos anexos deixou de estar disponível. Volta a enviá-lo.';
        }
        if (empty($artworkUploads) && !$artworkHelp) {
            $errors[] = 'Envia a imagem ou indica que queres ajuda para a preparar.';
        }
        if (count($artworkUploads) > 1) {
            $errors[] = 'Envia apenas uma imagem para personalizar este produto.';
        }
        $cardDescriptionLength = function_exists('mb_strlen')
            ? mb_strlen($cardDescription, 'UTF-8')
            : strlen($cardDescription);
        if ($cardDescriptionLength > 2000) {
            $errors[] = 'A descrição do cartão deve ter no máximo 2000 caracteres.';
        }
    } elseif ($isMainCustomArtwork) {
        if ($artworkUploadInvalid) {
            $errors[] = 'Um dos ficheiros personalizados ou respetiva quantidade não é válido. Volta a enviá-lo.';
        }
        if (empty($artworkUploads)) {
            $errors[] = 'Carrega pelo menos uma imagem ou PDF para personalizar este produto.';
        }
        if (count($artworkUploads) > 10) {
            $errors[] = 'Podes carregar no máximo 10 ficheiros personalizados por produto.';
        }
        if ($artworkTotalQuantity < 1 || $artworkTotalQuantity > 99990) {
            $errors[] = 'Confirma as quantidades dos ficheiros personalizados.';
        }
        if ($hasUnexpectedCustomDesigns) {
            $errors[] = 'Não podes juntar designs do catálogo a ficheiros personalizados.';
        }
    }

    if ($isCustomArtwork) {
        $designs = array();
        $designQuantities = array();
        $designLabels = array();
        $assortedDesigns = false;
    }

    if ($isQuadros) {
        $standardQuadroTypes = array(
            'Foto e Frase',
            'Jardim de Flores e Frase',
            'Coração e Frase',
            'O Amor Nunca Acaba',
            'Silhueta e Frase',
        );
        $allowedQuadroTypes = array_merge($standardQuadroTypes, array('Quadro para bebé', 'Super Personalizado'));

        if (!in_array($quadroType, $allowedQuadroTypes, true) || empty($quadroTypeItem)) {
            $errors[] = 'Escolhe um tipo de moldura válido.';
        }
        if (empty($quadroPackagingItem)) {
            $errors[] = 'Escolhe a proteção ou o embrulho da moldura.';
        }
        if ($quadroUploadInvalid || $quadroReferenceUploadInvalid || $quadroAudioUploadInvalid || ($quadroType === 'Silhueta e Frase' && ($quadroSilhouetteUploadInvalid || $quadroSilhouetteAudioUploadInvalid))) {
            $errors[] = 'Um dos anexos deixou de estar disponível. Volta a enviá-lo.';
        }
        if (in_array($quadroType, $standardQuadroTypes, true)) {
            if (empty($quadroColorSelection['valid'])) {
                $errors[] = 'Escolhe uma combinação ou o número indicado de cores válidas para a moldura.';
            }

            if ($quadroType === 'O Amor Nunca Acaba') {
                $dedicationLength = function_exists('mb_strlen')
                    ? mb_strlen($quadroDedication, 'UTF-8')
                    : strlen($quadroDedication);
                if ($dedicationLength > 500) {
                    $errors[] = 'A dedicatória deve ter no máximo 500 caracteres.';
                }
                if ($quadroNoDedication) {
                    $quadroDedication = '';
                }
                $quadroText = '';
                $quadroNoPhrase = false;
                $quadroNoText = false;
            } else {
                $quadroTextLength = function_exists('mb_strlen')
                    ? mb_strlen($quadroText, 'UTF-8')
                    : strlen($quadroText);
                $skipText = $quadroType === 'Silhueta e Frase' ? $quadroNoText : $quadroNoPhrase;
                $hasTextDetails = $quadroText !== '' || $skipText || !empty($quadroReferenceUploads) || !empty($quadroAudioUploads);
                if (!$hasTextDetails) {
                    $errors[] = $quadroType === 'Silhueta e Frase'
                        ? 'Indica a personalização do texto ou escolhe a opção sem texto.'
                        : 'Indica a personalização do texto ou escolhe a opção sem frase.';
                } elseif ($quadroTextLength > 500) {
                    $errors[] = 'O texto da moldura deve ter no máximo 500 caracteres.';
                }
                if ($skipText) {
                    $quadroText = '';
                }
            }
        }

        if ($quadroType === 'Coração e Frase') {
            $allowedHeartFinishes = product_step_values($productConfig, 'heart_finish');
            if (!in_array($quadroHeartFinish, $allowedHeartFinishes, true)) {
                $errors[] = 'Escolhe flores 3D ou glitter para o coração.';
            }
            if (empty($quadroBackgroundSelection['valid'])) {
                $errors[] = 'Escolhe uma cor válida para o fundo do coração.';
            }
        } else {
            $quadroHeartFinish = '';
            $quadroBackgroundPalette = '';
            $quadroBackgroundPaletteItem = array();
            $quadroBackgroundPaletteColors = array();
            $quadroBackgroundColorValues = array();
            $quadroBackgroundColorTones = array();
            $quadroBackgroundColors = array();
            $quadroBackgroundMia = false;
        }

        if ($quadroType === 'Foto e Frase') {
            if ($quadroPhotoOrientation !== 'Horizontal' && $quadroPhotoOrientation !== 'Vertical') {
                $errors[] = 'Escolhe a orientação da foto da moldura.';
            }
            if (count($quadroUploads) > 1) {
                $errors[] = 'Escolhe apenas uma foto para esta moldura.';
            } elseif (empty($quadroUploads) && !$quadroPhotoHelp) {
                $errors[] = 'Escolhe uma foto ou indica que precisas de ajuda para a enviar.';
            }
        } elseif ($quadroType === 'Super Personalizado') {
            $quadroPalette = '';
            $quadroPaletteItem = array();
            $quadroPaletteColors = array();
            $quadroColorValues = array();
            $quadroColorTones = array();
            $quadroColors = array();
            $quadroMiaColors = false;
            $quadroPhotoOrientation = '';
            $quadroPhotoHelp = false;
            $quadroSilhouette = '';
            $quadroText = '';
            $quadroNoPhrase = false;
            $quadroNoText = false;
            $quadroDedication = '';
            $quadroNoDedication = false;
            $quadroUploads = array();
            $quadroFrameSize = '';
            $quadroFrameItem = array();
            $quadroFramePriceCents = 0;

            $quadroDescriptionLength = function_exists('mb_strlen')
                ? mb_strlen($quadroDescription, 'UTF-8')
                : strlen($quadroDescription);
            $allowedSuperExamples = array();
            if (!empty($quadroSuperStep['exampleImages']) && is_array($quadroSuperStep['exampleImages'])) {
                foreach ($quadroSuperStep['exampleImages'] as $exampleItem) {
                    if (is_array($exampleItem) && !empty($exampleItem['value'])) {
                        $exampleValue = trim((string)$exampleItem['value']);
                        $allowedSuperExamples[] = $exampleValue;
                        if ($quadroSuperExample === $exampleValue && !empty($exampleItem['frameSize'])) {
                            $quadroFrameSize = cart_text($exampleItem['frameSize']);
                        }
                    }
                }
            }
            if ($quadroSuperExample !== '' && !in_array($quadroSuperExample, $allowedSuperExamples, true)) {
                $errors[] = 'A sugestão escolhida para a moldura não é válida.';
            }
            if ($quadroDescription === '' && $quadroSuperExample === '' && empty($quadroReferenceUploads) && empty($quadroAudioUploads)) {
                $errors[] = 'Escolhe uma sugestão ou descreve a moldura que pretendes.';
            } elseif ($quadroDescriptionLength > 1500) {
                $errors[] = 'A descrição deve ter no máximo 1500 caracteres.';
            }
        } else {
            $quadroPhotoOrientation = '';
            $quadroPhotoHelp = false;
            $quadroUploads = array();
        }

        if ($quadroType === 'Quadro para bebé') {
            $allowedBabyAnimals = product_step_values($productConfig, 'baby_animal');
            $allowedBabyGenders = product_step_values($productConfig, 'baby_gender');
            if (!in_array($quadroBabyAnimal, $allowedBabyAnimals, true)) {
                $errors[] = 'Escolhe um animal válido para a moldura de bebé.';
            }
            if (!in_array($quadroBabyGender, $allowedBabyGenders, true)) {
                $errors[] = 'Escolhe se a moldura é para menino ou menina.';
            }

            $babyFields = array(
                array($quadroBabyName, 100, 'Indica o nome da criança.', 'O nome da criança deve ter no máximo 100 caracteres.'),
                array($quadroBabyBirthDate, 60, 'Indica a data de nascimento.', 'A data de nascimento deve ter no máximo 60 caracteres.'),
                array($quadroBabyBirthTime, 30, 'Indica a hora de nascimento.', 'A hora de nascimento deve ter no máximo 30 caracteres.'),
                array($quadroBabyBirthWeight, 30, 'Indica o peso à nascença.', 'O peso à nascença deve ter no máximo 30 caracteres.'),
            );
            foreach ($babyFields as $babyField) {
                $babyLength = function_exists('mb_strlen') ? mb_strlen($babyField[0], 'UTF-8') : strlen($babyField[0]);
                if ($babyField[0] !== '' && $babyLength > $babyField[1]) {
                    $errors[] = $babyField[3];
                }
            }

            if (empty($quadroColorSelection['valid'])) {
                $errors[] = 'Escolhe uma cor válida para a moldura de bebé ou deixa a escolha com a Mia.';
            }

            $quadroText = '';
            $quadroNoPhrase = false;
            $quadroNoText = false;
            $quadroDedication = '';
            $quadroNoDedication = false;
            $quadroSilhouette = '';
            $quadroDescription = '';
            $quadroSuperExample = '';
        } else {
            $quadroBabyAnimal = '';
            $quadroBabyGender = '';
            $quadroBabyName = '';
            $quadroBabyBirthDate = '';
            $quadroBabyBirthTime = '';
            $quadroBabyBirthWeight = '';
        }

        if ($quadroType === 'Silhueta e Frase') {
            if (!in_array($quadroSilhouette, $allowedQuadroSilhouettes, true)) {
                $errors[] = 'Escolhe uma silhueta válida para a moldura.';
            }
            $silhouetteDescriptionLength = function_exists('mb_strlen')
                ? mb_strlen($quadroSilhouetteDescription, 'UTF-8')
                : strlen($quadroSilhouetteDescription);
            if ($silhouetteDescriptionLength > 1500) {
                $errors[] = 'A descrição da silhueta deve ter no máximo 1500 caracteres.';
            }
            if ($quadroSilhouette === 'Outra silhueta') {
                $hasSilhouetteDetails = $quadroSilhouetteDescription !== ''
                    || $quadroSilhouetteContactMe
                    || !empty($quadroSilhouetteUploads)
                    || !empty($quadroSilhouetteAudioUploads);
                if (!$hasSilhouetteDetails) {
                    $errors[] = 'Descreve a silhueta, envia uma foto ou um áudio, ou pede que entremos em contacto.';
                }
            } else {
                $quadroSilhouetteDescription = '';
                $quadroSilhouetteContactMe = false;
                $quadroSilhouetteUploads = array();
                $quadroSilhouetteAudioUploads = array();
            }
        } else {
            $quadroSilhouette = '';
            $quadroSilhouetteDescription = '';
            $quadroSilhouetteContactMe = false;
            $quadroSilhouetteUploads = array();
            $quadroSilhouetteAudioUploads = array();
        }

        if ($quadroType !== 'O Amor Nunca Acaba') {
            $quadroDedication = '';
            $quadroNoDedication = false;
        }
        if ($quadroType !== 'Silhueta e Frase') {
            $quadroNoText = false;
        }
    }

    if ($isCadernos) {
        if (!empty($designs) && count($uniqueDesigns) !== 1) {
            $errors[] = 'Escolhe uma capa para ' . $productName . '.';
        }

        if (empty($laminationItem)) {
            $errors[] = 'Escolhe um acabamento da capa válido para ' . $productName . '.';
        }

        if (empty($purchaseItem)) {
            $errors[] = 'Escolhe uma opção de compra válida para ' . $productName . '.';
        }

        if ($usesConfiguredPricing && ($cadernoOrderQuantity < 1 || $cadernoOrderQuantity > 9999)) {
            $errors[] = 'Escolhe uma quantidade válida para ' . $productName . '.';
        } elseif (!$usesConfiguredPricing && !in_array($cadernoOrderQuantity, $cadernoOrderQuantityOptions, true)) {
            $errors[] = 'Escolhe uma quantidade válida para ' . $productName . '.';
        }

    }

    if ($hasPersonalizationStep) {
        foreach ($coverPersonalizationQuestions as $q) {
            $qVal = cart_string_selection($selections, $q['field']);
            $qText = cart_string_selection($selections, $q['textField']);
            $qLabel = !empty($q['label']) ? $q['label'] : 'capa';

            if ($qVal !== 'yes' && $qVal !== 'no') {
                $errors[] = 'Escolhe se queres personalizar a ' . $qLabel . ' em ' . $productName . '.';
            } elseif ($qVal === 'yes') {
                $qLimit = $q['maxLength'];
                $qLength = function_exists('mb_strlen') ? mb_strlen($qText, 'UTF-8') : strlen($qText);

                if ($qText === '') {
                    $errors[] = 'Escreve o nome/frase para personalizar a ' . $qLabel . ' em ' . $productName . '.';
                } elseif ($qLength > $qLimit) {
                    $errors[] = 'O nome/frase da ' . $qLabel . ' em ' . $productName . ' tem de ter no máximo ' . $qLimit . ' caracteres.';
                }
            }
        }
    }

    if (!empty($designs) && $hasPackStep && $packQuantity > 0 && !$assortedDesigns && !$isCadernos) {
        $quantityTotal = 0;

        foreach ($designs as $design) {
            if (!isset($designQuantities[$design]) || $designQuantities[$design] < 1) {
                $errors[] = 'Indica a quantidade de cada design em ' . $productName . '.';
                break;
            }
            $quantityTotal += $designQuantities[$design];
        }

        foreach ($designQuantities as $design => $quantity) {
            if (!in_array($design, $designs, true)) {
                $errors[] = 'As quantidades não correspondem aos designs escolhidos em ' . $productName . '.';
                break;
            }
        }

        if ($quantityTotal !== $packQuantity) {
            $errors[] = 'A soma das quantidades em ' . $productName . ' tem de ser igual ao pack escolhido.';
        }
    }

    if (!$isCadernos && $recipientName !== '' && (strlen($recipientName) < 2 || strlen($recipientName) > 120)) {
        $errors[] = 'Confirma o nome para o cartão em ' . $productName . '.';
    }

    if (!$isCadernos && $contact !== '' && (strlen($contact) < 3 || strlen($contact) > 160)) {
        $errors[] = 'Confirma o contacto opcional em ' . $productName . '.';
    }

    if (!$isCadernos && $congregation !== '' && (strlen($congregation) < 2 || strlen($congregation) > 160)) {
        $errors[] = 'Confirma a congregação opcional em ' . $productName . '.';
    }

    $mainFlatPriceKey = $usesConfiguredPricing && $isCadernos && !empty($purchaseItem['value'])
        ? cart_text($purchaseItem['value'])
        : $priceKey;
    // Nos produtos com packs o total vem da combinação de packs (ou da escada,
    // no modo antigo) e não de unitário x quantidade: só assim os packs
    // configurados dão exatamente o total configurado (96 crachás = 90,00 €).
    // O unitário passa a ser derivado, apenas para as linhas de "x €/unidade".
    // Um tamanho por orçamentar não tem tabela nenhuma: fica fora de todos os
    // modos para não disparar os erros de "preço não confirmado".
    $mainV2HasQuantityPricingSwitch = $usesConfiguredPricing
        && !$sizeQuoteOnly
        && main_v2_quantity_pricing_switch_enabled($productConfig, $mainFlatPriceKey);
    if ($usesConfiguredPricing && !in_array($quantityPricingMode, array('', 'packs', 'quantity_tiers'), true)) {
        $errors[] = 'O método de cálculo do preço não é válido.';
    } elseif ($usesConfiguredPricing && $quantityPricingMode === 'quantity_tiers' && !$mainV2HasQuantityPricingSwitch) {
        $errors[] = 'O desconto por quantidade não está disponível para esta opção.';
    }
    $mainV2SelectedPricingMode = $usesConfiguredPricing && !$sizeQuoteOnly
        ? main_v2_selected_pricing_mode($productConfig, $mainFlatPriceKey, $quantityPricingMode)
        : '';
    $mainV2UsesLadder = $mainV2SelectedPricingMode === 'linear-discount-interpolation';
    $mainV2UsesPacks = $mainV2SelectedPricingMode === 'pack-combination';
    $mainV2UsesTiers = $mainV2SelectedPricingMode === 'tier-unit';
    $mainV2PriceTable = !empty($packPrices[$mainFlatPriceKey]) && is_array($packPrices[$mainFlatPriceKey])
        ? $packPrices[$mainFlatPriceKey]
        : array();
    $mainV2PackPlan = $mainV2UsesPacks && !empty($mainV2PriceTable)
        ? product_pack_combination_plan(
            $mainV2PriceTable,
            $packQuantity,
            main_v2_pack_combination_prefers_fewer_packs($productConfig, $mainFlatPriceKey)
        )
        : null;
    $mainV2LowestTier = $mainV2UsesTiers ? product_lowest_tier_quantity($mainV2PriceTable) : 0;
    $mainV2LadderTotalCents = $mainV2UsesLadder && !empty($mainV2PriceTable)
        ? product_linear_discount_price_cents($mainV2PriceTable, $packQuantity)
        : ($mainV2UsesTiers && !empty($mainV2PriceTable) && $mainV2LowestTier > 0 && $packQuantity >= $mainV2LowestTier
            ? product_tier_price_cents($mainV2PriceTable, $packQuantity)
            : ($mainV2PackPlan !== null ? (int)$mainV2PackPlan['cents'] : 0));
    $mainV2UsesTotalFromPacks = $mainV2UsesLadder || $mainV2UsesPacks || $mainV2UsesTiers;
    $mainFlatUnitPriceCents = $usesConfiguredPricing
        ? ($mainV2UsesTotalFromPacks
            ? ($packQuantity > 0 ? (int)round($mainV2LadderTotalCents / $packQuantity) : 0)
            : product_flat_unit_price_cents($productConfig, $pricingProduct, $mainFlatPriceKey))
        : 0;
    // Sem combinação exacta não há preço: os packs não conseguem somar esta
    // quantidade (ex. 20 ímanes achatados, cujos packs são múltiplos de 15).
    if ($mainV2UsesPacks && $mainV2PackPlan === null) {
        $errors[] = 'A quantidade de ' . $productName . ' não corresponde a nenhuma combinação de packs. Escolhe uma das quantidades disponíveis.';
    }
    // No modo escalão qualquer quantidade serve, desde o primeiro escalão para
    // cima: abaixo dele não há preço configurado (15 ímanes finos, 12 recortados).
    if ($mainV2UsesTiers && ($mainV2LowestTier <= 0 || $packQuantity < $mainV2LowestTier)) {
        $errors[] = 'A quantidade de ' . $productName . ' é inferior ao mínimo. Escolhe uma quantidade a partir de ' . max(1, $mainV2LowestTier) . '.';
    }
    if ($mainV2UsesTotalFromPacks && $mainV2LadderTotalCents <= 0 && $mainV2PackPlan !== null) {
        $errors[] = 'Não foi possível confirmar o preço de ' . $productName . '.';
    }
    if ($mainV2UsesLadder && $mainV2LadderTotalCents <= 0) {
        $errors[] = 'Não foi possível confirmar o preço de ' . $productName . '.';
    }
    if ($usesConfiguredPricing && !$sizeQuoteOnly && !$mainV2UsesTotalFromPacks && $mainFlatUnitPriceCents <= 0) {
        $errors[] = 'Não foi possível confirmar o preço unitário de ' . $productName . '.';
    }
    if ($usesConfiguredPricing && $isCadernos && $mainFlatPriceKey !== '') {
        $priceKey = $mainFlatPriceKey;
    }

    $authoritativeCatalogContext = $isMainV2 ? 'main-v2' : ($isCongress ? 'congress-2026' : ($catalogContext !== '' ? $catalogContext : 'main'));
    if ($isMainV2) {
        $selections['catalog_context'] = 'main-v2';
        $selections['order_flow'] = $orderFlow;
        $selections['design_source'] = $designSource;
        $selections['designs'] = $designs;
        $selections['design_quantities'] = $designQuantities;
        $selections['design_labels'] = $designLabels;
        if ($mainV2HasQuantityPricingSwitch) {
            $selections['quantity_pricing_mode'] = $quantityPricingMode === 'quantity_tiers' ? 'quantity_tiers' : 'packs';
        } else {
            unset($selections['quantity_pricing_mode']);
        }
        unset($selections['custom_artwork_uploads']);
        if ($isMainCustomArtwork) {
            $selections['customization_file_count'] = $customizationFileCount;
            $selections['customization_fee_cents'] = $customizationFeeCents;
            $selections['artwork_total_quantity'] = $artworkTotalQuantity;
        }
    } elseif ($isCongress) {
        $selections['catalog_context'] = 'congress-2026';
    }

    if (!empty($errors)) {
        return array('errors' => $errors);
    }

    $unitLabel = isset($productConfig['unitLabel']) && trim((string)$productConfig['unitLabel']) !== '' ? trim((string)$productConfig['unitLabel']) : (($slug === 'crachas' || $slug === 'pins') ? 'crachás' : 'unidades');
    $unitShort = isset($productConfig['unitShort']) && trim((string)$productConfig['unitShort']) !== '' ? trim((string)$productConfig['unitShort']) : (($slug === 'crachas' || $slug === 'pins') ? 'crachá' : 'unid.');
    $basePriceCents = $usesConfiguredPricing
        ? $mainFlatUnitPriceCents
        : ($isCustomArtwork
            ? (isset($packPrices[$priceKey])
                ? ($usesLinearDiscountPricing
                    ? product_linear_discount_price_cents($packPrices[$priceKey], $packQuantity)
                    : product_tier_price_cents($packPrices[$priceKey], $packQuantity))
                : 0)
            : (($hasPrices && isset($packPrices[$priceKey][$packQuantity])) ? $packPrices[$priceKey][$packQuantity] : 0));
    if (!$usesConfiguredPricing && $isCadernos && !empty($purchaseItem) && isset($purchaseItem['priceCents'])) {
        $basePriceCents = (int)$purchaseItem['priceCents'];
    } elseif ($isQuadros) {
        $quadroFixedPriceCents = isset($quadroTypeItem['priceCents'])
            ? max(0, (int)$quadroTypeItem['priceCents'])
            : 0;
        $basePriceCents = $quadroQuoteOnly
            ? 0
            : ($quadroFixedPriceCents > 0 ? $quadroFixedPriceCents : $quadroFramePriceCents);
    }
    $personalizationExtraCents = 0;
    if ($hasPersonalizationStep) {
        foreach ($coverPersonalizationQuestions as $q) {
            if (cart_string_selection($selections, $q['field']) === 'yes') {
                $personalizationExtraCents += $q['extraPriceCents'];
            }
        }
    }
    $packagingExtraCents = $isQuadros ? $quadroPackagingExtraCents : 0;
    $quoteOnly = $quadroQuoteOnly || $sizeQuoteOnly;
    $unitPriceCents = $quoteOnly
        ? 0
        : $basePriceCents + $addOnsExtraCents + $personalizationExtraCents + $packagingExtraCents + $finishExtraPerUnitCents + $optionDrawerExtraPerUnitCents;
    $productQuantity = $isCadernos ? $cadernoOrderQuantity : $packQuantity;
    $productSubtotalCents = $quoteOnly
        ? 0
        : ($usesConfiguredPricing
            ? ($mainV2UsesTotalFromPacks
                ? $mainV2LadderTotalCents + (($addOnsExtraCents + $personalizationExtraCents + $packagingExtraCents + $finishExtraPerUnitCents + $optionDrawerExtraPerUnitCents) * $productQuantity)
                : $unitPriceCents * $productQuantity)
            : ($isCadernos ? $unitPriceCents * $cadernoOrderQuantity : $unitPriceCents));
    // A preparação do design cobra-se mesmo quando o produto ainda não tem
    // preço: o trabalho de ajustar o ficheiro é o mesmo.
    $priceCents = $productSubtotalCents + ($isMainV2 ? $customizationFeeCents : 0);
    $finishExtraLine = $finishExtraPerUnitCents && $productQuantity
        ? ($productQuantity > 1
            ? format_euros($finishExtraPerUnitCents) . ' x ' . $productQuantity . ' = ' . format_euros($finishExtraPerUnitCents * $productQuantity)
            : format_euros($finishExtraPerUnitCents))
        : '';
    $optionDrawerExtraLine = $optionDrawerExtraPerUnitCents && $productQuantity
        ? ($productQuantity > 1
            ? format_euros($optionDrawerExtraPerUnitCents) . ' x ' . $productQuantity . ' = ' . format_euros($optionDrawerExtraPerUnitCents * $productQuantity)
            : format_euros($optionDrawerExtraPerUnitCents))
        : '';
    $priceRangeLine = '';
    if ($sizeQuoteOnly && !$quadroQuoteOnly) {
        $priceRangeLine = isset($selectedSizeItem['note']) && cart_text($selectedSizeItem['note']) !== ''
            ? cart_text($selectedSizeItem['note'])
            : 'Preço a confirmar';
    }
    if ($quadroQuoteOnly) {
        if ($quadroPriceNote !== '') {
            $priceRangeLine = $quadroPriceNote;
        } elseif ($quadroPriceMaxCents > $quadroPriceMinCents) {
            $priceRangeLine = 'Entre ' . format_euros($quadroPriceMinCents) . ' e ' . format_euros($quadroPriceMaxCents);
        } else {
            $priceRangeLine = 'A partir de ' . format_euros($quadroPriceMinCents);
        }
    }
    $priceLine = $quadroQuoteOnly
        ? $priceRangeLine . ' (a confirmar)'
        : ($sizeQuoteOnly
            ? $priceRangeLine . ($customizationFeeCents ? ' + ' . format_euros($customizationFeeCents) . ' de preparação' : '')
            : ($priceCents ? format_euros($priceCents) : 'Não calculado'));
    $unitPriceLine = $quoteOnly
        ? ''
        : ($usesConfiguredPricing && $unitPriceCents
            ? format_euros($unitPriceCents) . '/' . $unitShort
            : ((!$isCadernos && $priceCents) ? format_unit_price($priceCents, $packQuantity, $unitShort) : ''));

    if ($isCadernos && !empty($laminationItem)) {
        $laminationLabel = isset($laminationItem['title']) ? (string)$laminationItem['title'] : $lamination;
    } else {
        $laminationLabel = '';
    }

    $purchaseOption = '';
    $purchaseOptionLabel = '';
    $purchaseIncludes = '';
    $purchaseIsPack = false;
    $packPromoNote = '';
    if ($isCadernos && !empty($purchaseItem)) {
        $purchaseOption = isset($purchaseItem['value']) ? (string)$purchaseItem['value'] : '';
        $purchaseOptionLabel = isset($purchaseItem['title']) ? (string)$purchaseItem['title'] : '';
        $purchaseIncludes = isset($purchaseItem['includes']) ? (string)$purchaseItem['includes'] : '';
        $purchaseIsPack = !empty($purchaseItem['isPack']);
        $packPromoNote = $purchaseIsPack && isset($purchaseStep['promoNote']) ? (string)$purchaseStep['promoNote'] : '';
    }

    $designLinesOwner = array();
    $designLinesCustomer = array();
    $coverLineOwner = '';
    $coverLineCustomer = '';
    if ($isCadernos) {
        $coverDesign = isset($designs[0]) ? $designs[0] : '';
        $coverLabel = isset($designLabels[$coverDesign]) ? $designLabels[$coverDesign] : $coverDesign;
        $coverLineOwner = $coverLabel . ($coverLabel !== $coverDesign && $coverDesign !== '' ? ' (' . $coverDesign . ')' : '');
        $coverLineCustomer = $coverLabel;
        $designLinesOwner[] = 'Capa escolhida: ' . $coverLineOwner;
        $designLinesCustomer[] = 'Capa escolhida: ' . $coverLineCustomer;
    } elseif ($assortedDesigns) {
        $designLinesOwner[] = 'Sortido - A Mia vai escolher uma combinação de designs de acordo com a quantidade escolhida.';
        $designLinesCustomer[] = 'Sortido - a Mia vai escolher uma combinação de designs de acordo com a quantidade escolhida.';
    } else {
        foreach ($designs as $design) {
            $quantity = isset($designQuantities[$design]) ? $designQuantities[$design] : 0;
            $displayLabel = isset($designLabels[$design]) ? $designLabels[$design] : '';
            if ($displayLabel !== '' && $displayLabel !== $design) {
                $designLinesOwner[] = $displayLabel . ' (' . $design . ') x' . $quantity;
                $designLinesCustomer[] = $displayLabel . ' x' . $quantity;
            } else {
                $designLinesOwner[] = $design . ' x' . $quantity;
                $designLinesCustomer[] = $design . ' x' . $quantity;
            }
        }
    }

    // Com packs combinados a linha do preço mostra a combinação, que é a única
    // explicação honesta do total: "1 pack de 24 + 4 packs de 5 + 1 pack de 3".
    $packCombinationLine = $mainV2PackPlan !== null
        ? product_pack_combination_line($mainV2PackPlan, $unitLabel, $unitShort)
        : '';
    // O extra do acabamento tem linha propria (finish_extra_line), por isso a
    // linha dos packs mostra so o preco dos produtos — senao a soma "1 pack de
    // 24 + 4 packs de 5 = X" nao fecharia com o X apresentado.
    $productBaseSubtotalCents = max(0, $productSubtotalCents - (($addOnsExtraCents + $personalizationExtraCents + $packagingExtraCents + $finishExtraPerUnitCents + $optionDrawerExtraPerUnitCents) * $productQuantity));
    $basePriceLine = $quoteOnly
        ? ($priceRangeLine !== '' ? $priceRangeLine : 'Preço a confirmar')
        : ($basePriceCents
            ? ($packCombinationLine !== ''
                ? $packCombinationLine . ' = ' . format_euros($productBaseSubtotalCents)
                : ($usesConfiguredPricing
                    ? format_euros($basePriceCents) . ' x ' . $productQuantity . ' = ' . format_euros($productBaseSubtotalCents)
                    : ($isCadernos && $cadernoOrderQuantity > 1 ? format_euros($basePriceCents) . ' x ' . $cadernoOrderQuantity . ' = ' . format_euros($basePriceCents * $cadernoOrderQuantity) : format_euros($basePriceCents))))
            : 'Não calculado');
    $personalizationExtraLine = $personalizationExtraCents
        ? ($productQuantity > 1 ? format_euros($personalizationExtraCents) . ' x ' . $productQuantity . ' = ' . format_euros($personalizationExtraCents * $productQuantity) : format_euros($personalizationExtraCents))
        : '';

    $coverPersonalizationSummaryLines = array();
    if ($hasPersonalizationStep) {
        foreach ($coverPersonalizationQuestions as $q) {
            $qVal = cart_string_selection($selections, $q['field']);
            $qText = cart_string_selection($selections, $q['textField']);
            if ($qVal === 'yes') {
                $coverPersonalizationSummaryLines[] = 'Personalização (' . $q['label'] . '): Sim' . ($qText !== '' ? ' — ' . $qText : '');
            } elseif ($qVal === 'no') {
                $coverPersonalizationSummaryLines[] = 'Personalização (' . $q['label'] . '): Não';
            }
        }
    }
    $addOnsExtraLine = $addOnsExtraCents
        ? ($isCadernos && $cadernoOrderQuantity > 1 ? format_euros($addOnsExtraCents) . ' x ' . $cadernoOrderQuantity . ' = ' . format_euros($addOnsExtraCents * $cadernoOrderQuantity) : format_euros($addOnsExtraCents))
        : '';
    $packagingExtraLine = $packagingExtraCents ? format_euros($packagingExtraCents) : 'Grátis';
    $customizationFeeLine = $customizationFeeCents > 0
        ? $customizationFileCount . ' ' . ($customizationFileCount === 1 ? 'ficheiro' : 'ficheiros') . ' x ' . format_euros($customizationFeePerFileCents) . ' = ' . format_euros($customizationFeeCents)
        : '';

    return array(
        'errors' => array(),
        'product_slug' => $slug,
        'product_name' => $productName,
        'catalog_context' => $authoritativeCatalogContext,
        'order_flow' => $isMainV2 ? $orderFlow : ($isLegacyCustomArtwork ? 'custom-artwork' : ($orderFlow !== '' ? $orderFlow : 'catalog')),
        'design_source' => $isMainV2 ? $designSource : '',
        'is_main_v2' => $isMainV2,
        'is_congress_2026' => $isCongress,
        'is_cadernos' => $isCadernos,
        'is_quadros' => $isQuadros,
        'is_custom_artwork' => $isCustomArtwork,
        'quadro_type' => $quadroType,
        'quadro_type_label' => $quadroTypeLabel,
        'quadro_palette' => $quadroPalette,
        'quadro_palette_label' => !empty($quadroPaletteItem['title']) ? (string)$quadroPaletteItem['title'] : $quadroPalette,
        'quadro_palette_colors' => $quadroPaletteColors,
        'quadro_color_values' => $quadroColorValues,
        'quadro_color_tones' => $quadroColorTones,
        'quadro_colors' => $quadroColors,
        'quadro_mia_colors' => $quadroMiaColors,
        'quadro_background_palette' => $quadroBackgroundPalette,
        'quadro_background_palette_label' => !empty($quadroBackgroundPaletteItem['title']) ? (string)$quadroBackgroundPaletteItem['title'] : $quadroBackgroundPalette,
        'quadro_background_palette_colors' => $quadroBackgroundPaletteColors,
        'quadro_background_color_values' => $quadroBackgroundColorValues,
        'quadro_background_color_tones' => $quadroBackgroundColorTones,
        'quadro_background_colors' => $quadroBackgroundColors,
        'quadro_background_mia' => $quadroBackgroundMia,
        'quadro_photo_orientation' => $quadroPhotoOrientation,
        'quadro_silhouette' => $quadroSilhouette,
        'quadro_silhouette_description' => $quadroSilhouetteDescription,
        'quadro_silhouette_contact_me' => $quadroSilhouetteContactMe,
        'quadro_text' => $quadroText,
        'quadro_no_phrase' => $quadroNoPhrase,
        'quadro_no_text' => $quadroNoText,
        'quadro_dedication' => $quadroDedication,
        'quadro_no_dedication' => $quadroNoDedication,
        'quadro_description' => $quadroDescription,
        'quadro_super_example' => $quadroSuperExample,
        'quadro_heart_finish' => $quadroHeartFinish,
        'quadro_frame_size' => $quadroFrameSize,
        'quadro_packaging' => $quadroPackaging,
        'quadro_packaging_label' => $quadroPackagingLabel,
        'quadro_packaging_extra_cents' => $packagingExtraCents,
        'quadro_packaging_extra_line' => $packagingExtraLine,
        'quadro_baby_animal' => $quadroBabyAnimal,
        'quadro_baby_gender' => $quadroBabyGender,
        'quadro_baby_name' => $quadroBabyName,
        'quadro_baby_birth_date' => $quadroBabyBirthDate,
        'quadro_baby_birth_time' => $quadroBabyBirthTime,
        'quadro_baby_birth_weight' => $quadroBabyBirthWeight,
        'quadro_photo_help' => $quadroPhotoHelp,
        'quadro_uploads' => $quadroUploads,
        'quadro_reference_uploads' => $quadroReferenceUploads,
        'quadro_silhouette_uploads' => $quadroSilhouetteUploads,
        'quadro_silhouette_audio_uploads' => $quadroSilhouetteAudioUploads,
        'quadro_audio_uploads' => $quadroAudioUploads,
        'size' => $size,
        'size_label' => $sizeLabel,
        'price_key' => $priceKey,
        'pack_quantity' => $packQuantity,
        'product_quantity' => $productQuantity,
        'artwork_uploads' => $artworkUploads,
        'artwork_total_quantity' => $artworkTotalQuantity,
        'customization_file_count' => $customizationFileCount,
        'customization_fee_per_file_cents' => $customizationFeePerFileCents,
        'customization_fee_cents' => $customizationFeeCents,
        'customization_fee_label' => $customizationFeeCents > 0 ? 'Preparação da imagem e testes' : '',
        'customization_fee_description' => $customizationFeeCents > 0 ? 'Inclui a preparação de cada ficheiro e os testes necessários antes da produção.' : '',
        'customization_fee_line' => $customizationFeeLine,
        'artwork_help' => $artworkHelp,
        'card_description' => $cardDescription,
        'card_reference_uploads' => $cardReferenceUploads,
        'card_audio_uploads' => $cardAudioUploads,
        'unit_label' => $unitLabel,
        'unit_short' => $unitShort,
        'designs' => $designs,
        'design_quantities' => $designQuantities,
        'design_labels' => $designLabels,
        'assorted_designs' => $assortedDesigns,
        'design_lines_owner' => $designLinesOwner,
        'design_lines_customer' => $designLinesCustomer,
        'recipient_name' => $recipientName,
        'card_contact' => $contact,
        'congregation' => $congregation,
        'congregation_gift' => $congregationGift,
        'has_card_details_step' => $hasCardDetailsStep,
        'show_congregation_gift_line' => $showCongregationGiftLine,
        'lamination' => $lamination,
        'lamination_label' => $laminationLabel,
        'add_ons' => $selectedAddOns,
        'add_on_labels' => $addOnLabels,
        'add_ons_extra_cents' => $addOnsExtraCents,
        'add_ons_extra_line' => $addOnsExtraLine,
        'purchase_option' => $purchaseOption,
        'purchase_option_label' => $purchaseOptionLabel,
        'purchase_includes' => $purchaseIncludes,
        'purchase_is_pack' => $purchaseIsPack,
        'caderno_order_quantity' => $cadernoOrderQuantity,
        'base_price_cents' => $basePriceCents,
        'base_price_line' => $basePriceLine,
        'pack_combination_line' => $packCombinationLine,
        'cover_line_owner' => $coverLineOwner,
        'cover_line_customer' => $coverLineCustomer,
        'cover_personalization' => $coverPersonalization,
        'cover_personalization_text' => $coverPersonalizationText,
        'cover_personalization_line' => $coverPersonalization === 'yes' ? 'Sim' : 'Não',
        'cover_personalization_summary_lines' => $coverPersonalizationSummaryLines,
        'personalization_extra_cents' => $personalizationExtraCents,
        'personalization_extra_line' => $personalizationExtraLine,
        'unit_price_cents' => $unitPriceCents,
        'product_subtotal_cents' => $productSubtotalCents,
        'price_cents' => $priceCents,
        'price_line' => $priceLine,
        'price_quote_only' => $quoteOnly,
        'finish_labels' => $finishLabels,
        'finish_extra_per_unit_cents' => $finishExtraPerUnitCents,
        'finish_extra_line' => $finishExtraLine,
        'variant_labels' => $variantLabels,
        'option_drawer_labels' => $optionDrawerLabels,
        'option_drawer_extra_per_unit_cents' => $optionDrawerExtraPerUnitCents,
        'option_drawer_extra_line' => $optionDrawerExtraLine,
        'price_min_cents' => $quadroPriceMinCents,
        'price_max_cents' => $quadroPriceMaxCents,
        'price_range_line' => $priceRangeLine,
        'unit_price_line' => $unitPriceLine,
        'pack_promo_note' => $packPromoNote,
        'raw_selections' => $selections,
    );
}

function cart_item_owner_lines($line)
{
    $rows = array();

    if (!empty($line['is_custom_artwork'])) {
        if (!empty($line['is_main_v2'])) {
            $rows[] = 'Produto: ' . $line['product_name'];
            $rows[] = 'Contexto: catálogo principal (main-v2) — personalização com ficheiros próprios';
            if (!empty($line['purchase_option_label'])) {
                $rows[] = 'Opção: ' . $line['purchase_option_label'];
            } elseif (!empty($line['size_label'])) {
                $rows[] = 'Tipo/tamanho: ' . $line['size_label'];
            }
            foreach ($line['artwork_uploads'] as $index => $upload) {
                $uploadName = isset($upload['name']) ? $upload['name'] : 'ficheiro';
                $uploadQuantity = isset($upload['quantity']) ? (int)$upload['quantity'] : 0;
                $rows[] = 'Ficheiro ' . ($index + 1) . ': ' . $uploadName . ' — ' . $uploadQuantity . ' ' . $line['unit_label'] . ' — +' . format_euros($line['customization_fee_per_file_cents']) . ' (preparação da imagem e testes; disponível no painel de encomendas)';
            }
            if (!empty($line['variant_labels'])) {
                $rows[] = 'Opções: ' . implode(' · ', $line['variant_labels']);
            }
            if (!empty($line['finish_labels'])) {
                $rows[] = 'Acabamento: ' . implode(' · ', $line['finish_labels'])
                    . ($line['finish_extra_line'] !== '' ? ' — ' . $line['finish_extra_line'] : '');
            }
            $rows[] = 'Quantidade total: ' . $line['product_quantity'] . ' ' . $line['unit_label'];
            $rows[] = 'Produtos sem taxa: ' . format_euros($line['product_subtotal_cents']) . ' (' . $line['base_price_line'] . ')';
            $rows[] = 'Taxas de personalização: ' . $line['customization_fee_line'];
            $rows[] = 'Razão da taxa: ' . $line['customization_fee_description'];
            $rows[] = 'Preço total do produto: ' . $line['price_line'];
            if (!empty($line['price_quote_only'])) {
                $rows[] = 'Atenção: este produto ainda não tem preço de tabela. É preciso confirmar com o cliente.';
            }
            return $rows;
        }
        $rows[] = 'Produto: ' . $line['product_name'];
        if (!empty($line['artwork_uploads'])) {
            $names = array();
            foreach ($line['artwork_uploads'] as $upload) {
                $names[] = isset($upload['name']) ? $upload['name'] : 'imagem';
            }
            $rows[] = 'Imagem para personalizar: ' . implode(', ', $names) . ' (disponível no painel de encomendas)';
        } else {
            $rows[] = 'Imagem para personalizar: cliente pediu ajuda';
        }
        $rows[] = 'Tipo/tamanho: ' . $line['size_label'];
        $rows[] = 'Quantidade: ' . $line['pack_quantity'] . ' ' . $line['unit_label'];
        $rows[] = 'Preço do produto: ' . $line['price_line'] . ($line['unit_price_line'] !== '' ? ' (' . $line['unit_price_line'] . ')' : '');
        $rows[] = 'Personalização do cartão: ' . ($line['card_description'] !== '' ? $line['card_description'] : 'Sem indicações em texto');
        if (!empty($line['card_reference_uploads'])) {
            $names = array();
            foreach ($line['card_reference_uploads'] as $upload) {
                $names[] = isset($upload['name']) ? $upload['name'] : 'foto';
            }
            $rows[] = 'Referências para o cartão: ' . implode(', ', $names) . ' (disponíveis no painel de encomendas)';
        }
        if (!empty($line['card_audio_uploads'])) {
            $rows[] = 'Áudios sobre o cartão: ' . count($line['card_audio_uploads']) . ' (disponíveis no painel de encomendas)';
        }
        return $rows;
    }

    if (!empty($line['is_quadros'])) {
        $rows[] = 'Produto: ' . $line['product_name'];
        $rows[] = 'Tipo: ' . $line['quadro_type_label'];
        if ($line['quadro_type'] === 'Foto e Frase') {
            $rows[] = 'Orientação da foto: ' . $line['quadro_photo_orientation'];
            if (!empty($line['quadro_uploads'])) {
                $names = array();
                foreach ($line['quadro_uploads'] as $upload) {
                    $names[] = isset($upload['name']) ? $upload['name'] : 'foto';
                }
                $rows[] = 'Foto recebida: ' . implode(', ', $names) . ' (disponível no painel de encomendas)';
            } else {
                $rows[] = 'Foto: o cliente pediu ajuda para a enviar';
            }
        }
        if ($line['quadro_type'] === 'Silhueta e Frase') {
            $rows[] = 'Silhueta: ' . $line['quadro_silhouette'];
        }
        if ($line['quadro_type'] === 'Quadro para bebé') {
            $rows[] = 'Animal: ' . $line['quadro_baby_animal'];
            $rows[] = 'Menino ou menina: ' . $line['quadro_baby_gender'];
            if ($line['quadro_baby_name'] !== '') $rows[] = 'Nome da criança: ' . $line['quadro_baby_name'];
            if ($line['quadro_baby_birth_date'] !== '') $rows[] = 'Data de nascimento: ' . $line['quadro_baby_birth_date'];
            if ($line['quadro_baby_birth_time'] !== '') $rows[] = 'Hora de nascimento: ' . $line['quadro_baby_birth_time'];
            if ($line['quadro_baby_birth_weight'] !== '') $rows[] = 'Peso à nascença: ' . $line['quadro_baby_birth_weight'];
        }
        if (!empty($line['quadro_heart_finish'])) {
            $rows[] = 'Acabamento do coração: ' . $line['quadro_heart_finish'];
        }
        if (!empty($line['quadro_palette_label'])) {
            $rows[] = 'Combinação de cores: ' . $line['quadro_palette_label'];
        }
        // As cores vão sempre, mesmo quando há uma combinação com nome: o nome
        // da sugestão não diz quais são as cores nem em que tom ficaram.
        if (!empty($line['quadro_mia_colors'])) {
            $rows[] = 'Cores: a Mia escolhe';
        } elseif (($line['quadro_type'] === 'Coração e Frase' || $line['quadro_type'] === 'O Amor Nunca Acaba') && count($line['quadro_colors']) === 2) {
            $rows[] = 'Cor inicial do degradê: ' . $line['quadro_colors'][0];
            $rows[] = 'Cor final do degradê: ' . $line['quadro_colors'][1];
        } elseif (!empty($line['quadro_colors'])) {
            $rows[] = 'Cores escolhidas: ' . implode(', ', $line['quadro_colors']);
        }
        if (!empty($line['quadro_background_palette_label'])) {
            $rows[] = 'Combinação do fundo: ' . $line['quadro_background_palette_label'];
        }
        if (!empty($line['quadro_background_mia'])) {
            $rows[] = 'Cor do fundo: a Mia escolhe';
        } elseif (!empty($line['quadro_background_colors'])) {
            $rows[] = 'Cor do fundo: ' . implode(', ', $line['quadro_background_colors']);
        }
        if ($line['quadro_type'] === 'Super Personalizado') {
            if (!empty($line['quadro_super_example'])) {
                $rows[] = 'Sugestão escolhida: ' . $line['quadro_super_example'];
            }
            if ($line['quadro_description'] !== '') {
                $rows[] = 'Descrição: ' . $line['quadro_description'];
            }
        } elseif ($line['quadro_type'] === 'O Amor Nunca Acaba') {
            $rows[] = !empty($line['quadro_no_dedication'])
                ? 'Dedicatória: sem dedicatória'
                : 'Dedicatória: ' . ($line['quadro_dedication'] !== '' ? $line['quadro_dedication'] : 'Em branco');
        } elseif ($line['quadro_type'] === 'Silhueta e Frase') {
            if (!empty($line['quadro_no_text'])) {
                $rows[] = 'Texto em vinil: sem texto';
            } elseif ($line['quadro_text'] !== '') {
                $rows[] = 'Texto em vinil: ' . $line['quadro_text'];
            }
        } elseif ($line['quadro_type'] !== 'Quadro para bebé') {
            if (!empty($line['quadro_no_phrase'])) {
                $rows[] = 'Frase em Vinil: Sem frase';
            } elseif ($line['quadro_text'] !== '') {
                $rows[] = 'Frase em Vinil: ' . $line['quadro_text'];
            }
        }
        if ($line['quadro_frame_size'] !== '') {
            $rows[] = 'Tamanho da moldura: ' . $line['quadro_frame_size'];
        }
        if ($line['quadro_packaging_label'] !== '') {
            $rows[] = 'Proteção e embrulho: ' . $line['quadro_packaging_label'] . ' (' . $line['quadro_packaging_extra_line'] . ')';
        }
        if (!empty($line['quadro_reference_uploads'])) {
            $names = array();
            foreach ($line['quadro_reference_uploads'] as $upload) {
                $names[] = isset($upload['name']) ? $upload['name'] : 'foto';
            }
            $rows[] = 'Fotos de referência: ' . implode(', ', $names) . ' (disponíveis no painel de encomendas)';
        }
        if (!empty($line['quadro_silhouette_uploads'])) {
            $names = array();
            foreach ($line['quadro_silhouette_uploads'] as $upload) {
                $names[] = isset($upload['name']) ? $upload['name'] : 'silhueta';
            }
            $rows[] = 'Silhueta enviada: ' . implode(', ', $names) . ' (disponível no painel de encomendas)';
        }
        if (!empty($line['quadro_silhouette_description'])) {
            $rows[] = 'Descrição da silhueta: ' . $line['quadro_silhouette_description'];
        }
        if (!empty($line['quadro_silhouette_contact_me'])) {
            $rows[] = 'Silhueta: prefere que entrem em contacto para explicar';
        }
        if (!empty($line['quadro_silhouette_audio_uploads'])) {
            $rows[] = 'Áudios sobre a silhueta: ' . count($line['quadro_silhouette_audio_uploads']) . ' (disponíveis no painel de encomendas)';
        }
        if (!empty($line['quadro_audio_uploads'])) {
            $rows[] = 'Áudios recebidos: ' . count($line['quadro_audio_uploads']) . ' (disponíveis no painel de encomendas)';
        }
        $rows[] = 'Preço do produto: ' . $line['price_line'];
        return $rows;
    }

    if (!empty($line['is_cadernos'])) {
        $rows[] = 'Produto: ' . $line['product_name'];
        if (!empty($line['is_congress_2026'])) {
            $rows[] = 'Coleção: Congresso 2026';
        }
        $rows[] = 'Capa escolhida: ' . $line['cover_line_owner'];
        $rows[] = 'Acabamento da Capa: ' . $line['lamination_label'];
        if (!empty($line['add_on_labels'])) {
            $rows[] = 'Extras: ' . implode(', ', $line['add_on_labels']);
            $rows[] = 'Acréscimo dos add-ons: ' . $line['add_ons_extra_line'];
        }
        $rows[] = 'Opção escolhida: ' . $line['purchase_option_label'];
        $rows[] = 'Quantidade: ' . $line['caderno_order_quantity'] . ' x ' . $line['purchase_option_label'];
        $rows[] = 'Preço base: ' . $line['base_price_line'];
        $rows[] = 'Inclui: ' . $line['purchase_includes'];
        if ($line['cover_personalization'] !== '') {
            $rows[] = 'Personalização da capa: ' . $line['cover_personalization_line'];
        }
        if ($line['cover_personalization'] === 'yes') {
            $rows[] = 'Nome/frase: ' . $line['cover_personalization_text'];
            $rows[] = 'Acréscimo: ' . $line['personalization_extra_line'];
        }
        $rows[] = 'Preço do produto: ' . $line['price_line'];
        if (!empty($line['purchase_is_pack']) && $line['pack_promo_note'] !== '') {
            $rows[] = 'Nota do Pack: ' . $line['pack_promo_note'];
        }
        return $rows;
    }

    $rows[] = 'Produto: ' . $line['product_name'];
    if (!empty($line['is_main_v2'])) {
        $rows[] = 'Contexto: catálogo principal (main-v2) — design do catálogo';
    } elseif (!empty($line['is_congress_2026'])) {
        $rows[] = 'Contexto: Congresso 2026';
    }
    $rows[] = (!empty($line['is_main_v2']) ? 'Quantidade: ' : 'Pack: ') . $line['pack_quantity'] . ' ' . $line['unit_label'];
    $rows[] = 'Tamanho: ' . $line['size'];
    if (!empty($line['option_drawer_labels'])) {
        $rows[] = 'Opções extra: ' . implode(' · ', $line['option_drawer_labels']);
    }
    if ($line['option_drawer_extra_line'] !== '') {
        $rows[] = 'Acréscimo das opções: ' . $line['option_drawer_extra_line'];
    }
    if (!empty($line['cover_personalization_summary_lines'])) {
        foreach ($line['cover_personalization_summary_lines'] as $persSummaryLine) {
            $rows[] = $persSummaryLine;
        }
        if (!empty($line['personalization_extra_line'])) {
            $rows[] = 'Acréscimo da personalização: ' . $line['personalization_extra_line'];
        }
    }
    $rows[] = 'Preço do produto: ' . $line['price_line'] . ($line['unit_price_line'] !== '' ? ' (' . $line['unit_price_line'] . ')' : '');
    $rows[] = '';
    $rows[] = 'Designs e quantidades:';
    $rows[] = '- ' . implode("\n- ", $line['design_lines_owner']);
    $hasAnyCardData = ($line['recipient_name'] !== '' || $line['card_contact'] !== '' || $line['congregation'] !== '' || !empty($line['congregation_gift']));
    if (!empty($line['has_card_details_step']) || $hasAnyCardData) {
        $rows[] = '';
        $rows[] = 'Dados para cartão de apresentação:';
        $rows[] = 'Nome: ' . ($line['recipient_name'] !== '' ? $line['recipient_name'] : 'Não indicado');
        $rows[] = 'Telemóvel ou Email: ' . ($line['card_contact'] !== '' ? $line['card_contact'] : 'Não indicado');
        $rows[] = 'Congregação: ' . ($line['congregation'] !== '' ? $line['congregation'] : 'Não indicado');
        if (!empty($line['show_congregation_gift_line'])) {
            $rows[] = 'Oferta à congregação: ' . ($line['congregation_gift'] ? 'Sim - pediu ajuda para escolher designs únicos para a congregação.' : 'Não');
        }
    }

    return $rows;
}

function cart_item_customer_lines($line)
{
    $rows = array();

    if (!empty($line['is_custom_artwork'])) {
        if (!empty($line['is_main_v2'])) {
            $rows[] = 'Produto: ' . $line['product_name'];
            $rows[] = 'Escolha: ficheiros personalizados';
            if (!empty($line['purchase_option_label'])) {
                $rows[] = 'Opção: ' . $line['purchase_option_label'];
            } elseif (!empty($line['size_label'])) {
                $rows[] = 'Tipo/tamanho: ' . $line['size_label'];
            }
            foreach ($line['artwork_uploads'] as $index => $upload) {
                $uploadName = isset($upload['name']) ? $upload['name'] : 'ficheiro';
                $uploadQuantity = isset($upload['quantity']) ? (int)$upload['quantity'] : 0;
                $rows[] = 'Ficheiro ' . ($index + 1) . ': ' . $uploadName . ' — ' . $uploadQuantity . ' ' . $line['unit_label'] . ' — +' . format_euros($line['customization_fee_per_file_cents']) . ' (preparação da imagem e testes)';
            }
            if (!empty($line['variant_labels'])) {
                $rows[] = 'Opções: ' . implode(' · ', $line['variant_labels']);
            }
            if (!empty($line['finish_labels'])) {
                $rows[] = 'Acabamento: ' . implode(' · ', $line['finish_labels'])
                    . ($line['finish_extra_line'] !== '' ? ' — ' . $line['finish_extra_line'] : '');
            }
            $rows[] = 'Quantidade total: ' . $line['product_quantity'] . ' ' . $line['unit_label'];
            $rows[] = 'Produtos sem taxa: ' . format_euros($line['product_subtotal_cents']);
            $rows[] = 'Taxas de personalização: ' . $line['customization_fee_line'];
            $rows[] = 'Preço total do produto: ' . $line['price_line'];
            if (!empty($line['price_quote_only'])) {
                $rows[] = 'Este produto ainda não tem preço de tabela — a Mia confirma-o contigo antes de avançar.';
            }
            return $rows;
        }
        $rows[] = 'Produto: ' . $line['product_name'];
        $rows[] = !empty($line['artwork_uploads'])
            ? 'Imagem para personalizar: recebida com o pedido'
            : 'Imagem para personalizar: pediste ajuda';
        $rows[] = 'Tipo/tamanho: ' . $line['size_label'];
        $rows[] = 'Quantidade: ' . $line['pack_quantity'] . ' ' . $line['unit_label'];
        $rows[] = 'Preço do produto: ' . $line['price_line'] . ($line['unit_price_line'] !== '' ? ', ou seja: ' . $line['unit_price_line'] : '');
        $rows[] = 'Personalização do cartão: ' . ($line['card_description'] !== '' ? $line['card_description'] : 'Sem indicações em texto');
        if (!empty($line['card_reference_uploads'])) {
            $rows[] = 'Referências para o cartão: ' . count($line['card_reference_uploads']) . ' recebida(s)';
        }
        if (!empty($line['card_audio_uploads'])) {
            $rows[] = 'Áudios sobre o cartão: ' . count($line['card_audio_uploads']) . ' recebido(s)';
        }
        return $rows;
    }

    if (!empty($line['is_quadros'])) {
        $rows[] = 'Produto: ' . $line['product_name'];
        $rows[] = 'Tipo: ' . $line['quadro_type_label'];
        if ($line['quadro_type'] === 'Foto e Frase') {
            $rows[] = 'Orientação da foto: ' . $line['quadro_photo_orientation'];
            $rows[] = !empty($line['quadro_uploads'])
                ? 'Foto: recebida com o pedido'
                : 'Foto: pediste ajuda para a enviar';
        }
        if ($line['quadro_type'] === 'Silhueta e Frase') {
            $rows[] = 'Silhueta: ' . $line['quadro_silhouette'];
        }
        if ($line['quadro_type'] === 'Quadro para bebé') {
            $rows[] = 'Animal: ' . $line['quadro_baby_animal'];
            $rows[] = 'Menino ou menina: ' . $line['quadro_baby_gender'];
            if ($line['quadro_baby_name'] !== '') $rows[] = 'Nome da criança: ' . $line['quadro_baby_name'];
            if ($line['quadro_baby_birth_date'] !== '') $rows[] = 'Data de nascimento: ' . $line['quadro_baby_birth_date'];
            if ($line['quadro_baby_birth_time'] !== '') $rows[] = 'Hora de nascimento: ' . $line['quadro_baby_birth_time'];
            if ($line['quadro_baby_birth_weight'] !== '') $rows[] = 'Peso à nascença: ' . $line['quadro_baby_birth_weight'];
        }
        if (!empty($line['quadro_heart_finish'])) {
            $rows[] = 'Acabamento do coração: ' . $line['quadro_heart_finish'];
        }
        if (!empty($line['quadro_palette_label'])) {
            $rows[] = 'Combinação de cores: ' . $line['quadro_palette_label'];
        }
        // As cores vão sempre, mesmo quando há uma combinação com nome: o nome
        // da sugestão não diz quais são as cores nem em que tom ficaram.
        if (!empty($line['quadro_mia_colors'])) {
            $rows[] = 'Cores: a Mia escolhe';
        } elseif (($line['quadro_type'] === 'Coração e Frase' || $line['quadro_type'] === 'O Amor Nunca Acaba') && count($line['quadro_colors']) === 2) {
            $rows[] = 'Cor inicial do degradê: ' . $line['quadro_colors'][0];
            $rows[] = 'Cor final do degradê: ' . $line['quadro_colors'][1];
        } elseif (!empty($line['quadro_colors'])) {
            $rows[] = 'Cores escolhidas: ' . implode(', ', $line['quadro_colors']);
        }
        if (!empty($line['quadro_background_palette_label'])) {
            $rows[] = 'Combinação do fundo: ' . $line['quadro_background_palette_label'];
        }
        if (!empty($line['quadro_background_mia'])) {
            $rows[] = 'Cor do fundo: a Mia escolhe';
        } elseif (!empty($line['quadro_background_colors'])) {
            $rows[] = 'Cor do fundo: ' . implode(', ', $line['quadro_background_colors']);
        }
        if ($line['quadro_type'] === 'Super Personalizado') {
            if (!empty($line['quadro_super_example'])) {
                $rows[] = 'Sugestão escolhida: ' . $line['quadro_super_example'];
            }
            if ($line['quadro_description'] !== '') {
                $rows[] = 'Descrição: ' . $line['quadro_description'];
            }
        } elseif ($line['quadro_type'] === 'O Amor Nunca Acaba') {
            $rows[] = !empty($line['quadro_no_dedication'])
                ? 'Dedicatória: sem dedicatória'
                : 'Dedicatória: ' . ($line['quadro_dedication'] !== '' ? $line['quadro_dedication'] : 'Em branco');
        } elseif ($line['quadro_type'] === 'Silhueta e Frase') {
            if (!empty($line['quadro_no_text'])) {
                $rows[] = 'Texto em vinil: sem texto';
            } elseif ($line['quadro_text'] !== '') {
                $rows[] = 'Texto em vinil: ' . $line['quadro_text'];
            }
        } elseif ($line['quadro_type'] !== 'Quadro para bebé') {
            if (!empty($line['quadro_no_phrase'])) {
                $rows[] = 'Frase em Vinil: Sem frase';
            } elseif ($line['quadro_text'] !== '') {
                $rows[] = 'Frase em Vinil: ' . $line['quadro_text'];
            }
        }
        if ($line['quadro_frame_size'] !== '') {
            $rows[] = 'Tamanho da moldura: ' . $line['quadro_frame_size'];
        }
        if ($line['quadro_packaging_label'] !== '') {
            $rows[] = 'Proteção e embrulho: ' . $line['quadro_packaging_label'] . ' (' . $line['quadro_packaging_extra_line'] . ')';
        }
        if (!empty($line['quadro_reference_uploads'])) {
            $rows[] = 'Fotos de referência: ' . count($line['quadro_reference_uploads']) . ' recebida(s)';
        }
        if (!empty($line['quadro_silhouette_uploads'])) {
            $rows[] = 'Silhueta: recebida com o pedido';
        }
        if (!empty($line['quadro_silhouette_description'])) {
            $rows[] = 'Descrição da silhueta: ' . $line['quadro_silhouette_description'];
        }
        if (!empty($line['quadro_silhouette_contact_me'])) {
            $rows[] = 'Silhueta: pediste que entremos em contacto para explicares';
        }
        if (!empty($line['quadro_silhouette_audio_uploads'])) {
            $rows[] = 'Áudios sobre a silhueta: ' . count($line['quadro_silhouette_audio_uploads']) . ' recebido(s)';
        }
        if (!empty($line['quadro_audio_uploads'])) {
            $rows[] = 'Áudios: ' . count($line['quadro_audio_uploads']) . ' recebido(s)';
        }
        $rows[] = 'Preço do produto: ' . $line['price_line'];
        return $rows;
    }

    if (!empty($line['is_cadernos'])) {
        $rows[] = 'Produto: ' . $line['product_name'];
        if (!empty($line['is_main_v2'])) {
            $rows[] = 'Contexto: catálogo principal (main-v2) — design do catálogo';
        } elseif (!empty($line['is_congress_2026'])) {
            $rows[] = 'Contexto: Congresso 2026';
        }
        $rows[] = 'Capa escolhida: ' . $line['cover_line_customer'];
        $rows[] = 'Acabamento da Capa: ' . $line['lamination_label'];
        if (!empty($line['add_on_labels'])) {
            $rows[] = 'Extras: ' . implode(', ', $line['add_on_labels']);
            $rows[] = 'Acréscimo dos add-ons: ' . $line['add_ons_extra_line'];
        }
        $rows[] = 'Opção escolhida: ' . $line['purchase_option_label'];
        $rows[] = 'Quantidade: ' . $line['caderno_order_quantity'] . ' x ' . $line['purchase_option_label'];
        $rows[] = 'Preço base: ' . $line['base_price_line'];
        $rows[] = 'Inclui: ' . $line['purchase_includes'];
        if ($line['cover_personalization'] !== '') {
            $rows[] = 'Personalização da capa: ' . $line['cover_personalization_line'];
        }
        if ($line['cover_personalization'] === 'yes') {
            $rows[] = 'Nome/frase: ' . $line['cover_personalization_text'];
            $rows[] = 'Acréscimo: ' . $line['personalization_extra_line'];
        }
        $rows[] = 'Preço do produto: ' . $line['price_line'];
        if (!empty($line['purchase_is_pack']) && $line['pack_promo_note'] !== '') {
            $rows[] = 'Nota do Pack: ' . $line['pack_promo_note'];
        }
        return $rows;
    }

    $rows[] = 'Produto: ' . $line['product_name'];
    if (!empty($line['is_congress_2026'])) {
        $rows[] = 'Coleção: Congresso 2026';
    }
    $rows[] = (!empty($line['is_main_v2']) ? 'Quantidade: ' : 'Pack: ') . $line['pack_quantity'] . ' ' . $line['unit_label'];
    $rows[] = 'Tamanho: ' . $line['size'];
    if (!empty($line['option_drawer_labels'])) {
        $rows[] = 'Opções extra: ' . implode(' · ', $line['option_drawer_labels']);
    }
    if ($line['option_drawer_extra_line'] !== '') {
        $rows[] = 'Acréscimo das opções: ' . $line['option_drawer_extra_line'];
    }
    if (!empty($line['cover_personalization_summary_lines'])) {
        foreach ($line['cover_personalization_summary_lines'] as $persSummaryLine) {
            $rows[] = $persSummaryLine;
        }
        if (!empty($line['personalization_extra_line'])) {
            $rows[] = 'Acréscimo da personalização: ' . $line['personalization_extra_line'];
        }
    }
    $rows[] = 'Preço do produto: ' . $line['price_line'] . (($line['pack_quantity'] > 1 && $line['unit_price_line'] !== '') ? ', ou seja: ' . $line['unit_price_line'] : '');
    $rows[] = '';
    $rows[] = 'Designs escolhidos:';
    $rows[] = '- ' . implode("\n- ", $line['design_lines_customer']);

    $hasAnyCardData = ($line['recipient_name'] !== '' || $line['card_contact'] !== '' || $line['congregation'] !== '' || !empty($line['congregation_gift']));
    if (!empty($line['has_card_details_step']) && ($hasAnyCardData || !empty($line['is_congress_2026']))) {
        $rows[] = '';
        $rows[] = 'Dados para o teu Cartão de Apresentação:';
        $rows[] = 'Nome: ' . ($line['recipient_name'] !== '' ? $line['recipient_name'] : 'Não indicado');
        $rows[] = 'Telemóvel ou Email: ' . ($line['card_contact'] !== '' ? $line['card_contact'] : 'Não indicado');
        $rows[] = 'Congregação: ' . ($line['congregation'] !== '' ? $line['congregation'] : 'Não indicado');
        if (!empty($line['show_congregation_gift_line'])) {
            $rows[] = 'Pedi ajuda para não escolher designs repetidos: ' . ($line['congregation_gift'] ? 'Sim' : 'Não');
        }
    }

    return $rows;
}

function customer_email_footer_lines()
{
    return array(
        '',
        'Precisas de fazer alguma alteração à tua encomenda ou tens alguma dúvida?',
        'Este email é enviado automaticamente e as respostas não são recebidas.',
        'Se precisares de alterar alguma coisa ou esclarecer uma dúvida, fala com a Mia:',
        'https://miaandpaper.com/contacto.html',
        '',
        'Mia & Paper',
    );
}

function set_status($code)
{
    if (function_exists('http_response_code')) {
        http_response_code($code);
        return;
    }

    if ($code === 400) {
        header('HTTP/1.1 400 Bad Request');
    }
}

function render_hidden_post_fields($name, $value, $skip)
{
    if (in_array($name, $skip, true)) {
        return;
    }

    if (is_array($value)) {
        foreach ($value as $item) {
            render_hidden_post_fields($name . '[]', $item, $skip);
        }
        return;
    }

    echo '<input type="hidden" name="' . h($name) . '" value="' . h($value) . '">' . "\n";
}

function render_retry_email_form()
{
    $sendCopy = isset($_POST['send_copy']) && (string)$_POST['send_copy'] === '1';
    $copyEmail = isset($_POST['copy_email']) ? (string)$_POST['copy_email'] : '';

    if (!$sendCopy || filter_var($copyEmail, FILTER_VALIDATE_EMAIL)) {
        return;
    }
    ?>
      <form class="result-retry-form" action="send-order.php" method="post">
        <?php foreach ($_POST as $name => $value) : ?>
          <?php render_hidden_post_fields((string)$name, $value, array('copy_email', 'website')); ?>
        <?php endforeach; ?>
        <label>
          <span>Email onde queres receber a cópia</span>
          <input type="email" name="copy_email" value="<?php echo h($copyEmail); ?>" autocomplete="email" required>
        </label>
        <button class="button primary" type="submit">Tentar enviar novamente</button>
      </form>
    <?php
}

function post_success_copy_token()
{
    try {
        return bin2hex(random_bytes(16));
    } catch (Exception $e) {
        return sha1(uniqid('', true) . mt_rand());
    }
}

function safe_hash_equals($expected, $actual)
{
    if (function_exists('hash_equals')) {
        return hash_equals((string)$expected, (string)$actual);
    }
    return (string)$expected === (string)$actual;
}

function mp_find_order_by_code($orderCode)
{
    $pdo = mp_db();
    $stmt = $pdo->prepare('SELECT id, order_code, raw_order_json FROM orders WHERE order_code = ? LIMIT 1');
    $stmt->execute(array($orderCode));
    $row = $stmt->fetch();
    return $row ? $row : null;
}

function mp_order_copy_already_sent($orderId)
{
    $pdo = mp_db();
    $stmt = $pdo->prepare("SELECT 1 FROM email_log WHERE order_id = ? AND email_type IN ('order_copy_customer', 'order_copy_customer_post_success') AND success = 1 LIMIT 1");
    $stmt->execute(array((int)$orderId));
    return (bool)$stmt->fetchColumn();
}

function process_post_success_copy($from)
{
    $orderCode = clean_header(field('order_code'));
    $token = field('copy_token');
    $copyEmail = clean_header(field('copy_email'));
    $row = null;
    $snapshot = null;
    $expectedHash = '';
    $actualHash = '';
    $subject = '';
    $body = '';

    if (!preg_match('/^MP-[0-9]{6}[0-9]+$/', $orderCode)) {
        render_page('Não foi possível enviar a cópia.', 'A referência do pedido não é válida.', 'error', array());
    }

    if (!filter_var($copyEmail, FILTER_VALIDATE_EMAIL)) {
        render_page('Confirma o email.', 'Indica um email válido para receber a cópia do pedido.', 'error', array('Volta à página anterior e confirma o endereço.'));
    }

    try {
        $row = mp_find_order_by_code($orderCode);
    } catch (Exception $e) {
        @error_log('[miaandpaper] post_success_copy lookup falhou: ' . $e->getMessage());
        render_page('Não foi possível enviar a cópia.', 'Houve um problema ao validar o pedido. Tenta novamente daqui a uns minutos.', 'error', array());
    }

    if (!$row) {
        render_page('Não foi possível enviar a cópia.', 'Não encontrei este pedido.', 'error', array());
    }

    $snapshot = json_decode((string)$row['raw_order_json'], true);
    if (!is_array($snapshot) || empty($snapshot['post_success_copy_available'])) {
        render_page('A cópia já não está disponível.', 'Este pedido já tinha a cópia desativada ou enviada no momento da submissão.', 'error', array());
    }

    $expectedHash = isset($snapshot['post_success_copy_token_hash']) ? (string)$snapshot['post_success_copy_token_hash'] : '';
    $actualHash = hash('sha256', (string)$token);
    if ($expectedHash === '' || !safe_hash_equals($expectedHash, $actualHash)) {
        render_page('Não foi possível enviar a cópia.', 'A validação de segurança deste pedido falhou.', 'error', array());
    }

    if (mp_order_copy_already_sent((int)$row['id'])) {
        render_page('A cópia já foi enviada.', 'Já foi enviada uma cópia deste pedido por email.', 'success', array(), $orderCode, '', false, 'copy');
    }

    $subject = isset($snapshot['customer_copy_subject']) ? clean_header($snapshot['customer_copy_subject']) : '';
    $body = isset($snapshot['customer_copy_body']) ? (string)$snapshot['customer_copy_body'] : '';

    if ($subject === '' || $body === '') {
        render_page('Não foi possível enviar a cópia.', 'Este pedido não tem resumo de email disponível para reenviar.', 'error', array());
    }

    $headers = array(
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: "Mia & Paper" <' . $from . '>',
        'Reply-To: "Mia & Paper" <' . $from . '>',
        'X-Mailer: PHP/' . phpversion(),
    );

    $sent = mail($copyEmail, $subject, $body, implode("\r\n", $headers), '-f' . $from);
    mp_db_log_email(array(
        'order_id' => (int)$row['id'],
        'email_type' => 'order_copy_customer_post_success',
        'recipient' => $copyEmail,
        'subject' => $subject,
        'success' => $sent ? 1 : 0,
        'error_message' => $sent ? null : 'mail() devolveu false',
    ));

    if (!$sent) {
        render_page('Não foi possível enviar a cópia.', 'O pedido está guardado, mas houve um problema ao enviar a cópia por email.', 'error', array('Código da encomenda: ' . $orderCode));
    }

    render_page('Cópia enviada.', 'Enviámos uma cópia do pedido para ' . $copyEmail . '.', 'success', array(), $orderCode, '', false, 'copy');
}

function load_home_config()
{
    $path = __DIR__ . '/content/order-products.json';

    if (!is_file($path)) {
        return array();
    }

    $data = json_decode(file_get_contents($path), true);

    return is_array($data) ? $data : array();
}

// RESULT_CATEGORIES_CAROUSEL_V1: a página após envio usa os mesmos
// carrosséis dos cartões de produtos. O order-products.json não guarda
// carouselImages; o frontend carrega-as a partir do primeiro passo de cada
// produto. Aqui fazemos o mesmo em PHP para que a página de sucesso não
// volte aos cartões antigos.
function result_slug_from_href($href)
{
    $clean = preg_split('/[?#]/', (string)$href);
    $clean = isset($clean[0]) ? $clean[0] : '';

    if (preg_match('/([^\/]+)\.html$/i', $clean, $matches)) {
        $slug = strtolower($matches[1]);
        $mainAliases = array(
            'crachas' => 'crachas-loja',
            'imanes' => 'imanes-loja',
            'cadernos' => 'cadernos-anuais',
            'caderninhos' => 'mini-cadernos',
        );
        return isset($mainAliases[$slug]) ? $mainAliases[$slug] : $slug;
    }

    return '';
}

function result_home_carousel_images_from_product($product)
{
    $images = array();
    $step = (!empty($product['steps'][0]) && is_array($product['steps'][0])) ? $product['steps'][0] : array();
    $items = (!empty($step['items']) && is_array($step['items'])) ? $step['items'] : array();
    $onlyPrimaryImages = !empty($product['slug']) && (string)$product['slug'] === 'cadernos';

    foreach ($items as $item) {
        if (!empty($item['image']) && !in_array((string)$item['image'], $images, true)) {
            $images[] = (string)$item['image'];
        }
        if (!$onlyPrimaryImages && !empty($item['interiorImages']) && is_array($item['interiorImages'])) {
            foreach ($item['interiorImages'] as $image) {
                if (!empty($image) && !in_array((string)$image, $images, true)) {
                    $images[] = (string)$image;
                }
            }
        }
    }

    return array_slice($images, 0, 12);
}

function result_clamp_number($value, $fallback, $min, $max)
{
    if (!is_numeric($value)) {
        $value = $fallback;
    }

    $number = (float)$value;
    if ($number < $min) {
        return $min;
    }
    if ($number > $max) {
        return $max;
    }

    return $number;
}

function result_effective_carousel_value($category, $key, $fallback, $min, $max)
{
    $value = (is_array($category) && array_key_exists($key, $category)) ? $category[$key] : $fallback;
    return result_clamp_number($value, $fallback, $min, $max);
}

function result_render_category_carousel($images, $pan)
{
    if (empty($images)) {
        return '';
    }

    $html = '<span class="category-carousel" data-home-carousel aria-hidden="true">';
    foreach (array_values($images) as $index => $image) {
        $direction = $index % 4;
        $panX = ($direction === 0 || $direction === 3) ? $pan : -$pan;
        $panY = ($direction < 2) ? -$pan : $pan;
        $html .= '<span class="category-carousel-frame' . ($index === 0 ? ' is-active' : '') . '" style="background-image:url(&quot;' . h($image) . '&quot;);--carousel-pan-x:' . h($panX) . '%;--carousel-pan-y:' . h($panY) . '%"></span>';
    }
    $html .= '</span>';

    return $html;
}

function render_result_categories()
{
    $home = load_home_config();
    $categories = !empty($home['categories']) && is_array($home['categories']) ? $home['categories'] : array();
    $categories = array_values(array_filter($categories, 'home_category_is_visible'));
    $gridCount = max(1, min(5, count($categories)));
    $index = 0;
    $carousel = (!empty($home['carousel']) && is_array($home['carousel'])) ? $home['carousel'] : array();
    $carouselEnabled = !array_key_exists('enabled', $carousel) || $carousel['enabled'] !== false;
    $showNumbers = !empty($home['showCategoryNumbers']);

    if (empty($categories)) {
        return;
    }
    ?>
      <nav class="category-grid result-categories category-grid-count-<?php echo h($gridCount); ?>" aria-label="Fazer outro pedido">
        <?php foreach ($categories as $category) : ?>
          <?php
            $index += 1;
            $accent = isset($category['accent']) ? (string)$category['accent'] : 'gold';
            $title = isset($category['title']) ? (string)$category['title'] : 'Pedido';
            $subtitle = isset($category['subtitle']) ? (string)$category['subtitle'] : '';
            $href = isset($category['href']) ? (string)$category['href'] : 'index.html';
            $isClickable = !array_key_exists('clickable', $category) || $category['clickable'] !== false;
            $unavailableMessage = (!$isClickable && isset($category['unavailableMessage'])) ? (string)$category['unavailableMessage'] : '';
            $disabledClass = !$isClickable ? ' is-link-disabled' : '';
            $messageClass = $unavailableMessage !== '' ? ' has-unavailable-message' : '';
            $tag = $isClickable ? 'a' : 'span';
            $linkAttributes = $isClickable
                ? ' href="' . h($href) . '"'
                : ' aria-disabled="true"' . ($unavailableMessage !== '' ? ' role="button" tabindex="0" data-home-unavailable-message="' . h($unavailableMessage) . '"' : '');
            $image = isset($category['image']) ? (string)$category['image'] : '';
            $categoryCarouselEnabled = !array_key_exists('carouselEnabled', $category) || $category['carouselEnabled'] !== false;
            $slug = result_slug_from_href($href);
            $carouselImages = ($carouselEnabled && $categoryCarouselEnabled && $slug !== '')
                ? result_home_carousel_images_from_product(load_product_config($slug))
                : array();
            if (!empty($carouselImages) && (!array_key_exists('carouselRandomizeOnLoad', $category) || $category['carouselRandomizeOnLoad'] !== false)) {
                shuffle($carouselImages);
            }
            $hasCarousel = !empty($carouselImages);
            $hasStaticImage = $image !== '' && !$hasCarousel;
            $imageClass = $hasCarousel ? ' has-carousel' : ($hasStaticImage ? ' has-image' : '');
            $globalSpeed = result_clamp_number(isset($carousel['speedSeconds']) ? $carousel['speedSeconds'] : null, 8, 3, 30);
            $globalZoom = result_clamp_number(isset($carousel['zoomPercent']) ? $carousel['zoomPercent'] : null, 108, 100, 140);
            $globalOverlay = result_clamp_number(isset($carousel['overlayOpacity']) ? $carousel['overlayOpacity'] : null, 36, 0, 80);
            $globalPan = result_clamp_number(isset($carousel['panPercent']) ? $carousel['panPercent'] : null, 6, 0, 18);
            $effSpeed = result_effective_carousel_value($category, 'carouselSpeedSeconds', $globalSpeed, 3, 30);
            $effZoom = result_effective_carousel_value($category, 'carouselZoomPercent', $globalZoom, 100, 140);
            $effOverlay = result_effective_carousel_value($category, 'carouselOverlayOpacity', $globalOverlay, 0, 80);
            $effPan = result_effective_carousel_value($category, 'carouselPanPercent', $globalPan, 0, 18);
            $imageStyle = $hasCarousel
                ? ' style="--carousel-speed:' . h($effSpeed) . 's;--carousel-zoom-scale:' . h(number_format($effZoom / 100, 3, '.', '')) . ';--carousel-overlay:' . h(number_format($effOverlay / 100, 2, '.', '')) . ';--carousel-pan:' . h($effPan) . '%"'
                : ($hasStaticImage ? ' style="--category-image:url(&quot;' . h($image) . '&quot;)"' : '');
            $numberHtml = $showNumbers
                ? '<span class="category-number">' . h(str_pad((string)$index, 2, '0', STR_PAD_LEFT)) . '</span>'
                : '<span class="category-number is-placeholder" aria-hidden="true">00</span>';
          ?>
          <<?php echo $tag; ?> class="category-card <?php echo h($accent . $imageClass . $disabledClass . $messageClass); ?>"<?php echo $linkAttributes; ?><?php echo $imageStyle; ?> aria-label="<?php echo h($title); ?>">
            <?php echo $hasCarousel ? result_render_category_carousel($carouselImages, $effPan) : ''; ?>
            <?php echo $numberHtml; ?>
            <span class="category-art" aria-hidden="true"></span>
            <strong><?php echo h($title); ?></strong>
            <span><?php echo h($subtitle); ?></span>
          </<?php echo $tag; ?>>
        <?php endforeach; ?>
      </nav>
    <?php
}

function render_page($title, $message, $kind, $details, $orderCode = '', $customerName = '', $messageHtml = false, $successMode = '', $postSuccessCopy = null, $paymentDetails = null)
{
    global $returnToPath, $productSlug;

    $isPaymentSuccess = $kind === 'success' && is_array($paymentDetails);

    if (!$returnToPath) {
        $returnToPath = 'index.html';
    }

    set_status($kind === 'success' ? 200 : 400);
    ?>
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?php echo h($title); ?> | Mia &amp; Paper</title>
  <link rel="stylesheet" href="css/01-tokens-agua.css?v=20260906225352">
  <link rel="stylesheet" href="css/02-base-chrome.css?v=20260906225352">
  <link rel="stylesheet" href="css/03-grelha-designs-tons.css?v=20260906225352">
  <link rel="stylesheet" href="css/04-reviews-passos-acoes.css?v=20260906225352">
  <link rel="stylesheet" href="css/05-cookies-packs-entrega.css?v=20260906225352">
  <link rel="stylesheet" href="css/06-admin.css?v=20260906225352">
  <link rel="stylesheet" href="css/07-cards-crachas-molduras.css?v=20260906225352">
  <link rel="stylesheet" href="css/08-dark-mode.css?v=20260906225352">
  <link rel="stylesheet" href="css/09-seccoes-produtos.css?v=20260906225352">
  <link rel="stylesheet" href="css/10-entrega-uniformizacao.css?v=20260906225352">
  <link rel="stylesheet" href="css/11-home-marca.css?v=20260906225352">
  <link rel="stylesheet" href="css/12-composer-glitter-chart.css?v=20260906225352">
  <link rel="stylesheet" href="css/13-miu.css?v=20260906225352">
</head>
<body class="result-body">
  <main class="result-card <?php echo h($kind); ?>">
    <a class="brand" href="index.html" aria-label="Mia & Paper">
      <span class="brand-mark"><img src="content/brand/logo.webp" alt=""></span>
      <span>Mia &amp; Paper</span>
    </a>

    <div>
      <p class="eyebrow"><?php echo $isPaymentSuccess ? 'Pagamento' : ($kind === 'success' ? 'Pedido enviado' : 'Pedido não enviado'); ?></p>
      <h1><?php echo h($title); ?></h1>
      <p class="lead"><?php echo $messageHtml ? $message : h($message); ?></p>
    </div>

    <?php if ($isPaymentSuccess) : ?>
      <section class="payment-success-card" aria-label="Dados para pagamento por MB WAY">
        <?php if (!empty($paymentDetails['items'])) : ?>
          <div class="payment-success-summary">
            <h2>A tua encomenda</h2>
            <ul>
              <?php foreach ($paymentDetails['items'] as $item) : ?>
                <li>
                  <span><?php echo h(isset($item['label']) ? $item['label'] : 'Produto'); ?></span>
                  <strong><?php echo format_euros(isset($item['price_cents']) ? (int)$item['price_cents'] : 0); ?></strong>
                </li>
              <?php endforeach; ?>
              <?php if (!empty($paymentDetails['shipping_cents'])) : ?>
                <li>
                  <span>Portes CTT</span>
                  <strong><?php echo format_euros((int)$paymentDetails['shipping_cents']); ?></strong>
                </li>
              <?php endif; ?>
            </ul>
          </div>
        <?php endif; ?>

        <p>
          Podes pagar já por MB WAY. Enviaremos a confirmação do pagamento para
          <strong><?php echo h($paymentDetails['contact']); ?></strong>; esta confirmação pode demorar até 24 horas.
        </p>

        <div class="payment-success-values">
          <p><span>Total a pagar</span><strong><?php echo format_euros((int)$paymentDetails['total_cents']); ?></strong></p>
          <p><span>Número MB WAY</span><strong><?php echo h($paymentDetails['mbway_number']); ?></strong></p>
        </div>

        <p>
          Se tiveres dificuldade em pagar desta forma, ou se preferires pagar
          pessoalmente em numerário, combina diretamente com a Mia.
        </p>
        <div class="payment-success-actions">
          <a class="button primary" href="contacto.html">Formulário de contacto</a>
          <a class="button secondary" href="<?php echo h($paymentDetails['instagram_url']); ?>" target="_blank" rel="noopener">Mensagem no Instagram</a>
        </div>

        <aside class="payment-success-note">
          <strong>Nota importante</strong>
          <p>Dependendo do peso final da encomenda, o preço dos portes pode sofrer um pequeno ajuste. Se for necessário acertar alguma diferença, a Mia fala contigo primeiro. Na maioria dos casos, o valor apresentado é o valor final.</p>
        </aside>

        <?php if ($orderCode !== '') : ?>
          <p class="order-success-code">
            <span class="order-success-code-label">Código da encomenda:</span>
            <code><?php echo h($orderCode); ?></code>
          </p>
        <?php endif; ?>
      </section>
    <?php endif; ?>

    <?php if ($kind === 'success' && !$isPaymentSuccess && $orderCode !== '') : ?>
      <?php
        // FINAL_MESSAGE_V1: nova mensagem rica após pedido bem sucedido.
        // Inclui nome (se preenchido), código da encomenda gerado em
        // SQLite e dica sobre "Junta as minhas encomendas".
        $cleanName = trim((string)$customerName);
        $greeting = $cleanName !== ''
          ? 'Obrigada pelo teu pedido, ' . h($cleanName) . '!'
          : 'Obrigada pelo teu pedido!';
      ?>
      <section class="order-success-card" aria-label="Detalhes da encomenda enviada">
        <p class="order-success-greeting"><?php echo $greeting; ?></p>
        <p class="order-success-tip">
          Se fizeres mais encomendas antes desta ser enviada, podes escolher
          <strong>“Junta as minhas encomendas”</strong> e enviamos tudo na mesma embalagem.
          Assim não pagas portes novamente.
        </p>
        <p class="order-success-code">
          <span class="order-success-code-label">Código da encomenda:</span>
          <code><?php echo h($orderCode); ?></code>
        </p>
      </section>
    <?php endif; ?>

    <?php if ($kind === 'success' && is_array($postSuccessCopy) && !empty($postSuccessCopy['order_code']) && !empty($postSuccessCopy['copy_token'])) : ?>
      <section class="order-success-card order-copy-card" aria-label="Enviar cópia do pedido por email">
        <p class="order-success-greeting">Queres receber uma cópia deste pedido por email?</p>
        <form class="result-retry-form" action="send-order.php" method="post">
          <input type="hidden" name="order_action" value="send_order_copy">
          <input type="hidden" name="order_code" value="<?php echo h($postSuccessCopy['order_code']); ?>">
          <input type="hidden" name="copy_token" value="<?php echo h($postSuccessCopy['copy_token']); ?>">
          <label class="hidden-field" aria-hidden="true"><span>Website</span><input type="text" name="website" tabindex="-1" autocomplete="off"></label>
          <label>
            <span>Email onde queres receber a cópia</span>
            <input type="email" name="copy_email" value="<?php echo h(isset($postSuccessCopy['email']) ? $postSuccessCopy['email'] : ''); ?>" autocomplete="email" required>
          </label>
          <button class="button primary" type="submit">Enviar cópia do pedido</button>
        </form>
      </section>
    <?php endif; ?>

    <?php if (!empty($details)) : ?>
      <ul class="result-list">
        <?php foreach ($details as $detail) : ?>
          <li><?php echo h($detail); ?></li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>

    <?php if ($kind === 'success') : ?>
      <?php if (!$isPaymentSuccess) : ?>
        <?php render_result_categories(); ?>
        <p class="open-order-hint home-unavailable-message" role="status" aria-live="polite" data-home-unavailable-inline hidden></p>
      <?php endif; ?>
    <?php else : ?>
      <?php render_retry_email_form(); ?>
      <div class="actions">
        <a class="button primary" href="<?php echo h($returnToPath); ?>">Voltar ao pedido</a>
        <a class="button secondary" href="index.html">Voltar à página inicial</a>
      </div>
    <?php endif; ?>
    <footer class="site-footer">
      <a href="privacy.html">Política de Privacidade</a>
      <a href="index.html">Login de Administrador</a>
      <span>© Mia &amp; Paper 2026 Todos os Direitos Reservados</span>
    </footer>
  </main>
  <?php if ($kind === 'success') : ?>
    <script>
      <?php if ($successMode !== 'cart' && $successMode !== 'cart-payment' && $successMode !== 'copy' && $successMode !== 'payment-debug') : ?>
      window.sessionStorage.setItem("miaandpaper-reset-<?php echo h($productSlug ? $productSlug : 'crachas'); ?>", "1");
      <?php endif; ?>
      var unavailableInlineMessage = document.querySelector("[data-home-unavailable-inline]");
      document.querySelectorAll("[data-home-unavailable-message]").forEach(function (card) {
        var showMessage = function () {
          if (unavailableInlineMessage) {
            unavailableInlineMessage.textContent = card.getAttribute("data-home-unavailable-message") || "Já falta pouco!";
            unavailableInlineMessage.hidden = false;
          }
        };
        card.addEventListener("click", function (event) {
          event.preventDefault();
          showMessage();
        });
        card.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            showMessage();
          }
        });
      });
      Array.prototype.slice.call(document.querySelectorAll("[data-home-carousel]")).forEach(function (carousel, carouselIndex, allCarousels) {
        var frames = Array.prototype.slice.call(carousel.querySelectorAll(".category-carousel-frame"));
        var index = 0;
        var speed = 3500;
        var phaseDelay = Math.round((speed / Math.max(1, allCarousels.length)) * carouselIndex + ((carouselIndex * 137) % 420));
        if (frames.length <= 1) {
          return;
        }
        frames.forEach(function (frame, frameIndex) {
          frame.classList.toggle("is-active", frameIndex === 0);
        });
        window.setTimeout(function () {
          frames[index].classList.remove("is-active");
          index = (index + 1) % frames.length;
          frames[index].classList.add("is-active");
          window.setInterval(function () {
            frames[index].classList.remove("is-active");
            index = (index + 1) % frames.length;
            frames[index].classList.add("is-active");
          }, speed);
        }, Math.max(0, Math.min(speed - 250, phaseDelay)));
      });
    </script>
  <?php endif; ?>
  <?php if ($kind === 'success' && ($successMode === 'cart' || $successMode === 'cart-payment')) : ?>
    <script>
      try {
        window.localStorage.removeItem('miaandpaper_cart_v1');
        window.sessionStorage.removeItem('miaandpaper_checkout_session');
      } catch (error) {}
    </script>
  <?php endif; ?>
  <script src="js/24-miu.js?v=20260906225352"></script>
</body>
</html>
    <?php
    exit;
}

function process_cart_order($recipient, $from, $defaultPackPrices, $defaultAllowedDesigns, $defaultDeliveryOptions)
{
    global $returnToPath;

    $rawJson = field('cart_json');
    if (strlen($rawJson) > 524288) {
        render_page(
            'Confirma os dados.',
            'O carrinho ultrapassa o tamanho máximo aceite.',
            'error',
            array('Reduz o número de produtos ou ficheiros e tenta novamente.')
        );
    }
    $payload = json_decode($rawJson, true, 64);
    $errors = array();

    if (!is_array($payload)) {
        render_page(
            'Confirma os dados.',
            'O pedido do carrinho não chegou num formato válido.',
            'error',
            array('Volta ao checkout e tenta enviar novamente.')
        );
    }

    $items = isset($payload['items']) && is_array($payload['items']) ? $payload['items'] : array();
    $checkout = isset($payload['checkout']) && is_array($payload['checkout']) ? $payload['checkout'] : array();
    $cartId = isset($payload['cartId']) ? cart_text($payload['cartId']) : '';
    $schemaVersion = isset($payload['schemaVersion']) ? (int)$payload['schemaVersion'] : 0;
    $funnelSessionId = cart_clean_funnel_session_id(isset($payload['funnel_session_id']) ? $payload['funnel_session_id'] : '');

    if (empty($items)) {
        $errors[] = 'O carrinho está vazio.';
    }
    if (count($items) > 30) {
        $errors[] = 'O carrinho tem mais de 30 produtos.';
        $items = array_slice($items, 0, 30);
    }

    $customerName = cart_text(isset($checkout['customer_name']) ? $checkout['customer_name'] : '');
    $customerContact = cart_text(isset($checkout['customer_contact']) ? $checkout['customer_contact'] : '');
    $customerNif = clean_header(cart_text(isset($checkout['customer_nif']) ? $checkout['customer_nif'] : ''));
    $customerCongregation = '';
    $deliveryOption = cart_text(isset($checkout['delivery_option']) ? $checkout['delivery_option'] : '');
    $sendCopy = !empty($checkout['send_copy']);
    $copyEmail = $sendCopy ? clean_header(isset($checkout['copy_email']) ? $checkout['copy_email'] : '') : '';

    if (strlen($customerName) < 2 || strlen($customerName) > 120) {
        $errors[] = 'Indica o teu nome nos dados de contacto.';
    }

    if (strlen($customerContact) < 3 || strlen($customerContact) > 160 || !cart_valid_contact($customerContact)) {
        $errors[] = 'Indica um email ou telemóvel válido para podermos confirmar a encomenda.';
    }

    if (!cart_valid_nif($customerNif)) {
        $errors[] = 'O NIF deve ter 9 dígitos.';
    }

    $allowedDeliveryOptions = product_delivery_options(array(), $defaultDeliveryOptions);

    if ($sendCopy && !filter_var($copyEmail, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Indica um email válido para receber a cópia.';
    }

    $preparedItems = array();
    foreach ($items as $index => $item) {
        $prepared = cart_prepare_item($item, $defaultPackPrices, $defaultAllowedDesigns);
        if (!empty($prepared['errors'])) {
            foreach ($prepared['errors'] as $error) {
                $errors[] = 'Produto ' . ($index + 1) . ': ' . $error;
            }
            continue;
        }
        $preparedItems[] = $prepared;
    }

    if (!empty($preparedItems)) {
        $deliveryProduct = load_product_config($preparedItems[0]['product_slug']);
        $allowedDeliveryOptions = product_delivery_options($deliveryProduct, $defaultDeliveryOptions);
    }
    if (!array_key_exists($deliveryOption, $allowedDeliveryOptions)) {
        $errors[] = 'Escolhe a opção de entrega.';
    }

    $catalogContexts = array();
    $orderCustomizationFileCount = 0;
    $orderArtworkTotalQuantity = 0;
    $orderCustomizationFeeCents = 0;
    foreach ($preparedItems as $preparedLine) {
        $lineContext = isset($preparedLine['catalog_context']) ? (string)$preparedLine['catalog_context'] : 'main';
        if (!in_array($lineContext, $catalogContexts, true)) {
            $catalogContexts[] = $lineContext;
        }
        $orderCustomizationFileCount += isset($preparedLine['customization_file_count']) ? (int)$preparedLine['customization_file_count'] : 0;
        $orderArtworkTotalQuantity += isset($preparedLine['artwork_total_quantity']) ? (int)$preparedLine['artwork_total_quantity'] : 0;
        $orderCustomizationFeeCents += isset($preparedLine['customization_fee_cents']) ? (int)$preparedLine['customization_fee_cents'] : 0;
    }
    $authoritativeCartContext = count($catalogContexts) > 1
        ? 'mixed'
        : (isset($catalogContexts[0]) ? $catalogContexts[0] : 'main');

    if (!empty($errors)) {
        render_page(
            'Confirma os dados.',
            'Alguns campos precisam de ser corrigidos antes de enviar.',
            'error',
            $errors
        );
    }

    $orderCode = '';
    $orderUploadTemps = array();
    try {
        $orderCode = mp_db_generate_order_code();
        $orderUploadTemps = order_upload_copy_to_order($preparedItems, $orderCode);
    } catch (Exception $e) {
        if ($orderCode !== '') {
            order_upload_cleanup_order($orderCode);
        }
        @error_log('[miaandpaper] preparação dos anexos cart falhou: ' . $e->getMessage());
        render_page(
            'Não foi possível preparar as fotos.',
            'Tenta enviar novamente dentro de alguns minutos. As fotos escolhidas não foram associadas a nenhuma encomenda.',
            'error',
            array(),
            '',
            '',
            true
        );
    }

    $delivery = isset($allowedDeliveryOptions[$deliveryOption]) ? $allowedDeliveryOptions[$deliveryOption] : null;
    $deliveryLine = $delivery ? $delivery['label'] : 'Não indicado';
    $deliveryFeeCents = $delivery ? (int)$delivery['fee_cents'] : 0;
    $deliveryFeeLine = ($delivery && !empty($delivery['price_text'])) ? $delivery['price_text'] : format_euros($deliveryFeeCents);
    $deliveryFeeLine = trim(preg_replace('/\s+/', ' ', $deliveryFeeLine));
    $subtotalCents = 0;
    foreach ($preparedItems as $line) {
        $subtotalCents += (int)$line['price_cents'];
    }
    $hasQuoteOnly = false;
    foreach ($preparedItems as $line) {
        if (!empty($line['price_quote_only'])) {
            $hasQuoteOnly = true;
            break;
        }
    }
    $totalEstimateCents = $subtotalCents + $deliveryFeeCents;
    $totalEstimateLabel = $deliveryFeeCents > 0 ? 'Total estimado' : 'Total';
    $productsTotalLine = $hasQuoteOnly
        ? ($subtotalCents > 0 ? format_euros($subtotalCents) . ' + preço a confirmar' : 'A confirmar pela Mia')
        : format_euros($subtotalCents);
    $totalEstimateLine = $hasQuoteOnly ? 'A confirmar pela Mia' : format_euros($totalEstimateCents);

    $customerContactTrim = trim($customerContact);
    $contactEmail = filter_var($customerContactTrim, FILTER_VALIDATE_EMAIL)
        ? clean_header($customerContactTrim)
        : '';
    $contactPhone = $contactEmail === '' ? $customerContactTrim : '';
    $replyTo = $contactEmail !== '' ? $contactEmail : $from;

    $ownerBodyLines = array(
        'Novo pedido com vários produtos',
        '',
        'Resumo do pedido',
        'Produtos: ' . count($preparedItems),
        'Contexto do carrinho: ' . $authoritativeCartContext,
        'Total dos produtos: ' . $productsTotalLine,
        'Entrega: ' . $deliveryLine,
        'Portes: ' . $deliveryFeeLine,
        $totalEstimateLabel . ': ' . $totalEstimateLine,
        '',
        'Dados de contacto:',
        'Nome: ' . $customerName,
        'Contacto: ' . $customerContactTrim,
        'NIF: ' . ($customerNif !== '' ? $customerNif : 'Não indicado'),
        'Cópia para cliente: ' . ($sendCopy ? $copyEmail : 'Não'),
        '',
        'Produtos:',
    );

    $customerBodyLines = array(
        'Olá ' . $customerName . ',',
        '',
        'Obrigada pelo teu pedido. A Mia fala contigo em breve para confirmar os detalhes do pagamento.',
        '',
        'Resumo do pedido',
        'Produtos: ' . count($preparedItems),
        'Total dos produtos: ' . $productsTotalLine,
        'Entrega: ' . $deliveryLine,
        'Portes: ' . $deliveryFeeLine,
        $totalEstimateLabel . ': ' . $totalEstimateLine,
        '',
        'Produtos:',
    );

    foreach ($preparedItems as $index => $line) {
        $ownerBodyLines[] = '';
        $ownerBodyLines[] = 'Produto ' . ($index + 1);
        $ownerBodyLines = array_merge($ownerBodyLines, cart_item_owner_lines($line));

        $customerBodyLines[] = '';
        $customerBodyLines[] = 'Produto ' . ($index + 1);
        $customerBodyLines = array_merge($customerBodyLines, cart_item_customer_lines($line));
    }

    $ownerBodyLines = array_merge($ownerBodyLines, array(
        '',
        'Enviado pelo checkout de carrinho de miaandpaper.com',
        'Cart ID: ' . ($cartId !== '' ? $cartId : 'Não indicado'),
    ));

    $customerBodyLines = array_merge($customerBodyLines, array(
        '',
        'Dados de contacto:',
        'Nome: ' . $customerName,
        'Contacto: ' . $customerContactTrim,
        'NIF: ' . ($customerNif !== '' ? $customerNif : 'Não indicado'),
    ), customer_email_footer_lines());

    $ownerBody = implode("\n", $ownerBodyLines);
    $customerBody = implode("\n", $customerBodyLines);
    $subject = 'Novo pedido com vários produtos - Mia & Paper';
    $postSuccessCopyToken = post_success_copy_token();
    $customerCopySubject = '';

    $ownerHeaders = array(
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: "Mia & Paper" <' . $from . '>',
        'Reply-To: ' . $replyTo,
        'X-Mailer: PHP/' . phpversion(),
    );

    $customerHeaders = array(
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: "Mia & Paper" <' . $from . '>',
        'Reply-To: "Mia & Paper" <' . $from . '>',
        'X-Mailer: PHP/' . phpversion(),
    );

    $ipNumber = mp_client_ip();
    $paymentDeliveryEligible = payment_delivery_is_eligible(
        $deliveryOption,
        $customerName,
        $customerContactTrim,
        $ipNumber
    );
    $referrerLine = isset($_SERVER['HTTP_REFERER']) ? (string)$_SERVER['HTTP_REFERER'] : '';
    $landingLine = $returnToPath !== '' ? $returnToPath : 'checkout.html';
    $firstProductSlug = isset($preparedItems[0]['product_slug']) ? $preparedItems[0]['product_slug'] : 'cart';

    $rawOrderSnapshot = array(
        'order_mode' => 'cart',
        'schema_version' => $schemaVersion,
        'cart_id' => $cartId,
        'funnel_session_id' => $funnelSessionId,
        'cart_context' => $authoritativeCartContext,
        'catalog_contexts' => $catalogContexts,
        'items' => $preparedItems,
        'checkout' => array(
            'customer_name' => $customerName,
            'customer_contact' => $customerContactTrim,
            'customer_nif' => $customerNif,
            'delivery_option' => $deliveryOption,
            'delivery_label' => $deliveryLine,
            'send_copy' => $sendCopy,
            'copy_email' => $copyEmail,
        ),
        'subtotal_cents' => $subtotalCents,
        'customization_file_count' => $orderCustomizationFileCount,
        'artwork_total_quantity' => $orderArtworkTotalQuantity,
        'customization_fee_cents' => $orderCustomizationFeeCents,
        'shipping_estimate_cents' => $deliveryFeeCents,
        'total_estimate_cents' => $totalEstimateCents,
        'has_price_to_confirm' => $hasQuoteOnly,
        'currency' => 'EUR',
    );

    $orderId = 0;
    $orderStored = false;
    try {
        $customerCopySubject = 'Recebemos o teu pedido (' . $orderCode . ') · Mia & Paper';
        $rawOrderSnapshot['order_code'] = $orderCode;
        $rawOrderSnapshot['post_success_copy_available'] = !$sendCopy;
        $rawOrderSnapshot['post_success_copy_token_hash'] = hash('sha256', $postSuccessCopyToken);
        $rawOrderSnapshot['customer_copy_subject'] = $customerCopySubject;
        $rawOrderSnapshot['customer_copy_body'] = $customerBody;
        $orderId = mp_db_insert_order(array(
            'order_code' => $orderCode,
            'source' => 'site_cart',
            'product_slug' => 'cart',
            'product_type' => $firstProductSlug,
            'customer_name' => $customerName,
            'customer_contact' => $customerContactTrim,
            'customer_nif' => $customerNif,
            'contact_email' => $contactEmail,
            'contact_phone' => $contactPhone,
            'card_name' => '',
            'card_contact' => '',
            'congregation' => $customerCongregation,
            'delivery_option' => $deliveryOption,
            'delivery_label' => $deliveryLine,
            'subtotal_cents' => $subtotalCents,
            'shipping_estimate_cents' => $deliveryFeeCents,
            'total_estimate_cents' => $totalEstimateCents,
            'currency' => 'EUR',
            'payment_status' => 'unpaid',
            'paid' => 0,
            'fulfillment_status' => 'new',
            'ip_number' => $ipNumber,
            'landing_page' => $landingLine,
            'referrer' => $referrerLine,
            'raw_order_json' => json_encode($rawOrderSnapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ));
        $orderStored = true;
        order_upload_consume_temp($orderUploadTemps);
        mp_db_log_order_event($orderId, 'created', array('source' => 'site_cart'));
        if ($funnelSessionId !== '') {
            try {
                $orderCreatedMetrics = mp_funnel_strip_pii(array(
                    'event_name' => 'order_created',
                    'cart_context' => $authoritativeCartContext,
                    'product_count' => count($preparedItems),
                    'subtotal_cents' => $subtotalCents,
                    'shipping_estimate_cents' => $deliveryFeeCents,
                    'total_estimate_cents' => $totalEstimateCents,
                    'customization_file_count' => $orderCustomizationFileCount,
                    'artwork_total_quantity' => $orderArtworkTotalQuantity,
                    'customization_fee_cents' => $orderCustomizationFeeCents,
                ));
                mp_db_log_funnel_event(array(
                    'created_at' => mp_db_now(),
                    'session_id' => $funnelSessionId,
                    'product_slug' => 'cart',
                    'product_type' => 'cart',
                    'event_name' => 'order_created',
                    'step_id' => 'checkout',
                    'step_index' => 2,
                    'ip_number' => mp_tracking_client_ip(),
                    'event_json' => json_encode($orderCreatedMetrics, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ));
            } catch (Exception $eventException) {
                // A encomenda já está guardada. Uma falha analítica nunca
                // deve transformar um checkout válido num aparente erro.
                @error_log('[miaandpaper] order_created funnel falhou: ' . $eventException->getMessage());
            }
        }
    } catch (Exception $e) {
        if (!$orderStored) {
            order_upload_cleanup_order($orderCode);
        }
        @error_log('[miaandpaper] mp_db_insert_order cart falhou: ' . $e->getMessage());
        render_page(
            'Não foi possível guardar o teu pedido.',
            'Houve um problema ao guardar o pedido. Tenta de novo daqui a uns minutos ou envia mensagem pelo Instagram, ou pelo <a href="contacto.html">formulário de contacto</a>.',
            'error',
            array(),
            '',
            '',
            true
        );
    }

    $sent = mail($recipient, $subject, $ownerBody, implode("\r\n", $ownerHeaders), '-f' . $from);
    mp_db_log_email(array(
        'order_id' => $orderId,
        'email_type' => 'order_received_owner',
        'recipient' => $recipient,
        'subject' => $subject,
        'success' => $sent ? 1 : 0,
        'error_message' => $sent ? null : 'mail() devolveu false',
    ));

    if (!$sent) {
        mp_db_log_order_event($orderId, 'email_failed', array('to' => $recipient));
        render_page(
            'Pedido guardado mas email falhou.',
            'O pedido (' . $orderCode . ') ficou guardado, mas houve um problema ao enviar a notificação à Mia por email. Por segurança, envia também uma mensagem pelo Instagram a confirmar.',
            'error',
            array('Código da encomenda guardado: ' . $orderCode)
        );
    }

    if ($sendCopy && $copyEmail !== '') {
        $copySent = mail(
            $copyEmail,
            $customerCopySubject,
            $customerBody,
            implode("\r\n", $customerHeaders),
            '-f' . $from
        );
        mp_db_log_email(array(
            'order_id' => $orderId,
            'email_type' => 'order_copy_customer',
            'recipient' => $copyEmail,
            'subject' => $customerCopySubject,
            'success' => $copySent ? 1 : 0,
            'error_message' => $copySent ? null : 'mail() devolveu false',
        ));
    }

    $paymentItems = array();
    foreach ($preparedItems as $line) {
        $paymentItems[] = array(
            'label' => isset($line['product_name']) ? (string)$line['product_name'] : 'Produto',
            'price_cents' => isset($line['price_cents']) ? (int)$line['price_cents'] : 0,
        );
    }
    $paymentDetails = payment_success_details(
        $totalEstimateCents,
        $customerContactTrim,
        $paymentItems,
        $deliveryFeeCents,
        $paymentDeliveryEligible,
        $hasQuoteOnly,
        $ipNumber
    );
    if (is_array($paymentDetails)) {
        mp_db_log_order_event($orderId, 'payment_instructions_shown', array(
            'method' => 'mbway',
            'country_code' => $paymentDetails['country_code'],
            'total_cents' => $totalEstimateCents,
        ));
    }

    render_page(
        is_array($paymentDetails) ? 'Obrigada pela tua encomenda.' : 'Pedido feito com sucesso!',
        is_array($paymentDetails)
            ? 'Vamos começar a prepará-la assim que o pagamento estiver confirmado.'
            : 'O teu pedido foi recebido. A Mia fala contigo em breve para confirmar os detalhes.',
        'success',
        array(),
        $orderCode,
        $customerName,
        false,
        is_array($paymentDetails) ? 'cart-payment' : 'cart',
        !$sendCopy ? array(
            'order_code' => $orderCode,
            'copy_token' => $postSuccessCopyToken,
            'email' => $contactEmail,
        ) : null,
        $paymentDetails
    );
}

$returnToPath = safe_return_to();
$productSlug = safe_product_slug();

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'GET' && payment_debug_requested()) {
    render_page(
        'Obrigada pela tua encomenda.',
        'Vamos começar a prepará-la assim que o pagamento estiver confirmado.',
        'success',
        array(),
        'MP-DEBUG',
        'Cliente de teste',
        false,
        'payment-debug',
        null,
        array(
            'total_cents' => 3250,
            'contact' => 'cliente.teste@example.com',
            'items' => array(
                array('label' => 'Crachás personalizados', 'price_cents' => 1250),
                array('label' => 'Mini-cadernos personalizados', 'price_cents' => 1460),
            ),
            'shipping_cents' => 540,
            'mbway_number' => '96 300 16 05',
            'instagram_url' => payment_instagram_url(),
            'country_code' => 'PT',
        )
    );
}

if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: index.html', true, 303);
    exit;
}

if (field('website') !== '') {
    render_page(
        'Pedido recebido.',
        'Obrigada. Se for necessário confirmar algum detalhe, a Mia entra em contacto.',
        'success',
        array()
    );
}

if (!$configPath || !is_file($configPath)) {
    @error_log('[miaandpaper] config de email em falta: ' . $configPath);
    render_page(
        'Falta configurar o envio.',
        'O formulário está pronto, mas falta criar o ficheiro privado de configuração.',
        'error',
        // SAFE_ERROR_OUTPUT_V1: o caminho absoluto vai para o error_log, não
        // para a página — a mensagem ao cliente não revela paths do servidor.
        array(
            'Depois volta a tentar enviar o pedido.',
        )
    );
}

$config = require $configPath;

if (!is_array($config)) {
    render_page(
        'Configuração inválida.',
        'O ficheiro privado existe, mas não devolve a configuração esperada.',
        'error',
        array()
    );
}

// FORM_RATE_LIMIT_V1: aqui já sabemos que é um POST real, com o honeypot
// limpo e o envio configurado. O limite é generoso — um cliente que corrija o
// formulário e volte a submeter não chega lá perto — mas fecha a utilização do
// domínio como relé de spam através do `copy_email`. Ver lib/db.php.
require_once __DIR__ . '/lib/db.php';
if (
    field('order_action') !== 'send_order_copy'
    && mp_db_form_rate_limited('order', mp_client_ip(), 12)
) {
    require_once __DIR__ . '/lib/avisos.php';
    mp_aviso('guardrail', 'encomenda-ritmo', 'Travão de encomendas: demasiados pedidos do mesmo dispositivo', array_merge(
        array(
            'Alguém passou o limite de 12 submissões por hora e está a ser recusado.',
            '',
            'Pode ser abuso, mas também pode ser uma cliente a corrigir o pedido',
            'muitas vezes seguidas. Vale a pena olhar.',
            '',
        ),
        mp_aviso_contexto()
    ));
    render_page(
        'Recebemos vários pedidos deste dispositivo.',
        'Os teus pedidos já chegaram. Espera uns minutos antes de enviares outro ou fala com a Mia pelo Instagram para confirmar o que falta.',
        'error',
        array()
    );
}

$recipients = parse_email_recipients(isset($config['to']) ? $config['to'] : '');
$recipient = is_array($recipients) ? implode(', ', $recipients) : '';
$from = clean_header(isset($config['from']) ? $config['from'] : 'no-reply@miaandpaper.com');

if ($recipients === false || empty($recipients) || !filter_var($from, FILTER_VALIDATE_EMAIL)) {
    render_page(
        'Configuração inválida.',
        'O ficheiro privado existe, mas o email de destino ou de envio não está válido.',
        'error',
        array()
    );
}

if (field('order_action') === 'send_order_copy') {
    process_post_success_copy($from);
}

$productConfig = load_product_config($productSlug);
$productName = isset($productConfig['name']) ? trim((string)$productConfig['name']) : 'Crachás';

$defaultPackPrices = array(
    '25 mm' => array(
        1 => 150,
        3 => 420,
        5 => 650,
        24 => 2700,
        48 => 5000,
        96 => 9000,
    ),
    '32 mm' => array(
        1 => 175,
        3 => 500,
        5 => 750,
        24 => 3200,
        48 => 5800,
        96 => 10500,
    ),
);

$defaultAllowedDesigns = array(
    'Design 01 - Flores suaves',
    'Design 02 - Azul e dourado',
    'Design 03 - Texto simples',
    'Design 04 - Folhas verdes',
    'Design 05 - Tons neutros',
    'Design 06 - Tema personalizado',
);

// DELIVERY_OPTIONS_3_V1: defaults alinhados com o frontend (3 opções).
// Aceita IDs antigos ("combine") como fallback compatível para encomendas
// guardadas antes da migração — o label exibido segue o ID novo.
$defaultDeliveryOptions = array(
    'pickup' => array(
        'label' => 'Vou recolher na casa da Mia',
        'fee_cents' => 0,
    ),
    'shipping' => array(
        'label' => 'Envio CTT - até 2 Kg',
        'fee_cents' => 540,
        'price_text' => "Valor mínimo:\n5,40 €",
    ),
    'join_orders' => array(
        'label' => 'Junta as minhas encomendas',
        'fee_cents' => 0,
    ),
    'combine' => array(
        'label' => 'Vou recolher na casa da Mia',
        'fee_cents' => 0,
    ),
);

if (field('order_mode') === 'cart' || field('cart_json') !== '') {
    process_cart_order($recipient, $from, $defaultPackPrices, $defaultAllowedDesigns, $defaultDeliveryOptions);
}

$centralPackPrices = load_pricing_prices($productSlug);
$packPrices = !empty($centralPackPrices) ? $centralPackPrices : product_prices($productConfig, empty($productConfig) ? $defaultPackPrices : array());
$allowedDesigns = product_design_values($productConfig, $defaultAllowedDesigns);
$allowedDeliveryOptions = product_delivery_options($productConfig, $defaultDeliveryOptions);
$hasPackStep = !empty(product_step($productConfig, 'pack'));
$hasCardDetailsStep = product_has_card_details_step($productConfig);
$hasPrices = !empty($packPrices);

$size = field('size');
$packQuantity = (int)field('pack_quantity');
$designs = posted_list('designs');
$designQuantities = parse_design_quantities(posted_list('design_quantities'));
$designLabels = parse_design_labels(posted_list('design_labels'));
$assortedDesigns = field('assorted_designs') === '1';
$deliveryOption = field('delivery_option');
$recipientName = field('recipient_name');
$contact = field('contact');
$congregation = field('congregation');
$customerName = field('customer_name');
$customerContact = field('customer_contact');
$customerNif = clean_header(field('customer_nif'));
$sendCopy = field('send_copy') === '1';
$copyEmail = field('copy_email');
$congregationGift = field('congregation_gift') === '1';
$isCadernos = $productSlug === 'cadernos';
$lamination = field('lamination');
$laminationLabel = field('lamination_label');
$purchaseOption = field('purchase_option');
$purchaseOptionLabel = field('purchase_option_label');
$purchaseIncludes = field('purchase_includes');
$purchaseIsPack = field('purchase_is_pack') === '1';
$coverPersonalization = field('cover_personalization');
$coverPersonalizationText = field('cover_personalization_text');
$packPromoNote = field('pack_promo_note');
$laminationStep = product_step($productConfig, 'lamination');
$purchaseStep = product_step($productConfig, 'pack');
$personalizationStep = product_step($productConfig, 'cover_personalization');
$laminationItem = $isCadernos ? product_step_item_by_value($laminationStep, $lamination) : array();
$purchaseItem = $isCadernos ? product_step_item_by_quantity($purchaseStep, $packQuantity) : array();
$cadernoOrderQuantityOptions = $isCadernos ? product_order_quantity_options($purchaseStep) : array(1);
$cadernoOrderQuantity = $isCadernos ? (int)field('caderno_order_quantity') : 1;
if ($isCadernos && $cadernoOrderQuantity <= 0) {
    $cadernoOrderQuantity = product_order_quantity_default($purchaseStep, $cadernoOrderQuantityOptions);
}

if ($assortedDesigns) {
    $designs = array('__sortido__');
    if ($packQuantity > 0) {
        $designQuantities = array('__sortido__' => $packQuantity);
    }
    $designLabels = array('__sortido__' => 'Sortido');
}

$uniqueDesigns = array_values(array_unique($designs));
$allDesignsSelected = !$assortedDesigns
    && !empty($allowedDesigns)
    && count($uniqueDesigns) === count($allowedDesigns)
    && count(array_diff($allowedDesigns, $uniqueDesigns)) === 0;
$showCongregationGiftLine = $hasCardDetailsStep && !$isCadernos && !$assortedDesigns && !$allDesignsSelected;
if (!$showCongregationGiftLine) {
    $congregationGift = false;
}

if ($isCadernos && !empty($laminationItem)) {
    $laminationLabel = isset($laminationItem['title']) ? (string)$laminationItem['title'] : $lamination;
}

if ($isCadernos && !empty($purchaseItem)) {
    $purchaseOption = isset($purchaseItem['value']) ? (string)$purchaseItem['value'] : $purchaseOption;
    $purchaseOptionLabel = isset($purchaseItem['title']) ? (string)$purchaseItem['title'] : $purchaseOptionLabel;
    $purchaseIncludes = isset($purchaseItem['includes']) ? (string)$purchaseItem['includes'] : $purchaseIncludes;
    $purchaseIsPack = !empty($purchaseItem['isPack']);
    $packPromoNote = $purchaseIsPack && isset($purchaseStep['promoNote']) ? (string)$purchaseStep['promoNote'] : $packPromoNote;
}

$errors = array();

if ($isCadernos) {
    $size = isset($productConfig['defaultPriceKey']) && trim((string)$productConfig['defaultPriceKey']) !== ''
        ? (string)$productConfig['defaultPriceKey']
        : 'Cadernos';
}

if ($size === '' && count($packPrices) === 1) {
    $keys = array_keys($packPrices);
    $size = (string)$keys[0];
}

if ($hasPrices && !array_key_exists($size, $packPrices)) {
    $errors[] = 'Escolhe um tamanho válido.';
}

if ($hasPackStep && $packQuantity <= 0) {
    $errors[] = $isCadernos ? 'Escolhe uma opção de compra.' : 'Escolhe um pack.';
} elseif ($hasPrices && $hasPackStep && (!isset($packPrices[$size]) || !isset($packPrices[$size][$packQuantity]))) {
    $errors[] = $isCadernos ? 'Escolhe uma opção de compra válida.' : 'Escolhe um pack válido para o tamanho selecionado.';
}

if (empty($designs) && !$assortedDesigns) {
    $errors[] = $isCadernos ? 'Escolhe uma capa.' : 'Escolhe pelo menos um design.';
} elseif (!$assortedDesigns) {
    foreach ($designs as $design) {
        if (!in_array($design, $allowedDesigns, true)) {
            $errors[] = 'Um dos designs escolhidos não é válido.';
            break;
        }
    }
}

if ($isCadernos) {
    if (!empty($designs) && count($uniqueDesigns) !== 1) {
        $errors[] = 'Escolhe uma capa.';
    }

    if (empty($laminationItem)) {
        $errors[] = 'Escolhe um acabamento da capa válido.';
    }

    if (empty($purchaseItem)) {
        $errors[] = 'Escolhe uma opção de compra válida.';
    }

    if (!in_array($cadernoOrderQuantity, $cadernoOrderQuantityOptions, true)) {
        $errors[] = 'Escolhe uma quantidade válida.';
    }

    if ($coverPersonalization !== 'yes' && $coverPersonalization !== 'no') {
        $errors[] = 'Escolhe se queres personalizar a capa.';
    }

    if ($coverPersonalization === 'yes') {
        $personalizationLimit = isset($personalizationStep['maxLength']) ? (int)$personalizationStep['maxLength'] : 25;
        $personalizationLength = function_exists('mb_strlen')
            ? mb_strlen($coverPersonalizationText, 'UTF-8')
            : strlen($coverPersonalizationText);

        if ($coverPersonalizationText === '') {
            $errors[] = 'Escreve o nome/frase para a capa.';
        } elseif ($personalizationLength > $personalizationLimit) {
            $errors[] = 'O nome/frase da capa tem de ter no máximo ' . $personalizationLimit . ' caracteres.';
        }
    } else {
        $coverPersonalizationText = '';
    }
}

if (!empty($designs) && $hasPackStep && $packQuantity > 0 && !$assortedDesigns && !$isCadernos) {
    $quantityTotal = 0;

    foreach ($designs as $design) {
        if (!isset($designQuantities[$design]) || $designQuantities[$design] < 1) {
            $errors[] = 'Indica a quantidade de cada design escolhido.';
            break;
        }

        $quantityTotal += $designQuantities[$design];
    }

    foreach ($designQuantities as $design => $quantity) {
        if (!in_array($design, $designs, true)) {
            $errors[] = 'As quantidades não correspondem aos designs escolhidos.';
            break;
        }
    }

    if ($quantityTotal !== $packQuantity) {
        $errors[] = 'A soma das quantidades dos designs tem de ser igual ao pack escolhido.';
    }
}

if (!array_key_exists($deliveryOption, $allowedDeliveryOptions)) {
    $errors[] = 'Escolhe a opção de entrega.';
}

if (!$isCadernos && $recipientName !== '' && (strlen($recipientName) < 2 || strlen($recipientName) > 120)) {
    $errors[] = 'Confirma o nome para o cartão.';
}

if (!$isCadernos && $contact !== '' && (strlen($contact) < 3 || strlen($contact) > 160)) {
    $errors[] = 'Confirma o contacto opcional.';
}

if (!$isCadernos && $congregation !== '' && (strlen($congregation) < 2 || strlen($congregation) > 160)) {
    $errors[] = 'Confirma a congregação opcional.';
}

if (strlen($customerName) < 2 || strlen($customerName) > 120) {
    $errors[] = 'Indica o teu nome nos dados de contacto.';
}

if (strlen($customerContact) < 3 || strlen($customerContact) > 160 || !cart_valid_contact($customerContact)) {
    $errors[] = 'Indica um email ou telemóvel válido para podermos confirmar a encomenda.';
}

if (!cart_valid_nif($customerNif)) {
    $errors[] = 'O NIF deve ter 9 dígitos.';
}

if ($sendCopy && !filter_var($copyEmail, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Indica um email válido para receber a cópia.';
}

if (!empty($errors)) {
    render_page(
        'Confirma os dados.',
        'Alguns campos precisam de ser corrigidos antes de enviar.',
        'error',
        $errors
    );
}

$replyTo = filter_var($customerContact, FILTER_VALIDATE_EMAIL)
    ? clean_header($customerContact)
    : (filter_var($contact, FILTER_VALIDATE_EMAIL) ? clean_header($contact) : $from);
$recipientNameLine = $recipientName !== '' ? $recipientName : 'Não indicado';
$contactLine = $contact !== '' ? $contact : 'Não indicado';
$congregationLine = $congregation !== '' ? $congregation : 'Não indicado';
$congregationGiftLine = $congregationGift ? 'Sim - pediu ajuda para escolher designs únicos para a congregação.' : 'Não';
$customerNameLine = $customerName !== '' ? $customerName : 'Não indicado';
$customerContactLine = $customerContact !== '' ? $customerContact : 'Não indicado';
$customerNifLine = $customerNif !== '' ? $customerNif : 'Não indicado';
$unitLabel = isset($productConfig['unitLabel']) && trim((string)$productConfig['unitLabel']) !== '' ? trim((string)$productConfig['unitLabel']) : (($productSlug === 'crachas' || $productSlug === 'pins') ? 'crachás' : 'unidades');
$unitShort = isset($productConfig['unitShort']) && trim((string)$productConfig['unitShort']) !== '' ? trim((string)$productConfig['unitShort']) : (($productSlug === 'crachas' || $productSlug === 'pins') ? 'crachá' : 'unid.');
$copyEmail = $sendCopy ? clean_header($copyEmail) : '';
$basePriceCents = ($hasPrices && isset($packPrices[$size][$packQuantity])) ? $packPrices[$size][$packQuantity] : 0;
if ($isCadernos && !empty($purchaseItem) && isset($purchaseItem['priceCents'])) {
    $basePriceCents = (int)$purchaseItem['priceCents'];
}
$personalizationExtraCents = $isCadernos && $coverPersonalization === 'yes'
    ? (isset($personalizationStep['extraPriceCents']) ? (int)$personalizationStep['extraPriceCents'] : 0)
    : 0;
$unitPriceCents = $basePriceCents + $personalizationExtraCents;
$priceCents = $isCadernos ? $unitPriceCents * $cadernoOrderQuantity : $unitPriceCents;
$priceLine = $priceCents ? format_euros($priceCents) : 'Não calculado';
$unitPriceLine = (!$isCadernos && $priceCents) ? format_unit_price($priceCents, $packQuantity, $unitShort) : '';
$delivery = isset($allowedDeliveryOptions[$deliveryOption]) ? $allowedDeliveryOptions[$deliveryOption] : null;
$deliveryLine = $delivery ? $delivery['label'] : 'Não indicado';
$deliveryFeeCents = $delivery ? (int)$delivery['fee_cents'] : 0;
$deliveryFeeLine = ($delivery && !empty($delivery['price_text'])) ? $delivery['price_text'] : format_euros($deliveryFeeCents);
$deliveryFeeLine = trim(preg_replace('/\s+/', ' ', $deliveryFeeLine));
$totalEstimateLine = $priceCents ? format_euros($priceCents + $deliveryFeeCents) : 'Não calculado';
$totalEstimateLabel = $deliveryFeeCents > 0 ? 'Total estimado' : 'Total';
// SECTION_DISPLAY_LABELS_V1:
// - email para a Mia (owner) -> "Porto 01 (Crachá 07) x3" para conseguir
//   identificar o design original na preparação da encomenda;
// - email para o cliente     -> "Porto 01 x3" sem o identificador interno;
// - se não houver display label, ambos caem no formato antigo "<value> xN".
$designLinesOwner = array();
$designLinesCustomer = array();
$coverLineOwner = '';
$coverLineCustomer = '';

if ($isCadernos) {
    $coverDesign = isset($designs[0]) ? $designs[0] : '';
    $coverLabel = isset($designLabels[$coverDesign]) ? $designLabels[$coverDesign] : $coverDesign;
    $coverLineOwner = $coverLabel . ($coverLabel !== $coverDesign && $coverDesign !== '' ? ' (' . $coverDesign . ')' : '');
    $coverLineCustomer = $coverLabel;
    $designLinesOwner[] = 'Capa escolhida: ' . $coverLineOwner;
    $designLinesCustomer[] = 'Capa escolhida: ' . $coverLineCustomer;
} elseif ($assortedDesigns) {
    $designLinesOwner[] = 'Sortido - A Mia vai escolher uma combinação de designs de acordo com a quantidade escolhida.';
    $designLinesCustomer[] = 'Sortido - a Mia vai escolher uma combinação de designs de acordo com a quantidade escolhida.';
} else {
    foreach ($designs as $design) {
        $quantity = isset($designQuantities[$design]) ? $designQuantities[$design] : 0;
        $displayLabel = isset($designLabels[$design]) ? $designLabels[$design] : '';

        if ($displayLabel !== '' && $displayLabel !== $design) {
            $designLinesOwner[] = $displayLabel . ' (' . $design . ') x' . $quantity;
            $designLinesCustomer[] = $displayLabel . ' x' . $quantity;
        } else {
            $designLinesOwner[] = $design . ' x' . $quantity;
            $designLinesCustomer[] = $design . ' x' . $quantity;
        }
    }
}

$basePriceLine = $basePriceCents
    ? ($isCadernos && $cadernoOrderQuantity > 1 ? format_euros($basePriceCents) . ' x ' . $cadernoOrderQuantity . ' = ' . format_euros($basePriceCents * $cadernoOrderQuantity) : format_euros($basePriceCents))
    : 'Não calculado';
$personalizationExtraLine = $personalizationExtraCents
    ? ($isCadernos && $cadernoOrderQuantity > 1 ? format_euros($personalizationExtraCents) . ' x ' . $cadernoOrderQuantity . ' = ' . format_euros($personalizationExtraCents * $cadernoOrderQuantity) : format_euros($personalizationExtraCents))
    : '';
$coverPersonalizationLine = $coverPersonalization === 'yes' ? 'Sim' : 'Não';

$subject = 'Novo pedido de ' . $productName . ' - Mia & Paper';
$ownerBodyLines = array(
    'Novo pedido de ' . $productName,
    '',
    'Produto: ' . $productName,
    'Pack: ' . ($hasPackStep ? $packQuantity . ' ' . $unitLabel : 'Não aplicável'),
    'Tamanho: ' . $size,
    'Preço do pedido: ' . $priceLine . ($unitPriceLine !== '' ? ' (' . $unitPriceLine . ')' : ''),
    'Entrega: ' . $deliveryLine,
    'Portes: ' . $deliveryFeeLine,
    '',
    'Designs e quantidades:',
    '- ' . implode("\n- ", $designLinesOwner),
    '',
);
$hasAnyCardData = ($recipientNameLine !== 'Não indicado' && $recipientNameLine !== ''
    || ($contactLine !== 'Não indicado' && $contactLine !== '')
    || ($congregationLine !== 'Não indicado' && $congregationLine !== '')
    || $congregationGift);
if ($hasCardDetailsStep || $hasAnyCardData) {
    $ownerBodyLines[] = '';
    $ownerBodyLines[] = 'Dados para cartão de apresentação:';
    $ownerBodyLines[] = 'Nome: ' . $recipientNameLine;
    $ownerBodyLines[] = 'Telemóvel ou Email: ' . $contactLine;
    $ownerBodyLines[] = 'Congregação: ' . $congregationLine;
    if ($showCongregationGiftLine) {
        $ownerBodyLines[] = 'Oferta à congregação: ' . $congregationGiftLine;
    }
}
$ownerBodyLines = array_merge($ownerBodyLines, array(
    '',
    'Dados de contacto:',
    'Nome: ' . $customerNameLine,
    'Contacto: ' . $customerContactLine,
    'NIF: ' . $customerNifLine,
    'Cópia para cliente: ' . ($sendCopy ? $copyEmail : 'Não'),
    '',
    'Enviado pelo formulário de miaandpaper.com',
));

if ($isCadernos) {
    $ownerBodyLines = array(
        'Novo pedido de ' . $productName,
        '',
        'Produto: ' . $productName,
        'Capa escolhida: ' . $coverLineOwner,
        'Acabamento da Capa: ' . $laminationLabel,
        'Opção escolhida: ' . $purchaseOptionLabel,
        'Quantidade: ' . $cadernoOrderQuantity . ' x ' . $purchaseOptionLabel,
        'Preço base: ' . $basePriceLine,
        'Inclui: ' . $purchaseIncludes,
        'Personalização da capa: ' . $coverPersonalizationLine,
    );

    if ($coverPersonalization === 'yes') {
        $ownerBodyLines[] = 'Nome/frase: ' . $coverPersonalizationText;
        $ownerBodyLines[] = 'Acréscimo: ' . $personalizationExtraLine;
    }

    $ownerBodyLines = array_merge($ownerBodyLines, array(
        'Preço do pedido: ' . $priceLine,
        'Entrega: ' . $deliveryLine,
        'Portes: ' . $deliveryFeeLine,
        $totalEstimateLabel . ': ' . $totalEstimateLine,
    ));

    if ($purchaseIsPack && $packPromoNote !== '') {
        $ownerBodyLines[] = 'Nota do Pack: ' . $packPromoNote;
    }

    $ownerBodyLines = array_merge($ownerBodyLines, array(
        '',
        'Dados de contacto:',
        'Nome: ' . $customerNameLine,
        'Contacto: ' . $customerContactLine,
        'NIF: ' . $customerNifLine,
        'Cópia para cliente: ' . ($sendCopy ? $copyEmail : 'Não'),
        '',
        'Enviado pelo formulário de miaandpaper.com',
    ));
}
$ownerBody = implode("\n", $ownerBodyLines);

$customerBodyLines = array(
    'Olá ' . $customerNameLine . ',',
    '',
    'Obrigada pelo teu pedido. A Mia fala contigo em breve para confirmar os detalhes do pagamento.',
    '',
    'Resumo do pedido',
    'Produto: ' . $productName,
    'Pack: ' . ($hasPackStep ? $packQuantity . ' ' . $unitLabel : 'Não aplicável'),
    'Tamanho: ' . $size,
    'Preço do pedido: ' . $priceLine . (($hasPackStep && $packQuantity > 1 && $unitPriceLine !== '') ? ', ou seja: ' . $unitPriceLine : ''),
    'Entrega: ' . $deliveryLine,
    'Portes: ' . $deliveryFeeLine,
    '',
    'Designs escolhidos:',
    '- ' . implode("\n- ", $designLinesCustomer),
);
if ($hasCardDetailsStep && ($hasAnyCardData || !empty($productConfig['collection']) && $productConfig['collection'] === 'congresso-2026' || !empty($isCongress))) {
    $customerBodyLines[] = '';
    $customerBodyLines[] = 'Dados para o teu Cartão de Apresentação:';
    $customerBodyLines[] = 'Nome: ' . $recipientNameLine;
    $customerBodyLines[] = 'Telemóvel ou Email: ' . $contactLine;
    $customerBodyLines[] = 'Congregação: ' . $congregationLine;
    if ($showCongregationGiftLine) {
        $customerBodyLines[] = 'Pedi ajuda para não escolher designs repetidos: ' . ($congregationGift ? 'Sim' : 'Não');
    }
}
$customerBodyLines = array_merge($customerBodyLines, array(
    '',
    'Dados de contacto:',
    'Nome: ' . $customerNameLine,
    'Contacto: ' . $customerContactLine,
    'NIF: ' . $customerNifLine,
), customer_email_footer_lines());

if ($isCadernos) {
    $customerBodyLines = array(
        'Olá ' . $customerNameLine . ',',
        '',
        'Obrigada pelo teu pedido. A Mia fala contigo em breve para confirmar os detalhes do pagamento.',
        '',
        'Resumo do pedido',
        'Produto: ' . $productName,
        'Capa escolhida: ' . $coverLineCustomer,
        'Acabamento da Capa: ' . $laminationLabel,
        'Opção escolhida: ' . $purchaseOptionLabel,
        'Quantidade: ' . $cadernoOrderQuantity . ' x ' . $purchaseOptionLabel,
        'Preço base: ' . $basePriceLine,
        'Inclui: ' . $purchaseIncludes,
        'Personalização da capa: ' . $coverPersonalizationLine,
    );

    if ($coverPersonalization === 'yes') {
        $customerBodyLines[] = 'Nome/frase: ' . $coverPersonalizationText;
        $customerBodyLines[] = 'Acréscimo: ' . $personalizationExtraLine;
    }

    $customerBodyLines = array_merge($customerBodyLines, array(
        'Preço do pedido: ' . $priceLine,
        'Entrega: ' . $deliveryLine,
        'Portes: ' . $deliveryFeeLine,
        $totalEstimateLabel . ': ' . $totalEstimateLine,
    ));

    if ($purchaseIsPack && $packPromoNote !== '') {
        $customerBodyLines[] = 'Nota do Pack: ' . $packPromoNote;
    }

    $customerBodyLines = array_merge($customerBodyLines, array(
        '',
        'Dados de contacto:',
        'Nome: ' . $customerNameLine,
        'Contacto: ' . $customerContactLine,
        'NIF: ' . $customerNifLine,
    ), customer_email_footer_lines());
}
$customerBody = implode("\n", $customerBodyLines);
$postSuccessCopyToken = post_success_copy_token();
$customerCopySubject = '';

$ownerHeaders = array(
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'From: "Mia & Paper" <' . $from . '>',
    'Reply-To: ' . $replyTo,
    'X-Mailer: PHP/' . phpversion(),
);

$customerHeaders = array(
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'From: "Mia & Paper" <' . $from . '>',
    'Reply-To: "Mia & Paper" <' . $from . '>',
    'X-Mailer: PHP/' . phpversion(),
);

// ORDERS_SQLITE_V1: antes de tentar enviar email, persiste a encomenda em
// SQLite (transação dentro de mp_db_insert_order). Se falhar, NÃO fingimos
// sucesso — mostramos erro claro. A persistência tem prioridade sobre o
// email para garantir que a Mia nunca perde uma encomenda por causa de
// uma falha de SMTP / configuração.
$customerContactTrim = trim($customerContact);
$contactEmail = filter_var($customerContactTrim, FILTER_VALIDATE_EMAIL)
    ? clean_header($customerContactTrim)
    : '';
$contactPhone = $contactEmail === '' ? $customerContactTrim : '';

$subtotalCents = (int)$priceCents;
$shippingEstimateCents = (int)$deliveryFeeCents;
$totalEstimateCents = $subtotalCents + $shippingEstimateCents;

$ipNumber = mp_client_ip();
$paymentDeliveryEligible = payment_delivery_is_eligible(
    $deliveryOption,
    $customerName,
    $customerContactTrim,
    $ipNumber
);
$referrerLine = isset($_SERVER['HTTP_REFERER']) ? (string)$_SERVER['HTTP_REFERER'] : '';
$landingLine = $returnToPath !== '' ? $returnToPath : '';

$rawOrderSnapshot = array(
    'product_slug' => $productSlug,
    'product_name' => $productName,
    'size' => $size,
    'pack_quantity' => $packQuantity,
    'designs' => $designs,
    'design_quantities' => $designQuantities,
    'design_labels' => $designLabels,
    'assorted_designs' => $assortedDesigns,
    'lamination' => $lamination,
    'lamination_label' => $laminationLabel,
    'purchase_option' => $purchaseOption,
    'purchase_option_label' => $purchaseOptionLabel,
    'purchase_includes' => $purchaseIncludes,
    'purchase_is_pack' => $purchaseIsPack,
    'caderno_order_quantity' => $cadernoOrderQuantity,
    'base_price_cents' => $basePriceCents,
    'cover_personalization' => $coverPersonalization,
    'cover_personalization_text' => $coverPersonalizationText,
    'personalization_extra_cents' => $personalizationExtraCents,
    'unit_price_cents' => $unitPriceCents,
    'pack_promo_note' => $packPromoNote,
    'delivery_option' => $deliveryOption,
    'delivery_label' => $deliveryLine,
    'recipient_name' => $recipientName,
    'card_contact' => $contact,
    'congregation' => $congregation,
    'customer_name' => $customerName,
    'customer_contact' => $customerContactTrim,
    'customer_nif' => $customerNif,
    'congregation_gift' => $congregationGift,
    'send_copy' => $sendCopy,
    'copy_email' => $copyEmail,
    'subtotal_cents' => $subtotalCents,
    'shipping_estimate_cents' => $shippingEstimateCents,
    'total_estimate_cents' => $totalEstimateCents,
    'currency' => 'EUR',
);

$orderCode = '';
$orderId = 0;
try {
    $orderCode = mp_db_generate_order_code();
    $customerCopySubject = 'Recebemos o teu pedido (' . $orderCode . ') · Mia & Paper';
    $rawOrderSnapshot['order_code'] = $orderCode;
    $rawOrderSnapshot['post_success_copy_available'] = !$sendCopy;
    $rawOrderSnapshot['post_success_copy_token_hash'] = hash('sha256', $postSuccessCopyToken);
    $rawOrderSnapshot['customer_copy_subject'] = $customerCopySubject;
    $rawOrderSnapshot['customer_copy_body'] = $customerBody;
    $orderId = mp_db_insert_order(array(
        'order_code' => $orderCode,
        'source' => 'site',
        'product_slug' => $productSlug,
        'product_type' => $productSlug,
        'customer_name' => $customerName,
        'customer_contact' => $customerContactTrim,
        'customer_nif' => $customerNif,
        'contact_email' => $contactEmail,
        'contact_phone' => $contactPhone,
        'card_name' => $recipientName,
        'card_contact' => $contact,
        'congregation' => $congregation,
        'delivery_option' => $deliveryOption,
        'delivery_label' => $deliveryLine,
        'subtotal_cents' => $subtotalCents,
        'shipping_estimate_cents' => $shippingEstimateCents,
        'total_estimate_cents' => $totalEstimateCents,
        'currency' => 'EUR',
        'payment_status' => 'unpaid',
        'paid' => 0,
        'fulfillment_status' => 'new',
        'ip_number' => $ipNumber,
        'landing_page' => $landingLine,
        'referrer' => $referrerLine,
        'raw_order_json' => json_encode($rawOrderSnapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ));
    mp_db_log_order_event($orderId, 'created', array('source' => 'site'));
} catch (Exception $e) {
    // SAFE_ERROR_OUTPUT_V1: o detalhe técnico (mensagem PDO, paths, SQL)
    // fica só no error_log. O cliente recebe a mesma mensagem genérica de
    // sempre — sem pistas sobre schema/configuração do servidor.
    @error_log('[miaandpaper] mp_db_insert_order falhou: ' . $e->getMessage());
    // AVISOS_ADMIN_V1: uma encomenda perdida é a falha mais cara do site.
    // O cliente já preencheu tudo e já enviou ficheiros — se não fores
    // avisada, ninguém sabe que aconteceu.
    require_once __DIR__ . '/lib/avisos.php';
    mp_aviso('encomenda_falhou', 'insert', 'URGENTE: uma encomenda não foi guardada', array_merge(
        array(
            'Um cliente carregou em "Enviar Pedido" e a gravação falhou.',
            'Ele viu uma mensagem a pedir para tentar outra vez ou falar pelo Instagram.',
            '',
            'Código que tinha sido reservado: ' . ($orderCode !== '' ? $orderCode : '(nenhum)'),
            'Erro técnico: ' . substr($e->getMessage(), 0, 300),
            '',
            'Se ele tinha enviado ficheiros, estão em private/order-uploads/.',
            '',
        ),
        mp_aviso_contexto()
    ));
    render_page(
        'Não foi possível guardar o teu pedido.',
        'Houve um problema ao guardar o pedido. Tenta de novo daqui a uns minutos ou envia mensagem pelo Instagram, ou pelo <a href="contacto.html">formulário de contacto</a>.',
        'error',
        array(),
        '',
        '',
        true
    );
}

$sent = mail($recipient, $subject, $ownerBody, implode("\r\n", $ownerHeaders), '-f' . $from);

mp_db_log_email(array(
    'order_id' => $orderId,
    'email_type' => 'order_received_owner',
    'recipient' => $recipient,
    'subject' => $subject,
    'success' => $sent ? 1 : 0,
    'error_message' => $sent ? null : 'mail() devolveu false',
));

if (!$sent) {
    // Encomenda já foi gravada — o admin vê-a no painel. Mas avisa o
    // cliente que houve problema no email para tentar contacto alternativo.
    mp_db_log_order_event($orderId, 'email_failed', array('to' => $recipient));
    // Este aviso tenta sair pelo mesmo mail() que acabou de falhar. Vai
    // falhar também na maioria dos casos — mas se a falha for do destinatário
    // e não do servidor, chega. Fica sempre registado no error_log.
    require_once __DIR__ . '/lib/avisos.php';
    mp_aviso('email_falhou', 'encomenda', 'Encomenda guardada, mas o email não saiu', array(
        'A encomenda ' . $orderCode . ' está guardada e aparece em admin-orders.php.',
        'O que falhou foi a notificação por email — o mail() devolveu false.',
        '',
        'Destinatário que falhou: ' . $recipient,
        '',
        'Confirma a encomenda no painel; o cliente foi avisado para te',
        'mandar também mensagem pelo Instagram.',
    ));
    render_page(
        'Pedido guardado mas email falhou.',
        'O pedido (' . $orderCode . ') ficou guardado, mas houve um problema ao enviar a notificação à Mia por email. Por segurança, envia também uma mensagem pelo Instagram a confirmar.',
        'error',
        array('Código da encomenda guardado: ' . $orderCode)
    );
}

if ($sendCopy && $copyEmail !== '') {
    $copySent = mail(
        $copyEmail,
        $customerCopySubject,
        $customerBody,
        implode("\r\n", $customerHeaders),
        '-f' . $from
    );
    mp_db_log_email(array(
        'order_id' => $orderId,
        'email_type' => 'order_copy_customer',
        'recipient' => $copyEmail,
        'subject' => $customerCopySubject,
        'success' => $copySent ? 1 : 0,
        'error_message' => $copySent ? null : 'mail() devolveu false',
    ));
}

$paymentDetails = payment_success_details(
    $totalEstimateCents,
    $customerContactTrim,
    array(array('label' => $productName, 'price_cents' => $subtotalCents)),
    $shippingEstimateCents,
    $paymentDeliveryEligible,
    false,
    $ipNumber
);
if (is_array($paymentDetails)) {
    mp_db_log_order_event($orderId, 'payment_instructions_shown', array(
        'method' => 'mbway',
        'country_code' => $paymentDetails['country_code'],
        'total_cents' => $totalEstimateCents,
    ));
}

render_page(
    is_array($paymentDetails) ? 'Obrigada pela tua encomenda.' : 'Pedido feito com sucesso!',
    is_array($paymentDetails)
        ? 'Vamos começar a prepará-la assim que o pagamento estiver confirmado.'
        : 'O teu pedido foi recebido. A Mia fala contigo em breve para confirmar os detalhes.',
    'success',
    array(),
    $orderCode,
    $customerName,
    false,
    is_array($paymentDetails) ? 'payment' : '',
    !$sendCopy ? array(
        'order_code' => $orderCode,
        'copy_token' => $postSuccessCopyToken,
        'email' => $contactEmail,
    ) : null,
    $paymentDetails
);