/**
 * importMermaid.js — Importeer Mermaid class diagram syntax naar editor nodes + edges.
 *
 * Ondersteunt:
 *   - class Foo { <<stereotype>>  +type naam  }
 *   - Foo --> Bar : label
 *   - Foo "1" --> "0..*" Bar : label
 *   - Foo *-- Bar : compositie
 *   - Foo ..> Bar : dependency
 *
 * @module import/importMermaid
 */

import { generateId, defaultKleur } from "../metamodel/types";

/**
 * Parseer Mermaid class diagram tekst en retourneer { nodes, edges }.
 *
 * @param {string} text - Mermaid class diagram syntax
 * @returns {{ nodes: Array, edges: Array }}
 */
export function importVanMermaid(text) {
  const lines = text.split("\n").map((l) => l.trimEnd());
  const nodes = [];
  const edges = [];
  const naamNaarId = new Map();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip lege regels en header
    if (!line || line === "classDiagram" || line.startsWith("%%")) {
      i++;
      continue;
    }

    // Class-blok: "class Foo {" of "  class Foo {"
    const classMatch = line.match(/^\s*class\s+(\w+)\s*\{/);
    if (classMatch) {
      const naam = classMatch[1];
      const { node, endIndex } = parseClassBlock(naam, lines, i);
      nodes.push(node);
      naamNaarId.set(naam, node.id);
      i = endIndex + 1;
      continue;
    }

    // Relatie: Foo --> Bar : label  of  Foo "1" --> "0..*" Bar : label
    // Let op: | is vereist voor generalisatiepijlen (<|-- en --|>)
    const relMatch = line.match(
      /^\s*(\w+)\s*(?:"([^"]*)")?\s*([\-\.\*<>o|]+)\s*(?:"([^"]*)")?\s*(\w+)\s*(?::\s*(.*))?$/
    );
    if (relMatch) {
      const [, srcNaam, leftKard, arrow, rightKard, tgtNaam, label] = relMatch;
      edges.push(
        maakEdge(srcNaam, tgtNaam, leftKard, rightKard, arrow, label, naamNaarId)
      );
      i++;
      continue;
    }

    i++;
  }

  // Zorg dat alle gerefereerde namen een node hebben
  for (const edge of edges) {
    ensureNode(edge._srcNaam, nodes, naamNaarId);
    ensureNode(edge._tgtNaam, nodes, naamNaarId);
    edge.source = naamNaarId.get(edge._srcNaam);
    edge.target = naamNaarId.get(edge._tgtNaam);
    delete edge._srcNaam;
    delete edge._tgtNaam;
  }

  // Positioneer nodes in een raster
  nodes.forEach((n, idx) => {
    if (!n.position || (n.position.x === 0 && n.position.y === 0)) {
      n.position = autoPositie(idx);
    }
  });

  return { nodes, edges };
}

// ============================================================================

function parseClassBlock(naam, lines, startIdx) {
  let stereotype = "";
  let isMaterieel = false;
  const velden = [];
  const waarden = []; // voor enumeraties

  let j = startIdx + 1;
  while (j < lines.length) {
    const l = lines[j].trim();
    if (l === "}") break;

    // Stereotype: <<entiteit>>, <<enumeration>>, etc.
    const stereoMatch = l.match(/^<<(.+?)>>/);
    if (stereoMatch) {
      const s = stereoMatch[1].toLowerCase();
      if (s === "materieel") {
        isMaterieel = true;
      } else {
        stereotype = s;
      }
      j++;
      continue;
    }

    // Veld: +type naam of -type naam
    const veldMatch = l.match(/^([+\-#~])\s*(\S+)\s+(\w+)(?:\s*=\s*"?([^"]*)"?)?$/);
    if (veldMatch) {
      const [, vis, type, veldnaam] = veldMatch;
      velden.push({
        naam: veldnaam,
        type: mapMermaidType(type),
        format: mapMermaidFormat(type),
        enum: null,
        verplicht: vis === "+",
        autoIncrement: false,
        description: "",
      });
      j++;
      continue;
    }

    // Enum-waarde (geen type, geen marker): gewoon een woord
    if (l && !l.startsWith("+") && !l.startsWith("-") && !l.startsWith("<<")) {
      waarden.push(l);
    }

    j++;
  }

  const metatype = mapStereotype(stereotype);
  const isEnum = stereotype === "enumeration" || stereotype === "enum";
  const isDatatype = stereotype === "datatype";

  const nodeId = generateId(isEnum ? "enum" : isDatatype ? "datatype" : metatype);

  if (isEnum) {
    return {
      node: {
        id: nodeId,
        type: "enumeratie",
        position: { x: 0, y: 0 },
        data: { naam, waarden: waarden.length > 0 ? waarden : [] },
      },
      endIndex: j,
    };
  }

  if (isDatatype) {
    // Probeer basistype uit velden te halen
    const basistypeVeld = velden.find((v) => v.naam === "basistype");
    return {
      node: {
        id: nodeId,
        type: "gegevenstype",
        position: { x: 0, y: 0 },
        data: {
          id: nodeId,
          naam,
          description: "",
          basistype: basistypeVeld?.description || "string",
          format: "",
          validatie: {},
          normalisatie: "",
          weergave: {},
        },
      },
      endIndex: j,
    };
  }

  return {
    node: {
      id: nodeId,
      type: metatype,
      position: { x: 0, y: 0 },
      data: {
        id: nodeId,
        typenaam: naam,
        description: "",
        metatype,
        isMaterieel,
        kleur: defaultKleur(metatype),
        velden,
      },
    },
    endIndex: j,
  };
}

function maakEdge(srcNaam, tgtNaam, leftKard, rightKard, arrow, label, naamNaarId) {
  const isDependency = arrow.includes("..");

  // Detecteer generalisatie-pijlen (ook met ..):
  //   A <|-- B  of  A <|.. B  → A is ouder, B is kind  (srcNaam=A, tgtNaam=B) → omdraaien
  //   A --|> B  of  A ..|> B  → B is ouder, A is kind  (srcNaam=A, tgtNaam=B) → goed zo
  const isGeneralLeft  = arrow.includes("<|");  // ouder staat links  → omdraaien
  const isGeneralRight = arrow.includes("|>");  // ouder staat rechts → niet omdraaien
  const isGeneralization = isGeneralLeft || isGeneralRight;

  // Pas richting aan: source = kind, target = ouder (editor-conventie)
  const edgeSrcNaam = isGeneralLeft ? tgtNaam : srcNaam;
  const edgeTgtNaam = isGeneralLeft ? srcNaam : tgtNaam;

  const kard = rightKard || leftKard || "0..*";

  if (isGeneralization) {
    return {
      id: generateId("edge"),
      _srcNaam: edgeSrcNaam,
      _tgtNaam: edgeTgtNaam,
      source: null,
      target: null,
      type: "metamodel",
      data: {
        isGeneralization: true,
        naamLabelHeen: (label || "").trim(),
        naamLabelTerug: "",
      },
    };
  }

  return {
    id: generateId("edge"),
    _srcNaam: srcNaam,
    _tgtNaam: tgtNaam,
    source: null,
    target: null,
    type: "metamodel",
    data: {
      isDependency,
      rolnaam: (label || "").trim(),
      jsonRolnaam: "",
      momentvoorkomen: parseKard(kard),
      kardinaliteit: kard || "0..*",
    },
  };
}

function ensureNode(naam, nodes, naamNaarId) {
  if (naamNaarId.has(naam)) return;
  const nodeId = generateId("entiteit");
  naamNaarId.set(naam, nodeId);
  nodes.push({
    id: nodeId,
    type: "entiteit",
    position: { x: 0, y: 0 },
    data: {
      id: nodeId,
      typenaam: naam,
      description: "",
      metatype: "entiteit",
      isMaterieel: false,
      kleur: defaultKleur("entiteit"),
      velden: [],
    },
  });
}

function autoPositie(index) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { x: 50 + col * 300, y: 50 + row * 250 };
}

function mapStereotype(s) {
  if (s === "entiteit") return "entiteit";
  if (s === "gegevenselement") return "gegevenselement";
  if (s === "relatie") return "relatie";
  return "entiteit"; // default
}

function mapMermaidType(typeStr) {
  const t = (typeStr || "").toLowerCase();
  if (t === "int" || t === "integer") return "integer";
  if (t === "float64" || t === "number" || t === "float" || t === "double") return "number";
  if (t === "bool" || t === "boolean") return "boolean";
  return "string";
}

function mapMermaidFormat(typeStr) {
  const t = (typeStr || "").toLowerCase();
  if (t === "date" || t === "datum") return "date";
  if (t === "datetime") return "date-time";
  if (t === "float64") return "float64";
  return "";
}

function parseKard(kard) {
  if (kard === "0..*" || kard === "1..*" || kard === "*") return "meervoudig";
  return "enkelvoudig";
}
