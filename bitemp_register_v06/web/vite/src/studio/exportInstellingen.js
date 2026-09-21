/**
 * exportInstellingen — gebruikersvoorkeuren voor de diagram-afbeeldingsexport
 * (Studio-instellingen → Diagram-export). Persistent in localStorage; het
 * canvas-contextmenu leest deze bij het exporteren.
 */
import { create } from "zustand";

const KEY = "studio-export";

function lees() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

const opgeslagen = lees();

export const useExportInstellingen = create((set) => ({
  /** "canvas" (thema-achtergrond) | "wit" | "transparant" */
  achtergrond: opgeslagen.achtergrond || "canvas",
  /** pixel-schaal voor PNG (1–4); hoger = scherper/groter */
  schaal: opgeslagen.schaal || 2,
  /** marge (px) rondom de inhoud */
  marge: opgeslagen.marge ?? 24,

  zet: (patch) =>
    set((s) => {
      const n = { ...s, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify({ achtergrond: n.achtergrond, schaal: n.schaal, marge: n.marge }));
      } catch { /* ignore */ }
      return patch;
    }),
}));
