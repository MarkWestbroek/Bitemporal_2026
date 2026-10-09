/**
 * modellerenActivity — "Modelleren": één ingang voor alle modelleerprofielen
 * (consolidatieplan fase 2, eerste trede richting de projectbrowser van
 * fase 3).
 *
 *  - Sidebar = projectbrowser v0: per profieltype een sectie met zijn
 *    diagrammen (uit de eigen profiel-store); klik = openen in een tab.
 *  - Main = tab-host: open diagrammen als tabs (profiel-icoon + accent-
 *    streepje in de profielkleur), daaronder de echte editor van het
 *    profiel — exact dezelfde Main-component en store als de losse
 *    profiel-activiteit, dus de inhoud is identiek hoe je hem ook opent.
 *  - Inspector en menubalk volgen het profiel van de actieve tab
 *    (menu's her-evalueren via menuBus "menu:ververs").
 *
 * Open tabs persisteren in localStorage ("studio-modelleren"); een tab
 * waarvan het diagram elders verwijderd is, sluit zichzelf.
 */
import React, { Fragment, useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { menuBus } from "../menuBus";
import { vraagNaam, vraagBevestiging, toonMelding } from "../naamDialog.jsx";
import { ELEMENT_REF_MIME } from "../../diagramcore/canvas/externDrop.js";
import useStudioStore from "../useStudioStore";
import { useKruisStore } from "./koppelingenActivity.jsx";
import TransformatiePaneel, { useTransformStore } from "./TransformatiePaneel.jsx";
import ProjectServerDialoog, { useProjectServerStore } from "./ProjectServerDialoog.jsx";
import { koppelStore, zonderVastleggen, rebaseStand, structuurNet, STRUCTUUR_OPS, STRUCTUUR_VELDEN } from "../sync/operaties.js";
import { useOutboxStore } from "../sync/outbox.js";
import {
  PROJECT_FORMAAT,
  PROJECT_FORMAAT_VERSIE,
  STANDAARD_PROJECTNAAM,
  nieuwProjectId,
  normaliseerProjectData,
  bestandsstamVoor,
  haalProjectOp,
  maakProjectAan,
  slaProjectOp,
} from "./projectSync.js";
import { IconModelleren } from "../icons";
import {
  getProfieltypen,
  getProfieltype,
  abonneerOpProfieltypen,
  profieltypenVersie,
  effectieveStijl,
} from "../profieltypeRegistry";
import ProfielIcoon from "../ProfielIcoon.jsx";
import { TypeIcoon } from "../../diagramcore/shapes/typeIconen.jsx";
import { hernoemElement } from "../../diagramcore/model/hernoemen.js";
import { weergaveNaam } from "../../diagramcore/model/weergaveNaam.js";

const ELEMENTEN_HOOGTE_SLEUTEL = "studio05-project-elementen-hoogte";
function leesElementenHoogte() {
  try {
    const v = Number(window.localStorage.getItem(ELEMENTEN_HOOGTE_SLEUTEL));
    return v > 40 ? v : 260;
  } catch {
    return 260;
  }
}
function bewaarElementenHoogte(h) {
  try {
    window.localStorage.setItem(ELEMENTEN_HOOGTE_SLEUTEL, String(Math.round(h)));
  } catch {
    /* opslag uit */
  }
}

// Drag-and-drop MIME-types in de projectboom.
// PLAATSING draagt een plaatsing-sleutel (diagram- of element-regel die al
// in de boom staat); MAP draagt een map-id; ELEMENT is de bestaande sleep
// uit de 0.5-ElementenBrowser ({elementId}).
const PLAATSING_MIME = "text/studio-diagram";
const MAP_MIME = "text/studio-map";
const ELEMENT_MIME = "application/studio05-element";

/** Plaatsing-sleutels: diagram = "profielId::diagramId", element = "el::profielId::elementId". */
const elementKey = (profielId, elementId) => `el::${profielId}::${elementId}`;
const isElementKey = (key) => key.startsWith("el::");

// ── Tab-store (shell-state, los van de profiel-stores) ──────────────
const LS_KEY = "studio-modelleren";

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
        tabs: state.tabs,
        actieveTab: state.actieveTab,
        mappen: state.mappen,
        mapOpen: state.mapOpen,
        plaatsing: state.plaatsing,
        project: state.project,
      })
    );
  } catch { /* ignore */ }
}

const tabId = (profielId, diagramId) => `${profielId}::${diagramId}`;

/** Plaatsing-sleutel van de enkelvoudige boomselectie (diagram of element), of null. */
const selectieSleutel = (s) =>
  s.diagramSelectie
    ? tabId(s.diagramSelectie.profielId, s.diagramSelectie.diagramId)
    : s.elementSelectie
      ? elementKey(s.elementSelectie.profielId, s.elementSelectie.elementId)
      : null;

/**
 * Sleutels van alle boomregels in dezelfde lijst (map-inhoud of profielsectie,
 * `data-lijst`) in schermvolgorde — voor Shift+klik (bereik). De DOM is hier de
 * eenvoudigste waarheid: de volgorde is precies wat de gebruiker ziet.
 */
function rijenInLijst(el) {
  const lijst = el.closest?.("[data-lijst]");
  const rijen = lijst ? [...lijst.querySelectorAll("[data-sleutel]")] : [el];
  return rijen.map((x) => x.dataset.sleutel).filter(Boolean);
}

const opgeslagen = leesOpslag();

// ── Undo/redo voor de projectstructuur (mappen + plaatsingen) ───────
// Eigen stapel, los van de model-undo per profiel: Ctrl+Z met de focus in
// de boom draait boom-acties terug (map verslept, plaatsing, hernoemen, …),
// Ctrl+Z op de canvas blijft de model-undo van het profiel.
const _structuurVerleden = [];
const _structuurToekomst = [];
const structuurFoto = (s) => ({ mappen: s.mappen, plaatsing: s.plaatsing });
// Tijdens het toepassen van een operatie van een ander (projectsync) hoort
// de wijziging niet in de eigen undo-stapel.
let _structuurUndoUit = false;
/** Vastleggen vóór een structuur-wijziging (wist de redo-stapel). */
const legStructuurVast = (s) => {
  if (_structuurUndoUit) return;
  _structuurVerleden.push(structuurFoto(s));
  if (_structuurVerleden.length > 60) _structuurVerleden.shift();
  _structuurToekomst.length = 0;
};

let _mapTeller = 0;

export const useModellerenStore = create((set, get) => ({
  /** @type {{id:string, profielId:string, diagramId:string}[]} */
  tabs: opgeslagen.tabs || [],
  /** id van de actieve tab, of null */
  actieveTab: opgeslagen.actieveTab || null,

  /**
   * Identiteit van het project in deze browser (plan 2026-10-07 Projectsync):
   * `id` (UUID, ook de sleutel op de server), `naam`, en `serverVersie` = de
   * versie die we het laatst met de server hebben uitgewisseld (null = alleen
   * lokaal). Een bestaande browser zonder project krijgt er hier één.
   */
  project: opgeslagen.project?.id
    ? { serverVersie: null, ...opgeslagen.project }
    : { id: nieuwProjectId(), naam: STANDAARD_PROJECTNAAM, serverVersie: null },

  /** Werk project-identiteit bij (naam, serverVersie, of alles bij ophalen/nieuw). */
  zetProject: (patch) =>
    set((s) => {
      const project = { ...s.project, ...patch };
      schrijfOpslag({ ...s, project });
      menuBus.emit("menu:ververs");
      return { project };
    }),

  openTab: (profielId, diagramId) => {
    const id = tabId(profielId, diagramId);
    set((s) => {
      const tabs = s.tabs.some((t) => t.id === id)
        ? s.tabs
        : [...s.tabs, { id, profielId, diagramId }];
      const next = { ...s, tabs, actieveTab: id };
      schrijfOpslag(next);
      // Een diagram openen haalt de focus van een eventueel geselecteerde
      // map of diagram-eigenschap — de inspector toont dan weer het profiel.
      return { tabs, actieveTab: id, mapSelectie: null, diagramSelectie: null, elementSelectie: null };
    });
    get().activeer(id);
  },

  /** Maak de tab actief én zet het diagram actief in zijn profiel-store. */
  activeer: (id) => {
    const tab = get().tabs.find((t) => t.id === id);
    // Profielwissel op komst? Laat de vertrekkende klassieke editor zijn
    // actieve document eerst bewaren (de editor leeft nog tot de remount).
    const vorige = get().tabs.find((t) => t.id === get().actieveTab);
    if (vorige && tab && vorige.profielId !== tab.profielId) {
      getProfieltype(vorige.profielId)?.useStore.getState().bewaarActieveInhoud?.();
    }
    set((s) => {
      const next = { ...s, actieveTab: id };
      schrijfOpslag(next);
      return { actieveTab: id };
    });
    if (tab) {
      const profiel = getProfieltype(tab.profielId);
      if (profiel && profiel.useStore.getState().actiefDiagramId !== tab.diagramId) {
        profiel.useStore.getState().setActiefDiagram(tab.diagramId);
      }
    }
    // De menubalk volgt het profiel van de actieve tab.
    menuBus.emit("menu:ververs");
  },

  sluitTab: (id) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id);
      const tabs = s.tabs.filter((t) => t.id !== id);
      let actieveTab = s.actieveTab;
      if (actieveTab === id) {
        const buur = tabs[Math.min(idx, tabs.length - 1)];
        actieveTab = buur ? buur.id : null;
      }
      const next = { ...s, tabs, actieveTab };
      schrijfOpslag(next);
      menuBus.emit("menu:ververs");
      return { tabs, actieveTab };
    }),

  // ── Projectstructuur (fase 3 v0): vrije mappen, Sparx-principe ────
  // De boom is van de gebruiker: mappen mogen vrij nesten en diagrammen
  // van álle profieltypen door elkaar bevatten. Wat nergens geplaatst is
  // staat onder "Niet ingedeeld" (per profieltype).
  /** @type {Record<string,{id:string,naam:string,ouderId:string|null}>} */
  mappen: opgeslagen.mappen || {},
  /** open/dicht per map (default open) */
  mapOpen: opgeslagen.mapOpen || {},
  /** { [tabId(profielId,diagramId)]: mapId } — plaatsing van diagrammen */
  plaatsing: opgeslagen.plaatsing || {},

  nieuweMap: (naam, ouderId = null, mapId = null) => {
    // `mapId` komt mee als de operatie van een ander wordt toegepast
    // (projectsync): dezelfde map, hetzelfde id, op elke client.
    // Uniek ook binnen dezelfde milliseconde (twee mappen in één batch kregen
    // hetzelfde id en de tweede overschreef de eerste — 2026-10-07).
    const id = mapId || `map_${Date.now()}_${(_mapTeller += 1)}`;
    set((s) => {
      legStructuurVast(s);
      // volgorde = handmatige sortering per niveau; nieuw komt achteraan.
      const mappen = { ...s.mappen, [id]: { id, naam, ouderId, volgorde: Date.now() } };
      const next = { ...s, mappen };
      schrijfOpslag(next);
      return { mappen };
    });
    return id;
  },

  /** Schuif een map één plek omhoog/omlaag tussen zijn broertjes. */
  schuifMap: (id, richting) =>
    set((s) => {
      const m = s.mappen[id];
      if (!m) return {};
      const broers = Object.values(s.mappen)
        .filter((x) => (x.ouderId || null) === (m.ouderId || null))
        .sort((a, b) => (a.volgorde || 0) - (b.volgorde || 0));
      const idx = broers.findIndex((x) => x.id === id);
      const buurIdx = idx + (richting === "omhoog" ? -1 : 1);
      const buur = broers[buurIdx];
      if (!buur) return {};
      legStructuurVast(s);
      const mappen = {
        ...s.mappen,
        [id]: { ...m, volgorde: buur.volgorde || 0 },
        [buur.id]: { ...buur, volgorde: m.volgorde || 0 },
      };
      const next = { ...s, mappen };
      schrijfOpslag(next);
      return { mappen };
    }),

  hernoemMap: (id, naam) =>
    set((s) => {
      const m = s.mappen[id];
      if (!m || m.naam === naam) return {};
      legStructuurVast(s);
      const mappen = { ...s.mappen, [id]: { ...m, naam } };
      const next = { ...s, mappen };
      schrijfOpslag(next);
      return { mappen };
    }),

  /** Eigenschap van een map (kleur van het map-icoon). */
  /**
   * Omschrijving van een map (vrije tekst, Markdown). Wordt in gegenereerde
   * documenten de tekst onder de kop van die map (docs/DOCUMENTEN.md).
   */
  zetMapOmschrijving: (id, omschrijving) =>
    set((s) => {
      const m = s.mappen[id];
      if (!m || (m.omschrijving || "") === (omschrijving || "")) return {};
      legStructuurVast(s);
      const mappen = { ...s.mappen, [id]: { ...m, omschrijving: omschrijving || undefined } };
      const next = { ...s, mappen };
      schrijfOpslag(next);
      return { mappen };
    }),

  zetMapKleur: (id, kleur) =>
    set((s) => {
      const m = s.mappen[id];
      if (!m) return {};
      legStructuurVast(s);
      const mappen = { ...s.mappen, [id]: { ...m, kleur: kleur || undefined } };
      const next = { ...s, mappen };
      schrijfOpslag(next);
      return { mappen };
    }),

  /** Geselecteerde map (voor het eigenschappen-paneel), of null. */
  mapSelectie: null,
  selecteerMap: (id) => set({ mapSelectie: id, diagramSelectie: null, elementSelectie: null }),

  /** Geselecteerd diagram (eigenschappen-paneel): {profielId, diagramId}|null. */
  diagramSelectie: null,
  selecteerDiagram: (profielId, diagramId) =>
    set({
      diagramSelectie: profielId ? { profielId, diagramId } : null,
      mapSelectie: null,
      elementSelectie: null,
      ankerSleutel: profielId ? tabId(profielId, diagramId) : null,
    }),

  /**
   * Geselecteerde elementregel in de boom: {profielId, elementId}|null. Nodig
   * voor "nog eens klikken of F2 = hernoemen" op elementen (de inspector
   * volgt het element al via de profiel-store, dit is alleen de boomselectie).
   */
  elementSelectie: null,
  selecteerElement: (profielId, elementId) =>
    set({
      elementSelectie: profielId ? { profielId, elementId } : null,
      mapSelectie: null,
      diagramSelectie: null,
      ankerSleutel: profielId ? elementKey(profielId, elementId) : null,
    }),

  /**
   * Hernoem-verzoek voor een boomregel (F2 op de selectie): "map:<id>",
   * "diag:<tabId>" of "el:<profielId>::<elementId>". De regel die hem herkent
   * zet zijn invoerveld aan en wist het verzoek weer.
   */
  hernoemDoel: null,
  vraagHernoem: (sleutel) => set({ hernoemDoel: sleutel }),

  /** Ctrl-klik multiselect in de boom: set van plaatsing-sleutels. */
  multiSelectie: [],
  /** Anker voor Shift+klik: de laatst (enkel- of Ctrl-)geklikte regel. */
  ankerSleutel: null,
  toggleMulti: (key) =>
    set((s) => {
      // Explorer-gedrag: de eerste Ctrl+klik neemt de al geselecteerde regel
      // mee, anders sleept die ene straks niet mee met de bundel.
      let basis = s.multiSelectie;
      if (!basis.length) {
        const huidig = selectieSleutel(s);
        if (huidig && huidig !== key) basis = [huidig];
      }
      return {
        ankerSleutel: key,
        multiSelectie: basis.includes(key) ? basis.filter((k) => k !== key) : [...basis, key],
      };
    }),
  /** Shift+klik: alles tussen het anker en `key` binnen dezelfde lijst (`rijen`). */
  selecteerBereik: (key, rijen) =>
    set((s) => {
      const kandidaat = s.ankerSleutel || selectieSleutel(s);
      const anker = kandidaat && rijen.includes(kandidaat) ? kandidaat : key;
      const a = rijen.indexOf(anker);
      const b = rijen.indexOf(key);
      if (a < 0 || b < 0) return { multiSelectie: [key], ankerSleutel: key };
      return { multiSelectie: rijen.slice(Math.min(a, b), Math.max(a, b) + 1), ankerSleutel: anker };
    }),
  wisMulti: () => set((s) => (s.multiSelectie.length ? { multiSelectie: [] } : {})),

  /** Kort oplichtende boomregel ("Zoek in projectboom"). */
  flitsSleutel: null,
  flits: (sleutel) => {
    set({ flitsSleutel: sleutel });
    setTimeout(() => {
      if (useModellerenStore.getState().flitsSleutel === sleutel) {
        useModellerenStore.setState({ flitsSleutel: null });
      }
    }, 1800);
  },

  /** Verwijder een map; submappen en plaatsingen vallen naar de ouder. */
  verwijderMap: (id) =>
    set((s) => {
      const weg = s.mappen[id];
      if (!weg) return {};
      legStructuurVast(s);
      if (s.mapSelectie === id) queueMicrotask(() => useModellerenStore.setState({ mapSelectie: null }));
      const mappen = {};
      for (const [k, m] of Object.entries(s.mappen)) {
        if (k === id) continue;
        mappen[k] = m.ouderId === id ? { ...m, ouderId: weg.ouderId } : m;
      }
      const plaatsing = {};
      for (const [k, mapId] of Object.entries(s.plaatsing)) {
        const nieuw = mapId === id ? weg.ouderId : mapId;
        if (nieuw) plaatsing[k] = nieuw;
      }
      const next = { ...s, mappen, plaatsing };
      schrijfOpslag(next);
      return { mappen, plaatsing };
    }),

  toggleMap: (id) =>
    set((s) => {
      const mapOpen = { ...s.mapOpen, [id]: !(s.mapOpen[id] ?? true) };
      const next = { ...s, mapOpen };
      schrijfOpslag(next);
      return { mapOpen };
    }),

  /** Verhang een map (ouderId null = naar de wortel). Weigert cycli. */
  verplaatsMap: (id, ouderId) =>
    set((s) => {
      if (id === ouderId) return {};
      const m = s.mappen[id];
      if (!m) return {};
      // Cyclus-check: het doel mag geen nazaat van de gesleepte map zijn.
      let cursor = ouderId;
      while (cursor) {
        if (cursor === id) return {};
        cursor = s.mappen[cursor]?.ouderId || null;
      }
      // Van niveau gewisseld → achteraan in de nieuwe ouder.
      legStructuurVast(s);
      const mappen = { ...s.mappen, [id]: { ...m, ouderId: ouderId || null, volgorde: Date.now() } };
      const next = { ...s, mappen };
      schrijfOpslag(next);
      return { mappen };
    }),

  /** Plaats (of ont-plaats met mapId null) een diagram in een map. */
  plaatsDiagram: (key, mapId) => get().plaatsMeerdere([key], mapId),

  /**
   * Verplaats een geplaatste regel (diagram/element) één plek omhoog of
   * omlaag binnen zijn map. De sleutelvolgorde van `plaatsing` ís de
   * volgorde in de boom (JSON bewaart die), dus wisselen = sleutels
   * herschikken. Eén structuur-undo-stap.
   */
  schuifPlaatsing: (key, richting) =>
    set((s) => {
      const mapId = s.plaatsing[key];
      if (!mapId) return {};
      const sleutels = Object.keys(s.plaatsing);
      const broers = sleutels.filter((k) => s.plaatsing[k] === mapId);
      const idx = broers.indexOf(key);
      const buur = broers[idx + (richting === "omhoog" ? -1 : 1)];
      if (!buur) return {};
      legStructuurVast(s);
      const volgorde = sleutels.slice();
      const a = volgorde.indexOf(key);
      const b = volgorde.indexOf(buur);
      [volgorde[a], volgorde[b]] = [volgorde[b], volgorde[a]];
      const plaatsing = {};
      for (const k of volgorde) plaatsing[k] = s.plaatsing[k];
      const next = { ...s, plaatsing };
      schrijfOpslag(next);
      return { plaatsing };
    }),

  /**
   * Plaats meerdere sleutels (diagrammen/elementen) tegelijk in een map —
   * één structuur-undo-stap voor de hele bundel (bv. "alle 13 actoren naar
   * map Actoren"), in plaats van één stap per regel.
   */
  plaatsMeerdere: (keys, mapId) =>
    set((s) => {
      const doel = mapId || null;
      const teDoen = keys.filter((key) => (s.plaatsing[key] || null) !== doel);
      if (!teDoen.length) return {};
      legStructuurVast(s);
      const plaatsing = { ...s.plaatsing };
      for (const key of teDoen) {
        if (doel) plaatsing[key] = doel;
        else delete plaatsing[key];
      }
      const next = { ...s, plaatsing };
      schrijfOpslag(next);
      return { plaatsing };
    }),

  /**
   * Patch-operatie (projectsync-vangnet): mappen/plaatsingen van een ander
   * upserten of wissen. Buiten de structuur-undo (die staat dan uit).
   */
  patchStructuur: ({ zetMappen = {}, wisMappen = [], zetPlaatsing = {}, wisPlaatsing = [] } = {}) =>
    set((s) => {
      legStructuurVast(s);
      const mappen = { ...s.mappen, ...zetMappen };
      for (const id of wisMappen) delete mappen[id];
      const plaatsing = { ...s.plaatsing, ...zetPlaatsing };
      for (const key of wisPlaatsing) delete plaatsing[key];
      const next = { ...s, mappen, plaatsing };
      schrijfOpslag(next);
      return { mappen, plaatsing };
    }),

  /** Vervang de projectstructuur (project-werkbestand-import). */
  laadStructuur: ({ mappen, plaatsing, tabs, actieveTab }) =>
    set((s) => {
      legStructuurVast(s);
      const next = {
        ...s,
        mappen: mappen || {},
        plaatsing: plaatsing || {},
        tabs: tabs || [],
        actieveTab: actieveTab || null,
        mapSelectie: null,
        diagramSelectie: null,
        multiSelectie: [],
      };
      schrijfOpslag(next);
      menuBus.emit("menu:ververs");
      return next;
    }),

  /** Ctrl+Z / Ctrl+Y op de boom: structuur-undo/redo (mappen + plaatsing). */
  structuurUndo: () =>
    set((s) => {
      const vorige = _structuurVerleden.pop();
      if (!vorige) return {};
      _structuurToekomst.push(structuurFoto(s));
      const next = { ...s, ...vorige };
      schrijfOpslag(next);
      return vorige;
    }),
  structuurRedo: () =>
    set((s) => {
      const volgende = _structuurToekomst.pop();
      if (!volgende) return {};
      _structuurVerleden.push(structuurFoto(s));
      const next = { ...s, ...volgende };
      schrijfOpslag(next);
      return volgende;
    }),
}));

// Projectsync (plan 2026-10-07, stap 2): structuuracties als operaties; de
// structuur-undo/redo en laadStructuur vangt het diff-vangnet.
koppelStore("structuur", useModellerenStore, {
  ops: STRUCTUUR_OPS,
  velden: STRUCTUUR_VELDEN,
  net: structuurNet,
  undoPauze: (aan) => {
    _structuurUndoUit = aan;
  },
  // Een eigen Ctrl+Z mag andermans map/plaatsing niet terugdraaien: verwerk
  // de remote wijziging in elke bewaarde stand (zie pasOperatieToe).
  naRemote: (voor, na) => {
    const rb = (stand) => rebaseStand(stand, voor, na, STRUCTUUR_VELDEN);
    _structuurVerleden.splice(0, _structuurVerleden.length, ..._structuurVerleden.map(rb));
    _structuurToekomst.splice(0, _structuurToekomst.length, ..._structuurToekomst.map(rb));
  },
});

// Gedragsverwijzing (gedragsdiagram-primitief §3.2): dubbelklik op bv. een
// submachine state of call-activity opent het gekoppelde diagram. De canvas-
// activiteit emit "studio:open-diagram"; hier (module-niveau, dus altijd
// actief) vertalen we dat naar een tab in de Modelleren-host. Buiten de host
// zet de activiteit zelf al het actieve diagram; de tab staat dan alvast
// klaar voor wie naar Modelleren wisselt.
menuBus.on("studio:open-diagram", ({ profielId, diagramId } = {}) => {
  if (!profielId || !diagramId) return;
  useModellerenStore.getState().openTab(profielId, diagramId);
});

/** Actieve tab + bijbehorend profieltype (of nulls). */
function actieveTabInfo() {
  const s = useModellerenStore.getState();
  const tab = s.tabs.find((t) => t.id === s.actieveTab) || null;
  return { tab, profiel: tab ? getProfieltype(tab.profielId) || null : null };
}

// ── Sidebar: projectbrowser — vrije mappen + "Niet ingedeeld" ───────

/**
 * Eén diagram-regel; overal dezelfde. Klikmodel (sessiebesluit 2026-07-12):
 * klik = eigenschappen in de inspector, dubbelklik = openen (tab) — zoals
 * in Sparx EA. Rechtsklik biedt beide expliciet.
 */
/**
 * Klik op een al geselecteerde regel = hernoemen (Verkenner-gedrag; zo
 * werkte het ook in de oude IDE), met uitstel zodat een dubbelklik (openen)
 * hem nog kan afbreken.
 */
function useKlikHernoem(start) {
  const timer = React.useRef(null);
  const annuleer = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };
  const plan = () => {
    annuleer();
    timer.current = setTimeout(() => {
      timer.current = null;
      start();
    }, 320);
  };
  return { plan, annuleer };
}

/**
 * Na Enter/Escape in een naamveld de toetsenbordfocus teruggeven aan de
 * boom (het dichtstbijzijnde focusbare blok), zodat een volgende F2 landt.
 * Niet bij blur: dan klikte de gebruiker bewust ergens anders.
 */
function focusTerug(e) {
  const blok = e.currentTarget.closest("[tabindex]");
  if (blok) setTimeout(() => blok.focus(), 0);
}

/** Reageert op een F2-hernoemverzoek uit de sidebar (store.hernoemDoel). */
function useHernoemDoel(sleutel, start) {
  const hernoemDoel = useModellerenStore((s) => s.hernoemDoel);
  useEffect(() => {
    if (hernoemDoel && hernoemDoel === sleutel) {
      start();
      useModellerenStore.getState().vraagHernoem(null);
    }
  }, [hernoemDoel, sleutel]); // eslint-disable-line react-hooks/exhaustive-deps
}

function DiagramRegel({ profiel, diagram, inMap = false }) {
  const actieveTab = useModellerenStore((s) => s.actieveTab);
  const openTab = useModellerenStore((s) => s.openTab);
  const plaatsDiagram = useModellerenStore((s) => s.plaatsDiagram);
  const id = tabId(profiel.id, diagram.id);
  const stijl = effectieveStijl(profiel);
  const selecteerDiagram = useModellerenStore((s) => s.selecteerDiagram);
  const toggleMulti = useModellerenStore((s) => s.toggleMulti);
  const wisMulti = useModellerenStore((s) => s.wisMulti);
  const inMulti = useModellerenStore((s) => s.multiSelectie.includes(id));
  // "Geselecteerd" (eigenschappen in de inspector) is iets anders dan
  // "open als tab" — de open tab krijgt een subtiel accentstreepje, de
  // selectie de blauwe rij.
  const isSelectie = useModellerenStore(
    (s) =>
      !!s.diagramSelectie &&
      s.diagramSelectie.profielId === profiel.id &&
      s.diagramSelectie.diagramId === diagram.id
  );
  const verplaats = (mapId) =>
    meeTeNemen(id).forEach((k) => {
      if (mapId || !isElementKey(k)) plaatsDiagram(k, mapId);
    });
  // Inline hernoemen: F2 (via hernoemDoel), klik op de al geselecteerde
  // regel, of het contextmenu — geen prompt-popup meer.
  const [bewerk, setBewerk] = React.useState(false);
  useHernoemDoel("diag:" + id, () => setBewerk(true));
  const klikHernoem = useKlikHernoem(() => setBewerk(true));
  const commitNaam = (naam) => {
    setBewerk(false);
    const schoon = (naam || "").trim();
    if (schoon && schoon !== diagram.naam) profiel.useStore.getState().renameDiagram(diagram.id, schoon);
  };
  const ctx = (e) =>
    openCtxMenu(e, [
      { label: "Openen", onClick: () => openTab(profiel.id, diagram.id) },
      { label: "Eigenschappen", onClick: () => selecteerDiagram(profiel.id, diagram.id) },
      { label: "Hernoemen", onClick: () => setBewerk(true) },
      ...(inMap
        ? [
            { label: "Omhoog", onClick: () => useModellerenStore.getState().schuifPlaatsing(id, "omhoog") },
            { label: "Omlaag", onClick: () => useModellerenStore.getState().schuifPlaatsing(id, "omlaag") },
          ]
        : []),
      {
        label: "Verplaats naar",
        items: verplaatsNaarItems(verplaats, {
          bovenaan: inMap ? { label: "(Niet ingedeeld)" } : null,
        }),
      },
      ...(inMap ? [{ sep: true }, { label: "Uit de map halen", onClick: () => verplaats(null) }] : []),
      // Diagram weggooien — voor elk profiel (gemeld 2026-10-07: in de
      // Modelleren-host was er buiten documentenbeheer-editors geen weg).
      // Elementen blijven in het model; bij documentenbeheer (BPMN/DMN) gaat
      // de documentinhoud mee. Open tab sluit, boomplaatsing vervalt.
      { sep: true },
      {
        label: "Verwijderen…",
        onClick: async () => {
          const vraag = profiel.documentenBeheer
            ? `"${diagram.naam}" verwijderen? De inhoud van dit document gaat verloren.`
            : `Diagram "${diagram.naam}" verwijderen? (Elementen blijven in het model.)`;
          if (!(await vraagBevestiging({ titel: "Diagram verwijderen", tekst: vraag, bevestig: "Verwijder", gevaar: true }))) return;
          const st = profiel.useStore.getState();
          if (profiel.documentenBeheer) st.verwijderDiagram(diagram.id);
          else st.deleteDiagram(diagram.id);
          useModellerenStore.getState().sluitTab(id);
          plaatsDiagram(id, null);
        },
      },
    ]);
  if (bewerk) {
    return (
      <input
        className="studio-project__mapnaam-invoer"
        style={{ display: "block", width: "100%", boxSizing: "border-box", font: "inherit" }}
        defaultValue={diagram.naam}
        autoFocus
        onFocus={(e) => e.target.select()}
        onBlur={(e) => commitNaam(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" || e.key === "Escape") focusTerug(e);
          if (e.key === "Enter") commitNaam(e.target.value);
          else if (e.key === "Escape") setBewerk(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      data-boomsleutel={"diag:" + id}
      className={
        "studio-project__diagram" +
        (id === actieveTab ? " is-actief" : "") +
        (isSelectie ? " is-selectie" : "") +
        (inMulti ? " is-multi" : "")
      }
      data-sleutel={id}
      onMouseDown={(e) => {
        if (e.shiftKey) e.preventDefault(); // geen tekstselectie bij Shift+klik
      }}
      onClick={(e) => {
        if (e.shiftKey) useModellerenStore.getState().selecteerBereik(id, rijenInLijst(e.currentTarget));
        else if (e.ctrlKey || e.metaKey) toggleMulti(id);
        else if (isSelectie && !inMulti) klikHernoem.plan();
        else {
          wisMulti();
          selecteerDiagram(profiel.id, diagram.id);
        }
      }}
      onDoubleClick={() => {
        klikHernoem.annuleer();
        openTab(profiel.id, diagram.id);
      }}
      onContextMenu={ctx}
      title={`${diagram.naam} — ${profiel.label} (klik = eigenschappen, nog eens klikken of F2 = hernoemen, dubbelklik = openen, Ctrl+klik = meervoudig)`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(PLAATSING_MIME, meeTeNemen(id).join("\n"));
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      {inMap && (
        <span className="studio-project__regel-profiel" style={{ color: stijl.kleur || "inherit" }}>
          <ProfielIcoon profiel={profiel} />
        </span>
      )}
      {diagram.naam}
    </button>
  );
}

/**
 * Drop-gedrag voor mappen en "Niet ingedeeld": `handlers` = { [mime]: fn },
 * de fn krijgt de dataTransfer-payload (string) van dat mime.
 */
function useDrop(handlers) {
  const [over, setOver] = React.useState(false);
  const mimes = Object.keys(handlers);
  return {
    over,
    props: {
      onDragOver: (e) => {
        if (mimes.some((m) => e.dataTransfer.types.includes(m))) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      },
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: (e) => {
        setOver(false);
        for (const m of mimes) {
          const data = e.dataTransfer.getData(m);
          if (data) {
            e.preventDefault();
            e.stopPropagation();
            handlers[m](data);
            return;
          }
        }
      },
    },
  };
}

/**
 * Hiërarchie van een profiel (E01/P02): kind→ouder en ouder→kinderen, uit de
 * hierarchie-connectortypen van de descriptor (incl. `omgekeerd`) plus de
 * hierarchieParen-hook — dezelfde regels als de 0.5-ElementenBrowser.
 */
function bepaalHierarchie(profiel, elements) {
  const regels = [].concat(profiel.descriptor.hierarchie || [])
    .map((h) => (typeof h === "string" ? { type: h } : h))
    .filter((h) => h?.type);
  const kinderenVan = new Map();
  const ouderVan = new Map();
  if (!regels.length) return { kinderenVan, ouderVan };
  const voeg = (ouder, kind) => {
    if (ouder === kind || !elements[ouder] || !elements[kind]) return;
    if (!kinderenVan.has(ouder)) kinderenVan.set(ouder, []);
    if (!kinderenVan.get(ouder).includes(kind)) kinderenVan.get(ouder).push(kind);
    ouderVan.set(kind, ouder);
  };
  for (const el of Object.values(elements)) {
    const regel = regels.find((h) => h.type === el.elementType);
    if (!regel || !el.source || !el.target) continue;
    if (regel.omgekeerd) voeg(el.target, el.source);
    else voeg(el.source, el.target);
  }
  const state = profiel.useStore.getState();
  for (const [ouder, kind] of profiel.descriptor.hooks?.hierarchieParen?.(state) || []) {
    voeg(ouder, kind);
  }
  return { kinderenVan, ouderVan };
}

/** Wandel naar de top van de hiërarchie (GE → zijn ENT). */
function topVoorouder(ouderVan, elementId) {
  let cursor = elementId;
  for (let i = 0; i < 16 && ouderVan.has(cursor); i++) cursor = ouderVan.get(cursor);
  return cursor;
}

// ── Contextmenu (rechtsklik in de boom) ─────────────────────────────
// Een item mag `items: [...]` dragen: klikken opent die lijst in hetzelfde
// menu (drill-down met ‹ terug) — gebruikt voor "Verplaats naar ▸".
function ContextMenu({ menu, sluit }) {
  const [sub, setSub] = React.useState(null);
  const menuRef = React.useRef(null);
  useEffect(() => setSub(null), [menu]);
  // Binnen het venster blijven: naar boven/links schuiven als het menu
  // anders uit beeld loopt (lange lijsten scrollen bovendien intern).
  React.useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const boven = Math.max(8, Math.min(menu?.y ?? 0, window.innerHeight - r.height - 8));
    const links = Math.max(8, Math.min(menu?.x ?? 0, window.innerWidth - r.width - 8));
    el.style.top = `${boven}px`;
    el.style.left = `${links}px`;
  }, [menu, sub]);
  useEffect(() => {
    if (!menu) return;
    const onDown = () => sluit();
    const onKey = (e) => e.key === "Escape" && sluit();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, sluit]);
  if (!menu) return null;
  const items = sub ? sub.items : menu.items;
  return (
    <div ref={menuRef} className="studio-ctxmenu" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()}>
      {sub && (
        <button type="button" className="studio-ctxmenu__item studio-ctxmenu__terug" onClick={() => setSub(null)}>
          ‹ {sub.label}
        </button>
      )}
      {items.length === 0 && <div className="studio-ctxmenu__leeg">geen opties</div>}
      {items.map((it, i) =>
        it.sep ? (
          <div key={`sep-${i}`} className="studio-ctxmenu__sep" />
        ) : it.items ? (
          <button
            key={it.label}
            type="button"
            className="studio-ctxmenu__item"
            onClick={() => setSub(it)}
          >
            {it.label} <span style={{ float: "right", opacity: 0.6 }}>▸</span>
          </button>
        ) : (
          <button
            key={it.label + i}
            type="button"
            className="studio-ctxmenu__item"
            onClick={() => {
              sluit();
              it.onClick();
            }}
          >
            {it.label}
          </button>
        )
      )}
    </div>
  );
}

/** Gedeelde contextmenu-stand (één menu tegelijk in de hele boom). */
const useCtxMenu = create(() => ({ menu: null }));
const openCtxMenu = (e, items) => {
  e.preventDefault();
  e.stopPropagation();
  useCtxMenu.setState({ menu: { x: e.clientX, y: e.clientY, items } });
};

/** Mappen op handmatige volgorde (Omhoog/Omlaag in het contextmenu). */
const opVolgorde = (a, b) => (a.volgorde || 0) - (b.volgorde || 0);

/**
 * Submenu-items "Verplaats naar ▸": alle mappen (ingesprongen op diepte),
 * optioneel "(wortel)" of "(Niet ingedeeld)" bovenaan, en met uitsluitingen
 * (bv. een map zelf + zijn nazaten). `doe(mapId|null)` voert de zet uit.
 */
function verplaatsNaarItems(doe, { bovenaan = null, uitgesloten = new Set() } = {}) {
  const { mappen } = useModellerenStore.getState();
  const items = bovenaan ? [{ label: bovenaan.label, onClick: () => doe(null) }] : [];
  const loop = (ouderId, diepte) => {
    Object.values(mappen)
      .filter((m) => (m.ouderId || null) === ouderId)
      .sort(opVolgorde)
      .forEach((m) => {
        if (!uitgesloten.has(m.id)) {
          items.push({ label: `${"  ".repeat(diepte)}📁 ${m.naam}`, onClick: () => doe(m.id) });
        }
        // Nazaten van een uitgesloten map zijn ook uitgesloten (cyclus).
        if (!uitgesloten.has(m.id)) loop(m.id, diepte + 1);
      });
  };
  loop(null, 0);
  return items;
}

/**
 * Submenu-items "Nieuw diagram ▸": één per profieltype dat documenten kan
 * aanmaken; het nieuwe diagram landt meteen in de gegeven map (of los).
 */
function nieuwDiagramItems(mapId) {
  return getProfieltypen()
    .filter((p) => !p.vasteDocumenten)
    .map((p) => ({
      label: p.label,
      onClick: async () => {
        const naam = await vraagNaam({
          titel: `Nieuw ${p.diagramTerm} (${p.label})`,
          waarde: `Nieuw ${p.diagramTerm}`,
          bevestig: "Aanmaken",
        });
        if (!naam) return;
        const id = `${p.menuPrefix}_${Date.now()}`;
        p.useStore.getState().addDiagram({ id, naam, diagramType: p.descriptor.id });
        const s = useModellerenStore.getState();
        if (mapId) s.plaatsDiagram(tabId(p.id, id), mapId);
        s.openTab(p.id, id);
      },
    }));
}

/** Alle nazaat-map-ids van een map (voor uitsluiting bij verplaatsen). */
function nazatenVan(mappen, id) {
  const uit = new Set([id]);
  let gegroeid = true;
  while (gegroeid) {
    gegroeid = false;
    for (const m of Object.values(mappen)) {
      if (m.ouderId && uit.has(m.ouderId) && !uit.has(m.id)) {
        uit.add(m.id);
        gegroeid = true;
      }
    }
  }
  return uit;
}

/** Sleutels die meegaan bij slepen/verplaatsen: de multiselectie als de
 *  aangeklikte regel erin zit, anders alleen die regel. */
function meeTeNemen(sleutel) {
  const { multiSelectie } = useModellerenStore.getState();
  return multiSelectie.includes(sleutel) ? multiSelectie : [sleutel];
}

/**
 * Plaats elementen van een profiel in een map (drop op een map, of
 * "Verplaats naar map" in de ElementenBrowser). Een hiërarchie-kind (GE)
 * kan niet los geplaatst worden: we plaatsen zijn top-voorouder (ENT) — de
 * kinderen reizen als boomregels vanzelf mee. Eén undo-stap voor de bundel.
 */
function plaatsElementenInMap(profiel, elementIds, mapId) {
  if (!elementIds?.length || !mapId) return;
  const { ouderVan } = bepaalHierarchie(profiel, profiel.useStore.getState().elements);
  const keys = [...new Set(elementIds.map((eid) => topVoorouder(ouderVan, eid)))].map((id) =>
    elementKey(profiel.id, id)
  );
  useModellerenStore.getState().plaatsMeerdere(keys, mapId);
}

/**
 * Submenu "Verplaats naar map ▸" voor de ElementenBrowser van een profiel:
 * alle bestaande mappen, plus "Nieuwe map…" (met een voorgestelde naam, bv.
 * het typelabel bij "alle actoren naar een map Actoren"). Wordt als
 * `naarMapItems(ids, {voorstel})` aan de browser gegeven.
 */
function naarMapItemsVoor(profiel) {
  return (elementIds, { voorstel = "Nieuwe map" } = {}) => [
    ...verplaatsNaarItems((mapId) => plaatsElementenInMap(profiel, elementIds, mapId)),
    ...(Object.keys(useModellerenStore.getState().mappen).length ? [{ sep: true }] : []),
    {
      // Direct aanmaken met een voorstelnaam en meteen inline hernoemen —
      // geen prompt-popup (2026-10-07).
      label: "Nieuwe map",
      onClick: () => {
        const ms = useModellerenStore.getState();
        const mapId = ms.nieuweMap(voorstel);
        plaatsElementenInMap(profiel, elementIds, mapId);
        ms.vraagHernoem("map:" + mapId);
      },
    },
  ];
}

/**
 * Element-regel in een map (eigendom-plek; het element woont hier éénmaal).
 * Hiërarchie-kinderen (GE's onder hun ENT, compositie) reizen automatisch
 * mee als geneste regels; `standaardDichtInBoom` van het elementtype bepaalt
 * de beginstand van de chevron.
 */
function ElementRegel({ profiel, elementId, sleutel, diepte = 0 }) {
  const elements = profiel.useStore((s) => s.elements);
  const plaatsDiagram = useModellerenStore((s) => s.plaatsDiagram);
  const toggleMulti = useModellerenStore((s) => s.toggleMulti);
  const wisMulti = useModellerenStore((s) => s.wisMulti);
  const inMulti = useModellerenStore((s) => !!sleutel && s.multiSelectie.includes(sleutel));
  const flitst = useModellerenStore((s) => !!sleutel && s.flitsSleutel === sleutel);
  const isSelectie = useModellerenStore(
    (s) => !!s.elementSelectie && s.elementSelectie.profielId === profiel.id && s.elementSelectie.elementId === elementId
  );
  const rijRef = React.useRef(null);
  useEffect(() => {
    if (flitst) rijRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [flitst]);
  const element = elements[elementId];
  const et = element
    ? (profiel.descriptor.elementTypes || []).find((t) => t.id === element.elementType)
    : null;
  const [dicht, setDicht] = React.useState(null); // null = volg profiel-default
  const [bewerk, setBewerk] = React.useState(false);
  // Inline hernoemen zoals mappen en diagrammen (0.13.0): F2 op de selectie,
  // nog eens klikken op de al geselecteerde regel, dubbelklik, of het contextmenu.
  useHernoemDoel("el:" + elementKey(profiel.id, elementId), () => setBewerk(true));
  const klikHernoem = useKlikHernoem(() => setBewerk(true));
  if (!element) return null;

  const { kinderenVan } = bepaalHierarchie(profiel, elements);
  const kinderen = diepte < 8 ? kinderenVan.get(elementId) || [] : [];
  const isDicht = dicht ?? !!et?.standaardDichtInBoom;
  const stijl = effectieveStijl(profiel);

  /**
   * Klik = eigenschappen in de inspector (sessiebesluit 2026-07-12), en het
   * element focussen op een open diagram als het daarop staat: wissel
   * hooguit tussen ópen tabs — er wordt niets (her)geopend. Staat het
   * element nergens op een open diagram van een ander profiel, dan
   * gebeurt er niets.
   */
  const selecteer = () => {
    const ms = useModellerenStore.getState();
    ms.selecteerElement(profiel.id, elementId);
    const st = profiel.useStore.getState();
    const openTabsVanProfiel = ms.tabs.filter((t) => t.profielId === profiel.id);
    const tabMetElement = openTabsVanProfiel.find((t) =>
      (st.diagrams[t.diagramId]?.nodes || []).some((n) => n.elementId === elementId)
    );
    const isActiefProfiel = actieveTabInfo().profiel?.id === profiel.id;
    if (tabMetElement && ms.actieveTab !== tabMetElement.id) ms.activeer(tabMetElement.id);
    if (tabMetElement || isActiefProfiel) {
      setTimeout(
        () => menuBus.emit(`${profiel.menuPrefix}:selecteer-element`, elementId),
        tabMetElement && ms.actieveTab !== tabMetElement.id ? 120 : 0
      );
    }
  };

  const commitNaam = (naam) => {
    setBewerk(false);
    const schoon = (naam || "").trim();
    if (schoon && schoon !== element.naam) {
      hernoemElement(profiel.useStore, profiel.descriptor, elementId, schoon);
    }
  };

  /**
   * "Uit de map halen" bestaat bewust niet voor elementen (waar zou hij
   * heen moeten?); wel verwijderen uit het model — achter een bevestiging,
   * met Ctrl+Z als vangnet (zundo).
   */
  const verwijderUitModel = async () => {
    const ok = await vraagBevestiging({
      titel: "Uit het model verwijderen",
      tekst:
        `"${element.naam || elementId}" uit het model verwijderen?\n` +
        "Dit haalt het element (en zijn connectoren) ook van alle diagrammen. Ctrl+Z maakt het ongedaan.",
      bevestig: "Verwijder",
      gevaar: true,
    });
    if (!ok) return;
    profiel.useStore.getState().deleteElement(elementId);
    if (sleutel) plaatsDiagram(sleutel, null);
  };

  const ctx = (e) =>
    openCtxMenu(e, [
      { label: "Selecteer in inspector", onClick: selecteer },
      { label: "Hernoemen", onClick: () => setBewerk(true) },
      ...(sleutel
        ? [
            { label: "Omhoog", onClick: () => useModellerenStore.getState().schuifPlaatsing(sleutel, "omhoog") },
            { label: "Omlaag", onClick: () => useModellerenStore.getState().schuifPlaatsing(sleutel, "omlaag") },
            {
              label: "Verplaats naar",
              items: verplaatsNaarItems((mapId) => {
                if (mapId) meeTeNemen(sleutel).forEach((k) => plaatsDiagram(k, mapId));
              }),
            },
          ]
        : []),
      { sep: true },
      { label: "Verwijderen uit model…", onClick: verwijderUitModel },
    ]);

  return (
    <div>
      <div
        ref={rijRef}
        className={"studio-project__elementrij" + (flitst ? " is-flits" : "")}
        style={{ paddingLeft: diepte ? diepte * 12 : 0 }}
      >
        {kinderen.length > 0 ? (
          <button type="button" className="studio-project__caret" onClick={() => setDicht(!isDicht)}>
            {isDicht ? "▸" : "▾"}
          </button>
        ) : (
          <span className="studio-project__caret" />
        )}
        {bewerk ? (
          // Zelfde "regel" als de knop (klasse, padding, icoon), zodat het
          // invoerveld precies op de plek van de naam staat en meeloopt met
          // de diepte in de boom.
          <span className="studio-project__diagram studio-project__element" style={{ display: "flex", alignItems: "center" }}>
            <span className="studio-project__regel-profiel" style={{ color: stijl.kleur || "inherit" }}>
              {et ? <TypeIcoon elementType={et} maat={13} /> : <ProfielIcoon profiel={profiel} />}
            </span>
            <input
              className="studio-project__mapnaam-invoer"
              style={{ flex: 1, minWidth: 0, font: "inherit" }}
              defaultValue={element.naam || ""}
              autoFocus
              onFocus={(e) => e.target.select()}
              onBlur={(e) => commitNaam(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" || e.key === "Escape") focusTerug(e);
                if (e.key === "Enter") commitNaam(e.target.value);
                else if (e.key === "Escape") setBewerk(false);
              }}
            />
          </span>
        ) : (
          <button
            type="button"
            data-boomsleutel={"el:" + elementKey(profiel.id, elementId)}
            className={
              "studio-project__diagram studio-project__element" +
              (inMulti ? " is-multi" : "") +
              (isSelectie && !inMulti ? " is-selectie" : "")
            }
            data-sleutel={sleutel || undefined}
            onMouseDown={(e) => {
              if (e.shiftKey) e.preventDefault();
            }}
            onClick={(e) => {
              if (sleutel && e.shiftKey) useModellerenStore.getState().selecteerBereik(sleutel, rijenInLijst(e.currentTarget));
              else if (sleutel && (e.ctrlKey || e.metaKey)) toggleMulti(sleutel);
              else if (isSelectie && !inMulti) klikHernoem.plan();
              else {
                wisMulti();
                selecteer();
              }
            }}
            onDoubleClick={() => {
              klikHernoem.annuleer();
              setBewerk(true);
            }}
            onContextMenu={ctx}
            title={`${element.naam || elementId} — ${et?.label || "element"} (${profiel.label}; klik = eigenschappen, nog eens klikken of F2 = hernoemen)`}
            draggable={!!sleutel}
            onDragStart={(e) => {
              if (!sleutel) return;
              e.dataTransfer.setData(PLAATSING_MIME, meeTeNemen(sleutel).join("\n"));
              // Cross-profiel referentie (instantie-van): op een canvas-node
              // droppen (bv. levenslijn typeren) — zie ELEMENT_REF_MIME.
              e.dataTransfer.setData(ELEMENT_REF_MIME, JSON.stringify({ profielId: profiel.id, elementId }));
              e.dataTransfer.effectAllowed = "copyMove";
            }}
          >
            <span className="studio-project__regel-profiel" style={{ color: stijl.kleur || "inherit" }}>
              {et ? <TypeIcoon elementType={et} maat={13} /> : <ProfielIcoon profiel={profiel} />}
            </span>
            {weergaveNaam(element, et)}
          </button>
        )}
      </div>
      {!isDicht &&
        kinderen.map((kindId) => (
          <ElementRegel key={kindId} profiel={profiel} elementId={kindId} diepte={diepte + 1} />
        ))}
    </div>
  );
}

/**
 * Eén geplaatste boomregel: diagram- of element-sleutel. Concept-besluit
 * (2026-07-12): een diagram is GEEN map — het toont elementen alleen maar,
 * en elementen staan typisch op meerdere diagrammen. In de boom is een
 * diagram dus een gewoon blad-element, visueel exact gelijkwaardig aan de
 * andere regels (zelfde chevron-kolom, nooit kinderen).
 */
function GeplaatstItem({ sleutel }) {
  if (isElementKey(sleutel)) {
    const [, profielId, elementId] = sleutel.split("::");
    const profiel = getProfieltype(profielId);
    if (!profiel) return null;
    return <ElementRegel profiel={profiel} elementId={elementId} sleutel={sleutel} />;
  }
  const [profielId, diagramId] = sleutel.split("::");
  const profiel = getProfieltype(profielId);
  if (!profiel) return null;
  return <GeplaatstDiagram profiel={profiel} diagramId={diagramId} />;
}

function GeplaatstDiagram({ profiel, diagramId }) {
  const diagram = profiel.useStore((s) => s.diagrams[diagramId]);
  if (!diagram) return null;
  return (
    <div className="studio-project__elementrij">
      <span className="studio-project__caret" />
      <DiagramRegel profiel={profiel} diagram={diagram} inMap />
    </div>
  );
}

function Map_({ map, diepte }) {
  const mappen = useModellerenStore((s) => s.mappen);
  const mapOpen = useModellerenStore((s) => s.mapOpen);
  const plaatsing = useModellerenStore((s) => s.plaatsing);
  const toggleMap = useModellerenStore((s) => s.toggleMap);
  const nieuweMap = useModellerenStore((s) => s.nieuweMap);
  const hernoemMap = useModellerenStore((s) => s.hernoemMap);
  const verwijderMap = useModellerenStore((s) => s.verwijderMap);
  const plaatsDiagram = useModellerenStore((s) => s.plaatsDiagram);
  const verplaatsMap = useModellerenStore((s) => s.verplaatsMap);

  const open = mapOpen[map.id] ?? true;
  const kinderen = Object.values(mappen).filter((m) => m.ouderId === map.id).sort(opVolgorde);
  const inhoud = Object.entries(plaatsing)
    .filter(([, mapId]) => mapId === map.id)
    .map(([k]) => k);
  const selecteerMap = useModellerenStore((s) => s.selecteerMap);
  const mapSelectie = useModellerenStore((s) => s.mapSelectie);
  const [bewerk, setBewerk] = React.useState(false);
  useHernoemDoel("map:" + map.id, () => setBewerk(true));
  const klikHernoem = useKlikHernoem(() => setBewerk(true));
  const drop = useDrop({
    // Boomregel(s): één sleutel, of de hele multiselectie (regel per regel).
    [PLAATSING_MIME]: (data) => data.split("\n").forEach((key) => plaatsDiagram(key, map.id)),
    // Andere map: verhangen (met cyclus-check in de store).
    [MAP_MIME]: (id) => verplaatsMap(id, map.id),
    // Element(en) uit de ElementenBrowser (van het actieve tab-profiel);
    // een Ctrl-klik-multiselectie komt als bundel (elementIds). Een
    // hiërarchie-kind (GE) kan niet los geplaatst worden: we plaatsen zijn
    // top-voorouder (ENT) — de kinderen reizen als boomregels vanzelf mee.
    [ELEMENT_MIME]: (rauw) => {
      try {
        const { elementId, elementIds } = JSON.parse(rauw);
        const { profiel } = actieveTabInfo();
        if (!profiel) return;
        const ids = elementIds?.length ? elementIds : elementId ? [elementId] : [];
        plaatsElementenInMap(profiel, ids, map.id);
      } catch { /* ignore */ }
    },
  });

  // Nieuwe submap: meteen aanmaken en inline hernoemen (geen prompt); de
  // ouder gaat open zodat je de nieuwe regel ziet.
  const nieuweSubmap = () => {
    const ms = useModellerenStore.getState();
    const id = ms.nieuweMap("Nieuwe map", map.id);
    if (!open) toggleMap(map.id);
    ms.vraagHernoem("map:" + id);
  };
  const verwijder = async () => {
    const ok = await vraagBevestiging({
      titel: "Map verwijderen",
      tekst: `Map "${map.naam}" verwijderen? De inhoud valt terug naar het niveau erboven.`,
      bevestig: "Verwijder",
      gevaar: true,
    });
    if (ok) verwijderMap(map.id);
  };
  const schuifMap = useModellerenStore((s) => s.schuifMap);
  const ctx = (e) =>
    openCtxMenu(e, [
      { label: "Nieuw diagram", items: nieuwDiagramItems(map.id) },
      { label: "Nieuwe submap…", onClick: nieuweSubmap },
      { label: "Hernoemen", onClick: () => setBewerk(true) },
      { label: "Eigenschappen", onClick: () => selecteerMap(map.id) },
      { sep: true },
      {
        label: "Transformeren",
        items: [
          { label: "Importeren…", onClick: () => useTransformStore.getState().openen(map.id, "import") },
          { label: "Transformeren…", onClick: () => useTransformStore.getState().openen(map.id, "transform") },
          { label: "Exporteren…", onClick: () => useTransformStore.getState().openen(map.id, "export") },
        ],
      },
      // Documentsjablonen: een document uit deze map (use case-overzicht,
      // gegevenswoordenboek, …) — de "Document: …"-generatoren onder Exporteren.
      { label: "Document maken…", onClick: () => useTransformStore.getState().openen(map.id, "export") },
      { sep: true },
      { label: "Omhoog", onClick: () => schuifMap(map.id, "omhoog") },
      { label: "Omlaag", onClick: () => schuifMap(map.id, "omlaag") },
      {
        label: "Verplaats naar",
        items: verplaatsNaarItems((mapId) => verplaatsMap(map.id, mapId), {
          bovenaan: map.ouderId ? { label: "(wortel)" } : null,
          uitgesloten: nazatenVan(useModellerenStore.getState().mappen, map.id),
        }),
      },
      { sep: true },
      { label: "Verwijderen…", onClick: verwijder },
    ]);

  const commitNaam = (naam) => {
    setBewerk(false);
    const schoon = (naam || "").trim();
    if (schoon && schoon !== map.naam) hernoemMap(map.id, schoon);
  };

  return (
    <div className="studio-project__map" style={{ marginLeft: diepte ? 12 : 0 }}>
      <div
        data-boomsleutel={"map:" + map.id}
        className={
          "studio-project__mapkop" +
          (drop.over ? " is-dropdoel" : "") +
          (mapSelectie === map.id ? " is-selectie" : "")
        }
        draggable={!bewerk}
        onDragStart={(e) => {
          e.dataTransfer.setData(MAP_MIME, map.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onContextMenu={ctx}
        {...drop.props}
      >
        <button type="button" className="studio-project__caret" onClick={() => toggleMap(map.id)}>
          {open ? "▾" : "▸"}
        </button>
        <span className="studio-project__mapstip" style={{ background: map.kleur || "var(--s-fg-muted)" }} />
        {bewerk ? (
          <input
            className="studio-project__mapnaam-invoer"
            defaultValue={map.naam}
            autoFocus
            onFocus={(e) => e.target.select()}
            onBlur={(e) => commitNaam(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" || e.key === "Escape") focusTerug(e);
              if (e.key === "Enter") commitNaam(e.target.value);
              else if (e.key === "Escape") setBewerk(false);
            }}
          />
        ) : (
          <span
            className="studio-project__mapnaam"
            onClick={() => {
              if (mapSelectie === map.id) klikHernoem.plan();
              else selecteerMap(map.id);
            }}
            onDoubleClick={() => {
              klikHernoem.annuleer();
              setBewerk(true);
            }}
            title="Klik = eigenschappen; nog eens klikken, F2, dubbelklik of ✎ = hernoemen; sleep = verplaatsen; rechtsklik = menu"
          >
            {map.naam}
          </span>
        )}
        <button type="button" className="studio-project__nieuw" title="Hernoemen" onClick={() => setBewerk(true)}>
          ✎
        </button>
        <button type="button" className="studio-project__nieuw" title="Nieuwe submap" onClick={nieuweSubmap}>
          ＋
        </button>
        <button
          type="button"
          className="studio-project__nieuw"
          title="Map verwijderen (inhoud valt terug naar de ouder)"
          onClick={verwijder}
        >
          ×
        </button>
      </div>
      {open && (
        <div data-lijst>
          {kinderen.map((m) => (
            <Map_ key={m.id} map={m} diepte={diepte + 1} />
          ))}
          {inhoud.map((k) => (
            <GeplaatstItem key={k} sleutel={k} />
          ))}
          {kinderen.length === 0 && inhoud.length === 0 && (
            <div className="studio-project__leeg">sleep hier diagrammen of elementen in</div>
          )}
        </div>
      )}
    </div>
  );
}

function ProfielSectie({ profiel }) {
  const diagrams = profiel.useStore((s) => s.diagrams);
  const plaatsing = useModellerenStore((s) => s.plaatsing);
  const openTab = useModellerenStore((s) => s.openTab);

  // Alleen wat nog niet in een map is geplaatst.
  const entries = Object.values(diagrams).filter((d) => !plaatsing[tabId(profiel.id, d.id)]);
  const nieuw = async () => {
    const naam = await vraagNaam({
      titel: `Nieuw ${profiel.diagramTerm}`,
      waarde: `Nieuw ${profiel.diagramTerm}`,
      bevestig: "Aanmaken",
    });
    if (!naam) return;
    const id = `${profiel.menuPrefix}_${Date.now()}`;
    profiel.useStore.getState().addDiagram({ id, naam, diagramType: profiel.descriptor.id });
    openTab(profiel.id, id);
  };

  const stijl = effectieveStijl(profiel);
  return (
    <div className="studio-project__sectie" data-lijst>
      <div className="studio-project__kop">
        <span className="studio-project__stip" style={{ background: stijl.kleur || "var(--s-fg-muted)" }} />
        <span className="studio-project__icoon"><ProfielIcoon profiel={profiel} /></span>
        <span className="studio-project__naam">{profiel.label}</span>
        {!profiel.vasteDocumenten && (
          <button type="button" className="studio-project__nieuw" onClick={nieuw} title={`Nieuw ${profiel.diagramTerm}`}>
            ＋
          </button>
        )}
      </div>
      {entries.length === 0 && <div className="studio-project__leeg">geen {profiel.diagramTerm}men</div>}
      {entries.map((d) => (
        <DiagramRegel key={d.id} profiel={profiel} diagram={d} />
      ))}
    </div>
  );
}

// Scrollpositie van de projectboom, buiten React: de boom is je navigatie
// en moet blijven staan — ook als de sidebar hermonteert (profielwissel van
// de actieve tab) of de elementen-sectie eronder verschijnt.
let _projectScroll = 0;

function Sidebar() {
  useSyncExternalStore(abonneerOpProfieltypen, profieltypenVersie);
  const profielen = getProfieltypen();
  const scrollRef = React.useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = _projectScroll;
    const onScroll = () => {
      _projectScroll = el.scrollTop;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  const mappen = useModellerenStore((s) => s.mappen);
  const nieuweMap = useModellerenStore((s) => s.nieuweMap);
  const plaatsDiagram = useModellerenStore((s) => s.plaatsDiagram);
  const actieveTab = useModellerenStore((s) => s.actieveTab);
  const tabs = useModellerenStore((s) => s.tabs);
  const verplaatsMap = useModellerenStore((s) => s.verplaatsMap);
  const rootMappen = Object.values(mappen).filter((m) => !m.ouderId).sort(opVolgorde);
  // Droppen op "Niet ingedeeld" haalt diagrammen uit hun map. Elementen
  // niet: die hebben geen "niet ingedeeld"-plek (verwijderen kan wél, via
  // het contextmenu — met bevestiging).
  const drop = useDrop({
    [PLAATSING_MIME]: (data) =>
      data.split("\n").forEach((key) => {
        if (!isElementKey(key)) plaatsDiagram(key, null);
      }),
  });
  // Droppen op de "Mappen"-kop hangt een map terug aan de wortel.
  const dropWortel = useDrop({ [MAP_MIME]: (id) => verplaatsMap(id, null) });

  // Auto-scroll tijdens slepen: met "iets in de hand" tegen de boven- of
  // onderrand duwen scrollt de boom mee (anders zijn hoger gelegen mappen
  // onbereikbaar als sleepdoel).
  const dragScroll = (e) => {
    const el = scrollRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (e.clientY < r.top + 40) el.scrollTop -= 14;
    else if (e.clientY > r.bottom - 40) el.scrollTop += 14;
  };

  // "Zoek in projectboom" (rechtsklik op een canvas-element): klap de
  // map-keten open en laat de regel even oplichten.
  useEffect(
    () =>
      menuBus.on("studio:zoek-in-boom", ({ profielId, elementId } = {}) => {
        const p = getProfieltype(profielId);
        if (!p || !elementId) return;
        const { ouderVan } = bepaalHierarchie(p, p.useStore.getState().elements);
        const sleutel = elementKey(profielId, topVoorouder(ouderVan, elementId));
        const s = useModellerenStore.getState();
        const mapId = s.plaatsing[sleutel];
        if (!mapId) return; // element woont (nog) niet in een map
        const mapOpen = { ...s.mapOpen };
        let cursor = mapId;
        while (cursor) {
          mapOpen[cursor] = true;
          cursor = s.mappen[cursor]?.ouderId || null;
        }
        useModellerenStore.setState({ mapOpen });
        s.flits(sleutel);
      }),
    []
  );

  // Elementen-boom van het profiel van de actieve tab (vereist diens
  // Provider — die wrapt alle slots, dus ook deze sidebar).
  const tab = tabs.find((t) => t.id === actieveTab) || null;
  const profiel = tab ? getProfieltype(tab.profielId) : null;
  const Browser = profiel?.ElementenBrowser;
  // Hoogte van de elementenlijst onder de boom: versleepbaar (splitter) en
  // per browser bewaard — de vaste 45% liet de boom te krap (2026-10-07).
  const [elementenHoogte, setElementenHoogte] = React.useState(leesElementenHoogte);
  const startSplitter = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = elementenHoogte;
    const ouder = e.currentTarget.parentElement;
    const maxH = Math.max(120, (ouder?.clientHeight || 600) - 120);
    const beweeg = (m) => setElementenHoogte(Math.max(80, Math.min(maxH, startH - (m.clientY - startY))));
    const klaar = () => {
      window.removeEventListener("pointermove", beweeg);
      window.removeEventListener("pointerup", klaar);
      setElementenHoogte((h) => {
        bewaarElementenHoogte(h);
        return h;
      });
    };
    window.addEventListener("pointermove", beweeg);
    window.addEventListener("pointerup", klaar);
  };

  const maakMap = () => {
    const ms = useModellerenStore.getState();
    const id = ms.nieuweMap("Nieuwe map");
    ms.vraagHernoem("map:" + id);
  };

  // Ctrl+Z / Ctrl+Y met de focus in de boom = structuur-undo/redo.
  // stopPropagation zodat de model-undo van het actieve profiel (globale
  // keydown-listener) niet óók afgaat.
  const structuurUndo = useModellerenStore((s) => s.structuurUndo);
  const structuurRedo = useModellerenStore((s) => s.structuurRedo);
  const onKey = (e) => {
    const doel = e.target;
    if (doel && (doel.tagName === "INPUT" || doel.tagName === "TEXTAREA" || doel.isContentEditable)) return;
    // F2 = hernoem de geselecteerde map, het geselecteerde diagram of het
    // geselecteerde element (de regel zelf toont het invoerveld, zie useHernoemDoel).
    if (e.key === "F2") {
      const s = useModellerenStore.getState();
      const sleutel = s.mapSelectie
        ? "map:" + s.mapSelectie
        : s.diagramSelectie
          ? "diag:" + tabId(s.diagramSelectie.profielId, s.diagramSelectie.diagramId)
          : s.elementSelectie
            ? "el:" + elementKey(s.elementSelectie.profielId, s.elementSelectie.elementId)
            : null;
      if (!sleutel) return;
      e.preventDefault();
      e.stopPropagation();
      s.vraagHernoem(sleutel);
      return;
    }
    // Pijltjes zonder modifier: door de zichtbare regels lopen (↑/↓), een
    // map sluiten of naar de ouder (←), een map openen of naar het eerste
    // kind (→) — zoals een verkenner. De zichtbare volgorde is de DOM-
    // volgorde van de regels met data-boomsleutel (dichte mappen renderen
    // hun inhoud niet). Enter opent een diagram.
    if (!e.ctrlKey && !e.metaKey && !e.altKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key)) {
      const s = useModellerenStore.getState();
      const huidig = s.mapSelectie
        ? "map:" + s.mapSelectie
        : s.diagramSelectie
          ? "diag:" + tabId(s.diagramSelectie.profielId, s.diagramSelectie.diagramId)
          : s.elementSelectie
            ? "el:" + elementKey(s.elementSelectie.profielId, s.elementSelectie.elementId)
            : null;
      const regels = [...e.currentTarget.querySelectorAll("[data-boomsleutel]")];
      if (!regels.length) return;
      const idx = regels.findIndex((r) => r.dataset.boomsleutel === huidig);
      const selecteer = (regel) => {
        const sl = regel?.dataset.boomsleutel;
        if (!sl) return;
        if (sl.startsWith("map:")) s.selecteerMap(sl.slice(4));
        else if (sl.startsWith("diag:")) {
          const [pid, did] = sl.slice(5).split("::");
          s.selecteerDiagram(pid, did);
        } else if (sl.startsWith("el:")) {
          const [, pid, eid] = sl.slice(3).split("::");
          s.selecteerElement(pid, eid);
        }
        regel.scrollIntoView({ block: "nearest" });
      };
      const mapOpenVan = (id) => s.mapOpen[id] ?? true;
      let doel = null;
      if (e.key === "ArrowDown") doel = regels[idx < 0 ? 0 : Math.min(idx + 1, regels.length - 1)];
      else if (e.key === "ArrowUp") doel = regels[idx < 0 ? 0 : Math.max(idx - 1, 0)];
      else if (e.key === "ArrowRight") {
        if (idx < 0) doel = regels[0];
        else if (huidig.startsWith("map:") && !mapOpenVan(huidig.slice(4))) s.toggleMap(huidig.slice(4));
        else doel = regels[Math.min(idx + 1, regels.length - 1)];
      } else if (e.key === "ArrowLeft") {
        if (idx < 0) return;
        const regel = regels[idx];
        if (huidig.startsWith("map:") && mapOpenVan(huidig.slice(4))) s.toggleMap(huidig.slice(4));
        else {
          // Naar de ouder-map: de dichtstbijzijnde map-regel vóór deze regel
          // die deze regel omsluit (.studio-project__map bevat zijn inhoud).
          const ouderMap = regel.closest(".studio-project__map")?.parentElement?.closest(".studio-project__map");
          const eigenMap = regel.classList.contains("studio-project__mapkop") ? ouderMap : regel.closest(".studio-project__map");
          doel = eigenMap?.querySelector(":scope > .studio-project__mapkop[data-boomsleutel]") || null;
        }
      } else if (e.key === "Enter") {
        if (huidig?.startsWith("diag:")) {
          const [pid, did] = huidig.slice(5).split("::");
          s.openTab(pid, did);
        } else if (huidig?.startsWith("map:")) s.toggleMap(huidig.slice(4));
        else return;
      }
      if (doel) selecteer(doel);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Ctrl+↑/↓ = de geselecteerde regel (map, diagram, element) een plek
    // omhoog/omlaag tussen zijn broers (ook via het contextmenu).
    if ((e.ctrlKey || e.metaKey) && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      const s = useModellerenStore.getState();
      const richting = e.key === "ArrowUp" ? "omhoog" : "omlaag";
      if (s.mapSelectie) s.schuifMap(s.mapSelectie, richting);
      else if (s.diagramSelectie) s.schuifPlaatsing(tabId(s.diagramSelectie.profielId, s.diagramSelectie.diagramId), richting);
      else if (s.elementSelectie) s.schuifPlaatsing(elementKey(s.elementSelectie.profielId, s.elementSelectie.elementId), richting);
      else return;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      structuurUndo();
    } else if (k === "y" || (k === "z" && e.shiftKey)) {
      e.preventDefault();
      e.stopPropagation();
      structuurRedo();
    }
  };

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, outline: "none" }}
      onKeyDown={onKey}
      // Elke muisklik in de boom legt de toetsenbord-focus óp de boom, zodat
      // Ctrl+Z/Ctrl+Y daar landen (een klik op een span/mapnaam focust
      // anders niets en de toetsen vielen op <body>). Invoervelden houden
      // hun eigen focus.
      tabIndex={-1}
      onMouseDown={(e) => {
        if (e.target.closest && e.target.closest("input, textarea")) return;
        e.currentTarget.focus({ preventScroll: true });
      }}
    >
      <div
        ref={scrollRef}
        className="studio-project"
        style={{ flex: 1, overflow: "auto", minHeight: 0 }}
        onDragOver={dragScroll}
      >
        <div
          className={"studio-project__kop" + (dropWortel.over ? " is-dropdoel" : "")}
          {...dropWortel.props}
        >
          <span className="studio-project__naam">Mappen</span>
          <button type="button" className="studio-project__nieuw" title="Nieuwe map" onClick={maakMap}>
            ＋
          </button>
        </div>
        <button type="button" className="studio-project__grote-knop" onClick={maakMap}>
          ＋ Nieuwe map
        </button>
        {rootMappen.map((m) => (
          <Map_ key={m.id} map={m} diepte={0} />
        ))}

        <div
          className={"studio-project__kop studio-project__kop--los" + (drop.over ? " is-dropdoel" : "")}
          {...drop.props}
        >
          <span className="studio-project__naam">Niet ingedeeld</span>
        </div>
        {profielen.map((p) => (
          <ProfielSectie key={p.id} profiel={p} />
        ))}
      </div>

      {Browser && (
        <div className="studio-project__splitter" title="Sleep om de verdeling boom/elementen te wijzigen" onPointerDown={startSplitter} />
      )}
      {Browser && (
        <div className="studio-project__elementen" style={{ flex: `0 0 ${elementenHoogte}px` }}>
          <div className="studio-project__elementen-kop">
            <span
              className="studio-project__stip"
              style={{ background: effectieveStijl(profiel).kleur || "var(--s-fg-muted)" }}
            />
            <ProfielIcoon profiel={profiel} />
            <span className="studio-project__naam">{profiel.label}</span>
          </div>
          <ElementenBrowserMetFilter profiel={profiel} Browser={Browser} />
        </div>
      )}
      <BoomContextMenu />
    </div>
  );
}

/**
 * Rendert de elementen-browser van het actieve profiel, maar verbergt de
 * elementen (+ hun hiërarchie-nazaten) die al in een map van de projectboom
 * geplaatst zijn: de boom is de eigendom-plek, de browser toont de rest.
 * Eigen component (met stabiele hooks per profiel) zodat de filter meebeweegt
 * met zowel de plaatsing als het model.
 */
function ElementenBrowserMetFilter({ profiel, Browser }) {
  const elements = profiel.useStore((s) => s.elements);
  const plaatsing = useModellerenStore((s) => s.plaatsing);
  const verbergIds = React.useMemo(() => {
    const set = new Set();
    const { kinderenVan } = bepaalHierarchie(profiel, elements);
    const voegMetNazaten = (id) => {
      if (set.has(id)) return;
      set.add(id);
      for (const kind of kinderenVan.get(id) || []) voegMetNazaten(kind);
    };
    const prefix = `el::${profiel.id}::`;
    for (const key of Object.keys(plaatsing)) {
      if (key.startsWith(prefix)) voegMetNazaten(key.slice(prefix.length));
    }
    return set;
  }, [profiel, elements, plaatsing]);
  // "Verplaats naar map ▸" in de browser (per regel, per multiselectie en
  // per typegroep "alle N …") — de boom is de eigenaar van de mappen.
  const naarMapItems = React.useMemo(() => naarMapItemsVoor(profiel), [profiel]);
  return <Browser verbergIds={verbergIds} naarMapItems={naarMapItems} />;
}

function BoomContextMenu() {
  const menu = useCtxMenu((s) => s.menu);
  return <ContextMenu menu={menu} sluit={() => useCtxMenu.setState({ menu: null })} />;
}

/** Eigenschappen-paneel van een geselecteerde map (naam + kleur). */
function MapEigenschappen({ mapId }) {
  const map = useModellerenStore((s) => s.mappen[mapId]);
  const hernoemMap = useModellerenStore((s) => s.hernoemMap);
  const zetMapKleur = useModellerenStore((s) => s.zetMapKleur);
  const zetMapOmschrijving = useModellerenStore((s) => s.zetMapOmschrijving);
  const selecteerMap = useModellerenStore((s) => s.selecteerMap);
  if (!map) return null;
  const rij = { display: "flex", flexDirection: "row", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13 };
  return (
    <div style={{ padding: 12, color: "var(--s-fg)" }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{map.naam}</div>
      <div style={{ fontSize: 11, color: "var(--s-fg-muted)", marginBottom: 10 }}>Map (projectstructuur)</div>
      <label style={rij}>
        <span style={{ width: 44, color: "var(--s-fg-muted)" }}>naam</span>
        <input
          key={map.id + map.naam}
          type="text"
          defaultValue={map.naam}
          onBlur={(e) => {
            const naam = e.target.value.trim();
            if (naam && naam !== map.naam) hernoemMap(map.id, naam);
          }}
          onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
          style={{ flex: 1, font: "inherit", fontSize: 13, padding: "3px 6px", border: "1px solid var(--s-border)", borderRadius: 5, background: "transparent", color: "var(--s-fg)" }}
        />
      </label>
      <label style={rij}>
        <span style={{ width: 44, color: "var(--s-fg-muted)" }}>kleur</span>
        <input
          type="color"
          value={map.kleur || "#94a3b8"}
          onChange={(e) => zetMapKleur(map.id, e.target.value)}
          style={{ width: 34, height: 24, padding: 0, border: "1px solid var(--s-border)", borderRadius: 5, background: "transparent", cursor: "pointer" }}
        />
        {map.kleur && (
          <button
            type="button"
            onClick={() => zetMapKleur(map.id, null)}
            style={{ font: "inherit", fontSize: 12, padding: "2px 8px", border: "1px solid var(--s-border)", borderRadius: 5, background: "transparent", color: "var(--s-fg-muted)", cursor: "pointer" }}
          >
            herstel
          </button>
        )}
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, padding: "6px 0", fontSize: 13 }}>
        <span style={{ color: "var(--s-fg-muted)" }}>omschrijving</span>
        <textarea
          key={map.id}
          defaultValue={map.omschrijving || ""}
          rows={8}
          placeholder="Tekst voor dit hoofdstuk in een gegenereerd document (Markdown)"
          onBlur={(e) => zetMapOmschrijving(map.id, e.target.value.trim())}
          style={{ font: "inherit", fontSize: 13, padding: "4px 6px", border: "1px solid var(--s-border)", borderRadius: 5, background: "transparent", color: "var(--s-fg)", resize: "vertical" }}
        />
      </label>
      <button
        type="button"
        onClick={() => selecteerMap(null)}
        style={{ marginTop: 10, font: "inherit", fontSize: 12, padding: "3px 10px", border: "1px solid var(--s-border)", borderRadius: 5, background: "transparent", color: "var(--s-fg-muted)", cursor: "pointer" }}
      >
        sluit eigenschappen
      </button>
    </div>
  );
}

// ── Main: tab-host ──────────────────────────────────────────────────
function Tab({ tab, actief }) {
  const profiel = getProfieltype(tab.profielId);
  const activeer = useModellerenStore((s) => s.activeer);
  const sluitTab = useModellerenStore((s) => s.sluitTab);
  // Volg de naam live; een elders verwijderd diagram sluit zijn tab.
  const diagram = profiel ? profiel.useStore((s) => s.diagrams[tab.diagramId]) : null;
  useEffect(() => {
    if (!profiel || !diagram) sluitTab(tab.id);
  }, [profiel, diagram, sluitTab, tab.id]);
  if (!profiel || !diagram) return null;

  const stijl = effectieveStijl(profiel);
  return (
    <span
      className={"studio-tab" + (actief ? " is-actief" : "")}
      style={actief ? { borderTopColor: stijl.kleur || "var(--s-accent)" } : undefined}
      title={`${diagram.naam} — ${profiel.label}`}
    >
      <button type="button" className="studio-tab__kies" onClick={() => activeer(tab.id)}>
        <span className="studio-tab__icoon"><ProfielIcoon profiel={profiel} /></span>
        <span className="studio-tab__naam">{diagram.naam}</span>
      </button>
      <button
        type="button"
        className="studio-tab__sluit"
        onClick={() => sluitTab(tab.id)}
        title="Tab sluiten"
        aria-label={`Sluit ${diagram.naam}`}
      >
        ×
      </button>
    </span>
  );
}

function LegeStaat() {
  useSyncExternalStore(abonneerOpProfieltypen, profieltypenVersie);
  const openTab = useModellerenStore((s) => s.openTab);
  const profielen = getProfieltypen();
  return (
    <div className="studio-modelleren__leeg">
      <p>
        Geen open diagrammen. Kies links een diagram in de projectbrowser, of begin
        met een nieuw diagram in een van de profielen:
      </p>
      <div className="studio-modelleren__leeg-knoppen">
        {profielen.filter((p) => !p.vasteDocumenten).map((p) => (
          <button
            key={p.id}
            type="button"
            className="studio-modelleren__leeg-knop"
            onClick={async () => {
              const naam = await vraagNaam({
                titel: `Nieuw ${p.diagramTerm}`,
                waarde: `Nieuw ${p.diagramTerm}`,
                bevestig: "Aanmaken",
              });
              if (!naam) return;
              const id = `${p.menuPrefix}_${Date.now()}`;
              p.useStore.getState().addDiagram({ id, naam, diagramType: p.descriptor.id });
              openTab(p.id, id);
            }}
          >
            <span className="studio-project__stip" style={{ background: effectieveStijl(p).kleur || "var(--s-fg-muted)" }} />
            <ProfielIcoon profiel={p} /> {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Main() {
  // Hertekent ook bij stijl-overrides (kleur/embleem) uit de instellingen.
  useSyncExternalStore(abonneerOpProfieltypen, profieltypenVersie);
  const tabs = useModellerenStore((s) => s.tabs);
  const actieveTab = useModellerenStore((s) => s.actieveTab);
  const tab = tabs.find((t) => t.id === actieveTab) || null;
  const profiel = tab ? getProfieltype(tab.profielId) : null;
  const ProfielMain = profiel?.Main;

  return (
    <div className="studio-modelleren">
      {tabs.length > 0 && (
        <div className="studio-tabbalk" role="tablist">
          {tabs.map((t) => (
            <Tab key={t.id} tab={t} actief={t.id === actieveTab} />
          ))}
        </div>
      )}
      <div className="studio-modelleren__inhoud">
        {ProfielMain ? <ProfielMain /> : <LegeStaat />}
      </div>
      <TransformatiePaneel />
      <ProjectServerDialoog />
    </div>
  );
}

/**
 * Eigenschappen-paneel van een diagram (naam bewerkbaar; type readonly —
 * net als mappen zijn diagrammen "superprofiel"-achtige elementen met
 * eigen properties; er kan hier altijd meer bij).
 */
function DiagramEigenschappen({ profielId, diagramId }) {
  const profiel = getProfieltype(profielId);
  const diagram = profiel ? profiel.useStore((s) => s.diagrams[diagramId]) : null;
  const selecteerDiagram = useModellerenStore((s) => s.selecteerDiagram);
  if (!profiel || !diagram) return null;
  const rij = { display: "flex", flexDirection: "row", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13 };
  const readonly = { flex: 1, color: "var(--s-fg)", display: "inline-flex", alignItems: "center", gap: 6 };
  return (
    <div style={{ padding: 12, color: "var(--s-fg)" }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{diagram.naam}</div>
      <div style={{ fontSize: 11, color: "var(--s-fg-muted)", marginBottom: 10 }}>
        {profiel.diagramTerm === "diagram" ? "Diagram" : `${profiel.diagramTerm} (diagram)`}
      </div>
      <label style={rij}>
        <span style={{ width: 60, color: "var(--s-fg-muted)" }}>naam</span>
        <input
          key={diagram.id + diagram.naam}
          type="text"
          defaultValue={diagram.naam}
          onBlur={(e) => {
            const naam = e.target.value.trim();
            if (naam && naam !== diagram.naam) profiel.useStore.getState().renameDiagram(diagram.id, naam);
          }}
          onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
          style={{ flex: 1, font: "inherit", fontSize: 13, padding: "3px 6px", border: "1px solid var(--s-border)", borderRadius: 5, background: "transparent", color: "var(--s-fg)" }}
        />
      </label>
      <div style={rij}>
        <span style={{ width: 60, color: "var(--s-fg-muted)" }}>type</span>
        <span style={readonly}>
          <ProfielIcoon profiel={profiel} /> {profiel.label}
          <code style={{ fontSize: 11, color: "var(--s-fg-muted)" }}>({diagram.diagramType || profiel.descriptor.id})</code>
        </span>
      </div>
      {!profiel.klassiek && (
        <div style={rij}>
          <span style={{ width: 60, color: "var(--s-fg-muted)" }}>inhoud</span>
          <span style={readonly}>{(diagram.nodes || []).length} element(en) op dit diagram</span>
        </div>
      )}
      <button
        type="button"
        onClick={() => selecteerDiagram(null)}
        style={{ marginTop: 10, font: "inherit", fontSize: 12, padding: "3px 10px", border: "1px solid var(--s-border)", borderRadius: 5, background: "transparent", color: "var(--s-fg-muted)", cursor: "pointer" }}
      >
        sluit eigenschappen
      </button>
    </div>
  );
}

// ── Inspector + Provider: volgen het profiel van de actieve tab ────
function Inspector() {
  const actieveTab = useModellerenStore((s) => s.actieveTab);
  const tabs = useModellerenStore((s) => s.tabs);
  const mapSelectie = useModellerenStore((s) => s.mapSelectie);
  const diagramSelectie = useModellerenStore((s) => s.diagramSelectie);
  // Een geselecteerde map of diagram wint: structuur-elementen met eigen
  // eigenschappen (naam, kleur, type) — consolidatieplan, "superprofiel"-spoor.
  if (mapSelectie) return <MapEigenschappen mapId={mapSelectie} />;
  if (diagramSelectie) {
    return <DiagramEigenschappen profielId={diagramSelectie.profielId} diagramId={diagramSelectie.diagramId} />;
  }
  const tab = tabs.find((t) => t.id === actieveTab) || null;
  const profiel = tab ? getProfieltype(tab.profielId) : null;
  const ProfielInspector = profiel?.Inspector;
  if (!ProfielInspector) {
    return <div className="studio-project__leeg" style={{ padding: 12 }}>Geen open diagram.</div>;
  }
  return <ProfielInspector />;
}

/**
 * Wrapt de slots in de Provider van het actieve profiel (context + menuBus-
 * abonnementen). key = profiel-id: wisselen van profiel hermonteert de
 * editor netjes.
 */
// Bewaart of wíj de panelen sloten (voor een editor met eigen schil), zodat
// we ze bij het verlaten van die tab weer terugzetten — maar een handmatige
// keuze van de gebruiker niet overschrijven.
let _panelenGeslotenDoorSchil = null;

function Provider({ children }) {
  const actieveTab = useModellerenStore((s) => s.actieveTab);
  const tabs = useModellerenStore((s) => s.tabs);
  const tab = tabs.find((t) => t.id === actieveTab) || null;
  const profiel = tab ? getProfieltype(tab.profielId) : null;
  const P = profiel?.Provider || Fragment;
  // Editor met eigen schil (bv. de Canoniek model IDE, FlexLayout): klap de
  // host-zijpanelen automatisch in; terug bij een gewone tab.
  const eigenSchil = !!profiel?.eigenSchil;
  useEffect(() => {
    const st = useStudioStore.getState();
    const stand = st.paneelStand["modelleren"] || {};
    if (eigenSchil) {
      const open = { sidebar: stand.sidebar ?? true, inspector: stand.inspector ?? true };
      if (open.sidebar || open.inspector) {
        _panelenGeslotenDoorSchil = open;
        st.zetPaneelStand("modelleren", { sidebar: false, inspector: false });
      }
    } else if (_panelenGeslotenDoorSchil) {
      st.zetPaneelStand("modelleren", _panelenGeslotenDoorSchil);
      _panelenGeslotenDoorSchil = null;
    }
  }, [eigenSchil]);
  // Element geselecteerd (canvas of boom) → map-/diagram-eigenschappen
  // loslaten, anders blijven die de inspector bezet houden en lijkt elke
  // element-klik dood.
  useEffect(
    () =>
      menuBus.on("studio:element-geselecteerd", () => {
        const s = useModellerenStore.getState();
        if (s.mapSelectie || s.diagramSelectie) {
          useModellerenStore.setState({ mapSelectie: null, diagramSelectie: null });
        }
      }),
    []
  );
  return <P key={profiel?.id || "leeg"}>{children}</P>;
}

// ── Project-werkbestand: de hele boom + alle profiel-sandboxes als JSON ──
// Eerste trede van "projectstructuur voorbij localStorage" (fase 3.3):
// deelbaar, back-upbaar — en sinds plan 2026-10-07 (Projectsync, stap 1) ook
// de blob die als geheel naar /api/studio/projecten gaat en terugkomt.
// Formaat "studio-project" v2 = v1 + `project: {id, naam}`.

/** Bouw het werkbestand (v2) uit de stores. Gedeeld door export en server-sync. */
function bouwProjectData() {
  const s = useModellerenStore.getState();
  const profielen = {};
  for (const p of getProfieltypen()) {
    // Klassieke editors (shim) hebben hun inhoud in eigen stores/opslag —
    // niets te exporteren hier (BPMN/DMN-documentinhoud volgt later).
    if (p.klassiek) continue;
    const st = p.useStore.getState();
    if (!Object.keys(st.elements).length && !Object.keys(st.diagrams).length) continue;
    profielen[p.id] = {
      diagramTypeId: st.diagramTypeId,
      elements: st.elements,
      // Viewports terug in de diagram-entries: laadModel splitst ze weer af.
      diagrams: Object.fromEntries(
        Object.entries(st.diagrams).map(([id, d]) => [
          id,
          st.viewports?.[id] ? { ...d, viewport: st.viewports[id] } : d,
        ])
      ),
      actiefDiagramId: st.actiefDiagramId,
      meta: st.meta,
    };
  }
  return {
    formaat: PROJECT_FORMAAT,
    versie: PROJECT_FORMAAT_VERSIE,
    geexporteerd: new Date().toISOString(),
    project: { id: s.project.id, naam: s.project.naam },
    structuur: { mappen: s.mappen, plaatsing: s.plaatsing },
    tabs: s.tabs,
    actieveTab: s.actieveTab,
    kruisverbanden: useKruisStore.getState().links,
    profielen,
  };
}

function exporteerProject() {
  const data = bouwProjectData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${bestandsstamVoor(data.project.naam)}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Zet een genormaliseerd werkbestand (v2) in de stores: vervangt de inhoud van
 * de genoemde profielen, de structuur, de kruisverbanden én de projectidentiteit.
 * Gedeeld door JSON-import en "Van server ophalen". Onbekende profielen worden
 * overgeslagen (de aanroeper heeft dat al gemeld).
 */
function pasProjectToe(data, { serverVersie = null } = {}) {
  // Een snapshot laden is geen reeks handelingen: niets in de outbox, en de
  // outbox van het vorige project vervalt (de snapshot is de nieuwe basis).
  zonderVastleggen(() => {
    for (const [pid, inhoud] of Object.entries(data.profielen || {})) {
      const p = getProfieltype(pid);
      if (!p) continue;
      p.useStore.getState().laadModel(inhoud);
      p.useStore.temporal?.getState().clear();
    }
    // Profielen die in de snapshot ontbreken maar hier nog inhoud hebben: leeg.
    for (const p of getProfieltypen()) {
      if (p.klassiek || data.profielen?.[p.id]) continue;
      const st = p.useStore.getState();
      if (Object.keys(st.elements).length || Object.keys(st.diagrams).length) {
        st.clear();
        p.useStore.temporal?.getState().clear();
      }
    }
    // Tabs alleen behouden als hun profiel + diagram na de import bestaan.
    const tabs = (data.tabs || []).filter((t) => {
      const p = getProfieltype(t.profielId);
      return p && !!p.useStore.getState().diagrams[t.diagramId];
    });
    useModellerenStore.getState().laadStructuur({
      mappen: data.structuur?.mappen,
      plaatsing: data.structuur?.plaatsing,
      tabs,
      actieveTab: tabs.some((t) => t.id === data.actieveTab) ? data.actieveTab : tabs[0]?.id || null,
    });
    useKruisStore.getState().laadLinks(Array.isArray(data.kruisverbanden) ? data.kruisverbanden : []);
  });
  useOutboxStore.getState().wis();
  useModellerenStore.getState().zetProject({ id: data.project.id, naam: data.project.naam, serverVersie });
}

/** Alles leeg en een nieuwe projectidentiteit (na "parkeren"). */
function leegProject({ naam = STANDAARD_PROJECTNAAM } = {}) {
  zonderVastleggen(() => {
    for (const p of getProfieltypen()) {
      if (p.klassiek) continue;
      p.useStore.getState().clear();
      p.useStore.temporal?.getState().clear();
    }
    useModellerenStore.getState().laadStructuur({});
    useKruisStore.getState().laadLinks([]);
  });
  useOutboxStore.getState().wis();
  useModellerenStore.getState().zetProject({ id: nieuwProjectId(), naam, serverVersie: null, laatsteSync: null });
}

async function importeerProjectTekst(tekst, bestandsnaam = "") {
  let ruw;
  try {
    ruw = JSON.parse(tekst);
  } catch {
    toonMelding({ tekst: "Dit is geen geldig JSON-bestand." });
    return;
  }
  const uit = normaliseerProjectData(ruw, { bestandsnaam });
  if (!uit.ok) {
    toonMelding({ tekst: uit.fout });
    return;
  }
  const data = uit.data;
  const profielIds = Object.keys(data.profielen || {});
  const onbekend = profielIds.filter((pid) => !getProfieltype(pid));
  const ok = await vraagBevestiging({
    titel: "Project importeren",
    tekst:
      `Project "${data.project.naam}" importeren?\n\nDit vervangt de projectstructuur (mappen, plaatsingen, tabs) én de inhoud van deze profielen:\n` +
      `  ${profielIds.filter((pid) => getProfieltype(pid)).join(", ") || "(geen)"}` +
      (onbekend.length ? `\n\nOnbekend hier (overgeslagen): ${onbekend.join(", ")}` : ""),
    bevestig: "Importeer",
  });
  if (!ok) {
    return;
  }
  pasProjectToe(data);
}

function kiesEnImporteerProject() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "application/json,.json";
  inp.onchange = () => {
    const f = inp.files?.[0];
    if (!f) return;
    f.text()
      .then((tekst) => importeerProjectTekst(tekst, f.name))
      .catch((e) => toonMelding({ tekst: `Lezen mislukt: ${e}` }));
  };
  inp.click();
}

// ── Projectacties in het menu ─────────────────────────────────────────

async function hernoemProject() {
  const { project, zetProject } = useModellerenStore.getState();
  const naam = await vraagNaam({ titel: "Hernoem project", label: "Projectnaam", waarde: project.naam, bevestig: "Hernoem" });
  if (naam && naam.trim() && naam.trim() !== project.naam) zetProject({ naam: naam.trim() });
}

/** "Nieuw project…": het huidige parkeren (optioneel als JSON) en leeg beginnen. */
async function nieuwProject() {
  const { project } = useModellerenStore.getState();
  const heeftInhoud = getProfieltypen().some((p) => {
    if (p.klassiek) return false;
    const st = p.useStore.getState();
    return Object.keys(st.elements).length || Object.keys(st.diagrams).length;
  });
  if (heeftInhoud) {
    const bewaar = await vraagBevestiging({
      titel: "Eerst bewaren?",
      tekst:
        `Het huidige project "${project.naam}" eerst als JSON-bestand bewaren?\n\n` +
        "Exporteren = bestand bewaren en daarna leeg beginnen.\nNiet exporteren = het project is dan alleen nog op de server als je het daarheen hebt gestuurd.",
      bevestig: "Exporteren",
      annuleer: "Niet exporteren",
    });
    if (bewaar) exporteerProject();
    const leeg = await vraagBevestiging({
      titel: "Leeg beginnen",
      tekst: `Leeg beginnen? Alle lokale inhoud van "${project.naam}" wordt uit deze browser verwijderd.`,
      bevestig: "Leeg beginnen",
      gevaar: true,
    });
    if (!leeg) return;
  }
  const naam = await vraagNaam({ titel: "Nieuw project", label: "Projectnaam", waarde: STANDAARD_PROJECTNAAM, bevestig: "Maak" });
  if (naam === null) return;
  leegProject({ naam: naam.trim() || STANDAARD_PROJECTNAAM });
}

/**
 * "Naar server sturen": POST als dit project de server nog nooit zag, anders
 * PUT met de bekende versie. Bij een conflict (iemand anders heeft intussen
 * opgeslagen) kiest de gebruiker: overschrijven of afbreken.
 */
async function stuurNaarServer() {
  const { project, zetProject } = useModellerenStore.getState();
  const inhoud = bouwProjectData();
  const basis = { naam: project.naam, inhoud };
  const bevestigOverschrijven = (server) =>
    vraagBevestiging({
      titel: "Overschrijven op de server?",
      tekst:
        `Op de server staat al versie ${server.versie} van "${server.naam}"` +
        (server.bijgewerkt_door ? ` (laatst opgeslagen door ${server.bijgewerkt_door})` : "") +
        `, nieuwer dan wat deze browser kent.\n\nOverschrijven met jouw versie?\n(Annuleren = niets doen; haal eerst op als je hun werk wilt zien.)`,
      bevestig: "Overschrijf",
      gevaar: true,
    });
  try {
    let meta;
    if (project.serverVersie == null) {
      try {
        meta = await maakProjectAan({ id: project.id, ...basis });
      } catch (e) {
        if (e.status !== 409) throw e;
        // Zelfde id al op de server (bv. een collega stuurde dezelfde JSON-import op).
        const bestaand = await haalProjectOp(project.id);
        if (!(await bevestigOverschrijven(bestaand))) return;
        meta = await slaProjectOp(project.id, { ...basis, versie: bestaand.versie });
      }
    } else {
      try {
        meta = await slaProjectOp(project.id, { ...basis, versie: project.serverVersie });
      } catch (e) {
        if (e.status === 409 && e.server) {
          if (!(await bevestigOverschrijven(e.server))) return;
          meta = await slaProjectOp(project.id, { ...basis, versie: e.server.versie });
        } else if (e.status === 404) {
          // Op de server verwijderd: opnieuw aanmaken.
          meta = await maakProjectAan({ id: project.id, ...basis });
        } else {
          throw e;
        }
      }
    }
    zetProject({ serverVersie: meta.versie, laatsteSync: new Date().toISOString() });
  } catch (e) {
    toonMelding({ tekst: `Naar server sturen mislukt: ${e?.message || e}` });
  }
}

/** "Van server ophalen…": kies uit de lijst; vervangt het huidige project. */
function haalVanServer() {
  const { project } = useModellerenStore.getState();
  useProjectServerStore.getState().openen({
    huidigId: project.id,
    onKies: async (meta) => {
      const zelfde = meta.id === project.id;
      const ok = await vraagBevestiging({
        titel: "Van de server ophalen",
        tekst: zelfde
          ? `"${meta.naam}" (versie ${meta.versie}) van de server ophalen?\n\nJe lokale wijzigingen sinds de laatste sync worden overschreven.`
          : `"${meta.naam}" ophalen?\n\nDit vervangt je huidige project "${project.naam}" in deze browser. Annuleer en parkeer het eerst (Nieuw project… / Exporteer project…) als je het wilt bewaren.`,
        bevestig: "Ophalen",
      });
      if (!ok) {
        return;
      }
      try {
        const rec = await haalProjectOp(meta.id);
        const uit = normaliseerProjectData(rec.inhoud);
        if (!uit.ok) {
          toonMelding({ tekst: `Serverproject onbruikbaar: ${uit.fout}` });
          return;
        }
        // Naam en id van de server zijn leidend (hernoemd op de server telt).
        const data = { ...uit.data, project: { id: rec.id, naam: rec.naam } };
        const onbekend = Object.keys(data.profielen || {}).filter((pid) => !getProfieltype(pid));
        if (onbekend.length) toonMelding({ tekst: `Profielen onbekend in deze Studio (overgeslagen): ${onbekend.join(", ")}` });
        pasProjectToe(data, { serverVersie: rec.versie });
        useModellerenStore.getState().zetProject({ laatsteSync: new Date().toISOString() });
      } catch (e) {
        toonMelding({ tekst: `Ophalen mislukt: ${e?.message || e}` });
      }
    },
  });
}

/** Menubalk = eigen Project-menu + de menu's van het profiel van de actieve tab. */
function menus(ctx) {
  const { project } = useModellerenStore.getState();
  const syncStand =
    project.serverVersie == null
      ? "alleen lokaal"
      : `server v${project.serverVersie}` +
        (project.laatsteSync ? ` · ${new Date(project.laatsteSync).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}` : "");
  const projectMenu = {
    id: "project",
    label: "Project",
    items: [
      { type: "kop", label: `${project.naam} — ${syncStand}` },
      { id: "proj-hernoem", label: "Hernoem project…", onClick: hernoemProject },
      { id: "proj-nieuw", label: "Nieuw project… (huidige parkeren)", onClick: nieuwProject },
      { type: "separator" },
      { id: "proj-push", label: "Naar server sturen", onClick: stuurNaarServer },
      { id: "proj-pull", label: "Van server ophalen…", onClick: haalVanServer },
      { type: "separator" },
      { id: "proj-export", label: "Exporteer project (structuur + modellen)…", onClick: exporteerProject },
      { id: "proj-import", label: "Importeer project…", onClick: kiesEnImporteerProject },
      { type: "separator" },
      { id: "proj-transform", label: "Transformeren…", onClick: () => useTransformStore.getState().openen(null) },
    ],
  };
  const { profiel } = actieveTabInfo();
  const ruw = profiel
    ? typeof profiel.menus === "function"
      ? profiel.menus(ctx)
      : profiel.menus
    : [];
  return [projectMenu, ...(Array.isArray(ruw) ? ruw : [])];
}

export default {
  id: "modelleren",
  label: "Modelleren",
  icon: <IconModelleren />,
  groep: "modelleren",
  status: "preview",
  Provider,
  Sidebar,
  Main,
  Inspector,
  sidebarLabel: "Project",
  inspectorLabel: "Eigenschappen",
  menus,
};
