# Verschilanalyse: Referentie Architectuur Common Ground Registers vs. Bitemp Register v06

**Bron:** _Werkdocument Referentie Architectuur Common Ground Registers_ (concept, 9 februari 2026)  
**Vergelijking met:** Bitemp Register v06 (actieve ontwikkelversie)  
**Datum analyse:** 9 april 2026

---

## 1. Overzicht

De Referentie Architectuur Common Ground Registers (hierna: **RA-CG**) beschrijft een generiek patroon voor registers in het Common Ground landschap. Het bitemp register v06 (hierna: **v06**) is een proof of concept voor een bitemporeel register in Go/PostgreSQL. Beide richten zich op dezelfde probleemruimte — gestructureerde, auditeerbare gegevensopslag voor overheidsregisters — maar kiezen fundamenteel andere ontwerppatronen.

Deze analyse structureert de vergelijking in acht thema's:

1. [Datamodellering en objectstructuur](#2-datamodellering-en-objectstructuur)
2. [Wijzigingsbeheer en bitemporaliteit](#3-wijzigingsbeheer-en-bitemporaliteit)
3. [Metadata](#4-metadata)
4. [API-architectuur](#5-api-architectuur)
5. [Registratiemechanisme](#6-registratiemechanisme)
6. [Tijdreizen](#7-tijdreizen)
7. [Infrastructuur en technologie](#8-infrastructuur-en-technologie)
8. [Scope-onderwerpen buiten v06](#9-scope-onderwerpen-buiten-v06)

---

## 2. Datamodellering en objectstructuur

### RA-CG: Stable ID + State + Sub-objecten

De RA-CG hanteert een drielaags patroon per data-object:

| Laag | Functie | Kenmerk |
|------|---------|---------|
| **Stable ID tabel** | Immutable object-identiteit | Nooit verwijderbaar; integer of GUID |
| **State tabel** | Inhoudelijke attributen + wijzigingstijdstip(pen) | Elke mutatie creëert nieuwe state |
| **Sub-object tabellen** | Geneste structuren, koppeltabellen | FK naar state of stable ID |

- Wijzigingsdata (formeel/materieel) zit **in** de state-tabel als timestamps.
- Sub-objecten worden bij mutatie ofwel **mee gekopieerd** ofwel via koppeltabellen gedeeld.

### v06: Entiteit → Hub → _Data / _Aanvang / _Einde

v06 modelleert met drie **metatypes**:

| Metatype | Voorbeelden | Kenmerk |
|----------|-------------|---------|
| **Entiteit** | A, B | Eigen ID, bevat onderliggende GE's/relaties |
| **Gegevenselement** | A_U, A_V, A_W | FK naar entiteit, relatieve `rel_id` |
| **Relatie** | Rel_A_B | FK naar twee entiteiten, relatieve `rel_id` |

Sinds v06 is er een **hub + _Data-patroon**:
- De **hub** (bijv. `a_u`) is het stabiele identiteitsanker (vergelijkbaar met stable ID).
- **_Data** (bijv. `a_u_data`) bevat de geversioned inhoud.
- **_Aanvang** / **_Einde** zijn aparte, versioned GE-tabellen voor materiële tijd.

### Belangrijkste verschil

| Aspect | RA-CG | v06 |
|--------|-------|-----|
| Wijzigingstijdstip | In de state-tabel als kolom | **Niet in de datatabellen** — afgeleid uit wijzigingen-tabel |
| Materiele datum | Attribuut in state-tabel | Aparte GE-tabellen (_Aanvang, _Einde) met eigen versiegeschiedenis |
| Sub-objecten | Vrij te modelleren onder state | Geformaliseerd als gegevenselementen/relaties met eigen tabel |
| Granulariteit | Per data-object (grof) | Per gegevenselement (fijn): inhoud, aanvang en einde onafhankelijk versioneerbaar |

**Implicatie:** In v06 kun je een materiële datum corrigeren zonder de inhoud aan te raken, en vice versa. In RA-CG is dit alleen mogelijk als je de state kopieert met dezelfde inhoud maar andere timestamps.

---

## 3. Wijzigingsbeheer en bitemporaliteit

### RA-CG: Drie varianten wijzigingsbeheer

De RA-CG definieert drie varianten per data-object:

1. **Enkelvoudig zonder historie** — overschrijven, optioneel create/change timestamp  
2. **Formele wijzigingshistorie** — nieuwe state per wijziging met timestamp; correcties overschrijven oude entry  
3. **Formeel + materieel** — nieuwe state met zowel wijzigingstijdstip als effectieve datum; correcties op peildatum mogelijk

De keuze is **per data-object** een ontwerpkeuze.

### v06: Consequent bitemporeel

v06 hanteert **altijd** twee onafhankelijke tijdsdimensies:

| Dimensie | Implementatie | Opgeslagen in |
|----------|---------------|---------------|
| **Formele tijd** (registratietijd) | `tijdstip` op de registratie → doorvertaling naar wijzigingen | Registratie-tabel + Wijzigingen-tabel |
| **Materiële tijd** (geldigheidstijd) | `datum` in _Aanvang / _Einde | Aparte gegevenselement-tabellen |

Afgeleide velden `opvoer` en `afvoer` in de datatabellen zijn het **resultaat** van het afspelen van alle wijzigingen tot nu — niet de bron van waarheid.

### Kerninzichten

| Aspect | RA-CG | v06 |
|--------|-------|-----|
| Bitemporaliteit | Optioneel (variant 3) | **Altijd**, architectureel afgedwongen |
| Correcties | Overschrijven van bestaande state | Nieuwe versie + afvoer oude; audit trail intact |
| Formele tijd als bron | State timestamp IS de formele tijd | Formele tijd leeft in registratie+wijzigingen; nooit in datatabellen |
| Ongedaanmaking | Niet beschreven | Expliciet type (`Ongedaanmaking`) met cascade-logica |
| Verlies van historie bij correctie | Ja, bij variant 2 (overschrijven) | **Nee**: elke versie blijft bestaan, met eigen opvoer/afvoer |

**Implicatie:** RA-CG laat ruimte voor registers zonder volledige audit trail. v06 maakt dit architectureel onmogelijk: alle wijzigingen zijn altijd herleidbaar via registratie → wijziging → representatie.

---

## 4. Metadata

### RA-CG: Vijf niveaus metadata

| Niveau | Voorbeeld | Dynamisch? |
|--------|-----------|-----------|
| Register | Versienummers, configuratie | Statisch |
| Data-object | Variant, type (primair/stam/extern) | Statisch |
| Tabel | Functie (stable ID, state, sub-object) | Statisch |
| Veld | Functie (attribuut, referentie, MDM-type, AVG) | Statisch |
| Record | Per-instantie metadata | Dynamisch |

Statische metadata wordt vastgelegd in documentatie; optioneel via een metadata-API.

### v06: MetaRegistry als single source of truth

De MetaRegistry (`model/metaregistry.go`) is een **runtime datastructuur** die per type vastlegt:

- Metatype, domein, GE-subtype (hub/data/aanvang/einde)
- Tabelnaam, ID-kolommen, PFK-structuur
- Factory-functies voor ORM en input-binding
- Padnaam (URL-route), veldnaam (JSON-key)
- Onderliggende gegevenselementen met rolnaam en momentvoorkomen
- Afgeleide velden (CEL-expressies)

Aanvullend: een **schema-API** (`/schema/model`) exporteert alle metadata naar de frontend.

### Vergelijking

| Aspect | RA-CG | v06 |
|--------|-------|-----|
| Metadata-locatie | Documentatie + optioneel API | **Altijd runtime** in MetaRegistry + schema-API |
| MDM-classificatie | Golden Record / berekend / extern op veldniveau | Niet expliciet geïmplementeerd |
| AVG-classificatie | Doelbinding + normaal/bijzonder op object/veldniveau | Niet geïmplementeerd |
| Bewaartermijnen | Metadatering per data-object | Niet geïmplementeerd |
| Tabelrol | Expliciete functie (stable ID, state, sub-obj) | Impliciet via metatype + GE-subtype |
| Dynamische record-metadata | Als attribuut in DB | Niet specifiek; alle audit in registraties |

---

## 5. API-architectuur

### RA-CG: Per-type CRUD + Zoek + Bulk + Notificaties + Migratie

De RA-CG beschrijft vijf API-categorieën:

| Categorie | Doel | Kenmerken |
|-----------|------|-----------|
| **Taakapplicatie** | Zoek, Get, CRUD per data-object | Peildatum, historie/snapshot, correctie-modus, attribuutfilter, PBAC |
| **Bulk** | Grote data-ophaling voor analytics | Geplande uitvoering, lagere SLA |
| **Open Notificaties** | Mutatie-events publiceren/ontvangen | CG-standaard, synchroon extern |
| **Data migratie** | Import/export als JSON | Round-trip, optioneel |
| **Bestaande protocollen** | BRP, StUF, iWMO etc. | Backward compatibility |

Specifiek voor de Get-API: parameters `Peildatum`, `Historie (ja/nee)`, `Correctie (ja/nee)`, `Attribuutfilter`, `Anonimiseren/maskeren`.

### v06: Generieke dynamische REST + Registratie-endpoint

| Route | Functie | Dynamisch? |
|-------|---------|-----------|
| `GET /{padnaam}` | Lijst met paginering | Ja, uit MetaRegistry |
| `GET /{padnaam}/:id` | Enkel record | Ja |
| `POST /{padnaam}` | Direct insert | Ja |
| `GET /full/{padnaam}` | Entiteit + alle geneste GE's/relaties | Ja |
| `POST /registratie/` | Registratie met wijzigingen (opvoer/afvoer) | Vast endpoint |
| `GET /schema/model` | Schema-export per domein | Vast endpoint |

Tijdreizen: `?t=2024-01-01T12:00:00Z` op elke GET-route.

### Vergelijking

| Aspect | RA-CG | v06 |
|--------|-------|-----|
| API-stijl | Per-type specifieke CRUD calls | Generiek: één handler-factory per operatie |
| Route-registratie | Per data-object (handmatig of gegenereerd) | **Volledig dynamisch** uit MetaRegistry |
| Zoekfunctie | Uitgebreid: filtering op veldwaarden | Beperkt: ID-gebaseerd + paginering |
| Bulk opvragen | Aparte geoptimaliseerde API | Niet geïmplementeerd |
| Open Notificaties | Integraal onderdeel architectuur | Niet geïmplementeerd |
| Data migratie API | Optioneel, maar uitgewerkt | Niet geïmplementeerd |
| PBAC/RBAC | Ingebouwd als filter-laag op API | Autorisatie-module in ontwikkeling |
| Get-parameters | Peildatum, historie, correctie, filter, maskering | Formeel peiltijdstip (`?t=...`), geen correctie-modus |
| Bestaande protocollen (StUF, BRP) | Expliciet voorzien | Geen ondersteuning |
| GraphQL | Niet genoemd | Experimenteel in v06 via gqlgen |
| Schema-API | Optionele metadata-endpoint | **Centraal**: drijft de gehele frontend |

---

## 6. Registratiemechanisme

### RA-CG: Standaard CRUD per object

- **Create**: nieuw object + state + sub-objecten; ingangsdatum optioneel
- **Wijzig**: nieuw state-record bij bestaand object; wijzigingsdatum verplicht na laatste wijziging
- **Corrigeer**: selecteer bestaand state-record op wijzigingsdatum → overschrijf óf nieuw record met correctiedatum
- **Delete**: soft delete (einddatum) of hard delete (zonder historie)

Elke operatie is per individueel data-object. De volgorde van calls is belangrijk vanwege relationele afhankelijkheden.

### v06: Registratie als transactionele eenheid

Eén `POST /registratie/` call kan meerdere wijzigingen bevatten:

```
Registratie (tijdstip, type, opmerking)
  └─ Wijziging 1
  │    ├─ opvoer: A (id=1)
  │    └─ opvoer: A_U (a_id=1, rel_id=1)
  └─ Wijziging 2
       ├─ afvoer: A_V (a_id=1, rel_id=2)
       └─ opvoer: A_V (a_id=1, rel_id=3)
```

| Aspect | RA-CG | v06 |
|--------|-------|-----|
| Atomiciteit | Per CRUD-operatie per object | Per registratie: meerdere wijzigingen in één transactie |
| Correctie | Nieuw state met correctiedatum **of** overschrijven | Altijd nieuwe versie; origineel afgevoerd; registratie van type `Correctie` |
| Ongedaanmaking | Niet beschreven | Registratie van type `Ongedaanmaking`, keert alle wijzigingen van referentie-registratie om |
| Registratie als concept | Impliciet (individuele state-records) | **Expliciet**: registratie → wijzigingen → representaties als formele eenheid |

**Implicatie:** In v06 is een registratie de formele eenheid van vastlegging. Meerdere samenhangende wijzigingen worden atomair vastgelegd, wat de audit trail versterkt. In RA-CG zijn CRUD-calls onafhankelijk en kan de samenhang alleen door de taakapplicatie worden bewaakt.

---

## 7. Tijdreizen

### RA-CG: Peildatum + Historie/Correctie modes

De RA-CG biedt via de Get-API:
- **Peildatum** (materieel): "geef de data zoals geldig op dit moment"
- **Historie ja/nee**: volledig verloop vs. snapshot
- **Correctie ja/nee**: meest recente correctie vs. originele waarde op peildatum

Combinatie van deze drie vlaggen bepaalt het resultaat:

| Historie | Correctie | Resultaat |
|----------|-----------|-----------|
| Nee | Ja | Snapshot op peildatum, gecorrigeerd |
| Nee | Nee | Snapshot op peildatum, origineel |
| Ja | Ja | Volledige historie, altijd laatste correctie |
| Ja | Nee | Volledige historie inclusief correctie-momenten |

### v06: Twee onafhankelijke tijdassen

| Tijdsas | Parameter | Richting |
|---------|-----------|----------|
| **Formeel** | `?t=2024-01-01T12:00:00Z` | Alleen verleden: reconstructie door replay van wijzigingen tot tijdstip t |
| **Materieel** | `?aanvang=...&einde=...` | Verleden én toekomst: welke records zijn geldig op dat moment? |

### Vergelijking

| Aspect | RA-CG | v06 |
|--------|-------|-----|
| Formeel tijdreizen | Via peildatum + correctie-toggle | Via `?t=...`: replay alle wijzigingen tot t |
| Materieel tijdreizen | Via peildatum parameter | Via materiële parameters op aanvang/einde |
| Correctie-zichtbaarheid | Instelbaar (origineel vs. gecorrigeerd) | Altijd zichtbaar: alle versies blijven bestaan |
| Toekomstig materieel | Niet expliciet beschreven | Ondersteund: aanvang/einde kunnen in de toekomst liggen |
| Cross-register tijdreizen | Niet beschreven | Architectureel mogelijk: zelfde registratie-structuur over registers |

---

## 8. Infrastructuur en technologie

| Aspect | RA-CG | v06 |
|--------|-------|-----|
| **Taal** | Python scripts | **Go** (Gin + Bun) |
| **Database** | PostgreSQL (met extensies) | PostgreSQL (via Bun ORM) |
| **Deployment** | Docker/Kubernetes/Haven+ | Docker Compose (ontwikkelfase) |
| **Frontend** | Niet beschreven (taakapplicatie is apart) | React + Vite, schema-gedreven |
| **Authenticatie** | Keycloak + OIDC + RBAC/PBAC | In ontwikkeling |
| **Monitoring** | Open Telemetry (OTEL) verplicht | Niet geïmplementeerd |
| **API-protocol** | REST (OAS3) + JSON | REST (OAS3-achtig) + JSON; experimenteel GraphQL |
| **Netwerk** | FSC (Federatieve Service Connectiviteit) | Niet van toepassing (standalone PoC) |
| **Versioning** | REST API versioning vereist | Niet geïmplementeerd |
| **Back-up** | Cold + hot back-up voorgeschreven | Database-niveau (Docker volumes) |

---

## 9. Scope-onderwerpen buiten v06

De volgende RA-CG onderwerpen zijn (nog) niet geadresseerd in v06:

| Onderwerp | RA-CG | v06-status |
|-----------|-------|------------|
| **AVG-classificatie** | Doelbinding + normaal/bijzonder per veld | Niet geïmplementeerd |
| **Bewaartermijnen** | Metadata per data-object met grondslagen | Niet geïmplementeerd |
| **Master Data Management** | Golden Record / berekend / extern op veldniveau | Niet expliciet |
| **Open Notificaties** | Publicatie en abonnement op mutatie-events | Niet geïmplementeerd |
| **PBAC/RBAC** | Pre-API filtering | Module in ontwikkeling |
| **Bulk datavoorziening** | Aparte geoptimaliseerde API | Niet geïmplementeerd |
| **Data migratie** | Import/export round-trip | Niet geïmplementeerd |
| **Datakwaliteit platform** | Externe controle op samenhang registers | Niet geïmplementeerd |
| **Plusvelden** | Dynamisch declareerbare extra attributen | Niet geïmplementeerd |
| **Bestaande protocollen** | StUF, BRP, BAG, iWMO/iJG | Niet geïmplementeerd |
| **Externe data-objecten** | Synchronisatie externe attributen | Niet geïmplementeerd |
| **Persoonsgegevens-objecten** | Aparte objectstructuur voor AVG-compliance | Niet geïmplementeerd |

---

## 10. Samenvattend oordeel

### Waar v06 sterker is dan RA-CG

1. **Consequente bitemporaliteit**: v06 dwingt twee onafhankelijke tijdsdimensies architectureel af. RA-CG laat dit als optionele variant open, waardoor registers onderling incompatibel kunnen worden op het vlak van tijdreizen.

2. **Formele tijd buiten de data**: door opvoer/afvoer als afgeleide waarden te behandelen (bron = wijzigingen-tabel), is de audit trail onbreekbaar. In RA-CG is de formele tijd een kolom in de state-tabel, met risico op inconsistentie bij directe DB-mutaties.

3. **Granulaire correcties**: inhoud (_Data), materieel begin (_Aanvang) en materieel einde (_Einde) worden onafhankelijk geversioned. In RA-CG kan een correctie op een datum niet zonder de volledige state te kopiëren.

4. **Registratie als atomaire eenheid**: meerdere samenhangende wijzigingen worden in één transactie vastgelegd met audittrail. RA-CG beschrijft alleen individuele CRUD-calls.

5. **Schema-gedreven architectuur**: de MetaRegistry + schema-API drijft routes, handlers en frontend dynamisch. RA-CG noemt een optionele metadata-API maar beschrijft geen vergelijkbaar mechanisme.

### Waar RA-CG breder is dan v06

1. **Productie-readiness**: RBAC/PBAC, OTEL-monitoring, Keycloak-authenticatie, FSC-routering, Haven+-deployment zijn uitgewerkt. v06 is een PoC zonder deze lagen.

2. **Data-ecosysteem**: Open Notificaties, bulk voorziening, data migratie en datakwaliteitsplatform vormen een samenhangend geheel. v06 richt zich op het register zelf.

3. **AVG en archivering**: doelbinding, bewaartermijnen en persoonsgegevens-classificatie zijn gedetailleerd uitgewerkt. v06 heeft hier geen voorziening voor.

4. **Zoek- en filterfunctionaliteit**: RA-CG beschrijft uitgebreide zoekparameters (tekst, range, categorie, referentie). v06 biedt alleen ID-gebaseerde lookups en paginering.

5. **Interoperabiliteit**: ondersteuning voor bestaande protocollen (StUF, BRP, iWMO) en externe data-objecten met synchronisatie. v06 is standalone.

### Potentiële synergie

De v06-architectuur zou als **implementatiepatroon** kunnen dienen voor RA-CG-registers die variant 3 (formeel + materieel) kiezen. De MetaRegistry-gedreven aanpak zou de uniformiteitsdoelstelling van RA-CG kunnen realiseren: nieuwe registers opzetten door alleen metadata te definiëren, zonder nieuwe code.

Omgekeerd biedt RA-CG een roadmap voor de productierijping van v06: PBAC, Open Notificaties, bulk API, datakwaliteitscontroles en AVG-compliance zijn noodzakelijke uitbreidingen voor productiegebruik.

---

## Bijlage: Terminologie-mapping

| RA-CG term | v06 term | Toelichting |
|------------|----------|-------------|
| Data-object | Entiteit | Primair gegevensobject met eigen ID |
| State tabel | _Data tabel | Inhoudelijke attributen (geversioned) |
| Stable ID tabel | Hub / Entiteitstabel | Immutable identiteit |
| Sub-object | Gegevenselement / Relatie | Geneste structuur onder entiteit |
| Formele wijzigingsdatum | Registratie.Tijdstip | Moment van vastlegging |
| Materiële wijzigingsdatum | _Aanvang.Datum / _Einde.Datum | Geldigheidsdatum in werkelijkheid |
| Correctie | Correctie-registratie + afvoer/opvoer | Terug-in-de-tijd aanpassing |
| Peildatum | `?t=...` queryparameter | Formeel tijdreismoment |
| Koppeltabel | Relatie-hub + _Data | Meer-op-meer relatie met eigen versiegeschiedenis |
| Plusvelden | _(niet geïmplementeerd)_ | Dynamisch declareerbare extra attributen |
| Golden Record | _(niet expliciet)_ | Authentiek bronveld |
| Stamdata | Referentielijst | Categorische keuze-opties |
