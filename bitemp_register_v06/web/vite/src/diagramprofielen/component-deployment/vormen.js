// @ts-check
/**
 * component-deployment/vormen — de node (UML-kubus) als ShapeType (plan 2026-11-04 Eén
 * tekenaar, stap 4): voorvlak met de naam, boven- en zijvlak in een lichtere tint van dezelfde
 * kleur, 10px diep. Component, interface en artifact zijn de class-box; de poort is
 * `sysml-poort` (sysml/vormen.js). Pure `.js`.
 */
import { registreerShapeType, registreerRenderer, vorm } from "../../diagramcore/types/shapeType.js";
import { randRechthoek } from "../../diagramcore/tekenaar/bibliotheek.js";
import { num } from "../../diagramsvg/svg.js";
import "../sysml/vormen.js";

const DIEPTE = 10;

/** Node/device/execution environment: kubus met de naam op het voorvlak; de leden erin. */
const node = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const D = DIEPTE;
    const rand = { stroke: ctx.thema.rand, "stroke-width": 1.2, "stroke-linejoin": "round" };
    const pts = (p) => p.map(([x, y]) => `${num(x)},${num(y)}`).join(" ");
    return vorm(
      "g",
      {},
      vorm("polygon", { points: pts([[0.6, D], [w - D, D], [w - D, h - 0.6], [0.6, h - 0.6]]), fill: ctx.thema.vulling, ...rand }),
      vorm("polygon", { points: pts([[0.6, D], [D, 0.6], [w - 0.6, 0.6], [w - D, D]]), fill: ctx.thema.vulling, opacity: 0.85, ...rand }),
      vorm("polygon", { points: pts([[w - D, D], [w - 0.6, 0.6], [w - 0.6, h - D], [w - D, h - 0.6]]), fill: ctx.thema.vulling, opacity: 0.7, ...rand })
    );
  },
  inhoudsvak: (ctx) => ({ x: 0, y: DIEPTE, w: ctx.maat.w - DIEPTE, h: ctx.maat.h - DIEPTE, uitlijning: "boven" }),
  kindervak: (ctx) => ({ x: 0, y: DIEPTE, w: ctx.maat.w - DIEPTE, h: ctx.maat.h - DIEPTE }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};
registreerRenderer("cd-node", node);

/** @type {import("../../diagramcore/types/schema.js").ShapeType[]} */
export const COMPONENT_DEPLOYMENT_SHAPETYPES = [
  { id: "cd-node", renderer: "cd-node", parameters: { inhoud: "volledig", naamGrootte: 13 }, minMaat: { w: 160, h: 90 } },
];

for (const st of COMPONENT_DEPLOYMENT_SHAPETYPES) registreerShapeType(st);
