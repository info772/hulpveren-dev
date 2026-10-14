#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
environment="${1:-}"
case "$environment" in
  dev)
    target="/var/www/hulpveren-dev-site/app/server.js"
    process="hulpveren-dev-site"
    ;;
  www)
    target="/var/www/hulpveren-live-site/app/server.js"
    process="hulpveren-live-site"
    ;;
  *)
    echo 'Gebruik: bash site-app/deploy-plate-speed.sh dev|www' >&2
    exit 2
    ;;
esac

# Read the active process configuration; hard-coded ports can point at another app.
port="$(pm2 jlist | node -e '
  const fs = require("fs");
  const apps = JSON.parse(fs.readFileSync(0, "utf8"));
  const app = apps.find((item) => item.name === process.argv[1]);
  process.stdout.write(String(app && app.pm2_env && app.pm2_env.PORT || ""));
' "$process")"
if [[ ! "$port" =~ ^[0-9]+$ ]]; then
  echo "Geen geldige PORT gevonden in PM2 voor $process; niets gewijzigd." >&2
  exit 1
fi

echo "$process gebruikt poort $port"
node "$repo_root/site-app/patch-plate-speed.js" "$target" --check
node "$repo_root/site-app/patch-plate-speed.js" "$target"
pm2 restart "$process"

# PM2 may report online before the listener is ready. Allow a short startup window.
for attempt in {1..30}; do
  if curl -fsS --max-time 5 -o /dev/null "http://127.0.0.1:$port/api/plate/preview/l948vt"; then
    echo "$process luistert op poort $port. Controleer ook de oplossingen en kaarten in de browser."
    exit 0
  fi
  sleep 1
done
echo "De lokale preview-API is nog niet bereikbaar op $port; controleer pm2 logs $process." >&2
exit 1
