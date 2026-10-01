# Editor de agendas — especificação

Versão 1 · 30 de Setembro de 2026

Uma ferramenta para a Mia & Paper desenhar agendas com a liberdade do Canva, mas
em que as 150 páginas de uma agenda saem de meia dúzia de moldes. Mudar uma
margem, uma cor, um ano ou uma edição inteira faz-se num sítio e chega a todas
as páginas.

**Versátil por dentro, simples por fora.** O formato dos dados aguenta agendas
diárias, semanais, mensais, semestrais, logbooks, anos civis e lectivos. A
interface mostra só o que se está a usar, e tudo o que existe está à vista:
nada escondido em submenus.

---

## Índice

1. [O problema](#1--o-problema)
2. [Princípios](#2--princípios)
3. [Vocabulário](#3--vocabulário)
4. [Modelo de dados](#4--modelo-de-dados)
5. [O gerador](#5--o-gerador)
6. [Componentes](#6--componentes)
7. [Datas, feriados e eventos](#7--datas-feriados-e-eventos)
8. [Interface](#8--interface)
9. [Biblioteca: fontes, imagens e cores](#9--biblioteca-fontes-imagens-e-cores)
10. [Exportação e imposição](#10--exportação-e-imposição)
11. [Verificador](#11--verificador)
12. [Arquitectura técnica](#12--arquitectura-técnica)
13. [Fases e critérios de aceitação](#13--fases-e-critérios-de-aceitação)
14. [Riscos](#14--riscos)
15. [Decisões em aberto](#15--decisões-em-aberto)
- [Anexo A — Inventário das agendas 2026](#anexo-a--inventário-das-agendas-2026)
- [Anexo B — Ordem da imposição](#anexo-b--ordem-da-imposição)
- [Anexo C — Cálculo dos feriados](#anexo-c--cálculo-dos-feriados)

---

## 1 · O problema

A Miriam faz as agendas no Canva. O Canva é óptimo para acertar *uma* página e
péssimo para *150 páginas que seguem as mesmas regras*: cada página é um desenho
independente, com cada elemento numa coordenada fixa.

O que isto custou em 2026, visto nos ficheiros (ver [Anexo A](#anexo-a--inventário-das-agendas-2026)):

- **Três agendas quase iguais** ("todos", "homem jw", "inglaterra"), de 136 a
  156 páginas cada, editadas página a página. A agenda só ficou à venda depois
  de o ano começar.
- **Mais de mil caixas de texto** só para os números dos dias.
- **Os erros copiam-se entre versões.** "Feveiro" no título de Fevereiro está
  nas três agendas.
- **Restos invisíveis.** Um "29 Segunda-feira / Notas" escondido em todas as
  páginas de semana, copiado de página em página.
- **Imposição à mão.** Para imprimir, as páginas são reordenadas dentro do
  próprio Canva. Depois disso o ficheiro deixa de estar pela ordem de leitura,
  e corrigir alguma coisa passa a ser um problema.
- **Imagens de fundo alinhadas por um script de AutoHotkey**, página a página.

O fluxo de impressão (ET-8550, A4 com 2 páginas A5 por face em duplex, um corte
de guilhotina ao centro, Cinch e argolas) funciona e **não muda**. A ferramenta
substitui só o Canva e a reordenação manual.

---

## 2 · Princípios

1. **Uma página nunca se desenha duas vezes.** O que se repete é um molde; o
   que muda de página para página vem dos dados (datas, cores do mês, frases).
2. **Um só motor de desenho.** O ecrã, as miniaturas e o PDF saem da mesma
   função. O que se vê é o que se imprime.
3. **Tudo à vista.** Sem submenus, sem janelas escondidas, sem menus de
   contexto como único caminho. Seleccionar um elemento mostra todas as suas
   propriedades de uma vez, no painel da direita.
4. **Sem texto explicativo na interface.** Se um controlo precisa de uma frase a
   explicar como funciona, o desenho está errado. Só etiquetas de controlos.
5. **Saber sempre o alcance de uma alteração.** Um aviso fixo por cima da
   página diz se se está a mexer no molde (todas as semanas) ou só nesta
   página.
6. **Nada se perde.** Gravação automática, desfazer ilimitado na sessão e
   versões guardadas no servidor.
7. **Medidas de papel.** Milímetros para posições e tamanhos, pontos para
   letra. Nunca píxeis.
8. **Os dados mandam, não os nomes.** Um comportamento especial é uma
   propriedade no JSON do molde ou da edição, nunca uma lista de ids no código
   (a mesma regra do site, AGENTS.md §1).

---

## 3 · Vocabulário

Estes nomes são usados na interface e no código.

| termo | o que é | exemplo |
|---|---|---|
| **Projecto** | uma família de agendas que partilham moldes | "Agenda Mia & Paper" |
| **Edição** | uma agenda concreta que se exporta: período, tema, conteúdos | "Todos 2027", "Homem TJ 2027", "Fisioterapeuta 2027" |
| **Molde** | o desenho de um tipo de página | "Mês", "Semana", "Apontamentos" |
| **Bloco** | um passo da sequência de páginas | "uma página Mês por cada mês" |
| **Sequência** | a lista de blocos que dá a ordem das páginas | capa → resumo → meses → semanas → notas |
| **Elemento** | uma coisa numa página | texto, forma, imagem, componente |
| **Componente** | um elemento que se desenha a partir dos dados | grelha do mês, linhas de horas |
| **Contexto** | as datas a que uma página ou elemento está ligado | "semana de 5 a 11 Jan 2027" |
| **Tema** | cores, decorações e capa de uma edição | "Meses coloridos", "Ardósia" |
| **Excepção** | uma alteração numa página só, guardada por cima do molde | a semana do Natal com uma ilustração |
| **Biblioteca** | fontes, imagens e cores do projecto | |

---

## 4 · Modelo de dados

Um projecto é **um ficheiro JSON**. As fontes e as imagens ficam em ficheiros à
parte, referidos por id.

### 4.1 Estrutura geral

```json
{
  "versao": 1,
  "id": "mia-agenda",
  "nome": "Agenda Mia & Paper",

  "formato": { ... },
  "biblioteca": { "fontes": { ... }, "imagens": { ... } },
  "estilos": { ... },
  "temas": { ... },
  "moldes": { ... },
  "sequencia": [ ... ],
  "edicoes": { ... },
  "impressao": { ... }
}
```

### 4.2 Formato

```json
"formato": {
  "pagina": { "largura": 148, "altura": 210 },
  "margens": { "topo": 10, "base": 10, "interior": 14, "exterior": 8 },
  "furos": { "lado": "interior", "distancia": 4, "diametro": 5, "mostrar": true },
  "naoImprimivel": 3,
  "primeiraPagina": "direita"
}
```

- Tudo em milímetros.
- `interior` e `exterior` trocam de lado automaticamente entre páginas da
  direita e da esquerda. Numa folha de argolas, a frente (página ímpar) tem os
  furos à esquerda e o verso (página par) à direita.
- `furos` é só uma guia visual para não se pôr nada onde vai haver um buraco.
  Não é impressa.
- `naoImprimivel` é a faixa junto à borda da folha A4 onde a impressora não
  chega. Mede-se uma vez com a folha de teste (§10.4).

### 4.3 Estilos

Os estilos de texto e as cores com nome. Um elemento refere um estilo; mudar o
estilo muda todos os elementos que o usam.

```json
"estilos": {
  "cores": {
    "tinta": "#4a4a4a",
    "tintaSuave": "#8a8a8a",
    "papel": "#ffffff"
  },
  "texto": {
    "tituloMes":   { "fonte": "abril-fatface", "peso": 400, "tamanho": 34, "cor": "@mes.forte", "espacamento": 0 },
    "rotuloDia":   { "fonte": "gochi-hand", "peso": 400, "tamanho": 7, "cor": "tinta", "maiusculas": true, "espacamento": 0.08 },
    "fraseMes":    { "fonte": "caveat", "peso": 400, "tamanho": 10, "cor": "@mes.forte" }
  }
}
```

Uma cor pode ser:

- um nome de `estilos.cores` (`"tinta"`);
- uma cor do contexto: `@mes.forte`, `@mes.claro`, `@mes.fds`, que vêm do tema
  e do mês a que o elemento está ligado;
- um hexadecimal escrito na hora. A interface prefere sempre as cores com nome,
  e o verificador assinala hexadecimais soltos.

Uma cor pode levar intensidade: `{ "cor": "@mes.forte", "intensidade": 0.25 }`
mistura-a com o branco do papel.

### 4.4 Temas

```json
"temas": {
  "meses-coloridos": {
    "meses": [
      { "forte": "#6f86c9", "claro": "#dfe6f7", "fds": "#e6ddf5" },
      { "forte": "#c55be0", "claro": "#f3c9fb", "fds": "#fbdcf6" }
    ],
    "decoracoes": { "folha": "folha-01", "coracoes": "coracoes-02" },
    "capa": { "frente": "img-capa-flores", "verso": "img-verso-flores" }
  },
  "ardosia": {
    "todosOsMeses": { "forte": "#4a5670", "claro": "#e8edf2", "fds": "#d9d6e4" },
    "decoracoes": { "folha": "folha-01", "coracoes": "coracoes-02" },
    "capa": { "frente": "img-pismis24", "verso": "img-pilares" }
  }
}
```

- Um tema tem **12 cores de mês** ou **uma cor para o ano todo**.
- Cada mês tem três tons: `forte` (títulos, círculos), `claro` (caixas),
  `fds` (fim-de-semana). A interface só pede o `forte` e propõe os outros dois
  com intensidades fixas; podem ser acertados à mão.
- `decoracoes` liga nomes usados nos moldes a imagens da biblioteca. O molde diz
  "aqui vai a decoração `folha`"; o tema escolhe qual.

### 4.5 Moldes

```json
"moldes": {
  "mes": {
    "nome": "Mês",
    "paginas": 1,
    "contexto": "mes",
    "espelhar": false,
    "elementos": [
      { "id": "ano", "tipo": "texto", "x": 0, "y": 2, "l": 132, "a": 6,
        "ancora": { "h": "esticar", "v": "topo" },
        "texto": "{periodo.rotulo}", "estilo": "anoPequeno", "alinhar": "centro" },

      { "id": "titulo", "tipo": "texto", "x": 0, "y": 7, "l": 132, "a": 16,
        "ancora": { "h": "esticar", "v": "topo" },
        "texto": "{mes.nome}", "estilo": "tituloMes", "alinhar": "centro" },

      { "id": "grelha", "tipo": "calendario-mes", "x": 0, "y": 26, "l": 132, "a": 164,
        "ancora": { "h": "esticar", "v": "esticar" },
        "semanaComeca": "segunda",
        "linhas": "5-partilhadas",
        "espaco": 2.4,
        "celula": { "cor": "@mes.claro", "corFds": "@mes.fds", "raio": 2.5 },
        "cabecalho": { "formato": "abreviado", "estilo": "rotuloDia" },
        "numero": { "posicao": "topo-centro", "estilo": "numeroDia" },
        "feriado": "circulo",
        "eventos": "texto-na-celula",
        "frase": { "conteudo": "fraseMes", "onde": "maior-espaco-vazio", "estilo": "fraseMes" } },

      { "id": "decoracao-coracoes", "tipo": "imagem", "x": 110, "y": 170, "l": 22, "a": 18,
        "ancora": { "h": "direita", "v": "base" },
        "imagem": "@decoracao.coracoes", "pintar": "@mes.forte" }
    ]
  }
}
```

- `paginas`: 1 ou 2. Um molde de 2 páginas (página dupla) é desenhado como uma
  única área de 2 × largura e cortado ao meio na geração. Um elemento que
  atravesse o meio é assinalado pelo verificador.
- `contexto`: a unidade de tempo que o molde espera receber (`ano`, `mes`,
  `semana`, `dia`, `nenhum`). É o que liga o molde aos blocos que o podem usar.
- `espelhar`: numa página da esquerda, espelha as posições horizontais dos
  elementos (e não só as margens). Útil para moldes com uma coluna "do lado de
  fora".

**Posição.** `x`, `y`, `l` (largura) e `a` (altura) em mm, **medidos a partir
da caixa de conteúdo** (a página menos as margens). Assim, mudar uma margem
reposiciona tudo sem tocar em elemento nenhum.

**Âncoras.** O que acontece a um elemento quando a caixa de conteúdo muda de
tamanho (margens, formato):

| `h` / `v` | comportamento |
|---|---|
| `esquerda` / `topo` | mantém a distância a esse lado |
| `direita` / `base` | mantém a distância ao lado oposto |
| `centro` | mantém-se centrado |
| `esticar` | mantém a distância aos dois lados; muda de tamanho |
| `escala` | posição e tamanho proporcionais |

É isto que permite passar um projecto de A5 para B6 ou A6 sem redesenhar.

**Texto com campos.** `{mes.nome}`, `{dia.numero}`, etc. (lista em §5.4). Na
interface os campos aparecem como etiquetas coloridas dentro do texto, e não
como chavetas.

**Grupos.** Um elemento `grupo` tem `elementos` próprios e pode ter um
contexto: `"liga": { "dia": 2 }` faz com que tudo lá dentro se refira ao
terceiro dia do contexto da página (§5.3).

### 4.6 Sequência

```json
"sequencia": [
  { "id": "rosto",     "molde": "rosto" },
  { "id": "resumo",    "molde": "resumo-ano" },
  { "id": "alvos",     "molde": "alvos" },
  { "id": "biblicos",  "molde": "livros-biblicos", "edicoes": ["homem-tj"] },
  { "id": "calendario","molde": "calendario-anual" },
  { "id": "meses",     "repetir": "mes", "molde": "mes" },
  { "id": "semanas",   "repetir": "semana", "moldes": ["semana", "apontamentos"], "comecaEm": "esquerda" },
  { "id": "notas",     "molde": "notas", "vezes": 4, "completar": 4 }
]
```

| campo | significado |
|---|---|
| `molde` / `moldes` | molde(s) a usar; com vários, cada repetição gera as páginas de todos, por ordem |
| `repetir` | `ano`, `semestre`, `mes`, `semana`, `dia`; sem `repetir`, gera uma vez |
| `vezes` | para moldes sem datas: quantas páginas |
| `edicoes` | só entra nestas edições; sem o campo, entra em todas |
| `comecaEm` | `esquerda` ou `direita`: se a página cair do lado errado, insere uma página de enchimento antes |
| `completar` | acrescenta páginas deste molde até o total ser múltiplo deste número |
| `blocos` | blocos dentro de blocos, para intercalar (ver abaixo) |
| `opcoes` | regras próprias da unidade, ex.: `{ "juntarFimDeSemana": true }` para diárias |

**Intercalar meses e semanas** (a página do mês antes das suas semanas):

```json
{ "id": "ano", "repetir": "mes", "blocos": [
  { "molde": "mes" },
  { "repetir": "semana", "moldes": ["semana", "apontamentos"], "semanaDoMes": "inicio" }
] }
```

`semanaDoMes` decide a que mês pertence uma semana partida: `inicio` (o mês da
segunda-feira), `maioria` (o mês com mais dias) ou `quinta` (o mês da
quinta-feira, como na norma ISO).

### 4.7 Edições

```json
"edicoes": {
  "todos": {
    "nome": "Todos",
    "periodo": { "inicio": "2027-01-01", "fim": "2027-12-31" },
    "tema": "meses-coloridos",
    "feriados": ["pt"],
    "eventos": [],
    "conteudos": {
      "fraseMes": ["Respira, recomeça, continua", "Coragem, segue em frente", "..."]
    },
    "textos": { "rotuloLembretes": "Lembretes importantes" },
    "excepcoes": {}
  },
  "homem-tj": {
    "nome": "Homem TJ",
    "periodo": { "inicio": "2027-01-01", "fim": "2027-12-31" },
    "tema": "ardosia",
    "feriados": ["pt"],
    "eventos": [
      { "data": "2027-03-22", "nome": "Memorial", "estilo": "texto-na-celula" },
      { "de": "2027-07-09", "ate": "2027-07-11", "nome": "Congresso", "estilo": "texto-na-celula" }
    ],
    "conteudos": {
      "fraseMes": ["Jeová vê o teu esforço", "..."],
      "textoSemana": { "2027-01-04": "Salmo 27:4", "2027-01-11": "Provérbios 3:5, 6" }
    },
    "textos": { "rotuloLembretes": "Textos bíblicos que quero memorizar" },
    "excepcoes": {}
  }
}
```

- **`periodo`** define o ano: Jan–Dez, Set–Ago (escolar e ano de serviço TJ),
  18 meses, ou qualquer outro. As semanas estendem-se até à segunda-feira
  anterior ao início e ao domingo posterior ao fim, como a agenda 2026 começa em
  29 Dez 2025.
- **`conteudos`** são listas ligadas a datas: uma frase por mês, um texto por
  semana (chave = segunda-feira da semana), ou uma lista simples que é
  distribuída por ordem.
- **`textos`** são textos fixos que mudam de edição para edição. Um elemento
  usa-os com `{texto.rotuloLembretes}`. Foi assim que a "homem jw" trocou
  "Lembretes importantes" por "Textos bíblicos que quero memorizar", sem ter um
  molde próprio.
- **`excepcoes`**: §4.8.

### 4.8 Excepções

```json
"excepcoes": {
  "semana@2027-12-20": {
    "alterar": { "titulo": { "y": 9 } },
    "ocultar": ["decoracao-folha"],
    "acrescentar": [
      { "id": "x-natal", "tipo": "imagem", "x": 70, "y": 150, "l": 40, "a": 40, "imagem": "ilustracao-inverno" }
    ]
  }
}
```

- A chave é `molde@data`, **nunca o número da página**. Assim a excepção
  sobrevive a acrescentar páginas antes, a mudar o período ou a trocar a ordem
  dos blocos.
- Uma excepção guarda só a diferença. Se o molde mudar, a página muda também e
  mantém a sua diferença.
- Pode existir ao nível do projecto (todas as edições) ou só numa edição. Por
  omissão fica na edição que está aberta.
- Se a data de uma excepção deixar de existir (por exemplo, ao mudar o período),
  ela não se apaga: fica listada no verificador como órfã.

### 4.9 Impressão

```json
"impressao": {
  "folha": { "largura": 297, "altura": 210 },
  "porFace": 2,
  "ordem": "corta-e-empilha",
  "virar": "lado-curto",
  "desvioVerso": { "x": 0, "y": 0 },
  "capa": { "folha": { "largura": 297, "altura": 210 }, "sangria": 3 }
}
```

Os valores de `virar` e `desvioVerso` saem da folha de teste (§10.4) e ficam
guardados.

---

## 5 · O gerador

O gerador transforma **projecto + edição** numa lista de páginas. É uma função
pura: os mesmos dados dão sempre as mesmas páginas.

### 5.1 Passos

1. Calcular o calendário do período: dias, semanas, meses, feriados e eventos
   da edição.
2. Percorrer a sequência. Saltar os blocos cuja `edicoes` não inclui a edição.
3. Para cada bloco, gerar as repetições (um contexto por mês, semana, dia…) e,
   para cada uma, as páginas dos seus moldes.
4. Aplicar `comecaEm`: se uma página cai do lado errado, inserir antes uma
   página do molde de enchimento (por omissão "Apontamentos"; configurável).
5. Aplicar `completar` no fim.
6. Dar a cada página uma **chave estável** (`molde@data`, ou
   `molde#n` para páginas sem data) e aplicar as excepções.
7. Resolver os lados (esquerda/direita) a partir de `formato.primeiraPagina`.

### 5.2 Unidades de repetição

| `repetir` | contexto de cada repetição | usos |
|---|---|---|
| `ano` | o período todo | calendário anual, "6 meses de cada lado", ano em píxeis |
| `semestre` | 6 meses | calendário semestral numa página |
| `mes` | um mês | página mensal, registo de hábitos |
| `semana` | 7 dias (segunda a domingo, ou domingo a sábado) | semana numa página, semana em página dupla |
| `dia` | 1 dia; com `juntarFimDeSemana`, sábado e domingo juntos | agenda diária |

### 5.3 Contexto dentro da página

Os elementos herdam o contexto da página. Um grupo pode mudá-lo com `liga`:

| `liga` | dentro do grupo, o contexto passa a ser | exemplo |
|---|---|---|
| `{ "dia": 0 }` … `{ "dia": 6 }` | o n-ésimo dia da semana da página | a caixa de "quarta-feira" numa semana |
| `{ "mes": 0 }` … `{ "mes": 11 }` | o n-ésimo mês do período | os 12 mini-meses do calendário anual |
| `{ "mes": "+1" }` | o mês seguinte ao da página | um mini-calendário do mês seguinte |

Com isto, a semana da agenda 2026 são **sete grupos "caixa de dia"** colocados
à vontade na página, cada um com `liga: { dia: n }`. O gerador não precisa de
saber que layout é: cada caixa sabe que dia é.

Dentro de um grupo ligado a um dia, `@mes.claro` é **a cor do mês desse dia**.
É isto que pinta sozinho a semana de 30 Nov a 6 Dez com a segunda-feira na cor
de Novembro e o resto na de Dezembro, como a Miriam fez à mão na página 121.

### 5.4 Campos de texto

| campo | exemplo |
|---|---|
| `{periodo.rotulo}` | `2027` ou `2026/27` |
| `{periodo.anterior}` | `2026` (para "Resumo de 2026") |
| `{mes.nome}` · `{mes.abrev}` · `{mes.numero}` | `Fevereiro` · `fev` · `2` |
| `{semana.titulo}` | `Janeiro` ou `Dezembro/Janeiro` |
| `{semana.ano}` | `2027` ou `2026/2027` |
| `{semana.numero}` | `1` … `53` |
| `{dia.numero}` · `{dia.nome}` · `{dia.abrev}` | `5` · `Segunda-feira` · `Seg.` |
| `{dia.evento}` | `Memorial` |
| `{conteudo.<nome>}` | `{conteudo.textoSemana}` → `Salmo 27:4` |
| `{texto.<nome>}` | `{texto.rotuloLembretes}` |

Um campo sem valor (uma semana sem texto) desaparece sem deixar espaço nem
aviso na página; o verificador lista-o.

---

## 6 · Componentes

Elementos que se desenham sozinhos a partir do contexto. Cada um tem todas as
propriedades no painel da direita.

| componente | contexto | propriedades principais |
|---|---|---|
| **calendario-mes** | mês | início da semana, linhas (`auto`, `6`, `5-partilhadas`), espaço entre células, cores das células e do fim-de-semana, raio, formato do cabeçalho, posição do número, dias fora do mês (vazio, cinzento, ocultar), feriado (círculo, cor, negrito), eventos, frase |
| **mini-mes** | mês | o mesmo, compacto, com o título do mês incluído; `destacar`: nenhum, o dia do contexto, ou a semana do contexto (círculo, fundo, sublinhado) |
| **linhas** | nenhum | tipo (pautado, pontilhado, quadriculado, pontos), espaçamento, cor, espessura |
| **linhas-horas** | dia | hora inicial, hora final, intervalo (60/30/15 min), formato (`8h`, `08:00`), meias horas tracejadas, coluna das horas à esquerda ou à direita |
| **tabela** | nenhum | colunas (título e largura relativa), número de linhas ou `encher`, cabeçalho, linhas alternadas |
| **lista** | nenhum | número de itens, marcador (número, caixa, ponto, estrela), linha por baixo |
| **grelha-ano** | ano | dias × meses (o "Ano em píxeis"), rótulos |
| **avaliacao** | nenhum | número de estrelas, rótulos ("Felicidade", "Amor"…) |
| **registo-mes** | mês | uma linha por dia do mês com colunas configuráveis (ex.: horas, estudos), linha de total, caixa de acumulado do ano; para o relatório de pioneiro |

Os componentes com `encher` calculam o número de linhas pela altura disponível,
para nunca ficar meia linha pendurada no fundo.

**Regras que vêm da agenda 2026:**

- `linhas: "5-partilhadas"`: quando o mês precisa de 6 linhas, os dias da sexta
  linha partilham a célula com os da quinta ("23/30"), como em Março e Agosto
  de 2026.
- `frase.onde: "maior-espaco-vazio"`: a frase do mês vai para o maior bloco de
  células vazias, antes do dia 1 ou depois do último dia. É o que a Miriam fez à
  mão (em cima em Janeiro, em baixo em Junho e Setembro). Alternativas: `topo`,
  `base`, `posicao-fixa`.
- `feriado: "circulo"`: o número do dia com um círculo na cor `@mes.forte`, sem
  nome. Serve às edições neutras e TJ sem mudar nada.

Novos componentes são módulos JS com uma função de desenho e uma descrição das
suas propriedades (§12.3). O painel de propriedades é gerado a partir dessa
descrição, por isso um componente novo não precisa de interface própria.

---

## 7 · Datas, feriados e eventos

### 7.1 Feriados

Conjuntos calculados pelo código a partir do ano ([Anexo C](#anexo-c--cálculo-dos-feriados)):

- **`pt`**: os 13 feriados nacionais, incluindo os móveis (Sexta-feira Santa,
  Páscoa, Corpo de Deus).
- **`pt-carnaval`**: Carnaval, à parte, porque é tolerância e não feriado.
- **`gb-eng`**: bank holidays de Inglaterra e País de Gales, se a edição
  "inglaterra" o precisar (decisão em aberto, §15).

Cada feriado tem `nome`, `nomeNeutro` ("Feriado") e `tipo` (`civil` ou
`religioso`). A edição escolhe a apresentação: só o círculo (como em 2026),
nome neutro ou nome completo.

Feriados municipais entram como eventos da edição.

### 7.2 Eventos

Datas escritas à mão na edição: um dia ou um intervalo, um nome e um estilo
(`circulo`, `texto-na-celula`, `faixa`). Aparecem automaticamente em todos os
componentes que mostram esse dia: na grelha do mês, na caixa do dia da semana e
no calendário anual.

A data do Memorial é introduzida à mão todos os anos; não se calcula.

### 7.3 Listas de conteúdo

Frases dos meses e textos das semanas colam-se de uma folha de cálculo. A
interface mostra uma tabela com a data de cada linha ao lado, para se ver logo
se a lista está alinhada com as semanas.

---

## 8 · Interface

### 8.1 Disposição

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Agenda Mia & Paper   [ Todos ][ Homem TJ ][ Fisio ][ + ]   Jan–Dez 2027      │
│                                                   Desfazer Refazer Exportar │
├──────────────┬──────────────────────────────────────────────┬───────────────┤
│ SEQUÊNCIA    │ Texto  Forma  Imagem  Mês  Dia  Linhas  Horas │ PROPRIEDADES  │
│              │ Tabela  Lista                                 │               │
│ ▸ Rosto      ├──────────────────────────────────────────────┤ Posição       │
│ ▸ Resumo     │ ┌ Molde "Semana" · 53 páginas ┐ [Só esta]   │ Tamanho       │
│ ▸ Alvos      │                                              │ Âncoras       │
│ ▸ Meses  ×12 │        ┌──────────┐┌──────────┐              │ Texto         │
│ ▾ Semanas ×53│        │          ││          │              │ Cor           │
│   [][][][]   │        │  página  ││  página  │              │ Dados         │
│   [][][][]   │        │ esquerda ││  direita │              │ Edições       │
│ ▸ Notas   ×4 │        │          ││          │              │               │
│              │        └──────────┘└──────────┘              │               │
│ 136 páginas  │                                              │ CAMADAS       │
│ 34 folhas    │                                     − 100% + │               │
│──────────────│                                              │               │
│ BIBLIOTECA   │                                              │               │
│ Fontes Imag. │                                              │               │
│ Cores        │                                              │               │
└──────────────┴──────────────────────────────────────────────┴───────────────┘
```

- **Topo:** o projecto, as **edições como separadores** (a activa em destaque),
  o período da edição (clicável, abre o seu editor no painel da direita),
  desfazer/refazer e Exportar.
- **Esquerda, em cima: a sequência.** Os blocos, pela ordem, com as miniaturas
  das suas páginas. Arrastar um bloco muda a ordem. Clicar numa miniatura abre
  essa página no centro. O total de páginas e de folhas A4 fica no fundo da
  lista: é informação de impressão (papel e tinta), não um contador.
- **Esquerda, em baixo: a biblioteca** (§9).
- **Centro:** a página ou a página dupla, conforme o bloco. Por cima, a barra de
  inserção com os tipos de elemento como botões grandes, todos visíveis.
- **Direita:** as propriedades do que está seleccionado e, por baixo, as camadas
  da página. Sem nada seleccionado, mostra as propriedades do molde (nome,
  contexto, espelhar) e do formato.

Tema neutro cinzento claro, para que as cores da página se julguem bem. A
página é a protagonista.

### 8.2 Molde ou só esta página

Por cima da página há sempre uma barra com dois botões lado a lado:

```
[ Molde "Semana" · 53 páginas ]  [ Só esta · 5–11 Jan ]
```

- Por omissão está seleccionado o molde. Tudo o que se muda chega às 53 páginas,
  e as miniaturas à esquerda actualizam-se ao vivo.
- Com "Só esta" seleccionado, as alterações ficam como excepção desta página. A
  moldura da página muda de cor, para não haver dúvida.
- Elementos com excepção têm um ponto na lista de camadas e um botão **Repor**
  nas propriedades.

### 8.3 Edições

- Os separadores do topo trocam a edição que se está a ver. A página muda logo:
  cores do tema, frases, eventos.
- Mexer num molde muda-o **em todas as edições** que o usam. Um elemento só de
  uma edição tem, nas propriedades, a secção **Edições** com uma caixa por
  edição ("Aparece em: ☑ Todos ☑ Homem TJ ☐ Fisio"). Sempre visível, não num
  menu.
- `+` cria uma edição nova a partir da activa (copia período, tema e conteúdos).

### 8.4 Sequência

- Cada bloco mostra o seu molde, a repetição e as edições onde aparece.
- Clicar no nome de um bloco mostra as suas opções no painel da direita:
  repetição, moldes, `comecaEm`, `completar`, edições.
- Botão **+ bloco** no fim da lista: escolher um molde existente ou criar um
  novo; a repetição sugere-se a partir do contexto do molde.

### 8.5 Manipulação directa (o que se espera do Canva)

- Arrastar para mover; puxadores para redimensionar; puxador de rotação.
- **Ímanes e guias** para as margens, o centro da página, a zona dos furos e os
  outros elementos, com a distância em mm mostrada enquanto se arrasta.
- Duplo clique num texto para escrever. Os campos inserem-se a partir de uma
  fila de botões que aparece por cima do texto em edição ("Mês", "Ano", "Dia",
  "Frase do mês"…).
- Selecção múltipla com Shift ou com um rectângulo. Com vários seleccionados, o
  painel mostra alinhar e distribuir.
- Guias visíveis por omissão: margens, zona dos furos, zona não imprimível.
  Botões no canto da página para as esconder.

**Teclado:**

| tecla | acção |
|---|---|
| setas / Shift+setas | mover 0,5 mm / 5 mm |
| Ctrl+Z / Ctrl+Y | desfazer / refazer |
| Ctrl+D | duplicar |
| Ctrl+G / Ctrl+Shift+G | agrupar / desagrupar |
| Alt + arrastar | duplicar ao arrastar |
| Delete | apagar |
| Ctrl+roda / Ctrl+0 | zoom / ajustar ao ecrã |
| Esc | sair do texto / limpar a selecção |
| Page Up / Page Down | página anterior / seguinte |

### 8.6 Painel de propriedades

Secções sempre pela mesma ordem; só aparecem as que se aplicam ao elemento.
Nenhuma secção fechada por omissão.

| secção | conteúdo |
|---|---|
| **Posição** | x, y em mm; alinhar à caixa de conteúdo (6 botões) |
| **Tamanho** | largura, altura, rotação, trancar proporção |
| **Âncoras** | um quadrado com os quatro lados clicáveis, como no Figma; não é uma lista |
| **Texto** | estilo (lista com pré-visualização), fonte, tamanho, cor, alinhamento, espaçamento; **Guardar como estilo** |
| **Cor** | amostras das cores com nome e dos tons do mês, intensidade |
| **Imagem** | enquadramento (encher, caber, esticar), zoom, posição, pintar com uma cor, opacidade, resolução efectiva em dpi |
| **Componente** | as propriedades do §6 |
| **Dados** | a ligação do grupo (`liga`), os campos usados |
| **Edições** | onde aparece |

Os números editam-se escrevendo ou arrastando a etiqueta para os lados.

### 8.7 Gravação e versões

- Gravação automática alguns segundos depois da última alteração. Uma marca
  discreta no topo mostra "gravado" ou "a gravar".
- Desfazer ilimitado dentro da sessão.
- O servidor guarda uma versão por cada gravação espaçada de pelo menos 10
  minutos, e todas as do último dia. **Versões** (no painel sem selecção) lista-as
  com data e miniatura, e permite abrir uma para comparar ou repor.
- Exportar e importar o projecto como ficheiro JSON, para cópias de segurança e
  para passar entre computadores.

---

## 9 · Biblioteca: fontes, imagens e cores

### 9.1 Fontes

- **Importar arrastando** ficheiros TTF, OTF, WOFF ou WOFF2 para qualquer parte
  da janela, ou com o botão **+ fonte**.
- Os ficheiros de uma mesma família juntam-se automaticamente (regular, negrito,
  itálico), pelos metadados do ficheiro.
- Cada fonte aparece na lista escrita nela própria.
- As fontes ficam no servidor e são carregadas com a API `FontFace` do browser.
  O Chrome embebe-as no PDF.
- Uma fonte em uso não se apaga; a lista mostra onde é usada.
- **Licenças:** as fontes do Canva não se podem exportar. As fontes usadas em
  2026 têm de vir das fontes originais (muitas serão Google Fonts) e a licença
  tem de permitir embeber em PDF. Ver §14.

### 9.2 Imagens

- **Importar arrastando** PNG, JPG, SVG ou WebP.
- Guardam-se **no original**, sem conversão. É material para impressão, não para
  a web: a regra "WebP sempre" do site não se aplica aqui, e os PNG com
  transparência mantêm-se PNG.
- **Pintar:** uma imagem de uma só cor (as folhas, corações e triângulos das
  agendas 2026) pode ser pintada com qualquer cor, incluindo `@mes.forte`. É
  assim que as decorações acompanham a cor do mês. Funciona em PNG (pela
  transparência) e em SVG.
- Ao colocar uma imagem, as propriedades mostram a **resolução efectiva** no
  tamanho impresso. Abaixo de 200 dpi fica a laranja, e o verificador avisa.
- Etiquetas livres para organizar (decoração, capa, ilustração).

### 9.3 Cores

- As cores com nome do projecto (`estilos.cores`) e os tons dos meses do tema da
  edição activa, em amostras.
- Mudar uma cor com nome muda todos os elementos que a usam.
- **Página de amostras:** um botão gera uma página A4 com as cores da paleta e
  variações de intensidade, para imprimir no papel verdadeiro e escolher pela
  folha e não pelo monitor.

---

## 10 · Exportação e imposição

### 10.1 O painel Exportar

Um painel na coluna da direita (não uma janela por cima):

```
Edição        [ Todos ▾ ]
Miolo         ☑
Capa          ☑
Imposição     ☑  A4 · 2 por face · corta-e-empilha
              [ Verificar ]  3 avisos
              [ Criar PDF ]
Impressora    [ Folha de teste ]
```

**Criar PDF** abre a vista de impressão num separador novo e chama a impressão
do browser. Na janela do Chrome escolhe-se "Guardar como PDF"; o tamanho da
página e as margens vêm do CSS e não precisam de ser acertados.

### 10.2 PDFs gerados

| ficheiro | conteúdo | tamanho de página |
|---|---|---|
| Miolo | as páginas pela ordem de leitura | A5 |
| Miolo imposto | as folhas prontas para o duplex | A4 paisagem |
| Capa | frente e verso lado a lado, com sangria e marcas de corte | A4 |

Com a imposição ligada, o miolo sai **já imposto**. O projecto continua sempre
pela ordem de leitura: a imposição só existe no PDF.

### 10.3 A imposição

Exactamente o fluxo actual: A4 em paisagem, duas páginas A5 por face, duplex,
um corte ao centro, e o monte da esquerda por cima do da direita.

1. Acrescentar páginas em branco até o total ser múltiplo de 4, ou usar o
   `completar` da sequência para as encher com notas.
2. Montar as folhas pela ordem corta-e-empilha ([Anexo B](#anexo-b--ordem-da-imposição)).
3. Rodar e trocar o verso conforme a forma como a impressora vira a folha.
4. Aplicar o desvio do verso, se houver.
5. Marcas de corte opcionais ao centro, fora da área das páginas.

### 10.4 Folha de teste

Imprime-se uma vez com o duplex, e responde a três perguntas:

- **Como vira a folha:** cada face tem setas e números grandes; depois de
  cortar, vê-se se a ordem e a orientação ficaram certas. Se não ficaram, troca-se
  `virar`.
- **Desvio frente/verso:** uma cruz com régua em milímetros nas duas faces;
  segurando a folha contra a luz, lê-se o desvio e escreve-se no painel.
- **Zona não imprimível:** réguas junto às bordas mostram onde a impressora
  deixa de imprimir.

Os valores ficam no projecto (`impressao`) e nunca mais se pensa nisso.

---

## 11 · Verificador

Corre antes de exportar, e a qualquer momento com o botão **Verificar**. Cada
aviso é uma linha clicável que leva à página e selecciona o elemento.

| verificação | nível |
|---|---|
| Texto que não cabe na sua caixa | erro |
| Fonte em falta | erro |
| Elemento na zona dos furos | erro |
| Elemento na zona não imprimível da folha A4 | aviso |
| Elemento fora da margem de segurança | aviso |
| Imagem abaixo de 200 dpi no tamanho impresso | aviso |
| Campo de conteúdo vazio (semana sem texto, mês sem frase) | aviso |
| Excepção órfã (a data já não existe no período) | aviso |
| Elemento a atravessar o meio de uma página dupla | aviso |
| Cor escrita em hexadecimal em vez de cor com nome | informação |
| Páginas com excepções (lista) | informação |

---

## 12 · Arquitectura técnica

### 12.1 Restrições

As mesmas do site (AGENTS.md): HTML, CSS e JavaScript vanilla, PHP sem
dependências, **sem npm, sem build, sem frameworks**. O deploy continua a ser
copiar ficheiros.

### 12.2 Desenho e PDF

- Cada página é um `div` com `width: 148mm; height: 210mm` e os elementos
  posicionados em `mm`. O zoom no ecrã é um `transform: scale()` por cima.
- **Um só desenhador** (`desenhar(pagina, contexto) → DOM`) serve o editor, as
  miniaturas e a impressão.
- O PDF sai da impressão do Chrome (ou Edge, que é Chromium):
  `@page { size: 148mm 210mm; margin: 0 }` para o miolo,
  `@page { size: 297mm 210mm; margin: 0 }` para o imposto,
  `print-color-adjust: exact` para os fundos. Texto vectorial e fontes
  embebidas.
- RGB. A ET-8550 recebe RGB pelo driver; CMYK não traz vantagem neste fluxo.
- Miniaturas: só se desenham as que estão visíveis, e ao mudar um molde só se
  redesenham as páginas que o usam.

### 12.3 Módulos

```
agenda_builder/
  index.html            o editor
  comparar.html         as três direcções lado a lado (paletas e letras)
  api.php               gravar, abrir, versões, carregar fontes e imagens
  router.php            servidor embutido do PHP: estáticos sem cache
  servidor-rede.bat     php -S 0.0.0.0:8090 — abre o editor na rede local
  js/
    01-calendario.js    dias, semanas, meses, períodos; Páscoa; feriados
    02-campos.js        resolver {campos} e cores @mes
    03-decoracoes.js    flores em traço (provisórias)
    04-componentes.js   desenho de cada componente + descrição das propriedades
    05-desenhar.js      página → DOM em mm
    06-gerador.js       sequência + edição → páginas com contexto, chave e excepção
    07-imposicao.js     corta-e-empilha
    08-direccoes.js     modelos de partida (Clássica, Editorial, Botânica), paletas, letras
    09-paginas-prontas.js  o "+ Página nova": dia, semana em 2 páginas com horas, mês,
                        calendário do ano, notas, revisita, estudo, designações
    10-modelo.js        o projecto aberto, desfazer/refazer, gravação automática, API
    11-biblioteca.js    importar fontes (lê o nome e o peso do ficheiro) e imagens
    12-editor.js        palco, selecção, arrastar, redimensionar, ímanes, teclado
    13-controlos.js     números arrastáveis, cores, opções, texto com campos
    14-paineis.js       topo, sequência, biblioteca, propriedades
    15-exportar.js      PDF A5 ou imposto, folha de teste
    16-arranque.js
  css/
    01-paginas.css      páginas e impressão (partilhado)
    02-comparar.css
    03-editor.css
  dados/                os projectos (fora do git)
```

Um elemento pode estar **ligado** a um dia da semana (`liga: { dia: 0…6 }`,
numa página semanal) ou a um mês do período (`liga: { mes: 0…11 }`, no
calendário do ano). O desenhador muda-lhe o contexto antes de o desenhar
(`gerador.contextoLigado`); no painel é a secção «Ligado a».

`?projecto=<id>&pdf=<edição>[&imposto=1][&paginas=a-b]` prepara o PDF sem
abrir a janela de impressão, para o gerar com o Edge ou o Chrome em modo
`--headless --print-to-pdf`.

Cada componente declara as suas propriedades em `04-componentes.js`
(`DESCRICOES`). O painel de propriedades lê essa lista: um componente novo é
desenho + descrição, sem interface própria.

### 12.4 Servidor

- `api.php`: `listar`, `abrir`, `gravar`, `versoes`, `abrir-versao`,
  `carregar`. As escritas exigem o cabeçalho `X-Agendas: 1`.
- Guardado em ficheiros:

```
dados/<projecto>/
  projecto.json
  versoes/<data-hora>.json      no máximo uma a cada 10 minutos, até 300
  fontes/<hash>.<ext>
  imagens/<hash>.<ext>
```

- O JSON é lido sem converter para arrays associativos, para que os objectos
  vazios (`{}`) não voltem como listas (`[]`) e as excepções não se percam.
- Por agora corre no PC, pelo `servidor-rede.bat`. Para passar a página de
  backend do site: incluir `admin-open.php`, `admin-nav.css`/`admin-nav.js`,
  trocar o cabeçalho `X-Agendas` pelo CSRF do site e mudar `dados/` para
  `private/agendas/`.

### 12.5 Testes

O calendário, o gerador e a imposição são funções puras. Um script em Node,
sem dependências, corre-as contra casos conhecidos:

- Páscoa e feriados de 2024 a 2035;
- semanas partidas, anos com 53 semanas, anos bissextos, Set–Ago;
- a sequência da agenda 2026, que tem de dar as mesmas datas que o Canva;
- a ordem de imposição para 4, 8, 136 e 156 páginas.

---

## 13 · Fases e critérios de aceitação

**O calendário manda.** As agendas de 2027 (Jan–Dez) têm de estar à venda
antes de o ano começar, por isso têm de estar prontas lá para Novembro. O editor
visual completo não fica pronto até lá; **o motor pode ficar**. Até o editor
existir, os moldes editam-se no JSON (o Claude pode fazê-lo), com
pré-visualização ao vivo.

### Fase 0 — Prova de impressão

Uma página mensal de 2026 refeita: uma fonte TTF importada, as cores do mês,
uma decoração PNG pintada com a cor do mês, e o PDF imposto impresso na ET-8550.

- O PDF tem o texto vectorial e a fonte embebida.
- A decoração pintada sai nítida no papel.
- Depois da folha de teste, a folha imposta sai certa à primeira: ordem,
  orientação e alinhamento frente/verso.

### Fase 1 — Motor

Modelo, calendário, gerador, desenhador, componentes do mês e da semana,
edições, temas, exportação com imposição. Os moldes da agenda 2026
reconstruídos em JSON.

- A edição "Todos 2026" gerada tem as mesmas datas, os mesmos feriados e as
  mesmas cores por página que o Canva, na ordem de leitura.
- Mudar a margem interior num sítio muda as 136 páginas.
- "Todos 2027" sai de mudar o período.
- "Setembro 2027 – Agosto 2028" sai de mudar o período, com "2027/28" em todo o
  lado.
- A agenda da fisioterapeuta (semana em página dupla com horas) sai de um molde
  novo, e mudar a hora inicial muda as 52 semanas.

### Fase 2 — Editor

Canvas, selecção, arrastar, redimensionar, ímanes, painel de propriedades,
camadas, barra "Molde / Só esta", sequência com miniaturas, importação de
fontes e imagens, gravação automática, versões.

- A Miriam consegue refazer sozinha, sem ajuda, a página de apontamentos a
  partir de uma página vazia.
- Nenhuma função está atrás de um menu ou de um clique direito.

### Fase 3 — Conteúdos

Eventos, listas coladas de uma folha de cálculo, excepções, verificador.

- A edição "Homem TJ" completa: textos semanais, Memorial, assembleia,
  congresso, páginas bíblicas.

### Fase 4 — Mais formatos

Diária (com fim-de-semana junto), semestral, registo de hábitos, logbook com
tabelas e listas, capa com lombada, A6/B6.

---

## 14 · Riscos

| risco | mitigação |
|---|---|
| **Licenças do Canva.** As fontes do Canva não se exportam, e os elementos gráficos do Canva têm uma licença que pode não permitir usá-los fora de um design do Canva. | Usar as fontes originais (verificar a licença de embeber em PDF). Usar arte própria da Miriam, ou elementos de fontes com licença clara. Confirmar a licença antes de migrar decorações. |
| A impressão do Chrome rasteriza alguns efeitos (máscaras usadas para pintar PNG, filtros). | Validar na Fase 0. Se a qualidade não chegar, pintar os PNG num `canvas` a 300 dpi antes de imprimir. |
| Texto que não cabe na caixa passa despercebido. | Verificador (erro). |
| Desempenho com 150+ páginas e muitas imagens. | Miniaturas desenhadas só quando visíveis; imagens reduzidas para o ecrã e originais só na impressão. |
| Perda de trabalho. | Gravação automática, versões no servidor, exportação do JSON. |
| O editor visual atrasa as agendas de 2027. | O motor primeiro (Fases 0–1); moldes em JSON até a Fase 2 estar pronta. |

---

## 15 · Decisões em aberto

1. **Onde vive a ferramenta.** Proposta: página de backend no site
   (`site/agendas.php`), para a Miriam a usar de qualquer computador com o
   trabalho guardado no servidor. Alternativa: ferramenta local em
   `agenda_builder/`, com o PHP a correr no computador dela.
2. **O que distingue a edição "inglaterra".** Feriados ingleses? Língua? Outra
   coisa?
3. **Encomenda da fisioterapeuta:** horário (das 8h às 20h?), linhas de hora ou
   de meia hora, fim-de-semana com ou sem horas, período, formato.
4. **Que edições existem ao todo** (por exemplo "todos", "homem TJ", "mulher
   TJ") e quais se fazem para 2027.
5. **Os textos semanais e as frases** reaproveitam-se de um ano para o outro ou
   são novos?
6. **Fontes usadas em 2026:** quais são e de onde vêm os ficheiros originais.
   Para 2027 a Miriam quer um estilo mais elegante e adulto, sem as letras
   grossas e arredondadas, o que abre a porta a fontes de licença aberta (OFL)
   escolhidas de novo.
7. **Lados das páginas:** confirmar `primeiraPagina` e se a semana fica à
   esquerda e os apontamentos à direita. O ficheiro de 2026 que vi já estava
   imposto, por isso a ordem das páginas não o mostra com certeza.
8. **Edições TJ para 2027:** "publicador" e "pioneiro" em separado? A de
   pioneiro faz mais sentido em Set–Ago, que é o ano de serviço.

---

## Anexo A — Inventário das agendas 2026

Lido no Canva a 30/09/2026. Páginas de 560 × 794 px, isto é, A5.

### "todos oficial agenda 2026" (156 páginas, já imposta à mão)

| molde | notas |
|---|---|
| Rosto | "Agenda 2026", @miaandpaper |
| Resumo do ano anterior | momentos, alvos alcançados, pontuação do ano (6 × 5 estrelas), lições, meditações, experiências |
| Apontamentos adicionais | título + ano; decorações |
| Alvos | alvos pequenos (18), alvos grandes (7), lugares a visitar, lembretes importantes |
| Dados pessoais e contactos de emergência | números de emergência fixos |
| O meu ano em píxeis | 31 × 12, código de cor (8 estados), cor de cada mês |
| Livros que li | estante para colorir, tabela título/início/fim/pontuação |
| Calendário anual | 12 mini-meses, cada um na sua cor, feriados em círculo, fim-de-semana destacado |
| Poupanças | meta, tabela data/descrição/valor, termómetro 0–100 % |
| Mês ×12 | título grande na cor do mês, ano pequeno, grelha 7 × 5 com "23/30" partilhados, fim-de-semana noutro tom, frase do mês nas células vazias |
| Página de frase | texto sobre a família com borboletas |
| Semana ×~54 | página única: segunda a sexta à esquerda, notas + "alegria da semana" + sábado + domingo à direita; título "Mês" ou "Mês/Mês", ano ou "2025/2026"; cores por dia segundo o mês |
| Apontamentos ×~54 | a página em frente a cada semana |
| Stickers e restos | fim do ficheiro, não fazem parte da agenda |

Decorações repetidas (caracol, folha, corações, triângulos) nas mesmas posições,
pintadas com a cor do mês.

### "homem jw oficial agenda 2026" (136 páginas)

A mesma estrutura, com:

- tema fixo azul-ardósia e lavanda, em vez de uma cor por mês;
- capa e contracapa com imagens do James Webb (créditos NASA, ESA, CSA, STScI);
- frases dos meses TJ;
- um texto bíblico por semana, na caixa de quarta-feira;
- eventos escritos na célula: Assembleia (28 Fev), Memorial (Abril), Congresso
  internacional (Julho);
- "Textos bíblicos que quero memorizar" em vez de "Lembretes importantes";
- páginas extra: Livros bíblicos que li (os 66 livros), Relatos bíblicos que
  amei / Textos bíblicos que quero relembrar.

### "Copy of inglaterra oficial agenda 2026" (136 páginas)

Nas páginas vistas é igual à "todos", com os feriados portugueses.

### Sinais do trabalho manual

- "Feveiro" no título de Fevereiro, nas três agendas.
- Um "29 Segunda-feira / Notas" invisível em todas as páginas de semana.
- Na "homem jw", duas semanas de Janeiro seguidas com tons de lavanda diferentes
  na coluna da direita e decorações quase apagadas numa delas.
- Os números dos dias são caixas de texto individuais, mais de mil por agenda.

---

## Anexo B — Ordem da imposição

`N` páginas, completadas até múltiplo de 4. `F = N / 4` folhas. Depois de
imprimir e cortar ao meio, o monte da esquerda (folhas 1…F) vai por cima do
monte da direita.

Para a folha `i` (de 0 a F − 1):

| face | metade esquerda | metade direita |
|---|---|---|
| frente | página `2i + 1` | página `2F + 2i + 1` |
| verso | página `2F + 2i + 2` | página `2i + 2` |

O verso da tabela é para uma impressora que vira a folha pelo lado curto (a
metade esquerda passa para a direita). Se virar pelo lado longo, as duas metades
do verso ficam no mesmo lado da frente e rodadas 180°. A folha de teste decide
qual dos dois casos é o da ET-8550.

Exemplo com 8 páginas (2 folhas):

| folha | frente | verso |
|---|---|---|
| 1 | 1 · 5 | 6 · 2 |
| 2 | 3 · 7 | 8 · 4 |

Monte da esquerda: 1/2, 3/4. Monte da direita: 5/6, 7/8. Esquerda por cima da
direita: 1, 2, 3, 4, 5, 6, 7, 8.

---

## Anexo C — Cálculo dos feriados

**Páscoa:** algoritmo gregoriano anónimo (Meeus/Jones/Butcher), válido para
qualquer ano do calendário gregoriano.

**Feriados nacionais de Portugal:**

| feriado | data |
|---|---|
| Ano Novo | 1 Jan |
| Sexta-feira Santa | Páscoa − 2 |
| Páscoa | domingo de Páscoa |
| Dia da Liberdade | 25 Abr |
| Dia do Trabalhador | 1 Mai |
| Corpo de Deus | Páscoa + 60 |
| Dia de Portugal | 10 Jun |
| Assunção de Nossa Senhora | 15 Ago |
| Implantação da República | 5 Out |
| Todos os Santos | 1 Nov |
| Restauração da Independência | 1 Dez |
| Imaculada Conceição | 8 Dez |
| Natal | 25 Dez |

Opcional: Carnaval (Páscoa − 47), por ser tolerância e não feriado.

**Verificação com 2026:** Páscoa a 5 Abr, Sexta-feira Santa a 3 Abr, Corpo de
Deus a 4 Jun. São exactamente os círculos do calendário anual da agenda 2026.
