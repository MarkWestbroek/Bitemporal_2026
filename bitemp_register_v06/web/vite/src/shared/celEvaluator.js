/**
 * celEvaluator.js — CEL-expressie-evaluator voor afgeleide velden.
 *
 * Ondersteunde CEL-subset:
 *   - Literals:          string ('...' / "..."), number, true, false, null
 *   - Variabelen:        ident, ident.veld, geneste.paden
 *   - Operatoren:        +, ==, !=, >, >=, <, <=, &&, ||, !
 *   - Ternary:           cond ? then : else
 *   - Lijstmethoden:     list.filter(x, pred), list.map(x, expr),
 *                        list.exists(x, pred), list.all(x, pred), list.size()
 *   - Indexering:        list[n]
 *   - Ingebouwde func:   string(val), size(val)
 *   - Haakjes:           ( expr )
 *
 * Geen eval(), geen Function() — veilige tokenizer + recursive-descent parser.
 */

import { safeArray, platSlaHubItems } from "./schemaUtils.js";

// ── Tokenizer ───────────────────────────────────────────────────────────

const TokenType = {
  STRING: "STRING",
  NUMBER: "NUMBER",
  NULL: "NULL",
  TRUE: "TRUE",
  FALSE: "FALSE",
  IDENT: "IDENT",
  DOT: "DOT",
  PLUS: "PLUS",
  EQ: "EQ",         // ==
  NEQ: "NEQ",       // !=
  GT: "GT",         // >
  GTE: "GTE",       // >=
  LT: "LT",         // <
  LTE: "LTE",       // <=
  AND: "AND",       // &&
  OR: "OR",         // ||
  NOT: "NOT",       // !
  QUESTION: "QUESTION",
  COLON: "COLON",
  LPAREN: "LPAREN",
  RPAREN: "RPAREN",
  LBRACKET: "LBRACKET",
  RBRACKET: "RBRACKET",
  COMMA: "COMMA",
  EOF: "EOF",
};

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    // Whitespace
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") { i++; continue; }
    // String literal
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let str = "";
      i++;
      while (i < expr.length && expr[i] !== quote) {
        if (expr[i] === "\\" && i + 1 < expr.length) { str += expr[i + 1]; i += 2; }
        else { str += expr[i]; i++; }
      }
      i++; // closing quote
      tokens.push({ type: TokenType.STRING, value: str });
      continue;
    }
    // Getal literal (minimale support voor de CEL-subset in de UI)
    if (/[0-9]/.test(ch) || (ch === "-" && /[0-9]/.test(expr[i + 1] || ""))) {
      let num = ch;
      i++;
      while (i < expr.length && /[0-9.]/.test(expr[i])) { num += expr[i]; i++; }
      tokens.push({ type: TokenType.NUMBER, value: Number(num) });
      continue;
    }
    // Two-char operators (check vóór single-char varianten)
    if (ch === "!" && expr[i + 1] === "=") { tokens.push({ type: TokenType.NEQ }); i += 2; continue; }
    if (ch === "=" && expr[i + 1] === "=") { tokens.push({ type: TokenType.EQ }); i += 2; continue; }
    if (ch === "&" && expr[i + 1] === "&") { tokens.push({ type: TokenType.AND }); i += 2; continue; }
    if (ch === "|" && expr[i + 1] === "|") { tokens.push({ type: TokenType.OR }); i += 2; continue; }
    if (ch === ">" && expr[i + 1] === "=") { tokens.push({ type: TokenType.GTE }); i += 2; continue; }
    if (ch === "<" && expr[i + 1] === "=") { tokens.push({ type: TokenType.LTE }); i += 2; continue; }
    // Single-char tokens
    if (ch === "+") { tokens.push({ type: TokenType.PLUS }); i++; continue; }
    if (ch === "!") { tokens.push({ type: TokenType.NOT }); i++; continue; }
    if (ch === ">") { tokens.push({ type: TokenType.GT }); i++; continue; }
    if (ch === "<") { tokens.push({ type: TokenType.LT }); i++; continue; }
    if (ch === "?") { tokens.push({ type: TokenType.QUESTION }); i++; continue; }
    if (ch === ":") { tokens.push({ type: TokenType.COLON }); i++; continue; }
    if (ch === "(") { tokens.push({ type: TokenType.LPAREN }); i++; continue; }
    if (ch === ")") { tokens.push({ type: TokenType.RPAREN }); i++; continue; }
    if (ch === "[") { tokens.push({ type: TokenType.LBRACKET }); i++; continue; }
    if (ch === "]") { tokens.push({ type: TokenType.RBRACKET }); i++; continue; }
    if (ch === ",") { tokens.push({ type: TokenType.COMMA }); i++; continue; }
    if (ch === ".") { tokens.push({ type: TokenType.DOT }); i++; continue; }
    // Identifier or keyword (null/true/false)
    if (/[A-Za-z_]/.test(ch)) {
      let ident = "";
      while (i < expr.length && /[A-Za-z0-9_]/.test(expr[i])) { ident += expr[i]; i++; }
      if (ident === "null") { tokens.push({ type: TokenType.NULL }); }
      else if (ident === "true") { tokens.push({ type: TokenType.TRUE }); }
      else if (ident === "false") { tokens.push({ type: TokenType.FALSE }); }
      else { tokens.push({ type: TokenType.IDENT, value: ident }); }
      continue;
    }
    // Onbekend karakter: skip
    i++;
  }
  tokens.push({ type: TokenType.EOF });
  return tokens;
}

// ── Parser (recursive descent) ─────────────────────────────────────────

function createParser(tokens) {
  let pos = 0;
  const peek = () => tokens[pos] || { type: TokenType.EOF };
  const advance = () => tokens[pos++];
  const expect = (type) => {
    const t = advance();
    if (t.type !== type) throw new Error(`Verwacht ${type}, kreeg ${t.type}`);
    return t;
  };

  // expr = ternary
  function parseExpr() {
    return parseTernary();
  }

  // ternary = or ('?' expr ':' expr)?
  function parseTernary() {
    let node = parseOr();
    if (peek().type === TokenType.QUESTION) {
      advance();
      const thenNode = parseExpr();
      expect(TokenType.COLON);
      const elseNode = parseExpr();
      node = { type: "ternary", cond: node, then: thenNode, else: elseNode };
    }
    return node;
  }

  // or = and ('||' and)*
  function parseOr() {
    let left = parseAnd();
    while (peek().type === TokenType.OR) {
      advance();
      const right = parseAnd();
      left = { type: "or", left, right };
    }
    return left;
  }

  // and = comparison ('&&' comparison)*
  function parseAnd() {
    let left = parseComparison();
    while (peek().type === TokenType.AND) {
      advance();
      const right = parseComparison();
      left = { type: "and", left, right };
    }
    return left;
  }

  // comparison = addition (('==' | '!=' | '>' | '>=' | '<' | '<=') addition)?
  function parseComparison() {
    let left = parseAddition();
    const t = peek();
    if (t.type === TokenType.EQ)  { advance(); return { type: "eq",  left, right: parseAddition() }; }
    if (t.type === TokenType.NEQ) { advance(); return { type: "neq", left, right: parseAddition() }; }
    if (t.type === TokenType.GT)  { advance(); return { type: "gt",  left, right: parseAddition() }; }
    if (t.type === TokenType.GTE) { advance(); return { type: "gte", left, right: parseAddition() }; }
    if (t.type === TokenType.LT)  { advance(); return { type: "lt",  left, right: parseAddition() }; }
    if (t.type === TokenType.LTE) { advance(); return { type: "lte", left, right: parseAddition() }; }
    return left;
  }

  // addition = unary ('+' unary)*
  function parseAddition() {
    let left = parseUnary();
    while (peek().type === TokenType.PLUS) {
      advance();
      const right = parseUnary();
      left = { type: "add", left, right };
    }
    return left;
  }

  // unary = '!' unary | postfix
  function parseUnary() {
    if (peek().type === TokenType.NOT) {
      advance();
      return { type: "not", expr: parseUnary() };
    }
    return parsePostfix();
  }

  // Methoden met lambda als eerste argument (var, body)
  const LAMBDA_METHODEN = new Set(["filter", "map", "exists", "all"]);

  /**
   * parsePostfix — parseer een atoom gevolgd door postfix-operaties:
   *   expr.veld            (veldtoegang)
   *   expr.methode(args)   (methodaanroep: filter/map/exists/all of size etc.)
   *   expr[sleutel]        (indexering)
   */
  function parsePostfix() {
    let node = parseAtom();
    while (true) {
      if (peek().type === TokenType.DOT) {
        advance(); // consume '.'
        const name = expect(TokenType.IDENT).value;
        if (peek().type === TokenType.LPAREN) {
          advance(); // consume '('
          if (LAMBDA_METHODEN.has(name)) {
            // Eerste arg is de lambda-variabele (identifier), dan komma, dan body-expressie
            const varName = expect(TokenType.IDENT).value;
            expect(TokenType.COMMA);
            const body = parseExpr();
            expect(TokenType.RPAREN);
            node = { type: "methodcall", obj: node, method: name, varName, body };
          } else {
            // Gewone methode zonder lambda (bijv. .size())
            const args = [];
            while (peek().type !== TokenType.RPAREN && peek().type !== TokenType.EOF) {
              args.push(parseExpr());
              if (peek().type === TokenType.COMMA) advance();
            }
            expect(TokenType.RPAREN);
            node = { type: "methodcall", obj: node, method: name, args };
          }
        } else {
          node = { type: "field", obj: node, field: name };
        }
      } else if (peek().type === TokenType.LBRACKET) {
        advance(); // consume '['
        const key = parseExpr();
        expect(TokenType.RBRACKET);
        node = { type: "index", obj: node, key };
      } else {
        break;
      }
    }
    return node;
  }

  // primary = literal | ident (funcall?) | '(' expr ')'
  function parseAtom() {
    const t = peek();
    if (t.type === TokenType.STRING) { advance(); return { type: "string", value: t.value }; }
    if (t.type === TokenType.NUMBER) { advance(); return { type: "number", value: t.value }; }
    if (t.type === TokenType.NULL)   { advance(); return { type: "null" }; }
    if (t.type === TokenType.TRUE)   { advance(); return { type: "bool", value: true }; }
    if (t.type === TokenType.FALSE)  { advance(); return { type: "bool", value: false }; }
    if (t.type === TokenType.LPAREN) {
      advance();
      const inner = parseExpr();
      expect(TokenType.RPAREN);
      return inner;
    }
    if (t.type === TokenType.IDENT) {
      advance();
      // Ingebouwde functie-aanroep: string(...), size(...)
      if (peek().type === TokenType.LPAREN) {
        advance();
        const args = [];
        while (peek().type !== TokenType.RPAREN && peek().type !== TokenType.EOF) {
          args.push(parseExpr());
          if (peek().type === TokenType.COMMA) advance();
        }
        expect(TokenType.RPAREN);
        return { type: "funcall", name: t.value, args };
      }
      return { type: "ident", name: t.value };
    }
    throw new Error(`Onverwacht token: ${t.type}`);
  }

  // Alias voor backward-compat (parseUnary roept nu parsePostfix aan)
  function parsePrimary() { return parsePostfix(); }

  return { parseExpr };
}

// ── Evaluator ──────────────────────────────────────────────────────────

function leesWaardeCaseOngevoelig(bron, sleutel) {
  if (bron == null) return undefined;
  if (typeof bron !== "object") return bron[sleutel];
  if (Object.prototype.hasOwnProperty.call(bron, sleutel)) return bron[sleutel];
  const match = Object.keys(bron).find((key) => key.toLowerCase() === String(sleutel).toLowerCase());
  return match ? bron[match] : undefined;
}

function evaluate(node, ctx) {
  switch (node.type) {
    case "string": return node.value;
    case "number": return node.value;
    case "bool":   return node.value;
    case "null":   return null;

    // Enkelvoudige identifier: zoek in context (case-insensitief)
    case "ident": {
      const val = leesWaardeCaseOngevoelig(ctx, node.name);
      return val !== undefined ? val : null;
    }

    // Veldtoegang: evalueer obj, haal daarna het veld op
    case "field": {
      const obj = evaluate(node.obj, ctx);
      if (obj == null || Array.isArray(obj)) return null;
      const val = leesWaardeCaseOngevoelig(obj, node.field);
      return val !== undefined ? val : null;
    }

    // Array-indexering: list[n]
    case "index": {
      const obj = evaluate(node.obj, ctx);
      const key = evaluate(node.key, ctx);
      if (obj == null || key == null) return null;
      if (Array.isArray(obj)) {
        const idx = Number(key);
        return (idx >= 0 && idx < obj.length) ? (obj[idx] ?? null) : null;
      }
      const val = leesWaardeCaseOngevoelig(obj, key);
      return val !== undefined ? val : null;
    }

    // Methodaanroepen: list.filter(x, expr), list.size(), etc.
    case "methodcall": {
      const obj = evaluate(node.obj, ctx);
      switch (node.method) {
        case "size": {
          if (obj == null) return 0;
          if (Array.isArray(obj)) return obj.length;
          if (typeof obj === "string") return obj.length;
          return 0;
        }
        case "filter": {
          if (!Array.isArray(obj)) return [];
          return obj.filter((item) => {
            const innerCtx = { ...ctx, [node.varName]: item };
            return Boolean(evaluate(node.body, innerCtx));
          });
        }
        case "map": {
          if (!Array.isArray(obj)) return [];
          return obj.map((item) => {
            const innerCtx = { ...ctx, [node.varName]: item };
            return evaluate(node.body, innerCtx);
          });
        }
        case "exists": {
          if (!Array.isArray(obj)) return false;
          return obj.some((item) => {
            const innerCtx = { ...ctx, [node.varName]: item };
            return Boolean(evaluate(node.body, innerCtx));
          });
        }
        case "all": {
          if (!Array.isArray(obj)) return true;
          return obj.every((item) => {
            const innerCtx = { ...ctx, [node.varName]: item };
            return Boolean(evaluate(node.body, innerCtx));
          });
        }
        default:
          return null;
      }
    }

    // Ingebouwde functies: string(val), size(val)
    case "funcall": {
      const { name, args } = node;
      if (name === "string") {
        const val = evaluate(args[0], ctx);
        return val == null ? "" : String(val);
      }
      if (name === "size") {
        const val = evaluate(args[0], ctx);
        if (val == null) return 0;
        if (Array.isArray(val) || typeof val === "string") return val.length;
        return 0;
      }
      if (name === "int") {
        const val = evaluate(args[0], ctx);
        return val == null ? 0 : parseInt(String(val), 10);
      }
      return null;
    }

    // Rekenkundige en logische operatoren
    case "add": {
      const l = evaluate(node.left, ctx);
      const r = evaluate(node.right, ctx);
      if (l == null || r == null) return (l ?? "") + (r ?? "");
      return String(l) + String(r);
    }
    case "eq":  return evaluate(node.left, ctx) === evaluate(node.right, ctx);
    case "neq": return evaluate(node.left, ctx) !== evaluate(node.right, ctx);
    case "gt":  return evaluate(node.left, ctx) >   evaluate(node.right, ctx);
    case "gte": return evaluate(node.left, ctx) >=  evaluate(node.right, ctx);
    case "lt":  return evaluate(node.left, ctx) <   evaluate(node.right, ctx);
    case "lte": return evaluate(node.left, ctx) <=  evaluate(node.right, ctx);
    case "and": return Boolean(evaluate(node.left, ctx)) && Boolean(evaluate(node.right, ctx));
    case "or":  return Boolean(evaluate(node.left, ctx)) || Boolean(evaluate(node.right, ctx));
    case "not": return !Boolean(evaluate(node.expr, ctx));
    case "ternary": {
      const cond = evaluate(node.cond, ctx);
      return cond ? evaluate(node.then, ctx) : evaluate(node.else, ctx);
    }

    // Backward-compat: oud ref-knooppunt (gegenereerd door versies vóór postfix-refactor)
    case "ref": {
      let val = ctx;
      for (const part of node.parts) {
        if (val == null) return null;
        val = leesWaardeCaseOngevoelig(val, part);
      }
      return val ?? null;
    }

    default:
      return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Evalueer een CEL-expressie met de gegeven context.
 *
 * @param {string} expressie - De CEL-expressie (bijv. "Naam.roepnaam != null ? Naam.roepnaam : Naam.voorletters")
 * @param {Object} ctx - Context-object, bijv. { Naam: { roepnaam: "Mark", voorletters: "M.W.", achternaam: "de Vries" } }
 * @returns {*} Het resultaat van de evaluatie, of null bij een fout.
 */
export function evalueerCelExpressie(expressie, ctx) {
  try {
    const tokens = tokenize(expressie);
    const parser = createParser(tokens);
    const ast = parser.parseExpr();
    return evaluate(ast, ctx);
  } catch (e) {
    console.warn("[celEvaluator] Fout bij evaluatie:", e.message, { expressie });
    return null;
  }
}

/**
 * Bouw een CEL-context op voor entiteit-niveau afgeleide velden.
 *
 * Zoekt in de childGroups naar GE's die matchen op klassenaam (bijv. "Naam")
 * en haalt de actieve hub-data velden op.
 *
 * @param {Array} childGroups - De onderliggende GE-groepen van de entiteit.
 * @param {Object} typeMetaByTypenaam - Map van typenaam → schema metadata.
 * @returns {Object} Context-object voor CEL-evaluatie, bijv. { Naam: { roepnaam: "Mark", ... } }
 */
export function bouwCelContext(childGroups, typeMetaByTypenaam) {
  const ctx = {};
  for (const group of childGroups) {
    const meta = typeMetaByTypenaam?.[group.doeltype];
    const klassenaam = meta?.klassenaam || group.doeltype;
    const items = Array.isArray(group.items) ? group.items : [];
    // Actieve items: zonder afvoer
    const actiefItems = items.filter((item) => !item.afvoer);
    const actiefItem = actiefItems[0] || items[0] || null;

    // Enkelvoudige toegang via klassenaam (bestaand gedrag, backward-compat)
    if (actiefItem) {
      ctx[klassenaam] = actiefItem;
    }

    // Meervoudige lijsttoegang via rolnaam — maakt .filter(x, ...) mogelijk
    // in CEL-expressies voor meervoudige GE's (bijv. Trefwoordtaalvarianten.filter(...))
    if (group.rolnaam) {
      ctx[group.rolnaam] = actiefItems.length > 0 ? actiefItems : items;
    }
  }
  return ctx;
}

/**
 * Evalueer weergaveVelden voor een GE/relatie item.
 *
 * Bouwt de CEL-context op basis van het item en het type:
 * - Hub-types: de _Data child's klassenaam wordt als context-key gebruikt
 *   (het platgeslagen item bevat de data-velden direct).
 * - Overige GE's/relaties: de eigen klassenaam wordt als key gebruikt.
 *
 * @param {Array} afgeleideVeldenDefs - Afgeleide-velden definities (uit typeMeta.afgeleideVelden).
 * @param {Object} item - Het (platgeslagen) GE/relatie item.
 * @param {Object} typeMeta - De TypeMeta van het GE/relatie type.
 * @param {Object} typeMetaByTypenaam - Map van typenaam → schema metadata.
 * @returns {string[]} Array van geëvalueerde isWeergaveVeld-waarden (alleen niet-lege).
 */
export function evalueerWeergaveVeldenVoorItem(afgeleideVeldenDefs, item, typeMeta, typeMetaByTypenaam) {
  if (!afgeleideVeldenDefs || afgeleideVeldenDefs.length === 0 || !item) return [];
  const weergaveVelden = afgeleideVeldenDefs.filter((av) => av.isWeergaveVeld || av.weergaveVeld);
  if (weergaveVelden.length === 0) return [];

  // GE/relatie-items zijn in de UI meestal al platgeslagen; exposeer hun velden
  // daarom ook direct op root-niveau zodat expressies als `bsn + ...` meteen werken.
  const ctx = { item };
  if (item && typeof item === "object") {
    for (const [key, value] of Object.entries(item)) {
      if (key != null && String(key).trim() !== "") {
        ctx[String(key)] = value;
      }
    }
  }

  const voegAliasToe = (alias) => {
    if (alias != null && String(alias).trim() !== "") {
      ctx[String(alias)] = item;
    }
  };

  if (typeMeta?.ge_subtype === "hub") {
    const onderliggende = Array.isArray(typeMeta.onderliggende) ? typeMeta.onderliggende : [];
    const dataChild = onderliggende.find((c) => {
      const childMeta = typeMetaByTypenaam?.[c.doeltype];
      return childMeta?.ge_subtype === "data";
    });
    if (dataChild) {
      const dataMeta = typeMetaByTypenaam[dataChild.doeltype];
      voegAliasToe(dataMeta?.klassenaam);
      voegAliasToe(dataChild.doeltype);
      voegAliasToe(typeMeta?.klassenaam ? `${typeMeta.klassenaam}_Data` : "");
      const strippedDoeltype = String(dataChild.doeltype || "").replace(/^[^_]+_/, "");
      voegAliasToe(strippedDoeltype);
    }
  }

  voegAliasToe(typeMeta?.klassenaam || "item");
  voegAliasToe(typeMeta?.typenaam);
  voegAliasToe(typeMeta?.klassenaam ? `${typeMeta.klassenaam}_Data` : "");

  const result = [];
  for (const av of weergaveVelden) {
    if (av.afleidingsregelTaal === "cel" && av.afleidingsregel) {
      const waarde = evalueerCelExpressie(av.afleidingsregel, ctx);
      if (waarde != null && String(waarde).trim() !== "") {
        result.push(String(waarde));
      }
    }
  }
  return result;
}

/**
 * Berekent de weergaveveld-tekst voor een entiteit op basis van afgeleide velden.
 *
 * Gedeelde helper — wordt gebruikt door RepresentatieTabel (lijst-kolom),
 * NieuwEntiteitPagina (secondaire dropdown-labels) en IndexSchemaPage (idem).
 *
 * @param {Object} entity - Het entiteitsrecord incl. geneste GE-kinderen (van /full/ endpoint).
 * @param {Object} typeMeta - TypeMeta van het entiteitstype.
 * @param {Object} typeMetaByTypenaam - Map typenaam → TypeMeta.
 * @returns {string} Weergave-tekst, of "" als geen weergaveveld beschikbaar is.
 */
export function berekenWeergaveveld(entity, typeMeta, typeMetaByTypenaam) {
  const afgVelden = safeArray(typeMeta?.afgeleideVelden)
    .filter((av) => av.isWeergaveVeld || av.weergaveVeld);
  if (afgVelden.length === 0 || !entity) return "";

  const onderliggende = safeArray(typeMeta?.onderliggende);
  const childGroups = onderliggende.map((child) => {
    const childMeta = typeMetaByTypenaam?.[child.doeltype];
    const rawItems = safeArray(entity[child.jsonRolnaam] || entity[child.rolnaam]);
    const items = platSlaHubItems(rawItems, childMeta, typeMetaByTypenaam);
    return { doeltype: child.doeltype, rolnaam: child.rolnaam, items, typeMeta: childMeta };
  });

  const ctx = bouwCelContext(childGroups, typeMetaByTypenaam);
  return afgVelden
    .map((av) => {
      if (av.afleidingsregelTaal === "cel" && av.afleidingsregel) {
        return evalueerCelExpressie(av.afleidingsregel, ctx);
      }
      return null;
    })
    .filter((v) => v != null && String(v).trim() !== "")
    .join(" | ");
}
