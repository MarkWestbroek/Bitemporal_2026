// @ts-check
/**
 * turtleLezer — **lezer**: Turtle-tekst → RDF-triples (W3C RDF 1.1 Turtle).
 *
 * Eerste stap van een import (zie docs/TRANSFORMATIES.md §3): de lezer kent
 * alleen de syntaxis, geen profiel. Wat een SHACL-, SKOS- of OWL-profiel met de
 * triples doet, staat in hun eigen adapter. Tegenhanger van turtleSchrijver.js.
 *
 * Volledig volgens de grammatica van Turtle 1.1: `@prefix`/`@base` en de
 * SPARQL-vorm `PREFIX`/`BASE`, IRI's (relatief tegen de basis), prefixnamen
 * (met `\`-escapes en `%XX`), lege knopen (`_:x` en `[ … ]`), collecties
 * `( … )` (worden rdf:first/rdf:rest), `a`, de vier soorten strings (ook
 * `"""…"""`), taal (`@nl`) en datatype (`^^xsd:date`), getallen en booleans.
 * Geen dependency (zoals de eigen SDL-parser van het GraphQL-profiel).
 *
 * Wat de lezer weggooit: commentaar, witruimte en de volgorde van de
 * prefixen. Een rondreis is daarom semantisch, niet tekstueel.
 *
 * Termen:
 *   { type: "iri", waarde }                          volledige IRI
 *   { type: "blank", waarde }                        "_:b0", "_:x" (label blijft herkenbaar)
 *   { type: "literal", waarde, datatype, taal? }     datatype altijd volledig
 *
 * Puur, getest in turtleLezer.test.js (ook tegen rdflib-tellingen).
 */

export const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export const XSD = "http://www.w3.org/2001/XMLSchema#";
const RDF_TYPE = `${RDF}type`;
const RDF_FIRST = `${RDF}first`;
const RDF_REST = `${RDF}rest`;
const RDF_NIL = `${RDF}nil`;
const RDF_LANGSTRING = `${RDF}langString`;

/**
 * @typedef {{type: "iri", waarde: string}} Iri
 * @typedef {{type: "blank", waarde: string}} Blank
 * @typedef {{type: "literal", waarde: string, datatype: string, taal?: string}} Literal
 * @typedef {Iri|Blank|Literal} Term
 * @typedef {{s: Iri|Blank, p: Iri, o: Term}} Triple
 */

/** Parsefout met regel en kolom (1-based), zoals SdlFout. */
export class TurtleFout extends Error {
  /** @param {string} bericht @param {number} regel @param {number} kolom */
  constructor(bericht, regel, kolom) {
    super(`regel ${regel}, kolom ${kolom}: ${bericht}`);
    this.name = "TurtleFout";
    this.regel = regel;
    this.kolom = kolom;
  }
}

// PN_CHARS_BASE uit de grammatica (zonder de surrogaten; die komen als paar binnen).
const PN_CHARS_BASE = /[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]|[\uD800-\uDBFF][\uDC00-\uDFFF]/y;
const isPnCharsBase = (s, i) => {
  PN_CHARS_BASE.lastIndex = i;
  const m = PN_CHARS_BASE.exec(s);
  return m ? m[0].length : 0;
};
const isPnCharsU = (s, i) => (s[i] === "_" ? 1 : isPnCharsBase(s, i));
const isPnChars = (s, i) => {
  const n = isPnCharsU(s, i);
  if (n) return n;
  const c = s[i];
  if (c === "-" || (c >= "0" && c <= "9") || c === "\u00B7") return 1;
  const k = c ? c.charCodeAt(0) : 0;
  return (k >= 0x0300 && k <= 0x036f) || (k >= 0x203f && k <= 0x2040) ? 1 : 0;
};
const HEX = /^[0-9A-Fa-f]$/;
/** Tekens die in een prefixnaam met `\` geëscapet mogen worden (PN_LOCAL_ESC). */
const LOCAL_ESC = "_~.-!$&'()*+,;=/?#@%";

const STRING_ESC = { t: "\t", b: "\b", n: "\n", r: "\r", f: "\f", '"': '"', "'": "'", "\\": "\\" };

/** Los een (mogelijk relatieve) IRI op tegen de basis (RFC 3986, via URL). */
function losOp(iri, basis) {
  if (!basis || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(iri)) return iri;
  try {
    // URL normaliseert ("http://x" → "http://x/"); alleen gebruiken voor relatieve delen.
    if (iri === "") return basis.replace(/#.*$/, "");
    if (iri.startsWith("#")) return basis.replace(/#.*$/, "") + iri;
    return new URL(iri, basis).href;
  } catch {
    return iri;
  }
}

/**
 * Turtle-tekst → triples.
 * @param {string} tekst
 * @param {{basis?: string}} [opties] - basis-IRI voor relatieve IRI's (bv. de bestandsplek)
 * @returns {{triples: Triple[], prefixen: Record<string, string>, basis: string|undefined}}
 */
export function leesTurtle(tekst, opties = {}) {
  const s = String(tekst ?? "").replace(/^\uFEFF/, "");
  let i = 0;
  let basis = opties.basis;
  /** @type {Record<string, string>} */
  const prefixen = {};
  /** @type {Triple[]} */
  const triples = [];
  /** Label → blank-id: `_:x` in de tekst houdt zijn label, `[]` krijgt b0, b1, …. */
  const labels = new Map();
  let blankTeller = 0;
  const gebruikt = new Set();
  const nieuweBlank = () => {
    let id;
    do id = `_:b${blankTeller++}`;
    while (gebruikt.has(id));
    gebruikt.add(id);
    return /** @type {Blank} */ ({ type: "blank", waarde: id });
  };
  const gelabeldeBlank = (label) => {
    if (!labels.has(label)) {
      const id = gebruikt.has(`_:${label}`) ? nieuweBlank().waarde : `_:${label}`;
      gebruikt.add(id);
      labels.set(label, id);
    }
    return /** @type {Blank} */ ({ type: "blank", waarde: labels.get(label) });
  };

  const plek = (pos = i) => {
    let regel = 1;
    let begin = 0;
    for (let k = 0; k < pos && k < s.length; k++) {
      if (s[k] === "\n") {
        regel += 1;
        begin = k + 1;
      }
    }
    return { regel, kolom: pos - begin + 1 };
  };
  const fout = (bericht, pos = i) => {
    const { regel, kolom } = plek(pos);
    return new TurtleFout(bericht, regel, kolom);
  };
  const toon = () => (i >= s.length ? "het einde van het bestand" : `"${s.slice(i, i + 12).split("\n")[0]}"`);

  /** Witruimte en commentaar overslaan. */
  const wit = () => {
    while (i < s.length) {
      const c = s[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") i++;
      else if (c === "#") {
        while (i < s.length && s[i] !== "\n" && s[i] !== "\r") i++;
      } else break;
    }
  };
  const verwacht = (teken) => {
    wit();
    if (s[i] !== teken) throw fout(`"${teken}" verwacht, gevonden ${toon()}`);
    i++;
  };
  /** Sleutelwoord zonder hoofdlettergevoeligheid (PREFIX, BASE), gevolgd door witruimte. */
  const sleutelwoord = (woord) => {
    const stuk = s.slice(i, i + woord.length);
    if (stuk.toUpperCase() !== woord) return false;
    const na = s[i + woord.length];
    return na === undefined || /[\s<#]/.test(na) || (woord.endsWith(":") === false && /[\s]/.test(na));
  };

  // ── Terminals ─────────────────────────────────────────────────────────────

  /** UCHAR: \uXXXX of \UXXXXXXXX (vanaf de backslash). */
  const uchar = () => {
    const lang = s[i + 1] === "U" ? 8 : 4;
    const hex = s.slice(i + 2, i + 2 + lang);
    if (hex.length !== lang || ![...hex].every((h) => HEX.test(h))) throw fout("ongeldige \\u-escape");
    i += 2 + lang;
    return String.fromCodePoint(parseInt(hex, 16));
  };

  /** IRIREF `<…>` → opgeloste IRI. */
  const iriRef = () => {
    const start = i;
    i++; // <
    let uit = "";
    while (i < s.length && s[i] !== ">") {
      const c = s[i];
      if (c === "\\") {
        if (s[i + 1] !== "u" && s[i + 1] !== "U") throw fout("in een IRI mag alleen \\u of \\U");
        uit += uchar();
        continue;
      }
      if (/[\s<"{}|^`]/.test(c)) throw fout(`ongeldig teken in een IRI: ${JSON.stringify(c)}`);
      uit += c;
      i++;
    }
    if (s[i] !== ">") throw fout("IRI zonder afsluitende >", start);
    i++;
    return losOp(uit, basis);
  };

  /** PN_PREFIX (mag leeg zijn), vanaf i; geeft de prefix zonder dubbelepunt of null. */
  const pnPrefix = () => {
    const start = i;
    let n = isPnCharsBase(s, i);
    if (!n) return s[i] === ":" ? "" : null;
    i += n;
    while (i < s.length) {
      if (s[i] === ".") {
        // Een punt mag, maar niet als laatste teken.
        let j = i;
        while (s[j] === ".") j++;
        if (isPnChars(s, j)) {
          i = j;
          continue;
        }
        break;
      }
      n = isPnChars(s, i);
      if (!n) break;
      i += n;
    }
    if (s[i] !== ":") {
      i = start;
      return null;
    }
    return s.slice(start, i);
  };

  /** PN_LOCAL vanaf i (na de dubbelepunt); geeft de onge-escapete lokale naam. */
  const pnLocal = () => {
    let uit = "";
    const stuk = (eerste) => {
      const c = s[i];
      if (c === "%") {
        if (!HEX.test(s[i + 1] || "") || !HEX.test(s[i + 2] || "")) throw fout("ongeldige %-escape in een prefixnaam");
        uit += s.slice(i, i + 3);
        i += 3;
        return true;
      }
      if (c === "\\") {
        if (!LOCAL_ESC.includes(s[i + 1] || "x")) throw fout("ongeldige \\-escape in een prefixnaam");
        uit += s[i + 1];
        i += 2;
        return true;
      }
      if (c === ":" || (eerste && c >= "0" && c <= "9")) {
        uit += c;
        i++;
        return true;
      }
      const n = eerste ? isPnCharsU(s, i) : isPnChars(s, i);
      if (n) {
        uit += s.slice(i, i + n);
        i += n;
        return true;
      }
      return false;
    };
    if (!stuk(true)) return uit;
    while (i < s.length) {
      if (s[i] === ".") {
        let j = i;
        while (s[j] === ".") j++;
        const terug = i;
        i = j;
        const voor = uit;
        if (stuk(false)) {
          uit = voor + ".".repeat(j - terug) + uit.slice(voor.length);
          continue;
        }
        i = terug;
        break;
      }
      if (!stuk(false)) break;
    }
    return uit;
  };

  /** Prefixnaam `p:lokaal` → IRI. */
  const prefixNaam = () => {
    const start = i;
    const p = pnPrefix();
    if (p === null) throw fout(`term verwacht, gevonden ${toon()}`);
    i++; // :
    const lokaal = pnLocal();
    if (!Object.hasOwn(prefixen, p)) throw fout(`onbekende prefix "${p}:"`, start);
    return prefixen[p] + lokaal;
  };

  const iri = () => (s[i] === "<" ? iriRef() : prefixNaam());

  /** String in een van de vier vormen, vanaf de aanhalingstekens. */
  const string = () => {
    const q = s[i];
    const lang = s.slice(i, i + 3) === q.repeat(3);
    const start = i;
    i += lang ? 3 : 1;
    let uit = "";
    while (true) {
      if (i >= s.length) throw fout("string zonder einde", start);
      const c = s[i];
      if (lang ? s.slice(i, i + 3) === q.repeat(3) : c === q) {
        i += lang ? 3 : 1;
        // Bij """a"""" horen extra aanhalingstekens nog bij de string.
        if (lang) {
          while (s[i] === q && s.slice(i, i + 3) !== q.repeat(3)) {
            uit += q;
            i++;
          }
        }
        return uit;
      }
      if (!lang && (c === "\n" || c === "\r")) throw fout("regeleinde in een korte string (gebruik \"\"\"…\"\"\")");
      if (c === "\\") {
        const e = s[i + 1];
        if (e === "u" || e === "U") {
          uit += uchar();
          continue;
        }
        if (!(e in STRING_ESC)) throw fout(`ongeldige escape \\${e ?? ""}`);
        uit += STRING_ESC[e];
        i += 2;
        continue;
      }
      uit += c;
      i++;
    }
  };

  const GETAL = /[+-]?(?:[0-9]+\.[0-9]*[eE][+-]?[0-9]+|\.[0-9]+[eE][+-]?[0-9]+|[0-9]+[eE][+-]?[0-9]+|[0-9]*\.[0-9]+|[0-9]+)/y;

  /** Literal: string (+ taal/datatype), getal of boolean. */
  const literal = () => {
    const c = s[i];
    if (c === '"' || c === "'") {
      const waarde = string();
      if (s[i] === "@") {
        const m = /@([A-Za-z]+(?:-[A-Za-z0-9]+)*)/y;
        m.lastIndex = i;
        const r = m.exec(s);
        if (!r) throw fout("ongeldige taaltag");
        i += r[0].length;
        return /** @type {Literal} */ ({ type: "literal", waarde, datatype: RDF_LANGSTRING, taal: r[1] });
      }
      if (s.slice(i, i + 2) === "^^") {
        i += 2;
        return /** @type {Literal} */ ({ type: "literal", waarde, datatype: iri() });
      }
      return /** @type {Literal} */ ({ type: "literal", waarde, datatype: `${XSD}string` });
    }
    GETAL.lastIndex = i;
    const g = GETAL.exec(s);
    if (g) {
      i += g[0].length;
      const t = g[0];
      const datatype = /[eE]/.test(t) ? "double" : t.includes(".") ? "decimal" : "integer";
      return /** @type {Literal} */ ({ type: "literal", waarde: t, datatype: `${XSD}${datatype}` });
    }
    for (const b of ["true", "false"]) {
      if (s.startsWith(b, i) && !isPnChars(s, i + b.length) && s[i + b.length] !== ":") {
        i += b.length;
        return /** @type {Literal} */ ({ type: "literal", waarde: b, datatype: `${XSD}boolean` });
      }
    }
    return null;
  };

  // ── Grammatica ────────────────────────────────────────────────────────────

  /** @param {Iri|Blank} subj @param {Iri} pred @param {Term} obj */
  const voegToe = (subj, pred, obj) => triples.push({ s: subj, p: pred, o: obj });

  const blankLabel = () => {
    i += 2; // _:
    const start = i;
    const eerste = s[i] >= "0" && s[i] <= "9" ? 1 : isPnCharsU(s, i);
    if (!eerste) throw fout("lege-knooplabel verwacht na _:");
    i += eerste;
    while (i < s.length) {
      if (s[i] === ".") {
        let j = i;
        while (s[j] === ".") j++;
        if (isPnChars(s, j)) {
          i = j;
          continue;
        }
        break;
      }
      const n = isPnChars(s, i);
      if (!n) break;
      i += n;
    }
    return gelabeldeBlank(s.slice(start, i));
  };

  /** `( … )` → kop van de lijst (rdf:nil als leeg). */
  const collectie = () => {
    i++; // (
    /** @type {Term[]} */
    const leden = [];
    while (true) {
      wit();
      if (s[i] === ")") {
        i++;
        break;
      }
      if (i >= s.length) throw fout("collectie zonder )");
      leden.push(object());
    }
    if (!leden.length) return /** @type {Iri} */ ({ type: "iri", waarde: RDF_NIL });
    const knopen = leden.map(() => nieuweBlank());
    knopen.forEach((k, n) => {
      voegToe(k, { type: "iri", waarde: RDF_FIRST }, leden[n]);
      voegToe(k, { type: "iri", waarde: RDF_REST }, n + 1 < knopen.length ? knopen[n + 1] : { type: "iri", waarde: RDF_NIL });
    });
    return knopen[0];
  };

  /** `[ … ]` → lege knoop (met of zonder eigenschappen). */
  const blankEigenschappen = () => {
    i++; // [
    const knoop = nieuweBlank();
    wit();
    if (s[i] === "]") {
      i++;
      return knoop;
    }
    predicaatObjectLijst(knoop);
    verwacht("]");
    return knoop;
  };

  /** @returns {Term} */
  const object = () => {
    wit();
    const c = s[i];
    if (c === "<") return { type: "iri", waarde: iriRef() };
    if (c === "_" && s[i + 1] === ":") return blankLabel();
    if (c === "(") return collectie();
    if (c === "[") return blankEigenschappen();
    const lit = literal();
    if (lit) return lit;
    return { type: "iri", waarde: prefixNaam() };
  };

  /** @returns {Iri} */
  const predicaat = () => {
    wit();
    if (s[i] === "a" && !isPnChars(s, i + 1) && s[i + 1] !== ":") {
      i++;
      return { type: "iri", waarde: RDF_TYPE };
    }
    if (s[i] === "<") return { type: "iri", waarde: iriRef() };
    return { type: "iri", waarde: prefixNaam() };
  };

  /** @param {Iri|Blank} subj */
  const predicaatObjectLijst = (subj) => {
    while (true) {
      const pred = predicaat();
      while (true) {
        voegToe(subj, pred, object());
        wit();
        if (s[i] !== ",") break;
        i++;
      }
      wit();
      if (s[i] !== ";") return;
      while (s[i] === ";") {
        i++;
        wit();
      }
      if (s[i] === "." || s[i] === "]" || i >= s.length) return;
    }
  };

  /** @returns {Iri|Blank} */
  const subject = () => {
    const c = s[i];
    if (c === "<") return { type: "iri", waarde: iriRef() };
    if (c === "_" && s[i + 1] === ":") return blankLabel();
    if (c === "(") {
      const kop = collectie();
      if (kop.type === "literal") throw fout("een literal kan geen subject zijn");
      return kop;
    }
    return { type: "iri", waarde: prefixNaam() };
  };

  const prefixDirectief = (sparql) => {
    wit();
    const p = pnPrefix();
    if (p === null) throw fout("prefixnaam met : verwacht");
    i++; // :
    wit();
    if (s[i] !== "<") throw fout("IRI tussen <> verwacht na de prefix");
    prefixen[p] = iriRef();
    if (!sparql) verwacht(".");
  };
  const basisDirectief = (sparql) => {
    wit();
    if (s[i] !== "<") throw fout("IRI tussen <> verwacht na base");
    basis = iriRef();
    if (!sparql) verwacht(".");
  };

  while (true) {
    wit();
    if (i >= s.length) break;
    if (s.startsWith("@prefix", i)) {
      i += 7;
      prefixDirectief(false);
      continue;
    }
    if (s.startsWith("@base", i)) {
      i += 5;
      basisDirectief(false);
      continue;
    }
    if (sleutelwoord("PREFIX")) {
      i += 6;
      prefixDirectief(true);
      continue;
    }
    if (sleutelwoord("BASE")) {
      i += 4;
      basisDirectief(true);
      continue;
    }
    if (s[i] === "[") {
      // blankNodePropertyList predicateObjectList? '.'
      const knoop = blankEigenschappen();
      wit();
      if (s[i] !== ".") predicaatObjectLijst(knoop);
      verwacht(".");
      continue;
    }
    const subj = subject();
    predicaatObjectLijst(subj);
    verwacht(".");
  }
  return { triples, prefixen, basis };
}

/** Een tekst als Turtle-string `"…"`, met escapes (ook voor regeleinden en aanhalingstekens). */
export function turtleString(waarde) {
  const esc = { "\\": "\\\\", '"': '\\"', "\n": "\\n", "\r": "\\r", "\t": "\\t" };
  return `"${String(waarde).replace(/[\\"\n\r\t]/g, (c) => esc[c])}"`;
}

/**
 * Een (meerregelige) tekst als `"""…"""`, leesbaar voor SPARQL-queries; valt terug op
 * turtleString als de tekst zelf aanhalingstekens aan het eind of `"""` bevat.
 */
export function turtleLangeString(waarde) {
  const s = String(waarde);
  if (/"""|"$/.test(s)) return turtleString(s);
  return `"""${s.replace(/\\/g, "\\\\")}"""`;
}

// ── Graaf: opzoeken in de triples ──────────────────────────────────────────

/** Sleutel van een term (voor Map/Set): IRI's en blanks hebben een eigen ruimte. */
export const termSleutel = (t) => (t.type === "literal" ? `"${t.waarde}"@${t.taal || ""}^^${t.datatype}` : t.type === "blank" ? t.waarde : `<${t.waarde}>`);

/**
 * Een kleine, alleen-lezen graaf over de triples: opzoeken per subject en
 * predicaat, RDF-lijsten uitvouwen, IRI's compact schrijven.
 */
export class RdfGraaf {
  /** @param {Triple[]} triples @param {Record<string, string>} [prefixen] */
  constructor(triples, prefixen = {}) {
    this.triples = triples;
    this.prefixen = prefixen;
    /** @type {Map<string, Triple[]>} */
    this.perSubject = new Map();
    /** @type {Map<string, Triple[]>} */
    this.perObject = new Map();
    for (const t of triples) {
      const k = termSleutel(t.s);
      if (!this.perSubject.has(k)) this.perSubject.set(k, []);
      this.perSubject.get(k).push(t);
      const ko = termSleutel(t.o);
      if (!this.perObject.has(ko)) this.perObject.set(ko, []);
      this.perObject.get(ko).push(t);
    }
  }

  /** Alle triples met dit subject (in bestandsvolgorde). @param {Term} subj */
  van(subj) {
    return this.perSubject.get(termSleutel(subj)) || [];
  }

  /** Objecten van (subj, pred). @param {Term} subj @param {string} pred */
  objecten(subj, pred) {
    return this.van(subj).filter((t) => t.p.waarde === pred).map((t) => t.o);
  }

  /** Eerste object van (subj, pred), of undefined. */
  object(subj, pred) {
    return this.van(subj).find((t) => t.p.waarde === pred)?.o;
  }

  /** Subjecten met (pred, obj). @param {string} pred @param {Term} obj */
  subjecten(pred, obj) {
    return (this.perObject.get(termSleutel(obj)) || []).filter((t) => t.p.waarde === pred).map((t) => t.s);
  }

  /** Hoe vaak komt deze term als object voor? @param {Term} t */
  verwijzingen(t) {
    return (this.perObject.get(termSleutel(t)) || []).length;
  }

  /**
   * RDF-lijst → leden, of null als het geen nette lijst is (geen first/rest,
   * een kring, of een lid met meer eigenschappen dan first/rest).
   * @param {Term|undefined} kop
   * @returns {Term[]|null}
   */
  lijst(kop) {
    if (!kop) return null;
    const leden = [];
    const gezien = new Set();
    let k = kop;
    while (!(k.type === "iri" && k.waarde === RDF_NIL)) {
      if (k.type !== "blank" || gezien.has(k.waarde)) return null;
      gezien.add(k.waarde);
      const first = this.objecten(k, RDF_FIRST);
      const rest = this.objecten(k, RDF_REST);
      if (first.length !== 1 || rest.length !== 1) return null;
      leden.push(first[0]);
      k = rest[0];
    }
    return leden;
  }

  /** Is deze knoop een lijstknoop (rdf:first/rdf:rest)? */
  isLijst(t) {
    return (t.type === "iri" && t.waarde === RDF_NIL) || this.objecten(t, RDF_FIRST).length > 0;
  }

  /**
   * IRI → `prefix:lokaal` als een prefix past en de rest een geldige lokale
   * naam is, anders `<iri>`. De langste namespace wint.
   * @param {string} waarde
   */
  compact(waarde) {
    let beste = null;
    for (const [p, ns] of Object.entries(this.prefixen)) {
      if (ns && waarde.startsWith(ns) && (!beste || ns.length > beste[1].length)) {
        const lokaal = waarde.slice(ns.length);
        if (/^([A-Za-z_\u00C0-\uFFFD0-9]([A-Za-z0-9_\-.\u00B7\u00C0-\uFFFD]*[A-Za-z0-9_\-\u00B7\u00C0-\uFFFD])?)?$/.test(lokaal)) beste = [p, ns];
      }
    }
    return beste ? `${beste[0]}:${waarde.slice(beste[1].length)}` : `<${waarde}>`;
  }

  /** Een term als Turtle-tekst (compact), voor weergave en het bewaren van fragmenten. */
  alsTekst(t) {
    if (t.type === "iri") return this.compact(t.waarde);
    if (t.type === "blank") return t.waarde;
    const tekst = turtleString(t.waarde);
    if (t.taal) return `${tekst}@${t.taal}`;
    if (t.datatype === `${XSD}string`) return tekst;
    if (t.datatype === `${XSD}integer` && /^[+-]?\d+$/.test(t.waarde)) return t.waarde;
    if (t.datatype === `${XSD}boolean` && /^(true|false)$/.test(t.waarde)) return t.waarde;
    if (t.datatype === `${XSD}decimal` && /^[+-]?\d*\.\d+$/.test(t.waarde)) return t.waarde;
    return `${tekst}^^${this.compact(t.datatype)}`;
  }

  /** Een predicaat als Turtle-tekst: `a` voor rdf:type, anders compact. @param {string} waarde */
  predicaat(waarde) {
    return waarde === RDF_TYPE ? "a" : this.compact(waarde);
  }

  /**
   * Een knoop als Turtle-fragment: IRI/literal compact, een lege knoop als
   * `[ p o ; … ]` en een lijst als `( … )`, genest. Voor het bewaren van
   * constraints (sh:or, sh:xone, …) als body met taal SHACL.
   * @param {Term} t
   * @param {string} [inspring]
   */
  fragment(t, inspring = "", pad = new Set()) {
    const lijst = t.type === "blank" || (t.type === "iri" && t.waarde === RDF_NIL) ? this.lijst(t) : null;
    if (lijst) return lijst.length ? `( ${lijst.map((l) => this.fragment(l, inspring, pad)).join(" ")} )` : "()";
    if (t.type !== "blank") return this.alsTekst(t);
    // Een kring van lege knopen (_:x p _:y . _:y p _:x): terugverwijzen met het label.
    if (pad.has(t.waarde)) return t.waarde;
    pad = new Set(pad).add(t.waarde);
    const eigen = this.van(t);
    if (!eigen.length) return "[]";
    const perPred = new Map();
    for (const tr of eigen) {
      if (!perPred.has(tr.p.waarde)) perPred.set(tr.p.waarde, []);
      perPred.get(tr.p.waarde).push(tr.o);
    }
    const binnen = `${inspring}  `;
    const delen = [...perPred].map(([p, os]) => `${this.predicaat(p)} ${os.map((o) => this.fragment(o, binnen, pad)).join(", ")}`);
    const kort = `[ ${delen.join(" ; ")} ]`;
    return kort.length <= 80 && !kort.includes("\n") ? kort : `[\n${delen.map((d) => `${binnen}${d}`).join(" ;\n")}\n${inspring}]`;
  }
}
