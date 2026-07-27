@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0generate-catalog-docx.ps1"
if errorlevel 1 pause
