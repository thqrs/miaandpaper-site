@echo off
set "SITE_DIR=C:\Users\Tiago Henriques\Documents\Projects\miaandpaper-site\site"

cd /d "%SITE_DIR%"
if errorlevel 1 (
    echo Nao consegui encontrar a pasta:
    echo %SITE_DIR%
    pause
    exit /b 1
)

echo A iniciar servidor local Mia ^& Paper...
start "Mia and Paper local server" /D "%SITE_DIR%" py -m http.server 8000

timeout /t 2 /nobreak >nul

echo A abrir o site no browser...
start "" "http://localhost:8000"

exit /b 0
