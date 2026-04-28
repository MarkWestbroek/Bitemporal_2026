# Chat: Structuring JSON for Natural Person Requests

- **Datum**: 2026-04-28 12:08
- **Sessie-ID**: `144edfbf-f7ad-4505-9569-6ea82776a9ce`
- **Berichten**: 1

---

## 🧑 User

Wil je deze request zo omvormen dat alle GE's onder de ENT NP direct eronder vallen?

Dus:
```
 {
      "opvoer": {
        "natuurlijkpersoon": {
          "id": 1
        "persoonsidentificatie": {
          "natuurlijkpersoon_id": 1,
          "bsn": "111222333",
          "ingezetene": true
        }
        }
        enz.
```

```
{
  "registratie": {
    "registratietype": "registratie",
    "opmerking": "Nieuwe NatuurlijkPersoon=1"
  },
  "wijzigingen": [
    {
      "opvoer": {
        "natuurlijkpersoon": {
          "id": 1
        }
      }
    },
    {
      "opvoer": {
        "persoonsidentificatie": {
          "natuurlijkpersoon_id": 1,
          "bsn": "111222333",
          "ingezetene": true
        }
      }
    },
    {
      "opvoer": {
        "naam": {
          "natuurlijkpersoon_id": 1,
          "voorletters": "ABCD",
          "roepnaam": "Ari",
          "achternaam": "van Zap"
        }
      }
    },
    {
      "opvoer": {
        "burgerschap": {
          "natuurlijkpersoon_id": 1,
          "landcode": "nl",
          "nationaliteit": "Nederlandse",
          "aanvang": "1969-02-01"
        }
      }
    },
    {
      "opvoer": {
        "burgerschap": {
          "natuurlijkpersoon_id": 1,
          "landcode": "pl",
          "nationaliteit": "Poolse",
          "aanvang": "2025-05-01"
        }
      }
    },
    {
      "opvoer": {
        "natuurlijkpersoon_aanvang": {
          "natuurlijkpersoon_id": 1,
          "datum": "1969-02-01"
        }
      }
    }
  ]
}
```

---
