@echo off
chcp 65001 >nul
title Agendas - servidor na rede
cd /d "%~dp0"
set PORTA=8090

where php >nul 2>nul || (echo   PHP nao encontrado. & pause & exit /b 1)

echo.
echo   Editor de agendas
echo.
echo   Neste PC:
echo      http://localhost:%PORTA%/
echo.
echo   Nos outros PCs da rede:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=*" %%b in ("%%a") do echo      http://%%b:%PORTA%/
)
echo.
echo   Para desligar, fecha esta janela.
echo.

php -d upload_max_filesize=40M -d post_max_size=45M -S 0.0.0.0:%PORTA% -t . router.php
pause
