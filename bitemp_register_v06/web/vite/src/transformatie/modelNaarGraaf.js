// @ts-check
/**
 * modelNaarGraaf — graafbeeld van een Studio-model als bron voor een regelset.
 *
 * De tegenhanger van een lezer voor de kant "model (bereik)" in het schema van
 * docs/TRANSFORMATIES.md §3: een Studio-model ís al een graaf (een element met
 * `elementType` en `data`; een connector is een element met `source`/`target`),
 * dus hier wordt alleen de vorm gelijkgetrokken met wat een lezer levert:
 *
 *   knoop       { id, aard: elementType, tekst: naam, eigenschappen: data, groep }
 *   verbinding  { id, aard: elementType, bron, doel, label: naam, eigenschappen: data }
 *
 * Containers blijven knopen; het lidmaatschap staat als `groep` op het lid,
 * afgeleid uit de connector die `ElementType.containerVoor` noemt (zoals
 * diagramcore/canvas/nesting.js dat doet). `groepen` is daarom leeg.
 *
 * Een `bereik` (verzameling element-id's, bv. de voorkomens op één diagram)
 * beperkt de graaf; een connector gaat mee als beide uiteinden erin zitten.
 * Zonder bereik gaat het hele model mee. Puur en store-loos.
 */

/**
 * @param {Object} invoer
 * @param {Record<string, any>} invoer.elements
 * @param {any[]} [invoer.elementTypes]        - ElementTypes van het profiel (voor containerVoor)
 * @param {Iterable<string>|null} [invoer.bereik] - element-id's die meegaan; null = alles
 * @returns {{knopen: any[], groepen: any[], verbindingen: any[], waarschuwingen: any[]}}
 */
export function modelNaarGraaf({ elements, elementTypes = [], bereik = null }) {
  const typeVan = new Map(elementTypes.map((et) => [et.id, et]));
  const alle = Object.values(elements || {});
  const isConnector = (el) => !!(el?.source && el?.target);
  const binnen = bereik ? new Set(bereik) : null;
  const hoortErbij = (el) =>
    !binnen || (isConnector(el) ? binnen.has(el.source) && binnen.has(el.target) : binnen.has(el.id));

  // Lid → container, uit de lidmaatschapsconnectoren (eerste wint).
  const containerVan = new Map();
  for (const el of alle) {
    if (!isConnector(el) || el.source === el.target || !hoortErbij(el)) continue;
    const bronType = typeVan.get(elements[el.source]?.elementType);
    if (bronType?.containerVoor === el.elementType && !containerVan.has(el.target)) containerVan.set(el.target, el.source);
  }

  const knopen = [];
  const verbindingen = [];
  for (const el of alle) {
    if (!hoortErbij(el)) continue;
    if (isConnector(el)) {
      verbindingen.push({ id: el.id, aard: el.elementType, bron: el.source, doel: el.target, label: el.naam || "", eigenschappen: el.data || {} });
    } else {
      knopen.push({ id: el.id, aard: el.elementType, tekst: el.naam || "", eigenschappen: el.data || {}, groep: containerVan.get(el.id) ?? null });
    }
  }
  return { knopen, groepen: [], verbindingen, waarschuwingen: [] };
}
