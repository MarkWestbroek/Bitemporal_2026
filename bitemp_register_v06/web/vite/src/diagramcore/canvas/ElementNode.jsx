/**
 * ElementNode — dé generieke React Flow-node van de diagramcore.
 *
 * Vervangt de per-type node-componenten: de vorm komt uit de shapeRegistry
 * (via elementType.shape), de inhoud uit element.compartimenten. De node zelf
 * levert alleen de acht standaard-handles (zelfde id's als de umleditor-nodes:
 * source/target × top/bottom/left/right), zodat bestaande edge-handles
 * één-op-één blijven werken — plus de vlak-handle voor de verbind-modus
 * (zie inlineNaam.js) en het inline-tekstveld (NaamEditor.jsx: F2 / klik op
 * de naam of op een veld).
 *
 * `data` (aangeleverd door DiagramCanvas):
 *   - element      — het core-Element (model/schema.js)
 *   - elementType  — de opgeloste ElementType-descriptor
 *   - fieldTypesById / compartmentTypesById — opgeloste lookups uit het DiagramType
 */
import { memo, useContext, useLayoutEffect, useRef, useState } from "react";
import { Handle, NodeResizer, Position } from "@xyflow/react";
import { getShape } from "../shapes/shapeRegistry.js";
import { InlineNaamContext, VLAK_HANDLE, splitsVeldSleutel } from "./inlineNaam.js";
import NaamEditor from "./NaamEditor.jsx";

const ONZICHTBAAR = {
  opacity: 0,
  width: 3,
  height: 3,
  minWidth: 0,
  minHeight: 0,
  pointerEvents: "none",
};

/* De vlak-handle beslaat de hele node. Inline stijl wint van React Flow's
   positieklassen (right/top/transform) en maatregels; of hij muis-input vangt
   regelt diagramcore.css (.dc-handle-vlak) op basis van de canvas-modus. */
const VLAK_STIJL = {
  position: "absolute",
  left: 0,
  top: 0,
  right: "auto",
  bottom: "auto",
  width: "100%",
  height: "100%",
  minWidth: 0,
  minHeight: 0,
  transform: "none",
  borderRadius: 0,
  border: "none",
  background: "transparent",
};

function StandaardHandles({ stijl, vlak }) {
  const s = stijl === "onzichtbaar" ? ONZICHTBAAR : undefined;
  return (
    <>
      {/* Vlak-handle éérst: de acht stippen komen later in de DOM en liggen
          dus bovenop — een precieze zijde kiezen blijft mogelijk, en een
          stip die over de naam ligt wint van "klik op de naam".
          `nokey`: met Shift ingedrukt (React Flow's selectionKeyCode) slikt
          het Pane anders élke pointerdown in om een kader-selectie te
          starten (onPointerDownCapture) — alleen een doel met .nokey
          ontsnapt daaraan. Zonder die klasse begint Shift+slepen vanaf een
          handle dus nooit een lijn. */}
      {vlak && (
        <Handle type="source" position={Position.Right} id={VLAK_HANDLE} className="dc-handle-vlak nokey" style={VLAK_STIJL} />
      )}
      {/* target-* eerst, source-* laatst — zelfde volgorde/z-index-truc als
          de umleditor-nodes, zodat slepen vanaf een rand de juiste kant op gaat. */}
      <Handle type="target" position={Position.Top} id="target-top" className="nokey" style={s} />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className="nokey" style={s} />
      <Handle type="target" position={Position.Left} id="target-left" className="nokey" style={s} />
      <Handle type="target" position={Position.Right} id="target-right" className="nokey" style={s} />
      <Handle type="source" position={Position.Top} id="source-top" className="nokey" style={s} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="nokey" style={s} />
      <Handle type="source" position={Position.Left} id="source-left" className="nokey" style={s} />
      <Handle type="source" position={Position.Right} id="source-right" className="nokey" style={s} />
    </>
  );
}

const vindNaamDoel = (wrapper) => wrapper.querySelector("[data-dc-naam], .dc-naam");

/**
 * NodeResizer die niet kleiner wil dan de shape zelf toestaat. Shapes dragen
 * eigen minima (inline minWidth/minHeight of .dc-node's min-width); was het
 * resizer-minimum lager, dan kromp het blauwe resize-kader wél en de vorm
 * níet — die stak dan rechts/onder uit het kader ("raar met extra lijnen",
 * gemeld 2026-10-07). Het anker-span zit ín de shape-root (children), dus
 * parentElement is die root; de computed min-width/height is de waarheid.
 */
function ShapeResizer({ minWidth, minHeight, ...rest }) {
  const ankerRef = useRef(null);
  const [shapeMin, setShapeMin] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const root = ankerRef.current?.parentElement;
    if (!root) return;
    const cs = getComputedStyle(root);
    const px = (v) => (typeof v === "string" && v.endsWith("px") ? parseFloat(v) || 0 : 0);
    const w = px(cs.minWidth);
    const h = px(cs.minHeight);
    setShapeMin((oud) => (oud.w === w && oud.h === h ? oud : { w, h }));
  });
  return (
    <>
      <span ref={ankerRef} style={{ display: "none" }} aria-hidden="true" />
      <NodeResizer minWidth={Math.max(minWidth, shapeMin.w)} minHeight={Math.max(minHeight, shapeMin.h)} {...rest} />
    </>
  );
}

/** Het veld (uit de eigen compartimenten) achter een veldsleutel, of null. */
function veldBijSleutel(element, sleutel) {
  const { compartmentType, index } = splitsVeldSleutel(sleutel);
  const comp = (element.compartimenten || []).find((c) => c.compartmentType === compartmentType && !c.extra);
  return comp?.velden?.[index] || null;
}

function ElementNode({ id, data, selected }) {
  const { element, elementType, bewerkbaar, onResize, fieldTypesById, compartmentTypesById } = data;
  const inlineNaam = useContext(InlineNaamContext);
  if (!element || !elementType) return null;
  const hernoemt = inlineNaam.nodeId === id;
  const veldSleutel = hernoemt ? inlineNaam.veld || null : null;
  const veld = veldSleutel ? veldBijSleutel(element, veldSleutel) : null;
  // Het tekstveld: de naam, of (bij een veldsleutel) de naam van dat veld.
  const editor = hernoemt && (!veldSleutel || veld) && (
    <NaamEditor
      key={veldSleutel || "naam"}
      waarde={veldSleutel ? veld.naam : element.naam}
      vindDoel={
        veldSleutel
          ? (wrapper) => {
              const rij = wrapper.querySelector(`[data-dc-veld="${CSS.escape(veldSleutel)}"]`);
              return rij?.querySelector(".dc-veld-naam") || rij;
            }
          : vindNaamDoel
      }
      plaats={elementType.naamLabel === "buiten" || data.gedaante === "bol" ? "buiten" : elementType.compartments?.length ? "boven" : "midden"}
      klaar={(nieuw) => inlineNaam.klaar(id, nieuw, veldSleutel)}
      onSchuif={
        veldSleutel && inlineNaam.schuifVeld
          ? (richting, waarde) => inlineNaam.schuifVeld(id, veldSleutel, richting, waarde)
          : undefined
      }
    />
  );

  // Samentrekking (ontwerpprincipe "gedaanten van een samenstel"): een
  // voorkomen met gedaante "bol" rendert als lollipop-bolletje met de naam
  // eronder — de inhoud (operaties enz.) verdwijnt bewust uit beeld. De
  // relatielijnen blijven gewoon aan dit (kleine) voorkomen hangen.
  if (data.gedaante === "bol") {
    return (
      <>
        <div className={"dc-samentrek-bol" + (selected ? " is-geselecteerd" : "")}>
          <StandaardHandles stijl={elementType.handleStijl} />
        </div>
        {element.naam && !hernoemt && <span className="dc-buitenlabel" data-dc-naam="">{element.naam}</span>}
        {editor}
      </>
    );
  }

  const Shape = getShape(elementType.shape) || getShape("class-box");
  if (!Shape) return null;
  // Compartimenten verborgen op dit diagram/voorkomen: de shape krijgt een
  // type zonder compartimenten en een element zonder inhoud — alleen de kop.
  const verborgen = !!data.compartimentenVerborgen && (elementType.compartments?.length || element.compartimenten?.length);
  const shapeType = verborgen ? { ...elementType, compartments: [] } : elementType;
  const shapeElement = verborgen ? { ...element, compartimenten: [] } : element;

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
  // Verbind-modus: containers (pool, lane, package, systeemkader) krijgen
  // géén vlak-handle — een lijn op hun vlak loslaten is "leeg vlak dáárbinnen"
  // (magic link), en erin slepen legt al het lidmaatschap. Ankers evenmin.
  const vlakHandle = bewerkbaar && !elementType.containerVoor && elementType.id !== "__anker";

  return (
    <>
      <Shape
        element={shapeElement}
        elementType={shapeType}
        selected={!!selected}
        fieldTypesById={fieldTypesById}
        compartmentTypesById={compartmentTypesById}
      >
        {magResizen && (
          <ShapeResizer
            // Minimum-maten uit het elementtype (bv. smalle activatie-balken in
            // een sequence-diagram); default de klassieke box-minima. De shape
            // zelf kan een hoger minimum afdwingen (zie ShapeResizer).
            minWidth={elementType.minBreedte ?? 180}
            minHeight={elementType.minHoogte ?? 56}
            isVisible={!!selected}
            lineStyle={{ borderColor: "#2563eb" }}
            handleStyle={{ width: 10, height: 10, borderRadius: 3, borderColor: "#2563eb", background: "#ffffff" }}
            // Trekken aan de linker-/bovenrand verschuift ook de positie
            // (params.x/y, relatief aan een eventuele parent): meegeven,
            // anders sprong de node na de rebuild terug naar zijn oude plek
            // met de nieuwe maat (gemeld 2026-10-07, mp4).
            onResizeEnd={(_ev, params) =>
              onResize?.(
                id,
                { width: Math.round(params.width), height: Math.round(params.height) },
                { x: params.x, y: params.y }
              )
            }
          />
        )}
        {heeftGedrag && (
          <span className="dc-gedrag-badge" title="Dubbelklik: open het gekoppelde diagram">
            ⧉
          </span>
        )}
        <StandaardHandles stijl={elementType.handleStijl} vlak={vlakHandle} />
      </Shape>
      {toonBuitenlabel && !(hernoemt && !veldSleutel) && (
        <span className="dc-buitenlabel" data-dc-naam="">{element.naam}</span>
      )}
      {editor}
    </>
  );
}

export default memo(ElementNode);
