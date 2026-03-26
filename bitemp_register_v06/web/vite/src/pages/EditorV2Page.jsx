/**
 * Editor v2 — leest het V3 registermodel i.p.v. het platte viz-schema.
 *
 * Verschil met EditorPage (v1):
 * - Geen plumbing-velden (id, a_id, rel_id, versie, opvoer, afvoer)
 * - Geen hub/data/aanvang/einde subtypes — alleen logische GE's
 * - Materieel-label op GE's en relaties
 * - Inhoudelijke velden direct in de klasse
 * - Laadt standaard het nieuwste model uit de database (hoogste ID).
 *   Als de API niet beschikbaar is, wordt het ingebouwde demomodel gebruikt.
 */
import { useState, useCallback, useEffect } from "react";
import MetamodelEditor from "@editor/components/MetamodelEditor";
import "@editor/styles/editor.css";
import { v3ModelNaarEditor } from "../v3ModelNaarEditor";
import { demoV3Model } from "../demoV3Model";

// Converteer V3 demo model naar editor nodes/edges (directe fallback)
const defaultData = v3ModelNaarEditor(demoV3Model);

function apiBase() {
  // In dev draait Vite op :5174 en de Go API op :8082
  return window.location.port === "5174"
    ? "http://localhost:8082"
    : "";
}

export default function EditorV2Page() {
  const [data, setData] = useState(defaultData);
  const [editorKey, setEditorKey] = useState(0);
  const [modelBron, setModelBron] = useState("demo"); // toon herkomst in toolbar
  const [modelNaam, setModelNaam] = useState(demoV3Model.naam || "onbekend-model");
  const [modelOpmerking, setModelOpmerking] = useState(demoV3Model.beschrijving || "");

  // ── Bij opstart: probeer het nieuwste model uit de database te laden ──
  useEffect(() => {
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
        // Eerste item is de nieuwste (standaard sort: id DESC)
        const nieuwste = versies[0];
        const modelUrl = `${base}${nieuwste.model_url}`;
        return fetch(modelUrl).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        });
      })
      .then((response) => {
        const v3 = response.model || response;
        const result = v3ModelNaarEditor(v3);
        setData(result);
        setEditorKey((k) => k + 1);
        setModelBron(`DB #${response.id} (${response.status || "?"})`);
        setModelNaam(v3.naam || `model-${response.id || "onbekend"}`);
        setModelOpmerking(v3.beschrijving || "");
      })
      .catch((err) => {
        console.warn("Kon nieuwste model niet laden uit DB, gebruik demo:", err.message);
        // Blijf bij het demomodel
      });
  }, []);

  // ── Handmatig model laden via URL ──
  const handleLoadV3Model = useCallback(() => {
    const base = apiBase();
    const defaultUrl = `${base}/api/schema/model`;
    const url = prompt("V3 Model API URL:", defaultUrl);
    if (!url) return;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((response) => {
        const v3 = response.model || response;
        const result = v3ModelNaarEditor(v3);
        setData(result);
        setEditorKey((k) => k + 1);
        setModelNaam(v3.naam || "onbekend-model");
        setModelOpmerking(v3.beschrijving || "");
        setModelBron(
          response.id
            ? `DB #${response.id} (${response.status || "?"})`
            : response.bron || "url"
        );
      })
      .catch((err) => {
        console.error("V3 model laden mislukt:", err);
        alert(`Kan V3 model niet laden: ${err.message}`);
      });
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "6px 12px",
          background: "#1e293b",
          color: "#f8fafc",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "13px",
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600 }}>Editor v2</span>
        <span style={{ color: "#94a3b8" }}>|</span>
        <span
          style={{ color: "#94a3b8" }}
          title="Inhoudelijk V3 model; technische plumbing-velden (id, rel_id, opvoer, afvoer, etc.) worden hier bewust niet getoond"
        >
          V3 registermodel (inhoudelijk)
        </span>
        <span style={{ color: "#94a3b8" }}>|</span>
        <span
          style={{ color: "#e2e8f0", fontSize: "12px", maxWidth: "380px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title={modelOpmerking || "Geen opmerking/beschrijving beschikbaar"}
        >
          Model: {modelNaam}
        </span>
        <span
          style={{
            color: modelBron === "demo" ? "#fbbf24" : "#4ade80",
            fontSize: "11px",
            marginLeft: "4px",
          }}
          title="Herkomst van het geladen model"
        >
          [{modelBron}]
        </span>
        <button
          onClick={handleLoadV3Model}
          style={{
            marginLeft: "auto",
            padding: "3px 10px",
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          V3 Model laden
        </button>
      </div>
      <div style={{ flex: 1 }}>
        <MetamodelEditor
          key={editorKey}
          initialNodes={data.nodes}
          initialEdges={data.edges}
        />
      </div>
    </div>
  );
}
