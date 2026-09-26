/**
 * schaal.js — gedeelde logica van de GEORDENDE vormen (range, rotary, stepper): een schaal is
 * óf een getalbereik (min/max/step), óf een geordende lijst (enum-volgorde). Puur (schaal.test.js).
 */

/**
 * @param {Object} p
 * @param {Array}  [p.items]   geordende opties [{ value, label }] — dan is de schaal een lijst
 * @param {Object} [p.config]  { min, max, step, labels }
 * @returns {{ soort: "lijst"|"getal", n: number, min: number, max: number, step: number,
 *             naarIndex: (w) => number, naarWaarde: (i) => string, label: (i) => string }}
 */
export function maakSchaal({ items, config = {} } = {}) {
  if (items && items.length) {
    const vals = items.map((i) => String(i.value));
    return {
      soort: "lijst", n: items.length, min: 0, max: items.length - 1, step: 1,
      naarIndex: (w) => vals.indexOf(String(w ?? "")),
      naarWaarde: (i) => vals[Math.max(0, Math.min(vals.length - 1, Math.round(i)))],
      label: (i) => config.labels?.[vals[i]] ?? items[i]?.label ?? vals[i],
    };
  }
  const min = Number(config.min ?? 0), max = Number(config.max ?? 10), step = Number(config.step ?? 1) || 1;
  const n = Math.floor((max - min) / step) + 1;
  const afronden = (x) => Number((Math.round(x / step) * step).toFixed(10));
  return {
    soort: "getal", n, min, max, step,
    naarIndex: (w) => (w === "" || w == null || Number.isNaN(Number(w)) ? -1 : Math.round((Number(w) - min) / step)),
    naarWaarde: (i) => String(afronden(Math.max(min, Math.min(max, min + Math.round(i) * step)))),
    label: (i) => config.labels?.[String(afronden(min + i * step))] ?? String(afronden(min + i * step)),
  };
}

/** Kleur van stap i uit `colors`: één kleur per stap, of een verloop tussen de eerste en de laatste. */
export function stapKleur(colors, i, n) {
  if (!colors || !colors.length) return null;
  if (colors.length >= n) return colors[i];
  if (colors.length === 1) return colors[0];
  const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)) : null);
  const a = hex(colors[0]), b = hex(colors[colors.length - 1]);
  if (!a || !b) return colors[Math.round((i / Math.max(1, n - 1)) * (colors.length - 1))];
  const t = n <= 1 ? 0 : i / (n - 1);
  return "#" + a.map((x, k) => Math.round(x + (b[k] - x) * t).toString(16).padStart(2, "0")).join("");
}
