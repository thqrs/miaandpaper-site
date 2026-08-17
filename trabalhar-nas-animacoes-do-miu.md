# Trabalhar nas animações do Míu

> Documento de trabalho para evoluir **as animações da cara do Míu dentro da bolha circular**.
> Estado analisado: versão do site de 17 de Agosto de 2026.
> **Este documento não gera imagens nem altera o código do site.** Serve para explicar o sistema actual e definir uma arquitectura segura para a próxima fase.

---

## 1. Objectivo

O objectivo desta fase é tornar o Míu mais expressivo **sem o tirar da bolha**.

Queremos criar uma biblioteca de pequenas animações ao estilo **manga / sprite**, em que a cara do Míu reage a situações comuns do site e da conversa, por exemplo:

- calmo / neutro;
- piscar os olhos;
- feliz / sorriso;
- muito feliz / entusiasmado;
- curioso;
- surpreendido;
- a pensar;
- confuso;
- envergonhado;
- preocupado;
- triste / sentido;
- pedido de desculpa;
- sonolento / dormir;
- maroto / wink;
- pequenas reacções espontâneas quando está parado.

Estas animações são diferentes das animações de corpo inteiro já existentes, como andar, saltar ou atirar coisas ao chão.

### Regra principal

**As expressões deste projecto devem acontecer dentro da bolha do Míu.**

O contorno da bolha, a posição do launcher e o seu comportamento de abrir/minimizar o chat não devem ser substituídos pelas animações de corpo inteiro.

---

# 2. Como o Míu está dividido actualmente

Actualmente existem, na prática, **dois sistemas de animação diferentes**.

## 2.1. Sistema A — cara do Míu dentro da bolha

É este o sistema que interessa para este projecto.

Ficheiros principais:

```text
site/js/24-miu.js
site/css/13-miu.css
site/content/brand/miu/miu-sprite.webp
site/content/brand/miu/miu-sprite-small.webp
site/content/brand/miu/miu-sprite-sleep.webp
site/content/brand/miu/miu-sprite.json
site/content/brand/miu/miu-sprite-small.json
site/content/brand/miu/miu-sprite-sleep.json
tools/process-miu-sprite.py
```

A cara principal aparece dentro de:

```html
<span class="miu-launcher__bubble-face">
    <span class="miu-face miu-face--launcher"></span>
</span>
```

O CSS faz desta área um círculo com `overflow: hidden`:

```css
.miu-launcher__bubble-face {
    overflow: hidden;
    border-radius: 50%;
}
```

Portanto qualquer frame usado neste sistema tem de ser desenhado pensando nesse recorte circular.

---

## 2.2. Sistema B — Míu de corpo inteiro

Este é outro sistema e **não deve ser confundido com as expressões da bolha**.

Ficheiros principais:

```text
site/content/brand/miu/animations.json
site/lib/miu-animations.php
site/bot.php
site/js/24-miu.js
site/css/13-miu.css
```

Actualmente contém animações como:

```text
Lili — calma / piscar
Lili — adormecer
Lili — andar para a esquerda
Lili — andar para a direita
Lili — saltar
Lili — atirar coisas ao chão
```

Estas animações usam spritesheets independentes e podem ter movimento físico:

```text
none
left
right
jump
```

Também podem ser limitadas a produtos específicos e configuradas através de `bot.php`.

Este sistema é útil para animações especiais fora da bolha, mas **não é o sistema que queremos usar para as expressões manga da cara**.

---

# 3. Como funciona hoje a spritesheet da cara

A folha principal actual é:

```text
site/content/brand/miu/miu-sprite.webp
```

A estrutura declarada é:

```text
4 colunas × 2 linhas
8 frames
192 × 192 px por frame
```

Logo a folha completa corresponde conceptualmente a:

```text
┌────────────┬────────────┬────────────┬────────────┐
│ frame 0    │ frame 1    │ frame 2    │ frame 3    │
│ calmo      │ piscar     │ fechado    │ fim piscar │
├────────────┼────────────┼────────────┼────────────┤
│ frame 4    │ frame 5    │ frame 6    │ frame 7    │
│ inclina E  │ inclina D  │ sorriso    │ orelha     │
└────────────┴────────────┴────────────┴────────────┘
```

Manifesto actual:

| Frame | Nome | Duração-base |
|---:|---|---:|
| 0 | `calmo` | 900 ms |
| 1 | `piscar-inicio` | 110 ms |
| 2 | `piscar-fechado` | 100 ms |
| 3 | `piscar-fim` | 150 ms |
| 4 | `inclina-esquerda` | 420 ms |
| 5 | `inclina-direita` | 420 ms |
| 6 | `sorriso` | 320 ms |
| 7 | `orelha` | 760 ms |

Há ainda uma versão especial para tamanhos pequenos:

```text
miu-sprite-small.webp
```

Esta usa os mesmos 8 estados, mas pode ter traço mais forte para os avatares pequenos.

E existe uma folha separada para dormir:

```text
miu-sprite-sleep.webp
```

com 4 frames:

```text
sonolento → dorme-abre → dorme-fecha → dorme-fundo
```

---

# 4. Como um frame é mostrado

O browser **não corta fisicamente a imagem em oito ficheiros durante a execução**.

Em vez disso, a `<span class="miu-face">` recebe a spritesheet inteira como `background-image` e o JavaScript desloca o fundo até ao frame pretendido.

A função central é:

```text
miuAnimationApplyFrame(element, animation, frameIndex)
```

Ela calcula:

1. número de colunas;
2. número de linhas;
3. coluna do frame;
4. linha do frame;
5. `background-size`;
6. `background-position`.

Por exemplo, para uma folha 4 × 2:

```text
background-size: 400% 200%
```

O elemento continua exactamente no mesmo sítio. Só muda a parte da spritesheet que fica visível.

Isto é perfeito para expressões faciais porque:

- não causa saltos de layout;
- não muda o tamanho da bolha;
- não cria novos elementos DOM por frame;
- permite animações rápidas;
- uma única imagem pode conter vários frames.

---

# 5. Como uma animação é construída

Uma animação não precisa de seguir simplesmente:

```text
0 → 1 → 2 → 3
```

O motor aceita uma **sequência arbitrária de frames**.

Por exemplo, o sorriso actual é aproximadamente:

```js
sequence: [0, 6, 6, 0]
frameDurationsMs: [100, 320, 260, 180]
```

Isto significa:

```text
calmo
↓ 100 ms
sorriso
↓ 320 ms
sorriso
↓ 260 ms
calmo
↓ 180 ms
```

Da mesma forma, uma expressão manga futura poderia usar:

```text
normal → olhos abrem → surpresa → surpresa forte → normal
```

sem ser necessário repetir desenhos manualmente na spritesheet.

Um mesmo frame pode aparecer várias vezes na sequência.

---

# 6. O que existe hoje dentro de `24-miu.js`

Este é um ponto muito importante.

Embora exista um painel configurável para as animações de corpo inteiro, **as animações da cara estão actualmente escritas directamente dentro de `site/js/24-miu.js`**.

Na inicialização, `miuAnimationSetup()` constrói internamente uma configuração com estas animações:

```text
miu-cara-calma
miu-cara-sorriso
miu-cara-inclina
miu-cara-orelha
miu-cara-dormir
```

Portanto, actualmente:

```text
animations.json
        │
        ├── controla principalmente corpo inteiro
        │
        └── fornece também definições gerais de aparência/tempo

24-miu.js
        │
        └── contém hardcoded a biblioteca da cara
```

Esta divisão é a principal limitação para o projecto de expressões.

---

# 7. Gatilhos que o site já produz

O motor do Míu já conhece muitos acontecimentos úteis.

Actualmente existem estes gatilhos:

```text
page_load
product_enter
launcher_hover
launcher_open
launcher_close
step_change
message_sent
reply_start
reply_end
quick_reply
conversation_reset
idle_random
inactivity
```

Significado:

| Gatilho | Momento |
|---|---|
| `page_load` | a página terminou de carregar |
| `product_enter` | entrou numa página de produto |
| `launcher_hover` | passou o rato sobre o Míu |
| `launcher_open` | abriu a conversa |
| `launcher_close` | minimizou/fechou a conversa |
| `step_change` | mudou de passo num produto |
| `message_sent` | cliente enviou uma pergunta |
| `reply_start` | o Míu começou a preparar/responder |
| `reply_end` | a resposta terminou |
| `quick_reply` | cliente clicou numa pergunta rápida |
| `conversation_reset` | iniciou nova conversa |
| `idle_random` | reacção espontânea enquanto está parado |
| `inactivity` | passou muito tempo sem interacção |

### Importante

O site já chama vários destes eventos para a cara, mas actualmente nem todos têm uma animação correspondente.

Por exemplo, o código dispara:

```text
quick_reply
reply_start
step_change
page_load
```

mas a biblioteca hardcoded actual da cara não tem uma animação associada a vários desses gatilhos.

Isto significa que **o motor já tem grande parte da informação de contexto de que precisamos**. Não é necessário inventar um sistema novo de eventos para tornar o Míu expressivo.

---

# 8. Expressões actuais e gatilhos

## `miu-cara-calma`

É a animação base.

Tem:

- períodos longos no frame calmo;
- piscar de olhos;
- ocasionalmente o frame da orelha.

Repete continuamente enquanto nenhuma outra animação a substitui.

---

## `miu-cara-sorriso`

Actualmente pode acontecer em:

```text
launcher_hover
launcher_open
message_sent
reply_end
conversation_reset
```

É uma reacção positiva genérica.

O problema é que está a ser usada para situações semanticamente muito diferentes.

No futuro queremos distinguir, por exemplo:

```text
hover              → curioso / amigável
launcher_open      → cumprimento
message_sent       → atento / ouvi-te
reply_start        → pensar
reply_end          → satisfeito / sorriso
conversation_reset → olá / energia renovada
```

---

## `miu-cara-inclina`

Acontece aleatoriamente quando está parado.

É uma boa expressão ambiental e deve continuar a existir.

---

## `miu-cara-orelha`

Pode acontecer:

```text
idle_random
launcher_close
```

Também é uma boa animação ambiental.

---

## `miu-cara-dormir`

É activada depois de um período de inactividade.

O valor actual vem de:

```text
animations.json → display.sleepAfterMs
```

Actualmente está configurado para cerca de 45 segundos.

---

# 9. Uma limitação visual importante do sistema actual

Quando o chat está aberto, o launcher é escondido intencionalmente:

```text
.miu-root.is-open .miu-launcher
```

fica invisível e deixa de receber interacção.

Isto significa que eventos como:

```text
message_sent
reply_start
reply_end
```

podem mudar a animação de `miuLauncherSprite`, mas **a cara do launcher não está visível nesse momento** porque a janela do chat tomou o lugar dela.

Na janela aberta existem outras caras:

1. a cara pequena no cabeçalho;
2. os avatares ao lado das respostas.

Essas caras são actualmente essencialmente estáticas.

### Decisão a tomar na implementação futura

Para este projecto há duas possibilidades:

### Opção A — expressões apenas no Míu fechado

As expressões servem sobretudo para:

- hover;
- entrada na página;
- mudança de produto/passo;
- avisos do site;
- idle;
- dormir;
- minimização.

É a opção mais simples.

### Opção B — a expressão acompanha também o Míu na janela

Quando o chat está aberto, a mesma emoção pode aparecer na cara do cabeçalho.

Exemplo:

```text
cliente envia mensagem
        ↓
header do Míu = atento
        ↓
reply_start
        ↓
header do Míu = pensar
        ↓
reply_end
        ↓
header do Míu = feliz
```

Esta opção torna a conversa muito mais viva e aproveita verdadeiramente os gatilhos `message_sent`, `reply_start` e `reply_end`.

**Recomendação:** construir a biblioteca de expressões de forma que possa ser aplicada tanto ao launcher como ao avatar do cabeçalho, mesmo que a primeira implementação só anime o launcher.

---

# 10. Arquitectura recomendada para a nova biblioteca de expressões

Não recomendo colocar dezenas de novas expressões directamente dentro de `24-miu.js`.

Também não recomendo misturá-las imediatamente com a biblioteca de corpo inteiro actual.

## Recomendação: ficheiro próprio

Criar futuramente:

```text
site/content/brand/miu/face-animations.json
```

E guardar as spritesheets da cara em:

```text
site/content/brand/miu/faces/
```

Exemplo futuro:

```text
site/content/brand/miu/faces/
    idle.webp
    happy.webp
    excited.webp
    curious.webp
    surprised.webp
    thinking.webp
    confused.webp
    embarrassed.webp
    worried.webp
    sad.webp
    sorry.webp
    sleepy.webp
```

### Porque um ficheiro separado?

O `animations.json` actual é lido, normalizado e novamente gravado por `miu-animations.php`.

O normalizador conhece a estrutura actual de:

```text
display
animations
baseAnimationId
```

Adicionar campos novos manualmente a esse JSON sem alterar o normalizador pode fazer com que esses campos se percam quando o painel voltar a guardar a configuração.

Um `face-animations.json` separado evita esse risco e deixa muito clara a fronteira:

```text
animations.json
    = corpo inteiro / interacções físicas

face-animations.json
    = emoções e expressões dentro da bolha
```

---

# 11. Estrutura proposta para `face-animations.json`

Exemplo conceptual — **não implementar ainda**:

```json
{
  "schemaVersion": 1,
  "baseExpressionId": "idle",
  "expressions": [
    {
      "id": "happy",
      "name": "Feliz",
      "file": "faces/happy.webp",
      "columns": 4,
      "rows": 2,
      "sequence": [0, 1, 2, 3, 4, 5, 0],
      "frameDurationsMs": [100, 100, 120, 320, 260, 150, 180],
      "repeat": 1,
      "triggers": ["reply_end"],
      "probability": 1,
      "weight": 1,
      "cooldownMs": 700,
      "priority": 50,
      "restore": "idle"
    }
  ]
}
```

O objectivo é que uma expressão possa ser acrescentada sem editar JavaScript.

---

# 12. Campos que cada expressão deve ter

## `id`

Identificador técnico estável.

Exemplos:

```text
idle
happy
thinking
surprised
confused
```

---

## `name`

Nome humano mostrado no painel.

```text
Feliz
A pensar
Surpreendido
```

---

## `file`

Spritesheet usada pela expressão.

```text
faces/thinking.webp
```

---

## `columns` / `rows`

Grelha da spritesheet.

Exemplo:

```text
4 × 2
```

O motor actual já sabe trabalhar com dimensões arbitrárias entre 1 e 16.

---

## `sequence`

Ordem real de apresentação dos frames.

Exemplo:

```text
[0,1,2,3,2,1,0]
```

---

## `frameDurationsMs`

Tempo individual de cada posição da sequência.

Isto é importante para animação de personagem: nem todos os frames devem durar o mesmo.

Um blink precisa de frames muito rápidos; uma pose de surpresa pode ficar parada 400–600 ms.

---

## `repeat`

Número de ciclos.

Para expressões normais:

```text
1
```

Para o idle:

```text
0 = contínuo
```

---

## `triggers`

Situações em que a expressão pode ser escolhida.

---

## `probability`

Probabilidade de ser considerada.

Útil para reacções ambientais.

Exemplo:

```text
0.30 = 30%
```

Não deve ser usada para uma reacção obrigatória como “a pensar” durante `reply_start`.

---

## `weight`

Se várias expressões forem válidas para o mesmo gatilho, o peso controla qual aparece mais vezes.

---

## `cooldownMs`

Evita repetir constantemente a mesma expressão.

Exemplo:

```text
surprised → 10 000 ms
```

---

## `priority`

Este campo ainda não existe no motor actual da cara, mas é recomendável para a nova versão.

Exemplo de prioridades:

```text
10  idle
20  reacção ambiental
40  hover
50  mensagem enviada
60  pensar
70  sucesso / fim da resposta
80  aviso do site
90  erro importante
100 estado crítico/manual
```

Assim, uma animação aleatória nunca deve interromper uma expressão importante.

---

# 13. Biblioteca de expressões recomendada

Não vale a pena começar com 30 expressões.

Uma primeira biblioteca forte pode ter cerca de **10–14 estados**.

## Grupo A — base

### 1. `idle`

Calmo, respiração visual mínima, blink ocasional.

Deve ser a expressão para onde tudo regressa.

### 2. `blink`

Pode fazer parte do idle ou existir como micro-animação independente.

### 3. `sleepy`

Sonolento / dormir após inactividade.

---

## Grupo B — positivas

### 4. `happy`

Sorriso normal.

Boa para:

```text
reply_end
conversation_reset
```

### 5. `excited`

Mais energética, olhos grandes/brilho/ênfase manga.

Usar com moderação.

Boa para acontecimentos realmente positivos, não para cada clique.

### 6. `proud` ou `done`

Expressão de “feito!” / satisfação.

Pode ser útil quando o utilizador conclui uma personalização ou tarefa.

---

## Grupo C — atenção / raciocínio

### 7. `curious`

Cabeça inclinada / olhar curioso.

Boa para:

```text
launcher_hover
step_change
idle_random
```

### 8. `thinking`

Olhar de pensamento; pode ter um pequeno símbolo manga desde que fique dentro do recorte seguro.

Boa para:

```text
reply_start
```

### 9. `confused`

Confusão suave, não agressiva.

Pode ser usada quando o site não percebe uma escolha ou quando existe uma validação recuperável.

---

## Grupo D — reacções

### 10. `surprised`

Olhos grandes / reacção curta.

Boa para eventos ocasionais ou mudanças inesperadas.

### 11. `embarrassed`

Expressão manga com embaraço, blush, gotinha, etc.

Deve ser usada esporadicamente.

### 12. `cheeky`

Wink / maroto.

Boa exclusivamente como reacção ambiental rara.

---

## Grupo E — negativas suaves

### 13. `worried`

Para avisos recuperáveis.

### 14. `sorry`

Para uma falha real do Míu ou uma mensagem que não conseguiu processar.

Se futuramente houver `sad`, deve ser reservada para situações em que faça sentido; o site não deve parecer melodramático por um erro pequeno de formulário.

---

# 14. Mapeamento inicial recomendado

Uma primeira regra pode ser:

| Evento | Expressão sugerida |
|---|---|
| página carrega | `idle` |
| hover no Míu | `curious` ou `happy` |
| abrir chat | `happy` |
| minimizar | `blink` / `cheeky` ocasional |
| mudança de passo | `curious` ocasional |
| mensagem enviada | `attentive` ou `curious` |
| resposta rápida | `happy` curto |
| início de resposta | `thinking` |
| fim de resposta | `happy` |
| nova conversa | `excited` ou `happy` |
| aviso de formulário | `worried` |
| erro/falha do Míu | `sorry` |
| idle aleatório | `blink`, `curious`, `cheeky`, orelha |
| inactividade | `sleepy` |

Não é necessário que todas as expressões sejam determinísticas.

O ideal é combinar:

```text
reacções obrigatórias
+
variações possíveis
+
pequenas animações aleatórias
```

---

# 15. Expressão não é o mesmo que texto da IA

Não devemos tentar pedir ao modelo de IA para decidir frame a frame qual emoção mostrar.

Isso tornaria o comportamento:

- mais lento;
- imprevisível;
- dependente do fornecedor;
- difícil de testar;
- potencialmente inconsistente.

As expressões normais devem ser determinadas por **eventos locais do site**.

Por exemplo:

```text
miuSendMessage()
    ↓
message_sent
    ↓
attentive

stream começa
    ↓
reply_start
    ↓
thinking

stream termina
    ↓
reply_end
    ↓
happy
```

Mais tarde, se for desejável, pode existir uma camada semântica controlada e limitada, mas não é necessária para obter grande parte do efeito pretendido.

---

# 16. Regras visuais para futuras spritesheets

## Fundo

Sempre transparente.

```text
RGBA
```

Evitar fundos brancos ou grelhas de transparência incorporadas na imagem.

---

## Formato

Preferência:

```text
WebP com transparência
```

PNG também pode ser aceite durante produção/testes.

---

## Tamanho

O Míu principal aparece actualmente perto de:

```text
46 px
```

O painel permite tamanhos maiores.

O sistema antigo publica frames de:

```text
192 × 192 px
```

Para consistência, é seguro continuar a produzir inicialmente a **192 × 192 px por frame**, sobretudo enquanto ainda podemos reutilizar as imagens noutros tamanhos.

Mais tarde, se o peso dos assets crescer muito, pode testar-se 128 × 128 px por frame.

---

## Enquadramento

Todas as expressões precisam de manter:

- cabeça aproximadamente na mesma escala;
- olhos aproximadamente na mesma altura;
- centro visual estável;
- distância semelhante às margens;
- origem consistente.

Se a cabeça muda de tamanho entre frames, o resultado parece que o Míu está a “pulsar”.

---

## Área segura circular

Como a cara fica dentro de:

```css
overflow: hidden;
border-radius: 50%;
```

qualquer elemento manga desenhado demasiado perto dos cantos do quadrado será cortado.

Portanto:

- blush, gota, linhas de surpresa e pequenos símbolos devem ficar dentro da área circular segura;
- `zzz` grandes devem ser tratados com cuidado;
- não colocar elementos importantes nos quatro cantos do frame;
- testar sempre a imagem **dentro do círculo real**, não apenas num viewer quadrado.

---

# 17. Uma spritesheet gigante ou uma por expressão?

## Não recomendado: uma mega-folha com todas as emoções

Por exemplo:

```text
8 colunas × 8 linhas = 64 frames
```

Funciona tecnicamente, mas cria problemas:

- qualquer nova expressão obriga a republicar a folha inteira;
- índices tornam-se difíceis de manter;
- um erro de ordem afecta várias animações;
- ficheiro fica pesado;
- edição no painel fica pouco intuitiva.

## Recomendado: uma spritesheet pequena por expressão

Exemplo:

```text
faces/happy.webp       4×2
faces/thinking.webp    4×2
faces/surprised.webp   4×1
faces/sorry.webp       4×2
```

Vantagens:

- cada animação é independente;
- fácil substituir apenas uma;
- timings podem ser diferentes;
- mais fácil trabalhar iterativamente;
- adicionar uma emoção não toca nas outras;
- o motor actual já sabe trabalhar com ficheiros e grelhas diferentes.

---

# 18. Não é obrigatório usar todos os frames da grelha

Uma folha 4 × 2 pode ter 8 posições, mas uma animação pode usar apenas:

```text
0,1,2,3,4
```

O ideal, no entanto, é evitar células vazias sem necessidade.

Para expressões pequenas podem usar-se folhas:

```text
4 × 1
```

ou até:

```text
3 × 1
```

O runtime actual não exige potências de 2 nem uma grelha 4 × 2 fixa.

---

# 19. Timing — o que faz uma animação parecer natural

O erro mais comum numa spritesheet não é o desenho; é dar exactamente o mesmo tempo a todos os frames.

Exemplo de blink:

```text
calmo       900 ms
meio fecha   90 ms
fechado      80 ms
meio abre   100 ms
calmo      1000 ms
```

Exemplo de surpresa:

```text
normal       80 ms
reacção      90 ms
surpresa    420 ms
surpresa    280 ms
regresso    130 ms
```

Exemplo de pensar:

```text
normal      100 ms
olhar lado  180 ms
pensar      500 ms
pensar      600 ms
piscar       90 ms
pensar      500 ms
```

Os desenhos intermédios normalmente devem ser rápidos e as poses-chave mais longas.

---

# 20. Repetições e retorno ao estado base

A maioria das expressões deve cumprir:

```text
idle
  ↓
expressão
  ↓
idle
```

Não queremos deixar o Míu eternamente surpreendido porque aconteceu um evento há 20 segundos.

A excepção é um **estado**, não uma reacção.

Exemplos de estados:

```text
idle
sleeping
thinking enquanto resposta ainda não começou/terminou
```

No futuro é útil distinguir explicitamente:

```text
reaction = toca uma vez e regressa
state    = mantém até ser substituído
```

---

# 21. Prioridades e interrupções

Quando houver muitas animações, duas situações podem acontecer quase ao mesmo tempo.

Exemplo:

```text
idle_random começa
        ↓
100 ms depois cliente envia mensagem
```

A animação aleatória deve ser interrompida imediatamente.

Uma regra recomendada:

```text
inactivity / idle          prioridade baixa
hover                      prioridade média-baixa
message_sent               prioridade média
reply_start                prioridade alta
reply_end                  prioridade alta
site warning/error         prioridade muito alta
```

Uma animação só deve interromper outra se tiver prioridade igual ou superior, salvo uma acção explicitamente cancelável.

---

# 22. Cooldowns

Cooldowns são importantes para não transformar o Míu numa personagem hiperactiva.

Exemplo:

```text
curious       3–5 s
cheeky       15–30 s
surprised    10–20 s
excited      10–20 s
idle blink    sem problema / integrado no base
```

A reacção mais expressiva deve ser, em geral, a mais rara.

---

# 23. Movimento reduzido / acessibilidade

O código actual já respeita:

```text
prefers-reduced-motion: reduce
```

Quando esta preferência está activa, as animações não devem ficar a ciclar agressivamente.

Na evolução da biblioteca da cara devemos manter esta regra.

Uma solução apropriada é:

- mostrar apenas o `staticFrame` representativo da emoção;
- regressar ao idle depois de um pequeno período;
- não fazer loops rápidos.

---

# 24. Os três locais onde aparece a cara

Actualmente a cara do Míu existe em três contextos visuais diferentes.

## A. Launcher

```text
.miu-face--launcher
```

É a cara grande dentro da bolha no canto inferior direito.

**É o alvo principal deste projecto.**

---

## B. Cabeçalho do chat

```text
.miu-face--header
```

É a cara pequena ao lado do nome Míu quando a janela está aberta.

Pode futuramente reflectir o estado actual da expressão.

---

## C. Avatar das respostas

```text
.miu-face--message
```

Actualmente cada resposta escolhe um frame estático através de:

```text
miuAnimationApplyStatic()
```

A função percorre uma pequena lista de poses estáveis:

```text
calmo
sorriso
inclina-esquerda
inclina-direita
orelha
```

### Recomendação

Os avatares históricos das mensagens **não devem ficar animados continuamente**.

Isso criaria dezenas de animações em simultâneo no histórico.

Podem continuar estáticos, mas no futuro o `staticFrame` pode corresponder à emoção usada quando a resposta terminou.

Exemplo:

```text
Míu terminou resposta com "happy"
        ↓
avatar dessa resposta guarda frame estático feliz
```

Isto dá personalidade sem custo visual permanente.

---

# 25. Relação com os avisos e erros do site

O site já consegue mandar mensagens de validação através do Míu quando:

```text
errorsViaMiu = true
```

O texto aparece no balão junto ao launcher através de:

```text
window.miuShowSiteMessage(...)
```

Este é um ponto excelente para adicionar expressões contextuais no futuro.

Exemplo:

```text
mensagem informativa
    → curious

falta escolher uma opção
    → worried

erro técnico recuperável
    → sorry
```

Mas deve existir uma API explícita, por exemplo conceptualmente:

```js
miuShowSiteMessage(text, duration, "worried")
```

ou:

```js
miuExpressionTrigger("site_warning")
```

Não devemos tentar inferir emoção analisando livremente o texto da mensagem.

---

# 26. Como as novas imagens deverão entrar no projecto mais tarde

Quando começarmos efectivamente a produzir sprites, o fluxo recomendado é:

```text
1. criar/desenhar a expressão
2. exportar folha transparente
3. verificar alinhamento dos frames
4. colocar temporariamente no laboratório do Míu
5. testar sequência e timings
6. ajustar recorte circular
7. comprimir/exportar WebP final
8. adicionar ao catálogo face-animations.json
9. associar gatilhos
10. testar desktop + mobile + reduced-motion
```

### Não gerar imagens automaticamente neste passo

Este documento serve para preparar a arquitectura e o catálogo.

As imagens devem ser trabalhadas numa fase própria, uma expressão de cada vez.

---

# 27. Laboratório actual do `bot.php`

`bot.php` já contém um laboratório de animações e botões de teste.

Actualmente esse painel está orientado principalmente para:

```text
animations.json
= sprites de corpo inteiro
```

O JavaScript de administração também consegue testar as animações hardcoded da cara.

No futuro, o ideal é criar dentro da TAB **Animações** duas áreas muito claras:

```text
EXPRESSÕES DA CARA
------------------
Calmo
Feliz
A pensar
Surpreendido
Confuso
...

ANIMAÇÕES DE CORPO INTEIRO
--------------------------
Andar
Saltar
Atirar coisas
...
```

A interface deve impedir que se confunda uma spritesheet facial com uma de corpo inteiro.

---

# 28. Editor futuro para expressões

Para cada expressão, o painel deveria permitir:

```text
Nome
ID
Spritesheet
Colunas
Linhas
Sequência
Duração de cada frame
Repetições
Frame estático
Gatilhos
Probabilidade
Peso
Cooldown
Prioridade
Activa/desligada
```

Não deve oferecer movimento:

```text
left
right
jump
```

porque uma expressão facial **não desloca o Míu para fora da bolha**.

---

# 29. Ficheiros que provavelmente serão alterados quando implementarmos isto

Não alterar agora. Lista de referência para a futura implementação.

## Novo

```text
site/content/brand/miu/face-animations.json
site/content/brand/miu/faces/
```

## Alterar

```text
site/js/24-miu.js
```

Para:

- deixar de construir as expressões hardcoded;
- carregar a biblioteca facial;
- escolher expressões por trigger;
- implementar prioridades;
- aplicar o estado ao launcher e opcionalmente ao header.

```text
site/bot-api.php
```

Para expor a configuração pública da biblioteca facial.

```text
site/lib/miu-animations.php
```

Pode continuar responsável apenas pelo corpo inteiro, ou ganhar helpers comuns. Se possível, evitar transformar este ficheiro num monólito.

Uma alternativa mais limpa é criar:

```text
site/lib/miu-face-animations.php
```

```text
site/bot.php
site/bot-admin.js
site/bot-admin.css
```

Para editar/testar expressões no painel.

```text
site/css/13-miu.css
```

Provavelmente precisará apenas de pequenas alterações para estados do header ou laboratório. O recorte circular do launcher já serve bem o objectivo.

---

# 30. O que não devemos fazer

## Não substituir a bolha por cada animação

A bolha deve continuar a ser o componente estável.

Só muda a imagem dentro dela.

---

## Não usar GIFs

Spritesheets dão muito mais controlo:

- velocidade;
- sequência;
- interrupção;
- retorno ao idle;
- reduced motion;
- reutilização de frames.

---

## Não pôr dezenas de `<img>` escondidas

Usar uma spritesheet como `background-image` continua a ser uma solução leve e adequada.

---

## Não ligar as emoções directamente ao texto livre da IA

Primeiro usar eventos determinísticos do site.

---

## Não misturar índices de folhas diferentes

O frame `6` de `idle.webp` não tem de significar a mesma coisa que o frame `6` de `happy.webp`.

Cada expressão deve possuir a sua própria sequência e `staticFrame`.

---

## Não deixar animações ambientais interromper reacções importantes

`idle_random` deve perder sempre contra `reply_start`, erro, aviso ou acção directa do utilizador.

---

# 31. Plano de implementação sugerido

## Fase 1 — arquitectura, sem novas imagens

1. Criar schema para `face-animations.json`.
2. Criar loader PHP seguro.
3. Enviar a configuração para o browser.
4. Retirar gradualmente as expressões hardcoded de `24-miu.js`.
5. Manter as sprites actuais como conteúdo inicial.
6. Garantir que visualmente nada muda.

**Resultado:** arquitectura nova com comportamento exactamente igual ao actual.

---

## Fase 2 — motor de estados

1. Adicionar `priority`.
2. Separar `reaction` de `state`.
3. Garantir retorno correcto ao idle.
4. Garantir que `idle_random` não interrompe reacções.
5. Ligar `reply_start` a um estado temporário.
6. Testar reduced motion.

---

## Fase 3 — painel

1. Criar secção “Expressões da cara”.
2. Upload de spritesheet.
3. Preview em círculo real.
4. Editor de sequência e timing.
5. Botões para simular cada gatilho.
6. Possibilidade de activar/desactivar expressão.

---

## Fase 4 — primeiras expressões novas

Produzir uma a uma, começando por:

```text
1. thinking
2. curious
3. surprised
4. happy melhorado
5. worried
6. sorry
7. excited
8. embarrassed
9. cheeky
```

O idle, blink e sleep já têm uma base existente e podem ser aproveitados inicialmente.

---

## Fase 5 — integração com a conversa aberta

1. Guardar estado emocional actual.
2. Aplicá-lo ao avatar do header quando o launcher está escondido.
3. Usar `thinking` durante a espera da resposta.
4. Usar `happy` ou outra reacção após `reply_end`.
5. Manter avatares históricos estáticos.

---

# 32. Critérios de aceitação

A implementação final deve cumprir todos estes pontos:

- [ ] A bolha mantém exactamente a sua estrutura e posição.
- [ ] A cara nunca sai acidentalmente do círculo nas expressões faciais.
- [ ] As expressões não dependem de chamadas à IA.
- [ ] É possível adicionar uma expressão sem editar `24-miu.js`.
- [ ] Cada expressão pode usar a sua própria spritesheet.
- [ ] Cada expressão pode definir sequência e timings próprios.
- [ ] Existe um idle claro para onde o Míu regressa.
- [ ] Reacções importantes interrompem idle/random.
- [ ] Idle/random não interrompe reacções importantes.
- [ ] `prefers-reduced-motion` continua respeitado.
- [ ] Desktop e mobile usam a mesma lógica.
- [ ] O Míu não fica preso numa expressão depois de a animação acabar.
- [ ] O chat aberto não toca animações invisíveis sem utilidade.
- [ ] O header pode futuramente reflectir a emoção actual.
- [ ] Os avatares antigos das mensagens não ficam todos animados.
- [ ] O painel distingue claramente “cara” de “corpo inteiro”.
- [ ] Não é necessário republicar uma mega-spritesheet para adicionar uma expressão.

---

# 33. Resumo da arquitectura pretendida

```text
                    EVENTOS DO SITE
                          │
       ┌──────────────────┼──────────────────┐
       │                  │                  │
  launcher_hover      reply_start       site_warning
       │                  │                  │
       └──────────────────┼──────────────────┘
                          ↓
                 FACE EXPRESSION ENGINE
                          │
             prioridade / cooldown /
             probabilidade / estado
                          │
             ┌────────────┴────────────┐
             ↓                         ↓
       launcher visível            chat aberto
             │                         │
             ↓                         ↓
       cara na bolha            cara no header
             │
             ↓
      spritesheet facial
```

Separadamente:

```text
animations.json
       ↓
Míu de corpo inteiro
       ↓
andar / saltar / etc.
```

Os dois sistemas podem partilhar alguns gatilhos, mas devem continuar conceptualmente separados.

---

# 34. Ponto de partida quando retomarmos este trabalho

Quando a implementação começar, a primeira tarefa **não deve ser gerar novas imagens**.

A primeira tarefa deve ser:

> Transformar as cinco animações faciais actualmente hardcoded em `24-miu.js` numa biblioteca facial externa configurável, mantendo exactamente o mesmo aspecto e comportamento.

Só depois de essa migração estar estável devemos começar a acrescentar novas spritesheets de expressão.

Desta forma conseguimos distinguir facilmente:

```text
bug no motor
```

de:

```text
problema na nova spritesheet
```

E cada nova expressão passa a ser apenas conteúdo acrescentado ao sistema, não uma alteração estrutural ao chatbot.

---

# 35. Estado actual em uma frase

**Hoje o Míu já tem um motor capaz de tocar sprites e já emite quase todos os eventos de que precisamos; o principal trabalho é transformar a pequena biblioteca facial hardcoded numa biblioteca configurável própria e depois alimentá-la com expressões manga novas, sempre dentro da bolha.**
