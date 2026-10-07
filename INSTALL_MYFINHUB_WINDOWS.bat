@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if /I "%~1"=="--install" goto :install
if /I "%~1"=="--latest" goto :install_latest
if /I "%~1"=="--help" goto :help
if /I "%~1"=="-h" goto :help

set "FORCE_CLEAN_INSTALL="
if /I "%~1"=="--clean-install" (
  set "FORCE_CLEAN_INSTALL=1"
) else if not "%~1"=="" (
  goto :unknown_argument
)

title MyFinHub Local Development

where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found in PATH.
  echo MyFinHub local development requires Node.js 24 LTS.
  echo Install Node.js 24, reopen this window, and run this file again.
  pause
  exit /b 1
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo npm was not found in PATH.
  echo Reinstall Node.js 24 with npm, then run this file again.
  pause
  exit /b 1
)

set "NODE_MAJOR="
for /f "usebackq delims=" %%V in (`node.exe -p "process.versions.node.split('.')[0]"`) do set "NODE_MAJOR=%%V"
if not "%NODE_MAJOR%"=="24" (
  echo Unsupported Node.js version detected.
  node.exe --version
  echo MyFinHub requires Node.js 24 LTS for local development.
  pause
  exit /b 1
)

if defined FORCE_CLEAN_INSTALL goto :install_dependencies
if exist "node_modules\.package-lock.json" goto :run_dev

:install_dependencies
echo.
echo Installing exact repository dependencies with npm ci...
call npm.cmd ci
if errorlevel 1 goto :dependency_install_failed

:dependency_install_failed
set "EXITCODE=%ERRORLEVEL%"
echo.
echo Dependency installation failed. Exit code: %EXITCODE%
pause
exit /b %EXITCODE%

:run_dev
echo.
echo Starting MyFinHub local development mode...
echo No production build or Vercel deployment is required.
echo Stop the local servers with Ctrl+C.
echo.
call npm.cmd run dev
set "EXITCODE=%ERRORLEVEL%"
exit /b %EXITCODE%

:install
title MyFinHub Windows Installer
set "SCRIPT=%~dp0desktop\install-windows.ps1"
if not exist "%SCRIPT%" (
  echo MyFinHub desktop installer script was not found.
  echo Expected: %SCRIPT%
  pause
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
  echo.
  echo MyFinHub installation failed. Exit code: %EXITCODE%
  pause
)
exit /b %EXITCODE%

:install_latest
title MyFinHub Windows Installer
set "SCRIPT=%~dp0desktop\install-windows.ps1"
if not exist "%SCRIPT%" (
  echo MyFinHub desktop installer script was not found.
  echo Expected: %SCRIPT%
  pause
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -Latest
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
  echo.
  echo MyFinHub installation failed. Exit code: %EXITCODE%
  pause
)
exit /b %EXITCODE%

:unknown_argument
echo Unknown argument: %~1
echo.
goto :help

:help
echo MyFinHub Windows helper
echo.
echo Usage:
echo   INSTALL_MYFINHUB_WINDOWS.bat
echo       Start local development. Runs npm ci only when dependencies are missing,
echo       then runs npm run dev. No build or deployment is performed.
echo.
echo   INSTALL_MYFINHUB_WINDOWS.bat --clean-install
echo       Reinstall exact root dependencies with npm ci, then start local development.
echo.
echo   INSTALL_MYFINHUB_WINDOWS.bat --install
echo       Run the existing Windows installer script.
echo.
echo   INSTALL_MYFINHUB_WINDOWS.bat --latest
echo       Install the latest published Windows release.
echo.
exit /b 0
