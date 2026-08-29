# Relatório Técnico: O Míu e o Sistema de Sprites

> **Projeto:** Mia & Paper (`miaandpaper-site`)  
> **Data:** Agosto de 2026  
> **Âmbito:** Assistente virtual Míu, motor de animações no browser, spritesheets de produção, algoritmo de auto-centragem do laboratório 8×8, sistema multi-sheet, animações fluídas contínuas, ferramentas de administração e inventário completo de assets.

---

## 1. Visão Geral e Arquitetura do Míu

O **Míu** é o assistente virtual da Mia & Paper, localizado no canto inferior direito das páginas públicas (catálogo de produtos, configuradores de encomendas e eventos especiais como o Congresso 2026).

```text
               ┌────────────────────────────────────────────────────────┐
               │                     BROWSER                            │
               │  [Botão Lançador / Bolha]  ou  [Janela Aberta de Chat] │
               │  • CSS 13-miu.css (background-position / sizing)       │
               │  • JS 24-miu.js (gatilhos, streaming, filtros)         │
               └───────────────────────────┬────────────────────────────┘
                                           │ POST JSON (bot-api.php)
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │                     BACKEND PHP                        │
               │  • miu-bot.php: Prompt, filtros de abuso e injeção     │
               │  • miu-context.php: Valida produto, passo e preços     │
               │  • miu-stream.php: Streaming SSE ao fornecedor         │
               │  • private/miu.sqlite: Histórico e sessões de runtime  │
               └───────────────────────────┬────────────────────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
          [Respostas Locais / Cache]                     [Fornecedores de IA]
          • miu-quick-replies.json                       • OpenRouter (openrouter/free)
          • erros.json (voz do Míu)                      • Google Gemini REST direto
```

### Pilares Técnicos
* **Leve e Sem Dependências de Frontend:** Implementado em Vanilla JavaScript (`site/js/24-miu.js`) e CSS puro (`site/css/13-miu.css`).
* **Segurança e Privacidade:** Sessões e histórico guardados em base de dados SQLite local (`private/miu.sqlite`). As chaves de API (`openrouter_api_key`, `gemini_api_key`) ficam em `private/miu-config.php` ou variáveis de ambiente, nunca expostas publicamente.
* **Fonte Única da Verdade:** Toda a configuração global (prompts, fornecedor, modelo, rate limits) reside no ficheiro JSON versionado `site/content/miu-defaults.json`.
* **Respostas Rápidas e Erros com a Voz do Míu:** Perguntas frequentes e mensagens de validação de formulários são servidas localmente através de `content/miu-quick-replies.json` e `content/erros.json`.

---

## 2. 🌟 DESTAQUE: Algoritmo Inteligente de Auto-Centragem e Isolamento de Sprites

Um dos maiores desafios técnicos ao usar **spritesheets geradas por Inteligência Artificial** é que as figuras nunca ficam perfeitamente alinhadas numa grelha matemática rígida: algumas poses ficam desenhadas mais à esquerda, outras mais abaixo e as linhas apresentam ondulações (*drift* vertical).

Para resolver isto, foi desenvolvido um algoritmo inteligente de visão computacional,
hoje partilhado em `site/miu-sprite-grid.js` (função `detectConnectedGrid`) e
mantido como fallback histórico em `site/miu-animation-lab.js`, que substitui a
grelha tradicional pelo **"Método dos Autocolantes"**:

### Como Funciona (A Metáfora dos Autocolantes)

```text
       ETAPA 1                    ETAPA 2                    ETAPA 3
 "Varinha Mágica"             "Autocolante"              "Centro Perfeito"
Identifica a tinta         Recorta só o gato            Coloca no meio

     /\_/\                      /\_/\                      ┌─────────────┐
    ( o.o )       ───►         ( o.o )        ───►         │    /\_/\    │
     > ^ <                      > ^ <                      │   ( o.o )   │
                                                           │    > ^ <    │
(Sabe que píxeis          (Não traz fundo nem              └─────────────┘
pertencem a este gato)    pedaços do vizinho)            (Perfeitamente centrado)
```

1. **"Varinha Mágica" Pixel a Pixel (*Connected-Component Labelling*):**
   Em vez de cortar quadrados cegos de $128 \times 128\text{ px}$, o código varre a imagem e agrupa os píxeis contíguos com transparência. Cada pose de gato é identificada como uma "ilha" própria de tinta.
2. **Isolamento Total por Máscara (Nunca Apanha Vizinhos):**
   O algoritmo cria um `<canvas>` independente para cada uma das células e copia **estritamente os píxeis que pertencem ao gato daquela célula**. Mesmo que o gato do lado esteja desenhado quase a tocar-lhe ou com caixas sobrepostas, os píxeis do vizinho são 100% ignorados (ficam transparentes).
3. **Agrupamento de Acessórios Flutuantes:**
   Elementos soltos no ar (como gotas de suor, flores, pontos de interrogação ou Zzz de sono) são detetados por proximidade e anexados automaticamente ao gato dono mais próximo.
4. **Cálculo da Mediana das Linhas e Colunas (Eliminação de *Drift*):**
   O código calcula a **mediana dos centros reais** de todos os gatos da mesma linha e coluna, eliminando qualquer desalinhamento ou inclinação da folha gerada.
5. **Centragem Perfeita no Ecrã (*Anchor Offset*):**
   No momento de renderizar no ecrã (`FullGridSpritePlayer.prototype.render`), o centro anatómico do gato é alinhado com precisão matemática no meio do canvas:
   $$\text{destX} = \frac{\text{canvas.width}}{2} - (\text{cell.anchorX} \times \text{scale})$$
   $$\text{destY} = \frac{\text{canvas.height}}{2} - (\text{cell.anchorY} \times \text{scale})$$

---

## 3. Sistema de Sprites em Produção (Site Público)

O site público utiliza exclusivamente a **cara da gata Lili** enquadrada num recorte circular com balão SVG (`.miu-launcher__bubble-face` com `overflow: hidden; border-radius: 50%`):

```text
┌────────────┬────────────┬────────────┬────────────┐
│ frame 0    │ frame 1    │ frame 2    │ frame 3    │
│ calmo      │ piscar     │ fechado    │ fim piscar │
├────────────┼────────────┼────────────┼────────────┤
│ frame 4    │ frame 5    │ frame 6    │ frame 7    │
│ inclina E  │ inclina D  │ sorriso    │ orelha     │
└────────────┴────────────┴────────────┴────────────┘
```

* **`site/content/brand/miu/miu-sprite.webp` (Normal — 4×2, 192×192 px por frame):**
  * `0`: Calmo / Neutro (900 ms) — pose base de respiração contínua
  * `1`: Piscar início (110 ms)
  * `2`: Piscar fechado (100 ms)
  * `3`: Piscar fim (150 ms)
  * `4`: Inclina esquerda (420 ms)
  * `5`: Inclina direita (420 ms)
  * `6`: Sorriso (320 ms) — reações positivas
  * `7`: Orelha / Twitch (760 ms) — reações espontâneas
* **`site/content/brand/miu/miu-sprite-small.webp` (Ícones Pequenos — 4×2):**
  Variante com traço e contraste reforçados para manter legibilidade em avatares pequenos (ex.: 26 px).
* **`site/content/brand/miu/miu-sprite-sleep.webp` (Sono — 4×1):**
  Sequência de sono com Zzz (`sonolento → dorme-abre → dorme-fecha → dorme-fundo`) ativada após 45 segundos de inatividade (`sleepAfterMs`).

---

## 4. Animações de Corpo Inteiro (Interações Físicas & Alcofinha)

Configuradas em `site/content/brand/miu/animations.json` e geridas no painel `site/bot.php` (separador **Animações**):

* **`site/content/brand/miu/sprites/lili-idle.webp` (`lili-calma`):** Animação base contínua de respiração e piscar.
* **`site/content/brand/miu/sprites/lili-sleep.webp` (`lili-dormir`):** Animação de sono de corpo inteiro.
* **`site/content/brand/miu/sprites/lili-walk.webp` (`lili-andar-esquerda` / `lili-andar-direita`):** Movimento físico de caminhada na página (`motion: left/right`, 72 px).
* **`site/content/brand/miu/sprites/lili-jump.webp` (`lili-saltar`):** Salto vertical animado (34 px) via Web Animations API.
* **`site/content/brand/miu/sprites/lili-knock.webp` (`lili-atirar`):** Animação de atirar objetos ao chão após respostas ou espontaneamente.
* **Modos de Apresentação:** O painel permite alternar entre `launcherMode: circle` (cara na bolha) e `launcherMode: basket` (Míu de corpo inteiro dentro da sua alcofinha).

---

## 5. Laboratório Experimental 8×8, Animações Fluídas e Sistema Multi-Sheet

O laboratório em `site/miu-animation-lab.php` é um ambiente completo de testes e afinação visual:

* **Folhas Integradas no Sistema Multi-Sheet:**
  * **Folha 1 (`S1`):** `miu-fluid-animations-transparent.png` — PNG 32-bit lossless com 8 tiras contínuas de animação e in-betweens passo a passo.
  * **Folha 2 (`S2`):** `ChatGPT Image 19_08_2026, 22_36_20.png` — Spritesheet com 64 poses expressivas.
  * **Folha 3 (`S3`):** `quantity-rig-v4/miu-v4-states-idle-8x8.png` — estados emocionais e micro-idles do Quantity Rig V4.
  * **Folha 4 (`S4`):** `quantity-rig-v4/miu-v4-reactions-rejoice-8x8.png` — reacções por intensidade, descidas e `rejoice` do V4.
  * **Folha 5 (`S5`):** `quantity-rig-v4/miu-v5-idle-attention-8x8.png` — idle vivo, atenção/tracking e recovery do Animation Director V5.
  * **Folha 6 (`S6`):** `quantity-rig-v4/miu-v5-gesture-reactions-8x8.png` — reacções pequenas/médias/grandes ao gesto completo e `rejoice`.
* **Manifesto:** `site/content/brand/miu/experimental/experimental-full-spritesheet-animations_002.json`.
* **Funcionalidades Principais:**
  * **Loop Contínuo Automático (*Showcase*):** Por defeito, o Míu percorre todas as animações sequencialmente, atualizando o nome da animação, o seletor e os timings em tempo real.
  * **Animações Híbridas:** Combina frames da Folha 1 e Folha 2 na mesma história (ex.: *História da Borboleta*, *Momento Doce & Carinho*).
  * **Comparação Lado a Lado:** Permite contrastar em tempo real qualquer animação experimental com a versão de produção do site.
  * **Controlos Sincronizados:** Play, Pause, Replay, Velocidade ($0.25\times$ a $2\times$), Loop Individual, Bounding Box e Grelha na Sheet.

---

## 6. Bibliotecas de Apoio e Expansão

1. **Biblioteca Facial em Alta Resolução (`site/content/brand/miu/faces/`):**
   13 estados emocionais (`idle`, `blink`, `happy`, `excited`, `curious`, `thinking`, `surprised`, `confused`, `embarrassed`, `worried`, `sorry`, `sleepy`, `cheeky`) disponíveis em versões 4×1 (4 frames) e 8×2 (16 frames estendidos).
2. **Coleção Temática (`site/content/brand/miu/miu-banana/`):**
   15 spritesheets de micro-expressões e cenas animadas ricas (`box-peek`, `butterfly-story`, `craft-heart`, `milk-snack`, `sneeze`).
3. **Pasta de Testes Rápidos (`site/content/brand/miu/test-sprites/`):**
   Permite colocar ficheiros `nome-CxL.webp` (ex.: `teste-4x2.webp`) para pré-visualização instantânea no painel de administração sem alterar ficheiros de configuração.

---

## 7. Mecanismo de Renderização e Sistema de Gatilhos

### Renderização Leve no Browser
O motor `site/js/24-miu.js` evita manipulações pesadas do DOM:
1. Aplica a spritesheet inteira como `background-image` no elemento `<span class="miu-face">`.
2. Define `background-size: (colunas * 100)% (linhas * 100)%`.
3. Calcula o deslocamento exato através da fórmula:
   $$X = \frac{\text{coluna}}{\text{colunas} - 1} \times 100\%,\quad Y = \frac{\text{linha}}{\text{linhas} - 1} \times 100\%$$

### Tabela de Gatilhos de Eventos

| Gatilho | Quando é acionado |
|---|---|
| `page_load` / `product_enter` | Carregamento da página ou entrada num produto específico. |
| `launcher_hover` | Passagem do cursor sobre o botão do Míu. |
| `launcher_open` / `launcher_close` | Abertura ou fecho/minimização da janela do chat. |
| `step_change` / `quick_reply` | Mudança de passo no formulário ou seleção de uma resposta rápida. |
| `message_sent` | Envio de uma pergunta pelo cliente. |
| `reply_start` / `reply_end` | Início da preparação da resposta e conclusão do streaming. |
| `conversation_reset` | Início de uma conversa limpa. |
| `idle_random` | Reações ambientais espontâneas baseadas em pesos (`weight`) e probabilidades. |
| `inactivity` | Inatividade prolongada que ativa a animação de sono. |

---

## 8. Painéis de Gestão e Ferramentas

* **`site/bot.php` (Painel Central de Administração):**
  Gestão de conversas, tokens, auditoria de modelos, chaves de IA, base de conhecimento, respostas rápidas por produto/passo e configuração da aparência (pixels do lançador, cabeçalho e mensagens independentes em desktop e mobile).
* **`site/sprites.php` (Editor Visual de Sprites):**
  Ferramenta visual para inspeção frame a frame de todas as animações faciais e de corpo inteiro.
* **`tools/process-miu-sprite.py`:** Script Python de corte, limpeza de fundos e compilação de WebP com qualidade 90.
* **`tools/export-sprites-miu.ps1`:** Script PowerShell para gerar o pacote ZIP de exportação (`miu-sprites-pacote.zip`).
* **`miu-old/`:** Arquivo externo com o código e documentação técnica do protótipo modular descontinuado.

---

## 9. Resumo do Estado Atual

* **Site Público Estável:** O Míu está em produção com a cara da gata **Lili** nas folhas clássicas otimizadas (`miu-sprite.webp`), sem riscos nem erros visuais.
* **Lab Experimental Multi-Sheet:** O laboratório 8×8 (`site/miu-animation-lab.php`) possui o motor multi-sheet ativo, auto-centragem pixel a pixel e ciclo contínuo automático de todas as animações com tiras fluídas.

---

## 10. Levantamento Completo de Ficheiros de Imagem (Assets PNG/WebP)

### 10.1. Cara do Míu no Chat (Site Público / Produção)
> Pasta: `site/content/brand/miu/`

* **Folhas Mestre (Spritesheets Ativas):**
  * `miu-sprite.webp` — WebP · $768 \times 384\text{ px}$ ($319.9\text{ KB}$) · Folha principal 4×2 (8 poses normais da Lili).
  * `miu-sprite-small.webp` — WebP · $768 \times 384\text{ px}$ ($286.5\text{ KB}$) · Folha 4×2 com traço reforçado para avatares pequenos.
  * `miu-sprite-sleep.webp` — WebP · $768 \times 192\text{ px}$ ($158.4\text{ KB}$) · Folha 4×1 com animação de sono e Zzz.
* **Frames Individuais Isoladas ($192 \times 192\text{ px}$):**
  * `miu-01-calmo.webp` a `miu-08-orelha.webp` (8 ficheiros, $\approx 35\text{–}42\text{ KB}$ cada)
  * `miu-small-01-calmo.webp` a `miu-small-08-orelha.webp` (8 ficheiros, $\approx 32\text{–}38\text{ KB}$ cada)
  * `miu-sleep-01-sonolento.webp` a `miu-sleep-04-dorme-fundo.webp` (4 ficheiros, $\approx 40\text{–}41\text{ KB}$ cada)

### 10.2. Míu de Corpo Inteiro (Gata Lili)
> Pasta: `site/content/brand/miu/sprites/`

| Ficheiro | Formato | Dimensões | Tamanho | Descrição |
|---|---|---|---|---|
| `lili-idle.webp` | WebP | $512 \times 256\text{ px}$ | $132.6\text{ KB}$ | Animação contínua de repouso e respiração. |
| `lili-walk.webp` | WebP | $512 \times 256\text{ px}$ | $128.3\text{ KB}$ | Caminhada física na página (deslocação esquerda/direita). |
| `lili-jump.webp` | WebP | $512 \times 256\text{ px}$ | $112.2\text{ KB}$ | Salto vertical animado. |
| `lili-knock.webp` | WebP | $512 \times 256\text{ px}$ | $127.9\text{ KB}$ | Animação de atirar objetos ao chão. |
| `lili-sleep.webp` | WebP | $512 \times 256\text{ px}$ | $119.0\text{ KB}$ | Sono de corpo inteiro dentro da alcofa. |

### 10.3. Laboratório Experimental Multi-Sheet (8×8)
> Pasta: `site/content/brand/miu/experimental/`

| Ficheiro | Formato | Dimensões | Tamanho | Descrição |
|---|---|---|---|---|
| `miu-fluid-animations-transparent.png` | **PNG (32-bit RGBA)** | $1024 \times 1024\text{ px}$ | $2.1\text{ MB}$ | **Folha 1:** 8 tiras contínuas de animação fluída com in-betweens e transparência real lossless. |
| `ChatGPT Image 19_08_2026, 22_36_20.png` | **PNG** | $1024 \times 1024\text{ px}$ | $2.4\text{ MB}$ | **Folha 2:** 64 poses expressivas completas do ChatGPT. |
| `miu-fluid-animations-magenta.jpg` | JPG | $1024 \times 1024\text{ px}$ | $440\text{ KB}$ | Ficheiro bruto gerado com fundo magenta. |
| `miu-16x16-magenta-raw.jpg` | JPG | $1024 \times 1024\text{ px}$ | $520\text{ KB}$ | Ficheiro bruto da grelha de teste 16×16. |
| `quantity-rig-v4/miu-v4-states-idle-8x8.png` | **PNG RGBA** | $1254 \times 1254\text{ px}$ | $\approx 1.9\text{ MB}$ | **Folha 3:** estados e micro-idles do Quantity Rig V4. |
| `quantity-rig-v4/miu-v4-reactions-rejoice-8x8.png` | **PNG RGBA** | $1254 \times 1254\text{ px}$ | $\approx 1.9\text{ MB}$ | **Folha 4:** reacções de quantidade e `rejoice` do V4. |
| `quantity-rig-v4/miu-v5-idle-attention-8x8.png` | **PNG RGBA** | $1254 \times 1254\text{ px}$ | $\approx 2.0\text{ MB}$ | **Folha 5:** idle vivo, atenção e recovery do Animation Director V5. |
| `quantity-rig-v4/miu-v5-gesture-reactions-8x8.png` | **PNG RGBA** | $1254 \times 1254\text{ px}$ | $\approx 2.3\text{ MB}$ | **Folha 6:** reacções por gesto, olhos húmidos e `rejoice` do V5. |

Os seis keyframes usados como âncoras das duas folhas permanecem também nessa
pasta em PNG. Assets novos do Míu nunca são convertidos para WebP: o canal alpha
e a separação das ilhas de píxeis pertencem ao contrato do algoritmo de
auto-centragem. Os WebP históricos de produção não são reconvertidos.

### 10.4. Biblioteca Facial Expandida (13 Expressões Emocionais)
> Pasta: `site/content/brand/miu/faces/` (26 ficheiros WebP)

| Expressão | Versão 4×1 ($768 \times 192\text{ px}$) | Versão Estendida 8×2 ($1536 \times 384\text{ px}$) |
|---|---|---|
| `idle` (repouso) | `idle.webp` ($40.8\text{ KB}$) | `idle-8x2.webp` ($150.3\text{ KB}$) |
| `blink` (piscar) | `blink.webp` ($38.5\text{ KB}$) | `blink-8x2.webp` ($149.2\text{ KB}$) |
| `happy` (feliz) | `happy.webp` ($42.9\text{ KB}$) | `happy-8x2.webp` ($162.7\text{ KB}$) |
| `excited` (entusiasmado) | `excited.webp` ($44.1\text{ KB}$) | `excited-8x2.webp` ($168.1\text{ KB}$) |
| `curious` (curioso) | `curious.webp` ($41.7\text{ KB}$) | `curious-8x2.webp` ($155.9\text{ KB}$) |
| `thinking` (a pensar) | `thinking.webp` ($50.4\text{ KB}$) | `thinking-8x2.webp` ($169.4\text{ KB}$) |
| `confused` (confuso) | `confused.webp` ($48.2\text{ KB}$) | `confused-8x2.webp` ($165.8\text{ KB}$) |
| `surprised` (surpreendido) | `surprised.webp` ($39.9\text{ KB}$) | `surprised-8x2.webp` ($178.3\text{ KB}$) |
| `embarrassed` (envergonhado) | `embarrassed.webp` ($47.1\text{ KB}$) | `embarrassed-8x2.webp` ($170.8\text{ KB}$) |
| `worried` (preocupado) | `worried.webp` ($49.7\text{ KB}$) | `worried-8x2.webp` ($170.0\text{ KB}$) |
| `sorry` (desculpa) | `sorry.webp` ($50.5\text{ KB}$) | `sorry-8x2.webp` ($179.6\text{ KB}$) |
| `sleepy` (sonolento) | `sleepy.webp` ($33.9\text{ KB}$) | `sleepy-8x2.webp` ($127.3\text{ KB}$) |
| `cheeky` (maroto) | `cheeky.webp` ($42.3\text{ KB}$) | `cheeky-8x2.webp` ($163.5\text{ KB}$) |

### 10.5. Coleção Temática & Histórias Ilustradas
> Pasta: `site/content/brand/miu/miu-banana/` (15 ficheiros WebP)

* `butterfly-story.webp` ($1376 \times 768\text{ px}$, $161.0\text{ KB}$) — História completa com a borboleta.
* `butterfly-nose.webp` ($1024 \times 1024\text{ px}$, $95.5\text{ KB}$) — Borboleta pousada no nariz.
* `craft-heart.webp` ($1376 \times 768\text{ px}$, $164.7\text{ KB}$) — Origami de coração de papel.
* `milk-snack.webp` ($1376 \times 768\text{ px}$, $176.5\text{ KB}$) — Pires de leite.
* `box-peek.webp` ($1376 \times 768\text{ px}$, $120.5\text{ KB}$) — A espreitar de dentro de uma caixa.
* `sneeze.webp` ($1376 \times 768\text{ px}$, $156.3\text{ KB}$) — Espirro com flor.
* `idle.webp`, `blink.webp`, `curious.webp`, `excited.webp`, `cheeky.webp`, `confused.webp`, `surprised.webp`, `sorry.webp`, `sleepy.webp` ($\approx 44\text{–}103\text{ KB}$ cada)

### 10.6. Ficheiros Fonte de Alta Resolução
> Pasta: `tools/assets/`

* `miu-sprite-source.webp` ($1774 \times 887\text{ px}$, $1.45\text{ MB}$) — Imagem fonte original em alta resolução da folha normal.
* `miu-sprite-small-source.webp` ($1774 \times 887\text{ px}$, $0.99\text{ MB}$) — Imagem fonte em alta resolução da folha pequena.
* `miu-sprite-sleep-source.webp` ($1774 \times 887\text{ px}$, $0.48\text{ MB}$) — Imagem fonte em alta resolução da folha de sono.

### 10.7. Totais Gerais do Ecossistema Visual
* **Total de ficheiros de imagem:** 79 ficheiros
* **Armazenamento ocupado:** $\approx 14.8\text{ MB}$
