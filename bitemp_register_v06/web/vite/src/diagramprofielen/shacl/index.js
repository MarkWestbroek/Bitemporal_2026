// @ts-check
/**
 * shacl — SHACL (W3C Shapes Constraint Language) als diagramprofiel (M2).
 * Ontwerp: docs/plans/"2026-11-06 Linked data als M2 — SHACL, SKOS, OWL (plan).md" §4.
 *
 * Een SHACL-bestand is een M1: een model in de taal SHACL (dat zelf weer een
 * andere taal kan beschrijven, zoals ODRL). Dit profiel tekent het zoals
 * Sparna SHACL Play en ShapeUML: node shapes als box, property shapes als regel.
 *
 *   - shapesgraaf («shapes graph»): het document (`owl:Ontology` of de bestandsnaam)
 *     met titel, beschrijving, prefixen en `sh:declare`.
 *   - nodeshape («NodeShape»): doelen (targetClass, targetNode, …), closed,
 *     node-niveau-constraints; de property shapes zijn regels in de box.
 *   - propertyshape («PropertyShape»): een property shape met eigen doelen
 *     (zonder node shape eromheen); één regel.
 *   - klasse («class»): een klasse uit `sh:class` waar geen shape op richt,
 *     zodat de pijl ergens heen kan (zoals Sparna).
 *   - constraint: SHACL-constraint die niet in een regel past (sh:or, sh:xone,
 *     sh:and, sh:not op node-niveau, sh:sparql). Specialiseert de
 *     superprofiel-constraint: de **body met taal** (SHACL of SPARQL) is het
 *     fragment zelf, zodat niets verloren gaat.
 *
 *   - verwijzing → AFGELEID uit een regel met sh:class of sh:node: van de shape
 *                  naar de shape die die klasse controleert (de meest specifieke),
 *                  anders naar het klasse-element (`leidAf`).
 *   - node       → nodeshape sh:node nodeshape (een echte connector).
 *   - subklasse  → rdfs:subClassOf tussen klassen/shapes, als het bestand die noemt.
 *
 * Een regel (property shape) bewaart elke SHACL-parameter in zijn eigen veld;
 * wat de regel tekent (`type [kardinaliteit] {facetten}`) wordt daaruit
 * afgeleid in `hooks.migreerModel`, net als de pijlen. Ontbrekende minCount en
 * maxCount = 0..* (niet de UML-standaard 1).
 *
 * Geen nieuwe shapes: class-box, de constraint-vorm van het superprofiel.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { leidAf } from "./afleiding.js";

export const SHACL_ID = "shacl";

/** Waar een regel naar kan wijzen. */
export const SHAPE_ELEMENTEN = ["nodeshape", "propertyshape"];
export const AFGELEIDE_CONNECTOREN = ["verwijzing"];

const KLEUR_VELD = { key: "kleur", datatype: "colour" };
const IRI = { key: "iri", label: "IRI", datatype: "string" };
const BESCHRIJVING = { key: "beschrijving", label: "beschrijving (rdfs:comment)", datatype: "tekst" };
const OVERIG = { key: "overig", label: "overig (Turtle, ongewijzigd bewaard)", datatype: "tekst" };

export const NODE_KINDS = ["IRI", "BlankNode", "Literal", "BlankNodeOrIRI", "BlankNodeOrLiteral", "IRIOrLiteral"];
const nodeKindOpties = [{ waarde: "", label: "—" }, ...NODE_KINDS.map((k) => ({ waarde: k, label: `sh:${k}` }))];
const ERNST_OPTIES = [
  { waarde: "", label: "Violation (standaard)" },
  { waarde: "Warning", label: "Warning" },
  { waarde: "Info", label: "Info" },
];

/**
 * De parameters van een property shape, in de volgorde van de inspector.
 * `sh` = het SHACL-predicaat (lokale naam); de adapter leest en de afleiding
 * tekent via deze lijst.
 */
export const EIGENSCHAP_PARAMETERS = [
  { key: "label", sh: "name", label: "naam (sh:name)", datatype: "string" },
  { key: "beschrijving", sh: "description", label: "beschrijving (sh:description)", datatype: "tekst" },
  { key: "datatype", sh: "datatype", label: "datatype (xsd:string, … ; a | b = sh:or)", datatype: "string" },
  { key: "klasse", sh: "class", label: "klasse (sh:class; a | b = sh:or)", datatype: "string" },
  { key: "node", sh: "node", label: "node (sh:node: shape)", datatype: "string" },
  { key: "nodeKind", sh: "nodeKind", label: "nodeKind", datatype: "keuze", opties: nodeKindOpties },
  { key: "minCount", sh: "minCount", label: "minCount", datatype: "integer" },
  { key: "maxCount", sh: "maxCount", label: "maxCount", datatype: "integer" },
  { key: "in", sh: "in", label: "in (waardelijst, Turtle)", datatype: "string" },
  { key: "hasValue", sh: "hasValue", label: "hasValue", datatype: "string" },
  { key: "pattern", sh: "pattern", label: "pattern (regex)", datatype: "string" },
  { key: "flags", sh: "flags", label: "flags", datatype: "string" },
  { key: "minLength", sh: "minLength", label: "minLength", datatype: "integer" },
  { key: "maxLength", sh: "maxLength", label: "maxLength", datatype: "integer" },
  { key: "minInclusive", sh: "minInclusive", label: "minInclusive", datatype: "string" },
  { key: "maxInclusive", sh: "maxInclusive", label: "maxInclusive", datatype: "string" },
  { key: "minExclusive", sh: "minExclusive", label: "minExclusive", datatype: "string" },
  { key: "maxExclusive", sh: "maxExclusive", label: "maxExclusive", datatype: "string" },
  { key: "languageIn", sh: "languageIn", label: "languageIn (Turtle-lijst)", datatype: "string" },
  { key: "uniqueLang", sh: "uniqueLang", label: "uniqueLang", datatype: "boolean" },
  { key: "equals", sh: "equals", label: "equals", datatype: "string" },
  { key: "disjoint", sh: "disjoint", label: "disjoint", datatype: "string" },
  { key: "lessThan", sh: "lessThan", label: "lessThan", datatype: "string" },
  { key: "lessThanOrEquals", sh: "lessThanOrEquals", label: "lessThanOrEquals", datatype: "string" },
  { key: "standaard", sh: "defaultValue", label: "defaultValue", datatype: "string" },
  { key: "order", sh: "order", label: "order", datatype: "string" },
  { key: "group", sh: "group", label: "group", datatype: "string" },
  { key: "severity", sh: "severity", label: "severity", datatype: "keuze", opties: ERNST_OPTIES },
  { key: "message", sh: "message", label: "message", datatype: "tekst" },
  { key: "gedeactiveerd", sh: "deactivated", label: "deactivated", datatype: "boolean" },
  { key: "logica", sh: null, label: "logica (sh:or/xone/and/not, Turtle)", datatype: "tekst" },
  { key: "iri", sh: null, label: "IRI (bij een benoemde property shape)", datatype: "string" },
  { key: "overig", sh: null, label: "overig (Turtle, ongewijzigd bewaard)", datatype: "tekst" },
];

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
const fieldTypes = [
  {
    // Een property shape als regel: naam = het pad (SPARQL-padsyntax:
    // a/b reeks, a|b alternatief, ^a invers, a* a+ a?). Wat rechts staat
    // (typeLabel) is afgeleid uit de parameters.
    id: "eigenschap",
    viewer: "naam-type",
    properties: [
      { key: "naam", label: "pad (sh:path)", datatype: "string", verplicht: true },
      ...EIGENSCHAP_PARAMETERS.map(({ sh, ...p }) => p),
    ],
  },
];

const NODE_PARAMETERS = [
  IRI,
  { key: "doelklassen", label: "targetClass (komma's)", datatype: "string" },
  { key: "ookKlasse", label: "is ook een klasse (impliciet doel)", datatype: "boolean" },
  { key: "doelknopen", label: "targetNode (komma's)", datatype: "string" },
  { key: "doelSubjectenVan", label: "targetSubjectsOf", datatype: "string" },
  { key: "doelObjectenVan", label: "targetObjectsOf", datatype: "string" },
  { key: "gesloten", label: "closed", datatype: "boolean" },
  { key: "genegeerd", label: "ignoredProperties (Turtle-lijst)", datatype: "string" },
  { key: "nodeKind", label: "nodeKind", datatype: "keuze", opties: nodeKindOpties },
  { key: "severity", label: "severity", datatype: "keuze", opties: ERNST_OPTIES },
  { key: "message", label: "message", datatype: "tekst" },
  { key: "gedeactiveerd", label: "deactivated", datatype: "boolean" },
  BESCHRIJVING,
  OVERIG,
  KLEUR_VELD,
];

/** Regels onder de naam: de doelen, zoals Sparna ze toont. */
function doelRegels(element) {
  const d = element.data || {};
  const regels = [];
  if (d.doelklassen) regels.push(`→ ${d.doelklassen}`);
  if (d.ookKlasse) regels.push("→ (zichzelf, als klasse)");
  if (d.doelknopen) regels.push(`→ knoop ${d.doelknopen}`);
  if (d.doelSubjectenVan) regels.push(`→ subjecten van ${d.doelSubjectenVan}`);
  if (d.doelObjectenVan) regels.push(`→ objecten van ${d.doelObjectenVan}`);
  if (d.gesloten) regels.push("{closed}");
  if (d.gedeactiveerd) regels.push("{deactivated}");
  return regels.length ? [{ compartmentType: "doelen", velden: regels.map((naam) => ({ naam, fieldType: "doelregel" })) }] : [];
}

fieldTypes.push({ id: "doelregel", viewer: "tekst", properties: [{ key: "naam", datatype: "string" }] });

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "shapesgraaf",
    label: "Shapes graph",
    omschrijving: "Het SHACL-document: titel, beschrijving, prefixen en sh:declare (owl:Ontology).",
    kort: "GRAAF",
    stereotype: "«shapes graph»",
    shape: "class-box",
    kleur: "#e0e7ff",
    icoon: "package",
    properties: [
      IRI,
      { key: "titel", label: "titel (dct:title)", datatype: "string" },
      BESCHRIJVING,
      { key: "prefixen", label: "prefixen (één per regel: pfx: <iri>)", datatype: "tekst" },
      { key: "declaraties", label: "sh:declare (Turtle)", datatype: "tekst" },
      OVERIG,
      { key: "losseTriples", label: "losse triples (bij geen shape; Turtle)", datatype: "tekst" },
      KLEUR_VELD,
    ],
  },
  {
    id: "nodeshape",
    // Breder dan de standaard (280): paden en typen zijn CURIEs (zoals bij Sparna).
    minBreedte: 340,
    label: "Node shape",
    omschrijving: "Een sh:NodeShape: voorwaarden voor de knopen die hij als doel heeft; de property shapes zijn de regels.",
    kort: "NODE",
    stereotype: "«NodeShape»",
    shape: "class-box",
    kleur: "#dcfce7",
    icoon: "klasse",
    properties: NODE_PARAMETERS,
    compartments: [
      { id: "doelen", label: null, fieldType: "doelregel", alleenWeergave: true, verbergInInspector: true },
      { id: "eigenschappen", label: null, fieldType: "eigenschap" },
    ],
    hooks: { extraCompartimenten: doelRegels },
  },
  {
    id: "propertyshape",
    // Breder dan de standaard (280): paden en typen zijn CURIEs (zoals bij Sparna).
    minBreedte: 340,
    label: "Property shape (los)",
    omschrijving: "Een sh:PropertyShape met eigen doelen, niet binnen een node shape.",
    kort: "PROP",
    stereotype: "«PropertyShape»",
    shape: "class-box",
    kleur: "#fef9c3",
    icoon: "attribuut",
    properties: NODE_PARAMETERS.filter((p) => !["gesloten", "genegeerd", "ookKlasse"].includes(p.key)),
    compartments: [
      { id: "doelen", label: null, fieldType: "doelregel", alleenWeergave: true, verbergInInspector: true },
      { id: "eigenschappen", label: null, fieldType: "eigenschap" },
    ],
    hooks: { extraCompartimenten: doelRegels },
  },
  {
    id: "klasse",
    label: "Klasse",
    omschrijving: "Een klasse uit sh:class waar geen shape op richt; alleen het doel van een pijl.",
    kort: "KL",
    stereotype: "«class»",
    shape: "class-box",
    kleur: "#f1f5f9",
    icoon: "klasse",
    properties: [IRI, BESCHRIJVING, KLEUR_VELD],
  },
  {
    // Specialiseert de superprofiel-constraint (zoals ArchiMate en MIM): de
    // specificatie is het SHACL-fragment of de SPARQL-query zelf.
    id: "constraint",
    label: "Constraint",
    omschrijving: "SHACL-constraint die niet in een regel past (sh:or, sh:xone, sh:and, sh:not, sh:sparql); de body is het fragment zelf.",
    kort: "{ }",
    shape: "constraint",
    taakbalkGroep: "annotatie",
    minBreedte: 100,
    minHoogte: 44,
    verwijstNaar: false,
    properties: [
      { key: "specificatie", label: "specificatie", datatype: "tekst" },
      {
        key: "taal",
        label: "taal",
        datatype: "keuze",
        opties: [
          { waarde: "SHACL", label: "SHACL (Turtle-fragment)" },
          { waarde: "SPARQL", label: "SPARQL (sh:select / sh:ask)" },
          { waarde: "", label: "natuurlijke taal" },
        ],
      },
      { key: "message", label: "message", datatype: "tekst" },
      { key: "severity", label: "severity", datatype: "keuze", opties: ERNST_OPTIES },
      { key: "prefixen", label: "sh:prefixes", datatype: "string" },
      OVERIG,
      KLEUR_VELD,
    ],
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
    // Afgeleid uit een regel met sh:class of sh:node (afleiding.js).
    id: "verwijzing",
    label: "eigenschap → shape/klasse",
    kort: "pad",
    shape: "edge",
    icoon: "verwijzing",
    isConnector: true,
    bron: { elementTypes: SHAPE_ELEMENTEN },
    doel: { elementTypes: ["nodeshape", "propertyshape", "klasse"] },
    edgePresentatie: { lijn: "solid", kleur: "#15803d", markerEnd: "pijl-open" },
    properties: [
      { key: "rolnaam", label: "pad", datatype: "string" },
      { key: "kardinaliteit", label: "kardinaliteit", datatype: "string" },
      { key: "soort", label: "via", datatype: "string" },
    ],
    hooks: {
      edgeLabels: (conn) => {
        const d = conn.data || {};
        const kaal = [];
        if (d.rolnaam) kaal.push({ zijde: "bron", delen: [{ tekst: d.rolnaam, soort: "rolnaam" }] });
        const doel = [];
        if (d.kardinaliteit) doel.push({ tekst: d.kardinaliteit, soort: "kardinaliteit" });
        if (d.of) doel.push({ tekst: "{or}", soort: "constraint" });
        if (doel.length) kaal.push({ zijde: "doel", delen: doel });
        if (d.soort === "node") kaal.push({ zijde: "midden", delen: [{ tekst: "«node»", soort: "constraint", kleur: "#15803d" }] });
        return { bron: [], doel: [], kaal };
      },
    },
  },
  {
    // sh:node op node-niveau: de knoop moet ook aan die shape voldoen.
    id: "node",
    label: "sh:node",
    kort: "node",
    shape: "edge",
    icoon: "realisatie",
    isConnector: true,
    bron: { elementTypes: SHAPE_ELEMENTEN },
    doel: { elementTypes: SHAPE_ELEMENTEN },
    edgePresentatie: {
      lijn: "dash-6-3",
      kleur: "#7c3aed",
      markerEnd: "driehoek",
      labels: [{ zijde: "midden", delen: [{ tekst: "«node»", soort: "constraint", kleur: "#7c3aed" }] }],
    },
  },
  {
    // rdfs:subClassOf, alleen als het bestand die zelf noemt (impliciete klassedoelen).
    id: "subklasse",
    label: "rdfs:subClassOf",
    kort: "▷ sub",
    shape: "edge",
    icoon: "generalisatie",
    isConnector: true,
    bron: { elementTypes: ["nodeshape", "klasse"] },
    doel: { elementTypes: ["nodeshape", "klasse"] },
    edgePresentatie: { lijn: "solid", kleur: "#475569", markerEnd: "driehoek" },
  },
];

/** Aantal regels in de node, voor de rijhoogte van de layout. */
function regelAantal(element) {
  let n = 0;
  for (const c of element?.compartimenten || []) n += (c.velden || []).length;
  return n + doelRegels(element || {}).reduce((som, c) => som + c.velden.length, 0);
}

/**
 * Rijen-layout (auto-layout én import): de shapes waar niets naar wijst
 * bovenaan, daaronder per verwijzingsstap een rij; klassen zonder shape en
 * losse constraints volgen hun bron. De rijhoogte volgt het langste element.
 *
 * @param {{ids: string[], elements: Record<string, any>, edges: {source: string, target: string}[], perRij?: number}} opties
 * @returns {Record<string, {x: number, y: number}>}
 */
export function shaclRijenPosities({ ids, elements, edges, perRij = 5 }) {
  const idSet = new Set(ids);
  const uitgaand = new Map();
  const inkomend = new Map();
  for (const e of edges || []) {
    if (!idSet.has(e.source) || !idSet.has(e.target) || e.source === e.target) continue;
    if (!uitgaand.has(e.source)) uitgaand.set(e.source, []);
    uitgaand.get(e.source).push(e.target);
    if (!inkomend.has(e.target)) inkomend.set(e.target, []);
    inkomend.get(e.target).push(e.source);
  }
  const soort = (id) => elements?.[id]?.elementType;
  const laag = new Map();
  ids.filter((id) => soort(id) === "shapesgraaf").forEach((id) => laag.set(id, -1));
  let rand = ids.filter((id) => SHAPE_ELEMENTEN.includes(soort(id)) && !(inkomend.get(id) || []).length);
  if (!rand.length) rand = ids.filter((id) => SHAPE_ELEMENTEN.includes(soort(id))).slice(0, 1);
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
  // Wat nergens aan hangt: shapes in een kring zonder ingang, dan de rest onderaan.
  for (const id of ids) {
    if (laag.has(id)) continue;
    const bronnen = (inkomend.get(id) || []).filter((b) => laag.has(b));
    if (bronnen.length) laag.set(id, Math.max(...bronnen.map((b) => laag.get(b))) + 1);
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
        posities[id] = { x: 80 + i * 440, y };
      });
      const hoogste = Math.max(0, ...rij.map((id) => regelAantal(elements?.[id])));
      y += Math.max(160, 90 + hoogste * 22) + 70;
    }
  }
  return posities;
}

export const shaclDiagramType = {
  id: SHACL_ID,
  label: "SHACL",
  style: "uml-klassiek",
  randAanhechting: "zwevend",
  fieldTypes,
  elementTypes,
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
    { id: "auto-layout", label: "Auto-layout", acties: "layouts" },
  ],
  layouts: [
    {
      id: "shacl-lagen",
      label: "Auto-layout",
      run: ({ flowNodes, flowEdges, elements }) =>
        shaclRijenPosities({
          ids: flowNodes.filter((n) => !n.hidden).map((n) => n.id),
          elements,
          edges: flowEdges || [],
        }),
    },
  ],
  hooks: {
    /**
     * Na elke wijziging (en bij laden, en in de tekenaar): de weergave van de
     * regels en de verwijzing-pijlen opnieuw uit de parameters. Idempotent.
     */
    migreerModel: (state) => {
      const elements = leidAf(state?.elements);
      return elements ? { elements, diagrams: state.diagrams, meta: state.meta } : null;
    },
  },
};

let _teller = 0;

const STARTNAMEN = {
  shapesgraaf: "Shapes",
  nodeshape: "NieuweShape",
  propertyshape: "NieuweEigenschap",
  klasse: "ex:Klasse",
  constraint: "",
  boundary: "Kader",
};

/** Nieuw (niet-connector-)element van het gegeven type. */
export function maakElement(elementTypeId) {
  const et = elementTypes.find((t) => t.id === elementTypeId);
  if (!et || et.isConnector) return null;
  _teller += 1;
  const element = {
    id: `shacl_${Date.now()}_${_teller}`,
    naam: STARTNAMEN[et.id] ?? et.label,
    elementType: et.id,
    compartimenten: [],
    data: {},
  };
  if (et.id === "constraint") element.data = { specificatie: "", taal: "SHACL" };
  if (et.id === "nodeshape") element.data = { getypeerd: true }; // schrijft `a sh:NodeShape`
  if (et.id === "propertyshape") {
    element.compartimenten = [{ compartmentType: "eigenschappen", velden: [{ naam: "ex:eigenschap", fieldType: "eigenschap", data: {} }] }];
  }
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerShacl() {
  if (!getDiagramType(SHACL_ID)) {
    registreerDiagramType(shaclDiagramType);
  }
}
