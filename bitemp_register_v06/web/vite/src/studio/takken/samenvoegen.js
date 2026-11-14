// @ts-check
/**
 * samenvoegen — een branch (afgeleid project) terug naar MAIN, als zuivere functies op drie
 * werkbestanden ("studio-project" v3). Stap 1 van het plan
 * `docs/plans/2026-11-14 Branch terugmergen — keuze per wijziging en samenhang (plan).md`:
 * alles uit de branch gaat mee, een conflict blokkeert, en daarna haalt de branch MAIN helemaal
 * op (optie A, "bijwerken"). Branch en MAIN zijn dan gelijk, en het samengevoegde werkbestand is
 * het nieuwe uitgangspunt (de basis) van de branch.
 *
 * Drie standen, al gematerialiseerd (snapshot + ops, zie render-svc `materialiseer`):
 *   - basis: MAIN zoals hij was bij het afsplitsen (of bij de vorige merge);
 *   - tak:   de branch nu;
 *   - main:  MAIN nu.
 *
 * Per eenheid en per id dezelfde drieweg als `verschilMetMain`: wat alleen in de tak veranderde
 * gaat mee, wat alleen op MAIN veranderde blijft staan, en wat aan beide kanten anders veranderde
 * is een conflict. Eenheden: elementen en diagrammen per profiel, mappen, plaatsingen en bundels
 * in de structuur, kruisverbanden (op id) en de soortenlijst (`koppelsoorten`, als geheel).
 *
 * `opsVoorVerschil(van, naar)` geeft de operaties die stand `van` in stand `naar` veranderen, in de
 * vorm die de projectsync ook stuurt (`patchElementen`, `patchDiagrammen`, `patchStructuur`,
 * `patchLinks`, `zetSoorten`), zodat elke open Studio ze gewoon toepast. Twee keer gebruikt: MAIN →
 * samengevoegd (de merge) en tak → samengevoegd (het bijwerken van de branch).
 */
import { gelijk, diffMap, structuurNet, modelStoreNaam } from "../sync/operaties.js";

const leeg = Object.freeze({});

/**
 * Drieweg-samenvoeging van één id-map. Wat alleen in de tak veranderde komt erin, de rest volgt
 * MAIN. De sleutelvolgorde is die van MAIN, met nieuwe sleutels uit de tak achteraan (in hun
 * volgorde in de tak): de volgorde van `plaatsing` is de volgorde in de boom.
 * @param {Record<string, any>} basis @param {Record<string, any>} tak @param {Record<string, any>} main
 * @returns {{uit: Record<string, any>, conflicten: string[]}}
 */
export function voegMapSamen(basis = leeg, tak = leeg, main = leeg) {
  basis = basis || leeg; tak = tak || leeg; main = main || leeg;
  const uit = {};
  const conflicten = [];
  const sleutels = [...Object.keys(main), ...Object.keys(tak).filter((k) => !(k in main)), ...Object.keys(basis).filter((k) => !(k in main) && !(k in tak))];
  for (const k of sleutels) {
    const b = basis[k], t = tak[k], m = main[k];
    const takAnders = !gelijk(b, t);
    const mainAnders = !gelijk(b, m);
    let waarde = m;
    if (takAnders && !mainAnders) waarde = t;
    else if (takAnders && mainAnders && !gelijk(t, m)) { conflicten.push(k); waarde = m; }
    if (waarde !== undefined) uit[k] = waarde;
  }
  return { uit, conflicten };
}

/** Lijst met `id` → map op id. */
const opId = (lijst) => Object.fromEntries((Array.isArray(lijst) ? lijst : []).filter((x) => x?.id != null).map((x) => [x.id, x]));

/**
 * @typedef {{soort: "element"|"diagram"|"map"|"plaatsing"|"bundel"|"kruisverband"|"koppelsoorten",
 *            profielId: string|null, id: string}} Conflict
 */

/**
 * Voeg tak en MAIN samen ten opzichte van de basis.
 * @param {{basis: any, tak: any, main: any}} p
 * @returns {{samengevoegd: any, conflicten: Conflict[]}}
 */
export function voegSamen({ basis, tak, main }) {
  const st = { basis: basis || leeg, tak: tak || leeg, main: main || leeg };
  /** @type {Conflict[]} */
  const conflicten = [];

  // Profielen: elementen en diagrammen per id; de overige velden (diagramTypeId, meta) van MAIN,
  // of van de tak als het profiel alleen daar bestaat.
  const profielen = {};
  const pids = new Set(["main", "tak", "basis"].flatMap((k) => Object.keys(st[k].profielen || leeg)));
  for (const pid of pids) {
    const b = st.basis.profielen?.[pid], t = st.tak.profielen?.[pid], m = st.main.profielen?.[pid];
    const el = voegMapSamen(b?.elements, t?.elements, m?.elements);
    const di = voegMapSamen(b?.diagrams, t?.diagrams, m?.diagrams);
    for (const id of el.conflicten) conflicten.push({ soort: "element", profielId: pid, id });
    for (const id of di.conflicten) conflicten.push({ soort: "diagram", profielId: pid, id });
    if (!Object.keys(el.uit).length && !Object.keys(di.uit).length) continue;
    profielen[pid] = { ...(t || {}), ...(m || {}), elements: el.uit, diagrams: di.uit };
  }

  // Structuur.
  const s = (k) => st[k].structuur || leeg;
  const mappen = voegMapSamen(s("basis").mappen, s("tak").mappen, s("main").mappen);
  const plaatsing = voegMapSamen(s("basis").plaatsing, s("tak").plaatsing, s("main").plaatsing);
  const bundels = voegMapSamen(s("basis").bundels, s("tak").bundels, s("main").bundels);
  for (const id of mappen.conflicten) conflicten.push({ soort: "map", profielId: null, id });
  for (const id of plaatsing.conflicten) conflicten.push({ soort: "plaatsing", profielId: null, id });
  for (const id of bundels.conflicten) conflicten.push({ soort: "bundel", profielId: null, id });

  // Kruisverbanden op id; de soortenlijst als geheel.
  const kruis = voegMapSamen(opId(st.basis.kruisverbanden), opId(st.tak.kruisverbanden), opId(st.main.kruisverbanden));
  for (const id of kruis.conflicten) conflicten.push({ soort: "kruisverband", profielId: null, id });
  const soorten = voegMapSamen({ s: st.basis.koppelsoorten }, { s: st.tak.koppelsoorten }, { s: st.main.koppelsoorten });
  if (soorten.conflicten.length) conflicten.push({ soort: "koppelsoorten", profielId: null, id: "koppelsoorten" });

  const samengevoegd = {
    ...st.main,
    structuur: {
      mappen: mappen.uit,
      plaatsing: plaatsing.uit,
      plaatsingVolgorde: Object.keys(plaatsing.uit),
      ...(Object.keys(bundels.uit).length ? { bundels: bundels.uit } : {}),
    },
    kruisverbanden: Object.values(kruis.uit),
    profielen,
  };
  if (soorten.uit.s !== undefined) samengevoegd.koppelsoorten = soorten.uit.s;
  else delete samengevoegd.koppelsoorten;
  return { samengevoegd, conflicten };
}

/** Eén patch ongesplitst (de sidecar geeft hier `splitsPatch` mee). */
const heel = (patch) => [patch];

/**
 * De operaties die werkbestand `van` in werkbestand `naar` veranderen. Per profiel eerst de
 * elementen, dan de diagrammen (een diagram verwijst naar zijn elementen); daarna de structuur,
 * dan de kruisverbanden.
 * @param {any} van @param {any} naar
 * @param {{splits?: (patch: {zet: Record<string, any>, wis: string[]}) => {zet: Record<string, any>, wis: string[]}[]}} [opties]
 * @returns {{store: string, op: string, args: any[]}[]}
 */
export function opsVoorVerschil(van, naar, { splits = heel } = {}) {
  van = van || leeg; naar = naar || leeg;
  const ops = [];
  const pids = [...new Set([...Object.keys(van.profielen || leeg), ...Object.keys(naar.profielen || leeg)])].sort();
  for (const pid of pids) {
    const store = modelStoreNaam(pid);
    const el = diffMap(van.profielen?.[pid]?.elements, naar.profielen?.[pid]?.elements);
    if (!el.leeg) for (const stuk of splits({ zet: el.zet, wis: el.wis })) ops.push({ store, op: "patchElementen", args: [stuk] });
    const di = diffMap(van.profielen?.[pid]?.diagrams, naar.profielen?.[pid]?.diagrams);
    if (!di.leeg) for (const stuk of splits({ zet: di.zet, wis: di.wis })) ops.push({ store, op: "patchDiagrammen", args: [stuk] });
  }
  const sv = van.structuur || leeg, sn = naar.structuur || leeg;
  ops.push(...structuurNet(
    { mappen: sv.mappen || {}, plaatsing: sv.plaatsing || {}, bundels: sv.bundels || {} },
    { mappen: sn.mappen || {}, plaatsing: sn.plaatsing || {}, bundels: sn.bundels || {} },
  ));
  if (!gelijk(van.koppelsoorten, naar.koppelsoorten) && naar.koppelsoorten !== undefined) {
    ops.push({ store: "kruis", op: "zetSoorten", args: [naar.koppelsoorten ?? null] });
  }
  // Kruisverbanden: inhoudelijk vergelijken (twee gematerialiseerde standen delen geen objecten).
  const kv = diffMap(opId(van.kruisverbanden), opId(naar.kruisverbanden));
  if (!kv.leeg) ops.push({ store: "kruis", op: "patchLinks", args: [{ zet: Object.values(kv.zet), wis: kv.wis }] });
  return ops;
}
