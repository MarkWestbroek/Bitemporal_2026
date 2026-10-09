// @ts-check
/**
 * bpmnXml — **lezer** voor BPMN 2.0 XML (`bpmn:definitions`): de semantische
 * laag (process, collaboration/participant, laneSet/lane, flow nodes,
 * sequenceFlow, messageFlow, data objects, text annotations) als brongraaf
 * voor de toepasser, plus de BPMNDI-diagramlaag (BPMNShape/Bounds,
 * BPMNEdge/waypoints) als `diagrammen`. Geen kennis van het doelprofiel: de
 * betekenis staat in `diagramprofielen/bpmn/bpmnXmlRegels.js`.
 *
 * Brongraaf:
 *   knopen:       { id, tekst, aard, eventDefinitie?, randVan?, onderbrekend?,
 *                   proces, groep? (lane of pool), subproces? (omvattend
 *                   subProcess), standaardFlow?, verzameling? (isCollection) }
 *   groepen:      { id, tekst, aard: "participant"|"lane", groep? }
 *   verbindingen: { id, bron, doel, aard, label, conditie?, standaard? }
 *   diagrammen:   [{ id, naam, vormen: {bronId: {x,y,width,height,uitgeklapt}},
 *                    lijnen: {bronId: [{x,y}, …]} }]
 *   waarschuwingen: [{ melding, tekst? }]
 *
 * Opdracht Mark via EA-SYNC (2026-10-09/10): BPMN- en DMN-lezers uit hun
 * native uitwisselformaat, als lezer → regelset → toepasser.
 */
import { parseXml, lokaal, kinderen, kind, afstammelingen, attr, tekstVan, getal, idUitHref } from "./xmlBoom.js";

export const BPMN_NAMESPACE = "http://www.omg.org/spec/BPMN/20100524/MODEL";

const ACTIVITEITEN = new Set([
  "task", "userTask", "serviceTask", "scriptTask", "manualTask", "sendTask", "receiveTask", "businessRuleTask", "callActivity",
  "subProcess", "adHocSubProcess", "transaction",
]);
const EVENTS = new Set(["startEvent", "endEvent", "intermediateCatchEvent", "intermediateThrowEvent", "boundaryEvent"]);
const GATEWAYS = new Set(["exclusiveGateway", "parallelGateway", "inclusiveGateway", "eventBasedGateway", "complexGateway"]);
const DATA = new Set(["dataObjectReference", "dataStoreReference", "dataObject", "dataInput", "dataOutput"]);
const SUBPROCESSEN = new Set(["subProcess", "adHocSubProcess", "transaction"]);

/** Snelle herkenning voor de bestandskiezer (`bron.detecteer`). */
export function lijktOpBpmn({ naam = "", tekst = "" } = {}) {
  if (/\.bpmn$/i.test(naam)) return 0.95;
  if (/<(\w+:)?definitions[^>]*BPMN\/20100524\/MODEL/i.test(tekst)) return 0.9;
  if (/<(\w+:)?process\b/i.test(tekst) && /<(\w+:)?sequenceFlow\b/i.test(tekst)) return 0.6;
  return 0;
}

/**
 * @param {string} tekst
 * @param {{DOMParser?: any}} [opties]
 */
export function leesBpmn(tekst, opties = {}) {
  const doc = parseXml(tekst, { DOMParser: opties.DOMParser, code: "BPMN-XML-ONGELDIG" });
  const wortel = doc.documentElement;
  if (lokaal(wortel) !== "definitions") {
    throw Object.assign(new Error(`Geen BPMN-bestand: wortel is <${lokaal(wortel)}>, verwacht <definitions>.`), { code: "BPMN-XML-ROOT" });
  }
  const waarschuwingen = [];
  const knopen = [];
  const groepen = [];
  const verbindingen = [];
  const knoopIds = new Set();

  // ── Collaboration: pools en message flows ───────────────────────────────
  const poolVanProces = new Map(); // processId → participant-id
  for (const collab of kinderen(wortel, "collaboration")) {
    for (const p of kinderen(collab, "participant")) {
      const id = attr(p, "id");
      if (!id) continue;
      groepen.push({ id, tekst: attr(p, "name"), aard: "participant", proces: attr(p, "processRef") || null });
      if (attr(p, "processRef")) poolVanProces.set(attr(p, "processRef"), id);
    }
    for (const mf of kinderen(collab, "messageFlow")) {
      verbindingen.push({ id: attr(mf, "id"), bron: attr(mf, "sourceRef"), doel: attr(mf, "targetRef"), aard: "messageFlow", label: attr(mf, "name") });
    }
    for (const ta of kinderen(collab, "textAnnotation")) voegAnnotatieToe(ta, null);
    for (const as of kinderen(collab, "association")) voegAssociatieToe(as);
  }

  function voegAnnotatieToe(ta, groep) {
    const id = attr(ta, "id");
    if (!id || knoopIds.has(id)) return;
    knoopIds.add(id);
    knopen.push({ id, tekst: tekstVan(ta, "text"), aard: "textAnnotation", groep });
  }
  function voegAssociatieToe(as) {
    verbindingen.push({ id: attr(as, "id"), bron: attr(as, "sourceRef"), doel: attr(as, "targetRef"), aard: "association", label: "" });
  }

  // Definities van data (isCollection) — de references tekenen.
  const verzamelingVan = new Map();
  for (const def of [...afstammelingen(wortel, "dataObject"), ...kinderen(wortel, "dataStore")]) {
    verzamelingVan.set(attr(def, "id"), attr(def, "isCollection") === "true");
  }

  // ── Processen ───────────────────────────────────────────────────────────
  for (const proces of kinderen(wortel, "process")) {
    const procesId = attr(proces, "id");
    const pool = poolVanProces.get(procesId) || null;
    // Lanes: laneSet/lane (genest via childLaneSet); lidmaatschap via flowNodeRef.
    const laneVanKnoop = new Map();
    const leesLanes = (laneSet, ouder) => {
      for (const lane of kinderen(laneSet, "lane")) {
        const id = attr(lane, "id");
        if (!id) continue;
        groepen.push({ id, tekst: attr(lane, "name"), aard: "lane", groep: ouder });
        for (const ref of kinderen(lane, "flowNodeRef")) laneVanKnoop.set(tekstVan(ref), id);
        for (const sub of kinderen(lane, "childLaneSet")) leesLanes(sub, id);
      }
    };
    for (const laneSet of kinderen(proces, "laneSet")) leesLanes(laneSet, pool);

    const leesInhoud = (houder, subproces) => {
      for (const el of kinderen(houder)) {
        const aard = lokaal(el);
        const id = attr(el, "id");
        if (aard === "laneSet" || aard === "documentation" || aard === "extensionElements") continue;
        if (aard === "sequenceFlow") {
          verbindingen.push({
            id,
            bron: attr(el, "sourceRef"),
            doel: attr(el, "targetRef"),
            aard,
            label: attr(el, "name"),
            conditie: tekstVan(el, "conditionExpression"),
            standaard: false,
            subproces,
          });
          continue;
        }
        if (aard === "association") {
          voegAssociatieToe(el);
          continue;
        }
        if (aard === "textAnnotation") {
          voegAnnotatieToe(el, laneVanKnoop.get(id) || pool);
          continue;
        }
        if (aard === "dataObject" || aard === "ioSpecification" || aard === "dataInput" || aard === "dataOutput") continue; // definitie; de reference tekent
        if (!id) continue;
        if (!(ACTIVITEITEN.has(aard) || EVENTS.has(aard) || GATEWAYS.has(aard) || DATA.has(aard))) {
          waarschuwingen.push({ melding: `BPMN-element niet ondersteund: ${aard}`, tekst: attr(el, "name") || id });
          continue;
        }
        if (knoopIds.has(id)) continue;
        knoopIds.add(id);
        const knoop = {
          id,
          tekst: attr(el, "name"),
          aard,
          proces: procesId,
          groep: laneVanKnoop.get(id) || pool,
          subproces,
        };
        if (EVENTS.has(aard)) {
          const def = kinderen(el).find((k) => /EventDefinition$/.test(lokaal(k)));
          knoop.eventDefinitie = def ? lokaal(def).replace(/EventDefinition$/, "").toLowerCase() : "";
          if (aard === "boundaryEvent") {
            knoop.randVan = attr(el, "attachedToRef");
            knoop.onderbrekend = attr(el, "cancelActivity") !== "false";
          }
        }
        if (attr(el, "default")) knoop.standaardFlow = attr(el, "default");
        if (aard === "dataObjectReference" || aard === "dataStoreReference") {
          knoop.verwijstNaar = attr(el, "dataObjectRef") || attr(el, "dataStoreRef");
          knoop.verzameling = attr(el, "isCollection") === "true" || verzamelingVan.get(knoop.verwijstNaar) === true;
        }
        knopen.push(knoop);
        // Data-associaties van een activiteit: in → activiteit, activiteit → uit.
        for (const dia of kinderen(el, "dataInputAssociation")) {
          const bron = idUitHref(tekstVan(dia, "sourceRef"));
          if (bron) verbindingen.push({ id: attr(dia, "id") || `${id}_in_${bron}`, bron, doel: id, aard: "dataInputAssociation", label: "" });
        }
        for (const doa of kinderen(el, "dataOutputAssociation")) {
          const doel = idUitHref(tekstVan(doa, "targetRef"));
          if (doel) verbindingen.push({ id: attr(doa, "id") || `${id}_uit_${doel}`, bron: id, doel, aard: "dataOutputAssociation", label: "" });
        }
        // Uitgeklapt subproces: zijn inhoud hoort bij hem (eigen diagram in de toepasser).
        if (SUBPROCESSEN.has(aard)) leesInhoud(el, id);
      }
    };
    leesInhoud(proces, null);
  }

  // Default flows: het `default`-attribuut van de bron wijst de flow aan.
  const standaardFlows = new Set(knopen.filter((k) => k.standaardFlow).map((k) => k.standaardFlow));
  for (const v of verbindingen) if (v.aard === "sequenceFlow" && standaardFlows.has(v.id)) v.standaard = true;

  // ── BPMNDI: diagramlaag ────────────────────────────────────────────────
  const diagrammen = [];
  for (const di of afstammelingen(wortel, "BPMNDiagram")) {
    const vormen = {};
    const lijnen = {};
    for (const plane of kinderen(di, "BPMNPlane")) {
      for (const shape of afstammelingen(plane, "BPMNShape")) {
        const bounds = kind(shape, "Bounds");
        const ref = attr(shape, "bpmnElement");
        if (!ref || !bounds) continue;
        vormen[ref] = {
          x: getal(bounds, "x"),
          y: getal(bounds, "y"),
          width: getal(bounds, "width"),
          height: getal(bounds, "height"),
          uitgeklapt: attr(shape, "isExpanded") === "true",
          horizontaal: attr(shape, "isHorizontal") !== "false",
        };
      }
      for (const edge of afstammelingen(plane, "BPMNEdge")) {
        const ref = attr(edge, "bpmnElement");
        if (!ref) continue;
        lijnen[ref] = kinderen(edge, "waypoint").map((w) => ({ x: getal(w, "x"), y: getal(w, "y") }));
      }
    }
    diagrammen.push({ id: attr(di, "id") || `diagram_${diagrammen.length + 1}`, naam: attr(di, "name"), vormen, lijnen });
  }

  return { knopen, groepen, verbindingen, diagrammen, waarschuwingen, naam: attr(wortel, "name") || attr(wortel, "id") || "" };
}
