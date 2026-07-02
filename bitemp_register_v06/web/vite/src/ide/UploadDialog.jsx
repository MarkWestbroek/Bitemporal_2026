/**
 * UploadDialog — modal voor het uploaden van bestanden naar de IdeBestand store.
 *
 * Toont een drag-and-drop zone + metadata velden (categorie, formaat, domein, tags).
 * Stuurt een multipart POST naar /api/bestanden/upload.
 *
 * Props:
 *  - open:     boolean — of de dialog getoond wordt
 *  - onClose:  () => void
 *  - onSuccess: (result) => void — na succesvolle upload
 */
import { useState, useCallback, useRef } from "react";
import { apiBase } from "../shared/apiBase.js";

const CATEGORIEEN = [
  "model_snapshot", "ide_snapshot", "gegenereerde_code",
  "import", "export", "documentatie", "configuratie", "overig",
];

export default function UploadDialog({ open, onClose, onSuccess }) {
  const [bestand, setBestand] = useState(null);
  const [naam, setNaam] = useState("");
  const [beschrijving, setBeschrijving] = useState("");
  const [categorie, setCategorie] = useState("overig");
  const [domein, setDomein] = useState("");
  const [tags, setTags] = useState("");
  const [versieLabel, setVersieLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [fout, setFout] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const reset = useCallback(() => {
    setBestand(null);
    setNaam("");
    setBeschrijving("");
    setCategorie("overig");
    setDomein("");
    setTags("");
    setVersieLabel("");
    setFout(null);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      setBestand(file);
      if (!naam) setNaam(file.name);
    }
  }, [naam]);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      setBestand(file);
      if (!naam) setNaam(file.name);
    }
  }, [naam]);

  const handleUpload = useCallback(async () => {
    if (!bestand) return;
    setUploading(true);
    setFout(null);

    const formData = new FormData();
    formData.append("file", bestand);
    if (naam) formData.append("naam", naam);
    if (beschrijving) formData.append("beschrijving", beschrijving);
    formData.append("categorie", categorie);
    if (domein) formData.append("domein", domein);
    if (tags) formData.append("tags", tags);
    if (versieLabel) formData.append("versie_label", versieLabel);

    try {
      const base = apiBase();
      const resp = await fetch(`${base}/api/bestanden/upload`, {
        method: "POST",
        body: formData,
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text.slice(0, 200));
      }
      const result = await resp.json();
      reset();
      if (onSuccess) onSuccess(result);
      if (onClose) onClose();
    } catch (err) {
      setFout(err.message);
    } finally {
      setUploading(false);
    }
  }, [bestand, naam, beschrijving, categorie, domein, tags, versieLabel, reset, onSuccess, onClose]);

  if (!open) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, flex: 1, fontSize: 14, color: "#ccc" }}>Bestand uploaden</h3>
          <button onClick={() => { reset(); onClose(); }} style={closeBtnStyle}>✕</button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            ...dropZoneStyle,
            borderColor: dragOver ? "#8cb4ff" : "#555",
            background: dragOver ? "rgba(139,180,255,0.1)" : "rgba(255,255,255,0.02)",
          }}
        >
          <input type="file" ref={inputRef} style={{ display: "none" }} onChange={handleFileSelect} />
          {bestand ? (
            <span style={{ color: "#ccc" }}>📄 {bestand.name} ({formatGrootte(bestand.size)})</span>
          ) : (
            <span style={{ color: "#888" }}>Sleep een bestand hierheen of klik om te selecteren</span>
          )}
        </div>

        {/* Metadata velden */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          <label style={labelStyle}>
            Naam
            <input value={naam} onChange={(e) => setNaam(e.target.value)} style={inputStyle} placeholder="Bestandsnaam" />
          </label>
          <label style={labelStyle}>
            Categorie
            <select value={categorie} onChange={(e) => setCategorie(e.target.value)} style={inputStyle}>
              {CATEGORIEEN.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
            Beschrijving
            <input value={beschrijving} onChange={(e) => setBeschrijving(e.target.value)} style={inputStyle} placeholder="Optionele beschrijving" />
          </label>
          <label style={labelStyle}>
            Domein
            <input value={domein} onChange={(e) => setDomein(e.target.value)} style={inputStyle} placeholder="bijv. register" />
          </label>
          <label style={labelStyle}>
            Tags
            <input value={tags} onChange={(e) => setTags(e.target.value)} style={inputStyle} placeholder="Kommagescheiden" />
          </label>
          <label style={labelStyle}>
            Versie label
            <input value={versieLabel} onChange={(e) => setVersieLabel(e.target.value)} style={inputStyle} placeholder="bijv. v1.0" />
          </label>
        </div>

        {/* Foutmelding */}
        {fout && <div style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{fout}</div>}

        {/* Acties */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={() => { reset(); onClose(); }} style={btnStyle}>Annuleer</button>
          <button
            onClick={handleUpload}
            disabled={!bestand || uploading}
            style={{ ...btnAccentStyle, opacity: (!bestand || uploading) ? 0.5 : 1 }}
          >
            {uploading ? "Uploaden..." : "⬆ Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatGrootte(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Styles
const overlayStyle = {
  position: "fixed", inset: 0, zIndex: 9999,
  background: "rgba(0,0,0,0.6)", display: "flex",
  alignItems: "center", justifyContent: "center",
};

const dialogStyle = {
  background: "#2d2d2d", borderRadius: 8, padding: 20,
  width: 520, maxWidth: "90vw", maxHeight: "80vh",
  border: "1px solid #555", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
};

const closeBtnStyle = {
  background: "none", border: "none", color: "#888",
  fontSize: 16, cursor: "pointer", padding: 4,
};

const dropZoneStyle = {
  border: "2px dashed #555", borderRadius: 6,
  padding: 24, textAlign: "center", cursor: "pointer",
  transition: "all 0.2s",
};

const labelStyle = {
  display: "flex", flexDirection: "column", gap: 2,
  fontSize: 11, color: "#999",
};

const inputStyle = {
  background: "#1e1e1e", color: "#ccc", border: "1px solid #555",
  borderRadius: 3, padding: "4px 8px", fontSize: 12,
};

const btnStyle = {
  background: "#3c3c3c", color: "#ccc",
  border: "1px solid #555", borderRadius: 3,
  padding: "6px 16px", cursor: "pointer", fontSize: 12,
};

const btnAccentStyle = {
  ...btnStyle,
  background: "#1a4a2e", color: "#8dff8d",
  border: "1px solid #3a7a4a",
};
