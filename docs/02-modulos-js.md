# 02 · Módulos JS — `site/js/`

O antigo `app.js` está dividido em 23 ficheiros. **O código é o mesmo, só foi
partido.**

## As três regras que governam a pasta

1. **Escopo global partilhado.** São scripts clássicos ES5, sem IIFE por
   ficheiro: todas as funções e variáveis de um módulo são visíveis nos outros.
   Não há `import`/`export` e não há encapsulamento — um nome novo pode colidir
   com um nome de qualquer outro módulo.

   **Nunca envolver um módulo numa IIFE nem acrescentar `"use strict"`.** As
   funções e variáveis têm de continuar globais para os outros módulos as verem;
   qualquer um dos dois parte o site inteiro em silêncio.

2. **A ordem importa.** Carregam pela ordem dos `<script>` nas cascas, 01 → 23.
   Código executado durante a carga só pode usar o que veio antes. O
   `23-arranque.js` é o último de propósito: é ele que chama o render inicial, e
   nessa altura tudo o resto já tem de estar definido.

3. **Um ficheiro novo tem de ser declarado em todo o lado.** O `?v=` é
   regenerado automaticamente no deploy, mas a tag em si não: acrescentar o
   `<script>` nas **25 cascas** que carregam os módulos — todos os `*.html` da
   raiz de `site/`, mais `galeria-preview.html`, `modulos-preview.html` e
   `send-message.php`. Faltar numa dá uma página partida só nessa página.

   O `galeria-preview.html` injecta as tags por `document.write`; no contexto
   `congresso-2026` usa as cópias da cápsula, não estes módulos.

Cada ficheiro tem um cabeçalho de três linhas que repete estas regras e lista o
que contém. **Ao mover código entre módulos, actualizar esse cabeçalho** — é a
única documentação que fica ao lado do código.

## O mapa

| # | ficheiro | linhas | conteúdo |
|---|---|---|---|
| 01 | `01-nucleo.js` | 329 | constantes de configuração, storage seguro (`safeStorage*`), `state` do wizard, `escapeHtml`, favicon, fade da marca |
| 02 | `02-slots-imagem.js` | 288 | edição de imagem por slot (`imageEdit*`): zoom, posição, rotação, moldura; chaves de edição |
| 03 | `03-conteudo-home.js` | 716 | `loadJson`, catálogo de cores, settings do site, carrosséis, countdown, `cloneProduct` |
| 04 | `04-funil-tracking.js` | 884 | tracking do funil (`trackOrderEvent`, atribuição, heartbeat) e verificação de encomendas abertas |
| 05 | `05-admin-nucleo.js` | 230 | `pushUndo`, CSRF do admin, `adminFetch`, `openAdminSurface`, `saveDraft` |
| 06 | `06-chrome-tema.js` | 160 | `renderChrome` (header/footer), banner de encomendas suspensas, tema claro/escuro |
| 07 | `07-carrinho.js` | 1227 | carrinho: `loadCart`, badge, drawer, editar e remover linhas |
| 08 | `08-menu-site.js` | 420 | menu do site: `bindSiteMenu`, hrefs de categorias, gestos |
| 09 | `09-admin-paineis.js` | 1518 | painéis de admin embutidos: entregas, secções, settings da home, `renderAdminSurface` |
| 10 | `10-produto-precos.js` | 1783 | **modelo do produto e preços**: `findStep`, tabelas e packs, resumo de preço |
| 11 | `11-designs-media.js` | 426 | media dos cartões de design, visualizador de imagem, `renderDesignCardMedia` |
| 12 | `12-crachas-imanes.js` | 440 | secções por defeito de crachás/ímanes/cadernos e render de designs por secção |
| 13 | `13-quadros-cores.js` | 1583 | paleta e tons dos quadros, conversões de cor, análise de cor das fotos |
| 14 | `14-upload-quantidade.js` | 3262 | acções de foto do pedido, descontos de pack, gráfico de preço, `renderQuantityBuilder` |
| 15 | `15-cadernos.js` | 1144 | fluxo dos cadernos: proof photo, imagens interiores, opções de compra |
| 16 | `16-quadros-resumo.js` | 570 | "o que vais encomendar" de quadros/molduras: placeholders e tiles |
| 17 | `17-wizard-render.js` | 1834 | render dos passos: composer de media, slideshow do interior, numeração, histórico do browser |
| 18 | `18-wizard-navegacao.js` | 593 | `currentStep`, validações, `goNext` |
| 19 | `19-upload-media-pedido.js` | 832 | upload: compressão de fotos, timeouts, file picker, gravação de áudio |
| 20 | `20-quadros-anim-bind.js` | 1448 | animações dos quadros (FLIP) e `bindProduct` (liga todos os handlers) |
| 21 | `21-checkout.js` | 878 | **envio**: `addHiddenFields`, totais, sessão de checkout, `bindCheckoutPage` |
| 22 | `22-admin-imagem.js` | 835 | ajuste de imagens no admin por teclado |
| 23 | `23-arranque.js` | 1193 | `initProduct`, água da paleta (`MiaWater`), banner de cookies, `window.MiaPreview`, bootstrap |

## Onde procurar o quê

⚠️ **Os nomes dos ficheiros são aproximados.** A divisão foi feita por corte
sequencial do `app.js`, não por tema, por isso há funções em sítios que o nome
não deixa adivinhar: `renderQuadrosDesignStep` está no `15-cadernos.js`, e
`renderHome` está no `03` **e** no `09-admin-paineis.js`. **Confirmar sempre com
`grep`** antes de assumir onde uma função vive.

| pergunta | módulo |
|---|---|
| "quanto custa N unidades?" | 10 (`tierPriceCents`, `packCombinationPlan`), e 14 para o construtor de quantidade |
| "porque é que o cartão está assim?" | 11 (media), 12 (secções), 03 do CSS |
| "o que é enviado ao servidor?" | 21 (`addHiddenFields`) |
| "porque é que o passo não avança?" | 18 (`goNext`, validações) |
| "quem desenha este passo?" | 17 (`renderProduct`), e o `template` do JSON — ver [01](01-arquitectura.md) |
| "header, menu, footer?" | 08 (`renderBrand`, `installStaticSiteNavigation`) |
| "porque é que o admin vê isto e o cliente não?" | 05, 09, 22 |

## Notas com consequência

- **A água da paleta é física a sério.** Os quadrados de cor usam `MiaWater`,
  um simulador *shallow-water* em canvas dentro de `23-arranque.js` — não é CSS
  nem SVG. Corre mesmo com "reduzir movimento", por pedido explícito.
- **`window.MiaPreview`** (em `23-arranque.js`) expõe `renderStep()`, que é o
  que a galeria e o `modulos.php` usam para desenhar com o renderer verdadeiro.
  Mexer nele parte as duas ferramentas.
- **O `state` é único e global** (`01-nucleo.js`). Não há isolamento entre
  produtos: quem escreve em `state.selections` escreve para toda a gente.
