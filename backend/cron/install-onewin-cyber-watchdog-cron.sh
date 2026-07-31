#!/usr/bin/env bash
# Install cron: 1win cybersport stream watchdog every 2 minutes.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER="$SCRIPT_DIR/run-onewin-cyber-watchdog.sh"
CRON_LINE='*/2 * * * * /bin/bash '"$RUNNER"

chmod +x "$RUNNER" "$SCRIPT_DIR/../scripts/onewin-cyber-watchdog.js"

if ! command -v crontab >/dev/null 2>&1; then
  echo "Ошибка: crontab не найден"
  exit 1
fi

TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -v 'run-onewin-cyber-watchdog.sh' > "$TMP" || true
echo "$CRON_LINE" >> "$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "1win cyber watchdog cron installed (every 2 min):"
crontab -l | grep run-onewin-cyber-watchdog.sh
echo "Log: /home/kendall-stack/logs/onewin-cyber-watchdog.log"
echo "State: /home/kendall-stack/logs/onewin-cyber-watchdog.state.json"
