/* 01 · Calendário — datas, períodos, Páscoa e feriados.
   Funções puras: correm no browser e no Node (testes/testar.js).
   As datas são sempre Date em UTC à meia-noite, para não haver fusos. */
(function (raiz) {
  'use strict';
  const A = raiz.Agenda = raiz.Agenda || {};

  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
    'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const DIAS_ABREV = ['Dom.', 'Seg.', 'Ter.', 'Qua.', 'Qui.', 'Sex.', 'Sáb.'];
  const DIAS_INICIAL = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const UM_DIA = 86400000;

  function data(a, m, d) { return new Date(Date.UTC(a, m - 1, d)); }
  function chave(dt) { return dt.toISOString().slice(0, 10); }
  function deChave(k) { const [a, m, d] = k.split('-').map(Number); return data(a, m, d); }
  function somarDias(dt, n) { return new Date(dt.getTime() + n * UM_DIA); }
  function diasNoMes(a, m) { return new Date(Date.UTC(a, m, 0)).getUTCDate(); }

  /* Segunda-feira (ou domingo) da semana que contém dt. */
  function inicioSemana(dt, comeca) {
    const dow = dt.getUTCDay();
    const recuo = comeca === 'domingo' ? dow : (dow + 6) % 7;
    return somarDias(dt, -recuo);
  }

  /* Algoritmo gregoriano anónimo (Meeus/Jones/Butcher). */
  function pascoa(a) {
    const x = a % 19, b = Math.floor(a / 100), c = a % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * x + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((x + 11 * h + 22 * l) / 451);
    const n = h + l - 7 * m + 114;
    return data(a, Math.floor(n / 31), (n % 31) + 1);
  }

  const CONJUNTOS = {
    pt(a) {
      const p = pascoa(a);
      return [
        [data(a, 1, 1), 'Ano Novo', 'civil'],
        [somarDias(p, -2), 'Sexta-feira Santa', 'religioso'],
        [p, 'Páscoa', 'religioso'],
        [data(a, 4, 25), 'Dia da Liberdade', 'civil'],
        [data(a, 5, 1), 'Dia do Trabalhador', 'civil'],
        [somarDias(p, 60), 'Corpo de Deus', 'religioso'],
        [data(a, 6, 10), 'Dia de Portugal', 'civil'],
        [data(a, 8, 15), 'Assunção de Nossa Senhora', 'religioso'],
        [data(a, 10, 5), 'Implantação da República', 'civil'],
        [data(a, 11, 1), 'Todos os Santos', 'religioso'],
        [data(a, 12, 1), 'Restauração da Independência', 'civil'],
        [data(a, 12, 8), 'Imaculada Conceição', 'religioso'],
        [data(a, 12, 25), 'Natal', 'religioso']
      ];
    },
    'pt-carnaval'(a) { return [[somarDias(pascoa(a), -47), 'Carnaval', 'civil']]; }
  };

  /* Map chave → { nome, nomeNeutro, tipo } para os anos pedidos. */
  function feriados(conjuntos, anoIni, anoFim) {
    const mapa = new Map();
    for (const c of conjuntos || []) {
      const gerar = CONJUNTOS[c];
      if (!gerar) continue;
      for (let a = anoIni; a <= anoFim; a++) {
        for (const [dt, nome, tipo] of gerar(a)) {
          mapa.set(chave(dt), { nome, nomeNeutro: 'Feriado', tipo });
        }
      }
    }
    return mapa;
  }

  function infoMes(a, m) {
    return { numero: m, ano: a, nome: MESES[m - 1], abrev: MESES_ABREV[m - 1], dias: diasNoMes(a, m) };
  }

  function infoDia(dt, mapaFeriados) {
    const dow = dt.getUTCDay();
    const k = chave(dt);
    return {
      data: dt, chave: k, dow,
      numero: dt.getUTCDate(), mes: dt.getUTCMonth() + 1, ano: dt.getUTCFullYear(),
      nome: DIAS[dow], abrev: DIAS_ABREV[dow], inicial: DIAS_INICIAL[dow],
      fimDeSemana: dow === 0 || dow === 6,
      feriado: mapaFeriados ? mapaFeriados.get(k) || null : null
    };
  }

  function listaDias(ini, fim) {
    const r = [];
    for (let d = ini; d <= fim; d = somarDias(d, 1)) r.push(d);
    return r;
  }

  function listaMeses(ini, fim) {
    const r = [];
    let a = ini.getUTCFullYear(), m = ini.getUTCMonth() + 1;
    const af = fim.getUTCFullYear(), mf = fim.getUTCMonth() + 1;
    while (a < af || (a === af && m <= mf)) {
      r.push(infoMes(a, m));
      if (++m > 12) { m = 1; a++; }
    }
    return r;
  }

  function listaSemanas(ini, fim, comeca) {
    const r = [];
    for (let s = inicioSemana(ini, comeca); s <= fim; s = somarDias(s, 7)) r.push(s);
    return r;
  }

  /* Número da semana segundo a ISO 8601 (a semana da quinta-feira). */
  function semanaIso(dt) {
    const quinta = somarDias(dt, 3 - (dt.getUTCDay() + 6) % 7);
    const inicioAno = Date.UTC(quinta.getUTCFullYear(), 0, 1);
    return Math.floor((quinta.getTime() - inicioAno) / UM_DIA / 7) + 1;
  }

  /* "2027" ou "2026/27". */
  function rotuloPeriodo(ini, fim) {
    const a = ini.getUTCFullYear(), b = fim.getUTCFullYear();
    return a === b ? String(a) : a + '/' + String(b).slice(-2);
  }

  A.calendario = {
    MESES, MESES_ABREV, DIAS, DIAS_ABREV, DIAS_INICIAL,
    data, chave, deChave, somarDias, diasNoMes, inicioSemana, pascoa,
    feriados, infoMes, infoDia, listaDias, listaMeses, listaSemanas, rotuloPeriodo, semanaIso
  };
  if (typeof module !== 'undefined') module.exports = A.calendario;
})(typeof window !== 'undefined' ? window : globalThis);
