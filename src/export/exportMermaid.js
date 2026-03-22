/**
 * exportMermaid.js — Converteer het editor-metamodel naar Mermaid class diagram syntax.
 *
 * Mermaid class diagrams: https://mermaid.js.org/syntax/classDiagram.html
 *
 * Mapping:
 *   - Entiteit, GE, Relatie → class met stereotype-annotatie
 *   - Velden → attributen met type en zichtbaarheid
 *   - Enumeratie → class met <<enumeration>> stereotype
 *   - Gegevenstype → class met <<datatype>> stereotype
 *   - Edges → relatie-pijlen met rolnaam en kardinaliteit
 *
 * @module export/exportMermaid
 */

/**
 * Genereer een Mermaid class diagram string uit editor nodes + edges.
 *
 * @param {Array} nodes - React Flow nodes
 * @param {Array} edges - React Flow edges
 * @returns {string} Mermaid-syntax
 */
export function exportNaarMermaid(nodes, edges) {
  const lines = ["classDiagram"];

  const enumNodes = nodes.filter((n) => n.type === "enumeratie");
  const datatypeNodes = nodes.filter((n) => n.type === "gegevenstype");

  // --- Classes ---
  for (const node of nodes) {
    if (["entiteit", "gegevenselement", "relatie"].includes(node.type)) {
      const d = node.data;
      const naam = sanitize(d.typenaam);
      lines.push("");
      lines.push(`  class ${naam} {`);
      lines.push(`    <<${d.metatype}>>`);
      if (d.isMaterieel) {
        lines.push(`    <<materieel>>`);
      }
      for (const v of d.velden || []) {
        const vType = formatVeldType(v, enumNodes, datatypeNodes);
        const marker = v.verplicht ? "+" : "-";
        lines.push(`    ${marker}${vType} ${v.naam}`);
      }
      lines.push(`  }`);
    }

    if (node.type === "enumeratie") {
      const naam = sanitize(node.data.naam);
      lines.push("");
      lines.push(`  class ${naam} {`);
      lines.push(`    <<enumeration>>`);
      for (const w of node.data.waarden || []) {
        lines.push(`    ${w}`);
      }
      lines.push(`  }`);
    }

    if (node.type === "gegevenstype") {
      const d = node.data;
      const naam = sanitize(d.naam);
      lines.push("");
      lines.push(`  class ${naam} {`);
      lines.push(`    <<datatype>>`);
      lines.push(`    +${d.basistype} basistype`);
      if (d.format) lines.push(`    +String format = "${d.format}"`);
      if (d.validatie?.pattern) lines.push(`    +String pattern`);
      if (d.normalisatie) lines.push(`    +String normalisatie = "${d.normalisatie}"`);
      lines.push(`  }`);
    }
  }

  // --- Relaties (edges) ---
  for (const edge of edges) {
    const source = sanitize(edgeEndpointName(edge.source, nodes));
    const target = sanitize(edgeEndpointName(edge.target, nodes));
    const d = edge.data || {};
    const label = d.rolnaam || "";
    const kard = d.kardinaliteit || "";

    // Mermaid kardinaliteit syntax: "1" -- "0..*"
    const sourceKard = "1";
    const targetKard = kard || "*";

    if (label) {
      lines.push(`  ${source} "${sourceKard}" --> "${targetKard}" ${target} : ${label}`);
    } else {
      lines.push(`  ${source} "${sourceKard}" --> "${targetKard}" ${target}`);
    }
  }

  // --- Dependencies (enum/datatype gebruik) ---
  const usedDeps = new Set();
  for (const node of nodes) {
    if (!["entiteit", "gegevenselement", "relatie"].includes(node.type)) continue;
    const naam = sanitize(node.data.typenaam);
    for (const v of node.data.velden || []) {
      if (v.enum && v.enum.length > 0) {
        const match = enumNodes.find((en) => arraysEqual(en.data.waarden, v.enum));
        if (match) {
          const depKey = `${naam}->${sanitize(match.data.naam)}`;
          if (!usedDeps.has(depKey)) {
            lines.push(`  ${naam} ..> ${sanitize(match.data.naam)} : uses`);
            usedDeps.add(depKey);
          }
        }
      }
      if (v.format) {
        const match = datatypeNodes.find((dt) => dt.data.format === v.format);
        if (match) {
          const depKey = `${naam}->${sanitize(match.data.naam)}`;
          if (!usedDeps.has(depKey)) {
            lines.push(`  ${naam} ..> ${sanitize(match.data.naam)} : uses`);
            usedDeps.add(depKey);
          }
        }
      }
    }
  }

  return lines.join("\n");
}

// --- Helpers ---

function sanitize(name) {
  // Mermaid class names: alleen alfanumeriek en underscores
  return (name || "Unnamed").replace(/[^a-zA-Z0-9_]/g, "_");
}

function formatVeldType(veld, enumNodes, datatypeNodes) {
  if (veld.enum && veld.enum.length > 0) {
    const match = enumNodes.find((en) => arraysEqual(en.data.waarden, veld.enum));
    if (match) return sanitize(match.data.naam);
  }
  if (veld.format) {
    const match = datatypeNodes.find((dt) => dt.data.format === veld.format);
    if (match) return sanitize(match.data.naam);
    return `${veld.type}~${veld.format}~`;
  }
  return veld.type || "string";
}

function arraysEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function edgeEndpointName(nodeId, nodes) {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return nodeId;
  return node.data?.typenaam || node.data?.naam || nodeId;
}
