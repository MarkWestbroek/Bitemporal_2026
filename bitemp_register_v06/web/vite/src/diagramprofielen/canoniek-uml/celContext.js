// @ts-check
/**
 * celContext — contextvelden voor de CEL-expressie-editor in 0.5.
 *
 * Tegenhanger van berekenContextVelden in de oude IDE, maar dan op het
 * diagramcore-model: naast de eigen velden van het element ook de velden van
 * de "familie" — de gegevenselementen die via een compositie aan (de
 * parent-)entiteit hangen, als `GE.veld` (bv. `Naam.roepnaam`).
 *
 * Compositie-kennis komt uit twee bronnen:
 *  1. gematerialiseerde connector-elementen (elementType "compositie");
 *  2. gespiegelde presentatie-edges met een ruit (markerStart "ruit") —
 *     de fase 1-adaptervorm.
 */

function veldenVan(element) {
  const velden = [];
  for (const c of element?.compartimenten || []) {
    for (const v of c.velden || []) {
      if (v.naam) velden.push({ naam: v.naam, type: v.data?.typeLabel || "string" });
    }
  }
  return velden;
}

/**
 * @param {Record<string, Object>} elements
 * @param {Record<string, Object>} diagrams
 * @param {string} elementId
 * @returns {Array<{pad: string, type: string, bron: string}>}
 */
export function berekenCelContextVelden(elements, diagrams, elementId) {
  const zelf = elements?.[elementId];
  if (!zelf) return [];

  // Compositie-paren (entiteit → gegevenselement) verzamelen
  /** @type {Array<[string, string]>} */
  const composities = [];
  for (const el of Object.values(elements)) {
    if (el.elementType === "compositie" && el.source && el.target) {
      composities.push([el.source, el.target]);
    }
  }
  for (const d of Object.values(diagrams || {})) {
    for (const e of d.edges || []) {
      if (e.data?.presentatie?.markerStart === "ruit") composities.push([e.source, e.target]);
    }
  }

  const kinderenVan = (entId) =>
    composities.filter(([bron]) => bron === entId).map(([, doel]) => doel);
  const ouderVan = (geId) => composities.find(([, doel]) => doel === geId)?.[0] || null;

  const resultaat = [];

  // Eigen velden (simpel pad)
  for (const v of veldenVan(zelf)) resultaat.push({ pad: v.naam, type: v.type, bron: "eigen" });

  // Familie: kinderen van de (parent-)entiteit, als GE.veld
  const entId = zelf.elementType === "entiteit" ? elementId : ouderVan(elementId);
  if (entId) {
    const ent = elements[entId];
    if (ent && entId !== elementId) {
      for (const v of veldenVan(ent)) resultaat.push({ pad: v.naam, type: v.type, bron: ent.naam });
    }
    for (const geId of new Set(kinderenVan(entId))) {
      if (geId === elementId) continue;
      const ge = elements[geId];
      if (!ge?.naam) continue;
      for (const v of veldenVan(ge)) {
        resultaat.push({ pad: `${ge.naam}.${v.naam}`, type: v.type, bron: ge.naam });
      }
    }
  }
  return resultaat;
}
