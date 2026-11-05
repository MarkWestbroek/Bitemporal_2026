// @ts-check
/**
 * archimate/glyphs — de ArchiMate-typeiconen als **gegevens** (plan 2026-11-04 Eén tekenaar,
 * stap 4): benaderingen van de 3.2-notatie in neutrale lijnen, in een 14×14-viewBox, als
 * VormBoom-kinderen. Eén bron voor twee lezers: `iconen.jsx` maakt er React van (taakbalk,
 * inspector, de oude box-component) en de tekenaar zet ze als ornament rechtsboven in de
 * ArchiMate-box (`vormen.js`), op canvas, in documenten en op de server gelijk.
 *
 * Conventie: lijnen erven `currentColor` van de groep eromheen; `fill: "currentColor"` is een
 * gevulde kern; `fill: "$vlak"` een vlak dat open moet ogen (de uitsteeksels van een component).
 * De merk-iconenset blijft een ontwerp-sessie (plan §8.6a) — dan zijn dit puur andere gegevens.
 */
import { vorm } from "../../diagramcore/types/shapeType.js";
import { registreerGlyph } from "../../diagramcore/tekenaar/glyphs.js";

const p = (d, attrs = {}) => vorm("path", { d, ...attrs });
const c = (cx, cy, r, attrs = {}) => vorm("circle", { cx, cy, r, ...attrs });
const r = (x, y, width, height, attrs = {}) => vorm("rect", { x, y, width, height, ...attrs });
const l = (x1, y1, x2, y2) => vorm("line", { x1, y1, x2, y2 });

/** @type {Record<string, import("../../diagramcore/types/schema.js").VormBoom[]>} */
export const GLYPHS = {
  // ── business ──
  "am-actor": [c(7, 3.2, 1.7), p("M7 4.9v3.4M4.2 6.4h5.6M7 8.3l-2 3.4M7 8.3l2 3.4")],
  "am-rol": [p("M4 4.5 H10 M4 9.5 H10"), vorm("ellipse", { cx: 10, cy: 7, rx: 1.8, ry: 2.5 }), p("M4 4.5 A 1.8 2.5 0 0 0 4 9.5")],
  "am-proces": [p("M2 5.5 H8 V3.5 L12 7 L8 10.5 V8.5 H2 Z")],
  "am-functie": [p("M7 2 L11.5 6 V11.5 L7 7.8 L2.5 11.5 V6 Z")],
  "am-service": [r(2, 4.5, 10, 5, { rx: 2.5 })],
  "am-event": [p("M2.5 4 H9 L12 7 L9 10 H2.5 L5.2 7 Z")],
  "am-object": [r(2, 3, 10, 8), l(2, 5.4, 12, 5.4)],
  // ── application/technology ──
  "am-component": [r(4.5, 2, 7.5, 10), r(2, 4, 5, 2, { fill: "$vlak" }), r(2, 8, 5, 2, { fill: "$vlak" })],
  "am-node": [p("M2 4.5 L4 2.5 H12 V9.5 L10 11.5 H2 Z"), p("M2 4.5 H10 V11.5 M10 4.5 L12 2.5")],
  "am-device": [r(2.5, 3, 9, 6.5, { rx: 1.6 }), p("M4.5 11.5 L5.5 9.5 M9.5 11.5 L8.5 9.5 M3 11.5 H11")],
  "am-software": [c(8.4, 7.6, 3.9), p("M4.7 5.4 A 3.9 3.9 0 0 1 10.6 4.5")],
  "am-artifact": [p("M3 2 H9 L11.5 4.5 V12 H3 Z"), p("M9 2 V4.5 H11.5")],
  // ── motivation ──
  "am-stakeholder": [c(7, 7, 4.6), c(7, 7, 1.6), p("M7 2.4v2M7 9.6v2M2.4 7h2M9.6 7h2")],
  "am-driver": [c(7, 7, 4.6), p("M7 2.4 V11.6 M2.4 7 H11.6 M3.8 3.8 L10.2 10.2 M10.2 3.8 L3.8 10.2")],
  "am-goal": [c(7, 7, 4.8), c(7, 7, 2.2, { fill: "currentColor", stroke: "none" })],
  "am-principle": [r(3, 2.5, 8, 9, { rx: 1.2 }), p("M7 4.5 V8 M7 9.6 V9.9", { "stroke-width": 1.5 })],
  "am-requirement": [p("M4.5 3 H12 L9.5 11 H2 Z")],
  // ── gedeeld over lagen (3.2-completering, 04-09) ──
  "am-collaboratie": [c(5.2, 7, 3.4), c(8.8, 7, 3.4)],
  "am-interactie": [p("M6 3 A 4 4 0 0 0 6 11 Z"), p("M8 3 A 4 4 0 0 1 8 11 Z", { transform: "translate(0.6 0)" })],
  "am-interface": [p("M2 7 H7.2"), c(9.6, 7, 2.4)],
  // ── business-aanvulling ──
  "am-contract": [r(2, 3, 10, 8), l(2, 5.4, 12, 5.4), l(2, 8.8, 12, 8.8)],
  "am-representatie": [p("M2 2.5 H12 V9.6 C10.3 8.7 9.4 10.6 7 9.7 C4.6 8.8 3.7 10.7 2 9.8 Z"), p("M4 4.8 H10")],
  "am-product": [r(2, 3, 10, 8), p("M2 5.4 H7.5 V3")],
  // ── technology/physical-aanvulling ──
  "am-pad": [p("M4.4 4.6 L2 7 L4.4 9.4 M9.6 4.6 L12 7 L9.6 9.4 M2.6 7 H11.4", { "stroke-dasharray": "2.2 1.6" })],
  "am-netwerk": [c(3.4, 4, 1.4), c(10.6, 4, 1.4), c(3.4, 10, 1.4), c(10.6, 10, 1.4), p("M4.8 4 H9.2 M4.8 10 H9.2 M3.4 5.4 V8.6 M10.6 5.4 V8.6")],
  "am-equipment": [c(7, 7, 2), p("M7 2.6 V4 M7 10 V11.4 M2.6 7 H4 M10 7 H11.4 M3.9 3.9 L4.9 4.9 M9.1 9.1 L10.1 10.1 M10.1 3.9 L9.1 4.9 M4.9 9.1 L3.9 10.1")],
  "am-facility": [p("M2 11.5 V4 L5.2 6.4 V4 L8.4 6.4 V4 L11.6 6.4 V11.5 Z")],
  "am-distributie": [p("M4.4 4 L1.8 7 L4.4 10 M9.6 4 L12.2 7 L9.6 10 M2.4 5.8 H11.6 M2.4 8.2 H11.6")],
  "am-materiaal": [p("M7 2.4 L12 7 L7 11.6 L2 7 Z"), p("M5.2 7 H8.8")],
  // ── strategy ──
  "am-resource": [r(2, 4, 9, 6, { rx: 1 }), p("M11 5.8 H12.2 V8.2 H11 M4 5.8 V8.2 M6.2 5.8 V8.2 M8.4 5.8 V8.2")],
  "am-capability": [r(8, 2.5, 3.5, 3), r(8, 5.5, 3.5, 3), r(4.5, 5.5, 3.5, 3), r(8, 8.5, 3.5, 3), r(4.5, 8.5, 3.5, 3), r(1, 8.5, 3.5, 3)],
  "am-koers": [p("M2 11.5 C5.5 11.5 4.5 5.5 8.2 4.6"), p("M6.8 3.2 L10 4.2 L7.6 6.4"), c(11, 3.5, 1.6)],
  "am-waardestroom": [p("M2 4 H8.6 L12 7 L8.6 10 H2 L4.6 7 Z", { fill: "currentColor", "fill-opacity": 0.25 })],
  // ── motivation-aanvulling ──
  "am-assessment": [c(6, 6, 3.4), p("M8.5 8.5 L11.6 11.6")],
  "am-outcome": [c(6.4, 7.6, 4.2), c(6.4, 7.6, 1.8), p("M6.4 7.6 L11.2 2.8 M9.4 2.6 L11.4 2.6 L11.4 4.6")],
  "am-betekenis": [p("M4 10.5 C1.8 10.5 1.6 7.8 3.4 7.2 C2.8 5 5.4 3.4 7 4.8 C7.8 3 11 3.2 11.2 5.4 C13 5.8 12.8 8.6 11 9 C11.4 10.4 9.6 11.4 8.4 10.5 Z")],
  "am-waarde": [vorm("ellipse", { cx: 7, cy: 7, rx: 5, ry: 3.4 })],
  // ── implementatie & migratie ──
  "am-werkpakket": [r(2, 4.5, 10, 7, { rx: 1 }), p("M5 4.5 V3 H9 V4.5")],
  "am-deliverable": [p("M2 2.5 H12 V9.6 C10.3 8.7 9.4 10.6 7 9.7 C4.6 8.8 3.7 10.7 2 9.8 Z")],
  "am-plateau": [p("M5 3.5 H12 M3.5 7 H10.5 M2 10.5 H9", { "stroke-width": 1.8 })],
  "am-gap": [c(7, 7, 4.2), p("M3.6 5.8 H10.4 M3.6 8.2 H10.4")],
  // ── overig ──
  "am-locatie": [p("M7 12 C4.6 9.2 3.2 7.4 3.2 5.6 A 3.8 3.8 0 0 1 10.8 5.6 C10.8 7.4 9.4 9.2 7 12 Z"), c(7, 5.6, 1.4)],
  "am-groep": [p("M2 5 V3.5 H7 V5", { "stroke-dasharray": "1.8 1.4" }), r(2, 5, 10, 6.5, { "stroke-dasharray": "1.8 1.4" })],
  // ── junction ──
  "am-junction": [c(7, 7, 2.8, { fill: "currentColor", stroke: "none" })],
};

for (const [id, kinderen] of Object.entries(GLYPHS)) registreerGlyph(id, kinderen);
