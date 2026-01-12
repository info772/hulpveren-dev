# Hulpveren Content & Data Manager (v1)

Pragmatische Node/Express backend met admin UI, SQLite en file storage.

## Install

```bash
npm install
```

## Config (.env)

Maak een `.env` in `server/` met:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
SESSION_SECRET=change-me-too
PORT=3000
```

De admin user wordt bij start aangemaakt of bijgewerkt op basis van deze env vars.

Optioneel:

- `NODE_ENV=production` (zet secure cookies aan)
- `PLATE_INCLUDE_RAW=1` (bestaande plate API)
- `PLATE_ENRICH_RDW=1` (verrijk plate API met RDW velden, default aan)
- `GEMONTEERD_DIR` (pad naar gemonteerde fotos, default `/var/www/dev.hulpveren.shop/public/assets/img/Gemonteerd`)
- `STORAGE_ROOT` (default `/var/lib/lowland-api`, bevat blogs/mad/generated)
- `LOG_DIR` (default `/var/log/lowland-api`)
- `DB_PATH` (default `${STORAGE_ROOT}/db.sqlite`)

## Run

```bash
npm start
```

Admin UI:

- `http://localhost:3000/admin/login`
- `http://localhost:3000/admin/gemonteerd` (foto-overzicht + hernoemen)

Admin assets:

- `/admin-assets/gemonteerd/<filename>`
- `/admin-assets/gemonteerd/manifest.json` (no-store)

Storage strategy:

- Runtime data staat buiten de git working tree (storage, logs, sqlite).
- Gebruik de env vars hierboven om paden te wijzigen of data te migreren.

JSON files worden opgebouwd bij server start en via de Rebuild knop in het admin dashboard.

## Folder structure

```
server/
  app.js
  index.js
  db.sqlite
  routes/
  services/
  storage/
    blogs/
    mad/
      imports/
      current.json
    generated/
      blog-index.json
      blog-[slug].json
      mad-index.json
      redirects.json
  public/
  views/
  logs/
    app.log
    errors.log
```

## API endpoints (v1)

- `GET /api/blogs`
- `GET /api/blogs/:slug`
- `GET /api/settings`
- `GET /api/mad/index`
- `GET /api/redirects`

## Admin endpoints (v1)

- `POST /admin/api/blogs`
- `POST /admin/api/mad/upload`
- `POST /admin/api/mad/current`
- `POST /admin/api/rebuild`
- `POST /admin/api/settings`
- `POST /admin/api/redirects`

## Deploy (dev)

Backend endpoint:

- `POST /deploy` (admin session + CSRF + IP allowlist). Returns stdout on success; stderr + HTTP 500 on failure.

Environment (.env):

- `DEPLOY_ALLOWED_IPS` (comma separated, default `127.0.0.1,::1`)
- `DEPLOY_SCRIPT` (optional, default `/usr/local/bin/deploy-dev.sh`)
- `DEPLOY_TIMEOUT_MS` (optional, default `15000`)

Deploy source:

- `/opt/apps/backend/wwwroot/` (git checkout van deze repo; bevat de build output die naar `/var/www/dev.hulpveren.shop/` gaat)

Server setup:

```bash
sudo cp server/scripts/deploy-dev.sh /usr/local/bin/deploy-dev.sh
sudo chmod +x /usr/local/bin/deploy-dev.sh
```

Backend deploy script (dev):

```bash
sudo cp server/scripts/deploy-backend-dev.sh /usr/local/bin/deploy-backend-dev.sh
sudo chmod +x /usr/local/bin/deploy-backend-dev.sh
```

Systemd unit (dev):

```bash
sudo cp server/scripts/lowland-api.service /etc/systemd/system/lowland-api.service
sudo systemctl daemon-reload
sudo systemctl restart lowland-api
```

Sudoers (minimal):

```bash
sudo tee /etc/sudoers.d/hulpveren-deploy <<'EOF'
ivor ALL=(root) NOPASSWD: /usr/local/bin/deploy-dev.sh
EOF
sudo chmod 440 /etc/sudoers.d/hulpveren-deploy
```

## Infra apply (nginx + systemd)

Infra wijzigingen worden apart toegepast zodat normale webroot deploys niets in `/etc` overschrijven.

Bronbestanden in repo:

- `infra/nginx/dev.hulpveren.shop.api.conf`
- `infra/systemd/lowland-api.service`
- `infra/apply-infra.sh`

Apply (root):

```bash
sudo bash infra/apply-infra.sh
```

Scope scheiding:

- Webroot deploy: `server/scripts/deploy-dev.sh` (rsync naar `/var/www/...`, reload nginx)
- Backend deploy: rsync naar `/opt/apps/backend`, `npm ci`, `systemctl restart lowland-api`
- Infra apply: alleen via `infra/apply-infra.sh`

`server/scripts/deploy-dev.sh` voert ook `node --check /opt/apps/backend/server/index.js` uit als die file bestaat.
`server/scripts/deploy-backend-dev.sh` controleert writeable dirs, voert `git pull`, `npm ci/install`, `node --check` en restart uit.

Optionele variabelen voor `infra/apply-infra.sh`:

- `NGINX_VHOST` (default `/etc/nginx/sites-available/dev.hulpveren.shop`)
- `BACKEND_ROOT` (default `/opt/apps/backend`)
- `BACKEND_USER` (default `ivor`)
- `RUNTIME_USER` (default `www-data`)

## Example curl

```bash
curl http://localhost:3000/api/blogs
curl http://localhost:3000/api/settings
curl http://localhost:3000/api/mad/index
```

Rebuild JSONs (auth required):

```bash
curl -X POST http://localhost:3000/admin/api/rebuild \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <token>" \
  --cookie "hv_admin=<session>"
```
