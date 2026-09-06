<?php
/** Apresentação do tracking: metadados actuais do catálogo, sem alterar eventos. */
function fv_catalogue() {
    static $catalogue;
    if ($catalogue !== null) return $catalogue;
    $catalogue = array();
    foreach (array('loja'=>'/content/products/', 'congresso-2026'=>'/congressos/2026/content/products/') as $context=>$folder) {
        foreach (glob(__DIR__ . '/..' . $folder . '*.json') as $file) {
            $data=json_decode(file_get_contents($file),true);
            if (!is_array($data) || empty($data['slug'])) continue;
            $catalogue[$context . '|' . $data['slug']] = array('name'=>$data['name'] ?? $data['slug'], 'file'=>$file, 'context'=>$context);
        }
    }
    return $catalogue;
}
function fv_snapshot($event) {
    $value=$event['selection_snapshot'] ?? $event['selection_json'] ?? array();
    if (is_string($value)) $value=json_decode($value,true);
    return is_array($value) ? $value : array();
}
function fv_context($event) {
    $snap=fv_snapshot($event);
    $context=$event['product_context'] ?? $event['catalog_context'] ?? $snap['product_context'] ?? '';
    if (strpos((string)$context,'congress') !== false) return 'congresso-2026';
    if ($context !== '') return 'loja';
    // landing_page é a página do evento; first_landing_page é a origem da sessão.
    $page=$event['landing_page'] ?? '';
    if (strpos((string)$page,'/congressos/2026/') !== false) return 'congresso-2026';
    $catalogue=fv_catalogue(); $slug=$event['product_slug'] ?? '';
    return !isset($catalogue['loja|'.$slug]) && isset($catalogue['congresso-2026|'.$slug]) ? 'congresso-2026' : 'loja';
}
function fv_product($event) {
    static $loaded=array();
    $key=fv_context($event).'|'.($event['product_slug'] ?? '');
    if (isset($loaded[$key])) return $loaded[$key];
    $catalogue=fv_catalogue();
    if (!isset($catalogue[$key])) return array();
    $data=json_decode(file_get_contents($catalogue[$key]['file']),true);
    return $loaded[$key]=is_array($data) ? $data : array();
}
function fv_image($source, $context) {
    if (!is_string($source) || $source === '') return '';
    // Apenas imagens WebP públicas existentes neste site. Nunca URLs externos,
    // endpoints PHP, uploads privados, data URLs ou caminhos fora da raiz.
    $url=parse_url($source);
    if ($url === false || isset($url['user']) || isset($url['pass'])) return '';
    if (isset($url['host']) && !in_array(strtolower($url['host']), array('miaandpaper.com','www.miaandpaper.com'),true)) return '';
    if (isset($url['scheme']) && !in_array($url['scheme'],array('http','https'),true)) return '';
    $path=rawurldecode($url['path'] ?? '');
    if (strpos($path,"\0") !== false || strpos($path,'\\') !== false || preg_match('#(^|/)\.\.?(/|$)#',$path)) return '';
    $relative=ltrim($path,'/');
    $candidates=array();
    if ($path !== '' && $path[0] !== '/' && !isset($url['host']) && $context==='congresso-2026') $candidates[]='congressos/2026/'.$relative;
    $candidates[]=$relative;
    $root=realpath(__DIR__.'/..');
    foreach ($candidates as $candidate) {
        if (!preg_match('#^(?:congressos/2026/)?content/.*\.webp$#i',$candidate)) continue;
        $resolved=realpath($root.'/'.$candidate);
        if (!$resolved || strpos($resolved,$root.DIRECTORY_SEPARATOR)!==0 || !is_file($resolved)) continue;
        return '/' . implode('/',array_map('rawurlencode',explode('/',$candidate)));
    }
    return '';
}
function fv_find_item($node, $values) {
    if (!is_array($node)) return array();
    foreach (array('value','id','title') as $key) {
        if (isset($node[$key]) && is_scalar($node[$key]) && in_array((string)$node[$key],$values,true)) return $node;
    }
    foreach ($node as $value) {
        if (is_array($value)) { $found=fv_find_item($value,$values); if ($found) return $found; }
    }
    return array();
}
function fv_present_event($event) {
    $product=fv_product($event); $context=fv_context($event); $steps=array();
    foreach ($product['steps'] ?? array() as $step) $steps[$step['id']]=$step;
    $stepId=(string)($event['step_id'] ?? '');
    $ids=array_filter(array($event['design_id'] ?? '',$event['item_id'] ?? '',$event['design_title'] ?? '',$event['target_id'] ?? '',$event['target_label'] ?? ''), function($value) { return is_string($value) && $value !== ''; });
    $item=$ids ? fv_find_item($steps[$stepId]['items'] ?? $steps['designs']['items'] ?? array(),array_values($ids)) : array();
    $image=fv_image($event['image_src'] ?? '',$context);
    if ($image==='') $image=fv_image($item['image'] ?? '',$context);
    $option=fv_find_item($steps[$stepId] ?? $product['steps'] ?? array(), array((string)($event['option_value'] ?? '\0')));
    $snap=fv_snapshot($event); $choices=array();
    foreach (array_slice((array)($snap['selected_designs'] ?? array()),0,12) as $id) {
        if (!is_scalar($id)) continue;
        $design=fv_find_item($steps['designs']['items'] ?? array(),array((string)$id));
        $choices[]=array('name'=>$design['title'] ?? (string)$id,'image'=>fv_image($design['image'] ?? '',$context));
    }
    $event['_view']=array(
        'product'=>$product['name'] ?? ($event['product_slug'] ?? ''),
        'context'=>$context==='congresso-2026'?'Congresso 2026':'Loja',
        'key'=>$context.'|'.($event['product_slug'] ?? ''),
        'step'=>$steps[$stepId]['title'] ?? '',
        'fromStep'=>$steps[$event['from_step'] ?? '']['title'] ?? '',
        'toStep'=>$steps[$event['to_step'] ?? '']['title'] ?? '',
        'design'=>$event['design_title'] ?? $item['title'] ?? $event['target_label'] ?? $event['design_id'] ?? '',
        'image'=>$image,
        'option'=>$event['option_label'] ?? $option['title'] ?? $event['option_value'] ?? '',
        'choices'=>$choices,
    );
    return $event;
}
