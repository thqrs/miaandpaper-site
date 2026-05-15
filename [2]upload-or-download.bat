@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

REM ==========================================================
REM Mia & Paper - escolher autoridade
REM
REM Pergunta:
REM   Qual ganha?
REM
REM Respostas:
REM   local  = PC -> GitHub -> cPanel
REM            O que esta no PC ganha.
REM            Alteracoes feitas no admin/cPanel podem ser perdidas.
REM
REM   cpanel = cPanel -> PC
REM            Faz backup da pasta site local.
REM            Depois copia o site live do cPanel e espelha para a pasta site no PC.
REM            Nao faz commit, push, nem deploy.
REM ==========================================================

set "REPO=C:\Users\Tiago Henriques\Documents\Projects\miaandpaper-site"
set "SITE=%REPO%\site"
set "SSH_KEY=C:\Users\Tiago Henriques\.ssh\miaandpaper_cpanel"
set "KNOWN_HOSTS=C:\tmp\miaandpaper_known_hosts"
set "SSH_USER=currwkdi"
set "SSH_HOST=198.54.115.179"
set "SSH_PORT=21098"
set "SERVER_REPO=/home/currwkdi/repositories/miaandpaper-site"
set "LIVE_PATH=/home/currwkdi/miaandpaper.com"
set "SYNC_FLAG=/home/currwkdi/private/miaandpaper-admin-sync-needed.json"

if exist "C:\Windows\System32\OpenSSH\ssh.exe" (
    set "SSH=C:\Windows\System32\OpenSSH\ssh.exe"
) else if exist "C:\Windows\Sysnative\OpenSSH\ssh.exe" (
    set "SSH=C:\Windows\Sysnative\OpenSSH\ssh.exe"
) else (
    echo ERRO: Nao encontrei o ssh.exe do Windows.
    pause
    exit /b 1
)

if exist "C:\Windows\System32\OpenSSH\scp.exe" (
    set "SCP=C:\Windows\System32\OpenSSH\scp.exe"
) else if exist "C:\Windows\Sysnative\OpenSSH\scp.exe" (
    set "SCP=C:\Windows\Sysnative\OpenSSH\scp.exe"
) else (
    echo ERRO: Nao encontrei o scp.exe do Windows.
    pause
    exit /b 1
)

if exist "C:\Windows\System32\tar.exe" (
    set "TAR=C:\Windows\System32\tar.exe"
) else if exist "C:\Windows\Sysnative\tar.exe" (
    set "TAR=C:\Windows\Sysnative\tar.exe"
) else (
    for /f "delims=" %%T in ('where tar 2^>nul') do (
        if not defined TAR set "TAR=%%T"
    )
)

if not exist "%REPO%" (
    echo ERRO: Nao encontrei o repo:
    echo %REPO%
    pause
    exit /b 1
)

if not exist "%SITE%" (
    echo ERRO: Nao encontrei a pasta site:
    echo %SITE%
    pause
    exit /b 1
)

if not exist "%SSH_KEY%" (
    echo ERRO: Nao encontrei a chave SSH:
    echo %SSH_KEY%
    pause
    exit /b 1
)

if not exist "C:\tmp" mkdir "C:\tmp"

cd /d "%REPO%"
if errorlevel 1 (
    echo ERRO: Falhou ao entrar no repo.
    pause
    exit /b 1
)

echo.
echo ==========================================================
echo Qual ganha?
echo ==========================================================
echo.
echo   local  = o que esta no PC ganha
echo            PC ^> GitHub ^> cPanel
echo            AVISO: pode apagar alteracoes feitas pelo admin no cPanel
echo.
echo   cpanel = o que esta no cPanel/admin ganha
echo            cPanel ^> PC
echo            faz backup local
echo            nao faz commit, push, nem deploy
echo.
set /p AUTHORITY="Escreve local ou cpanel: "

if /I "!AUTHORITY!"=="local" goto LOCAL_WINS
if /I "!AUTHORITY!"=="cpanel" goto CPANEL_WINS

echo.
echo ERRO: resposta invalida. Escreve apenas:
echo local
echo ou
echo cpanel
pause
exit /b 1


:LOCAL_WINS
echo.
echo ==========================================================
echo MODO LOCAL
echo ==========================================================
echo O PC vai ganhar.
echo O script vai fazer:
echo   PC ^> GitHub ^> cPanel
echo.
echo Alteracoes feitas pelo admin no cPanel podem ser perdidas.
echo.

echo ==========================================================
echo 1/5 A atualizar versao de cache em HTML...
echo ==========================================================

for /f %%V in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMddHHmmss"') do set "CACHE_VERSION=%%V"

powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand CgAkAEUAcgByAG8AcgBBAGMAdABpAG8AbgBQAHIAZQBmAGUAcgBlAG4AYwBlACAAPQAgACcAUwB0AG8AcAAnAAoAJAB2ACAAPQAgACQAZQBuAHYAOgBDAEEAQwBIAEUAXwBWAEUAUgBTAEkATwBOAAoAJABzAGkAdABlACAAPQAgACQAZQBuAHYAOgBTAEkAVABFAAoACgBpAGYAIAAoAFsAcwB0AHIAaQBuAGcAXQA6ADoASQBzAE4AdQBsAGwATwByAFcAaABpAHQAZQBTAHAAYQBjAGUAKAAkAHYAKQApACAAewAKACAAIAAgACAAdABoAHIAbwB3ACAAJwBDAEEAQwBIAEUAXwBWAEUAUgBTAEkATwBOACAAZQBuAHYAaQByAG8AbgBtAGUAbgB0ACAAdgBhAHIAaQBhAGIAbABlACAAaQBzACAAZQBtAHAAdAB5AC4AJwAKAH0ACgAKAGkAZgAgACgAWwBzAHQAcgBpAG4AZwBdADoAOgBJAHMATgB1AGwAbABPAHIAVwBoAGkAdABlAFMAcABhAGMAZQAoACQAcwBpAHQAZQApACAALQBvAHIAIAAtAG4AbwB0ACAAKABUAGUAcwB0AC0AUABhAHQAaAAgAC0ATABpAHQAZQByAGEAbABQAGEAdABoACAAJABzAGkAdABlACkAKQAgAHsACgAgACAAIAAgAHQAaAByAG8AdwAgACcAUwBJAFQARQAgAGUAbgB2AGkAcgBvAG4AbQBlAG4AdAAgAHYAYQByAGkAYQBiAGwAZQAgAGkAcwAgAGkAbgB2AGEAbABpAGQAIABvAHIAIAB0AGgAZQAgAHAAYQB0AGgAIABkAG8AZQBzACAAbgBvAHQAIABlAHgAaQBzAHQALgAnAAoAfQAKAAoAJAB1AHQAZgA4AE4AbwBCAG8AbQAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0ACAAUwB5AHMAdABlAG0ALgBUAGUAeAB0AC4AVQBUAEYAOABFAG4AYwBvAGQAaQBuAGcAKAAkAGYAYQBsAHMAZQApAAoAJABmAGkAbABlAHMAIAA9ACAARwBlAHQALQBDAGgAaQBsAGQASQB0AGUAbQAgAC0ATABpAHQAZQByAGEAbABQAGEAdABoACAAJABzAGkAdABlACAALQBGAGkAbAB0AGUAcgAgACcAKgAuAGgAdABtAGwAJwAgAC0ARgBpAGwAZQAKAAoAZgBvAHIAZQBhAGMAaAAgACgAJABmACAAaQBuACAAJABmAGkAbABlAHMAKQAgAHsACgAgACAAIAAgACQAdAAgAD0AIABbAFMAeQBzAHQAZQBtAC4ASQBPAC4ARgBpAGwAZQBdADoAOgBSAGUAYQBkAEEAbABsAFQAZQB4AHQAKAAkAGYALgBGAHUAbABsAE4AYQBtAGUAKQAKACAAIAAgACAAJABvAGwAZAAgAD0AIAAkAHQACgAKACAAIAAgACAAJAB0ACAAPQAgAFsAcgBlAGcAZQB4AF0AOgA6AFIAZQBwAGwAYQBjAGUAKAAKACAAIAAgACAAIAAgACAAIAAkAHQALAAKACAAIAAgACAAIAAgACAAIAAnAGgAcgBlAGYAPQAiAHMAdAB5AGwAZQBzAFwALgBjAHMAcwAoAD8AOgBcAD8AdgA9AFsAXgAiAF0AKgApAD8AIgAnACwACgAgACAAIAAgACAAIAAgACAAIgBoAHIAZQBmAD0AYAAiAHMAdAB5AGwAZQBzAC4AYwBzAHMAPwB2AD0AJAB2AGAAIgAiAAoAIAAgACAAIAApAAoACgAgACAAIAAgACQAdAAgAD0AIABbAHIAZQBnAGUAeABdADoAOgBSAGUAcABsAGEAYwBlACgACgAgACAAIAAgACAAIAAgACAAJAB0ACwACgAgACAAIAAgACAAIAAgACAAJwBzAHIAYwA9ACIAYQBwAHAAXAAuAGoAcwAoAD8AOgBcAD8AdgA9AFsAXgAiAF0AKgApAD8AIgAnACwACgAgACAAIAAgACAAIAAgACAAIgBzAHIAYwA9AGAAIgBhAHAAcAAuAGoAcwA/AHYAPQAkAHYAYAAiACIACgAgACAAIAAgACkACgAKACAAIAAgACAAIwAgAFIAZQBtAG8AdgBlACAAbABpAG4AaABhAHMAIABlAG0AIABiAHIAYQBuAGMAbwAgAG4AbwAgAGYAaQBtACAAYwByAGkAYQBkAGEAcwAgAHAAbwByACAAdgBlAHIAcwD1AGUAcwAgAGEAbgB0AGUAcgBpAG8AcgBlAHMAIABkAG8AIABCAEEAVAAuAAoAIAAgACAAIAAjACAARABlAHAAbwBpAHMAIABlAHMAYwByAGUAdgBlACAAbwAgAGYAaQBjAGgAZQBpAHIAbwAgAHMAZQBtACAAYQBjAHIAZQBzAGMAZQBuAHQAYQByACAAbgBlAHcAbABpAG4AZQAgAGEAdQB0AG8AbQDhAHQAaQBjAGEALgAKACAAIAAgACAAJAB0ACAAPQAgACQAdAAuAFQAcgBpAG0ARQBuAGQAKAAiAGAAcgAiACwAIAAiAGAAbgAiACkACgAKACAAIAAgACAAaQBmACAAKAAkAHQAIAAtAG4AZQAgACQAbwBsAGQAKQAgAHsACgAgACAAIAAgACAAIAAgACAAWwBTAHkAcwB0AGUAbQAuAEkATwAuAEYAaQBsAGUAXQA6ADoAVwByAGkAdABlAEEAbABsAFQAZQB4AHQAKAAkAGYALgBGAHUAbABsAE4AYQBtAGUALAAgACQAdAAsACAAJAB1AHQAZgA4AE4AbwBCAG8AbQApAAoAIAAgACAAIAB9AAoAfQAKAAoAVwByAGkAdABlAC0ASABvAHMAdAAgACgAIgBDAGEAYwBoAGUAIAB2AGUAcgBzAGkAbwBuADoAIAAiACAAKwAgACQAdgApAAoA

if errorlevel 1 (
    echo ERRO: Falhou ao atualizar a versao de cache.
    pause
    exit /b 1
)

echo Versao de cache aplicada: %CACHE_VERSION%

echo.
echo ==========================================================
echo 2/5 A validar JavaScript e JSON, se Node estiver disponivel...
echo ==========================================================

where node >nul 2>nul
if errorlevel 1 (
    echo Node nao encontrado. Vou saltar validacoes locais.
) else (
    node --check site\app.js
    if errorlevel 1 (
        echo ERRO: app.js tem erro de JavaScript.
        pause
        exit /b 1
    )

    node -e "const fs=require('fs'); const files=['site/content/home.json',...fs.readdirSync('site/content/products').filter(x=>x.endsWith('.json')).map(x=>'site/content/products/'+x)]; for (const f of files) JSON.parse(fs.readFileSync(f,'utf8')); console.log('json ok');"
    if errorlevel 1 (
        echo ERRO: Algum JSON tem erro.
        pause
        exit /b 1
    )
)

echo.
echo ==========================================================
echo 3/5 Git: commit e push, se houver alteracoes
echo ==========================================================

set "HAS_CHANGES="
git status --short --branch

for /f %%A in ('git status --porcelain') do set "HAS_CHANGES=1"

if not defined HAS_CHANGES (
    echo.
    echo Nao ha alteracoes locais para fazer commit.
    set /p CONTINUE_NO_CHANGES="Queres fazer deploy do ultimo commit? escreve S para sim: "
    if /I not "!CONTINUE_NO_CHANGES!"=="S" (
        echo Cancelado.
        pause
        exit /b 0
    )
) else (
    echo.
    echo ATENCAO: o commit vai incluir alteracoes dentro da pasta site.
    echo Confirma no estado acima se nao ha ficheiros estranhos como:
    echo   site\error_log
    echo   site\.php-version-check.php
    echo   site\.well-known
    echo.
    set "COMMIT_MSG=%CACHE_VERSION% direct local update"
    echo Mensagem automatica do commit:
    echo !COMMIT_MSG!
    echo.
    set /p CONFIRM_COMMIT="Pressiona ENTER para continuar, ou qualquer outra coisa para cancelar: "
    if not "!CONFIRM_COMMIT!"=="" (
        echo Cancelado antes do commit.
        pause
        exit /b 0
    )

    git add -A site
    git diff --check --cached
    if errorlevel 1 (
        echo ERRO: git diff --check encontrou problemas.
        pause
        exit /b 1
    )

    git commit -m "!COMMIT_MSG!"
    if errorlevel 1 (
        echo ERRO: Falhou o commit.
        pause
        exit /b 1
    )

    git push origin main
    if errorlevel 1 (
        echo ERRO: Falhou o push para GitHub.
        pause
        exit /b 1
    )
)

for /f %%H in ('git rev-parse HEAD') do set "COMMIT_HASH=%%H"

echo.
echo ==========================================================
echo 4/5 Deploy no cPanel por SSH
echo ==========================================================
echo Commit: !COMMIT_HASH!
echo.

"%SSH%" -i "%SSH_KEY%" -o UserKnownHostsFile="%KNOWN_HOSTS%" -o StrictHostKeyChecking=accept-new -p %SSH_PORT% %SSH_USER%@%SSH_HOST% "cd %SERVER_REPO% && git pull --ff-only origin main && /bin/cp -R site/. %LIVE_PATH%/ && php -l %LIVE_PATH%/send-order.php && php -l %LIVE_PATH%/admin-api.php && rm -f %SYNC_FLAG% && curl -sS 'https://miaandpaper.com/admin-api.php?action=status'"

if errorlevel 1 (
    echo.
    echo ERRO: O deploy por SSH falhou.
    pause
    exit /b 1
)

echo.
echo ==========================================================
echo 5/5 LOCAL ganhou. Deploy concluido.
echo ==========================================================
echo Commit publicado:
echo !COMMIT_HASH!
echo.
echo Abre o site e faz Ctrl+F5:
echo https://miaandpaper.com
echo.
pause
exit /b 0


:CPANEL_WINS
echo.
echo ==========================================================
echo MODO CPANEL
echo ==========================================================
echo O cPanel/admin vai ganhar.
echo O script vai fazer:
echo   backup da pasta site local
echo   cPanel live ^> pasta site no PC
echo.
echo Nao vai fazer commit, push, nem deploy.
echo.

if not defined TAR (
    echo ERRO: Nao encontrei tar.exe no Windows.
    echo Sem tar.exe nao consigo copiar o live de forma segura.
    pause
    exit /b 1
)

for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%T"

set "BACKUP_ROOT=C:\Users\Tiago Henriques\Documents\miaandpaper-deploy-backups"
set "BACKUP=!BACKUP_ROOT!\!STAMP!_before_cpanel_wins"
set "STAGING=%TEMP%\miaandpaper_live_!STAMP!"
set "LOCAL_ARCHIVE=%TEMP%\miaandpaper_live_!STAMP!.tar.gz"
set "REMOTE_ARCHIVE=/tmp/miaandpaper_live_!STAMP!.tar.gz"

echo.
echo ==========================================================
echo 1/5 Backup da pasta site local
echo ==========================================================

mkdir "!BACKUP_ROOT!" >nul 2>nul
mkdir "!BACKUP!" >nul 2>nul
robocopy "%SITE%" "!BACKUP!\site" /MIR >nul
if errorlevel 8 (
    echo ERRO: Falhou o backup da pasta site local.
    pause
    exit /b 1
)

echo Backup criado em:
echo !BACKUP!\site

echo.
echo ==========================================================
echo 2/5 A criar arquivo do site live no cPanel
echo ==========================================================

"%SSH%" -i "%SSH_KEY%" -o UserKnownHostsFile="%KNOWN_HOSTS%" -o StrictHostKeyChecking=accept-new -p %SSH_PORT% %SSH_USER%@%SSH_HOST% "cd %LIVE_PATH% && tar --exclude='./error_log' --exclude='./.php-version-check.php' --exclude='./.well-known' --exclude='./*.zip' --exclude='./*.7z' -czf %REMOTE_ARCHIVE% ."
if errorlevel 1 (
    echo ERRO: Falhou ao criar arquivo no cPanel.
    pause
    exit /b 1
)

echo.
echo ==========================================================
echo 3/5 A copiar arquivo do cPanel para o PC
echo ==========================================================

if exist "!LOCAL_ARCHIVE!" del /Q "!LOCAL_ARCHIVE!" >nul 2>nul
if exist "!STAGING!" rmdir /S /Q "!STAGING!" >nul 2>nul
mkdir "!STAGING!" >nul 2>nul

"%SCP%" -i "%SSH_KEY%" -o UserKnownHostsFile="%KNOWN_HOSTS%" -o StrictHostKeyChecking=accept-new -P %SSH_PORT% "%SSH_USER%@%SSH_HOST%:%REMOTE_ARCHIVE%" "!LOCAL_ARCHIVE!"
if errorlevel 1 (
    echo ERRO: Falhou ao copiar arquivo do cPanel.
    pause
    exit /b 1
)

"%SSH%" -i "%SSH_KEY%" -o UserKnownHostsFile="%KNOWN_HOSTS%" -o StrictHostKeyChecking=accept-new -p %SSH_PORT% %SSH_USER%@%SSH_HOST% "rm -f %REMOTE_ARCHIVE%" >nul 2>nul

echo.
echo ==========================================================
echo 4/5 A extrair e espelhar cPanel ^> pasta site local
echo ==========================================================

"%TAR%" -xzf "!LOCAL_ARCHIVE!" -C "!STAGING!"
if errorlevel 1 (
    echo ERRO: Falhou ao extrair arquivo no PC.
    pause
    exit /b 1
)

robocopy "!STAGING!" "%SITE%" /MIR >nul
if errorlevel 8 (
    echo ERRO: Falhou ao espelhar cPanel para a pasta site local.
    pause
    exit /b 1
)

echo.
echo ==========================================================
echo 5/5 Validacao local, se Node estiver disponivel
echo ==========================================================

where node >nul 2>nul
if errorlevel 1 (
    echo Node nao encontrado. Vou saltar validacoes locais.
) else (
    node --check site\app.js
    if errorlevel 1 (
        echo ATENCAO: app.js copiado do cPanel tem erro de JavaScript.
        echo O backup local continua em:
        echo !BACKUP!\site
        pause
        exit /b 1
    )

    node -e "const fs=require('fs'); const files=['site/content/home.json',...fs.readdirSync('site/content/products').filter(x=>x.endsWith('.json')).map(x=>'site/content/products/'+x)]; for (const f of files) JSON.parse(fs.readFileSync(f,'utf8')); console.log('json ok');"
    if errorlevel 1 (
        echo ATENCAO: Algum JSON copiado do cPanel tem erro.
        echo O backup local continua em:
        echo !BACKUP!\site
        pause
        exit /b 1
    )
)

del /Q "!LOCAL_ARCHIVE!" >nul 2>nul
rmdir /S /Q "!STAGING!" >nul 2>nul

echo.
echo ==========================================================
echo CPANEL ganhou. Copia cPanel ^> PC concluida.
echo ==========================================================
echo.
echo A pasta local foi substituida por:
echo %SITE%
echo.
echo Backup anterior do PC:
echo !BACKUP!\site
echo.
echo Estado Git atual:
git status --short --branch
echo.
pause
exit /b 0
