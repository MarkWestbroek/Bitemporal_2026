# Registratie-patronen — Sequence Diagrams

Dit document beschrijft de kernmechanica van de registratie-API (`POST /registratie/`) aan de hand van Mermaid sequence diagrams voor de belangrijkste scenario's.

Elk diagram toont de aanroepketen van de main handler (`RegistreerMetNieuweAanpak`) door de helpers heen tot aan DB-niveau (logische bun-operaties).

---

## Legenda

| Participant        | Betekenis                                                    |
| ------------------ | ------------------------------------------------------------ |
| **Client**         | De API-aanroeper (frontend, Postman, test)                   |
| **Handler**        | `RegistreerMetNieuweAanpak()` in `registration_handlers.go` |
| **OpvoerHelper**   | `handleRepresentatieOpvoer()` in `registration_helpers_generiek.go` |
| **AfvoerHelper**   | `handleRepresentatieAfvoer()` in `registration_helpers_generiek.go` |
| **VoorgHelper**    | `sluitActieveEnkelvoudigeVoorgangersAf()` — alleen bij enkelvoudige GE's |
| **OntOpvoerHelper**| `handleRepresentatieOntOpvoer()` — ongedaanmaking opvoer     |
| **OntAfvoerHelper**| `handleRepresentatieOntAfvoer()` — ongedaanmaking afvoer     |
| **Helpers**        | Diverse hulpfuncties (`vindEntiteitContext`, `bepaalRepIDenVersie`, etc.) |
| **DB**             | PostgreSQL via bun ORM                                       |

---

## 1. Opvoer van een nieuwe entiteit (met onderliggende GE's)

Typisch scenario: opvoer van entiteit A met onderliggende hub A_U (die _Data, _Aanvang, _Einde bevat).

```mermaid
sequenceDiagram
    participant Client
    participant Handler
    participant OpvoerHelper
    participant Helpers
    participant DB

    Client->>Handler: POST /registratie/<br/>{ registratie, wijzigingen: [{ opvoer: { a: { id:1, us:[...] } } }] }
    
    Handler->>DB: BEGIN transaction
    Handler->>DB: INSERT registratie → RETURNING id
    Handler->>DB: UPDATE registratie SET tijdstip (afgeleid)

    Note over Handler: Loop over wijzigingen

    Handler->>OpvoerHelper: handleRepresentatieOpvoer(registratie, "", "", "A", temporalRep)
    
    Note over OpvoerHelper: meta = MetaRegistry["A"]<br/>metatype = entiteit

    OpvoerHelper->>DB: INSERT INTO a (id, opvoer, ...) → entiteit-record
    OpvoerHelper->>DB: INSERT INTO wijziging (type=opvoer, entiteitnaam="A", entiteit_id="1")

    Note over OpvoerHelper: Recursie: A heeft onderliggende GE's<br/>(via GeefOnderliggendeGegevenselementen)

    loop Elk onderliggend GE (bijv. A_U hub)
        OpvoerHelper->>OpvoerHelper: handleRepresentatieOpvoer("A", "1", "A_U", hubRep)
        
        Note over OpvoerHelper: meta = MetaRegistry["A_U"]<br/>GESubtype = hub, enkelvoudig

        OpvoerHelper->>OpvoerHelper: sluitActieveEnkelvoudigeVoorgangersAf()
        Note over OpvoerHelper: Geen voorgangers (eerste opvoer)

        OpvoerHelper->>Helpers: vindEntiteitContext() → "A", "1"
        OpvoerHelper->>Helpers: checkBovenliggendeEntiteitActief()
        Helpers->>DB: SELECT a WHERE id=1 AND afvoer IS NULL

        OpvoerHelper->>DB: INSERT INTO a_u (a_id, rel_id, opvoer, ...) → hub-record
        OpvoerHelper->>DB: INSERT INTO wijziging (type=opvoer, ent="A", ent_id="1", rep="A_U", rep_id="1")

        Note over OpvoerHelper: Hub-recursie: A_U heeft _Data, _Aanvang, _Einde

        loop Elk hub-kind (A_U_Data, A_U_Aanvang, ...)
            OpvoerHelper->>OpvoerHelper: handleRepresentatieOpvoer("A", "1", "A_U_Data", dataRep)
            
            Note over OpvoerHelper: GESubtype = data, enkelvoudig

            OpvoerHelper->>OpvoerHelper: sluitActieveEnkelvoudigeVoorgangersAf()
            Note over OpvoerHelper: Compound scope: a_id + rel_id
            OpvoerHelper->>DB: SELECT versie FROM a_u_data WHERE a_id=1 AND rel_id=1 AND opvoer IS NOT NULL AND afvoer IS NULL
            Note over OpvoerHelper: Geen voorganger → skip

            OpvoerHelper->>DB: INSERT INTO a_u_data (a_id, rel_id, versie, opvoer, ...) → data-record
            OpvoerHelper->>DB: INSERT INTO wijziging (type=opvoer, ent="A", ent_id="1", rep="A_U_Data", rep_id="1", versie=1)
        end
    end

    Handler->>DB: UPDATE registratie SET response_code, response_body, duration_ms
    Handler->>DB: COMMIT
    Handler-->>Client: 201 { message, registratie_id, tijdstip, wijzigingen }
```

---

## 2. Opvoer van een enkelvoudig GE (vorige wordt automatisch afgevoerd)

Scenario: er bestaat al A_U rel_id=1 met _Data versie=1. We voeren een nieuwe versie op. De vorige versie wordt automatisch afgevoerd.

```mermaid
sequenceDiagram
    participant Client
    participant Handler
    participant OpvoerHelper
    participant VoorgHelper
    participant Helpers
    participant DB

    Client->>Handler: POST /registratie/<br/>{ registratie, wijzigingen: [{ opvoer: { a_u: { a_id:1, rel_id:1, aaa:"nieuw" } } }] }

    Handler->>DB: BEGIN transaction
    Handler->>DB: INSERT registratie → RETURNING id
    Handler->>DB: UPDATE registratie SET tijdstip

    Handler->>OpvoerHelper: handleRepresentatieOpvoer(registratie, "", "", "A_U", hubRep)

    Note over OpvoerHelper: meta = MetaRegistry["A_U"]<br/>GESubtype = hub, enkelvoudig

    Note over OpvoerHelper: Input is platte _Input struct → inputNaarHub conversie
    OpvoerHelper->>Helpers: inputNaarHub(input, meta)
    Note over Helpers: kopieerMatchendeVelden → hub velden (a_id, rel_id)<br/>kopieerMatchendeVelden → data velden (aaa, bbb)
    Helpers-->>OpvoerHelper: hub met Data[] populated

    OpvoerHelper->>VoorgHelper: sluitActieveEnkelvoudigeVoorgangersAf("A_U", hubRep, meta)
    
    Note over VoorgHelper: Zoek actieve A_U bij a_id=1

    VoorgHelper->>DB: SELECT rel_id FROM a_u WHERE a_id=1 AND opvoer IS NOT NULL AND afvoer IS NULL
    DB-->>VoorgHelper: [1] (rel_id=1 is actief)

    VoorgHelper->>DB: UPDATE a_u SET afvoer=t WHERE rel_id=1 AND a_id=1
    VoorgHelper->>DB: INSERT INTO wijziging (type=afvoer, ent="A", ent_id="1", rep="A_U", rep_id="1")

    VoorgHelper-->>OpvoerHelper: done

    OpvoerHelper->>Helpers: vindEntiteitContext() → "A", "1"
    OpvoerHelper->>Helpers: checkBovenliggendeEntiteitActief()
    Helpers->>DB: SELECT a WHERE id=1 AND afvoer IS NULL → OK

    OpvoerHelper->>DB: INSERT INTO a_u (a_id, rel_id, opvoer, ...) → nieuw hub-record (rel_id=2)
    OpvoerHelper->>DB: INSERT INTO wijziging (type=opvoer, ent="A", ent_id="1", rep="A_U", rep_id="2")

    Note over OpvoerHelper: Hub-recursie: verwerk _Data, _Aanvang, _Einde

    loop Elk hub-kind (A_U_Data)
        OpvoerHelper->>OpvoerHelper: handleRepresentatieOpvoer("A", "1", "A_U_Data", dataRep)
        OpvoerHelper->>VoorgHelper: sluitActieveEnkelvoudigeVoorgangersAf()
        VoorgHelper->>DB: SELECT versie FROM a_u_data WHERE a_id=1 AND rel_id=2 AND opvoer IS NOT NULL AND afvoer IS NULL
        Note over VoorgHelper: Geen voorganger bij nieuwe rel_id → skip
        OpvoerHelper->>DB: INSERT INTO a_u_data (...) → data versie=1
        OpvoerHelper->>DB: INSERT INTO wijziging (type=opvoer, rep="A_U_Data", rep_id="2", versie=1)
    end

    Handler->>DB: UPDATE registratie SET response_code, response_body, duration_ms
    Handler->>DB: COMMIT
    Handler-->>Client: 201 { message, registratie_id, wijzigingen }
```

---

## 3. Afvoer van een individueel GE (zonder vervanging)

Scenario: afvoer van A_U rel_id=1 bij entiteit A id=1. Geen nieuw record wordt opgevoerd.

```mermaid
sequenceDiagram
    participant Client
    participant Handler
    participant AfvoerHelper
    participant Helpers
    participant DB

    Client->>Handler: POST /registratie/<br/>{ registratie, wijzigingen: [{ afvoer: { a_u: { a_id:1, rel_id:1 } } }] }

    Handler->>DB: BEGIN transaction
    Handler->>DB: INSERT registratie → RETURNING id
    Handler->>DB: UPDATE registratie SET tijdstip

    Handler->>AfvoerHelper: handleRepresentatieAfvoer(regID, tijdstip, "", "", "A_U", temporalRep)

    Note over AfvoerHelper: meta = MetaRegistry["A_U"]<br/>GESubtype = hub

    AfvoerHelper->>DB: SELECT * FROM a_u WHERE rel_id=1 AND a_id=1 → huidigeRep
    Note over AfvoerHelper: Check: afvoer IS NULL → OK (niet eerder afgevoerd)

    AfvoerHelper->>Helpers: vindEntiteitContext() → "A", "1"

    Note over AfvoerHelper: Hub afvoer: afvoer hub zelf + onderliggende kinderen

    AfvoerHelper->>DB: UPDATE a_u SET afvoer=t WHERE rel_id=1 AND a_id=1
    AfvoerHelper->>DB: INSERT INTO wijziging (type=afvoer, ent="A", ent_id="1", rep="A_U", rep_id="1")

    AfvoerHelper->>Helpers: haalIntWaardeVoorKolomUitRepresentatie → a_id=1, rel_id=1

    loop Elk hub-kind (A_U_Data, A_U_Aanvang, A_U_Einde)
        AfvoerHelper->>DB: SELECT versie FROM a_u_data WHERE a_id=1 AND rel_id=1 AND opvoer IS NOT NULL AND afvoer IS NULL
        DB-->>AfvoerHelper: [1] (versie 1 actief)
        AfvoerHelper->>DB: UPDATE a_u_data SET afvoer=t WHERE versie=1 AND a_id=1 AND rel_id=1
        AfvoerHelper->>DB: INSERT INTO wijziging (type=afvoer, ent="A", ent_id="1", rep="A_U_Data", rep_id="1", versie=1)
    end

    Handler->>DB: UPDATE registratie SET response_code, response_body, duration_ms
    Handler->>DB: COMMIT
    Handler-->>Client: 201 { message, registratie_id, wijzigingen }
```

---

## 4. Afvoer van een entiteit (cascading naar alle onderliggende GE's)

Scenario: afvoer van entiteit A id=1, met actieve onderliggende GE's (A_U, A_V, etc.).

```mermaid
sequenceDiagram
    participant Client
    participant Handler
    participant AfvoerHelper
    participant Helpers
    participant DB

    Client->>Handler: POST /registratie/<br/>{ registratie, wijzigingen: [{ afvoer: { a: { id:1 } } }] }

    Handler->>DB: BEGIN transaction
    Handler->>DB: INSERT registratie → RETURNING id
    Handler->>DB: UPDATE registratie SET tijdstip

    Handler->>AfvoerHelper: handleRepresentatieAfvoer(regID, tijdstip, "", "", "A", temporalRep)

    Note over AfvoerHelper: meta = MetaRegistry["A"]<br/>metatype = entiteit

    AfvoerHelper->>DB: SELECT * FROM a WHERE id=1 → huidigeRep
    Note over AfvoerHelper: Check: afvoer IS NULL → OK

    AfvoerHelper->>DB: UPDATE a SET afvoer=t WHERE id=1
    AfvoerHelper->>DB: INSERT INTO wijziging (type=afvoer, ent="A", ent_id="1")

    Note over AfvoerHelper: Doorloop OnderliggendeGE's van A<br/>(A_U, A_V, A_W, A_Aanvang, A_Einde, ...)

    loop Elk onderliggend GE-type (bijv. A_U)
        AfvoerHelper->>DB: SELECT rel_id FROM a_u WHERE a_id=1 AND opvoer IS NOT NULL AND afvoer IS NULL
        DB-->>AfvoerHelper: [1, 2] (twee actieve hubs)

        loop Elk actief record (rel_id=1, 2)
            AfvoerHelper->>DB: UPDATE a_u SET afvoer=t WHERE rel_id=1 AND a_id=1
            AfvoerHelper->>DB: INSERT INTO wijziging (type=afvoer, ent="A", ent_id="1", rep="A_U", rep_id="1")
        end
    end

    loop Elk ander onderliggend type (A_V, A_Aanvang, ...)
        AfvoerHelper->>DB: SELECT id/versie FROM [tabel] WHERE a_id=1 AND opvoer IS NOT NULL AND afvoer IS NULL
        loop Elk actief record
            AfvoerHelper->>DB: UPDATE [tabel] SET afvoer=t WHERE [pk]=...
            AfvoerHelper->>DB: INSERT INTO wijziging (type=afvoer, ent="A", ent_id="1", rep=[type], ...)
        end
    end

    Handler->>DB: UPDATE registratie SET response_code, response_body, duration_ms
    Handler->>DB: COMMIT
    Handler-->>Client: 201 { message, registratie_id, wijzigingen }
```

---

## 5. Correctie van een GE (afvoer oud + opvoer nieuw)

Scenario: correctie van A_U rel_id=3 (niet-hub GE) bij entiteit A id=2. Het oude record wordt afgevoerd en een nieuw record met gecorrigeerde data wordt opgevoerd.

```mermaid
sequenceDiagram
    participant Client
    participant Handler
    participant OpvoerHelper
    participant AfvoerHelper
    participant Helpers
    participant DB

    Client->>Handler: POST /registratie/<br/>{ registratie: { registratietype: "correctie",<br/>corrigeert_registratie_id: 1 },<br/>wijzigingen: [{ opvoer: { a: { id:2, us: [{ rel_id:3, aaa:"gecorrigeerd" }] } } }] }

    Handler->>DB: BEGIN transaction
    Handler->>DB: INSERT registratie → RETURNING id
    Handler->>DB: UPDATE registratie SET tijdstip

    Handler->>OpvoerHelper: handleRepresentatieOpvoer(registratie, "", "", "A", temporalRep)

    Note over OpvoerHelper: meta = MetaRegistry["A"]<br/>metatype = entiteit, registratietype = correctie

    Note over OpvoerHelper: Correctie + Entiteit → skip INSERT voor entiteit zelf<br/>(entiteit blijft intact, alleen GE's worden gecorrigeerd)

    Note over OpvoerHelper: Recursie: verwerk onderliggende A_U hub

    OpvoerHelper->>OpvoerHelper: handleRepresentatieOpvoer("A", "2", "A_U", hubRep)
    Note over OpvoerHelper: Correctie + Hub → skip INSERT voor hub<br/>(hub blijft intact, alleen data wisselt)

    Note over OpvoerHelper: Hub-recursie: verwerk A_U_Data

    OpvoerHelper->>OpvoerHelper: handleRepresentatieOpvoer("A", "2", "A_U_Data", dataRep)
    Note over OpvoerHelper: Correctie + Data subtype:<br/>data-subtypes worden via enkelvoudig-voorgangers afgehandeld

    OpvoerHelper->>OpvoerHelper: sluitActieveEnkelvoudigeVoorgangersAf()
    OpvoerHelper->>DB: SELECT versie FROM a_u_data WHERE a_id=2 AND rel_id=3<br/>AND opvoer IS NOT NULL AND afvoer IS NULL
    DB-->>OpvoerHelper: [1] (versie 1 actief)
    OpvoerHelper->>DB: UPDATE a_u_data SET afvoer=t WHERE versie=1 AND a_id=2 AND rel_id=3
    OpvoerHelper->>DB: INSERT INTO wijziging (type=afvoer, ent="A", ent_id="2", rep="A_U_Data", rep_id="3", versie=1)

    OpvoerHelper->>DB: INSERT INTO a_u_data (a_id, rel_id, versie, opvoer, aaa, ...)<br/>→ versie=2, aaa="gecorrigeerd"
    OpvoerHelper->>DB: INSERT INTO wijziging (type=opvoer, ent="A", ent_id="2", rep="A_U_Data", rep_id="3", versie=2)

    Handler->>DB: UPDATE registratie SET response_code, response_body, duration_ms
    Handler->>DB: COMMIT
    Handler-->>Client: 201 { message, registratie_id, wijzigingen }
```

---

## 6a. Correctie van een niet-hub GE (legacy pad)

Scenario: correctie van een niet-hub GE (bijv. legacy `A_V` met directe velden). Het oude record wordt afgevoerd en een nieuw record opgevoerd.

```mermaid
sequenceDiagram
    participant Client
    participant Handler
    participant OpvoerHelper
    participant AfvoerHelper
    participant Helpers
    participant DB

    Client->>Handler: POST /registratie/<br/>{ registratie: { registratietype: "correctie", ... },<br/>wijzigingen: [{ opvoer: { a_v: { a_id:2, rel_id:5, veld_x:"corrected" } } }] }

    Handler->>DB: BEGIN + INSERT registratie + UPDATE tijdstip

    Handler->>OpvoerHelper: handleRepresentatieOpvoer(registratie, "", "", "A_V", temporalRep)

    Note over OpvoerHelper: meta = MetaRegistry["A_V"]<br/>metatype = gegevenselement, geen hub, geen data-subtype<br/>→ correctie-pad actief

    OpvoerHelper->>Helpers: haalIntWaardeVoorKolomUitRepresentatie(rep, "a_id") → 2
    OpvoerHelper->>DB: SELECT * FROM a_v WHERE rel_id=5 AND a_id=2 → huidigeRep
    Note over OpvoerHelper: Check: afvoer IS NULL → OK (niet eerder afgevoerd)

    Note over OpvoerHelper: Afvoer bestaand record via handleRepresentatieAfvoer

    OpvoerHelper->>AfvoerHelper: handleRepresentatieAfvoer(regID, t, "A", "2", "A_V", huidigeRep)
    AfvoerHelper->>DB: SELECT * FROM a_v WHERE rel_id=5 AND a_id=2 → check
    AfvoerHelper->>DB: UPDATE a_v SET afvoer=t WHERE rel_id=5 AND a_id=2
    AfvoerHelper->>Helpers: vindEntiteitContext() → "A", "2"
    AfvoerHelper->>DB: INSERT INTO wijziging (type=afvoer, ent="A", ent_id="2", rep="A_V", rep_id="5")

    Note over OpvoerHelper: ClearID() → rel_id wordt leeg<br/>zodat autoincrement nieuw ID toekent

    OpvoerHelper->>Helpers: vindEntiteitContext() → "A", "2"
    OpvoerHelper->>Helpers: checkBovenliggendeEntiteitActief()
    Helpers->>DB: SELECT a WHERE id=2 → OK

    OpvoerHelper->>DB: INSERT INTO a_v (a_id, rel_id, opvoer, veld_x, ...)<br/>→ nieuw rel_id=6, veld_x="corrected"
    OpvoerHelper->>DB: INSERT INTO wijziging (type=opvoer, ent="A", ent_id="2", rep="A_V", rep_id="6")

    Handler->>DB: UPDATE registratie + COMMIT
    Handler-->>Client: 201 { message, registratie_id, wijzigingen }
```

---

## 7. Ongedaanmaking van een registratie

Scenario: ongedaanmaking van registratie #3, die twee wijzigingen bevatte: een opvoer en een afvoer. Alle mutaties worden teruggedraaid.

```mermaid
sequenceDiagram
    participant Client
    participant Handler
    participant OntOpvoerHelper
    participant OntAfvoerHelper
    participant DB

    Client->>Handler: POST /registratie/<br/>{ registratie: { registratietype: "ongedaanmaking",<br/>maakt_ongedaan_registratie_id: 3 } }

    Handler->>DB: BEGIN transaction
    Handler->>DB: INSERT registratie (type=ongedaanmaking) → RETURNING id
    Handler->>DB: UPDATE registratie SET tijdstip

    Note over Handler: === Validaties ===

    Handler->>DB: SELECT * FROM registratie WHERE id=3 → ongedaanTeMakenRegistratie
    Note over Handler: Check: bestaat? ✓<br/>Check: is_ongedaan_gemaakt = false? ✓<br/>Check: is zelf geen ongedaanmaking? ✓

    Handler->>DB: SELECT * FROM wijziging WHERE registratie_id=3
    DB-->>Handler: [wijz_1 (opvoer A_U), wijz_2 (afvoer A_V)]

    Note over Handler: Check per wijziging: geen latere wijzigingen<br/>op dezelfde elementen na registratie #3

    loop Per wijziging: check op latere wijzigingen
        Handler->>DB: SELECT FROM wijziging<br/>WHERE registratie_id ≠ 3<br/>AND tijdstip > t(reg3) AND tijdstip ≤ t(nu)<br/>AND entiteitnaam/id = ... AND representatienaam/id = ...
        DB-->>Handler: [] (geen latere wijzigingen → OK)
    end

    Note over Handler: === Uitvoering ===

    loop Per wijziging onder registratie #3
        alt Wijziging was opvoer → ont-opvoeren
            Handler->>OntOpvoerHelper: handleRepresentatieOntOpvoer(tx, wijziging)
            OntOpvoerHelper->>OntOpvoerHelper: meta = MetaRegistry[representatienaam]
            OntOpvoerHelper->>OntOpvoerHelper: parseStringNaarKolomType(ID)
            OntOpvoerHelper->>DB: UPDATE [tabel] SET opvoer = NULL<br/>WHERE [pk]=... (+ PFK WHERE indien nodig)
            Note over DB: Record wordt "nooit opgevoerd"
        else Wijziging was afvoer → ont-afvoeren
            Handler->>OntAfvoerHelper: handleRepresentatieOntAfvoer(tx, wijziging)
            OntAfvoerHelper->>OntAfvoerHelper: meta = MetaRegistry[representatienaam]
            OntAfvoerHelper->>OntAfvoerHelper: parseStringNaarKolomType(ID)
            OntAfvoerHelper->>DB: UPDATE [tabel] SET afvoer = NULL<br/>WHERE [pk]=... (+ PFK WHERE indien nodig)
            Note over DB: Record is weer geldig/actueel
        end
    end

    Note over Handler: Markeer originele registratie als ongedaan gemaakt

    Handler->>DB: UPDATE registratie SET is_ongedaan_gemaakt=true WHERE id=3
    Handler->>DB: UPDATE wijziging SET is_ongedaan_gemaakt=true WHERE registratie_id=3

    Handler->>DB: UPDATE registratie SET response_code, response_body, duration_ms
    Handler->>DB: COMMIT
    Handler-->>Client: 201 { message, registratie_id, wijzigingen }
```

---

## 8. Ongedaanmaking van een correctie

Conceptueel identiek aan scenario 7: de correctie-registratie bevatte afvoer-wijzigingen (voor de oude records) en opvoer-wijzigingen (voor de gecorrigeerde records). De ongedaanmaking draait beide soorten terug.

```mermaid
sequenceDiagram
    participant Client
    participant Handler
    participant OntOpvoerHelper
    participant OntAfvoerHelper
    participant DB

    Client->>Handler: POST /registratie/<br/>{ registratie: { registratietype: "ongedaanmaking",<br/>maakt_ongedaan_registratie_id: 5 } }
    Note over Handler: Registratie #5 was een correctie met:<br/>wijz_1: afvoer A_U_Data versie=1<br/>wijz_2: opvoer A_U_Data versie=2

    Handler->>DB: BEGIN + INSERT registratie + UPDATE tijdstip

    Handler->>DB: Validaties (zie scenario 7)

    Handler->>DB: SELECT * FROM wijziging WHERE registratie_id=5
    DB-->>Handler: [wijz_1 (afvoer, versie=1), wijz_2 (opvoer, versie=2)]

    Note over Handler: Verwerk elke wijziging in volgorde

    Handler->>OntAfvoerHelper: handleRepresentatieOntAfvoer(tx, wijz_1)
    Note over OntAfvoerHelper: wijz_1 was afvoer → herstel door afvoer = NULL
    OntAfvoerHelper->>DB: UPDATE a_u_data SET afvoer = NULL<br/>WHERE versie=1 AND a_id=... AND rel_id=...
    Note over DB: Oude data versie 1 is weer actief

    Handler->>OntOpvoerHelper: handleRepresentatieOntOpvoer(tx, wijz_2)
    Note over OntOpvoerHelper: wijz_2 was opvoer → herstel door opvoer = NULL
    OntOpvoerHelper->>DB: UPDATE a_u_data SET opvoer = NULL<br/>WHERE versie=2 AND a_id=... AND rel_id=...
    Note over DB: Gecorrigeerde versie 2 is "nooit opgevoerd"

    Handler->>DB: UPDATE registratie SET is_ongedaan_gemaakt=true WHERE id=5
    Handler->>DB: UPDATE wijziging SET is_ongedaan_gemaakt=true WHERE registratie_id=5

    Handler->>DB: COMMIT
    Handler-->>Client: 201 { message }
```

---

## Samenvatting operaties per scenario

| Scenario                                | Aantal wijzigingen | DB INSERTs representatie | DB UPDATEs representatie | DB INSERTs wijziging |
| --------------------------------------- | ------------------ | ------------------------ | ------------------------ | -------------------- |
| 1. Opvoer nieuwe entiteit + GE's        | N (1 per rep)      | N                        | 0                        | N                    |
| 2. Opvoer enkelvoudig GE (vervanging)   | 2 (afvoer oud + opvoer nieuw) | 1 (nieuw)     | 1 (afvoer oud)           | 2                    |
| 3. Afvoer individueel GE (hub)          | 1 + kinderen       | 0                        | 1 + kinderen             | 1 + kinderen         |
| 4. Afvoer entiteit (cascading)          | 1 + alle GE's      | 0                        | 1 + alle GE's            | 1 + alle GE's        |
| 5. Correctie (hub/data)                 | 2 (afvoer data + opvoer data) | 1 (nieuw data) | 1 (afvoer data)         | 2                    |
| 6a. Correctie (legacy GE)              | 2 (afvoer oud + opvoer nieuw) | 1 (nieuw)     | 1 (afvoer oud)           | 2                    |
| 7. Ongedaanmaking registratie          | 0 (geen nieuwe)    | 0                        | N (opvoer→NULL, afvoer→NULL) | 0                |
| 8. Ongedaanmaking correctie            | 0 (geen nieuwe)    | 0                        | 2 (afvoer→NULL, opvoer→NULL) | 0                |

---

## Referenties broncode

| Bestand                                       | Functies                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| `handlers/registration_handlers.go`           | `RegistreerMetNieuweAanpak()` — main handler + ongedaanmaking-logica      |
| `handlers/registration_helpers_generiek.go`   | `handleRepresentatieOpvoer()`, `handleRepresentatieAfvoer()`, `handleRepresentatieOntOpvoer()`, `handleRepresentatieOntAfvoer()`, `sluitActieveEnkelvoudigeVoorgangersAf()`, `persisteerWijziging()`, `updateAfvoerByID()`, `haalRepresentatieUitDB()`, `vindEntiteitContext()`, `inputNaarHub()`, `bepaalRepIDenVersie()`, `haalActieveIDsMetScope()`, `updateAfvoerMetScope()` |
| `model/REST request models.go`                | `RepresentatiePlusNaam.UnmarshalJSON()` — parse van opvoer/afvoer JSON-sleutels naar representatie-types |

---

## Veldnaam-disambiguatie bij het parsen van opvoer/afvoer

Binnen de `wijzigingen[]`-array wordt elke `opvoer` en `afvoer` geparseerd door `RepresentatiePlusNaam.UnmarshalJSON()` in `model/REST request models.go`. De JSON-sleutel (bijv. `"naam"`) wordt via de MetaRegistry opgezocht naar een concreet representatietype.

### Probleem: gedeelde veldnamen

Meerdere types kunnen dezelfde `Veldnaam` hebben. Bijvoorbeeld:

| Veldnaam | Types met die veldnaam          |
| -------- | ------------------------------- |
| `naam`   | `ApiStandaard_Naam`, `NatuurlijkPersoon_Naam`, `Land_Naam`, ... |

Een simpele `GetByVeldnaam("naam")` retourneert de eerste match (niet-deterministisch op basis van map-iteratievolgorde), wat leidt tot fouten.

### Oplossing: `GetByVeldnaamMetPayload()`

De parser extraheert de JSON-sleutels uit de inner payload (bijv. `{ "apistandaard_id": 8, "naam": "Zaken API" }`) en roept `MetaRegistry.GetByVeldnaamMetPayload(veldnaam, payloadKeys)` aan. Die functie disambigueert op `EntiteitIDKolom`:

```
veldnaam = "naam", payloadKeys = {"apistandaard_id", "naam"}
→ candidate ApiStandaard_Naam heeft EntiteitIDKolom = "apistandaard_id" → match ✓
→ candidate NatuurlijkPersoon_Naam heeft EntiteitIDKolom = "natuurlijk_persoon_id" → geen match
→ retourneert ApiStandaard_Naam
```

Als geen enkele kandidaat disambigueerbaar is, wordt de eerste kandidaat als fallback geretourneerd en een `WARN`-melding naar stderr geschreven.

### Vereiste payload-conventies

Zorg dat elke GE-opvoer het `EntiteitIDKolom` van de bovenliggende entiteit bevat, ook als het ID al bekend is uit de context. Voorbeeld:

```json
{
  "opvoer": {
    "naam": {
      "apistandaard_id": 8,
      "naam": "Zaken API"
    }
  }
}
```

Zonder `apistandaard_id` in de payload kan de parser niet disambigueren en valt terug op de eerste match.

---

## Foutresponse-formaat

Bij fouten geeft de handler een JSON-response terug met een `error`-veld:

```json
{ "error": "<beschrijving>" }
```

Bij fouten die optreden tijdens de verwerking van een specifieke wijziging bevat de melding:
- **Het 0-gebaseerde index** van de wijziging in de `wijzigingen[]`-array
- **De representatienaam** zoals opgelost door de MetaRegistry
- **De veldnaam** zoals opgegeven in de JSON

Voorbeeld:
```
wijziging[3]: opvoer van ApiStandaard_Naam (veldnaam=naam) mislukt: HANDLER: failed to insert ApiStandaard_Naam: ...
```

Dit maakt het mogelijk om direct in de replay-file of Postman-body te zien welke entry de fout veroorzaakte.
