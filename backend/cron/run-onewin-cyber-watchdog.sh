#!/usr/bin/env bash
# Watchdog: if cybersport streams die while 1win still has them — restart backend.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${ONEWIN_WD_LOG_DIR:-/home/kendall-stack/logs}"
LOG_FILE="${LOG_DIR}/onewin-cyber-watchdog.log"
SCRIPT="$ROOT/scripts/onewin-cyber-watchdog.js"

mkdir -p "$LOG_DIR"

{
  echo "=== $(date -Is) onewin-cyber-watchdog start ==="
  /usr/bin/env node "$SCRIPT"
  echo "=== $(date -Is) onewin-cyber-watchdog done (exit $?) ==="
} >> "$LOG_FILE" 2>&1
