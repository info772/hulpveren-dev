# Genereert alle /hulpveren/<merk>/ en /hulpveren/<merk>/<model>/ pagina's
# op basis van:
# - wwwroot/data/hv-kits.json
# - wwwroot/hulpveren/index.html als HTML-template

$ErrorActionPreference = "Stop"

$root    = Split-Path -Parent $PSCommandPath
$wwwroot = Join-Path $root "wwwroot"

Write-Host "HV (hulpveren) pagina's bouwen..." -ForegroundColor Green

$hvDataPath   = Join-Path $wwwroot "data\hv-kits.json"
$templatePath = Join-Path $wwwroot "hulpveren\index.html"


if (-not (Test-Path $hvDataPath)) {
    throw "HV data ontbreekt: $hvDataPath"
}
if (-not (Test-Path $templatePath)) {
    throw "Template ontbreekt (basis /hulpveren/index.html): $templatePath"
}

$baseHtml = Get-Content $templatePath -Raw

# === 2. Hulpfuncties ===

function Invoke-Slugify {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) { return "" }

    $s = [string]$Value
    $s = $s.Trim()
    $s = $s.Normalize([System.Text.NormalizationForm]::FormD)
    $s = -join ($s.ToCharArray() | Where-Object {
        [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne [Globalization.UnicodeCategory]::NonSpacingMark
    })
    $s = $s.ToLowerInvariant()
    $s = $s -replace "&"," and "
    $s = $s -replace "#",""
    $s = $s -replace "[^a-z0-9]+","-"
    $s = $s.Trim("-")

    return $s
}

function Update-HeadMeta {
    param(
        [string]$Html,
        [string]$Title,
        [string]$Description,
        [string]$Canonical
    )

    # simpele HTML-escaping
    $tEsc = $Title.Replace("&","&amp;").Replace("<","&lt;").Replace(">","&gt;")
    $dEsc = $Description.Replace("&","&amp;").Replace("<","&lt;").Replace(">","&gt;").Replace('"','&quot;')
    $cEsc = $Canonical.Replace("&","&amp;").Replace("<","&lt;").Replace(">","&gt;").Replace('"','&quot;')

    $opts   = [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    $optsSL = $opts -bor [System.Text.RegularExpressions.RegexOptions]::Singleline

    $out = $Html

    # <title>…</title>
    $out = [regex]::Replace(
        $out,
        '<title>.*?</title>',
        "<title>$tEsc</title>",
        $optsSL
    )

    # meta description
    $out = [regex]::Replace(
        $out,
        '<meta\s+name="description"\s+content="[^"]*"\s*/?>',
        "<meta name=`"description`" content=`"$dEsc`" />",
        $opts
    )

    # canonical link
    $out = [regex]::Replace(
        $out,
        '<link\s+rel="canonical"\s+href="[^"]*"\s*/?>',
        "<link rel=`"canonical`" href=`"$cEsc`" />",
        $opts
    )

    # OG tags (optioneel aanwezig)
    $out = [regex]::Replace(
        $out,
        '<meta\s+property="og:title"\s+content="[^"]*"\s*/?>',
        "<meta property=`"og:title`" content=`"$tEsc`" />",
        $opts
    )
    $out = [regex]::Replace(
        $out,
        '<meta\s+property="og:description"\s+content="[^"]*"\s*/?>',
        "<meta property=`"og:description`" content=`"$dEsc`" />",
        $opts
    )
    $out = [regex]::Replace(
        $out,
        '<meta\s+property="og:url"\s+content="[^"]*"\s*/?>',
        "<meta property=`"og:url`" content=`"$cEsc`" />",
        $opts
    )

    return $out
}

function Ensure-Dir {
    param([string]$Path)
    $dir = Split-Path $Path -Parent
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

# === 3. hv-kits.json inlezen en merken/modellen opbouwen ===

$raw = Get-Content $hvDataPath -Raw | ConvertFrom-Json

# hv-kits.json mag óf een array zijn, óf { kits: [ ... ] }
if ($raw.kits) {
    $hvKits = @($raw.kits)
} elseif ($raw -is [System.Collections.IEnumerable]) {
    $hvKits = @($raw)
} else {
    $hvKits = @()
}

if ($hvKits.Count -eq 0) {
    throw "hv-kits.json bevat geen sets (0 items)"
}
# makeSlug -> object { Label, Slug, Models (hashtable modelSlug -> Label) }
$makeMap = @{}

# LET OP: hier stond eerst $kits, dat is nu gefixt naar $hvKits
foreach ($kit in $hvKits) {
    if (-not $kit.fitments) { continue }

    foreach ($fit in $kit.fitments) {
        $makeLabel  = [string]$fit.make
        $modelLabel = [string]$fit.model

        if ([string]::IsNullOrWhiteSpace($makeLabel) -or
            [string]::IsNullOrWhiteSpace($modelLabel)) {
            continue
        }

        $makeSlug  = Invoke-Slugify $makeLabel
        $modelSlug = Invoke-Slugify $modelLabel

        if (-not $makeSlug -or -not $modelSlug) { continue }

        if (-not $makeMap.ContainsKey($makeSlug)) {
            $makeMap[$makeSlug] = [pscustomobject]@{
                Slug   = $makeSlug
                Label  = $makeLabel
                Models = @{}
            }
        }

        $entry  = $makeMap[$makeSlug]
        $models = $entry.Models

        # langste merknaam bewaren
        if ($makeLabel.Length -gt $entry.Label.Length) {
            $entry.Label = $makeLabel
        }

        if (-not $models.ContainsKey($modelSlug)) {
            $models[$modelSlug] = $modelLabel
        } else {
            # langere/betere modelnaam wint
            if ($modelLabel.Length -gt $models[$modelSlug].Length) {
                $models[$modelSlug] = $modelLabel
            }
        }
    }
}

if (-not $makeMap.Count) {
    throw "Geen merken/modellen opgebouwd uit hv-kits.json"
}

# === 4. Merkenpagina's genereren ===

$siteBase = "https://www.hulpveren.shop"

$sortedMakes = $makeMap.GetEnumerator() | Sort-Object { $_.Value.Label }

foreach ($m in $sortedMakes) {
    $makeSlug  = $m.Key
    $makeLabel = $m.Value.Label

    $title = "Hulpveren - $makeLabel | MAD Sets met montage"
    $desc  = "MAD hulpveren voor $makeLabel. Vind de juiste set per model en bouwjaar. Montage inclusief prijs."
        $canon = "$siteBase/hulpveren/$makeSlug"

    $html = Update-HeadMeta -Html $baseHtml -Title $title -Description $desc -Canonical $canon

    $outRel = "hulpveren\$makeSlug\index.html"
    $outAbs = Join-Path $wwwroot $outRel

    Ensure-Dir $outAbs
    $html | Out-File -FilePath $outAbs -Encoding UTF8

    Write-Host "HV merkpagina geschreven: $outRel" -ForegroundColor Cyan
}

# === 5. Modelpagina's genereren ===

foreach ($m in $sortedMakes) {
    $makeSlug   = $m.Key
    $makeLabel  = $m.Value.Label
    $modelsHash = $m.Value.Models

    $sortedModels = $modelsHash.GetEnumerator() | Sort-Object Value

    foreach ($mod in $sortedModels) {
        $modelSlug  = $mod.Key
        $modelLabel = $mod.Value

        $title = "Hulpveren - $makeLabel $modelLabel | MAD Sets met montage"
        $desc  = "MAD hulpveren voor $makeLabel $modelLabel. Sets per bouwjaar, inclusief montage en btw."
        $canon = "$siteBase/hulpveren/$makeSlug/$modelSlug"

        $html = Update-HeadMeta -Html $baseHtml -Title $title -Description $desc -Canonical $canon

        $outRel = "hulpveren\$makeSlug\$modelSlug\index.html"
        $outAbs = Join-Path $wwwroot $outRel

        Ensure-Dir $outAbs
        $html | Out-File -FilePath $outAbs -Encoding UTF8

        Write-Host "HV modelpagina geschreven: $outRel" -ForegroundColor Yellow
    }
}

Write-Host "HV pagina's klaar." -ForegroundColor Green
