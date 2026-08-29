# 12 · Míu — chatbot

O Míu é o assistente virtual no canto inferior direito das páginas públicas.
É JavaScript, CSS e PHP sem dependências, e funciona com OpenRouter ou Gemini.

## Ficheiros

| ficheiro | responsabilidade |
|---|---|
| `site/js/24-miu.js` | interface, contexto do passo, streaming, filtros locais e links seguros |
| `site/css/13-miu.css` | sprite do gato, painel, mensagens e mobile |
| `site/content/brand/miu/` | folhas WebP normal/pequena, frames e manifestos do gato |
| `tools/process-miu-sprite.py` | recorta e optimiza as duas folhas fonte 4×2 |
| `tools/build-miu-quick-replies.js` | recria um catálogo inicial exacto a partir dos JSON de produto |
| `tools/export-sprites-miu.ps1` | empacota todos os assets e código de sprites num ZIP completo |
| `site/bot-api.php` | endpoint público, CSRF, limites, contexto e resposta NDJSON |
| `site/lib/miu-bot.php` | filtros, prompt, chamadas aos fornecedores e SQLite para runtime |
| `site/lib/miu-context.php` | valida produto/passo, objectivos, perguntas e preços actuais |
| `site/lib/miu-stream.php` | liga ao streaming SSE dos fornecedores e recolhe o modelo usado |
| `site/content/miu-defaults.json` | configuração global persistente e activa do Míu (fonte única) |
| `site/content/miu-quick-replies.json` | perguntas e respostas locais por produto e passo, editáveis em massa |
| `site/content/erros.json` | versões Default/Míu das mensagens públicas de validação e ajuda |
| `site/lib/miu-animations.php` | biblioteca de spritesheets, gatilhos, âmbito por produto e aparência do Míu |
| `site/bot.php` | conversas, configuração, aparência e animações |
| `site/sprites.php` | editor visual frame a frame das expressões faciais |
| `site/erros.php` | editor das mensagens públicas Default/Míu |
| `site/bot-admin.css` / `.js` | interface própria do painel |
| `site/miu-animation-lab.php` | laboratório experimental 8×8 multi-sheet e auto-centragem com in-betweens fluídos |
| `site/miu-animation-lab.js` | leitor e comparador das sequências multi-sheet |
| `site/miu-animation-lab.css` | estilos do laboratório experimental |
| `site/miu-rig.php` | laboratório isolado V5: idle vivo, atenção durante a interacção e reacções ao gesto agregado |
| `site/miu-rig.js` | Animation Director, leitor multi-sheet, reacções, recuperação e FX anime compostos |
| `site/miu-sprite-grid.js` | extracção reutilizável de sprites por componentes conectados e âncoras anatómicas |
| `site/miu-rig-v3.php` | arquivo da experiência V3 de frames reais com movimento secundário de mesh |
| `private/miu.sqlite` | conversas, mensagens e contextos de passo (runtime) |
| `private/miu-config.php` | chaves; nunca fica na raiz pública nem no Git |
| `miu-old/` | arquivo externo com o protótipo do Míu modular descontinuado |

O catálogo, as ofertas e `congressos/2026` carregam os mesmos módulos 13/24.
Não existe uma segunda implementação do chatbot. Em previews e iframes o
módulo detecta o contexto e não desenha nada.

O círculo do lançador, a miniatura no cabeçalho e os retratos das mensagens usam
exclusivamente a **cara do Míu**. `miu-sprite.webp` é a folha normal,
`miu-sprite-small.webp` é a versão reforçada para retratos pequenos e
`miu-sprite-sleep.webp` é usada após a inactividade. As spritesheets de corpo
inteiro guardadas em `content/brand/miu/sprites/` formam uma biblioteca
separada para outros contextos interactivos e nunca substituem a cara dentro
do chat.

**Regra dos assets novos:** sprites e spritesheets do Míu são guardados em PNG
e nunca convertidos para WebP. A excepção existe porque a transparência alpha e
as ilhas de píxeis separadas são parte do contrato do algoritmo de componentes
conectados. Os WebP históricos do Míu mantêm-se como estão; a regra aplica-se a
assets novos e não manda reconverter nem substituir os que já estão em produção.

Para voltar a gerar as três folhas da cara sem alterar os nomes nem a ordem das poses:

```bash
python tools/process-miu-sprite.py tools/assets/miu-sprite-source.webp \
  --small-input tools/assets/miu-sprite-small-source.webp \
  --sleep-input tools/assets/miu-sprite-sleep-source.webp
```

## Instalar as chaves

Copiar [`exemplos/miu-config.php.example`](exemplos/miu-config.php.example)
para `private/miu-config.php` no servidor. Em local, copiar para
`private-local/miu-config.php`. Preencher uma ou as duas chaves:

```php
<?php
return array(
    'openrouter_api_key' => '...',
    'gemini_api_key' => '...',
);
```

Em alternativa, usar `MIA_OPENROUTER_API_KEY` e `MIA_GEMINI_API_KEY`. As
variáveis de ambiente ganham ao ficheiro. O painel mostra apenas “chave pronta”
ou “sem chave”; nunca devolve nem grava a chave.

No OpenRouter, o modelo inicial é `openrouter/free`, o router gratuito oficial.
No Gemini, o nome do modelo é configurável no painel. Ambas as chamadas usam
REST directo, sem SDK: OpenRouter em `/api/v1/chat/completions` e Gemini em
`v1beta/models/<modelo>:streamGenerateContent?alt=sse`. Referências oficiais:
[Free Models Router do OpenRouter](https://openrouter.ai/docs/guides/routing/routers/free-router)
e [generateContent do Gemini](https://ai.google.dev/gemini-api/docs/generate-content/text-generation).

## Configuração e prompt

`bot.php` gere:

- ligar ou fechar o Míu;
- alterar ou esconder o texto “Fala comigo!” junto ao botão;
- na TAB **Aparência**, definir separadamente o tamanho da cara no canto, na barra do chat e após cada resposta;
- mostrar ou esconder o círculo em cada um desses três locais;
- definir durante quantos segundos aparece o balão inicial junto ao Míu;
- escolher se os erros/avisos públicos aparecem no formulário ou são ditos pelo Míu no mesmo balão;
- configurar o tamanho das animações interactivas de corpo inteiro;
- fornecedor principal e fallback;
- modelo de cada fornecedor;
- system prompt e base de informação enviada em cada pedido;
- pergunta inicial;
- objectivos próprios de cada produto e passo;
- passos em que a tabela de preços actual deve ser injectada;
- tamanho de mensagem, turnos por conversa, rate limits e resposta máxima.

`content/miu-defaults.json` é a **fonte única da verdade** para as definições
globais do Míu. Guardar alterações no painel `bot.php` grava directamente
neste ficheiro JSON versionado. O ficheiro faz parte do código do projecto e
será incluído no futuro deploy, garantindo consistência total entre local e
servidor sem dependência de tabelas de configuração em SQLite.

O schema desse ficheiro é validado de forma estrita: as chaves globais são
obrigatórias e booleanos, inteiros e texto têm de usar o tipo JSON correcto.
Um ficheiro ausente, truncado ou estruturalmente inválido não é completado com
valores silenciosos. Ao guardar, o painel escreve e valida primeiro um ficheiro
temporário na mesma pasta, reserva a versão anterior e só depois instala a nova;
se a substituição falhar, tenta repor a versão anterior sem escrever por cima
dela parcialmente.

O prompt instrui o Míu a responder em português de Portugal, a não inventar
preços, prazos ou disponibilidade, a não pedir dados pessoais e a usar apenas
links internos em Markdown. O browser só torna clicáveis URLs do próprio site;
HTML devolvido pelo modelo é sempre tratado como texto.

O browser identifica `state.product` e o resultado de `currentStep(product)`,
mas envia apenas os identificadores. O servidor volta a validar o slug e o
passo nos JSON do catálogo ou do Congresso. Os objectivos vivem em
`bot_step_contexts`; as perguntas e respostas rápidas vivem apenas em
`content/miu-quick-replies.json`. Os valores monetários nunca são copiados para
SQLite: são lidos de `pricing.json` no momento de construir a prompt. A TAB
“Contexto por passo” mostra uma pré-visualização exacta do bloco injectado e a
TAB “Respostas rápidas” organiza todos os pares por produto e passo. Não existe
fallback por tipo de passo: um contexto ausente fica sem botões, evitando uma
resposta genérica que possa contradizer o produto.

Em cada pergunta, o browser acrescenta ainda as opções seleccionadas no passo e
as mensagens de erro que estejam realmente visíveis no ecrã. Não recolhe campos
de texto, email, telefone, ficheiros ou outros dados pessoais. O servidor
limita e limpa estas listas, oculta emails/números que apareçam no texto e
marca-as como estado não fiável da interface;
nunca ganham prioridade sobre o produto, o passo ou a tabela de preços
validados.


## Aparência, animações por produto e mensagens do site

A cara usada no chat e a biblioteca de corpo inteiro continuam separadas. Na
TAB **Aparência** de `bot.php`, `animations.json.display` guarda os tamanhos e
os círculos independentes para o lançador, o cabeçalho e o avatar das respostas,
além do tamanho interactivo, duração do balão inicial e `errorsViaMiu`.

As animações de corpo inteiro podem declarar o gatilho `product_enter` e uma
lista `products`. `products: ["*"]` funciona como fallback para qualquer produto;
uma lista de slugs restringe a animação a esses produtos. Ao entrar numa página
com `data-product`, o browser escolhe sempre uma animação elegível para esse
produto. Os gatilhos aleatórios continuam a respeitar a probabilidade configurada.
A deslocação (`left`, `right`, `jump`) acontece fora da cara do círculo, por isso
a personagem pode sair visualmente da sua posição normal sem substituir os
avatares do chat.

As mensagens públicas de validação e pequenas sugestões vivem em
`content/erros.json`. Cada registo guarda uma versão `default` e uma versão
`miu`; `erros.php` permite editar as duas em TABs separadas. Quando
`errorsViaMiu` está ligado (por omissão), o texto `miu` é mostrado no balão junto
ao lançador e a mensagem inline é suprimida. Quando está desligado, o formulário
mostra a versão `default` no local normal. Erros técnicos, erros de administração,
CSRF, configuração e falhas internas não pertencem a este catálogo.

## Laboratório Experimental 8×8 e Sistema Multi-Sheet

O projeto conta com um ambiente de testes avançado para afinação de expressões faciais em `site/miu-animation-lab.php`.

### Características do Laboratório:
1. **Algoritmo de Auto-Centragem e Isolamento (*Connected-Component Labelling*):**
   Varre a imagem pixel a pixel com a "metáfora dos autocolantes", isolando a tinta de cada gato e eliminando *drift* vertical e desalinhamentos de folhas geradas por IA.
2. **Arquitetura Multi-Sheet:**
   Permite carregar múltiplas folhas em simultâneo (ex.: Folha 1 com tiras de *in-betweens* contínuos e Folha 2 com expressões de 64 poses), combinando frames de ambas na mesma sequência animada.
3. **Ciclo Contínuo Automático (*Showcase Mode*):**
   Por omissão, o leitor percorre todas as animações sequencialmente em loop, atualizando em tempo real o nome da animação, o seletor e a linha de timings no ecrã.
4. **Ficheiro de Configuração Ativo:**
   `site/content/brand/miu/experimental/experimental-full-spritesheet-animations_002.json` e `miu-fluid-animations-transparent.png`.

## Míu Animation Director V5

`site/miu-rig.php` é uma experiência autónoma e não é carregada pelo
configurador. O valor absoluto deixou de escolher uma pose. O fluxo é agora:

```text
idle vivo → atenção → acompanhar o gesto → reacção → recovery → idle vivo
```

O director guarda o valor no início do gesto, o valor actual, direcção,
velocidade, delta acumulado, origem do evento e importância do pack. Durante um
arrasto aberto mantém uma única animação de atenção; não reinicia nem avança uma
frame por unidade. Quando a pessoa larga ou abranda, classifica a mudança como
pequena, média ou grande e toca uma única reacção. A oscilação que regressa ao
valor inicial não produz uma sequência nervosa de reacções.

O idle escolhe com pesos e pausas variáveis entre piscar/respirar, olhar para os
lados, mexer uma orelha e fazer uma micro-careta. A biblioteca pode receber
novas rotinas sem alterar a lógica de quantidade.
Os efeitos `?`, `!`, linhas manga, estrelas, gota e água nos olhos são uma camada
canvas independente. As alterações de olhos e boca continuam a ser keyframes
desenhados; o rig limita-se a deslocação, rotação e squash/stretch global.

A API experimental fica em `window.miu` e expõe `quantity.begin()`,
`quantity.set()`, `quantity.end()`, `updateQuantityReaction()`, `selectPack()`,
`playOneShot('rejoice')`, `reset()` e `debug()`. O `rejoice` mantém prioridade.
Com movimento reduzido, os frames e a informação emocional continuam presentes,
mas o bounce e o movimento secundário ficam suspensos.

As folhas 8×8 vivem em
`content/brand/miu/experimental/quantity-rig-v4/`, sempre em PNG. As Folhas 3 e
4 preservam a primeira experiência V4. A Folha 5 contém idle/atenção/recovery e
a Folha 6 contém as reacções por gesto do V5, incluindo boca aberta, olhos
húmidos e pré-choro anime. Todas estão declaradas no manifesto multi-sheet e são
recortadas pelo mesmo algoritmo de componentes conectados e medianas anatómicas.

## Fluxo e barreiras

```text
browser
  ├─ comprimento, repetição, links, abuso e prompt injection
  └─ POST JSON + CSRF
       └─ bot-api.php
          ├─ origem, tamanho do pedido e sessão
          ├─ limite por IP e por conversa
          ├─ filtros de abuso e prompt injection
          ├─ grava mensagem em private/miu.sqlite
          ├─ valida produto/passo e acrescenta o contexto autorizado
          └─ só então chama OpenRouter ou Gemini e transmite os fragmentos
```

Uma mensagem recusada pelo browser nem chega ao servidor. Uma mensagem apanhada
pela segunda barreira pode ficar registada com estado `blocked`, mas nunca é
enviada ao fornecedor. A conversa usada como contexto vem do SQLite, não do
histórico fornecido pelo browser, e inclui no máximo as últimas 12 perguntas e
respostas aceites.

Os botões sugeridos não chamam nenhum fornecedor: a resposta exacta daquele
`scope + produto + passo` é lida do JSON, escrita com streaming simulado no
browser e registada no SQLite com estado `local`. Pedidos para revelar
prompts/instruções internas e pedidos para falar
com uma pessoa seguem o mesmo percurso determinístico. O segundo devolve o link
para `contacto.html`. Mensagens `local` nunca entram no contexto enviado ao
OpenRouter ou Gemini; uma tentativa de obter a prompt cria ainda uma nova
fronteira de conversa, pelo que nenhuma mensagem anterior é reutilizada no
pedido seguinte.

O endpoint público aceita pedidos até 32 KiB. Por omissão, cada mensagem tem
800 caracteres, cada conversa 20 perguntas, e cada IP pode fazer 6 pedidos por
minuto e 40 por hora. O painel permite ajustar estes valores dentro de limites
duros no servidor.

## SQLite e privacidade

`private/miu.sqlite` tem três tabelas activas:

- `bot_conversations` — token aleatório, IP, user-agent, página e datas;
- `bot_messages` — papel, texto, estado, fornecedor/modelo e erro técnico.
- `bot_step_contexts` — objectivos e opção de preços por passo; a coluna antiga de perguntas é apenas cache regenerada do JSON.

Quando se usa `openrouter/free`, o campo `model` de cada resposta SSE é guardado
em `bot_messages`. Assim, o painel mostra o modelo concreto escolhido pelo
router e não apenas `openrouter/free`.

O IP e o user-agent ficam na base local; não são enviados no payload da IA.
As mensagens aceites, o contexto recente, a system prompt e a base de
informação são processados pelo fornecedor escolhido. A página
`privacy.html` declara este tratamento. Não há eliminação automática: uma
conversa pode ser aberta e apagada, com CSRF e confirmação, em `bot.php`.

## Verificação local

1. Iniciar o site com `run-local-admin.bat` ou `start-lan.bat`. Os dois definem
   `private-local` como pasta privada e activam cURL/OpenSSL no PHP local.
2. Abrir `bot.php` e confirmar a criação de `private-local/miu.sqlite`.
3. Configurar pelo menos uma chave em `private-local/miu-config.php`.
4. Abrir `index.html`, clicar na cabeça do gato e confirmar que a resposta
   aparece progressivamente.
5. Testar uma mensagem longa, repetição, abuso e uma tentativa de revelar a
   prompt; nenhuma deve chegar ao fornecedor.
6. Abrir uma página de produto principal e uma de `congressos/2026`.
7. Na TAB “Respostas rápidas”, confirmar perguntas e respostas; na TAB
   “Contexto por passo”, confirmar a pré-visualização de um passo de preços e
   do passo “Cartão de Apresentação”.
8. Confirmar em `bot.php` o IP, hora, contexto, modelo real e resposta guardados.
9. Abrir `miu-animation-lab.php` para testar as animações fluídas 8×8 e o modo multi-sheet.
10. Abrir `miu-rig.php` para testar os extremos, os saltos, a oscilação e o
    regresso do `rejoice` ao estado-base.

`miu-config.php` nunca é um endereço público. O ficheiro fica em
`private-local/miu-config.php`; a gestão faz-se em `/bot.php` e o teste público
na página inicial ou noutra página onde apareça a cabeça do Míu.

Antes de publicar, o mesmo fecho de administração continua obrigatório:
`MIA_ADMIN_OPEN=false` em `admin-open.php`.
