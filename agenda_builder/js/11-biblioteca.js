/* 11 · Biblioteca — fontes e imagens do projecto: importar, registar, listar. */
(function () {
  'use strict';
  const A = window.Agenda;
  const B = A.biblioteca = {};

  /* Fontes que vêm do Google Fonts (index.html). As importadas juntam-se a estas. */
  B.FONTES_BASE = ['Cormorant Garamond', 'Jost', 'Playfair Display', 'Montserrat', 'Pinyon Script',
    'Sacramento', 'Parisienne', 'Allura', 'Ephesis', 'Italianno'];

  const EXT_FONTE = ['ttf', 'otf', 'woff', 'woff2'];
  const EXT_IMAGEM = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
  const extensao = nome => (nome.split('.').pop() || '').toLowerCase();
  B.ehFonte = f => EXT_FONTE.includes(extensao(f.name));
  B.ehImagem = f => EXT_IMAGEM.includes(extensao(f.name));

  B.familias = function (p) {
    const importadas = Object.values(p.biblioteca.fontes).map(f => f.familia);
    return [...new Set([...importadas, ...B.FONTES_BASE])];
  };

  const registadas = new Set();
  B.registarFontes = function (p) {
    for (const f of Object.values(p.biblioteca.fontes)) {
      const k = f.ficheiro;
      if (registadas.has(k)) continue;
      registadas.add(k);
      const face = new FontFace(f.familia, `url("${f.ficheiro}")`, { weight: String(f.peso || 400), style: f.italico ? 'italic' : 'normal' });
      face.load().then(ff => { document.fonts.add(ff); document.dispatchEvent(new Event('agendas:fontes')); })
        .catch(e => console.warn('Fonte não carregou:', f.ficheiro, e));
    }
  };

  /* ---------- ler o nome, o peso e o itálico de uma fonte ---------- */
  async function tabelasWoff(buf) {
    const v = new DataView(buf);
    const n = v.getUint16(12);
    const tabelas = {};
    for (let i = 0; i < n; i++) {
      const o = 44 + i * 20;
      const tag = String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
      if (tag !== 'name' && tag !== 'OS/2') continue;
      const off = v.getUint32(o + 4), comp = v.getUint32(o + 8), orig = v.getUint32(o + 12);
      let dados = buf.slice(off, off + comp);
      if (comp < orig) {
        const s = new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate'));
        dados = await new Response(s).arrayBuffer();
      }
      tabelas[tag] = new DataView(dados);
    }
    return tabelas;
  }

  function tabelasSfnt(buf) {
    const v = new DataView(buf);
    const n = v.getUint16(4);
    const tabelas = {};
    for (let i = 0; i < n; i++) {
      const o = 12 + i * 16;
      const tag = String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
      if (tag === 'name' || tag === 'OS/2') tabelas[tag] = new DataView(buf, v.getUint32(o + 8), v.getUint32(o + 12));
    }
    return tabelas;
  }

  function lerNome(t) {
    const count = t.getUint16(2), base = t.getUint16(4);
    const nomes = {};
    for (let i = 0; i < count; i++) {
      const o = 6 + i * 12;
      const plataforma = t.getUint16(o), id = t.getUint16(o + 6), len = t.getUint16(o + 8), off = t.getUint16(o + 10);
      if (![1, 2, 16, 17].includes(id) || nomes[id + ':' + plataforma]) continue;
      let s = '';
      if (plataforma === 3 || plataforma === 0) {
        for (let j = 0; j < len; j += 2) s += String.fromCharCode(t.getUint16(base + off + j));
      } else {
        for (let j = 0; j < len; j++) s += String.fromCharCode(t.getUint8(base + off + j));
      }
      nomes[id + ':' + plataforma] = s;
    }
    const n = id => nomes[id + ':3'] || nomes[id + ':0'] || nomes[id + ':1'];
    return { familia: n(16) || n(1), estilo: n(17) || n(2) || '' };
  }

  function porNomeDoFicheiro(nome) {
    const base = nome.replace(/\.[^.]+$/, '');
    const italico = /italic|oblique/i.test(base);
    const pesos = { thin: 100, extralight: 200, light: 300, regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 };
    let peso = 400;
    for (const [p, v] of Object.entries(pesos)) if (new RegExp(p, 'i').test(base.replace(/[-_ ]/g, ''))) peso = v;
    const familia = base.replace(/[-_](thin|extralight|light|regular|medium|semibold|bold|extrabold|black|italic|oblique)+$/i, '')
      .replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
    return { familia, peso, italico };
  }

  async function lerFonte(ficheiro) {
    const info = porNomeDoFicheiro(ficheiro.name);
    try {
      const buf = await ficheiro.arrayBuffer();
      const assinatura = new TextDecoder().decode(new Uint8Array(buf, 0, 4));
      if (assinatura === 'wOF2') return info;
      const t = assinatura === 'wOFF' ? await tabelasWoff(buf) : tabelasSfnt(buf);
      if (t.name) {
        const n = lerNome(t.name);
        if (n.familia) info.familia = n.familia.trim();
      }
      if (t['OS/2']) {
        info.peso = t['OS/2'].getUint16(4) || info.peso;
        info.italico = (t['OS/2'].getUint16(62) & 1) === 1;
      }
    } catch (e) {
      console.warn('Não consegui ler o nome da fonte; uso o nome do ficheiro.', e);
    }
    return info;
  }

  function dimensoes(url) {
    return new Promise(res => {
      const i = new Image();
      i.onload = () => res({ largura: i.naturalWidth, altura: i.naturalHeight });
      i.onerror = () => res({ largura: 0, altura: 0 });
      i.src = url;
    });
  }

  async function carregar(ficheiro, tipo) {
    const p = A.modelo.obter();
    const f = new FormData();
    f.append('id', p.id);
    f.append('tipo', tipo);
    f.append('ficheiro', ficheiro);
    return A.modelo.api('carregar', { formulario: f });
  }

  /* Importa uma lista de ficheiros. Devolve as imagens importadas (para as
     poder pôr logo na página). */
  B.importar = async function (ficheiros) {
    const imagens = [];
    for (const ficheiro of ficheiros) {
      if (B.ehFonte(ficheiro)) {
        const info = await lerFonte(ficheiro);
        const r = await carregar(ficheiro, 'fonte');
        A.modelo.alterar(p => {
          p.biblioteca.fontes[r.ficheiro] = { familia: info.familia, peso: info.peso, italico: info.italico, ficheiro: r.ficheiro, original: r.original };
        });
        B.registarFontes(A.modelo.obter());
      } else if (B.ehImagem(ficheiro)) {
        const r = await carregar(ficheiro, 'imagem');
        const d = await dimensoes(r.ficheiro);
        const img = { nome: r.original.replace(/\.[^.]+$/, ''), ficheiro: r.ficheiro, largura: d.largura, altura: d.altura };
        A.modelo.alterar(p => { p.biblioteca.imagens[r.ficheiro] = img; });
        imagens.push(img);
      }
    }
    return imagens;
  };

  /* Escolher ficheiros com a janela do sistema. */
  B.escolher = function (aceitar) {
    return new Promise(res => {
      const i = document.createElement('input');
      i.type = 'file';
      i.multiple = true;
      i.accept = aceitar;
      i.addEventListener('change', () => res([...i.files]));
      i.click();
    });
  };

  B.ACEITAR_FONTES = EXT_FONTE.map(e => '.' + e).join(',');
  B.ACEITAR_IMAGENS = EXT_IMAGEM.map(e => '.' + e).join(',');
})();
