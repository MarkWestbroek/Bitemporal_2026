/**
 * ConstraintNode — Lichtblauwe rounded-rect voor constraints/regels in het diagram.
 *
 * Visuele structuur:
 *   ┌──────────────────────────────────┐
 *   │ 🔒  VerwerkingsDatum    [OCL]   │  ← naam + taal-badge
 *   ├──────────────────────────────────┤
 *   │  context NatuurlijkPersoon       │  ← expressie (monospace)
 *   │  inv: self.geboortedatum <= ...  │
 *   └──────────────────────────────────┘
 *
 * Eigenschappen:
 *  - `data.naam`      — titel van de constraint
 *  - `data.expressie` — de constraint-expressie (OCL, CEL of vrije tekst)
 *  - `data.taal`      — "ocl" | "cel" | "tekst" (bepaalt badge-kleur)
 *  - `data.breedte`   — breedte in pixels
 *  - `data.hoogte`    — hoogte in pixels
 *
 * Handles op alle zijden voor scope-edges (gestippeld grijs) die de constraint
 * koppelen aan de elementen waarop hij van toepassing is.
 *
 * C8: Onderdeel van de notities/constraints uitbreiding.
 */
import { memo } from "react";
import { Handle, NodeResizer, Position } from "@xyflow/react";

// Handles zijn lichtblauw zichtbaar zodat scope-edges eraan kunnen beginnen/eindigen
const handleStyle = {
  width: 8,
  height: 8,
  background: "#93c5fd",
  border: "2px solid #3b82f6",
  borderRadius: "50%",
  opacity: 0.75,
  minWidth: 0,
  minHeight: 0,
};

/** Badge-kleur per constraint-taal */
const TAAL_BADGE = {
  ocl: { bg: "#dbeafe", color: "#1e40af", label: "OCL" },
  cel: { bg: "#dcfce7", color: "#166534", label: "CEL" },
  tekst: { bg: "#f3f4f6", color: "#374151", label: "TXT" },
};

function ConstraintNode({ id, data, selected }) {
  const borderColor = selected ? "#3b82f6" : "#93c5fd";
  const badge = TAAL_BADGE[data.taal] || TAAL_BADGE.tekst;
  const naam = data.naam || "(naamloos)";

  return (
    <div
      className="metamodel-node constraint-node"
      style={{
        minWidth: 180,
        minHeight: 72,
        padding: 0,
        borderRadius: 6,
        border: `2px solid ${borderColor}`,
        backgroundColor: "#e0f2fe",
        boxShadow: selected
          ? "2px 3px 8px rgba(59,130,246,0.35)"
          : "2px 3px 6px rgba(0,0,0,0.20)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      <NodeResizer
        minWidth={160}
        minHeight={60}
        isVisible={selected}
        lineStyle={{ borderColor: "#3b82f6" }}
        handleStyle={{ width: 10, height: 10, borderRadius: 3, borderColor: "#3b82f6", background: "#ffffff" }}
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

      {/* Header-balk: icoon + naam + taal-badge */}
      <div
        style={{
          background: "rgba(0,0,0,0.07)",
          borderBottom: `1px solid ${borderColor}`,
          padding: "3px 8px",
          display: "flex",
          alignItems: "center",
          gap: 5,
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 12 }}>🔒</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#1e3a5f",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={naam}
        >
          {naam}
        </span>
        {/* Taal-badge */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            background: badge.bg,
            color: badge.color,
            borderRadius: 3,
            padding: "1px 5px",
            border: `1px solid ${badge.color}33`,
            flexShrink: 0,
          }}
        >
          {badge.label}
        </span>
      </div>

      {/* Expressie — monospace */}
      <div
        style={{
          flex: 1,
          padding: "6px 8px",
          fontSize: 11,
          fontFamily: "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
          color: "#1e3a5f",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          lineHeight: 1.5,
          overflow: "hidden",
        }}
      >
        {data.expressie || <span style={{ color: "#93c5fd", fontStyle: "italic" }}>(geen expressie)</span>}
      </div>
    </div>
  );
}

export default memo(ConstraintNode);
