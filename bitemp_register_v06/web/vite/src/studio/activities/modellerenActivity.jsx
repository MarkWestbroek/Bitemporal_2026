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
      return { tabs, actieveTab: id };
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

  /** Verwijder een map; submappen en plaatsingen vallen naar de ouder. */
  verwijderMap: (id) =>
    set((s) => {
      const weg = s.mappen[id];
      if (!weg) return {};
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
  const id = tabId(profiel.id, diagram.id);
  const stijl = effectieveStijl(profiel);
  return (
    <button
      type="button"
      className={"studio-project__diagram" + (id === actieveTab ? " is-actief" : "")}
      onClick={() => openTab(profiel.id, diagram.id)}
      title={`${diagram.naam} — ${profiel.label} (sleep naar een map)`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/studio-diagram", id);
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

/** Drop-gedrag voor mappen en "Niet ingedeeld". */
function useDrop(onDropKey) {
  const [over, setOver] = React.useState(false);
  return {
    over,
    props: {
      onDragOver: (e) => {
        if (e.dataTransfer.types.includes("text/studio-diagram")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      },
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: (e) => {
        setOver(false);
        const key = e.dataTransfer.getData("text/studio-diagram");
        if (key) {
          e.preventDefault();
          onDropKey(key);
        }
      },
    },
  };
}

/** Zoek profiel + diagram bij een plaatsing-sleutel ("profielId::diagramId"). */
function GeplaatstDiagram({ sleutel }) {
  const [profielId, diagramId] = sleutel.split("::");
  const profiel = getProfieltype(profielId);
  const diagram = profiel ? profiel.useStore((s) => s.diagrams[diagramId]) : null;
  if (!profiel || !diagram) return null;
  return <DiagramRegel profiel={profiel} diagram={diagram} inMap />;
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

  const open = mapOpen[map.id] ?? true;
  const kinderen = Object.values(mappen).filter((m) => m.ouderId === map.id);
  const inhoud = Object.entries(plaatsing)
    .filter(([, mapId]) => mapId === map.id)
    .map(([k]) => k);
  const drop = useDrop((key) => plaatsDiagram(key, map.id));

  return (
    <div className="studio-project__map" style={{ marginLeft: diepte ? 12 : 0 }}>
      <div
        className={"studio-project__mapkop" + (drop.over ? " is-dropdoel" : "")}
        {...drop.props}
      >
        <button type="button" className="studio-project__caret" onClick={() => toggleMap(map.id)}>
          {open ? "▾" : "▸"}
        </button>
        <span className="studio-project__mapnaam" onDoubleClick={() => {
          const naam = window.prompt("Nieuwe naam van de map:", map.naam);
          if (naam) hernoemMap(map.id, naam);
        }}>
          {map.naam}
        </span>
        <button
          type="button"
          className="studio-project__nieuw"
          title="Nieuwe submap"
          onClick={() => {
            const naam = window.prompt("Naam van de nieuwe submap:", "Nieuwe map");
            if (naam) nieuweMap(naam, map.id);
          }}
        >
          ＋
        </button>
        <button
          type="button"
          className="studio-project__nieuw"
          title="Map verwijderen (inhoud valt terug naar de ouder)"
          onClick={() => {
            if (window.confirm(`Map "${map.naam}" verwijderen? De inhoud valt terug naar het niveau erboven.`)) {
              verwijderMap(map.id);
            }
          }}
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
            <GeplaatstDiagram key={k} sleutel={k} />
          ))}
          {kinderen.length === 0 && inhoud.length === 0 && (
            <div className="studio-project__leeg">sleep hier diagrammen in</div>
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
  const rootMappen = Object.values(mappen).filter((m) => !m.ouderId);
  // Droppen op "Niet ingedeeld" haalt een diagram uit zijn map.
  const drop = useDrop((key) => plaatsDiagram(key, null));

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
        <div className="studio-project__kop">
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
