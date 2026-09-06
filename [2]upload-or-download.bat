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

set "REPO=F:\Projects\miaandpaper-site"
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

powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO%\tools\update-cache-version.ps1"

if errorlevel 1 (
    echo ERRO: Falhou ao atualizar a versao de cache.
    pause
    exit /b 1
)

echo Versao de cache aplicada: %CACHE_VERSION%

echo.
echo ==========================================================
echo 2/5 A validar PHP, JavaScript, JSON e testes de seguranca...
echo ==========================================================

where node >nul 2>nul
if errorlevel 1 (
    echo ERRO: Node e obrigatorio para validar e gerar o site.
    pause
    exit /b 1
) else (
    rem O antigo app.js esta dividido em modulos site\js\*.js (escopo global partilhado).
    set "JS_CHECK_FAILED="
    for %%F in ("site\js\*.js") do (
        node --check "site\js\%%~nxF"
        if errorlevel 1 set "JS_CHECK_FAILED=1"
    )
    if exist "site\app.js" (
        node --check site\app.js
        if errorlevel 1 set "JS_CHECK_FAILED=1"
    )
    if defined JS_CHECK_FAILED (
        echo ERRO: um ficheiro JavaScript de site\js tem erro de sintaxe.
        pause
        exit /b 1
    )

    node -e "const fs=require('fs'),path=require('path'); function walk(d){for(const n of fs.readdirSync(d)){const p=path.join(d,n),s=fs.statSync(p); if(s.isDirectory())walk(p); else if(n.endsWith('.json'))JSON.parse(fs.readFileSync(p,'utf8'));}} walk('site/content'); console.log('json ok');"
    if errorlevel 1 (
        echo ERRO: Algum JSON tem erro.
        pause
        exit /b 1
    )

    rem Os custos e materiais viajam fora do git, mas tambem têm de ser JSON
    rem valido. Se existir um pricing.json na pasta privada (por exemplo, vindo
    rem de uma folha de calculo), ele e apenas uma copia de preparacao: o site
    rem publica site/content/pricing.json. Bloquear o deploy quando divergem
    rem impede que uma alteracao de precos fique esquecida na pasta privada.
    node -e "const fs=require('fs'); for(const p of ['private/custos.json','private/materiais.json']){if(fs.existsSync(p)===false)throw new Error('Falta '+p); JSON.parse(fs.readFileSync(p,'utf8'));} const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v; if(fs.existsSync('private/pricing.json')){const a=canon(JSON.parse(fs.readFileSync('private/pricing.json','utf8'))),b=canon(JSON.parse(fs.readFileSync('site/content/pricing.json','utf8'))); if((JSON.stringify(a)===JSON.stringify(b))===false)throw new Error('private/pricing.json diverge de site/content/pricing.json; importa os precos pelo editor antes do deploy');} console.log('json privado ok');"
    if errorlevel 1 (
        echo ERRO: Os JSON privados estao em falta, invalidos ou incoerentes.
        pause
        exit /b 1
    )

    REM O HTML servido ao Google e so um shell: o app.js e que escreve o conteudo
    REM a partir dos JSON. Este gerador copia esse conteudo para dentro do HTML
    REM (titulos, descriptions, h1, designs, links, sitemap.xml). Como le os JSON
    REM no momento em que corre, tem de correr aqui, depois das validacoes e antes
    REM do commit — senao o que vai para o servidor fica com a versao anterior.
    echo.
    echo A gerar SEO a partir dos JSON...
    node site\tools\seo-build.js
    if errorlevel 1 (
        echo ERRO: Falhou a geracao de SEO.
        pause
        exit /b 1
    )
)

where php >nul 2>nul
if errorlevel 1 (
    echo ERRO: PHP e obrigatorio para validar o backend.
    pause
    exit /b 1
)

set "PHP_CHECK_FAILED="
for /R "%SITE%" %%F in (*.php) do (
    php -l "%%F" >nul
    if errorlevel 1 (
        php -l "%%F"
        set "PHP_CHECK_FAILED=1"
    )
)
if defined PHP_CHECK_FAILED (
    echo ERRO: um ficheiro PHP tem erro de sintaxe.
    pause
    exit /b 1
)

php site\tools\test-comandos.php
if errorlevel 1 (
    echo ERRO: falharam os testes dos comandos.
    pause
    exit /b 1
)
php site\tools\test-seguranca-admin.php
if errorlevel 1 (
    echo ERRO: falharam os testes de seguranca administrativa.
    pause
    exit /b 1
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

    git add -A site tools docs "[2]upload-or-download.bat"
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

"%SSH%" -i "%SSH_KEY%" -o UserKnownHostsFile="%KNOWN_HOSTS%" -o StrictHostKeyChecking=accept-new -p %SSH_PORT% %SSH_USER%@%SSH_HOST% "cd %SERVER_REPO% && git pull --ff-only origin main && find site -name '*.php' -type f -exec php -l {} \; >/dev/null && find site/content -name '*.json' -type f -exec php -r 'json_decode(file_get_contents($argv[1]),true,512,JSON_THROW_ON_ERROR);' {} \; && /bin/cp -R site/. %LIVE_PATH%/ && curl -fSs 'https://miaandpaper.com/' >/dev/null && curl -fSs 'https://miaandpaper.com/stickers.html' >/dev/null && curl -fSs 'https://miaandpaper.com/admin-api.php?action=status' >/dev/null && rm -f %SYNC_FLAG%"

if errorlevel 1 (
    echo.
    echo ERRO: O deploy por SSH falhou.
    pause
    exit /b 1
)

rem CUSTOS_PRIVADOS_V1: o custos.json tem os custos por unidade e o
rem materiais.json as contas que os produzem. Nenhum esta no git (estao no
rem .gitignore) e nenhum pode ir para a raiz web, por isso viajam a parte,
rem por scp, para a pasta privada irma do site.
for %%F in (custos.json materiais.json) do (
    if exist "%REPO%\private\%%F" (
        echo A enviar %%F para a pasta privada do servidor...
        "%SCP%" -i "%SSH_KEY%" -o UserKnownHostsFile="%KNOWN_HOSTS%" -o StrictHostKeyChecking=accept-new -P %SSH_PORT% "%REPO%\private\%%F" "%SSH_USER%@%SSH_HOST%:/home/currwkdi/private/%%F"
        if errorlevel 1 (
            echo ERRO: nao consegui enviar %%F para a pasta privada.
            echo O deploy nao pode ser dado como concluido com custos desactualizados.
            pause
            exit /b 1
        )
    )
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
echo 5/5 Validacao local
echo ==========================================================

where node >nul 2>nul
if errorlevel 1 (
    echo ERRO: Node nao encontrado; nao posso validar o que veio do cPanel.
    pause
    exit /b 1
) else (
    rem Valida os modulos site\js\*.js (e um site\app.js legacy, se existir).
    set "JS_CHECK_FAILED="
    for %%F in ("site\js\*.js") do (
        node --check "site\js\%%~nxF"
        if errorlevel 1 set "JS_CHECK_FAILED=1"
    )
    if exist "site\app.js" (
        node --check site\app.js
        if errorlevel 1 set "JS_CHECK_FAILED=1"
    )
    if defined JS_CHECK_FAILED (
        echo ATENCAO: JavaScript copiado do cPanel tem erro de sintaxe.
        echo O backup local continua em:
        echo !BACKUP!\site
        pause
        exit /b 1
    )

    node -e "const fs=require('fs'),path=require('path'); function walk(d){for(const n of fs.readdirSync(d)){const p=path.join(d,n),s=fs.statSync(p); if(s.isDirectory())walk(p); else if(n.endsWith('.json'))JSON.parse(fs.readFileSync(p,'utf8'));}} walk('site/content'); console.log('json ok');"
    if errorlevel 1 (
        echo ATENCAO: Algum JSON copiado do cPanel tem erro.
        echo O backup local continua em:
        echo !BACKUP!\site
        pause
        exit /b 1
    )
)

where php >nul 2>nul
if errorlevel 1 (
    echo ERRO: PHP nao encontrado; nao posso validar o backend copiado.
    pause
    exit /b 1
)
set "PHP_CHECK_FAILED="
for /R "%SITE%" %%F in (*.php) do (
    php -l "%%F" >nul
    if errorlevel 1 (
        php -l "%%F"
        set "PHP_CHECK_FAILED=1"
    )
)
if defined PHP_CHECK_FAILED (
    echo ATENCAO: PHP copiado do cPanel tem erro de sintaxe.
    echo O backup local continua em: !BACKUP!\site
    pause
    exit /b 1
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
