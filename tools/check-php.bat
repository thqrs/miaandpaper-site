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
where node >nul 2>nul
if not errorlevel 1 (
  echo.
  rem O antigo app.js esta dividido em modulos site\js\*.js (escopo global partilhado).
  for %%F in ("site\js\*.js") do (
    echo Validating site\js\%%~nxF...
    node --check "site\js\%%~nxF"
  )
  if exist "site\app.js" (
    echo Validating site\app.js...
    node --check "site\app.js"
  )
)
