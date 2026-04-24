#!/bin/bash

cd "$(dirname "$0")"

# --- MongoDB Native ---
MONGO_URI=mongodb://127.0.0.1:27017/open-api-scanner

# Check if MongoDB is running natively
echo "Checking for native MongoDB..."
if mongosh --quiet --eval "db.runCommand({ping:1})" "$MONGO_URI" >/dev/null 2>&1; then
  echo "✓ MongoDB already running natively"
else
  echo "❌ MongoDB not running."

  # Check if mongod is installed at all
  if ! command -v mongod >/dev/null 2>&1 && [ ! -f "/usr/local/mongodb/bin/mongod" ]; then
    echo "MongoDB is not installed. Installing via Homebrew..."

    if ! command -v brew >/dev/null 2>&1; then
      echo "❌ Homebrew is not installed. Please install Homebrew first:"
      echo '   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
      exit 1
    fi

    # Add the MongoDB tap and install
    echo "Adding MongoDB tap..."
    brew tap mongodb/brew
    echo "Installing mongodb-community..."
    if ! brew install mongodb-community; then
      echo ""
      echo "❌ Failed to install MongoDB. Attempting to fix Command Line Tools..."
      echo ""
      
      # Try to automatically fix Command Line Tools
      echo "Removing old Command Line Tools..."
      sudo rm -rf /Library/Developer/CommandLineTools 2>/dev/null || true
      
      echo "Installing new Command Line Tools..."
      echo "⚠️  A dialog will appear - click 'Install' to continue"
      sudo xcode-select --install
      
      echo ""
      echo "Waiting for Command Line Tools installation to complete..."
      echo "This may take several minutes. Please complete the installation dialog."
      echo ""
      
      # Wait for user to complete the installation
      while ! xcode-select -p >/dev/null 2>&1; do
        echo "Waiting for Command Line Tools installation... (press Ctrl+C to cancel)"
        sleep 5
      done
      
      echo "✓ Command Line Tools installation detected. Retrying MongoDB installation..."
      
      # Retry MongoDB installation
      if ! brew install mongodb-community; then
        echo ""
        echo "❌ MongoDB installation still failed after updating Command Line Tools."
        echo ""
        echo "Additional steps you may need:"
        echo "  1. Update Xcode from the App Store to version 26.3+"
        echo "  2. Restart your terminal"
        echo "  3. Re-run: ./start.sh"
        echo ""
        echo "Or install MongoDB manually:"
        echo "  brew tap mongodb/brew"
        echo "  brew install mongodb-community"
        exit 1
      fi
      
      echo "✓ MongoDB installed successfully after fixing Command Line Tools"
    fi
  fi

  # Create data and log directories (use sudo if needed)
  for dir in /usr/local/var/mongodb /usr/local/var/log/mongodb; do
    if [ ! -d "$dir" ]; then
      mkdir -p "$dir" 2>/dev/null || sudo mkdir -p "$dir"
    fi
  done

  # Now start MongoDB
  echo "Starting MongoDB..."
  if command -v brew >/dev/null 2>&1 && brew services list | grep -q mongodb-community; then
    brew services start mongodb/brew/mongodb-community
  elif [ -f "/usr/local/mongodb/bin/mongod" ]; then
    /usr/local/mongodb/bin/mongod --dbpath /usr/local/var/mongodb --logpath /usr/local/var/log/mongodb/mongo.log --fork
  else
    echo "❌ MongoDB binary not found. Please install MongoDB."
    exit 1
  fi

  # Wait for MongoDB to be ready (up to 15 seconds)
  echo "Waiting for MongoDB to start..."
  for i in $(seq 1 15); do
    if mongosh --quiet --eval "db.runCommand({ping:1})" "$MONGO_URI" >/dev/null 2>&1; then
      echo "✓ MongoDB started successfully"
      break
    fi
    if [ "$i" -eq 15 ]; then
      echo "❌ MongoDB failed to start after 15 seconds."
      echo "   Try running manually: brew services start mongodb/brew/mongodb-community"
      exit 1
    fi
    sleep 1
  done
fi

# Install dependencies
echo "Installing dependencies..."
npm install --registry https://registry.npmjs.org

# Kill leftover processes
lsof -ti:3002 | xargs kill -9 2>/dev/null
lsof -ti:4444 | xargs kill -9 2>/dev/null

echo ""
echo "Starting Open API Scanner..."
echo "  Frontend: http://localhost:4444"
echo "  Backend:  http://localhost:3002"
echo "  MongoDB:  $MONGO_URI"
echo ""

# Start backend
MONGODB_URI=$MONGO_URI node server/index.js &
SERVER_PID=$!

trap "kill $SERVER_PID 2>/dev/null" EXIT

# Start frontend (foreground)
npx vite
