# WebKit / iPad — notas de compatibilidade do Mia & Paper

**Última atualização:** 28 de agosto de 2026 — correções preventivas aplicadas  
**Objetivo:** evitar bugs que aparecem num iPad real (Safari/Chrome com comportamento WebKit) mas não aparecem no Chrome do PC, Android ou no modo de emulação de iPad do DevTools.

> Regra principal: **emular a resolução de um iPad no Chrome não emula o motor do browser do iPad**.  
> Serve para testar breakpoints, tamanho e touch aproximado; não serve para validar diferenças de layout do WebKit.

---

## 1. Bugs já confirmados no iPad real

### 1.1 `justify-self` num filho de um bloco normal

#### Sintoma real
No passo 3 de **Foto e Flores 3D**, as caixas das cores ficavam alinhadas à esquerda no iPad, mas centradas no PC/Android.

#### Padrão problemático

```css
.parent {
  /* display normal: block */
}

.child {
  display: grid;
  justify-self: center;
}
```

O `justify-self` funciona há muito tempo para um **grid item**, mas o suporte de
`justify-self` em **block layout** é mais recente no Chromium e continua a não
ser suportado pelo Safari/WebKit estável.

Foi precisamente o que acontecia em:

- `site/css/03-grelha-designs-tons.css`
- `.quadros-color-composition`
- `.palette-composition`

#### Solução usada e confirmada

```css
.parent {
  display: grid;
  justify-items: center;
}
```

ou, quando faz sentido:

```css
.child {
  width: fit-content;
  margin-inline: auto;
}
```

#### Regra para o futuro

**Nunca usar `justify-self` como mecanismo principal de centragem se o pai não é
Grid.**

Preferir:

- `display: grid; justify-items: center`
- `display: flex; justify-content: center`
- `width: fit-content; margin-inline: auto`

Fonte de compatibilidade:
https://caniuse.com/wf-justify-self-block

---

### 1.2 Filho `height: 100%` dentro de pai cuja altura vem de `aspect-ratio`

#### Sintoma real
Em **Pasta de folhetos → Escolhe o design**, as imagens dos cards não apareciam no
iPad, mas a preview grande aparecia normalmente.

A preview usava `<img src="...">`; o card usava a camada genérica
`.uploaded-image`.

#### Padrão problemático

```css
.media {
  width: 100%;
  height: auto;
  aspect-ratio: 4 / 5;
}

.media .uploaded-image {
  width: 100%;
  height: 100%;
}
```

O pai não tem uma altura explícita. A altura é calculada através de
`aspect-ratio`.

O filho pede depois `height: 100%` dessa altura calculada.

O WebKit tem um bug conhecido exatamente nesta combinação. A Apple lista para
Safari 27 uma correção para:

> `height: 100%` num filho quando a altura do pai é definida através de
> `aspect-ratio`.

O patch aplicado no Mia & Paper eliminou essa dependência e **foi confirmado no
iPad real como correção do problema**.

Fonte:
https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes

#### Padrão seguro

Deixar **um único elemento ser o dono do aspect ratio**:

```css
.media {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 5;
  overflow: hidden;
}

.media > .uploaded-image {
  position: absolute;
  inset: 0;
  width: auto;
  height: auto;
  aspect-ratio: auto;
}
```

ou, para um `<img>` normal:

```css
.media {
  aspect-ratio: 4 / 5;
}

.media > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

No segundo caso, testar no iPad se o elemento participa em layouts mais
complexos. Para as camadas `.uploaded-image`, o padrão `position:absolute;
inset:0` é o mais previsível.

#### Regra para o futuro

**Evitar esta cadeia:**

```text
pai: height:auto + aspect-ratio
       ↓
filho: height:100%
```

Especialmente em cards, grids e elementos de imagem gerados por JavaScript.

---

## 2. Outros sítios do código auditados/corrigidos para WebKit

Estes não tinham ainda um sintoma confirmado, mas repetiam o padrão que já falhou no iPad.
Na correção preventiva de 28/08/2026, os casos abaixo passaram a deixar o
`aspect-ratio` no pai e a preencher a camada `.uploaded-image` com
`position: absolute; inset: 0`.

### Prioridade alta — mesmo padrão `aspect-ratio` + `height:100%`

#### A. Pasta de folhetos — formato/tamanho

`site/css/09-seccoes-produtos.css`, aproximadamente linhas 1312–1330:

```css
.pasta-de-folhetos-fluid .grouped-format-section .crachas-size-card-visual {
  width: 100%;
  aspect-ratio: 4 / 3;
}

... .uploaded-image {
  width: 100% !important;
  height: 100% !important;
}
```

**Estado:** corrigido preventivamente. Continuar a confirmar visualmente no iPad.

---

#### B. Pasta de folhetos — slots de atribuição

Aproximadamente linhas 1567–1581:

```css
.pf-assignment-slot-media {
  aspect-ratio: 4 / 3;
}

.pf-assignment-slot-media .uploaded-image {
  width: 100% !important;
  height: 100% !important;
}
```

**Estado:** corrigido preventivamente. Continuar a confirmar visualmente no iPad.

---

#### C. Pasta de folhetos — extras/acabamento

Aproximadamente linhas 2006–2023:

```css
.pf-fluid-extras ... .crachas-size-card-visual {
  width: 100%;
  aspect-ratio: 4 / 3;
}

... .uploaded-image {
  width: 100% !important;
  height: 100% !important;
}
```

**Estado:** corrigido preventivamente. Continuar a confirmar visualmente no iPad.

---

#### D. Cards de design em ecrãs até 620 px

`site/css/11-home-marca.css`, aproximadamente linhas 436–451:

```css
@media (max-width: 620px) {
  .choice-card.design-grid .design-card-media {
    height: auto !important;
    aspect-ratio: var(--frame-aspect, 1);
  }

  .choice-card.design-grid .design-card-media .design-image.uploaded-image {
    position: relative;
    inset: auto;
    width: 100% !important;
    height: auto !important;
    aspect-ratio: var(--frame-aspect, 1) !important;
  }
}
```

Este é praticamente o mesmo padrão do bug confirmado.

É mais provável aparecer num **iPhone** ou numa janela estreita do que no iPad
em portrait normal.

**Estado:** a tentativa com `position:absolute; inset:0` no filho colapsava no
Chromium (altura de 4px: só as bordas), porque a altura do pai vinda de
`aspect-ratio` não é definitiva para o filho absoluto — confirmado em
molduras, crachás, ímanes, mini-cadernos, blocos e porta-chaves. A imagem fica
em fluxo e é ela a dona do ratio; o pai acompanha por altura automática.

---

### Prioridade média — `aspect-ratio` genérico dos design cards

Em `site/css/03-grelha-designs-tons.css`:

```css
.choice-card.design-grid .design-card-media {
  height: var(--frame-height-px, auto);
  aspect-ratio: var(--frame-aspect, auto);
}

.choice-card.design-grid .design-card-media .design-image.uploaded-image {
  height: 100% !important;
}
```

Quando `--frame-height-px` contém uma altura explícita, o risco é baixo.

Quando a altura cai em `auto` e o tamanho passa a depender do `aspect-ratio`,
voltamos ao padrão problemático.

**Regra:** se um novo produto usar estes cards sem `frameHeight`, testar no
Safari/iPad.

---

## 3. Bug/limitação real: Canvas não codifica WebP no Safari

### Código atual

O upload de fotos grandes passa por Canvas e pede:

```js
canvas.toBlob(callback, "image/webp", quality);
```

Depois o resultado é sempre embrulhado como:

```js
new File(
  [result.blob],
  stem + "-web.webp",
  { type: "image/webp" }
);
```

### Problema

O Safari/iOS consegue **ler e mostrar WebP**, mas o
`HTMLCanvasElement.toBlob()` do Safari não suporta atualmente **codificar**
WebP.

Ou seja:

```js
canvas.toBlob(..., "image/webp")
```

não deve ser tratado como garantia de que o blob devolvido é WebP.

Compatibilidade:
https://caniuse.com/mdn-api_htmlcanvaselement_toblob_type_parameter_webp

### Impacto possível no Mia & Paper

Isto só entra em jogo quando a fotografia precisa de recompressão:

- ficheiro > ~1,5 MB; ou
- dimensões suficientemente grandes.

No Safari, o browser pode cair para outro formato (normalmente PNG). Como PNG
não usa o parâmetro de qualidade da mesma forma que JPEG/WebP:

- o ficheiro pode continuar grande;
- o algoritmo pode reduzir as dimensões várias vezes desnecessariamente;
- uma foto pode acabar com resolução menor no iPad do que no Android/PC;
- em casos extremos, a recompressão pode falhar antes de chegar ao tamanho
  pretendido;
- o nome/MIME criado pelo JS pode dizer `.webp` mesmo quando os bytes devolvidos
  pelo Canvas não são WebP.

O servidor do Mia & Paper faz validação pela assinatura real do ficheiro, o que
reduz o risco de aceitar conteúdo errado, mas o cliente não deve mentir sobre o
formato.

### Solução aplicada

O código passou a fazer *feature detection* do encoding WebP. Em browsers que
o suportam continua a usar WebP; no Safari/WebKit usa JPEG. Além disso, o nome
e MIME do `File` passam a ser derivados do `blob.type` real.

Nunca confiar no formato pedido. Verificar o `blob.type` devolvido:

```js
canvas.toBlob(function (blob) {
  if (!blob) {
    reject(new Error("encode"));
    return;
  }

  resolve(blob);
}, requestedType, quality);
```

e depois:

```js
const mime = result.blob.type || "image/jpeg";

const extension =
  mime === "image/webp" ? "webp" :
  mime === "image/png" ? "png" :
  "jpg";

const prepared = new File(
  [result.blob],
  `${stem}-web.${extension}`,
  {
    type: mime,
    lastModified: Date.now()
  }
);
```

Melhor ainda: fazer **feature detection** e escolher JPEG como fallback de
compressão fotográfica quando WebP encoding não existe.

Não fazer:

```js
if (isSafari) ...
```

Fazer:

```js
if (browserActuallyEncodedWebP) ...
```

---

## 4. Viewport no iOS: evitar depender de `100vh` para painéis/modais

O iOS tem barras do browser que aparecem/desaparecem e teclado virtual. A altura
visível não é sempre equivalente ao `100vh` tradicional.

O site já usa `dvh`/`svh` em vários pontos, o que é bom.

Ainda existem alguns casos antigos:

### Míu

`site/css/13-miu.css`:

```css
.miu-panel {
  height: min(420px, calc(100vh - 110px));
}
```

Em mobile até 520 px existe depois um override com `52dvh`, portanto o risco é
principalmente em tamanhos intermédios.

### Image viewer

`site/css/11-home-marca.css`:

```css
.image-viewer-stage {
  height: calc(100vh - 140px);
}
```

### Carrinho mobile

`site/css/06-admin.css`:

```css
.cart-panel {
  max-height: calc(100vh - 78px);
}
```

### Padrão recomendado

Quando se pretende a **altura realmente visível**:

```css
.panel {
  max-height: calc(100vh - 80px);  /* fallback */
  max-height: calc(100dvh - 80px);
}
```

Quando se quer uma área estável que não salte ao esconder/mostrar a barra do
browser, considerar `svh`.

Não substituir cegamente todos os `vh`: `100vh` em `body { min-height: ... }`
não é tão preocupante quanto `100vh` num modal ou painel fixo.

Referência WebKit:
https://bugs.webkit.org/show_bug.cgi?id=261185

---

## 5. `backdrop-filter`: manter também o prefixo WebKit

A maior parte do site já faz corretamente:

```css
-webkit-backdrop-filter: blur(6px);
backdrop-filter: blur(6px);
```

Mas existe pelo menos um caso em:

`site/css/11-home-marca.css` → `.home-hero-carousel__dots`

que tem apenas:

```css
backdrop-filter: blur(7px);
```

Para máxima robustez em versões WebKit/Safari não recentes:

```css
-webkit-backdrop-filter: blur(7px);
backdrop-filter: blur(7px);
```

Este é um problema **visual menor**: se falhar, perde-se o blur; o componente
continua funcional.

---

## 6. Coisas investigadas que NÃO devem ser tratadas como bugs sem prova

### `&quot;` dentro de `style="--uploaded-image:url(...)"`

Exemplo:

```html
style="--uploaded-image:url(&quot;imagem.webp&quot;)"
```

O parser HTML transforma normalmente `&quot;` em `"` antes de o CSS interpretar
o atributo.

Não fazer uma substituição global disto só porque um card não apareceu no
Safari.

No bug real das pastas de folhetos, corrigir o sizing (`aspect-ratio` +
`height:100%`) resolveu efetivamente o problema no iPad sem mexer em
`--uploaded-image`.

---

### CSS custom properties com `url()`

O Safari 27 inclui uma correção relacionada com a **serialização** de `url()`
em custom properties, mas isso não prova que o padrão atual do site falhe ao
carregar imagens.

Não substituir o sistema global de imagens sem um caso reproduzível.

---

### `repeat(..., minmax(..., 1fr))`

Não assumir que uma grelha desalinhada no Safari é automaticamente um bug de
`minmax()`.

No caso real das cores, o problema estava no `justify-self` usado fora de um
Grid, não no `repeat/minmax`.

---

## 7. Regras WebKit para novos componentes

### Layout

**Preferir:**

```css
.wrapper {
  display: grid;
  justify-items: center;
}
```

em vez de depender de:

```css
.child {
  justify-self: center;
}
```

quando não se sabe se o pai é grid.

---

### Imagens com aspect ratio

**Bom:**

```css
.media {
  position: relative;
  aspect-ratio: 4 / 5;
}

.media-layer {
  position: absolute;
  inset: 0;
}
```

**Evitar:**

```css
.media {
  height: auto;
  aspect-ratio: 4 / 5;
}

.media-layer {
  height: 100%;
}
```

---

### Canvas

Nunca assumir:

```js
requestedMime === returnedBlob.type
```

Verificar sempre:

```js
blob.type
```

---

### Viewport

Para modais/painéis:

```css
height: 100vh;  /* fallback */
height: 100dvh;
```

Para uma altura estável:

```css
height: 100svh;
```

---

### Efeitos WebKit

Quando usar `backdrop-filter`:

```css
-webkit-backdrop-filter: blur(...);
backdrop-filter: blur(...);
```

---

## 8. Checklist antes de publicar alterações visuais

Para alterações em cards, imagens, grids, modais ou uploads:

1. **Chrome PC**
   - desktop;
   - largura mobile;
   - largura iPad.

2. **Android Chrome**
   - touch real;
   - upload de foto, se aplicável.

3. **iPad Safari real**
   - portrait;
   - landscape;
   - selecionar opções;
   - abrir drawers/previews;
   - scroll;
   - teclado, se houver inputs;
   - upload de imagem grande, se o fluxo tiver upload.

4. **Chrome no iPad**
   - útil para confirmar se o problema acompanha o ambiente do iPad;
   - não assumir automaticamente qual engine está em uso só pelo nome do
     browser.

> Na UE, iOS/iPadOS já permitem browsers com engines alternativas através de
> entitlements da Apple. Safari continua a ser a referência obrigatória de
> WebKit. Se Safari e Chrome no iPad apresentam o mesmo bug, isso é uma pista
> forte, mas não usar a frase “todos os browsers iOS são sempre WebKit” como
> regra eterna.

Referência:
https://developer.apple.com/support/alternative-browser-engines/

---

## 9. Pesquisas rápidas para uma auditoria futura

### Encontrar o padrão perigoso de sizing

```bash
rg -n "aspect-ratio|height:\s*100%" site/css
```

Depois verificar se existe:

```text
pai: aspect-ratio + sem height explícita
filho: height:100%
```

---

### Procurar `justify-self`

```bash
rg -n "justify-self:" site/css
```

Para cada ocorrência, confirmar que o elemento é realmente um **grid item**.

---

### Procurar alturas de viewport

```bash
rg -n "100vh|100dvh|100svh|100lvh" site/css
```

Dar prioridade a:

- `position: fixed`
- modais;
- drawers;
- painéis;
- carrinho;
- elementos que coexistem com teclado virtual.

---

### Procurar Canvas encoding

```bash
rg -n "toBlob|toDataURL" site/js
```

Confirmar sempre o MIME devolvido.

---

### Procurar backdrop filters

```bash
rg -n "backdrop-filter" site/css
```

Confirmar o par:

```css
-webkit-backdrop-filter: ...;
backdrop-filter: ...;
```

---

## 10. Prioridade atual de correções/testes

| Prioridade | Área | Estado |
|---|---|---|
| ✅ Resolvido | Foto e Flores 3D — centragem das cores | Confirmado no iPad |
| ✅ Resolvido | Pasta de folhetos — cards de design sem imagem | Confirmado no iPad |
| ✅ Corrigido preventivamente | Outros cards PF com `aspect-ratio` + `height:100%` | Mesmo padrão do bug real removido |
| ✅ Corrigido | Compressão Canvas WebP | Feature detection + fallback JPEG com MIME/extensão corretos |
| ✅ Corrigido | Design cards ≤620 px | Imagem em fluxo com ratio próprio |
| ✅ Melhorado | `100vh` em viewer/carrinho/Míu | Mantém fallback `vh` e prefere `dvh` |
| ✅ Melhorado | `backdrop-filter` nos dots da homepage | Adicionado `-webkit-backdrop-filter` |

---

## 11. Princípio final

Quando um bug:

- aparece no iPad real;
- aparece no Safari;
- aparece também num browser diferente no mesmo iPad;
- não aparece no Android;
- não aparece no Chrome PC;
- e não aparece na “emulação de iPad” do DevTools;

**suspeitar primeiro de comportamento do motor/layout, não do breakpoint.**

E quando a diferença está entre:

```text
preview funciona
card não funciona
```

comparar primeiro **como cada um é renderizado**:

- `<img src>`
- `background-image`
- custom property
- elemento absoluto
- `aspect-ratio`
- percentagens de width/height
- overflow

antes de culpar o ficheiro de imagem ou o URL.
