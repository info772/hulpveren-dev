param(
    [Parameter(Mandatory = $true)]
    [string]$PageName
)

$root     = Split-Path -Parent $MyInvocation.MyCommand.Definition
$partials = Join-Path $root "partials"
$pages    = Join-Path $root "pages"
$wwwroot  = Join-Path $root "wwwroot"

$headFile   = Join-Path $partials "head.html"
$headerFile = Join-Path $partials "header.html"
$footerFile = Join-Path $partials "footer.html"
$bodyFile   = Join-Path $pages ("{0}.body.html" -f $PageName)

if (-not (Test-Path $bodyFile)) {
    Write-Host ("ERROR: Body-bestand ontbreekt: {0}" -f $bodyFile) -ForegroundColor Red
    exit 1
}

$head    = Get-Content $headFile   -Raw
$header  = Get-Content $headerFile -Raw
$footer  = Get-Content $footerFile -Raw
$content = Get-Content $bodyFile   -Raw

$outDir  = Join-Path $wwwroot $PageName
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}
$outFile = Join-Path $outDir "index.html"

$html = @"
<!doctype html>
<html lang="nl">
<head>
$head
</head>
<body>
$header

<main class="page-main" role="main">
$content
</main>

$footer

<script src="/assets/js/app.js?v=20251127_1"></script>
</body>
</html>
"@

# Schrijf UTF-8 zonder BOM
[System.IO.File]::WriteAllText($outFile, $html, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ("Pagina gebouwd: {0}" -f $outFile) -ForegroundColor Green

