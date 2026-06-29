#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export WC_BET_PROBE_BASE_URL="${WC_BET_PROBE_BASE_URL:-https://imba.bet}"
export WC_BET_PROBE_SPORT="${WC_BET_PROBE_SPORT:-all}"
export WC_BET_PROBE_PLACE="${WC_BET_PROBE_PLACE:-1}"
export WC_BET_PROBE_USER_ID="${WC_BET_PROBE_USER_ID:-$(node scripts/ensure-wc-probe-user.js)}"
export WC_PROBE_SECRET="${WC_PROBE_SECRET:-${TELEGRAM_NOTIFY_SECRET:-}}"
export WC_BET_PROBE_MAX_EVENTS="${WC_BET_PROBE_MAX_EVENTS:-1}"
export WC_BET_PROBE_MAX_BETS="${WC_BET_PROBE_MAX_BETS:-1}"
export WC_BET_PROBE_MAX_OUTCOMES="${WC_BET_PROBE_MAX_OUTCOMES:-6}"
export WC_BET_PROBE_STAKE="${WC_BET_PROBE_STAKE:-100}"

NOTIFY_URL="${TELEGRAM_NOTIFY_SMOKE_URL:-http://imba-bot:8088/notify-smoke}"
NOTIFY_SECRET="${TELEGRAM_NOTIFY_SECRET:-${NOTIFY_SECRET:-}}"

if [[ -z "${WC_BET_PROBE_TOKEN:-}" && "${WC_BET_PROBE_PLACE}" == "1" ]]; then
  WC_BET_PROBE_TOKEN="$(node scripts/mint-wc-probe-token.js)"
  export WC_BET_PROBE_TOKEN
fi

notify_probe() {
  local exit_code="$1"
  local headline="$2"
  local details="$3"
  if [[ -z "$NOTIFY_URL" ]]; then
    return 0
  fi
  PROBE_HEADLINE="$headline" PROBE_EXIT="$exit_code" \
    node scripts/notify-wc-probe.js <<<"$details" || true
}

set +e
OUTPUT="$(npx ts-node -r tsconfig-paths/register scripts/wc-bet-probe.ts 2>&1)"
EXIT=$?
set -e

echo "$OUTPUT"

if [[ $EXIT -ne 0 ]]; then
  notify_probe "$EXIT" "🚨 WC bet probe — есть проблемы со ставками" "$OUTPUT"
  exit "$EXIT"
fi

if echo "$OUTPUT" | grep -qE '^\| Errors \| [1-9]'; then
  notify_probe "1" "🚨 WC bet probe — ошибки settlement/ставок" "$OUTPUT"
  exit 1
fi

if echo "$OUTPUT" | grep -qE '^\| Warnings \| [1-9]'; then
  notify_probe "0" "⚠️ WC bet probe — предупреждения (проверить)" "$OUTPUT"
fi

exit 0
