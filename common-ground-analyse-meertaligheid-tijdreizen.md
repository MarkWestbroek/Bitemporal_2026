# Analyse: Meertaligheid & Tijdreizen in Common Ground systemen

**Datum:** juli 2025  
**Onderzochte systemen:** Open Product, Open Forms, Open Object (Maykin Media), Signalen, openRegister (Conduction)  
**Doel:** Inventarisatie van hoe de vijf meest gebruikte Common Ground-registers omgaan met (1) meertaligheid en (2) tijdreizen, ter vergelijking met het Bitemp Register v06-model.

---

## Overzichtstabel

| Systeem | Meertaligheid | Tijdreizen |
|---|---|---|
| **Open Product** | ✅ Volledig | ⚠️ Partieel (alleen materieel) |
| **Open Forms** | ✅ Volledig | ❌ Niet aanwezig |
| **Open Object** | ❌ Niet aanwezig | ✅ Volledig bitemporaal |
| **Signalen** | ❌ Niet aanwezig | ⚠️ Audit log (geen temporele queries) |
| **openRegister** | ⚠️ Via AI/LLM (geen native) | ⚠️ Versiegeschiedenis + revert (geen bitemporaal) |

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

## Vergelijkende conclusie

### Meertaligheid

Meertaligheid is goed geïmplementeerd in systemen gericht op gebruikersinteractie (Open Forms, Open Product), maar ontbreekt in systemen die puur als datalaag functioneren (Open Object, Signalen) of vrije JSON opslaan (openRegister). Dit volgt een logisch patroon: een formulierenplatform moet meertalig zijn; een objectenregister legt de verantwoordelijkheid bij de afnemer.

### Tijdreizen

Slechts **Open Object** implementeert een volledig bitemporaal model met zowel een formele als materiële tijdsas en bijbehorende peilmoment-queries. De overige systemen bieden hooguit een audit log (Signalen, openRegister) of beperkte materiële tijdsvelden (Open Product).

### Positie van Bitemp Register v06

Het v06-model onderscheidt zich van alle vijf onderzochte systemen door:

1. **Expliciete scheiding van formele en materiële tijd** via de wijzigingstabel + registratiemodel
2. **Tijdreizen op beide assen** via `?t=` (formeel) en materiële aanvang/einde
3. **Audittrail via registraties en wijzigingen**, niet via embedded records of simpele log-entries
4. **Cross-register tijdreizen** als architectureel doel (dezelfde formele tijdsas over meerdere registers)

Meertaligheid is in v06 nog niet geïmplementeerd — dit is een mogelijkheid voor uitbreiding, waarbij de aanpak van Open Product (dedicated vertaal-endpoints per type) als referentie kan dienen.

---

## Bronnen

- [maykinmedia/open-product](https://github.com/maykinmedia/open-product) — API docs, v1.7.0
- [open-formulieren/open-forms](https://github.com/open-formulieren/open-forms) — docs, v3.5.0
- [maykinmedia/open-object](https://github.com/maykinmedia/open-object) — API docs, v4.0.0
- [Signalen/backend](https://github.com/Signalen/backend) — docs/topics/api/v1/private/signals/
- [ConductionNL/openregister](https://github.com/ConductionNL/openregister) — README + openregisters.app/docs
