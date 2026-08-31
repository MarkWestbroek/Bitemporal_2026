// @ts-check
/**
 * sysml — SysML v1 op de generieke diagram-motor.
 *
 * Uit de notatie-verkenning (`docs/plans/2026-07-17 ArchiMate en verdere
 * notaties (plan).md` §4): *"SysML v1 ís een UML-profiel; het meeste is
 * hergebruik."* Dat klopt, en het advies was **bdd + req eerst**. Dit profiel
 * doet die twee én de kern van **ibd**, want juist dáár zat vóór juli het gat
 * — en dat is inmiddels gedicht:
 *
 *   - **bdd** (block definition) ≈ class-diagram met «block»: blok, valueType,
 *     interfaceBlock, constraint block, enumeratie, pakket. Compositie /
 *     aggregatie / generalisatie / associatie / afhankelijkheid zijn de
 *     bestaande edge-middelen — geen regel motor-code.
 *   - **ibd** (internal block): een blok als **container** met parts erin en
 *     **poorten op de rand** — precies `containerVoor` + het
 *     rand-aanhechtingsprimitief (`randElement`). De poortnaam hangt eronder
 *     via het buitenlabel (`naamLabel: "buiten"`): een vierkantje van 16px kan
 *     zelf geen tekst dragen. Connector en item flow verbinden de poorten.
 *   - **req** (requirements): de «requirement»-doos met id en tekst, plus de
 *     vijf traceerrelaties. Die zijn notationeel identiek (gestreept, open
 *     pijl, «stereotype»-label) en zitten daarom in **één** connector met een
 *     `soort`-keuze — zie `traces.js`. **Containment** (de samengestelde
 *     requirement) krijgt het ⊕ aan de ouderkant: markernaam `kruis-cirkel`,
 *     nieuw in de core en mogelijk sinds `markerStart` echte markers aankan.
 *
 * Bewust buiten scope: **parametrics** (constraint-verbindingen tussen
 * constraint-parameters — nichewaarde, zie het plan), **SysML v2** (eigen
 * metamodel én notatie; pas oppakken als er vraag naar is), en de
 * gedragsdiagrammen (act/stm/sd) — die hébben we al als UML-profielen.
 *
 * De **`req`-kant hoort eigenlijk half thuis bij Koppelingen**: het plan merkt
 * op dat satisfy/verify/derive beter passen bij de kruisverbanden-matrix dan
 * bij een tekening. Dit profiel tekent ze; de matrix-kant is vervolgwerk.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerSysmlShapes } from "./shapes.jsx";
import { registreerSysmlIconen } from "./iconen.jsx";
import { TRACE_OPTIES, traceLabels } from "./traces.js";

export const SYSML_ID = "sysml";

const KLEUR_VELD = { key: "kleur", datatype: "colour" };

/** Wat als attribuut-/parametertype gekozen kan worden. */
const TYPE_REFS = ["waardetype", "enumeratie", "blok"];

/** Blokken en hun verwanten: wat generalisatie en associatie mogen raken. */
const BLOKKEN = ["blok", "waardetype", "interfaceblok", "constraintblok", "enumeratie"];
/** Wat in een ibd op een blok-frame kan zitten. */
const IBD_HOUDERS = ["blok", "part"];

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
const fieldTypes = [
  {
    id: "waarde",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "type", referenceTypes: TYPE_REFS },
    ],
  },
  {
    id: "deel",
    viewer: "naam-type",
    properties: [
      { key: "naam", label: "rolnaam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "type", referenceTypes: ["blok"] },
    ],
  },
  {
    id: "operatie",
    viewer: "naam-type",
    properties: [
      { key: "naam", label: "signatuur", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "retourtype", referenceTypes: TYPE_REFS },
    ],
  },
  {
    id: "literal",
    viewer: "waarde",
    properties: [{ key: "naam", label: "waarde", datatype: "string", verplicht: true }],
  },
  {
    id: "constraint",
    viewer: "tekst",
    properties: [{ key: "naam", label: "expressie", datatype: "string", verplicht: true }],
  },
];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "blok",
    label: "Blok",
    omschrijving: "«block» — het bouwsteentype van SysML. Sleep parts erin voor een intern blokdiagram.",
    kort: "BLK",
    icoon: "sy-blok",
    stereotype: "«block»",
    shape: "class-box",
    kleur: "#dbeafe",
    // Een blok is óók het ibd-frame: parts en poorten wonen erin/erop.
    containerVoor: "bevat-part",
    properties: [KLEUR_VELD],
    compartments: [
      { id: "waarden", label: "values", fieldType: "waarde" },
      { id: "delen", label: "parts", fieldType: "deel" },
      { id: "operaties", label: "operations", fieldType: "operatie" },
    ],
  },
  {
    id: "part",
    label: "Part",
    omschrijving: "Een deel binnen een blok (ibd): rolnaam : Type. Sleep hem in een blok.",
    kort: "PART",
    icoon: "sy-part",
    stereotype: "«part»",
    shape: "class-box",
    kleur: "#eff6ff",
    containerVoor: "bevat-part",
    properties: [KLEUR_VELD],
    compartments: [{ id: "waarden", label: "values", fieldType: "waarde" }],
  },
  {
    id: "poort",
    label: "Poort",
    omschrijving: "Sleep hem op de rand van een blok of part: het aansluitpunt voor connectoren.",
    kort: "PRT",
    icoon: "sy-poort",
    shape: "sysml-poort",
    resizebaar: false,
    // Rand-aanhechting: de poort woont óp de omtrek van zijn gastheer.
    randElement: { ouderTypes: IBD_HOUDERS },
    // Een vierkantje van 16px draagt zelf geen tekst.
    naamLabel: "buiten",
    properties: [
      {
        key: "richting",
        label: "richting",
        datatype: "keuze",
        opties: [
          { waarde: "", label: "(proxy port, geen richting)" },
          { waarde: "in", label: "in" },
          { waarde: "uit", label: "uit" },
        ],
      },
    ],
  },
  {
    id: "waardetype",
    label: "Waardetype",
    omschrijving: "«valueType» — een waarde zonder identiteit (met eenheid/dimensie).",
    kort: "VAL",
    icoon: "datatype",
    stereotype: "«valueType»",
    shape: "class-box",
    kleur: "#dcfce7",
    properties: [KLEUR_VELD],
    compartments: [{ id: "waarden", label: "values", fieldType: "waarde" }],
  },
  {
    id: "interfaceblok",
    label: "Interfaceblok",
    omschrijving: "«interfaceBlock» — wat er over een poort heen gaat.",
    kort: "IFB",
    icoon: "interface",
    stereotype: "«interfaceBlock»",
    shape: "class-box",
    kleur: "#e0f2fe",
    properties: [KLEUR_VELD],
    compartments: [{ id: "waarden", label: "flow properties", fieldType: "waarde" }],
  },
  {
    id: "constraintblok",
    label: "Constraintblok",
    omschrijving: "«constraint» — een vergelijking met parameters (basis voor parametrics).",
    kort: "CON",
    icoon: "constraint",
    stereotype: "«constraint»",
    shape: "class-box",
    kleur: "#fef3c7",
    properties: [KLEUR_VELD],
    compartments: [
      { id: "constraints", label: "constraints", fieldType: "constraint" },
      { id: "parameters", label: "parameters", fieldType: "waarde" },
    ],
  },
  {
    id: "enumeratie",
    label: "Enumeratie",
    omschrijving: "«enumeration» — een vaste verzameling waarden.",
    kort: "ENUM",
    icoon: "enumeratie",
    stereotype: "«enumeration»",
    shape: "class-box",
    kleur: "#fef9c3",
    properties: [KLEUR_VELD],
    compartments: [{ id: "literals", label: null, fieldType: "literal" }],
  },
  {
    id: "requirement",
    label: "Requirement",
    omschrijving: "Een eis met id en tekst; koppel hem met satisfy/verify/derive/refine/trace.",
    kort: "REQ",
    icoon: "sy-requirement",
    shape: "sysml-requirement",
    kleur: "#ede9fe",
    // Samengestelde requirement: kinderen erin slepen legt de containment.
    containerVoor: "bevat-req",
    properties: [
      { key: "reqId", label: "id", datatype: "string" },
      { key: "tekst", label: "tekst", datatype: "tekst" },
      KLEUR_VELD,
    ],
  },
  {
    id: "pakket",
    label: "Pakket",
    omschrijving: "Groepeert blokken en requirements.",
    kort: "PKG",
    icoon: "package",
    shape: "package",
    containerVoor: "bevat-pakket",
    properties: [KLEUR_VELD],
  },
  {
    id: "notitie",
    label: "Notitie",
    omschrijving: "Vrije notitie op het diagram.",
    kort: "NOT",
    icoon: "notitie",
    shape: "note",
    handleStijl: "onzichtbaar",
    properties: [{ key: "tekst", datatype: "tekst" }, KLEUR_VELD],
  },

  // ── Connectoren ────────────────────────────────────────────────────────
  {
    id: "compositie",
    label: "Compositie",
    omschrijving: "Het geheel bezit de delen; delen gaan mee als het geheel verdwijnt.",
    kort: "◆",
    icoon: "compositie",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["blok"] },
    doel: { elementTypes: BLOKKEN },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerStart: "ruit" },
  },
  {
    id: "aggregatie",
    label: "Aggregatie",
    omschrijving: "Het geheel gebruikt de delen, maar bezit ze niet.",
    kort: "◇",
    icoon: "aggregatie",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["blok"] },
    doel: { elementTypes: BLOKKEN },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerStart: "ruit-open" },
  },
  {
    id: "generalisatie",
    label: "Generalisatie",
    omschrijving: "Het specifieke blok erft van het algemene (bron = specifiek).",
    kort: "▷",
    icoon: "generalisatie",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: BLOKKEN },
    doel: { elementTypes: BLOKKEN },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "driehoek" },
  },
  {
    id: "associatie",
    label: "Associatie",
    omschrijving: "Een verband tussen blokken; kardinaliteit per uiteinde.",
    kort: "—",
    icoon: "associatie",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: BLOKKEN },
    doel: { elementTypes: BLOKKEN },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569" },
    properties: [
      { key: "bronKardinaliteit", label: "kardinaliteit (bron)", datatype: "string" },
      { key: "doelKardinaliteit", label: "kardinaliteit (doel)", datatype: "string" },
    ],
    hooks: {
      edgeLabels: (conn) => {
        const d = conn.data || {};
        const kaal = [];
        if (d.bronKardinaliteit) kaal.push({ zijde: "bron", delen: [{ tekst: d.bronKardinaliteit, soort: "kardinaliteit" }] });
        if (d.doelKardinaliteit) kaal.push({ zijde: "doel", delen: [{ tekst: d.doelKardinaliteit, soort: "kardinaliteit" }] });
        return { kaal };
      },
    },
  },
  {
    id: "afhankelijkheid",
    label: "Afhankelijkheid",
    omschrijving: "De bron gebruikt het doel; verandert het doel, dan raakt dat de bron.",
    kort: "⇢",
    icoon: "dependency",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: [...BLOKKEN, "pakket"] },
    doel: { elementTypes: [...BLOKKEN, "pakket"] },
    edgePresentatie: { lijn: "dash-4-3", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
  },
  {
    id: "trace",
    label: "Traceerrelatie",
    omschrijving: "satisfy · verify · deriveReqt · refine · trace — kies de soort in de inspector.",
    kort: "«t»",
    icoon: "sy-trace",
    shape: "edge",
    isConnector: true,
    // Van ontwerp/test náár de requirement — de SysML-richting.
    bron: { elementTypes: [...BLOKKEN, "part", "requirement", "pakket"] },
    doel: { elementTypes: ["requirement"] },
    edgePresentatie: { lijn: "dash-4-3", vorm: "hoekig", kleur: "#7c3aed", markerEnd: "pijl-open" },
    properties: [{ key: "soort", label: "soort", datatype: "keuze", opties: TRACE_OPTIES }],
    hooks: { edgeLabels: traceLabels },
  },
  {
    id: "verbinding",
    label: "Connector (ibd)",
    omschrijving: "Verbindt twee poorten (of parts) binnen een blok.",
    kort: "↔",
    icoon: "sy-verbinding",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["poort", "part"] },
    doel: { elementTypes: ["poort", "part"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#334155" },
  },
  {
    id: "itemflow",
    label: "Item flow",
    omschrijving: "Wat er over een connector stroomt; de naam is het item.",
    kort: "▸",
    icoon: "sy-itemflow",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["poort", "part"] },
    doel: { elementTypes: ["poort", "part"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#0f766e", markerEnd: "pijl-dicht" },
  },
  {
    // Requirement-containment: ⊕ aan de kant van de samengestelde requirement.
    id: "bevat-req",
    label: "Bevat (requirement)",
    omschrijving: "Deelrequirement van een samengestelde requirement.",
    kort: "REQ ⊕",
    icoon: "sy-bevat-req",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["requirement"] },
    doel: { elementTypes: ["requirement"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#7c3aed", markerStart: "kruis-cirkel" },
  },
  {
    id: "bevat-part",
    label: "Bevat (part)",
    omschrijving: "Lidmaatschap van een blok-frame (ibd); verborgen zolang het lid erin ligt.",
    kort: "BLK ∋",
    icoon: "sy-bevat-part",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: IBD_HOUDERS },
    doel: { elementTypes: ["part", "notitie"] },
    edgePresentatie: { lijn: "dash-4-3", vorm: "hoekig", kleur: "#cbd5e1", verbergBijNesting: true },
  },
  {
    id: "bevat-pakket",
    label: "Bevat (pakket)",
    omschrijving: "Lidmaatschap van een pakket; verborgen zolang het lid erin ligt.",
    kort: "PKG ∋",
    icoon: "bevat",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["pakket"] },
    doel: { elementTypes: [...BLOKKEN, "requirement", "pakket", "notitie"] },
    edgePresentatie: { lijn: "dash-4-3", vorm: "hoekig", kleur: "#cbd5e1", verbergBijNesting: true },
  },
];

export const sysmlDiagramType = {
  id: SYSML_ID,
  label: "SysML",
  style: "uml-klassiek",
  // Connectoren hechten aan de omtrek i.p.v. aan vier handles: dozen
  // dragen vaak veel lijnen, en die moeten kunnen uitwaaieren.
  randAanhechting: "zwevend",
  fieldTypes,
  elementTypes,
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
  ],
  layouts: [],
};

let _teller = 0;

/** Nieuw (niet-connector-)element van het gegeven type. */
export function maakElement(elementTypeId) {
  const et = elementTypes.find((t) => t.id === elementTypeId);
  if (!et || et.isConnector) return null;
  _teller += 1;
  const element = {
    id: `sy_${Date.now()}_${_teller}`,
    naam: et.label,
    elementType: et.id,
    compartimenten: [],
    data: {},
  };
  if (et.id === "notitie") {
    element.naam = "";
    element.data.tekst = "";
  }
  // Een poort is klein en naamloos tot je hem benoemt (zoals BPMN-events).
  if (et.id === "poort") element.naam = "";
  if (et.id === "requirement") element.data.reqId = "";
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerSysml() {
  registreerSysmlShapes();
  registreerSysmlIconen();
  if (!getDiagramType(SYSML_ID)) {
    registreerDiagramType(sysmlDiagramType);
  }
}
