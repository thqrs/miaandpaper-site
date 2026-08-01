# Como o site Mia & Paper funciona

Documento de orientação para agentes que peguem neste repositório.
O `AGENTS.md` diz o que **não** fazer; este diz **como as coisas são**.

Última revisão: 31 de Julho de 2026.

---

## 1. A ideia central, em três frases

As páginas HTML estão **vazias**. Cada uma é uma casca de 20 linhas que carrega
`app.js` e declara, no `<body>`, o que é e que produto mostra. O `app.js` lê um
JSON de `content/` e desenha a página inteira no browser.

```html
<body data-page="product" data-product="bloquinhos">
  <div id="app" class="app-shell"></div>
  <script src="app.js?v=2026073101"></script>
</body>
```

**Consequência prática número um:** procurar texto ou marcação nos ficheiros
HTML quase nunca dá resultado. O conteúdo está nos JSON; a marcação está no
`app.js`.

**Consequência prática número dois:** não se pode raspar o HTML servido para
saber o que a página mostra. É preciso abrir no browser e deixar o JS correr.

### `data-page` — os cinco tipos de página

| valor | quem | o que o `app.js` faz |
|---|---|---|
| `product` | os 10 produtos + `personalizacao.html` | wizard de passos a partir de `content/products/<slug>.json` |
| `home` | `index.html`, `congressos.html` | grelha de categorias a partir de `content/home.json` |
| `checkout` | `checkout.html` | carrinho e finalização |
| `add-product` | `adicionar-produto.html` | grelha de `content/order-products.json` |
| `contact` / `static` | `contacto.html`, `privacy.html`, `agendas.html`, `postais.html`, `ajuda-upload.html` | páginas simples |

`data-product` **tem de coincidir exactamente** com o nome do ficheiro em
`content/products/`. É por aí que a galeria liga um produto à sua página.

---

## 2. Onde vive cada coisa

```
site/
├── *.html                     cascas (20 linhas cada)
├── app.js            828 KB   TODO o renderer do site público
├── styles.css        270 KB   todo o CSS (ver RELATORIO-DESIGN-CSS.md)
├── content/
│   ├── home.json              categorias da homepage, tema, carrossel
│   ├── pricing.json           ⚠️ fonte central de preços
│   ├── order-products.json    grelha do "adicionar outro produto"
│   ├── products/<slug>.json   um por produto: passos, designs, preços
│   ├── products-legacy/       versões antigas — não são servidas
│   └── designs/               as imagens (55 MB)
├── send-order.php    200 KB   ⚠️ recebe encomendas. A autoridade dos preços.
├── send-message.php           formulário de contacto
├── upload-order-photo.php     recebe ficheiros dos clientes
├── track-order-event.php      funil analítico
├── lib/db.php         69 KB   SQLite: schema, migrações, todos os acessos
├── admin-*.php                painéis (encomendas, funil, dashboard)
├── galeria.html + galeria-api.php     gestão de imagens
├── produtos.html + produtos-api.php   vista de produtos e "teia"
├── modulos.php                inventário visual do CSS (gerado)
└── congressos/2026/           ⚠️ cápsula do tempo — nunca editar
```

Fora de `site/` (não é publicado): `private/` no servidor, irmã da raiz web,
com a base de dados, os uploads dos clientes e a configuração de email.

---

## 3. O wizard de produto

Um produto é uma lista de **passos**. Cada passo tem um `template` que diz ao
`app.js` como o desenhar:

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

O estado vive em `state.selections`, no browser. Ao submeter, o `app.js`
carimba campos escondidos no formulário (`addHiddenFields`) e faz POST para
`send-order.php`.

### Regra de ouro: gatilhos por dados, não por slug

O `app.js` é partilhado entre o catálogo actual e a cápsula do Congresso 2026.
Uma alteração de comportamento **nunca** deve ser condicionada por uma lista de
slugs no código — deve ser uma **flag no JSON** do produto que a quer.

Exemplo real: `"adjustPerDesign": true` no passo `pack`. Os produtos que a têm
ganham o ajuste de quantidade por design; os da cápsula, que não a têm, ficam
exactamente como estavam.

Sempre que se muda `app.js`, verificar **um produto do catálogo e um da
cápsula**.

---

## 4. Preços — a parte onde se perde dinheiro

### As duas fontes têm de concordar

Cada produto declara os preços em **dois sítios**:

- `content/products/<slug>.json` — o que o browser lê
- `content/pricing.json` — o que o `send-order.php` lê

`send-order.php` compara-os (`main_v2_pricing_modes_agree`). Se o modo ou o
`allowUnitDiscounts` divergirem, **a encomenda é recusada na submissão, em
silêncio para o cliente**. Alterar um sem o outro é o erro mais fácil de
cometer aqui.

### Os três modos

| modo | `allowUnitDiscounts` | quem usa |
|---|---|---|
| `flat-unit` | `false` | stickers, marcadores, cadernos anuais |
| `pack-combination` | `true` | crachás, mini-cadernos, **bloquinhos**, ímanes 3 mm |
| `tier-unit` | `true` | ímanes Achatados, ímanes recortados |

`pricingModeByPriceKey` permite modos diferentes por tabela dentro do mesmo
produto (os ímanes fazem isso).

**`pack-combination`** — não há descontos intermédios. O preço de N é a
combinação de packs mais barata que soma **exactamente** N. É um problema de
troco (*coin change*) resolvido por programação dinâmica. Consequências:
- nem toda a quantidade existe (se não houver preço de 1 unidade, só se chega
  a múltiplos dos packs);
- **N pode custar mais do que N+1** — 47 crachás custam mais do que 48. É
  intencional: a página mostra a sugestão de subir para o pack.

**`tier-unit`** — o escalão mais baixo é o preço-base e cada escalão acima fixa
o seu desconto. Qualquer quantidade acima do mínimo é encomendável.

### A regra que não se pode esquecer

Cada modo está implementado **duas vezes** — em JS para o cliente ver, em PHP
para o servidor cobrar:

| | cliente | servidor |
|---|---|---|
| pack-combination | `packCombinationPlan()` | `product_pack_combination_plan()` |
| tier-unit | `tierPriceCents()` | `product_tier_price_cents()` |

**Se mexeres numa, corre o cross-check antes de publicar.** Uma divergência
aqui cobra ao cliente um valor diferente do que a página mostrou. Já aconteceu:
o PHP dividia antes de multiplicar e dava menos 1 cêntimo em certas
quantidades — corrigido a 31/07/2026, com um comentário no sítio a explicar
porquê.

O cross-check é fazer correr as duas implementações sobre todas as tabelas de
`pricing.json` e todas as quantidades de 1 a 500, e comparar cêntimo a cêntimo.
Deve dar **zero divergências**.

### O servidor não confia no cliente

`price_total` viaja no formulário mas o `send-order.php` **nunca o lê** —
recalcula tudo. Não tentes "optimizar" isso.

---

## 5. Como se acrescenta um produto

Ordem que funciona (a dos Bloquinhos, 31/07/2026):

1. `content/products/<slug>.json` — o nome tem de bater com `^[a-z0-9-]+$`
2. `<slug>.html` — casca com `data-product="<slug>"`
3. `content/pricing.json` — entrada com **o mesmo modo** do JSON do produto
4. `content/home.json` — categoria (e ajustar os `menuOrder` seguintes)
5. `content/order-products.json` — para aparecer no "adicionar outro produto"
6. `content/products/personalizacao.json` — se aceitar artwork do cliente
7. `send-order.php` — **quatro** listas: `safe_return_to`, `safe_product_slug`,
   `cart_allowed_product_slug`, `cart_is_main_v2_slug`
8. `app.js` — só se a família for nova: `supportsAssortedDesigns` e a lista do
   selector de formato
9. `galeria-slots.js` — `PRODUCT_CODES` e `SHORT_ENTRY_CODES`
10. `produtos-admin.js` — singular e plural
11. `admin-funnel.php` — `af_main_v2_slugs()` e o mapa de nomes
12. `admin-live-dashboard.php` — quatro sítios: lista de slugs, mapa de nomes,
    linha do metro com as suas estações, `lineLabel` em JS

**Depois:** abrir `galeria.html` e confirmar que o produto aparece com
identificadores próprios e link para a página (senão fica "órfão"). O
`GALERIA.md` tem a checklist completa.

---

## 6. Imagens

- Formato: **WebP**, sempre.
- Vivem em `content/designs/`, referenciadas por caminho relativo nos JSON.
- **Os ajustes de enquadramento vivem em `item.imageEdits[editKey]`**, que
  ganha às propriedades planas `imageZoom` / `imagePositionX` / etc. do item.
  Nunca calcular esses valores por fora — ler o que o site aplica.
- `galeria.html` edita enquadramento e substitui ficheiros;
  `multimedia.html` é o inventário de tudo.
- A descoberta é automática: qualquer caminho de imagem dentro de um JSON de
  produto é encontrado por varredura genérica (`galeria-slots.js`). Não existe
  registo manual, e não se deve criar um.

---

## 7. Encomendas — o percurso completo

```
wizard (app.js)
   └─ POST → send-order.php
        ├─ safe_return_to() / safe_product_slug()      allowlists
        ├─ mp_db_form_rate_limited('order', ip, 12)    anti-abuso
        ├─ recalcula os preços do zero
        ├─ mp_db_generate_order_code()                 MP-YYYYMM<n>
        ├─ copia os anexos tmp → orders/<CODIGO>/
        ├─ mp_db_insert_order()                        SQLite
        ├─ mail() para a Mia
        └─ mail() de cópia para o cliente (opcional)
```

Há **dois caminhos** lá dentro:

- **carrinho** (`order_mode=cart`) — o normal hoje. Cada linha traz o seu slug e
  é validada por `cart_allowed_product_slug()`. É por aqui que passam a
  personalização e o checkout.
- **produto único** — o caminho antigo, ainda usado pela cápsula do congresso.

O **código de encomenda** é reservado atomicamente numa tabela própria
(`order_code_reservations`, PRIMARY KEY) no momento em que é gerado. Antes era
só um `SELECT`, e dois pedidos simultâneos podiam receber o mesmo código —
o `INSERT` falhava e uma encomenda perdia-se.

---

## 8. Ficheiros dos clientes

**Nada é apagado automaticamente.** Foi decisão explícita do Tiago (31/07/2026):
o que um cliente envia fica até ele decidir apagar. O TTL de 7 dias que existia
foi retirado.

```
private/order-uploads/
├── .tamanho.json          cache do tamanho total
├── tmp/                   uploads que ainda não viraram encomenda
│   ├── <token>.<ext>      o ficheiro
│   └── <token>.json       nome original, tamanho, sha256, data, dimensões
└── orders/<CODIGO>/       anexos de uma encomenda concreta
```

Como não há expiração, o que protege o disco são três travões em
`upload-order-photo.php`:

| travão | valor |
|---|---|
| por ficheiro | 30 MB (artwork) / 15 MB (fotos) |
| por pedido | 10 ficheiros |
| por IP | 60 uploads/hora |
| área toda | avisa aos 6 GiB, **recusa** aos 8 GiB |

Ao chegar ao tecto, **recusa uploads novos e nunca apaga nada**. Escreve no
`error_log` a dizer que é preciso libertar espaço.

**Para libertar espaço à mão:** `tmp/` são abandonados (cada um tem o `.json`
ao lado a dizer o que é); `orders/<CODIGO>/` pertencem a uma encomenda que se
pode consultar em `admin-orders.php`.

A validação é por **magic bytes**, não por extensão. Os ficheiros ficam fora da
raiz web com nome aleatório e permissões `0600`; só são servidos por
`order-media-preview.php`, que exige o token de 128 bits.

---

## 9. Tracking

`track-order-event.php` recebe JSON por POST e escreve em três sítios: SQLite
(`funnel_events`, a fonte), um JSONL diário e um JSONL legado (auditoria).

- Guarda o **IP completo** — decisão explícita, e o `privacy.html` declara-o.
- **Não** guarda nome, email, telefone nem morada. Esses só existem em `orders`.
- Limite de 60 eventos por IP por minuto; acima disso, descarte silencioso.
- Lista de IPs a ignorar (`tracking_ignore_ips`) para o próprio admin não
  poluir os números.
- Responde sempre `204`. O cliente nunca sabe se resultou — nem precisa.

### Os painéis

| página | o que é |
|---|---|
| `admin-funnel.php` | tabelas: visitantes, origens, interesse, downloads, mapa |
| `admin-live-dashboard.php?view=metro` | replay passo a passo sobre um mapa tipo metro |
| `admin-live-dashboard.php?view=teia` | a "teia" de produtos, em iframe do `produtos.html` |
| `admin-orders.php` | encomendas, estados, anexos |
| `modulos.php` | os 14 módulos de interface, desenhados a sério, claro e escuro |
| `modulos-temp.html` | sandbox estático dos mesmos módulos, para experimentar |
| `admin-snapshots.php` | criar/apagar os snapshots das páginas pesadas |

O `modulos.php` desenha cada módulo num iframe de `modulos-preview.html`, que
chama `MiaPreview.renderStep()` — a mesma função da galeria. Os módulos são
descobertos a agrupar os passos de todos os produtos pelo seu `template`, por
isso um passo novo aparece lá sozinho.

### O sandbox — `modulos-temp.html`

Um ficheiro **estático** de 500 KB com os mesmos 14 módulos, mas sem iframes e
sem `app.js`: a marcação de cada módulo e uma **cópia** do `styles.css` estão
lá dentro.

Serve para experimentar. Como não partilha ficheiro nenhum com o site, mexer
nele não pode partir nada:

| | `modulos.php` | `modulos-temp.html` |
|---|---|---|
| origem | lê os JSON e desenha com o `app.js` | cópia congelada |
| actualiza-se | sozinho | nunca |
| editar | mexe no site a sério | não afecta nada |

As regras de modo escuro estão reescritas de `html[data-theme="dark"]` para
`.tema-escuro`, para os dois temas caberem na mesma página sem iframes.

O painel de cores mexe nos 40 tokens e tem um botão que **exporta o CSS das
alterações** já com os selectores certos (`:root` e `html[data-theme="dark"]`)
— é assim que uma experiência que se goste passa do sandbox para o site.

**Como refazer** quando ficar velho: não há gerador automático. O ficheiro foi
montado a extrair `#app.innerHTML` de cada `modulos-preview.html` num browser e
a juntar tudo com o CSS. Refazer à mão custa pouco, mas **apaga as
experiências que lá estiverem** — por isso é melhor exportar o CSS primeiro.

**Cuidado com o tamanho do replay.** O payload do metro levava todos os eventos
do período; com ~20 mil eventos o `json_encode()` rebentava o `memory_limit` de
128 MB e a página morria a meio — o `<script id="lrReplayData">` nunca era
escrito e o replay ficava em `0/0`. Hoje está limitado aos
`LR_REPLAY_MAX_EVENTS` (4000) mais recentes, com aviso na interface. **Se
acrescentares campos a cada evento do replay, verifica outra vez.**

Uma linha nova no metro precisa de quatro alterações no
`admin-live-dashboard.php` — ver o passo 12 da secção 5.

**Há uma linha de metro por cada fluxo com tráfego.** Verificado a 31/07/2026:
17 linhas desenhadas, incluindo `home` e `final`. `imanes-recortados` e
`personalizacao` não tinham linha nenhuma apesar de terem visitas reais — os
seus eventos caíam todos na estação genérica `split`. Foi corrigido. Se
criares um produto e não o registares aqui, acontece o mesmo em silêncio: o
produto some do funil sem dar erro.

O `lembrancas` continua sem linha de propósito — é um produto retirado, sem
página.

---

## 9-A. Snapshots

Três páginas são servidas de HTML congelado em `private/snapshots/`:

| página | ao vivo | do snapshot |
|---|---|---|
| `admin-funnel.php?period=30d` | 4,6 s | **0,016 s** |
| `admin-live-dashboard.php?view=teia` | 3,1 s | **0,013 s** |
| `admin-live-dashboard.php?view=metro` | 3,5 s | **0,020 s** |
| `modulos.php` | 0,58 s | **0,006 s** |

O motor está em `lib/snapshot.php`. A ideia é simples: `mp_snapshot_start()`
no topo da página serve o ficheiro e termina o pedido; `mp_snapshot_end()` no
fim grava o que foi produzido.

**Chamar o `mp_snapshot_start()` o mais cedo possível** — antes de qualquer
`mp_db()`. Abrir a ligação SQLite custa sozinha ~300 ms, porque verifica as
migrações. No `admin-funnel.php` isto obrigou a resolver o `$period` no topo
do ficheiro.

**Refazer:** `admin-snapshots.php` → "Criar todos os snapshots". O botão corre
no browser, uma página de cada vez — a primeira versão fazia o PHP chamar-se a
si próprio por HTTP e encravava em servidores de um só processo (como o
`php -S` do desenvolvimento).

**Quando refazer:** sempre que a estrutura mudar, e antes de cada deploy.

**Um POST nunca é servido de snapshot** nem grava um — as acções do painel
(marcar IP a ignorar, arquivar) continuam a correr sempre a sério.

---

## 9-B. Avisos por email

`lib/avisos.php` avisa a Mia por email quando algo acontece que de outra forma
só apareceria no `error_log`. Vão para os endereços em `to` do ficheiro privado
de configuração — o mesmo que recebe as encomendas, e aceita vários separados
por vírgula ou ponto e vírgula.

| tipo | quando | janela de silêncio |
|---|---|---|
| `upload` | um cliente enviou ficheiros | 15 min por IP |
| `guardrail` | um travão entrou em acção | 1 h |
| `encomenda_falhou` | a encomenda não foi gravada | 5 min |
| `email_falhou` | o `mail()` da encomenda falhou | 5 min |
| `config` | falta configuração no servidor | 6 h |

A janela de silêncio é por tipo **e** por chave: dois IPs diferentes a enviar
ficheiros dão dois avisos; o mesmo IP oito vezes dá um. As repetições
suprimidas são contadas e o aviso seguinte diz quantas foram.

O estado vive em `private/avisos-estado.json`, **não na base de dados** — para
os avisos continuarem a funcionar quando é a base de dados que está a falhar.

`mp_aviso()` nunca lança excepções e nunca devolve erro ao chamador. Sem
ficheiro de configuração, escreve no `error_log` e segue. Um aviso que falha
não pode estragar uma encomenda.

---

## 10. Base de dados

SQLite em `private/miaandpaper.sqlite`, acedida só por `lib/db.php`.

Tabelas: `orders`, `order_events`, `order_code_reservations`, `email_log`,
`funnel_events`, `funnel_events_archive`, `form_submissions`,
`tracking_ignore_ips`, `ip_lookup_cache`, `admin_login_attempts`,
`assisted_uploads`, `colors`, `color_flows`, `schema_migrations`.

**Migrações:** array `$migrations` em `mp_db_migrate()`, com uma chave por
alteração. Correm sozinhas no primeiro acesso. Só acrescentar ao fim — nunca
editar uma migração já aplicada. `ALTER TABLE ADD COLUMN` duplicado é tolerado
de propósito (recuperação parcial).

Todos os acessos usam *prepared statements*. Os nomes de coluna vêm de arrays
fixos no código, nunca de input.

---

## 11. Administração

**Estado actual: os painéis estão abertos, sem palavra-passe, por decisão do
Tiago, até ao deploy.**

Três interruptores controlam isto:

```php
site/galeria-api.php:10   define('GALERIA_REQUIRE_ADMIN', false);
site/produtos-api.php:5   define('PRODUTOS_REQUIRE_ADMIN', false);
site/reviews-api.php:6    define('REVIEWS_REQUIRE_ADMIN', false);
```

O `galeria-api.php` e o `reviews-api.php` **escrevem ficheiros** — com eles a
`false`, qualquer pessoa pode reescrever `content/products/*.json`, incluindo
os preços. O `produtos-api.php` é só de leitura.

### ⚠️ Antes do deploy

1. Pôr os três a `true`.
2. Confirmar que `galeria.html`, `produtos.html` e `reviews.html` continuam a
   funcionar com sessão iniciada (o CSRF e o `session_start()` já lá estão —
   só estão a ser saltados pelo `if (!X_REQUIRE_ADMIN) return;`).
3. Confirmar a compressão no servidor:
   `curl -sI -H "Accept-Encoding: gzip" https://miaandpaper.com/app.js | grep -i content-encoding`
   — `app.js` + `styles.css` são 1,1 MB sem gzip.
4. Actualizar o `?v=` em todos os HTML se `app.js` ou `styles.css` tiverem
   mudado. **Não há automatismo**; se esqueceres, os visitantes que já cá
   vieram continuam com a versão antiga.

---

## 12. Deploy

Não existe `.cpanel.yml`. O deploy é o `[2]upload-or-download.bat` na raiz do
repositório, que por SSH corre no servidor:

```
git pull --ff-only origin main
/bin/cp -R site/. /home/currwkdi/miaandpaper.com/
```

**O commit é a unidade de publicação.** O que não está commitado e enviado não
é publicado.

**`cp -R` nunca apaga.** Ficheiros removidos do repositório continuam vivos no
servidor para sempre. Apagar é um trabalho de dois passos: no repositório *e*
no servidor. Foi assim que três pastas de PDFs duplicados (131 MB) sobreviveram
meses depois de deixarem de ser referenciadas.

O mesmo `.bat` também sincroniza ao contrário (servidor → PC), o que
sobrescreve o `site/` local. Faz cópia de segurança antes, mas confirma a
direcção antes de correr.

---

## 13. Armadilhas conhecidas

1. **`congressos/2026/` é uma cápsula do tempo.** Nunca editar, por motivo
   nenhum. Regista o que foi vendido em 2026. Serve de referência de leitura
   para as escadas de preços antigas.
2. **Alterar preços num só ficheiro** faz o checkout recusar a encomenda em
   silêncio. São sempre dois.
3. **Editar `app.js` sem verificar a cápsula** — o renderer é partilhado.
4. **Esquecer o `?v=`** depois de mexer em `app.js` ou `styles.css`.
5. **Apagar do repositório e julgar que saiu do servidor** (ver secção 12).
6. **Calcular ajustes de imagem por fora do `imageEdits`** — dá valores que
   não são os que o site aplica.
7. **Fazer `grep` no repositório sem excluir `tools/gerador-cartoes.php`** —
   são 5,1 MB de JavaScript minificado dentro de um PHP e inunda qualquer
   pesquisa.
8. **Assumir que o HTML servido tem o conteúdo.** Não tem. Ver secção 1.
9. **Mudar a estrutura e esquecer os snapshots** — os painéis continuam a
   mostrar a estrutura antiga, sem dar erro nenhum. Ver secção 9-A.
10. **Criar um produto e não o registar nos painéis** — desaparece do funil em
    silêncio. Aconteceu com `imanes-recortados` e `personalizacao`.

---

## 14. Como verificar trabalho neste repositório

Servidor local (já configurado em `.claude/launch.json`):

```bash
php -S 127.0.0.1:8082 -t site
```

Verificações que valem sempre a pena:

```bash
# sintaxe
for f in site/*.php site/lib/*.php; do php -l "$f"; done
for f in site/*.js; do node --check "$f"; done

# todos os JSON de conteúdo
python -c "import json,glob; [json.load(open(p,encoding='utf-8')) for p in glob.glob('site/content/**/*.json',recursive=True)]"

# todas as páginas respondem
for f in site/*.html; do curl -s -o /dev/null -w "%{http_code} $f\n" "http://127.0.0.1:8082/$(basename $f)"; done

# os painéis de admin não rebentam a memória
curl -s "http://127.0.0.1:8082/admin-live-dashboard.php?period=90d" | grep -ci "fatal error"
```

E, para qualquer coisa que se veja no browser: abrir a página, deixar o
`app.js` correr, e ler o DOM. Não basta olhar para o HTML servido.

---

## 15. Documentos relacionados

| ficheiro | assunto |
|---|---|
| `AGENTS.md` | regras e proibições — ler primeiro |
| `GALERIA.md` | ferramentas de imagem; checklist obrigatória de produto novo |
| `RELATORIO-VISTORIA-2026-07-31.md` | vistoria completa, com o que ficou por decidir |
| `RELATORIO-DESIGN-CSS.md` | auditoria do `styles.css` e a página `modulos.php` |
| `RELATORIO-UNIFORMIZACAO-DESIGN.md` | decisões de design pendentes |
| `DUPLICACAO-CONTEXTOS.md` | porquê catálogo e cápsula separados |
