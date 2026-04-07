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
import { v3ModelNaarStore, exportStoreAsJson, importStoreFromJson, storeNaarV3Model } from "../store/adapters";
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
import ActionDialog from "../ide/ActionDialog";
import ErrorBoundary from "../ide/ErrorBoundary";

const DEFAULT_MODEL_VERSIE = "v0.";
const DEFAULT_INDIENER = "MW";

function apiBase() {
  return window.location.port === "5174" ? "http://localhost:8082" : "";
}

export default function IdePage() {
  const loadModel = useModelStore((s) => s.loadModel);
  const addDiagram = useModelStore((s) => s.addDiagram);
  const modelMeta = useModelStore((s) => s.modelMeta);
  const elements = useModelStore((s) => s.elements);
  const isDirty = useModelStore((s) => s.isDirty);
  const markSaved = useModelStore((s) => s.markSaved);
  const [layoutModel] = useState(() => createLayoutModel());
  const [status, setStatus] = useState("laden…");
  const loadedRef = useRef(false);

  // ── Action Dialog state ──────────────────────────────────
  const [dialogType, setDialogType] = useState(null); // "publish" | "rebuild" | "publishAndRebuild" | null
  const [dialogValues, setDialogValues] = useState({});

  const openDialog = useCallback((type) => {
    const domains = useModelStore.getState().domains || [];
    const domainMeta = useModelStore.getState().domainMeta || {};
    const meta = useModelStore.getState().modelMeta || {};
    const actiefDomein = useUIStore.getState().actiefDomein || "";
    const base = apiBase();
    setDialogValues({
      versie: meta.versie || DEFAULT_MODEL_VERSIE,
      naam: actiefDomein || "",
      indiener: meta.indiener || DEFAULT_INDIENER,
      apiBase: base || "http://localhost:8082",
      rebuildApiBase: base || "http://localhost:8082",
      opmerking: "",
      bron: "editor",
      wachtwoord: "1234",
      schemaVersieID: "",
      beschikbareDomeinen: domains.map((d) => ({
        naam: d,
        prefix: domainMeta[d]?.prefix || "",
        mode: "register",
        geselecteerd: true,
      })),
    });
    setDialogType(type);
  }, []);

  const handleDialogChange = useCallback((key, value) => {
    setDialogValues((prev) => ({ ...prev, [key]: value }));
  }, []);

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

  // ── Export (IDE format) ────────────────────────────────────
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

  // ── Export V3 (download als bestand) ──────────────────────
  const handleExportV3 = useCallback(() => {
    const state = useModelStore.getState();
    const v3 = storeNaarV3Model(state);
    const blob = new Blob([JSON.stringify(v3, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `v3-model-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Publiceer naar API (proposed schema versie) ────────────
  const handlePubliceer = useCallback(() => {
    openDialog("publish");
  }, [openDialog]);

  // ── Rebuild (devloop: codegen + herstart) ─────────────────
  const handleRebuild = useCallback(() => {
    openDialog("rebuild");
  }, [openDialog]);

  // ── Publiceer + Rebuild gecombineerd ──────────────────────
  const handlePublishAndRebuild = useCallback(() => {
    openDialog("publishAndRebuild");
  }, [openDialog]);

  // ── Dialog submit: voert de actie uit op basis van dialogType ──
  const handleDialogSubmit = useCallback(async () => {
    const type = dialogType;
    const vals = dialogValues;
    setDialogType(null);

    const base = vals.apiBase || apiBase();
    const state = useModelStore.getState();
    const v3 = storeNaarV3Model(state);

    // ── Publiceer ──
    if (type === "publish" || type === "publishAndRebuild") {
      setStatus("Publiceren…");
      try {
        const queryParams = vals.opmerking ? `?opmerking=${encodeURIComponent(vals.opmerking)}` : "";
        const body = {
          bron: vals.indiener || DEFAULT_INDIENER,
          indiener: vals.indiener || DEFAULT_INDIENER,
          model: { ...v3.model, versie: vals.versie || DEFAULT_MODEL_VERSIE, naam: vals.naam || "" },
        };
        const resp = await fetch(`${base}/api/schema/model${queryParams}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
        }
        const result = await resp.json();
        markSaved();
        setStatus(`Gepubliceerd ✓ (versie #${result.id}, status: ${result.status})`);

        // Bij publishAndRebuild: ga door met rebuild
        if (type === "publishAndRebuild") {
          await doRebuild(vals, result.id);
        }
      } catch (err) {
        console.error("Publiceer fout:", err);
        setStatus(`Publicatie mislukt: ${err.message}`);
      }
      return;
    }

    // ── Alleen Rebuild ──
    if (type === "rebuild") {
      await doRebuild(vals);
    }
  }, [dialogType, dialogValues, markSaved]);

  // ── Rebuild helper ────────────────────────────────────────
  const doRebuild = useCallback(async (vals, schemaVersieID) => {
    const rebuildBase = vals.rebuildApiBase || vals.apiBase || apiBase();
    const wachtwoord = vals.wachtwoord || "1234";
    const state = useModelStore.getState();
    const v3 = storeNaarV3Model(state);

    // Bouw domeinen-payload
    const geselecteerdeDomeinen = (vals.beschikbareDomeinen || [])
      .filter((d) => d.geselecteerd)
      .map((d) => ({ naam: d.naam, prefix: d.prefix || "", mode: d.mode || "register" }));

    const body = {
      model: v3.model,
      domeinen: geselecteerdeDomeinen.length > 0 ? geselecteerdeDomeinen : [{ naam: "register", prefix: "", mode: "register" }],
    };
    if (schemaVersieID) body.schemaVersieID = schemaVersieID;

    setStatus("Rebuilden…");
    try {
      const resp = await fetch(`${rebuildBase}/admin/rebuild/${encodeURIComponent(wachtwoord)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
      }
      const result = await resp.json();
      if (result.status === "succesvol") {
        markSaved();
        setStatus(`Rebuild ✓ (${(result.stappen || []).length} stappen)`);
      } else {
        setStatus(`Rebuild fout: ${result.error || "onbekend"}`);
      }
    } catch (err) {
      console.error("Rebuild fout:", err);
      setStatus(`Rebuild mislukt: ${err.message}`);
    }
  }, [markSaved]);

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

  // ── Keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+S → Publiceer dialoog
      if (ctrl && e.key === "s") {
        e.preventDefault();
        handlePubliceer();
        return;
      }

      // Ctrl+Z → Undo
      if (ctrl && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        useModelStore.temporal.getState().undo();
        return;
      }

      // Ctrl+Shift+Z of Ctrl+Y → Redo
      if ((ctrl && e.shiftKey && e.key === "Z") || (ctrl && e.key === "y")) {
        e.preventDefault();
        useModelStore.temporal.getState().redo();
        return;
      }

      // F2 → Rename geselecteerd element of actief diagram
      if (e.key === "F2") {
        const selId = useUIStore.getState().selectedElementId;
        if (selId) {
          const el = useModelStore.getState().elements[selId];
          if (el) {
            e.preventDefault();
            const nieuweNaam = window.prompt("Element hernoemen:", el.naam);
            if (nieuweNaam && nieuweNaam !== el.naam) {
              useModelStore.getState().updateElement(selId, { naam: nieuweNaam, data: { klassenaam: nieuweNaam } });
            }
            return;
          }
        }
        // Geen element geselecteerd → probeer actief diagram te hernoemen
        const activeDiagram = useUIStore.getState().activeDiagramId;
        if (activeDiagram) {
          const diag = useModelStore.getState().diagrams[activeDiagram];
          if (diag) {
            e.preventDefault();
            const nieuweNaam = window.prompt("Diagram hernoemen:", diag.naam || activeDiagram);
            if (nieuweNaam && nieuweNaam !== diag.naam) {
              useModelStore.getState().renameDiagram(activeDiagram, nieuweNaam);
            }
          }
        }
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlePubliceer]);

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
        {isDirty && <span style={{ color: "#f5c542", fontSize: 11, fontWeight: 600 }} title="Onopgeslagen wijzigingen">● Gewijzigd</span>}
        <span style={{ flex: 1 }} />
        <button onClick={() => useModelStore.temporal.getState().undo()} style={toolbarBtn} title="Ongedaan maken (Ctrl+Z)">
          ↩ Undo
        </button>
        <button onClick={() => useModelStore.temporal.getState().redo()} style={toolbarBtn} title="Opnieuw (Ctrl+Y)">
          ↪ Redo
        </button>
        <span style={{ color: "#555" }}>|</span>
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
        <button onClick={handleExportV3} style={toolbarBtn}>
          📄 V3 Export
        </button>
        <button onClick={handlePubliceer} style={toolbarBtnAccent}>
          🚀 Publiceer
        </button>
        <button onClick={handleRebuild} style={toolbarBtnDanger}>
          ⚙️ Rebuild
        </button>
        <button onClick={handlePublishAndRebuild} style={toolbarBtnDanger}>
          🚀⚙️ Pub+Rebuild
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

      {/* ActionDialog modal */}
      {dialogType && (
        <ActionDialog
          type={dialogType}
          values={dialogValues}
          onChange={handleDialogChange}
          onClose={() => setDialogType(null)}
          onSubmit={handleDialogSubmit}
        />
      )}
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

const toolbarBtnAccent = {
  ...toolbarBtn,
  background: "#1a4a2e",
  color: "#8dff8d",
  border: "1px solid #3a7a4a",
};

const toolbarBtnDanger = {
  ...toolbarBtn,
  background: "#4a1a1a",
  color: "#ff8d8d",
  border: "1px solid #7a3a3a",
};
