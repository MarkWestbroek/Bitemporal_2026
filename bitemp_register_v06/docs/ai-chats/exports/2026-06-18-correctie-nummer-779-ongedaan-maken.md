# Chat: Correctie nummer 779 ongedaan maken

- **Datum**: 2026-06-18 12:36
- **Sessie-ID**: `2f3d4b3c-f5c9-414b-a807-4daa691d95ad`
- **Berichten**: 2

---

## 🧑 User

wat is de request om correctie nummer 779 ongedaan te maken?

---

## 🤖 Assistant

Om correctie nummer **779** ongedaan te maken, zijn er twee mogelijkheden:

---

## 1. REST API — `POST /registratie/`

```json
POST /registratie/
Content-Type: application/json

{
  "registratie": {
    "registratietype": "ongedaanmaking",
    "maakt_ongedaan_registratie_id": 779,
    "opmerking": "Foutieve invoer — correctie 779 ongedaan gemaakt"
  },
  "wijzigingen": []
}
```

De `wijzigingen`-lijst is leeg omdat het systeem zelf de omgekeerde wijzigingen berekent op basis van de oorspronkelijke correctie.

---

## 2. GraphQL — typed (voorkeur)

```graphql
mutation {
  maakRegistratieOngedaan(registratie_id: 779, opmerking: "Foutieve invoer") {
    registratie_id
    tijdstip
    message
  }
}
```

Dit is de **geprefereerde** manier (zie ): typed mutation met autocomplete en ingebouwde validatie.

---

## 3. GraphQL — generiek JSON (fallback)

```graphql
mutation {
  maak_ongedaan(input: {
    registratie: {
      registratietype: "ongedaanmaking"
      maakt_ongedaan_registratie_id: 779
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

**Hoe het werkt:** Het 

---
