/**
 * useUIStore — Zustand store voor IDE UI-state.
 *
 * Bevat selectie, clipboard, actief diagram, layout-voorkeuren, etc.
 * Wordt NIET gepersisteerd (behalve layout).
 */
import { create } from "zustand";

const useUIStore = create((set) => ({
  // === Selectie ===
  /** ID van het geselecteerde model-element (voor details panel + browser highlight) */
  selectedElementId: null,
  /** ID van de geselecteerde edge (voor edge details panel) */
  selectedEdgeId: null,
  /** Verhoogt bij elke selectie-actie, ook als hetzelfde element opnieuw wordt aangeklikt */
  selectieVersie: 0,
  /** ID van het actieve diagram (dat focus heeft) */
  activeDiagramId: null,
  /** Actief domein-filter (null = alles zichtbaar) */
  actiefDomein: null,

  // === Clipboard ===
  clipboard: null, // { type: "copy"|"cut", elementIds: string[] }

  // === Acties ===
  setSelectedElementId: (id) =>
    set((state) => ({
      selectedElementId: id,
      selectedEdgeId: null,
      selectieVersie: state.selectieVersie + 1,
    })),

  setSelectedEdgeId: (id) =>
    set((state) => ({
      selectedEdgeId: id,
      selectedElementId: null,
      selectieVersie: state.selectieVersie + 1,
    })),

  clearSelection: () =>
    set((state) => ({
      selectedElementId: null,
      selectedEdgeId: null,
      selectieVersie: state.selectieVersie + 1,
    })),

  setActiveDiagramId: (id) => set({ activeDiagramId: id }),

  setActiefDomein: (domein) => set({ actiefDomein: domein }),

  setClipboard: (clipboard) => set({ clipboard }),
}));

export default useUIStore;
