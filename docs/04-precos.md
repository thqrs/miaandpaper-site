# 04 · Preços

A parte onde se perde dinheiro. Duas regras acima de tudo o resto:

1. **As duas fontes têm de concordar** (JSON do produto e `pricing.json`).
2. **Cada modo está implementado duas vezes** (JS para o cliente ver, PHP para o
   servidor cobrar) e as duas têm de dar o mesmo cêntimo.

---

## Onde se editam os preços: `precos.php`

**Editar preços à mão nos JSON é o caminho errado.** Há um editor único em
`site/precos.php` que mostra num só sítio todos os valores monetários do site —
tabelas base, modos, portes, acabamentos, extras e tamanhos — e escreve cada um
de volta no ficheiro onde o site já o lê.

```
http://127.0.0.1:8082/precos.php
```

### O que dá para editar

| | como |
|---|---|
| **Total, unitário e % de desconto** | os três são editáveis e estão ligados: mexer num recalcula os outros dois. Só o **total** é gravado — o unitário e o desconto são derivados, e o desconto conta-se sobre o unitário do escalão mais baixo, tal como o `product_tier_price_cents` faz |
| **Quantidade de um pack** | editar o número na coluna da esquerda renomeia a chave na tabela |
| **Acrescentar / remover packs** | botões `+ Pack` e `✕`. Actualiza a tabela **e** os botões do passo `pack` no JSON do produto |
| **Extras, acabamentos, opções de entrega, tamanhos** | qualquer lista cujos elementos tenham um campo monetário vira uma tabela com nome, detalhe, valor e `+ Linha` / `✕` |
| **Modo de preço** | selector no cabeçalho de cada produto; escreve nos **três** sítios que têm de concordar (produto, passo `pack`, `pricing.json`) |
| **Custo do material** | um campo por tabela, que faz aparecer o **lucro por unidade**, o lucro total e a margem em cada linha |
| **Cápsula do Congresso 2026** | secção própria que compara com o catálogo e sincroniza os preços |

O desconto aparece em **todas** as tabelas, incluindo as `flat-unit`. Numa
`flat-unit` correcta dá 0% em todas as linhas — uma linha que não dê zero é logo
sinal de que a tabela não é proporcional.

O gráfico do preço por unidade responde ao rato e ao toque: cada ponto mostra a
quantidade, o total, o desconto e o lucro daquele pack.

### Nem toda a "tabela de preços" é uma escada de quantidades

Quando o passo `pack` tem o template `purchase-option`, os itens são
**variantes** do produto — Agenda Normal, Pack Pioneiro — e o `quantity` de cada
um é só um índice para alinhar com a tabela do `pricing.json`. Acontece nas
`agendas` e nos `cadernos-anuais`.

Isto importa por dois motivos:

1. Mostrá-las como quantidades faria o editor dizer *"2 agendas = 34,90 €"*, que
   não é verdade.
2. **O número que cobra é o `priceCents` do item**, não a tabela — ver
   `purchaseOptionCents()` em `js/10-produto-precos.js` e
   `product_flat_unit_price_cents()` no `send-order.php`, onde a tabela é só o
   recurso.

O mesmo valor vive em **três** sítios: `steps[pack].items[].priceCents`,
`pricing.json → prices` (indexado pelo índice) e `pricing.json →
flatUnitPricesCents` (indexado pelo `value` da variante). O editor detecta estas
tabelas, mostra-as pelo nome da variante e **escreve nos três de uma vez** —
editar só um deles mudaria um número que não cobra nada.

### Portes — um valor para o site todo

`PORTES_CENTRAIS_V1`. O preço dos portes vem do bloco `delivery` do
`content/pricing.json`. O JSON de cada produto continua a dar a **estrutura**
das opções (id, etiqueta, texto); só o valor é central.

```json
"delivery": { "pickup": 0, "shipping": 540, "join_orders": 0 }
```

O par é `central_delivery_fees()` no `send-order.php` e
`applyCentralDeliveryFees()` em `js/10-produto-precos.js`. Se o bloco não tiver
a opção, cai para o `feeCents` do produto.

Antes eram 13 cópias e já tinham divergido uma vez (5,55 € contra 8,50 €). O
editor mostra-os uma só vez, na tab *Produtos*.

### Acabamentos e extras — um valor para o site todo

`EXTRAS_CENTRAIS_V1`. Mesmo princípio dos portes, para os acréscimos **por
unidade**. O acabamento holográfico estava escrito em dez ficheiros porque cada
percurso de venda declarava as suas opções: a loja lê os `steps` do produto, a
personalização lê o catálogo do `personalizacao.json`, e o servidor cobra pelo
`finishOptions` do destino.

```json
"optionExtras": { "holografica": 25, "capa-mole": 0, "capa-dura": 400 }
```

Indexado pelo `value` da opção — ou pelo `id`, quando o extra pertence a um passo
inteiro (`cover_personalization`). Sobrepõe-se ao `extraPriceCents` e ao
`extraPriceCentsPerUnit` **onde quer que apareçam**: `finishOptions`, gavetas,
passos, catálogo da personalização.

O par é `apply_central_option_extras()` no `send-order.php` e
`applyCentralOptionExtras()` em `js/10-produto-precos.js`. Uma chave que o bloco
não conheça fica com o valor do produto, e a cápsula do congresso lê o seu
próprio `pricing.json` — sem bloco lá, nada muda nela.

Ao gravar, o `precos.php` escreve no `optionExtras` **e** replica por todas as
cópias, para nenhuma ficar a mostrar um número que já não é o cobrado. Só grava
os ficheiros que a chave toca.

### Quatro escadas de desconto

`DESCONTOS_COLUNAS_V1`. Cada tabela guarda **quatro** conjuntos de descontos —
D1 a D4 — em `discountsByPriceKey`, e usa um. Serve para preparar uma campanha
sem perder a escada que está a vender.

```json
"discountsByPriceKey": {
  "32 mm": { "activo": "D1", "D1": { "3": 4.8, "5": 14.3 }, "D2": { … } }
}
```

Quem manda no preço continua a ser a `prices`: marcar uma coluna converte as
percentagens em totais e escreve-os lá, porque é a `prices` que o site lê. As
percentagens ficam guardadas só para se poder voltar atrás.

Duas regras que evitam surpresas:

- Editar uma coluna que **não** está marcada não mexe em preço nenhum.
- Marcar uma coluna **não** reescreve as quantidades cuja percentagem já bate
  certo com a tabela. Sem isto, trocar D1→D1 mexia nos preços por arredondamento:
  30,6% de 48 unidades dá 49,97 € e não os 50,00 € que lá estavam.

Na tab das fotografias do `precos.php` há um selector que põe **todas** as
tabelas na mesma coluna de uma vez, com a contagem de quantas estão em cada uma.

### Custos e margens — ficam fora da raiz web

O custo por unidade **não vai para o `content/pricing.json`**, que é servido
publicamente: qualquer pessoa que abrisse
`https://miaandpaper.com/content/pricing.json` veria as margens do negócio.

Vive em `private/custos.json`, ao lado da base de dados, fora da raiz web e fora
do git. O site público nunca o lê — só o editor. O deploy envia-o à parte, por
`scp`, para `/home/currwkdi/private/` (passo `CUSTOS_PRIVADOS_V1` no
`[2]upload-or-download.bat`), para o painel no servidor também mostrar margens.

Formato: `{ "produtos": { "<slug>": { "<tabela>": custoPorUnidadeEmCentimos } } }`.
Pôr o custo a zero apaga a entrada.

### A cápsula do Congresso 2026

A regra de não mexer na cápsula é sobre **imagens e design** — os preços podem e
devem acompanhar o catálogo, senão divergem sozinhos (já aconteceu com os
portes, 5,55 € contra 8,50 €).

O editor mostra a tabela da cápsula, compara-a com o produto do catálogo que a
espelha e oferece um botão para sincronizar:

| cápsula | espelha |
|---|---|
| `crachas`, `pins` | `crachas-loja` |
| `imanes` | `imanes-loja` |
| `caderninhos` | `mini-cadernos` |
| `cadernos` | `cadernos-anuais` |
| `lembrancas` | nenhum — é oferta, está tudo a zero |

Sincronizar copia **só as tabelas que existem nos dois lados**. Nunca acrescenta
nem remove tabelas, para não inventar na cápsula um tamanho que ela nunca
vendeu — é por isso que os crachás de 58 mm existem no catálogo e não na
cápsula.

**Nada toca no site antes do Save**, incluindo as alterações estruturais: são
aplicadas a uma cópia local para a página mostrar o resultado, e só seguem para
o servidor no botão. O **Undo** é uma pilha de 60 fotografias do par
(dados, fila). `Ctrl+Z` e `Ctrl+S` funcionam.

Um produto por **tab**; a primeira é a grelha de fotografias e serve de atalho.
As tabs arrastam-se para reordenar e a ordem fica em
`private/editor-preferencias.json` — no servidor, não no browser.

O `id` e o `value` de um item **não** são editáveis, de propósito: são a
identidade referida pelas selecções gravadas no browser, pelas encomendas já
feitas e pelas allowlists do `send-order.php`.

Cada tabela tem uma curva do preço por unidade, com um **ponto vermelho onde a
escada sobe** — um pack maior a custar mais por unidade do que um mais pequeno é
quase sempre um erro de escrita. Hoje não há nenhum.

O painel é escuro e **não segue o tema do sistema**: os acentos por métrica
(azul, ciano, roxo, verde) só funcionam sobre o fundo escuro, e é isso que
separa um número de estado de um número de dinheiro num ecrã cheio de campos.
As cores são as do editor, não as do site — este é o único sítio do repositório
que não usa os tokens de `css/01-tokens-agua.css`, de propósito: é uma
ferramenta interna e não deve herdar mudanças da paleta da marca.

### As garantias

Três coisas que ele faz e que uma edição à mão não faz:

- **Recusa gravar uma configuração inválida.** Corre
  `main_v2_pricing_is_valid` e `main_v2_pricing_modes_agree` — as funções reais
  do `send-order.php` — sobre o estado que *ficaria* gravado, incluindo os
  produtos que nem foram abertos. Hoje, sem ele, uma incoerência só aparece no
  checkout, em silêncio para o cliente.
- **Corre o cross-check JS ↔ PHP** com um clique, sobre todas as tabelas e todas
  as quantidades até 500. As funções do cliente vêm de um `iframe` de uma página
  de produto verdadeira, como a galeria faz com o renderer.
- **Preserva a indentação de cada ficheiro**, para uma alteração de preço dar um
  diff de uma linha e não de quatrocentas.

A gravação é **atómica e verificada**: monta o ficheiro ao lado e só depois o
põe no lugar com um `rename`, e a seguir volta a lê-lo e a descodificá-lo. Se o
resultado não for JSON válido, repõe a cópia e recusa. Um leitor nunca vê um
ficheiro a meio, e uma escrita mais curta não pode deixar cauda do conteúdo
antigo — que é exactamente como um JSON de produto se transforma em lixo.

Além disso: revisão SHA-256 para detectar edições concorrentes, cópia
`.precos-bak` antes de escrever, e recusa de remover a última linha de uma
colecção ou o último pack de uma tabela.

⚠️ **Está aberto sem autenticação** enquanto `MIA_ADMIN_OPEN` estiver activo.
Antes do deploy, pôr `MIA_ADMIN_OPEN` a `false` em `site/admin-open.php`;
preços é mais perigoso do que trocar imagens.

### Porque é que não está tudo no `pricing.json`

Porque *um sítio para editar* não obriga a *um ficheiro para ler*. As tabelas
base e os modos já vivem no `pricing.json`; os portes, acabamentos, extras e
tamanhos continuam no JSON de cada produto. Mudar isso obrigaria a reescrever as
duas implementações de cálculo em simultâneo, que é exactamente onde se cobra ao
cliente um valor diferente do que a página mostrou. O editor resolve o problema
real — não saber onde está um preço — sem tocar no caminho de cálculo.

O que ainda está disperso, e portanto duplicado, está listado em
[09 · Pendentes](09-pendentes.md).

---

## As duas fontes

Cada produto declara os preços em dois sítios:

- `content/products/<slug>.json` — o que o browser lê
- `content/pricing.json` — o que o `send-order.php` lê

O servidor compara-os (`main_v2_pricing_is_valid` e
`main_v2_pricing_modes_agree`). Se o modo, o `allowUnitDiscounts` ou o
`pricingModeByPriceKey` divergirem, **a encomenda é recusada na submissão, em
silêncio para o cliente**. É o erro mais fácil de cometer aqui.

## Os modos

| modo | `allowUnitDiscounts` | quem usa |
|---|---|---|
| `tier-unit` | `true` | **o modo normal**: blocos-a6, bloquinhos, crachas-loja, imanes-loja, imanes-recortados, mini-cadernos |
| `flat-unit` | `false` | agendas, cadernos-anuais, marcadores, marcadores-magneticos, stickers |
| `pack-combination` | `true` | **nada — deprecated**. Ainda aceite para configurações antigas validarem |
| `linear-discount-interpolation` | `true` | nada — idem |

⚠️ **O `pack-combination` está fora de uso desde 2026-08-07.** Os cinco produtos
que o usavam passaram a `tier-unit`, o que baixou preços em quantidades entre
patamares — 70 crachás de 25 mm passaram de 79,00 € para 72,92 €. Se encontrares
código que faça combinações de packs, é vestígio: o preço é sempre o do último
patamar atingido.

Os crachás têm **três** tabelas — `25 mm`, `32 mm` e `58 mm`. O tamanho de 58 mm
(o item `grandes`, rotulado "Grandes") existia no passo de tamanhos desde antes,
mas sem `priceKey` e sem tabela: quem o escolhesse não via preço nenhum. Ganhou
tabela a 2026-08-06.

O modo pode ser fixado **por tabela de preços** com `pricingModeByPriceKey`,
para produtos cujas variantes preçam de forma diferente. Hoje só os
`imanes-loja` o usam:

```json
"pricingMode": "pack-combination",
"pricingModeByPriceKey": { "Achatados": "tier-unit" }
```

O mapa tem de ser igual nos dois ficheiros. A resolução é o par
`effectivePricingMode()` (JS) / `main_v2_effective_pricing_mode()` (PHP).

Os `quadros` (molduras) não declaram `catalogContext: "main-v2"` nem
`pricingMode` — têm o seu próprio cálculo por tamanho e opções.

---

## `pack-combination` — deprecated

Mantido só para configurações antigas validarem. Nenhum produto o usa desde
2026-08-07. O que está descrito a seguir é o que ele fazia; não é como os preços
funcionam hoje.


**Não há descontos intermédios.** O preço de N unidades é a combinação mais
barata de packs configurados que some **exactamente** N — 47 crachás são
`1 pack de 24 + 4 packs de 5 + 1 pack de 3 = 57,20 €`. É um problema de troco
(*coin change*) resolvido por programação dinâmica.

Duas consequências que parecem bugs e não são:

- **Nem toda a quantidade é encomendável.** Uma quantidade só existe se os packs
  puderem somar-lhe. Crachás, mini-cadernos e ímanes 3 mm têm preço de 1
  unidade, por isso tudo a partir de 1 funciona. Uma tabela sem preço unitário
  (packs 15/30/60/105) só chega a múltiplos de 15 — o controlo de quantidade
  encaixa (`snapQuantityToPacks`) e o servidor recusa o resto. Para ganhar
  granularidade, acrescenta-se um pack pequeno à tabela ou passa-se a tabela
  para `tier-unit` (foi o que os ímanes *Achatados* fizeram). **Não se
  resolve com um caso especial no código.**
- **N pode custar mais do que N+1.** 47 crachás (57,20 €) custam mais do que 48
  (50,00 €). É intencional: `renderPackCombinationSummary` mostra a decomposição
  e a linha *"se comprares 1 pack de 48, consegues 48 crachás por 50,00 € —
  poupas 7,20 €"*. Não "corrigir" a inversão limitando o preço; a sugestão é o
  ponto todo.

## `tier-unit`

O escalão mais baixo é o preço-base (0% de desconto) e cada escalão acima fixa o
seu próprio desconto. **Acima do mínimo, qualquer quantidade inteira é
encomendável**, e cada unidade extra é vendida ao desconto do escalão em vigor:
16 ímanes finos são `16 × (10,00 € / 15) = 10,67 €`; 31 são
`31 × (18,00 € / 30) = 18,60 €`.

Abaixo do primeiro escalão não há preço: o cliente é limitado ao mínimo e o
servidor recusa — incluindo no fluxo de artwork próprio, validado no passo do
upload.

Os produtos `tier-unit` mantêm a mesma sugestão de poupança do
`pack-combination` (`renderTierUpgradeSummary`), porque uma quantidade logo
abaixo de um escalão pode custar mais do que o escalão (35 recortados = 35,00 €,
36 = 34,00 €).

---

## A dupla implementação

| modo | cliente (`js/10-produto-precos.js`) | servidor (`lib/precos-core.php`) |
|---|---|---|
| `pack-combination` | `packCombinationPlan()` | `product_pack_combination_plan()` |
| `tier-unit` | `tierPriceCents()` | `product_tier_price_cents()` |

O lado PHP vive em `site/lib/precos-core.php`, partilhado pelo `send-order.php`
(que cobra) e pelo `precos-api.php` (que valida). **Não redefinir nenhuma dessas
funções noutro ficheiro** — o objectivo da biblioteca é não haver uma terceira
cópia a divergir.

**Se mexeres numa, corre o cross-check antes de publicar.** Uma divergência aqui
cobra ao cliente um valor diferente do que a página mostrou.

O cross-check é correr as duas implementações sobre todas as tabelas de
`pricing.json` e todas as quantidades de 1 a 500, comparando cêntimo a cêntimo.
Deve dar **zero divergências**. O botão **Verificar todos os preços** do
`precos.php` faz exactamente isso — hoje dá zero em 4000 comparações.

No `pack-combination`, além do algoritmo, o desempate tem de ser o mesmo: packs
por ordem crescente e comparação estrita (`<`), para o pack mais pequeno ganhar
em caso de empate.

Já aconteceu a sério: o PHP dividia antes de multiplicar
(`round($q * ($total / $qtd))`) e dava menos 1 cêntimo em quantidades onde a
divisão não é representável em binário. Corrigido a 31/07/2026 para
`round($q * $total / $qtd)`, alinhado com o JS.

## O servidor não confia no cliente

`price_total` viaja no formulário mas o `send-order.php` **nunca o lê** —
recalcula tudo do zero. Não tentar "optimizar" isso.

## Botões de pack ≠ preços

Um tile de pack só é desenhado quando a sua quantidade também existe na tabela
`prices` activa. Um produto `flat-unit` precisa de entradas proporcionais
(`5: 250` para um sticker de 0,50 €) para mostrar botões sem inventar desconto
nenhum.
