// @ts-check
/**
 * materialiseerConnectoren — leidt visuele edges af van connector-elementen.
 *
 * Connectoren zijn elementen met source/target (metamodel §2). Fase 2
 * materialiseert alleen de **kale vorm**: één edge tussen bron en doel, met de
 * declaratieve `edgePresentatie` uit het connector-ElementType. Connectoren
 * mét compartimenten (het ASOC-patroon: node + drie edges) volgen in fase 3.
 *
 * Puur en store-loos: testbaar met kale objecten.
 */

/**
 * Zoek het connector-ElementType dat een verbinding bron→doel toestaat.
 *
 * @param {Object} diagramType     - DiagramType-descriptor
 * @param {Object} bronElement     - core-Element (bron)
 * @param {Object} doelElement     - core-Element (doel)
 * @param {string|null} [voorkeur] - expliciet gekozen connector-type (taakbalk
 *   "Verbinding"); als die niet past, wordt er NIET teruggevallen op een ander
 *   type — de keuze van de gebruiker is leidend.
 * @returns {Object|null} het passende ElementType, of null
 */
export function vindConnectorType(diagramType, bronElement, doelElement, voorkeur = null) {
  if (!bronElement || !doelElement) return null;
  const kandidaten = (diagramType?.elementTypes || []).filter((et) => et.isConnector);
  const past = (et) =>
    (et.bron?.elementTypes || []).includes(bronElement.elementType) &&
    (et.doel?.elementTypes || []).includes(doelElement.elementType);
  if (voorkeur) {
    const gekozen = kandidaten.find((et) => et.id === voorkeur);
    return gekozen && past(gekozen) ? gekozen : null;
  }
  return kandidaten.find(past) || null;
}

/**
 * Bouw visuele edges voor alle connector-elementen waarvan bron én doel op
 * het diagram staan.
 *
 * @param {Record<string, Object>} elements - core-elementen
 * @param {Object} diagram                  - core-Diagram
 * @param {Record<string, Object>} elementTypesById
 * @returns {Array<Object>} React Flow-compatibele edges (type wordt door de
 *   canvas gezet)
 */
export function materialiseerConnectoren(elements, diagram, elementTypesById) {
  const opDiagram = new Set((diagram?.nodes || []).map((n) => n.elementId));
  const edges = [];
  for (const el of Object.values(elements || {})) {
    const et = elementTypesById[el.elementType];
    if (!et?.isConnector || !el.source || !el.target) continue;
    if (!opDiagram.has(el.source) || !opDiagram.has(el.target)) continue;

    const labels = [...(et.edgePresentatie?.labels || [])];
    if (el.naam) {
      labels.push({ zijde: "midden", delen: [{ tekst: el.naam, soort: "rolnaam" }] });
    }
    edges.push({
      id: `conn:${el.id}`,
      source: el.source,
      target: el.target,
      sourceHandle: el.data?.sourceHandle || null,
      targetHandle: el.data?.targetHandle || null,
      data: {
        connectorId: el.id,
        presentatie: { ...(et.edgePresentatie || {}), labels },
      },
    });
  }
  return edges;
}
