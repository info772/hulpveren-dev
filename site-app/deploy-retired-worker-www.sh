#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_worker="$repo_root/site-app/public/runtime-service-worker.js"
target_worker="/var/www/hulpveren-live-site/public/runtime-service-worker.js"
expected_sha="eb3618ed791a8353e86f61d3483529e8667a2a5b46a05ab011d037279d788032"

if [[ "$(sha256sum "$source_worker" | cut -d ' ' -f 1)" != "$expected_sha" ]]; then
  echo 'GitHub worker verschilt van de gevalideerde versie. Niets gekopieerd.' >&2
  exit 1
fi

if [[ -e "$target_worker" ]]; then
  if ! cmp -s "$source_worker" "$target_worker"; then
    echo "Worker bestaat al en is anders: $target_worker. Niets overschreven." >&2
    exit 1
  fi
else
  install -m 0644 "$source_worker" "$target_worker"
fi

port="$(pm2 jlist | node -e '
  const fs = require("fs");
  const apps = JSON.parse(fs.readFileSync(0, "utf8"));
  const app = apps.find((item) => item.name === "hulpveren-live-site");
  process.stdout.write(String(app && app.pm2_env && app.pm2_env.PORT || ""));
')"
if [[ ! "$port" =~ ^[0-9]+$ ]]; then
  echo 'PM2-poort voor hulpveren-live-site ontbreekt.' >&2
  exit 1
fi

served_sha="$(curl -fsS --max-time 10 -H 'Host: www.hulpveren.shop' \
  "http://127.0.0.1:$port/runtime-service-worker.js?v=3" | sha256sum | cut -d ' ' -f 1)"
if [[ "$served_sha" != "$expected_sha" ]]; then
  echo "Worker-URL serveert onverwachte inhoud: $served_sha" >&2
  exit 1
fi

echo "Opruimworker bereikbaar op de lokale www-app (poort $port)."
echo 'Controleer Cloudflare-cache voor /runtime-service-worker.js?v=3; een eerder gecachte 404 kan blijven bestaan.'
