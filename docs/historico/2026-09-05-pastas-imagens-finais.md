# Pastas de folhetos — imagens finais, 5 de setembro de 2026

Checkpoint local anterior à alteração: `be87665`.

Foram importadas 46 imagens de `argolas/oficiais/finais`: 13 originais A4,
13 originais A6 e 10 variantes por tamanho. Os PNG de origem permanecem
intactos. Conversão com Pillow, redimensionamento Lanczos para 50% da largura
e altura (arredondamento para cima no píxel ímpar), WebP com qualidade 95 e
`method=6`. O HTML da pasta serviu apenas para identificar correspondências.

O [manifesto](2026-09-05-pastas-imagens-finais.json) regista a origem, destino,
dimensões finais e bytes de cada imagem. Os 46 WebP ocupam 4 491 608 bytes.

As capas mantêm IDs, valores e mapas de atribuição A4/A6. Os nomes visíveis
passaram a descrever as fotografias: havia designações antigas trocadas nas
flores, na bicicleta verde e nas malas. Cada capa tem a opção Original e,
quando fornecida, Variante. Os três modelos sem variante são Declara Boas
Novas e as duas versões de Quão Lindos São os Pés. As variantes A6 das duas
malas mostram argolas douradas, apesar de o nome dos PNG referir rosa metálico;
a descrição no site segue a fotografia.

O zoom foi confirmado no DOM real e guardado em `item.imageEdits[editKey]`:
118% no A4 e 132% no A6, com ajuste horizontal de -1 no passo das variantes
A6. Corrigiu-se a precedência CSS que, em administração, impedia as capas de
ocuparem os cartões e cortava as miniaturas de tamanho. O resumo já não soma
o inset genérico de -30% ao zoom. A imagem seleccionada do PACK resolve o item
do tamanho atribuído, e o resumo usa os ajustes da variante seleccionada.

As referências da homepage, do catálogo de encomendas e do produto foram
actualizadas. Os 13 WebP antigos, sem referências activas, foram removidos do
repositório. Numa publicação futura, o deploy por `cp -R` não os apagará do
servidor: a remoção remota continua a ser um passo separado. Não houve deploy.

## Verificação

- JSON de conteúdo válidos; dimensões e formato dos 46 ficheiros confirmados.
- 26 capas, 46 opções e correspondências de tamanho verificadas; preços preservados.
- Renderer real: todas as 46 opções chegam ao resumo correcto; seis capas
  (três por tamanho) seleccionam automaticamente a única original.
- Percursos A4, A6 e PACK verificados no browser; PACK com Original A4 e
  Variante A6, fotografias distintas e ajustes correctos no resumo.
- Enquadramento visto em desktop e telemóvel de 390 px, sem overflow horizontal.
- `produtos.php` abre sem avisos de contrato e apresenta as 46 imagens;
  criação e remoção continuam bloqueadas pela receita.
- Homepage e um produto do Congresso verificados no DOM.
- Sintaxe dos dois módulos JS e da receita PHP validada; SEO regenerado.
- Os 13 snapshots foram recriados em 2026-09-05, às 22:37 UTC.
