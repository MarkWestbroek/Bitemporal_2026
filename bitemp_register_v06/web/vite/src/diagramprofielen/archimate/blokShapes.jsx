/**
 * archimate/blokShapes — de vormen van de shape-set "Blokken (informeel)"
 * (blokSet.js): `am-blok` (effen afgerond blok, naam gecentreerd, geen
 * type-icoon) en `am-blok-laag` (licht laagkader, naam linksboven).
 *
 * `children` bevat de React Flow-handles (+ resizer) — altijd renderen.
 */
import React from "react";
import { registreerShape } from "../../diagramcore/shapes/shapeRegistry.js";

function BlokShape({ element, elementType, selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "#a5b4fc";
  const vulling = element?.data?.kleur || elementType?.kleur || "#eef2ff";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 120,
        minHeight: 40,
        border: `1.5px solid ${rand}`,
        borderRadius: 10,
        background: vulling,
        boxSizing: "border-box",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 12px",
      }}
    >
      <div data-dc-naam="" style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", textAlign: "center" }}>
        {element?.naam || `(${elementType?.label || "?"})`}
      </div>
      {children}
    </div>
  );
}

function BlokLaagShape({ element, selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : element?.data?.kleur || "#cbd5e1";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 200,
        minHeight: 90,
        border: `1.5px solid ${rand}`,
        borderRadius: 8,
        background: element?.data?.achtergrondKleur || "rgba(248, 250, 252, 0.85)",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      <div
        data-dc-naam=""
        style={{ position: "absolute", top: 5, left: 10, fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: ".02em", cursor: "text" }}
      >
        {element?.naam || "(laag)"}
      </div>
      {children}
    </div>
  );
}

let _geregistreerd = false;
export function registreerArchimateBlokShapes() {
  if (_geregistreerd) return;
  registreerShape("am-blok", BlokShape);
  registreerShape("am-blok-laag", BlokLaagShape);
  _geregistreerd = true;
}
