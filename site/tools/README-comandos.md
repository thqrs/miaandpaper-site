# Comandos administrativos por URL

`comando.php` é a porta de administração para links gerados por um LLM. O LLM não edita PHP nem JSON: consulta primeiro o manifesto em `tools/parametros.php?formato=json`, escolhe uma operação e gera o URL.

Só funciona numa sessão de administração. No servidor publicado, as protecções de administração têm de estar activas.

## Como usar

Um comando simples começa por `op`:

```text
comando.php?op=material&nome=%C3%8Dman%2032%20mm&quantidade=500&unidade=un&euros=42.50
```

Os nomes e valores devem ser URL-encoded. Para construir links por código, usar um encoder de query string; não juntar texto à mão.

## Preview e confirmação

Por defeito, abrir o URL não escreve nada. A página mostra, para cada operação:

| Antes | Alteração | Depois |
|---|---|---|
| estado lido agora | campo/ficheiro que muda | estado que será gravado |

O botão **Aplicar** envia um `POST` com o token CSRF da sessão. Só nessa confirmação é que os editores nativos gravam.

Se um comando tiver parâmetros em falta, valores inválidos ou uma operação desconhecida, o lote todo fica bloqueado: não há botão para aplicar metade.

## Valores numéricos

Os números aceitam ponto ou vírgula decimal (`12.50` ou `12,50`), mas não notação exponencial, `INF` nem `NAN`. A validação acontece antes do preview: um link válido mostra exactamente o estado que será gravado.

Os limites principais são: dinheiro entre `0` e `1 000 000` euros (ou `0`–`100000000` cêntimos inteiros), packs inteiros de `1` a `100000`, quantidades de material de `0` a `10000000`, desperdício de `0` a `90`, minutos de `0` a `10000`, descontos de `0` a `99`, e estrelas de `1` a `5`. Os restantes limites específicos — carrosséis, homepage e reviews — estão no manifesto.

## Confirmação

Um URL nunca aplica alterações sozinho. Abre sempre a confirmação; a
gravação só acontece pelo botão, num `POST` protegido pelo token da sessão.

## Batch

Para várias operações, usar `c[índice][campo]`, por ordem de índice. A versão explicitamente encoded usa `%5B` e `%5D`:

```text
comando.php?c%5B0%5D%5Bop%5D=material&c%5B0%5D%5Bnome%5D=Papel%20A4%20300g&c%5B0%5D%5Bquantidade%5D=100&c%5B0%5D%5Bunidade%5D=folhas&c%5B0%5D%5Beuros%5D=18.90&c%5B1%5D%5Bop%5D=material&c%5B1%5D%5Bnome%5D=Argolas%20pretas&c%5B1%5D%5Bquantidade%5D=50&c%5B1%5D%5Bunidade%5D=un&c%5B1%5D%5Beuros%5D=9.50&c%5B2%5D%5Bop%5D=custo-hora&c%5B2%5D%5Beuros%5D=12
```

Há no máximo 40 comandos por URL. Cada linha é analisada sobre o estado que as linhas anteriores deixariam, por isso duas alterações ao mesmo material, preço ou review não se atropelam.

Ao aplicar, os domínios são enviados às APIs existentes. Se uma API falhar depois de outra já ter gravado, `comando.php` faz rollback compensatório dos ficheiros que o batch tocou, desde que não tenham sido alterados por outra sessão entretanto. Se detectar uma alteração concorrente, pára e avisa em vez de apagar trabalho alheio. Isto dá comportamento atómico no uso normal de administração de uma pessoa; uma concorrência real entre duas sessões exige revisão manual.

## Operações disponíveis

O manifesto é a lista canónica, com tipos, obrigatórios, enums, omissões e um exemplo por operação. Resumo por área:

| Área | Operações |
|---|---|
| Preços | `preco`, `ordem-tabs`, `pack-adicionar`, `pack-remover`, `pack-renomear`, `desconto`, `desconto-activo`, `custo`, `valor`, `texto`, `linha-adicionar`, `linha-remover`, `modo`, `variante` |
| Materiais | `material`, `material-apagar`, `custo-hora`, `produto-material`, `produto-material-apagar`, `produto-minutos`, `enviar-para-precos` |
| Imagens | `imagem`, `imagem-concluida` |
| Homepage/menu | `homepage-campo`, `seccao-campo`, `seccao-adicionar`, `seccao-remover`, `ordem-homepage`, `ordem-menu`, `menu-accordion`, `menu-icones` |
| Carrosséis | `carrossel-global`, `carrossel-repor-globais`, `carrossel-cartao`, `carrossel-slide` |
| Reviews | `review`, `review-campo`, `reviews-definicoes`, `review-apagar` |

## Exemplos para um LLM

Alterar um preço existente:

```text
comando.php?op=preco&produto=imanes-loja&chave=3%20mm&qtd=30&euros=60
```

Definir a ordem das tabs do editor de preços (`__capsula__` é o separador da cápsula Congresso):

```text
comando.php?op=ordem-tabs&ordem=imanes-loja%2Cagendas%2C__capsula__
```

Criar um pack, depois definir o desconto da escada activa:

```text
comando.php?c%5B0%5D%5Bop%5D=pack-adicionar&c%5B0%5D%5Bproduto%5D=imanes-recortados&c%5B0%5D%5Bchave%5D=Recortados&c%5B0%5D%5Bqtd%5D=8&c%5B0%5D%5Beuros%5D=18&c%5B1%5D%5Bop%5D=desconto&c%5B1%5D%5Bproduto%5D=imanes-recortados&c%5B1%5D%5Bchave%5D=Recortados&c%5B1%5D%5Bqtd%5D=8&c%5B1%5D%5Bpercent%5D=8
```

Associar um material já existente a um produto e mandar o custo calculado para a tabela correcta:

```text
comando.php?c%5B0%5D%5Bop%5D=produto-material&c%5B0%5D%5Bproduto%5D=imanes-loja&c%5B0%5D%5Bmaterial%5D=%C3%8Dman%2032%20mm&c%5B0%5D%5Brendimento%5D=500&c%5B1%5D%5Bop%5D=enviar-para-precos&c%5B1%5D%5Bproduto%5D=imanes-loja&c%5B1%5D%5Bchave%5D=3%20mm
```

Mudar o título de uma secção e activar os ícones do menu:

```text
comando.php?c%5B0%5D%5Bop%5D=seccao-campo&c%5B0%5D%5Bseccao%5D=novidades&c%5B0%5D%5Bcampo%5D=title&c%5B0%5D%5Bvalor%5D=Chegaram%20agora&c%5B1%5D%5Bop%5D=menu-icones&c%5B1%5D%5Bactivo%5D=1
```

Trocar uma imagem já carregada na galeria:

```text
comando.php?op=imagem&entrada=imanes-loja&trail=steps.0.items.0.image&caminho=content%2Fdesigns%2Floja%2Fimanes-loja%2Fcatalog%2FFotos_dos_Imans%2Fesperanca%2Fesperanca-02.webp
```

Adicionar uma review:

```text
comando.php?op=review&nome=Ana&texto=Ficaram%20mesmo%20bonitos&estrelas=5&data=2026-08-08
```

Alterar um slide de carrossel:

```text
comando.php?op=carrossel-slide&cartao=cadernos-geral&accao=alterar&indice=0&visivel=0
```

## Limites deliberados

Não há comando para uploads binários, envio de e-mails, encomendas de clientes, backups, login/logout, dados de funil ou operações de base de dados. São fluxos com ficheiros locais, informação pessoal, efeitos externos ou credenciais e precisam da interface administrativa própria.

Na comparação das actions mutáveis das APIs cobertas, `ordem-tabs` era a única operação granular que faltava e passou a ter comando. As actions `data`, `load`, `done`, `parametros` e `calcular` são só de leitura; `upload` da galeria e das reviews fica deliberadamente fora por receber ficheiros binários.

Também ficam de fora os `save-catalog`, `save-offers`, `save-product` e `save-home` antigos de `admin-api.php`, bem como o catálogo inteiro de cores: recebem documentos completos ou uma árvore SQLite sem uma operação granular equivalente e seriam fáceis de sobrepor por engano. Usar os editores próprios até existir uma operação específica e validada.

A cápsula `congressos/2026/` é imutável. A action nativa `capsula-sincronizar` de preços não é exposta no registry; nem ela, nem `imagem`, nem outro comando podem alterar a cápsula.
