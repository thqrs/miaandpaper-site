# Relatório de design — `site/styles.css`

**Data:** 31 de Julho de 2026
**Ficheiro:** 270 KB · 12 263 linhas · 1712 blocos de regras · 634 classes
**Página companheira:** [`modulos.php`](site/modulos.php) — inventário visual
gerado a partir deste mesmo ficheiro, em tempo real.

---

## 1. O que está bem

Não é um ficheiro desleixado. Três coisas em particular:

- **Tokens a sério.** 85 propriedades personalizadas (`--paper`, `--ink`,
  `--gold`, `--rose`…) e **1101 utilizações de `var()`**. Praticamente nenhuma
  cor está escrita à mão no meio das regras — vêm do tema, que por sua vez vem
  do `content/home.json`. É por isso que mudar a paleta no admin muda o site
  todo sem tocar em CSS.
- **Nomes com convenção.** As classes agrupam-se por família (`home-`,
  `quadros-`, `cart-`, `builder-`, `pack-`, `admin-`…), com estados em `is-`
  e `has-`. Dá para adivinhar onde vive uma regra sem procurar.
- **Comentários que explicam o *porquê*, não o *quê*.** Coisas como
  *"Sem fundo no topo, o texto da marca ficaria por cima do conteúdo durante o
  scroll"* ou *"A água corre mesmo com «reduzir movimento» — pedido explícito"*
  valem mais do que qualquer documentação separada. 8% do ficheiro são
  comentários e quase todos são deste tipo.

---

## 2. Problemas encontrados

### 2.1 · 18 breakpoints diferentes, sem escala ✗ corrigir exige decisão

| px | regras | | px | regras |
|---|---|---|---|---|
| 860 | 3 | | 480 | 5 |
| 720 | 1 | | 430 | 4 |
| 701 | 1 | | 420 | 3 |
| 700 | 6 | | 400 | 1 |
| 640 | 1 | | 390 | 9 |
| 620 | 12 | | 384 | 1 |
| 575 | 1 | | 370 | 2 |
| 560 | 3 | | 340 | 2 |
| 540 | 8 | | | |
| 520 | 2 | | | |

Há pares que só existem por acidente: **700 e 701**, **620 e 640**,
**420 e 430**, **384 e 390**. Cada um foi acrescentado a resolver um caso
concreto, e o resultado é que uma alteração de layout tem agora de ser
verificada em 18 larguras em vez de 4.

**Sugestão:** fixar 4 ou 5 valores (por exemplo 390 / 540 / 720 / 1024) e
migrar os restantes em lotes, verificando cada lote na galeria de larguras que
o `galeria.html` já tem. Não é trabalho mecânico — há regras onde o valor exacto
foi escolhido por causa do conteúdo — por isso fica como decisão, não como
correcção automática.

### 2.2 · 191 `!important`, metade num só sítio

| prefixo | ocorrências |
|---|---|
| `product-*` | **96** |
| `choice-*` | 36 |
| (regras sem classe) | 26 |
| `crachas-*` | 11 |
| restantes | 22 |

Os 96 do `product-*` são a zona das imagens dos cartões de design. É uma
armadilha conhecida: as regras globais com percentagens colapsam a imagem se a
coluna da grelha ficar em `auto`, e a solução na altura foi carimbar
`!important`. Funciona, mas significa que qualquer ajuste local a um cartão
precisa de outro `!important` para vencer — foi assim que chegaram a 96.

**Sugestão:** isolar a grelha do cartão de design num único bloco com
especificidade própria (`.product-shell .design-grid > *`) e retirar os
`!important` de dentro para fora, um produto de cada vez. Alto risco de
regressão visual — precisa de comparação lado a lado.

### 2.3 · O modo escuro existe mas ninguém lhe chega ✗ decisão tua

- **202 blocos `[data-theme="dark"]`** no CSS — é uma fatia grande do ficheiro.
- **0 utilizações de `prefers-color-scheme`.**
- `showThemeToggle` está a **`false`** nos quatro ficheiros de configuração
  (`home.json`, `congressos.json`, `order-products.json` e o do congresso).

Ou seja: o tema escuro está desenhado, mas o botão que o liga está escondido e
o site nunca segue a preferência do sistema. Um visitante com o telemóvel em
modo escuro recebe o site claro. Na prática, esses 202 blocos são código que
ninguém vê — só se lá chegas a mexer no `localStorage`.

**Três saídas, e a escolha é tua:**
1. **Ligar o botão** (`showThemeToggle: true`) — uma linha, e o trabalho já
   feito passa a servir para alguma coisa.
2. **Seguir o sistema** — acrescentar `@media (prefers-color-scheme: dark)` a
   aplicar o mesmo que `[data-theme="dark"]`, mantendo o botão como
   sobreposição manual.
3. **Assumir que não há modo escuro** e apagar os 202 blocos, ganhando talvez
   40 KB.

O que não faz sentido é ficar como está: a manter código que ninguém executa.

### 2.4 · A paleta da marca não controla as superfícies ⚠️ descoberto a testar o painel

Isto apareceu ao construir o selector de cores do `modulos.php`: mudar
`--card` **não muda o fundo dos cartões**. Verificado no browser — o token
muda, o cartão não.

A razão é que há **duas camadas de tokens**, e a segunda ganha:

```css
:root { --card: #fffdf5; }              /* paleta da marca, vem do home.json */
.step-card { background: var(--card); }

/* CSS_UNIFORMITY_LAYER_V1, mais abaixo no ficheiro */
:root { --ui-card: #fffdf8; }           /* valor PRÓPRIO, não deriva de --card */
.step-card, .choice-card, .pack-option, … { background: var(--ui-card); }
```

A camada `--ui-*` (18 tokens) foi criada para uniformizar os componentes, e
alguns dos seus tokens derivam da paleta (`--ui-border: var(--line)`) mas os
principais **não**: `--ui-card` é `#fffdf8`, escrito à mão, quase igual mas
não igual ao `--card` (`#fffdf5`).

**A consequência prática:** quem mudar a paleta no painel de produtos muda o
fundo da página, os títulos e os botões — mas os cartões, as opções de pack e
as caixas de escolha ficam na mesma. Parece que a alteração "não pegou".

**Solução:** fazer os `--ui-*` derivarem da paleta —
`--ui-card: var(--card)` — nos casos em que a diferença é acidental. Onde a
diferença é intencional, convém pelo menos um comentário a dizer porquê. É
preciso comparar antes e depois com cuidado, porque a camada foi criada
exactamente para corrigir variações de amarelo.

Entretanto, o painel do `modulos.php` mostra as duas camadas lado a lado, para
se ver qual é que manda em cada sítio.

### 2.5 · 141 selectores definidos três ou mais vezes

`.product-intro` (6×), `.product-shell` (5×), `.home-intro` (5×),
`.privacy-content` (5×), `.contact-card` (5×)… Não é erro — parte é
responsividade legítima dentro de media queries — mas dificulta responder à
pergunta "onde é que esta regra é definida?", que é a pergunta que se faz
sempre antes de mudar seja o que for.

**Sugestão:** juntar as definições da mesma classe que estejam fora de media
queries. Trabalho mecânico e verificável, mas volumoso.

### 2.6 · Ficheiro com codificação mista ✓ corrigido o que se via

O `styles.css` tem **124 sequências de mojibake** (UTF-8 lido como Latin-1):
`aÃ§Ãµes` em vez de `acções`, `ecrÃ£` em vez de `ecrã`, `crachÃ¡`. Vêm de
gravações com codificação errada ao longo do tempo — o mesmo padrão que produziu
as pastas duplicadas em `ofertas/`.

**74 linhas afectadas são comentários** (feio, sem consequência) — **uma era
CSS a sério**:

```css
.step-list .is-hidden-step button span::after {
  content: "â€¢";   /* devia ser "•" */
}
```

Renderizava `â€¢` em vez de um ponto no indicador de passo oculto do modo admin.
**Já corrigido.** Os comentários ficaram como estão: mexer neles é ruído puro
num diff de 12 mil linhas, e vale mais fazê-lo quando se tocar em cada zona.

### 2.7 · 31 classes sem uso encontrado

De 634 classes, **582 estão em uso**, **21 são montadas em código** (o nome é
concatenado — `"review-theme-" + tema`, `"category-grid-count-" + n`) e **31 não
aparecem em lado nenhum**.

Vê-las todas, com a amostra ao lado, em `modulos.php` → caixa "só sem uso".
Entre elas: `.butterfly-wing`, `.butterfly-core`, `.butterfly-shadow`
(a borboleta antiga, antes de passar a iframe), `.price-card`, `.summary-card`,
`.delivery-card`, `.home-intro`, `.product-intro`, `.custom-pin`, `.text-pin`.

**Não apaguei nenhuma.** Uma classe sem referência estática pode ainda ser
usada por conteúdo em JSON que eu não tenha coberto, ou estar à espera de uma
funcionalidade a meio. A página mostra-as; a decisão é tua, classe a classe.

---

## 3. A página de módulos — `modulos.php`

**Mostra módulos inteiros de interface, não classes soltas.**

A primeira versão listava as 634 classes e desenhava cada uma como
`<div class="X">Exemplo</div>`. Não servia para nada: uma classe fora da sua
estrutura não mostra nada, e o resultado eram 634 cartões com a palavra
"Exemplo" em fundos ligeiramente diferentes. Foi refeita.

**O que mostra agora.** Os **14 módulos de interface** do site, com **68
exemplos reais**:

| módulo | o que é | exemplos |
|---|---|---|
| `details-form` | campos de texto do cartão de apresentação | 14 |
| `delivery-contact` | entrega + contacto + NIF | 10 |
| `confirm` | resumo antes de enviar | 10 |
| `design-grid` | grelha de designs | 9 |
| `quantity-builder` | packs, quantidade e sugestão de poupança | 8 |
| `media-list`, `text-grid`, `palette-grid` | escolhas com imagem, só texto, e a paleta | 11 |
| `original-artwork-upload`, `custom-product-builder` | o fluxo da personalização | 2 |
| `photo-upload`, `lamination-choice`, `purchase-option`, `cover-personalization` | molduras e cadernos | 4 |

**Como é desenhado.** Cada exemplo é um `<iframe>` de `modulos-preview.html`,
que chama `MiaPreview.renderStep()` — **a mesma função que a galeria usa**.
Não há segunda implementação da interface: o que se vê é o que o site desenha,
com os dados reais dos produtos. Um `confirm` mostra mesmo "Encomendaste: 5
bloquinhos · 19,50 €"; um `design-grid` mostra os 39 crachás com as fotos
verdadeiras.

**Claro e escuro lado a lado.** Cada exemplo aparece duas vezes. Dentro de um
iframe o tema funciona nativamente (`html[data-theme="dark"]`), sem truques.
Foi preciso fixar o atributo contra o `app.js`, que lê o tema do
`localStorage` — partilhado entre a página e os iframes — e punha todos no
mesmo tema.

**Como se mantém sozinha.** Os módulos vêm de ler `content/products/*.json` e
agrupar os passos pelo seu `template`. Produto novo, passo novo ou template
novo aparecem aqui sem se tocar em nada. Dentro de cada módulo, os exemplos
são ordenados pelo número de imagens que têm — assim o primeiro é sempre o que
melhor mostra o módulo, e não o que calha em primeiro por ordem alfabética.

**Controlos:** procura, largura de ecrã simulada (390 / 540 / 768 / 1024 px
para ver o comportamento responsivo), esconder a coluna escura, e tema da
própria página.

**Desenho preguiçoso:** 68 exemplos × 2 temas = 136 iframes, cada um a carregar
o `app.js`. São criados à medida que entram no ecrã, com os primeiros seis
criados de qualquer maneira — o `IntersectionObserver` não dispara em
separadores em segundo plano e a página ficava vazia.

O **inventário de classes** da primeira versão continua lá, encolhido no fim,
porque a marcação de órfãs é útil.

```
http://127.0.0.1:8082/modulos.php
```

Fica no `robots.txt` como não-indexável, e tem snapshot (0,006 s em vez de
0,58 s).

**Relação com o `styleguide.html`:** o styleguide é curado — mostra
combinações e decisões de composição escolhidas por alguém. O `modulos.php` é
exaustivo e não tem opinião: responde a "que peças de interface é que este
site tem, e como é que estão hoje".

---

## 4. Resumo

| | |
|---|---|
| **Corrigido agora** | o `content: "•"` corrompido (2.6) |
| **Entregue agora** | `modulos.php`, os 14 módulos de interface, desenhados a sério |
| **Decisão tua** | modo escuro (2.3) — ligar, seguir o sistema, ou apagar |
| **Decisão tua** | ligar os `--ui-*` à paleta (2.4) — os --ui-* não derivam dela |
| **Decisão tua** | as 31 classes sem uso (2.7) — a página mostra-as todas |
| **Trabalho grande, com risco** | os 96 `!important` do `product-*` (2.2) |
| **Trabalho grande, mecânico** | consolidar os 18 breakpoints (2.1) e os 141 selectores repetidos (2.5) |

Nada disto é urgente. O CSS está saudável para o tamanho que tem — o que o faz
crescer não é desleixo, é o site ter muitos produtos com regras próprias. Os
dois pontos que valem mesmo a pena são o **modo escuro** (decidir de vez) e os
**breakpoints** (porque encarecem todas as alterações futuras).
