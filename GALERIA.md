# Galeria de imagens — como funciona

Documento para quem (pessoa ou agente) mexer nas ferramentas de gestão de
imagens do site. Escrito em 2026-07-22.

O objectivo destas páginas é **corrigir enquadramento, zoom e substituir
imagens de todo o site num sítio só**, vendo exactamente o que o cliente vê.

---

## 1. Ficheiros

| Ficheiro | O que é |
|---|---|
| `site/galeria.html` | A ferramenta principal. Uma linha por imagem, com controlos à esquerda e o cartão real à direita. |
| `site/galeria-preview.html` | Página carregada dentro de cada `<iframe>` da galeria. Desenha o passo com o **próprio `app.js`**. |
| `site/galeria-slots.js` | Descoberta das localizações de imagem + identificadores. **Partilhado** pela galeria e pelo multimedia. |
| `site/multimedia.html` | Inventário em tabela de todas as imagens do disco, com dimensões, tamanho e onde são usadas. |
| `site/galeria-api.php` | Backend: lista produtos/imagens, recebe uploads, grava JSON de produto e o estado "finalizadas". |
| `site/content/galeria-estado.json` | Lista das imagens marcadas como terminadas. |
| `site/content/.galeria-dimensoes.json` | Cache das dimensões das imagens (gerada; está no `.gitignore`). |

Todas são páginas de trabalho: **funcionais, não bonitas**, e pensadas para
desktop.

---

## 2. Como as imagens são descobertas

`galeria-slots.js` → `MiaGaleriaSlots.collect(entry)` percorre o JSON de cada
produto e também `content/home.json`, criando um **slot** por cada string que seja um caminho relativo e
seguro de imagem (`jpg`, `jpeg`, `png`, `webp`, `gif` ou `avif`). Aceita
espaços e pastas fora de `content/` — há imagens activas dos cadernos com
espaços e exemplos em `media_tiago/` — mas rejeita URLs, caminhos absolutos,
`..`, query strings, aspas e caracteres de controlo.

Isto é deliberadamente genérico: **não há uma lista de campos conhecidos**. Um
campo novo com um caminho de imagem aparece sozinho, sem alterar código.

O formato ativo do site é **WebP**. As extensões antigas continuam a ser
reconhecidas para não esconder referências históricas, mas os ficheiros
publicados e todos os uploads novos devem ficar em `.webp`.

Excepções tratadas à mão:

- `content/home.json` — aparece como a entrada **Homepage**. São descobertas a
  imagem do hero, as imagens dos cartões/destaques e todas as imagens indicadas
  em `carouselSourceImages`. Quando um cartão usa um carrossel, a sua imagem
  estática de fallback não cria uma linha duplicada; continua a aparecer se
  também for a imagem de um destaque.
- `individualColors` — ignorado (são cores, não imagens).
- `interiorImages` — ignorado na varredura; as gavetas são geradas à parte (ver §5).
- Itens **sem** imagem geram um slot vazio apenas nos templates que desenham
  realmente `item.image` (`design-grid`, `media-list`, `text-grid`,
  `lamination-choice` e `purchase-option`). Isto evita inventar imagens em
  passos de quantidade ou personalização que não as usam.
- `summaryPlaceholders` (no topo do JSON do produto) — as imagens da caixa
  "O que vais encomendar".

Cada slot guarda um `trail` (caminho dentro do JSON, ex.:
`["steps",0,"items",3,"image"]`). **Tudo é resolvido pelo trail, nunca por
referência guardada** — é isso que permite ao "anular" trocar o objecto do
produto inteiro sem partir nada.

Um campo de origem pode ter mais de um **contexto visual**. Nos cadernos, a
mesma imagem aparece no cartão de escolha e no resumo com `editKey` diferentes;
a galeria cria duas linhas (a segunda termina em `-RESUMO`), ambas ligadas ao
mesmo `sourceKey`. Substituir o caminho actualiza os dois contextos, mas os
ajustes continuam independentes.

---

## 3. Identificadores

Cada localização tem um código único e legível, mostrado à direita de cada
linha na galeria (clicar copia). Formato:

```
PRODUTO-P{passo}-{ITEM}-{PAPEL}
PRODUTO-ENCOMENDA-{CAMPO}        (caixa "O que vais encomendar")
```

Exemplos reais:

```
MOLDURA-P1-FOTO_E_FLORES_3D-CHOICE
MOLDURA-P1-FOTO_E_FLORES_3D-GAVETA-001
MOLDURA-P4-HORIZONTAL-CHOICE
MOLDURA-ENCOMENDA-TAMANHO
CADERNO-P1-CADERNO_10-LAMINACAO-MATTE
CADERNO-P1-CADERNO_10-COMPRA-CADERNO_NORMAL
CRACHA-P2-PEQUENO-COMPARACAO
HOMEPAGE-HERO
HOMEPAGE-CADERNOS-CARROSSEL-001
```

**Papéis** (`roleFor` em `galeria-slots.js`): `CHOICE`, `GAVETA-NNN`,
`LAMINACAO-{tipo}`, `COMPRA-{opção}`, `EXEMPLO…`, `COMPARACAO`,
`ENCOMENDA-{campo}`.

Notas importantes:

- O número do passo é **a ordem no JSON** (o mesmo que a galeria mostra nos
  cabeçalhos), não o número que o cliente vê. As molduras têm passos
  condicionais, por isso o número visível muda conforme o caminho escolhido —
  o do JSON é estável.
- A mesma imagem pode servir várias localizações. **Cada contexto ajustável tem
  o seu `editKey`** (zoom, x, y, rotação, largura e altura). O recorte continua
  a ser uma propriedade do item nos renderers que o suportam.
- A unicidade é garantida: se dois itens tiverem a mesma etiqueta,
  acrescenta-se o `id` do item; há ainda uma rede de segurança que numera.

---

## 4. Pré-visualização — porquê iframes

A preview **não** reproduz o cartão: carrega o `app.js` verdadeiro dentro de um
`<iframe>` e manda-o desenhar o passo. Assim o cartão, o recorte, o zoom e a
rotação são exactamente os do site, sem risco de divergir quando o CSS mudar.

Peças:

1. `app.js` expõe `window.MiaPreview` (procura por `GALERIA_PREVIEW_V1`) com
   `renderStep(product, stepIndex, selections)`, que chama o `stepBody()` real.
2. `galeria-preview.html` desenha e devolve por `postMessage` a **caixa exacta**
   do cartão pedido.
3. `galeria.html` corta o iframe a essa caixa com `overflow:hidden` + margens
   negativas. O iframe mantém a largura de ecrã escolhida, para as *media
   queries* valerem.

Para a Homepage, a preview carrega a própria `renderHome()` do `app.js` e
recorta o hero, cartão, destaque ou slide de carrossel exacto. Os carrosséis não
são baralhados dentro da ferramenta, para cada identificador continuar ligado
à imagem certa.

Consequências a conhecer:

- Cada iframe carrega o `app.js` inteiro. Por isso há um limite de previews em
  simultâneo (configurável na barra, por defeito 60) e prioridade para as
  linhas mais perto do centro do ecrã.
- A procura é estrita: imagem, item, papel (`main`, `side`, `drawer`) e
  `expectedEditKey` têm de coincidir. A preview nunca cai para outro item só
  porque tem o mesmo `id`; se não houver correspondência, os ajustes ficam
  desactivados.
- As **gavetas** usam agora o slideshow real no iframe. A galeria selecciona a
  opção que abre a gaveta e activa exactamente o slide pedido.
- Há um timeout por iframe. Uma preview que falhe deixa de bloquear a fila das
  restantes.

---

## 5. Gavetas (interior dos cadernos)

As gavetas **não estão no JSON**. O site compõe cada caminho a partir de:

```
item.interiorFolder  +  "/"  +  product.interiorPreview.drawerImageNames[i]
```

Hoje só o `cadernos.json` usa este mecanismo: 16 capas × 19 nomes = 304 gavetas.

Como a galeria as edita: ao substituir uma gaveta, **materializa** o
`interiorImages` daquela capa com a lista completa composta e só depois troca a
posição escolhida. O site passa a usar `interiorImages` em vez de compor
(ver `cadernoItemInteriorImages` em `app.js`).

Ao materializar, entradas já substituídas são preservadas; só se preenchem as
posições ainda em falta. A preview selecciona a capa e mostra o slide real.

⚠️ **Efeito secundário**: depois de editar uma gaveta de uma capa, essa capa
deixa de apanhar automaticamente ficheiros novos largados na pasta. Só afecta
as capas editadas.

---

## 6. Onde ficam os ajustes — a armadilha principal

O site guarda os ajustes em **dois sítios** e o scoped ganha ao plano:

1. `item.imageEdits[editKey]` — por contexto (`{zoom, positionX, positionY, rotation, frameWidth, frameHeight}`)
2. propriedades planas no item (`imageZoom`, `imagePositionX`, …)

A galeria **lê o valor efectivo que a preview reporta** (via
`data-mia-edit-key` e as CSS vars aplicadas) e **escreve sempre no slot
scoped esperado e no `editItemTrail` certo**, tal como faz o teclado do admin.
Os campos ficam bloqueados até a preview confirmar exactamente esse contexto.
Nunca recalcules defaults por fora:
foi exactamente assim que apareceu um bug em que a galeria mostrava `zoom 113`
enquanto o site aplicava `74`.

---

## 7. O que acontece quando acrescentas coisas novas

### Procedimento obrigatório ao criar uma categoria de produto

Uma categoria nova não exige reconstruir nem manter uma lista manual da
galeria. O agente que criar a categoria deve, no entanto, concluir esta
checklist na mesma alteração:

1. Criar `site/content/products/<slug>.json`, usando um *slug* em minúsculas,
   números e hífenes. O nome tem de cumprir `^[a-z0-9-]+\.json$`.
2. Criar a página pública da categoria com
   `<body data-page="product" data-product="<slug>">`. O `data-product` tem de
   coincidir exactamente com o nome do JSON. Se o produto ainda não tiver
   página, a galeria consegue listá-lo, mas apresenta-o como órfão e não terá
   um link correcto para abrir o site.
3. Modelar passos e itens com o esquema já usado pelos restantes produtos.
   Caminhos de imagem guardados no JSON são descobertos automaticamente; não
   se deve criar uma segunda lista só para a galeria.
4. Acrescentar uma abreviatura a `PRODUCT_CODES` em
   `site/galeria-slots.js` quando se quiser um prefixo diferente do *slug* em
   maiúsculas. Isto só afecta a legibilidade dos identificadores.
5. Se houver um campo de imagem ou contexto visual novo, completar
   `PROP_LABELS`, `roleFor` e o contexto de preview necessário. Uma imagem
   encontrada pela varredura pode ser substituída, mas só deve permitir zoom,
   posição e rotação depois de a preview confirmar o renderer e o `editKey`
   exactos que o site usa.
6. Se a categoria introduzir placeholders novos no resumo da encomenda,
   actualizar também `ENCOMENDA_LABELS` em `site/galeria-slots.js` e
   `SUMMARY_SELECTIONS` em `site/galeria.html`.
7. Abrir localmente `galeria.html` e confirmar que:
   - a categoria e todos os passos aparecem;
   - cada local visível no percurso real do produto tem um identificador único;
   - cada preview mostra o item e o contexto certos;
   - os controlos de enquadramento só ficam activos quando correspondem ao
     `editKey` efectivo;
   - uma imagem repetida em vários locais gera os vários contextos esperados,
     sem transformar o ficheiro repetido em local único.
8. Abrir `multimedia.html` e confirmar que os ficheiros novos aparecem e que a
   coluna de utilizações aponta para os locais correctos.
9. Actualizar este documento na mesma alteração se o novo produto introduzir
   uma estrutura que a checklist ainda não cobre. Nunca declarar a categoria
   concluída deixando a integração da galeria para outro trabalho.

Adicionar apenas passos, itens ou imagens dentro de uma estrutura já suportada
é automático. “Reconstruir a galeria” não é uma etapa: o necessário é validar
que qualquer estrutura nova tem descoberta, preview e contexto de edição.

### Funciona sozinho, sem tocar em código

| Acrescentas | O que acontece |
|---|---|
| **Produto novo** em `content/products/xpto.json` | Aparece na galeria e no multimedia. O nome do ficheiro tem de ser `^[a-z0-9-]+\.json$` (cópias tipo `cadernos - backup.json` são ignoradas de propósito). |
| **Página nova** com `<body data-product="xpto">` | O produto deixa de ser "órfão" e ganha o link "Abrir xpto.html". Páginas com `http-equiv="refresh"` são ignoradas (são redirects). |
| **Passo novo** num produto | Vira uma secção nova ("Passo N — título") no índice e no hamburguer. |
| **Item novo** num passo | Vira uma linha nova, com identificador gerado automaticamente. |
| **Campo de imagem novo** (qualquer nome) | É encontrado pela varredura genérica e pode ter o ficheiro substituído. Propriedades directas `item.image`/`item.sideImage` recebem ajustes automaticamente. |
| **Imagem nova em qualquer pasta de `site/`** | Deve ser WebP. Entra no inventário do multimedia. Se estiver em `content/designs`, `content/uploads` ou `content/brand`, entra também no selector da galeria. |
| **Imagem nova em `content/home.json`** | Aparece na secção Homepage, com preview do contexto real e substituição editável. |

### Precisa de um retoque pequeno

| Situação | O que fazer |
|---|---|
| Produto novo | Acrescentar o código curto a `PRODUCT_CODES` em `galeria-slots.js` (senão o identificador usa o slug em maiúsculas, ex.: `POSTAIS`). |
| Campo de imagem condicional ou desenhado noutro passo | Acrescentar o contexto de render (`previewStepIndex`, selecções, item, papel e eventualmente `expectedEditKey`). Sem isto a substituição funciona, mas os ajustes não devem ser activados. |
| Campo de imagem novo | Acrescentar a `PROP_LABELS` (nome legível) e a `roleFor` (papel no identificador). Sem isto funciona na mesma, mas mostra o nome cru do campo. |
| Placeholder novo na caixa do resumo | Acrescentar a chave a `summaryPlaceholders` no JSON do produto, a `ENCOMENDA_LABELS` em `galeria-slots.js` e a `SUMMARY_SELECTIONS` em `galeria.html` (para a preview saber que selecções fazem aparecer esse tile). |
| Outro produto com gavetas | Basta pôr `interiorFolder` nos itens e `interiorPreview.drawerImageNames` no produto — o código já é genérico. |
| Contexto visual novo na homepage | A descoberta do caminho é automática, mas é preciso classificar o contexto em `collectHome`, marcar o elemento real com `data-mia-image`/`data-mia-slot-name` no `app.js` e confirmar a preview antes de o considerar concluído. |

### **Não** é coberto (limitações a sério)

1. **Imagens fora dos JSON de produto e de `content/home.json` não são
   editáveis na galeria.** O multimedia inventaria todos os ficheiros sob
   `site/` e reconhece usos em outros JSON de conteúdo, HTML, CSS, JavaScript e
   PHP, mas esses locais continuam apenas no inventário.
2. O multimedia também reconhece as versões `_big` que o visualizador deriva
   em runtime. Ainda assim, a detecção em ficheiros de código é textual: código
   que construa um caminho de forma totalmente dinâmica pode precisar de uma
   regra própria.
3. **Áreas novas que não sejam produtos nem a homepage** (por exemplo, uma
   landing page) entram no inventário, mas não ganham controlos de substituição
   sem um modelo de slots para esse conteúdo.

---

## 8. Estado e gravação

- **Nada é gravado até carregares em "Guardar alterações"** (excepto a
  checkbox de "já terminei", que grava logo).
- Ao gravar, o `galeria-api.php` faz uma cópia `*.galeria-bak` do JSON do
  produto ou da homepage antes de escrever (está no `.gitignore`).
- Cada produto leva uma revisão SHA-256. Se outro separador ou processo tiver
  alterado o ficheiro entretanto, a API devolve conflito e não sobrescreve o
  trabalho mais recente.
- Undo/redo: pilha de 60 passos, guarda o produto inteiro em JSON antes de cada
  alteração. Ctrl+Z / Ctrl+Shift+Z (ou Ctrl+Y).
- O estado "finalizadas" usa chaves estáveis (`produto|item|campo`), sem índices
  de array, para aguentar reordenações dos itens. Cada visto é actualizado sob
  lock, sem reenviar a lista inteira; chaves antigas com colisões têm aliases de
  migração.
- JSON inválido num produto ou no estado é um erro explícito. A API não omite o
  ficheiro nem grava por cima dele silenciosamente.

---

## 9. Segurança — ler antes de publicar

O `galeria-api.php` está **aberto ao público** por decisão do Tiago enquanto as
fotos reais estão a ser carregadas. Quem souber o endereço consegue trocar
imagens e enviar ficheiros.

Protecções que existem: uploads só aceitam imagens (extensão, MIME real e
`getimagesize`) e são convertidos para WebP antes de serem guardados, nomes são sanitizados, a escrita só acontece em ficheiros de
produto que já existem, o slug é validado, as respostas não ficam em cache e a
gravação usa revisão/locks.

**Para fechar**: `define('GALERIA_REQUIRE_ADMIN', true);` no topo do
`galeria-api.php`. Passa a exigir sessão de administradora, como o
`admin-api.php`. As operações de escrita passam também a exigir o token CSRF
da sessão, que `galeria.html` envia automaticamente.

---

## 10. Convenções

- Ao mexer em `app.js`, `styles.css` ou `galeria-slots.js`, **sobe a versão dos
  assets** em todas as shells de uma vez:
  `grep -rl "v=<antiga>" --include=*.html --include=*.php site/` e substitui.
  Senão os browsers servem a versão antiga.
- O servidor local de testes é `http://127.0.0.1:8082` (ver `*.bat` na raiz).
  É single-threaded, por isso as previews enchem devagar em local — em produção
  é bem mais rápido.
