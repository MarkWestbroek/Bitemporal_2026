# profielen/ — git-gepersisteerde Studio 0.5-profielen (P04)

Elk `.json`-bestand hier is één profiel uit de profiel-editor (PE):

```json
{
  "kern": { "id": "mijn-profiel", "label": "…", "elementTypes": [ … ] },
  "layout": { "elementDef:Ding#1": { "x": 80, "y": 60 } }
}
```

- `kern` — de descriptor-kern (trede 1-vorm, hooks op catalogus-id). Alleen
  aanwezig voor éigen profielen; voor ingebouwde profielen (mim12, oas31, …)
  kan een bestand met alléén `layout` bestaan (de bewaarde standaard-layout
  van het ontwerp-diagram).
- De bestanden worden geschreven door het dev-endpoint
  `/__studio05/profielen` (vite-plugin `studio05Profielen` in
  `vite.config.js`) wanneer je in de PE *Activeer profiel…* of *Bewaar
  layout als standaard* gebruikt, en bij het laden van de Studio weer
  ingelezen (ze winnen van localStorage).
- **Committen dus**: zo reizen profielen — inclusief layout — via git mee
  naar andere dev-machines. Voor **productie** worden de gecommitte
  bestanden bij `vite build` in de bundle meegebakken (import.meta.glob in
  `profielRegistratie.jsx`): dezelfde git-bron, alleen lezen. Wijzigingen
  die je in een productie-omgeving maakt blijven in localStorage van die
  browser; een gedeelde runtime-registry (Go-API) is fase 7.
