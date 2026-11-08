// @ts-check
/**
 * uniekeNamen — namen en paden zijn uniek binnen een domein, en die toets draait altijd
 * tijdens het modelleren, niet alleen bij een import (besluit Mark 31-10). Bij een export
 * (Operaton, documentatie, register) zijn naam en pad van dat moment de identificatie;
 * binnen het model loopt een verwijzing via de uuid.
 *
 * Naamruimten:
 *   - per domein: entiteit, enumeratie, gegevenstype, referentielijstinstantie en relatie
 *     (één ruimte: in V3/Go worden ze allemaal typen of constanten met die naam);
 *   - per entiteit: de gegevenselementen eronder (het pad Entiteit.GE);
 *   - per element: de velden (het pad Entiteit.GE.veld).
 *
 * Gebruikt als `hooks.valideer` (diagramcore/model/validatie.js): niveau "fout", zodat
 * de inspector én het canvas (⚠-badge) hem tonen. De index wordt per `elements`-object
 * één keer gebouwd (WeakMap), zodat een rebuild van het canvas niet kwadratisch wordt.
 */

/** Soorten die in de naamruimte van het domein vallen. */
const DOMEIN_SOORTEN = new Set(["entiteit", "enumeratie", "gegevenstype", "referentielijstInstantie", "relatie"]);

/** @type {WeakMap<object, {domeinNaam: Map<string, string[]>, geOnder: Map<string, string>, domeinVan: Map<string, string>}>} */
const cache = new WeakMap();

const norm = (s) => String(s || "").trim();

/**
 * Index per `elements`-object. Domein van een element: het package waar het via "bevat" in staat;
 * een GE dat van zijn entiteit, een relatie dat van haar bron; anders data.domein.
 */
function bouwIndex(elements) {
  const bestaand = cache.get(elements);
  if (bestaand) return bestaand;
  const els = Object.values(elements || {});
  const pakketVan = new Map();
  for (const el of els) {
    if (el?.elementType !== "bevat" || !el.source || !el.target) continue;
    const pkg = elements[el.source];
    if (pkg?.elementType === "package" && pkg.naam) pakketVan.set(el.target, pkg.naam);
  }
  /** GE-id → id van zijn entiteit (via de compositie). */
  const geOnder = new Map();
  for (const el of els) {
    if (el?.elementType === "compositie" && el.source && el.target) geOnder.set(el.target, el.source);
  }
  /** id → {domein, via, eigenaarId?}: waar het domein vandaan komt (zie domeinVanElement). */
  const herkomst = new Map();
  /** @returns {{domein: string, via: "package"|"eigenaar"|"veld", eigenaarId?: string}} */
  const afleiden = (id, gezien = new Set()) => {
    const klaar = herkomst.get(id);
    if (klaar) return klaar;
    const el = elements[id];
    const veld = { domein: norm(el?.data?.domein), via: /** @type {const} */ ("veld") };
    if (pakketVan.has(id)) return remember(id, { domein: pakketVan.get(id), via: "package" });
    if (gezien.has(id)) return veld; // kring (kan niet in een geldig model): niet blijven lopen
    gezien.add(id);
    // GE: de entiteit waar hij onder hangt (compositie); relatie: haar bron. De codegen bouwt ze in
    // de run van die entiteit, dus een eigen domein-veld zou daar niets doen (Mark 08-11).
    const eigenaarId = el?.elementType === "gegevenselement" ? geOnder.get(id) : el?.elementType === "relatie" ? el.source : null;
    if (eigenaarId && elements[eigenaarId]) return remember(id, { domein: afleiden(eigenaarId, gezien).domein, via: "eigenaar", eigenaarId });
    return remember(id, veld);
  };
  function remember(id, waarde) {
    herkomst.set(id, waarde);
    return waarde;
  }
  const domeinVan = new Map();
  const domeinNaam = new Map(); // `${domein}\u0000${naam}` → ids
  const geNaam = new Map(); // `${entiteitId}\u0000${naam}` → ids
  for (const el of els) {
    if (!el?.id) continue;
    const domein = afleiden(el.id).domein;
    domeinVan.set(el.id, domein);
    const naam = norm(el.naam);
    if (!naam) continue;
    if (DOMEIN_SOORTEN.has(el.elementType)) {
      const k = `${domein}\u0000${naam}`;
      domeinNaam.set(k, [...(domeinNaam.get(k) || []), el.id]);
    } else if (el.elementType === "gegevenselement" && geOnder.has(el.id)) {
      const k = `${geOnder.get(el.id)}\u0000${naam}`;
      geNaam.set(k, [...(geNaam.get(k) || []), el.id]);
    }
  }
  const index = { domeinNaam, geNaam, geOnder, domeinVan, herkomst };
  cache.set(elements, index);
  return index;
}

/**
 * Het domein van een element en waar het vandaan komt (Mark 08-11: "wat domineert?"). Er is één
 * bron: het package in de boom. Een GE en een relatie volgen hun entiteit (zo bouwt de codegen ze
 * ook); alleen een element zonder package of eigenaar valt terug op het veld data.domein.
 * @param {any} element
 * @param {Record<string, any>} elements
 * @returns {{domein: string, via: "package"|"eigenaar"|"veld", eigenaarId?: string}}
 */
export function domeinVanElement(element, elements) {
  const veld = { domein: norm(element?.data?.domein), via: /** @type {const} */ ("veld") };
  if (!element?.id || !elements?.[element.id]) return veld;
  return bouwIndex(elements).herkomst.get(element.id) || veld;
}

/**
 * Meldingen over dubbele namen voor één element (leeg = in orde).
 * @param {any} element
 * @param {{elements?: Record<string, any>}} [context]
 * @returns {{niveau: "fout", tekst: string}[]}
 */
export function naamBotsingen(element, context = {}) {
  const elements = context.elements || {};
  if (!element?.id) return [];
  const uit = [];
  const naam = norm(element.naam);
  const index = bouwIndex(elements);

  if (naam && DOMEIN_SOORTEN.has(element.elementType)) {
    const domein = index.domeinVan.get(element.id) ?? norm(element.data?.domein);
    const ids = (index.domeinNaam.get(`${domein}\u0000${naam}`) || []).filter((id) => id !== element.id);
    if (ids.length) {
      const anderen = ids.map((id) => elements[id]?.elementType || "element").join(", ");
      uit.push({
        niveau: "fout",
        tekst: `De naam "${naam}" komt in ${domein ? `domein ${domein}` : "dit model (zonder domein)"} nog eens voor (${anderen}). Namen zijn uniek per domein.`,
      });
    }
  }
  if (naam && element.elementType === "gegevenselement" && index.geOnder.has(element.id)) {
    const entId = index.geOnder.get(element.id);
    const ids = (index.geNaam.get(`${entId}\u0000${naam}`) || []).filter((id) => id !== element.id);
    if (ids.length) {
      uit.push({ niveau: "fout", tekst: `${elements[entId]?.naam || entId} heeft al een gegevenselement "${naam}". Het pad moet uniek zijn.` });
    }
  }
  // Velden: uniek binnen het element (het pad …​.veld).
  const velden = (element.compartimenten || [])
    .filter((c) => (c.compartmentType === "velden" || c.compartmentType === "afgeleid") && !c.extra)
    .flatMap((c) => c.velden || []);
  const gezien = new Set();
  const dubbel = new Set();
  for (const v of velden) {
    const n = norm(v?.naam);
    if (!n) continue;
    if (gezien.has(n)) dubbel.add(n);
    gezien.add(n);
  }
  for (const n of dubbel) uit.push({ niveau: "fout", tekst: `Het veld "${n}" komt meer dan eens voor in ${naam || "dit element"}.` });
  return uit;
}
