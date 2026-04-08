export default function ActionDialog({ dialog, onChange, onClose, onSubmit }) {
  if (!dialog) return null;

  const { type, title, submitLabel, values = {}, validationErrors = [], validationWarnings = [] } = dialog;
  const hasErrors = validationErrors.length > 0;

  // Toggle een domein aan/uit in de beschikbareDomeinen lijst.
  const toggleDomein = (domeinNaam) => {
    const huidige = values.beschikbareDomeinen || [];
    const bijgewerkt = huidige.map((d) =>
      d.naam === domeinNaam ? { ...d, geselecteerd: !d.geselecteerd } : d
    );
    onChange("beschikbareDomeinen", bijgewerkt);
  };

  // Selecteer alle / geen domeinen.
  const selecteerAlles = (waarde) => {
    const huidige = values.beschikbareDomeinen || [];
    onChange("beschikbareDomeinen", huidige.map((d) => ({ ...d, geselecteerd: waarde })));
  };

  const heeftDomeinen = Array.isArray(values.beschikbareDomeinen) && values.beschikbareDomeinen.length > 0;

  return (
    <div className="editor-dialog-backdrop" onClick={onClose}>
      <div className="editor-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="editor-dialog-header">
          <h3>{title}</h3>
          <button type="button" className="editor-dialog-close" onClick={onClose} aria-label="Sluiten">
            ✕
          </button>
        </div>

        <form
          className="editor-dialog-body"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          {type === "save" && (
            <div className="editor-dialog-grid one-column">
              <label className="editor-dialog-field">
                <span>Bestandsnaam</span>
                <input
                  type="text"
                  value={values.bestandsnaam || ""}
                  onChange={(e) => onChange("bestandsnaam", e.target.value)}
                  placeholder="bijv. np_loc_model.json"
                  autoFocus
                />
              </label>
            </div>
          )}

          {(type === "publish" || type === "publishAndRebuild") && (
            <>
              <div className="editor-dialog-note">
                <strong>Tip:</strong> de <em>modelnaam</em> is alleen een label. Het volledige model (alle domeinen)
                wordt gepubliceerd. Bij rebuild kun je kiezen welke domeinen gegenereerd worden.
              </div>

              <div className="editor-dialog-grid">
                <label className="editor-dialog-field">
                  <span>Modelversie</span>
                  <input
                    type="text"
                    value={values.versie || ""}
                    onChange={(e) => onChange("versie", e.target.value)}
                    placeholder="v0."
                    autoFocus
                  />
                </label>

                <label className="editor-dialog-field">
                  <span>Modelnaam</span>
                  <input
                    type="text"
                    value={values.naam || ""}
                    onChange={(e) => onChange("naam", e.target.value)}
                    placeholder="actief domein"
                  />
                </label>

                <label className="editor-dialog-field">
                  <span>Indiener</span>
                  <input
                    type="text"
                    value={values.indiener || ""}
                    onChange={(e) => onChange("indiener", e.target.value)}
                    placeholder="MW"
                  />
                </label>

                <label className="editor-dialog-field">
                  <span>API basis</span>
                  <input
                    type="text"
                    value={values.apiBase || ""}
                    onChange={(e) => onChange("apiBase", e.target.value)}
                    placeholder="http://localhost:8182"
                  />
                </label>
              </div>

              <label className="editor-dialog-field full-width">
                <span>Opmerking</span>
                <textarea
                  rows={3}
                  value={values.opmerking || ""}
                  onChange={(e) => onChange("opmerking", e.target.value)}
                  placeholder="optionele toelichting bij deze schema-versie"
                />
              </label>
            </>
          )}

          {(type === "rebuild" || type === "publishAndRebuild") && (
            <>
              <div className="editor-dialog-note">
                <strong>Domein-selectie:</strong> vink aan welke domeinen gegenereerd moeten worden.
                Elk domein wordt apart door de codegen geleid met het juiste prefix en mode.
              </div>

              <div className="editor-dialog-grid">
                {type === "rebuild" && (
                  <label className="editor-dialog-field">
                    <span>Rebuild-bron</span>
                    <select value={values.bron || "editor"} onChange={(e) => onChange("bron", e.target.value)}>
                      <option value="editor">Actuele editorinhoud</option>
                      <option value="id">Specifiek schema-versie ID</option>
                      <option value="actief">Actieve schema-versie</option>
                      <option value="latest_proposed">Laatste proposed versie</option>
                    </select>
                  </label>
                )}

                {(type === "publishAndRebuild" || values.bron === "id") && (
                  <label className="editor-dialog-field">
                    <span>Schema-versie ID</span>
                    <input
                      type="number"
                      value={values.schemaVersieID || ""}
                      onChange={(e) => onChange("schemaVersieID", e.target.value)}
                      placeholder="wordt bij Pub+Rebuild automatisch gevuld"
                      disabled={type === "publishAndRebuild"}
                    />
                  </label>
                )}

                <label className="editor-dialog-field">
                  <span>Devloop API basis</span>
                  <input
                    type="text"
                    value={values.apiBase || ""}
                    onChange={(e) => onChange("apiBase", e.target.value)}
                    placeholder="http://localhost:8182"
                  />
                </label>

                <label className="editor-dialog-field">
                  <span>Devloop wachtwoord</span>
                  <input
                    type="password"
                    value={values.wachtwoord || ""}
                    onChange={(e) => onChange("wachtwoord", e.target.value)}
                    placeholder="1234"
                  />
                </label>
              </div>

              {heeftDomeinen && (
                <div className="editor-dialog-field full-width">
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    Domeinen voor codegen
                    <button
                      type="button"
                      style={{ fontSize: "0.75em", padding: "1px 6px", cursor: "pointer" }}
                      onClick={() => selecteerAlles(true)}
                    >alles</button>
                    <button
                      type="button"
                      style={{ fontSize: "0.75em", padding: "1px 6px", cursor: "pointer" }}
                      onClick={() => selecteerAlles(false)}
                    >geen</button>
                  </span>
                  <div className="editor-dialog-domein-lijst">
                    {values.beschikbareDomeinen.map((d) => (
                      <label key={d.naam} className="editor-dialog-domein-checkbox" title={`mode=${d.mode}, prefix=${d.prefix}`}>
                        <input
                          type="checkbox"
                          checked={!!d.geselecteerd}
                          onChange={() => toggleDomein(d.naam)}
                        />
                        <span className="domein-naam">{d.naam}</span>
                        <span className="domein-meta">prefix={d.prefix}, {d.mode}</span>
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
                <div className="editor-dialog-note" style={{ background: "#3a1a1a", borderColor: "#a33", color: "#ff8888" }}>
                  <strong>❌ Validatiefouten ({validationErrors.length}):</strong>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18, listStyle: "disc" }}>
                    {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
              {validationWarnings.length > 0 && (
                <div className="editor-dialog-note" style={{ background: "#3a2a0a", borderColor: "#a93", color: "#ffcc44" }}>
                  <strong>⚠️ Waarschuwingen ({validationWarnings.length}):</strong>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18, listStyle: "disc" }}>
                    {validationWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="editor-dialog-actions">
            <button type="button" className="btn-toolbar load" onClick={onClose}>
              Annuleren
            </button>
            <button type="submit" className="btn-toolbar publish" disabled={hasErrors} style={hasErrors ? { opacity: 0.4, cursor: "not-allowed" } : {}} title={hasErrors ? "Los eerst de validatiefouten op" : undefined}>
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
