// @ts-check
/**
 * lint — de valkuilen bij SHACL die geen Turtle-parser, tekendienst of
 * meta-SHACL-controle meldt (plan "Linked data als M2" §11). Draait bij de
 * import op de triples, zodat ook wat niet getekend wordt een melding krijgt.
 *
 *   reekspad              sh:path ( a b c ) is een reeks a/b/c, geen "a of b of c"
 *   lid-zonder-voorwaarde een lid van sh:or/xone/and met alleen een pad: altijd waar
 *   sparql-geen-shape     a sh:SPARQLConstraint met een doel: draait niet
 *   sparql-syntax         haakjes/accolades/strings in een sh:select of sh:ask kloppen niet
 *   sparql-prefix         de query gebruikt een prefix die niet gedeclareerd is
 *   sparql-zonder-this    een sh:select zonder $this
 *   in-op-type            sh:in op rdf:type: alles wat níet in de lijst staat faalt
 *   targetnode            sh:targetNode controleert alleen die ene knoop
 *   onbekend-predicaat    een sh:-predicaat dat SHACL niet kent (tikfout?)
 *   onbekend-type         een sh:-klasse die SHACL niet kent
 *   shape-zonder-doel     een node shape zonder doel waar niets naar verwijst
 *   geen-pad              een property shape zonder sh:path
 *
 * Puur, getest in shacl.test.js.
 */
import { RDF, termSleutel } from "../../transformatie/turtleLezer.js";
import { SH } from "./pad.js";

const TYPE = `${RDF}type`;

/** De SHACL-woordenschat (core, SPARQL, advanced features), zonder prefix. */
const PREDICATEN = new Set(
  (
    "targetClass targetNode targetObjectsOf targetSubjectsOf target property path inversePath alternativePath " +
    "zeroOrMorePath oneOrMorePath zeroOrOnePath class datatype nodeKind minCount maxCount minExclusive " +
    "minInclusive maxExclusive maxInclusive minLength maxLength pattern flags languageIn uniqueLang equals " +
    "disjoint lessThan lessThanOrEquals not and or xone node qualifiedValueShape qualifiedMinCount " +
    "qualifiedMaxCount qualifiedValueShapesDisjoint closed ignoredProperties hasValue in name description " +
    "order group defaultValue severity message deactivated sparql select ask construct update prefixes " +
    "declare prefix namespace shapesGraph suggestedShapesGraph entailment parameter labelTemplate optional " +
    "validator nodeValidator propertyValidator rule condition subject predicate object filterShape nodes " +
    "intersection union this values expression js jsFunctionName jsLibrary jsLibraryURL conforms result " +
    "focusNode resultPath resultSeverity resultMessage sourceShape sourceConstraint sourceConstraintComponent " +
    "value detail returnType resultAnnotation annotationProperty annotationValue annotationVarName targetType " +
    "shapesGraphWellFormed member"
  ).split(" ")
);
const KLASSEN = new Set(
  (
    "Shape NodeShape PropertyShape SPARQLConstraint SPARQLSelectExecutable SPARQLAskExecutable " +
    "SPARQLConstructExecutable SPARQLUpdateExecutable SPARQLExecutable ConstraintComponent Parameter Parameterizable " +
    "Validator SPARQLSelectValidator SPARQLAskValidator ValidationReport ValidationResult AbstractResult Severity " +
    "Violation Warning Info NodeKind IRI BlankNode Literal BlankNodeOrIRI BlankNodeOrLiteral IRIOrLiteral " +
    "PrefixDeclaration SPARQLTarget SPARQLTargetType Target TargetType Function SPARQLFunction Rule TripleRule " +
    "SPARQLRule PropertyGroup ResultAnnotation JSConstraint JSExecutable JSFunction JSLibrary JSRule JSTarget " +
    "JSTargetType JSValidator SPARQLValuesDeriver"
  ).split(" ")
);
/** Parameters die een lid van sh:or/xone/and echt iets laten eisen (alles behalve pad en uitleg). */
const UITLEG = new Set(["path", "name", "description", "message", "order", "group", "severity", "deactivated"]);

/**
 * Een eenvoudige vormcontrole op SPARQL (geen volledige parser): haakjes en
 * accolades in balans buiten strings en IRI's, een querysoort, en de gebruikte
 * prefixen. Geeft meldingen zonder plek.
 * @param {string} query
 * @param {Set<string>} gedeclareerd - prefixen uit sh:prefixes/sh:declare
 */
export function controleerSparql(query, gedeclareerd) {
  const uit = [];
  const eigen = new Set([...query.matchAll(/PREFIX\s+([A-Za-z][\w.-]*)?:/gi)].map((m) => m[1] || ""));
  // Strings, IRI's en commentaar weg, zodat er geen haakjes of dubbelepunten in meetellen.
  let kaal = "";
  let i = 0;
  let open = null;
  while (i < query.length) {
    const c = query[i];
    if (c === '"' || c === "'") {
      const lang = query.slice(i, i + 3) === c.repeat(3);
      const eind = lang ? c.repeat(3) : c;
      let j = i + eind.length;
      while (j < query.length && query.slice(j, j + eind.length) !== eind) j += query[j] === "\\" ? 2 : 1;
      if (j >= query.length) {
        open = "string";
        break;
      }
      kaal += " ";
      i = j + eind.length;
      continue;
    }
    if (c === "<") {
      const m = /^<[^<>"{}|^`\\\s]*>/.exec(query.slice(i));
      if (m) {
        kaal += " ";
        i += m[0].length;
        continue;
      }
    }
    if (c === "#") {
      while (i < query.length && query[i] !== "\n") i++;
      continue;
    }
    kaal += c;
    i++;
  }
  if (open) uit.push({ code: "sparql-syntax", bericht: "een string in de query sluit niet." });
  if (!/\b(SELECT|ASK|CONSTRUCT|DESCRIBE)\b/i.test(kaal)) uit.push({ code: "sparql-syntax", bericht: "geen SELECT, ASK of CONSTRUCT gevonden." });
  for (const [o, d, naam] of [["{", "}", "accolades"], ["(", ")", "haakjes"]]) {
    let diepte = 0;
    let fout = false;
    for (const c of kaal) {
      if (c === o) diepte++;
      else if (c === d && --diepte < 0) fout = true;
    }
    if (fout || diepte !== 0) uit.push({ code: "sparql-syntax", bericht: `de ${naam} zijn niet in balans.` });
  }
  const gebruikt = new Set();
  for (const m of kaal.matchAll(/(^|[^\w?$:.-])([A-Za-z][\w.-]*)?:(?=[A-Za-z_0-9])/g)) {
    const p = m[2] || "";
    if (/^(PREFIX|BASE)$/i.test(p)) continue;
    gebruikt.add(p);
  }
  for (const p of gebruikt) {
    if (!eigen.has(p) && !gedeclareerd.has(p)) uit.push({ code: "sparql-prefix", bericht: `de prefix "${p}:" is niet gedeclareerd (sh:prefixes / sh:declare of PREFIX in de query).` });
  }
  return uit;
}

/**
 * @param {import("../../transformatie/turtleLezer.js").RdfGraaf} g
 * @param {{subjectNaarId?: Map<string, string>}} [opties]
 * @returns {{niveau: "fout"|"waarschuwing"|"info", code: string, elementId?: string, bericht: string}[]}
 */
export function lintShacl(g, opties = {}) {
  const uit = [];
  const ids = opties.subjectNaarId || new Map();
  const naam = (t) => g.alsTekst(t);
  const sh = (lokaal) => `${SH}${lokaal}`;
  /** De shape (box) waar een knoop bij hoort: zichzelf, of de shape met sh:property naar hem. */
  const eigenaar = (t) => {
    const k = termSleutel(t);
    if (ids.has(k)) return ids.get(k);
    for (const s of g.subjecten(sh("property"), t)) if (ids.has(termSleutel(s))) return ids.get(termSleutel(s));
    return undefined;
  };
  const meld = (niveau, code, t, bericht) => uit.push({ niveau, code, ...(t && eigenaar(t) ? { elementId: eigenaar(t) } : {}), bericht });
  const plekVan = (t) => {
    const e = g.subjecten(sh("property"), t)[0];
    const pad = g.object(t, sh("path"));
    if (t.type === "blank" && e) return `${naam(e)} → property${pad && pad.type === "iri" ? ` ${g.compact(pad.waarde)}` : ""}`;
    return naam(t);
  };

  // Prefixen die in sh:declare staan (voor de SPARQL-controle).
  const declaraties = new Map();
  for (const tr of g.triples) {
    if (tr.p.waarde !== sh("declare")) continue;
    const p = g.object(tr.o, sh("prefix"));
    if (p?.type === "literal") {
      if (!declaraties.has(termSleutel(tr.s))) declaraties.set(termSleutel(tr.s), new Set());
      declaraties.get(termSleutel(tr.s)).add(p.waarde);
    }
  }

  for (const tr of g.triples) {
    const p = tr.p.waarde;
    // Woordenschat.
    if (p.startsWith(SH) && !PREDICATEN.has(p.slice(SH.length))) {
      meld("waarschuwing", "onbekend-predicaat", tr.s, `${plekVan(tr.s)}: SHACL kent geen predicaat ${naam(tr.p)} (tikfout?); het doet niets.`);
    }
    if (p === TYPE && tr.o.type === "iri" && tr.o.waarde.startsWith(SH) && !KLASSEN.has(tr.o.waarde.slice(SH.length))) {
      meld("waarschuwing", "onbekend-type", tr.s, `${naam(tr.s)}: SHACL kent geen klasse ${naam(tr.o)}.`);
    }
    // Reekspad.
    if (p === sh("path")) {
      const leden = g.lijst(tr.o);
      if (leden && leden.length >= 2 && leden.every((l) => l.type === "iri")) {
        const reeks = leden.map(naam).join("/");
        meld(
          "waarschuwing",
          "reekspad",
          tr.s,
          `${plekVan(tr.s)}: sh:path ( ${leden.map(naam).join(" ")} ) is een REEKS (${reeks}): de waarde van ${naam(leden[0])}, dan daarvan ${naam(leden[1])}, enz. Bedoel je "één van deze", gebruik dan [ sh:alternativePath ( … ) ].`
        );
      }
    }
    // sh:or/xone/and: leden die niets eisen.
    if (p === sh("or") || p === sh("xone") || p === sh("and")) {
      const leden = g.lijst(tr.o) || [];
      const leeg = leden.filter((l) => l.type === "blank" && g.van(l).length > 0 && g.van(l).every((x) => x.p.waarde.startsWith(SH) && UITLEG.has(x.p.waarde.slice(SH.length))));
      if (leeg.length) {
        const soort = naam(tr.p);
        meld(
          "waarschuwing",
          "lid-zonder-voorwaarde",
          tr.s,
          `${plekVan(tr.s)}: ${leeg.length} lid/leden van ${soort} hebben alleen een pad${leeg.some((l) => g.object(l, sh("path"))) ? "" : " of uitleg"} en geen voorwaarde (bv. sh:minCount 1); zo'n lid klopt altijd, dus de ${soort} ${soort === "sh:xone" ? "faalt of klopt los van de data" : "doet niets"}.`
        );
      }
    }
    // sh:in op rdf:type.
    if (p === sh("in")) {
      const pad = g.object(tr.s, sh("path"));
      if (pad?.type === "iri" && pad.waarde === TYPE) {
        meld(
          "waarschuwing",
          "in-op-type",
          tr.s,
          `${plekVan(tr.s)}: sh:in op rdf:type keurt elk type af dat níet in de lijst staat (ook de gewone typen van de knoop). Om typen te weren: sh:not [ sh:path rdf:type ; sh:in ( … ) ] of sh:class in een sh:not.`
        );
      }
    }
    if (p === sh("targetNode")) {
      meld("info", "targetnode", tr.s, `${naam(tr.s)}: sh:targetNode ${naam(tr.o)} controleert alleen die ene knoop; staat die niet in de data, dan controleert de shape niets.`);
    }
    // Property shape zonder pad.
    if (p === sh("property") && tr.o.type !== "literal" && !g.object(tr.o, sh("path"))) {
      meld("fout", "geen-pad", tr.s, `${naam(tr.s)}: sh:property ${g.fragment(tr.o)} heeft geen sh:path.`);
    }
  }

  // SPARQL.
  const subjecten = new Map();
  for (const tr of g.triples) subjecten.set(termSleutel(tr.s), tr.s);
  for (const t of subjecten.values()) {
    const typen = g.objecten(t, TYPE).map((o) => o.waarde);
    const doelen = ["targetClass", "targetNode", "targetSubjectsOf", "targetObjectsOf"].filter((d) => g.object(t, sh(d)));
    if (typen.includes(sh("SPARQLConstraint")) && doelen.length && !typen.includes(sh("NodeShape"))) {
      meld(
        "fout",
        "sparql-geen-shape",
        t,
        `${naam(t)}: een sh:SPARQLConstraint met sh:${doelen[0]} is geen shape; de regel draait nooit. Zet hem in een shape: ex:X a sh:NodeShape ; sh:${doelen[0]} … ; sh:sparql [ sh:select """…""" ] .`
      );
    }
    for (const veld of ["select", "ask"]) {
      const q = g.object(t, sh(veld));
      if (q?.type !== "literal") continue;
      const gedeclareerd = new Set();
      for (const pr of g.objecten(t, sh("prefixes"))) for (const x of declaraties.get(termSleutel(pr)) || []) gedeclareerd.add(x);
      const shape = g.subjecten(sh("sparql"), t)[0] || t;
      for (const m of controleerSparql(q.waarde, gedeclareerd)) {
        meld("fout", m.code, shape, `${naam(shape)}: sh:${veld} — ${m.bericht}`);
      }
      if (veld === "select" && !/\$this\b/.test(q.waarde)) meld("waarschuwing", "sparql-zonder-this", shape, `${naam(shape)}: sh:select zonder $this; de query hangt niet aan de focusknoop.`);
    }
  }

  // Node shapes zonder doel waar niets naar verwijst.
  const verwezen = new Set();
  for (const tr of g.triples) {
    if ([sh("node"), sh("property"), sh("qualifiedValueShape"), sh("not")].includes(tr.p.waarde)) verwezen.add(termSleutel(tr.o));
    if ([sh("or"), sh("xone"), sh("and")].includes(tr.p.waarde)) for (const l of g.lijst(tr.o) || []) verwezen.add(termSleutel(l));
  }
  for (const t of subjecten.values()) {
    const typen = g.objecten(t, TYPE).map((o) => o.waarde);
    if (!typen.includes(sh("NodeShape"))) continue;
    const doel = ["targetClass", "targetNode", "targetSubjectsOf", "targetObjectsOf", "target"].some((d) => g.object(t, sh(d)));
    const klasse = typen.some((x) => x === "http://www.w3.org/2000/01/rdf-schema#Class" || x === "http://www.w3.org/2002/07/owl#Class");
    if (!doel && !klasse && !verwezen.has(termSleutel(t)) && !g.object(t, sh("deactivated"))) {
      meld("waarschuwing", "shape-zonder-doel", t, `${naam(t)}: deze node shape heeft geen doel (sh:targetClass, …) en niets verwijst ernaar; hij controleert niets.`);
    }
  }
  return uit;
}
