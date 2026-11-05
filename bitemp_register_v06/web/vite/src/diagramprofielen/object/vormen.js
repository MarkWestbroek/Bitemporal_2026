// @ts-check
/**
 * object/vormen — het UML-object als ShapeType (plan 2026-11-04 Eén tekenaar, stap 4): de
 * instantiedoos met "naam : Klasse" onderstreept en de slots als "attribuut = waarde". De kop
 * is de weergavenaam van het type (`hooks.naamWeergave` in descriptor.js: `objectKop`), de
 * onderstreping en het "= " zijn parameters van het ShapeType; het multi-object (randDikte 3)
 * krijgt een binnenlijn. Ook gebruikt door het communication-profiel. Pure `.js`.
 */
import { registreerShapeType, registreerRenderer, vorm } from "../../diagramcore/types/shapeType.js";
import { randRechthoek } from "../../diagramcore/tekenaar/bibliotheek.js";

/**
 * "jan : Persoon [actief]" — de klasse uit de cross-profiel verwijzing (`data.instantieVan`,
 * via de host) of, zonder verwijzing of host, uit `data.klassifierLabel` (zo zet de EA-lezer hem
 * neer). Naam leeg = anoniem object (": Persoon").
 * @param {Object} element
 * @param {{verwijzingLabel?: ((ref: any) => string|null)|null}} [context]
 */
export function objectKop(element, context = {}) {
  const d = element?.data || {};
  const viaHost = d.instantieVan && typeof context.verwijzingLabel === "function" ? context.verwijzingLabel(d.instantieVan) : null;
  const klasse = viaHost || d.klassifierLabel || "";
  const naam = element?.naam || "";
  const kop = klasse ? `${naam} : ${klasse}` : naam || "(object)";
  return d.toestand ? `${kop} ${d.toestand}` : kop;
}

/** Instantiedoos: rechthoek; een dubbele rand (multi-object) als binnenlijn. */
const object = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const rect = vorm("rect", { x: 1, y: 1, width: w - 2, height: h - 2, rx: 8, fill: ctx.thema.vulling, stroke: ctx.thema.rand, "stroke-width": 2 });
    if ((ctx.stijl.randDikte ?? 2) < 3) return rect;
    return vorm("g", {}, rect, vorm("rect", { x: 4, y: 4, width: w - 8, height: h - 8, rx: 6, fill: "none", stroke: ctx.thema.rand, "stroke-width": 1 }));
  },
  inhoudsvak: (ctx) => ({ x: 0, y: 0, w: ctx.maat.w, h: ctx.maat.h, uitlijning: "boven" }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};
registreerRenderer("ob-object", object);

/** @type {import("../../diagramcore/types/schema.js").ShapeType[]} */
export const OBJECT_SHAPETYPES = [
  { id: "ob-object", renderer: "ob-object", parameters: { inhoud: "volledig", naamOnderstreept: true, typePrefix: "= " }, minMaat: { w: 180, h: 56 } },
];

for (const st of OBJECT_SHAPETYPES) registreerShapeType(st);
