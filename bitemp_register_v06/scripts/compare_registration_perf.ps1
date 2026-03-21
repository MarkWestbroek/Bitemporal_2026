param(
    [string]$BaseUrl = "http://localhost:8080",
    [int]$Iterations = 200,
    [int]$Warmup = 20,
    [int]$Runs = 3,
    [int]$StartId = 100000,
    [string]$CsvPath = "",
    [switch]$WriteDbReport,
    [string]$DbContainer = "sweet_agnesi",
    [string]$DbName = "bitemp_go_db",
    [string]$DbUser = "postgres",
    [string]$DbReportPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-Percentile {
    param(
        [double[]]$Values,
        [double]$Percentile
    )

    if (-not $Values -or $Values.Count -eq 0) {
        return 0.0
    }

    $sorted = @($Values | Sort-Object)
    $rank = [math]::Ceiling(($Percentile / 100.0) * $sorted.Count)
    $index = [math]::Min([math]::Max($rank - 1, 0), $sorted.Count - 1)
    return [double]$sorted[$index]
}

function New-RegistratieBody {
    param(
        [int]$IdBase,
        [int]$Index
    )

    $aId = $IdBase + $Index
    $uRel = ($IdBase * 10) + ($Index * 10) + 1
    $vRel1 = ($IdBase * 10) + ($Index * 10) + 2
    $vRel2 = ($IdBase * 10) + ($Index * 10) + 3
    $timestamp = [DateTime]::UtcNow.AddSeconds($Index).ToString("o")

    $payload = @{
        registratie = @{
            registratietype = "registratie"
            tijdstip = $timestamp
            opmerking = "perf-run-$Index"
        }
        wijzigingen = @(
            @{
                opvoer = @{
                    a = @{
                        id = $aId
                        us = @(
                            @{
                                rel_id = $uRel
                                a_id = $aId
                                aaa = "a$aId"
                                bbb = "b$aId"
                            }
                        )
                        vs = @(
                            @{
                                rel_id = $vRel1
                                a_id = $aId
                                ccc = "c$aId-1"
                            },
                            @{
                                rel_id = $vRel2
                                a_id = $aId
                                ccc = "c$aId-2"
                            }
                        )
                    }
                }
            }
        )
    }

    return ($payload | ConvertTo-Json -Depth 10)
}

function Invoke-Scenario {
    param(
        [string]$Mode,
        [int]$Count,
        [int]$IdOffset
    )

    if ($Mode -eq "reflectie") {
        $uri = "$BaseUrl/registratie/?methode=reflectie"
    }
    else {
        $uri = "$BaseUrl/registratie/"
    }

    $durationsMs = New-Object System.Collections.Generic.List[double]
    $failures = 0

    $totalSw = [System.Diagnostics.Stopwatch]::StartNew()
    for ($i = 0; $i -lt $Count; $i++) {
        $body = New-RegistratieBody -IdBase $IdOffset -Index $i

        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body $body | Out-Null
        }
        catch {
            $failures++
        }
        finally {
            $sw.Stop()
            $durationsMs.Add([double]$sw.Elapsed.TotalMilliseconds)
        }
    }
    $totalSw.Stop()

    $avgMs = ($durationsMs | Measure-Object -Average).Average
    $minMs = ($durationsMs | Measure-Object -Minimum).Minimum
    $maxMs = ($durationsMs | Measure-Object -Maximum).Maximum
    $p50 = Get-Percentile -Values $durationsMs.ToArray() -Percentile 50
    $p95 = Get-Percentile -Values $durationsMs.ToArray() -Percentile 95
    $rps = if ($totalSw.Elapsed.TotalSeconds -gt 0) { $Count / $totalSw.Elapsed.TotalSeconds } else { 0 }

    return [pscustomobject]@{
        mode = $Mode
        requests = $Count
        failures = $failures
        total_ms = [math]::Round($totalSw.Elapsed.TotalMilliseconds, 2)
        avg_ms = [math]::Round($avgMs, 2)
        p50_ms = [math]::Round($p50, 2)
        p95_ms = [math]::Round($p95, 2)
        min_ms = [math]::Round($minMs, 2)
        max_ms = [math]::Round($maxMs, 2)
        rps = [math]::Round($rps, 2)
    }
}

function Invoke-DbPsqlCsv {
    param(
        [string]$Query
    )

    $output = docker exec $DbContainer psql -U $DbUser -d $DbName -t -A -F "," -c $Query 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Kon DB-query niet uitvoeren in container '$DbContainer'."
    }

    $lines = @($output | ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ -ne "" })
    return ,$lines
}

function Write-DbReport {
    param(
        [string]$Path
    )

    $dbSizeLines = Invoke-DbPsqlCsv -Query "SELECT current_database(), pg_size_pretty(pg_database_size(current_database())), pg_database_size(current_database());"
    if ($dbSizeLines.Count -lt 1) {
        throw "Geen DB-size data ontvangen."
    }

    $dbParts = $dbSizeLines[0].Split(',')
    $db = $dbParts[0]
    $dbSizePretty = $dbParts[1]
    $dbSizeBytes = $dbParts[2]

    $tableLines = Invoke-DbPsqlCsv -Query "WITH sizes AS (SELECT c.relname AS table_name, pg_total_relation_size(c.oid) AS total_size_bytes, pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind='r' AND n.nspname='public') SELECT s.table_name, COALESCE(cnt.exact_rows, 0), s.total_size, s.total_size_bytes FROM sizes s LEFT JOIN (SELECT 'wijziging'::text AS table_name, COUNT(*)::bigint AS exact_rows FROM wijziging UNION ALL SELECT 'a_v', COUNT(*) FROM a_v UNION ALL SELECT 'a_u', COUNT(*) FROM a_u UNION ALL SELECT 'registratie', COUNT(*) FROM registratie UNION ALL SELECT 'a', COUNT(*) FROM a) cnt ON cnt.table_name = s.table_name ORDER BY s.total_size_bytes DESC;"

    $tableRows = New-Object System.Collections.Generic.List[string]
    foreach ($line in $tableLines) {
        $parts = $line.Split(',')
        if ($parts.Count -ge 4) {
            $tableRows.Add("| $($parts[0]) | $($parts[1]) | $($parts[2]) |")
        }
    }

    $content = @(
        "# Database grootte na tests"
        ""
        "## Snapshot (actueel)"
        "- Database: ``$db``"
        "- Totale grootte: ``$dbSizePretty`` (``$dbSizeBytes bytes``)"
        ""
        "### Grootste tabellen (met exacte rows voor top-tabellen)"
        ""
        "| tabel | exact_rows | total_size |"
        "|---|---:|---:|"
    )

    $content += $tableRows

    $content += @(
        ""
        "## Instructie: zelf opnieuw opvragen"
        ""
        "### 1) Totale databasegrootte"
        ""
        "```powershell"
        "docker exec $DbContainer psql -U $DbUser -d $DbName -c `"SELECT current_database() AS db, pg_size_pretty(pg_database_size(current_database())) AS db_size, pg_database_size(current_database()) AS db_size_bytes;`""
        "```"
        ""
        "### 2) Tabelgroottes + exacte rowcounts (top-tabellen)"
        ""
        "```powershell"
        "docker exec $DbContainer psql -U $DbUser -d $DbName -c `"WITH sizes AS (SELECT c.relname AS table_name, pg_total_relation_size(c.oid) AS total_size_bytes, pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind='r' AND n.nspname='public') SELECT s.table_name, COALESCE(cnt.exact_rows, 0) AS exact_rows, s.total_size, s.total_size_bytes FROM sizes s LEFT JOIN (SELECT 'wijziging'::text AS table_name, COUNT(*)::bigint AS exact_rows FROM wijziging UNION ALL SELECT 'a_v', COUNT(*) FROM a_v UNION ALL SELECT 'a_u', COUNT(*) FROM a_u UNION ALL SELECT 'registratie', COUNT(*) FROM registratie UNION ALL SELECT 'a', COUNT(*) FROM a) cnt ON cnt.table_name = s.table_name ORDER BY s.total_size_bytes DESC;`""
        "```"
        ""
        "## Korte conclusie"
        ""
        "Groei zit vooral in ``wijziging``, ``a_v``, ``a_u``, ``registratie`` en ``a``, wat past bij registratie/performance-runs."
    )

    Set-Content -Path $Path -Value ($content -join [Environment]::NewLine) -Encoding UTF8
}

Write-Host "Perf compare start"
Write-Host "BaseUrl=$BaseUrl Iterations=$Iterations Warmup=$Warmup Runs=$Runs"

if ($Warmup -gt 0) {
    Write-Host "Warmup meta..."
    $null = Invoke-Scenario -Mode "meta" -Count $Warmup -IdOffset $StartId

    Write-Host "Warmup reflectie..."
    $null = Invoke-Scenario -Mode "reflectie" -Count $Warmup -IdOffset ($StartId + 500000)
}

$results = New-Object System.Collections.Generic.List[object]

for ($run = 1; $run -le $Runs; $run++) {
    $metaOffset = $StartId + ($run * 1000000)
    $reflectieOffset = $StartId + ($run * 1000000) + 500000

    if (($run % 2) -eq 1) {
        Write-Host "Run ${run}: meta -> reflectie"
        $results.Add((Invoke-Scenario -Mode "meta" -Count $Iterations -IdOffset $metaOffset))
        $results.Add((Invoke-Scenario -Mode "reflectie" -Count $Iterations -IdOffset $reflectieOffset))
    }
    else {
        Write-Host "Run ${run}: reflectie -> meta"
        $results.Add((Invoke-Scenario -Mode "reflectie" -Count $Iterations -IdOffset $reflectieOffset))
        $results.Add((Invoke-Scenario -Mode "meta" -Count $Iterations -IdOffset $metaOffset))
    }
}

Write-Host ""
Write-Host "Per run:"
$results | Format-Table mode, requests, failures, total_ms, avg_ms, p50_ms, p95_ms, min_ms, max_ms, rps -AutoSize

Write-Host ""
Write-Host "Samenvatting per mode:"
$summary = $results |
    Group-Object mode |
    ForEach-Object {
        $rows = $_.Group
        [pscustomobject]@{
            mode = $_.Name
            runs = $rows.Count
            total_ms_avg = [math]::Round((($rows | Measure-Object total_ms -Average).Average), 2)
            avg_ms_avg = [math]::Round((($rows | Measure-Object avg_ms -Average).Average), 2)
            p95_ms_avg = [math]::Round((($rows | Measure-Object p95_ms -Average).Average), 2)
            rps_avg = [math]::Round((($rows | Measure-Object rps -Average).Average), 2)
            failures_total = ($rows | Measure-Object failures -Sum).Sum
        }
    }
$summary | Format-Table mode, runs, total_ms_avg, avg_ms_avg, p95_ms_avg, rps_avg, failures_total -AutoSize

Write-Host ""
if (-not [string]::IsNullOrWhiteSpace($CsvPath)) {
    $csvDir = Split-Path -Path $CsvPath -Parent
    if (-not [string]::IsNullOrWhiteSpace($csvDir) -and -not (Test-Path -Path $csvDir)) {
        New-Item -Path $csvDir -ItemType Directory -Force | Out-Null
    }

    $runCsvPath = $CsvPath
    $summaryCsvPath = [System.IO.Path]::Combine(
        [System.IO.Path]::GetDirectoryName($CsvPath),
        ([System.IO.Path]::GetFileNameWithoutExtension($CsvPath) + "_summary" + [System.IO.Path]::GetExtension($CsvPath))
    )

    $results | Export-Csv -Path $runCsvPath -NoTypeInformation -Encoding UTF8
    $summary | Export-Csv -Path $summaryCsvPath -NoTypeInformation -Encoding UTF8

    Write-Host "CSV geschreven:"
    Write-Host "- per run: $runCsvPath"
    Write-Host "- samenvatting: $summaryCsvPath"
    Write-Host ""
}

$shouldWriteDbReport = $WriteDbReport.IsPresent -or -not [string]::IsNullOrWhiteSpace($DbReportPath)
if ($shouldWriteDbReport) {
    try {
        $reportPath = $DbReportPath
        if ([string]::IsNullOrWhiteSpace($reportPath)) {
            $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
            if (-not [string]::IsNullOrWhiteSpace($CsvPath)) {
                $csvDir = [System.IO.Path]::GetDirectoryName($CsvPath)
                $csvName = [System.IO.Path]::GetFileNameWithoutExtension($CsvPath)
                $reportPath = [System.IO.Path]::Combine($csvDir, "$csvName`_db_size_$timestamp.md")
            }
            else {
                $reportPath = [System.IO.Path]::Combine(".", "perf-results", "db_size_$timestamp.md")
            }
        }

        $reportDir = Split-Path -Path $reportPath -Parent
        if (-not [string]::IsNullOrWhiteSpace($reportDir) -and -not (Test-Path -Path $reportDir)) {
            New-Item -Path $reportDir -ItemType Directory -Force | Out-Null
        }

        Write-DbReport -Path $reportPath
        Write-Host "DB-rapport geschreven:"
        Write-Host "- $reportPath"
        Write-Host ""
    }
    catch {
        Write-Warning "DB-rapport kon niet worden geschreven: $($_.Exception.Message)"
    }
}

Write-Host "Klaar. Gebruik vooral total_ms_avg en p95_ms_avg voor vergelijking."