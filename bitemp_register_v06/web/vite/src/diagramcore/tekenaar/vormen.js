// @ts-check
/**
 * vormen — welke ShapeType + ShapeRenderer een shape-id krijgt. Eerst het echte vormcontract
 * (`tekenbareVorm`: ShapeType én renderer geregistreerd); anders een **terugval** op de
 * vormfamilie van de schets (ellips, actor, kader, notitie, punt, afgerond, vak), zodat elk
 * profiel al tekent terwijl zijn vormen stap voor stap echte ShapeTypes worden (plan 2026-11-04
 * Eén tekenaar, stap 4). De terugval is herkenbaar aan `terugval: true`.
 */
import { tekenbareVorm, getRenderer } from "../types/shapeType.js";
import { vormFamilie } from "../../transformatie/sjabloon/schets.js";
import "./basisVormen.js";

/** Terugval per familie: bibliotheek-renderer, parameters en de standaardmaat van de schets. */
const TERUGVAL = {
  ellips: { renderer: "ellips", parameters: { inhoud: "naam", naamGrootte: 12, maxBreedte: 280 }, minMaat: { w: 150, h: 60 } },
  actor: { renderer: "actor", parameters: { inhoud: "naam", naamGrootte: 11, maxBreedte: 64 }, minMaat: { w: 64, h: 70 } },
  kader: { renderer: "kader", parameters: { inhoud: "naam", naamGrootte: 11, tekstAnker: "links", kleurAls: "rand" }, minMaat: { w: 240, h: 160 } },
  notitie: { renderer: "notitie", parameters: { inhoud: "tekst", vulling: "#fffde7", rand: "#fbbf24", tekstAnker: "links" }, minMaat: { w: 160, h: 80 } },
  punt: { renderer: "cirkel", parameters: { inhoud: "geen" }, minMaat: { w: 32, h: 32 } },
  afgerond: { renderer: "rechthoek", parameters: { hoekRadius: 14 }, minMaat: { w: 160, h: 56 } },
  vak: { renderer: "rechthoek", parameters: {}, minMaat: { w: 180, h: 56 } },
};

/**
 * @param {string} shapeId
 * @param {Object} [elementType]
 * @returns {{shapeType: import("../types/schema.js").ShapeType, renderer: import("../types/schema.js").ShapeRenderer, terugval: boolean}}
 */
export function vormVoor(shapeId, elementType = null) {
  const echt = tekenbareVorm(shapeId);
  if (echt) return { ...echt, terugval: false };
  const fam = elementType?.achtergrond ? "kader" : vormFamilie(shapeId || "");
  const t = TERUGVAL[fam] || TERUGVAL.vak;
  const parameters = { ...t.parameters };
  if (fam === "kader" && !/boundary/.test(shapeId || "")) parameters.lijn = "solid";
  if (fam === "kader" && /laag/.test(shapeId || "")) parameters.vulling = "#f8fafc";
  if (fam === "punt" && /eind|end/.test(shapeId || "")) parameters.dicht = true;
  // Een keuzepunt (beslissing, gateway, keuze) is een ruit, geen cirkel.
  const renderer = fam === "punt" && /beslissing|keuze|gateway/.test(shapeId || "") ? "ruit" : t.renderer;
  const minMaat = renderer === "ruit" ? { w: 40, h: 40 } : t.minMaat;
  return {
    shapeType: { id: shapeId || "class-box", renderer, parameters, minMaat },
    renderer: /** @type {any} */ (getRenderer(renderer)),
    terugval: true,
  };
}
