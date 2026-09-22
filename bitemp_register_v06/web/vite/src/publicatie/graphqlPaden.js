/**
 * graphqlPaden.js — veldpaden uit een detail-template afstemmen op het GraphQL-schema.
 *
 * Template-auteurs denken in klassenamen en in "de gemeente van deze koppeling"
 * (zoals in de CEL-expressie van een weergavenaam: `GemeenteGegevens.naam`). GraphQL kent
 * alleen veldnamen (`gemeentegegevens`, soms meervoud: `organisatienamen`) en vraagt elke
 * stap expliciet (`initiatief_gemeenten.gemeente.gemeentegegevens.naam`). Bovendien laat één
 * onbekend veld de hele query mislukken, en daarmee de hele detailpagina.
 *
 * normaliseerTemplatePaden herschrijft daarom elk pad in het template naar het echte
 * GraphQL-pad, per segment:
 *   1. exacte veldnaam;
 *   2. zelfde naam, andere hoofdletters;
 *   3. klassenaam van een GE: veld waarvan het type eindigt op `_<Klassenaam>`
 *      (GE-typen heten `<Entiteit>_<Klassenaam>`, bv. `Gemeente_GemeenteGegevens`);
 *   4. één stap overgeslagen: staat het segment niet op dit type, maar wel (volgens 1–3) op
 *      precies één objectveld eronder, dan wordt die stap ingevoegd. Zo wordt
 *      `initiatief_gemeenten.GemeenteGegevens.naam` → `….gemeente.gemeentegegevens.naam`, en
 *      `gemeente.naam` → `gemeente.gemeentegegevens.naam`. Bij twijfel (meer dan één kandidaat)
 *      gebeurt er niets.
 * Een pad dat niet op te lossen is, wordt verwijderd (placeholder → leeg, voorwaarde → onwaar)
 * met een waarschuwing in de console, zodat de rest van de pagina blijft werken.
 *
 * Zuivere functies, zonder React of fetch, zodat ze met node:test te testen zijn.
 */

/** Introspectie-query: alle typen met hun velden en (uitgepakte) veldtypen. */
export const INTROSPECTIE_QUERY = `{
  __schema {
    queryType { name }
    types {
      name
      kind
      fields {
        name
        type { name kind ofType { name kind ofType { name kind ofType { name kind } } } }
      }
    }
  }
}`;

/** Pakt LIST/NON_NULL uit tot het benoemde type. */
function pakTypeUit(t) {
  let huidig = t;
  while (huidig && !huidig.name && huidig.ofType) huidig = huidig.ofType;
  return huidig ? { naam: huidig.name, kind: huidig.kind } : { naam: null, kind: null };
}

/**
 * Bouwt uit een introspectie-antwoord een index:
 *   { queryType: "Query", typen: { Type: { veld: { type: "Type2", object: true } } } }
 */
export function bouwSchemaIndex(introspectie) {
  const schema = introspectie?.__schema ?? introspectie?.data?.__schema;
  if (!schema) return null;
  const typen = {};
  for (const t of schema.types ?? []) {
    if (!t?.fields || t.name.startsWith("__")) continue;
    const velden = {};
    for (const f of t.fields) {
      const { naam, kind } = pakTypeUit(f.type);
      velden[f.name] = { type: naam, object: kind === "OBJECT" };
    }
    typen[t.name] = velden;
  }
  return { queryType: schema.queryType?.name ?? "Query", typen };
}

/** Het GraphQL-type dat full_<padnaam> teruggeeft (bv. "Initiatief"). */
export function rootTypeVoor(index, padnaam) {
  return index?.typen?.[index.queryType]?.[`full_${padnaam}`]?.type ?? null;
}

// Velden die bij het zoeken naar een overgeslagen stap niet meedoen: de data-laag
// (al samengevoegd in de hub), aanvang/einde, en terugverwijzingen (kringen).
function isHopKandidaat(naam) {
  return naam !== "data" && naam !== "aanvang" && naam !== "einde" && !naam.startsWith("gerelateerde_");
}

/** Regels 1–3: segment direct op dit type. Geeft de echte veldnaam of null. */
function zoekVeld(index, typeNaam, segment) {
  const velden = index.typen[typeNaam];
  if (!velden) return null;
  if (velden[segment]) return segment;
  const klein = segment.toLowerCase();
  const opNaam = Object.keys(velden).filter((v) => v.toLowerCase() === klein);
  if (opNaam.length === 1) return opNaam[0];
  const opKlasse = Object.keys(velden).filter(
    (v) => velden[v].object && (velden[v].type ?? "").toLowerCase().endsWith(`_${klein}`)
  );
  return opKlasse.length === 1 ? opKlasse[0] : null;
}

/** Splitst "naam[veld=waarde]" in { naam, filter } (filter inclusief haken, of ""). */
function splitsSegment(seg) {
  const i = seg.indexOf("[");
  return i === -1 ? { naam: seg, filter: "" } : { naam: seg.slice(0, i), filter: seg.slice(i) };
}

/**
 * Normaliseert één veldpad tegen het schema, vanaf rootType.
 * Geeft het echte pad terug, of null als het niet op te lossen is.
 */
export function normaliseerPad(index, rootType, pad) {
  if (!index || !rootType) return pad;
  let type = rootType;
  const uit = [];
  // Veldpaden splitsen op punten buiten [..]-filters (waarden mogen punten bevatten).
  const segmenten = pad.match(/[^.[\]]+(?:\[[^\]]*\])?/g) ?? [];
  for (const seg of segmenten) {
    const { naam, filter } = splitsSegment(seg);
    if (naam === "data") {
      uit.push(seg); // GraphQL heeft hub en data al samengevoegd; resolveVeldpad slaat 'data' over
      continue;
    }
    if (!type) return null; // er volgt nog een segment na een scalar veld
    let veld = zoekVeld(index, type, naam);
    if (!veld) {
      const velden = index.typen[type] ?? {};
      const hops = Object.keys(velden)
        .filter((v) => velden[v].object && isHopKandidaat(v))
        .map((v) => [v, zoekVeld(index, velden[v].type, naam)])
        .filter(([, gevonden]) => gevonden);
      if (hops.length !== 1) return null;
      const [hop, gevonden] = hops[0];
      uit.push(hop);
      type = velden[hop].type;
      veld = gevonden;
    }
    uit.push(veld + filter);
    const info = index.typen[type][veld];
    type = info.object ? info.type : null;
  }
  return uit.join(".");
}

/**
 * Herschrijft alle paden in een template ({{pad}}, {{#if pad}}, {{#unless pad}}) naar echte
 * GraphQL-paden. Onoplosbare paden: {{pad}} → leeg, {{#if pad}} → onwaar (__onbekend).
 * Geeft { template, onbekend: [paden] }.
 */
export function normaliseerTemplatePaden(template, index, rootType) {
  const onbekend = [];
  if (!template || !index || !rootType) return { template, onbekend };
  const cache = new Map();
  const los = (pad) => {
    if (!cache.has(pad)) cache.set(pad, normaliseerPad(index, rootType, pad));
    return cache.get(pad);
  };
  const uit = template.replace(/\{\{([^}]+)\}\}/g, (geheel, inhoud) => {
    const t = inhoud.trim();
    if (t === "else" || t.startsWith("/")) return geheel;
    const vw = /^#(if|unless)\s+(.+)$/.exec(t);
    const pad = vw ? vw[2].trim() : t;
    const echt = los(pad);
    if (echt == null) {
      if (!onbekend.includes(pad)) onbekend.push(pad);
      return vw ? `{{#${vw[1]} __onbekend}}` : "";
    }
    return vw ? `{{#${vw[1]} ${echt}}}` : `{{${echt}}}`;
  });
  return { template: uit, onbekend };
}
