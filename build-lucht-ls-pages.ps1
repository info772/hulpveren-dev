# build-lucht-ls-pages.ps1
# Genereert luchtvering- en verlagingsveren-pagina's o.b.v. JSON + HTML-templates

$root      = "C:\dev\hulpveren-dev"
$wwwroot   = Join-Path $root "wwwroot"
$dataDir   = Join-Path $wwwroot "data"
$tplDir    = Join-Path $root "templates"
$partials  = Join-Path $root "partials"

$headerHtml = Get-Content (Join-Path $partials "header.html") -Raw
$footerHtml = Get-Content (Join-Path $partials "footer.html") -Raw

# Helpers
function Read-Json($path){
    if (-not (Test-Path $path)) {
        Write-Host "JSON niet gevonden: $path" -ForegroundColor Red
        return @()
    }
    return Get-Content $path -Raw | ConvertFrom-Json
}

function Render-Page {
    param(
        [string]$Template,
        [hashtable]$values
    )
    $out = $Template
    foreach($key in $values.Keys){
        $out = $out.Replace($key, [string]$values[$key])
    }
    return $out
}

function Render-LoopPage {
    param(
        [string]$Template,
        [string]$sectionStartTag,
        [string]$sectionEndTag,
        [hashtable]$pageValues,
        [object]$items,
        [ScriptBlock]$itemMapFactory
    )

    $startIdx = $Template.IndexOf($sectionStartTag)
    $endIdx   = $Template.IndexOf($sectionEndTag)

    if ($startIdx -lt 0 -or $endIdx -lt 0 -or $endIdx -le $startIdx) {
        return (Render-Page -Template $Template -values $pageValues)
    }

    $before     = $Template.Substring(0, $startIdx)
    $blockStart = $startIdx + $sectionStartTag.Length
    $blockLen   = $endIdx - $blockStart
    $block      = $Template.Substring($blockStart, $blockLen)
    $after      = $Template.Substring($endIdx + $sectionEndTag.Length)

    # 👉 items altijd omzetten naar een array-achtige collectie
    if ($null -eq $items) {
        $itemsEnum = @()
    }
    elseif ($items -is [System.Collections.IEnumerable] -and -not ($items -is [string])) {
        $itemsEnum = $items
    }
    else {
        $itemsEnum = @($items)
    }

    $renderedItems = ""

    foreach($item in $itemsEnum){
        $tmp = $block
        $tmp = Render-Page -Template $tmp -values $pageValues

        $itemValues = & $itemMapFactory $item
        if ($itemValues) {
            $tmp = Render-Page -Template $tmp -values $itemValues
        }

        $renderedItems += $tmp
    }

    $out = $before + $renderedItems + $after
    $out = Render-Page -Template $out -values $pageValues
    return $out
}


# ========== 1) LUCHTVERING – MODEL-PAGINA'S ==========

$luchtModelTplPath = Join-Path $tplDir "lucht-model-utf8.html"
if (-not (Test-Path $luchtModelTplPath)) {
    Write-Host "Template niet gevonden: $luchtModelTplPath" -ForegroundColor Red
} else {
    $luchtModelTpl = Get-Content $luchtModelTplPath -Raw
    $nrModelJson   = Join-Path $dataDir "nr-model-pages.json"
    $nrModelPages  = Read-Json $nrModelJson

    Write-Host "Luchtvering MODEL-pagina's genereren..." -ForegroundColor Cyan

    foreach($page in $nrModelPages){
        $make      = $page.MAKE
        $model     = $page.MODEL
        $makeSlug  = $page.MAKE_SLUG
        $modelSlug = $page.MODEL_SLUG

        $pageValues = @{
            '{{MAKE}}'       = $make
            '{{MODEL}}'      = $model
            '{{MAKE_SLUG}}'  = $makeSlug
            '{{MODEL_SLUG}}' = $modelSlug
        }

        $sets = $page.SETS

        $html = Render-LoopPage `
            -Template        $luchtModelTpl `
            -sectionStartTag '{{#SETS}}' `
            -sectionEndTag   '{{/SETS}}' `
            -pageValues      $pageValues `
            -items           $sets `
            -itemMapFactory  {
                param($set)
                @{
                    '{{SKU}}'         = $set.SKU
                    '{{TITLE}}'       = $set.TITLE
                    '{{IMAGE_URL}}'   = $set.IMAGE_URL
                    '{{POSITION_NL}}' = $set.POSITION_NL
                    '{{YEARS}}'       = $set.YEARS
                    '{{APPROVAL}}'    = $set.APPROVAL
                }
            }

        $html = $html.Replace("{{HEADER}}", $headerHtml).Replace("{{FOOTER}}", $footerHtml)

        $outDir  = Join-Path $wwwroot ("luchtvering\" + $makeSlug + "\" + $modelSlug)
        $outFile = Join-Path $outDir "index.html"
        [System.IO.Directory]::CreateDirectory($outDir) | Out-Null
        $html | Set-Content $outFile -Encoding UTF8

        Write-Host "  - $make $model -> $outFile"
    }
}

# ========== 2) LUCHTVERING – MERK-PAGINA'S ==========

$luchtBrandTplPath = Join-Path $tplDir "lucht-merk.html"
if (-not (Test-Path $luchtBrandTplPath)) {
    Write-Host "Template niet gevonden: $luchtBrandTplPath" -ForegroundColor Yellow
} else {
    $luchtBrandTpl = Get-Content $luchtBrandTplPath -Raw
    $nrBrandJson   = Join-Path $dataDir "nr-brand-pages.json"
    $nrBrandPages  = Read-Json $nrBrandJson

    Write-Host "Luchtvering MERK-pagina's genereren..." -ForegroundColor Cyan

    foreach($brand in $nrBrandPages){
        $make     = $brand.MAKE
        $makeSlug = $brand.MAKE_SLUG
        $models   = $brand.MODELS

        $pageValues = @{
            '{{MAKE}}'      = $make
            '{{MAKE_SLUG}}' = $makeSlug
        }

        $html = Render-LoopPage `
            -Template        $luchtBrandTpl `
            -sectionStartTag '{{#MODELS}}' `
            -sectionEndTag   '{{/MODELS}}' `
            -pageValues      $pageValues `
            -items           $models `
            -itemMapFactory  {
                param($m)
                @{
                    '{{MODEL}}'      = $m.MODEL_NAME
                    '{{MODEL_NAME}}' = $m.MODEL_NAME
                    '{{MODEL_SLUG}}' = $m.MODEL_SLUG
                }
            }

        $html = $html.Replace("{{HEADER}}", $headerHtml).Replace("{{FOOTER}}", $footerHtml)

        $outDir  = Join-Path $wwwroot ("luchtvering\" + $makeSlug)
        $outFile = Join-Path $outDir "index.html"
        [System.IO.Directory]::CreateDirectory($outDir) | Out-Null
        $html | Set-Content $outFile -Encoding UTF8

        Write-Host "  - merk $make -> $outFile"
    }
}

# ========== 3) VERLAGINGSVEREN – MODEL-PAGINA'S ==========

$lsModelTplPath = Join-Path $tplDir "ls-model.html"
if (-not (Test-Path $lsModelTplPath)) {
    Write-Host "Template niet gevonden: $lsModelTplPath" -ForegroundColor Yellow
} else {
    $lsModelTpl = Get-Content $lsModelTplPath -Raw
    $lsModelJson = Join-Path $dataDir "ls-model-pages.json"
    $lsModelPages = Read-Json $lsModelJson

    Write-Host "Verlagingsveren MODEL-pagina's genereren..." -ForegroundColor Cyan

    foreach($page in $lsModelPages){
        $make      = $page.MAKE
        $model     = $page.MODEL
        $makeSlug  = $page.MAKE_SLUG
        $modelSlug = $page.MODEL_SLUG

        $pageValues = @{
            '{{MAKE}}'       = $make
            '{{MODEL}}'      = $model
            '{{MAKE_SLUG}}'  = $makeSlug
            '{{MODEL_SLUG}}' = $modelSlug
        }

        $sets = $page.SETS

        $html = Render-LoopPage `
            -Template        $lsModelTpl `
            -sectionStartTag '{{#SETS}}' `
            -sectionEndTag   '{{/SETS}}' `
            -pageValues      $pageValues `
            -items           $sets `
            -itemMapFactory  {
                param($set)
                @{
                    '{{SKU}}'        = $set.SKU
                    '{{IMAGE_URL}}'  = $set.IMAGE_URL
                    '{{DROP_FRONT}}' = $set.DROP_FRONT
                    '{{DROP_REAR}}'  = $set.DROP_REAR
                    '{{DROP}}'       = $set.DROP
                    '{{YEARS}}'      = $set.YEARS
                    '{{PRICE}}'      = $set.PRICE
                }
            }

        $html = $html.Replace("{{HEADER}}", $headerHtml).Replace("{{FOOTER}}", $footerHtml)

        $outDir  = Join-Path $wwwroot ("verlagingsveren\" + $makeSlug + "\" + $modelSlug)
        $outFile = Join-Path $outDir "index.html"
        [System.IO.Directory]::CreateDirectory($outDir) | Out-Null
        $html | Set-Content $outFile -Encoding UTF8

        Write-Host "  - $make $model -> $outFile"
    }
}

# ========== 4) VERLAGINGSVEREN – MERK-PAGINA'S ==========

$lsBrandTplPath = Join-Path $tplDir "ls-merk.html"
if (-not (Test-Path $lsBrandTplPath)) {
    Write-Host "Template niet gevonden: $lsBrandTplPath" -ForegroundColor Yellow
} else {
    $lsBrandTpl = Get-Content $lsBrandTplPath -Raw
    $lsBrandJson = Join-Path $dataDir "ls-brand-pages.json"
    $lsBrandPages = Read-Json $lsBrandJson

    Write-Host "Verlagingsveren MERK-pagina's genereren..." -ForegroundColor Cyan

    foreach($brand in $lsBrandPages){
        $make     = $brand.MAKE
        $makeSlug = $brand.MAKE_SLUG
        $models   = $brand.MODELS

        $pageValues = @{
            '{{MAKE}}'      = $make
            '{{MAKE_SLUG}}' = $makeSlug
        }

        $html = Render-LoopPage `
            -Template        $lsBrandTpl `
            -sectionStartTag '{{#MODELS}}' `
            -sectionEndTag   '{{/MODELS}}' `
            -pageValues      $pageValues `
            -items           $models `
            -itemMapFactory  {
                param($m)
                @{
                    '{{MODEL_NAME}}' = $m.MODEL_NAME
                    '{{MODEL}}'      = $m.MODEL_NAME
                    '{{MODEL_SLUG}}' = $m.MODEL_SLUG
                }
            }

        $html = $html.Replace("{{HEADER}}", $headerHtml).Replace("{{FOOTER}}", $footerHtml)

        $outDir  = Join-Path $wwwroot ("verlagingsveren\" + $makeSlug)
        $outFile = Join-Path $outDir "index.html"
        [System.IO.Directory]::CreateDirectory($outDir) | Out-Null
        $html | Set-Content $outFile -Encoding UTF8

        Write-Host "  - merk $make -> $outFile"
    }
}

Write-Host "Klaar met luchtvering + verlagingsveren pagina's." -ForegroundColor Green
