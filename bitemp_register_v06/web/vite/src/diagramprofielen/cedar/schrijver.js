// @ts-check
/**
 * schrijver — de JSON-vorm van Cedar (EST) → Cedar-tekst, en een policyset → JSON.
 *
 * Opmaak zoals de PABC-policies van Open FTV (en `cedar format` met inspringing 4): de scope op
 * drie regels, een conditie op eigen regels met `&&` aan het eind van de regel. Een conditie die
 * alleen een waarde is, blijft op één regel (`when { false }`). Wat de lezer las en niet is
 * gewijzigd, schrijft de adapter letterlijk terug (de tekst uit het bestand); deze schrijver is
 * er voor nieuwe en gewijzigde policies. Puur; getest in lezer.test.js.
 */

const FUNCTIES = new Set(["ip", "decimal", "datetime", "duration"]);
const BINAIRE_METHODEN = new Set(["contains", "containsAll", "containsAny", "getTag", "hasTag"]);
const RELATIES = new Set(["==", "!=", "<", "<=", ">", ">=", "in"]);
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Tekst → Cedar-tekstliteral. */
export function citeer(tekst) {
  return `"${String(tekst).replace(/[\\"\n\r\t\0]/g, (c) => ({ "\\": "\\\\", '"': '\\"', "\n": "\\n", "\r": "\\r", "\t": "\\t", "\0": "\\0" })[c])}"`;
}
export const entiteitTekst = (e) => `${e.type}::${citeer(e.id)}`;

/** Voorrang: hoger bindt sterker. */
function voorrang(e) {
  const k = Object.keys(e || {})[0];
  if (k === "if-then-else") return 0;
  if (k === "||") return 1;
  if (k === "&&") return 2;
  if (RELATIES.has(k) || k === "has" || k === "like" || k === "is") return 3;
  if (k === "+" || k === "-") return 4;
  if (k === "*") return 5;
  if (k === "!" || k === "neg") return 6;
  if (k === "Value" && typeof e.Value === "number" && e.Value < 0) return 6;
  return 7;
}

/** EST-expressie → tekst. */
export function expressieTekst(e, min = 0) {
  const k = Object.keys(e || {})[0];
  const v = e[k];
  const sub = (x, m) => expressieTekst(x, m);
  let uit;
  if (k === "Value") {
    if (v && typeof v === "object" && v.__entity) uit = entiteitTekst(v.__entity);
    else if (typeof v === "string") uit = citeer(v);
    else uit = String(v);
  } else if (k === "Var" || k === "Slot") uit = v;
  else if (k === "!") uit = `!${sub(v.arg, 6)}`;
  else if (k === "neg") uit = `-${sub(v.arg, 6)}`;
  else if (k === "||" || k === "&&" || k === "+" || k === "-" || k === "*") {
    const p = voorrang(e);
    uit = `${sub(v.left, p)} ${k} ${sub(v.right, p + 1)}`;
  } else if (RELATIES.has(k)) uit = `${sub(v.left, 4)} ${k} ${sub(v.right, 4)}`;
  else if (k === ".") uit = IDENT.test(v.attr) ? `${sub(v.left, 7)}.${v.attr}` : `${sub(v.left, 7)}[${citeer(v.attr)}]`;
  else if (k === "has") {
    const attrs = Array.isArray(v.attr) ? v.attr : [v.attr];
    const pad = attrs.every((a) => IDENT.test(a)) ? attrs.join(".") : attrs.map(citeer).join(".");
    uit = `${sub(v.left, 4)} has ${pad}`;
  } else if (k === "like") {
    const patroon = v.pattern.map((d) => (d === "Wildcard" ? "*" : citeer(d.Literal).slice(1, -1).replace(/\*/g, "\\*"))).join("");
    uit = `${sub(v.left, 4)} like "${patroon}"`;
  } else if (k === "is") uit = `${sub(v.left, 4)} is ${v.entity_type}${v.in ? ` in ${sub(v.in, 4)}` : ""}`;
  else if (BINAIRE_METHODEN.has(k)) uit = `${sub(v.left, 7)}.${k}(${sub(v.right, 0)})`;
  else if (k === "isEmpty") uit = `${sub(v.arg, 7)}.isEmpty()`;
  else if (k === "if-then-else") uit = `if ${sub(v.if, 0)} then ${sub(v.then, 0)} else ${sub(v.else, 0)}`;
  else if (k === "Set") uit = `[${v.map((x) => sub(x, 0)).join(", ")}]`;
  else if (k === "Record") uit = `{${Object.entries(v).map(([s, x]) => `${IDENT.test(s) ? s : citeer(s)}: ${sub(x, 0)}`).join(", ")}}`;
  else if (Array.isArray(v)) {
    // Extensie: ip("…") als functie, de rest als methode op het eerste argument.
    uit = FUNCTIES.has(k) ? `${k}(${v.map((x) => sub(x, 0)).join(", ")})` : `${sub(v[0], 7)}.${k}(${v.slice(1).map((x) => sub(x, 0)).join(", ")})`;
  } else throw new Error(`onbekende Cedar-expressie: ${k}`);
  return voorrang(e) < min ? `(${uit})` : uit;
}

/** Scope-deel → tekst (`principal is T`, `action in [..]`, …). */
function scopeTekst(naam, s) {
  if (!s || s.op === "All") return naam;
  const doel = (x) => (x.slot ? x.slot : entiteitTekst(x.entity));
  if (s.op === "==") return `${naam} == ${doel(s)}`;
  if (s.op === "in") return s.entities ? `${naam} in [${s.entities.map(entiteitTekst).join(", ")}]` : `${naam} in ${doel(s)}`;
  if (s.op === "is") return `${naam} is ${s.entity_type}${s.in ? ` in ${doel(s.in)}` : ""}`;
  throw new Error(`onbekende scope: ${s.op}`);
}

/** Een `&&`-keten plat (links-associatief), voor één voorwaarde per regel. */
function enDelen(e) {
  return e && e["&&"] ? [...enDelen(e["&&"].left), ...enDelen(e["&&"].right)] : [e];
}

/**
 * EST → Cedar-tekst van één policy (eindigt op `;`, zonder regeleinde).
 * @param {any} est
 * @param {{inspring?: number}} [opties]
 */
export function policyTekst(est, { inspring = 4 } = {}) {
  const ins = " ".repeat(inspring);
  const regels = [];
  for (const [sleutel, waarde] of Object.entries(est.annotations || {})) regels.push(waarde === null || waarde === undefined ? `@${sleutel}` : `@${sleutel}(${citeer(waarde)})`);
  regels.push(`${est.effect} (`);
  regels.push(`${ins}${scopeTekst("principal", est.principal)},`);
  regels.push(`${ins}${scopeTekst("action", est.action)},`);
  regels.push(`${ins}${scopeTekst("resource", est.resource)}`);
  regels.push(")");
  for (const c of est.conditions || []) {
    if (Object.keys(c.body)[0] === "Value") regels.push(`${c.kind} { ${expressieTekst(c.body)} }`);
    else {
      const delen = enDelen(c.body).map((d) => expressieTekst(d, 3));
      regels.push(`${c.kind} {`, `${ins}${delen.join(` &&\n${ins}`)}`, "}");
    }
  }
  return `${regels.join("\n")};`;
}

/**
 * Policies → Cedar JSON policy set (`staticPolicies` per id).
 * @param {{id: string, est: any}[]} policies
 */
export function policySetJson(policies) {
  return { staticPolicies: Object.fromEntries(policies.map((p) => [p.id, p.est])), templates: {}, templateLinks: [] };
}
