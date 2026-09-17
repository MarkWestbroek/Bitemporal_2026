<#
.SYNOPSIS
    Start de devtools-API voor de regressie-UI (http://localhost:8099/admin/regressie).

.DESCRIPTION
    Zet in één keer klaar wat de UI nodig heeft:
      1. de dedicated Postgres-container op poort 5433 (aangemaakt/gestart indien nodig);
      2. de eigen database voor deze API-instantie (bitemp_regressie_ui) op die Postgres;
      3. een devtools-build van de API (go run -tags devtools) op poort 8099, met DEVLOOP=true,
         zodat /admin/regressie beschikbaar is. De runs die de UI start gebruiken op hun beurt
         REGRESSIE_DATABASE_URL (bitemp_regressie_np_loc, zelfde Postgres).

    Alles staat los van je dev-omgeving (5432 / 8082 / bitemp_go_db_v06). Omgevingsvariabelen
    worden in dit shell-proces gezet; de .env in de map wordt daardoor niet gebruikt (godotenv
    overschrijft bestaande variabelen niet). Ctrl+C stopt de API.

.EXAMPLE
    .\scripts\regressie-ui.ps1
    .\scripts\regressie-ui.ps1 -Port 8100 -Wachtwoord geheim
#>
param(
    [int]$Port = 8099,
    [string]$Wachtwoord = "regressie",
    [string]$ContainerName = "bitemp-regressie-pg",
    [string]$PostgresImage = "postgres:16-alpine",
    [switch]$NoDocker
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot   # bitemp_register_v06/

if (-not $NoDocker) {
    $bestaat = docker ps -a --filter "name=^/$ContainerName$" --format "{{.Names}}" 2>$null
    if (-not $bestaat) {
        Write-Host "Postgres-container '$ContainerName' aanmaken op poort 5433..." -ForegroundColor Cyan
        docker run -d --name $ContainerName -e POSTGRES_PASSWORD=1234 -p 5433:5432 $PostgresImage | Out-Null
    } else {
        docker start $ContainerName | Out-Null
    }
    $ok = $false
    for ($i = 0; $i -lt 30; $i++) {
        docker exec $ContainerName pg_isready -U postgres 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $ok = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ok) { throw "Postgres in container '$ContainerName' kwam niet online." }

    # Eigen database voor deze API-instantie (idempotent).
    $aanwezig = docker exec $ContainerName psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='bitemp_regressie_ui'"
    if ($aanwezig -ne "1") {
        docker exec $ContainerName psql -U postgres -c "CREATE DATABASE bitemp_regressie_ui" | Out-Null
    }
    Write-Host "Postgres klaar (5433)." -ForegroundColor Green
}

$env:PORT = "$Port"
$env:DEVLOOP = "true"
$env:DEVLOOP_PASSWORD = $Wachtwoord
$env:AUTH_ENABLED = "false"
$env:AUTO_CREATE_DATABASE = "false"
$env:DATABASE_ADMIN_URL = ""
$env:DATABASE_URL = "postgres://postgres:1234@127.0.0.1:5433/bitemp_regressie_ui?sslmode=disable"
$env:REGRESSIE_DATABASE_URL = "postgres://postgres:1234@127.0.0.1:5433/bitemp_regressie_np_loc?sslmode=disable"

Write-Host ""
Write-Host "Regressie-UI:  http://localhost:$Port/admin/regressie" -ForegroundColor Green
Write-Host "Wachtwoord:    $Wachtwoord   (Ctrl+C stopt de API)" -ForegroundColor Green
Write-Host ""

Push-Location $root
try {
    go run -tags devtools .
} finally {
    Pop-Location
}
