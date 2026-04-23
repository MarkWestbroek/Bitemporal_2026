# Vite Handleiding

Deze handleiding beschrijft hoe je in deze workspace de Vite server start, stopt en opnieuw opbouwt via VS Code Tasks en Launch-configuraties.

## Overzicht van taken

Beschikbare tasks in VS Code:

- Vite: Start Dev Server
- Vite: Stop Dev Server
- Vite: Restart Dev Server
- Vite: Build
- Vite: Rebuild (Clean Dist)
- Vite: Preview
- Vite: Stop Preview

## Snel gebruiken in VS Code

### Via Tasks

1. Open Command Palette.
2. Kies: Tasks: Run Task.
3. Selecteer een van de Vite-taken.

Aanbevolen volgorde tijdens ontwikkelen:

1. Vite: Start Dev Server
2. Werk in de app
3. Vite: Stop Dev Server

### Via Run and Debug

Beschikbare launch-items:

- Vite: Start + Open in Browser
- Vite Preview: Open in Browser

Gebruik:

1. Open Run and Debug.
2. Kies de gewenste configuratie.
3. Start debugging.

De preLaunchTask start automatisch de server.
De postDebugTask stopt de server automatisch als je de debug-sessie stopt.

## Uitleg: dev versus preview

Kort verschil:

- dev: ontwikkelserver met Hot Module Replacement (HMR), snel feedback tijdens coderen.
- preview: serveert de gebouwde productie-output uit dist, bedoeld om productiegedrag te controleren.

Meer detail:

- Dev server
  - Command: npm run dev
  - Poort: 5173
  - Doel: ontwikkelen
  - Eigenschap: directe reload/HMR bij wijzigen van bestanden

- Preview server
  - Command: npm run preview
  - Poort: 4173
  - Doel: productiecontrole
  - Eigenschap: gebruikt bestaande build in dist

Belangrijk:

- preview bouwt niet automatisch opnieuw.
- Als je code wijzigt en je wil die in preview zien, voer eerst een build of rebuild uit.

## Build en Rebuild

- Vite: Build
  - Draait een normale productiebuild.

- Vite: Rebuild (Clean Dist)
  - Verwijdert eerst dist en bouwt daarna opnieuw.
  - Handig als je zeker wilt weten dat er geen oude buildbestanden blijven hangen.

## Veelvoorkomende scenario's

### Ik wil ontwikkelen

1. Start: Vite: Start Dev Server
2. Open: http://127.0.0.1:5173
3. Stop na afloop: Vite: Stop Dev Server

### Ik wil productiegedrag checken

1. Run: Vite: Rebuild (Clean Dist)
2. Start: Vite: Preview
3. Open: http://127.0.0.1:4173
4. Stop na afloop: Vite: Stop Preview

### Ik wil alles verversen

1. Vite: Rebuild (Clean Dist)
2. Vite: Restart Dev Server

## Troubleshooting

### Start Dev Server faalt met poortfout

Mogelijk draait er al een proces op poort 5173.

Oplossing:

1. Run task: Vite: Stop Dev Server
2. Start opnieuw: Vite: Start Dev Server

### Start Preview faalt met poortfout

Mogelijk draait er al een proces op poort 4173.

Oplossing:

1. Run task: Vite: Stop Preview
2. Start opnieuw: Vite: Preview

### PowerShell policy blokkeert npm

In deze setup worden tasks via npm.cmd uitgevoerd, waardoor npm.ps1 policy-blokkades worden vermeden.
