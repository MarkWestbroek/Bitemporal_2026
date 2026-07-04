// @ts-check
/**
 * oas31 — het derde diagramprofiel (fase 5, vuurproef): OpenAPI 3.1 als
 * diagram. Schemas zijn elementen, verwijzingen zijn connectoren:
 *
 *   - schema («schema», object): properties-compartiment met JSON-typen;
 *     `verplicht` spiegelt de OAS `required`-lijst.
 *   - enum («enum»): string-schema met een vaste waardenlijst.
 *   - operatie («operation», bv. GET /personen): method/pad/samenvatting als
 *     element-properties — een element zónder compartimenten.
 *   - $ref        → gestippelde pijl (property of operatie verwijst naar een
 *                   schema; de rolnaam is de property-naam).
 *   - allOf       → dichte pijl met driehoek (compositie-overerving in OAS).
 *   - items       → «items»-pijl (array-elementtype).
 *
 * Vuurproef-doel: een domein dat géén UML is op dezelfde motor, zonder core-
 * of shell-wijziging. Bewust nog niet: oneOf/anyOf (discriminator-weergave),
 * parameters/headers als aparte elementen, YAML-import/-export (serialisatie
 * is een eigen fase — vgl. canoniek-uml fase 4).
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";

export const OAS31_ID = "oas31";

/** Kandidaat-types voor properties: JSON-primitieven of een schema-$ref. */
const TYPE_REFS = ["json-type", "schema-ref"];

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
const fieldTypes = [
  {
    id: "property",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "type", referenceTypes: TYPE_REFS },
      { key: "verplicht", label: "required", datatype: "boolean" },
    ],
  },
  {
    id: "literal",
    viewer: "waarde",
    properties: [{ key: "naam", label: "waarde", datatype: "string", verplicht: true }],
  },
];

const KLEUR_VELD = { key: "kleur", datatype: "colour" };
const SCHEMAS = ["schema", "enum"];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "schema",
    label: "Schema (object)",
    kort: "SCH",
    stereotype: "«schema»",
    shape: "class-box",
    kleur: "#d1fae5",
    icoon: "schema",
    properties: [KLEUR_VELD, { key: "beschrijving", label: "description", datatype: "tekst" }],
    compartments: [{ id: "properties", label: null, fieldType: "property" }],
  },
  {
    id: "enum",
    label: "Enum",
    kort: "ENUM",
    stereotype: "«enum»",
    shape: "class-box",
    kleur: "#fef3c7",
    icoon: "enumeratie",
    properties: [KLEUR_VELD],
    compartments: [{ id: "waarden", label: null, fieldType: "literal" }],
  },
  {
    // Een element zonder compartimenten: alles zit in element-properties.
    id: "operatie",
    label: "Operatie",
    kort: "OP",
    stereotype: "«operation»",
    shape: "class-box",
    kleur: "#e0f2fe",
    icoon: "operatie",
    properties: [
      KLEUR_VELD,
      { key: "method", label: "method (GET/POST/…)", datatype: "string" },
      { key: "pad", label: "pad (/personen/{id})", datatype: "string" },
      { key: "samenvatting", label: "summary", datatype: "tekst" },
    ],
    // Alleen een weergave-compartiment: "GET /personen/{id}" live uit de
    // properties (zelfde patroon als de gegevenstype-validatie).
    compartments: [
      { id: "signatuur", label: null, fieldType: "literal", alleenWeergave: true, verbergInInspector: true },
    ],
    hooks: {
      extraCompartimenten: (element) => {
        const d = element.data || {};
        const regel = [d.method, d.pad].filter(Boolean).join(" ");
        return regel
          ? [{ compartmentType: "signatuur", velden: [{ naam: regel, fieldType: "literal" }] }]
          : [];
      },
    },
  },
  {
    id: "notitie",
    label: "Notitie",
    kort: "NOT",
    shape: "note",
    icoon: "notitie",
    handleStijl: "onzichtbaar",
    properties: [{ key: "tekst", datatype: "tekst" }, KLEUR_VELD],
  },
  {
    id: "boundary",
    label: "Kader",
    kort: "KADER",
    shape: "boundary",
    icoon: "kader",
    achtergrond: true,
    handleStijl: "onzichtbaar",
    properties: [
      { key: "kleur", label: "rand", datatype: "colour" },
      { key: "achtergrondKleur", label: "achtergrond", datatype: "colour" },
    ],
  },

  // ── Connectoren ────────────────────────────────────────────────────────
  {
    // $ref: een property (rolnaam) of operatie verwijst naar een schema.
    id: "ref",
    label: "$ref",
    kort: "$ref",
    shape: "edge",
    icoon: "verwijzing",
    isConnector: true,
    bron: { elementTypes: ["schema", "operatie"] },
    doel: { elementTypes: SCHEMAS },
    edgePresentatie: { lijn: "dash-6-3", kleur: "#059669", markerEnd: "pijl-open" },
    properties: [{ key: "rolnaam", label: "property (rolnaam)", datatype: "string" }],
    hooks: {
      edgeLabels: (conn) => {
        const kaal = [{ zijde: "midden", delen: [{ tekst: "«$ref»", soort: "constraint", kleur: "#059669" }] }];
        if (conn.data?.rolnaam) {
          kaal.push({ zijde: "bron", delen: [{ tekst: conn.data.rolnaam, soort: "rolnaam" }] });
        }
        return { bron: [], doel: [], kaal };
      },
    },
  },
  {
    // allOf: compositie-overerving — subtype-schema erft het supertype.
    id: "allOf",
    label: "allOf",
    kort: "▷ allOf",
    shape: "edge",
    icoon: "samenvoeging",
    isConnector: true,
    bron: { elementTypes: ["schema"] },
    doel: { elementTypes: ["schema"] },
    edgePresentatie: {
      lijn: "solid",
      kleur: "#0d9488",
      markerEnd: "driehoek",
      labels: [{ zijde: "midden", delen: [{ tekst: "«allOf»", soort: "constraint", kleur: "#0d9488" }] }],
    },
  },
  {
    // items: het elementtype van een array-property.
    id: "items",
    label: "items (array)",
    kort: "[ ]",
    shape: "edge",
    icoon: "reeks",
    isConnector: true,
    bron: { elementTypes: ["schema"] },
    doel: { elementTypes: SCHEMAS },
    edgePresentatie: {
      lijn: "dash-4-3",
      kleur: "#0284c7",
      markerEnd: "pijl-open",
      labels: [{ zijde: "midden", delen: [{ tekst: "«items»", soort: "constraint", kleur: "#0284c7" }] }],
    },
    properties: [{ key: "rolnaam", label: "property (rolnaam)", datatype: "string" }],
    hooks: {
      edgeLabels: (conn) =>
        conn.data?.rolnaam
          ? { bron: [], doel: [], kaal: [{ zijde: "bron", delen: [{ tekst: conn.data.rolnaam, soort: "rolnaam" }] }] }
          : { bron: [], doel: [], kaal: [] },
    },
  },
  {
    // oneOf/anyOf: variant-verwijzingen (discriminator-achtige structuren).
    id: "oneOf",
    label: "oneOf",
    kort: "1..1",
    shape: "edge",
    icoon: "keuze-een",
    isConnector: true,
    bron: { elementTypes: ["schema"] },
    doel: { elementTypes: SCHEMAS },
    edgePresentatie: {
      lijn: "dash-4-4",
      kleur: "#d946ef",
      markerEnd: "pijl-open",
      labels: [{ zijde: "midden", delen: [{ tekst: "«oneOf»", soort: "constraint", kleur: "#d946ef" }] }],
    },
  },
  {
    id: "anyOf",
    label: "anyOf",
    kort: "0..n",
    shape: "edge",
    icoon: "keuze-elk",
    isConnector: true,
    bron: { elementTypes: ["schema"] },
    doel: { elementTypes: SCHEMAS },
    edgePresentatie: {
      lijn: "dash-4-4",
      kleur: "#f59e0b",
      markerEnd: "pijl-open",
      labels: [{ zijde: "midden", delen: [{ tekst: "«anyOf»", soort: "constraint", kleur: "#f59e0b" }] }],
    },
  },
];

function elementKandidaten(elements, filter, icoon, groep) {
  return Object.values(elements || {})
    .filter((el) => el.naam && filter(el))
    .map((el) => ({ waarde: el.naam, label: el.naam, icoon, groep, pad: [] }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** @type {Record<string, import("../../diagramcore/types/schema.js").ReferenceResolver>} */
const referenceResolvers = {
  "json-type": () =>
    [
      "string",
      "integer",
      "number",
      "boolean",
      "array",
      "object",
      "string «date»",
      "string «date-time»",
      "string «uuid»",
      "string «email»",
    ].map((t) => ({ waarde: t, label: t, groep: "JSON-typen", pad: [] })),
  "schema-ref": ({ elements }) =>
    elementKandidaten(elements, (el) => SCHEMAS.includes(el.elementType), "▣", "Schemas ($ref)"),
};

/** @type {import("../../diagramcore/types/schema.js").ReferenceType[]} */
const referenceTypes = [
  { id: "json-type", label: "JSON-type (evt. met format)" },
  { id: "schema-ref", label: "Schema ($ref)" },
];

export const oas31DiagramType = {
  id: OAS31_ID,
  label: "OpenAPI 3.1",
  style: "uml-klassiek",
  fieldTypes,
  elementTypes,
  referenceTypes,
  referenceResolvers,
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
    { id: "auto-layout", label: "Auto-layout", acties: "layouts" },
  ],
  /**
   * Gelaagde OAS-layout: operaties in kolom 0, daarna per $ref-stap een
   * kolom naar rechts (schemas op afhankelijkheidsafstand); wat nergens aan
   * hangt komt in de laatste kolom. Puur op flowNodes/flowEdges.
   */
  layouts: [
    {
      id: "oas-lagen",
      label: "Auto-layout",
      run: ({ flowNodes, flowEdges }) => {
        const nodes = flowNodes.filter((n) => !n.hidden);
        const idSet = new Set(nodes.map((n) => n.id));
        const uitgaand = new Map();
        for (const e of flowEdges || []) {
          if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
          if (!uitgaand.has(e.source)) uitgaand.set(e.source, []);
          uitgaand.get(e.source).push(e.target);
        }
        const laag = new Map();
        let rand = nodes.filter((n) => n.type === "operatie").map((n) => n.id);
        rand.forEach((id) => laag.set(id, 0));
        let diepte = 0;
        while (rand.length) {
          diepte += 1;
          const volgende = [];
          for (const vanId of rand) {
            for (const doel of uitgaand.get(vanId) || []) {
              if (!laag.has(doel)) {
                laag.set(doel, diepte);
                volgende.push(doel);
              }
            }
          }
          rand = volgende;
        }
        const maxLaag = Math.max(0, ...laag.values());
        for (const n of nodes) if (!laag.has(n.id)) laag.set(n.id, maxLaag + 1);

        const perLaag = new Map();
        for (const n of nodes) {
          const l = laag.get(n.id);
          if (!perLaag.has(l)) perLaag.set(l, []);
          perLaag.get(l).push(n);
        }
        const posities = {};
        for (const [l, groep] of perLaag) {
          groep.sort((a, b) => a.id.localeCompare(b.id));
          groep.forEach((n, i) => {
            posities[n.id] = { x: 80 + l * 380, y: 60 + i * 240 };
          });
        }
        return posities;
      },
    },
  ],
};

let _teller = 0;

/** Nieuw (niet-connector-)element van het gegeven type. */
export function maakElement(elementTypeId) {
  const et = elementTypes.find((t) => t.id === elementTypeId);
  if (!et || et.isConnector) return null;
  _teller += 1;
  const element = {
    id: `oas_${Date.now()}_${_teller}`,
    naam: `Nieuw${et.label.replace(/[^A-Za-z]/g, "")}`,
    elementType: et.id,
    compartimenten: [],
    data: {},
  };
  if (et.id === "operatie") {
    element.naam = "nieuweOperatie";
    element.data.method = "GET";
    element.data.pad = "/";
  }
  if (et.id === "notitie") {
    element.naam = "";
    element.data.tekst = "";
  }
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerOas31() {
  if (!getDiagramType(OAS31_ID)) {
    registreerDiagramType(oas31DiagramType);
  }
}
