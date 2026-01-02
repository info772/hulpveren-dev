# Kentekenzoeker + proxyv7 integratie
<!-- Fix Summary:
  Broken: /kenteken auto-init + redirect behavior was undefined in docs.
  Change: Documented /kenteken/?kt= auto-init and /kenteken/<plate> redirect behavior.
  Test: /kenteken/?kt=13GTRG auto-loads; /kenteken/13GTRG redirects.
-->

## Wijzigingen (kenteken route)
- `assets/js/app.js`: herkent `/hulpveren/<make>/<model>/kt_<plate>`, haalt Aldoc data via `/api/plate/:plate`, filtert sets en rendert dezelfde kaarten.
- `assets/js/plate.js`: auto-init lookup op `/kenteken/?kt=...` en schrijft `hv_plate_make_slug` + `hv_plate_model_slug`.
- `web.config`: IIS rewrite voor `kt_` routes naar de model shell.
- `docs/server/nginx-hulpveren-kt.conf`: nginx snippet voor dezelfde rewrite.
- `infra/nginx/dev.hulpveren.shop.api.conf`: redirect `/kenteken/<plate>` -> `/kenteken/?kt=<plate>` voor autoload.

## Kenteken-URL routing (server)
Gebruik de juiste snippet voor de host:

- IIS: `web.config` bevat de rewrite rule. Plaats deze in de root van de site (of merge met bestaande rewrite rules).
- nginx: gebruik `docs/server/nginx-hulpveren-kt.conf` in de server block (of include als snippet).
- nginx (dev): `infra/nginx/dev.hulpveren.shop.api.conf` bevat de `/kenteken/<plate>` redirect; apply via `infra/apply-infra.sh`.

De front-end verwacht een backend endpoint:
- `GET /api/plate/:plate` (zie Backend sectie). Deze response wordt 15 minuten gecached in `sessionStorage` (key `plate:<plate>`).

## Response samenvatting (live inspectie)

### GetTypesByLicenseplateNL (XML)
Pad: `/mmt.ashx?operation=GetTypesByLicenseplateNL&plate=28NJN7`

Top-level `SingleTypes` met:
- `message`
- `singletypes/SingleType[]` met velden:
  - `makecode`, `makename`
  - `modelcode`, `modelname`, `model_remark`
  - `bodytype`
  - `typecode`, `typename`, `type_remark`
  - `fuelcode`, `enginetype`
  - `kw` (kan nil zijn), `kw_cat`
  - `grouptype`, `ktyp`
  - `drivetype`
  - `engine_contents`, `nocyl`
  - `type_from`, `type_till`

### Menu (JSON)
Pad: `/PartServices/api/Menu/`

Structuur:
- `MenuItems[]` met `MenuCode`, `Menu`, `State`
- `PageStart`, `PageSize`, `TotalRecords`

### Menuparts (JSON)
Pad: `/PartServices/api/Menuparts/0/46918`

Structuur:
- `MenuItems[]` met `MenuCode`, `Menu`, `State`, optioneel `MenuParts[]`
- `MenuParts[]` bevat `PartName`, `PartCode`, `Suppliers[]`
- `Suppliers[]` bevat `Name`, `Code`, `MenuId`
- `PageStart`, `PageSize`, `TotalRecords`

## Backend (Node/Express)

### Start
```
cd server
npm install
set PROXYV7_BASE=http://proxyv7.easycarparts.nl
set PORT=3000
node index.js
```

### Environment
- `PROXYV7_BASE` (default `http://proxyv7.easycarparts.nl`)
- `PROXY_TIMEOUT_MS` (default `8000`)
- `PLATE_INCLUDE_RAW` (set `1` to include raw XML in `/api/plate`)
- `PORT` (default `3000`)

### Endpoints
- `GET /api/plate/:plate`
  - Response: `{ plate, vehicleCandidates: [...], source: "proxyv7", raw? }`
  - Caching: 24h in memory
  - Rate limit: 30 req/min per IP
- `GET /api/menu`
  - Response: `{ items: [...] }`
- `GET /api/menuparts/:rootId/:nodeId`
  - Response: `{ rootId, nodeId, items: [...] }`
  - Caching: 6h in memory

### Logging
Elke request logt:
- request id
- masked plate (bv `28****`) en hash (sha256 prefix)
- status en upstream ms

## Front-end

### Include
```
<link rel="stylesheet" href="/assets/css/plate.css" />
<div id="hv-plate-widget" data-hv-plate></div>
<script src="/assets/js/plate.js"></script>
```

### Helpers
```
window.HVPlate.getSelectedVehicle()
window.HVPlate.clear()
```

### Menu browser
```
const vehicle = window.HVPlate.getSelectedVehicle();
const menu = await window.HVPlate.Menu.loadMenu();
const parts = await window.HVPlate.Menu.loadRelevantMenuParts(vehicle);
```

### Storage keys
- `hv_plate`
- `hv_vehicle_selected`
- `hv_vehicle_selected_at`
- `hv_plate_make_slug`
- `hv_plate_model_slug`

## Notes (deploy)
- `assets/js/plate.js` is een statisch bestand in de webroot; wijzigingen gaan mee met de webroot deploy.
- `/kenteken/<plate>` redirect zit in de nginx snippet en wordt toegepast via `infra/apply-infra.sh`.

## Handmatige testcases
- Geldig kenteken: open `/hulpveren/volkswagen/caddy-iii-2ka-2kh-2ca-2ch/kt_5vll95` en controleer dat er een grid met sets staat.
- Onbekend kenteken: open `/hulpveren/volkswagen/caddy/kt_onbekend` en controleer de lege-state + CTA.
- API down: stop de backend en open een kenteken-URL; controleer de error-state met CTA.

## Mapping config
Bestand: `/config/menuMapping.json`
```
{
  "defaultRootId": 0,
  "defaultNodeId": null,
  "byMake": {
    "Volkswagen": { "nodeId": 46918 }
  }
}
```
Breid `byMake` uit per merk of voeg `rootId` toe per entry.

## Smoke tests
De tests verwachten dat de server draait.
```
cd server
set SMOKE_BASE_URL=http://localhost:3000
set SMOKE_ONLINE=1
npm test
```
Zonder internet kun je `SMOKE_ONLINE` weglaten om de tests te skippen.
