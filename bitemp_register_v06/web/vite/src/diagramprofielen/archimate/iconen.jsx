/**
 * ArchiMate-typeiconen — de hoek-iconen (rechtsboven in de box) én de
 * taakbalk-glyphs, op het typeIconen-koppelvlak. De geometrie staat als
 * gegevens in `glyphs.js` (één bron met de tekenaar, plan 2026-11-04 Eén
 * tekenaar stap 4); hier wordt er alleen React van gemaakt.
 */
import React from "react";
import { registreerTypeIcoon } from "../../diagramcore/shapes/typeIconen.jsx";
import { naarReact } from "../../diagramcore/tekenaar/naarReact.js";
import { vulIn } from "../../diagramcore/tekenaar/glyphs.js";
import { GLYPHS } from "./glyphs.js";

/** `$vlak` (een open vlak) is op het canvas de paneelkleur. */
const VERVANG = { $vlak: "var(--s-panel, #fff)" };

const basis = (maat, kinderen) => (
  <svg
    width={maat}
    height={maat}
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    {kinderen}
  </svg>
);

let _geregistreerd = false;
export function registreerArchimateIconen() {
  if (_geregistreerd) return;
  for (const [id, kinderen] of Object.entries(GLYPHS)) {
    registreerTypeIcoon(id, ({ maat = 14 }) => basis(maat, kinderen.map((k, i) => naarReact(vulIn(k, VERVANG), i))));
  }
  _geregistreerd = true;
}
