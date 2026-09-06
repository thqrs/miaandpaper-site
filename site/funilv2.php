<?php
/** Percurso vertical, directamente dos JSONL privados. Sem snapshots nem escrita. */
require_once __DIR__ . '/admin-open.php';
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    exit('<!doctype html><html lang="pt-PT"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><h1>Acesso restrito</h1><p><a href="index.html">Inicia sessão na administração</a> e regressa ao funil.</p></html>');
}
session_write_close();
require_once __DIR__ . '/lib/private-paths.php';
function fv_arg($key, $default = '') { return isset($_GET[$key]) && is_string($_GET[$key]) ? $_GET[$key] : $default; }
$action = fv_arg('action');
$date = fv_arg('date', gmdate('Y-m-d'));
$sid = substr(fv_arg('sid'), 0, 64);
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/D', $date) || !checkdate((int)substr($date,5,2), (int)substr($date,8,2), (int)substr($date,0,4))) {
    http_response_code(400); exit('Data inválida.');
}
if ($action === 'data') {
    header('Content-Type: application/json; charset=utf-8');
    $path = mp_private_path('funnel-jsonl/' . $date . '.jsonl');
    $legacy = false;
    if (!$path || !is_file($path)) { $path = mp_private_path('order-funnel-events.jsonl'); $legacy = true; }
    $sessions = array(); $events = array(); $limited = false; $invalid = 0; $eventBytes = 0;
    if ($path && is_file($path)) {
        $fp = @fopen($path, 'rb');
        if (!$fp) { http_response_code(503); echo json_encode(array('error'=>'Não foi possível ler o tracking.')); exit; }
        // Limite de I/O e memória explícito: os 16 MiB mais recentes, nunca os primeiros.
        $size = fstat($fp)['size']; $start = max(0, $size - 16 * 1024 * 1024);
        if ($start) { fseek($fp, $start); fgets($fp); $limited = true; }
        while (ftell($fp) < $size && ($line = fgets($fp, 262145)) !== false) {
            // Uma escrita incompleta fica para a próxima actualização.
            if (substr($line, -1) !== "\n") { if (strlen($line) === 262144) { while (($rest = fgets($fp,262145)) !== false && substr($rest,-1) !== "\n") {} $invalid++; } continue; }
            $e = json_decode($line, true);
            if (!is_array($e)) { $invalid++; continue; }
            $id = $e['session_id'] ?? '';
            if (!is_string($id) || $id === '' || !empty($e['skip_reason'])) continue;
            $iso = $e['timestamp_iso'] ?? $e['created_at'] ?? '';
            if (!is_string($iso)) { $invalid++; continue; }
            if (substr($iso,0,10) !== $date) continue;
            $ms = is_numeric($e['timestamp_ms'] ?? null) ? (float)$e['timestamp_ms'] : (strtotime($iso) ?: 0) * 1000;
            if (!isset($sessions[$id])) $sessions[$id] = array('id'=>$id,'count'=>0,'last'=>0,'first'=>$ms,'device'=>$e['device_type'] ?? '', 'ip'=>$e['ip'] ?? '', 'products'=>array());
            $s =& $sessions[$id]; $s['count']++; $s['first'] = min($s['first'],$ms);
            if ($ms >= $s['last']) { $s['last']=$ms; $s['event']=$e['event_name'] ?? ''; }
            $slug = is_string($e['product_slug'] ?? null) ? $e['product_slug'] : '';
            if ($slug !== '') $s['products'][$slug] = true;
            unset($s);
            if ($sid !== '' && $id === $sid) {
                $e['_time']=$ms; $e['_key']=$date . ':' . ftell($fp); $e['_bytes']=strlen($line);
                $events[]=$e; $eventBytes+=strlen($line);
            }
            while (count($events) > 2000 || $eventBytes > 2 * 1024 * 1024) {
                $removed=array_shift($events); $eventBytes-=$removed['_bytes']; $limited=true;
            }
            if (count($sessions) > 3000) { unset($sessions[array_key_first($sessions)]); $limited=true; }
        }
        fclose($fp);
    }
    usort($events, function($a,$b) { return ($a['_time'] <=> $b['_time']) ?: (($a['client_event_index'] ?? 0) <=> ($b['client_event_index'] ?? 0)) ?: strnatcmp($a['_key'],$b['_key']); });
    $sessions = array_values($sessions);
    usort($sessions, function($a,$b) { return $b['last'] <=> $a['last']; });
    foreach ($sessions as &$s) $s['products']=array_keys($s['products']); unset($s);
    echo json_encode(array('sessions'=>$sessions,'events'=>$events,'limited'=>$limited,'invalid'=>$invalid,'source'=>$legacy?'JSONL legado':'JSONL diário','date'=>$date), JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
$products = array();
foreach (array_merge(glob(__DIR__ . '/congressos/2026/content/products/*.json'), glob(__DIR__ . '/content/products/*.json')) as $file) {
    $p=json_decode(file_get_contents($file),true);
    if (!empty($p['slug'])) $products[$p['slug']]=$p['name'] ?? $p['slug'];
}
?>
<!doctype html>
<html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Funil ao vivo · Mia &amp; Paper</title>
<link rel="stylesheet" href="css/01-tokens-agua.css"><link rel="stylesheet" href="admin-nav.css">
<style>
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 system-ui,sans-serif}main{max-width:1160px;margin:auto;padding:28px 18px 70px}h1{font:clamp(30px,5vw,44px)/1.15 Georgia,serif;margin:8px 0}h2{font:26px Georgia,serif;margin:0 0 12px}p{margin:8px 0}.muted,small,time{color:var(--muted)}.eyebrow{text-transform:uppercase;letter-spacing:.13em;font-size:12px;font-weight:700}.controls{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin:24px 0}label{display:grid;gap:6px;font-size:13px;font-weight:650}input,select,button{font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:10px;min-height:44px;padding:10px 12px;max-width:100%}button{cursor:pointer}button:hover{background:var(--linen)}:focus-visible{outline:3px solid var(--moss);outline-offset:3px}.layout{display:grid;gap:24px}.panel{min-width:0;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px}.visitor-select{width:100%}.session-info{overflow-wrap:anywhere;font-size:13px;margin-top:14px}.route{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.chip{border:1px solid var(--line);background:var(--paper);border-radius:20px;padding:4px 10px;font-size:12px}.timeline{list-style:none;padding:0;margin:22px 0}.stop{position:relative;border-left:3px solid var(--moss);margin-left:9px;padding:0 0 26px 25px;overflow-wrap:anywhere}.stop:before{content:"";position:absolute;left:-9px;top:5px;width:15px;height:15px;border:3px solid var(--moss);border-radius:50%;background:var(--card)}.stop:last-child{padding-bottom:8px}.stop.transfer:before{background:var(--gold);width:19px;height:19px;left:-11px}.product{font-size:12px;font-weight:750;letter-spacing:.04em;color:var(--moss);margin-bottom:5px}.stop h3{font-size:17px;line-height:1.4;margin:4px 0}.stop time{font-size:12px}.detail{font-size:14px}.stop details{margin-top:10px;font-size:13px}.stop summary{cursor:pointer;min-height:44px;display:flex;align-items:center;color:var(--moss);font-weight:650}.fields{margin:0;background:var(--paper);padding:12px;border-radius:10px}.fields dt{font-weight:650;color:var(--muted);margin-top:8px}.fields dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.notice{padding:12px;border-left:3px solid var(--gold);background:var(--linen);margin:12px 0}.empty{padding:24px 0;color:var(--muted)}#status{font-size:13px}#newEvents{margin:8px 0;width:100%}[hidden]{display:none!important}@media(min-width:800px){.layout{grid-template-columns:300px minmax(0,1fr)}.visitors{align-self:start;position:sticky;top:20px}}@media(max-width:420px){main{padding:20px 12px 60px}.panel{padding:16px}.controls label{flex:1}h1{font-size:32px}}
</style></head><body><main>
<div class="eyebrow">Mia &amp; Paper · visitantes</div><h1>Um visitante, um percurso.</h1><p class="muted">Segue cada paragem, do primeiro produto à última escolha.</p>
<div class="controls"><label>Dia do tracking (UTC)<input id="date" type="date" value="<?= htmlspecialchars($date,ENT_QUOTES,'UTF-8') ?>"></label><button id="live" type="button" aria-pressed="true">Pausar live</button><button id="refresh" type="button">Actualizar agora</button></div>
<p id="status" role="status">A ler o tracking…</p><p id="warning" class="notice" hidden></p>
<div class="layout"><aside class="panel visitors"><h2>Visitante</h2><label>Procurar sessão, IP ou produto<input id="search" type="search" placeholder="Escreve para filtrar"></label><p id="visitorCount" class="muted"></p><label>Escolher visitante<select id="visitor" class="visitor-select"><option value="">Selecciona um visitante</option></select></label><div id="sessionInfo" class="session-info"></div><p class="muted"><small>Cada visitante corresponde a uma sessão de navegação. Horas apresentadas em Lisboa.</small></p></aside>
<section class="panel"><h2 id="journeyTitle">Linha do tempo</h2><p id="journeyMeta" class="muted">Escolhe um visitante para ver o que fez.</p><div id="route" class="route"></div><button id="newEvents" hidden></button><button id="older" hidden>Mostrar 200 eventos anteriores</button><ol id="timeline" class="timeline"></ol><p id="empty" class="empty">À espera de um visitante.</p></section></div>
</main><script src="admin-nav.js?v=funilv2-1"></script><script>
'use strict';
const products=<?= json_encode($products,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT) ?>;
const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={page_view:'Abriu a página',page_enter:'Entrou na página',session_start:'Iniciou a visita',step_view:'Viu um passo',step_enter:'Entrou num passo',step_complete:'Concluiu um passo',option_select:'Escolheu uma opção',option_change:'Alterou uma opção',design_select:'Escolheu um design',add_to_cart:'Adicionou ao carrinho',cart_add:'Adicionou ao carrinho',cart_remove:'Retirou do carrinho',checkout_start:'Iniciou a encomenda',order_submit:'Enviou a encomenda',order_success:'Encomenda recebida',order_error:'Erro na encomenda',validation_error:'Encontrou um campo por preencher',image_zoom:'Ampliou uma imagem',heartbeat:'Continuou na página',page_leave:'Saiu da página',click:'Tocou num elemento',dead_click:'Toque sem resposta',download:'Descarregou um ficheiro'};
Object.assign(names,{site_landed:'Chegou ao site',wizard_started:'Começou a configurar o produto',step_completed:'Concluiu o passo',confirmation_view:'Viu o resumo da encomenda',contact_started:'Começou os dados de contacto',contact_completed:'Concluiu os dados de contacto',cart_item_added:'Adicionou um produto ao carrinho',cart_item_updated:'Alterou um produto no carrinho',cart_item_removed:'Retirou um produto do carrinho',cart_checkout_started:'Avançou para a encomenda',cart_order_submitted:'Submeteu a encomenda',order_submitted:'Submeteu a encomenda',artwork_upload_started:'Começou a enviar um ficheiro',artwork_upload_completed:'Terminou o envio do ficheiro',artwork_upload_failed:'O envio do ficheiro falhou',catalog_session_started:'Entrou no catálogo',catalog_page_view:'Viu uma página do catálogo',offer_page_view:'Viu uma oferta',offer_pdf_download_clicked:'Pediu o download do PDF',design_selected:'Escolheu um design',design_unselected:'Retirou um design',option_selected:'Escolheu uma opção',selection_updated:'Actualizou as escolhas',step_selection_snapshot:'Escolhas guardadas neste passo',delivery_selected:'Escolheu a entrega',ui_interaction:'Tocou num elemento',dead_tap:'Toque sem resposta',image_magnified:'Ampliou uma imagem'});
const labels={designs:'Designs',pack:'Pack',quantity:'Quantidade',delivery:'Entrega',contact:'Contacto',confirmation:'Resumo',session_id:'Sessão',timestamp_iso:'Recebido em (UTC)',timestamp_ms:'Instante no dispositivo (ms)',event_name:'Evento original',product_slug:'Produto',product_context:'Contexto',device_type:'Dispositivo',design_title:'Design',design_id:'Código do design',option_label:'Opção',option_type:'Tipo de opção',option_value:'Valor escolhido',step_id:'Passo',step_index:'Número do passo',selection_snapshot:'Escolhas neste momento',selection_json:'Escolhas neste momento',client_event_index:'Ordem no dispositivo',page_path:'Página',page_url:'Endereço da página',first_referrer:'Origem da visita',landing_page:'Página de entrada',utm_source:'Origem da campanha',ip:'IP'};
const human=v=>labels[v]||names[v]||String(v||'Evento').replace(/[_-]/g,' '), product=v=>products[v]||human(v), clock=v=>new Date(v).toLocaleTimeString('pt-PT',{timeZone:'Europe/Lisbon',hour:'2-digit',minute:'2-digit',second:'2-digit'});
let selected=new URLSearchParams(location.search).get('sid')||'', sessions=[], events=[], live=true, busy=false, generation=0, visible=200, timer, signature='', lastDate=$('date').value;
function visitors(){if(document.activeElement===$('visitor'))return;const q=$('search').value.toLocaleLowerCase();const list=sessions.filter(s=>(s.id+' '+s.ip+' '+s.products.map(product).join(' ')).toLocaleLowerCase().includes(q));$('visitorCount').textContent=list.length+' de '+sessions.length+' visitantes';$('visitor').innerHTML='<option value="">Selecciona um visitante</option>'+list.map(s=>'<option value="'+esc(s.id)+'">'+esc((Date.now()-s.last<90000?'Recente · ':'')+clock(s.last)+' · '+s.id.slice(-8)+' · '+s.products.map(product).join(', ')+' · '+s.count+' acções')+'</option>').join('');if(selected&&!list.some(s=>s.id===selected))$('visitor').insertAdjacentHTML('beforeend','<option value="'+esc(selected)+'">Sessão seleccionada · '+esc(selected.slice(-8))+'</option>');$('visitor').value=selected;}
function fields(e){return Object.entries(e).filter(([k,v])=>!k.startsWith('_')&&v!==null&&v!=='').map(([k,v])=>'<dt>'+esc(human(k))+'</dt><dd>'+esc(typeof v==='object'?JSON.stringify(v,null,2):v)+'</dd>').join('');}
function context(e){const c=e.product_context||e.catalog_context||(/\/congressos\//.test(e.page_path||e.page_url||e.landing_page||'')?'congresso-2026':'');return {'main':'Loja','main-v2':'Loja','congresso-2026':'Congresso 2026'}[c]||c;}
function render(){const s=sessions.find(s=>s.id===selected);$('sessionInfo').textContent=s?'Sessão '+s.id+' · '+(s.device||'Dispositivo desconhecido')+(s.ip?' · '+s.ip:''):'';$('journeyMeta').textContent=selected?(events.length+' acções registadas neste dia'+(s?' · '+clock(s.first)+' — '+clock(s.last):'')):'Escolhe um visitante para ver o que fez.';
const routes=[...new Set(events.filter(e=>e.product_slug).map(e=>product(e.product_slug)+(context(e)?' · '+context(e):'')))];$('route').innerHTML=routes.map(p=>'<span class="chip">'+esc(p)+'</span>').join('');
const sig=selected+'|'+visible+'|'+events.map(e=>e._key).join(',');if(sig===signature)return;signature=sig;
const opened=new Set([...$('timeline').querySelectorAll('details[open]')].map(d=>d.dataset.key));let previous='';$('timeline').innerHTML=events.slice(-visible).map(e=>{const p=e.product_slug?product(e.product_slug):'Navegação';const line=p+(context(e)?' · '+context(e):'');const change=line!==previous;previous=line;const detail=[e.step_label||e.step_title||(e.step_id?human(e.step_id):''),e.design_title||e.design_id,e.option_label||e.option_value,e.quantity!=null?'Quantidade: '+e.quantity:'',e.page_path||e.page_url].filter(Boolean);return '<li class="stop '+(change?'transfer':'')+'">'+(change?'<div class="product">'+esc(line)+'</div>':'')+'<time>'+esc(clock(e._time))+'</time><h3>'+esc(human(e.event_name))+'</h3>'+detail.map(v=>'<p class="detail">'+esc(v)+'</p>').join('')+'<details data-key="'+esc(e._key)+'"'+(opened.has(e._key)?' open':'')+'><summary>Ver todos os detalhes</summary><dl class="fields">'+fields(e)+'</dl></details></li>';}).join('');$('older').hidden=events.length<=visible;$('empty').hidden=events.length>0;$('empty').textContent=selected?'Sem eventos desta sessão no dia seleccionado.':'Selecciona um visitante para abrir o percurso.';}
function url(){const u=new URL(location.href);u.search='';u.searchParams.set('date',$('date').value);if(selected)u.searchParams.set('sid',selected);history.replaceState(null,'',u);u.searchParams.set('action','data');return u;}
async function refresh(){if(busy)return;busy=true;const version=generation;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);try{const response=await fetch(url(),{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error(response.status===403?'A sessão terminou. Inicia sessão na administração.':'Não foi possível ler o tracking.');const data=await response.json();if(version!==generation)return;const oldKeys=new Set(events.map(e=>e._key));const added=oldKeys.size?data.events.filter(e=>!oldKeys.has(e._key)).length:0;if(added)visible+=added;sessions=data.sessions;events=data.events;visitors();render();$('warning').hidden=!data.limited&&!data.invalid;$('warning').textContent=[data.limited?'Dados parciais: leitura limitada aos últimos 16 MiB do ficheiro, 3000 sessões e 2000 eventos / 2 MiB de detalhes por sessão.': '',data.invalid?data.invalid+(data.invalid===1?' linha inválida ignorada.':' linhas inválidas ignoradas.'):''].filter(Boolean).join(' ');$('status').textContent=(live?'Live · actualiza a cada 5 segundos':'Em pausa')+' · actualizado às '+clock(Date.now())+' · '+data.source;if(added){$('newEvents').textContent=added+(added===1?' nova acção · ir à última':' novas acções · ir à última');$('newEvents').hidden=false;}}catch(e){if(version===generation)$('status').textContent=e.name==='AbortError'?'A leitura demorou demasiado. Voltaremos a tentar.':e.message;}finally{clearTimeout(timeout);busy=false;clearTimeout(timer);if(version!==generation)refresh();else if(live&&!document.hidden)timer=setTimeout(refresh,5000);}}
$('visitor').addEventListener('change',()=>{selected=$('visitor').value;events=[];visible=200;generation++;$('newEvents').hidden=true;render();refresh();});$('date').addEventListener('change',()=>{if(!$('date').value){$('date').value=lastDate;return;}lastDate=$('date').value;selected='';events=[];sessions=[];generation++;$('newEvents').hidden=true;visitors();render();refresh();});$('search').addEventListener('input',visitors);$('visitor').addEventListener('blur',visitors);$('live').addEventListener('click',()=>{live=!live;$('live').textContent=live?'Pausar live':'Retomar live';$('live').setAttribute('aria-pressed',String(live));clearTimeout(timer);if(live)refresh();else $('status').textContent='Em pausa · o percurso mantém-se disponível.';});$('refresh').addEventListener('click',refresh);$('older').addEventListener('click',()=>{visible+=200;render();});$('newEvents').addEventListener('click',()=>{$('timeline').lastElementChild?.scrollIntoView({behavior:'smooth',block:'center'});$('newEvents').hidden=true;});document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden&&live)refresh();});refresh();
</script></body></html>
