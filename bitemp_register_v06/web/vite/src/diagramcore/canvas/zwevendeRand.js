// @ts-check
/**
 * zwevendeRand — het rekenwerk achter **zwevende aanhechting** van edges.
 *
 * Standaard hecht een connector aan één van vier handles (midden van elke
 * zijde). Voor kleine, ronde vormen — een BPMN-gateway, een begin-stip — is
 * dat prima: de vorm ís klein, dus vier punten dekken hem. Voor een
 * UML-klasse met acht associaties is het armoede: alle lijnen knijpen door
 * hetzelfde punt.
 *
 * Zwevend hecht in plaats daarvan aan de **omtrek**: het punt waar de lijn
 * tussen de twee middelpunten de rand snijdt. Twee gevolgen die precies zijn
 * wat je wilt:
 *
 *   - lijnen naar verschillende buren waaieren vanzelf uit over de rand;
 *   - sleep je een node, dan glijdt het aanhechtpunt mee — je hoeft nooit
 *     meer een handle "goed te zetten".
 *
 * Dit is de aanpak van EA, Archi en Visio, en de reden dat je daar nooit over
 * handles nadenkt.
 *
 * **De zijde blijft dezelfde als voorheen.** Dat is een bewuste keuze. Het
 * zuivere snijpunt van de middellijn met de omtrek geeft bij een brede, lage
 * node (een klassebox met één regel) verrassende uitkomsten: een buur die
 * duidelijk rechts ligt wordt dan tóch via de bovenrand verbonden, en de
 * orthogonale router maakt daar een lange omweg omheen. Daarom kiezen we de
 * zijde met exact dezelfde regel als `besteZijde` (de dominante as) en
 * schuiven we alléén het punt **langs** die zijde op. Het verschil met de
 * huidige situatie is daarmee precies één ding: dezelfde zijde, een betere
 * plek erop.
 *
 * De rand is verder een **rechthoek**, ook voor een ellips of een ruit — een
 * bewuste benadering (React Flow's eigen floating-edge-voorbeeld doet het net
 * zo). Vormen waar dat zou opvallen zetten `randAanhechting: "zijden"` en
 * houden hun handles.
 */

/** @typedef {{x: number, y: number, width: number, height: number}} Rechthoek */
/** @typedef {{x: number, y: number}} Punt */

/** Middelpunt van een rechthoek. */
export function middelpunt(rect) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

const klem = (waarde, min, max) => Math.min(Math.max(waarde, min), max);

/**
 * Het aanhechtpunt op de rand van `rect` voor een lijn richting `doel`.
 *
 * Zijde = de dominante as (identiek aan `besteZijde`, zodat de zijdekeuze
 * niet verandert). Op die zijde ligt het punt waar de middellijn hem kruist,
 * met een marge van `inzet` px zodat een lijn nooit precies in een hoek
 * aanhecht.
 *
 * @param {Rechthoek} rect
 * @param {Punt} doel
 * @param {number} [inzet] - marge tot de hoeken, in px
 * @returns {{x: number, y: number, zijde: "left"|"right"|"top"|"bottom"}}
 */
export function aanhechtpunt(rect, doel, inzet = 8) {
  const c = middelpunt(rect);
  const dx = doel.x - c.x;
  const dy = doel.y - c.y;
  const hw = rect.width / 2;
  const hh = rect.height / 2;
  // Doel valt samen met het middelpunt: geen richting. Kies rechts, zodat er
  // altijd een geldig punt uitkomt (degenerate, maar nooit NaN).
  if (dx === 0 && dy === 0) return { x: c.x + hw, y: c.y, zijde: "right" };
  // Op een kleine node zou de marge de hele zijde opeten.
  const marge = (halve) => Math.min(inzet, halve / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    const m = marge(hh);
    return {
      x: dx >= 0 ? c.x + hw : c.x - hw,
      y: klem(c.y + (dy * hw) / Math.abs(dx), c.y - hh + m, c.y + hh - m),
      zijde: dx >= 0 ? "right" : "left",
    };
  }
  const m = marge(hw);
  return {
    x: klem(c.x + (dx * hh) / Math.abs(dy), c.x - hw + m, c.x + hw - m),
    y: dy >= 0 ? c.y + hh : c.y - hh,
    zijde: dy >= 0 ? "bottom" : "top",
  };
}

/**
 * Absolute rechthoek van een React Flow-InternalNode, of null als hij nog
 * niet gemeten is (eerste render). Zonder maat kan er niets gesneden worden;
 * de aanroeper valt dan terug op de handle-coördinaten.
 *
 * @param {any} node - InternalNode uit useInternalNode
 * @returns {Rechthoek|null}
 */
export function nodeRechthoek(node) {
  const pos = node?.internals?.positionAbsolute;
  const w = node?.measured?.width;
  const h = node?.measured?.height;
  if (!pos || !w || !h) return null;
  return { x: pos.x, y: pos.y, width: w, height: h };
}

/**
 * Bereken de uiteinden van een edge, met zwevende aanhechting waar dat mag.
 * Per uiteinde apart: een connector kan aan de bronkant zweven en aan de
 * doelkant op een handmatig gekozen handle blijven zitten.
 *
 * Valt terug op de meegegeven handle-coördinaten zodra iets ontbreekt —
 * nog niet gemeten nodes, een zelf-lus, of een uiteinde dat niet mag zweven.
 *
 * @param {Object} args
 * @param {Rechthoek|null} args.bronRect
 * @param {Rechthoek|null} args.doelRect
 * @param {boolean} args.zwevendBron
 * @param {boolean} args.zwevendDoel
 * @param {{sourceX: number, sourceY: number, targetX: number, targetY: number,
 *          sourcePosition: string, targetPosition: string}} args.vast
 */
export function zwevendeUiteinden({ bronRect, doelRect, zwevendBron, zwevendDoel, vast }) {
  if ((!zwevendBron && !zwevendDoel) || !bronRect || !doelRect) return vast;
  const bronMid = middelpunt(bronRect);
  const doelMid = middelpunt(doelRect);
  const uit = { ...vast };
  if (zwevendBron) {
    const s = aanhechtpunt(bronRect, doelMid);
    uit.sourceX = s.x;
    uit.sourceY = s.y;
    uit.sourcePosition = s.zijde;
  }
  if (zwevendDoel) {
    const t = aanhechtpunt(doelRect, bronMid);
    uit.targetX = t.x;
    uit.targetY = t.y;
    uit.targetPosition = t.zijde;
  }
  return uit;
}
