/**
 * ExportDialog — Modal dialoog voor het exporteren van het model.
 *
 * Biedt twee formaten (IDE-export en V3-export), domein-selectie,
 * versiebeheer per domein en een bewerkbare bestandsnaam.
 */
import { useState, useEffect, useCallback } from "react";

const S = {
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000,
  },
  dialog: {
    background: "var(--ide-menu-bg, #2d2d2d)", border: "1px solid var(--ide-menu-border, #555)", borderRadius: 8,
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)", minWidth: 420, maxWidth: 560,
    color: "var(--ide-panel-color, #ccc)", fontSize: 13,
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 16px", borderBottom: "1px solid var(--ide-menu-sep, #444)",
  },
  title: { margin: 0, fontSize: 15, color: "var(--ide-panel-color-heading, #ddd)" },
  closeBtn: {
    background: "none", border: "none", color: "var(--ide-panel-color-muted, #888)", fontSize: 18,
    cursor: "pointer", padding: "0 4px", lineHeight: 1,
  },
  body: { padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 },
  field: { display: "flex", flexDirection: "column", gap: 3 },
  label: { fontSize: 11, color: "var(--ide-panel-color-muted, #999)" },
  input: {
    background: "var(--ide-input-bg, #1e1e1e)", color: "var(--ide-input-color, #ccc)", border: "1px solid var(--ide-input-border, #3a3a3a)",
    borderRadius: 3, padding: "5px 8px", fontSize: 12, outline: "none",
    width: "100%", boxSizing: "border-box",
  },
  select: {
    background: "var(--ide-input-bg, #1e1e1e)", color: "var(--ide-input-color, #ccc)", border: "1px solid var(--ide-input-border, #3a3a3a)",
    borderRadius: 3, padding: "5px 8px", fontSize: 12, outline: "none",
    width: "100%", boxSizing: "border-box",
  },
  radioGroup: {
    display: "flex", gap: 16, padding: "2px 0",
  },
  radioLabel: {
    display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 12,
  },
  note: {
    background: "#1a2633", border: "1px solid #2a4a6a", borderRadius: 4,
    padding: "6px 10px", fontSize: 11, color: "#8cb4ff", lineHeight: 1.4,
  },
  filenamePreview: {
    fontFamily: "monospace", fontSize: 12, color: "#8dff8d", padding: "4px 8px",
    background: "#1a2a1a", borderRadius: 3, border: "1px solid #3a5a3a",
    width: "100%", boxSizing: "border-box",
  },
  actions: {
    display: "flex", justifyContent: "flex-end", gap: 8,
    padding: "8px 16px", borderTop: "1px solid var(--ide-menu-sep, #444)",
  },
  btnCancel: {
    background: "var(--ide-btn-bg, #3c3c3c)", color: "var(--ide-btn-color, #ccc)", border: "1px solid var(--ide-btn-border, #555)",
    borderRadius: 3, padding: "5px 14px", cursor: "pointer", fontSize: 12,
  },
  btnSubmit: {
    background: "#1a4a2e", color: "#8dff8d", border: "1px solid #3a7a4a",
    borderRadius: 3, padding: "5px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
  },
};

const FORMAT_IDE = "ide";
const FORMAT_V3 = "v3";

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {string[]} props.domains          — lijst van domeinnamen
 * @param {Object}   props.domainMeta       — Record<naam, {versie?, ...}>
 * @param {string}   props.modelVersie      — modelMeta.versie (fallback)
 * @param {Function} props.onExport         — (format, filename) => void
 * @param {Function} props.onUpdateVersie   — (domein, versie) => void  — slaat versie op in domainMeta
 * @param {Function} props.onClose
 */
export default function ExportDialog({ open, domains, domainMeta, modelVersie, onExport, onUpdateVersie, onClose }) {
  const [format, setFormat] = useState(FORMAT_V3);
  const [domein, setDomein] = useState("");
  const [versie, setVersie] = useState("");
  const [filename, setFilename] = useState("");
  const [filenameManual, setFilenameManual] = useState(false);

  // Auto-fill versie wanneer domein verandert
  useEffect(() => {
    if (domein && domainMeta?.[domein]?.versie) {
      setVersie(domainMeta[domein].versie);
    } else {
      setVersie(modelVersie || "");
    }
    setFilenameManual(false);
  }, [domein, domainMeta, modelVersie]);

  // Auto-generate filename (tenzij handmatig aangepast)
  useEffect(() => {
    if (filenameManual) return;
    const prefix = format === FORMAT_IDE ? "ide-export" : "v3-model";
    const domeinPart = domein || "alle-domeinen";
    const versiePart = versie ? ` v${versie}` : "";
    setFilename(`${domeinPart}${versiePart} — ${prefix}.json`);
  }, [format, domein, versie, filenameManual]);

  const handleFilenameChange = useCallback((e) => {
    setFilename(e.target.value);
    setFilenameManual(true);
  }, []);

  const handleExport = useCallback(() => {
    // Sla versie op in domainMeta als er een domein gekozen is
    if (domein && versie && onUpdateVersie) {
      onUpdateVersie(domein, versie);
    }
    onExport(format, filename, domein);
  }, [format, filename, domein, versie, onExport, onUpdateVersie]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter") handleExport();
  }, [onClose, handleExport]);

  if (!open) return null;

  return (
    <div style={S.backdrop} onClick={onClose} onKeyDown={handleKeyDown}>
      <div style={S.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={S.header}>
          <h3 style={S.title}>💾 Exporteer model</h3>
          <button style={S.closeBtn} onClick={onClose} title="Sluiten">✕</button>
        </div>

        {/* Body */}
        <div style={S.body}>
          {/* Formaat */}
          <div style={S.field}>
            <label style={S.label}>Formaat</label>
            <div style={S.radioGroup}>
              <label style={S.radioLabel}>
                <input type="radio" name="exportFormat" value={FORMAT_V3} checked={format === FORMAT_V3} onChange={() => setFormat(FORMAT_V3)} />
                📄 V3 Model <span style={{ color: "#888", fontSize: 10 }}>(entiteiten, enums, datatypes)</span>
              </label>
              <label style={S.radioLabel}>
                <input type="radio" name="exportFormat" value={FORMAT_IDE} checked={format === FORMAT_IDE} onChange={() => setFormat(FORMAT_IDE)} />
                🏗 IDE Snapshot <span style={{ color: "#888", fontSize: 10 }}>(volledig + diagrammen)</span>
              </label>
            </div>
          </div>

          {/* Domein */}
          <div style={S.field}>
            <label style={S.label}>Domein</label>
            <select style={S.select} value={domein} onChange={(e) => { setDomein(e.target.value); setFilenameManual(false); }}>
              <option value="">Alle domeinen</option>
              {(domains || []).map((d) => (
                <option key={d} value={d}>{d}{domainMeta?.[d]?.versie ? ` (v${domainMeta[d].versie})` : ""}</option>
              ))}
            </select>
          </div>

          {/* Versie */}
          <div style={S.field}>
            <label style={S.label}>Versie{domein ? ` (${domein})` : ""}</label>
            <input
              style={S.input}
              value={versie}
              onChange={(e) => { setVersie(e.target.value); setFilenameManual(false); }}
              placeholder="bijv. 1.0, 2.3, ..."
            />
          </div>

          {/* Bestandsnaam */}
          <div style={S.field}>
            <label style={S.label}>Bestandsnaam</label>
            <input
              style={{ ...S.input, ...S.filenamePreview }}
              value={filename}
              onChange={handleFilenameChange}
            />
          </div>

          {/* Toelichting */}
          <div style={S.note}>
            {format === FORMAT_V3
              ? "V3 Model export: bevat entiteiten, gegevenselementen, relaties, enums en datatypes. Geschikt voor publicatie en diff."
              : "IDE Snapshot: bevat het volledige editormodel inclusief diagramposities, domeinen en structurele edges."}
            {domein
              ? ` Gefilterd op domein "${domein}".`
              : " Alle domeinen worden meegenomen."}
          </div>
        </div>

        {/* Actions */}
        <div style={S.actions}>
          <button style={S.btnCancel} onClick={onClose}>Annuleren</button>
          <button style={S.btnSubmit} onClick={handleExport}>💾 Exporteer</button>
        </div>
      </div>
    </div>
  );
}
