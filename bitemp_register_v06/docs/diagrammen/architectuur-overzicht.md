# Architectuurmodellen Omnium Studio

Deze map bevat overlappende architectuurmodellen van Omnium Studio en het
bitemporele register. De overlap is bewust: dezelfde architectuur is zo te
bespreken met enterprise-architecten, softwareontwikkelaars en gebruikers van
de modelleeromgeving zelf.

## Bestanden

| Bestand | Inhoud | Gebruik |
|---|---|---|
| [`omnium-studio-architectuur.archimate.xml`](omnium-studio-architectuur.archimate.xml) | drie ArchiMate-views: platform, canonieke modelketen en deployment | importeer als Open Group ArchiMate Exchange File in Archi |
| [`omnium-studio-architectuur.mmd`](omnium-studio-architectuur.mmd) | compact platformoverzicht met de modelgedreven keten | Mermaid, documentatie en Omnium Studio Mermaid-import |
| [`omnium-studio-architectuur.puml`](omnium-studio-architectuur.puml) | UML component-, deployment- en sequencediagram | PlantUML-renderer of verdere handmatige import |

## Modelgrenzen

De modellen beschrijven de actieve codebase in `bitemp_register_v06/` op vier
niveaus:

1. **Metamodellering:** het metametamodel definieert hoe modelprofielen worden
   beschreven; profielen configureren de generieke diagrammotor.
2. **Canoniek model:** entiteiten, gegevenselementen, relaties,
   referentielijsten, afleidingen en validaties vormen de gedeelde semantische
   laag voor register, API, processen, beslissingen en formulieren.
3. **Runtime:** de Go-applicatie gebruikt de MetaRegistry als bron voor
   generieke handlers, REST, GraphQL, OpenAPI, schema-export en codegeneratie.
4. **Deployment:** browser en statische frontend communiceren met de Go-API;
   PostgreSQL bewaart register- en configuratiegegevens en een optionele
   object store bewaart bestanden.

Het Hub + `_Data`-patroon is in deze architectuurmodellen als onderdeel van de
registercomponent benoemd, maar niet tot tabellenniveau uitgewerkt. Zie
[`../../ONTWERP_DATA_PATTERN.md`](../../ONTWERP_DATA_PATTERN.md) voor dat
detailontwerp.

## Status en interoperabiliteit

- Het ArchiMate-bestand gebruikt het Open Group Exchange File Format met vaste
  coördinaten. Het is bedoeld voor import in Archi en als toekomstig
  roundtrip-testmodel.
- De ArchiMate-profielactiviteit van Omnium Studio ondersteunt de notatie al,
  maar heeft nog geen importer voor dit XML-formaat. Dat werk staat expliciet
  op de roadmap.
- De Mermaid-bron is de eenvoudigste invoer voor de bestaande raw
  Mermaid-import. Na import kan de plaatsing in de editor verder worden
  aangepast.
- De klassieke UML/XMI-keten is nog niet volledig verliesvrij. Daarom staat de
  softwarearchitectuur ook in PlantUML: tekstueel, diffbaar en zonder te doen
  alsof de XMI-roundtrip al af is.

## ArchiMate-views

### 1. Platformoverzicht

Toont de modelleur, Omnium Studio, de diagrammotor en profielen, het canonieke
model, de Go-runtime en het bitemporele register. Deze view legt vooral uit wat
het product is.

### 2. Canonieke modelketen

Toont hoe V3 JSON en de MetaRegistry de genererende laag vormen voor REST,
GraphQL, OpenAPI, DMN, BPMN, formulieren en Toegangsspraak/ODRL. Deze view legt
uit waarom het canonieke model meer is dan een databaseschema.

### 3. Deployment

Toont browser, frontend, Go-runtime, PostgreSQL en objectopslag. Deze view is
bewust logisch: Docker Compose, split images en TrueNAS zijn varianten van
dezelfde componentverdeling.

## Bijwerken

Houd bij architectuurwijzigingen de betekenis van de drie bronformaten gelijk.
Vormdetails mogen verschillen per notatie. Zodra de ArchiMate Exchange-import
in Omnium Studio bestaat, hoort dit model bij de regressietests voor import,
positiebehoud en export.