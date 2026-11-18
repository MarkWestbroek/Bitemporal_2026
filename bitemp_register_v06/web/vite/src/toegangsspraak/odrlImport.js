// @ts-check
/**
 * odrlImport — de import "ODRL (ODRL-AP-NL, Turtle) → Toegangsspraak".
 *
 * De terugweg van `odrlExport.js`, in dezelfde vorm (docs/TRANSFORMATIES.md §3):
 *
 *   Turtle ──lezer──▶ triples ──graaflaag──▶ brongraaf ──regelset──▶ plan ──bouwer──▶ beleid (AST)
 *            turtleLezer.js    rdfBrongraaf.js          odrlNaarToegangs-     odrlNaarBeleid.js
 *                                                        spraakRegels.js
 *                                                        + transformatie/regels.js
 *
 * en daarna `renderBeleid` voor de klare taal.
 *
 * **Twee wegen naar de woorden.** De structuur van de ODRL zegt wát het beleid
 * regelt, maar niet alles over hóe het geschreven was (volgorde van
 * voorwaarden, lidwoorden, `waarvan` bij een begrip). Onze eigen export geeft
 * daarom de klare taal mee (`ts:brontekst`). De import gebruikt die tekst alleen
 * als ze **aantoonbaar hetzelfde zegt als de ODRL**: hij exporteert de tekst
 * opnieuw en vergelijkt de triples met het bestand. Klopt dat, dan is het
 * resultaat de brontekst (`weg: "brontekst"`) en is de rondreis letterlijk.
 * Klopt het niet — de ODRL is elders bewerkt, of er is geen brontekst — dan
 * bouwt de import het beleid uit de structuur (`weg: "structuur"`).
 *
 * **Verliesrapport.** Twee lagen:
 *   - de trace van de regelset: wat "geen-regel" of "overgeslagen" is, zit niet
 *     in het beleid;
 *   - `verschil`: de triples van het bestand naast die van een nieuwe export
 *     van het resultaat. `structuur` telt wat het beleid anders regelt of mist,
 *     `woorden` wat alleen anders geschreven is (labels en omschrijvingen).
 *
 * Puur en node-testbaar; geen store, geen React.
 */
import { parseBeleid } from "./parser.js";
import { renderBeleid } from "./renderer.js";
import { toegangsspraakNaarOdrl, odrlContext } from "./odrlExport.js";
import { ODRL_AP_NL_NAAR_TOEGANGSSPRAAK } from "./odrlNaarToegangsspraakRegels.js";
import { planNaarBeleid } from "./odrlNaarBeleid.js";
import { pasRegelsToe } from "../transformatie/regels.js";
import { leesTurtle, RdfGraaf, RDF, TurtleFout, termSleutel } from "../transformatie/turtleLezer.js";
import { rdfNaarBrongraaf } from "../transformatie/rdfBrongraaf.js";

const ODRL = "http://www.w3.org/ns/odrl/2/";
const DCT = "http://purl.org/dc/terms/";
const RDF_TYPE = `${RDF}type`;
const BELEIDSKLASSEN = [`${ODRL}Set`, `${ODRL}Policy`];
const ASSETKLASSEN = [`${ODRL}Asset`, `${ODRL}AssetCollection`];
const VOORWAARDEKLASSEN = [`${ODRL}Constraint`, `${ODRL}LogicalConstraint`];

/** Predicaten die alleen woorden dragen: een verschil daarin verandert het beleid niet. */
const WOORDEN = new Set([
  `${DCT}description`,
  `${DCT}title`,
  "http://www.w3.org/2000/01/rdf-schema#label",
  "http://www.w3.org/2004/02/skos/core#definition",
  "https://omnium.example/toegangsspraak/brontekst",
]);

/**
 * De namespaces van dit beleid (`b:`) en van zijn register (`reg:`), uit het
 * bestand zelf: de IRI van het beleid, en een registerdeel met zijn pad.
 * @param {import("../transformatie/turtleLezer.js").Triple[]} triples
 * @param {Record<string, string>} prefixen
 */
function namespaces(triples, prefixen) {
  const beleid = triples.find((t) => t.p.waarde === RDF_TYPE && t.o.type === "iri" && BELEIDSKLASSEN.includes(t.o.waarde) && t.s.type === "iri");
  const b = beleid ? beleid.s.waarde.replace(/[^/#]*$/, "") : prefixen.b || "";
  // Alleen een asset telt: ook een realisatie (een Rego-module) kan een dct:identifier dragen.
  const assets = new Set(triples.filter((t) => t.p.waarde === RDF_TYPE && t.o.type === "iri" && ASSETKLASSEN.includes(t.o.waarde) && t.s.type === "iri").map((t) => t.s.waarde));
  const deel = triples.find((t) => t.p.waarde === `${DCT}identifier` && t.o.type === "literal" && assets.has(t.s.waarde) && t.s.waarde.endsWith(t.o.waarde));
  const reg = deel ? deel.s.waarde.slice(0, deel.s.waarde.length - deel.o.waarde.length) : prefixen.reg || "";
  return { b, reg };
}

/**
 * Triples in één vergelijkbare vorm: `b:` en `reg:` los van de plek waar het
 * beleid staat, een RDF-lijst als haar leden, en Asset gelijk aan
 * AssetCollection (dat hangt af van of het model erbij was, niet van het beleid).
 * @returns {Map<string, {s: string, p: string, woorden: boolean}>}
 */
function vergelijkbaar(triples, ns) {
  const g = new RdfGraaf(triples);
  const naam = (iri) => (ns.b && iri.startsWith(ns.b) ? `b:${iri.slice(ns.b.length)}` : ns.reg && iri.startsWith(ns.reg) ? `reg:${iri.slice(ns.reg.length)}` : iri === `${ODRL}Asset` ? `${ODRL}AssetCollection` : iri);
  // Een voorwaarde heet in de export naar haar zin (b:vw-…-begint-met-a). Wie de waarde elders
  // wijzigt, houdt die naam; daarom telt hier de inhoud van een voorwaarde, niet haar naam.
  const isVoorwaarde = (t) => g.objecten(t, RDF_TYPE).some((o) => o.type === "iri" && VOORWAARDEKLASSEN.includes(o.waarde));
  const inhoud = new Map();
  const voorwaarde = (t, pad) => {
    const k = termSleutel(t);
    if (inhoud.has(k)) return inhoud.get(k);
    if (pad.has(k)) return k;
    const binnen = new Set(pad).add(k);
    const delen = g
      .van(t)
      .filter((x) => x.p.waarde !== RDF_TYPE && !WOORDEN.has(x.p.waarde))
      .map((x) => `<${x.p.waarde}> ${term(x.o, binnen)}`)
      .sort();
    const uit = `vw{${delen.join(" ; ")}}`;
    inhoud.set(k, uit);
    return uit;
  };
  const term = (t, pad = new Set()) => {
    if (t.type === "literal") return `${JSON.stringify(t.waarde)}@${t.taal || ""}^^${t.datatype}`;
    if (isVoorwaarde(t)) return voorwaarde(t, pad);
    if (t.type === "iri") return `<${naam(t.waarde)}>`;
    const leden = g.lijst(t);
    return leden ? `(${leden.map((lid) => term(lid, pad)).join(" ")})` : t.waarde;
  };
  const uit = new Map();
  for (const t of triples) {
    if (t.s.type === "blank" && g.isLijst(t.s)) continue;
    const s = term(t.s);
    uit.set(`${s} <${t.p.waarde}> ${term(t.o)}`, { s, p: t.p.waarde, woorden: WOORDEN.has(t.p.waarde), sIri: t.s.waarde, oIri: t.o.type === "literal" ? null : t.o.waarde });
  }
  return uit;
}

/**
 * Wat zegt het bestand anders dan een nieuwe export van `beleid`?
 * `ontbreekt`: in de export, niet in het bestand. `extra`: in het bestand over
 * iets dat de export ook kent, maar niet in de export. Wat het bestand zegt
 * over dingen die de export niet kent (een realisatie, velden uit het model)
 * telt niet mee, en ook niet wat wijst naar iets waar de regelset geen regel
 * voor had (`buiten`): dat staat al in de trace.
 */
function vergelijkMetExport(beleid, invoer, opties) {
  const buiten = opties.buiten || new Set();
  const uit = toegangsspraakNaarOdrl(opties.bereidVoor ? opties.bereidVoor(beleid) : beleid, { uitgegeven: opties.uitgegeven, resolveerPad: opties.resolveerPad, kinderenVan: opties.kinderenVan });
  const her = leesTurtle(uit.turtle);
  const context = odrlContext({ beleidSlug: "x" });
  const eigen = vergelijkbaar(her.triples, namespaces(her.triples, { ...context.prefixes, ...her.prefixen }));
  const subjecten = new Set([...eigen.values()].map((t) => t.s));
  const ontbreekt = [...eigen].filter(([k]) => !invoer.has(k)).map(([k, t]) => ({ triple: k, woorden: t.woorden }));
  const extra = [...invoer].filter(([k, t]) => !eigen.has(k) && subjecten.has(t.s) && !buiten.has(t.sIri) && !buiten.has(t.oIri)).map(([k, t]) => ({ triple: k, woorden: t.woorden }));
  const tel = (lijst, woorden) => lijst.filter((x) => x.woorden === woorden).length;
  return { ontbreekt, extra, structuur: tel(ontbreekt, false) + tel(extra, false), woorden: tel(ontbreekt, true) + tel(extra, true) };
}

/**
 * ODRL in Turtle → beleid in Toegangsspraak.
 *
 * @param {string} turtle
 * @param {Object} [opties]
 * @param {(pad: string) => string} [opties.resolveerPad]    zoals bij de export: naïef pad → pad in het model
 * @param {(pad: string) => string[]} [opties.kinderenVan]
 * @param {(beleid: any) => any} [opties.bereidVoor]         het beleid zoals de export het kreeg, bv. met de
 *        paden uit het metamodel erin (`resolveerBeleid`); alleen voor de vergelijking
 * @param {boolean} [opties.negeerBrontekst]                 altijd uit de structuur bouwen
 * @returns {{ok: boolean, tekst: string, beleid: any, weg: "brontekst"|"structuur"|null, graaf: any, plan: any,
 *            trace: any[], verschil: any, diagnostics: any[]}}
 */
export function odrlNaarToegangsspraak(turtle, opties = {}) {
  const leeg = { ok: false, tekst: "", beleid: null, weg: null, graaf: null, plan: null, trace: [], verschil: null };
  let gelezen;
  try {
    gelezen = leesTurtle(turtle);
  } catch (fout) {
    if (!(fout instanceof TurtleFout)) throw fout;
    return { ...leeg, diagnostics: [{ severity: "error", code: "TTL-SYNTAX", message: fout.message, sourceId: null, path: `regel ${fout.regel}, kolom ${fout.kolom}` }] };
  }
  const { graaf, ns } = odrlBrongraaf(gelezen);
  const plan = pasRegelsToe(graaf, ODRL_AP_NL_NAAR_TOEGANGSSPRAAK);
  const gebouwd = planNaarBeleid(plan, { resolveerPad: opties.resolveerPad });
  const diagnostics = [...plan.diagnostics, ...gebouwd.diagnostics];
  if (!gebouwd.beleid) return { ...leeg, graaf, plan, trace: plan.trace, diagnostics };

  const beleidEl = plan.elementen.find((e) => e.type === "beleid");
  const uitgegeven = beleidEl?.data.uitgegeven?.datum || "";
  const invoer = vergelijkbaar(gelezen.triples, ns);
  // Waar de regelset geen regel voor had: dat verlies staat in de trace en telt niet nog eens als verschil.
  const perId = new Map(graaf.knopen.map((k) => [k.id, k.iri]));
  const buiten = new Set(plan.trace.filter((s) => s.soort === "knoop" && s.actie === "geen-regel").map((s) => perId.get(s.bronId)));
  const vergelijk = (beleid) => vergelijkMetExport(beleid, invoer, { ...opties, uitgegeven, buiten });

  // Weg 1: de meegegeven klare taal, als ze hetzelfde zegt als de ODRL.
  let beleid = null;
  let weg = /** @type {"brontekst"|"structuur"} */ ("structuur");
  let verschil = null;
  const brontekst = opties.negeerBrontekst ? "" : String(beleidEl?.data.brontekst || "");
  if (brontekst) {
    const r = parseBeleid(brontekst);
    const v = r.ok ? vergelijk(r.beleid) : null;
    if (v && !v.structuur && !v.woorden) {
      beleid = r.beleid;
      weg = "brontekst";
      verschil = v;
    } else {
      diagnostics.push({
        severity: "info",
        code: "ODRL-BRONTEKST",
        message: r.ok
          ? "De meegegeven klare taal (ts:brontekst) zegt niet hetzelfde als de ODRL; het beleid is uit de structuur opgebouwd."
          : "De meegegeven klare taal (ts:brontekst) is geen geldige Toegangsspraak; het beleid is uit de structuur opgebouwd.",
        sourceId: beleidEl?.sleutel || null,
        path: null,
      });
    }
  }
  // Weg 2: uit de structuur.
  if (!beleid) {
    beleid = gebouwd.beleid;
    verschil = vergelijk(beleid);
    if (verschil.structuur) {
      diagnostics.push({
        severity: "warning",
        code: "ODRL-VERSCHIL",
        message: `Het beleid in klare taal regelt niet precies hetzelfde als de ODRL: ${verschil.structuur} verschil(len) in een nieuwe export. Loop het beleid na.`,
        sourceId: null,
        path: null,
      });
    }
  }
  return { ok: !diagnostics.some((d) => d.severity === "error"), tekst: renderBeleid(beleid), beleid, weg, graaf, plan, trace: plan.trace, verschil, diagnostics };
}

/**
 * Gelezen Turtle → de brongraaf waarop de regelset werkt, in de prefixen van
 * de export (ook als het bestand andere prefixen schrijft). Los beschikbaar
 * voor het proefdraaien van de regelset in de Studio.
 * @param {{triples: import("../transformatie/turtleLezer.js").Triple[], prefixen: Record<string, string>}} gelezen
 */
export function odrlBrongraaf(gelezen) {
  const ns = namespaces(gelezen.triples, gelezen.prefixen);
  const prefixen = { ...odrlContext({ beleidSlug: "x" }).prefixes, b: ns.b, reg: ns.reg };
  return { graaf: rdfNaarBrongraaf(gelezen.triples, { prefixen }), ns };
}

/**
 * Het resultaat van een import in een paar zinnen, voor het scherm: welke weg,
 * wat er niet overkwam (het verliesrapport) en wat de bouwer meldde.
 * @param {ReturnType<typeof odrlNaarToegangsspraak>} r
 * @returns {string[]}
 */
export function importMeldingen(r) {
  const uit = [];
  const fouten = r.diagnostics.filter((d) => d.severity === "error");
  if (fouten.length) return fouten.map((d) => `${d.message}${d.path ? ` (${d.path})` : ""}`);
  if (r.weg === "structuur") {
    const reden = r.diagnostics.find((d) => d.code === "ODRL-BRONTEKST");
    uit.push(reden ? reden.message : "De ODRL draagt geen klare taal (ts:brontekst); het beleid is uit de structuur opgebouwd. Woordkeus en volgorde kunnen afwijken van het origineel.");
  }
  // Een verbinding van of naar iets dat zelf al niet overkwam is geen eigen verlies.
  const alle = r.trace.filter((s) => s.actie === "geen-regel" || s.actie === "overgeslagen");
  const knopen = alle.filter((s) => s.soort !== "verbinding").map((s) => s.bronId);
  const los = alle.filter((s) => s.soort === "verbinding" && !knopen.some((id) => s.bronId.endsWith(`>${id}`) || s.bronId.includes(`:${id}>`))).map((s) => s.bronId);
  const verlies = [...knopen, ...los];
  if (verlies.length) {
    const namen = verlies.slice(0, 5).join(", ");
    uit.push(`${verlies.length === 1 ? "1 onderdeel van de ODRL is" : `${verlies.length} onderdelen van de ODRL zijn`} niet overgenomen: ${namen}${verlies.length > 5 ? ", …" : ""}.`);
  }
  for (const d of r.diagnostics) {
    if (d.severity === "warning" && d.code !== "TRF-GEEN-REGEL" && d.code !== "TRF-UITEINDE") uit.push(d.message);
  }
  return uit;
}
