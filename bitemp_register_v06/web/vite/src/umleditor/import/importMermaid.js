/**
 * importMermaid.js — Mermaid class diagram → RawUML → editor.
 *
 * Pure parser: vertaalt Mermaid-syntax naar een {@link RawUMLModel}, en
 * delegeert daarna alle interpretatie aan {@link rawUMLNaarEditor}. Dit
 * bestand bevat geen kennis van editor-conventies (kleuren, IDs, edge-flags).
 *
 * Ondersteunt:
 *   - `class Foo { <<stereotype>>  +type naam }`
 *   - `Foo --> Bar : label`
 *   - `Foo "1" --> "0..*" Bar : label`
 *   - `Foo *-- Bar` (compositie), `Foo o-- Bar` (aggregatie)
 *   - `Foo ..> Bar` (dependency), `Foo <|-- Bar` (generalisatie)
 *
 * @module import/importMermaid
 */

import { rawUMLNaarEditor } from "./rawuml";

/**
 * Parseer Mermaid class diagram tekst en retourneer { nodes, edges } voor
 * de editor.
 *
 * @param {string} text
 * @returns {{ nodes: Array, edges: Array }}
 */
export function importVanMermaid(text) {
  return rawUMLNaarEditor(mermaidNaarRaw(text));
}

/**
 * Pure parser: Mermaid → RawUML. Doet geen enkele editor-interpretatie.
 *
 * @param {string} text
 * @returns {import("./rawuml").RawUMLModel}
 */
export function mermaidNaarRaw(text) {
  const lines = String(text || "").split("\n").map((l) => l.trimEnd());
  /** @type {import("./rawuml").RawUMLNode[]} */
  const nodes = [];
  /** @type {import("./rawuml").RawUMLEdge[]} */
  const edges = [];
  const waarschuwingen = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip lege regels, header en comments.
    if (!line || line === "classDiagram" || line.startsWith("%%")) {
      i++;
      continue;
    }

    // Class-blok: "class Foo {"
    const classMatch = line.match(/^\s*class\s+(\w+)\s*\{/);
    if (classMatch) {
      const naam = classMatch[1];
      const { node, endIndex } = parseClassBlock(naam, lines, i);
      nodes.push(node);
      i = endIndex + 1;
      continue;
    }

    // Relatie. Regex matcht óók pijlen met `|` (generalisatie: <|--, --|>).
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

  return { nodes, edges, bronFormaat: "mermaid", waarschuwingen };
}

// ----------------------------------------------------------------------------
// Block-parser
// ----------------------------------------------------------------------------

function parseClassBlock(naam, lines, startIdx) {
  const stereotypes = [];
  const velden = [];
  const enumWaarden = [];

  let j = startIdx + 1;
  while (j < lines.length) {
    const l = lines[j].trim();
    if (l === "}") break;

    // <<stereotype>> — kan komma-gescheiden zijn (`<<ent, materieel>>`).
    const stereoMatch = l.match(/^<<(.+?)>>/);
    if (stereoMatch) {
      stereoMatch[1]
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .forEach((s) => stereotypes.push(s));
      j++;
      continue;
    }

    // Veld: "+type naam" of "-type naam".
    const veldMatch = l.match(/^([+\-#~])\s*(\S+)\s+(\w+)(?:\s*=\s*"?([^"]*)"?)?$/);
    if (veldMatch) {
      const [, vis, type, veldnaam, defaultWaarde] = veldMatch;
      velden.push({
        naam: veldnaam,
        type,
        verplicht: vis === "+",
        defaultWaarde: defaultWaarde || undefined,
      });
      j++;
      continue;
    }

    // Anders: enum-waarde (los woord zonder type-marker).
    if (l && !l.startsWith("+") && !l.startsWith("-") && !l.startsWith("<<")) {
      enumWaarden.push(l);
    }
    j++;
  }

  /** @type {import("./rawuml").RawUMLNode} */
  const node = { naam, stereotypes, velden };
  if (enumWaarden.length > 0) node.enumWaarden = enumWaarden;
  return { node, endIndex: j };
}

// ----------------------------------------------------------------------------
// Pijl-conversie
// ----------------------------------------------------------------------------

/**
 * Converteer een Mermaid-pijl naar een {@link RawUMLEdge}.
 *
 * Generalisatie-richting wordt **hier al** omgedraaid zodat `bronNaam` altijd
 * het kind is en `doelNaam` altijd de ouder, conform de RawUML-conventie.
 *
 * @returns {import("./rawuml").RawUMLEdge | null}
 */
function pijlNaarRuwEdge(srcNaam, tgtNaam, leftKard, rightKard, arrow, label) {
  const isGeneralLeft = arrow.includes("<|");  // ouder links → omdraaien
  const isGeneralRight = arrow.includes("|>"); // ouder rechts → laten staan
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
