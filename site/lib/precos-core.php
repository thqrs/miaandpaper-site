<?php
// PRECOS_CORE_V1
// Funcoes puras de preco e de validacao, partilhadas pelo `send-order.php` (a
// autoridade que cobra) e pelo `precos-api.php` (o editor). Foram extraidas do
// send-order.php sem alterar uma linha de logica: o objectivo e que o editor
// valide com EXACTAMENTE o mesmo codigo que recusa a encomenda no checkout, e
// nao com uma segunda copia que possa divergir.
//
// Nao acrescentar aqui nada que dependa de $_POST, de sessao ou da base de
// dados. Este ficheiro tem de continuar a poder ser incluido por qualquer lado.
//
// O par JS destas funcoes vive em site/js/10-produto-precos.js. Ao mexer numa,
// correr o cross-check (precos.php -> "Verificar todos os precos").

if (!defined('PRECOS_CORE_V1')) {
    define('PRECOS_CORE_V1', true);

// MAIN_V2_PRICING_V3: o catálogo principal aceita três modos de preço.
//
//  - `flat-unit`: o preço por unidade é sempre o mesmo, sem descontos
//    (stickers, marcadores, cadernos anuais).
//  - `pack-combination`: não há descontos intermédios. O preço de N unidades é
//    o da combinação de packs mais barata que dá exactamente N (crachás,
//    ímanes, mini-cadernos). Só se pode encomendar quantidades que os packs
//    consigam somar.
//  - `linear-discount-interpolation`: escada de packs com o desconto a
//    interpolar entre eles. Já não é usado por nenhum produto; fica aceite para
//    não invalidar configurações antigas.
//
// `allowUnitDiscounts` tem de concordar com o modo, para não haver dois
// sinais contraditórios sobre o mesmo produto.
function main_v2_pricing_is_valid($source)
{
    if (!is_array($source) || !isset($source['pricingMode']) || !array_key_exists('allowUnitDiscounts', $source)) {
        return false;
    }

    $mode = (string)$source['pricingMode'];
    $discounts = $source['allowUnitDiscounts'];

    if (isset($source['pricingModeByPriceKey'])) {
        if (!is_array($source['pricingModeByPriceKey'])) {
            return false;
        }
        foreach ($source['pricingModeByPriceKey'] as $keyMode) {
            if (!in_array((string)$keyMode, array('pack-combination', 'tier-unit'), true)) {
                return false;
            }
        }
    }

    if ($mode === 'flat-unit') {
        return $discounts === false;
    }
    if ($mode === 'pack-combination' || $mode === 'linear-discount-interpolation' || $mode === 'tier-unit') {
        return $discounts === true;
    }

    return false;
}

// PRICING_MODE_BY_PRICE_KEY_V1: cada tabela de preços pode ter o seu modo. Nos
// ímanes, os finos vendem-se ao escalão e os de 3 mm continuam a somar packs
// exactos. Tem de dar sempre o mesmo modo que `effectivePricingMode` no app.js.
function main_v2_effective_pricing_mode($product, $priceKey)
{
    if (!is_array($product)) {
        return '';
    }

    $priceKey = (string)$priceKey;
    if ($priceKey !== ''
        && isset($product['pricingModeByPriceKey'][$priceKey])
        && (string)$product['pricingModeByPriceKey'][$priceKey] !== ''
    ) {
        return (string)$product['pricingModeByPriceKey'][$priceKey];
    }

    return isset($product['pricingMode']) ? (string)$product['pricingMode'] : '';
}

// Mesmo fallback que `baseUnitaria()` + `precoDe(..., "flat-unit")` no editor:
// a quantidade mais baixa define o valor unitario, mesmo quando nao existe a
// chave "1" na tabela.
function product_flat_table_price_cents($table, $quantity)
{
    $quantity = (int)$quantity;
    if (!is_array($table) || empty($table) || $quantity <= 0) {
        return 0;
    }
    $lowest = null;
    foreach ($table as $pack => $cents) {
        $pack = (int)$pack;
        if ($pack > 0 && is_numeric($cents) && ($lowest === null || $pack < $lowest)) {
            $lowest = $pack;
        }
    }
    if ($lowest === null) {
        return 0;
    }
    return (int)round(((float)$table[(string)$lowest] / $lowest) * $quantity);
}

// O JSON do produto e a tabela central de preços têm de concordar no modo,
// senão o cliente e o servidor podiam calcular totais diferentes.
function main_v2_pricing_modes_agree($product, $pricingProduct)
{
    if (!is_array($product) || !is_array($pricingProduct)) {
        return false;
    }

    if (!isset($product['pricingMode'], $pricingProduct['pricingMode'])
        || (string)$product['pricingMode'] !== (string)$pricingProduct['pricingMode']
    ) {
        return false;
    }

    $byKey = isset($product['pricingModeByPriceKey']) && is_array($product['pricingModeByPriceKey'])
        ? $product['pricingModeByPriceKey']
        : array();
    $pricingByKey = isset($pricingProduct['pricingModeByPriceKey']) && is_array($pricingProduct['pricingModeByPriceKey'])
        ? $pricingProduct['pricingModeByPriceKey']
        : array();

    ksort($byKey);
    ksort($pricingByKey);

    $quantitySwitch = isset($product['quantityPricingSwitchByPriceKey']) && is_array($product['quantityPricingSwitchByPriceKey'])
        ? $product['quantityPricingSwitchByPriceKey']
        : array();
    $pricingQuantitySwitch = isset($pricingProduct['quantityPricingSwitchByPriceKey']) && is_array($pricingProduct['quantityPricingSwitchByPriceKey'])
        ? $pricingProduct['quantityPricingSwitchByPriceKey']
        : array();

    return array_map('strval', $byKey) === array_map('strval', $pricingByKey)
        && $quantitySwitch == $pricingQuantitySwitch;
}

// PACK_COMBINATION_PRICING_V1: o preco de N e a combinacao de packs mais barata
// que soma EXACTAMENTE N (problema de troco por programacao dinamica). Tem de
// devolver o mesmo que `packCombinationPlan()` em js/10-produto-precos.js,
// incluindo o desempate: packs por ordem crescente e comparacao estrita, para o
// pack mais pequeno ganhar em caso de empate.
function product_pack_combination_plan($table, $quantity, $preferFewerPacks = false)
{
    $quantity = (int)$quantity;
    if (!is_array($table) || empty($table) || $quantity <= 0) {
        return null;
    }

    $packs = array();
    foreach ($table as $packQuantity => $totalCents) {
        $packQuantity = (int)$packQuantity;
        $totalCents = (int)$totalCents;
        if ($packQuantity > 0 && $totalCents > 0) {
            $packs[$packQuantity] = $totalCents;
        }
    }
    if (empty($packs)) {
        return null;
    }
    ksort($packs, SORT_NUMERIC);

    $custo = array(0 => 0);
    $numeroPacks = array(0 => 0);
    $escolha = array(0 => 0);
    for ($n = 1; $n <= $quantity; $n++) {
        $custo[$n] = null;
        $numeroPacks[$n] = null;
        $escolha[$n] = 0;
        foreach ($packs as $packQuantity => $totalCents) {
            if ($packQuantity > $n) {
                break;
            }
            $resto = $custo[$n - $packQuantity];
            if ($resto === null) {
                continue;
            }
            $candidato = $resto + $totalCents;
            $numeroCandidato = $numeroPacks[$n - $packQuantity] + 1;
            if ($custo[$n] === null
                || $candidato < $custo[$n]
                || ($preferFewerPacks && $candidato === $custo[$n] && $numeroCandidato < $numeroPacks[$n])
            ) {
                $custo[$n] = $candidato;
                $numeroPacks[$n] = $numeroCandidato;
                $escolha[$n] = $packQuantity;
            }
        }
    }

    if ($custo[$quantity] === null) {
        return null;
    }

    $partes = array();
    $n = $quantity;
    while ($n > 0 && $escolha[$n] > 0) {
        $p = $escolha[$n];
        $partes[$p] = isset($partes[$p]) ? $partes[$p] + 1 : 1;
        $n -= $p;
    }
    krsort($partes, SORT_NUMERIC);

    return array('cents' => (int)$custo[$quantity], 'parts' => $partes);
}

function product_lowest_tier_quantity($table)
{
    $lowest = 0;
    foreach ((array)$table as $tierQuantity => $totalCents) {
        $tierQuantity = (int)$tierQuantity;
        if ($tierQuantity > 0 && (int)$totalCents > 0 && ($lowest === 0 || $tierQuantity < $lowest)) {
            $lowest = $tierQuantity;
        }
    }
    return $lowest;
}

// TIER_UNIT_PRICING_V1: cada escalão fixa uma percentagem de desconto sobre o
// unitário do escalão mínimo. Acima do mínimo vale qualquer quantidade, e cada
// unidade extra é vendida com o desconto do escalão em vigor — o mesmo que
// `tierPriceCents` faz no app.js.
function product_tier_price_cents($table, $quantity)
{
    if (!is_array($table) || empty($table) || (int)$quantity <= 0) {
        return 0;
    }

    $quantity = (int)$quantity;
    $tiers = array();
    foreach ($table as $tierQuantity => $totalCents) {
        $tierQuantity = (int)$tierQuantity;
        $totalCents = (int)$totalCents;
        if ($tierQuantity > 0 && $totalCents >= 0) {
            $tiers[$tierQuantity] = $totalCents;
        }
    }
    if (empty($tiers)) {
        return 0;
    }
    ksort($tiers, SORT_NUMERIC);
    if (isset($tiers[$quantity])) {
        return $tiers[$quantity];
    }

    $selectedQuantity = 0;
    $selectedTotal = 0;
    foreach ($tiers as $tierQuantity => $totalCents) {
        if ($tierQuantity <= $quantity || $selectedQuantity === 0) {
            $selectedQuantity = $tierQuantity;
            $selectedTotal = $totalCents;
        }
        if ($tierQuantity > $quantity) {
            break;
        }
    }

    // A ordem das operacoes tem de ser a mesma do tierPriceCents() em app.js:
    // multiplicar primeiro (produto exacto em inteiros) e so depois dividir.
    // Dividir primeiro introduz erro de virgula flutuante e faz o servidor
    // cobrar menos 1 centimo do que a pagina mostrou — por exemplo 54 unidades
    // sobre um escalao de 48 -> 14500: 54 * (14500/48) da 16312.499999999998
    // e arredonda para 16312, enquanto 54 * 14500 / 48 da 16312.5 -> 16313.
    return $selectedQuantity > 0
        ? (int)round($quantity * $selectedTotal / $selectedQuantity)
        : 0;
}

}
