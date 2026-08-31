/**
 * BPMN-shapes (eigen motor, v0):
 *
 *   - events: start (dunne ring), tussen (dubbele ring), eind (dikke ring),
 *     boundary (dubbele ring, rand-element). Grensoverschrijdend gedeeld:
 *     `data.soort` tekent het icoontje (bericht/timer/fout/signaal) en
 *     `data.onderbrekend === false` maakt de ring gestippeld
 *     (niet-onderbrekend boundary event);
 *   - gateways: één ruit-shape, het symbool volgt het elementtype
 *     (exclusief ×, parallel +, inclusief ○);
 *   - subproces: taak-rechthoek met ⊞-markering onderaan (doorklik via de
 *     gedragsverwijzing);
 *   - data-object: dokje met omgevouwen hoek;
 *   - lane: container met naamstrook (zoals de activity-partitie).
 *
 * `children` bevat de React Flow-handles (+ resizer/badge) — altijd renderen.
 */
import React from "react";
import { registreerShape } from "../../diagramcore/shapes/shapeRegistry.js";

const DONKER = "#334155";

/** Soort-icoontje ín een event (viewBox 0 0 20 20, currentColor = ring-kleur). */
function SoortIcoon({ soort, kleur }) {
  const s = { stroke: kleur, strokeWidth: 1.4, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  switch (soort) {
    case "bericht":
      return (
        <g {...s}>
          <rect x="5" y="6.5" width="10" height="7" rx="0.8" />
          <path d="M5 7 L10 10.5 L15 7" />
        </g>
      );
    case "timer":
      return (
        <g {...s}>
          <circle cx="10" cy="10" r="4.6" />
          <path d="M10 7.2 V10 L12 11.6" />
        </g>
      );
    case "fout":
      return <path {...s} d="M7 14 L9.2 8.5 L11 11.5 L13.2 6" />;
    case "signaal":
      return <path {...s} d="M10 6.2 L14 13.4 H6 Z" />;
    default:
      return null;
  }
}

/**
 * Event-ring: stijl per soort event (elementtype). `maat` uit de descriptor
 * zodat boundary iets kleiner is dan de vrije events.
 */
function EventShape({ element, elementType, selected, children }) {
  const kleur = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  const d = element?.data || {};
  const nietOnderbrekend = d.onderbrekend === false;
  const stippel = nietOnderbrekend ? { strokeDasharray: "3 2.4" } : {};
  const soortEvent = elementType?.id || "";
  const dubbel = soortEvent === "tussen-event" || soortEvent === "boundary-event";
  const dik = soortEvent === "eind-event";
  const maat = soortEvent === "boundary-event" ? 26 : 30;
  return (
    <div className="dc-punt-node" style={{ width: maat, height: maat, position: "relative", boxSizing: "border-box" }}>
      <svg width={maat} height={maat} viewBox="0 0 20 20" style={{ display: "block", pointerEvents: "none" }}>
        <circle cx="10" cy="10" r="9" fill="var(--s-panel, #fff)" stroke={kleur} strokeWidth={dik ? 2.6 : 1.3} {...stippel} />
        {dubbel && <circle cx="10" cy="10" r="7.1" fill="none" stroke={kleur} strokeWidth="1.1" {...stippel} />}
        <SoortIcoon soort={d.soort} kleur={kleur} />
      </svg>
      {children}
    </div>
  );
}

/** Gateway-ruit: het symbool volgt het elementtype (×, +, ○). */
function GatewayShape({ element, selected, children }) {
  const kleur = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  const soort = element?.elementType || "";
  const sym = { stroke: kleur, strokeWidth: 1.7, fill: "none", strokeLinecap: "round" };
  return (
    <div className="dc-punt-node" style={{ width: 34, height: 34, position: "relative", boxSizing: "border-box" }}>
      <svg width="34" height="34" viewBox="0 0 34 34" style={{ display: "block", pointerEvents: "none" }}>
        <path d="M17 2 L32 17 L17 32 L2 17 Z" fill="var(--s-panel, #fff)" stroke={kleur} strokeWidth={selected ? 2.2 : 1.5} />
        {soort === "exclusief" && <path {...sym} d="M12.5 12.5 L21.5 21.5 M21.5 12.5 L12.5 21.5" />}
        {soort === "parallel" && <path {...sym} d="M17 10.5 V23.5 M10.5 17 H23.5" />}
        {soort === "inclusief" && <circle cx="17" cy="17" r="5.6" {...sym} />}
      </svg>
      {children}
    </div>
  );
}

/** Subproces: taak-rechthoek met ⊞-markering onderaan (doorklik = ⧉-badge). */
function SubprocesShape({ element, elementType, selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "#7dd3fc";
  return (
    <div
      className="dc-node"
      style={{
        borderRadius: 10,
        border: `2px solid ${rand}`,
        backgroundColor: element?.data?.kleur || elementType?.kleur || "#e0f2fe",
        padding: "6px 12px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", textAlign: "center" }}>
        {element?.naam || "(subproces)"}
      </div>
      {/* ⊞-markering (BPMN sub-process marker), gecentreerd onderaan. */}
      <svg width="12" height="12" viewBox="0 0 12 12" style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", pointerEvents: "none" }}>
        <rect x="0.8" y="0.8" width="10.4" height="10.4" rx="1.5" fill="none" stroke={DONKER} strokeWidth="1.1" />
        <path d="M6 3.2 V8.8 M3.2 6 H8.8" stroke={DONKER} strokeWidth="1.1" strokeLinecap="round" />
      </svg>
      {children}
    </div>
  );
}

/** Data-object: dokje met omgevouwen hoek, naam eronder. */
function DataObjectShape({ element, selected, children }) {
  const kleur = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  return (
    <div style={{ width: 46, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <svg width="30" height="38" viewBox="0 0 30 38" style={{ display: "block", pointerEvents: "none" }}>
        <path d="M2 2 H20 L28 10 V36 H2 Z" fill="var(--s-panel, #fff)" stroke={kleur} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M20 2 V10 H28" fill="none" stroke={kleur} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {/* Lange namen wrappen (geen ellipsis meer): een afgekapte naam is in een
          procesplaat onbruikbaar, een tweede regel kost niets. */}
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--s-fg, #0f172a)", textAlign: "center", maxWidth: 110, lineHeight: 1.25, overflowWrap: "anywhere" }}>
        {element?.naam || ""}
      </div>
      {children}
    </div>
  );
}

/** Lane: container met naamstrook (zoals de activity-partitie). */
function LaneShape({ element, selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "#94a3b8";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 240,
        minHeight: 200,
        border: `2px solid ${rand}`,
        borderRadius: 4,
        background: element?.data?.kleur ? `${element.data.kleur}22` : "rgba(148, 163, 184, 0.07)",
        boxSizing: "border-box",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "5px 12px", borderBottom: "1px solid #cbd5e1", fontSize: 12, fontWeight: 700, color: "var(--s-fg, #0f172a)", textAlign: "center" }}>
        {element?.naam || "(lane)"}
      </div>
      {children}
    </div>
  );
}

let _geregistreerd = false;
export function registreerBpmnShapes() {
  if (_geregistreerd) return;
  registreerShape("bpmn-event", EventShape);
  registreerShape("bpmn-gateway", GatewayShape);
  registreerShape("bpmn-subproces", SubprocesShape);
  registreerShape("bpmn-data", DataObjectShape);
  registreerShape("bpmn-lane", LaneShape);
  _geregistreerd = true;
}
