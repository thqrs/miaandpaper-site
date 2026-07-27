@echo off
setlocal

set "PORT=8082"
if not "%~1"=="" set "PORT=%~1"
set "ROOT_DIR=%~dp0"
set "SITE_DIR=%ROOT_DIR%site"

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

powershell -NoProfile -ExecutionPolicy Bypass -Command "$listeners = Get-NetTCPConnection -State Listen -LocalPort %PORT% -ErrorAction SilentlyContinue; if ($listeners) { Write-Host ('Port {0} is already in use:' -f %PORT%); foreach ($l in $listeners) { $p = Get-Process -Id $l.OwningProcess -ErrorAction SilentlyContinue; Write-Host ('  {0}:{1} PID {2} {3}' -f $l.LocalAddress, $l.LocalPort, $l.OwningProcess, $p.ProcessName) }; exit 1 }; exit 0"
if errorlevel 1 (
    echo Para o processo que esta a usar a porta %PORT% e tenta novamente.
    pause
    exit /b 1
)

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

pushd "%SITE_DIR%"
php -S 0.0.0.0:%PORT%
popd
