# Materiële tijd

Dit document beschrijft hoe materiële tijd is ontworpen en geïmplementeerd in de bitemporale API (v05).

## 1. Achtergrond: twee tijdslijnen

In bitemporele registratie bestaan twee tijdslijnen:

1. **Formele tijd** (registratietijd) — _wanneer_ is iets geregistreerd in het register?
   Uitgewerkt via `registratie.tijdstip`, `wijziging`, `opvoer` en `afvoer`.
   Zie ook [tijdreizen.md](../tijdreizen.md) voor de formele tijdreisqueries.

2. **Materiële tijd** (geldigheidstijd) — _wanneer_ is iets geldig in de werkelijkheid?
   Uitgewerkt via **aanvang** en **einde** datums per representatie.

Een representatie (entiteit, gegevenselement of relatie) kan materieel zijn (`IsMaterieel: true`)
of uitsluitend formeel. Materiële representaties kennen naast opvoer/afvoer ook een optionele
aanvangsdatum en einddatum.

## 2. Ontwerp: aanvang en einde als plumbing-gegevenselementen

### 2.1 Kernprincipe

> "Een aanvang/einde van een entiteit gedraagt zich qua opvoer/afvoer gewoon als een gegevenselement."

Dit betekent dat aanvang en einde:

- Eigen database-tabellen hebben (bijv. `a_aanvang`, `a_einde`, `b_aanvang`, `b_einde`)
- Eigen versiehistorie bijhouden (met `opvoer`, `afvoer`, en `versie` als relatief autoincrement)
- Enkelvoudig zijn op enig moment (er is maximaal één actieve aanvang en één actief einde)
- Afgehandeld worden door dezelfde generieke handler als reguliere gegevenselementen (`handleRepresentatieOpvoer`)
- Automatisch de voorganger afvoeren bij een nieuwe opvoer (enkelvoudige logica)

### 2.2 Verschil met reguliere gegevenselementen

Aanvang/einde wijken op een paar punten af:

| Aspect | Regulier GE (bijv. A_U) | Aanvang/Einde (bijv. A_Aanvang) |
|---|---|---|
| FK-kolom | `a_id` → `a.id` | `id` → `a.id` (zelfde kolomnaam als PK van de entiteit) |
| PK | `(a_id, rel_id)` | `(id, versie)` |
| MetaRegistry opname | In `OnderliggendeGegevenselementen` van de entiteit + als eigen entry | Eigen entry + `BovenliggendTypenaam` als terugverwijzing |
| Weergave in UI | Als reguliere GE-kaart in de SVG-grafiek | Als "oortje" (badge) boven de entiteitskaart |

### 2.3 BovenliggendTypenaam

Plumbing GE-types zoals `A_Aanvang` staan niet altijd als eerste in de klassieke
`OnderliggendeGegevenselementen`-lookup. Daarom heeft `TypeMeta` het veld `BovenliggendTypenaam`.
Dit wordt als fallback gebruikt in:

- `vindEntiteitContext()` — om de bovenliggende entiteitnaam te bepalen bij registratie
- `sluitActieveEnkelvoudigeVoorgangersAf()` — om de juiste parent-context te vinden bij afvoer van voorgangers

## 3. Database-structuur

Per materiële entiteit bestaan twee plumbing-tabellen. Voorbeeld voor entiteit A:

```sql
CREATE TABLE a_aanvang (
    id      INTEGER NOT NULL REFERENCES a(id),
    versie  SERIAL,
    datum   DATE,
    opvoer  TIMESTAMPTZ,
    afvoer  TIMESTAMPTZ,
    PRIMARY KEY (id, versie)
);

CREATE TABLE a_einde (
    id      INTEGER NOT NULL REFERENCES a(id),
    versie  SERIAL,
    datum   DATE,
    opvoer  TIMESTAMPTZ,
    afvoer  TIMESTAMPTZ,
    PRIMARY KEY (id, versie)
);
```

- `id` is een FK naar de entiteit (bijv. `a.id`)
- `versie` is een relatief autoincrement binnen de entiteit (per `id`)
- `datum` is een `DATE` (geen timestamp): het materiële tijdstip
- `opvoer`/`afvoer` zijn formele timestamps (wanneer geregistreerd/afgevoerd)

Dezelfde structuur geldt voor `b_aanvang`, `b_einde`, en potentieel voor elk materieel type.

## 4. Go-implementatie

### 4.1 Structs (`model/model_plumbing.go`)

Per entiteitstype zijn er concrete structs:

```go
type A_Aanvang struct {
    bun.BaseModel `bun:"table:a_aanvang,alias:a_aanvang"`
    A_ID          int        `json:"a_id" bun:"id,pk"`
    Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
    Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
    Opvoer        *time.Time `json:"opvoer,omitempty"`
    Afvoer        *time.Time `json:"afvoer,omitempty"`
}
```

Elk implementeert `FormeleRepresentatie` (GetID, Metatype, ClearID, Get/SetOpvoer, Get/SetAfvoer).
`GetID()` retourneert `Versie` (niet `A_ID`), want de versie is de identifier van de individuele representatie.

#### Bun alias-tag (`alias:a_aanvang`)

Zonder expliciete alias leidt bun de SQL-alias af uit de Go struct-naam: `A_Aanvang` → `a__aanvang`
(dubbele underscore). De `formeleTijdTargetVoorModel`-subquery verwijst naar `a_aanvang.id::text`
(enkelvoudige underscore), waardoor PostgreSQL een "invalid reference to FROM-clause entry" fout geeft.
De `alias:`-tag forceert de juiste aliasnaam.

#### `bun:"-"` op Aanvang/Einde velden in basis-structs (`model/models.go`)

De structs `A_basis`, `B_basis`, `Rel_A_B` en `A_W` bevatten `Aanvang *Aanvang` en `Einde *Einde`
velden. Dit zijn applicatie-velden die door generieke routines ingevuld worden, niet door bun.
Zonder `bun:"-"` probeert bun ze als database-kolommen te SELECTen, wat "column does not exist"
fouten oplevert.

### 4.2 MetaRegistry (`model/metaregistry.go`)

Elk aanvang/einde-type heeft een eigen entry in de MetaRegistry:

```go
"A_Aanvang": {
    Typenaam:               "A_Aanvang",
    Metatype:               MetatypeGegevenselement,
    IDKolom:                "versie",
    EntiteitIDKolom:        "id",
    HeeftPFK:               true,
    RelatieveAutoincrement: true,
    Momentvoorkomen:        Enkelvoudig,
    BovenliggendTypenaam:   "A",
    // ...
},
```

Daarnaast worden ze opgenomen in de `OnderliggendeGegevenselementen` van de bovenliggende entiteit
zodat de GET-handlers ze automatisch inladen via bun `.Relation()`:

```go
{Rolnaam: "Aanvangs", JSONRolnaam: "a_aanvangs", Doeltype: "A_Aanvang", Momentvoorkomen: Enkelvoudig},
{Rolnaam: "Eindes",   JSONRolnaam: "a_eindes",   Doeltype: "A_Einde",   Momentvoorkomen: Enkelvoudig},
```

### 4.3 Full entity structs (`model/full_models.go`)

De `Full_A` en `Full_B` structs bevatten bun-relaties naar aanvang/einde:

```go
Aanvangs []A_Aanvang `bun:"rel:has-many,join:id=id" json:"a_aanvangs,omitempty"`
Eindes   []A_Einde   `bun:"rel:has-many,join:id=id" json:"a_eindes,omitempty"`
```

Let op de join `join:id=id`: het `id`-veld van de Full_A struct (= `a.id`) wordt gematcht
op het `id`-veld van de plumbing-tabel (= `a_aanvang.id`), wat de FK is.

### 4.4 Handler-aanpassingen (`handlers/registration_helpers_generiek.go`)

Twee functies zijn aangepast om plumbing GE-types correct af te handelen:

- **`vindEntiteitContext()`** — heeft een fallback op `meta.BovenliggendTypenaam`
  wanneer het type niet via `GetBovenliggendeRelatieMeta()` gevonden kan worden.

- **`sluitActieveEnkelvoudigeVoorgangersAf()`** — gebruikt zowel `IDKolom` als
  `EntiteitIDKolom` in de WHERE-clause bij PFK-types, zodat versie-id's die
  alleen binnen één entiteit uniek zijn niet per ongeluk records van andere entiteiten raken.

### 4.5 Schema API (`handlers/viz_schema_handler.go`)

De `/api/viz/schema` response bevat nu:

- `isMaterieel` — of het type een materiële tijdlijn heeft
- `bovenliggendTypenaam` — voor plumbing types, de naam van de bovenliggende entiteit

De frontend gebruikt `bovenliggendTypenaam` om aanvang/einde types te herkennen en
ze apart te behandelen (als oortjes in plaats van als reguliere GE-kaarten).

#### `jsonNaamVoorBunKolom()` — vertaling DB-kolomnaam → JSON-veldnaam

De MetaRegistry slaat kolomnamen op als database-namen (bijv. `EntiteitIDKolom: "id"`).
De frontend werkt echter met JSON-keys (bijv. `"a_id"`). De helperfunctie `jsonNaamVoorBunKolom()`
vertaalt via reflectie op de struct: het doorloopt alle velden, matcht de bun-tag op de kolomnaam,
en retourneert de bijbehorende json-tag.

Dit is nodig voor plumbing types waar de naamconventie afwijkt:
- Reguliere GE's: DB `a_id` = JSON `a_id` (zelfde naam)
- Plumbing types: DB `id` = JSON `a_id` (verschillende namen)

Zonder vertaling kan de frontend:
- Het entiteits-ID veld niet correct herkennen (getoond als bewerkbaar veld)
- De payload niet correct opbouwen (zoekt `item["id"]` i.p.v. `item["a_id"]`)
- De bewerkbox-titel niet correct weergeven (`rel_id=?` in plaats van `versie=1`)

## 5. Frontend-visualisatie (React/SVG)

### 5.1 Filtering (`IndexSchemaPage.jsx`)

Aanvang/einde groepen worden uitgefilterd uit `childGroupsGesorteerd` zodat ze niet
als reguliere gegevenselement-kaarten in de grafiek verschijnen:

```js
// Filter aanvang/einde plumbing types uit de reguliere weergave
return [...childGroups]
  .filter((group) => !typeMetaByTypenaam[group.doeltype]?.bovenliggendTypenaam)
  .sort(...)
```

In plaats daarvan wordt `entiteitOortjes` berekend: de actieve (geen afvoer) aanvang-
en einde-datum uit de plumbing groepen.

### 5.2 Oortjes-weergave (`IndexRepresentatieVisual.jsx`)

De aanvang en einde worden als tab-vormige badges ("oortjes") boven de entiteitskaart
getoond in de SVG, met een kaartlip-effect:

- **SVG-pad**: `oortjePad(x, y, w, h, r)` tekent een pad met afgeronde bovenkant en open onderkant.
  Door het pad _vóór_ de entity rect te tekenen bedekt die de onderrand (kaartlip-effect).
- **Aanvang**: links boven de entiteitskaart, x=337
- **Einde**: rechts boven de entiteitskaart, x=490
- **Klikbaar**: elke oortje is een `<g onClick={() => selecteerRep(item, group)}>`, net als GE-kaarten.
  Klikken opent het bewerkformulier voor opvoeren/afvoeren/corrigeren.
- **Selectie-indicator**: blauw gestreept kader als het oortje geselecteerd is.
- Opgemaakt in handschrift-achtig lettertype (Caveat) voor visueel onderscheid.
- Datumweergave verkort: dag/maand/2-cijferig jaar (bijv. "1/1/20").

### 5.3 Oortjes-datamodel (`IndexSchemaPage.jsx`)

De `entiteitOortjes` useMemo retourneert objecten met `{item, group, datum}` in plaats van
alleen de datumstring. Dit is nodig om de oortjes klikbaar te maken:

- `item` — de volledige representatie (A_Aanvang of A_Einde record, zonder afvoer)
- `group` — de groep met typeMeta, kleur, doeltype etc.
- `datum` — de materiële datum voor weergave

### 5.4 Bewerkbox-titel

De titel van het bewerkformulier ("action overlay") toont het dynamische `idKolom` uit de
typeMeta. Voor reguliere GE's is dat `rel_id`, voor plumbing types is dat `versie`.
De waarde wordt opgezocht via de JSON-veldnaam die door `jsonNaamVoorBunKolom()` vertaald is.

## 6. API voorbeeld

### GET /full/as/1 (response fragment)

```json
{
  "id": 1,
  "opvoer": "2026-03-15T10:00:00Z",
  "us": [...],
  "vs": [...],
  "ws": [...],
  "rel_abs": [...],
  "a_aanvangs": [
    {
      "a_id": 1,
      "versie": 1,
      "datum": "2020-01-01",
      "opvoer": "2026-03-15T10:00:00Z"
    }
  ],
  "a_eindes": [
    {
      "a_id": 1,
      "versie": 1,
      "datum": "2025-12-31",
      "opvoer": "2026-03-16T09:00:00Z"
    }
  ]
}
```

### POST /registreer/a_aanvangs (opvoer aanvangsdatum)

```json
{
  "registratie": { "registratietype": "registratie" },
  "wijzigingen": [
    { "opvoer": { "a_aanvang": { "id": 1, "datum": "2020-01-01" } } }
  ]
}
```

Dit maakt gebruik van het reguliere registratie-endpoint; de aanvang wordt opgevoerd
als een gewoon enkelvoudig gegevenselement.

## 7. Bekende problemen en oplossingen

### 7.1 `column a_w.aanvang does not exist` (bun SELECT)

**Probleem**: De `Aanvang *Aanvang` en `Einde *Einde` velden op `A_basis`, `B_basis`, `Rel_A_B`
en `A_W` werden door bun als database-kolommen geïnterpreteerd.

**Oplossing**: `bun:"-"` tag toegevoegd aan alle vier structs in `model/models.go`.

### 7.2 `invalid reference to FROM-clause entry for table "a_aanvang"` (bun alias)

**Probleem**: Bun leidt SQL-aliassen af uit Go struct-namen: `A_Aanvang` → `a__aanvang` (dubbele underscore).
De `formeleTijdTargetVoorModel`-subquery verwijst naar `a_aanvang.id::text` (enkelvoudige underscore).

**Oplossing**: Expliciete `alias:a_aanvang` (etc.) in de bun table tag van alle plumbing structs in `model/model_plumbing.go`.

### 7.3 Bewerkbox toont `rel_id=?` voor plumbing types

**Probleem**: De MetaRegistry slaat `EntiteitIDKolom: "id"` (DB-naam) op, maar de frontend zoekt
`item["id"]` in JSON waar het veld `"a_id"` heet. Hierdoor:
- Titel toont `rel_id=?` (hardcoded fallback)
- `a_id` wordt als bewerkbaar veld getoond (niet herkend als entiteits-ID)
- POST-payload bevat geen `a_id`, wat een "lege ID" fout oplevert

**Oplossing**: `jsonNaamVoorBunKolom()` in `viz_schema_handler.go` vertaalt DB-kolomnamen naar
JSON-veldnamen via reflectie. De bewerkbox-titel gebruikt nu dynamisch `typeMeta.idKolom`.

## 8. Toekomstige uitbreidingen

- **Materiële tijdreizen**: queryparameter `geldig_op=2023-06-15` om de toestand op een
  materieel peiltijdstip te bevragen (combinatie met formeel peiltijdstip → volledige bitemporaliteit).
- **Aanvang/einde voor gegevenselementen en relaties**: tabellen bestaan al (bijv. `a_w_aanvang`),
  maar de handler-, struct- en UI-ondersteuning is nog niet uitgewerkt.
- **Materiële validatie**: controle dat einde >= aanvang, en dat periodes niet overlappen
  bij een nieuw opgevoerde aanvang/einde.
