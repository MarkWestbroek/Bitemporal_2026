# Chat Samenvatting

## Metadata

- Datum: 2026-09-17
- Titel: GE opnemen in de entiteit (vak in een vak), oude sandbox migreren, profiel als bron van de velden
- Bestandstamnaam: 2026-09-17-ge-opname-in-entiteit-en-profielvelden
- Gerelateerde export: `../exports/2026-09-17-ge-opname-in-entiteit-en-profielvelden.md`
- Gerelateerde branch/commit: `feat/ge-opname-in-entiteit` — `3092690`, `2443d39`, `14536a8`, `ea7fd50`
- AI: **Claude** (Claude Code)

## Doel

Het patroon ENT ◆── GE compact kunnen tonen: de gegevenselementen als
sub-vakken in één compartiment van de entiteit. Onderweg bleek een oude
sandbox geen compositie-connectoren te hebben, en misten in de studio de
velden die de oude IDE wél kon bewerken (kardinaliteit e.a.).

## Beslissingen

- **Opname = derde gedaante van een samenstel**, naast ASOC en de
  lollipop-samentrekking. Het is *een andere weergave van dezelfde elementen*:
  het model verandert niet.
- **Per GE en per diagram, nooit automatisch.** De keuze staat als
  `DiagramNode.gedaante = "ingebed"` op het GE-voorkomen (hergebruik van
  `zetNodeGedaante`); positie en maat blijven bewaard. Contextmenu "Opname" op
  GE, compositielijn en ENT.
- **Declaratie op het deel:** `ElementType.opname` in het profiel; één pure
  beslisplek `diagramcore/canvas/opname.js`; nieuwe core-viewer `sub-vak`.
- **Kopregel sub-vak:** GE-naam vet; rolnaam, kardinaliteit en
  `{momentvoorkomen}` klein en niet vet; materieel als badge.
- **Randgevallen:** compositielijn vervalt; andere lijnen van de GE (bv.
  «use») hangen aan de ENT; staat de ENT niet op het diagram, dan blijft de GE
  zichtbaar; een tweede, niet-ingebed voorkomen blijft een losse node.
- **Oude sandbox automatisch migreren** (`hooks.migreerModel`,
  `canoniek-uml/migratie.js`): vóór 15-09 waren composities presentatie-edges
  per diagram. Eenmalig (vlag `meta.compositiesGevouwen`), buiten de
  undo-historie; ontbrekende velden worden aangevuld uit `data.bron`.
- **Het profiel is de waarheid** over welke eigenschappen en relaties een
  element heeft. Heenreis, terugreis en migratie lezen de veldnamen uit de
  profiel-`properties` (`canoniek-uml/mappingV3Canoniek.js`); geen aparte
  veldlijsten. Uitzonderingen expliciet: `EIGEN_VERTALING` (kleur, materieel,
  domein) en `GENERIEKE_TYPES` (entiteit, GE, relatie, compositie).
- **Velden zoals "Details" in de oude IDE** voor compositie, GE, entiteit en
  relatie. Label heen/terug hoort bij de GE (de `edgeLabels`-hook krijgt
  `ctx.elements`). Geen aparte typenaam bij ENT/REL (= naam, ook V3-id); geen
  domein bij ENT (= package).
- **Stereotype volgt subtype** via core-hook `ElementType.hooks.stereotype`.

## Waarom deze keuze

- De gedaante hoort bij het voorkomen (ontwerpprincipe 04-09); zo kan
  dezelfde GE op het ene diagram ingebed en op het andere los staan.
- Automatische migratie i.p.v. "opnieuw inladen": herladen had niet
  teruggeschreven sandbox-werk kunnen weggooien.
- Veldnamen uit het profiel voorkomen dat een nieuwe property wel in de
  inspector verschijnt maar stil niet in model/V3 terechtkomt.

## Begrippen (verduidelijkt in de chat)

- **V3 / API**: gepubliceerd model (Go-backend).
- **Oude IDE-store** (`IDE.html`, localStorage `ide-model-store`): oude
  datavorm.
- **Sandbox** (Omnium Studio → Canoniek, localStorage
  `studio05-canoniek-uml`): nieuwe vorm; wordt alleen gespiegeld als hij leeg
  is. Heenreis `vanCanoniekModel`, terugreis `naarCanoniekModel`.
- **`data`** = eigenschappen van één element; **`data.bron`** = kopie van de
  oude data, zodat de terugreis verliesvrij is.

## Gewijzigde onderdelen

- Bestanden: `diagramcore/canvas/{opname.js,materialiseerConnectoren.js,DiagramCanvas.jsx}`,
  `diagramcore/shapes/basisShapes.jsx`, `diagramcore/inspector/propertyTypeEditors.jsx`,
  `diagramcore/types/{schema.js,handlerCatalogus.js}`, `diagramcore/styles/diagramcore.css`,
  `diagramprofielen/canoniek-uml/{index.js,adapter.js,migratie.js,mappingV3Canoniek.js}` + tests,
  `studio/activities/maakDiagramActiviteit.jsx`
- API routes: geen
- DB/SQL: geen
- Frontend: alles hierboven (alleen `web/vite`); docs in `docs/STUDIO.md` en
  de overdracht Notaties

## Open punten

- Klik op een sub-vak selecteert de ENT, niet de GE.
- Opname-keuze, maten en ASOC-overrides reizen niet mee in de V3-export.
- Een ENT met vaste maat groeit niet mee (*Maat aanpassen aan inhoud*).

## Volgende stap

Branch naar `main` mergen; verder op de desktop.
