// @ts-check
/**
 * statemachine — een UML state machine-profiel op de generieke diagram-motor.
 *
 * v0 (metamodel-verkenning gedragsdiagrammen, sessie 2026-07-13): begin,
 * toestand (met entry/do/exit-activiteiten), eind en transitie ("trigger
 * [guard] / effect"). v1 (sessie 2026-07-17) vult de bekende gaten met de
 * twee gedragsdiagram-primitieven uit STUDIO-05-gedragsdiagrammen.md:
 *
 *   - **keuze** (choice, ruit), **junction** (stip) en **historie** (Ⓗ/Ⓗ*,
 *     `data.diep`) — vrije pseudostates, pure declaratie;
 *   - **samengestelde toestand** — container (containerVoor "bevat", zoals
 *     packages in het canoniek model): toestanden erin slepen legt het
 *     bevat-lidmaatschap;
 *   - **submachine** — gedragsverwijzing (§3.2): `data.gedragDiagramId`
 *     verwijst naar een ander state machine-diagram; dubbelklik opent het
 *     (⧉-badge op de node);
 *   - **entry/exit-point** — rand-elementen (§3.1): ze klikken vast op de
 *     omtrek van een (samengestelde/submachine-)toestand en bewegen mee.
 *
 * De verbindingsregels leggen de basisvalidatie vast: begin heeft geen
 * inkomende transitie, eind geen uitgaande. Entry/exit zijn bewust zowel
 * bron als doel (buiten→entry→binnen, binnen→exit→buiten); strakkere
 * richtingsvalidatie is een taak voor de validatie-hook (bekende todo).
 * Regio's (parallelle deelmachines) blijven open — dat vraagt lane-layout.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerGedragTypeIconen } from "../gedragTypeIconen.jsx";
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

// Wat kan een transitie verlaten/bereiken. Begin alleen bron, eind alleen
// doel; de pseudostates en (samengestelde/submachine-)toestanden allebei.
const TUSSEN = ["toestand", "composiet", "submachine", "keuze", "junction", "historie", "entry", "exit"];
const BRONNEN = ["begin", ...TUSSEN];
const DOELEN = [...TUSSEN, "eind"];

/** Rand-elementen (§3.1) wonen op de rand van deze gastheren. */
const RAND_OUDERS = ["toestand", "composiet", "submachine"];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "begin",
    label: "Begin",
    omschrijving: "Startpunt van de machine — alleen uitgaande transities.",
    kort: "Begin",
    icoon: "gedrag-begin",
    shape: "sm-begin",
    naamLabel: "buiten",
    resizebaar: false,
    properties: [],
  },
  {
    id: "toestand",
    label: "Toestand",
    omschrijving: "Toestand van het systeem, met entry/do/exit-activiteiten.",
    kort: "TS",
    icoon: "gedrag-toestand",
    shape: "rounded",
    kleur: "#fef9c3",
    properties: [KLEUR_VELD],
    // entry/do/exit als vrije activiteiten-regels (bv. "entry / licht aan").
    compartments: [{ id: "activiteiten", label: null, fieldType: "activiteit" }],
  },
  {
    id: "eind",
    label: "Eind",
    omschrijving: "Eindtoestand: de machine is klaar — alleen inkomende transities.",
    kort: "Eind",
    icoon: "gedrag-eind",
    shape: "sm-eind",
    naamLabel: "buiten",
    resizebaar: false,
    properties: [],
  },
  {
    id: "composiet",
    label: "Samengestelde toestand",
    omschrijving: "Samengestelde toestand: sleep deel-toestanden erin.",
    kort: "Comp",
    icoon: "gedrag-composiet",
    shape: "sm-composiet",
    // Container zoals een package: toestanden erin slepen legt "bevat".
    containerVoor: "bevat",
    achtergrond: true,
    properties: [KLEUR_VELD],
  },
  {
    id: "submachine",
    label: "Submachine",
    omschrijving: "Verwijst naar een andere state machine; dubbelklik opent het diagram.",
    kort: "Subm",
    icoon: "gedrag-submachine",
    shape: "rounded",
    kleur: "#e0e7ff",
    // Gedragsverwijzing (§3.2): verwijst naar een ander SM-diagram;
    // dubbelklik opent het (de node toont een ⧉-badge).
    gedragsVerwijzing: true,
    properties: [
      { key: "gedragDiagramId", label: "verwijst naar", datatype: "diagram-verwijzing" },
      KLEUR_VELD,
    ],
  },
  {
    id: "keuze",
    label: "Keuze",
    omschrijving: "Dynamische keuze: guards bepalen welke uitgaande transitie volgt.",
    kort: "Keuze",
    icoon: "gedrag-ruit",
    shape: "sm-keuze",
    naamLabel: "buiten",
    resizebaar: false,
    properties: [],
  },
  {
    id: "junction",
    label: "Junction",
    omschrijving: "Statisch knooppunt om transities samen te voegen of te splitsen.",
    kort: "Junctie",
    icoon: "gedrag-junction",
    shape: "sm-junction",
    naamLabel: "buiten",
    resizebaar: false,
    properties: [],
  },
  {
    id: "historie",
    label: "Historie",
    omschrijving: "Herinnert de laatst actieve deel-toestand (H; vinkje 'diep' = H*).",
    kort: "Hist",
    icoon: "gedrag-historie",
    shape: "sm-historie",
    naamLabel: "buiten",
    resizebaar: false,
    // diep = H* (herstelt de volledige geneste configuratie).
    properties: [{ key: "diep", label: "diep (H*)", datatype: "boolean" }],
  },
  {
    id: "entry",
    label: "Entry-point",
    omschrijving: "Entry-point: sleep hem op de rand van een toestand — nette binnenkomst.",
    kort: "Entry",
    icoon: "gedrag-entry",
    shape: "sm-entry",
    naamLabel: "buiten",
    resizebaar: false,
    // Rand-element (§3.1): klikt vast op de omtrek van een toestand.
    randElement: { ouderTypes: RAND_OUDERS },
    properties: [],
  },
  {
    id: "exit",
    label: "Exit-point",
    omschrijving: "Exit-point: sleep hem op de rand van een toestand — nette uitgang.",
    kort: "Exit",
    icoon: "gedrag-exit",
    shape: "sm-exit",
    naamLabel: "buiten",
    resizebaar: false,
    randElement: { ouderTypes: RAND_OUDERS },
    properties: [],
  },
  {
    id: "notitie",
    label: "Notitie",
    omschrijving: "Vrije notitie op het diagram.",
    kort: "NOT",
    shape: "note",
    handleStijl: "onzichtbaar",
    properties: [{ key: "tekst", datatype: "tekst" }, KLEUR_VELD],
  },

  // ── Connectoren ────────────────────────────────────────────────────────
  {
    id: "transitie",
    label: "Transitie",
    omschrijving: "Overgang tussen toestanden: trigger [guard] / effect.",
    kort: "→",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: BRONNEN },
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
  {
    // Lidmaatschap van een samengestelde toestand — subtiele stippellijn,
    // zelfde patroon als "Bevat (package)" in het canoniek model. Meestal
    // is de lijn visueel overbodig (het kind ligt ín de container).
    id: "bevat",
    label: "Bevat (toestand)",
    omschrijving: "Lidmaatschap van een samengestelde toestand (verborgen zolang het lid erin ligt).",
    kort: "⊞ ∋",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["composiet"] },
    doel: { elementTypes: ["begin", "eind", ...TUSSEN, "notitie"] },
    edgePresentatie: { lijn: "dash-4-3", vorm: "hoekig", kleur: "#cbd5e1", verbergBijNesting: true },
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
  const NAAMLOOS = new Set(["begin", "eind", "keuze", "junction", "historie", "entry", "exit", "notitie"]);
  const element = {
    id: `sm_${Date.now()}_${_teller}`,
    naam: NAAMLOOS.has(et.id) ? "" : et.label,
    elementType: et.id,
    compartimenten: [],
    data: {},
  };
  if (et.id === "notitie") element.data.tekst = "";
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerStateMachine() {
  registreerGedragTypeIconen();
  registreerStateMachineShapes();
  if (!getDiagramType(STATEMACHINE_ID)) {
    registreerDiagramType(statemachineDiagramType);
  }
}
