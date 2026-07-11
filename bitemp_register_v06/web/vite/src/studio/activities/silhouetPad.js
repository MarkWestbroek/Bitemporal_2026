/**
 * silhouetPad — pure helpers voor de silhouet-tekenaar (geen React/JSX, zodat ze
 * met `node --test` te testen zijn).
 */

const rond = (n) => Math.round(n * 10) / 10;

/** "polygon(10% 0%, …)" → [{x,y}] (voor terugladen van oude clip-path-vormen). */
export function polygonNaarPunten(clipPath) {
  const m = /polygon\(([^)]*)\)/i.exec(clipPath || "");
  if (!m) return [];
  return m[1]
    .split(",")
    .map((paar) => {
      const [x, y] = paar.trim().split(/\s+/);
      return { x: parseFloat(x), y: parseFloat(y) };
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

/** Afstand van punt p tot lijnstuk a–b. */
function afstandPuntSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Index waar een nieuw punt `p` moet worden ingevoegd: op de dichtstbijzijnde
 * rand (segment tussen opeenvolgende punten, inclusief het sluitsegment), zodat
 * het punt bij de klik verschijnt i.p.v. altijd achteraan (wat de vorm liet
 * kruisen). Bij < 2 punten gewoon achteraan.
 */
export function invoegIndex(punten, p) {
  const n = punten.length;
  if (n < 2) return n;
  let best = Infinity;
  let idx = n;
  for (let i = 0; i < n; i++) {
    const d = afstandPuntSegment(p, punten[i], punten[(i + 1) % n]);
    if (d < best) {
      best = d;
      idx = i + 1;
    }
  }
  return idx;
}

/**
 * [{x,y,r}] → gesloten SVG-pad (`d`). Hoekpunten worden met rechte lijnen
 * verbonden, ronde punten (`r:true`) met een kromme: de raaklijn volgt de richting
 * buur→buur (Catmull-Rom-achtig), corner-punten hebben geen raaklijn dus hun
 * segmenten blijven recht. Leeg bij < 3 punten.
 */
export function puntenNaarPad(punten) {
  const n = punten.length;
  if (n < 3) return "";
  const k = 0.18; // gladheidsfactor
  const ctrls = punten.map((cur, i) => {
    if (!cur.r) return { in: cur, out: cur }; // hoek: geen raaklijn → recht
    const prev = punten[(i - 1 + n) % n];
    const next = punten[(i + 1) % n];
    const tx = (next.x - prev.x) * k;
    const ty = (next.y - prev.y) * k;
    return { in: { x: cur.x - tx, y: cur.y - ty }, out: { x: cur.x + tx, y: cur.y + ty } };
  });
  let d = `M ${rond(punten[0].x)} ${rond(punten[0].y)}`;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const o = ctrls[i].out;
    const iN = ctrls[j].in;
    const p = punten[j];
    d += ` C ${rond(o.x)} ${rond(o.y)} ${rond(iN.x)} ${rond(iN.y)} ${rond(p.x)} ${rond(p.y)}`;
  }
  return d + " Z";
}
