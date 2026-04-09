# Fase B — FormulierDefinitie als bitemporale entiteit

**Datum**: 2026-04-15
**Backlog items**: F1, F2, F25–F30
**Status**: Fase B kern ✅ + F29 ✅ afgerond, vervolgstappen open (F30)

---

## Samenvatting

FormulierDefinitie is geïmplementeerd als een **bitemporale entiteit** in het configuratie-domein, zodat wijzigingen aan formulierlayouts traceerbaar en corrigeerbaar zijn via het standaard registratie-mechanisme.

De implementatie omvat:
1. **Backend**: codegen-gegenereerde entiteit met Meta en Layout GE's
2. **Frontend**: CustomFormulierRenderer, useFormulierDefinitie hook, integratie in EntiteitFormulier

---

## Architectuur

### Domein: configuratie

Het configuratie-domein bevat types die het register zelf configureren (geen inhoudelijke data):

| Type | Metatype | Omschrijving |
|------|----------|-------------|
| FormulierDefinitie | entiteit | Container voor een formulierdefinitie |
| FormulierDefinitie_Meta | GE (enkelvoudig) | Metadata: naam, beschrijving, doeltype, status, is_standaard |
| FormulierDefinitie_Layout | GE (enkelvoudig) | Layout JSON-string die de visuele structuur beschrijft |
| FormulierDefinitie_Aanvang | plumbing | Materiële aanvangsdatum |
| FormulierDefinitie_Einde | plumbing | Materiële einddatum |

### FormulierDefinitieStatus enum

```
concept  — nog in ontwikkeling
actief   — beschikbaar voor gebruik
inactief — niet meer actief, beschikbaar als archief
```

### Layout JSON structuur

```json
{
  "type": "formulier",
  "elementen": [
    {
      "type": "groep",
      "label": "Persoonsgegevens",
      "elementen": [
        { "type": "veld", "veld": "voornaam" },
        { "type": "veld", "veld": "achternaam" },
        { "type": "rij", "elementen": [
          { "type": "veld", "veld": "geboortedatum", "breedte": "50%" },
          { "type": "veld", "veld": "geslacht", "breedte": "50%" }
        ]}
      ]
    },
    {
      "type": "conditioneel",
      "als": "geslacht == 'V'",
      "dan": [
        { "type": "veld", "veld": "meisjesnaam" }
      ]
    }
  ]
}
```

Element types:
- **formulier**: root container
- **groep**: `<fieldset>` met label/legend
- **rij**: horizontale flex-rij met optionele breedte per child
- **veld**: enkel invoerveld, lookup naar schema-API velddefinitie
- **conditioneel**: `als` expressie → toon `dan` elementen als waar

### Conditionele expressies

De `evalueerConditie()` functie ondersteunt:
- `veld == 'waarde'` — gelijkheid
- `veld != 'waarde'` — ongelijkheid
- `veld` — truthy check
- `!veld` — falsy check

---

## Gegenereerde bestanden (codegen)

Invoer: `configuratie_model.json`

Commando:
```sh
go run ./cmd/codegen --input configuratie_model.json --output model/ \
  --prefix configuratie --mode additive --domein configuratie
```

Gegenereerde Go bestanden in `model/`:
| Bestand | Inhoud |
|---------|--------|
| `configuratie_modellen_entiteiten.go` | FormulierDefinitie struct + Aanvang/Einde |
| `configuratie_modellen_ge_rel.go` | FormulierDefinitieStatus enum, Meta + Layout Hub/Data structs |
| `configuratie_modellen_methods.go` | Interface implementaties (GetID, Metatype, etc.) |
| `configuratie_modellen_input.go` | Flat _Input structs voor registratie-API |
| `configuratie_metaregistry.go` | 7 TypeMeta entries |
| `configuratie_enum_registry.go` | FormulierDefinitieStatus enum registry |
| `configuratie_datatype_registry.go` | (leeg — geen domein-specifieke datatypes) |
| `configuratie_datatype_aliases.go` | (leeg) |

Auto-geüpdatet: `metaregistry_plumbing.go` (init-calls toegevoegd)

---

## Frontend componenten

### CustomFormulierRenderer.jsx

Pad: `web/vite/src/components/editor/CustomFormulierRenderer.jsx`

Props:
- `layout` — geparsed layout JSON object
- `velden` — array schema-API velddefinities
- `values` — `{ veldnaam: waarde }` map
- `onChange` — `(veldnaam, nieuweWaarde) => void`
- `errors` — `{ veldnaam: foutmelding }`
- `readOnly` — boolean

Rendert recursief via `renderElement()` dispatch op `element.type`.

### useFormulierDefinitie hook

Pad: `web/vite/src/hooks/useFormulierDefinitie.js`

```js
const { FormulierDefinitie, layout, loading, error } = useFormulierDefinitie("TypeNaam");
```

- Fetcht alle FormulierDefinities via `/formulier_definities`
- Haalt per item de full data op via `/full/formulier_definities/{id}`
- Vindt de actieve standaard-definitie voor het opgegeven doeltype
- Parseert `layout_json` en retourneert het als `layout`

### EntiteitFormulier integratie

In `EntiteitFormulier.jsx`:
- Roept `useFormulierDefinitie(typeMeta.typenaam)` aan
- Toont een toggle-knop "Custom formulier / Standaard weergave" als er een layout beschikbaar is
- In custom modus: flatten alle GE _Data velden en waarden, render via CustomFormulierRenderer
- **Editable** (F29): velden zijn bewerkbaar, met cross-GE save via één registratie
- Standaard weergave blijft de bestaande per-GE rendering

### F29 — Editable cross-GE save (2026-04-09)

Het custom formulier is nu volledig bewerkbaar. Architectuur:

### Voorbeeld replaybestand

Er is nu ook een concreet replaybestand voor een ENT-voorbeeldformulier:

- `replay files/registraties-replay-init-formulierdefinitie-initiatief-voorbeeld.json`

Dit replaybestand maakt een actieve standaard-`FormulierDefinitie` aan voor doeltype `Initiatief`, met een layout over meerdere GE's heen (`Product`, `Planning`, links en conditionele sectie).

1. **`veldNaarGE` mapping** (useMemo): elke veldnaam → `{ childMeta, dataMeta, actueel, bronVelden }` zodat bij opslaan bekend is welk veld bij welk GE hoort.

2. **`customEditValues` state**: override-map (alleen gewijzigde velden). Renderer krijgt `{ ...customValues, ...customEditValues }` als values — geen aparte useEffect nodig.

3. **`handleCustomOpslaan` (useCallback)**:
   - Groepeert gewijzigde velden per GE (op `childMeta.typenaam`)
   - Bouwt per GE een compleet opvoer-payload (FK, rel_id, alle data-velden)
   - Stuurt alles in **één** `POST /registratie/` request
   - Backend itereert over `wijzigingen[]` en verwerkt per GE

4. **UI**: Opslaan + Reset knoppen, feedback-melding, disabled-state tijdens save.

**Bugfixes** tijdens implementatie:
- Infinite re-render loop: `useEffect` op `customValues` → opgelost met override-patroon
- Hook-ordering ("Rendered more hooks"): `useMemo`/`useCallback` stonden ná early returns → verplaatst naar vóór early returns, `onderliggende` omgezet naar `useMemo`

---

## Vervolgstappen

| # | Item | Status |
|---|------|--------|
| F29 | Editable custom formulier: cross-GE save mechanisme | ✅ Afgerond (2026-04-09) |
| F30 | Visuele layout-editor (drag-and-drop) voor FormulierDefinitie | Open |
| | Optimalisatie: batch-fetch FormulierDefinities (ipv N+1 per entity) | Open |
| | Layout-validatie bij opslaan (zijn alle veldnamen geldig?) | Open |

---

## Test & Build status

- ✅ `go build ./...` — succesvol
- ✅ `go test ./...` — 6 packages OK
- ✅ `npm run build` (Vite) — succesvol, 486 modules transformed
