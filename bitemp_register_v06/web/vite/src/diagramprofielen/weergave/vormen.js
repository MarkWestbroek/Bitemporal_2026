// @ts-check
/**
 * weergave/vormen — hoe een weergave zichzelf tekent in het profiel Weergave (plan 2026-11-21
 * Sidecar-project §3). Twee renderers, omdat het voorbeeld van het element afhangt:
 *
 *   - `weergave-icoon`: een tegel met het icoon erin (de SVG-tekst uit `data.svg`, gelezen door
 *     `svgSchoon.js`, dus alleen veilige SVG) en de naam eronder.
 *   - `weergave-vorm`: het element ís de vorm die het beschrijft. De renderer zoekt de renderer op
 *     id op (`data.renderer`) en tekent met `data.parameters`; zo zie je op het canvas precies wat
 *     de vorm in een ander profiel wordt. Een onbekende renderer geeft een rood gestippeld vak.
 *
 * - `weergave-koppeling`: een kaart met de naam en per elementtype waar het naartoe wijst.
 *
 * Pure `.js`.
 */
import { registreerShapeType, registreerRenderer, getRenderer, vorm } from "../../diagramcore/types/shapeType.js";
import { randRechthoek } from "../../diagramcore/tekenaar/bibliotheek.js";
import { kleurenVoor } from "../../diagramcore/tekenaar/voorkomen.js";
import { svgNaarVormBoom } from "../../diagramcore/shapes/svgSchoon.js";
import { vulVlakIn } from "../../diagramcore/shapes/iconenAlsSvg.js";

export const ICOON_VORM = "weergave-icoon";
export const VORM_VORM = "weergave-vorm";
export const KOPPELING_VORM = "weergave-koppeling";

const TEGEL_ICOON = 40;
const NAAM_H = 26;
const rond = (n) => Math.round(n * 100) / 100;

const icoon = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm("rect", { x: 0.75, y: 0.75, width: w - 1.5, height: h - 1.5, rx: 8, fill: ctx.thema.vulling, stroke: ctx.thema.rand, "stroke-width": 1.5 });
  },
  inhoudsvak: (ctx) => ({ x: 4, y: ctx.maat.h - NAAM_H, w: ctx.maat.w - 8, h: NAAM_H - 4, uitlijning: "midden" }),
  ornament(ctx) {
    const svg = ctx.element?.data?.svg;
    if (!svg) return null;
    // `$vlak` (een open vlak in het icoon) krijgt de vulling van de tegel.
    const { viewBox, kinderen } = svgNaarVormBoom(vulVlakIn(svg, ctx.thema.vulling || "#fff"));
    const [vx, vy, vw, vh] = String(viewBox).split(/[\s,]+/).map(Number);
    if (!(vw > 0 && vh > 0)) return null;
    const ruimte = Math.min(TEGEL_ICOON, ctx.maat.w - 16, ctx.maat.h - NAAM_H - 10);
    const schaal = ruimte / Math.max(vw, vh);
    const x = (ctx.maat.w - vw * schaal) / 2 - vx * schaal;
    const y = (ctx.maat.h - NAAM_H - vh * schaal) / 2 - vy * schaal + 2;
    // Monochroom volgt de inkt; anders zijn het de eigen kleuren van het icoon.
    const kleur = ctx.thema.inkt || ctx.thema.text;
    const basis = ctx.element?.data?.monochroom === false ? {} : { fill: "none", stroke: "currentColor", "stroke-width": 1.2, "stroke-linecap": "round", "stroke-linejoin": "round" };
    return vorm("g", { class: "dc-weergave-icoon", color: kleur, transform: `translate(${rond(x)} ${rond(y)}) scale(${rond(schaal * 1000) / 1000})`, ...basis }, kinderen);
  },
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};
registreerRenderer(ICOON_VORM, icoon);

/** De renderer en parameters die dit vorm-element beschrijft, of null. */
function doelVan(ctx) {
  const data = ctx.element?.data || {};
  const renderer = data.renderer && data.renderer !== VORM_VORM ? getRenderer(data.renderer) : null;
  if (!renderer) return null;
  const parameters = data.parameters && typeof data.parameters === "object" ? data.parameters : {};
  return { renderer, ctx: { ...ctx, parameters, thema: kleurenVoor(ctx.thema, ctx.stijl, parameters) } };
}

const onbekend = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm("rect", { x: 1, y: 1, width: w - 2, height: h - 2, rx: 4, fill: ctx.thema.vulling, stroke: "#dc2626", "stroke-width": 1.5, "stroke-dasharray": "5 4" });
  },
  inhoudsvak: (ctx) => ({ x: 0, y: 0, w: ctx.maat.w, h: ctx.maat.h, uitlijning: "midden" }),
};

const vormVoorbeeld = {
  omtrek(ctx) {
    const doel = doelVan(ctx);
    return doel ? doel.renderer.omtrek(doel.ctx) : onbekend.omtrek(ctx);
  },
  inhoudsvak(ctx) {
    const doel = doelVan(ctx);
    // Een vorm zonder inhoudsvak (een stip, een balk): de naam toch in het midden.
    return (doel && doel.renderer.inhoudsvak(doel.ctx)) || onbekend.inhoudsvak(ctx);
  },
  kindervak(ctx) {
    const doel = doelVan(ctx);
    return doel?.renderer.kindervak ? doel.renderer.kindervak(doel.ctx) : { x: 0, y: 0, w: ctx.maat.w, h: ctx.maat.h };
  },
  ornament(ctx) {
    const doel = doelVan(ctx);
    return doel?.renderer.ornament ? doel.renderer.ornament(doel.ctx) : null;
  },
  rand(ctx, hoek) {
    const doel = doelVan(ctx);
    return doel?.renderer.rand ? doel.renderer.rand(doel.ctx, hoek) : randRechthoek(ctx.maat, hoek);
  },
};
registreerRenderer(VORM_VORM, vormVoorbeeld);

/**
 * Een koppeling: een kaart met de naam bovenaan en eronder per elementtype waar het naartoe wijst
 * ("taak → bpmn-taak · taak-icoon"), zoveel als past; daaronder "+N meer".
 */
const KOP_H = 26;
const REGEL_H = 14;
/** De regels van een koppeling als tekstregels. */
export function koppelingRegels(data) {
  return Object.entries(data?.regels || {}).map(([et, r]) => {
    const regel = r && typeof r === "object" ? r : {};
    const delen = regel.shape || regel.icoon ? [regel.shape, regel.icoon].filter(Boolean) : [regel.lijn, regel.markerEnd].filter(Boolean);
    return `${et} → ${delen.join(" · ") || "—"}`;
  });
}
const koppeling = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm("g", {}, [
      vorm("rect", { x: 0.75, y: 0.75, width: w - 1.5, height: h - 1.5, rx: 4, fill: ctx.thema.vulling, stroke: ctx.thema.rand, "stroke-width": 1.5 }),
      vorm("line", { x1: 0.75, y1: KOP_H, x2: w - 0.75, y2: KOP_H, stroke: ctx.thema.rand, "stroke-width": 1 }),
    ]);
  },
  inhoudsvak: (ctx) => ({ x: 6, y: 2, w: ctx.maat.w - 12, h: KOP_H - 4, uitlijning: "midden" }),
  ornament(ctx) {
    const regels = koppelingRegels(ctx.element?.data);
    const past = Math.max(0, Math.floor((ctx.maat.h - KOP_H - 8) / REGEL_H));
    const toon = regels.length > past ? regels.slice(0, Math.max(0, past - 1)) : regels;
    const kleur = ctx.thema.text || ctx.thema.inkt;
    const kinderen = toon.map((t, i) => vorm("text", { x: 8, y: KOP_H + 14 + i * REGEL_H, "font-size": 10, fill: kleur }, t));
    if (toon.length < regels.length) kinderen.push(vorm("text", { x: 8, y: KOP_H + 14 + toon.length * REGEL_H, "font-size": 10, fill: kleur, "font-style": "italic" }, `+${regels.length - toon.length} meer`));
    return vorm("g", { class: "dc-weergave-koppeling" }, kinderen);
  },
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};
registreerRenderer(KOPPELING_VORM, koppeling);

/** @type {import("../../diagramcore/types/schema.js").ShapeType[]} */
export const WEERGAVE_SHAPETYPES = [
  { id: ICOON_VORM, renderer: ICOON_VORM, parameters: { inhoud: "naam", naamGrootte: 11, uitlijning: "midden" }, minMaat: { w: 96, h: 84 } },
  { id: VORM_VORM, renderer: VORM_VORM, parameters: { inhoud: "naam", naamGrootte: 12, uitlijning: "midden" }, minMaat: { w: 130, h: 70 } },
  { id: KOPPELING_VORM, renderer: KOPPELING_VORM, parameters: { inhoud: "naam", naamGrootte: 12, uitlijning: "midden" }, minMaat: { w: 280, h: 160 } },
];

for (const st of WEERGAVE_SHAPETYPES) registreerShapeType(st);
