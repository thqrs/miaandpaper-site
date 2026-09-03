# 07 · Backend — encomendas, ficheiros, tracking, dados

PHP em alojamento partilhado cPanel. Sem build, sem dependências, sem
framework.

---

## O percurso de uma encomenda

```
wizard (js/21-checkout.js)
   └─ POST → send-order.php
        ├─ safe_return_to() / safe_product_slug()      allowlists
        ├─ mp_db_form_rate_limited('order', ip, 12)    12/IP/hora
        ├─ recalcula os preços do zero                 ver 04-precos.md
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
(`order_code_reservations`, PRIMARY KEY) no momento em que é gerado. Antes era só
um `SELECT`, e dois pedidos simultâneos podiam receber o mesmo código — o
`INSERT` falhava e uma encomenda perdia-se.

Depois de a encomenda ficar guardada e o email da Mia sair, `send-order.php`
pode mostrar logo os dados de pagamento por MB WAY. Isso só acontece quando o
preço está totalmente definido, a entrega é por CTT (ou junta a uma encomenda
CTT ainda aberta) e o país do IP pertence à União Europeia. Qualquer falha na
geolocalização ou na confirmação destes dados cai no ecrã normal. O URL
`send-order.php?checkout_debug=true` mostra a mesma vista com dados fictícios,
sem gravar nem enviar nada.

Os formulários de email têm rate limiting por IP em SQLite: contacto 5/hora,
encomenda 12/hora, upload 60/hora. Sem isso, o domínio arriscava listas negras
por ser usado como relé.

---

## Ficheiros dos clientes

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

Como não há expiração, o que protege o disco são os travões declarados no topo
do `upload-order-photo.php` (constantes `ORDER_MEDIA_*`):

| travão | valor | constante |
|---|---|---|
| por ficheiro | 40 MB | `ORDER_MEDIA_ARTWORK_MAX_BYTES` |
| por pedido | 10 ficheiros | limite de `max_file_uploads` |
| por IP | 60 uploads/hora | `ORDER_MEDIA_UPLOADS_PER_IP_PER_HOUR` |
| área toda | avisa aos 6 GiB, **recusa** aos 8 GiB | `ORDER_MEDIA_AREA_WARN_BYTES` / `_BUDGET_BYTES` |

Ao chegar ao tecto, **recusa uploads novos e nunca apaga nada**, e escreve no
`error_log` a dizer que é preciso libertar espaço.

**Para libertar espaço à mão:** os de `tmp/` são abandonados (cada um tem o
`.json` ao lado a dizer o que é); os de `orders/<CODIGO>/` pertencem a uma
encomenda que se pode consultar em `admin-orders.php`.

A validação é por **magic bytes**, não por extensão. Os ficheiros ficam fora da
raiz web com nome aleatório e permissões `0600`; só são servidos por
`order-media-preview.php`, que exige o token de 128 bits.

---

## Tracking

`track-order-event.php` recebe JSON por POST e escreve em três sítios: SQLite
(`funnel_events`, a fonte), um JSONL diário e um JSONL legado (auditoria).
O cliente acumula eventos durante 750 ms e envia até 12 de cada vez; o endpoint
aceita o formato antigo de evento único e o novo `{ "events": [...] }`. Um lote
usa uma só abertura/migração da base e uma transacção SQLite.

- Guarda o **IP completo** — decisão explícita, e o `privacy.html` declara-o.
- **Não** guarda nome, email, telefone nem morada. Esses só existem em `orders`.
- Limite de 600 eventos por IP por minuto; acima disso, descarte silencioso da
  escrita em base de dados.
- Lista de IPs a ignorar (`tracking_ignore_ips`) para o próprio admin não poluir
  os números.
- Responde sempre `204`. O cliente nunca sabe se resultou — nem precisa.

### Nível de detalhe

A fonte pública é `content/tracking.json`; é um ficheiro estático e revalidável,
por isso consultar a configuração não abre PHP. Edita-se em `tracking.php`, com
sessão administrativa e CSRF:

| nível | o que guarda |
|---|---|
| `maximum` | todos os eventos, incluindo diagnóstico de cliques, dead taps, ampliações, heartbeat e alterações intermédias |
| `medium` | funil, escolhas importantes, snapshots, carrinho, uploads e encomendas — **predefinição** |
| `minimum` | entrada, passos, validações, contacto, uploads, carrinho e resultado da encomenda |
| `off` | nenhum evento de utilização |

O mesmo JSON governa o site principal, catálogo, ofertas e Congresso. Mudar de
nível não muda preços, encomendas nem o funcionamento da interface.

### Os painéis

| página | o que é |
|---|---|
| `admin-funnel.php` | tabelas: visitantes, origens, interesse, downloads, mapa |
| `admin-live-dashboard.php?view=metro` | replay passo a passo sobre um mapa tipo metro |
| `admin-live-dashboard.php?view=teia` | a "teia" de produtos, em iframe do `produtos.html` |
| `admin-orders.php` | encomendas, estados, anexos |
| `modulos.php` | os módulos de interface, desenhados a sério — ver [03](03-modulos-css.md) |
| `admin-snapshots.php` | criar/apagar os snapshots das páginas pesadas |

**Cuidado com o tamanho do replay.** O payload do metro levava todos os eventos
do período; com ~20 mil eventos o `json_encode()` rebentava o `memory_limit` de
128 MB e a página morria a meio — o `<script id="lrReplayData">` nunca era
escrito e o replay ficava em `0/0`. Hoje está limitado aos
`LR_REPLAY_MAX_EVENTS` (4000) mais recentes, com aviso na interface. **Se
acrescentares campos a cada evento do replay, verifica outra vez.**

Registar um produto novo nestes painéis são quatro alterações — ver
[05 · Produto novo](05-produto-novo.md).

---

## Snapshots

Três páginas são servidas de HTML congelado em `private/snapshots/`:

| página | ao vivo | do snapshot |
|---|---|---|
| `admin-funnel.php?period=30d` | 4,6 s | **0,016 s** |
| `admin-live-dashboard.php?view=teia` | 3,1 s | **0,013 s** |
| `admin-live-dashboard.php?view=metro` | 3,5 s | **0,020 s** |
| `modulos.php` | 0,58 s | **0,006 s** |

O motor é o `lib/snapshot.php`: `mp_snapshot_start()` no topo da página serve o
ficheiro e termina o pedido; `mp_snapshot_end()` no fim grava o que foi
produzido.

**Chamar o `mp_snapshot_start()` o mais cedo possível** — antes de qualquer
`mp_db()`. Abrir a ligação SQLite custa sozinha ~300 ms, porque verifica as
migrações. No `admin-funnel.php` isso obrigou a resolver o `$period` no topo do
ficheiro.

**Quando refazer:** sempre que a estrutura mudar — produto novo, passo novo,
classe CSS nova, linha de metro nova, evento de funil novo — e **antes de cada
deploy**, para o servidor arrancar com eles já construídos. Sem isso os painéis
continuam a mostrar a estrutura antiga, **sem dar erro nenhum**.

**Como:** `admin-snapshots.php` → "Criar todos os snapshots" (também acessível de
`tools/index.php`). O botão corre no browser, uma página de cada vez — a
primeira versão fazia o PHP chamar-se a si próprio por HTTP e encravava em
servidores de um só processo, como o `php -S` do desenvolvimento.

Ao dar snapshot a uma página nova, acrescentar o alvo a `mp_snapshot_alvos()`
em `lib/snapshot.php`. Atenção: as duas páginas de analytics têm **listas de
períodos diferentes** (o funil não tem `today` nem `yesterday`; o dashboard não
tem `all`). Pedir um período que a página não conhece cria uma linha que nunca
se preenche.

Qualquer página com snapshot aceita `?snapshot=off` (ver ao vivo uma vez) e
`?snapshot=refazer` (reconstruir). O banner no topo mostra a idade do snapshot.
**Um POST nunca é servido de snapshot nem grava um** — as acções do painel
continuam a correr sempre a sério.

O compromisso é deliberado: um snapshot de uma página de analytics mostra os
números de quando foi tirado. É indiferente para o `modulos.php` (depende só do
CSS) e é uma escolha consciente no funil.

---

## Avisos por email

`lib/avisos.php` avisa a Mia quando acontece algo que de outra forma só
apareceria no `error_log`. Vão para os endereços em `to` do ficheiro privado de
configuração — o mesmo que recebe as encomendas, e aceita vários separados por
vírgula ou ponto e vírgula.

| tipo | quando | janela de silêncio |
|---|---|---|
| `upload` | um cliente enviou ficheiros | 15 min por IP |
| `guardrail` | um travão entrou em acção | 1 h |
| `encomenda_falhou` | a encomenda não foi gravada | 5 min |
| `email_falhou` | o `mail()` da encomenda falhou | 5 min |
| `config` | falta configuração no servidor | 6 h |

A janela é por tipo **e** por chave: dois IPs diferentes a enviar ficheiros dão
dois avisos; o mesmo IP oito vezes dá um. As repetições suprimidas são contadas
e o aviso seguinte diz quantas foram.

O estado vive em `private/avisos-estado.json`, **não na base de dados** — para os
avisos continuarem a funcionar quando é a base de dados que está a falhar.

`mp_aviso($tipo, $chave, $assunto, $linhas)` nunca lança excepções e nunca
devolve erro ao chamador. Sem ficheiro de configuração, escreve no `error_log` e
segue. Um aviso que falha não pode estragar uma encomenda.

---

## Base de dados

SQLite em `private/miaandpaper.sqlite`, acedida **só** por `lib/db.php`.

O chatbot é deliberadamente separado: conversas, mensagens e configuração do
Míu vivem em `private/miu.sqlite`, acedido só por `lib/miu-bot.php`. Não juntar
as tabelas à base de encomendas. O painel é `bot.php`; ver [12 · Míu](12-miu.md).

Tabelas: `orders`, `order_events`, `order_code_reservations`, `email_log`,
`funnel_events`, `funnel_events_archive`, `form_submissions`,
`tracking_ignore_ips`, `ip_lookup_cache`, `admin_login_attempts`,
`assisted_uploads`, `colors`, `color_flows`, `schema_migrations`.

**Migrações:** array `$migrations` em `mp_db_migrate()`, com uma chave por
alteração. Correm sozinhas no primeiro acesso. **Só acrescentar ao fim — nunca
editar uma migração já aplicada.** `ALTER TABLE ADD COLUMN` duplicado é tolerado
de propósito, para recuperação parcial.

Todos os acessos usam *prepared statements*. Os nomes de coluna vêm de arrays
fixos no código, nunca de input.
