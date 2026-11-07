// @ts-check
/**
 * leesrichting — de dikke leesrichtingspijl vóór een relatienaam ("▶ label heen", "◀ label
 * terug"), zoals EA hem tekent: de driehoek wijst **langs de lijn**, niet altijd naar rechts.
 *
 * Mark, 07-11: "horizontaal goed, verticaal draait niet, diagonaal ook niet". De profielen (bv.
 * canoniek-uml `edgeLabels`) zetten het teken als tekst in het label; beide tekenaars (het canvas,
 * `ConnectorEdge.jsx`, en de SVG-tekenaar, `tekenaar/lijnen.js`) halen het hier eraf en tekenen
 * zelf een gedraaide driehoek. Heen = van bron naar doel, terug = andersom. Bij een hoekige lijn
 * zonder knikken draait de pijl in stappen van 90° (de dominante as); anders volgt hij de rechte
 * lijn van bron naar doel.
 *
 * Puur; testbaar met `node --test`.
 */

export const PIJL_HEEN = "▶";
export const PIJL_TERUG = "◀";

/**
 * Splits een leesrichtingsteken van het begin van een tekst.
 * @param {string} tekst
 * @returns {{richting: "heen" | "terug" | null, rest: string}}
 */
export function splitsLeesrichting(tekst) {
  const t = String(tekst ?? "");
  const eerste = t.charAt(0);
  if (eerste === PIJL_HEEN || eerste === PIJL_TERUG) {
    return { richting: eerste === PIJL_HEEN ? "heen" : "terug", rest: t.slice(1).trimStart() };
  }
  return { richting: null, rest: t };
}

/**
 * De hoek (graden, 0 = naar rechts, met de klok mee zoals in SVG) van de pijl.
 * @param {"heen" | "terug"} richting
 * @param {{x: number, y: number}} bron
 * @param {{x: number, y: number}} doel
 * @param {{hoekig?: boolean}} [opties] hoekig: afronden op de dominante as
 */
export function leesrichtingHoek(richting, bron, doel, { hoekig = false } = {}) {
  let dx = doel.x - bron.x;
  let dy = doel.y - bron.y;
  if (!dx && !dy) dx = 1;
  if (hoekig) {
    if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
    else dx = 0;
  }
  let hoek = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (richting === "terug") hoek += 180;
  // Normaliseer naar (-180, 180] en rond af (stabiele SVG-uitvoer).
  hoek = ((hoek % 360) + 540) % 360 - 180;
  if (hoek === -180) hoek = 180;
  return Math.round(hoek * 10) / 10;
}

/**
 * De drie punten van een gevulde driehoek rond (cx, cy) die naar `hoek` wijst.
 * @param {number} cx
 * @param {number} cy
 * @param {number} grootte  lengte van punt tot basis
 * @param {number} hoek     graden
 */
export function driehoekPunten(cx, cy, grootte, hoek) {
  const r = (hoek * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const h = grootte / 2;
  // Naar rechts wijzend: punt (h, 0), basis (-h, ±h·0,85); dan gedraaid.
  const lokaal = [[h, 0], [-h, -h * 0.85], [-h, h * 0.85]];
  const rnd = (v) => Math.round(v * 100) / 100;
  return lokaal.map(([x, y]) => `${rnd(cx + x * c - y * s)},${rnd(cy + x * s + y * c)}`).join(" ");
}
