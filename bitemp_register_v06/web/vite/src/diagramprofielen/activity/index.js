// @ts-check
/**
 * activity — een UML 2 activity-profiel op de generieke diagram-motor
 * (sessie 2026-07-17; volgende stap in de gedragslijn uit
 * STUDIO-05-gedragsdiagrammen.md, na state machine v1). Gebruikt beide
 * gedragsdiagram-primitieven:
 *
 *   - **pin** — rand-element (§3.1): in-/output-vierkantje dat vastklikt op
 *     de omtrek van een actie/aanroep en meebeweegt;
 *   - **aanroep** (CallBehaviorAction) — gedragsverwijzing (§3.2): verwijst
 *     naar een ander activity-diagram; dubbelklik opent het (⧉-badge);
 *   - **partitie** (swimlane) — container (containerVoor "bevat"): acties
 *     erin slepen legt het lidmaatschap ("uitgevoerd door"). Lidmaatschap
 *     is v1 een feit zonder lane-layout — de bekende container-gap.
 *
 * Verder: begin, eind (activity final), flow-eind (flow final), actie,
 * beslissing/samenvoeging (ruit), fork/join (balk, `data.verticaal`),
 * object node en notitie. Twee stromen: **controlestroom** (met
 * "[guard]"-label uit data.guard) en **objectstroom** (tussen
 * object/pin/actie — de object-flow-kant van pins).
 *
 * Bewuste v1-versimpelingen: geen interruptible regions, geen
 * expansion regions, geen gewichten; beslissing en samenvoeging zijn één
 * ruit-type (zoals gebruikelijk in de praktijk); fork en join zijn één
 * balk-type. Strakkere regels (bv. "één uitgaande controlestroom per
 * actie") zijn voor de validatie-hook.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerActivityShapes } from "./shapes.jsx";

export const ACTIVITY_ID = "activity";

const KLEUR_VELD = { key: "kleur", datatype: "colour" };

// Controlestroom: wat kan hem verlaten/bereiken. Begin alleen bron,
// (flow-)eind alleen doel; pins/objecten horen bij de objectstroom.
const CONTROLE_TUSSEN = ["actie", "aanroep", "beslissing", "fork"];
const CONTROLE_BRONNEN = ["begin", ...CONTROLE_TUSSEN];
const CONTROLE_DOELEN = [...CONTROLE_TUSSEN, "eind", "flow-eind"];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "begin",
    label: "Begin",
    kort: "●",
    shape: "act-begin",
    resizebaar: false,
    properties: [],
  },
  {
    id: "actie",
    label: "Actie",
    kort: "ACT",
    shape: "rounded",
    kleur: "#dbeafe",
    properties: [KLEUR_VELD],
  },
  {
    id: "aanroep",
    label: "Aanroep",
    kort: "⧉ACT",
    shape: "rounded",
    kleur: "#e0e7ff",
    // CallBehaviorAction (§3.2): verwijst naar een ander activity-diagram.
    gedragsVerwijzing: true,
    properties: [
      { key: "gedragDiagramId", label: "verwijst naar", datatype: "diagram-verwijzing" },
      KLEUR_VELD,
    ],
  },
  {
    id: "beslissing",
    label: "Beslissing/samenvoeging",
    kort: "◇",
    shape: "act-beslissing",
    resizebaar: false,
    properties: [],
  },
  {
    id: "fork",
    label: "Fork/join",
    kort: "▬",
    shape: "act-fork",
    resizebaar: false,
    // verticaal = staande balk (parallelle stromen naast elkaar).
    properties: [{ key: "verticaal", label: "verticaal", datatype: "boolean" }],
  },
  {
    id: "object",
    label: "Object",
    kort: "OBJ",
    shape: "act-object",
    kleur: "#f1f5f9",
    properties: [KLEUR_VELD],
  },
  {
    id: "pin",
    label: "Pin",
    kort: "▫",
    shape: "act-pin",
    resizebaar: false,
    // Rand-element (§3.1): klikt vast op de omtrek van een actie/aanroep.
    randElement: { ouderTypes: ["actie", "aanroep"] },
    properties: [],
  },
  {
    id: "partitie",
    label: "Partitie",
    kort: "LANE",
    shape: "act-partitie",
    // Swimlane als container: leden erin slepen legt "bevat".
    containerVoor: "bevat",
    achtergrond: true,
    properties: [KLEUR_VELD],
  },
  {
    id: "eind",
    label: "Eind",
    kort: "◉",
    shape: "act-eind",
    resizebaar: false,
    properties: [],
  },
  {
    id: "flow-eind",
    label: "Flow-eind",
    kort: "⊗",
    shape: "act-flow-eind",
    resizebaar: false,
    properties: [],
  },
  {
    id: "notitie",
    label: "Notitie",
    kort: "NOT",
    shape: "note",
    handleStijl: "onzichtbaar",
    properties: [{ key: "tekst", datatype: "tekst" }, KLEUR_VELD],
  },

  // ── Connectoren ────────────────────────────────────────────────────────
  {
    id: "controlestroom",
    label: "Controlestroom",
    kort: "→",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: CONTROLE_BRONNEN },
    doel: { elementTypes: CONTROLE_DOELEN },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "pijl-open" },
    properties: [{ key: "guard", label: "guard", datatype: "string" }],
    hooks: {
      /** "[guard]"-label midden op de lijn (bv. na een beslissing). */
      edgeLabels: (conn) => {
        const guard = conn.data?.guard;
        if (!guard) return {};
        return { kaal: [{ zijde: "midden", delen: [{ tekst: `[${guard}]`, soort: "constraint" }] }] };
      },
    },
  },
  {
    id: "objectstroom",
    label: "Objectstroom",
    kort: "⇢",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["actie", "aanroep", "object", "pin"] },
    doel: { elementTypes: ["actie", "aanroep", "object", "pin"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
    properties: [],
  },
  {
    // Partitie-lidmaatschap ("uitgevoerd door") — subtiele stippellijn;
    // het lid ligt visueel al ín de lane.
    id: "bevat",
    label: "Bevat (partitie)",
    kort: "LANE ∋",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["partitie"] },
    doel: {
      elementTypes: ["begin", "actie", "aanroep", "beslissing", "fork", "object", "eind", "flow-eind", "partitie", "notitie"],
    },
    edgePresentatie: { lijn: "dash-4-3", vorm: "hoekig", kleur: "#cbd5e1" },
  },
];

export const activityDiagramType = {
  id: ACTIVITY_ID,
  label: "Activity",
  style: "uml-klassiek",
  fieldTypes: [],
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
  const NAAMLOOS = new Set(["begin", "eind", "flow-eind", "beslissing", "fork", "pin", "notitie"]);
  const element = {
    id: `act_${Date.now()}_${_teller}`,
    naam: NAAMLOOS.has(et.id) ? "" : et.label,
    elementType: et.id,
    compartimenten: [],
    data: {},
  };
  if (et.id === "notitie") element.data.tekst = "";
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerActivity() {
  registreerActivityShapes();
  if (!getDiagramType(ACTIVITY_ID)) {
    registreerDiagramType(activityDiagramType);
  }
}
