# Analyse: Meertaligheid & Tijdreizen in Common Ground systemen

**Datum:** juli 2025  
**Onderzochte systemen:** Open Product, Open Forms, Open Object (Maykin Media), Signalen, openRegister (Conduction), Alfresco Documenten API (Contezza/DRC), GZAC/Valtimo (Ritense)  
**Doel:** Inventarisatie van hoe Common Ground-registers omgaan met (1) meertaligheid en (2) tijdreizen, ter vergelijking met het Bitemp Register v06-model.

---

## Overzichtstabel

| Systeem | Meertaligheid | Tijdreizen |
|---|---|---|
| **Open Product** | ✅ Volledig | ⚠️ Partieel (alleen materieel) |
| **Open Forms** | ✅ Volledig | ❌ Niet aanwezig |
| **Open Object** | ❌ Niet aanwezig | ✅ Volledig bitemporaal |
| **Signalen** | ❌ Niet aanwezig | ⚠️ Audit log (geen temporele queries) |
| **openRegister** | ⚠️ Via AI/LLM (geen native) | ⚠️ Versiegeschiedenis + revert (geen bitemporaal) |
| **Alfresco DRC** | ⚠️ Taalcode in metadata (ISO 639-2/B), geen UI-meertaligheid | ⚠️ Versies + audit trail, `registratieOp`-query op documenten |
| **GZAC / Valtimo** | ✅ Volledig (UI-lokalisatie via ngx-translate, admin-configureerbaar) | ⚠️ ZGW-integratie (registratiedatum zaak), geen peilmoment-queries |

---

## Legende

| Symbool | Betekenis |
|---|---|
| ✅ | Volledig ondersteund, native in het datamodel of API |
| ⚠️ | Partieel of beperkt ondersteund |
| ❌ | Niet aanwezig |

---

## 1. Open Product (Maykin Media)

**Technologie:** Django/Python, REST API  
**Versie onderzocht:** v1.7.0  
**Repo:** [maykinmedia/open-product](https://github.com/maykinmedia/open-product)

### 1.1 Meertaligheid ✅

Open Product ondersteunt meertaligheid op twee niveaus:

**Producttype-vertalingen:**
```
GET  /producttypen/{uuid}/vertaling/{taal}
POST /producttypen/{uuid}/vertaling/{taal}
PUT  /producttypen/{uuid}/vertaling/{taal}
```

**Content-vertalingen:**
```
GET  /content/{uuid}/vertaling/{taal}
POST /content/{uuid}/vertaling/{taal}
```

Daarnaast ondersteunt de API de standaard `Accept-Language` HTTP-header om de gewenste taal mee te geven. Dit is volledig conform de NL API Strategie en Web Content Accessibility Guidelines.

### 1.2 Tijdreizen ⚠️

Open Product heeft **geen volledig bitemporaal model**. Er is beperkte materiële tijdsondersteuning:

- `actief_vanaf` op prijzen (materieel aanvangsmoment van een prijs)
- `publicatie_start_datum` en `publicatie_eind_datum` op producttypen

Er is **geen formele tijdsas** (geen registratietijdstip-model), geen `?t=` peilmoment-query en geen gescheiden opvoer/afvoer-registratie. Daarmee is tijdreizen in de bitemporale betekenis niet mogelijk.

---

## 2. Open Forms (open-formulieren)

**Technologie:** Django/Python, REST API  
**Versie onderzocht:** v3.5.0  
**Repo:** [open-formulieren/open-forms](https://github.com/open-formulieren/open-forms)

### 2.1 Meertaligheid ✅

Open Forms heeft de meest uitgebreide meertaligheidsondersteuning van alle onderzochte systemen:

- **Formulierenbouwer**: apart "Vertalingen"-tabblad in de formulier-editor, waarmee elke tekst in het formulier per taal vertaald kan worden
- **Globale configuratievertalingen**: systeemteksten, foutmeldingen en labels kunnen per taal worden ingesteld
- **Taalkeuzemenu voor eindgebruikers**: bezoekers kunnen de taal van het formulier kiezen bij het invullen
- **Django Rosetta-integratie** voor beheer van vertalingen door content-beheerders

### 2.2 Tijdreizen ❌

Open Forms ondersteunt **geen tijdreizen**. Er is alleen een eenvoudig versiemodel:

- Formulieren hebben een `draft`- en `published`-status
- Er is geen peilmoment-query, geen formele tijdsas en geen gescheiden registratie van wijzigingen
- Historische versies zijn niet via de API opvraagbaar met een tijdstip

---

## 3. Open Object / Open Objecten (Maykin Media)

**Technologie:** Django/Python, REST API  
**Versie onderzocht:** v4.0.0 (voorheen "open-objecten")  
**Repo:** [maykinmedia/open-object](https://github.com/maykinmedia/open-object)

### 3.1 Meertaligheid ❌

Open Object slaat objectdata op als vrije JSON (conform een extern gedefinieerd objecttype-schema). Er is **geen ingebouwde meertaligheidsondersteuning** — eventuele vertalingen moeten in de JSON-payload van het object zelf worden opgenomen.

### 3.2 Tijdreizen ✅

Open Object heeft het **meest volledige bitemporale model** van alle onderzochte systemen:

**Datamodel:**
Elk object heeft een `records`-structuur met expliciet gescheiden tijdsassen:

```json
{
  "uuid": "...",
  "records": [
    {
      "index": 1,
      "typeVersion": 1,
      "data": { "...objectdata..." },
      "geometry": null,
      "startAt": "2024-01-01",       // materiële aanvangsdatum
      "endAt": null,                 // materiële einddatum
      "registrationAt": "2024-01-15T10:00:00Z",  // formele registratiedatum
      "correctionFor": null,
      "correctedBy": null
    }
  ]
}
```

**Tijdreis-queries:**
```
GET /api/v2/objects?date=2024-06-01              # materieel tijdreizen
GET /api/v2/objects?registrationDate=2024-06-01  # formeel tijdreizen
GET /api/v2/objects/{uuid}/history               # volledige audit trail
```

Dit is semantisch equivalent aan het bitemporale model in Bitemp Register v06, zij het met een andere implementatiestrategie (records-in-object vs. aparte wijzigingstabel).

---

## 4. Signalen (Signalen/Amsterdam)

**Technologie:** Django/Python, REST API  
**Versie onderzocht:** current main branch (geforkt van Amsterdam/signals)  
**Repo:** [Signalen/backend](https://github.com/Signalen/backend)

### 4.1 Meertaligheid ❌

Signalen heeft **geen meertaligheidsondersteuning**. De UI en alle tekstinhoud (statusnamen, e-mailsjablonen, notities, actiebeschrijvingen) zijn hardcoded in het Nederlands:

- Statusnamen: `"Gemeld"`, `"Afwachting"`, `"Behandeling"`, `"Afgehandeld"`, etc.
- E-mails en beschrijvingen zijn vaste Nederlandse teksten
- Geen `Accept-Language`-header, geen vertaal-endpoints

### 4.2 Tijdreizen ⚠️

Signalen heeft een **append-only audit log**, maar **geen bitemporaal model**:

**History endpoint:**
```
GET /signals/v1/private/signals/{id}/history
GET /signals/v1/private/signals/{id}/history?what=UPDATE_STATUS
```

Response (voorbeeld):
```json
[
  {
    "identifier": "UPDATE_STATUS_124",
    "when": "2022-11-24T12:00:00+01:00",
    "what": "UPDATE_STATUS",
    "action": "Status gewijzigd naar: Gemeld",
    "description": null,
    "who": "signals.admin@example.com",
    "_signal": 1
  }
]
```

Het history-endpoint geeft een chronologische lijst van acties (wie/wat/wanneer), filterbaar op type (`?what=`). Het is echter **geen temporeel query-mechanisme**:

- Geen `?t=` peilmoment-parameter om de toestand op een bepaald tijdstip op te vragen
- Geen `?registrationDate=` voor formeel tijdreizen
- Elke wijziging is een log-entry, geen snapshot die op een peilmoment opvraagbaar is
- Architectuurprincipe: "Do not edit history of incidents" — mutaties zijn append-only

---

## 5. openRegister (Conduction/Open Webconcept)

**Technologie:** PHP/Vue.js, Nextcloud-plugin, REST API  
**Versie onderzocht:** v0.2.x (recent)  
**Repo:** [ConductionNL/openregister](https://github.com/ConductionNL/openregister)

### 5.1 Meertaligheid ⚠️

openRegister heeft **geen native meertaligheidsondersteuning in het datamodel** of de API-laag. Objectdata is vrije JSON (gevalideerd via JSON Schema), waarbij eventuele vertalingen door de applicatie zelf gemodelleerd moeten worden.

Wel beschikbaar via de **AI/LLM-laag** (als optionele add-on functie):
- AI-gestuurde vertaling via OpenAI, Fireworks AI, Ollama of Azure OpenAI
- "🌍 Translation — Multi-language content translation" staat als AI-feature beschreven
- Dit is echter geen gestructureerde API-meertaligheid, maar generatieve verwerking

Er zijn geen `Accept-Language`-headers, geen vertaal-endpoints en geen taalspecifieke velden in het basismodel.

### 5.2 Tijdreizen ⚠️

openRegister noemt "⏰ Time Travel" als core feature, maar dit heeft een beperktere betekenis dan het bitemporale model:

**Wat ondersteund wordt:**
- Automatische versie-incrementering bij elke wijziging
- Volledige audit trail van alle wijzigingen op veldniveau
- Opvragen van historische versies
- Terugkeren naar een eerdere versie (revert — maakt een nieuwe versie aan)

**Wat ontbreekt:**
- **Geen formele tijdsas**: er is geen scheiding tussen "wanneer geregistreerd" en "wanneer geldig"
- **Geen materiële tijdsas**: geen `startAt`/`endAt` of aanvang/einde in het standaard datamodel
- **Geen peilmoment-queries**: geen `?date=` of `?registrationDate=` parameters
- Het model is feitelijk enkelvoudig temporeel (alleen registratietijdstip via `created`/`updated`)

De "Time Travel"-feature is in de praktijk **versiegeschiedenis + revert-mogelijkheid**, vergelijkbaar met Git, maar geen bitemporaal register in de zin van NEN 3610 of het Bitemp v06-model.

---

## 6. Alfresco Documenten API (Contezza / DRC)

**Technologie:** Java / Maven, Alfresco Enterprise 23.x  
**Versie onderzocht:** v2.4.x (huidige release april 2026)  
**Repo:** [git.contezza.nl/community/alfresco-documenten-api](https://git.contezza.nl/community/alfresco-documenten-api)

Dit is een **implementatie van de VNG ZGW Documentregistratiecomponent (DRC) standaard** in Alfresco. De API is conform de DRC-specificatie (v1.3.0–v1.5.0) en integreert met de overige ZGW API's (Zaken, Catalogi, Besluiten).

### 6.1 Meertaligheid ⚠️

De Alfresco Documenten API heeft **geen UI-meertaligheid** en ook geen API-laag voor het serveren van content in meerdere talen. Wel is er een **taalcode-metadataveld** op documentniveau:

```xml
<!-- Uit het RGBZ content model (datamodel aspect: rgbz:enkelvoudigInformatieobject) -->
rgbz:taal  d:text (1)
```

> *"Een ISO 639-2/B taalcode waarin de inhoud van het INFORMATIEOBJECT is vastgelegd."*

Gebruik:
- Dit veld legt de **taal van de documentinhoud** vast (bijv. `nld`, `eng`, `fra`)
- Het is verplicht (cardinaliteit 1)
- Standaard 3-letterige code conform **ISO 639-2/B** (bibliografische variant)
- Dit is geen meertaligheid in de zin van een vertaal-API, maar documentinhoud-taal-metadata conform de VNG ZGW-standaard

### 6.2 Tijdreizen ⚠️

De DRC implementeert **document-versies en een audit trail**, maar geen volledig bitemporaal model:

**Versieondersteuning (Alfresco-native):**
- Het `rgbz:versionable` aspect activeert Alfresco's ingebouwde versiebeheer
- Bij elke wijziging wordt een nieuwe versie aangemaakt

**Formele tijdreis op documentversie:**
```
GET /alfresco/service/drc/v1/enkelvoudiginformatieobjecten/{uuid}/download
    ?registratieOp=2024-01-15T10:00:00Z   # ophalen op registratietijdstip
    ?versie=3                              # ophalen van specifieke versie
```

**Audit trail:**
```
GET /alfresco/service/drc/v1/enkelvoudiginformatieobjecten/{uuid}/audittrail
GET /alfresco/service/drc/v1/enkelvoudiginformatieobjecten/{uuid}/audittrail/{uuid}
```

**Wat ontbreekt:**
- **Geen materiële tijdsas** op het informatieobject zelf (geen `startAt`/`endAt`)
- **Geen `?date=` peilmoment** voor de collectie-query (geen tijdreizen op lijsten)
- Het model is functioneel **enkelvoudig temporeel** (formele registratiemomenten via versies), niet bitemporaal
- De `registratieOp`-parameter werkt alleen op individuele document-downloads, niet op zoekopdrachten

Het is vergelijkbaar met Signalen: een audit trail die de registratiegeschiedenis vastlegt, maar geen volwaardig bitemporaal register.

---

## 7. GZAC / Valtimo (Ritense / generiekzaakafhandelcomponent)

**Technologie:** Kotlin/Java (backend, Spring Boot + Camunda/BPMN), TypeScript/Angular (frontend)  
**Versie onderzocht:** v12–v13 (frontend), v13 (backend)  
**Repos:** [generiekzaakafhandelcomponent](https://github.com/generiekzaakafhandelcomponent), [docs.valtimo.nl](https://docs.valtimo.nl)

GZAC is een **generiek zaakafhandelcomponent** gebouwd op het Valtimo-platform van Ritense. Het integreert met ZGW API's (Open Zaak, Open Formulieren, etc.) en biedt BPMN-gebaseerde procesautomatisering.

### 7.1 Meertaligheid ✅

Valtimo/GZAC heeft **volledige UI-lokalisatie** via Angular's `@ngx-translate/core`:

**Vertaalbestanden per taal (JSON):**
```
src/assets/i18n/nl.json
src/assets/i18n/en.json
src/assets/i18n/de.json
```

**Admin-UI voor vertalingen (v12.0.0+):**
- Beheerders kunnen vertalingen configureren via `/translation-management`
- Bestaande vertaalsleutels kunnen worden overschreven (bijv. `Dashboard` → `Mijn dashboard`)
- Custom translation keys kunnen worden toegevoegd
- Dot-notatie voor geneste sleutels (bijv. `account.informationTitle`)

**Technische implementatie:**
```typescript
// environment.ts
translationResources: ['./assets/i18n/']

// app.module.ts
TranslateModule.forRoot({
  loader: {
    provide: TranslateLoader,
    useFactory: CustomMultiTranslateHttpLoaderFactory,
    deps: [HttpBackend, HttpClient, ConfigService, LocalizationService],
  }
})
```

De frontend-libraries van Valtimo bevatten standaard vertalingen voor de kern-functionaliteit; implementaties kunnen deze uitbreiden of overschrijven. Plugins hebben eigen vertaalbestanden (GZAC Plugins commit: *"vertaling en configuratiescherm fix"*).

**Taalcode-formaat:** bestandsnamen volgen **ISO 639-1 / BCP 47** (2-letter: `nl`, `en`, `de`).

### 7.2 Tijdreizen ⚠️

GZAC/Valtimo heeft **geen expliciete bitemporale tijdreis-API**. Wel zijn er twee relevante mechanismen:

**Case definition versioning (v13.0.0+):**
- Zaakdefinities (case definitions) hebben versies: `draft` → `final`
- Historische versies zijn inzichtelijk via de admin-UI
- Dit is versioning van de *configuratie*, niet van de zaakdata zelf

**ZGW API integratie (via Open Zaak e.d.):**
- GZAC integreert met ZGW Zaken API die `registratiedatum` en `startdatum` bijhoudt
- Via de ZGW koppeling heeft een zaak daarmee een temporeel registratiepunt
- De bitemporale query-mogelijkheden zijn afhankelijk van de onderliggende ZGW-implementatie (bijv. Open Object: volledig bitemporaal)

**Wat ontbreekt in GZAC zelf:**
- Geen `?t=` of `?registratieOp=` peilmoment-parameter op de GZAC REST API
- Geen formele/materiële tijdsas als first-class concept in het Valtimo case model
- Zaakdata (JSON document definitions) heeft geen ingebouwde tijdreis-mogelijkheid

GZAC leunt voor temporele functionaliteit volledig op de onderliggende ZGW-registers (met name Open Object voor objectdata). De zaakafhandellaag zelf is niet bitemporaal ontworpen.

---

## 8. Taalcode-formaten: overzicht per systeem

De systemen gebruiken verschillende standaarden voor taalcodes. Hier een overzicht:

| Systeem | Context | Standaard | Voorbeeld |
|---|---|---|---|
| **Open Product** | `Accept-Language` HTTP-header | BCP 47 / RFC 5646 | `nl`, `nl-NL`, `en` |
| **Open Product** | Vertaal-endpoints (`/vertaling/{taal}`) | Waarschijnlijk ISO 639-1 (2-letter) | `nl`, `en` |
| **Open Forms** | UI-taalbestanden | ISO 639-1 / BCP 47 | `nl`, `en` |
| **Open Object** | N.v.t. (vrije JSON) | — | — |
| **Signalen** | N.v.t. (NL only) | — | — |
| **openRegister** | N.v.t. / vrije JSON | — | — |
| **Alfresco DRC** | `rgbz:taal` metadataveld document | **ISO 639-2/B** (3-letter, bibliografisch) | `nld`, `eng`, `fra` |
| **GZAC / Valtimo** | UI-vertaalbestanden | **ISO 639-1 / BCP 47** (2-letter) | `nl`, `en`, `de` |

### Toelichting standaarden

| Standaard | Codesysteem | Voorbeeld NL | Gebruik |
|---|---|---|---|
| **BCP 47 / RFC 5646** | Primair ISO 639-1, uitbreidbaar | `nl`, `nl-NL`, `nl-BE` | HTTP `Accept-Language`, OpenAPI, HTML `lang`-attribuut |
| **ISO 639-1** | 2-letter taalcodes | `nl` | Eenvoudige vertaalbestanden, UI-frameworks |
| **ISO 639-2/B** | 3-letter bibliografisch | `nld` | Archiefstandaarden, MARC, VNG ZGW DRC-standaard |
| **ISO 639-2/T** | 3-letter terminologisch | `nld` | (idem, zelfde voor NL) |
| **ISO 639-3** | 3-letter uitgebreid | `nld` | Taalkundige systemen |

**Praktische conclusie:**
- Voor **API-laag** (HTTP headers, REST): gebruik **BCP 47** (`nl`, `nl-NL`)
- Voor **UI-vertaalbestanden** (ngx-translate, react-i18next, etc.): gebruik **ISO 639-1** (`nl`, `en`)
- Voor **documentmetadata in ZGW/DRC context**: gebruik **ISO 639-2/B** (`nld`, `eng`) — dit is de VNG-standaard conform RGBZ
- Bitemp Register v06: nog geen taalveld; bij toevoeging is **BCP 47** voor API, **ISO 639-2/B** voor documentinhoud-metadata aanbevolen

---

## 9. NL API Strategie (Logius / Geonovum / Kennisplatform API's)

**Onderzocht:** april 2026  
**Bronnen:** [API Design Rules v2.1.0](https://logius-standaarden.github.io/API-Design-Rules/) (draft 20-04-2026), [API Strategie Architectuurmodule](https://geonovum.github.io/KP-APIs/API-strategie-algemeen/Architectuur/) (vastgesteld 26-03-2026), [Kennisplatform API's](https://developer.overheid.nl/communities/kennisplatform-apis/).

De NL API Strategie bestaat uit een hoofddocument + Architectuurmodule + normatieve standaarden (ADR, OAS, OAuth/OIDC, Digikoppeling REST) + losse modules (Geo, Transport Security, Signing, Encryption, Access Control, Naming Conventions, Hypermedia, Batching).

### 9.1 Meertaligheid ⚠️

Slechts **twee design rules** raken het onderwerp taal — en die gaan over de **interface-taal** (Nederlands tenzij…), niet over meertaligheid van de gerepresenteerde gegevens:

| Design rule | Statement |
|---|---|
| `/core/interface-language` | Resources en attributen SHOULD in het Nederlands gedefinieerd worden, tenzij er een officiële Engelstalige woordenlijst bestaat. Internationale doelgroep mag aanleiding zijn voor Engels. |
| `/core/doc-language` | OAS-documentatie SHOULD in het Nederlands; mag verwijzen naar Engelstalige bestaande documentatie. |

**Niet voorgeschreven door de NL API Strategie:**

- Geen voorschrift over `Accept-Language` (RFC 9110) of content negotiation per taal
- Geen voorschrift over taalcode-formaat (BCP 47, ISO 639-1/2/3) in velden of headers
- Geen patroon voor meertalige attribuutwaarden (`naam_nl`/`naam_en` vs. `naam: { nl: …, en: … }` vs. taal als query/header vs. dedicated vertaal-endpoints)
- Geen voorschrift voor lokalisatie van foutmeldingen (`application/problem+json` heeft `title`/`detail`, maar de taal daarvan wordt niet expliciet behandeld — impliciet NL via `/core/interface-language`)
- De **Naming Conventions-module** behandelt naamgevingsregels (kebab-case in paths, camelCase in query keys), niet taal van de inhoud

Conclusie: er is een impliciete keuze voor Nederlands als interface-taal, maar **niets over meertaligheid van de gerepresenteerde gegevens**.

### 9.2 Tijdreizen ❌

**Niets** in de NL API Strategie over bitemporaliteit, peilmoment, formele/materiële tijd, historie of temporele queries op resource-niveau. Wat er wél is:

| Onderwerp | Status |
|---|---|
| **Datum/tijd-formaten** | `/core/date-time/format` (RFC 9557 + ISO 8601-1), `/core/date-time/timezone` (UTC in responses, alle offsets in requests), `/core/date-time/date-omit-time-portion`. Puur over notatie, niet over historische bevraging. |
| **Versionering** | `/core/uri-version`, `/core/semver`, `/core/version-header`, `/core/transition-period` — over **API-contractversies**, niet over resource-versies. |
| **Audit trail** | Komt alleen voor in de Architectuurmodule §2.3.3.7 als **gateway/logging-capability** (wie raadpleegde wat, wanneer, waarom — doelbinding/AVG), niet als REST-pattern op resources. |
| **Operations** | `/core/resource-operations` (sub-resource of `_zoek`-patroon met underscore-prefix) — generiek, niets over `?peilmoment=` of `/historie`. |
| **Hypermedia / Batching** | Modules behandelen geen tijdreizen. |

Geen design rule of module benoemt patronen die we wel in de praktijk zien:
- BRP Haal Centraal — `?peilmoment=`
- ZGW — `registratiedatum` + `audittrail`-endpoint
- Open Object — `?date=` + `?registrationDate=`
- Alfresco DRC — `?registratieOp=` + `?versie=`

### 9.3 Bouwstenen voor de werkgroep

Vanuit het Bitemp Register v06-onderzoek en de zeven hierboven onderzochte systemen zijn de volgende ingrediënten relevant voor een werkgroep "tijdreizen in de NL API Strategie":

1. **Twee-assige terminologie standaardiseren** — formele tijd vs. materiële tijd (of: registratie- vs. geldigheidstijd) met heldere NL-definities. Aansluiting bij ISO/SQL:2011 (`SYSTEM_TIME` / `APPLICATION_TIME`) en OGC API Features (`?datetime=`).
2. **Naamgeving querystring-parameters** — momenteel divers (`?peilmoment=`, `?date=`/`?registrationDate=`, `?registratieOp=`, `?t=`). Een uniforme NL-keuze (bv. `?materieelOp=` / `?formeelOp=`) of internationale (bv. `?validAt=` / `?recordedAt=`) is wenselijk.
3. **Formaat** — sluit aan bij bestaande regel `/core/date-time/format` (RFC 9557 + ISO 8601-1, UTC in responses).
4. **Resource-pattern voor historie** — past binnen `/core/resource-operations` met `_`-prefix conventie: bv. `/{resource}/{id}/_historie` of impliciet via querystring op de gewone GET.
5. **Snapshot- vs. delta-semantiek** — full state op tijdstip vs. wijzigingen tussen tijdstippen. Beide kennen use cases (audit-vraag vs. event-sourcing/synchronisatie).
6. **Audit-trail vs. tijdreizen scherp onderscheiden** — het ADR/architectuur kent alleen "wie heeft wanneer welke API-call gedaan" (gateway-logging), niet "wat was de inhoudelijke staat van de resource toen".
7. **Cache-implicaties** — tijdreizen botst met `Cache-Control: no-store` (security headers), maar een snapshot op een verleden peilmoment is in principe immutable en uitstekend cachebaar. Dit verdient een uitzondering of richtlijn.
8. **Cross-register tijdreizen** — als meerdere registers dezelfde formele tijdsas hanteren, wordt audit-trail over registers heen mogelijk. Dit is in het Bitemp Register v06 een architectureel doel.
9. **Internationale context** — ISO/SQL:2011 application_time/system_time period, OGC API Features `?datetime=`, en de Common Ground-implementaties (Open Object, Alfresco DRC) als referenties.

### 9.4 Bouwstenen voor meertaligheid (bonus)

Als de werkgroep ook meertaligheid wil oppakken (parallel of separaat):

1. **Taalcode-formaat standaardiseren** — BCP 47 voor API/headers, ISO 639-2/B voor documentmetadata (conform ZGW DRC). Sectie 8 hierboven inventariseert wat in de praktijk wordt gebruikt.
2. **Patroonkeuze** — drie hoofdpatronen in het veld:
   - **Header-gebaseerd**: `Accept-Language`-header (RFC 9110) met content negotiation
   - **Sub-resource**: `/{resource}/{id}/vertaling/{taal}` (Open Product)
   - **Inline**: `naam: { nl: "...", en: "..." }` of `naam_nl`/`naam_en`
3. **Lokalisatie van `application/problem+json`** — `title`/`detail` zouden taal-onderhandeld moeten kunnen zijn.

---

## Vergelijkende conclusie

### Meertaligheid

Meertaligheid is goed geïmplementeerd in systemen gericht op gebruikersinteractie (Open Forms, Open Product, GZAC/Valtimo), maar ontbreekt in systemen die puur als datalaag functioneren (Open Object, Signalen) of vrije JSON opslaan (openRegister). Dit volgt een logisch patroon: een formulieren- of zaakafhandelplatform moet meertalig zijn; een objectenregister legt de verantwoordelijkheid bij de afnemer.

De Alfresco DRC heeft geen UI-meertaligheid, maar gebruikt wel een expliciete taalcode (`rgbz:taal`, ISO 639-2/B) als verplichte metadata op documentniveau — dit is een goede praktijk voor documentregistraties.

GZAC/Valtimo biedt de meest uitgebreide en beheerdervriendelijke lokalisatie: admin-configureerbaar via de UI, meerdere talen (NL/EN/DE), uitbreidbaar via JSON-bestanden.

### Tijdreizen

Slechts **Open Object** implementeert een volledig bitemporaal model met zowel een formele als materiële tijdsas en bijbehorende peilmoment-queries. De overige systemen bieden hooguit:
- Een audit log zonder peilmoment-queries (Signalen, openRegister, Alfresco DRC)
- Beperkte materiële tijdsvelden (Open Product)
- Case definition versioning, geen data-tijdreizen (GZAC/Valtimo)

Opvallend is dat **Alfresco DRC** via de `registratieOp`-parameter op documentdownloads iets doet dat lijkt op formeel tijdreizen, maar dan beperkt tot één document tegelijk — niet als collectie-query.

### Positie van Bitemp Register v06

Het v06-model onderscheidt zich van alle zeven onderzochte systemen door:

1. **Expliciete scheiding van formele en materiële tijd** via de wijzigingstabel + registratiemodel
2. **Tijdreizen op beide assen** via `?t=` (formeel) en materiële aanvang/einde
3. **Audittrail via registraties en wijzigingen**, niet via embedded records of simpele log-entries
4. **Cross-register tijdreizen** als architectureel doel (dezelfde formele tijdsas over meerdere registers)
5. **Metadata-gedreven aanpak** (MetaRegistry) die vergelijkbaar is met de dynamische schema-laag van Open Object

Meertaligheid is in v06 nog niet geïmplementeerd — dit is een mogelijkheid voor uitbreiding. Aanbevelingen:
- **API-laag**: `Accept-Language` header + dedicate vertaal-endpoints per representatietype (conform Open Product)
- **Taalcode-formaat**: BCP 47 (`nl`, `en`) voor API; ISO 639-2/B (`nld`, `eng`) voor documentinhoud-metadata (conform VNG ZGW DRC-standaard)
- **UI-laag**: ngx-translate/react-i18next patroon (conform GZAC/Valtimo) voor de frontend

---

## Bronnen

- [maykinmedia/open-product](https://github.com/maykinmedia/open-product) — API docs, v1.7.0
- [open-formulieren/open-forms](https://github.com/open-formulieren/open-forms) — docs, v3.5.0
- [maykinmedia/open-object](https://github.com/maykinmedia/open-object) — API docs, v4.0.0
- [Signalen/backend](https://github.com/Signalen/backend) — docs/topics/api/v1/private/signals/
- [ConductionNL/openregister](https://github.com/ConductionNL/openregister) — README + openregisters.app/docs
- [Contezza/alfresco-documenten-api](https://git.contezza.nl/community/alfresco-documenten-api) — asciidoc docs v2.4.x, datamodel
- [VNG-Realisatie/gemma-zaken DRC](https://vng-realisatie.github.io/gemma-zaken/standaard/documenten/) — DRC 1.x standaard-specificatie
- [generiekzaakafhandelcomponent/Plugins](https://github.com/generiekzaakafhandelcomponent/Plugins) — GZAC plugins v13
- [generiekzaakafhandelcomponent/gzac-frontend-template](https://github.com/generiekzaakafhandelcomponent/gzac-frontend-template) — Angular frontend v12+
- [Valtimo docs: Localization](https://docs.valtimo.nl/features/localization) — lokalisatie-documentatie
- [Valtimo docs: Cases](https://docs.valtimo.nl/features/case) — case definition versioning
- [NLgov REST API Design Rules v2.1.0](https://logius-standaarden.github.io/API-Design-Rules/) — Logius standard, draft 20-04-2026
- [API Strategie Algemeen — Architectuurmodule](https://geonovum.github.io/KP-APIs/API-strategie-algemeen/Architectuur/) — Geonovum, vastgesteld 26-03-2026
- [Kennisplatform API's](https://developer.overheid.nl/communities/kennisplatform-apis/) — overzicht NL API Strategie + werkgroepen
