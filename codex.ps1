# codex.ps1
Write-Host "=== Codex: rebuild alle HV / lucht / verlaging pagina's ==="

function Invoke-ScriptIfExists {
    param(
        [string]$Path
    )

    if (Test-Path $Path) {
        Write-Host "-> Run $Path" -ForegroundColor Cyan
        try {
            & $Path
        }
        catch {
            $msg = "Fout in {0}: {1}" -f $Path, $_.Exception.Message
            Write-Host $msg -ForegroundColor Red
        }
    }
    else {
        Write-Host "(!) Sla over, script niet gevonden: $Path" -ForegroundColor DarkYellow
    }
}

# 1) HV (hulpveren, alle merken/modellen)
Invoke-ScriptIfExists ".\build-hv-data.ps1"
Invoke-ScriptIfExists ".\build-hv-pages.ps1"

# 2) Luchtvering (NR)
Invoke-ScriptIfExists ".\build-lucht-ls-data.ps1"
Invoke-ScriptIfExists ".\build-lucht-ls-pages.ps1"

# 3) Verlaging (LS) – voorlopig optioneel
Invoke-ScriptIfExists ".\build-verlaging-ls-data.ps1"
Invoke-ScriptIfExists ".\build-verlaging-ls-pages.ps1"
