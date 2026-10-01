/* 06 · Gerador — projecto + edição → lista de páginas, cada uma com o seu molde,
   contexto (datas, textos) e chave estável. Função pura. */
(function (raiz) {
  'use strict';
  const A = raiz.Agenda = raiz.Agenda || {};

  function ladoDe(numero, primeira) {
    const impar = numero % 2 === 1;
    return (primeira === 'esquerda') === impar ? 'esquerda' : 'direita';
  }

  /* periodo (opcional) substitui o da edição, para pré-visualizar uma semana. */
  function gerar(projecto, edicaoId, periodo) {
    const C = A.calendario;
    const ed = projecto.edicoes[edicaoId];
    const per = periodo || ed.periodo;
    const ini = C.deChave(per.inicio), fim = C.deChave(per.fim);
    const feriados = C.feriados(ed.feriados, ini.getUTCFullYear() - 1, fim.getUTCFullYear() + 1);
    const primeira = projecto.formato.primeiraPagina || 'direita';
    const iniEd = C.deChave(ed.periodo.inicio), fimEd = C.deChave(ed.periodo.fim);
    const base = {
      periodo: {
        rotulo: C.rotuloPeriodo(iniEd, fimEd),
        anterior: iniEd.getUTCFullYear() - 1,
        meses: C.listaMeses(iniEd, fimEd)
      },
      texto: Object.assign({}, ed.textos)
    };
    const paginas = [];

    const excepcoes = ed.excepcoes || {};
    const eventos = mapaEventos(ed.eventos);
    base._conteudos = ed.conteudos || {};
    base.conteudo = conteudoDe(base._conteudos, null, null);
    function juntar(molde, ctx, chave, bloco) {
      const numero = paginas.length + 1;
      paginas.push({ molde, ctx, chave, numero, bloco, lado: ladoDe(numero, primeira), excepcao: excepcoes[chave] || null });
    }

    function ctxDia(dt, extra) {
      const dia = C.infoDia(dt, feriados);
      dia.rotuloFeriado = dia.feriado ? dia.feriado.nomeNeutro : '';
      dia.evento = (eventos.get(dia.chave) || []).join(' · ');
      dia.semana = C.chave(C.inicioSemana(dt));
      const mes = C.infoMes(dia.ano, dia.mes);
      return Object.assign({}, extra, { dia, mes, conteudo: conteudoDe(base._conteudos, mes, dia.semana) });
    }

    projecto.sequencia.forEach((b, indice) => {
      if (b.edicoes && !b.edicoes.includes(edicaoId)) return;
      const moldes = b.moldes || [b.molde];
      const ctxBloco = Object.assign({}, base, { texto: Object.assign({}, base.texto, b.textos) });

      if (b.comecaEm && ladoDe(paginas.length + 1, primeira) !== b.comecaEm) {
        juntar(b.enchimento || null, ctxBloco, 'enchimento#' + paginas.length, indice);
      }

      if (b.repetir === 'dia') {
        for (const dt of C.listaDias(ini, fim)) {
          const ctx = ctxDia(dt, ctxBloco);
          for (const m of moldes) juntar(m, ctx, m + '@' + ctx.dia.chave, indice);
        }
      } else if (b.repetir === 'mes') {
        for (const mes of C.listaMeses(ini, fim)) {
          const ctx = Object.assign({}, ctxBloco, { mes, conteudo: conteudoDe(base._conteudos, mes, null) });
          const k = mes.ano + '-' + String(mes.numero).padStart(2, '0');
          for (const m of moldes) juntar(m, ctx, m + '@' + k, indice);
        }
      } else if (b.repetir === 'semana') {
        for (const s of C.listaSemanas(ini, fim, b.semanaComeca)) {
          const dias = C.listaDias(s, C.somarDias(s, 6)).map(d => ctxDia(d, {}).dia);
          const ctx = Object.assign(ctxDia(s, ctxBloco), { semana: infoSemana(s, dias) });
          for (const m of moldes) juntar(m, ctx, m + '@' + C.chave(s), indice);
        }
      } else {
        for (let i = 0; i < (b.vezes || 1); i++) {
          for (const m of moldes) juntar(m, ctxBloco, m + '#' + (i + 1), indice);
        }
      }
    });

    const ultimo = projecto.sequencia[projecto.sequencia.length - 1];
    if (ultimo && ultimo.completar) {
      while (paginas.length % ultimo.completar) {
        juntar(ultimo.molde, base, ultimo.molde + '#extra' + paginas.length, projecto.sequencia.length - 1);
      }
    }

    return { paginas, feriados, eventos };
  }

  /* Eventos da edição (dia ou intervalo) → Map chave do dia → [nomes]. */
  function mapaEventos(lista) {
    const C = A.calendario;
    const mapa = new Map();
    for (const ev of lista || []) {
      if (!ev.de || !ev.nome) continue;
      const ini = C.deChave(ev.de), fim = C.deChave(ev.ate && ev.ate >= ev.de ? ev.ate : ev.de);
      for (const d of C.listaDias(ini, fim)) {
        const k = C.chave(d);
        if (!mapa.has(k)) mapa.set(k, []);
        mapa.get(k).push(ev.nome);
      }
    }
    return mapa;
  }

  /* Textos da edição ligados a datas: a frase do mês e o texto da semana. */
  function chaveMes(mes) { return mes ? mes.ano + '-' + String(mes.numero).padStart(2, '0') : null; }
  function conteudoDe(conteudos, mes, semana) {
    return {
      fraseMes: (mes && conteudos.fraseMes && conteudos.fraseMes[chaveMes(mes)]) || '',
      textoSemana: (semana && conteudos.textoSemana && conteudos.textoSemana[semana]) || ''
    };
  }

  /* Título de uma semana: "Janeiro" ou "Dezembro/Janeiro", "2027" ou "2026/2027". */
  function infoSemana(inicio, dias) {
    const C = A.calendario;
    const a = dias[0], b = dias[dias.length - 1];
    return {
      inicio: C.chave(inicio), dias,
      titulo: a.mes === b.mes ? C.MESES[a.mes - 1] : C.MESES[a.mes - 1] + '/' + C.MESES[b.mes - 1],
      ano: a.ano === b.ano ? String(a.ano) : a.ano + '/' + b.ano,
      numero: C.semanaIso(inicio)
    };
  }

  /* Contexto de um elemento ligado a um dia da semana ou a um mês do período. */
  function contextoLigado(el, ctx) {
    const liga = el.liga;
    if (!liga) return ctx;
    const conteudos = ctx._conteudos || {};
    if (liga.dia != null && ctx.semana) {
      const dia = ctx.semana.dias[liga.dia];
      if (!dia) return ctx;
      const mes = A.calendario.infoMes(dia.ano, dia.mes);
      return Object.assign({}, ctx, { dia, mes, conteudo: conteudoDe(conteudos, mes, dia.semana) });
    }
    if (liga.mes != null && ctx.periodo && ctx.periodo.meses) {
      const mes = ctx.periodo.meses[liga.mes];
      return mes ? Object.assign({}, ctx, { mes, dia: null, conteudo: conteudoDe(conteudos, mes, null) }) : null;
    }
    return ctx;
  }

  /* Excepções: { alterar: {id: {props}}, ocultar: [ids], acrescentar: [elementos] }.
     Guardam só a diferença em relação ao molde. */
  function aplicarExcepcao(elementos, exc) {
    if (!exc) return elementos;
    const ocultos = new Set(exc.ocultar || []);
    const alterar = exc.alterar || {};
    const r = [];
    for (const el of elementos) {
      if (ocultos.has(el.id)) continue;
      const mud = alterar[el.id];
      if (!mud) { r.push(el); continue; }
      const novo = Object.assign({}, el, mud, { _alterado: true });
      if (mud.sobre) novo.sobre = Object.assign({}, el.sobre, mud.sobre);
      r.push(novo);
    }
    for (const el of exc.acrescentar || []) r.push(Object.assign({}, el, { _acrescentado: true }));
    return r;
  }

  A.gerador = { gerar, ladoDe, aplicarExcepcao, contextoLigado, chaveMes };
})(typeof window !== 'undefined' ? window : globalThis);
