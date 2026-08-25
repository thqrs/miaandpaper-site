@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo   Mia e Paper -- Exportador de Pacote de Sprites do Miu
echo ===================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\export-sprites-miu.ps1"

echo.
echo ===================================================
echo   Processo concluido!
echo ===================================================
echo.
