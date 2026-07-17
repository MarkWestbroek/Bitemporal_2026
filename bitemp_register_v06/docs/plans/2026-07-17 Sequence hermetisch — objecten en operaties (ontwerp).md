# Sequence hermetisch — objecten, operaties en getypeerde levenslijnen (ontwerp)

> Datum: 2026-07-17 (n.a.v. Marks review van sequence v0)
> Status: **ontwerp/denkwerk — richting voor sequence v1/v2 en twee nieuwe
> kernconcepten.** Zie `STUDIO-05-gedragsdiagrammen.md` (stand) en
> `diagramprofielen/sequence/` (v0).

## 0. De visie (Marks punten, samengevat)

Een **hermetisch** sequence-diagram is meer dan lijnen en pijlen:

1. **Levenslijnen zijn objecten** — instanties van klassen/typen, in UML
   genoteerd als `objectnaam:Klassenaam` (onderstreept). Het type kan uit
   verschillende profielen komen: canoniek-model-element, UML-klasse,
   UML/ArchiMate-component, OAS-operatie(-verzameling).
2. **Berichten zijn operaties** van het type van de doel-levenslijn — te
   kiezen uit de operaties die dat type aanbiedt, met (optioneel) ingevulde
   parameterwaarden.
3. **Layout heeft semantiek**: berichten horizontaal; een activatie voegt
   zich naar het inkomende bericht (top = bericht-y) en rekt mee tot het
   laatste uitgaande/retour-bericht (v2, maar wél het doel).
4. Een element uit de projectboom op een levenslijn **droppen** typeert
   hem — de levenslijn "kent" dan zijn operaties.

Dat vraagt om twee concepten die de motor nog níet kent — en die ver
voorbij sequence nuttig zijn.

## 1. Nieuw kernconcept: **instantie-van** (object)

We hebben al twee cross-element-concepten: **kruisverbanden** (trace-links
tussen profielen, kruis-store) en **gedragsverwijzing** (element →
diagram, zelfde profiel). Instantie-van is de derde soort: **element →
element, over profielen heen, met instantie-semantiek**.

**Voorstel** (volgt het bestaande patroon van `randVan`/`gedragDiagramId`):

- Model-feit op het element: `data.instantieVan = { profielId, elementId }`.
- Nieuw property-datatype **"element-verwijzing"**: een picker over de
  profieltypeRegistry (profiel kiezen → element kiezen; zelfde bronnen als
  de Koppelingen-picker). Declaratief inperkbaar:
  `{ datatype: "element-verwijzing", profielen?: [...], elementTypes?: [...] }`.
- **Presentatie**: een shape-helper `instantieLabel(element)` die
  `naam:TypeNaam` (onderstreept) oplevert; de levenslijn-kop gebruikt hem.
  Resolutie runtime via de registry (verwijderd type → naam cursief met ⚠).
- **Spiegeling naar de kruis-store** (optioneel, aanbevolen): bij het
  zetten van instantieVan ook een kruisverband "is instantie van" leggen,
  zodat de relatie zichtbaar is in Koppelingen (matrix én grafisch) en
  meegaat in analyses/transformaties. Het element-veld blijft de bron van
  waarheid; de kruis-link is afgeleide weergave. (Dit raakt de open
  "superprofiel als formele drager"-discussie — zelfde familie.)

**Gratis bijvangst**: met instantie-van bestaat het **object-diagram**
(UML instance/object diagram) bijna vanzelf — objecten (`naam:Type`,
onderstreept) met **slots** (attribuutwaarde-regels, uit de attributen van
het type!) en links als instanties van relaties. Kandidaat-profiel zodra
dit concept er is. (Marks "object flow diagram": object *flow* zit in het
activity-profiel als objectstroom; het instantie-diagram is dit.)

## 2. Nieuw kernconcept: **operaties als cross-profiel facet**

Sequence heeft een vraag die de motor nu niet kan beantwoorden: *"welke
operaties heeft dit type?"* — en het antwoord verschilt per profiel:

| Profiel | Waar leven "operaties"? |
|---|---|
| puur-UML klasse | het operaties-compartiment |
| UML/ArchiMate-component | via interfaces/services (indirect) |
| OAS | de operations (GET/POST … op paths) — past uitstekend |
| canoniek model | (nog) geen — datamodel; via gekoppelde API's/OAS |

**Voorstel: OperatieResolver** — zelfde koppelvlakpatroon als de
ReferenceResolvers (declaratief id, implementatie per profiel):

```js
// profieltypeRegistry-uitbreiding per profieltype:
operatiesVan(element) → [{ id, naam, parameters: [{naam, type?}], retour? }]
```

- v1-implementaties: **puur-UML** (compartiment uitlezen) en **OAS**
  (operations). Andere profielen geven `[]` (dan valt sequence terug op
  vrije tekst).
- **Bericht-model**: `data.operatie = { id, argumenten: {param: waarde} }`;
  het edge-label rendert `naam(arg1, arg2)`. De inspector toont een
  operatie-keuzelijst (gevuld via de doel-levenslijn → instantieVan →
  operatiesVan) plus argument-velden per parameter.
- **Hermetische modus**: is de doel-levenslijn getypeerd, dan valideert de
  (bekende, nog te bouwen) validatie-hook dat elk bericht een operatie van
  dat type is; ongetypeerd blijft vrije tekst toegestaan (zachte modus).

## 3. Droppen uit de projectboom op een levenslijn

Interactie: sleep een element (bv. OAS-operatiegroep, UML-klasse) uit de
Modelleren-boom op een levenslijn → `instantieVan` wordt gezet (en de naam
voorgesteld als `obj:Type`). Mechaniek:

- De boom sleept al (naar mappen); nieuw is een **canvas-drop op
  node-niveau**: de drop levert `{profielId, elementId}`, de canvas zoekt
  de node onder de cursor en meldt `onExternDrop(nodeId, ref)`; de
  activiteit beslist (descriptor-hook `elementType.hooks.ontvangtDrop`).
- Zelfde mechaniek is later herbruikbaar voor bv. "ArchiMate-component op
  canoniek-entiteit droppen → kruisverband leggen".

## 4. Het as-primitief (layout mét betekenis) — v1.5/v2

Marks lat: berichten horizontaal, activaties voegen zich, volgorde blijft
consistent. Gefaseerd:

- **v1.5 — snap bij verbinden (goedkoop):** bij het leggen van een bericht
  krijgt het doel-punt de y van het bron-punt (relatief herrekend);
  landt een bericht op een activatie, dan snapt de activatie-top naar de
  bericht-y. Best te doen met een descriptor-hook `naVerbinden(connector,
  ctx)` die de activiteit uitvoert (kleine core-uitbreiding).
- **v2 — ordening als semantiek:** punten kennen een volgorde (index i.p.v.
  losse y); slepen = herordenen met doorschuiven; berichten blijven per
  constructie horizontaal; activaties rekken van eerste inkomend tot
  laatste uitgaand bericht. Dit is het echte as-primitief uit de
  verkenning — een constraint-laag bovenop de vrije canvas, en bewust de
  laatste stap.

## 5. Fasering (voorstel)

1. **Sequence v1 (hermetisch minimum):** datatype "element-verwijzing" +
   `instantieVan` op de levenslijn (picker; kop toont `naam:Type`
   onderstreept), OperatieResolver-koppelvlak + puur-UML- en
   OAS-implementaties, operatie-keuze + argumenten op berichten,
   boom-drop op de levenslijn.
2. **v1.5:** horizontaal-snap + activatie-top-snap (hook `naVerbinden`).
3. **v2:** volgorde-model met doorschuiven, activatie-stretch,
   hermetische validatie.
4. **Zijpad:** object-diagram-profiel (instanties + slots) zodra
   instantie-van bestaat — kleine declaratie.

Opmerking bij scope: stap 1 introduceert de twee concepten die ook elders
renderen (object-diagram, droppen-om-te-koppelen, operaties in de
inspector van componenten). Ze verdienen dus een nette core-plek — niet
sequence-specifiek bouwen.

---
*Zie ook:* `STUDIO-05-gedragsdiagrammen.md`,
`2026-07-17 ArchiMate en verdere notaties (plan).md` (§5 volgorde-advies),
`diagramprofielen/sequence/` (v0 + `randElement.klem: "as"`).
