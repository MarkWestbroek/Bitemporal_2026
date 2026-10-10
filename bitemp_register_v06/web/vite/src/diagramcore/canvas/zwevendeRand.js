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
 * De rand is standaard een **rechthoek**. Een elementtype met `omtrek: "ruit"`
 * of `"ellips"` (beslissing, begin/eind, use case) krijgt het echte snijpunt
 * met die vorm — sinds 2026-10-09; daarvoor was het altijd de rechthoek
 * (zoals React Flow's floating-edge-voorbeeld).
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
export function aanhechtpunt(rect, doel, inzet = 8, omtrek = "rechthoek") {
  const c = middelpunt(rect);
  // Ruit en ellips: het echte snijpunt van de straal middelpunt → doel met de
  // vorm, zodat een lijn de ruit op zijn punt of zijde raakt en niet op de
  // onzichtbare rechthoek eromheen (Mark, 09-10: "lijnen raken de ruit niet").
  if (omtrek === "ruit" || omtrek === "ellips") {
    const dx = doel.x - c.x, dy = doel.y - c.y;
    if (dx === 0 && dy === 0) return { x: c.x + rect.width / 2, y: c.y, zijde: "right" };
    const hw = rect.width / 2, hh = rect.height / 2;
    const zijde = Math.abs(dx) * hh >= Math.abs(dy) * hw ? (dx >= 0 ? "right" : "left") : dy >= 0 ? "bottom" : "top";
    let t;
    if (omtrek === "ruit") {
      // |x|/hw + |y|/hh = 1 langs de straal (x,y) = t·(dx,dy)
      t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
    } else {
      // (x/hw)² + (y/hh)² = 1
      t = 1 / Math.sqrt((dx * dx) / (hw * hw) + (dy * dy) / (hh * hh));
    }
    return { x: c.x + dx * t, y: c.y + dy * t, zijde };
  }
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
export function zwevendeUiteinden({ bronRect, doelRect, zwevendBron, zwevendDoel, vast, bronRicht = null, doelRicht = null, bronOmtrek = "rechthoek", doelOmtrek = "rechthoek", orthogonaal = false, bronToppen = false, doelToppen = false }) {
  if ((!zwevendBron && !zwevendDoel) || !bronRect || !doelRect) return vast;
  // Hoekige lijn zonder knikken, beide uiteinden vrij: zo recht mogelijk, zoals
  // EA's Auto Routing (zie orthogonaleUiteinden). Met een vaste handle aan één
  // kant, of met knikken, geldt het gewone mikken hieronder.
  if (orthogonaal && zwevendBron && zwevendDoel && !bronRicht && !doelRicht) {
    // Ook voor ronde en ruitvormige vormen (BPMN-events, gateways): eerst op de
    // omhullende rechthoek, dan haaks naar binnen tot de echte omtrek.
    const o = orthogonaleUiteinden(bronRect, doelRect);
    const s = naarOmtrek(bronRect, { x: o.sourceX, y: o.sourceY }, o.sourcePosition, bronOmtrek);
    const t = naarOmtrek(doelRect, { x: o.targetX, y: o.targetY }, o.targetPosition, doelOmtrek);
    return { ...vast, ...o, sourceX: s.x, sourceY: s.y, targetX: t.x, targetY: t.y };
  }
  // Toppen (ellips/ruit): het dichtstbijzijnde paar uiterste punten, zie
  // kortsteToppen. Alleen voor uiteinden zonder knik; een uiteinde met knik
  // mikt op zijn knik (hieronder, via richtpuntOfAanhechtpunt).
  const bronT = zwevendBron && bronToppen && !bronRicht;
  const doelT = zwevendDoel && doelToppen && !doelRicht;
  if ((bronT || doelT) && !bronRicht && !doelRicht) {
    const k = kortsteToppen({
      bronRect, doelRect, vast,
      bron: bronT ? "toppen" : zwevendBron ? "zwevend" : "vast",
      doel: doelT ? "toppen" : zwevendDoel ? "zwevend" : "vast",
      bronOmtrek, doelOmtrek,
    });
    if (k) return { ...vast, ...k };
  }
  const bronMid = middelpunt(bronRect);
  const doelMid = middelpunt(doelRect);
  const uit = { ...vast };
  if (zwevendBron) {
    const s = richtpuntOfAanhechtpunt(bronRect, bronRicht || doelMid, 1.5, bronOmtrek);
    uit.sourceX = s.x;
    uit.sourceY = s.y;
    uit.sourcePosition = s.zijde;
  }
  if (zwevendDoel) {
    const t = richtpuntOfAanhechtpunt(doelRect, doelRicht || bronMid, 1.5, doelOmtrek);
    uit.targetX = t.x;
    uit.targetY = t.y;
    uit.targetPosition = t.zijde;
  }
  return uit;
}

/**
 * Uiteinden voor een hoekige lijn "zo recht als het kan" (EA Auto Routing,
 * Mark 10-10): overlappen de dozen in x, dan één verticale lijn midden in de
 * overlap tussen de naar elkaar toe gekeerde zijden; overlappen ze in y, dan
 * één horizontale; anders een L — uit de zijde waar de grootste afstand zit,
 * naar het midden van de tegenoverliggende zijde van de ander, zodat de
 * hoekige router (smoothstep) precies één hoek maakt.
 * @param {Rechthoek} bron
 * @param {Rechthoek} doel
 * @param {number} [minOverlap] - minimale overlap (px) voor een rechte lijn
 * @returns {{sourceX:number, sourceY:number, sourcePosition:string, targetX:number, targetY:number, targetPosition:string}}
 */
export function orthogonaleUiteinden(bron, doel, minOverlap = 12) {
  const bl = bron.x, br = bron.x + bron.width, bb = bron.y, bo = bron.y + bron.height;
  const dl = doel.x, dr = doel.x + doel.width, db = doel.y, dO = doel.y + doel.height;
  const overlapX = Math.min(br, dr) - Math.max(bl, dl);
  const overlapY = Math.min(bo, dO) - Math.max(bb, db);
  if (overlapX >= minOverlap && overlapY < 0) {
    // Boven elkaar: rechte verticale lijn.
    const x = (Math.max(bl, dl) + Math.min(br, dr)) / 2;
    return bo <= db
      ? { sourceX: x, sourceY: bo, sourcePosition: "bottom", targetX: x, targetY: db, targetPosition: "top" }
      : { sourceX: x, sourceY: bb, sourcePosition: "top", targetX: x, targetY: dO, targetPosition: "bottom" };
  }
  if (overlapY >= minOverlap && overlapX < 0) {
    // Naast elkaar: rechte horizontale lijn.
    const y = (Math.max(bb, db) + Math.min(bo, dO)) / 2;
    return br <= dl
      ? { sourceX: br, sourceY: y, sourcePosition: "right", targetX: dl, targetY: y, targetPosition: "left" }
      : { sourceX: bl, sourceY: y, sourcePosition: "left", targetX: dr, targetY: y, targetPosition: "right" };
  }
  // Diagonaal (of overlappend): één hoek. De langste afstand bepaalt de
  // zijde waar de bron uitgaat; de doelzijde is de tegenovergestelde as.
  const bm = { x: (bl + br) / 2, y: (bb + bo) / 2 };
  const dm = { x: (dl + dr) / 2, y: (db + dO) / 2 };
  const dx = dm.x - bm.x, dy = dm.y - bm.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const uitRechts = dx >= 0;
    return {
      sourceX: uitRechts ? br : bl, sourceY: bm.y, sourcePosition: uitRechts ? "right" : "left",
      targetX: dm.x, targetY: dy >= 0 ? db : dO, targetPosition: dy >= 0 ? "top" : "bottom",
    };
  }
  const uitOnder = dy >= 0;
  return {
    sourceX: bm.x, sourceY: uitOnder ? bo : bb, sourcePosition: uitOnder ? "bottom" : "top",
    targetX: dx >= 0 ? dl : dr, targetY: dm.y, targetPosition: dx >= 0 ? "left" : "right",
  };
}

/**
 * Schuif een punt op de omhullende rechthoek haaks naar binnen tot de echte
 * omtrek (ellips of ruit); een rechthoek blijft zoals hij is. `zijde` is de
 * zijde van de rechthoek waar het punt op ligt. Buiten het bereik van de vorm
 * (bv. een y boven de ellips) valt het punt terug op het midden van die zijde.
 * @param {Rechthoek} rect
 * @param {Punt} punt
 * @param {string} zijde - "left" | "right" | "top" | "bottom"
 * @param {string} [omtrek]
 * @returns {Punt}
 */
export function naarOmtrek(rect, punt, zijde, omtrek = "rechthoek") {
  if (omtrek !== "ellips" && omtrek !== "ruit") return { x: punt.x, y: punt.y };
  const a = rect.width / 2, b = rect.height / 2;
  const cx = rect.x + a, cy = rect.y + b;
  if (!a || !b) return { x: punt.x, y: punt.y };
  if (zijde === "left" || zijde === "right") {
    const t = Math.min(1, Math.abs(punt.y - cy) / b);
    const breedte = omtrek === "ellips" ? a * Math.sqrt(1 - t * t) : a * (1 - t);
    const y = t >= 1 ? cy : punt.y;
    return { x: zijde === "left" ? cx - (t >= 1 ? a : breedte) : cx + (t >= 1 ? a : breedte), y };
  }
  const t = Math.min(1, Math.abs(punt.x - cx) / a);
  const hoogte = omtrek === "ellips" ? b * Math.sqrt(1 - t * t) : b * (1 - t);
  const x = t >= 1 ? cx : punt.x;
  return { x, y: zijde === "top" ? cy - (t >= 1 ? b : hoogte) : cy + (t >= 1 ? b : hoogte) };
}

/**
 * Met knikpunten (data.knikken) mikt een zwevend uiteinde op het eerste/laatste
 * knikpunt in plaats van op het middelpunt van de andere doos — anders springt
 * de lijn eerst schuin naar de knik (EA-import, 2026-10-08). Ligt dat
 * knikpunt precies óp de rand (een geïmporteerd aanhechtpunt), dan is dát het
 * uiteinde, op die zijde.
 * @param {Rechthoek} rect
 * @param {Punt} punt
 */
export function richtpuntOfAanhechtpunt(rect, punt, tolerantie = 1.5, omtrek = "rechthoek") {
  if (omtrek === "ruit" || omtrek === "ellips") {
    // Ligt het richtpunt recht naast of boven/onder de vorm, dan haaks
    // aanhechten (het eerste stuk van een hoekige lijn blijft recht); anders
    // het snijpunt van de straal naar dat punt met de echte omtrek.
    const links = rect.x, rechts = rect.x + rect.width, boven = rect.y, onder = rect.y + rect.height;
    if (punt.y >= boven && punt.y <= onder && (punt.x < links || punt.x > rechts)) {
      const zijde = punt.x < links ? "left" : "right";
      return { ...naarOmtrek(rect, { x: zijde === "left" ? links : rechts, y: punt.y }, zijde, omtrek), zijde };
    }
    if (punt.x >= links && punt.x <= rechts && (punt.y < boven || punt.y > onder)) {
      const zijde = punt.y < boven ? "top" : "bottom";
      return { ...naarOmtrek(rect, { x: punt.x, y: zijde === "top" ? boven : onder }, zijde, omtrek), zijde };
    }
    return aanhechtpunt(rect, punt, 8, omtrek);
  }
  const links = rect.x, rechts = rect.x + rect.width, boven = rect.y, onder = rect.y + rect.height;
  const binnenX = punt.x >= links - tolerantie && punt.x <= rechts + tolerantie;
  const binnenY = punt.y >= boven - tolerantie && punt.y <= onder + tolerantie;
  if (binnenX && Math.abs(punt.y - boven) <= tolerantie) return { x: punt.x, y: boven, zijde: "top" };
  if (binnenX && Math.abs(punt.y - onder) <= tolerantie) return { x: punt.x, y: onder, zijde: "bottom" };
  if (binnenY && Math.abs(punt.x - links) <= tolerantie) return { x: links, y: punt.y, zijde: "left" };
  if (binnenY && Math.abs(punt.x - rechts) <= tolerantie) return { x: rechts, y: punt.y, zijde: "right" };
  return aanhechtpunt(rect, punt);
}

/**
 * De vier toppen (uiterste punten) van een vorm: links, rechts, boven, onder.
 * Voor een ellips en een ruit liggen die precies midden op de zijden van de
 * omhullende rechthoek, dus dit geldt voor elke vorm.
 * @param {Rechthoek} rect
 * @returns {Array<Punt & {zijde: string}>}
 */
export function toppenVan(rect) {
  const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
  return [
    { x: rect.x, y: cy, zijde: "left" },
    { x: rect.x + rect.width, y: cy, zijde: "right" },
    { x: cx, y: rect.y, zijde: "top" },
    { x: cx, y: rect.y + rect.height, zijde: "bottom" },
  ];
}

/**
 * Kortste verbinding via toppen (ElementType.aanhechtpunten = "toppen";
 * Mark 10-10: "de kortste lijn leidt bij use cases niet tot het gewenste
 * resultaat"). Per uiteinde:
 *   - "toppen":  een van de vier uiterste punten;
 *   - "zwevend": het gewone aanhechtpunt op de rand, gericht op het gekozen
 *                punt aan de andere kant;
 *   - "vast":    de handle-coordinaten uit `vast`.
 * Uit alle combinaties wint de kortste. Bij (bijna) gelijke lengte gaan
 * links/rechts voor boven/onder: dat leest rustiger bij brede ovalen.
 * Twee overlappende vormen: null (de aanroeper valt terug).
 * @returns {{sourceX:number, sourceY:number, sourcePosition:string, targetX:number, targetY:number, targetPosition:string}|null}
 */
export function kortsteToppen({ bronRect, doelRect, vast, bron, doel, bronOmtrek = "rechthoek", doelOmtrek = "rechthoek" }) {
  const overlap =
    bronRect.x < doelRect.x + doelRect.width && doelRect.x < bronRect.x + bronRect.width &&
    bronRect.y < doelRect.y + doelRect.height && doelRect.y < bronRect.y + bronRect.height;
  if (overlap) return null;
  const vastBron = { x: vast.sourceX, y: vast.sourceY, zijde: vast.sourcePosition };
  const vastDoel = { x: vast.targetX, y: vast.targetY, zijde: vast.targetPosition };
  const kandidaten = (soort, rect, vastPunt) =>
    soort === "toppen" ? toppenVan(rect) : soort === "vast" ? [vastPunt] : null;
  const bronK = kandidaten(bron, bronRect, vastBron);
  const doelK = kandidaten(doel, doelRect, vastDoel);
  const horizontaal = (z) => z === "left" || z === "right";
  /** @type {any} */
  let beste = null;
  const overweeg = (s, t) => {
    const d = Math.hypot(t.x - s.x, t.y - s.y);
    // Horizontale toppen krijgen 4% voordeel: bijna gelijk -> links/rechts.
    const gewicht = d * (horizontaal(s.zijde) || horizontaal(t.zijde) ? 0.96 : 1);
    if (!beste || gewicht < beste.gewicht) beste = { gewicht, s, t };
  };
  if (bronK && doelK) for (const s of bronK) for (const t of doelK) overweeg(s, t);
  else if (bronK) for (const s of bronK) overweeg(s, richtpuntOfAanhechtpunt(doelRect, s, 1.5, doelOmtrek));
  else if (doelK) for (const t of doelK) overweeg(richtpuntOfAanhechtpunt(bronRect, t, 1.5, bronOmtrek), t);
  if (!beste) return null;
  return {
    sourceX: beste.s.x, sourceY: beste.s.y, sourcePosition: beste.s.zijde,
    targetX: beste.t.x, targetY: beste.t.y, targetPosition: beste.t.zijde,
  };
}
