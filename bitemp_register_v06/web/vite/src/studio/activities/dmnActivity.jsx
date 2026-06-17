/**
 * dmnActivity — DMN-beslistabellen als activiteit (was: DmnEditorDemoPage).
 *
 * Slot-indeling:
 *   Sidebar   → DmnTreeBrowser (DRD diagrammen + elementen) + ModelPicker (canoniek model)
 *   Main      → Tabs: DRD view (dmn-js Modeler) + Tabel view (DmnTableEditor)
 *   Inspector → tabel als JSON + voorstel afgeleid veld
 *
 * Gedeelde state (tabel, bind-modus, activeTab, dmnViews) loopt via een lokale React-context, zodat de
 * onderliggende dmn/-module ongewijzigd blijft en netjes gescheiden is van de shell.
 */
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { ModelPicker } from "../../modelpicker";
import DmnTableEditor from "../../dmn/DmnTableEditor";
import DmnModeler from "../../dmn/DmnModeler";
import DmnTreeBrowser from "../../dmn/DmnTreeBrowser";
import { STARTER_DMN_XML } from "../../dmn/starterDmn";
import { nieuweBeslistabel, bindInput, bindOutput } from "../../dmn/dmnModel";
import { IconDMN } from "../icons";
import { menuBus } from "../menuBus";

const Ctx = createContext(null);

function apiBase() {
  return window.location.port === "5174" ? "http://localhost:8082" : "";
}

/** Download een object als ingesprongen JSON-bestand. */
function downloadJson(obj, bestandsnaam) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = bestandsnaam;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download tekst als bestand. */
function downloadTekst(tekst, bestandsnaam, mime = "text/xml") {
  const blob = new Blob([tekst], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = bestandsnaam;
  a.click();
  URL.revokeObjectURL(url);
}

function DmnProvider({ children }) {
  const [table, setTable] = useState(() => nieuweBeslistabel("Bepaal ingezetene-status"));
  const [bindDoel, setBindDoel] = useState(null);
  const [afgeleidVoorstel, setAfgeleidVoorstel] = useState(null);
  const [activeTab, setActiveTab] = useState("drd"); // "drd" | "tabel"
  const [dmnViews, setDmnViews] = useState([]);
  const modelerRef = useRef(null);

  // Laatste tabel in een ref, zodat de menu-export altijd de actuele waarde pakt.
  const tableRef = useRef(table);
  tableRef.current = table;

  // Menubalk-acties (activiteit-specifiek "Tabel"-menu) via de menuBus.
  useEffect(() => {
    const af = [
      menuBus.on("dmn:nieuw", () => {
        setTable(nieuweBeslistabel("Nieuwe beslistabel"));
        setAfgeleidVoorstel(null);
      }),
      menuBus.on("dmn:export", () => {
        if (activeTab === "tabel") {
          const t = tableRef.current;
          downloadJson(t, `${(t?.naam || "beslistabel").replace(/\s+/g, "_")}.json`);
        } else {
          // Exporteer DMN XML vanuit de Modeler
          modelerRef.current?.exportXML().then((xml) => {
            downloadTekst(xml, "diagram.dmn", "text/xml");
          });
        }
      }),
    ];
    return () => af.forEach((off) => off());
  }, [activeTab]);

  const handleViewChange = useCallback((view) => {
    // Update de lijst met beschikbare views wanneer de Modeler views verandert
    if (modelerRef.current) {
      const views = modelerRef.current.getViews();
      setDmnViews(views);
    }
  }, []);

  const handleOpenView = useCallback((viewId) => {
    if (modelerRef.current) {
      modelerRef.current.openView(viewId);
    }
  }, []);

  return (
    <Ctx.Provider
      value={{
        table,
        setTable,
        bindDoel,
        setBindDoel,
        afgeleidVoorstel,
        setAfgeleidVoorstel,
        activeTab,
        setActiveTab,
        dmnViews,
        modelerRef,
        handleViewChange,
        handleOpenView,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

function DmnSidebar() {
  const { bindDoel, setBindDoel, setTable, activeTab, dmnViews, handleOpenView } = useContext(Ctx);

  const onPick = useCallback(
    (ref) => {
      if (!bindDoel) return;
      setTable((t) =>
        bindDoel.kant === "input"
          ? bindInput(t, bindDoel.clauseId, ref)
          : bindOutput(t, bindDoel.clauseId, ref)
      );
      setBindDoel(null);
    },
    [bindDoel, setTable, setBindDoel]
  );

  // Bepaal de hint-tekst voor de sidebar afhankelijk van actieve tab en bind-modus.
  let hintText;
  if (activeTab === "tabel" && bindDoel) {
    hintText = `Bind-modus: kies een veld voor de ${bindDoel.kant}-kolom.`;
  } else if (activeTab === "tabel") {
    hintText = "Sleep een veld op een kolomkop of klik eerst \u201cbind\u2026\u201d in de tabel.";
  } else {
    hintText = "Canoniek model (voor tabel-binding)";
  }
  const hintKleur = bindDoel ? "#3b82f6" : "var(--s-fg-muted)";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* DMN Tree Browser (altijd zichtbaar) */}
      <div style={{ height: "40%", borderBottom: "1px solid var(--s-border, #e5e7eb)" }}>
        <DmnTreeBrowser views={dmnViews} onOpenView={handleOpenView} />
      </div>

      {/* ModelPicker (voor tabel-binding) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <p style={{ margin: 0, padding: "8px 10px", fontSize: 12, color: hintKleur }}>
          {hintText}
        </p>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ModelPicker baseUrl={apiBase()} onPick={onPick} expandEntiteiten />
        </div>
      </div>
    </div>
  );
}

function DmnMain() {
  const { table, setTable, setBindDoel, setAfgeleidVoorstel, activeTab, setActiveTab, modelerRef, handleViewChange } = useContext(Ctx);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Tab-balk */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--s-border, #e5e7eb)", background: "var(--s-panel-head)" }}>
        <button
          onClick={() => setActiveTab("drd")}
          style={{
            padding: "8px 16px",
            background: activeTab === "drd" ? "var(--s-bg)" : "transparent",
            border: "none",
            borderBottom: activeTab === "drd" ? "2px solid #3b82f6" : "2px solid transparent",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: activeTab === "drd" ? 600 : 400,
          }}
        >
          DRD
        </button>
        <button
          onClick={() => setActiveTab("tabel")}
          style={{
            padding: "8px 16px",
            background: activeTab === "tabel" ? "var(--s-bg)" : "transparent",
            border: "none",
            borderBottom: activeTab === "tabel" ? "2px solid #3b82f6" : "2px solid transparent",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: activeTab === "tabel" ? 600 : 400,
          }}
        >
          Tabel
        </button>
      </div>

      {/* Tab-inhoud */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {activeTab === "drd" ? (
          <div style={{ height: "100%", position: "relative" }}>
            <DmnModeler
              ref={modelerRef}
              xml={STARTER_DMN_XML}
              onViewChange={handleViewChange}
              style={{ height: "100%" }}
            />
          </div>
        ) : (
          <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
            <DmnTableEditor
              table={table}
              onChange={setTable}
              onRequestBind={(clauseId, kant) => setBindDoel({ clauseId, kant })}
              onPromoveerAdhoc={setAfgeleidVoorstel}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function DmnInspector() {
  const { table, afgeleidVoorstel } = useContext(Ctx);
  return (
    <div className="studio-inspector-pad">
      {afgeleidVoorstel && (
        <section style={{ marginBottom: 12 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 13 }}>Voorstel afgeleid veld</h3>
          <pre style={{ margin: 0, background: "#0f172a", color: "#e2e8f0", padding: 10, borderRadius: 8, fontSize: 11, overflow: "auto" }}>
            {JSON.stringify(afgeleidVoorstel, null, 2)}
          </pre>
        </section>
      )}
      <h3 style={{ margin: "0 0 6px", fontSize: 13 }}>Tabel (FieldRef-binding)</h3>
      <pre style={{ margin: 0, background: "var(--s-panel-head)", padding: 10, borderRadius: 8, fontSize: 11, overflow: "auto" }}>
        {JSON.stringify(table, null, 2)}
      </pre>
    </div>
  );
}

export default {
  id: "dmn",
  label: "DMN-tabellen",
  icon: <IconDMN />,
  groep: "modelleren",
  Provider: DmnProvider,
  Sidebar: DmnSidebar,
  Main: DmnMain,
  Inspector: DmnInspector,
  sidebarLabel: "Canoniek model",
  inspectorLabel: "Beslistabel",
  // Activiteit-specifiek menu in de menubalk (gedemonstreerd via de menuBus).
  menus: [
    {
      id: "tabel",
      label: "Tabel",
      items: [
        { id: "dmn-nieuw", label: "Nieuwe beslistabel", onClick: () => menuBus.emit("dmn:nieuw") },
        { type: "separator" },
        { id: "dmn-export", label: "Exporteer als JSON…", onClick: () => menuBus.emit("dmn:export") },
      ],
    },
  ],
};
