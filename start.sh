#!/bin/bash

# Swagger Scanner - Start Script
cd "$(dirname "$0")"

# Install dependencies
echo "Installing dependencies..."
npm install

# Create data directory if needed
mkdir -p data

echo "Starting Swagger Scanner..."
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3001"
echo ""

node server/index.js &
npx vite

# Cleanup background server on exit
trap "kill %1 2>/dev/null" EXIT
