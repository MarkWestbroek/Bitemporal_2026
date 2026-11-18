# Metamodellen van Omnium (alleen-lezen)

Gegenereerde Studio-werkbestanden (puur-uml) die beschrijven hoe Omnium zelf in elkaar zit
(plan `docs/plans/2026-11-15 M3 en projectmetamodel als modellen in Omnium`; besluiten Mark 15-11):

| Bestand | Wat | Bron |
|---|---|---|
| `omnium-m3.studio-project.json` | het **M3**: waarmee een profiel (M2) beschreven wordt, in drie pakketten (Definitie, Stijl, Implementatie) | `web/vite/src/diagramcore/types/m3.js` + de uitleg uit `schema.js` |
| `omnium-projectmetamodel.studio-project.json` | het **projectmetamodel**: het werkbestand (Werkbestand, Model) en, apart, de Werkruimte per gebruiker; formaat 4 met de uuid-eis | `web/vite/src/studio/projectMetamodel.js` |

**De code is de implementatie; dit is documentatie.** Niet met de hand bewerken, behalve de layout:

- `npm run metamodellen` (in `web/vite`) maakt de bestanden opnieuw. Elk voorkomen dat er al was
  houdt zijn plek en breedte (Marks layout blijft staan); alleen nieuwe klassen krijgen een plek,
  onder wat er staat.
- `npm test` faalt als een bestand achterloopt (`studio/metamodellen/metamodellen.test.js`), en als
  `m3.js` niet meer klopt met `schema.js` of met de profielen (`m3.test.js`,
  `render-svc/m3Dekking.test.mjs`), of als `projectMetamodel.js` niet meer klopt met de code en met
  echte werkbestanden (`studio/projectMetamodel.test.js`).
- Openen: in de Studio via *Project → Importeer project…*. Op app komen ze (stap 4) als project met
  leestoegang voor iedereen; Mark kan de layout daar aanpassen.

Afbeelding naar puur-uml: een eigenschap tussen twee klassen is een associatie (rolnaam aan het
doel, compositie bij samenstelling); naar een primitief, datatype of enumeratie een attribuut;
code is een operatie. Op het diagram van een pakket staan de klassen uit een ander pakket als kop.
