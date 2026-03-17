#!/bin/bash
# Production Testing Script for Linux/Mac

echo "========================================"
echo "🧪 Testing Unified Production Build"
echo "========================================"
echo ""

# Check if Node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found:"
node --version
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm run install-all
    echo ""
fi

# Build frontend
echo "🔨 Building frontend..."
npm run build:prod
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi
echo "✅ Build successful!"
echo ""

# Check if build folder exists
if [ ! -f "build/index.html" ]; then
    echo "❌ Build folder not found or incomplete!"
    exit 1
fi
echo "✅ Build folder verified"
echo ""

# Test production server
echo "🚀 Starting production server..."
echo "Server will start on http://localhost:5000"
echo ""
echo "📋 TESTING CHECKLIST:"
echo "  [ ] Open http://localhost:5000 in your browser"
echo "  [ ] Homepage loads correctly"
echo "  [ ] All images and assets load"
echo "  [ ] Can browse products"
echo "  [ ] Can add to cart"
echo "  [ ] Can login/register"
echo "  [ ] API calls work (check Network tab)"
echo "  [ ] No CORS errors in console"
echo "  [ ] Admin dashboard accessible"
echo ""
echo "Press Ctrl+C to stop the server when done testing"
echo ""
echo "========================================"
echo "Starting server now..."
echo "========================================"
echo ""

cd server
NODE_ENV=production npm start
