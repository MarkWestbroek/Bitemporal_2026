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
import { Handle, NodeResizer, Position } from "@xyflow/react";
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

function ElementNode({ id, data, selected }) {
  const { element, elementType, bewerkbaar, onResize, fieldTypesById, compartmentTypesById } = data;
  if (!element || !elementType) return null;

  const Shape = getShape(elementType.shape) || getShape("class-box");
  if (!Shape) return null;

  const magResizen = bewerkbaar && elementType.resizebaar !== false;
  // Gedragsverwijzing (§3.2): een gevulde verwijzing toont een ⧉-badge in de
  // hoek — dubbelklik opent het gerefereerde diagram. Generiek in de node
  // (via children in de shape-root), zodat élke shape hem meekrijgt.
  const heeftGedrag = elementType.gedragsVerwijzing && element.data?.gedragDiagramId;
  // Buitenlabel (motor-primitief): kleine vaste vormen — BPMN-events en
  // -gateways, state machine begin/eind/keuze, activity-knooppunten — kunnen
  // hun naam niet ín de vorm dragen. `naamLabel: "buiten"` laat de motor hem
  // eronder zetten. Bewust een broer van de shape en niet een kind: shapes met
  // `.dc-node` hebben `overflow: hidden` en zouden het label wegknippen. De
  // React Flow-node-wrapper is `position: absolute` en dus het referentiekader.
  const toonBuitenlabel = elementType.naamLabel === "buiten" && !!element.naam;

  return (
    <>
      <Shape
        element={element}
        elementType={elementType}
        selected={!!selected}
        fieldTypesById={fieldTypesById}
        compartmentTypesById={compartmentTypesById}
      >
        {magResizen && (
          <NodeResizer
            // Minimum-maten uit het elementtype (bv. smalle activatie-balken in
            // een sequence-diagram); default de klassieke box-minima.
            minWidth={elementType.minBreedte ?? 180}
            minHeight={elementType.minHoogte ?? 56}
            isVisible={!!selected}
            lineStyle={{ borderColor: "#2563eb" }}
            handleStyle={{ width: 10, height: 10, borderRadius: 3, borderColor: "#2563eb", background: "#ffffff" }}
            onResizeEnd={(_ev, params) =>
              onResize?.(id, { width: Math.round(params.width), height: Math.round(params.height) })
            }
          />
        )}
        {heeftGedrag && (
          <span className="dc-gedrag-badge" title="Dubbelklik: open het gekoppelde diagram">
            ⧉
          </span>
        )}
        <StandaardHandles stijl={elementType.handleStijl} />
      </Shape>
      {toonBuitenlabel && <span className="dc-buitenlabel">{element.naam}</span>}
    </>
  );
}

export default memo(ElementNode);
