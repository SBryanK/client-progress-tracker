#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy script for client-progress-tracker on DevCloud CVM (9.134.41.81)
# Domain: https://sbryankusno-any6.devcloud.woa.com
#
# This binds Next.js on port 80 (the canonical HTTP port the DevCloud domain
# is reachable on from outside the office). It does NOT use Docker.
#
# Run as root (DevCloud CVMs let you bind privileged ports as root):
#   sudo bash deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/data/workspace/client-progress-tracker"
LOG_FILE="/tmp/client-progress-tracker.log"
PORT="${PORT:-80}"

cd "$APP_DIR"

echo "==> 1/7  Stopping any previous instance on port $PORT"
# Kill old Next.js / node listening on that port. Ignore errors if none.
( fuser -k "${PORT}/tcp" 2>/dev/null ) || true
pkill -f "next.*start" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 2

echo "==> 2/7  Checking Node.js"
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js not found. Install Node 20+ first:"
  echo "  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && yum install -y nodejs"
  exit 1
fi
node -v
npm -v

echo "==> 3/7  Installing dependencies (npm ci)"
if [ -f package-lock.json ]; then
  npm ci --registry=https://mirrors.tencent.com/npm/ || npm install --registry=https://mirrors.tencent.com/npm/
else
  npm install --registry=https://mirrors.tencent.com/npm/
fi

echo "==> 4/7  Generating Prisma client + syncing SQLite schema"
npx prisma generate
npx prisma db push --accept-data-loss --skip-generate

echo "==> 5/7  (Re)building Next.js for production"
rm -rf .next
npm run build

echo "==> 6/7  Starting app on port $PORT (bound to 0.0.0.0)"
# HOSTNAME=0.0.0.0 + PORT=80 makes `next start` listen on every interface.
# nohup + disown lets it survive the SSH session closing.
HOSTNAME=0.0.0.0 PORT="$PORT" nohup npx next start -H 0.0.0.0 -p "$PORT" \
  > "$LOG_FILE" 2>&1 &
APP_PID=$!
disown || true

echo "    PID=$APP_PID  log=$LOG_FILE"
sleep 8

echo "==> 7/7  Smoke-testing http://127.0.0.1:$PORT/"
if curl -sS -o /dev/null -w "HTTP %{http_code}\n" "http://127.0.0.1:$PORT/" ; then
  echo ""
  echo "✅ App is up. Try these URLs in your browser:"
  echo "   http://sbryankusno-any6.devcloud.woa.com/"
  echo "   https://sbryankusno-any6.devcloud.woa.com/      (if TLS is terminated by AnyDev gateway)"
  echo ""
  echo "   Tail logs with:  tail -f $LOG_FILE"
else
  echo "⚠️  App not responding yet on port $PORT. Last 60 log lines:"
  tail -n 60 "$LOG_FILE" || true
  exit 1
fi

# Need root/sudo for docker unless user is in docker group.
if ! docker info >/dev/null 2>&1; then
  SUDO="sudo"
else
  SUDO=""
fi

cmd="${1:-up}"

case "$cmd" in
  up|start|deploy|"")
    echo "==> Checking port 80 on host..."
    if $SUDO ss -ltnp 2>/dev/null | grep -qE ':80\s'; then
      echo "WARN: Port 80 is already in use:"
      $SUDO ss -ltnp | grep -E ':80\s' || true
      echo "    If this is apache/nginx, stop it:  sudo systemctl stop apache2 nginx"
    fi

    echo "==> Building & starting container (first build ~3-5 min)..."
    $SUDO $DC up -d --build

    echo "==> Waiting 15s for boot..."
    sleep 15
    $SUDO $DC ps

    echo ""
    echo "==> Last 40 log lines:"
    $SUDO $DC logs --tail 40 web || true

    echo ""
    echo "==> Local HTTP probe (host -> container):"
    curl -skI -m 5 http://127.0.0.1/ | head -3 || echo "(no response on port 80)"

    echo ""
    echo "==> If the above returned HTTP 200/307, open:"
    echo "    https://sbryankusno-any6.devcloud.woa.com"
    ;;

  status|ps)
    $SUDO $DC ps
    echo ""
    echo "-- port 80 listeners --"
    $SUDO ss -ltnp | grep -E ':80\s' || echo "(nothing listening on :80)"
    echo ""
    echo "-- local http probe --"
    curl -skI -m 5 http://127.0.0.1/ | head -3 || echo "(no response)"
    ;;

  logs|log|tail)
    $SUDO $DC logs -f --tail 200 web
    ;;

  rebuild|reset)
    echo "==> Tearing down (keeps volume 'app-data')..."
    $SUDO $DC down
    echo "==> Pruning old image..."
    $SUDO docker image rm -f client-progress-tracker:latest 2>/dev/null || true
    echo "==> Rebuilding from scratch..."
    $SUDO $DC build --no-cache
    $SUDO $DC up -d
    sleep 15
    $SUDO $DC ps
    $SUDO $DC logs --tail 60 web
    ;;

  nuke)
    echo "WARN: This deletes the SQLite DB volume too. Ctrl+C to abort (5s)..."
    sleep 5
    $SUDO $DC down -v
    $SUDO docker image rm -f client-progress-tracker:latest 2>/dev/null || true
    echo "Nuked. Run ./deploy.sh to rebuild."
    ;;

  diag|debug|doctor)
    echo "###### ENV ######"
    uname -a
    echo "hostname: $(hostname)"
    echo "ip: $(hostname -I 2>/dev/null || true)"
    echo
    echo "###### DOCKER ######"
    docker --version || true
    $DC version || true
    $SUDO systemctl is-active docker 2>/dev/null || true
    echo
    echo "###### FILES ######"
    ls -la Dockerfile docker-compose.yml .env docker/entrypoint.sh 2>&1 || true
    echo
    echo "###### CONTAINER ######"
    $SUDO $DC ps || true
    echo
    echo "###### PORT 80/3000 ######"
    $SUDO ss -ltnp | grep -E ':(80|3000)\s' || echo "(nothing on :80 or :3000)"
    echo
    echo "###### LOCAL HTTP ######"
    echo "-- :80 --"
    curl -skI -m 5 http://127.0.0.1/ | head -5 || echo "(no response)"
    echo "-- :3000 --"
    curl -skI -m 5 http://127.0.0.1:3000/ | head -5 || echo "(no response)"
    echo
    echo "###### LAST 100 LOG LINES ######"
    $SUDO $DC logs --tail 100 web 2>&1 || echo "(container not running)"
    ;;

  *)
    echo "Usage: $0 [up|status|logs|rebuild|nuke|diag]"
    exit 2
    ;;
esac
