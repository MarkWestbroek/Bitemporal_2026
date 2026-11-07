// @ts-check
/**
 * gerelateerd — welke elementen hangen (via verbindingen) aan een element, en staan nog niet op
 * het diagram? Achter "Gerelateerde elementen toevoegen…" (Mark, 07-11: "vanuit een willekeurig
 * element … een lijstje met alle nog niet op het diagram staande elementen die een relatie hebben
 * met het element. Dat kan elk type associatie zijn. Een CM REL moet dan wel expanden naar de
 * bron- of doelENT").
 *
 * Model: elementen zijn knopen; een verbinding (connector: source + target) verbindt ze. Een
 * verbinding is zelf geen kandidaat, want een lijn tekent zich vanzelf zodra beide uiteinden op
 * het diagram staan; we lopen er doorheen naar het andere uiteinde (zo "expandeert" een relatie).
 * Is het startelement zelf een verbinding (bv. een relatie als associatieklasse-box), dan zijn
 * zijn uiteinden de buren op niveau 1.
 *
 * Niveau = aantal stappen element → element vanaf de start. Elementen die al op het diagram
 * staan, tellen mee voor de afstand (we lopen erdoorheen) maar komen niet in de lijst.
 * Node-testbaar; de activiteit plaatst ze.
 */

/**
 * @typedef {{ id: string, naam: string, typeLabel: string, niveau: number,
 *   via: { connectorId: string, typeLabel: string, naam: string, vanId: string, vanNaam: string } }} Kandidaat
 */

/**
 * @param {{ startIds: string[], elements: Record<string, any>, opDiagram: Set<string>,
 *   elementTypesById: Record<string, any>, diepte?: number }} p
 *   diepte: hoeveel stappen (1 = direct verbonden); Infinity = alles wat bereikbaar is.
 * @returns {Kandidaat[]} gesorteerd op niveau, dan naam.
 */
export function gerelateerdeElementen({ startIds, elements, opDiagram, elementTypesById, diepte = 1 }) {
  const isConnector = (el) => !!el?.source && !!el?.target && !!elementTypesById?.[el.elementType]?.isConnector;
  // Buren per element, één keer opgebouwd: [anderId, connectorId].
  /** @type {Map<string, Array<[string, string]>>} */
  const buren = new Map();
  const voeg = (a, b, cid) => {
    if (!buren.has(a)) buren.set(a, []);
    buren.get(a)?.push([b, cid]);
  };
  for (const c of Object.values(elements || {})) {
    if (!isConnector(c) || c.source === c.target) continue;
    voeg(c.source, c.target, c.id);
    voeg(c.target, c.source, c.id);
    // Een verbinding als knoop (associatieklasse-box): haar uiteinden zijn haar buren.
    voeg(c.id, c.source, c.id);
    voeg(c.id, c.target, c.id);
  }
  const label = (el) => elementTypesById?.[el?.elementType]?.label || el?.elementType || "";
  /** @type {Map<string, Kandidaat>} */
  const gevonden = new Map();
  const bezocht = new Set(startIds);
  let rand = [...startIds];
  for (let niveau = 1; niveau <= diepte && rand.length; niveau++) {
    const volgende = [];
    for (const van of rand) {
      for (const [ander, cid] of buren.get(van) || []) {
        if (bezocht.has(ander) || !elements[ander]) continue;
        bezocht.add(ander);
        // Een verbinding die zelf een uiteinde is (verbinding aan een verbinding): erdoorheen,
        // zonder haar als kandidaat te tonen.
        if (!isConnector(elements[ander]) && !opDiagram.has(ander)) {
          const c = elements[cid];
          gevonden.set(ander, {
            id: ander,
            naam: elements[ander].naam || ander,
            typeLabel: label(elements[ander]),
            niveau,
            via: { connectorId: cid, typeLabel: label(c), naam: c?.naam || "", vanId: van, vanNaam: elements[van]?.naam || van },
          });
        }
        volgende.push(ander);
      }
    }
    rand = volgende;
  }
  return [...gevonden.values()].sort((a, b) => a.niveau - b.niveau || a.naam.localeCompare(b.naam));
}

/**
 * Posities voor nieuwe elementen: in ringen rond het anker, één ring per niveau. De straal groeit
 * mee met het aantal, zodat de elementen elkaar niet raken.
 * @param {{x: number, y: number}} anker
 * @param {Array<{id: string, niveau: number}>} kandidaten
 * @returns {Record<string, {x: number, y: number}>}
 */
export function ringPosities(anker, kandidaten) {
  /** @type {Map<number, string[]>} */
  const perNiveau = new Map();
  for (const k of kandidaten) {
    if (!perNiveau.has(k.niveau)) perNiveau.set(k.niveau, []);
    perNiveau.get(k.niveau)?.push(k.id);
  }
  /** @type {Record<string, {x: number, y: number}>} */
  const uit = {};
  let vorigeStraal = 0;
  for (const niveau of [...perNiveau.keys()].sort((a, b) => a - b)) {
    const ids = perNiveau.get(niveau) || [];
    // Elk element vraagt ~280 px boog; minstens 360 px verder dan de vorige ring.
    const straal = Math.max(vorigeStraal + 360, (ids.length * 280) / (2 * Math.PI));
    vorigeStraal = straal;
    ids.forEach((id, i) => {
      const hoek = -Math.PI / 2 + (2 * Math.PI * i) / ids.length + (niveau % 2 ? 0 : Math.PI / ids.length);
      uit[id] = { x: Math.round(anker.x + straal * Math.cos(hoek)), y: Math.round(anker.y + straal * Math.sin(hoek)) };
    });
  }
  return uit;
}
