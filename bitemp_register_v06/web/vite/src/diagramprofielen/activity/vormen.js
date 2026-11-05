// @ts-check
/**
 * activity/vormen — de activity-vormen als ShapeType (plan 2026-11-04 Eén tekenaar, stap 4).
 * Bibliotheek-renderers met parameters; alleen de fork/join-balk heeft een eigen renderer, omdat
 * zijn maat van het element afhangt (`data.verticaal`). Dezelfde id's als `shapes.jsx` (oude
 * React-realisatie, tweede realisatie tot de opruimstap). Pure `.js`.
 */
import { registreerShapeType, registreerRenderer, vorm } from "../../diagramcore/types/shapeType.js";
import "../../diagramcore/tekenaar/bibliotheek.js";

const BALK_LANG = 140;
const BALK_DIK = 10;

/** Fork/join: dikke balk in de lijnkleur; staand als `data.verticaal`. */
const balk = {
  maat: ({ element }) => (element?.data?.verticaal ? { w: BALK_DIK, h: BALK_LANG } : { w: BALK_LANG, h: BALK_DIK }),
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm("rect", { x: 0.75, y: 0.75, width: w - 1.5, height: h - 1.5, rx: 3, fill: ctx.thema.rand, stroke: ctx.thema.rand, "stroke-width": 1.5 });
  },
  inhoudsvak: () => null,
  rand(ctx, hoek) {
    const { w, h } = ctx.maat;
    const dx = Math.cos((hoek * Math.PI) / 180);
    const dy = Math.sin((hoek * Math.PI) / 180);
    const s = Math.min(dx ? w / 2 / Math.abs(dx) : Infinity, dy ? h / 2 / Math.abs(dy) : Infinity);
    return { x: w / 2 + dx * s, y: h / 2 + dy * s };
  },
};
registreerRenderer("act-balk", balk);

/** @type {import("../../diagramcore/types/schema.js").ShapeType[]} */
export const ACTIVITY_SHAPETYPES = [
  { id: "act-begin", renderer: "cirkel", parameters: { inhoud: "geen", dicht: true, randDikte: 1.5 }, minMaat: { w: 22, h: 22 } },
  { id: "act-eind", renderer: "cirkel", parameters: { inhoud: "geen", kern: 6, randDikte: 1.5 }, minMaat: { w: 24, h: 24 } },
  { id: "act-flow-eind", renderer: "cirkel", parameters: { inhoud: "geen", kruis: true, randDikte: 1.5 }, minMaat: { w: 20, h: 20 } },
  { id: "act-beslissing", renderer: "ruit", parameters: { inhoud: "geen", randDikte: 1.5 }, minMaat: { w: 28, h: 28 } },
  { id: "act-fork", renderer: "act-balk", parameters: { inhoud: "geen" }, minMaat: { w: BALK_DIK, h: BALK_DIK } },
  // Object node: strakke rechthoek, naam gecentreerd.
  { id: "act-object", renderer: "rechthoek", parameters: { inhoud: "naam", naamGrootte: 12, hoekRadius: 0, uitlijning: "midden" }, minMaat: { w: 120, h: 44 } },
  // Pin: klein vierkantje op de rand van een actie.
  { id: "act-pin", renderer: "rechthoek", parameters: { inhoud: "geen", hoekRadius: 2, randDikte: 1.5 }, minMaat: { w: 12, h: 12 } },
  // Partitie (swimlane): kader met naamstrook en lijn; de eigen kleur kleurt de rand.
  { id: "act-partitie", renderer: "kader", parameters: { inhoud: "naam", naamGrootte: 12, tekstAnker: "midden", lijn: "solid", hoekRadius: 4, kopHoogte: 26, kopLijn: true, tint: true, kleurAls: "rand" }, minMaat: { w: 200, h: 280 } },
];

for (const st of ACTIVITY_SHAPETYPES) registreerShapeType(st);
