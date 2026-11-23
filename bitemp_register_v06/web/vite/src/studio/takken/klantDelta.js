// @ts-check
/**
 * klantDelta — een klantaanpassing als **delta** op een uitgebrachte versie van een centraal
 * project (plan "Sidecar-project" §10, stap 8; besluit Mark 22-11).
 *
 * We bewaren niet de klantversie, maar alleen wat de klant anders heeft dan de basisversie
 * waarop hij werkte. De klantversie wordt gegenereerd: basis + delta. Komt er een nieuwe
 * basisversie, dan zetten we de delta daarop (`zetOpNieuweBasis`) en zien per wijziging:
 *
 *   - **past**: de wijziging gaat er schoon op;
 *   - **botst**: de basis veranderde hetzelfde anders (de beheerder kiest: klant of basis);
 *   - **al opgenomen**: de nieuwe basis heeft de wijziging nu zelf; ze valt uit de delta, die dus
 *     kleiner wordt, eventueel tot nul (dan kan de klant de centrale versie gewoon gebruiken).
 *
 * **Vorm van de delta**: een lijst eenheden, dezelfde als bij het samenvoegen van een branch
 * (`verschilSleutel`: element, diagram, map, plaatsing, bundel, kruisverband, koppelsoorten,
 * marks, plus de kop van een profiel): per eenheid de waarde van de klant, of `weg`. Geen
 * operaties: basis + delta is zo zonder stores te berekenen, op de server en in de Studio.
 * Binnen een element gebeurt het samenvoegen op een nieuwe basis wél per veld (`voegSamen`).
 *
 * Puur.
 */
import { gelijk } from "../sync/operaties.js";
import { voegSamen, plaatsingSleutel, MARK_SOORT } from "./samenvoegen.js";
import { verschilSleutel, perVeldStatus } from "./verschilMetMain.js";

export const DELTA_FORMAAT = "studio-klantdelta";

const leeg = Object.freeze({});
const kopie = (w) => (w === undefined ? undefined : JSON.parse(JSON.stringify(w)));
const opId = (lijst) => Object.fromEntries((Array.isArray(lijst) ? lijst : []).filter((x) => x?.id != null).map((x) => [x.id, x]));

/**
 * @typedef {{soort: string, profielId: string|null, id: string, waarde?: any, weg?: true}} DeltaEenheid
 * @typedef {{formaat: string, soort: string, basisVersie: string, eenheden: DeltaEenheid[]}} Delta
 */

/** De kop van een profiel: alles behalve elementen en diagrammen. */
const profielKop = (p) => {
  if (!p) return undefined;
  const { elements, diagrams, ...kop } = p;
  return kop;
};

/**
 * Alle eenheden van een werkbestand: sleutel → {soort, profielId, id, waarde}.
 * @returns {Map<string, {soort: string, profielId: string|null, id: string, waarde: any}>}
 */
export function eenhedenVan(stand) {
  stand = stand || leeg;
  const uit = new Map();
  const zet = (soort, profielId, id, waarde) => {
    if (waarde === undefined) return;
    uit.set(verschilSleutel({ soort, profielId, id }), { soort, profielId, id, waarde });
  };
  for (const [pid, p] of Object.entries(stand.profielen || leeg)) {
    zet("profielkop", pid, pid, profielKop(p));
    for (const [id, el] of Object.entries(p?.elements || leeg)) zet("element", pid, id, el);
    for (const [id, d] of Object.entries(p?.diagrams || leeg)) zet("diagram", pid, id, d);
  }
  const s = stand.structuur || leeg;
  for (const [id, m] of Object.entries(s.mappen || leeg)) zet("map", null, id, m);
  for (const [id, w] of Object.entries(s.plaatsing || leeg)) zet("plaatsing", null, id, w);
  for (const [id, b] of Object.entries(s.bundels || leeg)) zet("bundel", null, id, b);
  for (const [id, k] of Object.entries(opId(stand.kruisverbanden))) zet("kruisverband", null, id, k);
  if (stand.koppelsoorten !== undefined) zet("koppelsoorten", null, "koppelsoorten", stand.koppelsoorten);
  for (const [deel, soort] of Object.entries(MARK_SOORT)) {
    for (const [id, m] of Object.entries(opId(stand.marks?.[deel]))) zet(soort, null, id, m);
  }
  return uit;
}

/**
 * De delta van `klant` ten opzichte van `basis`.
 * @param {any} basis @param {any} klant
 * @param {{soort: string, basisVersie: string}} kop
 * @returns {Delta}
 */
export function maakDelta(basis, klant, { soort, basisVersie }) {
  const b = eenhedenVan(basis);
  const k = eenhedenVan(klant);
  /** @type {DeltaEenheid[]} */
  const eenheden = [];
  for (const [sleutel, e] of k) {
    if (!gelijk(b.get(sleutel)?.waarde, e.waarde)) eenheden.push({ soort: e.soort, profielId: e.profielId, id: e.id, waarde: kopie(e.waarde) });
  }
  for (const [sleutel, e] of b) {
    if (!k.has(sleutel)) eenheden.push({ soort: e.soort, profielId: e.profielId, id: e.id, weg: true });
  }
  return { formaat: DELTA_FORMAAT, soort, basisVersie, eenheden };
}

/** Is de delta leeg (de klant gebruikt de centrale versie zoals ze is)? */
export const isLeeg = (delta) => !delta?.eenheden?.length;

/**
 * Basis + delta = de klantversie. De basis wordt niet gewijzigd.
 * @param {any} basis @param {Delta} delta
 */
export function pasDeltaToe(basis, delta) {
  const uit = kopie(basis || {}) || {};
  uit.profielen ??= {};
  uit.structuur ??= {};
  const s = uit.structuur;
  const kruis = opId(uit.kruisverbanden);
  const marks = Object.fromEntries(Object.keys(MARK_SOORT).map((deel) => [deel, opId(uit.marks?.[deel])]));
  const markDeel = Object.fromEntries(Object.entries(MARK_SOORT).map(([deel, soort]) => [soort, deel]));
  const volgorde = Object.keys(s.plaatsing || {});
  const profiel = (pid) => (uit.profielen[pid] ??= { elements: {}, diagrams: {} });
  const zetIn = (obj, id, e) => {
    if (e.weg) delete obj[id];
    else obj[id] = kopie(e.waarde);
  };
  for (const e of delta?.eenheden || []) {
    switch (e.soort) {
      case "profielkop": {
        if (e.weg) {
          delete uit.profielen[e.id];
          break;
        }
        const p = profiel(e.id);
        uit.profielen[e.id] = { ...kopie(e.waarde), elements: p.elements || {}, diagrams: p.diagrams || {} };
        break;
      }
      case "element":
        zetIn((profiel(e.profielId).elements ??= {}), e.id, e);
        break;
      case "diagram":
        zetIn((profiel(e.profielId).diagrams ??= {}), e.id, e);
        break;
      case "map":
        zetIn((s.mappen ??= {}), e.id, e);
        break;
      case "plaatsing":
        zetIn((s.plaatsing ??= {}), e.id, e);
        if (!e.weg && !volgorde.includes(e.id)) volgorde.push(e.id);
        break;
      case "bundel":
        zetIn((s.bundels ??= {}), e.id, e);
        break;
      case "kruisverband":
        zetIn(kruis, e.id, e);
        break;
      case "koppelsoorten":
        if (e.weg) delete uit.koppelsoorten;
        else uit.koppelsoorten = kopie(e.waarde);
        break;
      default:
        if (markDeel[e.soort]) zetIn(marks[markDeel[e.soort]], e.id, e);
        else throw new Error(`Onbekende soort in de delta: ${e.soort}`);
    }
  }
  if (s.plaatsing) {
    s.plaatsingVolgorde = volgorde.filter((k) => k in s.plaatsing);
  }
  if (uit.kruisverbanden !== undefined || Object.keys(kruis).length) uit.kruisverbanden = Object.values(kruis);
  if (uit.marks !== undefined || Object.values(marks).some((m) => Object.keys(m).length)) {
    uit.marks = { ...(uit.marks || {}), ...Object.fromEntries(Object.entries(marks).map(([deel, m]) => [deel, Object.values(m)])) };
  }
  for (const [pid, p] of Object.entries(uit.profielen)) {
    if (!Object.keys(p.elements || {}).length && !Object.keys(p.diagrams || {}).length && !delta?.eenheden?.some((e) => e.soort === "profielkop" && e.id === pid && !e.weg) && !basis?.profielen?.[pid]) {
      delete uit.profielen[pid];
    }
  }
  return uit;
}

/** De sleutel waarmee voegSamen een keuze voor deze eenheid leest. */
function keuzeSleutel(e) {
  if (e.soort === "plaatsing") return `${plaatsingSleutel(e.id)}#map`;
  return verschilSleutel(e);
}

/**
 * De uitkomst per eenheid van de delta op een nieuwe basis.
 * @returns {"past"|"botst"|"opgenomen"}
 */
function uitkomstVan(e, oud, klant, nieuw) {
  if (gelijk(klant, nieuw)) return "opgenomen";
  if (gelijk(oud, nieuw)) return "past"; // de basis liet deze eenheid ongemoeid
  // Beide kanten veranderden. Bij een element dat in alle drie bestaat: per veld.
  if (e.soort === "element" && oud && klant && nieuw) {
    return perVeldStatus(oud, klant, nieuw)?.status === "conflict" ? "botst" : "past";
  }
  return "botst";
}

/**
 * De delta op een nieuwe basis zetten (rebasen).
 *
 * @param {{oudeBasis: any, nieuweBasis: any, delta: Delta, nieuweVersie: string,
 *          klantWint?: boolean | Record<string, boolean>}} p
 *   `klantWint`: bij een botsing de versie van de klant (true) of van de nieuwe basis (false,
 *   standaard), voor alles of per sleutel (`verschilSleutel` van de eenheid).
 * @returns {{delta: Delta, klantversie: any, uitkomsten: {soort: string, profielId: string|null, id: string, sleutel: string, uitkomst: "past"|"botst"|"opgenomen", gekozen?: "klant"|"basis"}[],
 *            telling: {past: number, botst: number, opgenomen: number}}}
 */
export function zetOpNieuweBasis({ oudeBasis, nieuweBasis, delta, nieuweVersie, klantWint = false }) {
  const klantOud = pasDeltaToe(oudeBasis, delta);
  const oud = eenhedenVan(oudeBasis);
  const kl = eenhedenVan(klantOud);
  const nw = eenhedenVan(nieuweBasis);
  const uitkomsten = [];
  /** @type {Record<string, boolean>} */
  const keuze = {};
  const wint = (sleutel) => (typeof klantWint === "boolean" ? klantWint : klantWint?.[sleutel] === true);
  for (const e of delta?.eenheden || []) {
    const sleutel = verschilSleutel(e);
    const uitkomst = uitkomstVan(e, oud.get(sleutel)?.waarde, kl.get(sleutel)?.waarde, nw.get(sleutel)?.waarde);
    const rij = { soort: e.soort, profielId: e.profielId, id: e.id, sleutel, uitkomst };
    if (uitkomst === "botst") rij.gekozen = wint(sleutel) ? "klant" : "basis";
    uitkomsten.push(rij);
    // Een keuze voor elke eenheid van de klant: past = mee, botst = zoals gekozen.
    keuze[keuzeSleutel(e)] = uitkomst === "botst" ? wint(sleutel) : true;
  }
  // De kop van een profiel kent voegSamen niet als eenheid; die nemen we hier zelf over.
  const { samengevoegd } = voegSamen({ basis: oudeBasis, tak: klantOud, main: nieuweBasis, keuze });
  for (const r of uitkomsten) {
    if (r.soort !== "profielkop" || r.uitkomst === "opgenomen") continue;
    if (r.uitkomst === "botst" && r.gekozen !== "klant") continue;
    const w = kl.get(r.sleutel)?.waarde;
    const p = samengevoegd.profielen?.[r.id];
    if (w === undefined) delete samengevoegd.profielen?.[r.id];
    else if (p) samengevoegd.profielen[r.id] = { ...p, ...kopie(w), elements: p.elements, diagrams: p.diagrams };
  }
  const nieuweDelta = maakDelta(nieuweBasis, samengevoegd, { soort: delta.soort, basisVersie: nieuweVersie });
  const telling = { past: 0, botst: 0, opgenomen: 0 };
  for (const r of uitkomsten) telling[r.uitkomst] += 1;
  return { delta: nieuweDelta, klantversie: pasDeltaToe(nieuweBasis, nieuweDelta), uitkomsten, telling };
}

/** Een eenheid als tekst voor een lijst ("element Persoon (canoniek-uml)"). */
export function eenheidTekst(e, stand) {
  const w = e.waarde ?? (e.soort === "element" ? stand?.profielen?.[e.profielId]?.elements?.[e.id] : e.soort === "diagram" ? stand?.profielen?.[e.profielId]?.diagrams?.[e.id] : e.soort === "map" ? stand?.structuur?.mappen?.[e.id] : undefined);
  const naam = w && typeof w === "object" ? w.naam || w.name || w.label || "" : "";
  return [e.soort, naam || e.id, e.profielId ? `(${e.profielId})` : ""].filter(Boolean).join(" ");
}
