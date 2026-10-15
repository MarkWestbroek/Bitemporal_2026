<#
.SYNOPSIS
    Bouwt de Omnium-API met alleen de gekozen modeldomeinen, in een tijdelijke kopie.

.DESCRIPTION
    Een domein is gegenereerde Go-code uit het model: zeven bestanden model/<prefix>_*.go plus
    drie init-aanroepen in model/metaregistry_plumbing.go. Routes, tabellen, GraphQL, OpenAPI en
    de schema-API lezen alles uit de MetaRegistry, dus wat niet geregistreerd is, bestaat niet.
    Een compacter register maak je daarom door domeinen weg te laten, niet met een runtime-filter
    (besluit pf-plan 2026-09-21; werkwijze docs/CODEGEN.md §11 en §12).

    Dit script doet dat zonder je werkmap aan te raken:
      1. kopieert de Go-pakketten van de module (zonder tests) naar <Uitvoer>\bron;
      2. verwijdert daar de bestanden van de niet gekozen domeinen;
      3. haalt hun init-aanroepen uit metaregistry_plumbing.go;
      4. controleert of de gekozen domeinen naar types uit weggelaten domeinen verwijzen
         (relatie-doelen, onderliggende elementen, $ref-velden) — dan stopt het, tenzij -Forceer;
      5. bouwt de binary (en desgewenst een Docker-image met Dockerfile.api).

.PARAMETER Domeinen
    De domeinen die je wilt houden, als domeinnaam of bestandsprefix, gescheiden door komma's:
    "register,CG,gegevenstypen,configuratie,ide-bestanden". Verplicht: register (kern-entiteiten)
    en ide-bestanden (handgeschreven handlers gebruiken zijn types: bestanden, rebuild, schema).
    Gebruik -Lijst om te zien welke er zijn.

.PARAMETER Uitvoer
    Map voor de kopie en de binary. Standaard: %TEMP%\omnium-bouw-domeinen. Wordt bij elke run
    opnieuw opgebouwd (alleen als hij door dit script is gemaakt).

.PARAMETER Devtools
    Bouwt met -tags devtools (de /admin/*-routes: rebuild, droptables, diff).

.PARAMETER Image
    Bouwt ook een Docker-image met deze tag (bv. omnium-api:pf), uit Dockerfile.api.

.PARAMETER AlleenControle
    Maakt de kopie en doet de controle, maar bouwt niets.

.PARAMETER Forceer
    Bouwt ook als een gekozen domein naar een weggelaten domein verwijst.

.PARAMETER Lijst
    Toont de beschikbare domeinen en stopt.

.EXAMPLE
    .\scripts\bouw-domeinen.ps1 -Lijst
.EXAMPLE
    .\scripts\bouw-domeinen.ps1 -Domeinen "register,CG,gegevenstypen,configuratie,ide-bestanden,beheer"
.EXAMPLE
    .\scripts\bouw-domeinen.ps1 -Domeinen "register,CG,beheer" -Image omnium-api:pf
#>
param(
    [string]$Domeinen = "",
    [string]$Uitvoer = (Join-Path $env:TEMP "omnium-bouw-domeinen"),
    [switch]$Devtools,
    [string]$Image = "",
    [switch]$AlleenControle,
    [switch]$Forceer,
    [switch]$Lijst
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Split-Path -Parent $PSScriptRoot)).Path   # bitemp_register_v06/
$markering = ".omnium-bouw-domeinen"
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Normaliseer([string]$naam) { return $naam.Trim().ToLower().Replace("-", "_") }

# ── Beschikbare domeinen: elk model/<prefix>_metaregistry.go is een domein ──────────────────
$beschikbaar = [ordered]@{}
foreach ($f in Get-ChildItem -Path (Join-Path $root "model") -Filter "*_metaregistry.go") {
    $prefix = $f.Name.Substring(0, $f.Name.Length - "_metaregistry.go".Length)
    $tekst = [IO.File]::ReadAllText($f.FullName)
    $m = [regex]::Match($tekst, 'Domein:\s*"([^"]+)"')
    $domeinnaam = $prefix
    if ($m.Success) { $domeinnaam = $m.Groups[1].Value }
    $types = ([regex]::Matches($tekst, 'MetaRegistry\["([^"]+)"\]\s*=') | ForEach-Object { $_.Groups[1].Value })
    $beschikbaar[$prefix] = [pscustomobject]@{ Prefix = $prefix; Domein = $domeinnaam; Types = @($types) }
}

if ($Lijst -or [string]::IsNullOrWhiteSpace($Domeinen)) {
    Write-Host "Beschikbare domeinen (prefix → domein, aantal types):" -ForegroundColor Cyan
    foreach ($d in $beschikbaar.Values) { Write-Host ("  {0,-15} {1,-15} {2,4} types" -f $d.Prefix, $d.Domein, $d.Types.Count) }
    Write-Host ""
    Write-Host "Kern (altijd mee, geen domein): plumbing, studio, gebruiker-/meldingtabellen, extra datatypes."
    if (-not $Lijst) { Write-Host "Geef -Domeinen op, bv. -Domeinen ""register,CG,gegevenstypen,configuratie,ide-bestanden,beheer""" -ForegroundColor Yellow; exit 1 }
    exit 0
}

# ── Keuze controleren ──────────────────────────────────────────────────────────────────────
$houden = @()
foreach ($naam in ($Domeinen -split ",")) {
    if ([string]::IsNullOrWhiteSpace($naam)) { continue }
    $sleutel = Normaliseer $naam
    $gevonden = $beschikbaar.Values | Where-Object { $_.Prefix -eq $sleutel -or (Normaliseer $_.Domein) -eq $sleutel } | Select-Object -First 1
    if (-not $gevonden) { throw "Onbekend domein '$naam'. Zie -Lijst." }
    if ($houden -notcontains $gevonden.Prefix) { $houden += $gevonden.Prefix }
}
# Verplicht: register (kern-entiteiten) en ide_bestanden (handlers/bestanden_handlers.go,
# rebuild_handler.go en schema_model_handler.go gebruiken zijn types; gemeten 15-10-2026).
foreach ($v in @("register", "ide_bestanden")) {
    if ($houden -notcontains $v) { throw "$v is altijd nodig (zie docs/CODEGEN.md §12)." }
}
$weg = @($beschikbaar.Keys | Where-Object { $houden -notcontains $_ })

Write-Host "Houden:    $($houden -join ', ')" -ForegroundColor Green
Write-Host "Weglaten:  $(if ($weg.Count) { $weg -join ', ' } else { '(niets)' })" -ForegroundColor Yellow

# ── Uitvoermap (alleen leegmaken als dit script hem gemaakt heeft) ──────────────────────────
$Uitvoer = [IO.Path]::GetFullPath($Uitvoer)
if (Test-Path $Uitvoer) {
    if (-not (Test-Path (Join-Path $Uitvoer $markering))) {
        throw "Uitvoermap '$Uitvoer' bestaat al en is niet door dit script gemaakt; kies een andere -Uitvoer."
    }
    Remove-Item -LiteralPath $Uitvoer -Recurse -Force
}
New-Item -ItemType Directory -Path $Uitvoer | Out-Null
Set-Content -LiteralPath (Join-Path $Uitvoer $markering) -Value "Gemaakt door scripts/bouw-domeinen.ps1" -Encoding ascii
$bron = Join-Path $Uitvoer "bron"

# ── 1. Go-pakketten van de module kopiëren (zonder tests) ───────────────────────────────────
Push-Location $root
try {
    $pakketten = @(go list -f "{{.Dir}}" ./...)
    if ($LASTEXITCODE -ne 0) { throw "go list mislukt" }
} finally { Pop-Location }
New-Item -ItemType Directory -Path $bron | Out-Null
foreach ($f in @("go.mod", "go.sum")) { Copy-Item -LiteralPath (Join-Path $root $f) -Destination (Join-Path $bron $f) }
$aantalBestanden = 0
foreach ($dir in $pakketten) {
    $rel = $dir.Substring($root.Length).TrimStart('\', '/')
    $doel = Join-Path $bron $rel
    New-Item -ItemType Directory -Path $doel -Force | Out-Null
    foreach ($f in Get-ChildItem -LiteralPath $dir -Filter "*.go" -File | Where-Object { $_.Name -notlike "*_test.go" }) {
        Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $doel $f.Name)
        $aantalBestanden++
    }
}
Write-Host "1. Gekopieerd: $($pakketten.Count) pakketten, $aantalBestanden Go-bestanden → $bron"

# ── 2 + 3. Bestanden en init-aanroepen van weggelaten domeinen verwijderen ──────────────────
$modelDir = Join-Path $bron "model"
$initNamen = @()
$wegTypes = @{}
$wegTabellen = @{}
foreach ($prefix in $weg) {
    foreach ($f in Get-ChildItem -LiteralPath $modelDir -Filter "$($prefix)_*.go" -File) {
        $tekst = [IO.File]::ReadAllText($f.FullName)
        $initNamen += ([regex]::Matches($tekst, 'func\s+(init\w+Registry)\s*\(') | ForEach-Object { $_.Groups[1].Value })
        foreach ($m in [regex]::Matches($tekst, 'Tabelnaam:\s*"([^"]+)"')) { $wegTabellen[$m.Groups[1].Value] = $prefix }
        Remove-Item -LiteralPath $f.FullName
    }
    foreach ($t in $beschikbaar[$prefix].Types) { $wegTypes[$t] = $prefix }
}
$plumbing = Join-Path $modelDir "metaregistry_plumbing.go"
$tekst = [IO.File]::ReadAllText($plumbing)
$verwijderd = 0
foreach ($init in ($initNamen | Sort-Object -Unique)) {
    $patroon = "(?m)^[ \t]*" + [regex]::Escape($init) + "\(\)[ \t]*\r?\n"
    $verwijderd += ([regex]::Matches($tekst, $patroon)).Count
    $tekst = [regex]::Replace($tekst, $patroon, "")
}
[IO.File]::WriteAllText($plumbing, $tekst, $utf8)
Write-Host "2. Weggelaten: $($weg.Count) domeinen; $verwijderd init-aanroepen uit metaregistry_plumbing.go"

# ── 4. Verwijzingen van gekozen naar weggelaten domeinen ────────────────────────────────────
$fouten = @()
foreach ($prefix in $houden) {
    $bestand = Join-Path $modelDir "$($prefix)_metaregistry.go"
    $regels = [IO.File]::ReadAllLines($bestand)
    for ($i = 0; $i -lt $regels.Length; $i++) {
        $r = $regels[$i]
        foreach ($m in [regex]::Matches($r, '(Doeltype|DoelEntiteit|BovenliggendTypenaam|ParentTypenaam):\s*"([^"]+)"')) {
            $t = $m.Groups[2].Value
            if ($wegTypes.ContainsKey($t)) { $fouten += "  $($prefix)_metaregistry.go:$($i+1): $($m.Groups[1].Value) '$t' hoort bij weggelaten domein $($wegTypes[$t])" }
        }
        $m = [regex]::Match($r, 'SecondaireEntiteitIDKolom:\s*"([^"]+)_id"')
        if ($m.Success -and $wegTabellen.ContainsKey($m.Groups[1].Value)) {
            $fouten += "  $($prefix)_metaregistry.go:$($i+1): relatie naar '$($m.Groups[1].Value)' (weggelaten domein $($wegTabellen[$m.Groups[1].Value]))"
        }
        $m = [regex]::Match($r, 'VoegOnderliggendGEToe\(\s*"([^"]+)"')
        if ($m.Success -and $wegTypes.ContainsKey($m.Groups[1].Value)) {
            $fouten += "  $($prefix)_metaregistry.go:$($i+1): VoegOnderliggendGEToe op '$($m.Groups[1].Value)' (weggelaten domein $($wegTypes[$m.Groups[1].Value]))"
        }
    }
    # $ref-velden (schema:"ref:Type") in de structs wijzen naar referentielijst-items van een ander domein
    foreach ($naam in @("modellen_ge_rel", "modellen_entiteiten")) {
        $sf = Join-Path $modelDir "$($prefix)_$naam.go"
        if (-not (Test-Path $sf)) { continue }
        $sregels = [IO.File]::ReadAllLines($sf)
        for ($i = 0; $i -lt $sregels.Length; $i++) {
            foreach ($m in [regex]::Matches($sregels[$i], 'ref:([A-Za-z_]\w*)')) {
                $t = $m.Groups[1].Value
                if ($wegTypes.ContainsKey($t)) { $fouten += "  $($prefix)_$naam.go:$($i+1): veld met `$ref '$t' (weggelaten domein $($wegTypes[$t]))" }
            }
        }
    }
}
if ($fouten.Count -gt 0) {
    Write-Host "3. Verwijzingen naar weggelaten domeinen:" -ForegroundColor Red
    $fouten | Select-Object -Unique | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    if (-not $Forceer) { throw "Neem de genoemde domeinen ook mee, of bouw toch met -Forceer (de relaties werken dan niet)." }
    Write-Host "   -Forceer: toch doorgaan." -ForegroundColor Yellow
} else {
    Write-Host "3. Controle: geen verwijzingen naar weggelaten domeinen" -ForegroundColor Green
}
if ($AlleenControle) { Write-Host "Alleen controle: kopie staat in $bron"; exit 0 }

# ── 5. Bouwen ───────────────────────────────────────────────────────────────────────────────
$commit = "dev"
try { $commit = (git -C $root rev-parse --short HEAD).Trim() } catch { }
$tags = @()
if ($Devtools) { $tags = @("-tags", "devtools") }
$binary = Join-Path $Uitvoer "bitemp-go-api.exe"
Push-Location $bron
try {
    $ldflags = "-X 'main.commit=$commit-domeinen' -X 'main.buildTime=$((Get-Date).ToUniversalTime().ToString('s'))Z'"
    & go build @tags -ldflags $ldflags -o $binary .
    if ($LASTEXITCODE -ne 0) { throw "go build mislukt (zie hierboven). De kopie staat in $bron." }
} finally { Pop-Location }
Write-Host "4. Gebouwd: $binary" -ForegroundColor Green

if ($Image) {
    Copy-Item -LiteralPath (Join-Path $root "Dockerfile.api") -Destination (Join-Path $bron "Dockerfile.api")
    & docker build -f (Join-Path $bron "Dockerfile.api") -t $Image --build-arg "COMMIT=$commit-domeinen" --build-arg "BUILD_TIME=$((Get-Date).ToUniversalTime().ToString('s'))Z" $bron
    if ($LASTEXITCODE -ne 0) { throw "docker build mislukt" }
    Write-Host "5. Image: $Image" -ForegroundColor Green
}

Write-Host ""
Write-Host "Klaar. Domeinen: $($houden -join ', ')." -ForegroundColor Cyan
Write-Host "Starten (lokaal):  `$env:DATABASE_URL=...; & '$binary'   — gebruik een EIGEN database: tabellen van weggelaten domeinen worden niet aangemaakt, en bestaande data daarvan is via deze API niet bereikbaar."
