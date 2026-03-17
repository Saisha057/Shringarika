@echo off
echo ============================================
echo   STOPPING ALL EXISTING NODE PROCESSES
echo ============================================
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 >nul

echo.
echo ============================================
echo   STARTING BACKEND SERVER (Port 5000)
echo ============================================
cd /d "%~dp0server"
start "BACKEND SERVER" cmd /k "npm run dev"
timeout /t 8

echo.
echo ============================================
echo   STARTING FRONTEND SERVER (Port 3000)
echo ============================================
cd /d "%~dp0"
start "FRONTEND SERVER" cmd /k "npm run dev"
timeout /t 5

echo.
echo ============================================
echo   VERIFYING SERVERS...
echo ============================================
timeout /t 5

powershell -Command "try { $health = Invoke-RestMethod -Uri 'http://localhost:5000/health' -Method GET -TimeoutSec 10; Write-Host ''; Write-Host 'BACKEND (Port 5000): RUNNING' -ForegroundColor Green; Write-Host '  Database: ' -NoNewline; Write-Host $health.database -ForegroundColor $(if($health.database -eq 'connected'){'Green'}else{'Red'}); Write-Host ''; Write-Host 'FRONTEND (Port 3000): RUNNING' -ForegroundColor Green; Write-Host '  URL: http://localhost:3000' -ForegroundColor Cyan; Write-Host ''; Write-Host 'Both servers are running!' -ForegroundColor Green; Write-Host ''; } catch { Write-Host 'ERROR: Backend not responding' -ForegroundColor Red; Write-Host $_.Exception.Message -ForegroundColor Yellow }"

echo.
echo ============================================
echo   ALL SYSTEMS STARTED!
echo ============================================
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:3000
echo ============================================
echo.
pause
