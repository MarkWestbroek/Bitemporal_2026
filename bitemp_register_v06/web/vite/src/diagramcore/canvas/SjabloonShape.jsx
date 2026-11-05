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
 */
import { useId, useMemo } from "react";
import { tekenbareVorm, minMaatVan } from "../types/shapeType.js";
import { maakPalet } from "../../diagramsvg/thema.js";
import { bouwVoorkomen, tekenVoorkomen, basisVanPalet } from "../tekenaar/voorkomen.js";
import { naarReact } from "../tekenaar/naarReact.js";
import "../tekenaar/basisVormen.js"; // registreert de basis-ShapeTypes en de bibliotheek-renderers

/**
 * Shape-id's met een ShapeType die op het canvas nog via de oude component tekenen:
 * - diagramverwijzing: toont de naam van het doeldiagram live (useDiagramNaam) en markeert een
 *   verdwenen doel; de tekenaar kent alleen een vaste naam van de host.
 */
const UITGEZONDERD = new Set(["diagramverwijzing"]);

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

export function SjabloonShape({ element, elementType, selected, fieldTypesById, compartmentTypesById, vormInfo, maat, children }) {
  // Uniek per node-instantie (clip-id); twee canvassen in één document delen anders id's.
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const getekend = useMemo(() => {
    const box = bouwVoorkomen({
      element,
      elementType,
      shapeType: vormInfo.shapeType,
      renderer: vormInfo.renderer,
      maat: maat && maat.w > 0 && maat.h > 0 ? maat : null,
      fieldTypesById,
      compartmentTypesById,
      basis: BASIS,
      idPrefix: `sj${uid}`,
    });
    const { omtrek, inhoud, ornament } = tekenVoorkomen(box);
    return { w: box.w, h: box.h, omtrek, inhoud, ornament };
  }, [element, elementType, vormInfo, maat, fieldTypesById, compartmentTypesById, uid]);
  const { w, h } = getekend;
  const min = sjabloonMinMaat(vormInfo, elementType);
  const clipId = `sj${uid}-knip`;
  return (
    <div
      className={"dc-sjabloon" + (selected ? " is-geselecteerd" : "")}
      data-shape={vormInfo.shapeType.id}
      style={{ width: w, height: h, minWidth: min.w, minHeight: min.h }}
    >
      <svg className="dc-sjabloon-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false">
        <defs>
          {/* Inhoud nooit buiten de vorm (zoals `overflow: hidden` op .dc-node); het ornament mag wél uitsteken. */}
          <clipPath id={clipId}>
            <rect x={0} y={0} width={w} height={h} />
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
