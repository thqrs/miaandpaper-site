# Duplicação de produtos entre contextos (site principal vs Congresso 2026)

> **Documento histórico — 2026-07-28.** Levantamento; nada foi decidido nem
> alterado por causa dele. Continua a ser a melhor descrição do problema — a
> decisão está listada em [09 · Pendentes](../09-pendentes.md).

Levantamento feito em 2026-07-28. **Nada foi decidido nem alterado** por causa
disto — o ficheiro existe para a decisão ser tomada mais tarde com os factos à
mão.

## O sintoma

Na Teia (`produtos.html`, vista **Teia**) os cadernos aparecem duas vezes:

- `family|principal|cadernos` — "Cadernos · Site principal · 16 produtos"
- `family|congresso-2026|cadernos` — "Cadernos · Congresso 2026 · 16 produtos"

Não é exclusivo dos cadernos. Aparecem 2× também **crachás**, **ímanes** e
**mini-cadernos**. As **molduras** aparecem 1× por não terem versão de congresso.

## A causa

A Teia desenha **um cluster por ficheiro-fonte**. Cada família vem de um JSON:

| Contexto | Ficheiro |
|---|---|
| Site principal | `site/content/products/<slug>.json` |
| Congresso 2026 | `site/congressos/2026/content/products/<slug>.json` |

O que torna isto confuso é a **incoerência entre vistas da mesma página**:

- **Base de dados** funde os registos por contexto — os cadernos são 16 registos,
  cada um com `contexts: ["principal", "congresso-2026"]`.
- **Teia** não funde — são 2 clusters de 16.

O mesmo caderno é 1 registo numa vista e 2 nós na outra.

## O que difere de facto entre as duas cópias dos cadernos

As duas cópias são quase clones: de milhares de folhas de JSON, **só 80 diferem**.

### 1. O interior do caderno usa mecanismos diferentes

| | Principal | Congresso |
|---|---|---|
| `interiorFolder` por capa | 16 | 0 |
| `interiorPreview.drawerImageNames` | 19 | 0 |
| `interiorPreview.images` | — | 19 (partilhadas por todas as capas) |
| `interiorImages` por capa | 0 | 1 — **a própria imagem de capa** |
| Slots na Galeria | 609 | 305 |

No principal cada capa tem o seu interior (16 × 19 = 304 gavetas). No congresso
há um interior único partilhado, e cada capa tem ainda um `interiorImages` com a
sua própria capa lá dentro — que não é interior nenhum. Parece resto de uma
migração a meio.

### 2. Essas imagens são invisíveis nas ferramentas

`MiaGaleriaSlots.collect()` só percorre `steps` e `summaryPlaceholders`;
`interiorPreview` fica de fora e `interiorImages` é ignorado de propósito
(`site/galeria-slots.js`, ~linha 673). No principal isso não se nota porque as
gavetas são geradas à parte a partir do `interiorFolder`. No congresso, como não
há `interiorFolder`, as 19 imagens do interior **não existem** para a Galeria nem
para a Teia: não aparecem, não se substituem, não contam para os finalizados.

### 3. Divergências intencionais

- `homeUrl`: `congressos.html` (principal) vs `index.html` (congresso).
- `preview.enabled` / `preview.text` diferentes.
- Os portes divergiam (5,55 € vs 8,50 €) — **corrigido em 2026-07-28** para
  5,40 € em todos os produtos e nos fallbacks de código.
- O erro de escrita `hologrofico` (caderno-05 e caderno-06 do congresso) —
  **corrigido em 2026-07-28**.

## Caminhos possíveis (por decidir)

1. **Manter as duas cópias.** É o que o flow compartimentalizado do Congresso
   pressupõe. Custo: qualquer alteração de catálogo tem de ser feita duas vezes,
   e as cópias já divergiram sozinhas (portes, typo, interiores).
2. **Fundir os clusters na Teia** e mostrar o contexto como etiqueta dentro de um
   nó só, como já faz a Base de dados. Resolve a confusão visual sem tocar nos
   dados.
3. **Uma fonte só com variações por contexto** (o congresso passaria a herdar do
   principal e a declarar só o que muda: portes, homeUrl, interior). É o único
   caminho que impede a divergência silenciosa, e o mais caro.

Seja qual for o caminho, vale a pena decidir também se o congresso passa a usar
`interiorFolder` (ganha gavetas reais e visibilidade na Galeria) ou se fica com o
interior partilhado — nesse caso o `collect()` tem de aprender a ver o
`interiorPreview.images`.
