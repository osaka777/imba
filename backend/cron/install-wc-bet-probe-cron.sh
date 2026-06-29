#!/usr/bin/env bash
# Устанавливает cron: WC bet probe каждые 15 минут (live ставки + Telegram алерты).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER="$SCRIPT_DIR/run-wc-bet-probe.sh"
CRON_LINE='*/15 * * * * /bin/bash '"$RUNNER"

chmod +x "$RUNNER"

if ! command -v crontab >/dev/null 2>&1; then
  echo "Ошибка: crontab не найден. apt install cron"
  exit 1
fi

TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -v 'run-wc-bet-probe.sh' > "$TMP" || true
echo "$CRON_LINE" >> "$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "WC bet probe cron installed (every 15 min):"
crontab -l | grep run-wc-bet-probe.sh
echo "Log: /home/kendall-stack/logs/wc-bet-probe.log"
