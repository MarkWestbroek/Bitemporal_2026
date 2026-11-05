/**
 * VormVoorbeeld — een vorm buiten het canvas, getekend door de ene tekenaar (plan 2026-11-04,
 * opruimstap): de galerij in de Studio-instellingen, de shape-sets en de vormkiezer in de
 * profiel-ontwerper. Tot de opruimstap tekenden die plekken de oude React-componenten uit de
 * shape-registry; nu is een voorbeeld letterlijk wat het canvas, een document en de server
 * tekenen.
 *
 * De vorm tekent op zijn natuurlijke maat in een ontwerpvlak van 150 × 74 (zoals de oude
 * voorbeelden) en schaalt als geheel naar `breedte` × `hoogte`. Een kleine vorm (begin-stip)
 * blijft klein, een grote krimpt tot hij past, en van een lange (levenslijn) zie je de kop.
 * Geen handles, geen selectie, geen diagramkennis.
 */
import { useId, useMemo } from "react";
import { maakPalet } from "../../diagramsvg/thema.js";
import { bouwVoorkomen, tekenVoorkomen, basisVanPalet } from "../tekenaar/voorkomen.js";
import { vormVoor } from "../tekenaar/vormen.js";
import { alleDiagramTypes } from "../types/typeRegistry.js";
import { naarReact } from "../tekenaar/naarReact.js";
import "../tekenaar/basisVormen.js";

const BASIS = basisVanPalet(maakPalet("auto"));
const ONTWERP_W = 150;
const ONTWERP_H = 74;

/**
 * Het elementtype waarmee een voorbeeld tekent. Zonder gekozen kleur: het eerste elementtype
 * uit de geregistreerde profielen dat deze vorm gebruikt — dan zie je de vorm zoals dat profiel
 * hem tekent (een begin-stip donker, een BPMN-taak lichtblauw, een ArchiMate-box met zijn
 * icoon). Compartimenten en hooks blijven weg: het voorbeeld toont de vorm, niet een model.
 * Met een kleur (een skin in de shape-sets, een eigen vorm): neutraal in die kleur.
 */
function voorbeeldType(shapeId, kleur) {
  if (!kleur) {
    for (const dt of alleDiagramTypes()) {
      const et = (dt.elementTypes || []).find((t) => t.shape === shapeId && !t.isConnector);
      if (et) return { ...et, id: "voorbeeld", compartments: [], hooks: {}, properties: [] };
    }
  }
  return { id: "voorbeeld", shape: shapeId, kleur: kleur || "#e2e8f0", compartments: [] };
}

/**
 * @param {Object} p
 * @param {string} [p.shapeId]      - een geregistreerd ShapeType (of een id op de terugval)
 * @param {{shapeType: Object, renderer: Object}} [p.vormInfo] - een vorm die (nog) niet
 *   geregistreerd is, bv. een eigen vorm tijdens het bewerken; wint van `shapeId`
 * @param {string} [p.naam]
 * @param {string} [p.kleur]
 * @param {number} [p.breedte]
 * @param {number} [p.hoogte]
 */
export function VormVoorbeeld({ shapeId = "class-box", vormInfo = null, naam = "Aa", kleur = null, breedte = ONTWERP_W, hoogte = ONTWERP_H }) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const getekend = useMemo(() => {
    try {
      const info = vormInfo || vormVoor(shapeId);
      const box = bouwVoorkomen({
        element: { id: "voorbeeld", naam, elementType: "voorbeeld", data: {}, compartimenten: [] },
        elementType: voorbeeldType(info.shapeType.id, kleur),
        shapeType: info.shapeType,
        renderer: info.renderer,
        fieldTypesById: {},
        compartmentTypesById: {},
        basis: BASIS,
        idPrefix: `vb${uid}`,
      });
      const { omtrek, inhoud, ornament, vak } = tekenVoorkomen(box);
      // Het getekende vlak: de vorm, verruimd met een inhoudsvak dat erbuiten ligt.
      const x0 = Math.min(0, vak?.x ?? 0);
      const y0 = Math.min(0, vak?.y ?? 0);
      const x1 = Math.max(box.w, vak ? vak.x + vak.w : 0);
      const y1 = Math.max(box.h, vak ? vak.y + vak.h : 0);
      return { omtrek, inhoud, ornament, x0, y0, w: x1 - x0, h: y1 - y0 };
    } catch {
      return null;
    }
  }, [shapeId, vormInfo, naam, kleur, uid]);
  if (!getekend) return <span style={{ color: "var(--s-fg-muted)" }}>—</span>;
  // Het zichtvenster: minstens het ontwerpvlak (een kleine vorm blijft klein, gecentreerd);
  // van een lange vorm de bovenkant (drie ontwerphoogtes), de rest valt weg.
  const vw = Math.max(getekend.w, ONTWERP_W);
  const vh = Math.max(Math.min(getekend.h, ONTWERP_H * 3), ONTWERP_H);
  const vx = getekend.x0 - (vw - getekend.w) / 2;
  const vy = getekend.h <= vh ? getekend.y0 - (vh - getekend.h) / 2 : getekend.y0;
  return (
    <svg
      className="dc-sjabloon-svg dc-vormvoorbeeld"
      data-shape={(vormInfo || {}).shapeType?.id || shapeId}
      width={breedte}
      height={hoogte}
      viewBox={`${vx - 1} ${vy - 1} ${vw + 2} ${vh + 2}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: "hidden", pointerEvents: "none", display: "block" }}
      aria-hidden="true"
      focusable="false"
    >
      <g className="dc-omtrek">{naarReact(getekend.omtrek)}</g>
      {getekend.inhoud && naarReact(getekend.inhoud)}
      {getekend.ornament && <g className="dc-ornament">{naarReact(getekend.ornament)}</g>}
    </svg>
  );
}

export default VormVoorbeeld;
