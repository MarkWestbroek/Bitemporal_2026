// @ts-check
/**
 * adapter — Turtle (SHACL) → diagramcore-model voor het shacl-profiel.
 *
 * De vorm van een import (docs/TRANSFORMATIES.md): lezer (turtleLezer.js,
 * alleen syntaxis) → deze afbeelding → het model. Wat niet in een box of regel
 * past, gaat **niet stil verloren**:
 *
 *   - onbekende predicaten van een shape of regel → `data.overig` (Turtle);
 *   - sh:or/xone/and/not en sh:sparql op node-niveau → een constraint-element
 *     met het fragment als body (taal SHACL of SPARQL), verbonden met een
 *     annotatie-lijn;
 *   - triples die bij geen shape horen → `overig` van de shapes graph;
 *   - en de lint (lint.js) meldt de valkuilen van plan §11.
 *
 * IRI's worden compact bewaard (`odrl:Party`), met de prefixen op de shapes
 * graph; de IRI van een shape is een eigen veld, los van de naam (plan §3).
 *
 * Puur (geen React, geen fetch), getest in shacl.test.js.
 */
import { leesTurtle, RdfGraaf, termSleutel, RDF } from "../../transformatie/turtleLezer.js";
import { EIGENSCHAP_PARAMETERS, shaclRijenPosities } from "./index.js";
import { leidAf } from "./afleiding.js";
import { padNaarTekst, SH } from "./pad.js";
import { lintShacl } from "./lint.js";

const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const OWL = "http://www.w3.org/2002/07/owl#";
const DCT = "http://purl.org/dc/terms/";
const TYPE = `${RDF}type`;

const DOEL_PREDICATEN = { targetClass: "doelklassen", targetNode: "doelknopen", targetSubjectsOf: "doelSubjectenVan", targetObjectsOf: "doelObjectenVan" };
const LOGISCH = ["or", "xone", "and", "not"];
const KLASSE_TYPEN = [`${RDFS}Class`, `${OWL}Class`];

/** Lokale naam van een SHACL-predicaat, of null. */
const shLokaal = (iri) => (iri.startsWith(SH) ? iri.slice(SH.length) : null);

/** Een query uit een """…"""-string: lege randregels weg en de gemeenschappelijke inspringing eraf. */
export function ontInspring(tekst) {
  const regels = String(tekst).replace(/^\s*\n/, "").replace(/\s+$/, "").split("\n");
  const inspring = Math.min(...regels.filter((r) => r.trim()).map((r) => (r.match(/^[ \t]*/) || [""])[0].length));
  return regels.map((r) => r.slice(Number.isFinite(inspring) ? inspring : 0)).join("\n");
}

/** Stabiel element-id uit een term. */
function idVan(g, t, voorvoegsel = "ns") {
  const basis = t.type === "blank" ? t.waarde.slice(2) : g.compact(t.waarde).replace(/^<|>$/g, "");
  return `${voorvoegsel}_${basis.replace(/[^A-Za-z0-9_-]+/g, "_")}`;
}

/** Leesbare naam: rdfs:label, sh:name, anders de lokale naam van de IRI. */
function naamVan(g, t) {
  for (const p of [`${RDFS}label`, `${SH}name`]) {
    const o = g.object(t, p);
    if (o?.type === "literal") return o.waarde;
  }
  if (t.type === "iri") {
    const c = g.compact(t.waarde);
    const i = c.indexOf(":");
    return c.startsWith("<") ? c.replace(/^<.*[/#]([^/#>]+)>$/, "$1") : c.slice(i + 1) || c;
  }
  return t.waarde;
}

/**
 * Turtle-tekst → diagramcore-model, met meldingen.
 *
 * @param {string} tekst
 * @param {{bestandsnaam?: string}} [opties]
 * @returns {{elements: Record<string, any>, diagrams: Record<string, any>, meta: Record<string, any>, meldingen: {niveau: string, elementId?: string, bericht: string}[]}}
 */
export function vanTurtle(tekst, opties = {}) {
  const { triples, prefixen } = leesTurtle(tekst);
  const g = new RdfGraaf(triples, prefixen);
  /** @type {{niveau: string, elementId?: string, bericht: string}[]} */
  const meldingen = [];
  /**
   * Gelezen subjecten; de rest komt in de losse triples van de shapes graph. Een IRI telt
   * alleen als gelezen wanneer zijn eigen triples gelezen zijn (`alsSubject`); als waarde
   * (odrl:Party in sh:class) niet, anders vallen zijn triples weg. Lege knopen diep.
   */
  const gelezen = new Set();
  const verbruik = (t, alsSubject = false) => {
    if (!t || t.type === "literal" || (t.type === "iri" && !alsSubject)) return;
    const k = termSleutel(t);
    if (gelezen.has(k)) return;
    gelezen.add(k);
    if (t.type === "blank") for (const tr of g.van(t)) verbruik(tr.o);
  };
  const tekstVan = (t) => (t.type === "literal" ? t.waarde : g.fragment(t));
  /** `predicaat object`; met `binnen` als het subject een lege knoop is (kring terug naar hem). */
  const overigRegel = (tr, binnen = undefined) => `${g.predicaat(tr.p.waarde)} ${g.fragment(tr.o, "", binnen)}`;

  // ── Welke knopen worden een box? ─────────────────────────────────────────
  const typen = (t) => g.objecten(t, TYPE).filter((o) => o.type === "iri").map((o) => o.waarde);
  const subjecten = new Map();
  for (const tr of triples) subjecten.set(termSleutel(tr.s), tr.s);
  const heeftDoel = (t) => Object.keys(DOEL_PREDICATEN).some((p) => g.objecten(t, `${SH}${p}`).length > 0);
  const isKlasse = (t) => typen(t).some((x) => KLASSE_TYPEN.includes(x));
  const heeftPad = (t) => g.objecten(t, `${SH}path`).length > 0;
  const viaProperty = new Set(triples.filter((t) => t.p.waarde === `${SH}property`).map((t) => termSleutel(t.o)));
  const viaNode = new Set(triples.filter((t) => t.p.waarde === `${SH}node`).map((t) => termSleutel(t.o)));

  /** @type {{t: any, soort: "nodeshape"|"propertyshape"}[]} */
  const boxen = [];
  for (const t of subjecten.values()) {
    const ty = typen(t);
    const pad = heeftPad(t);
    const node = ty.includes(`${SH}NodeShape`) || (!pad && (heeftDoel(t) || (t.type === "iri" && viaNode.has(termSleutel(t)))));
    const losProp = pad && heeftDoel(t) && !viaProperty.has(termSleutel(t));
    if (node && !pad) boxen.push({ t, soort: "nodeshape" });
    else if (losProp || (ty.includes(`${SH}PropertyShape`) && !viaProperty.has(termSleutel(t)))) boxen.push({ t, soort: "propertyshape" });
  }
  const boxId = new Map(boxen.map((b) => [termSleutel(b.t), idVan(g, b.t)]));

  /** @type {Record<string, any>} */
  const elements = {};
  const klasseRefs = new Set();

  // ── Een property shape → regel ───────────────────────────────────────────
  const BEKEND = new Map(EIGENSCHAP_PARAMETERS.filter((p) => p.sh).map((p) => [p.sh, p]));
  const LIJST_PARAMS = new Set(["in", "languageIn"]);
  const WAARDE_PARAMS = new Set(["hasValue", "minInclusive", "maxInclusive", "minExclusive", "maxExclusive", "defaultValue"]);

  /** @param {any} ps @param {string} plek */
  const regelVan = (ps, plek) => {
    verbruik(ps, true);
    const data = {};
    const overig = [];
    let naam = "";
    const per = new Map();
    for (const tr of g.van(ps)) {
      const p = tr.p.waarde;
      if (!per.has(p)) per.set(p, []);
      per.get(p).push(tr);
    }
    for (const [p, trs] of per) {
      const lokaal = shLokaal(p);
      if (p === TYPE && trs.every((tr) => tr.o.type === "iri" && tr.o.waarde === `${SH}PropertyShape`)) {
        data.getypeerd = true; // `a sh:PropertyShape` stond er; de schrijver zet het terug
        continue;
      }
      if (lokaal === "path") {
        const pad = padNaarTekst(g, trs[0].o, verbruik);
        if (pad) naam = pad.tekst;
        else {
          naam = g.fragment(trs[0].o);
          meldingen.push({ niveau: "fout", bericht: `${plek}: sh:path ${naam} is geen geldig SHACL-pad.` });
        }
        trs.slice(1).forEach((tr) => overig.push(overigRegel(tr)));
        continue;
      }
      if (lokaal && LOGISCH.includes(lokaal) && trs.length === 1) {
        // sh:or van alleen sh:class (of alleen sh:datatype): de korte vorm a | b.
        const leden = lokaal === "or" ? g.lijst(trs[0].o) : null;
        const enkel = (veld) =>
          leden &&
          leden.length > 1 &&
          leden.every((l) => l.type === "blank" && g.van(l).length === 1 && g.van(l)[0].p.waarde === `${SH}${veld}` && g.van(l)[0].o.type === "iri");
        const korteVorm = ["class", "datatype"].find((veld) => enkel(veld) && !per.has(`${SH}${veld}`));
        if (korteVorm) {
          verbruik(trs[0].o);
          data[korteVorm === "class" ? "klasse" : "datatype"] = /** @type {any[]} */ (leden).map((l) => g.compact(g.van(l)[0].o.waarde)).join(" | ");
          continue;
        }
      }
      if (lokaal && LOGISCH.includes(lokaal)) {
        trs.forEach((tr) => verbruik(tr.o));
        data.logica = [data.logica, ...trs.map((tr) => overigRegel(tr))].filter(Boolean).join(" ;\n");
        continue;
      }
      const param = lokaal ? BEKEND.get(lokaal) : null;
      if (param && trs.length === 1) {
        const o = trs[0].o;
        verbruik(o);
        if (LIJST_PARAMS.has(lokaal)) data[param.key] = g.fragment(o);
        else if (param.datatype === "boolean") data[param.key] = o.type === "literal" && o.waarde === "true";
        else if (param.datatype === "integer") data[param.key] = o.type === "literal" ? Number(o.waarde) : g.fragment(o);
        else if (lokaal === "nodeKind" || lokaal === "severity") data[param.key] = o.type === "iri" ? g.compact(o.waarde).replace(/^sh:/, "") : tekstVan(o);
        // Waarden (hasValue, grenzen, defaultValue) houden hun Turtle-vorm, met datatype;
        // teksten (name, message, pattern, …) worden kale tekst.
        else data[param.key] = o.type === "iri" ? g.compact(o.waarde) : o.type === "literal" && !WAARDE_PARAMS.has(lokaal) ? o.waarde : g.fragment(o);
        if (o.type === "literal" && o.taal && !WAARDE_PARAMS.has(lokaal)) data[`${param.key}Taal`] = o.taal;
        if (lokaal === "class") klasseRefs.add(data[param.key]);
        continue;
      }
      // Meer waarden (sh:message in twee talen, twee keer sh:class) of onbekend: bewaren.
      if (param && trs.length > 1) {
        meldingen.push({ niveau: "info", bericht: `${plek} (${naam || "?"}): ${trs.length}× sh:${lokaal}; bewaard in "overig".` });
      }
      trs.forEach((tr) => {
        verbruik(tr.o);
        overig.push(overigRegel(tr));
      });
    }
    if (data.klasse) splitsKlassen(data.klasse).forEach((k) => klasseRefs.add(k));
    if (overig.length) data.overig = overig.join(" ;\n");
    if (ps.type === "iri") data.iri = g.compact(ps.waarde);
    if (!naam) meldingen.push({ niveau: "fout", bericht: `${plek}: een property shape zonder sh:path.` });
    return { naam: naam || "(geen pad)", fieldType: "eigenschap", data, volgorde: Number(data.order ?? Infinity) };
  };
  const splitsKlassen = (k) => String(k).split("|").map((x) => x.trim()).filter(Boolean);

  // ── Boxen vullen ─────────────────────────────────────────────────────────
  const gedeeld = new Map();
  for (const tr of triples) if (tr.p.waarde === `${SH}property`) gedeeld.set(termSleutel(tr.o), (gedeeld.get(termSleutel(tr.o)) || 0) + 1);

  let constraintTeller = 0;
  const losseConnectoren = [];

  for (const { t, soort } of boxen) {
    const id = boxId.get(termSleutel(t));
    verbruik(t, true);
    const naam = naamVan(g, t);
    const data = {};
    if (t.type === "iri") data.iri = g.compact(t.waarde);
    const overig = [];
    const regels = [];
    const plek = `${soort === "nodeshape" ? "Node shape" : "Property shape"} ${naam}`;

    if (soort === "propertyshape") {
      // Eén regel met de pad-parameters; de doelen op het element zelf.
      const regel = regelVan(t, plek);
      for (const [p, key] of Object.entries(DOEL_PREDICATEN)) {
        const os = g.objecten(t, `${SH}${p}`);
        if (os.length) data[key] = os.map((o) => g.fragment(o)).join(", ");
      }
      if (regel.data.overig) {
        // De doelen staan al op het element; haal ze uit de regel.
        regel.data.overig = regel.data.overig.split(" ;\n").filter((r) => !/^sh:target/.test(r)).join(" ;\n") || undefined;
        if (!regel.data.overig) delete regel.data.overig;
      }
      regels.push(regel);
    } else {
      const per = new Map();
      for (const tr of g.van(t)) {
        if (!per.has(tr.p.waarde)) per.set(tr.p.waarde, []);
        per.get(tr.p.waarde).push(tr);
      }
      for (const [p, trs] of per) {
        const lokaal = shLokaal(p);
        if (p === TYPE) {
          if (trs.some((tr) => tr.o.type === "iri" && tr.o.waarde === `${SH}NodeShape`)) data.getypeerd = true;
          const rest = trs.filter((tr) => !(tr.o.type === "iri" && tr.o.waarde === `${SH}NodeShape`));
          for (const tr of rest) {
            if (tr.o.type === "iri" && KLASSE_TYPEN.includes(tr.o.waarde) && !data.ookKlasse) {
              data.ookKlasse = true;
              data.klasseType = g.compact(tr.o.waarde);
            } else overig.push(overigRegel(tr));
          }
          continue;
        }
        if (p === `${RDFS}label` && trs.length === 1 && trs[0].o.type === "literal") {
          // = de naam; de schrijver zet hem terug als rdfs:label.
          data.naamLabel = true;
          if (trs[0].o.taal) data.naamTaal = trs[0].o.taal;
          continue;
        }
        if (p === `${RDFS}comment` && trs.length === 1) {
          data.beschrijving = tekstVan(trs[0].o);
          if (trs[0].o.type === "literal" && trs[0].o.taal) data.beschrijvingTaal = trs[0].o.taal;
          continue;
        }
        if (lokaal === "property") {
          for (const tr of trs) {
            if (tr.o.type === "literal") {
              overig.push(overigRegel(tr));
              continue;
            }
            if (tr.o.type === "iri" && (gedeeld.get(termSleutel(tr.o)) || 0) > 1) {
              meldingen.push({ niveau: "info", elementId: id, bericht: `${plek}: property shape ${g.compact(tr.o.waarde)} wordt door meer shapes gebruikt; elk krijgt een kopie van de regel.` });
            }
            regels.push(regelVan(tr.o, plek));
          }
          continue;
        }
        if (lokaal && lokaal in DOEL_PREDICATEN) {
          trs.forEach((tr) => verbruik(tr.o));
          data[DOEL_PREDICATEN[lokaal]] = trs.map((tr) => g.fragment(tr.o)).join(", ");
          continue;
        }
        if (lokaal === "closed" && trs.length === 1) {
          data.gesloten = trs[0].o.waarde === "true";
          continue;
        }
        if (lokaal === "deactivated" && trs.length === 1) {
          data.gedeactiveerd = trs[0].o.waarde === "true";
          continue;
        }
        if (lokaal === "ignoredProperties" && trs.length === 1) {
          verbruik(trs[0].o);
          data.genegeerd = g.fragment(trs[0].o);
          continue;
        }
        if ((lokaal === "nodeKind" || lokaal === "severity") && trs.length === 1 && trs[0].o.type === "iri") {
          data[lokaal] = g.compact(trs[0].o.waarde).replace(/^sh:/, "");
          continue;
        }
        if (lokaal === "message" && trs.length === 1) {
          data.message = tekstVan(trs[0].o);
          if (trs[0].o.type === "literal" && trs[0].o.taal) data.messageTaal = trs[0].o.taal;
          continue;
        }
        if (lokaal && LOGISCH.includes(lokaal)) {
          for (const tr of trs) {
            verbruik(tr.o);
            const cid = `${id}__${lokaal}${constraintTeller++ || ""}`;
            elements[cid] = { id: cid, naam: `sh:${lokaal}`, elementType: "constraint", compartimenten: [], data: { specificatie: overigRegel(tr), taal: "SHACL" } };
            losseConnectoren.push({ soort: "notitielijn", source: cid, target: id });
          }
          continue;
        }
        if (lokaal === "sparql") {
          for (const tr of trs) {
            verbruik(tr.o);
            const cid = `${id}__sparql${constraintTeller++ || ""}`;
            const cdata = { taal: "SPARQL" };
            const rest = [];
            for (const c of g.van(tr.o)) {
              const cl = shLokaal(c.p.waarde);
              if ((cl === "select" || cl === "ask") && c.o.type === "literal" && !cdata.specificatie) {
                cdata.specificatie = ontInspring(c.o.waarde);
                cdata.vorm = cl;
                // De query zoals hij er stond (met inspringing); de schrijver gebruikt hem zolang
                // de specificatie niet bewerkt is, zodat de rondreis dezelfde literal geeft.
                cdata.ruw = c.o.waarde;
              } else if (cl === "message" && !cdata.message) {
                cdata.message = tekstVan(c.o);
                if (c.o.type === "literal" && c.o.taal) cdata.messageTaal = c.o.taal;
              }
              else if (cl === "prefixes") cdata.prefixen = g.fragment(c.o);
              else if (cl === "severity" && c.o.type === "iri") cdata.severity = g.compact(c.o.waarde).replace(/^sh:/, "");
              else if (c.p.waarde === TYPE && c.o.type === "iri" && c.o.waarde === `${SH}SPARQLConstraint`) continue;
              else rest.push(overigRegel(c));
            }
            if (rest.length) cdata.overig = rest.join(" ;\n");
            elements[cid] = { id: cid, naam: "sh:sparql", elementType: "constraint", compartimenten: [], data: cdata };
            losseConnectoren.push({ soort: "notitielijn", source: cid, target: id });
          }
          continue;
        }
        if (lokaal === "node") {
          for (const tr of trs) {
            const doel = boxId.get(termSleutel(tr.o));
            if (doel) losseConnectoren.push({ soort: "node", source: id, target: doel });
            else {
              verbruik(tr.o);
              overig.push(overigRegel(tr));
            }
          }
          continue;
        }
        if (p === `${RDFS}subClassOf`) {
          for (const tr of trs) {
            if (tr.o.type === "iri") losseConnectoren.push({ soort: "subklasse", source: id, doelIri: tr.o });
            else overig.push(overigRegel(tr));
          }
          continue;
        }
        trs.forEach((tr) => {
          verbruik(tr.o);
          overig.push(overigRegel(tr));
        });
      }
    }
    if (overig.length) data.overig = overig.join(" ;\n");
    regels.sort((a, b) => a.volgorde - b.volgorde);
    elements[id] = {
      id,
      naam,
      elementType: soort,
      compartimenten: regels.length ? [{ compartmentType: "eigenschappen", velden: regels.map(({ volgorde, ...r }) => r) }] : [],
      data,
    };
  }

  // ── Klassen zonder shape ─────────────────────────────────────────────────
  const gericht = new Set();
  for (const el of Object.values(elements)) {
    for (const k of String(el.data?.doelklassen || "").split(",").map((x) => x.trim()).filter(Boolean)) gericht.add(k);
    if (el.data?.ookKlasse && el.data?.iri) gericht.add(el.data.iri);
  }
  const klasseElement = (ref) => {
    const kid = `kl_${ref.replace(/^<|>$/g, "").replace(/[^A-Za-z0-9_-]+/g, "_")}`;
    if (!elements[kid]) elements[kid] = { id: kid, naam: ref, elementType: "klasse", compartimenten: [], data: { iri: ref } };
    return kid;
  };
  for (const ref of [...klasseRefs].sort()) if (!gericht.has(ref)) klasseElement(ref);

  // ── Klassehiërarchie buiten de shapes: `C rdfs:subClassOf D` (RDFS, zoals in een vocabulaire) ──
  // SHACL volgt subClassOf alleen in de data; in de shapes graph is het documentatie, maar wel
  // de overerving die je in het diagram wilt zien (Mark 07-11: Policy ▷ Set, Rule ▷ Permission).
  // Alleen subjecten met uitsluitend subClassOf-triples naar IRI's (de rest blijft losse triple).
  // De pijl loopt tussen de boxen die de klassen tonen; de klasse-IRI's staan op de connector
  // (van/naar), zodat de schrijver precies dezelfde triple terugzet.
  const lijstVan = (x) => String(x || "").split(",").map((s) => s.trim()).filter(Boolean);
  const lokaleStam = (x) => String(x || "").replace(/>$/, "").replace(/^.*[:#/]/, "").replace(/Shape$/, "");
  const eindpuntVoor = (ref) => {
    const shapes = Object.values(elements).filter((el) => el.elementType === "nodeshape" && (lijstVan(el.data?.doelklassen).includes(ref) || (el.data?.ookKlasse && el.data?.iri === ref)));
    const aantal = (s) => new Set([...lijstVan(s.data?.doelklassen), ...(s.data?.ookKlasse ? [s.data.iri] : [])]).size;
    // Eerst de shape die alleen deze klasse richt; dan een shape met dezelfde naam (PolicyShape ↔
    // odrl:Policy); anders de klasse zelf als box (odrl:Set, dat alleen via PolicyShape geraakt wordt).
    const eigen = shapes.find((s) => aantal(s) === 1) || shapes.find((s) => lokaleStam(s.naam) === lokaleStam(ref) || lokaleStam(s.data?.iri) === lokaleStam(ref));
    return eigen?.id || klasseElement(ref);
  };
  for (const t of subjecten.values()) {
    if (t.type !== "iri" || gelezen.has(termSleutel(t)) || boxId.has(termSleutel(t))) continue;
    const trs = g.van(t);
    if (!trs.length || !trs.every((tr) => tr.p.waarde === `${RDFS}subClassOf` && tr.o.type === "iri")) continue;
    verbruik(t, true);
    const van = g.compact(t.waarde);
    for (const tr of trs) {
      const naar = g.compact(tr.o.waarde);
      losseConnectoren.push({ soort: "subklasse", source: eindpuntVoor(van), target: eindpuntVoor(naar), data: { van, naar } });
    }
  }

  // ── Losse connectoren (sh:node, subClassOf, annotatie-lijnen) ────────────
  let n = 0;
  for (const c of losseConnectoren) {
    let target = c.target;
    if (c.doelIri) {
      const ref = g.compact(c.doelIri.waarde);
      target = boxId.get(termSleutel(c.doelIri)) || Object.values(elements).find((el) => el.data?.iri === ref && el.elementType !== "constraint")?.id || klasseElement(ref);
    }
    const cid = `${c.soort}__${c.source}__${n++}`;
    elements[cid] = { id: cid, naam: "", elementType: c.soort, source: c.source, target, compartimenten: [], data: { ...(c.data || {}) } };
  }

  // ── De shapes graph: document, prefixen, declaraties, de rest ───────────
  const ontologie = [...subjecten.values()].find((t) => typen(t).includes(`${OWL}Ontology`));
  /** @type {Record<string, any>} */
  const graaf = { iri: undefined, titel: undefined, beschrijving: undefined, declaraties: undefined, overig: undefined };
  const graafOverig = [];
  let graafNaam = (opties.bestandsnaam || "Shapes").replace(/\.(ttl|turtle|shacl|txt)$/i, "").replace(/\.shacl$/i, "");
  if (ontologie) {
    verbruik(ontologie, true);
    graaf.iri = ontologie.type === "iri" ? g.compact(ontologie.waarde) : undefined;
    const decl = [];
    for (const tr of g.van(ontologie)) {
      const p = tr.p.waarde;
      if (p === TYPE && tr.o.type === "iri" && tr.o.waarde === `${OWL}Ontology`) continue;
      // Titel en beschrijving onthouden predicaat en taal, zodat de schrijver ze zo terugzet.
      if ((p === `${DCT}title` || p === `${RDFS}label`) && tr.o.type === "literal" && !graaf.titel) {
        graaf.titel = tr.o.waarde;
        graaf.titelPredicaat = g.compact(p);
        graaf.titelTaal = tr.o.taal;
      } else if ((p === `${DCT}description` || p === `${RDFS}comment`) && tr.o.type === "literal" && !graaf.beschrijving) {
        graaf.beschrijving = tr.o.waarde;
        graaf.beschrijvingPredicaat = g.compact(p);
        graaf.beschrijvingTaal = tr.o.taal;
      }
      else if (p === `${SH}declare`) {
        verbruik(tr.o);
        decl.push(g.fragment(tr.o));
      } else {
        verbruik(tr.o);
        graafOverig.push(overigRegel(tr));
      }
    }
    if (decl.length) graaf.declaraties = decl.join(",\n");
    if (graaf.titel) graafNaam = graaf.titel;
  }
  // Lijstknopen van gelezen lijsten zijn gelezen; wat overblijft hoort bij niets.
  // Eerst de wortels (IRI's en lege knopen waar niets naar wijst), zodat een geneste lege knoop
  // niet los én genest terechtkomt.
  const rest = [...subjecten.values()].filter((t) => !gelezen.has(termSleutel(t)));
  const isGenest = (t) => t.type === "blank" && g.verwijzingen(t) > 0;
  const losse = [];
  for (const t of [...rest.filter((t) => !isGenest(t)), ...rest.filter(isGenest)]) {
    if (gelezen.has(termSleutel(t))) continue;
    verbruik(t, true);
    for (const tr of g.van(t)) verbruik(tr.o); // ook de lijsten en lege knopen onder een IRI
    losse.push(
      t.type === "blank" && !isGenest(t) && !g.isLijst(t)
        ? `${g.fragment(t)} .`
        : `${g.alsTekst(t)} ${g.van(t).map((tr) => overigRegel(tr, t.type === "blank" ? new Set([t.waarde]) : undefined)).join(" ;\n  ")} .`
    );
  }
  if (!boxen.length) {
    meldingen.push({
      niveau: "waarschuwing",
      bericht: "Geen enkele shape gevonden (sh:NodeShape, sh:targetClass, …). Is dit een OWL- of SKOS-bestand? Die profielen komen later; alles is bewaard in de shapes graph.",
    });
  }
  if (rest.length) {
    meldingen.push({
      niveau: "info",
      bericht: `${rest.length} subject(en) horen bij geen shape (${rest.slice(0, 3).map((t) => g.alsTekst(t)).join(", ")}${rest.length > 3 ? ", …" : ""}); bewaard in "losse triples" van de shapes graph.`,
    });
  }
  if (graafOverig.length) graaf.overig = graafOverig.join(" ;\n");
  if (losse.length) graaf.losseTriples = losse.join("\n");
  const GRAAF_ID = "shapesgraaf";
  elements[GRAAF_ID] = {
    id: GRAAF_ID,
    naam: graafNaam,
    elementType: "shapesgraaf",
    compartimenten: [],
    data: Object.fromEntries(
      Object.entries({ ...graaf, prefixen: Object.entries(prefixen).map(([p, ns]) => `${p}: <${ns}>`).join("\n") }).filter(([, v]) => v !== undefined && v !== "")
    ),
  };

  // ── Afleiden, lint, plaatsen ─────────────────────────────────────────────
  const afgeleid = leidAf(elements) || elements;
  const subjectNaarId = new Map(boxen.map((b) => [termSleutel(b.t), boxId.get(termSleutel(b.t))]));
  meldingen.push(...lintShacl(g, { subjectNaarId }));
  for (const m of meldingen) if (m.elementId && !afgeleid[m.elementId]) delete m.elementId;

  const isConnector = (el) => Boolean(el.source && el.target);
  const knopen = Object.values(afgeleid).filter((el) => !isConnector(el));
  const edges = Object.values(afgeleid)
    .filter(isConnector)
    .map((el) => (el.elementType === "notitielijn" ? { source: el.target, target: el.source } : { source: el.source, target: el.target }));
  const posities = shaclRijenPosities({ ids: knopen.map((el) => el.id), elements: afgeleid, edges });
  return {
    elements: afgeleid,
    diagrams: {
      shapes: {
        id: "shapes",
        naam: graafNaam,
        nodes: knopen.map((el) => ({ elementId: el.id, position: posities[el.id] })),
        edges: [],
      },
    },
    meta: {},
    meldingen,
  };
}

/** De lint (plan §11) op Turtle-tekst, zonder model; bv. op de uitvoer van de schrijver. */
export function lintTurtle(tekst) {
  const { triples, prefixen } = leesTurtle(tekst);
  return lintShacl(new RdfGraaf(triples, prefixen));
}

/** Meldingen als leesbare tekst (één per regel), voor de importdialoog. */
export function meldingenAlsTekst(meldingen) {
  const teken = { fout: "✖", waarschuwing: "⚠", info: "ℹ" };
  const orde = { fout: 0, waarschuwing: 1, info: 2 };
  return [...meldingen]
    .sort((a, b) => (orde[a.niveau] ?? 3) - (orde[b.niveau] ?? 3))
    .map((m) => `${teken[m.niveau] || "•"} ${m.bericht}`)
    .join("\n");
}
