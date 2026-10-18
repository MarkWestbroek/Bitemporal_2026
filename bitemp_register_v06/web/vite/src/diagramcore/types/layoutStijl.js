// @ts-check
/**
 * layoutStijl — betekenis en weergave van de automatische layout, gescheiden
 * (M3, 2026-10-18; vraag van Mark via OMNIUM-UI: "waar horen de regels voor
 * auto-layout in het metametamodel?").
 *
 * Twee lagen, zoals OMG MOF + Diagram Definition ze scheiden:
 *
 *   - **Betekenis** (abstracte syntaxis, Definitie-domein): wat een type ís.
 *     `ElementType.aard` op connectoren (stroom, specialisatie, bericht, …) en
 *     elementen (begin, eind, baan), en `ElementType.facetten` voor een
 *     indeling zoals de ArchiMate-laag. Geen layout-woorden: dezelfde aard
 *     dient ook transformaties, documenten, validatie en de MCP.
 *   - **Weergave** (Stijl-domein): `DiagramType.layoutStijlen` — per diagram
 *     te kiezen (`diagram.layoutStijl`, anders de eerste). Een stijl noemt een
 *     **LayoutRenderer** (het algoritme, Implementatie-domein; nu
 *     "leesvolgorde", diagramcore/layout/leesvolgorde.js) en regels die per
 *     type kiezen, zoals CSS: van algemeen (aard) naar specifiek (type-id),
 *     de laatste wint. Het resultaat landt zoals OMG DI: posities en maten
 *     per voorkomen.
 *
 * Zelfde patroon als ShapeType/ShapeRenderer en LineStyle/LineRenderer in het
 * metametamodel. `regelsVoorStijl` vertaalt een stijl naar het
 * `Leesvolgorde`-formaat dat de renderer al leest, zodat die niet hoeft te
 * veranderen om de nieuwe gegevens te gebruiken.
 *
 * Puur: geen DOM, geen stores.
 */
/**
 * Terugval voor connectoren zonder `aard`: deze ids lezen "ouder/abstract eerst"
 * (zoals aard specialisatie/realisatie). Hier en niet in de renderer: het is
 * betekenis; layout/leesvolgorde.js exporteert hem door.
 */
export const STANDAARD_OMGEKEERD = ["generalisatie", "specialisatie", "subtype", "implements", "realisatie", "realiseert"];

/**
 * Aard van een connector-ElementType — wat de verbinding betekent.
 *  - stroom: de volgorde van gedrag (control/object flow, sequence flow,
 *    transitie, on-part, ArchiMate triggering/flow, item flow);
 *  - specialisatie: generalisatie/subtype — de ouder is het algemenere;
 *  - realisatie: realisatie/implements — het doel is het abstractere;
 *  - bericht: communicatie tussen deelnemers (message flow, sequence-bericht);
 *  - associatie: een structurele band zonder richting in betekenis;
 *  - afhankelijkheid: gebruik, include/extend, trace, serving/access/influence;
 *  - toewijzing: ArchiMate assignment, UML deployment/allocation;
 *  - insluiting: compositie, aggregatie, lidmaatschap (bevat);
 *  - annotatie: notitie-lijn — commentaar, geen modelband.
 */
export const AARD_CONNECTOR = ["stroom", "specialisatie", "realisatie", "bericht", "associatie", "afhankelijkheid", "toewijzing", "insluiting", "annotatie"];

/** Aard van een knoop-ElementType: begin (InitialNode, StartEvent), eind (FinalNode, EndEvent), baan (partitie, lane). */
export const AARD_ELEMENT = ["begin", "eind", "baan"];

/** Standaard leesrichting per connector-aard; de rest telt gewoon mee ("mee"). */
export const STANDAARD_VOLGORDE = Object.freeze({
  stroom: "mee",
  specialisatie: "omgekeerd",
  realisatie: "omgekeerd",
  bericht: "negeer",
  annotatie: "negeer",
});

/** Bekende LayoutRenderers (Implementatie-domein). */
export const LAYOUT_RENDERERS = ["leesvolgorde"];

const RICHTINGEN = ["TB", "LR", "BT", "RL"];
const SELECTOR_SLEUTELS = ["aard", "elementType", "connectorType", "erft", "facet"];
const OPTIE_SLEUTELS = ["volgorde", "positie", "baan"];

/**
 * Valideer `aard` en `facetten` op de typen van een (uitgevlakt) DiagramType.
 * @param {any} dt
 * @returns {string[]} foutmeldingen
 */
export function valideerAardEnFacetten(dt) {
  const fouten = [];
  const facetDef = dt?.facetten || {};
  for (const [naam, waarden] of Object.entries(facetDef)) {
    if (!Array.isArray(waarden) || !waarden.length) fouten.push(`DiagramType "${dt.id}": facet "${naam}" heeft geen waarden`);
  }
  for (const et of dt?.elementTypes || []) {
    if (et?.aard !== undefined) {
      const lijst = et.isConnector ? AARD_CONNECTOR : AARD_ELEMENT;
      if (!lijst.includes(et.aard)) {
        fouten.push(`DiagramType "${dt.id}", ElementType "${et.id}": onbekende aard "${et.aard}" (${et.isConnector ? "connector" : "element"}: ${lijst.join(", ")})`);
      }
    }
    for (const [naam, waarde] of Object.entries(et?.facetten || {})) {
      if (!facetDef[naam]) fouten.push(`DiagramType "${dt.id}", ElementType "${et.id}": facet "${naam}" staat niet in DiagramType.facetten`);
      else if (!facetDef[naam].includes(waarde)) fouten.push(`DiagramType "${dt.id}", ElementType "${et.id}": facet ${naam}="${waarde}" is geen waarde van ${facetDef[naam].join(", ")}`);
    }
  }
  return fouten;
}

/**
 * Valideer één LayoutStijl tegen zijn DiagramType.
 * @param {any} dt
 * @param {any} stijl
 * @returns {string[]}
 */
export function valideerLayoutStijl(dt, stijl) {
  const fouten = [];
  const waar = `DiagramType "${dt?.id}", layoutStijl "${stijl?.id ?? "?"}"`;
  if (!stijl?.id) fouten.push(`${waar}: id ontbreekt`);
  if (!LAYOUT_RENDERERS.includes(stijl?.renderer)) fouten.push(`${waar}: onbekende renderer "${stijl?.renderer}" (${LAYOUT_RENDERERS.join(", ")})`);
  if (stijl?.richting && !RICHTINGEN.includes(stijl.richting)) fouten.push(`${waar}: richting "${stijl.richting}" is geen ${RICHTINGEN.join("/")}`);
  for (const as of ["rijen", "kolommen"]) {
    if (stijl?.[as] && !dt?.facetten?.[stijl[as]]) fouten.push(`${waar}: ${as} "${stijl[as]}" is geen facet van het DiagramType`);
  }
  const ids = new Set((dt?.elementTypes || []).map((e) => e.id));
  for (const [i, r] of (stijl?.regels || []).entries()) {
    const sel = r?.selector || {};
    for (const k of Object.keys(sel)) if (!SELECTOR_SLEUTELS.includes(k)) fouten.push(`${waar}, regel ${i + 1}: onbekende selector "${k}"`);
    for (const k of ["elementType", "connectorType", "erft"]) if (sel[k] && !ids.has(sel[k])) fouten.push(`${waar}, regel ${i + 1}: ${k} "${sel[k]}" bestaat niet`);
    for (const k of Object.keys(r?.opties || {})) if (!OPTIE_SLEUTELS.includes(k)) fouten.push(`${waar}, regel ${i + 1}: onbekende optie "${k}"`);
  }
  return fouten;
}

/** De stijl die geldt: de gekozen (op id), anders de eerste van het profiel, anders de generieke standaard. */
export function stijlVoor(dt, stijlId = null) {
  const lijst = dt?.layoutStijlen || [];
  return (stijlId && lijst.find((s) => s.id === stijlId)) || lijst[0] || { id: "standaard", label: "Standaard", renderer: "leesvolgorde" };
}

/** Is `et` het type `voorouderId` of erft het daar (via de `erft`-keten) van? */
function erftVan(et, voorouderId, perId) {
  for (let t = et, n = 0; t && n < 50; t = perId.get(t.erft), n += 1) if (t.id === voorouderId) return true;
  return false;
}

/** Past een selector op een ElementType? (`facet` = {naam: waarde}). */
function past(sel, et, perId) {
  if (!sel || !et) return false;
  if (sel.aard && et.aard !== sel.aard) return false;
  if (sel.elementType && (et.isConnector || et.id !== sel.elementType)) return false;
  if (sel.connectorType && (!et.isConnector || et.id !== sel.connectorType)) return false;
  if (sel.erft && !erftVan(et, sel.erft, perId)) return false;
  if (sel.facet && !Object.entries(sel.facet).every(([n, w]) => et.facetten?.[n] === w)) return false;
  return true;
}

/** Specificiteit zoals CSS: type-id > erft/facet > aard. */
function gewicht(sel) {
  return (sel?.elementType || sel?.connectorType ? 100 : 0) + (sel?.erft ? 10 : 0) + (sel?.facet ? 10 : 0) + (sel?.aard ? 1 : 0);
}

/**
 * Vertaal betekenis + stijl naar het `Leesvolgorde`-formaat van de renderer.
 *
 * Connectoren: de standaard volgt uit de aard (STANDAARD_VOLGORDE); zonder aard
 * telt een connector mee, behalve de oude omgekeerd-ids (generalisatie, …) zodat
 * profielen zonder aard zich gedragen als voorheen. `alleenStroom` (een
 * weergavekeuze voor stroomdiagrammen) laat alleen aard "stroom" meetellen.
 * Daarna de regels van de stijl, op specificiteit (gelijk = volgorde).
 *
 * @param {any} dt - (uitgevlakt) DiagramType
 * @param {any} [stijl] - LayoutStijl (standaard: stijlVoor(dt))
 * @returns {{richting: string, stroom: string[], omgekeerd: string[], negeer: string[], start: string[], eind: string[], banen: string[], lagen?: string[][], kolommen?: string[][]}}
 */
export function regelsVoorStijl(dt, stijl = stijlVoor(dt)) {
  const regels = [...(stijl?.regels || [])].map((r, i) => ({ ...r, i })).sort((a, b) => gewicht(a.selector) - gewicht(b.selector) || a.i - b.i);
  const perId = new Map((dt?.elementTypes || []).map((e) => [e.id, e]));
  const opties = (et) => {
    const o = {};
    for (const r of regels) if (past(r.selector, et, perId)) Object.assign(o, r.opties);
    return o;
  };
  const uit = { richting: stijl?.richting || "TB", stroom: [], omgekeerd: [], negeer: [], start: [], eind: [], banen: [] };
  for (const et of dt?.elementTypes || []) {
    if (et.isAbstract) continue;
    const o = opties(et);
    if (et.isConnector) {
      let v = et.aard ? STANDAARD_VOLGORDE[et.aard] || "mee" : STANDAARD_OMGEKEERD.includes(et.id) ? "omgekeerd" : "mee";
      if (stijl?.alleenStroom && et.aard !== "stroom") v = "negeer";
      if (o.volgorde) v = o.volgorde;
      if (v === "negeer") uit.negeer.push(et.id);
      else {
        uit.stroom.push(et.id);
        if (v === "omgekeerd") uit.omgekeerd.push(et.id);
      }
      continue;
    }
    // Een regel mag de standaard ook uitzetten (positie: null, baan: false).
    const positie = "positie" in o ? o.positie : et.aard === "begin" || et.aard === "eind" ? et.aard : null;
    if (positie === "begin") uit.start.push(et.id);
    if (positie === "eind") uit.eind.push(et.id);
    if ("baan" in o ? o.baan : et.aard === "baan") uit.banen.push(et.id);
  }
  const indeling = (facet) =>
    (dt?.facetten?.[facet] || [])
      .map((w) => (dt.elementTypes || []).filter((et) => !et.isConnector && !et.isAbstract && et.facetten?.[facet] === w).map((et) => et.id))
      .filter((l) => l.length);
  if (stijl?.rijen) uit.lagen = indeling(stijl.rijen);
  if (stijl?.kolommen) uit.kolommen = indeling(stijl.kolommen);
  return uit;
}
