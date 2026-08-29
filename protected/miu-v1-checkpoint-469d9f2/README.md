# Míu V1 · checkpoint 469d9f2

Arquivo local protegido criado antes da integração do Míu Animation Director
V2 em produção.

- Origem Git: `469d9f2 checkpoint: estado antes da integração do Míu V2`.
- Reprodução: os ficheiros em `site/` são extraídos do objecto Git desse
  commit, nunca da working tree actual.
- Conteúdo: renderer, CSS, painel/API, bibliotecas PHP, configuração e assets
  visuais do Míu V1.
- Integridade: `MANIFEST.sha256` lista o SHA-256 de todos os ficheiros do
  arquivo, excepto o próprio manifesto.
- Segredos excluídos: não contém `private/`, SQLite, chaves ou configuração de
  fornecedores.
- Ficheiros activos: permanecem também em `site/` porque são o fallback
  operacional e permitem rollback instantâneo sem restaurar ficheiros.
- Ficheiros `.old`: estão em `retired-public-copies/`; saíram da raiz pública,
  mas não foram apagados.

O método preferido de rollback é mudar `engine` para `v1` em `site/miu-v2.php`.
Para reverter o código completo sem reescrever história Git, usar o commit/tag
documentado em `docs/13-miu-v2-producao.md` e `git revert`.
