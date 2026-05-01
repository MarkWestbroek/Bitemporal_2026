# GraphQL testrequests — NP-loc domein

Playground: `http://localhost:8082/graphql`  
Postman: maak een GraphQL-request naar `http://localhost:8082/graphql` met body-type **GraphQL**.

Er zijn twee mutation-stijlen:

| Stijl | Mutations | Wanneer |
|-------|-----------|---------|
| **Typed** (voorkeur) | `wijzig<X>`, `corrigeer<X>`, `voer<X>Af`, `maakRegistratieOngedaan` | Wijzigingen op bestaande entiteiten en ongedaanmakingen — volledig getypeerd, autocompletion in GraphiQL |
| **Generiek JSON** (fallback) | `registreer`, `corrigeer`, `maak_ongedaan` | Initiële opvoer van nieuwe entiteiten (entiteit-id bestaat nog niet), multi-entiteit-registraties in één call |

In de praktijk loopt een complete NP-flow grotendeels typed; alleen de **eerste** opvoer-call gaat via `registreer` omdat er nog geen NP-id is om een typed mutation op te kunnen toepassen.

IDs in de voorbeelden zijn fictief — pas aan naar wat in jouw DB staat.

---

## 1. Queries

### 1a. Lijst NatuurlijkPersonen

```graphql
query LijstNP {
  natuurlijk_personen(limit: 10, offset: 0) {
    id
    opvoer
    afvoer
  }
}
```

### 1b. Volledige NatuurlijkPersoon (actueel)

```graphql
query VolledgeNP {
  full_natuurlijk_personen(id: 1) {
    id
    opvoer
    afvoer
    namen {
      rel_id
      opvoer
      afvoer
      data {
        versie
        voorletters
        roepnaam
        tussenvoegsel
        achternaam
        opvoer
        afvoer
      }
    }
    persoonsidentificaties {
      rel_id
      data {
        versie
        bsn
        ingezetene
      }
    }
    burgerschappen {
      rel_id
      data {
        versie
        landcode
        nationaliteit
      }
      aanvang {
        versie
        datum
      }
      einde {
        versie
        datum
      }
    }
    naamgebruiken {
      rel_id
      data {
        versie
        naamgebruik
      }
    }
    bereikbaarheden {
      rel_id
      locatie_id
      data {
        versie
        soort
      }
    }
    aanvang {
      versie
      datum
    }
    einde {
      versie
      datum
    }
  }
}
```

### 1c. Formeel tijdreizen — NP op peiltijdstip

```graphql
query NPOpPeiltijdstip {
  full_natuurlijk_personen(
    id: 1
    peiltijdstip: "2025-06-01T00:00:00Z"
  ) {
    id
    namen {
      data {
        voorletters
        achternaam
        opvoer
        afvoer
      }
    }
  }
}
```

### 1d. Lijst Locaties

```graphql
query LijstLocaties {
  locaties(limit: 10, offset: 0) {
    id
    opvoer
    afvoer
  }
}
```

### 1e. Volledige Locatie

```graphql
query VolledgeLocatie {
  full_locaties(id: 1) {
    id
    opvoer
    afvoer
    adressen {
      rel_id
      data {
        versie
        straatnaam
        huisnummer
        postcode
        gemeente
        land
      }
    }
    baglocaties {
      rel_id
      data {
        versie
        adresaanduiding
      }
    }
    aanvang {
      versie
      datum
    }
    einde {
      versie
      datum
    }
  }
}
```

### 1f. Recente registraties

```graphql
query RecenteRegistraties {
  registraties(limit: 5, offset: 0) {
    id
    tijdstip
    registratietype
    corrigeert_registratie_id
    is_ongedaangemaakt
    domeinen
  }
}
```

### 1g. Eén registratie met al haar wijzigingen

Elke registratie en haar wijzigingen zijn via GraphQL inzichtelijk (read-only — wijzigen kan niet, ongedaan maken wel: zie §4).

```graphql
query RegistratieDetail {
  registratie(id: 42) {
    id
    tijdstip
    registratietype
    opmerking
    corrigeert_registratie_id
    maakt_ongedaan_registratie_id
    is_ongedaangemaakt
    domeinen
    wijzigingen {
      id
      wijzigingstype
      entiteitnaam
      entiteit_id
      representatienaam
      representatie_id
      versie
      tijdstip
      is_ongedaangemaakt
    }
  }
}
```

---

## 2. Typed mutations (voorkeur) — volledige NP-flow

De natuurlijke 3B-stijl flow voor een NP loopt zo:

1. **Initiële opvoer** via `registreer` (één call die de entiteit + meteen meerdere GE's aanmaakt) — er bestaat nog geen NP-id om typed mutations op te kunnen toepassen.
2. **Daarna alles typed**: `wijzigNatuurlijkPersoon`, `corrigeerNatuurlijkPersoon`, `voerNatuurlijkPersoonAf`.
3. **Ongedaanmaking** via `maakRegistratieOngedaan(registratie_id)` — typed, werkt op een registratie (niet op een entiteit).

De initiële `registreer`-call gebruikt nog een JSON-payload; alle vervolgstappen zijn volledig getypeerd met `<Typenaam>PatchInput`.

### 2a. Initiële NP-opvoer — eenvoudig

Minimum: alleen NP + één naam.

```graphql
mutation OpvoerNPEenvoudig {
  registreer(input: {
    registratie: { registratietype: "registratie" }
    wijzigingen: [
      {
        modus: "opvoer"
        representatie: { _type: "NatuurlijkPersoon" }
      }
      {
        modus: "opvoer"
        representatie: {
          _type: "NatuurlijkPersoon_Naam"
          natuurlijkpersoon_id: 0
          voorletters: "J."
          roepnaam: "Jan"
          achternaam: "Bakker"
        }
      }
    ]
  }) {
    registratie_id
    tijdstip
    wijzigingen
  }
}
```

> `natuurlijkpersoon_id: 0` verwijst naar de NP-opvoer in dezelfde registratie; de engine vult het toegewezen ID automatisch in. Lees daarna `wijzigingen` uit het resultaat om het echte NP-id te vinden.

### 2b. Initiële NP-opvoer — uitgebreid

In de praktijk worden bij een eerste registratie vrijwel alle bekende gegevens tegelijk opgevoerd: naam, BSN, geboortedatum (materieel aanvang), burgerschap, naamgebruik en eventueel bereikbaarheid naar een al bestaande Locatie.

```graphql
mutation OpvoerNPUitgebreid {
  registreer(input: {
    registratie: {
      registratietype: "registratie"
      opmerking: "Initiële registratie via GraphQL"
    }
    wijzigingen: [
      {
        modus: "opvoer"
        representatie: {
          _type: "NatuurlijkPersoon"
          aanvang: [{ datum: "1985-03-15" }]
        }
      }
      {
        modus: "opvoer"
        representatie: {
          _type: "NatuurlijkPersoon_Naam"
          natuurlijkpersoon_id: 0
          voorletters: "A.M."
          roepnaam: "Anna"
          tussenvoegsel: "de"
          achternaam: "Vries"
        }
      }
      {
        modus: "opvoer"
        representatie: {
          _type: "NatuurlijkPersoon_Persoonsidentificatie"
          natuurlijkpersoon_id: 0
          bsn: "123456789"
          ingezetene: true
        }
      }
      {
        modus: "opvoer"
        representatie: {
          _type: "NatuurlijkPersoon_Burgerschap"
          natuurlijkpersoon_id: 0
          landcode: "NL"
          nationaliteit: "Nederlandse"
          aanvang: [{ datum: "1985-03-15" }]
        }
      }
      {
        modus: "opvoer"
        representatie: {
          _type: "NatuurlijkPersoon_Naamgebruik"
          natuurlijkpersoon_id: 0
          naamgebruik: "EigenNaam"
        }
      }
      {
        modus: "opvoer"
        representatie: {
          _type: "Bereikbaarheid"
          natuurlijkpersoon_id: 0
          locatie_id: 5
          soort: "Woonadres"
          aanvang: [{ datum: "2024-03-01" }]
        }
      }
    ]
  }) {
    registratie_id
    tijdstip
    wijzigingen
  }
}
```

> Vanaf hier zijn alle vervolgmutaties typed — zie §2c en verder.

### 2c. Naam toevoegen (nieuwe versie)

Voegt een nieuwe naamversie toe aan een bestaande NatuurlijkPersoon.  
Geen `rel_id` — er wordt een nieuwe hub + data aangemaakt.

```graphql
mutation WijzigNPNaam {
  wijzigNatuurlijkPersoon(
    id: 1
    patch: {
      namen: [
        {
          voorletters: "J.P."
          roepnaam: "Johannes"
          tussenvoegsel: "van"
          achternaam: "Bakker"
        }
      ]
    }
  ) {
    registratie_id
    tijdstip
    modus
    meldingen
  }
}
```

### 2d. Naam corrigeren

Correctie van een bestaande naamversie: `rel_id` verplicht.

```graphql
mutation CorrigeerNPNaam {
  corrigeerNatuurlijkPersoon(
    id: 1
    patch: {
      namen: [
        {
          rel_id: 1
          voorletters: "J.P."
          roepnaam: "Johannes"
          tussenvoegsel: "van"
          achternaam: "Bakker-Smit"
        }
      ]
    }
  ) {
    registratie_id
    tijdstip
    modus
    meldingen
  }
}
```

### 2e. Meerdere GEs in één mutation

Naam + burgerschap + naamgebruik in één registratie:

```graphql
mutation WijzigNPVolledig {
  wijzigNatuurlijkPersoon(
    id: 1
    patch: {
      namen: [
        {
          voorletters: "A."
          roepnaam: "Anna"
          achternaam: "de Vries"
        }
      ]
      burgerschappen: [
        {
          landcode: "NL"
          nationaliteit: "Nederlandse"
          aanvang: { datum: "1985-03-15" }
        }
      ]
      naamgebruiken: [
        {
          naamgebruik: EigenNaam
        }
      ]
    }
  ) {
    registratie_id
    tijdstip
    meldingen
  }
}
```

### 2f. Burgerschap toevoegen met materieel aanvang en einde

```graphql
mutation WijzigNPBurgerschap {
  wijzigNatuurlijkPersoon(
    id: 1
    patch: {
      burgerschappen: [
        {
          landcode: "DE"
          nationaliteit: "Duitse"
          aanvang: { datum: "2010-06-01" }
          einde:   { datum: "2020-12-31" }
        }
      ]
    }
  ) {
    registratie_id
    tijdstip
    meldingen
  }
}
```

### 2g. Bereikbaarheid koppelen aan bestaande Locatie

```graphql
mutation WijzigBereikbaarheid {
  wijzigNatuurlijkPersoon(
    id: 1
    patch: {
      bereikbaarheden: [
        {
          locatie_id: 5
          soort: Woonadres
          aanvang: { datum: "2024-03-01" }
        }
      ]
    }
  ) {
    registratie_id
    tijdstip
    meldingen
  }
}
```

### 2h. Locatie — adres toevoegen

```graphql
mutation WijzigLocatieAdres {
  wijzigLocatie(
    id: 5
    patch: {
      adressen: [
        {
          straatnaam: "Hoofdstraat"
          huisnummer: "1"
          postcode: "2000AA"
          gemeente: 1
          land: 1
        }
      ]
    }
  ) {
    registratie_id
    tijdstip
    meldingen
  }
}
```

### 2i. Locatie — adres corrigeren

```graphql
mutation CorrigeerLocatieAdres {
  corrigeerLocatie(
    id: 5
    patch: {
      adressen: [
        {
          rel_id: 1
          straatnaam: "Hoofdstraat"
          huisnummer: "1a"
          postcode: "2000AA"
          gemeente: 1
          land: 1
        }
      ]
    }
  ) {
    registratie_id
    tijdstip
    meldingen
  }
}
```

### 2j. NatuurlijkPersoon afvoeren

```graphql
mutation VoerNPAf {
  voerNatuurlijkPersoonAf(id: 1) {
    registratie_id
    tijdstip
  }
}
```

### 2k. Locatie afvoeren

```graphql
mutation VoerLocatieAf {
  voerLocatieAf(id: 5) {
    registratie_id
    tijdstip
  }
}
```

---

## 3. Generieke JSON mutations (fallback / bulk-ops)

De initiële `registreer`-call uit §2a/§2b is óók een generieke JSON-mutation, maar past natuurlijk in de 3B-flow. Deze sectie toont de overige fallback-vormen voor:

- multi-entiteit-registraties in één call (bijv. Locatie + adres samen)
- complexe correcties die niet in één `corrigeer<X>` passen
- (oudere) clients die geen typed schema gebruiken

De body-structuur is identiek aan de REST `/registratie`-endpoint.

### 3a. Opvoer Locatie (nieuw, inclusief adres)

```graphql
mutation OpvoerLocatie {
  registreer(input: {
    registratie: { registratietype: "registratie" }
    wijzigingen: [
      {
        modus: "opvoer"
        representatie: { _type: "Locatie" }
      }
      {
        modus: "opvoer"
        representatie: {
          _type: "Locatie_Adres"
          locatie_id: 0
          straatnaam: "Dorpsstraat"
          huisnummer: "12"
          postcode: "1234AB"
          gemeente: 1
          land: 1
        }
      }
    ]
  }) {
    registratie_id
    tijdstip
  }
}
```

### 3b. Combineerde opvoer NP + Locatie + bereikbaarheid (multi-entiteit)

Wanneer de NP en de Locatie tegelijk nieuw zijn, kan dat in één registratie:

```graphql
mutation OpvoerNPMetNieuweLocatie {
  registreer(input: {
    registratie: { registratietype: "registratie" }
    wijzigingen: [
      { modus: "opvoer", representatie: { _type: "NatuurlijkPersoon" } }
      { modus: "opvoer", representatie: {
          _type: "NatuurlijkPersoon_Naam"
          natuurlijkpersoon_id: 0
          voorletters: "P.", achternaam: "Jansen"
      }}
      { modus: "opvoer", representatie: { _type: "Locatie" } }
      { modus: "opvoer", representatie: {
          _type: "Locatie_Adres"
          locatie_id: 0
          straatnaam: "Kerkstraat", huisnummer: "5"
          postcode: "3000AB", gemeente: 1, land: 1
      }}
      { modus: "opvoer", representatie: {
          _type: "Bereikbaarheid"
          natuurlijkpersoon_id: 0
          locatie_id: 0
          soort: "Woonadres"
      }}
    ]
  }) {
    registratie_id
    tijdstip
    wijzigingen
  }
}
```

> Beide `*_id: 0` placeholders worden naar de juiste opvoer in dezelfde registratie gekoppeld.

---

## 4. Maak registratie ongedaan

### 4a. Typed (voorkeur)

Werkt direct op het `registratie_id` — geen JSON-body nodig.

```graphql
mutation OngedaanRegistratie {
  maakRegistratieOngedaan(
    registratie_id: 42
    opmerking: "Foutieve invoer"
  ) {
    registratie_id
    tijdstip
    wijzigingen
  }
}
```

### 4b. Generiek JSON (fallback)

```graphql
mutation MaakOngedaan {
  maak_ongedaan(input: {
    registratie: {
      registratietype: "ongedaanmaking"
      corrigeert_registratie_id: 42
      opmerking: "Foutieve invoer"
    }
    wijzigingen: []
  }) {
    registratie_id
    tijdstip
  }
}
```

---

## 5. Typische testworkflow (volledige 3B-stijl)

| Stap | Actie | Sectie | Mutation/Query |
|------|-------|--------|----------------|
| 1 | Initiële opvoer NP (uitgebreid: naam, BSN, burgerschap, naamgebruik, bereikbaarheid) | §2b | `registreer` |
| 2 | Lees terug — noteer NP `id` en `rel_id`s | §1b | `full_natuurlijk_personen` |
| 3 | Voeg een tweede naam toe (geen `rel_id`) | §2c | `wijzigNatuurlijkPersoon` |
| 4 | Corrigeer eerste naam (`rel_id` verplicht) | §2d | `corrigeerNatuurlijkPersoon` |
| 5 | Formeel tijdreizen vóór correctie — je ziet de oude naam nog | §1c | `full_natuurlijk_personen(peiltijdstip:)` |
| 6 | Bekijk audit-trail van de correctie-registratie | §1g | `registratie(id)` |
| 7 | Voer NP af | §2j | `voerNatuurlijkPersoonAf` |
| 8 | Maak de afvoer ongedaan | §4a | `maakRegistratieOngedaan` |

---

## Notities

- **Twee mutation-stijlen, één core**: zowel typed als generiek JSON gaan door dezelfde `RegistreerCore` engine — audit-trail en transactiegedrag zijn identiek.
- **Typed is de voorkeur**: `wijzig<X>`, `corrigeer<X>`, `voer<X>Af` en `maakRegistratieOngedaan` hebben volledige autocompletion en validatie in GraphiQL omdat alle inputs getypeerde `InputObject` types zijn.
- **Initiële opvoer is nog JSON**: er bestaat (nog) geen typed `opvoer<X>` omdat een nieuwe entiteit nog geen ID heeft. Voor de allereerste call gebruik je `registreer`; daarna alles typed.
- **Registraties en wijzigingen zijn read-only zichtbaar** via `registratie(id)` en `registraties(limit, offset)`. Wijzigen kan niet — ongedaan maken wel via `maakRegistratieOngedaan`.
- **Veldnamen** in `patch` zijn altijd **snake_case** (JSON-tags van de Go-structs).
- **`rel_id`** is verplicht bij `corrigeer<X>` (correctie-modus), optioneel bij `wijzig<X>` (nieuwe hub bij weglaten).
- **Bereikbaarheid** is een relatie-type: `locatie_id` verwijst naar een bestaande Locatie en is verplicht bij opvoer.
- **Enum-waarden** zijn case-sensitive:
  - Bereikbaarheidssoort: `Woonadres`, `Briefadres`, `Correspondentieadres`
  - Naamgebruiksoort: `EigenNaam`, `PartnerNaam`, `EigenNaam-PartnerNaam`, `PartnerNaam-EigenNaam`
- In Postman: **Body → GraphQL**, variabelen in het `variables`-tabje.


