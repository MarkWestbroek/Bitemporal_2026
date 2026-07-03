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
  useRef,
  lazy,
  Suspense,
} from "react";
import { IconDiagram } from "../icons";
import { menuBus } from "../menuBus";
import useModelStore from "../../store/useModelStore";
import useUIStore from "../../store/useUIStore";
import { createDiagramStore } from "../../diagramcore/model/createDiagramStore.js";
import { UITLIJN_MODES } from "../../diagramcore/layout/uitlijnen.js";
import { ANKER_PREFIX } from "../../diagramcore/canvas/materialiseerConnectoren.js";
import { UITLIJN_ICONEN } from "../../diagramcore/taskbar/uitlijnIcons.jsx";
import { Taskbar, useTaakbalkVoorkeuren, leesTaakbalkVoorkeuren } from "../../diagramcore/taskbar/Taskbar.jsx";
import ElementInspector from "../../diagramcore/inspector/ElementInspector.jsx";
import {
  registreerCanoniekUml,
  canoniekUmlDiagramType,
  maakElement,
} from "../../diagramprofielen/canoniek-uml/index.js";
import { registreerCanoniekUmlImplementaties } from "../../diagramprofielen/canoniek-uml/implementaties.jsx";
import { vanCanoniekModel } from "../../diagramprofielen/canoniek-uml/adapter.js";

const DiagramCanvas = lazy(() => import("../../diagramcore/canvas/DiagramCanvas.jsx"));

registreerCanoniekUml();
registreerCanoniekUmlImplementaties();

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
  // Daarna altijd de undo-history wissen: de persist-rehydratie telt anders
  // als eerste undo-stap, waardoor ver terug-undo'en het canvas leegmaakte
  // (eerst de connectoren, dan alles).
  useEffect(() => {
    if (Object.keys(useDiagram05Store.getState().elements).length === 0) herlaad(false);
    useDiagram05Store.temporal.getState().clear();
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

const TAAKBALK_SLEUTEL = "studio05-taakbalken-canoniek-uml";

/** Vers uit localStorage, zodat menu-checkmarks kloppen bij elke menu-opbouw. */
const taakbalkZichtbaar = (balkId) =>
  leesTaakbalkVoorkeuren(TAAKBALK_SLEUTEL, TAAKBALK_DEFAULTS)[balkId]?.zichtbaar ?? true;

const TAAKBALK_DEFAULTS = {
  maken: { zichtbaar: true, positie: { x: 12, y: 12 } },
  verbinding: { zichtbaar: true, positie: { x: 12, y: 300 } },
  "auto-layout": { zichtbaar: true, positie: { x: 150, y: 12 } },
  uitlijnen: { zichtbaar: true, positie: { x: 12, y: 430 } },
};

function Diagram05Main() {
  const { selectieId, setSelectieId, verbindingsType, setVerbindingsType, plaatsNieuwElement, verbind } =
    useContext(Ctx);
  const theme = useUIStore((s) => s.theme);

  // Spiegel het studio-thema naar body[data-ide-theme] zolang deze activiteit
  // actief is: hergebruikte umleditor-componenten (o.a. de CEL-ExpressieEditor)
  // hebben hun licht-thema-overrides op dat attribuut. IdePage doet dit zelf
  // maar verwijdert het attribuut bij unmount (activiteit-wissel); daarom hier
  // opnieuw zetten. Bewust geen cleanup: een volgende activiteit zet hem zelf.
  useEffect(() => {
    document.body.setAttribute("data-ide-theme", theme);
  }, [theme]);
  const elements = useDiagram05Store((s) => s.elements);
  const diagrams = useDiagram05Store((s) => s.diagrams);
  const viewports = useDiagram05Store((s) => s.viewports);
  const actief = useDiagram05Store((s) => s.actiefDiagramId);
  const isDirty = useDiagram05Store((s) => s.isDirty);
  // Fallback: na undo van "nieuw diagram" kan het actieve id verdwenen zijn.
  const diagram = (actief && diagrams[actief]) || Object.values(diagrams)[0] || null;

  const { voorkeuren, zetZichtbaar, zetPositie, zetBreedte } = useTaakbalkVoorkeuren(
    TAAKBALK_SLEUTEL,
    TAAKBALK_DEFAULTS
  );

  // Imperatieve layout-API van de canvas (uitlijnen/snap/auto-layout).
  const layoutApiRef = useRef(null);

  // Menubalk → layout-acties (Diagram (0.5) → Uitlijnen ▸ / Auto-layout).
  useEffect(() => {
    const af = [
      menuBus.on("d05:layout", (mode) => {
        if (mode === "snap") layoutApiRef.current?.snapRaster();
        else layoutApiRef.current?.lijnUit(mode);
      }),
      menuBus.on("d05:auto-layout", ({ id, selectie } = {}) => {
        const strategie = (canoniekUmlDiagramType.layouts || []).find(
          (l) => l.id === (id || canoniekUmlDiagramType.layouts?.[0]?.id)
        );
        if (strategie) layoutApiRef.current?.voerLayoutUit(strategie, !!selectie);
      }),
    ];
    return () => af.forEach((off) => off());
  }, []);

  // Taakbalk-toggles vanuit het menu (Diagram (0.5) → Taakbalken ▸).
  useEffect(() => {
    return menuBus.on("d05:taakbalk-toggle", (balkId) => {
      zetZichtbaar(balkId, !(voorkeuren[balkId]?.zichtbaar ?? true));
      // Menubalk opnieuw laten opbouwen zodat het vinkje klopt (StudioShell
      // luistert generiek op "menu:ververs").
      setTimeout(() => menuBus.emit("menu:ververs"), 0);
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
    } else if (balk.acties === "layouts") {
      acties = (canoniekUmlDiagramType.layouts || []).map((strategie) => ({
        id: strategie.id,
        label: strategie.label,
        titel: `${strategie.label} (heel diagram)`,
        onClick: () => layoutApiRef.current?.voerLayoutUit(strategie, false),
      }));
    }
    return { ...balk, actieLijst: acties };
  });

  // Core-taakbalk "Uitlijnen" (plan §4.5/§4.6): pure geometrie, bij élk
  // diagramtype beschikbaar — staat daarom buiten de DiagramType-configuratie.
  taakbalken.push({
    id: "uitlijnen",
    label: "Uitlijnen",
    actieLijst: UITLIJN_MODES.flatMap((m, i) => {
      const knop = {
        id: m.mode,
        label: m.label,
        icoon: UITLIJN_ICONEN[m.mode],
        titel: `${m.titel} (selectie — Ctrl+klik)`,
        onClick: () => layoutApiRef.current?.lijnUit(m.mode),
      };
      // Groepen: verticaal (3) | horizontaal (3) | ruimtelijk (verdelen+raster)
      return i === 3 || i === 6 ? [{ id: `sep-${i}`, sep: true }, knop] : [knop];
    }).concat([
      { id: "snap", label: "▦", icoon: UITLIJN_ICONEN.snap, titel: "Alles op raster", onClick: () => layoutApiRef.current?.snapRaster() },
    ]),
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
                selectieId={selectieId}
                onSelectElement={(el) => setSelectieId(el?.id || null)}
                onNodePositie={(elementId, positie) => {
                  const s = useDiagram05Store.getState();
                  if (elementId.startsWith(ANKER_PREFIX)) {
                    // Anker van een gematerialiseerde connector versleept
                    s.updateAnkerPosition(diagram.id, elementId.slice(ANKER_PREFIX.length), positie);
                  } else if (!s.diagrams[diagram.id]?.nodes.some((n) => n.elementId === elementId)) {
                    // Auto-geplaatste connector-box voor het eerst versleept →
                    // lidmaatschap aanmaken zodat de positie persistent wordt
                    s.addElementToDiagram(diagram.id, elementId, positie);
                  } else {
                    s.updateNodePosition(diagram.id, elementId, positie);
                  }
                }}
                onNodePosities={(posities) => {
                  const s = useDiagram05Store.getState();
                  const rest = {};
                  for (const [pid, pos] of Object.entries(posities)) {
                    if (pid.startsWith(ANKER_PREFIX)) {
                      s.updateAnkerPosition(diagram.id, pid.slice(ANKER_PREFIX.length), pos);
                    } else {
                      rest[pid] = pos;
                    }
                  }
                  s.updateNodePositions(diagram.id, rest);
                }}
                layoutApiRef={layoutApiRef}
                onNodeSize={(elementId, size) =>
                  useDiagram05Store.getState().updateNodeSize(diagram.id, elementId, size)
                }
                onVerbind={verbind}
                onVerwijder={(ids) => {
                  const s = useDiagram05Store.getState();
                  ids.forEach((id) => {
                    if (id.startsWith(ANKER_PREFIX)) {
                      // Delete op het anker = de connector zelf verwijderen
                      s.deleteElement(id.slice(ANKER_PREFIX.length));
                      return;
                    }
                    const el = s.elements[id];
                    if (el && elementTypesById[el.elementType]?.isConnector) {
                      s.deleteElement(id); // connector-box → connector weg
                    } else {
                      s.removeElementFromDiagram(diagram.id, id);
                    }
                  });
                }}
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
                  breedte={voorkeuren[b.id]?.breedte}
                  onPositie={(p) => zetPositie(b.id, p)}
                  onBreedte={(breedte) => zetBreedte(b.id, breedte)}
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
  const diagrams = useDiagram05Store((s) => s.diagrams);
  const editorContext = React.useMemo(() => ({ elements, diagrams }), [elements, diagrams]);

  // Kandidaten via de ReferenceResolvers van het profiel (plan §4.5b):
  // de inspector vraagt per PropertyType met referenceTypes de kandidaten op
  // (keuzelijst + minibrowser gebruiken dezelfde resolvers).
  const kandidatenVoor = useCallback(
    (referenceTypeIds) => {
      const resolvers = canoniekUmlDiagramType.referenceResolvers || {};
      return (referenceTypeIds || []).flatMap((id) =>
        resolvers[id] ? resolvers[id]({ elements }) : []
      );
    },
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
        kandidatenVoor={kandidatenVoor}
        editorContext={editorContext}
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
  menus: () => [
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
        { id: "d05-auto", label: "Auto-layout (heel diagram)", onClick: () => menuBus.emit("d05:auto-layout", { selectie: false }) },
        { id: "d05-auto-sel", label: "Auto-layout (selectie)", onClick: () => menuBus.emit("d05:auto-layout", { selectie: true }) },
        { id: "d05-snap", label: "Uitlijnen op raster", onClick: () => menuBus.emit("d05:layout", "snap") },
        {
          id: "d05-uitlijnen",
          label: "Uitlijnen (selectie)",
          items: [
            { id: "d05-align-left", label: "Links", onClick: () => menuBus.emit("d05:layout", "left") },
            { id: "d05-align-right", label: "Rechts", onClick: () => menuBus.emit("d05:layout", "right") },
            { id: "d05-align-top", label: "Boven", onClick: () => menuBus.emit("d05:layout", "top") },
            { id: "d05-align-bottom", label: "Onder", onClick: () => menuBus.emit("d05:layout", "bottom") },
            { type: "separator" },
            { id: "d05-align-ch", label: "Horizontaal centreren", onClick: () => menuBus.emit("d05:layout", "center-h") },
            { id: "d05-align-cv", label: "Verticaal centreren", onClick: () => menuBus.emit("d05:layout", "center-v") },
            { type: "separator" },
            { id: "d05-dist-h", label: "Horizontaal verdelen", onClick: () => menuBus.emit("d05:layout", "distribute-h") },
            { id: "d05-dist-v", label: "Verticaal verdelen", onClick: () => menuBus.emit("d05:layout", "distribute-v") },
          ],
        },
        { type: "separator" },
        {
          id: "d05-taakbalken",
          label: "Taakbalken",
          items: [
            ["maken", "Maken"],
            ["verbinding", "Verbinding"],
            ["auto-layout", "Auto-layout"],
            ["uitlijnen", "Uitlijnen"],
          ].map(([balkId, label]) => ({
            id: `d05-tb-${balkId}`,
            label,
            checked: taakbalkZichtbaar(balkId),
            onClick: () => menuBus.emit("d05:taakbalk-toggle", balkId),
          })),
        },
      ],
    },
  ],
};
