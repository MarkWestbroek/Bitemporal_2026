// @ts-check
/**
 * uitlijnen — pure layout-geometrie van de core (plan §4.5).
 *
 * Uitlijnen/verdelen/snap-grid werken uitsluitend op posities en afmetingen
 * van de selectie en kennen géén elementtypen — daarom core. Plaatsing
 * (auto-layout) is semantiek en blijft profiel-werk (LayoutStrategie).
 *
 * Alle functies zijn puur: items in, gewijzigde posities uit (alleen de
 * items die echt verschuiven). De aanroeper (canvas/activiteit) past ze in
 * één store-mutatie toe zodat het één undo-stap is.
 */

/** @typedef {{id: string, x: number, y: number, width: number, height: number}} LayoutItem */

export const UITLIJN_MODES = [
  { mode: "left", label: "⇤", titel: "Links uitlijnen" },
  { mode: "center-h", label: "⇹", titel: "Horizontaal centreren" },
  { mode: "right", label: "⇥", titel: "Rechts uitlijnen" },
  { mode: "top", label: "⤒", titel: "Boven uitlijnen" },
  { mode: "center-v", label: "⇳", titel: "Verticaal centreren" },
  { mode: "bottom", label: "⤓", titel: "Onder uitlijnen" },
  { mode: "distribute-h", label: "⋯", titel: "Horizontaal verdelen" },
  { mode: "distribute-v", label: "⋮", titel: "Verticaal verdelen" },
];

/**
 * Bereken nieuwe posities voor een uitlijn-/verdeel-modus.
 * @param {string} mode - zie UITLIJN_MODES
 * @param {LayoutItem[]} items - de selectie (minimaal 2)
 * @returns {Record<string, {x: number, y: number}>} gewijzigde posities
 */
export function berekenUitlijning(mode, items) {
  /** @type {Record<string, {x: number, y: number}>} */
  const posities = {};
  if (!items || items.length < 2) return posities;
  const zet = (item, x, y) => {
    if (x !== item.x || y !== item.y) posities[item.id] = { x, y };
  };

  switch (mode) {
    case "left": {
      const minX = Math.min(...items.map((i) => i.x));
      for (const i of items) zet(i, minX, i.y);
      break;
    }
    case "right": {
      const maxX = Math.max(...items.map((i) => i.x + i.width));
      for (const i of items) zet(i, maxX - i.width, i.y);
      break;
    }
    case "top": {
      const minY = Math.min(...items.map((i) => i.y));
      for (const i of items) zet(i, i.x, minY);
      break;
    }
    case "bottom": {
      const maxY = Math.max(...items.map((i) => i.y + i.height));
      for (const i of items) zet(i, i.x, maxY - i.height);
      break;
    }
    case "center-h": {
      const gemX = items.reduce((s, i) => s + i.x + i.width / 2, 0) / items.length;
      for (const i of items) zet(i, gemX - i.width / 2, i.y);
      break;
    }
    case "center-v": {
      const gemY = items.reduce((s, i) => s + i.y + i.height / 2, 0) / items.length;
      for (const i of items) zet(i, i.x, gemY - i.height / 2);
      break;
    }
    // Verdelen = gelijke **tussenruimte** (niet gelijke linkerranden): de
    // uitersten blijven staan, de rest schuift zó dat elk gat even groot is.
    // Verdelen op `x` alleen gaf bij ongelijke breedtes (brede taak naast
    // kleine events) zichtbaar ongelijke gaten, of zelfs overlap.
    case "distribute-h": {
      const gesorteerd = [...items].sort((a, b) => a.x + a.width / 2 - (b.x + b.width / 2));
      const eerste = gesorteerd[0];
      const laatste = gesorteerd[gesorteerd.length - 1];
      const som = gesorteerd.reduce((t, i) => t + i.width, 0);
      const gat = (laatste.x + laatste.width - eerste.x - som) / (gesorteerd.length - 1);
      let x = eerste.x;
      for (const i of gesorteerd) {
        if (i !== eerste && i !== laatste) zet(i, x, i.y);
        x += i.width + gat;
      }
      break;
    }
    case "distribute-v": {
      const gesorteerd = [...items].sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2));
      const eerste = gesorteerd[0];
      const laatste = gesorteerd[gesorteerd.length - 1];
      const som = gesorteerd.reduce((t, i) => t + i.height, 0);
      const gat = (laatste.y + laatste.height - eerste.y - som) / (gesorteerd.length - 1);
      let y = eerste.y;
      for (const i of gesorteerd) {
        if (i !== eerste && i !== laatste) zet(i, i.x, y);
        y += i.height + gat;
      }
      break;
    }
    default:
      break;
  }
  return posities;
}

/**
 * Snap alle items op een raster.
 * @param {LayoutItem[]} items
 * @param {number} [raster]
 * @returns {Record<string, {x: number, y: number}>} gewijzigde posities
 */
export function berekenRasterSnap(items, raster = 16) {
  /** @type {Record<string, {x: number, y: number}>} */
  const posities = {};
  for (const i of items || []) {
    const x = Math.round(i.x / raster) * raster;
    const y = Math.round(i.y / raster) * raster;
    if (x !== i.x || y !== i.y) posities[i.id] = { x, y };
  }
  return posities;
}
