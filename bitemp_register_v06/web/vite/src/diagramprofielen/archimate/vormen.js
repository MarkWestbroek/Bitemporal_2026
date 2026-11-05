// @ts-check
/**
 * archimate/vormen — de ArchiMate-vormen als ShapeType (plan 2026-11-04 Eén tekenaar, stap 4).
 *
 *   - `archimate-box`      de formele notatie: rechthoek in de laagkleur met het type-icoon
 *                          rechtsboven; gedrag ronde hoeken (elementType.hoekRadius), structuur
 *                          recht, motivation afgeschuind (elementType.hoekStijl) — renderer `am-box`;
 *   - `archimate-grouping` gestippeld kader, naam linksboven, groep-icoon — renderer `am-laag`;
 *   - `archimate-junction` stip, open bij `data.soort === "of"` — renderer `am-junction`;
 *   - `am-blok`/`am-blok-laag` de set "Blokken (informeel)": bibliotheek `rechthoek` en `am-laag`;
 *   - `am-vorm-*`          de set "Iconen als vorm": de spec-symbolen als **gegevens** in het
 *                          ShapeType (`parameters.figuur`), op de bibliotheek-renderer `figuur`.
 *
 * De iconen komen uit `glyphs.js` (gegevens), het icoon per type uit `elementType.icoon`. Pure
 * `.js`: ook in de render-bundel en in `node --test`.
 */
import { registreerShapeType, registreerRenderer, vorm } from "../../diagramcore/types/shapeType.js";
import { glyphVorm } from "../../diagramcore/tekenaar/glyphs.js";
import { randRechthoek } from "../../diagramcore/tekenaar/bibliotheek.js";
import { veiligeKleur } from "../../diagramsvg/thema.js";
import { num } from "../../diagramsvg/svg.js";
import { VORM_SHAPE_IDS } from "./vormSet.js";
import "./glyphs.js";

const ICOON = 13;

/** Het type-icoon rechtsboven, als ornament. */
function hoekIcoon(ctx, { afgeschuind = false } = {}) {
  const id = ctx.elementType?.icoon;
  if (!id || ctx.parameters.icoon === false) return null;
  const x = ctx.maat.w - ICOON - (afgeschuind ? 7 : 4);
  return glyphVorm(id, { x, y: afgeschuind ? 5 : 3, maat: ICOON, kleur: ctx.thema.gedempt, vlak: ctx.thema.vulling });
}

/**
 * De box: rechthoek (hoekradius uit de stijl: gedrag rond, structuur recht) of achthoek
 * (motivation, `hoekStijl: "afgeschuind"`), in de laagkleur; icoon rechtsboven.
 */
const amBox = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const d = ctx.stijl.randDikte ?? ctx.parameters.randDikte ?? 1.5;
    const basis = { fill: ctx.thema.vulling, stroke: ctx.thema.rand, "stroke-width": d, "stroke-linejoin": "round" };
    if (ctx.elementType?.hoekStijl === "afgeschuind") {
      const k = ctx.parameters.schuin ?? 8;
      const m = d / 2;
      const pts = [[k + m, m], [w - k - m, m], [w - m, k + m], [w - m, h - k - m], [w - k - m, h - m], [k + m, h - m], [m, h - k - m], [m, k + m]];
      return vorm("polygon", { points: pts.map(([x, y]) => `${num(x)},${num(y)}`).join(" "), ...basis });
    }
    return vorm("rect", { x: d / 2, y: d / 2, width: w - d, height: h - d, rx: ctx.stijl.hoekRadius ?? ctx.parameters.hoekRadius ?? 2, ...basis });
  },
  // Ruimte rechts voor het icoon (oude box: padding 6px 22px 6px 10px).
  inhoudsvak: (ctx) => ({ x: 0, y: 0, w: ctx.maat.w - 12, h: ctx.maat.h, uitlijning: "midden" }),
  kindervak: (ctx) => ({ x: 0, y: 0, w: ctx.maat.w, h: ctx.maat.h }),
  ornament: (ctx) => hoekIcoon(ctx, { afgeschuind: ctx.elementType?.hoekStijl === "afgeschuind" }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

/**
 * Laagkader (grouping, blok-laag): rand in de eigen kleur van het element (`data.kleur`) of de
 * vaste `parameters.rand`, gestippeld of doorgetrokken; achtergrondkleur uit het element, anders
 * `parameters.vulling` of open. De naam linksboven; de leden eronder. Icoon alleen met `icoon: true`.
 */
const KOP = 26;
const amLaag = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const d = ctx.stijl.randDikte ?? ctx.parameters.randDikte ?? 1.5;
    const achtergrond = veiligeKleur(ctx.element?.data?.achtergrondKleur, null);
    const attrs = { x: d / 2, y: d / 2, width: w - d, height: h - d, rx: ctx.parameters.hoekRadius ?? 4, stroke: ctx.thema.rand, "stroke-width": d };
    if (achtergrond) attrs.fill = achtergrond;
    else if (ctx.parameters.vulling) {
      attrs.fill = ctx.parameters.vulling;
      if (ctx.parameters.vullingOpacity !== undefined) attrs["fill-opacity"] = ctx.parameters.vullingOpacity;
    } else attrs.fill = "none";
    if ((ctx.parameters.lijn || "dashed") === "dashed") attrs["stroke-dasharray"] = "6 4";
    return vorm("rect", attrs);
  },
  inhoudsvak: (ctx) => ({ x: 0, y: 0, w: ctx.maat.w - (ctx.parameters.icoon ? 24 : 0), h: KOP, uitlijning: "boven" }),
  kindervak: (ctx) => ({ x: 0, y: KOP, w: ctx.maat.w, h: ctx.maat.h - KOP }),
  ornament: (ctx) => (ctx.parameters.icoon ? hoekIcoon(ctx) : null),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

/** Junction: stip in de lijnkleur; `data.soort === "of"` tekent hem open. */
const amJunction = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const open = ctx.element?.data?.soort === "of";
    const r = Math.min(w, h) / 2 - 0.75;
    return vorm("circle", { cx: w / 2, cy: h / 2, r, fill: open ? ctx.thema.vulling : ctx.thema.rand, stroke: ctx.thema.rand, "stroke-width": 1.5 });
  },
  inhoudsvak: () => null,
  rand(ctx, hoek) {
    const { w, h } = ctx.maat;
    const r = Math.min(w, h) / 2;
    return { x: w / 2 + r * Math.cos((hoek * Math.PI) / 180), y: h / 2 + r * Math.sin((hoek * Math.PI) / 180) };
  },
};

registreerRenderer("am-box", amBox);
registreerRenderer("am-laag", amLaag);
registreerRenderer("am-junction", amJunction);

// ── De figuren (set "Iconen als vorm"): het symbool zelf als vorm, als gegevens ─────────────────
// Plaatshouders: $vulling (laagkleur), $kleur (lijn), $open (vlak dat open oogt), $sw (lijndikte).
const P = (d, attrs = {}) => vorm("path", { d, ...attrs });
const C = (cx, cy, r, attrs = {}) => vorm("circle", { cx, cy, r, ...attrs });
const R = (x, y, width, height, attrs = {}) => vorm("rect", { x, y, width, height, ...attrs });
const L = (x1, y1, x2, y2) => vorm("line", { x1, y1, x2, y2, fill: "none" });
const V = { fill: "$vulling" };
const GEEN = { fill: "none" };

/** @type {Record<string, {viewBox: string, kinderen: import("../../diagramcore/types/schema.js").VormBoom[]}>} */
export const FIGUREN = {
  // Business actor: het poppetje.
  "am-vorm-actor": { viewBox: "0 0 48 60", kinderen: [C(24, 12, 9, V), P("M24 21 V38 M9 27 H39 M24 38 L12 56 M24 38 L36 56", GEEN)] },
  // Business rol: de liggende cilinder, met de naad rechts.
  "am-vorm-rol": { viewBox: "0 0 72 44", kinderen: [P("M18 6 H50 a11 16 0 0 1 0 32 H18 a11 16 0 0 1 0 -32 Z", V), P("M50 6 a11 16 0 0 0 0 32", GEEN)] },
  // Business proces: de pijl.
  "am-vorm-proces": { viewBox: "0 0 96 48", kinderen: [P("M4 14 H60 V4 L92 24 L60 44 V34 H4 Z", V)] },
  // Functie: de chevron met de punt naar boven.
  "am-vorm-functie": { viewBox: "0 0 60 60", kinderen: [P("M30 4 L56 26 V56 L30 38 L4 56 V26 Z", V)] },
  // Service: het afgeronde blok.
  "am-vorm-service": { viewBox: "0 0 96 44", kinderen: [R(4, 6, 88, 32, { rx: 16, ...V })] },
  // Event: de pijl met de inkeping aan de achterkant.
  "am-vorm-event": { viewBox: "0 0 92 44", kinderen: [P("M6 6 H62 L86 22 L62 38 H6 L24 22 Z", V)] },
  // Object: de rechthoek met de kopstreep.
  "am-vorm-object": { viewBox: "0 0 96 56", kinderen: [R(4, 6, 88, 44, V), L(4, 18, 92, 18)] },
  // Applicatiecomponent: het blok met de twee uitsteeksels.
  "am-vorm-component": { viewBox: "0 0 84 60", kinderen: [R(18, 4, 62, 52, V), R(4, 14, 28, 12, V), R(4, 34, 28, 12, V)] },
  // Node: de 3D-doos; boven- en zijvlak iets doorschijnend.
  "am-vorm-node": { viewBox: "0 0 84 64", kinderen: [P("M4 18 L20 4 H80 L64 18 Z", { ...V, "fill-opacity": 0.65 }), P("M64 18 L80 4 V46 L64 60 Z", { ...V, "fill-opacity": 0.65 }), R(4, 18, 60, 42, V)] },
  // Device: de afgeronde doos op een voet.
  "am-vorm-device": { viewBox: "0 0 88 64", kinderen: [R(10, 4, 68, 40, { rx: 7, ...V }), P("M2 58 L16 44 H72 L86 58 Z", V)] },
  // Systeemsoftware: de bol met de arc van de bol erachter.
  "am-vorm-software": { viewBox: "0 0 72 68", kinderen: [P("M12 30 A24 24 0 0 1 48 8", GEEN), C(42, 40, 24, V)] },
  // Artifact: het dokje met de omgevouwen hoek (de hoek blijft onvuld).
  "am-vorm-artifact": { viewBox: "0 0 64 76", kinderen: [P("M6 4 H40 L58 22 V72 H6 Z", V), P("M40 4 V22 H58", GEEN)] },
  // Interface: de lollipop.
  "am-vorm-interface": { viewBox: "0 0 92 56", kinderen: [P("M4 28 H48", GEEN), C(68, 28, 20, V)] },
  // Capability: de blokjes-trap.
  "am-vorm-capability": { viewBox: "0 0 76 76", kinderen: [[50, 2], [50, 26], [26, 26], [50, 50], [26, 50], [2, 50]].map(([x, y]) => R(x, y, 24, 24, V)) },
  // Goal: het dartbord — ring, ring, roos.
  "am-vorm-goal": { viewBox: "0 0 72 72", kinderen: [C(36, 36, 30, V), C(36, 36, 19, { fill: "$open" }), C(36, 36, 8, { fill: "$kleur", stroke: "none" })] },
  // Driver: het stuurwiel.
  "am-vorm-driver": { viewBox: "0 0 72 72", kinderen: [C(36, 36, 26, V), P("M36 4 V68 M4 36 H68 M13.4 13.4 L58.6 58.6 M58.6 13.4 L13.4 58.6", GEEN), C(36, 36, 7, { fill: "$kleur", stroke: "none" })] },
  // Stakeholder: cirkel met naaf en vier asjes.
  "am-vorm-stakeholder": { viewBox: "0 0 72 72", kinderen: [C(36, 36, 25, V), C(36, 36, 9, { fill: "$open" }), P("M36 5 v11 M36 56 v11 M5 36 h11 M56 36 h11", GEEN)] },
  // Principle: de plaquette met het uitroepteken.
  "am-vorm-principle": { viewBox: "0 0 64 72", kinderen: [R(6, 5, 52, 62, { rx: 8, ...V }), P("M32 18 V44", { fill: "none", "stroke-width": 5 }), C(32, 55, 3.6, { fill: "$kleur", stroke: "none" })] },
  // Requirement en constraint: het parallellogram.
  "am-vorm-requirement": { viewBox: "0 0 92 52", kinderen: [P("M24 6 H88 L68 46 H4 Z", V)] },
};

/** Natuurlijke hoogte van een figuur (zoals de oude VormNode: 64), breedte naar verhouding. */
const FIGUUR_H = 64;
const natuurlijkeMaat = (viewBox) => {
  const [, , w, h] = viewBox.split(/\s+/).map(Number);
  return { w: Math.round((w / h) * FIGUUR_H), h: FIGUUR_H };
};

/** @type {import("../../diagramcore/types/schema.js").ShapeType[]} */
export const ARCHIMATE_SHAPETYPES = [
  { id: "archimate-box", renderer: "am-box", parameters: { inhoud: "naam", naamGrootte: 12, randDikte: 1.5, hoekRadius: 2 }, minMaat: { w: 140, h: 48 } },
  { id: "archimate-grouping", renderer: "am-laag", parameters: { inhoud: "naam", naamGrootte: 12, tekstAnker: "links", lijn: "dashed", hoekRadius: 4, icoon: true, kleurAls: "rand", rand: "#64748b", randDikte: 1.5 }, minMaat: { w: 200, h: 90 } },
  { id: "archimate-junction", renderer: "am-junction", parameters: { inhoud: "geen" }, minMaat: { w: 16, h: 16 } },
  // Set "Blokken (informeel)": effen afgerond blok zonder icoon; de laag als licht kader.
  { id: "am-blok", renderer: "rechthoek", parameters: { inhoud: "naam", naamGrootte: 12, uitlijning: "midden", hoekRadius: 10, randDikte: 1.5, rand: "#a5b4fc" }, minMaat: { w: 120, h: 40 } },
  { id: "am-blok-laag", renderer: "am-laag", parameters: { inhoud: "naam", naamGrootte: 11, tekstAnker: "links", lijn: "solid", hoekRadius: 8, kleurAls: "rand", rand: "#cbd5e1", vulling: "#f8fafc", vullingOpacity: 0.85, randDikte: 1.5 }, minMaat: { w: 200, h: 90 } },
  // Set "Iconen als vorm": het symbool als vorm, zonder inhoudsvak (naam als buitenlabel).
  ...VORM_SHAPE_IDS.map((id) => {
    const figuur = FIGUREN[id];
    if (!figuur) throw new Error(`archimate/vormen: geen figuur voor ${id}`);
    return { id, renderer: "figuur", parameters: { inhoud: "geen", randDikte: 1.8, figuur }, minMaat: natuurlijkeMaat(figuur.viewBox) };
  }),
];

for (const st of ARCHIMATE_SHAPETYPES) registreerShapeType(st);
