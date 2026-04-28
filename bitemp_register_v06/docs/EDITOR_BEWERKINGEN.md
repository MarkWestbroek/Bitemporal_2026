# Editor-bewerkingen (transformaties)

Pure structurele transformaties op de IDE-store, geïmplementeerd in
[`web/vite/src/ide/transformations.js`](../web/vite/src/ide/transformations.js).

Alle transformaties volgen hetzelfde **patroon**:

```js
const patch = doeIets(state, ...args, opts);
if (!patch.ok) {
  alert(patch.errors.join("\n"));
  return;
}
patch.warnings.forEach((w) => console.warn(w));
passToePatch(useModelStore, patch);
```

Een patch heeft de vorm:

```ts
{
  ok: boolean,
  warnings: string[],
  errors: string[],
  elements: Record<string, Element>,
  structuralEdges: Edge[],
  newIds: string[],
  removedIds: string[],
}
```

`elements` en `structuralEdges` bevatten de **volledige nieuwe state** — caller
hoeft geen diff toe te passen.

---

## B5 — Cast Entiteit naar Gegevenselement

`castEntiteitNaarGE(state, entId, parentEntId, opts?)`

Promoot een vrijstaande entiteit tot GE onder een parent-entiteit:

1. `metatype` wordt `"gegevenselement"`.
2. `domein` wordt overschreven naar `parent.domein` (warning indien anders).
3. **Inkomende edges** van andere entiteiten dan de parent → verwijderd.
4. **Uitgaande edges** naar entiteiten of relaties → verwijderd.
5. **GE↔GE edges** blijven bewaard (kunnen onderdelen zijn van compositie-tree).
6. Compositie `parent → ent` wordt toegevoegd indien nog niet aanwezig.

**UI**: contextmenu op entiteit in Project Browser → "Cast naar GE".
Toont een prompt met genummerde lijst van kandidaat-parents (zelfde domein eerst).

---

## B6 — Splits Entiteit in GE's

`splitsEntiteit(state, entId, veldNamen)`

Splits een entiteit door geselecteerde velden uit te tillen naar nieuwe GE's:

- Per veld: nieuwe GE met typenaam `${ent.typenaam}_${PascalCase(veld.naam)}`.
- Kardinaliteit: `"1"` als `verplicht`, anders `"0..1"`.
- Compositie-edge `ent → nieuweGE` wordt toegevoegd.
- Originele velden blijven (deze functie verwijdert ze NIET; dat doet de caller
  bewust, om review mogelijk te maken).

**UI**: contextmenu op entiteit in Project Browser → "Splits in GE's".
Toont een prompt met genummerde velden, comma-gescheiden invoer (bijv. `1,3,4`).

---

## B7 — Promoot relatie tot associatieklasse

`relatieNaarAssociatieklasse(state, edgeId, opts?)`

Vervangt een directe edge `A → B` door een associatieklasse-tussenstation:

- Nieuw element: `Rel_${BronTypenaam}_${DoelTypenaam}` (override via `opts.relatieNaam`).
- `velden: []` initieel — ASOC-vorm (anker + dashed line) activeert pas bij eerste veld.
- Originele edge wordt vervangen door:
  - `A → Rel_A_B`
  - `Rel_A_B → B`

**UI**: edge-contextmenu in DiagramCanvas → "🔀 Promoot tot associatieklasse".
Voorwaarde: `bron.metatype === "entiteit" && doel.metatype === "entiteit" && !isDependency`.

---

## Tests

`src/ide/transformations.test.js` — 18 tests, runt via `npm test`
(zie [RELEASE.md](../RELEASE.md) voor de test-infrastructuur).

Edge cases gedekt:
- B5: parent niet gevonden → error; cross-domein → warning.
- B6: veld bestaat niet → error; lege selectie → warning.
- B7: bron of doel geen entiteit → error; dependency edge → error.
