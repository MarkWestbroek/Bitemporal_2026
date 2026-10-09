// @ts-check
/**
 * dmnXml — **lezer** voor DMN 1.1–1.5 XML (`dmn:definitions`): decisions,
 * inputData, businessKnowledgeModel, knowledgeSource, textAnnotation en de
 * requirements (information/knowledge/authority) als brongraaf, plus de
 * DMNDI-laag (DMNShape/Bounds, DMNEdge/waypoints) als `diagrammen`. Geen
 * kennis van het doelprofiel: zie `diagramprofielen/dmn-drd/dmnXmlRegels.js`.
 *
 * Brongraaf:
 *   knopen:       { id, tekst, aard, vraag?, toelichting? }
 *   verbindingen: { id, bron, doel, aard, label }  — bron = het vereiste,
 *                 doel = wie het vereist (de pijlrichting van een DRD)
 *   diagrammen:   [{ id, naam, vormen: {bronId: {x,y,width,height}}, lijnen: {bronId: [{x,y}, …]} }]
 */
import { parseXml, lokaal, kinderen, kind, afstammelingen, attr, tekstVan, getal, idUitHref } from "./xmlBoom.js";

const KNOPEN = new Set(["decision", "inputData", "businessKnowledgeModel", "knowledgeSource", "textAnnotation"]);
const REQUIREMENTS = {
  informationRequirement: ["requiredDecision", "requiredInput"],
  knowledgeRequirement: ["requiredKnowledge"],
  authorityRequirement: ["requiredAuthority", "requiredDecision", "requiredInput"],
};

/** Snelle herkenning voor de bestandskiezer (`bron.detecteer`). */
export function lijktOpDmn({ naam = "", tekst = "" } = {}) {
  if (/\.dmn$/i.test(naam)) return 0.95;
  if (/<(\w+:)?definitions[^>]*spec\/DMN\//i.test(tekst)) return 0.9;
  if (/<(\w+:)?decision\b/i.test(tekst) && /<(\w+:)?informationRequirement\b/i.test(tekst)) return 0.6;
  return 0;
}

/**
 * @param {string} tekst
 * @param {{DOMParser?: any}} [opties]
 */
export function leesDmn(tekst, opties = {}) {
  const doc = parseXml(tekst, { DOMParser: opties.DOMParser, code: "DMN-XML-ONGELDIG" });
  const wortel = doc.documentElement;
  if (lokaal(wortel) !== "definitions") {
    throw Object.assign(new Error(`Geen DMN-bestand: wortel is <${lokaal(wortel)}>, verwacht <definitions>.`), { code: "DMN-XML-ROOT" });
  }
  const waarschuwingen = [];
  const knopen = [];
  const verbindingen = [];
  let teller = 0;

  for (const el of kinderen(wortel)) {
    const aard = lokaal(el);
    const id = attr(el, "id");
    if (aard === "association") {
      verbindingen.push({ id: id || `assoc_${++teller}`, bron: attr(el, "sourceRef"), doel: attr(el, "targetRef"), aard, label: "" });
      continue;
    }
    if (!KNOPEN.has(aard)) {
      if (!["description", "extensionElements", "itemDefinition", "DMNDI", "import"].includes(aard)) {
        waarschuwingen.push({ melding: `DMN-element niet ondersteund: ${aard}`, tekst: attr(el, "name") || id });
      }
      continue;
    }
    if (!id) continue;
    const knoop = { id, tekst: aard === "textAnnotation" ? tekstVan(el, "text") : attr(el, "name"), aard };
    if (aard === "decision") knoop.vraag = tekstVan(el, "question");
    const toelichting = tekstVan(el, "description");
    if (toelichting) knoop.toelichting = toelichting;
    knopen.push(knoop);
    // Requirements: het kind noemt wat het vereist (href="#id"); de pijl loopt
    // van het vereiste naar de vereiser.
    for (const [soort, refNamen] of Object.entries(REQUIREMENTS)) {
      for (const req of kinderen(el, soort)) {
        const refEl = kinderen(req).find((k) => refNamen.includes(lokaal(k)));
        const bron = refEl ? idUitHref(attr(refEl, "href")) : "";
        if (!bron) continue;
        verbindingen.push({ id: attr(req, "id") || `${soort}_${++teller}`, bron, doel: id, aard: soort, label: "" });
      }
    }
  }

  const diagrammen = [];
  for (const di of afstammelingen(wortel, "DMNDiagram")) {
    const vormen = {};
    const lijnen = {};
    for (const shape of afstammelingen(di, "DMNShape")) {
      const bounds = kind(shape, "Bounds");
      const ref = attr(shape, "dmnElementRef");
      if (!ref || !bounds) continue;
      vormen[ref] = { x: getal(bounds, "x"), y: getal(bounds, "y"), width: getal(bounds, "width"), height: getal(bounds, "height") };
    }
    for (const edge of afstammelingen(di, "DMNEdge")) {
      const ref = attr(edge, "dmnElementRef");
      if (!ref) continue;
      lijnen[ref] = kinderen(edge, "waypoint").map((w) => ({ x: getal(w, "x"), y: getal(w, "y") }));
    }
    diagrammen.push({ id: attr(di, "id") || `diagram_${diagrammen.length + 1}`, naam: attr(di, "name"), vormen, lijnen });
  }

  return { knopen, groepen: [], verbindingen, diagrammen, waarschuwingen, naam: attr(wortel, "name") || attr(wortel, "id") || "" };
}
