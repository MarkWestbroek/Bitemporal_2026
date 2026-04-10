<#
.SYNOPSIS
    Selectieve build: compileer het register met alleen de gewenste domeinen.

.DESCRIPTION
    Verplaatst de model-bestanden van uitgesloten domeinen tijdelijk,
    patcht de init() in metaregistry_plumbing.go, compileert, en herstelt alles.

    abuvwxy en register worden altijd meegecompileerd.

.PARAMETER Include
    Lijst van optionele domeinen om mee te compileren.
    Beschikbaar: np_loc, cg, configuratie, financieel
    Standaard: alle optionele domeinen.

.PARAMETER Exclude
    Lijst van optionele domeinen om UIT te sluiten.
    Kan niet samen met -Include.

.PARAMETER DockerBuild
    Voer na succesvolle go build ook een docker build uit (Dockerfile.api).

.PARAMETER DockerTag
    Tag voor de docker image (standaard: bitemp-api:selectief).

.EXAMPLE
    .\selectieve-build.ps1 -Include np_loc
    # Compileert alleen abuvwxy + register + np_loc.

.EXAMPLE
    .\selectieve-build.ps1 -Exclude financieel,cg
    # Compileert alles behalve financieel en cg.

.EXAMPLE
    .\selectieve-build.ps1 -Include np_loc -DockerBuild
    # Compileert np_loc en bouwt een docker image.
#>

param(
    [string[]]$Include,
    [string[]]$Exclude,
    [switch]$DockerBuild,
    [string]$DockerTag = "bitemp-api:selectief"
)

$ErrorActionPreference = "Stop"

# --- Configuratie ---
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$ModelDir = Join-Path $ProjectRoot "model"
$TempDir = Join-Path (Join-Path $ProjectRoot "_temp") "model_exclude"
$PlumbingFile = Join-Path $ModelDir "metaregistry_plumbing.go"
$PlumbingBackup = Join-Path $TempDir "metaregistry_plumbing.go.bak"

# Verplichte domeinen (altijd mee)
$VerplichteDomeinen = @("abuvwxy", "register")

# Optionele domeinen: bestandsprefix (in model/) en PascalCase init-prefix
$OptioneleDomeinen = [ordered]@{
    "np_loc"       = @{ Prefix = "np_loc_";       InitPrefix = "NpLoc" }
    "cg"           = @{ Prefix = "cg_";            InitPrefix = "Cg" }
    "configuratie" = @{ Prefix = "configuratie_";  InitPrefix = "Configuratie" }
    "financieel"   = @{ Prefix = "financieel_";    InitPrefix = "Financieel" }
}

# --- Normaliseer: komma-gescheiden strings splitsen tot array ---
if ($Include) { $Include = $Include | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ } }
if ($Exclude) { $Exclude = $Exclude | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ } }

# --- Validatie ---
if ($Include -and $Exclude) {
    Write-Error "Gebruik -Include of -Exclude, niet beide tegelijk."
    exit 1
}

# Bepaal welke optionele domeinen uitgesloten worden
$UitTeSluiten = @()
if ($Include) {
    foreach ($d in $Include) {
        if (-not $OptioneleDomeinen.Contains($d)) {
            Write-Error "Onbekend domein: '$d'. Beschikbaar: $($OptioneleDomeinen.Keys -join ', ')"
            exit 1
        }
    }
    $UitTeSluiten = @($OptioneleDomeinen.Keys | Where-Object { $_ -notin $Include })
}
elseif ($Exclude) {
    foreach ($d in $Exclude) {
        if (-not $OptioneleDomeinen.Contains($d)) {
            Write-Error "Onbekend domein: '$d'. Beschikbaar: $($OptioneleDomeinen.Keys -join ', ')"
            exit 1
        }
    }
    $UitTeSluiten = @($Exclude)
}

# Niets uit te sluiten? Gewone build.
if ($UitTeSluiten.Count -eq 0) {
    Write-Host "Alle domeinen geselecteerd - normale build." -ForegroundColor Green
    Set-Location $ProjectRoot
    go build ./...
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    if ($DockerBuild) {
        docker build -f Dockerfile.api -t $DockerTag .
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    Write-Host "Build geslaagd." -ForegroundColor Green
    exit 0
}

$Actief = @($VerplichteDomeinen) + @($OptioneleDomeinen.Keys | Where-Object { $_ -notin $UitTeSluiten })
Write-Host "Actieve domeinen : $($Actief -join ', ')" -ForegroundColor Cyan
Write-Host "Uitgesloten      : $($UitTeSluiten -join ', ')" -ForegroundColor Yellow

# --- Stap 1: Maak temp dir ---
if (Test-Path $TempDir) {
    Remove-Item $TempDir -Recurse -Force
}
New-Item $TempDir -ItemType Directory -Force | Out-Null

# --- Stap 2: Verplaats uitgesloten domeinbestanden ---
$VerplaatsteBestanden = @()
foreach ($domein in $UitTeSluiten) {
    $prefix = $OptioneleDomeinen[$domein].Prefix
    $bestanden = Get-ChildItem $ModelDir -Filter "${prefix}*.go"
    foreach ($f in $bestanden) {
        $doel = Join-Path $TempDir $f.Name
        Move-Item $f.FullName $doel
        $VerplaatsteBestanden += @{ Bron = $f.FullName; Doel = $doel }
        Write-Host "  Verplaatst: $($f.Name)" -ForegroundColor DarkGray
    }
}

# --- Stap 3: Patch init() in metaregistry_plumbing.go ---
Copy-Item $PlumbingFile $PlumbingBackup
$inhoud = Get-Content $PlumbingFile -Raw

foreach ($domein in $UitTeSluiten) {
    $initPrefix = $OptioneleDomeinen[$domein].InitPrefix
    # Comment out elke init<Prefix>..() regel voor dit domein
    $inhoud = $inhoud -replace "(?m)^(\tinit${initPrefix}\w+\(\))", '// SELECTIEF_UIT: $1'
}

Set-Content $PlumbingFile -Value $inhoud -NoNewline
Write-Host "`nPatched init() - uitgesloten init-calls uitgecommentarieerd." -ForegroundColor Cyan

# --- Stap 4: Build ---
$buildGeslaagd = $false
try {
    Set-Location $ProjectRoot
    Write-Host "`ngo build ./..." -ForegroundColor White
    go build ./...
    if ($LASTEXITCODE -eq 0) {
        $buildGeslaagd = $true
        Write-Host "Go build geslaagd." -ForegroundColor Green
    }
    else {
        Write-Host "Go build MISLUKT (exit $LASTEXITCODE)." -ForegroundColor Red
    }

    if ($buildGeslaagd -and $DockerBuild) {
        Write-Host "`ndocker build -f Dockerfile.api -t $DockerTag ." -ForegroundColor White
        docker build -f Dockerfile.api -t $DockerTag .
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Docker build MISLUKT (exit $LASTEXITCODE)." -ForegroundColor Red
            $buildGeslaagd = $false
        }
        else {
            Write-Host "Docker image '$DockerTag' gebouwd." -ForegroundColor Green
        }
    }
}
finally {
    # --- Stap 5: Altijd herstellen ---
    Write-Host "`nHerstellen..." -ForegroundColor Cyan

    # Herstel plumbing file
    if (Test-Path $PlumbingBackup) {
        Copy-Item $PlumbingBackup $PlumbingFile -Force
        Write-Host "  Hersteld: metaregistry_plumbing.go" -ForegroundColor DarkGray
    }

    # Herstel verplaatste bestanden
    foreach ($item in $VerplaatsteBestanden) {
        if (Test-Path $item.Doel) {
            Move-Item $item.Doel $item.Bron -Force
            Write-Host "  Hersteld: $(Split-Path $item.Bron -Leaf)" -ForegroundColor DarkGray
        }
    }

    # Opruimen temp dir
    if (Test-Path $TempDir) {
        Remove-Item $TempDir -Recurse -Force
    }

    Write-Host "Alles hersteld naar originele staat.`n" -ForegroundColor Green
}

if (-not $buildGeslaagd) {
    exit 1
}
