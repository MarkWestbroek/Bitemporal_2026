# Orphan-test bestanden

Deze map bevat opzettelijk "kapotte" UML/Mermaid bestanden om de
**orphan-detectie + dialoog** in de UML-editor te valideren.

## Verwachte UI-flow

Bij het importeren van een van deze bestanden in de IDE
(Project Browser → 📥 Import → kies bestand) verschijnt de
**OrphanResolutieDialog** met per orphan-node een keuze:

- **Placeholder maken** (default, kleur amber): maakt automatisch een
  `Placeholder_<naam>` entiteit + edge.
- **Overslaan**: verwijdert de orphan-node + aangrenzende edges.
- **Import afbreken**: hele import faalt (Error code `ORPHAN_ABORT`).

## Bestanden

| Bestand                    | Soort           | Wat is er fout?                                                |
|----------------------------|-----------------|----------------------------------------------------------------|
| `01-orphan-ge.mmd`         | Mermaid         | GE `LosseAdres` zonder compositie vanuit een entiteit          |
| `02-orphan-relatie.mmd`    | Mermaid         | Relatie `Bevat` zonder enige koppeling aan een entiteit        |
| `03-multiple-orphans.mmd`  | Mermaid         | Meerdere orphan GE's + 1 orphan relatie                        |
| `04-only-dependency.mmd`   | Mermaid         | GE alleen via `«use»` dependency — telt niet als parent        |
| `05-valid-baseline.mmd`    | Mermaid         | Correct model (geen dialoog verwacht) — sanity check           |

## Regels (bron: `rawuml.js::detecteerOrphans`)

- Een **gegevenselement** is orphan als er geen edge `entiteit → ge`
  bestaat die niet `isDependency` of `isGeneralization` is.
- Een **relatie** is orphan als er geen enkele edge bestaat naar een
  entiteit of `associatieAnker`.

## Tests

De pure logica is gedekt door
[`src/umleditor/import/rawuml.test.js`](../web/vite/src/umleditor/import/rawuml.test.js)
(zie tests `detecteerOrphans:` en `pasOrphanActiesToe:`).

Deze bestanden zijn voor **handmatige UI-validatie** van de dialoog.
