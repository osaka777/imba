#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export WC_SMOKE_BASE_URL="${WC_SMOKE_BASE_URL:-https://imba.bet}"
export WC_SMOKE_MIN_MARKETS="${WC_SMOKE_MIN_MARKETS:-5}"

NOTIFY_URL="${TELEGRAM_NOTIFY_SMOKE_URL:-http://imba-bot:8088/notify-smoke}"
NOTIFY_SECRET="${NOTIFY_SECRET:-}"

notify_failure() {
  local exit_code="$1"
  local details="$2"
  if [[ -z "$NOTIFY_URL" ]]; then
    return 0
  fi
  local payload
  payload="$(python3 -c '
import json, os, sys
print(json.dumps({
    "message": "WC markets smoke check failed",
    "details": sys.stdin.read()[:3500],
    "exitCode": int(os.environ.get("SMOKE_EXIT", "1")),
}))
' <<<"$details")"
  local headers=(-H "Content-Type: application/json")
  if [[ -n "$NOTIFY_SECRET" ]]; then
    headers+=(-H "X-Notify-Secret: $NOTIFY_SECRET")
  fi
  curl -sf -X POST "$NOTIFY_URL" "${headers[@]}" -d "$payload" >/dev/null 2>&1 || true
}

set +e
OUTPUT="$(npm run test:smoke 2>&1)"
EXIT=$?
set -e

if [[ $EXIT -ne 0 ]]; then
  SMOKE_EXIT="$EXIT" notify_failure "$EXIT" "$OUTPUT"
  echo "$OUTPUT"
  exit "$EXIT"
fi

echo "$OUTPUT"
