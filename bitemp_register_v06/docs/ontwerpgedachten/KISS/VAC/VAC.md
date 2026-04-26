##VAC = vraag-antwoord-combinatie

```mermaid
classDiagram
    class VAC {
        +string vraag *
        +string antwoord *
        +Status status *
        +Doelgroep doelgroep *
        +string toelichting
    }

    class Afdeling {
        +string afdelingNaam *
        +string afdelingId
    }

    class Trefwoord {
        +string trefwoord *
    }

    class GerelateerdeVAC {
        +uri VAC *
    }

    class GerelateerdeProduct {
        +uri product *
    }

    class Status {
        <<enumeration>>
        actief
        non-actief
        te-verwijderen
    }

    class Doelgroep {
        <<enumeration>>
        eu-burger
        eu-bedrijf
        eu-burger-bedrijf
    }

    VAC "1" --> "0..*" Afdeling : afdelingen
    VAC "1" --> "0..*" Trefwoord : trefwoorden
    VAC "1" --> "0..*" GerelateerdeVAC : gerelateerdeVACs
    VAC "1" --> "0..*" GerelateerdeProduct : gerelateerdeProducten
    VAC ..> Status : «use»
    VAC ..> Doelgroep : «use»
    ```