#!/bin/bash

# Swagger Scanner - Start Script
cd "$(dirname "$0")"

# Ensure MongoDB container is running
if docker ps --format '{{.Names}}' | grep -q swagger-mongo; then
  echo "✓ MongoDB already running"
elif docker ps -a --format '{{.Names}}' | grep -q swagger-mongo; then
  echo "Starting existing MongoDB container..."
  docker start swagger-mongo
else
  echo "Creating MongoDB container..."
  docker run -d --name swagger-mongo -p 27017:27017 mongo:7
fi

# Wait for MongoDB to be ready
echo "Waiting for MongoDB..."
for i in $(seq 1 15); do
  if docker exec swagger-mongo mongosh --quiet --eval "db.runCommand({ping:1})" >/dev/null 2>&1; then
    echo "✓ MongoDB ready"
    break
  fi
  sleep 1
done

# Install dependencies
echo "Installing dependencies..."
npm install --registry https://registry.npmjs.org

# Kill any leftover processes on our ports
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:4444 | xargs kill -9 2>/dev/null

echo ""
echo "Starting Swagger Scanner..."
echo "  Frontend: http://localhost:4444"
echo "  Backend:  http://localhost:3001"
echo "  MongoDB:  mongodb://localhost:27017/swagger-scanner"
echo ""

# Start backend server in background
node server/index.js &
SERVER_PID=$!

# Cleanup on exit
trap "kill $SERVER_PID 2>/dev/null" EXIT

# Start frontend (foreground)
npx vite
