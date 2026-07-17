#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export WC_SMOKE_BASE_URL="${WC_SMOKE_BASE_URL:-https://imba.bet}"
export WC_SMOKE_MIN_MARKETS="${WC_SMOKE_MIN_MARKETS:-5}"

NOTIFY_URL="${TELEGRAM_NOTIFY_SMOKE_URL:-http://imba-bot:8088/notify-smoke}"
NOTIFY_SECRET="${NOTIFY_SECRET:-}"

notify_failure() {
  # Telegram alerts disabled — smoke output stays in cron log only.
  return 0
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
