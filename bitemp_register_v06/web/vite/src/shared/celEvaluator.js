/**
 * celEvaluator.js — Minimale CEL-expressie-evaluator voor afgeleide velden.
 *
 * Ondersteunt de subset van CEL die nodig is voor afgeleide velden:
 *   - String literals:       'tekst' of "tekst"
 *   - Null literal:          null
 *   - Variabele-referenties: Naam.roepnaam  (GEKlassenaam.veldnaam)
 *   - Operators:             +  (string concat)
 *   - Vergelijking:          !=  ==
 *   - Ternary:               cond ? then : else
 *   - Haakjes:               ( ... )
 *
 * Geen eval(), geen Function() — veilige tokenizer + recursive-descent parser.
 */

// ── Tokenizer ───────────────────────────────────────────────────────────

const TokenType = {
  STRING: "STRING",
  NULL: "NULL",
  IDENT: "IDENT",
  DOT: "DOT",
  PLUS: "PLUS",
  EQ: "EQ",       // ==
  NEQ: "NEQ",     // !=
  QUESTION: "QUESTION",
  COLON: "COLON",
  LPAREN: "LPAREN",
  RPAREN: "RPAREN",
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
    // Two-char operators
    if (ch === "!" && expr[i + 1] === "=") { tokens.push({ type: TokenType.NEQ }); i += 2; continue; }
    if (ch === "=" && expr[i + 1] === "=") { tokens.push({ type: TokenType.EQ }); i += 2; continue; }
    // Single-char tokens
    if (ch === "+") { tokens.push({ type: TokenType.PLUS }); i++; continue; }
    if (ch === "?") { tokens.push({ type: TokenType.QUESTION }); i++; continue; }
    if (ch === ":") { tokens.push({ type: TokenType.COLON }); i++; continue; }
    if (ch === "(") { tokens.push({ type: TokenType.LPAREN }); i++; continue; }
    if (ch === ")") { tokens.push({ type: TokenType.RPAREN }); i++; continue; }
    if (ch === ".") { tokens.push({ type: TokenType.DOT }); i++; continue; }
    // Identifier or keyword (null)
    if (/[A-Za-z_]/.test(ch)) {
      let ident = "";
      while (i < expr.length && /[A-Za-z0-9_]/.test(expr[i])) { ident += expr[i]; i++; }
      if (ident === "null") { tokens.push({ type: TokenType.NULL }); }
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

  // Ternary: expr = comparison ('?' expr ':' expr)?
  function parseExpr() {
    let node = parseAddition();
    if (peek().type === TokenType.QUESTION) {
      advance(); // ?
      const thenNode = parseExpr();
      expect(TokenType.COLON);
      const elseNode = parseExpr();
      return { type: "ternary", cond: node, then: thenNode, else: elseNode };
    }
    return node;
  }

  // Addition (string concat): addition = comparison ('+' comparison)*
  function parseAddition() {
    let left = parseComparison();
    while (peek().type === TokenType.PLUS) {
      advance();
      const right = parseComparison();
      left = { type: "add", left, right };
    }
    return left;
  }

  // Comparison: primary ('==' | '!=') primary
  function parseComparison() {
    let left = parsePrimary();
    if (peek().type === TokenType.EQ) {
      advance();
      const right = parsePrimary();
      return { type: "eq", left, right };
    }
    if (peek().type === TokenType.NEQ) {
      advance();
      const right = parsePrimary();
      return { type: "neq", left, right };
    }
    return left;
  }

  // Primary: literal | ident(.ident)* | '(' expr ')'
  function parsePrimary() {
    const t = peek();
    if (t.type === TokenType.STRING) { advance(); return { type: "string", value: t.value }; }
    if (t.type === TokenType.NULL) { advance(); return { type: "null" }; }
    if (t.type === TokenType.LPAREN) {
      advance();
      const inner = parseExpr();
      expect(TokenType.RPAREN);
      return inner;
    }
    if (t.type === TokenType.IDENT) {
      advance();
      const parts = [t.value];
      while (peek().type === TokenType.DOT) {
        advance();
        parts.push(expect(TokenType.IDENT).value);
      }
      return { type: "ref", parts };
    }
    throw new Error(`Onverwacht token: ${t.type}`);
  }

  return { parseExpr };
}

// ── Evaluator ──────────────────────────────────────────────────────────

function evaluate(node, ctx) {
  switch (node.type) {
    case "string": return node.value;
    case "null": return null;
    case "ref": {
      // Navigeer door de context: Naam.roepnaam → ctx["Naam"]["roepnaam"]
      let val = ctx;
      for (const part of node.parts) {
        if (val == null) return null;
        val = val[part];
      }
      return val ?? null;
    }
    case "add": {
      const l = evaluate(node.left, ctx);
      const r = evaluate(node.right, ctx);
      if (l == null || r == null) return (l ?? "") + (r ?? "");
      return String(l) + String(r);
    }
    case "eq": return evaluate(node.left, ctx) === evaluate(node.right, ctx);
    case "neq": return evaluate(node.left, ctx) !== evaluate(node.right, ctx);
    case "ternary": {
      const cond = evaluate(node.cond, ctx);
      return cond ? evaluate(node.then, ctx) : evaluate(node.else, ctx);
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
    // Gebruik de klassenaam als key (bijv. "Naam", niet "NatuurlijkPersoon_Naam")
    const meta = typeMetaByTypenaam?.[group.doeltype];
    const klassenaam = meta?.klassenaam || group.doeltype;
    // Neem het eerste actieve item (zonder afvoer)
    const items = Array.isArray(group.items) ? group.items : [];
    const actiefItem = items.find((item) => !item.afvoer) || items[0] || null;
    if (actiefItem) {
      ctx[klassenaam] = actiefItem;
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

  const ctx = {};
  if (typeMeta?.ge_subtype === "hub") {
    const onderliggende = Array.isArray(typeMeta.onderliggende) ? typeMeta.onderliggende : [];
    const dataChild = onderliggende.find((c) => {
      const childMeta = typeMetaByTypenaam?.[c.doeltype];
      return childMeta?.ge_subtype === "data";
    });
    if (dataChild) {
      const dataMeta = typeMetaByTypenaam[dataChild.doeltype];
      ctx[dataMeta?.klassenaam || dataChild.doeltype] = item;
    }
  } else {
    ctx[typeMeta?.klassenaam || "item"] = item;
  }

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
