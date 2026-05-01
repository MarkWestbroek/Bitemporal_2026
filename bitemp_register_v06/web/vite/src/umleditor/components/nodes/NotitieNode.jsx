/**
 * NotitieNode — Gele post-it sticker voor annotaties/opmerkingen in het diagram.
 *
 * Visuele structuur:
 *   ┌─────────────────────────────┐
 *   │ 📝  Notitie         [×]    │  ← header met sluit-icoon
 *   ├─────────────────────────────┤
 *   │  Hier staat de tekst van    │
 *   │  de notitie...              │
 *   └─────────────────────────────┘
 *
 * Eigenschappen:
 *  - `data.tekst`   — de inhoud (multiline vrije tekst)
 *  - `data.kleur`   — achtergrondkleur (standaard: #fffde7 geel)
 *  - `data.breedte` — breedte in pixels (als NodeResizer dit opslaat)
 *  - `data.hoogte`  — hoogte in pixels
 *
 * Handles op alle zijden zodat scope-edges (gestippeld grijs) kunnen aansluiten.
 * De handles zijn onzichtbaar en niet-interactief — notities verbinden niet
 * met andere nodes via modeledges. Scope-edges lopen NAAR de notitie, niet vanuit.
 *
 * C8: Onderdeel van de notities/constraints uitbreiding.
 */
import { memo } from "react";
import { Handle, NodeResizer, Position } from "@xyflow/react";

// Handles zijn lichtgrijs zichtbaar zodat scope-edges eraan kunnen beginnen/eindigen
const handleStyle = {
  width: 8,
  height: 8,
  background: "#fbbf24",
  border: "2px solid #d97706",
  borderRadius: "50%",
  opacity: 0.75,
  minWidth: 0,
  minHeight: 0,
};

function NotitieNode({ id, data, selected }) {
  const bg = data.kleur || "#fffde7";
  const borderColor = selected ? "#f59e0b" : "#fbbf24";

  return (
    <div
      className="metamodel-node notitie-node"
      style={{
        minWidth: 160,
        minHeight: 60,
        padding: 0,
        borderRadius: 4,
        border: `2px solid ${borderColor}`,
        backgroundColor: bg,
        boxShadow: selected
          ? "2px 3px 8px rgba(245,158,11,0.4)"
          : "2px 3px 6px rgba(0,0,0,0.25)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      <NodeResizer
        minWidth={140}
        minHeight={56}
        isVisible={selected}
        lineStyle={{ borderColor: "#f59e0b" }}
        handleStyle={{ width: 10, height: 10, borderRadius: 3, borderColor: "#f59e0b", background: "#ffffff" }}
      />

      {/* Handles op alle zijden (onzichtbaar — voor scope-edges) */}
      <Handle type="target" position={Position.Top}    id="target-top"    style={handleStyle} />
      <Handle type="target" position={Position.Bottom} id="target-bottom" style={handleStyle} />
      <Handle type="target" position={Position.Left}   id="target-left"   style={handleStyle} />
      <Handle type="target" position={Position.Right}  id="target-right"  style={handleStyle} />
      <Handle type="source" position={Position.Top}    id="source-top"    style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" style={handleStyle} />
      <Handle type="source" position={Position.Left}   id="source-left"   style={handleStyle} />
      <Handle type="source" position={Position.Right}  id="source-right"  style={handleStyle} />

      {/* Header-balk */}
      <div
        style={{
          background: "rgba(0,0,0,0.06)",
          borderBottom: `1px solid ${borderColor}`,
          padding: "3px 8px",
          fontSize: 11,
          fontWeight: 700,
          color: "#78350f",
          display: "flex",
          alignItems: "center",
          gap: 4,
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 12 }}>📝</span>
        <span>Notitie</span>
      </div>

      {/* Tekst-inhoud */}
      <div
        style={{
          flex: 1,
          padding: "6px 8px",
          fontSize: 12,
          color: "#44403c",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          lineHeight: 1.45,
          overflow: "hidden",
        }}
      >
        {data.tekst || <span style={{ color: "#a8a29e", fontStyle: "italic" }}>(geen tekst)</span>}
      </div>
    </div>
  );
}

export default memo(NotitieNode);
