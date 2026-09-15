# Opdracht (voor een aparte Claude-chat): demo-model np-loc-org+geo, en OAS → canoniek

**Context.** Di 15 september 2026 geeft Mark een demo van **Toegangsspraak** in de
FTV-werkgroep (draaiboek: `2026-09-15 FTV-demo Toegangsspraak — draaiboek.md`). De
toegangsspraak-chat focust op de taal/demo; deze opdracht dekt het benodigde
**gegevensmodel** en (optioneel) de **OAS-import naar canoniek**. Lees eerst
`CLAUDE.md`, `.github/copilot-instructions.md` en `docs/STUDIO.md`.

## Deel A — demo-model np-loc-org+geo (moet af vóór ma 14 sep)

Breid het bestaande np-loc demo-model uit (of maak een variant) in het
canonieke-model-spoor, zó dat de velden verschijnen in de **modelboom van de
toegang-activity** (`web/vite/src/modelpicker/` levert de FieldRefs; de
toegang-activity is `web/vite/src/studio/activities/toegangActivity.jsx`).

Gewenste inhoud:

1. **Organisatie-deel** (nieuw): `Organisatie` — `Afdeling` (naam) — `Medewerker`
   (functie/rol, kanaal). Simpel houden; het dient als illustratie van een tweede
   register naast NatuurlijkPersoon. (Subject-kenmerken als rol/afdeling/dienst komen
   in de demo uit de PIP/refinements, niet per se uit dit register — het model mag
   dus klein blijven.)
2. **Geo-deel** (nieuw): `Gemeente` — `Gemeentedeel` (of Wijk; naam) — `Locatie`,
   waarbij **Locatie dezelfde entiteit is als in np-loc** (woonlocatie van een
   natuurlijk persoon verwijst ernaar). Zorg dat `NatuurlijkPersoon.woonlocatie.wijk`
   (of een gelijkwaardige keten naar het gemeentedeel) als veld resolvebaar is.
3. **NatuurlijkPersoon-aanvullingen**:
   - `geslacht` (enum bv. man/vrouw/X) — doelwit van een verbodsregel;
   - GE **`Aanspraak`** met twee **optionele** velden:
     `aanspreektitel` (enum: meneer/mevrouw/hen) en `formeelAanspreken` (boolean).
     Optionaliteit is de pointe (onbekend/bekend×waarde, drie effectieve waarden);
     geen instantie = niet geregistreerd in de bitemporele db.

**Acceptatiecriterium.** De beleidstekst uit het draaiboek (sectie "Geteste
beleidstekst" + bonus-regel) parseert in de toegang-activity **zonder
controle-meldingen**: alle ketens resolven eenduidig tegen het model, de enum- en
typebewaking klaagt niet. Snelle regressietest zonder UI: de veldenlijst door
`maakVeldIndex`/`resolveerVerwijzing` uit `web/vite/src/toegangsspraak/metamodel.js`
halen (zie `metamodel.test.js` voor het patroon).

## Deel B — OAS → canoniek model (optioneel; anders "plan"-slide)

**Stand van zaken.** Er is een `oas31`-diagramprofiel
(`web/vite/src/diagramprofielen/oas31/`) dat OAS 3.0/3.1 importeert en als eigen
notatie toont (dialect-schakelaar, zie `docs/BACKLOG.md` §0.0.2). Een
**transformatie van een OAS-document naar het canonieke model (canoniek-uml) bestaat
nog niet** — dat is deze opdracht.

Gewenst (minimaal bruikbare eerste stap):

- `components.schemas` → entiteiten/GE's + velden in canoniek-uml-vorm: object-schema
  → entiteit of GE (heuristiek: top-level/`$ref`-doelwit met identiteit → entiteit,
  genest/compositie → GE), properties → velden met OAS-type/format (dezelfde
  conventies als `bepaalWaardetype` in `toegangsspraak/metamodel.js`: type, format,
  enum), `required` → optionaliteit, arrays → meervoudigheid.
- Casus: de **OpenOrganisatie**-OAS (Mark vindt het model matig — de import hoeft dus
  niet mooi te normaliseren, wel eerlijk te tonen wat erin zit; opschonen kan daarna
  met de hand in de Studio).
- Niet nodig: paths/operations (alleen schemas), round-trip terug naar OAS.

Als dit niet haalbaar is vóór dinsdag: schrijf de aanpak kort uit als plan (het
bovenstaande is de kern) zodat het als vooruitblik-slide kan dienen.

## Afspraken

- Documenteer in `docs/STUDIO.md`/`docs/BACKLOG.md` conform `CLAUDE.md`; commit alleen
  op verzoek van Mark, op een feature-branch.
- Raak de toegangsspraak-modules niet aan behalve (evt.) leesgebruik van
  `metamodel.js` — parallelle wijzigingen daar botsen met de demo-voorbereiding.
