/**
 * dmnActivity — DMN-beslistabellen als activiteit (was: DmnEditorDemoPage).
 *
 * Slot-indeling:
 *   Sidebar   → ModelPicker (canoniek model, bind-bron)
 *   Main      → DmnTableEditor (de beslistabel)
 *   Inspector → tabel als JSON + voorstel afgeleid veld
 *
 * Gedeelde state (tabel, bind-modus) loopt via een lokale React-context, zodat de
 * onderliggende dmn/-module ongewijzigd blijft en netjes gescheiden is van de shell.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ModelPicker } from "../../modelpicker";
import DmnTableEditor from "../../dmn/DmnTableEditor";
import { nieuweBeslistabel, bindInput, bindOutput } from "../../dmn/dmnModel";
import { IconDMN } from "../icons";
import { menuBus } from "../menuBus";

const Ctx = createContext(null);

function apiBase() {
  return window.location.port === "5174" ? "http://localhost:8082" : "";
}

function DmnProvider({ children }) {
  const [table, setTable] = useState(() => nieuweBeslistabel("Bepaal ingezetene-status"));
  const [bindDoel, setBindDoel] = useState(null);
  const [afgeleidVoorstel, setAfgeleidVoorstel] = useState(null);

  // Menubalk-acties (activiteit-specifiek "Tabel"-menu) via de menuBus.
  useEffect(() => {
    const af1 = menuBus.on("dmn:nieuw", () => {
      setTable(nieuweBeslistabel("Nieuwe beslistabel"));
      setAfgeleidVoorstel(null);
    });
    return () => { af1(); };
  }, []);

  return (
    <Ctx.Provider value={{ table, setTable, bindDoel, setBindDoel, afgeleidVoorstel, setAfgeleidVoorstel }}>
      {children}
    </Ctx.Provider>
  );
}

function DmnSidebar() {
  const { bindDoel, setBindDoel, setTable } = useContext(Ctx);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <p style={{ margin: 0, padding: "8px 10px", fontSize: 12, color: bindDoel ? "#3b82f6" : "var(--s-fg-muted)" }}>
        {bindDoel
          ? `Bind-modus: kies een veld voor de ${bindDoel.kant}-kolom.`
          : "Sleep een veld op een kolomkop of klik eerst \u201cbind\u2026\u201d in de tabel."}
      </p>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ModelPicker baseUrl={apiBase()} onPick={onPick} expandEntiteiten />
      </div>
    </div>
  );
}

function DmnMain() {
  const { table, setTable, setBindDoel, setAfgeleidVoorstel } = useContext(Ctx);
  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <DmnTableEditor
        table={table}
        onChange={setTable}
        onRequestBind={(clauseId, kant) => setBindDoel({ clauseId, kant })}
        onPromoveerAdhoc={setAfgeleidVoorstel}
      />
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
      ],
    },
  ],
};
