// @ts-check
/**
 * weergaveProject — de weergaven van de tool als project in het profiel Weergave (plan
 * docs/plans/2026-11-21 Sidecar-project — weergaven en starten uit het project, §2–§3 en §7 stap 1).
 *
 * Vier soorten project (besluit Mark 21-11): M1 → weergaven → M2 + transformaties → M3. Dit is het
 * weergaveproject. Stap 1: de **vormen** (ShapeTypes). Iconen volgen in stap 2.
 *
 *   map Vormen
 *     map <profiel>             de vormen die alleen dit profiel gebruikt
 *     map Gedeeld               vormen die meer profielen gebruiken
 *     map Niet in een profiel   vormen die geen profiel aanwijst (basisvormen, eigen vormen)
 *
 * Elke map heeft een diagram. Het diagram van een profiel toont álle vormen die het gebruikt, ook
 * de gedeelde: een element staat in één map maar kan op meer diagrammen voorkomen. Zo blijft de
 * groepering per profiel zichtbaar zonder dat een vorm dubbel bestaat.
 *
 * De naam van een element is de id van de vorm; de element-id is daarvan afgeleid (`wv_<id>`),
 * zodat een volgende export dezelfde elementen houdt.
 *
 * `vormenUitProject` en `laadVormen` doen de omgekeerde weg: de vormen uit het project in de tool
 * (op hun plek vervangen; het register zoekt bij elke tekening op id). Een vorm met een renderer
 * die deze tool niet kent, wordt niet geladen en gemeld.
 *
 * Puur, op het register van de vormen na (`laadVormen`).
 */
import { WEERGAVE_PROFIEL_ID, VORM_TYPE } from "../diagramprofielen/weergave/index.js";
import { getRenderer, getShapeType, registreerShapeType, valideerShapeType } from "../diagramcore/types/shapeType.js";
import { versieVan } from "../diagramcore/types/profielVersie.js";
import { PROJECT_FORMAAT, PROJECT_FORMAAT_VERSIE } from "./activities/projectSync.js";

export const WEERGAVE_PROJECT_ID = "omnium-weergaven";
export const WEERGAVE_ACTIVITEIT_ID = "weergave05";

/** De sleutels van een ShapeType die een eigen veld hebben; de rest gaat naar `overig`. */
const VELDEN = ["parameters", "minMaat", "ankers"];
const KOLOMMEN = 6;
const CEL = { w: 170, h: 110 };

const veilig = (tekst) => String(tekst).replace(/[^A-Za-z0-9_-]+/g, "_");
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const kopie = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** De element-id van een vorm. */
export const vormElementId = (shapeId) => `wv_${veilig(shapeId)}`;

/**
 * Een ShapeType als element in het profiel Weergave.
 * @param {import("../diagramcore/types/schema.js").ShapeType} st
 */
export function vormNaarElement(st) {
  const data = { renderer: st.renderer };
  for (const k of VELDEN) if (st[k] !== undefined) data[k] = kopie(st[k]);
  const overig = Object.fromEntries(Object.entries(st).filter(([k]) => k !== "id" && k !== "renderer" && !VELDEN.includes(k)));
  if (Object.keys(overig).length) data.overig = kopie(overig);
  return { id: vormElementId(st.id), naam: st.id, elementType: VORM_TYPE, compartimenten: [], data };
}

/**
 * Een vorm-element terug naar een ShapeType.
 * @param {any} element
 * @param {{kentRenderer?: (id: string) => boolean}} [opties]
 * @returns {{shapeType: any|null, fouten: string[]}}
 */
export function elementNaarVorm(element, { kentRenderer = (id) => !!getRenderer(id) } = {}) {
  const data = element?.data || {};
  const id = String(element?.naam || "").trim();
  const shapeType = { id, renderer: data.renderer };
  for (const k of VELDEN) if (data[k] !== undefined && data[k] !== null && data[k] !== "") shapeType[k] = kopie(data[k]);
  const fouten = [];
  if (data.overig !== undefined) {
    if (!isObject(data.overig)) fouten.push(`vorm "${id}": overig moet een object zijn`);
    else for (const [k, v] of Object.entries(data.overig)) if (!(k in shapeType)) shapeType[k] = kopie(v);
  }
  fouten.push(...valideerShapeType(shapeType));
  if (shapeType.renderer && !kentRenderer(shapeType.renderer)) fouten.push(`vorm "${id}": onbekende renderer "${shapeType.renderer}"`);
  return { shapeType: fouten.length ? null : shapeType, fouten };
}

/**
 * Welke profielen wijzen welke vorm aan: `ElementType.shape`, de shape-sets en de eigen
 * ShapeTypes van een profiel.
 * @param {any[]} descriptors
 * @returns {Map<string, string[]>} vorm-id → profiel-labels (in volgorde, uniek)
 */
export function vormGebruik(descriptors) {
  const gebruik = new Map();
  const noteer = (shapeId, profiel) => {
    if (!shapeId || shapeId === "edge") return;
    const lijst = gebruik.get(shapeId) || [];
    if (!lijst.includes(profiel)) lijst.push(profiel);
    gebruik.set(shapeId, lijst);
  };
  for (const d of descriptors || []) {
    const naam = d.label || d.id;
    for (const et of d.elementTypes || []) if (!et._superprofiel && !et.isConnector) noteer(et.shape, naam);
    for (const set of d.shapeSets || []) for (const shapeId of Object.values(set.shapes || {})) noteer(shapeId, naam);
    for (const st of d.shapeTypes || []) noteer(st.id, naam);
  }
  return gebruik;
}

/** Een raster van nodes. */
const raster = (elementIds) =>
  elementIds.map((elementId, i) => ({ elementId, position: { x: 40 + (i % KOLOMMEN) * CEL.w, y: 40 + Math.floor(i / KOLOMMEN) * CEL.h } }));

/**
 * Het weergaveproject.
 * @param {Object} invoer
 * @param {any[]} invoer.shapeTypes - alle vormen van de tool (types/shapeType.js `alleShapeTypes`)
 * @param {any[]} invoer.descriptors - de profielen (voor de groepering)
 * @param {any} [invoer.taalDescriptor] - het profiel Weergave (voor zijn versie)
 * @param {string} [invoer.naam]
 * @returns {Record<string, any>} een werkbestand (formaat studio-project)
 */
export function weergaveProject({ shapeTypes, descriptors, taalDescriptor = null, naam = "Omnium weergaven" }) {
  const gebruik = vormGebruik(descriptors);
  const mappen = {};
  const plaatsing = {};
  const model = { diagramTypeId: WEERGAVE_PROFIEL_ID, elements: {}, diagrams: {}, actiefDiagramId: null, meta: {} };
  const map = (id, mapNaam, ouderId, volgorde) => {
    mappen[id] = { id, naam: mapNaam, ouderId, volgorde };
    return id;
  };
  const vormenMap = map("map_vormen", "Vormen", null, 1);
  const diagram = (id, diagramNaam, mapId, elementIds) => {
    model.diagrams[id] = { id, naam: diagramNaam, diagramType: WEERGAVE_PROFIEL_ID, nodes: raster(elementIds), edges: [] };
    model.actiefDiagramId ??= id;
    plaatsing[`${WEERGAVE_ACTIVITEIT_ID}::${id}`] = mapId;
  };

  const bekend = new Set();
  for (const st of shapeTypes || []) {
    if (bekend.has(st.id)) continue;
    bekend.add(st.id);
    const el = vormNaarElement(st);
    model.elements[el.id] = el;
  }
  const profielen = [...new Set([...gebruik.values()].flat())].sort((a, b) => a.localeCompare(b, "nl"));
  const elementMap = {};
  profielen.forEach((profiel, i) => {
    const mapId = map(`map_vormen_${veilig(profiel)}`, profiel, vormenMap, i + 1);
    const ids = [...gebruik].filter(([shapeId, lijst]) => lijst.includes(profiel) && bekend.has(shapeId)).map(([shapeId]) => vormElementId(shapeId));
    for (const [shapeId, lijst] of gebruik) if (lijst.length === 1 && lijst[0] === profiel && bekend.has(shapeId)) elementMap[vormElementId(shapeId)] = mapId;
    if (ids.length) diagram(`dg_vormen_${veilig(profiel)}`, `Vormen van ${profiel}`, mapId, ids);
  });
  const gedeeld = [...gebruik].filter(([shapeId, lijst]) => lijst.length > 1 && bekend.has(shapeId)).map(([shapeId]) => vormElementId(shapeId));
  if (gedeeld.length) {
    const mapId = map("map_vormen_gedeeld", "Gedeeld", vormenMap, profielen.length + 1);
    for (const id of gedeeld) elementMap[id] = mapId;
    diagram("dg_vormen_gedeeld", "Gedeelde vormen", mapId, gedeeld);
  }
  const los = [...bekend].filter((shapeId) => !gebruik.has(shapeId)).map(vormElementId);
  if (los.length) {
    const mapId = map("map_vormen_los", "Niet in een profiel", vormenMap, profielen.length + 2);
    for (const id of los) elementMap[id] = mapId;
    diagram("dg_vormen_los", "Vormen die geen profiel aanwijst", mapId, los);
  }
  for (const [elementId, mapId] of Object.entries(elementMap)) plaatsing[`el::${WEERGAVE_ACTIVITEIT_ID}::${elementId}`] = mapId;

  return {
    formaat: PROJECT_FORMAAT,
    versie: PROJECT_FORMAAT_VERSIE,
    project: { id: WEERGAVE_PROJECT_ID, naam },
    structuur: { mappen, plaatsing, plaatsingVolgorde: Object.keys(plaatsing) },
    kruisverbanden: [],
    profielVersies: { [WEERGAVE_ACTIVITEIT_ID]: versieVan(taalDescriptor) },
    profielen: { [WEERGAVE_ACTIVITEIT_ID]: model },
  };
}

/**
 * De vormen uit een model in het profiel Weergave (de elementen van de store of van een werkbestand).
 * @param {{elements?: Record<string, any>}} inhoud
 * @param {{kentRenderer?: (id: string) => boolean}} [opties]
 * @returns {{shapeTypes: any[], fouten: string[]}}
 */
export function vormenUitProject(inhoud, opties) {
  const shapeTypes = [];
  const fouten = [];
  const gezien = new Set();
  for (const el of Object.values(inhoud?.elements || {})) {
    if (el.elementType !== VORM_TYPE) continue;
    const uit = elementNaarVorm(el, opties);
    if (!uit.shapeType) {
      fouten.push(...uit.fouten);
      continue;
    }
    if (gezien.has(uit.shapeType.id)) {
      fouten.push(`vorm "${uit.shapeType.id}" staat twee keer in het project`);
      continue;
    }
    gezien.add(uit.shapeType.id);
    shapeTypes.push(uit.shapeType);
  }
  return { shapeTypes, fouten };
}

/**
 * De vormen in de tool zetten. Een bekende vorm wordt vervangen; het canvas zoekt hem bij elke
 * tekening op id op, dus wat open staat tekent na een rerender met de nieuwe vorm.
 * @param {any[]} shapeTypes
 * @returns {{vervangen: string[], nieuw: string[], fouten: string[]}}
 */
export function laadVormen(shapeTypes) {
  const vervangen = [];
  const nieuw = [];
  const fouten = [];
  for (const st of shapeTypes || []) {
    const bestond = !!getShapeType(st.id);
    try {
      registreerShapeType(st);
      (bestond ? vervangen : nieuw).push(st.id);
    } catch (e) {
      fouten.push(String(e?.message || e));
    }
  }
  return { vervangen, nieuw, fouten };
}
