#!/usr/bin/env bash
# Wrapper для cron: live WC bet probe внутри onex-backend-1
set -euo pipefail

LOG_DIR="${WC_BET_PROBE_LOG_DIR:-/home/kendall-stack/logs}"
LOG_FILE="${LOG_DIR}/wc-bet-probe.log"
CONTAINER="${WC_BET_PROBE_CONTAINER:-onex-backend-1}"

mkdir -p "$LOG_DIR"

{
  echo "=== $(date -Is) wc-bet-probe start ==="
  if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    echo "ERROR: container $CONTAINER not running"
    exit 1
  fi
  docker exec "$CONTAINER" bash /app/scripts/wc-bet-probe.sh
  echo "=== $(date -Is) wc-bet-probe done (exit $?) ==="
} >> "$LOG_FILE" 2>&1
