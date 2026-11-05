// @ts-check
/**
 * shapeType — het vormcontract van het M3 (2026-11-04, Mark: "één tekenaar"; plan
 * docs/plans/2026-11-04 Eén tekenaar §3.1). Dezelfde scheiding als het EA-Metametamodel
 * (diagram "Editor") en als LineStyle/LineRenderer en LayoutStijl/LayoutRenderer:
 *
 *   - **ShapeType** (Stijl-domein): gegevens, serialiseerbaar. `ElementType.shape` en de
 *     shape-sets verwijzen ernaar met hun id. Eigen vormen staan in `DiagramType.shapeTypes`.
 *   - **ShapeRenderer** (Implementatie-domein): pure code, op id gekoppeld. Tekent geen React en
 *     geen HTML, maar geeft een **VormBoom**: één beschrijving die zowel het canvas als de server
 *     en de documenten kunnen lezen.
 *
 * Overgang: een oude React-component uit `shapes/shapeRegistry.js` is een tweede realisatie van
 * hetzelfde id. `tekenbareVorm(id)` zegt of er al een renderer is; zo niet, dan tekent de oude
 * component. Vorm voor vorm om te zetten.
 *
 * Puur: geen DOM, geen stores.
 */

/** De enige SVG-elementen in een VormBoom (geen foreignObject, style, HTML). */
export const VORMBOOM_TAGS = Object.freeze([
  "g", "rect", "ellipse", "circle", "path", "line", "polyline", "polygon",
  "text", "tspan", "defs", "clipPath", "use", "marker",
]);

/** Elementen waarnaar verwezen wordt: hun id draagt `idPrefix`, zodat diagrammen op één pagina niet botsen. */
const TAGS_MET_ID_PREFIX = new Set(["clipPath", "marker"]);
const TEKST_TAGS = new Set(["text", "tspan"]);
const ANKERS = new Set(["rechthoek", "rand"]);
const UITLIJNINGEN = new Set(["boven", "midden"]);
const VERPLICHT_IN_RENDERER = ["omtrek", "inhoudsvak"];
const OPTIONEEL_IN_RENDERER = ["kindervak", "ornament", "rand", "maat"];

const isGetal = (v) => typeof v === "number" && Number.isFinite(v);
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Maak een knoop: `vorm("g", {}, vorm("rect", {width: 10}), …)`.
 * @returns {import("./schema.js").VormBoom}
 */
export function vorm(tag, attrs = {}, ...kinderen) {
  return { tag, attrs, kinderen: kinderen.flat().filter((k) => k !== null && k !== undefined && k !== false) };
}

/**
 * Controleer een VormBoom. Geeft alle fouten, met het pad erbij.
 * @param {any} boom
 * @param {{idPrefix?: string}} [opties]
 * @returns {string[]} leeg = geldig
 */
export function valideerVormBoom(boom, { idPrefix = "" } = {}) {
  const fouten = [];
  const loop = (knoop, pad, inTekst) => {
    if (typeof knoop === "string" || isGetal(knoop)) {
      if (!inTekst) fouten.push(`${pad}: tekst mag alleen in text of tspan`);
      return;
    }
    if (!isObject(knoop)) {
      fouten.push(`${pad}: geen knoop`);
      return;
    }
    if (!VORMBOOM_TAGS.includes(knoop.tag)) {
      fouten.push(`${pad}: element "${knoop.tag}" is niet toegestaan`);
      return;
    }
    const hier = `${pad}/${knoop.tag}`;
    for (const [naam, waarde] of Object.entries(knoop.attrs || {})) {
      if (naam === "style" || /^on/i.test(naam)) fouten.push(`${hier}: attribuut "${naam}" is niet toegestaan`);
      if (typeof waarde !== "string" && !isGetal(waarde)) fouten.push(`${hier}: attribuut "${naam}" is geen tekst of getal`);
      // Alleen verwijzingen binnen dezelfde tekening: geen externe bestanden of scripts.
      if (/href$/i.test(naam) && !String(waarde).startsWith("#")) fouten.push(`${hier}: ${naam} moet binnen de tekening verwijzen (#…)`);
    }
    const id = knoop.attrs?.id;
    if (TAGS_MET_ID_PREFIX.has(knoop.tag)) {
      if (!id) fouten.push(`${hier}: id ontbreekt`);
      else if (idPrefix && !String(id).startsWith(idPrefix)) fouten.push(`${hier}: id "${id}" begint niet met "${idPrefix}"`);
    }
    (knoop.kinderen || []).forEach((k, i) => loop(k, `${hier}[${i}]`, TEKST_TAGS.has(knoop.tag)));
  };
  loop(boom, "", false);
  return fouten;
}

/**
 * Controleer een Vak (uitkomst van `inhoudsvak` en `kindervak`).
 * @returns {string[]} leeg = geldig
 */
export function valideerVak(vak) {
  if (!isObject(vak)) return ["Vak: geen object"];
  const fouten = [];
  for (const k of ["x", "y", "w", "h"]) if (!isGetal(vak[k])) fouten.push(`Vak: ${k} is geen getal`);
  if (vak.uitlijning !== undefined && !UITLIJNINGEN.has(vak.uitlijning)) fouten.push(`Vak: onbekende uitlijning "${vak.uitlijning}"`);
  if (vak.rotatie !== undefined && !isGetal(vak.rotatie)) fouten.push("Vak: rotatie is geen getal");
  return fouten;
}

/** Past deze waarde in JSON (geen functies)? */
function isSerialiseerbaar(v) {
  if (v === null || typeof v === "string" || typeof v === "boolean" || isGetal(v)) return true;
  if (Array.isArray(v)) return v.every(isSerialiseerbaar);
  return isObject(v) && Object.values(v).every(isSerialiseerbaar);
}

/**
 * Controleer een ShapeType. Of de renderer bestaat, hoort hier niet: renderers registreren
 * lui, per profiel (zie `tekenbareVorm`).
 * @returns {string[]} leeg = geldig
 */
export function valideerShapeType(st) {
  if (!isObject(st)) return ["ShapeType: geen object"];
  const ctx = `ShapeType "${st.id ?? "?"}"`;
  const fouten = [];
  if (!st.id || typeof st.id !== "string") fouten.push(`${ctx}: id ontbreekt`);
  if (!st.renderer || typeof st.renderer !== "string") fouten.push(`${ctx}: renderer (ShapeRenderer-id) ontbreekt`);
  if (st.parameters !== undefined && !(isObject(st.parameters) && isSerialiseerbaar(st.parameters))) {
    fouten.push(`${ctx}: parameters moet een object met gewone gegevens zijn (geen functies)`);
  }
  if (st.minMaat !== undefined && !(isGetal(st.minMaat?.w) && isGetal(st.minMaat?.h))) {
    fouten.push(`${ctx}: minMaat moet {w, h} met getallen zijn`);
  }
  if (st.ankers !== undefined && !ANKERS.has(st.ankers)) fouten.push(`${ctx}: onbekende ankers "${st.ankers}"`);
  return fouten;
}

/**
 * Controleer een ShapeRenderer.
 * @returns {string[]} leeg = geldig
 */
export function valideerShapeRenderer(id, renderer) {
  const ctx = `ShapeRenderer "${id}"`;
  if (!isObject(renderer)) return [`${ctx}: geen object`];
  const fouten = [];
  for (const k of VERPLICHT_IN_RENDERER) if (typeof renderer[k] !== "function") fouten.push(`${ctx}: ${k} ontbreekt`);
  for (const k of OPTIONEEL_IN_RENDERER) {
    if (renderer[k] !== undefined && typeof renderer[k] !== "function") fouten.push(`${ctx}: ${k} is geen functie`);
  }
  return fouten;
}

const _shapeTypes = new Map();
const _renderers = new Map();

/** Registreer een ShapeType; gooit bij een ongeldig contract. Opnieuw registreren vervangt. */
export function registreerShapeType(st) {
  const fouten = valideerShapeType(st);
  if (fouten.length) throw new Error(fouten.join("\n"));
  _shapeTypes.set(st.id, st);
}

/** Registreer een ShapeRenderer; gooit bij een ongeldig contract. Opnieuw registreren vervangt. */
export function registreerRenderer(id, renderer) {
  const fouten = valideerShapeRenderer(id, renderer);
  if (fouten.length) throw new Error(fouten.join("\n"));
  _renderers.set(id, renderer);
}

export const getShapeType = (id) => _shapeTypes.get(id);
export const getRenderer = (id) => _renderers.get(id);

/**
 * De nieuwe tekenroute voor dit shape-id, als die er al is: ShapeType én renderer geregistreerd.
 * `null` = tekenen via de oude component (`getShape`).
 * @param {string} shapeId
 * @returns {{shapeType: import("./schema.js").ShapeType, renderer: import("./schema.js").ShapeRenderer}|null}
 */
export function tekenbareVorm(shapeId) {
  const shapeType = _shapeTypes.get(shapeId);
  const renderer = shapeType && _renderers.get(shapeType.renderer);
  return renderer ? { shapeType, renderer } : null;
}

/** Vormgrammatica die de motor oplost (StyleType-aggregatie in EA). */
const STIJL_SLEUTELS = ["kleur", "randDikte", "hoekRadius", "randStijl"];

/**
 * Los de vormgrammatica op voor `ctx.stijl`: element wint van type, type van thema. Een renderer
 * leest de grammatica niet zelf uit.
 * @param {{data?: Object}} [element]
 * @param {Object} [elementType]
 * @param {Object} [themaStijl]
 */
export function losStijlOp(element, elementType, themaStijl = {}) {
  const uit = {};
  for (const k of STIJL_SLEUTELS) {
    for (const w of [element?.data?.[k], elementType?.[k], themaStijl[k]]) {
      if (w !== undefined && w !== null && w !== "") {
        uit[k] = w;
        break;
      }
    }
  }
  return uit;
}

/**
 * Ondergrens van de maat: het ShapeType is de standaard, `ElementType.minBreedte/minHoogte`
 * overschrijft per as (ook na het wisselen van shape-set).
 * @returns {{w: number, h: number}|null} null = geen ondergrens bekend (motorstandaard)
 */
export function minMaatVan(shapeType, elementType) {
  const w = elementType?.minBreedte ?? shapeType?.minMaat?.w;
  const h = elementType?.minHoogte ?? shapeType?.minMaat?.h;
  if (w === undefined && h === undefined) return null;
  return { w: w ?? 0, h: h ?? 0 };
}

/**
 * De eigen inhoud van een element (`hooks.inhoudsregels`), voor de inhoud-tekenaar. Zoals
 * `valideerElement`: een hook die gooit, telt als geen inhoud; een profielregel mag de tekening
 * niet laten vallen.
 * @returns {import("./schema.js").InhoudsRegel[]}
 */
export function inhoudsregelsVan(elementType, element, context = {}) {
  const hook = elementType?.hooks?.inhoudsregels;
  if (typeof hook !== "function" || !element) return [];
  try {
    const uit = hook(element, context);
    return Array.isArray(uit) ? uit.filter((r) => Array.isArray(r?.delen) && r.delen.length) : [];
  } catch {
    return [];
  }
}

/** Alleen voor tests. */
export function _resetVoorTests() {
  _shapeTypes.clear();
  _renderers.clear();
}
