# JP Morgan-patenten: "ODRL Visualizer"

**Datum analyse:** 2026-09-01 · **Status:** eigen analyse, géén juridisch advies
**Bestanden hier:** `US11669696.pdf`, `US11966710.pdf` + figuren (`*-D0000*.png`)
**Verwant:** `../../plans/2026-08-18 ODRL 3.0 — W3C-workshop en gevolgen voor Toegangsspraak.md`

## De feiten

| | US 11,669,696 B2 | US 11,966,710 B2 |
|---|---|---|
| Titel | System and Method for Implementing an ODRL Visualizer | idem |
| Houder | JPMorgan Chase Bank, N.A. | idem |
| Prioriteit | 6 jan 2020 (provisional 62/957,443) | idem |
| Verleend | 6 juni 2023 | 23 april 2024 (continuation van '696) |
| Verwacht einde | ± nov 2041 | idem prioriteitsketen |
| Familie | **Alleen VS** — geen EP/WO-tegenhangers | idem |

## Wat er wérkelijk geclaimd wordt

De titel en samenvatting klinken als "computer toont ODRL leesbaar", maar de
beschermingsomvang zit in de claims, en die zijn smal. Onafhankelijke claim 1
('696) vereist **al** het volgende tegelijk (all-elements rule):

1. **uploaden** van een digitaal contract in de visualizer-tool;
2. identificeren en **resolven van de ontologieën** waarnaar termen verwijzen;
3. parsen naar een standaardvorm;
4. automatische omzetting naar leesbare vorm via een **top-down beslisboom**
   volgens de ODRL-structuur (in '696: "on the fly" gegenereerd);
5. een scherm met **twee panelen tegelijk**: links het machineleesbare
   contract, rechts de leesbare weergave ervan;
6. het machineleesbare paneel bevat verplicht een **prefix-, target-,
   constraints-, datasets- én actions-sectie**;
7. **klik-synchronisatie**: selectie in het leesbare paneel highlight het
   corresponderende fragment in het machineleesbare paneel.

Figuur 1 van het patent is precies dit: links Turtle-triples in secties
(110–122), rechts de leesbare Agreement/Permission/Refinements-weergave
(130–142). De continuation '710 laat een paar formuleringen weg (o.a. de
"on the fly"-zinsnede) maar behoudt de paneelsecties én de klik-highlight —
dus ook de tweede versie is smal gebleven.

Wie één element mist — geen upload van een ODRL-bestand, geen simultane
splitsweergave, geen klik-highlight, andere paneelindeling — maakt geen
inbreuk op deze claims.

## "Kun je dat zomaar patenteren?"

- Het *brede idee* (XML/RDF leesbaar renderen — de XSLT/UML-tool-analogie)
  is niet geclaimd en zou de toets ook niet doorstaan. Wat de USPTO heeft
  verleend is de *specifieke combinatie* hierboven; de wherein-clausules zijn
  het typische spoor van vernauwing tijdens de verleningsprocedure.
- Verleend ≠ onaantastbaar. In de VS geldt een vermoeden van geldigheid, maar
  Alice/§101 (informatie verzamelen-analyseren-tonen is als abstract idee
  kwetsbaar) en §103 (voor de hand liggend gezien prior art: RDF-browsers,
  Protégé, ODRL-editors van vóór jan 2020) zijn precies de aanvalslijnen —
  áls iemand de kosten van zo'n procedure wil dragen.
- **Territoriaal:** beide patenten bestaan alleen in de VS. Er is geen EP- of
  WO-familielid, dus in Nederland/EU hebben ze geen werking.

## Raakt dit Toegangsspraak / de editor?

**Nee, om drie onafhankelijke redenen:**

1. **Territoriaal** — VS-patenten; de editor wordt niet in de VS gemaakt,
   gebruikt of aangeboden.
2. **Omgekeerde richting** — het patent gaat over het *inlezen* van een
   ODRL-contract en dat leesbaar maken. Bij Toegangsspraak is de klare taal
   de brón en is ODRL een *export*; er wordt geen ODRL geüpload en er worden
   geen ontologieën van een ingelezen contract geresolved.
3. **Ontbrekende elementen** — de editor heeft tabs (Canonieke vorm,
   Diagram), geen simultane split-view van machineleesbaar naast leesbaar,
   geen paneel met de voorgeschreven vijf secties, geen klik-highlight
   tussen zulke panelen.

**Aandachtspunt voor later:** een toekomstige feature "ODRL importeren en
naast de klare-taal-weergave tonen met klik-synchronisatie" zou in VS-context
richting deze claims kruipen. In NL/EU speelt het niet; noteren en verder
niets doen.

**Zijnoot standaardisatie:** JPMC host de ODRL 3.0-workshop én patenteert
tooling in hetzelfde domein. De W3C Patent Policy dwingt royalty-vrije
licenties af voor claims die *essentieel* zijn om een Recommendation te
implementeren — een visualizer-UI is dat niet en valt daar dus buiten. Goed
om scherp op te blijven bij de charterdiscussie: wat in de spec belandt is
RF, wat "tooling" blijft niet.

## Bronnen

- <https://patents.google.com/patent/US11669696B2/en>
- <https://patents.google.com/patent/US11966710B2/en>
