/**
 * Requirements-shape: één doos voor requirement/feature/issue/change — kop
 * met stereotype (soort) en naam, een id-regel, de tekst, en onderaan de
 * status/prioriteit als kleine badges. De kleur per type komt uit de
 * descriptor; EA-kleuren overschrijven via `data.kleur`.
 */
import React from "react";
import { registreerShape } from "../../diagramcore/shapes/shapeRegistry.js";

const BADGE = {
  fontSize: 9.5,
  padding: "1px 6px",
  borderRadius: 8,
  background: "rgba(15, 23, 42, 0.07)",
  color: "#334155",
  whiteSpace: "nowrap",
};

function EisShape({ element, elementType, selected, children }) {
  const d = element?.data || {};
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "var(--dc-node-rand, #94a3b8)";
  const afgeleid = elementType?.hooks?.stereotype?.(element);
  const stereotype = afgeleid !== undefined ? afgeleid || elementType?.stereotype : d.stereotype ? `«${d.stereotype}»` : elementType?.stereotype;
  const badges = [d.status, d.prioriteit && `prio ${d.prioriteit}`, d.moeilijkheid && `moeilijkheid ${d.moeilijkheid}`].filter(Boolean);
  return (
    <div
      className="dc-node"
      style={{
        border: `2px solid ${rand}`,
        backgroundColor: d.kleur || elementType?.kleur || "#ede9fe",
        display: "flex",
        flexDirection: "column",
        minWidth: 180,
      }}
    >
      {children}
      <div className="dc-node-header">
        <div className="dc-stereotype">{stereotype || ""}</div>
        <div className="dc-naam" style={{ fontSize: 13 }} data-dc-naam="">
          {element?.naam || "(naamloos)"}
        </div>
      </div>
      {(d.reqId || d.tekst) && <div className="dc-divider" />}
      {(d.reqId || d.tekst) && (
        <div className="dc-compartiment" style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {d.reqId ? (
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10.5, color: "#4c1d95" }}>id = {d.reqId}</div>
          ) : null}
          {d.tekst ? (
            <div style={{ fontSize: 11, color: "#334155", lineHeight: 1.35, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{d.tekst}</div>
          ) : null}
        </div>
      )}
      {badges.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: "3px 8px 5px" }}>
          {badges.map((b) => (
            <span key={b} style={BADGE}>
              {b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

let _geregistreerd = false;
export function registreerRequirementsShapes() {
  if (_geregistreerd) return;
  registreerShape("rq-eis", EisShape);
  _geregistreerd = true;
}
