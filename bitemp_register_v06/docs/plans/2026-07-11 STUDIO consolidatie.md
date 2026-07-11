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
3. ⬜ `fullMain`-uitzondering van de UML-IDE verkleinen of de klassieke IDE
   achter Labs zetten zodra 0.5 pariteit heeft. Ook nog open: dmn-js/bpmn-
   berichten als profieltypen in de host (andere motor), en de losse
   0.5-profiel-activiteiten uit de balk nemen zodra "Modelleren" volwassen
   is (via de fase 1-zichtbaarheidsinstellingen kan dat nu al per gebruiker).

### Fase 3 — Projectbrowser (weken)
1. Eén boom met vrije mappen (Sparx-model: de indeling is van de gebruiker)
   over alle profieltypen heen — mappen, diagrammen én elementen door
   elkaar, elementen met hun kinderen (constraints, attributen);
   drag-and-drop, hernoemen, zoeken. Gevirtualiseerd (react-arborist is er
   al) — de eigen Sparx-repo's tonen honderden knopen per project.
2. Eigendom vs. voorkomen: element woont éénmaal in de boom, verschijnt op
   n diagrammen; vanuit de boom toevoegen aan het actieve diagram (＋,
   bestaand 0.5-gedrag) en "toon op diagram…"-navigatie andersom.
3. Projectstructuur persistent (eerst localStorage/werkbestand, dan API).
4. De losse per-profiel-sidebars worden secties/filters binnen die boom.

### Fase 4 — Kruisverbanden (nieuw, na 2–3)
1. Trace-links tussen profieltypen als eigen diagramtype; bij twee
   profieltypen weergegeven als **matrix** (model × proces, model × API,
   bericht × model). Concreet gat dat dit vult (zichtbaar in de eigen
   Sparx-repo's): hetzelfde concept in twee werelden — UML `Taak` naast
   MIM `«Objecttype» Taak` — staat nu als handmatige duplicatie in mappen,
   zonder vastgelegde relatie.
2. Cross-profiel-diagram: elementen uit meerdere profieltypen op één canvas —
   de profieltype-registry uit fase 2 is hiervoor de voorwaarde.

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
