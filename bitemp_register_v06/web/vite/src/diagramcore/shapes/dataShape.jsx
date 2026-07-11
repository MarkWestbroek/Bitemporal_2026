// @ts-check
/**
 * dataShape — shapes als **declaratieve data** i.p.v. code-componenten, zodat
 * ze in de UI (Studio-instellingen) te maken/bewerken zijn en git-persistent
 * kunnen reizen. Een generieke renderer interpreteert de definitie; het
 * resultaat wordt gewoon in de shapeRegistry gezet en is overal bruikbaar als
 * elke andere shape (galerij, PE-kiezers, shape-sets).
 *
 * DataShape-schema (alles optioneel behalve id/label):
 *   { id, label,
 *     grondvorm: "rechthoek"|"afgerond"|"stadium"|"chip"|"zeshoek"|"afgeknipt",
 *     hoekRadius: number,          // voor afgerond/chip; anders uit grondvorm
 *     clipPath: string,            // eigen CSS clip-path (wint van grondvorm)
 *     silhouet: { inner, box },    // vrij SVG-silhouet (Method Draw); wint van alles
 *     randStijl: "solid"|"dashed",
 *     randDikte: number,           // px (default 2)
 *     vulling: "#rrggbb" }         // default; element/type-kleur wint
 *
 * Een `silhouet` is een genormaliseerd vrij vorm-silhouet: `inner` = de rauwe
 * SVG-paden (fills/strokes gestript), `box` = [x,y,w,h] van hun bounding box.
 * Het wordt als inline `<svg viewBox=box preserveAspectRatio="none">` achter de
 * inhoud gerenderd, zodat béziers behouden blijven én de vorm met de node-box
 * meerekt (net als een clip-path %). `vector-effect: non-scaling-stroke` houdt
 * de rand overal even dik ondanks de niet-uniforme schaal.
 *
 * De renderer hergebruikt de standaard header (icoon/stereotype/naam) en
 * `CompartimentLijst`, zodat een data-shape volwaardig meedoet.
 */
import { CompartimentLijst } from "./basisShapes.jsx";
import { registreerShape } from "./shapeRegistry.js";
import { TypeIcoon } from "./typeIconen.jsx";

/** Grondvorm → clip-path (of null wanneer een border-radius volstaat). */
export function clipVoor(def) {
  if (def.clipPath) return def.clipPath;
  switch (def.grondvorm) {
    case "zeshoek":
      return "polygon(14% 0, 86% 0, 100% 50%, 86% 100%, 14% 100%, 0 50%)";
    case "afgeknipt":
      return "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)";
    default:
      return null;
  }
}

/** Grondvorm → border-radius (px of %). */
function radiusVoor(def) {
  if (def.hoekRadius !== undefined) return def.hoekRadius;
  switch (def.grondvorm) {
    case "afgerond":
      return 14;
    case "chip":
    case "stadium":
      return 999;
    default:
      return 0;
  }
}

/**
 * Maak een React-shapecomponent uit een DataShape-definitie.
 * @param {Object} def
 */
export function maakDataShapeComponent(def) {
  const clip = clipVoor(def);
  const radius = radiusVoor(def);
  const randDikte = def.randDikte ?? 2;
  const silhouet =
    def.silhouet && def.silhouet.inner && Array.isArray(def.silhouet.box) && def.silhouet.box.length === 4
      ? def.silhouet
      : null;

  function DataShape({ element, elementType, selected, fieldTypesById, compartmentTypesById, children }) {
    const d = element.data || {};
    const rand = selected ? "var(--dc-selectie, #2563eb)" : "var(--dc-node-rand, #94a3b8)";
    const vulling = d.kleur || elementType.kleur || def.vulling || "var(--dc-node-vulling, #f1f5f9)";
    const inhoud = (
      <>
        {children}
        <div className="dc-node-header">
          <div className="dc-type-icoon">
            <TypeIcoon elementType={elementType} maat={13} />
          </div>
          <div className="dc-stereotype">{d.stereotype || elementType.stereotype || ""}</div>
          <div className={"dc-naam" + (d.abstract ? " is-abstract" : "")}>{element.naam || "(naamloos)"}</div>
        </div>
        <CompartimentLijst element={element} fieldTypesById={fieldTypesById} compartmentTypesById={compartmentTypesById} />
      </>
    );

    // Vrij silhouet (Method Draw): inline SVG-achtergrond die met de node-box
    // meerekt (viewBox + preserveAspectRatio="none"); rand als non-scaling stroke.
    if (silhouet) {
      const [bx, by, bw, bh] = silhouet.box;
      return (
        <div style={{ position: "relative", minWidth: 150, minHeight: 48, cursor: "grab" }}>
          <svg
            viewBox={`${bx} ${by} ${bw} ${bh}`}
            preserveAspectRatio="none"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
            aria-hidden="true"
          >
            <g
              fill={vulling}
              stroke={rand}
              strokeWidth={randDikte}
              strokeLinejoin="round"
              strokeDasharray={def.randStijl === "dashed" ? "6 4" : undefined}
              vectorEffect="non-scaling-stroke"
              dangerouslySetInnerHTML={{ __html: silhouet.inner }}
            />
          </svg>
          <div style={{ position: "relative", padding: "6px 12px" }}>{inhoud}</div>
        </div>
      );
    }

    // Clip-path knipt ook de rand recht af; net als de DMN-/knip-box-shapes
    // lossen we dat op met twee lagen (rand-laag + 1.5px kleinere vul-laag).
    if (clip) {
      return (
        <div style={{ position: "relative", minWidth: 150, minHeight: 48, cursor: "grab" }}>
          <div style={{ position: "absolute", inset: 0, clipPath: clip, background: rand }} />
          <div
            style={{
              position: "absolute",
              inset: randDikte,
              clipPath: clip,
              background: vulling,
            }}
          />
          <div style={{ position: "relative", padding: "6px 12px" }}>{inhoud}</div>
        </div>
      );
    }
    return (
      <div
        className="dc-node"
        style={{
          borderColor: rand,
          borderWidth: randDikte,
          borderStyle: def.randStijl === "dashed" ? "dashed" : "solid",
          borderRadius: radius,
          backgroundColor: vulling,
        }}
      >
        {inhoud}
      </div>
    );
  }
  return DataShape;
}

/** Registreer één data-shape in de gedeelde shapeRegistry (idempotent). */
export function registreerDataShape(def) {
  if (!def?.id) return;
  registreerShape(def.id, maakDataShapeComponent(def));
}
