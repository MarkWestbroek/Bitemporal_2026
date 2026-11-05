// @ts-check
/**
 * naarReact — VormBoom → React-elementen (de "canvas-lezer" van het vormcontract, plan 2026-11-04
 * Eén tekenaar §3.1; de andere lezer is serialiseer.js → SVG-tekst). Attribuutnamen gaan naar de
 * React-spelling (`class` → `className`, `stroke-width` → `strokeWidth`); `data-*`/`aria-*`
 * blijven zoals ze zijn. Geen JSX, zodat dit ook in `node --test` draait.
 */
import { createElement } from "react";

const VAST = { class: "className", for: "htmlFor" };

function propNaam(k) {
  if (k in VAST) return VAST[k];
  if (k.startsWith("data-") || k.startsWith("aria-")) return k;
  return k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * @param {import("../types/schema.js").VormBoom|string|number|null} knoop
 * @param {string|number} [key]
 * @returns {any} React-element, tekst of null
 */
export function naarReact(knoop, key = undefined) {
  if (typeof knoop === "string" || typeof knoop === "number") return String(knoop);
  if (!knoop || typeof knoop !== "object") return null;
  const props = key === undefined ? {} : { key };
  for (const [k, v] of Object.entries(knoop.attrs || {})) {
    if (v === undefined || v === null) continue;
    props[propNaam(k)] = v;
  }
  const kinderen = (knoop.kinderen || []).map((kind, i) => naarReact(kind, i)).filter((k) => k !== null);
  return createElement(knoop.tag, props, ...kinderen);
}
