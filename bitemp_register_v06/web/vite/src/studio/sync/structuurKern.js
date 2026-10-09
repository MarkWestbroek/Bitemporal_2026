// @ts-check
/**
 * structuurKern — de projectstructuur (mappen + plaatsing) als kale store,
 * zonder UI, opslag of undo. Voor node: de sidecar speelt er het operatielog
 * van een project op na en bouwt er nieuwe structuur-operaties mee.
 *
 * De acties heten als die in modellerenActivity.jsx (STRUCTUUR_OPS) en doen
 * hetzelfde met `mappen` en `plaatsing`; wat daar UI is (selectie, tabs,
 * open/dicht, flits) bestaat hier niet. De browser houdt zijn eigen
 * implementatie (met opslag en undo); dit is de minimale tegenhanger.
 */
import { create } from "zustand";
import { herschikOpVolgorde } from "./operaties.js";

let _teller = 0;
/** Map-id in dezelfde vorm als de browser (`map_<tijd>_<n>`), met een s-suffix voor de sidecar. */
export const nieuwMapIdNode = () => `map_${Date.now()}_${(_teller += 1)}s`;

/** Submappen (recursief) van een map, diepste laatst. */
export function submappenVan(mappen, mapId) {
  const uit = [];
  const loop = (id) => {
    for (const m of Object.values(mappen)) if (m.ouderId === id) { uit.push(m.id); loop(m.id); }
  };
  loop(mapId);
  return uit;
}

/**
 * @param {{mappen?: Record<string, any>, plaatsing?: Record<string, string>}} [begin]
 */
export function maakStructuurStore(begin = {}) {
  return create((set, get) => ({
    mappen: begin.mappen || {},
    plaatsing: begin.plaatsing || {},

    nieuweMap: (naam, ouderId = null, mapId = null) => {
      const id = mapId || nieuwMapIdNode();
      set((s) => ({ mappen: { ...s.mappen, [id]: { id, naam, ouderId: ouderId || null, volgorde: Date.now() } } }));
      return id;
    },
    nieuweMappen: (lijst) => {
      const ids = (lijst || []).map((m) => m.mapId || nieuwMapIdNode());
      if (!ids.length) return ids;
      set((s) => {
        const mappen = { ...s.mappen };
        const basis = Date.now();
        (lijst || []).forEach((m, i) => {
          mappen[ids[i]] = { id: ids[i], naam: m.naam, ouderId: m.ouderId || null, volgorde: basis + i };
        });
        return { mappen };
      });
      return ids;
    },
    hernoemMap: (id, naam) =>
      set((s) => (s.mappen[id] ? { mappen: { ...s.mappen, [id]: { ...s.mappen[id], naam } } } : {})),
    zetMapKleur: (id, kleur) =>
      set((s) => (s.mappen[id] ? { mappen: { ...s.mappen, [id]: { ...s.mappen[id], kleur: kleur || undefined } } } : {})),
    verplaatsMap: (id, ouderId) =>
      set((s) => (s.mappen[id] ? { mappen: { ...s.mappen, [id]: { ...s.mappen[id], ouderId: ouderId || null } } } : {})),
    /** Eén plek omhoog/omlaag tussen de broertjes (op `volgorde`). */
    schuifMap: (id, richting) =>
      set((s) => {
        const m = s.mappen[id];
        if (!m) return {};
        const broers = Object.values(s.mappen)
          .filter((x) => (x.ouderId || null) === (m.ouderId || null))
          .sort((a, b) => (a.volgorde || 0) - (b.volgorde || 0));
        const i = broers.findIndex((x) => x.id === id);
        const j = richting === "omhoog" || richting < 0 ? i - 1 : i + 1;
        if (i < 0 || j < 0 || j >= broers.length) return {};
        const a = broers[i], b = broers[j];
        return { mappen: { ...s.mappen, [a.id]: { ...a, volgorde: b.volgorde }, [b.id]: { ...b, volgorde: a.volgorde } } };
      }),
    /** Map en submappen weg; wat erin geplaatst was, gaat naar de wortel. */
    verwijderMap: (id) =>
      set((s) => {
        if (!s.mappen[id]) return {};
        const weg = new Set([id, ...submappenVan(s.mappen, id)]);
        const mappen = { ...s.mappen };
        for (const m of weg) delete mappen[m];
        const plaatsing = { ...s.plaatsing };
        for (const [key, mapId] of Object.entries(plaatsing)) if (weg.has(mapId)) delete plaatsing[key];
        return { mappen, plaatsing };
      }),

    plaatsDiagram: (key, mapId) => get().plaatsMeerdere([key], mapId),
    plaatsMeerdere: (keys, mapId) =>
      set((s) => {
        const doel = mapId || null;
        const teDoen = (keys || []).filter((key) => (s.plaatsing[key] || null) !== doel);
        if (!teDoen.length) return {};
        const plaatsing = { ...s.plaatsing };
        for (const key of teDoen) {
          if (doel) plaatsing[key] = doel;
          else delete plaatsing[key];
        }
        return { plaatsing };
      }),
    plaatsPerMap: (keysPerMap) =>
      set((s) => {
        const plaatsing = { ...s.plaatsing };
        let veranderd = false;
        for (const [mapId, keys] of Object.entries(keysPerMap || {})) {
          const doel = mapId && mapId !== "null" ? mapId : null;
          for (const key of keys || []) {
            if ((plaatsing[key] || null) === doel) continue;
            if (doel) plaatsing[key] = doel;
            else delete plaatsing[key];
            veranderd = true;
          }
        }
        return veranderd ? { plaatsing } : {};
      }),
    /** Eén plek omhoog/omlaag in de sleutelvolgorde van `plaatsing` (binnen dezelfde map). */
    schuifPlaatsing: (key, richting) =>
      set((s) => {
        const sleutels = Object.keys(s.plaatsing);
        const i = sleutels.indexOf(key);
        if (i < 0) return {};
        const mapId = s.plaatsing[key] || null;
        const stap = richting === "omhoog" || richting < 0 ? -1 : 1;
        let j = i + stap;
        while (j >= 0 && j < sleutels.length && (s.plaatsing[sleutels[j]] || null) !== mapId) j += stap;
        if (j < 0 || j >= sleutels.length) return {};
        [sleutels[i], sleutels[j]] = [sleutels[j], sleutels[i]];
        return { plaatsing: herschikOpVolgorde(s.plaatsing, sleutels) };
      }),
    patchStructuur: ({ zetMappen = {}, wisMappen = [], zetPlaatsing = {}, wisPlaatsing = [], volgordePlaatsing = null } = {}) =>
      set((s) => {
        const mappen = { ...s.mappen, ...zetMappen };
        for (const id of wisMappen) delete mappen[id];
        let plaatsing = { ...s.plaatsing, ...zetPlaatsing };
        for (const key of wisPlaatsing) delete plaatsing[key];
        plaatsing = herschikOpVolgorde(plaatsing, volgordePlaatsing);
        return { mappen, plaatsing };
      }),
    laadStructuur: ({ mappen, plaatsing } = {}) => set({ mappen: mappen || {}, plaatsing: plaatsing || {} }),
  }));
}

/**
 * Plaatsingen zonder element of diagram ("wezen") weglaten uit een werkbestand.
 *
 * Alleen het boom-contextmenu "Uit het model verwijderen" ruimt de plaatsing op;
 * verwijderen via canvas, inspector of browser raakt alleen de profielstore. In de
 * boom is zo'n wees onzichtbaar, maar hij reisde mee in export en snapshot en kwam
 * terug zodra het id weer opdook (melding 10-10, actor in usecase05).
 *
 * Bewust alleen bij het bouwen van het werkbestand, niet live in de store: na een
 * verwijdering kan Ctrl+Z het element terugzetten, en dan moet de plaatsing er nog zijn.
 * Sleutels van profielen die hier niet in `bekend` staan (onbekend in deze Studio,
 * of klassiek met eigen opslag) blijven ongemoeid.
 *
 * @param {Record<string, string>} plaatsing  sleutel → mapId (volgorde blijft behouden)
 * @param {Record<string, {elements?: Record<string, any>, diagrams?: Record<string, any>}>} inhoud  per profiel
 * @param {Set<string>} bekend  profiel-ids waarvan `inhoud` volledig is (ook als leeg)
 * @returns {{plaatsing: Record<string, string>, weggelaten: string[]}}
 */
export function zonderWeesPlaatsingen(plaatsing, inhoud, bekend) {
  const uit = {};
  const weggelaten = [];
  for (const [key, mapId] of Object.entries(plaatsing || {})) {
    const isEl = key.startsWith("el::");
    const rest = isEl ? key.slice(4) : key;
    const i = rest.indexOf("::");
    const profielId = i < 0 ? null : rest.slice(0, i);
    if (profielId && bekend.has(profielId)) {
      const id = rest.slice(i + 2);
      const p = inhoud[profielId] || {};
      if (!(isEl ? p.elements : p.diagrams)?.[id]) { weggelaten.push(key); continue; }
    }
    uit[key] = mapId;
  }
  return { plaatsing: uit, weggelaten };
}
