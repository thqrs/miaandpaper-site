/* Testes das funções puras. Correr com: node testes/testar.js */
'use strict';
const assert = require('assert');
const C = require('../js/01-calendario.js');
const { impor } = require('../js/07-imposicao.js');

let falhas = 0;
function caso(nome, fn) {
  try { fn(); console.log('  ok   ' + nome); } catch (e) { falhas++; console.log('  FALHA ' + nome + '\n       ' + e.message); }
}

console.log('Calendário');
caso('Páscoa 2024–2030', () => {
  const esperado = { 2024: '2024-03-31', 2025: '2025-04-20', 2026: '2026-04-05', 2027: '2027-03-28', 2028: '2028-04-16', 2029: '2029-04-01', 2030: '2030-04-21' };
  for (const [a, k] of Object.entries(esperado)) assert.strictEqual(C.chave(C.pascoa(+a)), k, a);
});
caso('Feriados 2026 = círculos da agenda 2026', () => {
  const f = C.feriados(['pt'], 2026, 2026);
  const esperado = ['2026-01-01', '2026-04-03', '2026-04-05', '2026-04-25', '2026-05-01', '2026-06-04', '2026-06-10',
    '2026-08-15', '2026-10-05', '2026-11-01', '2026-12-01', '2026-12-08', '2026-12-25'];
  assert.deepStrictEqual([...f.keys()].sort(), esperado);
});
caso('Semana de 1 Jan 2026 começa a 29 Dez 2025', () => {
  assert.strictEqual(C.chave(C.inicioSemana(C.data(2026, 1, 1))), '2025-12-29');
});
caso('Set–Ago dá "2026/27" e 12 meses', () => {
  const ini = C.data(2026, 9, 1), fim = C.data(2027, 8, 31);
  assert.strictEqual(C.rotuloPeriodo(ini, fim), '2026/27');
  assert.strictEqual(C.listaMeses(ini, fim).length, 12);
});
caso('2028 é bissexto', () => assert.strictEqual(C.diasNoMes(2028, 2), 29));

console.log('Imposição');
caso('8 páginas, lado curto (Anexo B)', () => {
  const { folhas } = impor(8, 'lado-curto');
  assert.deepStrictEqual(folhas.map(f => [f.frente, f.verso]), [[[1, 5], [6, 2]], [[3, 7], [8, 4]]]);
});
caso('10 páginas completam para 12 com brancos', () => {
  const { total, folhas } = impor(10, 'lado-curto');
  assert.strictEqual(total, 12);
  const todas = folhas.flatMap(f => [...f.frente, ...f.verso]).filter(Boolean).sort((a, b) => a - b);
  assert.deepStrictEqual(todas, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
caso('Corta-e-empilha repõe a ordem de leitura (156 páginas)', () => {
  const { folhas } = impor(156, 'lado-curto');
  // Depois do corte: monte esquerdo (frente[0] / verso[1]) por cima do direito (frente[1] / verso[0]).
  const esquerda = folhas.flatMap(f => [f.frente[0], f.verso[1]]);
  const direita = folhas.flatMap(f => [f.frente[1], f.verso[0]]);
  assert.deepStrictEqual([...esquerda, ...direita], Array.from({ length: 156 }, (_, i) => i + 1));
});

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
