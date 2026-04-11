/**
 * BestandenPanel — IDE-panel dat opgeslagen bestanden toont, gegroepeerd per categorie.
 *
 * Haalt data op via GET /full/ide_bestanden (bitemporele entiteiten met geneste GE's).
 * Klikken op een bestand toont een preview via BestandViewer.
 */
import { useState, useEffect, useCallback } from "react";
import BestandViewer from "../components/editor/BestandViewer";

function apiBase() {
  return window.location.port === "5174" ? "http://localhost:8082" : "";
}

const CATEGORIE_LABELS = {
  model_snapshot: "Model snapshots",
  ide_snapshot: "IDE snapshots",
  gegenereerde_code: "Gegenereerde code",
  import: "Imports",
  export: "Exports",
  documentatie: "Documentatie",
  configuratie: "Configuratie",
  overig: "Overig",
};

const CATEGORIE_KLEUREN = {
  model_snapshot: "#8cb4ff",
  ide_snapshot: "#a78bfa",
  gegenereerde_code: "#34d399",
  import: "#fbbf24",
  export: "#fb923c",
  documentatie: "#60a5fa",
  configuratie: "#f472b6",
  overig: "#94a3b8",
};

export default function BestandenPanel() {
  const [bestanden, setBestanden] = useState([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState(null);
  const [geselecteerd, setGeselecteerd] = useState(null); // { id, meta, preview }
  const [previewLaden, setPreviewLaden] = useState(false);

  // Haal bestanden op
  const laadBestanden = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      const base = apiBase();
      const resp = await fetch(`${base}/full/ide_bestanden`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setBestanden(Array.isArray(data) ? data : []);
    } catch (err) {
      setFout(err.message);
      setBestanden([]);
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => {
    laadBestanden();
  }, [laadBestanden]);

  // Preview laden voor een bestand
  const handleSelecteer = useCallback(async (bestand) => {
    const id = bestand.id;
    const meta = extractMeta(bestand);
    setGeselecteerd({ id, meta, preview: null });
    setPreviewLaden(true);

    try {
      const base = apiBase();
      const resp = await fetch(`${base}/api/bestanden/${id}/preview`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setGeselecteerd({ id, meta, preview: data });
    } catch (err) {
      setGeselecteerd({ id, meta, preview: { error: err.message } });
    } finally {
      setPreviewLaden(false);
    }
  }, []);

  // Download bestand
  const handleDownload = useCallback((id) => {
    const base = apiBase();
    window.open(`${base}/api/bestanden/${id}/download`, "_blank");
  }, []);

  // Groepeer per categorie
  const groepen = groepeerPerCategorie(bestanden);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "4px 8px", borderBottom: "1px solid var(--ide-controls-border, #444)",
        fontSize: 12, flexShrink: 0,
      }}>
        <strong>Bestanden</strong>
        <span style={{ flex: 1 }} />
        <button onClick={laadBestanden} style={btnStyle} title="Herlaad bestandenlijst">🔄</button>
        <span style={{ color: "#888" }}>{bestanden.length} bestanden</span>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Linkerkolom: bestandenlijst */}
        <div style={{
          width: 280, minWidth: 200, flexShrink: 0,
          borderRight: "1px solid var(--ide-controls-border, #444)",
          overflowY: "auto", fontSize: 12,
        }}>
          {laden && <div style={{ padding: 12, color: "#888" }}>Laden...</div>}
          {fout && <div style={{ padding: 12, color: "#f87171" }}>Fout: {fout}</div>}
          {!laden && bestanden.length === 0 && !fout && (
            <div style={{ padding: 12, color: "#888" }}>Nog geen bestanden opgeslagen</div>
          )}

          {Object.entries(groepen).map(([cat, items]) => (
            <div key={cat}>
              <div style={{
                padding: "4px 8px", fontWeight: 600, fontSize: 11,
                color: CATEGORIE_KLEUREN[cat] || "#888",
                background: "rgba(255,255,255,0.03)",
                borderBottom: "1px solid var(--ide-controls-border, #333)",
              }}>
                {CATEGORIE_LABELS[cat] || cat} ({items.length})
              </div>
              {items.map((b) => {
                const meta = extractMeta(b);
                const isActief = geselecteerd?.id === b.id;
                return (
                  <div
                    key={b.id}
                    onClick={() => handleSelecteer(b)}
                    style={{
                      padding: "3px 8px 3px 16px", cursor: "pointer",
                      background: isActief ? "rgba(139,180,255,0.15)" : "transparent",
                      borderLeft: isActief ? "2px solid #8cb4ff" : "2px solid transparent",
                    }}
                    title={meta.beschrijving || meta.naam}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: "#ccc" }}>{formatIcon(meta.bestandsformaat)}</span>
                      <span style={{ color: isActief ? "#fff" : "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {meta.naam || `#${b.id}`}
                      </span>
                    </div>
                    {meta.versie_label && (
                      <div style={{ color: "#888", fontSize: 10, paddingLeft: 16 }}>{meta.versie_label}</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Rechterkolom: preview */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {!geselecteerd && (
            <div style={{ padding: 24, color: "#888", textAlign: "center" }}>
              Selecteer een bestand om de preview te bekijken
            </div>
          )}
          {geselecteerd && previewLaden && (
            <div style={{ padding: 24, color: "#888", textAlign: "center" }}>Preview laden...</div>
          )}
          {geselecteerd && !previewLaden && geselecteerd.preview?.error && (
            <div style={{ padding: 24, color: "#f87171" }}>
              Preview laden mislukt: {geselecteerd.preview.error}
            </div>
          )}
          {geselecteerd && !previewLaden && geselecteerd.preview?.inhoud != null && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "4px 8px", borderBottom: "1px solid var(--ide-controls-border, #444)",
                fontSize: 12, flexShrink: 0,
              }}>
                <span style={{ flex: 1, fontWeight: 600, color: "#ccc" }}>
                  {geselecteerd.meta.naam}
                </span>
                <button onClick={() => handleDownload(geselecteerd.id)} style={btnStyle}>
                  ⬇ Download
                </button>
              </div>
              <div style={{ flex: 1, overflow: "auto" }}>
                <BestandViewer
                  inhoud={geselecteerd.preview.inhoud}
                  bestandsformaat={geselecteerd.preview.bestandsformaat || geselecteerd.meta.bestandsformaat}
                  naam={geselecteerd.preview.naam || geselecteerd.meta.naam}
                  grootte={geselecteerd.preview.grootte_bytes}
                  afgekapt={geselecteerd.preview.afgekapt}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helpers

function extractMeta(bestand) {
  // IdeBestand_Meta_Data zit genest in de entiteit response
  const metas = bestand.ide_bestand_metas || [];
  const metaHub = metas[0] || {};
  const dataArr = metaHub.data || [];
  const data = dataArr[dataArr.length - 1] || {}; // nieuwste versie

  const inhouds = bestand.ide_bestand_inhouds || [];
  const inhoudHub = inhouds[0] || {};
  const inhoudData = (inhoudHub.data || []);
  const laatsteInhoud = inhoudData[inhoudData.length - 1] || {};

  return {
    naam: data.naam || "",
    beschrijving: data.beschrijving || "",
    categorie: data.categorie || "overig",
    bestandsformaat: data.bestandsformaat || "overig",
    mime_type: data.mime_type || "",
    domein: data.domein || "",
    tags: data.tags || "",
    versie_label: laatsteInhoud.versie_label || "",
  };
}

function groepeerPerCategorie(bestanden) {
  const groepen = {};
  for (const b of bestanden) {
    const meta = extractMeta(b);
    const cat = meta.categorie || "overig";
    if (!groepen[cat]) groepen[cat] = [];
    groepen[cat].push(b);
  }
  return groepen;
}

function formatIcon(formaat) {
  switch (formaat) {
    case "json": return "{ }";
    case "yaml": return "⚙";
    case "xml": return "< >";
    case "markdown": return "📝";
    case "go_code": return "🔧";
    case "sql": return "🗃";
    default: return "📄";
  }
}

const btnStyle = {
  background: "var(--ide-controls-bg, #3c3c3c)",
  color: "var(--ide-controls-color, #ccc)",
  border: "1px solid var(--ide-controls-border, #555)",
  borderRadius: 3,
  padding: "2px 8px",
  cursor: "pointer",
  fontSize: 11,
};
