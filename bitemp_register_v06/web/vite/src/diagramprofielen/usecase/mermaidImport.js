// @ts-check
/**
 * mermaidImport — de Studio-transformatie "Mermaid flowchart → use case-model".
 *
 * Route (zie docs/TRANSFORMATIES.md):
 *
 *   tekst ──lezer──▶ brongraaf ──regelset──▶ plan ──▶ core-model ──▶ profiel usecase05
 *          mermaidFlowchart   mermaidRegels    (dit bestand: ids, hergebruik,
 *                             + regels.js       verbindingsregels, layout)
 *
 * Dit bestand kent het doel (de store en het profiel), niet de bron: welke
 * Mermaid-vorm wat wordt staat in `mermaidRegels.js`. Opzet volgt
 * `archimate/exchange/archimateImport.js`: de stores worden geïnjecteerd,
 * zodat het hele pad zonder React testbaar blijft.
 */
import { registreerTransformatie } from "../../studio/activities/transformatieRegistry.js";
import { verbindingsregelsVan } from "../../diagramcore/types/typeRegistry.js";
import { leesMermaidFlowcharts, lijktOpMermaidFlowchart } from "../../transformatie/mermaidFlowchart.js";
import { pasRegelsToe } from "../../transformatie/regels.js";
import { legUit } from "../../transformatie/kolommenLayout.js";
import { MERMAID_NAAR_USECASE } from "./mermaidRegels.js";

const PROFIEL_ID = "usecase05";
// Gelijk aan USECASE_ID in ./index.js; dat bestand laadt .jsx-shapes en is
// daarom niet importeerbaar in de node-testrunner.
const DIAGRAMTYPE_ID = "usecase";

const ACTOR_BREEDTE = 64; // vaste maat van de strekfiguur (shapes.jsx)

const slug = (tekst) =>
  String(tekst || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

const regelsNodig = (tekst, perRegel) =>
  String(tekst || "").split("\n").reduce((som, regel) => som + Math.max(1, Math.ceil(regel.length / perRegel)), 0);

/** Celmaat per elementtype voor de layout (een schatting van wat de shape tekent). */
function celMaat(type, element) {
  if (type === "actor") return { breedte: 130, hoogte: 58 + 16 * regelsNodig(element.naam, 18) };
  if (type === "usecase") return { breedte: 190, hoogte: Math.max(64, 28 + 18 * regelsNodig(element.naam, 24)) };
  if (type === "systeem") return { breedte: 240, hoogte: 160 };
  return { breedte: 240, hoogte: 44 + 18 * regelsNodig(element.data?.tekst, 36) };
}

/**
 * Zet Mermaid-tekst om naar een core-model voor het use case-profiel. Puur:
 * leest de bestaande toestand alleen om ids uniek te houden en elementen met
 * dezelfde naam te hergebruiken.
 *
 * @param {string} tekst
 * @param {Object} [opts]
 * @param {{elements?: Record<string, any>, diagrams?: Record<string, any>}} [opts.bestaand]
 * @param {any[]} [opts.elementTypes]   - ElementTypes van het profiel (verbindingsregels, containers)
 * @param {boolean} [opts.hergebruik]   - zelfde type + naam = hetzelfde element (default aan)
 * @param {string} [opts.bestandsnaam]
 * @param {any} [opts.regelset]
 */
export function mermaidNaarUsecaseModel(tekst, { bestaand = {}, elementTypes = [], hergebruik = true, bestandsnaam = "", regelset = MERMAID_NAAR_USECASE } = {}) {
  const grafen = leesMermaidFlowcharts(tekst);
  const bestaandeElementen = bestaand.elements || {};
  const typeVan = new Map(elementTypes.map((et) => [et.id, et]));
  const elements = {};
  const diagrams = {};
  const diagnostics = [];
  const trace = [];
  /** Toelichtingen voor al bestaande elementen die er nog geen hadden. */
  const aanvullingen = [];
  const stats = { diagrammen: 0, nieuw: {}, hergebruikt: 0, connectoren: 0 };

  const bezet = (id) => !!bestaandeElementen[id] || !!elements[id] || !!bestaand.diagrams?.[id] || !!diagrams[id];
  const uniek = (basis) => {
    let id = basis;
    for (let n = 2; bezet(id); n += 1) id = `${basis}_${n}`;
    return id;
  };

  // Index voor hergebruik: elementen op type + naam, connectoren op type + uiteinden.
  const naamSleutel = (type, naam) => `${type}|${String(naam || "").trim().toLowerCase()}`;
  const connectorSleutel = (type, bron, doel) => `${type}|${bron}|${doel}`;
  const opNaam = new Map();
  const opUiteinden = new Map();
  for (const el of Object.values(bestaandeElementen)) {
    if (el.source && el.target) opUiteinden.set(connectorSleutel(el.elementType, el.source, el.target), el.id);
    else if (el.naam) opNaam.set(naamSleutel(el.elementType, el.naam), el.id);
  }
  const typeVanId = (id) => (elements[id] || bestaandeElementen[id])?.elementType;
  const magVerbinden = (connectorType, bronId, doelId) => {
    const et = typeVan.get(connectorType);
    if (!et) return !typeVan.size; // zonder profielkennis niet toetsen
    return verbindingsregelsVan(et).some((r) => r.bron.includes(typeVanId(bronId)) && r.doel.includes(typeVanId(doelId)));
  };

  grafen.forEach((graaf, index) => {
    const waar = grafen.length > 1 ? `diagram ${index + 1}` : null;
    const meld = (d) => diagnostics.push({ ...d, path: [waar, d.path].filter(Boolean).join(", ") || null });
    for (const w of graaf.waarschuwingen) {
      meld({ severity: "warning", code: "MMD-SYNTAX", message: `${w.melding}${w.tekst ? `: ${w.tekst}` : ""}`, sourceId: null, path: w.regel ? `regel ${w.regel}` : null });
    }
    const plan = pasRegelsToe(graaf, regelset);
    plan.diagnostics.forEach(meld);
    trace.push(...plan.trace.map((spoor) => ({ ...spoor, diagram: index })));

    // Plan-elementen → model-elementen (nieuw of hergebruikt).
    const idVan = new Map(); // sleutel in het plan → element-id
    for (const pe of plan.elementen) {
      const sleutel = naamSleutel(pe.type, pe.naam);
      const bekend = hergebruik && pe.naam ? opNaam.get(sleutel) : undefined;
      if (bekend) {
        idVan.set(pe.sleutel, bekend);
        const toelichting = pe.data?.toelichting;
        if (elements[bekend]) {
          if (toelichting && !elements[bekend].data.toelichting) elements[bekend].data.toelichting = toelichting;
        } else {
          stats.hergebruikt += 1;
          meld({ severity: "info", code: "UC-HERGEBRUIKT", message: `Bestaand element hergebruikt (${pe.type})`, sourceId: pe.naam, path: null });
          if (toelichting && !bestaandeElementen[bekend].data?.toelichting && !aanvullingen.some((a) => a.id === bekend)) {
            aanvullingen.push({ id: bekend, data: { toelichting } });
          }
        }
        continue;
      }
      const id = uniek(`uc_${slug(pe.naam) || slug(pe.sleutel) || pe.type}`);
      elements[id] = { id, naam: pe.naam, elementType: pe.type, compartimenten: [], data: { ...pe.data } };
      idVan.set(pe.sleutel, id);
      if (pe.naam) opNaam.set(sleutel, id);
      stats.nieuw[pe.type] = (stats.nieuw[pe.type] || 0) + 1;
    }

    const voegConnectorToe = (type, bron, doel, naam, data, sourceId) => {
      if (bron === doel) return;
      if (!magVerbinden(type, bron, doel)) {
        meld({ severity: "warning", code: "UC-VERBINDINGSREGEL", message: `Het profiel staat ${type} van ${typeVanId(bron)} naar ${typeVanId(doel)} niet toe; niet overgenomen`, sourceId, path: null });
        return;
      }
      const sleutel = connectorSleutel(type, bron, doel);
      if (opUiteinden.has(sleutel)) return; // bestond al, of dubbel in de bron
      const id = uniek(`uc_${type}_${bron.replace(/^uc_/, "")}_${doel.replace(/^uc_/, "")}`);
      elements[id] = { id, naam: naam || "", elementType: type, source: bron, target: doel, compartimenten: [], data: { ...data } };
      opUiteinden.set(sleutel, id);
      stats.connectoren += 1;
    };

    // Lidmaatschap van een container: de connector die het containertype noemt.
    const groepVan = new Map();
    for (const pe of plan.elementen) {
      if (pe.groep == null) continue;
      const lid = idVan.get(pe.sleutel);
      const container = idVan.get(pe.groep);
      const lidType = typeVan.get(typeVanId(container))?.containerVoor || "bevat";
      if (!container || lid === container) continue;
      if (!magVerbinden(lidType, container, lid)) {
        meld({ severity: "info", code: "UC-BUITEN-KADER", message: `Een ${typeVanId(lid)} kan geen lid zijn van een ${typeVanId(container)}; buiten het kader geplaatst`, sourceId: pe.sleutel, path: null });
        continue;
      }
      voegConnectorToe(lidType, container, lid, "", {}, pe.sleutel);
      groepVan.set(lid, container);
    }
    for (const pc of plan.connectoren) {
      voegConnectorToe(pc.type, idVan.get(pc.bron), idVan.get(pc.doel), pc.naam, pc.data, pc.sleutel);
    }

    // Diagram met een automatische startopstelling.
    const opDiagram = [...new Set(plan.elementen.map((pe) => idVan.get(pe.sleutel)))];
    const element = (id) => elements[id] || bestaandeElementen[id];
    const plekken = legUit({
      knopen: opDiagram.map((id) => ({
        id,
        groep: groepVan.get(id) ?? null,
        container: !!typeVan.get(typeVanId(id))?.containerVoor || typeVanId(id) === "systeem",
        ...celMaat(typeVanId(id), element(id)),
      })),
      verbindingen: plan.connectoren.map((pc) => ({ bron: idVan.get(pc.bron), doel: idVan.get(pc.doel) })),
    });
    const nodes = [];
    for (const [id, plek] of plekken) {
      const type = typeVanId(id);
      if (type === "actor") nodes.push({ elementId: id, position: { x: plek.x + Math.round((plek.breedte - ACTOR_BREEDTE) / 2), y: plek.y } });
      else if (type === "notitie") nodes.push({ elementId: id, position: { x: plek.x, y: plek.y } });
      else nodes.push({ elementId: id, position: { x: plek.x, y: plek.y }, size: { width: plek.breedte, height: plek.hoogte } });
    }
    // Containers eerst (buitenste voorop): ouders vóór hun leden.
    const diepte = (id) => (groepVan.has(id) ? diepte(groepVan.get(id)) + 1 : 0);
    const isContainer = (id) => typeVanId(id) === "systeem";
    nodes.sort((a, b) => Number(isContainer(b.elementId)) - Number(isContainer(a.elementId)) || diepte(a.elementId) - diepte(b.elementId));

    const naam = graaf.titel || [String(bestandsnaam || "").replace(/\.[^.]+$/, ""), grafen.length > 1 ? index + 1 : ""].filter(Boolean).join(" ") || "Mermaid-import";
    const diagramId = uniek(`uc_diagram_${slug(naam) || index + 1}`);
    diagrams[diagramId] = { id: diagramId, naam, diagramType: DIAGRAMTYPE_ID, nodes, edges: [] };
    stats.diagrammen += 1;
  });

  return { core: { elements, diagrams }, aanvullingen, diagnostics, trace, stats };
}

const AANTAL = [
  ["actor", "actor", "actoren"],
  ["usecase", "use case", "use cases"],
  ["systeem", "systeemkader", "systeemkaders"],
  ["notitie", "notitie", "notities"],
];

function samenvatting(stats) {
  const delen = AANTAL.filter(([type]) => stats.nieuw[type]).map(([type, een, meer]) => `${stats.nieuw[type]} ${stats.nieuw[type] === 1 ? een : meer}`);
  delen.push(`${stats.connectoren} ${stats.connectoren === 1 ? "relatie" : "relaties"}`);
  const hergebruikt = stats.hergebruikt ? `; ${stats.hergebruikt} bestaande hergebruikt` : "";
  return `${stats.diagrammen} ${stats.diagrammen === 1 ? "diagram" : "diagrammen"}: ${delen.join(", ")} geïmporteerd${hergebruikt}`;
}

/**
 * @param {{getProfieltype: (id:string)=>any, getModellerenState: ()=>any}} deps
 */
export function registreerMermaidUsecaseImport({ getProfieltype, getModellerenState }) {
  registreerTransformatie({
    id: "import-mermaid-usecase",
    label: "Mermaid flowchart → use case-model",
    richting: "import",
    profielTypes: [PROFIEL_ID],
    toelichting:
      "Leest een Mermaid flowchart als use case-model: cirkels worden actoren, stadions use cases, " +
      "subgraphs systeemkaders; «include»/«extend»/specialisatie worden de bijbehorende relaties en " +
      "een notitie aan een element wordt de toelichting van dat element. Meerdere flowcharts in één " +
      "bestand geven meerdere diagrammen op één model.",
    bron: {
      types: ["file"],
      accept: [".mmd", ".mermaid", ".md", ".txt"],
      mediaTypes: ["text/plain", "text/markdown"],
      detecteer: lijktOpMermaidFlowchart,
    },
    opties: [
      { key: "hergebruik", label: "Bestaande elementen met dezelfde naam hergebruiken", datatype: "boolean", default: true },
    ],
    run: async ({ bron, doelMap, opties = {} }) => {
      if (!bron?.tekst) throw new Error("Kies een bestand met Mermaid flowchart-tekst.");
      const modelleren = getModellerenState();
      if (!doelMap || !modelleren?.mappen?.[doelMap]) throw new Error("Kies een bestaande doelmap.");
      const profiel = getProfieltype(PROFIEL_ID);
      if (!profiel?.useStore?.getState) throw new Error("Het use case-profiel is niet beschikbaar.");

      const staat = profiel.useStore.getState();
      const resultaat = mermaidNaarUsecaseModel(bron.tekst, {
        bestaand: { elements: staat.elements, diagrams: staat.diagrams },
        elementTypes: profiel.descriptor?.elementTypes || [],
        hergebruik: opties.hergebruik !== false,
        bestandsnaam: bron.naam,
      });
      const diagramIds = Object.keys(resultaat.core.diagrams);
      if (!diagramIds.length) throw new Error("Geen Mermaid flowchart gevonden (verwacht een regel als `flowchart LR`).");

      // Eerst de atomaire modelmutatie (valideert ids en referenties), dan pas
      // de plaatsing in de map — zoals de ArchiMate-import. Bestaande elementen
      // worden nooit overschreven; alleen een nog lege toelichting wordt gevuld.
      staat.importeerModel(resultaat.core, { modus: "toevoegen" });
      for (const { id, data } of resultaat.aanvullingen) profiel.useStore.getState().updateElement(id, { data });
      for (const diagramId of diagramIds) modelleren.plaatsDiagram(`${PROFIEL_ID}::${diagramId}`, doelMap);

      const waarschuwingen = resultaat.diagnostics.filter((d) => d.severity === "warning").length;
      return {
        status: waarschuwingen ? "warning" : "success",
        summary: samenvatting(resultaat.stats),
        diagnostics: resultaat.diagnostics,
        created: { profielId: PROFIEL_ID, diagramIds, elementIds: Object.keys(resultaat.core.elements) },
      };
    },
  });
}
