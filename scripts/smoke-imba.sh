#!/bin/bash
set -euo pipefail

BASE="${IMBA_BASE_URL:-https://imba.bet}"
FAIL=0

check() {
  local name="$1"
  local url="$2"
  local expect="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
  if [[ "$code" == "$expect" ]]; then
    echo "OK  $name ($code)"
  else
    echo "FAIL $name (got $code, want $expect)"
    FAIL=1
  fi
}

echo "==> imba.bet smoke: $BASE"

check "feed status" "$BASE/api/feed/status"
check "homepage" "$BASE/"
check "line" "$BASE/line"
check "health" "$BASE/api/health"

# Auth-required endpoints should return 401 without token
check "bets/my unauth" "$BASE/api/feed/bets/my" 401
check "user unauth" "$BASE/api/user" 401

if docker ps --format '{{.Names}}' | grep -q '^onex-backend-1$'; then
  if docker exec onex-backend-1 grep -q "placeExpressBet" /app/dist/src/integrations/wc-odds/wc-odds.controller.js 2>/dev/null; then
    echo "OK  backend express route in dist"
  else
    echo "FAIL backend express route missing in dist"
    FAIL=1
  fi
fi

if [[ "$FAIL" -eq 0 ]]; then
  echo "==> All smoke checks passed"
  exit 0
fi

echo "==> Smoke checks failed"
exit 1
