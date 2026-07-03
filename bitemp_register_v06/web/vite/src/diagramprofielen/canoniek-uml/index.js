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

/**
 * FieldTypes met hun PropertyTypes (metamodel, vierde iteratie): declaratief
 * {key, datatype, referenceTypes?}; de widget volgt uit de datatype-registry.
 * `TYPE_REFS` = de vier soorten kandidaten voor een attribuuttype.
 */
const TYPE_REFS = ["basistype", "gegevenstype", "enumeratie", "refitem"];

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
const fieldTypes = [
  {
    id: "attribuut",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "type", referenceTypes: TYPE_REFS },
      { key: "verplicht", datatype: "boolean" },
      { key: "afgeleid", datatype: "boolean" },
    ],
  },
  {
    id: "afgeleidVeld",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "type", referenceTypes: TYPE_REFS },
      { key: "afleidingsregel", label: "afleidingsregel (CEL)", datatype: "cel-expressie" },
    ],
  },
  {
    id: "waarde",
    viewer: "waarde",
    properties: [{ key: "naam", label: "waarde", datatype: "string", verplicht: true }],
  },
  {
    id: "eigenschap",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "waarde", datatype: "string" },
    ],
  },
  {
    id: "regel",
    viewer: "tekst",
    properties: [{ key: "naam", label: "regel", datatype: "string", verplicht: true }],
  },
];

/** Gedeelde element-PropertyType: achtergrondkleur (datatype "colour"). */
const KLEUR_VELD = { key: "kleur", datatype: "colour" };

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "entiteit",
    label: "Entiteit",
    kort: "ENT",
    stereotype: "«entiteit»",
    shape: "class-box",
    kleur: "#bfdbfe",
    properties: [KLEUR_VELD],
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
    properties: [KLEUR_VELD],
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
    properties: [KLEUR_VELD],
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
    properties: [KLEUR_VELD],
    compartments: [{ id: "waarden", label: null, fieldType: "waarde" }],
  },
  {
    id: "gegevenstype",
    label: "Gegevenstype",
    kort: "TYPE",
    stereotype: "«gegevenstype»",
    shape: "class-box",
    kleur: "#dbeafe",
    properties: [KLEUR_VELD],
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
    properties: [KLEUR_VELD],
    compartments: [{ id: "eigenschappen", label: null, fieldType: "eigenschap" }],
  },
  {
    id: "notitie",
    label: "Notitie",
    kort: "NOT",
    shape: "note",
    handleStijl: "onzichtbaar",
    properties: [{ key: "tekst", datatype: "tekst" }, KLEUR_VELD],
  },
  {
    id: "constraint",
    label: "Constraint",
    kort: "CON",
    stereotype: "«constraint»",
    shape: "rounded",
    kleur: "#e0f2fe",
    handleStijl: "onzichtbaar",
    properties: [{ key: "expressie", label: "expressie (OCL/CEL)", datatype: "cel-expressie" }, KLEUR_VELD],
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
 * ReferenceTypes (declaratief) + ReferenceResolvers (implementatie) —
 * metamodel §4.5b. Iconen volgen de oude editor: ✦ gegevenstype,
 * ◇ enumeratie, ▣ ref.lijstitem. Elke resolver levert kandidaten met groep
 * (optgroup/minibrowser-sectie) en pad (domein/package, minibrowser-kolom).
 * @type {import("../../diagramcore/types/schema.js").ReferenceType[]}
 */
const referenceTypes = [
  { id: "basistype", label: "Basistypen" },
  { id: "gegevenstype", label: "Gegevenstypen", icoon: "✦" },
  { id: "enumeratie", label: "Enumeraties", icoon: "◇" },
  { id: "refitem", label: "Referentielijst-items", icoon: "▣" },
];

/** Hulpje: elementen van een soort → gesorteerde kandidaten. */
function elementKandidaten(elements, filter, icoon, groep, labelFn = (el) => el.naam) {
  return Object.values(elements || {})
    .filter((el) => el.naam && filter(el))
    .map((el) => ({ waarde: el.naam, label: labelFn(el), icoon, groep, pad: [el.data?.domein || ""] }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** @type {Record<string, import("../../diagramcore/types/schema.js").ReferenceResolver>} */
const referenceResolvers = {
  basistype: () =>
    ["string", "integer", "number", "boolean", "date", "date-time"].map((t) => ({
      waarde: t,
      label: t,
      groep: "Basistypen",
    })),
  gegevenstype: ({ elements }) =>
    elementKandidaten(elements, (el) => el.elementType === "gegevenstype", "✦", "Gegevenstypen"),
  enumeratie: ({ elements }) =>
    elementKandidaten(elements, (el) => el.elementType === "enumeratie", "◇", "Enumeraties"),
  refitem: ({ elements }) =>
    elementKandidaten(
      elements,
      (el) => el.elementType === "entiteit" && el.data?.stereotype === "«ref.lijst item»",
      "▣",
      "Referentielijst-items",
      (el) => `${el.naam} (ref.lijst)`
    ),
};

/** @type {import("../../diagramcore/types/schema.js").DiagramType} */
export const canoniekUmlDiagramType = {
  id: CANONIEK_UML_ID,
  label: "Canoniek datamodel",
  style: "uml-klassiek",
  elementTypes,
  fieldTypes,
  referenceTypes,
  referenceResolvers,
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

/**
 * Idempotente registratie (veilig bij HMR/dubbele import).
 *
 * LET OP: dit bestand is het Definitie-deel en blijft bewust vrij van
 * .jsx-imports (node-testbaar). De Implementatie-registraties (o.a. de
 * "cel-expressie"-PropertyTypeEditor) staan in implementaties.jsx en worden
 * door de activiteit geladen.
 */
export function registreerCanoniekUml() {
  if (!getDiagramType(CANONIEK_UML_ID)) {
    registreerDiagramType(canoniekUmlDiagramType);
  }
  return canoniekUmlDiagramType;
}
