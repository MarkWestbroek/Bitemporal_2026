// @ts-check
/**
 * formulier — de FormulierDefinitie-layout als diagramprofiel ("dogfood", F48 P1).
 *
 * De layout_json van een FormulierDefinitie is feitelijk een metamodel:
 * containers (formulier/groep/rij/lijst/conditioneel) met velden. Dit profiel
 * maakt dat modelleerbaar op de generieke motor, als *tweede control* op
 * hetzelfde model — de bestaande formulier-editor (palette/boom/preview)
 * blijft; het register blijft de bron van waarheid.
 *
 * Structuurkeuzes (zie docs/plans/2026-07-16 Formulier-profiel …):
 *   - Velden zijn compartiment-regels op hun container (zoals attribuutsoorten
 *     bij MIM); het `veldpad` (ENT.GE.veld) staat in de data → basis voor
 *     kruisverband-traces naar het canoniek model (P2).
 *   - Nesting van containers = `bevat`-connector (◆), zoals canoniek ENT ◆ GE.
 *   - Volgorde is betekenisvol in een formulier: compartiment-velden en
 *     `bevat`-connectoren dragen een `volgorde`-index in hun data zodat de
 *     serialisatie (P2) de formulier-volgorde kan reconstrueren.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { VORMEN } from "../../vormen/vormen.js";

export const FORMULIER_ID = "formulier";

const KLEUR_VELD = { key: "kleur", datatype: "colour" };

/**
 * vorm + vormConfig (formulier 3.0, ontwerp "Invoersoort en vorm" §9b): de vorm kiest uit de
 * vormenbibliotheek (src/vormen/vormen.js, dezelfde bron als renderer en inspector); de
 * vormConfig is JSON volgens het configSchema van die vorm. `widget` is de oude schrijfwijze.
 */
const VORM_OPTIES = [{ waarde: "", label: "standaard (uit het model)" },
  ...Object.entries(VORMEN).map(([naam, v]) => ({ waarde: naam, label: `${v.label} (${naam})` }))];
const VORM_VELDEN = [
  { key: "vorm", label: "vorm", datatype: "keuze", opties: VORM_OPTIES },
  { key: "vormConfig", label: "vormConfig (JSON)", datatype: "tekst", placeholder: '{ "image": "…", "areas": [ … ] }' },
];

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
const fieldTypes = [
  {
    id: "veld",
    viewer: "naam-type",
    properties: [
      { key: "veld", label: "veldpad", datatype: "string", verplicht: true },
      { key: "label", label: "label", datatype: "string" },
      { key: "breedte", label: "breedte", datatype: "string" },
      ...VORM_VELDEN,
      { key: "widget", label: "widget (verouderd; gebruik vorm)", datatype: "string" },
      { key: "readonly", label: "alleen-lezen", datatype: "boolean" },
      { key: "vasteWaarde", label: "vaste waarde (niet getoond; in een lijst óók filter)", datatype: "string" },
      { key: "kopieerNaar", label: "kopieer naar (vol pad)", datatype: "string" },
      { key: "nieuwFormulier", label: "nieuw-formulier (FD-id, relatie naar ENT)", datatype: "string" },
    ],
  },
];

/** Containertypes die kinderen (containers) mogen bevatten via `bevat`. */
const CONTAINERS = ["formulier", "groep", "rij", "lijst", "conditioneel"];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "formulier",
    label: "Formulier",
    kort: "FRM",
    shape: "rect",
    kleur: "#ddd6fe",
    properties: [
      { key: "doeltype", label: "doeltype (ENT)", datatype: "string" },
      { key: "status", label: "status", datatype: "string" },
      { key: "isStandaard", label: "standaard", datatype: "boolean" },
      { key: "definitieVersie", label: "definitie-versie", datatype: "string" },
      KLEUR_VELD,
    ],
    compartments: [{ id: "velden", label: null, fieldType: "veld" }],
  },
  {
    id: "groep",
    label: "Groep",
    kort: "GRP",
    shape: "rect",
    kleur: "#e0e7ff",
    properties: [{ key: "context", label: "pad-context", datatype: "string" }, ...VORM_VELDEN, KLEUR_VELD],
    compartments: [{ id: "velden", label: null, fieldType: "veld" }],
  },
  {
    id: "rij",
    label: "Rij",
    kort: "RIJ",
    shape: "rect",
    kleur: "#dbeafe",
    // F47: kolom-variant kan hier als richting-property landen.
    properties: [{ key: "richting", label: "richting (rij/kolom)", datatype: "string" }, KLEUR_VELD],
    compartments: [{ id: "velden", label: null, fieldType: "veld" }],
  },
  {
    id: "lijst",
    label: "Lijst",
    kort: "LST",
    shape: "rect",
    kleur: "#ccfbf1",
    properties: [
      { key: "bron", label: "bron (ENT.GE, meervoudig)", datatype: "string", verplicht: true },
      ...VORM_VELDEN,
      { key: "widget", label: "widget (verouderd: meerkeuze)", datatype: "string" },
      { key: "min", label: "min", datatype: "string" },
      { key: "max", label: "max", datatype: "string" },
      KLEUR_VELD,
    ],
    compartments: [{ id: "velden", label: null, fieldType: "veld" }],
  },
  {
    id: "conditioneel",
    label: "Conditioneel",
    kort: "ALS",
    shape: "rect",
    kleur: "#fef3c7",
    properties: [
      { key: "conditieVeld", label: "conditie: veld", datatype: "string" },
      { key: "conditieOp", label: "conditie: operator", datatype: "string" },
      { key: "conditieWaarde", label: "conditie: waarde", datatype: "string" },
      KLEUR_VELD,
    ],
    compartments: [{ id: "velden", label: null, fieldType: "veld" }],
  },
  {
    id: "notitie",
    label: "Notitie",
    kort: "NOT",
    shape: "note",
    handleStijl: "onzichtbaar",
    properties: [{ key: "tekst", datatype: "tekst" }, KLEUR_VELD],
  },

  // ── Connector: nesting (compositie-stijl) ────────────────────────────────
  {
    id: "bevat",
    label: "Bevat",
    kort: "◆",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: CONTAINERS },
    doel: { elementTypes: CONTAINERS.filter((t) => t !== "formulier") },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#64748b", markerStart: "ruit" },
    properties: [{ key: "volgorde", label: "volgorde", datatype: "string" }],
  },
];

export const formulierDiagramType = {
  id: FORMULIER_ID,
  label: "Formulier",
  style: "uml-klassiek",
  fieldTypes,
  elementTypes,
  hierarchie: ["bevat"],
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
    id: `frm_${Date.now()}_${_teller}`,
    naam: et.label,
    elementType: et.id,
    compartimenten: et.compartments ? [{ compartmentType: "velden", velden: [] }] : [],
    data: {},
  };
  if (et.id === "notitie") element.data.tekst = "";
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerFormulierProfiel() {
  if (!getDiagramType(FORMULIER_ID)) {
    registreerDiagramType(formulierDiagramType);
  }
}
