@echo off
REM Unified Production Build and Startup Script for Windows

echo 🏭 Building and Starting Shringarika in PRODUCTION mode...
echo =====================================

REM Install dependencies
echo 📦 Installing dependencies...
call npm run install-all

REM Build frontend
echo 🔨 Building frontend...
call npm run build:prod

REM Start production server
echo 🚀 Starting unified server...
cd server
set NODE_ENV=production
call npm start
