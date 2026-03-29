/**
 * ReferentielijstInstantieNode — UML-blok voor een referentielijst-instantie.
 *
 * Visuele structuur:
 *   ┌─────────────────────────┐
 *   │  «ref.lijst instantie»  │  ← stereotype-label
 *   │  Landenlijst            │  ← systeemnaam (bold)
 *   ├─────────────────────────┤
 *   │  naam: Landen            │
 *   │  omschrijving: ...       │
 *   └─────────────────────────┘
 *
 * Een instantie vertegenwoordigt een specifiek record van de generieke
 * Referentielijst-klasse (bijv. "Landenlijst", "EULidstaten").
 */
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

function ReferentielijstInstantieNode({ data, selected }) {
  const borderColor = selected ? "#2563eb" : "#94a3b8";

  return (
    <div
      className="metamodel-node refinstantie-node"
      style={{
        borderColor,
        backgroundColor: "#fef3c7", // amber-100 (zelfde als referentielijst)
      }}
    >
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="target" position={Position.Right} id="right" />

      {/* Header */}
      <div className="node-header">
        <div className="node-stereotype">«ref.lijst instantie»</div>
        <div className="node-typenaam">
          {data.systeemnaam || "(naamloos)"}
        </div>
      </div>

      {/* Scheidingslijn */}
      <div className="node-divider" />

      {/* Eigenschappen */}
      <div className="node-velden">
        <div className="node-veld">
          <span className="veld-naam">naam</span>
          <span className="veld-type">{data.naam || "—"}</span>
        </div>
        <div className="node-veld">
          <span className="veld-naam">omschrijving</span>
          <span className="veld-type">{data.omschrijving || "—"}</span>
        </div>
      </div>
    </div>
  );
}

export default memo(ReferentielijstInstantieNode);
