# 09 · Pendentes

O que continua por fazer ou por decidir. **Verificado contra o código a
2026-08-06** — os itens dos relatórios antigos que já foram resolvidos não
aparecem aqui.

Os relatórios completos, com os números e o método, estão em
[`historico/`](historico/).

---

## Bloqueiam o deploy

### Endpoints de escrita abertos ao público

```php
site/admin-open.php:18    define('MIA_ADMIN_OPEN', true);
site/galeria-api.php:10   define('GALERIA_REQUIRE_ADMIN', false);
site/precos-api.php:23    define('PRECOS_REQUIRE_ADMIN', false);
site/produtos-api.php:5   define('PRODUTOS_REQUIRE_ADMIN', false);
site/reviews-api.php:6    define('REVIEWS_REQUIRE_ADMIN', false);
```

Não é "a página de admin está visível" — o `galeria-api.php`, o `precos-api.php`
e o `reviews-api.php` **escrevem ficheiros**. Qualquer pessoa na Internet pode
reescrever `content/products/*.json` (incluindo preços e a cápsula do congresso)
e enviar imagens. O `save` exige a revisão SHA-256 do conteúdo actual, mas
obtém-se pedindo `?action=data`, que também está aberto.

O `precos-api.php` é o mais sensível dos três: pôr um preço a zero é pior do que
trocar uma imagem. Foi aberto por decisão explícita, para ter os mesmos termos
da galeria até ao deploy.

É dívida assumida enquanto as fotos reais estão a ser carregadas. O CSRF e o
`session_start()` já estão implementados nos quatro ficheiros — só estão a ser
saltados. O `produtos-api.php` é só de leitura de dados já públicos.

**Não há caminho para execução de código:** os uploads validam com
`getimagesize()`, exigem que a extensão corresponda ao MIME real e convertem
tudo para WebP. O risco é integridade de conteúdo e preços.

Checklist completa em [08 · Deploy](08-deploy-e-ambiente.md).

### Compressão e cabeçalhos de cache

O `.htaccess` não configura `mod_deflate` nem `mod_expires`. São ~1,3 MB de JS e
CSS não minificados em cada visita nova, contra os ~250 KB que o gzip daria. É
possível que o cPanel tenha o "Optimize Website" ligado globalmente — confirmar
no servidor:

```bash
curl -sI -H "Accept-Encoding: gzip" https://miaandpaper.com/js/01-nucleo.js | grep -i content-encoding
```

Se faltar, são ~15 linhas no `.htaccess`, sem tocar em código.

---

## Decisões de negócio

### Cinco categorias à venda sem uma única fotografia

| categoria | designs | com imagem | cartão na homepage |
|---|---|---|---|
| Stickers | 6 | **0** | sem arte |
| Marcadores | 6 | **0** | sem arte |
| Marcadores magnéticos | 6 | **0** | sem arte |
| Ímanes recortados | 6 | **0** | sem arte |
| Bloquinhos | 6 | **0** | sem arte |
| Agendas | 16 | **1** | sem arte |

Todas estão `available: true` e clicáveis. Um cliente que entre em
`stickers.html` vê "Sticker 01 … Sticker 06" em caixas vazias e não tem como
saber o que está a comprar.

Três caminhos:

1. **Tirar do ar até haver fotos** — `available: false` no `home.json`. Uma linha
   por categoria, resolve hoje.
2. **Deixar só o caminho da personalização** — remover o passo de designs e
   encaminhar para `personalizacao.html`. Faz sentido para stickers e
   marcadores.
3. **Fotografar e carregar pela `galeria.html`** — os slots já estão criados e
   identificados; é só substituir as imagens.

### Modo escuro: ligar, seguir o sistema, ou apagar

- **202 blocos** `[data-theme="dark"]` em `css/08-dark-mode.css`.
- **Zero** utilizações de `prefers-color-scheme`.
- `showThemeToggle: false` nos quatro ficheiros de configuração (`home.json`,
  `congressos.json`, `order-products.json` e o do congresso).

O tema escuro está desenhado, mas o botão que o liga está escondido e o site
nunca segue a preferência do sistema. Quem tem o telemóvel em modo escuro recebe
o site claro. Na prática são 429 linhas de CSS que ninguém executa — só se lá
chega a mexer no `localStorage`.

1. **Ligar o botão** (`showThemeToggle: true`) — uma linha, e o trabalho feito
   passa a servir para alguma coisa.
2. **Seguir o sistema** — `@media (prefers-color-scheme: dark)` a aplicar o mesmo
   que `[data-theme="dark"]`, mantendo o botão como sobreposição manual.
3. **Assumir que não há modo escuro** e apagar o módulo, ganhando ~40 KB.

O que não faz sentido é ficar como está.

### `--ui-*` não deriva da paleta da marca

Mudar a paleta no painel não muda o fundo dos cartões, das opções de pack nem
das caixas de escolha — parece que a alteração "não pegou". A explicação está em
[03 · Módulos CSS](03-modulos-css.md).

A solução é fazer os `--ui-*` derivarem da paleta (`--ui-card: var(--card)`) nos
casos em que a diferença é acidental, e comentar os casos em que é intencional.
Precisa de comparação antes/depois com cuidado: a camada foi criada exactamente
para corrigir variações de amarelo.

### Duplicação entre catálogo e cápsula

Crachás, ímanes, cadernos e mini-cadernos existem em duas cópias quase idênticas
(principal e Congresso 2026), que já divergiram sozinhas. Três caminhos —
manter, fundir só na vista da Teia, ou uma fonte única com variações por
contexto. O levantamento com os factos está em
[histórico/2026-07-28-duplicacao-contextos](historico/2026-07-28-duplicacao-contextos.md).

### O deploy nunca apaga

`cp -R` copia e substitui mas não remove: tudo o que alguma vez foi publicado
continua vivo no servidor. Passar para `rsync --delete` é o correcto, mas é
destrutivo num servidor que hoje tem ficheiros que não estão no repositório
(uploads da galeria, `content/uploads/`, backups). Feito às cegas, apaga uploads
de clientes. Antes de trocar é preciso inventariar o que existe só no servidor.

---

## Trabalho mecânico

### Valores monetários ainda duplicados entre ficheiros

Porque é que o mesmo preço aparecia em vários sítios: cada **percurso de venda**
declarava as suas próprias opções. A loja lê os `steps` do produto, a
personalização lê o catálogo do `personalizacao.json`, e o servidor cobra pelo
`finishOptions` do produto de destino. Não havia a noção de «esta opção custa
isto» — só «neste ecrã mostra-se isto», repetida uma vez por ecrã. O acabamento
holográfico chegou a estar escrito em **dez** ficheiros.

Já está resolvido para as três famílias grandes:

| valor | fonte única | desde |
|---|---|---|
| Tabelas de preços | `products` do `pricing.json` | — |
| Portes | bloco `delivery` do `pricing.json` | 2026-08-06 |
| Acabamentos e extras por unidade | bloco `optionExtras` do `pricing.json` | 2026-08-07 |

O `optionExtras` é indexado pelo `value` da opção (ou pelo `id`, quando é um
passo inteiro como a personalização da capa). Quem o aplica: `applyCentralOptionExtras()`
em `js/10-produto-precos.js` e `apply_central_option_extras()` no `send-order.php`
— os dois têm de andar a par. O JSON do produto continua a dar a estrutura e
serve de recurso quando o central não conhece a chave, e o `precos.php` replica
qualquer edição pelo central **e** por todas as cópias, para nenhuma ficar a
mostrar um número que já não é o cobrado.

**O que falta:** a taxa de artwork, com o `300` escrito à mão em
`MAIN_V2_ARTWORK_FEE_CENTS` (`send-order.php:15`) e nada a validar que coincide
com o `pricing.json`. Fazer o PHP lê-lo do `pricing.json` fecha a última
divergência sem tocar em cálculo nenhum.

Cuidado com um caso que **não** é só um número errado no ecrã: um acabamento que
exista no `personalizacao.json` mas **não** no `finishOptions` do produto de
destino faz o `send-order.php` **recusar a encomenda inteira** com «Um dos
acabamentos escolhidos não é válido». Foi o que aconteceu com a capa dura das
agendas e dos cadernos até 2026-08-07. O `optionExtras` alinha os valores, mas
não cria a entrada em falta — vale a pena um teste que percorra os `finishes` da
personalização e confirme que cada valor existe no destino.

### Lixo que vai para produção

| item | peso |
|---|---|
| `site/catalogo/` (inclui um `.docx` de 7,6 MB) | 17 MB |
| `site/media_tiago/` | 2,1 MB |
| `site/mockups/` | 232 KB |
| `site/content/products-legacy/` | 224 KB |
| `site/local-test-data/` | 4 KB |
| `site/log_css_mods.txt`, `biscoito.txt`, `reviews.txt` | — |

Nenhum é servido a clientes. O `catalogo/` são páginas antigas substituídas pelo
catálogo actual. Decidir o que é histórico (fica no repositório, sai do deploy) e
o que é lixo (apaga-se). Um `.deployignore` respeitado pelo script resolve o
primeiro caso — mas ver "o deploy nunca apaga" acima.

### `tools/gerador-cartoes.php` tem 5,1 MB

Um único PHP com um bundle JavaScript inteiro embutido. É impossível de rever ou
de diferenciar em git, e obriga a excluí-lo de qualquer `grep`. Extrair o JS para
`tools/assets/` e referenciá-lo com `<script src>`.

### `order-media-preview.php` recalcula o SHA-256 a cada pedido

`hash_file('sha256', $filePath)` num PDF de 30 MB é lido por completo em **cada**
pedido, incluindo cada pedido parcial com `Range` — um leitor de PDF que peça o
ficheiro em 20 pedaços faz 20 hashes completos. Verificar o hash só quando não há
cabeçalho `Range`: o objectivo é detectar corrupção do ficheiro guardado, não
autenticar cada pedido.

### CSS: breakpoints, `!important` e selectores repetidos

Três frentes, todas volumosas, nenhuma urgente — números e amostras em
[03 · Módulos CSS](03-modulos-css.md):

- **18 breakpoints** sem escala, com pares acidentais (700/701, 620/640,
  420/430, 384/390). Fixar 4 ou 5 valores e migrar em lotes. Não é mecânico: há
  regras onde o valor exacto foi escolhido pelo conteúdo.
- **96 `!important` em `product-*`**, a zona das imagens dos cards de design.
  Isolar a grelha num bloco com especificidade própria e retirá-los de dentro
  para fora, um produto de cada vez. **Alto risco de regressão visual** —
  precisa de comparação lado a lado.
- **141 selectores definidos 3+ vezes.** Juntar as definições que estejam fora de
  media queries. Mecânico e verificável, mas volumoso.

### Mojibake nos comentários

Sequências de UTF-8 lido como Latin-1 (`aÃ§Ãµes`, `ecrÃ£`) espalhadas pelos
comentários dos módulos CSS. O único caso que era CSS a sério já foi corrigido.
Corrigir quando se tocar em cada zona — mexer neles isoladamente é ruído puro
num diff.

### `.git` com 169 MB

Os binários grandes já entraram no histórico. Não impede nada, mas encarece
clones. Só se resolve com reescrita de histórico, que com o deploy a fazer
`git pull` no servidor precisa de ser coordenada.

---

## Uniformização do design

O relatório de 2026-07-19 propunha alinhar o site com a linguagem da homepage.
Parte foi feita na modularização; o que continua por decidir está listado na
secção 5 de
[histórico/2026-07-19-uniformizacao-design](historico/2026-07-19-uniformizacao-design.md).
Em resumo:

1. Fundo interior liso creme (como a homepage) ou quadriculado em todo o lado?
2. Raio de canto único de 8px, ou 6px como excepção formal nos cartões
   editoriais?
3. Header sticky em todas as páginas?
4. Renderizar o `intro` dos produtos como cabeçalho de página (resolve o `h1` em
   falta), ou apagar os `intro` dos JSON por serem conteúdo morto?
5. Título do passo 1: pergunta ("Que tipo de…?") ou imperativo ("Escolhe…")?
6. Padrão do `<title>`: "X | Mia & Paper" ou "Mia & Paper | X"?
7. Bolhas de avaliações só na homepage, ou também nas páginas de produto?
8. `ofertas/`: migrar para o design do site ou manter o do catálogo?

O `styleguide.html` está desactualizado — não tem nada do `BRAND_HOME_V1`.
Actualizá-lo depois das decisões, porque é a ferramenta que evita nova deriva.
