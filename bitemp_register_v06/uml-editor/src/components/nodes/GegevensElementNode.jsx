/**
 * GegevensElementNode — UML class-box voor een Gegevenselement.
 *
 * Visuele structuur:
 *   ┌─────────────────────────┐
 *   │  «gegevenselement»      │
 *   │  A_U                    │
 *   ├─────────────────────────┤
 *   │  a_id : integer {PFK}  │
 *   │  aaa  : string         │
 *   │  bbb  : boolean        │
 *   └─────────────────────────┘
 *
 * Handles:
 *   - Top target: inkomende edge van parent-entiteit
 *   - Bottom source: voor eventuele verdere relaties
 */
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

function GegevensElementNode({ data, selected }) {
  const borderColor = selected ? "#16a34a" : "#94a3b8";

  return (
    <div
      className="metamodel-node ge-node"
      style={{
        borderColor,
        backgroundColor: data.kleur || "#bbf7d0",
      }}
    >
      {/* Handles op alle zijden voor flexibele edge-aansluitingen */}
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="target" position={Position.Right} id="right" />

      <div className="node-header">
        <div className="node-stereotype">«gegevenselement»</div>
        <div className={`node-typenaam${data.isAbstract ? " abstract" : ""}`}>{data.klassenaam || data.typenaam || "(naamloos)"}</div>
        {data.isMaterieel && (
          <div className="node-badge materieel">materieel</div>
        )}
      </div>

      <div className="node-divider" />

      <div className="node-velden">
        {(data.velden || []).length === 0 ? (
          <div className="node-veld leeg">— geen velden —</div>
        ) : (
          data.velden.map((v, i) => (
            <div key={i} className="node-veld">
              <span className="veld-naam">
                {v.afgeleid && <span style={{ color: "#f59e0b" }}>/</span>}
                {v.verplicht ? (
                  <strong>{v.naam}</strong>
                ) : (
                  <span>{v.naam}</span>
                )}
              </span>
              <span className="veld-type">
                {v.enumNaam || v.datatypeNaam || v.refNaam || v.type}
                {!v.enumNaam && !v.datatypeNaam && !v.refNaam && v.format ? ` «${v.format}»` : ""}
                {v.autoIncrement ? " {AI}" : ""}
                {!v.enumNaam && v.enum ? ` {${v.enum.join("|")}}` : ""}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Afgeleide velden op GE-niveau */}
      {(data.afgeleideVelden || []).length > 0 && (
        <>
          <div className="node-divider" />
          <div className="node-velden">
            {data.afgeleideVelden.map((av, i) => (
              <div key={`av-${i}`} className="node-veld" style={{ fontStyle: "italic" }}>
                <span className="veld-naam">
                  <span style={{ color: "#f59e0b" }}>/</span>
                  {av.naam}
                </span>
                <span className="veld-type">{av.goType || "string"}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default memo(GegevensElementNode);
