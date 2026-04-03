import { labelVoorDomein, safeArray } from "../../shared/schemaUtils";

export default function SchemaTijdlijnControls({
  baseUrl,
  setBaseUrl,
  beschikbareDomeinen,
  geselecteerdDomein,
  setGeselecteerdDomein,
  domeinenError,
  entityType,
  setEntityType,
  entityTypes,
  entityId,
  setEntityId,
  loadTimeline,
  loading,
  downloadTimelineAsPng,
  exporting,
  items,
  copyTimelineAsPng,
  copying,
  error,
}) {
  return (
    <div className="card">
      <div className="controls" style={{ gridTemplateColumns: "repeat(5, minmax(180px, 1fr))" }}>
        <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <label>
            API base URL
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value.trim())} />
          </label>
          <label>
            Domein
            <select value={geselecteerdDomein} onChange={(e) => setGeselecteerdDomein(e.target.value)}>
              <option value="">(alle)</option>
              {safeArray(beschikbareDomeinen).map((domein) => (
                <option key={`domein-${domein.naam || "__zonder_domein__"}`} value={domein.naam}>
                  {labelVoorDomein(domein.naam)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Entiteittype
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)} disabled={entityTypes.length === 0}>
            {entityTypes.length === 0 && <option value="">Geen entiteittypen</option>}
            {entityTypes.map((et) => <option key={et.typenaam} value={et.typenaam}>{et.klassenaam || et.typenaam}</option>)}
          </select>
        </label>
        <label>
          Entiteit-id
          <input type="number" min="0" step="1" value={entityId} onChange={(e) => setEntityId(e.target.value)} />
        </label>
        <div style={{ alignSelf: "end" }}>
          <button onClick={loadTimeline} disabled={loading || !entityType}>{loading ? "Bezig met ophalen..." : "Ophalen tijdslijn"}</button>
        </div>
        <div style={{ alignSelf: "end", display: "flex", gap: 8 }}>
          <button onClick={downloadTimelineAsPng} disabled={loading || exporting || items.length === 0}>
            {exporting ? "PNG maken..." : "Download PNG"}
          </button>
          <button onClick={copyTimelineAsPng} disabled={loading || exporting || copying || items.length === 0}>
            {copying ? "Kopie maken..." : "Kopieer PNG"}
          </button>
        </div>
      </div>
      {domeinenError && <p className="muted" style={{ color: "#b45309" }}>Domeinen laden lukte niet volledig: {domeinenError}</p>}
      {error && <p className="error-text">Fout: {error}</p>}
    </div>
  );
}
