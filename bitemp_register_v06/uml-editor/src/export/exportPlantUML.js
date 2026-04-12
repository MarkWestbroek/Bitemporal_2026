/**
 * exportPlantUML.js — Converteer het editor-metamodel naar PlantUML class diagram syntax.
 *
 * PlantUML class diagrams: https://plantuml.com/class-diagram
 *
 * Mapping:
 *   - Entiteit, GE, Relatie → class met stereotype
 *   - Velden → attributen met type en zichtbaarheid
 *   - Enumeratie → enum blok
 *   - Gegevenstype → class met <<datatype>> stereotype
 *   - Edges → associaties met rolnaam en kardinaliteit
 *
 * @module export/exportPlantUML
 */

/**
 * Genereer een PlantUML class diagram string uit editor nodes + edges.
 *
 * @param {Array} nodes - React Flow nodes
 * @param {Array} edges - React Flow edges
 * @returns {string} PlantUML-syntax
 */
export function exportNaarPlantUML(nodes, edges) {
  const lines = [
    "@startuml",
    "skinparam classAttributeIconSize 0",
    "skinparam classFontStyle bold",
    "hide empty methods",
    "",
  ];

  const enumNodes = nodes.filter((n) => n.type === "enumeratie");
  const datatypeNodes = nodes.filter((n) => n.type === "gegevenstype");

  // --- Classes ---
  for (const node of nodes) {
    if (["entiteit", "gegevenselement", "relatie"].includes(node.type)) {
      const d = node.data;
      const naam = sanitize(d.typenaam);
      const stereo = d.isMaterieel
        ? `<<${d.metatype}, materieel>>`
        : `<<${d.metatype}>>`;

      lines.push(`class ${naam} ${stereo} {`);
      for (const v of d.velden || []) {
        const vType = formatVeldType(v, enumNodes, datatypeNodes);
        const marker = v.verplicht ? "+" : "-";
        lines.push(`  ${marker} ${v.naam} : ${vType}`);
      }
      lines.push(`}`);
      lines.push("");
    }

    if (node.type === "enumeratie") {
      const naam = sanitize(node.data.naam);
      lines.push(`enum ${naam} {`);
      for (const w of node.data.waarden || []) {
        lines.push(`  ${w}`);
      }
      lines.push(`}`);
      lines.push("");
    }

    if (node.type === "gegevenstype") {
      const d = node.data;
      const naam = sanitize(d.naam);
      lines.push(`class ${naam} <<datatype>> {`);
      lines.push(`  + basistype : ${d.basistype || "string"}`);
      if (d.format) lines.push(`  + format : ${d.format}`);
      if (d.validatie?.pattern) lines.push(`  + pattern : String`);
      if (d.normalisatie) lines.push(`  + normalisatie : ${d.normalisatie}`);
      lines.push(`}`);
      lines.push("");
    }
  }

  // --- Relaties (edges) ---
  for (const edge of edges) {
    const source = sanitize(edgeEndpointName(edge.source, nodes));
    const target = sanitize(edgeEndpointName(edge.target, nodes));
    const d = edge.data || {};

    // Generalisatie-edge: kind --|> ouder
    if (d.isGeneralization) {
      lines.push(`${target} <|-- ${source}`);
      continue;
    }

    const label = d.rolnaam || "";
    const kard = d.kardinaliteit || "*";

    // PlantUML associatie: Source "1" --> "0..*" Target : rolnaam
    if (label) {
      lines.push(`${source} "1" --> "${kard}" ${target} : ${label}`);
    } else {
      lines.push(`${source} "1" --> "${kard}" ${target}`);
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
            lines.push(`${naam} ..> ${sanitize(match.data.naam)} : <<use>>`);
            usedDeps.add(depKey);
          }
        }
      }
      if (v.format) {
        const match = datatypeNodes.find((dt) => dt.data.format === v.format);
        if (match) {
          const depKey = `${naam}->${sanitize(match.data.naam)}`;
          if (!usedDeps.has(depKey)) {
            lines.push(`${naam} ..> ${sanitize(match.data.naam)} : <<use>>`);
            usedDeps.add(depKey);
          }
        }
      }
    }
  }

  lines.push("");
  lines.push("@enduml");
  return lines.join("\n");
}

// --- Helpers ---

function sanitize(name) {
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
    return `${veld.type} {${veld.format}}`;
  }
  return veld.type || "String";
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
