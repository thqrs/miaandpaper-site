# 01 · Arquitectura

Como o site está feito. As regras do que **não** fazer estão no
[`AGENTS.md`](../AGENTS.md).

---

## A ideia central

As páginas HTML estão **vazias**. Cada uma é uma casca de ~60 linhas que carrega
os módulos `css/01→13` e `js/01→24` e declara, no `<body>`, o que é e que
produto mostra. Os módulos JS lêem um JSON de `content/` e desenham a página
inteira no browser.

```html
<body data-page="product" data-product="bloquinhos">
  <div id="app" class="app-shell"></div>
</body>
```

Duas consequências práticas:

1. **Procurar texto ou marcação nos ficheiros HTML quase nunca dá resultado.**
   O conteúdo está nos JSON; a marcação está em `site/js/`.
2. **Não se pode raspar o HTML servido** para saber o que a página mostra — é
   preciso abrir no browser e deixar o JS correr. (A excepção é o bloco de
   pré-render do SEO; ver [08 · Deploy](08-deploy-e-ambiente.md).)

## `data-page` — os tipos de página

| valor | quem | o que é desenhado |
|---|---|---|
| `product` | os 12 produtos + `personalizacao.html` | wizard de passos a partir de `content/products/<slug>.json` |
| `home` | `index.html`, `congressos.html` | grelha de categorias a partir de `content/home.json` |
| `checkout` | `checkout.html` | carrinho e finalização |
| `add-product` | `adicionar-produto.html` | grelha de `content/order-products.json` |
| `contact` / `static` | `contacto.html`, `privacy.html`, `perguntasfrequentes.html`, `postais.html`, `ajuda-upload.html` | páginas simples |
| `preview` | `galeria-preview.html`, `modulos-preview.html` | superfícies internas de ferramentas |

`data-product` **tem de coincidir exactamente** com o nome do ficheiro em
`content/products/`. É por aí que a galeria liga um produto à sua página, e nem
sempre coincide com o nome do HTML:

| página | `data-product` |
|---|---|
| `molduras.html` | `quadros` |
| `crachas.html` | `crachas-loja` |
| `imanes.html` | `imanes-loja` |

Os restantes (`agendas`, `blocos-a6`, `bloquinhos`, `cadernos-anuais`,
`imanes-recortados`, `marcadores`, `marcadores-magneticos`, `mini-cadernos`,
`personalizacao`, `porta-chaves`, `pasta-de-folhetos`, `stickers`) usam o mesmo nome
no HTML e no JSON.

### Redirects

Cinco páginas antigas são só `<meta http-equiv="refresh">`. Não têm design nem
`data-page`, e a galeria ignora-as de propósito:

| página | vai para |
|---|---|
| `cadernos.html` | `cadernos-anuais.html` |
| `caderninhos.html` | `mini-cadernos.html` |
| `pins.html` | `crachas.html` |
| `quadros.html` | `molduras.html` |
| `catalogo.html` | `catalogo/index.html` |

Os JSON antigos que as serviam foram retirados da raiz pública. O historial
continua disponível no Git.

---

## Onde vive cada coisa

```
site/
├── *.html                     cascas (~60 linhas cada)
├── js/01→24                   renderer público + chatbot Míu
├── css/01→13                  interface pública + chatbot Míu
├── reviews.js, reviews-egg.js  bolhas de avaliações da homepage
├── content/
│   ├── home.json              categorias da homepage, tema, carrossel
│   ├── faqs.json              perguntas e respostas da página pública
│   ├── pricing.json           ⚠️ fonte central de preços
│   ├── order-products.json    grelha do "adicionar outro produto"
│   ├── products/<slug>.json   um por produto: passos, designs, preços
│   └── designs/               as imagens
├── send-order.php             ⚠️ recebe encomendas. A autoridade dos preços.
├── send-message.php           formulário de contacto
├── upload-order-photo.php     recebe ficheiros dos clientes
├── track-order-event.php      funil analítico
├── lib/db.php                 SQLite: schema, migrações, todos os acessos
├── lib/miu-bot.php            SQLite separado, filtros e fornecedores do Míu
├── lib/precos-core.php        ⚠️ cálculo e validação de preços, partilhado
├── lib/snapshot.php           HTML congelado das páginas pesadas
├── lib/avisos.php             emails de aviso à Mia
├── admin-*.php                painéis (encomendas, funil, dashboard)
├── bot.php + bot-api.php      painel e endpoint público do Míu
├── precos.php + precos-api.php        editor central de preços
├── homepage-menu-design.php           editor do menu e da homepage
│   + homepage-menu-api.php
├── faqs.php                    editor das perguntas frequentes
├── galeria.html + galeria-api.php     gestão de imagens
├── produtos.php                       designs seleccionáveis do passo 1; acrescenta/remove items
├── produtos.html + produtos-api.php   vista de produtos e "teia"
├── modulos.php                inventário visual do CSS (gerado)
└── congressos/2026/           contexto independente do Congresso 2026
```

Fora de `site/` (não é publicado): `private/` no servidor, irmã da raiz web, com
a base de dados, os uploads dos clientes e a configuração de email. Em local é
`private-local/` — ver [08 · Deploy e ambiente](08-deploy-e-ambiente.md).

---

## O wizard de produto

Um produto é uma lista de **passos**. Cada passo tem um `template` que diz como
o desenhar:

| template | o que é |
|---|---|
| `design-grid` | grelha de designs para escolher (o passo 1 típico) |
| `quantity-builder` | packs + quantidade livre |
| `price-pack-grid` | tabela de packs e preços |
| `details-form` | campos de texto |
| `delivery-contact` | entrega + dados do cliente |
| `confirm` | resumo final antes de enviar |
| `original-artwork-upload` | upload de ficheiros do cliente |
| `custom-product-builder` | só na personalização: escolher produtos para um design |
| `photo-upload`, `palette-grid`, `cover-personalization`, `media-list`, `text-grid` | específicos das molduras e dos cadernos |

O estado vive em `state.selections`, no browser. Ao submeter, o
`js/21-checkout.js` carimba campos escondidos no formulário (`addHiddenFields`) e
faz POST para `send-order.php`.

Um `template` novo aparece sozinho no `modulos.php` — ver
[03 · Módulos CSS](03-modulos-css.md).

---

## Regra de ouro: gatilhos por dados, não por slug

O catálogo actual e o Congresso 2026 têm ficheiros de interface e produtos
independentes. Uma alteração de comportamento **nunca** deve ser condicionada
por uma lista de slugs no código — deve ser uma **flag no JSON** do produto que
a quer e portada para o outro contexto quando for intencional.

Exemplo real: `"adjustPerDesign": true` no passo `pack`. Só os produtos que a
têm ganham o ajuste de quantidade por design.

Quando o mesmo comportamento existir nos dois contextos, verificar **um produto
do catálogo e um do Congresso** depois de mexer numa das implementações.

### O contexto do Congresso 2026

`site/congressos/2026/` tem cópias próprias de tudo: quatro JSON de produto
(`crachas`, `imanes`, `caderninhos`, `cadernos`), o seu `pricing.json` e as suas
cascas HTML. O `app-congressos.js` e o CSS também são próprios.

Estes produtos são identidades comerciais independentes dos equivalentes do
catálogo principal. Podem usar a mesma imagem, mas não partilham ficheiro de
produto, tabela de preços nem opções de venda. No `precos.php` aparecem com o
prefixo `congresso-2026-`, que é apenas a identidade do editor; o site e o
checkout continuam a usar os slugs próprios do Congresso.

---

## Armadilhas conhecidas

1. **Fundir produtos do Congresso com os do catálogo por terem a mesma imagem.**
   São produtos independentes e podem vender opções diferentes.
2. **Alterar preços num só ficheiro** faz o checkout recusar a encomenda em
   silêncio. São sempre dois — ver [04 · Preços](04-precos.md).
3. **Portar comportamento entre contextos sem testar os dois lados** — os
   renderers são independentes e podem ter diferenças intencionais.
4. **Esquecer o `?v=`** depois de mexer em `site/js/` ou `site/css/`.
5. **Apagar do repositório e julgar que saiu do servidor** — o deploy nunca
   apaga; ver [08 · Deploy](08-deploy-e-ambiente.md).
6. **Calcular ajustes de imagem por fora do `imageEdits`** — dá valores que não
   são os que o site aplica; ver [06 · Imagens](06-imagens.md).
7. **Fazer `grep` sem excluir `tools/gerador-cartoes.php`** — são 5,1 MB de
   JavaScript minificado dentro de um PHP e inundam qualquer pesquisa.
8. **Assumir que o HTML servido tem o conteúdo.** Não tem.
9. **Mudar a estrutura e esquecer os snapshots** — os painéis continuam a
   mostrar a estrutura antiga, sem dar erro; ver [07 · Backend](07-backend.md).
10. **Criar um produto e não o registar nos painéis** — desaparece do funil em
    silêncio; ver [05 · Produto novo](05-produto-novo.md).
