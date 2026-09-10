# Begeleiding in de Studio — palette, lege staten, hints, checklist (ontwerp)

> Datum: 2026-09-10
> Status: ontwerp, op te pakken na de demo van 14–15 september
> Backlog: [`BACKLOG.md` §28](../BACKLOG.md)
> Context: [`STUDIO.md`](../STUDIO.md) (werkbank), `web/vite/src/studio/buildMenus.js`,
> `web/vite/src/studio/activities/maakDiagramActiviteit.jsx`

## 1. Aanleiding en uitgangspunt

Op de backlog staan "wizards": stapsgewijze begeleiding ingebed in de tool.
Dat werkt voor **lineaire, eenmalige** taken — een installatie, een import,
een account. Een modelleerwerkbank is het tegendeel: non-lineair en
verkennend; je weet halverwege pas wat je wilt. Een wizard neemt dan de
besturing over op het moment dat de gebruiker ergens anders wil klikken.

Uitgangspunt van dit ontwerp:

> **Hulp is aanwezig en bewust van de toestand, maar nooit modaal.**
> De gebruiker houdt de besturing; het gereedschap antwoordt.

Vier vormen, van licht naar zwaar. De eerste twee zijn structureel en
goedkoop en passen op bouwstenen die er al zijn; de derde kan grotendeels
worden *afgeleid* in plaats van geschreven; de vierde is de vervanger van de
wizard voor het ene pad dat wél een volgorde heeft.

## 2. De vier vormen

### 2.1 Lege staten die uitleggen

Een leeg canvas in een activiteit toont waar de activiteit voor is en twee
tot drie startacties, bijvoorbeeld *Laad voorbeeld · Importeer V3 · Begin
met een Entiteit*. Verdwijnt zodra er een element staat.

- Bouwstenen bestaan al: `previewTekst` en `laadVoorbeeld` per activiteit
  (zie `profielOntwerpActivity.jsx` als voorbeeld) en de import-dialoog.
  Ze staan nu in menu's; de lege staat brengt ze naar de plek waar iemand
  met een leeg scherm zit.
- Eén generiek `LegeStaat`-component in `maakDiagramActiviteit`, gevoed
  door de activiteitsopties; per activiteit hooguit een lijstje startacties.
- Geen toestand, geen persistentie, niets om te onthouden.

### 2.2 Command palette (Cmd+K / Ctrl+K)

De Studio is expliciet VS Code-stijl (`STUDIO.md`, backlog 0.0). De palette
is het VS Code-antwoord op "hoe doe ik X": typ *relatie*, *publiceer*,
*profiel* en krijg de actie, één regel uitleg en de sneltoets.

- Bron: de menustructuur uit `buildMenus.js` is al een lijst van acties met
  labels; de palette is een tweede weergave van diezelfde lijst, plus een
  `uitleg`-veld per actie en fuzzy zoeken.
- Eén invoerveld, resultaten gegroepeerd (activiteit · bewerken · exporteren
  · beheer · help), Enter voert uit, Esc sluit. Geen modus die blijft hangen.
- Het is het omgekeerde van een wizard: leren door te bevragen in plaats van
  door te doorlopen. Als er één ding gebouwd wordt, is het dit.

### 2.3 Contextuele hints — één keer, niet-blokkerend

Een dun strookje na een actie: *"Je hebt een Entiteit gemaakt — Alt+slepen
maakt een relatie."* Getriggerd door toestand, één keer per hint,
wegklikbaar, nooit in de weg. Dit is de stap voorbij de mouseover:
proactief zonder de muis af te pakken.

- Trigger = een toestandsovergang in de store (eerste element van type X,
  eerste verbinding, eerste export …), niet een timer of een muispositie.
- "Gezien" per hint in `localStorage` onder één sleutel
  (`studio05-hints-gezien`), klein en bewust per browser — dit is precies
  het soort gegeven waarvoor `localStorage` wél geschikt is.
- **Afgeleid waar het kan** — zie §3.

### 2.4 Een pad in plaats van een rail

Voor het stuk dat wél een volgorde heeft — eerste model → publiceren als
schemaversie → rebuild/codegen — een checklist in een zijpaneel. Stappen
vinken zichzelf af terwijl je ze doet, **in welke volgorde dan ook**; elke
stap heeft een *toon me* dat het bijbehorende knopje even oplicht.

- Een kaart, geen leiband: de gebruiker kan hem negeren of sluiten.
- Stapdetectie op dezelfde toestandsovergangen als §2.3 (bestaat er een
  diagram, is er een versie gepubliceerd, is er gerebuild).
- Dit levert wat wizards beloven — richting voor wie het nodig heeft —
  zonder de besturing over te nemen. Onboarding-checklists werken waar
  tours irriteren, om precies deze reden.

### 2.5 Wat we níet doen (tenzij een gebruikerstest erom vraagt)

Rondleidingen (driver.js, Shepherd) hooguit voor de allereerste minuut,
overslaanbaar, daarna nooit meer. Geen modale wizards in de werkbank.

## 3. Hints afleiden uit het metamodel

De Studio is metamodel-gedreven: een profiel definieert elementtypen,
compartimenten en verbindingsregels (de `descriptor` van een activiteit;
exacte velden in `maakDiagramActiviteit.jsx` en de profielregistratie).
Een groot deel van de hulp hoeft daarom **niet geschreven** te worden:

- "In dit profiel kan een *Entiteit* verbonden worden met *Entiteit*,
  *Referentielijst* en *Gegevenselement*" — staat al in de verbindingsregels.
- "Dit elementtype heeft de compartimenten *attributen* en *regels*" — staat
  in het elementtype.
- De sneltoets en het menu-pad van een actie staan al in `buildMenus.js`.

Een hint die uit het actieve profiel komt is juist door constructie, klopt
altijd met de tool en veroudert niet. Dezelfde stelling die het project
overal maakt — één expliciet model stuurt opslag, API én presentatie —
geldt dan ook voor de begeleiding. Handgeschreven hints blijven over voor
wat níet in het model zit (interactie: slepen, selecteren, exporteren).

## 4. Verhouding tot referentiedocumentatie (Imprint)

Twee soorten hulp, bewust gescheiden:

| | In de tool | Referentie |
|---|---|---|
| Vorm | kort, toestandsbewust, liefst afgeleid | lang, met navigatie, diagrammen, widgets |
| Waar | palette, lege staten, hints, checklist | een Imprint-site (backlog §27.3) |
| Koppeling | "Meer…" in palette/hint linkt naar de referentie | — |

Eén ding beide laten doen wordt óf een te dikke tooltip óf een te dunne
handleiding. Tot de Imprint-site er is, is de referentie `STUDIO.md` op
GitHub (help-menu sinds studio 0.7.2).

## 5. Fasering

1. **Palette + lege staten.** Structureel, geen modi, geen persistentie
   behalve niets. Grootste winst per uur.
2. **Profiel-afgeleide hints** (§3) plus een handvol handgeschreven
   interactiehints; `studio05-hints-gezien`.
3. **Checklist voor het publiceerpad** (§2.4).
4. **Rondleiding eerste minuut** — alleen na een gebruikerstest.

## 6. Open vragen

- Waar leeft `uitleg` per actie: in `buildMenus.js` bij de actie, of in een
  aparte tabel die ook de palette en de Imprint-referentie voedt?
- Hints per browser (`localStorage`) of per gebruiker (server)? Zolang §27.2
  (bitemporele modelopslag) er niet is: per browser, en dat is hier ook
  inhoudelijk juist.
- Meertaligheid: de tool is Nederlands; afgeleide hints erven de taal van
  het profiel — volstaat dat?
