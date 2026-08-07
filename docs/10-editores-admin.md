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

### Campos novos no `home.json`

| campo | efeito | omissão |
|---|---|---|
| `actionText` | texto do botão do cartão. `ACTION_TEXT_V1` | o `::after` do CSS |
| `menuIcon` | ícone da entrada. `MENU_ICONE_POR_ENTRADA_V1` | escolhido pelo `id` |
| `menuShowIcons` | mostrar ícones no menu. `MENU_ICONES_V1` | ligado |
| `menuAccordion` | abrir uma secção fecha as outras. `MENU_ACORDEAO_V1` | desligado |
| `menuHidden` | esconder do menu sem esconder da homepage | falso |

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
