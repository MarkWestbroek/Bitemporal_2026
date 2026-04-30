# Chat: Ondersteuning van meertaligheid en tijdreizen in Common Ground

- **Datum**: 2026-04-29 10:56
- **Sessie-ID**: `def89e9a-b62f-421e-81a2-d351a7256974`
- **Berichten**: 14

---

## 🧑 User

Zou je in het huidige Common Ground domein (de registraties) willen zoeken of en zo ja, hoe de volgende twee zaken worden ondersteund?

1. meertaligheid
2. tijdreizen

Ze zijn te vinden op: https://github.com/maykinmedia?q=open&type=all&language=&sort=
belangrijkst waarschijnlijk:
- openproduct
- openformulieren
- openobject

---

## 🤖 Assistant

Laat me dieper in de documentatie duiken voor meertaligheid en tijdreizen.  Hier is het volledige overzicht van de bevindingen:

---

## Meertaligheid en tijdreizen in Common Ground registraties

### 1. Meertaligheid

| Component | Ondersteuning | Details |
|---|---|---|
| **Open Product** | ✅ Uitgebreid | `Accept-Language`-header op alle producttype/content-endpoints. Dedicated vertaal-endpoints: `PUT /producttypen/{uuid}/vertaling/{taal}` en `PUT /content/{uuid}/vertaling/{taal}`. `nl` is verplicht, `en` is optioneel. Fallback naar `nl`. Response bevat `taal`-veld. |
| **Open Forms** | ✅ Volledig | Formulierenbouwer met tabblad "Vertalingen" per veld/stap/bevestigingspagina. Activeerbaar via checkbox; gebruiker krijgt taalkeuzemenu. Globale vertalingen (knoplabels, e-mails) via admin-configuratie. |
| **Open Object** | ❌ Niet aanwezig | Objectdata is vrije JSON (gedefinieerd via JSON Schema); taalondersteuning zit in het datamodel van het objecttype zelf — geen API-laag voor vertalingen. |

---

### 2. Tijdreizen

| Component | Ondersteuning | Details |
|---|---|---|
| **Open Object** | ✅ Volledig bitemporaal | Elk object heeft `records` met `startAt` (materieel) en `registrationAt` (formeel). Query parameters: `?date=` (materiële peilttijd) en `?registrationDate=` (formele peilttijd). Endpoint `GET /api/v2/objects/{uuid}/history` voor volledige historie. Formele + materiële as expliciet gedocumenteerd. |
| **Open Product** | ⚠️ Beperkt (unitemporaal) | Prijzen hebben `actief_vanaf` (materiële geldigheid, filterbaar). Producttypen hebben `publicatie_start_datum` / `publicatie_eind_datum`. Geen formeel bitemporaal model; geen `registrationDate`-query. |
| **Open Forms** | ❌ Geen tijdreizen | Formulieren hebben een draft/published workflow (versioning), maar geen temporele query-API. Geen terug- of vooruitkijken in de tijd. |

---

### Vergelijking met jouw bitemporeel register (v06)

Open Object is het meest verwant aan v06: het heeft zowel een formele als materiële tijdsas, en ondersteunt tijdreizen via query parameters. Het verschil is dat v06 expliciet een **wijzigingen/registratie-tabel** bijhoudt als aparte entiteit (audittrail), terwijl Open Object de `registrationAt` in het record zelf opslaat.

Open Product heeft alleen materiële tijdsondersteuning (geldigheidsperiodes op prijzen en publicatiedatums), zonder formele tijdreizen of correctiegeschiedenis.

---

## 🧑 User

ZOu je de volgende registers nog willen toevoegen aan de analyse en dat willen wegschrijven in een document?

- https://github.com/Signalen/backend/tree/main/docs
- openRegister van Conduction

---

## 🤖 Assistant

Nu heb ik voldoende informatie over alle 5 systemen. Ik maak het analysedocument aan. Het document is aangemaakt: 

Samenvatting van de bevindingen voor alle 5 systemen:

| Systeem | Meertaligheid | Tijdreizen |
|---|---|---|
| **Open Product** | ✅ `Accept-Language` + `/vertaling/{taal}` endpoints | ⚠️ Alleen materieel (`actief_vanaf`, publicatiedatums) |
| **Open Forms** | ✅ Volledig (formulierenbouwer, globale config, taalkeuze) | ❌ Geen (alleen draft/published) |
| **Open Object** | ❌ Vrije JSON, geen taalondersteuning | ✅ Volledig bitemporaal (`startAt`+`registrationAt`, `?date=`+`?registrationDate=`) |
| **Signalen** | ❌ Hardcoded Nederlands | ⚠️ Audit log (append-only), geen peilmoment-queries |
| **openRegister** | ⚠️ Alleen via AI/LLM, geen native API | ⚠️ Versiegeschiedenis + revert, geen formele/materiële tijdsas |

**Opvallende conclusie:** Alleen Open Object implementeert een volledig bitemporaal model — en dat op vergelijkbare wijze als v06, maar dan met records-in-object in plaats van een aparte wijzigingstabel. Geen enkel systeem combineert zowel meertaligheid als volledig bitemporaal tijdreizen.

---

## 🧑 User

Dank. Wil je nog naar deze repo's kijken:
https://git.contezza.nl/community/alfresco-documenten-api
https://github.com/generiekzaakafhandelcomponent/

Tevens: wat is het taalcode-formaat (nl-nl of gewoon nl? enz.) dat gebruikt wordt?

---

## 🤖 Assistant

Goede vondst: `rgbz:taal` = **ISO 639-2/B** (3-letter, bijv. `nld`). Nu GZAC verder onderzoeken. Goede vondst - Valtimo heeft een volledige localisatiefunctie. Nu snel de tijdreizen-kant van GZAC/Valtimo checken: Nu heb ik genoeg informatie. Ik ga het document bijwerken met de 2 nieuwe systemen en een sectie over taalcode-formaten. Nu ga ik het document volledig bijwerken met de 2 nieuwe systemen, de taalcode-sectie en de uitgebreide conclusie. 
```

```
Nu de nieuwe secties 6 en 7 plus de taalcode-sectie toevoegen na de bestaande sectie 5 en vóór de vergelijkende conclusie: 
```

```
Nu de vergelijkende conclusie uitbreiden met de 2 nieuwe systemen: 
```

```
Klaar. Het document is bijgewerkt. Hier een samenvatting van de bevindingen:

---

## Bevindingen Alfresco Documenten API & GZAC/Valtimo

### Alfresco Documenten API (Contezza/DRC)
- **Meertaligheid ⚠️**: Geen UI-meertaligheid. Wel een verplicht `rgbz:taal`-metadataveld op documentniveau, met **ISO 639-2/B** 3-letter codes (bijv. `nld`). Dit is een VNG ZGW-standaard conform RGBZ.
- **Tijdreizen ⚠️**: Alfresco versiebeheer + audit trail. Het `download`-endpoint heeft een `?registratieOp=`-parameter voor formeel tijdreizen op individuele documenten — maar geen collectie-peilmoment. Geen materiële tijdsas.

### GZAC / Valtimo (Ritense)
- **Meertaligheid ✅**: Volledige UI-lokalisatie via `@ngx-translate/core`. Standaard NL/EN/DE, uitbreidbaar met JSON-bestanden. Vertalingen admin-configureerbaar via `/translation-management` (v12.0.0+). Taalcodes: **ISO 639-1 / BCP 47** (`nl`, `en`, `de`).
- **Tijdreizen ⚠️**: Geen bitemporale queries in GZAC zelf. Wel case definition versioning (draft/final) en ZGW-integratie waarbij de onderliggende registers (bijv. Open Object) temporele mogelijkheden bieden.

---

## Taalcode-formaten

| Standaard | Code | Gebruik in dit ecosysteem |
|---|---|---|
| **BCP 47 / RFC 5646** | `nl`, `nl-NL` | HTTP `Accept-Language`, Open Product API |
| **ISO 639-1** | `nl`, `en` | UI-vertaalbestanden (Open Forms, GZAC/Valtimo) |
| **ISO 639-2/B** | `nld`, `eng` | DRC `rgbz:taal` metadataveld (VNG ZGW-standaard) |

Aanbeveling voor v06: **BCP 47** voor de API-laag, **ISO 639-2/B** voor documentinhoud-metadata.

---

## 🧑 User

Dank. Kun je doornemen wat de NL API strategie eventueel over taal zegt? Over tijdreizen is volgens mij nog niets opgenomen. Ik hoop dat ik daar wat aan kan bijdragen in een werkgroep die aan het starten is.... :-)

---

## 🤖 Assistant

Goed onderzocht — je hebt op beide punten gelijk. Hieronder de bevindingen uit de NL API Strategie (versies april 2026), gebaseerd op de hoofdmodules.

## Wat de NL API Strategie zegt over **taal**

De Strategie bestaat uit een hoofdmodule (Architectuur) + normatieve **API Design Rules v2.1.0** (ADR, april 2026) + losse modules (Geo, Transport Security, Signing, Encryption, Access Control, Naming Conventions, Hypermedia, Batching). Over taal vond ik **niets over meertaligheid van payloads of content** — alleen twee regels die gaan over de *taal van de interface zelf*:

| Design rule | Wat het zegt |
|---|---|
| `/core/interface-language` | Resources en attributen SHOULD in het Nederlands gedefinieerd worden, tenzij er een officiële Engelstalige woordenlijst bestaat. Internationale doelgroep mag aanleiding zijn voor Engels. |
| `/core/doc-language` | OAS-documentatie SHOULD in het Nederlands; mag verwijzen naar bestaande Engelstalige documentatie. |

**Wat er niét in staat:**
- Geen voorschrift over `Accept-Language` (RFC 9110) of content negotiation per taal.
- Geen voorschrift over taalcode-formaat (BCP 47, ISO 639-1/2/3) in velden of headers.
- Geen patroon voor meertalige attribuutwaarden (bv. `naam: { nl: "...", en: "..." }` vs. `naam_nl` / `naam_en` vs. taal als query/header).
- Geen voorschrift voor lokalisatie van foutmeldingen (`application/problem+json` heeft een optionele `instance`, maar `title`/`detail` taal is niet voorgeschreven — ironisch genoeg in samenhang met `/core/doc-language` impliciet NL).
- De Naming Conventions-module behandelt naamgevingsregels (kebab-case e.d.), niet taal van de inhoud.

Kortom: **er is alleen een impliciete keuze voor Nederlands als interface-taal, en niets over meertaligheid van de gerepresenteerde gegevens.** Daar is dus ook nog wat te halen.

## Wat de NL API Strategie zegt over **tijdreizen**

**Niets** over bitemporaliteit, peilmoment, formele/materiële tijd, historie of temporele queries op resource-niveau. Bevestigd. Wat er wel is:

| Onderwerp | Status in ADR v2.1.0 |
|---|---|
| Datum/tijd-formaten | `/core/date-time/format` (RFC 9557 + ISO 8601-1), `/core/date-time/timezone` (UTC in responses, alle offsets in requests), `/core/date-time/date-omit-time-portion`. Puur over notatie, niet over historische bevraging. |
| Versionering | `/core/uri-version`, `/core/semver`, `/core/version-header`, `/core/transition-period` — over **API-contract**-versies, niet over resource-versies. |
| Audit trail | Komt alleen voor in de Architectuurmodule §2.3.3.7 als **gateway/logging-capability** (wie raadpleegde wat, wanneer, waarom — doelbinding/AVG), niet als REST-pattern op resources. |
| Operations | `/core/resource-operations` (sub-resource of `_zoek` patroon) — generiek, niets over `?peilmoment=` of `/historie`. |
| Hypermedia / Batching | Modules behandelen geen tijdreizen. |

Geen module of design rule benoemt patronen die we wel in de praktijk zien (BRP Haal Centraal `?peilmoment=`, ZGW `registratiedatum`/audittrail, Open Object `?date=`/`?registrationDate=`, Alfresco DRC `?registratieOp=`).

## Bouwstenen die je mee kunt nemen naar de werkgroep

Vanuit het Bitemp Register v06-onderzoek heb je een rijke bron. Concrete voorstellen:

1. **Twee-assige terminologie standaardiseren** (formele tijd vs. materiële tijd, of registratie- vs. geldigheidstijd) met heldere NL-definities.
2. **Naamgeving querystring-parameters**: Open Object gebruikt `?date=` + `?registrationDate=`, BRP `?peilmoment=`, Alfresco `?registratieOp=` + `?versie=`. Dit verdient een uniforme keuze (bv. `?materieelOp=` / `?formeelOp=` of internationaal `?validAt=` / `?recordedAt=`).
3. **Formaat**: ISO 8601 / RFC 9557 ligt al vast; sluit daarbij aan voor peilmoment-parameters (incl. tijdzone-regel: UTC in respons).
4. **Resource-pattern** voor historie: bijv. sub-resource `/{resource}/{id}/_historie` (past binnen `/core/resource-operations` met `_`-prefix conventie) vs. impliciet via querystring.
5. **Snapshot-semantiek vs. delta-semantiek** (full state op tijdstip vs. wijzigingen tussen tijdstippen).
6. **Audit-trail vs. tijdreizen** scherp onderscheiden: het ADR/architectuur kent alleen "wie heeft wanneer welke API-call gedaan", niet "wat was de inhoudelijke staat van de resource toen".
7. **Cache-implicaties**: tijdreizen vs. `Cache-Control: no-store` regel (security headers) — een snapshot op verleden peilmoment is in principe immutable en uitstekend cachebaar.
8. **Internationale context**: ISO/SQL:2011 application_time/system_time period, OGC API Features `?datetime=`, en de eerder gevonden Common Ground-implementaties als inspiratie.

Zal ik dit als een nieuwe sectie "8. NL API Strategie" toevoegen aan ?

---

## 🧑 User

ja, graag!

---

## 🤖 Assistant

Now I'll add the new section 8 (NL API Strategie) and renumber the existing sections. Actually, simpler: insert new section before the "Vergelijkende conclusie" and call it section 9. Let me check section 8 number.

Section 8 = Taalcode-formaten. So new section becomes 9. 

---

## 🧑 User

het document staat wat plomp in de root. Zou je het in docs willen zetten?

---

## 🧑 User

@agent Try Again

---

## 🧑 User

@agent Try Again

---

## 🤖 Assistant

Gedaan! Het document staat nu in .

---
