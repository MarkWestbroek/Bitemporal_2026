export default function ActionDialog({ dialog, onChange, onClose, onSubmit }) {
  if (!dialog) return null;

  const { type, title, submitLabel, values = {} } = dialog;

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
                <strong>Tip:</strong> de <em>modelnaam</em> is alleen een label. Voor codegeneratie bepaalt vooral het gekozen
                <code> domein </code> en <code> prefix </code> waar de bestanden terechtkomen.
              </div>

              <div className="editor-dialog-grid">
                <label className="editor-dialog-field">
                  <span>Modelversie</span>
                  <input
                    type="text"
                    value={values.versie || ""}
                    onChange={(e) => onChange("versie", e.target.value)}
                    placeholder="bijv. v3"
                    autoFocus
                  />
                </label>

                <label className="editor-dialog-field">
                  <span>Modelnaam</span>
                  <input
                    type="text"
                    value={values.naam || ""}
                    onChange={(e) => onChange("naam", e.target.value)}
                    placeholder="bijv. np-loc"
                  />
                </label>

                <label className="editor-dialog-field">
                  <span>Indiener</span>
                  <input
                    type="text"
                    value={values.indiener || ""}
                    onChange={(e) => onChange("indiener", e.target.value)}
                    placeholder="uml-editor-v2"
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

                <label className="editor-dialog-field">
                  <span>Domein</span>
                  <input
                    type="text"
                    value={values.domein || ""}
                    onChange={(e) => onChange("domein", e.target.value)}
                    placeholder="bijv. np-loc"
                  />
                </label>

                <label className="editor-dialog-field">
                  <span>Prefix</span>
                  <input
                    type="text"
                    value={values.prefix || ""}
                    onChange={(e) => onChange("prefix", e.target.value)}
                    placeholder="bijv. np_loc"
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
                <strong>Let op:</strong> `modelnaam` bepaalt niet het codegen-domein. Gebruik voor NP/Locatie bijvoorbeeld
                <code> domein = np-loc </code> en <code> prefix = np_loc </code>.
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
                  <span>Domein</span>
                  <input
                    type="text"
                    value={values.domein || ""}
                    onChange={(e) => onChange("domein", e.target.value)}
                    placeholder="bijv. np-loc"
                  />
                </label>

                <label className="editor-dialog-field">
                  <span>Prefix</span>
                  <input
                    type="text"
                    value={values.prefix || ""}
                    onChange={(e) => onChange("prefix", e.target.value)}
                    placeholder="bijv. np_loc"
                  />
                </label>

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
            </>
          )}

          <div className="editor-dialog-actions">
            <button type="button" className="btn-toolbar load" onClick={onClose}>
              Annuleren
            </button>
            <button type="submit" className="btn-toolbar publish">
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
