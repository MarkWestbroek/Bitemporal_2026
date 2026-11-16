// 02 — de drie Waterstede-scenario's in het project, als model in de taal Simulatiemodel
// (profiel simulatiemodel05, sessie SIMULATIE 16-11). Dezelfde omzetting als de knop
// "Bewaar in het project" in de activiteit Simulatie (scenarioNaarModel), met dezelfde
// opstelling: één overzichtsdiagram (simulatie, subjecten = de drie processen, scenario's) en
// per scenario een eigen diagram met de instantie, de stubs en de verwachting.
// Alles in een nieuwe hoofdmap "9 Simulatie".
// Idempotent: staat een scenario er al (op naam), dan wordt het bijgewerkt in plaats van verdubbeld.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scenarioNaarModel } from "../../../web/vite/src/simulatie/scenarioModel.js";
import { bpmnIdUit } from "../../../web/vite/src/transformatie/bpmnXmlSchrijver.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const SIM = "simulatiemodel05";
const BPMN = "bpmnMotor05";
const MAP = { id: "map_demo_9_simulatie", naam: "9 Simulatie" };
const SCENARIOS = ["waterstede-1-buurtfeest.json", "waterstede-2-jaarmarkt.json", "waterstede-3-festival.json"];

export default async function (proj) {
  const bpmn = proj.profielen[BPMN];
  const cm = proj.profielen.diagram05;
  const sim0 = proj.profielen[SIM] || { elements: {}, diagrams: {} };
  const elements = structuredClone(sim0.elements || {});
  const diagrams = structuredClone(sim0.diagrams || {});
  const zetEl = {};
  const wisEl = new Set();
  const zetDia = {};

  let teller = 0;
  const stam = `sm_demo_${Date.now()}`;
  const nieuwId = () => `${stam}_${++teller}`;

  // De processen: elk BPMN-diagram met een startevent.
  const bpmnEl = Object.values(bpmn.elements);
  const processen = Object.values(bpmn.diagrams)
    .map((d) => ({ d, start: d.nodes.map((n) => bpmn.elements[n.elementId]).find((e) => e?.elementType === "start-event") }))
    .filter((p) => p.start);
  const opNaam = (naam, typen) => {
    const t = bpmnEl.filter((e) => e.naam === naam && (!typen || typen.includes(e.elementType)));
    return t.length === 1 ? { profielId: BPMN, elementId: t[0].id } : null;
  };
  const zoek = {
    type: (naam) => {
      const e = Object.values(cm.elements).find((x) => x.naam === naam && !x.source);
      return e ? { profielId: "diagram05", elementId: e.id } : null;
    },
    plek: (sleutel) => {
      const e = bpmnEl.find((x) => x.data?.bpmnId === sleutel) || bpmn.elements[sleutel] || bpmnEl.find((x) => x.naam === sleutel);
      return e ? { ref: { profielId: BPMN, elementId: e.id }, naam: e.naam || sleutel } : null;
    },
    start: (procesId) => {
      const p = processen.find((x) => bpmnIdUit(x.d.naam) === procesId || x.d.naam === procesId);
      return p ? { profielId: BPMN, elementId: p.start.id } : null;
    },
    einde: (naam) => opNaam(naam, ["eind-event", "taak"]),
  };
  const subjecten = processen.map((p) => ({ naam: p.d.naam, ref: { profielId: BPMN, diagramId: p.d.id } }));

  const diagramMet = (elementId, behalve = null) => Object.values(diagrams).find((d) => d.id !== behalve && d.nodes.some((n) => n.elementId === elementId)) || null;
  const zetNode = (d, elementId, x, y) => {
    if (d.nodes.some((n) => n.elementId === elementId)) return;
    d.nodes.push({ elementId, position: { x, y } });
    zetDia[d.id] = d;
  };

  for (const bestand of SCENARIOS) {
    const scenario = JSON.parse(fs.readFileSync(path.join(HIER, "..", "scenarios", bestand), "utf8"));
    const w = scenarioNaarModel(scenario, { elements, simulatieNaam: "Simulatie van de evenementaanvraag", nieuwId, subjecten, zoek });
    for (const id of w.verwijderen) {
      delete elements[id];
      wisEl.add(id);
      delete zetEl[id];
    }
    for (const e of w.toevoegen) zetEl[e.id] = elements[e.id] = e;
    for (const [id, patch] of Object.entries(w.bijwerken)) zetEl[id] = elements[id] = { ...elements[id], ...patch };

    // Opstelling zoals bewaarScenarioInProject.
    const knopen = w.toevoegen.filter((e) => !e.source);
    let overzicht = diagramMet(w.simulatieId);
    if (!overzicht) {
      overzicht = diagrams[`${stam}_overzicht`] = { id: `${stam}_overzicht`, naam: elements[w.simulatieId].naam, diagramType: "simulatie", nodes: [], edges: [] };
      zetNode(overzicht, w.simulatieId, 60, 40);
      knopen.filter((e) => e.elementType === "subject").forEach((e, i) => zetNode(overzicht, e.id, 60 + i * 290, 200));
    }
    if (w.nieuw.scenario) {
      const aantal = overzicht.nodes.filter((n) => elements[n.elementId]?.elementType === "scenario").length;
      zetNode(overzicht, w.scenarioId, 60 + aantal * 290, 380);
    }
    let eigen = diagramMet(w.scenarioId, overzicht.id);
    if (!eigen) {
      const id = `${stam}_${bpmnIdUit(scenario.naam)}`;
      eigen = diagrams[id] = { id, naam: scenario.naam, diagramType: "simulatie", nodes: [], edges: [] };
      zetNode(eigen, w.scenarioId, 60, 40);
    }
    const y0 = Math.max(240, ...eigen.nodes.map((n) => (n.position?.y || 0) + 140));
    const nieuw = new Set(knopen.map((e) => e.id));
    w.kinderen.filter((id) => nieuw.has(id)).forEach((id, i) => zetNode(eigen, id, 60 + (i % 4) * 290, y0 + Math.floor(i / 4) * 190));
  }

  const ops = [];
  if (!proj.mappen[MAP.id] && !Object.values(proj.mappen).some((m) => m.naam === MAP.naam && !m.ouderId)) ops.push({ store: "structuur", op: "nieuweMap", args: [MAP.naam, null, MAP.id] });
  const mapId = proj.mappen[MAP.id]?.id || Object.values(proj.mappen).find((m) => m.naam === MAP.naam && !m.ouderId)?.id || MAP.id;
  if (Object.keys(zetDia).length) ops.push({ store: `model:${SIM}`, op: "patchDiagrammen", args: [{ zet: zetDia, wis: [] }] });
  if (Object.keys(zetEl).length || wisEl.size) ops.push({ store: `model:${SIM}`, op: "patchElementen", args: [{ zet: zetEl, wis: [...wisEl] }] });
  const keys = [
    ...Object.keys(diagrams).map((id) => `${SIM}::${id}`),
    ...Object.values(elements).filter((e) => !e.source).map((e) => `el::${SIM}::${e.id}`),
  ].filter((k) => proj.plaatsing[k] !== mapId);
  if (keys.length) ops.push({ store: "structuur", op: "plaatsPerMap", args: [{ [mapId]: keys }] });
  return ops;
}
