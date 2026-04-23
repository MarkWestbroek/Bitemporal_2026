/**
 * importPlantUML.js — Importeer PlantUML class diagram syntax naar editor nodes + edges.
 *
 * Ondersteunt:
 *   - class Foo <<entiteit>> { ... }
 *   - enum Foo { ... }
 *   - class Foo <<datatype>> { ... }
 *   - Foo "1" --> "0..*" Bar : label
 *   - Foo *-- Bar : compositie
 *   - Foo ..> Bar : dependency
 *
 * @module import/importPlantUML
 */

import { generateId, defaultKleur } from "../metamodel/types";

/**
 * Parseer PlantUML class diagram tekst en retourneer { nodes, edges }.
 *
 * @param {string} text - PlantUML class diagram syntax
 * @returns {{ nodes: Array, edges: Array }}
 */
export function importVanPlantUML(text) {
  const lines = text.split("\n").map((l) => l.trimEnd());
  const nodes = [];
  const edges = [];
  const naamNaarId = new Map();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip lege, directief-regels en @startuml/@enduml
    if (
      !line ||
      line.startsWith("@") ||
      line.startsWith("'") ||
      line.startsWith("skinparam") ||
      line.startsWith("hide") ||
      line.startsWith("show") ||
      line.startsWith("title") ||
      line.startsWith("note")
    ) {
      i++;
      continue;
    }

    // Enum-blok: "enum Foo {"
    const enumMatch = line.match(/^\s*enum\s+(\w+)\s*\{/);
    if (enumMatch) {
      const naam = enumMatch[1];
      const { node, endIndex } = parseEnumBlock(naam, lines, i);
      nodes.push(node);
      naamNaarId.set(naam, node.id);
      i = endIndex + 1;
      continue;
    }

    // Class-blok: "class Foo <<entiteit, materieel>> {"
    const classMatch = line.match(
      /^\s*class\s+(\w+)\s*(?:<<([^>]*)>>)?\s*\{/
    );
    if (classMatch) {
      const naam = classMatch[1];
      const stereotypes = (classMatch[2] || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const { node, endIndex } = parseClassBlock(naam, stereotypes, lines, i);
      nodes.push(node);
      naamNaarId.set(naam, node.id);
      i = endIndex + 1;
      continue;
    }

    // Relatie: Foo "1" --> "0..*" Bar : label
    // Of: Foo --> Bar : label
    // Of: Foo *-- Bar
    const relMatch = line.match(
      /^\s*(\w+)\s*(?:"([^"]*)")?\s*([\-\.\*<>o|]+)\s*(?:"([^"]*)")?\s*(\w+)\s*(?::\s*(.*))?$/
    );
    if (relMatch) {
      const [, srcNaam, leftKard, arrow, rightKard, tgtNaam, label] = relMatch;
      edges.push(
        maakEdge(srcNaam, tgtNaam, leftKard, rightKard, arrow, label)
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

function parseEnumBlock(naam, lines, startIdx) {
  const waarden = [];
  let j = startIdx + 1;
  while (j < lines.length) {
    const l = lines[j].trim();
    if (l === "}") break;
    if (l) waarden.push(l);
    j++;
  }
  const nodeId = generateId("enum");
  return {
    node: {
      id: nodeId,
      type: "enumeratie",
      position: { x: 0, y: 0 },
      data: { naam, waarden },
    },
    endIndex: j,
  };
}

function parseClassBlock(naam, stereotypes, lines, startIdx) {
  const velden = [];
  const isMaterieel = stereotypes.includes("materieel");
  const isDatatype = stereotypes.includes("datatype");

  // Bepaal metatype uit stereotypes
  let metatype = "entiteit";
  if (stereotypes.includes("gegevenselement")) metatype = "gegevenselement";
  if (stereotypes.includes("relatie")) metatype = "relatie";

  let j = startIdx + 1;
  while (j < lines.length) {
    const l = lines[j].trim();
    if (l === "}") break;

    // Veld: "+ naam : type" of "- naam : type"
    const veldMatch = l.match(/^([+\-#~])\s+(\w+)\s*:\s*(.+)$/);
    if (veldMatch) {
      const [, vis, veldnaam, typeStr] = veldMatch;
      velden.push({
        naam: veldnaam,
        type: mapPlantType(typeStr.trim()),
        format: mapPlantFormat(typeStr.trim()),
        enum: null,
        verplicht: vis === "+",
        autoIncrement: false,
        description: "",
      });
    }
    j++;
  }

  const nodeId = generateId(isDatatype ? "datatype" : metatype);

  if (isDatatype) {
    const basistypeVeld = velden.find((v) => v.naam === "basistype");
    const formatVeld = velden.find((v) => v.naam === "format");
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
          format: formatVeld?.description || "",
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

function maakEdge(srcNaam, tgtNaam, leftKard, rightKard, arrow, label) {
  const isDependency = arrow.includes("..");
  const kard = rightKard || leftKard || "0..*";

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

function mapPlantType(typeStr) {
  const t = (typeStr || "").toLowerCase();
  if (t === "int" || t === "integer") return "integer";
  if (t === "float64" || t === "number" || t === "float" || t === "double") return "number";
  if (t === "bool" || t === "boolean") return "boolean";
  return "string";
}

function mapPlantFormat(typeStr) {
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
