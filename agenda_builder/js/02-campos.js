/* 02 · Campos e cores — resolve {campos} no texto e referências de cor
   (nomes da paleta, @mes.forte, @mes.claro, hexadecimais). */
(function (raiz) {
  'use strict';
  const A = raiz.Agenda = raiz.Agenda || {};

  function hexParaRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbParaHex(rgb) {
    return '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  }

  /* Mistura a com b; t = 0 dá a, t = 1 dá b. */
  function misturar(a, b, t) {
    const x = hexParaRgb(a), y = hexParaRgb(b);
    return rgbParaHex(x.map((v, i) => v + (y[i] - v) * t));
  }

  /* Os três tons de um mês. Só o forte é obrigatório no tema. */
  function tonsDoMes(tema, mes, papel) {
    let base = tema.todosOsMeses || null;
    if (!base && tema.meses && mes) base = tema.meses[mes - 1];
    if (!base) base = tema.neutro;
    return {
      forte: base.forte,
      medio: base.medio || misturar(base.forte, papel, 0.45),
      claro: base.claro || misturar(base.forte, papel, 0.84)
    };
  }

  /* Devolve um valor CSS a partir de uma referência de cor. */
  function cor(ref, env, ctx) {
    if (!ref) return 'transparent';
    if (typeof ref === 'object') {
      const c = cor(ref.cor, env, ctx);
      return ref.intensidade != null ? misturar(c, env.estilos.cores.papel, 1 - ref.intensidade) : c;
    }
    if (ref[0] === '#') return ref;
    if (ref[0] === '@') {
      const [grupo, tom] = ref.slice(1).split('.');
      if (grupo === 'mes') {
        const mes = ctx && ctx.mes ? ctx.mes.numero : null;
        return tonsDoMes(env.tema, mes, env.estilos.cores.papel)[tom || 'forte'];
      }
    }
    return env.estilos.cores[ref] || ref;
  }

  function procurar(obj, caminho) {
    return caminho.split('.').reduce((o, p) => (o == null ? undefined : o[p]), obj);
  }

  /* Substitui {dia.numero}, {mes.nome}, {texto.titulo}… Campos sem valor ficam vazios. */
  function texto(modelo, ctx) {
    if (modelo == null) return '';
    return String(modelo).replace(/\{([\w.]+)\}/g, (_, caminho) => {
      const v = procurar(ctx, caminho);
      return v == null ? '' : String(v);
    });
  }

  A.campos = { misturar, tonsDoMes, cor, texto };
})(typeof window !== 'undefined' ? window : globalThis);
