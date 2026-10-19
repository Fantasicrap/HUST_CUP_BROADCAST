@echo off
setlocal
chcp 65001 >nul
title HUST_CUP_BROADCAST
cd /d "%~dp0"
set "HUST_NODE=node.exe"
where node.exe >nul 2>nul
if not errorlevel 1 goto run
set "HUST_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%HUST_NODE%" goto run
echo [ERROR] Node.js 20 or newer was not found.
echo Install Node.js from https://nodejs.org/ and try again.
echo Read docs/Windows-startup.md for manual startup instructions.
if not defined HUST_NO_WAIT pause
exit /b 1
:run
"%HUST_NODE%" "%~dp0scripts\start.mjs"
set "HUST_EXIT=%ERRORLEVEL%"
echo.
echo Startup process finished. Exit code: %HUST_EXIT%
echo If startup failed, read runtime\startup.log and docs\Windows-startup.md.
if not defined HUST_NO_WAIT pause
exit /b %HUST_EXIT%
