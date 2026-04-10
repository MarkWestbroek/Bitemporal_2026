/**
 * EnumeratieNode — klein blok voor enumeratie-definities.
 *
 *   ┌─────────────────────────┐
 *   │  «enumeratie»           │
 *   │  RelABSoort             │
 *   ├─────────────────────────┤
 *   │  LTT                    │
 *   │  LAT                    │
 *   │  LTA                    │
 *   └─────────────────────────┘
 */
import { memo } from "react";
import { Handle, NodeResizer, Position } from "@xyflow/react";

function EnumeratieNode({ data, selected }) {
  const borderColor = selected ? "#d97706" : "#94a3b8";

  return (
    <div
      className="metamodel-node enum-node"
      style={{
        borderColor,
        backgroundColor: "#fef3c7",
      }}
    >
      <NodeResizer
        minWidth={180}
        minHeight={70}
        isVisible={selected}
        lineStyle={{ borderColor }}
        handleStyle={{ width: 10, height: 10, borderRadius: 3, borderColor, background: "#ffffff" }}
      />
      {/* Handles op alle zijden */}
      <Handle type="target" position={Position.Top} id="target-top" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" />
      <Handle type="source" position={Position.Top} id="source-top" />
      <Handle type="target" position={Position.Bottom} id="target-bottom" />
      <Handle type="source" position={Position.Left} id="source-left" />
      <Handle type="target" position={Position.Left} id="target-left" />
      <Handle type="source" position={Position.Right} id="source-right" />
      <Handle type="target" position={Position.Right} id="target-right" />

      <div className="node-header">
        <div className="node-stereotype">«enumeratie»</div>
        <div className="node-typenaam">{data.naam || "(naamloos)"}</div>
      </div>

      <div className="node-divider" />

      <div className="node-velden">
        {(data.waarden || []).map((w, i) => (
          <div key={i} className="node-veld enum-waarde">
            {w}
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(EnumeratieNode);
