# Guia para novas sheets modulares do Míu cara

Este guia define o contrato do protótipo em `content/brand/miu/experimental/`.
Serve para criar novas sheets e respectivos JSON sem alterar o Míu que está em
produção.

## 1. Âmbito visual obrigatório

- O objecto principal é sempre **a cara do Míu actual**.
- Não desenhar o gato inteiro, tronco, cauda ou alcofa.
- Patinhas são permitidas apenas como elementos de enquadramento que entram pela
  margem inferior da célula.
- Adereços pequenos podem aproximar-se ou sobrepor a cara: borboleta, novelo,
  coração de papel, flor, brilhos, lágrimas, suor e sinais gráficos.
- Referências visuais autorizadas:
  - `../miu-sprite.webp`
  - `../miu-sprite-small.webp`
  - `../miu-sprite-sleep.webp`
- Não usar como referência visual qualquer pasta ou ficheiro com `banana`,
  `nano-banana`, `miu-banana`, o gato inteiro ou a alcofa. Podem existir no
  projecto, mas não fazem parte deste sistema visual.

Antes de gerar, abrir as sprites autorizadas e observar a forma da testa, as
manchas preta/laranja/branca, os olhos âmbar, o focinho branco, o nariz rosa, o
contorno e a textura. A peça deve continuar reconhecível a cerca de 100 × 100 px.

## 2. Contrato fixo da imagem

| Propriedade | Valor |
|---|---|
| Formato | PNG RGBA |
| Canvas | 1024 × 1024 px |
| Grelha | 8 colunas × 8 linhas |
| Célula | 128 × 128 px |
| Fundo | alfa real, totalmente transparente |
| Margem mínima | 2 px transparentes em cada lado da célula |
| Coordenadas lógicas | 128 × 128, origem no canto superior esquerdo |
| Centro comum | `[64, 64]` |
| Tamanho final de leitura | aproximadamente 100 × 100 px |

Não desenhar grelha, caixas, molduras, legendas, letras de identificação ou
checkerboard na imagem. O checkerboard que aparece no laboratório é CSS e nunca
faz parte do PNG.

Uma peça não pode tocar nem atravessar a fronteira da célula. O rectângulo de
origem é sempre:

```text
x = coluna * 128
y = linha * 128
largura = 128
altura = 128
```

## 3. Sistema de coordenadas e camadas

Todas as peças têm de encaixar sem correcções específicas por estado. Usar como
âncoras aproximadas:

```json
{
  "crown": [64, 27],
  "eyeLine": [64, 64],
  "nose": [64, 75],
  "mouth": [64, 88],
  "chin": [64, 112],
  "bottomEntry": [64, 127]
}
```

Ordem de desenho suportada pelo renderer:

```json
["ears", "base", "eyes", "brows", "mouth", "whiskers", "paws", "effects", "props"]
```

- `base` é a pelagem da cara sem olhos, boca e orelhas.
- `ears` fica atrás da base.
- `eyes`, `brows`, `mouth` e `whiskers` são feições alinhadas.
- `paws` tapa apenas a zona inferior da cara.
- `effects` contém blush, lágrimas, suor, Z, sinais e brilhos.
- `props` contém borboleta, novelo, coração, flor e objectos equivalentes.

Não criar uma camada `body`. Se uma ideia precisar do corpo completo, pertence a
outro protótipo e não a este.

## 4. Como preparar a geração

Fazer uma geração coerente por sheet, não uma colecção de imagens soltas.
Reservar antecipadamente cada célula e descrever toda a grelha na mesma prompt.
A prompt deve incluir:

1. as três sprites de produção como únicas referências de personagem;
2. `face-only close-up`, `no full body`, `no basket`;
3. canvas conceptual 1024 × 1024 e grelha 8 × 8;
4. uma lista explícita por linha e coluna;
5. alinhamento comum das feições;
6. leitura a 100 px e poucos detalhes minúsculos;
7. fundo transparente real, sem checkerboard, texto ou grelha visível;
8. margem interna em todas as células.

Modelo de prompt para uma sheet de extensão:

```text
Create one coherent modular sprite atlas for the face-only Míu character,
matching exclusively the attached production face sprites. Do not use any other
visual style. Conceptual canvas 1024x1024, exact 8x8 layout, each cell 128x128.
Every module uses the same 128x128 face coordinate system and remains fully
inside its cell with transparent margin. Design for final display around 100px.
[descrever linha 0 ... linha 7 e cada célula]
Transparent RGBA background. No checkerboard, grid, borders, labels or text. No
full cat, torso, tail or basket. Paws, if present, enter only from the bottom and
keep the face as the primary subject.
```

Um resultado de geração pode chegar com 1254 × 1254 ou com checkerboard falso.
Não o publicar assim. É permitido fazer normalização técnica determinística —
remover apenas o fundo ligado às margens, criar alfa real, recortar cada módulo e
reencaixá-lo no atlas exacto — desde que não se redesenhe o estilo nem se alterem
as feições. Guardar sempre o resultado final como 1024 × 1024 RGBA.

## 5. Nomes e numeração

Usar o próximo número com três algarismos:

```text
miu-modular-sheet_003.png
miu-modular-sheet_003.json
```

O identificador interno usa hífen:

```json
"id": "miu-modular-sheet-003"
```

Os nomes completos das peças são compostos pelo grupo e pelo nome da peça, por
exemplo `props.butterflyNose`. Não reutilizar o mesmo nome completo noutro atlas.

## 6. JSON de mapeamento da sheet

Partir deste esqueleto:

```json
{
  "schemaVersion": 1,
  "id": "miu-modular-sheet-003",
  "status": "experimental",
  "name": "Míu cara modular · descrição 003",
  "description": "Objectivo desta extensão facial.",
  "grid": {
    "columns": 8,
    "rows": 8,
    "cellWidth": 128,
    "cellHeight": 128,
    "canvasWidth": 1024,
    "canvasHeight": 1024,
    "minimumCellMarginPx": 2,
    "sourceRectFormula": "x = column * 128; y = row * 128; width = 128; height = 128"
  },
  "coordinateSystem": {
    "logicalWidth": 128,
    "logicalHeight": 128,
    "centre": [64, 64],
    "anchors": {
      "eyeLine": [64, 64],
      "nose": [64, 75],
      "mouth": [64, 88],
      "bottomEntry": [64, 127]
    }
  },
  "layerOrder": ["ears", "base", "eyes", "brows", "mouth", "whiskers", "paws", "effects", "props"],
  "sheets": [
    {
      "id": "extras",
      "file": "miu-modular-sheet_003.png",
      "format": "png",
      "width": 1024,
      "height": 1024,
      "hasRealAlpha": true,
      "sha256": "HASH_SHA256_DO_PNG"
    }
  ],
  "parts": {
    "props": {
      "example": {
        "label": "Descrição legível",
        "sheet": "extras",
        "layer": "props",
        "cell": [0, 0]
      }
    }
  },
  "reservedCells": [[0, 1], [0, 2]],
  "provenance": {
    "visualReference": ["../miu-sprite.webp", "../miu-sprite-small.webp", "../miu-sprite-sleep.webp"],
    "excludedVisualReferences": "Nano Banana, banana, gato inteiro e alcofa.",
    "generation": "Descrever a geração e qualquer normalização técnica.",
    "finalUseSizePx": 100,
    "faceFirstRule": "Sem corpo completo; patinhas apenas pela margem inferior."
  }
}
```

`cell` usa `[linha, coluna]`, ambas entre 0 e 7. Cada célula não vazia deve estar
mapeada uma única vez. Cada célula vazia deve constar de `reservedCells`.

Calcular o hash depois de fechar o PNG:

```powershell
(Get-FileHash -Algorithm SHA256 -LiteralPath 'site\content\brand\miu\experimental\miu-modular-sheet_003.png').Hash.ToLower()
```

## 7. Ligar a sheet às animações

Acrescentar o manifesto a `experimental-animations_001.json`:

```json
"atlases": [
  "miu-modular-sheet_001.json",
  "miu-modular-sheet_002.json",
  "miu-modular-sheet_003.json"
]
```

Um estado monta as peças por camada:

```json
"exampleState": {
  "name": "Exemplo",
  "group": "Interacções cara-first",
  "layers": {
    "ears": "ears.neutral",
    "base": "base.headNeutral",
    "eyes": "eyes.curious",
    "mouth": "mouth.lightSmile",
    "props": "props.example"
  }
}
```

Uma animação referencia estados e pode substituir uma camada numa frame:

```json
{
  "id": "interaction-example",
  "name": "Interacção de exemplo",
  "group": "Interacções cara-first",
  "current": "faceNeutral",
  "loop": true,
  "frames": [
    { "state": "headNeutral", "durationMs": 240 },
    { "state": "exampleState", "durationMs": 800 },
    { "state": "exampleState", "durationMs": 180, "layers": { "eyes": "eyes.closed" } }
  ]
}
```

`current` é apenas a sprite de produção mostrada no lado esquerdo do laboratório.
As novas ideias sem equivalente antigo devem usar `faceNeutral`, `faceSmile` ou
`faceTilt` como comparação aproximada; nunca adicionar uma fonte Banana.

## 8. Validação obrigatória

Executar o validador em todos os manifestos:

```powershell
python tools\validate-miu-modular-sheet.py site\content\brand\miu\experimental\miu-modular-sheet_001.json site\content\brand\miu\experimental\miu-modular-sheet_002.json
```

O validador confirma dimensões, RGBA, alfa real, hash, células mapeadas,
reservadas, não vazias e margem interna. Zero erros é obrigatório.

Depois:

```powershell
node --check site\miu-modular-renderer.js
node --check site\miu-animation-lab.js
php -l site\miu-animation-lab.php
```

Abrir `miu-animation-lab.php`, deixar o JavaScript carregar e testar:

- todas as animações e todos os estados;
- play, pause, replay, loop e velocidade;
- bounding box e contornos de layers;
- grelha sobre ambas as sheets;
- comparação a cerca de 100 px;
- consola do browser sem erros.

## 9. Regra de isolamento

Não substituir nem renomear as sprites em `content/brand/miu/`. Não carregar o
renderer modular noutra página. Durante esta fase, os únicos consumidores são
`miu-animation-lab.php`, `miu-animation-lab.js` e
`miu-modular-renderer.js`. Qualquer promoção para produção é um trabalho futuro,
deliberado e separado.

## Checklist final

- [ ] Cara reconhecível como o Míu actual a 100 × 100 px.
- [ ] Nenhuma referência visual Banana, gato inteiro ou alcofa.
- [ ] PNG 1024 × 1024, modo RGBA, alfa real.
- [ ] Sem checkerboard, grelha, texto ou moldura gravados.
- [ ] Todas as peças alinhadas e dentro da célula com margem mínima de 2 px.
- [ ] Todas as células ocupadas mapeadas; vazias marcadas como reservadas.
- [ ] SHA-256 do manifesto igual ao PNG.
- [ ] Nomes de peças únicos em todos os atlas.
- [ ] Estados e animações passam no renderer.
- [ ] Página pública e renderer actual continuam intactos.
