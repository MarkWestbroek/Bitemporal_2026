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
import { losStijlOp, inhoudsregelsVan, naamWeergaveVan, valideerVormBoom, valideerVak } from "../types/shapeType.js";
import { veiligeKleur, tekstOp } from "../../diagramsvg/thema.js";
import { planInhoud, tekenInhoud } from "./inhoud.js";
import { meetVoorkomen } from "./maat.js";
import { host } from "./host.js";

/** Lettertype van de tekening (canvas én SVG-uitvoer). */
export const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/**
 * De kleuren voor één voorkomen: thema-tokens, tenzij er een eigen kleur is. Met
 * `parameters.kleurAls: "rand"` (kaders) kleurt de eigen kleur de rand en blijft het vlak
 * open — de tekst kiest dan niet op contrast met die kleur, maar blijft de thematekst.
 */
export function kleurenVoor(basis, stijl, parameters) {
  const hex = veiligeKleur(stijl.kleur, null);
  const vast = veiligeKleur(parameters.vulling, null);
  if (parameters.kleurAls === "rand") {
    const inkt = vast ? tekstOp(vast) : basis.text;
    return { ...basis, vulling: vast || basis.surface, rand: hex || veiligeKleur(parameters.rand, null) || basis.border, inkt, gedempt: vast ? inkt : basis.muted };
  }
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
 * @param {(verw: any) => string|null} [p.verwijzingNaam] - documenten/server: naam van een doeldiagram
 * @param {{naam: string|null, weg: boolean}|null} [p.verwijzing] - canvas: de naam van het doel
 *   live en of het doel verdwenen is (SjabloonShape leest die uit `model/diagramNamen.js`); wint
 *   van `verwijzingNaam`
 */
export function bouwVoorkomen({ element, elementType, shapeType, renderer, ref = null, maat = null, diagram = null, elements = null, fieldTypesById, compartmentTypesById, basis, idPrefix, verborgen = false, verwijzingNaam = null, verwijzing = null }) {
  const et = elementType || {};
  // Diagramverwijzing: zonder eigen naam de naam van het doeldiagram (van de host); is het doel
  // weg, dan streept de motor de naam door en kleurt de renderer de rand rood.
  let doelWeg = false;
  if (et.shape === "diagramverwijzing") {
    const doel = element.data?.verwijstNaar;
    const info = verwijzing || { naam: (doel && verwijzingNaam?.(doel)) || null, weg: false };
    doelWeg = !!info.weg;
    if (!element.naam) element = { ...element, naam: info.naam || "diagram" };
  }
  if (verborgen && (element.compartimenten || []).length) element = { ...element, compartimenten: [] };
  const parameters = shapeType.parameters || {};
  // Een kadervorm (`kleurAls: "rand"`) neemt de typekleur niet over: alleen een eigen kleur van
  // het element kleurt zijn rand (een ArchiMate-grouping draagt de laagkleur van zijn type, maar
  // die hoort bij de box-gedaante).
  const stijl = losStijlOp(element, parameters.kleurAls === "rand" ? { ...et, kleur: undefined } : et);
  // De hook-context: het diagram, de elementen en wat de host weet (host.js: de naam van een
  // element in een ander profiel; op de server null).
  const hookContext = { elements, diagram, verwijzingLabel: host().verwijzingLabel };
  const inhoudsregels = inhoudsregelsVan(et, element, hookContext);
  const weergave = naamWeergaveVan(et, element, hookContext);
  const naam = typeof weergave === "object" ? weergave.tekst : weergave;
  const naamOnderstreept = typeof weergave === "object" ? weergave.onderstreept : undefined;
  const planVoor = (breedte) => planInhoud({ element, elementType: et, breedte, parameters, fieldTypesById, compartmentTypesById, inhoudsregels, naam, naamOnderstreept, naamDoorgestreept: doelWeg });
  let maatRef = maat ? { size: { width: maat.w, height: maat.h } } : ref;
  // Zonder bewaarde maat mag de renderer de natuurlijke maat bepalen (fork/join: staand of
  // liggend; een levenslijn: tot onder het laagste element van het diagram).
  if (!(maatRef?.size?.width && maatRef?.size?.height) && renderer.maat) {
    const eigen = renderer.maat({ element, elementType: et, parameters, stijl, diagram, elementen: elements, node: ref || null });
    if (eigen) maatRef = { size: { width: eigen.w, height: eigen.h } };
  }
  // Een bovengrens knipt een bewaarde maat af (levenslijn: altijd 14 breed, ook als een import
  // of de MCP er een doos van 160 van maakte; anders hangen de berichten aan een onzichtbaar kader).
  const bovengrens = renderer.bovengrens ? renderer.bovengrens({ element, elementType: et, parameters, stijl, diagram, elementen: elements, node: ref || null }) || null : null;
  if (bovengrens && maatRef?.size?.width && maatRef?.size?.height) {
    maatRef = { ...maatRef, size: { width: Math.min(maatRef.size.width, bovengrens.w ?? Infinity), height: Math.min(maatRef.size.height, bovengrens.h ?? Infinity) } };
  }
  const gemeten = meetVoorkomen({ ref: maatRef, elementType: et, shapeType, planVoor });
  const { plan } = gemeten;
  let { w, h } = gemeten;
  // Een dynamische ondergrens geldt ook bovenop een bewaarde maat (levenslijn: altijd tot onder
  // haar laagste punt, anders valt een bericht naast de lijn).
  const ondergrens = renderer.ondergrens ? renderer.ondergrens({ element, elementType: et, parameters, stijl, diagram, elementen: elements, node: ref || null }) || null : null;
  if (ondergrens) {
    w = Math.max(w, ondergrens.w ?? 0);
    h = Math.max(h, ondergrens.h ?? 0);
  }
  const ctx = {
    element,
    elementType: et,
    shapeType,
    parameters,
    maat: { w, h },
    stijl,
    node: ref || null,
    diagram,
    elementen: elements,
    verwijzing: et.shape === "diagramverwijzing" ? { weg: doelWeg } : null,
    thema: kleurenVoor(basis, stijl, parameters),
    inhoud: plan ? { h: plan.h, minW: plan.minW } : null,
    idPrefix,
  };
  return { ctx, renderer, w, h, plan, element, et, ondergrens, bovengrens, rand: renderer.rand ? (hoek) => renderer.rand(ctx, hoek) : null };
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
  // Een Vak mag de tekstuitlijning van het ShapeType overschrijven (subproces: uitgeklapt links, ingeklapt midden).
  const inhoud = vak && plan ? tekenInhoud(vak, plan, ctx.thema, { tekstAnker: vak.tekstAnker || ctx.parameters.tekstAnker }) : null;
  return { omtrek, inhoud, ornament, vak, fouten };
}

/**
 * Kleine vaste vorm (begin, keuze, junction, …): op het canvas liggen de handles net búiten de
 * vorm (diagramcore.css `.dc-punt-node`), zodat de kern vrij blijft om te slepen. De tekenaar
 * gebruikt dezelfde regel voor het punt van een vaste handle (lijnen.js).
 */
export const isPuntNode = (shapeType, elementType) => elementType?.resizebaar === false && shapeType?.parameters?.inhoud === "geen";
