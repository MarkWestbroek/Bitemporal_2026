# Vergelijking: Bitemporeel Register Model vs MIM

**MIM** = Metamodel Informatiemodellering, de Nederlandse standaard voor informatiemodellen,
beheerd door Geonovum. Versie 1.2+ is de huidige werkversie.
Bron: https://docs.geostandaarden.nl/mim/mim/

## 1. Stereotype-mapping (kern)

| MIM stereotype / metaclass      | Bitemporeel model (editor) | Toelichting                                                                 |
|---------------------------------|----------------------------|-----------------------------------------------------------------------------|
| `«Objecttype»`                  | **Entiteit** (`ENT`)       | Directe 1:1 mapping. Beide zijn het hoofdobject waaraan gegevens hangen.    |
| `«Attribuutsoort»`              | **Veld** (in GE of ENT)    | MIM: eigenschap van objecttype. Bitemporeel: veld in een struct.            |
| `«Gegevensgroep»`               | *(binding)*                | MIM: aankoppeling van GGT aan objecttype. Bitemporeel: edge ENT→GE.        |
| `«Gegevensgroeptype»`           | **Gegevenselement** (`GE`) | Directe mapping. Groep samenhangende attributen onder een entiteit.         |
| `«Relatiesoort»`                | **Relatie** (`REL`)        | MIM: verbinding tussen twee objecttypen. Bitemporeel: relatie-struct.       |
| `«Relatieklasse»`               | **Relatie** (met velden)   | MIM: relatie die zelf ook attributen draagt. Bitemporeel: REL met velden.   |
| `«Enumeratie»`                  | **Enumeratie**             | 1:1 mapping. Beide: vaste waardelijst.                                      |
| `«Enumeratiewaarde»`            | Waarde in enumeratie       | 1:1 mapping.                                                                |
| `«Primitief datatype»`          | **Gegevenstype**           | Bitemporeel: basistype + format + validatie + normalisatie + weergave.       |
| `«Gestructureerd datatype»`     | **Gegevenstype** (complex) | MIM: samengesteld type met data-elementen. Bitemporeel: gegevenstype.       |
| `«Referentielijst»`             | **Referentielijst**        | 1:1 mapping (v06 bevat referentielijst-set: lijst + item + koppelrelatie).  |
| `«Generalisatie»`               | *(nog niet gemodelleerd)*  | MIM: subtype/supertype. Bitemporeel model heeft dit nog niet.               |
| `«Externe koppeling»`           | *(niet van toepassing)*    | MIM: verwijzing naar object buiten eigen domein. Niet in bitemporeel poc.   |
| `«Keuze»`                       | *(nog niet gemodelleerd)*  | MIM: keuze tussen datatypes/relatiedoelen.                                  |
| `«Codelijst»`                   | Referentielijst (deels)    | MIM: beheerde externe waardelijst. Bitemporeel: via referentielijst.        |

## 2. Structurele overeenkomsten

### Hiërarchie
Beide modellen volgen dezelfde basisstructuur:

```
MIM:    Objecttype ─→ Gegevensgroep ─→ Gegevensgroeptype ─→ Attribuutsoort
Bitemp: Entiteit   ─→ (edge)        ─→ Gegevenselement   ─→ Veld
```

In MIM is de `«Gegevensgroep»` een expliciet tussenelement dat de binding verzorgt
tussen objecttype en gegevensgroeptype. In het bitemporele model is deze binding
impliciet via de edge (relatie) tussen entiteit en gegevenselement in de editor,
en via `OnderliggendeGegevenselementen` in de MetaRegistry.

### Relaties
```
MIM:    Objecttype ←─ Relatiesoort ─→ Objecttype
Bitemp: Entiteit   ←─ Relatie      ─→ Entiteit
```

Beide modellen positioneren de relatie als een eigen modelelement dat twee
objecttypen/entiteiten verbindt. In MIM kan een `«Relatieklasse»` ook eigen
attributen hebben — in het bitemporele model kan een `REL` eveneens velden bevatten.

### Attributen / Velden

| Aspect           | MIM (`«Attribuutsoort»`)         | Bitemporeel (veld in struct)       |
|------------------|----------------------------------|------------------------------------|
| Naam             | `mim:naam`                       | Go veldnaam + `json` tag           |
| Type             | `mim:type` → datatype            | Go type + `schema` tag (type/format) |
| Kardinaliteit    | `mim:kardinaliteit` (bijv. 1, 0..1, 0..*) | Via `momentvoorkomen` op GE-niveau |
| Identificerend   | `mim:identificerend = true`      | Via `isID` of MetaRegistry IDKolom  |
| Mogelijk geen waarde | `mim:mogelijkGeenWaarde`     | Go pointer-types (nullable)         |

## 3. Bitemporele dimensie — het verschil

Het kernverschil is de **bitemporele laag** die het bitemporele model toevoegt:

| Aspect                        | MIM                                          | Bitemporeel model                            |
|-------------------------------|----------------------------------------------|----------------------------------------------|
| **Formele tijd** (registratie)| `mim:heeftTijdlijnRegistratie` (boolean flag) | Altijd aanwezig: `opvoer`/`afvoer` + wijzigingen-tabel |
| **Materiële tijd** (geldigheid)| `mim:heeftTijdlijnGeldigheid` (boolean flag) | Via `Aanvang`/`Einde` GE's per entiteit       |
| **Wijziging / registratie**   | Niet gemodelleerd                            | Eerste-klas objecten: `Registratie` + `Wijziging` |
| **Tijdreizen**                | Niet in scope                                | Query parameters `?t=` (formeel), `?tm=` (materieel) |

MIM *kent* de concepten via boolean flags (`indicatieMaterieleHistorie`,
`indicatieFormeleHistorie`, `heeftTijdlijnGeldigheid`, `heeftTijdlijnRegistratie`)
maar modelleert de **implementatie** niet. Het bitemporele model maakt tijdbeheer
een architecturaal onderdeel: aanvang/einde als aparte GE's met versiegeschiedenis,
wijzigingen als audittrail, en formele tijd via de wijzigingen-tabel.

## 4. MIM Linked Data (RDF) formaat

MIM definieert naast de UML-representatie (XMI) ook een **Linked Data vocabulaire**:

- Namespace: `http://modellen.mim-standaard.nl/def/mim#`
- Shapes prefix: `http://modellen.mim-standaard.nl/def/mim-shapes#`
- Gebaseerd op OWL/RDFS/SHACL

Voorbeeldklassen in RDF:
```turtle
mim:Objecttype          # → Entiteit
mim:Attribuutsoort      # → Veld
mim:Gegevensgroeptype   # → Gegevenselement
mim:Relatiesoort        # → Relatie
mim:Enumeratie          # → Enumeratie
mim:Enumeratiewaarde    # → Waarde
mim:PrimitiefDatatype   # → Gegevenstype
```

Dit is een apart serialisatieformaat naast XMI. Export naar MIM-LD zou een
aparte exporter vereisen die Turtle/JSON-LD genereert.

## 5. Exportmogelijkheden naar MIM

### Via XMI (UML-profiel)
De bestaande XMI 1.1 exporter kan worden uitgebreid met MIM-stereotypes:

1. **Stereotype toevoegen**: `<UML:Stereotype name="Objecttype"/>` etc.
2. **Tagged values**: MIM-metagegevens als tagged values (herkomst, definitie, datum opname, etc.)
3. **EA compatibiliteit**: EA ondersteunt MIM via een MIM-profiel/add-in

Voordeel: past in het bestaande export-pad via XMI.
Nadeel: vereist dat alle classes/attributen voorzien worden van correct stereotype + tagged values.

### Via Linked Data (Turtle/JSON-LD)
Een nieuwe exporter die het MIM-vocabulaire gebruikt:

```turtle
@prefix mim: <http://modellen.mim-standaard.nl/def/mim#> .

<#Persoon> a mim:Objecttype ;
  mim:naam "Persoon" ;
  mim:attribuut <#Persoon_naam> .

<#Persoon_naam> a mim:Attribuutsoort ;
  mim:naam "naam" ;
  mim:type <#CharacterString> .
```

Voordeel: direct MIM-compliant, machine-leesbaar.
Nadeel: apart serialisatieformaat, vereist RDF-kennis.

### Aanbeveling
De **XMI-route met MIM-stereotypes** is het meest praktisch:
- Hergebruik van de bestaande XMI export
- Import in EA met MIM-profiel
- De mapping Entiteit→Objecttype, GE→Gegevensgroeptype, REL→Relatiesoort is straightforward

Een **MIM-LD exporter** is een toekomstige uitbreiding voor linked-data ecosystemen.

## 6. Wat ontbreekt voor volledige MIM-conformiteit?

| MIM-concept                    | Status in bitemporeel model | Actie nodig                          |
|--------------------------------|-----------------------------|--------------------------------------|
| Generalisatie (subtype/super)  | Niet aanwezig               | Toevoegen als edge-type in editor    |
| Keuze (tussen types/relaties)  | Niet aanwezig               | Optioneel; complex MIM-construct     |
| Externe koppeling              | Niet aanwezig               | Relevant voor registratiekoppeling   |
| Codelijst                      | Via referentielijst (deels)  | Uitbreiden met externe bronverwijzing|
| MIM tagged values              | Niet in XMI export          | Toevoegen aan XMI exporter           |
| Aggregatietype (compositie)    | Niet expliciet              | Toevoegen als edge-property          |
| Kardinaliteit op relatie       | Via momentvoorkomen          | Mapping naar MIM-kardinaliteit       |
| Unidirectioneel flag           | Niet aanwezig               | Toevoegen als edge-property          |

## 7. Samenvatting

Het bitemporele model en MIM zijn **compatibel op structureel niveau**: de kern-
concepten (objecttype/entiteit, gegevensgroeptype/GE, relatiesoort/relatie,
enumeratie, datatype) mappen 1:1. Het bitemporele model voegt daar een laag
tijdbeheer aan toe die MIM niet definieert maar wel erkent via boolean flags.

Export naar MIM is haalbaar via de bestaande XMI-route, mits aangevuld met
MIM-stereotypes en tagged values. Een MIM-LD (Turtle) exporter is een
logische vervolgstap voor linked-data interoperabiliteit.
