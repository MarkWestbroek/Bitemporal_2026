/**
 * ArchiMate-shapes: één `archimate-box` voor (vrijwel) alle elementen —
 * rechthoek in de laag-kleur met het type-icoon rechtsboven; gedrag krijgt
 * afgeronde hoeken (elementType.hoekRadius), structuur rechte. Plus de
 * junction (kleine stip; `data.soort` "of" = open).
 *
 * `children` bevat de React Flow-handles (+ resizer) — altijd renderen.
 */
import React from "react";
import { registreerShape } from "../../diagramcore/shapes/shapeRegistry.js";
import { TypeIcoon } from "../../diagramcore/shapes/typeIconen.jsx";

const DONKER = "#334155";

function ArchimateBoxShape({ element, elementType, selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "#94a3b8";
  const vulling = element?.data?.kleur || elementType?.kleur || "#f1f5f9";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 140,
        minHeight: 48,
        border: `1.5px solid ${rand}`,
        borderRadius: elementType?.hoekRadius ?? 2,
        background: vulling,
        boxSizing: "border-box",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 22px 6px 10px",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis" }}>
        {element?.naam || `(${elementType?.label || "?"})`}
      </div>
      {/* Type-icoon rechtsboven — de kern van de ArchiMate-vormgrammatica. */}
      <span style={{ position: "absolute", top: 3, right: 4, color: "#475569", pointerEvents: "none" }}>
        <TypeIcoon elementType={elementType} maat={13} />
      </span>
      {children}
    </div>
  );
}

/** Junction: stip — `data.soort` "of" tekent hem open (or-junction). */
function JunctionShape({ element, selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  const open = element?.data?.soort === "of";
  return (
    <div
      className="dc-punt-node"
      style={{
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: open ? "var(--s-panel, #fff)" : DONKER,
        border: `1.5px solid ${rand}`,
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}

let _geregistreerd = false;
export function registreerArchimateShapes() {
  if (_geregistreerd) return;
  registreerShape("archimate-box", ArchimateBoxShape);
  registreerShape("archimate-junction", JunctionShape);
  _geregistreerd = true;
}
