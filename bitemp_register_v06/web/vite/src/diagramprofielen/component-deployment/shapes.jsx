/**
 * Shapes voor component & deployment: alleen de **node** (3D-doos) is
 * eigen; component, interface, artifact gebruiken de class-box (met
 * stereotype en compartimenten) en de poort hergebruikt `sysml-poort`.
 *
 * `children` bevat de React Flow-handles (+ resizer) uit ElementNode — die
 * móéten gerenderd worden, anders kan geen verbinding aanhechten.
 */
import React from "react";
import { registreerShape } from "../../diagramcore/shapes/shapeRegistry.js";
import { registreerSysmlShapes } from "../sysml/shapes.jsx";

const DIEPTE = 10;

/** Node/device/execution environment: UML-kubus met de naam voorop. */
function NodeShape({ element, elementType, selected, children }) {
  const d = element?.data || {};
  const lijn = selected ? "var(--dc-selectie, #2563eb)" : "var(--dc-lijn, #334155)";
  const vulling = d.kleur || elementType?.kleur || "#e2e8f0";
  const stereotype = d.stereotype ? `«${d.stereotype}»` : elementType?.stereotype || "";
  return (
    <div
      className="dc-node"
      style={{
        width: "100%",
        height: "100%",
        minWidth: 160,
        minHeight: 90,
        position: "relative",
        background: "transparent",
        border: "none",
        boxShadow: "none",
        boxSizing: "border-box",
        paddingTop: DIEPTE,
        paddingRight: DIEPTE,
      }}
    >
      {/* De kubus: voorvlak + boven- en zijvlak, schaalt mee met de node. */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <polygon points="0,10 90,10 90,60 0,60" fill={vulling} stroke={lijn} strokeWidth={selected ? 1.8 : 1.2} vectorEffect="non-scaling-stroke" />
        <polygon points="0,10 10,0 100,0 90,10" fill={vulling} stroke={lijn} strokeWidth={selected ? 1.8 : 1.2} vectorEffect="non-scaling-stroke" opacity="0.85" />
        <polygon points="90,10 100,0 100,50 90,60" fill={vulling} stroke={lijn} strokeWidth={selected ? 1.8 : 1.2} vectorEffect="non-scaling-stroke" opacity="0.7" />
      </svg>
      <div className="dc-node-header" style={{ position: "relative", textAlign: "center", padding: "6px 10px 2px" }}>
        {stereotype ? <div className="dc-stereotype">{stereotype}</div> : null}
        <div className="dc-naam" style={{ fontSize: 13, fontWeight: 700 }} data-dc-naam="">
          {element?.naam || "(node)"}
        </div>
      </div>
      {children}
    </div>
  );
}

let _geregistreerd = false;
export function registreerComponentDeploymentShapes() {
  if (_geregistreerd) return;
  registreerSysmlShapes(); // sysml-poort
  registreerShape("cd-node", NodeShape);
  _geregistreerd = true;
}
