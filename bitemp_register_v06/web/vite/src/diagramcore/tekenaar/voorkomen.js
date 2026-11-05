// @ts-check
/**
 * voorkomen — één voorkomen bouwen en tekenen op het vormcontract. Gedeeld door de
 * diagram-tekenaar (index.js: documenten, gedeelde plaatjes, render-svc) en het canvas
 * (canvas/SjabloonShape.jsx, stap 3 van het plan 2026-11-04 Eén tekenaar). Zo is er letterlijk
 * één tekenaar: maat, opgeloste stijl, kleuren, inhoud en ornament komen uit dezelfde functies.
 *
 *   bouwVoorkomen  — de tekenstand: ShapeContext (`ctx`), buitenmaat en het inhoudsplan;
 *   tekenVoorkomen — omtrek, inhoud en ornament als losse VormBomen (de aanroeper zet ze samen,
 *                    het canvas wikkelt ze in eigen groepen voor selectie en knippen).
 *
 * Puur: geen DOM, geen stores.
 */
import { losStijlOp, inhoudsregelsVan, valideerVormBoom, valideerVak } from "../types/shapeType.js";
import { veiligeKleur, tekstOp } from "../../diagramsvg/thema.js";
import { planInhoud, tekenInhoud } from "./inhoud.js";
import { meetVoorkomen } from "./maat.js";

/** Lettertype van de tekening (canvas én SVG-uitvoer). */
export const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** De kleuren voor één voorkomen: thema-tokens, tenzij er een eigen kleur is. */
export function kleurenVoor(basis, stijl, parameters) {
  const hex = veiligeKleur(stijl.kleur, null);
  const vast = veiligeKleur(parameters.vulling, null);
  const vulling = hex || vast || basis.surface;
  const inkt = hex ? tekstOp(hex) : vast ? tekstOp(vast) : basis.text;
  return {
    ...basis,
    vulling,
    rand: veiligeKleur(parameters.rand, null) || basis.border,
    inkt,
    gedempt: hex || vast ? inkt : basis.muted,
  };
}

/** De basiskleuren uit een palet (diagramsvg/thema.js maakPalet). */
export function basisVanPalet(palet) {
  return { palet, surface: palet("surface"), border: palet("border"), text: palet("text"), muted: palet("muted"), accent: palet("accent") };
}

/**
 * Bouw de tekenstand van één voorkomen (zonder te tekenen).
 * @param {Object} p
 * @param {Object} p.element
 * @param {Object} p.elementType
 * @param {import("../types/schema.js").ShapeType} p.shapeType
 * @param {import("../types/schema.js").ShapeRenderer} p.renderer
 * @param {Object|null} [p.ref]            - het DiagramNode-voorkomen (size, gedaante); null voor synthetische nodes
 * @param {{w: number, h: number}|null} [p.maat] - een opgelegde buitenmaat (canvas: opgeslagen of live tijdens resizen); wint van ref.size
 * @param {Object|null} [p.diagram]
 * @param {Record<string, Object>|null} [p.elements]
 * @param {Record<string, Object>} [p.fieldTypesById]
 * @param {Record<string, Object>} [p.compartmentTypesById]
 * @param {Object} p.basis                 - basiskleuren (basisVanPalet)
 * @param {string} p.idPrefix              - uniek per voorkomen (marker-/clip-id's)
 * @param {boolean} [p.verborgen]          - compartimenten verborgen (gedaante "kop" / diagram-breed)
 * @param {(verw: any) => string|null} [p.verwijzingNaam]
 */
export function bouwVoorkomen({ element, elementType, shapeType, renderer, ref = null, maat = null, diagram = null, elements = null, fieldTypesById, compartmentTypesById, basis, idPrefix, verborgen = false, verwijzingNaam = null }) {
  const et = elementType || {};
  // Diagramverwijzing zonder eigen naam: de naam van het doeldiagram (van de host).
  if (et.shape === "diagramverwijzing" && !element.naam) {
    const doel = element.data?.verwijstNaar;
    element = { ...element, naam: (doel && verwijzingNaam?.(doel)) || "diagram" };
  }
  if (verborgen && (element.compartimenten || []).length) element = { ...element, compartimenten: [] };
  const parameters = shapeType.parameters || {};
  const stijl = losStijlOp(element, et);
  const inhoudsregels = inhoudsregelsVan(et, element, { elements, diagram });
  const planVoor = (breedte) => planInhoud({ element, elementType: et, breedte, parameters, fieldTypesById, compartmentTypesById, inhoudsregels });
  const maatRef = maat ? { size: { width: maat.w, height: maat.h } } : ref;
  const { w, h, plan } = meetVoorkomen({ ref: maatRef, elementType: et, shapeType, planVoor });
  const ctx = {
    element,
    elementType: et,
    shapeType,
    parameters,
    maat: { w, h },
    stijl,
    node: ref || null,
    diagram,
    thema: kleurenVoor(basis, stijl, parameters),
    idPrefix,
  };
  return { ctx, renderer, w, h, plan, element, et, rand: renderer.rand ? (hoek) => renderer.rand(ctx, hoek) : null };
}

/**
 * Teken één voorkomen: omtrek, inhoud (in het inhoudsvak) en ornament, in element-coördinaten.
 * @param {ReturnType<typeof bouwVoorkomen>} box
 * @param {{controleer?: boolean}} [opties] - controleer: toets de renderer-uitvoer aan het contract
 * @returns {{omtrek: Object, inhoud: Object|null, ornament: Object|null, vak: Object|null, fouten: string[]}}
 */
export function tekenVoorkomen(box, { controleer = false } = {}) {
  const { ctx, renderer, plan } = box;
  const omtrek = renderer.omtrek(ctx);
  const vak = renderer.inhoudsvak(ctx);
  const ornament = renderer.ornament ? renderer.ornament(ctx) : null;
  const fouten = [];
  if (controleer) {
    fouten.push(...valideerVormBoom(omtrek, { idPrefix: ctx.idPrefix }).map((f) => `${ctx.shapeType.id} omtrek ${f}`));
    if (vak) fouten.push(...valideerVak(vak).map((f) => `${ctx.shapeType.id} ${f}`));
    if (ornament) fouten.push(...valideerVormBoom(ornament, { idPrefix: ctx.idPrefix }).map((f) => `${ctx.shapeType.id} ornament ${f}`));
  }
  const inhoud = vak && plan ? tekenInhoud(vak, plan, ctx.thema, { tekstAnker: ctx.parameters.tekstAnker }) : null;
  return { omtrek, inhoud, ornament, vak, fouten };
}
