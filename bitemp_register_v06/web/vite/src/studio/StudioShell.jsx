/**
 * StudioShell — de werkbank-shell (VS Code-stijl).
 *
 * Indeling:
 *   ┌──┬───────────────────────────────────────────────┐
 *   │A │ Titelbalk (activiteit + paneel-toggles + thema)│
 *   │c ├──────────┬───────────────────────┬─────────────┤
 *   │t │ Sidebar  │        Main           │  Inspector  │
 *   │i │ (tree)   │      (editor)         │ (properties)│
 *   │  │ auto-hide│                       │  auto-hide  │
 *   └──┴──────────┴───────────────────────┴─────────────┘
 *
 * De shell kent alleen het activiteit-*contract* (Sidebar/Main/Inspector + Provider).
 * Welke activiteiten bestaan komt uit het activityRegistry — volledig uitbreidbaar.
 */
import React, { Fragment, Suspense } from "react";
import { getActiviteiten } from "./activityRegistry";
import useStudioStore from "./useStudioStore";
import useUIStore from "../store/useUIStore";
import ActivityBar from "./ActivityBar";
import SidePanel from "./SidePanel";
import MenuBar from "./MenuBar";
import { buildMenus } from "./buildMenus";
import { menuBus } from "./menuBus";
import { OmniumMark } from "./icons";

function ThemaKnop() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  return (
    <button
      type="button"
      className="studio-topbar__btn"
      onClick={toggleTheme}
      title={theme === "dark" ? "Licht thema" : "Donker thema"}
    >
      {theme === "dark" ? "☾" : "☀"}
    </button>
  );
}

export default function StudioShell() {
  const activiteiten = getActiviteiten();
  const activeId = useStudioStore((s) => s.activeId);
  const setActief = useStudioStore((s) => s.setActief);
  const paneelStand = useStudioStore((s) => s.paneelStand);
  const sidebarWidth = useStudioStore((s) => s.sidebarWidth);
  const inspectorWidth = useStudioStore((s) => s.inspectorWidth);
  const toggleSidebar = useStudioStore((s) => s.toggleSidebar);
  const toggleInspector = useStudioStore((s) => s.toggleInspector);
  const togglePin = useStudioStore((s) => s.togglePin);
  const setSidebarWidth = useStudioStore((s) => s.setSidebarWidth);
  const setInspectorWidth = useStudioStore((s) => s.setInspectorWidth);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  // Generiek verversmechanisme voor de menubalk: een activiteit die state
  // wijzigt waar menu-items (checked/disabled) van afhangen, emit
  // "menu:ververs" — de shell bouwt de menu's dan opnieuw op.
  const [, setMenuVersie] = React.useState(0);
  React.useEffect(() => menuBus.on("menu:ververs", () => setMenuVersie((v) => v + 1)), []);

  // Eerste activiteit selecteren als er nog geen actief is.
  const actief =
    activiteiten.find((a) => a.id === activeId) || activiteiten[0] || null;
  React.useEffect(() => {
    if (actief && actief.id !== activeId) setActief(actief.id);
  }, [actief, activeId, setActief]);

  if (!actief) {
    return <div className="studio-empty">Geen functies geregistreerd.</div>;
  }

  const heeftSidebar = !actief.fullMain && !!actief.Sidebar;
  const heeftInspector = !actief.fullMain && !!actief.Inspector;
  const sidebarOpen = (paneelStand[actief.id]?.sidebar ?? true) && heeftSidebar;
  const inspectorOpen = (paneelStand[actief.id]?.inspector ?? true) && heeftInspector;
  const sidebarPinned = paneelStand[actief.id]?.sidebarPinned ?? true;
  const inspectorPinned = paneelStand[actief.id]?.inspectorPinned ?? true;

  const Provider = actief.Provider || Fragment;
  const Sidebar = actief.Sidebar;
  const Main = actief.Main;
  const Inspector = actief.Inspector;

  // Stel de menubalk samen (standaard + activiteit-specifiek).
  const menus = buildMenus({
    activiteiten,
    actief,
    setActief,
    theme,
    toggleTheme,
    heeftSidebar,
    heeftInspector,
    sidebarOpen,
    inspectorOpen,
    sidebarPinned,
    inspectorPinned,
    toggleSidebar,
    toggleInspector,
    togglePin,
  });

  const menubar = (
    <MenuBar
      menus={menus}
      brand={
        <span className="studio-menubar__product-brand" title="Omnium Studio">
          <OmniumMark size={20} />
          <span className="studio-menubar__product-name">
            Omnium<span className="studio-menubar__product-sub">Studio</span>
          </span>
        </span>
      }
      links={
        <span className="studio-menubar__brand">
          {actief.label}
          {actief.status === "concept" && (
            <span className="studio-topbar__concept" style={{ marginLeft: 8 }}>concept</span>
          )}
        </span>
      }
    />
  );

  // fullMain-activiteiten (bv. UML-IDE) brengen hun eigen volledige layout +
  // toolbar mee; de shell toont dan alleen de menubalk + activity bar.
  if (actief.fullMain) {
    return (
      <div className="studio" data-studio-theme={theme}>
        {menubar}
        <div className="studio-shell-row">
          <ActivityBar activiteiten={activiteiten} />
          <div className="studio-main">
            <Suspense fallback={<div className="studio-laden">Laden…</div>}>
              <Provider>
                <main className="studio-canvas studio-canvas--full">
                  <Main />
                </main>
              </Provider>
            </Suspense>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="studio" data-studio-theme={theme}>
      {menubar}
      <div className="studio-shell-row">
        <ActivityBar activiteiten={activiteiten} />

        <div className="studio-main">
          <header className="studio-topbar">
            <div className="studio-topbar__left">
              {heeftSidebar && (
                <button
                  type="button"
                  className={"studio-topbar__btn" + (sidebarOpen ? " is-actief" : "")}
                  onClick={toggleSidebar}
                  title="Linkerpaneel"
                >
                  ▕▏
                </button>
              )}
              <span className="studio-topbar__titel">{actief.label}</span>
              {actief.status === "concept" && (
                <span className="studio-topbar__concept">concept</span>
              )}
            </div>
            <div className="studio-topbar__right">
              {heeftInspector && (
                <button
                  type="button"
                  className={"studio-topbar__btn" + (inspectorOpen ? " is-actief" : "")}
                  onClick={toggleInspector}
                  title="Rechterpaneel"
                >
                  ▏▕
                </button>
              )}
              <ThemaKnop />
            </div>
          </header>

          <Suspense fallback={<div className="studio-laden">Laden…</div>}>
            <Provider>
              <div className="studio-body">
                {heeftSidebar && (
                  <SidePanel
                    kant="left"
                    titel={actief.sidebarLabel || "Verkenner"}
                    open={sidebarOpen}
                    onToggle={toggleSidebar}
                    pinned={sidebarPinned}
                    onTogglePin={() => togglePin("sidebar")}
                    width={sidebarWidth}
                    onResize={setSidebarWidth}
                  >
                    <Sidebar />
                  </SidePanel>
                )}

                <main className="studio-canvas">
                  <Main />
                </main>

                {heeftInspector && (
                  <SidePanel
                    kant="right"
                    titel={actief.inspectorLabel || "Eigenschappen"}
                    open={inspectorOpen}
                    onToggle={toggleInspector}
                    pinned={inspectorPinned}
                    onTogglePin={() => togglePin("inspector")}
                    width={inspectorWidth}
                    onResize={setInspectorWidth}
                  >
                    <Inspector />
                  </SidePanel>
                )}
              </div>
            </Provider>
          </Suspense>
        </div>
      </div>
    </div>
  );
}
