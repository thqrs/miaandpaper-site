'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const product = JSON.parse(fs.readFileSync(path.join(root, 'site/content/products/pasta-de-folhetos.json'), 'utf8'));
const context = vm.createContext({ console, window: {}, state: { selections: {}, product },
  URLSearchParams, Date, Math, setTimeout, clearTimeout });
for (const file of ['07-carrinho.js', '10-produto-precos.js', '12-crachas-imanes.js', '14-upload-quantidade.js', '15-cadernos.js', '16-quadros-resumo.js', '17-wizard-render.js', '18-wizard-navegacao.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'site/js', file), 'utf8'), context, {filename:file});
}
const run = code => vm.runInContext(code, context);
run(`
  state.product = ${JSON.stringify(product)};
  state.selections = {size:'A4', cover_a4:'A4 · Opção 01'};
  setConfiguredUnitCount(state.product, 3);
  loadConfiguredUnit(state.product, 1);
  state.selections.cover_a4 = 'A4 · Opção 01';
  state.selections.cover_personalization_a4 = 'yes';
  state.selections.cover_personalization_a4_text = 'Ana';
  saveConfiguredUnit(state.product);
  loadConfiguredUnit(state.product, 2);
  state.selections.cover_a4 = 'A4 · Opção 02';
  saveConfiguredUnit(state.product);
`);
assert.equal(run('configuredUnitCount(state.product)'), 3);
assert.equal(run('validateStep(state.product, findStep(state.product, "covers"))'), '');
let rows = JSON.parse(run('JSON.stringify(configuredUnitSelections(state.product))'));
assert.deepEqual(rows.map(x => x.cover_a4), ['A4 · Opção 01','A4 · Opção 01','A4 · Opção 02']);
assert.equal(rows[1].cover_personalization_a4_text, 'Ana');
assert.equal(rows[0].cover_personalization_a4_text, undefined);
assert(rows.every(x => !x.configured_units && x.size === 'A4'));
run('setConfiguredUnitCount(state.product, 1)');
assert.equal(run('state.selections.cover_a4'), 'A4 · Opção 01');
assert.equal(run('state.selections.cover_personalization_a4_text'), undefined);
run('setConfiguredUnitCount(state.product, 2)');
// Reduzir e voltar a aumentar recupera as escolhas guardadas.
assert.equal(run('validateStep(state.product, findStep(state.product, "covers"))'), '');
assert.equal(run('configuredUnitIndex(state.product)'), 0);
run(`state.selections.configured_units[1] = cloneJson(state.selections.configured_units[0]); loadConfiguredUnit(state.product, 1);`);
assert.equal(run('validateStep(state.product, findStep(state.product, "covers"))'), '');
run(`state.selections.cover_a4 = 'A4 · Opção 03'; saveConfiguredUnit(state.product);`);
assert.equal(run('state.selections.configured_units[0].cover_a4'), 'A4 · Opção 01');
// Mudar o tamanho elimina as unidades do formato antigo.
run(`setSelection(findStep(state.product, 'size'), {value:'A6', dataset:{}})`);
assert.equal(run('configuredUnitCount(state.product)'), 1);
assert.equal(run('state.selections.cover_a4'), undefined);
// Um pack continua a exigir as duas capas em cada unidade.
run(`state.selections = {size:'A4 + A6'}; setConfiguredUnitCount(state.product, 2);`);
assert.match(run('validateStep(state.product, findStep(state.product, "pack-covers"))'), /^Conjunto 1: Atribui uma capa ao A4/);
// Sem opt-in, os restantes produtos mantêm uma única configuração.
assert.equal(run('configuredUnitCount({steps:[]})'), 1);
const groupCartItems = [];
// Acções em grupo: preservam escolhas independentes e podem ser desfeitas.
for (const size of ['A4', 'A6', 'A4 + A6']) {
  run(`
    state.selections = {size:${JSON.stringify(size)}, cover_a4:'A4 · Opção 01', cover_a6:'A6 · Opção 01', finish:'matte', finish_a4:'matte', finish_a6:'glossy'};
    setConfiguredUnitCount(state.product, 3);
    state.selections.configured_units[1] = {cover_a4:'A4 · Opção 02', cover_a6:'A6 · Opção 02', finish:'glossy', finish_a4:'glossy', finish_a6:'matte'};
    loadConfiguredUnit(state.product, 1);
    var coversStep = findStep(state.product, ${JSON.stringify(size === 'A4 + A6' ? 'pack-covers' : 'covers')});
    var finishesStep = findStep(state.product, ${JSON.stringify(size === 'A4 + A6' ? 'pack-finishes' : 'extras')});
    var namesStep = findStep(state.product, 'cover_personalization');
    var detailsStep = findStep(state.product, ${JSON.stringify(size === 'A4 + A6' ? 'pack-details' : 'details')});
    var before = JSON.stringify(configuredUnitList());
    applyConfiguredUnitAction(state.product, coversStep, configuredUnitActions(state.product, coversStep)[0]);
  `);
  assert.equal(run('configuredUnitsStepReady(state.product, coversStep).every(Boolean)'), true);
  assert.equal(run('undoConfiguredUnitAction(state.product, coversStep)'), true);
  assert.deepEqual(JSON.parse(run('JSON.stringify(configuredUnitList())')), JSON.parse(run('before')));
  run(`applyConfiguredUnitAction(state.product, finishesStep, configuredUnitActions(state.product, finishesStep)[0]);`);
  assert.equal(run('configuredUnitsStepReady(state.product, finishesStep).every(Boolean)'), true);
  assert.equal(run('undoConfiguredUnitAction(state.product, finishesStep)'), true);
  assert.deepEqual(JSON.parse(run('JSON.stringify(configuredUnitList())')), JSON.parse(run('before')));
  // O total considera cada capa: num conjunto são duas por unidade.
  const expected = size === 'A4 + A6' ? 1200 : 600;
  assert.equal(run('configuredUnitActionPrice(state.product, namesStep, configuredUnitActions(state.product, namesStep)[0])'), expected);
  assert.equal(run('configuredUnitActionPrice(state.product, detailsStep, configuredUnitActions(state.product, detailsStep)[0])'), expected);
  assert.deepEqual(JSON.parse(run('JSON.stringify(configuredUnitList())')), JSON.parse(run('before')));
  run(`applyConfiguredUnitAction(state.product, namesStep, configuredUnitActions(state.product, namesStep)[0]);`);
  assert.equal(run('state.configuredUnitSameName'), true);
  assert.equal(run('configuredUnitList().every(unit => configuredPersonalizationQuestions(state.product, namesStep).every(q => unit[q.field] === "yes" && unit[q.textField] === ""))'), true);
  run('setConfiguredUnitSharedName(state.product, "Nome comum")');
  assert.equal(run('configuredUnitList().every(unit => configuredPersonalizationQuestions(state.product, namesStep).every(q => unit[q.textField] === "Nome comum"))'), true);
  assert.equal(run('validateStep(state.product, namesStep)'), '');
  run('setConfiguredUnitSharedName(state.product, "")');
  assert.match(run('validateStep(state.product, namesStep)'), /Escreve o nome/);
  run('setConfiguredUnitSharedName(state.product, "a".repeat(26))');
  assert.match(run('validateStep(state.product, namesStep)'), /25 caracteres/);
  assert.equal(run('undoConfiguredUnitAction(state.product, namesStep)'), true);
  assert.equal(run('state.configuredUnitSameName'), false);
  assert.deepEqual(JSON.parse(run('JSON.stringify(configuredUnitList())')), JSON.parse(run('before')));
  run(`applyConfiguredUnitAction(state.product, detailsStep, configuredUnitActions(state.product, detailsStep)[0]);`);
  assert.equal(run('configuredUnitActionPressed(state.product, detailsStep, configuredUnitActions(state.product, detailsStep)[0])'), true);
  assert.equal(run('configuredUnitActionPrice(state.product, detailsStep, configuredUnitActions(state.product, detailsStep)[0])'), expected);
  assert.equal(run('undoConfiguredUnitAction(state.product, detailsStep)'), true);
  assert.deepEqual(JSON.parse(run('JSON.stringify(configuredUnitList())')), JSON.parse(run('before')));
  run(`
    applyConfiguredUnitAction(state.product, coversStep, configuredUnitActions(state.product, coversStep)[0]);
    applyConfiguredUnitAction(state.product, finishesStep, configuredUnitActions(state.product, finishesStep)[0]);
    applyConfiguredUnitAction(state.product, namesStep, configuredUnitActions(state.product, namesStep)[0]);
    setConfiguredUnitSharedName(state.product, 'Nome comum');
    applyConfiguredUnitAction(state.product, detailsStep, configuredUnitActions(state.product, detailsStep)[0]);
    // Tal como o renderer das linhas do passo Detalhes, resolver a fita de cada capa.
    for (var unitIndex = 0; unitIndex < configuredUnitCount(state.product); unitIndex++) {
      loadConfiguredUnit(state.product, unitIndex);
      syncPastaDeFolhetosDetailSelections(state.product, detailsStep);
      saveConfiguredUnit(state.product);
    }
  `);
  const grouped = JSON.parse(run('JSON.stringify(buildConfiguredUnitCartItems(state.product))'));
  assert.equal(grouped.length, 3);
  assert(grouped.every(item => item.summary.priceCents === (size === 'A4' ? 3890 : size === 'A6' ? 2390 : 5790)));
  groupCartItems.push(...grouped);
}
run(`
  state.selections = {size:'A4', cover_a4:'A4 · Opção 01', finish:'matte', cover_personalization_a4:'no'};
  state.itemDisplayLabels = {};
  syncPastaDeFolhetosDetailSelections(state.product, findStep(state.product, 'details'));
  setConfiguredUnitCount(state.product, 3);
  state.selections.configured_units[1] = cloneJson(state.selections.configured_units[0]);
  state.selections.configured_units[2] = cloneJson(state.selections.configured_units[0]);
  loadConfiguredUnit(state.product, 2);
  state.selections.cover_a4 = 'A4 · Opção 02';
  state.selections.cover_personalization_a4 = 'yes';
  state.selections.cover_personalization_a4_text = 'Teste';
  syncPastaDeFolhetosDetailSelections(state.product, findStep(state.product, 'details'));
`);
const cartItems = JSON.parse(run('JSON.stringify(buildConfiguredUnitCartItems(state.product))'));
assert.equal(cartItems.length, 3);
assert.equal(new Set(cartItems.map(x => x.id)).size, 3);
assert(cartItems.every(x => x.selections.pack_quantity === 1 && !x.selections.configured_units));
assert.equal(cartItems[0].selections.designs[0], cartItems[1].selections.designs[0]);
assert.notEqual(cartItems[0].selections.designs[0], cartItems[2].selections.designs[0]);
assert.deepEqual(cartItems.map(x => x.summary.priceCents), [3490, 3490, 3690]);
for (const size of ['A6', 'A4 + A6']) {
  run(`
    state.selections = {size:${JSON.stringify(size)}, cover_a4:'A4 · Opção 01', cover_a6:'A6 · Opção 02', finish:'matte', finish_a4:'matte', finish_a6:'glossy', cover_personalization_a4:'no', cover_personalization_a6:'no'};
    if (state.selections.size === 'A6') delete state.selections.cover_a4;
    syncPastaDeFolhetosDetailSelections(state.product, findStep(state.product, ${JSON.stringify(size === 'A6' ? 'details' : 'pack-details')}));
    setConfiguredUnitCount(state.product, 2);
    state.selections.configured_units[1] = cloneJson(state.selections.configured_units[0]);
    loadConfiguredUnit(state.product, 1);
  `);
  const additional = JSON.parse(run('JSON.stringify(buildConfiguredUnitCartItems(state.product))'));
  assert.deepEqual(additional.map(x => x.summary.priceCents), size === 'A6' ? [1990,1990] : [4990,4990]);
  assert(additional.every(x => x.selections.designs.length === (size === 'A6' ? 1 : 2)));
  cartItems.push(...additional);
}
// Passos em linhas: uma linha por capa (A4 e A6 no conjunto), cada uma com
// os seus rádios e os campos da capa certa.
// Os módulos do DOM (01, 11) não correm aqui: só o essencial para o HTML.
run(`
  if (typeof escapeHtml !== 'function') var escapeHtml = function (v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  if (typeof ICON_CHECK === 'undefined') var ICON_CHECK = '<svg></svg>';
  if (typeof renderVisual !== 'function') var renderVisual = function (item) { return '<span data-visual="' + escapeHtml(item.value) + '"></span>'; };
  if (typeof renderDesignZoomButton !== 'function') var renderDesignZoomButton = function () { return ''; };
  if (typeof siteErrorMarkup !== 'function') var siteErrorMarkup = function (text) { return '<p>' + escapeHtml(text) + '</p>'; };
`);
run(`
  state.admin = false;
  state.invalidFields = [];
  state.selections = {size:'A4 + A6', cover_a4:'A4 · Opção 02', cover_a6:'A6 · Opção 01', finish_a4:'matte'};
  setConfiguredUnitCount(state.product, 2);
  state.selections.configured_units[1] = {cover_a4:'A4 · Opção 01', cover_a6:'A6 · Opção 02', finish_a6:'glossy'};
  loadConfiguredUnit(state.product, 0);
`);
for (const [stepId, kind] of [['pack-finishes', 'choice'], ['cover_personalization', 'name'], ['pack-details', 'details']]) {
  const html = run(`renderConfiguredUnitRows(state.product, findStep(state.product, ${JSON.stringify(stepId)}))`);
  assert.match(html, new RegExp('unit-rows--' + kind));
  assert.deepEqual([...html.matchAll(/aria-label="([^"]+)">/g)].map(m => m[1]).filter(x => /Pasta A/.test(x)), ['Conjunto 1 Pasta A4', 'Conjunto 1 Pasta A6', 'Conjunto 2 Pasta A4', 'Conjunto 2 Pasta A6']);
  assert.equal((html.match(/class="unit-row-set"/g) || []).length, 2);
}
const finishRows = run('renderConfiguredUnitRows(state.product, findStep(state.product, "pack-finishes"))');
assert.match(finishRows, /name="finish_a4__u0g0" value="matte" data-option-drawer-choice data-option-drawer-field="finish_a4" checked/);
assert.match(finishRows, /name="finish_a6__u1g1" value="glossy" data-option-drawer-choice data-option-drawer-field="finish_a6" checked/);
const detailRows = run('renderConfiguredUnitRows(state.product, findStep(state.product, "pack-details"))');
assert.match(detailRows, /data-pf-metal-corners-field="metal_corners_a4"/);
assert.match(detailRows, /data-continuous-variation-field="design_a4"/);
assert.equal(run('displayStepTitle(state.product, findStep(state.product, "cover_personalization"))'), 'Queres personalizar as Pastas de Folhetos com um nome?');
// Com "singleUnitLayoutSizes", o conjunto usa as linhas já com uma unidade;
// A4 ou A6 sozinhos continuam com o desenho de sempre.
run(`state.selections = {size:'A4 + A6', cover_a4:'A4 · Opção 02', cover_a6:'A6 · Opção 01', finish_a6:'glossy'};`);
assert.equal(run('configuredUnitLayoutActive(state.product, findStep(state.product, "pack-finishes"))'), true);
const singlePack = run('renderConfiguredUnitRows(state.product, findStep(state.product, "pack-finishes"))');
assert.deepEqual([...singlePack.matchAll(/aria-label="([^"]+)">/g)].map(m => m[1]).filter(x => /Pasta A/.test(x)), ['Pasta A4', 'Pasta A6']);
assert.match(singlePack, /name="finish_a6__u0g1" value="glossy" data-option-drawer-choice data-option-drawer-field="finish_a6" checked/);
run(`state.selections = {size:'A4', cover_a4:'A4 · Opção 02'};`);
assert.equal(run('configuredUnitLayoutActive(state.product, findStep(state.product, "extras"))'), false);
// "Quero que a Mia escolha": capas em Sortido e acabamento "A Mia escolhe",
// em todas as unidades; o passo fica válido e o checkout aceita.
for (const size of ['A4', 'A4 + A6']) {
  const coverStep = size === 'A4' ? 'covers' : 'pack-covers';
  const finishStep = size === 'A4' ? 'extras' : 'pack-finishes';
  const detailsStep = size === 'A4' ? 'details' : 'pack-details';
  run(`
    state.selections = {size:${JSON.stringify(size)}, cover_a4:'A4 · Opção 02', cover_a6:'A6 · Opção 01', cover_personalization_a4:'no', cover_personalization_a6:'no'};
    setConfiguredUnitCount(state.product, 2);
    configuredUnitList().concat([state.selections]).forEach(function (unit) { unit.cover_personalization_a4 = 'no'; unit.cover_personalization_a6 = 'no'; });
    toggleConfiguredUnitMiaChoice(state.product, findStep(state.product, ${JSON.stringify(coverStep)}));
    toggleConfiguredUnitMiaChoice(state.product, findStep(state.product, ${JSON.stringify(finishStep)}));
  `);
  assert.equal(run('state.selections.assorted_designs'), '1');
  assert.equal(run('state.selections.cover_a4'), undefined);
  for (const id of [coverStep, finishStep, detailsStep]) assert.equal(run(`validateStep(state.product, findStep(state.product, ${JSON.stringify(id)}))`), '', id);
  const miaItems = JSON.parse(run('JSON.stringify(buildConfiguredUnitCartItems(state.product))'));
  assert.equal(miaItems.length, 2);
  assert(miaItems.every(x => x.selections.assorted_designs === '1' && x.selections.designs[0] === '__sortido__'));
  cartItems.push(...miaItems);
  // Desligar repõe as capas que lá estavam.
  run(`toggleConfiguredUnitMiaChoice(state.product, findStep(state.product, ${JSON.stringify(coverStep)}))`);
  assert.equal(run('state.selections.assorted_designs'), '');
  assert.equal(run('JSON.stringify(configuredUnitSelections(state.product).map(x => x.cover_a4))'), JSON.stringify(['A4 · Opção 02', null]));
}
cartItems.push(...groupCartItems);
if (process.env.PHP_BINARY) {
  const result = require('node:child_process').spawnSync(process.env.PHP_BINARY, [path.join(__dirname, 'prepare-cart-items.php')], {input:JSON.stringify(cartItems), encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
  const prepared = JSON.parse(result.stdout);
  prepared.forEach(item => assert.deepEqual(item.errors, []));
  assert.deepEqual(prepared.map(x => x.price_cents), cartItems.map(x => x.summary.priceCents));
  console.log('PASS: A4, A6 e PACK aceites pelo checkout PHP, com preços iguais aos do JavaScript.');
}
console.log('PASS: escolhas distintas/repetidas, nomes independentes, redução, validação de todas as unidades, mudança de tamanho e packs.');
