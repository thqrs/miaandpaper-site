@echo off
setlocal

set "PORT=8082"
if not "%~1"=="" set "PORT=%~1"

set "ROOT_DIR=%~dp0"
set "SITE_DIR=%ROOT_DIR%site"
set "MIAANDPAPER_PRIVATE_DIR=%ROOT_DIR%private-local"

if not exist "%MIAANDPAPER_PRIVATE_DIR%" mkdir "%MIAANDPAPER_PRIVATE_DIR%"

if not exist "%SITE_DIR%\index.html" (
    echo Nao foi possivel encontrar a pasta do site:
    echo %SITE_DIR%
    pause
    exit /b 1
)

where php >nul 2>nul
if errorlevel 1 (
    echo O PHP nao foi encontrado no PATH.
    echo Instala o PHP ou adiciona php.exe ao PATH e tenta novamente.
    pause
    exit /b 1
)

rem ================================================================
rem VERIFICAR SE A PORTA JA ESTA A SER USADA
rem ================================================================

set "PORT_PID="
set "PORT_PROCESS="

for /f "tokens=1,2 delims=|" %%A in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$l = Get-NetTCPConnection -State Listen -LocalPort %PORT% -ErrorAction SilentlyContinue ^| Select-Object -First 1; if ($l) { $p = Get-Process -Id $l.OwningProcess -ErrorAction SilentlyContinue; Write-Output ($l.OwningProcess.ToString() + '|' + $p.ProcessName) }"') do (
    set "PORT_PID=%%A"
    set "PORT_PROCESS=%%B"
)

if defined PORT_PID (
    echo.
    echo ================================================================
    echo  A porta %PORT% ja esta a ser usada.
    echo ================================================================
    echo.
    echo  Processo: %PORT_PROCESS%
    echo  PID:      %PORT_PID%
    echo.

    choice /C YN /N /M "Queres parar este processo? (Y/N): "

    if errorlevel 2 (
        echo.
        echo Processo mantido. O servidor nao sera iniciado.
        pause
        exit /b 1
    )

    echo.
    echo A parar %PORT_PROCESS% [PID %PORT_PID%]...

    taskkill /PID %PORT_PID% /T /F >nul 2>&1

    if errorlevel 1 (
        echo.
        echo Nao foi possivel parar o processo.
        echo Talvez seja necessario executar este ficheiro como Administrador.
        echo.
        pause
        exit /b 1
    )

    rem Pequena espera para o Windows libertar efetivamente a porta
    timeout /t 1 /nobreak >nul

    rem Confirmar que a porta ficou livre
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$l = Get-NetTCPConnection -State Listen -LocalPort %PORT% -ErrorAction SilentlyContinue; if ($l) { exit 1 } else { exit 0 }"

    if errorlevel 1 (
        echo.
        echo O processo foi terminado, mas a porta %PORT% continua ocupada.
        echo.
        pause
        exit /b 1
    )

    echo Processo terminado. A porta %PORT% esta livre.
    echo.
)

rem ================================================================
rem DESCOBRIR IP LOCAL
rem ================================================================

set "LAN_IP="

for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Where-Object { $_.NextHop -ne '0.0.0.0' } | Sort-Object @{ Expression = { $_.RouteMetric + $_.InterfaceMetric } } | Select-Object -First 1; if ($route) { Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } | Select-Object -First 1 -ExpandProperty IPAddress }"`) do if not defined LAN_IP set "LAN_IP=%%I"

if not defined LAN_IP (
    echo.
    echo Nao foi possivel determinar o IP deste computador.
    echo Confirma que o PC esta ligado ao Wi-Fi ou por cabo ao mesmo router.
    pause
    exit /b 1
)

cls
echo.
echo ================================================================
echo                   MIA ^& PAPER - SITE LOCAL
echo ================================================================
echo.
echo  NO TELEMOVEL OU TABLET, ABRE:
echo.
echo       http://%LAN_IP%:%PORT%/
echo.
echo  Os dispositivos devem estar ligados a mesma rede Wi-Fi.
echo  Neste PC: http://127.0.0.1:%PORT%/
echo.
echo ================================================================
echo.
echo Se o telemovel nao conseguir abrir, executa como Administrador:
echo netsh advfirewall firewall add rule name="MiaAndPaper LAN dev server %PORT%" dir=in action=allow protocol=TCP localport=%PORT% profile=private
echo.
echo Mantem esta janela aberta. Para parar, carrega em Ctrl+C.
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 750; Start-Process 'http://127.0.0.1:%PORT%/'"

rem O `php -S` usa o SAPI cli-server, que ignora o site\.user.ini por completo e
rem fica com os defaults do php.ini (upload_max_filesize=2M, post_max_size=8M).
rem Sem estes -d, qualquer foto acima de 2 MB e recusada aqui e passa em
rem producao, que e onde o .user.ini manda. Manter em sincronia com site\.user.ini.

pushd "%SITE_DIR%"
php -d extension=openssl -d extension=curl -d upload_max_filesize=44M -d post_max_size=48M -d max_file_uploads=10 -d max_input_time=300 -S 0.0.0.0:%PORT%
popd