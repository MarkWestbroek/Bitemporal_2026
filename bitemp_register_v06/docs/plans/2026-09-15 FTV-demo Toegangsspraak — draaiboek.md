# FTV-demo Toegangsspraak — draaiboek (di 15 september 2026)

Kleine presentatie in de tweewekelijkse online FTV-werkgroep. Domein: **np-loc-org+geo**
(natuurlijk persoon + woonlocatie, organisatie met afdeling/medewerker, en gemeente /
gemeentedeel (wijk) / locatie). Het demo-model wordt apart gebouwd — zie
`2026-09-10 Opdracht demo-model np-loc-org-geo en OAS-naar-canoniek.md`.

Handout: het info-paper `docs/toegangsspraak-infopaper.pdf` (taal, EBNF-grammatica,
ODRL-mapping, profiel, editor).

## Demo-flow (3 stappen, zoals bedacht)

1. **Live regels schrijven** in de toegang-activity; gegevens kiezen via de modelboom
   (klik "kies" of slepen — de van-vorm wordt ingevoegd). Laat autocomplete en een
   controle-melding (dubbelzinnige keten of typebewaking) even zien.
2. **Visualisatie als model**: tab Diagram (regelkaarten) voor de snelle blik, daarna
   menu Beleid → **Publiceer naar Modelleren** en het beleid als echt diagram-model
   openen in de modelleeromgeving (layout blijft behouden bij herpubliceren).
3. **Aanpassing terugpushen** — **kan al, geen "plan"-slide nodig**: pas op de canvas
   bijvoorbeeld de waarde in de voorwaarde aan ("Stadsdeel West" → "Stadsdeel Oost",
   via de inspector van het voorwaarde-element), terug in de toegang-activity:
   menu Beleid → **"Lees terug uit Modelleren (vervangt tekst; Ctrl+Z kan)"**.
   - Werking (`diagramprofielen/toegangsregel/terugweg.js`, getest): element-namen op de
     canvas zíjn canonieke taalfragmenten; de terugweg reconstrueert de tekst en de
     bestaande parser bewaakt de betekenis. Onvolledige kaarten worden overgeslagen
     met een melding, nooit half uitgeschreven.
   - Demo-tip: verander een **waarde of voorwaarde** (veilig en zichtbaar), geen halve
     kaarten achterlaten.

## Geteste beleidstekst (parse ✓, canonieke render ✓, ODRL ✓: 2 permissions + 1 prohibition)

```
Beleid "Persoonsgegevens np-loc demo".
  Geldig vanaf 15 september 2026.
  Grondslag: de Gemeentewet.
  Doel: "dienstverlening".

  Begrippen.
    Een medewerker is: iemand met rol "medewerker".
    Een medewerker West is: iemand met rol "medewerker" en afdeling "West".
    Een telefoonmedewerker is: iemand met rol "medewerker" en kanaal "telefoon".
    De persoonsgegevens zijn: alle gegevens van een natuurlijk persoon.

  Regel "inzage eigen stadsdeel".
    Een medewerker West mag de persoonsgegevens bekijken
    als de wijk van de woonlocatie van de betrokkene "Stadsdeel West" is.

  Regel "avonddienst gemeentebreed".
    Een medewerker mag de persoonsgegevens bekijken
    als de dienst van de aanvrager "avond" is.

  Regel "geen geslacht aan de telefoon".
    Een telefoonmedewerker mag het geslacht van een natuurlijk persoon niet bekijken.
```

Bonus (ook getest) — de driewaardige optionaliteit van GE **Aanspraak**
(aanspreektitel: meneer/mevrouw/hen; formeelAanspreken: boolean; beide optioneel,
dus per veld onbekend/bekend), met de unaire operator in bijzinsvolgorde:

```
  Regel "aanspreken zonder geslacht".
    Een telefoonmedewerker mag de aanspreektitel van de aanspraak van een natuurlijk persoon bekijken
    als de aanspreektitel van de aanspraak van de betrokkene bekend is.
```

Verhaal erbij: géén instantie van Aanspraak = niets geregistreerd in de bitemporele
db = "onbekend"; `is bekend` / `is onbekend` zijn kern-operatoren, dus dit vraagt
niets nieuws van de taal.

### Formuleringsvalkuilen bij het live typen

- Handeling heet **`bekijken`** — "zien" is geen geregistreerde actie (synoniemen kunnen
  t.z.t. in het lexicon; de formatter normaliseert dan naar canoniek).
- "mogen **nooit**" bestaat niet — ontkenning zit alleen in de modaliteit: **`mag … niet`**.
- "Een medewerker **van afdeling West** mag …" werkt niet als los subject (de
  begripsnaam zou "van afdeling West" opslokken): definieer het als **begrip** met
  kenmerken — `Een medewerker West is: iemand met rol "medewerker" en afdeling "West".`
  Kenmerken zijn vrij (register-gedreven), dus "afdeling" en "kanaal" vragen geen
  taalwijziging.
- "**alleen** … als" hoeft niet gezegd: default deny maakt elke permission al
  "alleen als" (zie stapeling hieronder).

## Prio / stapeling van regels (vraag uit de werkgroep voor zijn)

Er zijn **geen numerieke prioriteiten** — bewust. Het combinatie-algoritme ligt vast
(ontwerpdoc §7, ODRL `conflict: prohibit`, deny-overrides in XACML/OPA-termen):

1. **Default deny** — geen regel van toepassing ⇒ geen toegang.
2. **Permissions stapelen als OR** — elke toestemming opent een deur; regel 1 en
   regel 2 naast elkaar is gewoon: méér gevallen waarin het mag.
3. **Verbod wint altijd** — regel 3 klapt het veld `geslacht` dicht voor
   telefoonmedewerkers, óók tijdens de avonddienst van regel 2. Volgorde in het
   document doet er niet toe.

Daardoor is beleid leesbaar zonder verborgen ordening: je hoeft nooit te weten
"welke regel eerst komt", alleen of er érgens een verbod geldt. Als ooit echt
gelaagd beleid nodig is (uitzondering-op-uitzondering, mandaat/delegatie), is dat
het ODRL v2-spoor (Policy Inheritance) — benoemen als plan, niet demoën.

## Checklist vóór dinsdag

- [ ] Demo-model np-loc-org+geo staat in de modelleeromgeving en de velden verschijnen
      in de modelboom van de toegang-activity (opdracht bij andere chat; acceptatie:
      bovenstaande tekst parseert zonder controle-meldingen).
- [ ] Beleidstekst hierboven als fallback klaarzetten (plak-versie) naast het live typen.
- [ ] Round-trip één keer doorlopen op de demo-machine (publiceer → canvas-edit →
      teruglezen → Ctrl+Z tonen).
- [ ] Info-paper-pdf klaarzetten om te delen in de meeting-chat.
- [ ] OAS → canoniek: alléén als plan noemen, tenzij de andere chat het vóór dinsdag
      af heeft (oas31-profiel importeert al OAS 3.0/3.1 als eigen notatie; de
      transformatie naar canoniek-uml bestaat nog niet).
