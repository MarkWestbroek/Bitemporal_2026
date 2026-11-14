// @ts-check
/**
 * samenvoegen — een branch (afgeleid project) terug naar MAIN, als zuivere functies op drie
 * werkbestanden ("studio-project" v3). Plan
 * `docs/plans/2026-11-14 Branch terugmergen — keuze per wijziging en samenhang (plan).md`.
 *
 * Stap 1 (14-11): alles uit de branch gaat mee, een conflict blokkeert, en daarna haalt de branch
 * MAIN helemaal op (optie A, "bijwerken").
 *
 * Stap 2 (14-11): **keuze per eenheid** (`keuze`, sleutel → true | false | "terug", zie
 * `verschilSleutel`).
 *   - true (gekozen): de versie van de branch gaat naar MAIN. Bij een conflict: de branch wint.
 *   - false (niet gekozen): MAIN houdt zijn versie. De branch houdt de zijne, dus de wijziging
 *     blijft een wijziging in de branch en komt bij de volgende vergelijking terug.
 *   - "terug" (terugzetten naar MAIN, Mark 14-11: "per ongeluk een kleur gewijzigd"): de branch
 *     neemt de versie van MAIN letterlijk over (ook "geen kleur"); de wijziging verdwijnt.
 *     Een element dat alleen in de branch bestaat, gaat er dan uit; een in de branch verwijderd
 *     element komt terug.
 *   - Wat alleen op MAIN veranderde, komt altijd in de branch (A).
 *   Zonder `keuze` geldt stap 1: alles mee en conflicten blokkeren (de aanroeper beslist dat;
 *   `voegSamen` meldt ze). Met `keuze` blokkeert een conflict niet meer: niet gekozen = MAIN.
 *   Een sleutel die in `keuze` ontbreekt: mee, behalve bij een conflict (dan MAIN).
 *
 * Drie standen, al gematerialiseerd (snapshot + ops, zie render-svc `materialiseer`):
 *   - basis: MAIN zoals hij was bij het afsplitsen (of bij de vorige merge);
 *   - tak:   de branch nu;
 *   - main:  MAIN nu.
 *
 * Uitkomst: `samengevoegd` (de nieuwe stand van MAIN, en de nieuwe basis van de branch) en
 * `nieuwTak` (de nieuwe stand van de branch: samengevoegd, plus wat niet gekozen werd).
 *
 * `opsVoorVerschil(van, naar)` geeft de operaties die stand `van` in stand `naar` veranderen, in de
 * vorm die de projectsync ook stuurt (`patchElementen`, `patchDiagrammen`, `patchStructuur`,
 * `patchLinks`, `zetSoorten`), zodat elke open Studio ze gewoon toepast. Twee keer gebruikt: MAIN →
 * samengevoegd (de merge) en tak → nieuwTak (het bijwerken van de branch).
 *
 * `samenhangFouten(stand)` is het vangnet van stap 2 (de samenhanggraaf is stap 3): verwijzingen
 * naar iets wat er niet is. Alleen wat de keuze nieuw stuk maakt telt (`nieuweSamenhangFouten`).
 */
import { gelijk, diffMap, structuurNet, modelStoreNaam } from "../sync/operaties.js";
import { verschilSleutel, elementVanPlaatsing } from "./verschilMetMain.js";

const leeg = Object.freeze({});

/**
 * Drieweg-samenvoeging van één id-map. Wat alleen in de tak veranderde komt erin als `neem` het
 * wil (standaard: ja; bij een conflict standaard nee), de rest volgt MAIN. De sleutelvolgorde is die van MAIN, met nieuwe
 * sleutels uit de tak achteraan (in hun volgorde in de tak): de volgorde van `plaatsing` is de
 * volgorde in de boom.
 *
 * `takUit` is de nieuwe stand van de tak: gelijk aan `uit`, behalve waar de tak iets veranderde
 * wat niet gekozen werd (dan houdt de tak zijn eigen waarde).
 * @param {Record<string, any>} basis @param {Record<string, any>} tak @param {Record<string, any>} main
 * @param {(sleutel: string, conflict: boolean) => boolean|"terug"} [neem]
 * @returns {{uit: Record<string, any>, takUit: Record<string, any>, conflicten: string[], gekozen: Record<string, boolean>}}
 */
export function voegMapSamen(basis = leeg, tak = leeg, main = leeg, neem = (_k, conflict) => !conflict) {
  basis = basis || leeg; tak = tak || leeg; main = main || leeg;
  const uit = {};
  const takUit = {};
  const conflicten = [];
  /** per conflict: koos de gebruiker de tak? */
  const gekozen = {};
  const sleutels = [...Object.keys(main), ...Object.keys(tak).filter((k) => !(k in main)), ...Object.keys(basis).filter((k) => !(k in main) && !(k in tak))];
  for (const k of sleutels) {
    const b = basis[k], t = tak[k], m = main[k];
    const takAnders = !gelijk(b, t);
    const mainAnders = !gelijk(b, m);
    let waarde = m;
    let takWaarde = m;
    if (takAnders && !mainAnders) {
      const n = neem(k, false);
      if (n === "terug") takWaarde = m; // de branch neemt MAIN over
      else if (n) { waarde = t; takWaarde = t; } else takWaarde = t;
    } else if (takAnders && mainAnders && !gelijk(t, m)) {
      conflicten.push(k);
      const n = neem(k, true);
      gekozen[k] = n === true;
      waarde = n === true ? t : m;
      takWaarde = n === "terug" ? m : t;
    }
    if (waarde !== undefined) uit[k] = waarde;
    if (takWaarde !== undefined) takUit[k] = takWaarde;
  }
  return { uit, takUit, conflicten, gekozen };
}

/** Lijst met `id` → map op id. */
const opId = (lijst) => Object.fromEntries((Array.isArray(lijst) ? lijst : []).filter((x) => x?.id != null).map((x) => [x.id, x]));

/** De sleutel van de eenheid waar een plaatsing bij hoort (`el::<pid>::<id>` of `<pid>::<id>`). */
export function plaatsingSleutel(p) {
  const isEl = p.startsWith("el::");
  const rest = isEl ? p.slice(4) : p;
  const i = rest.indexOf("::");
  return verschilSleutel({ soort: isEl ? "element" : "diagram", profielId: rest.slice(0, i), id: rest.slice(i + 2) });
}

/**
 * @typedef {{soort: "element"|"diagram"|"map"|"plaatsing"|"bundel"|"kruisverband"|"koppelsoorten",
 *            profielId: string|null, id: string, gekozen?: "tak"|"main"}} Conflict
 */

/**
 * Voeg tak en MAIN samen ten opzichte van de basis.
 * @param {{basis: any, tak: any, main: any, keuze?: Record<string, boolean|"terug">|null}} p
 * @returns {{samengevoegd: any, nieuwTak: any, conflicten: Conflict[]}}
 */
export function voegSamen({ basis, tak, main, keuze = null }) {
  const st = { basis: basis || leeg, tak: tak || leeg, main: main || leeg };
  /** @type {Conflict[]} */
  const conflicten = [];
  // Zonder keuze: alles mee, een conflict houdt MAIN (stap 1; de aanroeper blokkeert dan).
  // Met keuze: wat ontbreekt gaat mee, behalve een conflict.
  const neemVoor = (sleutelVan) => (k, conflict) => {
    if (!keuze) return !conflict;
    const w = keuze[sleutelVan(k)];
    if (w === "terug") return "terug";
    return w === undefined ? !conflict : w === true;
  };
  const meld = (r, soort, profielId) => {
    for (const id of r.conflicten) {
      conflicten.push({ soort, profielId, id, ...(keuze ? { gekozen: r.gekozen[id] ? "tak" : "main" } : {}) });
    }
  };

  // Profielen: elementen en diagrammen per id; de overige velden (diagramTypeId, meta) van MAIN,
  // of van de tak als het profiel alleen daar bestaat.
  const profielen = {};
  const takProfielen = {};
  const pids = new Set(["main", "tak", "basis"].flatMap((k) => Object.keys(st[k].profielen || leeg)));
  for (const pid of pids) {
    const b = st.basis.profielen?.[pid], t = st.tak.profielen?.[pid], m = st.main.profielen?.[pid];
    const el = voegMapSamen(b?.elements, t?.elements, m?.elements, neemVoor((id) => verschilSleutel({ soort: "element", profielId: pid, id })));
    const di = voegMapSamen(b?.diagrams, t?.diagrams, m?.diagrams, neemVoor((id) => verschilSleutel({ soort: "diagram", profielId: pid, id })));
    meld(el, "element", pid);
    meld(di, "diagram", pid);
    if (Object.keys(el.uit).length || Object.keys(di.uit).length) {
      profielen[pid] = { ...(t || {}), ...(m || {}), elements: el.uit, diagrams: di.uit };
    }
    if (Object.keys(el.takUit).length || Object.keys(di.takUit).length) {
      takProfielen[pid] = { ...(m || {}), ...(t || {}), elements: el.takUit, diagrams: di.takUit };
    }
  }

  // Structuur. Een plaatsing hoort bij haar element of diagram (verplaatsen = wijziging daarvan).
  const s = (k) => st[k].structuur || leeg;
  const mappen = voegMapSamen(s("basis").mappen, s("tak").mappen, s("main").mappen, neemVoor((id) => verschilSleutel({ soort: "map", id })));
  const plaatsing = voegMapSamen(s("basis").plaatsing, s("tak").plaatsing, s("main").plaatsing, neemVoor(plaatsingSleutel));
  const bundels = voegMapSamen(s("basis").bundels, s("tak").bundels, s("main").bundels, neemVoor((id) => verschilSleutel({ soort: "bundel", id })));
  meld(mappen, "map", null);
  meld(plaatsing, "plaatsing", null);
  meld(bundels, "bundel", null);

  // Kruisverbanden op id; de soortenlijst als geheel.
  const kruis = voegMapSamen(opId(st.basis.kruisverbanden), opId(st.tak.kruisverbanden), opId(st.main.kruisverbanden), neemVoor((id) => verschilSleutel({ soort: "kruisverband", id })));
  meld(kruis, "kruisverband", null);
  const soorten = voegMapSamen({ s: st.basis.koppelsoorten }, { s: st.tak.koppelsoorten }, { s: st.main.koppelsoorten }, neemVoor(() => verschilSleutel({ soort: "koppelsoorten", id: "koppelsoorten" })));
  if (soorten.conflicten.length) {
    conflicten.push({ soort: "koppelsoorten", profielId: null, id: "koppelsoorten", ...(keuze ? { gekozen: soorten.gekozen.s ? "tak" : "main" } : {}) });
  }

  const bouw = (basisStand, kant) => {
    const uit = {
      ...basisStand,
      structuur: {
        mappen: mappen[kant],
        plaatsing: plaatsing[kant],
        plaatsingVolgorde: Object.keys(plaatsing[kant]),
        ...(Object.keys(bundels[kant]).length ? { bundels: bundels[kant] } : {}),
      },
      kruisverbanden: Object.values(kruis[kant]),
      profielen: kant === "uit" ? profielen : takProfielen,
    };
    if (soorten[kant].s !== undefined) uit.koppelsoorten = soorten[kant].s;
    else delete uit.koppelsoorten;
    return uit;
  };
  return { samengevoegd: bouw(st.main, "uit"), nieuwTak: bouw(st.tak, "takUit"), conflicten };
}

/**
 * Verwijzingen naar iets wat er niet is, als tekst (vergelijkbaar tussen standen):
 *   - een relatie (element met `source`/`target`) naar een element dat ontbreekt;
 *   - een node op een diagram (`nodes[].elementId`) naar een element dat ontbreekt;
 *   - een kruisverband met een kant naar een element dat ontbreekt;
 *   - een plaatsing of map met een map die ontbreekt, of een plaatsing onder een element dat
 *     ontbreekt (element als ouder in de boom, `el::<profiel>::<id>`);
 *   - een diagrambundel met een tab naar een diagram dat ontbreekt.
 * @param {any} stand
 * @returns {string[]}
 */
export function samenhangFouten(stand) {
  stand = stand || leeg;
  const uit = [];
  const profielen = stand.profielen || leeg;
  const heeft = (pid, id) => !!profielen[pid]?.elements?.[id];
  for (const [pid, p] of Object.entries(profielen)) {
    for (const [id, el] of Object.entries(p?.elements || leeg)) {
      for (const kant of ["source", "target"]) {
        if (el?.[kant] && !heeft(pid, el[kant])) uit.push(`element ${pid}/${id}: ${kant} ${el[kant]} ontbreekt`);
      }
    }
    for (const [id, d] of Object.entries(p?.diagrams || leeg)) {
      for (const n of Array.isArray(d?.nodes) ? d.nodes : []) {
        if (n?.elementId && !heeft(pid, n.elementId)) uit.push(`diagram ${pid}/${id}: element ${n.elementId} ontbreekt`);
      }
    }
  }
  for (const x of Array.isArray(stand.kruisverbanden) ? stand.kruisverbanden : []) {
    for (const kant of ["rij", "kolom"]) {
      const r = x?.[kant];
      if (r?.profielId && r?.elementId && !heeft(r.profielId, r.elementId)) uit.push(`koppeling ${x.id}: ${kant} ${r.profielId}/${r.elementId} ontbreekt`);
    }
  }
  const mappen = stand.structuur?.mappen || leeg;
  for (const [sleutel, mapId] of Object.entries(stand.structuur?.plaatsing || leeg)) {
    const ouderEl = elementVanPlaatsing(mapId);
    if (ouderEl) {
      if (!heeft(ouderEl.profielId, ouderEl.id)) uit.push(`plaatsing ${sleutel}: element ${ouderEl.profielId}/${ouderEl.id} ontbreekt`);
    } else if (mapId && !mappen[mapId]) uit.push(`plaatsing ${sleutel}: map ${mapId} ontbreekt`);
  }
  for (const [id, b] of Object.entries(stand.structuur?.bundels || leeg)) {
    for (const tab of Array.isArray(b?.tabs) ? b.tabs : []) {
      if (tab?.profielId && tab?.diagramId && !profielen[tab.profielId]?.diagrams?.[tab.diagramId]) {
        uit.push(`bundel ${id}: diagram ${tab.profielId}/${tab.diagramId} ontbreekt`);
      }
    }
  }
  for (const [id, m] of Object.entries(mappen)) {
    if (m?.ouderId && !mappen[m.ouderId]) uit.push(`map ${id}: bovenliggende map ${m.ouderId} ontbreekt`);
  }
  return uit.sort();
}

/**
 * De samenhangfouten in `na` die in geen van de standen `voor` al zaten: wat een samenvoeging
 * nieuw stuk maakt. (Bestaande losse eindjes laten we staan; die zijn niet van deze merge.)
 * @param {any} na @param {...any} voor
 */
export function nieuweSamenhangFouten(na, ...voor) {
  const al = new Set(voor.flatMap((v) => samenhangFouten(v)));
  return samenhangFouten(na).filter((f) => !al.has(f));
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
