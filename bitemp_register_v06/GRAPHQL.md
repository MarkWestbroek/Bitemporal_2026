# GraphQL API

## Overview

De GraphQL API biedt een dynamisch, MetaRegistry-gestuurd schema voor het bevragen en muteren van het bitemporele register. Het schema wordt **programmatisch** opgebouwd in Go (geen SDL-bestanden, geen codegen) met de [`graphql-go/graphql`](https://github.com/graphql-go/graphql) library v0.8.1.

Alle entiteiten, gegevenselementen en relaties uit de MetaRegistry worden automatisch als GraphQL types en queries beschikbaar. Bij het toevoegen van een nieuw type aan de MetaRegistry verschijnt het automatisch in het GraphQL schema bij de volgende serverstart.

> **Architectuurdocument**: zie [`docs/dynamische-graphql-laag.md`](docs/dynamische-graphql-laag.md) voor de technische architectuur, ontwerpbeslissingen, type mapping, hub+data flattening, en bestandsstructuur.

## Endpoints

| Endpoint | Methode | Beschrijving |
|----------|---------|-------------|
| `/graphql/playground` | GET | GraphiQL — interactieve IDE met autocompletion en docs |
| `/graphql/query` | POST / GET | Query- en mutation-endpoint |

## Quick start

```bash
# Start de server
go run main.go

# Open GraphiQL
# → http://localhost:8082/graphql/playground
```

### Frontend integratie: 3D Data Universum

Het 3D Data Universum heeft een **REST / GQL toggle** in de toolbar waarmee je live kunt wisselen of data-opvragingen via REST (`/full/{padnaam}`) of via GraphQL (`/graphql/query`) gaan. De queries worden dynamisch opgebouwd uit de schema-metadata. Zie [`docs/3D_UNIVERSUM.md`](docs/3D_UNIVERSUM.md) voor details.

## Queries

### Per entiteit (dynamisch)

Voor elke entiteit in de MetaRegistry worden drie queries gegenereerd:

```graphql
# Volledige entiteit met alle geneste GE's/relaties
full_<padnaam>(id: <Int|String>!, peiltijdstip: DateTime, t: Int) { ... }

# Lijst met paginering (alleen top-level velden, zonder kinderen)
<padnaam>(limit: Int = 20, offset: Int = 0) { ... }

# Lijst met alle onderliggende GE's/relaties, geflattened (hub+data plat, enkelvoudig als object)
full_<padnaam>_list(limit: Int = 20, offset: Int = 0) { ... }
```

De `full_*_list` query is het GraphQL-equivalent van `GET /full/{padnaam}?page=1&size=N`: dezelfde data als `full_<padnaam>` maar dan als lijst. Hub+data flattening en enkelvoudig-unwrapping worden server-side toegepast.

**Formeel tijdreizen**: gebruik `peiltijdstip` (ISO 8601) of de shorthand `t` (uren + microseconden vanaf `2026-01-01T00:00:00Z`). Bij beide geeft `peiltijdstip` voorrang.

### Registraties

```graphql
registratie(id: Int!)        { id, registratietype, tijdstip, opmerking, wijzigingen { ... } }
registraties(limit, offset)  { id, registratietype, tijdstip, opmerking }
```

### Omgekeerde relaties (reverse navigation)

Entiteiten krijgen automatisch `gerelateerde_<bron-padnaam>` velden als andere entiteiten via een relatie naar ze wijzen. Zie de sectie hieronder.

### Forward relaties (FK-navigatie)

Relatie-hubs met een `SecondaireEntiteitIDKolom` (bijv. `gemeente_id` op InitiatiefGemeente) krijgen automatisch een veld met de naam van de doel-entiteit (bijv. `gemeente`). Dit veld laadt de volledige doel-entiteit met alle geneste GE's/relaties — **alleen als het veld daadwerkelijk wordt opgevraagd** in de query. Geen extra DB-queries als je het veld weglaat.

## Mutations

Het schema biedt twee stijlen van mutations die beide actief zijn:

| Stijl | Mutations | Wanneer |
|-------|-----------|---------|
| **Typed** (voorkeur) | `wijzig<X>`, `corrigeer<X>`, `voer<X>Af` | Wijzigingen en correcties op bestaande entiteiten |
| **Generiek JSON** (fallback) | `registreer`, `corrigeer`, `maak_ongedaan` | Initiële opvoer, multi-entiteit, ongedaanmaking |

Beide stijlen roepen dezelfde pure core-functies aan en hebben hetzelfde transactiegedrag en dezelfde audit-trail.

### Typed mutations per entiteit (voorkeur)

Voor elk entiteit-type genereert het schema drie mutations:

```graphql
wijzig<Typenaam>(id: <Int|String>!, patch: <Typenaam>PatchInput!) → JSON
corrigeer<Typenaam>(id: <Int|String>!, patch: <Typenaam>PatchInput!) → JSON
voer<Typenaam>Af(id: <Int|String>!) → JSON
```

- **`wijzig<X>`** — voert één of meer GE's/RELs op als nieuwe versie (registratie-modus). `rel_id` weglaten = nieuwe hub aanmaken.
- **`corrigeer<X>`** — vervangt een bestaande versie; `rel_id` is verplicht per GE (correctie-modus).
- **`voer<X>Af`** — formele afvoer van de entiteit; audit-trail blijft intact.

De modus zit in de naam — geen extra `modus`-arg nodig.

#### PatchInput structuur

De `<Typenaam>PatchInput` is een volledig getypeerde InputObject, dynamisch opgebouwd uit de MetaRegistry bij startup (geen codegen). Elk veld correspondeert met een onderliggend GE of relatie-type als lijst.

Voorbeeld: `NatuurlijkPersoonPatchInput`

```graphql
input NatuurlijkPersoonPatchInput {
  namen:                  [NatuurlijkPersoon_NaamInput]
  persoonsidentificaties: [NatuurlijkPersoon_PersoonsidentificatieInput]
  partnernamen:           [NatuurlijkPersoon_PartnernaamInput]
  naamgebruiken:          [NatuurlijkPersoon_NaamgebruikInput]
  burgerschappen:         [NatuurlijkPersoon_BurgerschapInput]
  bereikbaarheden:        [BereikbaarheidInput]
}

input NatuurlijkPersoon_NaamInput {
  rel_id:        Int     # weglaten bij nieuwe opvoer, verplicht bij correctie
  voorletters:   String
  roepnaam:      String
  tussenvoegsel: String
  achternaam:    String
}

input NatuurlijkPersoon_BurgerschapInput {
  rel_id:        Int
  landcode:      String
  nationaliteit: String
  aanvang:       PlumbingDatumInput   # materieel aanvang
  einde:         PlumbingDatumInput   # materieel einde
}

input BereikbaarheidInput {
  rel_id:     Int
  locatie_id: Int                     # ID van de te koppelen Locatie
  soort:      BereikbaarheidssoortEnum  # Woonadres | Briefadres | Correspondentieadres
  aanvang:    PlumbingDatumInput
  einde:      PlumbingDatumInput
}

input NatuurlijkPersoon_NaamgebruikInput {
  rel_id:      Int
  naamgebruik: NaamgebruiksoortEnum   # EigenNaam | PartnerNaam | EigenNaam-PartnerNaam | PartnerNaam-EigenNaam
}

input PlumbingDatumInput {
  datum: Date   # YYYY-MM-DD
}
```

Voorbeeld:

```graphql
mutation {
  wijzigNatuurlijkPersoon(
    id: 4202
    patch: {
      namen: [{ voorletters: "J.", roepnaam: "Jan", achternaam: "Bakker" }]
      burgerschappen: [{
        landcode: "NL"
        nationaliteit: "Nederlandse"
        aanvang: { datum: "1990-01-01" }
      }]
    }
  ) {
    registratie_id
    tijdstip
    meldingen
  }
}
```

### Generieke JSON mutations (fallback / initiële opvoer)

```graphql
registreer(input: JSON!)     # Nieuwe registratie (opvoer/afvoer van entiteiten en GEs)
corrigeer(input: JSON!)      # Correctie-registratie
maak_ongedaan(input: JSON!)  # Ongedaanmaking van een registratie
```

De `JSON!` scalar accepteert dezelfde payload als de REST `/registratie`-endpoint. Gebruik dit voor:
- **Initiële opvoer** van een nieuwe entiteit (er bestaat nog geen ID om te wijzigen)
- **Multi-entiteit-registraties** in één call (bijv. NP + Locatie + Bereikbaarheid tegelijk)
- **Ongedaanmaking** — heeft geen typed equivalent

> **Tip**: een gangbare aanpak is `registreer` voor de initiële aanmaak en daarna `wijzig<X>` voor alle wijzigingen. Zo combineer je de eenvoud van typed mutations met de flexibiliteit van de generieke opvoer.

## Voorbeelden

### Volledige entiteit ophalen

```graphql
query {
  full_natuurlijk_personen(id: 1) {
    id
    weergavenaam
    namen {
      roepnaam
      achternaam
    }
    burgerschappen {
      nationaliteit
      aanvang { datum }
      einde { datum }
    }
    bereikbaarheden {
      soort
      locatie_id
    }
    aanvang { datum, versie }
  }
}
```

### Lijst met paginering

```graphql
query {
  locaties(limit: 5, offset: 0) {
    id
    weergaveadres
  }
}
```

### Formeel tijdreizen

```graphql
query {
  full_natuurlijk_personen(id: 1, peiltijdstip: "2025-06-01T00:00:00Z") {
    id
    weergavenaam
    namen { achternaam }
  }
}

# Of met shorthand: t=3 → 2026-01-01T03:00:00.000003Z
query {
  full_natuurlijk_personen(id: 1, t: 3) {
    id
    weergavenaam
  }
}
```

### Reverse navigation

Welke NatuurlijkPersonen zijn bereikbaar op Locatie 1?

```graphql
query {
  full_locaties(id: 1) {
    id
    weergaveadres
    adressen {
      straatnaam
      huisnummer
      postcode
      plaats
    }
    gerelateerde_natuurlijk_personen(limit: 10) {
      id
      weergavenaam
      namen {
        roepnaam
        achternaam
      }
    }
  }
}
```

Het veld `gerelateerde_natuurlijk_personen` wordt automatisch gegenereerd omdat er een relatie (Bereikbaarheid) bestaat met `SecondaireEntiteitIDKolom = "locatie_id"`. De resolver voert twee queries uit:

1. `SELECT DISTINCT natuurlijkpersoon_id FROM bereikbaarheid WHERE locatie_id = 1 AND afvoer IS NULL LIMIT 10`
2. Laad die NatuurlijkPersonen met volledige geneste structuur

### Forward FK-navigatie

Welke gemeente hoort bij een InitiatiefGemeente? Diep in één query:

```graphql
query {
  full_initiatieven(id: 1) {
    id
    weergavenaam
    initiatief_gemeenten {
      gemeente_id
      rol
      gemeente {
        id
        gemeentegegevens {
          naam
          code
        }
      }
    }
  }
}
```

Het veld `gemeente` op `InitiatiefGemeente` wordt automatisch gegenereerd omdat de relatie een `SecondaireEntiteitIDKolom = "gemeente_id"` heeft. De resolver laadt de volledige Gemeente-entiteit **alleen als het veld wordt opgevraagd** — laat je `gemeente { ... }` weg, dan blijft de query snel.

### Registreren (mutation)

```graphql
mutation {
  registreer(input: {
    registratie: {
      registratietype: "registratie",
      tijdstip: "2026-04-01T09:00:00Z",
      opmerking: "Opvoer NatuurlijkPersoon"
    },
    wijzigingen: [
      {
        opvoer: {
          natuurlijkpersoon: {
            id: 5,
            namen: [{ roepnaam: "Anna", achternaam: "de Vries" }],
            aanvang: [{ datum: "1995-08-20" }]
          }
        }
      }
    ]
  })
}
```

## Omgekeerde relaties — technisch

Als een relatie A→B bestaat (bijv. Bereikbaarheid: NatuurlijkPersoon → Locatie), krijgt B automatisch een reverse-veld:

| Aspect | Waarde |
|--------|--------|
| Veldnaam | `gerelateerde_<bron-padnaam>` (bijv. `gerelateerde_natuurlijk_personen`) |
| Type | `[<BronEntiteit>]` (lijst) |
| Argument | `limit: Int = 20` (max 100) |
| Filter | Alleen actieve relaties (`afvoer IS NULL`) |

### Hoe het werkt

Bij startup bouwt `buildReverseRelationMap()` een index door alle entiteiten en hun onderliggende relaties te scannen. Relaties met een `SecondaireEntiteitIDKolom` worden herkend als doelrelaties. De doelentiteit wordt gevonden via de conventie `secIDKolom == meta.Veldnaam + "_id"`.

De resolver (`makeReverseRelationResolver`) voert twee database queries uit:
1. Bron-IDs ophalen uit de relatietabel
2. Volledige bron-entiteiten laden met alle geneste GE's/relaties (inclusief hub-flattening)

> Zie [`docs/dynamische-graphql-laag.md`](docs/dynamische-graphql-laag.md) voor de volledige architectuurbeschrijving en ReverseRelationInfo struct.

## Forward relaties — technisch

Als een relatie-hub (GE of relatie) een `SecondaireEntiteitIDKolom` heeft, krijgt het type automatisch een forward-veld dat de doel-entiteit oplevert:

| Aspect | Waarde |
|--------|--------|
| Veldnaam | `<doel-entiteit veldnaam>` (bijv. `gemeente`, `locatie`, `land`) |
| Type | `<DoelEntiteit>` (single object, niet-lijst) |
| Lazy | Resolver wordt alleen getriggerd als het veld daadwerkelijk wordt opgevraagd |
| Nesting | De doel-entiteit wordt volledig geladen met alle geneste GE's/relaties |

### Hoe het werkt

Bij startup bouwt `buildForwardRelationMap()` een index door alle types met een `SecondaireEntiteitIDKolom` te scannen. De doel-entiteit wordt gevonden via `vindDoelEntiteit(secIDKolom)` (conventie: `veldnaam + "_id"`).

De resolver (`makeForwardRelationResolver`) leest de FK-waarde (bijv. `gemeente_id`) uit de geflattende source-map en voert één query uit die de doel-entiteit laadt met alle geneste structuur (inclusief hub-flattening).

**Geen circulaire loops**: alleen forward relaties (van relatie → doel-entiteit) worden opgenomen, niet omgekeerd. Reverse relaties worden separaat afgehandeld via `gerelateerde_*` velden op entiteiten.

## Custom scalars

| Scalar | Go type | Formaat |
|--------|---------|---------|
| `DateTime` | `time.Time` | ISO 8601 / RFC 3339 |
| `Date` | `model.Date` | `YYYY-MM-DD` |
| `JSON` | `interface{}` | Vrij JSON-object |
| `<Naam>Enum` | `string` | Dynamisch via `EnumWaarden` registry |

## Referenties

- [`docs/dynamische-graphql-laag.md`](docs/dynamische-graphql-laag.md) — Architectuurdocument
- [`graphql-go/graphql`](https://github.com/graphql-go/graphql) — Library
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
- [Bun ORM](https://bun.uptrace.dev/)
