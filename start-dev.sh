#!/bin/bash
# Unified Development Startup Script
# This runs both frontend (Vite) and backend (Express) concurrently

echo "🚀 Starting Shringarika in DEVELOPMENT mode..."
echo "📦 Frontend: http://localhost:3000"
echo "📡 Backend:  http://localhost:5000"
echo "====================================="

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ ! -d "server/node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm run install-all
fi

# Start both servers
npm run start:dev
