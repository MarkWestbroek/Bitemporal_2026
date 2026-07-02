/**
 * ElementNode — dé generieke React Flow-node van de diagramcore.
 *
 * Vervangt de per-type node-componenten: de vorm komt uit de shapeRegistry
 * (via elementType.shape), de inhoud uit element.compartimenten. De node zelf
 * levert alleen de acht standaard-handles (zelfde id's als de umleditor-nodes:
 * source/target × top/bottom/left/right), zodat bestaande edge-handles
 * één-op-één blijven werken.
 *
 * `data` (aangeleverd door DiagramCanvas):
 *   - element      — het core-Element (model/schema.js)
 *   - elementType  — de opgeloste ElementType-descriptor
 *   - fieldTypesById / compartmentTypesById — opgeloste lookups uit het DiagramType
 */
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { getShape } from "../shapes/shapeRegistry.js";

const ONZICHTBAAR = {
  opacity: 0,
  width: 3,
  height: 3,
  minWidth: 0,
  minHeight: 0,
  pointerEvents: "none",
};

function StandaardHandles({ stijl }) {
  const s = stijl === "onzichtbaar" ? ONZICHTBAAR : undefined;
  return (
    <>
      {/* target-* eerst, source-* laatst — zelfde volgorde/z-index-truc als
          de umleditor-nodes, zodat slepen vanaf een rand de juiste kant op gaat. */}
      <Handle type="target" position={Position.Top} id="target-top" style={s} />
      <Handle type="target" position={Position.Bottom} id="target-bottom" style={s} />
      <Handle type="target" position={Position.Left} id="target-left" style={s} />
      <Handle type="target" position={Position.Right} id="target-right" style={s} />
      <Handle type="source" position={Position.Top} id="source-top" style={s} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" style={s} />
      <Handle type="source" position={Position.Left} id="source-left" style={s} />
      <Handle type="source" position={Position.Right} id="source-right" style={s} />
    </>
  );
}

function ElementNode({ data, selected }) {
  const { element, elementType, fieldTypesById, compartmentTypesById } = data;
  if (!element || !elementType) return null;

  const Shape = getShape(elementType.shape) || getShape("class-box");
  if (!Shape) return null;

  return (
    <Shape
      element={element}
      elementType={elementType}
      selected={!!selected}
      fieldTypesById={fieldTypesById}
      compartmentTypesById={compartmentTypesById}
    >
      <StandaardHandles stijl={elementType.handleStijl} />
    </Shape>
  );
}

export default memo(ElementNode);
