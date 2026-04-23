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
import MetamodelEditor from "@umleditor/components/MetamodelEditor";
import "@umleditor/styles/editor.css";
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

function haalModelIdUitUrl(url) {
  const match = String(url || "").match(/\/api\/schema\/model\/(\d+)(?:\?.*)?$/);
  return match ? Number(match[1]) : null;
}

export default function EditorV2Page() {
  const [data, setData] = useState(defaultData);
  const [editorKey, setEditorKey] = useState(0);
  const [modelBron, setModelBron] = useState("demo"); // toon herkomst in toolbar
  const [modelNaam, setModelNaam] = useState(demoV3Model.naam || "onbekend-model");
  const [modelVersie, setModelVersie] = useState(demoV3Model.versie || "v3");
  const [modelOpmerking, setModelOpmerking] = useState(demoV3Model.beschrijving || "");

  const pasModelMetadataToe = useCallback((response, sourceUrl) => {
    const v3 = response?.model || response;
    const modelId = response?.id || haalModelIdUitUrl(sourceUrl);
    const modelStatus = response?.status || "?";

    setModelBron(modelId ? `DB #${modelId} (${modelStatus})` : (response?.bron || "url"));
    setModelNaam(response?.model_naam || v3?.naam || (modelId ? `model-${modelId}` : "onbekend-model"));
    setModelVersie(v3?.versie || "v3");
    setModelOpmerking(response?.model_beschrijving || v3?.beschrijving || "");
  }, []);

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
        pasModelMetadataToe(response);
      })
      .catch((err) => {
        console.warn("Kon nieuwste model niet laden uit DB, gebruik demo:", err.message);
        // Blijf bij het demomodel
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
      <MetamodelEditor
        key={editorKey}
        initialNodes={data.nodes}
        initialEdges={data.edges}
        onV3ModelLoaded={pasModelMetadataToe}
        modelNaam={modelNaam}
        modelVersie={modelVersie}
        modelBron={modelBron}
        modelOpmerking={modelOpmerking}
      />
    </div>
  );
}
