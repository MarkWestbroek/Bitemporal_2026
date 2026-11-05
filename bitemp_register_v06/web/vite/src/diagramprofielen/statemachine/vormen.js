// @ts-check
/**
 * statemachine/vormen — de state machine-vormen als ShapeType (plan 2026-11-04 Eén tekenaar,
 * stap 4): pseudotoestanden op de bibliotheek-`cirkel`/`ruit`, de historie met een eigen renderer
 * (Ⓗ / Ⓗ*), de samengestelde toestand op de bibliotheek-`kader`. Dezelfde id's als `shapes.jsx`
 * (oude React-realisatie, tweede realisatie tot de opruimstap). Pure `.js`.
 */
import { registreerShapeType, registreerRenderer, vorm } from "../../diagramcore/types/shapeType.js";
import "../../diagramcore/tekenaar/bibliotheek.js";

/** Historie: open cirkel met H (ondiep) of H* (diep, `data.diep`). */
const historie = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const r = Math.min(w, h) / 2 - 0.75;
    return vorm(
      "g",
      {},
      vorm("circle", { cx: w / 2, cy: h / 2, r, fill: ctx.thema.vulling, stroke: ctx.thema.rand, "stroke-width": 1.5 }),
      vorm("text", { x: w / 2, y: h / 2 + 4, "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: ctx.thema.rand }, ctx.element?.data?.diep ? "H*" : "H")
    );
  },
  inhoudsvak: () => null,
  rand(ctx, hoek) {
    const { w, h } = ctx.maat;
    const r = Math.min(w, h) / 2;
    return { x: w / 2 + r * Math.cos((hoek * Math.PI) / 180), y: h / 2 + r * Math.sin((hoek * Math.PI) / 180) };
  },
};
registreerRenderer("sm-historie", historie);

/** @type {import("../../diagramcore/types/schema.js").ShapeType[]} */
export const STATEMACHINE_SHAPETYPES = [
  { id: "sm-begin", renderer: "cirkel", parameters: { inhoud: "geen", dicht: true, randDikte: 1.5 }, minMaat: { w: 22, h: 22 } },
  { id: "sm-eind", renderer: "cirkel", parameters: { inhoud: "geen", kern: 6, randDikte: 1.5 }, minMaat: { w: 24, h: 24 } },
  { id: "sm-keuze", renderer: "ruit", parameters: { inhoud: "geen", randDikte: 1.5 }, minMaat: { w: 28, h: 28 } },
  { id: "sm-junction", renderer: "cirkel", parameters: { inhoud: "geen", dicht: true, randDikte: 1.5 }, minMaat: { w: 16, h: 16 } },
  { id: "sm-historie", renderer: "sm-historie", parameters: { inhoud: "geen" }, minMaat: { w: 24, h: 24 } },
  { id: "sm-entry", renderer: "cirkel", parameters: { inhoud: "geen", randDikte: 1.5 }, minMaat: { w: 16, h: 16 } },
  { id: "sm-exit", renderer: "cirkel", parameters: { inhoud: "geen", kruis: true, randDikte: 1.5 }, minMaat: { w: 16, h: 16 } },
  // Samengestelde toestand: afgerond kader met naamstrook; de regio eronder is het kindervak.
  { id: "sm-composiet", renderer: "kader", parameters: { inhoud: "naam", naamGrootte: 12, tekstAnker: "midden", lijn: "solid", hoekRadius: 14, kopHoogte: 26, kopLijn: true, kleurAls: "rand", vulling: "#fef9c3", vullingOpacity: 0.18 }, minMaat: { w: 180, h: 120 } },
];

for (const st of STATEMACHINE_SHAPETYPES) registreerShapeType(st);
