# 06 · Imagens e galeria

O objectivo das ferramentas de imagem é **corrigir enquadramento e zoom e
substituir imagens de todo o site num sítio só, vendo exactamente o que o
cliente vê**. São páginas de trabalho: funcionais, não bonitas, e pensadas para
desktop.

Formato activo: **WebP, sempre.** As extensões antigas continuam reconhecidas
para não esconder referências históricas, mas ficheiros publicados e uploads
novos ficam em `.webp`.

---

## Ficheiros

| ficheiro | o que é |
|---|---|
| `site/galeria.html` | a ferramenta principal: uma linha por imagem, controlos à esquerda, cartão real à direita |
| `site/galeria-preview.html` | carregada dentro de cada `<iframe>`; desenha o passo com o renderer verdadeiro |
| `site/galeria-slots.js` | descoberta das localizações + identificadores. **Partilhado** pela galeria e pelo multimedia |
| `site/multimedia.html` | inventário em tabela de todas as imagens do disco: dimensões, tamanho, onde são usadas |
| `site/galeria-api.php` | backend: lista, recebe uploads, grava JSON de produto e o estado "finalizadas" |
| `site/produtos.html` | a Teia incorpora a Galeria no inspector, filtrada pelo contexto e pelo node |
| `site/produtos.php` | inventário dos designs do passo 1; clicar num cartão abre a Galeria incorporada nesse item |
| `content/galeria-estado.json` | as imagens marcadas como terminadas |
| `content/.galeria-dimensoes.json` | cache de dimensões (gerada; está no `.gitignore`) |
| `tools/generate-image-prompts.js` | gera prompts de imagem para os slots ainda por finalizar |
| `prompts-geracao-imagens.json` | snapshot desses prompts. Fora de `site/`, não é publicado |

---

## Como as imagens são descobertas

`MiaGaleriaSlots.collect(entry)` percorre o JSON de cada produto e o
`content/home.json`, criando um **slot** por cada string que seja um caminho
relativo e seguro de imagem (`jpg`, `jpeg`, `png`, `webp`, `gif`, `avif`).
Aceita espaços e pastas fora de `content/`; rejeita URLs, caminhos absolutos,
`..`, query strings, aspas e caracteres de controlo.

É deliberadamente genérico: **não há lista de campos conhecidos**. Um campo novo
com um caminho de imagem aparece sozinho, sem se tocar em código.

Cada slot guarda um `trail` (caminho dentro do JSON, ex.:
`["steps",0,"items",3,"image"]`). **Tudo é resolvido pelo trail, nunca por
referência guardada** — é isso que permite ao "anular" trocar o objecto do
produto inteiro sem partir nada.

Um campo de origem pode ter mais de um **contexto visual**. Nos cadernos, a
mesma imagem aparece no cartão de escolha e no resumo com `editKey` diferentes;
a galeria cria duas linhas (a segunda termina em `-RESUMO`), ligadas ao mesmo
`sourceKey`. Substituir o caminho actualiza as duas; os ajustes continuam
independentes.

### Dois contextos de produto

A galeria lê `content/products/` (site principal) e
`congressos/2026/content/products/`. Slugs repetidos **não são fundidos**: a
entrada principal mantém a chave histórica (`imanes`) e a do Congresso usa uma
chave composta (`congresso-2026|imanes`). O `slug` real continua a ser `imanes`,
para os renderers e os `imageEdits` manterem as mesmas chaves.

### Excepções tratadas à mão

- `content/home.json` aparece como a entrada **Homepage**: imagem simples ou
  slides do carrossel do hero, imagens dos cartões/destaques e tudo o que esteja
  em `carouselSourceImages`. Quando o hero ou um cartão usa carrossel, a imagem
  estática de fallback não cria linha duplicada.
- `individualColors` — ignorado (são cores).
- `interiorImages` — ignorado na varredura; as gavetas são geradas à parte.
- Itens **sem** imagem geram um slot vazio quando o renderer desenha
  `item.image`, incluindo itens dentro de `option-drawers`. Passos de quantidade
  e campos de texto não inventam imagens.
- `summaryPlaceholders` — as imagens da caixa "O que vais encomendar".

---

## Identificadores

Cada localização tem um código único e legível (clicar copia):

```
PRODUTO-P{passo}-{ITEM}-{PAPEL}
PRODUTO-ENCOMENDA-{CAMPO}
```

```
MOLDURA-P1-FOTO_E_FLORES_3D-CHOICE
MOLDURA-P1-FOTO_E_FLORES_3D-GAVETA-001
CADERNO-P1-CADERNO_10-LAMINACAO-MATTE
CRACHA-P2-PEQUENO-COMPARACAO
HOMEPAGE-HERO-CARROSSEL-001
```

Há também uma **coordenada curta** para copiar para uma conversa, por exemplo
`MO-0001`: duas letras para a família/contexto e quatro algarismos para o slot.
A numeração segue a ordem alfabética dos identificadores longos, para não
depender da ordem visual da página. O código longo continua a ser o
identificador canónico.

**Papéis** (`roleFor`): `CHOICE`, `GAVETA-NNN`, `LAMINACAO-{tipo}`,
`COMPRA-{opção}`, `EXEMPLO…`, `COMPARACAO`, `ENCOMENDA-{campo}`.

Duas notas:

- O número do passo é **a ordem no JSON**, não o número que o cliente vê. As
  molduras têm passos condicionais, por isso o número visível muda com o caminho
  escolhido; o do JSON é estável.
- A mesma imagem pode servir vários locais, e **cada contexto ajustável tem o seu
  `editKey`** (zoom, x, y, rotação, largura, altura).

---

## Onde ficam os ajustes — a armadilha principal

O site guarda os ajustes em **dois sítios** e o *scoped* ganha ao plano:

1. `item.imageEdits[editKey]` — por contexto
   (`{zoom, positionX, positionY, rotation, frameWidth, frameHeight}`)
2. propriedades planas no item (`imageZoom`, `imagePositionX`, …)

A galeria **lê o valor efectivo que a preview reporta** (via `data-mia-edit-key`
e as CSS vars aplicadas) e **escreve sempre no slot scoped esperado**, tal como
o teclado do admin. Os campos ficam bloqueados até a preview confirmar
exactamente esse contexto.

**Nunca recalcular defaults por fora.** Foi exactamente assim que apareceu um bug
em que a galeria mostrava `zoom 113` enquanto o site aplicava `74`.

---

## Pré-visualização — porquê iframes

A preview **não** reproduz o cartão: carrega os módulos JS verdadeiros dentro de
um `<iframe>` e manda desenhar o passo, via `window.MiaPreview.renderStep()`
(em `js/23-arranque.js`). Assim o cartão, o recorte, o zoom e a rotação são
exactamente os do site, sem risco de divergir quando o CSS mudar.

O `galeria-preview.html` devolve por `postMessage` a **caixa exacta** do cartão;
o `galeria.html` corta o iframe a essa caixa com `overflow:hidden` e margens
negativas, mantendo a largura de ecrã escolhida para as *media queries* valerem.

Consequências:

- Cada iframe carrega os módulos todos. Há um limite de previews em simultâneo
  (por defeito 60) e prioridade para as linhas perto do centro do ecrã.
- **A procura é estrita**: imagem, item, papel (`main`, `side`, `drawer`) e
  `expectedEditKey` têm de coincidir. A preview nunca cai para outro item só
  porque tem o mesmo `id`; sem correspondência, os ajustes ficam desactivados.
- As gavetas usam o slideshow real: a galeria selecciona a opção que a abre e
  activa o slide pedido.
- Há timeout por iframe — uma preview que falhe não bloqueia a fila.

---

## Gavetas

Dois mecanismos distintos:

- **`option-drawers`** vive no JSON do produto. Cada gaveta tem o seu `field` e
  `items`; imagens vazias aparecem como placeholders normais. A preview
  selecciona o valor no `field` da gaveta, não no `id` do passo.
- **Interior dos cadernos** — **não está no JSON**. Cada caminho é composto:

  ```
  item.interiorFolder + "/" + product.interiorPreview.drawerImageNames[i]
  ```

  Hoje só o `cadernos.json` usa isto: 16 capas × 19 nomes = 304 gavetas.

  Ao substituir uma gaveta, a galeria **materializa** o `interiorImages` daquela
  capa com a lista completa composta e só depois troca a posição escolhida (ver
  `cadernoItemInteriorImages`). Entradas já substituídas são preservadas.

  ⚠️ **Efeito secundário:** depois de editar uma gaveta de uma capa, essa capa
  deixa de apanhar automaticamente ficheiros novos largados na pasta. Só afecta
  as capas editadas.

Para dar gavetas a outro produto basta pôr `interiorFolder` nos itens e
`interiorPreview.drawerImageNames` no produto — o código já é genérico.

---

## Estado e gravação

- **Nada é gravado até "Guardar alterações"** — excepto a checkbox de "já
  terminei", que grava logo.
- Ao gravar, o `galeria-api.php` faz uma cópia `*.galeria-bak` antes de escrever
  (está no `.gitignore` e bloqueada no `.htaccess`).
- Cada produto leva uma revisão SHA-256. Se outro separador tiver alterado o
  ficheiro entretanto, a API devolve conflito e não sobrescreve.
- A gravação usa a chave da entrada, não o slug: `imanes` grava
  `content/products/imanes.json`; `congresso-2026|imanes` grava exclusivamente o
  ficheiro da cápsula.
- Undo/redo: 60 passos, guarda o produto inteiro antes de cada alteração.
  Ctrl+Z / Ctrl+Shift+Z (ou Ctrl+Y).
- O estado "finalizadas" usa chaves estáveis (`produto|item|campo`), sem índices
  de array, para aguentar reordenações. Cada visto é actualizado sob lock.
- JSON inválido é um erro explícito — a API não omite o ficheiro nem grava por
  cima dele em silêncio.

---

## Retoques manuais que continuam a ser precisos

| situação | o que fazer |
|---|---|
| produto novo | acrescentar o código curto a `PRODUCT_CODES` e `SHORT_ENTRY_CODES` |
| campo de imagem condicional ou desenhado noutro passo | acrescentar o contexto de render (`previewStepIndex`, selecções, item, papel, `expectedEditKey`) — sem isto a substituição funciona mas os ajustes não devem ser activados |
| campo de imagem com nome novo | acrescentar a `PROP_LABELS` (nome legível) e a `roleFor` (papel) — sem isto funciona, mas mostra o nome cru |
| placeholder novo no resumo | a chave em `summaryPlaceholders` no JSON, `ENCOMENDA_LABELS` em `galeria-slots.js` e `SUMMARY_SELECTIONS` em `galeria.html` |
| contexto visual novo na homepage | classificar em `collectHome`, marcar o elemento com `data-mia-image`/`data-mia-slot-name` no JS, e confirmar a preview |

## O que **não** é coberto

1. **Imagens fora dos JSON de produto e do `home.json` não são editáveis na
   galeria.** O multimedia inventaria todos os ficheiros sob `site/` e reconhece
   usos noutros JSON, HTML, CSS, JS e PHP — mas esses locais ficam só no
   inventário.
2. A detecção em ficheiros de código é **textual**: código que construa um
   caminho de forma totalmente dinâmica pode precisar de regra própria. (As
   versões `_big` derivadas em runtime já são reconhecidas.)
3. **Áreas novas que não sejam produtos nem a homepage** (uma landing page, por
   exemplo) entram no inventário mas não ganham controlos de substituição sem um
   modelo de slots próprio.

## Segurança

O `galeria-api.php` está **aberto ao público** por decisão do Tiago enquanto as
fotos reais estão a ser carregadas. Quem souber o endereço consegue trocar
imagens e enviar ficheiros — é um endpoint de **escrita**, não só uma página
visível.

O que já protege: uploads só aceitam imagens (extensão, MIME real e
`getimagesize`) e são convertidos para WebP; nomes sanitizados; a escrita só
acontece em ficheiros de produto que já existem; o slug é validado; as respostas
não ficam em cache; a gravação usa revisão e locks. **Não há caminho para
execução de código** — o risco é integridade de conteúdo e preços.

Fechar antes do deploy: `define('MIA_ADMIN_OPEN', false);` em
`site/admin-open.php`. Ver
[08 · Deploy e ambiente](08-deploy-e-ambiente.md).
