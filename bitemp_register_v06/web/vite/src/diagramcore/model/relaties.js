// @ts-check
/**
 * relaties — pure logica achter het relatiepaneel en het (terug)zetten van
 * elementen op een diagram (2026-10-13). Node-testbaar; de activiteit
 * (studio/activities/maakDiagramActiviteit.jsx) levert stores en handelingen.
 */

/**
 * De relaties van/naar een element, met hun stand op een diagram.
 *   - zichtbaar: beide uiteinden op het diagram, lijn getekend
 *   - verborgen: beide uiteinden op het diagram, lijn alleen daar verborgen
 *   - buiten:    een van de uiteinden staat niet op het diagram
 * Volgorde: eerst uitgaand, dan inkomend; daarbinnen op typelabel.
 *
 * @param {string} elementId
 * @param {Record<string, any>} elements
 * @param {any} diagram
 * @param {Record<string, any>} elementTypesById
 * @returns {Array<{id: string, typeLabel: string, richting: "uit"|"in", naam: string, anderNaam: string, stand: "zichtbaar"|"verborgen"|"buiten"}>}
 */
export function relatiesVan(elementId, elements, diagram, elementTypesById) {
  const opDiagram = new Set((diagram?.nodes || []).map((n) => n.elementId));
  const verborgen = new Set(diagram?.verborgenConnectoren || []);
  /** @type {any[]} */
  const uit = [];
  for (const c of Object.values(elements || {})) {
    if (!c?.source || !c?.target || !elementTypesById?.[c.elementType]?.isConnector) continue;
    if (c.source !== elementId && c.target !== elementId) continue;
    const richting = c.source === elementId ? "uit" : "in";
    const anderId = richting === "uit" ? c.target : c.source;
    const ander = elements[anderId];
    const stand = !opDiagram.has(elementId) || !opDiagram.has(anderId) ? "buiten" : verborgen.has(c.id) ? "verborgen" : "zichtbaar";
    uit.push({
      id: c.id,
      typeLabel: elementTypesById[c.elementType]?.label || c.elementType,
      richting,
      naam: c.naam || "",
      anderNaam: ander?.naam || anderId,
      stand,
    });
  }
  return uit.sort((a, b) => (a.richting === b.richting ? a.typeLabel.localeCompare(b.typeLabel) : a.richting === "uit" ? -1 : 1));
}

/**
 * Welke op dit diagram verborgen verbindingen raken dit element? Bij het
 * terugzetten van het element komen die weer mee (voorkeur "relaties mee
 * terug", Studio-instellingen → Modelleren).
 * @param {any} diagram
 * @param {Record<string, any>} elements
 * @param {string} elementId
 * @returns {string[]}
 */
export function verborgenRelatiesVan(diagram, elements, elementId) {
  return (diagram?.verborgenConnectoren || []).filter((cid) => {
    const c = elements?.[cid];
    return !!c && (c.source === elementId || c.target === elementId);
  });
}
