@echo off
setlocal
cd /d "%~dp0\.."
set "PHP_EXE=C:\Users\Tiago Henriques\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.NTS.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe"
if not exist "%PHP_EXE%" set "PHP_EXE=php"
echo PHP usado: %PHP_EXE%
"%PHP_EXE%" -v
echo.
for %%F in ("site\admin-api.php" "site\send-order.php" "site\track-order-event.php" "site\admin-funnel.php") do (
  if exist "%%~F" (
    echo Validating %%~F...
    "%PHP_EXE%" -l "%%~F"
  ) else (
    echo Ficheiro nao encontrado: %%~F
  )
)
if exist "site\app.js" (
  where node >nul 2>nul
  if not errorlevel 1 (
    echo.
    echo Validating site\app.js...
    node --check "site\app.js"
  )
)
