/**
 * sjabloon/renderer — Markdown-sjablonen met gaten en lussen, puur (geen DOM).
 *
 * Zie docs/plans/2026-10-09 Documentsjablonen (ontwerpvoorstel). Dezelfde
 * notatie als de publicatie-templates waar het overlapt (veldpatroon en
 * lijstpatroon), maar een eigen kleine implementatie: publicatie (M0) en
 * document (M1) blijven apart (besluit Mark, 09-10).
 *
 *   {{pad}}                       waarde op de context; lijst → ", "-opsomming
 *   {{#if pad}} … {{else}} … {{/if}}      {{#unless pad}} … {{/unless}}
 *   {{#elk lijst type=x richting=uit sorteer=naam}} … {{/elk}}
 *       lus; in de lus is het item de context, met index/eerste/laatste/aantal
 *   {{svg}}                       een functie op de context wordt aangeroepen
 *   {{> naam}}                    deelsjabloon (opties.partials)
 *
 * Paden lopen de scope-keten af (binnen een lus zijn de buitenste velden
 * bereikbaar, bv. {{map.naam}}). Een front matter (--- titel: … ---) wordt
 * gelezen en zelf ook gerenderd; `renderSjabloon` geeft { tekst, meta }.
 */

const TOKEN = /\{\{\s*(#elk|#if|#unless|\/elk|\/if|\/unless|else|>)?\s*([^}]*?)\s*\}\}/g;

/** Front matter afsplitsen: { meta: {k: v}, body }. */
export function splitsFrontMatter(bron) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(bron || "");
  if (!m) return { meta: {}, body: bron || "" };
  const meta = {};
  for (const regel of m[1].split(/\r?\n/)) {
    const i = regel.indexOf(":");
    if (i > 0) meta[regel.slice(0, i).trim()] = regel.slice(i + 1).trim();
  }
  return { meta, body: bron.slice(m[0].length) };
}

/**
 * Blok-tags die alleen op een regel staan ({{#elk …}}, {{/if}}, {{else}}, …)
 * nemen hun regel mee (zoals Handlebars' "standalone"-regel): anders laat
 * elke lus een lege regel achter in het document.
 */
const STANDALONE = /^[ \t]*(\{\{\s*(?:#elk|#if|#unless|\/elk|\/if|\/unless|else)\b[^}]*\}\})[ \t]*\r?\n/gm;

/** Sjabloontekst → boom van knopen. Gooit bij een niet-gesloten blok. */
export function parseSjabloon(tekst) {
  tekst = String(tekst || "").replace(STANDALONE, "$1");
  const wortel = { type: "blok", kinderen: [] };
  const stapel = [wortel];
  let laatste = 0;
  const top = () => stapel[stapel.length - 1];
  const voegTekst = (t) => {
    if (t) top().kinderen.push({ type: "tekst", tekst: t });
  };
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(tekst))) {
    voegTekst(tekst.slice(laatste, m.index));
    laatste = m.index + m[0].length;
    const [, soort, rest] = m;
    if (!soort) {
      top().kinderen.push({ type: "waarde", pad: rest.trim() });
    } else if (soort === ">") {
      top().kinderen.push({ type: "deel", naam: rest.trim() });
    } else if (soort === "#if" || soort === "#unless") {
      const knoop = { type: soort.slice(1), pad: rest.trim(), dan: [], anders: [], _tak: "dan" };
      top().kinderen.push(knoop);
      stapel.push({ type: "blok", kinderen: knoop.dan, eigenaar: knoop });
    } else if (soort === "else") {
      const eigenaar = top().eigenaar;
      if (!eigenaar || eigenaar._tak !== "dan") throw new Error("{{else}} zonder {{#if}}/{{#unless}}.");
      eigenaar._tak = "anders";
      stapel.pop();
      stapel.push({ type: "blok", kinderen: eigenaar.anders, eigenaar });
    } else if (soort === "#elk") {
      const [pad, ...rest2] = rest.trim().split(/\s+/);
      const params = {};
      for (const p of rest2) {
        const i = p.indexOf("=");
        if (i < 0) params[p] = true;
        else params[p.slice(0, i)] = p.slice(i + 1).replace(/^["']|["']$/g, "");
      }
      const knoop = { type: "elk", pad, params, kinderen: [] };
      top().kinderen.push(knoop);
      stapel.push({ type: "blok", kinderen: knoop.kinderen, eigenaar: knoop });
    } else if (soort === "/elk" || soort === "/if" || soort === "/unless") {
      const eigenaar = top().eigenaar;
      const verwacht = soort.slice(1);
      if (!eigenaar || eigenaar.type !== verwacht) throw new Error(`{{${soort}}} zonder bijpassend begin.`);
      delete eigenaar._tak;
      stapel.pop();
    }
  }
  voegTekst(tekst.slice(laatste));
  if (stapel.length !== 1) throw new Error(`Niet gesloten blok: {{#${top().eigenaar?.type}}}.`);
  return wortel;
}

/** Waarde van een pad in de scope-keten (binnenste eerst). */
export function zoekWaarde(scopes, pad) {
  if (!pad) return undefined;
  if (pad === ".") return scopes[scopes.length - 1];
  const delen = pad.split(".");
  for (let i = scopes.length - 1; i >= 0; i--) {
    const scope = scopes[i];
    if (scope == null || typeof scope !== "object" || !(delen[0] in scope)) continue;
    let w = scope;
    for (const d of delen) {
      if (w == null) return undefined;
      w = typeof w === "function" ? w()[d] : w[d];
    }
    return typeof w === "function" ? w() : w;
  }
  return undefined;
}

/** Een waarde als tekst: lijst → opsomming, object met naam → naam. */
export function naarTekst(w) {
  if (w == null || w === false) return "";
  if (w === true) return "ja";
  if (Array.isArray(w)) return w.map(naarTekst).filter((x) => x !== "").join(", ");
  if (typeof w === "object") return w.naam != null ? String(w.naam) : w.label != null ? String(w.label) : "";
  return String(w);
}

function waar(w) {
  if (w == null || w === false || w === "" || w === 0) return false;
  if (Array.isArray(w)) return w.length > 0;
  return true;
}

/** Filter + sortering van een lus-lijst volgens de params (data, geen code). */
export function filterLijst(lijst, params) {
  let items = Array.isArray(lijst) ? lijst.slice() : lijst && typeof lijst === "object" ? Object.values(lijst) : [];
  for (const [k, v] of Object.entries(params || {})) {
    if (k === "sorteer" || k === "omgekeerd" || k === "max") continue;
    items = items.filter((item) => {
      if (item == null || typeof item !== "object") return false;
      const w = item[k];
      if (w == null) return false;
      if (typeof w === "object") return w.id === v || w.naam === v || w.label === v;
      return String(w) === String(v);
    });
  }
  if (params?.sorteer) {
    const veld = params.sorteer;
    const lees = (it) => {
      const w = it?.[veld];
      return typeof w === "object" && w ? w.naam ?? w.label ?? "" : w ?? "";
    };
    items.sort((a, b) => {
      const x = lees(a);
      const y = lees(b);
      if (typeof x === "number" && typeof y === "number") return x - y;
      return String(x).localeCompare(String(y), "nl", { numeric: true, sensitivity: "base" });
    });
  }
  if (params?.omgekeerd) items.reverse();
  if (params?.max) items = items.slice(0, Number(params.max) || items.length);
  return items;
}

function renderKnopen(knopen, scopes, opties, diepte) {
  if (diepte > 50) throw new Error("Sjabloon te diep genest (deelsjabloon dat zichzelf aanroept?).");
  let uit = "";
  for (const k of knopen) {
    if (k.type === "tekst") uit += k.tekst;
    else if (k.type === "waarde") uit += naarTekst(zoekWaarde(scopes, k.pad));
    else if (k.type === "if") uit += renderKnopen(waar(zoekWaarde(scopes, k.pad)) ? k.dan : k.anders, scopes, opties, diepte + 1);
    else if (k.type === "unless") uit += renderKnopen(waar(zoekWaarde(scopes, k.pad)) ? k.anders : k.dan, scopes, opties, diepte + 1);
    else if (k.type === "elk") {
      const items = filterLijst(zoekWaarde(scopes, k.pad), k.params);
      items.forEach((item, i) => {
        const lusScope = {
          ...(item && typeof item === "object" ? item : { waarde: item }),
          index: i + 1,
          eerste: i === 0,
          laatste: i === items.length - 1,
          aantal: items.length,
        };
        uit += renderKnopen(k.kinderen, [...scopes, lusScope], opties, diepte + 1);
      });
    } else if (k.type === "deel") {
      const deel = opties?.partials?.[k.naam];
      if (deel == null) throw new Error(`Onbekend deelsjabloon "${k.naam}".`);
      uit += renderKnopen(parseSjabloon(deel).kinderen, scopes, opties, diepte + 1);
    }
  }
  return uit;
}

/**
 * Render een sjabloon op een context.
 * @param {string} sjabloon  — tekst, optioneel met front matter
 * @param {Object} context   — zie sjabloon/context.js
 * @param {{partials?: Record<string,string>}} [opties]
 * @returns {{ tekst: string, meta: Record<string,string> }}
 */
export function renderSjabloon(sjabloon, context, opties = {}) {
  const { meta, body } = splitsFrontMatter(sjabloon);
  const scopes = [context || {}];
  const metaUit = {};
  for (const [k, v] of Object.entries(meta)) metaUit[k] = renderKnopen(parseSjabloon(v).kinderen, scopes, opties, 0);
  const tekst = renderKnopen(parseSjabloon(body).kinderen, scopes, opties, 0);
  return { tekst, meta: metaUit };
}
