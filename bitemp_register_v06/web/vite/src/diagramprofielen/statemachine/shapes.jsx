/**
 * State machine-shapes: het begin- (gevulde stip) en eind-pseudotoestand
 * (ring met kern). Klein en naamloos — de core rendert `children` (naam),
 * die we hier bewust weglaten.
 */
import React from "react";
import { registreerShape } from "../../diagramcore/shapes/shapeRegistry.js";

const DONKER = "#334155";

// `children` bevat de React Flow-handles (+ resizer) uit ElementNode — die
// móéten gerenderd worden, anders kan geen transitie aanhechten.
function BeginShape({ selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: DONKER,
        border: `${selected ? 2.5 : 1.5}px solid ${rand}`,
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}

function EindShape({ selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  return (
    <div
      style={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        background: "var(--s-panel, #fff)",
        border: `${selected ? 2.5 : 1.5}px solid ${rand}`,
        boxSizing: "border-box",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: 12, height: 12, borderRadius: "50%", background: DONKER, pointerEvents: "none" }} />
      {children}
    </div>
  );
}

let _geregistreerd = false;
export function registreerStateMachineShapes() {
  if (_geregistreerd) return;
  registreerShape("sm-begin", BeginShape);
  registreerShape("sm-eind", EindShape);
  _geregistreerd = true;
}
