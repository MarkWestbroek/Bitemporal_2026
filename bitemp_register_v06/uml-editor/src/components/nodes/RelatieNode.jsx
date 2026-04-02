/**
 * RelatieNode — UML class-box voor een Relatie.
 *
 * Een relatie verbindt twee entiteiten. Visueel heeft het twee source handles
 * (links en rechts) voor de twee FK-verbindingen.
 *
 *   ┌─────────────────────────┐
 *   │  «relatie»              │
 *   │  Rel_A_B                │
 *   ├─────────────────────────┤
 *   │  a_id : integer {PFK}  │
 *   │  b_id : integer {FK}   │
 *   │  soort : string {enum} │
 *   └─────────────────────────┘
 *
 * Handles:
 *   - Top target: inkomende edge van primaire entiteit
 *   - Left source: uitgang richting primaire entiteit (alternatief)
 *   - Right source: uitgang richting secondaire entiteit
 *   - Bottom source: voor eventuele verdere relaties
 */
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { useOvergeerfdeVelden } from "../../hooks/useOvergeerfdeVelden";

function RelatieNode({ id, data, selected }) {
  const borderColor = selected ? "#7c3aed" : "#94a3b8";
  const overerving = useOvergeerfdeVelden(id);

  return (
    <div
      className="metamodel-node relatie-node"
      style={{
        borderColor,
        backgroundColor: data.kleur || "#ede9fe",
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
        <div className="node-stereotype">
          {data.relatieSubtype === "referentielijst_items"
            ? "«ref.lijst items»"
            : "«relatie»"}
        </div>
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

      {/* Afgeleide velden op relatie-niveau */}
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

      {/* Overgeërfde velden van supertype */}
      {overerving && overerving.velden.length > 0 && (
        <>
          <div className="node-divider" />
          <div className="node-velden overgeerfd">
            <div className="node-veld leeg" style={{ color: "#94a3b8", fontSize: "0.8em" }}>
              ↑ {overerving.supertypeNaam}
            </div>
            {overerving.velden.map((v, i) => (
              <div key={`ov-${i}`} className="node-veld" style={{ opacity: 0.5 }}>
                <span className="veld-naam">{v.naam}</span>
                <span className="veld-type">
                  {v.enumNaam || v.datatypeNaam || v.type}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default memo(RelatieNode);
