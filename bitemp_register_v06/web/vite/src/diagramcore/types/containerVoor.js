// @ts-check
/**
 * containerVoor — lidmaatschap van een container (M3 `ElementType.containerVoor`).
 *
 * Sinds 20-10 (Mark, via ARCH-PROJECT; ArchiMate 3 §4.5) mag het één connectortype-id zijn
 * óf een lijst: een ArchiMate-grouping is container voor aggregatie én compositie. Elke lezer
 * (canvas-nesting, layout, boom, transformaties, assistent) gaat via deze drie functies, zodat
 * de vorm (string of lijst) op één plek woont. Puur.
 */

/**
 * De connectortypen die vanuit dit type lidmaatschap betekenen (leeg = geen container).
 * @param {{containerVoor?: string|string[]}|null|undefined} type
 * @returns {string[]}
 */
export function lidConnectoren(type) {
  const c = type?.containerVoor;
  if (!c) return [];
  return Array.isArray(c) ? c.filter(Boolean) : [c];
}

/**
 * Betekent een connector van dit type, vanuit `type`, lidmaatschap?
 * @param {{containerVoor?: string|string[]}|null|undefined} type
 * @param {string|undefined} connectorTypeId
 */
export function isLidConnector(type, connectorTypeId) {
  return !!connectorTypeId && lidConnectoren(type).includes(connectorTypeId);
}

/**
 * Het connectortype dat een nieuw lidmaatschap krijgt (element in de container gesleept, plan
 * `in`): de eerste van de lijst — ArchiMate: aggregatie, zoals EA bij nesting.
 * @param {{containerVoor?: string|string[]}|null|undefined} type
 * @returns {string|null}
 */
export function eersteLidConnector(type) {
  return lidConnectoren(type)[0] || null;
}
