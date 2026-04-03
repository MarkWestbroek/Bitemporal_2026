/**
 * DomeinBoundaryOverlay — Tekent een gestippelde boundary-rectangle
 * om alle nodes van het actieve domein in flow-coördinaten.
 *
 * Moet als child van <ReactFlow> gerenderd worden zodat useViewport()
 * beschikbaar is via de ReactFlowProvider context.
 */
import { useViewport } from "@xyflow/react";

export default function DomeinBoundaryOverlay({ boundary, domein }) {
  const { x, y, zoom } = useViewport();

  if (!boundary || !domein) return null;

  // Vertaal flow-coördinaten naar screen-coördinaten
  const sx = boundary.x * zoom + x;
  const sy = boundary.y * zoom + y;
  const sw = boundary.width * zoom;
  const sh = boundary.height * zoom;

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <rect
        x={sx}
        y={sy}
        width={sw}
        height={sh}
        rx={12 * zoom}
        ry={12 * zoom}
        fill="rgba(59, 130, 246, 0.04)"
        stroke="rgba(59, 130, 246, 0.35)"
        strokeWidth={2}
        strokeDasharray="8 4"
      />
      <text
        x={sx + 8 * zoom}
        y={sy + 16 * zoom}
        fill="rgba(59, 130, 246, 0.5)"
        fontSize={12 * zoom}
        fontFamily="system-ui, sans-serif"
      >
        {domein}
      </text>
    </svg>
  );
}
