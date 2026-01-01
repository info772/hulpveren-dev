# build-lucht-ls-data.ps1
# ROOT naar je lokale site
$root = "C:\dev\hulpveren-dev\wwwroot"

$nrKitsPath = Join-Path $root 'data\nr-kits.json'
$lsKitsPath = Join-Path $root 'data\ls-kits.json'

# Simpele slug-functie
function Get-Slug {
    param([string]$Text)

    if (-not $Text) { return "" }

    $t = $Text.ToLowerInvariant()
    $t = [regex]::Replace($t, '\s+', '-')
    $t = [regex]::Replace($t, '[^a-z0-9\-]', '')
    $t = $t.Trim('-')
    return $t
}

# Eerste letter hoofdletter, rest klein
function Get-PrettyName {
    param([string]$Text)
    if (-not $Text) { return "" }
    $lower = $Text.ToLowerInvariant()
    return ($lower.Substring(0,1).ToUpper() + $lower.Substring(1))
}

# ============= 1) NR = Luchtvering ===================
Write-Host "NR (luchtvering) data inlezen..."

$nrRaw = Get-Content $nrKitsPath -Raw | ConvertFrom-Json

if (-not ($nrRaw -is [System.Collections.IEnumerable])) {
    if ($nrRaw.kits) {
        $nrKits = $nrRaw.kits
    } elseif ($nrRaw.items) {
        $nrKits = $nrRaw.items
    } else {
        $nrKits = @()
    }
} else {
    $nrKits = $nrRaw
}

$nrRows = @()
foreach($kit in $nrKits){
    if (-not $kit.fitments) { continue }
    foreach($fit in $kit.fitments){
        if (-not $fit.make -or -not $fit.model) { continue }

        $approval = $null
        if ($kit.PSObject.Properties.Name -contains "approval_nl" -and $kit.approval_nl) {
            $approval = $kit.approval_nl
        } elseif ($kit.approval) {
            $approval = $kit.approval
        }

        # Gebruik de SKU als imageKey, die matcht met NR-xxxxxx-… .jpg
		$imageKey = $null
		if ($kit.sku) {
			$imageKey = $kit.sku
	}


        $nrRows += [PSCustomObject]@{
            sku       = $kit.sku
            position  = $kit.position
            approval  = $approval
            imageKey  = $imageKey
            make      = ($fit.make  -as [string]).Trim()
            model     = ($fit.model -as [string]).Trim()
            year_from = $fit.year_from
            year_to   = $fit.year_to
        }
    }
}

# NR merken -> modellen
$nrBrandPages = @()

$nrRows | Group-Object make | ForEach-Object {
    $make      = $_.Name
    $makeSlug  = Get-Slug $make
    $pretty    = Get-PrettyName $make

    $models = $_.Group | Group-Object model | ForEach-Object {
        $modelName = $_.Name
        [PSCustomObject]@{
            MODEL_NAME = $modelName
            MODEL_SLUG = Get-Slug $modelName
        }
    } | Sort-Object MODEL_NAME

    $nrBrandPages += [PSCustomObject]@{
        MAKE      = $pretty
        MAKE_RAW  = $make
        MAKE_SLUG = $makeSlug
        MODELS    = $models
    }
}

$nrBrandOut = Join-Path $root 'data\nr-brand-pages.json'
$nrBrandPages | ConvertTo-Json -Depth 6 | Set-Content $nrBrandOut -Encoding UTF8
Write-Host "nr-brand-pages.json geschreven -> $nrBrandOut"

# NR merk+model -> sets
$nrModelPages = @()

$nrRows | Group-Object make,model | ForEach-Object {
    $rows  = $_.Group
    $first = $rows[0]

    $make      = $first.make
    $model     = $first.model
    $makeSlug  = Get-Slug $make
    $modelSlug = Get-Slug $model

    $sets = @()
    $rows | Group-Object sku | ForEach-Object {
        $skuRows = $_.Group
        $sample  = $skuRows[0]

        $yearRanges = @()
        foreach($r in $skuRows){
            $from = $r.year_from
            $to   = $r.year_to

            $fromYear = ""
            $toYear   = ""

            if ($from -and $from.Length -ge 4) {
                $fromYear = $from.Substring($from.Length - 4)
            }
            if ($to -and $to.Length -ge 4) {
                $toYear = $to.Substring($to.Length - 4)
            } else {
                $toYear = "heden"
            }

            if ($fromYear -or $toYear){
                $yearRanges += ($fromYear + "-" + $toYear)
            }
        }
        $yearRanges = $yearRanges | Sort-Object -Unique
        $yearsStr   = ($yearRanges -join ", ")

        $posNl = switch ($sample.position) {
            "front" { "Vooras" }
            "rear"  { "Achteras" }
            default { "Voor- en achteras" }
        }

        $imgUrl = if($sample.imageKey){
            "/assets/img/HV-kits/$($sample.imageKey).jpg"
        } else {
            "/img/branding/bg-hulpveren-gradient.png"
        }

        $sets += [PSCustomObject]@{
            SKU         = $sample.sku
            TITLE       = "Luchtvering set " + $posNl
            IMAGE_URL   = $imgUrl
            POSITION_NL = $posNl
            YEARS       = $yearsStr
            APPROVAL    = $sample.approval
            HAS_ADJUST  = $false
            PRICE_FROM  = $null
        }
    }

    $nrModelPages += [PSCustomObject]@{
        MAKE       = Get-PrettyName $make
        MAKE_RAW   = $make
        MAKE_SLUG  = $makeSlug
        MODEL      = $model
        MODEL_SLUG = $modelSlug
        SETS       = $sets
    }
}

$nrModelOut = Join-Path $root 'data\nr-model-pages.json'
$nrModelPages | ConvertTo-Json -Depth 6 | Set-Content $nrModelOut -Encoding UTF8
Write-Host "nr-model-pages.json geschreven -> $nrModelOut"


# ============= 2) LS = Verlagingsveren ===============
Write-Host "LS (verlagingsveren) data inlezen..."

$lsRaw = Get-Content $lsKitsPath -Raw | ConvertFrom-Json
if (-not ($lsRaw -is [System.Collections.IEnumerable])) {
    if ($lsRaw.kits) {
        $lsKits = $lsRaw.kits
    } elseif ($lsRaw.items) {
        $lsKits = $lsRaw.items
    } else {
        $lsKits = @()
    }
} else {
    $lsKits = $lsRaw
}

$lsRows = @()
foreach($kit in $lsKits){
    if (-not $kit.fitments) { continue }

    $frontDrop = $null
    $rearDrop  = $null
    if ($kit.suspension_delta_mm){
        if ($kit.suspension_delta_mm.front_mm) { $frontDrop = $kit.suspension_delta_mm.front_mm }
        if ($kit.suspension_delta_mm.rear_mm)  { $rearDrop  = $kit.suspension_delta_mm.rear_mm }
    }

    $imageKey = $null
    if ($kit.images -and $kit.images.Count -gt 0) {
        $imageKey = $kit.images[0]
    }

    foreach($fit in $kit.fitments){
        if (-not $fit.make -or -not $fit.model) { continue }

        $lsRows += [PSCustomObject]@{
            sku       = $kit.sku
            frontDrop = $frontDrop
            rearDrop  = $rearDrop
            imageKey  = $imageKey
            make      = ($fit.make  -as [string]).Trim()
            model     = ($fit.model -as [string]).Trim()
        }
    }
}

# LS merken -> modellen
$lsBrandPages = @()

$lsRows | Group-Object make | ForEach-Object {
    $make      = $_.Name
    $makeSlug  = Get-Slug $make
    $pretty    = Get-PrettyName $make

    $models = $_.Group | Group-Object model | ForEach-Object {
        $mName = $_.Name
        [PSCustomObject]@{
            MODEL_NAME = $mName
            MODEL_SLUG = Get-Slug $mName
        }
    } | Sort-Object MODEL_NAME

    $lsBrandPages += [PSCustomObject]@{
        MAKE      = $pretty
        MAKE_RAW  = $make
        MAKE_SLUG = $makeSlug
        MODELS    = $models
    }
}

$lsBrandOut = Join-Path $root 'data\ls-brand-pages.json'
$lsBrandPages | ConvertTo-Json -Depth 6 | Set-Content $lsBrandOut -Encoding UTF8
Write-Host "ls-brand-pages.json geschreven -> $lsBrandOut"

# LS merk+model -> sets
$lsModelPages = @()

$lsRows | Group-Object make,model | ForEach-Object {
    $rows  = $_.Group
    $first = $rows[0]

    $make      = $first.make
    $model     = $first.model
    $makeSlug  = Get-Slug $make
    $modelSlug = Get-Slug $model

    $sets = @()
    $rows | Group-Object sku | ForEach-Object {
        $skuRows = $_.Group
        $sample  = $skuRows[0]

        $dropFront = if($sample.frontDrop) { "$($sample.frontDrop) mm" } else { "Geen verlaging" }
        $dropRear  = if($sample.rearDrop)  { "$($sample.rearDrop) mm" }  else { "Geen verlaging" }

        $imgUrl = if($sample.imageKey){
            "/assets/img/HV-kits/$($sample.imageKey).jpg"
        } else {
            "/img/branding/bg-hulpveren-gradient.png"
        }

        $sets += [PSCustomObject]@{
            SKU        = $sample.sku
            IMAGE_URL  = $imgUrl
            DROP_FRONT = $dropFront
            DROP_REAR  = $dropRear
        }
    }

    $lsModelPages += [PSCustomObject]@{
        MAKE       = Get-PrettyName $make
        MAKE_RAW   = $make
        MAKE_SLUG  = $makeSlug
        MODEL      = $model
        MODEL_SLUG = $modelSlug
        SETS       = $sets
    }
}

$lsModelOut = Join-Path $root 'data\ls-model-pages.json'
$lsModelPages | ConvertTo-Json -Depth 6 | Set-Content $lsModelOut -Encoding UTF8
Write-Host "ls-model-pages.json geschreven -> $lsModelOut"
