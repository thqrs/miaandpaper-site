# 05 · Acrescentar um produto

Checklist única. Fazer tudo na **mesma alteração** — deixar a integração da
galeria ou dos painéis para depois é como se perde um produto em silêncio.

O slug tem de cumprir `^[a-z0-9-]+$` e o ficheiro `^[a-z0-9-]+\.json$` (cópias
tipo `cadernos - backup.json` são ignoradas de propósito).

---

## 1 · Conteúdo

| # | ficheiro | o quê |
|---|---|---|
| 1 | `content/products/<slug>.json` | os passos, designs e preços |
| 2 | `<slug>.html` | casca com `data-product="<slug>"`, igual ao nome do JSON |
| 3 | `content/pricing.json` | entrada com **o mesmo modo** do JSON do produto |
| 4 | `content/home.json` | a categoria (e ajustar os `menuOrder` seguintes) |
| 5 | `content/order-products.json` | para aparecer no "adicionar outro produto" |
| 6 | `content/products/personalizacao.json` | **sempre**: o catálogo do passo 2 é uma lista à mão e não deriva dos produtos |

O passo 6 falha em silêncio se for esquecido — o produto simplesmente não
aparece na personalização. O `precos.php` avisa quando isso acontece; ver
[10 · Editores](10-editores-admin.md).

O passo 3 não é opcional: com os dois ficheiros a discordar, o checkout recusa a
encomenda em silêncio. Ver [04 · Preços](04-precos.md).

## 2 · Servidor

| # | ficheiro | o quê |
|---|---|---|
| 7 | `send-order.php` | **quatro** listas: `safe_return_to`, `safe_product_slug`, `cart_allowed_product_slug`, `cart_is_main_v2_slug` |

## 3 · Código do site

| # | ficheiro | o quê |
|---|---|---|
| 8 | `js/10-produto-precos.js` | só se a família for nova: `supportsAssortedDesigns` e a lista do selector de formato |
| 9 | `galeria-slots.js` | `PRODUCT_CODES` (prefixo longo) e `SHORT_ENTRY_CODES` (duas letras) |

## 4 · Painéis — é aqui que se esquece

| # | ficheiro | o quê |
|---|---|---|
| 10 | `produtos-admin.js` | singular e plural |
| 11 | `admin-funnel.php` | `af_main_v2_slugs()` e o mapa de nomes |
| 12 | `admin-live-dashboard.php` | **quatro** sítios: lista de slugs, mapa de nomes, linha do metro com as suas estações, `lineLabel` em JS |

**Há uma linha de metro por cada fluxo com tráfego.** Um produto que não seja
registado aqui desaparece do funil sem dar erro nenhum: os seus eventos caem
todos na estação genérica `split`. Já aconteceu com `imanes-recortados` e
`personalizacao` (corrigido a 31/07/2026) e com as `agendas` (corrigido a
2026-08-07).

O `lembrancas` continua sem linha de propósito: é um produto retirado, sem
página.

## 5 · SEO

| # | ficheiro | o quê |
|---|---|---|
| 13 | `tools/seo-content.json` | título, descrição e headings da página nova |
| 14 | — | correr `node site/tools/seo-build.js` |

É o único caso que o gerador não consegue inferir. Sem entrada, a página não
ganha metadados e fica fora do `sitemap.xml`. Ver
[08 · Deploy](08-deploy-e-ambiente.md).

## 6 · Cache

| # | o quê |
|---|---|
| 15 | subir o `?v=` em **todas** as cascas se se tocou em `site/js/` ou `site/css/` |

---

## Verificar antes de dar por concluído

**Na galeria** (`galeria.html`), confirmar que:

- a categoria e todos os passos aparecem;
- o produto **não** está órfão — tem link "Abrir `<slug>.html`";
- cada local visível no percurso real tem um identificador único;
- cada preview mostra o item e o contexto certos;
- os controlos de enquadramento só ficam activos quando correspondem ao
  `editKey` efectivo;
- uma imagem repetida em vários locais gera os vários contextos esperados, sem
  transformar o ficheiro repetido num local único.

**No multimedia** (`multimedia.html`): os ficheiros novos aparecem e a coluna de
utilizações aponta para os locais certos.

**Nos preços:** correr o cross-check JS ↔ PHP sobre a tabela nova
([04 · Preços](04-precos.md)).

**Na cápsula:** abrir um produto do congresso e confirmar que continua igual, se
se tocou em `site/js/`.

**Nos snapshots:** um produto novo é uma alteração estrutural — regenerar em
`admin-snapshots.php`, senão os painéis continuam a mostrar a estrutura antiga
([07 · Backend](07-backend.md)).

---

## O que funciona sozinho

Não é preciso "reconstruir a galeria", e não se deve criar um registo manual de
imagens. A descoberta é genérica:

| acrescentas | o que acontece |
|---|---|
| produto novo em `content/products/xpto.json` | aparece na galeria e no multimedia |
| página com `data-product="xpto"` | o produto deixa de ser órfão e ganha o link |
| passo novo | vira uma secção nova no índice e no hamburguer |
| item novo | vira uma linha nova, com identificador gerado |
| campo de imagem novo, com qualquer nome | é encontrado pela varredura e pode ser substituído |
| imagem nova em qualquer pasta de `site/` | entra no inventário do multimedia (deve ser WebP) |
| `template` novo | aparece sozinho no `modulos.php` |

O que precisa de retoque manual está em [06 · Imagens](06-imagens.md).

**Actualizar estes documentos** na mesma alteração se o produto novo introduzir
uma estrutura que a checklist ainda não cobre.
