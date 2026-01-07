## Data quality tooling

Doelen:
- JSON-bronnen ontdekken voor merken/modellen/sets.
- Schema + logische validaties uitvoeren.
- MAD-regel (laatste cijfer artikelnummer) afdwingen en afgeleide velden schrijven als `derived.*`.

### Installatie
Gebruik de bestaande Node die al aanwezig is. Geen globale deps nodig.

```bash
npm install --prefix tools/data-quality
```

### Commando's
- `npm run data:lint`   — discover + load + schema + logica, schrijft rapporten naar `tools/data-quality/out/`.
- `npm run data:derive` — lint + afgeleide velden schrijven naar `tools/data-quality/out/derived/` (originele JSON blijft onaangeroerd).
- `npm run data:check`  — lint + derive in één run.
- `npm run data:fix`    — produceert veilige fix-suggesties (geen wijzigingen op bron) in `tools/data-quality/out/fixes.json`.
- `npm run data:smoke`  — kleine SEO smoke: checkt sample SKU’s op contradicties.

Exit codes:
- `0` bij alleen INFO/WARN.
- `2` als er één of meer ERROR-findings zijn.

Outputs:
- `tools/data-quality/out/lint-report.json`
- `tools/data-quality/out/lint-report.md`
- `tools/data-quality/out/derived/…` (mirror van de inputstructuur, inclusief `derived.*` velden).
- `tools/data-quality/out/fixes.json` (suggesties voor SD/HV velden, toepassen gebeurt handmatig).

Helper in templates:
- Gebruik `getField(record, key)` (beschikbaar in de data-layer) om eerst `record[key]` en anders `record.derived[key]` te pakken. Zo werken dynamische velden met derivaties.

Belangrijk:
- Productie-JSON nooit overschrijven; alle derivaties gaan naar `out/derived`.
- MAD suffix regel is leidend: laatste cijfer bepaalt `springApplication`, SD-* impliceert `includesFSD=true`. Conflicten worden als ERROR gerapporteerd.
