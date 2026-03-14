#!/usr/bin/env bash
# =============================================================================
# restart.sh — Full Juhudi Kilimo system restart
#
# Kills ALL stale Juhudi processes (backend, frontend, prisma studio),
# clears ports 4000 and 5173, then starts both services fresh.
#
# Usage:  ./scripts/restart.sh
# =============================================================================

set -uo pipefail

JUHUDI="$HOME/claude/juhudi"
BACKEND_LOG="/tmp/juhudi-backend.log"
FRONTEND_LOG="/tmp/juhudi-frontend.log"

# ── colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${YELLOW}▶  $*${NC}"; }
success() { echo -e "${GREEN}✓  $*${NC}"; }
err()     { echo -e "${RED}✗  $*${NC}"; }
dim()     { echo -e "   $*"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║    Juhudi Kilimo — System Restart        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Kill all stale Juhudi processes ───────────────────────────────────────
info "Stopping all Juhudi processes..."

# Backend  — tsx watch + child node processes inside juhudi/backend
if pkill -f "$JUHUDI/backend" 2>/dev/null; then
  dim "backend processes killed"
else
  dim "no backend processes running"
fi

# Frontend — vite + esbuild inside juhudi/frontend
if pkill -f "$JUHUDI/frontend" 2>/dev/null; then
  dim "frontend processes killed"
else
  dim "no frontend processes running"
fi

# Prisma Studio (long-running admin tool, port 5555)
pkill -f "prisma.*studio" 2>/dev/null && dim "prisma studio killed" || true

# Brief pause so OS releases file handles
sleep 2

# ── 2. Force-clear ports 4000 and 5173 ───────────────────────────────────────
for port in 4000 5173; do
  PIDS=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    info "Port $port still occupied — force-killing PIDs: $PIDS"
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
done

success "All stale processes cleared"
echo ""

# ── 3. Start backend ──────────────────────────────────────────────────────────
info "Starting backend..."
cd "$JUHUDI/backend"
nohup npm run dev > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
disown $BACKEND_PID

echo -n "   Waiting for backend to be ready"
READY=0
for i in $(seq 1 40); do
  if curl -sf http://localhost:4000/health > /dev/null 2>&1; then
    READY=1; break
  fi
  echo -n "."; sleep 1
done
echo ""

if [ $READY -eq 1 ]; then
  success "Backend ready  → http://localhost:4000  (PID $BACKEND_PID)"
else
  err "Backend did not become ready within 40s"
  dim "Check logs: tail -f $BACKEND_LOG"
  echo ""
fi

# ── 4. Start frontend ─────────────────────────────────────────────────────────
info "Starting frontend..."
cd "$JUHUDI/frontend"
nohup npm run dev > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
disown $FRONTEND_PID

echo -n "   Waiting for frontend to be ready"
READY=0
for i in $(seq 1 40); do
  if curl -sf http://localhost:5173 > /dev/null 2>&1; then
    READY=1; break
  fi
  echo -n "."; sleep 1
done
echo ""

if [ $READY -eq 1 ]; then
  success "Frontend ready → http://localhost:5173  (PID $FRONTEND_PID)"
else
  err "Frontend did not become ready within 40s"
  dim "Check logs: tail -f $FRONTEND_LOG"
  echo ""
fi

# ── 5. PostgreSQL check (informational only — not managed by this script) ─────
if (echo >/dev/tcp/localhost/5432) 2>/dev/null; then
  success "PostgreSQL      → localhost:5432  ✓"
else
  err "PostgreSQL is NOT responding on port 5432"
  dim "Start it with: brew services start postgresql@15"
fi

# ── 6. Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Done${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo "  Backend:   http://localhost:4000"
echo "  Frontend:  http://localhost:5173"
echo ""
echo "  Live logs:"
echo "    tail -f $BACKEND_LOG"
echo "    tail -f $FRONTEND_LOG"
echo ""
