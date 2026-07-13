/**
 * transformaties — map-helpers + de ingebouwde generatoren
 * (import/export/transform). Zie transformatieRegistry.js voor het contract.
 *
 * De "map" is (als in EA) de logische model-eenheid: de elementen en
 * diagrammen die erin geplaatst zijn vormen samen het model dat de basis is
 * van een transformatie.
 */
import { registreerTransformatie } from "./transformatieRegistry.js";
import { getProfieltype } from "../profieltypeRegistry";
import { useModellerenStore } from "./modellerenActivity.jsx";

let _teller = 0;
const versId = (voor) => `${voor}__t${Date.now()}_${_teller++}`;

// ── Map-inhoud verzamelen ───────────────────────────────────────────
/** { [profielId]: { elementen:Set, diagrammen:Set } } uit de plaatsing. */
export function mapInhoud(mapId) {
  const { plaatsing } = useModellerenStore.getState();
  const perProfiel = {};
  const zorg = (pid) => (perProfiel[pid] ??= { elementen: new Set(), diagrammen: new Set() });
  for (const [key, mid] of Object.entries(plaatsing)) {
    if (mid !== mapId) continue;
    if (key.startsWith("el::")) {
      const [, profielId, elementId] = key.split("::");
      zorg(profielId).elementen.add(elementId);
    } else {
      const [profielId, diagramId] = key.split("::");
      zorg(profielId).diagrammen.add(diagramId);
    }
  }
  return perProfiel;
}

/** Profieltype-ids met inhoud in de map. */
export function mapProfielen(mapId) {
  return Object.keys(mapInhoud(mapId));
}

/**
 * Het model van een map per profiel: de geplaatste diagrammen (met hun
 * elementen), de los geplaatste elementen, en de connectoren tussen alle
 * betrokken elementen. { [profielId]: { diagramTypeId, elements, diagrams,
 * viewports, meta } }.
 */
export function collectMapModel(mapId) {
  const inhoud = mapInhoud(mapId);
  const result = {};
  for (const [profielId, { elementen, diagrammen }] of Object.entries(inhoud)) {
    const p = getProfieltype(profielId);
    if (!p) continue;
    const st = p.useStore.getState();
    const elemIds = new Set(elementen);
    const diagrams = {};
    const viewports = {};
    for (const dId of diagrammen) {
      const d = st.diagrams[dId];
      if (!d) continue;
      diagrams[dId] = d;
      if (st.viewports?.[dId]) viewports[dId] = st.viewports[dId];
      for (const n of d.nodes || []) elemIds.add(n.elementId);
    }
    // Connectoren tussen betrokken elementen meenemen.
    for (const el of Object.values(st.elements)) {
      if (el.source && el.target && elemIds.has(el.source) && elemIds.has(el.target)) elemIds.add(el.id);
    }
    const elements = {};
    for (const id of elemIds) if (st.elements[id]) elements[id] = st.elements[id];
    result[profielId] = {
      diagramTypeId: st.diagramTypeId,
      elements,
      diagrams,
      viewports,
      meta: st.meta,
      geplaatst: { elementen: [...elementen], diagrammen: [...diagrammen] },
    };
  }
  return result;
}

// ── Ingebouwde generatoren ──────────────────────────────────────────

// Export: de map als JSON-bestand (elementen + diagrammen per profiel).
registreerTransformatie({
  id: "export-map-json",
  label: "Map → JSON-bestand (elementen + diagrammen)",
  richting: "export",
  profielTypes: "*",
  toelichting: "Bundelt de inhoud van deze map als één JSON — deelbaar en te herimporteren.",
  run: async ({ mapId, mapNaam }) => {
    const model = collectMapModel(mapId);
    const data = { formaat: "studio-map-export", versie: 1, map: mapNaam, geexporteerd: new Date().toISOString(), profielen: model };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `map-${(mapNaam || "export").replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
});

// Import: een JSON-map-export terug in de huidige map plaatsen.
registreerTransformatie({
  id: "import-map-json",
  label: "JSON-map-export → in deze map",
  richting: "import",
  profielTypes: "*",
  toelichting: "Leest een eerder geëxporteerde map-JSON en voegt de inhoud aan deze map toe.",
  run: async ({ mapId, bron }) => {
    const tekst = bron?.tekst;
    if (!tekst) return;
    let data;
    try {
      data = JSON.parse(tekst);
    } catch {
      window.alert("Geen geldig JSON-bestand.");
      return;
    }
    if (data?.formaat !== "studio-map-export") {
      window.alert("Dit is geen map-export (formaat 'studio-map-export' ontbreekt).");
      return;
    }
    const ms = useModellerenStore.getState();
    for (const [profielId, inhoud] of Object.entries(data.profielen || {})) {
      const p = getProfieltype(profielId);
      if (!p) continue;
      const st = p.useStore.getState();
      // Elementen toevoegen die nog niet bestaan (id behouden).
      for (const el of Object.values(inhoud.elements || {})) {
        if (!st.elements[el.id]) st.addElement(el);
      }
      // Diagrammen met een verse id (niet overschrijven), in de map plaatsen.
      for (const d of Object.values(inhoud.diagrams || {})) {
        const nieuwId = versId(d.id);
        st.addDiagram({ ...d, id: nieuwId, naam: `${d.naam} (import)` });
        ms.plaatsDiagram(`${profielId}::${nieuwId}`, mapId);
      }
    }
  },
});

// Transform: de map-inhoud kopiëren naar een (nieuwe of bestaande) doelmap.
registreerTransformatie({
  id: "kopieer-map",
  label: "Kopieer map-inhoud naar een map",
  richting: "transform",
  profielTypes: "*",
  toelichting: "Dupliceert de elementen en diagrammen van deze map (met verse id's) naar de doelmap.",
  run: async ({ mapId, doel }) => {
    const ms = useModellerenStore.getState();
    let doelMapId = doel?.mapId;
    if (doel?.type === "nieuweMap") {
      doelMapId = ms.nieuweMap(doel.naam || "Kopie");
    }
    if (!doelMapId) return;
    const model = collectMapModel(mapId);
    for (const [profielId, inhoud] of Object.entries(model)) {
      const p = getProfieltype(profielId);
      if (!p) continue;
      const st = p.useStore.getState();
      // Verse id's, met remapping van source/target en diagram-nodes/edges.
      const idMap = {};
      for (const id of Object.keys(inhoud.elements || {})) idMap[id] = versId(id);
      for (const [id, el] of Object.entries(inhoud.elements || {})) {
        const nieuw = { ...el, id: idMap[id] };
        if (el.source) nieuw.source = idMap[el.source] || el.source;
        if (el.target) nieuw.target = idMap[el.target] || el.target;
        st.addElement(nieuw);
      }
      for (const [id, el] of Object.entries(inhoud.elements || {})) {
        // Los geplaatste elementen: de kopie ook in de doelmap plaatsen.
        if (inhoud.geplaatst?.elementen?.includes(id)) {
          ms.plaatsDiagram(`el::${profielId}::${idMap[id]}`, doelMapId);
        }
      }
      for (const [dId, d] of Object.entries(inhoud.diagrams || {})) {
        const nieuwId = versId(dId);
        st.addDiagram({
          ...d,
          id: nieuwId,
          naam: `${d.naam} (kopie)`,
          nodes: (d.nodes || []).map((n) => ({ ...n, elementId: idMap[n.elementId] || n.elementId })),
          edges: (d.edges || []).map((e) => ({ ...e, source: idMap[e.source] || e.source, target: idMap[e.target] || e.target })),
        });
        ms.plaatsDiagram(`${profielId}::${nieuwId}`, doelMapId);
      }
    }
  },
});
