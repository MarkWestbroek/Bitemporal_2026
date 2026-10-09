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
 *   - taak: afgeronde rechthoek met taaktype-icoon linksboven;
 *   - data-object: dokje met omgevouwen hoek (verzameling = drie streepjes);
 *   - data store: cilinder;
 *   - lane: container met naamstrook (zoals de activity-partitie).
 *
 * `children` bevat de React Flow-handles (+ resizer/badge) — altijd renderen.
 */
import React from "react";
import { registreerShape } from "../../diagramcore/shapes/shapeRegistry.js";

// Lijn/vulling voor vormen die direct op het canvas staan (start/eind,
// balken, levenslijnen, randen): thema-variabele, in donker lichter
// (diagramcore.css --dc-lijn-slate-700; gemeld 2026-10-10).
const DONKER = "var(--dc-lijn-slate-700, #334155)";
// Iconen óp een lichte taakvulling blijven donker, ook in donker thema.
const DONKER_INKT = "#334155";

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
    case "escalatie":
      return <path {...s} d="M10 5.5 L14 13.5 L10 10.5 L6 13.5 Z" />;
    case "compensatie":
      return <path {...s} d="M10 10 L14 6.5 V13.5 Z M6 10 L10 6.5 V13.5 Z" />;
    case "conditioneel":
      return (
        <g {...s}>
          <rect x="6" y="5.5" width="8" height="9" rx="0.6" />
          <path d="M7.5 8 H12.5 M7.5 10 H12.5 M7.5 12 H12.5" />
        </g>
      );
    case "link":
      return <path {...s} d="M5.5 8 H10.5 V5.5 L14.5 10 L10.5 14.5 V12 H5.5 Z" />;
    case "annulering":
      return <path {...s} strokeWidth="1.8" d="M6.5 6.5 L13.5 13.5 M13.5 6.5 L6.5 13.5" />;
    case "terminate":
      return <circle cx="10" cy="10" r="4.2" fill={kleur} stroke="none" />;
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
    // Vult de node: een bewaarde maat (EA-import: 30 pt × 1,5 = 45px) is de
    // omtrek waar de lijnen op aanhechten; een vaste ring linksboven liet een
    // gat tussen lijn en ring (Mark, 10-10). Zonder maat: `maat` als minimum.
    <div className="dc-punt-node" style={{ width: "100%", height: "100%", minWidth: maat, minHeight: maat, position: "relative", boxSizing: "border-box" }}>
      <svg width="100%" height="100%" viewBox="0 0 20 20" style={{ display: "block", pointerEvents: "none" }}>
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
    // Vult de node (zie EventShape): EA-gateways zijn 42 pt × 1,5 = 63px.
    <div className="dc-punt-node" style={{ width: "100%", height: "100%", minWidth: 34, minHeight: 34, position: "relative", boxSizing: "border-box" }}>
      <svg width="100%" height="100%" viewBox="0 0 34 34" style={{ display: "block", pointerEvents: "none" }}>
        <path d="M17 2 L32 17 L17 32 L2 17 Z" fill="var(--s-panel, #fff)" stroke={kleur} strokeWidth={selected ? 2.2 : 1.5} />
        {soort === "exclusief" && <path {...sym} d="M12.5 12.5 L21.5 21.5 M21.5 12.5 L12.5 21.5" />}
        {soort === "parallel" && <path {...sym} d="M17 10.5 V23.5 M10.5 17 H23.5" />}
        {soort === "inclusief" && <circle cx="17" cy="17" r="5.6" {...sym} />}
        {/* Complex (✱) en event-based (ring met vijfhoek) — EA-aanvulling 10-10. */}
        {soort === "complex" && <path {...sym} d="M17 10.5 V23.5 M10.5 17 H23.5 M12.4 12.4 L21.6 21.6 M21.6 12.4 L12.4 21.6" />}
        {soort === "event-gateway" && (
          <>
            <circle cx="17" cy="17" r="6.6" {...sym} strokeWidth="1.2" />
            <path {...sym} strokeWidth="1.2" d="M17 12.6 L21.1 15.6 L19.5 20.4 H14.5 L12.9 15.6 Z" />
          </>
        )}
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
        // Uitgeklapt (met taken erin, `data.uitgeklapt`): naam linksboven, zoals
        // EA en bpmn.io; ingeklapt: gecentreerd.
        alignItems: element?.data?.uitgeklapt ? "flex-start" : "center",
        justifyContent: element?.data?.uitgeklapt ? "flex-start" : "center",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", textAlign: element?.data?.uitgeklapt ? "left" : "center" }}>
        {element?.naam || "(subproces)"}
      </div>
      {/* ⊞-markering (BPMN sub-process marker), gecentreerd onderaan. */}
      <svg width="12" height="12" viewBox="0 0 12 12" style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", pointerEvents: "none" }}>
        <rect x="0.8" y="0.8" width="10.4" height="10.4" rx="1.5" fill="none" stroke={DONKER_INKT} strokeWidth="1.1" />
        <path d="M6 3.2 V8.8 M3.2 6 H8.8" stroke={DONKER_INKT} strokeWidth="1.1" strokeLinecap="round" />
      </svg>
      {children}
    </div>
  );
}

/** Taaktype-icoontje linksboven in de taak (BPMN 2.0 §10.3; viewBox 0 0 16 16). */
function TaakIcoon({ soort, kleur }) {
  const s = { stroke: kleur, strokeWidth: 1.2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  switch (soort) {
    case "user":
      return (
        <g {...s}>
          <circle cx="8" cy="5" r="2.6" />
          <path d="M2.8 14 C3.3 10.6 5.3 9.2 8 9.2 C10.7 9.2 12.7 10.6 13.2 14" />
        </g>
      );
    case "service":
      return (
        <g {...s}>
          <circle cx="8" cy="8" r="2.2" />
          <path d="M8 2.2 V4 M8 12 V13.8 M2.2 8 H4 M12 8 H13.8 M3.9 3.9 L5.2 5.2 M10.8 10.8 L12.1 12.1 M12.1 3.9 L10.8 5.2 M5.2 10.8 L3.9 12.1" />
        </g>
      );
    case "send":
      return (
        <g {...s}>
          <rect x="2" y="4" width="12" height="8.5" rx="0.8" fill={kleur} />
          <path d="M2 4.5 L8 9 L14 4.5" stroke="var(--s-panel, #fff)" />
        </g>
      );
    case "receive":
      return (
        <g {...s}>
          <rect x="2" y="4" width="12" height="8.5" rx="0.8" />
          <path d="M2 4.5 L8 9 L14 4.5" />
        </g>
      );
    case "manual":
      return <path {...s} d="M3 9.5 V6.5 C3 5.5 4.4 5.5 4.4 6.5 V5 C4.4 4 5.8 4 5.8 5 V4.5 C5.8 3.5 7.2 3.5 7.2 4.5 V5.5 C7.2 4.5 8.6 4.5 8.6 5.5 V10 L10.5 8 C11.3 7.2 12.4 8.2 11.6 9 L8.8 12.8 C8.2 13.6 7.4 14 6.2 14 H5.6 C4 14 3 13 3 11.4 Z" />;
    case "script":
      return <path {...s} d="M11 2.5 C8.5 2.5 9 5 7 5.5 C5 6 5.5 8 7.5 8.5 C9.5 9 9 11 7 11.5 C5 12 5.5 13.5 3 13.5 M5.5 2.5 H11 M3.5 13.5 H9" />;
    case "businessRule":
      return (
        <g {...s}>
          <rect x="2" y="3.5" width="12" height="9" />
          <path d="M2 6.5 H14 M2 9.5 H14 M6 6.5 V12.5" />
          <rect x="2" y="3.5" width="12" height="3" fill={kleur} stroke="none" />
        </g>
      );
    default:
      return null;
  }
}

/** Taak: afgeronde rechthoek met het taaktype-icoon linksboven (`data.taakSoort`). */
function TaakShape({ element, elementType, selected, children }) {
  const d = element?.data || {};
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "#7dd3fc";
  const icoon = d.taakSoort ? <TaakIcoon soort={d.taakSoort} kleur={DONKER_INKT} /> : null;
  return (
    <div
      className="dc-node"
      style={{
        borderRadius: 10,
        border: `2px solid ${rand}`,
        backgroundColor: d.kleur || elementType?.kleur || "#e0f2fe",
        padding: icoon ? "16px 12px 8px" : "8px 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 48,
      }}
    >
      {icoon && (
        <svg width="16" height="16" viewBox="0 0 16 16" style={{ position: "absolute", top: 4, left: 6, pointerEvents: "none" }}>
          {icoon}
        </svg>
      )}
      <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", textAlign: "center", lineHeight: 1.25, overflowWrap: "anywhere" }} data-dc-naam="">
        {element?.naam || "(taak)"}
      </div>
      {children}
    </div>
  );
}

/** Data store: cilinder, naam eronder (EA DataStore: register, database, archief). */
function DataStoreShape({ element, selected, children }) {
  const kleur = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  return (
    <div style={{ width: 46, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <svg width="34" height="38" viewBox="0 0 34 38" style={{ display: "block", pointerEvents: "none" }}>
        <path d="M3 7 V31 A14 5 0 0 0 31 31 V7" fill="var(--s-panel, #fff)" stroke={kleur} strokeWidth="1.5" />
        <ellipse cx="17" cy="7" rx="14" ry="5" fill="var(--s-panel, #fff)" stroke={kleur} strokeWidth="1.5" />
        <path d="M3 12 A14 5 0 0 0 31 12 M3 17 A14 5 0 0 0 31 17" fill="none" stroke={kleur} strokeWidth="1" />
      </svg>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--s-fg, #0f172a)", textAlign: "center", width: "max-content", maxWidth: 120, lineHeight: 1.25, overflowWrap: "break-word" }}>
        {element?.naam || ""}
      </div>
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
        {/* Verzameling (isCollection): drie verticale streepjes onderaan. */}
        {element?.data?.verzameling && <path d="M11 27 V33 M15 27 V33 M19 27 V33" fill="none" stroke={kleur} strokeWidth="1.6" strokeLinecap="round" />}
      </svg>
      {/* Lange namen wrappen (geen ellipsis meer): een afgekapte naam is in een
          procesplaat onbruikbaar, een tweede regel kost niets. */}
      {/* width: max-content — anders krijgt het label de 46px van het dokje en
          breekt het per letter af ("Brondoc/ument", Mark 10-10); het steekt
          gecentreerd aan beide kanten uit. */}
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--s-fg, #0f172a)", textAlign: "center", width: "max-content", maxWidth: 120, lineHeight: 1.25, overflowWrap: "break-word" }}>
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

/**
 * Pool: zoals een lane, maar met de naam in een **staande band links** (de
 * BPMN-conventie voor een horizontale pool) en een stevigere rand — zo zie je
 * in één oogopslag wat afbakent (pool) en wat alleen indeelt (lane).
 */
function PoolShape({ element, selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "#64748b";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 320,
        minHeight: 160,
        border: `2px solid ${rand}`,
        borderRadius: 2,
        background: element?.data?.kleur ? `${element.data.kleur}1a` : "rgba(100, 116, 139, 0.05)",
        boxSizing: "border-box",
        position: "relative",
        display: "flex",
        flexDirection: "row",
      }}
    >
      <div
        style={{
          width: 30,
          flex: "0 0 30px",
          borderRight: `2px solid ${rand}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--s-fg, #0f172a)",
            whiteSpace: "nowrap",
          }}
        >
          {element?.naam || "(pool)"}
        </span>
      </div>
      <div style={{ flex: 1, position: "relative" }}>{children}</div>
    </div>
  );
}

let _geregistreerd = false;
export function registreerBpmnShapes() {
  if (_geregistreerd) return;
  registreerShape("bpmn-event", EventShape);
  registreerShape("bpmn-gateway", GatewayShape);
  registreerShape("bpmn-subproces", SubprocesShape);
  registreerShape("bpmn-taak", TaakShape);
  registreerShape("bpmn-data", DataObjectShape);
  registreerShape("bpmn-datastore", DataStoreShape);
  registreerShape("bpmn-lane", LaneShape);
  registreerShape("bpmn-pool", PoolShape);
  _geregistreerd = true;
}
