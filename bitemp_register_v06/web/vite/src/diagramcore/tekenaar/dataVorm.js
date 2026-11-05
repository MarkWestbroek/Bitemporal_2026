// @ts-check
/**
 * dataVorm — **eigen vormen** (Studio-instellingen) als ShapeType: een vorm als gegevens, in de
 * UI te maken en via git mee te reizen (`web/vite/vormen/*.json`). Tot de opruimstap van "één
 * tekenaar" (plan 2026-11-04, stap 4) maakte `shapes/dataShape.jsx` er een React-component van;
 * nu is een eigen vorm wat het plan bedoelt: een ShapeType (gegevens) op één generieke
 * renderer (`data-vorm`), dus getekend door dezelfde tekenaar als elke andere vorm — op het
 * canvas, in documenten en in de voorbeelden.
 *
 * De definitie (alles optioneel behalve id/label):
 *   { id, label,
 *     grondvorm: "rechthoek"|"afgerond"|"stadium"|"chip"|"zeshoek"|"afgeknipt",
 *     hoekRadius: number,          // voor afgerond/chip; anders uit grondvorm
 *     clipPath: string,            // CSS `polygon(…)` (% en px, calc(100% - Npx)); wint van grondvorm
 *     silhouet: { inner, box, passen }, // vrij SVG-silhouet (Method Draw); wint van alles
 *     randStijl: "solid"|"dashed",
 *     randDikte: number,           // px (default 2)
 *     vulling: "#rrggbb" }         // default; element/type-kleur wint
 *
 * Een `silhouet` is een genormaliseerd vrij vorm-silhouet: `inner` = de rauwe SVG-paden (fills
 * en strokes gestript), `box` = [x, y, w, h] van hun bounding box. Het wordt in de maat van het
 * voorkomen gelegd: standaard met behoud van verhouding, gecentreerd (`passen !== false`),
 * anders uitgerekt. De rand blijft overal even dik (`vector-effect: non-scaling-stroke`).
 *
 * De inhoud (stereotype, naam, compartimenten) tekent de motor, zoals bij elke vorm.
 * Pure `.js`: geen DOM; het silhouet wordt met een kleine eigen lezer naar een VormBoom gezet.
 */
import { registreerShapeType, registreerRenderer, getShapeType, getRenderer, vorm } from "../types/shapeType.js";
import { randRechthoek } from "./bibliotheek.js";

export const DATA_VORM = "data-vorm";

const GRONDVORM_POLYGON = {
  zeshoek: "polygon(14% 0, 86% 0, 100% 50%, 86% 100%, 14% 100%, 0 50%)",
  afgeknipt: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
};

/** De polygoon van een definitie (eigen clip-path, anders die van de grondvorm), of null. */
export function clipVoor(def) {
  if (def.clipPath) return def.clipPath;
  return GRONDVORM_POLYGON[def.grondvorm] || null;
}

/** Hoekradius van de doos-variant (px). */
function radiusVoor(p) {
  if (p.hoekRadius !== undefined) return p.hoekRadius;
  if (p.grondvorm === "afgerond") return 14;
  if (p.grondvorm === "chip" || p.grondvorm === "stadium") return 999;
  return 0;
}

/** Eén CSS-lengte uit een polygon (`50%`, `12px`, `0`, `calc(100% - 12px)`) → px op `totaal`. */
function lengte(term, totaal) {
  const t = String(term).trim();
  const calc = /^calc\((.*)\)$/i.exec(t);
  if (calc) {
    // Som van termen met + en −, zoals CSS het schrijft (spaties om de operator).
    let som = 0;
    let teken = 1;
    for (const deel of calc[1].trim().split(/\s+/)) {
      if (deel === "+") teken = 1;
      else if (deel === "-") teken = -1;
      else som += teken * lengte(deel, totaal);
    }
    return som;
  }
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return NaN;
  return t.endsWith("%") ? (n / 100) * totaal : n;
}

/**
 * CSS `polygon(…)` → punten binnen een vlak van w × h. `null` als het geen polygoon is (een
 * andere clip-path-functie tekent de tekenaar niet; de vorm valt dan terug op de doos).
 * @returns {{x: number, y: number}[]|null}
 */
export function polygonPunten(clipPath, w, h) {
  const m = /^\s*polygon\((.*)\)\s*$/is.exec(clipPath || "");
  if (!m) return null;
  const punten = [];
  for (const paar of m[1].split(/,(?![^(]*\))/)) {
    const termen = paar.trim().match(/calc\([^)]*\)|\S+/gi) || [];
    if (termen.length !== 2) return null;
    const x = lengte(termen[0], w);
    const y = lengte(termen[1], h);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    punten.push({ x, y });
  }
  return punten.length >= 3 ? punten : null;
}

/** De vormelementen die een silhouet mag bevatten; al het andere (title, defs, style) vervalt. */
const SILHOUET_TAGS = new Set(["g", "path", "rect", "ellipse", "circle", "line", "polyline", "polygon"]);
/**
 * Attributen die niet meegaan: wat een VormBoom verbiedt (style, on…) en wat geen vorm is (id,
 * class, xmlns). Kleur en rand staan op de omhullende groep; een silhouet is bij het opslaan al
 * van fills en strokes ontdaan, en wat er dan nog staat (bv. `fill-rule`) hoort bij de vorm.
 */
const WEG = /^(style|class|id|vector-effect|xmlns)($|:)|^on/i;
const _silhouetten = new Map();

/**
 * De rauwe SVG van een silhouet → VormBoom-knopen. Een kleine lezer voor genormaliseerde SVG
 * (alleen elementen en attributen, geen tekst of entiteiten); elk blad krijgt
 * `vector-effect: non-scaling-stroke`. Onbekende elementen vervallen met hun inhoud.
 * @param {string} inner
 * @returns {Object[]}
 */
export function leesSilhouet(inner) {
  const bron = String(inner || "");
  const bekend = _silhouetten.get(bron);
  if (bekend) return bekend;
  const wortel = { kinderen: [] };
  /** @type {Array<{kinderen: any[]}|null>} null = een overgeslagen (onbekend) element */
  const stapel = [wortel];
  const re = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  let m;
  while ((m = re.exec(bron))) {
    const [, sluit, naam, attrTekst, zelfSluitend] = m;
    const tag = naam.replace(/^svg:/, "");
    if (sluit) {
      if (stapel.length > 1) stapel.pop();
      continue;
    }
    const ouder = stapel[stapel.length - 1];
    const telt = !!ouder && SILHOUET_TAGS.has(tag);
    let knoop = null;
    if (telt) {
      const attrs = {};
      const ar = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let a;
      while ((a = ar.exec(attrTekst))) if (!WEG.test(a[1])) attrs[a[1]] = a[2] ?? a[3];
      if (tag !== "g") attrs["vector-effect"] = "non-scaling-stroke";
      knoop = { tag, attrs, kinderen: [] };
      ouder.kinderen.push(knoop);
    }
    if (!zelfSluitend) stapel.push(knoop);
  }
  if (_silhouetten.size > 200) _silhouetten.clear();
  _silhouetten.set(bron, wortel.kinderen);
  return wortel.kinderen;
}

const geldigSilhouet = (s) => !!s && !!s.inner && Array.isArray(s.box) && s.box.length === 4 && s.box[2] > 0 && s.box[3] > 0;

/** De generieke renderer voor eigen vormen; de vorm staat in `ctx.parameters`. */
const dataVorm = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const p = ctx.parameters;
    const d = ctx.stijl.randDikte ?? p.randDikte ?? 2;
    const rand = { stroke: ctx.thema.rand, "stroke-width": d, "stroke-linejoin": "round" };
    if ((ctx.stijl.randStijl ?? p.randStijl) === "dashed") rand["stroke-dasharray"] = "6 4";
    if (geldigSilhouet(p.silhouet)) {
      const [bx, by, bw, bh] = p.silhouet.box;
      const vrij = p.silhouet.passen === false;
      const sx = vrij ? w / bw : Math.min(w / bw, h / bh);
      const sy = vrij ? h / bh : sx;
      const tx = (w - bw * sx) / 2 - bx * sx;
      const ty = (h - bh * sy) / 2 - by * sy;
      return vorm("g", { transform: `translate(${rond(tx)} ${rond(ty)}) scale(${rond(sx, 4)} ${rond(sy, 4)})`, fill: ctx.thema.vulling, ...rand }, leesSilhouet(p.silhouet.inner));
    }
    const clip = clipVoor(p);
    const punten = clip ? polygonPunten(clip, w - d, h - d) : null;
    if (punten) {
      return vorm("polygon", { points: punten.map((q) => `${rond(q.x + d / 2)},${rond(q.y + d / 2)}`).join(" "), fill: ctx.thema.vulling, ...rand });
    }
    const rx = Math.max(0, Math.min(radiusVoor(p), (w - d) / 2, (h - d) / 2));
    return vorm("rect", { x: d / 2, y: d / 2, width: w - d, height: h - d, rx, fill: ctx.thema.vulling, ...rand });
  },
  inhoudsvak: (ctx) => ({ x: 0, y: 0, w: ctx.maat.w, h: ctx.maat.h, uitlijning: "midden" }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

const rond = (n, cijfers = 2) => {
  const f = 10 ** cijfers;
  return Math.round(n * f) / f;
};

registreerRenderer(DATA_VORM, dataVorm);

/**
 * Het ShapeType van een eigen vorm (zonder te registreren).
 * @param {Object} def
 * @returns {import("../types/schema.js").ShapeType}
 */
export function dataVormShapeType(def) {
  const parameters = { inhoud: "volledig" };
  for (const sleutel of ["grondvorm", "hoekRadius", "clipPath", "randStijl", "randDikte", "vulling"]) {
    if (def[sleutel] !== undefined && def[sleutel] !== null && def[sleutel] !== "") parameters[sleutel] = def[sleutel];
  }
  if (geldigSilhouet(def.silhouet)) {
    parameters.silhouet = { inner: String(def.silhouet.inner), box: def.silhouet.box.map(Number), ...(def.silhouet.passen === false ? { passen: false } : {}) };
  }
  // Een silhouet of polygoon draagt minder tekst dan een doos: wat ruimer, zoals voorheen.
  const vrij = !!parameters.silhouet || !!clipVoor(parameters);
  return { id: def.id, renderer: DATA_VORM, parameters, minMaat: vrij ? { w: 150, h: 48 } : { w: 180, h: 56 } };
}

/** Een eigen vorm als tekenbare vorm, voor een voorbeeld tijdens het bewerken (niet geregistreerd). */
export function dataVormInfo(def) {
  return { shapeType: dataVormShapeType({ id: "voorbeeld", ...def }), renderer: dataVorm };
}

/**
 * Registreer één eigen vorm als ShapeType (idempotent; opnieuw registreren vervangt). Een
 * ingebouwd ShapeType met dezelfde id wint: een eigen vorm overschrijft nooit een profielvorm.
 * @returns {boolean} geregistreerd
 */
export function registreerDataVorm(def) {
  if (!def?.id) return false;
  const bestaand = getShapeType(def.id);
  if (bestaand && bestaand.renderer !== DATA_VORM) return false;
  registreerShapeType(dataVormShapeType(def));
  return true;
}

/** Is dit shape-id een eigen vorm? */
export const isDataVorm = (shapeId) => getShapeType(shapeId)?.renderer === DATA_VORM && !!getRenderer(DATA_VORM);
