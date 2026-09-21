<#
.SYNOPSIS
    Start de devtools-API voor de regressie-UI (http://localhost:8099/admin/regressie).

.DESCRIPTION
    Zet in één keer klaar wat de UI nodig heeft:
      1. de dedicated Postgres-container op poort 5433 (aangemaakt/gestart indien nodig);
      2. de database voor deze API-instantie op die Postgres. Standaard bitemp_regressie_np_loc:
         dezelfde als waar de regressierun in schrijft, zodat je het resultaat van een run direct
         ziet op /viz/react/inhoud.html van deze instantie. Een run wist en herbouwt die database;
         ververs daarna de pagina. Loadtests vanuit de UI gebruiken een eigen database
         (..._np_loc_load); bekijk die met -Database of met scripts\regressie-bekijk.ps1;
      3. een devtools-build van de API (go run -tags devtools) op poort 8099, met DEVLOOP=true,
         zodat /admin/regressie beschikbaar is. De runs die de UI start gebruiken op hun beurt
         REGRESSIE_DATABASE_URL (bitemp_regressie_np_loc, zelfde Postgres).

    Alles staat los van je dev-omgeving (5432 / 8082 / bitemp_go_db_v06). Omgevingsvariabelen
    worden in dit shell-proces gezet; de .env in de map wordt daardoor niet gebruikt (godotenv
    overschrijft bestaande variabelen niet). Ctrl+C stopt de API.

.EXAMPLE
    .\scripts\regressie-ui.ps1
    .\scripts\regressie-ui.ps1 -Port 8100 -Wachtwoord geheim
    .\scripts\regressie-ui.ps1 -Herstart          # stopt eerst een eerdere instantie op dezelfde poort
#>
param(
    [int]$Port = 8099,
    [string]$Wachtwoord = "regressie",
    [string]$WebDir = "",
    [string]$Database = "bitemp_regressie_np_loc",
    [switch]$Herstart,
    [string]$ContainerName = "bitemp-regressie-pg",
    [string]$PostgresImage = "postgres:16-alpine",
    [switch]$NoDocker
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot   # bitemp_register_v06/

# Poort al bezet? Meestal een eerdere instantie van dit script in een andere terminal. `go run`
# start een kindproces (bitemp_register_v06.exe) dat de poort vasthoudt; na Ctrl+C blijft dat soms
# achter. Met -Herstart wordt zo'n eerdere instantie (en zijn go.exe-ouder) gestopt.
$luisteraar = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($luisteraar) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($luisteraar.OwningProcess)"
    $isEigen = $proc -and $proc.Name -like "bitemp_register_v06*"
    if ($Herstart -and $isEigen) {
        $ouder = Get-CimInstance Win32_Process -Filter "ProcessId=$($proc.ParentProcessId)"
        Write-Host "Eerdere instantie op poort $Port stoppen (PID $($proc.ProcessId))..." -ForegroundColor Cyan
        Stop-Process -Id $proc.ProcessId -Force -Confirm:$false
        if ($ouder -and $ouder.Name -eq "go.exe") { Stop-Process -Id $ouder.ProcessId -Force -Confirm:$false -ErrorAction SilentlyContinue }
        Start-Sleep -Seconds 1
    } elseif ($isEigen) {
        throw "Poort $Port is al in gebruik door een eerdere instantie (PID $($proc.ProcessId), gestart $($proc.CreationDate)). Stop die met Ctrl+C in zijn terminal, of start opnieuw met -Herstart."
    } else {
        throw "Poort $Port is in gebruik door een ander programma ($($proc.Name), PID $($proc.ProcessId)). Kies een andere poort met -Port."
    }
}

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

    # Database voor deze API-instantie (idempotent). Standaard dezelfde als waar de regressierun in
    # schrijft, zodat je na een run de inhoud direct ziet op /viz/react/inhoud.html van deze instantie.
    if ($Database -notmatch '^[a-z0-9_]+$') { throw "Ongeldige databasenaam: $Database" }
    if ($Database -like "*bitemp_go_db_v06*") { throw "Dat is de dev-database; een regressierun zou die leegmaken." }
    $aanwezig = docker exec $ContainerName psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$Database'"
    if ($aanwezig -ne "1") {
        docker exec $ContainerName psql -U postgres -c "CREATE DATABASE $Database" | Out-Null
    }
    Write-Host "Postgres klaar (5433)." -ForegroundColor Green
}

# Frontend: de gebouwde pagina's en bundels (web\react\*.html, web\react\assets) staan niet in git.
# In een worktree zonder gebouwde frontend die van de hoofdcheckout gebruiken (WEB_DIR, zie main.go),
# zodat /viz/react/inhoud.html e.d. ook op deze instantie werken.
if (-not $WebDir -and -not (Test-Path (Join-Path $root "web\react\assets"))) {
    $kandidaat = Join-Path (Split-Path -Parent (Split-Path -Parent $root)) "Bitemporal_2026\bitemp_register_v06\web"
    if (Test-Path (Join-Path $kandidaat "react\assets")) { $WebDir = $kandidaat }
    else { Write-Host "Let op: geen gebouwde frontend gevonden; /viz/react/*.html geeft 404. Bouw hem (npm run build in web\vite) of geef -WebDir op." -ForegroundColor Yellow }
}
if ($WebDir) {
    $env:WEB_DIR = $WebDir
    Write-Host "Frontend uit: $WebDir" -ForegroundColor Cyan
}

$env:PORT = "$Port"
$env:DEVLOOP = "true"
$env:DEVLOOP_PASSWORD = $Wachtwoord
$env:AUTH_ENABLED = "false"
$env:AUTO_CREATE_DATABASE = "false"
$env:DATABASE_ADMIN_URL = ""
$env:DATABASE_URL = "postgres://postgres:1234@127.0.0.1:5433/$($Database)?sslmode=disable"
$env:REGRESSIE_DATABASE_URL = "postgres://postgres:1234@127.0.0.1:5433/bitemp_regressie_np_loc?sslmode=disable"

Write-Host ""
Write-Host "Regressie-UI:  http://localhost:$Port/admin/regressie" -ForegroundColor Green
Write-Host "Wachtwoord:    $Wachtwoord   (Ctrl+C stopt de API)" -ForegroundColor Green
Write-Host "Inhoud:        http://localhost:$Port/viz/react/inhoud.html   (database: $Database)" -ForegroundColor Green
if ($Database -ne "bitemp_regressie_np_loc") {
    Write-Host "               Let op: de regressierun schrijft naar bitemp_regressie_np_loc, niet naar $Database." -ForegroundColor Yellow
}
Write-Host ""

Push-Location $root
try {
    go run -tags devtools .
} finally {
    Pop-Location
}
