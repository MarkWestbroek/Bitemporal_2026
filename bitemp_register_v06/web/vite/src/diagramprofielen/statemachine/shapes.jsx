/**
 * State machine-shapes (v1):
 *
 *   - begin (gevulde stip) / eind (ring met kern) — pseudotoestanden;
 *   - keuze (ruit), junction (kleine stip), historie (Ⓗ/Ⓗ*) — pseudostates;
 *   - entry/exit-point (open cirkel / cirkel-met-kruis) — rand-elementen
 *     (primitief §3.1): ze wonen op de rand van een (samengestelde) toestand;
 *   - samengestelde toestand — container met naamstrook (primitief §2).
 *
 * Klein en (grotendeels) naamloos. `children` bevat de React Flow-handles
 * (+ resizer + gedrag-badge) uit ElementNode — die móéten gerenderd worden,
 * anders kan geen transitie aanhechten.
 */
import React from "react";
import { registreerShape } from "../../diagramcore/shapes/shapeRegistry.js";

const DONKER = "#334155";

/** Gedeeld: rond punt-node-frame met selectierand. */
function rondeStijl(maat, selected, extra = {}) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  return {
    width: maat,
    height: maat,
    borderRadius: "50%",
    border: `${selected ? 2.5 : 1.5}px solid ${rand}`,
    boxSizing: "border-box",
    position: "relative",
    ...extra,
  };
}

function BeginShape({ selected, children }) {
  return (
    <div className="dc-punt-node" style={rondeStijl(22, selected, { background: DONKER })}>
      {children}
    </div>
  );
}

function EindShape({ selected, children }) {
  return (
    <div
      className="dc-punt-node"
      style={rondeStijl(24, selected, {
        background: "var(--s-panel, #fff)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <div style={{ width: 12, height: 12, borderRadius: "50%", background: DONKER, pointerEvents: "none" }} />
      {children}
    </div>
  );
}

/** Keuze (choice): ruit — dynamische conditionele vertakking. */
function KeuzeShape({ selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  return (
    <div className="dc-punt-node" style={{ width: 28, height: 28, position: "relative", boxSizing: "border-box" }}>
      <svg width="28" height="28" viewBox="0 0 28 28" style={{ display: "block", pointerEvents: "none" }}>
        <path
          d="M14 1.5 L26.5 14 L14 26.5 L1.5 14 Z"
          fill="var(--s-panel, #fff)"
          stroke={rand}
          strokeWidth={selected ? 2.5 : 1.5}
        />
      </svg>
      {children}
    </div>
  );
}

/** Junction: gevulde stip (statische samenvoeg-/vertakkingspunt), kleiner dan begin. */
function JunctionShape({ selected, children }) {
  return (
    <div className="dc-punt-node" style={rondeStijl(16, selected, { background: DONKER })}>
      {children}
    </div>
  );
}

/** Historie: Ⓗ (ondiep) of Ⓗ* (diep, via data.diep). */
function HistorieShape({ element, selected, children }) {
  const diep = !!element?.data?.diep;
  return (
    <div
      className="dc-punt-node"
      style={rondeStijl(24, selected, {
        background: "var(--s-panel, #fff)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: DONKER, pointerEvents: "none", lineHeight: 1 }}>
        H{diep ? "*" : ""}
      </span>
      {children}
    </div>
  );
}

/** Entry-point: open cirkeltje — woont op de rand van een (samengestelde) toestand. */
function EntryShape({ selected, children }) {
  return (
    <div className="dc-punt-node" style={rondeStijl(16, selected, { background: "var(--s-panel, #fff)" })}>
      {children}
    </div>
  );
}

/** Exit-point: cirkeltje met kruis — idem, voor uitgaande grensovergang. */
function ExitShape({ selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  return (
    <div className="dc-punt-node" style={{ width: 16, height: 16, position: "relative", boxSizing: "border-box" }}>
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ display: "block", pointerEvents: "none" }}>
        <circle cx="8" cy="8" r="7" fill="var(--s-panel, #fff)" stroke={rand} strokeWidth={selected ? 2 : 1.5} />
        <path d="M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5" stroke={rand} strokeWidth="1.5" />
      </svg>
      {children}
    </div>
  );
}

/**
 * Samengestelde toestand: afgeronde container met naamstrook bovenin; het
 * vlak eronder is de "regio" waar deel-toestanden in gesleept worden
 * (containerVoor legt het bevat-lidmaatschap, zoals bij packages).
 */
function ComposietShape({ element, selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "#94a3b8";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 180,
        minHeight: 120,
        borderRadius: 14,
        border: `2px solid ${rand}`,
        background: element?.data?.kleur ? `${element.data.kleur}33` : "rgba(254, 249, 195, 0.18)",
        boxSizing: "border-box",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "5px 12px",
          borderBottom: "1px dashed #94a3b8",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--s-fg, #0f172a)",
          textAlign: "center",
        }}
      >
        {element?.naam || "(naamloos)"}
      </div>
      {children}
    </div>
  );
}

let _geregistreerd = false;
export function registreerStateMachineShapes() {
  if (_geregistreerd) return;
  registreerShape("sm-begin", BeginShape);
  registreerShape("sm-eind", EindShape);
  registreerShape("sm-keuze", KeuzeShape);
  registreerShape("sm-junction", JunctionShape);
  registreerShape("sm-historie", HistorieShape);
  registreerShape("sm-entry", EntryShape);
  registreerShape("sm-exit", ExitShape);
  registreerShape("sm-composiet", ComposietShape);
  _geregistreerd = true;
}
