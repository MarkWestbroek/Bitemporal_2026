/**
 * SysML-taakbalkiconen (ontwerpronde 2, 2026-08-08 — zie
 * `docs/STUDIO-05-iconen-ronde2-antwoord.md`).
 *
 * SysML is het profiel waar het *silhouet niets onderscheidt*: zes van de tien
 * knopen zijn een class-box. Het icoon is hier dus een **symbool** — het
 * tekent wat er ín de doos zit, niet de doos. Vijf van die zes lenen daarom
 * een bestaand vocabulaire-icoon (waardetype → `datatype`, interfaceblok →
 * `interface`, constraintblok → `constraint`, enumeratie → `enumeratie`,
 * pakket → `package`); alleen blok, part, poort en requirement zijn nieuw.
 *
 * Twee familiemiddelen die hier zijn vastgelegd en verder gaan dan SysML:
 *
 *   1. **Context gestreept, onderwerp gevuld.** Waar een type alleen bestaat
 *      *binnen* iets anders, tekent het icoon die gastheer gestreept en het
 *      onderwerp zelf doorgetrokken/gevuld — `sy-part` (deel in een blok) en
 *      `sy-poort` (op de rand).
 *   2. **Randelement-motief.** Een type dat via `randElement` op de omtrek van
 *      zijn gastheer klemt, krijgt een gestreepte gastheerrand met het element
 *      erop. Dat is precies het motorprimitief; `cmmn-sentry` gebruikt
 *      hetzelfde beeld met een ruit in plaats van een vierkantje.
 *
 * Connectoren volgen het grondpatroon van ronde 1: horizontale lijn op de
 * middenas, markersymbool rechts, lijnstijl = die van de connector. Staat er
 * in de notatie iets *óp* de lijn (item flow), dan staat dat in het icoon in
 * het midden.
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
   * Blok «block»: het gehéél met zijn delen. Niet `klasse` — een blok is in
   * een bdd juist te onderscheiden van waardetype/interfaceblok/enumeratie
   * (allemaal class-boxen), en wat het blok uniek maakt is dat het parts
   * bevat. Eén van die twee delen is het accent.
   */
  "sy-blok": (m) =>
    basis(m, (
      <>
        <rect x="1.5" y="2" width="11" height="10" rx="1" />
        <line x1="3.4" y1="4.5" x2="10.6" y2="4.5" />
        <rect x="3" y="6.7" width="3.5" height="3.3" rx="0.5" {...vul} />
        <rect x="7.7" y="6.7" width="3.5" height="3.3" rx="0.5" />
      </>
    )),
  /** Part: het deel is het onderwerp (gevuld), de gastheer is context (gestreept). */
  "sy-part": (m) =>
    basis(m, (
      <>
        <rect x="1.5" y="2" width="11" height="10" rx="1" strokeDasharray="2.4 1.8" />
        <rect x="4.2" y="4.7" width="5.6" height="4.6" rx="0.8" {...vul} />
      </>
    )),
  /** Poort: het randelement-motief — gestreepte gastheerrand, vierkantje erop. */
  "sy-poort": (m) =>
    basis(m, (
      <>
        <path d="M1.6 2H7.4v10H1.6" strokeDasharray="2.4 1.8" />
        <rect x="5.4" y="5" width="4" height="4" {...vul} />
      </>
    )),
  /**
   * Requirement: de eis. Het uitroepteken is één symbool (schacht + punt) en
   * telt daarmee als het ene accent; het leest op 11px nog als "eis", waar een
   * doos-met-tekstregels dat niet doet.
   */
  "sy-requirement": (m) =>
    basis(m, (
      <>
        <rect x="1.5" y="2" width="11" height="10" rx="1" />
        <g {...vul}>
          <path d="M6.3 3.9h1.4l-.28 4.3h-.84z" />
          <rect x="6.15" y="9.3" width="1.7" height="1.7" rx="0.85" />
        </g>
      </>
    )),

  // ── Connectoren ─────────────────────────────────────────────────────────
  /** Traceerrelatie: gestreepte open pijl náár een eis (het gevulde doel). */
  "sy-trace": (m) =>
    basis(m, (
      <>
        <line x1="1.2" y1="7" x2="6.4" y2="7" strokeDasharray="2.2 1.8" />
        <path d="M6.2 4.9 8.3 7 6.2 9.1" />
        <rect x="8.9" y="3.4" width="3.6" height="7.2" rx="0.7" {...vul} />
      </>
    )),
  /**
   * Connector (ibd): de enige SysML-lijn zónder marker. Het icoon toont wat
   * hij verbindt — twee poorten — met de verbinding zelf als accent.
   */
  "sy-verbinding": (m) =>
    basis(m, (
      <>
        <rect x="1.4" y="5.4" width="3.2" height="3.2" />
        <line x1="4.6" y1="7" x2="9.4" y2="7" />
        <rect x="9.4" y="5.4" width="3.2" height="3.2" />
        <circle cx="7" cy="7" r="1.15" {...vul} />
      </>
    )),
  /** Item flow: gevulde pijl óp de lijn — precies de SysML-notatie. */
  "sy-itemflow": (m) =>
    basis(m, (
      <>
        <line x1="1.5" y1="7" x2="12.5" y2="7" />
        <path d="M5.6 4.6 9.2 7 5.6 9.4Z" {...vul} />
      </>
    )),
  /** Bevat (requirement): het ⊕ van de samengestelde eis — open, conform B2. */
  "sy-bevat-req": (m) =>
    basis(m, (
      <>
        <circle cx="4" cy="7" r="2.5" />
        <path d="M4 4.5V9.5M1.5 7H6.5" />
        <line x1="6.5" y1="7" x2="12.6" y2="7" />
      </>
    )),
  /** Bevat (part): gestreepte lijn naar het blok met het gevulde lid erin. */
  "sy-bevat-part": (m) =>
    basis(m, (
      <>
        <line x1="1" y1="7" x2="5.6" y2="7" strokeDasharray="2 1.6" />
        <rect x="6.8" y="3.4" width="5.7" height="7.2" rx="0.8" />
        <rect x="8.3" y="5.9" width="2.7" height="2.2" rx="0.5" {...vul} />
      </>
    )),
};

let _geregistreerd = false;

/** Registreer de SysML-iconen (idempotent; aangeroepen door `registreerSysml`). */
export function registreerSysmlIconen() {
  if (_geregistreerd) return;
  _geregistreerd = true;
  for (const [id, teken] of Object.entries(GLYPHS)) {
    registreerTypeIcoon(id, ({ maat = 14 }) => teken(maat));
  }
}
