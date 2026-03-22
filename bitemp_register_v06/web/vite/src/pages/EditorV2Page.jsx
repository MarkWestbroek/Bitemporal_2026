/**
 * Editor v2 — leest het V3 registermodel i.p.v. het platte viz-schema.
 *
 * Verschil met EditorPage (v1):
 * - Geen plumbing-velden (id, a_id, rel_id, versie, opvoer, afvoer)
 * - Geen hub/data/aanvang/einde subtypes — alleen logische GE's
 * - Materieel-label op GE's en relaties
 * - Inhoudelijke velden direct in de klasse
 * - Laadt standaard van /api/schema/model/code zodat de editor de actuele code-toestand toont
 */
import { useState, useCallback } from "react";
import MetamodelEditor from "@editor/components/MetamodelEditor";
import "@editor/styles/editor.css";
import { v3ModelNaarEditor } from "../v3ModelNaarEditor";
import { demoV3Model } from "../demoV3Model";

// Converteer V3 demo model naar editor nodes/edges
const defaultData = v3ModelNaarEditor(demoV3Model);

export default function EditorV2Page() {
  const [data, setData] = useState(defaultData);
  const [editorKey, setEditorKey] = useState(0);

  const handleLoadV3Model = useCallback(() => {
    const defaultUrl =
      window.location.port === "5174"
        ? "http://localhost:8082/api/schema/model/code"
        : "/api/schema/model/code";
    const url = prompt("V3 Model API URL:", defaultUrl);
    if (!url) return;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((response) => {
        // De API response wraps het model in een 'model' property
        const v3 = response.model || response;
        const result = v3ModelNaarEditor(v3);
        setData(result);
        setEditorKey((k) => k + 1);
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
        <span style={{ color: "#94a3b8" }}>
          V3 registermodel (zonder plumbing)
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
