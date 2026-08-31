/**
 * SysML-shapes. Twee stuks — de rest van het profiel draait op de bestaande
 * class-box, package en note:
 *
 *   - **requirement**: de «requirement»-doos met `id` en `tekst` uit `data`.
 *     SysML tekent die twee als compartimenten, maar het zijn per requirement
 *     precies één id en één tekst — dus properties, geen velden-lijsten. Zo
 *     hoeft de gebruiker geen compartiment aan te maken voor iets dat er
 *     altijd één keer is.
 *   - **poort**: het vierkantje óp de rand van een blok of part (ibd). Klein
 *     en naamloos van zichzelf; de naam hangt eronder via het
 *     buitenlabel-primitief (`naamLabel: "buiten"`).
 *
 * `children` bevat de React Flow-handles (+ resizer/badge) — altijd renderen.
 */
import React from "react";
import { registreerShape } from "../../diagramcore/shapes/shapeRegistry.js";

const LIJN = "var(--dc-lijn, #334155)";
const OPEN = "var(--dc-marker-vulling, #ffffff)";

/** «requirement»-doos: kop, dan id en tekst. */
function RequirementShape({ element, elementType, selected, children }) {
  const d = element?.data || {};
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "var(--dc-node-rand, #94a3b8)";
  return (
    <div
      className="dc-node"
      style={{
        border: `2px solid ${rand}`,
        backgroundColor: d.kleur || elementType?.kleur || "#ede9fe",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
      <div className="dc-node-header">
        <div className="dc-stereotype">«requirement»</div>
        <div className="dc-naam" style={{ fontSize: 13 }}>{element?.naam || "(naamloos)"}</div>
      </div>
      <div className="dc-divider" />
      <div className="dc-compartiment" style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10.5, color: "#4c1d95" }}>
          id = {d.reqId || "…"}
        </div>
        <div style={{ fontSize: 11, color: "#334155", lineHeight: 1.35, overflowWrap: "anywhere" }}>
          text = {d.tekst || <span style={{ color: "#a8a29e", fontStyle: "italic" }}>(nog geen tekst)</span>}
        </div>
      </div>
    </div>
  );
}

/**
 * Poort (ibd): klein vierkantje dat op de rand van zijn gastheer klemt. De
 * `soort` bepaalt het pijltje erin: een proxy port heeft geen richting, een
 * flow port wel (in/uit).
 */
function PoortShape({ element, selected, children }) {
  const d = element?.data || {};
  const kleur = selected ? "var(--dc-selectie, #2563eb)" : LIJN;
  const richting = d.richting || "";
  return (
    <div className="dc-punt-node" style={{ width: 16, height: 16, position: "relative", boxSizing: "border-box" }}>
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ display: "block", pointerEvents: "none" }}>
        <rect x="1.5" y="1.5" width="13" height="13" fill={OPEN} stroke={kleur} strokeWidth="1.4" />
        {richting === "in" && <path d="M4 8 H11 M8.5 5 L11.5 8 L8.5 11" fill="none" stroke={kleur} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />}
        {richting === "uit" && <path d="M12 8 H5 M7.5 5 L4.5 8 L7.5 11" fill="none" stroke={kleur} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      {children}
    </div>
  );
}

let _geregistreerd = false;
export function registreerSysmlShapes() {
  if (_geregistreerd) return;
  registreerShape("sysml-requirement", RequirementShape);
  registreerShape("sysml-poort", PoortShape);
  _geregistreerd = true;
}
