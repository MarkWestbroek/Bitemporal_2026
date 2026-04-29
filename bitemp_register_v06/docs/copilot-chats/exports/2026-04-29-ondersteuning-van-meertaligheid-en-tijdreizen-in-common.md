# Chat: Ondersteuning van meertaligheid en tijdreizen in Common Ground

- **Datum**: 2026-04-29 10:56
- **Sessie-ID**: `def89e9a-b62f-421e-81a2-d351a7256974`
- **Berichten**: 4

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
