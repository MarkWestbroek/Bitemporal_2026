/**
 * imageMap.js — de `vormConfig` van de vorm `image-map` (klikbare afbeelding) en de
 * omrekening naar SVG. Puur (imageMap.test.js).
 *
 * De config is een GEDEELD contract met Imprint en volgt daarom HTML `<map>/<area>`:
 * dezelfde `shape`-namen en `coords`-volgorde, zodat de uitvoer van een gewone
 * image-map-generator (pixels) direct bruikbaar is.
 *
 *   {
 *     "image": "/media/plattegrond.svg",       // URL of pad
 *     "alt": "Plattegrond begane grond",       // beschrijving van de afbeelding
 *     "units": "fraction",                     // "fraction" (0..1, standaard) of "px"
 *     "width": 1200, "height": 800,            // alleen bij "px": het coördinatenvlak
 *     "areas": [
 *       { "value": "zaal-a", "label": "Zaal A", "shape": "rect",    "coords": [0.05, 0.1, 0.35, 0.5] },
 *       { "value": "hal",                       "shape": "circle",  "coords": [0.5, 0.75, 0.08] },
 *       { "value": "tuin",                      "shape": "poly",    "coords": [0.6,0.1, 0.95,0.1, 0.95,0.6] },
 *       { "value": "vijver",                    "shape": "ellipse", "coords": [0.8, 0.8, 0.1, 0.05] }
 *     ],
 *     "legend": true,                          // lijst met gekozen labels onder de afbeelding
 *     "accentColor": "#f59e0b"                 // rand van gekozen gebieden (standaard amber)
 *   }
 *
 *  - rect    [x1, y1, x2, y2]        (HTML)
 *  - circle  [cx, cy, r]             (HTML; r in eenheden van de breedte)
 *  - poly    [x1, y1, x2, y2, …]     (HTML)
 *  - ellipse [cx, cy, rx, ry]        (uitbreiding; HTML kent geen ellips)
 *
 * `value` is de waarde die in de data komt: een enum-waarde, of het id van een
 * referentielijst-item. Relatieve coördinaten schalen mee met de breedte van het veld
 * (zelfde regel als Imprint-widgets).
 */

const VORMEN = new Set(["rect", "circle", "poly", "ellipse"]);

const getal = (x) => (typeof x === "number" ? x : Number(x));

/**
 * Eén area → genormaliseerde SVG-beschrijving in het vlak 0..1 × 0..1.
 * `aspect` = hoogte / breedte van de afbeelding (nodig voor een cirkel in fracties).
 * Geeft null bij een ongeldige area.
 */
export function areaNaarSvg(area, { units = "fraction", width, height, aspect = 1 } = {}) {
  if (!area || !VORMEN.has(area.shape) || !Array.isArray(area.coords)) return null;
  const c = area.coords.map(getal);
  if (c.some((x) => !Number.isFinite(x))) return null;
  const px = units === "px";
  if (px && !(width > 0 && height > 0)) return null;
  const sx = px ? 1 / width : 1;
  const sy = px ? 1 / height : 1;

  switch (area.shape) {
    case "rect": {
      if (c.length !== 4) return null;
      const [x1, y1, x2, y2] = c;
      const x = Math.min(x1, x2) * sx, y = Math.min(y1, y2) * sy;
      return { tag: "rect", attrs: { x, y, width: Math.abs(x2 - x1) * sx, height: Math.abs(y2 - y1) * sy } };
    }
    case "circle": {
      if (c.length !== 3) return null;
      const [cx, cy, r] = c;
      // In px is r in pixels; in fracties een fractie van de breedte. Het vlak is niet
      // vierkant uitgerekt, dus een cirkel wordt een ellips in fractie-coördinaten.
      const rx = r * sx;
      const ry = px ? r * sy : r / (aspect > 0 ? aspect : 1);
      return { tag: "ellipse", attrs: { cx: cx * sx, cy: cy * sy, rx, ry } };
    }
    case "ellipse": {
      if (c.length !== 4) return null;
      const [cx, cy, rx, ry] = c;
      return { tag: "ellipse", attrs: { cx: cx * sx, cy: cy * sy, rx: rx * sx, ry: ry * sy } };
    }
    case "poly": {
      if (c.length < 6 || c.length % 2 !== 0) return null;
      const punten = [];
      for (let i = 0; i < c.length; i += 2) punten.push(`${c[i] * sx},${c[i + 1] * sy}`);
      return { tag: "polygon", attrs: { points: punten.join(" ") } };
    }
    default:
      return null;
  }
}

/**
 * Items voor useKeuze: één per area, in de volgorde van de config (= tabvolgorde).
 *
 * @param {Object} config   vormConfig
 * @param {Array}  opties   de keuzebron: enum-waarden (strings) of { id, label }-objecten;
 *                          leeg/undefined = niet controleren (bv. referentielijst nog niet geladen)
 * @returns {{ items: Array<{ waarde, label, svg }>, fouten: string[] }}
 */
export function itemsUitConfig(config, opties, { aspect = 1 } = {}) {
  const fouten = [];
  const areas = Array.isArray(config?.areas) ? config.areas : [];
  if (!config?.image) fouten.push("image-map zonder `image`");
  if (areas.length === 0) fouten.push("image-map zonder `areas`");

  const optieLabel = new Map();
  for (const o of opties || []) {
    if (o == null) continue;
    if (typeof o === "object") optieLabel.set(String(o.id ?? o.waarde ?? o.value), o.label ?? String(o.id));
    else optieLabel.set(String(o), String(o));
  }
  const controleer = optieLabel.size > 0;

  const gezien = new Set();
  const items = [];
  for (const area of areas) {
    const waarde = area?.value == null ? "" : String(area.value);
    if (!waarde) { fouten.push("area zonder `value`"); continue; }
    if (gezien.has(waarde)) { fouten.push(`dubbele area-value: ${waarde}`); continue; }
    if (controleer && !optieLabel.has(waarde)) { fouten.push(`area-value hoort niet bij de keuzelijst: ${waarde}`); continue; }
    const svg = areaNaarSvg(area, { units: config.units, width: config.width, height: config.height, aspect });
    if (!svg) { fouten.push(`ongeldige vorm/coords voor area ${waarde}`); continue; }
    gezien.add(waarde);
    items.push({ waarde, label: area.label || optieLabel.get(waarde) || waarde, svg });
  }
  return { items, fouten };
}
