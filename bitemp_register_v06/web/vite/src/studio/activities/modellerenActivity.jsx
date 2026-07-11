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
} from "../profieltypeRegistry";

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
      JSON.stringify({ tabs: state.tabs, actieveTab: state.actieveTab })
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
}));

/** Actieve tab + bijbehorend profieltype (of nulls). */
function actieveTabInfo() {
  const s = useModellerenStore.getState();
  const tab = s.tabs.find((t) => t.id === s.actieveTab) || null;
  return { tab, profiel: tab ? getProfieltype(tab.profielId) || null : null };
}

// ── Sidebar: projectbrowser v0 (per profieltype zijn diagrammen) ────
function ProfielSectie({ profiel }) {
  const diagrams = profiel.useStore((s) => s.diagrams);
  const actieveTab = useModellerenStore((s) => s.actieveTab);
  const openTab = useModellerenStore((s) => s.openTab);

  const entries = Object.values(diagrams);
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

  return (
    <div className="studio-project__sectie">
      <div className="studio-project__kop">
        <span className="studio-project__stip" style={{ background: profiel.kleur || "var(--s-fg-muted)" }} />
        <span className="studio-project__icoon">{profiel.icon}</span>
        <span className="studio-project__naam">{profiel.label}</span>
        <button type="button" className="studio-project__nieuw" onClick={nieuw} title={`Nieuw ${profiel.diagramTerm}`}>
          ＋
        </button>
      </div>
      {entries.length === 0 && <div className="studio-project__leeg">geen {profiel.diagramTerm}men</div>}
      {entries.map((d) => {
        const id = tabId(profiel.id, d.id);
        return (
          <button
            key={d.id}
            type="button"
            className={"studio-project__diagram" + (id === actieveTab ? " is-actief" : "")}
            onClick={() => openTab(profiel.id, d.id)}
            title={`${d.naam} — ${profiel.label}`}
          >
            {d.naam}
          </button>
        );
      })}
    </div>
  );
}

function Sidebar() {
  useSyncExternalStore(abonneerOpProfieltypen, profieltypenVersie);
  const profielen = getProfieltypen();
  return (
    <div className="studio-project">
      {profielen.map((p) => (
        <ProfielSectie key={p.id} profiel={p} />
      ))}
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

  return (
    <span
      className={"studio-tab" + (actief ? " is-actief" : "")}
      style={actief ? { borderTopColor: profiel.kleur || "var(--s-accent)" } : undefined}
      title={`${diagram.naam} — ${profiel.label}`}
    >
      <button type="button" className="studio-tab__kies" onClick={() => activeer(tab.id)}>
        <span className="studio-tab__icoon">{profiel.icon}</span>
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
            <span className="studio-project__stip" style={{ background: p.kleur || "var(--s-fg-muted)" }} />
            {p.icon} {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Main() {
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
