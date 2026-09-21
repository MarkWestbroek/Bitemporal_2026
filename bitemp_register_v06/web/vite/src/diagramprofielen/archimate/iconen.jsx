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
  // ── gedeeld over lagen (3.2-completering, 04-09) ──
  "am-collaboratie": (m) =>
    basis(m, (
      <>
        <circle cx="5.2" cy="7" r="3.4" />
        <circle cx="8.8" cy="7" r="3.4" />
      </>
    )),
  "am-interactie": (m) =>
    basis(m, (
      <>
        <path d="M6 3 A 4 4 0 0 0 6 11 Z" />
        <path d="M8 3 A 4 4 0 0 1 8 11 Z" transform="translate(0.6 0)" />
      </>
    )),
  "am-interface": (m) =>
    basis(m, (
      <>
        <path d="M2 7 H7.2" />
        <circle cx="9.6" cy="7" r="2.4" />
      </>
    )),
  // ── business-aanvulling ──
  "am-contract": (m) =>
    basis(m, (
      <>
        <rect x="2" y="3" width="10" height="8" />
        <line x1="2" y1="5.4" x2="12" y2="5.4" />
        <line x1="2" y1="8.8" x2="12" y2="8.8" />
      </>
    )),
  "am-representatie": (m) =>
    basis(m, (
      <>
        <path d="M2 2.5 H12 V9.6 C10.3 8.7 9.4 10.6 7 9.7 C4.6 8.8 3.7 10.7 2 9.8 Z" />
        <path d="M4 4.8 H10" />
      </>
    )),
  "am-product": (m) =>
    basis(m, (
      <>
        <rect x="2" y="3" width="10" height="8" />
        <path d="M2 5.4 H7.5 V3" />
      </>
    )),
  // ── technology/physical-aanvulling ──
  "am-pad": (m) => basis(m, <path d="M4.4 4.6 L2 7 L4.4 9.4 M9.6 4.6 L12 7 L9.6 9.4 M2.6 7 H11.4" strokeDasharray="2.2 1.6" />),
  "am-netwerk": (m) =>
    basis(m, (
      <>
        <circle cx="3.4" cy="4" r="1.4" /><circle cx="10.6" cy="4" r="1.4" />
        <circle cx="3.4" cy="10" r="1.4" /><circle cx="10.6" cy="10" r="1.4" />
        <path d="M4.8 4 H9.2 M4.8 10 H9.2 M3.4 5.4 V8.6 M10.6 5.4 V8.6" />
      </>
    )),
  "am-equipment": (m) =>
    basis(m, (
      <>
        <circle cx="7" cy="7" r="2" />
        <path d="M7 2.6 V4 M7 10 V11.4 M2.6 7 H4 M10 7 H11.4 M3.9 3.9 L4.9 4.9 M9.1 9.1 L10.1 10.1 M10.1 3.9 L9.1 4.9 M4.9 9.1 L3.9 10.1" />
      </>
    )),
  "am-facility": (m) => basis(m, <path d="M2 11.5 V4 L5.2 6.4 V4 L8.4 6.4 V4 L11.6 6.4 V11.5 Z" />),
  "am-distributie": (m) => basis(m, <path d="M4.4 4 L1.8 7 L4.4 10 M9.6 4 L12.2 7 L9.6 10 M2.4 5.8 H11.6 M2.4 8.2 H11.6" />),
  "am-materiaal": (m) =>
    basis(m, (
      <>
        <path d="M7 2.4 L12 7 L7 11.6 L2 7 Z" />
        <path d="M5.2 7 H8.8" />
      </>
    )),
  // ── strategy ──
  "am-resource": (m) =>
    basis(m, (
      <>
        <rect x="2" y="4" width="9" height="6" rx="1" />
        <path d="M11 5.8 H12.2 V8.2 H11 M4 5.8 V8.2 M6.2 5.8 V8.2 M8.4 5.8 V8.2" />
      </>
    )),
  "am-capability": (m) =>
    basis(m, (
      <>
        <rect x="8" y="2.5" width="3.5" height="3" />
        <rect x="8" y="5.5" width="3.5" height="3" /><rect x="4.5" y="5.5" width="3.5" height="3" />
        <rect x="8" y="8.5" width="3.5" height="3" /><rect x="4.5" y="8.5" width="3.5" height="3" /><rect x="1" y="8.5" width="3.5" height="3" />
      </>
    )),
  "am-koers": (m) =>
    basis(m, (
      <>
        <path d="M2 11.5 C5.5 11.5 4.5 5.5 8.2 4.6" />
        <path d="M6.8 3.2 L10 4.2 L7.6 6.4" />
        <circle cx="11" cy="3.5" r="1.6" />
      </>
    )),
  "am-waardestroom": (m) => basis(m, <path d="M2 4 H8.6 L12 7 L8.6 10 H2 L4.6 7 Z" fill="currentColor" fillOpacity="0.25" />),
  // ── motivation-aanvulling ──
  "am-assessment": (m) =>
    basis(m, (
      <>
        <circle cx="6" cy="6" r="3.4" />
        <path d="M8.5 8.5 L11.6 11.6" />
      </>
    )),
  "am-outcome": (m) =>
    basis(m, (
      <>
        <circle cx="6.4" cy="7.6" r="4.2" />
        <circle cx="6.4" cy="7.6" r="1.8" />
        <path d="M6.4 7.6 L11.2 2.8 M9.4 2.6 L11.4 2.6 L11.4 4.6" />
      </>
    )),
  "am-betekenis": (m) => basis(m, <path d="M4 10.5 C1.8 10.5 1.6 7.8 3.4 7.2 C2.8 5 5.4 3.4 7 4.8 C7.8 3 11 3.2 11.2 5.4 C13 5.8 12.8 8.6 11 9 C11.4 10.4 9.6 11.4 8.4 10.5 Z" />),
  "am-waarde": (m) => basis(m, <ellipse cx="7" cy="7" rx="5" ry="3.4" />),
  // ── implementatie & migratie ──
  "am-werkpakket": (m) =>
    basis(m, (
      <>
        <rect x="2" y="4.5" width="10" height="7" rx="1" />
        <path d="M5 4.5 V3 H9 V4.5" />
      </>
    )),
  "am-deliverable": (m) => basis(m, <path d="M2 2.5 H12 V9.6 C10.3 8.7 9.4 10.6 7 9.7 C4.6 8.8 3.7 10.7 2 9.8 Z" />),
  "am-plateau": (m) => basis(m, <path d="M5 3.5 H12 M3.5 7 H10.5 M2 10.5 H9" strokeWidth="1.8" />),
  "am-gap": (m) =>
    basis(m, (
      <>
        <circle cx="7" cy="7" r="4.2" />
        <path d="M3.6 5.8 H10.4 M3.6 8.2 H10.4" />
      </>
    )),
  // ── overig ──
  "am-locatie": (m) =>
    basis(m, (
      <>
        <path d="M7 12 C4.6 9.2 3.2 7.4 3.2 5.6 A 3.8 3.8 0 0 1 10.8 5.6 C10.8 7.4 9.4 9.2 7 12 Z" />
        <circle cx="7" cy="5.6" r="1.4" />
      </>
    )),
  "am-groep": (m) =>
    basis(m, (
      <>
        <path d="M2 5 V3.5 H7 V5" strokeDasharray="1.8 1.4" />
        <rect x="2" y="5" width="10" height="6.5" strokeDasharray="1.8 1.4" />
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
