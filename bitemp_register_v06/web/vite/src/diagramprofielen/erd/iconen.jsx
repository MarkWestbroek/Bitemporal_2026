/**
 * ERD-taakbalkiconen (ontwerpronde 2, 2026-08-08 — zie
 * `docs/STUDIO-05-iconen-ronde2-antwoord.md`).
 *
 * ERD is het profiel met het meeste hergebruik: van de zes elementtypen
 * lenen er drie een bestaand icoon uit `iconenVocabulaire.jsx` (domein →
 * `kader`, notitie → `notitie`, subtype → `generalisatie`). Alleen deze drie
 * zijn nieuw:
 *
 *   - **entiteit** — géén `klasse`. Een ERD-entiteit is een *tabel*: de
 *     sleutel staat boven de streep en de kolommen eronder. Het icoon tekent
 *     dus een raster met de **sleutelcel gevuld**, niet de UML-kopbalk. Zo
 *     blijft in de projectboom zichtbaar of een model UML of ERD is.
 *   - **relatie** — de kraaienpoot zelf, in zijn archetypische vorm
 *     één-op-veel (‖ links, poot rechts). Eén glyph voor alle vier de
 *     kardinaliteiten: die zijn een *property* per uiteinde, geen apart
 *     elementtype, en de taakbalk heeft dus ook maar één Relatie-knop.
 *     Conform besluit B2 blijft een markervorm open — hier geen vulling.
 *   - **bevat** — gestreepte lijn naar de container met het gevulde lid
 *     erin. Hetzelfde grondpatroon als `sy-bevat-part` en `cmmn-bevat`; het
 *     verschil zit in de container (hier gestreept, want een domein ís een
 *     kader).
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
  /** Entiteit: tabelraster met de sleutelcel gevuld. */
  "erd-entiteit": (m) =>
    basis(m, (
      <>
        <rect x="1.5" y="2" width="11" height="10" rx="1" />
        <line x1="1.5" y1="5.2" x2="12.5" y2="5.2" />
        <line x1="1.5" y1="8.6" x2="12.5" y2="8.6" />
        <line x1="6.2" y1="5.2" x2="6.2" y2="12" />
        <rect x="2.6" y="6.1" width="2.9" height="1.7" rx="0.3" {...vul} />
      </>
    )),
  /** Relatie: kraaienpoot één-op-veel (‖ … |<). */
  "erd-relatie": (m) =>
    basis(m, (
      <>
        <line x1="1.4" y1="7" x2="9.2" y2="7" />
        <line x1="3.4" y1="4.4" x2="3.4" y2="9.6" />
        <path d="M9.2 7 12.6 4.2 M9.2 7 H12.6 M9.2 7 12.6 9.8" />
      </>
    )),
  /** Bevat (domein): gestreepte lijn naar een gestreept kader met gevuld lid. */
  "erd-bevat": (m) =>
    basis(m, (
      <>
        <line x1="1" y1="7" x2="5.4" y2="7" strokeDasharray="2 1.7" />
        <rect x="6.6" y="3.2" width="5.9" height="7.6" rx="0.8" strokeDasharray="3 2.1" />
        <rect x="8.1" y="5.8" width="2.9" height="2.4" rx="0.5" {...vul} />
      </>
    )),
};

let _geregistreerd = false;

/** Registreer de ERD-iconen (idempotent; aangeroepen door `registreerErd`). */
export function registreerErdIconen() {
  if (_geregistreerd) return;
  _geregistreerd = true;
  for (const [id, teken] of Object.entries(GLYPHS)) {
    registreerTypeIcoon(id, ({ maat = 14 }) => teken(maat));
  }
}
