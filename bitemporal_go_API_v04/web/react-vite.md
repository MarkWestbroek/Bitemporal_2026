React + Vite: voor- en nadelen

#Voordelen
-Razendsnelle dev-server — Vite gebruikt native ES modules in de browser tijdens development, waardoor de starttijd milliseconden is (geen bundelen bij opstart).
-Hot Module Replacement (HMR) — wijzigingen in code zijn vrijwel instant zichtbaar, zonder volledige page reload.
=Snellere builds — Vite gebruikt esbuild (Go-based) voor transpilatie, dat 10–100x sneller is dan Webpack/Babel.
-Minder configuratie — out-of-the-box werkend voor React, TypeScript, CSS modules etc.
-Actief onderhouden — Vite is de aanbevolen tool van het React-team (vervangt Create React App).

#Nadelen
-Dev ≠ Prod — In development gebruikt Vite native ESM, in productie bundelt het met Rollup. Dit kan soms tot subtiele verschillen leiden.
-Rollup plugins — Webpack heeft een groter plugin-ecosysteem; sommige Webpack-specifieke plugins werken niet direct.
-Minder legacy-support out-of-the-box — Standaard target Vite moderne browsers. Voor IE11 of heel oude browsers heb je extra configuratie nodig (@vitejs/plugin-legacy).

#Browsercompatibiliteit
Voor productie bundelt Vite met Rollup en genereert geoptimaliseerde bestanden — die werken prima in alle moderne browsers (Chrome, Firefox, Safari, Edge) en op mobiel (iOS/Android).

Situatie	Compatibiliteit
Moderne browsers (2019+)	Volledig ondersteund
Oudere browsers (IE11)	Vereist @vitejs/plugin-legacy
Mobiel (iOS Safari, Android Chrome)	Prima, geen problemen

#Conclusie: Voor vrijwel elk project is React + Vite een uitstekende keuze. Alleen als je IE11 of zeer oude browsers moet ondersteunen, heb je een extra plugin nodig.