# Sequence — volgorde in het model, layout erbovenop (plan)

*2026-10-13/14 · sessie M3-MOF (Claude) met Mark · status: plan; fase 0 (§7) in uitvoering op `feat/sequence-v1`*

## 1. Aanleiding

In het sequence-profiel v0 (`web/vite/src/diagramprofielen/sequence/index.js`) is
**de verticale positie de volgorde**, en die positie is handwerk. Er is geen
automatische ordening, lijnen zijn niet gedwongen horizontaal en invoegen schuift
niets door. Berichten hangen aan **punten** (occurrences) en **activaties**, die
allebei vrij te plaatsen nodes op de levenslijn zijn. Zoals in EA moet je bij
tussenvoegen alles met de hand verschuiven, notities inbegrepen.

Marks uitgangspunt (13-10):

- **M1 is het droge model:** de plek van elk element in de sequentie. Een
  Mermaid- of PlantUML-tekst legt hetzelfde vast.
- **De layout ligt erbovenop en is één-dimensionaal.** Een levenslijn heeft
  alleen een x, een activatie of bericht alleen een y.
- **"Lijnen altijd horizontaal" is een regel van de tekenaar,** niet van het
  model. In M1 hoort geen geometrie die uit de volgorde af te leiden is.
- **Volgnummers worden niet getoond.** Die horen bij het communication
  diagram, niet bij sequence.

## 2. Het M1-model

```
interactie
└─ levenslijn                    {ordered}   layout: x
   └─ activatie                              layout: y (afstand)
      └─ bericht | activatie     {ordered}   1..* (een lege activatie is zinloos)
```

- Een **bericht** gaat van een activatie naar een (nieuwe) **doel-activatie**.
  Dat kan een activatie op dezelfde levenslijn zijn (een zelf-bericht). De
  doel-activatie begint waar het bericht aankomt.
- Een **geneste activatie** staat in de geordende lijst van haar ouder-activatie,
  naast de berichten. Ze is dus ook een stap in de volgorde. Voorbeelden: een
  zelf-aanroep, of een callback van een andere levenslijn terwijl de buitenste
  activatie nog loopt.
- Voor synchrone aanroepen ligt de volledige volgorde vast: de boom diepte-eerst
  doorlopen geeft de verticale volgorde van het hele diagram.

### 2.1 Het punt blijft in het model, maar wordt niet getekend

*Besluit Mark, 14-10. Een eerdere versie van dit plan liet het punt vervallen.*

**Wat een punt is.** In UML is een *OccurrenceSpecification* (ons **punt**) geen
2D-punt maar een **moment**: één gebeurtenis op één levenslijn.

- Een bericht heeft er twee: zenden en ontvangen (`Message.sendEvent` en
  `Message.receiveEvent`, elk een *MessageOccurrenceSpecification*).
- Een activatie heeft er ook twee: begin en eind (`ExecutionSpecification.start`
  en `.finish`).

**Volgorde.** UML legt de volgorde vast op die punten, per levenslijn van boven
naar beneden. Volgorde tussen levenslijnen loopt via de berichten en zo nodig via
een *GeneralOrdering*. De geordende lijst per levenslijn is in UML dus een lijst
van punten. De boom van §2 is daar een compactere weergave van: bij synchrone
aanroepen zet je de ene zonder verlies om in de andere.

**Waarom zenden en ontvangen aparte gebeurtenissen zijn** (Mark, 14-10). Een
bericht kost tijd. De pijl loopt horizontaal omdat dat symbolisch is (de tijd
loopt symbolisch van boven naar beneden), maar eigenlijk loopt hij licht schuin
omlaag. Bij forward en reverse engineering van code zijn zenden en ontvangen dus
echt twee gebeurtenissen.

**Punten als meetpunten.** Wie concrete aanroepen meet, bijvoorbeeld in een
performancetest, annoteert precies deze punten met tijden. Ook daarom zijn
zelf-aanroepen nuttig: ze maken zichtbaar wat er gebeurt en geven extra
meetpunten. UML heeft hier eigen elementen voor:

- *TimeObservation* (`t = now`), een tijdstip op een punt;
- *DurationObservation* (`d`), de duur tussen twee punten;
- *TimeConstraint* en *DurationConstraint* (`{d < 200 ms}`), een eis op die
  tijdstippen of duren.

Ze hangen allemaal aan punten. Zo krijgen meetresultaten later een plek in het
model.

**Keuze.**

- Het punt blijft een element van het profiel. Elk bericht en elke activatie
  heeft zijn eigen punten.
- De gebruiker maakt geen punten: ze **ontstaan en verdwijnen met hun bericht of
  activatie** (eigendom, zoals een afgeleide eigenschap).
- De volgorde in de lijsten staat in termen van berichten en activaties (§2).
  De punten volgen daaruit:

  | punt | volgt uit |
  |---|---|
  | zend-punt van een bericht | de plek van het bericht in de lijst van zijn activatie |
  | ontvang-punt | het begin van de doel-activatie |
  | begin en eind van een activatie | haar plek en haar inhoud |

- **Layout:** een punt heeft geen eigen vorm op het canvas. Het valt samen met
  het uiteinde van de pijl of de rand van de activatie. Het heeft hooguit een y,
  die van zijn bericht.
- **Wel nodig:**
  - voor de XMI-export, omdat EA en andere tools ze verwachten;
  - als anker voor tijd-annotaties;
  - waar een bericht zonder activatie aankomt: async, found en lost messages,
    destroy (open vraag A).

  In dat laatste geval krijgt het punt zelf een plek in de lijst van de
  levenslijn.

Ons v0-punt was een losse, zichtbare stip. Dat kwam alleen doordat een lijn in
React Flow een knoop op een bepaalde hoogte nodig heeft om aan te hechten.

## 3. De layout-laag

- **Levenslijn:** een x, in de volgorde van de levenslijnen.
- **Activatie en bericht:** geen absolute y, maar een **extra afstand ten
  opzichte van de vorige stap**. Standaard is die 0, dan geldt de standaard-
  stapgrootte. Zo schuift alles vanzelf mee bij tussenvoegen.
- **Fragment-kaders** hebben geen eigen positie. Ze volgen uit wat erin zit.
- **Notities en constraints** krijgen een relatieve positie, `(dx, dy)` ten
  opzichte van een anker:
  - met een notitie-lijn naar een activatie: de bovenkant van die activatie;
  - met een notitie-lijn naar een bericht: het midden van dat bericht;
  - los: de bovenkant van de eerste levenslijn.

  Zo hoeven notities na het tussenvoegen niet meer met de hand te worden
  verschoven, het probleem dat in EA vaak terugkomt.
- De **sequence-tekenaar** zet model en layout om in 2D-posities voor het
  canvas: lijnen horizontaal, activatie-hoogtes uit hun inhoud. De tekenaar is
  code in de adapter van het profiel (M2), geen motorwerk. Slepen op het canvas
  wordt vertaald naar een herordening (een andere plek in de lijst) of een
  andere afstand, nooit naar een vrije y.

## 4. Fragmenten (alt, opt, loop, par, …)

Fragmenten liggen **bovenop** de volgorde (Mark, 13-10).

**Mermaid en PlantUML.** De tekst is één geordende lijst van berichten. Een
fragment is een blok in die lijst (`alt … else … end`) rond een aaneengesloten
reeks berichten. Operanden zijn deelreeksen met een guard, en de levenslijnen die
het kader bestrijkt volgen uit de berichten erin.

**EA.** Volgens de gebruikersdocumentatie is een fragment een eigen element op
het diagram: een kader dat je in operanden verdeelt, met een conditie per
operand. Een bericht hoort bij het fragment of de operand waar het geometrisch
in valt. Sinds versie 17.1 groeit het kader mee als je een bericht omlaag
schuift. Berichten hebben in EA een globaal volgnummer (`SeqNo`), en activaties
tekent EA zelf uit de berichten.

Hoe EA de operanden in de `.qea` opslaat, staat niet in de documentatie. Mijn
vermoeden, nog niet geverifieerd: als partities met een hoogte, en lidmaatschap
alleen via geometrie. Dat controleren we met een echte `.qea` (stap 5). Onze
EA-lezer slaat fragmenten nu over (`qeaNaarSequence.js`, "komen in een volgende
stap").

**BiZZdesign.** Hierover is publiek niets te vinden. Heeft Mark toegang, dan
bekijken we een export.

**Voorstel (de vorm van Mermaid en PlantUML, passend in de boom):** een fragment
hangt aan de activatie waar zijn eerste bericht vertrekt. Het omvat een
aaneengesloten reeks kinderen van die activatie, met daaronder alles wat die
kinderen diepte-eerst aanroepen. De operanden zijn geordende deelreeksen met
een guard. De levenslijnen die het kader bestrijkt, worden afgeleid. Fragmenten
mogen genest zijn.

## 5. Stappen

1. **M3 (klein):**
   - geordende kind-elementen binnen een element (`ElementType`: welke
     kindtypen, `geordend`, kardinaliteit);
   - een layout-dimensie per elementtype (`x`, `y` of `xy`, dat laatste is de
     standaard);
   - een relatief anker voor notities.

   Eerst afstemmen met `schema.js`/EA-Metametamodel (zie
   [EA-Metametamodel is bron van schema.js]).
2. **M2, sequence v1:**
   - het punt verdwijnt uit het palet, maar blijft als element dat met zijn
     bericht of activatie ontstaat en verdwijnt (§2.1);
   - berichten en activaties krijgen een plek in de geordende lijst;
   - de tekenaar in de adapter.

   Daarna een migratie van v0-diagrammen: de y-volgorde van punten en
   activaties wordt de lijstvolgorde. Losse v0-punten worden zend- of
   ontvang-punt van hun bericht.
3. **Bewerken:** invoegen (vóór of na), herordenen met slepen, inspringen en
   uitspringen (een stap in of uit een geneste activatie), alles met
   doorschuiven.
4. **Notities en constraints** op relatieve ankers (§3).
5. **EA-lezer:**
   - `SeqNo` en EA-hoogtes omzetten naar de boom plus afstanden;
   - fragmenten en operanden inlezen, met lidmaatschap uit de geometrie;
   - vooraf de opslag in de `.qea` verifiëren.
6. **Mermaid- en PlantUML-lezer en -schrijver** (sequence). Daarna de
   transformatie naar het communication diagram, waar de volgnummers
   (1, 1.1, 2) wél zichtbaar zijn en uit de boom volgen.
7. **Later:** tijd-annotaties op punten (*TimeObservation* en
   *DurationConstraint*), bijvoorbeeld met meetwaarden uit een performancetest.

## 6. Open vragen en voorstellen

Mark liet op 14-10 twee van zijn eigen diagrammen zien (een aanvraagproces en
een formulier/verzoek-proces, beide in EA). Ze zijn recht-toe-recht-aan, en daar
volgen de onderstaande voorstellen uit. Mark beslist.

- **A. Async en losse starts.** *Voorstel: episodes.*

  In beide diagrammen beginnen activaties **zonder binnenkomend bericht**.
  Bijvoorbeeld "Valideer aanvraag" vanaf een nieuwe activatie van
  *aanvraagservice*; de notitie erbij luidt "Via event?". Een ander voorbeeld is
  een bericht vanaf een levenslijn zonder activatie (*Medewerker* → "Bekijk mijn
  taken").

  Het voorstel: een interactie is **een geordende reeks episodes op het hoogste
  niveau**. Een episode is een van twee dingen:
  - een activatie zonder aanroeper, die vanzelf of via een event start;
  - een los bericht vanaf een levenslijn, met een zend-punt zonder activatie.

  Binnen een episode geldt de boom van §2. Async blijft een *soort* bericht
  (open pijlpunt). Een episode die door een event start, kan dat event als
  binnenkomend async bericht tonen, of als found message (UML).

  Nog af te wegen: (a) een volgorde tussen zusters over levenslijnen heen, of
  (b) async binnen `par`. Dat is pas nodig als episodes in elkaar grijpen.
- **B. Retour.** *Voorstel: impliciet.*

  Mark tekent geen retourpijlen. De retourwaarde staat in de signatuur
  (`Maak aanvraag(formulier, aanvraagtype): aanvraagnummer`), zoals UML het
  doet: `Message.signature` met een retourparameter. Dus:
  - de terugkeer is het eind van de activatie;
  - de retourwaarde is een eigenschap van het bericht;
  - de retourpijl blijft optioneel, voor wie hem wil tekenen.
- **C. Fragmenten.** *Voorstel: later; eerst een guard op het bericht.*

  Mark gebruikt geen fragmenten. Hij zet wel een **guard op een bericht**
  (`[is verzoek]:Ontvang verzoek(…)`); EA kent die als conditie op het bericht.
  Het voorstel van §4 blijft staan voor wanneer fragmenten nodig worden.

## 7. Fase 0 — direct, zonder modelwijziging

Wat Mark nu al gebruikt en los van de herstructurering kan:

1. **Koppen van levenslijnen**: een keuze `kop` met de waarden object (de
   rechthoek, standaard), actor, boundary, control en entity. Boundary, control
   en entity zijn de robustness-stereotypes van Jacobson (Objectory, UML 1.x
   standaardprofiel), in EA de *Robustness*-elementen. Ze geven extra
   informatie over de rol van de deelnemer. De EA-lezer leidt de kop af uit
   `Object_Type = Actor` of het stereotype `boundary`, `control` of `entity`.
2. **Guard op een bericht** (`guard`), getekend als `[guard] naam`.
3. **Retourwaarde op een bericht** (`retourtype`, dat de EA-lezer al vulde),
   getekend als `naam(…): retourwaarde`; een benoemd bericht toont altijd zijn
   haakjes (`Verzend()`), het label staat boven de lijn.
4. **Berichten verticaal slepen** (tussenstap naar stap 3 van §5): beide punten
   mee, de lijn wordt horizontaal, omlaag duwt de berichten eronder weg (min.
   32px). Een ander bericht kruisen verandert de volgorde (v0: hoogte =
   volgorde); in v1 wordt hetzelfde gebaar "herordenen" en blijft het niet
   kruisen een verandering van alleen de layout-afstand (Mark, 14-10).
   Generiek via de M3-hook `verschuifConnector`.
5. **Her-import uit EA** werkt weer: punten hebben een eigen externe identiteit.
6. **Activaties afgeleid** (`activaties.js`): EA bewaart ze niet (`Activation=0`)
   maar rekent ze uit; wij ook, met de aanroepstapel van §2/§6A over de
   berichten in y-volgorde. Dat is al het model van §2 in werking: de balken
   zijn geen data. Een levenslijn beweegt alleen opzij (`layoutDimensie: "x"`,
   §3) en een lijn hecht in het midden van een punt (`handleStijl: "midden"`);
   punten zijn vaag (§2.1: niet getekend) maar nog pakbaar.

Nog open in fase 0: activaties en notities schuiven niet mee; "importeer als
nieuw" (Mark, 14-10) als optie in de importdialoog.

## Bronnen

- UML 2.5.1 §17 (Interactions): OccurrenceSpecification, ExecutionSpecification,
  CombinedFragment, GeneralOrdering; §8.4 (Time): TimeObservation,
  DurationObservation, TimeConstraint, DurationConstraint.
- Sparx EA user guide, *Create a Combined Fragment* (16.0 en 17.1):
  https://sparxsystems.com/enterprise_architect_user_guide/17.1/modeling_languages/createacombinedfragment.html
- Sparx EA user guide, *Interaction Operators*:
  https://sparxsystems.com/enterprise_architect_user_guide/16.0/interactionoperators.htm
