$ErrorActionPreference = 'Stop'

$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) {
    Write-Error 'Fout: niet in een git repo.'
    exit 1
}

$hookSrc = Join-Path $repoRoot 'bitemp_register_v06/scripts/pre-commit-chat-export'
$hookDst = Join-Path $repoRoot '.git/hooks/pre-commit'

if (-not (Test-Path $hookSrc)) {
    Write-Error "Fout: $hookSrc niet gevonden."
    exit 1
}

if (Test-Path $hookDst) {
    $existingHook = Get-Content -Raw -Path $hookDst
    if ($existingHook -match 'pre-commit-chat-export') {
        Write-Output "Hook is al geïnstalleerd in $hookDst"
        exit 0
    }

    Write-Output "Er bestaat al een pre-commit hook. Voeg deze regel toe aan ${hookDst}:"
    Write-Output '  bitemp_register_v06/scripts/pre-commit-chat-export'
    exit 0
}

$hookContent = Get-Content -Raw -Path $hookSrc
$hookContent = $hookContent -replace "`r`n", "`n"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($hookDst, $hookContent, $utf8NoBom)

Write-Output "Pre-commit hook geïnstalleerd: $hookDst"
Write-Output 'De hook draait daarna bij elke git commit, ook vanuit GitHub Desktop.'