#!/usr/bin/env bash
set -euo pipefail

BACKEND_ROOT="${BACKEND_ROOT:-/opt/apps/backend}"
SERVICE_NAME="${SERVICE_NAME:-lowland-api}"
STORAGE_ROOT="${STORAGE_ROOT:-/var/lib/lowland-api}"
LOG_DIR="${LOG_DIR:-/var/log/lowland-api}"
DB_PATH="${DB_PATH:-${STORAGE_ROOT}/db.sqlite}"

echo "Deploying backend in ${BACKEND_ROOT}"

require_dir() {
  local dir="$1"
  local label="$2"
  if [ -z "$dir" ]; then
    echo "ERROR: ${label} is empty." >&2
    exit 1
  fi
  if [ ! -d "$dir" ]; then
    echo "Creating ${label} directory: ${dir}"
    mkdir -p "$dir"
  fi
  chown -R www-data:www-data "$dir"
  if ! sudo -u www-data test -w "$dir"; then
    echo "ERROR: ${label} is not writable by www-data: ${dir}" >&2
    exit 1
  fi
}

require_dir "$STORAGE_ROOT" "STORAGE_ROOT"
require_dir "$LOG_DIR" "LOG_DIR"
require_dir "$(dirname "$DB_PATH")" "DB_PATH directory"

cd "$BACKEND_ROOT"
if [ ! -d ".git" ]; then
  echo "ERROR: ${BACKEND_ROOT} is not a git repository." >&2
  exit 1
fi

git pull --ff-only

if [ -f "${BACKEND_ROOT}/server/package-lock.json" ]; then
  (cd server && npm ci)
else
  (cd server && npm install)
fi

node --check "${BACKEND_ROOT}/server/index.js"

echo "Restarting ${SERVICE_NAME}..."
systemctl restart "${SERVICE_NAME}"

if ! systemctl is-active --quiet "${SERVICE_NAME}"; then
  echo "Service failed to start. Status + logs:"
  systemctl status --no-pager "${SERVICE_NAME}" || true
  journalctl -u "${SERVICE_NAME}" -n 100 --no-pager || true
  exit 1
fi

echo "Deploy completed."
