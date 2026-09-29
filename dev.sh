#!/bin/bash
# Starts backend (Django, :8000) and frontend (Vite, :5173) together.
# Ctrl+C stops both.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backendv2"

cleanup() {
  echo "Stopping servers..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

(cd "$BACKEND_DIR" && source .venv/bin/activate && exec python manage.py runserver 8000) &
BACKEND_PID=$!

(cd "$SCRIPT_DIR" && exec npm run dev -- --port 5173 --strictPort) &
FRONTEND_PID=$!

wait
