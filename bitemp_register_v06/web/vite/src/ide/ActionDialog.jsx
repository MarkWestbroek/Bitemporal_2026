/**
 * ActionDialog — Modal dialoog voor Publiceer, Rebuild en Publiceer+Rebuild.
 *
 * Gebaseerd op het patroon uit EditorV2 ActionDialog, aangepast voor de IDE.
 * Ondersteunt drie modi:
 *   - "publish"            — Publiceer een schema-versie
 *   - "rebuild"            — Voer een rebuild/codegen uit
 *   - "publishAndRebuild"  — Publiceer + direct daarna rebuild
 */
import { useEffect, useRef } from "react";

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
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px" },
  field: { display: "flex", flexDirection: "column", gap: 3 },
  fieldFull: { display: "flex", flexDirection: "column", gap: 3, gridColumn: "1 / -1" },
  label: { fontSize: 11, color: "var(--ide-panel-color-muted, #999)" },
  input: {
    background: "var(--ide-input-bg, #1e1e1e)", color: "var(--ide-input-color, #ccc)", border: "1px solid var(--ide-input-border, #3a3a3a)",
    borderRadius: 3, padding: "5px 8px", fontSize: 12, outline: "none",
    width: "100%", boxSizing: "border-box",
  },
  select: {
    background: "var(--ide-input-bg, #1e1e1e)", color: "var(--ide-input-color, #ccc)", border: "1px solid var(--ide-input-border, #3a3a3a)",
    borderRadius: 3, padding: "5px 8px", fontSize: 12, outline: "none",
  },
  textarea: {
    background: "var(--ide-input-bg, #1e1e1e)", color: "var(--ide-input-color, #ccc)", border: "1px solid var(--ide-input-border, #3a3a3a)",
    borderRadius: 3, padding: "5px 8px", fontSize: 12, outline: "none",
    resize: "vertical", minHeight: 50, fontFamily: "inherit", width: "100%", boxSizing: "border-box",
  },
  note: {
    background: "#1a2633", border: "1px solid #2a4a6a", borderRadius: 4,
    padding: "6px 10px", fontSize: 11, color: "#8cb4ff", lineHeight: 1.4,
  },
  domeinLijst: {
    display: "flex", flexDirection: "column", gap: 3, maxHeight: 140,
    overflowY: "auto", padding: "4px 0",
  },
  domeinCheckbox: {
    display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer",
  },
  domeinMeta: { color: "var(--ide-panel-color-muted, #666)", fontSize: 10 },
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

const TITLES = {
  publish: "🚀 Publiceer schema-versie",
  rebuild: "⚙️ Rebuild (codegen + herstart)",
  publishAndRebuild: "🚀⚙️ Publiceer + Rebuild",
};

const SUBMIT_LABELS = {
  publish: "Publiceer",
  rebuild: "Rebuild starten",
  publishAndRebuild: "Publiceer + Rebuild",
};

export default function ActionDialog({ type, values, validationErrors = [], validationWarnings = [], onChange, onClose, onSubmit }) {
  const firstInputRef = useRef(null);
  const hasErrors = validationErrors.length > 0;

  // Focus eerste input bij openen
  useEffect(() => {
    const timer = setTimeout(() => firstInputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  // Escape sluit
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!type) return null;

  const toggleDomein = (naam) => {
    const huidige = values.beschikbareDomeinen || [];
    onChange("beschikbareDomeinen", huidige.map((d) =>
      d.naam === naam ? { ...d, geselecteerd: !d.geselecteerd } : d
    ));
  };

  const selecteerAlles = (waarde) => {
    onChange("beschikbareDomeinen", (values.beschikbareDomeinen || []).map((d) => ({ ...d, geselecteerd: waarde })));
  };

  const heeftDomeinen = Array.isArray(values.beschikbareDomeinen) && values.beschikbareDomeinen.length > 0;

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>
          <h3 style={S.title}>{TITLES[type] || type}</h3>
          <button style={S.closeBtn} onClick={onClose} aria-label="Sluiten">✕</button>
        </div>

        <form style={S.body} onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
          {/* ── Publiceer-sectie ── */}
          {(type === "publish" || type === "publishAndRebuild") && (
            <>
              <div style={S.note}>
                <strong>Tip:</strong> de <em>modelnaam</em> is alleen een label. Het volledige model (alle domeinen)
                wordt gepubliceerd. Bij rebuild kun je kiezen welke domeinen gegenereerd worden.
              </div>
              <div style={S.grid}>
                <label style={S.field}>
                  <span style={S.label}>Modelversie</span>
                  <input ref={firstInputRef} style={S.input} value={values.versie || ""} onChange={(e) => onChange("versie", e.target.value)} placeholder="v0." />
                </label>
                <label style={S.field}>
                  <span style={S.label}>Modelnaam</span>
                  <input style={S.input} value={values.naam || ""} onChange={(e) => onChange("naam", e.target.value)} placeholder="actief domein" />
                </label>
                <label style={S.field}>
                  <span style={S.label}>Indiener</span>
                  <input style={S.input} value={values.indiener || ""} onChange={(e) => onChange("indiener", e.target.value)} placeholder="MW" />
                </label>
                <label style={S.field}>
                  <span style={S.label}>API basis</span>
                  <input style={S.input} value={values.apiBase || ""} onChange={(e) => onChange("apiBase", e.target.value)} placeholder="http://localhost:8082" />
                </label>
              </div>
              <label style={S.fieldFull}>
                <span style={S.label}>Opmerking</span>
                <textarea style={S.textarea} rows={2} value={values.opmerking || ""} onChange={(e) => onChange("opmerking", e.target.value)} placeholder="optionele toelichting bij deze versie" />
              </label>
            </>
          )}

          {/* ── Rebuild-sectie ── */}
          {(type === "rebuild" || type === "publishAndRebuild") && (
            <>
              <div style={S.note}>
                <strong>Domein-selectie:</strong> vink aan welke domeinen gegenereerd moeten worden.
                Elk domein wordt apart door de codegen geleid met het juiste prefix en mode.
              </div>
              <div style={S.grid}>
                {type === "rebuild" && (
                  <label style={S.field}>
                    <span style={S.label}>Rebuild-bron</span>
                    <select style={S.select} value={values.bron || "editor"} onChange={(e) => onChange("bron", e.target.value)}>
                      <option value="editor">Actuele editorinhoud</option>
                      <option value="id">Specifiek schema-versie ID</option>
                      <option value="actief">Actieve schema-versie</option>
                      <option value="latest_proposed">Laatste proposed versie</option>
                    </select>
                  </label>
                )}
                {(type === "publishAndRebuild" || values.bron === "id") && (
                  <label style={S.field}>
                    <span style={S.label}>Schema-versie ID</span>
                    <input style={S.input} type="number" value={values.schemaVersieID || ""} onChange={(e) => onChange("schemaVersieID", e.target.value)} placeholder={type === "publishAndRebuild" ? "auto" : ""} disabled={type === "publishAndRebuild"} />
                  </label>
                )}
                <label style={S.field}>
                  <span style={S.label}>Devloop API basis</span>
                  <input style={S.input} value={values.rebuildApiBase || ""} onChange={(e) => onChange("rebuildApiBase", e.target.value)} placeholder="http://localhost:8082" />
                </label>
                <label style={S.field}>
                  <span style={S.label}>Devloop wachtwoord</span>
                  <input style={S.input} type="password" value={values.wachtwoord || ""} onChange={(e) => onChange("wachtwoord", e.target.value)} placeholder="1234" />
                </label>
              </div>

              {heeftDomeinen && (
                <div style={S.fieldFull}>
                  <span style={{ ...S.label, display: "flex", alignItems: "center", gap: 8 }}>
                    Domeinen voor codegen
                    <button type="button" style={{ fontSize: 10, padding: "1px 6px", cursor: "pointer", background: "#333", color: "#ccc", border: "1px solid #555", borderRadius: 2 }} onClick={() => selecteerAlles(true)}>alles</button>
                    <button type="button" style={{ fontSize: 10, padding: "1px 6px", cursor: "pointer", background: "#333", color: "#ccc", border: "1px solid #555", borderRadius: 2 }} onClick={() => selecteerAlles(false)}>geen</button>
                  </span>
                  <div style={S.domeinLijst}>
                    {values.beschikbareDomeinen.map((d) => (
                      <label key={d.naam} style={S.domeinCheckbox} title={`mode=${d.mode || "register"}, prefix=${d.prefix || ""}`}>
                        <input type="checkbox" checked={!!d.geselecteerd} onChange={() => toggleDomein(d.naam)} style={{ accentColor: "#4fc3f7" }} />
                        <span>{d.naam}</span>
                        <span style={S.domeinMeta}>prefix={d.prefix || ""}, {d.mode || "register"}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Validatie-resultaten ── */}
          {(hasErrors || validationWarnings.length > 0) && (
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {hasErrors && (
                <div style={{ background: "#3a1a1a", border: "1px solid #a33", borderRadius: 4, padding: "6px 10px", fontSize: 11, color: "#ff8888", lineHeight: 1.5 }}>
                  <strong>❌ Validatiefouten ({validationErrors.length}):</strong>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
              {validationWarnings.length > 0 && (
                <div style={{ background: "#3a2a0a", border: "1px solid #a93", borderRadius: 4, padding: "6px 10px", fontSize: 11, color: "#ffcc44", lineHeight: 1.5, marginTop: hasErrors ? 6 : 0 }}>
                  <strong>⚠️ Waarschuwingen ({validationWarnings.length}):</strong>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {validationWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ── Acties ── */}
          <div style={S.actions}>
            <button type="button" style={S.btnCancel} onClick={onClose}>Annuleren</button>
            <button type="submit" style={{ ...S.btnSubmit, ...(hasErrors ? { opacity: 0.4, cursor: "not-allowed" } : {}) }} disabled={hasErrors} title={hasErrors ? "Los eerst de validatiefouten op" : undefined}>{SUBMIT_LABELS[type] || "OK"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
