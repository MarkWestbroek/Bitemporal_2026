// @ts-check
/**
 * cmmn/vormen — de CMMN-vormen als ShapeType (plan 2026-11-04 Eén tekenaar, stap 4). CMMN heeft
 * een eigen vormentaal die de betekenis ís, dus alle zeven zijn eigen renderers:
 *
 *   - case plan model: mapvorm met een brede, vierkante tab linksboven (anders dan de package);
 *   - stage: achthoek (afschuining 12), gestreept als discretionair; naam boven, markeringen onder;
 *   - task: afgeronde rechthoek met soort-icoon linksboven en de planningsmarkeringen onderaan
 *     (! verplicht · # herhaling · ▷ handmatig), gestreept als discretionair;
 *   - milestone: de bibliotheek-`stadium`;
 *   - event listener: dubbele cirkel met klok (timer) of poppetje (user);
 *   - case file item: dokje met omgevouwen hoek;
 *   - sentry: de ruit op de rand — open = entry, gevuld = exit.
 *
 * Pure `.js`.
 */
import { registreerShapeType, registreerRenderer, vorm } from "../../diagramcore/types/shapeType.js";
import { randRechthoek, randCirkel, geschaald } from "../../diagramcore/tekenaar/bibliotheek.js";
import { tekstBreedte } from "../../diagramsvg/tekstmaat.js";
import { n3 } from "../../diagramcore/tekenaar/glyphs.js";
import { num } from "../../diagramsvg/svg.js";

/** Iconen en markeringen óp een lichte vulling blijven donker, ook in donker thema. */
const INKT = "#334155";
const MARKERING = "#475569";
const HOEK = 12;
const STIPPEL = "6 4";

/** Planningsmarkeringen (`data.verplicht/herhaling/handmatig`) als tekens. */
export function markeringen(data) {
  const uit = [];
  if (data?.verplicht) uit.push("!");
  if (data?.herhaling) uit.push("#");
  if (data?.handmatig) uit.push("▷");
  return uit;
}

/** De markeringen gecentreerd onderaan de vorm, of null. */
function markeringenOrnament(ctx) {
  const tekens = markeringen(ctx.element?.data);
  if (!tekens.length) return null;
  const { w, h } = ctx.maat;
  return vorm("text", { class: "dc-cmmn-markeringen", x: w / 2, y: h - 4, "text-anchor": "middle", "font-size": 11, fill: MARKERING, "letter-spacing": 3 }, tekens.join(""));
}

/** Vulling van een container: de eigen kleur licht, anders een zweem van de rand. */
function containerVulling(ctx, sterkte) {
  const eigen = ctx.stijl.kleur || null;
  return eigen ? { fill: eigen, "fill-opacity": sterkte * 1.5 } : { fill: ctx.thema.rand, "fill-opacity": sterkte };
}

// ── Case plan model ──────────────────────────────────────────────────────────────────────────────
const TAB_H = 24;
const tabBreedte = (ctx) => Math.min(ctx.maat.w * 0.6, Math.max(60, Math.ceil(tekstBreedte(ctx.element?.naam || "", 12, { vet: true }) + 28)));

/** Mapvorm: brede vierkante tab linksboven die zijn onderrand deelt met de romp. */
const casePlan = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const tabW = tabBreedte(ctx);
    const d = 1.8;
    const rand = { stroke: ctx.thema.rand, "stroke-width": d };
    // Twee open paden (de vulling sluit ze): de romprand begint pas rechts van de tab en de tab
    // heeft geen onderrand, zodat tab en romp één doorlopende contour vormen.
    return vorm(
      "g",
      {},
      vorm("path", { d: `M ${num(tabW)} ${TAB_H} H ${num(w - d / 2 - 5)} a 5 5 0 0 1 5 5 V ${num(h - d / 2 - 5)} a 5 5 0 0 1 -5 5 H ${num(d / 2 + 5)} a 5 5 0 0 1 -5 -5 V ${TAB_H}`, ...containerVulling(ctx, 0.06), ...rand }),
      vorm("path", { d: `M ${num(d / 2)} ${TAB_H} V ${num(d / 2 + 5)} a 5 5 0 0 1 5 -5 H ${num(tabW - 5)} a 5 5 0 0 1 5 5 V ${TAB_H}`, ...containerVulling(ctx, 0.1), ...rand })
    );
  },
  inhoudsvak: (ctx) => ({ x: 0, y: 0, w: tabBreedte(ctx), h: TAB_H, uitlijning: "midden" }),
  kindervak: (ctx) => ({ x: 0, y: TAB_H, w: ctx.maat.w, h: ctx.maat.h - TAB_H }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

// ── Stage ────────────────────────────────────────────────────────────────────────────────────────
/** Achthoek op de echte maat; gestreept = discretionair (plan fragment). */
const stage = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const m = 1;
    const pad = `M ${HOEK + m} ${m} H ${num(w - HOEK - m)} L ${num(w - m)} ${HOEK + m} V ${num(h - HOEK - m)} L ${num(w - HOEK - m)} ${num(h - m)} H ${HOEK + m} L ${m} ${num(h - HOEK - m)} V ${HOEK + m} Z`;
    const attrs = { d: pad, ...containerVulling(ctx, 0.06), stroke: ctx.thema.rand, "stroke-width": 1.8, "stroke-linejoin": "round" };
    if (ctx.element?.data?.discretionair) attrs["stroke-dasharray"] = STIPPEL;
    return vorm("path", attrs);
  },
  inhoudsvak: (ctx) => ({ x: HOEK, y: 2, w: ctx.maat.w - 2 * HOEK, h: 26, uitlijning: "boven" }),
  kindervak: (ctx) => ({ x: 0, y: 28, w: ctx.maat.w, h: ctx.maat.h - 28 - 14 }),
  ornament: markeringenOrnament,
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

// ── Task ─────────────────────────────────────────────────────────────────────────────────────────
/** Type-icoontje linksboven (viewBox 14): human ☺ · proces ▸ · case ▤ · decision ⊞. */
const lijn = (k) => ({ stroke: k, "stroke-width": 1.2, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" });
const TAAK_ICONEN = {
  human: (k) => [vorm("circle", { cx: 7, cy: 4.4, r: 2.2, ...lijn(k) }), vorm("path", { d: "M2.8 12c0-2.4 1.9-4 4.2-4s4.2 1.6 4.2 4", ...lijn(k) })],
  proces: (k) => [vorm("path", { d: "M3 2.5 L10.5 7 L3 11.5 Z", ...lijn(k) })],
  case: (k) => [vorm("path", { d: "M2 4.2 V11.5 H12 V5.6 H7.2 L6 4.2 Z", ...lijn(k) })],
  decision: (k) => [vorm("rect", { x: 2, y: 3, width: 10, height: 8, rx: 0.8, ...lijn(k) }), vorm("path", { d: "M2 6 H12 M6 3 V11", ...lijn(k) })],
};

const taak = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const attrs = { x: 1, y: 1, width: w - 2, height: h - 2, rx: 12, fill: ctx.thema.vulling, stroke: ctx.thema.rand, "stroke-width": 2 };
    if (ctx.element?.data?.discretionair) attrs["stroke-dasharray"] = STIPPEL;
    return vorm("rect", attrs);
  },
  // Onder de naam ruimte voor de markeringen (zoals de padding 8/12/14 van de oude shape).
  inhoudsvak: (ctx) => ({ x: 0, y: 0, w: ctx.maat.w, h: ctx.maat.h - 8, uitlijning: "midden" }),
  ornament(ctx) {
    const teken = TAAK_ICONEN[ctx.element?.data?.soort];
    const kinderen = [];
    if (teken) kinderen.push(vorm("g", { class: "dc-taak-icoon", transform: "translate(5 4)" }, ...teken(INKT)));
    const m = markeringenOrnament(ctx);
    if (m) kinderen.push(m);
    return kinderen.length ? vorm("g", {}, ...kinderen) : null;
  },
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

// ── Event listener ───────────────────────────────────────────────────────────────────────────────
/** Dubbele cirkel (viewBox 20) met klok of poppetje; het binnenvlak oogt open. */
const event = {
  omtrek(ctx) {
    const k = ctx.thema.rand;
    const s = { stroke: k, "stroke-width": 1.3, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" };
    const kinderen = [vorm("circle", { cx: 10, cy: 10, r: 9, fill: ctx.thema.surface, stroke: k, "stroke-width": 1.3 }), vorm("circle", { cx: 10, cy: 10, r: 7.2, fill: "none", stroke: k, "stroke-width": 1.1 })];
    const soort = ctx.element?.data?.soort;
    if (soort === "timer") kinderen.push(vorm("circle", { cx: 10, cy: 10, r: 4.2, ...s }), vorm("path", { d: "M10 7.4 V10 L11.9 11.4", ...s }));
    if (soort === "user") kinderen.push(vorm("circle", { cx: 10, cy: 8.3, r: 1.8, ...s }), vorm("path", { d: "M6.8 13.6c0-1.8 1.4-3 3.2-3s3.2 1.2 3.2 3", ...s }));
    return geschaald(ctx, 20, kinderen);
  },
  inhoudsvak: () => null,
  rand: randCirkel,
};

// ── Case file item ───────────────────────────────────────────────────────────────────────────────
const DOKJE_W = 30;
const DOKJE_H = 38;
/** Dokje met omgevouwen hoek, gecentreerd in de (bredere) doos. */
const caseFile = {
  omtrek(ctx) {
    const k = ctx.thema.rand;
    const { w, h } = ctx.maat;
    const s = Math.min(w / DOKJE_W, h / DOKJE_H);
    return vorm(
      "g",
      { transform: `translate(${n3((w - DOKJE_W * s) / 2)} ${n3((h - DOKJE_H * s) / 2)}) scale(${n3(s)})` },
      vorm("path", { d: "M2 2 H20 L28 10 V36 H2 Z", fill: ctx.thema.surface, stroke: k, "stroke-width": 1.5, "stroke-linejoin": "round" }),
      vorm("path", { d: "M20 2 V10 H28", fill: "none", stroke: k, "stroke-width": 1.5, "stroke-linejoin": "round" })
    );
  },
  inhoudsvak: () => null,
  rand: (ctx, hoek) => randRechthoek({ w: DOKJE_W, h: DOKJE_H }, hoek),
};

// ── Sentry ───────────────────────────────────────────────────────────────────────────────────────
/** Ruit op de rand: open = entry criterion, gevuld = exit criterion (`data.soort`). */
const sentry = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const k = ctx.thema.rand;
    const gevuld = ctx.element?.data?.soort === "exit";
    const p = [[w / 2, 1], [w - 1, h / 2], [w / 2, h - 1], [1, h / 2]];
    return vorm("polygon", { points: p.map(([x, y]) => `${num(x)},${num(y)}`).join(" "), fill: gevuld ? k : ctx.thema.surface, stroke: k, "stroke-width": 1.4, "stroke-linejoin": "round" });
  },
  inhoudsvak: () => null,
  rand(ctx, hoek) {
    const { w, h } = ctx.maat;
    const dx = Math.cos((hoek * Math.PI) / 180);
    const dy = Math.sin((hoek * Math.PI) / 180);
    const s = 1 / (Math.abs(dx) / (w / 2) + Math.abs(dy) / (h / 2) || 1);
    return { x: w / 2 + dx * s, y: h / 2 + dy * s };
  },
};

registreerRenderer("cmmn-caseplan", casePlan);
registreerRenderer("cmmn-stage", stage);
registreerRenderer("cmmn-taak", taak);
registreerRenderer("cmmn-event", event);
registreerRenderer("cmmn-casefile", caseFile);
registreerRenderer("cmmn-sentry", sentry);

/** @type {import("../../diagramcore/types/schema.js").ShapeType[]} */
export const CMMN_SHAPETYPES = [
  { id: "cmmn-caseplan", renderer: "cmmn-caseplan", parameters: { inhoud: "naam", naamGrootte: 12, tekstAnker: "links", kleurAls: "rand", rand: "#94a3b8" }, minMaat: { w: 320, h: 220 } },
  { id: "cmmn-stage", renderer: "cmmn-stage", parameters: { inhoud: "naam", naamGrootte: 12, tekstAnker: "midden", kleurAls: "rand", rand: "#94a3b8" }, minMaat: { w: 220, h: 130 } },
  { id: "cmmn-taak", renderer: "cmmn-taak", parameters: { inhoud: "naam", naamGrootte: 12, rand: "#7dd3fc" }, minMaat: { w: 180, h: 56 } },
  { id: "cmmn-mijlpaal", renderer: "stadium", parameters: { inhoud: "naam", naamGrootte: 12, rand: "#a78bfa" }, minMaat: { w: 150, h: 44 } },
  { id: "cmmn-event", renderer: "cmmn-event", parameters: { inhoud: "geen" }, minMaat: { w: 32, h: 32 } },
  { id: "cmmn-casefile", renderer: "cmmn-casefile", parameters: { inhoud: "geen" }, minMaat: { w: 46, h: DOKJE_H } },
  { id: "cmmn-sentry", renderer: "cmmn-sentry", parameters: { inhoud: "geen" }, minMaat: { w: 18, h: 24 } },
];

for (const st of CMMN_SHAPETYPES) registreerShapeType(st);
