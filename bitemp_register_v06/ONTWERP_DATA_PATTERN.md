# Ontwerp: Hub + _Data pattern voor v06

## 1. Probleemstelling

In v05 bevatten GE- en relatie-tabellen (bijv. `a_u`, `rel_a_b`) zowel structurele velden (`a_id`, `rel_id`) als inhoudsvelden (`aaa`, `bbb`, `soort`), en formele-tijdvelden (`opvoer`, `afvoer`) in **één** record.

Dit levert twee problemen op:

1. **Correctie**: bij een correctie van inhoud (bijv. `aaa` wijzigt van "foo" naar "bar") moet het hele record worden afgevoerd en een nieuw record worden opgevoerd. De `rel_id` gaat daarbij op, terwijl het logisch gezien dezelfde instantie is.
2. **Materiële tijd op GE/REL-niveau**: als we aanvang/einde willen toevoegen aan een GE of relatie, hebben we een stabiele hub nodig waaraan die aanvangs-/eindrecords hangen. Als het GE-record zelf verandert bij elke correctie, is er geen stabiel ankerpunt.

### Oplossing: Hub + _Data

Splits elk GE/REL-type in:

- **Hub** — de associatie (compositie) tussen ENT en GE/REL: (`ent_id`, `rel_id`), met afgeleide `opvoer`/`afvoer`. Bevat alleen structurele en relatie-FK-velden.
- **_Data** — de inhoud: (`ent_id`, `rel_id`, `versie`), met afgeleide `opvoer`/`afvoer` per versie. Elke inhoudswijziging is een nieuwe versie.
- **_Aanvang / _Einde** — (alleen voor materiële hubs): (`ent_id`, `rel_id`, `versie`), analoog aan de entiteits-aanvang/einde maar dan op hub/associatie-niveau.

---

## 2. Fundamenteel: opvoer en afvoer zijn altijd afgeleid

**Alle** `opvoer` en `afvoer` velden in inhoudelijke records — ENT, GE hub, REL hub, _Data, _Aanvang, _Einde — zijn **afgeleide waarden**. Ze representeren de toestand na verwerking van alle wijzigingen tot het huidige moment (t_f = nu).

De bron van waarheid voor formele tijd is altijd de **wijzigingen-tabel** in combinatie met de **registratie**. Elke registratie bevat wijzigingen (opvoer/afvoer), en het tijdstip van de registratie bepaalt het formele moment waarop die wijzigingen van kracht worden.

Bij **formeel tijdreizen** (ophalen van de toestand op een willekeurig formeel tijdstip t_f ≤ nu) worden de opvoer/afvoer-velden in de records **niet** gebruikt. In plaats daarvan wordt de toestand op t_f opnieuw afgeleid door alle wijzigingen tot en met t_f te verwerken.

Dit geldt voor alle lagen in de hiërarchie:

| Laag | Opvoer/afvoer betekenis |
|------|------------------------|
| **Entiteit** (A, B) | Afgeleid: opvoer/afvoer van de entiteit na alle wijzigingen t/m nu |
| **GE/REL hub** (A_U, Rel_A_B, ...) | Afgeleid: opvoer/afvoer van de hub na alle wijzigingen t/m nu |
| **_Data** (A_U_Data, ...) | Afgeleid: opvoer/afvoer van deze specifieke data-versie na alle wijzigingen t/m nu |
| **_Aanvang/_Einde** (A_W_Aanvang, ...) | Afgeleid: opvoer/afvoer van deze specifieke aanvang/einde-versie na alle wijzigingen t/m nu |
| **Entiteits-plumbing** (A_Aanvang, A_Einde, ...) | Afgeleid: idem |

Het formele tijdstip t_f kan zich **nooit** in de toekomst bevinden — we kunnen immers niet in de toekomst registreren.

---

## 3. De hub als associatie (compositie)

### 3.1 UML-perspectief

De hub is in UML-termen de **associatie** tussen ENT en GE/REL. Specifieker: het is een **compositie**-relatie. Dat wil zeggen: wanneer de hoofd­klasse (ENT) ophoudt te bestaan (wordt afgevoerd), houden de onderdelen (GE/REL-hubs en hun _Data, _Aanvang, _Einde) ook op te bestaan. De API handhaaft dit: bij afvoer van een ENT worden alle onderliggende hubs mee-afgevoerd.

De hub bevat géén inhoudsvelden — die zitten in _Data. De hub is puur het stabiele identiteitsanker dat de koppeling tussen ENT en GE/REL materialiseert.

### 3.2 Materialiteit zit op de associatie

**Aanvang en einde zitten op de hub**, niet op _Data. Dit is logisch, want materialiteit (geldigheid in de werkelijkheid) is een eigenschap van de **koppeling** tussen een entiteit en een gegevenselement/relatie, niet van de inhoud zelf.

Praktisch voorbeeld: een persoon heeft een naam. De naam (GE) is gekoppeld aan de persoon (ENT) via een hub. Die koppeling heeft een materiële tijdlijn: aanvang (bijv. geboortedatum) en einde (bijv. datum naamswijziging). De inhoud (de feitelijke naam) staat in _Data en kan onafhankelijk gecorrigeerd worden zonder de materiële tijdlijn te raken.

### 3.3 Voorbeeld: correctie van materiële tijd

Stel: een Persoon (ENT) met een Persoon_Naam (GE, materieel).

**Stap 1 — Oorspronkelijke registratie** (t_reg = 21/3/2026):

De persoon wijzigt zijn naam. Er ontstaat een nieuwe hub (rel_id=2) aansluitend op de vorige (rel_id=1). De registratie zet de datum (foutief) op de dag van registratie.

| Record | rel_id | _data versie | naam | hub aanvang | hub einde | opvoer | afvoer |
|--------|--------|-------------|------|-------------|-----------|--------|--------|
| Hub 1 | 1 | 1 | "Jansen" | geboortedatum | 20/3/2026 | t_reg | — |
| Hub 2 | 2 | 1 | "De Vries" | 21/3/2026 | — | t_reg | — |

**Stap 2 — Correctie** (t_corr > t_reg):

De rechtbank bepaalt dat de naamswijziging met terugwerkende kracht per 1/1/2025 effectief is. We corrigeren:
- **Einde** van hub 1 (rel_id=1): nieuwe versie → 31/12/2024
- **Aanvang** van hub 2 (rel_id=2): nieuwe versie → 1/1/2025

| Record | rel_id | versie | waarde | opvoer | afvoer |
|--------|--------|--------|--------|--------|--------|
| **Hub 1 — einde** | 1 | 1 | 20/3/2026 | t_reg | t_corr |
| **Hub 1 — einde** | 1 | 2 | 31/12/2024 | t_corr | — |
| **Hub 2 — aanvang** | 2 | 1 | 21/3/2026 | t_reg | t_corr |
| **Hub 2 — aanvang** | 2 | 2 | 1/1/2025 | t_corr | — |

**Volledig overzicht na correctie** (alle records, alle lagen):

| Laag | rel_id | versie | inhoud/waarde | opvoer | afvoer |
|------|--------|--------|---------------|--------|--------|
| **Hub 1** | 1 | — | — | t_reg | — |
| Hub 1 — _data | 1 | 1 | "Jansen" | t_reg | — |
| Hub 1 — _aanvang | 1 | 1 | geboortedatum | t_reg | — |
| Hub 1 — _einde | 1 | 1 | 20/3/2026 | t_reg | t_corr |
| Hub 1 — _einde | 1 | 2 | 31/12/2024 | t_corr | — |
| **Hub 2** | 2 | — | — | t_reg | — |
| Hub 2 — _data | 2 | 1 | "De Vries" | t_reg | — |
| Hub 2 — _aanvang | 2 | 1 | 21/3/2026 | t_reg | t_corr |
| Hub 2 — _aanvang | 2 | 2 | 1/1/2025 | t_corr | — |

Wat **niet** verandert bij deze correctie:
- De **hub**-records zelf (rel_id=1 en rel_id=2) — hun opvoer/afvoer is ongewijzigd
- De **_data**-records (de inhoud "Jansen" en "De Vries") — die zijn inhoudelijk correct
- De **_aanvang** van hub 1 (geboortedatum) — die was en blijft correct
- Hub 2 heeft geen _einde (materieel nog actueel)

Dit illustreert waarom de drielaagse opsplitsing noodzakelijk is:
- **Hub** = stabiel identiteitsanker (associatie/compositie)
- **_Data** = inhoud, onafhankelijk corrigeerbaar
- **_Aanvang/_Einde** = materiële tijdlijn, onafhankelijk corrigeerbaar

Elke laag kan apart gecorrigeerd worden zonder de andere lagen te beïnvloeden.

---

## 4. Ontwerpbeslissingen

| Aspect | Beslissing |
|--------|-----------|
| Opvoer/afvoer overal | **Altijd afgeleid** — in ENT, hub, _Data, _Aanvang/_Einde. Bron van waarheid = wijzigingen + registratie (zie §2) |
| Hub heeft opvoer/afvoer | Ja, afgeleid: de actuele toestand (t_f = nu) na verwerking van alle wijzigingen |
| _Data bestaat wanneer | GE/REL heeft inhoudsvelden (niet bij "existence-only" types) |
| _Data PK | `(ent_id, rel_id, versie)` — drieledige samengestelde sleutel |
| _Data heeft opvoer/afvoer | Ja, afgeleid per versie (t_f = nu toestand) |
| _Data heeft aanvang/einde | **Nooit** — aanvang/einde hangen aan de hub |
| _Aanvang/_Einde niveau | Op de **hub**, niet op _data |
| _Aanvang/_Einde scope | Alleen materiële (`IsMaterieel: true`) GE/REL-types |
| Alle GE/REL-types | Krijgen hub-structuur; inhoud verhuist naar _Data |
| Registratie-API | Blijft **plat**; handler splitst intern naar hub + data |
| Full query API | Hub + geneste data-versies + optioneel aanvang/einde |
| Structurele FK's (bijv. `b_id`) | Blijven op de **hub** |

---

## 5. Typemapping: v05 → v06

### 5.1 Overzicht per GE/REL-type

| v05 Type | IsMaterieel | v06 Hub tabel | v06 _Data tabel | v06 _Aanvang | v06 _Einde |
|----------|-------------|---------------|-----------------|--------------|------------|
| `A_U`      | nee  | `a_u` | `a_u_data` | — | — |
| `A_V`      | nee  | `a_v` | `a_v_data` | — | — |
| `A_W`      | ja   | `a_w` | `a_w_data` | `a_w_aanvang` | `a_w_einde` |
| `Rel_A_B`  | ja   | `rel_a_b` | `rel_a_b_data` | `rel_a_b_aanvang` | `rel_a_b_einde` |
| `B_X`      | nee  | `b_x` | `b_x_data` | — | — |
| `B_Y`      | nee  | `b_y` | `b_y_data` | — | — |

### 5.2 Velden per laag

#### Hubs (geen inhoudsvelden meer)

| Hub | PK | Structurele FK's | Afgeleide velden |
|-----|----|------------------|------------------|
| `a_u` | `(a_id, rel_id)` | — | `opvoer`, `afvoer` |
| `a_v` | `(a_id, rel_id)` | — | `opvoer`, `afvoer` |
| `a_w` | `(a_id, rel_id)` | — | `opvoer`, `afvoer` |
| `rel_a_b` | `(a_id, rel_id)` | `b_id` | `opvoer`, `afvoer` |
| `b_x` | `(b_id, rel_id)` | — | `opvoer`, `afvoer` |
| `b_y` | `(b_id, rel_id)` | — | `opvoer`, `afvoer` |

#### _Data (inhoudsvelden + versie)

| _Data | PK | FK naar hub | Inhoudsvelden | Formele tijd |
|-------|----|-------------|---------------|--------------|
| `a_u_data` | `(a_id, rel_id, versie)` | `(a_id, rel_id) → a_u` | `aaa`, `bbb` | `opvoer`, `afvoer` |
| `a_v_data` | `(a_id, rel_id, versie)` | `(a_id, rel_id) → a_v` | `ccc`, `ddd`, `eee`, `fff`, `ggg`, `datum` | `opvoer`, `afvoer` |
| `a_w_data` | `(a_id, rel_id, versie)` | `(a_id, rel_id) → a_w` | `float`, `heel` | `opvoer`, `afvoer` |
| `rel_a_b_data` | `(a_id, rel_id, versie)` | `(a_id, rel_id) → rel_a_b` | `soort` | `opvoer`, `afvoer` |
| `b_x_data` | `(b_id, rel_id, versie)` | `(b_id, rel_id) → b_x` | `fff`, `ggg` | `opvoer`, `afvoer` |
| `b_y_data` | `(b_id, rel_id, versie)` | `(b_id, rel_id) → b_y` | `hhh` | `opvoer`, `afvoer` |

#### _Aanvang / _Einde (alleen materiële hubs)

| Tabel | PK | FK naar hub | Waarde |
|-------|----|-------------|--------|
| `a_w_aanvang` | `(a_id, rel_id, versie)` | `(a_id, rel_id) → a_w` | `datum` |
| `a_w_einde` | `(a_id, rel_id, versie)` | `(a_id, rel_id) → a_w` | `datum` |
| `rel_a_b_aanvang` | `(a_id, rel_id, versie)` | `(a_id, rel_id) → rel_a_b` | `datum` |
| `rel_a_b_einde` | `(a_id, rel_id, versie)` | `(a_id, rel_id) → rel_a_b` | `datum` |

> **Let op**: de bestaande `A_Aanvang`, `A_Einde`, `B_Aanvang`, `B_Einde` (entiteits-plumbing) blijven ongewijzigd.

---

## 6. Hiërarchie

```
Entiteit A
├── A_U (hub, GE, enkelvoudig)
│   └── A_U_Data (versioned content)
├── A_V (hub, GE, meervoudig)
│   └── A_V_Data (versioned content)
├── A_W (hub, GE, meervoudig, materieel)
│   ├── A_W_Data (versioned content)
│   ├── A_W_Aanvang (materiële plumbing)
│   └── A_W_Einde (materiële plumbing)
├── Rel_A_B (hub, REL, meervoudig, materieel)
│   ├── Rel_A_B_Data (versioned content)
│   ├── Rel_A_B_Aanvang (materiële plumbing)
│   └── Rel_A_B_Einde (materiële plumbing)
├── A_Aanvang (entiteits-plumbing, bestaand)
└── A_Einde (entiteits-plumbing, bestaand)

Entiteit B
├── B_X (hub, GE, enkelvoudig)
│   └── B_X_Data (versioned content)
├── B_Y (hub, GE, enkelvoudig)
│   └── B_Y_Data (versioned content)
├── B_Aanvang (entiteits-plumbing, bestaand)
└── B_Einde (entiteits-plumbing, bestaand)
```

Dit is een drielaags-hiërarchie: Entiteit → Hub → _Data (+ optioneel _Aanvang/_Einde).

---

## 7. Go structs

### 7.1 Hub structs (database-representatie)

De hub bevat alleen structurele velden + afgeleide opvoer/afvoer + Bun-relaties naar _Data en optioneel _Aanvang/_Einde.

```go
// A_U hub — enkel structureel, inhoud in A_U_Data
type A_U struct {
    bun.BaseModel `bun:"table:a_u"`
    A_ID          int           `json:"a_id" bun:"a_id,pk"`
    Rel_ID        int           `json:"rel_id" bun:"rel_id,pk,autoincrement"`
    ParentA       *A            `json:"-" bun:"rel:belongs-to,join:a_id=id,on_delete:cascade"`
    Opvoer        *time.Time    `json:"opvoer,omitempty"`
    Afvoer        *time.Time    `json:"afvoer,omitempty"`
    // Onderliggende data-versies
    Data          []A_U_Data    `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Rel_A_B hub — structurele FK b_id blijft op de hub
type Rel_A_B struct {
    bun.BaseModel      `bun:"table:rel_a_b"`
    A_ID               int               `json:"a_id" bun:"a_id,pk"`
    Rel_ID             int               `json:"rel_id" bun:"rel_id,pk,autoincrement"`
    ParentA            *A                `json:"-" bun:"rel:belongs-to,join:a_id=id,on_delete:cascade"`
    B_ID               int               `json:"b_id"`
    Opvoer             *time.Time        `json:"opvoer,omitempty"`
    Afvoer             *time.Time        `json:"afvoer,omitempty"`
    // Onderliggende data-versies
    Data               []Rel_A_B_Data    `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"data,omitempty"`
    // Materiële plumbing
    Aanvang            []Rel_A_B_Aanvang `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
    Einde              []Rel_A_B_Einde   `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"einde,omitempty"`
}
```

Analoog voor alle andere GE/REL hubs. Het patroon is steeds:
- PK: `(ent_id, rel_id)`
- Optioneel: structurele FK's (alleen `b_id` bij `Rel_A_B`)
- Afgeleide velden: `opvoer`, `afvoer`
- Bun-relaties: `Data []..._Data`, optioneel `Aanvang`/`Einde`

### 7.2 _Data structs

```go
// A_U_Data — inhoud van A_U, geversioned
type A_U_Data struct {
    bun.BaseModel `bun:"table:a_u_data,alias:a_u_data"`
    A_ID          int        `json:"a_id" bun:"a_id,pk"`
    Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
    Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
    Aaa           string     `json:"aaa"`
    Bbb           *bool      `json:"bbb,omitempty"`
    Opvoer        *time.Time `json:"opvoer,omitempty"`
    Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Rel_A_B_Data — inhoud van Rel_A_B, geversioned
type Rel_A_B_Data struct {
    bun.BaseModel `bun:"table:rel_a_b_data,alias:rel_a_b_data"`
    A_ID          int            `json:"a_id" bun:"a_id,pk"`
    Rel_ID        int            `json:"rel_id" bun:"rel_id,pk"`
    Versie        int64          `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
    Soort         RelABSoort     `json:"soort" schema:"enum=LTT|LAT|LTA"`
    Opvoer        *time.Time     `json:"opvoer,omitempty"`
    Afvoer        *time.Time     `json:"afvoer,omitempty"`
}
```

Analoog: `A_V_Data`, `A_W_Data`, `B_X_Data`, `B_Y_Data`.

Elk _Data type implementeert `FormeleRepresentatie`:
- `GetID() any` → retourneert `Versie`
- `Metatype()` → `MetatypeGegevenselement`
- `ClearID()` → zet `Versie = 0`
- `Get/SetOpvoer`, `Get/SetAfvoer`

### 7.3 _Aanvang / _Einde structs (materiële GE/REL hubs)

```go
// A_W_Aanvang — materiële aanvang voor GE A_W
type A_W_Aanvang struct {
    bun.BaseModel `bun:"table:a_w_aanvang,alias:a_w_aanvang"`
    A_ID          int        `json:"a_id" bun:"a_id,pk"`
    Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
    Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
    Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
    Opvoer        *time.Time `json:"opvoer,omitempty"`
    Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// A_W_Einde — materiële einde voor GE A_W
type A_W_Einde struct {
    bun.BaseModel `bun:"table:a_w_einde,alias:a_w_einde"`
    A_ID          int        `json:"a_id" bun:"a_id,pk"`
    Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
    Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
    Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
    Opvoer        *time.Time `json:"opvoer,omitempty"`
    Afvoer        *time.Time `json:"afvoer,omitempty"`
}
```

Analoog: `Rel_A_B_Aanvang`, `Rel_A_B_Einde`.

### 7.4 "Platte" input-structs voor API-compatibiliteit

De registratie-API accepteert nog steeds platte objecten (inhoudsvelden + structurele velden samen). Hiervoor houden we **aparte input-structs** of hergebruiken we de huidige structs als "flat view".

**Optie A — Aparte input-structs** (bijv. `A_U_Input`):
```go
type A_U_Input struct {
    A_ID   int        `json:"a_id"`
    Rel_ID int        `json:"rel_id"`
    Aaa    string     `json:"aaa"`
    Bbb    *bool      `json:"bbb,omitempty"`
}
```
De handler parsed de input-struct en maakt hiervan een hub-record + data-record.

**Optie B — JSON-tags op hub met embed**:
De hub-struct heeft `json:"-"` voor Data, en een custom `UnmarshalJSON` die platte input splitst.

**Optie C — Factory-tweedeling**: `Factory` levert een flat struct (voor API/schema), `DBFactory` levert de hub struct (voor DB). De handler converteert.

> **Aanbeveling**: Optie A is het eenvoudigst en meest expliciet. We introduceren `_Input` structs die in de `Factory` terugkomen, en de handler splitst die naar hub + data.

---

## 8. MetaRegistry wijzigingen

### 8.1 Nieuwe velden op `TypeMeta`

```go
type TypeMeta struct {
    // ... bestaande velden ...

    // Nieuw: geeft aan of dit type een hub is met onderliggende _Data
    IsHub         bool
    DataTypenaam  string  // bijv. "A_U_Data" — leeg als geen _Data
}
```

Alternatief: geen nieuwe TypeMeta-velden, maar geef de hub een `OnderliggendeGegevenselementen` lijst (zoals entiteiten nu hebben). Dan wordt de hiërarchie uniform. Dit vereist wel dat hubs `HeeftOnderliggendeGegevenselementen` implementeren.

### 8.2 Nieuwe MetaRegistry entries

Per GE/REL-type komen er 1 tot 3 nieuwe entries bij:

```go
// _Data entry (per type)
"A_U_Data": {
    Typenaam:               "A_U_Data",
    Description:            "Geversioned inhoud van gegevenselement A_U.",
    Metatype:               MetatypeGegevenselement,
    IsMaterieel:            false,
    Veldnaam:               "a_u_data",
    Padnaam:                "a_u_data",
    Factory:                func() Representatie { return &A_U_Data{} },
    SliceFactory:           func() any { return &[]A_U_Data{} },
    Tabelnaam:              "a_u_data",
    IDKolom:                "versie",
    DBFactory:              func() Representatie { return &A_U_Data{} },
    DBSliceFactory:         func() any { return &[]A_U_Data{} },
    HeeftPFK:               true,
    RelatieveAutoincrement: true,
    EntiteitIDKolom:        "a_id",
    Momentvoorkomen:        Enkelvoudig,
    BovenliggendTypenaam:   "A_U",
},

// _Aanvang entry (alleen bij materiële hubs)
"A_W_Aanvang": {
    Typenaam:               "A_W_Aanvang",
    Description:            "Aanvangsdatum van GE A_W.",
    Metatype:               MetatypeGegevenselement,
    IsMaterieel:            false,
    Veldnaam:               "a_w_aanvang",
    Padnaam:                "a_w_aanvang",
    Factory:                func() Representatie { return &A_W_Aanvang{} },
    SliceFactory:           func() any { return &[]A_W_Aanvang{} },
    Tabelnaam:              "a_w_aanvang",
    IDKolom:                "versie",
    DBFactory:              func() Representatie { return &A_W_Aanvang{} },
    DBSliceFactory:         func() any { return &[]A_W_Aanvang{} },
    HeeftPFK:               true,
    RelatieveAutoincrement: true,
    EntiteitIDKolom:        "a_id",
    Momentvoorkomen:        Enkelvoudig,
    BovenliggendTypenaam:   "A_W",
},
```

### 8.3 Aangepaste hub entries

De hub entries verliezen hun inhoudsvelden (die staan nu in _Data) en krijgen `OnderliggendeGegevenselementen`:

```go
"A_U": {
    // ... structureel als voorheen, maar:
    IsHub: true,
    OnderliggendeGegevenselementen: []OnderliggendGegevenselement{
        {Rolnaam: "Data", JSONRolnaam: "data", Doeltype: "A_U_Data", Momentvoorkomen: Enkelvoudig},
    },
},

"A_W": {
    // ... structureel als voorheen, maar:
    IsHub:       true,
    IsMaterieel: true,
    OnderliggendeGegevenselementen: []OnderliggendGegevenselement{
        {Rolnaam: "Data", JSONRolnaam: "data", Doeltype: "A_W_Data", Momentvoorkomen: Enkelvoudig},
        {Rolnaam: "Aanvang", JSONRolnaam: "aanvang", Doeltype: "A_W_Aanvang", Momentvoorkomen: Enkelvoudig},
        {Rolnaam: "Einde", JSONRolnaam: "einde", Doeltype: "A_W_Einde", Momentvoorkomen: Enkelvoudig},
    },
},

"Rel_A_B": {
    // ... structureel als voorheen, maar:
    IsHub:       true,
    IsMaterieel: true,
    OnderliggendeGegevenselementen: []OnderliggendGegevenselement{
        {Rolnaam: "Data", JSONRolnaam: "data", Doeltype: "Rel_A_B_Data", Momentvoorkomen: Enkelvoudig},
        {Rolnaam: "Aanvang", JSONRolnaam: "aanvang", Doeltype: "Rel_A_B_Aanvang", Momentvoorkomen: Enkelvoudig},
        {Rolnaam: "Einde", JSONRolnaam: "einde", Doeltype: "Rel_A_B_Einde", Momentvoorkomen: Enkelvoudig},
    },
},
```

### 8.4 Totaaloverzicht MetaRegistry entries (v06)

| Categorie | Entries |
|-----------|---------|
| Entiteiten (ongewijzigd) | `A`, `B` |
| Entiteits-plumbing (ongewijzigd) | `A_Aanvang`, `A_Einde`, `B_Aanvang`, `B_Einde` |
| GE hubs (aangepast) | `A_U`, `A_V`, `A_W`, `B_X`, `B_Y` |
| REL hubs (aangepast) | `Rel_A_B` |
| _Data (nieuw) | `A_U_Data`, `A_V_Data`, `A_W_Data`, `Rel_A_B_Data`, `B_X_Data`, `B_Y_Data` |
| Hub-plumbing (nieuw) | `A_W_Aanvang`, `A_W_Einde`, `Rel_A_B_Aanvang`, `Rel_A_B_Einde` |
| **Totaal** | **10 bestaand + 10 nieuw = 20 entries** |

---

## 9. Database schema

### 9.1 Hub tabellen (aangepast — inhoudsvelden verwijderd)

```sql
-- a_u hub (was: a_id, rel_id, aaa, bbb, opvoer, afvoer)
CREATE TABLE a_u (
    a_id   INT NOT NULL,
    rel_id INT NOT NULL,
    opvoer TIMESTAMPTZ NULL,
    afvoer TIMESTAMPTZ NULL,
    PRIMARY KEY (a_id, rel_id),
    CONSTRAINT fk_a_u_a_id FOREIGN KEY (a_id) REFERENCES a(id) ON DELETE CASCADE
);

-- rel_a_b hub (b_id blijft structureel op hub)
CREATE TABLE rel_a_b (
    a_id   INT NOT NULL,
    rel_id INT NOT NULL,
    b_id   INT NOT NULL,
    opvoer TIMESTAMPTZ NULL,
    afvoer TIMESTAMPTZ NULL,
    PRIMARY KEY (a_id, rel_id),
    CONSTRAINT fk_rel_a_b_a_id FOREIGN KEY (a_id) REFERENCES a(id) ON DELETE CASCADE,
    CONSTRAINT fk_rel_a_b_b_id FOREIGN KEY (b_id) REFERENCES b(id)
);
```

### 9.2 _Data tabellen (nieuw)

```sql
CREATE TABLE a_u_data (
    a_id   INT NOT NULL,
    rel_id INT NOT NULL,
    versie BIGINT NOT NULL,
    aaa    TEXT NOT NULL,
    bbb    BOOLEAN NULL,
    opvoer TIMESTAMPTZ NULL,
    afvoer TIMESTAMPTZ NULL,
    PRIMARY KEY (a_id, rel_id, versie),
    CONSTRAINT fk_a_u_data_hub FOREIGN KEY (a_id, rel_id) REFERENCES a_u(a_id, rel_id) ON DELETE CASCADE
);

CREATE TABLE rel_a_b_data (
    a_id   INT NOT NULL,
    rel_id INT NOT NULL,
    versie BIGINT NOT NULL,
    soort  TEXT NOT NULL,
    opvoer TIMESTAMPTZ NULL,
    afvoer TIMESTAMPTZ NULL,
    PRIMARY KEY (a_id, rel_id, versie),
    CONSTRAINT fk_rel_a_b_data_hub FOREIGN KEY (a_id, rel_id) REFERENCES rel_a_b(a_id, rel_id) ON DELETE CASCADE
);
```

Analoog voor `a_v_data`, `a_w_data`, `b_x_data`, `b_y_data`.

### 9.3 Hub _Aanvang/_Einde tabellen (nieuw, alleen materiële hubs)

```sql
CREATE TABLE a_w_aanvang (
    a_id   INT NOT NULL,
    rel_id INT NOT NULL,
    versie BIGINT NOT NULL,
    datum  DATE NULL,
    opvoer TIMESTAMPTZ NULL,
    afvoer TIMESTAMPTZ NULL,
    PRIMARY KEY (a_id, rel_id, versie),
    CONSTRAINT fk_a_w_aanvang_hub FOREIGN KEY (a_id, rel_id) REFERENCES a_w(a_id, rel_id) ON DELETE CASCADE
);
-- analoog: a_w_einde, rel_a_b_aanvang, rel_a_b_einde
```

### 9.4 Trigger voor versie-autoincrement

Elke _Data en _Aanvang/_Einde tabel krijgt een relatieve autoincrement trigger via `RegisterRelativeIDTriggerComposite()`:
- scope: `(ent_id, rel_id)` 
- kolom: `versie`

---

## 10. Handler wijzigingen

### 10.1 Registratie (opvoer)

De `handleRepresentatieOpvoer` functie werkt nu als volgt voor een GE/REL met _Data:

**Huidig** (v05):
1. Ontvang plat GE-record (bijv. `{"a_id": 1, "aaa": "foo", "bbb": true}`)
2. Insert in `a_u` tabel
3. Registreer wijziging

**Nieuw** (v06):
1. Ontvang plat record (API blijft gelijk)
2. **Split** in hub-deel en data-deel op basis van metadata
3. Insert hub in `a_u` (als hub nog niet bestaat, of bij nieuwe instantie)
4. Insert data in `a_u_data` met `versie` autoincrement
5. Registreer wijzigingen (voor hub + data apart)

Bij een **correctie**:
1. Hub record blijft ongewijzigd (zelfde `a_id`, `rel_id`)
2. Huidige actieve data-versie wordt afgevoerd
3. Nieuwe data-versie wordt opgevoerd
4. Wijzigingen worden geregistreerd op _Data niveau

Bij **enkelvoudig** momentvoorkomen:
- Vorige actieve data-versie wordt automatisch afgevoerd (zoals nu bij enkelvoudige GE's)
- Hub blijft bestaan

### 10.2 Full entity query

De `MakeGetFullEntityByMetaHandler` haalt nu een extra niveau op:

**Huidig** (v05):
```json
{
  "id": 1, "opvoer": "...",
  "us": [{"a_id": 1, "rel_id": 1, "aaa": "foo", "opvoer": "..."}]
}
```

**Nieuw** (v06):
```json
{
  "id": 1, "opvoer": "...",
  "us": [{
    "a_id": 1, "rel_id": 1, "opvoer": "...",
    "data": [
      {"a_id": 1, "rel_id": 1, "versie": 2, "aaa": "bar", "opvoer": "..."},
      {"a_id": 1, "rel_id": 1, "versie": 1, "aaa": "foo", "opvoer": "...", "afvoer": "..."}
    ]
  }]
}
```

De Bun query gebruikt nu geneste `Relation()` calls:
```go
query.Relation("Us", func(q *bun.SelectQuery) *bun.SelectQuery {
    return q.Relation("Data")
})
```

### 10.3 Formeel tijdreizen

Bij formeel tijdreizen (`?t=...`) moeten we op twee niveaus filteren:
1. Hub: `opvoer <= t AND (afvoer IS NULL OR afvoer > t)`
2. _Data: `opvoer <= t AND (afvoer IS NULL OR afvoer > t)`

De bestaande `applyFormeleTijdFilterVoorModel` functie wordt uitgebreid om ook de geneste _Data relatie te filteren.

---

## 11. Schema-API wijzigingen

De schema-API moet het onderscheid weergeven:

- **Hub**: bevat alleen structurele velden + afgeleid opvoer/afvoer + `onderliggende_gegevenselementen` naar _Data (en optioneel _Aanvang/_Einde)
- **_Data**: bevat inhoudsvelden + versie + opvoer/afvoer

De frontend kan hiermee dynamisch bepalen welke velden bij welke laag horen.

Optioneel: een `"laag": "hub"` of `"laag": "data"` indicator in de schema-output per type.

---

## 12. `createmodeltables.go` wijzigingen

De tabelcreatie-volgorde wordt:

1. **Entiteiten** (A, B) — ongewijzigd
2. **GE/REL hubs** (a_u, a_v, a_w, rel_a_b, b_x, b_y) — hub-versie zonder inhoudsvelden
3. **_Data tabellen** — aangemaakt via `createDataTabel(ctx, db, hubMeta)`:
   - PK: `(ent_id, rel_id, versie)`
   - FK: `(ent_id, rel_id) → hub`
   - Trigger: versie autoincrement scoped op `(ent_id, rel_id)`
4. **Hub _Aanvang/_Einde** — alleen voor materiële hubs, via bestaand `createMaterielePlumbingTablesForGEofRelatie()`
5. **Entiteits-plumbing** — A_Aanvang, A_Einde, etc. — ongewijzigd

Nieuw helper functie:
```go
func createDataTable(ctx context.Context, db *bun.DB, hubMeta model.TypeMeta) error {
    dataMeta, ok := model.MetaRegistry.GetTypeMeta(hubMeta.DataTypenaam)
    if !ok { return ... }
    
    // Maak _data tabel via Bun model
    _, err := db.NewCreateTable().
        Model(dataMeta.DBFactory()).
        WithForeignKeys().
        IfNotExists().Exec(ctx)
    if err != nil { return err }
    
    // Versie autoincrement trigger
    return RegisterRelativeIDTriggerComposite(ctx, db,
        dataMeta.Tabelnaam, dataMeta.EntiteitIDKolom, hubMeta.IDKolom, "versie")
}
```

---

## 13. Implementatiestappen

### Fase 1: Structs en MetaRegistry
1. Hub structs aanpassen: inhoudsvelden verwijderen, `Data` relatie toevoegen
2. Nieuwe `_Data` structs maken in `modellen_ge_rel.go`
3. Nieuwe `_Aanvang`/`_Einde` structs voor materiële hubs in `model_plumbing.go`
4. Interface-methoden implementeren op alle nieuwe structs
5. `TypeMeta.IsHub` en `TypeMeta.DataTypenaam` toevoegen aan `metaregistry_plumbing.go`
6. MetaRegistry entries updaten/toevoegen in `metaregistry.go`
7. `GeefOnderliggendeGegevenselementen()` op hub-types implementeren

### Fase 2: Database
8. `createmodeltables.go` aanpassen: _Data tabellen creëren na hubs
9. Bestaande materiële plumbing tabellen voor GE/RELs migreren (PK → 3-delig)

### Fase 3: Handlers
10. `handleRepresentatieOpvoer` uitbreiden: split flat input → hub + data
11. `handleRepresentatieAfvoer` uitbreiden: afvoer op hub → afvoer data; afvoer op data → alleen data
12. Correctie-logica: nieuwe data-versie, hub ongewijzigd
13. `MakeGetFullEntityByMetaHandler` uitbreiden: geneste Relation() voor _Data

### Fase 4: API & Schema
14. Schema-API: hub/data-indicatie, onderliggende_gegevenselementen voor hubs
15. Formeel tijdreizen: filter op beide niveaus

### Fase 5: Frontend
16. Frontend aanpassen voor hub+data structuur in responses
17. Formulieren: input blijft plat, weergave toont versie-historie

### Fase 6: Tests & migratie
18. Unit tests voor nieuwe structs en handlers
19. Migratie-script: `INSERT INTO a_u_data SELECT a_id, rel_id, 1, aaa, bbb, opvoer, afvoer FROM a_u`
20. Integratietests met registratie/correctie/undo scenario's

---

## 14. Open vragen

1. **API input struct**: Optie A (aparte `_Input` structs), Optie B (custom UnmarshalJSON op hub), of Optie C (Factory-tweedeling)? → aanbeveling: Optie A.

2. **`OnderliggendeGegevenselementen` op hubs**: Hergebruiken we dezelfde `OnderliggendGegevenselement` struct en `HeeftOnderliggendeGegevenselementen` interface, of introduceren we een apart concept voor hub→data relaties?

3. **Wijziging-tracking**: Wordt er een aparte wijziging geregistreerd voor de hub én de data, of alleen voor de data bij een correctie? → aanbeveling: bij eerste opvoer: wijziging voor zowel hub als data; bij correctie: alleen voor data.

4. **Schema-API veldherkomst**: Moet de schema-API per veld aangeven of het een hub-veld of data-veld is? → aanbeveling: ja, via een extra attribuut `"laag": "hub"|"data"`.
