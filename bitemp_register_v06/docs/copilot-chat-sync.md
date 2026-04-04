# Copilot Chat Sync En Export

VS Code synchroniseert Copilot Chat-geschiedenis niet automatisch via GitHub of Settings Sync. De praktische oplossing in deze repo is daarom: chats lokaal exporteren naar Markdown en die bestanden via Git synchroniseren tussen machines.

## Wat is ingericht

- `scripts/export-copilot-chats.py` leest de lokale VS Code chatopslag uit en schrijft Markdown naar `docs/copilot-chats/exports/`.
- `scripts/pre-commit-chat-export` draait dit exportscript automatisch bij elke `git commit`.
- De hook voegt nieuwe of bijgewerkte chat-exports meteen toe aan dezelfde commit.

## Installatie

Voer het commando uit vanuit de repo-root.

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File bitemp_register_v06/scripts/install-chat-hook.ps1
```

Git Bash, macOS of Linux:

```sh
sh bitemp_register_v06/scripts/install-chat-hook.sh
```

Als je op Windows liever in Git Bash werkt, mag dat ook. `sh ...install-chat-hook.sh` werkt daar wel.

## VS Code tasks

Er zijn vier handige taken in deze workspace:

- `copilot: backup chats (v06)` voor een handmatige export zonder commit.
- `copilot: backup chats and open exports in VS Code (v06)` voor een handmatige export en openen van de exportmap als extra root folder in het huidige VS Code-venster.
- `copilot: backup chats and open latest export in VS Code (v06)` voor een handmatige export en direct openen van het nieuwste geëxporteerde chatbestand als editor-tab.
- `copilot: install chat hook (v06)` om de automatische pre-commit hook te installeren.

Deze taken gebruiken intern `scripts/run-chat-backup.ps1`, dat op Windows eerst `py -3` probeert en daarna pas `python3` en `python`. Daarmee vermijden we de veelvoorkomende Microsoft Store-alias van `python`.

Als de task toch meldt dat er geen werkende Python interpreter is, dan staat er op die machine nog geen echte Python-installatie in PATH. De Windows Store-alias `python.exe` is daarvoor niet voldoende.

## Handmatig exporteren

Als je niet wilt wachten tot de volgende commit, kun je handmatig exporteren:

```powershell
Set-Location bitemp_register_v06
python scripts/export-copilot-chats.py
```

Als `python` niet bestaat, probeer dan eerst `py -3 scripts/export-copilot-chats.py` en daarna pas `python3 scripts/export-copilot-chats.py`.

Als ook `py -3` niet werkt, installeer dan Python 3 voor Windows inclusief de Python Launcher en vink tijdens installatie bij voorkeur `Add python.exe to PATH` aan.

## Gedrag van de hook

- De hook draait bij elke `git commit`, ongeacht of je commit vanuit VS Code, terminal of GitHub Desktop maakt.
- Als een chat later verder groeit, wordt de bestaande Markdown-export opnieuw opgebouwd met de nieuwste inhoud.
- Ook multi-root workspaces worden meegenomen: als `workspaceStorage/*/workspace.json` verwijst naar een aparte `.code-workspace`-config, leest de export nu ook die onderliggende mappen uit.
- Bestandsnamen gebruiken waar mogelijk de echte IDE-sessietitel uit `customTitle`; alleen als die ontbreekt, valt de export terug op de eerste user-regel of de Copilot `generatedTitle`.
- Als een sessie geen bruikbare `creationDate` heeft, valt de export terug op de berichttimestamp of bestandstijd zodat er geen onterechte `1970-01-01`-bestanden ontstaan.
- Bestaande exportbestanden worden zo nodig automatisch hernoemd wanneer een betere titel of datum beschikbaar komt.
- Bestandsnaam-slugs normaliseren ook accenten en diacritics, zodat bijvoorbeeld `creëren` als `creeren` in de bestandsnaam terechtkomt.
- Lege of ongebruikte chats worden niet geëxporteerd.

## Synchronisatie tussen machines

Deze oplossing synchroniseert niet de live chatlijst in de VS Code UI. Wat wel gesynchroniseerd wordt, zijn de geëxporteerde Markdown-bestanden in Git. Daardoor kun je op een andere machine de inhoud van eerdere chats teruglezen in de repo, ook al verschijnen ze niet automatisch terug in het Copilot Chat-paneel zelf.

## Veelvoorkomende Windows-fout

Foutmelding:

```text
sh : The term 'sh' is not recognized...
```

Oorzaak: je draait een shell-commando in PowerShell.

Oplossing: gebruik in PowerShell het `.ps1`-installatiescript:

```powershell
powershell -ExecutionPolicy Bypass -File bitemp_register_v06/scripts/install-chat-hook.ps1
```