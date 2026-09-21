/**
 * Use case-shapes: actor (strekfiguur met naam eronder), use case (ellips
 * met naam erin) en het systeemkader (rechthoek met naamstrook).
 *
 * `children` bevat de React Flow-handles (+ resizer) uit ElementNode — die
 * móéten gerenderd worden, anders kan geen verbinding aanhechten.
 */
import React from "react";
import { registreerShape } from "../../diagramcore/shapes/shapeRegistry.js";

const DONKER = "#334155";

/** Actor: UML-strekfiguur, naam eronder. Vaste, compacte maat. */
function ActorShape({ element, selected, children }) {
  const lijn = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  return (
    <div
      style={{
        width: 64,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <svg width="34" height="52" viewBox="0 0 34 52" style={{ display: "block", pointerEvents: "none" }}>
        <circle cx="17" cy="8" r="6.5" fill="var(--s-panel, #fff)" stroke={lijn} strokeWidth="2" />
        {/* romp, armen, benen */}
        <path
          d="M17 14.5 V32 M4 21 H30 M17 32 L7 48 M17 32 L27 48"
          fill="none"
          stroke={lijn}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--s-fg, #0f172a)",
          textAlign: "center",
          maxWidth: 120,
          lineHeight: 1.25,
          overflowWrap: "anywhere",
        }}
      >
        {element?.naam || "(actor)"}
      </div>
      {children}
    </div>
  );
}

/** Use case: ellips met de naam gecentreerd. */
function EllipsShape({ element, elementType, selected, children }) {
  const lijn = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  const vulling = element?.data?.kleur || elementType?.kleur || "#e0f2fe";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 150,
        minHeight: 60,
        // Zelfde breedtegrens als .dc-node: een lange use case-naam wrapt
        // i.p.v. de ellips eindeloos uit te rekken. Een handmatig geresizede
        // node krijgt --dc-node-max: none en is dus weer vrij.
        maxWidth: "var(--dc-node-max, 280px)",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      {/* De ellips schaalt mee met de node (resizebaar). */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <ellipse cx="50" cy="20" rx="49" ry="19" fill={vulling} stroke={lijn} strokeWidth={selected ? 1.6 : 1} vectorEffect="non-scaling-stroke" />
      </svg>
      <div
        style={{
          position: "relative",
          fontSize: 12,
          fontWeight: 600,
          color: "#0f172a",
          textAlign: "center",
          padding: "0 18px",
          lineHeight: 1.3,
          overflowWrap: "anywhere",
        }}
      >
        {element?.naam || "(use case)"}
      </div>
      {children}
    </div>
  );
}

/** Systeemkader: rechthoek met de systeemnaam bovenin (bevat use cases). */
function SysteemShape({ element, selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "#94a3b8";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 220,
        minHeight: 160,
        border: `2px solid ${rand}`,
        borderRadius: 6,
        background: element?.data?.kleur ? `${element.data.kleur}22` : "rgba(148, 163, 184, 0.08)",
        boxSizing: "border-box",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "5px 12px",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--s-fg, #0f172a)",
          textAlign: "center",
          borderBottom: "1px solid #cbd5e1",
        }}
      >
        {element?.naam || "(systeem)"}
      </div>
      {children}
    </div>
  );
}

let _geregistreerd = false;
export function registreerUseCaseShapes() {
  if (_geregistreerd) return;
  registreerShape("uc-actor", ActorShape);
  registreerShape("uc-ellips", EllipsShape);
  registreerShape("uc-systeem", SysteemShape);
  _geregistreerd = true;
}
