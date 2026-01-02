#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/var/www/dev.hulpveren.shop/public}"
REMOTE="${REMOTE:-origin}"
BRANCH="${1:-main}"
EXPECTED_REMOTE="${EXPECTED_REMOTE:-info772/hulpveren-dev}"
WEB_USER="${WEB_USER:-www-data}"
WEB_GROUP="${WEB_GROUP:-www-data}"
NGINX_SERVICE="${NGINX_SERVICE:-nginx}"
BASE_URL="${BASE_URL:-http://127.0.0.1}"
HOST_HEADER="${HOST_HEADER:-dev.hulpveren.shop}"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "Missing git repo at $REPO_DIR" >&2
  exit 1
fi

cd "$REPO_DIR"

REMOTE_URL="$(git remote get-url "$REMOTE" 2>/dev/null || true)"
if [ -n "$REMOTE_URL" ] && ! echo "$REMOTE_URL" | grep -q "$EXPECTED_REMOTE"; then
  echo "Unexpected origin: $REMOTE_URL (expected $EXPECTED_REMOTE)" >&2
  exit 1
fi

git fetch "$REMOTE"
git reset --hard "$REMOTE/$BRANCH"

if [ -f package.json ] && grep -q "\"build\"" package.json; then
  npm install --no-audit --no-fund
  npm run build
fi

BUILD_ID="$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"
echo "$BUILD_ID" > assets/build-id.txt
chmod 644 assets/build-id.txt

chown -R "$WEB_USER:$WEB_GROUP" "$REPO_DIR"
find "$REPO_DIR" -type d -exec chmod 755 {} +
find "$REPO_DIR" -type f -exec chmod 644 {} +

nginx -t
systemctl reload "$NGINX_SERVICE"

curl -fsSI -H "Host: $HOST_HEADER" "$BASE_URL/assets/js/header.js?v=$BUILD_ID"
curl -fsS -H "Host: $HOST_HEADER" "$BASE_URL/assets/js/header.js?v=$BUILD_ID" \
  | grep -q 'PARTIAL_URL = "/partials/header-v2.html"'
curl -fsSI -H "Host: $HOST_HEADER" "$BASE_URL/partials/header-v2.html"

echo "Deploy complete (build id: $BUILD_ID)."
