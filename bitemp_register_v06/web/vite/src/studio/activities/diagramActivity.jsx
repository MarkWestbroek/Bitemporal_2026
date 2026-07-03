/**
 * diagramActivity — "Diagrammen (0.5)": de generieke diagram-motor (diagramcore)
 * als preview-activiteit, parallel naast de bestaande UML-IDE.
 *
 * Fase 2 (bewerken, zie docs/STUDIO-05-diagramcore-plan.md §7): de activiteit
 * is een **bewerkbare sandbox** met eigen persistente store
 * (localStorage "studio05-canoniek-uml") en undo/redo:
 *  - elementen maken via de "Maken"-taakbalk, verbinden via "Verbinding"
 *    (verbindingsregels uit het DiagramType),
 *  - velden bewerken via de gegenereerde inspector (FieldType.editor),
 *  - multi-diagram (aanmaken/hernoemen/verwijderen in de sidebar).
 *
 * Het UML-model wordt alleen op verzoek ingeladen ("Herlaad uit UML-model");
 * er wordt nooit naar het UML-model teruggeschreven (serialisatie = fase 4).
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
import { Taskbar, useTaakbalkVoorkeuren } from "../../diagramcore/taskbar/Taskbar.jsx";
import ElementInspector from "../../diagramcore/inspector/ElementInspector.jsx";
import {
  registreerCanoniekUml,
  canoniekUmlDiagramType,
  maakElement,
} from "../../diagramprofielen/canoniek-uml/index.js";
import { vanCanoniekModel } from "../../diagramprofielen/canoniek-uml/adapter.js";

const DiagramCanvas = lazy(() => import("../../diagramcore/canvas/DiagramCanvas.jsx"));

registreerCanoniekUml();

/** Bewerkbare sandbox-store, persistent per profiel. */
const useDiagram05Store = createDiagramStore({ persistKey: "studio05-canoniek-uml" });

const fieldTypesById = Object.fromEntries(
  (canoniekUmlDiagramType.fieldTypes || []).map((ft) => [ft.id, ft])
);
const elementTypesById = Object.fromEntries(
  canoniekUmlDiagramType.elementTypes.map((et) => [et.id, et])
);

let _connTeller = 0;
let _plaatsTeller = 0;

const Ctx = createContext(null);

function Diagram05Provider({ children }) {
  const [selectieId, setSelectieId] = useState(null);
  const [verbindingsType, setVerbindingsType] = useState(null);

  /** Spiegel het UML-model in de sandbox (vervangt alles). */
  const herlaad = useCallback((vraagBevestiging = true) => {
    const s = useDiagram05Store.getState();
    const heeftInhoud = Object.keys(s.elements).length > 0;
    if (vraagBevestiging && heeftInhoud && s.isDirty) {
      const ok = window.confirm(
        "Herladen vervangt de hele 0.5-sandbox door het actuele UML-model.\nJe lokale wijzigingen gaan verloren. Doorgaan?"
      );
      if (!ok) return;
    }
    s.laadModel(vanCanoniekModel(useModelStore.getState()));
    useDiagram05Store.temporal.getState().clear();
    setSelectieId(null);
  }, []);

  // Eerste keer: alleen laden als de (persistente) sandbox nog leeg is.
  useEffect(() => {
    if (Object.keys(useDiagram05Store.getState().elements).length === 0) herlaad(false);
  }, [herlaad]);

  // Menubalk-acties via de menuBus.
  useEffect(() => {
    const af = [
      menuBus.on("d05:herlaad", () => herlaad(true)),
      menuBus.on("d05:undo", () => useDiagram05Store.temporal.getState().undo()),
      menuBus.on("d05:redo", () => useDiagram05Store.temporal.getState().redo()),
      menuBus.on("d05:nieuw-diagram", () => {
        const naam = window.prompt("Naam van het nieuwe diagram:", "Nieuw diagram");
        if (!naam) return;
        useDiagram05Store.getState().addDiagram({
          id: `d05_${Date.now()}`,
          naam,
          diagramType: canoniekUmlDiagramType.id,
        });
      }),
    ];
    return () => af.forEach((off) => off());
  }, [herlaad]);

  /** Nieuw element plaatsen op het actieve diagram (cascade rond het zwaartepunt). */
  const plaatsNieuwElement = useCallback((elementTypeId) => {
    const el = maakElement(elementTypeId);
    if (!el) return;
    const s = useDiagram05Store.getState();
    const dId = s.actiefDiagramId;
    if (!dId) return;
    const nodes = s.diagrams[dId]?.nodes || [];
    _plaatsTeller += 1;
    let positie = { x: 120, y: 120 };
    if (nodes.length > 0) {
      const som = nodes.reduce(
        (acc, n) => ({ x: acc.x + n.position.x, y: acc.y + n.position.y }),
        { x: 0, y: 0 }
      );
      positie = {
        x: som.x / nodes.length + 60 + (_plaatsTeller % 4) * 36,
        y: som.y / nodes.length + 60 + (_plaatsTeller % 4) * 36,
      };
    }
    s.addElement(el);
    s.addElementToDiagram(dId, el.id, positie);
    setSelectieId(el.id);
  }, []);

  /** Nieuwe connector (edge-drag op de canvas, regels al gecheckt). */
  const verbind = useCallback(({ connectorType, source, target, sourceHandle, targetHandle }) => {
    _connTeller += 1;
    useDiagram05Store.getState().addElement({
      id: `conn_${Date.now()}_${_connTeller}`,
      naam: "",
      elementType: connectorType.id,
      source,
      target,
      compartimenten: [],
      data: { sourceHandle, targetHandle },
    });
  }, []);

  return (
    <Ctx.Provider
      value={{
        selectieId,
        setSelectieId,
        verbindingsType,
        setVerbindingsType,
        herlaad,
        plaatsNieuwElement,
        verbind,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

function Diagram05Sidebar() {
  const diagrams = useDiagram05Store((s) => s.diagrams);
  const actief = useDiagram05Store((s) => s.actiefDiagramId);
  const setActief = useDiagram05Store((s) => s.setActiefDiagram);
  const elements = useDiagram05Store((s) => s.elements);
  const { herlaad } = useContext(Ctx);
  const lijst = Object.values(diagrams);

  const hernoem = (d) => {
    const naam = window.prompt("Nieuwe naam:", d.naam);
    if (naam) useDiagram05Store.getState().renameDiagram(d.id, naam);
  };
  const verwijder = (d) => {
    if (window.confirm(`Diagram "${d.naam}" verwijderen? (Elementen blijven in het model.)`)) {
      useDiagram05Store.getState().deleteDiagram(d.id);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontSize: 13 }}>
      <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--s-border)" }}>
        <button
          className="dc-mini-knop"
          style={{ width: "100%" }}
          onClick={() => menuBus.emit("d05:nieuw-diagram")}
        >
          ＋ Nieuw diagram
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 6 }}>
        {lijst.length === 0 && (
          <p style={{ margin: 8, color: "var(--s-fg-muted)" }}>
            Nog geen diagrammen — maak er een met ＋, of haal het UML-model op via ⟳.
          </p>
        )}
        {lijst.map((d) => (
          <div
            key={d.id}
            onClick={() => setActief(d.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 8px",
              marginBottom: 2,
              borderRadius: 6,
              cursor: "pointer",
              color: "var(--s-fg)",
              background: d.id === actief ? "var(--s-hover)" : "transparent",
              border: `1px solid ${d.id === actief ? "var(--s-border)" : "transparent"}`,
            }}
          >
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              📐 {d.naam}
            </span>
            <span style={{ color: "var(--s-fg-muted)", fontSize: 11 }}>{d.nodes.length}</span>
            {d.id === actief && (
              <>
                <button className="dc-mini-knop" title="Hernoemen" onClick={(e) => { e.stopPropagation(); hernoem(d); }}>
                  ✎
                </button>
                <button className="dc-mini-knop is-gevaar" title="Verwijderen" onClick={(e) => { e.stopPropagation(); verwijder(d); }}>
                  ×
                </button>
              </>
            )}
          </div>
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
          className="dc-mini-knop"
          onClick={() => herlaad(true)}
          title="Herlaad uit UML-model (vervangt de sandbox)"
        >
          ⟳ herlaad
        </button>
      </div>
    </div>
  );
}

const TAAKBALK_DEFAULTS = {
  maken: { zichtbaar: true, positie: { x: 12, y: 12 } },
  verbinding: { zichtbaar: true, positie: { x: 12, y: 260 } },
};

function Diagram05Main() {
  const { setSelectieId, verbindingsType, setVerbindingsType, plaatsNieuwElement, verbind } =
    useContext(Ctx);
  const elements = useDiagram05Store((s) => s.elements);
  const diagrams = useDiagram05Store((s) => s.diagrams);
  const viewports = useDiagram05Store((s) => s.viewports);
  const actief = useDiagram05Store((s) => s.actiefDiagramId);
  const isDirty = useDiagram05Store((s) => s.isDirty);
  // Fallback: na undo van "nieuw diagram" kan het actieve id verdwenen zijn.
  const diagram = (actief && diagrams[actief]) || Object.values(diagrams)[0] || null;

  const { voorkeuren, zetZichtbaar, zetPositie } = useTaakbalkVoorkeuren(
    "studio05-taakbalken-canoniek-uml",
    TAAKBALK_DEFAULTS
  );

  // Taakbalk-toggles vanuit het menu (Diagram (0.5) → Taakbalken ▸).
  useEffect(() => {
    return menuBus.on("d05:taakbalk-toggle", (balkId) => {
      zetZichtbaar(balkId, !(voorkeuren[balkId]?.zichtbaar ?? true));
    });
  }, [voorkeuren, zetZichtbaar]);

  // Sneltoetsen: Ctrl+Z / Ctrl+Y (Delete doet React Flow zelf).
  useEffect(() => {
    const onKey = (e) => {
      const doel = e.target;
      if (doel && (doel.tagName === "INPUT" || doel.tagName === "TEXTAREA" || doel.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        useDiagram05Store.temporal.getState().undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        useDiagram05Store.temporal.getState().redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Taakbalken uit de DiagramType-descriptor (§4.6): acties afgeleid.
  const taakbalken = (canoniekUmlDiagramType.taakbalken || []).map((balk) => {
    let acties = [];
    if (balk.acties === "elementTypes") {
      acties = canoniekUmlDiagramType.elementTypes
        .filter((et) => !et.isConnector && et.kort)
        .map((et) => ({
          id: et.id,
          label: et.kort,
          titel: `Nieuw: ${et.label}`,
          onClick: () => plaatsNieuwElement(et.id),
        }));
    } else if (balk.acties === "connectorTypes") {
      acties = canoniekUmlDiagramType.elementTypes
        .filter((et) => et.isConnector)
        .map((et) => ({
          id: et.id,
          label: `${et.kort} ${et.label}`,
          titel: `Verbindingsmodus: ${et.label} (klik nogmaals voor automatisch)`,
          actief: verbindingsType === et.id,
          onClick: () => setVerbindingsType(verbindingsType === et.id ? null : et.id),
        }));
    }
    return { ...balk, actieLijst: acties };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="dc-preview-strook">
        <span className="dc-preview-badge">0.5 preview</span>
        <span>
          Bewerkbare sandbox — wijzigingen blijven lokaal en raken het UML-model niet.
          {isDirty ? " ●" : ""}
        </span>
        <span style={{ marginLeft: "auto" }}>{diagram?.naam || ""}</span>
      </div>
      <div className="studio-paper" style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {diagram ? (
          <>
            <Suspense fallback={<div style={{ padding: 16, color: "#64748b" }}>Canvas laden…</div>}>
              <DiagramCanvas
                diagramType={canoniekUmlDiagramType}
                elements={elements}
                diagram={diagram}
                viewport={viewports[diagram.id] || null}
                bewerkbaar
                verbindingsType={verbindingsType}
                onSelectElement={(el) => setSelectieId(el?.id || null)}
                onNodePositie={(elementId, positie) =>
                  useDiagram05Store.getState().updateNodePosition(diagram.id, elementId, positie)
                }
                onNodeSize={(elementId, size) =>
                  useDiagram05Store.getState().updateNodeSize(diagram.id, elementId, size)
                }
                onVerbind={verbind}
                onVerwijder={(ids) =>
                  ids.forEach((id) =>
                    useDiagram05Store.getState().removeElementFromDiagram(diagram.id, id)
                  )
                }
                onVerwijderConnectoren={(connectorIds) =>
                  connectorIds.forEach((id) => useDiagram05Store.getState().deleteElement(id))
                }
                onViewport={(vp) =>
                  useDiagram05Store.getState().updateDiagramViewport(diagram.id, vp)
                }
              />
            </Suspense>
            {taakbalken
              .filter((b) => voorkeuren[b.id]?.zichtbaar ?? true)
              .map((b) => (
                <Taskbar
                  key={b.id}
                  label={b.label || b.id}
                  acties={b.actieLijst}
                  positie={voorkeuren[b.id]?.positie || { x: 12, y: 12 }}
                  onPositie={(p) => zetPositie(b.id, p)}
                />
              ))}
          </>
        ) : (
          <div style={{ padding: 24, color: "#64748b" }}>
            Geen diagram geselecteerd — kies of maak er een in het linkerpaneel.
          </div>
        )}
      </div>
    </div>
  );
}

function Diagram05Inspector() {
  const { selectieId, setSelectieId } = useContext(Ctx);
  const element = useDiagram05Store((s) => (selectieId ? s.elements[selectieId] : null));
  const actief = useDiagram05Store((s) => s.actiefDiagramId);
  const elements = useDiagram05Store((s) => s.elements);

  // Type-keuzelijst via de VerwijzingsBronnen van het profiel (plan §4.5b):
  // basistypen + gegevenstypen ✦ + enumeraties ◇ + ref.lijstitems ▣,
  // gegroepeerd per bron (optgroups; later dezelfde bronnen in de minibrowser).
  const widgetContext = React.useMemo(
    () => ({
      veldtypen: (canoniekUmlDiagramType.verwijzingsBronnen || []).flatMap((bron) =>
        bron.kandidaten({ elements })
      ),
    }),
    [elements]
  );

  if (!element) {
    return (
      <div className="studio-inspector-pad" style={{ color: "var(--s-fg-muted)", fontSize: 13 }}>
        Selecteer een element op het canvas om het te bewerken. Nieuwe elementen maak je met de
        &ldquo;Maken&rdquo;-taakbalk; verbindingen sleep je tussen de aansluitpunten (kies eventueel
        eerst een type in &ldquo;Verbinding&rdquo;).
      </div>
    );
  }

  const elementType = elementTypesById[element.elementType];
  return (
    <div className="studio-inspector-pad">
      <ElementInspector
        element={element}
        elementType={elementType}
        fieldTypesById={fieldTypesById}
        widgetContext={widgetContext}
        bewerkbaar
        onUpdate={(patch) => useDiagram05Store.getState().updateElement(element.id, patch)}
        onVerwijderVanDiagram={() => {
          if (actief) useDiagram05Store.getState().removeElementFromDiagram(actief, element.id);
          setSelectieId(null);
        }}
        onVerwijderUitModel={() => {
          if (window.confirm(`"${element.naam || element.id}" uit het hele model verwijderen?`)) {
            useDiagram05Store.getState().deleteElement(element.id);
            setSelectieId(null);
          }
        }}
      />
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
      id: "bewerken",
      label: "Bewerken",
      items: [
        { id: "d05-undo", label: "Ongedaan maken", shortcut: "Ctrl+Z", onClick: () => menuBus.emit("d05:undo") },
        { id: "d05-redo", label: "Opnieuw", shortcut: "Ctrl+Y", onClick: () => menuBus.emit("d05:redo") },
      ],
    },
    {
      id: "diagram05",
      label: "Diagram (0.5)",
      items: [
        { id: "d05-nieuw-diagram", label: "Nieuw diagram…", onClick: () => menuBus.emit("d05:nieuw-diagram") },
        { id: "d05-herlaad", label: "Herlaad uit UML-model…", onClick: () => menuBus.emit("d05:herlaad") },
        { type: "separator" },
        {
          id: "d05-taakbalken",
          label: "Taakbalken",
          items: [
            { id: "d05-tb-maken", label: "Maken", onClick: () => menuBus.emit("d05:taakbalk-toggle", "maken") },
            { id: "d05-tb-verbinding", label: "Verbinding", onClick: () => menuBus.emit("d05:taakbalk-toggle", "verbinding") },
          ],
        },
      ],
    },
  ],
};
