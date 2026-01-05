#!/usr/bin/env bash
set -euo pipefail

# Static webroot deploy only. Does not touch /etc or backend service files.
SRC="/opt/apps/backend/wwwroot/"
DEST="/var/www/dev.hulpveren.shop/"
BACKEND_ROOT="/opt/apps/backend"

echo "Deploy start: ${SRC} -> ${DEST}"

if [ ! -d "$SRC" ]; then
  echo "Source not found: $SRC" >&2
  exit 1
fi

mkdir -p "$DEST"
chown www-data:www-data "$DEST"
chmod 755 "$DEST"

rsync -a --delete --chown=www-data:www-data --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r "$SRC" "$DEST"

if [ -f "$BACKEND_ROOT/server/index.js" ]; then
  echo "Running backend syntax check..."
  node --check "$BACKEND_ROOT/server/index.js"
fi

echo "Validating nginx config..."
nginx -t

echo "Reloading nginx..."
systemctl reload nginx

echo "Deploy completed."
