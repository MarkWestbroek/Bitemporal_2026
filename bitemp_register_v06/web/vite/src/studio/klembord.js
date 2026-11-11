// @ts-check
/**
 * klembord — het Studio-klembord voor elementen en diagrammen, gedeeld over tabs (KLEM-1,
 * Mark 11-11).
 *
 * Tot 11-11 leefde het klembord in het geheugen van één tab. Nu staat het ook in localStorage
 * (zelfde Studio, dus elke tab leest het), mét de inhoud van wat je kopieerde. Zo plak je van
 * project 1 in de ene tab naar project 2 in de andere: de goedkope vorm van "meer projecten
 * tegelijk". Bewust niet het systeemklembord: dat draagt al de "Kopieer als afbeelding/link"-
 * acties en vraagt toestemming om te lezen.
 *
 * Binnen hetzelfde project verandert er niets: plakken werkt dan op de elementen in het model
 * (als verwijzing, of als kopie). Tussen projecten is er een keuze, omdat de uuid de identiteit
 * is (besluit Mark 31-10):
 *
 *  - **als hetzelfde element** (`wijze: "zelfde"`): id en uuid blijven. Staat het element al in
 *    het doelproject, dan wordt dat hergebruikt en niet overschreven. Voor de gedeelde kern die
 *    in beide projecten hetzelfde ding moet zijn.
 *  - **als kopie** (`wijze: "kopie"`): nieuwe id's, uuid's weg. Een ander ding.
 *
 * Dit bestand is zuiver op de opslag na (`zetKlembord`/`leesKlembord`); de koppeling met de
 * stores staat in maakDiagramActiviteit.jsx (elementen) en modellerenActivity.jsx (diagrammen).
 */

const SLEUTEL = "studio-klembord:";

/** @typedef {"elementen"|"diagram"} KlembordSoort */

/**
 * @typedef {Object} KlembordInhoud
 * @property {Record<string, any>} elements - de gekopieerde elementen, hun kinderen in de boom
 *   en de connectoren ertussen
 * @property {any} [diagram] - bij soort "diagram": het diagram zelf
 */

/**
 * @typedef {Object} Klembord
 * @property {KlembordSoort} soort
 * @property {string} profielId
 * @property {string} [profielVersie]
 * @property {string} diagramId
 * @property {string[]} [elementIds]   - soort "elementen": wat er geselecteerd was
 * @property {Record<string, any>} [posities]
 * @property {KlembordInhoud} inhoud
 * @property {string|null} projectId
 * @property {string} projectNaam
 * @property {number} tijd
 */

/** @type {Record<string, Klembord|null>} */
const _geheugen = {};
/** Het project dat in deze tab open is (gezet door modellerenActivity). */
let _project = { id: /** @type {string|null} */ (null), naam: "" };

/** @param {{id?: string|null, naam?: string}|null} p */
export function zetKlembordProject(p) {
  _project = { id: p?.id || null, naam: p?.naam || "" };
}

export function klembordProject() {
  return _project;
}

/**
 * @param {KlembordSoort} soort
 * @param {Omit<Klembord, "soort"|"projectId"|"projectNaam"|"tijd">} inhoud
 * @returns {Klembord}
 */
export function zetKlembord(soort, inhoud) {
  /** @type {Klembord} */
  const kb = { ...inhoud, soort, projectId: _project.id, projectNaam: _project.naam, tijd: Date.now() };
  _geheugen[soort] = kb;
  try {
    globalThis.localStorage?.setItem(SLEUTEL + soort, JSON.stringify(kb));
  } catch {
    // Vol of geblokkeerd: dan alleen binnen deze tab. Een oud klembord van een andere tab
    // mag dit niet overstemmen.
    try {
      globalThis.localStorage?.removeItem(SLEUTEL + soort);
    } catch {
      /* niets */
    }
  }
  return kb;
}

/**
 * Het nieuwste klembord van deze soort: van deze tab of van een andere.
 * @param {KlembordSoort} soort
 * @returns {Klembord|null}
 */
export function leesKlembord(soort) {
  const eigen = _geheugen[soort] || null;
  let gedeeld = null;
  try {
    const ruw = globalThis.localStorage?.getItem(SLEUTEL + soort);
    gedeeld = ruw ? JSON.parse(ruw) : null;
  } catch {
    gedeeld = null;
  }
  if (!gedeeld || gedeeld.soort !== soort || !gedeeld.inhoud?.elements) return eigen;
  return eigen && eigen.tijd >= gedeeld.tijd ? eigen : gedeeld;
}

/** Komt het klembord uit een ander project dan het project in deze tab? @param {Klembord|null} kb */
export function uitAnderProject(kb) {
  return !!kb && (kb.projectId || null) !== (_project.id || null);
}

/** Alleen voor tests. */
export function _wisKlembord() {
  for (const k of Object.keys(_geheugen)) delete _geheugen[k];
  zetKlembordProject(null);
}

// ── Zuivere regels ────────────────────────────────────────────────────────────────────────────

const kloon = (v) => JSON.parse(JSON.stringify(v));

/** Vervang ids (als heel woord) in een JSON-waarde. @param {any} waarde @param {Map<string, string>} nieuwId */
export function vervangIds(waarde, nieuwId) {
  const paren = [...nieuwId].filter(([oud, nieuw]) => oud !== nieuw);
  if (!paren.length) return kloon(waarde);
  const kaart = new Map(paren);
  const oud = [...kaart.keys()].sort((a, b) => b.length - a.length).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(?<![A-Za-z0-9_\\-])(${oud.join("|")})(?![A-Za-z0-9_\\-])`, "g");
  return JSON.parse(JSON.stringify(waarde).replace(re, (m) => kaart.get(m) || m));
}

/**
 * Een element met vervangen id's, maar met zijn eigen namen. `vervangIds` vervangt elk heel
 * woord dat een id is, en een id is vaak ook de naam (een entiteit "Aanvraag" met id
 * "Aanvraag"): de naam van het element en van zijn velden komt daarom uit het origineel.
 * @param {any} el @param {Map<string, string>} nieuwId
 */
export function vervangIdsInElement(el, nieuwId) {
  const uit = vervangIds(el, nieuwId);
  if ("naam" in el) uit.naam = el.naam;
  (el.compartimenten || []).forEach((c, ci) => {
    (c.velden || []).forEach((v, vi) => {
      const doel = uit.compartimenten?.[ci]?.velden?.[vi];
      if (doel && "naam" in v) doel.naam = v.naam;
    });
  });
  return uit;
}

/**
 * Wat er met een selectie meereist: de elementen zelf, hun kinderen in de boom (bv. de
 * gegevenselementen van een entiteit) en de connectoren tússen al die elementen.
 *
 * @param {Record<string, any>} elements
 * @param {string[]} wortelIds
 * @param {Map<string, string[]>} [kinderenVan]
 * @returns {Record<string, any>} een losse kopie
 */
export function verzamelInhoud(elements, wortelIds, kinderenVan = new Map()) {
  const alle = new Set();
  const voeg = (eid, d) => {
    if (alle.has(eid) || d > 8 || !elements[eid] || elements[eid].source) return;
    alle.add(eid);
    for (const k of kinderenVan.get(eid) || []) voeg(k, d + 1);
  };
  wortelIds.forEach((eid) => voeg(eid, 0));
  /** @type {Record<string, any>} */
  const uit = {};
  for (const eid of alle) uit[eid] = kloon(elements[eid]);
  for (const c of Object.values(elements)) {
    if (c?.source && c.target && alle.has(c.source) && alle.has(c.target)) uit[c.id] = kloon(c);
  }
  return uit;
}

/** Een element zonder uuid's (ook die van zijn velden): een kopie is een ander ding. @param {any} el */
export function zonderUuids(el) {
  const uit = kloon(el);
  if (uit.data) delete uit.data.uuid;
  for (const c of uit.compartimenten || []) for (const v of c.velden || []) if (v?.data) delete v.data.uuid;
  return uit;
}

/**
 * @typedef {Object} PlakPlan
 * @property {any[]} toevoegen - nieuwe elementen voor het doelmodel (eerst de knopen, dan de connectoren)
 * @property {Map<string, string>} idMap - id op het klembord → id in het doelmodel (zonder de conflicten)
 * @property {string[]} hergebruikt - doel-id's van elementen die er al stonden (niet overschreven)
 * @property {Array<{id: string, naam: string}>} conflicten - zelfde id, andere uuid: niet geplakt
 */

/**
 * Bereken wat plakken uit een ander project met het doelmodel doet.
 *
 * `zelfde`: een element dat er al staat (zelfde id, of zelfde uuid onder een ander id) wordt
 * hergebruikt. Zelfde id met een **andere** uuid is een ander ding met toevallig dezelfde id:
 * een conflict, dat niet geplakt wordt (plak het dan als kopie). Een connector reist alleen mee
 * als zijn beide uiteinden meekomen.
 *
 * `kopie`: alles krijgt een nieuw id (`maakId`), de uuid's gaan weg.
 *
 * @param {{inhoud: Record<string, any>, doelElements: Record<string, any>, wijze: "zelfde"|"kopie", maakId: (el: any, i: number) => string}} p
 * @returns {PlakPlan}
 */
export function bereidPlakVoor({ inhoud, doelElements, wijze, maakId }) {
  const bron = Object.values(inhoud || {}).filter(Boolean);
  const knopen = bron.filter((e) => !e.source);
  const connectoren = bron.filter((e) => e.source);
  const idMap = new Map();
  /** @type {string[]} */
  const hergebruikt = [];
  /** @type {Array<{id: string, naam: string}>} */
  const conflicten = [];
  const nieuw = [];

  if (wijze === "kopie") {
    // Elk nieuw id is uniek, ook als `maakId` in dezelfde milliseconde twee keer hetzelfde geeft.
    const bezet = new Set(Object.keys(doelElements || {}));
    const uniek = (id) => {
      let u = id;
      for (let k = 2; bezet.has(u); k++) u = `${id}_${k}`;
      bezet.add(u);
      return u;
    };
    [...knopen, ...connectoren].forEach((el, i) => idMap.set(el.id, uniek(maakId(el, i))));
    for (const el of [...knopen, ...connectoren]) {
      const k = zonderUuids(vervangIdsInElement(el, idMap));
      k.id = idMap.get(el.id);
      nieuw.push(k);
    }
    return { toevoegen: nieuw, idMap, hergebruikt, conflicten };
  }

  const opUuid = new Map();
  for (const e of Object.values(doelElements || {})) if (e?.data?.uuid) opUuid.set(e.data.uuid, e.id);
  const weg = new Set();
  const plaats = (el) => {
    const hier = doelElements?.[el.id];
    const uuid = el.data?.uuid;
    if (hier) {
      if (uuid && hier.data?.uuid && uuid !== hier.data.uuid) {
        conflicten.push({ id: el.id, naam: el.naam || el.id });
        weg.add(el.id);
        return false;
      }
      idMap.set(el.id, el.id);
      hergebruikt.push(el.id);
      return false;
    }
    if (uuid && opUuid.has(uuid)) {
      idMap.set(el.id, opUuid.get(uuid));
      hergebruikt.push(opUuid.get(uuid));
      return false;
    }
    idMap.set(el.id, el.id);
    return true;
  };
  const nieuweKnopen = knopen.filter(plaats);
  const nieuweConnectoren = connectoren.filter((c) => !weg.has(c.source) && !weg.has(c.target) && plaats(c));
  for (const el of [...nieuweKnopen, ...nieuweConnectoren]) nieuw.push(vervangIdsInElement(el, idMap));
  return { toevoegen: nieuw, idMap, hergebruikt: [...new Set(hergebruikt)], conflicten };
}

/**
 * Eén regel voor de melding na het plakken, of "" als er niets bijzonders was.
 * @param {PlakPlan} plan
 */
export function plakSamenvatting(plan) {
  const delen = [];
  const bestaandeKnopen = plan.hergebruikt.length;
  if (bestaandeKnopen) delen.push(`${bestaandeKnopen} ${bestaandeKnopen === 1 ? "element stond" : "elementen stonden"} al in dit project en ${bestaandeKnopen === 1 ? "is" : "zijn"} niet overschreven.`);
  if (plan.conflicten.length) {
    delen.push(
      `Niet geplakt, omdat hier al een ander element met hetzelfde id staat: ${plan.conflicten.map((c) => c.naam).join(", ")}. Plak ${plan.conflicten.length === 1 ? "dat" : "die"} als kopie.`,
    );
  }
  return delen.join("\n\n");
}
