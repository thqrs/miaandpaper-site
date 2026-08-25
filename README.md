# Meu JW

## Dummy TV de desenvolvimento

Com o servidor iniciado, abrir no próprio PC:

`http://127.0.0.1:8765/dummy-tv`

A Dummy TV usa screens, pesquisa, tags e áudio reais, mas guarda progresso e favoritos no perfil isolado `dummy`. Consulte `docs/DUMMY_TV.md` para teclado, comando virtual, TTS, logs, recording e limitações.

Esta versão inclui o primeiro fluxo uniforme Home → browser genérico → Player, histórico,
continuar, filtros, favoritos de media/passagem, pesquisa paginada, Biblioteca por tags dummy,
curation e administração local. A biblioteca em `F:\JWTPO` continua estritamente read-only.

Documentação: `docs/SCREEN_MODEL.md`, `docs/RESULT_BROWSER.md`, `docs/TAGS.md`,
`docs/CURATION.md` e `docs/ADMIN.md`.

Media center local e acessível para uma biblioteca JW existente. Esta primeira versão prova o percurso completo:

```text
F:\JWTPO (read-only)
  -> scanner incremental
  -> SQLite próprio
  -> pesquisa ripgrep
  -> FastAPI local
  -> APK Android TV de diagnóstico
```

Durante a utilização normal o servidor não contacta `jw.org` nem necessita de Internet. A Internet é usada apenas uma vez para instalar dependências de desenvolvimento e a toolchain Android.

## Segurança da biblioteca

O scanner usa apenas leitura, `stat` e extração de metadata nos ficheiros em `F:\JWTPO`. Não cria, altera, move ou elimina nada nessa árvore. A base nova fica em `F:\Projects\MeuJW\server\data\meujw.sqlite3` e não são removidos registos quando uma origem desaparece temporariamente.

Os projetos `JWGrep` e `Xiaomi_Adb` são apenas referências de desenvolvimento e não são dependências de runtime.

## Preparação do servidor

Em PowerShell:

```powershell
cd F:\Projects\MeuJW
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
Copy-Item .\config.example.toml .\config.toml
```

Edite `config.toml` apenas se os caminhos ou a porta forem diferentes. Agora que a cópia da biblioteca pode mudar ao longo do tempo, é possível verificar o pareamento transcript ↔ áudio sem escrever no SQLite:

```powershell
.\.venv\Scripts\python.exe -m server.app.cli audit --show-missing 30
```

Depois, para indexar ou atualizar a biblioteca:

```powershell
.\.venv\Scripts\python.exe -m server.app.cli scan
```

O `audit` é read-only. O scan é incremental. Um transcript sem M4A é indexado com `audio_available=false`; um scan posterior deteta automaticamente quando o áudio chega.

## Iniciar o servidor

### Arranque automático recomendado

Execute `Iniciar_MeuJW.bat` na raiz. O launcher pede elevação apenas para manter a regra de
firewall limitada a `LocalSubnet`, deteta os IPs atuais do PC e da Xiaomi, reconecta ADB,
reinicia exclusivamente o servidor Meu JW, configura o URL na TV e confirma `/health`.

Se a descoberta ADB não encontrar a TV, pode indicar o endereço atual:

```powershell
Iniciar_MeuJW.bat 192.168.1.2
```

O servidor fica em segundo plano. Logs e PID ficam em `server\data\logs` e
`server\data\meujw-server.pid`.

### Arranque manual

```powershell
cd F:\Projects\MeuJW
.\.venv\Scripts\python.exe -m server.app.cli serve
```

Por defeito fica disponível em `http://IP_DO_PC:8765`. Verificação local:

```powershell
Invoke-RestMethod http://127.0.0.1:8765/health
```

Endpoints implementados:

```text
GET    /health
GET    /api/home
GET    /api/media/{id}
GET    /api/search?q=...
GET    /api/media/{id}/stream
GET    /api/progress/{id}
PUT    /api/progress/{id}
GET    /api/favorites
POST   /api/favorites/{id}
DELETE /api/favorites/{id}
GET    /api/bookmarks
POST   /api/bookmarks
DELETE /api/bookmarks/{id}
GET    /api/screens/home
GET    /api/screens/history
GET    /api/screens/category/{category}
GET    /api/screens/years/{category}
GET    /api/screens/library
GET    /api/screens/tag/{tag_id}
POST   /api/search/sessions
GET    /api/screens/search/{session_id}
GET    /api/continue
GET    /api/actions/{action_id}
GET    /admin
```

A pesquisa aceita ainda `regex`, `case_sensitive`, `whole_word`, `context_lines` e `limit` como query parameters. O stream suporta pedidos HTTP Range e devolve HTTP 409 quando o áudio ainda não existe.

## Testes

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Todos os testes usam uma biblioteca mínima em diretórios temporários. Nunca usam `F:\JWTPO` como destino de escrita.

## App Android TV

Compatível com Android 9/API 28. A app usa descritores genéricos, SelfVoice durante a sessão,
Media3/ExoPlayer e o guard local já validado. Consulte `android-tv/README.md` para configurar o
URL do PC, compilar e instalar. Não existe PlayerView nem menu lateral.

```powershell
.\tools\bootstrap_android.ps1
.\tools\build_android.ps1
adb connect IP_DA_TV:5555
adb install -r .\android-tv\app\build\outputs\apk\debug\app-debug.apk
adb logcat -s MeuJWKeyInspector:I
```

`bootstrap_android.ps1` descarrega a toolchain oficial, verifica o SHA-256 e apresenta/aceita as licenças Android no contexto da execução pedida. O SDK e os caches ficam ignorados pelo Git dentro do projeto.

## Atualização da Biblioteca JW (Crawler & Downloader PT-TPO)

Para atualizar a biblioteca física em `F:\JWTPO` com novos lançamentos da JW (vídeos, áudios, cânticos e Bíblia completa), está disponível a ferramenta gráfica **JW Library Universal Updater & Organizer**:

### Como Iniciar
Dê duplo clique em **`Iniciar_Atualizador_DB.bat`** na raiz do projeto (ou `Atualização da DB\Iniciar_Atualizador.bat`).

### Funcionalidades e Fontes Suportadas
- **Vídeos (VideoOnDemand):** Catálogo completo da JW em várias resoluções (480p, 720p, 240p).
- **Áudio Geral:** Canções Originais, Cânticos do Reino (Reuniões, Coro, Instrumental), Canções para Crianças, JW Broadcasting em áudio, Bandas Sonoras e Dramas.
- **Bíblia Sagrada em Áudio (NWT):** Acesso direto aos 957 capítulos em MP3 em Português de Portugal (`TPO`).
- **Livros e Publicações em Áudio:** Livro *Seja Feliz Para Sempre* (`lff`), Livro *Dê Testemunho Cabal* (`bt`), ou qualquer código oficial de publicação.

### O Fluxo em 3 Passos
1. **Passo 1: Consultar Catálogo Online:** Consulta a API oficial da JW para o idioma `TPO` e apresenta a grelha completa de conteúdos disponíveis (não descarrega nada neste passo).
2. **Passo 2: Verificar Ficheiros no PC (Deep Scan):** Executa um varrimento recursivo (`os.walk`) na pasta da biblioteca (`F:\JWTPO\DB`), normaliza sufixos `.extracted.m4a` e identifica com precisão o que já existe no computador (`Exists` a verde) vs o que falta descarregar (`MISSING` a vermelho).
3. **Passo 3: Descarregar, Extrair e Organizar:**
   - **Download com proteção:** Descarrega os ficheiros em falta com pausas seguras para não sobrecarregar a CDN.
   - **Extração automática sem perda (FFmpeg Stream Copy):** Para vídeos `.mp4`, extrai a faixa de áudio AAC original para `<nome>.extracted.m4a` a alta velocidade e sem recodificação.
   - **Eliminação do vídeo de origem:** Elimina o ficheiro `.mp4` volumoso após a extração bem-sucedida do áudio para poupar espaço em disco.
   - **Organização canónica:** Distribui automaticamente os ficheiros descarregados nas ~14 pastas temáticas canónicas do Meu JW (ex.: `01. JW Broadcasting`, `06. Bíblia Sagrada em Áudio`, etc.).
   - **Registo em Log (`downloads_log.txt`):** Grava uma lista limpa com um caminho completo por linha para cada novo ficheiro adicionado (acessível pelo botão `[ 📄 Ver Log Downloads ]`).

### Indexação após Atualização
Depois de descarregar novos ficheiros, basta executar o scanner incremental para disponibilizá-los imediatamente na TV:
```powershell
.\.venv\Scripts\python.exe -m server.app.cli scan
```

## Estrutura

```text
Atualização da DB/     Ferramenta gráfica de crawl, download e extração FFmpeg
server/app/library/    scanner read-only e IDs estáveis
server/app/search/     rg --json, timestamps e contexto
server/app/database/   schema e stores SQLite
server/app/playback/   streaming HTTP Range
server/app/api/        schemas da API
server/tests/          fixtures e testes isolados
android-tv/            APK diagnóstico
tools/                 bootstrap, build Android e empacotamento de agente
docs/                  arquitetura e regras de UX
```

## Deliberadamente não implementado

- updater ou qualquer acesso a `jw.org` durante o runtime normal do servidor (a ferramenta de atualização é um utilitário de manutenção separado);
- AssemblyAI, Gemini, OpenRouter ou perguntas sobre conteúdo;
- interpretação de voz, sistema final de microfone ou sincronização online;
- aplicação Android TV final, playback/seek final e menu de opções final;
- suspensão automática do TalkBack (a infraestrutura de recuperação existe, mas a mudança automática está deliberadamente bloqueada até aos testes de segurança);
- VLC, GUI Tkinter ou dependência runtime dos projetos antigos;
- migração das transcrições completas para SQLite FTS.

## Pressupostos desta fase

- `F:\JWTPO\DB` é a raiz dos transcripts e a primeira pasta relativa representa a categoria;
- remover `.transcription.txt` (ou a variante antiga `.transcriptions.txt`) produz o caminho esperado do áudio;
- o nome do ficheiro no campo `URL` de `biblioteca.csv` é a chave mais fiável para associar título e metadata;
- quando o CSV não permite associação, o título deriva do nome do áudio e a data/duração ficam nulas se não forem conhecidas;
- o idioma por defeito da biblioteca é `pt-PT`;
- botões como microfone/assistente podem ser intercetados pelo firmware da TV antes de chegarem a uma Activity Android normal.

## Comandos de voz pelo comando Xiaomi

A primeira integração de voz PC-side está em `server/app/assistant/`. Com as chaves AssemblyAI e OpenRouter configuradas, `Iniciar_MeuJW.bat` passa a ligação ADB já descoberta ao servidor e ativa o fluxo push-to-talk do botão de voz do comando físico.

Fluxo atual: comando Xiaomi → Termux/ADB → AssemblyAI Sync → `openrouter/free` → registry de comandos semânticos → intents/ADB → MeuJW/TV.

Ver `docs/VOICE_ASSISTANT.md` para configuração e diagnóstico local.
