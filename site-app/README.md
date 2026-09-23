# Dynamische devsite: setkaarten bij kenteken

De bron van `site-app/views/sets.ejs` is de op 23 september 2026 gedeployde
`/var/www/hulpveren-dev-site/app/views/sets.ejs`. Deze devsite draait los van
de statische webroot die de bestaande GitHub-workflow deployt.

De server selecteert de kits voor de generatie. De template controleerde de
platformcodes nogmaals en sloeg kits zonder lokale match over, terwijl de
vergelijkingstabel dezelfde kits wel toonde. Daardoor gaf L948VT twee
aldoc-referenties (HV-199525 en HV-199545) en nul setkaarten.

Deze wijziging gebruikt voor zulke reeds geselecteerde kits de fitments van
hetzelfde merk en model. De kenteken-API beperkt daarna de kaarten tot de
exacte referenties, ook wanneer iemand een filter wijzigt of reset.

## Devsite bijwerken na review

Voer op de server vanuit de GitHub-checkout uit:

```bash
bash site-app/deploy-set-view-dev.sh
```

Het script controleert de SHA-256 van de bestaande template, compileert de
nieuwe EJS-bron en bewaart een backup. Het werkt alleen de dynamische devsite
bij. Controleer daarna of de devsite de nieuwe template gebruikt (herstart
zo nodig het proces wegens EJS-viewcache) en verifieer:

```bash
curl -ks 'https://dev.hulpveren.shop/hulpveren/volkswagen/touran/touran-1t/?kt=L948VT' |
  grep -A2 'data-set-filter-card'
```

HV-199525 en HV-199545 moeten in de kaart-SKU's voorkomen. Controleer in de
browser dat voor L948VT precies deze twee kaarten overblijven en dat filteren
en resetten geen andere set terugbrengen.
