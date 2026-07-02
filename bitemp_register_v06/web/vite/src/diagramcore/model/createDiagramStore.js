// @ts-check
/**
 * createDiagramStore — Zustand-store-factory voor de generieke diagram-motor.
 *
 * Fase 1 (read-only spiegel): minimaal — model laden, actief diagram kiezen.
 * Bewust géén persist: het model wordt bij activatie opnieuw afgeleid van de
 * bron (adapter), dus opslaan zou alleen veroudering introduceren.
 *
 * Fase 2 breidt dit uit met mutaties, undo (zundo) en persist per profiel
 * (persistKey "studio05-<profiel>"), naar het voorbeeld van useModelStore.
 */
import { create } from "zustand";

/** @typedef {import("./schema.js").Element} Element */
/** @typedef {import("./schema.js").Diagram} Diagram */

export function createDiagramStore() {
  return create((set) => ({
    /** @type {string|null} */
    diagramTypeId: null,
    /** @type {Record<string, Element>} */
    elements: {},
    /** @type {Record<string, Diagram>} */
    diagrams: {},
    /** @type {string|null} */
    actiefDiagramId: null,

    /** Vervang het volledige model (vanuit een adapter). */
    laadModel: ({ diagramTypeId, elements, diagrams, actiefDiagramId }) =>
      set((state) => ({
        diagramTypeId: diagramTypeId ?? state.diagramTypeId,
        elements: elements || {},
        diagrams: diagrams || {},
        actiefDiagramId:
          actiefDiagramId ??
          // Behoud de keuze als dat diagram nog bestaat, anders het eerste.
          (state.actiefDiagramId && diagrams?.[state.actiefDiagramId]
            ? state.actiefDiagramId
            : Object.keys(diagrams || {})[0] || null),
      })),

    /** @param {string} id */
    setActiefDiagram: (id) => set({ actiefDiagramId: id }),

    clear: () =>
      set({ diagramTypeId: null, elements: {}, diagrams: {}, actiefDiagramId: null }),
  }));
}
