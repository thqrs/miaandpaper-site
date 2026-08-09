# Auditoria de 2026-08-09 — pontos que ficaram por resolver

Este é o registo dos nove pontos da auditoria que ficaram fora da alteração de
2026-08-09. Mantém a numeração original para ser possível cruzar este documento
com o relatório completo.

Nenhum destes pontos foi corrigido nesta passagem. Os números e tamanhos abaixo
foram confirmados no ambiente local em 2026-08-09, sem abrir ou copiar conteúdo
de clientes.

## 1 · A cápsula congelada de 2026 continua editável

**Gravidade original:** crítica.

`galeria-api.php` continua a apresentar `congresso-2026` como contexto editável
e a função de gravação aceita esse contexto. `precos-api.php` continua a expor a
operação `capsula-sincronizar`, capaz de reescrever
`congressos/2026/content/pricing.json`.

Isto contradiz a regra actual do projecto, segundo a qual tudo dentro de
`site/congressos/2026/` é um snapshot imutável. A documentação de imagens e
preços também continua a descrever essas gravações como comportamento esperado.

**Por que ficou de fora:** o ponto não foi pedido e a correcção exige decidir se
os dois editores devem passar a apresentar a cápsula apenas para leitura ou
deixar de a apresentar. A própria cápsula não foi tocada.

**Próximo passo:** remover todas as operações de escrita sobre o contexto
`congresso-2026`, manter apenas a leitura e acrescentar testes que comparem um
hash da árvore antes e depois de cada operação dos editores.

## 12 · Uploads abandonados e tokens não expiram

**Gravidade original:** alta.

O código declara deliberadamente que não existe expiração automática. No estado
local, `private/order-uploads/tmp/` contém 134 ficheiros — 67 uploads e 67
metadados — com cerca de 17,8 MB; os mais antigos são de 2026-07-27. Enquanto o
metadata existir, o token continua a dar acesso ao ficheiro.

**Por que ficou de fora:** a retenção ilimitada está documentada no próprio
código como decisão do Tiago. Alterá-la apagaria dados de clientes e precisa de
uma política explícita.

**Próximo passo:** decidir uma retenção por estado (por exemplo, abandonado,
associado a encomenda e apagado manualmente), criar um modo de simulação que
liste o que seria removido e só depois automatizar a limpeza.

## 13 · Tracking triplicado e sem retenção

**Gravidade original:** alta.

Cada evento aceite continua a ser gravado no SQLite, num JSONL diário e no
JSONL monolítico legado. No estado local, o SQLite ocupa cerca de 43,7 MB, os
JSONL diários 32,1 MB e o JSONL legado 32,3 MB. Arquivar no SQLite muda os dados
de tabela, mas não os elimina nem define um prazo de retenção.

**Por que ficou de fora:** eliminar uma das cópias ou aplicar retenção pode
quebrar replay, painéis ou recuperação histórica. É uma migração de dados, não
uma correcção segura e isolada.

**Próximo passo:** escolher uma fonte canónica, medir que ferramentas ainda
leem o JSONL legado, documentar retenção e eliminação e preparar uma migração
com backup e verificação de contagens.

## 14 · O log de eventos rejeitados pode encher o disco

**Gravidade original:** alta.

Um evento bloqueado pelo limite deixa de ser duplicado nos JSONL normais, mas
continua a acrescentar uma linha a `order-funnel-skipped-events.jsonl`. O
ficheiro não tem rotação nem limite e contém IP completo, identificador de
sessão e user-agent, apesar do comentário afirmar que não guarda dados pessoais.
No estado local ocupa cerca de 844 KB.

**Por que ficou de fora:** o log serve actualmente de auditoria de abuso. É
preciso decidir que amostra e que campos são realmente necessários antes de o
reduzir ou rodar.

**Próximo passo:** remover ou anonimizar os campos pessoais, agregar contagens
por janela e motivo e impor rotação por tamanho e idade.

## 15 · O painel de funil envia IPs para terceiros

**Gravidade original:** alta.

O enriquecimento do funil envia IPs completos para `ipwho.is` e
`rdap.arin.net`. A resposta externa completa pode ficar em `raw_json` na cache,
sem uma expiração automática. A política de privacidade não descreve esta
transferência.

**Por que ficou de fora:** é uma decisão de privacidade e produto: desligar o
enriquecimento reduz o painel; mantê-lo exige base legal, texto de privacidade,
retenção e avaliação dos fornecedores.

**Próximo passo:** decidir entre desactivar o enriquecimento por defeito ou
formalizar a transferência. Em ambos os casos, definir TTL para a cache e
limitar os campos guardados.

## 22 · Conversões de imagem sem limite de píxeis

**Gravidade original:** média.

Galeria, reviews e editor principal limitam bytes, mas não largura, altura ou
número total de píxeis antes de `imagecreatefromstring()`. Uma imagem muito
comprimida e com dimensões extremas pode esgotar a memória do PHP. No editor
principal, um upload declarado como WebP é copiado directamente sem descodificar
e voltar a validar o conteúdo.

**Por que ficou de fora:** a correcção deve ser comum aos três fluxos e precisa
de limites compatíveis com as imagens de impressão reais. O PHP local também
não tem GD nem Fileinfo, que é o ponto 23.

**Próximo passo:** escolher limites máximos de largura, altura e píxeis, validar
assinatura e dimensões antes da descodificação completa e normalizar WebP pelo
mesmo caminho das restantes imagens.

## 23 · O PHP local não tem extensões exigidas pelo backend

**Gravidade original:** média.

O PHP local tem SQLite, mas continua sem `gd`, `fileinfo`, `mbstring` e `curl`.
Assim, a verificação local não cobre conversões de imagem, detecção MIME,
tratamento Unicode completo ou o mesmo cliente HTTP usado no alojamento.

**Por que ficou de fora:** instalar extensões altera a máquina, não o
repositório, e é preciso confirmar também os módulos disponíveis no cPanel.

**Próximo passo:** instalar/activar as quatro extensões localmente, acrescentar
uma verificação obrigatória ao arranque e ao pré-deploy e comparar a lista com o
PHP de produção.

## 33 · Dados pessoais dentro da árvore de trabalho

**Gravidade original:** média.

`private/` está correctamente ignorada pelo Git, mas fica dentro da pasta do
projecto. No estado local contém 188 ficheiros e cerca de 159,5 MB, incluindo
analytics, IPs, anexos, tokens e bases de dados. Uma cópia ou backup amplo da
pasta do projecto leva estes dados consigo.

**Por que ficou de fora:** mover a pasta exige coordenar scripts locais,
variáveis de ambiente, backups e possivelmente hábitos de trabalho. Um movimento
automático nesta passagem arriscaria perder dados operacionais.

**Próximo passo:** mover os dados para uma pasta privada fora do repositório,
manter apenas `MIAANDPAPER_PRIVATE_DIR` no arranque local e documentar backup,
retenção e restauro.

## 36 · A oferta de PDF tem ligações quebradas

**Gravidade original:** menor/funcionalidade incompleta.

`ofertas/pdf/index.html` continua a incorporar e a oferecer para download
`ofertas/pdfs/pdf-de-oferta.pdf`, que não existe. Também liga para
`lembrancas.html`, que foi removido e só existia como página legada.

**Por que ficou de fora:** falta o PDF final e é necessária uma decisão sobre o
destino da antiga categoria de lembranças; inventar ambos não seria uma
correcção técnica fiel.

**Próximo passo:** fornecer o PDF definitivo e escolher uma página pública de
destino. Até lá, esconder ou desactivar os dois controlos para não apresentar
acções quebradas.

