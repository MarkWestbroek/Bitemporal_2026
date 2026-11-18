// @ts-check
/**
 * rdfBrongraaf — **graaflaag** boven de Turtle-lezer: RDF-triples als brongraaf
 * voor de toepasser (`regels.js`).
 *
 * De lezer (`turtleLezer.js`) kent alleen de syntaxis; een regelset wil knopen
 * en verbindingen. Deze laag legt de triples zo neer dat een regelset er in
 * RDF-termen op kan toetsen, zonder zelf iets van ODRL, SKOS of een ander
 * vocabulaire te weten:
 *
 *   knoop       elk subject (geen lijstknoop), met
 *     id          de compacte IRI (`odrl:Set`, `b:regel-x`) of het blank-label
 *     iri         de volledige IRI (of het blank-label)
 *     klassen     de rdf:type-waarden, compact — een regel toetst op `klasse`
 *     tekst       rdfs:label, dct:title of skos:prefLabel (de eerste die er is)
 *     "p:x"       per predicaat de waarde als tekst — om op te toetsen
 *                 (`als: { "rdf:value": "odrl:read" }`)
 *     p.x         dezelfde waarde getypeerd — voor een sjabloon (`"{dct.title}"`):
 *                 een getal, een boolean, `{ datum }`, tekst, of een lijst daarvan;
 *                 een IRI is zijn compacte vorm
 *   verbinding  elk triple waarvan het object zelf een knoop is, met
 *     aard        het predicaat, compact
 *     positie     de plaats in een RDF-lijst (`odrl:and ( a b )`), anders 0
 *
 * rdf:type is geen verbinding (het staat in `klassen`). Een IRI zonder eigen
 * triples (odrl:eq, odrl:read) is geen knoop: hij is alleen een waarde.
 *
 * De volgorde is die van het bestand; RDF zelf kent er geen.
 *
 * Puur en zonder kennis van een vocabulaire.
 */
import { RdfGraaf, RDF, XSD, termSleutel } from "./turtleLezer.js";

const RDF_TYPE = `${RDF}type`;
const NAAM_PREDICATEN = ["http://www.w3.org/2000/01/rdf-schema#label", "http://purl.org/dc/terms/title", "http://www.w3.org/2004/02/skos/core#prefLabel"];
const GETALLEN = new Set(["integer", "decimal", "double", "float", "int", "long", "short", "nonNegativeInteger", "positiveInteger"].map((t) => XSD + t));

/**
 * Compacte schrijfwijze met een vaste prefixtabel: de langste namespace wint.
 * Anders dan `RdfGraaf.compact` geen toets op de lokale naam — het resultaat is
 * een sleutel, geen Turtle (`ts:betrokkene.naam.achternaam` mag).
 * @param {Record<string, string>} prefixen
 */
export function maakCompact(prefixen) {
  const tabel = Object.entries(prefixen)
    .filter(([, ns]) => ns)
    .sort((a, b) => b[1].length - a[1].length);
  return (iri) => {
    for (const [p, ns] of tabel) if (iri.startsWith(ns)) return `${p}:${iri.slice(ns.length)}`;
    return `<${iri}>`;
  };
}

/**
 * @param {import("./turtleLezer.js").Triple[]} triples
 * @param {{prefixen?: Record<string, string>}} [opties] - de prefixen waarin de regelset denkt
 *        (niet die van het bestand: een ander bestand mag `o:` schrijven voor odrl)
 * @returns {{knopen: any[], groepen: any[], verbindingen: any[], waarschuwingen: any[]}}
 */
export function rdfNaarBrongraaf(triples, opties = {}) {
  const g = new RdfGraaf(triples);
  const compact = maakCompact(opties.prefixen || {});
  const id = (term) => (term.type === "blank" ? term.waarde : compact(term.waarde));

  /** Literal → getypeerde waarde. */
  const getypeerd = (term) => {
    if (term.type !== "literal") return id(term);
    if (GETALLEN.has(term.datatype) && term.waarde.trim() !== "" && Number.isFinite(Number(term.waarde))) return Number(term.waarde);
    if (term.datatype === `${XSD}boolean`) return term.waarde === "true";
    if (term.datatype === `${XSD}date`) return { datum: term.waarde };
    return term.waarde;
  };
  const alsTekst = (term) => (term.type === "literal" ? term.waarde : id(term));

  // Subjecten in bestandsvolgorde; lijstknopen (rdf:first/rdf:rest) zijn geen knoop.
  const subjecten = [];
  const gezien = new Set();
  for (const t of triples) {
    const k = termSleutel(t.s);
    if (gezien.has(k)) continue;
    gezien.add(k);
    if (t.s.type === "blank" && g.isLijst(t.s)) continue;
    subjecten.push(t.s);
  }
  const isKnoop = new Set(subjecten.map(id));

  const knopen = [];
  const verbindingen = [];
  for (const s of subjecten) {
    const knoop = { id: id(s), iri: s.waarde, klassen: [], tekst: "" };
    /** @type {Map<string, {plat: string[], getypeerd: any[]}>} */
    const perPredicaat = new Map();
    for (const t of g.van(s)) {
      if (t.p.waarde === RDF_TYPE) {
        knoop.klassen.push(id(t.o));
        continue;
      }
      const p = compact(t.p.waarde);
      // Een RDF-lijst als object: de leden, in volgorde.
      const leden = t.o.type === "blank" ? g.lijst(t.o) : null;
      const objecten = leden || [t.o];
      if (!perPredicaat.has(p)) perPredicaat.set(p, { plat: [], getypeerd: [] });
      const waarden = perPredicaat.get(p);
      objecten.forEach((o, positie) => {
        waarden.plat.push(alsTekst(o));
        waarden.getypeerd.push(getypeerd(o));
        if (o.type !== "literal" && isKnoop.has(id(o))) {
          verbindingen.push({ id: `${p}:${knoop.id}>${id(o)}`, aard: p, bron: knoop.id, doel: id(o), label: p, positie });
        }
      });
    }
    for (const naam of NAAM_PREDICATEN) {
      const o = g.object(s, naam);
      if (o?.type === "literal") {
        knoop.tekst = o.waarde;
        break;
      }
    }
    for (const [p, waarden] of perPredicaat) {
      knoop[p] = waarden.plat.length === 1 ? waarden.plat[0] : waarden.plat;
      const i = p.indexOf(":");
      if (i <= 0 || p.startsWith("<")) continue;
      const [prefix, lokaal] = [p.slice(0, i), p.slice(i + 1)];
      // Een prefix die een eigen veld van de knoop zou overschrijven (id, tekst, klassen) blijft plat.
      if (prefix in knoop && (typeof knoop[prefix] !== "object" || Array.isArray(knoop[prefix]))) continue;
      knoop[prefix] = knoop[prefix] || {};
      knoop[prefix][lokaal] = waarden.getypeerd.length === 1 ? waarden.getypeerd[0] : waarden.getypeerd;
    }
    knopen.push(knoop);
  }
  return { knopen, groepen: [], verbindingen, waarschuwingen: [] };
}
