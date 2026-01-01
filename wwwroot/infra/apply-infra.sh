#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

NGINX_SNIPPET_SRC="${ROOT}/infra/nginx/dev.hulpveren.shop.api.conf"
NGINX_SNIPPET_DEST="/etc/nginx/snippets/dev.hulpveren.shop.api.conf"
NGINX_VHOST="${NGINX_VHOST:-/etc/nginx/sites-available/dev.hulpveren.shop}"

SYSTEMD_UNIT_SRC="${ROOT}/infra/systemd/lowland-api.service"
SYSTEMD_UNIT_DEST="/etc/systemd/system/lowland-api.service"

BACKEND_ROOT="${BACKEND_ROOT:-/opt/apps/backend}"
BACKEND_USER="${BACKEND_USER:-ivor}"
RUNTIME_USER="${RUNTIME_USER:-www-data}"

backup_file() {
  local file="$1"
  if [ -f "$file" ]; then
    cp -a "$file" "${file}.bak.$(date +%Y%m%d%H%M%S)"
  fi
}

ensure_include_in_servers() {
  local file="$1"
  local include_line="$2"
  local tmp
  tmp="$(mktemp)"
  awk -v include_line="$include_line" '
    function count_braces(line,   i, c) {
      for (i = 1; i <= length(line); i++) {
        c = substr(line, i, 1);
        if (c == "{") depth++;
        else if (c == "}") depth--;
      }
    }
    {
      if (!in_server && $0 ~ /server[[:space:]]*\\{/) {
        in_server = 1;
        has_include = 0;
        depth = 0;
      }
      if (in_server && index($0, include_line) > 0) {
        has_include = 1;
      }
      if (in_server) {
        count_braces($0);
        if (depth == 0) {
          if (!has_include) {
            print include_line;
          }
          print $0;
          in_server = 0;
          next;
        }
      }
      print $0;
    }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

if [ ! -f "$NGINX_SNIPPET_SRC" ]; then
  echo "Missing nginx snippet source: $NGINX_SNIPPET_SRC" >&2
  exit 1
fi

if [ ! -f "$SYSTEMD_UNIT_SRC" ]; then
  echo "Missing systemd unit source: $SYSTEMD_UNIT_SRC" >&2
  exit 1
fi

if [ ! -f "$NGINX_VHOST" ]; then
  echo "Missing nginx vhost file: $NGINX_VHOST" >&2
  exit 1
fi

echo "Installing nginx snippet..."
install -m 644 "$NGINX_SNIPPET_SRC" "$NGINX_SNIPPET_DEST"

echo "Patching nginx vhost to include snippet..."
backup_file "$NGINX_VHOST"
ensure_include_in_servers "$NGINX_VHOST" "  include /etc/nginx/snippets/dev.hulpveren.shop.api.conf;"

echo "Installing systemd unit..."
install -m 644 "$SYSTEMD_UNIT_SRC" "$SYSTEMD_UNIT_DEST"

echo "Fixing permissions..."
if [ -d "$BACKEND_ROOT" ]; then
  chown -R "${BACKEND_USER}:${BACKEND_USER}" "$BACKEND_ROOT"
  for runtime_path in \
    "${BACKEND_ROOT}/server/storage" \
    "${BACKEND_ROOT}/server/logs" \
    "${BACKEND_ROOT}/server/cache"; do
    if [ -d "$runtime_path" ]; then
      chown -R "${RUNTIME_USER}:${RUNTIME_USER}" "$runtime_path"
    fi
  done
  if [ -f "${BACKEND_ROOT}/server/db.sqlite" ]; then
    chown "${RUNTIME_USER}:${RUNTIME_USER}" "${BACKEND_ROOT}/server/db.sqlite"
  fi
fi

echo "Reloading systemd and nginx..."
systemctl daemon-reload
systemctl enable --now lowland-api.service
systemctl status --no-pager lowland-api.service || true
nginx -t
systemctl reload nginx

echo "Health checks..."
curl -fsS http://127.0.0.1/api/health | head -c 200 || true
echo
curl -fsS http://127.0.0.1/api/blogs | head -c 200 || true
echo
curl -fsS http://127.0.0.1/api/settings | head -c 200 || true
echo

echo "Infra apply complete."
