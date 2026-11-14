// @ts-check
/**
 * bpmnXmlSchrijver — **schrijver** voor BPMN 2.0 XML: één diagram van het
 * BPMN-profiel (bpmn-motor) → `bpmn:definitions` met één `bpmn:process` en de
 * BPMNDI-diagramlaag (shapes met bounds, edges met waypoints). De terugweg van
 * `bpmnXml.js` (de lezer); samen de rondgang Omnium ↔ engine (2026-10-30).
 *
 * Engine-neutraal: wat een engine extra wil (Operaton/Camunda 7:
 * candidateGroups, asyncAfter, een expressie op een servicetaak, de
 * multi-instance-verzameling, `camunda:in`/`camunda:out` bij een call activity) komt uit een
 * **engine-regelset** (bv. `diagramprofielen/bpmn/bpmnGzacRegels.js`). Zonder
 * regelset schrijft hij kale BPMN.
 *
 * Id's: `data.bpmnId` als die er is (de lezer bewaart de id uit de XML; een
 * engine bindt acties en formulieren op die activityId), anders een slug van de
 * naam, anders de Omnium-id. Uniek gemaakt binnen het proces.
 *
 * Berichten: een event met soort "bericht" en een `data.bericht` (de naam)
 * krijgt een `bpmn:message` op definitions-niveau en een messageRef. Een
 * werpend tussen-event (`data.richting` "werpt") wordt een
 * intermediateThrowEvent; wat de engine bij het werpen doet (Operaton: het
 * message start event van een ander proces correleren) komt uit de regelset
 * (`berichten.werpen`, met `{bericht}` voor de naam). Wacht er een lopend proces op het
 * bericht (`wekbareBerichten`), dan `berichten.wekken` (correlate). Een berichtnaam
 * `${variabele}` wordt de expressie uit `berichten.variabel` (0.8.0). Vaste
 * procesvariabelen van een taak (`data.zetVariabelen`) worden output-parameters.
 *
 * Beslistabellen: een businessRuleTask met `data.beslissing` (decision-id) en
 * `data.resultaat`. Waar de engine de kolommen van de tabel vandaan haalt,
 * komt mee in `beslissingen` (per decision-id de `invoer` uit dmnArtefact);
 * de regelset (`taken.businessRuleTask.invoer`) maakt er input-parameters van,
 * per bron (dossierwaarde of procesvariabele) een sjabloon.
 * Engine-attributen die een modelwaarde dragen staan in `uitData` van de
 * regelset (`{veld}` = data.veld; `{veld|kebab}` = dezelfde waarde als sleutel
 * met koppeltekens, zie `sleutel.js`).
 *
 * Pools, lanes en message flows zijn notatie (08-11): een pool die een deelnemer
 * buiten het proces is (bv. "Klantportaal") valt met zijn inhoud weg, met een
 * info-melding; zie `deelnemersBuitenProces`. Lanes en message flows ook (info).
 *
 * Nog niet: data-objecten, notities, boundary events en de inhoud van
 * subprocessen. Die geven een melding `BPMN-SCHRIJVER` en blijven weg.
 *
 * Puur: geen DOM nodig, de uitvoer is tekst.
 */

import { kebab } from "./sleutel.js";
import { celNaarJuel, isJuel } from "./celOmzetting.js";

const TAAK_TAG = {
  "": "task",
  user: "userTask",
  service: "serviceTask",
  send: "sendTask",
  receive: "receiveTask",
  manual: "manualTask",
  script: "scriptTask",
  businessRule: "businessRuleTask",
};
const TAAK_AARDEN = new Set([...Object.values(TAAK_TAG), "callActivity"]);
const EVENT_TAG = { "start-event": "startEvent", "eind-event": "endEvent", "tussen-event": "intermediateCatchEvent" };
const GATEWAY_TAG = { exclusief: "exclusiveGateway", parallel: "parallelGateway", inclusief: "inclusiveGateway", "event-gateway": "eventBasedGateway", complex: "complexGateway" };
const SOORT_DEFINITIE = {
  bericht: "messageEventDefinition",
  timer: "timerEventDefinition",
  fout: "errorEventDefinition",
  signaal: "signalEventDefinition",
  escalatie: "escalationEventDefinition",
  compensatie: "compensateEventDefinition",
  conditioneel: "conditionalEventDefinition",
  link: "linkEventDefinition",
  annulering: "cancelEventDefinition",
  terminate: "terminateEventDefinition",
};
/** Standaardmaat in BPMNDI als het diagram er geen heeft (events en gateways hebben een vaste maat). */
const STANDAARD_MAAT = { event: { width: 36, height: 36 }, gateway: { width: 50, height: 50 }, taak: { width: 100, height: 80 } };

const NS = {
  bpmn: "http://www.omg.org/spec/BPMN/20100524/MODEL",
  bpmndi: "http://www.omg.org/spec/BPMN/20100524/DI",
  dc: "http://www.omg.org/spec/DD/20100524/DC",
  di: "http://www.omg.org/spec/DD/20100524/DI",
  xsi: "http://www.w3.org/2001/XMLSchema-instance",
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attrs = (obj) =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join("");

/** Een geldige XML-id (NCName) uit vrije tekst: kleine letters, koppeltekens. */
export function bpmnIdUit(tekst) {
  const s = String(tekst || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s && /^[a-z_]/.test(s) ? s : s ? `_${s}` : "";
}

/**
 * Variabelen van een call activity uit de modeltekst: "a, b:c" → [{bron:"a",doel:"a"},
 * {bron:"b",doel:"c"}] (bron = de kant waar hij vandaan komt); "alle" (of "*") → "alle".
 * @param {string} tekst
 * @returns {"alle" | {bron: string, doel: string}[]}
 */
export function variabelenLijst(tekst) {
  const delen = String(tekst || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (delen.some((d) => d === "*" || d.toLowerCase() === "alle")) return "alle";
  return delen.map((d) => {
    const [bron, doel] = d.split(":").map((s) => s.trim());
    return { bron, doel: doel || bron };
  });
}

/**
 * Een berichtnaam die een variabele is: `${beoordelingsbericht}` → {naam:"beoordelingsbericht"};
 * een andere expressie (`${a.b}`) → {expressie:"a.b"}; een vaste naam → null.
 * @param {string} bericht
 */
export function berichtVariabele(bericht) {
  const m = /^\s*[$#]\{\s*(.*?)\s*\}\s*$/.exec(String(bericht || ""));
  if (!m) return null;
  return /^[A-Za-z_]\w*$/.test(m[1]) ? { naam: m[1] } : { expressie: m[1] };
}

/**
 * Vaste procesvariabelen uit de modeltekst: "a=x, b = y" → [{naam:"a",waarde:"x"},{naam:"b",waarde:"y"}].
 * Een komma hoort bij de waarde tenzij er een nieuwe `naam=` op volgt.
 * @param {string} tekst
 */
export function zetLijst(tekst) {
  return String(tekst || "")
    .split(/[,\n](?=\s*[A-Za-z_]\w*\s*=)/)
    .map((s) => s.trim())
    .filter((s) => s.includes("="))
    .map((s) => ({ naam: s.slice(0, s.indexOf("=")).trim(), waarde: s.slice(s.indexOf("=") + 1).trim() }))
    .filter((x) => x.naam);
}

/**
 * Pools op een diagram (08-11, TRANSFORMATIES): welke elementen buiten het proces vallen.
 * Lidmaatschap loopt via `bevat`-connectoren (pool → lid, ook via een lane). Staan er
 * stroomelementen buiten elke pool, dan is dát het proces en zijn alle pools deelnemers
 * (bv. "Klantportaal", documentatie); anders is de pool met de meeste stroomelementen het
 * proces. Een deelnemer valt met al zijn leden weg.
 * @param {{elements: Record<string, any>}} model
 * @param {{nodes?: {elementId: string}[]}} diagram
 * @returns {{buiten: Set<string>, procesPool: string|null}}
 */
export function deelnemersBuitenProces(model, diagram) {
  const ids = (diagram.nodes || []).map((n) => n.elementId).filter((id) => model.elements?.[id]);
  const pools = ids.filter((id) => model.elements[id].elementType === "pool");
  if (!pools.length) return { buiten: new Set(), procesPool: null };
  const ouder = new Map();
  for (const e of Object.values(model.elements || {})) if (e.elementType === "bevat" && e.source && e.target) ouder.set(e.target, e.source);
  const poolVan = (id) => {
    const gezien = new Set();
    for (let p = ouder.get(id); p && !gezien.has(p); p = ouder.get(p)) {
      gezien.add(p);
      if (model.elements[p]?.elementType === "pool") return p;
    }
    return null;
  };
  const leden = new Map(pools.map((p) => [p, /** @type {string[]} */ ([])]));
  let losse = 0;
  const stroom = (id) => !!tagVan(model.elements[id]);
  for (const id of ids) {
    if (model.elements[id].elementType === "pool") continue;
    const p = poolVan(id);
    if (p && leden.has(p)) leden.get(p).push(id);
    else if (stroom(id)) losse += 1;
  }
  let procesPool = null;
  if (!losse) {
    let meeste = -1;
    for (const [p, l] of leden) {
      const n = l.filter(stroom).length;
      if (n > meeste) [procesPool, meeste] = [p, n];
    }
  }
  const buiten = new Set();
  for (const [p, l] of leden) {
    if (p === procesPool) continue;
    buiten.add(p);
    for (const id of l) buiten.add(id);
  }
  return { buiten, procesPool };
}

/** Het BPMN-element van een Omnium-element (of null als de schrijver het niet kent). */
function tagVan(el) {
  const t = el.elementType;
  if (t === "taak") {
    if (el.data?.aangeroepenProces) return "callActivity";
    const aard = el.data?.bpmnAard;
    if (aard && TAAK_AARDEN.has(aard) && aard !== "callActivity") return aard;
    return TAAK_TAG[el.data?.taakSoort || ""] || "task";
  }
  if (t === "subproces") return "subProcess";
  if (t === "tussen-event" && el.data?.richting === "werpt") return "intermediateThrowEvent";
  return EVENT_TAG[t] || GATEWAY_TAG[t] || null;
}
const maatSoort = (t) => (EVENT_TAG[t] ? "event" : GATEWAY_TAG[t] ? "gateway" : "taak");

/** Snijpunt van de lijn middelpunt → p met de rand van de rechthoek (vorm). */
function randpunt(v, p) {
  const cx = v.x + v.width / 2;
  const cy = v.y + v.height / 2;
  const dx = p.x - cx;
  const dy = p.y - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const t = Math.min(dx ? v.width / 2 / Math.abs(dx) : Infinity, dy ? v.height / 2 / Math.abs(dy) : Infinity);
  return { x: Math.round(cx + dx * t), y: Math.round(cy + dy * t) };
}
const midden = (v) => ({ x: v.x + v.width / 2, y: v.y + v.height / 2 });

/**
 * @param {Object} invoer
 * @param {{elements: Record<string, any>, diagrams: Record<string, any>}} invoer.model - core-model van het BPMN-profiel
 * @param {string} [invoer.diagramId]          - welk diagram (standaard het eerste)
 * @param {{id: string, naam?: string}} invoer.proces - process-id (bij GZAC = de artefact-identifier) en naam
 * @param {string} [invoer.targetNamespace]
 * @param {any} [invoer.engine]                - engine-regelset (null = kale BPMN)
 * @param {Record<string, any[]>} [invoer.beslissingen] - per decision-id de invoer van de beslistabel
 * @param {Set<string>} [invoer.wekbareBerichten] - berichtnamen waar een lopend proces op wacht (vangend
 *   tussen-event in de e-dienst): een werpend event wekt dat proces (`berichten.wekken`) in plaats van
 *   er een te starten (`berichten.werpen`)
 * @returns {{xml: string, ids: Map<string,string>, diagnostics: any[]}}
 */
export function schrijfBpmn({ model, diagramId, proces, targetNamespace = "http://bpmn.io/schema/bpmn", engine = null, beslissingen = {}, wekbareBerichten = new Set() }) {
  const diagnostics = [];
  const meld = (message, sourceId = null) => diagnostics.push({ severity: "warning", code: "BPMN-SCHRIJVER", message, sourceId, path: null });
  const diagram = diagramId ? model.diagrams?.[diagramId] : Object.values(model.diagrams || {})[0];
  if (!diagram) throw new Error(`Diagram "${diagramId || "(eerste)"}" niet gevonden.`);

  const info = (message, sourceId = null) => diagnostics.push({ severity: "info", code: "BPMN-SCHRIJVER", message, sourceId, path: null });

  // ── Deelnemers buiten het proces (pools): met inhoud overgeslagen ──
  const { buiten, procesPool } = deelnemersBuitenProces(model, diagram);
  for (const id of buiten) {
    const el = model.elements[id];
    if (el?.elementType === "pool") info(`Pool "${el.naam || el.id}" is een deelnemer buiten het proces; met zijn inhoud overgeslagen (notatie)`, el.id);
  }

  // ── Knopen en verbindingen op dit diagram ──
  const opDiagram = new Map();
  for (const n of diagram.nodes || []) {
    const el = model.elements?.[n.elementId];
    if (!el || buiten.has(el.id)) continue;
    const tag = tagVan(el);
    if (!tag) {
      if (el.id === procesPool) info(`Pool "${el.naam || el.id}" is het proces; de pool zelf is notatie`, el.id);
      else if (el.elementType === "lane") info(`Lane "${el.naam || el.id}" is notatie; haar leden staan in het proces`, el.id);
      else meld(`${el.elementType} "${el.naam || el.id}" schrijft de BPMN-schrijver (nog) niet`, el.id);
      continue;
    }
    if (el.elementType === "subproces" && el.data?.gedragDiagramId) meld(`De inhoud van subproces "${el.naam}" blijft weg (alleen samengevouwen)`, el.id);
    const maat = n.size || STANDAARD_MAAT[maatSoort(el.elementType)];
    opDiagram.set(el.id, { el, tag, vorm: { x: n.position.x, y: n.position.y, width: maat.width, height: maat.height } });
  }
  const flows = Object.values(model.elements || {}).filter((e) => e.source && opDiagram.has(e.source) && opDiagram.has(e.target));
  // Message flows zijn notatie: de engine correleert een bericht op naam en businessKey.
  const opDitDiagram = new Set((diagram.nodes || []).map((n) => n.elementId));
  for (const e of Object.values(model.elements || {})) {
    if (e.elementType === "message-flow" && (opDitDiagram.has(e.source) || opDitDiagram.has(e.target))) info(`Message flow "${e.naam || e.id}" is notatie; de engine correleert berichten op naam`, e.id);
  }
  for (const e of flows) if (e.elementType !== "sequence-flow" && e.elementType !== "message-flow") meld(`${e.elementType} "${e.naam || e.id}" schrijft de BPMN-schrijver (nog) niet`, e.id);
  const seq = flows.filter((e) => e.elementType === "sequence-flow");

  // ── Id's: bpmnId, anders uit de naam, uniek ──
  const ids = new Map();
  const gebruikt = new Set([proces.id]);
  const geefId = (el, reserve) => {
    let basis = bpmnIdUit(el.data?.bpmnId) || bpmnIdUit(el.naam) || bpmnIdUit(reserve) || bpmnIdUit(el.id);
    let id = basis;
    for (let i = 2; gebruikt.has(id); i += 1) id = `${basis}-${i}`;
    if (el.data?.bpmnId && id !== el.data.bpmnId) meld(`bpmnId "${el.data.bpmnId}" is dubbel of ongeldig; geschreven als "${id}"`, el.id);
    gebruikt.add(id);
    ids.set(el.id, id);
  };
  for (const { el } of opDiagram.values()) geefId(el);
  seq.forEach((e, i) => geefId({ ...e, naam: "" }, `flow-${i + 1}`));

  const inkomend = new Map();
  const uitgaand = new Map();
  for (const e of seq) {
    (uitgaand.get(e.source) || uitgaand.set(e.source, []).get(e.source)).push(ids.get(e.id));
    (inkomend.get(e.target) || inkomend.set(e.target, []).get(e.target)).push(ids.get(e.id));
  }

  // ── Engine: extra attributen en kinderen ──
  const eng = engine || {};
  const taakRegel = (tag) => eng.taken?.[tag] || {};
  const nsGebruikt = new Set();
  const metNs = (obj) => {
    for (const k of Object.keys(obj || {})) if (k.includes(":")) nsGebruikt.add(k.split(":")[0]);
    return obj || {};
  };

  // ── Berichten: één bpmn:message per naam ──
  const berichten = new Map();
  for (const { el } of opDiagram.values()) {
    const naam = el.data?.soort === "bericht" ? el.data?.bericht : "";
    if (naam && !berichten.has(naam)) berichten.set(naam, `Message_${bpmnIdUit(naam) || berichten.size + 1}`);
  }

  // ── Proces ──
  const r = [];
  const naamVan = (el) => (el.naam ? el.naam : undefined);
  for (const { el, tag } of opDiagram.values()) {
    const id = ids.get(el.id);
    const meervoudig = el.data?.meervoudig;
    const werpt = el.data?.soort === "bericht" && (tag === "intermediateThrowEvent" || tag === "endEvent");
    const bericht = el.data?.soort === "bericht" ? el.data?.bericht || "" : "";
    const variabel = berichtVariabele(bericht);
    // Werpen start een proces; wacht er een lopend proces op dit bericht, dan wekken (0.8.0).
    const wek = werpt && !variabel && wekbareBerichten.has(bericht) && eng.berichten?.wekken;
    const regel = werpt ? (wek ? eng.berichten.wekken : eng.berichten?.werpen) || {} : taakRegel(tag);
    const a = { id, name: naamVan(el) };
    if (tag === "callActivity") a.calledElement = el.data.aangeroepenProces;
    Object.assign(a, metNs({ ...regel.attributen }));
    // Engine-attributen met een waarde uit het model (bv. decisionRef uit data.beslissing).
    for (const u of regel.uitData || []) {
      if (!el.data?.[u.als]) continue;
      for (const [k, v] of Object.entries(metNs(u.attributen))) {
        const w = Object.entries(el.data).reduce(
          (t, [veld, waarde]) => t.split(`{${veld}}`).join(String(waarde ?? "")).split(`{${veld}|kebab}`).join(kebab(waarde)),
          String(v),
        );
        if (/\{\w+(\|\w+)?\}/.test(w.replace(/\$\{[^}]*\}/g, ""))) meld(`"${el.naam || el.id}": ${k} mist een modelwaarde (${w})`, el.id);
        a[k] = w;
      }
    }
    // asyncAfter: op de taak, of bij multi-instance per instantie op de lus.
    if (regel.asyncAfter && eng.asyncAfter && !meervoudig) Object.assign(a, metNs({ [eng.asyncAfter]: "true" }));
    const std = seq.find((e) => e.source === el.id && e.data?.standaard);
    if (std) a.default = ids.get(std.id);
    const kinderen = [];
    for (const f of inkomend.get(el.id) || []) kinderen.push(`<bpmn:incoming>${f}</bpmn:incoming>`);
    for (const f of uitgaand.get(el.id) || []) kinderen.push(`<bpmn:outgoing>${f}</bpmn:outgoing>`);
    const definitie = SOORT_DEFINITIE[el.data?.soort];
    if (definitie && EVENT_TAG[el.elementType]) {
      const d = { id: `${id}-definitie`, messageRef: bericht ? berichten.get(bericht) : undefined };
      // Wat de engine bij het werpen doet; {bericht} = de naam als tekst ('naam'), of bij een
      // variabele naam (${beoordelingsbericht}) de expressie uit berichten.variabel.
      if (werpt) {
        const naamExpr = variabel
          ? variabel.naam
            ? String(eng.berichten?.variabel || "{variabele}").split("{variabele}").join(variabel.naam)
            : variabel.expressie
          : `'${bericht.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
        if (bericht) for (const [k, v] of Object.entries(metNs(regel.definitie))) d[k] = String(v).split("{bericht}").join(naamExpr);
        else meld(`Werpend bericht-event "${el.naam || el.id}" heeft geen berichtnaam`, el.id);
      }
      kinderen.push(`<bpmn:${definitie}${attrs(d)} />`);
    }
    if (meervoudig) {
      const lus = { isSequential: meervoudig === "sequentieel" ? "true" : undefined };
      if (eng.lus) {
        if (regel.asyncAfter && eng.asyncAfter) lus[eng.asyncAfter] = "true";
        if (el.data?.lusVerzameling) lus[eng.lus.verzameling] = el.data.lusVerzameling;
        if (el.data?.lusElement) lus[eng.lus.element] = el.data.lusElement;
      } else if (el.data?.lusVerzameling) meld(`Multi-instance "${el.naam}": de verzameling vraagt een engine-regelset`, el.id);
      kinderen.push(`<bpmn:multiInstanceLoopCharacteristics${attrs(metNs(lus))} />`);
    }
    const ext = (regel.extensies || []).map((x) => {
      if (x.tag.includes(":")) nsGebruikt.add(x.tag.split(":")[0]);
      return `<${x.tag}${attrs(metNs(x.attributen))} />`;
    });
    // Call activity: variabelen erheen en terug (data.aangeroepenIn / aangeroepenUit, zie variabelenLijst).
    if (tag === "callActivity" && regel.variabelen) {
      const v = regel.variabelen;
      for (const [richting, veld, standaard] of [["in", "aangeroepenIn", v.standaardIn], ["uit", "aangeroepenUit", v.standaardUit]]) {
        const t = v[richting];
        if (!t) continue;
        const lijst = variabelenLijst(el.data?.[veld] || standaard || "");
        if (lijst !== "alle" && !lijst.length) continue;
        if (t.includes(":")) nsGebruikt.add(t.split(":")[0]);
        if (lijst === "alle") ext.push(`<${t} variables="all" />`);
        else for (const { bron, doel } of lijst) ext.push(`<${t}${attrs({ source: bron, target: doel })} />`);
      }
    }
    /** Eén camunda:inputOutput voor de invoer van een beslistabel en de vaste variabelen. */
    const io = { tag: "", regels: /** @type {string[]} */ ([]) };
    // Invoer van een beslistabel: per dossierkolom een input-parameter.
    if (regel.invoer && el.data?.beslissing) {
      const lijst = beslissingen[el.data.beslissing];
      if (!lijst) meld(`Beslistabel "${el.data.beslissing}" is niet meegegeven; de businessRuleTask krijgt geen invoer`, el.id);
      // Per kolom een sjabloon voor zijn bron (dossier: {pointer}, variabele: {variabele}).
      const sjabloon = (x) => (x.bron === "dossier" ? regel.invoer.dossier?.split("{pointer}").join(x.pointer) : regel.invoer.variabele?.split("{variabele}").join(x.variabele));
      const params = (lijst || []).filter((x) => sjabloon(x));
      if (params.length) {
        io.tag = regel.invoer.tag;
        for (const x of params) io.regels.push(`<${regel.invoer.parameter} name="${esc(x.naam)}">${esc(sjabloon(x))}</${regel.invoer.parameter}>`);
      }
    }
    // Vaste procesvariabelen (data.zetVariabelen "naam=waarde, …"): output-parameters (0.8.0).
    const zet = el.elementType === "taak" ? zetLijst(el.data?.zetVariabelen) : [];
    if (zet.length) {
      const z = eng.variabelenZetten;
      if (!z) meld(`"${el.naam || el.id}" zet procesvariabelen; dat vraagt een engine-regelset`, el.id);
      else {
        io.tag = io.tag || z.tag;
        for (const { naam, waarde } of zet) io.regels.push(`<${z.parameter} name="${esc(naam)}">${esc(waarde)}</${z.parameter}>`);
      }
    }
    if (io.regels.length) {
      for (const t of [io.tag, ...io.regels.map((x) => x.slice(1, x.indexOf(" ")))]) if (t.includes(":")) nsGebruikt.add(t.split(":")[0]);
      ext.push(`<${io.tag}>`, ...io.regels.map((x) => `  ${x}`), `</${io.tag}>`);
    }
    if (ext.length) kinderen.unshift(`<bpmn:extensionElements>`, ...ext.map((x) => `  ${x}`), `</bpmn:extensionElements>`);
    r.push(`    <bpmn:${tag}${attrs(a)}>`);
    for (const k of kinderen) r.push(`      ${k}`);
    r.push(`    </bpmn:${tag}>`);
  }
  let xsi = false;
  for (const e of seq) {
    const a = { id: ids.get(e.id), name: e.naam || undefined, sourceRef: ids.get(e.source), targetRef: ids.get(e.target) };
    if (e.data?.conditie) {
      xsi = true;
      // De conditie is CEL in het model; de engine krijgt JUEL (besluit Mark 12-11, celOmzetting.js).
      // Een conditie die al met ${ begint is nog JUEL en gaat ongewijzigd door.
      let conditie = e.data.conditie;
      if (!isJuel(conditie)) {
        const om = celNaarJuel(conditie);
        if (om.tekst) conditie = om.tekst;
        else diagnostics.push({ severity: "error", code: "BPMN-CONDITIE", message: `Conditie "${conditie}" op "${e.naam || ids.get(e.id)}": ${om.fout}`, sourceId: e.id, path: null });
      }
      r.push(`    <bpmn:sequenceFlow${attrs(a)}>`);
      r.push(`      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${esc(conditie)}</bpmn:conditionExpression>`);
      r.push(`    </bpmn:sequenceFlow>`);
    } else r.push(`    <bpmn:sequenceFlow${attrs(a)} />`);
  }

  // ── BPMNDI ──
  const di = [];
  for (const { el, vorm } of opDiagram.values()) {
    const id = ids.get(el.id);
    di.push(`      <bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}"><dc:Bounds${attrs({ x: vorm.x, y: vorm.y, width: vorm.width, height: vorm.height })} /></bpmndi:BPMNShape>`);
  }
  for (const e of seq) {
    const id = ids.get(e.id);
    const bron = opDiagram.get(e.source).vorm;
    const doel = opDiagram.get(e.target).vorm;
    const knikken = (e.data?.knikken || []).map((p) => ({ x: p.x, y: p.y }));
    const punten = [randpunt(bron, knikken[0] || midden(doel)), ...knikken, randpunt(doel, knikken[knikken.length - 1] || midden(bron))];
    di.push(`      <bpmndi:BPMNEdge id="${id}_di" bpmnElement="${id}">${punten.map((p) => `<di:waypoint x="${p.x}" y="${p.y}" />`).join("")}</bpmndi:BPMNEdge>`);
  }

  // ── Definities ──
  const procesAttr = { id: proces.id, name: proces.naam || diagram.naam || undefined, ...metNs(eng.proces || {}) };
  const ns = { "xmlns:bpmn": NS.bpmn, "xmlns:bpmndi": NS.bpmndi, "xmlns:dc": NS.dc, "xmlns:di": NS.di };
  if (xsi) ns["xmlns:xsi"] = NS.xsi;
  for (const p of [...nsGebruikt].sort()) {
    if (!eng.namespaces?.[p]) throw new Error(`Engine-regelset gebruikt prefix "${p}" zonder namespace.`);
    ns[`xmlns:${p}`] = eng.namespaces[p];
  }
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<bpmn:definitions${attrs({ ...ns, id: `Definitions_${proces.id}`, targetNamespace })}>`,
    ...[...berichten].map(([naam, id]) => `  <bpmn:message${attrs({ id, name: naam })} />`),
    `  <bpmn:process${attrs(procesAttr)}>`,
    ...r,
    `  </bpmn:process>`,
    `  <bpmndi:BPMNDiagram id="BPMNDiagram_${proces.id}">`,
    `    <bpmndi:BPMNPlane id="BPMNPlane_${proces.id}" bpmnElement="${proces.id}">`,
    ...di,
    `    </bpmndi:BPMNPlane>`,
    `  </bpmndi:BPMNDiagram>`,
    `</bpmn:definitions>`,
    "",
  ].join("\n");
  return { xml, ids, diagnostics };
}
