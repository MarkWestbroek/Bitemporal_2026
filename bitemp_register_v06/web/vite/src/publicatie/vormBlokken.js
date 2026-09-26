/**
 * vormBlokken.js — WEERGAVEVORMEN in een detail-template van een WeergaveDefinitie (ontwerp
 * "Invoersoort en vorm", weergavekant). Naast {{veldpad}} en {{#if}} kent het template:
 *
 *   {{#vorm image-map producten.CG_laag}}
 *   { "image": "/viz/react/voorbeelden/cg-lagen-utility.svg", "areas": [ … ] }
 *   {{/vorm}}
 *
 *   {{vorm chips initiatief_api_standaarden.apistandaard.api_standaard_namen.naam}}
 *
 * Het pad (optioneel) wijst de waarde aan; de JSON tussen de tags is de vormConfig (zelfde
 * schema als in een formulier, plus paden voor de weergave):
 *   - sleutels op `…Field` zijn RELATIEF aan de items onder het pad (rowField, columnField,
 *     noteField, codeField, labelField);
 *   - sleutels op `…Path` zijn vanaf het record (startPath, endPath);
 *   - `groups[].filter` = { veld: waarde } op de items (bv. rol = Realiseert).
 * Al die paden gaan mee in de GraphQL-query (vormPaden). Puur (vormBlokken.test.js).
 */
import { parseSegment } from "./publicatieUtils.js";

const BLOK = /\{\{#vorm\s+(\S+)(?:\s+([^}]+?))?\s*\}\}([\s\S]*?)\{\{\/vorm\}\}|\{\{vorm\s+(\S+)(?:\s+([^}]+?))?\s*\}\}/g;

/**
 * Template → stukken: { soort: "tekst", tekst } en { soort: "vorm", naam, pad, config, fout }.
 * Ongeldige JSON: config = {} en `fout` gevuld (de pagina toont dan een melding i.p.v. te crashen).
 */
export function splitsVormBlokken(template) {
  const uit = [];
  if (!template) return uit;
  let vanaf = 0;
  let m;
  BLOK.lastIndex = 0;
  while ((m = BLOK.exec(template)) !== null) {
    if (m.index > vanaf) uit.push({ soort: "tekst", tekst: template.slice(vanaf, m.index) });
    const naam = m[1] || m[4];
    const pad = (m[2] || m[5] || "").trim() || null;
    const body = (m[3] || "").trim();
    let config = {};
    let fout = null;
    if (body) {
      try { config = JSON.parse(body); } catch (e) { fout = `vormConfig is geen geldige JSON: ${e.message}`; }
    }
    uit.push({ soort: "vorm", naam, pad, config, fout });
    vanaf = m.index + m[0].length;
  }
  if (vanaf < template.length) uit.push({ soort: "tekst", tekst: template.slice(vanaf) });
  return uit;
}

/** Het template zonder vormblokken (voor de bestaande placeholder-verwerking). */
export function zonderVormBlokken(template) {
  return splitsVormBlokken(template).filter((s) => s.soort === "tekst").map((s) => s.tekst).join("");
}

/** Pad zonder [filter]-delen, voor het samenstellen van subpaden. */
const kaal = (pad) => pad.split(".").map((s) => parseSegment(s).key).join(".");

/** Alle veldpaden die de vormblokken nodig hebben (voor buildGraphQLQuery / de detailQuery). */
export function vormPaden(template) {
  const paden = new Set();
  for (const s of splitsVormBlokken(template)) {
    if (s.soort !== "vorm") continue;
    const c = s.config || {};
    if (s.pad) paden.add(s.pad);
    for (const [k, v] of Object.entries(c)) {
      if (typeof v !== "string" || !v) continue;
      if (/Field$/.test(k) && s.pad) paden.add(`${kaal(s.pad)}.${v}`);
      if (/Path$/.test(k)) paden.add(v);
    }
    for (const g of Array.isArray(c.groups) ? c.groups : []) {
      for (const veld of Object.keys(g?.filter || {})) if (s.pad) paden.add(`${kaal(s.pad)}.${veld}`);
    }
  }
  return [...paden];
}

/**
 * Ruwe waarde van een pad in de context: lijsten blijven lijsten (platgeslagen over tussenliggende
 * lijsten), [veld=waarde]-filters werken, `data` wordt overgeslagen zoals bij {{…}}.
 * Anders dan resolveVeldpadUitContext wordt er NIET met ", " gejoind: een vorm wil de items.
 */
export function ruweWaarde(ctx, pad) {
  if (ctx == null || !pad) return ctx ?? null;
  const segs = pad.split(".").map(parseSegment);
  let huidig = [ctx];
  let lijst = false;
  for (const { key, filter } of segs) {
    const volgende = [];
    for (const h of huidig) {
      if (h == null || typeof h !== "object") continue;
      let w = key === "data" && h[key] === undefined ? h : h[key];
      if (Array.isArray(w)) {
        lijst = true;
        if (filter) w = w.filter((it) => String(it?.[filter.veld] ?? "") === String(filter.waarde));
        volgende.push(...w);
      } else if (w !== undefined) volgende.push(w);
    }
    huidig = volgende;
  }
  const waarden = huidig.filter((w) => w != null && w !== "");
  return lijst ? waarden : waarden[0] ?? null;
}

/**
 * Een waarde als lijst sleutels: arrays blijven (ruweWaarde levert lijsten als lijst), "a;b"
 * (EnumLijst) wordt gesplitst. NIET op ", ": een enkele waarde kan een komma bevatten
 * (fase "Opschaling (…, nu op zoek naar verbreding)").
 */
export function alsSleutels(w) {
  if (w == null || w === "") return [];
  if (Array.isArray(w)) return w.flatMap(alsSleutels);
  return String(w).split(";").map((x) => x.trim()).filter(Boolean);
}
