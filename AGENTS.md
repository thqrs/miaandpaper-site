# AGENTS.md — Mia & Paper

As regras. **Ler antes de mexer em seja o que for.** O *como funciona* está em
[`docs/`](docs/README.md); aqui só está o que não se faz e o que nunca se
esquece.

---

## Língua e tom

Português de Portugal, simples e directo.

Caloroso sem ser adocicado; artesanal e pessoal. Nada de marketing genérico,
frases repetidas de IA, emojis a mais, nem clichés como "feito com carinho e
atenção ao detalhe".

## Restrições técnicas

Site estático em alojamento partilhado cPanel, mais PHP simples e SQLite no
servidor. Usar HTML, CSS, JavaScript vanilla e PHP sem dependências.

**Não introduzir** sem pedido explícito: sistemas de build em Node, React, Vite,
Next.js, npm ou qualquer framework. O deploy tem de continuar a ser copiar
ficheiros.

Manter o site leve e *mobile-first*, e as imagens optimizadas — **WebP, sempre**.

Não pôr segredos, passwords, chaves de API ou dados de clientes no repositório.

---

## As cinco regras que custam dinheiro ou trabalho

### 1 · A cápsula do Congresso 2026 nunca se edita

`site/congressos/2026/` é um snapshot congelado do que foi vendido em 2026, com
cópias próprias dos JSON de produto, do `pricing.json` e das cascas HTML.

**Nunca editar nada lá dentro.** Nem para "manter sincronizado", nem para
corrigir um bug que se viu de passagem, nem para aplicar um refactor global. Se
parece errado, está errado *de propósito*. É referência de leitura para as
escadas de preços antigas.

### 2 · Gatilhos por dados, não por slug

Os módulos de `site/js/` são partilhados entre o catálogo e a cápsula. Uma
alteração de comportamento **nunca** deve ser condicionada por uma lista de slugs
no código — deve ser uma flag no JSON do produto que a quer (como
`"adjustPerDesign": true`).

Depois de mexer em `site/js/`, verificar **um produto do catálogo e um da
cápsula**.

### 3 · Preços editam-se no `precos.php`, não à mão

Há um editor central em `site/precos.php` com **todos** os valores monetários do
site — e não só os valores: quantidades e número de packs, descontos, extras,
portes, custos e o modo de preço. Usa-o. O menu e a homepage editam-se em
`site/homepage-menu-design.php` ([10 · Editores](docs/10-editores-admin.md)). Ele recusa gravar uma configuração
que o checkout viria a rejeitar, e tem um botão que corre o cross-check JS ↔ PHP.

Acrescentar ou remover um pack tem de acontecer em **dois** sítios (a tabela do
`pricing.json` e os botões do passo `pack` do produto), e mudar o modo em
**três** (juntando o topo do JSON do produto). O editor trata dos dois e dos
três; à mão, esquecer um deles parte o produto em silêncio.

Se mesmo assim editares à mão: um preço muda em `content/products/<slug>.json`
**e** em `content/pricing.json`. Se o modo ou o `allowUnitDiscounts` divergirem,
o checkout recusa a encomenda **em silêncio para o cliente**.

Cada modo de preço está implementado duas vezes — em `js/10-produto-precos.js`
para o cliente ver, em `lib/precos-core.php` para o servidor cobrar. **Se mexeres
numa, corre o cross-check antes de publicar** (`precos.php` → "Verificar todos os
preços"): as duas implementações sobre todas as tabelas e todas as quantidades de
1 a 500, comparadas cêntimo a cêntimo. Zero divergências.

As funções de `lib/precos-core.php` são partilhadas pelo `send-order.php` e pelo
`precos-api.php`. **Não as redefinas noutro ficheiro** — existir uma terceira
cópia é o problema que a biblioteca resolve.

Detalhes, modos e armadilhas: [04 · Preços](docs/04-precos.md).

### 4 · O deploy nunca apaga

O deploy é o `[2]upload-or-download.bat` — `git pull` no servidor seguido de
`cp -R site/. LIVE_PATH/`. **Não existe `.cpanel.yml`**, nunca existiu.

**O commit é a unidade de publicação**: o que não está commitado e enviado não é
publicado. E `cp -R` nunca remove, por isso apagar é um trabalho de dois passos —
no repositório *e* no servidor. Foi assim que 131 MB de PDFs duplicados
sobreviveram meses depois de deixarem de ser referenciados.

O mesmo script também sincroniza servidor → PC, sobrescrevendo o `site/` local.
Confirmar a direcção antes de correr.

Não mudar o caminho de destino sem o Tiago pedir.

### 5 · Coisas que ficam velhas em silêncio

Nenhuma destas dá erro quando se esquece:

| depois de… | quem trata |
|---|---|
| mudar `site/js/` ou `site/css/` | o `?v=` — **automático** no deploy (passo 1/5) |
| **criar** um ficheiro em `site/js/` ou `site/css/` | **tu**: acrescentar a tag em todas as cascas |
| mudar qualquer conteúdo | `node site/tools/seo-build.js` — automático no deploy (passo 2/5) |
| mudar a estrutura (produto, passo, classe, evento) | **tu**: `admin-snapshots.php` → Criar todos os snapshots |

O `?v=` é regenerado pelo `tools/update-cache-version.ps1`, que o
`[2]upload-or-download.bat` corre antes do commit — mas **só reescreve tags que
já existam**. Um módulo novo continua a ter de ser declarado à mão em todas as
cascas; ver [02 · Módulos JS](docs/02-modulos-js.md).

Sem os snapshots, os painéis continuam a mostrar a estrutura antiga.

---

## Antes de criar uma categoria de produto

A checklist tem **15 pontos em 6 frentes** — conteúdo, servidor, código do site,
painéis, SEO e cache. Está toda em [05 · Produto novo](docs/05-produto-novo.md).

Fazer tudo na **mesma alteração**. Deixar a integração da galeria ou dos painéis
para depois é como se perde um produto em silêncio: os seus eventos caem na
estação genérica do funil e ele desaparece dos relatórios sem dar erro. Já
aconteceu três vezes.

Em particular: o slug do JSON tem de bater certo com o `data-product` da página,
e **não** se cria um registo manual de imagens — a descoberta da galeria é
genérica.

## Antes de mexer em imagens

Os ajustes de enquadramento vivem em `item.imageEdits[editKey]`, que ganha às
propriedades planas `imageZoom`/`imagePositionX`/… do item. **Nunca calcular
esses defaults por fora** — ler o que o site aplica. Ver
[06 · Imagens](docs/06-imagens.md).

## Antes de publicar

Há uma checklist de pré-deploy em
[08 · Deploy e ambiente](docs/08-deploy-e-ambiente.md). O ponto crítico:
`galeria-api.php` e `reviews-api.php` são **endpoints de escrita abertos ao
público** neste momento, por decisão consciente. Têm de fechar antes do site ir
para o ar.

---

## Como verificar trabalho

```bash
# sintaxe
for f in site/*.php site/lib/*.php; do php -l "$f"; done
for f in site/js/*.js; do node --check "$f"; done

# todos os JSON de conteúdo
python -c "import json,glob; [json.load(open(p,encoding='utf-8')) for p in glob.glob('site/content/**/*.json',recursive=True)]"

# todas as páginas respondem
for f in site/*.html; do curl -s -o /dev/null -w "%{http_code} $f\n" "http://127.0.0.1:8082/$(basename $f)"; done
```

E, para qualquer coisa que se veja no browser: **abrir a página, deixar o JS
correr, e ler o DOM**. Procurar texto nos ficheiros HTML quase nunca dá
resultado — o conteúdo está nos JSON e a marcação está em `site/js/`.

Ao fazer `grep` no repositório, excluir `tools/gerador-cartoes.php`: são 5,1 MB
de JavaScript minificado dentro de um PHP e inundam qualquer pesquisa.

## Estilo visual

Tons de papel natural, verdes e amarelos suaves, layout limpo, espaço branco a
sério. Não parecer um template corporativo genérico.

As cores vêm todas de tokens em `css/01-tokens-agua.css`, alimentados pelo
`content/home.json` — **não escrever hexadecimais no meio das regras**. Há uma
segunda camada (`--ui-*`) que ganha à paleta em alguns componentes; ver
[03 · Módulos CSS](docs/03-modulos-css.md) antes de mexer em cores.
