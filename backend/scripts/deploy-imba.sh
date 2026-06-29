#!/bin/bash
set -euo pipefail

# Деплой только imba.bet. Не трогает Kendall (kendall-store, kendall-landing, kendall-network).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SERVICE="${1:-}"

echo "==> Изолированный деплой: imba.bet"
echo "    Каталог: $ROOT"
echo "    Не трогаем: kendall-store, kendall-landing, kendall-network"

if [[ -n "$SERVICE" ]]; then
  echo "==> docker compose up -d --no-deps --build $SERVICE"
  docker compose up -d --no-deps --build "$SERVICE"
else
  echo "==> docker compose up -d --build frontend backend imba-bot"
  docker compose up -d --build frontend backend imba-bot
fi

echo "==> Готово: imba.bet (Kendall-проекты не затронуты)"
