/**
 * MetamodelEdge — Custom edge met rol, kardinaliteit en constraint labels.
 *
 * React Flow edges zijn standaard simpele lijnen. Door een custom edge te maken
 * kunnen we extra informatie tonen op de lijn:
 *
 *       [A] ——— rolnaam {enkelvoudig} 0..1 ———> [A_U]
 *
 * Edge classificaties:
 *   - Compositie: entiteit → GE (◆ ruit op bronzijde)
 *   - Associatie: entiteit → anker → entiteit (solid lijn, geen ruit)
 *   - Associatieklasse-link: anker ╌╌ relatie (dashed, geen labels)
 *   - Dependency: GE/REL → enum/datatype (dashed + «use»)
 *   - Generalisatie: supertype → subtype (driehoek)
 *
 * De `data` prop bevat:
 *   - rolnaam, jsonRolnaam, momentvoorkomen, kardinaliteit (standaard)
 *   - isDependency, isGeneralization (bestaand)
 *   - isAssociation: true voor solid associatie-edges (A→o, o→B)
 *   - isAssociationClassLink: true voor dashed link (o╌╌REL)
 *   - directioneel: true → open pijl op target-zijde
 */
import {
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  useReactFlow,
} from "@xyflow/react";

function MetamodelEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}) {
  const { getNode } = useReactFlow();
  const sourceNode = getNode(source);
  const targetNode = getNode(target);

  const isDependency = data?.isDependency === true;
  const isGeneralization = data?.isGeneralization === true;
  const isAssociation = data?.isAssociation === true;
  const isAssociationClassLink = data?.isAssociationClassLink === true;
  const directioneel = data?.directioneel === true;
  // Pijl alleen op de anker→B edge (source is anker), niet op A→anker
  const showDirectionalArrow = isAssociation && directioneel && sourceNode?.type === "associatieAnker";

  // Compositie: alleen entiteit → GE (niet meer entiteit → relatie)
  const isComposition =
    !isDependency &&
    !isGeneralization &&
    !isAssociation &&
    !isAssociationClassLink &&
    sourceNode?.type === "entiteit" &&
    targetNode?.type === "gegevenselement";

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const constraint =
    data?.momentvoorkomen === "enkelvoudig"
      ? "{enkelvoudig}"
      : data?.momentvoorkomen === "meervoudig"
        ? "{meervoudig}"
        : "";
  const kardinaliteit = data?.kardinaliteit || "";
  const rolnaam = data?.rolnaam || "";

  // Plaats labels bij de target-zijde (70% richting target)
  const geLabelX = labelX + (targetX - labelX) * 0.7;
  const geLabelY = labelY + (targetY - labelY) * 0.7;
  // Labels bij de source-zijde (30% richting source)
  const srcLabelX = labelX + (sourceX - labelX) * 0.7;
  const srcLabelY = labelY + (sourceY - labelY) * 0.7;

  const diamondColor = selected ? "#2563eb" : "#64748b";
  const dependencyColor = "#64748b";
  const generalizationColor = selected ? "#2563eb" : "#475569";
  const associationColor = selected ? "#2563eb" : "#64748b";
  const { diamondCenter, diamondPoints } = getDiamondProps(sourceX, sourceY, sourcePosition);
  const dependencyArrowId = `edge-dependency-arrow-${id}`;
  const generalizationArrowId = `edge-generalization-triangle-${id}`;
  const associationArrowId = `edge-association-arrow-${id}`;

  return (
    <>
      {isDependency && (
        <defs>
          <marker
            id={dependencyArrowId}
            markerWidth="12"
            markerHeight="10"
            refX="9"
            refY="5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path
              d="M 1 2 L 9 5 L 1 8"
              fill="none"
              stroke={dependencyColor}
              strokeWidth="1.0"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>
      )}
      {isGeneralization && (
        <defs>
          <marker
            id={generalizationArrowId}
            markerWidth="14"
            markerHeight="14"
            refX="13"
            refY="7"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path
              d="M 1 1 L 13 7 L 1 13 Z"
              fill="white"
              stroke={generalizationColor}
              strokeWidth="1.2"
            />
          </marker>
        </defs>
      )}
      {/* Open pijl voor directionele associatie (▷) — alleen op anker→B edge */}
      {showDirectionalArrow && (
        <defs>
          <marker
            id={associationArrowId}
            markerWidth="12"
            markerHeight="10"
            refX="9"
            refY="5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path
              d="M 1 2 L 9 5 L 1 8"
              fill="none"
              stroke={associationColor}
              strokeWidth="1.0"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>
      )}

      {/* De lijn zelf — BaseEdge tekent het SVG path */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={
          isDependency ? `url(#${dependencyArrowId})`
          : isGeneralization ? `url(#${generalizationArrowId})`
          : showDirectionalArrow ? `url(#${associationArrowId})`
          : undefined
        }
        style={{
          stroke: isDependency ? dependencyColor
            : isGeneralization ? generalizationColor
            : isAssociation ? associationColor
            : isAssociationClassLink ? (selected ? "#7c3aed" : "#94a3b8")
            : selected ? "#2563eb" : "#64748b",
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: isDependency ? "6 3"
            : isAssociationClassLink ? "4 3"
            : undefined,
        }}
      />

      {/* Compositie-ruit (◆) op de bronzijde — alleen entiteit → GE */}
      {isComposition && (
        <g transform={`translate(${diamondCenter.x} ${diamondCenter.y})`}>
          <polygon
            points={diamondPoints}
            fill={diamondColor}
            stroke={diamondColor}
            strokeWidth="1"
          />
        </g>
      )}

      {/* Labels voor compositie-edges (entiteit → GE) */}
      {isComposition && (
        <EdgeLabelRenderer>
          <div
            className="edge-label"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${geLabelX}px, ${geLabelY}px)`,
              pointerEvents: "all",
            }}
          >
            {rolnaam && <span className="edge-rolnaam">{rolnaam}</span>}
            {kardinaliteit && (
              <span className="edge-kardinaliteit">{kardinaliteit}</span>
            )}
            {constraint && <span className="edge-constraint">{constraint}</span>}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Labels voor associatie-edges (A→o en o→B): kardinaliteit bij entiteit-zijde */}
      {isAssociation && (kardinaliteit || constraint || rolnaam) && (() => {
        // Label moet bij de entiteit staan, niet bij het anker.
        // A→o (target=anker): toon bij source (srcLabel). o→B (source=anker): toon bij target (geLabel).
        const nearAnker = targetNode?.type === "associatieAnker";
        const lx = nearAnker ? srcLabelX : geLabelX;
        const ly = nearAnker ? srcLabelY : geLabelY;
        return (
          <EdgeLabelRenderer>
            <div
              className="edge-label"
              style={{
                position: "absolute",
                transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`,
                pointerEvents: "all",
              }}
            >
              {rolnaam && <span className="edge-rolnaam">{rolnaam}</span>}
              {kardinaliteit && (
                <span className="edge-kardinaliteit">{kardinaliteit}</span>
              )}
              {constraint && <span className="edge-constraint">{constraint}</span>}
            </div>
          </EdgeLabelRenderer>
        );
      })()}

      {/* Geen labels op associatieklasse-link (o╌╌REL) */}

      {isDependency && (
        <EdgeLabelRenderer>
          <div
            className="edge-label"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
          >
            <span className="edge-constraint" style={{ color: "#7c3aed" }}>«use»</span>
          </div>
        </EdgeLabelRenderer>
      )}
      {isGeneralization && (
        <EdgeLabelRenderer>
          <div
            className="edge-label"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
          >
            <span className="edge-constraint" style={{ color: "#0d9488" }}>
              {data?.mixin ? "«Mixin»" : "«Generalisatie»"}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

/**
 * Geeft het middelpunt van de ruit en de punten, afgestemd op de lijnrichting.
 * HL = halve lengte LANGS de lijn (dunne as).
 * HW = halve breedte DWARS op de lijn (brede as).
 */
function getDiamondProps(x, y, sourcePosition) {
  const HL = 11;  // lange as: langs de lijnrichting
  const HW = 8;   // dunne as: dwars op de lijnrichting (16px totaal)
  const isVertical = sourcePosition === "top" || sourcePosition === "bottom";
  const points = isVertical
    ? `0,${-HL} ${HW},0 0,${HL} ${-HW},0`
    : `${-HL},0 0,${-HW} ${HL},0 0,${HW}`;
  let cx, cy;
  switch (sourcePosition) {
    case "right":  cx = x + HL; cy = y; break;
    case "left":   cx = x - HL; cy = y; break;
    case "top":    cx = x; cy = y - HL; break;
    case "bottom": cx = x; cy = y + HL; break;
    default:       cx = x; cy = y;
  }
  return { diamondCenter: { x: cx, y: cy }, diamondPoints: points };
}

export default MetamodelEdge;
