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

## Alternatief: voorbeeldbeleid puur np-loc (geen org/geo nodig)

Getest tegen het np-loc-model zoals in `model/np_loc_*.go` (veldenlijst via
`verzamelVelden`, relatieDiepte 2): parse ✓, **0 controle-meldingen**, ODRL
3 permissions + 1 prohibition.

```
Beleid "Burgerzaken np-loc voorbeeld".
  Geldig vanaf 15 september 2026.
  Grondslag: de Wet basisregistratie personen.
  Doel: "burgerzaken".

  Begrippen.
    Een baliemedewerker is: iemand met rol "baliemedewerker".
    Een postmedewerker is: iemand met rol "postmedewerker".
    De naamgegevens zijn: alle gegevens van de namen van een natuurlijk persoon.

  Regel "naam aan de balie".
    Een baliemedewerker mag de naamgegevens bekijken
    waarbij: elke raadpleging wordt vastgelegd in het logboek.

  Regel "partnernaam alleen bij partnernaamgebruik".
    Een baliemedewerker mag de achternaam van de partnernamen van een natuurlijk persoon bekijken
    als het naamgebruik van de naamgebruiken van de betrokkene niet "EigenNaam" is.

  Regel "briefadres voor de post".
    Een postmedewerker mag de postcode van de adressen van de bereikbaarheden van een natuurlijk persoon bekijken
    als de soort van de bereikbaarheden van de betrokkene een van ("Briefadres", "Correspondentieadres") is.

  Regel "geen bsn naar de post".
    Een postmedewerker mag de bsn van een natuurlijk persoon niet bekijken.
```

Registerpaden na resolutie: `NatuurlijkPersoon.partnernamen.achternaam`,
`NatuurlijkPersoon.bereikbaarheden.adressen.postcode`, en voor het verbod
`NatuurlijkPersoon.persoonsidentificaties.bsn` — "de bsn van een natuurlijk
persoon" is dus de **verkorte** keten, eenduidig resolved.

**Twee live-momenten voor een controle-melding** (beide getest):

- *Dubbelzinnigheid*: maak in regel 2 van de keten "de achternaam van een natuurlijk
  persoon" → melding "dubbelzinnig: het kan `…namen.achternaam`,
  `…partnernamen.achternaam` zijn. Gebruik de volledige keten."
- *Enum-bewaking*: schrijf de voorwaarde als `als het naamgebruik van een natuurlijk
  persoon niet "Eigennaam" is` (typfout) → melding "geen toegestane waarde …
  Toegestaan: "EigenNaam", "PartnerNaam", …".

**Let op:** de typebewaking werkt alleen op ketens die op een **type** eindigen
("… van een natuurlijk persoon"). Ketens die op een **anker** eindigen ("… van de
betrokkene") worden niet tegen het model gecontroleerd: dezelfde typfout in die vorm
geeft géén melding. Voor de demo de type-vorm gebruiken; als bekend gat noemen
(backlog-kandidaat: anker-ketens resolven via het type van het doelwit van de regel).

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

- [x] Demo-model np-loc-org+geo staat in de modelleeromgeving en de velden verschijnen
      in de modelboom van de toegang-activity (acceptatie gehaald: bovenstaande tekst
      **en** de bonus-regel parseren zonder controle-meldingen — bewaakt door
      `studio/activities/toegangDemoModel.test.js` en `model/demo_model_test.go`).
      Zie `docs/demo-model-np-loc-org-geo.md`. Let op: de Go-backend moet op de
      demo-machine herbouwd draaien, anders levert de schema-API het oude model.
- [ ] Beleidstekst hierboven als fallback klaarzetten (plak-versie) naast het live typen.
- [ ] Round-trip één keer doorlopen op de demo-machine (publiceer → canvas-edit →
      teruglezen → Ctrl+Z tonen).
- [ ] Info-paper-pdf klaarzetten om te delen in de meeting-chat.
- [x] OAS → canoniek: is er — *Transformeren → importeren → "OpenAPI
      (components.schemas) → canoniek model"*. Eerste stap: alleen
      `components.schemas`, eerlijk in plaats van genormaliseerd, met diagnostics.
      Gedraaid op de **OpenOrganisatie**-OAS (`~/Documents/GitHub/CG/Registers/
      open-organisatie/src/organisatie-openapi.yaml`): 27 schemas → 25 entiteiten,
      33 GE's, 28 relaties, 1 enum. Let op voor de demo: de REST-schil komt mee
      (`Paginated…List`, `Patched…`, `Nested…` worden entiteiten) — dat is opzet,
      maar noem het even, anders leest het als een fout.
      Zie `docs/STUDIO.md` → "OpenAPI → canoniek model".
