// @ts-check
/**
 * serialiseer — VormBoom → SVG-tekst (de "tekst-lezer" van het vormcontract, plan 2026-11-04
 * Eén tekenaar §3.1). De andere lezer is het canvas, dat dezelfde boom in React-elementen
 * omzet (stap 3). Deterministisch: attributen in invoegvolgorde, getallen afgerond op één
 * decimaal (diagramsvg/svg.js), tekst geëscapet.
 */
import { el, esc } from "../../diagramsvg/svg.js";

/**
 * @param {import("../types/schema.js").VormBoom|string|number} knoop
 * @returns {string}
 */
export function naarSvg(knoop) {
  if (typeof knoop === "string" || typeof knoop === "number") return esc(String(knoop));
  if (!knoop || typeof knoop !== "object") return "";
  const kinderen = (knoop.kinderen || []).map(naarSvg).join("");
  return el(knoop.tag, knoop.attrs || {}, kinderen);
}
