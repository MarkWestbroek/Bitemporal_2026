// @ts-check
/**
 * celOmzetting — CEL → JUEL en CEL → FEEL (besluit Mark 12-11-2026).
 *
 * CEL is de expressietaal in het model, ook voor de conditie op een sequence
 * flow (BPMN) en de invoerexpressie van een beslistabel (DMN). JUEL en FEEL
 * zijn uitvoer: de schrijvers (`bpmnXmlSchrijver`, `dmnXmlSchrijver`) zetten
 * om bij de export naar de engine. Ontwerp: docs/plans/2026-11-12 Simulatie
 * van BPMN en DMN met cm-objecten §3.6.
 *
 * Werkt op de boom van `parseCelExpressie`. Wat de doeltaal niet kan
 * uitdrukken geeft `fout` terug: de schrijver maakt er een melding van, geen
 * stille benadering.
 *
 * Overgang: een conditie die al met `${` begint is nog JUEL en gaat ongewijzigd
 * door (`isJuel`); `leesAlsCel` haalt de haakjes eraf voor wie CEL wil lezen
 * (de simulatie).
 *
 * Puur.
 */
import { parseCelExpressie } from "../shared/celEvaluator.js";

/** Begint de tekst met `${` of `#{`: nog JUEL. */
export const isJuel = (tekst) => /^\s*[$#]\{/.test(String(tekst || ""));

/**
 * De CEL-tekst van een conditie: `${a == 'b'}` → `a == 'b'`; CEL blijft CEL.
 * @param {string} tekst
 */
export function leesAlsCel(tekst) {
  const m = /^\s*[$#]\{([\s\S]*)\}\s*$/.exec(String(tekst || ""));
  return (m ? m[1] : String(tekst || "")).trim();
}

/**
 * De variabelen waar een expressie van afhangt: de eerste naam van elk pad,
 * zonder de lambda-variabelen. De evaluator geeft bij een onbekende variabele
 * stil null; wie dat wil weten (de simulatie: een gat) vraagt het hier.
 * @param {any} boom
 * @returns {Set<string>}
 */
export function vrijeVariabelen(boom) {
  const uit = new Set();
  const loop = (n, gebonden) => {
    if (!n || typeof n !== "object") return;
    if (n.type === "ident") {
      if (!gebonden.has(n.name)) uit.add(n.name);
      return;
    }
    if (n.type === "methodcall") {
      loop(n.obj, gebonden);
      if (n.varName) loop(n.body, new Set([...gebonden, n.varName]));
      for (const a of n.args || []) loop(a, gebonden);
      return;
    }
    for (const k of ["obj", "key", "left", "right", "expr", "cond", "then", "else"]) loop(n[k], gebonden);
    for (const a of n.args || []) loop(a, gebonden);
  };
  loop(boom, new Set());
  return uit;
}

class Onvertaalbaar extends Error {}
const kanNiet = (wat, taal) => {
  throw new Onvertaalbaar(`${wat} is niet uit te drukken in ${taal}`);
};

// Bindingssterkte, laag → hoog; een kind met een lagere sterkte dan de plek vraagt krijgt haakjes.
const STERKTE = { ternary: 1, or: 2, and: 3, eq: 4, neq: 4, gt: 4, gte: 4, lt: 4, lte: 4, add: 5, not: 6 };
const sterkte = (n) => STERKTE[n.type] || 7;
const VERGELIJK = { eq: "==", neq: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=" };

function juel(n, min = 0) {
  const haak = (s) => (sterkte(n) < min ? `(${s})` : s);
  switch (n.type) {
    case "string":
      return `'${n.value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
    case "number":
      return String(n.value);
    case "bool":
      return String(n.value);
    case "null":
      return "null";
    case "ident":
      return n.name;
    case "field":
      return `${juel(n.obj, 7)}.${n.field}`;
    case "index":
      return `${juel(n.obj, 7)}[${juel(n.key)}]`;
    case "not":
      return haak(`!${juel(n.expr, 6)}`);
    case "add":
      return haak(`${juel(n.left, 5)} + ${juel(n.right, 6)}`);
    case "and":
      return haak(`${juel(n.left, 3)} && ${juel(n.right, 4)}`);
    case "or":
      return haak(`${juel(n.left, 2)} || ${juel(n.right, 3)}`);
    case "ternary":
      return haak(`${juel(n.cond, 2)} ? ${juel(n.then, 1)} : ${juel(n.else, 1)}`);
    case "methodcall":
      return kanNiet(`.${n.method}(…)`, "JUEL");
    case "funcall":
      return kanNiet(`${n.name}(…)`, "JUEL");
    default:
      if (VERGELIJK[n.type]) return haak(`${juel(n.left, 5)} ${VERGELIJK[n.type]} ${juel(n.right, 5)}`);
      return kanNiet(`"${n.type}"`, "JUEL");
  }
}

const FEEL_VERGELIJK = { ...VERGELIJK, eq: "=" };

/** @param {any} n @param {number} min @param {Record<string, string>} namen - lambda-variabele → naam in FEEL */
function feel(n, min = 0, namen = {}) {
  const haak = (s) => (sterkte(n) < min ? `(${s})` : s);
  // some/every/if/for binden het zwakst: binnen een andere expressie altijd tussen haakjes.
  const zwak = (s) => (min > 0 ? `(${s})` : s);
  const f = (kind, m = 0, nm = namen) => feel(kind, m, nm);
  switch (n.type) {
    case "string":
      return `"${n.value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    case "number":
      return String(n.value);
    case "bool":
      return String(n.value);
    case "null":
      return "null";
    case "ident":
      return namen[n.name] || n.name;
    case "field":
      return `${f(n.obj, 7)}.${n.field}`;
    case "index":
      // FEEL telt vanaf 1.
      if (n.key.type === "number" && Number.isInteger(n.key.value) && n.key.value >= 0) return `${f(n.obj, 7)}[${n.key.value + 1}]`;
      return kanNiet("een index die geen vast getal is", "FEEL");
    case "not":
      return `not(${f(n.expr)})`;
    case "add":
      return haak(`${f(n.left, 5)} + ${f(n.right, 6)}`);
    case "and":
      return haak(`${f(n.left, 3)} and ${f(n.right, 4)}`);
    case "or":
      return haak(`${f(n.left, 2)} or ${f(n.right, 3)}`);
    case "ternary":
      return zwak(`if ${f(n.cond, 2)} then ${f(n.then, 2)} else ${f(n.else, 2)}`);
    case "methodcall": {
      const lijst = () => f(n.obj, 7);
      if (n.method === "exists") return zwak(`some ${n.varName} in ${lijst()} satisfies ${f(n.body, 2)}`);
      if (n.method === "all") return zwak(`every ${n.varName} in ${lijst()} satisfies ${f(n.body, 2)}`);
      if (n.method === "map") return zwak(`for ${n.varName} in ${lijst()} return ${f(n.body, 2)}`);
      if (n.method === "filter") return `${lijst()}[${feel(n.body, 0, { ...namen, [n.varName]: "item" })}]`;
      if (n.method === "size" && !(n.args || []).length) return `count(${f(n.obj)})`;
      return kanNiet(`.${n.method}(…)`, "FEEL");
    }
    case "funcall":
      if (n.name === "size" && n.args.length === 1) return `count(${f(n.args[0])})`;
      if (n.name === "string" && n.args.length === 1) return `string(${f(n.args[0])})`;
      if (n.name === "int" && n.args.length === 1) return `number(${f(n.args[0])})`;
      return kanNiet(`${n.name}(…)`, "FEEL");
    default:
      if (FEEL_VERGELIJK[n.type]) return haak(`${f(n.left, 5)} ${FEEL_VERGELIJK[n.type]} ${f(n.right, 5)}`);
      return kanNiet(`"${n.type}"`, "FEEL");
  }
}

function zetOm(expressie, schrijf) {
  let boom;
  try {
    boom = parseCelExpressie(String(expressie || ""));
  } catch (e) {
    return { tekst: null, fout: `geen geldige CEL: ${e.message}`, geenCel: true };
  }
  try {
    return { tekst: schrijf(boom), fout: null };
  } catch (e) {
    if (e instanceof Onvertaalbaar) return { tekst: null, fout: e.message };
    throw e;
  }
}

/**
 * CEL → JUEL, met `${…}` eromheen.
 * @param {string} expressie
 * @returns {{tekst: string|null, fout: string|null, geenCel?: boolean}}
 */
export const celNaarJuel = (expressie) => zetOm(expressie, (boom) => `\${${juel(boom)}}`);

/**
 * CEL → FEEL.
 * @param {string} expressie
 * @returns {{tekst: string|null, fout: string|null, geenCel?: boolean}}
 */
export const celNaarFeel = (expressie) => zetOm(expressie, (boom) => feel(boom));
