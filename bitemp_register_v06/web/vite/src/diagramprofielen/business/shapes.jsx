/**
 * Eriksson-Penker-shapes: proces (pijlvorm/chevron), doel (schietschijf-
 * ellips), resource (doos met een groot icoon per soort), gebeurtenis
 * (bliksem-plaat). Elke shape draagt zijn icoon ín de vorm — "mooie
 * icoontjes" (Mark). De actor hergebruikt `uc-actor`.
 *
 * `children` bevat de React Flow-handles (+ resizer) uit ElementNode — die
 * móéten gerenderd worden, anders kan geen verbinding aanhechten.
 */
import React from "react";
import { registreerShape } from "../../diagramcore/shapes/shapeRegistry.js";
import { registreerUseCaseShapes } from "../usecase/shapes.jsx";

const LIJN = "var(--dc-lijn, #334155)";
const lijnKleur = (selected) => (selected ? "var(--dc-selectie, #2563eb)" : LIJN);
const vulling = (element, elementType, fallback) => element?.data?.kleur || elementType?.kleur || fallback;

/** Naam + optioneel stereotype, gecentreerd. */
function Naam({ element, elementType, kleur = "#0f172a", maat = 12 }) {
  const d = element?.data || {};
  const stereotype = d.stereotype ? `«${d.stereotype}»` : elementType?.stereotype || "";
  return (
    <div style={{ position: "relative", textAlign: "center", lineHeight: 1.25, color: kleur }}>
      {stereotype ? <div style={{ fontSize: 10, opacity: 0.75 }}>{stereotype}</div> : null}
      <div style={{ fontSize: maat, fontWeight: 600, overflowWrap: "anywhere" }} data-dc-naam="">
        {element?.naam || `(${elementType?.label?.toLowerCase() || "naamloos"})`}
      </div>
    </div>
  );
}

/** Proces: de EP-chevron — punt rechts, inkeping links. */
function ProcesShape({ element, elementType, selected, children }) {
  const lijn = lijnKleur(selected);
  return (
    <div style={{ width: "100%", height: "100%", minWidth: 180, minHeight: 64, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", padding: "6px 28px 6px 30px" }}>
      <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <polygon points="0,0 88,0 100,20 88,40 0,40 12,20" fill={vulling(element, elementType, "#dbeafe")} stroke={lijn} strokeWidth={selected ? 1.8 : 1.2} vectorEffect="non-scaling-stroke" />
      </svg>
      {/* Het proces-icoon linksboven in de vorm. */}
      <svg width="16" height="16" viewBox="0 0 14 14" style={{ position: "absolute", left: 16, top: 6, pointerEvents: "none" }}>
        <path d="M1.5 3 H9.5 L12.5 7 L9.5 11 H1.5 L4 7 Z" fill={lijn} opacity="0.35" />
      </svg>
      <Naam element={element} elementType={elementType} />
      {children}
    </div>
  );
}

/** Doel: ellips met schietschijf-icoon. */
function DoelShape({ element, elementType, selected, children }) {
  const lijn = lijnKleur(selected);
  return (
    <div style={{ width: "100%", height: "100%", minWidth: 150, minHeight: 60, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", padding: "6px 22px 6px 34px" }}>
      <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <ellipse cx="50" cy="20" rx="49" ry="19" fill={vulling(element, elementType, "#fef9c3")} stroke={lijn} strokeWidth={selected ? 1.6 : 1} vectorEffect="non-scaling-stroke" />
      </svg>
      <svg width="18" height="18" viewBox="0 0 14 14" style={{ position: "absolute", left: 14, top: "50%", marginTop: -9, pointerEvents: "none" }}>
        <circle cx="7" cy="7" r="5.5" fill="none" stroke={lijn} strokeWidth="1.2" />
        <circle cx="7" cy="7" r="3" fill="none" stroke={lijn} strokeWidth="1.2" />
        <circle cx="7" cy="7" r="1.2" fill={lijn} />
      </svg>
      <Naam element={element} elementType={elementType} />
      {children}
    </div>
  );
}

/** De drie resource-iconen (groot, in de doos). */
const RESOURCE_ICOON = {
  fysiek: (k) => (
    <>
      <path d="M2 5 H12 V12 H2 Z M2 5 L4 2.5 H10 L12 5 M7 5 V12" fill="none" stroke={k} strokeWidth="1.1" />
    </>
  ),
  mensen: (k) => (
    <>
      <circle cx="7" cy="3.2" r="1.9" fill={k} />
      <path d="M7 5.5 V9 M3.5 7 H10.5 M7 9 L4.5 12.8 M7 9 L9.5 12.8" fill="none" stroke={k} strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  informatie: (k) => (
    <>
      <path d="M3 1.5 H8.5 L11.5 4.5 V12.5 H3 Z M8.5 1.5 V4.5 H11.5" fill="none" stroke={k} strokeWidth="1.1" />
      <circle cx="7.2" cy="6.6" r="0.8" fill={k} />
      <path d="M7.2 8.2 V11" stroke={k} strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
};

/** Resource: rechthoek met groot soort-icoon links en de naam rechts. */
function ResourceShape({ element, elementType, selected, children }) {
  const lijn = lijnKleur(selected);
  const icoon = RESOURCE_ICOON[elementType?.id] || RESOURCE_ICOON.fysiek;
  return (
    <div
      className="dc-node"
      style={{
        minWidth: 150,
        minHeight: 48,
        border: `2px solid ${lijn}`,
        borderRadius: 6,
        backgroundColor: vulling(element, elementType, "#dcfce7"),
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
      }}
    >
      {children}
      <svg width="28" height="28" viewBox="0 0 14 14" style={{ flexShrink: 0, pointerEvents: "none" }}>
        {icoon(lijn)}
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Naam element={element} elementType={elementType} />
        {element?.data?.hoeveelheid ? (
          <div style={{ fontSize: 10, color: "#475569", textAlign: "center" }}>{element.data.hoeveelheid}</div>
        ) : null}
      </div>
    </div>
  );
}

/** Gebeurtenis: afgeschuinde plaat met bliksem. */
function GebeurtenisShape({ element, elementType, selected, children }) {
  const lijn = lijnKleur(selected);
  return (
    <div style={{ width: "100%", height: "100%", minWidth: 150, minHeight: 52, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", padding: "6px 16px 6px 34px" }}>
      <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <polygon points="8,0 100,0 92,40 0,40" fill={vulling(element, elementType, "#fef3c7")} stroke={lijn} strokeWidth={selected ? 1.8 : 1.2} vectorEffect="non-scaling-stroke" />
      </svg>
      <svg width="18" height="18" viewBox="0 0 14 14" style={{ position: "absolute", left: 14, top: "50%", marginTop: -9, pointerEvents: "none" }}>
        <path d="M8.5 1.5 L3.5 8 H7 L5.5 12.5 L10.5 6 H7 Z" fill="#f59e0b" stroke={lijn} strokeWidth="0.8" />
      </svg>
      <Naam element={element} elementType={elementType} />
      {children}
    </div>
  );
}

let _geregistreerd = false;
export function registreerBusinessShapes() {
  if (_geregistreerd) return;
  registreerUseCaseShapes(); // uc-actor
  registreerShape("ep-proces", ProcesShape);
  registreerShape("ep-doel", DoelShape);
  registreerShape("ep-resource", ResourceShape);
  registreerShape("ep-event", GebeurtenisShape);
  _geregistreerd = true;
}
