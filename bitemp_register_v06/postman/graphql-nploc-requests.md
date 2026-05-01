# GraphQL testrequests — NP-loc domein

Playground: `http://localhost:8082/graphql`  
Postman: maak een GraphQL-request naar `http://localhost:8082/graphql` met body-type **GraphQL**.

Er zijn twee mutation-stijlen:

| Stijl | Mutations | Wanneer |
|-------|-----------|---------|
| **Typed** (voorkeur) | `wijzig<X>`, `corrigeer<X>`, `voer<X>Af` | Wijzigingen op bestaande entiteiten — volledig getypeerd, autocompletion in GraphiQL |
| **Generiek JSON** (fallback) | `registreer`, `corrigeer`, `maak_ongedaan` | Initiële opvoer van nieuwe entiteiten, multi-entiteit, ongedaanmaking |

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
  }
}
```

---

## 2. Typed mutations (voorkeur)

Voor elke bestaande entiteit zijn drie getypeerde mutations beschikbaar.
`patch` is een volledig getypeerde InputObject — GraphiQL toont autocompletion en validatie.

### 2a. Naam toevoegen (nieuwe versie)

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

### 2b. Naam corrigeren

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

### 2c. Meerdere GEs in één mutation

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

### 2d. Burgerschap toevoegen met materieel aanvang en einde

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

### 2e. Bereikbaarheid koppelen aan bestaande Locatie

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

### 2f. Locatie — adres toevoegen

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

### 2g. Locatie — adres corrigeren

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

### 2h. NatuurlijkPersoon afvoeren

```graphql
mutation VoerNPAf {
  voerNatuurlijkPersoonAf(id: 1) {
    registratie_id
    tijdstip
  }
}
```

### 2i. Locatie afvoeren

```graphql
mutation VoerLocatieAf {
  voerLocatieAf(id: 5) {
    registratie_id
    tijdstip
  }
}
```

---

## 3. Generieke JSON mutations (fallback)

Gebruik voor initiële opvoer van nieuwe entiteiten, multi-entiteit-registraties, en ongedaanmaking.  
De body-structuur is identiek aan de REST `/registratie`-endpoint.

### 3a. Opvoer NatuurlijkPersoon (nieuw, inclusief GEs)

Maakt een nieuwe NatuurlijkPersoon aan met naam en BSN in één registratie.

```graphql
mutation OpvoerNP {
  registreer(input: {
    registratie: {
      registratietype: "registratie"
    }
    wijzigingen: [
      {
        representatie: {
          _type: "NatuurlijkPersoon"
        }
        modus: "opvoer"
      }
      {
        representatie: {
          _type: "NatuurlijkPersoon_Naam"
          natuurlijkpersoon_id: 0
          voorletters: "J."
          roepnaam: "Jan"
          achternaam: "Bakker"
        }
        modus: "opvoer"
      }
      {
        representatie: {
          _type: "NatuurlijkPersoon_Persoonsidentificatie"
          natuurlijkpersoon_id: 0
          bsn: "123456789"
          ingezetene: true
        }
        modus: "opvoer"
      }
    ]
  }) {
    registratie_id
    tijdstip
    wijzigingen
  }
}
```

> `natuurlijkpersoon_id: 0` — de engine koppelt dit automatisch via de NP-opvoer in dezelfde registratie.

### 3b. Opvoer Locatie (nieuw, inclusief adres)

```graphql
mutation OpvoerLocatie {
  registreer(input: {
    registratie: {
      registratietype: "registratie"
    }
    wijzigingen: [
      {
        representatie: {
          _type: "Locatie"
        }
        modus: "opvoer"
      }
      {
        representatie: {
          _type: "Locatie_Adres"
          locatie_id: 0
          straatnaam: "Dorpsstraat"
          huisnummer: "12"
          postcode: "1234AB"
          gemeente: 1
          land: 1
        }
        modus: "opvoer"
      }
    ]
  }) {
    registratie_id
    tijdstip
  }
}
```

### 3c. Opvoer met materieel aanvang (genest)

Registreert een NatuurlijkPersoon met geboortedatum als materieel aanvang:

```graphql
mutation OpvoerNPMetAanvang {
  registreer(input: {
    registratie: { registratietype: "registratie" }
    wijzigingen: [
      {
        representatie: {
          _type: "NatuurlijkPersoon"
          aanvang: [{ datum: "1985-03-15" }]
        }
        modus: "opvoer"
      }
    ]
  }) {
    registratie_id
    tijdstip
  }
}
```

---

## 4. Maak ongedaan

```graphql
mutation MaakOngedaan {
  maak_ongedaan(input: {
    registratie: {
      registratietype: "ongedaanmaking"
      corrigeert_registratie_id: 42
    }
    wijzigingen: []
  }) {
    registratie_id
    tijdstip
  }
}
```

---

## 5. Typische testworkflow (typed stijl)

**Aanpak**: maak de entiteit aan via `registreer`, daarna alles via typed mutations.

Stap 1 — Maak een lege NatuurlijkPersoon aan (§3a) → noteer het toegewezen `id` (uit `wijzigingen` in het resultaat)  
Stap 2 — Lees terug (§1b) om het `id` en bestaande `rel_id`s te zien  
Stap 3 — Voeg naam en burgerschap toe (§2c: `wijzigNatuurlijkPersoon` met `id` uit stap 1)  
Stap 4 — Corrigeer de naam (§2b: `corrigeerNatuurlijkPersoon` met `rel_id` uit stap 2)  
Stap 5 — Formeel tijdreizen (§1c) vóór de correctie — je ziet de oude naam nog  
Stap 6 — Voer af (§2h: `voerNatuurlijkPersoonAf`)  
Stap 7 — Maak ongedaan (§4) met het `registratie_id` uit stap 6

---

## Notities

- **Autocompletion**: in GraphiQL werken `wijzig<X>` en `corrigeer<X>` met volledige autocompletion omdat `patch` een getypeerd `InputObject` is. De generieke `registreer`/`corrigeer` accepteren vrij JSON (geen autocompletion op de payload).
- **Veldnamen** in `patch` zijn altijd **snake_case** (JSON-tags van de Go-structs).
- **`rel_id`** is verplicht bij `corrigeer<X>` (correctie-modus), optioneel bij `wijzig<X>` (nieuwe hub bij weglaten).
- **Bereikbaarheid** is een relatie-type: `locatie_id` verwijst naar een bestaande Locatie en is verplicht bij opvoer.
- **Enum-waarden** zijn case-sensitive:
  - Bereikbaarheidssoort: `Woonadres`, `Briefadres`, `Correspondentieadres`
  - Naamgebruiksoort: `EigenNaam`, `PartnerNaam`, `EigenNaam_PartnerNaam`, `PartnerNaam_EigenNaam`
- In Postman: **Body → GraphQL**, variabelen in het `variables`-tabje.


