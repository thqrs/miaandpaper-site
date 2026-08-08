# 10 · Editores de administração

Duas páginas internas, ambas com o mesmo desenho: barra de admin no topo, tema
escuro próprio (não usam os tokens da marca, de propósito — são ferramentas),
Save e Undo, e **nada toca no site antes do Save**.

Ambas estão **abertas sem autenticação** até ao deploy, como a galeria. Fechar
com `PRECOS_REQUIRE_ADMIN` e `HOMEPAGE_REQUIRE_ADMIN`.

| página | edita | ver |
|---|---|---|
| `precos.php` | todos os valores monetários | [04 · Preços](04-precos.md) |
| `homepage-menu-design.php` | o menu e a homepage | abaixo |
| `carrousel.php` | os carrosséis dos cartões da homepage | abaixo |
| `materiais.php` | quanto custa mesmo fazer uma unidade | abaixo |

## `homepage-menu-design.php`

Escreve num ficheiro só: `content/home.json`, de onde saem ao mesmo tempo a
grelha da homepage e o menu do hamburguer. Gravação atómica e verificada, com
revisão SHA-256 contra edições concorrentes.

**As duas ordens são independentes**, e não por escolha do editor:

| | ordena por | onde |
|---|---|---|
| homepage | a ordem do array `categories` | `renderHome` em `js/09-admin-paineis.js` |
| menu | `menuGroup` + `menuGroupOrder` + `menuOrder` | `renderSiteMenu` em `js/08-menu-site.js` |

Cada separador tem um botão para **herdar a ordem do outro**.

### Editor visual

Cartão grande = grupo; mini-cartão = entrada. Arrastam-se mini-cartões dentro de
um grupo, entre grupos, e os grupos entre si. Ao largar, o editor lê o DOM e
envia a ordem completa numa operação — não uma por linha.

Campos por entrada: nome, subtítulo, **texto de acção** (o "Ver opções →"),
visibilidade, e no menu o **ícone**.

A caixa de cada mini-cartão muda conforme o separador: na homepage é o
`available` (o cartão fica clicável ou não — desligado, mostra o
`unavailableMessage` a quem lhe toca); no menu é o `menuHidden` (esconde a
entrada do hamburguer sem a esconder da homepage). O `auto` no lugar do ícone
quer dizer que aquela entrada não tem `menuIcon` escolhido e o site decide pelo
`id` — é o comportamento de sempre.

### As secções da homepage

`SECCOES_HOMEPAGE_V1`. As secções são **dados**, na lista `homeSections` do
`home.json`, e o `renderHome` percorre-a. Acrescentam-se, removem-se, renomeiam-se
e arrastam-se para reordenar; cada cartão grande do separador *Homepage* é uma
secção, e arrastar um mini-cartão entre elas muda a secção onde aparece.

```json
"homeSections": [
  { "id": "novidades", "layout": "feature", "maxCards": 3, "repeatInGrid": true,
    "eyebrow": "", "title": "Novidades", "text": "" },
  { "id": "produtos",  "layout": "grid", "eyebrow": "", "title": "Produtos", "text": "" }
]
```

| campo | o que faz |
|---|---|
| `id` | âncora da secção (`#produtos`) **e** a chave do `section` de cada categoria. Sai do título ao criar; não se muda depois, senão partem-se links |
| `layout` | `grid` (a grelha normal) ou `feature` (os cartões grandes das novidades) |
| `maxCards` | só em `feature`: quantos cartões mostra |
| `repeatInGrid` | só em `feature`: os cartões em destaque **também** aparecem na grelha. É o que a homepage sempre fez, por isso veio ligado na migração |

Regras que evitam perder cartões:

- Um cartão sem `section` — ou com uma que já não existe — cai na **primeira
  secção em grelha**. Remover uma secção nunca faz desaparecer nada.
- Tem de sobrar **pelo menos uma secção em grelha**. O editor e a API recusam
  remover a última, e recusam pôr todas em `feature`.
- Uma secção `feature` vazia esconde-se no site, mas fica visível em modo de
  edição — senão não havia como lá arrastar nada de volta.

Uma só operação (`ordem-homepage`) leva a ordem das secções, a ordem dos cartões
e a secção de cada um: arrastar mexe nas três coisas ao mesmo tempo e separá-las
deixaria estados intermédios inválidos. A forma antiga (só uma lista de `ids`)
continua a valer e é o que o botão *herdar a ordem do menu* usa.

Um `home.json` sem `homeSections` — ou com a lista vazia — dá as duas secções de
sempre, montadas a partir do `news` e do `productsIntro`. `homeSectionList()` em
`js/09-admin-paineis.js` e `hm_seccoes()` no `homepage-menu-api.php` têm de dar o
mesmo. A cápsula do congresso **não** passa por aqui: tem o seu
`app-congressos.js`, congelado e independente.

### Campos novos no `home.json`

| campo | efeito | omissão |
|---|---|---|
| `actionText` | texto do botão do cartão. `ACTION_TEXT_V1` | o `::after` do CSS |
| `menuIcon` | ícone da entrada. `MENU_ICONE_POR_ENTRADA_V1` | escolhido pelo `id` |
| `menuShowIcons` | mostrar ícones no menu. `MENU_ICONES_V1` | ligado |
| `menuAccordion` | abrir uma secção fecha as outras. `MENU_ACORDEAO_V1` | desligado |
| `menuHidden` | esconder do menu sem esconder da homepage | falso |
| `section` | em que secção da homepage o cartão aparece. `SECCOES_HOMEPAGE_V1` | a primeira grelha |
| `featureLabel` | etiqueta por cima do título, só usada em secções `feature` | sem etiqueta |
| `homeSections` | as secções da homepage (ver acima) | as duas de sempre, do `news`/`productsIntro` |

O `featured` que existia antes foi substituído pelo `section`. Continua a ser
lido como "primeira secção de destaques" para um ficheiro por migrar, mas o
editor já não o escreve.

O selector de ícones lista os PNG de `content/brand/menu-icons/line-art/`, por
isso um ficheiro novo aparece sozinho.

---

## `carrousel.php`

`CAROUSEL_SLIDES_V1`. Um separador **Global** e um por cartão da homepage.
Escreve no mesmo `content/home.json`, por isso a leitura e a escrita atómica
vivem na `lib/home-core.php`, partilhada com o `homepage-menu-api.php`.

Cada imagem passou a ser um **slide** com os seus parâmetros:

```json
"carouselSlides": [
  { "image": "content/…", "intervalMs": null, "speedSeconds": null,
    "zoomPercent": null, "panPercent": null, "overlayOpacity": null }
]
```

| parâmetro | o que faz | limites |
|---|---|---|
| `intervalMs` | quanto tempo a imagem fica no ecrã | 800–30000 |
| `speedSeconds` | duração do movimento (ken burns) | 3–30 |
| `zoomPercent` | quanto aproxima ao longo do movimento | 100–140 |
| `panPercent` | quanto desliza | 0–18 |
| `overlayOpacity` | quanto escurece, para o texto se ler | 0–80 |

**Null herda do bloco `carousel` global** — é isso que faz com que mexer no
separador Global chegue a todos os carrosséis de uma vez. O botão *Repor todas
as imagens no global* limpa os valores próprios de tudo, quando se quer que uma
mudança global chegue mesmo a toda a gente.

A cascata é decidida num sítio só: `resolvedCarouselSlides()` em
`js/03-conteudo-home.js`, com o par em `carousel_global()`/`carousel_slides()`
na `lib/home-core.php`. Os valores saem em variáveis CSS **em cada moldura**
(`--carousel-speed`, `--carousel-zoom-scale`, `--carousel-overlay`,
`--carousel-pan-x/y`) em vez de uma vez no cartão, e o escurecimento mudou-se do
`.category-card::before` para o `.category-carousel-frame::after`.

O temporizador deixou de ser um `setInterval` fixo e passou a ser uma cadeia de
timeouts, porque cada moldura diz quanto tempo fica.

Outras coisas do separador de cada cartão: ligar/desligar o carrossel, baralhar
a ordem, arrastar as imagens para as ordenar, um **visto por imagem** (sem ele a
imagem fica na lista mas sai do carrossel — é para experimentar sem perder o
caminho do ficheiro), e **puxar as imagens do produto**, que **acrescenta** as
que faltam em vez de substituir.

Para escolher uma imagem: escrever o caminho, ou deixar o campo vazio e carregar
em *Adicionar imagem* para abrir o selector com miniaturas e filtro. Dois cliques
no caminho de uma imagem já lá posta abrem o mesmo selector para a trocar. Uma
imagem só é aceite se o ficheiro existir mesmo dentro de `content/`.

`PRODUTO_DO_CARTAO_V1`: o produto por trás de um cartão sai do `data-product` do
`<body>` da página ligada, e não do nome do ficheiro — `crachas.html` serve o
`crachas-loja`, `molduras.html` serve o `quadros`. Enquanto se adivinhou pelo
nome, esses cartões nunca conseguiam ir buscar imagem nenhuma ao produto.

⚠️ Os controlos de carrossel **saíram do modo admin do site** (o painel global e
os campos por cartão) para não haver dois sítios a escrever nos mesmos campos.
O `carouselSourceImages` foi substituído pelo `carouselSlides` e é apagado
quando esta página grava.

---

## `materiais.php`

`MATERIAIS_UI_V1`. Calcula o custo real de uma unidade. A ideia toda cabe em
duas frases: há um **catálogo de materiais** (o que se compra e por quanto) e, em
cada produto, diz-se **quantas unidades saem de um material**. O resto é
aritmética.

```
custo de 1 unidade do material = preço pago ÷ quantidade comprada × (1 + estragos%)
custo por unidade de produto   = custo de 1 unidade do material ÷ quantas unidades saem de 1
tempo                          = minutos por unidade ÷ 60 × custo da hora
custo total por unidade        = soma dos materiais + tempo
```

O campo do rendimento aceita uma **multiplicação** — `100*10*10` — e mostra o
resultado por baixo. É de propósito: pensa-se nestas coisas como «100 cortes, 10
folhas por corte, 10 crachás por folha», e obrigar a fazer a conta de cabeça é
onde se erra. A coluna do lado guarda a frase que explica a conta.

Os separadores dos produtos são as **tabelas de preços do `pricing.json`** (uma
por `slug::priceKey`), para baterem certo com as do `precos.php` — é para lá que
o custo vai.

**O resultado não fica parado.** O botão *Enviar para os preços* escreve o custo
por unidade no `private/custos.json`, que é de onde o `precos.php` tira o
`Lucro/un` e a linha do custo no gráfico. Sem isso, o custo passava a existir em
dois sítios com hipótese de discordarem — o mesmo problema que o `optionExtras`
resolveu para os extras (ver [04 · Preços](04-precos.md)).

Guarda em `private/materiais.json`, **fora da raiz web**, pelo mesmo motivo que
os custos: são as margens do negócio e o `content/` é servido publicamente. Não
está no git; viaja por scp no `[2]upload-or-download.bat`, junto com o
`custos.json`.

---

## A personalização não deriva dos produtos

⚠️ O catálogo do passo 2 da personalização é uma **lista à mão** em
`personalizacao.json` (`steps[custom_products].products`). Não lê os `steps` do
produto de destino: cada entrada traz o seu `slug`, tamanho, imagem, grupo e
acabamentos.

**Criar um produto e esquecer esta lista faz o produto não aparecer na
personalização, sem dar erro.** Aconteceu com as agendas. O `precos.php` avisa
agora, na tab *Produtos*, quando um produto `main-v2` está de fora.

Um passo novo num produto (como a capa dura) também **não** aparece aqui
sozinho — tem de ser acrescentado como acabamento em `step.finishes` e à lista
`finishes` das entradas que o oferecem.

### Chegar com a gaveta certa aberta

`PERSONALIZACAO_DE_ONDE_VIM_V1`. O link de cada produto leva `?de=<slug>`, e o
passo 2 abre a gaveta que contém esse produto. Resolve-se pelo `group` da
entrada do catálogo que aponta para o slug.
