<#
  sync-omnium-website.ps1
  -----------------------
  Spiegelt de marketing-site (bitemp_register_v06/web/omnium-studio) naar de aparte
  deploy-repo D:\Git\omnium-website, die GitHub Desktop publiceert en die Plesk pullt.

  Workflow:
    1. Je bewerkt/commit de site in de monorepo (zoals nu) — dat blijft de bron.
    2. Je draait dit script (rechtsklik > Run with PowerShell, of vanuit een terminal).
    3. Je opent D:\Git\omnium-website in GitHub Desktop, commit en push.
    4. Plesk pullt automatisch en deployt naar /studio.

  Studio-URL per omgeving: zet $StudioUrl hieronder op de gepubliceerde Studio-URL.
  Leeg laten = links blijven relatief (werkt lokaal, maar niet op Plesk).
#>

$Src       = "D:\Git\Bitemporal_2026\bitemp_register_v06\web\omnium-studio"
$Dest      = "D:\Git\omnium-website"
$StudioUrl = ""   # bv. "https://common-ground-lab.nl/studio-app/"

Write-Host "Spiegelen: $Src  ->  $Dest" -ForegroundColor Cyan
# /MIR spiegelt (incl. verwijderingen); /XD .git beschermt de git-map van de deploy-repo.
robocopy $Src $Dest /MIR /XD ".git" | Out-Null
# robocopy geeft exit 0-7 bij succes; reset zodat het script niet 'faalt'.
if ($LASTEXITCODE -lt 8) { $global:LASTEXITCODE = 0 }

if ($StudioUrl -ne "") {
  Write-Host "Studio-links herschrijven naar: $StudioUrl" -ForegroundColor Cyan
  Get-ChildItem $Dest -Recurse -Filter *.html | ForEach-Object {
    $c = Get-Content $_.FullName -Raw
    $c = $c -replace '\.\./\.\./vite/studio\.html', $StudioUrl
    $c = $c -replace '\.\./vite/studio\.html', $StudioUrl
    Set-Content $_.FullName -Value $c -Encoding UTF8
  }
} else {
  Write-Host "Let op: StudioUrl is leeg - 'Open de Studio'-links blijven relatief (werkt niet op Plesk)." -ForegroundColor Yellow
}

Write-Host "Klaar. Open D:\Git\omnium-website in GitHub Desktop, commit en push." -ForegroundColor Green
