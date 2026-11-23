# Sidecar-project — weergaven en starten uit het project (voorstel)

Stand 21-11, OMNIUM-UI. Vervolg op BACKLOG PROF-1 en TRANSFORMATIES.md §9.5. Herschreven na het
gesprek met Mark op 21-11: alle vragen uit de eerste versie zijn beantwoord (§3, §4, §6). Gebouwd is
hiervan stap 1 (§7).

## 1. Waar we staan

| Stap | Stand |
|---|---|
| (a) ontwerptaal = M3 | gebouwd 20-11 (`studio/activities/ontwerptaal.js`) |
| (b) rondreis exact | gebouwd 20/21-11: meetlat 0, ook code (code op id, `diagramcore/types/codeRegister.js`) en volgorde |
| (c) sidecar-project | gebouwd 21-11: export, taal *Profiel (M3)* in Modelleren |
| (d) laden uit het project | eerste deel 21-11 (opt-in menu-actie); de tool start nog uit de code |
| weergaven in een project | stap 1 gebouwd 21-11: profiel *Weergave* 0.1.0 en het weergaveproject met alle vormen; stap 2 gebouwd 22-11: de iconen als SVG-tekst (187, met rondreistest) ook in het project; stap 3 gebouwd 22-11: de koppeling elementtype → vorm; stap 4 gebouwd 22-11: soort, versie en gebruikt in de projectkop (STUDIO.md "Het weergaveproject"); de rest is dit voorstel |
| (e) projectbrowser in Profielen en Transformaties | open |

Bewezen: alle 27 profielen uit het sidecar-project laden geeft dezelfde tool (zelfde vingerafdruk,
zelfde objecten; `render-svc/sidecarLaden.test.mjs`).

## 2. Vier soorten project (besluit Mark 21-11)

| Project | Inhoud | Hangt af van | Ontbreekt het? |
|---|---|---|---|
| **M1** | de modellen: het gewone project | M2 + transformaties, weergaven | — (er is altijd een M1-project) |
| **weergaven** | de bibliotheek (vormen, iconen, renderers op id) en de koppeling: welk elementtype van welk profiel hoe getekend wordt | M2 (de koppeling noemt elementtype-id's) | de code tekent |
| **M2 + transformaties** | de profielen en de regelsets (het huidige sidecar-project) | M3 | de profielen uit de code |
| **M3** | het ene metametamodel; in feite een view op de code | — | de code |

Dit is ook de volgorde van afhankelijkheid: elk project leunt op het project eronder. De onderste
drie mogen elk ontbreken; dan valt de tool terug op de code.

**Inhoud en vorm gescheiden.** Een M2 zegt alleen *wat* er is (een entiteit met deze velden en deze
verbindingsregels). Het weergaveproject zegt *hoe* het eruitziet, als eigen laag van het
tool-model bovenop de modelinhoud. Wat een descriptor nu aan vorm meedraagt (`shape`, `icoon`,
`kleur`, de shape-sets en `typeWeergave`), verhuist naar de koppeling in de weergaven; in het M2
blijft het staan als standaardwaarde, zodat er niets breekt. Gevolg: dezelfde profielen zijn met
een andere huisstijl te leveren (een klant met eigen iconen, zonder eigen M2).

**Het M1-project noemt wat het gebruikt.** De projectkop krijgt naam en versie van het M2-project
en van het weergaveproject. Bij het openen vergelijkt de tool dat met wat er geladen is; bij een
verschil een **waarschuwing**, geen fout. Zo is ook later te zien op welke profielen een model is
gemaakt.

**Beheerd, en weinig.** M2- en weergaveprojecten worden beheerd (§6); er moeten er niet
veel van komen. Elk draagt zijn herkomst (afgeleid van welk project, welke versie); samen is dat een
**stamboom**, centraal bij te houden. Een variant is een branch of een afgeleide met een
aanwijsbare ouder.

## 3. De weergaven als profiel (vraag 1 beantwoord: element, geen bijlage)

Vormen en iconen worden **elementen** in een eigen, voor de modelleur niet bewerkbaar M2
*Weergave*. Daarmee reizen ze mee met sync, historie, branches en samenvoegen per veld zonder
eigen spoor (kruisverbanden en marks staan wel in het project, maar elk met een eigen sectie,
store, sync-operatie en samenvoeg-code; dat willen we hier niet nog eens).

Drie soorten ding, dezelfde splitsing als bij de hooks:

| Soort | In het project | In de code |
|---|---|---|
| **icoon** | de SVG-tekst (`{id, svg, monochroom}`, zoals een data-icoon) | reserve |
| **vorm** (ShapeType) | `{id, renderer, parameters, minMaat}` | reserve |
| **renderer** | alleen de verwijzing op id (bv. `tekenaar:bol`) | de code zelf, zoals code op id |

Een renderer is code omdat hij van het element afhangt: de graaf-bol (`bol` in
`diagramcore/tekenaar/bibliotheek.js`) zet de velden van het element als satellieten om de kern,
en de BPMN-event, sequence-levenslijn en ArchiMate-box zijn ook renderers. `data-vorm` is de
renderer die zelf gegevens leest; daarmee komen nieuwe vormen erbij zonder code. Een renderer-id
die de tool niet kent, geeft dezelfde duidelijke fout als een onbekende hook.

- **Groepering blijft**: een map per profiel of set, met diagrammen waarop de iconen en vormen als
  tegels staan.
- **SVG-editor**: een eigen widget voor het gegevenstype *svg* (zoals `m3-json` nu): de inhoud is
  het gegevenstype, de editor is de vorm.
- **Kleur**: iconen volgen `currentColor`; de ArchiMate-plaatshouder `$vlak` (paneelkleur) wordt een
  afspraak van het data-icoon.
- **Veiligheid**: SVG uit een project wordt geschoond (geen `<script>`, geen `on…`-attributen).

## 4. Reserve in de code (vraag 2 beantwoord: drie niveaus, het derde)

Mark 21-11: een standaard-elementicoon en een standaard-lijnweergave in de code zijn sowieso nodig
(kip en ei: het profiel Weergave moet zelf ook getekend kunnen worden). Drie mogelijke niveaus:

1. één standaardicoon en één standaardlijn;
2. uitgebreider voor de standaard-elementtypen;
3. **volledig voor alles** — gekozen, het meest robuust: een kapot of ontbrekend
   weergaveproject geeft nooit een onleesbare tool.

Prijs: elke weergave staat twee keer (code en project) en kan uit elkaar lopen. Een rondreistest
zoals de meetlat van de profielen bewaakt dat: het project geeft dezelfde tekening als de reserve,
tenzij het bewust afwijkt.

**Gemeten** over de 27 profielen: **73 vormen** en **179 iconen** in gebruik. De ingebouwde iconen
zijn nu met de hand geschreven SVG in JSX (`diagramprofielen/*/iconen.jsx`, `typeIconen.jsx`);
ArchiMate staat al als gegevens (`archimate/glyphs.js`). Omzetten naar SVG-tekst is mechanisch
(`renderToStaticMarkup` in render-svc).

## 5. Per element en per relatie (Mark 21-11)

Nu: per element alleen de **kleur** (`data.kleur`); per relatie de lijnvorm (`data.vorm`:
bezier/recht/haaks) en de boomstijl, en dat is route, geen opmaak. Lijndikte, lettertype en
tekstkleur zijn per element niet in te stellen; dat blijft zo.

- **Optie**: per element een andere vorm kiezen uit het weergaveproject (klein, omdat vormen dan
  op id in het project staan).
- **Later overwegen**: afbeeldingen zoals in EA, op een instantie of los op een diagram (opstap: de
  gedeelde plaatjes in MinIO).

## 6. Waar de projecten wonen, wie ze wijzigt, versies (besluiten Mark 21-11)

**Centraal, op één server.** Het M3-project, de M2-projecten en de weergaveprojecten staan op
**één** centrale plek, voor alle instanties: app, Fundament en pf (als die is bijgewerkt) leunen op
dezelfde stamboom van M3, M2 en weergaven. Ze zijn verweven met wat de applicatie kan (de code
achter hooks en renderers), dus **een release en deze projecten gaan samen**: een release noemt de
versies van de centrale projecten waar hij bij hoort, en een nieuwe versie van een project vraagt
soms een release.

- Een instantie haalt de projecten bij het opstarten centraal op. Is de centrale plek niet
  bereikbaar, dan start ze met de laatst opgehaalde versie, en anders met de reserve uit de code
  (§4, niveau 3).
- **Bij een klant** kan het lokaal worden ingesteld, maar liever niet.

**Klantversies: transformeren, niet vermenigvuldigen** (Mark: *practice what you preach*, EYODF).
Een klantversie is een **uitbreiding** (+: een profiel, een elementtype, een eigen icoon erbij) of
een **uitdunning** (−: een eenvoudiger toolset) van een centrale versie. We bewaren niet een kopie
per klant, maar **de aanpassing per klant, los en met historie**, en genereren daaruit de
klantversie. Komt er een nieuwe centrale versie, dan levert opnieuw genereren de nieuwe klantversie,
met de aanpassing erop. Ook de aanpassingen zijn beheerd en staan in de stamboom.

Open: de vorm van zo'n aanpassing. Voor de hand ligt een regelset in het profiel Transformatie
(centraal project in, klantproject uit), of een delta zoals de branch-vergelijking die al levert.

**Wie wijzigt.** De modelleur leest alleen (besluit 16-10). De **beheerder** beheert de centrale
projecten en brengt versies uit. Transformaties en nieuwe profielen maakt ook een rol daaronder:
de **ontwerper**, ook voor weergaven. De ontwerper werkt in een branch van een centraal project (een
conceptversie); de beheerder voegt samen en brengt uit. **Concepten moeten uit te proberen zijn**
(Mark 21-11): een ontwerper laadt een concept in zijn eigen Studio (zoals *Laad de profielen uit
dit project in de tool* nu al kan), zonder dat andere gebruikers het zien.

**Versiebeheer is verplicht.** Elk M3-, M2- en weergaveproject, en elke klantaanpassing, heeft een
versie. Een wijziging zonder hogere versie wordt geweigerd, met een duidelijke melding (dezelfde
bewaking als `profielVersies` in render-svc). Het M1-project noemt de versies die het gebruikt (§2).
Een **nieuw profiel begint bij 0.1.0** (Mark 21-11); ook het profiel *Weergave*.

## 7. Volgorde

1. Profiel *Weergave* met de drie soorten en de SVG-widget; vormen in het project. **Gebouwd 21-11.**
2. Iconen naar SVG-tekst, met de volledige reserve in de code en een rondreistest. **Gebouwd 22-11**
   (`ingebouwdeIconen.js`, `render-svc: npm run iconen`; het icoon van een relatie uit zijn
   `edgePresentatie` blijft code, als renderer).
3. De koppeling elementtype → vorm uit het M2 naar de weergaven (M2-waarden blijven standaard).
   **Gebouwd 22-11**: elementtype *koppeling* in Weergave 0.2.0, een per profiel en per shape-set,
   tabel-editor, toepassen op het profiel; rondreis exact. Daarbij: het weergave- en sidecar-project
   openen als eigen project, nooit in een gewoon project (Mark 22-11).
4. Naam en versie van M2- en weergaveproject in de M1-projectkop, met de waarschuwing. **Gebouwd
   22-11** (`studio/projectGebruik.js`): `soort`, `versie` (keuze A: alleen omhoog bij uitbrengen,
   daartussen concept) en `gebruikt` in de kop; waarschuwing bij het openen; Projectinformatie.
5. De centrale plek: de projecten op één server, versies verplicht, een release noemt zijn versies.
   **Uitgewerkt in §8, besluiten Mark 22-11; gebouwd 23-11** (nog niet uitgebracht).
6. Starten uit de centrale projecten (met de laatst opgehaalde versie en de code als reserve).
   **Lokaal deel gebouwd 22-11** (`studio/startUitProject.js`): na *Laad … in de tool* kun je kiezen
   ermee te starten; de Studio bewaart het project in IndexedDB en zet het bij het starten in de
   tool (eerst de profielen, dan de weergaven), met de code als reserve. Dit wordt de "laatst
   opgehaalde versie" zodra stap 5 er is.
7. De rol ontwerper: concepten in een branch, de beheerder brengt uit.
8. Klantaanpassingen (+ en −) los bewaren en de klantversie genereren.
9. De projectbrowser in Profielen en Transformaties (stap e). **Eerste deel gebouwd 22-11**:
   Profiel als container in de M3-taal (1.1.0), diagrammen als views, JSON afgeleid (§9). Tweede
   deel gebouwd 22-11: de activiteiten als gefilterde bomen op één project. Derde deel gebouwd
   23-11: groepsmappen voor de profielen, transformaties in In/Tussen/Uit als container.
10. Versie- en releasebeheer van de M2+T-projecten: een graaf van versies, liefst lineair, met
    forks en terugmergen (§10).

## 8. Stap 5 uitgewerkt: de centrale plek (voorstel 22-11, open vragen)

Nachtwerk 22-11; niets hiervan is gebouwd. De stappen 1–4 en het lokale deel van 6 maken dit
klein: een project weet zijn soort en versie, een model noemt wat het gebruikt, en de Studio kan
starten uit een bewaard project.

**Voorstel.**

1. **Eén instantie is de centrale.** Daar staan de profielen- en weergaveprojecten als gewone
   serverprojecten (soort in de kop), beheerd zoals nu: branches voor concepten (de ontwerper),
   samenvoegen naar MAIN (de beheerder).
2. **Uitbrengen** (de beheerder): `POST /projecten/{id}/uitbrengen {versie}` legt de huidige MAIN
   vast als onveranderlijke versie (een kopie van de snapshot met `versie`, niet meer te wijzigen).
   De server weigert een versie die niet hoger is dan de vorige (versiebeheer verplicht). In de
   Studio: *Project → Breng versie uit…*, alleen voor profielen- en weergaveprojecten en alleen
   voor de beheerder; het nummer kiest hij (patch, minor, major), zoals bij de profielversies.
3. **Ophalen** (elke instantie): `GET /centraal/{soort}` geeft de lijst van uitgebrachte versies,
   `GET /centraal/{soort}/{versie}` het werkbestand. De Studio haalt bij het starten de versie op
   die bij zijn release hoort, bewaart die lokaal (dat is het lokale deel van stap 6) en start
   ermee; lukt ophalen niet, dan de laatst opgehaalde, en anders de code.
4. **Een release noemt zijn versies**: een klein bestand bij de Studio-build, bv.
   `centraal.json` = `{ "profielen": "0.3.0", "weergaven": "0.2.0" }`. De releasemelding aan
   FUNDAMENT/BACKEND noemt ze ook.
5. **Concept uitproberen** blijft zoals nu: een ontwerper laadt zijn branch in zijn eigen Studio
   (*Laad … uit dit project in de tool*); de kop noteert "+ concept".

**Open vragen voor Mark.**

1. **Welke instantie is de centrale?** Voor de hand ligt app (daar draait het meeste al); een eigen
   kleine instantie kan ook.
2. **Toegang voor de andere instanties** (Fundament, pf): publiek leesbaar (de profielen en
   weergaven zijn geen geheim, de repo is ook publiek), of een leestoken per instantie?
3. **Vastpinnen of volgen:** noemt een release exact de versies (`0.3.0`), of "de laatste
   uitgebrachte binnen 0.3" (dan komt een patch zonder nieuwe release binnen)? Voorstel: exact
   vastpinnen; een nieuwe projectversie = een (kleine) release. Past bij "release en projecten
   gaan samen".
4. **Klant met een eigen centrale** (lokaal ingesteld, "liever niet"): alleen een andere URL in de
   configuratie, of ook een eigen beheerder? Voorstel: alleen de URL, tot de klantaanpassingen
   (stap 8) er zijn.

**Besluiten Mark 22-11.**

1. De centrale is **app**.
2. Andere instanties lezen met een **leestoken** per instantie (niet publiek).
3. Een release **pint exact** de versies vast.
4. (Mark vroeg: wat denk jij?) Voorstel Claude: een klant-centrale is een **spiegel**, geen eigen
   bron. Ze krijgt de uitgebrachte versies van app (ophalen met haar leestoken, of als bestand voor
   een afgeschermde omgeving) en bedient de eigen instanties met dezelfde endpoints; in de
   configuratie alleen een andere URL. Niemand wijzigt daar de centrale projecten; wat de klant
   anders wil, is een klantaanpassing (stap 8), met een eigen beheerder alleen voor die aanpassing.
   **Bevestigd door Mark 22-11**, met een aanvulling: de klant-centrale kan **interne voorstellen**
   doen (een wijziging die de klant centraal wil), en die **beoordelen we centraal**. Een
   aangenomen voorstel komt in een centrale versie; daarmee krimpt de klantdelta (stap 8).

**Gebouwd 23-11 (nog niet uitgebracht).** Zoals voorgesteld, met deze invulling:
- `POST /api/studio/projecten/:id/uitbrengen` (beheerder) en `GET /api/studio/centraal[/:soort/:versie]`
  (`handlers/studio_centraal.go`, tabel `studio_project_uitgaven`). Een versie is onveranderlijk
  en noemt vanaf de eerste haar ouders.
- Het leestoken is een persoonlijk API-token van een lezer-account op app, één per instantie.
- Een instantie met `CENTRAAL_URL` + `CENTRAAL_TOKEN` is een spiegel: haar API haalt een versie bij
  de centrale en bewaart haar; de Studio praat alleen met zijn eigen API.
- Vastpinnen in `web/vite/src/studio/centraalVersies.js` (geen JSON, zodat de Node-tests en
  render-svc het ook lezen).
- Open: interne voorstellen van een klant-centrale (§8 punt 4), en versoepeling van "hoger dan
  alle vorige" voor onderhoudslijnen (stap 10). Zie STUDIO.md.

## 9. Stap 9: één project voor profielen en transformaties (Mark 22-11)

Nu zijn er drie ingangen: de profiel-ontwerper (JSON), Profiel (M3) (de profielen als diagrammen)
en Transformaties. Mark: in plaats daarvan **één project "profielen en transformaties"** (het
sidecar-project). Functioneel zijn het andere dingen, dus de activiteiten mogen gescheiden blijven,
maar ze kijken in hetzelfde project:

- **Profielen** filtert de M2-mappen, met hun diagram(men) en elementen;
- **Transformaties** filtert de t's, ook in mappen met diagram(men) en elementen.

Elk dus een eigen, gefilterde boom op één project.

**JSON is een eigenschap van de map, geen eigen editor** (Mark 22-11). Een profiel bewerk je via
het model; de JSON (de descriptor) zie je bij de map met de betekenis M2, afgeleid uit de elementen
in die map, en blijft daarnaast export/import. De aparte profiel-ontwerper (JSON) vervalt als
ingang.

**De map is het profiel, het diagram een view** (Mark 22-11). Nu draagt het *diagram* het profiel
(`m3Profiel`, `shapeSets`, `typeWeergave` op het diagram; `kernenUitProject` bouwt één profiel per
diagram). Mark: een profiel kan ingewikkeld zijn en meerdere views vragen; het model is één. Dus in
het profielenproject is een map een **container met de betekenis M2 (taalprofiel)**: het profiel =
alle elementen in die map, de diagrammen erin zijn views. De kopgegevens (id, label, versie, code-id's)
gaan van het diagram naar de map. Het sidecar-project maakt al een map per profiel met precies één
diagram, dus de overgang is mechanisch.

**Besluiten Mark 22-11.**

1. **Het M3 definieert *Profiel* als container**, met de vorm map (of een andere vorm), zoals het
   *domein* in het canonieke model. Het profiel is dus een element in de M3-taal, met zijn
   kopgegevens als eigenschappen (en dus met historie); de elementen erin vormen het profiel. Geen
   kenmerk op een gewone map.
2. **De JSON is alleen-lezen**: afgeleid, te kopiëren en te exporteren, niet te bewerken (er
   zitten te veel constraints op). Een descriptor binnenhalen blijft een import die elementen
   maakt.

**Gebouwd 22-11.** Deel 1: *Profiel* (`profielDef`) als container in de M3-taal 1.1.0, de
diagrammen als views, de JSON als afgeleide eigenschap (`profielContainer.js`). Deel 2: de
activiteiten *Profielen* en *Transformaties* zijn de Modelleren-host met een gefilterde boom
(`projectZicht.jsx`, `boomZicht.js`); de JSON-editor, het kladblok *Profiel-ontwerp* en de lezer
(nu *Regelsets proefdraaien*) staan standaard niet meer in de balk. Zie STUDIO.md.

**Derde deel (23-11, Mark): ordening.** De profielen in groepsmappen (UML met Statisch en
Dynamisch, Gegevensmodellering, ArchiMate, Schema's, Business, UI, Linked data, Plumbing; door
Claude erbij: SysML, Overig), de transformaties in de mappen In, Tussen en Uit, met elke
transformatie als container (uitwerking) met haar eigen bron, doel en diagram. De eerste
uitgebrachte versie wordt **1.0.0** (voorstel Claude 23-11): de profielen draaien al in productie;
het projectnummer staat los van de versies van de profielen erin. Zie STUDIO.md en
TRANSFORMATIES.md §9.9.

## 10. Stappen 7, 8 en 10 toegelicht (22-11)

- **7. De rol ontwerper.** Een rol tussen modelleur en beheerder: mag een branch maken van een
  centraal project en daarin werken (een concept), niet samenvoegen naar MAIN en niet uitbrengen.
  Voorstel: een rol erbij in het bestaande rollenstelsel; bouwbaar na stap 5.
- **8. Klantaanpassingen. Besluit Mark 22-11:** een klantaanpassing is **de delta** van de
  klant-branch op het basisprofiel, op de vastgepinde versie daarvan. We bewaren **alleen de
  delta** (met de basisversie waarop hij is gemaakt), geen kopie van de klantversie; die wordt
  gegenereerd (basis + delta). Evolueert de basis, dan pas je de delta toe op de nieuwe basis
  (mergen op een andere base) en zie je per wijziging:
  - **past**: de delta gaat er schoon op;
  - **botst**: de basis wijzigde hetzelfde anders (clash, de beheerder kiest, zoals bij
    samenvoegen per veld);
  - **al opgenomen**: de basis bevat de wijziging nu zelf, die valt uit de delta; de delta wordt
    kleiner, of **nul** (de klant kan dan gewoon de centrale versie gebruiken).
  De delta is dus zelf een beheerd stuk met versie en historie (§6). Een regelset in het profiel
  Transformatie kan later, voor aanpassingen die je als regel wilt uitdrukken.
- **10. Versie- en releasebeheer van de M2+T-projecten (Mark 22-11).** Geen stamboom maar een
  **graaf** van uitgebrachte versies. Liefst compact en lineair (één lijn 0.1.0 → 0.2.0 → …),
  maar er kunnen **forks** ontstaan (een tak die apart verder gaat, bv. voor een klant of een
  experiment), die eventueel weer **terugmergen** naar één lijn. Elke uitgebrachte versie noemt
  dus haar ouder(s): één bij een gewone opvolger, twee bij een merge. De graaf toont per versie
  het nummer, de ouders en welke releases (§8: exact vastgepind) en klantdelta's (stap 8) erop
  steunen.

  **Nummering (voorstel Claude 22-11, na vraag Mark: komt een nummer maar één keer voor?).** Een
  versienummer is uniek per project. Met stap 8 heeft een klant geen fork nodig: zijn aanpassing
  is een delta, geen eigen lijn. Een fork in de centrale graaf is dan alleen nog een
  **onderhoudslijn**: de hoofdlijn gaat naar 0.5.0, terwijl op 0.4 nog een reparatie nodig is →
  0.4.1. Elke lijn houdt zo een eigen reeks (0.4.x tegenover 0.5 en verder), dus elk nummer komt
  één keer voor en zegt meteen waar het hoort. Experimenten blijven concepten in een branch en
  worden niet uitgebracht. Terugmergen: de reparatie gaat ook mee in de volgende versie van de
  hoofdlijn (twee ouders).
