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

const useModelStore = create(
  persist(
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

      /** @type {object|null} Bron-metadata (bron, build_versie, id, indiener, etc.) */
      modelMeta: null,

      // === Acties: Model ===

      /** Laad een volledig model (vanuit adapter). Vervangt alles. */
      loadModel: ({ elements, structuralEdges, diagrams, domains, modelMeta }) =>
        set({
          elements: elements || {},
          structuralEdges: structuralEdges || [],
          diagrams: diagrams || {},
          domains: domains || [],
          modelMeta: modelMeta || null,
        }),

      /** Reset het model */
      clearModel: () =>
        set({
          elements: {},
          structuralEdges: [],
          diagrams: {},
          domains: [],
          modelMeta: null,
        }),

      /** Update een enkel element (merge) */
      updateElement: (id, newData) =>
        set((state) => ({
          elements: {
            ...state.elements,
            [id]: { ...state.elements[id], data: { ...state.elements[id]?.data, ...newData } },
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
            structuralEdges: [...state.structuralEdges, edge],
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
      name: "ide-model-store",
      storage: createJSONStorage(() => localStorage),
      // Sla alleen model-data op, niet UI-state
      partialize: (state) => ({
        elements: state.elements,
        structuralEdges: state.structuralEdges,
        diagrams: state.diagrams,
        domains: state.domains,
        modelMeta: state.modelMeta,
      }),
    }
  )
);

export default useModelStore;
export { DEFAULT_DIAGRAM_ID };
