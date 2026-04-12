/**
 * schemaToGraph.js — Transformeert de /api/schema/model/code response naar
 * een nodes/links structuur voor react-force-graph-3d.
 *
 * Nodes: één per representatietype (entiteit, gegevenselement, relatie).
 * Links: (a) entiteit → onderliggende GE/relatie via "onderliggende",
 *        (b) relatie → secondaire entiteit via "doelEntiteit".
 */

// Standaardkleuren per metatype als de schema-entry geen kleur heeft
const DEFAULT_COLORS = {
  entiteit: "#60a5fa",         // blauw
  gegevenselement: "#a3e635",  // groen
  relatie: "#f472b6",          // roze
};

// Nodegrootte per metatype (val bepaalt bolgrootte in force-graph)
const NODE_VAL = {
  entiteit: 14,
  gegevenselement: 3,
  relatie: 5,
};

// Bol-radius per metatype (voor custom Three.js object)
export const NODE_RADIUS = {
  entiteit: 6,
  gegevenselement: 2,
  relatie: 3,
};

/**
 * Extraheert de unieke domeinen uit de schema types.
 * @param {{ types: Array }} schema
 * @returns {string[]}
 */
export function extractDomains(schema) {
  if (!schema || !Array.isArray(schema.types)) return [];
  const set = new Set();
  for (const t of schema.types) {
    if (t.domein) set.add(t.domein);
  }
  return [...set].sort();
}

/**
 * Transformeert het schema naar nodes en links voor de 3D force-graph.
 * Alle types worden altijd opgenomen; domeinfiltering gebeurt via nodeVisibility.
 *
 * @param {{ types: Array }} schema — /api/schema/model/code response
 * @returns {{ nodes: Array, links: Array }}
 */
export function schemaToGraph(schema) {
  if (!schema || !Array.isArray(schema.types)) {
    return { nodes: [], links: [] };
  }

  const typeSet = new Set(schema.types.map((t) => t.typenaam));

  const nodes = schema.types.map((t) => ({
    id: t.typenaam,
    label: t.typenaam,
    color: t.kleur || DEFAULT_COLORS[t.metatype] || "#94a3b8",
    val: NODE_VAL[t.metatype] || 3,
    metatype: t.metatype,
    description: t.description || "",
    domein: t.domein || "",
    padnaam: t.padnaam || "",
    meervoud: t.meervoud || "",
  }));

  const links = [];

  for (const t of schema.types) {
    // (a) Onderliggende gegevenselementen/relaties: entiteit → doeltype
    if (Array.isArray(t.onderliggende)) {
      for (const child of t.onderliggende) {
        if (typeSet.has(child.doeltype)) {
          links.push({
            source: t.typenaam,
            target: child.doeltype,
            label: child.jsonRolnaam || child.rolnaam,
            color: "rgba(148,163,184,0.45)",
          });
        }
      }
    }

    // (b) Relaties: verbind met de doelentiteit (secondaire entiteit)
    if (t.metatype === "relatie" && t.doelEntiteit && typeSet.has(t.doelEntiteit)) {
      links.push({
        source: t.typenaam,
        target: t.doelEntiteit,
        label: "→ " + t.doelEntiteit,
        color: "rgba(244,114,182,0.65)",
      });
    }
  }

  return { nodes, links };
}
