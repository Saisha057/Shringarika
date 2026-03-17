@echo off
REM Unified Development Startup Script for Windows
REM This runs both frontend (Vite) and backend (Express) concurrently

echo 🚀 Starting Shringarika in DEVELOPMENT mode...
echo 📦 Frontend: http://localhost:3000
echo 📡 Backend:  http://localhost:5000
echo =====================================

REM Install dependencies if needed
if not exist "node_modules" (
  echo 📦 Installing dependencies...
  call npm run install-all
)

REM Start both servers
call npm run start:dev
