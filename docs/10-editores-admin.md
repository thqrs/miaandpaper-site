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
a ordem, arrastar as imagens para as ordenar, e **puxar as imagens do produto** —
que é o que o site fazia sozinho antes desta página (derivava do passo 1 do
produto). Uma imagem só é aceite se o ficheiro existir mesmo dentro de
`content/`; o selector lista os 800 e tal que lá estão.

⚠️ Os controlos de carrossel **saíram do modo admin do site** (o painel global e
os campos por cartão) para não haver dois sítios a escrever nos mesmos campos.
O `carouselSourceImages` foi substituído pelo `carouselSlides` e é apagado
quando esta página grava.

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
