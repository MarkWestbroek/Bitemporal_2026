// @ts-check
/**
 * beslistabel — rekent een beslistabel uit zoals hij in het DMN-model staat
 * (`data.beslistabel` op een beslissing van profiel dmn-drd; de vorm van
 * `dmn/dmnModel.js`). Ontwerp §4 en §9.3.
 *
 * - **Invoer** per kolom: een CEL-`expressie` over de context, of anders het
 *   veld waar de kolom aan bindt (`fieldRef`): `envelop:<naam>` is een
 *   startvariabele, de rest het veld `veldnaam` van het object.
 * - **Cel**: een waarde, een lijst van waarden of leeg (elke waarde):
 *   `"bestuurder"`, `true`, `null, ""`, `> 5`, `not("a", "b")`. Dat is geen
 *   expressie; de notatie is in CEL en FEEL gelijk.
 * - **Hit policy**: FIRST (de eerste regel die past) en UNIQUE (precies één).
 * - **Boom**: een beslissing die een andere nodig heeft (`infoReq` in het DRD)
 *   krijgt de uitvoer van die andere in haar context, van onder naar boven.
 *
 * Wat hier niet te lezen is gooit `Onleesbaar`; de simulatie maakt er een gat
 * van.
 *
 * Puur.
 */
import { parseCelExpressie, evalueerCelExpressie } from "../shared/celEvaluator.js";
import { vrijeVariabelen } from "../transformatie/celOmzetting.js";
import { bpmnIdUit } from "../transformatie/bpmnXmlSchrijver.js";

export class Onleesbaar extends Error {}

/** Een waarde in een cel: tekst tussen aanhalingstekens, getal, true, false of null. */
function waardeUit(tekst) {
  const t = tekst.trim();
  if (t === "null") return null;
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  const m = /^"((?:[^"\\]|\\.)*)"$/.exec(t) || /^'((?:[^'\\]|\\.)*)'$/.exec(t);
  if (m) return m[1].replace(/\\(.)/g, "$1");
  throw new Onleesbaar(`"${tekst}" is geen waarde`);
}

/** Splitst op komma's buiten aanhalingstekens en haakjes. */
function splits(tekst) {
  const delen = [];
  let deel = "";
  let quote = null;
  let diepte = 0;
  for (let i = 0; i < tekst.length; i++) {
    const c = tekst[i];
    if (quote) {
      if (c === "\\") deel += c + (tekst[++i] ?? "");
      else {
        if (c === quote) quote = null;
        deel += c;
      }
    } else if (c === '"' || c === "'") {
      quote = c;
      deel += c;
    } else if (c === "(") {
      diepte++;
      deel += c;
    } else if (c === ")") {
      diepte--;
      deel += c;
    } else if (c === "," && !diepte) {
      delen.push(deel);
      deel = "";
    } else deel += c;
  }
  delen.push(deel);
  return delen.map((d) => d.trim()).filter(Boolean);
}

const gelijk = (a, b) => (a ?? null) === (b ?? null);

/**
 * Past de waarde in de cel?
 * @param {string} cel
 * @param {any} waarde
 */
export function celPast(cel, waarde) {
  const t = String(cel ?? "").trim();
  if (!t || t === "-") return true;
  const niet = /^not\s*\(([\s\S]*)\)$/.exec(t);
  if (niet) return !celPast(niet[1], waarde);
  return splits(t).some((deel) => {
    const v = /^(<=|>=|<|>)\s*(.+)$/.exec(deel);
    if (!v) return gelijk(waardeUit(deel), waarde);
    const grens = waardeUit(v[2]);
    if (waarde === null || waarde === undefined) return false;
    return v[1] === "<" ? waarde < grens : v[1] === "<=" ? waarde <= grens : v[1] === ">" ? waarde > grens : waarde >= grens;
  });
}

/** CEL uitrekenen; onleesbaar of een onbekende variabele gooit Onleesbaar. */
export function rekenCel(expressie, context) {
  let boom;
  try {
    boom = parseCelExpressie(expressie);
  } catch (e) {
    throw new Onleesbaar(`"${expressie}" is geen geldige CEL (${e.message})`);
  }
  for (const v of vrijeVariabelen(boom)) if (!(v in context)) throw new Onleesbaar(`"${expressie}": de variabele "${v}" bestaat niet`);
  return evalueerCelExpressie(expressie, context);
}

/** De waarde van een invoerkolom. */
function invoerWaarde(kolom, { object, variabelen, context }) {
  if (kolom.expressie) return rekenCel(kolom.expressie, context);
  const pad = kolom.fieldRef?.veldpad || "";
  const naam = kolom.fieldRef?.veldnaam || kolom.naam;
  if (pad.startsWith("envelop:")) return variabelen[pad.slice("envelop:".length)] ?? null;
  if (naam in (object || {})) return object[naam];
  if (naam in context) return context[naam];
  return null;
}

/**
 * Rekent één tabel uit.
 * @param {any} tabel - `data.beslistabel`
 * @param {{object?: any, variabelen?: Record<string, any>, extra?: Record<string, any>}} bij - het object (de velden
 *   van de cm-instantie), de procesvariabelen en de uitvoer van onderliggende beslissingen
 * @returns {{uitkomst: Record<string, any>|null, regel: string|null, invoer: Record<string, any>}}
 */
export function rekenTabelUit(tabel, { object = {}, variabelen = {}, extra = {} } = {}) {
  const context = { ...object, ...variabelen, ...extra };
  const beleid = String(tabel.hitPolicy || "UNIQUE").toUpperCase();
  if (beleid !== "FIRST" && beleid !== "UNIQUE") throw new Onleesbaar(`Hit policy "${tabel.hitPolicy}" speelt de simulatie niet na`);
  const invoer = {};
  for (const kolom of tabel.inputs || []) invoer[kolom.id] = invoerWaarde(kolom, { object, variabelen, context });
  const raak = (tabel.rules || []).filter((regel) => (tabel.inputs || []).every((kolom) => celPast(regel.inputEntries?.[kolom.id], invoer[kolom.id])));
  const benoemd = Object.fromEntries((tabel.inputs || []).map((k) => [k.label || k.naam || k.id, invoer[k.id]]));
  if (!raak.length) return { uitkomst: null, regel: null, invoer: benoemd };
  if (beleid === "UNIQUE" && raak.length > 1) throw new Onleesbaar(`Hit policy UNIQUE, maar ${raak.length} regels passen (${raak.map((r) => r.id).join(", ")})`);
  const regel = raak[0];
  const uitkomst = {};
  for (const kolom of tabel.outputs || []) {
    const t = String(regel.outputEntries?.[kolom.id] ?? "").trim();
    let w;
    try {
      w = t ? waardeUit(t) : null;
    } catch {
      w = rekenCel(t, context);
    }
    uitkomst[kolom.naam || kolom.id] = w;
  }
  return { uitkomst, regel: regel.id, invoer: benoemd };
}

/**
 * De beslissing bij een decision-id. De id is de identifier van het
 * dmn-artefact in het e-dienstmodel (`bron.beslissing` = de naam); zonder
 * e-dienst past de id op de naam van de beslissing.
 * @param {any[]} dmnModellen
 * @param {string} id
 * @param {any} [edienst]
 */
export function vindBeslissing(dmnModellen, id, edienst) {
  const artefact = (edienst?.artefacten || []).find((a) => a.soort === "dmn" && a.identifier === id);
  const naam = artefact?.bron?.beslissing;
  for (const bestand of dmnModellen || []) {
    const model = bestand?.model || bestand;
    for (const el of Object.values(model?.elements || {})) {
      if (el.elementType !== "decision") continue;
      if (el.id === id || (naam && el.naam === naam) || (!naam && bpmnIdUit(el.naam) === id)) return { model, beslissing: el };
    }
  }
  return null;
}

/**
 * Rekent een beslissing uit met alles wat zij nodig heeft (DRD als boom).
 * @returns {{uitkomst: Record<string, any>|null, regel: string|null, invoer: Record<string, any>, onderliggend: any[]}}
 */
export function rekenBeslissingUit({ model, beslissing }, bij = {}, bezocht = new Set()) {
  if (bezocht.has(beslissing.id)) throw new Onleesbaar(`Beslissing "${beslissing.naam}" hangt van zichzelf af`);
  bezocht.add(beslissing.id);
  const tabel = beslissing.data?.beslistabel;
  if (!tabel) throw new Onleesbaar(`Beslissing "${beslissing.naam}" heeft geen beslistabel`);
  const extra = { ...(bij.extra || {}) };
  const onderliggend = [];
  for (const el of Object.values(model.elements)) {
    if (el.elementType !== "infoReq" || el.target !== beslissing.id) continue;
    const bron = model.elements[el.source];
    if (bron?.elementType !== "decision") continue;
    const uit = rekenBeslissingUit({ model, beslissing: bron }, bij, bezocht);
    onderliggend.push({ beslissing: bron.naam, ...uit });
    Object.assign(extra, uit.uitkomst || {});
  }
  return { ...rekenTabelUit(tabel, { ...bij, extra }), onderliggend };
}
