// @ts-check
/**
 * sidecarImport — de EA-import buiten de browser (node-sidecar), als zuivere
 * functies op node-stores. Plan: onderzoeksdoc 2026-10-07 §7.6 ("complete
 * import via git").
 *
 * Werking:
 *   1. `maakStand(werkbestand)`: per profiel een echte diagramstore
 *      (createDiagramStore zonder persist) met de snapshot van de server,
 *      plus een kale structuurstore (structuurKern.js); allemaal gekoppeld aan
 *      de operatielaag (operaties.js) zodat `pasOperatieToe` werkt.
 *   2. `speelOpsNa(stand, ops)`: de operaties ná de snapshot naspelen —
 *      dezelfde acties als in de Studio (projectsync).
 *   3. `importeerInStand(stand, bron, …)`: lezen (eaLezers.js), vergelijken op
 *      EA-GUID (vergelijkImport.js), toepassen op de node-stores en het
 *      verschil als operaties: model als `patchElementen`/`patchDiagrammen`
 *      (gesplitst in hapklare stukken — de api neemt max 8 MB per batch),
 *      structuur als `nieuweMappen`/`plaatsPerMap`, precies de operaties die
 *      een Studio-client ook stuurt, dus elke open Studio past ze gewoon toe.
 *   4. `bouwBatches(ops)`: batches van ≤ 500 operaties en ≤ 7 MB, met lokaalNr.
 *
 * Geen DOM, geen dialogen: "alles aan" zoals de standaardkeuze van de review
 * (nieuw + gewijzigd; verdwenen alleen met `verdwenenVerwijderen`).
 */
import { createDiagramStore } from "../../diagramcore/model/createDiagramStore.js";
import {
  koppelModelStore, koppelStore, pasOperatieToe, zonderVastleggen, diffMap, herschikOpVolgorde,
  structuurNet, STRUCTUUR_OPS, STRUCTUUR_VELDEN, modelStoreNaam, ontkoppelStore, gekoppeldeStores,
} from "../../studio/sync/operaties.js";
import { maakStructuurStore, nieuwMapIdNode, zonderWeesPlaatsingen } from "../../studio/sync/structuurKern.js";
import { leesPerProfiel, wortelPakket, telOvergeslagen } from "./eaLezers.js";
import { vergelijkMetStore, pasPlanToe, standaardKeuzes, herschrijfOpBestaandeIds } from "./vergelijkImport.js";
import { plaatsEaInProjectboomPlan, mapPadPlan } from "./eaProjectboom.js";
import { deelboomPakketten } from "./qeaHulp.js";

/** Client-id waaronder de sidecar in het operatielog staat (max 64 tekens). */
export const SIDECAR_CLIENT_ID = `sidecar-${typeof process !== "undefined" ? process.pid : 0}`;

/** Grenzen van de api (handlers/studio_project_ops_handler.go) met marge. */
export const BATCH_MAX_OPS = 500;
export const BATCH_MAX_BYTES = 7 * 1024 * 1024;
/** Eén patch-operatie blijft onder dit aantal bytes/sleutels (meerdere per batch). */
export const PATCH_MAX_BYTES = 1024 * 1024;
export const PATCH_MAX_SLEUTELS = 2000;

/**
 * @typedef {{modellen: Map<string, any>, structuur: any, profielVoor: (profielId: string, diagramTypeId?: string|null) => any,
 *            kruis: {links: any[]}, origineel: any}} Stand
 */

/**
 * Node-stores met de snapshot van de server (werkbestand "studio-project" v3).
 * Koppelt ze aan de operatielaag; eerdere koppelingen (tests) gaan weg.
 * @param {any} [werkbestand]
 * @returns {Stand}
 */
export function maakStand(werkbestand = {}) {
  for (const naam of gekoppeldeStores()) ontkoppelStore(naam);
  const modellen = new Map();
  const structuur = maakStructuurStore();
  const profielVoor = (profielId, diagramTypeId = null) => {
    if (!modellen.has(profielId)) {
      const api = createDiagramStore({});
      if (diagramTypeId) zonderVastleggen(() => api.getState().laadModel({ diagramTypeId, elements: {}, diagrams: {} }));
      koppelModelStore(profielId, api);
      modellen.set(profielId, api);
    }
    return modellen.get(profielId);
  };
  koppelStore("structuur", structuur, { ops: STRUCTUUR_OPS, velden: STRUCTUUR_VELDEN, net: structuurNet });
  zonderVastleggen(() => {
    for (const [pid, inhoud] of Object.entries(werkbestand?.profielen || {})) {
      profielVoor(pid).getState().laadModel({ ...inhoud, elements: inhoud.elements || {}, diagrams: inhoud.diagrams || {} });
    }
    const s = werkbestand?.structuur || {};
    structuur.getState().laadStructuur({ mappen: s.mappen || {}, plaatsing: herschikOpVolgorde(s.plaatsing || {}, s.plaatsingVolgorde) });
  });
  // Kruisverbanden: geen store nodig, alleen de lijst (patchLinks = upsert/wis op id).
  const kruis = { links: Array.isArray(werkbestand?.kruisverbanden) ? [...werkbestand.kruisverbanden] : [] };
  return { modellen, structuur, profielVoor, kruis, origineel: werkbestand || {} };
}

/** patchLinks {zet, wis} op de kruisverbanden van de stand. */
function pasKruisToe(stand, { zet = [], wis = [] } = {}) {
  const perId = new Map(stand.kruis.links.map((x) => [x.id, x]));
  for (const id of wis) perId.delete(id);
  for (const x of zet) if (x?.id) perId.set(x.id, x);
  stand.kruis.links = [...perId.values()];
}

/**
 * Het werkbestand ("studio-project" v3) van de stand: wat "Naar server sturen"
 * in de Studio ook oplevert. Velden van het origineel die de sidecar niet kent
 * blijven staan; profielen zonder inhoud vallen weg (zoals in de Studio).
 */
export function bouwWerkbestand(stand, { id, naam } = {}) {
  const profielen = {};
  for (const [pid, api] of stand.modellen) {
    const st = api.getState();
    if (!Object.keys(st.elements || {}).length && !Object.keys(st.diagrams || {}).length) continue;
    profielen[pid] = { diagramTypeId: st.diagramTypeId, elements: st.elements, diagrams: st.diagrams, actiefDiagramId: st.actiefDiagramId, meta: st.meta };
  }
  // Profielen uit het origineel die hier nooit geladen werden blijven staan.
  for (const [pid, inhoud] of Object.entries(stand.origineel?.profielen || {})) if (!stand.modellen.has(pid)) profielen[pid] = inhoud;
  const s = stand.structuur.getState();
  // Wees-plaatsingen weg, net als in de Studio (bouwProjectData); alleen voor
  // profielen die hier geladen zijn.
  const { plaatsing } = zonderWeesPlaatsingen(s.plaatsing, profielen, new Set(stand.modellen.keys()));
  return {
    ...stand.origineel,
    formaat: "studio-project",
    versie: 3,
    geexporteerd: new Date().toISOString(),
    project: { id: id ?? stand.origineel?.project?.id, naam: naam ?? stand.origineel?.project?.naam },
    structuur: { mappen: s.mappen, plaatsing, plaatsingVolgorde: Object.keys(plaatsing) },
    kruisverbanden: stand.kruis.links,
    profielen,
  };
}

/**
 * Operaties van de server (ná de snapshot) naspelen. Kruisverbanden slaan we
 * over (niet nodig voor de import). Onbekende stores/operaties worden gemeld.
 * @param {Stand} stand
 * @param {{store: string, op: string, args: any[], volgnummer?: number}[]} ops
 */
export function speelOpsNa(stand, ops) {
  let toegepast = 0, overgeslagen = 0;
  const problemen = [];
  for (const o of ops || []) {
    if (!o?.store) { overgeslagen++; continue; }
    if (o.store === "kruis") {
      if (o.op === "patchLinks") { pasKruisToe(stand, o.args?.[0]); toegepast++; } else overgeslagen++;
      continue;
    }
    if (o.store.startsWith("model:")) stand.profielVoor(o.store.slice("model:".length));
    const r = pasOperatieToe({ store: o.store, op: o.op, args: o.args });
    if (r.ok) toegepast++;
    else problemen.push(`#${o.volgnummer ?? "?"} ${o.store}/${o.op}: ${r.reden}`);
  }
  return { toegepast, overgeslagen, problemen };
}

/** Grootte van een waarde in JSON-bytes (benadering: UTF-16-lengte volstaat als marge). */
const bytesVan = (v) => JSON.stringify(v).length;

/**
 * Splits een `{zet, wis}`-patch in stukken onder PATCH_MAX_BYTES/-SLEUTELS.
 * @returns {{zet: Record<string, any>, wis: string[]}[]}
 */
export function splitsPatch({ zet = {}, wis = [] }, { maxBytes = PATCH_MAX_BYTES, maxSleutels = PATCH_MAX_SLEUTELS } = {}) {
  const uit = [];
  let huidig = {}, n = 0, bytes = 0;
  for (const [id, v] of Object.entries(zet)) {
    const b = bytesVan(v) + id.length + 4;
    if (n && (bytes + b > maxBytes || n >= maxSleutels)) {
      uit.push({ zet: huidig, wis: [] });
      huidig = {}; n = 0; bytes = 0;
    }
    huidig[id] = v; n++; bytes += b;
  }
  if (n) uit.push({ zet: huidig, wis: [] });
  for (let i = 0; i < wis.length; i += maxSleutels) {
    const stuk = wis.slice(i, i + maxSleutels);
    if (uit.length && i === 0 && !Object.keys(uit[uit.length - 1].zet).length) uit[uit.length - 1].wis = stuk;
    else uit.push({ zet: {}, wis: stuk });
  }
  return uit;
}

/** Een lijst in stukken van hoogstens `n`. */
const stukken = (lijst, n) => {
  const uit = [];
  for (let i = 0; i < lijst.length; i += n) uit.push(lijst.slice(i, i + n));
  return uit;
};

/**
 * Lees één EA-pakket, vergelijk met de stand, pas toe op de node-stores en geef
 * de operaties die het verschil maken.
 * @param {Stand} stand
 * @param {any} bron  QeaBron (leesBron of een .qea.json-fixture)
 * @param {{packageId?: number, doelPad?: string, verdwenenVerwijderen?: boolean, nieuwMapId?: () => string}} [opties]
 * @returns {{ops: {store: string, op: string, args: any[]}[], verslag: any}}
 */
export function importeerInStand(stand, bron, { packageId = 0, doelPad = "", verdwenenVerwijderen = false, nieuwMapId = nieuwMapIdNode } = {}) {
  if (!packageId) packageId = wortelPakket(bron);
  const pakketIds = new Set(deelboomPakketten(bron.t_package || [], packageId));
  const ops = [];
  const verslag = { profielen: {}, overgeslagen: {}, meldingen: [], mappenNieuw: 0, plaatsingen: 0, doelMap: null };
  const structuurOp = (op, args) => ops.push({ store: "structuur", op, args });

  // Doelmap ("Import / GGM"): bestaande schakels hergebruiken, de rest aanmaken.
  const { mapId: doel, teMaken: doelMappen } = mapPadPlan(stand.structuur.getState().mappen, doelPad, nieuwMapId);
  if (doelMappen.length) {
    stand.structuur.getState().nieuweMappen(doelMappen);
    structuurOp("nieuweMappen", [doelMappen]);
    verslag.mappenNieuw += doelMappen.length;
  }
  verslag.doelMap = doel;

  const ctx = { bron, packageId, geheugen: new Map(), doel, nieuwMapId };
  for (const { profiel, naam, model } of leesPerProfiel(bron, packageId)) {
    const api = stand.profielVoor(profiel, model.diagramTypeId);
    const voor = api.getState();
    const plan = vergelijkMetStore(model, voor, { pakketIds });
    const { aan } = standaardKeuzes(plan);
    // Bevat-lijnen (package → lid) volgen hun lid stilzwijgend (zoals de browser).
    for (const r of [...plan.elementen.nieuw, ...plan.elementen.gewijzigd]) if (r.elementType === "bevat") aan.add(`el:${r.id}`);
    if (verdwenenVerwijderen) {
      for (const r of plan.elementen.verdwenen) aan.add(`weg:${r.bestaandId}`);
      for (const r of plan.diagrammen.verdwenen) aan.add(`weg:${r.bestaandId}`);
    }
    let uitkomst;
    try {
      uitkomst = pasPlanToe(api.getState(), model, plan, { aan });
    } catch (e) {
      verslag.meldingen.push(`${naam}: import geweigerd — ${e?.message || e}`);
      continue;
    }
    const na = api.getState();
    const storeNaam = modelStoreNaam(profiel);
    const el = diffMap(voor.elements, na.elements);
    const di = diffMap(voor.diagrams, na.diagrams);
    // Elementen vóór diagrammen (een diagram verwijst naar zijn elementen); de
    // eerste patch draagt het diagramTypeId mee voor een nog lege store.
    for (const stuk of splitsPatch(el)) ops.push({ store: storeNaam, op: "patchElementen", args: [stuk] });
    for (const stuk of splitsPatch(di)) ops.push({ store: storeNaam, op: "patchDiagrammen", args: [stuk] });
    verslag.profielen[naam] = {
      profielId: profiel,
      elementen: uitkomst.toegevoegd,
      bijgewerkt: uitkomst.bijgewerkt + uitkomst.diagrammenBijgewerkt,
      verwijderd: uitkomst.verwijderd,
      diagrammen: uitkomst.diagrammenToegevoegd,
      ongewijzigd: plan.elementen.ongewijzigd.length + plan.diagrammen.ongewijzigd.length,
      verdwenen: plan.elementen.verdwenen.length + plan.diagrammen.verdwenen.length,
    };
    // Projectboom: op de definitieve ids, met het gedeelde geheugen van deze import.
    const her = herschrijfOpBestaandeIds(model, plan.idMap);
    const { teMaken, keysPerMap } = plaatsEaInProjectboomPlan(profiel, { elements: her.elements, diagrams: her.diagrams }, { ...ctx, mappen: stand.structuur.getState().mappen });
    if (teMaken.length) {
      stand.structuur.getState().nieuweMappen(teMaken);
      for (const stuk of stukken(teMaken, PATCH_MAX_SLEUTELS)) structuurOp("nieuweMappen", [stuk]);
      verslag.mappenNieuw += teMaken.length;
    }
    // Alleen plaatsingen die echt veranderen (de store laat de rest liggen).
    const plaatsingVoor = stand.structuur.getState().plaatsing;
    const teDoen = {};
    let n = 0;
    for (const [mapId, keys] of Object.entries(keysPerMap)) {
      const anders = keys.filter((k) => (plaatsingVoor[k] || null) !== mapId);
      if (anders.length) { teDoen[mapId] = anders; n += anders.length; }
    }
    if (n) {
      stand.structuur.getState().plaatsPerMap(teDoen);
      // Per map splitsen zodat één operatie niet te groot wordt.
      let huidig = {}, tel = 0;
      for (const [mapId, keys] of Object.entries(teDoen)) {
        for (const stuk of stukken(keys, PATCH_MAX_SLEUTELS)) {
          if (tel + stuk.length > PATCH_MAX_SLEUTELS && tel) { structuurOp("plaatsPerMap", [huidig]); huidig = {}; tel = 0; }
          huidig[mapId] = [...(huidig[mapId] || []), ...stuk];
          tel += stuk.length;
        }
      }
      if (tel) structuurOp("plaatsPerMap", [huidig]);
      verslag.plaatsingen += n;
    }
    telOvergeslagen(verslag.overgeslagen, model);
  }
  return { ops, verslag };
}

/**
 * Batches voor POST …/ops: ≤ 500 operaties en ≤ 7 MB per batch, lokaalNr oplopend.
 * @returns {{ops: {lokaalNr: number, store: string, op: string, args: any[]}[], bytes: number}[]}
 */
export function bouwBatches(ops, { maxOps = BATCH_MAX_OPS, maxBytes = BATCH_MAX_BYTES } = {}) {
  const uit = [];
  let huidig = [], bytes = 0, lokaalNr = 0;
  for (const o of ops) {
    const rij = { lokaalNr: ++lokaalNr, store: o.store, op: o.op, args: o.args };
    const b = bytesVan(rij);
    if (huidig.length && (huidig.length >= maxOps || bytes + b > maxBytes)) {
      uit.push({ ops: huidig, bytes });
      huidig = []; bytes = 0;
    }
    huidig.push(rij); bytes += b;
  }
  if (huidig.length) uit.push({ ops: huidig, bytes });
  return uit;
}
