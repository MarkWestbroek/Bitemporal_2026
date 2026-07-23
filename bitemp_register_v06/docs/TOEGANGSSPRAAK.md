# Toegangsspraak — functionele en technische beschrijving

**Status:** v0 (werkend prototype, branch `feat/toegangsspraak`)
**Ontwerp & besluiten:** `docs/plans/2026-07-22 Klare-taal Toegangsbeleid — Toegangsspraak (ontwerp).md`
**Context:** Werkgroep FTV / Register Toegangsbeleid; ODRL-ontwerp in
`docs/plans/ODRL-Register-Toegangsbeleid.md` en de whitepaper ernaast.

---

## 1. Functionele beschrijving

### Wat is het?

Toegangsspraak is een **klare-taal beleidstaal** voor toegangsbeleid: leesbaar
voor leken (beleidsmakers, juristen, burgers), met de dekking van de
NLGov-ODRL-subset en daarmee vertaalbaar naar runtime-engines
(OPA/Cedar/XACML). Het is een *gecontroleerde natuurlijke taal*: elke zin
volgt een vast patroon en heeft precies één betekenis.

Eén kernzin draagt de taal:

> **\<wie\> mag \<gegevens\> \<handeling\>** — of **mag … niet** —
> **[ als \<voorwaarden\> ] [ waarbij: \<verplichtingen\> ]**

```
Beleid "Inzage inkomen bij schuldhulp".
  Geldig vanaf 1 mei 2026.
  Grondslag: de Wet gemeentelijke schuldhulpverlening.
  Doel: "schuldhulpverlening".

  Begrippen.
    Een schuldhulpverlener is: iemand met rol "schuldhulpverlener".
    Inkomensgegevens zijn: alle gegevens van het inkomen van een natuurlijk persoon.

  Regel "inzage bij lopend dossier".
    Een schuldhulpverlener mag de inkomensgegevens bekijken
    als aan alle volgende voorwaarden is voldaan:
      - het doel van de aanvraag is "schuldhulpverlening";
      - de achternaam van de naam van de betrokkene begint met "A";
    waarbij: elke raadpleging wordt vastgelegd in het logboek.

  Regel "geen export".
    Een schuldhulpverlener mag de inkomensgegevens niet exporteren.
```

### Taaleigenschappen (voor de auteur)

- **Van-vorm**: naar gegevens verwijs je in woorden — "de achternaam van de
  naam van een natuurlijk persoon". "Van" volgt de compositie in het model
  omgekeerd. Ketens mogen **verkort** zolang ze eenduidig zijn; het technische
  registerpad wordt als shorthand ook geaccepteerd.
- **Begrippen**: definieer rolgroepen en gegevensverzamelingen één keer en
  gebruik ze in regels. Onbepaalde termen mogen ("Mail is: …",
  "Inkomensgegevens zijn: …").
- **Voorwaarden zonder en/of-ambiguïteit**: meerdere voorwaarden gaan in een
  opsomming ("aan alle / aan ten minste één van / aan precies één van de
  volgende voorwaarden is voldaan"), nestbaar.
- **Nederlandse woordvolgorde**: na "als"/"waarvan" de bijzinsvolgorde
  ("… niet "nl" **is**"), in opsommingen de stellingsvorm; beide worden
  geaccepteerd, herformatteren normaliseert.
- **Vaste conflictregel**: wat niet uitdrukkelijk is toegestaan, mag niet;
  een verbod gaat altijd vóór een toestemming.
- **Uitbreidbaar per domein**: vergelijkingen ("valt geheel binnen"),
  handelingen en plichten komen uit registers, niet uit de grammatica.

### De editor (Omnium Studio → Toegangverlening, status concept)

- **Live parsen** met foutmeldingen in klare taal (regel + kolom) en een
  statusregel; tab "Canonieke vorm" toont de geherformatteerde tekst (met
  dezelfde ontleding); tab "Diagram" toont de regels als read-only
  regelkaarten (toegangsregel-profiel, zelfde kleuren);
  menu Beleid: voorbeeld laden, herformatteren, ODRL-export.
- **Zinsontleding** (schakelaar): zinsdelen krijgen kleur — subject groen,
  gegevens geel, waarde blauw, vergelijking paars, handeling oranje, plicht
  zeegroen, mag/niet vet.
- **Autocomplete, twee kanten op**: een woord typen stelt van-vormen voor;
  "de naam van " typen stelt de bases voor die zo'n veld hebben. Labels tonen
  het overslabare deel tussen haakjes. **Tab** bladert, **Ctrl+Space** voegt
  de korte vorm in, **Shift+Ctrl+Space** de volledige keten. Binnen een
  bestaande keten vervangt een suggestie de héle keten. **Ctrl+Z** werkt op
  alle invoegingen.
- **Modelboom-koppeling**: velden klikken/slepen uit de ModelPicker voegt de
  van-vorm in; dubbelklik op een gegevens-keten in de tekst kadert hem,
  toont het registerpad en focust het exacte element in de boom (boom blijft
  staan; context zichtbaar).
- **Metamodel-controle** (schema-API): keten-resolutie met verkorting,
  typebewaking ("begint met" kan alleen met tekst; enum-waarden bewaakt) als
  niet-blokkerende "Controle"-meldingen; de ODRL-uitvoer gebruikt de
  geresolvede registerpaden.

### Wat het (nog) niet is

Geen runtime-engine (de PDP beslist), geen identiteitsbeheer, geen opslag —
bitemporele registratie van beleidsteksten en de vertalers naar Rego/Cedar
zijn de fase 2/3-sporen uit de whitepaper. Existentie-voorwaarden ("er is een
lopend dossier") en een nette plicht-subgrammatica staan op de rol (ontwerpdoc
§10/§12).

---

## 2. Technische beschrijving

### Plaats in de architectuur

```
klare tekst ──parser──▶ AST (+ spans) ──validatie/resolutie──▶ ODRL JSON-LD (NLGov)
   ▲                          │   (metamodel: schema-API)          │
   └────── renderer ◀─────────┘                     vertalers → Rego/Cedar (fase 3)
```

De tekst is de bron; de canonieke van-vorm en de ODRL-weergave zijn twee
projecties van dezelfde AST. Round-trip is een geteste wet:
`render(parse(t))` is de canonieke schrijfwijze en `parse(render(b)) = b`.

### Modules — `web/vite/src/toegangsspraak/` (plain JS, geen dependencies)

| Module | Rol |
|---|---|
| `woorden.js` | CamelCase ↔ woorden, lidwoord-heuristiek, NL-datums, slugs |
| `operatoren.js` | registers: vergelijkingen (met `typen` voor typebewaking), handelingen, plichten; `registreer*()` voor domeinprofielen (geo meegeleverd) |
| `parser.js` | tokenizer + recursive-descent parser → AST + `spans` (bronposities per element-soort); accepteert stelling- én bijzinsvolgorde; pad-shorthand; `padNaarVerwijzing`/`verwijzingNaarPad` |
| `renderer.js` | AST → canonieke tekst; bijzinsvorm na als/waarvan, stellingsvorm in opsommingen |
| `odrl.js` | AST → ODRL JSON-LD (Permission/Prohibition/Duty, LogicalConstraint, Party-/AssetCollection, `conflict: prohibit`); gebruikt geresolvede paden waar aanwezig |
| `metamodel.js` | veldindex over de schema-API-velden; keten-resolutie (verkorting, dubbelzinnigheids-fouten, metamodel-casing); typebewaking; `suggereerVanVormen`/`suggereerBases` |
| `editorSuggesties.js` | autocomplete-context: binnen-keten (span-vervanging), achterstevoren, vooruit (met lidwoord-meevervanging) |
| `voorbeeld.js` | canoniek voorbeeldbeleid (round-trip-anker) |

Daarnaast: `diagramprofielen/toegangsregel/` — het **toegangsregel-profiel**
op de generieke motor (elementtypen + connectoren, ontleding-kleuren als
profielstijl) met `adapter.js` (AST → profielmodel, deterministisch) en de
read-only diagramweergave `studio/activities/ToegangDiagram.jsx`. Ontwerp en
stappenplan: `docs/plans/2026-07-24 Toegangsregel-profiel (ontwerp).md`.

Ontwerpkeuzes: LL(1)-achtige grammatica (één functie per regel), operatoren
als data (longest match; bijzins-grenswoorden afgeleid uit het register),
nesting via bullet-insprong uit de tokenizer, spans los van de AST (AST blijft
positie-onafhankelijk vergelijkbaar). Zie ontwerpdoc §12.1 voor het
activity-diagram.

### Studio-activiteit — `web/vite/src/studio/activities/toegangActivity.jsx`

Descriptor volgens het `dmnActivity`-patroon (Provider + Sidebar/Main/
Inspector, menu's via `menuBus`), `status: "concept"`. Editor op
`react-simple-code-editor` + Prism (eigen grammar); zinsontleding rendert de
parser-spans als gekleurde HTML (`toegangActivity.css`). Invoegingen lopen via
`document.execCommand("insertText")` zodat de undo-historie intact blijft.
De `ModelPicker` (gedeeld component) kreeg twee optionele props:
`focusVeldpad` (element-focus: openklappen + markeren + scrollIntoView, boom
blijft staan) en `externeZoekterm` (gestuurd filteren).

### Tests & draaien

- Unit tests naast de code (`*.test.js`, Node test runner):
  `toegangsspraak.test.js` (grammatica, round-trip, ODRL),
  `metamodel.test.js` (resolutie, typebewaking, suggesties),
  `editorSuggesties.test.js` (contexten, span-vervanging, dubbele-de).
  Draaien: `npm test` in `web/vite` (of `node --import ./test/register-aliases.mjs --test src/toegangsspraak/*.test.js`).
- Editor: `npm run dev` → `/viz/react/studio` → menu *Ga naar* →
  Toegangverlening. Zonder draaiende Go-backend werkt alles behalve de
  metamodel-controle en de modelboom (schema-API `/api/schema/model/code`).
