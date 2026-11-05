/**
 * SjabloonShape — de canvas-adapter van "één tekenaar" (plan 2026-11-04, stap 3): een vorm met
 * een ShapeType + ShapeRenderer (types/shapeType.js, `tekenbareVorm`) tekent op het canvas met
 * dezelfde tekenaar als documenten, gedeelde plaatjes en render-svc (tekenaar/voorkomen.js),
 * als <svg> ter grootte van het voorkomen. Eromheen blijft alles van React Flow en ElementNode:
 * handles, resizer, badges, buitenlabel en de inline-editor (die vindt `data-dc-naam` en
 * `data-dc-veld` nu op <text>-regels).
 *
 * Maat: de bewaarde maat van het voorkomen (`data.size`), tijdens resizen de live maat uit de
 * NodeResizer, anders de gemeten inhoud (tekenaar/maat.js) — dezelfde regels als op de server.
 * Thema: de tekenaar kleurt met `var(--diagram-*)`; diagramcore.css wijst die op het canvas naar
 * de canvas-tokens (--dc-node-vulling, --dc-node-rand). Selectie: CSS zet de omtrek in de
 * selectiekleur (`.dc-sjabloon.is-geselecteerd .dc-omtrek`).
 *
 * Overgang (§3.3): `sjabloonOpCanvas(shapeId)` zegt of een shape-id hier tekent. Elke vorm met een
 * ShapeType én renderer doet dat, behalve de id's in UITGEZONDERD, die nog iets van de oude
 * component nodig hebben. Zo wordt elke in stap 4 omgezette profielvorm meteen op canvas én
 * server gelijk, en blijft de rest tekenen via `getShape`.
 *
 * Diagramkennis: een renderer met `leestDiagram: true` (de sequence-levenslijn: activaties uit
 * de berichten, lengte tot onder haar laagste punt) krijgt hier het **levende** diagram — de
 * nodes uit de React Flow-store, dus ook de posities tijdens het slepen — en de elementen uit
 * `TekenContext` (DiagramCanvas). Buiten een canvas (vormvoorbeelden) is er geen context en
 * tekent zo'n vorm zonder diagram.
 */
import { createContext, useContext, useId, useMemo } from "react";
import { useStore } from "@xyflow/react";
import { tekenbareVorm, minMaatVan } from "../types/shapeType.js";
import { maakPalet } from "../../diagramsvg/thema.js";
import { bouwVoorkomen, tekenVoorkomen, basisVanPalet, isPuntNode } from "../tekenaar/voorkomen.js";
import { naarReact } from "../tekenaar/naarReact.js";
import "../tekenaar/basisVormen.js"; // registreert de basis-ShapeTypes en de bibliotheek-renderers

/**
 * Shape-id's met een ShapeType die op het canvas nog via de oude component tekenen:
 * - diagramverwijzing: toont de naam van het doeldiagram live (useDiagramNaam) en markeert een
 *   verdwenen doel; de tekenaar kent alleen een vaste naam van de host.
 */
const UITGEZONDERD = new Set(["diagramverwijzing"]);

/**
 * Wat het canvas aan diagramkennis meegeeft aan een renderer met `leestDiagram`: de elementen
 * van het model (ook de connectoren — berichten zijn geen nodes). DiagramCanvas zet hem.
 * @type {import("react").Context<{elements: Record<string, Object>, diagramId: string|null}|null>}
 */
export const TekenContext = createContext(null);

/** De canvas-palet: thema-tokens, door diagramcore.css gekoppeld aan de canvas-tokens. */
const BASIS = basisVanPalet(maakPalet("auto"));

/**
 * @param {string} shapeId
 * @returns {{shapeType: Object, renderer: Object}|null} null = oude component (getShape)
 */
export function sjabloonOpCanvas(shapeId) {
  if (!shapeId || UITGEZONDERD.has(shapeId)) return null;
  return tekenbareVorm(shapeId);
}

/** Minimummaat voor de resizer: ShapeType, overschreven door ElementType.minBreedte/minHoogte. */
export function sjabloonMinMaat(vormInfo, elementType) {
  return minMaatVan(vormInfo.shapeType, elementType) || { w: 0, h: 0 };
}

/**
 * Een vorm zonder inhoudsvak (`parameters.inhoud: "geen"`: begin/eind, ruit, junction, de
 * ArchiMate-figuren) draagt zijn naam als buitenlabel — dezelfde regel als in de tekenaar
 * (index.js: geen vak → buitenlabel, tenzij `naamLabel: "geen"`).
 */
export function sjabloonNaamBuiten(vormInfo, elementType) {
  return !!vormInfo && vormInfo.shapeType.parameters?.inhoud === "geen" && elementType?.naamLabel !== "geen";
}


export function SjabloonShape(props) {
  const teken = useContext(TekenContext);
  // Alleen een renderer die het diagram leest volgt de canvas-store; de rest hertekent niet bij
  // elke verplaatsing van een andere node.
  if (teken && props.vormInfo.renderer.leestDiagram) return <SjabloonMetDiagram {...props} teken={teken} />;
  return <SjabloonKern {...props} />;
}

/** Het levende diagram uit de React Flow-store, in de vorm van het model (elementId, position, size). */
function SjabloonMetDiagram({ teken, ...props }) {
  const nodes = useStore((s) => s.nodes);
  const diagram = useMemo(
    () => ({
      id: teken.diagramId,
      nodes: nodes.filter((n) => n.data?.element).map((n) => ({ elementId: n.data.element.id, nodeId: n.id, position: n.position, ...(n.data.size ? { size: n.data.size } : {}) })),
    }),
    [nodes, teken.diagramId]
  );
  return <SjabloonKern {...props} diagram={diagram} elements={teken.elements} />;
}

function SjabloonKern({ element, elementType, selected, fieldTypesById, compartmentTypesById, vormInfo, maat, diagram = null, elements = null, children }) {
  // Uniek per node-instantie (clip-id); twee canvassen in één document delen anders id's.
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const getekend = useMemo(() => {
    const box = bouwVoorkomen({
      element,
      elementType,
      shapeType: vormInfo.shapeType,
      renderer: vormInfo.renderer,
      maat: maat && maat.w > 0 && maat.h > 0 ? maat : null,
      diagram,
      elements,
      fieldTypesById,
      compartmentTypesById,
      basis: BASIS,
      idPrefix: `sj${uid}`,
    });
    const { omtrek, inhoud, ornament, vak } = tekenVoorkomen(box);
    // Knipvlak: de vorm, verruimd met een inhoudsvak dat erbuiten ligt (een renderer mag de naam
    // naast of onder de vorm zetten).
    const knip = { x0: Math.min(0, vak?.x ?? 0), y0: Math.min(0, vak?.y ?? 0), x1: Math.max(box.w, vak ? vak.x + vak.w : 0), y1: Math.max(box.h, vak ? vak.y + vak.h : 0) };
    return { w: box.w, h: box.h, omtrek, inhoud, ornament, knip, ondergrens: box.ondergrens };
  }, [element, elementType, vormInfo, maat, diagram, elements, fieldTypesById, compartmentTypesById, uid]);
  const { w, h, knip } = getekend;
  // De resizer leest het minimum van deze root (ShapeResizer): een dynamische ondergrens van de
  // renderer telt mee, anders krimpt het resize-kader wel en de vorm niet.
  const vast = sjabloonMinMaat(vormInfo, elementType);
  const min = { w: Math.max(vast.w, getekend.ondergrens?.w ?? 0), h: Math.max(vast.h, getekend.ondergrens?.h ?? 0) };
  const clipId = `sj${uid}-knip`;
  return (
    <div
      className={
        "dc-sjabloon" +
        (selected ? " is-geselecteerd" : "") +
        (isPuntNode(vormInfo.shapeType, elementType) ? " dc-punt-node" : "") +
        // Canvas-klasse uit het ShapeType (bv. dc-seq-punt: handles op de rand, zichtbaar bij hover).
        (vormInfo.shapeType.parameters?.klasse ? ` ${vormInfo.shapeType.parameters.klasse}` : "")
      }
      data-shape={vormInfo.shapeType.id}
      style={{ width: w, height: h, minWidth: min.w, minHeight: min.h }}
    >
      <svg className="dc-sjabloon-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false">
        <defs>
          {/* Inhoud nooit buiten de vorm (zoals `overflow: hidden` op .dc-node); het ornament mag wél uitsteken. */}
          <clipPath id={clipId}>
            <rect x={knip.x0} y={knip.y0} width={knip.x1 - knip.x0} height={knip.y1 - knip.y0} />
          </clipPath>
        </defs>
        <g className="dc-omtrek">{naarReact(getekend.omtrek)}</g>
        {getekend.inhoud && <g clipPath={`url(#${clipId})`}>{naarReact(getekend.inhoud)}</g>}
        {getekend.ornament && <g className="dc-ornament">{naarReact(getekend.ornament)}</g>}
      </svg>
      {children}
    </div>
  );
}
