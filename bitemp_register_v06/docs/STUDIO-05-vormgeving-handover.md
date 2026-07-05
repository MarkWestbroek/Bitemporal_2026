# Handover — vormgevingssessie Studio 0.5

> Voor de ontwerp-sessie (aparte chat) over de integrale iconenset en de
> StyleType-tokensets (plan §8.5b en §8.6a). Alle koppelvlakken bestaan al;
> deze sessie levert **ontwerp** (vormen, kleuren, waarden) — registreren is
> daarna puur invullen.

## Uitkomst (sessie 2026-07-04/05, uitgevoerd)

De sessie is gehouden (Claude-chat, proefopzet als artifact) en de besluiten
zijn geïmplementeerd. Samenvatting:

- **Stijlrichting**: outline + **één gevuld accent** per icoon
  (currentColor-fill op het betekenisdragende kenmerk), 14×14, stroke 1.2 —
  familie van de neutrale set en de uitlijn-iconen.
- **Besluiten B1–B6**: accent op het kenmerk (niet overal de kopbalk);
  open UML-markers blijven open (◇ ▷); selectie naar merk-indigo
  (`#4f46e5`); marker-vulling = canvaskleur + nieuwe tokens
  `--dc-canvas-achtergrond`/`--dc-label-achtergrond`; OAS-trio als
  cirkelsymboliek (oneOf = 1 van 3 gevuld, anyOf = 2, allOf = venn-overlap);
  activity-bar-iconen in een aparte ronde.
- **B6-ronde (2026-07-05, uitgevoerd)**: de vijf 0.5-activiteiten dragen nu
  een **familie-embleem** — het kenmerkende vocabulaire-icoon van het
  profiel op het 24-raster (stroke 1.7), met het ene gevulde accent als
  0.5-kenmerk (klassieke activiteiten blijven puur outline). Registraties:
  `studio/icons.jsx` → `IconDiagram05` (mini-datamodel, ◆), `IconUML05`
  (klasse + open ▷), `IconOAS05` (accolade + property-keys),
  `IconProfiel05` (gestapelde kaders + naam-tab), `IconProfielOntwerp05`
  (stencil + afgeleide). Daarmee zijn de eerdere botsingen weg (drie
  activiteiten deelden IconDiagram; UML (0.5) was gelijk aan UML-model,
  OAS (0.5) aan API's). Dynamisch geregistreerde profielen
  (`profielRegistratie`) delen voorlopig `IconProfiel05`.
- **Geïmplementeerd**: `diagramcore/shapes/iconenVocabulaire.jsx`
  (28 iconen, geregistreerd via `maakDiagramActiviteit`), `icoon`-ids op de
  elementtypen van canoniek-uml, puur-uml, oas31 en profiel-ontwerp
  (gedeelde concepten delen een id: Entiteit/Klasse → `klasse`), en
  **tokens v2** bovenin `diagramcore/styles/diagramcore.css`.
- **Canvasbesluit (nagekomen, 2026-07-05)**: het 0.5-canvas stond tot deze
  sessie op `.studio-paper` (vast wit, zoals bpmn/dmn-js — die zijn
  third-party en kennen geen donker thema). Mark wil dat het donkere thema
  zich wél uitstrekt tot het eigen canvas: de fabriek zet nu `dc-canvasvlak`
  op de canvas-wrapper en de tokens hebben donker-varianten
  (canvas volgt `--s-canvas`, marker-vulling = canvaskleur, donkere
  labelchips, selectie `#818cf8`) — "lichte pastel-kaarten op donker
  canvas", conform de proefopzet.
- **Nog open**: element-pastel-richtlijn is beschreven maar niet
  genormaliseerd (huidige kleuren blijven), eigen tokenset per StyleType-id
  blijft wachten tot er een tweede StyleType is, activity-bar-iconen (B6).
- Chatverslag: `copilot-chats/summaries/2026-07-05-vormgevingssessie-iconen-en-tokens-v2.md`.

## Doel van de sessie

1. **Integrale iconenset**: één herkenbare familie iconen voor
   (a) de elementtypen per profiel (taakbalk "Maken"/"Verbinding",
   elementen-browser, later minibrowser), en (b) eventueel de
   0.5-activiteiten in de activity bar. Consistent met de Omnium-merkstijl.
2. **StyleType-tokensets**: definitieve licht- én donker-waarden voor de
   canvas-tokens, en (optioneel) een eigen tokenset per StyleType-id
   ("uml-klassiek" is nu de enige).
3. Eventueel: richtlijnen voor element-pastels per profiel (nu ad hoc
   gekozen), marker-stijlen en lijndiktes.

## Merk

- Product: **Omnium Studio**; assets + landing page in
  `bitemp_register_v06/web/omnium-studio/` (README aldaar: kleuren,
  logovarianten, OG-regeneratie).
- Kerngradient: `#60a5fa → #6366f1 → #22d3ee`.

## Wat er al bestaat (niet opnieuw ontwerpen, wel op aansluiten)

- **Icoon-registry**: `web/vite/src/diagramcore/shapes/typeIconen.jsx`.
  API: `registreerTypeIcoon(id, Component)`; een ElementType verwijst met
  `icoon: "<id>"` (string, Definitie-domein) of valt terug op zijn shape
  (class-box → doosje, bol, note, boundary, connector → lijn). Iconen zijn
  React-componenten: SVG `viewBox 0 0 14 14`, `stroke="currentColor"`,
  `fill="none"`, strokeWidth ~1.2 — zie de bestaande neutrale set in dat
  bestand als voorbeeld.
- **Uitlijn-iconen** (aparte familie, al goedgekeurd door Mark):
  `web/vite/src/diagramcore/taskbar/uitlijnIcons.jsx` — 15px, stroke 1.25,
  "oude symboliek". Nieuwe iconen moeten hiernaast niet detoneren.
- **Tokens v1**: bovenin `web/vite/src/diagramcore/styles/diagramcore.css`:
  `--dc-lijn`, `--dc-lijn-zacht`, `--dc-node-rand`, `--dc-node-vulling`,
  `--dc-selectie`, `--dc-marker-vulling`, met een
  `[data-studio-theme="dark"]`-variant. De shell levert verder `--s-*`
  (panel/fg/border/hover/accent) in `studio.css`.
- **Shapes**: class-box, note, rounded, boundary, anker, bol
  (`diagramcore/shapes/basisShapes.jsx`).

## De elementtypen die iconen nodig hebben

| Profiel | Typen (kort · huidige kleur) |
|---|---|
| canoniek-uml | Entiteit (ENT · #bfdbfe), Gegevenselement (GE · #bbf7d0), Relatie (REL · #ede9fe, connector mét box), Enumeratie (ENUM · #fef3c7), Gegevenstype (TYPE · #dbeafe), Referentielijst-instantie (REF · #fde68a), Notitie, Constraint, Kader; connectoren: compositie ◆, generalisatie ▷, gebruik «use» |
| puur-uml | Klasse (#fef9c3), Interface (#dcfce7), Enumeratie, Datatype (#dbeafe), Notitie, Kader; associatie, aggregatie ◇, compositie ◆, generalisatie ▷, realisatie ⊳┄, dependency |
| oas31 | Schema (#d1fae5), Enum, Operatie (#e0f2fe), Notitie, Kader; $ref, allOf, items, oneOf, anyOf |
| profiel-ontwerp | Elementtype (#bae6fd), Compartimenttype (#ddd6fe), Veldtype (#bbf7d0); compositie ◆, verbindingsregel |
| activity bar | Diagrammen (0.5), UML (0.5), OAS (0.5), Profiel (0.5), Profiel-ontwerp (0.5) — nu hergebruikte `studio/icons.jsx`-iconen |

## Kaders

- **Definitie-domein blijft serialiseerbaar**: profielen verwijzen alleen op
  icoon-id; componenten leven in het Implementatie-domein. Nieuwe
  registraties het liefst per profiel (bv.
  `diagramprofielen/<profiel>/iconen.jsx`, geladen door de activiteit) of in
  de core-set als het generieke vormen zijn.
- Iconen renderen op 12–15px in taakbalken/browser; moeten in currentColor
  werken (licht én donker thema) — geen eigen kleuren tenzij bewust.
- Element-pastels zijn Definitie (per ElementType `kleur`); de vaste
  UML-pastels van de oude editor zijn het referentiepunt voor
  "uml-klassiek" (zie `umleditor/metamodel/types.js → defaultKleur`).
- Tokens uitbreiden mag; gebruik ze dan ook in de componenten (geen nieuwe
  hardcoded hexen in `ConnectorEdge`/`basisShapes`).

## Hoe te verifiëren

Dev-server: `npm run dev` in `bitemp_register_v06/web/vite` (poort 5174,
`/viz/react/studio.html`). De taakbalken en de elementen-browser tonen de
iconen direct; themawissel zit rechtsboven. Node-tests raken iconen niet;
`npx vite build` moet schoon blijven.

## Afbakening

- Geen gedragswijzigingen (alleen ontwerp + registraties + tokenwaarden).
- De merk-iconen voor de activity bar mogen apart besloten worden; de
  elementtype-set heeft prioriteit (taakbalken/browser worden er direct
  beter van).
