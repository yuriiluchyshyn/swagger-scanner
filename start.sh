#!/bin/bash

# Swagger Scanner - Start Script
cd "$(dirname "$0")"

# Ensure MongoDB container is running
if ! docker ps --format '{{.Names}}' | grep -q swagger-mongo; then
  echo "Starting MongoDB container..."
  docker start swagger-mongo 2>/dev/null || docker run -d --name swagger-mongo -p 27017:27017 mongo:7
fi

# Install dependencies
echo "Installing dependencies..."
npm install

echo "Starting Swagger Scanner..."
echo "  Frontend: http://localhost:4444"
echo "  Backend:  http://localhost:3001"
echo ""

node server/index.js &
SERVER_PID=$!
npx vite

# Cleanup background server on exit
trap "kill $SERVER_PID 2>/dev/null" EXIT
