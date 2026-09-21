# Chat: Toevoegen van domein-parameter aan drop tables API

- **Datum**: 2026-04-08 11:20
- **Sessie-ID**: `0dd764a8-35ab-4a9d-9aa4-afb5abb96a2f`
- **Berichten**: 10

---

## 🧑 User

We hebben nu een mooie drop tables API, maar die zou eigenlijk een domein-parameter moeten hebben: alleen de tables uit een bepaald domein droppen. Kun je die parameter en functie er bij maken?

---

## 🤖 Assistant

Now let me understand the `Domein` field in the MetaRegistry: Now I have a clear picture. Let me also check the `SchemaDomein` model and the existing route registration, plus see the `Registratie`/`Wijziging` tables and their relationship to domains:  Now let me look at the existing  to see how it uses the MetaRegistry, to understand the pattern for domain filtering:  Now I have a complete picture. Let me also check the tests to understand them: Now let me look at the  function in  to understand the route registration: 
```

```
Now add the  function at the end of the file: 
```

```
Now update the handler to accept an optional  query parameter: 
```

```
Now add a test for the domain-specific drop. Let me check the existing test structure more carefully: The existing tests test with , which triggers the "database not initialized" error. I can add a similar test for the domain query param — it will also get 500 (DB not initialized), but it verifies the route accepts the parameter and goes past the auth checks correctly: 
```

```
Now update the README documentation:  
```

```
Build succeeds. Now run the tests:  Alle tests slagen. Hier is een samenvatting van de wijzigingen:

**Wat is er gewijzigd:**

1.  — Nieuwe functies  en  toegevoegd. Deze droppen alleen model-tabellen waarvan  matcht met de opgegeven parameter. Gedeelde plumbing-tabellen (registratie, wijziging) worden niet aangeraakt.

2.  —  handler uitgebreid met optionele query parameter . Met parameter: domein-specifiek droppen. Zonder: bestaand gedrag (alles droppen).

3.  — Twee nieuwe tests:  en .

4.  — Documentatie bijgewerkt met uitleg over de  query parameter en aangepaste curl/Postman voorbeelden.

**Gebruik:**
```bash
# Alles droppen (bestaand)
curl -X DELETE http://localhost:8080/admin/db/droptables/1234

# Alleen domein 'np-loc' droppen
curl -X DELETE "http://localhost:8080/admin/db/droptables/1234?domein=np-loc"
```

---

## 🧑 User

okee, dat werkt. 

Er gebeurt iets dat ik niet verwacht met ApiStandaard (RefLijstItem = ENT) - Naam (GE):
- in de db worden dat de apistandaard en naam en naam_data tabellen

Ik zou verwachten apistandaard_naam en apistandaard_naam_data.

Zoals bij de NP bijv. 

Domein doet hetzelfde .

We hebben iets gewijzigd aan het loskoppelen van Naam (klassenaam) en Typenaam, maar dit zou gebaseerd moeten zijn op het pad van ENT naar GE, zodat je nooit clashes krijgt tussen GE-en met dezelfde naam (bijv. "Naam"), maar onder een andere ENT.

Hoe zit dat nu in de code?

Ik zie in de MR: 
tabelnaam: naam

Dat komt daar in tijdens genereren?

---

## 🤖 Assistant

Helder. Het probleem zit in `geHubTypeName()` — die geeft voor referentielijst-items alleen de korte naam terug (bijv. ) i.p.v. `"ApiStandaard_Naam"`. Daardoor wordt de tabelnaam gewoon `"naam"` i.p.v. `"apistandaard_naam"`.

Laat me de exacte code bekijken en fixen: Nu snap ik het volledig. Laat me ook even kijken hoe  wordt aangeroepen in `gen_registry.go`:   Nu snap ik het volledig. Het probleem is dat  voor referentielijst-items (waar `EntiteitSubtype != ""`) de GE-naam ongeprefixt teruggeeft. De oorspronkelijke gedachte was dat referentielijst-GE's "al volledig gekwalificeerd" zouden zijn (zoals "Landcode"), maar dat klopt niet voor generieke namen als "Naam" of "DomeinGegevens".

Laat me ook even de V3 JSON bekijken om te zien wat de GE-namen zijn:  Nu ook de struct-generatie bekijken — hoe wordt  daar gebruikt: Het is duidelijk:  wordt overal gebruikt en stuurt alle naamgeving. De fix is simpel — voor referentielijst-items moet de entiteitsnaam ook als prefix worden gebruikt, net als bij normale entiteiten. Zo krijg je `ApiStandaard_Naam` → tabel `apistandaard_naam`.

De originele redenering "GE-namen zijn al volledig gekwalificeerd" was ongeldig voor generieke namen als "Naam". De veiligste aanpak is **altijd prefixen**, ongeacht entiteitsubtype. De  (korte naam) wordt al apart afgeleid in . 
```

```
Nu build + test:   Alles groen. Nu moeten we de gegenereerde code opnieuw genereren zodat de CG-metaregistry en structs de nieuwe tabelnamen krijgen. Laat me eerst kijken hoe de codegen wordt aangeroepen:   Nu moet ik de CG-gegenereerde code opnieuw genereren. Laat me kijken welk JSON-invoerbestand er voor CG is:    Laat me de top van  bekijken om de exacte codegen-parameters te achterhalen:  Ik moet kijken welk JSON-bestand als input werd gebruikt voor de CG-generatie. Laat me het meest recente bestand checken, en ook kijken of er een script of Makefile target is:   Geen codegen target in de Makefile. Laat me het meest recente CG JSON-bestand bekijken en de codegen gewoon handmatig draaien. Het laatste bestand is :     Nu verifiëren dat het compileert en de tests draaien:   Alles groen. Laat me verifiëren dat de tabelnamen nu correct zijn in de gegenereerde code:    De tabelnamen zijn nu correct:
-  → `"apistandaard_naam"` ✓
- `"naam_data"` → `"apistandaard_naam_data"` ✓
- `"domeingegevens"` → `"domein_domeingegevens"` ✓
- `"domeingegevens_data"` → `"domein_domeingegevens_data"` ✓

Laat me ook even checken dat de NP-loc code niet beïnvloed is (die was al correct):  NP-loc is ongewijzigd en was al correct. 

**Samenvatting van het probleem en de fix:**

**Probleem:**  in  had een speciale uitzondering voor referentielijst-items (): die kregen geen entiteits-prefix. Hierdoor werd `ApiStandaard` + GE  → tabel  i.p.v. `apistandaard_naam`, wat clashes geeft als meerdere entiteiten een GE met dezelfde naam hebben.

**Fix:** De uitzondering verwijderd. Nu krijgt *elke* GE altijd `Entiteit_GENaam` als Typenaam, ongeacht het entiteitsubtype. De korte weergavenaam () wordt al apart afgeleid in .

**Resultaat na regeneratie:**
| Was | Is nu |
|-----|-------|
|  | `apistandaard_naam` |
| `naam_data` | `apistandaard_naam_data` |
| `domeingegevens` | `domein_domeingegevens` |
| `domeingegevens_data` | `domein_domeingegevens_data` |

NB: de bestaande tabellen in de database hebben nog de oude namen. Na een drop+create (of domein-specifiek: ) worden de nieuwe tabelnamen aangemaakt.

---

## 🧑 User

dat gaat goed. De opvoer van de API standaarden replay file gaat mis, maar ik zie niet waar.


[BODY-LOG] ──── POST /registratie/ → 201 (47ms) ────
[GIN] 2026/04/08 - 12:22:20 | 201 |     46.9002ms |             ::1 | POST     "/registratie/"
[BODY-LOG] ──── POST /registratie/ ────
  Request body:
  {
      "registratie": {
        "id": 0,
        "opmerking": "Seed referentielijst ApiStandaard (gerationaliseerde CG Portfolio lijst)",
        "registratietype": "registratie",
        "tijdstip": "0001-01-01T00:00:00Z"
      },
      "wijzigingen": [
        {
          "opvoer": {
            "apistandaard": {
              "id": 1
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 1,
              "naam": "ZGW API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 2
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 2,
              "naam": "REST API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 3
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 3,
              "naam": "StUF"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 4
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 4,
              "naam": "Haal Centraal BRP Personen API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 5
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 5,
              "naam": "Notificaties API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 6
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 6,
              "naam": "Documenten API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 7
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 7,
              "naam": "OAuth 2.0"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 8
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 8,
              "naam": "Zaken API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 9
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 9,
              "naam": "Catalogi API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 10
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 10,
              "naam": "NL API Strategie"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 11
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 11,
              "naam": "Objecten API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 12
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 12,
              "naam": "Autorisaties API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 13
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 13,
              "naam": "CloudEvents profiel"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 14
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 14,
              "naam": "DSO API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 15
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 15,
              "naam": "JWT"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 16
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 16,
              "naam": "KVK / Handelsregister API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 17
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 17,
              "naam": "OpenAPI"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 18
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 18,
              "naam": "StUF-ZKN"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 19
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 19,
              "naam": "BAG API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 20
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 20,
              "naam": "CMIS"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 21
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 21,
              "naam": "DigiD"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 22
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 22,
              "naam": "MDTO"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 23
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 23,
              "naam": "SAML"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 24
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 24,
              "naam": "WFS"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 25
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 25,
              "naam": "Alfresco Public API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 26
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 26,
              "naam": "BRK API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 27
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 27,
              "naam": "Contactmomenten API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 28
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 28,
              "naam": "DCAT-AP NL"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 29
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 29,
              "naam": "DROP"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 30
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 30,
              "naam": "eHerkenning"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 31
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 31,
              "naam": "GeoJSON"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 32
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 32,
              "naam": "Haal Centraal BRP Bewoning API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 33
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 33,
              "naam": "HAVEN"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 34
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 34,
              "naam": "JSON:API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 35
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 35,
              "naam": "Klanten API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 36
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 36,
              "naam": "Klantinteracties API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 37
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 37,
              "naam": "NLX"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 38
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 38,
              "naam": "Objecttypen API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 39
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 39,
              "naam": "OData"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 40
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 40,
              "naam": "OGC API Features"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 41
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 41,
              "naam": "PDOK services"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 42
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 42,
              "naam": "SDG API / SDG-plus"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 43
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 43,
              "naam": "SensorThings API"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 44
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 44,
              "naam": "StUF-DCR"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 45
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 45,
              "naam": "StUF-FIN"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 46
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 46,
              "naam": "Webhook"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 47
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 47,
              "naam": "WMS"
            }
          }
        },
        {
          "opvoer": {
            "apistandaard": {
              "id": 48
            }
          }
        },
        {
          "opvoer": {
            "naam": {
              "apistandaard_id": 48,
              "naam": "WMTS"
            }
          }
        }
      ]
    }
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=1
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=2
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=3
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=4
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=5
MODELS: representatienaam=ApiStandaard_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=6
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=7
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=8
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=9
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=10
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=11
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=12
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=13
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=14
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=15
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=16
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=17
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=18
MODELS: representatienaam=ApiStandaard_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=19
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=20
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=21
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=22
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=23
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=24
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=25
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=26
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=27
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=28
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=29
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=30
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=31
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=32
MODELS: representatienaam=ApiStandaard_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=33
MODELS: representatienaam=ApiStandaard_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=34
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=35
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=36
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=37
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=38
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=39
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=40
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=41
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=42
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=43
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=44
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=45
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=46
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=47
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
MODELS: representatienaam=ApiStandaard veldnaam=apistandaard metatype=entiteit id=48
MODELS: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam metatype=gegevenselement id=0
Error parsing JSON: unexpected end of JSON input
[bun]  12:22:33.847   BEGIN                 1.051ms  BEGIN
[bun]  12:22:33.848   INSERT                 1.04ms  INSERT INTO "registratie" ("id", "registratietype", "tijdstip", "opmerking", "corrigeert_registratie_id", "maakt_ongedaan_registratie_id", "is_ongedaan_gemaakt", "request_body", "response_body", "response_code", "request_path", "request_method", "duration_ms") VALUES (DEFAULT, 'registratie', '0001-01-01 00:00:00+00:00', 'Seed referentielijst ApiStandaard (gerationaliseerde CG Portfolio lijst)', DEFAULT, DEFAULT, FALSE, '{"registratie":{"id":0,"registratietype":"registratie","tijdstip":"0001-01-01T00:00:00Z","opmerking":"Seed referentielijst ApiStandaard (gerationaliseerde CG Portfolio lijst)"},"wijzigingen":[{"opvoer":{"apistandaard":{"id":1}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":2}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":3}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":4}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":5}}},{"opvoer":{"naam":{"apistandaard_id":5,"rel_id":0,"naam":"Notificaties API"}}},{"opvoer":{"apistandaard":{"id":6}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":7}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":8}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":9}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":10}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":11}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":12}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":13}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":14}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":15}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":16}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":17}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":18}}},{"opvoer":{"naam":{"apistandaard_id":18,"rel_id":0,"naam":"StUF-ZKN"}}},{"opvoer":{"apistandaard":{"id":19}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":20}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":21}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":22}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":23}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":24}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":25}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":26}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":27}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":28}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":29}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":30}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":31}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":32}}},{"opvoer":{"naam":{"apistandaard_id":32,"rel_id":0,"naam":"Haal Centraal BRP Bewoning API"}}},{"opvoer":{"apistandaard":{"id":33}}},{"opvoer":{"naam":{"apistandaard_id":33,"rel_id":0,"naam":"HAVEN"}}},{"opvoer":{"apistandaard":{"id":34}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":35}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":36}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":37}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":38}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":39}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":40}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":41}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":42}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":43}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":44}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":45}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":46}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":47}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":48}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}}]}', DEFAULT, DEFAULT, '/registratie/', 'POST', DEFAULT) RETURNING id
[bun]  12:22:33.848   UPDATE                  505µs  UPDATE "registratie" AS "registratie" SET "registratietype" = 'registratie', "tijdstip" = '2026-01-04 00:00:00.000072+00:00', "opmerking" = 'Seed referentielijst ApiStandaard (gerationaliseerde CG Portfolio lijst)', "corrigeert_registratie_id" = NULL, "maakt_ongedaan_registratie_id" = NULL, "is_ongedaan_gemaakt" = FALSE, "request_body" = '{"registratie":{"id":0,"registratietype":"registratie","tijdstip":"0001-01-01T00:00:00Z","opmerking":"Seed referentielijst ApiStandaard (gerationaliseerde CG Portfolio lijst)"},"wijzigingen":[{"opvoer":{"apistandaard":{"id":1}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":2}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":3}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":4}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":5}}},{"opvoer":{"naam":{"apistandaard_id":5,"rel_id":0,"naam":"Notificaties API"}}},{"opvoer":{"apistandaard":{"id":6}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":7}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":8}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":9}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":10}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":11}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":12}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":13}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":14}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":15}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":16}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":17}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":18}}},{"opvoer":{"naam":{"apistandaard_id":18,"rel_id":0,"naam":"StUF-ZKN"}}},{"opvoer":{"apistandaard":{"id":19}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":20}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":21}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":22}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":23}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":24}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":25}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":26}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":27}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":28}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":29}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":30}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":31}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":32}}},{"opvoer":{"naam":{"apistandaard_id":32,"rel_id":0,"naam":"Haal Centraal BRP Bewoning API"}}},{"opvoer":{"apistandaard":{"id":33}}},{"opvoer":{"naam":{"apistandaard_id":33,"rel_id":0,"naam":"HAVEN"}}},{"opvoer":{"apistandaard":{"id":34}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":35}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":36}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":37}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":38}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":39}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":40}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":41}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":42}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":43}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":44}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":45}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":46}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":47}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}},{"opvoer":{"apistandaard":{"id":48}}},{"opvoer":{"naam":{"natuurlijkpersoon_id":0,"rel_id":0,"voorletters":"","achternaam":""}}}]}', "response_body" = NULL, "response_code" = NULL, "request_path" = '/registratie/', "request_method" = 'POST', "duration_ms" = NULL WHERE (id = 72)
HANDLER: representatienaam=ApiStandaard veldnaam=apistandaard
- representatie: type=model.ApiStandaard metatype=entiteit id=1
  ID=1
HANDLER (meta opvoer): registratietype: registratie
[bun]  12:22:33.849   INSERT                  768µs  INSERT INTO "apistandaard" ("id", "opvoer", "afvoer") VALUES (1, '2026-01-04 00:00:00.000072+00:00', DEFAULT) RETURNING "afvoer"
[bun]  12:22:33.850   INSERT                  620µs  INSERT INTO "wijziging" ("id", "wijzigingstype", "registratie_id", "entiteitnaam", "entiteit_id", "representatienaam", "representatie_id", "versie", "tijdstip", "is_ongedaan_gemaakt") VALUES (DEFAULT, 'opvoer', 72, 'ApiStandaard', '1', '', '', DEFAULT, '2026-01-04 00:00:00.000072+00:00', FALSE) RETURNING "id", "versie"
HANDLER: representatienaam=NatuurlijkPersoon_Naam veldnaam=naam
- representatie: type=model.NatuurlijkPersoon_Naam_Input metatype=gegevenselement id=0
HANDLER (meta opvoer): registratietype: registratie
[BODY-LOG] ──── POST /registratie/ → 500 (6ms) ────
[GIN] 2026/04/08 - 12:22:33 | 500 |      6.7949ms |             ::1 | POST     "/registratie/"
[bun]  12:22:33.850   ROLLBACK                   0s  ROLLBACK

---

## 🤖 Assistant

Daar is het probleem:  met . Laat me die functie bekijken:  Precies. `GetByVeldnaam` retourneert de **eerste** match in de map. Zowel `NatuurlijkPersoon_Naam` als `ApiStandaard_Naam` hebben , en de map-iteratie is niet-deterministisch.

Het probleem: de JSON-payload bevat  — de `apistandaard_id` key geeft aan dat dit een `ApiStandaard_Naam` moet zijn, niet `NatuurlijkPersoon_Naam`. De `UnmarshalJSON` moet disambigueren door naar de  in de payload te kijken.

Laat me de `UnmarshalJSON` fixen zodat hij bij meerdere matches de juiste kiest op basis van de FK-kolom in de JSON-payload:   Nu begrijp ik het volledige plaatje. De `GetByVeldnaam` retourneert de eerste match en negeert dat er meerdere types met dezelfde veldnaam kunnen zijn. De fix moet in de `UnmarshalJSON` — als er meerdere matches zijn, moet hij disambigueren op basis van de  in de payload.

Laat me eerst een betere lookup-functie toevoegen en dan de UnmarshalJSON aanpassen:     
```

```
Nu de `UnmarshalJSON` aanpassen om bij meerdere matches te disambigueren op basis van welke  in de JSON-payload aanwezig is:       
```

```
Alles groen. Nu moet ook de replay-file geüpdatet worden — die stuurt nu  met `"apistandaard_id"`, wat na de fix correct gematcht zal worden. Maar er is nog een subtiliteit: de replay-file heeft de oude veldnaam `"apistandaard_id"` op de GE, en de nieuwe CG structs verwachten die ook. Laat me even de gegenereerde CG struct verifiëren: De struct `ApiStandaard_Naam` heeft  en de MetaRegistry entry heeft . De replay-file stuurt ook `"apistandaard_id"` in de payload. De disambiguatie werkt dus correct: bij  vindt hij `apistandaard_id` in de payload-keys, matcht dat op , en kiest de juiste TypeMeta.

Laat me ook de input-struct checken (die wordt door de Factory aangemaakt):  De `ApiStandaard_Naam_Input` struct heeft  en . De payload uit de replay (`{"apistandaard_id": 1, "naam": "ZGW API"}`) past hier perfect op.

Nu de MetaRegistry entry checken — de Factory moet een `ApiStandaard_Naam_Input` aanmaken:   Alles klopt. De entry op line 32 heeft:
-  
- 
- 

**Samenvatting van het probleem en de fix:**

Na de eerdere  fix hebben zowel `NatuurlijkPersoon_Naam` als `ApiStandaard_Naam` dezelfde . Wanneer de JSON-payload  binnenkomt, gaf  de eerste map-hit terug — willekeurig `NatuurlijkPersoon_Naam` of `ApiStandaard_Naam`.

De fix: een nieuwe  functie in  die:
1. Alle types met dezelfde veldnaam ophaalt via `GetAllByVeldnaam()`
2. Bij meerdere matches: de JSON-payload-keys inspecteert en matcht op de  van elke kandidaat (bijv. `"apistandaard_id"` → `ApiStandaard_Naam`, `"natuurlijkpersoon_id"` → `NatuurlijkPersoon_Naam`)

Herbouw en herstart de server, daarna zou de replay correct moeten werken.

---

## 🧑 User

ik heb de eerste 3 replays succesvol gedraaid voor de import van de portfolio formulieren. Zou je nog eens de vierde willen nalopen of dat allemaal goed zal gaan als ik die replay? (Api standaard en gemeente screenshots zijn het eerste deel van de data alleen; ter verificatie)

---

## 🤖 Assistant

Nu moet ik de MetaRegistry-entries voor deze types controleren, met name de Nu moet ik de MetaRegistry-entries voor deze types controleren, met name de veldnamen en JSON-structuur: Nu de Input-structs controleren voor de velden die in de replay staan:  Nu kan ik de replay-payload matchen met de Input-structs. Laat me nog meer entries uit de replay bekijken om alle patronen te zien:    Nu heb ik alle feiten. Laat me de match controleren:

| Replay-key | Nu heb ik alle feiten. Laat me de match controleren:

| Replay-key | Replay-velden | MR Veldnaam | Input struct velden | Match? |
|---|---|---|---|---|
| `anderdomein` | `initiatief_id`,  | `anderdomein` | `initiatief_id`, `rel_id`,  | ✅ |
| `andersdangemeente` | `initiatief_id`, `andersDanGemeente` | `andersdangemeente` | `initiatief_id`, `rel_id`, `andersDanGemeente` | ✅ |
| `andereapistandaard` | `initiatief_id`, `api_standaard` | `andereapistandaard` | `initiatief_id`, `rel_id`, `api_standaard` | ✅ |

Laat me nog controleren of er ook -clashes zijn (zoals bij "naam"):   Laat me in de gegenereerde metaregistry checken of deze veldnamen uniek zijn:  Alle drie de veldnamen komen exact eenmaal voor in de MetaRegistry — geen clash-risico. Laat me nog een laatste check doen: de  voor deze types, en of de DB-tabellen ook bestaan:   Nu kijk ik nog naar de laatste entries in de replay om te controleren of er geen onverwachte patronen zijn:   Alles ziet er goed uit. Laat me tot slot nog even controleren of er entries zijn die verwijzen naar `initiatief_id`'s die mogelijk niet bestaan (de initiatieven moeten al eerder geregistreerd zijn):    Daar is het. Er bestaat een **stap 4** replay die eerst moet worden uitgevoerd:  — dit bestand maakt de Initiatief-entiteiten aan (IDs 37–127). Dat bestand staat in `docs/ontwerpgedachten/CG PF/` maar is nog niet gekopieerd naar .

Hier mijn conclusie over het 4e replay-bestand ():

**Alles ziet er technisch goed uit:**
- Alle 3 veldnamen (`anderdomein`, `andersdangemeente`, `andereapistandaard`) zijn **uniek** in de MetaRegistry — geen disambiguation-risico zoals bij 
- De JSON payload-velden matchen exact met de gegenereerde Input structs
- De 15 multi-wijziging entries (combinaties van 2–3 types in één registratie) zijn valide
-  is overal `"initiatief_id"`, klopt met de payloads

**Maar er is een blokkerende dependency:**
Het bestand verwijst naar 48 unieke `initiatief_id`'s (range 37–127). Deze Initiatieven worden aangemaakt door **stap 4** van de aanbevolen volgorde uit :

> 

Dat bestand bestaat in `docs/ontwerpgedachten/CG PF/` (772 KB) maar zit **niet** in de  map. Je moet dat bestand **eerst** uitvoeren voordat de "overige velden" replay zal slagen — anders falen de inserts omdat de gerefereerde `initiatief_id`'s niet bestaan.

**Aanbevolen volgorde (stappen 1–3 heb je al gedaan):**
1. ~~Gemeenten CBS 2026~~ ✅
2. ~~Domeinen vast 2026~~ ✅
3. ~~API standaarden rationalisatie 2026~~ ✅
4. **Intake Portfolio Common Ground 2.replay (zonder gemeenten)** ← nog te doen
5. Overige velden ← daarna pas deze

---

## 🧑 User

Ja, maar in Intake Portfolio Common Ground 2.replay (zonder gemeenten).json worden ook known gaps genoemd:

"known_gaps": [
    "Initiatief heeft in cgpf 0.3.7/0.4.4 nog geen uitgewerkte relationele koppeling naar Organisatie voor alle betrokken organisaties; contactorganisaties en leveranciers worden daarom nog steeds als losse seed-entiteiten opgevoerd.",
    "De huidige MetaRegistry gebruikt dezelfde request-key 'contactgegevens' voor Organisatie_Contactgegevens en Persoon_Contactgegevens; deze generator laat die records daarom bewust weg uit het replay-bestand.",
    "Bronwaarden voor producttype, fase en CG-laag zijn rijker dan de huidige enums. De generator normaliseert die waarden en bewaart de ruwe bronwaarde in registratie.opmerking.",
    "Voor gemeente, domein en API-standaard geldt nu: match op de referentielijst => REL opvoeren; geen match => opslaan in het bijbehorende overig-GE (`anderdomein`, `andersdangemeente`, `andereapistandaard`).",
    "Wanneer de losse seed-replays voor gemeenten, domeinen en API-standaarden aanwezig zijn, gebruikt de generator die als bron en worden die referenties niet opnieuw in dit replay-bestand geseed."
  ],

# destilleren relaties
*Uit Intake Portfolio Common Ground 1.replay.json moeten nog de relaties naar organisatie en persoon gedestilleerd worden.*
  Toen deze analyse van 1 naar 2 gedaan werd, had ik in het model (4.6.1) (en dus in de metaregistry, want het CG register is nu compleet gegenereerd) de relaties tussen Initiatief en Organisatie en Persoon nog niet gelegd. Misschien ook de relatie tussen Organisatie en Persoon ook niet, dat weet ik niet meer zeker. (Andere chat op andere computer, al moet deze terug te vinden zijn in de docs / chat exports).

# rationaliseren organisaties
Verder zie ik dat de organisaties nog 'rijp en groen door elkaar' zijn. Een allegaartje. Men heeft van alles ingevuld.
Voorbeelden:
- 'pas toe of leg uit' is een heel rare organisatienaam. Het is een lijst bij de VNG die zegt wat je zou moeten toepassen, en indien niet, dat je dat moet uitleggen.
- "Alle leveranciers die hosting diensten leveren vanuit de publieke cloud zouden Haven moeten toepassen op basis van het principe" is een stelling, geen organisatie
- 6 = Appsemble, 7 = Appsemble B.V.  -> dat is natuurlijk dezelfde
- 2 en 8 zijn allebei ASE Cloud Services
- 18 en 19 zijn Centric, maar 19 heeft de contactpersoon er bij gezet: Centric: Jeroen van Amersfoort
- 21 en 22 en 23 is Conduction
- 23 is een lijst van  5:
     - Conduction B.V
     - Yard
     - Acato
     - Sim Groep
     - Xxllnc
 - 25 idem: 3 stuks
 - 31 een hele zin na de leverancier = Delta10
 - 32 Den Haag = een gemeente -> moet eigenlijk in InitiatiefGemeente vastgelegd
 - 34 een hele zin   
 - enz.

 Ik zou alles wat niet netjes mapt naar een organisatie (of meer, ik heb InitiatiefOrganisatie meervoudig gemaakt! Dat is nodig voor de lijstjes van leveranciers of gemeenten) willen opnemen in de nieuwe GE "OrganisatieInfo". Ik moet die nog genereren, maar staat al in het model v0.5.2. Zodat er geen informatie uit het formulier verloren gaat.

---

## 🤖 Assistant

Laat me eerst de delta analyseren tussen v0.4.6.1 (huidige codegen) en v0.5.2 (doel), en de Python generator bekijken. Laat me eerst het OrganisatieInfo GE in v0.5.2 exact bekijken, en dan de codegen draaien. Goed, ik heb nu een helder beeld. Laat me dit stap voor stap aanpakken:

**Delta v0.4.6.1 → v0.5.2:**
1. `InitiatiefOrganisatie.momentvoorkomen`: `enkelvoudig` → `meervoudig`
2. **Nieuw**: `OrganisatieInfo` GE onder `Initiatief` (veld: `informatie`, string)
3. `Product` veldvolgorde: `CG_laag` naar positie 3

**Opgemerkt**: In v0.5.2 heeft de OrganisatieInfo GE  — dat moet `"OrganisatieInfo"` zijn (editorexport-omissie). Laat me dat eerst fixen, dan codegen draaien, en daarna de Python generator uitbreiden. Nu de codegen draaien met v0.5.2: Codegen geslaagd. Laat me controleren of het compileert en of de nieuwe types correct zijn: Alle tests groen. Laat me nu de gegenereerde types verifiëren: Codegen geslaagd, alle types correct:
- `Initiatief_OrganisatieInfo_Input` met  + `informatie`
- `InitiatiefOrganisatie_Input` met  +  +  (Organisatierol, optional)
- `InitiatiefOrganisatie` is nu **meervoudig**

Nu de Python generator updaten. Laat me eerst bekijken welke organisatiedata er in de intake zit:  Goed — `Organisatierol` heeft nu `Contactorganisatie` en `BetrokkenOrganisatie`. Nu de Python generator updaten. Ik ga:

1. **Org-rationalisatie** toevoegen: aliases-map, blacklist, en clean/messy classificatie
2. **`match_organisaties()`** functie (analoog aan )
3. **** uitbreiden met `initiatieforganisatie` + `organisatieinfo`
4. **Known gaps** updaten Now let me read the full  to see exactly where to add the org logic: Now let me look at the seed entries for exactly how organisatierol is generated: Nu heb ik genoeg context. Ik ga de Python generator uitbreiden met 7 gerichte edits: 
```

```
Nu de `match_organisaties()` functie toevoegen na : 
```

```
Nu  bijwerken — de org-collectie moet alleen clean namen opnemen en door ORG_ALIASES normaliseren:  
```

```
Nu `organisaties_lookup` toevoegen aan de return dict van :  
```

```
Nu moet ik `organisaties_lookup` daadwerkelijk vullen. Laat me bekijken waar de return dict wordt afgebouwd:  
```

```
Hmm, ik moet de return value opslaan in een variabele. Laat me dat fixen:   
```

```
Nu  updaten — verwijder de `organisatierol` changes (dat GE heeft geen velden meer in v0.5.2):   
```

```
Nu het belangrijkste: voeg organisatie-matching en OrganisatieInfo-emissie toe aan . Ik voeg het toe na het API-standaarden blok:    
```

```
Nu de `known_gaps` updaten:     
```

```
Nu een test draaien om te kijken of de generator nog werkt:  Werkt. Laat me de output analyseren:    Uitstekend! De nieuwe velden zijn er:
- **`initiatieforganisatie`: 196** relaties (clean org matches)
- **`organisatieinfo`: 21** ongestructureerde tekst-entries
- **`organisatie`: 123** geseed (was 154, nu gerationaliseerd naar 123)

Laat me even kijken welke OrganisatieInfo entries er zijn:   Er zijn 4 dubbele IDs in de brondata (96-99) — dat is een bestaand data-kwaliteitsprobleem, niet veroorzaakt door mijn wijzigingen.

De generator werkt correct. Laat me nu de definitieve replay genereren:  Nu het "overige velden" replay 3 bestand. Dit wordt nu grotendeels overbodig aangezien de hoofdreplay (2) al `anderdomein`, `andersdangemeente`, `andereapistandaard`, `initiatieforganisatie` en `organisatieinfo` bevat. Maar de overige velden replay in  was specifiek voor de niet-in-de-hoofdreplay opgenomen data. Laat me controleren of er overlap is:      Replay 3 is inderdaad volledig overbodig — alle keys zitten al in replay 2. Laat me nu de documentatie bijwerken. Eerst de huidige replay-mapping bekijken: Nu de  bijwerken met alle wijzigingen van deze sessie: 
```

```
Nu een nieuw kopje toevoegen over de organisatie-rationalisatie in v0.5.2: Nu een sectie toevoegen over de organisatie-rationalisatie vóór de "Aanbevolen vervolgstappen": 
```

```
En de referentie naar het Generator-voorbeeld bijwerken (het pad was nog macOS-stijl):  
```

```
Alle taken zijn afgerond. Samenvatting van wat er gedaan is:

**Model v0.5.2 codegen:**
- `OrganisatieInfo` GE naam gefixed (was leeg) en codegen gedraaid → alle `cg_*.go` bestanden bijgewerkt
- `InitiatiefOrganisatie` is nu meervoudig, `OrganisatieInfo` GE heeft veld `informatie`

**Python generator ():**
- ~40  voor naamvarianten → canonieke namen
-  filtert zinnen, testdata, lange teksten
-  koppelt opgeschoonde namen als `initiatieforganisatie` relaties
- Ongestructureerde tekst → `organisatieinfo.informatie` (geen dataverlies)
- 154 ruwe namen → **123 canonieke organisaties**, **196 relaties**, **21 organisatieinfo** entries

**Replay 3 (overige velden) is nu overbodig** — alle keys (`anderdomein`, `andereapistandaard`, `andersdangemeente`) zitten al in replay 2.

**Documentatie:**  bijgewerkt met model-upgrade, org-rationalisatie, replay 3 deprecatie en bijgewerkte vervolgstappen.

**Voordat je de replays opnieuw uitvoert:** de bestaande CG-tabellen moeten gedropt worden via `DELETE /admin/db/droptables/<wachtwoord>?domein=CG` en opnieuw aangemaakt, vanwege de modelwijzigingen in v0.5.2.

---
