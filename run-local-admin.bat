@echo off
setlocal

cd /d "%~dp0"

set "MIAANDPAPER_PRIVATE_DIR=%CD%\private-local"
if not exist "%MIAANDPAPER_PRIVATE_DIR%" mkdir "%MIAANDPAPER_PRIVATE_DIR%"

rem -d ... : o cli-server ignora site\.user.ini. Ver start-lan.bat.
php -d extension=openssl -d extension=curl -d upload_max_filesize=44M -d post_max_size=48M -d max_file_uploads=10 -d max_input_time=300 -S 127.0.0.1:8080 -t site
