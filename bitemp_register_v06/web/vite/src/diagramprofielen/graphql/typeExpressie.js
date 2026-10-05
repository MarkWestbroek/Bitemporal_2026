// @ts-check
/**
 * typeExpressie — GraphQL-type-expressies (`Inkomen`, `[Inkomen!]`, `String!`,
 * `[[Int!]]!`) ontleden en terugschrijven.
 *
 * Een veldtype in GraphQL is een expressie: een benoemd type met de wrappers
 * NonNull (`!`) en List (`[ ]`), willekeurig genest. Het profiel bewaart de
 * expressie als tekst in `veld.data.typeLabel` (zelfde sleutel als OAS, zodat
 * de "naam-type"-viewer hem rechts in de regel toont); deze module is de ene
 * plek die de tekst begrijpt.
 *
 * Puur, zonder dependencies.
 */

/** De vijf ingebouwde scalars (GraphQL-spec §3.5). */
export const INGEBOUWDE_SCALARS = ["Int", "Float", "String", "Boolean", "ID"];

const NAAM = /^[_A-Za-z][_0-9A-Za-z]*/;

/**
 * @typedef {{soort: "naam", naam: string, nonNull: boolean}
 *         | {soort: "lijst", van: TypeAst, nonNull: boolean}} TypeAst
 */

/**
 * Ontleed een type-expressie. Geeft `null` bij een ongeldige expressie
 * (lege tekst, ontbrekende haak, `!!`, rommel erachter).
 *
 * @param {string} tekst
 * @returns {TypeAst | null}
 */
export function parseTypeExpressie(tekst) {
  const s = String(tekst ?? "").replace(/\s+/g, "");
  let i = 0;
  /** @returns {TypeAst | null} */
  const type = () => {
    /** @type {TypeAst | null} */
    let ast = null;
    if (s[i] === "[") {
      i += 1;
      const van = type();
      if (!van || s[i] !== "]") return null;
      i += 1;
      ast = { soort: "lijst", van, nonNull: false };
    } else {
      const m = NAAM.exec(s.slice(i));
      if (!m) return null;
      i += m[0].length;
      ast = { soort: "naam", naam: m[0], nonNull: false };
    }
    if (s[i] === "!") {
      i += 1;
      ast.nonNull = true;
    }
    return ast;
  };
  const ast = type();
  return ast && i === s.length ? ast : null;
}

/** AST → canonieke tekst (zonder spaties). */
export function formatteerTypeExpressie(ast) {
  if (!ast) return "";
  const kern = ast.soort === "lijst" ? `[${formatteerTypeExpressie(ast.van)}]` : ast.naam;
  return kern + (ast.nonNull ? "!" : "");
}

/** Canonieke schrijfwijze van een expressie; ongeldige tekst komt getrimd terug. */
export function normaliseerTypeExpressie(tekst) {
  const ast = parseTypeExpressie(tekst);
  return ast ? formatteerTypeExpressie(ast) : String(tekst ?? "").trim();
}

/** Het benoemde type binnenin (`[Inkomen!]!` → `Inkomen`), of null. */
export function basisNaam(tekst) {
  let ast = parseTypeExpressie(tekst);
  while (ast && ast.soort === "lijst") ast = ast.van;
  return ast ? ast.naam : null;
}

/** Is de buitenste wrapper een lijst (eventueel non-null)? */
export function isLijst(tekst) {
  return parseTypeExpressie(tekst)?.soort === "lijst";
}

/** Is de expressie als geheel non-null (`T!`, `[T]!`)? */
export function isNonNull(tekst) {
  return parseTypeExpressie(tekst)?.nonNull === true;
}

/**
 * UML-kardinaliteit voor het lijnlabel aan de doelzijde.
 *
 *   T      → 0..1     T!     → 1
 *   [T]    → 0..*     [T!]!  → 0..*
 *
 * Een GraphQL-lijst kan altijd leeg zijn — "minstens één" bestaat niet in het
 * typesysteem — dus een lijst is 0..*, ook als hij non-null is.
 */
export function kardinaliteit(tekst) {
  const ast = parseTypeExpressie(tekst);
  if (!ast) return "";
  if (ast.soort === "lijst") return "0..*";
  return ast.nonNull ? "1" : "0..1";
}
