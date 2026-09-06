'use strict';
const assert=require('node:assert/strict');
const view=require('../site/funilv2.js');
const e=(t,step,name='step_view',extra={})=>({_time:t*1000,step_id:step,event_name:name,page_instance_id:'page-a',product_slug:'example',...extra});
let groups=view.groups([e(0,'designs'),e(10,'designs','design_selected'),e(30,'pack','step_view',{from_step:'designs'}),e(45,'pack','option_selected')]);
assert.equal(groups[0].elapsed,30000);
assert.equal(groups[0].durationLabel,'no passo · intervalo');
assert.equal(groups[1].elapsed,15000);
assert.equal(groups[1].durationLabel,'mínimo observado');
assert.equal(groups[1].closed,false);
// A page switch does not establish when the earlier tab was closed.
groups=view.groups([e(0,'designs'),e(10,'designs','design_selected'),e(300,'pack','step_view',{page_instance_id:'page-b',from_step:'designs'})]);
assert.equal(groups[0].elapsed,10000);
assert.equal(groups[0].closed,false);
// Returning to a step is a separate visit, never time combined across steps.
groups=view.groups([e(0,'designs'),e(20,'pack','step_view',{from_step:'designs'}),e(40,'designs','step_view',{from_step:'pack'})]);
assert.equal(groups.length,3);
assert.equal(groups[2].durationText,'Sem duração');
// A truncated beginning cannot claim an exact measured step duration.
groups=view.groups([e(10,'designs','design_selected'),e(20,'designs','step_completed')]);
assert.equal(groups[0].durationLabel,'mínimo observado');
assert.equal(view.describe(e(0,'designs','design_selected',{_view:{design:'Flores',product:'Ímanes'}})).copy,'“Flores” · Ímanes');
assert.match(view.describe(e(0,'pack','option_selected',{option_type:'pack',_view:{option:'20 unidades'}})).title,/20 unidades/);
assert.deepEqual(view.describe(e(0,'pack','selection_updated',{selection_json:'{"selected_pack":20}'})).facts,['Quantidade: 20']);
assert.match(view.describe(e(0,'pack','new_future_event')).copy,/acção adicional/);
console.log('PASS: intervals, lower bounds, separate tabs, step returns, snapshots and descriptions.');
