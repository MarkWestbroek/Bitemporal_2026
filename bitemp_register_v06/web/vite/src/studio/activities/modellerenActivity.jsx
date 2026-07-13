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
import useStudioStore from "../useStudioStore";
import { useKruisStore } from "./koppelingenActivity.jsx";
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
      })
    );
  } catch { /* ignore */ }
}

const tabId = (profielId, diagramId) => `${profielId}::${diagramId}`;

const opgeslagen = leesOpslag();

// ── Undo/redo voor de projectstructuur (mappen + plaatsingen) ───────
// Eigen stapel, los van de model-undo per profiel: Ctrl+Z met de focus in
// de boom draait boom-acties terug (map verslept, plaatsing, hernoemen, …),
// Ctrl+Z op de canvas blijft de model-undo van het profiel.
const _structuurVerleden = [];
const _structuurToekomst = [];
const structuurFoto = (s) => ({ mappen: s.mappen, plaatsing: s.plaatsing });
/** Vastleggen vóór een structuur-wijziging (wist de redo-stapel). */
const legStructuurVast = (s) => {
  _structuurVerleden.push(structuurFoto(s));
  if (_structuurVerleden.length > 60) _structuurVerleden.shift();
  _structuurToekomst.length = 0;
};

export const useModellerenStore = create((set, get) => ({
  /** @type {{id:string, profielId:string, diagramId:string}[]} */
  tabs: opgeslagen.tabs || [],
  /** id van de actieve tab, of null */
  actieveTab: opgeslagen.actieveTab || null,

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
      return { tabs, actieveTab: id, mapSelectie: null, diagramSelectie: null };
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

  nieuweMap: (naam, ouderId = null) => {
    const id = `map_${Date.now()}`;
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
  selecteerMap: (id) => set({ mapSelectie: id, diagramSelectie: null }),

  /** Geselecteerd diagram (eigenschappen-paneel): {profielId, diagramId}|null. */
  diagramSelectie: null,
  selecteerDiagram: (profielId, diagramId) =>
    set({ diagramSelectie: profielId ? { profielId, diagramId } : null, mapSelectie: null }),

  /** Ctrl-klik multiselect in de boom: set van plaatsing-sleutels. */
  multiSelectie: [],
  toggleMulti: (key) =>
    set((s) => ({
      multiSelectie: s.multiSelectie.includes(key)
        ? s.multiSelectie.filter((k) => k !== key)
        : [...s.multiSelectie, key],
    })),
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
  plaatsDiagram: (key, mapId) =>
    set((s) => {
      if ((s.plaatsing[key] || null) === (mapId || null)) return {};
      legStructuurVast(s);
      const plaatsing = { ...s.plaatsing };
      if (mapId) plaatsing[key] = mapId;
      else delete plaatsing[key];
      const next = { ...s, plaatsing };
      schrijfOpslag(next);
      return { plaatsing };
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
  const ctx = (e) =>
    openCtxMenu(e, [
      { label: "Openen", onClick: () => openTab(profiel.id, diagram.id) },
      { label: "Eigenschappen", onClick: () => selecteerDiagram(profiel.id, diagram.id) },
      {
        label: "Verplaats naar",
        items: verplaatsNaarItems(verplaats, {
          bovenaan: inMap ? { label: "(Niet ingedeeld)" } : null,
        }),
      },
      ...(inMap ? [{ sep: true }, { label: "Uit de map halen", onClick: () => verplaats(null) }] : []),
      // Klassieke editors met documentenbeheer (BPMN/DMN): document weggooien.
      ...(profiel.documentenBeheer
        ? [
            { sep: true },
            {
              label: "Verwijderen…",
              onClick: () => {
                if (window.confirm(`"${diagram.naam}" verwijderen? De inhoud van dit document gaat verloren.`)) {
                  profiel.useStore.getState().verwijderDiagram(diagram.id);
                  plaatsDiagram(id, null);
                }
              },
            },
          ]
        : []),
    ]);
  return (
    <button
      type="button"
      className={
        "studio-project__diagram" +
        (id === actieveTab ? " is-actief" : "") +
        (isSelectie ? " is-selectie" : "") +
        (inMulti ? " is-multi" : "")
      }
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) toggleMulti(id);
        else {
          wisMulti();
          selecteerDiagram(profiel.id, diagram.id);
        }
      }}
      onDoubleClick={() => openTab(profiel.id, diagram.id)}
      onContextMenu={ctx}
      title={`${diagram.naam} — ${profiel.label} (klik = eigenschappen, dubbelklik = openen, Ctrl+klik = meervoudig)`}
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
      onClick: () => {
        const naam = window.prompt(
          `Naam van het nieuwe ${p.diagramTerm} (${p.label}):`,
          `Nieuw ${p.diagramTerm}`
        );
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
      profiel.useStore.getState().updateElement(elementId, { naam: schoon });
    }
  };

  /**
   * "Uit de map halen" bestaat bewust niet voor elementen (waar zou hij
   * heen moeten?); wel verwijderen uit het model — achter een bevestiging,
   * met Ctrl+Z als vangnet (zundo).
   */
  const verwijderUitModel = () => {
    if (
      !window.confirm(
        `"${element.naam || elementId}" uit het model verwijderen?\n` +
          "Dit haalt het element (en zijn connectoren) ook van alle diagrammen. Ctrl+Z maakt het ongedaan."
      )
    ) {
      return;
    }
    profiel.useStore.getState().deleteElement(elementId);
    if (sleutel) plaatsDiagram(sleutel, null);
  };

  const ctx = (e) =>
    openCtxMenu(e, [
      { label: "Selecteer in inspector", onClick: selecteer },
      { label: "Hernoemen", onClick: () => setBewerk(true) },
      ...(sleutel
        ? [
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
          <input
            className="studio-project__mapnaam-invoer"
            defaultValue={element.naam || ""}
            autoFocus
            onFocus={(e) => e.target.select()}
            onBlur={(e) => commitNaam(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitNaam(e.target.value);
              else if (e.key === "Escape") setBewerk(false);
            }}
          />
        ) : (
          <button
            type="button"
            className={"studio-project__diagram studio-project__element" + (inMulti ? " is-multi" : "")}
            onClick={(e) => {
              if (sleutel && (e.ctrlKey || e.metaKey)) toggleMulti(sleutel);
              else {
                wisMulti();
                selecteer();
              }
            }}
            onDoubleClick={() => setBewerk(true)}
            onContextMenu={ctx}
            title={`${element.naam || elementId} — ${et?.label || "element"} (${profiel.label})`}
            draggable={!!sleutel}
            onDragStart={(e) => {
              if (!sleutel) return;
              e.dataTransfer.setData(PLAATSING_MIME, meeTeNemen(sleutel).join("\n"));
              e.dataTransfer.effectAllowed = "move";
            }}
          >
            <span className="studio-project__regel-profiel" style={{ color: stijl.kleur || "inherit" }}>
              {et ? <TypeIcoon elementType={et} maat={13} /> : <ProfielIcoon profiel={profiel} />}
            </span>
            {element.naam || elementId}
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
        if (!ids.length) return;
        const { ouderVan } = bepaalHierarchie(profiel, profiel.useStore.getState().elements);
        for (const id of new Set(ids.map((eid) => topVoorouder(ouderVan, eid)))) {
          plaatsDiagram(elementKey(profiel.id, id), map.id);
        }
      } catch { /* ignore */ }
    },
  });

  const nieuweSubmap = () => {
    const naam = window.prompt("Naam van de nieuwe submap:", "Nieuwe map");
    if (naam) nieuweMap(naam, map.id);
  };
  const verwijder = () => {
    if (window.confirm(`Map "${map.naam}" verwijderen? De inhoud valt terug naar het niveau erboven.`)) {
      verwijderMap(map.id);
    }
  };
  const schuifMap = useModellerenStore((s) => s.schuifMap);
  const ctx = (e) =>
    openCtxMenu(e, [
      { label: "Nieuw diagram", items: nieuwDiagramItems(map.id) },
      { label: "Nieuwe submap…", onClick: nieuweSubmap },
      { label: "Hernoemen", onClick: () => setBewerk(true) },
      { label: "Eigenschappen", onClick: () => selecteerMap(map.id) },
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
              if (e.key === "Enter") commitNaam(e.target.value);
              else if (e.key === "Escape") setBewerk(false);
            }}
          />
        ) : (
          <span
            className="studio-project__mapnaam"
            onClick={() => selecteerMap(map.id)}
            onDoubleClick={() => setBewerk(true)}
            title="Klik = eigenschappen; dubbelklik of ✎ = hernoemen; sleep = verplaatsen; rechtsklik = menu"
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
        <div>
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
  const nieuw = () => {
    const naam = window.prompt(
      `Naam van het nieuwe ${profiel.diagramTerm}:`,
      `Nieuw ${profiel.diagramTerm}`
    );
    if (!naam) return;
    const id = `${profiel.menuPrefix}_${Date.now()}`;
    profiel.useStore.getState().addDiagram({ id, naam, diagramType: profiel.descriptor.id });
    openTab(profiel.id, id);
  };

  const stijl = effectieveStijl(profiel);
  return (
    <div className="studio-project__sectie">
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

  const maakMap = () => {
    const naam = window.prompt("Naam van de nieuwe map:", "Nieuwe map");
    if (naam) nieuweMap(naam);
  };

  // Ctrl+Z / Ctrl+Y met de focus in de boom = structuur-undo/redo.
  // stopPropagation zodat de model-undo van het actieve profiel (globale
  // keydown-listener) niet óók afgaat.
  const structuurUndo = useModellerenStore((s) => s.structuurUndo);
  const structuurRedo = useModellerenStore((s) => s.structuurRedo);
  const onKey = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const doel = e.target;
    if (doel && (doel.tagName === "INPUT" || doel.tagName === "TEXTAREA" || doel.isContentEditable)) return;
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
        <div className="studio-project__elementen">
          <div className="studio-project__elementen-kop">
            <span
              className="studio-project__stip"
              style={{ background: effectieveStijl(profiel).kleur || "var(--s-fg-muted)" }}
            />
            <ProfielIcoon profiel={profiel} />
            <span className="studio-project__naam">{profiel.label}</span>
          </div>
          <Browser />
        </div>
      )}
      <BoomContextMenu />
    </div>
  );
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
            onClick={() => {
              const naam = window.prompt(`Naam van het nieuwe ${p.diagramTerm}:`, `Nieuw ${p.diagramTerm}`);
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
// deelbaar, back-upbaar, en de vorm die straks naar de API kan.

function exporteerProject() {
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
  const data = {
    formaat: "studio-project",
    versie: 1,
    geexporteerd: new Date().toISOString(),
    structuur: { mappen: s.mappen, plaatsing: s.plaatsing },
    tabs: s.tabs,
    actieveTab: s.actieveTab,
    kruisverbanden: useKruisStore.getState().links,
    profielen,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `studio-project-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importeerProjectTekst(tekst) {
  let data;
  try {
    data = JSON.parse(tekst);
  } catch {
    window.alert("Dit is geen geldig JSON-bestand.");
    return;
  }
  if (data?.formaat !== "studio-project") {
    window.alert("Dit is geen project-werkbestand (formaat 'studio-project' ontbreekt).");
    return;
  }
  const profielIds = Object.keys(data.profielen || {});
  const onbekend = profielIds.filter((pid) => !getProfieltype(pid));
  if (
    !window.confirm(
      "Project importeren?\n\nDit vervangt de projectstructuur (mappen, plaatsingen, tabs) én de inhoud van deze profielen:\n" +
        `  ${profielIds.filter((pid) => getProfieltype(pid)).join(", ") || "(geen)"}` +
        (onbekend.length ? `\n\nOnbekend hier (overgeslagen): ${onbekend.join(", ")}` : "")
    )
  ) {
    return;
  }
  for (const [pid, inhoud] of Object.entries(data.profielen || {})) {
    const p = getProfieltype(pid);
    if (!p) continue;
    p.useStore.getState().laadModel(inhoud);
    p.useStore.temporal?.getState().clear();
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
  if (Array.isArray(data.kruisverbanden)) {
    useKruisStore.getState().laadLinks(data.kruisverbanden);
  }
}

function kiesEnImporteerProject() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "application/json,.json";
  inp.onchange = () => {
    const f = inp.files?.[0];
    if (!f) return;
    f.text().then(importeerProjectTekst).catch((e) => window.alert(`Lezen mislukt: ${e}`));
  };
  inp.click();
}

/** Menubalk = eigen Project-menu + de menu's van het profiel van de actieve tab. */
function menus(ctx) {
  const projectMenu = {
    id: "project",
    label: "Project",
    items: [
      { id: "proj-export", label: "Exporteer project (structuur + modellen)…", onClick: exporteerProject },
      { id: "proj-import", label: "Importeer project…", onClick: kiesEnImporteerProject },
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
