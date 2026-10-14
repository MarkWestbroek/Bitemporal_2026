# Bugs en wensen melden vanuit Omnium (voorstel)

*2026-10-14. Aanleiding: Mark wil dat gebruikers (ook genodigden) vanuit de tool een bug, wens of
vraag kunnen indienen, met een schermafbeelding, zonder afhankelijk te zijn van GitHub. Status:
plan akkoord (Mark, 14-10, besluiten in §2 en §3); model getekend met de eigen renderer.
BACKLOG: HELP-3 (hoge prioriteit).*

## 1. Uitgangspunt: dogfooding

Een melding is een **gewone bitemporele entiteit** in het register (domein `meldingen`). Dan
krijgen we zonder eigen code: de gegenereerde API en GraphQL, formulieren, lijsten, de
geschiedenis (wie wijzigde de status wanneer), notificaties (NotificatieDefinitie → mail naar de
beheerder) en toegangsbeleid (Toegangsspraak/PEP: de melder ziet alleen de eigen meldingen).
Wat we wél bouwen is de **ingang in de Studio**: het formulier onder Help en het kader trekken.

**Waarom niet git?** Het git-protocol kent geen issues: git bewaart commits, bomen en tags.
Issues, pull requests en reviews zijn een functie van de **forge** (GitHub, GitLab, Gitea,
Forgejo), elk met een eigen API. Er bestaan git-native varianten die issues als git-objecten
opslaan (`git-bug`, `git-appraise`), maar die vragen een git-client bij de melder en passen niet
bij een melding met schermafbeelding uit een webtool. Een register-entiteit wel, en het is
precies wat Omnium moet kunnen. Eventueel later: een export of koppeling naar een forge.

## 2. Model

![Meldingenmodel](meldingen-model.png)

Bron: [`meldingen — v3-model.json`](meldingen%20—%20v3-model.json); tekening met `diagramsvg`
(dezelfde tekenaar als `/api/render/svg`), [`meldingen-model.svg`](meldingen-model.svg).

**Kardinaliteit in een bitemporeel model (Mark, 14-10).** Een gegevenselement is over de tijd
bijna altijd `0..*` (of `1..*`): de voorkomens van de klasse zijn alle voorkomens in de tijd.
Of er op één moment één of meer zijn, zegt de constraint `{enkelvoudig}` of `{meervoudig}`
(momentvoorkomen). Een gewoon UML-klassediagram zet de tijd stil; dit model niet. De renderer en
de Studio tekenen de GE-lijn daarom nu als `0..*` met de constraint eronder
(`umleditor/metamodel/v3ModelNaarEditor.js`, `diagramsvg/randen.js`). Voor relaties geldt
hetzelfde; dat volgt nog (canoniek-uml leidt het momentvoorkomen van een relatie nu af uit de
bron-kardinaliteit, die twee moeten eerst los).

| Element | Momentvoorkomen | Materieel | Waarom |
|---|---|---|---|
| **Melding** (hub) | — | nee | De melding zelf. Wie en wanneer: de registratie (formele tijd), dus geen velden daarvoor. |
| MeldingInhoud | enkelvoudig | nee | soort (bug/wens/vraag), titel, beschrijving. Een correctie is formeel. |
| MeldingContext | enkelvoudig | nee | Door de Studio ingevuld: versie, activiteit/profiel, de plek in de interface, project-id, browser. Helpt reproduceren. Voorstel (nog te bevestigen): plus `onderwerpsoort` (element/diagram/map/project), `onderwerpnaam` en `onderwerpverwijzing` (taal/id in het project) bij een melding via rechtsklik; tekst, geen relatie, zolang Studio-projecten niet in het register staan. |
| MeldingBijlage | meervoudig | nee | Schermafbeelding of ander bestand; datatype `Bestand` (UUID in de filestore). |
| MeldingStatus | enkelvoudig | **ja** | nieuw → in behandeling → opgelost / afgewezen / dubbel, met toelichting aan de melder. Materieel: "opgelost per release". |
| MeldingPrioriteit | enkelvoudig | nee | Door de beheerder. |
| MeldingReactie | meervoudig | nee | Gesprek tussen melder en beheerder. |
| MeldingMelder → Gebruiker | enkelvoudig | nee | Zodat het beleid erop kan filteren ("eigen meldingen"). |
| MeldingBehandelaar → Gebruiker | enkelvoudig | ja | Wie hem oppakt. |
| MeldingDubbelVan → Melding | enkelvoudig | nee | Bij status dubbel. |

**Besloten (Mark, 14-10):**

1. **Eigen domein `meldingen`**; `beheer` blijft alleen voor beheerders.
2. **Relatie naar Gebruiker**, over de domeingrens heen: relaties tussen alles in het model
   mogen, en Gebruiker is zelf ook gedogfood. Het beleid toetst "melder = ik" op de relatie;
   de melder hoeft het Gebruiker-record zelf niet te kunnen lezen.
3. **Prioriteit, behandelaar, status en reacties zijn zichtbaar voor de melder.**

## 3. Ingang in de Studio

- **Help → Melden…** opent een klein formulier: soort, titel, beschrijving, bijlagen. Een eigen
  schermafbeelding kan altijd: **plakken** (Ctrl+V), **slepen** of **bestand kiezen**; meerdere
  bijlagen mogen. De context vult de Studio zelf in en toont hem inklapbaar ("dit gaat mee").
- **Alt-klik waar dan ook** (of Help → Melden met schermafbeelding): het scherm dimt, je trekt een
  kader; de Studio maakt een afbeelding van dat gebied en opent het formulier met de afbeelding als
  bijlage en de plek onder de klik als context. Esc breekt af.
  - Techniek: `html-to-image` (zit al in de Studio, `diagramcore/export/exporteerCanvas.js`) op
  `document.body`, daarna bijsnijden tot het kader. Geen browser-permissie nodig (in tegenstelling
  tot `getDisplayMedia`). Canvas, SVG en tekst komen mee; iframes van andere origins niet.
  - **Proef 14-10:** een kader om de projectboom (320×420) kwam in ±0,5 s mee, vrijwel gelijk
  aan een echte schermafbeelding: ook de boom en de eigenschappen, niet alleen het canvas.
  Verschillen: een scrollbalk wordt als grijs blok getekend, en een transparante achtergrond
  wordt wit (oplossen met `backgroundColor` = de achtergrond van de Studio). Valt het ergens
  tegen, dan is `getDisplayMedia` (de browser vraagt toestemming) de pixel-echte uitwijk.
  - **Ingangen (Mark, 14-10):** een vaste "feedback"-toets bestaat niet; de gangbare ingang is
  het menu (VS Code, JetBrains, Google). Dus: *Help → Melden…* en *Help → Melden met
  schermafbeelding…*, plus **F8** (instelbaar in Studio-instellingen → Sneltoetsen; vrij in de
  Studio en de browser), met **Alt+M** ("Melden") als alternatief, in de lijn van de bestaande
  Alt+letter-toetsen. Afgevallen: Alt-klik (Alt+slepen tilt op het canvas een element uit een
  container), Ctrl+Shift+S (elders "Opslaan als") en Ctrl+Shift+M (de browser zelf: profiel
  wisselen in Chrome, responsive weergave in Firefox).
  Het punt waar je begint te trekken geldt als "plek".
  - **Rechtsklik** op een element, diagram of map (projectboom en canvas): *Melden over dit
  item…* en *Melden met schermafbeelding…*; de melding krijgt dan het onderwerp mee (zie
  hieronder).
- **Het kader** mag over de hele Studio gaan: projectboom, canvas, eigenschappen, menu's;
  ook een kader van het hele venster.
- **Mijn meldingen** (Help-menu): lijst met status en reacties; reageren kan daar.
- **Losse meldpagina voor als de Studio hangt** (Mark, 14-10): `melden.html`, een eigen kleine
  pagina buiten de Studio-bundel (zoals `aanmelden.html`), met hetzelfde formulier en dezelfde
  API, maar zonder het kader-trekken; bijlagen via plakken, slepen of kiezen. Bereikbaar via een
  vaste link (index, footer, de foutmelding als de Studio vastloopt) en werkt ook als de Studio
  niet laadt. Vereist inloggen (de bestaande loginpagina); de context bevat dan alleen versie en
  browser. Het formulier zelf is één component die beide pagina's gebruiken.
- De beheerder behandelt meldingen met de gewone lijst/formulieren van het register, plus een
  notificatie bij een nieuwe melding.

Use cases (zoals Mark ze noemde): *Gebruiker*: maak melding (bug/wens), bekijk status meldingen
(extend: voeg foto of document toe), bekijk help. *Beheerder*: behandel meldingen.

## 4. Volgorde

1. Model door codegen (`--domein meldingen`), tabellen, API; toegangsregel "melder ziet eigen".
2. Formulier onder Help + bijlagen (plakken, slepen, kiezen) via de filestore.
3. Losse pagina `melden.html` met hetzelfde formulier.
4. Sneltoets + kader → schermafbeelding.
5. Mijn meldingen + notificatie naar de beheerder.
