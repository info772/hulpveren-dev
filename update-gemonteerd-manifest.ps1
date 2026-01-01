param(
  [string]$Dir = (Join-Path $PSScriptRoot "wwwroot\assets\img\Gemonteerd")
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Dir)) {
  Write-Host "ERROR: Directory not found: $Dir" -ForegroundColor Red
  exit 1
}

$manifestPath = Join-Path $Dir "manifest.json"
$allowed = @(".jpg", ".jpeg", ".png", ".webp")
$files = Get-ChildItem -Path $Dir -File | Where-Object {
  $ext = $_.Extension.ToLowerInvariant()
  $allowed -contains $ext
} | Sort-Object Name | Select-Object -ExpandProperty Name

$json = $files | ConvertTo-Json
[System.IO.File]::WriteAllText(
  $manifestPath,
  $json,
  (New-Object System.Text.UTF8Encoding($false))
)

Write-Host "Manifest updated: $manifestPath" -ForegroundColor Green
