<#
.SYNOPSIS
    Draait de geautomatiseerde np-loc regressietest tegen een eigen Postgres.

.DESCRIPTION
    1. Zorgt dat er een dedicated Postgres-container draait (poort 5433, los van
       je dev-database op 5432). Bestaat de container al, dan wordt hij gestart.
    2. Draait `go test -tags integration -run TestRegressieNpLoc -v .`
       De test bouwt de database elke run opnieuw op vanuit replay-bestanden.

    Vereist Docker Desktop (of geef -Dsn op naar een bestaande Postgres en -NoDocker).

.EXAMPLE
    .\scripts\regressie-np-loc.ps1
    .\scripts\regressie-np-loc.ps1 -Devtools          # inclusief /admin/* endpoints
    .\scripts\regressie-np-loc.ps1 -NoDocker -Dsn "postgres://postgres:geheim@localhost:5432/bitemp_regressie_np_loc?sslmode=disable"
#>
param(
    [string]$Dsn = "postgres://postgres:1234@localhost:5433/bitemp_regressie_np_loc?sslmode=disable",
    [string]$ContainerName = "bitemp-regressie-pg",
    [string]$PostgresImage = "postgres:16-alpine",
    [switch]$NoDocker,
    [switch]$Devtools,
    [string]$Run = "TestRegressieNpLoc"
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
    # Wachten tot Postgres antwoordt.
    $ok = $false
    for ($i = 0; $i -lt 30; $i++) {
        docker exec $ContainerName pg_isready -U postgres 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $ok = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ok) { throw "Postgres in container '$ContainerName' kwam niet online." }
    Write-Host "Postgres klaar." -ForegroundColor Green
}

$env:REGRESSIE_DATABASE_URL = $Dsn
$tags = "integration"
if ($Devtools) { $tags = "integration devtools" }

Push-Location $root
try {
    Write-Host "go test -tags '$tags' -run $Run -v ." -ForegroundColor Cyan
    go test -tags $tags -run $Run -v -count=1 .
    $exit = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $exit
