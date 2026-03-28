# Referentielijsten — Ontwerp & Ontwerpkeuzen

> **Status**: ontwerp, fase 1 (editor + V3-model) in uitvoering.  
> **Datum**: 2026-03-27

---

## 1. Doel

Referentielijsten zijn benoemde verzamelingen van items (bijv. "Landen", "EU-Lidstaten") die als keuzelijst dienen in het register. Ze worden gemodelleerd als subtypes van de bestaande metatypes (entiteit, relatie) en maken volledig gebruik van de bestaande bitemporele registratielogica.

---

## 2. Drie nieuwe subtypes

| Subtype | Is subtype van | Gedraagt zich als | Voorbeeld |
|---|---|---|---|
| **referentielijst** | entiteit | Entiteit met ID + onderliggende systeem-GE's (naam, opmerking) | geen: elk record is een referentielijst. Voorbeeld van lijsten: landenlijst, EU-lidstaten-lijst |
| **referentielijst_item** | entiteit | Gewone entiteit (ID + vrije GE's/relaties) | "Land" |
| **referentielijst_items** | relatie | Koppeltabel (FK naar lijst-record + FK naar item) | "Landen_Land" |

### Overzichtsdiagram

```mermaid
classDiagram
  direction TB

  class register_referentielijst {
    «systeemtabel»
    +int id PK
    +string typenaam UNIQUE
    +string naam
    +string beschrijving
    +bool is_materieel
  }
  note for register_referentielijst "Eén record per referentielijst.
  Gesynchroniseerd bij API-opstart vanuit MetaRegistry."

  class Referentielijst {
    «Entiteit»
    +int id PK
    %%  +time opvoer
    %%  +time afvoer
  }
  note for Referentielijst "Elke instantie van deze klasse is een referentielijst, bijv. Landenlijst.
  Materieel optioneel maar geldt dan wel voor alle referentielijsten in het model.
  Elke instantie staat ook in het model en in de metaregistry."

  class ReferentielijstNaam {
    «Gegevenselement»
    +int rel_id PFK
    +string naam
  }
  ReferentielijstNaam --* Referentielijst

  class ReferentielijstOpmerking {
    «Gegevenselement»
    +int rel_id PFK
    +string opmerking
  }
  ReferentielijstOpmerking --* Referentielijst


  class ReferentielijstItem {
    «Entiteit»
    +int id PK
    %%  +time opvoer
    %%  +time afvoer
  }
  note for ReferentielijstItem "Voorbeeld: Land.
  Behalve beperking in koppelbaarheid aan alleen ReferentielijstItems
  is dit verder een gewone entiteit met vrij modelleerbare GE'n."
  
  class ReferentielijstItems {
    «Relatie»
    +int lijst_id PFK
    +int item_id FK
    +int rel_id PFK
    %%  +time opvoer
    %%  +time afvoer
  }
  note for ReferentielijstItems "Voorbeeld: Landenlijst_Land.
  Koppeltabel lijst ↔ item.
  N.B.: elk type heeft één vast lijst-id!"

  class LijstItemRelatieXGegevens {
    «Gegevenselement»
    +int versie PFK
    +... inhoudelijke velden
    %%  +time opvoer
    %%  +time afvoer
  }

  class RefLijstXGegevens {
    «Gegevenselement»
    +int versie PFK
    +... inhoudelijke velden
    %%  +time opvoer
    %%  +time afvoer
  }

%%  class Aanvang_Einde["_Aanvang / _Einde"] {
%%    +int versie PFK
%%    +date datum
    %%  +time opvoer
    %%  +time afvoer
%%  }

  %%Referentielijst --|> Entiteit
  %%ReferentielijstItem --|> Entiteit
  %%ReferentielijstItems --|> Relatie
  

  register_referentielijst "1" ..|> "1" Referentielijst : realiseert | typenaam etc. ↔ MetaRegistry
  Referentielijst "1" --> "*" ReferentielijstItems : heeft items via
  ReferentielijstItems "*" --> "1" ReferentielijstItem : verwijst naar
%%  Referentielijst "1" *-- "0..*" Aanvang_Einde : materieel
%%  ReferentielijstItem "1" *-- "0..*" Aanvang_Einde : materieel
%%  ReferentielijstItems "1" *-- "0..*" Aanvang_Einde : materieel
  ReferentielijstItems "1" *-- "1" LijstItemRelatieXGegevens : eventueel extra informatie over kopppeling
  ReferentielijstItem "1" *-- "*" RefLijstXGegevens : gegevens van een item
```

### Concreet voorbeeld: Landenlijst

```mermaid
classDiagram
  direction LR

  class Referentielijst {
    «entiteit»
    +int id
  }

  class ReferentielijstNaam {
    «GE hub»
    +int rel_id
    +string naam
  }
  ReferentielijstNaam --* Referentielijst

  class ReferentielijstOpmerking {
    «GE hub»
    +int rel_id
    +string opmerking
  }
  ReferentielijstOpmerking --* Referentielijst


  class Landenlijst {
    «Referentielijst record»
    +int id = 3
  }

  class Land {
    «ReferentielijstItem»
    +int id
  }

  class LandenlijstLand {
    «ReferentielijstItems»
    +int landenlijst_id = 3 FK
    +int land_id FK
  }

  class Landcode {
    «GE hub»
    +int land_id FK
    +int rel_id
  }

  class Landnaam {
    «GE hub»
    +int land_id FK
    +int rel_id
  }

  class Landcode_Data {
    +string code
    +int versie
  }

  class Landnaam_Data {
    +string naam
    +int versie
  }

  Referentielijst "1" *-- "*" LandenlijstLand
  Referentielijst ..> Landenlijst : "bevat het record"
  LandenlijstLand ..> Landenlijst : "wijst naar exact dit record"
  LandenlijstLand "1" *-- "*" Land
  Land "1" *-- "1" Landcode
  Land "1" *-- "1" Landnaam
  Landcode "1" *-- "*" Landcode_Data
  Landnaam "1" *-- "*" Landnaam_Data
```

### Relatie tot bestaand metamodel

- De drie subtypes erven alle eigenschappen van hun basis-metatype: hub+data-patroon, aanvang/einde (indien materieel), relatieve autoincrement, formele opvoer/afvoer.
- Het onderscheid met gewone entiteiten/relaties zit puur in **metamodel-metadata** (`entiteitSubtype` / `relatieSubtype`), niet in runtime-gedrag.

### Metamodel (META-niveau)

#### Algemeen representatie metamodel
Dit bevat wel het Referentielijstitem, dat zich als een gegevenstype gedraagt.
```mermaid
classDiagram
  direction TB

  class Representatie {
    naam «id»
    alias [0..1]
    beschrijving
  }

  class Entiteit

  class Gegevenselement {
    /waarde : type [0..*]
  }

  class Relatie {
    type : Relatietype
    tijdlijn : Tijdlijnvoorkomen [0..1]
  }

  class Gegeven {
    naam
    alias [0..1]
    beschrijving
    type : Gegevenstype
  }

  class Referentielijstitem {
    <<Gegevenstype>>
  }

  class Enumeratie {
    <<Gegevenstype>>
  }

  class Enumeratiewaarde {
    nummer : int [0..1]
    naam : string
    beschrijving [0..1]
  }

  Representatie <|-- Entiteit
  Representatie <|-- Gegevenselement
  Gegevenselement <|-- Relatie
  Referentielijstitem --|> Entiteit : subtype van
  Relatie --> Representatie : van «bron 1»
  Relatie --> Representatie : tot «doel 1»
  Entiteit "1" *-- "0..*" Gegevenselement
  Gegevenselement "1" *-- "0..*" Gegeven
  Gegeven "0..1" --> Enumeratie : is van het type
  Gegeven "0..1" --> Referentielijstitem : is van het type
  Enumeratie "1" *-- "1..*" Enumeratiewaarde
  
  note for Gegeven "Een Gegeven is altijd van een bepaald Gegevenstype,
   en kan daarmee ook een verwijzing naar een 
   Referentielijstitem of Enumeratie zijn."

  %%note for Referentielijstitems "Een Referentielijstitems is een bijzondere relatie:
  %% het relateert alle Referentielijst-elementen van een bepaald type aan exact 
  %% één instantie van een Referentielijst. 
  %% (Dit i.t.t. een normale relatie die meer-op-meer koppelt.)"
```

#### Referentielijsten toegevoegd aan het metamodel
Onderstaand diagram toont hoe referentielijsten zich verhouden tot de bestaande metamodel-concepten (Entiteit, Gegevenselement, Relatie, Gegeven, Gegevenstype).
Representatie is er voor de duidelijkheid uitgelaten. Zie hierboven het metamodel met de representatie superklasse.

```mermaid
classDiagram
  direction TB

%%  class Representatie {
%%    naam «id»
%%    alias [0..1]
%%    beschrijving
%%  }

  namespace ReferentielijstDomein {
    class Referentielijst {
    }

    class Referentielijstnaam {
      naam
    }

    class Referentielijstitems {
    }

    class Referentielijstitem {
    }
  }

  namespace Basismetatypes {
    class Entiteit

    class Gegevenselement {
      /waarde : type [0..*]
    }

    class Relatie {
      %%type : Relatietype
      %%tijdlijn : Tijdlijnvoorkomen [0..1]
    }
  }

%%  class Gegeven {
%%    naam
%%    alias [0..1]
%%    beschrijving
%%    type : Gegevenstype
%%  }

%%  class Enumeratie {
%%    <<Gegevenstype>>
%%  }

%%  class Enumeratiewaarde {
%%    nummer : int [0..1]
%%    naam : string
%%    beschrijving [0..1]
%%  }

  %%Representatie <|-- Entiteit
  %%Representatie <|-- Gegevenselement
  %%Gegevenselement <|-- Relatie

  Referentielijstnaam --* Referentielijst
  Referentielijst "1" --> "*" Referentielijstitems : bevat
  Referentielijstitems --> "1" Referentielijstitem

  Referentielijst --|> Entiteit : subtype van
  Referentielijstnaam --|> Gegevenselement : subtype van
  Referentielijstitem --|> Entiteit : subtype van
  Referentielijstitems --|> Relatie : subtype van
  
  
  %%Relatie --> Representatie : van «bron 1»
  %%Relatie --> Representatie : tot «doel 1»
  Entiteit "1" *-- "0..*" Gegevenselement
  %%Gegevenselement "1" *-- "0..*" Gegeven
  %%Gegeven "0..1" --> Enumeratie : is van het type
  %%Gegeven "0..1" --> Referentielijstitem : is van het type
  %%Enumeratie "1" *-- "1..*" Enumeratiewaarde
  
  %%note for Gegeven "Een Gegeven is altijd van een bepaald Gegevenstype,
  %% en kan daarmee ook een verwijzing naar een 
  %% Referentielijstelement of Enumeratie zijn."

  note for Referentielijstitems "Een ReferentielijstItems is een bijzondere relatie:
   het relateert alle Referentielijst-elementen van een bepaald type aan exact 
   één instantie van een Referentielijst. 
   (Dit i.t.t. een normale relatie die meer-op-meer koppelt.)"
```

Verbeterde variant (toelichting als class in namespace):

```mermaid
classDiagram
  direction TB

  namespace ReferentielijstDomein {
    class Referentielijst {
    }

    class Referentielijstnaam {
      naam
    }

    class Referentielijstitems {
    }

    class Referentielijstitem {
    }

    class ToelichtingRefItems{
    }
  }

  namespace Basismetatypes {
    class Entiteit

    class Gegevenselement {
      /waarde : type [0..*]
    }

    class Relatie {
    }
  }

  Referentielijstnaam --* Referentielijst
  Referentielijst "1" --> "*" Referentielijstitems : bevat
  Referentielijstitems --> "1" Referentielijstitem

  Referentielijst --|> Entiteit : subtype van
  Referentielijstnaam --|> Gegevenselement : subtype van
  Referentielijstitem --|> Entiteit : subtype van
  Referentielijstitems --|> Relatie : subtype van
  
  Entiteit "1" *-- "0..*" Gegevenselement

  %% Layout-hint: trek toelichting naar Referentielijstitems
  ToelichtingRefItems .. Referentielijstitems

  note for ToelichtingRefItems "Een ReferentielijstItems is een bijzondere relatie:
   het relateert alle Referentielijst-elementen van een bepaald type aan exact
   één instantie van een Referentielijst.
   (Dit i.t.t. een normale relatie die meer-op-meer koppelt.)"
```

 **Verschil:** In deze variant staat de toelichting als class **binnen** het ReferentielijstDomein namespace, niet erbuiten. Dit zorgt ervoor dat de toelichting altijd zichtbaar blijft, ook in dark theme op GitHub.

### Enkelvoud en meervoud

Omdat het Nederlands onregelmatig is (land/landen, lidstaat/lidstaten), moeten enkelvoud en meervoud altijd expliciet worden vastgelegd in het model, net als bij gewone entiteiten.

---

## 3. Systeemtabel `register_referentielijst`

Elke referentielijst mapt op een **record** in de registersysteemtabel `register_referentielijst`. Deze tabel gedraagt zich als een entiteit-register van alle referentielijsten in het systeem.

```
register_referentielijst
├── id            (PK, autoincrement)
├── typenaam      (unique, naam uit het metamodel, bijv. "Landen")
├── naam          (weergavenaam)
├── beschrijving  (optioneel)
└── is_materieel  (bool)
```

### Synchronisatie bij opstart

Bij elke opstart van de API wordt de systeemtabel gesynchroniseerd met de MetaRegistry:
- Loop door alle entries met `EntiteitSubtype == "referentielijst"`
- `INSERT ... ON CONFLICT (typenaam) DO UPDATE` zodat naamswijzigingen en beschrijvingen worden bijgewerkt
- Dit zorgt ervoor dat modelwijzigingen automatisch worden doorgevoerd

---

## 4. API-routes

### Gescheiden van gewone types

Referentielijsten worden **niet** gemixed met gewone entiteit-routes. In plaats daarvan:

```
GET  /referentielijsten                       → overzicht van alle referentielijsten (uit systeemtabel)
GET  /referentielijsten/{naam}                → detail van één referentielijst (bijv. /referentielijsten/landen)
GET  /full/referentielijsten/{naam}           → volledige lijst met alle items (expanded)
```

De `{naam}` is de naam van de lijst **zonder meervoud-s**, omdat de lijstnaam in principe al meervoud is (de Landen-lijst, de EU-Lidstaten-lijst).

### Items en relaties

Items en koppelrelaties krijgen wél gewone MetaRegistry-routes omdat ze zich exact als entiteiten/relaties gedragen:

```
GET  /lands                                   → alle Land-items
GET  /lands/:id                               → één Land
GET  /landen_lands                             → alle Landen_Land koppelingen
POST /registratie/                             → registreer items via bestaande registratie-API
```

### Registratieworkflow

1. Items worden aangemaakt via de reguliere `/registratie/` endpoint (net als elke entiteit)
2. De koppeling aan de referentielijst geschiedt via een aparte registratie van de relatie, omdat het ID van het item pas na stap 1 bekend is
3. Later kan een "handelingsgedreven" endpoint worden toegevoegd dat stap 1+2 combineert

---

## 5. Materieel / formeel

Referentielijsten, items en koppelingen zijn **standaard formeel**. Materieel kan worden gekozen, net als bij elke andere entiteit of relatie.

- **Formeel** (standaard): het register houdt bij wanneer iets is geregistreerd (opvoer/afvoer)
- **Materieel** (optioneel): ook geldigheidsperiode (aanvang/einde) bijhouden. Nuttig als de lijst zelf of individuele items een ingangsdatum moeten hebben

---

## 6. Metamodel V3 wijzigingen

### Entiteit-niveau
Optioneel nieuw veld op entiteiten:
```json
"entiteitSubtype": "referentielijst" | "referentielijst_item"
```

### Relatie-niveau
Optioneel nieuw veld op relaties:
```json
"relatieSubtype": "referentielijst_items"
```

Beide velden zijn **backwards compatible**: bestaande modellen zonder deze velden werken onveranderd.

---

## 7. Editor (UML)

### Toolbar

- **"+ Referentielijst"** knop: maakt in één klik drie nodes + edges aan:
  1. referentielijst-entiteit (met standaard naam-GE en opmerking-GE)
  2. referentielijst_item-entiteit (leeg)
  3. referentielijst_items-relatie (1→2 verbinding)
- **"+ Ref. Item"** en **"+ Ref. Items"** losse knoppen voor extra items/koppelingen
- Groepering onder een dropdown/submenu "Referentielijsten ▼" om de toolbar beheersbaar te houden

### Node-weergave

- Referentielijst-entiteiten krijgen een badge/stereotype: `«referentielijst»`
- Referentielijst_item-entiteiten: `«ref.lijst item»`
- Referentielijst_items-relaties: `«ref.lijst items»`
- Eigen kleuren per subtype

### Type-keuzelijst

`referentielijst_item`-typen verschijnen in de type-keuzelijst van GE-velden, vergelijkbaar met enumeraties. Wanneer een veld van type "Land" wordt gekozen, genereert de editor automatisch een dependency-edge naar dat ref.lijst-item type.

### Edge-constraints (editor only)

- Bij een `referentielijst_items`-relatie: bron mag alleen referentielijst zijn, doel mag alleen referentielijst_item zijn
- Dit is een **editor-constraint**, geen DB-constraint

---

## 8. Naamconventie

Vrij, niet afgedwongen. Voorbeelden:

| Referentielijst | Item-type | Relatie |
|---|---|---|
| Landen | Land | Landen_Land |
| EU_Lidstaten | Land | EU_Lidstaten_Land |
| Plantensoorten | Plant | Plantensoorten_Plant |

Een item-type (bijv. "Land") kan in meerdere referentielijsten voorkomen.

---

## 9. MetaRegistry

### Nieuwe velden in TypeMeta

```go
EntiteitSubtype   string  // "", "referentielijst", "referentielijst_item"
RelatieSubtype    string  // "", "referentielijst_items"
```

### Constanten

```go
const EntiteitSubtypeReferentielijst     = "referentielijst"
const EntiteitSubtypeReferentielijstItem = "referentielijst_item"
const RelatieSubtypeReferentielijstItems = "referentielijst_items"
```

---

## 10. Code generator

Na validatie van het handmatige testmodel wordt de codegenerator (`cmd/codegen/`) aangepast:

- V3 JSON parsen: `entiteitSubtype`, `relatieSubtype` herkennen
- `gen_registry.go`: subtype-waarden meegenereren in TypeMeta-entries
- `gen_structs.go`: commentaar toevoegen dat het een referentielijst-subtype betreft

---

## 11. Implementatiefasen

| Fase | Stappen | Validatie |
|---|---|---|
| **1** | V3 modelschema + Editor (types, import/export, toolbar, nodes) | Editor kan ref.lijsten aanmaken en exporteren als V3 JSON |
| **2** | MetaRegistry plumbing + systeemtabel + handmatig testmodel | Tabellen, routes en registratie werken voor testmodel |
| **3** | Schema-API + frontend index/formulieren | Ref.lijsten zichtbaar en bruikbaar in frontend |
| **4** | Code generator aanpassen | V3 model → gegenereerde Go-code inclusief ref.lijsten |
