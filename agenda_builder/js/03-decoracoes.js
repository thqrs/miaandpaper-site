/* 03 · Decorações botânicas em traço fino, desenhadas em SVG vectorial.
   Provisórias: servem para testar o estilo e a impressão até existir a arte
   da Miriam. Todas as medidas em mm; o desenho é feito para uma página da
   direita e espelhado nas da esquerda. */
(function (raiz) {
  'use strict';
  const A = raiz.Agenda = raiz.Agenda || {};

  function aleatorio(semente) {
    let s = semente >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const f = n => (Math.round(n * 100) / 100).toString();

  /* Ponto e tangente de uma cúbica de Bézier. */
  function bezier(p, t) {
    const u = 1 - t;
    const x = u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0];
    const y = u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1];
    const dx = 3 * u * u * (p[1][0] - p[0][0]) + 6 * u * t * (p[2][0] - p[1][0]) + 3 * t * t * (p[3][0] - p[2][0]);
    const dy = 3 * u * u * (p[1][1] - p[0][1]) + 6 * u * t * (p[2][1] - p[1][1]) + 3 * t * t * (p[3][1] - p[2][1]);
    return { x, y, ang: Math.atan2(dy, dx) * 180 / Math.PI };
  }

  function folha(x, y, ang, L, W, cores) {
    const forma = `M0 0 C${f(L * .22)} ${f(-W)} ${f(L * .72)} ${f(-W * .95)} ${f(L)} 0 ` +
      `C${f(L * .7)} ${f(W * .8)} ${f(L * .25)} ${f(W * .85)} 0 0Z`;
    const nervura = `M${f(L * .06)} 0Q${f(L * .5)} ${f(-W * .1)} ${f(L * .9)} 0`;
    return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})">` +
      `<path d="${forma}" fill="${cores.folha}" stroke="${cores.traco}"/>` +
      `<path d="${nervura}" fill="none" stroke="${cores.traco}" stroke-width="${f(cores.espessura * .7)}"/></g>`;
  }

  function flor(x, y, r, petalas, rodar, cores) {
    let s = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rodar)})">`;
    const petala = `M0 0C${f(r * .15)} ${f(-r * .55)} ${f(r * .85)} ${f(-r * .5)} ${f(r)} 0` +
      `C${f(r * .85)} ${f(r * .5)} ${f(r * .15)} ${f(r * .55)} 0 0Z`;
    for (let i = 0; i < petalas; i++) {
      s += `<path d="${petala}" transform="rotate(${f(i * 360 / petalas)})" fill="${cores.petala}" stroke="${cores.traco}"/>`;
    }
    s += `<circle r="${f(r * .2)}" fill="${cores.traco}"/>`;
    for (let i = 0; i < petalas; i++) {
      const a = (i + .5) * 2 * Math.PI / petalas;
      s += `<circle cx="${f(Math.cos(a) * r * .34)}" cy="${f(Math.sin(a) * r * .34)}" r="${f(r * .05)}" fill="${cores.traco}"/>`;
    }
    return s + '</g>';
  }

  function botao(x, y, ang, r, cores) {
    return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})">` +
      `<path d="M0 0C${f(r * .3)} ${f(-r * .6)} ${f(r * 1.3)} ${f(-r * .5)} ${f(r * 1.5)} 0` +
      `C${f(r * 1.3)} ${f(r * .5)} ${f(r * .3)} ${f(r * .6)} 0 0Z" fill="${cores.petala}" stroke="${cores.traco}"/></g>`;
  }

  /* Um raminho: haste curva com folhas alternadas e, na ponta, flor ou botão. */
  function ramo(de, ate, opcoes, cores, rnd) {
    const dx = ate[0] - de[0], dy = ate[1] - de[1];
    const comp = Math.hypot(dx, dy);
    const nx = -dy / comp, ny = dx / comp;
    const c = opcoes.curva * comp;
    const p = [de,
      [de[0] + dx * .33 + nx * c, de[1] + dy * .33 + ny * c],
      [de[0] + dx * .66 + nx * c * .6, de[1] + dy * .66 + ny * c * .6],
      ate];
    let s = `<path d="M${f(p[0][0])} ${f(p[0][1])}C${f(p[1][0])} ${f(p[1][1])} ${f(p[2][0])} ${f(p[2][1])} ` +
      `${f(p[3][0])} ${f(p[3][1])}" fill="none" stroke="${cores.traco}"/>`;
    const n = opcoes.folhas;
    for (let i = 0; i < n; i++) {
      const t = .14 + .8 * i / Math.max(1, n - 1) * (opcoes.flor ? .86 : 1);
      const b = bezier(p, t);
      const lado = i % 2 ? 1 : -1;
      const escala = 1 - t * .45;
      const L = opcoes.folha * escala * (.85 + rnd() * .3);
      s += folha(b.x, b.y, b.ang + lado * (38 + rnd() * 16), L, L * .36, cores);
    }
    if (opcoes.flor) s += flor(ate[0], ate[1], opcoes.flor, opcoes.petalas || 5, rnd() * 72, cores);
    else if (opcoes.botao) s += botao(ate[0], ate[1], bezier(p, 1).ang, opcoes.botao, cores);
    return s;
  }

  function coresDe(opcoes) {
    return {
      traco: opcoes.cor, folha: opcoes.corFolha, petala: opcoes.corPetala || opcoes.corFolha,
      espessura: opcoes.espessura || .22
    };
  }

  function svg(l, a, conteudo, cores) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(l)} ${f(a)}" ` +
      `width="${f(l)}mm" height="${f(a)}mm" style="overflow:visible" stroke-width="${f(cores.espessura)}" ` +
      `stroke-linecap="round" stroke-linejoin="round">${conteudo}</svg>`;
  }

  const DESENHOS = {
    /* Canto inferior exterior: três raminhos a sair do canto. */
    canto(l, a, opcoes) {
      const rnd = aleatorio(opcoes.semente || 7), cores = coresDe(opcoes);
      const o = [l * .96, a * .98];
      let s = '';
      s += ramo(o, [l * .08, a * .62], { curva: .16, folhas: 7, folha: l * .17 }, cores, rnd);
      s += ramo(o, [l * .5, a * .06], { curva: -.12, folhas: 6, folha: l * .15, flor: l * .085, petalas: 6 }, cores, rnd);
      s += ramo([l * .9, a * .9], [l * .3, a * .3], { curva: .1, folhas: 4, folha: l * .12, botao: l * .03 }, cores, rnd);
      s += flor(l * .8, a * .74, l * .07, 5, 20, cores);
      return svg(l, a, s, cores);
    },
    /* Pequeno raminho diagonal com uma flor. */
    raminho(l, a, opcoes) {
      const rnd = aleatorio(opcoes.semente || 3), cores = coresDe(opcoes);
      const s = ramo([l * .05, a * .95], [l * .78, a * .22], { curva: .12, folhas: 5, folha: l * .26, flor: l * .14, petalas: 5 }, cores, rnd);
      return svg(l, a, s, cores);
    },
    /* Grinalda no canto superior exterior, a descer ao longo do topo. */
    grinalda(l, a, opcoes) {
      const rnd = aleatorio(opcoes.semente || 11), cores = coresDe(opcoes);
      const o = [l * 1.02, a * .02];
      let s = '';
      s += ramo(o, [l * .04, a * .34], { curva: .08, folhas: 11, folha: l * .08 }, cores, rnd);
      s += ramo(o, [l * .55, a * .92], { curva: -.18, folhas: 6, folha: l * .085, flor: l * .05, petalas: 6 }, cores, rnd);
      s += ramo([l * .86, a * .12], [l * .3, a * .72], { curva: .2, folhas: 5, folha: l * .07, botao: l * .016 }, cores, rnd);
      s += flor(l * .76, a * .34, l * .06, 5, 10, cores);
      s += flor(l * .92, a * .62, l * .038, 6, 40, cores);
      return svg(l, a, s, cores);
    }
  };

  A.decoracoes = {
    desenhar(nome, l, a, opcoes) {
      const d = DESENHOS[nome];
      return d ? d(l, a, opcoes) : '';
    },
    nomes: Object.keys(DESENHOS)
  };
})(typeof window !== 'undefined' ? window : globalThis);
