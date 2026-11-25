// @ts-check
/**
 * vanToegangsspraak — Toegangsspraak → Cedar (fase 2 van "2026-11-25 Cedar als M2";
 * TRANSFORMATIES.md §8.3).
 *
 *   graafbeeld  toegangsspraak/graaf.js   het beleid uit elkaar gelegd (dezelfde als voor ODRL)
 *   regelset    toegangsspraakRegels.js    TOEGANGSSPRAAK_NAAR_CEDAR
 *   toepasser   transformatie/regels.js
 *   schrijver   hier                       plan → EST per regel → policies (lezer/schrijver.js)
 *
 * **Het Cedar-model is de woordenschat en de basis.** De handelingen, kenmerken en typen komen uit
 * het model (woordenschat.js). Regels met dezelfde naam (op het woord van de handeling na) en
 * verder dezelfde inhoud worden één policy met `action in [...]`, terug naar de vorm van de
 * heenweg. Zegt een policy hetzelfde als de policy met die naam in het model, dan gaat die
 * **ongewijzigd** terug: tekst, annotaties (`@reason`) en de velden van Open FTV blijven zoals ze
 * waren. Zo is de rondreis letterlijk; dezelfde gedachte als de brontekst bij ODRL (§8.1).
 * Policies die Toegangsspraak niet kan zeggen (heenweg: weggelaten) blijven staan; policies die
 * wel te zeggen waren maar niet meer in de tekst staan, vervallen. Beide met een melding.
 *
 * Nooit ongemerkt ruimer: een toestemming met iets wat Cedar niet kan zeggen (de betrokkene, een
 * bestaansvraag, een plicht) valt weg; een verbod verliest alleen dat stuk.
 */
import { pasRegelsToe } from "../../transformatie/regels.js";
import { parseBeleid } from "../../toegangsspraak/parser.js";
import { beleidNaarGraaf } from "../../toegangsspraak/graaf.js";
import { leidAf } from "./index.js";
import { leesPolicies } from "./lezer.js";
import { policyTekst } from "./schrijver.js";
import { cedarWoordenschat } from "./woordenschat.js";
import { cedarNaarToegangsspraak, registreerHandelingen } from "./naarToegangsspraak.js";
import { TOEGANGSSPRAAK_NAAR_CEDAR, VAR_VOOR_ANKER, OPERATOR_NAAR_CEDAR } from "./toegangsspraakRegels.js";

/** @typedef {{niveau: "fout"|"waarschuwing"|"info", bericht: string, elementId?: string}} Melding */
/** @typedef {{naam: string, est: any, tekst: string, status: "ongewijzigd"|"gewijzigd"|"nieuw"|"behouden", element?: any}} Policy */

const veilig = (s) => String(s || "").replace(/[^A-Za-z0-9_-]+/g, "_");
const en = (delen) => delen.reduce((a, b) => ({ "&&": { left: a, right: b } }));

/** Getypeerde waarde uit het graafbeeld → Cedar-literal, of null. */
function waardeExpr(w) {
  if (typeof w === "number") return Number.isInteger(w) ? { Value: w } : { decimal: [{ Value: String(w) }] };
  if (w && typeof w === "object" && "datum" in w) return { datetime: [{ Value: String(w.datum) }] };
  if (w && typeof w === "object" && "letterlijk" in w) return { Value: String(w.letterlijk) };
  if (typeof w === "string") return { Value: w };
  return null;
}

/** Wat een policy zegt, los van annotaties en van de schrijfwijze van de actie (`==` of `in [x]`). */
function inhoud(est) {
  const a = est.action || { op: "All" };
  const acties = a.op === "==" ? [a.entity] : a.op === "in" && a.entities ? a.entities : null;
  const actie = acties ? acties.map((x) => `${x.type}::${x.id}`).sort() : a;
  return JSON.stringify([est.effect, est.principal, actie, est.resource, est.conditions || []]);
}

/** Opnieuw door de lezer: dezelfde EST-vorm als een ingelezen policy. */
function canoniek(est) {
  const tekst = policyTekst(est);
  return { est: leesPolicies(tekst)[0].est, tekst };
}

/**
 * @param {string} tekst                              Toegangsspraak
 * @param {{staat?: {elements?: Record<string, any>}}} [opties]  het Cedar-model: woordenschat en basis
 * @returns {{policies: Policy[], tekst: string, meldingen: Melding[], trace: any[]}}
 */
export function toegangsspraakNaarCedar(tekst, { staat } = {}) {
  /** @type {Melding[]} */
  const meldingen = [];
  const elements = leidAf(staat?.elements) || staat?.elements || {};
  const ws = cedarWoordenschat(elements);
  meldingen.push(...ws.meldingen);
  registreerHandelingen(ws);

  const gelezen = parseBeleid(tekst);
  if (!gelezen.ok) {
    for (const f of gelezen.fouten) meldingen.push({ niveau: "fout", bericht: `Toegangsspraak, regel ${f.regel}, kolom ${f.kolom}: ${f.bericht}` });
    return { policies: [], tekst: "", meldingen, trace: [] };
  }
  const beleid = gelezen.beleid;
  if (beleid.conflict) meldingen.push({ niveau: "fout", bericht: `"Bij conflict: ${beleid.conflict === "toestemming-wint" ? "toestemming gaat voor" : "de eerste regel geldt"}" kent Cedar niet: daar wint een verbod altijd. De policies zijn geschreven, maar beslissen anders.` });

  const graaf = beleidNaarGraaf(beleid);
  const plan = pasRegelsToe(graaf, TOEGANGSSPRAAK_NAAR_CEDAR);
  for (const d of plan.diagnostics.filter((x) => x.severity !== "info")) meldingen.push({ niveau: "waarschuwing", bericht: d.message });
  const el = new Map(plan.elementen.map((e) => [e.sleutel, e]));
  const uit = (bron, type) => plan.connectoren.filter((c) => c.bron === bron && c.type === type).map((c) => el.get(c.doel)).filter(Boolean);
  /** Wat de graaf verbindt maar het plan niet heeft (geen regel): telt als onvertaalbaar, nooit stil weg. */
  const ontbreekt = (bron, aarden) => graaf.verbindingen.filter((v) => v.bron === bron && aarden.includes(v.aard) && !el.has(v.doel)).map((v) => graaf.knopen.find((k) => k.id === v.doel)?.tekst || v.doel);
  for (const e of plan.elementen.filter((x) => x.type === "vervalt")) meldingen.push({ niveau: "info", bericht: `${e.data.reden}.` });

  const lijstVorm = Object.values(elements).some((x) => x.elementType === "policy" && x.data?.cedar?.action?.op === "in" && x.data.cedar.action.entities?.length === 1);

  // ── per regel een EST ───────────────────────────────────────────────────
  /** @type {{naam: string, woord: string, uid: any, rest: any}[]} */
  const perRegel = [];
  for (const re of uit("beleid", "regel")) {
    const naam = re.naam;
    const verbod = re.data.effect === "forbid";
    const problemen = [];
    const zwakker = [];
    const onvertaalbaar = (reden) => (verbod ? zwakker : problemen).push(reden);

    const h = uit(re.sleutel, "doet")[0];
    const woord = h?.data.woord || "";
    const actie = ws.actieVoorWoord(woord);
    const uid = actie ? { type: actie.type, id: actie.naam } : { type: "Action", id: woord };
    if (!actie) meldingen.push({ niveau: "waarschuwing", bericht: `${naam}: handeling "${woord}" staat niet in de actielijst van het model; geschreven als Action::"${woord}".` });
    const principalTypen = actie?.principal.length ? actie.principal : ws.principalTypen();
    let resourceTypen = actie?.resource.length ? actie.resource : ws.resourceTypen();

    /** Kenmerk of voorwaarde → Cedar-expressie, of null (dan staat in problemen/zwakker waarom). */
    const pad = (variabele, subpad, typen) => {
      const [eerste, ...rest] = String(subpad).split(".");
      const attr = variabele === "context" ? null : ws.attribuut(typen, eerste);
      if (variabele !== "context" && !attr && ws.typen.length) meldingen.push({ niveau: "waarschuwing", bericht: `${naam}: "${eerste}" is geen attribuut van ${typen.join(", ") || "een bekend type"}; zo geschreven.` });
      const naamAttr = attr ? attr.naam : eerste;
      return { expr: rest.reduce((e, a) => ({ ".": { left: e, attr: a } }), { ".": { left: { Var: variabele }, attr: naamAttr } }), meer: Boolean(attr?.meerwaardig) && !rest.length, attrs: [naamAttr, ...rest] };
    };
    const conditie = (d, doelWaarde) => {
      const variabele = VAR_VOOR_ANKER[d.anker];
      const typen = variabele === "principal" ? principalTypen : variabele === "resource" ? resourceTypen : [];
      const p = pad(variabele, d.subpad, typen);
      const vorm = OPERATOR_NAAR_CEDAR[d.operator]?.[p.meer ? "meer" : "enkel"];
      if (!vorm) return onvertaalbaar(`de vergelijking "${d.operator}" op ${d.anker}.${d.subpad}`), null;
      const waarde = doelWaarde !== undefined ? doelWaarde : d.waarde;
      let rechts = null;
      if (d.verwijzing) {
        const m = /^ts:([^.]+)\.(.+)$/.exec(String(d.verwijzing));
        const v2 = m && VAR_VOOR_ANKER[m[1]];
        if (!v2) return onvertaalbaar(`een vergelijking met ${d.verwijzing}`), null;
        rechts = pad(v2, m[2], v2 === "principal" ? principalTypen : v2 === "resource" ? resourceTypen : []).expr;
      } else if (!["has", "!has", "eenVan", "containsAny", "tussen"].includes(vorm)) {
        rechts = waardeExpr(waarde);
        if (!rechts) return onvertaalbaar(`de waarde van ${d.anker}.${d.subpad}`), null;
      }
      const lijst = () => (Array.isArray(waarde) ? waarde.map(waardeExpr) : []);
      const has = () => ({ has: { left: { Var: variabele }, attr: p.attrs.length > 1 ? p.attrs : p.attrs[0] } });
      const like = (soort) => {
        const t = String(waarde?.letterlijk ?? waarde ?? "");
        return { like: { left: p.expr, pattern: soort === "begin" ? [{ Literal: t }, "Wildcard"] : soort === "eind" ? ["Wildcard", { Literal: t }] : ["Wildcard", { Literal: t }, "Wildcard"] } };
      };
      switch (vorm) {
        case "contains": return { contains: { left: p.expr, right: rechts } };
        case "!contains": return { "!": { arg: { contains: { left: p.expr, right: rechts } } } };
        case "containsAny": return { containsAny: { left: p.expr, right: { Set: lijst() } } };
        case "eenVan": return { contains: { left: { Set: lijst() }, right: p.expr } };
        case "has": return has();
        case "!has": return { "!": { arg: has() } };
        case "like:begin": return like("begin");
        case "like:eind": return like("eind");
        case "like:in": return like("in");
        case "tussen": return en([{ ">=": { left: p.expr, right: waardeExpr(waarde[0]) } }, { "<=": { left: p.expr, right: waardeExpr(waarde[1]) } }]);
        default: return { [vorm]: { left: p.expr, right: rechts } };
      }
    };
    const item = (e) => {
      if (e.type === "conditie") {
        const doel = uit(e.sleutel, "waarde")[0];
        return conditie(e.data, doel ? { letterlijk: doel.naam } : undefined);
      }
      if (e.type === "groep") {
        if (e.data.logica === "xof") return onvertaalbaar("precies één van de voorwaarden (xof)"), null;
        const mist = ontbreekt(e.sleutel, ["lid"]);
        if (mist.length) return onvertaalbaar(`een voorwaarde zonder vertaling: ${mist.join("; ")}`), null;
        const leden = uit(e.sleutel, "lid").map(item);
        if (leden.some((x) => !x)) return null;
        return leden.reduce((a, b) => ({ [e.data.logica === "of" ? "||" : "&&"]: { left: a, right: b } }));
      }
      onvertaalbaar(e.data?.reden || `"${e.naam}"`);
      return null;
    };

    // ── wie ───────────────────────────────────────────────────────────────
    let principal = { op: "All" };
    const condities = [];
    const partij = uit(re.sleutel, "wie")[0];
    const kenmerkEls = partij ? uit(partij.sleutel, "kenmerk") : [];
    const kenmerkIds = new Set(kenmerkEls.map((k) => k.sleutel));
    const enigeType = () => (principalTypen.length === 1 ? principalTypen[0] : "");
    for (const k of kenmerkEls) {
      const waarde = String(k.data.waarde?.letterlijk ?? k.data.waarde ?? "");
      const subpad = String(k.data.subpad || "");
      const groepType = ws.typeVoor(subpad);
      if (subpad === "type") principal = { op: "is", entity_type: waarde };
      else if (subpad === "id" && (principal.entity_type || enigeType())) principal = { op: "==", entity: { type: principal.entity_type || enigeType(), id: waarde } };
      else if (groepType && principalTypen.some((t) => ws.typeVan(t)?.ouders.includes(groepType.naam))) principal = { op: "in", entity: { type: groepType.naam, id: waarde } };
      else if (k.type === "conditie") {
        const c = conditie(k.data);
        if (c) condities.push(c);
      } else onvertaalbaar(k.data?.reden || `het kenmerk "${k.naam}"`);
    }
    if (principal.op === "All" && enigeType()) principal = { op: "is", entity_type: enigeType() };

    // ── wat ───────────────────────────────────────────────────────────────
    let resource = { op: "All" };
    const watEl = uit(re.sleutel, "wat")[0];
    const deel = watEl?.type === "begrip" ? plan.connectoren.filter((c) => c.type === "onderdeel-van" && c.doel === watEl.sleutel).map((c) => el.get(c.bron)).find(Boolean) : watEl;
    const padTekst = String(deel?.data?.pad || "");
    if (!padTekst) onvertaalbaar("gegevens zonder pad");
    else if (!padTekst.includes(".")) {
      const t = ws.typeVoor(padTekst);
      if (!t && ws.typen.length) meldingen.push({ niveau: "waarschuwing", bericht: `${naam}: "${padTekst}" is geen entiteittype van het model; zo geschreven.` });
      resource = { op: "is", entity_type: t ? t.naam : padTekst };
      resourceTypen = [resource.entity_type];
    } else resource = { op: "in", entity: { type: "Pad", id: padTekst } };
    if (watEl?.type === "begrip") for (const a of uit(watEl.sleutel, "afbakening")) {
      const c = item(a);
      if (c) condities.push(c);
    }

    // ── voorwaarden ───────────────────────────────────────────────────────
    const gezien = new Set(kenmerkIds);
    for (const e of [...(h ? uit(h.sleutel, "als") : []), ...uit(re.sleutel, "als")]) {
      if (gezien.has(e.sleutel)) continue;
      gezien.add(e.sleutel);
      // "de id van de gegevens is …" bij een type: één resource.
      if (e.type === "conditie" && e.data.anker === "gegevens" && e.data.subpad === "id" && e.data.operator === "eq" && resource.op === "is" && !ws.attribuut(resourceTypen, "id")) {
        resource = { op: "==", entity: { type: resource.entity_type, id: String(e.data.waarde?.letterlijk ?? "") } };
        continue;
      }
      const c = item(e);
      if (c) condities.push(c);
    }
    for (const p of uit(re.sleutel, "waarbij")) onvertaalbaar(`${p.data.reden}: ${p.data.tekst}`);
    for (const t of [...ontbreekt(re.sleutel, ["als", "waarbij", "wie", "wat", "doet"]), ...(h ? ontbreekt(h.sleutel, ["als"]) : []), ...(partij ? ontbreekt(partij.sleutel, ["kenmerk"]) : [])]) onvertaalbaar(`een onderdeel zonder vertaling: ${t}`);

    if (problemen.length) {
      meldingen.push({ niveau: "waarschuwing", bericht: `${naam}: geen policy, het beleid wordt strenger: ${problemen.join("; ")}.` });
      continue;
    }
    if (zwakker.length) meldingen.push({ niveau: "waarschuwing", bericht: `${naam}: het verbod geldt in Cedar vaker, zonder: ${zwakker.join("; ")}.` });
    const rest = { effect: verbod ? "forbid" : "permit", principal, resource, conditions: condities.length ? [{ kind: "when", body: en(condities) }] : [] };
    perRegel.push({ naam, woord, uid, rest });
  }

  if (beleid.standaard === "toestaan") {
    meldingen.push({ niveau: "info", bericht: `"Standaard: toestaan": in Cedar een permit voor alles ("standaard-toestaan"); de verboden gaan voor.` });
    perRegel.push({ naam: "standaard-toestaan", woord: "", uid: null, rest: { effect: "permit", principal: { op: "All" }, resource: { op: "All" }, conditions: [] } });
  }

  // ── groeperen: dezelfde naam (zonder het woord) en dezelfde inhoud → één policy ──
  /** @type {{naam: string, uids: any[], rest: any}[]} */
  const groepen = [];
  for (const r of perRegel) {
    const stam = r.woord && r.naam.endsWith(` ${r.woord}`) ? r.naam.slice(0, -r.woord.length - 1) : r.naam;
    const sleutel = JSON.stringify(r.rest);
    const g = groepen.find((x) => x.naam === stam && x.sleutel === sleutel && stam !== r.naam);
    if (g) g.uids.push(r.uid);
    else groepen.push({ naam: stam !== r.naam && groepen.some((x) => x.naam === stam) ? r.naam : stam, sleutel, uids: r.uid ? [r.uid] : [], rest: r.rest });
  }
  const nieuw = groepen.map((g) => {
    const action = !g.uids.length ? { op: "All" } : g.uids.length === 1 && !lijstVorm ? { op: "==", entity: g.uids[0] } : { op: "in", entities: g.uids };
    return { naam: g.naam, est: { effect: g.rest.effect, principal: g.rest.principal, action, resource: g.rest.resource, conditions: g.rest.conditions } };
  });

  // ── tegen de basis: ongewijzigd, gewijzigd, nieuw, behouden, vervallen ──
  const basis = Object.values(elements).filter((x) => x.elementType === "policy");
  const vertaalbaar = new Set(basis.length ? cedarNaarToegangsspraak({ elements }).vertaald : []);
  const perNaam = new Map(nieuw.map((p) => [p.naam, p]));
  const opBasis = !basis.some((b) => b.data?.bron);
  /** @type {Policy[]} */
  const policies = [];
  const gebruikt = new Set();
  const vervallen = [];
  const behouden = [];
  for (const b of basis) {
    const p = perNaam.get(b.naam);
    if (p) {
      gebruikt.add(p.naam);
      if (b.data?.cedar && !b.data?.fout && inhoud(b.data.cedar) === inhoud(canoniek(p.est).est)) {
        policies.push({ naam: b.naam, est: b.data.cedar, tekst: String(b.data.tekst || ""), status: "ongewijzigd", element: b });
      } else {
        const { est, tekst: t } = canoniek({ ...(b.data?.cedar?.annotations ? { annotations: b.data.cedar.annotations } : {}), ...p.est });
        policies.push({ naam: b.naam, est, tekst: t, status: "gewijzigd", element: b });
      }
    } else if (vertaalbaar.has(b.naam)) vervallen.push(b.naam);
    else {
      behouden.push(b.naam);
      policies.push({ naam: b.naam, est: b.data?.cedar, tekst: String(b.data?.tekst || ""), status: "behouden", element: b });
    }
  }
  for (const p of nieuw) {
    if (gebruikt.has(p.naam)) continue;
    const { est, tekst: t } = canoniek(opBasis ? { annotations: { id: p.naam }, ...p.est } : p.est);
    policies.push({ naam: p.naam, est, tekst: t, status: "nieuw" });
  }
  const tel = (s) => policies.filter((p) => p.status === s);
  if (tel("gewijzigd").length) meldingen.push({ niveau: "info", bericht: `Gewijzigd: ${tel("gewijzigd").map((p) => p.naam).join(", ")} (annotaties en velden van Open FTV overgenomen; kijk na of @reason nog klopt).` });
  if (tel("nieuw").length) meldingen.push({ niveau: "info", bericht: `Nieuw: ${tel("nieuw").map((p) => p.naam).join(", ")}.` });
  if (behouden.length) meldingen.push({ niveau: "info", bericht: `Behouden (niet in Toegangsspraak te zeggen): ${behouden.join(", ")}.` });
  if (vervallen.length) meldingen.push({ niveau: "waarschuwing", bericht: `Vervallen (niet meer in de tekst): ${vervallen.join(", ")}.` });

  return { policies, tekst: `${policies.map((p) => p.tekst.trim()).join("\n\n")}\n`, meldingen, trace: plan.trace };
}

/**
 * Zet het resultaat in het model: de policies vervangen die van het model; ongewijzigde en
 * behouden policies blijven hetzelfde element (met hun plek op het diagram).
 * @param {{elements?: Record<string, any>}} staat
 * @param {Policy[]} policies
 * @returns {{elements: Record<string, any>, nieuweIds: string[], weg: string[]}}
 */
export function pasPoliciesToe(staat, policies) {
  const oud = staat?.elements || {};
  /** @type {Record<string, any>} */
  const elements = {};
  const weg = [];
  for (const [id, x] of Object.entries(oud)) {
    if (x.elementType === "policy" || x.elementType === "scope") weg.push(id);
    else elements[id] = x;
  }
  const nieuweIds = [];
  for (const p of policies) {
    if (p.element && (p.status === "ongewijzigd" || p.status === "behouden")) {
      elements[p.element.id] = p.element;
      continue;
    }
    if (p.element) {
      elements[p.element.id] = { ...p.element, data: { ...p.element.data, tekst: p.tekst, cedarVan: p.tekst, cedar: p.est, effect: p.est.effect, fout: "" } };
      continue;
    }
    let id = `pol_${veilig(p.naam)}`;
    while (elements[id]) id = `${id}_`;
    elements[id] = { id, naam: p.naam, elementType: "policy", compartimenten: [], data: { tekst: p.tekst, cedarVan: p.tekst, cedar: p.est, effect: p.est.effect, fout: "" } };
    nieuweIds.push(id);
  }
  const blijft = new Set(Object.keys(elements));
  return { elements: leidAf(elements) || elements, nieuweIds, weg: weg.filter((id) => !blijft.has(id)) };
}
