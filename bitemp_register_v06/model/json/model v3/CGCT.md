#Common Ground Compliance Tool

```mermaid
classDiagram

  class Organisatie {
    <<entiteit>>
    <<materieel>>
  }

  class Organisatie_Contactgegevens {
    <<gegevenselement>>
    +string~uri~ url
    +Emailadres email
    +Telefoonnummer telefoonnummer
  }

  class Organisatie_Organisatienaam {
    <<gegevenselement>>
    +string naam
  }

  class Contactpersoon {
    <<relatie>>
    +string rol
  }

  class Persoon {
    <<entiteit>>
    <<materieel>>
  }

  class Persoon_Contactgegevens {
    <<gegevenselement>>
    +Emailadres email
    +Telefoonnummer telefoonnummer
  }

  class Persoon_Persoonnaam {
    <<gegevenselement>>
    +string naam
  }

  namespace CGCT {
    class Repository {
      <<entiteit>>
      <<materieel>>
    }

    class Repository_RepoAddress {
      <<gegevenselement>>
      +string url
    }

    class Repository_RepoName {
      <<gegevenselement>>
      +string name
    }

    class Unnamed {
      <<relatie>>
      +string role
    }

    class RepoOrgRole {
      <<enumeration>>
      Owner
      Contributor
      User
    }

    class Repository_ {
      <<gegevenselement>>
      +AspectAnalysiTypes aspectType
      +DatumTijd readyAt
      +integer score
    }

    class AspectAnalysiTypes {
      <<enumeration>>
      Code
      Documentation
      Etc
    }

    class RepoAnalysis {
      <<entiteit>>
    }

    class RepoAnalyses {
      <<relatie>>
    }

    class RepoAnalysisOverall {
      <<gegevenselement>>
      +DatumTijd checkedAt
      +Decimaal score
    }
  }
  Organisatie "1" --> "0..1" Organisatie_Contactgegevens : Contactgegevens
  Organisatie_Contactgegevens "1" --> "*" Emailadres
  Organisatie_Contactgegevens "1" --> "*" Telefoonnummer
  Organisatie "1" --> "0..1" Organisatie_Organisatienaam : Organisatienaam
  Organisatie "1" --> "0..1" Contactpersoon : Contactpersoon
  Contactpersoon "1" --> "0..*" Persoon : → Persoon
  Persoon "1" --> "0..1" Persoon_Contactgegevens : Contactgegevens
  Persoon_Contactgegevens "1" --> "*" Emailadres
  Persoon_Contactgegevens "1" --> "*" Telefoonnummer
  Persoon "1" --> "0..1" Persoon_Persoonnaam : Persoonnaam
  Repository "1" --> "0..1" Repository_RepoAddress
  Repository "1" --> "0..*" relatie_1775754208569_5
  relatie_1775754208569_5 "1" --> "1" Organisatie
  Repository "1" --> "0..1" Repository_RepoName
  relatie_1775754208569_5 "1" --> "*" RepoOrgRole
  Repository_ "1" --> "*" DatumTijd
  Repository_ "1" --> "*" AspectAnalysiTypes
  RepoAnalysis "1" --> "0..1" Repository_
  Repository "1" --> "0..*" relatie_1775754922324_22
  relatie_1775754922324_22 "1" --> "1" RepoAnalysis
  RepoAnalysis "1" --> "0..1" gegevenselement_1775755031727_25
  gegevenselement_1775755031727_25 "1" --> "*" DatumTijd
  gegevenselement_1775755031727_25 "1" --> "*" Percentage
  Organisatie_Contactgegevens ..> Emailadres : uses
  Organisatie_Contactgegevens ..> Telefoonnummer : uses
  Persoon_Contactgegevens ..> Emailadres : uses
  Persoon_Contactgegevens ..> Telefoonnummer : uses
  Repository_ ..> AspectAnalysiTypes : uses
  Repository_ ..> DatumTijd : uses
  RepoAnalysisOverall ..> DatumTijd : uses
  RepoAnalysisOverall ..> Decimaal : uses

    class KorteTekst {
    <<datatype>>
    +string basistype
  }

  class Geheel {
    <<datatype>>
    +integer basistype
    +String format = "int32"
  }


  class Percentage {
    <<datatype>>
    +number basistype
    +String format = "double"
  }

  class Datum {
    <<datatype>>
    +string basistype
    +String format = "date"
  }

  class DatumTijd {
    <<datatype>>
    +string basistype
    +String format = "date-time"
  }

  class Jaar {
    <<datatype>>
    +integer basistype
  }

  class JaNee {
    <<datatype>>
    +boolean basistype
  }
  class Emailadres {
    <<datatype>>
    +string basistype
    +String format = "email"
  }

  class Telefoonnummer {
    <<datatype>>
    +string basistype
    +String format = "phone"
  }

  class Versie {
    <<datatype>>
    +string basistype
    +String format = "versie"
    +String pattern
  }
  ```