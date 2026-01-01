# build-all.ps1
# Bouwt:
# 1) Statische pagina's op basis van /pages/*.body.html
# 2) HV pagina's
# 3) NR/LS data + pagina's

$ErrorActionPreference = "Stop"

$root     = Split-Path -Parent $MyInvocation.MyCommand.Definition
$pagesDir = Join-Path $root "pages"

$builderPage   = Join-Path $root "build-page.ps1"
$builderHV     = Join-Path $root "build-hv-pages.ps1"
$builderNRLSData  = Join-Path $root "build-lucht-ls-data.ps1"
$builderNRLSPages = Join-Path $root "build-lucht-ls-pages.ps1"

function Run-Step($label, $scriptPath, $args=@()) {
  if (-not (Test-Path $scriptPath)) {
    Write-Host "SKIP: $label (niet gevonden: $scriptPath)" -ForegroundColor Yellow
    return
  }
  Write-Host "`n==> $label" -ForegroundColor Cyan
  & $scriptPath @args
}

Write-Host "BUILD ROOT: $root" -ForegroundColor DarkGray

# 1) Statische pagina's (pages/*.body.html)
if (-not (Test-Path $builderPage)) {
  Write-Host "ERROR: build-page.ps1 niet gevonden in $root" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $pagesDir)) {
  Write-Host "ERROR: pages-map niet gevonden: $pagesDir" -ForegroundColor Red
  exit 1
}

$files = Get-ChildItem -Path $pagesDir -Filter "*.body.html" -File

if ($files.Count) {
  Write-Host "`n==> Start build van $($files.Count) statische pagina('s)..." -ForegroundColor Cyan
  foreach ($file in $files) {
    $baseName = $file.BaseName           # "contact.body"
    $pageName = $baseName -replace '\.body$',''
    Write-Host "  - Bouw pagina: $pageName" -ForegroundColor Gray
    & $builderPage $pageName
  }
  Write-Host "Statische pagina's: klaar." -ForegroundColor Green
} else {
  Write-Host "Geen *.body.html bestanden gevonden in $pagesDir" -ForegroundColor Yellow
}

# 2) HV pagina's
Run-Step "HV pagina's bouwen" $builderHV

# 3) NR/LS data + pagina's
Run-Step "NR/LS data bouwen" $builderNRLSData
Run-Step "NR/LS pagina's bouwen" $builderNRLSPages

Write-Host "`nKlaar. Alles is opnieuw opgebouwd." -ForegroundColor Green
