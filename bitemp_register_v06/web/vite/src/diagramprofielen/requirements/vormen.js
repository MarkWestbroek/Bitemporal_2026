// @ts-check
/**
 * requirements/vormen — de eis als ShapeType (plan 2026-11-04 Eén tekenaar, stap 4): één doos
 * (bibliotheek-`rechthoek`) voor requirement/feature/issue/change. Kop met stereotype en naam,
 * dan de id-regel, de tekst en onderaan status/prioriteit/moeilijkheid als chips — die drie
 * zijn eigen inhoud van het type (`hooks.inhoudsregels` op de abstracte `eis` in descriptor.js),
 * getekend door de motor. Dezelfde id als `shapes.jsx`. Pure `.js`.
 */
import { registreerShapeType } from "../../diagramcore/types/shapeType.js";
import "../../diagramcore/tekenaar/bibliotheek.js";

/** @type {import("../../diagramcore/types/schema.js").ShapeType[]} */
export const REQUIREMENTS_SHAPETYPES = [
  { id: "rq-eis", renderer: "rechthoek", parameters: { inhoud: "volledig", naamGrootte: 13 }, minMaat: { w: 180, h: 56 } },
];

for (const st of REQUIREMENTS_SHAPETYPES) registreerShapeType(st);

/**
 * De eigen inhoud van een eis: `id = …` (vaste breedte), de tekst (lopende tekst) en de
 * badges — alleen wat gevuld is, zoals de oude EisShape.
 * @type {(element: Object) => import("../../diagramcore/types/schema.js").InhoudsRegel[]}
 */
export function eisInhoud(element) {
  const d = element?.data || {};
  const uit = [];
  let eerste = true;
  if (d.reqId) {
    uit.push({ divider: true, delen: [{ tekst: `id = ${d.reqId}`, soort: "mono", kleur: "#4c1d95", veld: "reqId" }] });
    eerste = false;
  }
  if (d.tekst) {
    uit.push({ divider: eerste, delen: [{ tekst: String(d.tekst), soort: "tekst", kleur: "#334155", veld: "tekst" }] });
    eerste = false;
  }
  const badges = [d.status, d.prioriteit && `prio ${d.prioriteit}`, d.moeilijkheid && `moeilijkheid ${d.moeilijkheid}`].filter(Boolean);
  if (badges.length) uit.push({ delen: badges.map((tekst) => ({ tekst: String(tekst), soort: "badge" })) });
  return uit;
}
