#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
SQL_FILE="${ROOT_DIR}/docker/postgres/harden-existing.sql"
CONTAINER="${POSTGRES_CONTAINER:-onex-postgres-1}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

if [[ -z "${POSTGRES_APP_PASSWORD:-}" ]]; then
  POSTGRES_APP_PASSWORD="$(openssl rand -hex 24)"
  echo "POSTGRES_APP_PASSWORD=${POSTGRES_APP_PASSWORD}" >> "${ENV_FILE}"
  echo "Generated POSTGRES_APP_PASSWORD in .env"
fi

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  POSTGRES_PASSWORD="secret"
  echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" >> "${ENV_FILE}"
  echo "Set POSTGRES_PASSWORD=secret in .env (matches existing cluster user)"
fi

docker exec -i "${CONTAINER}" psql -U onex -d onex < "${SQL_FILE}"
docker exec "${CONTAINER}" psql -U onex -d onex -c \
  "ALTER ROLE onex_app WITH PASSWORD '${POSTGRES_APP_PASSWORD}';"

echo "DB hardening applied. App role: onex_app"
