#!/bin/bash
# Добавляет DNS-запись partners.imba.bet в Cloudflare (CNAME → imba.bet, proxied).
#
# Использование:
#   CF_API_TOKEN=xxx CF_ZONE_ID=yyy bash cloudflare-add-partners-dns.sh
# или положите переменные в /root/onex/backend/.env.cloudflare
#
# CF_API_TOKEN — API Token с правом Zone:DNS:Edit
# CF_ZONE_ID   — ID зоны imba.bet (Dashboard → imba.bet → Overview → Zone ID)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.cloudflare"
[[ -f "$ENV_FILE" ]] && set -a && source "$ENV_FILE" && set +a

: "${CF_API_TOKEN:?Set CF_API_TOKEN (Cloudflare API token with Zone.DNS.Edit)}"
: "${CF_ZONE_ID:?Set CF_ZONE_ID (zone id for imba.bet)}"

NAME="${1:-partners}"
TARGET="${2:-imba.bet}"

echo "==> Cloudflare: create CNAME ${NAME}.imba.bet → ${TARGET} (proxied)"

RESP=$(curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"type\":\"CNAME\",\"name\":\"${NAME}\",\"content\":\"${TARGET}\",\"proxied\":true,\"ttl\":1}")

if echo "$RESP" | grep -q '"success":true'; then
  echo "==> OK: DNS record created"
  echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"
  exit 0
fi

if echo "$RESP" | grep -qi 'already exists'; then
  echo "==> Record already exists — updating..."
  RECORD_ID=$(curl -sS -G "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    --data-urlencode "name=${NAME}.imba.bet" \
    --data-urlencode "type=CNAME" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'][0]['id'] if d.get('result') else '')" 2>/dev/null || true)
  if [[ -n "$RECORD_ID" ]]; then
    curl -sS -X PUT "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${RECORD_ID}" \
      -H "Authorization: Bearer ${CF_API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "{\"type\":\"CNAME\",\"name\":\"${NAME}\",\"content\":\"${TARGET}\",\"proxied\":true,\"ttl\":1}" | python3 -m json.tool
    exit 0
  fi
fi

echo "==> FAILED:"
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"
exit 1
