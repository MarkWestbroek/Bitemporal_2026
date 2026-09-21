# ArchiMate 4 — twee profielen naast elkaar, met transformatie ertussen

*2026-09-08 · status: ontwerp, nog niet gebouwd · besluit Mark: 3.2 én 4
ondersteunen als **twee profielen**, met een transformatie ertussen.*

## 1. Wat er in ArchiMate 4 verandert

De Open Group publiceerde ArchiMate 4 op **27 april 2026**. Het is geen
bijstelling maar een opruiming: **van ruim 60 naar ~42 concepten (−30%)**.

**Generiek gemaakt (Common Domain).** De laag-specifieke gedrags- en
rolconcepten zijn samengevoegd tot één concept: *Service, Process, Function,
Event, Role, Collaboration, Interface* bestaan niet meer in een business-,
applicatie- en technology-variant. Je modelleert je proces, en pas bij de
toewijzing van middelen blijkt of het handwerk of software is.

**Vervallen, met officieel conversiepad:**

| 3.2 | wordt in 4 |
| --- | --- |
| Business/Application/Technology Interaction | Process of Function met multipliciteit ≥ 2 op de toewijzing |
| Contract | Business Object |
| Constraint | Requirement |
| Gap | Assessment (of Deliverable) |
| Representation | Data Object, Artifact of Material |
| Implementation Event | Event (generiek) |

**Lagen → domeinen.** Business/Application/Technology blijven bestaan, maar
heten nu *domeinen*: verschillende delen van de taal, geen abstractieniveaus.
De laagtaart is vervangen door een zeshoek met concentrische ringen.

**Relaties.** De elf relatietypen blijven ongewijzigd. Nieuw is
**multipliciteit** op de relatie-uiteinden (onder-/bovengrens per kant);
combinaties die niet meer zijn toegestaan worden associatie.

**Uitwisseling en tooling — praktisch belangrijk.** Van het *Model Exchange
File Format* bestaat **nog geen 4-versie**: opengroup.org/xsd/archimate
publiceert alleen 3.1/3.2. Archi ondersteunt 4 nog niet (Visual Paradigm 18 is
de eerste); meer leveranciers worden eind 2026 verwacht. **Alles wat wij
importeren blijft dus voorlopig 3.2** — inclusief GEMMA.

## 2. Waarom twee profielen, en niet samenvoegen

Geteld op onze eigen tabel (`diagramprofielen/archimate/elementen.js`, 60
typen): **20 van onze 60 ids verdwijnen of smelten samen**, waarmee we op ~40
uitkomen — precies de reductie die de spec noemt.

- 3 collaboraties → 1, 3 interfaces → 1, 3 processen → 1, 3 functies → 1,
  3 services → 1, 4 events (incl. implementatie-event) → 1
- 3 interacties → vervallen
- contract, representatie, constraint, gap → vervallen
- business-rol → generieke rol

Samenvoegen in één profiel zou betekenen dat `business-proces` en
`app-proces` hetzelfde type worden. **Element-type-ids zijn persistent**
(zie STUDIO.md): bestaande modellen en de Exchange-import hangen eraan. Twee
profielen is dus niet alleen didactisch netter, het is de enige route die
bestaande modellen heel laat.

## 3. Bouwplan

1. **`archimate4`-profiel** — eigen DiagramType-id en eigen element-ids naast
   het bestaande `archimate`. De motor-primitieven (vormen-set, samentrekking,
   zwevende aanhechting, voorkomens) zijn generiek en komen gratis mee.
2. **Transformatie 3.2 → 4** via de bestaande registry, richting
   `"transform"` (model → model, `transformatieRegistry.js`). Deterministisch:
   elk vervallen concept heeft een officieel conversiepad (tabel hierboven).
   Interactie → proces + multipliciteit is de enige die echt iets moet
   uitrekenen.
3. **Transformatie 4 → 3.2 is lossy.** Een generiek Proces moet een domein
   kiezen. Aanpak: afleiden uit waar het aan hangt (toegewezen aan een
   business actor → business-proces; aan een applicatiecomponent →
   app-proces), met een expliciete keuze-optie en diagnostics voor de rest.
4. **Import blijft bij 3.2** zolang er geen 4-Exchange bestaat. Komt die er,
   dan is het een tweede importer naast de huidige — de registry ondersteunt
   dat al (`bron.detecteer` per namespace).
5. **Kleur en taakbalkgroepen zijn een echte ontwerpvraag.** Onze
   `LAAG_GROEP`/`taakbalkGroep` en de scheidingstekens in de Maken-balk zijn
   op laagkleur gebouwd. In 4 volgt de kleur niet meer uit het type: een
   generiek Proces hoort bij geen enkele laag. Waarschijnlijk wordt het
   domein een eigenschap van het element (of van het voorkomen — zelfde
   scheiding als bij de gedaanten van een samenstel).

## 4. Wat er eerst nodig is

De **officiële ArchiMate 4-specificatie** (gratis 90-dagen evaluatielicentie,
daarna gratis niet-commerciële licentie via publications.opengroup.org/c260),
om de 42 typen exact te kalibreren: namen, domeinindeling, notatie en de
geldige relatiecombinaties. Onze 3.2-tabel is groot geworden door hem op
echte Archi- en GEMMA-bestanden te ijken; zonder de spec bouwen we opnieuw een
v0 die daarna over moet.

## Bronnen

- The Open Group, aankondiging ArchiMate 4: <https://www.opengroup.org/The-Open-Group-Announces-ArchiMate%C2%AE-4-Specification>
- The Open Group Blog, achtergrond bij de release: <https://blog.opengroup.org/2026/05/20/discussing-the-release-of-the-archimate-4-specification/>
- Bizzdesign, "What Changed from Version 3.2?": <https://bizzdesign.com/blog/archimate-4-changes>
- Linked.Archi, 3.2 → 4 mappingtabel: <https://meta.linked.archi/docs/guide/archimate/archimate-3.2-vs-4.0/>
- Exchange File Format (nog 3.1/3.2): <https://www.opengroup.org/xsd/archimate/>
- Spec-download: <https://publications.opengroup.org/c260>
