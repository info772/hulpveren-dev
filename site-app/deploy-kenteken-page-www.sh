#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
patch_js="$repo_root/site-app/patch-www-kenteken-app.js"
target_js="/var/www/hulpveren-live-site/public/assets/js/app.js"
source_page="$repo_root/wwwroot/kenteken/index.html"
target_page="/var/www/hulpveren-live-site/public/kenteken/index.html"
original_page_blob="47d654e5b66bcb77990e0be5a7890d80493d754c"

# Controleer beide bestanden voordat er iets in productie wordt gewijzigd.
node "$patch_js" "$target_js" --check
source_blob="$(git hash-object "$source_page")"
deployed_blob="$(git hash-object "$target_page")"
if [[ "$deployed_blob" != "$source_blob" && "$deployed_blob" != "$original_page_blob" ]]; then
  echo "Productie kenteken/index.html wijkt af. Verwacht: $original_page_blob; gevonden: $deployed_blob. Niets overschreven." >&2
  exit 1
fi

node "$patch_js" "$target_js"
if [[ "$deployed_blob" == "$source_blob" ]]; then
  echo "$target_page staat al op de juiste versie."
else
  backup="$target_page.bak.$(date -u +%Y%m%dT%H%M%SZ)"
  cp -p "$target_page" "$backup"
  cp "$source_page" "$target_page"
  echo "$target_page bijgewerkt. Backup: $backup"
fi
echo "Controleer https://www.hulpveren.shop/kenteken/?kt=L948VT"
