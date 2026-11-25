// @ts-check
/**
 * cedarGraaf — **lezer**: de policies van een Cedar-model (hun EST) als brongraaf, voor de regelset
 * "Cedar → Toegangsspraak" (zie docs/TRANSFORMATIES.md §3 en §8.3).
 *
 * De syntax zit in lezer.js; dit bestand legt elke policy uit elkaar in de begrippen van Cedar zelf.
 * Wat een onderdeel in Toegangsspraak wordt staat hier níet: dat is de regelset.
 *
 * Knopen (`aard`):
 *
 *   beleid      het geheel
 *   policy      effect permit/forbid, `nooit` bij `when { false }` / `unless { true }`
 *   scope       rol principal/resource; `op` All, ==, in, is (met `cedarType`, `entiteit`, `inEntiteit`)
 *   actie       één per actie in de scope (`uid`, `woord` uit de woordenschat); `alle` bij All,
 *               `groep` bij `in` één actiegroep
 *   conditie    één toets uit `when`, uit elkaar gelegd op `&&`. `vorm` is de Cedar-vorm:
 *               ==, !=, <, <=, >, >=, contains, containsAny, eenVan (`[…].contains(x)`), has, !has,
 *               like (`likeSoort` begin/eind/in), entiteit (`resource == T::"x"`), unless, anders. `var` principal/resource/
 *               context, `attr` het pad (`a.b`), `waarde` de letterlijke waarde (getypeerd),
 *               `rechts` een tweede pad, `woorden` de woorden van het attribuut (uit de woordenschat)
 *   conditiegroep  `||` (logica of) en een `&&` binnen een of (logica en)
 *
 * Verbindingen (`aard`): policy, principal, resource, actie, als, lid.
 *
 * Puur.
 */
import { expressieTekst } from "./schrijver.js";
import { attribuutWoorden, lokaal } from "./woordenschat.js";

const VARS = ["principal", "resource", "context"];
const VERGELIJK = ["==", "!=", "<", "<=", ">", ">="];

/** `{"&&": …}` → de losse delen, van links naar rechts. */
const plat = (e, op) => (e && e[op] ? [...plat(e[op].left, op), ...plat(e[op].right, op)] : [e]);

/** Een pad op een variabele (`resource.a.b`) → { var, attr: "a.b" }, of null. */
function pad(e) {
  const delen = [];
  let x = e;
  while (x && x["."]) {
    delen.unshift(x["."].attr);
    x = x["."].left;
  }
  return x?.Var && VARS.includes(x.Var) && delen.length ? { var: x.Var, attr: delen.join(".") } : null;
}

/** Een letterlijke waarde → getypeerd zoals graaf.js van Toegangsspraak (tekst, getal, boolean), of undefined. */
function literal(e) {
  if (!e || !("Value" in e)) return undefined;
  const v = e.Value;
  if (typeof v === "string") return { letterlijk: v };
  if (typeof v === "number" || typeof v === "boolean") return v;
  return undefined; // entiteit, record: geen eenvoudige waarde
}
const setLiterals = (e) => (Array.isArray(e?.Set) ? e.Set.map(literal) : null);

/**
 * @param {{naam: string, data: any}[]} policies   policy-elementen met `data.cedar` (EST)
 * @param {ReturnType<import("./woordenschat.js").cedarWoordenschat>} woordenschat
 * @param {{naam?: string}} [opties]
 * @returns {{knopen: any[], groepen: any[], verbindingen: any[]}}
 */
export function cedarNaarGraaf(policies, woordenschat, { naam = "Cedar" } = {}) {
  const knopen = [];
  const verbindingen = [];
  const knoop = (k) => (knopen.push(k), k.id);
  const verbind = (aard, bron, doel, extra = {}) => verbindingen.push({ id: `${aard}:${bron}>${doel}`, aard, bron, doel, label: aard, ...extra });

  knoop({ id: "beleid", aard: "beleid", tekst: naam });

  policies.forEach((p, volgorde) => {
    const est = p.data.cedar;
    const pid = `pol:${p.naam}`;
    const nooit = (est.conditions || []).some((c) => (c.kind === "when" && c.body?.Value === false) || (c.kind === "unless" && c.body?.Value === true));
    knoop({ id: pid, aard: "policy", tekst: p.naam, effect: est.effect, nooit, volgorde });
    verbind("policy", "beleid", pid);

    // ── scope ─────────────────────────────────────────────────────────────
    const typenVan = (s) => (s?.op === "is" ? [s.entity_type] : s?.op === "==" && s.entity ? [s.entity.type] : []);
    for (const rol of ["principal", "resource"]) {
      const s = est[rol] || { op: "All" };
      const id = knoop({
        id: `${pid}/${rol}`,
        aard: "scope",
        rol,
        op: s.op,
        cedarType: s.op === "is" ? s.entity_type : s.entity?.type || "",
        typeWoorden: lokaalWoorden(s.op === "is" ? s.entity_type : s.entity?.type || ""),
        typeTekst: lokaalWoorden(s.op === "is" ? s.entity_type : s.entity?.type || "").join(" "),
        entiteit: s.entity || null,
        inEntiteit: s.in?.entity || null,
        tekst: rol,
      });
      verbind(rol, pid, id);
    }

    // ── acties ────────────────────────────────────────────────────────────
    const a = est.action || { op: "All" };
    const uids = a.op === "==" ? [a.entity] : a.op === "in" && a.entities ? a.entities : [];
    if (a.op === "All") verbind("actie", pid, knoop({ id: `${pid}/actie:alle`, aard: "actie", alle: true, tekst: "alle acties" }));
    else if (a.op === "in" && a.entity) {
      verbind("actie", pid, knoop({ id: `${pid}/actie:groep`, aard: "actie", groep: true, uid: a.entity, tekst: `${a.entity.type}::"${a.entity.id}"` }));
    }
    uids.forEach((uid, i) => {
      const bekend = woordenschat.actieVoorUid(uid);
      verbind("actie", pid, knoop({ id: `${pid}/actie:${i}`, aard: "actie", uid, woord: bekend?.woord || "", bekend: Boolean(bekend), volgorde: i, tekst: `${uid.type}::"${uid.id}"` }));
    });

    // ── condities ─────────────────────────────────────────────────────────
    const principalTypen = typenVan(est.principal).length ? typenVan(est.principal) : woordenschat.principalTypen();
    const resourceTypen = typenVan(est.resource).length ? typenVan(est.resource) : woordenschat.resourceTypen();
    const typenVoorVar = (v) => (v === "principal" ? principalTypen : v === "resource" ? resourceTypen : []);
    const woorden = (p) => (p.var === "context" ? [] : attribuutWoorden(woordenschat, typenVoorVar(p.var), p.attr.split(".")[0]));
    let teller = 0;

    /** Eén toets → conditie-knoop. */
    const conditie = (e) => {
      teller += 1;
      const id = `${pid}/c${teller}`;
      const basis = { id, aard: "conditie", tekst: expressieTekst(e) };
      const k = Object.keys(e || {})[0];
      const v = e?.[k];
      const met = (eig) => {
        const w = eig.waarde;
        const waardeSoort = w && typeof w === "object" && !Array.isArray(w) ? "tekst" : Array.isArray(w) ? "lijst" : typeof w === "number" ? "getal" : typeof w === "boolean" ? "boolean" : "";
        return knoop({ ...basis, ...eig, woordenTekst: (eig.woorden || []).join(" "), waardeSoort, diep: String(eig.attr || "").includes(".") });
      };
      if (k === "contains" || k === "containsAny") {
        const links = pad(v.left);
        if (links && k === "contains" && literal(v.right) !== undefined) return met({ vorm: "contains", ...links, woorden: woorden(links), waarde: literal(v.right) });
        if (links && k === "containsAny" && setLiterals(v.right)?.every((w) => w !== undefined)) return met({ vorm: "containsAny", ...links, woorden: woorden(links), waarde: setLiterals(v.right) });
        const rechts = pad(v.right);
        if (k === "contains" && rechts && setLiterals(v.left)?.every((w) => w !== undefined)) return met({ vorm: "eenVan", ...rechts, woorden: woorden(rechts), waarde: setLiterals(v.left) });
      }
      if (VERGELIJK.includes(k)) {
        const [l, r] = [pad(v.left), pad(v.right)];
        if (l && literal(v.right) !== undefined) return met({ vorm: k, ...l, woorden: woorden(l), waarde: literal(v.right) });
        if (r && literal(v.left) !== undefined) {
          const omgekeerd = { "<": ">", "<=": ">=", ">": "<", ">=": "<=" }[k] || k;
          return met({ vorm: omgekeerd, ...r, woorden: woorden(r), waarde: literal(v.left) });
        }
        if (l && r) return met({ vorm: k, ...l, woorden: woorden(l), rechts: { ...r, woorden: woorden(r) } });
        if (k === "==" && v.left?.Var && v.right?.Value?.__entity) return met({ vorm: "entiteit", var: v.left.Var, entiteit: v.right.Value.__entity });
      }
      if (k === "has" || (k === "!" && v.arg?.has)) {
        const h = k === "has" ? v : v.arg.has;
        const attr = Array.isArray(h.attr) ? h.attr.join(".") : h.attr;
        const doel = h.left?.Var ? { var: h.left.Var, attr } : (() => {
          const p = pad(h.left);
          return p ? { var: p.var, attr: `${p.attr}.${attr}` } : null;
        })();
        if (doel && VARS.includes(doel.var)) return met({ vorm: k === "has" ? "has" : "!has", ...doel, woorden: woorden(doel) });
      }
      if (k === "like") {
        const p = pad(v.left);
        const delen = v.pattern || [];
        const tekst = delen.filter((d) => d !== "Wildcard").map((d) => d.Literal).join("");
        const sterren = delen.map((d) => (d === "Wildcard" ? "*" : "t")).join("").replace(/t+/g, "t");
        const soort = { "t*": "begin", "*t": "eind", "*t*": "in" }[sterren];
        if (p && soort) return met({ vorm: "like", likeSoort: soort, ...p, woorden: woorden(p), waarde: { letterlijk: tekst } });
      }
      return met({ vorm: "anders" });
    };

    /** Een expressie in een of-groep: één toets, of een en-groep. */
    const lid = (e, groepId, logica) => {
      const delen = plat(e, "&&");
      if (delen.length === 1) return verbind("lid", groepId, conditie(e), { logica });
      teller += 1;
      const en = knoop({ id: `${pid}/g${teller}`, aard: "conditiegroep", logica: "en", tekst: expressieTekst(e) });
      verbind("lid", groepId, en, { logica });
      for (const d of delen) verbind("lid", en, d?.["||"] ? ofGroep(d) : conditie(d), { logica: "en" });
    };
    const ofGroep = (e) => {
      teller += 1;
      const id = knoop({ id: `${pid}/g${teller}`, aard: "conditiegroep", logica: "of", tekst: expressieTekst(e) });
      for (const d of plat(e, "||")) lid(d, id, "of");
      return id;
    };

    for (const c of est.conditions || []) {
      if (nooit) break;
      if (c.kind === "unless") {
        teller += 1;
        verbind("als", pid, knoop({ id: `${pid}/c${teller}`, aard: "conditie", vorm: "unless", tekst: expressieTekst(c.body) }));
        continue;
      }
      for (const deel of plat(c.body, "&&")) {
        if (deel?.Value === true) continue;
        verbind("als", pid, deel?.["||"] ? ofGroep(deel) : conditie(deel));
      }
    }
  });

  return { knopen, groepen: [], verbindingen };
}

/** De woorden van een Cedar-type in een zin: `pabc_entiteittype` → ["pabc", "entiteittype"]. */
export function lokaalWoorden(type) {
  return lokaal(type).replace(/[_-]+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/\s+/).filter(Boolean);
}
