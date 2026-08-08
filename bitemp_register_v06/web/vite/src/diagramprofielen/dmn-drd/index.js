// @ts-check
/**
 * dmn-drd — DMN Decision Requirements Diagram (DRD) als diagramprofiel:
 * het vierde profiel op de generieke motor, puur declaratief.
 *
 *   - decision («decision»): de beslissing zelf (rechthoek).
 *   - inputData: gegevensinvoer (ShapeType "dmn-input-data", stadium/ovaal).
 *   - bkm: Business Knowledge Model ("dmn-bkm", afgeknipte hoeken).
 *   - knowledgeSource: autoriteit/bron ("dmn-knowledge-source",
 *     golvende onderrand). De vorm is in DMN de betekenis — geen
 *     stereotypes nodig.
 *
 *   - information requirement: dichte lijn met pijl naar de beslissing.
 *   - knowledge requirement:   gestippeld met open pijl (vanuit een BKM).
 *   - authority requirement:   gestippeld met bolpunt ("bol").
 *
 * De boom nest omgekeerd (hierarchie met `omgekeerd`): de pijlen wijzen
 * náár de beslissing, maar in de boom is de beslissing de ouder van haar
 * vereisten — zo lees je het DRD van eindbeslissing naar bronnen.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";

export const DMN_DRD_ID = "dmn-drd";

const KLEUR_VELD = { key: "kleur", datatype: "colour" };
const AFNEMERS = ["decision", "bkm", "knowledgeSource"];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "decision",
    label: "Beslissing",
    kort: "DEC",
    shape: "class-box",
    kleur: "#dbeafe",
    icoon: "beslissing",
    properties: [
      KLEUR_VELD,
      { key: "vraag", label: "vraag (question)", datatype: "tekst" },
      { key: "toelichting", label: "toelichting", datatype: "tekst" },
    ],
  },
  {
    id: "inputData",
    label: "Invoergegeven",
    kort: "IN",
    shape: "dmn-input-data",
    kleur: "#dcfce7",
    icoon: "invoer",
    properties: [KLEUR_VELD, { key: "toelichting", label: "toelichting", datatype: "tekst" }],
  },
  {
    id: "bkm",
    label: "Business Knowledge Model",
    kort: "BKM",
    shape: "dmn-bkm",
    kleur: "#fef9c3",
    icoon: "kennisregel",
    properties: [KLEUR_VELD, { key: "toelichting", label: "toelichting", datatype: "tekst" }],
  },
  {
    id: "knowledgeSource",
    label: "Kennisbron",
    kort: "KS",
    shape: "dmn-knowledge-source",
    kleur: "#fde68a",
    icoon: "kennisbron",
    properties: [KLEUR_VELD, { key: "toelichting", label: "toelichting", datatype: "tekst" }],
  },
  {
    id: "notitie",
    label: "Notitie",
    kort: "NOT",
    shape: "note",
    icoon: "notitie",
    handleStijl: "onzichtbaar",
    properties: [{ key: "tekst", datatype: "tekst" }, KLEUR_VELD],
  },
  {
    id: "boundary",
    label: "Kader",
    kort: "KADER",
    shape: "boundary",
    icoon: "kader",
    achtergrond: true,
    handleStijl: "onzichtbaar",
    properties: [
      { key: "kleur", label: "rand", datatype: "colour" },
      { key: "achtergrondKleur", label: "achtergrond", datatype: "colour" },
    ],
  },

  // ── Connectoren (requirements wijzen naar de afhankelijke beslissing) ──
  {
    id: "infoReq",
    label: "Information requirement",
    kort: "→ info",
    shape: "edge",
    icoon: "informatie-eis",
    isConnector: true,
    bron: { elementTypes: ["inputData", "decision"] },
    doel: { elementTypes: ["decision"] },
    // DMN: dichte lijn met gevulde pijlpunt naar de beslissing.
    edgePresentatie: { lijn: "solid", kleur: "#334155", markerEnd: "pijl-dicht" },
  },
  {
    id: "knowReq",
    label: "Knowledge requirement",
    kort: "⇢ kennis",
    shape: "edge",
    icoon: "kennis-eis",
    isConnector: true,
    bron: { elementTypes: ["bkm"] },
    doel: { elementTypes: ["decision", "bkm"] },
    edgePresentatie: { lijn: "dash-6-3", kleur: "#0d9488", markerEnd: "pijl-open" },
  },
  {
    // DMN: gestippeld met een bolpunt aan het afhankelijke einde.
    id: "authReq",
    label: "Authority requirement",
    kort: "⇢ autoriteit",
    shape: "edge",
    icoon: "autoriteit-eis",
    isConnector: true,
    bron: { elementTypes: ["knowledgeSource", "decision", "inputData"] },
    doel: { elementTypes: AFNEMERS },
    edgePresentatie: { lijn: "dash-4-3", kleur: "#94a3b8", markerEnd: "bol" },
  },
];

/**
 * DRD-lagen-layout: eindbeslissingen (nergens bron van een requirement)
 * bovenaan, daaronder per requirement-stap hun vereisten; volgende rijen
 * sorteren op het zwaartepunt van hun (al geplaatste) afnemers — zelfde
 * leesrichting als een DRD in de DMN-spec.
 *
 * @param {{ids: string[], elements: Record<string, any>, edges: {source: string, target: string}[], perRij?: number}} opties
 */
export function drdRijenPosities({ ids, elements, edges, perRij = 5 }) {
  const idSet = new Set(ids);
  const reqEdges = (edges || []).filter((e) => idSet.has(e.source) && idSet.has(e.target));
  const isBron = new Set(reqEdges.map((e) => e.source));
  const laag = new Map();
  // Laag 0: afnemers die zelf nergens bron zijn (de eindbeslissingen);
  // zonder edges vallen alle beslissingen daar.
  let rand = ids.filter(
    (eid) => !isBron.has(eid) && elements?.[eid]?.elementType === "decision"
  );
  if (!rand.length) rand = ids.filter((eid) => elements?.[eid]?.elementType === "decision");
  rand.forEach((eid) => laag.set(eid, 0));
  let diepte = 0;
  while (rand.length) {
    diepte += 1;
    const volgende = [];
    for (const naarId of rand) {
      for (const e of reqEdges) {
        if (e.target !== naarId || laag.has(e.source)) continue;
        laag.set(e.source, diepte);
        volgende.push(e.source);
      }
    }
    rand = volgende;
  }
  const maxLaag = Math.max(0, ...laag.values());
  for (const eid of ids) if (!laag.has(eid)) laag.set(eid, maxLaag + 1);

  const perLaag = new Map();
  for (const eid of ids) {
    const l = laag.get(eid);
    if (!perLaag.has(l)) perLaag.set(l, []);
    perLaag.get(l).push(eid);
  }
  const posities = {};
  let y = 60;
  for (const l of [...perLaag.keys()].sort((a, b) => a - b)) {
    const groep = perLaag.get(l);
    const zwaartepunt = (eid) => {
      const xs = reqEdges
        .filter((e) => e.source === eid)
        .map((e) => posities[e.target]?.x)
        .filter((x) => x !== undefined);
      return xs.length ? xs.reduce((som, x) => som + x, 0) / xs.length : Infinity;
    };
    groep.sort((a, b) => {
      const za = zwaartepunt(a);
      const zb = zwaartepunt(b);
      if (za !== zb) return za - zb;
      return (elements?.[a]?.naam || a).localeCompare(elements?.[b]?.naam || b);
    });
    groep.forEach((eid, i) => {
      posities[eid] = { x: 80 + (i % perRij) * 300, y: y + Math.floor(i / perRij) * 220 };
    });
    y += Math.ceil(groep.length / perRij) * 220 + 60;
  }
  return posities;
}

export const dmnDrdDiagramType = {
  id: DMN_DRD_ID,
  label: "DMN DRD",
  style: "uml-klassiek",
  // Connectoren hechten aan de omtrek i.p.v. aan vier handles: dozen
  // dragen vaak veel lijnen, en die moeten kunnen uitwaaieren.
  randAanhechting: "zwevend",
  // Omgekeerde hiërarchie: de requirement-pijl wijst náár de beslissing,
  // maar in de boom is de beslissing de ouder van haar vereisten.
  hierarchie: [{ type: "infoReq", omgekeerd: true }, { type: "knowReq", omgekeerd: true }],
  fieldTypes: [],
  elementTypes,
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
    { id: "auto-layout", label: "Auto-layout", acties: "layouts" },
  ],
  layouts: [
    {
      id: "drd-lagen",
      label: "Auto-layout",
      run: ({ flowNodes, flowEdges, elements }) =>
        drdRijenPosities({
          ids: flowNodes.filter((n) => !n.hidden).map((n) => n.id),
          elements,
          edges: flowEdges || [],
        }),
    },
  ],
};

let _teller = 0;

/** Nieuw (niet-connector-)element van het gegeven type. */
export function maakElement(elementTypeId) {
  const et = elementTypes.find((t) => t.id === elementTypeId);
  if (!et || et.isConnector) return null;
  _teller += 1;
  const element = {
    id: `drd_${Date.now()}_${_teller}`,
    naam: `Nieuwe${et.label.replace(/[^A-Za-z]/g, "")}`,
    elementType: et.id,
    compartimenten: [],
    data: {},
  };
  if (et.id === "notitie") {
    element.naam = "";
    element.data.tekst = "";
  }
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerDmnDrd() {
  if (!getDiagramType(DMN_DRD_ID)) {
    registreerDiagramType(dmnDrdDiagramType);
  }
}
