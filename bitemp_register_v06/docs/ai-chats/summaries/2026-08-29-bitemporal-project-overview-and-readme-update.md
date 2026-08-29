# Chat Samenvatting

## Metadata

- Datum: 2026-08-29
- Titel: Bitemporal project overview and README update (Copilot-sessie)
- Bestandstamnaam: 2026-08-29-bitemporal-project-overview-and-readme-update
- Gerelateerde export: `../exports/2026-08-29-bitemporal-project-overview-and-readme-update.md`
- Gerelateerde branch/commit: huidige werkboom, niet gecommit

## Doel

Positioneer de repository opnieuw vanuit de werkelijke ontwikkeling: van een
bitemporeel CQRS-achtig register-POC met een canoniek UML-profiel naar Omnium
Studio, een modelgedreven online IDE met een metametamodel, configureerbare
profielen, API-, proces-, beslis-, formulier- en toegangsbeleidkoppelingen.
Leg daarnaast de softwarearchitectuur vast in uitwisselbare diagramformaten.

## Beslissingen

- De root-README vertelt de evolutie in plaats van alleen de technische
  registerfeatures op te sommen; `bitemp_register_v06/` is expliciet de actieve
  codebase en v01-v05 zijn historie/referentie.
- Het canonieke model wordt gepositioneerd als gedeelde semantische laag voor
  opslag, REST/GraphQL/OpenAPI, DMN, BPMN, formulieren, Toegangsspraak/ODRL en
  visualisaties.
- Capabilities zijn gemarkeerd als werkend POC, prototype, preview of roadmap,
  zodat de README geen productie- of interoperabiliteitsclaims overdrijft.
- De architectuur is geleverd als ArchiMate Exchange XML voor Archi, als een
  Mermaid `classDiagram` dat de bestaande Studio-importer daadwerkelijk leest,
  en als PlantUML component-, deployment- en sequencediagrammen.
- XMI is niet als hoofdformaat gekozen omdat de huidige roundtrip nog niet
  volledig verliesvrij is; ArchiMate Exchange-import in Studio blijft roadmap.

## Waarom deze keuze

De kernwaarde van het project zit niet meer alleen in bitemporele opslag, maar
in het aantoonbaar doorwerken van één model naar meerdere technische en
functionele projecties. De README moet daarom eerst het concept en de evolutie
uitleggen en daarna naar specialistische documentatie verwijzen. Meerdere
diagramformaten maken dezelfde architectuur bruikbaar voor verschillende
doelgroepen zonder te doen alsof alle importpaden al gereed zijn.

## Gewijzigde onderdelen

- Bestanden: root `README.md`; `docs/diagrammen/architectuur-overzicht.md`;
  `omnium-studio-architectuur.archimate.xml`, `.mmd` en `.puml`; chat-export en
  deze samenvatting.
- API routes: geen wijzigingen.
- DB/SQL: geen wijzigingen.
- Frontend: geen codewijzigingen; de bestaande Mermaid-importer is gebruikt
  om het nieuwe model te valideren.

## Open punten

- Implementeer Open Group ArchiMate Exchange XML import/export in het
  ArchiMate-profiel en gebruik het nieuwe model als regressiefixture.
- Voltooi de XMI-roundtrip wanneer volledige UML-toolinteroperabiliteit nodig
  wordt.
- Render het PlantUML-bestand visueel in een omgeving met PlantUML; lokaal was
  geen renderer geïnstalleerd.

## Volgende stap

Importeer het ArchiMate Exchange-model in Archi voor een visuele review van de
drie views en gebruik eventuele verschuivingen of semantische correcties als
acceptatiebasis voor de toekomstige Studio-importer.