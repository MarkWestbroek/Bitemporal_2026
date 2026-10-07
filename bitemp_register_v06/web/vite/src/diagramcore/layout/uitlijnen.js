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

// Volgorde = groepen in balk en menu (scheidingen vóór index 3, 6 en 8):
// links/midden/rechts | boven/midden/onder | verdelen | maat. Centreren heet
// zoals in Enterprise Architect: "verticaal centreren" = centreren op een
// verticale as, de elementen komen bóven elkaar (zelfde x-midden, mode
// center-h, tussen links en rechts); "horizontaal centreren" = naast elkaar
// (zelfde y-midden, mode center-v, tussen boven en onder). De mode-ids
// blijven (opslag, tests); alleen de benaming is omgedraaid (Mark, 2026-10-07:
// "V = boven elkaar, H = naast elkaar").
export const UITLIJN_MODES = [
  { mode: "left", label: "⇤", titel: "Links uitlijnen" },
  { mode: "center-h", label: "⇹", titel: "Verticaal centreren (boven elkaar)" },
  { mode: "right", label: "⇥", titel: "Rechts uitlijnen" },
  { mode: "top", label: "⤒", titel: "Boven uitlijnen" },
  { mode: "center-v", label: "⇳", titel: "Horizontaal centreren (naast elkaar)" },
  { mode: "bottom", label: "⤓", titel: "Onder uitlijnen" },
  { mode: "distribute-h", label: "⋯", titel: "Horizontaal verdelen" },
  { mode: "distribute-v", label: "⋮", titel: "Verticaal verdelen" },
  // Maat-modi (EA "Make same width/height/size"): de selectie krijgt de
  // breedte/hoogte van de láátst geselecteerde (zo kun je ook kleiner
  // maken); zonder bekende volgorde de grootste.
  { mode: "same-width", label: "⇔", titel: "Zelfde breedte (als de laatst geselecteerde)" },
  { mode: "same-height", label: "⇕", titel: "Zelfde hoogte (als de laatst geselecteerde)" },
  { mode: "same-size", label: "⤢", titel: "Zelfde maat (als de laatst geselecteerde)" },
];

/** Modi die maten i.p.v. posities wijzigen (zie berekenMaten). */
export const MAAT_MODES = new Set(["same-width", "same-height", "same-size"]);

/**
 * Bereken nieuwe maten voor een maat-modus: ieder item krijgt de breedte
 * en/of hoogte van het referentie-item (de laatst geselecteerde), of — zonder
 * referentie — de grootste van de selectie.
 * @param {string} mode - "same-width" | "same-height" | "same-size"
 * @param {LayoutItem[]} items - de selectie (minimaal 2)
 * @param {string|null} [referentieId] - id van het item dat de maat bepaalt
 * @returns {Record<string, {width: number, height: number}>} gewijzigde maten
 */
export function berekenMaten(mode, items, referentieId = null) {
  /** @type {Record<string, {width: number, height: number}>} */
  const maten = {};
  if (!items || items.length < 2 || !MAAT_MODES.has(mode)) return maten;
  const ref = referentieId ? items.find((i) => i.id === referentieId) : null;
  const maxB = ref ? ref.width : Math.max(...items.map((i) => i.width));
  const maxH = ref ? ref.height : Math.max(...items.map((i) => i.height));
  for (const i of items) {
    const width = mode === "same-height" ? i.width : maxB;
    const height = mode === "same-width" ? i.height : maxH;
    if (width !== i.width || height !== i.height) maten[i.id] = { width: Math.round(width), height: Math.round(height) };
  }
  return maten;
}

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
