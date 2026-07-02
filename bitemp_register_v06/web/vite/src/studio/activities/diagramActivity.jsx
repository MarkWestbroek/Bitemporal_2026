/**
 * diagramActivity — "Diagrammen (0.5)": de generieke diagram-motor (diagramcore)
 * als preview-activiteit, parallel naast de bestaande UML-IDE.
 *
 * Fase 1 (read-only spiegel, zie docs/STUDIO-05-diagramcore-plan.md §7):
 *  - leest het bestaande UML-model uit useModelStore via de canoniek-uml-adapter
 *  - rendert diagrammen met de generieke ElementNode/ConnectorEdge
 *  - schrijft NOOIT terug; bewerken blijft in de UML-activiteit
 *
 * Eigen store (createDiagramStore) zodat de motor het oude model nooit raakt;
 * de zware canvas (React Flow + shapes) wordt lazy geladen.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { IconDiagram } from "../icons";
import { menuBus } from "../menuBus";
import useModelStore from "../../store/useModelStore";
import { createDiagramStore } from "../../diagramcore/model/createDiagramStore.js";
import {
  registreerCanoniekUml,
  canoniekUmlDiagramType,
} from "../../diagramprofielen/canoniek-uml/index.js";
import { vanCanoniekModel } from "../../diagramprofielen/canoniek-uml/adapter.js";

const DiagramCanvas = lazy(() => import("../../diagramcore/canvas/DiagramCanvas.jsx"));

registreerCanoniekUml();

/** Eigen store-instantie voor deze activiteit (geen persist — spiegel). */
const useDiagram05Store = createDiagramStore();

const Ctx = createContext(null);

function Diagram05Provider({ children }) {
  const [selectie, setSelectie] = useState(null);

  const herlaad = useCallback(() => {
    useDiagram05Store.getState().laadModel(vanCanoniekModel(useModelStore.getState()));
    setSelectie(null);
  }, []);

  useEffect(() => {
    herlaad();
    return menuBus.on("diagram05:herlaad", herlaad);
  }, [herlaad]);

  return <Ctx.Provider value={{ selectie, setSelectie, herlaad }}>{children}</Ctx.Provider>;
}

function Diagram05Sidebar() {
  const diagrams = useDiagram05Store((s) => s.diagrams);
  const actief = useDiagram05Store((s) => s.actiefDiagramId);
  const setActief = useDiagram05Store((s) => s.setActiefDiagram);
  const elements = useDiagram05Store((s) => s.elements);
  const { herlaad } = useContext(Ctx);

  const lijst = Object.values(diagrams);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontSize: 13 }}>
      <div style={{ flex: 1, overflow: "auto", padding: 6 }}>
        {lijst.length === 0 && (
          <p style={{ margin: 8, color: "var(--s-fg-muted)" }}>
            Geen diagrammen gevonden. Laad of maak eerst een model in de UML-activiteit en
            kies dan &ldquo;Herlaad uit UML-model&rdquo;.
          </p>
        )}
        {lijst.map((d) => (
          <button
            key={d.id}
            onClick={() => setActief(d.id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "6px 10px",
              marginBottom: 2,
              borderRadius: 6,
              border: "1px solid transparent",
              cursor: "pointer",
              font: "inherit",
              color: "var(--s-fg)",
              background: d.id === actief ? "var(--s-hover)" : "transparent",
              borderColor: d.id === actief ? "var(--s-border)" : "transparent",
            }}
          >
            📐 {d.naam}
            <span style={{ float: "right", color: "var(--s-fg-muted)", fontSize: 11 }}>
              {d.nodes.length}
            </span>
          </button>
        ))}
      </div>
      <div
        style={{
          padding: "6px 10px",
          borderTop: "1px solid var(--s-border)",
          color: "var(--s-fg-muted)",
          fontSize: 11,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>{Object.keys(elements).length} elementen</span>
        <button
          onClick={herlaad}
          title="Herlaad uit UML-model"
          style={{
            border: "1px solid var(--s-border)",
            background: "transparent",
            color: "var(--s-fg)",
            borderRadius: 6,
            padding: "2px 8px",
            cursor: "pointer",
            font: "inherit",
            fontSize: 11,
          }}
        >
          ⟳ herlaad
        </button>
      </div>
    </div>
  );
}

function Diagram05Main() {
  const { setSelectie } = useContext(Ctx);
  const elements = useDiagram05Store((s) => s.elements);
  const diagrams = useDiagram05Store((s) => s.diagrams);
  const actief = useDiagram05Store((s) => s.actiefDiagramId);
  const diagram = actief ? diagrams[actief] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="dc-preview-strook">
        <span className="dc-preview-badge">0.5 preview</span>
        <span>Read-only spiegel van het UML-model — bewerken kan in de UML-activiteit.</span>
        <span style={{ marginLeft: "auto" }}>{diagram?.naam || ""}</span>
      </div>
      <div className="studio-paper" style={{ flex: 1, minHeight: 0 }}>
        {diagram ? (
          <Suspense fallback={<div style={{ padding: 16, color: "#64748b" }}>Canvas laden…</div>}>
            <DiagramCanvas
              diagramType={canoniekUmlDiagramType}
              elements={elements}
              diagram={diagram}
              onSelectElement={setSelectie}
            />
          </Suspense>
        ) : (
          <div style={{ padding: 24, color: "#64748b" }}>
            Geen diagram geselecteerd — kies er een in het linkerpaneel.
          </div>
        )}
      </div>
    </div>
  );
}

function Diagram05Inspector() {
  const { selectie } = useContext(Ctx);
  if (!selectie) {
    return (
      <div className="studio-inspector-pad" style={{ color: "var(--s-fg-muted)", fontSize: 13 }}>
        Selecteer een element op het canvas om de eigenschappen te bekijken (read-only in
        deze preview).
      </div>
    );
  }
  const et = canoniekUmlDiagramType.elementTypes.find((t) => t.id === selectie.elementType);
  return (
    <div className="studio-inspector-pad" style={{ fontSize: 13 }}>
      <h3 style={{ margin: "0 0 2px", fontSize: 14 }}>{selectie.naam || "(naamloos)"}</h3>
      <p style={{ margin: "0 0 10px", color: "var(--s-fg-muted)", fontSize: 12 }}>
        {et?.label || selectie.elementType}
        {selectie.data?.domein ? ` · ${selectie.data.domein}` : ""}
      </p>
      <pre
        style={{
          margin: 0,
          background: "var(--s-panel-head)",
          color: "var(--s-fg)",
          padding: 10,
          borderRadius: 8,
          fontSize: 11,
          overflow: "auto",
        }}
      >
        {JSON.stringify(selectie, null, 2)}
      </pre>
    </div>
  );
}

export default {
  id: "diagram05",
  label: "Diagrammen (0.5)",
  icon: <IconDiagram />,
  groep: "modelleren",
  status: "preview",
  Provider: Diagram05Provider,
  Sidebar: Diagram05Sidebar,
  Main: Diagram05Main,
  Inspector: Diagram05Inspector,
  sidebarLabel: "Diagrammen",
  inspectorLabel: "Element",
  menus: [
    {
      id: "diagram05",
      label: "Diagram (0.5)",
      items: [
        {
          id: "d05-herlaad",
          label: "Herlaad uit UML-model",
          onClick: () => menuBus.emit("diagram05:herlaad"),
        },
      ],
    },
  ],
};
