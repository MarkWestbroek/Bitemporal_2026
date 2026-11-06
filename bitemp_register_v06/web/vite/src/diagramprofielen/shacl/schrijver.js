// @ts-check
/**
 * schrijver — diagramcore-model → Turtle (SHACL), de terugweg van adapter.js (fase 2 van het
 * plan "Linked data als M2" §12).
 *
 * De rondreis is **semantisch**: lezen → schrijven → lezen geeft dezelfde graaf (isomorf), niet
 * dezelfde tekst. Commentaar, volgorde en opmaak van het origineel gaan verloren (plan §3).
 * Wat de import bewaarde komt letterlijk terug: `overig` en `logica` (Turtle), de body van een
 * constraint, `sh:declare`, de losse triples van de shapes graph, taal van teksten, of een naam
 * uit rdfs:label kwam, en het type van een klasse-shape.
 *
 * Elk Turtle-fragment dat de modelleur kan bewerken wordt vooraf gecontroleerd; een fragment
 * dat niet te lezen is wordt overgeslagen met een fout-melding met de plek, zodat de uitvoer
 * altijd geldige Turtle is. Een element zonder IRI krijgt er een uit de namespace van de shapes
 * graph (of `ex:`), op basis van de naam; hernoemen verandert een bestaande IRI niet.
 *
 * Puur, getest in shacl.test.js (ook de rondreis op de ODRL-kern en het collega-bestand).
 */
import { leesTurtle, turtleString, turtleLangeString } from "../../transformatie/turtleLezer.js";
import { EIGENSCHAP_PARAMETERS } from "./index.js";
import { padNaarTurtle } from "./pad.js";
import { splits } from "./afleiding.js";
import { ontInspring } from "./adapter.js";

const STANDAARD_PREFIXEN = {
  sh: "http://www.w3.org/ns/shacl#",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  owl: "http://www.w3.org/2002/07/owl#",
  dct: "http://purl.org/dc/terms/",
};
const VOORBEELD_NS = "https://omnium.example/shapes#";

const isConnector = (el) => Boolean(el?.source && el?.target);
const heeft = (v) => v !== undefined && v !== null && String(v).trim() !== "";

/** Splits op komma's op het hoogste niveau (niet binnen [], (), <> of strings). */
export function splitsBovenaan(tekst) {
  const uit = [];
  let diepte = 0;
  let huidig = "";
  let inString = null;
  const s = String(tekst ?? "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      huidig += c;
      if (c === "\\") huidig += s[++i] ?? "";
      else if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'") inString = c;
    else if ("[(<".includes(c)) diepte++;
    else if ("])>".includes(c)) diepte--;
    if (c === "," && diepte === 0) {
      if (huidig.trim()) uit.push(huidig.trim());
      huidig = "";
      continue;
    }
    huidig += c;
  }
  if (huidig.trim()) uit.push(huidig.trim());
  return uit;
}

/** Prefixen uit de tekst van de shapes graph: `pfx: <iri>` per regel. */
export function leesPrefixen(tekst) {
  /** @type {Record<string, string>} */
  const uit = {};
  for (const regel of String(tekst ?? "").split(/\r?\n/)) {
    const m = /^\s*(?:@?prefix\s+)?([A-Za-z_][\w.-]*)?:\s*<([^>]*)>\s*\.?\s*$/i.exec(regel);
    if (m) uit[m[1] || ""] = m[2];
  }
  return uit;
}

/**
 * @param {{elements?: Record<string, any>}} state
 * @returns {{tekst: string, meldingen: {niveau: string, elementId?: string, bericht: string}[]}}
 */
export function naarTurtle(state) {
  const elements = state?.elements || {};
  const alle = Object.values(elements);
  /** @type {{niveau: string, elementId?: string, bericht: string}[]} */
  const meldingen = [];
  const graaf = alle.find((el) => el.elementType === "shapesgraaf");
  const gd = graaf?.data || {};

  // ── Prefixen ─────────────────────────────────────────────────────────────
  const prefixen = leesPrefixen(gd.prefixen);
  const bekend = new Set(Object.values(prefixen));
  for (const [p, ns] of Object.entries(STANDAARD_PREFIXEN)) if (!(p in prefixen) && !bekend.has(ns)) prefixen[p] = ns;
  // Namespace voor nieuwe elementen: die van de shapes graph (`ok:`), anders ex:.
  let basis = /^([A-Za-z_][\w.-]*)?:$/.exec(gd.iri || "")?.[1];
  if (basis === undefined || !(basis in prefixen)) {
    basis = Object.entries(prefixen).find(([, ns]) => ns === VOORBEELD_NS)?.[0];
    if (!basis) {
      basis = "ex" in prefixen ? "omnium" : "ex";
      prefixen[basis] = VOORBEELD_NS;
    }
  }
  const kop = Object.entries(prefixen)
    .map(([p, ns]) => `@prefix ${p}: <${ns}> .`)
    .join("\n");

  // ── Controle van fragmenten ─────────────────────────────────────────────
  const leesbaar = (tekst) => {
    try {
      leesTurtle(`${kop}\n${tekst}`);
      return null;
    } catch (e) {
      return e?.message || String(e);
    }
  };
  /** Een object (waarde) als Turtle; null + melding als het niet te lezen is. */
  const object = (tekst, plek, elementId) => {
    const fout = leesbaar(`<urn:s> <urn:p> ${tekst} .`);
    if (!fout) return String(tekst).trim();
    meldingen.push({ niveau: "fout", elementId, bericht: `${plek}: "${tekst}" is geen geldige Turtle-waarde (${fout}); niet geschreven.` });
    return null;
  };
  /** Regels `predicaat object` (gescheiden door ;); null + melding als ze niet te lezen zijn. */
  const regels = (tekst, plek, elementId) => {
    if (!heeft(tekst)) return [];
    const fout = leesbaar(`<urn:s> ${tekst} .`);
    if (!fout) return [String(tekst).trim()];
    meldingen.push({ niveau: "fout", elementId, bericht: `${plek}: niet te lezen als Turtle (${fout}); niet geschreven.` });
    return [];
  };
  const tekst = (waarde, taal) => `${turtleString(waarde)}${taal ? `@${taal}` : ""}`;
  const getal = (waarde) => (/^[+-]?\d+(\.\d+)?$/.test(String(waarde).trim()) ? String(waarde).trim() : null);

  // ── IRI's ────────────────────────────────────────────────────────────────
  const gebruikt = new Set(alle.map((el) => el.data?.iri).filter(Boolean));
  const iris = new Map();
  /** De IRI van een element: de bewaarde, anders een nieuwe uit de naam. */
  const iriVan = (el) => {
    if (el.data?.iri) return el.data.iri;
    if (iris.has(el.id)) return iris.get(el.id);
    const stam = String(el.naam || el.id).replace(/[^A-Za-z0-9_-]+/g, "") || "shape";
    let iri = `${basis}:${/^[0-9-]/.test(stam) ? `_${stam}` : stam}`;
    for (let n = 2; gebruikt.has(iri); n++) iri = `${basis}:${stam}${n}`;
    gebruikt.add(iri);
    iris.set(el.id, iri);
    return iri;
  };
  const lokaleNaam = (iri) => (iri.startsWith("<") ? iri.replace(/^<.*[/#]([^/#>]+)>$/, "$1") : iri.slice(iri.indexOf(":") + 1));

  // ── Verbindingen per element ─────────────────────────────────────────────
  const uitgaand = (id, soort) => alle.filter((c) => isConnector(c) && c.elementType === soort && c.source === id);
  const constraintsVan = (id) =>
    alle.filter((c) => isConnector(c) && c.elementType === "notitielijn" && c.target === id).map((c) => elements[c.source]).filter((el) => el?.elementType === "constraint");
  const geschrevenConstraints = new Set();

  /** @param {string} subject @param {string[]} delen */
  const statement = (subject, delen) => (delen.length ? `${subject}\n    ${delen.join(" ;\n    ")} .` : "");

  // ── Een regel (property shape) → predicaat-objecten ─────────────────────
  const KORTE_OR = { datatype: "datatype", klasse: "class" };
  const IRI_PARAMS = new Set(["node", "equals", "disjoint", "lessThan", "lessThanOrEquals", "group"]);
  const TEKST_PARAMS = new Set(["label", "beschrijving", "message", "pattern", "flags"]);
  const WAARDE_PARAMS = new Set(["hasValue", "minInclusive", "maxInclusive", "minExclusive", "maxExclusive", "standaard", "in", "languageIn"]);

  /** @param {any} veld @param {string} plek @param {string} elementId */
  const regelDelen = (veld, plek, elementId) => {
    const d = veld.data || {};
    const delen = [];
    if (d.getypeerd) delen.push("a sh:PropertyShape");
    try {
      delen.push(`sh:path ${padNaarTurtle(veld.naam)}`);
    } catch (e) {
      meldingen.push({ niveau: "fout", elementId, bericht: `${plek}: ${e.message}; regel niet geschreven.` });
      return null;
    }
    for (const p of EIGENSCHAP_PARAMETERS) {
      if (!p.sh) continue;
      const v = d[p.key];
      if (v === undefined || v === null || v === "") continue;
      const pred = `sh:${p.sh}`;
      if (p.datatype === "boolean") {
        if (typeof v === "boolean") delen.push(`${pred} ${v}`);
        continue;
      }
      if (KORTE_OR[p.key]) {
        const refs = splits(v, /\|/);
        const termen = refs.map((r) => object(r, `${plek} ${pred}`, elementId)).filter(Boolean);
        if (termen.length === 1 && refs.length === 1) delen.push(`${pred} ${termen[0]}`);
        else if (termen.length) delen.push(`sh:or ( ${termen.map((t) => `[ ${pred} ${t} ]`).join(" ")} )`);
        continue;
      }
      if (p.key === "nodeKind" || p.key === "severity") {
        delen.push(`${pred} ${String(v).includes(":") ? v : `sh:${v}`}`);
        continue;
      }
      if (TEKST_PARAMS.has(p.key)) {
        delen.push(`${pred} ${tekst(v, d[`${p.key}Taal`])}`);
        continue;
      }
      if (p.datatype === "integer" || p.key === "order") {
        const n = getal(v);
        if (n !== null) delen.push(`${pred} ${n}`);
        else {
          const t = object(v, `${plek} ${pred}`, elementId);
          if (t) delen.push(`${pred} ${t}`);
        }
        continue;
      }
      if (IRI_PARAMS.has(p.key) || WAARDE_PARAMS.has(p.key)) {
        // Een waarde die geen Turtle is (de modelleur typte "abc") wordt een string.
        const t = WAARDE_PARAMS.has(p.key) && !["in", "languageIn"].includes(p.key) && leesbaar(`<urn:s> <urn:p> ${v} .`) ? turtleString(v) : object(v, `${plek} ${pred}`, elementId);
        if (t) delen.push(`${pred} ${t}`);
        continue;
      }
      const t = object(v, `${plek} ${pred}`, elementId);
      if (t) delen.push(`${pred} ${t}`);
    }
    delen.push(...regels(d.logica, `${plek} (logica)`, elementId));
    delen.push(...regels(d.overig, `${plek} (overig)`, elementId));
    return delen;
  };

  /** Doelen, sh:node, subClassOf, constraints en overig: gedeeld door node- en property-shapes. */
  const elementDelen = (el, plek) => {
    const d = el.data || {};
    const delen = [];
    for (const [key, pred] of [["doelklassen", "targetClass"], ["doelknopen", "targetNode"], ["doelSubjectenVan", "targetSubjectsOf"], ["doelObjectenVan", "targetObjectsOf"]]) {
      const termen = splitsBovenaan(d[key]).map((x) => object(x, `${plek} sh:${pred}`, el.id)).filter(Boolean);
      if (termen.length) delen.push(`sh:${pred} ${termen.join(", ")}`);
    }
    const nodes = uitgaand(el.id, "node").map((c) => elements[c.target]).filter(Boolean).map(iriVan);
    if (nodes.length) delen.push(`sh:node ${nodes.join(", ")}`);
    const supers = uitgaand(el.id, "subklasse").map((c) => elements[c.target]).filter(Boolean).map(iriVan);
    if (supers.length) delen.push(`rdfs:subClassOf ${supers.join(", ")}`);
    for (const c of constraintsVan(el.id)) {
      geschrevenConstraints.add(c.id);
      const cd = c.data || {};
      if (!heeft(cd.specificatie)) continue;
      if (cd.taal === "SHACL") delen.push(...regels(cd.specificatie, `Constraint ${c.naam || c.id} bij ${plek}`, c.id));
      else if (cd.taal === "SPARQL") {
        const vorm = cd.vorm || (/^\s*(PREFIX[^\n]*\n\s*)*ASK\b/i.test(cd.specificatie) ? "ask" : "select");
        const query = heeft(cd.ruw) && ontInspring(cd.ruw) === cd.specificatie ? cd.ruw : `\n${cd.specificatie}\n`;
        const binnen = [`sh:${vorm} ${turtleLangeString(query)}`];
        if (heeft(cd.message)) binnen.unshift(`sh:message ${tekst(cd.message, cd.messageTaal)}`);
        if (heeft(cd.prefixen)) {
          const t = object(cd.prefixen, `Constraint ${c.naam || c.id} sh:prefixes`, c.id);
          if (t) binnen.push(`sh:prefixes ${t}`);
        }
        if (heeft(cd.severity)) binnen.push(`sh:severity ${String(cd.severity).includes(":") ? cd.severity : `sh:${cd.severity}`}`);
        binnen.push(...regels(cd.overig, `Constraint ${c.naam || c.id} (overig)`, c.id));
        delen.push(`sh:sparql [\n        ${binnen.join(" ;\n        ")}\n    ]`);
      } else {
        meldingen.push({ niveau: "waarschuwing", elementId: c.id, bericht: `Constraint ${c.naam || c.id}: in natuurlijke taal; niet als SHACL te schrijven (kies taal SHACL of SPARQL).` });
      }
    }
    return delen;
  };

  // ── Schrijven ────────────────────────────────────────────────────────────
  const blokken = [];
  const benoemdeRegels = new Map();

  if (graaf && (gd.iri || gd.titel || gd.beschrijving || gd.declaraties || gd.overig)) {
    const delen = ["a owl:Ontology"];
    if (heeft(gd.titel)) delen.push(`${gd.titelPredicaat || "dct:title"} ${tekst(gd.titel, gd.titelTaal)}`);
    if (heeft(gd.beschrijving)) delen.push(`${gd.beschrijvingPredicaat || "dct:description"} ${tekst(gd.beschrijving, gd.beschrijvingTaal)}`);
    if (heeft(gd.declaraties)) {
      const t = object(gd.declaraties, "Shapes graph sh:declare", graaf.id);
      if (t) delen.push(`sh:declare ${t}`);
    }
    delen.push(...regels(gd.overig, "Shapes graph (overig)", graaf.id));
    blokken.push(statement(gd.iri || `${basis}:`, delen));
  }

  for (const el of alle) {
    if (isConnector(el) || !["nodeshape", "propertyshape", "klasse"].includes(el.elementType)) continue;
    const d = el.data || {};
    const subject = iriVan(el);
    const plek = `${el.elementType === "nodeshape" ? "Node shape" : el.elementType === "klasse" ? "Klasse" : "Property shape"} ${el.naam || subject}`;
    const delen = [];
    const velden = (el.compartimenten || []).filter((c) => c.compartmentType === "eigenschappen").flatMap((c) => c.velden || []);

    if (el.elementType === "klasse") {
      // Een klasse is alleen een doel; alleen wat de modelleur er zelf aan hangt wordt geschreven.
      if (heeft(d.beschrijving)) delen.push(`rdfs:comment ${tekst(d.beschrijving, d.beschrijvingTaal)}`);
      const supers = uitgaand(el.id, "subklasse").map((c) => elements[c.target]).filter(Boolean).map(iriVan);
      if (supers.length) delen.push(`rdfs:subClassOf ${supers.join(", ")}`);
      if (delen.length) blokken.push(statement(subject, delen));
      continue;
    }

    if (el.elementType === "nodeshape") {
      // `a sh:NodeShape` als het er stond (of het element hier gemaakt is); een shape die alleen
      // door zijn doel een shape is (bv. een sh:SPARQLConstraint met targetClass) blijft zo.
      const typen = [d.getypeerd !== false && (d.getypeerd || !d.iri) ? "sh:NodeShape" : null, d.ookKlasse ? d.klasseType || "rdfs:Class" : null].filter(Boolean);
      if (typen.length) delen.push(`a ${typen.join(", ")}`);
      if (d.naamLabel || (heeft(el.naam) && el.naam !== lokaleNaam(subject))) delen.push(`rdfs:label ${tekst(el.naam, d.naamTaal)}`);
      if (heeft(d.beschrijving)) delen.push(`rdfs:comment ${tekst(d.beschrijving, d.beschrijvingTaal)}`);
    }
    delen.push(...elementDelen(el, plek));
    if (el.elementType === "nodeshape") {
      if (typeof d.gesloten === "boolean") delen.push(`sh:closed ${d.gesloten}`);
      if (heeft(d.genegeerd)) {
        const t = object(d.genegeerd, `${plek} sh:ignoredProperties`, el.id);
        if (t) delen.push(`sh:ignoredProperties ${t}`);
      }
      if (heeft(d.nodeKind)) delen.push(`sh:nodeKind sh:${d.nodeKind}`);
      if (heeft(d.severity)) delen.push(`sh:severity sh:${d.severity}`);
      if (heeft(d.message)) delen.push(`sh:message ${tekst(d.message, d.messageTaal)}`);
      if (typeof d.gedeactiveerd === "boolean") delen.push(`sh:deactivated ${d.gedeactiveerd}`);
      for (const v of velden) {
        const r = regelDelen(v, `${plek} → ${v.naam}`, el.id);
        if (!r) continue;
        if (v.data?.iri) {
          delen.push(`sh:property ${v.data.iri}`);
          if (!benoemdeRegels.has(v.data.iri)) benoemdeRegels.set(v.data.iri, r);
          else if (JSON.stringify(benoemdeRegels.get(v.data.iri)) !== JSON.stringify(r)) {
            meldingen.push({ niveau: "waarschuwing", elementId: el.id, bericht: `${plek}: property shape ${v.data.iri} staat in meer shapes en de kopieën verschillen; de eerste is geschreven.` });
          }
        } else delen.push(`sh:property [\n        ${r.join(" ;\n        ")}\n    ]`);
      }
    } else {
      // Losse property shape: de eerste regel is de shape zelf.
      if (velden.length > 1) meldingen.push({ niveau: "waarschuwing", elementId: el.id, bericht: `${plek}: een losse property shape heeft één regel; de andere zijn niet geschreven.` });
      const r = velden[0] ? regelDelen(velden[0], plek, el.id) : null;
      if (!r) {
        meldingen.push({ niveau: "fout", elementId: el.id, bericht: `${plek}: zonder geldig pad niet geschreven.` });
        continue;
      }
      delen.unshift(...r);
    }
    delen.push(...regels(d.overig, `${plek} (overig)`, el.id));
    blokken.push(statement(subject, delen));
  }

  for (const [iri, r] of benoemdeRegels) blokken.push(statement(iri, r));

  for (const c of alle) {
    if (c.elementType === "constraint" && !geschrevenConstraints.has(c.id) && heeft(c.data?.specificatie)) {
      meldingen.push({ niveau: "waarschuwing", elementId: c.id, bericht: `Constraint ${c.naam || c.id} hangt aan geen shape (annotatie-lijn); niet geschreven.` });
    }
  }

  if (heeft(gd.losseTriples)) {
    const fout = leesbaar(gd.losseTriples);
    if (fout) meldingen.push({ niveau: "fout", elementId: graaf?.id, bericht: `Shapes graph (losse triples): niet te lezen als Turtle (${fout}); niet geschreven.` });
    else blokken.push(String(gd.losseTriples).trim());
  }

  const uit = `${kop}\n\n${blokken.filter(Boolean).join("\n\n")}\n`;
  // Vangnet: de uitvoer moet zelf te lezen zijn (elk fragment is al gecontroleerd).
  leesTurtle(uit);
  return { tekst: uit, meldingen };
}
