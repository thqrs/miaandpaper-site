# 03 · Módulos CSS — `site/css/`

O antigo `styles.css` está dividido nos módulos 01→12; o módulo 13 acrescenta
o Míu. **A cascata depende da ordem dos `<link>` nas cascas: 01 → 13.** Uma regra do 10 ganha a uma regra
igualmente específica do 03 só por vir depois — **não reordenar os `<link>`**.

Uma folha nova tem de ser declarada nas **27** cascas que carregam o CSS: as
mesmas 25 dos módulos JS, mais `send-order.php` e `styleguide.html`. O `?v=` é
regenerado no deploy, mas a tag em si não.

Cada ficheiro tem um cabeçalho a dizer o que contém. **Actualizar esse cabeçalho
ao mover regras.**

## O mapa

| # | ficheiro | linhas | conteúdo |
|---|---|---|---|
| 01 | `01-tokens-agua.css` | 247 | variáveis `:root` (cores, superfícies, tokens) e a água da paleta |
| 02 | `02-base-chrome.css` | 811 | base do site: header/chrome, tipografia, lista de passos do wizard |
| 03 | `03-grelha-designs-tons.css` | 1321 | grelha de cards de designs, tons dos quadros |
| 04 | `04-reviews-passos-acoes.css` | 1119 | acções rápidas do passo de designs, balões de reviews, barra sticky mobile |
| 05 | `05-cookies-packs-entrega.css` | 1379 | banner de cookies, selecção de packs, resumo de preços, opções de entrega |
| 06 | `06-admin.css` | 1909 | **tudo o que é admin embutido no site**, incluindo contornos e popups sem impacto no layout |
| 07 | `07-cards-crachas-molduras.css` | 244 | pilha de crachás, molduras dos cards em mobile |
| 08 | `08-dark-mode.css` | 429 | **modo escuro, todo ele** |
| 09 | `09-seccoes-produtos.css` | 1246 | secções dos passos de designs, passo 2 de crachás, resumo de molduras |
| 10 | `10-entrega-uniformizacao.css` | 949 | passo de entrega/contacto, ecrã final de pagamento, aviso de antecedência e a camada `CSS_UNIFORMITY_LAYER_V1` |
| 11 | `11-home-marca.css` | 1906 | `BRAND_HOME_V1` e o resto da homepage, shell editorial |
| 12 | `12-composer-glitter-chart.css` | 2281 | compositor de media, color flow, glitter, gráfico de preço |
| 13 | `13-miu.css` | — | lançador-gato, painel, mensagens, sugestões e estados móveis do Míu |

O módulo 13 usa apenas tokens da marca e é também carregado nas cascas públicas
do catálogo, ofertas e Congresso. Ver [12 · Míu](12-miu.md).

## As duas camadas de tokens — a armadilha principal

Há **duas** camadas, e a segunda ganha:

```css
/* 01-tokens-agua.css — paleta da marca, alimentada pelo home.json */
:root { --card: #fffdf5; }

/* 10-entrega-uniformizacao.css — CSS_UNIFORMITY_LAYER_V1 */
:root { --ui-card: #fffdf8; }          /* valor PRÓPRIO, não deriva de --card */
.step-card, .choice-card, .pack-option { background: var(--ui-card); }
```

**Consequência:** mudar a paleta no painel muda o fundo da página, os títulos e
os botões — mas **não** os cartões, as opções de pack nem as caixas de escolha.
Parece que a alteração "não pegou".

A camada `--ui-*` (18 tokens) foi criada de propósito para uniformizar
variações de amarelo, por isso não se resolve apagando-a. Alguns dos seus
tokens já derivam da paleta (`--ui-border: var(--line)`); os principais não.
Ligar os restantes está registado como decisão em
[09 · Pendentes](09-pendentes.md).

O painel do `modulos.php` mostra as duas camadas lado a lado, para se ver qual é
que manda em cada sítio.

## `modulos.php` — o inventário visual

Desenha os **14 módulos de interface** do site com ~68 exemplos reais, claro e
escuro lado a lado. Cada exemplo é um `<iframe>` de `modulos-preview.html` que
chama `MiaPreview.renderStep()` — **a mesma função da galeria**. Não há segunda
implementação: o que se vê é o que o site desenha, com os dados verdadeiros.

Mantém-se sozinho: os módulos vêm de agrupar os passos de todos os produtos pelo
seu `template`, por isso um produto, passo ou template novo aparece lá sem se
tocar em nada.

Tem controlos de procura, largura simulada (390 / 540 / 768 / 1024) e tema, e no
fim o inventário de classes, útil para ver as órfãs. Tem snapshot (0,006 s em
vez de 0,58 s) e está no `robots.txt` como não-indexável.

```
http://127.0.0.1:8082/modulos.php
```

**Relação com o `styleguide.html`:** o styleguide é curado — mostra combinações
escolhidas por alguém. O `modulos.php` é exaustivo e não tem opinião: responde a
"que peças de interface é que este site tem, e como estão hoje".

### Experiências de CSS

O antigo sandbox estático foi retirado da raiz pública: duplicava cerca de
500 KB de CSS e marcação e envelhecia sem aviso. Para experiências locais,
usar as ferramentas do browser sobre `modulos.php` sem gravar os ficheiros.

## Estado do CSS

O que a auditoria de 31/07/2026 encontrou e continua verdade. O relatório
completo, com números e amostras, está em
[histórico/2026-07-31-design-css](historico/2026-07-31-design-css.md).

**O que está bem:** tokens a sério (85 propriedades, ~1100 usos de `var()`,
quase nenhuma cor à mão), nomes com convenção por família (`home-`, `cart-`,
`pack-`, `admin-`, estados em `is-`/`has-`), e comentários que explicam o
*porquê* — 8% do ficheiro, e quase todos deste tipo.

**O que continua em aberto** (ver [09 · Pendentes](09-pendentes.md)):

| | |
|---|---|
| 18 breakpoints diferentes, sem escala | pares acidentais: 700/701, 620/640, 420/430, 384/390 |
| 191 `!important`, 96 deles em `product-*` | a zona das imagens dos cards de design |
| modo escuro desenhado mas inalcançável | 202 blocos, `showThemeToggle: false`, zero `prefers-color-scheme` |
| `--ui-*` não deriva da paleta | ver acima |
| 141 selectores definidos 3+ vezes | dificulta "onde é que esta regra é definida?" |
| 31 classes sem uso encontrado | visíveis no `modulos.php` → "só sem uso" |

Há também **mojibake** (UTF-8 lido como Latin-1: `aÃ§Ãµes`, `ecrÃ£`) em
comentários espalhados pelos módulos. O único caso que era CSS a sério — um
`content: "â€¢"` em vez de `"•"` — já foi corrigido. Os comentários ficam para
quando se tocar em cada zona: mexer neles é ruído puro num diff.
