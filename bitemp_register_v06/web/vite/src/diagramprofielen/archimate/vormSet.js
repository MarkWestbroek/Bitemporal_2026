// @ts-check
/**
 * archimate/vormSet — de mapping van de shape-set **"Iconen als vorm"** (P07).
 *
 * ArchiMate kent twee officiële notaties per element: de rechthoek met het
 * type-icoon in de hoek (de standaard, `archimate-box`) én de gedaante waarin
 * het **symbool zélf de vorm is** (actor = poppetje, node = 3D-doos, …). Deze
 * module is de *data* van die tweede gedaante: welk elementtype welke
 * vorm-shape krijgt. Bewust een pure `.js` naast `vormShapes.jsx`, zodat de
 * mapping in de node-testrunner laadbaar is (patroon `bpmn/sequenceFlow.js`).
 *
 * **Wat géén vorm krijgt (en waarom):** `junction`, `notitie` en `kader` —
 * geen ArchiMate-elementen met een alternatieve gedaante (de junction ís al
 * zijn symbool). De **motivation**-elementen kregen op 01-09 alsnog hun
 * figuur-variant (dartbord, stuurwiel, parallellogram, …): de spec toont ze
 * alleen als achthoekige box, maar Archi levert de figuren wél en dat is
 * waar gebruikers vandaan komen. Requirement en constraint delen het
 * parallellogram, zoals in Archi.
 *
 * Meerdere elementtypen delen één shape (de drie services delen het
 * afgeronde blok, de twee functies de chevron, business-object en data-object
 * de rechthoek met kopstreep) — precies zoals de spec dat doet.
 */

/** Alle shape-id's die `vormShapes.jsx` registreert. */
export const VORM_SHAPE_IDS = [
  "am-vorm-actor",
  "am-vorm-rol",
  "am-vorm-proces",
  "am-vorm-functie",
  "am-vorm-service",
  "am-vorm-event",
  "am-vorm-object",
  "am-vorm-component",
  "am-vorm-node",
  "am-vorm-device",
  "am-vorm-software",
  "am-vorm-artifact",
  "am-vorm-interface",
  "am-vorm-capability",
  "am-vorm-goal",
  "am-vorm-driver",
  "am-vorm-stakeholder",
  "am-vorm-principle",
  "am-vorm-requirement",
];

/** elementTypeId → shape-id. Alleen typen mét een spec-eigen vormvariant. */
export const VORM_SHAPES = {
  // ── business ──
  "business-actor": "am-vorm-actor", // poppetje
  "business-rol": "am-vorm-rol", // liggende cilinder
  "business-proces": "am-vorm-proces", // pijl
  "business-functie": "am-vorm-functie", // chevron
  "business-service": "am-vorm-service", // afgerond blok
  "business-event": "am-vorm-event", // pijl met inkeping
  "business-object": "am-vorm-object", // rechthoek met kopstreep
  // ── application ──
  "app-component": "am-vorm-component", // blok met twee uitsteeksels
  "app-service": "am-vorm-service",
  "app-functie": "am-vorm-functie",
  "data-object": "am-vorm-object",
  // ── technology ──
  node: "am-vorm-node", // 3D-doos
  device: "am-vorm-device", // doos op een voet
  systeemsoftware: "am-vorm-software", // bol met arc
  "tech-service": "am-vorm-service",
  artifact: "am-vorm-artifact", // dokje met omgevouwen hoek
  // ── 3.2-completering (04-09): de gedeelde figuren voor de nieuwe typen ──
  "business-interface": "am-vorm-interface", // lollipop
  "app-interface": "am-vorm-interface",
  "tech-interface": "am-vorm-interface",
  capability: "am-vorm-capability", // blokjes-trap
  // ── motivation (Archi-figuren) ──
  goal: "am-vorm-goal", // dartbord
  driver: "am-vorm-driver", // stuurwiel
  stakeholder: "am-vorm-stakeholder", // cirkel met naaf en asjes
  principle: "am-vorm-principle", // plaquette met uitroepteken
  requirement: "am-vorm-requirement", // parallellogram
  constraint: "am-vorm-requirement",
};

/** De shape-set zoals `DiagramType.shapeSets` hem verwacht. */
export const VORMEN_SET = {
  id: "vormen",
  label: "Iconen als vorm",
  shapes: VORM_SHAPES,
};
