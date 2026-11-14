// @ts-check
/**
 * keuzeBoom — de boom met vinkjes in *Verschil met MAIN…* (branch terugmergen stap 2, besluit
 * Mark 14-11: "kiezen in een boom, niet in een lijst"). Zuivere functies; de dialoog tekent.
 *
 * De boom volgt de projectboom van de branch, beperkt tot wat verschilt:
 *   map → submap → diagram of element → relatie (onder haar bron) of kind (onder zijn boomouder).
 * Koppelingen tussen talen (kruisverbanden) staan in een eigen groep, net als eenheden zonder map.
 * Wat alleen op MAIN veranderde, staat niet in de boom: dat komt altijd mee naar de branch.
 *
 * Een vinkje op een ouder zet alles eronder aan of uit; een half gekozen ouder staat "half". Een
 * map die zelf veranderde (naam, ouder) draagt zijn eigen wijziging als onderdeel van zijn vinkje.
 *
 * Keuze = `{[verschilSleutel]: true | false | "terug"}` en gaat zo naar POST …/samenvoegen.
 * Standaard aan, behalve een conflict (dan blijft MAIN, tot je de branch kiest) en, bij een branch
 * van een map, wat buiten die map ligt. "terug" (per regel, knop ↶) zet de eenheid in de branch
 * terug naar de versie van MAIN; voor het vinkje telt dat als uit.
 */

/** @typedef {import("./verschilMetMain.js").Verschil} Verschil */
/**
 * @typedef {{knoopId: string, soort: "map"|"groep"|"eenheid", label: string,
 *            verschil: Verschil|null, kinderen: Knoop[]}} Knoop
 */

/**
 * Standaardkeuze voor de verschillen van de branch.
 * @param {Verschil[]} verschillen @param {{heeftMap?: boolean}} [opties]
 * @returns {Record<string, boolean>}
 */
export function standaardKeuze(verschillen, { heeftMap = true } = {}) {
  const uit = {};
  for (const v of verschillen || []) {
    if (v.status === "main") continue;
    uit[v.sleutel] = v.status !== "conflict" && (!heeftMap || v.inScope);
  }
  return uit;
}

const SOORT_VOLGORDE = { map: 0, groep: 1, diagram: 2, element: 3, kruisverband: 4 };
const volgordeVan = (k) => SOORT_VOLGORDE[k.soort === "eenheid" ? k.verschil?.soort : k.soort] ?? 9;

/**
 * Bouw de keuzeboom.
 * @param {Verschil[]} verschillen
 * @param {Record<string, {id: string, naam: string, ouderId: string|null}>} [mappen]
 * @returns {Knoop[]} de wortels
 */
export function bouwKeuzeBoom(verschillen, mappen = {}) {
  const items = (verschillen || []).filter((v) => v.status !== "main");
  /** @type {Map<string, Knoop>} */
  const mapKnopen = new Map();
  /** @type {Knoop[]} */
  const wortels = [];
  const groepen = new Map();
  const groep = (id, label) => {
    if (!groepen.has(id)) {
      const k = { knoopId: `groep:${id}`, soort: /** @type {const} */ ("groep"), label, verschil: null, kinderen: [] };
      groepen.set(id, k);
    }
    return groepen.get(id);
  };

  // Map-knoop met zijn hele ouderketen (zonder lussen).
  const mapKnoop = (mapId, pad = new Set()) => {
    if (mapKnopen.has(mapId)) return mapKnopen.get(mapId);
    const m = mappen[mapId];
    /** @type {Knoop} */
    const k = { knoopId: `map:${mapId}`, soort: "map", label: m?.naam || mapId, verschil: null, kinderen: [] };
    mapKnopen.set(mapId, k);
    pad.add(mapId);
    const ouder = m?.ouderId;
    if (ouder && mappen[ouder] && !pad.has(ouder)) mapKnoop(ouder, pad).kinderen.push(k);
    else wortels.push(k);
    return k;
  };

  // Eerst de mappen die zelf veranderden: hun wijziging hoort bij de map-knoop.
  for (const v of items) {
    if (v.soort === "map") mapKnoop(v.id).verschil = v;
  }

  // Dan de eenheden. Elementen kunnen onder een ander element hangen (relatie onder haar bron).
  /** @type {Map<string, Knoop>} */
  const eenheden = new Map();
  for (const v of items) {
    if (v.soort === "map") continue;
    eenheden.set(v.sleutel, { knoopId: `eenheid:${v.sleutel}`, soort: "eenheid", label: v.naam || v.id, verschil: v, kinderen: [] });
  }
  const ouderSleutel = (v) => (v.soort === "element" && v.ouderId ? `element:${v.profielId ?? ""}:${v.ouderId}` : null);
  // Een ouder telt alleen als de keten niet terugloopt.
  const geldigeOuder = (v) => {
    let s = ouderSleutel(v);
    const gezien = new Set([v.sleutel]);
    const eerste = s;
    while (s && eenheden.has(s)) {
      if (gezien.has(s)) return null;
      gezien.add(s);
      s = ouderSleutel(eenheden.get(s).verschil);
    }
    return eerste && eenheden.has(eerste) ? eerste : null;
  };
  for (const k of eenheden.values()) {
    const v = /** @type {Verschil} */ (k.verschil);
    const ouder = geldigeOuder(v);
    if (ouder) eenheden.get(ouder).kinderen.push(k);
    else if (v.soort === "kruisverband") groep("kruis", "Koppelingen tussen talen").kinderen.push(k);
    else if (v.mapId && mappen[v.mapId]) mapKnoop(v.mapId).kinderen.push(k);
    else groep("zonder", "Zonder map").kinderen.push(k);
  }

  const sorteer = (lijst) => {
    lijst.sort((a, b) => volgordeVan(a) - volgordeVan(b) || a.label.localeCompare(b.label));
    for (const k of lijst) sorteer(k.kinderen);
    return lijst;
  };
  sorteer(wortels);
  for (const g of groepen.values()) sorteer(g.kinderen);
  // Mappen die alleen voor de keten nodig waren maar niets bevatten, bestaan niet: elke map-knoop
  // ontstaat uit een verschil of uit een kind. De groepen komen achteraan.
  return [...wortels, ...["zonder", "kruis"].filter((id) => groepen.has(id)).map((id) => groepen.get(id))];
}

/** Alle sleutels van eenheden in deze knoop en eronder (ook de eigen wijziging van een map). */
export function sleutelsVan(knoop) {
  const uit = [];
  const loop = (k) => {
    if (k.verschil) uit.push(k.verschil.sleutel);
    for (const c of k.kinderen) loop(c);
  };
  loop(knoop);
  return uit;
}

/**
 * Stand van het vinkje: "aan", "uit" of "half".
 * @param {Knoop} knoop @param {Record<string, boolean>} keuze
 */
export function standVan(knoop, keuze) {
  const s = sleutelsVan(knoop);
  const aan = s.filter((k) => keuze[k] === true).length;
  return aan === 0 ? "uit" : aan === s.length ? "aan" : "half";
}

/**
 * Zet alles in en onder een knoop aan of uit. Geeft een nieuwe keuze.
 * @param {Knoop} knoop @param {Record<string, boolean>} keuze @param {boolean} aan
 */
export function zetKnoop(knoop, keuze, aan) {
  const uit = { ...keuze };
  for (const k of sleutelsVan(knoop)) uit[k] = aan;
  return uit;
}

/**
 * Tellingen voor de knop en de bevestiging.
 * @param {Verschil[]} verschillen @param {Record<string, boolean>} keuze @param {{heeftMap?: boolean}} [opties]
 */
export function keuzeTelling(verschillen, keuze, { heeftMap = true } = {}) {
  const t = { gekozen: 0, nietGekozen: 0, terug: 0, conflictTak: 0, conflictMain: 0, buitenGekozen: 0, vanMain: 0 };
  for (const v of verschillen || []) {
    if (v.status === "main") { t.vanMain += 1; continue; }
    if (keuze[v.sleutel] === "terug") { t.terug += 1; continue; }
    const aan = keuze[v.sleutel] === true;
    if (aan) t.gekozen += 1; else t.nietGekozen += 1;
    if (v.status === "conflict") { if (aan) t.conflictTak += 1; else t.conflictMain += 1; }
    if (aan && heeftMap && !v.inScope) t.buitenGekozen += 1;
  }
  return t;
}
