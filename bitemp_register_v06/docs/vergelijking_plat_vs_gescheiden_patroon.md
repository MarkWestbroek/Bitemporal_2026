# Vergelijking: plat bitemporeel patroon vs. gescheiden registratiemodel

## 1. Inleiding

Dit document vergelijkt twee fundamenteel verschillende architecturen voor bitemporele registratie:

| | **Plat patroon** | **Gescheiden patroon** (ons v06 model) |
|---|---|---|
| **Kern** | Elke datarij bevat `opvoer`, `afvoer`, `aanvang`, `einde` direct als kolommen | Formele tijd zit in een aparte `wijzigingen`/`registratie`-tabel; `opvoer`/`afvoer` in datarijen zijn **afgeleide waarden**; materiële tijd in aparte `_aanvang`/`_einde`-tabellen |
| **Wie gebruikt het?** | Veel bedrijven, overheidsinstanties, SQL:2011 temporal tables, gangbare enterprise-systemen | Ons v06-model, geïnspireerd op registerdenken |

We tonen per scenario concreet de tabelinhoud in beide modellen en laten zien waar het platte model tekortschiet.

---

## 2. Modelopzet voor de scenario's

### 2.1 Plat patroon

Eén tabel `persoon_naam`:

| kolom | type | toelichting |
|-------|------|-------------|
| `id` | serial | PK, fysiek rij-ID |
| `persoon_id` | int | FK naar persoon |
| `naam` | text | inhoud |
| `aanvang` | date | materiële ingangsdatum |
| `einde` | date | materieel einde (null = nog geldig) |
| `opvoer` | timestamptz | formeel opgevoerd |
| `afvoer` | timestamptz | formeel afgevoerd (null = actueel) |

Formeel tijdreizen: `WHERE opvoer <= t_f AND (afvoer IS NULL OR afvoer > t_f)`.

### 2.2 Gescheiden patroon (v06)

Meerdere tabellen voor dezelfde logische gegevens:

**`persoon`** (entiteit):
| `id` | `opvoer`* | `afvoer`* |
|------|-----------|-----------|

**`persoon_naam`** (hub):
| `persoon_id` | `rel_id` | `opvoer`* | `afvoer`* |
|--------------|----------|-----------|-----------|

**`persoon_naam_data`** (inhoud, geversioned):
| `persoon_id` | `rel_id` | `versie` | `naam` | `opvoer`* | `afvoer`* |
|--------------|----------|----------|--------|-----------|-----------|

**`persoon_naam_aanvang`** (materieel begin, geversioned):
| `persoon_id` | `rel_id` | `versie` | `datum` | `opvoer`* | `afvoer`* |
|--------------|----------|----------|---------|-----------|-----------|

**`persoon_naam_einde`** (materieel einde, geversioned):
| `persoon_id` | `rel_id` | `versie` | `datum` | `opvoer`* | `afvoer`* |
|--------------|----------|----------|---------|-----------|-----------|

**`registratie`**:
| `id` | `type` | `tijdstip` | `corrigeert_reg_id` | `maakt_ongedaan_reg_id` |
|------|--------|------------|---------------------|-------------------------|

**`wijziging`**:
| `id` | `registratie_id` | `type` (opvoer/afvoer) | `representatienaam` | `representatie_id` | `versie` |
|------|------------------|------------------------|---------------------|--------------------|----------|

\* = **afgeleide waarden**, berekend na verwerking van alle wijzigingen t/m nu.

---

## 3. Scenario's

### 3.1 Eenvoudige registratie

**Situatie**: Persoon krijgt naam "Jansen", geldig vanaf 01-01-2020.

#### Plat patroon

`persoon_naam` na registratie op t₁:

| id | persoon_id | naam | aanvang | einde | opvoer | afvoer |
|----|-----------|------|---------|-------|--------|--------|
| 1 | 100 | Jansen | 2020-01-01 | null | t₁ | null |

#### Gescheiden patroon

`registratie`: `{id=1, type=registratie, tijdstip=t₁}`
`wijziging`: opvoer persoon, opvoer hub rel_id=1, opvoer data versie=1, opvoer aanvang versie=1

| tabel | persoon_id | rel_id | versie | waarde | opvoer* | afvoer* |
|-------|-----------|--------|--------|--------|---------|---------|
| hub | 100 | 1 | — | — | t₁ | null |
| data | 100 | 1 | 1 | Jansen | t₁ | null |
| aanvang | 100 | 1 | 1 | 2020-01-01 | t₁ | null |

**Conclusie**: Beide modellen werken correct. ✅ / ✅

---

### 3.2 Inhoudelijke correctie

**Situatie**: Op t₂ wordt de naam gecorrigeerd van "Jansen" naar "Janssen" (schrijffout).

#### Plat patroon

| id | persoon_id | naam | aanvang | einde | opvoer | afvoer |
|----|-----------|------|---------|-------|--------|--------|
| 1 | 100 | Jansen | 2020-01-01 | null | t₁ | **t₂** |
| 2 | 100 | **Janssen** | 2020-01-01 | null | **t₂** | null |

Het oude record (id=1) wordt afgevoerd, een volledig nieuw record (id=2) wordt opgevoerd. Let op: `aanvang` en `einde` worden gedupliceerd, ook al zijn ze niet gewijzigd.

#### Gescheiden patroon

`registratie`: `{id=2, type=correctie, corrigeert=1, tijdstip=t₂}`

| tabel | persoon_id | rel_id | versie | waarde | opvoer* | afvoer* |
|-------|-----------|--------|--------|--------|---------|---------|
| hub | 100 | 1 | — | — | t₁ | null |
| data | 100 | 1 | 1 | Jansen | t₁ | **t₂** |
| data | 100 | 1 | **2** | **Janssen** | **t₂** | null |
| aanvang | 100 | 1 | 1 | 2020-01-01 | t₁ | null |

De hub (identiteit) en de aanvang (materiële tijd) zijn ongewijzigd. Alleen de _data krijgt een nieuwe versie.

**Observaties**:
- **Plat**: dupliceert aanvang/einde bij elke inhoudscorrectie, ook als die niet wijzigen
- **Gescheiden**: wijzigt alleen wat daadwerkelijk verandert
- **Plat**: rij-id verandert (1 → 2), waardoor FK-verwijzingen uit andere tabellen breken
- **Gescheiden**: hub rel_id=1 blijft stabiel — referentieintegriteit behouden

**Conclusie**: Plat werkt ✅ maar met datavervuiling en identiteitsverlies. Gescheiden ✅ zonder bijeffecten.

---

### 3.3 Correctie van alleen materiële tijd

**Situatie**: Op t₃ blijkt dat de aanvang niet 2020-01-01 maar 2019-06-15 moet zijn.

#### Plat patroon

| id | persoon_id | naam | aanvang | einde | opvoer | afvoer |
|----|-----------|------|---------|-------|--------|--------|
| 1 | 100 | Jansen | 2020-01-01 | null | t₁ | t₂ |
| 2 | 100 | Janssen | 2020-01-01 | null | t₂ | **t₃** |
| 3 | 100 | **Janssen** | **2019-06-15** | null | **t₃** | null |

De volledige inhoud ("Janssen") wordt opnieuw gedupliceerd in rij 3, puur om de datum te wijzigen.

#### Gescheiden patroon

| tabel | persoon_id | rel_id | versie | waarde | opvoer* | afvoer* |
|-------|-----------|--------|--------|--------|---------|---------|
| hub | 100 | 1 | — | — | t₁ | null |
| data | 100 | 1 | 1 | Jansen | t₁ | t₂ |
| data | 100 | 1 | 2 | Janssen | t₂ | null |
| aanvang | 100 | 1 | 1 | 2020-01-01 | t₁ | **t₃** |
| aanvang | 100 | 1 | **2** | **2019-06-15** | **t₃** | null |

Alleen de aanvang-tabel krijgt een nieuwe versie. Data en hub onaangetast.

**Probleem plat model**: Stel de naam heeft 15 velden (naam, voorletters, titel, geboorteland, etc.). Bij een datumcorrectie worden alle 15 velden gekopieerd. Bij een tabel met 50 kolommen dupliceer je 50 waarden om één datum te wijzigen.

**Conclusie**: Plat ✅ maar met significante dataredundantie. Gescheiden ✅ chirurgisch precies.

---

### 3.4 Ongedaanmaking (undo) — hier gaat het fout

**Situatie**: De correctie van t₂ (naam "Jansen" → "Janssen") blijkt onterecht en moet ongedaan gemaakt worden op t₄.

#### Plat patroon — het dilemma

Na t₃ (vervolg van §3.3):

| id | persoon_id | naam | aanvang | einde | opvoer | afvoer |
|----|-----------|------|---------|-------|--------|--------|
| 1 | 100 | Jansen | 2020-01-01 | null | t₁ | t₂ |
| 2 | 100 | Janssen | 2020-01-01 | null | t₂ | t₃ |
| 3 | 100 | Janssen | 2019-06-15 | null | t₃ | null |

We willen de **correctie** van t₂ ongedaan maken. Maar let op: de datumcorrectie van t₃ willen we **behouden**. We willen terug naar "Jansen" met de gecorrigeerde aanvang.

**Poging A: afvoer terugdraaien op het origineel (rij 1)**

Stel we zetten `afvoer` van rij 1 terug naar `null`:

| id | persoon_id | naam | aanvang | einde | opvoer | afvoer |
|----|-----------|------|---------|-------|--------|--------|
| 1 | 100 | Jansen | 2020-01-01 | null | t₁ | **null** ← |
| 2 | 100 | Janssen | 2020-01-01 | null | t₂ | t₃ |
| 3 | 100 | Janssen | 2019-06-15 | null | t₃ | t₄ |

**Formeel tijdreizen naar t₂ < t < t₃**: `WHERE opvoer <= t AND (afvoer IS NULL OR afvoer > t)`
- Rij 1: opvoer=t₁ ✅, afvoer=null ✅ → **"Jansen" verschijnt** ← maar had afgevoerd moeten zijn op t₂!
- Rij 2: opvoer=t₂ ✅, afvoer=t₃ > t ✅ → **"Janssen" verschijnt ook**

⚠️ **FOUT**: Op tijdstip t₂ < t < t₃ zien we TWEE actieve namen. De formele tijdreis is corrupt.

**Poging B: nieuw kopie-record aanmaken**

| id | persoon_id | naam | aanvang | einde | opvoer | afvoer |
|----|-----------|------|---------|-------|--------|--------|
| 1 | 100 | Jansen | 2020-01-01 | null | t₁ | t₂ |
| 2 | 100 | Janssen | 2020-01-01 | null | t₂ | t₃ |
| 3 | 100 | Janssen | 2019-06-15 | null | t₃ | **t₄** |
| 4 | 100 | **Jansen** | **2019-06-15** | null | **t₄** | null |

Formeel tijdreizen:
- t₁ < t < t₂: rij 1 (Jansen, aanvang 2020-01-01) ✅
- t₂ < t < t₃: rij 2 (Janssen, aanvang 2020-01-01) ✅
- t₃ < t < t₄: rij 3 (Janssen, aanvang 2019-06-15) ✅
- t > t₄: rij 4 (Jansen, aanvang 2019-06-15) ✅

Dit **werkt** technisch voor simpele queries. Maar er zijn serieuze problemen:

1. **Geen audit trail**: Rij 4 is structureel niet te onderscheiden van een nieuwe registratie. Er is geen link naar de ongedaanmaking.
2. **De aanvang 2019-06-15 in rij 4 is geconstrueerd**: we moesten handmatig de gecorrigeerde datum overnemen uit rij 3 en combineren met de originele naam uit rij 1. Dit vereist complexe business logic.
3. **Welke aanvang hoort bij de undo?** Als we t₂ ongedaan maken, is de aanvang dan die van rij 1 (2020-01-01, origineel) of die van rij 3 (2019-06-15, gecorrigeerde datum)? Dit is ambigu.
4. **Identiteitsverlies**: rij 4 heeft een nieuw id (4). Alle FK-verwijzingen naar rij 3 wijzen nu naar een afgevoerd record.

**Poging C: extra metadata-kolommen toevoegen**

Sommige implementaties voegen kolommen toe als `correctie_van_id`, `ongedaangemaakt_door_id`, etc. Maar dan bouw je de facto een primitieve versie van het wijzigingen-model bovenop het platte model — met meer complexiteit en minder samenhang.

#### Gescheiden patroon

`registratie`: `{id=4, type=ongedaanmaking, maakt_ongedaan=2, tijdstip=t₄}`

Wijzigingen van registratie 2 (de correctie) worden omgekeerd:
- De afvoer van data versie 1 wordt teruggedraaid
- De opvoer van data versie 2 wordt teruggedraaid

| tabel | persoon_id | rel_id | versie | waarde | opvoer* | afvoer* |
|-------|-----------|--------|--------|--------|---------|---------|
| hub | 100 | 1 | — | — | t₁ | null |
| data | 100 | 1 | 1 | **Jansen** | t₁ | **null** ← hersteld |
| data | 100 | 1 | 2 | Janssen | t₂ | **t₄** ← omgekeerd |
| aanvang | 100 | 1 | 1 | 2020-01-01 | t₁ | t₃ |
| aanvang | 100 | 1 | 2 | 2019-06-15 | t₃ | null |

De ongedaanmaking betreft **alleen** de naamswijziging (registratie 2). De datumcorrectie (registratie 3) blijft intact. Het resultaat:
- Actuele naam: "Jansen" (hersteld) ✅
- Actuele aanvang: 2019-06-15 (behouden) ✅
- Hub rel_id=1: stabiel ✅
- Audit trail: registratie 4 → maakt_ongedaan → registratie 2: volledig traceerbaar ✅

**Maar wacht — werkt de formele tijdreis nog correct?**

Ja, want formeel tijdreizen in het gescheiden model gebruikt de **wijzigingen-tabel**, niet de afgeleide opvoer/afvoer:

| Query: formele toestand op t | Wijzigingen verwerkt t/m t | Resultaat |
|-----|------|------|
| t₁ < t < t₂ | Reg 1 | naam="Jansen", aanvang=2020-01-01 |
| t₂ < t < t₃ | Reg 1+2 | naam="Janssen", aanvang=2020-01-01 |
| t₃ < t < t₄ | Reg 1+2+3 | naam="Janssen", aanvang=2019-06-15 |
| t > t₄ | Reg 1+2+3+4 | naam="Jansen", aanvang=2019-06-15 |

Elke tijdreis reconstrueert de staat door alle wijzigingen tot t te verwerken. Volledig consistent. ✅

**Conclusie scenario 3.4**: 
- **Plat**: ⚠️ Poging A: corrupt. Poging B: werkt technisch maar met informatieverlies en ambiguïteit. Poging C: herbouw van het gescheiden model.
- **Gescheiden**: ✅ Schoon, traceerbaar, geen dataverlies.

---

### 3.5 Ongedaanmaking van een ongedaanmaking

**Situatie**: Op t₅ moet de ongedaanmaking van t₄ zelf ongedaan gemaakt worden (de correctie was toch juist).

#### Plat patroon

Na §3.4 (poging B):

| id | naam | aanvang | opvoer | afvoer |
|----|------|---------|--------|--------|
| 1 | Jansen | 2020-01-01 | t₁ | t₂ |
| 2 | Janssen | 2020-01-01 | t₂ | t₃ |
| 3 | Janssen | 2019-06-15 | t₃ | t₄ |
| 4 | Jansen | 2019-06-15 | t₄ | **t₅** |
| 5 | **Janssen** | **2019-06-15** | **t₅** | null |

Weer een kopie. Rij 5 is niet te onderscheiden van een derde registratie. 
Totaal: **5 rijen** voor wat logisch gezien één naam is.

Wat als we dit nóg een keer ongedaan maken (t₆)? Dan 6 rijen. En zo door. Elke undo/redo voegt een volledige kopie toe.

#### Gescheiden patroon

`registratie`: `{id=5, type=ongedaanmaking, maakt_ongedaan=4, tijdstip=t₅}`

De wijzigingen van registratie 4 worden omgekeerd:
- Data versie 1: opvoer teruggedraaid (was hersteld door reg 4) → opvoer=t₁, afvoer=t₂ (terug naar afgevoerd)
- Data versie 2: afvoer teruggedraaid (was afgevoerd door reg 4) → opvoer=t₂, afvoer=null (terug naar actief)

| tabel | rel_id | versie | waarde | opvoer* | afvoer* |
|-------|--------|--------|--------|---------|---------|
| data | 1 | 1 | Jansen | t₁ | t₂ |
| data | 1 | 2 | Janssen | t₂ | null ← hersteld |
| aanvang | 1 | 1 | 2020-01-01 | t₁ | t₃ |
| aanvang | 1 | 2 | 2019-06-15 | t₃ | null |

Nog steeds slechts 2 data-versies en 2 aanvang-versies. Geen datacreatie, geen kopieën. Audit trail: reg 5 → maakt_ongedaan → reg 4 → maakt_ongedaan → reg 2.

**Conclusie**: Plat ⚠️ explosieve datagroei bij herhaalde undo/redo. Gescheiden ✅ constant datavolume.

---

### 3.6 Complexe registratie met meerdere gegevenselementen

**Situatie**: Op t₁ wordt een persoon geregistreerd met naam="Jansen" en adres="Amsterdam". Op t₂ worden **beide** gecorrigeerd in één registratie: naam→"Janssen", adres→"Rotterdam". Op t₃ willen we **alleen de naamswijziging** ongedaan maken.

#### Plat patroon

Na t₂:

| tabel | id | waarde | aanvang | opvoer | afvoer |
|-------|-----|--------|---------|--------|--------|
| naam | 1 | Jansen | 2020-01-01 | t₁ | t₂ |
| naam | 2 | Janssen | 2020-01-01 | t₂ | null |
| adres | 1 | Amsterdam | 2020-01-01 | t₁ | t₂ |
| adres | 2 | Rotterdam | 2020-01-01 | t₂ | null |

**Probleem**: Registratie t₂ is niet gestructureerd als een atomaire eenheid. Het is gewoon "4 rijen die toevallig op hetzelfde tijdstip zijn gewijzigd". 

**Hoe maak je nu alleen de naamcorrectie ongedaan?**

In het platte model is er geen concept van "de registratie van t₂ bevatte twee wijzigingen: eentje op naam, eentje op adres". Je kunt niet zeggen "maak de naamwijziging van registratie X ongedaan" — want er is geen registratie X.

Je zou moeten:
1. Handmatig bepalen welke rijen deel uitmaakten van "de actie op t₂"
2. Per rij besluiten of je die wilt ongedaan maken
3. Per rij de juiste kopie aanmaken

Dit is foutgevoelig en niet automatiseerbaar zonder aanvullende metadata.

#### Gescheiden patroon

`registratie 2`: `{type=correctie, tijdstip=t₂}`
- wijziging 2a: afvoer naam_data versie 1
- wijziging 2b: opvoer naam_data versie 2 (Janssen)
- wijziging 2c: afvoer adres_data versie 1
- wijziging 2d: opvoer adres_data versie 2 (Rotterdam)

**Gedeeltelijke ongedaanmaking op t₃**: een nieuwe registratie die alleen wijzigingen 2a en 2b omkeert.

`registratie 3`: `{type=ongedaanmaking, maakt_ongedaan=2, tijdstip=t₃}`
- Alleen de wijzigingen die betrekking hebben op `naam_data` worden omgekeerd
- Wijzigingen op `adres_data` blijven intact

Resultaat: naam="Jansen" (hersteld), adres="Rotterdam" (behouden). Volledig traceerbaar welke delen van registratie 2 zijn ongedaan gemaakt en welke niet.

**Conclusie**: Plat ⚠️ geen atomaire registratie, handmatig cherry-picken nodig. Gescheiden ✅ granulaire ongedaanmaking op wijzigingsniveau.

---

### 3.7 Materieel tijdreizen met correcties

**Situatie**: Persoon heeft twee namen:
- "Jansen" geldig van 01-01-2000 t/m 31-12-2019
- "De Vries" geldig vanaf 01-01-2020

Op t₂ wordt de einddatum van "Jansen" gecorrigeerd naar 30-06-2019, en de aanvang van "De Vries" naar 01-07-2019.

**Vraag**: Wat was de naam op materieel tijdstip 15-09-2019?

#### Plat patroon

Na correctie:

| id | naam | aanvang | einde | opvoer | afvoer |
|----|------|---------|-------|--------|--------|
| 1 | Jansen | 2000-01-01 | 2019-12-31 | t₁ | t₂ |
| 2 | De Vries | 2020-01-01 | null | t₁ | t₂ |
| 3 | Jansen | 2000-01-01 | **2019-06-30** | t₂ | null |
| 4 | De Vries | **2019-07-01** | null | t₂ | null |

Query op materieel tijdstip 15-09-2019 (actuele formele stand):
`WHERE aanvang <= '2019-09-15' AND (einde IS NULL OR einde > '2019-09-15') AND afvoer IS NULL`

- Rij 3: aanvang=2000-01-01 ✅, einde=2019-06-30 → 2019-06-30 < 2019-09-15 → **uitgesloten**
- Rij 4: aanvang=2019-07-01 ✅, einde=null ✅ → **"De Vries"** ✅

**Nu combineer formeel EN materieel**: wat was op formeel tijdstip t₁ < t < t₂ de naam op materieel tijdstip 15-09-2019?

`WHERE opvoer <= t AND (afvoer IS NULL OR afvoer > t) AND aanvang <= '2019-09-15' AND (einde IS NULL OR einde > '2019-09-15')`

- Rij 1: opvoer=t₁ ✅, afvoer=t₂ > t ✅, aanvang=2000-01-01 ✅, einde=2019-12-31 > 2019-09-15 ✅ → **"Jansen"** ✅
- Rij 2: opvoer=t₁ ✅, afvoer=t₂ > t ✅, aanvang=2020-01-01 > 2019-09-15 → **uitgesloten** ✅

Dit werkt. ✅

#### Gescheiden patroon

Formeel + materieel tijdreizen naar t₁ < t < t₂, materieel 15-09-2019:
1. Verwerk wijzigingen t/m t → **alleen registratie 1** verwerkt. Aanvang hub 1: 2000-01-01, einde hub 1: 2019-12-31.
2. Filter materieel: 2000-01-01 ≤ 2019-09-15 ≤ 2019-12-31 → hub 1 ("Jansen") ✅

Dit werkt ook. ✅

**Maar**: het gescheiden model kan hier ook antwoorden op: "Wat is er precies gewijzigd in de datumcorrectie?" → Registratie 2, wijzigingen: einde versie 2, aanvang versie 2. In het platte model moet je rij 1 vs 3 en rij 2 vs 4 vergelijken om dat af te leiden — en dat vereist heuristieken (matching op persoon_id + naam).

---

### 3.8 Parallelle wijzigingen (race condition)

**Situatie**: Twee medewerkers doen tegelijkertijd een correctie op dezelfde naam.

#### Plat patroon

Medewerker A op t₂: naam → "Janssen" (correctie spelling)
Medewerker B op t₂ + ε: naam → "Jansen-De Vries" (correctie na huwelijk)

Beiden lezen de actuele rij (id=1, "Jansen") en maken een correctie:

| id | naam | opvoer | afvoer |
|----|------|--------|--------|
| 1 | Jansen | t₁ | t₂ |
| 2 | Janssen | t₂ | t₂+ε |
| 3 | Jansen-De Vries | t₂+ε | null |

Met optimistic locking (check afvoer IS NULL bij update) wordt conflict gedetecteerd. Maar: medewerker B's correctie overschrijft A's correctie volledig. Er is geen spoor meer dat A ooit "Janssen" als correctie heeft ingediend, behalve de rij met opvoer=t₂ en afvoer=t₂+ε.

#### Gescheiden patroon

Elke medewerker creëert een eigen registratie:
- Reg 2: correctie, tijdstip=t₂, wijziging=opvoer data versie 2 "Janssen"
- Reg 3: correctie, tijdstip=t₂+ε, wijziging=opvoer data versie 3 "Jansen-De Vries"

Beide registraties zijn volledige audit-records met request body, response, medewerker-info. Bij review kan registratie 2 eventueel ongedaan gemaakt worden als die overbodig was.

---

## 4. Samenvattende vergelijking

| Aspect | Plat patroon | Gescheiden patroon |
|--------|-------------|-------------------|
| **Eenvoudige registratie** | ✅ Werkt | ✅ Werkt |
| **Eenvoudige correctie** | ✅ Werkt (met datadupliceering) | ✅ Werkt (chirurgisch) |
| **Datum-only correctie** | ⚠️ Hele rij gekopieerd | ✅ Alleen aanvang/einde-versie |
| **Ongedaanmaking** | ⚠️ Kopie nodig; geen audit trail; ambiguïteit bij gecombineerde correcties | ✅ Wijzigingen omgekeerd; volledig traceerbaar |
| **Undo van undo** | ⚠️ Explosieve datagroei, kopie op kopie | ✅ Constant datavolume |
| **Gedeeltelijke undo** | ❌ Geen concept van atomaire registratie | ✅ Granulaire undo per wijziging |
| **Formeel tijdreizen** | ✅ Werkt voor simpele gevallen | ✅ Werkt altijd (replay wijzigingen) |
| **Formeel tijdreizen + undo** | ⚠️ Werkt met kopieën, maar geen structurele trace | ✅ Exact reproduceerbaar |
| **Materieel tijdreizen** | ✅ Werkt | ✅ Werkt |
| **Gecombineerd tijdreizen** | ✅ Werkt (filter op 4 kolommen) | ✅ Werkt (replay + filter) |
| **Identiteitsstabiliteit** | ❌ Rij-id verandert bij elke correctie | ✅ Hub rel_id blijft stabiel |
| **FK-integriteit** | ❌ Verwijzingen breken bij correctie | ✅ Hub als stabiel ankerpunt |
| **Dataredundantie** | ❌ Hele rij gekopieerd bij elke wijziging | ✅ Alleen gewijzigde laag |
| **Audit trail** | ⚠️ Alleen afleidbaar uit opvoer/afvoer-patronen | ✅ Expliciet: registratie → wijzigingen |
| **Atomaire registratie** | ❌ Niet ondersteund zonder extra tabel | ✅ Native concept |
| **Cross-register tijdreizen** | ❌ Niet mogelijk (geen gedeeld registratiemoment) | ✅ Gedeeld formeel tijdstip via registratie |
| **Queryeenvoud actuele stand** | ✅ `WHERE afvoer IS NULL` | ✅ `WHERE afvoer IS NULL` (afgeleide velden) |
| **Queryeenvoud tijdreis** | ✅ Eenvoudige WHERE-clause | ⚠️ Complexer (wijzigingen-replay of view) |
| **Schema-eenvoud** | ✅ Eén tabel per type | ⚠️ Meerdere tabellen per type (hub + data + aanvang + einde) |
| **Implementatiecomplexiteit** | ✅ Laag | ⚠️ Hoger (MetaRegistry, generieke handlers) |

---

## 5. Conclusie

### Waar het platte model ontoereikend is

1. **Ongedaanmaking**: het fundamentele probleem is dat opvoer/afvoer in het platte model **mutueel exclusief** zijn met de oorspronkelijke waarden. Je kunt een afvoer niet terugdraaien zonder de formele tijdreis te corrumperen, en kopieën creëren informatieverlies.

2. **Gedeeltelijke ongedaanmaking**: zonder een expliciet registratieconcept is het onmogelijk om te bepalen welke rijen bij dezelfde formele handeling hoorden, laat staan om een subset daarvan ongedaan te maken.

3. **Identiteit en referentiële integriteit**: bij elke correctie verandert het fysieke rij-id, waardoor FK-verwijzingen breken en "dezelfde naam" structureel een ander record wordt.

4. **Gescheiden correctie van inhoud vs. geldigheid**: het platte model kan niet onderscheiden of een correctie de inhoud, de materiële tijd, of beide betrof — want alles zit in dezelfde rij.

### Waar het platte model volstaat

- **Eenvoudige CRUD** zonder ongedaanmaking of complexe correcties
- Systemen waar correcties altijd **voorwaarts** gaan (nooit undo)
- Situaties waar de **actuele stand** het enige is wat belangrijk is
- Systemen met lage **auditeis**: als niemand zich afvraagt *waarom* iets is gewijzigd

### Hoe het gescheiden model deze problemen oplost

Het gescheiden model maakt een architecturele scheiding die het platte model niet kent:

```
               PLAT                              GESCHEIDEN
         ┌──────────────┐              ┌─────────────────────────────┐
   rij:  │ inhoud       │              │ registratie                 │
         │ aanvang      │              │   └─ wijzigingen[]          │
         │ einde        │              │        └─ type (op/afvoer)  │
         │ opvoer       │              │        └─ representatie     │
         │ afvoer       │              │                             │
         └──────────────┘              │ hub (stabiele identiteit)   │
                                       │   └─ _data (inhoud)        │
                                       │   └─ _aanvang (geldigheid) │
                                       │   └─ _einde (geldigheid)   │
                                       │                             │
                                       │ opvoer/afvoer = AFGELEID   │
                                       └─────────────────────────────┘
```

De kernprincipes:

1. **Bron van waarheid voor formele tijd = wijzigingen-tabel**, niet de data zelf
2. **Opvoer/afvoer in records = afgeleide waarden** voor de actuele stand
3. **Identiteit (hub) is ontkoppeld van inhoud (data) en geldigheid (aanvang/einde)**
4. **Elke registratie is een atomaire, getraceerde formele handeling**

Dit maakt het mogelijk om **elke willekeurige combinatie** van registratie, correctie, ongedaanmaking en tijdreis foutloos en reproduceerbaar uit te voeren — iets wat het platte model structureel niet kan.
