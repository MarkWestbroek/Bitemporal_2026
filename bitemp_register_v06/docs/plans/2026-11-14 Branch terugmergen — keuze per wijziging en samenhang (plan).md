# Branch terugmergen: keuze per wijziging en samenhang (plan)

*14-11-2026. Opgesteld met Claude, na gesprek met Mark. Status: plan met besluiten (§6);
stap 1 (§5) uitgebracht in studio 0.41.0 / api 0.26.0 / render 0.4.5; stap 2a (vinkjes in een
boom, terugzetten) in studio 0.42.0 / api 0.27.0 / render 0.4.6. Zie §7.*

Vervolg op branch stap 1 (*Verschil met MAIN…*, zie `docs/STUDIO.md` "Branch = afgeleid
project"). Daar laat de Studio zien wat er verschilt; mergen gaat nog met de hand. Dit plan
beschrijft hoe een branch **via de Studio** terug naar MAIN gaat, met per wijziging de keuze
wat wel en wat niet mee gaat.

## 1. Het voorbeeld

```
MAIN         a ──── b ─────────── c ──────▶ merge
                    │(E)          │(G)        ▲
branch        └─ x ── y ── z ──────────────────┘
                 (D')  (E') (F')
```

- De branch wijzigt D, E en F; MAIN wijzigt intussen E en G.
- **E is een conflict.** De gebruiker houdt de versie van MAIN, maar merget D' en F'.
- Dat samenvoegen zelf is eenvoudig. Het werk zit in twee vragen: wat geldt daarna als
  uitgangspunt van de branch (§2), en wat mag los van elkaar mee (§3)?

## 2. Na de merge: het uitgangspunt

De vergelijking is een drieweg per eenheid: **uitgangspunt**, **branch** en **MAIN**. Nu is het
uitgangspunt de stand bij het afsplitsen (`basisVolgnummer`). Blijft dat zo, dan is E bij elke
volgende vergelijking weer een conflict: de keuze van de gebruiker staat nergens.

Na de merge staan de eenheden zo:

| | uitgangspunt (oud) | branch | MAIN | |
|---|---|---|---|---|
| D | D | D' | D' | gelijk |
| F | F | F' | F' | gelijk |
| G | G | G | G' | alleen op MAIN |
| E | E | E' | E(b) | conflict, opnieuw |

### Twee manieren om verder te gaan

**A. Bijwerken (standaard).** Na de merge haalt de branch MAIN **helemaal** op: E van MAIN
vervangt E', en G' komt erbij. Branch en MAIN zijn dan gelijk, en het nieuwe uitgangspunt is
één stand: MAIN op het volgnummer van de merge. Er hoeft niets per eenheid onthouden te
worden. E' gaat verloren; daar heeft de gebruiker voor gekozen.

**B. Mijn versie houden (bewuste keuze per eenheid).** De branch houdt E'. Een delta ziet dan
wel *dat* E en E' verschillen, maar niet *wat er besloten is*: nog niet bekeken, nu niet, of
nee. Die keuze moet de branch per eenheid bewaren, als een **uitgangspunt per eenheid**:

- uitgangspunt E = E' → **"nee" blijft staan** (zoals git): E' komt niet meer langs, tot iemand
  E op de branch opnieuw wijzigt;
- uitgangspunt E = E van MAIN → **"nu niet"**: E' staat de volgende keer weer klaar als gewone
  wijziging, zonder conflict.

**Besluit Mark 14-11:** in B onthoudt de branch het "nee". De delta komt bij een volgende
merge wel terug in de lijst, maar **uitgevinkt**, met het merk *eerder niet gemerged*. Zo blijft
een stil verschil tussen branch en MAIN zichtbaar, en kan de gebruiker het alsnog aanvinken.

Bewaren: bij de herkomst van de branch komt `mergeBasis`: het volgnummer van MAIN bij de
laatste merge, plus per eenheid een uitzondering `{sleutel: {keuze, vingerafdruk}}`. De
vingerafdruk is die van de branch-versie op het moment van de keuze. Verandert de eenheid
daarna nog, dan klopt hij niet meer en komt ze weer langs.

## 3. Samenhang: wat alleen samen mee kan

### 3.1 Op de netto stand, niet op de tijd

Je zou kunnen denken dat D' niet naar iets uit E' kan verwijzen, omdat D' eerder is gemaakt.
Dat klopt niet: D' is de **netto stand** van D in de branch, niet één wijziging. Bewerkt
iemand D na stap y nog eens, dan kan D' alsnog naar E' wijzen. De samenhang wordt dus bepaald
op de netto stand van de branch, los van de volgorde.

### 3.2 De eenheden

Fijnmazig, zodat "het veld dat E' toevoegt" een eigen eenheid is:

- elementen, velden (eigen uuid) en eigenschappen;
- verbindingen (connectoren);
- diagrammen en diagramknopen;
- mappen en plaatsing in de boom;
- kruisverbanden (koppelingen tussen talen).

### 3.3 De regels

| Situatie | Gevolg |
|---|---|
| U verwijst in de branch naar T, en T bestaat alleen in de branch | **U vereist T** |
| De branch haalt T weg; op MAIN verwijst iets naar T | dat moet mee weg, of het is een conflict |
| U komt onder een nieuwe ouder of in een nieuwe map | U vereist die ouder of map |
| Verbinding V verbindt U met W | V vereist U en W (als die nieuw zijn) |

Welke eigenschappen een verwijzing zijn, staat al in het typecontract (M3, `schema.js`): een
veld dat naar een element wijst, bron en doel van een verbinding, de ouder in de boom, de
container, de kruisverbanden. De graaf is daarmee **motorwerk, voor alle profielen tegelijk**.

Voorbeeld van Mark: F' is een BPMN-bericht dat als invoer een veld heeft dat pas in E' bestaat.
Dan vereist F' dat veld, en kan F' alleen mee als dat veld mee gaat. De graaf kan een paar
niveaus diep gaan.

### 3.4 Wat de UI doet

- **Doortrekken.** Vink je U aan, dan gaat alles wat U vereist mee (transitief). Vink je T uit,
  dan gaat wat T vereist ook uit, met de reden erbij.
- **Samen of niet.** Eenheden die elkaar wederzijds vereisen (een cyclus) vormen één blok dat
  je alleen in zijn geheel aan of uit vinkt.
- **Conflict plus samenhang.** Kies je bij E voor MAIN, dan staat F' grijs met "vereist veld x
  uit E', dat niet mee gaat". Omdat een veld een eigen eenheid is, kun je ook alleen dat veld
  uit E' meenemen.
- **Vangnet.** Vóór het schrijven naar MAIN bouwt de render-sidecar het samengevoegde model in
  het geheugen (zoals bij `/vergelijk`). Daarop draaien de bestaande controles, zoals
  verwijzingen naar niets. Een gat in de graaf wordt zo alsnog gevonden, als melding.

### 3.5 Verwijzingen in tekst: «gebruikt»-traces

Verwijzingen op id of uuid vindt de motor zelf. Maar sommige verwijzingen staan in tekst:

- een CEL-filter of -formule die een veldpad noemt;
- een DMN-invoer op veldpad;
- de inhoud van een BPMN-bericht of data-object op naam.

Voorstel (Mark 14-11): **formaliseer die als «gebruikt»-traces**. Elke keer dat zo'n formule
wijzigt, leidt het profiel (M2) uit de tekst af welke elementen en velden ze noemt, en werkt
het de traces bij. Een «gebruikt»-soort bestaat al bij de kruisverbanden. Daarna is een
formule gewoon een eenheid met verwijzingen, en hoeft de samenhanggraaf geen tekst te lezen.

Daarvoor heeft een profiel een kleine aanvulling nodig: "welke namen noemt deze eigenschap?",
naast de bestaande binding via uuid plus naamtoets. Zolang een profiel dat niet heeft, meldt
het vangnet (§3.4) gebroken namen als waarschuwing, niet als harde regel.

### 3.6 Raakvlak: M0 in simulaties

In de simulatie-sessie wordt besproken om M0-objecten op te nemen in simulaties. Die leunen
op M1-elementen via dezelfde wegen: de CEL-expressie, de berichtdefinitie, het
BPMN-data-object. Dezelfde «gebruikt»-traces geven daar aan van welke M1-elementen een
M0-set afhangt, en dus wanneer een opgeslagen simulatie na een merge niet meer past.

## 4. De merge zelf

1. **Verschil met MAIN** (bestaat) krijgt vinkjes per eenheid. Standaard aan: alles wat
   *nieuw*, *gewijzigd* of *weg* is in de branch. Conflicten kiezen: branch of MAIN.
2. De samenhang (§3) trekt vinkjes door en zet onmogelijke combinaties grijs.
3. **Proef:** de sidecar bouwt het samengevoegde model en meldt wat er breekt.
4. **Toepassen:** de Studio maakt van de gekozen eenheden patch-ops (zelfde vorm als de
   projectsync: `patchElementen`, `patchDiagrammen`, `patchStructuur`, `patchLinks`) en stuurt
   die naar MAIN met `verwachtLaatsteVolgnummer`. Is MAIN intussen verder, dan weigert de
   server (409) en begint de Studio opnieuw bij stap 1.
5. **Daarna** (§2): A bijwerken, of B het uitgangspunt per eenheid vastleggen.

## 5. Stappen

1. **Merge zonder keuze**: alles uit de branch mee, conflicten blokkeren. Daarna A
   (bijwerken). Dit bewijst de keten: ops naar MAIN, 409, nieuw uitgangspunt.
2. **Vinkjes per eenheid in een boom** (§6), met conflicten kiezen; daarna altijd A. Ook:
   buiten de map alleen-lezen in de branch.
3. **Samenhanggraaf** op id en uuid (§3.3), met doortrekken en grijs; vangnet in de sidecar.
4. **Mijn versie houden** (B) met `mergeBasis` en uitzonderingen per eenheid.
5. **«gebruikt»-traces** uit formules (§3.5), per profiel.

## 6. Besluiten Mark (14-11)

- **"Nee" blijft staan** (§2 B): de branch onthoudt het; de delta komt terug, maar uitgevinkt.
- **Kiezen in een boom, niet in een lijst.** De vinkjes volgen de nesting die er al is: map →
  diagram of element → veld, eigenschap of verbinding. Een vinkje op een ouder zet de kinderen
  aan of uit; een half gekozen ouder toont dat (driestandenvinkje). De boom is de projectboom
  van de branch, beperkt tot wat verschilt, zodat de gebruiker hem herkent. Samenhang (§3.4)
  werkt dwars door de boom: een vereiste in een andere tak wordt meegetrokken en daar
  zichtbaar gemarkeerd.
- **Buiten de map: alleen-lezen in de branch.** Een branch hoort alleen binnen zijn
  afgesplitste map te wijzigen. Dat wordt een regel bij het bewerken (de Studio weigert een
  wijziging buiten de map; de server weigert ops buiten de scope), niet iets wat pas bij het
  mergen opvalt. De waarschuwing *buiten de map* in het verschilscherm blijft voor branches
  van vóór die regel. Open punt bij het bouwen: een nieuwe relatie vanuit de map naar een
  element erbuiten. Die hoort bij de map (een relatie volgt haar bron, zoals `inScope` nu al
  doet), dus die mag.
- **Wie mag mergen:** eigenlijk een modelleur met rechten op die map. Zo fijn is de toegang
  (FTV/PBAC) nog niet; voorlopig is de granulariteit het project: wie mag schrijven op het
  MAIN-project, mag mergen. Later verfijnen met toegang op map-niveau.

## 7. Stand van de bouw

**Stap 1 — uitgebracht 14-11 (studio 0.41.0 / api 0.26.0 / render 0.4.5, live op app en Fundament).**

- Studio: knop *Samenvoegen naar MAIN* in *Verschil met MAIN…*: uit bij een conflict of als er
  nog eigen wijzigingen te verzenden zijn; bevestiging met de aantallen; wijzigingen buiten de map
  alleen na bevestiging.
- Kern: `web/vite/src/studio/takken/samenvoegen.js` (`voegSamen`, `opsVoorVerschil`).
- Sidecar: `POST /samenvoegen` (`samenvoegProjecten`), met vangnet: de ops worden op de echte stores
  nagespeeld en moeten precies de samengevoegde stand geven.
- API: `POST /api/studio/projecten/:id/samenvoegen`. Eén transactie: ops naar ouder en branch,
  controle op de laatste volgnummers, basis vervangen.
- Getest: unit (samenvoegen), render-svc, Go tegen Postgres, e2e met gemockte API. Nog niet getest:
  de hele keten met echte API, sidecar en twee open Studio's (na uitrol op een testproject doen).
- Uitbrengen vraagt api + render-svc + studio samen; een oudere sidecar geeft 502 ("te oud").

**Grenzen van stap 1:** volgorde-alleen-wijzigingen in de boom uit de branch gaan niet mee;
bundels en de soortenlijst gaan als geheel (per bundel, lijst in één keer).

**Stap 2a — uitgebracht 14-11 (studio 0.42.0 / api 0.27.0 / render 0.4.6).**

- Keuze per **eenheid**: element (ook relatie), diagram, map, koppeling. Een verplaatsing hoort bij
  haar element of diagram. Sleutel `<soort>:<profielId>:<id>` (`verschilSleutel` in
  `verschilMetMain.js`); bundels en de soortenlijst staan niet in de boom en gaan mee.
- Studio: de lijst per status is een **boom met vinkjes** (`studio/takken/keuzeBoom.js`): map →
  submap → diagram of element → relatie onder haar bron (of kind onder zijn boomouder). Een vinkje
  op een ouder zet alles eronder; half gekozen = driestandenvinkje. Koppelingen tussen talen en
  eenheden zonder map in eigen groepen; wat alleen op MAIN veranderde apart (komt altijd mee).
  Standaard aan, behalve een **conflict** (uit = MAIN houdt de zijne; aan = de versie van de branch)
  en wat **buiten de map** ligt.
- Kern: `voegSamen({…, keuze})` geeft `samengevoegd` (nieuwe MAIN en nieuwe basis) én `nieuwTak`:
  wat niet gekozen is, blijft in de branch en komt bij de volgende vergelijking terug (weer
  aangevinkt; het onthouden van "nee" is stap 4). Een conflict blokkeert met een keuze niet meer.
- **Vangnet samenhang** (tot de samenhanggraaf van stap 3 er is): `samenhangFouten` zoekt
  verwijzingen naar iets wat er niet is (relatie-`source`/`target`, `nodes[].elementId` op een
  diagram, kruisverband-kanten, plaatsing/map naar een ontbrekende map). Alleen wat de keuze **nieuw**
  stuk maakt telt, in MAIN of in de branch; dan weigert de API met `409 reden "samenhang"`.
- API: body `{ookBuitenMap?, keuze?}`; zonder `keuze` geldt stap 1. Sidecar: `keuze` op
  `/samenvoegen`; antwoord met `opgelost` en `samenhang`.
- Getest: unit (`samenvoegen.test.js`, `keuzeBoom.test.js`, `verschilMetMain.test.js`), render-svc,
  Go (`TestMetKeuze`), e2e 63 (boom, keuze in de POST, buiten de map, 409 samenhang).
- **Scenario's over meerdere rondes** (Mark 14-11: "standaard in de test"):
  `render-svc/samenvoegScenario.test.mjs`, in `npm test` van render-svc. Een nagebootste server
  (logs per project, basis vervangen zoals de Go-handler) speelt met de echte profielstores na:
  (1) Marks voorbeeld in twee rondes, (2) nieuw/weg/terugzetten incl. "geen kleur", (3) weg tegen
  gewijzigd, ook zonder keuze, (4) relatie zonder bron, in MAIN én in de branch, (5) nieuwe submap
  en verplaatsen, (6) koppeling zonder element, (7) alleen bijwerken, (8) drie rondes doorwerken.
  Na elke ronde: MAIN nagespeeld = de nieuwe basis, en het resterende verschil is precies wat niet
  gekozen werd.

- **Terugzetten naar MAIN** (Mark 14-11, bij het proberen: "per ongeluk een kleur gewijzigd"):
  per regel de knop ↶, keuze `"terug"`. De branch neemt de versie van MAIN letterlijk over, ook
  "geen kleur" (een kleur met dezelfde waarde terugzetten is níet gelijk: MAIN had geen veld
  `kleur`). Een element dat alleen in de branch bestaat gaat eruit, een in de branch verwijderd
  element komt terug; bij een conflict wint MAIN aan beide kanten. MAIN verandert niet. Ctrl+Z
  helpt hier niet: ongedaan maken werkt alleen op eigen, lokale stappen.

**Nog open in stap 2:** kiezen per **veld** binnen een element (vraagt een drieweg per veld, dus
ook conflicten per veld); 2b, buiten de map alleen-lezen in de branch.
