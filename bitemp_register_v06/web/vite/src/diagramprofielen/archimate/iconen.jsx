/**
 * ArchiMate-typeiconen — de hoek-iconen (rechtsboven in de box) én de
 * taakbalk-glyphs, op het typeIconen-koppelvlak. Benaderingen van de
 * ArchiMate 3.2-notatie in neutrale strokes; de merk-iconenset blijft een
 * ontwerp-sessie (plan §8.6a) — dan zijn dit puur her-registraties.
 */
import React from "react";
import { registreerTypeIcoon } from "../../diagramcore/shapes/typeIconen.jsx";

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

const GLYPHS = {
  // ── business ──
  "am-actor": (m) =>
    basis(m, (
      <>
        <circle cx="7" cy="3.2" r="1.7" />
        <path d="M7 4.9v3.4M4.2 6.4h5.6M7 8.3l-2 3.4M7 8.3l2 3.4" />
      </>
    )),
  "am-rol": (m) =>
    basis(m, (
      <>
        <path d="M4 4.5 H10 M4 9.5 H10" />
        <ellipse cx="10" cy="7" rx="1.8" ry="2.5" />
        <path d="M4 4.5 A 1.8 2.5 0 0 0 4 9.5" />
      </>
    )),
  "am-proces": (m) => basis(m, <path d="M2 5.5 H8 V3.5 L12 7 L8 10.5 V8.5 H2 Z" />),
  "am-functie": (m) => basis(m, <path d="M7 2 L11.5 6 V11.5 L7 7.8 L2.5 11.5 V6 Z" />),
  "am-service": (m) => basis(m, <rect x="2" y="4.5" width="10" height="5" rx="2.5" />),
  "am-event": (m) => basis(m, <path d="M2.5 4 H9 L12 7 L9 10 H2.5 L5.2 7 Z" />),
  "am-object": (m) =>
    basis(m, (
      <>
        <rect x="2" y="3" width="10" height="8" />
        <line x1="2" y1="5.4" x2="12" y2="5.4" />
      </>
    )),
  // ── application/technology ──
  "am-component": (m) =>
    basis(m, (
      <>
        <rect x="4.5" y="2" width="7.5" height="10" />
        <rect x="2" y="4" width="5" height="2" fill="var(--s-panel, #fff)" />
        <rect x="2" y="8" width="5" height="2" fill="var(--s-panel, #fff)" />
      </>
    )),
  "am-node": (m) =>
    basis(m, (
      <>
        <path d="M2 4.5 L4 2.5 H12 V9.5 L10 11.5 H2 Z" />
        <path d="M2 4.5 H10 V11.5 M10 4.5 L12 2.5" />
      </>
    )),
  "am-device": (m) =>
    basis(m, (
      <>
        <rect x="2.5" y="3" width="9" height="6.5" rx="1.6" />
        <path d="M4.5 11.5 L5.5 9.5 M9.5 11.5 L8.5 9.5 M3 11.5 H11" />
      </>
    )),
  "am-software": (m) =>
    basis(m, (
      <>
        <circle cx="8.4" cy="7.6" r="3.9" />
        <path d="M4.7 5.4 A 3.9 3.9 0 0 1 10.6 4.5" />
      </>
    )),
  "am-artifact": (m) =>
    basis(m, (
      <>
        <path d="M3 2 H9 L11.5 4.5 V12 H3 Z" />
        <path d="M9 2 V4.5 H11.5" />
      </>
    )),
  // ── motivation ──
  "am-stakeholder": (m) =>
    basis(m, (
      <>
        <circle cx="7" cy="7" r="4.6" />
        <circle cx="7" cy="7" r="1.6" />
        <path d="M7 2.4v2M7 9.6v2M2.4 7h2M9.6 7h2" />
      </>
    )),
  "am-driver": (m) =>
    basis(m, (
      <>
        <circle cx="7" cy="7" r="4.6" />
        <path d="M7 2.4 V11.6 M2.4 7 H11.6 M3.8 3.8 L10.2 10.2 M10.2 3.8 L3.8 10.2" />
      </>
    )),
  "am-goal": (m) =>
    basis(m, (
      <>
        <circle cx="7" cy="7" r="4.8" />
        <circle cx="7" cy="7" r="2.2" fill="currentColor" stroke="none" />
      </>
    )),
  "am-principle": (m) =>
    basis(m, (
      <>
        <rect x="3" y="2.5" width="8" height="9" rx="1.2" />
        <path d="M7 4.5 V8 M7 9.6 V9.9" strokeWidth="1.5" />
      </>
    )),
  "am-requirement": (m) =>
    basis(m, (
      <>
        <path d="M4.5 3 H12 L9.5 11 H2 Z" />
      </>
    )),
  // ── junction ──
  "am-junction": (m) => basis(m, <circle cx="7" cy="7" r="2.8" fill="currentColor" stroke="none" />),
};

let _geregistreerd = false;
export function registreerArchimateIconen() {
  if (_geregistreerd) return;
  for (const [id, teken] of Object.entries(GLYPHS)) {
    registreerTypeIcoon(id, ({ maat = 14 }) => teken(maat));
  }
  _geregistreerd = true;
}
