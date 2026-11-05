// @ts-check
/**
 * sysml/vormen — de SysML-vormen als ShapeType (plan 2026-11-04 Eén tekenaar, stap 4):
 *
 *   - requirement: de «requirement»-doos op de bibliotheek-`rechthoek`; `id = …` en `text = …`
 *     zijn eigen inhoud van het type (`hooks.inhoudsregels` in index.js), door de motor getekend;
 *   - poort: het vierkantje óp de rand van een blok of part, met een pijltje bij een flow port
 *     (`data.richting` in/uit); de naam hangt eronder als buitenlabel. Ook gebruikt door het
 *     component & deployment-profiel.
 *
 * Pure `.js`.
 */
import { registreerShapeType, registreerRenderer, vorm } from "../../diagramcore/types/shapeType.js";
import { randRechthoek, geschaald } from "../../diagramcore/tekenaar/bibliotheek.js";

/** Poort (ibd): vierkantje (viewBox 16) met een pijl naar binnen (in) of naar buiten (uit). */
const poort = {
  omtrek(ctx) {
    const k = ctx.thema.rand;
    const pijl = { fill: "none", stroke: k, "stroke-width": 1.2, "stroke-linecap": "round", "stroke-linejoin": "round" };
    const kinderen = [vorm("rect", { x: 1.5, y: 1.5, width: 13, height: 13, fill: ctx.thema.surface, stroke: k, "stroke-width": 1.4 })];
    const richting = ctx.element?.data?.richting;
    if (richting === "in") kinderen.push(vorm("path", { d: "M4 8 H11 M8.5 5 L11.5 8 L8.5 11", ...pijl }));
    if (richting === "uit") kinderen.push(vorm("path", { d: "M12 8 H5 M7.5 5 L4.5 8 L7.5 11", ...pijl }));
    return geschaald(ctx, 16, kinderen);
  },
  inhoudsvak: () => null,
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};
registreerRenderer("sysml-poort", poort);

/** @type {import("../../diagramcore/types/schema.js").ShapeType[]} */
export const SYSML_SHAPETYPES = [
  { id: "sysml-requirement", renderer: "rechthoek", parameters: { inhoud: "volledig", naamGrootte: 13 }, minMaat: { w: 180, h: 56 } },
  { id: "sysml-poort", renderer: "sysml-poort", parameters: { inhoud: "geen" }, minMaat: { w: 16, h: 16 } },
];

for (const st of SYSML_SHAPETYPES) registreerShapeType(st);

/**
 * De eigen inhoud van een requirement: `id = …` (vaste breedte) en `text = …` (lopende tekst,
 * cursief-grijs als die nog ontbreekt) onder een scheidslijn — zoals de oude RequirementShape.
 * @type {(element: Object) => import("../../diagramcore/types/schema.js").InhoudsRegel[]}
 */
export function requirementInhoud(element) {
  const d = element?.data || {};
  return [
    { divider: true, delen: [{ tekst: `id = ${d.reqId || "…"}`, soort: "mono", kleur: "#4c1d95", veld: "reqId" }] },
    { delen: [{ tekst: `text = ${d.tekst || "(nog geen tekst)"}`, soort: "tekst", kleur: d.tekst ? undefined : "#a8a29e", veld: "tekst" }] },
  ];
}
