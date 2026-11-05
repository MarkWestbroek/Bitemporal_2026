// @ts-check
/**
 * sequence/vormen — de sequence-vormen als ShapeType (plan 2026-11-04 Eén tekenaar, stap 4):
 *
 *   - punt (occurrence): in documenten onzichtbaar (UML tekent hem niet; `opacity: 0`), op het
 *     canvas zichtbaar bij hover of selectie (diagramcore.css `.dc-seq-punt`);
 *   - activatie: smalle staande balk;
 *   - fragment: kader met de soort (alt/opt/loop/par) als chip linksboven, de naam ernaast;
 *   - levenslijn: gestippelde lijn met de naam-kop erbovenop (rechthoek, of een icoon-kop uit
 *     `KOP_ICONEN` met de naam eronder), tot onder het laagste element van het diagram — alleen
 *     voor documenten en de server. Op het canvas tekent `shapes.jsx` hem nog
 *     (SjabloonShape.UITGEZONDERD): de kop toont daar ook het type (instantieVan uit een ander
 *     profiel), de activaties zijn afgeleid uit de berichten op het canvas en de lijn groeit
 *     mee met haar laagste punt. De icoon-koppen deelt het canvas via `kopIcoon` + naarReact.
 *
 * Pure `.js`.
 */
import { registreerShapeType, registreerRenderer, vorm } from "../../diagramcore/types/shapeType.js";
import { randRechthoek } from "../../diagramcore/tekenaar/bibliotheek.js";
import { tekstBreedte } from "../../diagramsvg/tekstmaat.js";
import { n3 } from "../../diagramcore/tekenaar/glyphs.js";

const KOP_BREED = 148;
const LIJN_X = 7;

/** Punt: open ringetje, standaard onzichtbaar. */
const punt = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm("g", { opacity: 0 }, vorm("circle", { cx: w / 2, cy: h / 2, r: Math.min(w, h) / 2 - 0.8, fill: "none", stroke: ctx.thema.rand, "stroke-width": 1.6 }));
  },
  inhoudsvak: () => null,
  rand(ctx, hoek) {
    const { w, h } = ctx.maat;
    const r = Math.min(w, h) / 2;
    return { x: w / 2 + r * Math.cos((hoek * Math.PI) / 180), y: h / 2 + r * Math.sin((hoek * Math.PI) / 180) };
  },
};

/** Activatie (execution specification): smalle balk, lichte vulling. */
const activatie = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm("rect", { x: 0.75, y: 0.75, width: w - 1.5, height: h - 1.5, rx: 2, fill: ctx.parameters.vulling || "#e2e8f0", stroke: ctx.thema.rand, "stroke-width": 1.5 });
  },
  inhoudsvak: () => null,
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

const CHIP_H = 18;
const chipBreedte = (soort) => Math.ceil(tekstBreedte(soort, 11, { vet: true })) + 22;

/** Fragment: kader met de soort-chip (het afgeknipte vijfhoekje) linksboven; de naam ernaast. */
const fragment = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const soort = String(ctx.element?.data?.soort || "alt");
    const cw = chipBreedte(soort);
    return vorm(
      "g",
      {},
      vorm("rect", { x: 0.8, y: 0.8, width: w - 1.6, height: h - 1.6, rx: 3, fill: ctx.thema.rand, "fill-opacity": 0.06, stroke: ctx.thema.rand, "stroke-width": 1.6 }),
      vorm("polygon", { points: `0.8,0.8 ${n3(cw)},0.8 ${n3(cw)},${n3(CHIP_H * 0.55)} ${n3(cw - 6)},${CHIP_H} 0.8,${CHIP_H}`, fill: ctx.thema.surface, stroke: ctx.thema.rand, "stroke-width": 1.6, "stroke-linejoin": "round" }),
      vorm("text", { x: 8, y: 13.5, "font-size": 11, "font-weight": 700, fill: ctx.thema.inkt }, soort)
    );
  },
  inhoudsvak(ctx) {
    const cw = chipBreedte(String(ctx.element?.data?.soort || "alt"));
    return { x: cw - 2, y: -3, w: ctx.maat.w - cw, h: 24, uitlijning: "boven" };
  },
  kindervak: (ctx) => ({ x: 0, y: CHIP_H, w: ctx.maat.w, h: ctx.maat.h - CHIP_H }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

/**
 * Icoon-koppen van de levenslijn (`data.kop`): actor (poppetje) en de robustness-stereotypes
 * van Jacobson — boundary (cirkel met staander links), control (cirkel met pijlpunt bovenop) en
 * entity (cirkel op een streep); de business-varianten dragen een schuine streep. Viewbox 48×40,
 * als gegevens: de tekenaar zet ze in de omtrek, het canvas (shapes.jsx) via naarReact.
 */
const ICOON_W = 48;
const ICOON_H = 40;
const KOP_ICONEN = {
  actor: (s, f) =>
    vorm(
      "g",
      { stroke: s, "stroke-width": 1.6, fill: "none", "stroke-linecap": "round" },
      vorm("circle", { cx: 24, cy: 7, r: 5.5, fill: f }),
      vorm("line", { x1: 24, y1: 12.5, x2: 24, y2: 26 }),
      vorm("line", { x1: 14, y1: 17, x2: 34, y2: 17 }),
      vorm("line", { x1: 24, y1: 26, x2: 16, y2: 38 }),
      vorm("line", { x1: 24, y1: 26, x2: 32, y2: 38 })
    ),
  boundary: (s, f) => vorm("g", { stroke: s, "stroke-width": 1.6 }, vorm("line", { x1: 7, y1: 8, x2: 7, y2: 32 }), vorm("line", { x1: 7, y1: 20, x2: 15, y2: 20 }), vorm("circle", { cx: 28, cy: 20, r: 13, fill: f })),
  control: (s, f) => vorm("g", { stroke: s, "stroke-width": 1.6 }, vorm("circle", { cx: 24, cy: 22, r: 13, fill: f }), vorm("polyline", { points: "28,4 23,9 28,14", fill: "none", "stroke-linejoin": "round" })),
  entity: (s, f) => vorm("g", { stroke: s, "stroke-width": 1.6 }, vorm("circle", { cx: 24, cy: 18, r: 13, fill: f }), vorm("line", { x1: 11, y1: 35, x2: 37, y2: 35 })),
};
// Business-varianten: hetzelfde icoon met een schuine streep door de cirkel.
const STREEP = { "business-boundary": [20, 31, 36, 9], "business-control": [16, 33, 32, 11], "business-entity": [16, 29, 32, 7] };
for (const [soort, [x1, y1, x2, y2]] of Object.entries(STREEP)) {
  const basis = KOP_ICONEN[soort.replace("business-", "")];
  KOP_ICONEN[soort] = (s, f) => vorm("g", {}, basis(s, f), vorm("line", { x1, y1, x2, y2, stroke: s, "stroke-width": 1.6 }));
}

/** Het icoon van een kop als VormBoom (48×40), of null als de kop de rechthoek is. */
export function kopIcoon(soort, { rand, vulling }) {
  const maak = KOP_ICONEN[soort];
  return maak ? maak(rand, vulling || "#e0f2fe") : null;
}

/** Hoe ver het diagram onder de bovenkant van deze levenslijn reikt (laagste element + marge). */
function diagramDiepte(diagram, node, eigenId) {
  const y0 = node?.position?.y ?? 0;
  const nodes = diagram?.nodes || [];
  let onder = 0;
  for (const n of nodes) {
    if (!n || n.elementId === eigenId) continue;
    // Een kind (punt op een levenslijn) staat relatief ten opzichte van zijn ouder.
    const ouder = n.parentId ? nodes.find((o) => o?.elementId === n.parentId) : null;
    const y = (ouder?.position?.y ?? 0) + (n.position?.y ?? 0) + (n.size?.height ?? 60);
    if (y > onder) onder = y;
  }
  return onder - y0;
}

/** Hoogte van de kop: de rechthoek om de naam, of het icoon met de naam eronder. */
function kopHoogte(ctx, icoon) {
  const naamH = ctx.inhoud?.h ?? 26;
  return icoon ? ICOON_H + 2 + naamH + 2 : Math.max(30, naamH + 4);
}

/**
 * Levenslijn (documenten/server): gestippelde lijn met de naam-kop (148 breed) erbovenop; met
 * `data.kop` een icoon-kop (actor, boundary, …) met de naam eronder. De node blijft 14 breed,
 * hoe lang de naam ook is (de kop steekt uit); daarom bepaalt `maat` de doos en meet de motor
 * de naam op de kopbreedte (`factorW` = 148/14). De lijn loopt tot onder het laagste element van
 * het diagram (zoals de canvas-lijn meegroeit met haar laagste punt), minstens `minHoogte`.
 */
const levenslijn = {
  maat: ({ element, elementType, diagram, node }) => ({ w: 14, h: Math.max(elementType?.minHoogte ?? 200, diagramDiepte(diagram, node, element?.id) + 40) }),
  omtrek(ctx) {
    const { h } = ctx.maat;
    const icoon = kopIcoon(ctx.element?.data?.kop, { rand: ctx.thema.rand });
    const kopH = kopHoogte(ctx, icoon);
    const lijn = vorm("line", { x1: LIJN_X, y1: kopH, x2: LIJN_X, y2: h, stroke: ctx.thema.rand, "stroke-width": 1.4, "stroke-dasharray": "6 4" });
    if (icoon) return vorm("g", {}, lijn, vorm("g", { transform: `translate(${LIJN_X - ICOON_W / 2} 0)` }, icoon));
    return vorm("g", {}, lijn, vorm("rect", { x: LIJN_X - KOP_BREED / 2, y: 0.8, width: KOP_BREED, height: kopH - 1.6, rx: 4, fill: ctx.thema.vulling, stroke: ctx.thema.rand, "stroke-width": 1.6 }));
  },
  inhoudsvak(ctx) {
    const icoon = kopIcoon(ctx.element?.data?.kop, { rand: ctx.thema.rand });
    const kopH = kopHoogte(ctx, icoon);
    if (icoon) return { x: LIJN_X - KOP_BREED / 2, y: ICOON_H + 2, w: KOP_BREED, h: kopH - ICOON_H - 2, uitlijning: "boven" };
    return { x: LIJN_X - KOP_BREED / 2, y: 0, w: KOP_BREED, h: kopH, uitlijning: "midden" };
  },
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

registreerRenderer("seq-punt", punt);
registreerRenderer("seq-activatie", activatie);
registreerRenderer("seq-fragment", fragment);
registreerRenderer("seq-levenslijn", levenslijn);

/** @type {import("../../diagramcore/types/schema.js").ShapeType[]} */
export const SEQUENCE_SHAPETYPES = [
  { id: "seq-punt", renderer: "seq-punt", parameters: { inhoud: "geen", klasse: "dc-seq-punt" }, minMaat: { w: 12, h: 12 } },
  { id: "seq-activatie", renderer: "seq-activatie", parameters: { inhoud: "geen", klasse: "dc-punt-node" }, minMaat: { w: 14, h: 44 } },
  { id: "seq-fragment", renderer: "seq-fragment", parameters: { inhoud: "naam", naamGrootte: 11, tekstAnker: "links", kleurAls: "rand" }, minMaat: { w: 260, h: 160 } },
  { id: "seq-levenslijn", renderer: "seq-levenslijn", parameters: { inhoud: "naam", naamGrootte: 12, factorW: KOP_BREED / 14, vulling: "#f8fafc" }, minMaat: { w: 14, h: 200 } },
];

for (const st of SEQUENCE_SHAPETYPES) registreerShapeType(st);
