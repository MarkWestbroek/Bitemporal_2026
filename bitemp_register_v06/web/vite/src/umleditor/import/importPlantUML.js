/**
 * importPlantUML.js — PlantUML class diagram → RawUML → editor.
 *
 * Pure parser: vertaalt PlantUML-syntax naar een {@link RawUMLModel}, en
 * delegeert daarna alle interpretatie aan {@link rawUMLNaarEditor}.
 *
 * Ondersteunt:
 *   - `class Foo <<entiteit>> { ... }`
 *   - `enum Foo { ... }`
 *   - `class Foo <<datatype>> { ... }`
 *   - `Foo "1" --> "0..*" Bar : label`
 *   - `Foo *-- Bar` (compositie), `Foo o-- Bar` (aggregatie)
 *   - `Foo ..> Bar` (dependency), `Foo <|-- Bar` (generalisatie)
 *
 * @module import/importPlantUML
 */

import { rawUMLNaarEditor } from "./rawuml";

/**
 * Parseer PlantUML class diagram tekst en retourneer { nodes, edges } voor
 * de editor.
 *
 * @param {string} text
 * @returns {{ nodes: Array, edges: Array }}
 */
export function importVanPlantUML(text) {
  return rawUMLNaarEditor(plantumlNaarRaw(text));
}

/**
 * Pure parser: PlantUML → RawUML.
 *
 * @param {string} text
 * @returns {import("./rawuml").RawUMLModel}
 */
export function plantumlNaarRaw(text) {
  const lines = String(text || "").split("\n").map((l) => l.trimEnd());
  /** @type {import("./rawuml").RawUMLNode[]} */
  const nodes = [];
  /** @type {import("./rawuml").RawUMLEdge[]} */
  const edges = [];
  const waarschuwingen = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip lege regels en directieven.
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
      i = endIndex + 1;
      continue;
    }

    // Class-blok: "class Foo <<entiteit, materieel>> {"
    const classMatch = line.match(/^\s*class\s+(\w+)\s*(?:<<([^>]*)>>)?\s*\{/);
    if (classMatch) {
      const naam = classMatch[1];
      const stereotypes = (classMatch[2] || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const { node, endIndex } = parseClassBlock(naam, stereotypes, lines, i);
      nodes.push(node);
      i = endIndex + 1;
      continue;
    }

    // Relatie.
    const relMatch = line.match(
      /^\s*(\w+)\s*(?:"([^"]*)")?\s*([\-\.\*<>o|]+)\s*(?:"([^"]*)")?\s*(\w+)\s*(?::\s*(.*))?$/
    );
    if (relMatch) {
      const [, srcNaam, leftKard, arrow, rightKard, tgtNaam, label] = relMatch;
      const edge = pijlNaarRuwEdge(srcNaam, tgtNaam, leftKard, rightKard, arrow, label);
      if (edge) edges.push(edge);
      i++;
      continue;
    }

    i++;
  }

  return { nodes, edges, bronFormaat: "plantuml", waarschuwingen };
}

// ----------------------------------------------------------------------------
// Block-parsers
// ----------------------------------------------------------------------------

function parseEnumBlock(naam, lines, startIdx) {
  const enumWaarden = [];
  let j = startIdx + 1;
  while (j < lines.length) {
    const l = lines[j].trim();
    if (l === "}") break;
    if (l) enumWaarden.push(l);
    j++;
  }
  /** @type {import("./rawuml").RawUMLNode} */
  const node = { naam, stereotypes: ["enumeration"], enumWaarden };
  return { node, endIndex: j };
}

function parseClassBlock(naam, stereotypes, lines, startIdx) {
  const velden = [];
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
        type: typeStr.trim(),
        verplicht: vis === "+",
      });
    }
    j++;
  }
  /** @type {import("./rawuml").RawUMLNode} */
  const node = { naam, stereotypes, velden };
  return { node, endIndex: j };
}

// ----------------------------------------------------------------------------
// Pijl-conversie (identiek aan Mermaid; PlantUML deelt de syntax)
// ----------------------------------------------------------------------------

function pijlNaarRuwEdge(srcNaam, tgtNaam, leftKard, rightKard, arrow, label) {
  const isGeneralLeft = arrow.includes("<|");
  const isGeneralRight = arrow.includes("|>");
  const isGeneralization = isGeneralLeft || isGeneralRight;
  const isDependency = arrow.includes("..") && !isGeneralization;
  const isCompositie = arrow.includes("*") && !isGeneralization;
  const isAggregatie = arrow.includes("o") && !isGeneralization;

  if (isGeneralization) {
    return {
      bronNaam: isGeneralLeft ? tgtNaam : srcNaam,
      doelNaam: isGeneralLeft ? srcNaam : tgtNaam,
      soort: "generalisatie",
      label: (label || "").trim(),
    };
  }

  /** @type {import("./rawuml").RawUMLEdgeSoort} */
  let soort = "associatie";
  if (isDependency) soort = "dependency";
  else if (isCompositie) soort = "compositie";
  else if (isAggregatie) soort = "aggregatie";

  return {
    bronNaam: srcNaam,
    doelNaam: tgtNaam,
    soort,
    bronKardinaliteit: leftKard || undefined,
    doelKardinaliteit: rightKard || undefined,
    label: (label || "").trim() || undefined,
    doelRol: (label || "").trim() || undefined,
  };
}
