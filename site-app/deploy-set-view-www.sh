#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_view="$repo_root/site-app/views/sets.ejs"
site_root="/var/www/hulpveren-live-site/app"
target_view="$site_root/views/sets.ejs"
expected_sha="590349b9effe299b1793fd9bad0ee97cdde14dfc0f83189688f5fdd14da84cf5"

actual_sha="$(sha256sum "$target_view" | cut -d ' ' -f 1)"
if [[ "$actual_sha" != "$expected_sha" ]]; then
  echo "De gedeployde template is gewijzigd sinds de bronkopie. Niets overschreven." >&2
  echo "Verwacht: $expected_sha; gevonden: $actual_sha" >&2
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

backup="$target_view.bak.$(date -u +%Y%m%dT%H%M%SZ)"
cp -p "$target_view" "$backup"
cp "$source_view" "$target_view"
echo "Template bijgewerkt. Backup: $backup"
echo "Herstart daarna hulpveren-live-site met PM2 en controleer de Touran- en kentekenpagina op www."
