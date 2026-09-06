/* Interpretação visual dos eventos; não altera o tracking nem inventa permanência. */
const FunnelView = (() => {
  const scalar = value => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const stepNames = {designs:'Escolha dos designs',extras:'Opções e acabamentos',size:'Tamanho e formato',pack:'Quantidade',details:'Personalização',delivery_contact:'Entrega e contacto',confirm:'Resumo da encomenda',home:'Página inicial',product:'Página do produto',category:'Categoria do catálogo',catalog:'Catálogo'};
  const optionNames = {pack:'Quantidade',size:'Tamanho',delivery:'Entrega',lamination:'Laminação',personalization:'Personalização',purchase_option:'Opção de compra'};
  const values = {yes:'Sim',no:'Não',shipping:'Envio por CTT',pickup:'Recolha na Mia',join_orders:'Juntar a outra encomenda',matte:'Mate',glossy:'Brilhante',catalog:'Design do catálogo',custom:'Design próprio'};
  const device = value => ({mobile:'Telemóvel',desktop:'Computador',tablet:'Tablet'}[value] || 'Dispositivo não identificado');
  const label = value => values[value] || scalar(value).replace(/[_-]/g,' ');
  const snapshot = event => {
    let value = event.selection_snapshot || event.selection_json || {};
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch (_) { return {}; } }
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  };
  const duration = ms => {
    if (ms < 1000) return '< 1 s';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return seconds + ' s';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' min' + (seconds % 60 ? ' ' + seconds % 60 + ' s' : '');
    return Math.floor(seconds / 3600) + ' h ' + Math.floor(seconds % 3600 / 60) + ' min';
  };
  const step = event => event._view?.step || stepNames[event.step_id] || (event.step_id ? label(event.step_id) : 'Navegação pelo site');
  const groups = events => {
    const result = [];
    let group;
    events.forEach(event => {
      const page = scalar(event.page_instance_id) || scalar(event.landing_page);
      const key = (event._view?.key || event.product_slug || '') + '|' + page + '|' + (event.step_id || '');
      if (!group || group.key !== key) {
        group = {key,page,step:event.step_id || '',events:[],start:event._time,end:event._time,closed:false,knownStart:false};
        result.push(group);
      }
      group.events.push(event);
      group.end = event._time;
      if (group.events.length === 1 && ['step_view','step_enter','wizard_started'].includes(event.event_name)) group.knownStart = true;
      if (event.event_name === 'step_completed' || event.event_name === 'step_complete') {
        group.completed = event._time;
      }
    });
    result.forEach((g,index) => {
      const next = result[index + 1];
      const nextEvent = next?.events[0];
      // Só atribuir o intervalo até à transição quando a mesma página confirma
      // o passo de origem. Intercalar separadores não prova uma saída do passo.
      if (next && g.page && next.page === g.page && nextEvent.from_step === g.step && g.step && next.step !== g.step) {
        g.end = next.start; g.closed = true;
      } else if (g.completed !== undefined) {
        g.end = g.completed; g.closed = true;
      }
      g.elapsed = Math.max(0,g.end - g.start);
      g.durationLabel = g.closed && g.knownStart ? 'no passo · intervalo' : 'mínimo observado';
      g.durationText = g.elapsed > 0 ? duration(g.elapsed) : (g.closed && g.knownStart ? '< 1 s' : 'Sem duração');
    });
    return result;
  };
  const facts = event => {
    const snap = snapshot(event), result = [];
    const add = (name,value) => { if (value !== undefined && value !== null && scalar(value) !== '') result.push(name + ': ' + label(value)); };
    add('Quantidade',event.quantity ?? event.product_quantity ?? event.selected_pack ?? snap.selected_pack ?? snap.caderno_qty);
    add('Tamanho',event.selected_size || snap.selected_size);
    add('Entrega',event.selected_delivery || snap.selected_delivery);
    add('Laminação',snap.lamination);
    if (snap.cover_personalization !== undefined) add('Capa personalizada',Number(snap.cover_personalization) ? 'yes' : 'no');
    if (snap.artwork_count || event.file_count) add('Ficheiros',snap.artwork_count || event.file_count);
    if (snap.artwork_help) result.push('Pediu ajuda com o design');
    if (snap.card_has_text) result.push('Preencheu o cartão de apresentação');
    if (snap.dedication_has_text) result.push('Acrescentou uma dedicatória');
    if (event.total_estimate_cents !== undefined) {
      const amount = Number(event.total_estimate_cents);
      if (Number.isFinite(amount)) result.push('Total estimado: ' + (amount / 100).toLocaleString('pt-PT',{style:'currency',currency:'EUR'}));
    }
    return [...new Set(result)];
  };
  const describe = event => {
    const view=event._view || {}, name=event.event_name || '', design=scalar(view.design), option=scalar(view.option), target=scalar(event.target_label);
    let title='Interacção registada', copy='', kind='Acção', technical=false;
    const titles={site_landed:'Chegou ao site',session_start:'Começou a visita',catalog_session_started:'Entrou no catálogo',catalog_page_view:'Abriu uma página do catálogo',offer_page_view:'Abriu uma oferta',wizard_started:'Começou a escolher este produto',step_view:'Abriu este passo',step_enter:'Abriu este passo',step_completed:'Concluiu este passo',step_complete:'Concluiu este passo',confirmation_view:'Conferiu o resumo',contact_started:'Começou a preencher o contacto',contact_completed:'Terminou os dados de contacto',cart_item_added:'Guardou o produto no carrinho',cart_item_updated:'Alterou o produto no carrinho',cart_item_removed:'Retirou o produto do carrinho',cart_checkout_started:'Avançou para a encomenda',cart_order_submitted:'Submeteu a encomenda',order_submitted:'Submeteu a encomenda',order_success:'A encomenda foi recebida',order_error:'Ocorreu um erro na encomenda',artwork_upload_started:'Começou a enviar um ficheiro',artwork_upload_completed:'Terminou o envio do ficheiro',artwork_upload_failed:'O ficheiro não foi enviado',offer_pdf_download_clicked:'Pediu o download do PDF',download:'Pediu um download',page_view:'Abriu a página',page_leave:'Foi registada a saída da página'};
    title=titles[name] || title;
    if (/design_(selected|select|unselected)$/.test(name)) {
      title=name==='design_unselected'?'Retirou este design da selecção':'Escolheu este design';
      copy=design ? '“'+design+'”'+(view.product?' · '+view.product:'') : 'O registo não identifica o nome do design.';
      kind='Design';
    } else if (/image_(magnified|zoom)$/.test(name)) {
      title='Abriu a imagem para ver melhor'; copy=design ? 'Ampliou “'+design+'”.' : 'Observou a imagem ampliada.'; kind='Imagem';
    } else if (/option_(selected|select|change)$/.test(name) || name==='delivery_selected') {
      title=option ? 'Escolheu “'+option+'”' : 'Alterou uma opção';
      copy=optionNames[event.option_type] ? 'Escolha de '+optionNames[event.option_type].toLowerCase()+'.' : 'A opção ficou registada neste passo.'; kind='Escolha';
    } else if (name==='step_view' || name==='step_enter') {
      title=event.transition_reason==='back_button'?'Voltou a este passo':'Abriu este passo';
      copy=view.fromStep ? 'Veio de “'+view.fromStep+'”.' : 'Começou a ver as opções deste passo.'; kind='Passo';
    } else if (name==='step_completed' || name==='step_complete') {
      copy='Avançou depois de concluir os campos obrigatórios deste passo.'; kind='Passo';
    } else if (name==='wizard_started') {
      copy=view.product?'Abriu a configuração de '+view.product+'.':'Abriu o configurador do produto.'; kind='Produto';
    } else if (name==='validation_error') {
      const count=Number(event.validation_error_count)||1;
      title='Tentou avançar, mas faltava completar o passo';
      copy=count===1?'O site assinalou um campo ou uma escolha em falta.': 'O site assinalou '+count+' campos ou escolhas em falta.'; kind='Impedimento';
    } else if (name==='ui_interaction' || name==='click' || /^catalog_.*_clicked$/.test(name)) {
      title=target?'Tocou em “'+target+'”':'Tocou num elemento da página';
      copy=/^catalog_/.test(name)?'Seguiu uma ligação no catálogo.':'O tracking registou o toque; o resultado aparece nas acções seguintes.'; kind='Toque';
    } else if (name==='dead_tap' || name==='dead_click') {
      title='Tocou numa zona sem resposta'; copy='O toque não atingiu um controlo interactivo identificado pelo site.'; kind='Toque';
    } else if (name==='selection_updated' || name==='step_selection_snapshot') {
      title=name==='selection_updated'?'Actualizou a selecção':'As escolhas ao sair deste passo';
      copy='Estas eram as opções guardadas neste momento.'; kind='Selecção'; technical=true;
    } else if (name==='heartbeat') {
      title='Continuou com a página visível'; copy='O site registou presença após actividade recente neste separador.'; kind='Presença'; technical=true;
    } else if (name==='site_landed' || name==='session_start' || name==='catalog_session_started') {
      const origin=scalar(event.utm_source || event.referrer_type);
      copy=origin && !['direct','unknown','internal'].includes(origin)?'Origem registada: '+label(origin)+'.':'Primeira entrada registada nesta visita.'; kind='Entrada';
    } else if (name==='offer_pdf_download_clicked' || name==='download') {
      copy=scalar(event.download_label || event.download_name || event.download_file) || 'O clique no download foi registado; não confirma que o ficheiro terminou de descarregar.'; kind='Download';
    } else if (/order_submitted/.test(name)) {
      copy='O pedido foi submetido. Este evento não confirma pagamento.'; kind='Encomenda';
    } else if (/scroll_depth/.test(name)) {
      title='Percorreu a página'; copy=event.scroll_depth_percent !== undefined?'Chegou a '+event.scroll_depth_percent+'% da página.':'Foi registado um ponto de leitura da página.'; kind='Leitura';
    } else if (!titles[name]) {
      copy=target?'Elemento: “'+target+'”.':'O tracking guardou uma acção adicional'+(view.product?' em '+view.product:'')+'. O código original está nos dados técnicos.';
    }
    if (!copy && view.product) copy=view.product+(view.context?' · '+view.context:'');
    return {title,copy,kind,technical,facts:facts(event)};
  };
  return {scalar,label,device,snapshot,duration,step,groups,describe};
})();
if (typeof module !== 'undefined' && module.exports) module.exports=FunnelView;

if (typeof document !== 'undefined') (() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const names=JSON.parse($('productNames').textContent);
  const esc=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const time=(ms,seconds=true)=>new Date(ms).toLocaleTimeString('pt-PT',{timeZone:'Europe/Lisbon',hour:'2-digit',minute:'2-digit',...(seconds?{second:'2-digit'}:{})});
  let selected=new URLSearchParams(location.search).get('sid') || '';
  let sessions=[],events=[],live=true,busy=false,generation=0,visible=200,padLimit=60,timer,signature='',padSignature='',lastDate=$('date').value;
  let scrollToJourney=false,loaded=false;

  function renderVisitors() {
    const q=$('search').value.toLocaleLowerCase();
    const filtered=sessions.filter(s=>(s.id+' '+s.ip+' '+s.products.map(p=>names[p]||p).join(' ')).toLocaleLowerCase().includes(q));
    // Stable tie-breaker means equal entry times never shuffle on a live poll.
    filtered.sort((a,b)=>b.first-a.first || a.id.localeCompare(b.id));
    $('visitorCount').textContent=filtered.length+' '+(filtered.length===1?'visita':'visitas');
    $('moreVisitors').hidden=filtered.length<=padLimit;
    $('noVisitors').hidden=filtered.length>0;
    const list=filtered.slice(0,padLimit);
    const html=list.map(s=>{
      const recent=Date.now()-s.last>=0 && Date.now()-s.last<90000;
      const summary='Entrada às '+time(s.first)+', visitante '+s.id.slice(-6)+', '+s.count+(s.count===1?' acção':' acções');
      return '<button class="visitor-pad" data-sid="'+esc(s.id)+'" aria-pressed="'+(s.id===selected)+'" aria-label="'+esc(summary)+'">'+(recent?'<span class="pad-dot" title="Actividade nos últimos 90 segundos"></span>':'')+'<span class="pad-label">Entrada</span><span class="pad-time">'+esc(time(s.first,false))+'</span><span class="pad-count">'+s.count+' '+(s.count===1?'acção':'acções')+'</span><span class="pad-code">'+esc(s.id.slice(-6))+'</span></button>';
    }).join('');
    if (html===padSignature) return;
    const focused=document.activeElement?.dataset.sid;
    padSignature=html; $('visitorGrid').innerHTML=html;
    if (focused) [...$('visitorGrid').querySelectorAll('button')].find(b=>b.dataset.sid===focused)?.focus({preventScroll:true});
  }

  function imageHtml(image,name) {
    // URLs are resolved and confined to existing public WebP files by PHP.
    return image?'<figure class="design-preview"><img class="design-image" src="'+esc(image)+'" alt="'+esc(name||'Design')+'" width="112" height="130" loading="lazy"><figcaption class="image-note">Imagem do design</figcaption></figure>':'';
  }
  function renderJourney() {
    const session=sessions.find(s=>s.id===selected);
    $('journeyTitle').textContent=session?'A visita das '+time(session.first,false):'Uma linha do tempo, só desta pessoa.';
    $('journeyMeta').textContent=selected?(loaded?events.length+' acções disponíveis · pela ordem em que aconteceram':'A abrir o percurso…'):'Toca num quadrado acima para abrir a visita.';
    $('sessionInfo').innerHTML=session?'<span>'+esc(FunnelView.device(session.device))+'</span><span>Entrada às '+esc(time(session.first))+'</span><span>Último registo às '+esc(time(session.last))+'</span><span>Visitante '+esc(session.id.slice(-6))+'</span>':'';
    const routes=[...new Set(events.filter(e=>e._view?.product).map(e=>e._view.product+' · '+e._view.context))];
    $('route').innerHTML=routes.map(p=>'<span class="chip">'+esc(p)+'</span>').join('');
    $('timingNote').hidden=!events.length;
    $('empty').hidden=events.length>0;
    $('empty').innerHTML='<span class="empty-track" aria-hidden="true">●<br>│<br>●</span><p>'+esc(selected?(loaded?'Não há acções desta visita no dia escolhido.':'A abrir o percurso…'):'A próxima história começa num dos quadrados acima.')+'</p>';
    const sig=selected+'|'+visible+'|'+events.map(e=>e._key).join(',');
    if (sig===signature) return;
    signature=sig;
    const open=new Set([...$('timeline').querySelectorAll('details[open]')].map(d=>d.dataset.key));
    const focusKey=document.activeElement?.closest('details')?.dataset.key;
    const groups=FunnelView.groups(events), firstIndex=Math.max(0,events.length-visible);
    const eventGroups=new Map(); groups.forEach(g=>g.events.forEach(e=>eventGroups.set(e._key,g)));
    let previousGroup;
    $('timeline').innerHTML=events.slice(firstIndex).map((e,offset)=>{
      const group=eventGroups.get(e._key),start=group!==previousGroup;
      previousGroup=group;
      const view=e._view||{}, d=FunnelView.describe(e);
      const before=events[firstIndex+offset-1], gap=before?Math.max(0,e._time-before._time):0;
      const heading=start?'<div class="stage-heading"><div><div class="stage-product">'+esc(view.product?view.product+' · '+view.context:'Pelo site')+'</div><div class="stage-title">'+esc(FunnelView.step(e))+'</div></div><div class="stage-duration"><strong>'+esc(group.durationText)+'</strong>'+esc(group.durationText==='Sem duração'?'só um instante registado':group.durationLabel)+'</div></div>':'';
      const image=view.image && (/design_|image_|ui_interaction/.test(e.event_name))?view.image:'';
      const choices=['selection_updated','step_selection_snapshot'].includes(e.event_name)?(view.choices||[]):[];
      const debug=Object.fromEntries(Object.entries(e).filter(([k])=>!k.startsWith('_')));
      return '<li class="stop'+(start?' transfer':'')+(d.technical?' technical':'')+'">'+heading+'<article class="event-card"><div class="event-top"><span class="event-kind">'+esc(d.kind)+'</span><time>'+esc(time(e._time))+(gap>=1000?' · '+esc(FunnelView.duration(gap))+' depois':'')+'</time></div><div class="event-content'+(image?' has-image':'')+'">'+imageHtml(image,view.design)+'<div><h3>'+esc(d.title)+'</h3><p class="event-copy">'+esc(d.copy)+'</p>'+(!image && /design_(selected|unselected)/.test(e.event_name)?'<p class="image-note">Imagem indisponível no catálogo actual.</p>':'')+'</div></div>'+(d.facts.length?'<div class="facts">'+d.facts.map(f=>'<span class="fact">'+esc(f)+'</span>').join('')+'</div>':'')+(choices.length?'<div class="choices">'+choices.map(c=>'<span class="choice">'+(c.image?'<img src="'+esc(c.image)+'" alt="" width="38" height="45" loading="lazy">':'')+esc(c.name)+'</span>').join('')+'</div>':'')+'<details class="debug" data-key="'+esc(e._key)+'"'+(open.has(e._key)?' open':'')+'><summary>Dados técnicos deste registo</summary><pre>'+esc(JSON.stringify(debug,null,2))+'</pre></details></article></li>';
    }).join('');
    $('older').hidden=events.length<=visible;
    if (focusKey) [...$('timeline').querySelectorAll('details')].find(d=>d.dataset.key===focusKey)?.querySelector('summary')?.focus({preventScroll:true});
  }
  function url() {
    const u=new URL(location.href); u.search='';
    u.searchParams.set('date',$('date').value);
    if(selected) u.searchParams.set('sid',selected);
    history.replaceState(null,'',u); u.searchParams.set('action','data'); return u;
  }
  async function refresh() {
    if (busy) return;
    busy=true; const version=generation;
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),20000);
    try {
      const response=await fetch(url(),{cache:'no-store',signal:controller.signal});
      if(!response.ok) throw new Error(response.status===403?'A sessão terminou. Inicia sessão na administração.':'Não foi possível ler o tracking.');
      const data=await response.json();
      if(version!==generation) return;
      const oldKeys=new Set(events.map(e=>e._key));
      const added=oldKeys.size?data.events.filter(e=>!oldKeys.has(e._key)).length:0;
      if(added) visible+=added;
      sessions=data.sessions; events=data.events; loaded=true;
      renderVisitors(); renderJourney();
      $('warning').hidden=!data.limited&&!data.invalid;
      $('warning').textContent=[data.limited?'Histórico parcial: atingiu o limite de leitura. A entrada e os tempos podem não abranger a visita completa.':'',data.invalid?data.invalid+' registos ilegíveis foram ignorados.':''].filter(Boolean).join(' ');
      $('status').textContent=(live?'Live':'Em pausa')+' · actualizado às '+time(Date.now());
      if(added) { $('newEvents').textContent=added+(added===1?' nova acção':' novas acções')+' · ir à última'; $('newEvents').hidden=false; }
      if(scrollToJourney) { scrollToJourney=false; $('journey').scrollIntoView({behavior:'smooth',block:'start'}); }
    } catch(error) {
      if(version===generation) $('status').textContent=error.name==='AbortError'?'A leitura demorou demasiado. Vamos tentar novamente.':error.message;
    } finally {
      clearTimeout(timeout); busy=false; clearTimeout(timer);
      if(version!==generation) refresh(); else if(live&&!document.hidden) timer=setTimeout(refresh,5000);
    }
  }
  $('visitorGrid').addEventListener('click',event=>{
    const button=event.target.closest('button[data-sid]'); if(!button) return;
    selected=button.dataset.sid; events=[]; visible=200; generation++; loaded=false;
    scrollToJourney=true; $('newEvents').hidden=true; renderVisitors(); renderJourney(); refresh();
  });
  $('date').addEventListener('change',()=>{
    if(!$('date').value) { $('date').value=lastDate; return; }
    lastDate=$('date').value; selected=''; events=[]; sessions=[]; loaded=false; generation++; padLimit=60; scrollToJourney=false;
    $('newEvents').hidden=true; renderVisitors(); renderJourney(); refresh();
  });
  $('search').addEventListener('input',()=>{padLimit=60; renderVisitors();});
  $('moreVisitors').addEventListener('click',()=>{padLimit+=60; renderVisitors();});
  $('live').addEventListener('click',()=>{
    live=!live; $('liveLabel').textContent=live?'Live ligado':'Live em pausa'; $('live').setAttribute('aria-pressed',String(live)); clearTimeout(timer);
    if(live) refresh(); else $('status').textContent='Em pausa · podes explorar o percurso.';
  });
  $('refresh').addEventListener('click',refresh);
  $('older').addEventListener('click',()=>{visible+=200; renderJourney();});
  $('newEvents').addEventListener('click',()=>{$('timeline').lastElementChild?.scrollIntoView({behavior:'smooth',block:'center'}); $('newEvents').hidden=true;});
  $('timeline').addEventListener('error',event=>{if(event.target.tagName==='IMG') { event.target.hidden=true; const caption=event.target.closest('figure')?.querySelector('figcaption'); if(caption)caption.textContent='Imagem já não disponível.'; }},true);
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer); if(!document.hidden&&live) refresh();});
  refresh();
})();
