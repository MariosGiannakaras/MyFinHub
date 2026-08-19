@echo off
setlocal EnableExtensions
title RheomIQ Windows Installer

set "SCRIPT=%~dp0desktop\install-windows.ps1"
if not exist "%SCRIPT%" (
  echo RheomIQ desktop installer script was not found.
  echo Expected: %SCRIPT%
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
  echo.
  echo RheomIQ installation failed. Exit code: %EXITCODE%
  pause
)
exit /b %EXITCODE%
