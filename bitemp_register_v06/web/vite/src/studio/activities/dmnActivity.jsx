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
import DmnPropertiesPanel from "../../dmn/DmnPropertiesPanel";
import { IconDMN } from "../icons";
import { menuBus } from "../menuBus";
import { apiBase, downloadJson, downloadTekst } from "../studioUtils";

const Ctx = createContext(null);

function DmnProvider({ children }) {
  const [table, setTable] = useState(() => nieuweBeslistabel("Bepaal ingezetene-status"));
  const [bindDoel, setBindDoel] = useState(null);
  const [afgeleidVoorstel, setAfgeleidVoorstel] = useState(null);
  const [activeTab, setActiveTab] = useState("drd"); // "drd" | "tabel"
  const [dmnViews, setDmnViews] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
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

  const handleSelectionChange = useCallback((newSelection) => {
    // newSelection is een array van geselecteerde elementen
    // We pakken het eerste element (of null als leeg)
    const element = newSelection && newSelection.length > 0 ? newSelection[0] : null;
    setSelectedElement(element);
  }, []);

  const handleElementUpdate = useCallback((updates) => {
    if (!selectedElement || !modelerRef.current) return;
    const activeViewer = modelerRef.current.getActiveViewer?.();
    if (!activeViewer) return;
    const modeling = activeViewer.get?.("modeling");
    const elementRegistry = activeViewer.get?.("elementRegistry");
    if (!modeling || !elementRegistry) return;

    // Haal het echte diagram-element op (niet het businessObject)
    const elementId = selectedElement.id || selectedElement.businessObject?.id;
    const element = elementRegistry.get(elementId);
    if (!element) return;

    // modeling.updateProperties met het echte element triggert automatisch
    // een visuele re-render via commandStack.changed
    modeling.updateProperties(element, updates);

    // Haal het verse element opnieuw op uit de registry — dit is een echt
    // dmn-js element met $type, businessObject, etc. intact
    const refreshed = elementRegistry.get(elementId);
    setSelectedElement(refreshed || element);
  }, [selectedElement]);

  /** Drop-handler: FieldRef uit ModelPicker op een DMN-element zetten. */
  const handleDropFieldRef = useCallback(async (dmnElement, fieldRef) => {
    if (!modelerRef.current) return;

    const activeViewer = modelerRef.current.getActiveViewer?.();
    if (!activeViewer) return;
    const modeling = activeViewer.get?.("modeling");
    const elementRegistry = activeViewer.get?.("elementRegistry");
    if (!modeling || !elementRegistry) return;

    const element = elementRegistry.get(dmnElement.id);
    if (!element) return;

    const variableName = fieldRef.veldnaam || fieldRef.veldpad || "";
    const typeRef = fieldRef.datatype || fieldRef.type || "string";
    const bo = element.businessObject;
    const oudeLabel = bo.variable?.name || bo.name || "";

    // Stap 1: update de InputData in het DRD
    modeling.updateProperties(element, {
      name: fieldRef.veldpad || fieldRef.veldnaam,
      variable: {
        ...(bo.variable || { $type: "dmn:InformationItem", id: `${bo.id}_variable` }),
        name: variableName,
        typeRef,
      },
    });

    // Stap 2: muteer de decision-table input-labels direct in de gedeelde
    // business-objects.
    const allElements = elementRegistry.getAll();
    let affectedDecisionId = null;
    let mutated = false;
    for (const el of allElements) {
      const elBo = el.businessObject;
      if (!elBo || elBo.$type !== "dmn:Decision") continue;

      const infoReqs = elBo.informationRequirement || [];
      // Href kan met of zonder # zijn na dmn-js parsing
      const refsUs = infoReqs.some((ir) => {
        const href = ir.requiredInput?.href || ir.requiredDecision?.href || "";
        return href === dmnElement.id || href.endsWith("#" + dmnElement.id) || href.includes("#" + dmnElement.id);
      });
      if (!refsUs) continue;

      const dt = elBo.decisionLogic || elBo.decisionTable || elBo.encapsulatedLogic?.decisionTable || elBo.encapsulatedLogic?.decisionLogic;
      if (!dt || !dt.input) continue;

      for (const inp of dt.input) {
        const expr = inp.inputExpression;
        if (!expr) continue;
        if (expr.text === oudeLabel || inp.label === oudeLabel) {
          inp.label = variableName;
          expr.text = variableName;
          expr.typeRef = typeRef;
          mutated = true;
        }
      }
      affectedDecisionId = elBo.id;
    }

    // Stap 3: forceer de decision-table viewer te refreshen door de view
    // te openen (als die bestaat) en terug te keren naar DRD.
    if (mutated && affectedDecisionId) {
      const allViews = modelerRef.current.getViews?.() || [];
      const dtView = allViews.find((v) => v.type === "decisionTable" && v.element?.id === affectedDecisionId);
      if (dtView) {
        await modelerRef.current.openView(dtView.id);
        await new Promise((r) => setTimeout(r, 100));
        const drdView = allViews.find((v) => v.type === "drd");
        if (drdView) {
          await modelerRef.current.openView(drdView.id);
        }
      }
    }

    // Visuele refresh + update context
    const refreshed = elementRegistry.get(dmnElement.id);
    if (refreshed) {
      setSelectedElement(refreshed);
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
        selectedElement,
        handleViewChange,
        handleOpenView,
        handleSelectionChange,
        handleElementUpdate,
        handleDropFieldRef,
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
  const { table, setTable, setBindDoel, setAfgeleidVoorstel, activeTab, setActiveTab, modelerRef, handleViewChange, handleSelectionChange, handleDropFieldRef } = useContext(Ctx);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Tab-balk */}
      <div className="studio-tabs">
        <button
          className={"studio-tab" + (activeTab === "drd" ? " is-actief" : "")}
          onClick={() => setActiveTab("drd")}
        >
          DRD
        </button>
        <button
          className={"studio-tab" + (activeTab === "tabel" ? " is-actief" : "")}
          onClick={() => setActiveTab("tabel")}
        >
          Tabel
        </button>
      </div>

      {/* Tab-inhoud — op een vaste lichte "papier"-ondergrond, want dmn-js en de
          tabel-editor renderen niet leesbaar op het donkere studio-canvas. */}
      <div className="studio-paper" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {activeTab === "drd" ? (
          <div style={{ height: "100%", position: "relative" }}>
            <DmnModeler
              ref={modelerRef}
              xml={STARTER_DMN_XML}
              onViewChange={handleViewChange}
              onSelectionChange={handleSelectionChange}
              onDropFieldRef={handleDropFieldRef}
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
  const { table, afgeleidVoorstel, selectedElement, activeTab, handleElementUpdate } = useContext(Ctx);

  return (
    <div className="studio-inspector-pad">
      {/* DMN Element Properties (alleen in DRD tab) — bewerkbaar formulier */}
      {activeTab === "drd" && (
        <section style={{ marginBottom: 12 }}>
          <DmnPropertiesPanel element={selectedElement} onUpdate={handleElementUpdate} />
        </section>
      )}

      {/* Afgeleid veld voorstel (Tabel tab) */}
      {afgeleidVoorstel && (
        <section style={{ marginBottom: 12 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 13 }}>Voorstel afgeleid veld</h3>
          <pre style={{ margin: 0, background: "var(--s-panel-head)", color: "var(--s-fg)", padding: 10, borderRadius: 8, fontSize: 11, overflow: "auto" }}>
            {JSON.stringify(afgeleidVoorstel, null, 2)}
          </pre>
        </section>
      )}

      {/* Tabel JSON (Tabel tab) */}
      {activeTab === "tabel" && (
        <>
          <h3 style={{ margin: "0 0 6px", fontSize: 13 }}>Tabel (FieldRef-binding)</h3>
          <pre style={{ margin: 0, background: "var(--s-panel-head)", padding: 10, borderRadius: 8, fontSize: 11, overflow: "auto" }}>
            {JSON.stringify(table, null, 2)}
          </pre>
        </>
      )}
    </div>
  );
}

export default {
  id: "dmn",
  label: "DMN-beslissingen",
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
