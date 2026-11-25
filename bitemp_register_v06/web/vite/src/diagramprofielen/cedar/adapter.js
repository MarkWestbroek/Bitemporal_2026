// @ts-check
/**
 * adapter — Cedar in en uit het profiel (M1 in de taal Cedar).
 *
 * In (`vanCedar`), herkent zelf de vorm:
 *   - Cedar-tekst: een policyset (`.cedar`);
 *   - Cedar-JSON: een policyset (`staticPolicies`), één policy (EST) of een schema (namespaces met
 *     `entityTypes`/`actions`);
 *   - een Open FTV-policylijst (JSON-array van `{id, language: "cedar", status, metadata, data}`,
 *     zoals de PAP hem geeft): de andere velden blijven bewaard en gaan zo weer terug.
 * Zonder schema leidt hij entiteittypen, attributen en acties af uit de policies (`afgeleid`).
 *
 * Uit (`naarCedar`): Cedar-tekst, Cedar-JSON (policyset), de Open FTV-lijst of het schema als
 * JSON. Een policy die niet is gewijzigd, gaat letterlijk terug (de tekst uit het bestand).
 *
 * Meldingen, niet stil: een actie die niet van type Action is (`name::"…"`, PABC: cedar-go neemt
 * het aan, de Cedar-specificatie niet), een policy die nooit geldt (`when { false }`), sloten
 * (templates), attributen die bij geen type te plaatsen zijn.
 */
import { leesPolicies } from "./lezer.js";
import { policyTekst, policySetJson } from "./schrijver.js";
import { cedarPosities, leidAf } from "./index.js";

/** @typedef {{niveau: "fout"|"waarschuwing"|"info", bericht: string, elementId?: string}} Melding */

const veilig = (s) => String(s || "").replace(/[^A-Za-z0-9_-]+/g, "_");
const isConnector = (el) => Boolean(el?.source && el?.target);
const isActieType = (type) => type === "Action" || String(type).endsWith("::Action");

// ── Schema-typen: JSON ↔ de tekstvorm in een attribuutregel ──────────────────────────────
/** Cedar-schema JSON-type → `String`, `Set<String>`, `Long`, `User`, … */
export function typeTekst(t) {
  if (!t) return "";
  const k = t.type;
  if (k === "String" || k === "Long") return k;
  if (k === "Boolean") return "Bool";
  if (k === "Set") return `Set<${typeTekst(t.element)}>`;
  if (k === "Entity" || k === "EntityOrCommon") return t.name;
  if (k === "Extension") return t.name;
  if (k === "Record") return `{ ${Object.entries(t.attributes || {}).map(([n, a]) => `${n}${a.required === false ? "?" : ""}: ${typeTekst(a)}`).join(", ")} }`;
  return k; // common type
}
/** Tekstvorm → Cedar-schema JSON-type (de eenvoudige vormen; een record blijft JSON). */
export function typeJson(tekst) {
  const t = String(tekst || "").trim();
  const set = /^Set<(.+)>$/.exec(t);
  if (set) return { type: "Set", element: typeJson(set[1]) };
  if (t === "String" || t === "Long") return { type: t };
  if (t === "Bool" || t === "Boolean") return { type: "Boolean" };
  if (["ipaddr", "decimal", "datetime", "duration"].includes(t)) return { type: "Extension", name: t };
  return { type: "EntityOrCommon", name: t };
}

// ── Herkennen ────────────────────────────────────────────────────────────────────────────
/** Herkent Cedar (tekst of JSON) voor het transformatiepaneel: 0..1. */
export function lijktOpCedar({ naam = "", tekst = "" } = {}) {
  const t = String(tekst).slice(0, 20000);
  let score = 0;
  if (/\b(permit|forbid)\s*\(\s*principal\b/.test(t)) score += 0.7;
  if (/"language"\s*:\s*"cedar"/.test(t) || /"staticPolicies"\s*:/.test(t)) score += 0.7;
  if (/"entityTypes"\s*:/.test(t) && /"actions"\s*:/.test(t)) score += 0.5;
  if (/\.cedar(schema)?$/i.test(naam)) score += 0.3;
  return Math.min(1, score);
}

// ── In ───────────────────────────────────────────────────────────────────────────────────
/**
 * @param {string} invoer - Cedar-tekst of JSON
 * @param {{bestandsnaam?: string, leidSchemaAf?: boolean}} [opties]
 * @returns {{elements: Record<string, any>, diagrams: Record<string, any>, meldingen: Melding[]}}
 */
export function vanCedar(invoer, { bestandsnaam = "", leidSchemaAf = true } = {}) {
  /** @type {Melding[]} */
  const meldingen = [];
  /** @type {Record<string, any>} */
  const elements = {};
  const tekst = String(invoer || "");
  /** @type {{tekst: string, est: any, naam?: string, bron?: any}[]} */
  const policies = [];
  let schema = null;

  let json = null;
  if (/^\s*[[{]/.test(tekst)) {
    try {
      json = JSON.parse(tekst);
    } catch (e) {
      meldingen.push({ niveau: "fout", bericht: `Geen geldige JSON: ${e?.message || e}` });
      return { elements, diagrams: {}, meldingen };
    }
  }
  const leesTekst = (t, extra = {}) => {
    try {
      for (const p of leesPolicies(t)) policies.push({ tekst: p.tekst, est: p.est, ...extra });
    } catch (e) {
      meldingen.push({ niveau: "fout", bericht: `${extra.naam ? `${extra.naam}: ` : ""}${e?.message || e}` });
    }
  };
  if (json === null) leesTekst(tekst);
  else if (Array.isArray(json)) {
    // Open FTV: één item per policy, `data` is de Cedar-tekst.
    for (const item of json) {
      if (item?.language && item.language !== "cedar") {
        meldingen.push({ niveau: "info", bericht: `${item.id}: taal ${item.language}, niet ingelezen.` });
        continue;
      }
      const voor = policies.length;
      leesTekst(String(item?.data || ""), { naam: item?.id, bron: { ...item, data: null } });
      const n = policies.length - voor;
      if (n > 1) {
        meldingen.push({ niveau: "waarschuwing", bericht: `${item.id}: ${n} policies in één item; elk een eigen element (${item.id}#1 …). Terugschrijven geeft ze als losse items.` });
        policies.slice(voor).forEach((p, i) => (p.naam = `${item.id}#${i + 1}`));
      }
    }
  } else if (json?.staticPolicies) {
    for (const [id, est] of Object.entries(json.staticPolicies)) policies.push({ tekst: policyTekst(est), est, naam: id });
    if (Object.keys(json.templates || {}).length) meldingen.push({ niveau: "info", bericht: `${Object.keys(json.templates).length} template(s) niet ingelezen (nog niet in het profiel).` });
  } else if (json?.effect) policies.push({ tekst: policyTekst(json), est: json });
  else if (json && typeof json === "object" && Object.values(json).some((ns) => ns && (ns.entityTypes || ns.actions))) schema = json;
  else meldingen.push({ niveau: "fout", bericht: "JSON herkend, maar geen Cedar-policyset, -policy, -schema of Open FTV-lijst." });

  // ── Policies → elementen ───────────────────────────────────────────────────────────────
  const gebruikt = new Set();
  const nietActie = new Set();
  policies.forEach((p, i) => {
    let naam = p.naam || p.est.annotations?.id || `policy${i}`;
    while (gebruikt.has(naam)) naam = `${naam}_`;
    gebruikt.add(naam);
    const id = `pol_${veilig(naam)}`;
    const data = { tekst: p.tekst, cedarVan: p.tekst, cedar: p.est, effect: p.est.effect, fout: "" };
    if (p.bron) {
      Object.assign(data, { bron: p.bron, titel: p.bron.metadata?.title || "", beschrijving: p.bron.metadata?.description || "", status: p.bron.status || "" });
    }
    elements[id] = { id, naam, elementType: "policy", compartimenten: [], data };
    // Meldingen per policy.
    const acties = p.est.action?.entities || (p.est.action?.entity ? [p.est.action.entity] : []);
    for (const a of acties) if (!isActieType(a.type)) nietActie.add(a.type);
    for (const c of p.est.conditions || []) {
      const v = c.body?.Value;
      if ((c.kind === "when" && v === false) || (c.kind === "unless" && v === true)) meldingen.push({ niveau: "waarschuwing", elementId: id, bericht: `${naam}: geldt nooit (${c.kind} { ${v} }); bewaard zoals het is.` });
    }
    if (JSON.stringify(p.est).includes('"slot"') || JSON.stringify(p.est).includes('"Slot"')) meldingen.push({ niveau: "info", elementId: id, bericht: `${naam}: een template (?principal/?resource); bewaard als tekst, nog niet als template gemodelleerd.` });
  });
  for (const type of nietActie) {
    meldingen.push({
      niveau: "waarschuwing",
      bericht: `Acties van type ${type} (${type}::"…"): volgens de Cedar-specificatie moet een actie type Action hebben (${type}::Action::"…"); cedar-go (Open FTV) neemt het aan, de officiële parser niet. Bewaard zoals het is.`,
    });
  }

  // ── Schema: gelezen, of afgeleid uit de policies ───────────────────────────────────────
  if (schema) leesSchema(schema, elements);
  else if (leidSchemaAf && policies.length) leidSchema(policies.map((p) => p.est), elements, meldingen);

  // ── Diagram ────────────────────────────────────────────────────────────────────────────
  const afgeleid = leidAf(elements) || elements;
  const knopen = Object.values(afgeleid).filter((el) => !isConnector(el)).map((el) => el.id);
  const posities = cedarPosities({ ids: knopen, elements: afgeleid });
  const stam = String(bestandsnaam || "cedar").replace(/\.[^.]*$/, "") || "cedar";
  const diagramId = `cedar_${veilig(stam)}`;
  return {
    elements: afgeleid,
    diagrams: { [diagramId]: { id: diagramId, naam: stam, nodes: knopen.map((id) => ({ elementId: id, position: posities[id] })), edges: [] } },
    meldingen,
  };
}

/** Cedar-schema (JSON) → entiteittypen, acties en common types met hun pijlen. */
function leesSchema(schema, elements) {
  for (const [ns, inhoud] of Object.entries(schema)) {
    const vol = (n) => (ns && !String(n).includes("::") ? `${ns}::${n}` : n);
    for (const [naam, def] of Object.entries(inhoud?.commonTypes || {})) {
      const id = `ct_${veilig(vol(naam))}`;
      elements[id] = { id, naam: vol(naam), elementType: "commontype", compartimenten: [], data: { definitie: JSON.stringify(def, null, 2) } };
    }
    for (const [naam, def] of Object.entries(inhoud?.entityTypes || {})) {
      const id = `et_${veilig(vol(naam))}`;
      const attrs = Object.entries(def?.shape?.attributes || {}).map(([a, t]) => ({ naam: a, fieldType: "attribuut", data: { typeLabel: typeTekst(t), ...(t.required === false ? { optioneel: true } : {}), json: t, jsonVan: typeTekst(t) } }));
      elements[id] = { id, naam: vol(naam), elementType: "entiteittype", compartimenten: attrs.length ? [{ compartmentType: "attributen", velden: attrs }] : [], data: { ...(def?.tags ? { tags: typeTekst(def.tags) } : {}) } };
    }
    const actieType = ns ? `${ns}::Action` : "Action";
    for (const [naam, def] of Object.entries(inhoud?.actions || {})) {
      const id = `act_${veilig(actieType)}__${veilig(naam)}`;
      elements[id] = { id, naam, elementType: "actie", compartimenten: [], data: { actietype: actieType, ...(def?.appliesTo?.context ? { context: JSON.stringify(def.appliesTo.context, null, 2) } : {}) } };
    }
    // Pijlen, nu alle doelen bestaan.
    for (const [naam, def] of Object.entries(inhoud?.entityTypes || {})) {
      for (const ouder of def?.memberOfTypes || []) verbind(elements, "lid", `et_${veilig(vol(naam))}`, `et_${veilig(vol(ouder))}`);
    }
    for (const [naam, def] of Object.entries(inhoud?.actions || {})) {
      const id = `act_${veilig(actieType)}__${veilig(naam)}`;
      for (const t of def?.appliesTo?.principalTypes || []) verbind(elements, "geldtVoor", id, `et_${veilig(vol(t))}`, { rol: "principal" });
      for (const t of def?.appliesTo?.resourceTypes || []) verbind(elements, "geldtVoor", id, `et_${veilig(vol(t))}`, { rol: "resource" });
      for (const g of def?.memberOf || []) verbind(elements, "lid", id, `act_${veilig(g.type || actieType)}__${veilig(g.id)}`);
    }
  }
}

function verbind(elements, soort, van, naar, data = {}) {
  if (!elements[van] || !elements[naar]) return;
  const id = `${soort}__${van}__${naar}${data.rol ? `__${data.rol}` : ""}`;
  elements[id] ??= { id, naam: "", elementType: soort, source: van, target: naar, compartimenten: [], data };
}

/**
 * Geen schema (PABC): typen uit de scope en entiteit-literals, attributen uit de condities
 * (`principal.x`, `resource.x`), het type van een attribuut uit het gebruik, acties met hun
 * appliesTo uit de scope.
 */
function leidSchema(ests, elements, meldingen) {
  const typen = new Map(); // naam → Map(attr → type)
  const type = (naam) => {
    if (!typen.has(naam)) typen.set(naam, new Map());
    return typen.get(naam);
  };
  const acties = new Map(); // "type::id" → {type, id, principal: Set, resource: Set}
  let losAttr = 0;
  const scopeTypen = (s) => (s?.op === "is" ? [s.entity_type] : s?.op === "==" && s.entity ? [s.entity.type] : []);
  for (const est of ests) {
    const pt = scopeTypen(est.principal);
    const rt = scopeTypen(est.resource);
    for (const t of [...pt, ...rt]) type(t);
    for (const s of [est.principal, est.resource]) {
      if (s?.entity && s.op === "in") type(s.entity.type);
      if (s?.in?.entity) type(s.in.entity.type);
    }
    for (const a of est.action?.entities || (est.action?.entity ? [est.action.entity] : [])) {
      const k = `${a.type}::${a.id}`;
      if (!acties.has(k)) acties.set(k, { type: a.type, id: a.id, principal: new Set(), resource: new Set() });
      pt.forEach((t) => acties.get(k).principal.add(t));
      rt.forEach((t) => acties.get(k).resource.add(t));
    }
    // Attributen: loop de condities af, met het type van de ouder-uitdrukking.
    const bezoek = (e, context) => {
      if (!e || typeof e !== "object") return;
      const k = Object.keys(e)[0];
      const v = e[k];
      if (k === "Value" && v?.__entity && !isActieType(v.__entity.type)) type(v.__entity.type);
      if (k === "." && v.left?.Var && (v.left.Var === "principal" || v.left.Var === "resource")) {
        const doel = v.left.Var === "principal" ? pt : rt;
        if (!doel.length) losAttr += 1;
        for (const t of doel) if (!type(t).has(v.attr) || type(t).get(v.attr) === "?") type(t).set(v.attr, context || "?");
      }
      const zet = (x, ctx) => bezoek(x, ctx);
      if (["contains", "containsAll", "containsAny"].includes(k)) {
        const arg = v.right?.Value;
        const elem = typeof arg === "string" ? "String" : typeof arg === "number" ? "Long" : typeof arg === "boolean" ? "Bool" : "?";
        zet(v.left, k === "contains" ? `Set<${elem}>` : `Set<${typeof v.right?.Set?.[0]?.Value === "string" ? "String" : "?"}>`);
        zet(v.right);
        return;
      }
      if (["==", "!="].includes(k)) {
        const lit = (x) => (typeof x?.Value === "string" ? "String" : typeof x?.Value === "number" ? "Long" : typeof x?.Value === "boolean" ? "Bool" : x?.Value?.__entity ? x.Value.__entity.type : null);
        zet(v.left, lit(v.right) || undefined);
        zet(v.right, lit(v.left) || undefined);
        return;
      }
      if (["<", "<=", ">", ">="].includes(k)) {
        zet(v.left, "Long");
        zet(v.right, "Long");
        return;
      }
      if (k === "like") return zet(v.left, "String");
      // `resource has x`: het attribuut bestaat (optioneel), type onbekend.
      if (k === "has" && (v.left?.Var === "principal" || v.left?.Var === "resource")) {
        const attr = Array.isArray(v.attr) ? v.attr[0] : v.attr;
        for (const t of v.left.Var === "principal" ? pt : rt) if (!type(t).has(attr)) type(t).set(attr, "?");
        return;
      }
      if (Array.isArray(v)) return v.forEach((x) => zet(x));
      if (v && typeof v === "object") for (const x of Object.values(v)) if (x && typeof x === "object") zet(x);
    };
    for (const c of est.conditions || []) bezoek(c.body);
  }
  for (const [naam, attrs] of typen) {
    const id = `et_${veilig(naam)}`;
    if (elements[id]) continue;
    const velden = [...attrs].map(([a, t]) => ({ naam: a, fieldType: "attribuut", data: { typeLabel: t === "?" ? "" : t, optioneel: true } }));
    elements[id] = { id, naam, elementType: "entiteittype", compartimenten: velden.length ? [{ compartmentType: "attributen", velden }] : [], data: { afgeleid: true } };
  }
  for (const a of acties.values()) {
    const id = `act_${veilig(a.type)}__${veilig(a.id)}`;
    elements[id] = { id, naam: a.id, elementType: "actie", compartimenten: [], data: { actietype: a.type, afgeleid: true } };
    for (const t of a.principal) verbind(elements, "geldtVoor", id, `et_${veilig(t)}`, { rol: "principal" });
    for (const t of a.resource) verbind(elements, "geldtVoor", id, `et_${veilig(t)}`, { rol: "resource" });
  }
  meldingen.push({ niveau: "info", bericht: `Geen schema: ${typen.size} entiteittype(n) en ${acties.size} actie(s) afgeleid uit de policies (gemarkeerd als afgeleid).` });
  if (losAttr) meldingen.push({ niveau: "info", bericht: `${losAttr} attribuutgebruik(en) op een principal of resource zonder type in de scope: niet bij een entiteittype gezet.` });
}

// ── Uit ──────────────────────────────────────────────────────────────────────────────────
/**
 * @param {{elements?: Record<string, any>}} staat
 * @param {{vorm?: "tekst"|"json"|"openftv"|"schema"}} [opties]
 * @returns {{tekst: string, meldingen: Melding[]}}
 */
export function naarCedar(staat, { vorm = "tekst" } = {}) {
  /** @type {Melding[]} */
  const meldingen = [];
  const alle = Object.values(leidAf(staat?.elements) || staat?.elements || {});
  if (vorm === "schema") return { tekst: `${JSON.stringify(schemaJson(alle, meldingen), null, 2)}\n`, meldingen };

  const policies = alle.filter((el) => el.elementType === "policy");
  const tekstVan = (el) => {
    if (el.data?.fout) meldingen.push({ niveau: "fout", elementId: el.id, bericht: `${el.naam}: ${el.data.fout} (tekst ongewijzigd geschreven)` });
    return String(el.data?.tekst || (el.data?.cedar ? policyTekst(el.data.cedar) : "")).trim();
  };
  if (vorm === "tekst") return { tekst: `${policies.map(tekstVan).join("\n\n")}\n`, meldingen };
  if (vorm === "json") {
    const goed = policies.filter((el) => el.data?.cedar && !el.data?.fout);
    if (goed.length < policies.length) meldingen.push({ niveau: "fout", bericht: `${policies.length - goed.length} policy/policies met een leesfout niet in de JSON.` });
    return { tekst: `${JSON.stringify(policySetJson(goed.map((el) => ({ id: el.naam, est: el.data.cedar }))), null, 2)}\n`, meldingen };
  }
  // Open FTV-lijst: het bewaarde item, met de (eventueel gewijzigde) tekst, titel en beschrijving.
  const items = policies.map((el) => {
    const d = el.data || {};
    const bron = d.bron || { id: el.naam, language: "cedar", status: d.status || "draft", metadata: {}, data: null };
    const item = {};
    for (const [k, v] of Object.entries(bron)) {
      if (k === "data") item.data = `${tekstVan(el)}\n`;
      else if (k === "metadata") item.metadata = { ...v, ...(d.titel !== undefined ? { title: d.titel } : {}), ...(d.beschrijving !== undefined ? { description: d.beschrijving } : {}) };
      else if (k === "status" && d.status) item.status = d.status;
      else item[k] = v;
    }
    if (!("data" in item)) item.data = `${tekstVan(el)}\n`;
    // Lege titel/beschrijving die er niet was: niet toevoegen.
    for (const k of ["title", "description"]) if (item.metadata && item.metadata[k] === "" && !(k in (bron.metadata || {}))) delete item.metadata[k];
    return item;
  });
  return { tekst: `${JSON.stringify(items, null, 1)}\n`, meldingen };
}

/** Entiteittypen, acties en common types → Cedar-schema (JSON), per namespace. */
function schemaJson(alle, meldingen) {
  /** @type {Record<string, any>} */
  const schema = {};
  const ns = (naam) => {
    const i = String(naam).lastIndexOf("::");
    return i < 0 ? ["", naam] : [naam.slice(0, i), naam.slice(i + 2)];
  };
  const deel = (n) => (schema[n] ??= { entityTypes: {}, actions: {} });
  const byId = Object.fromEntries(alle.map((el) => [el.id, el]));
  const lijnen = alle.filter(isConnector);
  for (const el of alle.filter((e) => e.elementType === "commontype")) {
    const [n, lokaal] = ns(el.naam);
    try {
      (deel(n).commonTypes ??= {})[lokaal] = JSON.parse(el.data?.definitie || "{}");
    } catch {
      meldingen.push({ niveau: "fout", elementId: el.id, bericht: `${el.naam}: definitie is geen JSON; overgeslagen.` });
    }
  }
  for (const el of alle.filter((e) => e.elementType === "entiteittype")) {
    const [n, lokaal] = ns(el.naam);
    const attributes = {};
    for (const v of (el.compartimenten || []).flatMap((c) => c.velden || [])) {
      const d = v.data || {};
      const t = d.json && d.jsonVan === d.typeLabel ? { ...d.json } : typeJson(d.typeLabel || "String");
      if (d.optioneel) t.required = false;
      else delete t.required;
      attributes[v.naam] = t;
    }
    const ouders = lijnen.filter((l) => l.elementType === "lid" && l.source === el.id).map((l) => byId[l.target]?.naam).filter(Boolean);
    deel(n).entityTypes[lokaal] = { ...(ouders.length ? { memberOfTypes: ouders.map((o) => (ns(o)[0] === n ? ns(o)[1] : o)) } : {}), shape: { type: "Record", attributes } };
  }
  const nietActie = new Set();
  for (const el of alle.filter((e) => e.elementType === "actie")) {
    const type = el.data?.actietype || "Action";
    let n = type === "Action" ? "" : type.replace(/::Action$/, "");
    if (!isActieType(type)) nietActie.add(type);
    const rol = (r) => lijnen.filter((l) => l.elementType === "geldtVoor" && l.source === el.id && l.data?.rol === r).map((l) => byId[l.target]?.naam).filter(Boolean);
    const groepen = lijnen.filter((l) => l.elementType === "lid" && l.source === el.id).map((l) => byId[l.target]).filter(Boolean);
    let context;
    try {
      context = el.data?.context ? JSON.parse(el.data.context) : undefined;
    } catch {
      meldingen.push({ niveau: "fout", elementId: el.id, bericht: `${el.naam}: context is geen JSON; weggelaten.` });
    }
    deel(n).actions[el.naam] = {
      ...(groepen.length ? { memberOf: groepen.map((g) => ({ id: g.naam, ...((g.data?.actietype || "Action") !== type ? { type: g.data.actietype } : {}) })) } : {}),
      appliesTo: { principalTypes: rol("principal"), resourceTypes: rol("resource"), ...(context ? { context } : {}) },
    };
  }
  for (const t of nietActie) meldingen.push({ niveau: "waarschuwing", bericht: `Acties van type ${t}: in een Cedar-schema staan ze onder namespace ${t} en heten dan ${t}::Action::"…", niet ${t}::"…" zoals in de policies.` });
  return schema;
}
