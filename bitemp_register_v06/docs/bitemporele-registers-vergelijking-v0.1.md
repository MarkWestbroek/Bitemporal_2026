# Bitemporele Registers — Vergelijking Extreem Genormaliseerd (v06) vs. Ouderwetse Één-Tabel Aanpak

> v0.1 — 2025-06-15

## Samenvatting van de twee benaderingen

### Ouderwetse aanpak (gedenormaliseerd)

Eén tabel (of entiteit-tabel + data-tabel) waarin elke rij **alle** tijdsdimensies bevat:

| ent_id | voornaam | achternaam | aanvang | einde | opvoer | afvoer |
|--------|----------|------------|---------|-------|--------|--------|

Elke wijziging — of het nu om inhoud, aanvangsdatum, of einddatum gaat — produceert een **volledig nieuwe rij** met alle velden, en de oude rij wordt afgevoerd.

### v06 aanpak (extreem genormaliseerd)

Gesplitst in onafhankelijke lagen:

```
Registratie (formeel tijdstip)
  └─ Wijziging (wat is er gewijzigd?)
       └─ Representatie (opvoer/afvoer van specifieke records)

Entiteit = de basis waar alles aan hangt, zonder gegevens: die zitten in gegevenselementen (GE's)
           en/of Relaties (RELs, een speciaal soort GE)
Indien een materiële entiteit: de tabellen Entiteit_Aanvang en Entiteit_Einde

Entiteit_GE_Hub     ← stabiel anker voor het GE, FK naar ENT, afgeleide opvoer/afvoer
Entiteit_GE_Data    ← 1..* versie(s) van inhoudelijke velden (versie 1, 2, 3...), afgeleide opvoer/afvoer
Entiteit_GE_Aanvang ← 0..* versie(s) van materiële aanvang (versie 1, 2, 3...), afgeleide opvoer/afvoer.
                       Alleen indien een materieel GE
Entiteit_GE_Einde   ← 0..* versie(s) van materiële einde (versie 1, 2, 3...), afgeleide opvoer/afvoer.
                       Alleen indien een materieel GE
```

---

## Waar de ouderwetse aanpak je gaat bijten

### 1. 🐛 Corrigeren van één enkel temporeel aspect is onmogelijk zonder data-duplicatie

**Situatie**: Je wilt alleen de `aanvang` corrigeren van 2024-01-01 naar 2024-03-01. De naam en andere gegevens kloppen wél.

**Ouderwets**: Je moet een volledig nieuwe rij aanmaken met **alle** velden gekopieerd, alleen om één datum aan te passen. Bij een entiteit met 50+ velden is dat 49 velden onnodig dupliceren. Foutgevoelig — je kunt per ongeluk een ander veld meeschrijven.

**v06**: Je registreert alleen een nieuwe versie in `NP_Naam_Aanvang`. De `NP_Naam_Data` en `NP_Naam_Einde` tabellen blijven onaangeroerd. Minimaal, precies, veilig.

---

### 2. 🐛 Ongedaan maken is grof geschut

**Situatie**: Een registratie voerde zowel een naamswijziging als een aanvangsdatumwijziging door. Later blijkt de naamswijziging onterecht, maar de aanvangsdatumcorrectie was wél juist.

**Ouderwets**: Omdat alles in één rij zit, kun je niet selectief ongedaan maken. Je moet de hele rij terugdraaien, en daarna handmatig de wél correcte wijziging opnieuw doorvoeren. Dit is complex, foutgevoelig, en de audittrail raakt vervuild.

**v06**: De registratie bevat twee afzonderlijke wijzigingen. Je maakt alleen de naamswijziging ongedaan. De aanvangsdatumcorrectie blijft intact. Schoon, traceerbaar, audit-proof.

---

### 3. 🐛 Gelijktijdige correcties conflicteren op rij-niveau

**Situatie**: Medewerker A corrigeert de achternaam (tikfout). Medewerker B corrigeert tegelijkertijd de einddatum (verlenging). Beide wijzigingen zijn onafhankelijk van elkaar.

**Ouderwets**: Beide correcties willen een nieuwe rij schrijven in dezelfde tabel, gebaseerd op dezelfde vorige rij. Dit leidt tot een **race condition** of lost-write probleem. Je moet locks of optimistic concurrency op de hele entiteit toepassen.

**v06**: Medewerker A schrijft in `NP_Naam_Data`, medewerker B schrijft in `NP_Naam_Einde`. Geen conflict. Geen lock-contention. Volledig onafhankelijk.

---

### 4. 🐛 Tijdsreizen wordt een WHERE-nachtmerrie

**Situatie**: "Geef mij de toestand van deze entiteit zoals die formeel gold op 2024-06-01, maar dan materieel bekeken op 2025-01-01."

**Ouderwets**: Je moet filteren op 4 tijdsvelden in één tabel:

```sql
WHERE opvoer <= '2024-06-01' 
  AND (afvoer IS NULL OR afvoer > '2024-06-01')
  AND aanvang <= '2025-01-01'
  AND (einde IS NULL OR einde > '2025-01-01')
```

Dit is traag, query-plans zijn onvoorspelbaar, en de logica is foutgevoelig bij NULL-semantiek. Elke query moet deze 4-weg filtering herhalen.

**v06**: Formeel en materieel tijdreizen zijn gescheiden operaties. De afgeleide `opvoer`/`afvoer` op de GE-hub geeft je direct de actuele formele situatie. Materieel filteren gebeurt alleen op de relevante `GE_Aanvang`/`GE_Einde` tabellen.

---

### 5. 🐛 De audittrail verliest semantiek

**Situatie**: Je kijkt naar de historie van een entiteit en ziet 15 rijen. Welke wijziging was een inhoudelijke correctie? Welke was een temporele correctie? Welke was een ongedaanmaking?

**Ouderwets**: Alle rijen zien er hetzelfde uit. Je moet handmatig veld-voor-veld vergelijken (`diff`) om te begrijpen wat er gebeurd is. Er is geen concept van "dit was een correctie van alleen de aanvangsdatum".

**v06**: De `Registratie` → `Wijziging` keten geeft je expliciet: *wat* is er gebeurd, *wanneer* (formeel), *wie* heeft het gedaan, en *waarom*. Het type wijziging (opvoer/afvoer/correctie/ongedaanmaking) is expliciet. De audittrail is **zelfbeschrijvend**.

---

### 6. 🐛 Gedeeltelijke temporele geldigheid is onmogelijk

**Situatie**: Een persoon verhuist op 2024-06-01, maar zijn nieuwe telefoonnummer gaat pas in op 2024-07-01. Het oude adres vervalt op 2024-06-01, het oude telefoonnummer op 2024-07-01.

**Ouderwets**: Alle velden delen één `aanvang`/`einde` paar per rij. Je kunt niet modelleren dat het adres een andere materiële tijdlijn heeft dan het telefoonnummer. Je moet óf de tijdlijnen kunstmatig alignen (verkeerd), óf je moet de entiteit opsplitsen in aparte tabellen (en dan ben je alsnog aan het normaliseren).

**v06**: `Adres_Data` en `Telefoon_Data` zijn onafhankelijke GE's met elk hun eigen `_Aanvang`/`_Einde` op hub-niveau. Elke GE heeft zijn eigen materiële tijdlijn. Precies zoals de werkelijkheid is.

---

### 7. 🐛 Formele tijd raakt vervuild met materiële correcties

**Situatie**: Je ontdekt op 2025-03-15 dat een aanvangsdatum uit 2023 foutief was geregistreerd. Je corrigeert dit.

**Ouderwets**: De formele `opvoer`/`afvoer` van de correctie-rij is 2025-03-15. Maar de rij bevat ook de materiële `aanvang` van 2023. Deze twee tijdsdimensies raken visueel en conceptueel vermengd in één rij. Het wordt moeilijk om puur formeel (wanneer is dit geregistreerd?) of puur materieel (wanneer geldt dit?) te redeneren.

**v06**: De `Registratie` draagt het formele tijdstip (2025-03-15). De `GE_Aanvang` tabel bevat de materiële tijdlijn. Deze twee dimensies zijn **fysiek gescheiden** in verschillende tabellen. Je kunt ze onafhankelijk bevragen, visualiseren, en controleren.

---

### 8. 🐛 Schaalproblemen bij veel temporele aspecten

**Situatie**: Een entiteit heeft 30 velden, materiële aanvang/einde, en kent gemiddeld 3 correcties en 2 temporele aanpassingen over zijn levensloop.

**Ouderwets**: Elke correctie = 1 volledige rij. Dat is $(3+2) \times 30 = 150$ velden aan opgeslagen data, waarvan 80% duplicaat is. Bij miljoenen entiteiten telt dit stevig door in opslag, I/O, en index-grootte.

**v06**: Een naamcorrectie raakt alleen `GE_Data` (30 velden × 1 extra versie). Een aanvangscorrectie raakt alleen `GE_Aanvang` (1 veld × 1 extra versie). Geen duplicatie van ongewijzigde velden. Opslag groeit lineair met het aantal wijzigingen, niet met (wijzigingen × velden).

---

### 9. 🐛 Schema-evolutie is risicovol

**Situatie**: Je voegt een nieuw veld `tussenvoegsel` toe aan een entiteit.

**Ouderwets**: `ALTER TABLE` op een grote tabel met bestaande historische rijen. Alle bestaande rijen moeten een NULL of default krijgen. Je moet voorzichtig zijn met de volgorde van kolommen, index-rebuilds, en mogelijke locking op productie.

**v06**: Het nieuwe veld komt in `GE_Data`. De `GE_Hub` blijft onaangeroerd. `GE_Aanvang` en `GE_Einde` blijven onaangeroerd. Alleen nieuwe `GE_Data` versies krijgen het veld. Bestaande historie blijft exact zoals die was. Geen risico op datacorruptie in niet-gerelateerde tijdsdimensies.

---

### 10. 🐛 Complexe correctieketens worden onnavolgbaar

**Situatie**: 
- Registratie R1: entiteit opgevoerd met naam "Jansen", aanvang 2024-01-01
- R2: naam gecorrigeerd naar "Janssen"  
- R3: aanvang gecorrigeerd naar 2024-02-01
- R4: R2 ongedaan gemaakt (naam terug naar "Jansen")
- R5: naam opnieuw gecorrigeerd naar "Janssen"

**Ouderwets**: Je hebt 5 rijen in één tabel. Om te reconstrueren wat er gebeurd is, moet je een keten van diffs maken. Welke rij hoort bij welke correctie? Was R4 een ongedaanmaking van R2 of van iets anders? De logica is impliciet en alleen te herleiden door rij-voor-rij vergelijking.

**v06**: Elke registratie is een expliciet record met een type. R4 verwijst naar R2 als "ongedaanmaking van". De audittrail vormt een **DAG** (directed acyclic graph) die je kunt visualiseren en bevragen. De correctiegeschiedenis is een eersteklas burger in het datamodel.

---

## Uitgewerkt voorbeeld: Item 10 — Complexe correctieketen

### Scenario

> Een natuurlijk persoon wordt geregistreerd, daarna gecorrigeerd, deels ongedaan gemaakt, en opnieuw gecorrigeerd.

| Registratie | Formeel tijdstip | Actie | Wat |
|-------------|-------------------|-------|-----|
| R1 | 2024-01-15 09:00 | Opvoer | Naam = "Jansen", Aanvang = 2024-01-01 |
| R2 | 2024-01-16 10:00 | Correctie | Naam corrigeren van "Jansen" → "Janssen" |
| R3 | 2024-01-17 11:00 | Correctie | Aanvang corrigeren van 2024-01-01 → 2024-02-01 |
| R4 | 2024-01-18 14:00 | Ongedaanmaking | R2 ongedaan maken (naam terug naar "Jansen") |
| R5 | 2024-01-19 15:00 | Correctie | Naam corrigeren van "Jansen" → "Janssen" (opnieuw) |

### Ouderwetse aanpak — één tabel `np_persoon`

Alle velden in één tabel. Elke actie → nieuwe rij met álle data gekopieerd.

| rij# | registratie | opvoer | afvoer | np_id | naam | aanvang | einde |
|------|-------------|--------|--------|-------|------|---------|-------|
| 1 | R1 | 2024-01-15 09:00 | 2024-01-16 10:00 | NP-1 | Jansen | 2024-01-01 | ∞ |
| 2 | R2 | 2024-01-16 10:00 | 2024-01-18 14:00 | NP-1 | **Janssen** ← gekopieerd: aanvang=2024-01-01 | 2024-01-01 | ∞ |
| 3 | R3 | 2024-01-17 11:00 | ∞ | NP-1 | Janssen ← gekopieerd: naam=Janssen | **2024-02-01** | ∞ |
| 4 | R4 | 2024-01-18 14:00 | 2024-01-19 15:00 | NP-1 | **Jansen** ← gekopieerd: aanvang=2024-02-01 | 2024-02-01 | ∞ |
| 5 | R5 | 2024-01-19 15:00 | ∞ | NP-1 | **Janssen** ← gekopieerd: aanvang=2024-02-01 | 2024-02-01 | ∞ |

**Wat hier misgaat**:
- Rij 2 kopieert `aanvang=2024-01-01` klakkeloos mee, ook al wijzigt die niet.
- Rij 3 kopieert `naam=Janssen` mee, ook al wijzigt die niet.
- Rij 4 zou eigenlijk alleen de naam moeten terugdraaien naar "Jansen" — maar in de praktijk kopieer je óók `aanvang=2024-02-01` mee. Je ziet niet dát R4 een *ongedaanmaking van R2* is; het lijkt alsof iemand handmatig de naam weer op "Jansen" zette.
- Rij 5 kopieert wéér `aanvang=2024-02-01` mee.
- 🔴 **Geen enkele rij legt vast wát er precies gewijzigd is.** Je moet elke rij met de vorige vergelijken om te snappen wat er gebeurde.

### v06 aanpak — genormaliseerd in Entiteit, Hub, _Data, _Aanvang, _Einde

Elke laag onafhankelijk geversioned. De entiteitstabel bevat alleen het ID. De GE's bevatten de data,
met Hub+_Data voor inhoud en optioneel _Aanvang/_Einde voor materiële aspecten.
Een registratie kan meerdere wijzigingen bevatten die elk precies één aspect raken.

#### NatuurlijkPersoon (entiteit — alleen ID)

| np_id | opvoer | afvoer |
|-------|--------|--------|
| NP-1 | 2024-01-15 09:00 | ∞ |

> De entiteitstabel bevat geen gegevens — alleen het bestaan van NP-1.

#### Registraties & Wijzigingen (audittrail)

| Registratie | Tijdstip | Type | Wijziging | Raakt | Verwijst naar |
|-------------|----------|------|-----------|-------|---------------|
| R1 | 2024-01-15 09:00 | opvoer | W1 | NP_Naam hub + NP_Naam_Data v1 + NP_Naam_Aanvang v1 | — |
| R2 | 2024-01-16 10:00 | correctie | W2 | NP_Naam_Data v2 (naam→Janssen) | — |
| R3 | 2024-01-17 11:00 | correctie | W3 | NP_Naam_Aanvang v2 (aanvang→2024-02-01) | — |
| R4 | 2024-01-18 14:00 | ongedaanmaking | W4 | NP_Naam_Data v2 afvoeren | W2 (R2) |
| R5 | 2024-01-19 15:00 | correctie | W5 | NP_Naam_Data v3 (naam→Janssen) | — |

#### NP_Naam (hub — stabiel anker, FK naar entiteit, afgeleide opvoer/afvoer)

| np_id | rel_id | opvoer | afvoer |
|-------|--------|--------|--------|
| NP-1 | 1 | 2024-01-15 09:00 | ∞ |

> **De hub bundelt alle informatie over één materieel gegeven.** In dit geval: de naam "Jansen"
> (of "Janssen", na correctie). Alle correcties (R2–R5) gebeuren *onder dezelfde hub* — we proberen
> alleen de registratie van ditzelfde feit goed te krijgen. De hub verandert daarbij niet.
>
> Een **echte naamswijziging** (bijv. door huwelijk naar "Janssen-de Vries") zou wél een
> **nieuwe hub** opleveren (`rel_id=2`). Zie Scenario 2 hieronder.

#### NP_Naam_Data (inhoudelijke velden, onafhankelijk van materiële tijd)

| np_id | rel_id | versie | naam | opvoer (afgeleid) | afvoer (afgeleid) | door registratie |
|-------|--------|--------|------|-------------------|-------------------|------------------|
| NP-1 | 1 | 1 | Jansen | 2024-01-15 09:00 | 2024-01-16 10:00 | R1 |
| NP-1 | 1 | 2 | Janssen | 2024-01-16 10:00 | 2024-01-18 14:00 | R2 |
| NP-1 | 1 | 3 | Jansen | 2024-01-18 14:00 | 2024-01-19 15:00 | R4 (ongedaanmaking R2) |
| NP-1 | 1 | 4 | Janssen | 2024-01-19 15:00 | ∞ | R5 |

> Alleen de naam wijzigt hier. Geen enkele aanvangsdatum wordt meegekopieerd.
> `rel_id=1` identificeert dit GE binnen NP-1 (relatieve autoincrement).

#### NP_Naam_Aanvang (materiële aanvang, onafhankelijk van data)

| np_id | versie | aanvang | opvoer (afgeleid) | afvoer (afgeleid) | door registratie |
|-------|--------|---------|-------------------|-------------------|------------------|
| NP-1 | 1 | 2024-01-01 | 2024-01-15 09:00 | 2024-01-17 11:00 | R1 |
| NP-1 | 2 | 2024-02-01 | 2024-01-17 11:00 | ∞ | R3 |

> Alleen de aanvangsdatum wijzigt hier. Geen naam wordt meegekopieerd. R4 en R5 raken deze tabel helemaal niet.
> NP_Naam_Einde is in dit voorbeeld niet gebruikt (de naam heeft geen materieel einde).

### Wat zie je in de v06-weergave dat je in de ouderwetse niet ziet?

| Inzicht | Ouderwets | v06 |
|---------|-----------|-----|
| Wat is er precies gewijzigd in R2? | ❌ Moet je uit diff halen | ✅ `NP_Naam_Data` v1→v2: naam "Jansen"→"Janssen" |
| Wat is er precies gewijzigd in R3? | ❌ Moet je uit diff halen | ✅ `NP_Naam_Aanvang` v1→v2: 2024-01-01→2024-02-01 |
| Is R4 een ongedaanmaking? Waarvan? | ❌ Lijkt op gewone correctie | ✅ Registratie type=ongedaanmaking, verwijst naar W2 (R2) |
| Welke data-versies zijn actief na R5? | ⚠️ Rij 5, maar je weet niet waarom | ✅ `NP_Naam_Data` v4 (actief), `NP_Naam_Aanvang` v2 (actief) — twee onafhankelijke lijnen |
| Hoeveel data is er daadwerkelijk geschreven? | 5 rijen × alle velden | 1 entiteit + 1 hub + 4 data + 2 aanvang = 8 smalle records, geen duplicatie |
| Kun je R4 ongedaan maken? | ❌ Onmogelijk — je kunt niet "de ongedaanmaking ongedaan maken" zonder de hele keten te reconstrueren | ✅ Registreer een ongedaanmaking van W4 — NP_Naam_Data v2 wordt hersteld |

---

## Scenario 2: Echte naamswijziging — correctie vs. werkelijkheid

### Situatie

NP-1 heet "Janssen" en is correct geregistreerd. Op 2024-06-01 trouwt de persoon en verandert
de achternaam daadwerkelijk naar "Janssen-de Vries". De registratie van deze wijziging gebeurt
op 2024-05-15 (vooruitgemeld).

Dit is een **echte materiële wijziging** — geen correctie van een fout, maar de wereld verandert.

> **BRP-context**: In de praktijk van de Basisregistratie Personen zou een huwelijk
> complexer geregistreerd worden — met een relatie (huwelijk/partnerschap), naamgebruik,
> en een partner-entiteit. Dit voorbeeld is vereenvoudigd om het principe van correctie
> vs. echte wijziging en hub-aanmaak te illustreren.

| Registratie | Formeel tijdstip | Actie | Wat |
|-------------|-------------------|-------|-----|
| R6 | 2024-05-15 09:00 | Wijziging | Naam wijzigen van "Janssen" → "Janssen-de Vries", aanvang 2024-06-01 |

### Ouderwetse aanpak — tabel `np_persoon`

| rij# | registratie | opvoer | afvoer | np_id | naam | aanvang | einde |
|------|-------------|--------|--------|-------|------|---------|-------|
| ... | ... | ... | ... | NP-1 | Jansen | 2024-01-01 | ∞ |
| 6 | R6 | 2024-05-15 09:00 | ∞ | NP-1 | **Janssen-de Vries** | **2024-06-01** | ∞ |

> 🔴 Rij 6 ziet er **precies hetzelfde uit** als een correctie (zoals R2 in Scenario 1).
> Je kunt met geen mogelijkheid zien of "Janssen-de Vries" een correctie van een tikfout is,
> of een echte naamswijziging door een huwelijk. Het onderscheid tussen "we maken een
> registratiefout goed" en "de werkelijkheid is veranderd" is **verdwenen**.

### v06 aanpak — nieuwe hub voor een nieuw feit

Omdat dit een echte wijziging is — het materiële feit "naam van NP-1" is veranderd —
krijgen we een **nieuw GE met een nieuwe hub** (`rel_id=2`). Het oude GE (`rel_id=1`)
wordt afgevoerd.

#### Registratie & Wijziging

| Registratie | Tijdstip | Type | Wijziging | Raakt | Verwijst naar |
|-------------|----------|------|-----------|-------|---------------|
| R6 | 2024-05-15 09:00 | wijziging | W6 | NP_Naam hub rel_id=1 afvoeren + NP_Naam hub rel_id=2 opvoeren | — |

#### NP_Naam (hub — nu twee GE's)

| np_id | rel_id | opvoer | afvoer |
|-------|--------|--------|--------|
| NP-1 | 1 | 2024-01-15 09:00 | **2024-05-15 09:00** |
| NP-1 | **2** | **2024-05-15 09:00** | ∞ |

> `rel_id=1` is afgevoerd — de naam "Janssen" is niet langer actueel.
> `rel_id=2` is het nieuwe GE voor de naam "Janssen-de Vries".

#### NP_Naam_Data (twee GE's, elk met eigen versiegeschiedenis)

| np_id | rel_id | versie | naam | opvoer | afvoer | door |
|-------|--------|--------|------|--------|--------|------|
| NP-1 | 1 | 4 | Janssen | 2024-01-19 15:00 | 2024-05-15 09:00 | R5 |
| NP-1 | **2** | **1** | **Janssen-de Vries** | **2024-05-15 09:00** | ∞ | R6 |

> De data van `rel_id=1` (incl. alle correcties R2–R5) blijft historisch bewaard.
> `rel_id=2` start een schone versiegeschiedenis — mocht daar later een tikfout in staan
> ("Janssen-de Vries" → "Janssen-de Vreis"), dan corrigeer je die ónder `rel_id=2`.

#### NP_Naam_Aanvang (eigen aanvang voor het nieuwe GE)

| np_id | versie | aanvang | opvoer | afvoer | door |
|-------|--------|---------|--------|--------|------|
| NP-1 | 2 | 2024-02-01 | 2024-01-17 11:00 | ∞ | R3 |
| NP-1 | **3** | **2024-06-01** | **2024-05-15 09:00** | ∞ | R6 |

> De aanvang van het *oude* GE (`rel_id=1`) was 2024-02-01 (gecorrigeerd in R3).
> De aanvang van het *nieuwe* GE (`rel_id=2`) is 2024-06-01 — de trouwdatum.
> Tussen 2024-02-01 en 2024-06-01 gold nog de oude naam "Janssen". Vanaf 2024-06-01
> geldt "Janssen-de Vries". ⚠️ Let op: de materiële aanvang leeft op **hub-niveau**,
> dus de `versie` in `NP_Naam_Aanvang` telt door over hubs heen — het is de
> entiteit-brede materiële tijdlijn.

### Wat zie je in v06 dat je in de ouderwetse niet ziet? (Scenario 2)

| Inzicht | Ouderwets | v06 |
|---------|-----------|-----|
| Was R6 een correctie of echte wijziging? | ❌ Geen enkel verschil zichtbaar | ✅ Nieuwe hub (`rel_id=2`) = echte wijziging. Correcties blijven onder dezelfde hub |
| Welke naam gold op 2024-05-01? | ⚠️ Rij met `opvoer ≤ 2024-05-01 < afvoer` — je moet rekenen | ✅ `rel_id=1` is actief tot 2024-05-15, dus "Janssen" |
| Welke naam geldt vanaf 2024-06-01? | ⚠️ Zelfde rekenwerk | ✅ `rel_id=2` met aanvang 2024-06-01: "Janssen-de Vries" |
| Hoeveel correcties had de oude naam? | ❌ Geen idee — alles is vlakke rijen | ✅ `NP_Naam_Data` voor `rel_id=1`: 4 versies (R1, R2, R4, R5) |
| Kun je de oude naam ooit nog corrigeren? | ❌ Nee — de actuele rij overschrijft alles | ✅ Ja — je kunt een correctie doen op `rel_id=1` `_Data` (bijv. een tikfout uit 2024 rechtzetten), en die wordt dan historisch correct weggeschreven zonder de actuele naam te raken |

---

## Conclusie

| Aspect | Ouderwets | v06 |
|--------|-----------|-----|
| Corrigeren één temporeel veld | hele rij dupliceren | alleen dat aspect |
| Selectief ongedaan maken | niet mogelijk zonder kunstgrepen | per wijziging |
| Correctie vs. echte wijziging | visueel identiek, ononderscheidbaar | correctie = zelfde hub; wijziging = nieuwe hub |
| Gelijktijdige correcties | lock-contention op hele entiteit | onafhankelijk per aspect |
| Tijdsreis-queries | 4-weg WHERE, traag | gescheiden, schoon |
| Audittrail | impliciet, diffs nodig | expliciet, zelfbeschrijvend |
| Deelaspecten met eigen tijdlijn | onmogelijk | per GE, native |
| Historische gegevens corrigeren | overschreven door actuele rij | oude hub + _Data blijft intact, correcties kunnen alsnog |
| Opslag bij veel correcties | O(wijzigingen × velden) | O(wijzigingen × gewijzigde velden) |
| Schema-evolutie | ALTER op grote historische tabel | geïsoleerd per aspect |

De ouderwetse aanpak werkt prima voor simpele CRUD met een vlakke tijdlijn. Maar zodra je **precisie** nodig hebt in je temporele administratie — en dat is precies waar een bitemporeel register voor dient — dan bijt de denormalisatie je op al deze punten. De v06-normalisatie is geen academische exercitie; het is de enabler voor **surgical precision** in registreren, corrigeren, en auditen.
