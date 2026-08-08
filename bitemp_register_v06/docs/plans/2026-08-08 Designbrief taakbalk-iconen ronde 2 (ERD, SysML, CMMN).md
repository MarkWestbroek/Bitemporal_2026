# Designbrief: taakbalk-iconen ronde 2 — ERD, SysML, CMMN (+ de gedragsset)

**Voor:** design-chat (Omnium Studio-huisstijlcontext)
**Van:** Studio-team
**Datum:** 2026-08-08
**Context vooraf lezen:** `docs/STUDIO-05-vormgeving-handover.md` (ronde 1 —
stijlrichting, besluiten B1–B6, wat er al staat) en
`docs/plans/2026-07-29 Overdracht Notaties — diagramprofielen (status).md`
(wat de drie nieuwe profielen zijn en waarom).

> **Uitgevoerd (2026-08-08).** Antwoord + implementatie:
> `docs/STUDIO-05-iconen-ronde2-antwoord.md`. Alle 38 elementtypen hebben een
> icoon (22 nieuw in `erd|sysml|cmmn/iconen.jsx`, 13 hergebruikte ids), de vijf
> ontwerpvragen zijn beantwoord en de gedragsset is bevestigd met twee
> correcties. Wat hieronder staat is de opdracht, niet de uitkomst.

> Dit is **ronde 2** van de iconensessie van 4/5 juli. Ronde 1 leverde de
> stijlrichting en 30 iconen voor de structuurprofielen. Sindsdien zijn er
> acht profielen bijgekomen; drie daarvan hebben **helemaal geen** iconen en
> vijf draaien nog op bewust-neutrale placeholders. Deze sessie levert
> **ontwerp**; registreren is daarna invullen.

---

## De vraag

Ontwerp de **elementtype-iconen** voor drie nieuwe diagramprofielen — ERD,
SysML en CMMN — in de familie die in ronde 1 is vastgesteld, en neem daarbij
een besluit over de **gedeelde gedragsset** die nu nog placeholder is.

## Waarom het nu knelt

Een icoon verschijnt op drie plekken: de **"Maken"- en "Verbinding"-taakbalken**
(icoon + korte tekst), de **elementen-browser** links (icoon + naam) en de
**projectboom** van Modelleren. Zonder eigen icoon valt een elementtype terug
op zijn *ShapeType* — class-box wordt een doosje, elke connector wordt hetzelfde
swoosh-lijntje.

Concreet: in de ERD-balk tonen alle drie de knoppen hetzelfde doosje, in de
SysML-balk acht van de tien, en álle connectoren in alle drie de profielen delen
één en hetzelfde lijn-glyph. Bij tien connectoren (SysML) is dat onbruikbaar —
de gebruiker leest dan alleen nog de tekst, en het icoon is ruis.

## Stand van zaken per profiel

| Profiel | Iconen | Herkomst |
|---|---|---|
| canoniek-uml, puur-uml, oas31, mim12, profiel-ontwerp | ✅ | `iconenVocabulaire.jsx` (30, ronde 1) |
| dmn-drd | ✅ | mini-shapes (stadium, hoek-af, golfrand) |
| archimate | ✅ | `archimate/iconen.jsx` — 22 spec-iconen, **niet herontwerpen** |
| toegangsregel | ✅ | `toegangsregel/iconen.jsx` (vormentaal-sessie 23/24-07) |
| statemachine, activity, usecase, bpmn, sequence | 🟡 | `gedragTypeIconen.jsx` — 15 glyphs, expliciet *"neutraal, wacht op de ontwerp-sessie"* |
| **erd, sysml, cmmn** | ❌ | geen — vallen terug op de shape |
| formulier | ❌ | geen (dogfood-profiel, lage prioriteit) |

## Scope

**A. Drie nieuwe profielen (prioriteit).** 38 elementtypen, waarvan 24 connectoren.
**B. De gedragsset (besluit).** 15 gedeelde glyphs bevestigen óf herontwerpen.
**C. Buiten scope.** ArchiMate (spec-iconen), toegangsregel (net ontworpen),
formulier, en de activity-bar-iconen van de drie nieuwe profielen — die zijn er
al (`IconERD05`, `IconSysML05`, `IconCMMN05`) en volgen het 0.5-familiepatroon.

---

## A1. ERD — 6 elementtypen

Entity-relationship met kraaienpoten (Information Engineering).

| Type | Betekenis | Vorm op het canvas | Hint |
|---|---|---|---|
| Entiteit | ding waarover je gegevens vastlegt | class-box; **sleutel boven de streep**, kolommen eronder | tabel? sleutel? |
| Domein | groepeert entiteiten | gestreept kader | vgl. bestaand `kader` |
| Notitie | vrije tekst | note | hergebruik `notitie` |
| **Relatie** | kraaienpootlijn, kardinaliteit per uiteinde | lijn met ‖ / ○\| / \|< / ○< | de kraaienpoot zelf |
| **Subtype** | supertype/subtype | lijn + open driehoek | vgl. bestaand `generalisatie` |
| **Bevat (domein)** | lidmaatschap | gestreepte lijn, verborgen bij nesting | vgl. bestaand `bevat` |

*Waarschijnlijk het meeste hergebruik van alle drie: vier van de zes hebben een
tegenhanger in de bestaande vocabulaire.*

## A2. SysML — 21 elementtypen

Blokken (bdd), interne blokdiagrammen (ibd) en requirements.

**Knopen (10)**

| Type | Betekenis | Vorm op het canvas |
|---|---|---|
| Blok | «block», de bouwsteen; is óók het ibd-frame | class-box, compartimenten values/parts/operations |
| Part | een deel bínnen een blok (rolnaam : Type) | class-box, «part» |
| **Poort** | aansluitpunt óp de rand van blok of part | vierkantje 16px, met in/uit-pijltje |
| Waardetype | «valueType», waarde zonder identiteit | class-box |
| Interfaceblok | «interfaceBlock», wat er over een poort gaat | class-box |
| Constraintblok | «constraint», vergelijking met parameters | class-box |
| Enumeratie | vaste verzameling waarden | class-box |
| **Requirement** | eis met id en tekst | eigen doos: kop, `id =`, `text =` |
| Pakket | groepering | hangmap (bestaand `package`) |
| Notitie | vrije tekst | note |

**Lijnen (11)** — vijf hebben een directe UML-tegenhanger in de vocabulaire
(`compositie`, `aggregatie`, `generalisatie`, `associatie`, `dependency`).
Nieuw te ontwerpen:

| Type | Betekenis | Notatie |
|---|---|---|
| **Traceerrelatie** | satisfy · verify · deriveReqt · refine · trace, als één connector met een soort-keuze | gestreept, open pijl, «stereotype»-label |
| **Connector (ibd)** | verbindt twee poorten binnen een blok | kale lijn |
| **Item flow** | wat er over een connector stroomt | lijn + gevulde pijl |
| **Bevat (requirement)** | deelrequirement van een samengestelde | lijn + **⊕** aan de ouderkant |
| Bevat (part) / Bevat (pakket) | lidmaatschap | gestreept, verborgen bij nesting |

## A3. CMMN — 11 elementtypen

Casusmodel. Let op: CMMN's vormentaal is uitgesproken, dus hier ligt "mini-shape
als icoon" het meest voor de hand (zie ontwerpvraag 1).

| Type | Betekenis | Vorm op het canvas |
|---|---|---|
| Case plan model | de buitenste omhulling van de casus | **mapvorm** (tab linksboven) |
| Stage | fase; container | **achthoek** (afgeschuinde hoeken) |
| Task | het werk; vier soorten (human · process · case · decision) | afgeronde rechthoek + type-icoontje linksboven |
| Milestone | bereikt resultaat, géén werk | **stadion** (halfronde uiteinden) |
| Event listener | wacht op timer of gebruiker | **dubbele cirkel** |
| Case file item | gegeven in het dossier | dokje met omgevouwen hoek |
| **Sentry** | de bewaker op de rand: **open** = entry, **gevuld** = exit | ruit van 18×24 op de omtrek |
| Notitie | vrije tekst | note |
| **On-part** | "als dít gebeurt, gaat die bewaker open" | gestippelde lijn naar een sentry |
| Associatie | losse koppeling | gestippelde lijn |
| Bevat (stage) | lidmaatschap | gestreept, verborgen bij nesting |

De **vier task-soorten** hebben al icoontjes ín de vorm (human ☺ · process ▸ ·
case ▤ · decision ⊞). Die zijn 14×14 en in dezelfde geest getekend; de vraag is
of ze zó goed zijn of meegenomen moeten worden in het ontwerp.

---

## B. Besluit over de gedragsset

`diagramprofielen/gedragTypeIconen.jsx` bevat 15 glyphs die vijf profielen delen
(state machine, activity, use case, BPMN, sequence): `gedrag-begin`, `-eind`,
`-flow-eind`, `-fork`, `-ruit`, `-junction`, `-historie`, `-entry`, `-exit`,
`-toestand`, `-composiet`, `-submachine`, `-object`, `-pin`, `-lane`.

De kop van dat bestand zegt het zelf: *"neutrale 14px-vormen … de échte
merk-iconenset blijft een ontwerp-sessie; dan zijn dit puur her-registraties."*
Dat moment is nu. Twee mogelijke uitkomsten, allebei prima:

1. **Bevestigen** — ze zijn af, alleen de kop-comment aanpassen.
2. **Herontwerpen** — ze zijn afgeleid van de canvasvormen en missen het
   "één gevuld accent"-kenmerk dat ronde 1 heeft vastgelegd.

---

## Ontwerpvragen (waar we een besluit van je willen)

**1. Wanneer is het icoon een mini-vorm, en wanneer een symbool?**
Bij DMN is het icoon letterlijk de shape in het klein (stadium, afgeknipte
hoeken, golfrand) en dat werkt goed, want de vorm ís de betekenis. Bij UML is
het icoon juist een *symbool* (klasse met kopbalk, generalisatie-driehoek). CMMN
zit in het eerste kamp, SysML in het tweede, ERD ertussenin. Graag een expliciete
regel in plaats van per geval improviseren.

**2. Hoe ver gaat hergebruik over profielen heen?**
Ronde 1 legde vast dat gedeelde concepten één id delen (Entiteit/Klasse →
`klasse`). Vragen nu: is een **SysML-blok** hetzelfde als een UML-klasse (beide
class-box) of verdient «block» een eigen glyph? Is een **ERD-entiteit** een
`klasse` of een tabel? Is een **CMMN-task** dezelfde als een BPMN-taak? Hoe meer
hergebruik, hoe minder er te tekenen valt — maar wel ten koste van
profiel-herkenbaarheid.

**3. Connector-iconen — het echte gat.**
24 van de 38 nieuwe typen zijn lijnen, en die delen nu allemaal één glyph. Een
connector-icoon moet in ~12px het onderscheid dragen tussen bijvoorbeeld
compositie (◆), item flow (gevulde pijl) en containment (⊕). Wat is het
grondpatroon: **een schuin lijnstukje met het marker-symbool aan één kant**, of
iets anders? Dit is de beslissing met de meeste impact.

**4. Sentry op 14px.** Open vs. gevulde ruit is op canvasformaat prima (en het
is de enige drager van entry vs. exit), maar op icoonformaat is het verschil
tussen ◇ en ◆ subtiel. In de taakbalk staat er één sentry-knop, dus daar speelt
het niet — maar in de elementen-browser staan ze naast elkaar. Nodig: één
sentry-glyph, of twee die op 14px echt uit elkaar te houden zijn?

**5. Kraaienpoot op 14px.** Idem: ‖ / ○| / |< / ○< is vier varianten van
hetzelfde. In de taakbalk is er één "Relatie"-knop, dus vermoedelijk volstaat één
glyph met de kraaienpoot als motief — graag bevestigen.

---

## Kaders (uit ronde 1, ongewijzigd)

- **Familie**: outline + **precies één gevuld accent** in `currentColor` op het
  betekenisdragende kenmerk. 14×14 viewBox, `stroke="currentColor"`,
  `fill="none"`, strokeWidth ~1.2, `strokeLinecap/-linejoin: round`.
- **Alleen currentColor** — de iconen moeten in licht én donker thema werken;
  geen eigen hexen.
- Ze renderen op **11–15px** (taakbalk 14, browser 12–13, minibrowser 11) en
  mogen niet detoneren naast de uitlijn-iconen
  (`diagramcore/taskbar/uitlijnIcons.jsx`, 15px, stroke 1.25).
- **Definitie-domein blijft serialiseerbaar**: een profiel verwijst alleen met
  `icoon: "<id>"`; componenten leven in het Implementatie-domein.
- **Merk**: Omnium Studio, kerngradient `#60a5fa → #6366f1 → #22d3ee`
  (assets in `web/omnium-studio/`). De gradient zelf komt niet in de iconen —
  die zijn monochroom.

## Waar het landt (technisch, ter info)

- Registry: `diagramcore/shapes/typeIconen.jsx`, API
  `registreerTypeIcoon(id, Component)`. Een component krijgt `{ maat }`.
- Nieuwe sets het liefst per profiel: `diagramprofielen/<profiel>/iconen.jsx`,
  aangeroepen vanuit `registreerX()` — precies zoals `archimate/iconen.jsx` en
  `toegangsregel/iconen.jsx` het doen.
- Generieke vormen die meerdere profielen delen horen in
  `diagramcore/shapes/iconenVocabulaire.jsx` (nu 30 ids: `aggregatie`,
  `associatie`, `bevat`, `compositie`, `constraint`, `datatype`, `dependency`,
  `enumeratie`, `gebruik`, `generalisatie`, `interface`, `kader`, `keuze-een`,
  `keuze-elk`, `klasse`, `lijst`, `notitie`, `operatie`, `package`, `realisatie`,
  `reeks`, `relatie-box`, `schema`, `veld`, `verwijzing`, …).

## Oplevering

Per profiel: een lijst van `icoon`-ids met daarbij het SVG-pad (of een
beschrijving die eenduidig genoeg is om te tekenen), plus voor elk elementtype
welke id het krijgt — inclusief de gevallen waar een **bestaande** id wordt
hergebruikt. Antwoorden op de vijf ontwerpvragen. Dan is de implementatie
mechanisch: drie `iconen.jsx`-bestanden en `icoon:`-regels in de descriptors.

## Verifiëren

`npm run dev` in `bitemp_register_v06/web/vite` →
`/viz/react/studio.html` → menu **Ga naar** → ERD / SysML / CMMN. De
"Maken"- en "Verbinding"-balken en de elementen-browser links tonen de iconen
direct; de themawissel zit rechtsboven. `npx vite build` moet schoon blijven;
node-tests raken iconen niet.
