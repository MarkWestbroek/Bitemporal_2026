// @ts-check
/**
 * operaties — elke projectwijziging als benoemde, serialiseerbare operatie
 * (plan docs/plans/2026-10-07 Projectsync, stap 2 — onderdelen 1 en 2).
 *
 * Eén doorgang voor alle mutaties, zonder de stores te herschrijven:
 *
 *  1. `koppelStore(naam, api, {ops, net, …})` wikkelt de genoemde store-acties
 *     om. De actie zelf blijft; de wikkel meldt ná afloop `{store, op, args}`
 *     als de modelvelden werkelijk veranderd zijn. Waar een actie iets
 *     genereert (map-id, voorkomen-id) maakt een normalisator de args
 *     deterministisch, zodat een andere client exact hetzelfde doet.
 *  2. Een **vangnet** op de store-subscription vangt wijzigingen die niet via
 *     een omwikkelde actie lopen (undo/redo, migraties, oude referenties):
 *     die worden als `patch…`-operaties (upsert/wis per id) gemeld.
 *  3. `pasOperatieToe(op)` voert een operatie van een ander uit via dezelfde
 *     acties, met de undo gepauzeerd en zonder opnieuw te melden.
 *
 * Operatie: `{ store: "model:<profielId>" | "structuur" | "kruis", op, args }`.
 * Het vocabulaire (MODEL_OPS, STRUCTUUR_OPS, de patch-ops) is tegelijk de
 * lijst handelingen die in het modelregister elk één registratie worden.
 *
 * Geen DOM-afhankelijkheden: testbaar met `node --test`.
 */

/** @typedef {{store: string, op: string, args: any[]}} Operatie */

/** @type {Map<string, {naam:string, api:any, origineel:Record<string, Function>, net:((voor:any, na:any)=>Operatie[])|null, velden:string[], undoPauze:((aan:boolean)=>void)|null, baseline:any}>} */
const stores = new Map();
/** @type {Set<(op: Operatie) => void>} */
const luisteraars = new Set();

let actieDiepte = 0; // > 0: binnen een omwikkelde actie (vangnet zwijgt, alleen de buitenste meldt)
let remoteDiepte = 0; // > 0: bezig een operatie van een ander toe te passen (niets melden)
let gedempt = 0; // > 0: niets vastleggen (snapshot laden, project wisselen)

/** Abonneer op gemelde operaties (de outbox doet dit). Geeft een afmeld-functie. */
export function abonneer(fn) {
  luisteraars.add(fn);
  return () => luisteraars.delete(fn);
}

function meld(op) {
  if (gedempt || remoteDiepte) return;
  for (const fn of luisteraars) fn(op);
}

/** Zijn de relevante velden (per referentie) veranderd? */
function veranderd(velden, voor, na) {
  return velden.some((v) => voor?.[v] !== na?.[v]);
}

/**
 * Koppel een store aan de operatielaag.
 * @param {string} naam        "model:<profielId>" | "structuur" | "kruis"
 * @param {any} api            zustand store-api (getState/setState/subscribe)
 * @param {object} cfg
 * @param {Record<string, null | ((args:any[], ctx:{voor:any, na:any, resultaat:any}) => any[] | {op:string, args:any[]} | null)>} [cfg.ops]
 *        te omwikkelen acties; waarde = normalisator (null = args ongewijzigd; een
 *        `{op, args}` vervangt ook de operatienaam, bv. een map-vervanging → patch)
 * @param {string[]} cfg.velden   velden waarvan een referentiewissel "wijziging" betekent
 * @param {((voor:any, na:any) => Operatie[]) | null} [cfg.net]  vangnet: diff → patch-operaties
 * @param {((aan:boolean) => void) | null} [cfg.undoPauze]        undo pauzeren tijdens remote toepassen
 * @param {((voor:any, na:any) => void) | null} [cfg.naRemote]     na een remote operatie: undo-historie rebasen
 * @param {((start:() => void) => void) | null} [cfg.naHydratatie] vangnet pas starten na persist-hydratatie
 */
export function koppelStore(naam, api, { ops = {}, velden, net = null, undoPauze = null, naRemote = null, naHydratatie = null }) {
  if (stores.has(naam)) ontkoppelStore(naam);
  const entry = { naam, api, origineel: {}, net, velden, undoPauze, naRemote, baseline: api.getState(), afmelden: null };
  const state = api.getState();
  const patch = {};
  for (const [op, normaliseer] of Object.entries(ops)) {
    const fn = state[op];
    if (typeof fn !== "function") continue;
    entry.origineel[op] = fn;
    patch[op] = (...args) => {
      const voor = api.getState();
      actieDiepte++;
      let resultaat;
      try {
        resultaat = fn(...args);
      } finally {
        actieDiepte--;
      }
      const na = api.getState();
      entry.baseline = na;
      if (actieDiepte === 0 && !gedempt && !remoteDiepte && veranderd(velden, voor, na)) {
        const genorm = normaliseer ? normaliseer(args, { voor, na, resultaat }) : args;
        if (Array.isArray(genorm)) meld({ store: naam, op, args: genorm });
        else if (genorm?.op) meld({ store: naam, op: genorm.op, args: genorm.args });
      }
      return resultaat;
    };
  }
  api.setState(patch);
  stores.set(naam, entry);

  const start = () => {
    entry.baseline = api.getState();
    entry.afmelden = api.subscribe((na) => {
      const voor = entry.baseline;
      entry.baseline = na;
      if (actieDiepte || gedempt || remoteDiepte || !net) return;
      if (!veranderd(velden, voor, na)) return;
      for (const op of net(voor, na)) meld(op);
    });
  };
  if (naHydratatie) naHydratatie(start);
  else start();
  return entry;
}

/** Maak de koppeling ongedaan (herstelt de originele acties). */
export function ontkoppelStore(naam) {
  const entry = stores.get(naam);
  if (!entry) return;
  entry.afmelden?.();
  if (Object.keys(entry.origineel).length) entry.api.setState({ ...entry.origineel });
  stores.delete(naam);
}

/** Namen van de gekoppelde stores (diagnose). */
export const gekoppeldeStores = () => [...stores.keys()];

/**
 * Voer `fn` uit zonder operaties te melden (snapshot laden, project wisselen)
 * en zet daarna alle vangnet-baselines op de nieuwe stand.
 */
export function zonderVastleggen(fn) {
  gedempt++;
  try {
    return fn();
  } finally {
    gedempt--;
    for (const e of stores.values()) e.baseline = e.api.getState();
  }
}

/**
 * Pas een operatie van een ander toe: dezelfde actie, undo gepauzeerd, geen
 * melding. Een operatie op iets dat niet (meer) bestaat is bij de acties zelf
 * al een no-op (last-writer-wins in servervolgorde).
 *
 * Undo is hier snapshot-gebaseerd (zundo, structuur-stapel): een eigen undo
 * zou anders de hele oude stand terugzetten en zo ook het werk van de ander
 * wissen — en dat vervolgens via het vangnet naar iedereen sturen. Daarom
 * wordt ná de operatie de undo-historie **gerebased** (`naRemote`): de
 * wijziging van de ander wordt per id in elke bewaarde stand verwerkt.
 * @param {Operatie} op
 * @returns {{ok: true} | {ok: false, reden: string}}
 */
export function pasOperatieToe(op) {
  const entry = stores.get(op?.store);
  if (!entry) return { ok: false, reden: `store onbekend: ${op?.store}` };
  const fn = entry.origineel[op.op] || entry.api.getState()[op.op];
  if (typeof fn !== "function") return { ok: false, reden: `operatie onbekend: ${op.store}/${op.op}` };
  remoteDiepte++;
  entry.undoPauze?.(true);
  const voor = entry.api.getState();
  try {
    fn(...(Array.isArray(op.args) ? op.args : []));
    const na = entry.api.getState();
    if (veranderd(entry.velden, voor, na)) entry.naRemote?.(voor, na);
    return { ok: true };
  } catch (e) {
    return { ok: false, reden: e?.message || String(e) };
  } finally {
    entry.undoPauze?.(false);
    remoteDiepte--;
    entry.baseline = entry.api.getState();
  }
}

/**
 * Verwerk de wijziging voor→na (per id, voor de genoemde id-map-velden) in een
 * bewaarde undo-stand. Grof op id-niveau: raakte de ander hetzelfde diagram,
 * dan is jouw undo op dát diagram een no-op — nooit verlies van andermans werk.
 */
export function rebaseStand(stand, voor, na, velden) {
  const uit = { ...stand };
  for (const v of velden) {
    const d = diffMap(voor?.[v], na?.[v]);
    if (d.leeg) continue;
    const m = { ...(stand?.[v] || {}), ...d.zet };
    for (const id of d.wis) delete m[id];
    uit[v] = m;
  }
  return uit;
}

// ── Diff-helpers voor de vangnetten ───────────────────────────────────

/**
 * Verschil tussen twee id-maps: `zet` = nieuw of (per referentie) gewijzigd,
 * `wis` = verdwenen.
 */
export function diffMap(voor = {}, na = {}) {
  const zet = {};
  const wis = [];
  for (const [id, v] of Object.entries(na || {})) if (voor?.[id] !== v) zet[id] = v;
  for (const id of Object.keys(voor || {})) if (!(id in (na || {}))) wis.push(id);
  return { zet, wis, leeg: !wis.length && !Object.keys(zet).length };
}

/**
 * Herschik een id-map naar een expliciete sleutelvolgorde; sleutels die niet
 * in de lijst staan komen achteraan (in hun huidige volgorde). De boomvolgorde
 * is de sleutelvolgorde van `plaatsing`; omdat jsonb die niet bewaart, reist
 * de volgorde als aparte lijst mee (werkbestand `plaatsingVolgorde`, patch
 * `volgordePlaatsing`).
 */
export function herschikOpVolgorde(obj, volgorde) {
  if (!Array.isArray(volgorde)) return obj;
  const uit = {};
  for (const k of volgorde) if (k in (obj || {})) uit[k] = obj[k];
  for (const k of Object.keys(obj || {})) if (!(k in uit)) uit[k] = obj[k];
  return uit;
}

/** Zelfde voor lijsten met een `id`-veld (kruisverbanden). */
export function diffLijst(voor = [], na = []) {
  const voorBij = new Map((voor || []).map((x) => [x.id, x]));
  const naBij = new Map((na || []).map((x) => [x.id, x]));
  const zet = [];
  const wis = [];
  for (const [id, x] of naBij) if (voorBij.get(id) !== x) zet.push(x);
  for (const id of voorBij.keys()) if (!naBij.has(id)) wis.push(id);
  return { zet, wis, leeg: !wis.length && !zet.length };
}

// ── Modelstore (createDiagramStore) ───────────────────────────────────

/**
 * Omwikkelde modelacties. null = args ongewijzigd doorgeven. Niet hier (geen
 * modelwijziging): setActiefDiagram, markeerOpgeslagen, updateDiagramViewport.
 */
export const MODEL_OPS = {
  laadModel: null,
  clear: null,
  importeerModel: null,
  addElement: null,
  updateElement: null,
  /** Meerdere elementen in één stap (studio 0.13.0, "Kinderen in boomstijl"). */
  updateElementen: null,
  /**
   * Vervangt de hele elementen-map (studio 0.13.0, hernoemElement: naam + alle
   * verwijzingen op naam). Als operatie zou "vervang alles" bij last-writer-wins
   * het gelijktijdige werk van een ander op andere elementen overschrijven;
   * daarom gaat alleen het verschil mee, als patchElementen.
   */
  zetElementen: (_args, { voor, na }) => {
    const d = diffMap(voor.elements, na.elements);
    return d.leeg ? null : { op: "patchElementen", args: [{ zet: d.zet, wis: d.wis }] };
  },
  deleteElement: null,
  addDiagram: null,
  renameDiagram: null,
  deleteDiagram: null,
  /** Een gegenereerd voorkomen-id (meerdere voorkomens) reist mee in de opties. */
  addElementToDiagram: (args, { voor, na }) => {
    const [diagramId, elementId, position, opties = {}] = args;
    if (opties?.nodeId) return args;
    const nodesVoor = new Set(voor.diagrams?.[diagramId]?.nodes || []);
    const nieuw = (na.diagrams?.[diagramId]?.nodes || []).find((n) => !nodesVoor.has(n));
    return [diagramId, elementId, position, { ...opties, nodeId: nieuw?.nodeId ?? null }];
  },
  removeElementFromDiagram: null,
  updateNodePosition: null,
  updateNodePositions: null,
  updateAnkerPosition: null,
  resetAnkerPositions: null,
  resetEdgeHandles: null,
  /** (diagramId, voorkomen, size, position?) — positie mee bij resizen links/boven (0.13.0). */
  updateNodeSize: null,
  wisNodeMaten: null,
  zetNodeGedaante: null,
  zetConnectorGedaante: null,
  verbergConnectorOpDiagram: null,
  toonVerborgenConnectoren: null,
  updateDiagramStijl: null,
};

export const MODEL_VELDEN = ["elements", "diagrams"];

/** Vangnet model: undo/redo en migraties worden patch-operaties per id. */
export function modelNet(naam) {
  return (voor, na) => {
    const ops = [];
    const el = diffMap(voor.elements, na.elements);
    if (!el.leeg) ops.push({ store: naam, op: "patchElementen", args: [{ zet: el.zet, wis: el.wis }] });
    const di = diffMap(voor.diagrams, na.diagrams);
    if (!di.leeg) ops.push({ store: naam, op: "patchDiagrammen", args: [{ zet: di.zet, wis: di.wis }] });
    return ops;
  };
}

export const modelStoreNaam = (profielId) => `model:${profielId}`;

/**
 * Koppel de store van een profiel. Pauzeert zundo tijdens remote toepassen en
 * start het vangnet pas na de persist-hydratatie (anders is het inladen uit
 * localStorage zelf een "wijziging").
 */
export function koppelModelStore(profielId, api) {
  const naam = modelStoreNaam(profielId);
  return koppelStore(naam, api, {
    ops: MODEL_OPS,
    velden: MODEL_VELDEN,
    net: modelNet(naam),
    undoPauze: (aan) => {
      const t = api.temporal?.getState?.();
      if (aan) t?.pause?.();
      else t?.resume?.();
    },
    naRemote: (voor, na) => {
      const t = api.temporal;
      if (!t?.getState) return;
      const { pastStates = [], futureStates = [] } = t.getState();
      const rb = (stand) => rebaseStand(stand, voor, na, MODEL_VELDEN);
      t.setState({ pastStates: pastStates.map(rb), futureStates: futureStates.map(rb) });
    },
    naHydratatie: api.persist
      ? (start) => (api.persist.hasHydrated?.() ? start() : api.persist.onFinishHydration?.(start))
      : null,
  });
}

// ── Structuurstore (mappen + plaatsing) ───────────────────────────────

/** Omwikkelde structuuracties. Tabs, open/dicht, selectie en flits zijn UI. */
export const STRUCTUUR_OPS = {
  /** Het gegenereerde map-id reist mee als derde argument. */
  nieuweMap: (args, { resultaat }) => [args[0], args[1] ?? null, resultaat],
  schuifMap: null,
  hernoemMap: null,
  zetMapKleur: null,
  zetMapOmschrijving: null,
  verwijderMap: null,
  verplaatsMap: null,
  plaatsDiagram: null,
  plaatsMeerdere: null,
  /** Omhoog/omlaag in de boom (studio 0.15.0): wisselt twee sleutels van `plaatsing`. */
  schuifPlaatsing: null,
};

export const STRUCTUUR_VELDEN = ["mappen", "plaatsing"];

/**
 * Vangnet structuur: structuur-undo/redo en laadStructuur. De volgorde in de
 * boom ís de sleutelvolgorde van `plaatsing`; is alleen die veranderd (undo van
 * omhoog/omlaag), dan reist de hele volgorde mee als `volgordePlaatsing`.
 */
export function structuurNet(voor, na) {
  const m = diffMap(voor.mappen, na.mappen);
  const p = diffMap(voor.plaatsing, na.plaatsing);
  const volgordeVoor = Object.keys(voor.plaatsing || {}).join("\u0000");
  const volgordeNa = Object.keys(na.plaatsing || {}).join("\u0000");
  const volgordeAnders = volgordeVoor !== volgordeNa;
  if (m.leeg && p.leeg && !volgordeAnders) return [];
  const patch = { zetMappen: m.zet, wisMappen: m.wis, zetPlaatsing: p.zet, wisPlaatsing: p.wis };
  if (volgordeAnders) patch.volgordePlaatsing = Object.keys(na.plaatsing || {});
  return [{ store: "structuur", op: "patchStructuur", args: [patch] }];
}

// ── Kruisverbanden ────────────────────────────────────────────────────
// Geen omwikkelde acties: toggleLink/zetSoort hangen af van UI-keuzes (de
// actieve soort), dus de netto wijziging (links gezet/gewist) is de operatie.

export const KRUIS_VELDEN = ["links"];

export function kruisNet(voor, na) {
  const d = diffLijst(voor.links, na.links);
  if (d.leeg) return [];
  return [{ store: "kruis", op: "patchLinks", args: [{ zet: d.zet, wis: d.wis }] }];
}
