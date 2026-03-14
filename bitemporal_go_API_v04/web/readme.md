# Web Visualisatie - Actiebox Uitleg

Dit document beschrijft de actieboxen in `index_schema.html`.

## Overzicht

Er zijn twee soorten actieboxen:

1. Representatie-actiebox (GE/relatie)
2. Entiteit-actiebox (centrale entiteit)

## 1) Representatie-actiebox (GE/relatie)

Openen:

- Klik op een GE-node of relatie-node in de SVG.

Beschikbare acties:

- Afvoeren
- Corrigeren

### Afvoeren (GE/relatie)

Verstuurt een gewone registratie met een `afvoer` wijziging.

### Corrigeren (GE/relatie)

Verstuurt een registratie met `registratietype: "correctie"` en alleen een `opvoer` wijziging.

Belangrijk:

- De `rel_id` in de payload is het te corrigeren record.
- De API handelt de afsluiting van het bestaande record zelf af.
- Er hoeft geen aparte `afvoer` in de request te staan.

Voorbeeld (vereenvoudigd):

```json
{
  "registratie": {
    "registratietype": "correctie",
    "opmerking": "Corrigeer bestaand record"
  },
  "wijzigingen": [
    {
      "opvoer": {
        "w": {
          "a_id": 1,
          "rel_id": 3,
          "www": 1.26535
        }
      }
    }
  ]
}
```

## 2) Entiteit-actiebox (centrale entiteit)

Openen:

- Klik op de centrale entiteitbox in de SVG.

Beschikbare acties:

- Entiteit afvoeren
- Gegevenselementen (GEs) toevoegen
- Relaties toevoegen

Niet toegestaan:

- Entiteit corrigeren

### Entiteit afvoeren

Verstuurt een gewone registratie met een `afvoer` op de entiteit.

### GEs en relaties toevoegen (meerdere records, meerdere types)

Je kunt in de entiteit-actiebox:

- Meerdere GE-regels toevoegen
- Per regel een GE-type kiezen
- Per regel type-specifieke velden invullen in een formulier (geen raw JSON)
- Meerdere relatie-regels toevoegen
- Per relatie-regel een relatietype kiezen
- Voor de secondaire FK (bijv. `b_id`) een dropdown met suggesties krijgen

Bij verzenden:

- Alle regels worden in een enkele registratie verstuurd
- Elke regel wordt een aparte `opvoer` wijziging met de eigen veldnaam van het type
- Voorbeelden van veldnamen: `u`, `v`, `w`, `rel_a_b`

Details over de formulier-velden:

- De zichtbare velden worden primair uit `/api/viz/schema` gehaald (reflectie op structs).
- Als schema-velden ontbreken, valt de UI terug op afleiding uit bestaande records.
- `omitempty` uit de Go `json` tags wordt in schema vertaald naar verplicht/niet-verplicht.
- Plumbing-velden zoals `rel_id`, `opvoer`, `afvoer`, `aanvang` en `einde` worden niet als invoerveld getoond.
- Lege velden worden niet meegestuurd in de payload.
- Typeconversie gebeurt automatisch bij verzenden:
  - getalvelden -> number
  - booleanvelden -> true/false
  - tekstvelden -> string
- Voor relaties wordt de primaire FK (bijv. `a_id`) automatisch gevuld met de geselecteerde entiteit.
- Voor relaties wordt de secondaire FK via endpoint `/api/viz/relatie/:typenaam/secondaire-ids` opgehaald.

Voorbeeld (vereenvoudigd):

```json
{
  "registratie": {
    "registratietype": "registratie",
    "opmerking": "Voeg meerdere GEs toe"
  },
  "wijzigingen": [
    {
      "opvoer": {
        "u": {
          "a_id": 1,
          "aaa": "u1",
          "bbb": "u2"
        }
      }
    },
    {
      "opvoer": {
        "w": {
          "a_id": 1,
          "www": 0.5
        }
      }
    },
    {
      "opvoer": {
        "rel_a_b": {
          "a_id": 1,
          "b_id": 3
        }
      }
    }
  ]
}
```

## API-overzicht voor de UI

- `GET /api/viz/schema`
  - Levert typemetadata voor de visualisatie en formulieren (velden, typen, verplicht/niet-verplicht, onderliggende types).
- `GET /api/viz/relatie/:typenaam/secondaire-ids`
  - Levert suggesties voor secondaire entiteit-IDs (distinct actieve IDs) voor relatieformulieren.
- `GET /full/as/?t=<peilmoment>` en `GET /full/bs/?t=<peilmoment>`
  - Levert de actuele entiteiten met onderliggende GEs/relaties voor het gekozen peilmoment.
- `GET /full/registraties/:id`
  - Levert de gekozen registratie met wijzigingen (o.a. voor selectie/afleiding in de UI).
- `POST /registratie/`
  - Verwerkt alle mutaties vanuit de actieboxen (afvoer, opvoer, correctie).

## Praktische notities

- Plumbing-velden zoals `opvoer` en `afvoer` worden niet handmatig ingevoerd; de API bepaalt deze.
- IDs van nieuwe GE/relatie-records worden door de database/API toegekend.
- Na succesvolle actie wordt de visualisatie opnieuw geladen.
