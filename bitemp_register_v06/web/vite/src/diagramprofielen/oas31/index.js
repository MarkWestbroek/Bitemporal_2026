// @ts-check
/**
 * oas31 — het derde diagramprofiel (fase 5, vuurproef): OpenAPI 3.1 als
 * diagram. Schemas zijn elementen, verwijzingen zijn connectoren:
 *
 *   - api («api»): het info-object van het document (titel/versie/
 *     beschrijving/licentie/contact) — één element per spec.
 *   - server («server»): één servers-item; de element-naam is de url.
 *   - schema («schema», object): properties-compartiment met JSON-typen;
 *     `verplicht` spiegelt de OAS `required`-lijst. Properties dragen ook
 *     description/example/pattern/default; primitieve schemas (string met
 *     format, …) tonen hun type als weergave-regel, externe $ref-schemas
 *     (./bestand.json) hun verwijzing.
 *   - enum («enum»): string-schema met een vaste waardenlijst.
 *   - operatie («operation», bv. GET /personen): method/pad/summary/
 *     description/tag/deprecated als element-properties, plus bewerkbare
 *     parameters- en responses-compartimenten (alle statussen, ook 4xx/5xx).
 *   - $ref        → gestippelde pijl (property of operatie verwijst naar een
 *                   schema; de rolnaam is de property-naam).
 *   - allOf       → dichte pijl met driehoek (compositie-overerving in OAS).
 *   - items       → «items»-pijl (array-elementtype).
 *   - servers     → pijl van de api naar zijn servers.
 *
 * Vuurproef-doel: een domein dat géén UML is op dezelfde motor, zonder core-
 * of shell-wijziging. Bewust nog niet: securitySchemes/headers/links als
 * eigen elementen (pass-through via meta), YAML-import/-export (serialisatie
 * is een eigen fase — vgl. canoniek-uml fase 4).
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerHandlerInfo } from "../../diagramcore/types/handlerCatalogus.js";

// P02: benoem de OAS-resolvers voor de handler-catalogus (PE-weergave).
registreerHandlerInfo("resolver", "json-type", {
  naam: "JSON-typen",
  beschrijving: "Vaste lijst JSON-primitieven, eventueel met format (string «date», …).",
});
registreerHandlerInfo("resolver", "schema-ref", {
  naam: "Schemas ($ref)",
  beschrijving: "Alle getekende schemas/enums als $ref-doel voor een property.",
});

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
      { key: "beschrijving", label: "description", datatype: "tekst" },
      { key: "voorbeeld", label: "example", datatype: "string" },
      { key: "patroon", label: "pattern", datatype: "string" },
      { key: "standaard", label: "default", datatype: "string" },
    ],
  },
  {
    // Parameter van een operatie (query/path/header/cookie); `in` en de
    // description leven in de inspector, de node toont naam + type.
    id: "parameter",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "in", label: "in (query/path/header/cookie)", datatype: "string" },
      { key: "typeLabel", label: "type", referenceTypes: TYPE_REFS },
      { key: "verplicht", label: "required", datatype: "boolean" },
      { key: "beschrijving", label: "description", datatype: "tekst" },
    ],
  },
  {
    // Response-regel van een operatie: statuscode + (schema)type + tekst.
    id: "response",
    viewer: "naam-type",
    properties: [
      { key: "naam", label: "status (200/400/…)", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "schema", referenceTypes: TYPE_REFS },
      { key: "beschrijving", label: "description", datatype: "tekst" },
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
    // Het info-object van het document: één element per spec; de element-
    // naam is de titel, versie/licentie verschijnen als weergave-regels.
    id: "api",
    label: "API (info)",
    kort: "API",
    stereotype: "«api»",
    shape: "class-box",
    kleur: "#ede9fe",
    icoon: "interface",
    randDikte: 3,
    properties: [
      KLEUR_VELD,
      { key: "versie", label: "version", datatype: "string" },
      { key: "beschrijving", label: "description", datatype: "tekst" },
      { key: "licentie", label: "license", datatype: "string" },
      { key: "contact", label: "contact (naam · e-mail · url)", datatype: "string" },
    ],
    compartments: [
      { id: "api-info", label: null, fieldType: "literal", alleenWeergave: true, verbergInInspector: true },
    ],
    hooks: {
      extraCompartimenten: (element) => {
        const d = element.data || {};
        const regels = [d.versie ? `v${d.versie}` : null, d.licentie || null].filter(Boolean);
        return regels.length
          ? [{ compartmentType: "api-info", velden: regels.map((r) => ({ naam: r, fieldType: "literal" })) }]
          : [];
      },
    },
  },
  {
    // Eén servers-item; de element-naam is de url.
    id: "server",
    label: "Server",
    kort: "SRV",
    stereotype: "«server»",
    shape: "class-box",
    kleur: "#fae8ff",
    icoon: "package",
    properties: [KLEUR_VELD, { key: "beschrijving", label: "description", datatype: "tekst" }],
  },
  {
    id: "schema",
    label: "Schema (object)",
    kort: "SCH",
    stereotype: "«schema»",
    shape: "class-box",
    kleur: "#d1fae5",
    icoon: "schema",
    properties: [
      KLEUR_VELD,
      { key: "beschrijving", label: "description", datatype: "tekst" },
      // Primitieve schemas (TraceID: string «uuid», …) hebben géén
      // properties maar wel een type; externe $ref-schemas alleen een
      // verwijzing naar een ander bestand/URL.
      { key: "typeLabel", label: "type (primitief schema)", referenceTypes: ["json-type"] },
      { key: "voorbeeld", label: "example", datatype: "string" },
      { key: "patroon", label: "pattern", datatype: "string" },
      { key: "externRef", label: "$ref (extern bestand/URL)", datatype: "string" },
    ],
    compartments: [
      { id: "properties", label: null, fieldType: "property" },
      { id: "typering", label: null, fieldType: "literal", alleenWeergave: true, verbergInInspector: true },
    ],
    hooks: {
      // Weergave-regels voor wat niet in properties past: het primitieve
      // type en/of de externe verwijzing.
      extraCompartimenten: (element) => {
        const d = element.data || {};
        const regels = [];
        if (d.typeLabel) regels.push(`: ${d.typeLabel}`);
        if (d.externRef) regels.push(`→ ${d.externRef}`);
        return regels.length
          ? [{ compartmentType: "typering", velden: regels.map((r) => ({ naam: r, fieldType: "literal" })) }]
          : [];
      },
    },
  },
  {
    id: "enum",
    label: "Enum",
    kort: "ENUM",
    stereotype: "«enum»",
    shape: "class-box",
    kleur: "#fef3c7",
    icoon: "enumeratie",
    properties: [KLEUR_VELD, { key: "beschrijving", label: "description", datatype: "tekst" }],
    compartments: [{ id: "waarden", label: null, fieldType: "literal" }],
  },
  {
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
      { key: "beschrijving", label: "description", datatype: "tekst" },
      { key: "tag", label: "tag", datatype: "string" },
      { key: "verouderd", label: "deprecated", datatype: "boolean" },
    ],
    // Bewerkbare parameters- en responses-compartimenten, plus de live
    // signatuur "GET /personen/{id}" uit de properties (zelfde patroon als
    // de gegevenstype-validatie).
    compartments: [
      { id: "parameters", label: "parameters", fieldType: "parameter" },
      { id: "responses", label: "responses", fieldType: "response" },
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
  {
    // servers: de api wijst naar zijn servers (één edge per servers-item).
    // NB: label ≠ "server" — de PE-terugvertaling slugificeert labels naar
    // ids en zou anders botsen met het server-élement.
    id: "servers",
    label: "servers",
    kort: "srv",
    shape: "edge",
    icoon: "dependency",
    isConnector: true,
    bron: { elementTypes: ["api"] },
    doel: { elementTypes: ["server"] },
    edgePresentatie: {
      lijn: "solid",
      kleur: "#7c3aed",
      markerEnd: "pijl-open",
      labels: [{ zijde: "midden", delen: [{ tekst: "«server»", soort: "constraint", kleur: "#7c3aed" }] }],
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
      "string «uri»",
      "string «binary»",
      "integer «int32»",
      "integer «int64»",
      "number «float»",
      "number «double»",
    ].map((t) => ({ waarde: t, label: t, groep: "JSON-typen", pad: [] })),
  "schema-ref": ({ elements }) =>
    elementKandidaten(elements, (el) => SCHEMAS.includes(el.elementType), "▣", "Schemas ($ref)"),
};

/** @type {import("../../diagramcore/types/schema.js").ReferenceType[]} */
const referenceTypes = [
  { id: "json-type", label: "JSON-type (evt. met format)" },
  { id: "schema-ref", label: "Schema ($ref)" },
];

/**
 * Gedeelde rijen-layout (auto-layout én import-plaatsing): operaties op rij 0
 * gesorteerd op CRUD (POST, GET, PUT, PATCH, DELETE, daarbinnen op pad),
 * daarna per $ref-stap een rij naar beneden; wat nergens aan hangt komt op de
 * onderste rij. Binnen een rij wordt per `perRij` elementen omgeslagen.
 *
 * @param {{ids: string[], elements: Record<string, any>, edges: {source: string, target: string}[], perRij?: number}} opties
 * @returns {Record<string, {x: number, y: number}>} posities per element-id
 */
export function oasRijenPosities({ ids, elements, edges, perRij = 5 }) {
  const idSet = new Set(ids);
  const uitgaand = new Map();
  for (const e of edges || []) {
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
    if (!uitgaand.has(e.source)) uitgaand.set(e.source, []);
    uitgaand.get(e.source).push(e.target);
  }
  const laag = new Map();
  let rand = ids.filter((eid) => elements?.[eid]?.elementType === "operatie");
  rand.forEach((eid) => laag.set(eid, 0));
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
  // De api en zijn servers horen bovenaan (rij -1), boven de operaties.
  for (const eid of ids) {
    const t = elements?.[eid]?.elementType;
    if (t === "api" || t === "server") laag.set(eid, -1);
  }
  const maxLaag = Math.max(0, ...laag.values());
  for (const eid of ids) if (!laag.has(eid)) laag.set(eid, maxLaag + 1);

  const perLaag = new Map();
  for (const eid of ids) {
    const l = laag.get(eid);
    if (!perLaag.has(l)) perLaag.set(l, []);
    perLaag.get(l).push(eid);
  }
  const CRUD = { post: 0, get: 1, put: 2, patch: 3, delete: 4 };
  // Ouders per kind (voor het zwaartepunt van volgende rijen).
  const inkomend = new Map();
  for (const e of edges || []) {
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
    if (!inkomend.has(e.target)) inkomend.set(e.target, []);
    inkomend.get(e.target).push(e.source);
  }
  const posities = {};
  let y = 60;
  for (const l of [...perLaag.keys()].sort((a, b) => a - b)) {
    const groep = perLaag.get(l);
    if (l === -1) {
      // api eerst, dan de servers (alfabetisch op url).
      groep.sort((a, b) => {
        const ta = elements?.[a]?.elementType === "api" ? 0 : 1;
        const tb = elements?.[b]?.elementType === "api" ? 0 : 1;
        if (ta !== tb) return ta - tb;
        return (elements?.[a]?.naam || a).localeCompare(elements?.[b]?.naam || b);
      });
    } else if (l === 0) {
      groep.sort((a, b) => {
        const ea = elements?.[a]?.data || {};
        const eb = elements?.[b]?.data || {};
        const ra = CRUD[(ea.method || "").toLowerCase()] ?? 9;
        const rb = CRUD[(eb.method || "").toLowerCase()] ?? 9;
        if (ra !== rb) return ra - rb;
        return (ea.pad || a).localeCompare(eb.pad || b);
      });
    } else {
      // Zwaartepunt van de (al geplaatste) ouders: kinderen komen zo
      // (ongeveer) ónder hun operatie/schema te staan; alfabetisch als
      // scheidsrechter bij gelijkspel of zonder geplaatste ouder.
      const zwaartepunt = (eid) => {
        const xs = (inkomend.get(eid) || [])
          .map((ouder) => posities[ouder]?.x)
          .filter((x) => x !== undefined);
        return xs.length ? xs.reduce((som, x) => som + x, 0) / xs.length : Infinity;
      };
      groep.sort((a, b) => {
        const za = zwaartepunt(a);
        const zb = zwaartepunt(b);
        if (za !== zb) return za - zb;
        return (elements?.[a]?.naam || a).localeCompare(elements?.[b]?.naam || b);
      });
    }
    groep.forEach((eid, i) => {
      posities[eid] = { x: 80 + (i % perRij) * 320, y: y + Math.floor(i / perRij) * 280 };
    });
    y += Math.ceil(groep.length / perRij) * 280 + 40;
  }
  return posities;
}

export const oas31DiagramType = {
  id: OAS31_ID,
  label: "OpenAPI 3.1",
  style: "uml-klassiek",
  // Boomordening in de elementen-browser: operatie → ($ref) → schema → ….
  hierarchie: "ref",
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
   * Gelaagde OAS-layout: operaties op rij 0 (bovenaan), daarna per $ref-stap
   * een rij naar beneden (schemas op afhankelijkheidsafstand); wat nergens
   * aan hangt komt op de onderste rij. De operatie-rij sorteert van links
   * naar rechts volgens CRUD (POST, GET, PUT/PATCH, DELETE), daarbinnen op
   * pad; schema-rijen alfabetisch op naam.
   */
  layouts: [
    {
      id: "oas-lagen",
      label: "Auto-layout",
      run: ({ flowNodes, flowEdges, elements }) =>
        oasRijenPosities({
          ids: flowNodes.filter((n) => !n.hidden).map((n) => n.id),
          elements,
          edges: flowEdges || [],
        }),
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
  if (et.id === "api") {
    element.naam = "Nieuwe API";
    element.data.versie = "1.0";
  }
  if (et.id === "server") {
    element.naam = "https://voorbeeld.nl/api/v1";
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
