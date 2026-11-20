// @ts-check
/**
 * jsonldSchrijver — **schrijver**: dezelfde triples als de Turtle-schrijver, als JSON-LD.
 *
 * Tweede schrijfvorm naast `turtleSchrijver.js` (zie docs/TRANSFORMATIES.md §3):
 *
 *   plan ──planNaarTriples──▶ triples ─┬─ triplesNaarTurtle ──▶ Turtle
 *                                      └─ triplesNaarJsonLd ──▶ JSON-LD
 *
 * De regelset bepaalt wát er staat; de schrijfvorm alleen hóe. Beide vormen
 * zeggen daarom altijd hetzelfde: dit bestand kent geen regels en geen
 * vocabulaire, alleen de vorm van JSON-LD 1.1.
 *
 * De uitvoer is een **vlak** document: een `@context` met de prefixen van de
 * schrijver, en een `@graph` met per subject één knoop. Namen blijven compact
 * (`odrl:permission`, `b:regel-x`); een JSON-LD-lezer vouwt ze uit met de
 * context. Waarden:
 *
 *   verwijzing            { "@id": "odrl:read" }
 *   tekst met taal        { "@value": "…", "@language": "nl" }
 *   waarde met datatype   { "@value": "2026-05-01", "@type": "xsd:date" }
 *   getal, waar/onwaar    de JSON-waarde zelf
 *   kale tekst            de tekst zelf
 *   RDF-lijst             { "@list": [ { "@id": … }, … ] }
 *
 * Eén waarde staat los, meer waarden in een lijst (JSON-LD maakt daar geen
 * verschil tussen). `rdf:type` wordt `@type`. De volgorde is die van de triples.
 *
 * Puur, zonder dependencies.
 */
import { planNaarTriples } from "./turtleSchrijver.js";

/** RdfObject (zie turtleSchrijver.js) → JSON-LD-waarde. */
function waarde(o) {
  if (o.soort === "iri") return { "@id": o.waarde };
  if (o.soort === "lijst") return { "@list": o.leden.map((lid) => ({ "@id": lid })) };
  if (o.soort === "kaal") {
    if (o.waarde === "true" || o.waarde === "false") return o.waarde === "true";
    const getal = Number(o.waarde);
    return o.waarde.trim() !== "" && Number.isFinite(getal) ? getal : o.waarde;
  }
  if (o.taal) return { "@value": o.waarde, "@language": o.taal };
  if (o.datatype) return { "@value": o.waarde, "@type": o.datatype };
  return o.waarde;
}

/**
 * Triples → JSON-LD-document.
 *
 * @param {import("./turtleSchrijver.js").Triple[]} triples
 * @param {{prefixes?: Record<string, string>}} context  dezelfde context als de Turtle-schrijver
 * @returns {{"@context": Record<string, string>, "@graph": any[]}}
 */
export function triplesNaarJsonLd(triples, context) {
  /** @type {Map<string, any>} */
  const knopen = new Map();
  for (const t of triples) {
    if (!knopen.has(t.s)) knopen.set(t.s, { "@id": t.s });
    const knoop = knopen.get(t.s);
    // rdf:type is in JSON-LD het sleutelwoord @type, met de naam zelf als waarde.
    const [sleutel, w] = t.p === "a" ? ["@type", t.o.waarde] : [t.p, waarde(t.o)];
    if (!(sleutel in knoop)) knoop[sleutel] = w;
    else if (Array.isArray(knoop[sleutel])) knoop[sleutel].push(w);
    else knoop[sleutel] = [knoop[sleutel], w];
  }
  return { "@context": { ...(context.prefixes || {}) }, "@graph": [...knopen.values()] };
}

/**
 * JSON-LD-document (zoals deze schrijver het maakt) → triples in dezelfde vorm
 * als `planNaarTriples`. Voor de toets dat beide schrijfvormen hetzelfde
 * zeggen; geen algemene JSON-LD-lezer.
 * @param {{"@graph": any[]}} document
 * @returns {import("./turtleSchrijver.js").Triple[]}
 */
export function jsonLdNaarTriples(document) {
  const terug = (w) => {
    if (typeof w === "number" || typeof w === "boolean") return { soort: "kaal", waarde: String(w) };
    if (typeof w === "string") return { soort: "literal", waarde: w };
    if ("@list" in w) return { soort: "lijst", leden: w["@list"].map((lid) => lid["@id"]) };
    if ("@id" in w) return { soort: "iri", waarde: w["@id"] };
    return { soort: "literal", waarde: w["@value"], ...(w["@language"] ? { taal: w["@language"] } : {}), ...(w["@type"] ? { datatype: w["@type"] } : {}) };
  };
  const triples = [];
  for (const knoop of document["@graph"] || []) {
    for (const [sleutel, ruw] of Object.entries(knoop)) {
      if (sleutel === "@id") continue;
      for (const w of Array.isArray(ruw) ? ruw : [ruw]) {
        triples.push(sleutel === "@type" ? { s: knoop["@id"], p: "a", o: { soort: "iri", waarde: w } } : { s: knoop["@id"], p: sleutel, o: terug(w) });
      }
    }
  }
  return triples;
}

/**
 * Plan → JSON-LD in één keer.
 *
 * @param {{elementen: any[], connectoren: any[]}} plan
 * @param {any} context
 * @returns {{document: any, tekst: string, triples: any[], diagnostics: any[]}}
 */
export function schrijfJsonLd(plan, context) {
  const { triples, diagnostics } = planNaarTriples(plan, context);
  const document = triplesNaarJsonLd(triples, context);
  return { document, tekst: `${JSON.stringify(document, null, 2)}\n`, triples, diagnostics };
}
