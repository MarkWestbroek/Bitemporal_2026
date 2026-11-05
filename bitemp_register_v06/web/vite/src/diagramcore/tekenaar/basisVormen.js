// @ts-check
/**
 * basisVormen — de standaard-ShapeTypes van de motor als gegevens (Stijl-domein), op de
 * bibliotheek-renderers. De id's zijn die van de vroegere React-vormen
 * (`shapes/basisShapes.jsx`, weg sinds de opruimstap); canvas, documenten en server tekenen ze
 * via `tekenbareVorm(id)` (plan 2026-11-04 Eén tekenaar). Minimummaten volgen de canvas-CSS (class-box 180×56).
 */
import { registreerShapeType } from "../types/shapeType.js";
import "./bibliotheek.js";

/** @type {import("../types/schema.js").ShapeType[]} */
export const BASIS_SHAPETYPES = [
  { id: "class-box", renderer: "rechthoek", minMaat: { w: 180, h: 56 } },
  { id: "chip", renderer: "rechthoek", parameters: { hoekRadius: 22, randDikte: 1.5 }, minMaat: { w: 150, h: 52 } },
  { id: "knip-box", renderer: "knip", minMaat: { w: 160, h: 52 } },
  { id: "note", renderer: "notitie", parameters: { inhoud: "tekst", vulling: "#fffde7", rand: "#fbbf24", tekstAnker: "links" }, minMaat: { w: 100, h: 44 } },
  { id: "constraint", renderer: "notitie", parameters: { inhoud: "specificatie", leegToon: true, vulling: "#e0f2fe", rand: "#7dd3fc", oor: 12, tekstAnker: "links", stereotype: false }, minMaat: { w: 100, h: 44 } },
  { id: "diagramverwijzing", renderer: "verwijzing", parameters: { inhoud: "naam", naamGrootte: 12, naamGewicht: 600, tekstAnker: "links", factorW: 0.86, vulling: "#f8fafc", rand: "#94a3b8", naamKlasse: "dc-diagramverwijzing-naam", naamBewerkbaar: false, testId: "diagramverwijzing" }, minMaat: { w: 120, h: 44 } },
  { id: "rounded", renderer: "rechthoek", parameters: { hoekRadius: 16, inhoud: "specificatie", naamGrootte: 12, vulling: "#e0f2fe", rand: "#7dd3fc" }, minMaat: { w: 150, h: 48 } },
  { id: "anker", renderer: "anker", parameters: { inhoud: "geen" }, minMaat: { w: 14, h: 14 } },
  { id: "boundary", renderer: "kader", parameters: { inhoud: "naam", naamGrootte: 11, tekstAnker: "links", kleurAls: "rand" }, minMaat: { w: 240, h: 160 } },
  { id: "bol", renderer: "bol", parameters: { inhoud: "naam", naamGrootte: 12, maxBreedte: 92 }, minMaat: { w: 92, h: 92 } },
  { id: "package", renderer: "package", parameters: { inhoud: "naam", naamGrootte: 12, tekstAnker: "links" }, minMaat: { w: 200, h: 110 } },
  { id: "dmn-input-data", renderer: "stadium", parameters: { inhoud: "volledig", naamGrootte: 13 }, minMaat: { w: 150, h: 56 } },
  { id: "dmn-bkm", renderer: "bkm", parameters: { inhoud: "volledig", naamGrootte: 13 }, minMaat: { w: 160, h: 64 } },
  { id: "dmn-knowledge-source", renderer: "golf", parameters: { inhoud: "volledig", naamGrootte: 13, factorH: 0.78 }, minMaat: { w: 160, h: 80 } },
];

for (const st of BASIS_SHAPETYPES) registreerShapeType(st);
