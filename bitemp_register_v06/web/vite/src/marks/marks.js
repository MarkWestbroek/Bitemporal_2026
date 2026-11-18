// @ts-check
/**
 * marks — de kern van marks (MDA): aanwijzingen op een modelelement die zeggen hoe een
 * transformatie dat element behandelt. Plan: docs/plans/2026-11-18 Marks — markeringen op het
 * model (plan).md.
 *
 * Marks staan los van het model, in **lagen** bovenop het model. Een laag heeft labels
 * (gemeente X, domein Y, …). Een **context** is een keuze van lagen in een volgorde; de
 * effectieve mark voor een (doel, soort) is de waarde uit de laatste laag in de context die er
 * een heeft. Er is geen vaste voorrang tussen labelsoorten: de volgorde staat in de context
 * (besluit Mark 18-11). Een waarde `null` zet een mark uit ("hier niet").
 *
 * Vorm (in het werkbestand, naast `kruisverbanden`):
 *   { lagen: [{id, naam, labels: [{soort, waarde}]}],
 *     contexten: [{id, naam, lagen: [laagId, …]}],
 *     marks: [{id, laag, soort, doel, waarde}],
 *     soorten: [{id: "project.<naam>", label, datatype, opties?, doelen?, uitleg?}] }
 *
 * `soorten` zijn de **eigen marksoorten van het project** (Mark 18-11): naast de soorten die een
 * transformatie declareert (marksoorten.js) maakt een project er zelf bij, zoals koppelsoorten.
 * Ze hebben de naamruimte `project.` en gelden in elke taal.
 *
 * Doel: `{soort: "element"|"veld"|"relatie", uuid}` (canoniek model), of zonder uuid
 * `{soort, profielId, elementId, veldNaam?}` (BPMN, DMN, …), of `{soort: "map", mapId}`.
 *
 * Puur en store-loos: alle functies geven een nieuwe toestand terug.
 */

/** @typedef {{soort: string, waarde: string}} Label */
/** @typedef {{id: string, naam: string, labels: Label[], eigen?: boolean}} Laag
 * `eigen`: de laag is van deze gebruiker (werkruimte), niet van het project. Hij doet lokaal
 * gewoon mee, maar gaat niet naar de server, de sync of het werkbestand, tot hij gedeeld wordt. */
/** @typedef {{id: string, naam: string, lagen: string[]}} Context */
/** @typedef {{soort: string, uuid?: string, profielId?: string, elementId?: string, veldNaam?: string, mapId?: string}} Doel */
/** @typedef {{id: string, laag: string, soort: string, doel: Doel, waarde: any}} Mark */
/** @typedef {{id: string, label: string, datatype: string, opties?: {waarde: string, label?: string}[], doelen?: string[], uitleg?: string}} Projectsoort */
/** @typedef {{lagen: Laag[], contexten: Context[], marks: Mark[], soorten: Projectsoort[]}} Marks */

/** @returns {Marks} */
export const leegMarks = () => ({ lagen: [], contexten: [], marks: [], soorten: [] });

export const PROJECT_NAAMRUIMTE = "project";
const SOORT_ID = /^project\.[A-Za-z][A-Za-z0-9-]*$/;
const DATATYPES = new Set(["boolean", "string", "tekst", "getal", "keuze"]);
const DOELEN = new Set(["element", "veld", "relatie", "map"]);

/** Een eigen marksoort in de vaste vorm, of null als hij niet te lezen is. */
function normaliseerSoort(s) {
  if (!s || typeof s.id !== "string" || !SOORT_ID.test(s.id)) return null;
  const datatype = DATATYPES.has(s.datatype) ? s.datatype : "boolean";
  const doelen = (Array.isArray(s.doelen) ? s.doelen : []).filter((d) => DOELEN.has(d));
  const opties = (Array.isArray(s.opties) ? s.opties : []).filter((o) => o && o.waarde !== undefined && o.waarde !== "").map((o) => ({ waarde: String(o.waarde), ...(o.label ? { label: String(o.label) } : {}) }));
  return {
    id: s.id,
    label: String(s.label || s.id.slice(PROJECT_NAAMRUIMTE.length + 1)),
    datatype,
    ...(datatype === "keuze" ? { opties } : {}),
    doelen: doelen.length ? doelen : ["element"],
    ...(s.uitleg ? { uitleg: String(s.uitleg) } : {}),
  };
}

/** Het id voor een nieuwe eigen soort met deze naam, uniek binnen `bestaand`. */
export function projectSoortId(naam, bestaand = []) {
  const ids = new Set(bestaand.map((s) => s.id));
  const stam = String(naam || "").normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/^[^A-Za-z]+/, "") || "soort";
  let id = `${PROJECT_NAAMRUIMTE}.${stam}`;
  for (let i = 2; ids.has(id); i++) id = `${PROJECT_NAAMRUIMTE}.${stam}-${i}`;
  return id;
}

/**
 * Sleutel van een doel: één per aanwijsbaar ding. De uuid wint (hernoemen breekt niets);
 * zonder uuid het profiel met het element-id.
 * @param {Doel} doel
 */
export function doelSleutel(doel) {
  if (!doel) return "";
  if (doel.uuid) return `u:${doel.uuid}`;
  if (doel.soort === "map" && doel.mapId) return `m:${doel.mapId}`;
  if (doel.profielId && doel.elementId) return `e:${doel.profielId}::${doel.elementId}${doel.veldNaam ? `#${doel.veldNaam}` : ""}`;
  return "";
}

/** Vaste id: dezelfde mark (laag, soort, doel) heeft bij elke client dezelfde id. */
export const markId = (laag, soort, doel) => `${laag}|${soort}|${doelSleutel(doel)}`;

/**
 * Brengt opgeslagen marks in de vaste vorm; wat niet te lezen is valt weg.
 * @param {any} ruw
 * @returns {Marks}
 */
export function normaliseerMarks(ruw) {
  const lagen = (Array.isArray(ruw?.lagen) ? ruw.lagen : [])
    .filter((l) => l && typeof l.id === "string" && l.id)
    .map((l) => ({
      id: l.id,
      naam: String(l.naam || l.id),
      labels: (Array.isArray(l.labels) ? l.labels : []).filter((x) => x?.soort).map((x) => ({ soort: String(x.soort), waarde: String(x.waarde ?? "") })),
      ...(l.eigen ? { eigen: true } : {}),
    }));
  const laagIds = new Set(lagen.map((l) => l.id));
  const contexten = (Array.isArray(ruw?.contexten) ? ruw.contexten : [])
    .filter((c) => c && typeof c.id === "string" && c.id)
    .map((c) => ({ id: c.id, naam: String(c.naam || c.id), lagen: (Array.isArray(c.lagen) ? c.lagen : []).filter((id) => laagIds.has(id)) }));
  const gezien = new Set();
  const marks = [];
  for (const m of Array.isArray(ruw?.marks) ? ruw.marks : []) {
    if (!m || !laagIds.has(m.laag) || typeof m.soort !== "string" || !m.soort || !doelSleutel(m.doel)) continue;
    const id = markId(m.laag, m.soort, m.doel);
    if (gezien.has(id)) continue;
    gezien.add(id);
    marks.push({ id, laag: m.laag, soort: m.soort, doel: m.doel, waarde: m.waarde === undefined ? null : m.waarde });
  }
  const soortIds = new Set();
  const soorten = (Array.isArray(ruw?.soorten) ? ruw.soorten : []).map(normaliseerSoort).filter((s) => s && !soortIds.has(s.id) && soortIds.add(s.id));
  return { lagen, contexten, marks, soorten };
}

/** Voeg een laag toe of werk hem bij (op id). */
export function metLaag(st, laag) {
  const nieuw = { id: laag.id, naam: laag.naam || laag.id, labels: laag.labels || [], ...(laag.eigen ? { eigen: true } : {}) };
  const bestaat = st.lagen.some((l) => l.id === laag.id);
  return { ...st, lagen: bestaat ? st.lagen.map((l) => (l.id === laag.id ? nieuw : l)) : [...st.lagen, nieuw] };
}

/** Haal een laag weg, met zijn marks en uit elke context. */
export function zonderLaag(st, laagId) {
  return {
    lagen: st.lagen.filter((l) => l.id !== laagId),
    contexten: st.contexten.map((c) => ({ ...c, lagen: c.lagen.filter((id) => id !== laagId) })),
    marks: st.marks.filter((m) => m.laag !== laagId),
    soorten: st.soorten || [],
  };
}

/** Voeg een eigen marksoort toe of werk hem bij (op id). Onleesbaar: de stand blijft. */
export function metSoort(st, soort) {
  const nieuw = normaliseerSoort(soort);
  if (!nieuw) return st;
  const soorten = st.soorten || [];
  return { ...st, soorten: soorten.some((s) => s.id === nieuw.id) ? soorten.map((s) => (s.id === nieuw.id ? nieuw : s)) : [...soorten, nieuw] };
}

/** Haal een eigen marksoort weg. De marks van die soort blijven staan (het scherm toont ze als onbekend). */
export const zonderSoort = (st, soortId) => ({ ...st, soorten: (st.soorten || []).filter((s) => s.id !== soortId) });

/** Voeg een context toe of werk hem bij (op id); onbekende lagen vallen eruit. */
export function metContext(st, context) {
  const laagIds = new Set(st.lagen.map((l) => l.id));
  const nieuw = { id: context.id, naam: context.naam || context.id, lagen: (context.lagen || []).filter((id) => laagIds.has(id)) };
  const bestaat = st.contexten.some((c) => c.id === context.id);
  return { ...st, contexten: bestaat ? st.contexten.map((c) => (c.id === context.id ? nieuw : c)) : [...st.contexten, nieuw] };
}

export const zonderContext = (st, contextId) => ({ ...st, contexten: st.contexten.filter((c) => c.id !== contextId) });

/**
 * Zet een mark in een laag (vervangt de mark met dezelfde soort op hetzelfde doel in die laag).
 * `waarde: null` betekent: in deze laag uitgezet.
 * @param {Marks} st
 * @param {{laag: string, soort: string, doel: Doel, waarde: any}} mark
 */
export function zetMark(st, { laag, soort, doel, waarde }) {
  if (!st.lagen.some((l) => l.id === laag)) throw new Error(`Laag "${laag}" bestaat niet.`);
  if (!doelSleutel(doel)) throw new Error("Een mark heeft een doel met een uuid, een element-id of een map-id nodig.");
  const id = markId(laag, soort, doel);
  const mark = { id, laag, soort, doel, waarde: waarde === undefined ? null : waarde };
  const bestaat = st.marks.some((m) => m.id === id);
  return { ...st, marks: bestaat ? st.marks.map((m) => (m.id === id ? mark : m)) : [...st.marks, mark] };
}

/** Haal een mark weg uit zijn laag (iets anders dan uitzetten: dan geldt weer wat eronder ligt). */
export const wisMark = (st, id) => ({ ...st, marks: st.marks.filter((m) => m.id !== id) });

/**
 * De lagen die bij een filter op labels passen: elk gevraagd label moet op de laag staan. Een
 * leeg filter geeft alle lagen. De volgorde is die van `st.lagen`; een context ordent zelf.
 * @param {Laag[]} lagen
 * @param {Label[]} [filter]
 */
export function lagenVoorFilter(lagen, filter = []) {
  return lagen.filter((l) => filter.every((f) => l.labels.some((x) => x.soort === f.soort && x.waarde === f.waarde)));
}

/**
 * De laag-ids van een context, in volgorde; onbekende en dubbele vallen weg.
 * @param {Marks} st
 * @param {string | string[] | {lagen: string[]} | null | undefined} context - context-id, lijst van laag-ids of een context
 */
export function contextLagen(st, context) {
  const ruw = typeof context === "string" ? st.contexten.find((c) => c.id === context)?.lagen : Array.isArray(context) ? context : context?.lagen;
  const laagIds = new Set(st.lagen.map((l) => l.id));
  return [...new Set(ruw || [])].filter((id) => laagIds.has(id));
}

/**
 * De effectieve marks voor een context, per doel en soort, met de herkomst erbij.
 * @param {Marks} st
 * @param {Parameters<typeof contextLagen>[1]} context
 * @returns {Map<string, {doel: Doel, soorten: Record<string, {waarde: any, laag: string, uit: boolean, overschreven: {laag: string, waarde: any}[]}>}>}
 */
export function effectieveMarks(st, context) {
  const volgorde = contextLagen(st, context);
  const rang = new Map(volgorde.map((id, i) => [id, i]));
  const uit = new Map();
  const mee = st.marks.filter((m) => rang.has(m.laag)).sort((a, b) => rang.get(a.laag) - rang.get(b.laag));
  for (const m of mee) {
    const sleutel = doelSleutel(m.doel);
    if (!uit.has(sleutel)) uit.set(sleutel, { doel: m.doel, soorten: {} });
    const vorig = uit.get(sleutel).soorten[m.soort];
    uit.get(sleutel).soorten[m.soort] = {
      waarde: m.waarde,
      laag: m.laag,
      uit: m.waarde === null,
      overschreven: vorig ? [...vorig.overschreven, { laag: vorig.laag, waarde: vorig.waarde }] : [],
    };
  }
  return uit;
}

/**
 * Wat er voor één doel geldt: `{soort: waarde}`, zonder wat is uitgezet. Voor transformaties.
 * @param {Marks} st
 * @param {Doel} doel
 * @param {Parameters<typeof contextLagen>[1]} context
 * @returns {Record<string, any>}
 */
export function marksVoor(st, doel, context) {
  const bij = effectieveMarks(st, context).get(doelSleutel(doel));
  const uit = {};
  for (const [soort, m] of Object.entries(bij?.soorten || {})) if (!m.uit) uit[soort] = m.waarde;
  return uit;
}

/**
 * Marks waarvan het doel niet meer bestaat. Ze blijven staan (niet stil weggooien); de Studio
 * toont ze.
 * @param {Marks} st
 * @param {(doel: Doel) => boolean} bestaat
 */
export const wezen = (st, bestaat) => st.marks.filter((m) => !bestaat(m.doel));

/**
 * De bijlage voor een export (V3: `marks` naast `model`): alleen wat geldt in de context, met de
 * gebruikte lagen erbij. Vaste volgorde, zodat dezelfde invoer dezelfde tekst geeft.
 * @param {Marks} st
 * @param {Parameters<typeof contextLagen>[1]} context
 * @param {{bestaat?: (doel: Doel) => boolean}} [opties] - met `bestaat` vallen wezen weg
 * @returns {{context: string[], marks: {doel: Doel, soort: string, waarde: any}[]}}
 */
export function marksBijlage(st, context, { bestaat } = {}) {
  const marks = [];
  for (const [, { doel, soorten }] of [...effectieveMarks(st, context)].sort(([a], [b]) => a.localeCompare(b))) {
    if (bestaat && !bestaat(doel)) continue;
    for (const soort of Object.keys(soorten).sort()) {
      if (!soorten[soort].uit) marks.push({ doel, soort, waarde: soorten[soort].waarde });
    }
  }
  return { context: contextLagen(st, context), marks };
}

// ── Wijzigingen als patch (projectsync, samenvoegen) ──────────────────────────

const perId = (lijst) => new Map((lijst || []).map((x) => [x.id, x]));
const zelfde = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Het verschil tussen twee standen, per onderdeel als `{zet, wis}` op id. `null` als er niets
 * verschilt. Inhoudelijk vergeleken, zodat twee los opgebouwde standen ook werken.
 * @param {Marks} voor @param {Marks} na
 * @returns {{lagen?: {zet: any[], wis: string[]}, contexten?: {zet: any[], wis: string[]}, marks?: {zet: any[], wis: string[]}, soorten?: {zet: any[], wis: string[]}} | null}
 */
export function diffMarks(voor, na) {
  const uit = {};
  for (const deel of /** @type {const} */ (["lagen", "contexten", "marks", "soorten"])) {
    const v = perId(voor?.[deel]);
    const n = perId(na?.[deel]);
    const zet = [...n.values()].filter((x) => !v.has(x.id) || (v.get(x.id) !== x && !zelfde(v.get(x.id), x)));
    const wis = [...v.keys()].filter((id) => !n.has(id));
    if (zet.length || wis.length) uit[deel] = { zet, wis };
  }
  return Object.keys(uit).length ? uit : null;
}

/**
 * Pas een patch toe (de operatie `marks/patchMarks`). Volgorde: lagen erbij, dan contexten en
 * marks, dan lagen weg (met hun marks). Wat naar een onbekende laag wijst valt weg.
 * @param {Marks} st
 * @param {ReturnType<typeof diffMarks>} patch
 * @returns {Marks}
 */
export function patchMarks(st, patch) {
  const pas = (lijst, p) => {
    if (!p) return lijst;
    const m = perId(lijst);
    for (const id of p.wis || []) m.delete(id);
    for (const x of p.zet || []) if (x?.id) m.set(x.id, x);
    return [...m.values()];
  };
  return normaliseerMarks({
    lagen: pas(st.lagen, patch?.lagen),
    contexten: pas(st.contexten, patch?.contexten),
    marks: pas(st.marks, patch?.marks),
    soorten: pas(st.soorten, patch?.soorten),
  });
}

/** Staat er iets in? Een leeg onderdeel hoeft niet in het werkbestand. */
export const heeftMarks = (st) => !!(st?.lagen?.length || st?.contexten?.length || st?.marks?.length || st?.soorten?.length);

// ── Eigen lagen (werkruimte) naast die van het project ────────────────────────
// Besluit Mark 18-11: een laag begint bij jezelf en is daarna te delen, zoals een bundel.

/** De ids van de eigen lagen. */
const eigenIds = (st) => new Set((st?.lagen || []).filter((l) => l.eigen).map((l) => l.id));

/**
 * Wat van het project is: zonder de eigen lagen en hun marks, en zonder verwijzingen ernaar in
 * een context. Dit gaat naar het werkbestand, de sync en de server. Dezelfde stand terug als er
 * geen eigen lagen zijn.
 * @param {Marks} st @returns {Marks}
 */
export function zonderEigen(st) {
  const eigen = eigenIds(st);
  if (!eigen.size) return st;
  return {
    ...st,
    lagen: st.lagen.filter((l) => !eigen.has(l.id)),
    contexten: st.contexten.map((c) => (c.lagen.some((id) => eigen.has(id)) ? { ...c, lagen: c.lagen.filter((id) => !eigen.has(id)) } : c)),
    marks: st.marks.filter((m) => !eigen.has(m.laag)),
  };
}

/** Wat van jou is (voor de werkruimte): de eigen lagen met hun marks. */
export function alleenEigen(st) {
  const eigen = eigenIds(st);
  return { lagen: st.lagen.filter((l) => eigen.has(l.id)), marks: st.marks.filter((m) => eigen.has(m.laag)) };
}

/**
 * Zet de eigen lagen (uit de werkruimte) bij de stand van het project; wat er al aan eigen lagen
 * stond wordt vervangen. Een eigen laag met het id van een projectlaag valt weg (de laag is
 * intussen gedeeld).
 * @param {Marks} st @param {{lagen?: any[], marks?: any[]} | null | undefined} eigen @returns {Marks}
 */
export function metEigen(st, eigen) {
  const project = zonderEigen(st);
  const bezet = new Set(project.lagen.map((l) => l.id));
  const lagen = (Array.isArray(eigen?.lagen) ? eigen.lagen : []).filter((l) => l?.id && !bezet.has(l.id)).map((l) => ({ ...l, eigen: true }));
  if (!lagen.length) return project;
  const ids = new Set(lagen.map((l) => l.id));
  return normaliseerMarks({
    ...project,
    lagen: [...project.lagen, ...lagen],
    marks: [...project.marks, ...(Array.isArray(eigen?.marks) ? eigen.marks : []).filter((m) => ids.has(m?.laag))],
  });
}

/** Deel een eigen laag met het project: hij is daarna van het project, met zijn marks. */
export function deelLaag(st, laagId) {
  return { ...st, lagen: st.lagen.map((l) => (l.id === laagId && l.eigen ? { id: l.id, naam: l.naam, labels: l.labels } : l)) };
}

/** De labels die op de lagen voorkomen, als unieke `{soort, waarde}`, gesorteerd. */
export function alleLabels(lagen) {
  const uit = new Map();
  for (const l of lagen || []) for (const x of l.labels || []) uit.set(`${x.soort}=${x.waarde}`, x);
  return [...uit.entries()].sort(([a], [b]) => a.localeCompare(b, "nl")).map(([, x]) => x);
}
