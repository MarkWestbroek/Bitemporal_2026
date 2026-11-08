// @ts-check
/**
 * onverzonden — heeft een diagram nog wijzigingen in de outbox die de server niet heeft
 * bevestigd? Voor de cursieve tabnaam in Modelleren (Mark 08-11: "de naam van de tab cursief
 * mocht er iets nog niet opgeslagen staan").
 *
 * Een operatie raakt het diagram als haar argumenten het diagram-id noemen of het id van een
 * element dat erop staat (node of connector). Dat is ruim genomen: een element dat ook op een
 * ander diagram staat, maakt beide tabs cursief, en dat klopt ook. Bij een grote outbox (een
 * import) zoeken we niet: dan is elke tab van die taal cursief.
 */

const GROTE_OUTBOX = 200;

/**
 * @param {Array<{store: string, args?: any[]}>} ops  - outbox-operaties
 * @param {string} profielId
 * @param {{id: string, nodes?: Array<{elementId?: string}>, edges?: Array<{elementId?: string}>}|null} diagram
 * @returns {boolean}
 */
export function diagramHeeftOnverzonden(ops, profielId, diagram) {
  if (!diagram || !ops?.length) return false;
  const store = `model:${profielId}`;
  const eigen = ops.filter((o) => o.store === store);
  if (!eigen.length) return false;
  if (eigen.length > GROTE_OUTBOX) return true;
  const ids = new Set([diagram.id]);
  for (const n of diagram.nodes || []) if (n?.elementId) ids.add(n.elementId);
  for (const e of diagram.edges || []) if (e?.elementId) ids.add(e.elementId);
  const zoek = [...ids].map((id) => JSON.stringify(String(id)));
  return eigen.some((o) => {
    const tekst = JSON.stringify(o.args ?? []);
    return zoek.some((z) => tekst.includes(z));
  });
}
