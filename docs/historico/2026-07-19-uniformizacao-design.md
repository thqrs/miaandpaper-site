# Relatório — Uniformização do design do site Mia & Paper

> **Documento histórico — 2026-07-19.** Parte das propostas foi aplicada. As
> decisões da secção 5 continuam por tomar — estão resumidas em
> [09 · Pendentes](../09-pendentes.md). As referências a `app.js` e `styles.css`
> correspondem hoje a `site/js/` e `site/css/`.

**Data:** 2026-07-19
**Âmbito:** páginas públicas do site (homepage, páginas de produto, checkout, páginas estáticas). Excluídos, conforme pedido: imagens/assets (placeholders), mockups e toda a área de administração.
**Referências de design:** a homepage ([site/index.html](../../site/index.html), layout `brand-home`) e a página das molduras ([site/molduras.html](../../site/molduras.html)). O objetivo é pôr todas as páginas em harmonia com a homepage — incluindo a das molduras.

---

## 1. Como o site está construído (contexto rápido)

Quase todas as páginas são "shells" HTML pequenos; o conteúdo é gerado por `app.js` (hoje `site/js/`) a partir dos JSON em `site/content/`:

| Tipo | Páginas | Renderização |
|---|---|---|
| Homepage nova (`brand-home`) | index.html | `renderHome` (app.js:4680), ramo `layout: "brand-home"` |
| Hub de categoria (layout **antigo**) | congressos.html | `renderHome`, ramo antigo (`home-intro` + grelha) |
| Acrescentar produto (layout **antigo**) | adicionar-produto.html | `renderAddProductPage` (app.js:11923) |
| Produto (wizard) | molduras, cadernos, caderninhos, crachas, imanes, lembrancas | `renderProduct` (app.js:9944) — esqueleto único, diferenças vêm do JSON + classes por produto |
| Checkout | checkout.html | `renderCheckoutPage` (app.js:12367) — mesmo esqueleto do wizard |
| Estáticas (HTML à mão) | agendas, postais, contacto, privacy | HTML próprio; o header é substituído em runtime por `installStaticSiteNavigation` (app.js:3419), **o footer não** |
| Sistema próprio | catalogo/, ofertas/ | CSS próprio (`catalogo.css`) — design deliberadamente distinto |
| Redirects | quadros.html → molduras.html, pins.html → crachas.html | ok, sem design |

A norma visual em vigor (a preservar):

- **Tokens** em `styles.css:1-36` (hoje `css/01-tokens-agua.css`) — paleta creme/dourado (`--paper`, `--moss`, `--gold`…), `--radius: 8px`, sombra suave.
- **Tipografia:** títulos Georgia serif peso 500 (styles.css:232), corpo Inter (styles.css:50), `.eyebrow` maiúsculas em `--moss` (styles.css:216).
- **Header runtime:** logótipo + carrinho + menu hambúrguer + toggle de tema (oculto por defeito) — `renderBrand` (app.js:3392).
- **Footer runtime:** Encomendar por Catálogo → Política de Privacidade → (Login de Administrador) → © — `renderFooter` (app.js:3443).
- **Homepage `BRAND_HOME_V1`** (styles.css:8490+): full-width, header sticky com blur, hero grande com CTA, secções com miolo de 1180px, cartões editoriais "Novidades", lista de produtos com thumb 112px + "Ver opções →".
- **Wizard** (molduras e restantes produtos): coluna de 760px, `step-card`, botões `.button primary/secondary`.

---

## 2. Homepage vs. resto do site — os desvios estruturais

Estes são os pontos que definem a "harmonia com a homepage". São transversais a todas as páginas interiores, **incluindo a das molduras**.

### 2.1 Header: sticky só na homepage ⭐ prioridade
- Homepage: header full-width, sticky, com blur, borda inferior e sombra (styles.css:8656).
- Todas as outras páginas: o mesmo header (logo + carrinho + menu) mas estático, sem fundo, dentro da coluna de 760px.
- **Proposta:** aplicar o header sticky full-width da homepage a todo o site (wizard, checkout, estáticas, congressos). O miolo das páginas pode continuar a 760px; só a barra passa a ser global. É a mudança com maior impacto visual de harmonização.

### 2.2 Fundo de página: quadriculado vs. liso
- O `body` tem um padrão quadriculado tipo papel milimétrico (styles.css:53-62), visível em todas as páginas interiores à volta dos cartões.
- A homepage tapa-o com um fundo liso `#fffaf0` (`.home-shell--brand`, styles.css:8645) e secções em `#fffdf8`.
- **Proposta:** escolher uma das duas texturas como identidade. Ou (a) as páginas interiores adotam o fundo liso/cremoso da homepage, ou (b) a homepage deixa respirar o quadriculado entre secções. Recomendo (a) — o look "editorial" da homepage é o mais recente e o quadriculado atrás dos formulários compete com o conteúdo.

### 2.3 Cores hard-coded no bloco novo → modo escuro quebrado na homepage ⭐ prioridade
Todo o bloco `BRAND_HOME_V1` + menu lateral usa hexadecimais fixos (`#fffdf8`, `#72551e`, `#2e2413`, `#8a6a22`, `#6e6048`…) em vez de `var(--…)`. Consequências verificadas no browser com `data-theme="dark"`:
- O header sticky da homepage fica **claro** (`rgba(255,250,240,.94)`) sobre página escura.
- Os links do menu lateral ficam **ilegíveis**: painel escuro (`var(--card)` → rgb(34,26,15)) com texto `#2e2413` hard-coded (styles.css:8615).
- Só `.home-news-section`, `.home-news-card`, `.home-products-section` e `.site-menu-panel` têm override dark (styles.css:9002-9012); labels, headings secundários e hero actions não.
- Nota: os hexadecimais fixos também ignoram o `theme` editável no admin (o JSON `home.json.theme` alimenta as vars).
- **Proposta:** migrar as cores do bloco `BRAND_HOME_V1` e do menu lateral para os tokens (`--card`, `--ink`, `--moss`, `--muted`…), criando tokens novos onde falte (ex.: `--surface-page: #fffaf0`). Mesmo com o toggle desligado (`showThemeToggle: false` em home.json), o tema escuro é ativável por localStorage — está semi-partido hoje.

### 2.4 Raio de canto: 6px vs. 8px
- Token global `--radius: 8px`; o wizard, cartões e botões usam-no.
- O bloco novo da homepage usa `6px` fixo (hero actions styles.css:8749, news cards styles.css:8911) e `8px` nos cartões de produto (styles.css:9179) — mistura mesmo dentro da homepage.
- **Proposta:** um só valor via token (sugestão: manter 8px em tudo; ou introduzir `--radius-tight: 6px` deliberado para cartões editoriais — mas decidir e aplicar de forma consistente).

### 2.5 "Eyebrow"/labels com três cores
`.eyebrow` = `--moss` (styles.css:216); `home-news-card__label` = `#8a6a22` (styles.css:8946); labels do menu lateral = `#72551e` fixo (styles.css:8565). Visualmente próximos mas não iguais. **Proposta:** todos via `.eyebrow`/token único.

### 2.6 Botões: `.button` vs. `home-hero-action`
Os CTAs do hero têm estilo e animação próprios (fill alternante, radius 6, borda clara) — aceitável como variante exclusiva do hero, mas devem herdar o raio e tipografia dos tokens. Fora do hero, tudo deve usar `.button primary/secondary` (as páginas agendas/postais/contacto já usam).

### 2.7 Páginas de produto sem cabeçalho de página (h1) — inclui molduras
- A homepage tem hierarquia editorial: eyebrow → h1/h2 grandes serif → texto.
- As páginas de produto (molduras incluída) começam diretamente em "PASSO 1 / Que tipo de moldura queres?" — o título do passo é um `h2` e **não existe h1 na página**.
- Os JSON têm um bloco `intro` (`eyebrow`, `title`, `text` — ex.: quadros.json: "Molduras personalizadas / Cria uma moldura só tua.") que **não é renderizado em lado nenhum** (`renderProduct` não o usa; a classe `.product-intro` existe no CSS mas está órfã).
- **Proposta:** renderizar o `intro` como cabeçalho editorial compacto acima do wizard (eyebrow + h1 serif + linha de texto), no estilo dos `home-section-heading` da homepage. Harmoniza as páginas de produto com a homepage e resolve o h1 em falta (bom também para SEO/acessibilidade). Alternativa: apagar os `intro` dos JSON para não serem conteúdo morto.

### 2.8 Larguras: 1180px vs. 760px
Homepage: secções a 1180px; resto do site: 760px. **Proposta:** manter 760px no funil/formulários (largura boa para leitura e formulários) e reservar 1180px para header/footer/páginas editorais. Registar como decisão consciente, não como acidente.

### 2.9 Bolhas de avaliações só na homepage
`reviews.js` + `#review-bubbles` só existem em index.html (por desenho: "REVIEW_BUBBLES_V1: exclusivos da homepage", styles.css:1694). **Confirmar** que é intencional; se a prova social interessar nas páginas de produto, prever uma versão discreta. Por defeito: manter só na homepage.

---

## 3. Divergências página a página

### 3.1 congressos.html — a página mais desalinhada ⭐ prioridade
Usa o ramo **antigo** de `renderHome`: cartão `home-intro` com borda + grelha de categorias do design anterior, sobre o fundo quadriculado, header não-sticky. É um hub público (linkado no hero e no menu como "Congresso 2026").
**Proposta:** migrar para a linguagem da homepage — cabeçalho editorial (eyebrow "Lembranças e cadernos" + h1 "Congressos") e a lista de produtos no formato da secção "Produtos" da homepage (thumb 112px + título serif + subtítulo + "Ver opções →"). Como o layout antigo em `renderHome` só serve esta página, pode-se: (a) estender o layout `brand-home` para aceitar `backLink` e ficar sem hero, ou (b) criar um layout "hub" simplificado com os componentes novos.

### 3.2 adicionar-produto.html — mesmo problema
Página pública do fluxo do carrinho ("Acrescentar produto"). Usa `home-shell` + `home-intro` + grelha antiga (app.js:11935-11949). **Proposta:** aplicar o mesmo tratamento do 3.1 (cabeçalho editorial + lista de produtos moderna).

### 3.3 agendas.html e postais.html
Já usam o padrão `contact-card`/`category-entry` (alinhado com o funil), mas:
- **Header pré-JS diferente:** os HTML têm `Início`/`Contacto` como links de texto ([agendas.html:21-24](../../site/agendas.html#L21)), sem os ícones nem a estrutura da marca com `brand-letter-r` usados em contacto/privacy. Em runtime o JS substitui pelo header padrão, mas há flash do header antigo e, sem JS, a página fica diferente do resto.
- **Footer:** sem o item de admin presente no `renderFooter` (decisão de admin — ignorável), mas a ordem/conteúdo deve espelhar o footer padrão.
- **Proposta:** copiar para o HTML estático o mesmo markup de header/footer usado em contacto.html (ou, melhor, gerar também o footer via JS como já acontece ao header).

### 3.4 contacto.html e privacy.html
Quase alinhadas (mesma largura do funil, `contact-card`, dark ok). Restam detalhes:
- privacy.html:89 tem `<a href="index.html">Login de Administrador</a>` no footer — um link para a homepage em vez do botão `data-admin-open` das outras páginas (inconsistente; e é área de admin, decidir se sai).
- contacto.html:83 tem um espaço a mais no © (` © Mia & Paper…`).
- privacy.html não tem meta OG (todas as outras têm).

### 3.5 Molduras vs. restantes páginas de produto
O esqueleto é o mesmo (`product-shell` + `wizard-shell` + footer), portanto a harmonização estrutural vem "de borla". Diferenças de conteúdo/estilo a normalizar:
- **Títulos do passo 1** com padrões diferentes: "Que tipo de moldura queres?" (molduras) / "Escolhe a capa do caderno" / "Escolhe os teus designs favoritos" (crachás, ímanes) / "Escolhe os que mais gostas" (caderninhos) / "Escolhe os designs das lembranças". Definir um padrão de escrita (sugestão: pergunta direta como nas molduras, ou imperativo "Escolhe…" em todas — mas uma só forma).
- **Preview/galeria:** os componentes `product-preview` e `product-example-gallery` (app.js:9896-9941) só aparecem no passo 0 e hoje estão vazios em todos os produtos; a galeria só tem afinação CSS para molduras (styles.css:4151). O `preview` de cadernos.json está `enabled: true` com texto placeholder de instruções ("Aqui podes mostrar uma fotografia ou mockup…") — não aparece por faltar imagem, mas convém limpar ou preencher a sério.
- **`intro` morto nos JSON** — ver 2.7.

### 3.6 Metadados, títulos e versões de cache
- **Ordem do `<title>` inconsistente:** "Mia & Paper | X" (index, molduras, produtos, contacto, checkout) vs. "X | Mia & Paper" (agendas, postais, congressos, privacy, catálogo, ofertas). Escolher um padrão (sugestão: "X | Mia & Paper" nas interiores, só "Mia & Paper | …" na homepage — ou um único padrão em tudo).
- **Meta descriptions com "Mockup de encomenda…"** em caderninhos.html, imanes.html e lembrancas.html — texto herdado da fase de mockup, visível em partilhas/Google.
- **`rel="canonical"` só existe em molduras.html** — acrescentar às restantes (ou remover, mas coerente).
- **Versões de cache divergentes:** index/molduras carregam `styles.css?v=20260718230002` + `app.js?v=20260718230002`; todas as outras `v=20260718170000` (e cadernos `app.js?v=20260718170500`). Além de desarrumado, permite que utilizadores tenham **CSS/JS de versões diferentes conforme a página**. Uniformizar o `?v=` em todas as páginas a cada deploy (idealmente gerado por script).

### 3.7 Zonas com sistema de design próprio (decisão, não defeito)
- **catalogo/** — "Catálogo simples", design próprio, linkado em todos os footers. É deliberado (enviado por link direto). Recomendo manter distinto, mas partilhar tokens de cor para não derivar.
- **ofertas/** — usa o CSS do catálogo, mas está no **menu principal** do site ("Ofertas"). Quem navega do menu cai num design sem header/carrinho do site. A prazo: ou migrar as ofertas para o layout do site, ou pelo menos dar-lhes o header padrão.
- **Defeito encontrado de passagem:** o [site/catalogo.html](../../site/catalogo.html) da raiz está corrompido — cinco linhas têm o prefixo `"rotation": -7` colado antes das tags do `<head>`, e esse texto é empurrado pelo browser para o topo do `<body>` (texto visível na página). Provavelmente resultado de um find‑and‑replace falhado. Corrigir mesmo que o catálogo fique fora do âmbito.

### 3.8 styleguide.html desatualizado
O guia visual documenta os componentes do wizard e a **grelha de categorias antiga** (cartões numerados), e não tem nada do `BRAND_HOME_V1` (hero, news cards, lista de produtos, menu lateral). Depois da uniformização, atualizar o styleguide para refletir a linguagem final — é a ferramenta que evita nova deriva.

---

## 4. Plano de trabalho sugerido

| Fase | Trabalho | Impacto | Risco |
|---|---|---|---|
| 1 | Tokens: substituir hexadecimais fixos do `BRAND_HOME_V1`/menu lateral por `var(--…)`; corrigir dark do header sticky e links do menu; unificar raio e eyebrows (2.3, 2.4, 2.5) | Alto | Baixo |
| 2 | Header sticky global + footer único em todas as páginas, incluindo estáticas (2.1, 3.3, 3.4) | Alto | Médio |
| 3 | Fundo de página unificado (2.2) | Médio | Baixo |
| 4 | congressos.html e adicionar-produto.html para a linguagem nova (3.1, 3.2) | Alto | Médio |
| 5 | Cabeçalho editorial (`intro`) nas páginas de produto — molduras primeiro como piloto (2.7) | Médio | Baixo |
| 6 | Metadados/títulos/canonical/`?v=` uniformes (3.6) + limpeza dos textos placeholder (3.5) | Médio | Baixo |
| 7 | Atualizar styleguide.html (3.8) | Médio | Baixo |
| 8 | Decisões sobre ofertas/catálogo + fix do catalogo.html raiz (3.7) | Baixo/Médio | Baixo |

## 5. Decisões a tomar antes de começar

1. Fundo interior: liso creme (como a homepage) ou quadriculado em todo o lado? (recomendo liso — 2.2)
2. Raio de canto único: 8px em tudo, ou 6px para cartões editoriais como exceção formal? (recomendo 8px — 2.4)
3. Header sticky em todas as páginas? (recomendo sim — 2.1)
4. Renderizar o `intro` dos produtos como cabeçalho de página, ou apagar? (recomendo renderizar — 2.7)
5. Padrão de título do passo 1 dos produtos: pergunta ("Que tipo de…?") ou imperativo ("Escolhe…")? (3.5)
6. Padrão do `<title>`: "X | Mia & Paper" ou "Mia & Paper | X"? (3.6)
7. Bolhas de avaliações: só homepage ou também produto? (recomendo só homepage — 2.9)
8. Ofertas: migrar para o design do site ou manter o design do catálogo? (3.7)
