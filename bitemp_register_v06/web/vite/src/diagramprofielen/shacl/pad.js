// @ts-check
/**
 * pad — een SHACL-pad (sh:path, SHACL §2.3.1) als tekst in SPARQL-padsyntax,
 * zoals Sparna en de SPARQL-spec het schrijven:
 *
 *   ex:a                          predicaat
 *   ( ex:a ex:b )                 ex:a/ex:b          reeks
 *   [ sh:alternativePath (a b) ]  ex:a|ex:b          alternatief
 *   [ sh:inversePath ex:a ]       ^ex:a              invers
 *   [ sh:zeroOrMorePath ex:a ]    ex:a*
 *   [ sh:oneOrMorePath ex:a ]     ex:a+
 *   [ sh:zeroOrOnePath ex:a ]     ex:a?
 *
 * Samengestelde delen krijgen haakjes: `(ex:a|ex:b)/ex:c`, `^(ex:a/ex:b)`.
 * De terugweg (tekst → pad) hoort bij de schrijver (fase 2).
 */

export const SH = "http://www.w3.org/ns/shacl#";

const UNAIR = {
  [`${SH}inversePath`]: (t) => `^${t}`,
  [`${SH}zeroOrMorePath`]: (t) => `${t}*`,
  [`${SH}oneOrMorePath`]: (t) => `${t}+`,
  [`${SH}zeroOrOnePath`]: (t) => `${t}?`,
};

/**
 * @param {import("../../transformatie/turtleLezer.js").RdfGraaf} g
 * @param {import("../../transformatie/turtleLezer.js").Term} t
 * @param {(t: any) => void} [verbruik] - markeert gelezen lege knopen
 * @returns {{tekst: string, enkelvoudig: boolean}|null} null = geen geldig pad
 */
export function padNaarTekst(g, t, verbruik = () => {}) {
  if (t.type === "iri") return { tekst: g.compact(t.waarde), enkelvoudig: true };
  if (t.type !== "blank") return null;
  verbruik(t);
  const haakjes = (p) => (p.enkelvoudig ? p.tekst : `(${p.tekst})`);
  const lijst = g.lijst(t);
  if (lijst) {
    if (lijst.length < 2) return null; // een reeks heeft minstens twee leden (SHACL §2.3.1.1)
    const delen = lijst.map((l) => padNaarTekst(g, l, verbruik));
    if (delen.some((d) => !d)) return null;
    return { tekst: delen.map((d) => haakjes(/** @type {any} */ (d))).join("/"), enkelvoudig: false };
  }
  const eigen = g.van(t);
  if (eigen.length !== 1) return null;
  const { p, o } = eigen[0];
  if (p.waarde === `${SH}alternativePath`) {
    const leden = g.lijst(o);
    if (!leden || leden.length < 2) return null;
    verbruik(o);
    const delen = leden.map((l) => padNaarTekst(g, l, verbruik));
    if (delen.some((d) => !d)) return null;
    return { tekst: delen.map((d) => haakjes(/** @type {any} */ (d))).join("|"), enkelvoudig: false };
  }
  const maak = UNAIR[p.waarde];
  if (!maak) return null;
  const binnen = padNaarTekst(g, o, verbruik);
  if (!binnen) return null;
  // `^a*` leest SPARQL als ^(a*); (^a)* moet dus haakjes houden.
  const isPostfix = p.waarde !== `${SH}inversePath`;
  const deel = isPostfix && binnen.tekst.startsWith("^") ? `(${binnen.tekst})` : haakjes(binnen);
  return { tekst: maak(deel), enkelvoudig: true };
}

const RDF_TYPE = "<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>";
const POSTFIX = { "*": "zeroOrMorePath", "+": "oneOrMorePath", "?": "zeroOrOnePath" };

/** Fout in een pad-tekst, met de plek (0-based teken). */
export class PadFout extends Error {}

/**
 * Pad-tekst (SPARQL-padsyntax) → Turtle voor `sh:path`. Tegenhanger van padNaarTekst.
 *
 *   pad      := reeks ('|' reeks)*
 *   reeks    := element ('/' element)*
 *   element  := '^' element | primair ('*' | '+' | '?')?
 *   primair  := IRI | prefixnaam | 'a' | '(' pad ')'
 *
 * @param {string} tekst
 * @returns {string}
 */
export function padNaarTurtle(tekst) {
  const s = String(tekst ?? "");
  let i = 0;
  const wit = () => {
    while (/\s/.test(s[i] || "")) i++;
  };
  const fout = (bericht) => new PadFout(`pad "${s}": ${bericht} (teken ${i + 1})`);
  const alt = () => {
    const delen = [reeks()];
    wit();
    while (s[i] === "|") {
      i++;
      delen.push(reeks());
      wit();
    }
    return delen.length > 1 ? `[ sh:alternativePath ( ${delen.join(" ")} ) ]` : delen[0];
  };
  const reeks = () => {
    const delen = [element()];
    wit();
    while (s[i] === "/") {
      i++;
      delen.push(element());
      wit();
    }
    return delen.length > 1 ? `( ${delen.join(" ")} )` : delen[0];
  };
  const element = () => {
    wit();
    if (s[i] === "^") {
      i++;
      return `[ sh:inversePath ${element()} ]`;
    }
    let p = primair();
    wit();
    const mod = POSTFIX[s[i]];
    if (mod) {
      i++;
      p = `[ sh:${mod} ${p} ]`;
    }
    return p;
  };
  const primair = () => {
    wit();
    if (s[i] === "(") {
      i++;
      const p = alt();
      wit();
      if (s[i] !== ")") throw fout('")" verwacht');
      i++;
      return p;
    }
    if (s[i] === "<") {
      const eind = s.indexOf(">", i);
      if (eind < 0) throw fout("IRI zonder >");
      const iri = s.slice(i, eind + 1);
      i = eind + 1;
      return iri;
    }
    const m = /^(?:[A-Za-z_À-�][\w.\-·À-�]*)?:(?:\\.|[^\s|/()^*+?<>\\])*/.exec(s.slice(i));
    if (m && m[0].length) {
      i += m[0].length;
      return m[0];
    }
    if (s[i] === "a" && !/[\w:]/.test(s[i + 1] || "")) {
      i++;
      return RDF_TYPE;
    }
    throw fout(i >= s.length ? "pad is leeg of eindigt te vroeg" : `onverwacht "${s[i]}"`);
  };
  const uit = alt();
  wit();
  if (i < s.length) throw fout(`onverwacht "${s[i]}"`);
  return uit;
}
