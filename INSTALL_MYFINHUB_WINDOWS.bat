@echo off
setlocal EnableExtensions
title MyFinHub Windows Installer

set "SCRIPT=%~dp0desktop\install-windows.ps1"
if not exist "%SCRIPT%" (
  echo MyFinHub desktop installer script was not found.
  echo Expected: %SCRIPT%
  pause
  exit /b 1
)

set "PS_ARGS=%*"
if /I "%~1"=="--latest" set "PS_ARGS=-Latest"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %PS_ARGS%
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
  echo.
  echo MyFinHub installation failed. Exit code: %EXITCODE%
  pause
)
exit /b %EXITCODE%
