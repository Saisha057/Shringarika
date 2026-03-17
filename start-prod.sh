#!/bin/bash
# Unified Production Build and Startup Script
# This builds the frontend and starts the unified server

echo "🏭 Building and Starting Shringarika in PRODUCTION mode..."
echo "====================================="

# Install dependencies
echo "📦 Installing dependencies..."
npm run install-all

# Build frontend
echo "🔨 Building frontend..."
npm run build:prod

# Start production server
echo "🚀 Starting unified server..."
cd server
NODE_ENV=production npm start
