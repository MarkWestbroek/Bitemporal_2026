// @ts-check
/**
 * werkkopie — het overzicht van de werkkopieën in deze browser, en het opruimen van oude
 * (TAB-1, 11-11).
 *
 * De werkkopie is per project (diagramcore/model/opslagRuimte.js): elke tab leest en schrijft
 * alleen de sleutels van zijn eigen project. Wisselen van project laat de werkkopie van het
 * vorige project staan. Dit bestand houdt bij welke er zijn (`studio-werkkopieen` in
 * localStorage: project-id → naam en wanneer het laatst bewerkt) en ruimt bij het starten op wat
 * langer dan `BEWAAR_DAGEN` niet is aangeraakt.
 *
 * Een project dat op de server staat verliest daarbij niets wat verstuurd was. Een project dat
 * alleen lokaal bestond is na die termijn weg; tot 11-11 was het al weg zodra je een ander
 * project opende.
 */
import { indexedDbKv, heeftIndexedDb } from "../diagramcore/model/opslag.js";

const LS_INDEX = "studio-werkkopieen";
export const BEWAAR_DAGEN = 30;
const UUR = 3600_000;

/** De localStorage-sleutels met projectgegevens (basis; het project-id komt erachter). */
export const LS_PROJECT = "studio-project";
export const LS_KRUIS = "studio-kruisverbanden";
export const LS_OUTBOX = "studio-outbox";

/** @returns {Record<string, {naam: string, laatst: string}>} */
export function leesIndex(ls = globalThis.localStorage) {
  try {
    const d = JSON.parse(ls?.getItem(LS_INDEX) || "{}");
    return d && typeof d === "object" && !Array.isArray(d) ? d : {};
  } catch {
    return {};
  }
}

/**
 * Noteer dat dit project nu bewerkt is. Schrijft hooguit één keer per uur per project (en bij
 * een andere naam): dit loopt mee met elke wijziging in de projectlaag.
 * @param {{id?: string|null, naam?: string}} project
 */
export function noteerWerkkopie(project, { ls = globalThis.localStorage, nu = Date.now() } = {}) {
  if (!project?.id) return;
  try {
    const index = leesIndex(ls);
    const was = index[project.id];
    if (was && was.naam === (project.naam || "") && nu - Date.parse(was.laatst) < UUR) return;
    index[project.id] = { naam: project.naam || "", laatst: new Date(nu).toISOString() };
    ls?.setItem(LS_INDEX, JSON.stringify(index));
  } catch {
    /* geen opslag */
  }
}

/**
 * Welke werkkopieën mogen weg: niet die van deze tab, en alleen wat langer dan `dagen` niet is
 * bewerkt (een onleesbare datum telt als oud).
 * @param {Record<string, {naam?: string, laatst?: string}>} index
 * @param {{eigenId: string|null, nu?: number, dagen?: number}} p
 * @returns {string[]} project-id's
 */
export function teVerwijderen(index, { eigenId, nu = Date.now(), dagen = BEWAAR_DAGEN }) {
  const grens = nu - dagen * 24 * UUR;
  return Object.entries(index || {})
    .filter(([id, v]) => id !== eigenId && !(Date.parse(v?.laatst || "") >= grens))
    .map(([id]) => id);
}

/**
 * Verwijder de werkkopieën van `projectIds`: de localStorage-sleutels en de modelstores.
 * @param {string[]} projectIds
 * @param {{ls?: Storage|null, kv?: {sleutels: () => Promise<string[]>, del: (n: string) => Promise<any>}|null}} [opties]
 * @returns {Promise<number>} aantal verwijderde modelstores
 */
export async function verwijderWerkkopieen(projectIds, { ls = globalThis.localStorage, kv = heeftIndexedDb() ? indexedDbKv : null } = {}) {
  if (!projectIds.length) return 0;
  const weg = new Set(projectIds);
  let n = 0;
  if (kv) {
    for (const sleutel of await kv.sleutels()) {
      const i = sleutel.lastIndexOf("::");
      if (i > 0 && weg.has(sleutel.slice(i + 2))) {
        await kv.del(sleutel);
        n += 1;
      }
    }
  }
  try {
    const index = leesIndex(ls);
    for (const id of weg) {
      for (const basis of [LS_PROJECT, LS_KRUIS, LS_OUTBOX]) ls?.removeItem(`${basis}::${id}`);
      delete index[id];
    }
    ls?.setItem(LS_INDEX, JSON.stringify(index));
  } catch {
    /* geen opslag */
  }
  return n;
}

/** Bij het starten: ruim op wat te oud is. Fouten zijn niet erg; de volgende start probeert het weer. */
export async function ruimOudeWerkkopieenOp(eigenId) {
  try {
    return await verwijderWerkkopieen(teVerwijderen(leesIndex(), { eigenId }));
  } catch (e) {
    console.warn("[werkkopie] opruimen mislukt:", e);
    return 0;
  }
}
