# Biblioteca Míu 8×8 · V1

Biblioteca artística experimental para o `Míu Animation Director`. Não é
carregada pelo configurador de produção.

## Contrato invariável

- Toda a arte é gerada **por derivação de**
  `site/content/brand/miu/miu-sprite.webp`, a referência canónica do Míu.
- Cada asset é uma spritesheet exacta de **8 colunas × 8 linhas**.
- Cada célula contém um «autocolante» separado, com margem alpha e sem tocar nos
  vizinhos, para `detectConnectedGrid()` calcular componentes e âncoras.
- Sprites e spritesheets do Míu ficam em **PNG RGBA** e nunca são convertidos
  para WebP.
- O Míu mantém sempre as mesmas manchas, olhos, proporções, orelhas, bigodes e
  acabamento ilustrado. Patinhas e adereços podem entrar quando a acção exige,
  sem redesenhar a personagem.
- Uma ideia especial ocupa uma folha própria. As 64 células detalham essa ideia;
  não servem de depósito para acções sem relação.

## Organização

- `emotions/` — uma folha por emoção base de Ekman, com graus e expressões
  alternativas para impedir reacções mecânicas.
- `stories/` — histórias e acções completas do Míu, normalmente lidas da
  esquerda para a direita e de cima para baixo.
- `props/` — elementos animados independentes, como a borboleta.
- `transitions/` — pontes partilhadas entre idle, atenção, reacção e recovery.
- `products/` — folhas de produto isolado e pequenas histórias de apresentação.
- `fx/` — overlays anime independentes; nunca redesenham a cara do Míu.
- `episodes/` — timelines declarativas da primeira série de histórias.

Cada PNG tem um JSON adjacente com a grelha, âncora canónica, variantes e
sequências sugeridas. `library-manifest.json` agrega apenas os assets realmente
gerados e validados.

## Estado actual

Concluídas e validadas em 28 de Agosto de 2026:

- **7 emoções** inspiradas em Ekman;
- **23 histórias/acções** completas;
- **1 prop** independente, a borboleta;
- **2 transições** partilhadas, cada uma com oito interpretações;
- **2 folhas de produto**, crachás e autocolantes de caretas;
- **6 folhas de FX** para atenção, brilho, olhos húmidos, gota, rubor e impacto.

No total são **41 PNG RGBA**, **2624 frames** e 41 JSON adjacentes. Cada folha
tem 64 células preenchidas. `library-manifest.json` é o inventário consumível e
`generation-queue.json` regista a geração concluída e os candidatos rejeitados.

Existem ainda candidatos inválidos na fila — por exemplo lampião, lápis, washi e
torre de cartões. O manifesto nunca declara folhas que não cumpram 8×8; uma
imagem 7×8 visualmente bonita continua a ser rejeitada.

As histórias estão compostas em **14 episódios executáveis**. O leitor isolado
`site/miu-episodes.php` permite reproduzir cada timeline, esconder props/FX,
activar reduced motion e inspeccionar os beats e âncoras. Não há integração no
configurador de produção.

## Plano artístico

### Emoções de Ekman

1. Alegria
2. Tristeza
3. Raiva
4. Medo
5. Surpresa
6. Nojo
7. Desprezo suave

### Histórias e acções

1. Borboleta e Míu: seguir, pousar no nariz e espirrar
2. Brincar com novelo
3. Coçar atrás da orelha
4. Brincar/trabalhar com tesouras de papel
5. Usar a Cricut
6. Fazer flores de origami
7. Empurrar e estragar uma construção de papel
8. Zoomies / desatar a correr
9. Bocejar
10. Espirrar
11. Ficar enrolado numa fita
12. Esconder-se numa caixa de papel
13. Perseguir um rolo de fita-cola
14. Ficar com um autocolante preso na patinha
15. Fazer e lançar um avião de papel
16. Usar um carimbo artesanal com as patinhas
17. Dobrar um barco de papel e vê-lo deslizar
18. Embrulhar uma pequena caixa e fazer o laço
19. Furador e chuva de confettis
20. Construir e observar um catavento de papel
21. Fazer e usar uma coroa de flores de papel
22. Enrolar lã e descobrir um pompom
23. Dobrar e apresentar um envelope

### Props e produtos

1. Borboleta animada independente
2. Crachá redondo com o Míu a fazer uma careta
3. Autocolantes com 64 caretas do Míu
4. FX anime em folhas autónomas e combináveis

## Prompt e tratamento de imagem

Todas as folhas foram geradas no modo incorporado de geração de imagem, sempre
com `miu-sprite.webp` como autoridade de identidade e com uma folha 8×8 como
referência apenas de composição. O prompt comum está registado em
`generation-queue.json`.

A remoção de fundo foi tentada primeiro no próprio modo de edição de imagem.
Quando esse modo manteve o xadrez opaco ou introduziu ruído, foi aplicada apenas
uma máscara técnica ao fundo ligado às margens. No envelope, uma passagem
semântica separou primeiro o pelo preto do fundo preto; só depois se isolou o
exterior. Não houve redesenho, morph ou alteração deliberada das ilustrações.

## Recriar os metadados

Na raiz do repositório:

```text
node tools/generate-miu-library-v1-metadata.js
```

O script não gera nem altera arte; apenas reconstitui os sidecars JSON, o
manifesto e o registo da fila a partir da lista central de folhas validadas.

Para auditar os ficheiros binários, sidecars e episódios:

```text
powershell -ExecutionPolicy Bypass -File tools/validate-miu-library-v1.ps1
```

Esta validação lê a imagem real: exige 1254×1254, alpha não opaco, conteúdo nas
64 células lógicas, um JSON adjacente coerente, referências de episódios
existentes e zero WebP dentro da biblioteca.
