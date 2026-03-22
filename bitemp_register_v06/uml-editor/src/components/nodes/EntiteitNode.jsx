/**
 * EntiteitNode — UML class-box voor een Entiteit.
 *
 * Visuele structuur:
 *   ┌─────────────────────────┐
 *   │  «entiteit»             │  ← stereotype-label
 *   │  A                      │  ← typenaam (bold)
 *   ├─────────────────────────┤
 *   │  id : integer {PK}     │  ← velden (attributen)
 *   │  ...                    │
 *   └─────────────────────────┘
 *
 * React Flow maakt deze component aan wanneer een node type="entiteit" heeft.
 * De `data` prop bevat alle metamodel-gegevens (typenaam, velden, kleur, etc.).
 *
 * Handles:
 *   - Bottom source handle: hier vertrekken edges naar onderliggende GE's/relaties
 *   - Top target handle: hier komen edges binnen (niet typisch voor entiteiten, maar voor flexibiliteit)
 */
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

function EntiteitNode({ data, selected }) {
  const borderColor = selected ? "#2563eb" : "#94a3b8";

  return (
    <div
      className="metamodel-node entiteit-node"
      style={{
        borderColor,
        backgroundColor: data.kleur || "#bfdbfe",
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

      {/* Header: stereotype + typenaam */}
      <div className="node-header">
        <div className="node-stereotype">«entiteit»</div>
        <div className="node-typenaam">{data.typenaam || "(naamloos)"}</div>
        {data.isMaterieel && (
          <div className="node-badge materieel">materieel</div>
        )}
      </div>

      {/* Scheidingslijn */}
      <div className="node-divider" />

      {/* Velden (attributen) */}
      <div className="node-velden">
        {(data.velden || []).length === 0 ? (
          <div className="node-veld leeg">— geen velden —</div>
        ) : (
          data.velden.map((v, i) => (
            <div key={i} className="node-veld">
              <span className="veld-naam">
                {v.verplicht ? (
                  <strong>{v.naam}</strong>
                ) : (
                  <span>{v.naam}</span>
                )}
              </span>
              <span className="veld-type">
                {v.enumNaam || v.type}
                {!v.enumNaam && v.format ? ` «${v.format}»` : ""}
                {v.autoIncrement ? " {AI}" : ""}
                {!v.enumNaam && v.enum ? ` {${v.enum.join("|")}}` : ""}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default memo(EntiteitNode);
