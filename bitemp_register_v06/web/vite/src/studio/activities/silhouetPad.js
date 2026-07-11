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
