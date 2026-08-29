# Arquivos protegidos

Esta pasta fica fora de `site/` e, por isso, não é copiada para a raiz pública
pelo deploy normal (`cp -R site/. LIVE_PATH/`). O `.htaccess` acrescenta uma
segunda negação caso alguém publique acidentalmente a raiz inteira do
repositório.

Não guardar aqui chaves, passwords, bases de dados de clientes ou outros
segredos. É um arquivo versionado de código e assets, não um cofre.

O arquivo do Míu anterior à V2 está em
`miu-v1-checkpoint-469d9f2/`. Os ficheiros ainda necessários ao fallback V1
continuam também nos seus caminhos públicos activos; as cópias `.old`, que não
tinham qualquer referência de runtime, foram movidas para
`retired-public-copies/` sem serem apagadas.

`miu-v1-post-checkpoint-files-469d9f2/` preserva cópias redundantes encontradas
durante a reparação idempotente do arquivo. Não faz parte do rollback nem do
manifesto de integridade; existe apenas para que a reparação não apagasse
ficheiros que uma execução anterior tinha copiado para o destino errado.
