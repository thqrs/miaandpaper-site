# Míu · Pequenos episódios

Esta pasta compõe as spritesheets da biblioteca em histórias curtas. Continua a
ser uma experiência isolada: nenhum destes ficheiros é carregado pelo
configurador de produção.

O leitor visual está em `site/miu-episodes.php`. Carrega o manifesto, valida as
referências e passa cada PNG pelo mesmo `MiuSpriteGrid.detectConnectedGrid` do
laboratório 8×8. Assim, o storyboard JSON não é apenas documentação: pode ser
reproduzido, percorrido beat a beat e inspeccionado com as âncoras visíveis.

## Modelo de reprodução

```text
idle vivo
  ↓
atenção
  ↓
clips de personagem + props/FX sobrepostos
  ↓
recuperação orgânica
  ↓
idle vivo do contexto actual
```

Um episódio tem prioridade de *one-shot*. Pequenas alterações de quantidade são
guardadas ou suprimidas enquanto decorre; não reiniciam a história a cada evento
do slider. No fim, o director deve consultar novamente o contexto actual em vez
de regressar cegamente ao valor anterior.

## Estrutura

- `episode-manifest.json` lista a temporada e o estado de cada episódio.
- Cada `s01e*.json` contém a timeline declarativa.
- `layer: character` substitui o clip de personagem activo.
- `layer: prop` e `layer: fx` são sobreposições independentes.
- Durante um beat de sobreposição, o último frame da personagem permanece no
  palco; o adereço ou FX nunca substitui nem redesenha a cara.
- `sheet` é um ID de `library-manifest.json`.
- `beat` é o ID de uma linha no JSON adjacente à spritesheet.
- A ordem dos frames dentro de cada beat continua a ser esquerda → direita.

Não existe crossfade facial. Uma mudança de expressão usa outra linha ou outra
folha artística; o motor pode acrescentar apenas movimento secundário, posição,
tilt, squash/stretch subtil e follow-through.

O leitor termina com um `handoff`, não com uma pose permanente: no director
futuro, esse ponto manda retomar o idle vivo para o contexto que existir nesse
momento. Se a quantidade mudou durante a história, não regressa ao contexto
antigo.

## Episódios da temporada 1

1. **A borboleta no nariz** — segue, pousa, espirro e recuperação.
2. **O novelo rebelde** — toque, perseguição, emaranhado e pose orgulhosa.
3. **A flor teimosa** — origami, pequeno erro, descoberta e bouquet.
4. **O crachá da careta** — desenho, montagem e revelação do produto.
5. **A caixa é minha** — exploração, desaparecimento e *pop* surpresa.
6. **A grande corrida** — fita-cola, zoomies, cansaço e loaf.
7. **Chuva de confettis** — furador, esforço, surpresa e brincadeira.
8. **O catavento hipnótico** — construção, toque e rotação mesmerizante.
9. **A encomenda perfeita** — embrulho, fita rebelde e apresentação.
10. **Um dia na oficina** — Cricut, carimbo e pequeno resultado final.
11. **A colecção de caretas** — autocolante na patinha e apresentação da
    família de produtos.
12. **A coroa da oficina** — flores de papel, montagem com as patinhas e um
    orgulho que acaba por aparecer nas bochechas.
13. **O pompom impossível** — enrolar lã, patinha presa, descoberta fofa e
    apresentação do resultado.
14. **A carta sem palavras** — dobrar, vincar, fechar e descobrir um pequeno
    cartão em branco.

Cada episódio recebe ainda duas pontes partilhadas. A abertura escolhe uma das
oito versões de `transition-idle-to-attention`; o fecho escolhe uma das oito
recuperações de `transition-soft-recovery`. A escolha varia com a história — um
espirro não recupera como um esforço cansativo — e evita repetir sempre o mesmo
movimento mecânico.

## Reduced motion

Os episódios não desaparecem. O renderer usa apenas a primeira, a pose central
e a última pose de cada beat, mantém a informação emocional e remove loops
rápidos, bounce e overshoot.

## Folhas ainda pedidas pela narrativa

- `paper-lantern` — composição inicial inválida (7×8), a repetir;
- `rolling-pencil` — composição inicial inválida (7×6), a repetir.
- `washi-tape` — composição inicial inválida (6×7), a repetir;
- `paper-card-tower` — composição inicial inválida (6×7), a repetir.

As folhas só entram no manifesto depois de cumprirem 8×8, PNG RGBA, alpha real
e 64 células não vazias.
