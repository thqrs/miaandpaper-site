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

A homepage tem **duas secções, fixas e escritas no código** (`renderHome` em
`js/09-admin-paineis.js`): *Novidades*, com até 3 cartões, e *Produtos*, com o
resto da grelha. Não são dados, por isso **não se acrescentam, removem nem
reordenam** — só se lhes edita o texto (bloco "Blocos de texto", que escreve em
`news` e `productsIntro`).

O que se **pode** organizar é em que secção cada cartão vive: `DESTAQUES_HOMEPAGE_V1`
mostra as duas secções como dois cartões grandes e arrastar um mini-cartão entre
elas liga/desliga o `featured`. A operação `ordem-homepage` leva a ordem e os
destaques juntos, e recusa mais de 3.

Tornar as secções editáveis obrigaria a pô-las no `home.json` e a fazer o
`renderHome` percorrê-las em vez de as ter escritas — mudança real na homepage,
não no editor.

### Campos novos no `home.json`

| campo | efeito | omissão |
|---|---|---|
| `actionText` | texto do botão do cartão. `ACTION_TEXT_V1` | o `::after` do CSS |
| `menuIcon` | ícone da entrada. `MENU_ICONE_POR_ENTRADA_V1` | escolhido pelo `id` |
| `menuShowIcons` | mostrar ícones no menu. `MENU_ICONES_V1` | ligado |
| `menuAccordion` | abrir uma secção fecha as outras. `MENU_ACORDEAO_V1` | desligado |
| `menuHidden` | esconder do menu sem esconder da homepage | falso |
| `featured` | pôr o cartão na secção *Novidades*. `DESTAQUES_HOMEPAGE_V1` | vai para *Produtos* |
| `featureLabel` | etiqueta por cima do título, só usada em *Novidades* | sem etiqueta |

O selector de ícones lista os PNG de `content/brand/menu-icons/line-art/`, por
isso um ficheiro novo aparece sozinho.

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
