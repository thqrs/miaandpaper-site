/* 13 · Controlos — peças pequenas do painel de propriedades: números que se
   arrastam, cores, opções, caixas, textos com campos. Sem dependências do
   resto do editor: cada controlo recebe o valor e uma função para o mudar. */
(function () {
  'use strict';
  const A = window.Agenda;
  const K = A.controlos = {};

  K.no = function (tag, classe, texto) {
    const n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texto != null) n.textContent = texto;
    return n;
  };
  const no = K.no;

  K.botao = function (texto, aoClicar, classe) {
    const b = no('button', 'btn' + (classe ? ' ' + classe : ''), texto);
    b.type = 'button';
    b.addEventListener('click', aoClicar);
    return b;
  };

  K.seccao = function (titulo, ...filhos) {
    const s = no('section', 'seccao');
    if (titulo) s.appendChild(no('h3', null, titulo));
    s.append(...filhos.filter(Boolean));
    return s;
  };

  /* Linha "etiqueta | controlo". Se o controlo for numérico, a etiqueta arrasta-se. */
  K.linha = function (etiqueta, controlo, numerico) {
    const l = no('label', 'prop');
    const e = no('span', 'prop-etiqueta' + (numerico ? ' arrastavel' : ''), etiqueta);
    if (numerico) arrastarEtiqueta(e, numerico);
    l.append(e, controlo);
    return l;
  };

  function arrastarEtiqueta(etiqueta, { obter, mudar, passo, min, max }) {
    etiqueta.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      const x0 = ev.clientX, v0 = +obter() || 0;
      const mover = e => {
        const n = Math.round((e.clientX - x0) / 4) * passo;
        let v = +(v0 + n).toFixed(3);
        if (min != null) v = Math.max(min, v);
        if (max != null) v = Math.min(max, v);
        mudar(v, true);
      };
      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', () => window.removeEventListener('pointermove', mover), { once: true });
    });
  }

  K.numero = function (valor, opcoes, mudar) {
    const caixa = no('span', 'num');
    const i = no('input');
    i.type = 'number';
    i.step = opcoes.passo || 1;
    if (opcoes.min != null) i.min = opcoes.min;
    if (opcoes.max != null) i.max = opcoes.max;
    i.value = valor == null ? '' : +(+valor).toFixed(2);
    i.addEventListener('input', () => { if (i.value !== '' && !isNaN(+i.value)) mudar(+i.value, true); });
    caixa.appendChild(i);
    if (opcoes.unidade) caixa.appendChild(no('span', 'unidade', opcoes.unidade));
    const linha = K.linha(opcoes.etiqueta, caixa, { obter: () => i.value, mudar, passo: opcoes.passo || 1, min: opcoes.min, max: opcoes.max });
    return linha;
  };

  K.texto = function (valor, mudar, placeholder) {
    const i = no('input');
    i.type = 'text';
    i.value = valor || '';
    if (placeholder) i.placeholder = placeholder;
    i.addEventListener('input', () => mudar(i.value, true));
    return i;
  };

  /* Texto com campos: botões por cima que inserem {mes.nome}, {dia.numero}… */
  K.textoComCampos = function (valor, campos, mudar) {
    const caixa = no('div', 'texto-campos');
    const t = no('textarea');
    t.rows = 2;
    t.value = valor || '';
    t.addEventListener('input', () => mudar(t.value, true));
    const fila = no('div', 'fila-campos');
    for (const [rotulo, campo] of campos) {
      const b = K.botao(rotulo, () => {
        const ini = t.selectionStart, fim = t.selectionEnd;
        t.value = t.value.slice(0, ini) + campo + t.value.slice(fim);
        t.focus();
        t.selectionStart = t.selectionEnd = ini + campo.length;
        mudar(t.value, false);
      }, 'campo');
      b.addEventListener('mousedown', ev => ev.preventDefault());
      fila.appendChild(b);
    }
    caixa.append(t, fila);
    return caixa;
  };

  K.opcoes = function (valor, opcoes, mudar) {
    const g = no('div', 'segmentos');
    for (const [v, rotulo] of opcoes) {
      g.appendChild(K.botao(rotulo, () => mudar(v), v === valor ? 'activo' : ''));
    }
    return g;
  };

  K.booleano = function (valor, rotulo, mudar) {
    const l = no('label', 'caixa-verificar');
    const i = no('input');
    i.type = 'checkbox';
    i.checked = !!valor;
    i.addEventListener('change', () => mudar(i.checked));
    l.append(i, document.createTextNode(' ' + rotulo));
    return l;
  };

  K.seleccionar = function (valor, opcoes, mudar, estiloOpcao) {
    const s = no('select');
    for (const [v, rotulo] of opcoes) {
      const o = no('option', null, rotulo);
      o.value = v;
      if (estiloOpcao) Object.assign(o.style, estiloOpcao(v));
      s.appendChild(o);
    }
    s.value = valor == null ? '' : valor;
    s.addEventListener('change', () => mudar(s.value));
    return s;
  };

  /* Cores: amostras das cores com nome, os tons do mês e uma cor livre. */
  K.cor = function (valor, env, mudar, permitirNenhum) {
    const g = no('div', 'amostras');
    const opcoes = [];
    if (permitirNenhum) opcoes.push(['', 'Sem cor', 'transparent']);
    opcoes.push(['@mes.forte', 'Cor do mês', A.campos.cor('@mes.forte', env, env.ctx)]);
    opcoes.push(['@mes.medio', 'Cor do mês, média', A.campos.cor('@mes.medio', env, env.ctx)]);
    opcoes.push(['@mes.claro', 'Cor do mês, clara', A.campos.cor('@mes.claro', env, env.ctx)]);
    for (const [nome, hex] of Object.entries(env.estilos.cores)) opcoes.push([nome, nome, hex]);
    const actual = typeof valor === 'object' && valor ? valor.cor : valor;
    for (const [v, titulo, css] of opcoes) {
      const b = K.botao('', () => mudar(v || undefined), 'amostra' + ((actual || '') === v ? ' activo' : '') + (v.startsWith('@') ? ' do-mes' : ''));
      b.title = titulo;
      b.setAttribute('aria-label', titulo);
      b.style.setProperty('--c', css);
      g.appendChild(b);
    }
    const livre = no('input', 'cor-livre');
    livre.type = 'color';
    livre.title = 'Outra cor';
    livre.value = actual && actual[0] === '#' ? actual : '#888888';
    if (actual && actual[0] === '#') livre.classList.add('activo');
    livre.addEventListener('input', () => mudar(livre.value, true));
    g.appendChild(livre);
    return g;
  };
})();
