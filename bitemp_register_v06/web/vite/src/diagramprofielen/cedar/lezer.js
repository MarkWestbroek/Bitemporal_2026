// @ts-check
/**
 * lezer — Cedar-policytekst → de JSON-vorm van Cedar (EST, "JSON policy format").
 *
 * Een eigen lezer, geen cedar-wasm: de PABC-policies van Open FTV schrijven een actie als
 * `name::"zaakafhandelcomponent/behandelaar"`. De officiële parser (4.15) weigert dat (een actie
 * moet type `Action` hebben); de PDP van Open FTV neemt het aan. Deze lezer leest beide en meldt
 * het verschil; hij verandert niets aan de vorm. Grammatica: Cedar-taalspecificatie §"Grammar"
 * (policy, scope, condities, expressies), zonder templates-sloten buiten de scope.
 *
 * Uitvoer per policy: `{ est, tekst, begin, eind }`: de EST (zoals cedar-wasm `policyToJson`
 * hem geeft) en de letterlijke tekst uit het bestand, zodat ongewijzigd terugschrijven dezelfde
 * bytes geeft. Puur; getest in lezer.test.js (vergeleken met cedar-wasm, zie de test).
 */

/** @typedef {{soort: string, waarde: string, pos: number}} Token */

const SLEUTELWOORDEN = new Set(["permit", "forbid", "when", "unless", "principal", "action", "resource", "context", "if", "then", "else", "true", "false", "in", "has", "like", "is"]);
const VARIABELEN = new Set(["principal", "action", "resource", "context"]);
/** Methoden met één argument die Cedar als binaire operator in de EST zet. */
const BINAIRE_METHODEN = new Set(["contains", "containsAll", "containsAny", "getTag", "hasTag"]);

export class CedarFout extends Error {
  /** @param {string} bericht @param {number} pos @param {string} tekst */
  constructor(bericht, pos, tekst) {
    const voor = tekst.slice(0, pos);
    const regel = voor.split("\n").length;
    const kolom = pos - voor.lastIndexOf("\n");
    super(`regel ${regel}, kolom ${kolom}: ${bericht}`);
    this.pos = pos;
    this.regel = regel;
    this.kolom = kolom;
  }
}

/** Tekst → tokens. Commentaar (`// …`) en witruimte vallen weg. */
export function tokens(tekst) {
  /** @type {Token[]} */
  const uit = [];
  let i = 0;
  const n = tekst.length;
  while (i < n) {
    const c = tekst[i];
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (c === "/" && tekst[i + 1] === "/") {
      while (i < n && tekst[i] !== "\n") i += 1;
      continue;
    }
    const begin = i;
    if (c === '"') {
      i += 1;
      while (i < n && tekst[i] !== '"') i += tekst[i] === "\\" ? 2 : 1;
      if (i >= n) throw new CedarFout("tekst zonder afsluitend aanhalingsteken", begin, tekst);
      i += 1;
      uit.push({ soort: "str", waarde: tekst.slice(begin, i), pos: begin });
      continue;
    }
    if (/[0-9]/.test(c)) {
      while (i < n && /[0-9]/.test(tekst[i])) i += 1;
      uit.push({ soort: "num", waarde: tekst.slice(begin, i), pos: begin });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      while (i < n && /[A-Za-z0-9_]/.test(tekst[i])) i += 1;
      uit.push({ soort: "id", waarde: tekst.slice(begin, i), pos: begin });
      continue;
    }
    const twee = tekst.slice(i, i + 2);
    if (["::", "==", "!=", "<=", ">=", "&&", "||"].includes(twee)) {
      uit.push({ soort: "op", waarde: twee, pos: begin });
      i += 2;
      continue;
    }
    if ("@(){}[],;.<>!+-*?:".includes(c)) {
      uit.push({ soort: "op", waarde: c, pos: begin });
      i += 1;
      continue;
    }
    throw new CedarFout(`onverwacht teken "${c}"`, begin, tekst);
  }
  uit.push({ soort: "eind", waarde: "", pos: n });
  return uit;
}

/** Een Cedar-tekstliteral ("…" met escapes) → tekst. */
export function ontsnap(literal) {
  const binnen = literal.slice(1, -1);
  return binnen.replace(/\\(u\{([0-9a-fA-F]{1,6})\}|.)/g, (_, e, hex) => {
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    return { n: "\n", r: "\r", t: "\t", "0": "\0", "\\": "\\", '"': '"', "'": "'", "*": "\\*" }[e] ?? e;
  });
}

/**
 * Parser over de tokens. Elke `lees…` geeft een EST-knoop.
 * @param {string} tekst
 */
function parser(tekst) {
  const t = tokens(tekst);
  let p = 0;
  const kijk = (k = 0) => t[p + k];
  const is = (waarde, k = 0) => t[p + k].waarde === waarde && t[p + k].soort !== "str";
  const fout = (bericht) => {
    throw new CedarFout(bericht, kijk().pos, tekst);
  };
  const neem = (waarde) => {
    if (!is(waarde)) fout(`verwacht "${waarde}", gevonden "${kijk().waarde || "einde"}"`);
    return t[p++];
  };
  const ident = () => {
    if (kijk().soort !== "id") fout(`verwacht een naam, gevonden "${kijk().waarde || "einde"}"`);
    return t[p++].waarde;
  };

  /** Pad `a::b::C` (zonder het laatste `::"id"`). */
  const pad = () => {
    const delen = [ident()];
    while (is("::") && kijk(1).soort === "id") {
      p += 1;
      delen.push(ident());
    }
    return delen.join("::");
  };
  /** Entiteit `Pad::"id"`. */
  const entiteit = () => {
    const type = pad();
    neem("::");
    if (kijk().soort !== "str") fout("verwacht een entiteit-id tussen aanhalingstekens");
    return { type, id: ontsnap(t[p++].waarde) };
  };

  // ── Scope ───────────────────────────────────────────────────────────────
  const scopeVar = (naam) => {
    neem(naam);
    if (is("==")) {
      p += 1;
      if (is("?")) {
        p += 1;
        return { op: "==", slot: `?${ident()}` };
      }
      return { op: "==", entity: entiteit() };
    }
    if (is("is")) {
      p += 1;
      const entity_type = pad();
      if (is("in")) {
        p += 1;
        if (is("?")) {
          p += 1;
          return { op: "is", entity_type, in: { slot: `?${ident()}` } };
        }
        return { op: "is", entity_type, in: { entity: entiteit() } };
      }
      return { op: "is", entity_type };
    }
    if (is("in")) {
      p += 1;
      if (is("?")) {
        p += 1;
        return { op: "in", slot: `?${ident()}` };
      }
      return { op: "in", entity: entiteit() };
    }
    return { op: "All" };
  };
  const actieScope = () => {
    neem("action");
    if (is("==")) {
      p += 1;
      return { op: "==", entity: entiteit() };
    }
    if (is("in")) {
      p += 1;
      if (is("[")) {
        p += 1;
        const entities = [];
        while (!is("]")) {
          entities.push(entiteit());
          if (!is("]")) neem(",");
        }
        neem("]");
        return { op: "in", entities };
      }
      return { op: "in", entity: entiteit() };
    }
    return { op: "All" };
  };

  // ── Expressies (voorrang: if < || < && < relatie < + - < * < unair < lid) ─────
  const expr = () => {
    if (is("if")) {
      p += 1;
      const als = expr();
      neem("then");
      const dan = expr();
      neem("else");
      const anders = expr();
      return { "if-then-else": { if: als, then: dan, else: anders } };
    }
    return of();
  };
  const of = () => {
    let links = en();
    while (is("||")) {
      p += 1;
      links = { "||": { left: links, right: en() } };
    }
    return links;
  };
  const en = () => {
    let links = relatie();
    while (is("&&")) {
      p += 1;
      links = { "&&": { left: links, right: relatie() } };
    }
    return links;
  };
  const relatie = () => {
    const links = optel();
    const op = kijk().waarde;
    if (kijk().soort === "op" && ["==", "!=", "<", "<=", ">", ">="].includes(op)) {
      p += 1;
      return { [op]: { left: links, right: optel() } };
    }
    if (is("in")) {
      p += 1;
      return { in: { left: links, right: optel() } };
    }
    if (is("has")) {
      p += 1;
      const attrs = [kijk().soort === "str" ? ontsnap(t[p++].waarde) : ident()];
      while (is(".")) {
        p += 1;
        attrs.push(ident());
      }
      // `e has a.b.c` (Cedar 4): één knoop met de lijst van attributen.
      return { has: { left: links, attr: attrs.length === 1 ? attrs[0] : attrs } };
    }
    if (is("like")) {
      p += 1;
      if (kijk().soort !== "str") fout("verwacht een patroon tussen aanhalingstekens na like");
      return { like: { left: links, pattern: patroon(t[p++].waarde) } };
    }
    if (is("is")) {
      p += 1;
      const entity_type = pad();
      if (is("in")) {
        p += 1;
        return { is: { left: links, entity_type, in: optel() } };
      }
      return { is: { left: links, entity_type } };
    }
    return links;
  };
  const optel = () => {
    let links = maal();
    while (is("+") || is("-")) {
      const op = t[p++].waarde;
      links = { [op]: { left: links, right: maal() } };
    }
    return links;
  };
  const maal = () => {
    let links = unair();
    while (is("*")) {
      p += 1;
      links = { "*": { left: links, right: unair() } };
    }
    return links;
  };
  const unair = () => {
    if (is("!")) {
      p += 1;
      return { "!": { arg: unair() } };
    }
    if (is("-")) {
      p += 1;
      if (kijk().soort === "num") return lid({ Value: -Number(t[p++].waarde) });
      return { neg: { arg: unair() } };
    }
    return lid(primair());
  };
  const lijst = (sluit) => {
    const items = [];
    while (!is(sluit)) {
      items.push(expr());
      if (!is(sluit)) neem(",");
    }
    neem(sluit);
    return items;
  };
  const lid = (basis) => {
    let e = basis;
    for (;;) {
      if (is(".")) {
        p += 1;
        const naam = ident();
        if (is("(")) {
          p += 1;
          const args = lijst(")");
          if (BINAIRE_METHODEN.has(naam) && args.length === 1) e = { [naam]: { left: e, right: args[0] } };
          else if (naam === "isEmpty" && !args.length) e = { isEmpty: { arg: e } };
          else e = { [naam]: [e, ...args] }; // extensiemethode (ip, decimal, datetime, …)
        } else e = { ".": { left: e, attr: naam } };
        continue;
      }
      if (is("[")) {
        p += 1;
        if (kijk().soort !== "str") fout("verwacht een attribuutnaam tussen aanhalingstekens");
        const attr = ontsnap(t[p++].waarde);
        neem("]");
        e = { ".": { left: e, attr } };
        continue;
      }
      return e;
    }
  };
  const primair = () => {
    const tk = kijk();
    if (tk.soort === "str") {
      p += 1;
      return { Value: ontsnap(tk.waarde) };
    }
    if (tk.soort === "num") {
      p += 1;
      return { Value: Number(tk.waarde) };
    }
    if (is("true") || is("false")) {
      p += 1;
      return { Value: tk.waarde === "true" };
    }
    if (is("(")) {
      p += 1;
      const e = expr();
      neem(")");
      return e;
    }
    if (is("[")) {
      p += 1;
      return { Set: lijst("]") };
    }
    if (is("{")) {
      p += 1;
      const rec = {};
      while (!is("}")) {
        const sleutel = kijk().soort === "str" ? ontsnap(t[p++].waarde) : ident();
        neem(":");
        rec[sleutel] = expr();
        if (!is("}")) neem(",");
      }
      neem("}");
      return { Record: rec };
    }
    if (is("?")) {
      p += 1;
      return { Slot: `?${ident()}` };
    }
    if (tk.soort === "id") {
      if (VARIABELEN.has(tk.waarde) && !is("::", 1)) {
        p += 1;
        return { Var: tk.waarde };
      }
      const naam = pad();
      if (is("::")) {
        neem("::");
        if (kijk().soort !== "str") fout("verwacht een entiteit-id tussen aanhalingstekens");
        return { Value: { __entity: { type: naam, id: ontsnap(t[p++].waarde) } } };
      }
      if (is("(")) {
        p += 1;
        return { [naam]: lijst(")") }; // extensiefunctie: ip("…"), decimal("…")
      }
      fout(`onbekende naam "${naam}"`);
    }
    fout(`onverwacht "${tk.waarde || "einde"}"`);
    return null;
  };

  // ── Policy ──────────────────────────────────────────────────────────────
  const policy = () => {
    const begin = kijk().pos;
    /** @type {Record<string, string|null>} */
    const annotations = {};
    while (is("@")) {
      p += 1;
      const sleutel = ident();
      let waarde = null; // @sleutel zonder waarde
      if (is("(")) {
        p += 1;
        if (kijk().soort !== "str") fout("verwacht een tekst als waarde van de annotatie");
        waarde = ontsnap(t[p++].waarde);
        neem(")");
      }
      if (sleutel in annotations) fout(`annotatie @${sleutel} staat er twee keer`);
      annotations[sleutel] = waarde;
    }
    if (!is("permit") && !is("forbid")) fout(`verwacht permit of forbid, gevonden "${kijk().waarde || "einde"}"`);
    const effect = t[p++].waarde;
    neem("(");
    const principal = scopeVar("principal");
    neem(",");
    const action = actieScope();
    neem(",");
    const resource = scopeVar("resource");
    if (is(",")) p += 1; // komma na de scope mag (Cedar 4)
    neem(")");
    const conditions = [];
    while (is("when") || is("unless")) {
      const kind = t[p++].waarde;
      neem("{");
      conditions.push({ kind, body: expr() });
      neem("}");
    }
    const slot = t[p];
    neem(";");
    /** @type {any} */
    const est = { effect, principal, action, resource, conditions };
    // Zoals Cedar zelf (een geordende map): alfabetisch. De volgorde in de tekst staat in de tekst.
    if (Object.keys(annotations).length) est.annotations = Object.fromEntries(Object.entries(annotations).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    return { est, begin, eind: slot.pos + 1 };
  };

  return {
    policySet() {
      const uit = [];
      while (kijk().soort !== "eind") uit.push(policy());
      return uit;
    },
    expressie() {
      const e = expr();
      if (kijk().soort !== "eind") fout(`onverwacht "${kijk().waarde}" na de expressie`);
      return e;
    },
  };
}

/** Een `like`-patroon → de EST-vorm: lijst van {Literal} en "Wildcard". */
function patroon(literal) {
  const binnen = literal.slice(1, -1);
  const delen = [];
  let tekst = "";
  for (let i = 0; i < binnen.length; i++) {
    const c = binnen[i];
    if (c === "\\" && binnen[i + 1] === "*") {
      tekst += "*";
      i += 1;
    } else if (c === "*") {
      if (tekst) delen.push({ Literal: ontsnap(`"${tekst}"`) });
      tekst = "";
      delen.push("Wildcard");
    } else tekst += c;
  }
  if (tekst) delen.push({ Literal: ontsnap(`"${tekst}"`) });
  return delen;
}

/**
 * Een policyset (tekst) → policies met EST en hun letterlijke tekst.
 * @param {string} tekst
 * @returns {{est: any, tekst: string, begin: number, eind: number}[]}
 */
export function leesPolicies(tekst) {
  return parser(tekst)
    .policySet()
    .map((pol) => ({ ...pol, tekst: tekst.slice(pol.begin, pol.eind) }));
}

/** Eén Cedar-expressie (een conditie zonder `when { }`) → EST. */
export function leesExpressie(tekst) {
  return parser(tekst).expressie();
}

export { SLEUTELWOORDEN };
