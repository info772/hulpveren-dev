#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_js="$repo_root/wwwroot/assets/js/app.js"
target_js="/var/www/hulpveren-dev-site/public/assets/js/app.js"
original_blob="433984794d9d78370b5a8aa1d74a0da51e4426bd"
source_page="$repo_root/wwwroot/kenteken/index.html"
target_page="/var/www/hulpveren-dev-site/public/kenteken/index.html"
original_page_blob="47d654e5b66bcb77990e0be5a7890d80493d754c"

node --check "$source_js"

check_target() {
  local source="$1" target="$2" original="$3"
  local source_blob deployed_blob
  source_blob="$(git hash-object "$source")"
  deployed_blob="$(git hash-object "$target")"
  if [[ "$deployed_blob" != "$source_blob" && "$deployed_blob" != "$original" ]]; then
    echo "Het gedeployde bestand $target verschilt van de GitHub-bron waarop deze fix is gebaseerd." >&2
    echo "Verwacht: $original; gevonden: $deployed_blob. Niets overschreven." >&2
    exit 1
  fi
}

check_target "$source_js" "$target_js" "$original_blob"
check_target "$source_page" "$target_page" "$original_page_blob"

for pair in "js" "page"; do
  if [[ "$pair" == "js" ]]; then
    source="$source_js"
    target="$target_js"
  else
    source="$source_page"
    target="$target_page"
  fi
  if [[ "$(git hash-object "$source")" == "$(git hash-object "$target")" ]]; then
    echo "$target staat al op de juiste versie."
    continue
  fi
  backup="$target.bak.$(date -u +%Y%m%dT%H%M%SZ)"
  cp -p "$target" "$backup"
  cp "$source" "$target"
  echo "$target bijgewerkt. Backup: $backup"
done
echo "Controleer daarna https://dev.hulpveren.shop/kenteken/?kt=L948VT met een harde refresh."
