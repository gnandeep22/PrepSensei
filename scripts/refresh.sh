#!/usr/bin/env bash
set -e
export NODE_OPTIONS="--no-network-family-autoselection"

echo "=========================================="
echo "🔄 [PrepSensei] Refreshing Production Server"
echo "=========================================="

# Ensure we run from the project root
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 1. Rebuild optimized production bundle
echo "📦 Step 1/3: Compiling latest code (pnpm run build)..."
pnpm run build

# 2. Stop existing process running on port 3000
echo "🛑 Step 2/3: Stopping previous server on port 3000..."
if command -v fuser >/dev/null 2>&1; then
  fuser -k 3000/tcp 2>/dev/null || true
elif command -v lsof >/dev/null 2>&1; then
  OLD_PID=$(lsof -t -i:3000 2>/dev/null || true)
  if [ -n "$OLD_PID" ]; then
    kill -9 $OLD_PID 2>/dev/null || true
  fi
fi

# Wait for port to be fully freed
sleep 1

# 3. Start new production server in background
echo "🚀 Step 3/3: Starting new Next.js production server..."
nohup ./node_modules/.bin/next start -p 3000 > server.log 2>&1 &
NEW_PID=$!
disown $NEW_PID 2>/dev/null || true

# Health check verification
echo "⏳ Verifying server availability..."
HEALTHY=false
for i in {1..25}; do
  STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
  if [[ "$STATUS_CODE" =~ ^(200|301|302|307|308|404)$ ]]; then
    HEALTHY=true
    break
  fi
  sleep 0.4
done

echo ""
if [ "$HEALTHY" = true ]; then
  echo "✅ Production successfully refreshed and active!"
  echo "📍 Process ID (PID): $NEW_PID"
  echo "🌐 App URL: http://localhost:3000"
  echo "📋 View real-time logs: tail -f server.log"
else
  echo "⚠️ Server started (PID: $NEW_PID) but took longer than expected to respond."
  echo "📋 Check server logs with: cat server.log"
fi
echo "=========================================="
