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
      // map — de inspector toont dan weer het profiel.
      return { tabs, actieveTab: id, mapSelectie: null };
    });
    get().activeer(id);
  },

  /** Maak de tab actief én zet het diagram actief in zijn profiel-store. */
  activeer: (id) => {
    const tab = get().tabs.find((t) => t.id === id);
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
      const mappen = { ...s.mappen, [id]: { id, naam, ouderId } };
      const next = { ...s, mappen };
      schrijfOpslag(next);
      return { mappen };
    });
    return id;
  },

  hernoemMap: (id, naam) =>
    set((s) => {
      const m = s.mappen[id];
      if (!m) return {};
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
      const mappen = { ...s.mappen, [id]: { ...m, kleur: kleur || undefined } };
      const next = { ...s, mappen };
      schrijfOpslag(next);
      return { mappen };
    }),

  /** Geselecteerde map (voor het eigenschappen-paneel), of null. */
  mapSelectie: null,
  selecteerMap: (id) => set({ mapSelectie: id }),

  /** Verwijder een map; submappen en plaatsingen vallen naar de ouder. */
  verwijderMap: (id) =>
    set((s) => {
      const weg = s.mappen[id];
      if (!weg) return {};
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
      const mappen = { ...s.mappen, [id]: { ...m, ouderId: ouderId || null } };
      const next = { ...s, mappen };
      schrijfOpslag(next);
      return { mappen };
    }),

  /** Plaats (of ont-plaats met mapId null) een diagram in een map. */
  plaatsDiagram: (key, mapId) =>
    set((s) => {
      const plaatsing = { ...s.plaatsing };
      if (mapId) plaatsing[key] = mapId;
      else delete plaatsing[key];
      const next = { ...s, plaatsing };
      schrijfOpslag(next);
      return { plaatsing };
    }),
}));

/** Actieve tab + bijbehorend profieltype (of nulls). */
function actieveTabInfo() {
  const s = useModellerenStore.getState();
  const tab = s.tabs.find((t) => t.id === s.actieveTab) || null;
  return { tab, profiel: tab ? getProfieltype(tab.profielId) || null : null };
}

// ── Sidebar: projectbrowser — vrije mappen + "Niet ingedeeld" ───────

/** Eén diagram-regel; overal dezelfde: klikbaar, versleepbaar. */
function DiagramRegel({ profiel, diagram, inMap = false }) {
  const actieveTab = useModellerenStore((s) => s.actieveTab);
  const openTab = useModellerenStore((s) => s.openTab);
  const plaatsDiagram = useModellerenStore((s) => s.plaatsDiagram);
  const id = tabId(profiel.id, diagram.id);
  const stijl = effectieveStijl(profiel);
  const ctx = (e) =>
    openCtxMenu(e, [
      { label: "Openen", onClick: () => openTab(profiel.id, diagram.id) },
      ...(inMap ? [{ sep: true }, { label: "Uit de map halen", onClick: () => plaatsDiagram(id, null) }] : []),
    ]);
  return (
    <button
      type="button"
      className={"studio-project__diagram" + (id === actieveTab ? " is-actief" : "")}
      onClick={() => openTab(profiel.id, diagram.id)}
      onContextMenu={ctx}
      title={`${diagram.naam} — ${profiel.label} (sleep naar een map)`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(PLAATSING_MIME, id);
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
function ContextMenu({ menu, sluit }) {
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
  return (
    <div className="studio-ctxmenu" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()}>
      {menu.items.map((it, i) =>
        it.sep ? (
          <div key={`sep-${i}`} className="studio-ctxmenu__sep" />
        ) : (
          <button
            key={it.label}
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

/**
 * Element-regel in een map (eigendom-plek; het element woont hier éénmaal).
 * Hiërarchie-kinderen (GE's onder hun ENT, compositie) reizen automatisch
 * mee als geneste regels; `standaardDichtInBoom` van het elementtype bepaalt
 * de beginstand van de chevron.
 */
function ElementRegel({ profiel, elementId, sleutel, diepte = 0 }) {
  const elements = profiel.useStore((s) => s.elements);
  const openTab = useModellerenStore((s) => s.openTab);
  const plaatsDiagram = useModellerenStore((s) => s.plaatsDiagram);
  const element = elements[elementId];
  const et = element
    ? (profiel.descriptor.elementTypes || []).find((t) => t.id === element.elementType)
    : null;
  const [dicht, setDicht] = React.useState(null); // null = volg profiel-default
  if (!element) return null;

  const { kinderenVan } = bepaalHierarchie(profiel, elements);
  const kinderen = diepte < 8 ? kinderenVan.get(elementId) || [] : [];
  const isDicht = dicht ?? !!et?.standaardDichtInBoom;
  const stijl = effectieveStijl(profiel);

  // Klik = het element selecteren in zijn profiel: activeer een tab van dat
  // profiel (liefst een diagram waar het element op staat) en stuur daarna
  // de selectie via de menuBus (Provider van het profiel luistert).
  const selecteer = () => {
    const s = profiel.useStore.getState();
    const opDiagram = Object.values(s.diagrams).find((d) =>
      (d.nodes || []).some((n) => n.elementId === elementId)
    );
    const doel = opDiagram || s.diagrams[s.actiefDiagramId] || Object.values(s.diagrams)[0];
    if (doel) openTab(profiel.id, doel.id);
    setTimeout(() => menuBus.emit(`${profiel.menuPrefix}:selecteer-element`, elementId), 120);
  };

  const ctx = (e) =>
    openCtxMenu(e, [
      { label: "Selecteer in inspector", onClick: selecteer },
      ...(sleutel
        ? [{ sep: true }, { label: "Uit de map halen", onClick: () => plaatsDiagram(sleutel, null) }]
        : []),
    ]);

  return (
    <div>
      <div className="studio-project__elementrij" style={{ paddingLeft: diepte ? diepte * 12 : 0 }}>
        {kinderen.length > 0 ? (
          <button type="button" className="studio-project__caret" onClick={() => setDicht(!isDicht)}>
            {isDicht ? "▸" : "▾"}
          </button>
        ) : (
          <span className="studio-project__caret" />
        )}
        <button
          type="button"
          className="studio-project__diagram studio-project__element"
          onClick={selecteer}
          onContextMenu={ctx}
          title={`${element.naam || elementId} — ${et?.label || "element"} (${profiel.label})`}
          draggable={!!sleutel}
          onDragStart={(e) => {
            if (!sleutel) return;
            e.dataTransfer.setData(PLAATSING_MIME, sleutel);
            e.dataTransfer.effectAllowed = "move";
          }}
        >
          <span className="studio-project__regel-profiel" style={{ color: stijl.kleur || "inherit" }}>
            {et ? <TypeIcoon elementType={et} maat={13} /> : <ProfielIcoon profiel={profiel} />}
          </span>
          {element.naam || elementId}
        </button>
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
  const kinderen = Object.values(mappen).filter((m) => m.ouderId === map.id);
  const inhoud = Object.entries(plaatsing)
    .filter(([, mapId]) => mapId === map.id)
    .map(([k]) => k);
  const selecteerMap = useModellerenStore((s) => s.selecteerMap);
  const mapSelectie = useModellerenStore((s) => s.mapSelectie);
  const [bewerk, setBewerk] = React.useState(false);
  const drop = useDrop({
    // Boomregel (diagram of element) die al een plaatsing-sleutel heeft.
    [PLAATSING_MIME]: (key) => plaatsDiagram(key, map.id),
    // Andere map: verhangen (met cyclus-check in de store).
    [MAP_MIME]: (id) => verplaatsMap(id, map.id),
    // Element uit de ElementenBrowser (van het actieve tab-profiel). Een
    // hiërarchie-kind (GE) kan niet los geplaatst worden: we plaatsen zijn
    // top-voorouder (ENT) — de kinderen reizen als boomregels vanzelf mee.
    [ELEMENT_MIME]: (rauw) => {
      try {
        const { elementId } = JSON.parse(rauw);
        const { profiel } = actieveTabInfo();
        if (!elementId || !profiel) return;
        const { ouderVan } = bepaalHierarchie(profiel, profiel.useStore.getState().elements);
        plaatsDiagram(elementKey(profiel.id, topVoorouder(ouderVan, elementId)), map.id);
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
  const ctx = (e) =>
    openCtxMenu(e, [
      { label: "Hernoemen", onClick: () => setBewerk(true) },
      { label: "Nieuwe submap…", onClick: nieuweSubmap },
      { label: "Eigenschappen", onClick: () => selecteerMap(map.id) },
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
        <button type="button" className="studio-project__nieuw" onClick={nieuw} title={`Nieuw ${profiel.diagramTerm}`}>
          ＋
        </button>
      </div>
      {entries.length === 0 && <div className="studio-project__leeg">geen {profiel.diagramTerm}men</div>}
      {entries.map((d) => (
        <DiagramRegel key={d.id} profiel={profiel} diagram={d} />
      ))}
    </div>
  );
}

function Sidebar() {
  useSyncExternalStore(abonneerOpProfieltypen, profieltypenVersie);
  const profielen = getProfieltypen();
  const mappen = useModellerenStore((s) => s.mappen);
  const nieuweMap = useModellerenStore((s) => s.nieuweMap);
  const plaatsDiagram = useModellerenStore((s) => s.plaatsDiagram);
  const actieveTab = useModellerenStore((s) => s.actieveTab);
  const tabs = useModellerenStore((s) => s.tabs);
  const verplaatsMap = useModellerenStore((s) => s.verplaatsMap);
  const rootMappen = Object.values(mappen).filter((m) => !m.ouderId);
  // Droppen op "Niet ingedeeld" haalt een regel uit zijn map.
  const drop = useDrop({ [PLAATSING_MIME]: (key) => plaatsDiagram(key, null) });
  // Droppen op de "Mappen"-kop hangt een map terug aan de wortel.
  const dropWortel = useDrop({ [MAP_MIME]: (id) => verplaatsMap(id, null) });

  // Elementen-boom van het profiel van de actieve tab (vereist diens
  // Provider — die wrapt alle slots, dus ook deze sidebar).
  const tab = tabs.find((t) => t.id === actieveTab) || null;
  const profiel = tab ? getProfieltype(tab.profielId) : null;
  const Browser = profiel?.ElementenBrowser;

  const maakMap = () => {
    const naam = window.prompt("Naam van de nieuwe map:", "Nieuwe map");
    if (naam) nieuweMap(naam);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div className="studio-project" style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
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
        {profielen.map((p) => (
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

// ── Inspector + Provider: volgen het profiel van de actieve tab ────
function Inspector() {
  const actieveTab = useModellerenStore((s) => s.actieveTab);
  const tabs = useModellerenStore((s) => s.tabs);
  const mapSelectie = useModellerenStore((s) => s.mapSelectie);
  // Een geselecteerde map wint: mappen zijn structuur-elementen met eigen
  // eigenschappen (naam, kleur) — consolidatieplan, "superprofiel"-spoor.
  if (mapSelectie) return <MapEigenschappen mapId={mapSelectie} />;
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
function Provider({ children }) {
  const actieveTab = useModellerenStore((s) => s.actieveTab);
  const tabs = useModellerenStore((s) => s.tabs);
  const tab = tabs.find((t) => t.id === actieveTab) || null;
  const profiel = tab ? getProfieltype(tab.profielId) : null;
  const P = profiel?.Provider || Fragment;
  return <P key={profiel?.id || "leeg"}>{children}</P>;
}

/** Menubalk = de menu's van het profiel van de actieve tab. */
function menus(ctx) {
  const { profiel } = actieveTabInfo();
  if (!profiel) return [];
  const ruw = typeof profiel.menus === "function" ? profiel.menus(ctx) : profiel.menus;
  return Array.isArray(ruw) ? ruw : [];
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
