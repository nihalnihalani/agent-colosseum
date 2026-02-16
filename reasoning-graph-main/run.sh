#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_PORT=${BACKEND_PORT:-8000}
FRONTEND_PORT=${FRONTEND_PORT:-3000}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Print colored message
print_msg() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Load environment variables
load_env() {
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
        print_msg "$GREEN" "✓ Environment variables loaded"
    else
        print_msg "$YELLOW" "⚠ No .env file found. Using defaults."
    fi
}

# Kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    
    if [ ! -z "$pid" ]; then
        print_msg "$YELLOW" "⚠ Killing process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null
        sleep 1
    fi
}

# Check if URL is accessible
check_url() {
    local url=$1
    local max_attempts=15
    local attempts=0
    
    while [ $attempts -lt $max_attempts ]; do
        if curl -s -f "$url" >/dev/null 2>&1; then
            return 0
        fi
        attempts=$((attempts + 1))
        sleep 2
    done
    return 1
}

# Check backend health
check_backend() {
    local url="http://localhost:$BACKEND_PORT/health"
    
    if check_url "$url"; then
        local response=$(curl -s "$url" 2>/dev/null)
        if echo "$response" | grep -q '"status":"healthy"'; then
            print_msg "$GREEN" "✓ Backend is healthy"
            return 0
        fi
    fi
    
    print_msg "$RED" "✗ Backend health check failed"
    return 1
}

# Check frontend
check_frontend() {
    local url="http://localhost:$FRONTEND_PORT"
    
    if check_url "$url"; then
        print_msg "$GREEN" "✓ Frontend is accessible"
        return 0
    fi
    
    print_msg "$RED" "✗ Frontend check failed"
    return 1
}

# Cleanup function
cleanup() {
    print_msg "$YELLOW" "\n⚠ Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    print_msg "$GREEN" "✓ Application stopped"
    exit 0
}

# Main execution
main() {
    print_msg "$BLUE" "🚀 Starting Thinking Graph Application\n"
    
    # Load environment
    load_env
    
    # Clean up ports
    print_msg "$BLUE" "📡 Checking ports..."
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT
    
    # Start backend
    print_msg "$BLUE" "\n🔧 Starting Backend (port $BACKEND_PORT)..."
    cd "$SCRIPT_DIR/backend"
    if [ -f "$SCRIPT_DIR/backend/venv/bin/python" ]; then
        "$SCRIPT_DIR/backend/venv/bin/python" app.py > /dev/null 2>&1 &
    else
        python app.py > /dev/null 2>&1 &
    fi
    BACKEND_PID=$!
    
    sleep 3
    
    if ! check_backend; then
        print_msg "$RED" "✗ Backend failed to start"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
    
    # Start frontend
    print_msg "$BLUE" "\n⚡ Starting Frontend (port $FRONTEND_PORT)..."
    cd "$SCRIPT_DIR/frontend"
    npm run dev > /dev/null 2>&1 &
    FRONTEND_PID=$!
    
    sleep 5
    
    if ! check_frontend; then
        print_msg "$RED" "✗ Frontend failed to start"
        kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
        exit 1
    fi
    
    # Success message
    print_msg "$GREEN" "\n✓ Application running successfully!\n"
    print_msg "$BLUE" "📍 Access Points:"
    echo "   Frontend:  http://localhost:$FRONTEND_PORT"
    echo "   Backend:   http://localhost:$BACKEND_PORT"
    echo "   Health:    http://localhost:$BACKEND_PORT/health"
    print_msg "$BLUE" "\n🔧 Process IDs:"
    echo "   Backend:   $BACKEND_PID"
    echo "   Frontend:  $FRONTEND_PID"
    print_msg "$YELLOW" "\n⌨️  Press Ctrl+C to stop\n"
    
    # Set up cleanup trap
    trap cleanup INT TERM
    
    # Wait for processes
    wait
}

main
