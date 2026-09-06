<?php
require __DIR__.'/../site/lib/funilv2-presenter.php';
function verify($ok,$message) { if (!$ok) throw new RuntimeException($message); }
foreach (array('https://evil.example/content/a.webp','//evil.example/content/a.webp','data:image/webp,hello','../private/a.webp','/content/../private/a.webp','/content/%2e%2e/private/a.webp','/order-media-preview.php?token=a') as $source) verify(fv_image($source,'loja')==='','Unsafe image accepted');
foreach (array('loja','congresso-2026') as $context) {
    $found=false;
    foreach (fv_catalogue() as $entry) {
        if ($entry['context']!==$context) continue;
        $p=json_decode(file_get_contents($entry['file']),true);
        foreach ($p['steps'] ?? array() as $step) {
            if (($step['id'] ?? '')!=='designs') continue;
            foreach ($step['items'] ?? array() as $item) {
                if (fv_image($item['image'] ?? '',$context)==='') continue;
                $event=array('product_slug'=>$p['slug'],'product_context'=>$context,'step_id'=>'designs','design_id'=>$item['value'] ?? $item['id'],'event_name'=>'design_selected');
                $result=fv_present_event($event);
                verify($result['_view']['image']!=='','Missing catalogue image');
                verify($result['_view']['design']===$item['title'],'Wrong design');
                verify($result['_view']['step']===$step['title'],'Wrong step');
                $plain=fv_present_event(array('product_slug'=>$p['slug'],'product_context'=>$context,'step_id'=>'designs','event_name'=>'ui_interaction'));
                verify($plain['_view']['image']==='','Unidentified click must not inherit first image');
                $found=true; break 3;
            }
        }
    }
    verify($found,'No tested product in '.$context);
}
echo "PASS: local image confinement, main + Congress design resolution, no invented images.\n";
