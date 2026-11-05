// @ts-check
/**
 * business/vormen — de Eriksson-Penker-vormen als ShapeType (plan 2026-11-04 Eén tekenaar,
 * stap 4): proces (chevron met inkeping), doel (ellips met schietschijf), resource (doos met
 * een groot soort-icoon links) en gebeurtenis (afgeschuinde plaat met bliksem). Elke vorm
 * draagt zijn icoon ín de vorm, als ornament; de naam en het stereotype tekent de motor in
 * het inhoudsvak naast of onder het icoon. De actor is `uc-actor` (usecase/vormen.js).
 * Dezelfde id's als `shapes.jsx` (oude React-realisatie). Pure `.js`.
 */
import { registreerShapeType, registreerRenderer, vorm } from "../../diagramcore/types/shapeType.js";
import { randRechthoek } from "../../diagramcore/tekenaar/bibliotheek.js";
import { n3 } from "../../diagramcore/tekenaar/glyphs.js";
import { num } from "../../diagramsvg/svg.js";
import "../usecase/vormen.js";

const pts = (p) => p.map(([x, y]) => `${num(x)},${num(y)}`).join(" ");
const rand = (ctx, dikte = 1.2) => ({ stroke: ctx.thema.rand, "stroke-width": dikte, "stroke-linejoin": "round" });
/** Een 14×14-icoon op een plek, op maat. */
const icoon = (x, y, maat, kinderen) => vorm("g", { class: "dc-ep-icoon", transform: `translate(${n3(x)} ${n3(y)}) scale(${n3(maat / 14)})` }, ...kinderen);

// ── Proces: chevron met punt rechts en inkeping links ────────────────────────────────────────────
const PUNT = 24;
const proces = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm("polygon", { points: pts([[0.6, 0.6], [w - PUNT, 0.6], [w - 0.6, h / 2], [w - PUNT, h - 0.6], [0.6, h - 0.6], [PUNT, h / 2]]), fill: ctx.thema.vulling, ...rand(ctx) });
  },
  inhoudsvak: (ctx) => ({ x: PUNT + 4, y: 0, w: ctx.maat.w - 2 * PUNT - 8, h: ctx.maat.h, uitlijning: "midden" }),
  kindervak: (ctx) => ({ x: PUNT, y: 0, w: ctx.maat.w - 2 * PUNT, h: ctx.maat.h }),
  ornament: (ctx) => icoon(16, 6, 16, [vorm("path", { d: "M1.5 3 H9.5 L12.5 7 L9.5 11 H1.5 L4 7 Z", fill: ctx.thema.rand, opacity: 0.35 })]),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

// ── Doel: ellips met schietschijf ────────────────────────────────────────────────────────────────
const doel = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm("ellipse", { cx: w / 2, cy: h / 2, rx: w / 2 - 0.5, ry: h / 2 - 0.5, fill: ctx.thema.vulling, ...rand(ctx, 1) });
  },
  inhoudsvak: (ctx) => ({ x: 34, y: 0, w: ctx.maat.w - 56, h: ctx.maat.h, uitlijning: "midden" }),
  ornament(ctx) {
    const k = ctx.thema.rand;
    return icoon(14, ctx.maat.h / 2 - 9, 18, [vorm("circle", { cx: 7, cy: 7, r: 5.5, fill: "none", stroke: k, "stroke-width": 1.2 }), vorm("circle", { cx: 7, cy: 7, r: 3, fill: "none", stroke: k, "stroke-width": 1.2 }), vorm("circle", { cx: 7, cy: 7, r: 1.2, fill: k })]);
  },
  rand(ctx, hoek) {
    const { w, h } = ctx.maat;
    return { x: w / 2 + (w / 2) * Math.cos((hoek * Math.PI) / 180), y: h / 2 + (h / 2) * Math.sin((hoek * Math.PI) / 180) };
  },
};

// ── Resource: doos met groot soort-icoon links ───────────────────────────────────────────────────
const RESOURCE_ICOON = {
  fysiek: (k) => [vorm("path", { d: "M2 5 H12 V12 H2 Z M2 5 L4 2.5 H10 L12 5 M7 5 V12", fill: "none", stroke: k, "stroke-width": 1.1 })],
  mensen: (k) => [vorm("circle", { cx: 7, cy: 3.2, r: 1.9, fill: k }), vorm("path", { d: "M7 5.5 V9 M3.5 7 H10.5 M7 9 L4.5 12.8 M7 9 L9.5 12.8", fill: "none", stroke: k, "stroke-width": 1.2, "stroke-linecap": "round" })],
  informatie: (k) => [vorm("path", { d: "M3 1.5 H8.5 L11.5 4.5 V12.5 H3 Z M8.5 1.5 V4.5 H11.5", fill: "none", stroke: k, "stroke-width": 1.1 }), vorm("circle", { cx: 7.2, cy: 6.6, r: 0.8, fill: k }), vorm("path", { d: "M7.2 8.2 V11", stroke: k, "stroke-width": 1.5, "stroke-linecap": "round" })],
};
const resource = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm("rect", { x: 1, y: 1, width: w - 2, height: h - 2, rx: 6, fill: ctx.thema.vulling, ...rand(ctx, 2) });
  },
  inhoudsvak: (ctx) => ({ x: 44, y: 0, w: ctx.maat.w - 54, h: ctx.maat.h, uitlijning: "midden" }),
  ornament: (ctx) => icoon(10, ctx.maat.h / 2 - 14, 28, (RESOURCE_ICOON[ctx.elementType?.id] || RESOURCE_ICOON.fysiek)(ctx.thema.rand)),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

// ── Gebeurtenis: afgeschuinde plaat met bliksem ──────────────────────────────────────────────────
const SCHUIN = 10;
const gebeurtenis = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm("polygon", { points: pts([[SCHUIN, 0.6], [w - 0.6, 0.6], [w - SCHUIN, h - 0.6], [0.6, h - 0.6]]), fill: ctx.thema.vulling, ...rand(ctx) });
  },
  inhoudsvak: (ctx) => ({ x: 34, y: 0, w: ctx.maat.w - 50, h: ctx.maat.h, uitlijning: "midden" }),
  ornament: (ctx) => icoon(14, ctx.maat.h / 2 - 9, 18, [vorm("path", { d: "M8.5 1.5 L3.5 8 H7 L5.5 12.5 L10.5 6 H7 Z", fill: "#f59e0b", stroke: ctx.thema.rand, "stroke-width": 0.8 })]),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

registreerRenderer("ep-proces", proces);
registreerRenderer("ep-doel", doel);
registreerRenderer("ep-resource", resource);
registreerRenderer("ep-event", gebeurtenis);

/**
 * `factorW`: het inhoudsvak is smaller dan de doos (de punt en inkeping van het proces, het icoon
 * links van doel/resource/gebeurtenis); zo meet de motor de natuurlijke breedte op het vak.
 * @type {import("../../diagramcore/types/schema.js").ShapeType[]}
 */
export const BUSINESS_SHAPETYPES = [
  { id: "ep-proces", renderer: "ep-proces", parameters: { inhoud: "volledig", naamGrootte: 12, factorW: 0.7 }, minMaat: { w: 180, h: 64 } },
  { id: "ep-doel", renderer: "ep-doel", parameters: { inhoud: "volledig", naamGrootte: 12, factorW: 0.65, maxBreedte: 240 }, minMaat: { w: 150, h: 60 } },
  { id: "ep-resource", renderer: "ep-resource", parameters: { inhoud: "volledig", naamGrootte: 12, factorW: 0.66 }, minMaat: { w: 150, h: 48 } },
  { id: "ep-event", renderer: "ep-event", parameters: { inhoud: "volledig", naamGrootte: 12, factorW: 0.68, maxBreedte: 240 }, minMaat: { w: 150, h: 52 } },
];

for (const st of BUSINESS_SHAPETYPES) registreerShapeType(st);

/**
 * De eigen inhoud van een resource: de hoeveelheid/capaciteit onder de naam, gedempt.
 * @type {(element: Object) => import("../../diagramcore/types/schema.js").InhoudsRegel[]}
 */
export function resourceInhoud(element) {
  const h = element?.data?.hoeveelheid;
  return h ? [{ anker: "midden", grootte: 10, delen: [{ tekst: String(h), soort: "staart", veld: "hoeveelheid" }] }] : [];
}
