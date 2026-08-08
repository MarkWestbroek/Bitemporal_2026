# Antwoord op de designbrief — taakbalk-iconen ronde 2 (ERD, SysML, CMMN)

**Datum:** 2026-08-08 · **Brief:** `docs/plans/2026-08-08 Designbrief taakbalk-iconen
ronde 2 (ERD, SysML, CMMN).md` · **Ronde 1:** `docs/STUDIO-05-vormgeving-handover.md`

**Specimenvel (alle iconen op ware grootte, licht + donker):**
<https://claude.ai/code/artifact/9259e6f4-9093-4983-96cb-f3da15f0caca>

Dit is ontwerp **én** implementatie: alle 38 elementtypen hebben een icoon, de
vijf ontwerpvragen zijn beantwoord en het besluit over de gedragsset is
genomen en doorgevoerd. Er staat dus geen "registreren is daarna invullen"
meer open.

---

## Antwoorden op de vijf ontwerpvragen

### 1. Mini-vorm of symbool? — een regel in drie stappen

> **Het icoon tekent wat het type ónderscheidt, en dat is niet altijd de vorm.**
>
> 1. Draagt de canvasvorm zélf het onderscheid — is het silhouet uniek binnen
>    het profiel? → **mini-silhouet**, met het gevulde accent op het detail dat
>    de variant bepaalt.
> 2. Deelt het type zijn silhouet met andere typen (vrijwel altijd: class-box)?
>    → **symbool**: teken wat er ín de doos staat, niet de doos.
> 3. Grensgeval: een silhouet dat samenvalt met de neutrale fallback (kale
>    doos, kale afgeronde rechthoek) telt **niet** als onderscheidend — dan
>    alsnog regel 2. Een icoon dat gelijk is aan "geen icoon" is geen icoon.

Dat verklaart de brief-observatie zonder per geval te improviseren:

| Profiel | Uitkomst van de regel |
|---|---|
| CMMN | 7 unieke silhouetten → **alle zeven mini-vorm** (zoals DMN) |
| SysML | 6 van de 10 knopen zijn class-box → **symbool**, behalve poort/requirement/pakket (eigen vorm) |
| ERD | entiteit is class-box → symbool (tabelraster); domein is een kader → silhouet |

Stap 3 is niet theoretisch: `gedrag-toestand` bleek pixel-identiek aan de
`rounded`-fallback in `typeIconen.jsx` — zie het besluit over de gedragsset.

### 2. Hoe ver gaat hergebruik? — concept, niet vorm

Ronde 1 zei "zelfde concept = zelfde id". De aanscherping van ronde 2:
**gelijke vórm is geen reden tot hergebruik; gelijk begrip wel.** Toets:
zou een gebruiker die beide profielen kent zeggen "dat is hetzelfde ding"?

Uitkomst — 13 van de 38 typen lenen een bestaand icoon:

| Vraag uit de brief | Besluit | Waarom |
|---|---|---|
| SysML-blok = UML-klasse? | **Nee**, eigen `sy-blok` | In een bdd staan blok, waardetype, interfaceblok, constraintblok en enumeratie náást elkaar — allemaal class-box. Er moeten dus toch vijf symbolen komen, en dan is de kopbalk-van-`klasse` te zwak voor de belangrijkste. Wat een blok uniek maakt: het bevat parts. |
| ERD-entiteit = `klasse`? | **Nee**, eigen `erd-entiteit` | Een ERD-entiteit is een *tabel*, geen klasse: sleutel boven de streep, kolommen eronder. Zo blijft in de projectboom zichtbaar of een model UML of ERD is. |
| CMMN-task = BPMN-taak? | **Nee**, eigen `cmmn-taak` | De CMMN-task draagt op het canvas een soort-badge linksboven; regel 1 zegt hier "silhouet", en dat silhouet ís het badge. |
| Waardetype / interfaceblok / constraintblok / enumeratie / pakket / notitie | **Ja**: `datatype`, `interface`, `constraint`, `enumeratie`, `package`, `notitie` | Letterlijk dezelfde begrippen als in UML/OAS. |
| ERD-domein, ERD-subtype | **Ja**: `kader`, `generalisatie` | Idem — een supertype/subtype-lijn ís generalisatie. |
| SysML compositie/aggregatie/generalisatie/associatie/afhankelijkheid, bevat-pakket | **Ja**: de UML-connectoren uit ronde 1 | SysML v1 *ís* een UML-profiel; deze vijf lijnen zijn ongewijzigd overgenomen. |

### 3. Connector-iconen — het grondpatroon

24 van de 38 typen zijn lijnen. Het patroon dat ronde 1 impliciet al gebruikte,
nu expliciet:

> **Een horizontale lijn op de middenas (y = 7), van rand tot rand, met het
> markersymbool rechts. De lijnstijl is die van de connector zelf.**

Vier regels eromheen:

1. **Geen schuine lijnstukjes.** Een diagonaal op een 14px-raster levert een
   trapje op bij 11–12px en botst met de bestaande set. Horizontaal dus.
2. **Het symbool staat altijd rechts**, óók als de notatie hem aan de bronkant
   tekent (compositie ◆, containment ⊕). Het icoon toont het *symbool*, niet
   de richting — dat deed `compositie` in ronde 1 al zo.
3. **Staat er in de notatie iets óp de lijn, dan staat dat in het icoon in het
   midden.** Zo is `sy-itemflow` letterlijk de SysML-notatie: gevulde pijl
   halverwege de lijn.
4. **Containment krijgt de container als silhouet rechts**, met het gevulde lid
   erin: gestreepte lijn → container → gevuld blokje. Het verschil zit in de
   container, want dát is wat verschilt: `erd-bevat` (gestreept kader = domein),
   `sy-bevat-part` (doorgetrokken doos = blok), `cmmn-bevat` (achthoek = stage).
   De bestaande `bevat` (hangmap = package) valt in dezelfde reeks.

Vulling volgt B2 ongewijzigd: waar de notatie een marker open tekent (◇ ▷ ⊕,
de kraaienpoot), blijft hij ook in het icoon open.

### 4. Sentry op 14px — één glyph, en de vraag vervalt half

**Eén glyph.** De aanname in de brief — dat entry en exit in de
elementen-browser naast elkaar staan — gaat niet op: `TypeIcoon` kiest per
**elementType**, en entry/exit is een `soort`-*property* van één elementtype
(`cmmn/index.js`, `sentry`). Twee glyphs zijn technisch niet eens aan te
sturen zonder een nieuwe hook op elementniveau, en die is er niet.

Gekozen: de **open** ruit, want dat is de default bij aanmaken
(`data.soort = "entry"`) en open markers blijven open (B2).

### 5. Kraaienpoot op 14px — bevestigd, één glyph

**Eén glyph**, en om dezelfde reden: kardinaliteit is een property per uiteinde,
geen elementtype. `erd-relatie` tekent de archetypische ERD-lijn — één streep ‖
links, kraaienpoot rechts, dus "één-op-veel". Dat leest op 11px nog en zegt
"ERD" als geen ander symbool.

---

## Twee nieuwe familiemiddelen

Ronde 2 voegt twee afspraken toe die verder gaan dan deze drie profielen.

**A. Context gestreept, onderwerp gevuld.** Bestaat een type alleen *binnen*
iets anders, teken de gastheer dan gestreept en het onderwerp doorgetrokken of
gevuld. Zo staat `sy-part` (een deel in een blok) los van `sy-blok` zonder een
tweede symbool nodig te hebben.

**B. Randelement-motief.** Een type dat via `randElement` op de omtrek van zijn
gastheer klemt, krijgt een **gestreepte gastheerrand met het element erop**.
Dat is precies het motorprimitief uit STUDIO-05-gedragsdiagrammen §3.1, en het
icoon zegt daarmee hetzelfde als de motor: "dit hóórt bij iets anders."
Nu in gebruik door `sy-poort` (vierkantje) en `cmmn-sentry` (ruit); de
kandidaten voor later zijn BPMN-boundary-events, activity-pins en de
entry/exit-points van de state machine.

Praktijkdetail uit het tekenen: de gastheerrand moet **onderbroken** worden
waar een *open* element erop zit, anders loopt de streepjeslijn dwars door de
open ruit heen. Bij een gevuld element (de poort) is dat niet nodig.

---

## Oplevering per profiel

Nieuw: 22 iconen in drie bestanden. Hergebruikt: 13 ids uit
`iconenVocabulaire.jsx`. Alle paden staan in de bestanden zelf; hieronder de
toewijzing en de reden.

### ERD — `diagramprofielen/erd/iconen.jsx` (3 nieuw, 3 geleend)

| Elementtype | `icoon` | Beeld |
|---|---|---|
| Entiteit | `erd-entiteit` ✱ | tabelraster; het accent is de **sleutelcel** |
| Domein | `kader` ↺ | gestreept kader met gevulde naam-tab |
| Notitie | `notitie` ↺ | memo met gevuld ezelsoor |
| Relatie | `erd-relatie` ✱ | ‖ links, **kraaienpoot** rechts (één-op-veel) |
| Subtype | `generalisatie` ↺ | lijn + open driehoek |
| Bevat (domein) | `erd-bevat` ✱ | gestreepte lijn → gestreept kader → gevuld lid |

### SysML — `diagramprofielen/sysml/iconen.jsx` (9 nieuw, 12 geleend)

| Elementtype | `icoon` | Beeld |
|---|---|---|
| Blok | `sy-blok` ✱ | doos met naamregel en **twee parts**, waarvan één gevuld |
| Part | `sy-part` ✱ | gestreepte gastheer (context) + gevuld deel (onderwerp) |
| Poort | `sy-poort` ✱ | randelement-motief: gestreepte rand + gevuld vierkantje erop |
| Requirement | `sy-requirement` ✱ | doos met **uitroepteken** — leest op 11px nog als "eis" |
| Waardetype | `datatype` ↺ | ‹›-chevrons met gevulde kern |
| Interfaceblok | `interface` ↺ | lollipop met gevulde voet |
| Constraintblok | `constraint` ↺ | accolades met gevulde kern |
| Enumeratie | `enumeratie` ↺ | opsomming met gevulde bolletjes |
| Pakket | `package` ↺ | hangmap met gevulde naam-tab |
| Notitie | `notitie` ↺ | memo met gevuld ezelsoor |
| Compositie · Aggregatie · Generalisatie · Associatie · Afhankelijkheid | `compositie` · `aggregatie` · `generalisatie` · `associatie` · `dependency` ↺ | ongewijzigd uit ronde 1 |
| Traceerrelatie | `sy-trace` ✱ | gestreepte open pijl naar de **gevulde eis** |
| Connector (ibd) | `sy-verbinding` ✱ | twee poortjes met de verbinding als accent |
| Item flow | `sy-itemflow` ✱ | **gevulde pijl óp de lijn** — de SysML-notatie zelf |
| Bevat (requirement) | `sy-bevat-req` ✱ | het ⊕ links, open (B2) |
| Bevat (part) | `sy-bevat-part` ✱ | gestreepte lijn → blok → gevuld lid |
| Bevat (pakket) | `bevat` ↺ | gestreepte lijn → hangmap |

### CMMN — `diagramprofielen/cmmn/iconen.jsx` (10 nieuw, 1 geleend)

| Elementtype | `icoon` | Beeld |
|---|---|---|
| Case plan model | `cmmn-caseplan` ✱ | mapvorm; **vierkante** hoeken en brede tab — zo blijft hij los van de UML-hangmap |
| Stage | `cmmn-stage` ✱ | achthoek met de **afschuining** als gevulde wig |
| Task | `cmmn-taak` ✱ | afgeronde rechthoek met het soort-badge linksboven |
| Milestone | `cmmn-mijlpaal` ✱ | stadion met het bereikte punt |
| Event listener | `cmmn-event` ✱ | dubbele ring + gevulde kern |
| Case file item | `cmmn-casefile` ✱ | dokje met de **gegevensregel** als accent |
| Sentry | `cmmn-sentry` ✱ | randelement-motief met open ruit |
| Notitie | `notitie` ↺ | accent op de omgevouwen hoek |
| On-part | `cmmn-onpart` ✱ | gestippelde lijn → open ruit |
| Associatie | `cmmn-associatie` ✱ | gestreepte lijn tussen twee open uiteinden |
| Bevat (stage) | `cmmn-bevat` ✱ | gestreepte lijn → achthoek → gevuld lid |

> **Case file item vs. notitie.** Op het canvas zijn dat allebei een dokje met
> omgevouwen hoek — het onderscheid moest dus in het accent: bij de notitie de
> hoek, bij het case file item de gegevensregel erin.

---

## B. Besluit over de gedragsset: **bevestigd**, met twee correcties

De 15 glyphs in `gedragTypeIconen.jsx` zijn **niet** herontworpen, en dat is
een inhoudelijk besluit, geen bezuiniging: ze volgen regel 1 al. Bij
gedragsnotaties is het silhouet vrijwel altijd de betekenis (een fork ís een
balk, een eindtoestand ís een dubbele ring), dus "afgeleid van de canvasvorm"
was hier de juiste aanpak. De kop-comment die zichzelf placeholder noemde is
vervangen.

Twee dingen waren wél kapot:

1. **`gedrag-toestand` was identiek aan de `rounded`-fallback** — `rect 1.5 3
   11 8 rx 3.4` in beide bestanden. Een toestand (state machine), actie
   (activity) en task (BPMN) waren dus niet te onderscheiden van "elementtype
   zonder icoon". Nu met het familie-accent: een gevulde naamregel plus een
   compartimentslijn.
2. **BPMN's drie gateways deelden alle drie `gedrag-ruit`** — drie knoppen
   naast elkaar in één taakbalk met exact hetzelfde beeld. Precies wat de brief
   in §"Waarom het nu knelt" aanwijst. Ze hebben nu `gedrag-gateway-xor` (×),
   `-and` (+) en `-or` (○). `gedrag-ruit` blijft de kale ruit voor activity
   ("beslissing/samenvoeging") en state machine ("keuze"), waar hij de enige
   diamant in de balk is.

---

## Wat er nog open blijft

- **De ronde-1-connectoren zijn zwak op 14px.** `compositie`, `associatie` en
  `afhankelijkheid` lijken in de taakbalk sterk op elkaar: de ruit is klein en
  de lijnen zijn even lang. Dat is bestaand werk en niet aangeraakt, maar het
  valt nu op omdat SysML elf lijnen in één balk zet. Kandidaat voor een korte
  ronde 3: markers ~20% groter en de lijn iets korter.
- **`formulier`** heeft nog geen iconen (dogfood-profiel, buiten scope).
- **ArchiMate en toegangsregel** zijn ongemoeid gelaten, conform de brief.

## Verifiëren

`npm run dev` in `bitemp_register_v06/web/vite` → `/viz/react/studio.html` →
**Ga naar** → ERD / SysML / CMMN. `npx vite build` is schoon en de 414
node-tests draaien groen.

Let op één implementatiedetail: `erd/index.js` blijft **vrij van
`.jsx`-imports**, want `erd.test.js` laadt het rechtstreeks in node (anders dan
sysml/ en cmmn/, die eigen shapes hebben en dus toch al niet node-laadbaar
zijn). De ERD-iconen worden daarom in `erdActivity.jsx` geregistreerd in plaats
van in `registreerErd()`.
