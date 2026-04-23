# ASOC-patroon (associatieklasse)

Een **relatie** wordt op het diagram in twee mogelijke vormen weergegeven. De
keuze tussen die vormen is geen aparte modeleigenschap maar **afgeleid** uit de
inhoud van de relatie zelf.

## Single source of truth

De canonieke beslisregel staat in
[`web/vite/src/shared/asoc.js`](../web/vite/src/shared/asoc.js):

```js
import { relatieVorm, isAsoc, asocAnkerId } from "../shared/asoc.js";

relatieVorm(rel); // "asoc" | "collapsed"
isAsoc(rel);      // boolean
```

De regel:

| Voorwaarde                                                | Vorm        |
|-----------------------------------------------------------|-------------|
| `rel.velden.length > 0` of `rel.afgeleideVelden.length > 0` | **asoc**    |
| Geen eigen velden en geen afgeleide velden                | **collapsed** |

Afgeleide velden tellen dus mee — een relatie zonder vaste velden maar met
één afgeleid veld krijgt nog steeds de associatieklasse-vorm.

## Visuele weergave

### ASOC (associatieklasse)

```
   bron-entiteit ─── ◇ ─── doel-entiteit
                    ╎
                    ╎ (dashed)
                    ╎
                   REL  (relatie-node met velden)
```

- **Anker** (◇): node van type `associatieAnker` met id `anker_<relNaam>`.
- **3 edges**:
  1. `bron → anker` — solid associatie-lijn, label nabij **bron**-entiteit toont `bronKardinaliteit`
  2. `anker → doel` — solid associatie-lijn, label nabij **doel**-entiteit toont `doelKardinaliteit` (optioneel directionele pijl)
  3. `anker ╌╌ REL` — dashed association class link (`isAssociationClassLink`)
- **Relatie-node**: getekend als een eigen node die de velden toont.

> UML-conventie: een multipliciteit aan het uiteinde van een associatie geeft
> aan "hoeveel instanties van de naburige klasse meedoen aan één instantie van
> de relatie". Het label wordt door [`MetamodelEdge`](../web/vite/src/umleditor/components/edges/MetamodelEdge.jsx)
> bewust **bij de entity-zijde** getekend (niet bij het anker), zodat de UML-
> conventie zichtbaar klopt — ook al loopt de edge technisch via het anker.

### Collapsed

```
   bron-entiteit ── REL ── doel-entiteit
```

- Twee eenvoudige edges met de relatienaam als label op het middelpunt.
- Geen anker, geen relatie-node met velden.

## Implementatie-eisen

### Single source of truth toepassen

Alle code die het ASOC-patroon (her)opbouwt MOET via `isAsoc()` /
`relatieVorm()` beslissen. De drie belangrijkste plekken:

| Bestand                                                 | Functie                                  |
|---------------------------------------------------------|------------------------------------------|
| `web/vite/src/store/adapters.js`                        | `v3ModelNaarStore()` — V3 → IDE store    |
| `web/vite/src/umleditor/metamodel/v3ModelNaarEditor.js` | `v3ModelNaarEditor()` — V3 → standalone editor |
| `web/vite/src/store/useModelStore.js`                   | `verversAsocVoorRelaties()` — re-evaluatie via context-menu |

### Anker is viewmodel-state, geen modelstate

- Het anker-element komt **niet** in `V3` JSON terug. Alleen
  `rel.ankerPositie` (positie-hint) wordt geserialiseerd voor roundtrip.
- Bij **IDE-export** (`exportStoreAsJson`) worden anker-elementen uit
  `state.elements` weggefilterd. Ze blijven wél in `diagrams[*].nodes`
  zodat de positie behouden blijft.
- Bij **IDE-import** (`importStoreFromJson`) worden anker-elementen
  gereconstrueerd vanuit de diagram-nodes (id begint met `anker_`).

### Ververs ASOC (rechtsklikmenu)

Op het IDE-canvas zit een rechtsklik-actie **🔄 Ververs ASOC** voor relatie-
en anker-nodes. Die roept `verversAsocVoorRelaties(diagramId, [...])` aan en:

1. Bewaart de bestaande anker-positie (of berekent middelpunt).
2. Verwijdert anker-element + structurele edges van de relatie.
3. Bouwt het juiste patroon (ASOC of collapsed) opnieuw op via `isAsoc(rel)`.

Dependency-edges (bijv. binding aan een referentielijst-instantie) blijven
ongewijzigd.

## Bekende beperkingen / TODO

- **Edge-handles** (gebruikersgekozen ankerpunten op nodes) gaan verloren bij
  Ververs ASOC, omdat de edges opnieuw aangemaakt worden.
- De UML-editor (`umleditor/metamodel/types.js`) detecteert ASOC nog via
  edge-scanning (`isAssociation`/`isAssociationClassLink` flags). Een
  toekomstige cleanup zou dat ook via `isAsoc(rel)` kunnen doen.
- `web/vite/src/umleditor/components/MetamodelEditor.jsx` heeft nog meerdere
  plekken die `n.type === "associatieAnker"` checken; die zijn correct, maar
  bij toekomstige refactors kan `isAsocAnkerElementId(id)` uit `shared/asoc.js`
  helpen.
