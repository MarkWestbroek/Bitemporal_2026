// @ts-check
/**
 * keuzeBoom — de boom met vinkjes in *Verschil met MAIN…* (branch terugmergen stap 2, besluit
 * Mark 14-11: "kiezen in een boom, niet in een lijst"). Zuivere functies; de dialoog tekent.
 *
 * De boom volgt de projectboom van de branch, beperkt tot wat verschilt:
 *   map → submap → diagram of element → relatie (onder haar bron) of kind (onder zijn boomouder).
 * Koppelingen tussen talen (kruisverbanden) en diagrambundels staan in een eigen groep, net als
 * eenheden zonder map.
 * Wat alleen op MAIN veranderde, staat niet in de boom: dat komt altijd mee naar de branch.
 *
 * Per regel een **schuifje met drie standen** (Mark 14-11): links = MAIN overnemen in de branch
 * ("terug"), midden = niets doen (blijft in de branch, false), rechts = naar MAIN (true; bij een
 * conflict: MAIN overschrijven). Op een ouder zet het schuifje alles eronder; staan de kinderen
 * verschillend, dan is de stand "gemengd". Een map die zelf veranderde (naam, ouder) draagt zijn
 * eigen wijziging als onderdeel van zijn schuifje.
 *
 * Keuze = `{[verschilSleutel]: true | false | "terug"}` en gaat zo naar POST …/samenvoegen.
 * Standaard rechts, behalve een conflict (midden: MAIN houdt de zijne, tot je kiest) en, bij een
 * branch van een map, wat buiten die map ligt (midden).
 */

/** @typedef {import("./verschilMetMain.js").Verschil} Verschil */
/**
 * @typedef {{knoopId: string, soort: "map"|"groep"|"eenheid", label: string,
 *            verschil: Verschil|null, kinderen: Knoop[],
 *            context?: {profielId: string, elementType?: string}}} Knoop
 * `context`: bij een ongewijzigde ouder (package) het profiel en type, voor het typelabel.
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

const SOORT_VOLGORDE = { map: 0, groep: 1, diagram: 2, element: 3, bundel: 4, kruisverband: 5 };
const volgordeVan = (k) => SOORT_VOLGORDE[k.soort === "eenheid" ? k.verschil?.soort : k.soort] ?? 9;

/**
 * Bouw de keuzeboom. `context` (uit verschilMetMain): ouder-elementen die zelf niet veranderden,
 * zoals het package waaronder een nieuw diagram staat; die komen als ouder (zonder eigen keuze) in
 * de boom, zodat de indeling die van de projectboom is.
 * @param {Verschil[]} verschillen
 * @param {Record<string, {id: string, naam: string, ouderId: string|null}>} [mappen]
 * @param {Record<string, {sleutel: string, profielId: string, id: string, naam: string, mapId: string|null, ouderId: string|null}>} [context]
 * @returns {Knoop[]} de wortels
 */
export function bouwKeuzeBoom(verschillen, mappen = {}, context = {}) {
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
  const ouderSleutel = (v) => ((v.soort === "element" || v.soort === "diagram") && v.ouderId ? `element:${v.profielId ?? ""}:${v.ouderId}` : null);
  // Context-ouders: alleen aanmaken als ze nodig zijn; zelf aan hun ouder of map gehangen.
  /** @type {Map<string, Knoop>} */
  const contextKnopen = new Map();
  const contextKnoop = (sleutel, pad = new Set()) => {
    if (contextKnopen.has(sleutel)) return contextKnopen.get(sleutel);
    const c = context[sleutel];
    /** @type {Knoop} */
    const k = { knoopId: `context:${sleutel}`, soort: "groep", label: c.naam, verschil: null, kinderen: [], context: { profielId: c.profielId, elementType: c.elementType } };
    contextKnopen.set(sleutel, k);
    pad.add(sleutel);
    const ouder = c.ouderId ? `element:${c.profielId}:${c.ouderId}` : null;
    if (ouder && eenheden.has(ouder)) eenheden.get(ouder).kinderen.push(k);
    else if (ouder && context[ouder] && !pad.has(ouder)) contextKnoop(ouder, pad).kinderen.push(k);
    else if (c.mapId && mappen[c.mapId]) mapKnoop(c.mapId).kinderen.push(k);
    else groep("zonder", "Zonder map").kinderen.push(k);
    return k;
  };
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
    const ctx = !ouder ? ouderSleutel(v) : null;
    if (ouder) eenheden.get(ouder).kinderen.push(k);
    else if (ctx && context[ctx]) contextKnoop(ctx).kinderen.push(k);
    else if (v.soort === "kruisverband") groep("kruis", "Koppelingen tussen talen").kinderen.push(k);
    else if (v.soort === "bundel") groep("bundels", "Diagrambundels").kinderen.push(k);
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
  return [...wortels, ...["zonder", "bundels", "kruis"].filter((id) => groepen.has(id)).map((id) => groepen.get(id))];
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

/** De drie standen van het schuifje en de waarde in `keuze`. */
export const SCHUIF = Object.freeze({ links: "terug", midden: false, rechts: true });

/** Stand van één waarde uit `keuze`. */
export const standVanWaarde = (w) => (w === "terug" ? "links" : w === true ? "rechts" : "midden");

/**
 * Stand van het schuifje van een knoop: "links", "midden", "rechts", of "gemengd" als de eenheden
 * eronder verschillend staan.
 * @param {Knoop} knoop @param {Record<string, boolean|"terug">} keuze
 * @returns {"links"|"midden"|"rechts"|"gemengd"}
 */
export function standVan(knoop, keuze) {
  const standen = new Set(sleutelsVan(knoop).map((k) => standVanWaarde(keuze[k])));
  if (standen.size === 1) return /** @type {any} */ ([...standen][0]);
  return standen.size === 0 ? "midden" : "gemengd";
}

/**
 * Zet alles in en onder een knoop op een stand (of een waarde). Geeft een nieuwe keuze.
 * @param {Knoop} knoop @param {Record<string, boolean|"terug">} keuze
 * @param {"links"|"midden"|"rechts"|boolean|"terug"} stand
 */
export function zetKnoop(knoop, keuze, stand) {
  const waarde = typeof stand === "string" && Object.hasOwn(SCHUIF, stand) ? SCHUIF[stand] : stand;
  const uit = { ...keuze };
  for (const k of sleutelsVan(knoop)) uit[k] = waarde;
  return uit;
}

/**
 * Wat links en rechts betekenen, per status (Mark 14-11: "er is verschil of je iets uit MAIN
 * wijzigt of iets aan MAIN toevoegt"). Voor een ouder (geen eigen verschil): algemene tekst.
 * @param {{status?: string}|null} v
 * @returns {{links: string, midden: string, rechts: string, rechtsWaarschuwing?: boolean}}
 */
export function schuifTeksten(v) {
  const midden = "blijft in de branch";
  switch (v?.status) {
    case "nieuw": return { links: "niet toevoegen (weg uit de branch)", midden, rechts: "toevoegen aan MAIN" };
    case "weg": return { links: "terugzetten in de branch", midden, rechts: "ook uit MAIN verwijderen" };
    case "conflict": return { links: "versie van MAIN, ook in de branch", midden: "MAIN houdt de zijne; blijft in de branch", rechts: "MAIN overschrijven", rechtsWaarschuwing: true };
    case "gewijzigd": return { links: "versie van MAIN terug", midden, rechts: "wijziging naar MAIN" };
    default: return { links: "alles: MAIN overnemen", midden: "alles: blijft in de branch", rechts: "alles naar MAIN" };
  }
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
