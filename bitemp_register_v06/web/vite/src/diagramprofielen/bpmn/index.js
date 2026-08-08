// @ts-check
/**
 * bpmn — een BPMN-profiel op de generieke diagram-motor (v0, sessie
 * 2026-07-17). Naast de bestaande bpmn.io-activiteit ("BPMN-processen");
 * dit profiel tekent op de eigen motor en deelt dus projectboom,
 * kruisverbanden, export en de twee gedragsdiagram-primitieven.
 *
 * Uit de verkenning (STUDIO-05-gedragsdiagrammen §4): BPMN = Activity-core
 * + event/port-mechanisme (+ collaboration-laag). v0 dekt de eerste twee:
 *
 *   - **taak** en **subproces** (gedragsverwijzing §3.2: dubbelklik opent
 *     het onderliggende procesdiagram — call activity/sub-process);
 *   - **events**: start (dunne ring), tussen (dubbele ring), eind (dikke
 *     ring) met `soort` (bericht/timer/fout/signaal, datatype "keuze");
 *   - **boundary event** — rand-element (§3.1) op taak/subproces;
 *     `onderbrekend` (uit → gestippelde ring, niet-onderbrekend);
 *   - **gateways**: exclusief (×), parallel (+), inclusief (○) — de
 *     inclusive-join-semantiek is bewust alleen notatie (bekende gap);
 *   - **lane** als container; **pools + message flow als collaboration-
 *     laag blijven buiten v0** (zie het notatie-plan) — de message flow
 *     is er alvast, permissief;
 *   - **data-object** met gestippelde data-associatie;
 *   - **default flow** (`data.standaard` op een sequence flow → schuin
 *     streepje ná de bron, via `hooks.edgePresentatie`).
 *
 * De elementtype-**labels** volgen bewust de Engelse BPMN-termen (Task,
 * Sub-process, Start/Intermediate/End event, Gateway, Lane, Data object,
 * Sequence flow) — die kent de doelgroep. De omschrijvingen blijven
 * Nederlands. De `id`'s zijn ongemoeid gelaten: die staan als `elementType`
 * in opgeslagen diagrammen en werkbestanden.
 *
 * Events en gateways dragen hun naam via het motor-primitief
 * `naamLabel: "buiten"` (ElementNode zet hem ónder de vorm) — een ring of ruit
 * kan zelf geen tekst dragen. Diagram-breed uit te zetten via Beeld →
 * Buitenlabels.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerGedragTypeIconen } from "../gedragTypeIconen.jsx";
import { registreerBpmnShapes } from "./shapes.jsx";
import { sequenceFlowPresentatie, sequenceFlowLabels } from "./sequenceFlow.js";

export const BPMN_ID = "bpmn-motor";

const KLEUR_VELD = { key: "kleur", datatype: "colour" };

/** Event-soorten (datatype "keuze"). */
const SOORT_OPTIES = [
  { waarde: "", label: "(blanco)" },
  { waarde: "bericht", label: "bericht ✉" },
  { waarde: "timer", label: "timer ⏱" },
  { waarde: "fout", label: "fout ⚡" },
  { waarde: "signaal", label: "signaal △" },
];
const SOORT_VELD = { key: "soort", label: "soort", datatype: "keuze", opties: SOORT_OPTIES };

// Sequence flow: wat kan hem verlaten/bereiken. Start alleen bron, eind
// alleen doel; een boundary event alleen bron (het uitzonderingspad).
const ACTIVITEITEN = ["taak", "subproces"];
const GATEWAYS = ["exclusief", "parallel", "inclusief"];
const SEQ_BRONNEN = ["start-event", "tussen-event", "boundary-event", ...ACTIVITEITEN, ...GATEWAYS];
const SEQ_DOELEN = [...ACTIVITEITEN, ...GATEWAYS, "tussen-event", "eind-event"];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "start-event",
    label: "Start event",
    omschrijving: "Waar het proces begint; soort bepaalt de trigger (bericht, timer, …).",
    kort: "Start",
    icoon: "gedrag-entry",
    shape: "bpmn-event",
    naamLabel: "buiten",
    resizebaar: false,
    properties: [SOORT_VELD],
  },
  {
    id: "taak",
    label: "Task",
    omschrijving: "Eén stap werk in het proces.",
    kort: "Task",
    icoon: "gedrag-toestand",
    shape: "rounded",
    kleur: "#e0f2fe",
    properties: [KLEUR_VELD],
  },
  {
    id: "subproces",
    label: "Sub-process",
    omschrijving: "Samengevouwen deelproces; dubbelklik opent het onderliggende diagram.",
    kort: "Sub",
    icoon: "gedrag-submachine",
    shape: "bpmn-subproces",
    kleur: "#e0f2fe",
    gedragsVerwijzing: true,
    properties: [
      { key: "gedragDiagramId", label: "verwijst naar", datatype: "diagram-verwijzing" },
      KLEUR_VELD,
    ],
  },
  {
    id: "boundary-event",
    label: "Boundary event",
    omschrijving: "Sleep hem op de rand van een taak/subproces: vangt daar een gebeurtenis af. Vinkje 'onderbrekend' uit = gestippeld.",
    kort: "Bound",
    icoon: "gedrag-exit",
    shape: "bpmn-event",
    naamLabel: "buiten",
    resizebaar: false,
    // Rand-element (§3.1): woont op de rand van een activiteit.
    randElement: { ouderTypes: ACTIVITEITEN },
    properties: [SOORT_VELD, { key: "onderbrekend", label: "onderbrekend", datatype: "boolean" }],
  },
  {
    id: "tussen-event",
    label: "Intermediate event",
    omschrijving: "Gebeurtenis midden in de flow (wachten op bericht, timer, …).",
    kort: "Interm",
    icoon: "gedrag-historie",
    shape: "bpmn-event",
    naamLabel: "buiten",
    resizebaar: false,
    properties: [SOORT_VELD],
  },
  {
    id: "exclusief",
    label: "Exclusive gateway (XOR)",
    omschrijving: "Kies precies één uitgaande pad (condities op de flows).",
    kort: "XOR",
    icoon: "gedrag-gateway-xor",
    shape: "bpmn-gateway",
    naamLabel: "buiten",
    resizebaar: false,
    properties: [],
  },
  {
    id: "parallel",
    label: "Parallel gateway (AND)",
    omschrijving: "Splitst naar álle paden of wacht tot ze allemaal binnen zijn.",
    kort: "AND",
    icoon: "gedrag-gateway-and",
    shape: "bpmn-gateway",
    naamLabel: "buiten",
    resizebaar: false,
    properties: [],
  },
  {
    id: "inclusief",
    label: "Inclusive gateway (OR)",
    omschrijving: "Eén of méér paden, op basis van condities (join-semantiek: alleen notatie).",
    kort: "OR",
    icoon: "gedrag-gateway-or",
    shape: "bpmn-gateway",
    naamLabel: "buiten",
    resizebaar: false,
    properties: [],
  },
  {
    id: "data-object",
    label: "Data object",
    omschrijving: "Gegevens die het proces in- of uitgaan (koppel met een data-associatie).",
    kort: "Data",
    icoon: "gedrag-object",
    shape: "bpmn-data",
    resizebaar: false,
    properties: [],
  },
  {
    id: "lane",
    label: "Lane",
    omschrijving: "Wie of wat de taken uitvoert — sleep leden erin.",
    kort: "Lane",
    icoon: "gedrag-lane",
    shape: "bpmn-lane",
    containerVoor: "bevat",
    achtergrond: true,
    properties: [KLEUR_VELD],
  },
  {
    id: "eind-event",
    label: "End event",
    omschrijving: "Waar dit pad van het proces eindigt (dikke ring).",
    kort: "End",
    icoon: "gedrag-eind",
    shape: "bpmn-event",
    naamLabel: "buiten",
    resizebaar: false,
    properties: [SOORT_VELD],
  },
  {
    id: "notitie",
    label: "Text annotation",
    omschrijving: "Vrije notitie op het diagram.",
    kort: "Text",
    shape: "note",
    handleStijl: "onzichtbaar",
    properties: [{ key: "tekst", datatype: "tekst" }, KLEUR_VELD],
  },

  // ── Connectoren ────────────────────────────────────────────────────────
  {
    id: "sequence-flow",
    label: "Sequence flow",
    omschrijving: "De volgorde in het proces; optioneel met [conditie]. Vink 'default' aan voor het standaardpad (schuin streepje).",
    kort: "→",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: SEQ_BRONNEN },
    doel: { elementTypes: SEQ_DOELEN },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "pijl-dicht" },
    properties: [
      { key: "conditie", label: "conditie", datatype: "string" },
      { key: "standaard", label: "default flow", datatype: "boolean" },
    ],
    // Conditie-label en default flow: zie ./sequenceFlow.js (pure module,
    // zodat de logica testbaar blijft naast de shape-import hierboven).
    hooks: { edgePresentatie: sequenceFlowPresentatie, edgeLabels: sequenceFlowLabels },
  },
  {
    id: "message-flow",
    label: "Message flow",
    omschrijving: "Bericht tussen deelnemers (formeel tussen pools; v0 permissief).",
    kort: "✉→",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: [...ACTIVITEITEN, "start-event", "tussen-event", "eind-event", "boundary-event"] },
    doel: { elementTypes: [...ACTIVITEITEN, "start-event", "tussen-event"] },
    edgePresentatie: { lijn: "dash-4-3", vorm: "hoekig", kleur: "#64748b", markerStart: "bol", markerEnd: "pijl-open" },
  },
  {
    id: "data-associatie",
    label: "Data association",
    omschrijving: "Koppelt een data-object aan een taak (in- of output).",
    kort: "⇢D",
    shape: "edge",
    isConnector: true,
    verbindingsregels: [
      { bron: { elementTypes: ["data-object"] }, doel: { elementTypes: ACTIVITEITEN } },
      { bron: { elementTypes: ACTIVITEITEN }, doel: { elementTypes: ["data-object"] } },
    ],
    edgePresentatie: { lijn: "dash-4-4", vorm: "recht", kleur: "#94a3b8", markerEnd: "pijl-open" },
  },
  {
    id: "bevat",
    label: "Lane membership",
    omschrijving: "Lane-lidmaatschap; verborgen zolang het lid erin ligt.",
    kort: "LANE ∋",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["lane"] },
    doel: {
      elementTypes: ["start-event", "tussen-event", "eind-event", ...ACTIVITEITEN, ...GATEWAYS, "data-object", "lane", "notitie"],
    },
    edgePresentatie: { lijn: "dash-4-3", vorm: "hoekig", kleur: "#cbd5e1", verbergBijNesting: true },
  },
];

export const bpmnMotorDiagramType = {
  id: BPMN_ID,
  label: "BPMN",
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
  const NAAMLOOS = new Set([
    "start-event", "tussen-event", "eind-event", "boundary-event",
    "exclusief", "parallel", "inclusief", "notitie",
  ]);
  const element = {
    id: `bp_${Date.now()}_${_teller}`,
    naam: NAAMLOOS.has(et.id) ? "" : et.label,
    elementType: et.id,
    compartimenten: [],
    data: {},
  };
  if (et.id === "boundary-event") element.data.onderbrekend = true;
  if (et.id === "notitie") element.data.tekst = "";
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerBpmnMotor() {
  registreerGedragTypeIconen();
  registreerBpmnShapes();
  if (!getDiagramType(BPMN_ID)) {
    registreerDiagramType(bpmnMotorDiagramType);
  }
}
