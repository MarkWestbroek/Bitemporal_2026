# Omnium-informatiesite in Imprint — opzet

> Concept, 2026-10-11. Nederlandstalige informatiesite over Omnium zoals het er nu staat,
> te bouwen in Imprint. Werkadres: `omnium.imprint-ide.nl` (kan later wijzigen).
> Vervangt niet meteen de Engelse marketingsite in `web/omnium-studio/`; die is ouder en
> Amerikaanser van toon.

## Toon

- **Nederlands, ingetogen, feitelijk.** Enthousiasme mag, maar onderbouwd: liever "genereert
  uit het model een database en API" dan "revolutioneert je informatievoorziening".
- Geen superlatieven, geen marketingwerkwoorden (*transformeer, ontketen, naadloos*).
- Korte zinnen, actieve vorm, "je" als aanspreekvorm.
- **Eerlijk over de status.** Omnium is een breed proof of concept. Per onderdeel staat
  erbij: *werkt*, *in opbouw* of *gepland*. Dat maakt de rest geloofwaardig.
- Vaktermen (MDA, bitemporeel, canoniek model) wél gebruiken, maar bij eerste gebruik in één
  zin uitleggen.

## Kern in één zin

Omnium is een modelwerkbank waarin je met anderen één canoniek model onderhoudt, en waaruit
een bitemporeel register — database én API — wordt gegenereerd.

## De vier pijlers

Inhoudelijk en als bestaansreden draait alles om vier punten. Ze zijn ook de aanleiding en
de geschiedenis van het project.

| Pijler | In één zin |
|---|---|
| **Canoniek model** | Eén gedeeld model van de betekenis van gegevens, los van applicatie of notatie. |
| **MDA** (modelgedreven) | Uit dat model ontstaan formulieren, API's, databaseschema en code — niet andersom. |
| **Bitemporeel** | Het gegenereerde register onthoudt wat gold én wat wanneer bekend was. |
| **Samenwerken** | Dit soort oplossingen maak je niet alleen: één live model, open uitwisseling. |

## Sitestructuur

### 1. Home
- Kernzin + korte alinea.
- De vier pijlers als blokken, elk met een link naar de eigen pagina.
- Eén schermafbeelding van de Studio (UML-model, voorbeelddomein *np-loc*).
- Statusregel: "Omnium is een proof of concept in actieve ontwikkeling."

### 2. Waarom Omnium — aanleiding en geschiedenis
- Waarom deze vier punten: het zijn de thema's waarop Mark Westbroek in zijn loopbaan steeds
  de nadruk heeft gelegd, en die in bestaande tools los van elkaar blijven.
- Verwijzing naar **Paratmos** en naar Mark. *Inhoud volgt van Mark — plaatshouder.*

### 3. Canoniek model
- Wat het is: de domeinbetekenis (entiteiten, gegevenselementen, relaties, tijd), los van
  schermen, berichten en opslag.
- Waarom het centraal staat: alle andere modellen en afleidingen verwijzen ernaar, zodat een
  wijziging overal doorwerkt.
- Afgeleide velden en relaties (CEL) — rekenregels in het model, niet in de code.
- Voorbeeld: np-loc (natuurlijk persoon en locatie).

### 4. Modelleren (MDA)
Niet alleen het canonieke model: vanwege het MDA-aspect beschrijft Omnium de hele keten.
- Uit het CM ontstaan **UI's en formulieren**.
- **Gebruikers en use cases** beschrijven hun flows in termen van het CM.
- **Processen (BPMN)** en **beslisregels (DMN)** gebruiken dezelfde begrippen.
- **Sequentiediagrammen** leggen de koppeling naar code en API's.
- **API's** (OpenAPI, GraphQL) en het **databaseschema** worden afgeleid uit het CM.
- **Transformaties van profiel naar profiel** (bv. OpenAPI → canoniek, canoniek → GraphQL,
  Mermaid → use case) zijn leesbare regelsets (lezer → regelset → toepasser), geen losse code.
- **Lineage en traceerbaarheid tussen modellen**: elementen in verschillende modellen zijn met
  elkaar verbonden (kruisverbanden). Je ziet waar een begrip uit het canonieke model terugkomt
  in proces, API, formulier of databaseschema — en wat een wijziging raakt.
- Om compleet te zijn zijn vrijwel alle gangbare modelleerwijzen opgenomen (zie lijst
  hieronder), en het formaat is open: een nieuwe notatie is een profielbeschrijving, geen
  nieuw programmeerwerk.

Beschikbare modeltalen (M2-profielen, stand oktober 2026): canoniek UML, UML (klassen, object,
composite structure, component/deployment, activity, sequence, communicatie, state machine,
use case), MIM 1.2, SysML, ERD, ArchiMate, BPMN, CMMN, DMN (DRD), business-/requirementsmodel,
formulier, OpenAPI 3.1, GraphQL, XSD, WSDL, toegangsregel, en een EA-aanvullingsprofiel.

### 5. Van model naar bitemporeel register (MDA + bitemporeel)
- MDA maakt uit het canonieke model een **bitemporele database en API**.
- Twee tijdlijnen: **formele tijd** (wanneer vastgelegd) en **materiële tijd** (wanneer geldig).
- Schrijven gebeurt in **registraties**; correcties en ongedaanmakingen blijven zichtbaar
  (audit trail). Tijdreizen: opvragen wat op een eerder moment bekend was.
- Hub + _Data-patroon in één alinea, zonder tabellen.
- Status: formeel tijdreizen werkt via REST; materieel tijdreizen generiek en volledige
  GraphQL-tijdreis zijn vervolgwerk.

### 6. Samenwerken
- **Centraal model, meerdere gebruikers, live bijgewerkt** (projectsynchronisatie).
- **Toegankelijk voor iedereen**: cloud-native / SaaS, in de browser.
- **Open uitwisseling** — zie tabel. Ook zonder server: het eigen formaat is een bestand.

| Formaat | Import | Export | Status |
|---|---|---|---|
| Eigen formaat (JSON-map) | ✓ | ✓ | werkt, ook zonder server |
| Sparx EA (.qea) | ✓ | — | werkt (merge op GUID) |
| XMI | — | ✓ | te controleren |
| ArchiMate Exchange Format | ✓ | gepland | |
| Mermaid | ✓ | ✓ | werkt (use case/flowchart) |
| PlantUML | | | te controleren |
| BPMN 2.0 XML (incl. diagram) | ✓ | | werkt |
| DMN XML (incl. diagram) | ✓ | | werkt |
| OpenAPI (OAS 3.1) | ✓ | | werkt (`components.schemas`) |
| GraphQL | | ✓ | werkt |
| RDF / Turtle | — | ✓ | werkt |
| Markdown-overzicht / documenten | — | ✓ | werkt |
| XSD | gepland | gepland | profiel bestaat |
| WSDL | gepland | gepland | profiel bestaat |
| Code lezen / code maken | gepland | gepland | (registercode wordt al gegenereerd) |
| Bizzdesign | gepland | gepland | |

> De tabel is opgesteld uit de repo en moet door Mark worden nagelopen voordat hij live gaat.

- **Documentatie uit het model**: documentatie wordt met templates gegenereerd en geëxporteerd
  (o.a. Markdown), zodat ze niet apart bijgehouden hoeft te worden.
- **Git-koppeling**: Omnium leest modellen uit git (bv. een Sparx EA-bestand) en exporteert
  documentatie naar git. Zo sluit het aan op de manier waarop teams al versiebeheer doen.

### 6a. Diagrammen in je eigen site (Imprint en andere CMS'en)
- Via de **diagram-API** (render-API) kun je een diagram uit Omnium **inbedden in een webpagina**,
  als pure SVG. Omnium tekent; het CMS hoeft niets van modellen te weten.
- **Blijft up-to-date als je dat wilt**: het diagram wordt bij het tonen uit het actuele model
  gehaald. Wil je juist een vaste stand (bv. bij een besluit of publicatie), dan zet je het op
  een bepaald moment vast (`asOf`).
- Imprint gebruikt dit al; elk ander CMS dat een URL of SVG kan opnemen kan hetzelfde.
- Deze site is daar zelf een voorbeeld van: de diagrammen erop komen live uit Omnium.

### 7. Stand van zaken
<!-- Paginavolgorde: 1 Home · 2 Waarom · 3 Canoniek model · 4 Modelleren · 5 Register · 6 Samenwerken · 6a Diagrammen inbedden · 7 Stand · 8 Over -->

- Wat werkt, wat in opbouw is, wat gepland staat — één overzicht.
- Link naar de werkende Studio (indien publiek).

### 8. Over / contact
- Paratmos, Mark Westbroek, contactmogelijkheid. *Inhoud volgt.*

## Mogelijk vergeten (voorstellen)

1. **Eigen modeltalen maken (metaniveaus M0–M3).** De Studio heeft een profiel-ontwerper:
   je kunt zelf een modeltaal beschrijven. Dat is een wezenlijk onderscheid met de meeste tools.
2. **Toegangsbeleid als model.** Autorisatie (toegangsregels, export naar ODRL) staat in
   dezelfde werkbank. Past bij "samenwerken" en bij de Common Ground/FTV-context.
3. ~~Documenten genereren~~ — opgenomen in §6 (aanvulling Mark 11-10).
4. **Doelgroep en context.** Voor wie is het? Overheid/Common Ground (MIM, NLGov, FTV) ligt voor
   de hand — expliciet maken.
5. ~~Relatie met Imprint~~ — opgenomen in §6a (diagram-API).
6. **AI-ondersteuning** (eigen sleutel), als die publiek gemaakt mag worden.
7. **Licentie / open source** — wordt de vraag van elke bezoeker. Antwoord nodig.

## Aanvulling Mark (11-10, tweede ronde)

- **Formulieren**: definiëren vanuit het canonieke model, met een visuele representatie
  (formulier-profiel). Conditionele blokken: gepland/tbd.
- **Toegangsspraak**: toegangsbeleid als model, óók met een visuele representatie.
  Samenwerking: **integratie met FTV via ODRL**.
- **Doelgroep**: de overheid, vanwege de generatie van bitemporele registers — maar in feite
  elk ontwikkelteam.
- **AI-ondersteuning**: mogelijk met een **soeverein model**, via de Nederlandse
  overheidscloud *Fundament* (bijna geregeld → status "in voorbereiding").
- **Open source onder EUPL.** Samenwerken is doel en speerpunt: iedereen is uitgenodigd bij
  te dragen.
- **Requirements management**, drie manieren:
  1. koppel je eigen tool;
  2. gebruik een open-source tool naar keuze;
  3. maak een klein contentmodel in Imprint en houd zelf backlog, kanban en releaselog bij —
     zoals MusicBrain en Omnium dat zelf doen. (Eerlijk erbij: de Omnium-backlog staat nu
     nog als Markdown in git.)
