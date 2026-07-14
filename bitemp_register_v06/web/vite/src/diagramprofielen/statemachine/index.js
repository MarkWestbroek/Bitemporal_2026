// @ts-check
/**
 * statemachine — een UML state machine-profiel op de generieke diagram-motor
 * (metamodel-verkenning gedragsdiagrammen, sessie 2026-07-13: state machine
 * heeft het kleinste gat). v0:
 *
 *   - **Begin** (initiële pseudotoestand, gevulde stip)
 *   - **Toestand** (State, afgeronde box met activiteiten-compartiment:
 *     entry/do/exit)
 *   - **Eind** (finale toestand, ring met kern)
 *   - **Transitie** (gerichte lijn met trigger [guard] / effect als label)
 *
 * De verbindingsregels leggen de basisvalidatie vast: een transitie vertrekt
 * uit een begin of toestand en komt aan bij een toestand of eind (begin heeft
 * geen inkomende, eind geen uitgaande). Bewust nog niet (bekende gaten uit de
 * verkenning): samengestelde toestanden (containers), keuze/junction, regio's
 * en history — die vragen om lane-/container-layout en extra validatie.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerStateMachineShapes } from "./shapes.jsx";

export const STATEMACHINE_ID = "statemachine";

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
const fieldTypes = [
  {
    id: "activiteit",
    viewer: "waarde",
    properties: [{ key: "naam", label: "activiteit", datatype: "string", verplicht: true }],
  },
];

const KLEUR_VELD = { key: "kleur", datatype: "colour" };
const TOESTANDEN = ["begin", "toestand"];
const DOELEN = ["toestand", "eind"];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "begin",
    label: "Begin",
    kort: "●",
    shape: "sm-begin",
    resizebaar: false,
    properties: [],
  },
  {
    id: "toestand",
    label: "Toestand",
    kort: "TS",
    shape: "rounded",
    kleur: "#fef9c3",
    properties: [KLEUR_VELD],
    // entry/do/exit als vrije activiteiten-regels (bv. "entry / licht aan").
    compartments: [{ id: "activiteiten", label: null, fieldType: "activiteit" }],
  },
  {
    id: "eind",
    label: "Eind",
    kort: "◉",
    shape: "sm-eind",
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

  // ── Connector ──────────────────────────────────────────────────────────
  {
    id: "transitie",
    label: "Transitie",
    kort: "→",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: TOESTANDEN },
    doel: { elementTypes: DOELEN },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "pijl-open" },
    properties: [
      { key: "trigger", label: "trigger", datatype: "string" },
      { key: "guard", label: "guard", datatype: "string" },
      { key: "effect", label: "effect", datatype: "string" },
    ],
    hooks: {
      /** Label "trigger [guard] / effect" in het midden van de lijn. */
      edgeLabels: (conn) => {
        const d = conn.data || {};
        const delen = [];
        if (d.trigger) delen.push(d.trigger);
        if (d.guard) delen.push(`[${d.guard}]`);
        let tekst = delen.join(" ");
        if (d.effect) tekst = tekst ? `${tekst} / ${d.effect}` : `/ ${d.effect}`;
        if (!tekst) return {};
        // Kale connector (geen velden) → label in `kaal`, midden op de lijn.
        return { kaal: [{ zijde: "midden", delen: [{ tekst, soort: "constraint" }] }] };
      },
    },
  },
];

export const statemachineDiagramType = {
  id: STATEMACHINE_ID,
  label: "State machine",
  style: "uml-klassiek",
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
    id: `sm_${Date.now()}_${_teller}`,
    naam: et.id === "toestand" ? "Toestand" : "",
    elementType: et.id,
    compartimenten: [],
    data: {},
  };
  if (et.id === "notitie") element.data.tekst = "";
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerStateMachine() {
  registreerStateMachineShapes();
  if (!getDiagramType(STATEMACHINE_ID)) {
    registreerDiagramType(statemachineDiagramType);
  }
}
