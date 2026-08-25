# Arquivo Histórico: Míu Modular (Experimental 001)

> **Data de arquivamento:** Agosto de 2026  
> **Estado:** Arquivado / Inativo  
> **Motivo:** O projeto optou por evoluir a biblioteca de expressões faciais utilizando **spritesheets de frames completos 8×8** (ex.: `ChatGPT Image 19_08_2026, 22_36_20.png`), abandonando a montagem modular por camadas devido à complexidade de alinhamento anatómico e consistência visual entre peças soltas geradas por IA.

---

## 1. O que era o Míu Modular?

O **Míu Modular** foi um protótipo experimental de pesquisa e desenvolvimento cujo objetivo era gerar dezenas de expressões faciais através da **combinação dinâmica de peças anatómicas soltas** em tempo real no browser, em vez de exigir o desenho manual ou geração de uma cara completa para cada pose.

### O Conceito de Camadas (*Layers*)
Em vez de uma imagem única por frame, o renderizador combinava peças transparentes sobrepostas num `<canvas>` na seguinte ordem estrita:

```text
[Fundo]
  1. ears        (Orelhas normais, alertas, inclinadas, twitch)
  2. base        (Cabeça / pelagem neutra ou inclinada sem feições)
  3. eyes        (Olhos abertos, meio-fechados, fechados, a piscar, curiosos)
  4. brows       (Sobrancelhas expressivas)
  5. mouth       (Boca neutra, sorriso ligeiro, sorriso aberto)
  6. whiskers    (Bigodes)
  7. paws        (Patinhas a entrar pela margem inferior)
  8. effects     (Blush, lágrimas, suor, brilhos, Zzz)
  9. props       (Borboleta, novelo, coração de papel, flor)
[Frente]
```

---

## 2. Contrato Técnico das Sheets Modulares

Para que qualquer peça pudesse ser combinada com qualquer outra sem ajustes manuais de posição, foi definido um contrato geométrico rigoroso:

| Propriedade | Valor |
|---|---|
| **Formato** | PNG RGBA com transparência real (alfa de 0 a 255) |
| **Dimensão do Canvas** | $1024 \times 1024\text{ px}$ |
| **Estrutura da Grelha** | 8 colunas $\times$ 8 linhas (64 células no total) |
| **Dimensão da Célula** | $128 \times 128\text{ px}$ |
| **Centro Comum** | Coordenada lógica `[64, 64]` |
| **Margem Interna Mínima** | Pelo menos $2\text{ px}$ transparentes a toda a volta da célula |
| **Âncoras de Alinhamento** | Linha dos olhos: `[64, 64]`, Nariz: `[64, 75]`, Boca: `[64, 88]`, Queixo: `[64, 112]` |

---

## 3. Inventário dos Ficheiros Arquivados

```text
miu-old/
├── README.md                                  # Este documento explicativo
├── site/
│   └── miu-modular-renderer.js                # Classe JS MiuModularRenderer (motor de desenho por canvas)
├── experimental/
│   ├── miu-modular-sheet_001.png              # Atlas 001: pelagens base, olhos, bocas, orelhas, bigodes
│   ├── miu-modular-sheet_001.json             # Mapeamento de coordenadas da Sheet 001
│   ├── miu-modular-sheet_002.png              # Atlas 002: emoções de Ekman, blush, patinhas e adereços
│   ├── miu-modular-sheet_002.json             # Mapeamento de coordenadas da Sheet 002
│   ├── experimental-animations_001.json       # Definição de estados e sequências animadas montadas
│   ├── guia-para-novas-sheets.md              # Guia técnico e prompts de geração de novos atlas
│   ├── experimental.zip                       # Cópia compactada dos assets originais
│   └── experimental-fixed.zip                 # Cópia compactada dos assets com alinhamentos corrigidos
└── tools/
    └── validate-miu-modular-sheet.py          # Script Python para validação automática dos atlas
```

---

## 4. Como estava integrado no código

### O Renderizador (`site/miu-modular-renderer.js`)
O script expunha a classe `globalThis.MiuModularRenderer`, instanciada passando um elemento `<canvas>`:
```javascript
var renderer = new MiuModularRenderer(canvasElement, {
  onRender: function (payload) { /* feedback de frame/layers */ }
});

// Carregava o manifesto principal e as sheets declaradas:
renderer.load("content/brand/miu/experimental/experimental-animations_001.json")
  .then(function () {
    renderer.setAnimation("face-smile", true);
  });
```

### O Laboratório (`site/miu-animation-lab.php`)
No laboratório experimental, o `MiuModularRenderer` renderizava o lado direito de comparação lado-a-lado com as sprites de produção (`miu-sprite.webp`), permitindo inspecionar caixas de colisão (*bounding boxes*), camadas individuais e sequências temporizadas.

### Validação com Python (`tools/validate-miu-modular-sheet.py`)
Antes de serem aceites, as sheets eram testadas contra o validador:
```bash
python tools/validate-miu-modular-sheet.py miu-modular-sheet_001.json miu-modular-sheet_002.json
```
O validador confirmava as dimensões $1024 \times 1024$, formato RGBA, hash SHA-256, ausência de células vazias não declaradas e margens de segurança.

---

## 5. Porque foi arquivado?

1. **Inconsistência Visual nas Fronteiras:** Ao recortar peças de ilustrações geradas por IA, as linhas de contorno e a iluminação nos pontos de contacto (ex.: base da orelha com a cabeça, ou boca com o focinho) apresentavam artefactos e descontinuidades visíveis.
2. **Dificuldade de Alinhamento Sub-pixel:** Uma inclinação ou respiração exigia que todas as peças se movessem em perfeita sincronia; qualquer desvio de 1 ou 2 píxeis fazia o rosto parecer distorcido.
3. **Superioridade do Modelo de Frames Completos:** A abordagem de gerar spritesheets com poses completas (como a grelha $8 \times 8$ com 64 expressões do ChatGPT) garante que cada expressão tem anatomia natural, traço orgânico e iluminação perfeitamente coerente.

---

## 6. Como restaurar no futuro (se necessário)

Se for necessário reativar ou experimentar novamente com o Míu Modular:

1. **Copiar os ficheiros de volta:**
   - Copiar `miu-old/site/miu-modular-renderer.js` para `site/miu-modular-renderer.js`.
   - Copiar o conteúdo de `miu-old/experimental/*` para `site/content/brand/miu/experimental/`.
   - Copiar `miu-old/tools/validate-miu-modular-sheet.py` para `tools/validate-miu-modular-sheet.py`.
2. **Adicionar o script ao HTML:**
   Em `site/miu-animation-lab.php`, voltar a incluir:
   ```html
   <script src="miu-modular-renderer.js" defer></script>
   ```
3. **Instanciar o renderizador:**
   Apontar para `content/brand/miu/experimental/experimental-animations_001.json`.
