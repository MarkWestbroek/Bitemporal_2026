/**
 * Activity-shapes (UML 2 activity diagram):
 *
 *   - begin (gevulde stip) / eind (ring met kern) / flow-eind (ring met X);
 *   - beslissing/samenvoeging (ruit);
 *   - fork/join (dikke balk, `data.verticaal` kantelt hem);
 *   - object (rechthoek met naam — object node);
 *   - pin (klein vierkantje, rand-element op een actie);
 *   - partitie (swimlane-container met naamstrook bovenin).
 *
 * Bewust profiel-eigen (act-*) i.p.v. hergebruik van de sm-*-shapes: de
 * profielen blijven zo ontkoppeld registreerbaar. `children` bevat de React
 * Flow-handles (+ resizer/badge) uit ElementNode — altijd renderen.
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

/** Flow-eind: beëindigt één stroom (ring met X), niet de hele activity. */
function FlowEindShape({ selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  return (
    <div className="dc-punt-node" style={{ width: 20, height: 20, position: "relative", boxSizing: "border-box" }}>
      <svg width="20" height="20" viewBox="0 0 20 20" style={{ display: "block", pointerEvents: "none" }}>
        <circle cx="10" cy="10" r="9" fill="var(--s-panel, #fff)" stroke={rand} strokeWidth={selected ? 2 : 1.5} />
        <path d="M4.5 4.5 L15.5 15.5 M15.5 4.5 L4.5 15.5" stroke={rand} strokeWidth="1.5" />
      </svg>
      {children}
    </div>
  );
}

/** Beslissing/samenvoeging: ruit (decision/merge). */
function BeslissingShape({ selected, children }) {
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

/** Fork/join: dikke balk; `data.verticaal` kantelt hem. */
function ForkShape({ element, selected, children }) {
  const verticaal = !!element?.data?.verticaal;
  const rand = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  return (
    <div
      className="dc-punt-node"
      style={{
        width: verticaal ? 10 : 140,
        height: verticaal ? 140 : 10,
        background: DONKER,
        border: `1.5px solid ${rand}`,
        borderRadius: 3,
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}

/** Object node: strakke rechthoek met de naam gecentreerd. */
function ObjectShape({ element, elementType, selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "#94a3b8";
  return (
    <div
      className="dc-zacht-handles"
      style={{
        width: "100%",
        height: "100%",
        minWidth: 120,
        minHeight: 44,
        border: `2px solid ${rand}`,
        background: element?.data?.kleur || elementType?.kleur || "#f1f5f9",
        boxSizing: "border-box",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", padding: "0 10px", textAlign: "center" }}>
        {element?.naam || "(object)"}
      </div>
      {children}
    </div>
  );
}

/** Pin: klein vierkantje op de rand van een actie (in-/output, §3.1). */
function PinShape({ selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  return (
    <div
      className="dc-punt-node"
      style={{
        width: 12,
        height: 12,
        background: "var(--s-panel, #fff)",
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

/** Partitie (swimlane): container met naamstrook; leden via slepen (bevat). */
function PartitieShape({ element, selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "#94a3b8";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 200,
        minHeight: 280,
        border: `2px solid ${rand}`,
        borderRadius: 4,
        background: element?.data?.kleur ? `${element.data.kleur}22` : "rgba(148, 163, 184, 0.07)",
        boxSizing: "border-box",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "5px 12px",
          borderBottom: "1px solid #cbd5e1",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--s-fg, #0f172a)",
          textAlign: "center",
        }}
      >
        {element?.naam || "(partitie)"}
      </div>
      {children}
    </div>
  );
}

let _geregistreerd = false;
export function registreerActivityShapes() {
  if (_geregistreerd) return;
  registreerShape("act-begin", BeginShape);
  registreerShape("act-eind", EindShape);
  registreerShape("act-flow-eind", FlowEindShape);
  registreerShape("act-beslissing", BeslissingShape);
  registreerShape("act-fork", ForkShape);
  registreerShape("act-object", ObjectShape);
  registreerShape("act-pin", PinShape);
  registreerShape("act-partitie", PartitieShape);
  _geregistreerd = true;
}
