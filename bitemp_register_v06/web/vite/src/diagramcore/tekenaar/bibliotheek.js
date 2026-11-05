// @ts-check
/**
 * bibliotheek — de standaard-ShapeRenderers van de motor (plan 2026-11-04 Eén tekenaar §3.1,
 * "trede 1"): een ShapeType kiest er een met `renderer` en stuurt hem met `parameters`, zonder
 * code. Elke renderer is puur en geeft een VormBoom in element-coördinaten (0,0 = linksboven,
 * `ctx.maat` = de buitenmaat). Inhoud (naam, compartimenten, …) tekent de motor in het
 * `inhoudsvak`; hier staat alleen de omtrek, een eventueel ornament en het aanhechtpunt.
 *
 * Gedeelde parameters: `randDikte` (standaard 2), `hoekRadius`, `randStijl: "dashed"`, `inhoud`
 * (modus voor de inhoud-tekenaar, zie inhoud.js), `uitlijning` ("boven"|"midden"), `tekstAnker`
 * ("midden"|"links"), `vulling`/`rand` (vaste kleuren, bv. een notitie). `ctx.stijl` (opgelost
 * door de motor) wint van de parameters; `ctx.thema` draagt de opgeloste kleuren.
 *
 * Renderers: rechthoek, ellips, cirkel, ruit, kader, notitie, package, knip, stadium, bkm, golf,
 * anker, bol, actor, verwijzing, figuur.
 */
import { registreerRenderer, vorm } from "../types/shapeType.js";
import { tekstBreedte } from "../../diagramsvg/tekstmaat.js";
import { num } from "../../diagramsvg/svg.js";
import { vulIn, n3 } from "./glyphs.js";

const dikte = (ctx, standaard = 2) => ctx.stijl.randDikte ?? ctx.parameters.randDikte ?? standaard;
const gestippeld = (ctx) => (ctx.stijl.randStijl ?? ctx.parameters.randStijl) === "dashed";

/** Rand-attributen in vaste volgorde. */
function rand(ctx, standaardDikte = 2) {
  const uit = { stroke: ctx.thema.rand, "stroke-width": dikte(ctx, standaardDikte) };
  if (gestippeld(ctx)) uit["stroke-dasharray"] = "6 4";
  return uit;
}

const graden = (hoek) => (hoek * Math.PI) / 180;

/** Snijpunt van de straal uit het midden onder `hoek` (graden, 0 = rechts, 90 = onder) met een rechthoek. */
export function randRechthoek({ w, h }, hoek) {
  const dx = Math.cos(graden(hoek));
  const dy = Math.sin(graden(hoek));
  const sx = dx ? w / 2 / Math.abs(dx) : Infinity;
  const sy = dy ? h / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: w / 2 + dx * s, y: h / 2 + dy * s };
}

/** Aanhechtpunt op een cirkel die de maat vult (events, pseudotoestanden). */
export function randCirkel(ctx, hoek) {
  const { w, h } = ctx.maat;
  const r = Math.min(w, h) / 2;
  return { x: w / 2 + r * Math.cos(graden(hoek)), y: h / 2 + r * Math.sin(graden(hoek)) };
}

/**
 * Een tekening in een vaste vierkante viewBox (`vb`), passend geschaald en gecentreerd in de
 * maat — het SVG-`viewBox`-gedrag van de oude canvas-shapes, voor kleine vaste vormen.
 */
export function geschaald(ctx, vb, kinderen) {
  const { w, h } = ctx.maat;
  const s = Math.min(w, h) / vb;
  return vorm("g", { transform: `translate(${n3((w - vb * s) / 2)} ${n3((h - vb * s) / 2)}) scale(${n3(s)})` }, ...kinderen);
}

function randEllips({ w, h }, hoek) {
  return { x: w / 2 + (w / 2) * Math.cos(graden(hoek)), y: h / 2 + (h / 2) * Math.sin(graden(hoek)) };
}

function randRuit({ w, h }, hoek) {
  const dx = Math.cos(graden(hoek));
  const dy = Math.sin(graden(hoek));
  const s = 1 / (Math.abs(dx) / (w / 2) + Math.abs(dy) / (h / 2) || 1);
  return { x: w / 2 + dx * s, y: h / 2 + dy * s };
}

const volVak = (ctx) => ({ x: 0, y: 0, w: ctx.maat.w, h: ctx.maat.h, uitlijning: ctx.parameters.uitlijning || "boven" });

const rechthoek = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const d = dikte(ctx);
    const rx = ctx.stijl.hoekRadius ?? ctx.parameters.hoekRadius ?? 8;
    return vorm("rect", { x: d / 2, y: d / 2, width: w - d, height: h - d, rx, fill: ctx.thema.vulling, ...rand(ctx) });
  },
  inhoudsvak: volVak,
  kindervak: (ctx) => ({ x: 0, y: 0, w: ctx.maat.w, h: ctx.maat.h }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

const ellips = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const d = dikte(ctx, 1.5);
    return vorm("ellipse", { cx: w / 2, cy: h / 2, rx: (w - d) / 2, ry: (h - d) / 2, fill: ctx.thema.vulling, ...rand(ctx, 1.5) });
  },
  // Het inhoudsvak volgt factorW/factorH (standaard 72%), dezelfde factoren als waarmee maat.js
  // de natuurlijke maat uit de inhoud terugrekent.
  inhoudsvak(ctx) {
    const { w, h } = ctx.maat;
    const fw = ctx.parameters.factorW ?? 0.72;
    const fh = ctx.parameters.factorH ?? 0.72;
    return { x: (w * (1 - fw)) / 2, y: (h * (1 - fh)) / 2, w: w * fw, h: h * fh, uitlijning: "midden" };
  },
  rand: (ctx, hoek) => randEllips(ctx.maat, hoek),
};

const cirkel = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const d = dikte(ctx);
    const r = Math.min(w, h) / 2 - d / 2;
    const kinderen = [vorm("circle", { cx: w / 2, cy: h / 2, r, fill: ctx.parameters.dicht ? ctx.thema.rand : ctx.thema.vulling, ...rand(ctx) })];
    // Dubbele ring (eind-event, eindtoestand): een tweede cirkel erin.
    if (ctx.parameters.ring) kinderen.push(vorm("circle", { cx: w / 2, cy: h / 2, r: Math.max(2, r - 4), fill: ctx.parameters.dicht ? ctx.thema.vulling : "none", stroke: ctx.thema.rand, "stroke-width": 1.5 }));
    // Kern (activity-eind: ring met gevulde stip): straal in px.
    if (ctx.parameters.kern) kinderen.push(vorm("circle", { cx: w / 2, cy: h / 2, r: Math.min(ctx.parameters.kern, r - 2), fill: ctx.thema.rand, stroke: "none" }));
    // Kruis (flow-eind): een X door de ring.
    if (ctx.parameters.kruis) {
      const k = r * 0.6;
      kinderen.push(vorm("path", { d: `M ${num(w / 2 - k)} ${num(h / 2 - k)} L ${num(w / 2 + k)} ${num(h / 2 + k)} M ${num(w / 2 + k)} ${num(h / 2 - k)} L ${num(w / 2 - k)} ${num(h / 2 + k)}`, fill: "none", stroke: ctx.thema.rand, "stroke-width": dikte(ctx) }));
    }
    return vorm("g", {}, ...kinderen);
  },
  inhoudsvak(ctx) {
    if ((ctx.parameters.inhoud || "geen") === "geen") return null;
    const { w, h } = ctx.maat;
    const r = Math.min(w, h) / 2;
    const z = r * 1.4;
    return { x: w / 2 - z / 2, y: h / 2 - z / 2, w: z, h: z, uitlijning: "midden" };
  },
  rand(ctx, hoek) {
    const { w, h } = ctx.maat;
    const r = Math.min(w, h) / 2;
    return { x: w / 2 + r * Math.cos(graden(hoek)), y: h / 2 + r * Math.sin(graden(hoek)) };
  },
};

const ruit = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const d = dikte(ctx);
    const p = [[w / 2, d / 2], [w - d / 2, h / 2], [w / 2, h - d / 2], [d / 2, h / 2]];
    return vorm("polygon", { points: p.map(([x, y]) => `${num(x)},${num(y)}`).join(" "), fill: ctx.thema.vulling, ...rand(ctx), "stroke-linejoin": "round" });
  },
  inhoudsvak(ctx) {
    const { w, h } = ctx.maat;
    if ((ctx.parameters.inhoud || "geen") === "geen") return null;
    return { x: w / 4, y: h / 4, w: w / 2, h: h / 2, uitlijning: "midden" };
  },
  rand: (ctx, hoek) => randRuit(ctx.maat, hoek),
};

/**
 * Kader (boundary, package-romp, laag, pool, systeemkader, partitie): rand rondom, de naam in een
 * kopstrook, de leden in de rest. Standaard gestippeld (`lijn: "solid"` voor een laag). Zonder
 * achtergrondkleur een lichte tint van de eigen kleur (~8%), of met `tint: true` van de randkleur;
 * `kopLijn: true` zet een lijn onder de kopstrook (systeemkader, swimlane).
 */
const kader = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const d = dikte(ctx);
    const eigen = ctx.stijl.kleur || null;
    const achtergrond = ctx.element?.data?.achtergrondKleur || null;
    const attrs = { x: d / 2, y: d / 2, width: w - d, height: h - d, rx: ctx.parameters.hoekRadius ?? 10 };
    if (achtergrond) attrs.fill = achtergrond;
    else if (eigen) {
      attrs.fill = eigen;
      attrs["fill-opacity"] = 0.08;
    } else if (ctx.parameters.tint) {
      attrs.fill = ctx.thema.rand;
      attrs["fill-opacity"] = 0.08;
    } else {
      attrs.fill = ctx.parameters.vulling || "none";
      if (ctx.parameters.vulling && ctx.parameters.vullingOpacity !== undefined) attrs["fill-opacity"] = ctx.parameters.vullingOpacity;
    }
    attrs.stroke = eigen || ctx.thema.rand;
    attrs["stroke-width"] = d;
    if ((ctx.parameters.lijn || "dashed") === "dashed") attrs["stroke-dasharray"] = "6 4";
    const rect = vorm("rect", attrs);
    if (!ctx.parameters.kopLijn) return rect;
    const kop = ctx.parameters.kopHoogte ?? 24;
    return vorm("g", {}, rect, vorm("line", { x1: d, y1: kop, x2: w - d, y2: kop, stroke: eigen || ctx.thema.rand, "stroke-width": 1, opacity: 0.6 }));
  },
  inhoudsvak(ctx) {
    const kop = ctx.parameters.kopHoogte ?? 24;
    return { x: 0, y: 0, w: ctx.maat.w, h: kop, uitlijning: "boven" };
  },
  kindervak(ctx) {
    const kop = ctx.parameters.kopHoogte ?? 24;
    return { x: 0, y: kop, w: ctx.maat.w, h: ctx.maat.h - kop };
  },
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

/** Notitie / constraint: het UML-notatiesymbool met ezelsoor rechtsboven. */
const notitie = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const d = dikte(ctx, 1.5);
    const v = ctx.parameters.oor ?? 10;
    const x0 = d / 2, y0 = d / 2, x1 = w - d / 2, y1 = h - d / 2;
    return vorm(
      "g",
      {},
      vorm("path", { d: `M ${num(x0)} ${num(y0)} H ${num(x1 - v)} L ${num(x1)} ${num(y0 + v)} V ${num(y1)} H ${num(x0)} Z`, fill: ctx.thema.vulling, ...rand(ctx, 1.5), "stroke-linejoin": "round" }),
      vorm("path", { d: `M ${num(x1 - v)} ${num(y0)} V ${num(y0 + v)} H ${num(x1)}`, fill: "none", stroke: ctx.thema.rand, "stroke-width": dikte(ctx, 1.5) })
    );
  },
  inhoudsvak: (ctx) => ({ x: 0, y: 0, w: ctx.maat.w - 6, h: ctx.maat.h, uitlijning: ctx.parameters.uitlijning || "boven" }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

/** UML-package: de hangmap — naam-tab linksboven die zijn onderrand deelt met de romp. */
const TAB_H = 22;
const pakket = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const d = dikte(ctx);
    const naamB = tekstBreedte(ctx.element?.naam || "", 12, { vet: true });
    const tabW = Math.min(w * 0.65, Math.max(60, Math.ceil(naamB + 28)));
    return vorm(
      "g",
      {},
      vorm("rect", { x: d / 2, y: TAB_H, width: w - d, height: h - TAB_H - d / 2, rx: 8, fill: ctx.thema.vulling, ...rand(ctx) }),
      vorm("rect", { x: d / 2, y: d / 2, width: tabW, height: TAB_H + 4, rx: 5, fill: ctx.thema.vulling, ...rand(ctx) }),
      // De naad: de bovenrand van de romp onder de tab wegwerken, zodat tab en romp één contour zijn.
      vorm("rect", { x: d, y: TAB_H - d, width: tabW - d, height: 2 * d, fill: ctx.thema.vulling })
    );
  },
  inhoudsvak(ctx) {
    const naamB = tekstBreedte(ctx.element?.naam || "", 12, { vet: true });
    const tabW = Math.min(ctx.maat.w * 0.65, Math.max(60, Math.ceil(naamB + 28)));
    return { x: 0, y: -1, w: tabW, h: TAB_H, uitlijning: "boven" };
  },
  kindervak: (ctx) => ({ x: 0, y: TAB_H, w: ctx.maat.w, h: ctx.maat.h - TAB_H }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

/** Knip-box: vier afgeknipte hoeken ("meerdere gedaanten", MIM). */
const knip = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const d = dikte(ctx);
    const k = ctx.parameters.knip ?? 13;
    const x0 = d / 2, y0 = d / 2, x1 = w - d / 2, y1 = h - d / 2;
    const p = [[x0 + k, y0], [x1 - k, y0], [x1, y0 + k], [x1, y1 - k], [x1 - k, y1], [x0 + k, y1], [x0, y1 - k], [x0, y0 + k]];
    return vorm("polygon", { points: p.map(([x, y]) => `${num(x)},${num(y)}`).join(" "), fill: ctx.thema.vulling, ...rand(ctx), "stroke-linejoin": "round" });
  },
  inhoudsvak: (ctx) => ({ x: 4, y: 0, w: ctx.maat.w - 8, h: ctx.maat.h, uitlijning: ctx.parameters.uitlijning || "boven" }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

/** Stadium (DMN input data): rechthoek met halfronde uiteinden. */
const stadium = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const d = dikte(ctx);
    return vorm("rect", { x: d / 2, y: d / 2, width: w - d, height: h - d, rx: (h - d) / 2, fill: ctx.thema.vulling, ...rand(ctx) });
  },
  inhoudsvak: (ctx) => ({ x: ctx.maat.h / 4, y: 0, w: ctx.maat.w - ctx.maat.h / 2, h: ctx.maat.h, uitlijning: "midden" }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

/** DMN business knowledge model: afgeknipt linksboven en rechtsonder. */
const bkm = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const d = dikte(ctx);
    const k = ctx.parameters.knip ?? 14;
    const x0 = d / 2, y0 = d / 2, x1 = w - d / 2, y1 = h - d / 2;
    const p = [[x0 + k, y0], [x1, y0], [x1, y1 - k], [x1 - k, y1], [x0, y1], [x0, y0 + k]];
    return vorm("polygon", { points: p.map(([x, y]) => `${num(x)},${num(y)}`).join(" "), fill: ctx.thema.vulling, ...rand(ctx), "stroke-linejoin": "round" });
  },
  inhoudsvak: (ctx) => ({ x: 4, y: 0, w: ctx.maat.w - 8, h: ctx.maat.h, uitlijning: "midden" }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

/** DMN knowledge source: rechthoek met golvende onderrand (basisvorm 200×130, meegerekt). */
const golf = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm(
      "g",
      { transform: `scale(${num(w / 200)} ${num(h / 130)})` },
      vorm("path", { d: "M2 2 H198 V104 C165 84 135 124 100 104 C65 84 35 124 2 104 Z", fill: ctx.thema.vulling, stroke: ctx.thema.rand, "stroke-width": dikte(ctx), "vector-effect": "non-scaling-stroke", "stroke-linejoin": "round" })
    );
  },
  inhoudsvak: (ctx) => ({ x: 4, y: 0, w: ctx.maat.w - 8, h: ctx.maat.h * 0.78, uitlijning: "midden" }),
  rand: (ctx, hoek) => randRechthoek({ w: ctx.maat.w, h: ctx.maat.h * 0.8 }, hoek),
};

/** Associatie-anker: klein rondje op de lijn. */
const anker = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm("circle", { cx: w / 2, cy: h / 2, r: Math.min(w, h) / 2 - 1, fill: ctx.thema.vulling, stroke: ctx.thema.rand, "stroke-width": 2 });
  },
  inhoudsvak: () => null,
  rand: (ctx, hoek) => cirkel.rand(ctx, hoek),
};

/**
 * Graaf-bol: de naam in een ronde kern, de velden als satellietjes eromheen (plan §8.10). De
 * satellieten zijn ornament: ze steken buiten de maat van het element uit.
 */
const KERN_R = 46, SAT_R = 19, ORBIT = KERN_R + SAT_R + 14;
const bol = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm("circle", { cx: w / 2, cy: h / 2, r: Math.min(w, h) / 2 - 1, fill: ctx.thema.vulling, stroke: ctx.thema.rand, "stroke-width": 1.5 });
  },
  inhoudsvak: (ctx) => ({ x: 8, y: 8, w: ctx.maat.w - 16, h: ctx.maat.h - 16, uitlijning: "midden" }),
  ornament(ctx) {
    const { w, h } = ctx.maat;
    const cx = w / 2, cy = h / 2;
    const velden = (ctx.element?.compartimenten || []).flatMap((c) => c.velden || []).filter((v) => v.naam);
    const kinderen = [];
    velden.forEach((v, i) => {
      const hoek = (i / Math.max(velden.length, 1)) * 2 * Math.PI - Math.PI / 2;
      const x = cx + ORBIT * Math.cos(hoek);
      const y = cy + ORBIT * Math.sin(hoek);
      kinderen.push(vorm("line", { x1: cx, y1: cy, x2: x, y2: y, stroke: ctx.thema.rand, "stroke-width": 1, opacity: 0.45 }));
      kinderen.push(vorm("circle", { cx: x, cy: y, r: SAT_R, fill: ctx.thema.surface, stroke: ctx.thema.rand, "stroke-width": 1.2 }));
      const naam = v.naam.length > 12 ? `${v.naam.slice(0, 11)}…` : v.naam;
      kinderen.push(vorm("text", { x, y: y + 3, "text-anchor": "middle", "font-size": 8.5, fill: ctx.thema.text }, naam));
    });
    return vorm("g", { class: "dc-bol-satellieten" }, ...kinderen);
  },
  rand: (ctx, hoek) => cirkel.rand(ctx, hoek),
};

/**
 * Strekfiguur (use case-actor): figuur in de bovenste 54px, de naam eronder in het inhoudsvak —
 * binnen de maat (het ShapeType rekent de figuur mee met `extraHoogte`), zodat canvas en
 * documenten dezelfde doos zien.
 */
const FIGUUR_H = 54;
const actor = {
  omtrek(ctx) {
    const { w } = ctx.maat;
    const cx = w / 2;
    const r = 8;
    const top = 3;
    const nek = top + 2 * r;
    const heup = nek + 18;
    const s = { fill: "none", stroke: ctx.thema.rand, "stroke-width": 1.6, "stroke-linecap": "round" };
    return vorm(
      "g",
      {},
      vorm("circle", { cx, cy: top + r, r, fill: ctx.thema.vulling, stroke: ctx.thema.rand, "stroke-width": 1.6 }),
      vorm("path", { d: `M ${num(cx)} ${num(nek)} V ${num(heup)} M ${num(cx - 16)} ${num(nek + 7)} H ${num(cx + 16)} M ${num(cx)} ${num(heup)} L ${num(cx - 14)} ${num(heup + 16)} M ${num(cx)} ${num(heup)} L ${num(cx + 14)} ${num(heup + 16)}`, ...s })
    );
  },
  inhoudsvak: (ctx) => ({ x: 0, y: FIGUUR_H - 6, w: ctx.maat.w, h: ctx.maat.h - FIGUUR_H + 6, uitlijning: "boven" }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

/**
 * Figuur: de vorm als gegevens in het ShapeType — `parameters.figuur = {viewBox, kinderen}`, een
 * VormBoom met plaatshouders `$vulling` (elementkleur), `$kleur` (lijnkleur), `$open` (vlak dat open
 * moet ogen) en `$sw` (lijndikte). Het figuur schaalt passend in de maat en zakt naar de onderkant
 * (zoals `preserveAspectRatio="xMidYMax meet"`), zonder inhoudsvak: de naam wordt een buitenlabel.
 * Zo zijn de ArchiMate-symbolen (poppetje, 3D-doos, …) sjablonen in het M2, geen code.
 */
const GETEKEND = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
const figuur = {
  omtrek(ctx) {
    const f = ctx.parameters.figuur || {};
    const [, , vbW, vbH] = String(f.viewBox || "0 0 64 64").split(/\s+/).map(Number);
    const { w, h } = ctx.maat;
    const s = Math.min(w / (vbW || 1), h / (vbH || 1));
    const dx = (w - vbW * s) / 2;
    const dy = h - vbH * s;
    const sw = ctx.stijl.randDikte ?? ctx.parameters.randDikte ?? 1.8;
    const vervang = { $vulling: ctx.thema.vulling, $kleur: ctx.thema.rand, $open: ctx.thema.surface, $sw: sw };
    // De lijndikte schaalt niet mee (vector-effect erft niet: op elke getekende vorm).
    const nietSchalen = (k) => (typeof k !== "object" || !k ? k : { ...k, attrs: GETEKEND.has(k.tag) ? { ...k.attrs, "vector-effect": "non-scaling-stroke" } : k.attrs, kinderen: (k.kinderen || []).map(nietSchalen) });
    const kinderen = (f.kinderen || []).map((k) => nietSchalen(vulIn(k, vervang)));
    return vorm("g", { class: "dc-figuur", transform: `translate(${n3(dx)} ${n3(dy)}) scale(${n3(s)})`, stroke: ctx.thema.rand, "stroke-width": sw, "stroke-linejoin": "round", "stroke-linecap": "round" }, ...kinderen);
  },
  inhoudsvak: () => null,
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

/** Diagramverwijzing: kader met ⧉ en de naam van het doeldiagram. */
const verwijzing = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const d = dikte(ctx, 1.5);
    return vorm("rect", { x: d / 2, y: d / 2, width: w - d, height: h - d, rx: 4, fill: ctx.thema.vulling, ...rand(ctx, 1.5) });
  },
  inhoudsvak: (ctx) => ({ x: 14, y: 0, w: ctx.maat.w - 14, h: ctx.maat.h, uitlijning: "midden" }),
  ornament: (ctx) => vorm("text", { x: 10, y: ctx.maat.h / 2 + 4, "font-size": 12, fill: ctx.thema.gedempt }, "⧉"),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

export const BIBLIOTHEEK = { rechthoek, ellips, cirkel, ruit, kader, notitie, package: pakket, knip, stadium, bkm, golf, anker, bol, actor, verwijzing, figuur };

for (const [id, r] of Object.entries(BIBLIOTHEEK)) registreerRenderer(id, r);
