@echo off
setlocal

cd /d "%~dp0"

set "MIAANDPAPER_PRIVATE_DIR=%CD%\private-local"
if not exist "%MIAANDPAPER_PRIVATE_DIR%" mkdir "%MIAANDPAPER_PRIVATE_DIR%"

php -S 127.0.0.1:8080 -t site
