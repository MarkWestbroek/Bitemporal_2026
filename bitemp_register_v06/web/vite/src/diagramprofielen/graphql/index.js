// @ts-check
/**
 * graphql — het GraphQL-schema als diagramprofiel (M2): het typesysteem uit de
 * GraphQL-spec §3, niets meer. Ontwerp: docs/plans/"2026-10-01 GraphQL-schema-
 * profiel (M2) op de diagram-motor (voorstel).md".
 *
 *   - schema («schema»): het schema-object; de root-typen hangen eraan met
 *     een root-connector («query» / «mutation» / «subscription»).
 *   - object («type») en interface («interface»): velden-compartiment; een
 *     veld is `naam: typeExpressie`, argumenten als SDL-tekst in de inspector
 *     en als weergave-regel `naam(args)` op de node.
 *   - union («union»): de leden hangen eraan met lid-connectoren.
 *   - enum («enum»): waarden-compartiment.
 *   - input («input»): velden met standaardwaarde, geen argumenten.
 *   - scalar («scalar»): eigen scalars; de vijf ingebouwde zijn geen element.
 *   - directive («directive»): definitie met argumenten, locaties, repeatable.
 *
 *   - veldtype     → een veld verwijst naar een object/interface/union; de
 *                    rolnaam is de veldnaam, de kardinaliteit volgt uit `!`/`[ ]`.
 *                    AFGELEID uit de velden (adapter.leidVeldConnectorenAf).
 *   - argumenttype → een argument verwijst naar een input-type. AFGELEID.
 *   - implements   → object/interface implementeert een interface.
 *   - lid          → union → object.
 *   - root         → schema → root-type.
 *
 * Naamgeving is die van GraphQL zelf: typenamen zijn uniek binnen één schema
 * (bij ons: binnen één domein). Argumenten en filters zijn aanvullingen op het
 * logisch model en leven híer, in het GraphQL-model (besluit Mark, 02-10-2026).
 *
 * Geen nieuwe shapes: alles is `class-box`, zoals OAS en canoniek-uml.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerHandlerInfo } from "../../diagramcore/types/handlerCatalogus.js";
import { INGEBOUWDE_SCALARS, kardinaliteit } from "./typeExpressie.js";

registreerHandlerInfo("resolver", "gql-scalar", {
  naam: "GraphQL-scalars",
  beschrijving: "De vijf ingebouwde scalars plus de getekende «scalar»-elementen, in de vormen T, T!, [T!] en [T!]!.",
});
registreerHandlerInfo("resolver", "gql-uitvoertype", {
  naam: "GraphQL-uitvoertypen",
  beschrijving: "Getekende object-, interface-, union- en enum-typen (wat een veld mag teruggeven).",
});
registreerHandlerInfo("resolver", "gql-invoertype", {
  naam: "GraphQL-invoertypen",
  beschrijving: "Getekende input- en enum-typen (wat een argument of invoerveld mag aannemen).",
});

export const GRAPHQL_ID = "graphql-schema";

/** Elementtypen die een GraphQL-type definiëren (dus een unieke naam dragen). */
export const TYPE_ELEMENTEN = ["object", "interface", "union", "enum", "input", "scalar"];
/** Connectortypen die uit velden worden afgeleid (niet met de hand onderhouden). */
export const AFGELEIDE_CONNECTOREN = ["veldtype", "argumenttype"];
export const ROOT_ROLLEN = ["query", "mutation", "subscription"];

const UITVOER_REFS = ["gql-scalar", "gql-uitvoertype"];
const INVOER_REFS = ["gql-scalar", "gql-invoertype"];
const KLEUR_VELD = { key: "kleur", datatype: "colour" };
const BESCHRIJVING = { key: "beschrijving", label: "description", datatype: "tekst" };
const DIRECTIVES = { key: "directives", label: "directives (@deprecated …)", datatype: "string" };

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
const fieldTypes = [
  {
    // Veld van een object of interface. De type-expressie staat in typeLabel
    // (de "naam-type"-viewer toont die rechts); argumenten zijn SDL-tekst.
    id: "veld",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "type", referenceTypes: UITVOER_REFS },
      { key: "argumenten", label: "argumenten (naam: Type = standaard, …)", datatype: "tekst" },
      BESCHRIJVING,
      DIRECTIVES,
    ],
  },
  {
    // Invoerveld (input-type) of argument (directive-definitie).
    id: "inputveld",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "type", referenceTypes: INVOER_REFS },
      { key: "standaard", label: "default", datatype: "string" },
      BESCHRIJVING,
      DIRECTIVES,
    ],
  },
  {
    id: "literal",
    viewer: "waarde",
    properties: [{ key: "naam", label: "waarde", datatype: "string", verplicht: true }, BESCHRIJVING, DIRECTIVES],
  },
  {
    // Alleen-weergave-regel (veldsignatuur met argumenten).
    id: "regel",
    viewer: "tekst",
    properties: [{ key: "naam", datatype: "string" }],
  },
];

/** Weergave-regels `veld(args)` voor de velden die argumenten hebben. */
function signatuurRegels(element) {
  const regels = [];
  for (const c of element.compartimenten || []) {
    if (c.compartmentType !== "velden") continue;
    for (const v of c.velden || []) {
      const args = (v.data?.argumenten || "").trim();
      if (args) regels.push({ naam: `${v.naam}(${args.replace(/\s*\n\s*/g, " ")})`, fieldType: "regel" });
    }
  }
  return regels.length ? [{ compartmentType: "signaturen", velden: regels }] : [];
}

const VELDEN_COMPARTIMENTEN = [
  { id: "velden", label: null, fieldType: "veld" },
  { id: "signaturen", label: "argumenten", fieldType: "regel", alleenWeergave: true, verbergInInspector: true },
];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    // Het schema-object: één per schema. De root-typen hangen eraan met een
    // root-connector; de naam is vrij (bv. de naam van de API).
    id: "schema",
    label: "Schema",
    kort: "SCH",
    stereotype: "«schema»",
    shape: "class-box",
    kleur: "#e0e7ff",
    icoon: "package",
    randDikte: 3,
    properties: [KLEUR_VELD, BESCHRIJVING, DIRECTIVES],
  },
  {
    id: "object",
    label: "Type (object)",
    kort: "TYPE",
    stereotype: "«type»",
    shape: "class-box",
    kleur: "#dbeafe",
    icoon: "klasse",
    properties: [KLEUR_VELD, BESCHRIJVING, DIRECTIVES],
    compartments: VELDEN_COMPARTIMENTEN,
    hooks: { extraCompartimenten: signatuurRegels },
  },
  {
    id: "interface",
    label: "Interface",
    kort: "INT",
    stereotype: "«interface»",
    shape: "class-box",
    kleur: "#ede9fe",
    icoon: "interface",
    properties: [KLEUR_VELD, BESCHRIJVING, DIRECTIVES],
    compartments: VELDEN_COMPARTIMENTEN,
    hooks: { extraCompartimenten: signatuurRegels },
  },
  {
    id: "union",
    label: "Union",
    kort: "UNION",
    stereotype: "«union»",
    shape: "class-box",
    kleur: "#fae8ff",
    icoon: "keuze-een",
    properties: [KLEUR_VELD, BESCHRIJVING, DIRECTIVES],
  },
  {
    id: "enum",
    label: "Enum",
    kort: "ENUM",
    stereotype: "«enum»",
    shape: "class-box",
    kleur: "#fef3c7",
    icoon: "enumeratie",
    properties: [KLEUR_VELD, BESCHRIJVING, DIRECTIVES],
    compartments: [{ id: "waarden", label: null, fieldType: "literal" }],
  },
  {
    id: "input",
    label: "Input",
    kort: "INPUT",
    stereotype: "«input»",
    shape: "class-box",
    kleur: "#fee2e2",
    icoon: "lijst",
    properties: [KLEUR_VELD, BESCHRIJVING, DIRECTIVES],
    compartments: [{ id: "velden", label: null, fieldType: "inputveld" }],
  },
  {
    id: "scalar",
    label: "Scalar",
    kort: "SCAL",
    stereotype: "«scalar»",
    shape: "class-box",
    kleur: "#f1f5f9",
    icoon: "datatype",
    properties: [KLEUR_VELD, BESCHRIJVING, DIRECTIVES],
  },
  {
    // Directive-DEFINITIE (`directive @naam(args) on …`). Toegepaste
    // directives staan als tekst op het element of veld waar ze gelden.
    id: "directive",
    label: "Directive",
    kort: "@",
    stereotype: "«directive»",
    shape: "class-box",
    kleur: "#ecfccb",
    icoon: "constraint",
    properties: [
      KLEUR_VELD,
      BESCHRIJVING,
      { key: "locaties", label: "on (FIELD_DEFINITION | OBJECT | …)", datatype: "string" },
      { key: "herhaalbaar", label: "repeatable", datatype: "boolean" },
    ],
    compartments: [
      { id: "argumenten", label: null, fieldType: "inputveld" },
      { id: "plaats", label: null, fieldType: "regel", alleenWeergave: true, verbergInInspector: true },
    ],
    hooks: {
      extraCompartimenten: (element) => {
        const d = element.data || {};
        const regel = [d.herhaalbaar ? "repeatable" : null, d.locaties ? `on ${d.locaties}` : null].filter(Boolean).join(" ");
        return regel ? [{ compartmentType: "plaats", velden: [{ naam: regel, fieldType: "regel" }] }] : [];
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
    // Afgeleid uit een veld: het veld (rolnaam) verwijst naar een type.
    id: "veldtype",
    label: "veld → type",
    kort: "veld",
    shape: "edge",
    icoon: "verwijzing",
    isConnector: true,
    bron: { elementTypes: ["object", "interface"] },
    doel: { elementTypes: ["object", "interface", "union", "enum"] },
    edgePresentatie: { lijn: "dash-6-3", kleur: "#2563eb", markerEnd: "pijl-open" },
    properties: [
      { key: "rolnaam", label: "veld (rolnaam)", datatype: "string" },
      { key: "typeLabel", label: "type-expressie", datatype: "string" },
    ],
    hooks: {
      edgeLabels: (conn) => {
        const kaal = [];
        if (conn.data?.rolnaam) kaal.push({ zijde: "bron", delen: [{ tekst: conn.data.rolnaam, soort: "rolnaam" }] });
        const kard = kardinaliteit(conn.data?.typeLabel);
        if (kard) kaal.push({ zijde: "doel", delen: [{ tekst: kard, soort: "kardinaliteit" }] });
        return { bron: [], doel: [], kaal };
      },
    },
  },
  {
    // Afgeleid uit een argument: het argument verwijst naar een input-type.
    id: "argumenttype",
    label: "argument → type",
    kort: "arg",
    shape: "edge",
    icoon: "gebruik",
    isConnector: true,
    bron: { elementTypes: ["object", "interface", "directive"] },
    doel: { elementTypes: ["input", "enum"] },
    edgePresentatie: {
      lijn: "dash-4-3",
      kleur: "#dc2626",
      markerEnd: "pijl-open",
      labels: [{ zijde: "midden", delen: [{ tekst: "«arg»", soort: "constraint", kleur: "#dc2626" }] }],
    },
    properties: [{ key: "rolnaam", label: "veld(argument)", datatype: "string" }],
    hooks: {
      edgeLabels: (conn) =>
        conn.data?.rolnaam
          ? { bron: [], doel: [], kaal: [{ zijde: "bron", delen: [{ tekst: conn.data.rolnaam, soort: "rolnaam" }] }] }
          : { bron: [], doel: [], kaal: [] },
    },
  },
  {
    // Realisatie-notatie: een type belooft de velden van de interface.
    id: "implements",
    label: "implements",
    kort: "▷ impl",
    shape: "edge",
    icoon: "realisatie",
    isConnector: true,
    bron: { elementTypes: ["object", "interface"] },
    doel: { elementTypes: ["interface"] },
    edgePresentatie: { lijn: "dash-6-3", kleur: "#7c3aed", markerEnd: "driehoek" },
  },
  {
    id: "lid",
    label: "union-lid",
    kort: "| lid",
    shape: "edge",
    icoon: "keuze-elk",
    isConnector: true,
    bron: { elementTypes: ["union"] },
    doel: { elementTypes: ["object"] },
    edgePresentatie: {
      lijn: "dash-4-4",
      kleur: "#d946ef",
      markerEnd: "pijl-open",
      labels: [{ zijde: "midden", delen: [{ tekst: "«lid»", soort: "constraint", kleur: "#d946ef" }] }],
    },
  },
  {
    // Het schema wijst zijn root-typen aan; de rol staat op de lijn.
    id: "root",
    label: "root-operatie",
    kort: "root",
    shape: "edge",
    icoon: "dependency",
    isConnector: true,
    bron: { elementTypes: ["schema"] },
    doel: { elementTypes: ["object"] },
    edgePresentatie: { lijn: "solid", kleur: "#4f46e5", markerEnd: "pijl-dicht" },
    properties: [
      {
        key: "rol",
        label: "rol",
        datatype: "keuze",
        opties: ROOT_ROLLEN.map((r) => ({ waarde: r, label: r })),
      },
    ],
    hooks: {
      edgeLabels: (conn) => ({
        bron: [],
        doel: [],
        kaal: [
          {
            zijde: "midden",
            delen: [{ tekst: `«${conn.data?.rol || "query"}»`, soort: "constraint", kleur: "#4f46e5" }],
          },
        ],
      }),
    },
  },
];

/** De vier gangbare schrijfwijzen van één type; andere komen via import. */
const varianten = (naam) => [naam, `${naam}!`, `[${naam}!]`, `[${naam}!]!`];

function typeKandidaten(namen, groep, icoon) {
  return namen.flatMap((naam) => varianten(naam).map((v) => ({ waarde: v, label: v, icoon, groep, pad: [] })));
}

function getekendeNamen(elements, soorten) {
  return Object.values(elements || {})
    .filter((el) => el.naam && soorten.includes(el.elementType))
    .map((el) => el.naam)
    .sort((a, b) => a.localeCompare(b));
}

/** @type {Record<string, import("../../diagramcore/types/schema.js").ReferenceResolver>} */
const referenceResolvers = {
  "gql-scalar": ({ elements }) =>
    typeKandidaten([...INGEBOUWDE_SCALARS, ...getekendeNamen(elements, ["scalar"])], "Scalars", ""),
  "gql-uitvoertype": ({ elements }) => [
    ...typeKandidaten(getekendeNamen(elements, ["object", "interface", "union"]), "Typen", "▣"),
    ...typeKandidaten(getekendeNamen(elements, ["enum"]), "Enums", "◇"),
  ],
  "gql-invoertype": ({ elements }) => [
    ...typeKandidaten(getekendeNamen(elements, ["input"]), "Input-typen", "▣"),
    ...typeKandidaten(getekendeNamen(elements, ["enum"]), "Enums", "◇"),
  ],
};

/** @type {import("../../diagramcore/types/schema.js").ReferenceType[]} */
const referenceTypes = [
  { id: "gql-scalar", label: "Scalar (ingebouwd of eigen)" },
  { id: "gql-uitvoertype", label: "Uitvoertype (type, interface, union, enum)" },
  { id: "gql-invoertype", label: "Invoertype (input, enum)" },
];

/** Aantal regels in de node, voor de rijhoogte van de layout. */
function regelAantal(element) {
  let n = 0;
  for (const c of element?.compartimenten || []) n += (c.velden || []).length;
  return n + signatuurRegels(element || {}).reduce((som, c) => som + c.velden.length + 1, 0);
}

/**
 * Rijen-layout (auto-layout én import-plaatsing): het schema bovenaan, daar-
 * onder de root-typen, daarna per verwijzingsstap een rij naar beneden; wat
 * nergens aan hangt (scalars, directives, losse enums/inputs) komt onderaan.
 * De rijhoogte volgt het langste element in de rij, zodat lange typen de
 * volgende rij niet overlappen.
 *
 * @param {{ids: string[], elements: Record<string, any>, edges: {source: string, target: string}[], perRij?: number}} opties
 * @returns {Record<string, {x: number, y: number}>}
 */
export function gqlRijenPosities({ ids, elements, edges, perRij = 5 }) {
  const idSet = new Set(ids);
  const uitgaand = new Map();
  const inkomend = new Map();
  for (const e of edges || []) {
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
    if (!uitgaand.has(e.source)) uitgaand.set(e.source, []);
    uitgaand.get(e.source).push(e.target);
    if (!inkomend.has(e.target)) inkomend.set(e.target, []);
    inkomend.get(e.target).push(e.source);
  }
  const soort = (id) => elements?.[id]?.elementType;
  const laag = new Map();
  const schemas = ids.filter((id) => soort(id) === "schema");
  schemas.forEach((id) => laag.set(id, -1));
  let rand = schemas.flatMap((id) => uitgaand.get(id) || []);
  if (!rand.length) {
    rand = ids.filter((id) => ["Query", "Mutation", "Subscription"].includes(elements?.[id]?.naam));
  }
  rand = [...new Set(rand)];
  rand.forEach((id) => laag.set(id, 0));
  let diepte = 0;
  while (rand.length) {
    diepte += 1;
    const volgende = [];
    for (const van of rand) {
      for (const doel of uitgaand.get(van) || []) {
        if (!laag.has(doel)) {
          laag.set(doel, diepte);
          volgende.push(doel);
        }
      }
    }
    rand = volgende;
  }
  const maxLaag = Math.max(0, ...laag.values());
  for (const id of ids) if (!laag.has(id)) laag.set(id, maxLaag + 1);

  const perLaag = new Map();
  for (const id of ids) {
    const l = laag.get(id);
    if (!perLaag.has(l)) perLaag.set(l, []);
    perLaag.get(l).push(id);
  }
  const posities = {};
  let y = 60;
  for (const l of [...perLaag.keys()].sort((a, b) => a - b)) {
    const groep = perLaag.get(l);
    const zwaartepunt = (id) => {
      const xs = (inkomend.get(id) || []).map((ouder) => posities[ouder]?.x).filter((x) => x !== undefined);
      return xs.length ? xs.reduce((som, x) => som + x, 0) / xs.length : Infinity;
    };
    groep.sort((a, b) => {
      const za = zwaartepunt(a);
      const zb = zwaartepunt(b);
      if (za !== zb) return za - zb;
      return (elements?.[a]?.naam || a).localeCompare(elements?.[b]?.naam || b);
    });
    for (let start = 0; start < groep.length; start += perRij) {
      const rij = groep.slice(start, start + perRij);
      rij.forEach((id, i) => {
        posities[id] = { x: 80 + i * 320, y };
      });
      const hoogste = Math.max(0, ...rij.map((id) => regelAantal(elements?.[id])));
      y += Math.max(200, 110 + hoogste * 22) + 60;
    }
  }
  return posities;
}

export const graphqlDiagramType = {
  id: GRAPHQL_ID,
  label: "GraphQL-schema",
  style: "uml-klassiek",
  randAanhechting: "zwevend",
  // Boomordening in de elementen-browser: type → (veld) → type → ….
  hierarchie: "veldtype",
  fieldTypes,
  elementTypes,
  referenceTypes,
  referenceResolvers,
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
    { id: "auto-layout", label: "Auto-layout", acties: "layouts" },
  ],
  layouts: [
    {
      id: "gql-lagen",
      label: "Auto-layout",
      run: ({ flowNodes, flowEdges, elements }) =>
        gqlRijenPosities({
          ids: flowNodes.filter((n) => !n.hidden).map((n) => n.id),
          elements,
          edges: flowEdges || [],
        }),
    },
  ],
};

let _teller = 0;

const STARTNAMEN = {
  schema: "schema",
  object: "NieuwType",
  interface: "NieuweInterface",
  union: "NieuweUnion",
  enum: "NieuweEnum",
  input: "NieuweInput",
  scalar: "NieuweScalar",
  directive: "nieuweDirective",
  notitie: "",
  boundary: "Kader",
};

/** Nieuw (niet-connector-)element van het gegeven type. */
export function maakElement(elementTypeId) {
  const et = elementTypes.find((t) => t.id === elementTypeId);
  if (!et || et.isConnector) return null;
  _teller += 1;
  const element = {
    id: `gql_${Date.now()}_${_teller}`,
    naam: STARTNAMEN[et.id] ?? `Nieuw${et.label.replace(/[^A-Za-z]/g, "")}`,
    elementType: et.id,
    compartimenten: [],
    data: {},
  };
  if (et.id === "directive") element.data.locaties = "FIELD_DEFINITION";
  if (et.id === "notitie") element.data.tekst = "";
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerGraphql() {
  if (!getDiagramType(GRAPHQL_ID)) {
    registreerDiagramType(graphqlDiagramType);
  }
}
