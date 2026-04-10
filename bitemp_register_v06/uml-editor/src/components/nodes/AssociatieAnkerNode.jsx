/**
 * AssociatieAnkerNode — Klein cirkelvormig ankerpunt op de associatielijn A—B.
 *
 * Dit is het middelste punt van de UML association class constructie:
 *
 *    [A] ——— o ——— [B]
 *                :
 *            [REL node]
 *
 * Het ankerpunt is verplaatsbaar (draggable) en verbindt drie edges:
 *   1. A → o  (associatie, solid)
 *   2. o → B  (associatie, solid, optioneel directional arrow)
 *   3. o ╌╌ REL (association class link, dashed)
 *
 * Handles op alle 4 zijden (boven/onder/links/rechts) voor flexibele routing.
 * Elke zijde heeft zowel een source als target handle zodat edges uit elke
 * richting kunnen aansluiten (8 handles totaal). De handles zijn onzichtbaar
 * en niet-interactief zodat de node zelf versleepbaar blijft.
 */
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

const ANKER_SIZE = 14;

// Handles zijn onzichtbaar en niet-interactief zodat de node zelf versleepbaar
// blijft. Edges worden via het edge-edit-paneel op specifieke handles aangesloten.
const handleStyle = { opacity: 0, width: 3, height: 3, minWidth: 0, minHeight: 0, pointerEvents: "none" };

function AssociatieAnkerNode({ id, data, selected }) {
  const borderColor = selected ? "#2563eb" : "#94a3b8";
  const fillColor = selected ? "#dbeafe" : "#f1f5f9";

  return (
    <div
      className="asoc-anker-node"
      style={{
        width: ANKER_SIZE,
        height: ANKER_SIZE,
        borderRadius: "50%",
        border: `2px solid ${borderColor}`,
        backgroundColor: fillColor,
        cursor: "grab",
        position: "relative",
      }}
    >
      <Handle type="target" position={Position.Top} id="target-top" style={handleStyle} />
      <Handle type="source" position={Position.Top} id="source-top" style={handleStyle} />
      <Handle type="target" position={Position.Bottom} id="target-bottom" style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" style={handleStyle} />
      <Handle type="target" position={Position.Left} id="target-left" style={handleStyle} />
      <Handle type="source" position={Position.Left} id="source-left" style={handleStyle} />
      <Handle type="target" position={Position.Right} id="target-right" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="source-right" style={handleStyle} />
    </div>
  );
}

export default memo(AssociatieAnkerNode);
