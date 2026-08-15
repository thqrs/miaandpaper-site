# Parâmetros de URL

Tudo o que muda o comportamento de uma página através da *query string*
(`?nome=valor&outro=valor`), e o registo de onde isso passou a viver.

Duas famílias, e a diferença importa:

- **Lidos pelo PHP** (`$_GET`) — decidem o que o servidor calcula, serve ou
  devolve. Estão todos declarados em [`site/lib/parametros.php`](../site/lib/parametros.php).
- **Lidos pelo JavaScript** (`URLSearchParams`) — a página é servida sempre
  igual; só o browser é que reage. Não protegem nada, e por isso nunca podem
  esconder informação.

---

## 1. Onde vive a verdade

`site/lib/parametros.php` é o **registo**: cada ficheiro .php declara o que
aceita — nome, tipo, valores possíveis, valor por omissão, o que acontece a um
valor inválido, e a linha onde o parâmetro é realmente lido. Desse registo sai
tudo o resto:

| saída | onde | para quem |
|---|---|---|
| barra de links no topo da página | `mp_parametros_barra()` | quem usa o site |
| inventário completo, com um link por valor | `tools/parametros.php` | quem usa o site |
| manifesto JSON, estilo MCP | `tools/parametros.php?formato=json` | máquinas |
| esquema de uma API | `<api>.php?action=parametros` | máquinas |
| etiquetas dos controlos das páginas | `mp_parametros_valores()` | o código |

Havia antes duas listas de períodos — uma no `admin-funnel.php`, outra no
`admin-live-dashboard.php` — e nenhuma delas sabia da outra. Agora as páginas
lêem as etiquetas do registo; se um valor mudar, muda num sítio só.

**Regra:** parâmetro novo entra no registo **e** é lido na página. Se os dois
divergirem, o registo está a mentir, e a coluna "lido em" de
`tools/parametros.php` é onde se apanha isso.

---

## 2. A barra de parâmetros

Aparece no topo de `admin-funnel.php`, `admin-live-dashboard.php`,
`admin-orders.php`, `modulos.php` e `tools/parametros.php`. Um link por valor
possível; caixa de texto ou de data para os que são livres.

Como se comporta:

- **O valor activo fica marcado.** Um valor fora da lista mostra-se como o
  valor por omissão, porque é isso que a página vai usar.
- **Valores por omissão saem do URL.** `?period=30d` no funil vira
  `admin-funnel.php` — um link curto é um link que se lê antes de clicar.
- **Acções não persistem.** `snapshot=refazer` vale para o pedido em que se
  clicou e não se cola aos links seguintes.
- **Parâmetros dependentes só aparecem quando fazem alguma coisa.** As datas do
  intervalo personalizado só surgem depois de `period=custom`; o `id` da
  encomenda só em `view=detail`. E os links do inventário levam a dependência
  atrás, para nunca haver um link que não faz nada.
- **A barra sai antes do snapshot**, de propósito: se fosse capturada, uma
  página congelada devolveria os links do pedido que a gravou.

Foi por causa disto que o `Content-Type` do funil e do dashboard subiu para
antes da primeira saída — depois da barra, nenhum `header()` pega.

O que a barra destapou, e que antes não tinha onde se clicar: o intervalo
personalizado do dashboard (`period=custom` aparecia na lista mas as datas não
tinham controlo nenhum), o `enrich` do funil e o `snapshot=refazer` de todas as
páginas que o suportam.

---

## 3. O manifesto, estilo MCP

`tools/parametros.php?formato=json` devolve o registo inteiro na forma de um
`tools/list` do Model Context Protocol: uma lista de recursos, cada um com
nome, descrição e `esquemaEntrada` em JSON Schema. Serve para conduzir o site
por URL — um agente, um GPT, um script — sem abrir um único .php.

Filtra-se com os mesmos parâmetros da página: `&tipo=api`,
`&recurso=admin-funnel.php`.

### Envelope

| campo | o que é |
|---|---|
| `versao` | versão do formato do manifesto (`MP_PARAMETROS_VERSAO`) |
| `gerado` | instante da geração, ISO-8601 UTC |
| `origem` | ficheiro que é a fonte da verdade |
| `documento` | este documento |
| `recursos` | lista de recursos |

### Recurso

| campo | o que é |
|---|---|
| `nome` | caminho a partir de `site/`, ex.: `admin-orders.php` |
| `titulo` | nome legível |
| `descricao` | o que o recurso faz |
| `tipo` | `pagina`, `api`, `ficheiro`, `ferramenta` |
| `guarda` | `admin`, `publico`, `token`, `condicional` |
| `metodos` | métodos HTTP aceites |
| `lado` | `servidor` (lê `$_GET`) ou `cliente` (lê no browser) |
| `documento` | documento próprio, quando existe |
| `esquemaEntrada` | JSON Schema dos parâmetros |
| `exemplo` | um URL válido |

### Parâmetro (`esquemaEntrada.properties.<nome>`)

Campos de JSON Schema: `type`, `enum`, `default`, `minimum`, `maxLength`,
`pattern`, `format`, `description`, `examples`.

Extensões nossas, com prefixo `x-` para não colidirem:

| campo | o que é |
|---|---|
| `enumDescriptions` | etiqueta de cada valor do `enum`, pela mesma ordem |
| `x-tipo` | `enum`, `accao`, `flag`, `inteiro`, `texto`, `data`, `opaco` |
| `x-invalido` | `omissao` (cai no valor por omissão) ou `erro` (4xx) |
| `x-depende` | parâmetros que têm de vir juntos, ex.: `{"view":"detail"}` |
| `x-repetivel` | o parâmetro pode aparecer várias vezes no mesmo URL |
| `x-lido` | ficheiro e linha onde a página lê mesmo o parâmetro |

`x-lido` é o que impede o manifesto de virar ficção: aponta para a linha que se
tem de ler para confirmar que a declaração ainda é verdade.

### Descoberta por API

Cada API responde ao seu próprio esquema em `?action=parametros`, com o mesmo
formato de recurso:

```bash
curl -s "https://miaandpaper.pt/precos-api.php?action=parametros"
```

Todas exigem sessão de admin — a lista de acções descreve a estrutura interna,
e `admin-api.php?action=parametros` exige-a mesmo sendo `action=status`
público.

---

## 4. Transversal — snapshot

`lib/snapshot.php:173` intercepta qualquer página que chame
`mp_snapshot_start()`, **antes** de tocar na base de dados.

| valor | efeito |
|---|---|
| (ausente) | serve o HTML congelado se existir; senão calcula e grava |
| `off` | ignora o snapshot neste carregamento e **não** regrava |
| `refazer` | recalcula tudo e regrava o ficheiro |

Páginas afectadas: `modulos.php`, `admin-funnel.php`, `admin-live-dashboard.php`.

A chave do snapshot inclui os parâmetros que mudam o resultado
(`lib/snapshot.php:65`), por isso `?period=7d` e `?period=90d` guardam
ficheiros diferentes. Só se aplica a `GET`: um `POST` nunca é servido de
snapshot nem grava um.

Atenção às duas listas de períodos, que **não** são iguais: o funil não conhece
`today` nem `yesterday` (cai em `30d`); o dashboard não conhece `all` (cai em
`today`). Pedir um período que a página não conhece grava o snapshot com a
chave do período já validado, não com o que foi pedido.

---

## 5. Inventário

A lista completa, com todos os valores e um link para experimentar cada um,
está em `tools/parametros.php`. Aqui fica só o índice — o que existe e onde:

| ficheiro | tipo | guarda | parâmetros |
|---|---|---|---|
| `admin-funnel.php` | página | admin | `period`, `enrich`, `snapshot` |
| `admin-live-dashboard.php` | página | admin | `period`, `view`, `start`, `end`, `sid`, `snapshot` |
| `admin-orders.php` | página | admin | `view`, `id`, `f`, `p`, `q`, `page`, `saved`, `paid`, `shipped`, `cancelled`, `created`, `email` |
| `bot.php` | página | admin | `id`, `page`, `notice` |
| `modulos.php` | página | público | `snapshot` |
| `tools/parametros.php` | página | admin | `formato`, `tipo`, `recurso`, `vazios` |
| `tools/gerador-cartoes.php` | ferramenta | admin | 24 parâmetros, lidos no browser — ver [`README-url-cartoes.md`](../site/tools/README-url-cartoes.md) |
| `admin-api.php` | API | depende da acção | `action` |
| `precos-api.php` | API | admin | `action`, `ate` |
| `galeria-api.php` | API | admin | `action`, `entry` |
| `produtos-api.php` | API | admin | `action` |
| `carrousel-api.php` | API | admin | `action` |
| `materiais-api.php` | API | admin | `action` |
| `homepage-menu-api.php` | API | admin | `action` |
| `reviews-api.php` | API | depende da acção | `action` |
| `admin-order-file.php` | ficheiro | admin | `order_id`, `file`, `inline` |
| `admin-assisted-file.php` | ficheiro | admin | `upload_id`, `file` |
| `order-media-preview.php` | ficheiro | token no URL | `token` |
| `list-carousel-images.php` | API | público | `set` |
| `send-order.php` | API | público | `checkout_debug` |

Registados sem parâmetro nenhum, para o inventário ficar completo e ninguém
ficar sem saber se foram esquecidos: `precos.php`, `materiais.php`,
`carrousel.php`, `homepage-menu-design.php`, `admin-uploads.php`,
`admin-snapshots.php`, `tools/index.php`, `tools/nomes.php`,
`send-message.php`, `upload-order-photo.php`, `track-order-event.php`,
`check-open-orders.php`, `help-upload.php`, `bot-api.php`.

Os endpoints que servem ficheiros validam o formato do parâmetro antes de ir ao
disco e nenhum aceita caminhos: `admin-order-file.php` exige que o anexo conste
do JSON da encomenda e que o caminho bata certo com
`order-uploads/orders/<código>/…`; `order-media-preview.php` exige que o MIME
guardado bata certo com a extensão.

---

## 6. Páginas estáticas — parâmetros lidos no browser

Não passam pelo PHP e por isso não estão no registo, mas mudam o que se vê.

### `galeria.html` (`:312`–`:322`)

| parâmetro | efeito |
|---|---|
| `embed=1` | modo encaixado num iframe, sem cabeçalho |
| `entry` | abre um produto/contexto específico |
| `step` | foca um passo do produto |
| `section` | foca uma secção |
| `section-prefix` | foca todas as secções com este prefixo |
| `slot` | foca um slot de imagem |
| `item` | lista separada por vírgulas de itens a focar |
| `summary=1` | vista de resumo |
| `pending=1` | mostra só o que falta |

O link "ver galeria completa" reconstrói o URL sem `embed` (`:1590`). Estes
URLs são gerados pela teia de produtos em `produtos-admin.js:3056`.

### `produtos.html` (`produtos-admin.js:13`)

| parâmetro | efeito |
|---|---|
| `view=graph` | abre na teia em vez da base de dados (`:39`) |
| `visitors=1` | modo visitantes, usado pelo iframe do dashboard (`:14`) |

`admin-nav.js:25` esconde a navegação de admin quando `visitors=1` ou
`embed=1`, em qualquer página onde esteja carregado.

### Fluxo de compra (`site/js/`)

| parâmetro | onde | efeito |
|---|---|---|
| `mode=edit` + `cartItem=<id>` | `07-carrinho.js:1164` | reabre o wizard já preenchido com uma linha do carrinho |
| `returnTo` | `07-carrinho.js:1186` | para onde voltar depois de editar (valor validado) |
| `de=<slug>` | `14-upload-quantidade.js:581` | de que produto veio a personalização |
| `step=1` \| `2` | `21-checkout.js:247` | passo do checkout |
| `produto=<nome>` | `22-admin-imagem.js:819` | em `contacto.html`, pré-preenche assunto e mensagem (máx. 60 car.) |

### Diagnóstico

| parâmetro | onde | efeito |
|---|---|---|
| `cartDebug` | `07-carrinho.js:594` | expõe `window.MiaCartDebug` |
| `debug=builder` ou `debugstep3` (+ `images`, `step`) | `14-upload-quantidade.js:1083` | preenche o builder com uploads falsos |
| `eggdebug=1` | `reviews-egg.js:436` | caixa com o estado do sensor de inclinação |

### Pré-visualizações

| página | parâmetros |
|---|---|
| `modulos-preview.html` | `theme=dark` (`:17`); `product`, `step`, `kind`, `theme` (`:118`) |
| `galeria-preview.html` | `context=congresso-2026` (senão `principal`) — escolhe a folha de estilos (`:13`) |

### Atribuição de tráfego

`js/04-funil-tracking.js:152`, `catalogo/catalogo-tracking.js:101` e
`ofertas/ofertas-tracking.js:98` guardam, no primeiro carregamento da sessão:
`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`,
`fbclid`, `gclid` — cada um cortado aos 120 caracteres. Não mudam nada na
página; ficam no evento de funil.

### Redireccionamentos que preservam a query string

`caderninhos.html`, `cadernos.html`, `catalogo.html`, `quadros.html` e os
`index.html` de `catalogo/*` fazem `location.replace()` a acrescentar
`location.search` e o hash. Um `?utm_source=` sobrevive ao salto.

---

## 7. Comandos administrativos

`site/comando.php` usa a mesma infraestrutura de administração, mas recebe uma
operação declarativa no URL. O inventário normal de parâmetros continua neste
documento e em `tools/parametros.php?formato=json`; nesse JSON, a chave
`comandos` é o manifesto das operações disponíveis, gerado directamente de
`lib/comandos.php`.

Por omissão o URL só mostra antes, alteração e depois. A aplicação é um POST
com CSRF. Há batches `c[0][...]`, `c[1][...]` e um `override=true` para o caso
consciente de aplicar directamente, sempre dentro da sessão de administração.

Ver [README dos comandos](../site/tools/README-comandos.md) para o vocabulário,
URL encoding, exemplos e limites transaccionais.

## 8. Cápsula `congressos/2026`

Independente e **nunca editada** (ver [01 · Arquitectura](01-arquitectura.md)).
`app-congressos.js` repete os mesmos parâmetros do site principal:
`mode`/`cartItem`/`returnTo` (`:3459`), `step` no checkout (`:15575`),
`produto` no contacto (`:17009`), `cartDebug` (`:2948`) e os `utm_*`/`fbclid`/
`gclid` (`:1314`).

---

## 9. O que não é parâmetro de comportamento

`?v=2026080501` nos `<link>` e `<script>` é só invalidação de cache. Não é
lido por ninguém — muda o URL para o browser não reaproveitar o ficheiro
antigo. Ao alterar CSS ou JS, sobe-se o número; ver
[08 · Deploy e ambiente](08-deploy-e-ambiente.md).
