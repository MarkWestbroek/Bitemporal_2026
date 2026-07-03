// @ts-check
/**
 * serialisatie — de volledige V3-route voor de 0.5-sandbox (fase 4A).
 *
 * Combineert de profiel-adapter (vanCanoniekModel/naarCanoniekModel) met de
 * bewezen V3-adapters uit store/adapters.js, en repareert daarbij één
 * oude-IDE-aanname die voor 0.5 niet klopt: storeNaarV3Model slaat het
 * default-diagram ("overzicht") over ("afgeleid, wordt bij import
 * gereconstrueerd") en v3ModelNaarStore negeert een diagrammen-entry met dat
 * id. In 0.5 is het default-diagram een gewoon, door de gebruiker
 * samengesteld diagram (hernoembaar, eigen selectie van elementen) — zonder
 * deze reparatie verdwijnt die samenstelling bij export en komt er bij import
 * een "alles-erop"-reconstructie voor terug.
 *
 * Oplossing zonder de oude adapters te wijzigen: de export voegt het
 * default-diagram zelf als diagrammen-entry (id "overzicht") toe, de import
 * herkent die entry en zet hem terug over de gereconstrueerde versie heen.
 * Oude-IDE-imports blijven zich gedragen als voorheen (die negeren de entry).
 */
import { v3ModelNaarStore, storeNaarV3Model } from "../../store/adapters.js";
import { vanCanoniekModel, naarCanoniekModel } from "./adapter.js";

const DEFAULT_DIAGRAM_ID = "overzicht";

/**
 * V3 kent geen vrije element-ids: v3ModelNaarStore leidt ze af uit namen
 * (entiteit → typenaam, GE → `<Ent>_<naam>`, relatie → naam, enum →
 * `enum_<naam>`, datatype → `dt_<naam>`, refinstantie →
 * `refinstantie_<systeemnaam>`). Diagram-entries verwijzen per elementId —
 * die moeten bij export dus naar diezelfde canonieke ids hernoemd worden,
 * anders zijn alle diagram-verwijzingen na een round-trip verweesd (elementen
 * die in 0.5 zijn aangemaakt hebben ids als `el_…`).
 *
 * @returns {Map<string, string>} oude id → canonieke V3-id
 */
function canoniekeIdMap(oudeStore) {
  const map = new Map();
  const els = oudeStore.elements || {};
  const parentVan = new Map();
  for (const e of oudeStore.structuralEdges || []) {
    if (!parentVan.has(e.target)) parentVan.set(e.target, e.source);
  }
  // Entiteiten eerst: hun canonieke id is de prefix voor gegevenselementen.
  for (const el of Object.values(els)) {
    if (el.type === "entiteit") map.set(el.id, el.data?.typenaam || el.naam || el.id);
  }
  for (const el of Object.values(els)) {
    if (map.has(el.id)) continue;
    switch (el.type) {
      case "gegevenselement": {
        const parent = parentVan.get(el.id);
        const parentId = parent ? map.get(parent) || parent : null;
        const naam = el.data?.klassenaam || el.naam || el.id;
        map.set(el.id, parentId ? `${parentId}_${naam}` : naam);
        break;
      }
      case "relatie":
        map.set(el.id, el.data?.typenaam || el.naam || el.id);
        break;
      case "enumeratie":
        map.set(el.id, `enum_${el.data?.naam || el.naam || el.id}`);
        break;
      case "gegevenstype":
        map.set(el.id, `dt_${el.data?.naam || el.naam || el.id}`);
        break;
      case "referentielijstInstantie":
        map.set(el.id, `refinstantie_${el.data?.systeemnaam || el.naam || el.id}`);
        break;
      default:
        map.set(el.id, el.id);
    }
  }
  return map;
}

/** Hernoem elementId/source/target in een V3-diagram-entry volgens de map. */
function hernoemDiagramRefs(v3Diag, idMap) {
  const her = (id) => idMap.get(id) || id;
  for (const n of v3Diag.nodes || []) n.elementId = her(n.elementId);
  for (const e of v3Diag.edges || []) {
    e.source = her(e.source);
    e.target = her(e.target);
  }
}

/** Diagram-node → V3-vorm (zelfde afspraken als storeNaarV3Model). */
function nodeNaarV3(n) {
  const out = {
    elementId: n.elementId || n.id,
    x: n.position?.x ?? 0,
    y: n.position?.y ?? 0,
  };
  if (n.width != null) out.width = n.width;
  if (n.height != null) out.height = n.height;
  return out;
}

/**
 * Diagram-edge → V3-vorm. Anders dan de named-diagram-export van
 * storeNaarV3Model nemen we `data` integraal mee: op het default-diagram is
 * die betekenisdragend (isGeneralization, isDependency, momentvoorkomen,
 * rolnaam, labelOffsets) — zonder die data verliest een volgende export de
 * generalisaties.
 */
function edgeNaarV3(e) {
  const out = { id: e.id, source: e.source, target: e.target };
  if (e.sourceHandle) out.sourceHandle = e.sourceHandle;
  if (e.targetHandle) out.targetHandle = e.targetHandle;
  if (e.animated) out.animated = true;
  if (e.data && Object.keys(e.data).length) out.data = e.data;
  return out;
}

/**
 * Exporteer de 0.5-sandbox als V3-JSON.
 *
 * @param {Object} coreState  - state van de diagramcore-store
 * @returns {{v3: Object, overgeslagen: string[]}}
 */
export function exporteerV3(coreState) {
  const { overgeslagen, ...oudeStore } = naarCanoniekModel(coreState);
  const v3 = storeNaarV3Model(oudeStore);
  const model = v3.model || v3;

  const def = oudeStore.diagrams?.[DEFAULT_DIAGRAM_ID];
  if (def && (def.nodes || []).length) {
    const entry = {
      id: DEFAULT_DIAGRAM_ID,
      naam: def.naam || "Overzicht",
      nodes: (def.nodes || []).map(nodeNaarV3),
      edges: (def.edges || []).map(edgeNaarV3),
    };
    model.diagrammen = [entry, ...(model.diagrammen || [])];
  }

  // Alle diagram-verwijzingen (ook die storeNaarV3Model zelf exporteerde)
  // hernoemen naar de canonieke V3-ids die de import zal afleiden.
  const idMap = canoniekeIdMap(oudeStore);
  for (const d of model.diagrammen || []) hernoemDiagramRefs(d, idMap);

  return { v3, overgeslagen };
}

/**
 * Importeer V3-JSON in de 0.5-sandbox (→ core-model voor laadModel).
 *
 * @param {Object} v3  - V3-object ({model: {...}} of het model zelf)
 * @returns {Object} core-model (elements/diagrams/meta)
 */
export function importeerV3(v3) {
  const store = v3ModelNaarStore(v3);
  const v3Model = v3?.model || v3;

  const def = (v3Model?.diagrammen || []).find((d) => d?.id === DEFAULT_DIAGRAM_ID);
  if (def) {
    store.diagrams = {
      ...store.diagrams,
      [DEFAULT_DIAGRAM_ID]: {
        id: DEFAULT_DIAGRAM_ID,
        naam: def.naam || "Overzicht",
        domein: def.domein || null,
        nodes: (def.nodes || [])
          .filter((n) => n.elementId && store.elements[n.elementId])
          .map((n) => {
            const out = { elementId: n.elementId, position: { x: n.x || 0, y: n.y || 0 } };
            if (n.width != null) out.width = n.width;
            if (n.height != null) out.height = n.height;
            return out;
          }),
        edges: (def.edges || []).map((e) => {
          const out = { id: e.id, source: e.source, target: e.target };
          if (e.sourceHandle) out.sourceHandle = e.sourceHandle;
          if (e.targetHandle) out.targetHandle = e.targetHandle;
          if (e.animated) out.animated = true;
          out.data = e.data || {};
          return out;
        }),
        viewport: null,
      },
    };
  }
  return vanCanoniekModel(store);
}
