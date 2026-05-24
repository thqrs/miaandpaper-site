<?php

// ORDERS_SQLITE_V1: a camada de persistência foi adicionada nesta fase.
// O ficheiro lib/db.php é carregado tolerantemente — se SQLite não estiver
// disponível, o site continua a enviar pedidos por email (comportamento
// antigo), mas mp_db() lança e tratamos isso explicitamente no fluxo.
require_once __DIR__ . '/lib/private-paths.php';
require_once __DIR__ . '/lib/db.php';

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
    $allowed = array('index.html', 'crachas.html', 'pins.html', 'cadernos.html', 'caderninhos.html', 'imanes.html', 'lembrancas.html', 'adicionar-produto.html', 'checkout.html');

    if (in_array($returnTo, $allowed, true)) {
        return $returnTo;
    }

    return 'index.html';
}

function safe_product_slug()
{
    $slug = strtolower(field('product_slug'));
    $allowed = array('crachas', 'pins', 'cadernos', 'caderninhos', 'imanes', 'lembrancas');

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
    $path = __DIR__ . '/content/products/' . $slug . '.json';

    if (!is_file($path)) {
        return array();
    }

    $data = json_decode(file_get_contents($path), true);

    return is_array($data) ? $data : array();
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
    $path = __DIR__ . '/content/pricing.json';
    $prices = array();

    if (!is_file($path)) {
        return array();
    }

    $data = json_decode(file_get_contents($path), true);
    if (empty($data['products'][$slug]['prices']) || !is_array($data['products'][$slug]['prices'])) {
        return array();
    }

    foreach ($data['products'][$slug]['prices'] as $size => $packs) {
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

function product_delivery_options($product, $fallback)
{
    $options = array();

    if (!empty($product['deliveryOptions']) && is_array($product['deliveryOptions'])) {
        foreach ($product['deliveryOptions'] as $option) {
            if (empty($option['id']) || empty($option['label'])) {
                continue;
            }

            $label = (string)$option['label'];
            $text = isset($option['text']) ? trim((string)$option['text']) : '';

            $priceText = isset($option['priceText']) ? trim((string)$option['priceText']) : '';
            $options[(string)$option['id']] = array(
                'label' => $text !== '' ? $label . ' - ' . $text : $label,
                'fee_cents' => isset($option['feeCents']) ? (int)$option['feeCents'] : 0,
                'price_text' => $priceText,
            );
        }
    }

    return !empty($options) ? $options : $fallback;
}

function cart_allowed_product_slug($slug)
{
    $slug = strtolower(trim((string)$slug));
    $allowed = array('crachas', 'pins', 'cadernos', 'caderninhos', 'imanes', 'lembrancas');

    return in_array($slug, $allowed, true) ? $slug : '';
}

function cart_text($value)
{
    return trim((string)$value);
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

function cart_valid_contact($value)
{
    $value = trim((string)$value);

    if ($value === '') {
        return false;
    }

    if (filter_var($value, FILTER_VALIDATE_EMAIL)) {
        return true;
    }

    $clean = preg_replace('/[\s-]+/', '', $value);
    return (bool)preg_match('/^(?:\+?[0-9]{1,3})?[0-9]{9,12}$/', $clean);
}

function cart_prepare_item($item, $defaultPackPrices, $defaultAllowedDesigns)
{
    $errors = array();
    $slug = isset($item['productSlug']) ? cart_allowed_product_slug($item['productSlug']) : '';
    $productConfig = $slug !== '' ? load_product_config($slug) : array();
    $productName = isset($productConfig['name']) ? trim((string)$productConfig['name']) : '';
    $selections = isset($item['selections']) && is_array($item['selections']) ? $item['selections'] : array();
    $isCadernos = $slug === 'cadernos';

    if ($slug === '' || empty($productConfig)) {
        return array('errors' => array('Um dos produtos do carrinho não é válido.'));
    }

    if ($productName === '') {
        $productName = isset($item['productName']) ? cart_text($item['productName']) : $slug;
    }

    $centralPackPrices = load_pricing_prices($slug);
    $packPrices = !empty($centralPackPrices) ? $centralPackPrices : product_prices($productConfig, empty($productConfig) ? $defaultPackPrices : array());
    $allowedDesigns = product_design_values($productConfig, $defaultAllowedDesigns);
    $hasPackStep = !empty(product_step($productConfig, 'pack'));
    $hasPrices = !empty($packPrices);

    $size = cart_string_selection($selections, 'size');
    $packQuantity = (int)cart_selection($selections, 'pack_quantity', 0);
    $designs = cart_list_selection($selections, 'designs');
    $designQuantities = cart_assoc_int_selection($selections, 'design_quantities');
    $designLabels = cart_assoc_text_selection($selections, 'design_labels');
    $assortedDesigns = cart_bool(cart_selection($selections, 'assorted_designs', false)) || in_array('__sortido__', $designs, true);
    $recipientName = cart_string_selection($selections, 'recipient_name');
    $contact = cart_string_selection($selections, 'contact');
    $congregation = cart_string_selection($selections, 'congregation');
    $congregationGift = cart_bool(cart_selection($selections, 'congregation_gift', false));

    $lamination = cart_string_selection($selections, 'lamination');
    $coverPersonalization = cart_string_selection($selections, 'cover_personalization');
    $coverPersonalizationText = cart_string_selection($selections, 'cover_personalization_text');
    $laminationStep = product_step($productConfig, 'lamination');
    $purchaseStep = product_step($productConfig, 'pack');
    $personalizationStep = product_step($productConfig, 'cover_personalization');
    $laminationItem = $isCadernos ? product_step_item_by_value($laminationStep, $lamination) : array();
    $purchaseItem = $isCadernos ? product_step_item_by_quantity($purchaseStep, $packQuantity) : array();
    $cadernoOrderQuantityOptions = $isCadernos ? product_order_quantity_options($purchaseStep) : array(1);
    $cadernoOrderQuantity = $isCadernos ? (int)cart_selection($selections, 'caderno_order_quantity', 1) : 1;

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
    $showCongregationGiftLine = !$isCadernos && !$assortedDesigns && !$allDesignsSelected;
    if (!$showCongregationGiftLine) {
        $congregationGift = false;
    }

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
        $errors[] = 'Escolhe um tamanho válido para ' . $productName . '.';
    }

    if ($hasPackStep && $packQuantity <= 0) {
        $errors[] = $isCadernos ? 'Escolhe uma opção de compra para ' . $productName . '.' : 'Escolhe um pack para ' . $productName . '.';
    } elseif ($hasPrices && $hasPackStep && (!isset($packPrices[$size]) || !isset($packPrices[$size][$packQuantity]))) {
        $errors[] = $isCadernos ? 'Escolhe uma opção de compra válida para ' . $productName . '.' : 'Escolhe um pack válido para ' . $productName . '.';
    }

    if (empty($designs) && !$assortedDesigns) {
        $errors[] = $isCadernos ? 'Escolhe uma capa para ' . $productName . '.' : 'Escolhe pelo menos um design para ' . $productName . '.';
    } elseif (!$assortedDesigns) {
        foreach ($designs as $design) {
            if (!in_array($design, $allowedDesigns, true)) {
                $errors[] = 'Um dos designs escolhidos em ' . $productName . ' não é válido.';
                break;
            }
        }
    }

    if ($isCadernos) {
        if (!empty($designs) && count($uniqueDesigns) !== 1) {
            $errors[] = 'Escolhe uma capa para ' . $productName . '.';
        }

        if (empty($laminationItem)) {
            $errors[] = 'Escolhe um tipo de laminação válido para ' . $productName . '.';
        }

        if (empty($purchaseItem)) {
            $errors[] = 'Escolhe uma opção de compra válida para ' . $productName . '.';
        }

        if (!in_array($cadernoOrderQuantity, $cadernoOrderQuantityOptions, true)) {
            $errors[] = 'Escolhe uma quantidade válida para ' . $productName . '.';
        }

        if ($coverPersonalization !== 'yes' && $coverPersonalization !== 'no') {
            $errors[] = 'Escolhe se queres personalizar a capa de ' . $productName . '.';
        }

        if ($coverPersonalization === 'yes') {
            $personalizationLimit = isset($personalizationStep['maxLength']) ? (int)$personalizationStep['maxLength'] : 25;
            $personalizationLength = function_exists('mb_strlen')
                ? mb_strlen($coverPersonalizationText, 'UTF-8')
                : strlen($coverPersonalizationText);

            if ($coverPersonalizationText === '') {
                $errors[] = 'Escreve o nome/frase para a capa de ' . $productName . '.';
            } elseif ($personalizationLength > $personalizationLimit) {
                $errors[] = 'O nome/frase da capa de ' . $productName . ' tem de ter no máximo ' . $personalizationLimit . ' caracteres.';
            }
        } else {
            $coverPersonalizationText = '';
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

    if (!empty($errors)) {
        return array('errors' => $errors);
    }

    $unitLabel = isset($productConfig['unitLabel']) && trim((string)$productConfig['unitLabel']) !== '' ? trim((string)$productConfig['unitLabel']) : (($slug === 'crachas' || $slug === 'pins') ? 'crachás' : 'unidades');
    $unitShort = isset($productConfig['unitShort']) && trim((string)$productConfig['unitShort']) !== '' ? trim((string)$productConfig['unitShort']) : (($slug === 'crachas' || $slug === 'pins') ? 'crachá' : 'unid.');
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

    $basePriceLine = $basePriceCents
        ? ($isCadernos && $cadernoOrderQuantity > 1 ? format_euros($basePriceCents) . ' x ' . $cadernoOrderQuantity . ' = ' . format_euros($basePriceCents * $cadernoOrderQuantity) : format_euros($basePriceCents))
        : 'Não calculado';
    $personalizationExtraLine = $personalizationExtraCents
        ? ($isCadernos && $cadernoOrderQuantity > 1 ? format_euros($personalizationExtraCents) . ' x ' . $cadernoOrderQuantity . ' = ' . format_euros($personalizationExtraCents * $cadernoOrderQuantity) : format_euros($personalizationExtraCents))
        : '';

    return array(
        'errors' => array(),
        'product_slug' => $slug,
        'product_name' => $productName,
        'is_cadernos' => $isCadernos,
        'size' => $size,
        'pack_quantity' => $packQuantity,
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
        'show_congregation_gift_line' => $showCongregationGiftLine,
        'lamination' => $lamination,
        'lamination_label' => $laminationLabel,
        'purchase_option' => $purchaseOption,
        'purchase_option_label' => $purchaseOptionLabel,
        'purchase_includes' => $purchaseIncludes,
        'purchase_is_pack' => $purchaseIsPack,
        'caderno_order_quantity' => $cadernoOrderQuantity,
        'base_price_cents' => $basePriceCents,
        'base_price_line' => $basePriceLine,
        'cover_line_owner' => $coverLineOwner,
        'cover_line_customer' => $coverLineCustomer,
        'cover_personalization' => $coverPersonalization,
        'cover_personalization_text' => $coverPersonalizationText,
        'cover_personalization_line' => $coverPersonalization === 'yes' ? 'Sim' : 'Não',
        'personalization_extra_cents' => $personalizationExtraCents,
        'personalization_extra_line' => $personalizationExtraLine,
        'unit_price_cents' => $unitPriceCents,
        'price_cents' => $priceCents,
        'price_line' => $priceLine,
        'unit_price_line' => $unitPriceLine,
        'pack_promo_note' => $packPromoNote,
        'raw_selections' => $selections,
    );
}

function cart_item_owner_lines($line)
{
    $rows = array();

    if (!empty($line['is_cadernos'])) {
        $rows[] = 'Produto: ' . $line['product_name'];
        $rows[] = 'Capa escolhida: ' . $line['cover_line_owner'];
        $rows[] = 'Laminação escolhida: ' . $line['lamination_label'];
        $rows[] = 'Opção escolhida: ' . $line['purchase_option_label'];
        $rows[] = 'Quantidade: ' . $line['caderno_order_quantity'] . ' x ' . $line['purchase_option_label'];
        $rows[] = 'Preço base: ' . $line['base_price_line'];
        $rows[] = 'Inclui: ' . $line['purchase_includes'];
        $rows[] = 'Personalização da capa: ' . $line['cover_personalization_line'];
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
    $rows[] = 'Pack: ' . $line['pack_quantity'] . ' ' . $line['unit_label'];
    $rows[] = 'Tamanho: ' . $line['size'];
    $rows[] = 'Preço do produto: ' . $line['price_line'] . ($line['unit_price_line'] !== '' ? ' (' . $line['unit_price_line'] . ')' : '');
    $rows[] = '';
    $rows[] = 'Designs e quantidades:';
    $rows[] = '- ' . implode("\n- ", $line['design_lines_owner']);
    $rows[] = '';
    $rows[] = 'Dados para cartão de apresentação:';
    $rows[] = 'Nome: ' . ($line['recipient_name'] !== '' ? $line['recipient_name'] : 'Não indicado');
    $rows[] = 'Telemóvel ou Email: ' . ($line['card_contact'] !== '' ? $line['card_contact'] : 'Não indicado');
    $rows[] = 'Congregação: ' . ($line['congregation'] !== '' ? $line['congregation'] : 'Não indicado');
    if (!empty($line['show_congregation_gift_line'])) {
        $rows[] = 'Oferta à congregação: ' . ($line['congregation_gift'] ? 'Sim - pediu ajuda para escolher designs únicos para a congregação.' : 'Não');
    }

    return $rows;
}

function cart_item_customer_lines($line)
{
    $rows = array();

    if (!empty($line['is_cadernos'])) {
        $rows[] = 'Produto: ' . $line['product_name'];
        $rows[] = 'Capa escolhida: ' . $line['cover_line_customer'];
        $rows[] = 'Laminação escolhida: ' . $line['lamination_label'];
        $rows[] = 'Opção escolhida: ' . $line['purchase_option_label'];
        $rows[] = 'Quantidade: ' . $line['caderno_order_quantity'] . ' x ' . $line['purchase_option_label'];
        $rows[] = 'Preço base: ' . $line['base_price_line'];
        $rows[] = 'Inclui: ' . $line['purchase_includes'];
        $rows[] = 'Personalização da capa: ' . $line['cover_personalization_line'];
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
    $rows[] = 'Pack: ' . $line['pack_quantity'] . ' ' . $line['unit_label'];
    $rows[] = 'Tamanho: ' . $line['size'];
    $rows[] = 'Preço do produto: ' . $line['price_line'] . ($line['unit_price_line'] !== '' ? ', ou seja: ' . $line['unit_price_line'] : '');
    $rows[] = '';
    $rows[] = 'Designs escolhidos:';
    $rows[] = '- ' . implode("\n- ", $line['design_lines_customer']);
    $rows[] = '';
    $rows[] = 'Dados que vão ser usados para preencher o Cartão de Apresentação:';
    $rows[] = 'Nome: ' . ($line['recipient_name'] !== '' ? $line['recipient_name'] : 'Não indicado');
    $rows[] = 'Telemóvel ou Email: ' . ($line['card_contact'] !== '' ? $line['card_contact'] : 'Não indicado');
    $rows[] = 'Congregação: ' . ($line['congregation'] !== '' ? $line['congregation'] : 'Não indicado');
    if (!empty($line['show_congregation_gift_line'])) {
        $rows[] = 'Pedi ajuda para não escolher designs repetidos: ' . ($line['congregation_gift'] ? 'Sim' : 'Não');
    }

    return $rows;
}

function customer_email_footer_lines()
{
    return array(
        '',
        'Precisas de fazer alguma alteração à tua encomenda ou tens alguma dúvida?',
        'Não respondas a este email, porque esta caixa não é monitorizada.',
        'Usa o nosso formulário de contacto:',
        'contacto.html',
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
    $path = __DIR__ . '/content/home.json';

    if (!is_file($path)) {
        return array();
    }

    $data = json_decode(file_get_contents($path), true);

    return is_array($data) ? $data : array();
}

// RESULT_CATEGORIES_CAROUSEL_V1: a página após envio usa os mesmos
// carrosséis dos cartões da homepage. O home.json não guarda
// carouselImages; o frontend carrega-as a partir do primeiro passo de cada
// produto. Aqui fazemos o mesmo em PHP para que a página de sucesso não
// volte aos cartões antigos.
function result_slug_from_href($href)
{
    $clean = preg_split('/[?#]/', (string)$href);
    $clean = isset($clean[0]) ? $clean[0] : '';

    if (preg_match('/([^\/]+)\.html$/i', $clean, $matches)) {
        return strtolower($matches[1]);
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

function render_page($title, $message, $kind, $details, $orderCode = '', $customerName = '', $messageHtml = false, $successMode = '', $postSuccessCopy = null)
{
    global $returnToPath, $productSlug;

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
  <link rel="stylesheet" href="styles.css?v=20260514153000">
</head>
<body class="result-body">
  <main class="result-card <?php echo h($kind); ?>">
    <a class="brand" href="index.html" aria-label="Mia & Paper">
      <span class="brand-mark"><img src="content/brand/logo.jpg" alt=""></span>
      <span>Mia &amp; Paper</span>
    </a>

    <div>
      <p class="eyebrow"><?php echo $kind === 'success' ? 'Pedido enviado' : 'Pedido não enviado'; ?></p>
      <h1><?php echo h($title); ?></h1>
      <p class="lead"><?php echo $messageHtml ? $message : h($message); ?></p>
    </div>

    <?php if ($kind === 'success' && $orderCode !== '') : ?>
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
      <?php render_result_categories(); ?>
      <p class="open-order-hint home-unavailable-message" role="status" aria-live="polite" data-home-unavailable-inline hidden></p>
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
      <?php if ($successMode !== 'cart' && $successMode !== 'copy') : ?>
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
  <?php if ($kind === 'success' && $successMode === 'cart') : ?>
    <script>
      try {
        window.localStorage.removeItem('miaandpaper_cart_v1');
        window.sessionStorage.removeItem('miaandpaper_checkout_session');
      } catch (error) {}
    </script>
  <?php endif; ?>
</body>
</html>
    <?php
    exit;
}

function process_cart_order($recipient, $from, $defaultPackPrices, $defaultAllowedDesigns, $defaultDeliveryOptions)
{
    global $returnToPath;

    $rawJson = field('cart_json');
    $payload = json_decode($rawJson, true);
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

    if (empty($items)) {
        $errors[] = 'O carrinho está vazio.';
    }

    $customerName = cart_text(isset($checkout['customer_name']) ? $checkout['customer_name'] : '');
    $customerContact = cart_text(isset($checkout['customer_contact']) ? $checkout['customer_contact'] : '');
    $customerCongregation = '';
    $deliveryOption = cart_text(isset($checkout['delivery_option']) ? $checkout['delivery_option'] : '');
    $sendCopy = !empty($checkout['send_copy']);
    $copyEmail = $sendCopy ? clean_header(isset($checkout['copy_email']) ? $checkout['copy_email'] : '') : '';

    if (strlen($customerName) < 2 || strlen($customerName) > 120) {
        $errors[] = 'Indica o teu nome nos dados de contacto.';
    }

    if (strlen($customerContact) < 3 || strlen($customerContact) > 160 || !cart_valid_contact($customerContact)) {
        $errors[] = 'Indica um email ou telemóvel válido para contacto.';
    }

    $allowedDeliveryOptions = product_delivery_options(array(), $defaultDeliveryOptions);
    if (!array_key_exists($deliveryOption, $allowedDeliveryOptions)) {
        $errors[] = 'Escolhe a opção de entrega.';
    }

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

    if (!empty($errors)) {
        render_page(
            'Confirma os dados.',
            'Alguns campos precisam de ser corrigidos antes de enviar.',
            'error',
            $errors
        );
    }

    $delivery = isset($allowedDeliveryOptions[$deliveryOption]) ? $allowedDeliveryOptions[$deliveryOption] : null;
    $deliveryLine = $delivery ? $delivery['label'] : 'Não indicado';
    $deliveryFeeCents = $delivery ? (int)$delivery['fee_cents'] : 0;
    $deliveryFeeLine = ($delivery && !empty($delivery['price_text'])) ? $delivery['price_text'] : format_euros($deliveryFeeCents);
    $subtotalCents = 0;
    foreach ($preparedItems as $line) {
        $subtotalCents += (int)$line['price_cents'];
    }
    $totalEstimateCents = $subtotalCents + $deliveryFeeCents;
    $totalEstimateLabel = $deliveryFeeCents > 0 ? 'Total estimado' : 'Total';

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
        'Total dos produtos: ' . format_euros($subtotalCents),
        'Entrega: ' . $deliveryLine,
        'Portes: ' . $deliveryFeeLine,
        $totalEstimateLabel . ': ' . format_euros($totalEstimateCents),
        '',
        'Dados de contacto:',
        'Nome: ' . $customerName,
        'Email ou telemóvel: ' . $customerContactTrim,
        'Cópia para cliente: ' . ($sendCopy ? $copyEmail : 'Não'),
        '',
        'Produtos:',
    );

    $customerBodyLines = array(
        'Olá ' . $customerName . ',',
        '',
        'Obrigada pelo teu pedido. Em breve a Mia vai entrar em contacto contigo com os detalhes do pagamento.',
        '',
        'Resumo do pedido',
        'Produtos: ' . count($preparedItems),
        'Total dos produtos: ' . format_euros($subtotalCents),
        'Entrega: ' . $deliveryLine,
        'Portes: ' . $deliveryFeeLine,
        $totalEstimateLabel . ': ' . format_euros($totalEstimateCents),
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
        'Email ou telemóvel: ' . $customerContactTrim,
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

    $ipNumber = isset($_SERVER['REMOTE_ADDR']) ? (string)$_SERVER['REMOTE_ADDR'] : '';
    $referrerLine = isset($_SERVER['HTTP_REFERER']) ? (string)$_SERVER['HTTP_REFERER'] : '';
    $landingLine = $returnToPath !== '' ? $returnToPath : 'checkout.html';
    $firstProductSlug = isset($preparedItems[0]['product_slug']) ? $preparedItems[0]['product_slug'] : 'cart';

    $rawOrderSnapshot = array(
        'order_mode' => 'cart',
        'schema_version' => $schemaVersion,
        'cart_id' => $cartId,
        'items' => $preparedItems,
        'checkout' => array(
            'customer_name' => $customerName,
            'customer_contact' => $customerContactTrim,
            'delivery_option' => $deliveryOption,
            'delivery_label' => $deliveryLine,
            'send_copy' => $sendCopy,
            'copy_email' => $copyEmail,
        ),
        'subtotal_cents' => $subtotalCents,
        'shipping_estimate_cents' => $deliveryFeeCents,
        'total_estimate_cents' => $totalEstimateCents,
        'currency' => 'EUR',
    );

    $orderCode = '';
    $orderId = 0;
    try {
        $orderCode = mp_db_generate_order_code();
        $customerCopySubject = 'Recebemos o teu pedido (' . $orderCode . ') - Mia & Paper';
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
        mp_db_log_order_event($orderId, 'created', array('source' => 'site_cart'));
    } catch (Exception $e) {
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

    render_page(
        'Pedido feito com sucesso!',
        'O teu pedido foi recebido. A Mia vai entrar em contacto contigo com os próximos passos.',
        'success',
        array(),
        $orderCode,
        $customerName,
        false,
        'cart',
        !$sendCopy ? array(
            'order_code' => $orderCode,
            'copy_token' => $postSuccessCopyToken,
            'email' => $contactEmail,
        ) : null
    );
}

$returnToPath = safe_return_to();
$productSlug = safe_product_slug();

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
    render_page(
        'Falta configurar o envio.',
        'O formulário está pronto, mas falta criar o ficheiro privado de configuração.',
        'error',
        array(
            'Cria o ficheiro: ' . $configPath,
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
        'fee_cents' => 850,
        'price_text' => "Valor mínimo:\n8,50 €",
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
$showCongregationGiftLine = !$isCadernos && !$assortedDesigns && !$allDesignsSelected;
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
        $errors[] = 'Escolhe um tipo de laminação válido.';
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

if (strlen($customerContact) < 3 || strlen($customerContact) > 160) {
    $errors[] = 'Indica um email ou telemóvel para contacto.';
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
    'Dados para cartão de apresentação:',
    'Nome: ' . $recipientNameLine,
    'Telemóvel ou Email: ' . $contactLine,
    'Congregação: ' . $congregationLine,
);
if ($showCongregationGiftLine) {
    $ownerBodyLines[] = 'Oferta à congregação: ' . $congregationGiftLine;
}
$ownerBodyLines = array_merge($ownerBodyLines, array(
    '',
    'Dados de contacto:',
    'Nome: ' . $customerNameLine,
    'Email ou telemóvel: ' . $customerContactLine,
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
        'Laminação escolhida: ' . $laminationLabel,
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
        'Email ou telemóvel: ' . $customerContactLine,
        'Cópia para cliente: ' . ($sendCopy ? $copyEmail : 'Não'),
        '',
        'Enviado pelo formulário de miaandpaper.com',
    ));
}
$ownerBody = implode("\n", $ownerBodyLines);

$customerBodyLines = array(
    'Olá ' . $customerNameLine . ',',
    '',
    'Obrigada pelo teu pedido. Em breve a Mia vai entrar em contacto contigo com os detalhes do pagamento.',
    '',
    'Resumo do pedido',
    'Produto: ' . $productName,
    'Pack: ' . ($hasPackStep ? $packQuantity . ' ' . $unitLabel : 'Não aplicável'),
    'Tamanho: ' . $size,
    'Preço do pedido: ' . $priceLine . ($unitPriceLine !== '' ? ', ou seja: ' . $unitPriceLine : ''),
    'Entrega: ' . $deliveryLine,
    'Portes: ' . $deliveryFeeLine,
    '',
    'Designs escolhidos:',
    '- ' . implode("\n- ", $designLinesCustomer),
    '',
    'Dados que vão ser usados para preencher o Cartão de Apresentação:',
    'Nome: ' . $recipientNameLine,
    'Telemóvel ou Email: ' . $contactLine,
    'Congregação: ' . $congregationLine,
);
if ($showCongregationGiftLine) {
    $customerBodyLines[] = 'Pedi ajuda para não escolher designs repetidos: ' . ($congregationGift ? 'Sim' : 'Não');
}
$customerBodyLines = array_merge($customerBodyLines, array(
    '',
    'Dados de contacto:',
    'Nome: ' . $customerNameLine,
    'Email ou telemóvel: ' . $customerContactLine,
), customer_email_footer_lines());

if ($isCadernos) {
    $customerBodyLines = array(
        'Olá ' . $customerNameLine . ',',
        '',
        'Obrigada pelo teu pedido. Em breve a Mia vai entrar em contacto contigo com os detalhes do pagamento.',
        '',
        'Resumo do pedido',
        'Produto: ' . $productName,
        'Capa escolhida: ' . $coverLineCustomer,
        'Laminação escolhida: ' . $laminationLabel,
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
        'Email ou telemóvel: ' . $customerContactLine,
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

$ipNumber = isset($_SERVER['REMOTE_ADDR']) ? (string)$_SERVER['REMOTE_ADDR'] : '';
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
    $customerCopySubject = 'Recebemos o teu pedido (' . $orderCode . ') - Mia & Paper';
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

render_page(
    'Pedido feito com sucesso!',
    'O teu pedido foi recebido. A Mia vai entrar em contacto contigo com os próximos passos.',
    'success',
    array(),
    $orderCode,
    $customerName,
    false,
    '',
    !$sendCopy ? array(
        'order_code' => $orderCode,
        'copy_token' => $postSuccessCopyToken,
        'email' => $contactEmail,
    ) : null
);
