/**
 * CMMN-taakbalkiconen (ontwerpronde 2, 2026-08-08 — zie
 * `docs/STUDIO-05-iconen-ronde2-antwoord.md`).
 *
 * CMMN is het tegenovergestelde van SysML: hier ís de vorm de betekenis. Alle
 * zeven canvasvormen hebben een eigen, uniek silhouet, dus alle zeven iconen
 * zijn **mini-silhouetten** van die vorm — precies zoals bij DMN. Het ene
 * gevulde accent valt telkens op het detail dat de vorm zijn betekenis geeft:
 * de tab van de map, de afschuining van de stage, het soort-badge van de task,
 * het bereikte punt van de milestone.
 *
 * Alleen `notitie` wordt geleend uit `iconenVocabulaire.jsx`. Let op het
 * onderscheid tussen **case file item** en **notitie**: op het canvas zijn dat
 * allebei een dokje met omgevouwen hoek, dus de iconen moeten het verschil
 * dragen. Dat doen ze via het accent — bij de notitie is dat de omgevouwen
 * hoek, bij het case file item de gegevensregel erin.
 *
 * De **sentry** gebruikt het randelement-motief uit `sysml/iconen.jsx`:
 * gestreepte gastheerrand met het element erop. Eén glyph, geen twee — entry
 * en exit zijn een `soort`-property van hetzelfde elementtype, en `TypeIcoon`
 * kiest per *type*, niet per element.
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

/** Het ene gevulde accent per icoon (familieregel B1). */
const vul = { fill: "currentColor", stroke: "none" };

/** @type {Record<string, (m: number) => JSX.Element>} */
const GLYPHS = {
  // ── Knopen ──────────────────────────────────────────────────────────────
  /**
   * Case plan model: de mapvorm. Bewust vierkante hoeken en een brede tab —
   * dat onderscheidt hem van de UML-hangmap (`package`), die een smalle,
   * afgeronde tab heeft.
   */
  "cmmn-caseplan": (m) =>
    basis(m, (
      <>
        <path d="M1.5 4.2V2.6h6.1v1.6Z" {...vul} />
        <rect x="1.5" y="4.2" width="11" height="7.6" />
      </>
    )),
  /** Stage: de achthoek, met de afschuining zelf als accent. */
  "cmmn-stage": (m) =>
    basis(m, (
      <>
        <path d="M4.2 1.8H9.8L12.2 4.2V9.8L9.8 12.2H4.2L1.8 9.8V4.2Z" />
        {/* Ruime wig, geen dun randje: onder de 1.2-lijn van de achthoek zelf
            verdwijnt een smalle afschuining volledig. */}
        <path d="M1.8 4.2 4.2 1.8 8 1.8 1.8 8Z" {...vul} />
      </>
    )),
  /** Task: afgeronde rechthoek met het soort-badge linksboven (zoals op het canvas). */
  "cmmn-taak": (m) =>
    basis(m, (
      <>
        <rect x="1.5" y="3" width="11" height="8" rx="2.4" />
        <rect x="3" y="4.4" width="2.6" height="2.6" rx="0.5" {...vul} />
      </>
    )),
  /** Milestone: het stadion met het bereikte punt erin. */
  "cmmn-mijlpaal": (m) =>
    basis(m, (
      <>
        <rect x="1.5" y="4.2" width="11" height="5.6" rx="2.8" />
        <circle cx="7" cy="7" r="1.15" {...vul} />
      </>
    )),
  /**
   * Event listener: de dubbele cirkel, plus een gevulde kern. Die kern is
   * nodig: zónder is dit twee ringen en dat is op 11px niet te scheiden van
   * `gedrag-eind` (eindtoestand).
   */
  "cmmn-event": (m) =>
    basis(m, (
      <>
        <circle cx="7" cy="7" r="5.6" />
        <circle cx="7" cy="7" r="3.4" />
        <circle cx="7" cy="7" r="1.1" {...vul} />
      </>
    )),
  /** Case file item: het dokje, met de gegevensregel als accent (vgl. `notitie`). */
  "cmmn-casefile": (m) =>
    basis(m, (
      <>
        <path d="M2.5 1.8H8.8L11.5 4.5V12.2H2.5Z" />
        <path d="M8.8 1.8V4.5H11.5" />
        <rect x="4.3" y="7.2" width="5.4" height="1.9" rx="0.4" {...vul} />
      </>
    )),
  /**
   * Sentry: de ruit op de rand van zijn plan item. Open — dat is de entry
   * criterion (de default bij het maken), en conform B2 blijft een markervorm
   * open. De exit-variant (gevuld) is een property, geen tweede elementtype.
   */
  "cmmn-sentry": (m) =>
    basis(m, (
      <>
        {/* De gastheerrand breekt af waar de sentry zit: een open ruit mag geen
            streepjeslijn dwars door zich heen krijgen. */}
        <path d="M1.6 2H7.4V3.5M7.4 10.5V12H1.6" strokeDasharray="2.4 1.8" />
        <path d="M7.4 3.6 10.6 7 7.4 10.4 4.2 7Z" />
      </>
    )),

  // ── Connectoren ─────────────────────────────────────────────────────────
  /** On-part: gestippelde lijn naar een sentry (open ruit, conform B2). */
  "cmmn-onpart": (m) =>
    basis(m, (
      <>
        <line x1="1.2" y1="7" x2="6.6" y2="7" strokeDasharray="2 1.6" />
        <path d="M9.5 3.6 12.7 7 9.5 10.4 6.3 7Z" />
      </>
    )),
  /** Associatie: losse koppeling — gestreepte lijn tussen twee open uiteinden. */
  "cmmn-associatie": (m) =>
    basis(m, (
      <>
        <circle cx="2.6" cy="7" r="1.3" />
        <line x1="4.3" y1="7" x2="9.7" y2="7" strokeDasharray="2.2 1.8" />
        <circle cx="11.4" cy="7" r="1.3" />
      </>
    )),
  /** Bevat (stage): gestreepte lijn naar de achthoek met het gevulde lid erin. */
  "cmmn-bevat": (m) =>
    basis(m, (
      <>
        <line x1="0.8" y1="7" x2="5.2" y2="7" strokeDasharray="2 1.6" />
        <path d="M8 3.2H11.4L13 4.8V9.2L11.4 10.8H8L6.4 9.2V4.8Z" />
        <rect x="8.6" y="6.1" width="2.2" height="1.8" rx="0.4" {...vul} />
      </>
    )),
};

let _geregistreerd = false;

/** Registreer de CMMN-iconen (idempotent; aangeroepen door `registreerCmmn`). */
export function registreerCmmnIconen() {
  if (_geregistreerd) return;
  _geregistreerd = true;
  for (const [id, teken] of Object.entries(GLYPHS)) {
    registreerTypeIcoon(id, ({ maat = 14 }) => teken(maat));
  }
}
