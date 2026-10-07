// @ts-check
/**
 * outbox — de nog niet naar de server gestuurde operaties van deze browsertab
 * (plan 2026-10-07 Projectsync, stap 2). Gepersisteerd in localStorage zodat
 * een herlaad niets verliest; `clientId` per tab (sessionStorage) zodat de
 * ontvanger eigen operaties kan herkennen.
 *
 * De verzender (stap 2, onderdeel 4) leest `ops`, stuurt een batch en roept
 * `bevestig(totLokaalNr)` aan. Tot die tijd is dit alleen het logboek.
 */
import { create } from "zustand";
import { abonneer } from "./operaties.js";

const LS_SLEUTEL = "studio-outbox";
const SS_SLEUTEL = "studio-client-id";
const MAX_OPS = 5000; // noodrem: daarna gaat het oudste eruit (snapshot herstelt de rest)
// Persisteren in localStorage alleen zolang het project op de server staat en
// live-sync aan is (de verzender zet dit, zie verzender.js `configureer`):
// anders zou de outbox alleen maar groeien (grote operaties zoals een
// modelimport komen er volledig in) en de ~5 MB-quota van de origin opeten.
// Forceren voor ontwikkeling: localStorage.setItem("studio-outbox-persist", "1").
let persisteren = (() => {
  try {
    return globalThis.localStorage?.getItem("studio-outbox-persist") === "1";
  } catch {
    return false;
  }
})();

function leesOpslag() {
  try {
    const raw = globalThis.localStorage?.getItem(LS_SLEUTEL);
    if (raw) {
      const d = JSON.parse(raw);
      if (Array.isArray(d.ops)) {
        return { ops: d.ops, volgende: Number(d.volgende) || d.ops.length + 1, projectId: d.projectId || null };
      }
    }
  } catch {
    /* geen opslag */
  }
  return { ops: [], volgende: 1, projectId: null };
}

function schrijfOpslag({ ops, volgende, projectId }) {
  if (!persisteren) return;
  try {
    globalThis.localStorage?.setItem(LS_SLEUTEL, JSON.stringify({ ops, volgende, projectId }));
  } catch {
    /* geen opslag of vol — de snapshot-sync vangt dat op */
  }
}

function bepaalClientId() {
  try {
    const ss = globalThis.sessionStorage;
    const bestaand = ss?.getItem(SS_SLEUTEL);
    if (bestaand) return bestaand;
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    ss?.setItem(SS_SLEUTEL, id);
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

/** Id van deze browsertab; reist mee met elke operatie. */
export const clientId = bepaalClientId();

const begin = leesOpslag();

export const useOutboxStore = create((set, get) => ({
  /** @type {Array<{lokaalNr:number, tijd:string, store:string, op:string, args:any[]}>} */
  ops: begin.ops,
  volgende: begin.volgende,
  /** project waar de bewaarde operaties bij horen (guard bij herlaad/projectwissel) */
  projectId: begin.projectId,

  voegToe: (op) =>
    set((s) => {
      const rij = { lokaalNr: s.volgende, tijd: new Date().toISOString(), ...op };
      let ops = [...s.ops, rij];
      if (ops.length > MAX_OPS) ops = ops.slice(ops.length - MAX_OPS);
      const next = { ops, volgende: s.volgende + 1, projectId: s.projectId };
      schrijfOpslag(next);
      return next;
    }),

  /** Verwijder alles tot en met `lokaalNr` (door de server bevestigd). */
  bevestig: (lokaalNr) =>
    set((s) => {
      const ops = s.ops.filter((o) => o.lokaalNr > lokaalNr);
      if (ops.length === s.ops.length) return {};
      schrijfOpslag({ ops, volgende: s.volgende, projectId: s.projectId });
      return { ops };
    }),

  /** Leeg (nieuw project, snapshot geladen). */
  wis: () => {
    const next = { ops: [], volgende: get().volgende, projectId: get().projectId };
    schrijfOpslag(next);
    set(next);
  },

  /** Hoort de bewaarde outbox bij een ander project? Dan weg ermee. */
  zetProject: (projectId) => {
    const s = get();
    if (s.projectId && projectId && s.projectId !== projectId && s.ops.length) {
      set({ ops: [], projectId });
    } else {
      set({ projectId });
    }
    schrijfOpslag(get());
  },

  /** Persistentie aan/uit (aan = direct de huidige stand wegschrijven). */
  zetPersisteren: (aan) => {
    persisteren = !!aan;
    if (aan) schrijfOpslag(get());
    else {
      try {
        globalThis.localStorage?.removeItem(LS_SLEUTEL);
      } catch {
        /* geen opslag */
      }
    }
  },
}));

// Elke gemelde operatie landt in de outbox.
abonneer((op) => useOutboxStore.getState().voegToe(op));
