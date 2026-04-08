/**
 * useUIStore — Zustand store voor IDE UI-state.
 *
 * Bevat selectie, clipboard, actief diagram, layout-voorkeuren, thema, etc.
 * Wordt NIET gepersisteerd (behalve layout en thema).
 */
import { create } from "zustand";

/** Lees thema uit localStorage of default naar "dark" */
function getInitialTheme() {
  try {
    const stored = localStorage.getItem("ide-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch { /* ignore */ }
  return "dark";
}

const useUIStore = create((set) => ({
  // === Thema ===
  /** "dark" | "light" — persisteert in localStorage */
  theme: getInitialTheme(),

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      try { localStorage.setItem("ide-theme", next); } catch { /* ignore */ }
      return { theme: next };
    }),

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
