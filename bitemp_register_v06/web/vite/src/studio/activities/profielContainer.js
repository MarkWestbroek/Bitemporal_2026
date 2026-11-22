// @ts-check
/**
 * profielContainer — het profiel als **container** in de M3-taal (plan "Sidecar-project", §9 en §7
 * stap 9; besluit Mark 22-11).
 *
 * Tot 22-11 droeg het **diagram** het profiel: `m3Profiel`, `shapeSets` en `typeWeergave` stonden op
 * het ontwerp-diagram, en één diagram was één profiel. Mark: een profiel kan ingewikkeld zijn en
 * meerdere views vragen; het model is één. Daarom definieert het M3 nu **Profiel** als container
 * (`profielDef`, vorm map), zoals het package (domein) in het canonieke model:
 *
 *   - de kopgegevens van het profiel (de DiagramType-eigenschappen, `m3:*`) zijn eigenschappen van
 *     het Profiel-element, met historie zoals elke eigenschap; `shapeSets` en `typeWeergave` staan
 *     er als gegevens bij (de weergaven bewerken ze, zie het weergaveproject);
 *   - **lidmaatschap**: het Profiel `bevat` zijn elementtypen, facetten en layoutstijlen (de
 *     lidmaatschapsrelatie, ook de boom); compartiment- en veldtypen horen erbij via hun
 *     ◆-compositie. Een knoop op een diagram dat onder het profiel hangt (`diagram.profiel`), hoort
 *     er ook bij: zo telt wat je op een view tekent meteen mee;
 *   - de **diagrammen** zijn views: ze hangen in de boom onder het Profiel (uitwerking) en wijzen
 *     ernaar met `diagram.profiel`;
 *   - de **JSON** (de descriptor) is een afgeleide, alleen-lezen eigenschap van het Profiel (Mark
 *     22-11: niet bewerken, er zitten te veel constraints op).
 *
 * Een oud project (een diagram met `m3Profiel` en geen Profiel-element) blijft werken: dan is dat
 * diagram het profiel, zoals voorheen (`kernenUitProject`). `metProfielContainer` zet een ontwerp
 * om naar de nieuwe vorm.
 *
 * Puur en store-loos.
 */

export const PROFIEL_TYPE = "profielDef";
export const BEVAT_TYPE = "bevat";
/** Knoopsoorten die een Profiel direct bevat (de rest hangt eraan via een ◆-compositie). */
export const DIRECT_IN_PROFIEL = ["elementDef", "facetDef", "layoutStijlDef", "notitie"];

/**
 * Het ontwerp van één profiel (uit `ontwerpUitProfiel`) in de container-vorm: een Profiel-element
 * met de kopgegevens, `bevat`-relaties naar de elementen, en het diagram als view.
 * @param {{elements: Record<string, any>, diagrams: Record<string, any>}} ontwerp
 * @param {{prefix: string, naam?: string}} opties
 * @returns {{elements: Record<string, any>, diagrams: Record<string, any>, profielId: string}}
 */
export function metProfielContainer(ontwerp, { prefix, naam }) {
  const profielId = `${prefix}_profiel`;
  const elements = { ...ontwerp.elements };
  const diagrams = {};
  let kop = {};
  let label = naam;
  for (const [id, d] of Object.entries(ontwerp.diagrams || {})) {
    const { m3Profiel, shapeSets, typeWeergave, ...view } = d;
    // Eén ontwerp = één profiel; het eerste diagram levert de kop.
    if (!Object.keys(kop).length) {
      kop = {
        ...(m3Profiel || {}),
        ...(shapeSets?.length ? { shapeSets } : {}),
        ...(typeWeergave ? { typeWeergave } : {}),
      };
      label ??= d.naam;
    }
    diagrams[id] = { ...view, profiel: profielId };
  }
  elements[profielId] = { id: profielId, naam: label || prefix, elementType: PROFIEL_TYPE, compartimenten: [], data: kop };
  // Lidmaatschap: alles wat niet via een ◆-compositie aan iets anders hangt.
  const viaCompositie = new Set(Object.values(ontwerp.elements).filter((e) => e.elementType === "compositie" && e.target).map((e) => e.target));
  for (const el of Object.values(ontwerp.elements)) {
    if (el.source || !DIRECT_IN_PROFIEL.includes(el.elementType) || viaCompositie.has(el.id)) continue;
    const cid = `${profielId}_bevat_${el.id}`;
    elements[cid] = { id: cid, naam: "", elementType: BEVAT_TYPE, source: profielId, target: el.id, compartimenten: [], data: {} };
  }
  return { elements, diagrams, profielId };
}

/** De Profiel-elementen van een model. */
export const profielenIn = (elements) => Object.values(elements || {}).filter((el) => el?.elementType === PROFIEL_TYPE);

/**
 * De elementen van één profiel: wat het `bevat`, wat daaraan hangt via een ◆-compositie, de knopen
 * op zijn views (`diagram.profiel`), en de lijnen tussen die elementen (zonder de `bevat`-lijnen).
 * @param {any} profiel - het Profiel-element
 * @param {{elements: Record<string, any>, diagrams?: Record<string, any>}} inhoud
 * @returns {Record<string, any>}
 */
export function ledenVan(profiel, { elements, diagrams = {} }) {
  const leden = new Set();
  const lijnen = Object.values(elements || {}).filter((e) => e?.source && e?.target);
  for (const c of lijnen) if (c.elementType === BEVAT_TYPE && c.source === profiel.id) leden.add(c.target);
  for (const d of Object.values(diagrams || {})) {
    if (d?.profiel !== profiel.id) continue;
    for (const n of d.nodes || []) if (elements[n.elementId] && elements[n.elementId].elementType !== PROFIEL_TYPE) leden.add(n.elementId);
  }
  // Wat aan een lid hangt via een ◆-compositie (ET ◆ CT ◆ VT), herhaald tot er niets bijkomt.
  for (let groeit = true; groeit; ) {
    groeit = false;
    for (const c of lijnen) {
      if (c.elementType === "compositie" && leden.has(c.source) && !leden.has(c.target) && elements[c.target]) {
        leden.add(c.target);
        groeit = true;
      }
    }
  }
  const uit = {};
  for (const id of leden) uit[id] = elements[id];
  for (const c of lijnen) if (c.elementType !== BEVAT_TYPE && leden.has(c.source) && leden.has(c.target)) uit[c.id] = c;
  return uit;
}

/**
 * De invoer van `bouwProfielUitOntwerp` voor één Profiel-element.
 * @param {any} profiel
 * @param {{elements: Record<string, any>, diagrams?: Record<string, any>}} inhoud
 */
export function ontwerpStaatVan(profiel, inhoud) {
  const { shapeSets, typeWeergave, ...m3Profiel } = profiel.data || {};
  return { elements: ledenVan(profiel, inhoud), shapeSets, typeWeergave, m3Profiel };
}

/** De views van een profiel (diagrammen met `profiel` = dit element). */
export const viewsVan = (profiel, diagrams) => Object.values(diagrams || {}).filter((d) => d?.profiel === profiel.id);
