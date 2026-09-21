/**
 * Toegangsregel-boomiconen — mini-silhouetten van de vormentaal (zie
 * shapes.jsx en het ontwerp-antwoord), op het typeIconen-koppelvlak voor
 * projectboom en taakbalken. Zelfde raster als de core-set (viewBox 14,
 * currentColor); één gevuld accent per icoon, conform de familieregels.
 */
import React from "react";
import { registreerTypeIcoon } from "../../diagramcore/shapes/typeIconen.jsx";

const basis = (maat, kinderen) => (
  <svg
    width={maat}
    height={maat}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    {kinderen}
  </svg>
);

/** @type {Record<string, (m: number) => JSX.Element>} */
const GLYPHS = {
  /** Policy: kopkaart met gevulde boekrug. */
  "tr-policy": (m) =>
    basis(m, (
      <>
        <rect x="1.5" y="2" width="13" height="12" rx="1.5" />
        <path d="M1.5 12.5v-9A1.5 1.5 0 0 1 3 2h2v12H3a1.5 1.5 0 0 1-1.5-1.5Z" fill="currentColor" stroke="none" />
      </>
    )),
  /** Map: hangmap met gevulde tab. */
  "tr-map": (m) =>
    basis(m, (
      <>
        <path d="M1.5 6V3.6a1 1 0 0 1 1-1h3.4a1 1 0 0 1 1 1V6Z" fill="currentColor" stroke="none" />
        <rect x="1.5" y="6" width="13" height="7.5" rx="1" />
      </>
    )),
  /** Toegangsregel: kaart met gevulde modaliteitsband links. */
  "tr-regel": (m) =>
    basis(m, (
      <>
        <rect x="2" y="2.5" width="12" height="11" rx="2.5" />
        <path d="M2 11V5a2.5 2.5 0 0 1 2.5-2.5h1v11h-1A2.5 2.5 0 0 1 2 11Z" fill="currentColor" stroke="none" />
        <line x1="7.5" y1="8" x2="12" y2="8" />
      </>
    )),
  /** Subject: badge met gevulde clip + persoon. */
  "tr-subject": (m) =>
    basis(m, (
      <>
        <rect x="1.5" y="3" width="13" height="11" rx="3" />
        <rect x="6" y="1.5" width="4" height="3" rx="1.5" fill="currentColor" stroke="none" />
        <circle cx="8" cy="7.5" r="1.8" />
        <path d="M4.8 12a3.2 3.2 0 0 1 6.4 0" />
      </>
    )),
  /** Handeling: chevron met gevulde punt. */
  "tr-handeling": (m) =>
    basis(m, (
      <>
        <path d="M1.5 3.5h9l4 4.5-4 4.5h-9Z" />
        <path d="M10.5 3.5 14.5 8l-4 4.5V3.5Z" fill="currentColor" stroke="none" />
      </>
    )),
  /** Gegevensselectie: cilinder met gevulde dop. */
  "tr-gegevens": (m) =>
    basis(m, (
      <>
        <path d="M2.5 4.5v7a5.5 2.2 0 0 0 11 0v-7" />
        <ellipse cx="8" cy="4.5" rx="5.5" ry="2.2" fill="currentColor" stroke="none" />
      </>
    )),
  /** Voorwaardepoort: ruit met plus (de "alle"-poort als familiebeeld). */
  "tr-poort": (m) =>
    basis(m, (
      <>
        <path d="M1.5 8 8 1.5 14.5 8 8 14.5Z" />
        <path d="M8 5.2v5.6M5.2 8h5.6" />
      </>
    )),
  /** Voorwaarde: vergelijkingsstrook met gevulde kern (het teken). */
  "tr-voorwaarde": (m) =>
    basis(m, (
      <>
        <rect x="1.5" y="4.5" width="13" height="7" rx="3.5" />
        <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
      </>
    )),
  /** Plicht: vaandel met gevulde vlag. */
  "tr-plicht": (m) =>
    basis(m, (
      <>
        <path d="M1.5 3h13l-3 5 3 5h-13Z" />
        <path d="M4.5 12V4l4.5 1.8-4.5 1.8Z" fill="currentColor" stroke="none" />
      </>
    )),
  /** Begrip: gestippelde tag met oogje. */
  "tr-begrip": (m) =>
    basis(m, (
      <>
        <path d="M5.5 3H13a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 13 13H5.5L1.5 8Z" strokeDasharray="2.6 1.8" />
        <circle cx="5.8" cy="8" r="1.1" />
      </>
    )),
};

let _geregistreerd = false;

/** Registreer de boom-iconen (idempotent; aangeroepen door het profiel). */
export function registreerToegangsregelIconen() {
  if (_geregistreerd) return;
  _geregistreerd = true;
  for (const [id, glyph] of Object.entries(GLYPHS)) {
    registreerTypeIcoon(id, ({ maat = 14 }) => glyph(maat));
  }
}
