// @ts-check
/**
 * zelfbericht — een met de hand getekend zelf-bericht krijgt vanzelf zijn
 * punten op de levenslijn (2026-10-15, Mark):
 *   - van een **punt** naar datzelfde punt: het ontvangpunt 15px lager;
 *   - van een **activatie** naar zichzelf: een zendpunt op de hoogte van het
 *     midden van de activatie en een ontvangpunt 15px lager — het bericht
 *     hangt daarna aan die punten, de activatie blijft staan.
 * Zo ontstaat het haakje van EA en de "rugzak"-activatie (activaties.js),
 * net als bij de EA-import (qeaNaarSequence.js: PtStartY/PtEndY).
 *
 * Implementatie van de M3-hook `naVerbinden` voor de berichttypen. De
 * expliciete handles van de sleep vervallen, zodat het profiel de zijden
 * kiest (hooks.edgePresentatie: rechts eruit, hoekig, rechts erin).
 */

/** Verticale afstand tussen zend- en ontvangpunt (px; EA: ±15). */
export const HAAK = 15;
/** Maat van een punt en breedte van de levenslijn-node (shapes.jsx). */
const PUNT = 12;
const LIJN_BREED = 14;

/**
 * @param {Record<string, any>} conn - de zojuist gemaakte connector
 * @param {{s: any, diagramId: string, maakPunt: () => Record<string, any>}} ctx
 *   s = de profielstore-state (addElement, addElementToDiagram, updateElement)
 * @returns {string|null} id van het nieuwe ontvangpunt, of null als er niets te doen is
 */
export function ontvangpuntVoorZelfbericht(conn, { s, diagramId, maakPunt }) {
  if (!conn || conn.source !== conn.target) return null;
  const bron = s.elements?.[conn.source];
  if (!bron?.data?.randVan) return null;
  const node = (s.diagrams?.[diagramId]?.nodes || []).find((n) => n.elementId === bron.id);
  if (!node?.position) return null;
  const zonderHandles = { ...(conn.data || {}), sourceHandle: null, targetHandle: null };
  const nieuwPunt = (y) => {
    const p = maakPunt();
    p.data = { ...(p.data || {}), randVan: bron.data.randVan };
    s.addElement(p);
    s.addElementToDiagram(diagramId, p.id, { x: Math.round(LIJN_BREED / 2 - PUNT / 2), y });
    return p.id;
  };
  if (bron.elementType === "punt") {
    const naar = nieuwPunt(node.position.y + HAAK);
    s.updateElement(conn.id, { target: naar, data: zonderHandles });
    return naar;
  }
  if (bron.elementType === "activatie") {
    const hoogte = node.size?.height ?? 44;
    const midden = node.position.y + hoogte / 2 - PUNT / 2;
    const van = nieuwPunt(midden);
    const naar = nieuwPunt(midden + HAAK);
    s.updateElement(conn.id, { source: van, target: naar, data: zonderHandles });
    return naar;
  }
  return null;
}
