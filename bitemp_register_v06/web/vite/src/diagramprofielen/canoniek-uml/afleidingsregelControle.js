// @ts-check
/**
 * afleidingsregelControle — statische controle van de afleidingsregel van een
 * **afgeleide relatie** in canoniek-uml (2026-10-11). Voorvertoning in de
 * Studio, vóór het register hem uitrekent.
 *
 * Volgt de syntaxis van de backend (`docs/plans/2026-10-11 Afgeleide relaties
 * backend — ontwerp.md` §3):
 *   - de context is de **bronentiteit** (de bron van de relatie); namen zijn de
 *     klassenaam van een GE/relatie (eerste voorkomen) of zijn rolnaam
 *     (`meervoud`, de lijst), plus `self`; hoofdletterongevoelig, exact gaat voor;
 *   - een relatie kijkt door naar haar **doel**: een naam die zij zelf niet kent
 *     (eigen velden, `rel_id`, `<doel>_id`) wordt in de doelentiteit gezocht;
 *   - een pad over een lijst verzamelt (collect) — statisch is dat hetzelfde
 *     type, dus een lijst hoeft hier niet apart te worden gevolgd;
 *   - de uitkomst moet wijzen naar exemplaren van het doel van de relatie: een
 *     relatie met dat doel, die entiteit zelf, of een id.
 *
 * Bekend gat in het register (BACKEND, 11-10): bij een opgeslagen
 * **zelf-relatie** (doel = bron, bv. Persoon → Persoon) valt de doelkolom
 * (`persoon_id`) samen met de eigen FK-kolom; codegen vangt dat nog niet af.
 * Een pad door zo'n relatie geeft daarom een waarschuwing.
 *
 * De doelkolom heet `<doelnaam in kleine letters>_id`, zonder underscore
 * tussen woorddelen (`natuurlijkpersoon_id`), zoals codegen hem maakt.
 *
 * De controle kent alleen het model, geen data. `filter`/`[n]` houden het type;
 * `map` en andere constructies zijn niet statisch te volgen en geven een
 * waarschuwing in plaats van een fout. Puur en store-loos.
 */
import { parseCelExpressie } from "../../shared/celEvaluator.js";

/**
 * @typedef {{soort: "entiteit"|"ge"|"relatie"|"waarde"|"onbekend", id?: string, naam?: string}} Plek
 * @typedef {{niveau: "ok"|"waarschuwing"|"fout", melding: string}} Uitslag
 */

const laag = (s) => String(s ?? "").toLowerCase();

/** Kies de treffer: exacte naam gaat voor, anders hoofdletterongevoelig. */
function kies(kandidaten, naam) {
  return (
    kandidaten.find((k) => k.namen.includes(naam)) ||
    kandidaten.find((k) => k.namen.some((n) => laag(n) === laag(naam))) ||
    null
  );
}

/** Veldnamen van een element (alle compartimenten). */
function veldnamen(el) {
  return (el?.compartimenten || []).flatMap((c) => (c.velden || []).map((v) => v.naam).filter(Boolean));
}

/**
 * De namen die een entiteit in haar context aanbiedt: haar GE's (via een
 * compositie) en haar relaties (als bron), elk onder klassenaam en rolnaam.
 * @param {Record<string, any>} elements
 * @param {string} entiteitId
 */
function namenVanEntiteit(elements, entiteitId) {
  const uit = [];
  for (const c of Object.values(elements)) {
    if (!c?.source || c.source !== entiteitId) continue;
    if (c.elementType === "compositie") {
      const ge = elements[c.target];
      if (ge?.elementType === "gegevenselement") {
        uit.push({ plek: { soort: "ge", id: ge.id, naam: ge.naam }, namen: [ge.naam, ge.data?.meervoud].filter(Boolean) });
      }
    } else if (c.elementType === "relatie") {
      uit.push({ plek: { soort: "relatie", id: c.id, naam: c.naam }, namen: [c.naam, c.data?.meervoud].filter(Boolean) });
    }
  }
  // Eigen velden van de entiteit zelf (en haar id) zijn waarden.
  const ent = elements[entiteitId];
  for (const v of [...veldnamen(ent), "id"]) uit.push({ plek: { soort: "waarde", naam: v }, namen: [v] });
  return uit;
}

/**
 * Volg één naam vanaf een plek.
 * @param {Record<string, any>} elements
 * @param {Plek} plek
 * @param {string} naam
 * @returns {Plek|{fout: string}}
 */
function stap(elements, plek, naam) {
  if (plek.soort === "entiteit") {
    const t = kies(namenVanEntiteit(elements, plek.id), naam);
    return t ? t.plek : { fout: `"${naam}" bestaat niet op ${elements[plek.id]?.naam || "de entiteit"}` };
  }
  if (plek.soort === "ge") {
    const ge = elements[plek.id];
    if (["id", "rel_id"].includes(laag(naam)) || veldnamen(ge).some((v) => laag(v) === laag(naam))) return { soort: "waarde", naam };
    return { fout: `"${naam}" is geen veld van ${ge?.naam || "het gegevenselement"}` };
  }
  if (plek.soort === "relatie") {
    const rel = elements[plek.id];
    const doel = elements[rel?.target];
    // Eigen velden van het relatie-voorkomen gaan voor.
    const eigen = ["rel_id", doel ? `${laag(doel.naam)}_id` : "", ...veldnamen(rel)].filter(Boolean);
    if (eigen.some((v) => laag(v) === laag(naam))) return { soort: "waarde", naam };
    // Doorkijk naar het doel.
    if (!doel) return { fout: `de relatie ${rel?.naam || ""} heeft geen doel` };
    const t = kies(namenVanEntiteit(elements, doel.id), naam);
    return t ? t.plek : { fout: `"${naam}" bestaat niet op ${doel.naam} (doel van ${rel?.naam})` };
  }
  if (plek.soort === "waarde") return { fout: `"${naam}" volgt op een waarde; daar valt niet verder te navigeren` };
  return { soort: "onbekend" };
}

/**
 * Loop een AST na en geef de plek waar hij eindigt.
 * @returns {Plek|{fout: string}|{onbekend: string}}
 */
function volg(elements, node, scope, bezocht = []) {
  const registreer = (plek) => {
    if (plek && plek.soort === "relatie" && plek.id) bezocht.push(plek.id);
    return plek;
  };
  switch (node?.type) {
    case "ident": {
      if (node.name in scope) return scope[node.name];
      return registreer(stap(elements, scope.self, node.name));
    }
    case "field": {
      const obj = volg(elements, node.obj, scope, bezocht);
      if ("fout" in obj || "onbekend" in obj) return obj;
      return registreer(stap(elements, obj, node.field));
    }
    case "index":
      return volg(elements, node.obj, scope, bezocht);
    case "methodcall": {
      if (node.method === "filter") return volg(elements, node.obj, scope, bezocht);
      if (["size", "exists", "all"].includes(node.method)) return { soort: "waarde", naam: node.method };
      return { onbekend: `${node.method}() is niet statisch te volgen` };
    }
    case "ref": {
      let plek = scope.self;
      for (const deel of node.parts || []) {
        const n = registreer(stap(elements, plek, deel));
        if ("fout" in n) return n;
        plek = n;
      }
      return plek;
    }
    default:
      return { onbekend: "deze vorm is niet statisch te volgen" };
  }
}

/**
 * Controleer de afleidingsregel van een afgeleide relatie.
 * @param {Record<string, any>} elements - het canoniek-model (sandbox)
 * @param {string} relatieId
 * @returns {Uitslag}
 */
export function controleerAfleidingsregel(elements, relatieId) {
  const rel = elements?.[relatieId];
  if (!rel?.data?.afgeleid) return { niveau: "ok", melding: "" };
  const regel = String(rel.data.afleidingsregel || "").trim();
  if (!regel) return { niveau: "fout", melding: "Een afgeleide relatie heeft een afleidingsregel nodig." };
  let ast;
  try {
    ast = parseCelExpressie(regel);
  } catch (e) {
    return { niveau: "fout", melding: `De regel parset niet: ${e?.message || e}` };
  }
  const bron = elements[rel.source];
  const doel = elements[rel.target];
  if (!bron || !doel) return { niveau: "waarschuwing", melding: "De relatie heeft nog geen bron en doel; de regel is alleen geparst." };
  const bezocht = [];
  const eind = volg(elements, ast, { self: { soort: "entiteit", id: bron.id } }, bezocht);
  if ("fout" in eind) return { niveau: "fout", melding: eind.fout };
  // Zelf-relatie in het pad (opgeslagen, niet afgeleid): het register kan die nog niet bewaren.
  const zelf = bezocht.map((id) => elements[id]).find((r) => r && !r.data?.afgeleid && r.source && r.source === r.target);
  if (zelf) {
    return { niveau: "waarschuwing", melding: `Het pad loopt door de zelf-relatie ${zelf.naam} (${elements[zelf.source]?.naam} → zichzelf); die kan het register nog niet opslaan, dus de regel levert daar nog niets op.` };
  }
  if ("onbekend" in eind) return { niveau: "waarschuwing", melding: `Geparst; ${eind.onbekend}.` };
  if (eind.soort === "entiteit" && eind.id === doel.id) return { niveau: "ok", melding: `Levert ${doel.naam}.` };
  if (eind.soort === "relatie" && elements[eind.id]?.target === doel.id) return { niveau: "ok", melding: `Levert ${doel.naam} (via ${eind.naam}).` };
  if (eind.soort === "waarde") {
    return /(^|_)id$/i.test(eind.naam || "")
      ? { niveau: "waarschuwing", melding: `Levert een id ("${eind.naam}"); dat moet een id van ${doel.naam} zijn.` }
      : { niveau: "fout", melding: `Levert een waarde ("${eind.naam}"), geen ${doel.naam}.` };
  }
  const waar = eind.soort === "relatie" ? elements[elements[eind.id]?.target]?.naam : elements[eind.id]?.naam;
  return { niveau: "fout", melding: `Levert ${waar || eind.naam || "iets anders"}, maar het doel is ${doel.naam}.` };
}

/**
 * Waarschuwing als een afgeleide relatie eigen velden heeft: die gaan niet mee
 * naar V3 (de backend weigert ze).
 * @param {Record<string, any>} elements
 * @param {string} relatieId
 * @returns {string} lege string = niets aan de hand
 */
export function veldenBijAfgeleid(elements, relatieId) {
  const rel = elements?.[relatieId];
  if (!rel?.data?.afgeleid) return "";
  const n = veldnamen(rel).length;
  return n ? `Een afgeleide relatie heeft geen eigen velden; ${n === 1 ? "dit veld gaat" : `deze ${n} velden gaan`} niet mee naar het register.` : "";
}
