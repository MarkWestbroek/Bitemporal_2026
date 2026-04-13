# Overerving (Generalisatie) in het Bitemporeel Register — Analyse

## 1. Inleiding

Dit document beschouwt de haalbaarheid en implicaties van het toevoegen van **overerving** (generalisatie/specialisatie) als nieuw concept aan het bitemporeel register. Overerving is een relatie *tussen twee elementen van hetzelfde metatype* (ENT↔ENT of GE↔GE), waarbij het subtype de eigenschappen van het supertype erft.

In MIM-termen heet dit een **«Generalisatie»**, met optioneel het kenmerk **Mixin** (Ja/Nee).

---

## 2. Wat is overerving in deze context?

### 2.1 Definitie

Een overervingsrelatie verbindt twee representatietypes van hetzelfde metatype:

- **Entiteit → Entiteit**: bijv. `Taak` (supertype) met subtypes `Klanttaak`, `Interne Taak`, `Ketenpartnertaak`
- **GE → GE** (Gegevensgroeptype): bijv. `Natuurlijk persoonsidentificatie` (supertype, abstract) met subtypes `BSN`, `TIN`

Het subtype *erft* alle velden (attributen) en relaties van het supertype, en kan eigen aanvullende velden en relaties definiëren.

### 2.2 Abstract vs. concreet

Een supertype kan:

| Eigenschap | Concreet supertype | Abstract supertype |
|---|---|---|
| Eigen instanties? | Ja | Nee |
| Eigen tabel? | Ja | Afhankelijk van patroon |
| Voorbeelden | `Taak` (als er ook generieke taken bestaan) | `Natuurlijk persoonsidentificatie` (alleen via BSN/TIN) |

In de MIM XMI wordt `isAbstract="true"` op de UML:Class gezet. In het MIM voorbeeld is `Natuurlijk persoonsidentificatie` abstract (Gegevensgroeptype), terwijl `Werkstap` en `Taak` concreet zijn.

### 2.3 Mixin

MIM kent het concept **Mixin**: als `Mixin=Ja`, dan worden de eigenschappen van de superklasse overgenomen door de subklasse, maar de superklasse zelf komt niet in de implementatie voor. Dit is vergelijkbaar met een *abstract* supertype dat puur als template dient.

---

## 3. Database-patronen voor overerving

Er zijn drie klassieke patronen voor het mappen van een overervingshiërarchie naar relationele tabellen:

### 3.1 Table-per-Hierarchy (TPH) — Eén tabel voor alles

Alle types (super + sub) in één tabel, met een discriminator-kolom.

```
taak
├── id, opvoer, afvoer, aanvang, einde
├── type (discriminator: 'klanttaak' | 'interne_taak' | 'ketenpartnertaak')
├── [gedeelde velden van Taak]
├── [velden specifiek voor Klanttaak — nullable]
├── [velden specifiek voor Interne Taak — nullable]
└── [velden specifiek voor Ketenpartnertaak — nullable]
```

**Voordelen**: Eenvoudige queries, geen joins.  
**Nadelen**: Veel nullable kolommen. **Onpraktisch voor bitemporaliteit** als subtypes eigen gegevenselementen hebben — die leven in eigen tabellen met eigen FK's en `rel_id`. Een supertype-tabel met nullable kolommen past niet in het GE-model.

**Conclusie**: **Niet geschikt** voor dit register, tenzij de hiërarchie triviaal is (alleen gedeelde velden, geen eigen GE's).

### 3.2 Table-per-Type (TPT) — Elke laag een tabel

Elke klasse in de hiërarchie krijgt een eigen tabel. De subtypetabel heeft een PFK naar de supertypetabel.

```
taak           (id, opvoer, afvoer, [gedeelde velden])
klanttaak      (taak_id PFK→taak, opvoer, afvoer, [klanttaak-specifieke velden])
interne_taak   (taak_id PFK→taak, opvoer, afvoer, [interne_taak-specifieke velden])
```

**Voordelen**: Schone normalisatie, geen nullable kolommen.  
**Nadelen**: Joins nodig om het volledige subtype op te halen.

**Bitemporale implicaties**: 
- Beide tabellen (super en sub) zijn representaties met eigen opvoer/afvoer.
- Wijzigingen op het supertype-deel worden apart geregistreerd van het subtypedeel.
- Subtypes kunnen eigen GE's en relaties hebben; die FK'en naar de subtypetabel.
- Tijdreizen: je moet zowel het supertype- als subtyperecord ophalen op tijdstip t~f~.

**Conclusie**: **Goed passend** in de huidige architectuur. Past natuurlijk in het MetaRegistry-model: elk type is een eigen entry, het subtypetype heeft een extra `SupertypeRef` of vergelijkbaar veld.

### 3.3 Table-per-Concrete-Class (TPC) — Subtypes dupliceren gedeelde velden

Alleen concrete klassen krijgen tabellen. Gedeelde velden worden gedupliceerd.

```
klanttaak      (id, opvoer, afvoer, [gedeelde velden VAN Taak], [klanttaak-specifieke velden])
interne_taak   (id, opvoer, afvoer, [gedeelde velden VAN Taak], [interne_taak-specifieke velden])
```

**Voordelen**: Geen joins, elk subtype is zelfstandig.  
**Nadelen**: Veldduplicatie, geen centrale supertypetabel, lastig om generiek over alle subtypes te queryen.

**Bitemporale implicaties**: 
- Als de velden van `Taak` opduiken in elke subtypetabel, moeten wijzigingen op die gedeelde velden in meerdere tabellen worden bijgehouden.
- GE's van Taak zouden bij elk subtype apart bestaan (duplicatie).

**Conclusie**: **Niet aanbevolen** vanwege veldduplicatie en complexiteit bij wijzigingen.

### 3.4 Aanbevolen patroon

**Table-per-Type (TPT)** is het meest geschikt:

1. Past in de bestaande architectuur: elk representatietype = eigen tabel + own MetaRegistry entry
2. Geen veldduplicatie
3. Bitemporale integriteit: elke laag in de hiërarchie heeft eigen formele-tijd tracking
4. GE's en relaties per type: subtypes kunnen eigen GE's hebben die FK'en naar de subtypetabel

---

## 4. Impact op de huidige architectuur

### 4.1 MetaRegistry uitbreiding

De `TypeMeta` struct zou een nieuw veld krijgen:

```go
type TypeMeta struct {
    // ... bestaande velden ...
    SupertypeRef   string   // Typenaam van het supertype (leeg als top-level)
    IsAbstract     bool     // Mag dit type eigen instanties hebben?
}
```

Dit maakt het mogelijk om:
- De overervingshiërarchie te traverseren
- Bij het ophalen van een subtype automatisch ook het supertyperecord op te halen
- Bij generieke queries (`/taak`) ook subtyperecords te vinden

### 4.2 Database: PFK-structuur

Het subtyperecord krijgt een PFK naar het supertyperecord:

```sql
CREATE TABLE klanttaak (
    taak_id  INT NOT NULL REFERENCES taak(id),  -- PFK
    opvoer   TIMESTAMPTZ NOT NULL,
    afvoer   TIMESTAMPTZ,
    -- eigen velden van Klanttaak
    prioriteit TEXT,
    PRIMARY KEY (taak_id)
);
```

De `rel_id` en relatieve autoincrement gelden per concreet type.

### 4.3 Materialiteit

Interessante vraag: **erft een subtype de materialiteit van het supertype?**

- Als `Taak` materieel is (met `Taak_Aanvang`, `Taak_Einde`), dan geldt die materialiteit automatisch ook voor `Klanttaak` — want die deelt dezelfde entiteit-identiteit.
- Het subtype zou **geen eigen aanvang/einde** hoeven te definiëren; het gebruikt die van het supertype.
- Als het subtype *extra* materiële aspecten wil bijhouden (bijv. een specifiek GE met eigen aanvang), dan kan dat via een eigen materieel GE.

**Gemengde materialiteit is toegestaan**: een formeel supertype kan zowel materiële als formele subtypes hebben. Bijvoorbeeld:
- Superklasse `Letter` (formeel)
- Subtype `A` (materieel — heeft eigen aanvang/einde)
- Subtype `B` (formeel — geen eigen aanvang/einde)

De materialiteit wordt dus **niet** automatisch geërfd of afgedwongen via het supertype. Elk concreet subtype bepaalt zelf of het materieel is. Alleen wanneer het supertype zelf materieel is, delen alle subtypes die materialiteit (want ze delen dezelfde entiteit-identiteit en dus dezelfde aanvang/einde).

**Aanbeveling**: materialiteit is een eigenschap per concreet type. De materiële plumbing-types (`_Aanvang`, `_Einde`) bestaan op het niveau waar ze gedefinieerd zijn — dat kan het supertype of een specifiek subtype zijn.

### 4.4 Gegevenselementen en relaties

- **Gedeelde GE's** (gedefinieerd bij het supertype) gelden automatisch voor alle subtypes.
- **Subtype-specifieke GE's** FK'en naar de subtypetabel, niet naar de supertypetabel.
- **Relaties** kunnen verwijzen naar het supertype of naar een specifiek subtype:
  - Een relatie `veroorzaakt` (Werkstap → Gevolg) geldt voor alle subtypes van Werkstap.
  - Een relatie `wordt_toegewezen_aan` (Klanttaak → Partij) geldt alleen voor Klanttaak.

### 4.5 Handlers en routes

- De generieke handler `MakeGetFullEntityByMetaHandler` zou bij een subtype automatisch het supertyperecord moeten includen.
- Routes worden al dynamisch gegenereerd; er hoeven geen handmatige routes bij.
- Er komt een `SupertypeRef` check: bij het ophalen van een subtype wordt het supertyperecord mee-opgehaald (join).

### 4.6 Schema-API

De schema-API zou de overervingsrelatie moeten uitdrukken:

```json
{
  "typenaam": "Klanttaak",
  "metatype": "entiteit",
  "supertype": "Taak",
  "isAbstract": false,
  "velden": [
    { "naam": "prioriteit", "type": "string" }
  ],
  "geerfde_velden": [
    { "naam": "status", "type": "string", "bron": "Taak" }
  ]
}
```

De frontend kan hiermee:
- In formulieren zowel eigen als geërfde velden tonen
- In het diagram de overerving als pijl (▷) weergeven
- Abstracte types visueel markeren (cursief, stippellijn)

---

## 5. Impact op de UML editor

De editor ondersteunt nu al de import van `UML:Generalization` elementen. Visuele uitbreidingen:

| Aspect | Huidige situatie | Nodig |
|---|---|---|
| Edge type | Alleen `metamodel` | Nieuw: `isGeneralization` flag op metamodel edge |
| Weergave | Gewone lijn | Lijn met open driehoek (▷) op supertype-zijde |
| Abstract markering | Niet beschikbaar | **Cursieve typenaam** (UML-conventie voor abstracte klassen) |
| Mixin indicatie | Niet beschikbaar | Optioneel label of badge op de generalisatie-edge |

---

## 6. Samenvatting en conclusie

### Haalbaarheid: **Ja, goed haalbaar**

Overerving past logisch in de architectuur van het bitemporeel register:

1. **MetaRegistry**: voeg `SupertypeRef` en `IsAbstract` toe aan `TypeMeta`
2. **Database**: gebruik Table-per-Type (TPT) — elke laag is een eigen tabel met PFK naar de parent
3. **Materialiteit**: is een eigenschap per concreet type; gemengde materialiteit (formeel supertype met deels materiële subtypes) is toegestaan
4. **GE's/relaties**: supertype-GE's gelden voor alle subtypes; subtypes kunnen eigen GE's toevoegen
5. **Handlers**: uitbreiden met join naar supertyperecord bij ophalen subtype
6. **Schema-API**: voeg `supertype`, `isAbstract` en `geerfde_velden` toe
7. **Editor**: generalisatie-edges importeren (✅ gedaan), visuele weergave nog uit te werken

### Aandachtspunten

- **Meervoudige overerving**: voorlopig beperkt tot *enkele overerving* (één supertype). MIM Mixin kan een workaround bieden.
- **Registratie van wijzigingen**: bij een subtype moeten wijzigingen op zowel het supertype- als het subtypedeel in één registratie kunnen.
- **Tijdreizen**: formeel tijdreizen over een subtype vereist het combineren van het supertype- en subtyperecord op hetzelfde formeel tijdstip.
- **Abstracte types**: mogen niet direct worden geregistreerd; alleen concrete subtypes.

### Volgende stappen

1. `TypeMeta` uitbreiden met `SupertypeRef` en `IsAbstract`
2. Database createtables aanpassen voor PFK-structuur
3. Generieke handler uitbreiden voor supertype-join
4. Schema-API uitbreiden met overervingsvelden
5. Editor: generalisatie-edge visueel weergeven (driehoek-pijl)
6. Frontend: geërfde velden tonen in formulieren

---

## 7. Implementatiestatus

De onderstaande secties beschrijven de concrete implementatie per laag, als verdieping op de stappen uit §6.

### 7.1 O1 — TypeMeta uitbreiding

`TypeMeta` (in `metaregistry_plumbing.go`) bevat:

- `IsAbstract bool` — of het type abstract is (mag geen eigen instanties hebben)
- `ParentTypenaam string` — typenaam van het supertype (leeg als top-level)

Codegen (`gen_registry.go`) schrijft deze velden naar de gegenereerde MetaRegistry op basis van `isAbstract` en `erft` uit het V3 model.

### 7.2 O2 — Database + Codegen (TPT PFK-structuur)

**Codegen** (`gen_structs.go`):
- Genereert een PFK-veld op het subtype: `{Parent}_ID int` met `bun:"{parent}_id,pk"`
- Genereert een belongs-to relatie: `Parent{Type} *{Type}` met `bun:"rel:belongs-to,join:{parent}_id=id"`
- JSON tag op de belongs-to relatie: `json:"parent_{lower},omitempty"` — zodat parent-data wordt meegegeven in full-entity JSON responses
- `entiteitRelatieFieldPK` gebruikt de juiste PK-kolom (`{parent}_id` in plaats van `id`) voor has-many joins op subtypes
- `createmodeltables` genereert tabellen in **topologische volgorde** (parent vóór child) via `ensureSubtypeFK` voor FK-constraints

### 7.3 O3 — Generieke handlers (supertype-join)

- `addOnderliggendeRelations` (in `full_handlers.go`): laadt parent via `.Relation("Parent{Type}")` met nested relaties, zodat parent-children (GE's/relaties) ook worden opgehaald
- `laadHubKinderenNaQuery`: recursief laden van hub-kinderen voor de parent-entiteit die via belongs-to is ingeladen
- `ensureParentRecordBijOpvoer` (in `registreer_handler.go`): bij registratie van een subtype wordt automatisch gecontroleerd of het parent-record al bestaat. Werkt via een `COUNT(*)` query op de parent-tabel; als count = 0, wordt een kaal parent-record aangemaakt in dezelfde transactie

### 7.4 O4 — Schema-API

`vizSchemaTypeDTO` (in `viz_schema_handler.go`) bevat:
- `IsAbstract bool` — of het type abstract is
- `ParentTypenaam string` — directe parent
- `GeerfdeVelden []vizSchemaFieldDTO` — **recursief** verzamelde velden van alle voorouders

`geerfdeVeldenVoorType()` traverseert de overervingsketen van parent naar grootouder etc. en verzamelt alle velden.

### 7.5 O5 — UML Editor: generalisatie-edge

Rendering met open driehoek (▷), sidebar-dropdown voor edge-type, toolbar edge-mode voor compositie + generalisatie.

### 7.6 O6 — Frontend: geërfde velden in formulieren

#### Ontwerpbeslissingen

1. **Geërfde velden staan BOVEN eigen velden** — ze zijn generiek/belangrijk en horen visueel bovenaan
2. **Velden zijn NIET read-only** — functioneel is het niet twee records; dat is slechts de technische implementatie (TPT)
3. **Visueel onderscheid is subtiel** — de parent-klassenaam wordt als klein kopje met een dunne streep getoond; verder is het functioneel één formulier

#### Twee-wijziging patroon

Bij opslaan van een subtype met gewijzigde geërfde velden stuurt de frontend **twee wijzigingen** in één registratie:

1. **Parent wijziging** (eerst): `{ opvoer: { "{parentVeldnaam}": { id: {sharedPK}, ...geerfdeVelden } } }`
2. **Child wijziging** (daarna): `{ opvoer: { "{childVeldnaam}": { ...eigenVelden } } }`

De backend verwerkt wijzigingen in volgorde. Doordat de parent wijziging eerst komt, vindt `ensureParentRecordBijOpvoer` bij de child wijziging een bestaand parent-record (COUNT > 0) en slaat aanmaak over. Bij een nieuw record (eerste registratie) zorgt de parent wijziging ervoor dat het parent-record al aanwezig is voordat de child wordt verwerkt.

#### Codegen: parent JSON tag fix

De belongs-to relatie op subtypes had oorspronkelijk `json:"-"`, wat de parent-data onzichtbaar maakte in JSON responses. Gewijzigd naar:

```go
Tags: fmt.Sprintf("`json:\"%s,omitempty\" bun:\"rel:belongs-to,join:%s=id\"`", parentJSONKey, parentIDKolom)
```

Waarbij `parentJSONKey = "parent_" + strings.ToLower(ent.Erft)` (bijv. `"parent_taak"`).

#### RepresentatieFormulier.jsx

Gewijzigd om geërfde velden te ondersteunen:

| Aspect | Implementatie |
|---|---|
| **Geërfde velden ophalen** | `parentTypeMeta` + `geerfdeVeldenBewerkbaar` uit `typeMeta.geerfdeVelden`, plumbing-velden (opvoer/afvoer/id/versie/rel_id/autoIncrement) gefilterd |
| **Formulierstaat** | Aparte `parentValues` state + `updateParentVeld` callback, geïnitialiseerd uit `entity[parentJSONKey]` |
| **Dirty tracking** | `isParentDirty` (vergelijkt `parentValues` met `parentInitialData`), `isDirty` combineert eigen + parent, `aantalGewijzigdeVelden` telt beide |
| **Payload** | `buildParentOpvoerPayload()` bouwt payload met shared PK (`parentTypeMeta.idKolom = childId`) + gecoerceerde veldwaarden |
| **Submission** | `handleActie()` bouwt wijzigingen-array: parent wijziging EERST (`parentTypeMeta.veldnaam`), dan child wijziging |
| **Rendering** | Geërfde velden als grid BOVEN `{/* Bewerkbare velden */}`, met parent-klassenaam als header met subtiele border-bottom |

#### EntiteitFormulier.jsx

Gewijzigd voor cross-GE save van parent-velden in de custom formulier modus en standaard-weergave:

| Aspect | Implementatie |
|---|---|
| **Parent metadata** | `parentTypeMeta` en `parentJSONKey` afgeleid uit `typeMeta.parentTypenaam` |
| **Custom formulier (cross-GE save)** | `customVelden`/`customValues`/`veldNaarGE` useMemo uitgebreid: geërfde velden worden EERST toegevoegd met `isParentVeld: true` marker, parent-data gehaald uit `entity[parentJSONKey]` |
| **handleCustomOpslaan** | Groepen sorteren: parent wijzigingen eerst (via `isParentVeld`). Parent payload met shared PK (`hubMeta.idKolom = entity.id`), geen entiteitIDKolom. bronVelden gebruikt `info.bronVelden` (de geërfde veldenlijst) i.p.v. `dataMeta.velden` |
| **Standaard-weergave** | Aparte parent-entity card vóór GE-secties, met `RepresentatieFormulier` gevuld met `entity[parentJSONKey]` als initialData. Toont "(overgeërfd)" label. Verborgen wanneer custom weergave actief is |

### 7.7 O7–O10 — V3 roundtrip, codegen, exporters, bugfix

- **O7**: V3 JSON roundtrip (`isAbstract`, `erft` op `V3Entiteit`, generalisatie-edges)
- **O8**: Codegen schrijft `IsAbstract` + `ParentTypenaam` naar gegenereerde MetaRegistry
- **O9**: Exporters: XMI (`isAbstract` + `UML:Generalization`), Mermaid (`--|>`), PlantUML (`<|--`)
- **O10**: Bugfix: `shallowEqualOvererving` in `useOvergeerfdeVelden` voor correcte weergave van afgeleide velden in subklassen

### 7.8 O11 — Schemadiff

- `isAbstract`-wijziging → ernst `Modificatie` (beide richtingen)
- `erft` toevoegen → `Modificatie`; verwijderen/wijzigen → `Destructief`
- DDL-migratie via `genereerOverervingMigratie()`: DROP/ADD CONSTRAINT voor PFK (`fk_{tabelnaam}_{parenttabel}`)
- 7 unit tests: `TestIsAbstractGewijzigd`, `TestIsAbstractVerwijderd`, `TestErftToeGevoegd`, `TestErftVerwijderd`, `TestErftGewijzigd`, `TestIsAbstractOngewijzigdGeenDelta`, `TestErftOngewijzigdGeenDelta`
