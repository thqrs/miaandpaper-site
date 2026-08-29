# Documentação — Mia & Paper

Numerada como os módulos do site (`site/js/01→24`, `site/css/01→13`). Cada
assunto vive **num** documento: se um facto aparece em dois sítios, um deles
está a ficar desactualizado.

| # | documento | quando ler |
|---|---|---|
| — | [`../AGENTS.md`](../AGENTS.md) | **primeiro**, sempre — as regras e as proibições |
| 01 | [Arquitectura](01-arquitectura.md) | perceber como o site está feito e onde vive cada coisa |
| 02 | [Módulos JS](02-modulos-js.md) | antes de mexer em `site/js/` — mapa dos 24 módulos |
| 03 | [Módulos CSS](03-modulos-css.md) | antes de mexer em `site/css/` — mapa dos 13 módulos, tokens, `modulos.php` |
| 04 | [Preços](04-precos.md) | **antes de tocar em qualquer preço** |
| 05 | [Produto novo](05-produto-novo.md) | checklist completa para acrescentar uma categoria |
| 06 | [Imagens](06-imagens.md) | galeria, multimedia, slots, enquadramento |
| 07 | [Backend](07-backend.md) | encomendas, uploads, tracking, snapshots, base de dados |
| 08 | [Deploy e ambiente](08-deploy-e-ambiente.md) | correr localmente, publicar, SEO |
| 09 | [Pendentes](09-pendentes.md) | o que falta fazer e decidir |
| 10 | [Editores de admin](10-editores-admin.md) | `precos.php` e `homepage-menu-design.php`; a personalização |
| 11 | [Parâmetros de URL](11-parametros-de-url.md) | tudo o que muda numa página através da query string |
| 12 | [Míu](12-miu.md) | chatbot: configuração, fornecedores, filtros, SQLite e painel |
| 13 | [Míu V2 em produção](13-miu-v2-producao.md) | integração reversível, arquivo V1, director, painel e rollback |

## Histórico

- [Auditoria de 2026-08-09 — pontos por resolver](historico/2026-08-09-auditoria-pendentes.md)

[`historico/`](historico/) tem os relatórios datados, tal como foram escritos.
São o registo de como se chegou aqui e o método de verificação — **não** são
estado actual. O que deles continua aberto está em
[09 · Pendentes](09-pendentes.md).

| relatório | o que é |
|---|---|
| [2026-07-31 · Vistoria](historico/2026-07-31-vistoria.md) | auditoria completa: backend, frontend, preços, deploy, peso |
| [2026-07-31 · Design CSS](historico/2026-07-31-design-css.md) | auditoria do CSS e nascimento do `modulos.php` |
| [2026-07-28 · Duplicação de contextos](historico/2026-07-28-duplicacao-contextos.md) | porquê catálogo e cápsula separados |
| [2026-07-28 · Reviews importadas](historico/2026-07-28-reviews-importadas.md) | mapa de origem das reviews de WhatsApp |
| [2026-07-19 · Uniformização do design](historico/2026-07-19-uniformizacao-design.md) | alinhar o site com a homepage |
| [2026-06-11 · Code review](historico/2026-06-11-code-review.md) | revisão inicial, em inglês. Anterior à modularização |

## Fora daqui

- [`site/tools/README-url-cartoes.md`](../site/tools/README-url-cartoes.md) —
  pré-preenchimento do gerador de cartões por URL. Fica junto da ferramenta.
