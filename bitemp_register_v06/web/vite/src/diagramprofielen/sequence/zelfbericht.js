// @ts-check
/**
 * zelfbericht — een met de hand getekend zelf-bericht (van een punt naar
 * datzelfde punt) krijgt vanzelf zijn **ontvangpunt** 15px lager op dezelfde
 * levenslijn (2026-10-15, Mark). Zo ontstaat het haakje van EA en de
 * "rugzak"-activatie (activaties.js), net als bij de EA-import
 * (qeaNaarSequence.js: PtStartY/PtEndY).
 *
 * Implementatie van de M3-hook `naVerbinden` voor de berichttypen. De
 * expliciete handles van de sleep vervallen, zodat het profiel de zijden
 * kiest (hooks.edgePresentatie: rechts eruit, hoekig, rechts erin).
 */

/** Verticale afstand tussen zend- en ontvangpunt (px; EA: ±15). */
export const HAAK = 15;

/**
 * @param {Record<string, any>} conn - de zojuist gemaakte connector
 * @param {{s: any, diagramId: string, maakPunt: () => Record<string, any>}} ctx
 *   s = de profielstore-state (addElement, addElementToDiagram, updateElement)
 * @returns {string|null} id van het nieuwe ontvangpunt, of null als er niets te doen is
 */
export function ontvangpuntVoorZelfbericht(conn, { s, diagramId, maakPunt }) {
  if (!conn || conn.source !== conn.target) return null;
  const punt = s.elements?.[conn.source];
  if (punt?.elementType !== "punt" || !punt.data?.randVan) return null;
  const node = (s.diagrams?.[diagramId]?.nodes || []).find((n) => n.elementId === punt.id);
  if (!node?.position) return null;
  const nieuw = maakPunt();
  nieuw.data = { ...(nieuw.data || {}), randVan: punt.data.randVan };
  s.addElement(nieuw);
  s.addElementToDiagram(diagramId, nieuw.id, { x: node.position.x, y: node.position.y + HAAK });
  s.updateElement(conn.id, { target: nieuw.id, data: { ...(conn.data || {}), sourceHandle: null, targetHandle: null } });
  return nieuw.id;
}
