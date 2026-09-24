#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_view="$repo_root/site-app/views/sets.ejs"
case "${1:-}" in
  dev)
    site_root="/var/www/hulpveren-dev-site/app"
    process="hulpveren-dev-site"
    host="dev.hulpveren.shop"
    ;;
  www)
    site_root="/var/www/hulpveren-live-site/app"
    process="hulpveren-live-site"
    host="www.hulpveren.shop"
    ;;
  *)
    echo 'Gebruik: bash site-app/deploy-fabia-greenline.sh dev|www' >&2
    exit 2
    ;;
esac

target_view="$site_root/views/sets.ejs"
expected_sha="fb952662e74efc68f31543b51d50b363715a6cc17dbe4babbb9349d34fafbcdf"
source_sha="cb1de8248f2ba7989539ec2c6f68db6da40c822e3930b602e189afe650a508c8"

actual_sha="$(sha256sum "$target_view" | cut -d ' ' -f 1)"
if [[ "$actual_sha" != "$expected_sha" && "$actual_sha" != "$source_sha" ]]; then
  echo "De gedeployde view is gewijzigd: $actual_sha. Niets overschreven." >&2
  exit 1
fi
if [[ "$(sha256sum "$source_view" | cut -d ' ' -f 1)" != "$source_sha" ]]; then
  echo 'GitHub-bron verschilt van de gevalideerde Fabia-view. Niets overschreven.' >&2
  exit 1
fi

node - "$source_view" "$site_root" <<'NODE'
const fs = require('fs');
const path = require('path');
const source = process.argv[2];
const siteRoot = process.argv[3];
const ejs = require(path.join(siteRoot, 'node_modules/ejs'));
ejs.compile(fs.readFileSync(source, 'utf8'), { filename: source });
console.log('EJS_COMPILE_OK');
NODE

if [[ "$actual_sha" != "$source_sha" ]]; then
  backup="$target_view.bak.$(date -u +%Y%m%dT%H%M%SZ)"
  cp -p "$target_view" "$backup"
  cp "$source_view" "$target_view"
  echo "View bijgewerkt. Backup: $backup"
fi

port="$(pm2 jlist | node -e '
  const fs = require("fs");
  const apps = JSON.parse(fs.readFileSync(0, "utf8"));
  const app = apps.find((item) => item.name === process.argv[1]);
  process.stdout.write(String(app && app.pm2_env && app.pm2_env.PORT || ""));
' "$process")"
if [[ ! "$port" =~ ^[0-9]+$ ]]; then
  echo "PM2-poort voor $process ontbreekt; controleer de site na herstart." >&2
  exit 1
fi

pm2 restart "$process"
for attempt in {1..30}; do
  if curl -fsS --max-time 5 -H "Host: $host" \
    "http://127.0.0.1:$port/hulpveren/skoda/fabia/ii-545/" \
    | grep 'MAD vermeldt: niet voor GreenLine. Controleer geschiktheid' >/dev/null; then
    echo "Fabia-aandachtspunten bereikbaar op $host (poort $port). Controleer ook ?kt=12TVG4 in de browser."
    exit 0
  fi
  sleep 1
done
echo "Fabia-pagina op $host nog niet bevestigd; controleer pm2 logs $process." >&2
exit 1
