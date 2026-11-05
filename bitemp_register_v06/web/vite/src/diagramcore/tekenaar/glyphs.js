// @ts-check
/**
 * glyphs — kleine type-iconen als gegevens, voor de tekenaar (plan 2026-11-04 Eén tekenaar,
 * stap 4). Een glyph is een lijst VormBoom-kinderen in een 14×14-viewBox, getekend in
 * `currentColor`-stijl: lijnen in de icoonkleur, `fill: "$vlak"` voor een vlak dat open moet
 * ogen (de uitsteeksels van een component). Dezelfde gegevens tekent het canvas als React
 * (`naarReact`) in taakbalken en inspector, en de tekenaar als ornament rechtsboven in een
 * ArchiMate-box — één bron voor het icoon. Puur.
 */
import { vorm } from "../types/shapeType.js";

/** Drie decimalen: een schaalfactor op één decimaal (svg.js `num`) laat een figuur 5% krimpen. */
export const n3 = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
};

const _glyphs = new Map();

/**
 * @param {string} id
 * @param {Array<import("../types/schema.js").VormBoom>} kinderen - in een 14×14-viewBox
 */
export function registreerGlyph(id, kinderen) {
  _glyphs.set(id, kinderen);
}

export const getGlyph = (id) => _glyphs.get(id);

/** Vervang de plaatshouders in de attributen van een glyph of figuur. */
export function vulIn(knoop, vervang) {
  if (!knoop || typeof knoop !== "object") return knoop;
  const attrs = {};
  for (const [k, v] of Object.entries(knoop.attrs || {})) {
    attrs[k] = typeof v === "string" && v in vervang ? vervang[v] : v;
  }
  return { tag: knoop.tag, attrs, kinderen: (knoop.kinderen || []).map((kind) => vulIn(kind, vervang)) };
}

/**
 * Een glyph als VormBoom op een plek en maat.
 * @param {string} id
 * @param {{x: number, y: number, maat?: number, kleur: string, vlak: string}} p - vlak: kleur van een open vlak
 * @returns {import("../types/schema.js").VormBoom|null}
 */
export function glyphVorm(id, { x, y, maat = 14, kleur, vlak }) {
  const kinderen = _glyphs.get(id);
  if (!kinderen) return null;
  const vervang = { currentColor: kleur, $vlak: vlak };
  return vorm(
    "g",
    { class: "dc-glyph", transform: `translate(${n3(x)} ${n3(y)}) scale(${n3(maat / 14)})`, fill: "none", stroke: kleur, "stroke-width": 1.2, "stroke-linecap": "round", "stroke-linejoin": "round" },
    ...kinderen.map((k) => vulIn(k, vervang))
  );
}
