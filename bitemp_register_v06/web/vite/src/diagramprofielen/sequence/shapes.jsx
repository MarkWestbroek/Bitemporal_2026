/**
 * Sequence-shapes (v0):
 *
 *   - **levenslijn**: de node zelf is bewust smal (14px breed) en hoog — de
 *     gestippelde lijn. De naam-kop rendert er via overflow bovenop (breder
 *     dan de node). Dáárdoor werkt het rand-primitief (§3.1) als
 *     sequence-mechaniek: punten/activaties klemmen op de node-omtrek
 *     = visueel óp de lijn, schuiven er verticaal langs en bewegen mee
 *     met de levenslijn;
 *   - **punt** (occurrence): klein bolletje op de lijn — het aanhechtpunt
 *     voor berichten (v0-benadering van het as-/volgorde-primitief:
 *     de y-positie ís de volgorde, door de gebruiker beheerd);
 *   - **activatie**: smalle balk op de lijn (execution specification),
 *     in hoogte resizebaar (minBreedte/minHoogte, core);
 *   - **fragment**: kader met soort-chip linksboven (alt/opt/loop/par).
 *
 * `children` bevat de React Flow-handles (+ resizer) — altijd renderen.
 */
import React from "react";
import { registreerShape } from "../../diagramcore/shapes/shapeRegistry.js";
import { resolveerElementRef } from "../../studio/elementVerwijzing.jsx";

const DONKER = "#334155";
const KOP_BREED = 148;

/** Levenslijn: smalle hoge node (de lijn), met de naam-kop erbovenop. */
function LevenslijnShape({ element, selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "#94a3b8";
  // Getypeerd object (instantie-van): kop toont "naam:Type" onderstreept —
  // de UML-objectnotatie. Onvindbaar type → naam + ⚠ (verwijderd/hernoemd).
  const ref = element?.data?.instantieVan;
  const type = ref ? resolveerElementRef(ref) : null;
  const kop = element?.naam || (type ? "" : "(levenslijn)");
  return (
    <div style={{ width: 14, height: "100%", minHeight: 260, position: "relative" }}>
      {/* De gestippelde lijn zelf (gecentreerd in de smalle node). */}
      <svg width="14" height="100%" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} preserveAspectRatio="none">
        <line x1="7" y1="30" x2="7" y2="100%" stroke={selected ? "var(--dc-selectie, #2563eb)" : DONKER} strokeWidth="1.4" strokeDasharray="6 4" />
      </svg>
      {/* Naam-kop: breder dan de node (overflow), gecentreerd bovenaan. De
          kop hoort bij de node (kind-element) en sleept hem dus gewoon mee. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 7 - KOP_BREED / 2,
          width: KOP_BREED,
          padding: "6px 8px",
          boxSizing: "border-box",
          border: `1.6px solid ${rand}`,
          borderRadius: 4,
          background: element?.data?.kleur || "#f8fafc",
          fontSize: 12,
          fontWeight: 700,
          color: "#0f172a",
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {ref ? (
          <span style={{ textDecoration: "underline" }}>
            {kop}
            {type ? `:${type.label}` : " ⚠"}
          </span>
        ) : (
          kop
        )}
      </div>
      {children}
    </div>
  );
}

/** Punt (occurrence): bolletje op de lijn — aanhechtpunt voor berichten. */
function PuntShape({ selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  return (
    <div
      className="dc-punt-node"
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: "var(--s-panel, #fff)",
        border: `1.6px solid ${rand}`,
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}

/** Activatie: smalle staande balk (execution specification) op de lijn. */
function ActivatieShape({ selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  return (
    <div
      className="dc-punt-node"
      style={{
        width: 14,
        height: "100%",
        minHeight: 44,
        background: "#e2e8f0",
        border: `1.5px solid ${rand}`,
        borderRadius: 2,
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}

/** Fragment: kader met de soort (alt/opt/loop/par) als chip linksboven. */
function FragmentShape({ element, selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "#94a3b8";
  const soort = element?.data?.soort || "alt";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 260,
        minHeight: 160,
        border: `1.6px solid ${rand}`,
        borderRadius: 3,
        background: "rgba(148, 163, 184, 0.06)",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          padding: "2px 14px 2px 8px",
          background: "var(--s-panel, #fff)",
          border: `1.6px solid ${rand}`,
          borderTop: "none",
          borderLeft: "none",
          // Het klassieke "afgeknipte hoek"-pentagoontje.
          clipPath: "polygon(0 0, 100% 0, 100% 55%, 85% 100%, 0 100%)",
          fontSize: 11,
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        {soort}
        {element?.naam ? ` — ${element.naam}` : ""}
      </div>
      {children}
    </div>
  );
}

let _geregistreerd = false;
export function registreerSequenceShapes() {
  if (_geregistreerd) return;
  registreerShape("seq-levenslijn", LevenslijnShape);
  registreerShape("seq-punt", PuntShape);
  registreerShape("seq-activatie", ActivatieShape);
  registreerShape("seq-fragment", FragmentShape);
  _geregistreerd = true;
}
