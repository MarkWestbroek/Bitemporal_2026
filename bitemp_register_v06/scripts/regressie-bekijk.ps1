<#
.SYNOPSIS
    Bekijk de inhoud van een regressie-/load-database met de gewone pagina's (inhoud, publicatie, …).

.DESCRIPTION
    De React-pagina's praten met de backend waar ze vandaan komen (zelfde origin). Dit script start
    daarom een tweede, gewone API-instantie op een eigen poort, met DATABASE_URL gericht op de
    gekozen testdatabase op de regressie-Postgres (poort 5433). Zo kijk je met inhoud.html en
    publicatie.html naar precies de data die een regressie- of loadrun heeft achtergelaten.

    Staat los van de suite-editor (8099) en van je dev-omgeving (8082 / 5432); ze kunnen naast
    elkaar draaien. Let op: een nieuwe run met reset bouwt de database opnieuw op; ververs daarna
    de pagina. Het is een gewone API: muteren via de pagina's kan, en verandert dus de testdata.

    Frontend: de JavaScript-bundels (web\react\assets) staan niet in git. In een worktree waar de
    frontend niet gebouwd is, gebruikt het script automatisch de gebouwde frontend van de
    hoofdcheckout (..\Bitemporal_2026) via WEB_DIR. Die frontend kan nieuwer zijn dan deze backend.

    Databases op de regressie-Postgres:
      bitemp_regressie_np_loc        regressierun (script / UI met standaard-DSN)
      bitemp_regressie_np_loc_load   loadtest vanuit de UI (de UI plakt _load achter de naam)
      bitemp_regressie_load          loadtest vanaf de commandoregel (voorbeeld uit de docs)

.EXAMPLE
    .\scripts\regressie-bekijk.ps1
    .\scripts\regressie-bekijk.ps1 -Database bitemp_regressie_np_loc_load
    .\scripts\regressie-bekijk.ps1 -Database bitemp_regressie_load -Port 8096
    .\scripts\regressie-bekijk.ps1 -WebDir D:\Git\Bitemporal_2026\bitemp_register_v06\web
#>
param(
    [string]$Database = "",
    [int]$Port = 8097,
    [string]$WebDir = "",
    [string]$ContainerName = "bitemp-regressie-pg"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot   # bitemp_register_v06/

docker start $ContainerName | Out-Null
$lijst = docker exec $ContainerName psql -U postgres -tAc "SELECT datname FROM pg_database WHERE datname LIKE 'bitemp_%' ORDER BY 1"
$databases = @($lijst | Where-Object { $_ -and $_.Trim() -ne "" } | ForEach-Object { $_.Trim() })

if (-not $Database) {
    Write-Host "Databases op de regressie-Postgres (5433):" -ForegroundColor Cyan
    for ($i = 0; $i -lt $databases.Count; $i++) {
        $n = docker exec $ContainerName psql -U postgres -d $databases[$i] -tAc "SELECT CASE WHEN to_regclass('registratie') IS NULL THEN -1 ELSE (SELECT count(*) FROM registratie) END"
        $info = if ("$n".Trim() -eq "-1") { "geen tabellen" } else { "$("$n".Trim()) registraties" }
        Write-Host ("  [{0}] {1,-34} {2}" -f ($i + 1), $databases[$i], $info)
    }
    $keuze = Read-Host "Nummer"
    $Database = $databases[[int]$keuze - 1]
}
if ($databases -notcontains $Database) { throw "Database '$Database' bestaat niet op de regressie-Postgres. Bekend: $($databases -join ', ')" }

# Frontend: zonder gebouwde bundels hier, die van de hoofdcheckout gebruiken.
if (-not $WebDir -and -not (Test-Path (Join-Path $root "web\react\assets"))) {
    $kandidaat = Join-Path (Split-Path -Parent (Split-Path -Parent $root)) "Bitemporal_2026\bitemp_register_v06\web"
    if (Test-Path (Join-Path $kandidaat "react\assets")) {
        $WebDir = $kandidaat
    } else {
        Write-Host "Let op: geen gebouwde frontend gevonden (web\react\assets). Bouw hem (npm run build in web\vite) of geef -WebDir op." -ForegroundColor Yellow
    }
}
if ($WebDir) {
    $env:WEB_DIR = $WebDir
    Write-Host "Frontend uit: $WebDir" -ForegroundColor Cyan
}

$env:PORT = "$Port"
$env:DEVLOOP = "false"
$env:AUTH_ENABLED = "false"
$env:AUTO_CREATE_DATABASE = "false"
$env:DATABASE_ADMIN_URL = ""
$env:DATABASE_URL = "postgres://postgres:1234@127.0.0.1:5433/$($Database)?sslmode=disable"

Write-Host ""
Write-Host "Database:    $Database" -ForegroundColor Green
Write-Host "Inhoud:      http://localhost:$Port/viz/react/inhoud.html" -ForegroundColor Green
Write-Host "Publicatie:  http://localhost:$Port/viz/react/publicatie.html   (Ctrl+C stopt)" -ForegroundColor Green
Write-Host ""

Push-Location $root
try {
    go run .
} finally {
    Pop-Location
}
