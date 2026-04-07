# Copilot Mac Werkwijze (Windows + macOS)

Dit bestand beschrijft een veilige werkwijze om zonder platform-ruis tussen Windows en macOS te wisselen in deze repo.

## Doel

Voorkomen van:
- line-ending conflicten (CRLF/LF)
- platform-specifieke dependency-ruis in commits
- onnodige problemen bij push/pull tussen Windows en Mac

## Eenmalige setup op je Mac

Voer in de repo-root uit:

```bash
git config --local core.autocrlf false
git config --local core.filemode false
```

Controleer daarna:

```bash
git config --local --get core.autocrlf
git config --local --get core.filemode
```

Verwachte output:
- `false`
- `false`

## Dagelijkse workflow (Mac)

1. Pull eerst de laatste wijzigingen.
2. Installeer frontend dependencies lokaal (niet committen):

```bash
cd bitemp_register_v06/web/vite
npm ci
```

3. Start de frontend:

```bash
npm run dev -- --host
```

4. Controleer voor commit dat geen gegenereerde artifacts meegaan:

```bash
git status --short
```

Je hoort geen wijzigingen te zien in:
- `web/vite/node_modules/`
- `web/vite/dist/`
- `web/vite/.vite/`

## Als je alsnog veel onverwachte wijzigingen ziet

1. Zorg dat je geen lokale codewijzigingen kwijt raakt (evt. tijdelijk stashen).
2. Renormaliseer line-endings op basis van `.gitattributes`:

```bash
git add --renormalize .
```

3. Controleer opnieuw met `git status --short`.

## Copilot context (aanbevolen)

Als je Copilot Chat vraagt om problemen met cross-platform git op te lossen, gebruik dan dit korte promptblok:

```text
Werk in deze repo met focus op cross-platform stabiliteit (Windows + macOS).
Houd line-endings consistent volgens .gitattributes.
Voorkom dat node_modules, dist en .vite worden getrackt.
Geef veilige, niet-destructieve git-commando's en leg kort uit wat elk commando doet.
```

## VS Code debug auto-attach en Settings Sync

Als `npm run dev` of `npm run build` meldt:

- `Debugger attached.`
- `Waiting for the debugger to disconnect...`

Dan komt dat meestal door **lokale VS Code debug auto-attach**, niet door Git of `node_modules` zelf.

Aanbevolen:

1. Houd deze debug-instellingen machine-lokaal.
2. Zet ze in je **User Settings Sync ignore list**:

```json
"settingsSync.ignoredSettings": [
  "chat.instructionsFilesLocations",
  "debug.javascript.autoAttachFilter",
  "debug.javascript.autoAttachSmartPattern",
  "debug.javascript.terminalOptions"
]
```

Daarnaast schermt `web/vite/scripts/ensure-local-deps.mjs` sinds april 2026 de automatische `npm install` al af van geërfde debug-variabelen, zodat de frontend-start op Windows en macOS niet onnodig blijft hangen.

## Notities

- `node_modules` is machine-specifiek en mag niet in git.
- `.gitattributes` is leidend voor line-endings; `core.autocrlf=false` voorkomt dubbel gedrag.
- Deze werkwijze geldt zowel op Mac als op Windows in deze repo.
