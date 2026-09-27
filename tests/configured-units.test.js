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
assert.match(run('validateStep(state.product, findStep(state.product, "covers"))'), /^Falta escolher 1 pasta A4/);
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
assert.match(run('validateStep(state.product, findStep(state.product, "pack-covers"))'), /^Falta escolher 2 pastas A4/);
// Sem opt-in, os restantes produtos mantêm uma única configuração.
assert.equal(run('configuredUnitCount({steps:[]})'), 1);
run(`
  state.selections = {size:'A4', cover_a4:'A4 · Opção 01', finish:'matte'};
  setConfiguredUnitCount(state.product, 2);
  state.currentStep = visibleSteps(state.product).findIndex(function (step) { return step.id === 'extras'; });
  rerenderProduct = function () {};
  goNext(state.product);
`);
assert.equal(run('currentStep(state.product).id'), 'extras');
assert.equal(run('configuredUnitIndex(state.product)'), 1);
assert.equal(run('state.errors'), '');
// Distribuição pelos contadores: repetidos, limite do total e reatribuição.
for (const size of ['A4', 'A6', 'A4 + A6']) {
  run(`state.selections = {size:${JSON.stringify(size)}}; setConfiguredUnitCount(state.product, 3);`);
  const stepId = size === 'A4 + A6' ? 'pack-covers' : 'covers';
  run(`var counterStep = findStep(state.product, '${stepId}'); var counterGroups = configuredDesignGroups(state.product, counterStep); var counterItems = configuredDesignItems(state.product, counterStep);`);
  for (let g = 0; g < (size === 'A4 + A6' ? 2 : 1); g++) {
    const change = (item, delta) => run(`changeConfiguredDesignQuantity(state.product, counterStep, counterGroups[${g}], counterItems[${item}], ${delta})`);
    assert.equal(change(0, -1), false);
    assert.equal(change(0, 1), true);
    assert.equal(change(0, 1), true);
    assert.equal(change(1, 1), true);
    assert.equal(change(2, 1), false);
    assert.equal(run(`configuredDesignQuantity(state.product, counterGroups[${g}].field, configuredDesignValue(counterStep, counterGroups[${g}], counterItems[0]))`), 2);
    assert.equal(change(0, -1), true);
    assert.equal(change(2, 1), true);
    assert.equal(run(`configuredDesignRemaining(state.product, counterStep, counterGroups[${g}])`), 0);
  }
  assert.equal(run('validateStep(state.product, counterStep)'), '');
  assert.equal(run('isConfiguredQuantityStep(state.product, counterStep)'), true);
  run('setConfiguredUnitCount(state.product, 1)');
  assert.equal(run('usesConfiguredDesignCounters(state.product, counterStep)'), false);
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
    syncPastaDeFolhetosDetailSelections(state.product, findStep(state.product, ${JSON.stringify(size === 'A6' ? 'details' : 'pack-details')}));
    setConfiguredUnitCount(state.product, 2);
    state.selections.configured_units[1] = cloneJson(state.selections.configured_units[0]);
  `);
  const additional = JSON.parse(run('JSON.stringify(buildConfiguredUnitCartItems(state.product))'));
  assert.deepEqual(additional.map(x => x.summary.priceCents), size === 'A6' ? [1990,1990] : [4990,4990]);
  assert(additional.every(x => x.selections.designs.length === (size === 'A6' ? 1 : 2)));
  cartItems.push(...additional);
}
if (process.env.PHP_BINARY) {
  const result = require('node:child_process').spawnSync(process.env.PHP_BINARY, [path.join(__dirname, 'prepare-cart-items.php')], {input:JSON.stringify(cartItems), encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
  const prepared = JSON.parse(result.stdout);
  prepared.forEach(item => assert.deepEqual(item.errors, []));
  assert.deepEqual(prepared.map(x => x.price_cents), cartItems.map(x => x.summary.priceCents));
  console.log('PASS: A4, A6 e PACK aceites pelo checkout PHP, com preços iguais aos do JavaScript.');
}
console.log('PASS: escolhas distintas/repetidas, nomes independentes, redução, validação de todas as unidades, mudança de tamanho e packs.');
