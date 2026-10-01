/* 07 · Imposição — A4 em paisagem, duas páginas A5 por face, duplex,
   corte ao centro, monte da esquerda por cima do da direita (corta-e-empilha).
   Ver ESPECIFICACAO.md, Anexo B. Função pura; páginas numeradas a partir de 1,
   null = página em branco. */
(function (raiz) {
  'use strict';
  const A = raiz.Agenda = raiz.Agenda || {};

  function impor(n, virar) {
    const total = Math.max(4, Math.ceil(n / 4) * 4);
    const F = total / 4;
    const p = k => (k <= n ? k : null);
    const longo = virar === 'lado-longo';
    const folhas = [];
    for (let i = 0; i < F; i++) {
      folhas.push({
        frente: [p(2 * i + 1), p(2 * F + 2 * i + 1)],
        verso: longo ? [p(2 * i + 2), p(2 * F + 2 * i + 2)] : [p(2 * F + 2 * i + 2), p(2 * i + 2)],
        rodarVerso: longo
      });
    }
    return { total, folhas };
  }

  A.imposicao = { impor };
  if (typeof module !== 'undefined') module.exports = A.imposicao;
})(typeof window !== 'undefined' ? window : globalThis);
