/* 05 · Desenhar — uma página gerada vira DOM em mm. É a mesma função para o
   ecrã, as miniaturas e a impressão. */
(function (raiz) {
  'use strict';
  const A = raiz.Agenda = raiz.Agenda || {};

  function div(classe) { const d = document.createElement('div'); d.className = classe; return d; }

  function visivel(el, env) {
    return !el.edicoes || el.edicoes.includes(env.edicaoId);
  }

  function desenharElemento(el, ctx, env, pai, geo) {
    if (!visivel(el, env)) return;
    ctx = A.gerador.contextoLigado(el, ctx);
    if (!ctx) return; // ligado a um mês que não existe neste período
    const espelhado = el.espelhar && geo.lado === 'esquerda';
    const x = espelhado ? geo.largura - el.x - el.l : el.x;
    const caixa = div('el tipo-' + el.tipo);
    if (el.id) caixa.dataset.id = el.id;
    if (el._alterado || el._acrescentado) caixa.dataset.excepcao = '';
    Object.assign(caixa.style, { left: x + 'mm', top: el.y + 'mm', width: el.l + 'mm', height: el.a + 'mm' });
    const transformacoes = [];
    if (espelhado && el.tipo === 'decoracao') transformacoes.push('scaleX(-1)');
    if (el.rodar) transformacoes.push(`rotate(${el.rodar}deg)`);
    if (transformacoes.length) caixa.style.transform = transformacoes.join(' ');
    if (el.opacidade != null) caixa.style.opacity = el.opacidade;

    if (el.tipo === 'grupo') {
      for (const filho of el.elementos) desenharElemento(filho, ctx, env, caixa, { largura: el.l, lado: geo.lado });
    } else {
      const comp = A.componentes.obter(el.tipo);
      if (!comp) throw new Error('Componente desconhecido: ' + el.tipo);
      const r = comp.desenhar(el, ctx, env, { l: el.l, a: el.a });
      if (typeof r === 'string') caixa.innerHTML = r; else caixa.appendChild(r);
    }
    pai.appendChild(caixa);
  }

  function guias(pagina, fmt, geo) {
    const g = div('guias');
    const c = div('guia-conteudo');
    Object.assign(c.style, { left: geo.esquerda + 'mm', top: fmt.margens.topo + 'mm', width: geo.largura + 'mm', height: geo.altura + 'mm' });
    const furos = div('guia-furos');
    const banda = fmt.furos.distancia + fmt.furos.diametro;
    Object.assign(furos.style, { width: banda + 'mm' });
    furos.style[pagina.lado === 'direita' ? 'left' : 'right'] = 0;
    g.append(c, furos);
    return g;
  }

  /* pagina: { molde, ctx, lado }. Uma página sem molde é uma página em branco. */
  function desenharPagina(pagina, projecto, env) {
    const fmt = projecto.formato;
    const p = div('pagina');
    Object.assign(p.style, { width: fmt.pagina.largura + 'mm', height: fmt.pagina.altura + 'mm' });
    p.dataset.lado = pagina.lado;

    const m = fmt.margens;
    const geo = {
      esquerda: pagina.lado === 'direita' ? m.interior : m.exterior,
      largura: fmt.pagina.largura - m.interior - m.exterior,
      altura: fmt.pagina.altura - m.topo - m.base,
      lado: pagina.lado
    };

    if (pagina.molde) {
      const molde = projecto.moldes[pagina.molde];
      const conteudo = div('conteudo');
      Object.assign(conteudo.style, { left: geo.esquerda + 'mm', top: m.topo + 'mm', width: geo.largura + 'mm', height: geo.altura + 'mm' });
      for (const el of A.gerador.aplicarExcepcao(molde.elementos, pagina.excepcao)) desenharElemento(el, pagina.ctx, env, conteudo, geo);
      p.appendChild(conteudo);
    }
    if (env.guias) p.appendChild(guias(pagina, fmt, geo));
    return p;
  }

  /* Geometria da caixa de conteúdo de uma página (em mm). */
  function geometria(projecto, lado) {
    const fmt = projecto.formato, m = fmt.margens;
    return {
      esquerda: lado === 'direita' ? m.interior : m.exterior,
      topo: m.topo,
      largura: fmt.pagina.largura - m.interior - m.exterior,
      altura: fmt.pagina.altura - m.topo - m.base,
      lado
    };
  }

  A.desenhar = { pagina: desenharPagina, geometria };
})(typeof window !== 'undefined' ? window : globalThis);
