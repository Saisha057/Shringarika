@echo off
REM Production Testing Script for Windows
echo ========================================
echo 🧪 Testing Unified Production Build
echo ========================================
echo.

REM Check if Node is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js found: 
node --version
echo.

REM Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm run install-all
    echo.
)

REM Build frontend
echo 🔨 Building frontend...
call npm run build:prod
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Build failed!
    pause
    exit /b 1
)
echo ✅ Build successful!
echo.

REM Check if build folder exists
if not exist "build\index.html" (
    echo ❌ Build folder not found or incomplete!
    pause
    exit /b 1
)
echo ✅ Build folder verified
echo.

REM Test production server
echo 🚀 Starting production server...
echo Server will start on http://localhost:5000
echo.
echo 📋 TESTING CHECKLIST:
echo   [ ] Open http://localhost:5000 in your browser
echo   [ ] Homepage loads correctly
echo   [ ] All images and assets load
echo   [ ] Can browse products
echo   [ ] Can add to cart
echo   [ ] Can login/register
echo   [ ] API calls work (check Network tab)
echo   [ ] No CORS errors in console
echo   [ ] Admin dashboard accessible
echo.
echo Press Ctrl+C to stop the server when done testing
echo.
echo ========================================
echo Starting server now...
echo ========================================
echo.

cd server
set NODE_ENV=production
call npm start
