/**
 * useModelStore — Zustand store voor het domeinmodel.
 *
 * Bevat alle elementen (entiteiten, GE's, relaties, enums, datatypes,
 * referentielijstInstanties) als flat Record<id, element>,
 * plus structurele relaties (edges) en diagramdefinities.
 *
 * De posities zitten NIET in de elementen maar in de diagrammen.
 * Eén element kan op meerdere diagrammen voorkomen.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { temporal } from "zundo";

/**
 * @typedef {Object} ModelElement
 * @property {string} id          - Unieke ID (bijv. "A", "A_U", "enum_Geslacht", "dt_BSN")
 * @property {string} naam        - Weergavenaam
 * @property {string} type        - Node-type: "entiteit"|"gegevenselement"|"relatie"|"enumeratie"|"gegevenstype"|"referentielijstInstantie"
 * @property {string} domein      - Domein/package
 * @property {object} data        - Alle type-specifieke data (velden, waarden, etc.)
 */

/**
 * @typedef {Object} DiagramDef
 * @property {string} id
 * @property {string} naam
 * @property {string} domein      - Optioneel: domein-scope van het diagram
 * @property {Array}  nodes       - Visuele nodes: [{ elementId, position: {x,y} }]
 * @property {Array}  edges       - Visuele edges: [{ id, source, target, sourceHandle, targetHandle, data }]
 * @property {object} viewport    - { x, y, zoom }
 */

const DEFAULT_DIAGRAM_ID = "overzicht";

/** Strip viewport uit diagrammen zodat pan/zoom geen undo-entries genereren. */
function stripDiagramViewport(diagrams) {
  if (!diagrams) return diagrams;
  const result = {};
  for (const [id, d] of Object.entries(diagrams)) {
    const { viewport, ...rest } = d;
    result[id] = rest;
  }
  return result;
}

const useModelStore = create(
  persist(
    temporal(
      (set, get) => ({
      // === Model data ===
      /** @type {Record<string, ModelElement>} */
      elements: {},

      /** @type {Array<{id, source, target, data}>} */
      structuralEdges: [],

      /** @type {Record<string, DiagramDef>} */
      diagrams: {},

      /** @type {string[]} Gesorteerde domein-namen */
      domains: [],

      /** @type {Record<string, {beschrijving?: string, kleur?: string, prefix?: string}>} */
      domainMeta: {},

      /** @type {object|null} Bron-metadata (bron, build_versie, id, indiener, etc.) */
      modelMeta: null,

      /** @type {boolean} True als er onopgeslagen wijzigingen zijn sinds laden/opslaan */
      isDirty: false,

      // === Acties: Model ===

      /** Laad een volledig model (vanuit adapter). Vervangt alles. Zet isDirty op false. */
      loadModel: ({ elements, structuralEdges, diagrams, domains, domainMeta, modelMeta }) =>
        set({
          elements: elements || {},
          structuralEdges: structuralEdges || [],
          diagrams: diagrams || {},
          domains: domains || [],
          domainMeta: domainMeta || {},
          modelMeta: modelMeta || null,
          isDirty: false,
        }),

      /** Reset het model */
      clearModel: () =>
        set({
          elements: {},
          structuralEdges: [],
          diagrams: {},
          domains: [],
          domainMeta: {},
          modelMeta: null,
          isDirty: false,
        }),

      /** Markeer het model als opgeslagen (isDirty = false). */
      markSaved: () => set({ isDirty: false }),

      /**
       * Update een element. `patch` kan top-level velden bevatten (naam, domein)
       * en/of een genest `data`-object dat gemerged wordt met bestaande data.
       *
       * Voorbeelden:
       *   updateElement(id, { naam: "NieuweNaam" })              — alleen top-level
       *   updateElement(id, { data: { description: "..." } })    — alleen data
       *   updateElement(id, { naam: "X", data: { kleur: "#f0f" } }) — beide
       */
      updateElement: (id, patch) =>
        set((state) => {
          const el = state.elements[id];
          if (!el) return state;
          const { data: dataPatch, ...topPatch } = patch;
          return {
            isDirty: true,
            elements: {
              ...state.elements,
              [id]: {
                ...el,
                ...topPatch,
                data: dataPatch !== undefined ? { ...el.data, ...dataPatch } : el.data,
              },
            },
          };
        }),

      // === Acties: Domeinen ===

      /** Voeg een nieuw domein toe */
      addDomain: (naam) =>
        set((state) => {
          if (state.domains.includes(naam)) return state;
          return { isDirty: true, domains: [...state.domains, naam].sort() };
        }),

      /** Verwijder een domein (elementen behouden, domein wordt leeg) */
      removeDomain: (naam) =>
        set((state) => ({
          isDirty: true,
          domains: state.domains.filter((d) => d !== naam),
          domainMeta: (() => { const { [naam]: _, ...rest } = state.domainMeta; return rest; })(),
        })),

      /** Update metadata van een domein (beschrijving, kleur, prefix) */
      updateDomainMeta: (naam, patch) =>
        set((state) => ({
          isDirty: true,
          domainMeta: {
            ...state.domainMeta,
            [naam]: { ...(state.domainMeta[naam] || {}), ...patch },
          },
        })),

      /** Verwijder een element uit het model + uit alle diagrammen */
      deleteElement: (id) =>
        set((state) => {
          const { [id]: _removed, ...restElements } = state.elements;
          const newDiagrams = {};
          for (const [dId, diag] of Object.entries(state.diagrams)) {
            newDiagrams[dId] = {
              ...diag,
              nodes: diag.nodes.filter((n) => n.elementId !== id),
              edges: diag.edges.filter((e) => e.source !== id && e.target !== id),
            };
          }
          return {
            isDirty: true,
            elements: restElements,
            structuralEdges: state.structuralEdges.filter(
              (e) => e.source !== id && e.target !== id
            ),
            diagrams: newDiagrams,
          };
        }),

      // === Acties: Diagrammen ===

      /** Maak nieuw diagram */
      addDiagram: (diagram) =>
        set((state) => ({
          diagrams: { ...state.diagrams, [diagram.id]: diagram },
        })),

      /** Hernoem een diagram */
      renameDiagram: (diagramId, nieuweNaam) =>
        set((state) => {
          const diag = state.diagrams[diagramId];
          if (!diag) return state;
          return {
            isDirty: true,
            diagrams: {
              ...state.diagrams,
              [diagramId]: { ...diag, naam: nieuweNaam },
            },
          };
        }),

      /** Voeg een structurele edge toe aan het model (zonder duplicaten). */
      addStructuralEdge: (edge) =>
        set((state) => {
          const bestaatAl = state.structuralEdges.some(
            (e) =>
              e.source === edge.source &&
              e.target === edge.target &&
              (e.sourceHandle || null) === (edge.sourceHandle || null) &&
              (e.targetHandle || null) === (edge.targetHandle || null)
          );
          if (bestaatAl) return state;
          return {
            isDirty: true,
            structuralEdges: [...state.structuralEdges, edge],
          };
        }),

      /** Update data van een structurele edge */
      updateStructuralEdge: (edgeId, dataPatch) =>
        set((state) => ({
          isDirty: true,
          structuralEdges: state.structuralEdges.map((e) =>
            e.id === edgeId ? { ...e, data: { ...e.data, ...dataPatch } } : e
          ),
        })),

      /** Update edge data in een specifiek diagram */
      updateDiagramEdge: (diagramId, edgeId, dataPatch) =>
        set((state) => {
          const diag = state.diagrams[diagramId];
          if (!diag) return state;
          return {
            isDirty: true,
            diagrams: {
              ...state.diagrams,
              [diagramId]: {
                ...diag,
                edges: (diag.edges || []).map((e) =>
                  e.id === edgeId ? { ...e, data: { ...e.data, ...dataPatch } } : e
                ),
              },
            },
          };
        }),

      /** Verwijder diagram (niet de elementen!) */
      deleteDiagram: (diagramId) =>
        set((state) => {
          const { [diagramId]: _removed, ...rest } = state.diagrams;
          return { diagrams: rest };
        }),

      /** Update diagram nodes (posities, toevoegingen, verwijderingen) */
      updateDiagramNodes: (diagramId, nodes) =>
        set((state) => ({
          diagrams: {
            ...state.diagrams,
            [diagramId]: { ...state.diagrams[diagramId], nodes },
          },
        })),

      /** Update diagram edges */
      updateDiagramEdges: (diagramId, edges) =>
        set((state) => ({
          diagrams: {
            ...state.diagrams,
            [diagramId]: { ...state.diagrams[diagramId], edges },
          },
        })),

      /** Update diagram viewport */
      updateDiagramViewport: (diagramId, viewport) =>
        set((state) => ({
          diagrams: {
            ...state.diagrams,
            [diagramId]: { ...state.diagrams[diagramId], viewport },
          },
        })),

      /** Voeg element toe aan diagram (als referentie) op een positie */
      addElementToDiagram: (diagramId, elementId, position) =>
        set((state) => {
          const diag = state.diagrams[diagramId];
          if (!diag) return state;
          // Voorkom duplicaten
          if (diag.nodes.some((n) => n.elementId === elementId)) return state;
          return {
            diagrams: {
              ...state.diagrams,
              [diagramId]: {
                ...diag,
                nodes: [...diag.nodes, { elementId, position }],
              },
            },
          };
        }),

      /** Verwijder element van diagram (NIET uit het model) */
      removeElementFromDiagram: (diagramId, elementId) =>
        set((state) => {
          const diag = state.diagrams[diagramId];
          if (!diag) return state;
          return {
            diagrams: {
              ...state.diagrams,
              [diagramId]: {
                ...diag,
                nodes: diag.nodes.filter((n) => n.elementId !== elementId),
                edges: diag.edges.filter(
                  (e) => e.source !== elementId && e.target !== elementId
                ),
              },
            },
          };
        }),
    }),
    {
      // Undo/redo: track model-mutaties + diagram-layout (nodes/edges), niet viewport of isDirty
      partialize: (state) => ({
        elements: state.elements,
        structuralEdges: state.structuralEdges,
        domains: state.domains,
        domainMeta: state.domainMeta,
        diagrams: stripDiagramViewport(state.diagrams),
      }),
      // Sla geen undo-entry op wanneer de getrackte state niet veranderd is
      // (bijv. bij isDirty-only of viewport-only wijzigingen)
      equality: (pastState, currentState) =>
        JSON.stringify(pastState) === JSON.stringify(currentState),
      limit: 50,
    }),
    {
      name: "ide-model-store",
      storage: createJSONStorage(() => localStorage),
      // Sla alleen model-data op, niet UI-state
      partialize: (state) => ({
        elements: state.elements,
        structuralEdges: state.structuralEdges,
        diagrams: state.diagrams,
        domains: state.domains,
        domainMeta: state.domainMeta,
        modelMeta: state.modelMeta,
      }),
    }
  )
);

export default useModelStore;
export { DEFAULT_DIAGRAM_ID };
