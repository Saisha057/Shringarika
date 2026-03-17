@echo off
echo.
echo ========================================
echo   STARTING BACKEND SERVER (PORT 5000)
echo ========================================
echo.

cd /d "%~dp0server"
echo Current directory: %CD%
echo.
echo Starting Node.js server...
echo.

node server.js

pause
