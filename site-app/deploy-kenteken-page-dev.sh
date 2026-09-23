#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_js="$repo_root/wwwroot/assets/js/app.js"
target_js="/var/www/hulpveren-dev-site/public/assets/js/app.js"
original_blob="433984794d9d78370b5a8aa1d74a0da51e4426bd"

node --check "$source_js"

source_blob="$(git hash-object "$source_js")"
deployed_blob="$(git hash-object "$target_js")"
if [[ "$deployed_blob" == "$source_blob" ]]; then
  echo "Kentekenfix staat al op de devsite."
  exit 0
fi

if [[ "$deployed_blob" != "$original_blob" ]]; then
  echo "Het gedeployde app.js verschilt van de GitHub-bron waarop deze fix is gebaseerd." >&2
  echo "Verwacht: $original_blob; gevonden: $deployed_blob. Niets overschreven." >&2
  exit 1
fi

backup="$target_js.bak.$(date -u +%Y%m%dT%H%M%SZ)"
cp -p "$target_js" "$backup"
cp "$source_js" "$target_js"
echo "Kentekenfix gedeployd. Backup: $backup"
echo "Controleer daarna https://dev.hulpveren.shop/kenteken/?kt=L948VT met een harde refresh."
