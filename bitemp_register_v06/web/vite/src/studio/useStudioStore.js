/**
 * useStudioStore — Zustand store voor de Studio-werkbank (shell-state).
 *
 * Houdt bij welke activiteit actief is en of de zijpanelen open/dicht staan.
 * Per activiteit wordt de open/dicht-stand onthouden zodat wisselen tussen
 * functies de vorige paneel-stand herstelt. Persisteert in localStorage.
 */
import { create } from "zustand";

const LS_KEY = "studio-shell";

function leesOpslag() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function schrijfOpslag(state) {
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        activeId: state.activeId,
        sidebarWidth: state.sidebarWidth,
        inspectorWidth: state.inspectorWidth,
        paneelStand: state.paneelStand,
        balkVerborgen: state.balkVerborgen,
        labsAan: state.labsAan,
        favorieten: state.favorieten,
      })
    );
  } catch { /* ignore */ }
}

const opgeslagen = leesOpslag();

const useStudioStore = create((set) => ({
  /** id van de actieve activiteit */
  activeId: opgeslagen.activeId || null,
  /** breedte (px) van linker- en rechterpaneel */
  sidebarWidth: opgeslagen.sidebarWidth || 280,
  inspectorWidth: opgeslagen.inspectorWidth || 320,
  /**
   * Per activiteit-id de open/dicht-stand van de panelen.
   * { [activiteitId]: { sidebar: bool, inspector: bool } }
   */
  paneelStand: opgeslagen.paneelStand || {},
  /**
   * Configureerbare complexiteit (consolidatieplan fase 1). Alles blijft
   * altijd bereikbaar via menu Ga naar en het opdrachtenpalet; deze
   * instellingen bepalen alleen wat de activity bar toont.
   */
  /** { [activiteitId]: true } — door de gebruiker uit de balk gehaald. */
  balkVerborgen: opgeslagen.balkVerborgen || {},
  /** Labs uit → preview-activiteiten (in aanbouw) niet in de balk. */
  labsAan: opgeslagen.labsAan ?? true,
  /** Gepinde activiteiten, bovenin de balk (volgorde = pinvolgorde). */
  favorieten: opgeslagen.favorieten || [],

  setActief: (id) =>
    set((s) => {
      const next = { ...s, activeId: id };
      schrijfOpslag(next);
      return { activeId: id };
    }),

  /** Open/dicht van het linkerpaneel voor de actieve activiteit. */
  toggleSidebar: () =>
    set((s) => {
      const id = s.activeId;
      if (!id) return {};
      const huidig = s.paneelStand[id] || {};
      const paneelStand = { ...s.paneelStand, [id]: { ...huidig, sidebar: !(huidig.sidebar ?? true) } };
      const next = { ...s, paneelStand };
      schrijfOpslag(next);
      return { paneelStand };
    }),

  /** Open/dicht van het rechterpaneel voor de actieve activiteit. */
  toggleInspector: () =>
    set((s) => {
      const id = s.activeId;
      if (!id) return {};
      const huidig = s.paneelStand[id] || {};
      const paneelStand = { ...s.paneelStand, [id]: { ...huidig, inspector: !(huidig.inspector ?? true) } };
      const next = { ...s, paneelStand };
      schrijfOpslag(next);
      return { paneelStand };
    }),

  /**
   * Pin/unpin van een paneel voor de actieve activiteit.
   * Gepind (default) = vast gedockt en neemt ruimte in.
   * Niet gepind = auto-hide: het paneel klapt in tot een rail zodra de muis/focus
   * het verlaat, en verschijnt als overlay zodra je de rail aanwijst.
   * @param {"sidebar"|"inspector"} kant
   */
  togglePin: (kant) =>
    set((s) => {
      const id = s.activeId;
      if (!id) return {};
      const huidig = s.paneelStand[id] || {};
      const sleutel = kant === "sidebar" ? "sidebarPinned" : "inspectorPinned";
      const paneelStand = {
        ...s.paneelStand,
        [id]: { ...huidig, [sleutel]: !(huidig[sleutel] ?? true) },
      };
      const next = { ...s, paneelStand };
      schrijfOpslag(next);
      return { paneelStand };
    }),

  /**
   * Toon/verberg een activiteit in de balk — expliciet (tri-state opslag):
   * true = verborgen, false = zichtbaar, afwezig = descriptor-default
   * (`standaardVerborgen`, bv. de losse editors die Modelleren al dekt).
   * Verbergen haalt hem ook uit de favorieten.
   */
  zetBalkZichtbaar: (id, zichtbaar) =>
    set((s) => {
      const balkVerborgen = { ...s.balkVerborgen, [id]: !zichtbaar };
      const favorieten = zichtbaar ? s.favorieten : s.favorieten.filter((f) => f !== id);
      const next = { ...s, balkVerborgen, favorieten };
      schrijfOpslag(next);
      return { balkVerborgen, favorieten };
    }),

  toggleLabs: () =>
    set((s) => {
      const next = { ...s, labsAan: !s.labsAan };
      schrijfOpslag(next);
      return { labsAan: next.labsAan };
    }),

  /** Pin/unpin een favoriet. Pinnen maakt de activiteit ook weer zichtbaar. */
  toggleFavoriet: (id) =>
    set((s) => {
      let favorieten;
      const balkVerborgen = { ...s.balkVerborgen };
      if (s.favorieten.includes(id)) {
        favorieten = s.favorieten.filter((f) => f !== id);
      } else {
        favorieten = [...s.favorieten, id];
        // Expliciet zichtbaar (wint van een standaardVerborgen-default).
        balkVerborgen[id] = false;
      }
      const next = { ...s, favorieten, balkVerborgen };
      schrijfOpslag(next);
      return { favorieten, balkVerborgen };
    }),

  /**
   * Paneelstand van een activiteit programmatisch zetten (bv. Modelleren
   * dat zijn zijpanelen inklapt voor een editor met eigen schil).
   */
  zetPaneelStand: (activiteitId, patch) =>
    set((s) => {
      const huidig = s.paneelStand[activiteitId] || {};
      const paneelStand = { ...s.paneelStand, [activiteitId]: { ...huidig, ...patch } };
      const next = { ...s, paneelStand };
      schrijfOpslag(next);
      return { paneelStand };
    }),

  /** Expliciet zetten (gebruikt door de splitter / resize). */
  setSidebarWidth: (px) =>
    set((s) => {
      const sidebarWidth = Math.max(180, Math.min(640, px));
      schrijfOpslag({ ...s, sidebarWidth });
      return { sidebarWidth };
    }),

  setInspectorWidth: (px) =>
    set((s) => {
      const inspectorWidth = Math.max(220, Math.min(720, px));
      schrijfOpslag({ ...s, inspectorWidth });
      return { inspectorWidth };
    }),
}));

export default useStudioStore;
