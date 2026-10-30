// @ts-check
/**
 * bpmnXmlSchrijver — **schrijver** voor BPMN 2.0 XML: één diagram van het
 * BPMN-profiel (bpmn-motor) → `bpmn:definitions` met één `bpmn:process` en de
 * BPMNDI-diagramlaag (shapes met bounds, edges met waypoints). De terugweg van
 * `bpmnXml.js` (de lezer); samen de rondgang Omnium ↔ engine (2026-10-30).
 *
 * Engine-neutraal: wat een engine extra wil (Operaton/Camunda 7:
 * candidateGroups, asyncAfter, een expressie op een servicetaak, de
 * multi-instance-verzameling, `camunda:in` bij een call activity) komt uit een
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
 * (`berichten.werpen`, met `{bericht}` voor de naam).
 *
 * Beslistabellen: een businessRuleTask met `data.beslissing` (decision-id) en
 * `data.resultaat`. Waar de engine de kolommen van de tabel vandaan haalt,
 * komt mee in `beslissingen` (per decision-id de `invoer` uit dmnArtefact);
 * de regelset (`taken.businessRuleTask.invoer`) maakt er input-parameters van.
 * Engine-attributen die een modelwaarde dragen staan in `uitData` van de
 * regelset (`{veld}` = data.veld).
 *
 * Nog niet: pools/lanes, message flows, data-objecten, notities, boundary
 * events en de inhoud van subprocessen. Die geven een melding
 * `BPMN-SCHRIJVER` en blijven weg.
 *
 * Puur: geen DOM nodig, de uitvoer is tekst.
 */

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
 * @returns {{xml: string, ids: Map<string,string>, diagnostics: any[]}}
 */
export function schrijfBpmn({ model, diagramId, proces, targetNamespace = "http://bpmn.io/schema/bpmn", engine = null, beslissingen = {} }) {
  const diagnostics = [];
  const meld = (message, sourceId = null) => diagnostics.push({ severity: "warning", code: "BPMN-SCHRIJVER", message, sourceId, path: null });
  const diagram = diagramId ? model.diagrams?.[diagramId] : Object.values(model.diagrams || {})[0];
  if (!diagram) throw new Error(`Diagram "${diagramId || "(eerste)"}" niet gevonden.`);

  // ── Knopen en verbindingen op dit diagram ──
  const opDiagram = new Map();
  for (const n of diagram.nodes || []) {
    const el = model.elements?.[n.elementId];
    if (!el) continue;
    const tag = tagVan(el);
    if (!tag) {
      meld(`${el.elementType} "${el.naam || el.id}" schrijft de BPMN-schrijver (nog) niet`, el.id);
      continue;
    }
    if (el.elementType === "subproces" && el.data?.gedragDiagramId) meld(`De inhoud van subproces "${el.naam}" blijft weg (alleen samengevouwen)`, el.id);
    const maat = n.size || STANDAARD_MAAT[maatSoort(el.elementType)];
    opDiagram.set(el.id, { el, tag, vorm: { x: n.position.x, y: n.position.y, width: maat.width, height: maat.height } });
  }
  const flows = Object.values(model.elements || {}).filter((e) => e.source && opDiagram.has(e.source) && opDiagram.has(e.target));
  for (const e of flows) if (e.elementType !== "sequence-flow") meld(`${e.elementType} "${e.naam || e.id}" schrijft de BPMN-schrijver (nog) niet`, e.id);
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
    const regel = werpt ? eng.berichten?.werpen || {} : taakRegel(tag);
    const a = { id, name: naamVan(el) };
    if (tag === "callActivity") a.calledElement = el.data.aangeroepenProces;
    Object.assign(a, metNs({ ...regel.attributen }));
    // Engine-attributen met een waarde uit het model (bv. decisionRef uit data.beslissing).
    for (const u of regel.uitData || []) {
      if (!el.data?.[u.als]) continue;
      for (const [k, v] of Object.entries(metNs(u.attributen))) {
        const w = Object.entries(el.data).reduce((t, [veld, waarde]) => t.split(`{${veld}}`).join(String(waarde ?? "")), String(v));
        if (/\{\w+\}/.test(w.replace(/\$\{[^}]*\}/g, ""))) meld(`"${el.naam || el.id}": ${k} mist een modelwaarde (${w})`, el.id);
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
      const bericht = el.data?.soort === "bericht" ? el.data?.bericht : "";
      const d = { id: `${id}-definitie`, messageRef: bericht ? berichten.get(bericht) : undefined };
      // Wat de engine bij het werpen doet; {bericht} = de berichtnaam (letterlijk vervangen, ${…} blijft staan).
      if (werpt) {
        if (bericht) for (const [k, v] of Object.entries(metNs(regel.definitie))) d[k] = String(v).split("{bericht}").join(bericht);
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
    // Invoer van een beslistabel: per dossierkolom een input-parameter.
    if (regel.invoer && el.data?.beslissing) {
      const lijst = beslissingen[el.data.beslissing];
      if (!lijst) meld(`Beslistabel "${el.data.beslissing}" is niet meegegeven; de businessRuleTask krijgt geen invoer`, el.id);
      const params = (lijst || []).filter((x) => x.bron === "dossier");
      if (params.length) {
        for (const t of [regel.invoer.tag, regel.invoer.parameter]) if (t.includes(":")) nsGebruikt.add(t.split(":")[0]);
        ext.push(`<${regel.invoer.tag}>`);
        for (const x of params) ext.push(`  <${regel.invoer.parameter} name="${esc(x.naam)}">${esc(regel.invoer.dossier.split("{pointer}").join(x.pointer))}</${regel.invoer.parameter}>`);
        ext.push(`</${regel.invoer.tag}>`);
      }
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
      r.push(`    <bpmn:sequenceFlow${attrs(a)}>`);
      r.push(`      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${esc(e.data.conditie)}</bpmn:conditionExpression>`);
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
