// @ts-check
/**
 * maat — de buitenmaat van een voorkomen. Een opgeslagen maat (`node.size`) wint altijd; zonder
 * maat meet de motor de inhoud met de tekstmaat-tabel, zoals het canvas shrink-to-fit meet
 * (diagramcore.css: min-width 180, max-width 280), met de ondergrens uit het ShapeType en het
 * ElementType (`minMaatVan`). Vormen waarvan het inhoudsvak kleiner is dan de buitenmaat
 * (ellips, ruit) geven dat op met `parameters.factorW`/`factorH`.
 */
import { minMaatVan } from "../types/shapeType.js";

const MAX_BREEDTE = 280;

/**
 * @param {Object} p
 * @param {Object|null} p.ref                 - het DiagramNode-voorkomen (size, position)
 * @param {Object} p.elementType
 * @param {import("../types/schema.js").ShapeType} p.shapeType
 * @param {(breedte: number) => {h: number, minW: number}} p.planVoor - inhoud meten voor een vakbreedte
 * @returns {{w: number, h: number, plan: any}}
 */
export function meetVoorkomen({ ref, elementType, shapeType, planVoor }) {
  const p = shapeType.parameters || {};
  const min = minMaatVan(shapeType, elementType) || { w: 0, h: 0 };
  const fw = p.factorW ?? 1;
  const fh = p.factorH ?? 1;
  if (ref?.size?.width && ref?.size?.height) {
    const w = Math.round(ref.size.width);
    const h = Math.round(ref.size.height);
    return { w, h, plan: p.inhoud === "geen" ? null : planVoor(w * fw) };
  }
  if (p.inhoud === "geen") return { w: min.w || 32, h: min.h || 32, plan: null };
  const natuurlijk = planVoor(Infinity);
  const maxW = Math.max(p.maxBreedte ?? MAX_BREEDTE, min.w);
  const w = Math.ceil(Math.min(maxW, Math.max(min.w, natuurlijk.minW / fw)));
  const plan = planVoor(w * fw);
  const h = Math.ceil(Math.max(min.h, plan.h / fh));
  return { w, h, plan };
}
