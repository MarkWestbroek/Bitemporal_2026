// @ts-check
/**
 * createDiagramStore — Zustand-store-factory voor de generieke diagram-motor.
 *
 * Fase 2 (bewerken): mutaties op elementen/connectoren/diagrammen, undo/redo
 * via zundo (zelfde patroon als store/useModelStore.js) en optioneel persist
 * per profiel (persistKey "studio05-<profiel>").
 *
 * Connectoren zijn elementen met `source`/`target` (metamodel §2); de visuele
 * edges op een diagram worden daaruit afgeleid (canvas/materialiseerConnectoren)
 * en zijn dus geen aparte waarheid. `diagram.edges` bevat alleen de
 * "geïmporteerde" presentatie-edges van een adapter (fase 1-spiegel).
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { temporal } from "zundo";

/** @typedef {import("./schema.js").Element} Element */
/** @typedef {import("./schema.js").Diagram} Diagram */

/**
 * Splits binnenkomende diagrammen (adapter-vorm, met viewport erin) in
 * diagrammen-zonder-viewport + een aparte viewports-map. Viewports leven
 * buiten de undo-history én buiten de diagrammen, zodat undo/redo nooit de
 * pan/zoom-stand aantast (dat deed eerder een ongewenste "fit view").
 */
function splitsViewports(diagrams) {
  const kaal = {};
  const viewports = {};
  for (const [id, d] of Object.entries(diagrams || {})) {
    const { viewport, ...rest } = d;
    kaal[id] = rest;
    if (viewport) viewports[id] = viewport;
  }
  return { kaal, viewports };
}

/**
 * @param {{ persistKey?: string }} [opts]
 */
export function createDiagramStore({ persistKey } = {}) {
  const leeg = {
    diagramTypeId: null,
    elements: {},
    diagrams: {},
    /** @type {Record<string, {x:number,y:number,zoom:number}>} pan/zoom per diagram, buiten de undo-history */
    viewports: {},
    actiefDiagramId: null,
    isDirty: false,
  };

  const definitie = (set) => ({
    ...leeg,

    /** Vervang het volledige model (vanuit een adapter). Zet isDirty op false. */
    laadModel: ({ diagramTypeId, elements, diagrams, actiefDiagramId }) =>
      set((state) => {
        const { kaal, viewports } = splitsViewports(diagrams);
        return {
          diagramTypeId: diagramTypeId ?? state.diagramTypeId,
          elements: elements || {},
          diagrams: kaal,
          viewports,
          isDirty: false,
          actiefDiagramId:
            actiefDiagramId ??
            (state.actiefDiagramId && kaal?.[state.actiefDiagramId]
              ? state.actiefDiagramId
              : Object.keys(kaal || {})[0] || null),
        };
      }),

    clear: () => set({ ...leeg }),

    /** @param {string} id */
    setActiefDiagram: (id) => set({ actiefDiagramId: id }),

    markeerOpgeslagen: () => set({ isDirty: false }),

    // === Elementen ===

    /** @param {Element} element */
    addElement: (element) =>
      set((state) => {
        if (!element?.id) return state;
        return { isDirty: true, elements: { ...state.elements, [element.id]: element } };
      }),

    /**
     * Update een element. `patch` mag top-level velden bevatten (naam, source,
     * target), een compleet `compartimenten`-array (vervangt) en/of een
     * `data`-object (merged).
     */
    updateElement: (id, patch) =>
      set((state) => {
        const el = state.elements[id];
        if (!el) return state;
        const { data: dataPatch, compartimenten, ...top } = patch;
        return {
          isDirty: true,
          elements: {
            ...state.elements,
            [id]: {
              ...el,
              ...top,
              ...(compartimenten !== undefined ? { compartimenten } : {}),
              data: dataPatch !== undefined ? { ...el.data, ...dataPatch } : el.data,
            },
          },
        };
      }),

    /**
     * Verwijder een element uit het model, inclusief connectoren die eraan
     * hangen, en haal alles van alle diagrammen af.
     */
    deleteElement: (id) =>
      set((state) => {
        if (!state.elements[id]) return state;
        const weg = new Set([id]);
        for (const el of Object.values(state.elements)) {
          if (el.source === id || el.target === id) weg.add(el.id);
        }
        const elements = {};
        for (const [k, v] of Object.entries(state.elements)) {
          if (!weg.has(k)) elements[k] = v;
        }
        const diagrams = {};
        for (const [dId, d] of Object.entries(state.diagrams)) {
          diagrams[dId] = {
            ...d,
            nodes: (d.nodes || []).filter((n) => !weg.has(n.elementId)),
            edges: (d.edges || []).filter((e) => !weg.has(e.source) && !weg.has(e.target)),
          };
        }
        return { isDirty: true, elements, diagrams };
      }),

    // === Diagrammen ===

    /** @param {Partial<Diagram> & {id: string, naam: string}} diagram */
    addDiagram: (diagram) =>
      set((state) => ({
        isDirty: true,
        diagrams: {
          ...state.diagrams,
          [diagram.id]: { nodes: [], edges: [], ...diagram },
        },
        actiefDiagramId: diagram.id,
      })),

    renameDiagram: (diagramId, naam) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d) return state;
        return { isDirty: true, diagrams: { ...state.diagrams, [diagramId]: { ...d, naam } } };
      }),

    /** Verwijder een diagram (niet de elementen). */
    deleteDiagram: (diagramId) =>
      set((state) => {
        const { [diagramId]: _weg, ...rest } = state.diagrams;
        const { [diagramId]: _vpWeg, ...restViewports } = state.viewports;
        return {
          isDirty: true,
          diagrams: rest,
          viewports: restViewports,
          actiefDiagramId:
            state.actiefDiagramId === diagramId
              ? Object.keys(rest)[0] || null
              : state.actiefDiagramId,
        };
      }),

    /** Zet een element op een diagram (geen duplicaten). */
    addElementToDiagram: (diagramId, elementId, position) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d || d.nodes.some((n) => n.elementId === elementId)) return state;
        return {
          isDirty: true,
          diagrams: {
            ...state.diagrams,
            [diagramId]: { ...d, nodes: [...d.nodes, { elementId, position }] },
          },
        };
      }),

    /** Haal een element van een diagram af (element blijft in het model). */
    removeElementFromDiagram: (diagramId, elementId) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d) return state;
        return {
          isDirty: true,
          diagrams: {
            ...state.diagrams,
            [diagramId]: {
              ...d,
              nodes: d.nodes.filter((n) => n.elementId !== elementId),
              edges: (d.edges || []).filter((e) => e.source !== elementId && e.target !== elementId),
            },
          },
        };
      }),

    updateNodePosition: (diagramId, elementId, position) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d) return state;
        return {
          isDirty: true,
          diagrams: {
            ...state.diagrams,
            [diagramId]: {
              ...d,
              nodes: d.nodes.map((n) => (n.elementId === elementId ? { ...n, position } : n)),
            },
          },
        };
      }),

    /**
     * Bulk-variant: meerdere posities in één mutatie (= één undo-stap).
     * Gebruikt door uitlijnen/verdelen/auto-layout.
     * @param {Record<string, {x:number,y:number}>} posities
     */
    updateNodePositions: (diagramId, posities) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d || !posities || Object.keys(posities).length === 0) return state;
        return {
          isDirty: true,
          diagrams: {
            ...state.diagrams,
            [diagramId]: {
              ...d,
              nodes: d.nodes.map((n) =>
                posities[n.elementId] ? { ...n, position: posities[n.elementId] } : n
              ),
            },
          },
        };
      }),

    /** Grootte van een element op één diagram (metamodel: Position.elementSize). */
    updateNodeSize: (diagramId, elementId, size) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d) return state;
        return {
          isDirty: true,
          diagrams: {
            ...state.diagrams,
            [diagramId]: {
              ...d,
              nodes: d.nodes.map((n) => (n.elementId === elementId ? { ...n, size } : n)),
            },
          },
        };
      }),

    /** Viewport: apart van de diagrammen, geen isDirty en geen undo-entry. */
    updateDiagramViewport: (diagramId, viewport) =>
      set((state) => ({ viewports: { ...state.viewports, [diagramId]: viewport } })),
  });

  const metUndo = temporal(definitie, {
    // Bewust NIET in de history: viewports (pan/zoom is geen modelwijziging)
    // en actiefDiagramId (undo hoort niet van diagram te wisselen — dat
    // veroorzaakte remounts met een ongewenste fit-view).
    partialize: (state) => ({
      elements: state.elements,
      diagrams: state.diagrams,
    }),
    equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    limit: 50,
  });

  if (!persistKey) return create(metUndo);

  return create(
    persist(metUndo, {
      name: persistKey,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        diagramTypeId: state.diagramTypeId,
        elements: state.elements,
        diagrams: state.diagrams,
        viewports: state.viewports,
        actiefDiagramId: state.actiefDiagramId,
      }),
    })
  );
}
