@echo off
setlocal

set "ROOT=F:\Projects\miaandpaper-site"
set "TMP=%TEMP%\miu-admin-chat-files"
set "OUT=%ROOT%\miu-admin-chat-files.zip"

if exist "%TMP%" rmdir /s /q "%TMP%"
if exist "%OUT%" del "%OUT%"

mkdir "%TMP%\site\js"
mkdir "%TMP%\site\css"

copy "%ROOT%\site\bot.php" "%TMP%\site\bot.php" >nul
copy "%ROOT%\site\js\24-miu.js" "%TMP%\site\js\24-miu.js" >nul
copy "%ROOT%\site\css\13-miu.css" "%TMP%\site\css\13-miu.css" >nul

powershell -NoProfile -Command ^
  "Compress-Archive -Path '%TMP%\site' -DestinationPath '%OUT%' -Force"

rmdir /s /q "%TMP%"

echo.
echo ZIP criado em:
echo %OUT%
pause