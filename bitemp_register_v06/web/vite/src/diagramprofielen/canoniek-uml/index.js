// @ts-check
/**
 * canoniek-uml — het eerste diagramprofiel: het canonieke datamodel
 * (Entiteit, GE, REL, enumeraties, …) als DiagramType-configuratie.
 *
 * Fase 1: read-only spiegel (adapter.js beeldt useModelStore af).
 * Fase 2: bewerken — `fieldTypes` hebben editor-regels (gegenereerde
 * inspector), er zijn kale **connector-typen** (compositie, generalisatie,
 * «use») met verbindingsregels en `edgePresentatie`, en `taakbalken`
 * beschrijft de "Maken"- en "Verbinding"-balken.
 *
 * Let op: `relatie` en `associatieAnker` staan hier nog als gewone
 * (node-)elementen, omdat de gespiegelde diagrammen de gematerialiseerde
 * ASOC-vorm bevatten. Bij de connector-materialisatie in fase 3 wordt
 * `relatie` een echt `isConnector`-type en verdwijnt het anker.
 *
 * Kleuren komen overeen met defaultKleur() in umleditor/metamodel/types.js.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";

export const CANONIEK_UML_ID = "canoniek-uml";

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
const fieldTypes = [
  {
    id: "attribuut",
    render: "naam-type",
    editor: [
      { key: "naam", widget: "text", verplicht: true },
      { key: "typeLabel", label: "type", widget: "select", opties: "veldtypen" },
      { key: "verplicht", widget: "checkbox" },
      { key: "afgeleid", widget: "checkbox" },
    ],
  },
  {
    id: "afgeleidVeld",
    render: "naam-type",
    editor: [
      { key: "naam", widget: "text", verplicht: true },
      { key: "typeLabel", label: "type", widget: "select", opties: "veldtypen" },
    ],
  },
  {
    id: "waarde",
    render: "waarde",
    editor: [{ key: "naam", label: "waarde", widget: "text", verplicht: true }],
  },
  {
    id: "eigenschap",
    render: "naam-type",
    editor: [
      { key: "naam", widget: "text", verplicht: true },
      { key: "typeLabel", label: "waarde", widget: "text" },
    ],
  },
  {
    id: "regel",
    render: "tekst",
    editor: [{ key: "naam", label: "regel", widget: "text", verplicht: true }],
  },
];

/** Gedeeld inspector-dataveld: achtergrondkleur (colorpicker). */
const KLEUR_VELD = { key: "kleur", widget: "kleur" };

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "entiteit",
    label: "Entiteit",
    kort: "ENT",
    stereotype: "«entiteit»",
    shape: "class-box",
    kleur: "#bfdbfe",
    dataVelden: [KLEUR_VELD],
    compartments: [
      { id: "velden", label: null, fieldType: "attribuut" },
      { id: "afgeleid", label: null, fieldType: "afgeleidVeld" },
      { id: "overerving", label: null, fieldType: "attribuut" },
    ],
  },
  {
    id: "gegevenselement",
    label: "Gegevenselement",
    kort: "GE",
    stereotype: "«gegevenselement»",
    shape: "class-box",
    kleur: "#bbf7d0",
    dataVelden: [KLEUR_VELD],
    compartments: [
      { id: "velden", label: null, fieldType: "attribuut" },
      { id: "afgeleid", label: null, fieldType: "afgeleidVeld" },
    ],
  },
  {
    id: "relatie",
    label: "Relatie",
    kort: "REL",
    stereotype: "«relatie»",
    shape: "class-box",
    kleur: "#ede9fe",
    dataVelden: [KLEUR_VELD],
    compartments: [
      { id: "velden", label: null, fieldType: "attribuut" },
      { id: "afgeleid", label: null, fieldType: "afgeleidVeld" },
    ],
  },
  {
    id: "associatieAnker",
    label: "Associatie-anker",
    shape: "anker",
    handleStijl: "onzichtbaar",
    resizebaar: false,
  },
  {
    id: "enumeratie",
    label: "Enumeratie",
    kort: "ENUM",
    stereotype: "«enumeratie»",
    shape: "class-box",
    kleur: "#fef3c7",
    dataVelden: [KLEUR_VELD],
    compartments: [{ id: "waarden", label: null, fieldType: "waarde" }],
  },
  {
    id: "gegevenstype",
    label: "Gegevenstype",
    kort: "TYPE",
    stereotype: "«gegevenstype»",
    shape: "class-box",
    kleur: "#dbeafe",
    dataVelden: [KLEUR_VELD],
    compartments: [
      { id: "eigenschappen", label: null, fieldType: "eigenschap" },
      { id: "validatie", label: null, fieldType: "regel" },
      { id: "weergave", label: null, fieldType: "regel" },
    ],
  },
  {
    id: "referentielijstInstantie",
    label: "Referentielijst-instantie",
    kort: "REF",
    stereotype: "«instantie»",
    shape: "class-box",
    kleur: "#fde68a",
    dataVelden: [KLEUR_VELD],
    compartments: [{ id: "eigenschappen", label: null, fieldType: "eigenschap" }],
  },
  {
    id: "notitie",
    label: "Notitie",
    kort: "NOT",
    shape: "note",
    handleStijl: "onzichtbaar",
    dataVelden: [{ key: "tekst", widget: "textarea" }, KLEUR_VELD],
  },
  {
    id: "constraint",
    label: "Constraint",
    kort: "CON",
    stereotype: "«constraint»",
    shape: "rounded",
    kleur: "#e0f2fe",
    handleStijl: "onzichtbaar",
    dataVelden: [{ key: "expressie", widget: "textarea" }, KLEUR_VELD],
  },

  // ── Connector-typen (fase 2: kale edges; ASOC-materialisatie volgt in fase 3) ──
  {
    id: "compositie",
    label: "Compositie",
    kort: "◆",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["entiteit"] },
    doel: { elementTypes: ["gegevenselement"] },
    edgePresentatie: { lijn: "solid", kleur: "#64748b", markerStart: "ruit" },
  },
  {
    id: "generalisatie",
    label: "Generalisatie",
    kort: "▷",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["entiteit"] },
    doel: { elementTypes: ["entiteit"] },
    edgePresentatie: {
      lijn: "solid",
      kleur: "#475569",
      markerEnd: "driehoek",
      labels: [
        { zijde: "midden", delen: [{ tekst: "«Generalisatie»", soort: "constraint", kleur: "#0d9488" }] },
      ],
    },
  },
  {
    id: "gebruik",
    label: "Gebruik («use»)",
    kort: "use",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["entiteit", "gegevenselement", "relatie"] },
    doel: { elementTypes: ["enumeratie", "gegevenstype", "referentielijstInstantie"] },
    edgePresentatie: {
      lijn: "dash-6-3",
      kleur: "#64748b",
      markerEnd: "pijl-open",
      labels: [{ zijde: "midden", delen: [{ tekst: "«use»", soort: "constraint", kleur: "#7c3aed" }] }],
    },
  },
];

/**
 * VerwijzingsBronnen (plan §4.5b) — kandidaat-leveranciers voor het
 * attribuuttype. Iconen volgen de oude editor: ✦ gegevenstype, ◇ enumeratie,
 * ▣ ref.lijstitem. Elke bron levert kandidaten met groep (optgroup nu,
 * boom-niveau in de minibrowser later) en pad (domein/package).
 * @type {import("../../diagramcore/types/schema.js").VerwijzingsBron[]}
 */
const verwijzingsBronnen = [
  {
    id: "basistype",
    label: "Basistypen",
    kandidaten: () =>
      ["string", "integer", "number", "boolean", "date", "date-time"].map((t) => ({
        waarde: t,
        label: t,
        groep: "Basistypen",
      })),
  },
  {
    id: "gegevenstype",
    label: "Gegevenstypen",
    icoon: "✦",
    kandidaten: ({ elements }) =>
      Object.values(elements || {})
        .filter((el) => el.elementType === "gegevenstype" && el.naam)
        .map((el) => ({ waarde: el.naam, label: el.naam, icoon: "✦", groep: "Gegevenstypen", pad: [el.data?.domein || ""] }))
        .sort((a, b) => a.label.localeCompare(b.label)),
  },
  {
    id: "enumeratie",
    label: "Enumeraties",
    icoon: "◇",
    kandidaten: ({ elements }) =>
      Object.values(elements || {})
        .filter((el) => el.elementType === "enumeratie" && el.naam)
        .map((el) => ({ waarde: el.naam, label: el.naam, icoon: "◇", groep: "Enumeraties", pad: [el.data?.domein || ""] }))
        .sort((a, b) => a.label.localeCompare(b.label)),
  },
  {
    id: "refitem",
    label: "Referentielijst-items",
    icoon: "▣",
    kandidaten: ({ elements }) =>
      Object.values(elements || {})
        .filter(
          (el) => el.elementType === "entiteit" && el.data?.stereotype === "«ref.lijst item»" && el.naam
        )
        .map((el) => ({ waarde: el.naam, label: `${el.naam} (ref.lijst)`, icoon: "▣", groep: "Referentielijst-items", pad: [el.data?.domein || ""] }))
        .sort((a, b) => a.label.localeCompare(b.label)),
  },
];

/** @type {import("../../diagramcore/types/schema.js").DiagramType} */
export const canoniekUmlDiagramType = {
  id: CANONIEK_UML_ID,
  label: "Canoniek datamodel",
  style: "uml-klassiek",
  elementTypes,
  fieldTypes,
  verwijzingsBronnen,
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
  ],
};

let _teller = 0;

/**
 * Fabriek voor een nieuw (leeg) element van het gegeven type.
 * @param {string} elementTypeId
 * @returns {import("../../diagramcore/model/schema.js").Element|null}
 */
export function maakElement(elementTypeId) {
  const et = elementTypes.find((t) => t.id === elementTypeId);
  if (!et || et.isConnector) return null;
  _teller += 1;
  const id = `el_${Date.now()}_${_teller}`;
  const element = {
    id,
    naam: `Nieuw${et.label.replace(/[^A-Za-z]/g, "")}`,
    elementType: et.id,
    compartimenten: [],
    data: {},
  };
  if (et.id === "notitie") {
    element.naam = "";
    element.data.tekst = "";
  }
  if (et.id === "constraint") element.data.expressie = "";
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerCanoniekUml() {
  if (!getDiagramType(CANONIEK_UML_ID)) {
    registreerDiagramType(canoniekUmlDiagramType);
  }
  return canoniekUmlDiagramType;
}
