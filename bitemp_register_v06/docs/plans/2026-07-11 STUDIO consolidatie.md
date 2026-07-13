# UX sessie voor STUDIO
## doel
Ik zou de Studio wat netter en gestructureerder willen maken.
Stel je voor dat je een pro UX designer bent. Je kijkt naar Studio en wat valt je op? Waar kan het beter?

## historie
Even wat input over historie en doelen

Studio is ontstaan vanuit de UML editor, die ontstaan is om het model achter een register te editen. DIt model is gebaseerd op mijn metamodel met ENT, GE, REL, enz. EIgenlijk een UML profiel: UML + wat extra's. Het stelt een **canoniek model** voor dat centraal staat in de omgeving.

Daarna heb ik de driehoek Gegevens - Proces - Regels willen duidelijk maken en heb de BPMN en DMN activiteiten toegevoegd, waar process-meets-canoniek-model en regels-meet-canoniek-model plaatsvindt. Die pagina's zijn nog niet helemaal uitgekristalliseerd.

Het visualiseren van API's (openAPI spec voornamelijk) was nog een doel en dat is ook gebouwd.

Daartoe heb ik het model onder elk type model geabstraheerd en is de Profiel Editor ontstaan. Dat is eigenlijk een configuratie-pagina, bedoeld voor de expert.

Dan is er nog een onontgonnen data-view op i.i.g. referentielijsten. En rollen en autorisatie (FTV). De laatste twee zijn optioneel, maar zijn in de gemeentelijke dienstverlening, waarvanuit dit idee ontstaan is, wel belangrijk.

## te veel activiteiten
Maar nu zijn er veel te veel activiteiten om nog overzichtelijk te zijn. Dat moet gebundeld worden. En/of activiteiten moeten via een instellingen menu aan/uit kunnen worden gezet in de linkerbalk, terwijl ze via het menu altijd te vinden zijn.

Ik zie een paar groepen activiteiten:
1. modelleren: verschillende modeltypen: profiel based, en extern ingevlogen, zoals BPMN en DMN (al kunnen we die denk ik beter zelf maken, maar voorlopig bestaan beide).
2. views op software: de API viewer en import activity. Berichten (nog niet gebouwd)
3. views op data: referentielijsten, personen en rollen
4. Kruisverbanden: de links tussen het gegevensmodel en een proces, de traceability tussen het canoniek model en een API (nog niet gemaakt), berichten en canoniek model, enz. Dit zou grafisch (cross model-type relaties op een diagram) en met een matrix te visualiseren moeten zijn.
5. views op configuratie: toegangsbeheer (N.B. dit gaat over het onderhanden softwarelandschap, niet over de tool)
6. tool-instellingen: Profiel editor, shape mapper, svg-editor. Todo: toegangsbeheer van de tool zelf: rollen en rechten.

6 is een mooi aantal. Met eventueel daarbovenop te kiezen een paar custom shortcuts naar je favoriete activity. Dan is de balk niet te vol.

Er zijn een paar algemene aspecten:
- importeren (modellen: UML, XMI, MIM, openapi.json/yaml, svg, andere files)
- exporteren (idem + configuratie instellingen, layed out diagrammen enz.)

Het registerprofiel heeft nog de speciale functie van publish en rebuild. Dat is eigenlijk softwaregeneratie.
De API editor heeft ook een openapi export.
-> dit is ook een aspect dat niet altijd, maar mogelijk overal aanwezig is.
(autorisatie: een hi-level policy omzetten naar een low level als XAMCL (of hoe gaat die afkorting))

## uitbreiding doelen
Ik krijg positieve reacties op de look van de diagrammen, en ik sprak collega's van een aanpalende overheidsorganisatie die op zoek zijn naar een overzichtelijke, aantrekkelijke modelleertool.
Hun doelen:
- bereikbaar voor collega's
- geen hoge leercurve (sparx EA, bizzdesign, archi hebben dat wel)
- geen installatiegedoe (SaaS)
- importeermogelijkheid (want nu modellen in EA, niet alles hoeft over)
- configureerbare complexiteit (dat is echt een UX ding: alleen tonen wat voor jou van belang is. Persoonlijke workspace in kunnen stellen, of gebruikersprofielen kunnen maken.)
- betaalbaar
- uiteraard snel

Zelf denk ik dat goede visuele export (kunnen plakken in Word, een website editor, svg voor markdown files) belangrijk is.
Verder uitbreidbare ondersteuning voor modellen en views op organisatie-specifieke componenten. Dat is een soort plugin-architectuur. (Architectuur, geen UX, maar heeft een UX aspect.)

## project concept
Nu is het modelleren nog te veel gefragmenteerd. Net als veel IDE's is er echter te wens tot 1 projectbrede project browser.
Dus niet alleen een model- of diagrambrowser, maar een treeview waar een vrije indeling in mappen mogelijk is, waar overal de verschillende profiel/diagramtypen en elementen kunnen landen.
Dat vereist duidelijk visueel onderscheid tussen de profielen.

## vormgeving en plan
Hoe zou je dit vormgeven?

Met tabs achter de activiteiten? Meer schermonderdelen?
Binnen modelleren kan alles wel binnen de treeview, maar de andere activiteiten doen dat wellicht anders. (Zoals nu in VScode de linkerbalk steeds een heel ander universum opent.)

Wil je een plan maken?

---

# UX-review & consolidatieplan (Claude-sessie, 2026-07-11)

## 1. UX-review: wat valt op

Bekeken: de activity bar / het Ga naar-menu (16 geregistreerde activiteiten),
`StudioShell.jsx`, `ActivityBar.jsx`, `activities/index.jsx`, `useStudioStore.js`
en `docs/STUDIO.md`.

### 1.1 De interne architectuur lekt naar de gebruiker (grootste punt)

Labels als **"Diagrammen (0.5)"**, **"UML (0.5)"**, **"Profiel-ontwerp (0.5)"**
zijn bouwfase-namen, geen gebruikersconcepten. Een gebruiker ziet nu *twee*
UML's, *twee* DMN's en een "Diagrammen" waarvan onduidelijk is hoe die zich tot
"UML-model" verhoudt. Versienummers van de motor horen in de docs en de
changelog, niet in de navigatie. Hetzelfde geldt voor "(concept)" als deel van
het label: status is metadata (badge), geen naam.

### 1.2 Categoriefout: profieltypen zijn geen activiteiten

De balk mengt drie abstractieniveaus door elkaar:

- **Perspectieven** (wat VS Code "activity" noemt): modelleren, data bekijken,
  toegang beheren.
- **Profieltypen**: UML, OAS 3.1, MIM, DMN, BPMN, het canoniek model. Dit zijn
  *modelleerprofielen* — metamodellen, elk een hermetisch stelsel dat de
  werkelijkheid op een eigen manier beschouwt en weergeeft. Je werkt erin via
  **diagrammen**: de visuele weergave van een stukje model. Dat elk profieltype
  eigen editors/elementtypen heeft is een implementatiedetail; welk diagram je
  opent hoort te bepalen welke editor verschijnt, niet welke "activiteit" je
  eerst hebt gekozen.
- **Gereedschap/instellingen**: profiel-editor, profiel-ontwerp, vormen/iconen.

Doordat elk profieltype een eigen activiteit is, is het beeld van de gebruiker
gefragmenteerd (precies het "project concept"-gemis hierboven): je kunt niet
één samenhangend project zien met daarin een canoniek model, twee API's, een
proces en een beslistabel — terwijl die samen één omgeving beschrijven.

### 1.3 Te veel items, en het menu lost het niet op

16 items in één verticale balk is voorbij de scanbaarheidsgrens (7±2; VS Code
levert er standaard 6). Het **Ga naar**-menu is dezelfde platte lijst, dus het
biedt geen alternatieve vindbaarheid — het verdubbelt alleen de aanbieding.
Er is geen zoek-/springfunctie (command palette), terwijl "geen hoge
leercurve" juist daarom vraagt.

### 1.4 Placeholders bezetten premium ruimte en ondermijnen vertrouwen

Vier concept-activiteiten (API's, Toegangverlening, Rollen, Referentielijsten)
staan als volwaardige iconen in de balk, met alleen een puntje als signaal.
Klikken geeft een lege pagina: een valse affordance. Eén keer is grappig, bij
de derde keer daalt het vertrouwen in *alle* knoppen. Beloftes horen in een
roadmap of achter een gedempte menu-ingang, niet in de primaire navigatie.

### 1.5 Inconsistenties tussen activiteiten

- **Layout-universum**: de UML-IDE (`fullMain`) verbergt topbar en panelen en
  heeft eigen docking; andere activiteiten hebben het 3-slot-patroon. De
  wissel voelt als een andere applicatie.
- **Thema**: 0.5-canvassen volgen het studio-thema, dmn-js/bpmn-js blijven wit
  papier. (Bekend en deels onvermijdelijk, maar het draagt bij aan het
  "losse pagina's"-gevoel.)
- **Menutaal**: activiteit-menu's heten Tabel / Proces / Bericht / Bewerken —
  per activiteit anders gekozen. De *plek* van aspecten wisselt ook:
  import/export/publiceren zit soms onder Bestand, soms onder het
  activiteit-menu.
- **Iconenstijl**: de 0.5-emblemen (gevuld accent) naast pure outline-iconen —
  bewust als familie-kenmerk, maar zodra 0.5 dé motor is, is dat onderscheid
  betekenisloos voor de gebruiker.

### 1.6 Wat al goed is (behouden)

- Het activiteit-contract + registry is precies de goede architectuur om deze
  consolidatie *goedkoop* te maken — de shell hoeft nauwelijks te wijzigen.
- Auto-hide-panelen, per-activiteit paneelstand, menubalk-ankervolgorde:
  degelijk en VS Code-vertrouwd.
- De diagram-look zelf (kaarten, iconenvocabulaire, thema-canvas) oogst
  terecht complimenten — dit plan gaat over de *schil*, niet over de canvas.

## 2. Voorgestelde informatiearchitectuur

Zes vaste ingangen (de groepen uit §"te veel activiteiten"), plus instellingen
onderaan — zoals VS Code het tandwiel onderaan zet:

| # | Activiteit (balk) | Inhoud sidebar | Main |
|---|-------------------|----------------|------|
| 1 | **Modelleren** | Projectbrowser: vrije boom met modellen, diagrammen en elementen van álle profieltypen (canoniek, UML, OAS, MIM, DMN, BPMN, berichten) | Diagram-tabs; het profieltype van het diagram bepaalt de editor |
| 2 | **Koppelingen** | Lijst van kruisverbanden/matrices | Traceability-matrix · cross-profiel-diagram |
| 3 | **Software** | API's, berichtdefinities, imports | Viewer/editor per item |
| 4 | **Data** | Referentielijsten, personen, rollen | Data-grids |
| 5 | **Toegang** | Policies (FTV/PBAC) van het landschap | Policy-editor |
| 6 | **Instellingen** (onderaan, ⚙) | Profielen (editor + ontwerp), vormen/iconen, zichtbaarheid activiteiten, Labs, straks tool-rollen | Instellingen-pagina's |

Kernbesluiten daarbij:

- **Profieltype-registry** naast het activiteit-register: profiel-id →
  { editor, icoon, kleur, label, diagramtypen }. "Modelleren" wordt één
  activiteit die diagrammen opent; de bestaande activiteit-descriptors (DMN,
  BPMN, 0.5-profielen) worden profieltype-descriptors. Het visuele
  onderscheid tussen profieltypen (icoon + kleuraccent, al aanwezig in
  `iconenVocabulaire`) draagt de herkenbaarheid in boom én tabs.
- **De boom is van de gebruiker** (Sparx-model, niet Archi): vrije mappen,
  jij bepaalt wat hoofdniveau is en wat eronder hangt; modellen, diagrammen
  en elementen van verschillende profieltypen mogen door elkaar staan. De
  tool dringt zijn interne organisatie niet op — profieltype is zichtbaar
  als icoon/kleur, niet als verplichte mappenstructuur. (Wie toch per
  profieltype wil groeperen, doet dat gewoon zelf met mappen.)
  Besloten 2026-07-11 (o.b.v. vier voorbeelden uit de eigen Sparx-repo's):
  het **volle Sparx-model** — ook elementen zijn boomknopen, met waar
  relevant hun kinderen (constraints, attributen). Kernonderscheid daarbij is
  **eigendom vs. voorkomen**: een element *woont* op precies één plek in de
  boom, maar kan op meerdere diagrammen *voorkomen* (de 0.5-elementenbrowser
  met zijn ＋-knop doet dit al). De voorbeelden tonen ook wat mappen alléén
  al moeten dragen, zonder aparte tool-features: versies als mappen
  (v1.0.0, LGM 2025/HR 2025), profielwerelden als zusters (MIM/UML/GraphQL/
  OWL/BPMN/DMN), zandbak- en backup-mappen. Consequentie: honderden knopen
  per project — gevirtualiseerde boom en zoeken zijn randvoorwaarden, en
  stereotype/profieltype hoort zichtbaar in het label («Objecttype» Taak).
- **Tabs = open diagrammen in Main**, níet tabs achter een activiteit in de
  navigatie. De activity bar wisselt het universum (sidebar + main-vulling);
  open diagrammen blijven bestaan als je wisselt. Sub-views binnen één
  diagram/model (DRD ↔ Tabel) blijven tabs *binnen* de editor.
- **Documenten bestaan alleen aan de rand**: import (XMI, MIM, openapi-
  yaml/json, svg, …) en export (idem + uitgelijnde diagrammen als beeld).
  In de kern van de tool bestaan alleen modellen en diagrammen; "bestand"
  is geen navigatie- of opslagconcept in de UI.
- **Configureerbare complexiteit**: in Instellingen per gebruiker activiteiten
  en profieltypen aan/uit (localStorage nu, gebruikersprofielen later), plus
  optioneel 1–3 vastgepinde favorieten boven in de balk. Alles blijft altijd
  bereikbaar via menu en palette — de balk toont alleen wat jij gebruikt.
- **Labs-schakelaar**: experimentele activiteiten (meta-editors, nieuwe
  profielen in aanbouw) verschijnen alleen met Labs aan, zonder versienummers
  in het label maar met een "preview"-badge.
- **Vaste aspect-conventie** in de menubalk: **Bestand → Importeren ▸ /
  Exporteren ▸** bestaat overal (gevuld per profieltype); **Publiceren**
  (schema-versie, rebuild, OAS-export als generatie) alleen als menu waar het
  van toepassing is, maar altijd onder die ene naam.
- **Kruisverbanden als eigen diagramtype**: trace-links tussen werelden
  (profieltypen) zijn links die de profieltype-registry overstijgen. Beperkt
  tot twee profieltypen laat zo'n verband zich als **matrix** weergeven;
  grafisch is het een cross-profiel-diagram (elementen van meerdere
  profieltypen op één canvas).
- **Command palette** (Ctrl+K): activiteiten, diagrammen/elementen en
  menu-acties doorzoekbaar. Klein om te bouwen (de menu-itemstructuur bestaat
  al als data in `buildMenus`), groot effect op leercurve en op de zorg "is
  alles nog vindbaar als de balk kleiner wordt".

## 3. Gefaseerd plan

Elke fase is los shipbaar; fase 0–1 raken geen editor-code.

### Fase 0 — Opruimen (dagen, quick wins) — ✅ gebouwd 2026-07-11
Branch `feat/studio-consolidatie-fase0`; zie ook de bijgewerkte
activiteiten-tabel in `docs/STUDIO.md`.

1. ✅ Labels ontdoen van "(0.5)"/"(concept)"; status is een badge
   ("preview"/"concept") in topbar en Ga naar; op een balk-icoon een open
   ringetje (preview). Nieuwe namen: "Diagrammen (0.5)" → **Canoniek
   model**, "Profiel (0.5)" → **Profiel-editor**, "DMN-tabellen" →
   **DMN-beslissingen** (er zit immers ook een DRD-tab in).
2. ✅ Beheer-groep (Profiel-editor, Profiel-ontwerp, Studio-instellingen)
   onderaan de balk via een flex-spacer (VS Code-tandwielpatroon). De
   profiel-editors verhuisden daarbij van "modelleren" naar "beheer" —
   het zijn gereedschappen, vooruitlopend op de Instellingen-ingang (§2).
3. ✅ Concept-placeholders uit de balk (`status: "concept"` wordt
   gefilterd); in Ga naar gedempt + concept-badge, wél aanklikbaar.
4. ✅ Eén DMN-ingang in de balk: de 0.5-DRD kreeg `verborgenInBalk: true`
   (nieuw descriptor-veld) en heet "DMN DRD" in Ga naar. Echte
   samenvoeging (0.5-DRD als tab in de DMN-activiteit) is fase 2-werk —
   de twee draaien op verschillende motoren.
5. ✅ Groepskoppen in Ga naar (Modelleren · Diensten · Data · Beheer,
   `{type:"kop"}` in het menu-itemmodel) en groepsnaam in de
   balk-tooltips.

### Fase 1 — Zichtbaarheid & palette (week) — ✅ gebouwd 2026-07-11
1. ✅ Instellingen-paneel "Activiteiten" (in Studio-instellingen, bovenaan):
   per activiteit aan/uit + Labs-toggle (uit → previews niet in de balk),
   persist in `useStudioStore` (localStorage). Concepten en
   `verborgenInBalk`-activiteiten zijn er zichtbaar maar niet instelbaar
   ("alleen via Ga naar").
2. ✅ Favorieten: ★ pint een activiteit bovenin de balk (pinvolgorde,
   amber scheidingslijn); favorieten winnen van Labs-uit en verschijnen
   niet dubbel in hun groep.
3. ✅ Opdrachtenpalet (Ctrl+K, en Ga naar → Opdrachtenpalet…): zoekt over
   alle activiteiten (ook wat niet in de balk staat) plus de
   menubalk-acties van de actieve activiteit, inclusief submenu's;
   dezelfde onClick's als de menubalk (`CommandPalette.jsx`).

### Fase 2 — Profieltype-registry & diagram-tabs (weken) — grotendeels ✅ 2026-07-11
1. ✅ Profieltype-registry (`studio/profieltypeRegistry.js`): id, label,
   icoon, **kleur**, store, descriptor, slots en menu's per profiel.
   `maakDiagramActiviteit` registreert automatisch (alleen groep
   "modelleren" — gereedschap zoals de profiel-ontwerper hoort er niet in);
   dynamische meta-editor-profielen doen dus vanzelf mee.
2. ✅ Nieuwe activiteit **"Modelleren"** (bovenaan de balk, preview):
   sidebar = projectbrowser v0 (per profieltype zijn diagrammen, ＋ voor
   nieuw), Main = **tab-host** (open diagrammen als tabs met profiel-icoon
   en accentkleur; persist in localStorage; een elders verwijderd diagram
   sluit zijn eigen tab), inspector én menubalk volgen het profiel van de
   actieve tab. Zelfde stores en componenten als de losse
   profiel-activiteiten — de inhoud is identiek, hoe je hem ook opent.
3. ✅ (2026-07-12) **Klassieke editors in de tab-host**: dmn-js (DRD+tabel),
   BPMN, Berichtdefinities én de klassieke UML-IDE (FlexLayout) staan als
   profieltypen in de Modelleren-browser via
   `activiteitAlsProfieltype.jsx` — een shim die een klassieke activiteit
   een minimale store-façade met **vaste documenten** geeft (geen ＋,
   niet in de project-export; hun inhoud leeft in eigen stores/backends).
   Documenten openen als tab, menubalk en inspector volgen mee, en de
   eigen sidebar van de activiteit (bv. DmnTreeBrowser + ModelPicker)
   verschijnt in het ondervak van de projectbrowser. Ook deze documenten
   zijn in mappen te plaatsen. De klassieke IDE heet in de boom **"Canoniek
   model IDE (v1)"** (sessiebesluit 2026-07-12: zij implementeert het
   canonieke metamodel, niet puur UML, en is de publiceer-/genereer-plek);
   zij is gemarkeerd met `eigenSchil` — de host klapt zijn zijpanelen dan
   **automatisch in** (en herstelt ze bij een gewone tab; handmatig
   heropenen kan altijd via de topbar-knoppen/rails). Rest: de losse
   activiteiten uit de balk nemen zodra "Modelleren" de standaard is (kan
   per gebruiker al via de fase 1-instellingen), de klassieke IDE achter
   Labs zodra 0.5 pariteit heeft, en de **genereer-functionaliteit**
   (publiceren/rebuild vanuit de IDE, OAS-export, …) als profiel-
   overstijgend aspect een expliciete plek geven in de nieuwe structuur
   (zie ook "algemene aspecten" bovenin dit plan).

   **Opgeruimde balk (2026-07-13):** alle losse editors die de
   Modelleren-host dekt (UML-model/IDE v1, Canoniek model, UML, OAS, MIM,
   DMN, BPMN, Berichtdefinities) hebben `standaardVerborgen: true` — ze
   staan default niet meer in de activity bar, maar zijn per gebruiker weer
   aan te zetten via Studio-instellingen → Activiteiten (tri-state:
   gebruikerskeuze wint van de default) en blijven altijd in Ga naar/palet.
   De balk toont zo standaard: Modelleren, Koppelingen, eigen
   meta-editor-profielen, en de beheer-groep. Verder: **rechtsklik op een
   map → "Nieuw diagram ▸"** met typekeuze over álle profieltypen (ook de
   klassieke editors); het nieuwe diagram landt meteen in die map.

   **Meerdere documenten per klassieke editor (2026-07-13):** BPMN en DMN
   hebben `documentenBeheer` — ＋ in de sectie (en LegeStaat) maakt een
   nieuw document, rechtsklik → Verwijderen… gooit er een weg, en elk
   document heeft zijn **eigen inhoud** (BPMN-XML resp. DRD-XML+beslistabel),
   per document bewaard in localStorage en gewisseld bij tab-/documentwissel
   via een *documentkoppeling* ({haal, zet}) die de Provider van de
   activiteit registreert (`activiteitAlsProfieltype`:
   `registreerDocumentKoppeling`). De elementen van zo'n document leven in
   de eigen editor (bpmn.io/dmn-js), níet in de projectboom — bewust; de
   IDE v1 en Berichtdefinities blijven één vast document (de IDE heeft zijn
   eigen elementen-tree en bewerkt hét model). Vervolg-idee (sessie
   2026-07-13): het metamodel zo uitbreiden dat BPMN gewoon op de eigen
   motor getekend kan worden; en de BPMN/DMN-documentinhoud meenemen in het
   project-werkbestand.

### Fase 3 — Projectbrowser (weken) — v0 gebouwd 2026-07-12
> **Vooraf (2026-07-12): visuele identiteit is nu data.** Kleur en embleem
> per profieltype zijn bewerkbaar in **Studio-instellingen → Profieltypen**
> (kleurkiezer + embleem-tekst + herstel), als gebruikers-override
> (localStorage, `profieltypeRegistry`: `zetStijlOverride`/`effectieveStijl`)
> bovenop de code-defaults (`kleur:` in het descriptor-bestand, icoon in
> `icons.jsx`). Overrides werken direct door in projectbrowser en tabs
> (`ProfielIcoon.jsx`).

1. 🔶 v1 gebouwd: vrije mappen (Sparx-model) in de Modelleren-browser —
   maken (＋ én "＋ Nieuwe map"-knop), **hernoemen** (✎-knop of dubbelklik),
   verwijderen (inhoud valt terug naar de ouder), vrij nesten, en **mappen
   zelf verslepen** (naar een andere map, of op de "Mappen"-kop terug naar
   de wortel; cyclus-drops worden geweigerd). Diagrammen slepen naar mappen
   en terug naar "Niet ingedeeld"; geplaatste regels tonen hun
   profiel-/elementtype-icoon. Nog niet: zoeken over de boom,
   virtualisatie, volgorde binnen een map.
2. 🔶 Elementen (2026-07-12): onder de mappenboom staat de **elementen-boom
   van het profiel van de actieve tab** (bestaande 0.5-ElementenBrowser,
   per profieltype geregistreerd, wisselt met de tab). Elementen zijn
   daaruit **naar mappen te slepen** (eigendom-plek in de boom, met
   elementtype-icoon); klik op zo'n element heropent zonodig een tab van
   zijn profiel (liefst een diagram waar het op staat) en **selecteert het
   in de inspector** (menuBus `<profiel>:selecteer-element`). Terugslepen
   naar "Niet ingedeeld" haalt de plaatsing weg.
   **Hiërarchie volgt mee (sessiebesluit 2026-07-12):** een geplaatst
   element toont zijn hiërarchie-kinderen (GE's onder hun ENT, compositie)
   automatisch als geneste boomregels — zelfde regels als de
   ElementenBrowser (`descriptor.hierarchie` incl. `omgekeerd`, de
   `hierarchieParen`-hook én `standaardDichtInBoom` als chevron-beginstand).
   Een kind apart naar een map slepen plaatst zijn **top-voorouder** (een GE
   kan niet onder zijn ENT vandaan).
   **Eigendom-pool (2026-07-14):** de ElementenBrowser toont voortaan alleen
   de **nog niet ingedeelde** elementen — geplaatste elementen én hun
   hiërarchie-nazaten verdwijnen eruit (via de nieuwe `verbergIds`-prop,
   berekend door de Modelleren-host uit de plaatsing). Ook **connectoren
   (associatie/ASOC) in de groepen** zijn nu ctrl-klik-multiselecteerbaar en
   slepen als bundel mee — zodat een associatie met haar klassen in één zet
   in een map landt. Vervolg: volledige eigendom-vs-
   voorkomen (alle elementen ín de boom), "toon op diagram…"-navigatie, en
   **GE verhangen naar een andere ENT** als bewuste model-operatie achter
   een waarschuwing (raakt alle diagrammen — die moeten worden nagelopen).
3. 🔶 Projectstructuur persistent in localStorage (`studio-modelleren`:
   mappen incl. kleur + plaatsing + open-stand). **Project-werkbestand
   (2026-07-12):** menu **Project → Exporteer/Importeer project…** in
   Modelleren — één JSON (formaat "studio-project" v1) met de structuur
   (mappen + plaatsingen + tabs) én de volledige inhoud van alle
   niet-lege profiel-sandboxes (elements/diagrams incl. viewports/meta).
   Import vervangt na bevestiging; onbekende profielen worden gemeld en
   overgeslagen; tabs worden gefilterd op bestaande diagrammen; de
   undo-histories worden gewist. Hiermee is een project deelbaar en niet
   aan localStorage gebonden — en dit is de vorm die straks naar de API
   kan (API-persistentie is het resterende deel van deze stap).
4. 🔶 De per-profiel-secties staan als "Niet ingedeeld" onder de mappenboom
   en tonen alleen nog niet-geplaatste diagrammen.
5. Bediening (2026-07-12): **inline hernoemen** van mappen én elementen
   (dubbelklik of contextmenu → invoerveld; Enter/blur = opslaan, Esc =
   annuleren), **rechtsklik-contextmenu** op mappen (hernoemen/nieuwe
   submap/eigenschappen/verwijderen), diagram-regels (openen/eigenschappen/
   uit de map halen) en element-regels (selecteer/hernoemen/verwijderen
   uit model), en **map-eigenschappen in de inspector** (naam + kleur).
6. **Klikmodel (sessiebesluit 2026-07-12, Sparx-conventie):** klik op een
   boomregel = **eigenschappen** in de inspector (map, diagram én element);
   **dubbelklik** op een diagram = openen (tab). Klik op een element
   focust het bovendien op een **open** diagram waar het op staat (wisselt
   hooguit tussen open tabs — er wordt niets heropend; staat het nergens
   open, dan alleen eigenschappen of niets bij een inactief profiel).
   Elementen kennen géén "uit de map halen" (waar zou hij heen moeten?) —
   wel **verwijderen uit het model**, achter een bevestiging met
   Ctrl+Z-vangnet; ook terugslepen naar "Niet ingedeeld" is voor elementen
   geblokkeerd. Connectoren (associatie, ASOC) zijn nu ook naar de boom te
   slepen. Toekomstwens: rechtsklik → **"zoek op diagram(men)"**.
7. Boom-bediening ronde 2 (2026-07-12):
   - **Auto-scroll tijdens slepen**: tegen de boven-/onderrand van de boom
     duwen "met iets in de hand" scrollt mee (hoger gelegen mappen waren
     anders onbereikbaar als sleepdoel).
   - **Contextmenu → "Verplaats naar ▸"** (drill-down-submenu met alle
     mappen, ingesprongen op diepte) op diagrammen, elementen én mappen
     zelf (met "(wortel)"/"(Niet ingedeeld)" waar van toepassing en
     cyclus-uitsluiting). Dit dekt ook het geval waar slepen onhandig is;
     knippen/plakken (Ctrl+X/V) blijft een optie voor later.
   - **Handmatige mapvolgorde**: contextmenu Omhoog/Omlaag per niveau
     (volgorde-veld; nieuw of verplaatst = achteraan). Later eventueel
     slepen-tussen-twee-mappen met invoegindicator.
   - **Ctrl-klik multiselect** op diagram-/element-regels: samen slepen
     naar een map én samen "Verplaats naar". Shift-bereik nog niet.
   - **Canvas-rechtsklik → "Zoek in projectboom"**: klapt de map-keten
     open, scrollt ernaartoe en laat de regel oplichten (via de
     top-voorouder; menuBus "studio:zoek-in-boom"). Element zonder
     map-plek: no-op (vervolg: elementen-boom laten oplichten).
   - **Structuur-undo (Ctrl+Z/Ctrl+Y in de boom)**: eigen undo/redo-stapel
     voor mappen + plaatsingen (verslepen, hernoemen, kleur, volgorde,
     aanmaken/verwijderen, plaatsen), los van de model-undo per profiel —
     de boom vangt de focus bij elke muisklik, en stopPropagation houdt de
     canvas-undo erbuiten.
   - **Ctrl-klik multiselect óók in de elementen-onderboom** (0.5-browser):
     gemarkeerde elementen slepen als bundel naar een map (elementIds in
     het sleep-pakketje; top-voorouder per element).
8. Denkpunten focus-doorlevering (sessie 2026-07-12), mogelijk
   **configureerbaar** maken zoals tools het verschillend doen:
   (a) boom → diagram (EA: dubbelklik; enkelklik werkt alleen in de boom),
   (b) diagram → boom (Archi: vanzelf; EA: expliciet "find in tree"),
   (c) element → inspector (vanzelf, overal — zo werkt het nu).
   Idee daarbij: klik op een lége canvas toont de **diagram-eigenschappen**
   (klik op een element de element-eigenschappen).
   De boom-scrollpositie blijft staan bij tabwissel/hermontage
   (navigatie-anker; gebouwd 2026-07-12).

**Concept-besluit: een diagram is geen map (2026-07-12).** Een diagram
*toont* elementen alleen; het maakt het diagram niet uit waar ze in de boom
staan, en elementen staan typisch op meerdere diagrammen. Een diagram kan
dus nooit hiërarchie-onderdeel zijn: in de projectboom is het een gewoon
**blad-element**, visueel exact gelijkwaardig aan element-regels (zelfde
chevron-kolom, nooit kinderen). Elementen wonen onder een package (profiel-
hiërarchie) of onder een map.

**Mappen én diagrammen als "superprofiel"-elementen (sessie 2026-07-12):**
mappen en diagrammen zijn structuur-elementen die boven de profielen staan —
conceptueel een *superprofiel* met het map- en diagram-elementtype, de
map∋map-relatie en hun properties. Beide hebben **eigenschappen in de
inspector**: mappen naam + kleur; diagrammen naam (bewerkbaar), type
(readonly: profiel + diagramType-id) en inhoud (aantal elementen op het
diagram) — via rechtsklik → Eigenschappen; er kan altijd meer bij. Besluit
voorlopig: **hardcoded structuurelementen, maar data-vormig** (map:
{id, naam, kleur, ouderId}; diagram: het bestaande diagram-record in de
profiel-store), zodat een later superprofiel-descriptor ze kan overnemen
zonder migratie. Het superprofiel zelf bouwen wordt actueel zodra fase 4
(kruisverbanden) toch profiel-overstijgende elementtypen afdwingt. Verwant open punt: de
**package-dualiteit** (een UML-/canoniek-package is element én map, zoals in
EA) — voorlopig behandelen we een package als element bínnen zijn profiel;
hoe map en package zich verhouden is een denkpunt voor de gebruiker.
Nog gewenst (fase 3-vervolg): **multi-select** in beide bomen.

### Genereren als aspect (sessie 2026-07-13)

Genereren hoort niet bij één activiteit maar is een **optioneel,
configureerbaar aspect van een profieltype × map**: de map is (als in EA) de
logische eenheid waar elementen leven die samen een model vormen — de basis
van een generatie. Drie richtingen van hetzelfde aspect:

1. **import** — van buiten naar model (OAS/XMI/MIM-import bestaat al);
2. **transformeren** — van model naar model (bv. canoniek → MIM, bestaat als
   "Zet canoniek model om naar MIM"; kruisverbanden kunnen de herkomst
   vastleggen);
3. **export/genereren** — van model naar buiten (OAS-export, V3-publicatie).

De **register-build** is een speciaal geval van (3) met een *externe*
generator: beschouw de generator als extern, maar de **aanroep als intern
aspect**, die onder water de bestaande publiceer/rebuild-API aanroept.

**Raamwerk gebouwd (2026-07-13):** `transformatieRegistry.js`
(`registreerTransformatie({id, label, richting, profielTypes, run})`) + het
generieke scherm `TransformatiePaneel.jsx` (modal). Opbouw: **actie**
(Importeren · Transformeren · Exporteren — in die volgorde) → **bron** →
**doel**; bij een map-doel is er extra een veld *"nieuwe (sub)map in de
gekozen map"* (leeg = de gekozen map zelf), ook voor import. Bereikbaar via
**rechtsklik op een map → Transformeren ▸ (Importeren/Transformeren/
Exporteren)** — dan opent het scherm direct in die vorm zonder actie-keuze —
en via **menu Project → Transformeren…** (met actie-keuze). De aangewezen
map vult de relevante kant (import = doel, anders = bron). `transformaties.js` levert map-helpers (`mapInhoud`,
`collectMapModel` — de map als model-eenheid) plus drie ingebouwde,
generieke generatoren: **export** (map → JSON-bestand), **import**
(JSON-map-export → in deze map) en **transform** (kopieer map-inhoud →
nieuwe/bestaande map, met verse id's). Specifieke generatoren (OAS-export,
MIM-transformatie, register-build) sluiten hierop aan met een
`registreerTransformatie`-aanroep — nog te doen; ook: API als bron/doel
(nu alleen bestand) en element-selectie (nu "alle in de map").

### Metamodel-verkenning: gedragsdiagrammen (sequence, activity, state machine, BPMN) — sessie 2026-07-13

Wat komt het diagramcore-metamodel tekort om deze als gewone profielen te
tekenen?

1. **Geordende voorkomens langs een as** — sequence: lifelines zijn kolommen
   en de verticale volgorde van messages ís semantiek. Nodig: een
   as-/volgorde-begrip per diagramtype (positie → orde), plus
   layout-constraints ("lifeline blijft verticaal", "message horizontaal").
2. **Semantische containers/lanes** — pools/lanes (BPMN), fragments
   (alt/loop), composite states, activity-partities. `containerVoor` en het
   kader bestaan, maar zonder lane-layout en zonder betekenis (lidmaatschap
   → attribuut, bv. "uitgevoerd door").
3. **Rand-aanhechting** — BPMN boundary-events en state entry/exit-points
   zijn elementen die óp de rand van een ander element wonen. Het metamodel
   mist "aanhechtpunten"/poorten op elementen.
4. **Connector→connector en sub-shapes** — messages die aan activation-bars
   hangen (sub-shape op een lifeline), en pijlen naar een pijl. ASOC-anker
   is een begin, maar activations zijn geordende sub-voorkomens.
5. **Validatieregels per diagramtype** — één startevent, geen zwevende
   states, enz. De validatie-hook staat al op de todo; gedragsprofielen
   maken hem noodzakelijk.
6. Wat er al ís: element-op-meerdere-diagrammen, verbindingsregels 1..*,
   markers/lijnvormen, hiërarchie, edgePresentatie — structuurdiagrammen
   dekken we; het gat is vooral (1)–(4).

Kandidaat-volgorde: state machine (kleinste gat: containers + validatie) →
activity (lanes + geordende flow) → BPMN (boundary events + pools) →
sequence (grootste gat: as-semantiek + activations).

### Fase 4 — Kruisverbanden (nieuw, na 2–3) — v0 gebouwd 2026-07-13
1. 🔶 v0: nieuwe activiteit **"Koppelingen"** (naast Modelleren) — kies een
   bron- en doelprofieltype en vink kruisverbanden aan in een **matrix**
   (zoekvelden per as; klassieke editors doen nog niet mee — hun elementen
   leven buiten de profiel-stores). Links persisteren in localStorage
   (`studio-kruisverbanden`) en reizen mee in het **project-werkbestand**;
   de inspector toont alle links (over alle profielparen) met verwijderen.
   **Soorten tracering (2026-07-13):** nieuwe links krijgen een gekozen
   soort — *komt voort uit*, *heeft te maken met*, *genereert*,
   *realiseert* — met een **relatiesymbool met hoekje** (orthogonale
   elleboog rij→kolom) per cel; UML-achtige koppen (holle driehoek /
   open pijl / gevulde pijl / geen). **Rechtsklik op een cel**: soort
   wijzigen, richting omdraaien, verwijderen. **Richting** rij↔kolom
   (kolom bovenliggend; genereert default kolom→rij), met de kop aan de
   *naar*-zijde en een omgekeerde vorm. Een **legenda met beide richtingen**
   staat in Studio-instellingen → Kruisverband-symbolen (nu vast, later
   bewerkbaar).
   **Grafische variant gebouwd (2026-07-14):** naast de matrix heeft
   Koppelingen nu een **Grafisch**-tab (toggle) — een vrij React
   Flow-canvas (`koppelingenGrafisch.jsx`) dat elementen uit
   *verschillende* profielen als gekleurde knopen toont (profiel-icoon +
   naam) en de trace-relaties als gerichte lijnen (soort als label). Géén
   "Maken"-taakbalk; wél een soort-keuze bovenaan en een **element-picker
   (＋ knoop)**. **Verbinden = link leggen**: sleep van de bron- naar de
   doelstip → er ontstaat een link met de gekozen soort (van→naar =
   getekende richting). Rechtsklik op een lijn → soort/richting/verwijderen;
   Delete wist. Knoop-posities, losse knopen en de weergavekeuze bewaart de
   kruis-store (localStorage). Zo is het **concept-gat** gevuld: hetzelfde
   concept in twee werelden — UML `Taak` naast MIM `«Objecttype» Taak` —
   staat nu als vastgelegde, zichtbare relatie i.p.v. handmatige duplicatie.
   Vervolg: het trace-symbool (met hoekje) óp de lijn i.p.v. tekstlabel,
   "traceer naar…" vanuit de projectboom, en het superprofiel als formele
   drager.

### Fase 5 — Werkruimteprofielen (SaaS-voorbereiding)
1. Benoemde gebruikersprofielen (bv. kijker / analist / expert) als bundel
   van zichtbaarheids- en paneelinstellingen; exporteer-/importeerbaar.
2. Grondslag voor tool-rollen en rechten (Instellingen §6 hierboven).

## 4. Antwoord op de vormgevingsvragen

- **"Tabs achter de activiteiten?"** — Nee op navigatieniveau, ja in Main:
  tabs zijn *open diagrammen* (fase 2), niet een tweede navigatielaag. Twee
  lagen tabs in de chrome (activiteit-tabs + diagram-tabs) is het patroon
  waar gebruikers in verdwalen.
- **"Meer schermonderdelen?"** — Nee, het 3-slot-patroon (+ menubalk) is
  genoeg. Eventueel later een onderpaneel (validatie/output), maar pas als er
  een concrete bewoner voor is. De winst zit in *minder* soorten schermen,
  niet meer.
- **"Andere activiteiten anders dan de treeview?"** — Klopt, en dat mag: de
  activity bar wisselt het universum (VS Code-model). Data-views krijgen een
  lijst/grid-sidebar, Koppelingen een matrix-lijst. De consistentie zit in de
  vaste plekken (sidebar links, inspector rechts, aspecten in de menubalk),
  niet in identieke inhoud.

## addendum
### losliggende eindjes en ideeen
#### modeller
1. tabs kunnen verschuiven
2. bpmn.io elementen properties ook tonen (is wellicht alleen tijdelijk, maar kan ook een algemene feature zijn voor een custom, extern gecodeerd, profieltype editor)
3. zie STUDIO ideas", o.a. meerdere handles en copy to clipboard (svg?)
