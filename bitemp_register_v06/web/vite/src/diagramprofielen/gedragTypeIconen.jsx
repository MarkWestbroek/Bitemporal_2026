/**
 * gedragTypeIconen — taakbalk-/browser-glyphs voor de gedragsprofielen
 * (state machine, activity, use case). Neutrale 14px-vormen in currentColor
 * op het typeIconen-koppelvlak; de échte merk-iconenset blijft een
 * ontwerp-sessie (plan §8.6a) — dan zijn dit puur her-registraties.
 *
 * Gedeeld tussen de profielen zodat "begin" overal hetzelfde glyph draagt.
 */
import React from "react";
import { registreerTypeIcoon } from "../diagramcore/shapes/typeIconen.jsx";

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

/** id → tekenfunctie; registratie onderaan. */
const GLYPHS = {
  // ── punt-pseudostates ──
  "gedrag-begin": (m) => basis(m, <circle cx="7" cy="7" r="3.6" fill="currentColor" stroke="none" />),
  "gedrag-eind": (m) =>
    basis(m, (
      <>
        <circle cx="7" cy="7" r="5" />
        <circle cx="7" cy="7" r="2.2" fill="currentColor" stroke="none" />
      </>
    )),
  "gedrag-flow-eind": (m) =>
    basis(m, (
      <>
        <circle cx="7" cy="7" r="5" />
        <path d="M4.5 4.5 L9.5 9.5 M9.5 4.5 L4.5 9.5" />
      </>
    )),
  "gedrag-ruit": (m) => basis(m, <path d="M7 1.5 L12.5 7 L7 12.5 L1.5 7 Z" />),
  "gedrag-junction": (m) => basis(m, <circle cx="7" cy="7" r="2.6" fill="currentColor" stroke="none" />),
  "gedrag-historie": (m) =>
    basis(m, (
      <>
        <circle cx="7" cy="7" r="5.2" />
        <path d="M5.2 4.5v5M8.8 4.5v5M5.2 7h3.6" />
      </>
    )),
  "gedrag-entry": (m) => basis(m, <circle cx="7" cy="7" r="3.4" />),
  "gedrag-exit": (m) =>
    basis(m, (
      <>
        <circle cx="7" cy="7" r="3.6" />
        <path d="M4.8 4.8 L9.2 9.2 M9.2 4.8 L4.8 9.2" />
      </>
    )),
  "gedrag-fork": (m) => basis(m, <rect x="1.5" y="5.6" width="11" height="2.8" rx="1" fill="currentColor" stroke="none" />),
  "gedrag-pin": (m) =>
    basis(m, (
      <>
        <rect x="2" y="4" width="7.5" height="6" rx="1.4" />
        <rect x="9.5" y="5.8" width="2.8" height="2.8" fill="currentColor" stroke="none" />
      </>
    )),
  // ── toestanden/acties ──
  "gedrag-toestand": (m) => basis(m, <rect x="1.5" y="3" width="11" height="8" rx="3.4" />),
  "gedrag-composiet": (m) =>
    basis(m, (
      <>
        <rect x="1.5" y="2" width="11" height="10" rx="2.6" />
        <rect x="4" y="6.4" width="6" height="3.4" rx="1.6" />
      </>
    )),
  "gedrag-submachine": (m) =>
    basis(m, (
      <>
        <rect x="1.5" y="3" width="11" height="8" rx="3.4" />
        <path d="M4.6 7c.8-1.4 2-1.4 2.6 0s1.8 1.4 2.6 0" />
      </>
    )),
  "gedrag-object": (m) => basis(m, <rect x="2" y="3.6" width="10" height="6.8" />),
  "gedrag-lane": (m) =>
    basis(m, (
      <>
        <rect x="2.5" y="1.5" width="9" height="11" />
        <line x1="2.5" y1="4.4" x2="11.5" y2="4.4" />
      </>
    )),
  // ── use case ──
  "uc-actor": (m) =>
    basis(m, (
      <>
        <circle cx="7" cy="2.9" r="1.6" />
        <path d="M7 4.5v3.6M4 6h6M7 8.1l-2.2 3.6M7 8.1l2.2 3.6" />
      </>
    )),
  "uc-usecase": (m) => basis(m, <ellipse cx="7" cy="7" rx="5.4" ry="3.4" />),
  "uc-systeem": (m) =>
    basis(m, (
      <>
        <rect x="2" y="1.8" width="10" height="10.4" />
        <line x1="2" y1="4.6" x2="12" y2="4.6" />
        <ellipse cx="7" cy="8.6" rx="3" ry="1.7" />
      </>
    )),
};

let _geregistreerd = false;
export function registreerGedragTypeIconen() {
  if (_geregistreerd) return;
  for (const [id, teken] of Object.entries(GLYPHS)) {
    registreerTypeIcoon(id, ({ maat = 14 }) => teken(maat));
  }
  _geregistreerd = true;
}
