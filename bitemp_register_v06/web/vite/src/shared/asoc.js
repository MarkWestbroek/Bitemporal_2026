// asoc.js — centrale helpers voor het ASOC (associatieklasse) patroon
//
// Single-source-of-truth voor de vraag: "krijgt een relatie de ASOC-vorm
// (anker + 3 edges + relatie-node met velden) of de collapsed-vorm
// (label op de edge midden tussen bron en doel)?"
//
// Regel: een relatie krijgt de ASOC-vorm zodra hij eigen velden heeft
// (vaste velden of afgeleide velden). Anders collapsed. Deze functie is
// het canonieke beslispunt — alle code die ASOC-edges bouwt, anker-
// elementen aanmaakt of edges classificeert moet hier doorheen.

/**
 * Bepaalt of een relatie als ASOC (associatieklasse) of collapsed wordt
 * gevisualiseerd.
 *
 * @param {object} rel - V3 relatie of editor-element met `velden` en
 *   `afgeleideVelden` (beide optioneel).
 * @returns {"asoc"|"collapsed"} de vorm waarmee de relatie getekend wordt.
 */
export function relatieVorm(rel) {
  if (!rel) return "collapsed";
  // Velden kunnen zowel direct op rel staan (V3) als onder rel.data (editor).
  const velden = rel.velden ?? rel.data?.velden ?? [];
  const afgeleideVelden = rel.afgeleideVelden ?? rel.data?.afgeleideVelden ?? [];
  const heeftEigenVelden = Array.isArray(velden) && velden.length > 0;
  const heeftAfgeleideVelden = Array.isArray(afgeleideVelden) && afgeleideVelden.length > 0;
  return heeftEigenVelden || heeftAfgeleideVelden ? "asoc" : "collapsed";
}

/**
 * Convenience: true als de relatie de ASOC-vorm krijgt.
 */
export function isAsoc(rel) {
  return relatieVorm(rel) === "asoc";
}

/**
 * Canoniek anker-element ID voor een relatie. Wordt gebruikt voor het
 * "associatieAnker" node-type dat het ruitje (◇) op de associatie-edge
 * representeert.
 */
export function asocAnkerId(relNaam) {
  return `anker_${relNaam}`;
}

/**
 * Geeft een element/object een herkenbaar boolean voor "is dit een
 * associatie-anker?". Handig om uit `elements` te filteren bij export.
 */
export function isAsocAnkerElementId(id) {
  return typeof id === "string" && id.startsWith("anker_");
}

/**
 * IDs voor de drie edges in het ASOC-patroon. Centraliseert de naamgeving
 * zodat code die edges aanmaakt en code die ze opzoekt dezelfde IDs gebruikt.
 *
 * - bronAssoc: edge bron-entiteit → anker (solid associatie-lijn)
 * - doelAssoc: edge anker → doel-entiteit (solid associatie-lijn,
 *   optioneel met directionele pijl)
 * - classLink: edge anker ╌╌ relatie-node (dashed association class link)
 */
export function asocEdgeIds(rel, bronEntId) {
  const ankerId = asocAnkerId(rel.naam);
  return {
    ankerId,
    bronAssoc: rel.id || `${bronEntId}->${ankerId}`,
    doelAssoc: rel.doelId || `${ankerId}->${rel.doelEntiteit}`,
    classLink: rel.classLinkId || `${ankerId}-->${rel.naam}`,
  };
}

/**
 * IDs voor de twee edges in het collapsed-patroon.
 */
export function collapsedEdgeIds(rel, bronEntId) {
  return {
    bronEdge: rel.id || `${bronEntId}->${rel.naam}`,
    doelEdge: rel.doelId || `${rel.naam}->${rel.doelEntiteit}`,
  };
}
