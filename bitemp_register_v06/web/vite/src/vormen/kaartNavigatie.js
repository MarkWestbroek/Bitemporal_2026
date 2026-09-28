/**
 * kaartNavigatie.js — toetsenbord en zoeken voor de kaart van Nederland (vorm nl-map). Puur, getest.
 *
 * Op een kaart is "de volgende" een buurman, niet de volgende in het alfabet:
 *  - pijltjes: naar de dichtstbijzijnde stip in die richting (grafisch wandelen);
 *  - Shift+↑/↓: naar de vorige/volgende beginletter; Shift+←/→: vorige/volgende in het alfabet;
 *  - typen: zoeken op gemeente én woonplaats (wie "Wervershoof" typt, vindt Medemblik).
 * Punten zijn { x, y } in de viewBox (y naar beneden, zoals SVG).
 */

const RICHTING = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

/**
 * De index van de stip die vanaf `huidig` het best in de richting van de pijl ligt, of `huidig`
 * als er in die richting niets is. Kandidaten liggen binnen een kegel van ±60°; de afstand langs
 * de richting telt gewoon, de afwijking ernaast dubbel (zo "loop" je eerst rechtdoor).
 * @param {Array<{x:number,y:number}>} punten
 */
export function naarRichting(punten, huidig, toets) {
  const r = RICHTING[toets];
  const p = punten[huidig];
  if (!r || !p) return huidig;
  let beste = huidig;
  let score = Infinity;
  punten.forEach((q, i) => {
    if (i === huidig || !q) return;
    const dx = q.x - p.x, dy = q.y - p.y;
    const langs = dx * r[0] + dy * r[1];
    const naast = Math.abs(dx * r[1] - dy * r[0]);
    if (langs <= 0 || naast > langs * Math.tan(Math.PI / 3)) return;
    const s = langs + 2 * naast;
    if (s < score) { score = s; beste = i; }
  });
  return beste;
}

/** De stip die het dichtst bij het midden ligt: het beginpunt als er nog niets is aangewezen. */
export function middelste(punten) {
  if (!punten.length) return -1;
  const mx = punten.reduce((s, p) => s + p.x, 0) / punten.length;
  const my = punten.reduce((s, p) => s + p.y, 0) / punten.length;
  let beste = 0;
  punten.forEach((p, i) => { if (Math.hypot(p.x - mx, p.y - my) < Math.hypot(punten[beste].x - mx, punten[beste].y - my)) beste = i; });
  return beste;
}

// De eerste echte letter, zonder accent: 's-Gravenhage telt onder de S, Émmen onder de E.
const eersteLetter = (s) => (String(s || "").normalize("NFD").match(/\p{L}/u)?.[0] || "").toLocaleUpperCase("nl");
// Sorteren vanaf de eerste letter: 's-Gravenhage bij de S, niet vooraan door de apostrof.
const sorteersleutel = (s) => String(s || "").replace(/^[^\p{L}]+/u, "");
const alfabetisch = (labels) => labels.map((l, i) => [sorteersleutel(l), i]).sort((a, b) => a[0].localeCompare(b[0], "nl", { sensitivity: "base" })).map(([, i]) => i);

/** Vorige/volgende in het alfabet (stap -1/+1), rondlopend. */
export function naarAlfabet(labels, huidig, stap) {
  const volgorde = alfabetisch(labels);
  if (!volgorde.length) return -1;
  const pos = volgorde.indexOf(huidig);
  if (pos < 0) return volgorde[stap > 0 ? 0 : volgorde.length - 1];
  return volgorde[(pos + stap + volgorde.length) % volgorde.length];
}

/** De eerste gemeente van de vorige/volgende beginletter (stap -1/+1), rondlopend. */
export function naarLetter(labels, huidig, stap) {
  const volgorde = alfabetisch(labels);
  if (!volgorde.length) return -1;
  const letters = [...new Set(volgorde.map((i) => eersteLetter(labels[i])))];
  const nu = huidig >= 0 ? eersteLetter(labels[huidig]) : null;
  const pos = nu == null ? (stap > 0 ? -1 : 0) : letters.indexOf(nu);
  const doel = letters[(pos + stap + letters.length) % letters.length];
  return volgorde.find((i) => eersteLetter(labels[i]) === doel);
}

const vlak = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("nl").trim();

/**
 * Zoeken op gemeente en woonplaats. Volgorde: naam begint ermee, naam bevat het, dan een
 * woonplaats die ermee begint of het bevat. Elk resultaat { index, via } (via = de woonplaats).
 * @param {Array<{label:string, woonplaatsen?:string[]}>} kandidaten
 */
export function zoekOpKaart(kandidaten, tekst, max = 8) {
  const t = vlak(tekst);
  if (!t) return [];
  const uit = [];
  const erin = new Set();
  const voeg = (index, via, rang) => { if (!erin.has(index)) { erin.add(index); uit.push({ index, via, rang }); } };
  kandidaten.forEach((k, i) => {
    const n = vlak(k.label);
    if (n.startsWith(t)) voeg(i, null, 0);
    else if (n.includes(t)) voeg(i, null, 1);
  });
  kandidaten.forEach((k, i) => {
    for (const w of k.woonplaatsen || []) {
      const v = vlak(w);
      if (v.startsWith(t)) { voeg(i, w, 2); break; }
      if (v.includes(t)) { voeg(i, w, 3); break; }
    }
  });
  return uit
    .sort((a, b) => a.rang - b.rang || kandidaten[a.index].label.localeCompare(kandidaten[b.index].label, "nl"))
    .slice(0, max)
    .map(({ index, via }) => ({ index, via }));
}
