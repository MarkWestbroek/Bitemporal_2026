// @ts-check
/**
 * usecase/vormen — de use case-vormen als ShapeType (plan 2026-11-04 Eén tekenaar, stap 4):
 * gegevens op de bibliotheek-renderers, geen code. Het canvas, documenten en render-svc tekenen
 * via dit ShapeType. Pure `.js`: ook in de render-bundel (die .jsx leeg laat) en in `node --test`.
 */
import { registreerShapeType } from "../../diagramcore/types/shapeType.js";
import "../../diagramcore/tekenaar/bibliotheek.js";

/** @type {import("../../diagramcore/types/schema.js").ShapeType[]} */
export const USECASE_SHAPETYPES = [
  // Strekfiguur, de naam eronder binnen de doos (figuur 48 hoog = extraHoogte); de naam mag breder
  // zijn dan de figuur, tot 120, zoals de oude ActorShape.
  { id: "uc-actor", renderer: "actor", parameters: { inhoud: "naam", naamGrootte: 12, maxBreedte: 120, extraHoogte: 48 }, minMaat: { w: 64, h: 70 } },
  // Ellips met de naam gecentreerd; min 150×60, max 280 breed (zoals .dc-node); collaboratie
  // gestippeld via elementType.randStijl.
  { id: "uc-ellips", renderer: "ellips", parameters: { inhoud: "naam", naamGrootte: 12, maxBreedte: 280, factorW: 0.76, factorH: 0.72 }, minMaat: { w: 150, h: 60 } },
  // Systeemkader: doorgetrokken rand, naamstrook met lijn, lichte tint; de eigen kleur kleurt de rand.
  { id: "uc-systeem", renderer: "kader", parameters: { inhoud: "naam", naamGrootte: 12, tekstAnker: "midden", lijn: "solid", hoekRadius: 6, kopHoogte: 26, kopLijn: true, tint: true, kleurAls: "rand" }, minMaat: { w: 220, h: 160 } },
];

for (const st of USECASE_SHAPETYPES) registreerShapeType(st);
