/**
 * IdePage — Hoofd-IDE pagina met FlexLayout docking layout.
 *
 * Layout: ProjectBrowser (links) | DiagramCanvas (midden) | DetailsPanel (rechts)
 * Alle panels zijn verplaatsbaar, resizable en dockable (Eclipse-stijl).
 *
 * Laadt bij opstart het nieuwste V3 model uit de database (net als EditorV2Page)
 * en zet het om naar de Zustand store via v3ModelNaarStore().
 */
import { useEffect, useCallback, useRef, useState } from "react";
import * as FlexLayout from "flexlayout-react";
import "flexlayout-react/style/dark.css";

import useModelStore from "../store/useModelStore";
import useUIStore from "../store/useUIStore";
import { v3ModelNaarStore, exportStoreAsJson, importStoreFromJson } from "../store/adapters";
import { demoV3Model } from "../demoV3Model";
import {
  createLayoutModel,
  persistLayout,
  openDiagramTab,
  COMP_BROWSER,
  COMP_DIAGRAM,
  COMP_PROPERTIES,
} from "../ide/layoutConfig";
import ProjectBrowser from "../ide/ProjectBrowser";
import DiagramCanvas from "../ide/DiagramCanvas";
import DetailsPanel from "../ide/DetailsPanel";
import ErrorBoundary from "../ide/ErrorBoundary";

function apiBase() {
  return window.location.port === "5174" ? "http://localhost:8082" : "";
}

export default function IdePage() {
  const loadModel = useModelStore((s) => s.loadModel);
  const addDiagram = useModelStore((s) => s.addDiagram);
  const modelMeta = useModelStore((s) => s.modelMeta);
  const elements = useModelStore((s) => s.elements);
  const [layoutModel] = useState(() => createLayoutModel());
  const [status, setStatus] = useState("laden…");
  const loadedRef = useRef(false);

  // ── Bij opstart: laad model ──────────────────────────────
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    // Als er al data in de store zit (via persist), gebruik die
    const current = useModelStore.getState();
    if (current.elements && Object.keys(current.elements).length > 0) {
      setStatus(`Hersteld uit lokale opslag (${Object.keys(current.elements).length} elementen)`);
      return;
    }

    // Probeer nieuwste model uit DB
    const base = apiBase();
    fetch(`${base}/api/schema/versies`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((versies) => {
        if (!Array.isArray(versies) || versies.length === 0) {
          throw new Error("Geen versies in database");
        }
        const nieuwste = versies[0];
        return fetch(`${base}${nieuwste.model_url}`).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        });
      })
      .then((response) => {
        const storeData = v3ModelNaarStore(response);
        loadModel(storeData);
        const id = response?.id || "?";
        setStatus(`Geladen uit DB (model #${id}, ${Object.keys(storeData.elements).length} elementen)`);
      })
      .catch((err) => {
        console.warn("DB niet bereikbaar, laad demo-model:", err.message);
        const storeData = v3ModelNaarStore(demoV3Model);
        loadModel(storeData);
        setStatus(`Demo-model (${Object.keys(storeData.elements).length} elementen)`);
      });
  }, [loadModel]);

  // ── Herlaad model uit DB (forceert verse fetch) ──────────
  const handleHerlaad = useCallback(() => {
    const base = apiBase();
    setStatus("Herladen…");
    fetch(`${base}/api/schema/versies`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((versies) => {
        if (!Array.isArray(versies) || versies.length === 0) throw new Error("Geen versies");
        const nieuwste = versies[0];
        return fetch(`${base}${nieuwste.model_url}`).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        });
      })
      .then((response) => {
        const storeData = v3ModelNaarStore(response);
        loadModel(storeData);
        const id = response?.id || "?";
        setStatus(`Herlaad uit DB (model #${id}, ${Object.keys(storeData.elements).length} elementen)`);
      })
      .catch((err) => {
        console.warn("Herlaad mislukt:", err.message);
        const storeData = v3ModelNaarStore(demoV3Model);
        loadModel(storeData);
        setStatus(`Demo-model (herlaad, ${Object.keys(storeData.elements).length} elementen)`);
      });
  }, [loadModel]);

  // ── Layout persistentie ──────────────────────────────────
  const handleLayoutChange = useCallback(
    (_action) => {
      persistLayout(layoutModel);
    },
    [layoutModel]
  );

  // ── Nieuw diagram aanmaken ───────────────────────────────
  const handleNieuwDiagram = useCallback(
    (voorgesteldeNaam) => {
      const naam = window.prompt("Naam van het nieuwe diagram:", voorgesteldeNaam || "Nieuw diagram");
      if (!naam) return;

      const bestaand = useModelStore.getState().diagrams || {};
      const basisId = maakDiagramId(naam);
      let diagramId = basisId;
      let teller = 2;
      while (bestaand[diagramId]) {
        diagramId = `${basisId}_${teller}`;
        teller += 1;
      }

      addDiagram({
        id: diagramId,
        naam,
        domein: null,
        nodes: [],
        edges: [],
        viewport: null,
      });
      openDiagramTab(layoutModel, diagramId, naam);
      setStatus(`Nieuw diagram aangemaakt: ${naam}`);
    },
    [addDiagram, layoutModel]
  );

  // ── Diagram tab openen (vanuit ProjectBrowser) ───────────
  const handleOpenDiagram = useCallback(
    (diagramId, naam) => {
      openDiagramTab(layoutModel, diagramId, naam);
    },
    [layoutModel]
  );

  // ── Export ────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const state = useModelStore.getState();
    const json = exportStoreAsJson(state);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ide-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Import ────────────────────────────────────────────────
  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);

        // IDE-format of V3-format?
        if (json._format === "ide-v1") {
          loadModel(importStoreFromJson(json));
          setStatus(`IDE export geladen (${Object.keys(json.elements || {}).length} elementen)`);
        } else if (json.model?.versie === "v3" || json.versie === "v3") {
          const storeData = v3ModelNaarStore(json);
          loadModel(storeData);
          setStatus(`V3 model geïmporteerd (${Object.keys(storeData.elements).length} elementen)`);
        } else {
          alert("Onbekend bestandsformat. Verwacht IDE JSON of V3 model JSON.");
        }
      } catch (err) {
        alert(`Import mislukt: ${err.message}`);
      }
    };
    input.click();
  }, [loadModel]);

  // ── Factory: bepaalt welk component in welke tab ─────────
  const factory = useCallback(
    (node) => {
      const component = node.getComponent();
      const config = node.getConfig() || {};

      switch (component) {
        case COMP_BROWSER:
          return <ErrorBoundary label="ProjectBrowser"><ProjectBrowser onOpenDiagram={handleOpenDiagram} onCreateDiagram={handleNieuwDiagram} /></ErrorBoundary>;
        case COMP_DIAGRAM:
          return <ErrorBoundary label="DiagramCanvas"><DiagramCanvas diagramId={config.diagramId || "overzicht"} /></ErrorBoundary>;
        case COMP_PROPERTIES:
          return <ErrorBoundary label="DetailsPanel"><DetailsPanel /></ErrorBoundary>;
        default:
          return <div style={{ padding: 16 }}>Onbekend component: {component}</div>;
      }
    },
    [handleNieuwDiagram, handleOpenDiagram]
  );

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#1e1e1e",
        color: "#ccc",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "4px 12px",
          background: "#2d2d2d",
          borderBottom: "1px solid #444",
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        <strong style={{ color: "#8cb4ff" }}>🏗 IDE</strong>
        <span style={{ color: "#888" }}>|</span>
        <span style={{ color: "#aaa" }}>{status}</span>
        <span style={{ flex: 1 }} />
        <button onClick={() => handleNieuwDiagram()} style={toolbarBtn}>
          ➕ Diagram
        </button>
        <button onClick={handleHerlaad} style={toolbarBtn}>
          🔄 Herlaad
        </button>
        <button onClick={handleImport} style={toolbarBtn}>
          📂 Importeer
        </button>
        <button onClick={handleExport} style={toolbarBtn}>
          💾 Exporteer
        </button>
      </div>

      {/* FlexLayout */}
      <div style={{ flex: 1, position: "relative" }}>
        <FlexLayout.Layout
          model={layoutModel}
          factory={factory}
          onModelChange={handleLayoutChange}
        />
      </div>
    </div>
  );
}

function maakDiagramId(naam) {
  return (
    String(naam || "diagram")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "diagram"
  );
}

const toolbarBtn = {
  background: "#3c3c3c",
  color: "#ccc",
  border: "1px solid #555",
  borderRadius: 3,
  padding: "3px 10px",
  cursor: "pointer",
  fontSize: 12,
};
