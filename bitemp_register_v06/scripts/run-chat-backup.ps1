param(
    [switch]$OpenExports,
    [switch]$OpenExportsInVSCode
)

$ErrorActionPreference = 'Stop'

$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) {
    Write-Error 'Fout: niet in een git repo.'
    exit 1
}

$projectRoot = Join-Path $repoRoot 'bitemp_register_v06'
$exportScript = Join-Path $projectRoot 'scripts/export-copilot-chats.py'
$exportDir = Join-Path $projectRoot 'docs/ai-chats/exports'

if (-not (Test-Path $exportScript)) {
    Write-Error "Export script niet gevonden: $exportScript"
    exit 1
}

Push-Location $projectRoot
try {
    $candidates = @(
        @{ Exe = 'py'; Args = @('-3', 'scripts/export-copilot-chats.py') },
        @{ Exe = 'python3'; Args = @('scripts/export-copilot-chats.py') },
        @{ Exe = 'python'; Args = @('scripts/export-copilot-chats.py') }
    )

    function Test-UsableCommand($command) {
        if (-not $command) {
            return $false
        }

        $resolvedPath = ''
        if ($command.Source) {
            $resolvedPath = $command.Source
        } elseif ($command.Definition) {
            $resolvedPath = $command.Definition
        }

        if ($resolvedPath -like '*\WindowsApps\python.exe' -or $resolvedPath -like '*\WindowsApps\python3.exe') {
            return $false
        }

        return $true
    }

    $ran = $false
    $usableInterpreterFound = $false
    $lastExitCode = $null
    $lastInterpreter = $null

    foreach ($candidate in $candidates) {
        $command = Get-Command $candidate.Exe -ErrorAction SilentlyContinue
        if (-not (Test-UsableCommand $command)) {
            continue
        }

        $usableInterpreterFound = $true
        $lastInterpreter = $candidate.Exe

        & $candidate.Exe @($candidate.Args)
        $exitCode = $LASTEXITCODE
        $lastExitCode = $exitCode

        if ($exitCode -eq 0) {
            $ran = $true
            break
        }

        Write-Warning "Interpreter $($candidate.Exe) gaf exitcode $exitCode. Volgende kandidaat wordt geprobeerd."
    }

    if (-not $ran) {
        if ($usableInterpreterFound) {
            Write-Error "Het exportscript faalde via interpreter $lastInterpreter met exitcode $lastExitCode. Zie de foutmelding erboven."
        }

        Write-Error 'Geen werkende Python interpreter gevonden. Op deze machine zijn alleen Windows Store-aliasen zichtbaar of het exportscript faalde. Installeer Python 3 met de Python Launcher (py) of selecteer een echte interpreter in VS Code.'
        exit 1
    }

    if ($OpenExports) {
        if (-not (Test-Path $exportDir)) {
            Write-Error "Exportmap niet gevonden: $exportDir"
            exit 1
        }

        explorer.exe $exportDir | Out-Null
    }

    if ($OpenExportsInVSCode) {
        if (-not (Test-Path $exportDir)) {
            Write-Error "Exportmap niet gevonden: $exportDir"
            exit 1
        }

        $codeCommand = Get-Command code -ErrorAction SilentlyContinue
        if (-not $codeCommand) {
            Write-Error 'VS Code CLI (code) niet gevonden.'
            exit 1
        }

        & $codeCommand.Source --reuse-window --add $exportDir
    }
}
finally {
    Pop-Location
}