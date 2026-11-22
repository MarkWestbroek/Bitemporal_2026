// @ts-check
/**
 * weergaveProject — de weergaven van de tool als project in het profiel Weergave (plan
 * docs/plans/2026-11-21 Sidecar-project — weergaven en starten uit het project, §2–§3 en §7 stap 1).
 *
 * Vier soorten project (besluit Mark 21-11): M1 → weergaven → M2 + transformaties → M3. Dit is het
 * weergaveproject: de **vormen** (ShapeTypes, stap 1) en de **iconen** (SVG-tekst, stap 2).
 *
 *   map Vormen
 *     map <profiel>             de vormen die alleen dit profiel gebruikt
 *     map Gedeeld               vormen die meer profielen gebruiken
 *     map Niet in een profiel   vormen die geen profiel aanwijst (basisvormen, eigen vormen)
 *   map Iconen
 *     map Standaard per vorm    het icoon van een elementtype zonder eigen icoon (`vorm:<shape>`)
 *     map <profiel> / Gedeeld / Niet in een profiel   idem als bij de vormen, op `ElementType.icoon`
 *
 * Elke map heeft een diagram. Het diagram van een profiel toont álle vormen (iconen) die het
 * gebruikt, ook de gedeelde: een element staat in één map maar kan op meer diagrammen voorkomen. Zo
 * blijft de groepering per profiel zichtbaar zonder dat iets dubbel bestaat.
 *
 * De naam van een element is de id van de vorm of het icoon; de element-id is daarvan afgeleid
 * (`wv_<id>`, `wi_<id>`), zodat een volgende export dezelfde elementen houdt.
 *
 *   map Koppelingen           per profiel een diagram met zijn koppelingen (stap 3)
 *
 * **Koppeling** (stap 3): hoe de elementtypen van één profiel getekend worden — per elementtype
 * `{shape, icoon, kleur, achtergrond}`, per relatie zijn `edgePresentatie`, en de `typeWeergave`.
 * De standaard (zonder set) komt uit de waarden in het M2; elke shape-set van het profiel is een
 * koppeling met een set-id (de shapes van de set, overlay zoals nu). `pasKoppelingToe` zet een
 * koppeling op het geregistreerde profiel, op zijn plek (zoals profielen laden): wat de koppeling
 * voor een elementtype noemt, vervangt de M2-waarde; een elementtype dat ze niet noemt, houdt de
 * waarde uit het M2.
 *
 * Iconen: de ingebouwde staan als SVG-tekst in `diagramcore/shapes/ingebouwdeIconen.js`
 * (gegenereerd uit de JSX, die de reserve blijft); `iconenUitProject` leest ze terug. Ze in de tool
 * zetten (registreerDataIcoon) doet de Studio (weergaveActivity.jsx), want de iconen zijn React.
 *
 * `vormenUitProject` en `laadVormen` doen de omgekeerde weg: de vormen uit het project in de tool
 * (op hun plek vervangen; het register zoekt bij elke tekening op id). Een vorm met een renderer
 * die deze tool niet kent, wordt niet geladen en gemeld.
 *
 * Puur, op het register van de vormen na (`laadVormen`).
 */
import { WEERGAVE_PROFIEL_ID, VORM_TYPE, ICOON_TYPE, KOPPELING_TYPE } from "../diagramprofielen/weergave/index.js";
import { getRenderer, getShapeType, registreerShapeType, valideerShapeType } from "../diagramcore/types/shapeType.js";
import { versieVan } from "../diagramcore/types/profielVersie.js";
import { PROJECT_FORMAAT, PROJECT_FORMAAT_VERSIE } from "./activities/projectSync.js";
import { kopUitDeCode, SOORT_WEERGAVEN } from "./projectGebruik.js";

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
/** De element-id van een icoon. */
export const icoonElementId = (icoonId) => `wi_${veilig(icoonId)}`;
/** De element-id van een koppeling: per profiel, en per set. */
export const koppelingElementId = (profielId, set = "") => `wk_${veilig(profielId)}${set ? `__${veilig(set)}` : ""}`;
/** De vormsleutels van een elementtype (geen relatie) die in een koppeling staan. */
const NODE_SLEUTELS = ["shape", "icoon", "kleur", "achtergrond"];
/** Standaardiconen per ShapeType (typeIconen.jsx `STANDAARD_ICOON_PREFIX`). */
const STANDAARD = "vorm:";

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

/**
 * Welke profielen wijzen welk icoon aan (`ElementType.icoon`, ook bij relaties).
 * @param {any[]} descriptors
 * @returns {Map<string, string[]>} icoon-id → profiel-labels (in volgorde, uniek)
 */
export function icoonGebruik(descriptors) {
  const gebruik = new Map();
  for (const d of descriptors || []) {
    const naam = d.label || d.id;
    for (const et of d.elementTypes || []) {
      if (et._superprofiel || !et.icoon) continue;
      const lijst = gebruik.get(et.icoon) || [];
      if (!lijst.includes(naam)) lijst.push(naam);
      gebruik.set(et.icoon, lijst);
    }
  }
  return gebruik;
}

/**
 * Een icoon als element in het profiel Weergave.
 * @param {{id: string, svg: string, monochroom?: boolean, label?: string}} icoon
 */
export function icoonNaarElement({ id, svg, monochroom = false, label }) {
  const data = { svg, monochroom: !!monochroom };
  if (label) data.label = label;
  return { id: icoonElementId(id), naam: id, elementType: ICOON_TYPE, compartimenten: [], data };
}

/**
 * De koppelingen van een profiel: de standaard uit de M2-waarden en een per shape-set.
 * @param {any} descriptor
 * @returns {{profiel: string, set: string, setLabel?: string, typeWeergave?: string, regels: Record<string, any>, overig?: any}[]}
 */
export function koppelingenVan(descriptor) {
  const regels = {};
  for (const et of descriptor?.elementTypes || []) {
    if (et._superprofiel) continue;
    if (et.isConnector) regels[et.id] = kopie(et.edgePresentatie || {});
    else regels[et.id] = Object.fromEntries(NODE_SLEUTELS.filter((k) => et[k] !== undefined).map((k) => [k, kopie(et[k])]));
  }
  const standaard = { profiel: descriptor.id, set: "", regels };
  if (descriptor.typeWeergave !== undefined) standaard.typeWeergave = descriptor.typeWeergave;
  const sets = (descriptor.shapeSets || []).map((set) => {
    const { id, label, shapes, ...overig } = set;
    return { profiel: descriptor.id, set: id, ...(label ? { setLabel: label } : {}), regels: kopie(shapes || {}), ...(Object.keys(overig).length ? { overig: kopie(overig) } : {}) };
  });
  return [standaard, ...sets];
}

/**
 * Een koppeling als element in het profiel Weergave.
 * @param {ReturnType<typeof koppelingenVan>[number]} k
 * @param {string} [profielLabel]
 */
export function koppelingNaarElement(k, profielLabel = k.profiel) {
  const data = { profiel: k.profiel, regels: kopie(k.regels) };
  if (k.set) data.set = k.set;
  if (k.setLabel) data.setLabel = k.setLabel;
  if (k.typeWeergave !== undefined) data.typeWeergave = k.typeWeergave;
  if (k.overig) data.overig = kopie(k.overig);
  const naam = k.set ? `${profielLabel} — ${k.setLabel || k.set}` : `${profielLabel} — standaard`;
  return { id: koppelingElementId(k.profiel, k.set), naam, elementType: KOPPELING_TYPE, compartimenten: [], data };
}

/** Een raster van nodes. */
const raster = (elementIds) =>
  elementIds.map((elementId, i) => ({ elementId, position: { x: 40 + (i % KOLOMMEN) * CEL.w, y: 40 + Math.floor(i / KOLOMMEN) * CEL.h } }));

/**
 * Het weergaveproject.
 * @param {Object} invoer
 * @param {any[]} invoer.shapeTypes - alle vormen van de tool (types/shapeType.js `alleShapeTypes`)
 * @param {Record<string, string|{svg: string, monochroom?: boolean, label?: string}>} [invoer.iconen] -
 *   icoon-id → SVG-tekst (of een data-icoon); de ingebouwde staan in ingebouwdeIconen.js
 * @param {any[]} invoer.descriptors - de profielen (voor de groepering)
 * @param {any} [invoer.taalDescriptor] - het profiel Weergave (voor zijn versie)
 * @param {string} [invoer.naam]
 * @returns {Record<string, any>} een werkbestand (formaat studio-project)
 */
export function weergaveProject({ shapeTypes, iconen = {}, descriptors, taalDescriptor = null, naam = "Omnium weergaven" }) {
  const mappen = {};
  const plaatsing = {};
  const model = { diagramTypeId: WEERGAVE_PROFIEL_ID, elements: {}, diagrams: {}, actiefDiagramId: null, meta: {} };
  const map = (id, mapNaam, ouderId, volgorde) => {
    mappen[id] = { id, naam: mapNaam, ouderId, volgorde };
    return id;
  };
  const diagram = (id, diagramNaam, mapId, elementIds) => {
    model.diagrams[id] = { id, naam: diagramNaam, diagramType: WEERGAVE_PROFIEL_ID, nodes: raster(elementIds), edges: [] };
    model.actiefDiagramId ??= id;
    plaatsing[`${WEERGAVE_ACTIVITEIT_ID}::${id}`] = mapId;
  };

  /**
   * Eén soort (vormen of iconen) in een hoofdmap, met een submap per profiel, Gedeeld en Niet in
   * een profiel; `vooraf` = eigen submappen vóór de rest (id's die dan niet meer meetellen).
   */
  const groepeer = ({ sleutel, mapNaam, volgorde, ids, gebruik, elementId, woord, vooraf = [] }) => {
    const hoofd = map(`map_${sleutel}`, mapNaam, null, volgorde);
    const bekend = new Set(ids);
    const elementMap = {};
    let nr = 0;
    for (const { naam: submap, ids: eigen } of vooraf) {
      const lijst = eigen.filter((id) => bekend.has(id));
      if (!lijst.length) continue;
      const mapId = map(`map_${sleutel}_${veilig(submap)}`, submap, hoofd, ++nr);
      for (const id of lijst) {
        elementMap[elementId(id)] = mapId;
        bekend.delete(id);
      }
      diagram(`dg_${sleutel}_${veilig(submap)}`, submap, mapId, lijst.map(elementId));
    }
    const profielen = [...new Set([...gebruik.values()].flat())].sort((a, b) => a.localeCompare(b, "nl"));
    for (const profiel of profielen) {
      const mapId = map(`map_${sleutel}_${veilig(profiel)}`, profiel, hoofd, ++nr);
      const lijst = [...gebruik].filter(([id, wie]) => wie.includes(profiel) && bekend.has(id)).map(([id]) => id);
      for (const [id, wie] of gebruik) if (wie.length === 1 && wie[0] === profiel && bekend.has(id)) elementMap[elementId(id)] = mapId;
      if (lijst.length) diagram(`dg_${sleutel}_${veilig(profiel)}`, `${woord} van ${profiel}`, mapId, lijst.map(elementId));
    }
    const gedeeld = [...gebruik].filter(([id, wie]) => wie.length > 1 && bekend.has(id)).map(([id]) => id);
    if (gedeeld.length) {
      const mapId = map(`map_${sleutel}_gedeeld`, "Gedeeld", hoofd, ++nr);
      for (const id of gedeeld) elementMap[elementId(id)] = mapId;
      diagram(`dg_${sleutel}_gedeeld`, `Gedeelde ${woord.toLowerCase()}`, mapId, gedeeld.map(elementId));
    }
    const los = [...bekend].filter((id) => !gebruik.has(id));
    if (los.length) {
      const mapId = map(`map_${sleutel}_los`, "Niet in een profiel", hoofd, ++nr);
      for (const id of los) elementMap[elementId(id)] = mapId;
      diagram(`dg_${sleutel}_los`, `${woord} die geen profiel aanwijst`, mapId, los.map(elementId));
    }
    for (const [id, mapId] of Object.entries(elementMap)) plaatsing[`el::${WEERGAVE_ACTIVITEIT_ID}::${id}`] = mapId;
  };

  const vormIds = [];
  for (const st of shapeTypes || []) {
    if (model.elements[vormElementId(st.id)]) continue;
    const el = vormNaarElement(st);
    model.elements[el.id] = el;
    vormIds.push(st.id);
  }
  groepeer({ sleutel: "vormen", mapNaam: "Vormen", volgorde: 1, ids: vormIds, gebruik: vormGebruik(descriptors), elementId: vormElementId, woord: "Vormen" });

  const icoonIds = [];
  for (const [id, waarde] of Object.entries(iconen || {})) {
    const def = typeof waarde === "string" ? { id, svg: waarde } : { ...waarde, id };
    if (!def.svg) continue;
    const el = icoonNaarElement(def);
    model.elements[el.id] = el;
    icoonIds.push(id);
  }
  if (icoonIds.length) {
    groepeer({
      sleutel: "iconen",
      mapNaam: "Iconen",
      volgorde: 2,
      ids: icoonIds,
      gebruik: icoonGebruik(descriptors),
      elementId: icoonElementId,
      woord: "Iconen",
      vooraf: [{ naam: "Standaard per vorm", ids: icoonIds.filter((id) => id.startsWith(STANDAARD)) }],
    });
  }

  // Koppelingen: per profiel een diagram met de standaard en de shape-sets, naast elkaar.
  const metKoppeling = [...(descriptors || [])].filter((d) => d?.id && (d.elementTypes || []).length).sort((a, b) => String(a.label || a.id).localeCompare(String(b.label || b.id), "nl"));
  if (metKoppeling.length) {
    const mapId = map("map_koppelingen", "Koppelingen", null, 3);
    for (const descriptor of metKoppeling) {
      const ids = koppelingenVan(descriptor).map((k) => {
        const el = koppelingNaarElement(k, descriptor.label || descriptor.id);
        model.elements[el.id] = el;
        plaatsing[`el::${WEERGAVE_ACTIVITEIT_ID}::${el.id}`] = mapId;
        return el.id;
      });
      const id = `dg_koppeling_${veilig(descriptor.id)}`;
      model.diagrams[id] = {
        id,
        naam: `Koppeling van ${descriptor.label || descriptor.id}`,
        diagramType: WEERGAVE_PROFIEL_ID,
        nodes: ids.map((elementId, i) => ({ elementId, position: { x: 40 + i * 330, y: 40 } })),
        edges: [],
      };
      plaatsing[`${WEERGAVE_ACTIVITEIT_ID}::${id}`] = mapId;
    }
  }

  return {
    formaat: PROJECT_FORMAAT,
    versie: PROJECT_FORMAAT_VERSIE,
    // Soort en versie in de kop (projectGebruik.js): uit de code = de versie van de Studio.
    project: { id: WEERGAVE_PROJECT_ID, naam, ...kopUitDeCode(SOORT_WEERGAVEN) },
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

/**
 * De iconen uit een model in het profiel Weergave.
 * @param {{elements?: Record<string, any>}} inhoud
 * @returns {{iconen: {id: string, svg: string, monochroom: boolean, label?: string}[], fouten: string[]}}
 */
export function iconenUitProject(inhoud) {
  const iconen = [];
  const fouten = [];
  const gezien = new Set();
  for (const el of Object.values(inhoud?.elements || {})) {
    if (el.elementType !== ICOON_TYPE) continue;
    const id = String(el.naam || "").trim();
    const svg = String(el.data?.svg || "").trim();
    if (!id) fouten.push("icoon zonder naam (de naam is de id)");
    else if (!svg) fouten.push(`icoon "${id}": geen SVG`);
    else if (gezien.has(id)) fouten.push(`icoon "${id}" staat twee keer in het project`);
    else {
      gezien.add(id);
      iconen.push({ id, svg, monochroom: el.data?.monochroom === true, ...(el.data?.label ? { label: el.data.label } : {}) });
    }
  }
  return { iconen, fouten };
}

/**
 * De koppelingen uit een model in het profiel Weergave.
 * @param {{elements?: Record<string, any>}} inhoud
 * @returns {{koppelingen: ReturnType<typeof koppelingenVan>, fouten: string[]}}
 */
export function koppelingenUitProject(inhoud) {
  const koppelingen = [];
  const fouten = [];
  const gezien = new Set();
  for (const el of Object.values(inhoud?.elements || {})) {
    if (el.elementType !== KOPPELING_TYPE) continue;
    const d = el.data || {};
    const profiel = String(d.profiel || "").trim();
    const set = String(d.set || "").trim();
    const wie = `koppeling "${el.naam || el.id}"`;
    if (!profiel) fouten.push(`${wie}: geen profiel`);
    else if (!isObject(d.regels)) fouten.push(`${wie}: de regels moeten een object zijn`);
    else if (gezien.has(`${profiel}::${set}`)) fouten.push(`${wie}: ${profiel}${set ? ` (set ${set})` : ""} staat twee keer in het project`);
    else {
      gezien.add(`${profiel}::${set}`);
      const k = { profiel, set, regels: kopie(d.regels) };
      if (d.setLabel) k.setLabel = d.setLabel;
      if (d.typeWeergave !== undefined) k.typeWeergave = d.typeWeergave;
      if (isObject(d.overig)) k.overig = kopie(d.overig);
      koppelingen.push(k);
    }
  }
  return { koppelingen, fouten };
}

/**
 * Een koppeling op een profiel zetten, op zijn plek (de activiteiten houden het descriptor-object
 * vast). De standaard vervangt per genoemd elementtype de vormsleutels (een sleutel die ontbreekt,
 * valt weg; `shape` blijft altijd); een set vervangt of maakt de shape-set met die id.
 * @param {any} descriptor - het geregistreerde profiel
 * @param {ReturnType<typeof koppelingenVan>[number]} k
 * @returns {string[]} meldingen (bv. een elementtype dat het profiel niet kent)
 */
export function pasKoppelingToe(descriptor, k) {
  const meldingen = [];
  const typen = new Map((descriptor.elementTypes || []).filter((et) => !et._superprofiel).map((et) => [et.id, et]));
  for (const etId of Object.keys(k.regels || {})) if (!typen.has(etId)) meldingen.push(`koppeling ${k.profiel}${k.set ? ` (set ${k.set})` : ""}: onbekend elementtype "${etId}"`);
  if (k.set) {
    const set = { id: k.set, ...(k.setLabel ? { label: k.setLabel } : {}), ...(k.overig ? kopie(k.overig) : {}), shapes: kopie(k.regels || {}) };
    const sets = (descriptor.shapeSets ||= []);
    const i = sets.findIndex((s) => s.id === k.set);
    if (i >= 0) sets[i] = set;
    else sets.push(set);
    return meldingen;
  }
  for (const [etId, et] of typen) {
    const regel = k.regels?.[etId];
    if (!isObject(regel)) continue;
    if (et.isConnector) {
      if (Object.keys(regel).length) et.edgePresentatie = kopie(regel);
      else delete et.edgePresentatie;
      continue;
    }
    for (const sleutel of NODE_SLEUTELS) {
      if (regel[sleutel] !== undefined && regel[sleutel] !== "") et[sleutel] = kopie(regel[sleutel]);
      else if (sleutel !== "shape") delete et[sleutel];
    }
  }
  if (k.typeWeergave !== undefined && k.typeWeergave !== "") descriptor.typeWeergave = k.typeWeergave;
  else delete descriptor.typeWeergave;
  return meldingen;
}

/**
 * De koppelingen in de tool zetten.
 * @param {ReturnType<typeof koppelingenVan>} koppelingen
 * @param {(id: string) => any} getDescriptor - het geregistreerde profiel op id
 * @returns {{toegepast: string[], fouten: string[]}} toegepast = "profiel" of "profiel/set"
 */
export function laadKoppelingen(koppelingen, getDescriptor) {
  const toegepast = [];
  const fouten = [];
  for (const k of koppelingen || []) {
    const descriptor = getDescriptor(k.profiel);
    if (!descriptor) {
      fouten.push(`koppeling: onbekend profiel "${k.profiel}"`);
      continue;
    }
    fouten.push(...pasKoppelingToe(descriptor, k));
    toegepast.push(k.set ? `${k.profiel}/${k.set}` : k.profiel);
  }
  return { toegepast, fouten };
}
